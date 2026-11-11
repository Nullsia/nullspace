import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { LAPS, flyTimeOf, type FlyStage } from "@/lib/flywheel";
import { hasWebGL, useNearActive } from "@/lib/webgl";
import type { FlyControl, FlyLabels, FlyStatus } from "./flywheel-scene";
import "./FlywheelSection.css";

const FlywheelScene = lazy(() => import("./flywheel-scene"));

const COPY = {
  ko: {
    stages: [
      { label: "로봇", title: "불확실한 곳을 다시 잽니다", body: "첫 바퀴는 홀 전체를, 그다음부터는 CFD가 지정한 불확실 구간만 순찰하며 랙 앞 3높이를 잽니다.", edge: "정밀 재측정, 축적" },
      { label: "데이터", title: "하나의 지도에 쌓습니다", body: "로봇 실측과 BMS, DCIM 운영 데이터를 위치와 시간으로 맞춰 하나의 상태 그래프에 쌓습니다.", edge: "실측 보정" },
      { label: "디지털 트윈", title: "실측으로 보정합니다", body: "쌓인 실측으로 가상 데이터센터를 보정해, 센서가 없는 랙까지 랙 단위 상태를 재현합니다.", edge: "시뮬레이션 입력" },
      { label: "CFD", title: "예측하고, 모르는 곳을 찾습니다", body: "기류와 열 분포를 예측해 냉각 최적점을 찾고, 예측이 흔들리는 구간을 다음 순찰 대상으로 넘깁니다.", edge: "불확실 구간 지정" },
    ],
    results: [
      { title: "정확해지는 예측", body: "실측과 예측의 차이를 다시 학습해, CFD와 트윈 모델이 바퀴마다 나아집니다." },
      { title: "측정 비용 절감", body: "불확실 구간만 골라 순찰해, 같은 정확도를 더 적은 측정으로 확보합니다." },
      { title: "전력 비용 절감", body: "정확한 예측으로 과냉각을 줄여 냉각 전력과 운영비를 아낍니다." },
    ],
    hud: { lap: "회전", measured: "이번 회전 측정", points: "지점", flagged: "불확실 랙", unit: "대", restart: "새 센터에서 다시 시작합니다" },
    pause: "플라이휠 멈춤", play: "플라이휠 재생", steps: "플라이휠 단계",
    note: "개념 시연 · 200랙 가상 레이아웃 CFD 결과이며 회전별 랙 수는 시연용입니다",
  },
  en: {
    stages: [
      { label: "Robot", title: "Re-measure the uncertain", body: "The first lap patrols the whole hall; after that, only the zones CFD flags, measuring three heights at each rack.", edge: "Re-measure, accumulate" },
      { label: "Data", title: "Build one map", body: "Robot measurements, BMS and DCIM data are aligned by place and time into a single state graph.", edge: "Calibrate" },
      { label: "Digital twin", title: "Calibrate with the field", body: "Accumulated measurements calibrate the virtual data center, reproducing rack-level conditions even where there are no sensors.", edge: "Simulation input" },
      { label: "CFD", title: "Predict, then find the unknown", body: "Predict airflow and heat to find the cooling optimum, and hand the least certain zones to the next patrol.", edge: "Flag uncertain zones" },
    ],
    results: [
      { title: "Sharper predictions", body: "The gap between measurement and prediction is learned back, so CFD and the twin improve every lap." },
      { title: "Lower measurement cost", body: "Patrolling only uncertain zones reaches the same accuracy with fewer measurements." },
      { title: "Lower power cost", body: "Accurate predictions cut overcooling, saving cooling power and operating cost." },
    ],
    hud: { lap: "Lap", measured: "Measured this lap", points: " pts", flagged: "Uncertain racks", unit: "", restart: "Starting again at a new site" },
    pause: "Pause flywheel", play: "Play flywheel", steps: "Flywheel stages",
    note: "Concept demo · 200-rack virtual layout CFD results; rack counts per lap are illustrative",
  },
};
const SOURCES = ["BMS", "DCIM"];

