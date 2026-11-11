// X-ray data hall loop for the home hero, ported from the standalone loop page.
// Ambient 12 s loop: starts at the lime rack, pulls out to the photoreal hall, a lime scan sweeps out from the rack, then pushes back in.
// Scroll progress (0..1) pushes the camera through the peel toward the lime rack.
// Drawn in a single pass: see docs/xray-hero-rendering.md
/* eslint-disable */
// @ts-nocheck
import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export function createXrayLoop(host: HTMLElement, { getProgress, reduced, onReady }: { getProgress: () => number; reduced: boolean; onReady?: () => void }) {


// ───────── 설정 ─────────
const LOOP = 12;                         // 초
const CAPTURE = false;
const LIME = new THREE.Color("#C6FF3D"); // 선형값으로 바뀜, 마지막에 sRGB로 되돌림

// ───────── 형상 버퍼 ─────────
const LN = { p: [], b: [], l: [] };     // 선
const FC = { p: [], b: [], l: [] };     // 면 (반투명 유리)
const PT = { p: [], b: [], l: [], ph: [], k: [] }; // LED 점
const seg = (a, c, br, lime = 0) => { LN.p.push(...a, ...c); LN.b.push(br, br); LN.l.push(lime, lime); };
const tri = (a, c, d, br, lime) => { FC.p.push(...a, ...c, ...d); FC.b.push(br, br, br); FC.l.push(lime, lime, lime); };
const quad = (a, c, d, e, br, lime = 0) => { tri(a, c, d, br, lime); tri(a, d, e, br, lime); };
const led = (p, br, lime = 0, ph = 0, k = 1) => { PT.p.push(...p); PT.b.push(br); PT.l.push(lime); PT.ph.push(ph); PT.k.push(k); };
function boxEdges(x0, y0, z0, x1, y1, z1, br, lime = 0) {
  const X = [x0, x1], Y = [y0, y1], Z = [z0, z1];
  for (const y of Y) for (const z of Z) seg([x0, y, z], [x1, y, z], br, lime);
  for (const x of X) for (const z of Z) seg([x, y0, z], [x, y1, z], br, lime);
  for (const x of X) for (const y of Y) seg([x, y, z0], [x, y, z1], br, lime);
}
function boxFaces(x0, y0, z0, x1, y1, z1, br, lime = 0, which = "xyzXYZ") {
  if (which.includes("x")) quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], br, lime);
  if (which.includes("X")) quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], br, lime);
  if (which.includes("y")) quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], br, lime);
  if (which.includes("Y")) quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], br, lime);
  if (which.includes("z")) quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], br, lime);
  if (which.includes("Z")) quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], br, lime);
}
function cylX(xa, xb, y, z, r, br, ringStep = 1.5) {     // x축 배관
  const n = 8;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; seg([xa, y + Math.sin(a) * r, z + Math.cos(a) * r], [xb, y + Math.sin(a) * r, z + Math.cos(a) * r], br * (i % 2 ? 0.5 : 1)); }
  for (let x = xa; x <= xb + 1e-6; x += ringStep) ring([x, y, z], r, "x", br * 0.7, 14);
}
function ring(c, r, axis, br, n = 24, lime = 0) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2;
    const P = (t) => axis === "x" ? [c[0], c[1] + Math.sin(t) * r, c[2] + Math.cos(t) * r]
                  : axis === "y" ? [c[0] + Math.cos(t) * r, c[1], c[2] + Math.sin(t) * r]
                  : [c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r, c[2]];
    seg(P(a), P(b), br, lime);
  }
}
function cylY(c, r, y0, y1, br, rings = 6, n = 20) {     // 세로 원통
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; seg([c[0] + Math.cos(a) * r, y0, c[1] + Math.sin(a) * r], [c[0] + Math.cos(a) * r, y1, c[1] + Math.sin(a) * r], br * 0.55); }
  for (let k = 0; k <= rings; k++) ring([c[0], y0 + (y1 - y0) * k / rings, c[1]], r, "y", br, 32);
}
const hash = (a, b = 0, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };

// ───────── 데이터홀 배치 ─────────
const RW = 0.6, RD = 1.1, RH = 2.2, ROWS = 7, PITCH = 3.5;
const GROUP = 10, GAP = 0.9, NG = 7;
const groupW = GROUP * RW, totalW = NG * groupW + (NG - 1) * GAP, X0 = -totalW / 2;
const rowZ = (i) => -i * PITCH;
const HALL = { x0: -25.2, x1: 25.2, z0: -23.6, z1: 3.6, h: 5.3, ceil: 4.8 };
const TARGET = { row: 2, g: 3, k: 7 };
const tx = X0 + TARGET.g * (groupW + GAP) + TARGET.k * RW + RW / 2;   // = 1.5
const tz = rowZ(TARGET.row);
const TFRONT = new THREE.Vector3(tx, 1.15, tz + RD / 2);

const RACKS = [];
function rack(i, g, k) {
  const cx = X0 + g * (groupW + GAP) + k * RW + RW / 2, zc = rowZ(i), f = i % 2 === 0 ? 1 : -1;
  const lime = (i === TARGET.row && g === TARGET.g && k === TARGET.k) ? 1 : 0;
  RACKS.push({ cx, zc, f, lime });
  const xL = cx - RW / 2, xR = cx + RW / 2, zF = zc + f * RD / 2, zB = zc - f * RD / 2;
  const L = lime ? 1.6 : 1;
  boxEdges(xL, 0, zc - RD / 2, xR, RH, zc + RD / 2, 0.30 * L, lime);
  // 앞문 틀
  const zf = zF + f * 0.004, ix0 = xL + 0.035, ix1 = xR - 0.035;
  seg([ix0, 0.06, zf], [ix0, RH - 0.06, zf], 0.2 * L, lime); seg([ix1, 0.06, zf], [ix1, RH - 0.06, zf], 0.2 * L, lime);
  seg([ix0, 0.06, zf], [ix1, 0.06, zf], 0.2 * L, lime); seg([ix0, RH - 0.06, zf], [ix1, RH - 0.06, zf], 0.2 * L, lime);
  // 서버 슬롯 (2U)
  const u = 0.0889, y0 = 0.13, n = 21;
  for (let j = 0; j <= n; j++) {
    const y = y0 + j * u;
    const occ = hash(i * 97 + g, k, j) > 0.16 || lime;
    seg([ix0 + 0.01, y, zf], [ix1 - 0.01, y, zf], (occ ? 0.12 : 0.05) * L, lime);
    if (j < n && occ) {
      const ym = y + u / 2;
      led([ix0 + 0.045, ym, zf + f * 0.003], 0.55 + 0.45 * hash(k, j, i), lime, hash(j, k), 1 + (j % 2));
      if (hash(j, i, k) > 0.45) led([ix0 + 0.085, ym, zf + f * 0.003], 0.35 + 0.4 * hash(i, j), lime, hash(k, j, 3), 1);
      if (hash(g, j, k) > 0.7) seg([ix1 - 0.12, ym, zf], [ix1 - 0.04, ym, zf], 0.16 * L, lime);
    }
    // 내부 선반 (투시될 때 보이는 층)
    if (j % 3 === 0) {
      seg([ix0, y, zF], [ix0, y, zB], 0.05 * L, lime); seg([ix1, y, zF], [ix1, y, zB], 0.05 * L, lime);
      seg([ix0, y, zB - f * 0.05], [ix1, y, zB - f * 0.05], 0.04 * L, lime);
      if (lime) { seg([ix0, y, zc], [ix1, y, zc], 0.06, 1); }
    }
  }
  // 뒤쪽 케이블 다발과 트레이까지 내려온 선
  for (let c = 0; c < 5; c++) {
    const x = xL + 0.12 + c * 0.09, z = zB + f * (0.09 + 0.02 * (c % 2));
    seg([x, 0.18, z], [x, RH - 0.02, z], 0.06 * L, lime);
    if (c % 2 === 0) seg([x, RH, z], [x, 2.62, zc - f * 0.08], 0.07 * L, lime);
  }
  // 반투명 면
  boxFaces(xL, 0, zc - RD / 2, xR, RH, zc + RD / 2, lime ? 0.008 : 0.0035, lime, f > 0 ? "YZz" : "Yzz");
  if (k === 0) boxFaces(xL, 0, zc - RD / 2, xR, RH, zc + RD / 2, 0.005, 0, "x");
  if (k === GROUP - 1) boxFaces(xL, 0, zc - RD / 2, xR, RH, zc + RD / 2, 0.005, 0, "X");
  if (lime) { // 랙 셀 내부를 채우는 라임 부피
    boxFaces(xL + 0.05, 0.08, zc - RD / 2 + 0.06, xR - 0.05, RH - 0.08, zc + RD / 2 - 0.06, 0.016, 1);
    boxEdges(xL + 0.05, 0.08, zc - RD / 2 + 0.06, xR - 0.05, RH - 0.08, zc + RD / 2 - 0.06, 0.22, 1);
  }
}
for (let i = 0; i < ROWS; i++) for (let g = 0; g < NG; g++) for (let k = 0; k < GROUP; k++) rack(i, g, k);

