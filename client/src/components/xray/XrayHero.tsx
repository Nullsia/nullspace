import { useEffect, useRef, useState } from "react";
import { hasWebGL } from "@/lib/webgl";

/**
 * At the top of the page the first scroll down does not move the page: it plays the pull-out to the exterior,
 * and the page scrolls only after that finishes, however fast the wheel or swipe. Coming back to the top
 * restarts the loop from the first scene and arms this again.
 */
function holdScrollUntilPlayed(loop: { playOut: () => Promise<void>; resetLoop: () => void }) {
  let state: "idle" | "playing" | "done" = "idle";
  let left = false;
  let touchY = 0;
  const atTop = () => window.scrollY <= 2;
  const block = (e: Event) => {
    if (state === "done" || !atTop()) return false;
    e.preventDefault();
    if (state === "idle") {
      state = "playing";
      // A slow device that can't keep up still lets the page go after 10 s.
      const finish = () => { if (state === "playing") state = "done"; };
      loop.playOut().then(finish);
      window.setTimeout(finish, 10000);
    }
    return true;
  };
  const wheel = (e: WheelEvent) => { if (e.deltaY > 0) block(e); };
  const touchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? 0; };
  const touchMove = (e: TouchEvent) => { if ((e.touches[0]?.clientY ?? 0) < touchY - 2) block(e); };
  const key = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (["ArrowDown", "PageDown", "End", " "].includes(e.key) && !e.shiftKey) block(e);
  };
  const scroll = () => {
    if (window.scrollY > 80) left = true;
    if (left && atTop()) { left = false; state = "idle"; loop.resetLoop(); }
  };
  window.addEventListener("wheel", wheel, { passive: false });
  window.addEventListener("touchstart", touchStart, { passive: true });
  window.addEventListener("touchmove", touchMove, { passive: false });
  window.addEventListener("keydown", key);
  window.addEventListener("scroll", scroll, { passive: true });
  return () => {
    window.removeEventListener("wheel", wheel);
    window.removeEventListener("touchstart", touchStart);
    window.removeEventListener("touchmove", touchMove);
    window.removeEventListener("keydown", key);
    window.removeEventListener("scroll", scroll);
  };
}

/** Hero background: X-ray data hall loop. */
export default function XrayHero({ onFail }: { onFail?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = ref.current;
    if (!host || !hasWebGL()) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    import("./xrayLoop").then(({ createXrayLoop }) => {
      if (cancelled) return;
      try {
        const loop = createXrayLoop(host, { reduced });
        const unlock = reduced ? undefined : holdScrollUntilPlayed(loop);
        dispose = () => { unlock?.(); loop.dispose(); };
        requestAnimationFrame(() => setReady(true));
      } catch (err) {
        console.error("[xray-hero]", err);
        onFail?.();
      }
    }).catch(() => onFail?.());
    return () => { cancelled = true; dispose?.(); };
  }, []);

  return <div className={`hero-xray ${ready ? "is-ready" : ""}`} ref={ref} aria-hidden="true" />;
}
