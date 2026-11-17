export type FeatureId =
  | "get_character_ocid"
  | "get_character_basic"
  | "get_character_stats"
  | "get_character_equipment"
  | "get_character_hexa"
  | "analyze_character_spec"
  | "recommend_spec_upgrade"
  | "estimate_boss_clear"
  | "analyze_auction_screenshot"
  | "search_maple_guide";

export type Feature = {
  id: FeatureId;
  number: string;
  title: string;
  summary: string;
  description: string;
  example: string;
  note: string;
};

export const features: Feature[] = [
  {
    id: "get_character_ocid",
    number: "01",
    title: "캐릭터 고유 ID 조회",
    summary: "닉네임으로 OCID를 찾습니다.",
    description: "넥슨 캐릭터 식별자 조회 API에서 OCID를 찾습니다. OCID는 다른 캐릭터 API 조회에 사용됩니다.",
    example: "행운s의 OCID를 조회해줘",
    note: "캐릭터 이름이 정확해야 합니다.",
  },
  {
    id: "get_character_basic",
    number: "02",
    title: "기본 정보 조회",
    summary: "레벨, 직업, 월드, 길드 등을 확인합니다.",
    description: "레벨, 직업, 월드, 길드, 생성일과 캐릭터 이미지를 조회해 프로필로 보여줍니다.",
    example: "행운s의 레벨, 직업, 월드를 알려줘",
    note: "캐릭터 정보의 기준일은 한국 시간 기준 전일입니다.",
  },
  {
    id: "get_character_stats",
    number: "03",
    title: "종합 능력치 조회",
    summary: "주요 스탯과 전투 관련 수치를 조회합니다.",
    description: "주스탯, 전투력, 보스 데미지, 방어율 무시와 크리티컬 관련 능력치를 정리합니다.",
    example: "행운s의 주스탯, 보스 데미지, 방무를 정리해줘",
    note: "API 데이터는 스냅샷이며 실제 전투 피해를 보장하지 않습니다.",
  },
  {
    id: "get_character_equipment",
    number: "04",
    title: "장착 장비 조회",
    summary: "장비, 스타포스, 잠재능력 정보를 확인합니다.",
    description: "장착 장비 부위, 스타포스, 잠재능력과 에디셔널 잠재능력을 조회합니다.",
    example: "행운s 장착 장비의 스타포스와 잠재를 보여줘",
    note: "경매장 전체 매물과 실시간 시세는 포함되지 않습니다.",
  },
  {
    id: "get_character_hexa",
    number: "05",
    title: "HEXA 코어·스탯 조회",
    summary: "HEXA 코어와 HEXA 스탯 설정을 확인합니다.",
    description: "HEXA 매트릭스 코어와 HEXA 스탯 데이터를 함께 조회합니다.",
    example: "행운s의 HEXA 코어와 스탯을 요약해줘",
    note: "직업별 최적 강화 순위를 확정하지 않습니다.",
  },
  {
    id: "analyze_character_spec",
    number: "06",
    title: "종합 스펙 분석",
    summary: "기본 정보, 능력치, 장비, HEXA를 함께 봅니다.",
    description: "여러 캐릭터 API 데이터를 모아 강점과 추가로 점검할 부분을 분석합니다.",
    example: "행운s의 전체 스펙을 종합 분석해줘",
    note: "여러 API를 조회하므로 단일 조회보다 오래 걸릴 수 있습니다.",
  },
  {
    id: "recommend_spec_upgrade",
    number: "07",
    title: "스펙업 점검 후보 추천",
    summary: "장비 상태와 보유 메소 예산을 고려합니다.",
    description: "장비의 스타포스와 잠재능력을 보고, 입력한 메소 예산에서 먼저 확인할 후보를 제안합니다.",
    example: "행운s 장비를 보고 10억 메소 예산의 스펙업 후보를 추천해줘",
    note: "실시간 시세와 기대 효율은 계산하지 않습니다.",
  },
  {
    id: "estimate_boss_clear",
    number: "08",
    title: "보스 도전 참고 분석",
    summary: "보스, 파티 인원, 캐릭터 능력치를 함께 봅니다.",
    description: "보스명과 파티 인원을 바탕으로 캐릭터 스펙을 제시하고 도전 시 고려할 점을 설명합니다.",
    example: "행운s로 하드 세렌 6인 파티를 도전할 때 참고할 점을 알려줘",
    note: "공식 클리어 확률 계산이 아니며 숙련도와 파티에 따라 달라집니다.",
  },
  {
    id: "analyze_auction_screenshot",
    number: "09",
    title: "경매장 이미지 분석",
    summary: "이미지의 옵션과 표시 가격을 읽습니다.",
    description: "스크린샷에서 아이템명, 옵션, 스타포스, 표시 가격을 읽어 정리합니다.",
    example: "첨부한 아이템의 옵션과 표시 가격을 정리해줘",
    note: "이미지에서 읽을 수 없는 값이나 시세 적정성은 추측하지 않습니다.",
  },
  {
    id: "search_maple_guide",
    number: "10",
    title: "공략 문서 검색 · RAG",
    summary: "Supabase에 등록한 Markdown 공략을 검색합니다.",
    description: "저장된 공략 문서를 의미 기반 검색하고 관련 문단과 출처를 답변에 제공합니다.",
    example: "아케인 심볼 강화 정보를 찾아줘",
    note: "검색을 사용하려면 Supabase에 문서와 임베딩을 적재해야 합니다.",
  },
];
