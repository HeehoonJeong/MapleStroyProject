"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import LandingVideo from "@/components/landing-video";
import Feedback from "@/components/feedback";

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
        <div className="profile-actions"><Feedback />
        {user ? (
          <>
            {avatar && <img className="avatar" src={avatar} alt="프로필" referrerPolicy="no-referrer" />}
            <span className="profile-name">{displayName}</span>
            <button className="text-button compact-button" type="button" onClick={signOut}>로그아웃</button>
          </>
        ) : <button className="text-button compact-button" type="button" onClick={signInWithGoogle} disabled={loading}>Google 로그인</button>}
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">YOUR MAPLESTORY COMPANION</p>
          <h1>MapleStory<br />Chatbot</h1>
          <p className="landing-description">
            메이플스토리 공식 공지와 게임 문서를 바탕으로 답하고, 캐릭터 분석과 성장 방향까지 도와주는 AI 챗봇입니다.
            로그인 없이 자유롭게 이용하고, 구글 계정으로 로그인하여 어디서든 대화를 이어가세요.
          </p>
          <div className="landing-actions">
            {user ? <Link className="outline-button primary-button" href="/assistant">챗봇으로 이동 <span aria-hidden="true">→</span></Link> : <><button className="outline-button primary-button" type="button" onClick={signInWithGoogle} disabled={loading}>Google로 시작하기</button><Link className="outline-button guest-start-button" href="/assistant">비로그인으로 이용하기 <span aria-hidden="true">→</span></Link></>}
          </div>
          {error && <p className="error-text" role="alert">{error}</p>}
          {!configured && <p className="disclaimer">시작하려면 `frontend/.env.local`에 Supabase 설정을 추가하세요.</p>}
          <div className="landing-proof"><span>RAG 문서 검색</span><span>로그인 없이 이용</span><span>계정별 대화 저장</span><span>넥슨 API 연동</span></div>
        </div>
        <LandingVideo />
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
