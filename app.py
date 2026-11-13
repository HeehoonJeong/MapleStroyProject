import json
import os

import streamlit as st
from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI

from maple_api import NexonAPIError, lookup_character as fetch_character

load_dotenv()

st.set_page_config(page_title="메이플스토리 AI 도우미", page_icon="🍁")
st.title("🍁 메이플스토리 AI 도우미")
st.caption("캐릭터 이름을 물어보면 넥슨 Open API로 기본 정보를 조회합니다.")
st.caption("Data based on NEXON Open API")


def get_secret(name: str) -> str:
    value = os.getenv(name, "")
    if value:
        return value
    try:
        return str(st.secrets.get(name, ""))
    except Exception:
        return ""


with st.sidebar:
    st.header("API 설정")
    nexon_api_key = st.text_input(
        "NEXON API 키",
        value=get_secret("NEXON_API_KEY"),
        type="password",
        help="넥슨 Open API에서 애플리케이션을 등록한 뒤 발급받은 키입니다.",
    )
    st.caption("OpenAI API 키는 프로젝트의 .env 파일에서 불러옵니다.")

openai_api_key = get_secret("OPENAI_API_KEY")


if "messages" not in st.session_state:
    st.session_state.messages = []

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])


def build_agent(api_key: str):
    @tool
    def character_lookup(character_name: str) -> str:
        """메이플스토리 캐릭터 이름으로 월드, 직업, 레벨 등 기본 정보를 조회합니다."""
        try:
            character = fetch_character(character_name, api_key)
            return json.dumps(character, ensure_ascii=False)
        except (NexonAPIError, ValueError) as exc:
            return f"조회 실패: {exc}"

    return create_agent(
        model=ChatOpenAI(model="gpt-4o-mini", api_key=openai_api_key, temperature=0),
        tools=[character_lookup],
        system_prompt=(
            "너는 메이플스토리 정보를 안내하는 한국어 챗봇이다. "
            "사용자가 특정 캐릭터의 정보를 물으면 반드시 character_lookup 도구를 사용한다. "
            "도구가 반환한 정보만 사실로 안내하고, 모르는 정보는 추측하지 않는다. "
            "레벨, 월드, 직업, 길드와 조회 기준일을 읽기 쉽게 정리한다."
        ),
    )


if prompt := st.chat_input("예: 행운s 캐릭터 정보 알려줘"):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    if not nexon_api_key or not openai_api_key:
        if not nexon_api_key:
            answer = "사이드바에서 NEXON API 키를 입력해 주세요."
        else:
            answer = "서버의 .env 파일에 OPENAI_API_KEY를 설정해 주세요."
    else:
        with st.chat_message("assistant"):
            with st.spinner("캐릭터 정보를 확인하고 있어요..."):
                try:
                    agent = build_agent(nexon_api_key)
                    result = agent.invoke({"messages": st.session_state.messages})
                    answer = result["messages"][-1].content
                except Exception as exc:
                    # Keep credentials and low-level request details out of the chat UI.
                    answer = f"요청을 처리하지 못했습니다. API 키와 설정을 확인해 주세요. ({type(exc).__name__})"
            st.markdown(answer)

    if not nexon_api_key or not openai_api_key:
        with st.chat_message("assistant"):
            st.info(answer)
    st.session_state.messages.append({"role": "assistant", "content": answer})
