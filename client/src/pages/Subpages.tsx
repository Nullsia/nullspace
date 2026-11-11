import { type FormEvent } from "react";
import "./Subpages.css";
import { Lines } from "../components/Lines";

const email = "seunghoon.lee@null-space.io";

function ArrowLink({ href, children, dark = false }: { href: string; children: React.ReactNode; dark?: boolean }) {
  return <a className={`sp-arrow-link${dark ? " sp-arrow-link-dark" : ""}`} href={href}><span>{children}</span><span aria-hidden="true">↗</span></a>;
}

function PageIntro({ title, description, graphic = false }: { title: React.ReactNode; description: React.ReactNode; graphic?: boolean }) {
  return (
    <section className={`sp-intro${graphic ? " sp-intro-graphic" : ""}`}>
      <div className="sp-intro-main">
        <div className="sp-intro-copy"><h1>{title}</h1><p><Lines>{description}</Lines></p></div>
        {graphic && <div className="sp-wireframe" aria-hidden="true"><div className="sp-wireframe-ring sp-ring-one"/><div className="sp-wireframe-ring sp-ring-two"/><div className="sp-wireframe-ring sp-ring-three"/></div>}
      </div>
    </section>
  );
}

function SectionHead({ title, description }: { title: React.ReactNode; description?: React.ReactNode }) {
  return <div className="sp-section-head"><h2>{title}</h2>{description && <p><Lines>{description}</Lines></p>}</div>;
}

function InquiryCTA({ heading = <>보이지 않던 가능성을<br/>함께 발견합니다.</> }: { heading?: React.ReactNode }) {
  return <section className="sp-cta"><h2>{heading}</h2><ArrowLink href="/contact" dark>도입 문의하기</ArrowLink></section>;
}

const racks = Array.from({ length: 200 }, (_, index) => index);

function ScenarioGraphic() {
  return <div className="sp-scenario-graphic" role="img" aria-label="200랙 가상 레이아웃을 표현한 모식도">
    <div className="sp-map"><div className="sp-rack-grid">{racks.map((rack) => <span key={rack} className={rack % 31 === 0 || rack % 47 === 0 ? "sp-rack sp-rack-active" : "sp-rack"}/>)}</div></div>
  </div>;
}