// 열마다: 바닥 조명, 케이블 트레이, 행거, 버스웨이
for (let i = 0; i < ROWS; i++) {
  const zc = rowZ(i), f = i % 2 === 0 ? 1 : -1;
  for (let g = 0; g < NG; g++) {
    const xa = X0 + g * (groupW + GAP), xb = xa + groupW;
    const zs = zc + f * (RD / 2 + 0.07);
    seg([xa, 0.012, zs], [xb, 0.012, zs], 0.4);                      // 랙 밑 흰 조명줄
    for (const [w, b] of [[0.12, 0.05], [0.35, 0.022], [0.8, 0.01]]) quad([xa, 0.004, zs - w], [xa, 0.004, zs + w], [xb, 0.004, zs + w], [xb, 0.004, zs - w], b);
    // 엔드 패널
    boxEdges(xa - 0.04, 0, zc - RD / 2 - 0.02, xa, RH + 0.05, zc + RD / 2 + 0.02, 0.28);
    boxEdges(xb, 0, zc - RD / 2 - 0.02, xb + 0.04, RH + 0.05, zc + RD / 2 + 0.02, 0.28);
  }
  const xa = X0, xb = -X0;
  for (const [y, w, oz] of [[2.65, 0.5, 0], [3.02, 0.4, -f * 0.15]]) {
    const z0 = zc + oz - w / 2, z1 = zc + oz + w / 2;
    seg([xa, y, z0], [xb, y, z0], 0.24); seg([xa, y, z1], [xb, y, z1], 0.24);
    seg([xa, y + 0.06, z0], [xb, y + 0.06, z0], 0.1); seg([xa, y + 0.06, z1], [xb, y + 0.06, z1], 0.1);
    for (let x = xa; x <= xb; x += 0.3) seg([x, y, z0], [x, y, z1], 0.07);
    for (let x = xa; x <= xb; x += 1.5) { seg([x, y, z0], [x, HALL.ceil, z0], 0.07); seg([x, y, z1], [x, HALL.ceil, z1], 0.07); }
    quad([xa, y, z0], [xb, y, z0], [xb, y, z1], [xa, y, z1], 0.003);
  }
  boxEdges(xa, 3.38, zc + f * 0.42 - 0.07, xb, 3.5, zc + f * 0.42 + 0.07, 0.14);   // 버스웨이
  for (let x = xa + 0.3; x < xb; x += 1.2) seg([x, 3.38, zc + f * 0.42], [x, RH, zc + f * 0.3], 0.05); // 탭오프
}
// 통로: 배관, 천장 조명
for (let i = -1; i < ROWS; i++) {
  const za = i < 0 ? 2.2 : rowZ(i) - PITCH / 2;
  if (za < HALL.z0 + 0.5) continue;
  seg([X0, 4.68, za], [-X0, 4.68, za], 0.5);
  quad([X0, 4.7, za - 0.06], [-X0, 4.7, za - 0.06], [-X0, 4.7, za + 0.06], [X0, 4.7, za + 0.06], 0.06);
  if (i >= 0 && i % 2 === 0) { cylX(X0 - 1, -X0 + 1, 4.05, za - 0.35, 0.17, 0.2); cylX(X0 - 1, -X0 + 1, 4.05, za + 0.35, 0.17, 0.2); }
}
// 기둥과 천장 구조
const colX = [];
for (let g = 0; g <= NG; g++) colX.push(X0 + g * (groupW + GAP) - GAP / 2);
for (const x of colX) {
  for (let i = 0; i < ROWS; i++) {
    const z = rowZ(i);
    boxEdges(x - 0.16, 0, z - 0.16, x + 0.16, HALL.h, z + 0.16, 0.34);
    boxFaces(x - 0.16, 0, z - 0.16, x + 0.16, HALL.h, z + 0.16, 0.005, 0, "xXzZ");
  }
  seg([x, HALL.ceil, HALL.z0], [x, HALL.ceil, HALL.z1], 0.22); seg([x, HALL.h, HALL.z0], [x, HALL.h, HALL.z1], 0.18);
  for (let z = HALL.z0, s = 0; z < HALL.z1 - 1e-6; z += 1.75, s++) seg([x, s % 2 ? HALL.ceil : HALL.h, z], [x, s % 2 ? HALL.h : HALL.ceil, Math.min(z + 1.75, HALL.z1)], 0.09);
}
for (let i = 0; i < ROWS; i++) seg([HALL.x0, HALL.ceil, rowZ(i)], [HALL.x1, HALL.ceil, rowZ(i)], 0.16);
// 바닥 타일
for (let z = HALL.z0; z <= HALL.z1 + 1e-6; z += 0.6) seg([HALL.x0, 0.002, z], [HALL.x1, 0.002, z], 0.022);
for (let x = HALL.x0; x <= HALL.x1 + 1e-6; x += 0.6) seg([x, 0.002, HALL.z0], [x, 0.002, HALL.z1], 0.022);
// 외벽 (유리 커튼월)
function wall(a, c, along) {
  const len = Math.hypot(c[0] - a[0], c[2] - a[2]), n = Math.round(len / 3);
  for (let s = 0; s <= n; s++) { const t = s / n, x = a[0] + (c[0] - a[0]) * t, z = a[2] + (c[2] - a[2]) * t; seg([x, 0, z], [x, HALL.h, z], 0.24); }
  for (const y of [0, 0.9, 2.7, 4.5, HALL.h]) seg([a[0], y, a[2]], [c[0], y, c[2]], y === 0 || y === HALL.h ? 0.3 : 0.12);
  quad([a[0], 0, a[2]], [c[0], 0, c[2]], [c[0], HALL.h, c[2]], [a[0], HALL.h, a[2]], 0.0035);
}
wall([HALL.x0, 0, HALL.z1], [HALL.x1, 0, HALL.z1]); wall([HALL.x0, 0, HALL.z0], [HALL.x1, 0, HALL.z0]);
wall([HALL.x0, 0, HALL.z0], [HALL.x0, 0, HALL.z1]); wall([HALL.x1, 0, HALL.z0], [HALL.x1, 0, HALL.z1]);
// 지붕과 옥상 설비
for (let x = HALL.x0; x <= HALL.x1 + 1e-6; x += 6.3) seg([x, HALL.h, HALL.z0], [x, HALL.h, HALL.z1], 0.1);
quad([HALL.x0, HALL.h, HALL.z0], [HALL.x0, HALL.h, HALL.z1], [HALL.x1, HALL.h, HALL.z1], [HALL.x1, HALL.h, HALL.z0], 0.005);
for (const x of [-16.5, -5.5, 5.5, 16.5]) {
  const z = -11.5, y0 = HALL.h;
  boxEdges(x - 2.2, y0, z - 2.2, x + 2.2, y0 + 1.2, z + 2.2, 0.26);
  for (let s = -2.0; s <= 2.0; s += 0.25) seg([x + s, y0 + 0.15, z + 2.2], [x + s, y0 + 1.05, z + 2.2], 0.06);
  cylY([x, z], 1.5, y0 + 1.2, y0 + 2.4, 0.22, 5);
  ring([x, y0 + 2.4, z], 1.2, "y", 0.2, 32);
  for (let b = 0; b < 6; b++) { const a = b / 6 * Math.PI * 2; seg([x, y0 + 2.35, z], [x + Math.cos(a) * 1.15, y0 + 2.35, z + Math.sin(a) * 1.15], 0.12); }
  boxFaces(x - 2.2, y0, z - 2.2, x + 2.2, y0 + 1.2, z + 2.2, 0.01);
}
for (const x of [-11, 0, 11]) {
  const z = -3.5, y0 = HALL.h;
  boxEdges(x - 3, y0, z - 1, x + 3, y0 + 1.5, z + 1, 0.24);
  for (let s = -2.8; s <= 2.8; s += 0.2) seg([x + s, y0 + 0.1, z + 1], [x + s, y0 + 1.4, z + 1], 0.05);
  ring([x - 1.5, y0 + 1.5, z], 0.6, "y", 0.16); ring([x + 1.5, y0 + 1.5, z], 0.6, "y", 0.16);
  boxFaces(x - 3, y0, z - 1, x + 3, y0 + 1.5, z + 1, 0.01);
}
cylX(-19, 19, HALL.h + 0.5, -7.6, 0.22, 0.18, 2.5);
// 벽면 항온항습기와 소화가스 실린더
for (let s = 0; s < 6; s++) {
  const z = -1.75 - s * 3.5;
  for (const side of [-1, 1]) {
    const x = side * 24.6;
    boxEdges(x - 0.45, 0, z - 1.2, x + 0.45, 2.3, z + 1.2, 0.26);
    for (let y = 0.3; y < 2.2; y += 0.12) seg([x - side * 0.46, y, z - 1.1], [x - side * 0.46, y, z + 1.1], 0.05);
    boxFaces(x - 0.45, 0, z - 1.2, x + 0.45, 2.3, z + 1.2, 0.012);
  }
}
for (let c = 0; c < 5; c++) cylY([23.9, 1.6 - c * 0.4], 0.14, 0, 1.6, 0.16, 3, 10);

