"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { features, type FeatureId } from "@/lib/features";
import { getSupabaseClient } from "@/lib/supabase/client";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  character?: CharacterProfile;
};

type CharacterProfile = {
  image?: string;
  name?: string;
  level?: number | string;
  job?: string;
  world?: string;
};

type StreamEvent = { type?: string; text?: string; message?: string; profile?: CharacterProfile };

export default function Assistant() {
  const [featureId, setFeatureId] = useState<FeatureId | "auto">("auto");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("SUPABASE AUTH INITIALIZING");
  const [error, setError] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const previewUrl = useMemo(() => image ? URL.createObjectURL(image) : "", [image]);
  const currentFeature = features.find((item) => item.id === featureId);

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
    async function initializeAuth() {
      const client = getSupabaseClient();
      if (!client) {
        setStatus("SET FRONTEND SUPABASE ENVIRONMENT VARIABLES");
        return;
      }
      const { data: { session } } = await client.auth.getSession();
      let token = session?.access_token;
      if (!token) {
        const { data, error: authError } = await client.auth.signInAnonymously();
        if (authError) {
          setStatus("AUTHENTICATION FAILED");
          setError("Supabase 대시보드에서 Anonymous Sign-Ins를 활성화하고 설정을 확인해 주세요.");
          return;
        }
        token = data.session?.access_token;
      }
      if (active && token) {
        setAccessToken(token);
        setReady(true);
        setStatus("READY · GPT-5.4-NANO STREAMING");
      }
    }
    void initializeAuth();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function useExample(example: string) {
    setPrompt(example);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || busy || !ready || !accessToken) return;
    setError("");
    setPrompt("");
    setBusy(true);
    setStatus("GPT-5.4-NANO IS WORKING");
    const userMessage: ChatMessage = { role: "user", content: text };
    const assistantMessage: ChatMessage = { role: "assistant", content: "" };
    setMessages((previous) => [...previous, userMessage, assistantMessage]);

    try {
      const client = getSupabaseClient();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!client || !supabaseUrl || !publishableKey) throw new Error("Supabase 설정을 확인해 주세요.");
      const { data: { session } } = await client.auth.getSession();
      const currentToken = session?.access_token ?? accessToken;
      if (!currentToken) throw new Error("Supabase 인증 세션이 없습니다. 페이지를 새로고침해 주세요.");
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
          history: messages.slice(-12).map(({ role, content }) => ({ role, content })),
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
      setStatus("READY · GPT-5.4-NANO STREAMING");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.";
      setError(message);
      setMessages((previous) => previous.map((item, index) =>
        index === previous.length - 1 && item.role === "assistant"
          ? { ...item, content: item.content || "요청을 처리하지 못했습니다." }
          : item,
      ));
      setStatus("REQUEST FAILED");
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
        setMessages((previous) => previous.map((item, index) =>
          index === previous.length - 1 && item.role === "assistant"
            ? { ...item, content: item.content + event.text }
            : item,
        ));
      } else if (eventType === "character" && event.profile) {
        setMessages((previous) => previous.map((item, index) =>
          index === previous.length - 1 && item.role === "assistant"
            ? { ...item, character: event.profile }
            : item,
        ));
      } else if (eventType === "status" && event.message) {
        setStatus(event.message.toUpperCase());
      } else if (eventType === "error") {
        throw new Error(event.message ?? "요청을 처리하지 못했습니다.");
      }
    }
  }

  return (
    <main className="site-shell">
      <div className="wordmark">MAPLE / AI</div>
      <header className="assistant-header">
        <div>
          <p className="eyebrow">CHARACTER DATA · AI ASSISTANT</p>
          <h1>도구 챗봇</h1>
          <p>GPT-5.4-nano 에이전트가 도구를 실행하고 최종 답변을 스트리밍합니다.</p>
        </div>
        <img className="assistant-art" src="/assets/maple_tools_banner.png" alt="단풍나무 아래의 판타지 포털" />
      </header>

      <div className="assistant-layout">
        <aside className="tool-panel">
          <label className="eyebrow" htmlFor="feature-select">SELECT A TOOL</label>
          <select id="feature-select" className="tool-select" value={featureId} onChange={(e) => setFeatureId(e.target.value as FeatureId | "auto")}>
            <option value="auto">자동 선택</option>
            {features.map((feature) => <option value={feature.id} key={feature.id}>{feature.number} / {feature.title}</option>)}
          </select>
          <div className="tool-summary">
            <div className="eyebrow">{currentFeature ? `${currentFeature.number} / ${currentFeature.title}` : "AUTOMATIC ROUTING"}</div>
            <p>{currentFeature?.description ?? "질문에 맞는 도구를 에이전트가 선택합니다."}</p>
            <p className="feature-note">{currentFeature?.note ?? "보다 정확한 결과를 원하면 기능을 직접 선택하세요."}</p>
          </div>
          <div className="eyebrow">EXAMPLE PROMPT</div>
          <div className="quick-prompts">
            {(currentFeature ? [currentFeature.example] : [features[1].example, features[5].example]).map((example) => (
              <button className="text-button" type="button" key={example} onClick={() => useExample(example)}>{example}</button>
            ))}
          </div>
          <div className="upload-row">
            <label htmlFor="auction-image">SCREENSHOT · MAX 8MB</label>
            <input id="auction-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
          </div>
          {image && previewUrl && <img className="assistant-art" src={previewUrl} alt="첨부한 경매장 스크린샷" />}
          <button className="text-button" type="button" onClick={() => setMessages([])} style={{ marginTop: 20 }}>대화 초기화</button>
        </aside>

        <section className="chat-panel" aria-label="메이플스토리 AI 채팅">
          <div className="status-text" aria-live="polite">{status}</div>
          <div className="chat-log" ref={logRef}>
            {messages.length === 0 && <p className="disclaimer">캐릭터명과 궁금한 내용을 입력해 대화를 시작하세요.</p>}
            {messages.map((message, index) => (
              <article className="message" key={`${index}-${message.role}`}>
                <div className="message-role">{message.role === "user" ? "YOU" : "MAPLE / AI"}</div>
                {message.character?.image && (
                  <div className="character-profile">
                    <img src={message.character.image} alt={`${message.character.name ?? "캐릭터"} 이미지`} />
                    <span>{[message.character.name, message.character.level && `Lv.${message.character.level}`, message.character.job, message.character.world].filter(Boolean).join(" · ")}</span>
                  </div>
                )}
                <div className="message-content">{message.content || (busy && index === messages.length - 1 ? "" : "")}</div>
              </article>
            ))}
          </div>
          {!ready && <p className="disclaimer">Supabase URL/Publishable Key와 Anonymous Sign-Ins 설정이 필요합니다.</p>}
          {error && <p className="error-text" role="alert">{error}</p>}
          <form className="chat-form" onSubmit={onSubmit}>
            <input className="chat-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="캐릭터명과 질문을 입력하세요" disabled={!ready || busy} />
            <button className="outline-button" type="submit" disabled={!ready || busy || !prompt.trim()}>{busy ? "처리 중" : "전송 →"}</button>
          </form>
        </section>
      </div>
      <footer className="footer">Data based on NEXON Open API</footer>
    </main>
  );
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
