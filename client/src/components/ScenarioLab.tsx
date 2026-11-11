import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import ScenarioVisual, { SCENARIO_KEYS } from "./lab/ScenarioVisual";
import { loadScenario, type TwinScene } from "@/lib/twin";
import { Lines } from "./Lines";
import "./ScenarioLab.css";

/*
 * Solution page scenario lab: the same 3D CFD twin as the home page, driven by the questions
 * operators actually ask. The three figures come straight from each scenario's scene.json kpi,
 * compared against the scenario it changes (W3 failure is compared with containment, etc.).
 */
const SPACE = "/images/datacenter-space.webp";
type Kpi = TwinScene["kpi"];

const scenarios = [
  { ko: "기준 운전", en: "Baseline", qKo: "지금 설정 그대로면?", qEn: "What if nothing changes?", dKo: "공급 18℃, 항온항습기 10대", dEn: "18℃ supply, 10 cooling units" },
  { ko: "AI 랙 증설", en: "AI rack expansion", qKo: "AI 서버 10대(15kW)를 들이면 어디가 먼저 뜨거워지나?", qEn: "Add ten 15 kW AI racks: where does it heat up first?", dKo: "고밀도 랙 10대 추가, IT 부하 926kW", dEn: "10 high-density racks added, 926 kW IT load", compare: 0 },
  { ko: "컨테인먼트", en: "Containment", qKo: "냉기 통로를 막으면?", qEn: "What if we contain the cold aisles?", dKo: "냉기 통로 양 끝과 위를 막음", dEn: "Cold aisles closed at both ends and on top", compare: 0 },
  { ko: "공급 22℃", en: "Supply 22℃", qKo: "냉각 설정 온도를 올려도 되나?", qEn: "Can we raise the supply temperature?", dKo: "컨테인먼트 + 공급 온도 18℃ → 22℃", dEn: "Containment + supply 18℃ → 22℃", compare: 2 },
  { ko: "W3 고장", en: "W3 failure", qKo: "항온항습기 1대가 멈추면 버티나?", qEn: "Can the hall ride out one cooling unit failing?", dKo: "컨테인먼트 + 항온항습기 W3 정지", dEn: "Containment + cooling unit W3 stopped", compare: 2 },
];

/** 받침이 있으면 "과", 없으면 "와" */
function withGwa(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return `${word}${code >= 0 && code <= 11171 && code % 28 !== 0 ? "과" : "와"}`;
}

function Delta({ now, base, unit, better, against, en }: { now: number; base: number; unit: string; better: "down" | "up"; against: string; en: boolean }) {
  const d = Math.round((now - base) * 10) / 10;
  if (d === 0) return <span className="kpi-delta">{en ? `Same as ${against}` : `${withGwa(against)} 같음`}</span>;
  const good = better === "down" ? d < 0 : d > 0;
  return <span className={`kpi-delta ${good ? "is-good" : "is-bad"}`}>{en ? `${d > 0 ? "+" : ""}${d}${unit} vs ${against}` : `${against} 대비 ${d > 0 ? "+" : ""}${d}${unit}`}</span>;
}