export function SolutionPage() {
  return <div className="subpage sp-solution">
    <PageIntro title={<>보이지 않는 손실을<br/><span>보이는 가능성으로.</span></>} description={<>데이터센터의 공간과 운영을 새롭게 바라봅니다.<br/>구축부터 운영까지, 더 나은 의사결정을 위한 연결.</>} graphic/>
    <section className="sp-section sp-problem">
      <SectionHead title={<>데이터센터의 효율은<br/>공간에서 시작됩니다.</>} description="복잡해지는 인프라 속에서 공간, 냉각, 운영은 서로 연결되어 있습니다. 보이지 않는 비효율을 이해하는 것이 변화의 첫걸음입니다."/>
      <div className="sp-three-columns">
        <article><h3>제한된 공간</h3><p><Lines>밀도가 높아질수록 랙 배치와 이동을 더 세심하게 계획해야 합니다.</Lines></p></article>
        <article><h3>보이지 않는 흐름</h3><p><Lines>공기의 흐름과 온도 차이는 공간 전체의 운영에 영향을 줍니다.</Lines></p></article>
        <article><h3>흩어진 운영 정보</h3><p><Lines>구축과 운영의 정보를 연결해 더 나은 판단의 바탕을 만듭니다.</Lines></p></article>
      </div>
    </section>
    <section className="sp-section sp-scenario">
      <SectionHead title={<>변화를 먼저<br/>시뮬레이션합니다.</>} description="다양한 배치와 냉각 시나리오를 가상의 공간에서 살펴봅니다. 복잡한 현장을 이해하기 위한 새로운 출발점입니다."/>
      <ScenarioGraphic/>
      <div className="sp-scenario-note"><div><strong>200</strong><span>랙 가상 레이아웃</span></div><p><Lines>200랙 가상 레이아웃을 기반으로 한 CFD 데모입니다. 시뮬레이션은 이해를 돕기 위한 예시이며, <b>아직 현장 실측 검증 전</b>입니다.</Lines></p></div>
    </section>
    <section className="sp-section sp-products" id="products">
      <SectionHead title={<>구축에서 운영까지,<br/>하나의 흐름으로.</>} description="각 단계의 과제를 분리하지 않고 연결합니다. 물리적 작업과 운영 정보를 하나의 시스템으로 바라봅니다."/>
      <div className="sp-product-grid">
        <article className="sp-product"><div className="sp-product-image"><img src="/images/n-mover.jpg" alt="데이터센터 랙 이동을 위한 N-MOVER 이미지"/></div><div className="sp-product-copy"><div><h3>N-MOVER</h3></div><p><Lines>랙 구축과 이동 과정의 복잡함을 줄이기 위한 솔루션입니다. 데이터센터의 물리적인 변화를 더 체계적으로 준비합니다.</Lines></p></div></article>
        <article className="sp-product"><div className="sp-product-image sp-product-image-tall"><img src="/images/n-prover.jpg" alt="데이터센터 운영을 위한 N-PROVER 이미지"/></div><div className="sp-product-copy"><div><h3>N-PROVER</h3></div><p><Lines>운영 현장의 상태를 살피고 필요한 정보를 연결하는 솔루션입니다. 공간을 더 깊이 이해하는 운영을 지향합니다.</Lines></p></div></article>
        <article className="sp-product sp-product-wide"><div className="sp-doras-visual" aria-hidden="true"><div className="sp-doras-orbit sp-orbit-one"/><div className="sp-doras-orbit sp-orbit-two"/><div className="sp-doras-core">N<span>·</span></div></div><div className="sp-product-copy"><div><h3>N-DORAS</h3></div><p><Lines>구축과 운영에서 만들어지는 정보를 연결하는 통합 관리 솔루션입니다. 데이터센터를 하나의 유기적인 시스템으로 바라봅니다.</Lines></p></div></article>
      </div>
    </section>
    <section className="sp-section sp-flywheel">
      <SectionHead title={<>데이터가 쌓일수록<br/>운영은 더 선명해집니다.</>} description="현장에서 얻은 인사이트를 다음 판단으로 연결합니다. 관찰과 분석, 실행이 다시 이어지는 순환을 만듭니다."/>
      <div className="sp-process-row"><div><h3>관찰</h3><p><Lines>현장을 살피고</Lines></p></div><div><h3>이해</h3><p><Lines>정보를 이해하고</Lines></p></div><div><h3>실행</h3><p><Lines>더 나은 선택을 하고</Lines></p></div><div><h3>학습</h3><p><Lines>다음 변화로 연결합니다</Lines></p></div></div>
    </section>
    <section className="sp-section sp-journey">
      <SectionHead title={<>변화의 모든 단계에<br/>함께합니다.</>} description="현장의 상황과 목표를 함께 살피며, 적용 가능한 다음 단계를 찾아갑니다."/>
      <div className="sp-journey-list"><div><strong>현장 이해</strong><p><Lines>운영 환경과 과제를 함께 정의합니다.</Lines></p></div><div><strong>시나리오 설계</strong><p><Lines>공간과 운영을 바라보는 시나리오를 검토합니다.</Lines></p></div><div><strong>실증과 적용</strong><p><Lines>현장에 맞는 접근 방식을 함께 확인합니다.</Lines></p></div><div><strong>연결과 개선</strong><p><Lines>경험과 데이터를 다음 운영에 연결합니다.</Lines></p></div></div>
    </section>
    <section className="sp-section sp-pilot" id="traction"><div className="sp-pilot-top"><span>2026.09 — 2027.03</span></div><div className="sp-pilot-content"><div><h2>냉각 전력 최적화를 위한<br/>공동 실증</h2><p><Lines>HD현대중공업과 데이터센터 냉각 전력 최적화를 위한 가능성을 함께 검토합니다.</Lines></p><a className="sp-text-link" href="/news/hd-hhi-cooling-pilot">공동 실증 소식 보기 <span aria-hidden="true">↗</span></a></div><div className="sp-pilot-mark" aria-hidden="true"/></div></section>
    <section className="sp-section sp-partners"><div><h2>더 나은 인프라는<br/>함께 만들어갑니다.</h2><p><Lines>현장의 전문성과 새로운 기술이 만나는 곳에서 변화를 시작합니다. 다양한 실증 및 파트너십을 기다립니다.</Lines></p><a href="/contact" className="sp-text-link">파트너십 문의 <span aria-hidden="true">↗</span></a></div></section>
    <InquiryCTA/>
  </div>;
}

