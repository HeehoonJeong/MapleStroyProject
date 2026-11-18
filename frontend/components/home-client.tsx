"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function HomeClient() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const client = getSupabaseClient();
    setConfigured(Boolean(client));
    if (!client) {
      setLoading(false);
      return;
    }
    void client.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    setError("");
    const client = getSupabaseClient();
    if (!client) {
      setError("Supabase URL과 Publishable Key 설정이 필요합니다.");
      return;
    }
    const { error: authError } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/assistant` },
    });
    if (authError) setError(authError.message);
  }

  async function signOut() {
    const client = getSupabaseClient();
    if (!client) return;
    const { error: authError } = await client.auth.signOut();
    if (authError) setError(authError.message);
    else setUser(null);
  }

  const displayName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? "용사님";
  const avatar = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture;

  return (
    <main className="site-shell landing-shell">
      <nav className="topbar">
        <Link className="wordmark" href="/">MAPLE / AI</Link>
        {user ? (
          <div className="profile-actions">
            {avatar && <img className="avatar" src={avatar} alt="프로필" referrerPolicy="no-referrer" />}
            <span className="profile-name">{displayName}</span>
            <button className="text-button compact-button" type="button" onClick={signOut}>로그아웃</button>
          </div>
        ) : <span className="eyebrow">MAPLESTORY KNOWLEDGE ASSISTANT</span>}
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">YOUR MAPLESTORY COMPANION</p>
          <h1>MapleStory<br />Chatbot</h1>
          <p className="landing-description">
            메이플스토리 공식 공지와 게임 문서를 바탕으로 답하고, 캐릭터 데이터 조회까지 도와주는 AI 챗봇입니다.
            대화는 내 계정에 저장되어 언제든 이어서 볼 수 있어요.
          </p>
          {user ? (
            <Link className="outline-button primary-button" href="/assistant">챗봇으로 이동 <span aria-hidden="true">→</span></Link>
          ) : (
            <button className="outline-button primary-button" type="button" onClick={signInWithGoogle} disabled={loading}>
              <GoogleMark /> {loading ? "확인 중…" : "Google로 시작하기"}
            </button>
          )}
          {error && <p className="error-text" role="alert">{error}</p>}
          {!configured && <p className="disclaimer">시작하려면 `frontend/.env.local`에 Supabase 설정을 추가하세요.</p>}
          <div className="landing-proof"><span>RAG 문서 검색</span><span>계정별 대화 저장</span><span>넥슨 API 연동</span></div>
        </div>
        <video className="landing-art" autoPlay muted loop playsInline preload="auto" poster="/assets/maple-battle.png" aria-label="메이플스토리 게임 플레이 영상"><source src="/assets/maple-intro.mp4" type="video/mp4" /></video>
      </section>

      <section className="landing-details" aria-label="서비스 소개">
        <article><span className="eyebrow">01 / ASK</span><h2>궁금한 점을 질문하세요</h2><p>육성, 이벤트, 공지, 캐릭터 정보까지 한국어로 편하게 물어보세요.</p></article>
        <article><span className="eyebrow">02 / SEARCH</span><h2>문서 근거를 확인하세요</h2><p>관련 문서를 의미 검색해 답변하고, 사용한 공지와 출처 링크를 함께 표시합니다.</p></article>
        <article><span className="eyebrow">03 / CONTINUE</span><h2>대화를 이어가세요</h2><p>Google 계정으로 로그인하면 채팅방과 질문·답변이 계정에 안전하게 저장됩니다.</p></article>
      </section>
      <footer className="footer">Unofficial fan-made assistant · Always check the linked official notices for the latest information.</footer>
    </main>
  );
}

function GoogleMark() {
  return <svg className="google-mark" aria-hidden="true" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 38.03 46.98 31.91 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.45-4.88 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.2C6.51 42.62 14.62 48 24 48Z"/></svg>;
}