// ───────── 렌더러 ─────────
// 한 번에 그린다. 실사 랙(불투명, 깊이 기록)과 와이어(가산)를 한 장면에 두고 렌더 타깃 하나에 한 번만 그린다.
// 피사계 심도는 장면을 층마다 다시 그려 흐리는 대신, 선과 점을 초점에서 멀수록 넓고 옅게 편다 (빛의 양은 그대로).
// 선은 가우스 단면의 화면 공간 띠로 그려 MSAA 없이도 매끈하다. 빛 번짐은 1/4, 1/8 크기에서만 흐린다.
// @see docs/xray-hero-rendering.md
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.autoClear = false;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#000000", 28, 78);
const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 200);

const U = {
  uCam: { value: new THREE.Vector3() }, uFwd: { value: new THREE.Vector3() },
  uFocus: { value: 10 }, uAper: { value: 0.3 }, uCut: { value: 0.3 },
  uGlow: { value: 0 }, uLime: { value: new THREE.Vector3(LIME.r, LIME.g, LIME.b) }, uT: { value: 0 }, uPx: { value: 1000 }, uReach: { value: 80 },
  uScanR: { value: 0 }, uScanK: { value: 0 }, uOrigin: { value: new THREE.Vector2(tx, tz) },
  uRes: { value: new THREE.Vector2(1, 1) }, uBlur: { value: 1 }, uPeel: { value: new THREE.Vector4(0, 0, -1, 1e5) },
};
const UNI = /* glsl */`
uniform vec3 uCam; uniform vec3 uFwd; uniform float uFocus; uniform float uAper; uniform float uCut;
uniform float uMirror; uniform float uGlow; uniform vec3 uLime; uniform float uReach; uniform float uSolidK; uniform float uSharp;
uniform float uScanR; uniform float uScanK; uniform vec2 uOrigin; uniform vec2 uRes; uniform float uBlur; uniform float uT; uniform float uPx;
// 초점에서 벗어난 정도 0..1. 예전 3겹(선명, 중간, 먼 층) 나눔과 같은 기준
float coc(float dz){ return clamp(abs(dz - uFocus) * uAper / max(dz, 0.4), 0., 1.); }
// 흐림 폭(가우스 σ, 렌더 타깃 px). 예전 중간 층은 σ 약 2px, 먼 층은 약 6~7px 이었다
float blurPx(float c){ return uSharp > 0.5 ? 0. : uBlur * (2.0 * smoothstep(0.10, 0.40, c) + 5.5 * smoothstep(0.45, 0.92, c)); }
// 예전 층별 밝기 0.85(중간), 0.6(먼 층)
float dofGain(float c){ return 1. - 0.15 * smoothstep(0.10, 0.40, c) - 0.25 * smoothstep(0.45, 0.92, c); }
`;
const SHADE = /* glsl */`
vec3 shade(vec3 W, float br, float lime){
  vec3 d3 = W - uCam; float dz = dot(d3, uFwd); float dist = length(d3);
  float cut = smoothstep(uCut, uCut + 0.25, dz);
  float fog = exp(-max(dist - 6., 0.) * 0.03) * exp(-max(dz - uFocus - 1.5, 0.) * 0.16);
  float reach = 1. - smoothstep(uReach - 6., uReach, dz);
  // 투시 깊이 안쪽은 와이어, 바깥은 실사 랙 사이로 비치는 구조선 (uSolidK = 0 이면 안쪽만)
  float rk = reach + uSolidK * 1.7 * (1. - reach);
  float b = br * 0.8 * fog * cut * rk;
  float lg = lime * clamp(uGlow * 3., 0., 1.);
  vec3 col = mix(vec3(b), uLime * min(b * (1.0 + 1.6 * uGlow), 0.8), lg);
  // 측정한 랙에서 퍼지는 라임 스캔: 파면이 지나가면 잠깐 연결된 채로 남는다
  float dS = length(W.xz - uOrigin) + abs(W.y - 1.1) * 0.25;
  float fr = exp(-pow((dS - uScanR) / 0.8, 2.)) * uScanK;
  float inside = 1. - smoothstep(uScanR - 1.0, uScanR + 0.3, dS);
  float sf = exp(-max(dist - 6., 0.) * 0.012);
  float sb = br * 0.8 * cut * rk * sf;
  float trail = inside * exp(-max(uScanR - dS, 0.) / 3.) * uScanK;
  float wS = clamp(fr * 1.6 + trail * 0.5, 0., 1.) * (1. - lg);
  col = mix(col, uLime * sb * (1.0 + 3.0 * fr), wS);
  if (uMirror > 0.5) col *= 0.15 * exp(W.y * 0.8);
  return col;
}`;

