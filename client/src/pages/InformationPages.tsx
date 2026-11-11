import { useEffect, useRef, useState, type ReactNode } from "react";
import ScenarioLab from "../components/ScenarioLab";
import "./InformationPages.css";
import { Lines } from "../components/Lines";

type Language = "ko" | "en";
type Page = "definition" | "products" | "n-mover" | "n-prover" | "n-doras" | "company" | "team" | "partners";
type ProductPage = "n-mover" | "n-prover" | "n-doras";
type Localized = { ko: string; en: string };

const t = (value: Localized, lang: Language) => value[lang];
const pathFor = (path: string, lang: Language) => `${lang === "en" ? "/en" : ""}${path}`;

const labels = {
  solution: { ko: "솔루션", en: "Solution" },
  definition: { ko: "솔루션 정의", en: "Definition" },
  products: { ko: "제품", en: "Product" },
  company: { ko: "회사", en: "Company" },
  team: { ko: "팀", en: "Team" },
  partners: { ko: "파트너", en: "Partners" },
  contact: { ko: "문의하기", en: "Start a conversation" },
  allProducts: { ko: "전체 제품 보기", en: "View all products" },
  explore: { ko: "자세히 보기", en: "Explore" },
};

const products: Record<ProductPage, {
  name: string;
  category: Localized;
  description: Localized;
  headline: Localized;
  body: Localized;
  image?: string;
  imageAlt?: Localized;
  perspectives: { title: Localized; text: Localized }[];
}> = {
  "n-mover": {
    name: "N-Mover",
    category: { ko: "구축과 이동", en: "Build and movement" },
    description: { ko: "랙 구축과 이동 과정의 복잡함을 줄이기 위한 솔루션입니다.", en: "A solution for navigating the complexity of rack installation and movement." },
    headline: { ko: "공간의 변화를 더 체계적으로 준비합니다.", en: "Prepare for changes in the space more systematically." },
    body: { ko: "N-Mover는 데이터센터의 랙 구축과 이동 과정에 주목합니다. 물리적인 변화를 공간과 운영의 맥락에서 함께 살펴보며, 더 나은 작업의 흐름을 고민합니다.", en: "N-Mover focuses on rack installation and movement in data centers. It considers physical change in the context of the space and its operations, toward a more considered workflow." },
    image: "/images/n-mover.jpg",
    imageAlt: { ko: "데이터센터 랙 이동을 위한 N-Mover", en: "N-Mover for moving data center racks" },
    perspectives: [
      { title: { ko: "랙 구축", en: "Rack installation" }, text: { ko: "공간에 새로운 랙이 더해지는 과정을 살펴봅니다.", en: "Consider the process of adding racks to a space." } },
      { title: { ko: "물리적 이동", en: "Physical movement" }, text: { ko: "랙이 이동할 때 필요한 작업과 공간의 관계에 주목합니다.", en: "Focus on the relationship between the work and space involved in moving racks." } },
      { title: { ko: "다음 단계", en: "The next step" }, text: { ko: "구축의 변화를 이후의 운영과 연결해 생각합니다.", en: "Consider how changes during installation connect to later operations." } },
    ],
  },
  "n-prover": {
    name: "N-Prover",
    category: { ko: "공간의 관찰", en: "Observing space" },
    description: { ko: "운영 현장의 상태를 살피고 필요한 정보를 연결하는 솔루션입니다.", en: "A solution for observing conditions in the operating environment and connecting relevant information." },
    headline: { ko: "운영의 공간을 더 가까이 살펴봅니다.", en: "Take a closer look at the space in operation." },
    body: { ko: "N-Prover는 데이터센터 공간의 측정과 운영 현장의 관찰에 주목합니다. 공간을 더 깊이 이해하고 다음 판단에 필요한 정보를 살피는 접근입니다.", en: "N-Prover focuses on measuring data center space and observing the operating environment. It is an approach to understanding the space more deeply and considering information for the next decision." },
    image: "/images/n-prover.jpg",
    imageAlt: { ko: "데이터센터 공간을 측정하는 N-Prover", en: "N-Prover for measuring data center space" },
    perspectives: [
      { title: { ko: "공간 측정", en: "Spatial measurement" }, text: { ko: "현장의 공간을 살펴보는 것에서 시작합니다.", en: "Start by examining the space in the field." } },
      { title: { ko: "운영의 맥락", en: "Operational context" }, text: { ko: "측정과 관찰을 운영 환경의 맥락에서 바라봅니다.", en: "Consider measurements and observations in their operational context." } },
      { title: { ko: "정보의 연결", en: "Connected information" }, text: { ko: "현장을 이해하는 데 필요한 정보를 함께 생각합니다.", en: "Bring together the information needed to understand the site." } },
    ],
  },
  "n-doras": {
    name: "N-DORAS",
    category: { ko: "정보의 연결", en: "Connecting information" },
    description: { ko: "구축과 운영에서 만들어지는 정보를 연결하는 통합 관리 솔루션입니다.", en: "An integrated management solution connecting information from installation and operations." },
    headline: { ko: "흩어진 정보를 하나의 흐름으로 바라봅니다.", en: "See separate information as part of one flow." },
    body: { ko: "N-DORAS는 데이터센터의 구축과 운영에서 만들어지는 정보를 연결하는 접근입니다. 각각의 과제를 분리하지 않고, 공간과 운영을 하나의 유기적인 시스템으로 바라봅니다.", en: "N-DORAS is an approach to connecting information generated through data center installation and operations. Rather than treating challenges in isolation, it considers space and operations as an interconnected system." },
    perspectives: [
      { title: { ko: "구축", en: "Installation" }, text: { ko: "물리적인 변화와 관련된 정보를 살펴봅니다.", en: "Consider information related to physical changes." } },
      { title: { ko: "운영", en: "Operations" }, text: { ko: "운영 현장에서 만들어지는 정보를 함께 바라봅니다.", en: "Bring information from the operating environment into view." } },
      { title: { ko: "연결", en: "Connection" }, text: { ko: "각 단계의 맥락을 다음 판단으로 이어갑니다.", en: "Carry context from each stage into the next decision." } },
    ],
  },
};

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span className="info-arrow" aria-hidden="true">{diagonal ? "↗" : "→"}</span>;
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="info-text-link" href={href}><span>{children}</span><Arrow diagonal /></a>;
}

