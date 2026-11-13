# 메이플스토리 AI 도우미

LangChain 에이전트와 Streamlit 기반의 메이플스토리 AI Agent입니다. 홈에서 기능을 확인하고, 사이드바의 **도구 챗봇** 페이지에서 기능을 선택해 대화합니다.

## 구현 기능

1. 캐릭터 닉네임으로 OCID 조회
2. 레벨·직업·월드 등 기본 정보 조회
3. 주스탯·전투력·보스 데미지·방어율 무시 등 능력치 조회
4. 장착 장비·스타포스·잠재능력 조회
5. HEXA 코어 및 HEXA 스탯 조회
6. 캐릭터 기본 정보·능력치·장비·HEXA 종합 조회
7. 예산과 장비 상태를 바탕으로 스펙업 점검 후보 추천
8. 보스명·파티 인원·캐릭터 능력치에 따른 참고용 추정
9. 경매장 스크린샷에서 읽을 수 있는 아이템 옵션과 표시 가격 분석
10. 로컬 Markdown 공략 문서 검색(RAG)

대화는 **GPT-5.4-nano 1차 처리 → GPT-5.5 최종 답변** 순서입니다. 두 모델에 대한 OpenAI API 접근 권한이 필요합니다. 환경 변수 `FAST_MODEL`, `FINAL_MODEL`로 모델 ID를 바꿀 수 있습니다.
최종 답변은 GPT-5.5의 토큰 스트림으로 화면에 표시됩니다.

## 안전장치

LangChain 미들웨어는 모델 호출 전에 메이플스토리 범위 밖 질문과 알려진 프롬프트 인젝션 패턴을 거절합니다. 도구 응답도 신뢰할 수 없는 입력으로 보고 지시문 패턴을 검사합니다. 이는 규칙 기반의 방어 계층이며 모든 우회 시도를 완벽히 막는 보안 보증은 아닙니다.

## 키 설정

키 입력 UI는 제공하지 않습니다. 로컬 개발은 프로젝트 루트의 `.env`에서 읽습니다.

```env
NEXON_API_KEY=넥슨_Open_API_키
OPENAI_API_KEY=OpenAI_API_키
# 선택 설정
FAST_MODEL=gpt-5.4-nano
FINAL_MODEL=gpt-5.5
```

넥슨 키는 [NEXON Open API](https://openapi.nexon.com/ko/)에서 애플리케이션을 등록해 발급받습니다. `.env`를 GitHub에 커밋하지 마세요. 배포 시에는 호스팅 서비스의 Secret 환경 변수 또는 Streamlit의 **Settings → Secrets**에 `NEXON_API_KEY`, `OPENAI_API_KEY`를 등록합니다.

## 실행

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
streamlit run app.py
```

## RAG 문서 추가

신뢰할 수 있는 공략 문서를 Markdown으로 저장해 `knowledge_base/` 아래에 추가합니다. 검색 결과에는 파일 경로가 출처로 표시됩니다. 해당 폴더가 비어 있으면 챗봇은 문서가 아직 없다고 안내하며, 검색 근거 없이 공략을 인용하지 않습니다.

## 유의사항

- 캐릭터 조회 기준일은 한국 시간 기준 전일입니다.
- 스펙업 추천은 현재 장착 상태를 바탕으로 한 점검 후보입니다. 경매장 실시간 시세나 아이템 기대 효율을 계산하지 않습니다.
- 보스 가능성은 공식 클리어 계산기가 아니며, 파티·숙련도·패턴 대응에 따라 달라질 수 있습니다.
- 스크린샷 분석은 이미지에서 판독 가능한 정보만 다룹니다. 실시간 시세 확인 없이 적정 가격을 단정하지 않습니다.
- NEXON Open API 데이터를 사용하므로 앱에 **“Data based on NEXON Open API”** 문구를 표시합니다.
- 페이지 이미지는 앱용으로 생성한 오리지널 일러스트이며 공식 게임 에셋은 아닙니다.