// 선: 선분마다 꼭짓점 4개짜리 띠. 양 끝을 화면에 투영한 뒤 수직으로 넓힌다
const LINE_K = 0.75;      // 예전 1.5배 내부 해상도의 1px 선과 밝기를 맞추는 값
const lineVS = (ends) => UNI + /* glsl */`
attribute float aEnd; attribute float aSide; attribute float aLime;
varying float vB; varying float vLime; varying vec3 vW; varying float vX; varying float vK;
void main(){
  vec3 p0, p1; float br;
  ${ends}
  if (uMirror > 0.5) { p0.y = -p0.y; p1.y = -p1.y; }
  vec4 v0 = viewMatrix * vec4(p0, 1.), v1 = viewMatrix * vec4(p1, 1.);
  const float NZ = -0.06;
  if (v0.z > NZ && v1.z > NZ) { gl_Position = vec4(2., 2., 2., 1.); return; }
  // 카메라 뒤로 넘어간 끝은 근평면까지 잘라 쓴다
  float tc = (NZ - v0.z) / (v1.z - v0.z);
  float t0 = v0.z > NZ ? tc : 0., t1 = v1.z > NZ ? tc : 1.;
  vec4 a = mix(v0, v1, t0), b = mix(v0, v1, t1);
  vec4 ca = projectionMatrix * a, cb = projectionMatrix * b;
  vec2 d = cb.xy / cb.w - ca.xy / ca.w; d *= uRes * 0.5;
  float L = length(d); d = L > 1e-4 ? d / L : vec2(1., 0.);
  vec2 n = vec2(-d.y, d.x);
  bool e0 = aEnd < 0.5;
  vec4 c = e0 ? ca : cb;
  float dz = -(e0 ? a.z : b.z);
  float cc = coc(dz);
  float s = sqrt(0.36 + pow(blurPx(cc), 2.));
  float hw = 2.5 * s;
  c.xy += n * aSide * hw / (uRes * 0.5) * c.w;
  gl_Position = c;
  vW = mix(p0, p1, e0 ? t0 : t1);
  vX = aSide; vB = br; vLime = aLime;
  vK = dofGain(cc) / (s * 2.5066) * ${LINE_K.toFixed(3)};
}`;
const LINE_FS = UNI + SHADE + /* glsl */`
varying float vB; varying float vLime; varying vec3 vW; varying float vX; varying float vK;
void main(){ float a = exp(-vX * vX * 3.125); gl_FragColor = vec4(shade(vW, vB, vLime) * a * vK, 1.); }`;
const STATIC_ENDS = `p0 = aP0; p1 = aP1; br = aB;`;

const VS_FACE = UNI + /* glsl */`
attribute float aB; attribute float aLime;
varying float vB; varying float vLime; varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); if (uMirror > 0.5) w.y = -w.y;
  vW = w.xyz; vB = aB; vLime = aLime; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS_FACE = UNI + SHADE + /* glsl */`