function Wireframe({ variant = "space" }: { variant?: "space" | "orbit" }) {
  return <div className={`info-wireframe info-wireframe-${variant}`} aria-hidden="true">
    <div className="info-wireframe-grid" />
    <div className="info-wireframe-ring info-ring-one" />
    <div className="info-wireframe-ring info-ring-two" />
    <div className="info-wireframe-ring info-ring-three" />
    <span className="info-wireframe-cross">+</span>
    {variant === "orbit" && <span className="info-wireframe-mark">N<span>·</span></span>}
  </div>;
}

function Breadcrumb({ page, lang }: { page: Page; lang: Language }) {
  const companyPage = page === "company" || page === "team" || page === "partners";
  const crumbs: { text: string; href?: string }[] = companyPage
    ? page === "company"
      ? [{ text: t(labels.company, lang) }]
      : [{ text: t(labels.company, lang), href: pathFor("/company", lang) }, { text: t(labels[page], lang) }]
    : page === "definition"
      ? [{ text: t(labels.solution, lang), href: pathFor("/solution", lang) }, { text: t(labels.definition, lang) }]
      : page === "products"
        ? [{ text: t(labels.solution, lang), href: pathFor("/solution", lang) }, { text: t(labels.products, lang) }]
        : [{ text: t(labels.solution, lang), href: pathFor("/solution", lang) }, { text: t(labels.products, lang), href: pathFor("/solution/product", lang) }, { text: products[page].name }];

  return <nav className="info-breadcrumb" aria-label={lang === "ko" ? "현재 위치" : "Breadcrumb"}>
    <ol>{crumbs.map((crumb, index) => <li key={`${crumb.text}-${index}`}>
      {index > 0 && <span className="info-crumb-divider" aria-hidden="true">/</span>}
      {crumb.href ? <a href={crumb.href}>{crumb.text}</a> : <span aria-current="page">{crumb.text}</span>}
    </li>)}</ol>
  </nav>;
}

