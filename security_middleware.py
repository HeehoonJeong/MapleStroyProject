"""Scope and prompt-injection guardrails for the MapleStory agent."""

import re
from typing import Any

from langchain.agents.middleware import AgentMiddleware, AgentState, hook_config
from langchain_core.messages import AIMessage
from langgraph.runtime import Runtime


SCOPE_REFUSAL = "메이플스토리 관련 질문만 도와드릴 수 있어요. 캐릭터, 스펙, 장비, 보스, 공략 등에 대해 질문해 주세요."
INJECTION_REFUSAL = "시스템 지시 변경, 프롬프트 공개 또는 안전장치 우회 요청은 처리할 수 없습니다. 메이플스토리 관련 질문을 해주세요."
UNTRUSTED_DATA_REFUSAL = "도구 결과에서 지시문 형태의 의심스러운 내용이 발견되어 해당 요청을 중단했습니다."

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|rules|prompts)",
    r"ignore\s+(the\s+)?(system|developer|hidden)\s+(prompt|instructions?)",
    r"forget\s+(all\s+)?(previous|prior|above)\s+(instructions|rules)",
    r"(이전|앞선|기존|모든)\s*(시스템\s*)?(지시|규칙|프롬프트).{0,16}(무시|잊어|따르지 마)",
    r"(system|developer|hidden|secret)\s+(prompt|instructions?).{0,24}(reveal|show|print|repeat|출력|공개|알려)",
    r"(what\s+(is|are)|tell\s+me\s+about).{0,24}(system|developer|hidden).{0,16}(prompt|instructions?)",
    r"(시스템|개발자|숨겨진|내부)\s*(프롬프트|지시|설정).{0,20}(출력|공개|보여|알려|복사)",
    r"(시스템|개발자|숨겨진|내부)\s*(프롬프트|지시|설정).{0,12}(뭐|무엇|내용|어떤 거)",
    r"(시스템|개발자|기존|이전).{0,12}(지시|프롬프트).{0,12}(무시|우회|잊어|따르지 마)",
    r"(jailbreak|탈옥|안전장치.{0,8}우회|bypass.{0,12}(safety|guardrail|restriction))",
    r"(reveal|print|show|dump).{0,20}(api.?key|secret|\.env|environment variable)",
    r"(api.?key|secret|\.env|환경변수).{0,24}(출력|공개|보여|알려|유출)",
    r"(what\s+is|tell\s+me|show\s+me).{0,16}(the\s+)?(api.?key|secret\s+key)",
    r"you are now (an? )?(unrestricted|uncensored|different assistant)",
    r"from now on.{0,24}(unrestricted|uncensored|ignore (the )?(rules|instructions))",
]

MAPLE_TERMS = {
    "메이플", "maplestory", "maple story", "캐릭터", "ocid", "닉네임", "직업", "월드",
    "스펙", "능력치", "주스탯", "전투력", "장비", "스타포스", "잠재능력", "잠재",
    "보스", "사냥", "육성", "링크", "유니온", "헥사", "hexa", "6차", "강화",
    "경매장", "메소", "길드", "공략", "아이템", "큐브", "어빌리티", "스킬",
    "재획", "원킬", "코어", "데미지", "버닝", "이벤트", "레벨", "아케인", "세르니움",
    "자쿰", "매그너스", "힐라", "반반", "피에르", "블러디퀸", "벨룸", "시그너스",
    "스우", "데미안", "루시드", "윌", "더스크", "진힐라", "듄켈", "검은마법사",
    "세렌", "칼로스", "카링", "림보", "발드릭스",
    "boss", "meso", "maple", "starforce", "equipment", "hexa", "leveling", "training",
    "class build", "guide", "enhancement",
}


def _message_text(message: Any) -> str:
    content = message.get("content", "") if isinstance(message, dict) else getattr(message, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(
            str(part.get("text", ""))
            for part in content
            if isinstance(part, dict) and part.get("type") in {"text", "input_text"}
        )
    return str(content)


def contains_injection(text: str) -> bool:
    normalized = re.sub(r"\s+", " ", text.lower())
    return any(re.search(pattern, normalized, re.IGNORECASE) for pattern in INJECTION_PATTERNS)


def is_maple_related(text: str) -> bool:
    normalized = text.lower()
    return any(term in normalized for term in MAPLE_TERMS)


class MapleScopeGuardrail(AgentMiddleware):
    """Reject unrelated or injection-style requests before a model/tool call."""

    def __init__(self, selected_feature: str | None = None, image_attached: bool = False):
        super().__init__()
        self.selected_feature = selected_feature
        self.image_attached = image_attached

    @hook_config(can_jump_to=["end"])
    def before_model(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
        messages = state.get("messages", [])
        user_messages = [
            message for message in messages
            if (message.get("role") == "user" if isinstance(message, dict)
                else getattr(message, "type", "") == "human")
        ]
        if not user_messages:
            return None

        latest_user_text = _message_text(user_messages[-1])
        if contains_injection(latest_user_text):
            return {"messages": [AIMessage(content=INJECTION_REFUSAL)], "jump_to": "end"}

        # Treat tool outputs as untrusted data; never let embedded instructions steer the agent.
        for message in messages:
            message_type = message.get("type", "") if isinstance(message, dict) else getattr(message, "type", "")
            if message_type == "tool" and contains_injection(_message_text(message)):
                return {"messages": [AIMessage(content=UNTRUSTED_DATA_REFUSAL)], "jump_to": "end"}

        previous_user_text = " ".join(_message_text(message) for message in user_messages[-7:-1])
        contextual_followup = bool(re.fullmatch(
            r"(?:(?:그럼|그러면)\s*)?(?:그거|이거|이건|저건|왜|어떻게|뭐부터|더 알려(?:줘)?|자세히(?: 알려줘)?|추천해(?:줘)?|비교해(?:줘)?|what about it|why|how about it|tell me more|and then what)[?.!\s]*",
            latest_user_text.strip().lower(),
        ))
        short_character_lookup = (
            self.selected_feature in {
                "get_character_ocid", "get_character_basic", "get_character_stats",
                "get_character_equipment", "get_character_hexa", "analyze_character_spec",
            }
            and len(latest_user_text.strip()) <= 20
            and len(latest_user_text.strip().split()) <= 2
        )
        image_analysis = self.selected_feature == "analyze_auction_screenshot" and self.image_attached
        has_context = contextual_followup and is_maple_related(previous_user_text)
        if not (is_maple_related(latest_user_text) or has_context or short_character_lookup or image_analysis):
            return {"messages": [AIMessage(content=SCOPE_REFUSAL)], "jump_to": "end"}
        return None
