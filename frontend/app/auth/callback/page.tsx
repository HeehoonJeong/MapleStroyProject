"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function finishSignIn() {
      const client = getSupabaseClient();
      if (!client) {
        setError("Supabase 설정을 확인해 주세요.");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/assistant";
      const code = params.get("code");
      let authError: Error | null = null;
      if (code) {
        const result = await client.auth.exchangeCodeForSession(code);
        authError = result.error;
      } else {
        authError = new Error(params.get("error_description") ?? "인증 코드가 전달되지 않았습니다.");
      }
      if (!active) return;
      if (authError) setError(authError.message);
      else router.replace(destination);
    }
    void finishSignIn();
    return () => { active = false; };
  }, [router]);

  return <main className="site-shell callback-shell"><p className="eyebrow">GOOGLE SIGN-IN</p><h1>{error ? "로그인에 실패했어요" : "계정을 확인하고 있어요"}</h1>{error && <><p className="error-text">{error}</p><Link className="outline-button" href="/">처음으로 돌아가기</Link></>}</main>;
}