varying float vB; varying float vLime; varying vec3 vW;
void main(){ float dz = dot(vW - uCam, uFwd); gl_FragColor = vec4(shade(vW, vB, vLime) * dofGain(coc(dz)), 1.); }`;
// LED 점: 초점에서 멀수록 커지고 옅어진다 (보케)
const VS_PT = UNI + /* glsl */`
attribute float aB; attribute float aLime; attribute float aPh; attribute float aK;
varying float vB; varying float vLime; varying vec3 vW; varying float vSoft;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); if (uMirror > 0.5) w.y = -w.y;
  vW = w.xyz; vLime = aLime; vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv;
  float s = clamp(0.016 * uPx / max(-mv.z, 0.05), 1.4, 28.0);
  float cc = coc(-mv.z), bl = 4. * blurPx(cc);
  float S = min(s + bl, 64.);
  gl_PointSize = S;
  vSoft = bl / S;
  vB = aB * min(1., s / 1.4) * (s * s) / (S * S) * dofGain(cc) * (0.9 + 0.1 * sin(6.2831853 * (uT * aK + aPh))); }`;
const FS_PT = UNI + SHADE + /* glsl */`
varying float vB; varying float vLime; varying vec3 vW; varying float vSoft;
void main(){ float r = length(gl_PointCoord - 0.5) * 2.; float a = smoothstep(1., 0.15 * (1. - vSoft), r);
  gl_FragColor = vec4(shade(vW, vB * a * 0.9, vLime), 1.); }`;

const shaderMat = (vs, fs, { mirror = 0, solidK = 1, sharp = 0, depthTest = true } = {}) => new THREE.ShaderMaterial({
  vertexShader: vs, fragmentShader: fs,
  uniforms: { ...U, uMirror: { value: mirror }, uSolidK: { value: solidK }, uSharp: { value: sharp } },
  transparent: true, depthTest, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
function lineGeo(n, perSeg) {      // perSeg(i, end) → { attr: value[] } 를 채운다
  const g = new THREE.BufferGeometry();
  const idx = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) { const v = i * 4; idx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6); }
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const end = new Float32Array(n * 4), side = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) { end[i] = (i & 2) ? 1 : 0; side[i] = (i & 1) ? 1 : -1; }
  g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
  g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  for (const [k, { size, fn }] of Object.entries(perSeg)) {
    const a = new Float32Array(n * 4 * size);
    for (let i = 0; i < n; i++) for (let v = 0; v < 4; v++) a.set(fn(i, v >> 1), (i * 4 + v) * size);
    g.setAttribute(k, new THREE.BufferAttribute(a, size));
  }
  g.setAttribute("position", g.getAttribute(perSeg.aP0 ? "aP0" : "aA"));
  return g;
}
const nSeg = LN.b.length / 2;
const gL = lineGeo(nSeg, {
  aP0: { size: 3, fn: (i) => LN.p.slice(i * 6, i * 6 + 3) },
  aP1: { size: 3, fn: (i) => LN.p.slice(i * 6 + 3, i * 6 + 6) },
  aB: { size: 1, fn: (i, e) => [LN.b[i * 2 + e]] },
  aLime: { size: 1, fn: (i, e) => [LN.l[i * 2 + e]] },
});
const LINE_STATIC_VS = lineVS(STATIC_ENDS).replace("attribute float aEnd;", "attribute vec3 aP0; attribute vec3 aP1; attribute float aB; attribute float aEnd;");
const gF = new THREE.BufferGeometry();
gF.setAttribute("position", new THREE.Float32BufferAttribute(FC.p, 3));
gF.setAttribute("aB", new THREE.Float32BufferAttribute(FC.b, 1));
gF.setAttribute("aLime", new THREE.Float32BufferAttribute(FC.l, 1));
const gP = new THREE.BufferGeometry();
gP.setAttribute("position", new THREE.Float32BufferAttribute(PT.p, 3));
for (const [k, v] of Object.entries({ aB: PT.b, aLime: PT.l, aPh: PT.ph, aK: PT.k })) gP.setAttribute(k, new THREE.Float32BufferAttribute(v, 1));
const add = (o, order) => { o.frustumCulled = false; o.renderOrder = order; scene.add(o); return o; };
// 바닥 반사(거울상)는 흐림 없이 가는 선과 점만. 반투명 바닥 아래에 먼저 그린다
const mirrorObjs = [];
mirrorObjs.push(add(new THREE.Mesh(gL, shaderMat(LINE_STATIC_VS, LINE_FS, { mirror: 1, sharp: 1 })), 1));
mirrorObjs.push(add(new THREE.Points(gP, shaderMat(VS_PT, FS_PT, { mirror: 1, solidK: 0, sharp: 1 })), 1));
add(new THREE.Mesh(gL, shaderMat(LINE_STATIC_VS, LINE_FS)), 4);
add(new THREE.Mesh(gF, shaderMat(VS_FACE, FS_FACE)), 4);
add(new THREE.Points(gP, shaderMat(VS_PT, FS_PT, { solidK: 0 })), 4);

// 공기 흐름 (회색 얇은 입자 줄기)
{
  const A = [], B = [], ph = [], kk = [], br = [], wob = [];
  const flow = (a, b, p, k, w, brt) => { A.push(a); B.push(b); ph.push(p); kk.push(k); wob.push(w); br.push(brt); };
  const cold = [2.1]; const hot = [];
  for (let i = 0; i < ROWS - 1; i++) (i % 2 === 0 ? hot : cold).push(rowZ(i) - PITCH / 2);
  let s = 0;
  for (const z of cold) for (let n = 0; n < 520; n++, s++) {
    const r = (j) => hash(s, j, 7.3);
    const x = X0 + r(1) * (totalW - 8), y = 0.2 + r(2) * 1.9, dz = (r(3) - 0.5) * 1.4;
    const dir = r(4) > 0.5 ? 1 : -1;
    flow([x, y, z + dz], [x + dir * (6 + r(5) * 4), y + (r(6) - 0.5) * 0.5, z + dz * 0.6], r(7), 1, 1 + Math.floor(r(8) * 3), 0.05 + r(9) * 0.05);
  }
  for (const z of cold) for (let n = 0; n < 160; n++, s++) {
    const r = (j) => hash(s, j, 3.1);
    const x = X0 + r(1) * totalW, zz = z + (r(2) - 0.5) * 1.2;
    flow([x, 0.03, zz], [x + (r(3) - 0.5) * 0.6, 1.6 + r(4) * 0.6, zz + (r(5) > 0.5 ? 0.9 : -0.9)], r(6), 1, 1, 0.07);
  }
  for (const z of hot) for (let n = 0; n < 280; n++, s++) {
    const r = (j) => hash(s, j, 5.9);
    const x = X0 + r(1) * totalW, zz = z + (r(2) - 0.5) * 0.9;
    flow([x, 0.5 + r(3) * 1.5, zz], [x + (r(4) - 0.5) * 2, HALL.ceil - 0.1, zz + (r(5) - 0.5) * 0.4], r(6), 1, 1 + Math.floor(r(7) * 2), 0.06);
  }
  const g = lineGeo(A.length, {
    aA: { size: 3, fn: (i) => A[i] }, aB3: { size: 3, fn: (i) => B[i] },
    aPh: { size: 1, fn: (i) => [ph[i]] }, aK: { size: 1, fn: (i) => [kk[i]] },
    aWob: { size: 1, fn: (i) => [wob[i]] }, aBr: { size: 1, fn: (i) => [br[i]] },
  });
  // 줄기 머리(끝 0)와 0.03 뒤의 꼬리(끝 1)를 매 프레임 셰이더에서 계산한다
  const vs = lineVS(/* glsl */`
    float f = fract(aPh + uT * aK);
    vec3 q[2];
    for (int e = 0; e < 2; e++) {
      float ft = clamp(f - float(e) * 0.03, 0., 1.);
      vec3 p = mix(aA, aB3, ft);
      p.y += sin(ft * 6.2831853 * aWob + aPh * 40.) * 0.05;
      p.z += cos(ft * 6.2831853 * aWob + aPh * 23.) * 0.04;
      q[e] = p;
    }
    p0 = q[0]; p1 = q[1];
    br = aBr * pow(sin(3.14159265 * f), 1.4) * (aEnd < 0.5 ? 1. : 0.15);`)
    .replace("attribute float aEnd;", "attribute vec3 aA; attribute vec3 aB3; attribute float aPh; attribute float aK; attribute float aWob; attribute float aBr; attribute float aEnd;");
  add(new THREE.Mesh(g, shaderMat(vs, LINE_FS, { solidK: 0 })), 4);
}

// 대상 랙 후광과 바닥 반사광 (라임, 대상 랙에서만)
const glowMat = (strength, shape) => new THREE.ShaderMaterial({
  uniforms: { ...U, uMirror: { value: 0 }, uSolidK: { value: 0 }, uSharp: { value: 0 }, uS: { value: strength } }, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: UNI + `uniform float uS; varying vec2 vUv; varying vec3 vW;
    void main(){ vec2 q = (vUv - 0.5) * 2.; ${shape}
      vec3 d3 = vW - uCam; float dz = dot(d3, uFwd);
      float cut = smoothstep(uCut, uCut + 0.25, dz);
      gl_FragColor = vec4(uLime * a * uS * uGlow * cut * dofGain(coc(dz)), 1.); }`,
});
const halo = add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.8), glowMat(0.045, "float a = exp(-dot(q*vec2(1.6,1.1), q*vec2(1.6,1.1)) * 2.2);")), 4);
halo.position.set(tx, 1.1, tz);
const pool = add(new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), glowMat(0.05, "float a = exp(-dot(q*vec2(1.0,1.5), q*vec2(1.0,1.5)) * 3.0);")), 4);
pool.rotation.x = -Math.PI / 2; pool.position.set(tx, 0.006, tz + 0.9);
// 바닥을 따라 번지는 스캔 링. 투시 안쪽은 예전에 와이어와 실사 두 번 그려지던 밝기(1 + reach)를 그대로 쓴다
const ringMat = new THREE.ShaderMaterial({
  uniforms: { ...U, uMirror: { value: 0 }, uSolidK: { value: 1 }, uSharp: { value: 0 } }, transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: UNI + `varying vec3 vW;
    void main(){ vec3 d3 = vW - uCam; float dz = dot(d3, uFwd);
      float r = length(vW.xz - uOrigin);
      float ring = exp(-pow((r - uScanR) / 0.45, 2.)) + 0.35 * exp(-pow((r - uScanR + 1.6) / 1.2, 2.));
      float wash = (1. - smoothstep(uScanR - 1., uScanR, r)) * exp(-max(uScanR - r, 0.) / 3.5) * uScanK;
      float g = max(1. - abs(fract(vW.x / 0.6) - 0.5) * 40., 0.) + max(1. - abs(fract(vW.z / 0.6) - 0.5) * 40., 0.);
      float edge = 1. - smoothstep(26., 34., r);
      float cut = smoothstep(uCut, uCut + 0.25, dz);
      float reach = 1. - smoothstep(uReach - 6., uReach, dz);
      float a = (ring * 0.20 * uScanK + wash * (0.03 + 0.12 * g)) * edge * cut * (1. + reach);
      gl_FragColor = vec4(uLime * a, 1.); }`,
});
const scanFloor = add(new THREE.Mesh(new THREE.PlaneGeometry(80, 80), ringMat), 3);
scanFloor.rotation.x = -Math.PI / 2; scanFloor.position.set(tx, 0.008, tz);


// ───────── 실사: 같은 공간의 불투명 랙, 반사 바닥 (투시 전에 보이는 모습) ─────────
const PEEL = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e5);       // 카메라 앞 투시 깊이까지 걷어 낸다
{
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  pm.dispose();
}
scene.add(new THREE.HemisphereLight("#ffffff", "#000000", 0.18));
const cnv = (w, h, fn) => { const c = document.createElement("canvas"); c.width = w; c.height = h; fn(c.getContext("2d"), w, h); return c; };
function rackFront(seed) {
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const W2 = 128, H2 = 470, slots = [];
  const n = 21, y0 = H2 * 0.05, uh = (H2 * 0.9) / n;
  for (let j = 0; j < n; j++) slots.push(r() > 0.14 ? (r() > 0.7 ? 2 : 1) : 0);
  const base = cnv(W2, H2, (g) => {
    g.fillStyle = "#08090a"; g.fillRect(0, 0, W2, H2);
    g.strokeStyle = "#3a3c40"; g.lineWidth = 3; g.strokeRect(4, 4, W2 - 8, H2 - 8);
    slots.forEach((k, j) => {
      const y = y0 + j * uh;
      if (!k) { g.fillStyle = "#0e0f11"; g.fillRect(12, y + 1, W2 - 24, uh - 2); return; }
      g.fillStyle = "#1b1c1f"; g.fillRect(12, y + 1, W2 - 24, uh - 2);
      g.fillStyle = "#2c2e32"; for (let x = 30; x < W2 - 18; x += 5) g.fillRect(x, y + 4, 2, uh - 8);
      g.fillStyle = "#4a4c50"; g.fillRect(14, y + 2, 10, uh - 4);
    });
  });
  const emi = cnv(W2, H2, (g) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, W2, H2);
    slots.forEach((k, j) => {
      if (!k) return;
      const y = y0 + j * uh;
      g.fillStyle = k === 2 ? "#5a5a5a" : "#262626"; for (let x = 30; x < W2 - 18; x += 5) g.fillRect(x, y + 4, 2, uh - 8);
      g.fillStyle = "#ffffff"; g.fillRect(16, y + uh * 0.3, 4, 4); if (r() > 0.4) g.fillRect(16, y + uh * 0.62, 4, 3);
    });
  });
  const t = new THREE.CanvasTexture(base), e = new THREE.CanvasTexture(emi);
  t.colorSpace = e.colorSpace = THREE.SRGBColorSpace; t.anisotropy = e.anisotropy = 8;
  return scanify(new THREE.MeshStandardMaterial({ map: t, emissiveMap: e, emissive: "#ffffff", emissiveIntensity: 2.4, metalness: 0.55, roughness: 0.42 }));
}
const rearTex = new THREE.CanvasTexture(cnv(64, 235, (g, w, h) => { g.fillStyle = "#0a0b0c"; g.fillRect(0, 0, w, h); g.fillStyle = "#1c1d20"; for (let y = 8; y < h - 8; y += 4) for (let x = 6; x < w - 6; x += 4) g.fillRect(x, y, 2, 2); }));
rearTex.colorSpace = THREE.SRGBColorSpace;
const sideM = scanify(new THREE.MeshStandardMaterial({ color: "#101113", metalness: 0.7, roughness: 0.35 }));
const topM = scanify(new THREE.MeshStandardMaterial({ color: "#16171a", metalness: 0.6, roughness: 0.5 }));
const rearM = scanify(new THREE.MeshStandardMaterial({ map: rearTex, metalness: 0.6, roughness: 0.45 }));
// 스캐너 빛: 외관 전경에서 측정한 랙 자리부터 바깥으로 스쳐 지나간다.
// 투시 깊이까지 걷어 내기(PEEL)도 여기서 직접 버린다. three 의 clippingPlanes 를 쓰면 compileAsync 가
// 클리핑 없는 프로그램을 만들어 두고, 첫 프레임에서 클리핑 있는 프로그램을 다시 동기 컴파일해 화면이 멈춘다.
function scanify(mat, scan = true) {
  mat.customProgramCacheKey = () => (scan ? "xr-scan" : "xr-peel");
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uScanR: U.uScanR, uScanK: U.uScanK, uOrigin: U.uOrigin, uLimeS: U.uLime, uPeel: U.uPeel });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vScanW;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 sw = vec4(transformed, 1.);
        #ifdef USE_INSTANCING
          sw = instanceMatrix * sw;
        #endif
        vScanW = (modelMatrix * sw).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vScanW; uniform float uScanR; uniform float uScanK; uniform vec2 uOrigin; uniform vec3 uLimeS; uniform vec4 uPeel;")
      .replace("#include <clipping_planes_fragment>", "if (dot(vScanW, uPeel.xyz) + uPeel.w < 0.) discard;");
    if (scan) sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float sd = length(vScanW.xz - uOrigin) + abs(abs(vScanW.y) - 1.1) * 0.25;
        float sfr = exp(-pow((sd - uScanR) / 0.35, 2.));
        float str = (1. - smoothstep(uScanR - 0.6, uScanR + 0.2, sd)) * exp(-max(uScanR - sd, 0.) / 2.5);
        totalEmissiveRadiance += uLimeS * (sfr * 0.55 + str * 0.04) * uScanK;`);
  };
  return mat;
}
const STRIP = scanify(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.4) }), false);
const mirror = new THREE.Group(); mirror.scale.y = -1; scene.add(mirror);
mirrorObjs.push(mirror);
{
  const VAR = 4, groups = Array.from({ length: VAR }, () => []);
  RACKS.forEach((r, i) => groups[i % VAR].push(r));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const box = new THREE.BoxGeometry(1, 1, 1);
  groups.forEach((rs, gi) => {
    const mats = [sideM, sideM, topM, topM, rackFront(1234 + gi * 77), rearM];
    for (const parent of [scene, mirror]) {
      const mesh = new THREE.InstancedMesh(box, mats, rs.length);
      rs.forEach((r, k) => { q.setFromAxisAngle(up, r.f > 0 ? 0 : Math.PI); m.compose(new THREE.Vector3(r.cx, RH / 2, r.zc), q, new THREE.Vector3(RW - 0.012, RH, RD)); mesh.setMatrixAt(k, m); });
      parent.add(mesh);
    }
  });
  // 랙 밑 흰 조명줄 (실제 발광)
  const stripGeo = new THREE.BoxGeometry(groupW, 0.03, 0.05);
  for (let i = 0; i < ROWS; i++) for (let g = 0; g < NG; g++) {
    const xa = X0 + g * (groupW + GAP), f = i % 2 === 0 ? 1 : -1, z = rowZ(i) + f * (RD / 2 + 0.05);
    for (const parent of [scene, mirror]) { const b = new THREE.Mesh(stripGeo, STRIP); b.position.set(xa + groupW / 2, 0.02, z); parent.add(b); }
  }
  // 광택 바닥: 아래 거울상 위에 반투명 검정 판. 깊이를 쓰지 않아 바닥 위 선이 바닥과 다투지 않는다
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: "#000000", metalness: 0.0, roughness: 1.0, envMapIntensity: 0, transparent: true, opacity: 0.8, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = 2; scene.add(floor);
}