function Hero({ title, muted, description, variant = "space" }: {
  title: string; muted?: string; description: string; variant?: "space" | "orbit";
}) {
  return <section className="info-hero">
    <div className="info-hero-copy">
      <h1>{title}{muted && <><br /><span>{muted}</span></>}</h1>
      <p className="info-hero-description"><Lines>{description}</Lines></p>
    </div>
    <Wireframe variant={variant} />
  </section>;
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return <div className="info-section-heading">
    <div><h2>{title}</h2></div>
    {description && <p><Lines>{description}</Lines></p>}
  </div>;
}

type TopicIcon = "space" | "flow" | "info";
/** Small geometric marks for the definition topics: a cube (space), stacked waves (flow), linked nodes (information). */
function TopicGlyph({ icon }: { icon: TopicIcon }) {
  return <svg className="info-topic-icon" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
    {icon === "space" && <><path d="M16 3 28 9.5v13L16 29 4 22.5v-13Z" /><path d="M4 9.5 16 16l12-6.5M16 16v13" /></>}
    {icon === "flow" && <><path d="M3 10c4.3-4 8.7 4 13 0s8.7-4 13 0" /><path d="M3 16c4.3-4 8.7 4 13 0s8.7-4 13 0" /><path d="M3 22c4.3-4 8.7 4 13 0s8.7-4 13 0" /></>}
    {icon === "info" && <><circle cx="16" cy="6" r="3" /><circle cx="6" cy="25" r="3" /><circle cx="26" cy="25" r="3" /><path d="M14.5 8.6 7.5 22.4M17.5 8.6l7 13.8M9 25h14" /></>}
  </svg>;
}

function TopicCards({ items, lang }: { items: { title: Localized; text: Localized; icon?: TopicIcon }[]; lang: Language }) {
  return <div className="info-topic-grid">{items.map((item) => <article className="info-topic-card" key={t(item.title, lang)}>
    <h3 className={item.icon ? "info-topic-title-icon" : undefined}>{item.icon && <TopicGlyph icon={item.icon} />}{t(item.title, lang)}</h3><p><Lines>{t(item.text, lang)}</Lines></p>
  </article>)}</div>;
}

function NextPanel({ title, description, href, linkText }: { title: string; description?: string; href: string; linkText: string }) {
  return <section className="info-next">
    <div><h2>{title}</h2>{description && <p><Lines>{description}</Lines></p>}</div>
    <a className="info-button" href={href}><span>{linkText}</span><Arrow diagonal /></a>
  </section>;
}

const definitionTopics = [
  { icon: "space" as const, title: { ko: "공간", en: "Space" }, text: { ko: "밀도가 높아질수록 랙 배치와 이동을 더 세심하게 계획해야 합니다.", en: "As density increases, rack placement and movement call for more careful planning." } },
  { icon: "flow" as const, title: { ko: "흐름", en: "Flow" }, text: { ko: "공기의 흐름과 온도 차이는 공간 전체의 운영에 영향을 줍니다.", en: "Airflow and temperature differences affect operations across the space." } },
  { icon: "info" as const, title: { ko: "정보", en: "Information" }, text: { ko: "구축과 운영의 정보를 연결해 판단의 바탕을 만듭니다.", en: "Connecting information from installation and operations provides context for decisions." } },
];

