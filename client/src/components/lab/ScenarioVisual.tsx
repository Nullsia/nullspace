import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ScenarioKey } from "@/lib/twin";
import { hasWebGL, useNearActive } from "@/lib/webgl";

const LabScene = lazy(() => import("./lab-scene").catch(() => ({ default: (() => null) as never })));

export const SCENARIO_KEYS: ScenarioKey[] = ["S0_baseline", "S2_ai_racks", "S3_containment", "S4_cont_22C", "S5_cont_fail"];

/** 3D data center twin for the scenario section. Falls back to the still image without WebGL. */
export default function ScenarioVisual({ scenario, fallback, hint, motion = false }: { scenario: number; fallback: string; hint: string; motion?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { near, active } = useNearActive(ref);
  const [webgl, setWebgl] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setWebgl(hasWebGL());
    setInteractive(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return <div ref={ref} className="lab-visual lab-visual-3d" style={{ backgroundImage: ready ? "none" : `linear-gradient(0deg, rgba(0,0,0,.35), transparent 55%), url('${fallback}')` }}>
    <div className={`lab-3d-layer ${ready ? "is-ready" : ""}`}>
      {webgl && near && <Suspense fallback={null}><LabScene scenario={SCENARIO_KEYS[scenario] ?? "S0_baseline"} active={active} interactive={interactive} reduced={reduced} motion={motion} onReady={() => setReady(true)} /></Suspense>}
    </div>
    {ready && interactive && <span className="lab-3d-hint">{hint}</span>}
  </div>;
}