// ───────── 카메라 경로 (밀고 들어갔다가 이즈백) ─────────
const path = new THREE.CatmullRomCurve3([
  new THREE.Vector3(8.5, 2.0, 9.0),
  new THREE.Vector3(5.5, 1.8, 5.0),
  new THREE.Vector3(2.6, 1.5, 1.6),
  new THREE.Vector3(1.0, 1.25, -1.2),
  new THREE.Vector3(0.0, 1.05, -3.3),
], false, "centripetal");
const LOOK_A = new THREE.Vector3(-3.0, 2.4, -2.5), LOOK_B = new THREE.Vector3(tx, 1.15, tz + RD / 2);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const tmpL = new THREE.Vector3();
function setTime(t) {               // t: 0..1 (한 루프)
  const so = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };   // 빠져나올 때는 조금 더 일찍 움직인다
  const ss = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (6 * x - 15) + 10); };
  // e = 1: 라임 랙 앞(내부), e = 0: 외관. 0~0.05 머묾 → 0.05~0.64 빠져나옴 → 0.64~0.70 머묾 → 0.70~1 다시 들어감
  const e0 = t < 0.05 ? 1 : t < 0.64 ? 1 - so((t - 0.05) / 0.59) : t < 0.70 ? 0 : ss((t - 0.70) / 0.30);
  // Scrolling the hero pushes the camera back in through the peel toward the lime rack, whatever the loop is doing.
  const s = Math.max(0, Math.min(1, getProgress()));
  const e = e0 + (0.92 - e0) * s;
  cam.position.copy(path.getPoint(e));
  tmpL.copy(LOOK_A).lerp(LOOK_B, sm(0.0, 0.9, e));
  cam.fov = 54 - 18 * sm(0.0, 1.0, e); cam.updateProjectionMatrix();
  cam.lookAt(tmpL); cam.updateMatrixWorld();
  U.uCam.value.copy(cam.position);
  cam.getWorldDirection(U.uFwd.value);
  U.uFocus.value = TFRONT.clone().sub(cam.position).dot(U.uFwd.value);
  U.uAper.value = 1.25 * sm(0.45, 1.0, e);
  U.uGlow.value = sm(0.5, 0.85, e) * (0.88 + 0.12 * Math.sin(2 * Math.PI * 3 * t));
  // 외관 전경이 드러난 뒤, 측정한 랙 자리에서 바깥으로 스캐너 빛이 한 번 스쳐 지나간다
  const sl = Math.min(1, Math.max(0, (t - 0.45) / 0.24));
  U.uScanR.value = 36 * (sl * sl * (3 - 2 * sl) * 0.6 + sl * 0.4);
  U.uScanK.value = sm(0.44, 0.47, t) * (1 - sm(0.64, 0.70, t));
  // 외관 사진: 천천히 밀려 들어가다가, 투시가 깊어지며 와이어 내부로 넘어간다
  U.uReach.value = 80 * Math.pow(sm(0.2, 0.56, e), 1.4);
  STRIP.color.setScalar(2.4 * (1 - sm(0.08, 0.26, e)));   // 투시가 시작되면 조명줄은 조용히 꺼진다
  PEEL.normal.copy(U.uFwd.value); PEEL.constant = -(U.uFwd.value.dot(cam.position) + U.uReach.value);
  U.uPeel.value.set(PEEL.normal.x, PEEL.normal.y, PEEL.normal.z, PEEL.constant);
  U.uT.value = t;
  halo.quaternion.copy(cam.quaternion);
}