function DefinitionPage({ lang }: { lang: Language }) {
  return <>
    <Hero title={lang === "ko" ? "보이지 않는 공간을" : "See the space"} muted={lang === "ko" ? "새롭게 바라봅니다." : "beyond the visible."} description={lang === "ko" ? "데이터센터의 공간과 운영을 연결해, 더 나은 판단을 위한 시야를 만듭니다." : "Connecting data center space and operations to create a clearer view for better decisions."} />
    <section className="info-section">
      <SectionHeading title={lang === "ko" ? "효율은 공간을 이해하는 것에서 시작됩니다." : "Understanding the space is where efficiency begins."} description={lang === "ko" ? "복잡해지는 인프라 속에서 공간, 냉각, 운영은 서로 연결되어 있습니다. 보이지 않는 비효율을 이해하는 것이 변화의 첫걸음입니다." : "In increasingly complex infrastructure, space, cooling, and operations are interconnected. Understanding what is not immediately visible is a first step toward change."} />
      <TopicCards items={definitionTopics} lang={lang} />
    </section>
    <section className="info-section info-split-section">
      <div><h2>{lang === "ko" ? "측정에서 이해로, 이해에서 다음 선택으로." : "From measurement to understanding, and on to the next decision."}</h2></div>
      <div className="info-prose"><p><Lines>{lang === "ko" ? "현장을 관찰하고 공간과 정보를 연결합니다. 다양한 배치와 냉각 시나리오를 가상의 공간에서 살펴보며, 현장의 조건에 맞는 다음 단계를 탐색합니다." : "We observe the field and connect space with information. By exploring layout and cooling scenarios in a virtual space, we look for next steps suited to conditions on site."}</Lines></p><p><Lines>{lang === "ko" ? "시나리오는 이해를 돕기 위한 예시이며 계산 결과가 아니고 아직 현장 실측으로 검증되지 않았습니다. 실제 적용에는 현장 조건에 기반한 추가 검토와 검증이 필요합니다." : "The scenarios are illustrative, not calculated results, and have not yet been validated against field measurements. Real-world application requires further review and validation against site conditions."}</Lines></p><TextLink href={pathFor("/solution/product", lang)}>{lang === "ko" ? "제품 살펴보기" : "Explore the products"}</TextLink></div>
    </section>
    <ScenarioLab lang={lang} />
    <NextPanel title={lang === "ko" ? "공간의 가능성을 함께 살펴봅니다." : "Let's explore the possibilities in your space."} href={pathFor("/contact", lang)} linkText={t(labels.contact, lang)} />
  </>;
}

function ProductArt({ id, lang }: { id: ProductPage; lang: Language }) {
  const product = products[id];
  return <div className={`info-product-art info-product-art-${id}`}>
    {product.image ? <img src={product.image} alt={t(product.imageAlt!, lang)} loading="lazy" /> : <Wireframe variant="orbit" />}
  </div>;
}

function ProductsPage({ lang }: { lang: Language }) {
  const ids: ProductPage[] = ["n-mover", "n-prover", "n-doras"];
  return <>
    <Hero title={lang === "ko" ? "구축에서 운영까지," : "From installation"} muted={lang === "ko" ? "하나의 흐름으로." : "to operations."} description={lang === "ko" ? "물리적 작업과 공간의 정보를 연결해 데이터센터를 바라봅니다." : "A connected view of the data center, from physical work to information about the space."} variant="orbit" />
    <section className="info-section">
      <SectionHeading title={lang === "ko" ? "각 단계의 과제를 연결합니다." : "Connecting the challenges at each stage."} description={lang === "ko" ? "각 제품이 바라보는 영역을 살펴보세요." : "Explore the focus of each product."} />
      <div className="info-product-grid">{ids.map((id) => {
        const product = products[id];
        return <a className="info-product-card" href={pathFor(`/solution/product/${id}`, lang)} key={id}>
          <ProductArt id={id} lang={lang} />
          <div className="info-product-card-copy"><div className="info-product-meta"><Arrow diagonal /></div><h3>{product.name}</h3><p><Lines>{t(product.description, lang)}</Lines></p><span className="info-card-link">{t(labels.explore, lang)} <Arrow /></span></div>
        </a>;
      })}</div>
    </section>
    <NextPanel title={lang === "ko" ? "우리의 접근을 더 알아보세요." : "Learn more about our approach."} href={pathFor("/solution", lang)} linkText={t(labels.definition, lang)} />
  </>;
}

function ProductDetailPage({ id, lang }: { id: ProductPage; lang: Language }) {
  const product = products[id];
  return <>
    <section className="info-product-hero">
      <div className="info-product-hero-copy"><h1>{product.name}</h1><p><Lines>{t(product.description, lang)}</Lines></p><TextLink href={pathFor("/solution/product", lang)}>{t(labels.allProducts, lang)}</TextLink></div>
      <ProductArt id={id} lang={lang} />
    </section>
    <section className="info-section info-split-section">
      <div><h2>{t(product.headline, lang)}</h2></div>
      <div className="info-prose"><p><Lines>{t(product.body, lang)}</Lines></p></div>
    </section>
    <section className="info-section info-section-soft">
      <SectionHeading title={lang === "ko" ? "이렇게 바라봅니다." : "A closer perspective."} />
      <TopicCards items={product.perspectives} lang={lang} />
    </section>
    <NextPanel title={lang === "ko" ? "현장의 다음 단계를 함께 이야기합니다." : "Let's talk about the next step for your site."} href={pathFor("/contact", lang)} linkText={t(labels.contact, lang)} />
  </>;
}

