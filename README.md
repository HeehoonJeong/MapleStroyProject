# MapleStory Chatbot

Next.js 프론트엔드, Supabase Google Auth/Edge Functions/Postgres, OpenAI 대화 생성, Upstage 임베딩, 넥슨 Open API로 구성한 메이플스토리 챗봇입니다. 기존 Streamlit/Python 코드는 이전 프로토타입으로 보존되어 있습니다.

## 구조

```text
frontend/                              # 랜딩, Google OAuth callback, 채팅 UI
  components/home-client.tsx           # Google 로그인 및 서비스 소개
  components/assistant.tsx              # 사용자별 채팅방/메시지 저장
supabase/functions/maple-agent/         # 인증된 RAG/도구 에이전트
supabase/functions/sync-maple-notices/  # 넥슨 공지 수집·청킹·벡터 적재
supabase/migrations/                    # pgvector, 공지 아카이브, 채팅 RLS, 요청 제한
.github/workflows/                      # 매일 공지 동기화 트리거
```

브라우저에는 Supabase URL과 Publishable key만 둡니다. OpenAI, Upstage, Nexon, Google OAuth Client Secret 및 Supabase service_role key는 서버 또는 로컬 환경변수에만 저장하세요.

## 로컬 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

로컬에서 `frontend/.env.local` 파일을 직접 만들고 아래 두 변수를 설정합니다. 예제 env 파일은 GitHub에 포함하지 않습니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

브라우저에서 `http://localhost:3000`을 엽니다.

### Google OAuth 설정

Supabase 대시보드의 **Authentication → Providers → Google**에서 Google OAuth Client ID/Secret을 설정합니다. Google Cloud OAuth 설정의 승인된 redirect URI는 `https://<project-ref>.supabase.co/auth/v1/callback`입니다. Supabase의 **Authentication → URL Configuration → Redirect URLs**에는 `http://localhost:3000/auth/callback`과 배포 도메인의 `/auth/callback`을 추가하세요. 배포 전에 Google provider와 redirect URL을 실제 도메인에 맞게 설정해야 합니다.

로컬 Supabase를 사용할 경우 `supabase/config.toml`의 Google provider 설정과 로컬 `supabase/.env`의 Google OAuth 환경변수를 구성하세요.

## Supabase 로컬 실행

Supabase CLI와 Docker가 필요합니다.

```bash
# supabase/.env를 직접 만들고 필요한 서버 키와 Google OAuth 값을 입력
supabase start
supabase db reset
supabase functions serve maple-agent --env-file supabase/.env
```

`.env` 파일은 Git에 커밋하지 마세요. 채팅방과 메시지는 소유자별 RLS 정책으로 보호됩니다.

## RAG 문서 관리 및 적재

`dataset/announcements/`의 문서를 관리합니다. 공지 요약에는 넥슨 공식 원문 URL과 게시일을 남기세요. 현재 포함된 자료는 공식 원문을 확인해 작성한 시점의 스냅샷이며 자동으로 최신화되지 않습니다. 새 공지나 정정 내용을 반영한 후 저장소 루트에서 다음을 실행합니다.

```bash
# dataset/.env를 직접 생성하고 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UPSTAGE_API_KEY 설정
set -a && source dataset/.env && set +a
python3 scripts/ingest-dataset.py
```

