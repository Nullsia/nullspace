import { useEffect, useRef, useState } from "react";
import { hasWebGL } from "@/lib/webgl";

/** Hero background: X-ray data hall loop that zooms into the lime rack as the hero scrolls. */
export default function XrayHero({ onFail }: { onFail?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = ref.current;
    if (!host || !hasWebGL()) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stage = host.closest<HTMLElement>(".hero-scroll-stage");
    let progress = 0;
    const readProgress = () => {
      if (!stage || reduced) return;
      const hero = stage.querySelector<HTMLElement>(":scope > .hero");
      const travel = Math.max(1, stage.offsetHeight - (hero?.offsetHeight ?? window.innerHeight));
      const p = Math.max(0, Math.min(1, -stage.getBoundingClientRect().top / travel));
      progress = p * p * (3 - 2 * p);
    };
    readProgress();
    window.addEventListener("scroll", readProgress, { passive: true });
    let dispose: (() => void) | undefined;
    let cancelled = false;
    import("./xrayLoop").then(({ createXrayLoop }) => {
      if (cancelled) return;
      try {
        // onReady: shaders compiled and a quality tier picked off-screen, so the fade-in starts on smooth frames.
        const loop = createXrayLoop(host, { getProgress: () => progress, reduced, onReady: () => setReady(true) });
        dispose = loop.dispose;
      } catch (err) {
        console.error("[xray-hero]", err);
        onFail?.();
      }
    }).catch(() => onFail?.());
    return () => { cancelled = true; window.removeEventListener("scroll", readProgress); dispose?.(); };
  }, []);

  return <div className={`hero-xray ${ready ? "is-ready" : ""}`} ref={ref} aria-hidden="true" />;
}
