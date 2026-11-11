import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import HeroScroll, { HeroRack } from "../components/HeroScroll";
import XrayHero from "../components/xray/XrayHero";
import { hasWebGL } from "@/lib/webgl";
import ScenarioVisual from "../components/lab/ScenarioVisual";
import FlywheelSection from "../components/flywheel/FlywheelSection";
import "./Home.css";
import { Lines } from "../components/Lines";
import Spotlight from "../components/Spotlight";

const HERO = "/images/datacenter-hero.webp";
const SPACE = "/images/datacenter-space.webp";

const scenarios = [
  { ko: "기준 운전", en: "Baseline", code: "01", note: "BASELINE OPERATION", desc: "현재의 운영 상태를 하나의 기준으로 읽습니다.", enDesc: "Read the current operating state as a clear baseline." },
  { ko: "AI 랙 증설", en: "AI rack expansion", code: "02", note: "AI RACK EXPANSION", desc: "고밀도 랙이 추가될 때 공간의 변화를 살펴봅니다.", enDesc: "See how the space changes as high-density racks are added." },
  { ko: "컨테인먼트", en: "Containment", code: "03", note: "AIRFLOW CONTAINMENT", desc: "공기 흐름의 경계를 바꾸기 전에 결과를 살펴봅니다.", enDesc: "Explore airflow changes before changing containment." },
  { ko: "공급 22°C", en: "Supply 22°C", code: "04", note: "SUPPLY AIR 22°C", desc: "공급 온도 변화가 공간에 미치는 영향을 살펴봅니다.", enDesc: "Explore how a supply-temperature change affects the space." },
  { ko: "W3 고장", en: "W3 failure", code: "05", note: "W3 FAILURE", desc: "예상치 못한 상황에서도 다음 선택을 준비합니다.", enDesc: "Prepare the next decision for an unexpected situation." },
];

type Stat = { value?: [string, string]; count?: { from: number; to: number; prefix: string; unit: string }; ko: string; en: string; enValue?: [string, string]; enCount?: Stat["count"] };
const stats: Stat[] = [
  { value: ["42", "U"], ko: "수직 3점 계측", en: "Three-point vertical measurement" },
  { value: ["CFD", "급+"], enValue: ["CFD", "-grade+"], ko: "예측 정확도 로봇 통합관제 시뮬레이션 엔진", en: "Prediction accuracy from a robot-integrated simulation engine" },
  { count: { from: 60, to: 1, prefix: "", unit: "sec" }, ko: "예측 산출 속도", en: "Prediction speed" },
  { count: { from: 0, to: 7000, prefix: "", unit: "만원/week" }, enCount: { from: 0, to: 70, prefix: "₩", unit: "M/week" }, ko: "운영 비용 절감", en: "Operating cost savings" },
];

function StatValue({ stat, english }: { stat: Stat; english: boolean }) {
  const count = english ? stat.enCount ?? stat.count : stat.count;
  if (count) return <CountUp {...count}/>;
  const [main, unit] = (english ? stat.enValue ?? stat.value : stat.value) ?? ["", ""];
  return <span>{main}<small>{unit}</small></span>;
}

function CountUp({ from, to, prefix, unit }: { from: number; to: number; prefix: string; unit: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    setValue(from);
    let frame = 0;
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1800);
        setValue(from + (to - from) * (1 - Math.pow(1 - t, 3)));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [from, to]);
  const text = (n: number) => Math.round(n).toLocaleString("en-US");
  return <span ref={ref} role="text" aria-label={`${prefix}${text(to)}${unit}`}><span aria-hidden="true">{prefix}{text(value)}<small>{unit}</small></span></span>;
}

const flow = [
  ["01", "ROBOT", "공간을 실측합니다", "Measure the space"],
  ["02", "DATA", "현장의 데이터를 모읍니다", "Collect field data"],
  ["03", "DIGITAL TWIN", "보이지 않는 공간을 연결합니다", "Connect the unseen"],
  ["04", "CFD", "변화를 예측하고 검증합니다", "Predict and verify"],
];

