import streamlit as st
from dotenv import load_dotenv
from ui_theme import apply_maple_theme

load_dotenv()

st.set_page_config(page_title="메이플스토리 AI 도우미", page_icon="🍁", layout="wide")
apply_maple_theme()
st.title("🍁 메이플스토리 AI 도우미")
st.image("assets/maple_home_hero.png", use_container_width=True)
st.subheader("캐릭터 데이터와 게임 정보를 한곳에서")
st.write(
    "캐릭터 조회, 스펙 분석, 장비 점검, 경매장 이미지 분석과 공략 검색을 제공하는 "
    "메이플스토리 AI Agent입니다. 왼쪽 메뉴에서 **도구 챗봇** 페이지로 이동해 기능을 선택하세요."
)

st.info("대화 처리: GPT-5.4-nano 1차 분석 → GPT-5.5 최종 답변")

st.markdown("### 제공 기능")
features = [
    ("캐릭터 조회", "닉네임으로 OCID, 레벨·직업·월드, 능력치, 장비 및 HEXA 정보를 조회합니다."),
    ("캐릭터 분석", "조회된 캐릭터 데이터를 모아 강점과 추가 확인이 필요한 부분을 정리합니다."),
    ("스펙업·보스", "예산과 장비 상태를 바탕으로 점검할 항목을 추천하고, 보스 도전 가능성을 참고용으로 분석합니다."),
    ("경매장 이미지", "스크린샷에서 읽을 수 있는 옵션과 표시 가격을 정리합니다. 시세 판단은 근거가 있을 때만 제공합니다."),
    ("공략 검색", "프로젝트의 `knowledge_base/` 폴더에 넣은 Markdown 공략 문서를 검색하고 출처를 표시합니다."),
]
for title, description in features:
    with st.container(border=True):
        st.markdown(f"**{title}** — {description}")

st.caption("스펙업·보스 결과는 공식 계산 결과가 아니며, 파티 구성·숙련도·실시간 시세에 따라 달라질 수 있습니다.")
st.caption("Data based on NEXON Open API")
