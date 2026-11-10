export function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Mounts heavy 3D only near the viewport and pauses rendering off-screen. */
import { useEffect, useState, type RefObject } from "react";
export function useNearActive(ref: RefObject<HTMLElement | null>) {
  const [near, setNear] = useState(false);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) { setNear(true); setActive(true); return; }
    const pre = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "800px 0px" });
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting));
    pre.observe(el); io.observe(el);
    return () => { pre.disconnect(); io.disconnect(); };
  }, [ref]);
  return { near, active };
}
