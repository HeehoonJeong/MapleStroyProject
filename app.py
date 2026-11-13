import streamlit as st
from dotenv import load_dotenv
from ui_theme import apply_maple_theme

load_dotenv()

st.set_page_config(page_title="메이플스토리 AI 도우미", page_icon="🍁", layout="wide")
apply_maple_theme()
st.title("🍁 메이플스토리 AI 도우미")
st.image("assets/maple_home_hero.png", use_container_width=True)
st.subheader("메이플스토리 플레이를 돕는 10가지 AI 기능")
st.write("관심 있는 기능을 눌러 상세 설명을 확인하고, 바로 챗봇으로 이동해 사용해 보세요.")

hero_left, hero_right = st.columns([1, 1])
with hero_left:
    st.info("**대화 흐름**  GPT-5.4-nano가 도구를 실행하고 최종 답변까지 스트리밍")
with hero_right:
    if st.button("✨ 챗봇에서 기능 자동 선택", type="primary", use_container_width=True):
        st.session_state["pending_tool_feature_label"] = "자동 선택"
        st.switch_page("pages/1_도구_챗봇.py")

st.markdown("### 기능 둘러보기")
features = [
    {
        "label": "1. 캐릭터 OCID 조회", "icon": "🔎", "title": "캐릭터 고유 ID 조회",
        "short": "닉네임으로 OCID를 찾습니다.",
        "detail": "넥슨 캐릭터 식별자 조회 API를 호출해 닉네임에 해당하는 OCID를 반환합니다. OCID는 기본 정보와 장비 등 다른 캐릭터 API를 조회할 때 사용되는 고유 식별자입니다.",
        "example": "행운s의 OCID를 조회해줘",
        "note": "캐릭터 이름이 정확해야 하며, OCID만으로 레벨·장비 정보까지 알 수 있는 것은 아닙니다.",
    },
    {
        "label": "2. 캐릭터 기본 정보", "icon": "🧙", "title": "기본 정보 조회",
        "short": "레벨, 직업, 월드, 길드 등을 확인합니다.",
        "detail": "캐릭터 레벨, 직업, 월드, 성별, 길드, 생성일 등 넥슨 Open API가 제공하는 기본 프로필을 조회하고 읽기 쉽게 정리합니다.",
        "example": "행운s의 레벨, 직업, 월드를 알려줘",
        "note": "기본 정보의 기준일은 한국 시간 기준 전일입니다.",
    },
    {
        "label": "3. 캐릭터 능력치", "icon": "📊", "title": "종합 능력치 조회",
        "short": "주요 스탯과 전투 관련 수치를 조회합니다.",
        "detail": "주스탯, 전투력, 보스 몬스터 공격 시 데미지, 방어율 무시, 크리티컬 관련 능력치 등 API 응답을 확인하고 항목별 의미를 안내합니다.",
        "example": "행운s의 주스탯, 보스 데미지, 방무를 정리해줘",
        "note": "조회 결과는 API 스냅샷이며, 전투 상황의 실제 피해량을 보장하지 않습니다.",
    },
    {
        "label": "4. 장착 장비", "icon": "🛡️", "title": "장착 장비 조회",
        "short": "장비, 스타포스, 잠재능력 정보를 확인합니다.",
        "detail": "현재 장착 장비 목록과 부위, 스타포스, 잠재능력·에디셔널 잠재능력 정보를 요약합니다. 장비 상태를 살펴보거나 스펙업 후보를 찾을 때 활용할 수 있습니다.",
        "example": "행운s 장착 장비의 스타포스와 잠재를 보여줘",
        "note": "캐시 장비와 경매장 전체 매물·실시간 시세는 이 조회에 포함되지 않습니다.",
    },
    {
        "label": "5. HEXA 정보", "icon": "💠", "title": "HEXA 코어·스탯 조회",
        "short": "HEXA 코어와 HEXA 스탯 설정을 확인합니다.",
        "detail": "HEXA 매트릭스 코어 및 HEXA 스탯 설정 API를 함께 조회해 강화 상태를 정리합니다. 어느 코어가 있는지와 설정 정보를 한눈에 볼 수 있습니다.",
        "example": "행운s의 HEXA 코어와 HEXA 스탯을 요약해줘",
        "note": "API가 제공하는 설정 정보 조회이며, 직업별 최적 강화 순위를 자동으로 확정하지 않습니다.",
    },
    {
        "label": "6. 캐릭터 종합 스펙 분석", "icon": "🧩", "title": "종합 스펙 분석",
        "short": "기본 정보, 능력치, 장비, HEXA를 함께 봅니다.",
        "detail": "여러 캐릭터 API를 호출해 한 번에 모은 뒤, GPT-5.4-nano가 조회된 데이터만 근거로 스펙의 특징과 추가로 점검할 부분을 정리합니다.",
        "example": "행운s의 전체 스펙을 종합 분석해줘",
        "note": "여러 API 호출이 필요해 단일 조회 기능보다 응답이 오래 걸릴 수 있습니다.",
    },
    {
        "label": "7. 스펙업 우선순위 추천", "icon": "⬆️", "title": "스펙업 점검 후보 추천",
        "short": "장비 상태와 보유 메소 예산을 함께 고려합니다.",
        "detail": "장착 장비의 스타포스와 잠재능력 상태를 살펴보고, 입력한 메소 예산 범위에서 먼저 확인해 볼 장비 후보와 판단 근거를 제안합니다.",
        "example": "행운s 장비를 보고 예산 10억 메소 기준 스펙업 후보를 추천해줘",
        "note": "실시간 경매장 가격·기대 효율을 조회하지 않으므로 가격이나 효율 순위를 확정하지 않습니다.",
    },
    {
        "label": "8. 보스 클리어 가능성 추정", "icon": "🐉", "title": "보스 도전 참고 분석",
        "short": "보스와 파티 인원, 캐릭터 능력치를 함께 봅니다.",
        "detail": "지정한 보스와 파티 인원에 캐릭터 레벨·직업·주요 능력치를 함께 제시하고, 도전 전 고려할 점을 참고용으로 설명합니다.",
        "example": "행운s로 하드 세렌 6인 파티를 도전할 때 참고할 점을 알려줘",
        "note": "공식 클리어 확률 계산기가 아닙니다. 숙련도, 패턴 대응, 파티 구성에 따라 결과가 달라집니다.",
    },
    {
        "label": "9. 경매장 스크린샷 분석", "icon": "🖼️", "title": "경매장 이미지 분석",
        "short": "이미지에 보이는 옵션과 표시 가격을 읽습니다.",
        "detail": "챗봇 페이지에서 스크린샷을 첨부하면 아이템 이름, 옵션, 스타포스, 화면에 표시된 가격처럼 이미지에서 읽을 수 있는 정보를 정리합니다.",
        "example": "첨부한 아이템 옵션을 정리하고 어떤 점을 비교해야 하는지 알려줘",
        "note": "화질이 낮거나 잘린 값은 판독할 수 없습니다. 실제 시세를 확인하지 않은 가격 적정성은 판단하지 않습니다.",
    },
    {
        "label": "10. 메이플 공략 검색 (RAG)", "icon": "📚", "title": "공략 문서 검색 (RAG)",
        "short": "프로젝트에 등록한 Markdown 공략을 검색합니다.",
        "detail": "knowledge_base 폴더의 로컬 Markdown 문서를 검색하고, 관련 문단과 파일 경로를 답변 근거로 제공합니다. 출처가 없으면 검색 결과가 없다고 안내합니다.",
        "example": "knowledge_base 문서에서 아케인 심볼 강화 정보를 찾아줘",
        "note": "외부 웹을 실시간 검색하지 않습니다. 신뢰할 수 있는 공략 문서를 knowledge_base/에 추가해야 합니다.",
    },
]