// ───────── 품질 단계 ─────────
// 실제 프레임 시간을 재서 한 단계씩만 내려가고 다시 올리지 않는다 (오르내림 반복 방지).
// 선은 단면을 직접 부드럽게 그리므로 MSAA를 꺼도 깨지지 않는다. MSAA는 실사 랙 모서리에만 쓰인다.
// ?xq=0|1|2 로 단계를 고정하고 ?xt=0..1 로 루프 시점을 멈춰 비교할 수 있다.
const TIERS = [
  { ss: 1, samples: 4, bloom: true, mirror: true },
  { ss: 1, samples: 0, bloom: true, mirror: true },
  { ss: 0.8, samples: 0, bloom: false, mirror: false },
];
const params = new URLSearchParams(location.search);
const forced = params.get("xq");
const frozen = params.get("xt") !== null ? Math.min(1, Math.max(0, +params.get("xt"))) : null;
let tier = forced !== null && TIERS[+forced] ? +forced : 0;
const adaptive = forced === null;
const applyMirror = () => { for (const o of mirrorObjs) o.visible = TIERS[tier].mirror; };
applyMirror();

// ───────── 후처리: 빛 번짐 + 톤 + 가장자리 ─────────
let W = 0, H = 0, rtMain, rtB1, rtB1b, rtB2, rtB2b;
const rtOpt = (samples = 0, depthBuffer = false) => ({ type: THREE.HalfFloatType, samples, depthBuffer });
const fsq = new FullScreenQuad();
const VS_Q = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
// 밝은 부분만 1/4 크기로 줄여 담는다 (예전 번짐 문턱값 0.6)
const brightMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, px: { value: new THREE.Vector2() } }, vertexShader: VS_Q,
  fragmentShader: `uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
    vec3 tap(vec2 o){ vec3 c = texture2D(t, vUv + o * px).rgb; float l = dot(c, vec3(0.299, 0.587, 0.114)); return c * smoothstep(0.6, 0.7, l); }
    void main(){ gl_FragColor = vec4((tap(vec2(-1.,-1.)) + tap(vec2(1.,-1.)) + tap(vec2(-1.,1.)) + tap(vec2(1.,1.))) * 0.25, 1.); }` });
const copyMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, px: { value: new THREE.Vector2() } }, vertexShader: VS_Q,
  fragmentShader: `uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
    void main(){ gl_FragColor = vec4((texture2D(t, vUv + vec2(-.5,-.5) * px).rgb + texture2D(t, vUv + vec2(.5,-.5) * px).rgb + texture2D(t, vUv + vec2(-.5,.5) * px).rgb + texture2D(t, vUv + vec2(.5,.5) * px).rgb) * 0.25, 1.); }` });
const blurMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: VS_Q,
  fragmentShader: `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t,vUv).rgb*0.2270270;
      c += (texture2D(t,vUv+dir*1.3846).rgb + texture2D(t,vUv-dir*1.3846).rgb)*0.3162162;
      c += (texture2D(t,vUv+dir*3.2308).rgb + texture2D(t,vUv-dir*3.2308).rgb)*0.0702703;
      gl_FragColor = vec4(c,1.); }` });
const outMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, b1: { value: null }, b2: { value: null }, bk: { value: 1 }, wide: { value: 1 } }, vertexShader: VS_Q,
  fragmentShader: `uniform sampler2D t; uniform sampler2D b1; uniform sampler2D b2; uniform float bk; uniform float wide; varying vec2 vUv;
    vec3 srgb(vec3 c){ c = clamp(c,0.,1.); return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-0.055, step(0.0031308,c)); }
    void main(){
      vec3 c = texture2D(t,vUv).rgb;
      if (bk > 0.) c += (texture2D(b1,vUv).rgb * 0.75 + texture2D(b2,vUv).rgb * 1.0) * 0.36 * bk;
      c *= 1.25; float m = max(max(c.r,c.g),c.b); if (m > 0.0001) c *= (m * (1. + m / 9.) / (1. + m)) / m * 1.35;
      // 홈페이지용 가장자리: 왼쪽(글 영역)과 위아래가 검정으로 자연스럽게 녹아든다
      float u = vUv.x, y = vUv.y;
      float mk = mix(1., smoothstep(0.04, 0.6, u), wide);
      mk *= smoothstep(0.0, 0.16, y) * smoothstep(1.0, 0.86, y) * mix(1., smoothstep(1.0, 0.975, u), wide);
      c *= mk * mk * (3. - 2. * mk);
      float d = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898,78.233))) * 43758.5453) - 0.5;
      gl_FragColor = vec4(srgb(c) + d/255., 1.); }` });

