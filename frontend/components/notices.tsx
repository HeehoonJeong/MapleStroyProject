"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Notice = { notice_type: string; notice_id: number; title: string; source_url: string; notice_date: string };
const types = [
  ["all", "전체"], ["notice", "공지"], ["update", "업데이트"], ["event", "이벤트"], ["cashshop", "캐시샵"],
] as const;
const labels: Record<string, string> = Object.fromEntries(types);

export default function Notices() {
  const [category, setCategory] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const client = getSupabaseClient();
      if (!client) { if (active) { setError("서비스 연결 설정을 확인해 주세요."); setLoading(false); } return; }
      const { data, error: loadError } = await client.rpc("list_maple_notices", { p_type: category, p_offset: page * 20 });
      if (!active) return;
      if (loadError) { setError("공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); setNotices([]); }
      else setNotices((data ?? []) as Notice[]);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [category, page]);

  return <section className="notice-panel" aria-label="공식 공지사항">
    <div className="notice-heading"><div><span className="eyebrow">MAPLESTORY NEWS</span><h2>공지사항</h2><p>넥슨 공식 홈페이지의 소식을 확인하세요.</p></div><span className="notice-heading-icon" aria-hidden="true">✳</span></div>
    <div className="notice-filters" aria-label="공지 분류">{types.map(([id, label]) => <button key={id} type="button" className={category === id ? "notice-filter active" : "notice-filter"} aria-pressed={category === id} onClick={() => { setCategory(id); setPage(0); }}>{label}</button>)}</div>
    <div className="notice-table" role="table" aria-label="공지사항 목록">
      <div className="notice-row notice-table-head" role="row"><span role="columnheader">구분</span><span role="columnheader">제목</span><span role="columnheader">날짜</span></div>
      {loading ? <p className="notice-state" role="status">공지사항을 불러오고 있어요.</p> : error ? <p className="notice-state error-text" role="alert">{error}</p> : notices.length === 0 ? <p className="notice-state">표시할 공지사항이 없습니다.</p> : notices.slice(0, 20).map((notice) => <a className="notice-row notice-link" role="row" href={notice.source_url} target="_blank" rel="noopener noreferrer" key={`${notice.notice_type}-${notice.notice_id}`}><span role="cell"><span className={`notice-badge notice-${notice.notice_type}`}>{labels[notice.notice_type] ?? "공지"}</span></span><span className="notice-title" role="cell">{notice.title} <span aria-hidden="true">↗</span></span><time role="cell" dateTime={notice.notice_date.slice(0, 10)}>{notice.notice_date.slice(0, 10).replaceAll("-", ".")}</time></a>)}
    </div>
    <div className="notice-pagination"><span>공식 원문은 새 창에서 열립니다.</span><div><button type="button" disabled={loading || page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1}</span><button type="button" disabled={loading || notices.length <= 20} onClick={() => setPage(page + 1)}>다음</button></div></div>
  </section>;
}
