# MapleStory AI

목표 배포 구조는 **Next.js 프론트엔드(Vercel) + Supabase Auth/Edge Functions/Postgres + LangChain.js + Nexon Open API**입니다. 기존 Streamlit/Python 코드는 마이그레이션 참고용으로 보존되어 있습니다.

## 구조

```text
frontend/                              # Next.js App Router — Vercel 배포 대상
  app/                                 # 홈 및 채팅 UI
  components/assistant.tsx             # Supabase 인증, SSE 스트리밍 채팅
  lib/features.ts                      # 10개 기능 정의
supabase/
  functions/maple-agent/               # GPT-5.4-nano LangChain Agent
  functions/_shared/                   # Nexon 도구와 안전 미들웨어
  migrations/                          # pgvector RAG 및 호출 제한 스키마
```

프론트엔드에는 Supabase URL과 **Publishable key**만 둡니다. `OPENAI_API_KEY`, `NEXON_API_KEY`는 Supabase Edge Function Secrets에만 둡니다.

## 로컬 프론트엔드 실행

```bash
cd frontend
# frontend/.env.local을 직접 만들고 아래 값 설정
npm install
npm run dev
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

브라우저에서 `http://localhost:3000`을 엽니다. Supabase Auth에서 **Anonymous Sign-Ins**를 활성화해야 합니다. 공개 서비스 전에는 CAPTCHA와 추가 abuse 방지 정책도 설정하세요.

## Supabase 로컬 실행

Supabase CLI와 Docker가 필요합니다.

```bash
# supabase/.env를 직접 만들고 OPENAI_API_KEY, NEXON_API_KEY 설정
supabase start
supabase db reset
supabase functions serve maple-agent --env-file supabase/.env
```

`supabase/.env`에는 `OPENAI_API_KEY`와 `NEXON_API_KEY`를 설정합니다. 이 파일은 Git에 추가하지 마세요.

프론트엔드 로컬 환경에는 로컬 Supabase 주소/Publishable key를 사용합니다. Edge Function은 사용자 JWT를 요구하며, OpenAI/Nexon 키는 브라우저로 전송하지 않습니다.

## 배포

### Supabase

1. Supabase 프로젝트를 만들고 Anonymous Sign-Ins를 활성화합니다.
2. `supabase link --project-ref <PROJECT_REF>` 후 `supabase db push`를 실행합니다.
3. Edge Function Secrets를 등록하고 배포합니다.

```bash
supabase secrets set OPENAI_API_KEY=... NEXON_API_KEY=...
supabase functions deploy maple-agent
```

DB 마이그레이션은 `supabase db push`로 적용합니다.

### Vercel

1. Git 저장소를 Vercel에 연결하고 **Root Directory를 `frontend`**로 선택합니다.
2. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 Vercel 환경 변수에 설정합니다.
3. Deploy 합니다.

Publishable key는 클라이언트용 공개 키입니다. Supabase Secret/service role key는 절대로 `NEXT_PUBLIC_*` 변수나 프론트엔드에 넣지 마세요.

## 기능

OCID·기본 정보·능력치·장비·HEXA 조회, 종합 스펙 분석, 메소 예산 기반 스펙업 후보, 참고용 보스 분석, 경매장 스크린샷 판독, Supabase pgvector 기반 공략 검색을 제공합니다. 모든 채팅은 GPT-5.4-nano LangChain Agent가 도구를 실행하고 SSE로 답변을 스트리밍합니다.

공략 검색은 `text-embedding-3-small`로 질의를 임베딩하고 Supabase pgvector에서 관련 문서를 찾습니다. 마이그레이션은 테이블과 검색 RPC를 만들지만, 실제 공략 데이터의 적재 파이프라인은 별도로 준비해야 합니다.

## 보안 및 운영 메모

- Edge Function은 Supabase 사용자 JWT를 확인하고 분당 사용자별 8회 요청 제한을 둡니다.
- 서버 키는 Supabase Secrets에만 저장합니다.
- 메이플스토리 범위 외 질문, 알려진 프롬프트 인젝션 패턴, 도구 응답 내 지시문 패턴을 LangChain middleware에서 차단합니다. 규칙 기반 방어는 모든 공격을 보장해 차단하지 않습니다.
- 스펙업·보스 분석은 공식 계산기가 아니며, 실시간 경매장 가격을 보장하지 않습니다.
- NEXON Open API 데이터 사용 문구를 UI에 표시합니다.
- `requirements.txt`, `app.py`, `pages/`의 Streamlit 앱은 이전 프로토타입입니다. 새 배포는 `frontend/`와 `supabase/`를 사용합니다.