/** Result card: a lime circle follows the pointer and shows the card inverted inside it. */
function SpotCard({ title, body }: { title: string; body: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  const content = <><h3>{title}</h3><p>{body}</p></>;
  return <div className="fw-spot" ref={ref} onPointerMove={move} onPointerEnter={move}>
    {content}
    <div className="fw-spot-inv" aria-hidden="true">{content}</div>
  </div>;
}

export default function FlywheelSection({ english }: { english: boolean }) {
  const t = english ? COPY.en : COPY.ko;
  const ref = useRef<HTMLDivElement>(null);
  const { near, active } = useNearActive(ref);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [status, setStatus] = useState<FlyStatus>({ lap: 0, stage: 0, hold: false, measured: 0, flagged: 0 });
  const ctl = useRef<FlyControl>({ t: 0, playing: true });
  const labels = useRef<FlyLabels>({ nodes: [], edges: [], sources: [] });

  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setWebgl(hasWebGL());
    setReduced(r);
    if (r) { ctl.current.t = flyTimeOf(LAPS.length - 1, 3, 0.9); ctl.current.playing = false; setPlaying(false); }
  }, []);

  const jump = (k: FlyStage) => { ctl.current.t = flyTimeOf(status.hold ? 0 : status.lap, k, reduced || !playing ? 0.9 : 0.001); };
  const toggle = () => { const next = !playing; ctl.current.playing = next; setPlaying(next); };
  const show3d = webgl !== false;
  const stage = t.stages[status.stage];
  const caption = (className: string) => <div className={className}>{status.hold ? <strong>{t.hud.restart}</strong> : <><strong><em>{stage.label}</em> {stage.title}</strong><p>{stage.body}</p></>}</div>;

  return <div className="fw reveal">
    {show3d && <div className="fw-stage" ref={ref}>
      <div className={`fw-layer ${ready ? "is-ready" : ""}`}>
        {webgl && near && <Suspense fallback={null}><FlywheelScene ctl={ctl} labels={labels} active={active} reduced={reduced} onReady={() => setReady(true)} onStatus={setStatus} /></Suspense>}
      </div>
      <div aria-hidden="true" className={`fw-labels ${ready ? "is-ready" : ""}`}>
        {t.stages.map((s, k) => <div key={s.label} ref={el => { labels.current.nodes[k] = el; }} className={`fw-node ${!status.hold && status.stage === k ? "on" : ""}`}>{s.label}</div>)}
        {t.stages.map((s, k) => <div key={s.edge} ref={el => { labels.current.edges[k] = el; }} className="fw-edge">{s.edge}</div>)}
        {SOURCES.map((s, i) => <div key={s} ref={el => { labels.current.sources[i] = el; }} className="fw-source">{s}</div>)}
      </div>
      <div className="fw-hud">
        <span>{t.hud.lap} {status.lap + 1} / {LAPS.length}</span>
        <span>{t.hud.measured} <b>{status.measured.toLocaleString()}</b>{t.hud.points}</span>
        <span>{t.hud.flagged} <b>{status.flagged > 0 ? `${status.flagged}${t.hud.unit}` : "-"}</b></span>
      </div>
      <button type="button" className="fw-toggle" onClick={toggle} aria-label={playing ? t.pause : t.play}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
      {caption("fw-caption fw-caption-in")}
    </div>}
    {show3d && caption("fw-caption fw-caption-out")}
    <ol className="flow-grid fw-steps" aria-label={t.steps}>
      {t.stages.map((s, k) => {
        const on = show3d && !status.hold && status.stage === k;
        return <li key={s.label} className="flow-item"><button type="button" onClick={() => jump(k as FlyStage)} disabled={!show3d} aria-current={on ? "step" : undefined} className={on ? "active" : ""}>
          <h3>{s.label}</h3><p>{s.title}</p>
        </button></li>;
      })}
    </ol>
    <div className="fw-results">{t.results.map(r => <SpotCard key={r.title} title={r.title} body={r.body} />)}</div>
    <p className="fw-note">{t.note}</p>
  </div>;
}
