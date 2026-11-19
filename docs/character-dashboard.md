# 캐릭터 대시보드

`maple-agent`는 캐릭터 도구의 성공을 기록하고 기존 `maple_character_snapshots`에 저장한 넥슨 응답의 ID와 원본을 스트리밍한다. 메시지에는 `character_snapshot_ids`, `executed_tools`, `response_schema_version`만 저장하며 화면은 소유자 RLS로 보호된 스냅샷을 읽는다. 스냅샷의 기존 29일 삭제 정책은 유지하므로 만료 후에는 텍스트만 보인다. 기존 메시지의 새 컬럼은 기본값으로 처리한다.

## API 매핑

- `character/basic`: 닉네임, 직업, 월드, 이미지, 레벨, 경험치와 길드.
- `character/stat.final_stat`: 전투력과 API가 반환한 능력치. 직업별 수치를 추정하지 않는다.
- `character/item-equipment.item_equipment`: 현재 착용 장비. `item_equipment_preset_1/2/3`은 별도 프리셋이며 없는 프리셋은 비활성화한다. API가 반환한 슬롯 이름과 매칭되지 않는 항목은 기타 장비에 표시한다.
- 장비 수치는 `item_total_option`을 최종값으로, `item_base_option`, `item_add_option`, `item_etc_option`, `item_starforce_option`, `item_exceptional_option`을 세부 항목으로 각각 표시한다. 최종값을 다시 합산하지 않는다. 직업별 추가옵션 점수와 전투력 증감은 계산하지 않는다.
- `potential_option_grade`/`potential_option_1..3`과 `additional_potential_option_grade`/`additional_potential_option_1..3`은 독립적으로 표시한다. 소울과 강화 필드도 존재할 때만 표시한다.
- `character/hexamatrix`, `character/hexamatrix-stat`, `character/symbol-equipment`, `user/union`, `user/union-artifact`, `character/skill`, `character/link-skill`, `character/vmatrix`, `character/hyper-stat`, `character/ability`는 실제 응답이 존재할 때만 표시한다. 최대 레벨이 확인되지 않으면 진행률을 만들지 않는다.
- 성장 그래프는 동일 OCID 및 현재 메시지 이전에 저장된 스냅샷 중 실제 전투력 측정값이 둘 이상인 경우에만 표시한다. 사용자별 RLS가 적용된다.

장비 상세창은 Floating UI의 flip, shift, size, portal을 이용하며 hover, 클릭, 포커스, 외부 클릭, Escape를 지원한다. AI 텍스트는 `react-markdown`과 `remark-gfm`을 사용하고 원시 HTML을 실행하지 않는다. 그래프·비교는 API 원본 값이며 LLM 분석은 별도 본문이다.