export function CompanyPage() {
  return <div className="subpage sp-company">
    <PageIntro title={<>데이터센터의<br/><span>Null Space를</span><br/>정의합니다.</>} description={<>우리가 주목하는 것은 아직 발견되지 않은 가능성.<br/>공간의 잠재력을 현실의 변화로 연결합니다.</>} graphic/>
    <section className="sp-section sp-manifesto"><div><p className="sp-lead"><Lines>보이지 않는 공간에도<br/><em>기회는 존재합니다.</em></Lines></p><div className="sp-manifesto-body"><p><Lines>Null Space는 데이터센터의 공간과 운영 사이에 존재하는 가능성을 찾습니다. 복잡한 현장을 세밀하게 이해하고, 기술과 데이터를 통해 더 나은 방식으로 연결합니다.</Lines></p><p><Lines>우리는 새로운 질문에서 시작합니다. 당연하게 여겨온 방식을 다시 바라보고, 작지만 실질적인 변화를 만들어갑니다.</Lines></p></div></div></section>
    <section className="sp-section sp-team"><SectionHead title={<>서로 다른 관점이 모여<br/>하나의 문제를 풉니다.</>} description="현장의 문제를 깊이 이해하고, 기술과 디자인을 통해 가능한 해답을 찾아가는 팀입니다."/><div className="sp-founder"><div className="sp-founder-art" aria-hidden="true"><div className="sp-founder-lines"/></div><div className="sp-founder-copy"><h3>이승훈</h3><p className="sp-founder-role"><Lines>설립자</Lines></p><p><Lines>데이터센터의 복잡한 문제를 새로운 시선으로 바라봅니다. Null Space는 다양한 분야의 사람들이 함께 질문하고, 실험하고, 만들어가는 팀입니다.</Lines></p><a href="/careers" className="sp-text-link">함께할 기회 살펴보기 <span aria-hidden="true">↗</span></a></div></div></section>
    <section className="sp-section sp-playbook" id="playbook"><SectionHead title={<>우리는 이렇게<br/>앞으로 나아갑니다.</>} description="큰 변화는 현장을 이해하는 일에서 시작됩니다. 가설을 세우고 검증하며, 배움을 다음 단계로 연결합니다."/><div className="sp-playbook-grid"><article><h3>문제를 정의합니다.</h3><p><Lines>현장의 맥락을 이해하고, 정말 중요한 질문을 찾습니다.</Lines></p></article><article><h3>가능성을 탐색합니다.</h3><p><Lines>데이터와 다양한 시각으로 새로운 시나리오를 그립니다.</Lines></p></article><article><h3>함께 검증합니다.</h3><p><Lines>현실의 조건 안에서 작게 실험하고 배웁니다.</Lines></p></article><article><h3>다음으로 연결합니다.</h3><p><Lines>얻은 인사이트를 더 나은 시스템으로 발전시킵니다.</Lines></p></article></div></section>
    <section className="sp-section sp-company-links"><div><h2>더 나은 질문을<br/>함께 만들어갈 분.</h2><ArrowLink href="/careers">채용 페이지 보기</ArrowLink></div><div><h2>새로운 가능성을<br/>함께 발견할 파트너.</h2><ArrowLink href="/contact">문의하기</ArrowLink></div></section>
    <InquiryCTA heading={<>가능성을 현실로 만드는<br/>대화를 시작합니다.</>}/>
  </div>;
}