function CompanyPage({ lang }: { lang: Language }) {
  const links = [
    { href: "/company/team", number: "01", title: t(labels.team, lang), description: lang === "ko" ? "문제를 함께 정의하고 가능한 해답을 찾는 사람들." : "The people defining problems and exploring possible answers together." },
    { href: "/company/partners", number: "02", title: t(labels.partners, lang), description: lang === "ko" ? "현장과 기술을 연결하며 함께 가능성을 탐색합니다." : "Exploring possibilities together by connecting field experience and technology." },
  ];
  return <>
    <Hero title={lang === "ko" ? "데이터센터의" : "Defining the"} muted={lang === "ko" ? "Null Space를 정의합니다." : "Null Space in data centers."} description={lang === "ko" ? "아직 발견되지 않은 가능성을 찾고, 공간의 잠재력을 현실의 변화로 연결합니다." : "We look for possibilities yet to be discovered, connecting the potential of space with real-world change."} />
    <section className="info-section info-split-section">
      <div><h2>{lang === "ko" ? "보이지 않는 공간에도 기회는 존재합니다." : "Opportunity exists in the spaces we do not yet see."}</h2></div>
      <div className="info-prose"><p><Lines>{lang === "ko" ? "NULL SPACE는 데이터센터의 공간과 운영 사이에 존재하는 가능성을 찾습니다. 복잡한 현장을 이해하고 기술과 데이터를 통해 더 나은 방식으로 연결합니다." : "NULL SPACE looks for possibilities between data center space and operations. We seek to understand complex environments and connect them in better ways through technology and data."}</Lines></p></div>
    </section>
    <section className="info-section info-section-soft">
      <SectionHeading title={lang === "ko" ? "NULL SPACE를 만나보세요." : "Get to know NULL SPACE."} />
      <div className="info-company-links">{links.map(link => <a href={pathFor(link.href, lang)} className="info-company-link" key={link.href}><div><Arrow diagonal /></div><h3>{link.title}</h3><p><Lines>{link.description}</Lines></p></a>)}</div>
    </section>
  </>;
}

/* 왼쪽부터 이영균, 이영훈, 이승훈(가운데), 전세영, 장시아 */
const TEAM = [
  { ko: "이영균", en: "Younggyun Lee", img: "lee-younggyun", role: "Software Engineer" },
  { ko: "이영훈", en: "Younghoon Lee", img: "lee-younghoon", role: "CTO" },
  { ko: "이승훈", en: "Seunghoon Lee", img: "lee-seunghoon", role: "CEO" },
  { ko: "전세영", en: "Seyoung Jeon", img: "jeon-seyoung", role: "AI Engineer" },
  { ko: "장시아", en: "Sia Jang", img: "jang-sia", role: "Product Designer" },
];

