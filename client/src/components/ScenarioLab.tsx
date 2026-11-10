import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import "./ScenarioLab.css";

const SPACE = "/images/datacenter-space.webp";
const scenarios = [
  { ko: "기준 운전", en: "Baseline", koDesc: "현재의 운영 상태를 하나의 기준으로 읽습니다.", enDesc: "Read the current operating state as a clear baseline." },
  { ko: "AI 랙 증설", en: "AI rack expansion", koDesc: "고밀도 랙이 추가될 때 공간의 변화를 살펴봅니다.", enDesc: "See how the space changes as high-density racks are added." },
  { ko: "컨테인먼트", en: "Containment", koDesc: "공기 흐름의 경계를 바꾸기 전에 결과를 살펴봅니다.", enDesc: "Explore airflow changes before changing containment." },
  { ko: "공급 22°C", en: "Supply 22°C", koDesc: "공급 온도 변화가 공간에 미치는 영향을 살펴봅니다.", enDesc: "Explore how a supply-temperature change affects the space." },
  { ko: "W3 고장", en: "W3 failure", koDesc: "예상치 못한 상황에서도 다음 선택을 준비합니다.", enDesc: "Prepare the next decision for an unexpected situation." },
];

function Overlay({ scenario }: { scenario: number }) {
  return <svg className="scenario-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <g stroke="#fff" strokeOpacity=".42" fill="none" strokeWidth=".25"><path d="M12 22H88M12 78H88M12 22V78M88 22V78" strokeDasharray="1 1" /><circle cx="50" cy="50" r="9" /><circle cx="50" cy="50" r="18" strokeDasharray="1 2" /></g>
    <g stroke="#c6ff3d" fill="none" strokeWidth=".6">
      {scenario === 0 && <><path d="M20 60h60M20 40h60" strokeDasharray="2 2" /><circle cx="50" cy="50" r="2" /></>}
      {scenario === 1 && <><rect x="59" y="32" width="7" height="36" /><rect x="68" y="32" width="7" height="36" /><rect x="77" y="32" width="7" height="36" /></>}
      {scenario === 2 && <><path d="M18 31H82M18 69H82" /><path d="M25 31v38M75 31v38" strokeDasharray="2 2" /></>}
      {scenario === 3 && <path d="M22 38h42m-5-4 5 4-5 4M30 50h42m-5-4 5 4-5 4M22 62h42m-5-4 5 4-5 4" />}
      {scenario === 4 && <><circle cx="70" cy="50" r="12" /><path d="M65 45l10 10m0-10L65 55M18 50h35" strokeDasharray="2 2" /></>}
    </g>
  </svg>;
}

export default function ScenarioLab({ lang }: { lang: "ko" | "en" }) {
  const [scenario, setScenario] = useState(() => {
    const value = Number(new URLSearchParams(window.location.search).get("scenario"));
    return Number.isInteger(value) && value >= 0 && value < scenarios.length ? value : 0;
  });
  const selected = scenarios[scenario];
  const en = lang === "en";
  const selectScenario = (index: number) => {
    setScenario(index);
    const url = new URL(window.location.href);
    url.searchParams.set("scenario", String(index));
    url.hash = "scenario";
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const visual = document.getElementById("scenario-visual");
        if (!visual) return;
        const bounds = visual.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (window.innerHeight - bounds.top) / (window.innerHeight + bounds.height)));
        visual.style.setProperty("--scan-position", `${Math.round(12 + progress * 76)}%`);
      });
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => { window.removeEventListener("scroll", update); cancelAnimationFrame(frame); };
  }, []);

  return <section className="scenario-module" id="scenario" aria-labelledby="scenario-heading">
    <div className="scenario-module-heading">
      <h2 id="scenario-heading">{en ? <>See the space<br /><span>from another angle.</span></> : <>공간의 변화를<br /><span>미리 살펴봅니다.</span></>}</h2>
      <p>{en ? "Explore illustrative scenarios for a virtual data center layout." : "가상의 데이터센터 레이아웃에서 여러 시나리오를 살펴봅니다."}</p>
    </div>
    <div className="lab-shell">
      <div className="lab-content">
        <div className="lab-visual" id="scenario-visual" style={{ backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.35), transparent 55%), url('${SPACE}')` }}>
          <div className="lab-crosshair" aria-hidden="true"><span>＋</span></div><Overlay scenario={scenario} /><div className="scanline" aria-hidden="true" />
        </div>
        <div className="lab-panel">
          <div aria-live="polite"><h3>{en ? selected.en : selected.ko}</h3><p>{en ? selected.enDesc : selected.koDesc}</p></div>
          <div className="scenario-tabs" role="group" aria-label={en ? "Select scenario" : "시나리오 선택"}>
            {scenarios.map((item, i) => <button key={item.en} type="button" onClick={() => selectScenario(i)} className={scenario === i ? "active" : ""} aria-pressed={scenario === i}>{en ? item.en : item.ko}<ArrowUpRight size={14} /></button>)}
          </div>
        </div>
      </div>
      <p className="lab-foot">{en ? "Illustrative scenario · not a calculated result or field-validated" : "시나리오 예시 · 계산 결과가 아니며 현장 실측 검증 전"}</p>
    </div>
  </section>;
}