const newsItems = [
  { slug: "cfd-containment-200-racks", category: "기술 노트", title: "200랙 가상 레이아웃으로 살펴보는 컨테인먼트", description: "CFD 시뮬레이션을 통해 데이터센터 냉각 시나리오를 바라봅니다." },
  { slug: "hd-hhi-cooling-pilot", category: "공동 실증", title: "HD현대중공업과 냉각 전력 최적화 공동 실증", description: "데이터센터 냉각 운영의 새로운 가능성을 함께 탐색합니다." },
];

export function NewsPage() {
  return <div className="subpage sp-news">
    <PageIntro title={<>우리의 시선과<br/><span>새로운 소식.</span></>} description={<>Null Space가 만들어가는 변화와<br/>그 과정에서 발견한 인사이트를 전합니다.</>}/>
    <section className="sp-section sp-news-section"><div className="sp-list-heading"><h2>전체 소식</h2></div><div className="sp-news-list">{newsItems.map((item) => <a href={`/news/${item.slug}`} className="sp-news-item" key={item.slug}><div className="sp-news-category">{item.category}</div><div><h2>{item.title}</h2><p><Lines>{item.description}</Lines></p></div><span className="sp-news-arrow" aria-hidden="true">↗</span></a>)}</div></section>
    <InquiryCTA/>
  </div>;
}

function ArticleShell({ category, title, children }: { category: string; title: string; children: React.ReactNode }) {
  return <div className="subpage sp-detail"><section className="sp-detail-hero"><div className="sp-detail-meta"><a href="/news">← &nbsp; 뉴스 목록</a><span className="sp-detail-category">{category}</span></div><h1>{title}</h1></section><article className="sp-article">{children}</article><div className="sp-section sp-detail-back"><a className="sp-text-link" href="/news">← &nbsp; 전체 소식 보기</a></div><InquiryCTA/></div>;
}

