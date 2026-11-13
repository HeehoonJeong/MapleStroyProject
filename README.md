# 메이플스토리 AI 도우미

LangChain 에이전트와 Streamlit으로 만든 메이플스토리 캐릭터 기본 정보 조회 챗봇입니다.

## 필요한 키

1. **NEXON API 키**: [넥슨 Open API](https://openapi.nexon.com/ko/)에서 로그인 후 애플리케이션을 등록하고 발급합니다. 메이플스토리 캐릭터 식별자 조회와 기본 정보 조회 권한이 필요합니다.
2. **OpenAI API 키**: LangChain 에이전트의 자연어 대화 모델(`gpt-4o-mini`) 호출에 사용합니다.

NEXON API 키는 Streamlit 사이드바에 입력합니다. OpenAI 키는 프로젝트 루트의 `.env` 파일에 `OPENAI_API_KEY`로 설정하며, 앱이 자동으로 읽습니다. `.env.example`을 복사해 `.env`를 만들고 실제 키를 입력하세요. 실제 키를 저장소에 커밋하지 마세요.

Streamlit 배포 시에는 앱의 **Settings → Secrets**에 다음과 같이 등록할 수 있습니다.

```toml
NEXON_API_KEY = "..."
OPENAI_API_KEY = "..."
```

## 실행

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
streamlit run app.py
```

채팅창에 캐릭터 이름과 함께 정보를 요청하면, 캐릭터 식별자(OCID) 조회 후 기본 정보 API를 호출합니다. 기준일은 한국 시간 기준 전날입니다.

NEXON Open API 데이터를 사용하므로 앱에 **“Data based on NEXON Open API”** 문구를 표시합니다.
