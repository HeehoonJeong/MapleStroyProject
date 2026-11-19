"use client";

import { useState } from "react";
import { FloatingPortal, autoUpdate, flip, offset, shift, size, useClick, useDismiss, useFloating, useFocus, useHover, useInteractions, useRole } from "@floating-ui/react";

type Data = Record<string, any>;
const grades: Record<string, string> = { "레어": "rare", "에픽": "epic", "유니크": "unique", "레전더리": "legendary", Rare: "rare", Epic: "epic", Unique: "unique", Legendary: "legendary" };
const statLabels: Record<string, string> = { str:"STR", dex:"DEX", int:"INT", luk:"LUK", max_hp:"최대 HP", max_mp:"최대 MP", attack_power:"공격력", magic_power:"마력", armor:"방어력", speed:"이동속도", jump:"점프력", boss_damage:"보스 데미지", ignore_monster_armor:"방어율 무시", all_stat:"올스탯", damage:"데미지", max_hp_rate:"최대 HP", max_mp_rate:"최대 MP", equipment_level_decrease:"착용 레벨 감소" };
const optionNames = ["potential_option_1", "potential_option_2", "potential_option_3"];
const additionalNames = ["additional_potential_option_1", "additional_potential_option_2", "additional_potential_option_3"];
const nonzero = (v: unknown) => v !== undefined && v !== null && v !== "" && v !== "0" && v !== 0;
function safeImage(value: unknown): string | undefined { if (typeof value !== "string") return; try { const url = new URL(value); return url.protocol === "https:" ? url.href : undefined; } catch { return; } }
function Potential({ item, additional = false }: { item: Data; additional?: boolean }) {
  const grade = item[additional ? "additional_potential_option_grade" : "potential_option_grade"];
  const options = (additional ? additionalNames : optionNames).map(k => item[k]).filter((x): x is string => typeof x === "string" && !!x.trim());
  if (!grade && !options.length) return null;
  return <div className={`equip-potential grade-${grades[grade] ?? "none"}`}><strong>{additional ? "에디셔널" : "잠재능력"} · {grade || "등급 없음"}</strong>{options.map((option, i) => <span key={i}>{option}</span>)}</div>;
}
function StatBreakdown({ item }: { item: Data }) {
  const total = item.item_total_option ?? {};
  const parts = [["기본", "item_base_option"], ["추가", "item_add_option"], ["주문서", "item_etc_option"], ["스타포스", "item_starforce_option"], ["특수", "item_exceptional_option"]] as const;
  const keys = Object.keys(total).filter(k => nonzero(total[k]));
  if (!keys.length) return null;
  return <div className="equip-detail-stats"><div className="equip-legend"><span>기본</span><span>추가</span><span>주문서</span><span>스타포스</span><span>특수</span></div>{keys.map(key => <div className="equip-stat-line" key={key}><span>{statLabels[key] ?? key}</span><strong>{String(total[key])}</strong><span className="equip-breakdown">{parts.map(([label, field]) => nonzero(item[field]?.[key]) ? <span className={`equip-part-${field}`} key={field} title={label}>{label} {String(item[field][key])}</span> : null)}</span></div>)}</div>;
}
function EquipmentDetail({ item }: { item: Data }) {
  const stars = Math.max(0, Math.min(30, Number(item.starforce) || 0));
  return <div className="equip-detail">
    {!!stars && <div className="equip-stars" aria-label={`스타포스 ${stars}성`}>{Array.from({length:stars},(_,i)=><span key={i}>★{(i + 1) % 5 === 0 ? " " : ""}</span>)}</div>}
    <h4>{item.item_name}{nonzero(item.scroll_upgrade) ? ` (+${item.scroll_upgrade})` : ""}</h4>
    <div className="equip-detail-head">{safeImage(item.item_icon) && <img src={safeImage(item.item_icon)} alt="" />}<div><p>{item.item_equipment_part || item.item_equipment_slot}</p>{item.item_base_option?.base_equipment_level != null && <p>요구 레벨 Lv.{item.item_base_option.base_equipment_level}</p>}{item.item_shape_name && <p>현재 외형 {item.item_shape_name}</p>}</div></div>
    <StatBreakdown item={item} />
    <div className="equip-detail-meta">{item.starforce != null && <p>스타포스 {item.starforce}성</p>}{item.scroll_upgrade != null && <p>주문서 강화 {item.scroll_upgrade}회</p>}{item.scroll_upgradeable_count != null && <p>남은 업그레이드 {item.scroll_upgradeable_count}회</p>}{item.golden_hammer_flag != null && <p>황금망치 {item.golden_hammer_flag}</p>}{nonzero(item.special_ring_level) && <p>특수 스킬 링 Lv.{item.special_ring_level}</p>}</div>
    <Potential item={item} /><Potential item={item} additional />
    {(item.soul_name || item.soul_option) && <div className="equip-soul"><strong>소울 · {item.soul_name}</strong>{item.soul_option && <span>{item.soul_option}</span>}</div>}
    {item.item_description && <p className="equip-description">{item.item_description}</p>}
  </div>;
}
function Item({ item, grid }: { item: Data; grid: boolean }) {
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const { refs, floatingStyles, context } = useFloating({ open, onOpenChange:setOpen, placement:"right-start", whileElementsMounted:autoUpdate, middleware:[offset(10), flip({padding:12}), shift({padding:12, crossAxis:true}), size({padding:12, apply({ availableHeight, elements }) { elements.floating.style.maxHeight = `${Math.max(100, availableHeight)}px`; }})] });
  const hover = useHover(context, { move:false, delay:{open:200, close:150} });
  const focus = useFocus(context, { visibleOnly:false }); const click = useClick(context, {stickIfOpen:true}); const dismiss = useDismiss(context); const role = useRole(context, {role:"dialog"});
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, click, dismiss, role]);
  const icon = safeImage(item.item_icon);
  return <><button type="button" className={grid ? "equip-slot" : "equip-card"} ref={refs.setReference} {...getReferenceProps({"aria-label":`${item.item_name ?? "장비"} 상세 보기`})}>
    <div className="equip-icon">{icon && !imageFailed ? <img src={icon} alt="" onError={() => setImageFailed(true)} /> : <span>이미지 없음</span>}</div>
    <div className="equip-card-content"><span className="equip-part">{item.item_equipment_slot || item.item_equipment_part}</span><strong>{item.item_name}</strong><div className="equip-badges">{nonzero(item.starforce) && <span className="equip-star">★{item.starforce}</span>}{nonzero(item.scroll_upgrade) && <span className="equip-scroll">+{item.scroll_upgrade}</span>}{nonzero(item.special_ring_level) && <span>링 Lv.{item.special_ring_level}</span>}</div>{!grid && <><Potential item={item} /><Potential item={item} additional />{item.soul_name && <span className="equip-soul-label">소울 · {item.soul_name}{item.soul_option ? ` / ${item.soul_option}` : ""}</span>}</>}</div>
  </button>{open && <FloatingPortal><div ref={refs.setFloating} style={floatingStyles} className="equip-popover" {...getFloatingProps()}><button type="button" className="equip-close" aria-label="장비 상세 닫기" onClick={() => setOpen(false)}>×</button><EquipmentDetail item={item} /></div></FloatingPortal>}</>;
}
const slotLayout = ["포켓 아이템", "펜던트2", "펜던트", "무기", "모자", "얼굴장식", "눈장식", "귀고리", "상의", "어깨장식", "반지4", "반지3", "반지2", "반지1", "하의", "벨트", "훈장", "엠블렘", "보조무기", "망토", "뱃지", "기계 심장", "안드로이드", "장갑", "신발"];
function SlotGrid({items,preset}:{items:Data[];preset:string}) {
  const used = new Set<number>();
  const slots=slotLayout.map(slot=>{
    const index=items.findIndex((item,i)=>!used.has(i) && [item.item_equipment_slot,item.item_equipment_part].some(value=>typeof value === "string" && value.replaceAll(" ","") === slot.replaceAll(" ","")));
    if(index>=0) used.add(index);
    return {slot, item:index>=0 ? items[index] : null};
  });
  return <><div className="equipment-grid">{slots.map(({slot,item})=>item ? <Item key={`${preset}-${slot}`} item={item} grid /> : <div key={slot} className="equip-slot-empty" aria-label={`${slot} 빈 슬롯`}><span>{slot}</span></div>)}</div>{items.some((_,i)=>!used.has(i)) && <><p className="dash-hint">기타 장비</p><div className="equipment-grid">{items.map((item,i)=>!used.has(i) ? <Item key={`${preset}-extra-${i}`} item={item} grid /> : null)}</div></>}</>;
}
export default function Equipment({ data }: { data: Data }) {
  const [preset, setPreset] = useState("current"); const [mode, setMode] = useState<"list"|"grid">("list");
  const current = Array.isArray(data.item_equipment) ? data.item_equipment : [];
  const presets = ["item_equipment_preset_1","item_equipment_preset_2","item_equipment_preset_3"];
  const items: Data[] = preset === "current" ? current : (Array.isArray(data[preset]) ? data[preset] : []);
  return <section className="equipment-section"><div className="dashboard-section-title"><div><h4>장비 정보</h4><p>장비를 선택하면 상세 옵션을 확인할 수 있어요.</p></div><div className="dashboard-switch" aria-label="장비 보기 방식"><button type="button" className={mode === "list" ? "active" : ""} aria-pressed={mode === "list"} onClick={() => setMode("list")}>목록</button><button type="button" className={mode === "grid" ? "active" : ""} aria-pressed={mode === "grid"} onClick={() => setMode("grid")}>장비창</button></div></div>
    <div className="dashboard-switch equip-presets" aria-label="장비 프리셋"><button type="button" className={preset === "current" ? "active" : ""} aria-pressed={preset === "current"} onClick={() => setPreset("current")}>현재 착용</button>{presets.map((key,i)=><button key={key} type="button" disabled={!Array.isArray(data[key]) || !data[key].length} className={preset === key ? "active" : ""} aria-pressed={preset === key} onClick={() => setPreset(key)}>프리셋 {i+1}</button>)}</div>
    {items.length ? mode === "grid" ? <SlotGrid items={items} preset={preset} /> : <div className="equipment-list">{items.map((item,i)=><Item key={`${preset}-${item.item_equipment_slot ?? item.item_name}-${i}`} item={item} grid={false} />)}</div> : <p className="dashboard-empty">표시할 장비 데이터가 없습니다.</p>}
  </section>;
}