const PLAYBOOK = [
  { title: { ko: "현장 조사", en: "Site survey" }, month: { ko: "1개월차", en: "Month 1" }, text: { ko: "센터 도면과 설비 목록을 받고 현장을 함께 봅니다. 측정 범위, 비교 기준, 성공 기준을 문서로 합의합니다.", en: "We review floor plans and equipment lists and walk the site together. Scope, baseline and success criteria are agreed in writing." }, out: { ko: "측정 계획서, 평가 기준", en: "Measurement plan, evaluation criteria" } },
  { title: { ko: "진단 측정", en: "Diagnostic measurement" }, month: { ko: "2개월차", en: "Month 2" }, text: { ko: "로봇이 같은 경로를 반복 측정해 현재 상태를 기록합니다. 운영 중인 설정은 건드리지 않습니다.", en: "The robot measures the same route repeatedly to record the current state. Live settings stay untouched." }, out: { ko: "위치별 온도, 기류 지도와 우선 진단 대상", en: "Temperature by location, airflow map and priority targets" } },
  { title: { ko: "원인 분석과 개선안", en: "Root cause and options" }, month: { ko: "3개월차", en: "Month 3" }, text: { ko: "측정값으로 트윈을 맞추고 열유동 해석으로 원인을 가립니다. 조치 후보를 해석으로 먼저 비교해 위험이 낮은 것부터 제안합니다.", en: "We calibrate the twin with measurements and find causes through thermal-flow analysis. Options are compared in simulation first, lowest risk first." }, out: { ko: "진단 근거, 조치 후보별 예상 효과", en: "Diagnostic evidence, expected effect per option" } },
  { title: { ko: "적용과 전후 비교", en: "Apply and compare" }, month: { ko: "4개월차", en: "Month 4" }, text: { ko: "운영팀과 합의한 범위만 바꿉니다. 바꾼 뒤 같은 경로로 다시 재서 전후를 비교합니다.", en: "Only the scope agreed with the operations team changes. We re-measure the same route to compare before and after." }, out: { ko: "냉각 상태와 전력 변화 검증 결과", en: "Verified cooling state and power change" } },
  { title: { ko: "검증 보고와 확산", en: "Report and scale" }, month: { ko: "5개월차", en: "Month 5" }, text: { ko: "결과와 유지 조건을 정리하고, 다른 구역과 센터로 넓힐 범위를 제안합니다.", en: "We document results and conditions to sustain them, and propose how to extend to other zones and sites." }, out: { ko: "검증 보고서, 운영 권고안", en: "Validation report, operating recommendations" } },
];

function Playbook({ lang }: { lang: Language }) {
  return <section className="info-section info-playbook" id="playbook">
    <SectionHeading title={lang === "ko" ? "이렇게 일합니다." : "How we work."} description={lang === "ko" ? "도입은 큰 계약부터 시작하지 않습니다. 작은 범위에서 재고, 고치고, 숫자로 확인한 뒤 넓힙니다. HD현대중공업 실증도 같은 순서로 진행합니다." : "Adoption doesn't start with a big contract. We measure, fix and confirm with numbers in a small scope, then expand. Our HD Hyundai Heavy Industries pilot follows the same order."} />
    <ol className="info-steps">{PLAYBOOK.map((s, i) => <li key={s.title.en} className="info-step">
      <span className="info-step-num">{String(i + 1).padStart(2, "0")}</span>
      <div className="info-step-body">
        <h3>{t(s.title, lang)}<span className="info-step-month">{t(s.month, lang)}</span></h3>
        <p><Lines>{t(s.text, lang)}</Lines></p>
        <p className="info-step-out"><strong>{lang === "ko" ? "결과물" : "Deliverables"}</strong>{t(s.out, lang)}</p>
      </div>
    </li>)}</ol>
  </section>;
}

/** 다섯 장의 카드가 가운데에 겹쳐 있다가, 화면에 들어오면 양옆으로 펼쳐진다 */
function TeamFan({ lang }: { lang: Language }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOpen(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`info-team-fan ${open ? "is-open" : ""}`}>
    {TEAM.map((m, i) => <figure key={m.img} className="info-team-card" style={{ "--d": 2 - i, zIndex: 10 - Math.abs(2 - i) } as React.CSSProperties}>
      <img src={`/images/team-${m.img}.webp`} alt={lang === "ko" ? m.ko : m.en} loading="lazy" />
      <figcaption><strong>{lang === "ko" ? m.ko : m.en}</strong><span>{m.role}</span></figcaption>
    </figure>)}
  </div>;
}

