"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { features, type FeatureId } from "@/lib/features";
import { isToolEnabled } from "@/lib/feature-flags";
import Feedback from "@/components/feedback";
import { getSupabaseClient } from "@/lib/supabase/client";
import Notices from "@/components/notices";
import Hunting from "@/components/hunting";
import Partners from "@/components/partners";
import CharacterDashboard, { CharacterComparison, type CharacterSnapshot } from "@/components/character/dashboard";
import Markdown from "@/components/character/markdown";
import { LocalChatRepository, RemoteChatRepository, type ChatRepository } from "@/lib/chat/repository";

type Citation = { title: string; source: string; url?: string | null };
type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  sources?: Citation[];
  character?: CharacterProfile;
  character_snapshot_ids?: number[];
  executed_tools?: string[];
  snapshots?: CharacterSnapshot[];
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
  snapshot?: CharacterSnapshot;
  executed_tools?: string[];
};

export default function Assistant() {
  const repositoryRef = useRef<ChatRepository | null>(null);
  const identityRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const [guestImportAvailable, setGuestImportAvailable] = useState(false);
  const [hasGuestRooms, setHasGuestRooms] = useState(false);
  const [importing, setImporting] = useState(false);
  const [savedCharacter, setSavedCharacter] = useState<SavedCharacter | null>(null);
  const [view, setView] = useState<"chat" | "notices" | "hunting" | "partners">("chat");
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
    if (!client) { setStatus("Supabase 환경 변수를 설정해 주세요"); return; }
    async function initialize(token: string | null, requestedUserId: string | null) {
      const generation = ++generationRef.current;
      requestRef.current?.abort();
      repositoryRef.current = null;
      identityRef.current = null;
      setReady(false); setBusy(false); setUser(null); setAccessToken("");
      setMessages([]); setRooms([]); setSelectedRoom(null); setSavedCharacter(null); setPrompt(""); setImage(null); setView("chat"); setGuestImportAvailable(false); setHasGuestRooms(false); setError("");
      try {
        let currentUser: User | null = null;
        if (token) {
          const result = await client!.auth.getUser(token);
          if (result.error || !result.data.user || result.data.user.id !== requestedUserId) throw new Error("로그인 상태를 확인하지 못했습니다. 새로고침해 주세요.");
          currentUser = result.data.user;
        }
        if (!active || generation !== generationRef.current) return;
        const repository: ChatRepository = currentUser ? new RemoteChatRepository(client!, currentUser.id) : new LocalChatRepository();
        const [loadedRooms, character] = await Promise.all([repository.listRooms(), repository.getLastCharacter<SavedCharacter>()]);
        if (!active || generation !== generationRef.current) return;
        repositoryRef.current = repository; identityRef.current = currentUser?.id ?? "guest";
        setUser(currentUser); setAccessToken(token ?? ""); setRooms(loadedRooms); setSavedCharacter(character);
        setStatus(isToolEnabled("search_maple_guide") ? "준비 완료 · 공지와 공략을 검색합니다" : "준비 완료 · 공지와 캐릭터 정보를 확인합니다"); setReady(true);
        if (currentUser) {
          const guestRooms = await new LocalChatRepository().listRooms();
          if (active && generation === generationRef.current) setHasGuestRooms(guestRooms.length > 0);
          if (active && generation === generationRef.current && guestRooms.length && localStorage.getItem(`maple-guest-import-${currentUser.id}`) !== "dismissed") setGuestImportAvailable(true);
        }
      } catch (cause) {
        if (!active || generation !== generationRef.current) return;
        setError(cause instanceof Error ? cause.message : "대화 저장소를 불러오지 못했습니다."); setStatus("연결을 확인해 주세요");
      }
    }
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" && session?.user.id === identityRef.current) { setAccessToken(session.access_token); return; }
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        if (event !== "INITIAL_SESSION" && (session?.user.id ?? "guest") === identityRef.current) { setAccessToken(session?.access_token ?? ""); return; }
        // Clear the previous identity before asynchronous verification or storage access.
        generationRef.current++; requestRef.current?.abort(); repositoryRef.current = null; identityRef.current = null;
        setReady(false); setMessages([]); setRooms([]); setSelectedRoom(null); setSavedCharacter(null); setPrompt(""); setImage(null); setView("chat"); setUser(null); setAccessToken("");
        setTimeout(() => { if (active) void initialize(session?.access_token ?? null, session?.user.id ?? null); }, 0);
      }
    });
    return () => { active = false; generationRef.current++; requestRef.current?.abort(); subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function refreshRooms() {
    const repository = repositoryRef.current, generation = generationRef.current;
    if (!repository) return;
    try { const data = await repository.listRooms(); if (generation === generationRef.current) setRooms(data); } catch { if (generation === generationRef.current) setError("대화 목록을 불러오지 못했습니다."); }
  }

  async function openRoom(room: ChatRoom) {
    if (busy) return;
    const repository = repositoryRef.current, generation = generationRef.current;
    if (!repository) return;
    setError("");
    try {
      const data = await repository.getMessages(room.id);
      if (generation !== generationRef.current) return;
      setView("chat"); setSelectedRoom(room); setMessages(data as ChatMessage[]);
    } catch { if (generation === generationRef.current) setError("대화 내용을 불러오지 못했습니다."); }
  }

  async function deleteRoom(room: ChatRoom) {
    if (busy || !window.confirm(`‘${room.title}’ 대화를 삭제할까요?`)) return;
    const repository = repositoryRef.current, generation = generationRef.current;
    if (!repository) return;
    try { await repository.deleteRoom(room.id); if (generation !== generationRef.current) return; if (selectedRoom?.id === room.id) { setSelectedRoom(null); setMessages([]); } await refreshRooms(); }
    catch { if (generation === generationRef.current) setError("대화를 삭제하지 못했습니다."); }
  }

  async function signIn() {
    const client = getSupabaseClient(); if (!client) return;
    const { error: authError } = await client.auth.signInWithOAuth({ provider:"google", options:{redirectTo:`${window.location.origin}/auth/callback?next=/assistant`} });
    if (authError) setError(authError.message);
  }
  async function signOut() {
    const client = getSupabaseClient(); if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }
  async function importGuestRooms() {
    const client = getSupabaseClient(); if (!client || !user || importing) return;
    const generation = generationRef.current; const token = accessToken; setImporting(true); setError("");
    try {
      const local = new LocalChatRepository();
      for (const room of await local.listRooms()) {
        if (generation !== generationRef.current) return;
        const localMessages = await local.getMessages(room.id);
        if (generation !== generationRef.current) return;
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/import_maple_guest_room`, {
          method: "POST", headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ p_room: room, p_messages: localMessages }),
        });
        if (!response.ok) throw new Error("Import failed");
      }
      if (generation !== generationRef.current) return;
      localStorage.setItem(`maple-guest-import-${user.id}`, "dismissed"); setGuestImportAvailable(false); await refreshRooms();
    } catch { if (generation === generationRef.current) setError("대화 이전에 실패했습니다. 브라우저 원본은 보존되어 있으며 다시 시도할 수 있습니다."); }
    finally { if (generation === generationRef.current) setImporting(false); }
  }

  function selectExample(example: string) {
    setPrompt(example);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || busy || !ready || !repositoryRef.current) return;
    const client = getSupabaseClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!client || !supabaseUrl || !publishableKey) {
      setError("Supabase 설정을 확인해 주세요.");
      return;
    }

    const repository = repositoryRef.current;
    const generation = generationRef.current;
    const isGuest = !user;
    const abort = new AbortController();
    requestRef.current = abort;
    const isCurrent = () => generation === generationRef.current && !abort.signal.aborted;
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
    const savedSnapshots: CharacterSnapshot[] = [];
    let executedTools: string[] = [];
    try {
      if (!room) {
        room = await repository.createRoom(text.slice(0, 56) || "새 대화");
        if (!isCurrent()) return;
        setSelectedRoom(room);
      }
      await repository.saveMessage(room.id, localUserMessage);
      if (!isCurrent()) return;
      void refreshRooms();

      const { data: { session } } = await client.auth.getSession();
      if (!isCurrent()) return;
      if (!isGuest && session?.user.id !== user?.id) throw new Error("로그인 상태가 변경되었습니다. 다시 시도해 주세요.");
      const currentToken = session?.access_token ?? accessToken;
      const imageData = image ? await readImage(image) : undefined;
      const response = await fetch(`${supabaseUrl}/functions/v1/${isGuest ? "maple-guest" : "maple-agent"}`, {
        method: "POST",
        signal: abort.signal,
        headers: {
          "Content-Type": "application/json",
          apikey: publishableKey,
          ...(isGuest ? {} : { Authorization: `Bearer ${currentToken}` }),
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
        if (!isCurrent()) return;
        buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) processFrame(frame);
      }
      buffer += decoder.decode();
      if (buffer.trim()) processFrame(buffer);

      if (!isCurrent()) return;
      try {
        await repository.saveMessage(room.id, {
          role: "assistant", content: cleanCharacterImageUrls(answer) || "답변을 생성하지 못했습니다.",
          created_at: new Date().toISOString(), sources: citations,
          character_snapshot_ids: isGuest ? [] : savedSnapshots.map(snapshot => snapshot.id),
          snapshots: isGuest ? [...savedSnapshots] : undefined,
          executed_tools: executedTools,
        });
      } catch {
        if (isCurrent()) setError("답변은 생성했지만 대화 저장에 실패했습니다.");
      }
      setStatus(isToolEnabled("search_maple_guide") ? "준비 완료 · 공지와 공략을 검색합니다" : "준비 완료 · 공지와 캐릭터 정보를 확인합니다");
      void refreshRooms();
    } catch (cause) {
      if (!isCurrent()) return;
      const message = cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.";
      setError(message);
      const fallback = answer || "요청을 처리하지 못했습니다.";
      setMessages((previous) => previous.map((item, index) =>
        index === previous.length - 1 && item.role === "assistant"
          ? { ...item, content: fallback, sources: citations }
          : item,
      ));
      if (room && isCurrent()) {
        try { await repository.saveMessage(room.id, { role:"assistant", content:fallback, sources:citations, created_at:new Date().toISOString(), character_snapshot_ids:isGuest ? [] : savedSnapshots.map(snapshot => snapshot.id), snapshots:isGuest ? [...savedSnapshots] : undefined, executed_tools:executedTools }); void refreshRooms(); } catch { /* Keep the original error visible. */ }
      }
      setStatus("요청 처리에 실패했습니다");
    } finally {
      if (isCurrent()) { setBusy(false); setImage(null); requestRef.current = null; }
    }

    function processFrame(frame: string) {
      if (!isCurrent()) return;
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
        if (isGuest) void repository.saveLastCharacter(event.profile).catch(() => { if (isCurrent()) setError("최근 캐릭터를 브라우저에 저장하지 못했습니다."); });
        if (event.snapshot) {
          savedSnapshots.push(event.snapshot);
          executedTools = event.executed_tools ?? [];
          setMessages(previous => previous.map((item, index) => index === previous.length - 1 && item.role === "assistant" ? { ...item, snapshots: [...savedSnapshots], character_snapshot_ids: isGuest ? [] : savedSnapshots.map(snapshot => snapshot.id), executed_tools: executedTools } : item));
        }
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
        <div className="profile-actions"><Feedback />
          {avatar && <img className="avatar" src={avatar} alt="프로필" referrerPolicy="no-referrer" />}
          <span className={user ? "profile-name" : "guest-mode-label"}>{user ? displayName : "게스트"}</span>
          {user ? <button className="text-button compact-button" type="button" onClick={signOut}>로그아웃</button> : <button className="text-button compact-button" type="button" onClick={signIn} disabled={!ready}>Google 로그인</button>}
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
          {ready && !user && <p className="guest-notice">게스트 모드 · 대화는 이 브라우저에 저장됩니다. 브라우저 데이터 삭제 또는 시크릿 모드 종료 시 사라질 수 있습니다.</p>}
          {savedCharacter && <CharacterCard character={savedCharacter} />}
          <nav className="section-nav" aria-label="서비스 메뉴"><button type="button" className={view === "chat" ? "active" : ""} aria-current={view === "chat" ? "page" : undefined} onClick={() => setView("chat")}>대화 <span>↗</span></button><button type="button" className={view === "notices" ? "active" : ""} aria-current={view === "notices" ? "page" : undefined} onClick={() => setView("notices")}>공지사항 <span>↗</span></button><button type="button" className={view === "hunting" ? "active" : ""} aria-current={view === "hunting" ? "page" : undefined} onClick={() => setView("hunting")}>사냥터 <span>↗</span></button><button type="button" className={view === "partners" ? "active" : ""} aria-current={view === "partners" ? "page" : undefined} onClick={() => setView("partners")}>파트너스 <span>↗</span></button></nav>
          <div className="room-heading"><span className="eyebrow">YOUR CHATS</span><button className="text-button compact-button" type="button" disabled={busy} onClick={() => { setView("chat"); setSelectedRoom(null); setMessages([]); setError(""); }}>+ 새 대화</button></div>
          <div className="room-list">
            {rooms.length === 0 && <p className="disclaimer">저장된 대화가 없습니다.</p>}
            {rooms.map((room) => (
              <div className="room-entry" key={room.id}>
                <button className={`room-button${selectedRoom?.id === room.id ? " active" : ""}`} type="button" onClick={() => void openRoom(room)} disabled={busy}><span>{room.title}</span><small>{formatTime(room.updated_at)}</small></button>
                <button className="room-delete" type="button" aria-label={`${room.title} 대화 삭제`} onClick={() => void deleteRoom(room)} disabled={busy}>×</button>
              </div>
            ))}
          </div>

          <div className="eyebrow">질문 예시</div>
          <div className="quick-prompts">
            {(currentFeature ? [currentFeature.example] : ["마일리지 개편과 소멸 일정을 알려줘", "캐릭터 장비를 보고 스펙업할 점을 알려줘"]).map((example) => (
              <button className="text-button prompt-example" type="button" key={example} onClick={() => selectExample(example)}>{example}</button>
            ))}
          </div>
          {isToolEnabled("analyze_auction_screenshot") && <div className="upload-row">
            <label htmlFor="auction-image">이미지 첨부 · 최대 8MB</label>
            <input id="auction-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
          </div>}
          {isToolEnabled("analyze_auction_screenshot") && image && <p className="disclaimer">첨부: {image.name} <button className="inline-button" type="button" onClick={() => setImage(null)}>삭제</button></p>}
        </aside>

        {view === "notices" && ready && <Notices />}
        {view === "hunting" && ready && <Hunting />}
        {view === "partners" && ready && <Partners />}
        <section hidden={view !== "chat"} className="chat-panel" aria-label="메이플스토리 AI 채팅">
          {user && hasGuestRooms && !guestImportAvailable && <button className="text-button compact-button" type="button" onClick={() => setGuestImportAvailable(true)}>브라우저 대화 가져오기</button>}
          {guestImportAvailable && user && <div className="guest-import" role="status"><p>로그인 전에 나눈 대화가 있습니다. 기존 대화를 현재 계정에 저장하시겠습니까?</p><div><button type="button" onClick={() => void importGuestRooms()} disabled={importing}>{importing ? "저장 중…" : "계정에 저장하기"}</button><button type="button" disabled={importing} onClick={() => { localStorage.setItem(`maple-guest-import-${user.id}`, "dismissed"); setGuestImportAvailable(false); }}>브라우저에만 유지하기</button></div></div>}
          <div className="chat-toolbar">
            <div className="status-text" aria-live="polite">{status}</div>
            <div className="chat-tool-picker">
              <div className="chat-tool-row">
                <label className="eyebrow" htmlFor="feature-select">질문 도구</label>
                <div className="chat-tool-select-wrap">
                  <select id="feature-select" className="chat-tool-select" value={featureId} onChange={(event) => setFeatureId(event.target.value as FeatureId | "auto")} aria-describedby="feature-description">
                    <option value="auto">자동으로 선택</option>
                    {features.map((feature) => <option value={feature.id} key={feature.id}>{feature.number} / {feature.title}</option>)}
                  </select>
                  <span aria-hidden="true" className="chat-tool-chevron">⌄</span>
                </div>
              </div>
              <p id="feature-description" className="chat-tool-description">{currentFeature?.summary ?? (isToolEnabled("search_maple_guide") ? "질문에 맞춰 공지, 공략, 캐릭터 조회 도구를 선택합니다." : "질문에 맞춰 공지 검색과 캐릭터 조회 도구를 선택합니다.")}</p>
            </div>
          </div>
          <div className="chat-log" ref={logRef}>
            {messages.length === 0 && <div className="chat-empty"><span className="eyebrow">A BETTER WAY TO PLAY</span><h2>메이플의 다음 모험을<br />함께 준비해요.</h2><p>공지, 이벤트, 육성, 캐릭터에 관해 질문해 보세요.</p></div>}
            {messages.map((message, index) => (
              <article className={`message message--${message.role}`} key={message.id ?? `${index}-${message.role}`}>
                <div className="message-meta"><div className="message-role">{message.role === "user" ? "나" : "MAPLE / AI"}</div><time>{formatTime(message.created_at)}</time></div>
                {!message.snapshots?.length && message.character?.image && (
                  <div className="character-profile">
                    <img src={message.character.image} alt={`${message.character.name ?? "캐릭터"} 이미지`} />
                    <span>{[message.character.name, message.character.level && `Lv.${message.character.level}`, message.character.job, message.character.world].filter(Boolean).join(" · ")}</span>
                  </div>
                )}
                {message.snapshots && message.snapshots.length > 1 && <CharacterComparison snapshots={message.snapshots} />}
                {message.snapshots?.map(snapshot => <CharacterDashboard key={snapshot.id} snapshot={snapshot} executedTools={message.executed_tools} guest={!user} />)}
                {!!message.character_snapshot_ids?.length && !message.snapshots?.length && <p className="disclaimer">저장된 캐릭터 스냅샷이 만료되었거나 접근할 수 없습니다. 텍스트 답변은 보존됩니다.</p>}
                <div className="message-content">{message.snapshots?.length ? <p className="dash-report-label">AI 분석 리포트</p> : null}<Markdown text={cleanCharacterImageUrls(message.content) || (busy && index === messages.length - 1 ? "답변을 작성하고 있어요…" : "")} /></div>
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
          {!ready && <p className="disclaimer">로그인 상태와 저장소를 확인하고 있습니다.</p>}
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
