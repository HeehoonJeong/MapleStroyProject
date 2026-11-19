"use client";

import { useMemo, useState } from "react";
import { partnerServices, type PartnerService } from "@/lib/partners-data";

const categories = ["전체", "캐릭터", "전투·보스", "랭킹·기록", "아이템·장비", "성장·사냥", "코디", "커뮤니티", "기타"];

function PartnerCard({ service }: { service: PartnerService }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <article className="partner-card">
    <div className="partner-card-top">
      <div className="partner-logo">{service.imageUrl && !imageFailed ? <img src={service.imageUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} /> : <span aria-hidden="true">{service.name.trim().slice(0, 1).toUpperCase()}</span>}</div>
      <span className="partner-category">{service.category}</span>
    </div>
    <h3>{service.name}</h3>
    <p>{service.description}</p>
    <div className="partner-tags" aria-label="주요 기능">{service.features.map(feature => <span key={feature}>{feature}</span>)}</div>
    <div className="partner-links">{service.links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{service.links.length > 1 ? `${link.label} 바로가기` : "사이트 바로가기"}<span aria-hidden="true">↗</span><span className="sr-only"> (새 창)</span></a>)}</div>
  </article>;
}

export default function Partners() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("ko-KR");
    return partnerServices.filter(service => (category === "전체" || service.category === category) && (!term || [service.name, service.description, service.category, ...service.features].some(value => value.toLocaleLowerCase("ko-KR").includes(term))));
  }, [query, category]);
  return <section className="partners-panel" aria-labelledby="partners-title">
    <header className="partners-header"><div><span className="eyebrow">MAPLESTORY PARTNERS</span><h2 id="partners-title">메이플스토리 파트너스</h2><p>더욱 편리한 메이플스토리 플레이를 위한 다양한 서비스를 만나보세요.</p></div><a href="https://partners.maplestory.nexon.com/developers" target="_blank" rel="noopener noreferrer" className="partners-official">공식 파트너스 <span aria-hidden="true">↗</span><span className="sr-only"> (새 창)</span></a></header>
    <div className="partners-tools"><label className="partners-search"><span className="sr-only">파트너 서비스 검색</span><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="서비스, 기능을 검색해 보세요" /></label><span className="partners-count">등록된 서비스 <strong>{partnerServices.length}</strong></span></div>
    <div className="partners-filters" aria-label="서비스 카테고리">{categories.map(item => <button key={item} type="button" className={category === item ? "active" : ""} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="partners-results" aria-live="polite">{query || category !== "전체" ? `검색 결과 ${matches.length}개` : `전체 ${matches.length}개 서비스`}</div>
    {matches.length ? <div className="partners-grid">{matches.map(service => <PartnerCard key={service.id} service={service} />)}</div> : <div className="partners-empty"><strong>검색 결과가 없습니다.</strong><p>다른 검색어나 카테고리를 선택해 보세요.</p><button type="button" onClick={() => { setQuery(""); setCategory("전체"); }}>전체 서비스 보기</button></div>}
    <p className="partners-source">넥슨 공식 파트너스 목록 기준 · 2026.11.19 확인 · 서비스 내용은 변경될 수 있습니다.</p>
  </section>;
}
