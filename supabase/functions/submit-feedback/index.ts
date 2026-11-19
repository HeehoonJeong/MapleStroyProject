import { withSupabase } from "@supabase/server";

const categories = new Set(["오류 및 버그", "UI/UX 개선", "AI 답변 정확도", "신규 기능 제안", "서비스 속도 및 성능", "기타"]);
async function digest(value: string) { const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,"0")).join(""); }
async function readLimited(request: Request, limit: number): Promise<string> {
  const reader=request.body?.getReader(); if(!reader) throw new Error("Missing body");
  const chunks:Uint8Array[]=[]; let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error("Too large");}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
export async function handleFeedback(request: Request, context: any) {
  if(request.method!=="POST") return Response.json({error:"POST 요청만 가능합니다."},{status:405});
  const declared=Number(request.headers.get("content-length") ?? 0);
  if(declared>16000) return Response.json({error:"입력 내용이 너무 깁니다."},{status:413});
  let body: Record<string,unknown>;
  try {const raw=await readLimited(request,16000);const parsed=JSON.parse(raw);if(!parsed || typeof parsed!=="object" || Array.isArray(parsed)) throw new Error();body=parsed;} catch {return Response.json({error:"입력 내용을 확인해 주세요."},{status:400});}
  if(Object.keys(body).some(k=>!["category","title","content","page_path","website"].includes(k))) return Response.json({error:"입력 내용을 확인해 주세요."},{status:400});
  if(typeof body.website!=="string" || body.website.length>0) return Response.json({error:"요청을 처리할 수 없습니다."},{status:400});
  if(typeof body.content!=="string" || !body.content.trim() || body.content.length>3000 || (body.title!=null && (typeof body.title!=="string" || body.title.length>100)) || (body.category!=null && (typeof body.category!=="string" || !categories.has(body.category))) || (body.page_path!=="/" && body.page_path!=="/assistant")) return Response.json({error:"입력 내용을 확인해 주세요."},{status:400});
  const ip=request.headers.get("cf-connecting-ip"), salt=Deno.env.get("GUEST_RATE_SALT");
  if(!ip || !salt) return Response.json({error:"요청 보호 설정을 확인하지 못했습니다."},{status:503});
  let uid:string|null=null;
  const authorization=request.headers.get("authorization");
  if(authorization) {const token=authorization.match(/^Bearer\s+(.+)$/i)?.[1];if(!token) return Response.json({error:"로그인 상태를 확인해 주세요."},{status:401});const {data,error}=await context.supabaseAdmin.auth.getUser(token);if(error || !data.user) return Response.json({error:"로그인 상태를 확인해 주세요."},{status:401});uid=data.user.id;}
  const normalized=body.content.trim().replace(/\s+/g," ").toLowerCase();
  const {data,error}=await context.supabaseAdmin.rpc("submit_maple_feedback",{p_user_id:uid,p_category:body.category || null,p_title:typeof body.title==="string" ? body.title.trim() || null : null,p_content:body.content.trim(),p_page_path:body.page_path,p_ip_digest:await digest(`${salt}:feedback:ip:${ip}`),p_content_digest:await digest(`${salt}:feedback:content:${normalized}`)});
  if(error){console.error("feedback save failed",error.code);return Response.json({error:"의견을 저장하지 못했습니다. 다시 시도해 주세요."},{status:503});}
  if(data==="limited") return Response.json({error:"요청이 많습니다. 잠시 후 다시 시도해 주세요."},{status:429});
  if(data==="duplicate") return Response.json({error:"같은 의견을 이미 보내주셨습니다. 잠시 후 다시 시도해 주세요."},{status:429});
  if(data!=="saved") return Response.json({error:"의견을 저장하지 못했습니다."},{status:503});
  return Response.json({ok:true},{status:201});
}
export default { fetch: withSupabase({ auth:"none" }, (request, context) => handleFeedback(request, context)) };