export default function ScenarioLab({ lang }: { lang: "ko" | "en" }) {
  const en = lang === "en";
  const [scenario, setScenario] = useState(() => {
    const value = Number(new URLSearchParams(window.location.search).get("scenario"));
    return Number.isInteger(value) && value >= 0 && value < scenarios.length ? value : 0;
  });
  const [kpi, setKpi] = useState<Record<number, Kpi>>({});
  const selected = scenarios[scenario];
  const compare = selected.compare;

  useEffect(() => {
    let alive = true;
    for (const i of [scenario, compare].filter((x): x is number => x !== undefined)) {
      if (kpi[i]) continue;
      loadScenario(SCENARIO_KEYS[i]).then(d => alive && setKpi(m => ({ ...m, [i]: d.scene.kpi }))).catch(err => console.error("[scenario-lab]", err));
    }
    return () => { alive = false; };
  }, [scenario, compare, kpi]);

  const selectScenario = (index: number) => {
    setScenario(index);
    const url = new URL(window.location.href);
    url.searchParams.set("scenario", String(index));
    url.hash = "scenario";
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const now = kpi[scenario];
  const base = compare !== undefined ? kpi[compare] : undefined;
  const against = compare !== undefined ? (en ? scenarios[compare].en : scenarios[compare].ko) : "";
  const cards = [
    { label: en ? "Max inlet temperature" : "최고 흡기온도", v: now?.inletMaxC, b: base?.inletMaxC, unit: "℃", better: "down" as const, fmt: (x: number) => <>{x.toFixed(1)}<small>℃</small></>, hot: (now?.inletMaxC ?? 0) > 27 },
    { label: en ? "Racks over 27℃" : "27℃ 초과 랙", v: now?.racksOver27, b: base?.racksOver27, unit: en ? "" : "대", better: "down" as const, fmt: (x: number) => <>{x}<small>{en ? " racks" : "대"}</small></>, hot: (now?.racksOver27 ?? 0) > 0 },
    { label: "RCI(HI)", v: now?.rciHi, b: base?.rciHi, unit: "%p", better: "up" as const, fmt: (x: number) => <>{x.toFixed(1)}<small>%</small></>, hot: (now?.rciHi ?? 100) < 100, hint: en ? "100% = no overheated racks (ASHRAE index)" : "100% = 과열 랙 없음 (ASHRAE 지표)", tip: en ? "Rack Cooling Index (high). Shows how far rack inlet temperatures exceed the recommended maximum of 27°C. 100% means no rack exceeds it, 96% or more is good, below 91% is poor (based on the allowable maximum of 32°C)." : "랙 냉각 지수(상한). 랙 흡기온도가 권장 상한 27°C를 얼마나 넘는지 나타냅니다. 100%면 넘는 랙이 없음, 96% 이상 양호, 91% 미만 나쁨 (허용 상한 32°C 기준)." },
  ];

  return <section className="scenario-module" id="scenario" aria-labelledby="scenario-heading">
    <div className="scenario-module-heading">
      <h2 id="scenario-heading">{en ? <>See the space<br /><span>from another angle.</span></> : <>공간의 변화를<br /><span>미리 살펴봅니다.</span></>}</h2>
      <p><Lines>{en ? "The same 200-rack hall, solved with CFD under different conditions. Answer the questions operators ask before changing a setting." : "같은 200랙 홀에서 조건만 바꿔 열유동 해석을 돌린 결과입니다. 운영팀이 묻는 질문에, 설정을 바꾸기 전에 답합니다."}</Lines></p>
    </div>
    <div className="lab-shell">
      <div className="lab-content">
        <ScenarioVisual motion scenario={scenario} fallback={SPACE} hint={en ? "Drag to rotate" : "끌어서 돌려 보기"} touchHint={en ? "Pinch to zoom" : "두 손가락으로 확대"} />
        <div className="lab-panel">
          <div aria-live="polite"><span className="lab-panel-label">{en ? selected.en : selected.ko}</span><h3>{en ? selected.qEn : selected.qKo}</h3><p><Lines>{en ? selected.dEn : selected.dKo}</Lines></p></div>
          <div className="scenario-tabs" role="group" aria-label={en ? "Select scenario" : "시나리오 선택"}>
            {scenarios.map((item, i) => <button key={item.en} type="button" onClick={() => selectScenario(i)} className={scenario === i ? "active" : ""} aria-pressed={scenario === i}><span className="tab-q">{en ? item.qEn : item.qKo}</span><ArrowUpRight size={14} /></button>)}
          </div>
        </div>
      </div>
      <p className="lab-foot">{en ? "CFD demo on a 200-rack virtual layout · not yet field-validated" : "200랙 가상 레이아웃 CFD 데모 · 실측 검증 전 결과"}</p>
    </div>
    <dl className="scenario-kpis" aria-live="polite">
      {cards.map(c => <div key={c.label} className={`scenario-kpi ${c.hot ? "is-hot" : ""}`}>
        <dt>{c.label}{"tip" in c && c.tip && <span className="kpi-tip"><button type="button" className="kpi-tip-btn" aria-label={en ? `What is ${c.label}?` : `${c.label} 설명`} aria-describedby={`tip-${c.label}`}>?</button><span role="tooltip" id={`tip-${c.label}`} className="kpi-tip-text">{c.tip}</span></span>}</dt>
        <dd className="kpi-value">{c.v === undefined ? "—" : c.fmt(c.v)}</dd>
        <dd className="kpi-meta">{c.v !== undefined && c.b !== undefined ? <Delta now={c.v} base={c.b} unit={c.unit} better={c.better} against={against} en={en} /> : <span className="kpi-delta">{c.hint ?? (en ? "Reference scenario" : "기준 시나리오")}</span>}</dd>
      </div>)}
    </dl>
  </section>;
}
