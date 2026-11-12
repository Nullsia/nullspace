import { useEffect, useRef, type ReactNode } from "react";
import "./Spotlight.css";

/*
 * Cursor spotlight that shows an inverted copy of its content inside a shape that follows the pointer.
 * The copy is aria-hidden and inert; the shape tracks the pointer directly (no easing) and only its size animates.
 *   shape "circle"   round spot
 *   shape "triangle" the slanted logo mark, full section height; it only follows the pointer sideways
 * Touch and coarse pointers get no spotlight.
 */
export default function Spotlight({ as: Tag = "div", shape, className = "", invClassName = "", inverse, id, children }: {
  as?: "div" | "section";
  shape: "circle" | "triangle";
  className?: string;
  invClassName?: string;
  /** Content for the inverted layer; defaults to the same children. */
  inverse?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let x = 0, y = 0, inside = false;
    const place = () => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${x - r.left}px`);
      el.style.setProperty("--my", `${y - r.top}px`);
      el.style.setProperty("--sh", `${r.height}px`);
    };
    const move = (e: PointerEvent) => { x = e.clientX; y = e.clientY; place(); };
    const enter = (e: PointerEvent) => { inside = true; move(e); el.classList.add("is-on"); };
    const leave = () => { inside = false; el.classList.remove("is-on"); };
    const scroll = () => { if (inside) place(); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", scroll);
    };
  }, []);
  return <Tag ref={ref as never} id={id} className={`spot spot-${shape} ${className}`}>
    {children}
    {shape === "triangle" && <div className="spot-glow" aria-hidden="true"><i /></div>}
    <div className={`spot-inv ${invClassName}`} aria-hidden="true" inert>{inverse ?? children}</div>
  </Tag>;
}