적재용 로컬 `dataset/.env` 변수 이름은 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTAGE_API_KEY`입니다. service_role 키는 절대 프론트엔드나 GitHub Actions에 넣지 마세요.

스크립트는 Markdown을 chunk로 나눠 `solar-embedding-2-passage`로 임베딩하고, 원문·출처 메타데이터와 함께 Supabase `maple_guide_chunks_upstage` pgvector 테이블에 저장합니다. 질문은 Edge Function에서 `solar-embedding-2-query`로 임베딩해 검색합니다. 기존 OpenAI 임베딩 테이블은 변경하지 않으며, 같은 파일을 다시 적재하면 Upstage 테이블의 해당 파일 chunk를 교체합니다. service_role 키는 적재용 로컬 환경에서만 사용하고 프론트엔드에 넣지 마세요.

## 배포

### Supabase

1. Supabase 프로젝트에서 Google Auth provider 및 redirect URL을 설정합니다.
2. `supabase link --project-ref <PROJECT_REF>` 후 `supabase db push`를 실행합니다.
3. 서버 키를 Edge Function Secrets에 설정하고 함수를 배포합니다.

```bash
# supabase/functions.env를 직접 생성하고 다음 서버 키 설정:
# OPENAI_API_KEY, UPSTAGE_API_KEY, NEXON_API_KEY, NOTICE_SYNC_SECRET
supabase secrets set --env-file supabase/functions.env --remote=oqfnjdrvdzzbfichxxcw
supabase functions deploy maple-agent --use-api --remote=oqfnjdrvdzzbfichxxcw
supabase functions deploy sync-maple-notices --use-api --remote=oqfnjdrvdzzbfichxxcw
```

`supabase/functions.env`의 형식은 아래와 같습니다. 실제 값은 로컬에서 직접 입력합니다.

```env
OPENAI_API_KEY=...
UPSTAGE_API_KEY=...
NEXON_API_KEY=...
NOTICE_SYNC_SECRET=...
```

넥슨 Open API 애플리케이션에 **공지 정보 조회 API 권한**이 포함되어 있는지 확인하세요.

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

## 넥슨 공식 공지 자동 수집

공지 API는 네 가지 목록과 상세 API를 제공합니다: 일반 공지(`notice`), 업데이트(`notice-update`), 이벤트(`notice-event`), 캐시샵(`notice-cashshop`). `sync-maple-notices`는 각 목록의 `notice_id`를 사용해 상세 본문을 가져오고, HTML을 텍스트로 정리한 뒤 chunk로 나눕니다. 공지 유형+ID로 중복을 막고 본문 SHA-256이 바뀐 항목만 `solar-embedding-2-passage`로 다시 임베딩합니다. 공지 본문과 벡터는 `maple_notices`, `maple_notice_chunks`에 저장됩니다.

공지 RAG는 최근 사용자 질문 맥락을 이어받고, “최근 30일”, “이번 달”, “2026년 10월”처럼 표현된 기간을 한국 시간 기준 실제 날짜 조건으로 바꿔 검색합니다. 검색 결과는 공지 단위로 중복을 합쳐 원문 링크와 함께 보여줍니다.

함수를 배포하고 나면 최초 동기화는 서버에서 직접 호출할 수 있습니다. `NOTICE_SYNC_SECRET`은 Supabase Function Secret에 설정한 값과 동일하게 사용하세요.
NEXON Open API 애플리케이션에 **공지 정보 조회 API 권한**이 켜져 있는지도 확인하세요.

```bash
curl --fail-with-body -X POST "$SUPABASE_URL/functions/v1/sync-maple-notices" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -H "x-sync-secret: $NOTICE_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

`.github/workflows/sync-maple-notices.yml`은 매일 10:17 KST에 동기화하며 `workflow_dispatch`로 수동 실행도 가능합니다. GitHub 저장소의 **Settings → Secrets and variables → Actions**에 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `NOTICE_SYNC_SECRET`을 추가하세요. NEXON 및 Upstage 비밀 키는 Supabase에만 저장하고 GitHub Actions에는 넣지 않습니다.

환경 변수 파일과 `*.env.example` 형태의 예제 파일은 의도적으로 Git에서 제외됩니다. 필요한 키 이름은 위 설명과 `supabase/functions.env`의 로컬 사본에서 확인하세요. 커밋 전에 `git status --ignored`로 파일이 ignore되는지 확인하고, 실제 API 키가 과거에 커밋된 적이 있다면 해당 키를 재발급하세요.

정기 동기화는 API가 목록에서 제공하는 공지들을 보관합니다. API 목록에 더 이상 포함되지 않는 오래된 공지까지 소급해 가져오는 기능은 제공되지 않습니다. 넥슨의 데이터 갱신 정책에 맞게 주기적으로 실행하는 것을 권장합니다.