function ScenarioOverlay({ scenario }: { scenario: number }) {
  return <svg className="scenario-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <g stroke="#ffffff" strokeOpacity=".42" fill="none" strokeWidth=".25" vectorEffect="non-scaling-stroke">
      <path d="M12 22H88M12 78H88M12 22V78M88 22V78" strokeDasharray="1 1"/>
      <circle cx="50" cy="50" r="9"/><circle cx="50" cy="50" r="18" strokeDasharray="1 2"/>
    </g>
    <g stroke="#c6ff3d" fill="none" strokeWidth=".6" vectorEffect="non-scaling-stroke">
      {scenario === 0 && <><path d="M20 60h60M20 40h60" strokeDasharray="2 2"/><circle cx="50" cy="50" r="2"/></>}
      {scenario === 1 && <><rect x="59" y="32" width="7" height="36"/><rect x="68" y="32" width="7" height="36"/><rect x="77" y="32" width="7" height="36"/><path d="M62 26v-5m9 5v-5m9 5v-5"/></>}
      {scenario === 2 && <><path d="M18 31H82M18 69H82"/><path d="M25 31v38M75 31v38" strokeDasharray="2 2"/></>}
      {scenario === 3 && <><path d="M22 38h42m-5-4 5 4-5 4M30 50h42m-5-4 5 4-5 4M22 62h42m-5-4 5 4-5 4"/></>}
      {scenario === 4 && <><circle cx="70" cy="50" r="12"/><path d="M65 45l10 10m0-10L65 55M18 50h35" strokeDasharray="2 2"/></>}
    </g>
  </svg>;
}