export function NewsDetailPage() {
  const slug = typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean).pop() : "";
  if (slug === "cfd-containment-200-racks") return <ArticleShell category="기술 노트" title="200랙 가상 레이아웃으로 살펴보는 컨테인먼트"><p className="sp-article-lead"><Lines>공기의 흐름을 이해하는 것에서 더 나은 데이터센터를 향한 질문이 시작됩니다.</Lines></p><ScenarioGraphic/><h2>가상의 공간에서 시작하는 질문</h2><p><Lines>데이터센터의 냉각 환경은 랙 배치, 공기 흐름, 공간의 형태 등 여러 요소와 연결됩니다. 컨테인먼트는 차가운 공기와 따뜻한 공기의 흐름을 구분해 냉각 환경을 살펴보는 한 가지 접근입니다.</Lines></p><p><Lines>Scenario Lab은 200랙 가상 레이아웃을 바탕으로 다양한 조건을 검토하는 CFD 데모입니다. 현장의 복잡한 상황을 이해하기 위한 출발점으로, 시나리오를 시각적으로 살펴봅니다.</Lines></p><div className="sp-article-callout"><strong>안내</strong><p><Lines>이 데모는 가상 레이아웃에 기반합니다. 아직 현장 실측으로 검증되지 않았으며, 특정한 성능이나 절감 효과를 의미하지 않습니다.</Lines></p></div><h2>시뮬레이션에서 현장으로</h2><p><Lines>실제 적용을 위해서는 현장 조건과 데이터에 기반한 추가적인 검토와 검증이 필요합니다. Null Space는 가설을 관찰과 실증으로 연결하는 과정을 중요하게 생각합니다.</Lines></p><a className="sp-text-link" href="/solution">솔루션 살펴보기 <span aria-hidden="true">↗</span></a></ArticleShell>;
  if (slug === "hd-hhi-cooling-pilot") return <ArticleShell category="공동 실증" title="HD현대중공업과 냉각 전력 최적화 공동 실증"><p className="sp-article-lead"><Lines>데이터센터 냉각 전력 최적화의 가능성을 현장에서 함께 살펴봅니다.</Lines></p><div className="sp-article-feature"><span>공동 실증 · 2026.09 — 2027.03</span><strong>HD HYUNDAI<br/>HEAVY INDUSTRIES <span>×</span><br/>NULL SPACE</strong></div><h2>함께 만드는 다음 단계</h2><p><Lines>Null Space는 HD현대중공업과 데이터센터 냉각 전력 최적화를 위한 공동 실증을 진행합니다. 실증 기간은 2026년 9월부터 2027년 3월까지입니다.</Lines></p><p><Lines>이번 협력은 현장의 조건을 바탕으로 냉각 운영을 더 깊이 이해하고, 적용 가능한 방향을 함께 탐색하는 과정입니다. 구체적인 결과는 실증과 검토를 통해 확인해야 합니다.</Lines></p><div className="sp-article-callout"><strong>실증 기간</strong><p><Lines>2026.09 — 2027.03<br/>데이터센터 냉각 전력 최적화 공동 실증</Lines></p></div><h2>현장과 기술의 연결</h2><p><Lines>서로 다른 전문성이 만날 때 새로운 가능성이 열립니다. Null Space는 현장의 문제를 함께 정의하고 검증하는 협력을 이어갑니다.</Lines></p><a className="sp-text-link" href="/contact">협력 문의하기 <span aria-hidden="true">↗</span></a></ArticleShell>;
  return <div className="subpage"><section className="sp-empty"><h1>소식을 찾을 수 없습니다.</h1><ArrowLink href="/news">뉴스 목록으로</ArrowLink></section></div>;
}

const careers = [
  { slug: "ai-engineer", title: "AI Engineer", deadline: "2026.9.18", category: "엔지니어링", overview: "데이터와 모델을 통해 복잡한 현장의 문제를 탐색하는 역할입니다." },
  { slug: "founding-designer", title: "Founding Designer", deadline: "2026.9.15", category: "디자인", overview: "제품과 브랜드의 경험을 일관된 시각으로 만들어가는 역할입니다." },
];

export function CareersPage() {
  return <div className="subpage sp-careers"><PageIntro title={<>좋은 질문을<br/><span>함께 만드는 사람들.</span></>} description={<>아직 정답이 없는 문제 앞에서, 함께 탐색하고<br/>배우며 더 나은 인프라를 만들어갑니다.</>} graphic/>
    <section className="sp-section sp-career-open"><div><h2>지금은 공개 채용 중인<br/>포지션이 없습니다.</h2></div><div><p><Lines>Null Space와 함께하는 일에 관심이 있으신가요? 궁금한 점이나 협업 제안은 이메일로 편하게 보내주세요.</Lines></p><a className="sp-text-link" href={`mailto:${email}`}>{email} <span aria-hidden="true">↗</span></a></div></section>
    <section className="sp-section sp-career-archive"><div className="sp-list-heading"><div><h2>지난 채용 공고</h2></div></div><div className="sp-archive-list">{careers.map((career) => <details className="sp-archive-item" key={career.slug}><summary><span className="sp-archive-category">{career.category}</span><strong>{career.title}</strong><span className="sp-closed">마감</span><span className="sp-summary-plus" aria-hidden="true">+</span></summary><div className="sp-archive-content"><p><Lines>{career.overview}</Lines></p><p><Lines>마감일 {career.deadline}</Lines></p><a className="sp-text-link" href={`/careers/${career.slug}`}>공고 자세히 보기 <span aria-hidden="true">↗</span></a></div></details>)}</div></section><InquiryCTA heading={<>함께할 다음 기회를<br/>기다립니다.</>}/></div>;
}

