"use client";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Mob = { name: string; level: number; exp: number; meso: number; count: number; image_id: string; image_available: boolean };
type HuntMap = { id: string; region: string; name: string; symbol: number; mobs: Mob[]; image_available: boolean };
const number = (value: number) => Math.round(value).toLocaleString("ko-KR");
const regions = ["소멸의여로", "리버스시티", "츄츄아일랜드", "얌얌아일랜드", "레헬른", "아르카나", "모라스", "에스페라", "셀라스", "문브릿지", "고통의미궁", "리멘", "세르니움", "불타는세르니움", "호텔아르크스", "오디움", "도원경", "아르테리아", "카르시온", "탈라하트"];

export default function Hunting() {
  const [maps, setMaps] = useState<HuntMap[]>([]);
  const [region, setRegion] = useState("탈라하트");
  const [selected, setSelected] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [kills, setKills] = useState(9600);
  const [burning, setBurning] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      const client = getSupabaseClient();
      if (!client) { if (active) setError("서비스 연결 설정을 확인해 주세요."); return; }
      const { data, error: loadError } = await client.from("maple_hunting_maps").select("id,region,name,symbol,mobs,image_available").order("region").order("name");
      if (!active) return;
      if (loadError) { setError("사냥터 데이터를 불러오지 못했습니다."); return; }
      const results = (data ?? []) as HuntMap[];
      setMaps(results);
      const first = results.find(m => m.region === "탈라하트" && m.name === "재와 침묵의 땅 1");
      if (first) { setSelected(first.id); setKills(first.mobs.reduce((sum, mob) => sum + mob.count, 0) * 240); }
    }
    void load();
    return () => { active = false; };
  }, []);
  const imageUrl = (id: string) => getSupabaseClient()?.storage.from("hunting-images").getPublicUrl(`${id}.png`).data.publicUrl ?? "";
  const filtered = maps.filter(m => m.region === region);
  const map = filtered.find(m => m.id === selected) ?? filtered[0];
  const count = map?.mobs.reduce((sum, m) => sum + m.count, 0) ?? 0;
  const weightedExp = count ? map.mobs.reduce((sum, m) => sum + m.exp * m.count, 0) / count : 0;
  const estimatedExp = weightedExp * kills * minutes / 30 * (1 + (bonus + burning * 10) / 100);
  function selectMap(m: HuntMap) { setSelected(m.id); setKills(m.mobs.reduce((sum, mob) => sum + mob.count, 0) * 240); }
  function selectRegion(r: string) { setRegion(r); const m = maps.find(item => item.region === r); if (m) selectMap(m); }
  return <section className="hunt-panel" aria-label="사냥터 정보 시범 화면">
    <div className="hunt-header"><div><span className="eyebrow">HUNTING GROUNDS · PREVIEW</span><h2>사냥터 정보</h2><p>지역과 사냥 조건에 따른 예상치를 살펴보세요.</p></div><span className="hunt-icon" aria-hidden="true">✳</span></div>
    <p className="hunt-notice">참고 사이트의 데이터를 사용하며 최신 게임 정보와 다를 수 있습니다. 계산은 입력한 배율을 단순 적용한 예상치입니다.</p>
    <div className="hunt-regions" aria-label="지역 선택">{regions.filter(r => maps.some(m => m.region === r)).map(r => <button key={r} type="button" className={region === r ? "active" : ""} onClick={() => selectRegion(r)}>{r}</button>)}</div>
    <div className="hunt-toolbar"><span className="hunt-region">{region} · {filtered.length}개 맵</span><div className="hunt-times" aria-label="사냥 시간">{[30,60,120].map(value => <button key={value} type="button" className={minutes === value ? "active" : ""} aria-pressed={minutes === value} onClick={() => setMinutes(value)}>{value === 30 ? "30분" : `${value / 60}시간`}</button>)}</div></div>
    {error && <p role="alert">{error}</p>}
    <label className="hunt-map-select-label" htmlFor="hunt-map-select">사냥터 선택</label><select id="hunt-map-select" className="hunt-map-select" value={map?.id ?? ""} onChange={e => { const next = filtered.find(m => m.id === e.target.value); if (next) selectMap(next); }}><option value="" disabled>사냥터를 불러오는 중</option>{filtered.map(m => <option key={m.id} value={m.id}>{m.name} · Lv.{m.mobs.map(mob => mob.level).join("/")}</option>)}</select>
    {map && <><div className="hunt-map-row"><span><small>사냥터 · Lv.{map.mobs.map(m => m.level).join(" / ")}</small><strong>{map.name}</strong></span><span className="hunt-map-row-right">젠 {count}마리</span></div><div className="hunt-detail"><div className="hunt-details-left"><div className="hunt-map-image">{map.image_available ? <img key={map.id} src={imageUrl(`map-${map.id}`)} alt={`${map.name} 지형과 몬스터 위치`} /> : <div className="hunt-map-placeholder"><strong>맵 이미지 준비 중</strong></div>}<small>맵 이미지 · 수집된 참고 자료</small></div>{map.mobs.map(mob => <div className="hunt-monster" key={mob.name}>{mob.image_available && <img src={imageUrl(mob.image_id)} alt={mob.name} />}<div><strong>{mob.name}</strong><span>Lv.{mob.level} · {mob.count}마리</span></div></div>)}<div className="hunt-controls"><label htmlFor="hunt-bonus">추가 경험치 (%)</label><input id="hunt-bonus" type="number" min="0" max="10000" value={bonus} onChange={e => setBonus(Math.max(0, Math.min(10000, Number(e.target.value) || 0)))} /><label htmlFor="hunt-burning">버닝필드 <strong>{burning}단계</strong></label><input id="hunt-burning" type="range" min="0" max="10" step="1" value={burning} onChange={e => setBurning(Number(e.target.value))} /><label htmlFor="hunt-kills">30분당 사냥 마릿수</label><input id="hunt-kills" type="number" min="0" value={kills} onChange={e => setKills(Math.max(0, Number(e.target.value) || 0))} /><small>실제 사냥 마릿수를 입력해 주세요.</small></div></div><div className="hunt-results"><span className="eyebrow">ESTIMATED RESULTS</span><h3>{minutes === 30 ? "30분" : `${minutes / 60}시간`} 예상 결과</h3><div className="hunt-result-grid"><div><span>예상 마릿수</span><strong>{number(kills * minutes / 30)}마리</strong></div><div><span>예상 경험치</span><strong>{number(estimatedExp)}</strong></div></div><div className="hunt-meta"><div><span>지역</span><b>{map.region}</b></div><div><span>요구 포스</span><b>{map.symbol}</b></div><div><span>추가 경험치</span><b>{number(bonus)}%</b></div><div><span>버닝 보너스</span><b>+{burning * 10}%</b></div></div><p>몬스터별 젠 비율과 기본 경험치에 추가 경험치 및 버닝을 단순 적용합니다. 레벨 차이, 배율 중첩, 이벤트 등은 미반영입니다.</p></div></div></>}
  </section>;
}
