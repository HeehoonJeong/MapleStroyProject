import Link from "next/link";
import { features } from "@/lib/features";

export default function HomePage() {
  return (
    <main className="site-shell">
      <div className="wordmark">MAPLE / AI</div>
      <section className="hero">
        <div className="hero-copy">
          <h1>메이플스토리 AI</h1>
          <p className="eyebrow">CHARACTER DATA · BUILD ANALYSIS · ADVENTURE</p>
        </div>
        <img className="hero-image" src="/assets/maple_home_hero.png" alt="단풍 숲을 탐험하는 오리지널 판타지 모험가" />
        <div className="hero-copy">
          <h2>메이플스토리 플레이를 돕는 10가지 도구</h2>
          <p>기능 설명을 확인하고, 필요한 데이터는 넥슨 Open API로 조회해 보세요.</p>
          <div className="process-line">
            <span className="eyebrow">PROCESS</span>
            <span>GPT-5.4-nano 에이전트 · 도구 실행 · 실시간 스트리밍</span>
          </div>
          <Link className="outline-button" href="/assistant?feature=auto" style={{ marginTop: 24 }}>
            챗봇 시작하기 →
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">EXPLORE THE TOOLS</p>
          <h2>기능 둘러보기</h2>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <details className="feature-card" key={feature.id}>
              <summary>{feature.number} / {feature.title} — {feature.summary}</summary>
              <div className="feature-detail">
                <p>{feature.description}</p>
                <p><span className="eyebrow">EXAMPLE</span><br />{feature.example}</p>
                <p className="feature-note">{feature.note}</p>
                <Link className="outline-button" href={`/assistant?feature=${feature.id}`}>
                  이 기능 사용하기 →
                </Link>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="section">
        <p className="eyebrow">HOW IT WORKS</p>
        <h2>세 단계로 시작하기</h2>
        <div className="steps">
          <div className="step"><span className="eyebrow">01 / SELECT</span><p>필요한 조회·분석 도구를 선택합니다.</p></div>
          <div className="step"><span className="eyebrow">02 / ASK</span><p>닉네임, 보스, 메소 예산 등을 구체적으로 입력합니다.</p></div>
          <div className="step"><span className="eyebrow">03 / REVIEW</span><p>API 조회 결과와 참고용 분석을 구분해 확인합니다.</p></div>
        </div>
        <p className="disclaimer">스펙업·보스 분석은 공식 계산 결과가 아니며, 실시간 경매장 시세를 제공하지 않습니다.</p>
      </section>

      <footer className="footer">Data based on NEXON Open API · Original illustration, not official game artwork</footer>
    </main>
  );
}