export function CareersDetailPage() {
  const slug = typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean).pop() : "";
  const career = careers.find((item) => item.slug === slug);
  if (!career) return <div className="subpage"><section className="sp-empty"><h1>공고를 찾을 수 없습니다.</h1><ArrowLink href="/careers">채용 목록으로</ArrowLink></section></div>;
  return <div className="subpage sp-job-detail"><section className="sp-detail-hero"><div className="sp-detail-meta"><a href="/careers">← &nbsp; 채용 목록</a><span className="sp-detail-category">{career.category}</span></div><span className="sp-job-closed">마감</span><h1>{career.title}</h1><div className="sp-detail-rule"><span>마감일 {career.deadline}</span></div></section><article className="sp-article"><p className="sp-article-lead"><Lines>{career.overview}</Lines></p><div className="sp-article-callout"><strong>채용 마감</strong><p><Lines>이 공고는 {career.deadline}에 마감되었습니다. 현재 지원을 받지 않습니다.</Lines></p></div><h2>역할에 관하여</h2><p><Lines>{career.slug === "ai-engineer" ? "데이터, 소프트웨어, 그리고 현장의 문제를 연결하는 일에 관심을 둡니다. 다양한 관점에서 문제를 이해하고 실험을 통해 가능성을 탐색합니다." : "복잡한 문제를 명확한 경험으로 바꾸는 일에 관심을 둡니다. 제품과 브랜드 전반에 걸쳐 일관되고 유용한 경험을 고민합니다."}</Lines></p><p className="sp-muted"><Lines>위 내용은 역할에 대한 일반적인 소개이며, 현재 진행 중인 채용 안내가 아닙니다.</Lines></p><h2>Null Space와의 다음 만남</h2><p><Lines>팀이나 향후 기회에 대해 궁금하시다면 이메일로 연락해 주세요.</Lines></p><a className="sp-text-link" href={`mailto:${email}`}>{email} <span aria-hidden="true">↗</span></a></article><div className="sp-section sp-detail-back"><a className="sp-text-link" href="/careers">← &nbsp; 전체 채용 공고 보기</a></div><InquiryCTA/></div>;
}

const faqs = [
  { q: "어떤 문의를 할 수 있나요?", a: "솔루션 도입과 공동 실증, 투자 및 IR 자료, 파트너십 등 Null Space에 관한 문의를 보내주실 수 있습니다." },
  { q: "도입이나 실증은 어떻게 시작하나요?", a: "현재의 운영 환경과 관심 있는 과제를 간단히 알려주세요. 문의 내용을 바탕으로 함께 논의할 수 있는 다음 단계를 살펴봅니다." },
  { q: "Scenario Lab은 실제 현장 데이터인가요?", a: "Scenario Lab은 200랙 가상 레이아웃을 기반으로 한 CFD 데모입니다. 아직 현장 실측 검증 전이며 실제 성능을 보장하지 않습니다." },
  { q: "투자 및 IR 자료를 요청할 수 있나요?", a: "문의 유형에서 ‘투자·IR 자료’를 선택하고 소속과 요청 내용을 남겨주세요." },
  { q: "파트너십이나 공동 연구도 가능한가요?", a: "네. 현장의 과제와 협력 아이디어를 함께 나눌 파트너를 기다립니다. 관심 분야를 알려주세요." },
  { q: "문의 양식은 어떻게 전달되나요?", a: "필수 항목을 입력하면 이메일 작성창이 열립니다. 내용을 확인한 뒤 이메일 앱에서 직접 보내주셔야 합니다." },
];