function Home() {
  const english = typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "").toLowerCase() === "/en";
  const path = (destination: string) => `${english ? "/en" : ""}${destination}`;
  const [scenario, setScenario] = useState(() => {
    const value = Number(new URLSearchParams(window.location.search).get("scenario"));
    return Number.isInteger(value) && value >= 0 && value < scenarios.length ? value : 0;
  });
  // On wide screens the scenario lab pins while scrolling and steps through each scenario in order.
  const labScrollRef = useRef<HTMLDivElement>(null);
  // The stage pins at its sticky top and stays there while the wrapper scrolls past it.
  const labTravel = (wrap: HTMLElement) => {
    const stage = wrap.firstElementChild as HTMLElement | null;
    const pin = stage ? parseFloat(getComputedStyle(stage).top) || 0 : 0;
    return { pin, travel: Math.max(1, wrap.offsetHeight - (stage?.offsetHeight ?? window.innerHeight)) };
  };
  const scrollStepping = () => typeof window !== "undefined" && window.matchMedia("(min-width: 900px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)").matches;
  const selectScenario = (index: number) => {
    const wrap = labScrollRef.current;
    if (wrap && scrollStepping()) {
      const { pin, travel } = labTravel(wrap);
      const top = wrap.getBoundingClientRect().top + window.scrollY - pin;
      window.scrollTo({ top: top + travel * ((index + 0.5) / scenarios.length), behavior: "smooth" });
    }
    setScenario(index);
    const url = new URL(window.location.href);
    url.searchParams.set("scenario", String(index));
    url.hash = "scenario";
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const wrap = labScrollRef.current;
      if (!wrap || !scrollStepping()) return;
      const rect = wrap.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const { pin, travel } = labTravel(wrap);
      const p = Math.max(0, Math.min(0.999, (pin - rect.top) / travel));
      setScenario(Math.floor(p * scenarios.length));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); if (frame) cancelAnimationFrame(frame); };
  }, []);
  const selected = scenarios[scenario];
  const [xray, setXray] = useState(() => typeof window !== "undefined" && hasWebGL());

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = document.querySelectorAll(".reveal");
    const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries, activeObserver) => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("visible"); activeObserver.unobserve(entry.target); }
    }), { threshold: 0.08 }) : null;
    elements.forEach(element => observer ? observer.observe(element) : element.classList.add("visible"));
    let frame = 0;
    const scanOnScroll = () => {
      cancelAnimationFrame(frame);
      if (motionQuery.matches) {
        document.getElementById("lab-visual")?.style.removeProperty("--scan-position");
        return;
      }
      frame = requestAnimationFrame(() => {
        const scan = document.getElementById("lab-visual");
        if (!scan) return;
        const bounds = scan.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (window.innerHeight - bounds.top) / (window.innerHeight + bounds.height)));
        scan.style.setProperty("--scan-position", `${Math.round(12 + progress * 76)}%`);
      });
    };
    window.addEventListener("scroll", scanOnScroll, { passive: true });
    motionQuery.addEventListener("change", scanOnScroll);
    scanOnScroll();
    return () => { observer?.disconnect(); window.removeEventListener("scroll", scanOnScroll); motionQuery.removeEventListener("change", scanOnScroll); cancelAnimationFrame(frame); };
  }, []);

  return <div className="home-page">
    <HeroScroll><section className="hero" id="top" aria-labelledby="hero-title">
      <div className={`hero-art ${xray ? "has-xray" : ""}`} style={{ backgroundImage: `linear-gradient(90deg, #090909 0%, rgba(9,9,9,.96) 25%, rgba(9,9,9,.43) 60%, rgba(9,9,9,.18) 100%), url('${HERO}')` }}>{xray ? <XrayHero onFail={() => setXray(false)} /> : <HeroRack />}</div>
      <div className="hero-grid" aria-hidden="true"/>
      <div className="hero-copy">
        <h1 id="hero-title">Redefine the space</h1>
        <p className={english ? "hero-title-ko hero-title-en" : "hero-title-ko"}><Lines>{english ? "Start with what we measure. Understand the entire space." : "측정한 곳에서 시작해, 공간 전체를 이해합니다."}</Lines></p>
        <div className="hero-buttons"><a className="button button-lime" href={path("/solution")}>{english ? "Explore the solution" : "솔루션 살펴보기"}<ArrowUpRight size={18}/></a><a className="button" href={path("/contact")}>Contact<ArrowUpRight size={18}/></a></div>
      </div>
      {!xray && <div className="hero-reticle" aria-hidden="true"><div className="reticle-circle"><span/><i/></div></div>}
    </section></HeroScroll>


    <Spotlight as="section" shape="triangle" className="intro-section section-pad" invClassName="intro-inv" id="problem">

      <div className="intro-layout reveal"><div><h2>{english ? <>What you can't see<br/><em>costs you.</em></> : <>보이지 않는 공간이<br/><em>운영을 바꿉니다.</em></>}</h2></div><div className="intro-copy"><p><Lines>{english ? "Data centers are growing denser. But fixed sensors alone cannot tell the whole story of heat, airflow and the spaces in between." : <>데이터센터는 더 크고 밀도 높아지고 있습니다.<br/>하지만 고정된 센서만으로는 랙 사이의 열과 바람,<br/>공간의 모든 변화를 알 수 없습니다.</>}</Lines></p><p><Lines>{english ? "NULL SPACE reveals the data you need to make the next decision with confidence." : <>NULL SPACE는 보이지 않던 현장의 데이터를 드러내고,<br/>더 정확한 다음 결정을 돕습니다.</>}</Lines></p><a className="underlined-link" href={path("/solution")}>{english ? "The problem we solve" : "우리가 푸는 문제"} <ArrowUpRight size={16}/></a></div></div>
      <div className="stat-row reveal">{stats.map(stat => <div key={stat.en}><strong><StatValue stat={stat} english={english}/></strong><p><Lines>{english ? stat.en : stat.ko}</Lines></p></div>)}</div>
    </Spotlight>

    <section className="scenario-section section-pad" id="scenario">

      <div className="lab-scroll" ref={labScrollRef}><div className="lab-stage"><div className="scenario-heading reveal"><div><h2>{english ? <>Run the scenario.<br/><span>See what happens.</span></> : <>운영을 바꾸기 전에,<br/><span>먼저 돌려 봅니다.</span></>}</h2></div><p><Lines>{english ? "Explore how a change in the data center can affect the whole space. A better decision starts with a clearer view." : <>데이터센터의 작은 변화가 공간 전체에 어떤 영향을 미칠까요.<br/>더 나은 결정은 더 선명한 시야에서 시작됩니다.</>}</Lines></p></div><div className="lab-shell reveal"><div className="lab-content"><ScenarioVisual motion scenario={scenario} fallback={SPACE} hint={english ? "Drag to rotate" : "끌어서 돌려 보기"}/><div className="lab-panel"><div aria-live="polite"><h3>{english ? selected.en : selected.ko}</h3><p><Lines>{english ? selected.enDesc : selected.desc}</Lines></p></div><div className="scenario-tabs" role="group" aria-label={english ? "Select scenario" : "시나리오 선택"}>{scenarios.map((item, i) => <button key={item.code} onClick={() => selectScenario(i)} className={scenario === i ? "active" : ""} aria-pressed={scenario === i}>{english ? item.en : item.ko}<ArrowUpRight size={14}/></button>)}</div></div></div><p className="lab-foot"><Lines>{english ? "CFD results for a 200-rack virtual layout · not yet field-validated" : "200랙 가상 레이아웃 CFD 결과 · 실측 검증 전"}</Lines></p></div></div></div>
    </section>

    <section className="solution-section section-pad" id="solution">

      <div className="solution-heading reveal"><div><h2>{english ? <>Robots that execute.<br/><span>A platform that verifies.</span></> : <>실행하는 로봇,<br/><span>검증하는 플랫폼.</span></>}</h2></div><div><p><Lines>{english ? "We connect physical execution with spatial intelligence. Robots collect the data, a digital twin reveals the space, and analysis verifies the next move." : "로봇은 시작일 뿐입니다. 현장을 측정하고, 공간을 이해하고, 변화를 예측하고 검증하는 하나의 연결된 흐름을 만듭니다."}</Lines></p><a className="underlined-link" href={path("/solution")}>{english ? "Discover our solution" : "솔루션 알아보기"} <ArrowUpRight size={16}/></a></div></div>
      <div className="product-grid reveal"><a href={path("/solution/product/n-mover")} className="product-card"><div className="product-image mover"><img src="/images/n-mover.jpg" alt={english ? "N-Mover transporting a data center rack" : "데이터센터 랙을 운반하는 N-Mover"}/><ArrowUpRight size={19}/></div><div className="product-body"><div><h3>N-MOVER</h3></div><p><Lines>{english ? "Precision in every move." : "구축의 모든 움직임을 정밀하게."}</Lines></p></div></a><a href={path("/solution/product/n-prover")} className="product-card"><div className="product-image prover"><img src="/images/n-prover.jpg" alt={english ? "N-Prover measuring data center space" : "데이터센터 공간을 측정하는 N-Prover"}/><ArrowUpRight size={19}/></div><div className="product-body"><div><h3>N-PROVER</h3></div><p><Lines>{english ? "A closer look at every space." : "운영의 모든 공간을 더 가까이."}</Lines></p></div></a><a href={path("/solution/product/n-doras")} className="product-card platform-card"><div className="product-image doras"><img src="/images/n-doras-card.jpg" alt={english ? "N-DORAS digital twin dashboard tracking robots in a data hall" : "데이터홀의 로봇을 보여주는 N-DORAS 디지털 트윈 대시보드"}/><ArrowUpRight size={19}/></div><div className="product-body"><div><h3>N-DORAS</h3></div><p><Lines>{english ? "One platform, connected intelligence." : "하나로 연결되는 공간의 지능."}</Lines></p></div></a></div>
    </section>

    <section className="flywheel-section section-pad"><div className="flywheel-heading reveal"><div><h2>{english ? <>A flywheel that spins<br/><span>faster as data grows.</span></> : <>데이터가 쌓일수록<br/><span>빨라지는 플라이휠.</span></>}</h2></div><p><Lines>{english ? "Robot measurements and digital twins build a continuously improving picture of your data center." : <>반복되는 측정과 검증이 데이터로 쌓입니다.<br/>공간을 이해하는 지능은 매 순간 더 정교해집니다.</>}</Lines></p></div><FlywheelSection english={english}/></section>

    <section className="case-section section-pad" id="traction"><div className="case-layout reveal"><div><h2>{english ? <>Proven where<br/>it <span>matters.</span></> : <>현장에서<br/><span>증명합니다.</span></>}</h2><p className="case-description"><Lines>{english ? "Together with HD Hyundai Heavy Industries, we are validating a new way to optimize cooling power in data centers." : <>HD현대중공업과 함께 데이터센터 냉각 전력 최적화를 위한<br/>새로운 가능성을 검증하고 있습니다.</>}</Lines></p><a className="underlined-link light" href={path("/company/partners")}>{english ? "Explore the pilot" : "실증 계획 자세히 보기"} <ArrowUpRight size={16}/></a></div><div className="case-card"><div className="case-partner">HD HYUNDAI<br/><span>HEAVY INDUSTRIES</span></div><div className="case-card-description">{english ? "Data center cooling power optimization" : "데이터센터 냉각 전력 최적화 공동 실증"}</div><div className="case-timeline"><div><strong>DIAGNOSE</strong><small>2026.11—12</small></div><div><strong>IMPROVE</strong><small>2027.01—02</small></div><div><strong>VERIFY</strong><small>2027.03</small></div></div></div></div></section>




    <section className="news-section section-pad"><div className="news-head reveal"><div><h2>{english ? "Ideas in motion" : "새로운 소식과 생각"}</h2></div><a className="underlined-link" href={path("/news")}>{english ? "All news" : "전체 글 보기"}<ArrowUpRight size={16}/></a></div><div className="news-list reveal"><a href={path("/news/cfd-containment-200-racks")}><strong>{english ? "A closer look at containment in a 200-rack data center" : "200랙 데이터센터, 컨테인먼트를 들여다보다"}</strong><ArrowUpRight size={22}/></a><a href={path("/news/hd-hhi-cooling-pilot")}><strong>{english ? "A joint cooling optimization pilot with HD Hyundai Heavy Industries" : "HD현대중공업과 냉각 최적화 공동 실증"}</strong><ArrowUpRight size={22}/></a></div></section>

    <Spotlight as="section" shape="circle" className="contact-band" invClassName="contact-inv" id="contact"><div className="contact-band-grid" aria-hidden="true"/><div className="contact-band-wire" aria-hidden="true"/><div className="contact-band-content"><div className="contact-band-text"><h2>{english ? "What could we see in your space?" : "우리 센터는 어떨까요?"}</h2><p><Lines>{english ? "Start a conversation about a clearer, smarter data center." : "더 선명하고 똑똑한 데이터센터를 위한 첫 대화를 시작해 보세요."}</Lines></p></div><a className="button button-lime" href={path("/contact")}>{english ? "Talk to us" : "도입 상담하기"}<ArrowUpRight size={18}/></a></div></Spotlight>
  </div>;
}

export default Home;
