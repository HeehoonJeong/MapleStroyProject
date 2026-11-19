"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

const categories = ["오류 및 버그", "UI/UX 개선", "AI 답변 정확도", "신규 기능 제안", "서비스 속도 및 성능", "기타"];
export default function Feedback() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [category,setCategory] = useState("");
  const [title,setTitle] = useState("");
  const [content,setContent] = useState("");
  const [website,setWebsite] = useState("");
  const [busy,setBusy] = useState(false);
  const [success,setSuccess] = useState(false);
  const [error,setError] = useState("");
  const inflight = useRef(false);
  useEffect(() => { const element=dialog.current; if (!element) return; const onClose=()=>{setSuccess(false);setError("");trigger.current?.focus();}; element.addEventListener("close",onClose); return ()=>element.removeEventListener("close",onClose); }, []);
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(inflight.current || !content.trim()) return;
    const client=getSupabaseClient(), url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if(!client || !url || !key){setError("연결 설정을 확인해 주세요.");return;}
    inflight.current=true;setBusy(true);setError("");
    try {
      const {data:{session}}=await client.auth.getSession();
      const response=await fetch(`${url}/functions/v1/submit-feedback`,{method:"POST",headers:{"Content-Type":"application/json",apikey:key,...(session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{})},body:JSON.stringify({category:category || null,title:title.trim() || null,content:content.trim(),page_path:window.location.pathname,website})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(result.error || "의견을 보내지 못했습니다. 다시 시도해 주세요.");
      setSuccess(true);setContent("");setTitle("");setCategory("");setWebsite("");
    } catch(cause) {setError(cause instanceof Error?cause.message:"의견을 보내지 못했습니다. 다시 시도해 주세요.");}
    finally {inflight.current=false;setBusy(false);}
  }
  return <><button ref={trigger} type="button" className="text-button compact-button feedback-trigger" onClick={()=>dialog.current?.showModal()}>의견 보내기</button>
    <dialog ref={dialog} className="feedback-dialog" aria-labelledby="feedback-title" aria-describedby="feedback-intro" onClick={e=>{if(e.target===dialog.current && !busy)dialog.current?.close();}} onCancel={e=>{if(busy)e.preventDefault();}}>
      <div className="feedback-content"><div className="feedback-heading"><h2 id="feedback-title">여러분의 의견을 들려주세요.</h2><button type="button" className="feedback-close" aria-label="닫기" disabled={busy} onClick={()=>dialog.current?.close()}>×</button></div>
      {success ? <><p role="status">소중한 의견 감사합니다. 더 나은 메이플스토리 AI 서비스를 만드는 데 참고하겠습니다.</p><button className="outline-button" type="button" onClick={()=>dialog.current?.close()}>확인</button></> : <><p id="feedback-intro">서비스를 이용하면서 느낀 불편함이나 개선사항, 추가되었으면 하는 기능을 자유롭게 남겨주세요. 여러분의 의견은 더 나은 서비스를 만드는 데 활용됩니다.</p>
      <form onSubmit={submit}><label>피드백 유형 <span>(선택)</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">선택하지 않음</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>제목 <span>(선택)</span><input value={title} maxLength={100} onChange={e=>setTitle(e.target.value)} /></label>
      <label>상세 내용 <span>(필수)</span><textarea value={content} maxLength={3000} required rows={6} onChange={e=>setContent(e.target.value)} placeholder="의견을 자유롭게 남겨주세요." /></label>
      <div className="feedback-honeypot" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)} /></label></div>
      <div className="feedback-counter">{content.length.toLocaleString()} / 3,000자</div>{error && <p className="error-text" role="alert">{error}</p>}
      <div className="feedback-actions"><button className="text-button" type="button" disabled={busy} onClick={()=>dialog.current?.close()}>취소</button><button className="outline-button" type="submit" disabled={busy || !content.trim()}>{busy?"보내는 중…":"보내기"}</button></div></form></>}
      </div></dialog></>;
}