function TeamPage({ lang }: { lang: Language }) {
  const working = [
    { title: { ko: "문제를 정의합니다", en: "Define the problem" }, text: { ko: "현장의 맥락을 이해하고 중요한 질문을 찾습니다.", en: "Understand the context and find the important questions." } },
    { title: { ko: "가능성을 탐색합니다", en: "Explore possibilities" }, text: { ko: "데이터와 다양한 시각으로 새로운 시나리오를 그립니다.", en: "Explore new scenarios through data and different perspectives." } },
    { title: { ko: "함께 검증합니다", en: "Validate together" }, text: { ko: "현실의 조건 안에서 작게 실험하고 배웁니다.", en: "Experiment and learn within real-world conditions." } },
  ];
  return <>
    <Hero title={lang === "ko" ? "서로 다른 관점이 모여" : "Different perspectives,"} muted={lang === "ko" ? "하나의 문제를 풉니다." : "shared questions."} description={lang === "ko" ? "현장의 문제를 깊이 이해하고 기술과 디자인으로 가능한 해답을 찾아가는 팀입니다." : "A team working to understand real-world problems and explore possible answers through technology and design."} />
    <section className="info-section info-team-section">
      <TeamFan lang={lang} />
      <p className="info-team-note"><Lines>{lang === "ko" ? "데이터센터의 복잡한 문제를 새로운 시선으로 바라봅니다. NULL SPACE는 다양한 분야의 사람들이 함께 질문하고, 실험하고, 만들어가는 팀입니다." : "Looking at complex data center challenges from a new perspective. NULL SPACE is a team where people from different fields question, experiment, and build together."}</Lines></p>
    </section>
    <Playbook lang={lang} />
    <section className="info-section info-section-soft">
      <SectionHeading title={lang === "ko" ? "질문하고, 검증하며 나아갑니다." : "Question, validate, move forward."} description={lang === "ko" ? "큰 변화는 현장을 이해하는 일에서 시작됩니다." : "Meaningful change starts with understanding the field."} />
      <TopicCards items={working} lang={lang} />
    </section>
    <NextPanel title={lang === "ko" ? "함께할 다음 기회를 기다립니다." : "We look forward to what we can do together."} href={pathFor("/contact", lang)} linkText={t(labels.contact, lang)} />
  </>;
}

function PartnersPage({ lang }: { lang: Language }) {
  return <>
    <Hero title={lang === "ko" ? "더 나은 인프라는" : "Better infrastructure"} muted={lang === "ko" ? "함께 만들어갑니다." : "is built together."} description={lang === "ko" ? "현장의 전문성과 새로운 기술이 만나는 곳에서 가능성을 탐색합니다." : "Exploring possibilities where field expertise and new technology meet."} variant="orbit" />
    <section className="info-section">
      <SectionHeading title={lang === "ko" ? "현장과 함께 검토하는 다음 단계." : "Exploring the next step together in the field."} description={lang === "ko" ? "서로 다른 전문성을 연결해 현장의 질문을 함께 정의하고 검증합니다." : "We connect different areas of expertise to define and examine real-world questions together."} />
      <article className="info-partner-card">
        <div className="info-partner-card-top"><span>{lang === "ko" ? "공동 실증" : "JOINT PILOT"}</span><span>2026.09 — 2027.03</span></div>
        <div className="info-partner-card-main"><div><h3>{lang === "ko" ? "HD현대중공업" : "HD Hyundai Heavy Industries"}</h3><p><Lines>{lang === "ko" ? "데이터센터 냉각 전력 최적화를 위한 공동 실증" : "A joint pilot exploring data center cooling power optimization"}</Lines></p></div><div className="info-partner-symbol" aria-hidden="true"><span>×</span></div></div>
        <p className="info-partner-note"><Lines>{lang === "ko" ? "현장 조건을 바탕으로 냉각 운영의 가능성을 함께 살펴봅니다. 구체적인 결과는 실증과 검토를 통해 확인해야 합니다." : "Together, we are exploring cooling operations in the context of real site conditions. Specific results need to be confirmed through the pilot and further review."}</Lines></p>
      </article>
    </section>
    <NextPanel title={lang === "ko" ? "새로운 가능성을 함께 발견할 파트너를 기다립니다." : "Let's discover new possibilities together."} description={lang === "ko" ? "공동 실증과 파트너십에 관한 대화를 시작해 보세요." : "Start a conversation about a joint pilot or partnership."} href={pathFor("/contact", lang)} linkText={lang === "ko" ? "파트너십 문의" : "Discuss a partnership"} />
  </>;
}

export function InfoPage({ page, lang }: { page: Page; lang: Language }) {
  return <div className="info-page" lang={lang}>
    <Breadcrumb page={page} lang={lang} />
    {page === "definition" && <DefinitionPage lang={lang} />}
    {page === "products" && <ProductsPage lang={lang} />}
    {(page === "n-mover" || page === "n-prover" || page === "n-doras") && <ProductDetailPage id={page} lang={lang} />}
    {page === "company" && <CompanyPage lang={lang} />}
    {page === "team" && <TeamPage lang={lang} />}
    {page === "partners" && <PartnersPage lang={lang} />}
  </div>;
}