for row_start in range(0, len(features), 2):
    columns = st.columns(2, gap="medium")
    for column, feature in zip(columns, features[row_start:row_start + 2]):
        with column:
            with st.container(border=True):
                with st.expander(f"{feature['icon']}  {feature['title']}  ·  {feature['short']}"):
                    st.write(feature["detail"])
                    st.markdown(f"**질문 예시**  {feature['example']}")
                    st.caption(feature["note"])
                    if st.button("이 기능 사용하기 →", key=f"home_use_{feature['label']}", use_container_width=True):
                        st.session_state["pending_tool_feature_label"] = feature["label"]
                        st.switch_page("pages/1_도구_챗봇.py")

st.markdown("### 이렇게 사용하세요")
step1, step2, step3 = st.columns(3)
with step1:
    st.markdown("**① 기능 선택**\n\n위 카드에서 기능을 눌러 설명을 확인합니다.")
with step2:
    st.markdown("**② 질문 입력**\n\n예시를 참고해 닉네임, 보스, 예산 등을 구체적으로 입력합니다.")
with step3:
    st.markdown("**③ 답변 확인**\n\n조회 데이터와 참고용 분석을 구분해 확인합니다.")

st.caption("스펙업·보스 결과는 공식 계산 결과가 아니며, 파티 구성·숙련도·실시간 시세에 따라 달라질 수 있습니다.")
st.caption("Data based on NEXON Open API")
