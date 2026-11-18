import { withSupabase } from "@supabase/server";

const NEXON_BASE = "https://open.api.nexon.com/maplestory/v1";
const UPSTAGE_EMBEDDINGS_URL = "https://api.upstage.ai/v1/embeddings";
const EMBEDDING_BATCH_SIZE = 8;
const MAX_NOTICES_PER_CATEGORY = 100;
const MAX_EMBEDDING_RETRIES = 5;

type NoticeType = "notice" | "update" | "event" | "cashshop";
type NoticeCategory = {
  type: NoticeType;
  listPath: string;
  listKey: string;
  detailPath: string;
};
type NoticeListItem = {
  notice_id: number | string;
  title: string;
  url: string;
  date: string;
  [key: string]: unknown;
};
type NoticeForEmbedding = {
  type: NoticeType;
  noticeId: number;
  title: string;
  url: string;
  date: string;
  content: string;
  metadata: Record<string, unknown>;
  contentHash: string;
  chunks: string[];
  embeddings: number[][];
};

const categories: NoticeCategory[] = [
  { type: "notice", listPath: "notice", listKey: "notice", detailPath: "notice/detail" },
  { type: "update", listPath: "notice-update", listKey: "update_notice", detailPath: "notice-update/detail" },
  { type: "event", listPath: "notice-event", listKey: "event_notice", detailPath: "notice-event/detail" },
  { type: "cashshop", listPath: "notice-cashshop", listKey: "cashshop_notice", detailPath: "notice-cashshop/detail" },
];

