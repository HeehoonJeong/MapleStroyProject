"""NEXON Open API helpers for MapleStory character tools."""

import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests


BASE_URL = "https://open.api.nexon.com/maplestory/v1"
KST = ZoneInfo("Asia/Seoul")
TIMEOUT = 12


class NexonAPIError(Exception):
    """Raised when the NEXON Open API returns an error."""


def latest_available_date() -> str:
    return (datetime.now(KST).date() - timedelta(days=1)).isoformat()


def _request(endpoint: str, params: dict, api_key: str) -> dict:
    if not api_key or not api_key.strip():
        raise NexonAPIError("서버에 NEXON_API_KEY가 설정되지 않았습니다.")
    try:
        response = requests.get(
            f"{BASE_URL}/{endpoint.lstrip('/')}",
            headers={"x-nxopen-api-key": api_key.strip()},
            params=params,
            timeout=TIMEOUT,
        )
        _raise_for_api_error(response)
        return response.json()
    except requests.Timeout as exc:
        raise NexonAPIError("넥슨 API 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.") from exc
    except requests.RequestException as exc:
        raise NexonAPIError("넥슨 API에 연결하지 못했습니다. 네트워크 상태를 확인해 주세요.") from exc
    except ValueError as exc:
        raise NexonAPIError("넥슨 API 응답을 JSON으로 읽지 못했습니다.") from exc


def get_character_ocid(character_name: str, api_key: str) -> dict:
    name = character_name.strip()
    if not name:
        raise ValueError("캐릭터 이름을 입력해 주세요.")
    result = _request("id", {"character_name": name}, api_key)
    if not result.get("ocid"):
        raise NexonAPIError("캐릭터 식별자를 찾을 수 없습니다. 이름을 확인해 주세요.")
    return {"character_name": name, "ocid": result["ocid"]}


def _character_data(character_name: str, api_key: str, endpoint: str) -> dict:
    identity = get_character_ocid(character_name, api_key)
    data = _request(
        endpoint,
        {"ocid": identity["ocid"], "date": latest_available_date()},
        api_key,
    )
    return data


def get_character_basic(character_name: str, api_key: str) -> dict:
    return _character_data(character_name, api_key, "character/basic")


def get_character_stats(character_name: str, api_key: str) -> dict:
    return _character_data(character_name, api_key, "character/stat")


def get_character_equipment(character_name: str, api_key: str) -> dict:
    return _character_data(character_name, api_key, "character/item-equipment")


def get_character_hexa(character_name: str, api_key: str) -> dict:
    identity = get_character_ocid(character_name, api_key)
    params = {"ocid": identity["ocid"], "date": latest_available_date()}
    return {
        "hexa_matrix": _request("character/hexamatrix", params, api_key),
        "hexa_stat": _request("character/hexamatrix-stat", params, api_key),
    }


def lookup_character(character_name: str, api_key: str) -> dict:
    """Backward-compatible alias for basic character lookup."""
    return get_character_basic(character_name, api_key)


def analyze_character_spec(character_name: str, api_key: str) -> dict:
    identity = get_character_ocid(character_name, api_key)
    params = {"ocid": identity["ocid"], "date": latest_available_date()}
    result = {
        "basic": _request("character/basic", params, api_key),
        "stats": _request("character/stat", params, api_key),
        "equipment": _request("character/item-equipment", params, api_key),
        "hexa_matrix": _request("character/hexamatrix", params, api_key),
        "hexa_stat": _request("character/hexamatrix-stat", params, api_key),
    }
    return result


def recommend_spec_upgrade(character_name: str, budget_krw: int, api_key: str) -> dict:
    equipment = get_character_equipment(character_name, api_key)
    stats = get_character_stats(character_name, api_key)
    items = _equipment_items(equipment)
    candidates = []
    for item in items:
        starforce = _to_int(item.get("starforce"))
        potential = item.get("potential_option_grade") or "미확인"
        additional = item.get("additional_potential_option_grade") or "미확인"
        reasons = []
        if starforce is not None and starforce < 17:
            reasons.append(f"스타포스 {starforce}성")
        if potential in ("미확인", ""):
            reasons.append("잠재능력 정보 없음")
        if reasons:
            candidates.append({
                "part": item.get("item_equipment_part"),
                "item": item.get("item_name"),
                "starforce": starforce,
                "potential_grade": potential,
                "additional_potential_grade": additional,
                "observation": ", ".join(reasons),
            })
    return {
        "character_name": character_name,
        "budget_krw": max(0, budget_krw),
        "stat_snapshot": _select_stats(stats),
        "upgrade_candidates": candidates[:12],
        "limitations": [
            "경매장 실시간 시세와 잠재 옵션별 기대 효율을 조회하지 않았습니다.",
            "위 후보는 장비 상태를 기준으로 한 점검 목록이며, 가격/효율 순위가 아닙니다.",
        ],
    }


def estimate_boss_clear(character_name: str, boss_name: str, party_size: int, api_key: str) -> dict:
    basic = get_character_basic(character_name, api_key)
    stats = get_character_stats(character_name, api_key)
    return {
        "boss_name": boss_name,
        "party_size": max(1, party_size),
        "character": {
            "name": basic.get("character_name"),
            "level": basic.get("character_level"),
            "class": basic.get("character_class"),
            "world": basic.get("world_name"),
        },
        "stats": _select_stats(stats),
        "limitations": [
            "전투력/능력치만으로 보스 클리어를 보장할 수 없습니다.",
            "보스 세부 난이도, 파티 구성, 숙련도, 생존력, 직업별 딜 구조를 반영한 공식 계산기가 아닙니다.",
        ],
    }


def _select_stats(data: dict) -> dict:
    wanted = {
        "전투력", "STR", "DEX", "INT", "LUK", "HP", "힘", "민첩", "지력", "운",
        "보스 몬스터 공격 시 데미지", "방어율 무시", "크리티컬 확률", "크리티컬 데미지",
        "최종 데미지", "최소 스탯 공격력", "최대 스탯 공격력",
    }
    return {
        item.get("stat_name"): item.get("stat_value")
        for item in data.get("final_stat", [])
        if item.get("stat_name") in wanted
    }


def _equipment_items(data: dict) -> list:
    items = data.get("item_equipment") or []
    if items:
        return items
    for key in ("item_equipment_preset_1", "item_equipment_preset_2", "item_equipment_preset_3"):
        if data.get(key):
            return data[key]
    return []


def _to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def to_json(data: dict, limit: int = 14000) -> str:
    text = json.dumps(data, ensure_ascii=False, indent=2)
    if len(text) > limit:
        return text[:limit] + "\n... 응답이 길어 일부 생략됨"
    return text


def _raise_for_api_error(response: requests.Response) -> None:
    if response.ok:
        return
    try:
        error = response.json().get("error", {})
        code = error.get("name", "")
        message = error.get("message", "")
    except (ValueError, AttributeError):
        code, message = "", ""
    if code == "OPENAPI00005":
        detail = "NEXON API 키가 유효하지 않습니다. 서버 설정을 확인해 주세요."
    elif code == "OPENAPI00007":
        detail = "넥슨 API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요."
    elif code == "OPENAPI00009":
        detail = "요청한 날짜의 캐릭터 데이터가 아직 준비되지 않았습니다."
    elif response.status_code == 404 or code == "OPENAPI00003":
        detail = "캐릭터를 찾을 수 없습니다. 캐릭터 이름을 확인해 주세요."
    elif message:
        detail = f"넥슨 API 오류: {message}"
    else:
        detail = f"넥슨 API 요청에 실패했습니다 (HTTP {response.status_code})."
    raise NexonAPIError(detail)
