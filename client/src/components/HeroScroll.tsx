import { useEffect, useId, useRef, type ReactNode } from "react";
import "./HeroScroll.css";

// Coordinates below refer to the existing 1920 × 823 X-ray image, not the
// viewport. Keeping the overlay in image space makes it follow background-size:
// cover and the different desktop/mobile background positions precisely.
const IMAGE_WIDTH = 1920;
const IMAGE_HEIGHT = 823;
const RACK_CENTER_X = 1226;
const RACK_CENTER_Y = 580;

function backgroundPosition(value: string): number {
  // The last value is the image layer if a gradient precedes the image.
  const position = value.split(",").at(-1)?.trim() ?? "50%";
  if (position === "left" || position === "top") return 0;
  if (position === "right" || position === "bottom") return 1;
  if (position === "center") return 0.5;
  return position.endsWith("%") && Number.isFinite(parseFloat(position))
    ? parseFloat(position) / 100
    : 0.5;
}

export default function HeroScroll({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const hero = stage?.querySelector<HTMLElement>(":scope > .hero");
    const art = hero?.querySelector<HTMLElement>(".hero-art");
    const rack = art?.querySelector<SVGSVGElement>(".hero-rack");
    if (!stage || !hero || !art || !rack) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const update = () => {
      frame = 0;
      // clientWidth/clientHeight are unaffected by the art's scroll transform.
      const width = art.clientWidth;
      const height = art.clientHeight;
      if (!width || !height) return;

      const style = window.getComputedStyle(art);
      const scale = Math.max(width / IMAGE_WIDTH, height / IMAGE_HEIGHT);
      const imageWidth = IMAGE_WIDTH * scale;
      const imageHeight = IMAGE_HEIGHT * scale;
      const imageLeft = (width - imageWidth) * backgroundPosition(style.backgroundPositionX);
      const imageTop = (height - imageHeight) * backgroundPosition(style.backgroundPositionY);

      rack.style.width = `${imageWidth}px`;
      rack.style.height = `${imageHeight}px`;
      rack.style.left = `${imageLeft}px`;
      rack.style.top = `${imageTop}px`;
      rack.dataset.ready = "true";

      // Scale the background and its child together around the selected rack.
      const originX = ((imageLeft + RACK_CENTER_X * scale) / width) * 100;
      const originY = ((imageTop + RACK_CENTER_Y * scale) / height) * 100;
      stage.style.setProperty("--hero-origin-x", `${originX}%`);
      stage.style.setProperty("--hero-origin-y", `${originY}%`);

      if (motionQuery.matches) {
        stage.style.setProperty("--hero-zoom", "1");
        stage.style.setProperty("--hero-rack-opacity", "0.65");
        return;
      }

      const travel = Math.max(1, stage.offsetHeight - hero.offsetHeight);
      const progress = Math.max(0, Math.min(1, -stage.getBoundingClientRect().top / travel));
      const eased = progress * progress * (3 - 2 * progress);
      stage.style.setProperty("--hero-zoom", String(1 + eased * 0.65));
      stage.style.setProperty("--hero-rack-opacity", String(0.2 + eased * 0.8));
    };

    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(scheduleUpdate) : null;
    resizeObserver?.observe(art);
    resizeObserver?.observe(stage);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    motionQuery.addEventListener("change", scheduleUpdate);
    update();

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      motionQuery.removeEventListener("change", scheduleUpdate);
      resizeObserver?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div className="hero-scroll-stage" ref={stageRef}>{children}</div>;
}

/** Decorative highlight that must be a child of the existing .hero-art. */
export function HeroRack() {
  const glowId = useId();

  return (
    <svg className="hero-rack" viewBox="0 0 1920 823" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0" stopColor="#C6FF3D" stopOpacity=".42" />
          <stop offset=".38" stopColor="#C6FF3D" stopOpacity=".12" />
          <stop offset="1" stopColor="#C6FF3D" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* An elliptical light spill, a translucent rack face, and interrupted
          slot/indicator strokes follow one actual rack in the source image. */}
      <ellipse cx="1226" cy="580" rx="86" ry="159" fill={`url(#${glowId})`} />
      <path d="M1209 480 L1245 478 L1245 680 L1209 679 Z" fill="#C6FF3D" fillOpacity=".10" />
      <path d="M1209 481 L1209 679 M1245 479 L1245 680" fill="none" stroke="#C6FF3D" strokeOpacity=".38" strokeWidth="1.2" />
      <path
        d="M1214 490h23 M1212 500h29 M1215 510h25 M1212 520h28 M1213 530h24 M1212 540h29 M1214 550h25 M1212 560h28 M1215 570h23 M1212 580h29 M1214 590h25 M1212 600h28 M1214 610h24 M1212 620h29 M1215 630h24 M1212 640h28 M1214 650h25 M1212 660h29 M1214 670h23"
        fill="none" stroke="#C6FF3D" strokeOpacity=".46" strokeWidth="1" />
      <path
        d="M1212 494h2 M1213 515h2 M1212 545h2 M1213 576h2 M1212 605h2 M1213 635h2 M1212 664h2"
        fill="none" stroke="#C6FF3D" strokeOpacity=".9" strokeWidth="2" />
    </svg>
  );
}