export function ContactPage() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = ["name", "company", "message"];
    for (const fieldName of fields) {
      const field = form.elements.namedItem(fieldName) as HTMLInputElement | HTMLTextAreaElement | null;
      if (field) field.setCustomValidity(field.value.trim() ? "" : "내용을 입력해 주세요.");
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const get = (name: string) => String(data.get(name) || "").trim();
    const subject = `[Null Space 문의] ${get("type")}`;
    const body = `이름: ${get("name")}\n회사/기관: ${get("company")}\n이메일: ${get("email")}\n전화번호: ${get("phone") || "미입력"}\n문의 유형: ${get("type")}\n개인정보 제공 동의: 동의\n\n문의 내용:\n${get("message")}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  function clearCustomValidity(event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) { event.currentTarget.setCustomValidity(""); }
  return <div className="subpage sp-contact"><PageIntro title={<>어떤 가능성을<br/><span>찾고 계신가요?</span></>} description={<>도입과 실증부터 새로운 협업까지.<br/>Null Space와 대화를 시작해 보세요.</>}/>
    <section className="sp-section sp-contact-layout"><div className="sp-contact-side"><h2>자주 묻는<br/>질문들.</h2><p><Lines>문의하시기 전, 궁금할 수 있는 내용을 모았습니다.</Lines></p><div className="sp-faq-list">{faqs.map((faq) => <details className="sp-faq" key={faq.q}><summary><strong>{faq.q}</strong><span className="sp-summary-plus" aria-hidden="true">+</span></summary><p><Lines>{faq.a}</Lines></p></details>)}</div></div>
      <div className="sp-form-panel"><h2>무엇을<br/>도와드릴까요?</h2><p className="sp-form-intro"><Lines>아래 내용을 남겨주시면 이메일 작성창이 열립니다. 내용을 확인하고 직접 보내주세요.</Lines></p><form onSubmit={handleSubmit} className="sp-contact-form">
        <div className="sp-form-row"><label>이름 <span>*</span><input name="name" autoComplete="name" required onInput={clearCustomValidity} placeholder="이름을 입력해 주세요"/></label><label>회사 / 기관 <span>*</span><input name="company" autoComplete="organization" required onInput={clearCustomValidity} placeholder="회사 또는 기관명"/></label></div>
        <div className="sp-form-row"><label>이메일 <span>*</span><input name="email" type="email" autoComplete="email" required placeholder="name@company.com"/></label><label>전화번호 <small>선택</small><input name="phone" type="tel" autoComplete="tel" placeholder="연락 가능한 번호"/></label></div>
        <label>문의 유형 <span>*</span><select name="type" defaultValue="" required><option value="" disabled>문의 유형을 선택해 주세요</option><option>도입·실증</option><option>투자·IR 자료</option><option>파트너십</option><option>기타</option></select></label>
        <label>문의 내용 <span>*</span><textarea name="message" required onInput={clearCustomValidity} rows={6} placeholder="문의 내용을 자유롭게 남겨주세요."/></label>
        <div className="sp-privacy"><p><Lines>입력하신 정보는 이메일 초안 작성에 사용됩니다. 이 웹사이트에서 문의가 자동 저장되거나 전송되지는 않습니다.</Lines></p><label className="sp-check"><input type="checkbox" name="consent" required/><span>문의 처리를 위한 개인정보 제공에 동의합니다. <b>*</b></span></label></div>
        <button type="submit" className="sp-form-submit"><span>이메일 작성하기</span><span aria-hidden="true">↗</span></button><p className="sp-form-note"><Lines>이메일 앱에서 내용을 확인한 후 직접 전송해 주세요.</Lines></p>
      </form></div></section><section className="sp-contact-direct"><div><span>메일로 직접 연락하기</span><a href={`mailto:${email}`}>{email} <span aria-hidden="true">↗</span></a></div></section></div>;
}
