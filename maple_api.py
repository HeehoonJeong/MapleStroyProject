"""NEXON Open API helpers for MapleStory character lookup."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests


BASE_URL = "https://open.api.nexon.com/maplestory/v1"
KST = ZoneInfo("Asia/Seoul")


class NexonAPIError(Exception):
    """Raised when the NEXON Open API returns an error."""


def lookup_character(character_name: str, api_key: str) -> dict:
    """Return a character's basic MapleStory information by character name."""
    name = character_name.strip()
    if not name:
        raise ValueError("캐릭터 이름을 입력해 주세요.")
    if not api_key.strip():
        raise ValueError("NEXON API 키를 입력해 주세요.")

    headers = {"x-nxopen-api-key": api_key.strip()}
    timeout = 10

    try:
        id_response = requests.get(
            f"{BASE_URL}/id",
            headers=headers,
            params={"character_name": name},
            timeout=timeout,
        )
        _raise_for_api_error(id_response)
        ocid = id_response.json().get("ocid")
        if not ocid:
            raise NexonAPIError("캐릭터 식별자를 찾을 수 없습니다. 이름을 확인해 주세요.")

        # Character basic information is queried using the latest available KST date.
        query_date = (datetime.now(KST).date() - timedelta(days=1)).isoformat()
        basic_response = requests.get(
            f"{BASE_URL}/character/basic",
            headers=headers,
            params={"ocid": ocid, "date": query_date},
            timeout=timeout,
        )
        _raise_for_api_error(basic_response)
        return basic_response.json()
    except requests.Timeout as exc:
        raise NexonAPIError("넥슨 API 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.") from exc
    except requests.RequestException as exc:
        raise NexonAPIError("넥슨 API에 연결하지 못했습니다. 네트워크 상태를 확인해 주세요.") from exc


def _raise_for_api_error(response: requests.Response) -> None:
    if response.ok:
        return

    try:
        body = response.json()
        error = body.get("error", {})
        code = error.get("name", "")
        message = error.get("message", "")
    except (ValueError, AttributeError):
        code, message = "", ""

    if code == "OPENAPI00005":
        detail = "NEXON API 키가 유효하지 않습니다. 발급한 키를 확인해 주세요."
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