function resize(w, h) {
  W = w; H = h;
  renderer.setSize(w, h, true);
  const q = TIERS[tier];
  const iw = Math.max(1, Math.round(w * q.ss)), ih = Math.max(1, Math.round(h * q.ss));
  [rtMain, rtB1, rtB1b, rtB2, rtB2b].forEach(r => r && r.dispose());
  rtMain = new THREE.WebGLRenderTarget(iw, ih, rtOpt(q.samples, true));
  const q4 = [Math.max(1, Math.round(iw / 4)), Math.max(1, Math.round(ih / 4))], q8 = [Math.max(1, Math.round(iw / 8)), Math.max(1, Math.round(ih / 8))];
  rtB1 = new THREE.WebGLRenderTarget(...q4, rtOpt()); rtB1b = new THREE.WebGLRenderTarget(...q4, rtOpt());
  rtB2 = new THREE.WebGLRenderTarget(...q8, rtOpt()); rtB2b = new THREE.WebGLRenderTarget(...q8, rtOpt());
  U.uRes.value.set(iw, ih);
  U.uBlur.value = ih / 900;
  cam.aspect = w / h;
  // Wide layouts: shift the framing right so the lime rack clears the headline, and fade the left edge into the copy.
  const wide = w / h > 1.2;
  if (wide) cam.setViewOffset(w, h, -w * 0.16, 0, w, h); else cam.clearViewOffset();
  cam.updateProjectionMatrix();
  outMat.uniforms.wide.value = wide ? 1 : 0;
}
function pass(mat, target) { fsq.material = mat; renderer.setRenderTarget(target); fsq.render(renderer); }
function blur(rt, tmp, scale, iters) {
  for (let i = 0; i < iters; i++) {
    const s = scale * (1 + i * 0.8);
    blurMat.uniforms.t.value = rt.texture; blurMat.uniforms.dir.value.set(s / rt.width, 0); pass(blurMat, tmp);
    blurMat.uniforms.t.value = tmp.texture; blurMat.uniforms.dir.value.set(0, s / rt.height); pass(blurMat, rt);
  }
}
function draw() {
  U.uPx.value = (rtMain.height / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  renderer.setClearColor(0x000000, 1);
  renderer.setRenderTarget(rtMain); renderer.clear(true, true, false); renderer.render(scene, cam);
  const bloomOn = TIERS[tier].bloom;
  if (bloomOn) {
    brightMat.uniforms.t.value = rtMain.texture; brightMat.uniforms.px.value.set(1 / rtMain.width, 1 / rtMain.height); pass(brightMat, rtB1);
    blur(rtB1, rtB1b, 1.0, 1);
    copyMat.uniforms.t.value = rtB1.texture; copyMat.uniforms.px.value.set(1 / rtB1.width, 1 / rtB1.height); pass(copyMat, rtB2);
    blur(rtB2, rtB2b, 1.0, 2);
  }
  outMat.uniforms.t.value = rtMain.texture; outMat.uniforms.b1.value = rtB1.texture; outMat.uniforms.b2.value = rtB2.texture;
  outMat.uniforms.bk.value = bloomOn ? 1 : 0;
  renderer.setRenderTarget(null); renderer.clear(); pass(outMat, null);
}

const fit = () => { const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight); if (w !== W || h !== H) resize(w, h); };
fit();
const still = () => frozen ?? 0;
// 셰이더 컴파일이 끝나기 전에는 그리지 않는다 (첫 렌더에서 동기 컴파일이 일어나 화면이 멈추지 않도록)
let booted = false, disposed = false, revealed = false, revealTimer = 0;
const ro = new ResizeObserver(() => { fit(); if (booted && !running) { setTime(still()); draw(); } });
ro.observe(host);
let running = false, raf = 0, visible = true, gaveUp = false;
const t0 = performance.now();
host.dataset.quality = String(tier);
function setTier(next) {
  tier = next; applyMirror();
  host.dataset.quality = String(tier);
  W = H = 0; fit();
}
// 화면에 보이기 전에 몇 프레임을 숨긴 채 돌려 이 기기에 맞는 단계를 먼저 고르고, 그다음 보여 준다.
// 숨긴 캔버스는 브라우저가 합성하지 않아 rAF 가 GPU 를 기다리지 않는다. 그래서 숨긴 동안에는 그린 뒤
// 1픽셀을 읽어(readPixels) GPU 가 실제로 끝낸 시간을 잰다. 보인 뒤에는 rAF 간격을 40프레임 또는 1.5초씩 모아 본다.
// 첫 프레임(버퍼, 텍스처 업로드)과 탭 복귀 직후의 튀는 값(1초 이상)은 버린다.
const SLOW = [24, 24, 55];          // 보인 뒤 단계별 허용 평균 간격(ms). 마지막 단계를 넘기면 정지 화면으로 둔다
const SLOW_GPU = [16, 16, 40];      // 숨긴 동안 단계별 허용 GPU 시간(ms)
const px1 = new Uint8Array(4);
let lastDraw = 0, warm = 1, acc = 0, n = 0;
function reveal() {
  if (revealed || disposed) return;
  revealed = true; clearTimeout(revealTimer);
  acc = 0; n = 0; warm = 1;
  onReady?.();
}
function measure(dt, hidden) {
  if (warm > 0) { warm--; return; }
  if (!hidden && dt > 1000) return;
  acc += dt; n++;
  const enough = hidden ? (n >= 6 || acc > 150) : (n >= 40 || (acc > 1500 && n >= 4));
  if (!enough) return;
  const avg = acc / n; acc = 0; n = 0;
  const slow = adaptive && avg > (hidden ? SLOW_GPU : SLOW)[tier];
  if (slow && tier < TIERS.length - 1) {
    setTier(tier + 1); warm = 1;
    if (hidden) { clearTimeout(revealTimer); revealTimer = 0; }   // 새 단계도 판정할 시간을 다시 준다
    return;
  }
  if (slow) { gaveUp = true; host.dataset.quality = "static"; stop(); }
  reveal();
}
const frame = (now) => {
  raf = 0; if (!running) return;
  const hidden = !revealed;
  // 판정이 어떤 이유로 끝나지 않아도 첫 프레임 4초 뒤에는 보여 준다
  if (hidden && !revealTimer) revealTimer = setTimeout(reveal, 4000);
  if (!hidden && lastDraw) measure(now - lastDraw, false);
  lastDraw = now;
  const a = performance.now();
  setTime(frozen ?? ((now - t0) / 1000 / LOOP) % 1); draw();
  if (hidden) {
    const gl = renderer.getContext();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1);
    measure(performance.now() - a, true);
  }
  if (running) raf = requestAnimationFrame(frame);
};
const start = () => { if (!booted || reduced || gaveUp || running || !visible) return; running = true; lastDraw = 0; raf = requestAnimationFrame(frame); };
const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; };
const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); });
io.observe(host);
// KHR_parallel_shader_compile 로 셰이더를 백그라운드에서 컴파일한다. 렌더 대상(타깃 또는 화면)에 따라
// 프로그램이 달라지므로 실제로 그릴 대상을 지정해 둔 채 컴파일한다.
async function boot() {
  try {
    setTime(still());
    renderer.setRenderTarget(rtMain);
    await renderer.compileAsync(scene, cam);
    const quad = new THREE.PlaneGeometry(2, 2);
    const post = (mats) => { const sc = new THREE.Scene(); for (const m of mats) { const o = new THREE.Mesh(quad, m); o.frustumCulled = false; sc.add(o); } return sc; };
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    renderer.setRenderTarget(rtB1);
    await renderer.compileAsync(post([brightMat, copyMat, blurMat]), ortho);
    renderer.setRenderTarget(null);
    await renderer.compileAsync(post([outMat]), ortho);
    quad.dispose();
  } catch (err) {
    console.warn("[xray-hero] async shader compile failed, compiling on first frame", err);
  }
  if (disposed) return;
  booted = true;
  if (reduced) { setTime(still()); draw(); reveal(); return; }
  start();
}
boot();
return {
  redraw() { if (booted && !running) { setTime(still()); draw(); } },
  dispose() {
    disposed = true; clearTimeout(revealTimer);
    stop(); ro.disconnect(); io.disconnect();
    [rtMain, rtB1, rtB1b, rtB2, rtB2b].forEach(r => r && r.dispose());
    scene.environment?.dispose?.();
    scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : [m]).forEach(x => { x?.map?.dispose?.(); x?.emissiveMap?.dispose?.(); x?.dispose?.(); }); });
    [brightMat, copyMat, blurMat, outMat].forEach(m => m.dispose()); fsq.dispose();
    renderer.dispose(); renderer.domElement.remove();
  },
};
}
