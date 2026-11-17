# MapleStory Chatbot

Next.js 프론트엔드, Supabase Google Auth/Edge Functions/Postgres, OpenAI 대화 생성, Upstage 임베딩, 넥슨 Open API로 구성한 메이플스토리 챗봇입니다. 기존 Streamlit/Python 코드는 이전 프로토타입으로 보존되어 있습니다.

## 구조

```text
frontend/                              # 랜딩, Google OAuth callback, 채팅 UI
  components/home-client.tsx           # Google 로그인 및 서비스 소개
  components/assistant.tsx              # 사용자별 채팅방/메시지 저장
dataset/announcements/                 # 공식 공지 스냅샷 Markdown
scripts/ingest-dataset.py                # Upstage 임베딩 및 Supabase 적재
supabase/functions/maple-agent/         # 인증된 RAG/도구 에이전트
supabase/migrations/                    # pgvector, 채팅 RLS, 요청 제한
```

브라우저에는 Supabase URL과 Publishable key만 둡니다. OpenAI, Upstage, Nexon, Google OAuth Client Secret 및 Supabase service_role key는 서버 또는 로컬 환경변수에만 저장하세요.

## 로컬 프론트엔드 실행

```bash
cd frontend
cp env.example .env.local
# .env.local에 Supabase URL과 Publishable key 입력
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

### Google OAuth 설정

Supabase 대시보드의 **Authentication → Providers → Google**에서 Google OAuth Client ID/Secret을 설정합니다. Google Cloud OAuth 설정의 승인된 redirect URI는 `https://<project-ref>.supabase.co/auth/v1/callback`입니다. Supabase의 **Authentication → URL Configuration → Redirect URLs**에는 `http://localhost:3000/auth/callback`과 배포 도메인의 `/auth/callback`을 추가하세요. 배포 전에 Google provider와 redirect URL을 실제 도메인에 맞게 설정해야 합니다.

로컬 Supabase를 사용할 경우 `supabase/config.toml`의 Google provider 설정과 `supabase/env.example`의 로컬 Google OAuth 환경변수를 구성하세요.

## Supabase 로컬 실행

Supabase CLI와 Docker가 필요합니다.

```bash
cp supabase/env.example supabase/.env
# supabase/.env에 OpenAI, Upstage, Nexon 및 로컬 Google OAuth 값 입력
supabase start
supabase db reset
supabase functions serve maple-agent --env-file supabase/.env
```

`.env` 파일은 Git에 커밋하지 마세요. 채팅방과 메시지는 소유자별 RLS 정책으로 보호됩니다.

## RAG 문서 관리 및 적재

`dataset/announcements/`의 문서를 관리합니다. 공지 요약에는 넥슨 공식 원문 URL과 게시일을 남기세요. 현재 포함된 자료는 공식 원문을 확인해 작성한 시점의 스냅샷이며 자동으로 최신화되지 않습니다. 새 공지나 정정 내용을 반영한 후 저장소 루트에서 다음을 실행합니다.

```bash
cp dataset/.env.example dataset/.env
# dataset/.env에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UPSTAGE_API_KEY 입력
set -a && source dataset/.env && set +a
python3 scripts/ingest-dataset.py
```

스크립트는 Markdown을 chunk로 나눠 `solar-embedding-2-passage`로 임베딩하고, 원문·출처 메타데이터와 함께 Supabase `maple_guide_chunks_upstage` pgvector 테이블에 저장합니다. 질문은 Edge Function에서 `solar-embedding-2-query`로 임베딩해 검색합니다. 기존 OpenAI 임베딩 테이블은 변경하지 않으며, 같은 파일을 다시 적재하면 Upstage 테이블의 해당 파일 chunk를 교체합니다. service_role 키는 적재용 로컬 환경에서만 사용하고 프론트엔드에 넣지 마세요.

## 배포

### Supabase

1. Supabase 프로젝트에서 Google Auth provider 및 redirect URL을 설정합니다.
2. `supabase link --project-ref <PROJECT_REF>` 후 `supabase db push`를 실행합니다.
3. 서버 키를 Edge Function Secrets에 설정하고 함수를 배포합니다.

```bash
cp supabase/functions.env.example supabase/functions.env
# 새로 발급한 API 키를 supabase/functions.env에 입력 (값은 채팅에 공유하지 마세요)
supabase secrets set --env-file supabase/functions.env --remote=oqfnjdrvdzzbfichxxcw
supabase functions deploy maple-agent --use-api --remote=oqfnjdrvdzzbfichxxcw
```

데이터베이스 마이그레이션은 `supabase db push`로 적용합니다. 처음 적재할 때만 `dataset/.env`에 service_role key를 두고 로컬에서 ingest 스크립트를 실행하세요.

### Vercel

1. Git 저장소를 연결하고 Root Directory를 `frontend`로 설정합니다.
2. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 환경변수로 설정합니다.
3. Supabase Redirect URLs에 Vercel 도메인의 `https://<domain>/auth/callback`을 추가한 뒤 배포합니다.

## 기능 및 운영

- Google 로그인, 프로필 표시, 로그아웃
- 사용자별 채팅방, 질문·답변·출처·생성 시간 저장
- Upstage 임베딩과 Supabase pgvector를 이용한 공지·공략 검색 및 출처 표시
- 넥슨 캐릭터 API를 활용하는 기존 조회/분석 도구
- Edge Function은 사용자 JWT를 검증하고 사용자별 요청 제한을 적용합니다.
- 공지 내용은 갱신될 수 있으므로 답변에서 원문 링크를 확인하세요. 스펙업·보스 분석은 공식 계산기가 아닙니다.
- `requirements.txt`, `app.py`, `pages/`의 Streamlit 앱은 이전 프로토타입입니다.
