"""LangChain tools exposed by the MapleStory assistant."""

import json

from langchain.tools import tool

from maple_api import (
    NexonAPIError,
    analyze_character_spec as fetch_spec,
    estimate_boss_clear as fetch_boss_estimate,
    get_character_basic as fetch_basic,
    get_character_equipment as fetch_equipment,
    get_character_hexa as fetch_hexa,
    get_character_ocid as fetch_ocid,
    get_character_stats as fetch_stats,
    recommend_spec_upgrade as fetch_upgrade_recommendation,
    to_json,
)
from maple_guide import search_maple_guide as retrieve_guide


def build_tools(api_key: str, screenshot_attached: bool = False) -> dict:
    @tool("get_character_ocid", description="캐릭터 닉네임으로 고유 식별자 OCID를 조회합니다.")
    def get_character_ocid_tool(character_name: str) -> str:
        return _safe(lambda: fetch_ocid(character_name, api_key))

    @tool("get_character_basic", description="캐릭터 레벨, 직업, 월드, 길드 등 기본 정보를 조회합니다.")
    def get_character_basic_tool(character_name: str) -> str:
        return _safe(lambda: fetch_basic(character_name, api_key))

    @tool("get_character_stats", description="캐릭터 주스탯, 전투력, 보스 데미지, 방어율 무시 등 종합 능력치를 조회합니다.")
    def get_character_stats_tool(character_name: str) -> str:
        return _safe(lambda: fetch_stats(character_name, api_key))

    @tool("get_character_equipment", description="장착 장비와 스타포스, 잠재능력 정보를 조회합니다.")
    def get_character_equipment_tool(character_name: str) -> str:
        return _safe(lambda: fetch_equipment(character_name, api_key))

    @tool("get_character_hexa", description="HEXA 코어와 HEXA 스탯 및 강화 정보를 조회합니다.")
    def get_character_hexa_tool(character_name: str) -> str:
        return _safe(lambda: fetch_hexa(character_name, api_key))

    @tool("analyze_character_spec", description="캐릭터 기본 정보, 능력치, 장비, HEXA 데이터를 함께 조회해 종합 분석합니다.")
    def analyze_character_spec_tool(character_name: str) -> str:
        return _safe(lambda: fetch_spec(character_name, api_key))

    @tool("recommend_spec_upgrade", description="현재 장비와 예산을 바탕으로 점검할 스펙업 후보를 제시합니다. 경매장 시세를 확인하지 않는 참고용 분석입니다.")
    def recommend_spec_upgrade_tool(character_name: str, budget_krw: int) -> str:
        return _safe(lambda: fetch_upgrade_recommendation(character_name, budget_krw, api_key))

    @tool("estimate_boss_clear", description="캐릭터 능력치와 보스 이름, 파티 인원을 바탕으로 참고용 클리어 가능성을 분석합니다. 공식 보장 계산기가 아닙니다.")
    def estimate_boss_clear_tool(character_name: str, boss_name: str, party_size: int = 1) -> str:
        return _safe(lambda: fetch_boss_estimate(character_name, boss_name, party_size, api_key))

    @tool("analyze_auction_screenshot", description="첨부된 경매장 스크린샷의 아이템 옵션과 표시 가격을 읽고 분석합니다.")
    def analyze_auction_screenshot_tool() -> str:
        if not screenshot_attached:
            return "스크린샷이 첨부되지 않았습니다. 페이지의 이미지 업로더에서 경매장 화면을 올려 주세요."
        return (
            "현재 사용자 메시지에 경매장 이미지가 첨부되어 있습니다. "
            "이미지에서 확인 가능한 아이템명, 잠재/추가옵션, 스타포스, 표시 가격을 읽으세요. "
            "읽을 수 없는 값은 추측하지 말고, 시세의 적정성은 실제 비교 시세가 없으면 판단 불가라고 안내하세요."
        )

    @tool("search_maple_guide", description="knowledge_base 폴더의 Markdown 공략 문서를 검색하고 출처와 함께 관련 내용을 반환합니다.")
    def search_maple_guide_tool(query: str) -> str:
        matches = retrieve_guide(query)
        if not matches:
            return (
                "검색 가능한 공략 문서가 없습니다. 프로젝트의 knowledge_base/ 폴더에 "
                "신뢰할 수 있는 출처의 Markdown 문서를 추가한 뒤 다시 검색해 주세요."
            )
        return json.dumps(matches, ensure_ascii=False, indent=2)

    return {
        "get_character_ocid": get_character_ocid_tool,
        "get_character_basic": get_character_basic_tool,
        "get_character_stats": get_character_stats_tool,
        "get_character_equipment": get_character_equipment_tool,
        "get_character_hexa": get_character_hexa_tool,
        "analyze_character_spec": analyze_character_spec_tool,
        "recommend_spec_upgrade": recommend_spec_upgrade_tool,
        "estimate_boss_clear": estimate_boss_clear_tool,
        "analyze_auction_screenshot": analyze_auction_screenshot_tool,
        "search_maple_guide": search_maple_guide_tool,
    }


def _safe(fn) -> str:
    try:
        value = fn()
        return to_json(value) if isinstance(value, dict) else str(value)
    except (NexonAPIError, ValueError) as exc:
        return f"조회 실패: {exc}"