async function nexonGet(path: string, apiKey: string, params: Record<string, string> = {}) {
  const url = new URL(`${NEXON_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { "x-nxopen-api-key": apiKey },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message ?? `NEXON API HTTP ${response.status}`);
  return body;
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return output;
}

function htmlToText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*>/gi, " $1 ")
    .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(text: string, maxLength = 1400, overlap = 180): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxLength, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(" ", end));
      if (boundary > start + maxLength * 0.55) end = boundary;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks.length ? chunks : [text.slice(0, maxLength)];
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function embedPassages(texts: string[], apiKey: string): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
    let response: Response | undefined;
    let payload: any;
    for (let attempt = 0; attempt < MAX_EMBEDDING_RETRIES; attempt++) {
      response = await fetch(UPSTAGE_EMBEDDINGS_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "solar-embedding-2-passage", input: batch }),
        signal: AbortSignal.timeout(30_000),
      });
      payload = await response.json().catch(() => ({}));
      if (response.status !== 429) break;
      if (attempt === MAX_EMBEDDING_RETRIES - 1) {
        throw new Error("Upstage embedding rate limit이 반복되어 동기화를 중단했습니다.");
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 20_000)
        : Math.min(1000 * (2 ** attempt), 16_000);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    if (!response?.ok) throw new Error(`Upstage embeddings HTTP ${response?.status ?? "unknown"}`);
    const rows = Array.isArray(payload?.data) ? [...payload.data].sort((a: any, b: any) => Number(a.index) - Number(b.index)) : [];
    if (rows.length !== batch.length || rows.some((row: any) => !Array.isArray(row.embedding) || row.embedding.length !== 1024)) {
      throw new Error("Upstage 임베딩 응답의 개수 또는 차원이 맞지 않습니다.");
    }
    vectors.push(...rows.map((row: any) => row.embedding as number[]));
  }
  return vectors;
}

function safeEquals(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index++) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") return Response.json({ error: "POST is required." }, { status: 405 });
    const expectedSecret = Deno.env.get("NOTICE_SYNC_SECRET") ?? "";
    const suppliedSecret = request.headers.get("x-sync-secret") ?? "";
    if (!safeEquals(suppliedSecret, expectedSecret)) return Response.json({ error: "Unauthorized." }, { status: 401 });

    const nexonKey = Deno.env.get("NEXON_API_KEY") ?? "";
    const upstageKey = Deno.env.get("UPSTAGE_API_KEY") ?? "";
    if (!nexonKey || !upstageKey) {
      return Response.json({ error: "NEXON_API_KEY and UPSTAGE_API_KEY are required." }, { status: 503 });
    }

    let force = false;
    try { force = Boolean((await request.json())?.force); } catch { /* Empty POST body is valid. */ }

    const report = {
      categories: {} as Record<string, { listed: number; changed: number; unchanged: number; failed: number }>,
      chunks_upserted: 0,
      errors: [] as string[],
    };
    const changedNotices: Array<{ notice: NoticeForEmbedding; noticePk: string; oldHash: string }> = [];

    for (const category of categories) {
      const categoryReport = report.categories[category.type] = { listed: 0, changed: 0, unchanged: 0, failed: 0 };
      let listItems: NoticeListItem[] = [];
      try {
        const listPayload = await nexonGet(category.listPath, nexonKey);
        const rows = listPayload?.[category.listKey];
        listItems = Array.isArray(rows) ? rows.slice(0, MAX_NOTICES_PER_CATEGORY) : [];
        categoryReport.listed = listItems.length;
      } catch {
        categoryReport.failed++;
        report.errors.push(`${category.type}: 공지 목록 조회 실패`);
        continue;
      }

      const detailRows = await mapConcurrent(listItems, 3, async (item) => {
        try {
          const detail = await nexonGet(category.detailPath, nexonKey, { notice_id: String(item.notice_id) });
          const title = String(detail.title ?? item.title ?? "제목 없음");
          const url = String(detail.url ?? item.url ?? "");
          const date = String(detail.date ?? item.date ?? "");
          const eventMetadata = {
            date_event_start: detail.date_event_start ?? item.date_event_start,
            date_event_end: detail.date_event_end ?? item.date_event_end,
            date_sale_start: detail.date_sale_start ?? item.date_sale_start,
            date_sale_end: detail.date_sale_end ?? item.date_sale_end,
            ongoing_flag: detail.ongoing_flag ?? item.ongoing_flag,
          };
          const metadata = Object.fromEntries(Object.entries({ ...item, ...eventMetadata }).filter(([, value]) => value !== undefined && value !== null));
          const body = htmlToText(detail.contents);
          const contents = [
            `${title}\n분류: ${category.type}\n등록일: ${date}\n공식 링크: ${url}`,
            Object.entries(eventMetadata).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join("\n"),
            body,
          ].filter(Boolean).join("\n\n");
          const contentHash = await sha256(JSON.stringify({ title, url, date, contents, metadata }));
          const searchText = chunkText(contents);
          return {
            type: category.type,
            noticeId: Number(item.notice_id),
            title,
            url,
            date,
            contents,
            metadata,
            contentHash,
            chunks: searchText,
            embeddings: [] as number[][],
          } satisfies NoticeForEmbedding;
        } catch {
          categoryReport.failed++;
          return null;
        }
      });

      for (const notice of detailRows) {
        if (!notice) continue;
        try {
          const { data: existing, error: lookupError } = await context.supabaseAdmin
            .from("maple_notices")
            .select("id,content_hash")
            .eq("notice_type", notice.type)
            .eq("notice_id", notice.noticeId)
            .maybeSingle();
          if (lookupError) throw lookupError;
          if (!force && existing?.content_hash === notice.contentHash) {
            const { error: refreshError } = await context.supabaseAdmin
              .from("maple_notices")
              .update({ synced_at: new Date().toISOString() })
              .eq("id", existing.id);
            if (refreshError) throw refreshError;
            categoryReport.unchanged++;
            continue;
          }
          changedNotices.push({
            notice,
            noticePk: existing?.id ?? crypto.randomUUID(),
            oldHash: existing?.content_hash ?? "pending",
          });
        } catch (error) {
          categoryReport.failed++;
          report.errors.push(`${notice.type}/${notice.noticeId}: ${error instanceof Error ? error.message : "조회 실패"}`);
        }
      }
    }

    const allChunkTexts = changedNotices.flatMap(({ notice }) => notice.chunks);
    let allEmbeddings: number[][] = [];
    if (allChunkTexts.length) {
      try {
        allEmbeddings = await embedPassages(allChunkTexts, upstageKey);
      } catch (error) {
        for (const { notice } of changedNotices) {
          report.categories[notice.type].failed++;
        }
        report.errors.push(error instanceof Error ? error.message : "공지 임베딩 실패");
        return Response.json({ ok: false, ...report }, { status: 502 });
      }
    }

    let embeddingOffset = 0;
    for (const { notice, noticePk, oldHash } of changedNotices) {
      try {
        notice.embeddings = allEmbeddings.slice(embeddingOffset, embeddingOffset + notice.chunks.length);
        embeddingOffset += notice.chunks.length;
        const { error: parentError } = await context.supabaseAdmin.from("maple_notices").upsert({
          id: noticePk,
          notice_type: notice.type,
          notice_id: notice.noticeId,
          title: notice.title,
          source_url: notice.url,
          notice_date: notice.date,
          contents: notice.contents,
          metadata: notice.metadata,
          content_hash: oldHash,
          synced_at: new Date().toISOString(),
        }, { onConflict: "notice_type,notice_id" });
        if (parentError) throw parentError;

        const chunkRows = notice.chunks.map((content, chunkIndex) => ({
          notice_pk: noticePk,
          notice_type: notice.type,
          notice_id: notice.noticeId,
          chunk_index: chunkIndex,
          title: notice.title,
          source_url: notice.url,
          notice_date: notice.date,
          content,
          embedding: notice.embeddings[chunkIndex],
        }));
        const { error: chunkError } = await context.supabaseAdmin
          .from("maple_notice_chunks")
          .upsert(chunkRows, { onConflict: "notice_pk,chunk_index" });
        if (chunkError) throw chunkError;
        const { error: staleChunkError } = await context.supabaseAdmin
          .from("maple_notice_chunks")
          .delete()
          .eq("notice_pk", noticePk)
          .gte("chunk_index", notice.chunks.length);
        if (staleChunkError) throw staleChunkError;
        const { error: finalUpdateError } = await context.supabaseAdmin
          .from("maple_notices")
          .update({
            title: notice.title,
            source_url: notice.url,
            notice_date: notice.date,
            contents: notice.contents,
            metadata: notice.metadata,
            content_hash: notice.contentHash,
            synced_at: new Date().toISOString(),
          })
          .eq("id", noticePk);
        if (finalUpdateError) throw finalUpdateError;

        report.categories[notice.type].changed++;
        report.chunks_upserted += chunkRows.length;
      } catch (error) {
        report.categories[notice.type].failed++;
        report.errors.push(`${notice.type}/${notice.noticeId}: ${error instanceof Error ? error.message : "동기화 실패"}`);
      }
    }

    return Response.json({ ok: true, ...report });
  }),
};
