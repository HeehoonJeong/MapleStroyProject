import { AIMessage, createMiddleware } from "langchain";

export const SCOPE_REFUSAL = "메이플스토리 관련 질문만 도와드릴 수 있어요. 캐릭터, 스펙, 장비, 보스, 공략 등에 대해 질문해 주세요.";
export const INJECTION_REFUSAL = "시스템 지시 변경, 프롬프트 공개 또는 안전장치 우회 요청은 처리할 수 없습니다.";
export const UNTRUSTED_REFUSAL = "도구 결과에서 의심스러운 지시문이 발견되어 요청을 중단했습니다.";

const injectionPatterns = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|rules|prompts)/i,
  /ignore\s+(the\s+)?(system|developer|hidden)\s+(prompt|instructions?)/i,
  /forget\s+(all\s+)?(previous|prior|above)\s+(instructions|rules)/i,
  /(이전|앞선|기존|모든)\s*(시스템\s*)?(지시|규칙|프롬프트).{0,16}(무시|잊어|따르지 마)/i,
  /(시스템|개발자|숨겨진|내부)\s*(프롬프트|지시|설정).{0,20}(출력|공개|보여|알려|복사)/i,
  /(시스템|개발자|기존|이전).{0,12}(지시|프롬프트).{0,12}(무시|우회|잊어|따르지 마)/i,
  /(jailbreak|탈옥|안전장치.{0,8}우회|bypass.{0,12}(safety|guardrail|restriction))/i,
  /(reveal|print|show|dump).{0,20}(api.?key|secret|\.env|environment variable)/i,
  /(what\s+is|tell\s+me|show\s+me).{0,16}(the\s+)?(api.?key|secret\s+key)/i,
  /(api.?key|secret|\.env|환경변수).{0,24}(출력|공개|보여|알려|유출)/i,
  /you are now (an? )?(unrestricted|uncensored|different assistant)/i,
];

const mapleTerms = [
  "메이플", "maplestory", "maple story", "캐릭터", "ocid", "닉네임", "직업", "월드", "스펙", "능력치",
  "주스탯", "전투력", "장비", "스타포스", "잠재", "보스", "사냥", "육성", "링크", "유니온", "헥사",
  "hexa", "6차", "강화", "경매장", "메소", "길드", "공략", "아이템", "큐브", "스킬", "원킬",
  "아케인", "세르니움", "루시드", "윌", "세렌", "칼로스", "카링", "마일리지", "공지", "점검", "이벤트",
  "패치", "업데이트", "캐시샵", "공식 공지", "보상", "탐험 코인", "메이플크레딧", "boss", "meso", "starforce",
  "equipment", "leveling", "guide", "enhancement",
];

const characterFeatures = new Set([
  "get_character_ocid", "get_character_basic", "get_character_stats", "get_character_equipment",
  "get_character_hexa", "analyze_character_spec",
]);

function textOf(message: any): string {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part && (part.type === "text" || part.type === "input_text"))
      .map((part) => String(part.text ?? ""))
      .join(" ");
  }
  return "";
}

export function containsInjection(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").toLowerCase();
  return injectionPatterns.some((pattern) => pattern.test(normalized));
}

export function isMapleRelated(text: string): boolean {
  const normalized = text.toLowerCase();
  return mapleTerms.some((term) => normalized.includes(term));
}

export function createMapleGuardrail(feature: string, imageAttached: boolean) {
  return createMiddleware({
    name: "MapleScopeAndInjectionGuardrail",
    beforeModel: {
      canJumpTo: ["end"],
      hook: (state: any) => {
        const messages = state.messages ?? [];
        const humans = messages.filter((message: any) => message?.type === "human" || message?.getType?.() === "human");
        const latest = textOf(humans.at(-1));
        if (!latest) return;

        if (containsInjection(latest)) {
          return { messages: [new AIMessage(INJECTION_REFUSAL)], jumpTo: "end" as const };
        }

        const toolMessages = messages.filter((message: any) => message?.type === "tool" || message?.getType?.() === "tool");
        if (toolMessages.some((message: any) => containsInjection(textOf(message)))) {
          return { messages: [new AIMessage(UNTRUSTED_REFUSAL)], jumpTo: "end" as const };
        }

        const previousText = humans.slice(-7, -1).map(textOf).join(" ");
        const followUp = /^(?:(?:그럼|그러면|그리고)\s*)?(?:그거|이거|이건|저건|왜|어떻게|뭐부터|더 알려(?:줘)?|자세히(?: 알려줘)?|추천해(?:줘)?|비교해(?:줘)?|다시(?:\s|$)|오늘 기준|지난\s*\d+일|최근\s*\d+일|what about it|why|how about it|tell me more)[?.!\s\d가-힣]*$/i.test(latest.trim())
          || /(?:최근|지난)\s*\d+\s*일|오늘 기준|다시\s*(?:뽑|찾|검색|조회|정리|요약)|기간을?\s*(?:바꿔|조정)/i.test(latest);
        const shortCharacterName = characterFeatures.has(feature) && latest.trim().length <= 20 && latest.trim().split(/\s+/).length <= 2;
        const allowed = isMapleRelated(latest)
          || (followUp && isMapleRelated(previousText))
          || shortCharacterName
          || (feature === "analyze_auction_screenshot" && imageAttached);
        if (!allowed) {
          return { messages: [new AIMessage(SCOPE_REFUSAL)], jumpTo: "end" as const };
        }
        return;
      },
    },
  });
}
