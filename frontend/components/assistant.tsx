"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { features, type FeatureId } from "@/lib/features";
import { getSupabaseClient } from "@/lib/supabase/client";
import Notices from "@/components/notices";
import Hunting from "@/components/hunting";

type Citation = { title: string; source: string; url?: string | null };
type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  sources?: Citation[];
  character?: CharacterProfile;
};
type ChatRoom = { id: string; title: string; created_at: string; updated_at: string };
type CharacterProfile = { image?: string; name?: string; level?: number | string; job?: string; world?: string };
type SavedCharacter = {
  character_name: string; world_name: string | null; character_class: string | null;
  character_level: number | null; character_exp_rate: string | null; character_guild_name: string | null;
  character_image: string | null; combat_power: string | null; boss_damage: string | null;
  ignore_defense: string | null; union_level: number | null; union_artifact_level: number | null;
  dojang_best_floor: number | null; data_date: string | null;
};
type StreamEvent = {
  type?: string;
  text?: string;
  message?: string;
  profile?: CharacterProfile;
  sources?: Citation[];
  partial?: boolean;
};

export default function Assistant() {
  const router = useRouter();
  const [savedCharacter, setSavedCharacter] = useState<SavedCharacter | null>(null);
  const [view, setView] = useState<"chat" | "notices" | "hunting">("chat");
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [featureId, setFeatureId] = useState<FeatureId | "auto">("auto");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("로그인 상태를 확인하고 있어요");
  const [error, setError] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const previewUrl = useMemo(() => image ? URL.createObjectURL(image) : "", [image]);
  const currentFeature = features.find((item) => item.id === featureId);
  const displayName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? "용사님";
  const avatar = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture;

  useEffect(() => {
    const queryFeature = new URLSearchParams(window.location.search).get("feature");
    if (queryFeature === "auto" || features.some((feature) => feature.id === queryFeature)) {
      setFeatureId(queryFeature as FeatureId | "auto");
    }
  }, []);

  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();
    if (!client) {
      setStatus("Supabase 환경 변수를 설정해 주세요");
      return;
    }
    const authenticatedClient = client as NonNullable<typeof client>;

    async function initialize(sessionToken?: string | null) {
      const token = sessionToken === undefined
        ? (await authenticatedClient.auth.getSession()).data.session?.access_token
        : sessionToken;
      if (!token) {
        if (!active) return;
        setReady(false);
        router.replace("/");
        return;
      }
      const { data: { user: currentUser } } = await authenticatedClient.auth.getUser(token);
      if (!active) return;
      if (!currentUser) {
        router.replace("/");
        return;
      }
      setUser(currentUser);
      setAccessToken(token);
      const { data: character } = await authenticatedClient.from("maple_user_representative_characters")
        .select("character_name, world_name, character_class, character_level, character_exp_rate, character_guild_name, character_image, combat_power, boss_damage, ignore_defense, union_level, union_artifact_level, dojang_best_floor, data_date")
        .eq("user_id", currentUser.id).maybeSingle();
      if (active && character) setSavedCharacter(character as SavedCharacter);
      try {
        const { data, error: roomError } = await authenticatedClient
          .from("maple_chat_rooms")
          .select("id, title, created_at, updated_at")
          .order("updated_at", { ascending: false });
        if (roomError) throw roomError;
        if (!active) return;
        setRooms((data ?? []) as ChatRoom[]);
        setStatus("준비 완료 · 공지와 공략을 검색합니다");
        setReady(true);
      } catch {
        if (!active) return;
        setError("채팅 목록을 불러오지 못했습니다. 데이터베이스 마이그레이션과 로그인을 확인해 주세요.");
        setStatus("데이터베이스 연결 오류");
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function refreshRooms() {
    const client = getSupabaseClient();
    if (!client) return;
    const { data } = await client
      .from("maple_chat_rooms")
      .select("id, title, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (data) setRooms(data as ChatRoom[]);
  }

  async function openRoom(room: ChatRoom) {
    if (busy) return;
    const client = getSupabaseClient();
    if (!client) return;
    setError("");
    const { data, error: loadError } = await client
      .from("maple_chat_messages")
      .select("id, role, content, sources, created_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true });
    if (loadError) {
      setError("대화 내용을 불러오지 못했습니다.");
      return;
    }
    setView("chat");
    setSelectedRoom(room);
    setMessages((data ?? []) as ChatMessage[]);
  }

  async function signOut() {
    const client = getSupabaseClient();
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else router.replace("/");
  }

  function useExample(example: string) {
    setPrompt(example);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || busy || !ready || !accessToken || !user) return;
    const client = getSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!client || !supabaseUrl || !publishableKey) {
      setError("Supabase 설정을 확인해 주세요.");
      return;
    }

    setError("");
    setPrompt("");
    setBusy(true);
    setStatus("질문에 맞는 문서와 데이터를 찾고 있어요");
    const previousMessages = messages;
    const localUserMessage: ChatMessage = { role: "user", content: text, created_at: new Date().toISOString() };
    setMessages((previous) => [...previous, localUserMessage, {
      role: "assistant", content: "", created_at: new Date().toISOString(),
    }]);

    let room = selectedRoom;
    let answer = "";
    let citations: Citation[] = [];
    try {
      if (!room) {
        const { data, error: createError } = await client
          .from("maple_chat_rooms")
          .insert({ user_id: user.id, title: text.slice(0, 56) || "새 대화" })
          .select("id, title, created_at, updated_at")
          .single();
        if (createError || !data) throw createError ?? new Error("채팅방을 만들지 못했습니다.");
        room = data as ChatRoom;
        setSelectedRoom(room);
      } else if (previousMessages.length === 0) {
        const { data } = await client
          .from("maple_chat_rooms")
          .update({ title: text.slice(0, 56) || "새 대화" })
          .eq("id", room.id)
          .select("id, title, created_at, updated_at")
          .single();
        if (data) {
          room = data as ChatRoom;
          setSelectedRoom(room);
        }
      }

      const { error: userSaveError } = await client.from("maple_chat_messages").insert({
        room_id: room.id,
        user_id: user.id,
        role: "user",
        content: text,
      });
      if (userSaveError) throw userSaveError;
      void refreshRooms();

      const { data: { session } } = await client.auth.getSession();
      const currentToken = session?.access_token ?? accessToken;
      const imageData = image ? await readImage(image) : undefined;
      const response = await fetch(`${supabaseUrl}/functions/v1/maple-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: publishableKey,
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          prompt: text,
          feature: featureId,
          history: previousMessages.slice(-12).map(({ role, content }) => ({ role, content })),
          image: imageData,
        }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `요청에 실패했습니다 (${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) processFrame(frame);
      }
      buffer += decoder.decode();
      if (buffer.trim()) processFrame(buffer);

      const { error: answerSaveError } = await client.from("maple_chat_messages").insert({
        room_id: room.id,
        user_id: user.id,
        role: "assistant",
        content: cleanCharacterImageUrls(answer) || "답변을 생성하지 못했습니다.",
        sources: citations,
      });
      if (answerSaveError) {
        setError("답변은 생성했지만 대화 저장에 실패했습니다. 데이터베이스 정책을 확인해 주세요.");
      }
      setStatus("준비 완료 · 공지와 공략을 검색합니다");
      void refreshRooms();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.";
      setError(message);
      const fallback = answer || "요청을 처리하지 못했습니다.";
      setMessages((previous) => previous.map((item, index) =>
        index === previous.length - 1 && item.role === "assistant"
          ? { ...item, content: fallback, sources: citations }
          : item,
      ));
      if (room && user) {
        await client.from("maple_chat_messages").insert({
          room_id: room.id,
          user_id: user.id,
          role: "assistant",
          content: fallback,
          sources: citations,
        });
        void refreshRooms();
      }
      setStatus("요청 처리에 실패했습니다");
    } finally {
      setBusy(false);
      setImage(null);
    }

    function processFrame(frame: string) {
      let eventType = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventType = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) return;
      let event: StreamEvent;
      try { event = JSON.parse(data) as StreamEvent; } catch { return; }
      if (eventType === "token" && event.text) {
        answer += event.text;
        setMessages((previous) => previous.map((item, index) =>
          index === previous.length - 1 && item.role === "assistant"
            ? { ...item, content: item.content + event.text }
            : item,
        ));
      } else if (eventType === "saved_character" && event.profile) {
        setSavedCharacter(event.profile as unknown as SavedCharacter);
        if (event.partial) setError("일부 캐릭터 정보는 넥슨 API에서 제공받지 못해 저장된 항목만 표시합니다.");
      } else if (eventType === "character_save_error") {
        setError(event.message ?? "캐릭터 정보를 저장하지 못했습니다.");
      } else if (eventType === "character" && event.profile) {
        setMessages((previous) => previous.map((item, index) =>
          index === previous.length - 1 && item.role === "assistant"
            ? { ...item, character: event.profile }
            : item,
        ));
      } else if (eventType === "sources" && event.sources) {
        citations = event.sources;
        setMessages((previous) => previous.map((item, index) =>
          index === previous.length - 1 && item.role === "assistant"
            ? { ...item, sources: citations }
            : item,
        ));
      } else if (eventType === "status" && event.message) {
        setStatus(event.message);
      } else if (eventType === "error") {
        throw new Error(event.message ?? "요청을 처리하지 못했습니다.");
      }
    }
  }

  return (
    <main className="site-shell assistant-shell">
      <nav className="topbar">
        <Link className="wordmark" href="/">MAPLE / AI</Link>
        <div className="profile-actions">
          {avatar && <img className="avatar" src={avatar} alt="프로필" referrerPolicy="no-referrer" />}
          <span className="profile-name">{displayName}</span>
          <button className="text-button compact-button" type="button" onClick={signOut}>로그아웃</button>
        </div>
      </nav>

      <header className="assistant-header">
        <div>
          <p className="eyebrow">MAPLESTORY KNOWLEDGE · RAG CHAT</p>
          <h1>Play smarter,<br />Maple better.</h1>
          <p>캐릭터와 사냥터, 공지까지. 메이플에 필요한 정보를 더 빠르게.</p>
        </div>
        <img className="assistant-art" src="/assets/maple-battle.png" alt="메이플스토리 전투 장면" />
      </header>

      <div className="assistant-layout">
        <aside className="tool-panel">
          {savedCharacter && <CharacterCard character={savedCharacter} />}
          <nav className="section-nav" aria-label="서비스 메뉴"><button type="button" className={view === "chat" ? "active" : ""} aria-current={view === "chat" ? "page" : undefined} onClick={() => setView("chat")}>대화 <span>↗</span></button><button type="button" className={view === "notices" ? "active" : ""} aria-current={view === "notices" ? "page" : undefined} onClick={() => setView("notices")}>공지사항 <span>↗</span></button><button type="button" className={view === "hunting" ? "active" : ""} aria-current={view === "hunting" ? "page" : undefined} onClick={() => setView("hunting")}>사냥터 <span>↗</span></button></nav>
          <div className="room-heading"><span className="eyebrow">YOUR CHATS</span><button className="text-button compact-button" type="button" disabled={busy} onClick={() => { setView("chat"); setSelectedRoom(null); setMessages([]); setError(""); }}>+ 새 대화</button></div>
          <div className="room-list">
            {rooms.length === 0 && <p className="disclaimer">저장된 대화가 없습니다.</p>}
            {rooms.map((room) => (
              <button className={`room-button${selectedRoom?.id === room.id ? " active" : ""}`} type="button" key={room.id} onClick={() => void openRoom(room)} disabled={busy}>
                <span>{room.title}</span><small>{formatTime(room.updated_at)}</small>
              </button>
            ))}
          </div>

          <label className="eyebrow" htmlFor="feature-select">질문 도구</label>
          <select id="feature-select" className="tool-select" value={featureId} onChange={(event) => setFeatureId(event.target.value as FeatureId | "auto")}>
            <option value="auto">자동으로 선택</option>
            {features.map((feature) => <option value={feature.id} key={feature.id}>{feature.number} / {feature.title}</option>)}
          </select>
          <div className="tool-summary">
            <div className="eyebrow">{currentFeature ? `${currentFeature.number} / ${currentFeature.title}` : "RAG · 자동 검색"}</div>
            <p>{currentFeature?.description ?? "질문과 관련된 공지·공략 문서를 의미 검색하고, 필요한 경우 캐릭터 데이터를 조회합니다."}</p>
          </div>
          <div className="eyebrow">질문 예시</div>
          <div className="quick-prompts">
            {(currentFeature ? [currentFeature.example] : ["마일리지 개편과 소멸 일정을 알려줘", "캐릭터 장비를 보고 스펙업할 점을 알려줘"]).map((example) => (
              <button className="text-button prompt-example" type="button" key={example} onClick={() => useExample(example)}>{example}</button>
            ))}
          </div>
          <div className="upload-row">
            <label htmlFor="auction-image">이미지 첨부 · 최대 8MB</label>
            <input id="auction-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
          </div>
          {image && <p className="disclaimer">첨부: {image.name} <button className="inline-button" type="button" onClick={() => setImage(null)}>삭제</button></p>}
        </aside>

        {view === "notices" && ready && <Notices />}
        {view === "hunting" && ready && <Hunting />}
        <section hidden={view !== "chat"} className="chat-panel" aria-label="메이플스토리 AI 채팅">
          <div className="status-text" aria-live="polite">{status}</div>
          <div className="chat-log" ref={logRef}>
            {messages.length === 0 && <div className="chat-empty"><span className="eyebrow">A BETTER WAY TO PLAY</span><h2>메이플의 다음 모험을<br />함께 준비해요.</h2><p>공지, 이벤트, 육성, 캐릭터에 관해 질문해 보세요.</p></div>}
            {messages.map((message, index) => (
              <article className="message" key={message.id ?? `${index}-${message.role}`}>
                <div className="message-meta"><div className="message-role">{message.role === "user" ? "나" : "MAPLE / AI"}</div><time>{formatTime(message.created_at)}</time></div>
                {message.character?.image && (
                  <div className="character-profile">
                    <img src={message.character.image} alt={`${message.character.name ?? "캐릭터"} 이미지`} />
                    <span>{[message.character.name, message.character.level && `Lv.${message.character.level}`, message.character.job, message.character.world].filter(Boolean).join(" · ")}</span>
                  </div>
                )}
                <div className="message-content">{cleanCharacterImageUrls(message.content) || (busy && index === messages.length - 1 ? "답변을 작성하고 있어요…" : "")}</div>
                {!!message.sources?.length && (
                  <div className="source-list"><span className="eyebrow">참고한 문서</span>{message.sources.map((source, sourceIndex) => (
                    <a className="source-link" href={source.url || undefined} target={source.url ? "_blank" : undefined} rel={source.url ? "noreferrer" : undefined} key={`${source.source}-${sourceIndex}`}>
                      <span>{source.title}</span><small>{source.source}</small>
                    </a>
                  ))}</div>
                )}
              </article>
            ))}
          </div>
          {!ready && <p className="disclaimer">Google 계정과 Supabase 설정을 확인하고 있습니다.</p>}
          {error && <p className="error-text" role="alert">{error}</p>}
          <form className="chat-form" onSubmit={onSubmit}>
            <input className="chat-input" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="공지, 공략, 캐릭터에 관해 물어보세요…" disabled={!ready || busy} />
            <button className="outline-button" type="submit" disabled={!ready || busy || !prompt.trim()}>{busy ? "검색 중…" : "전송 →"}</button>
          </form>
        </section>
      </div>
      <footer className="footer">답변은 참고용입니다. 최신 공지와 정확한 정보는 연결된 넥슨 공식 출처를 확인하세요.</footer>
    </main>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

async function readImage(file: File): Promise<{ mimeType: string; base64: string }> {
  if (file.size > 8 * 1024 * 1024) throw new Error("이미지는 8MB 이하로 올려 주세요.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
  return { mimeType: file.type, base64: dataUrl.split(",", 2)[1] ?? "" };
}

function CharacterCard({ character }: { character: SavedCharacter }) {
  const fields = [
    ["직업", character.character_class],
    ["레벨", character.character_level != null ? `Lv.${character.character_level}${character.character_exp_rate ? ` (${character.character_exp_rate}%)` : ""}` : null],
    ["길드", character.character_guild_name],
    ["유니온", character.union_level != null ? character.union_level.toLocaleString("ko-KR") : null],
    ["아티팩트", character.union_artifact_level != null ? `Lv.${character.union_artifact_level}` : null],
    ["무릉도장", character.dojang_best_floor != null ? `${character.dojang_best_floor}층` : null],
    ["보스 데미지", character.boss_damage != null ? `${character.boss_damage}%` : null],
    ["방어율 무시", character.ignore_defense != null ? `${character.ignore_defense}%` : null],
  ];
  return <section className="saved-character" aria-label="최근 조회한 캐릭터">
    <div className="saved-character-heading"><span className="eyebrow">LAST CHARACTER</span><span>최근 조회</span></div>
    <div className="saved-character-hero">
      <div className="saved-character-image">{character.character_image && <img src={character.character_image} alt={`${character.character_name} 캐릭터`} />}</div>
      <div className="saved-character-identity"><span className="saved-character-world">{character.world_name ?? "월드 미확인"}</span><h3>{character.character_name}</h3><span>{character.character_class ?? "직업 미확인"}</span></div>
    </div>
    <div className="saved-character-power"><span>전투력</span><strong>{character.combat_power ? formatPower(character.combat_power) : "정보 없음"}</strong></div>
    <dl className="saved-character-stats">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>
    <p className="saved-character-date">넥슨 데이터 기준 {character.data_date ?? "날짜 미확인"}</p>
  </section>;
}

function formatPower(value: string) {
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed.toLocaleString("ko-KR") : value;
}

function cleanCharacterImageUrls(text: string) {
  return text.replace(/^[ \t]*[-*]?[ \t]*(?:캐릭터\s*이미지|character_image)[ \t]*[:：]?[ \t]*(?:\r?\n[ \t]*)?https?:\/\/[^\s]+[ \t]*$/gim, "")
    .replace(/https?:\/\/open\.api\.nexon\.com\/static\/maplestory\/character\/look\/[^\s]+/gi, "");
}
