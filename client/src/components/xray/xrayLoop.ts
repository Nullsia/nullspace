// X-ray data hall loop for the home hero, ported from the standalone loop page.
// Ambient 12 s loop: starts at the lime rack, pulls out to the photoreal hall, a lime scan sweeps out from the rack, then pushes back in.
// Scroll progress (0..1) pushes the camera through the peel toward the lime rack.
/* eslint-disable */
// @ts-nocheck
import * as THREE from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export function createXrayLoop(host: HTMLElement, { getProgress, reduced }: { getProgress: () => number; reduced: boolean }) {


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
const OUT = CAPTURE ? { w: 1920, h: 1080 } : null;
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: CAPTURE, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.localClippingEnabled = true;
renderer.autoClear = false;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 200);

const U = {
  uCam: { value: new THREE.Vector3() }, uFwd: { value: new THREE.Vector3() },
  uFocus: { value: 10 }, uAper: { value: 0.3 }, uLayer: { value: 0 }, uCut: { value: 0.3 },
  uGlow: { value: 0 }, uLime: { value: new THREE.Vector3(LIME.r, LIME.g, LIME.b) }, uT: { value: 0 }, uPx: { value: 1000 }, uReach: { value: 80 },
  uScanR: { value: 0 }, uScanK: { value: 0 }, uLink: { value: 0 }, uOrigin: { value: new THREE.Vector2(tx, tz) },
};
const COMMON = /* glsl */`
uniform vec3 uCam; uniform vec3 uFwd; uniform float uFocus; uniform float uAper; uniform float uLayer;
uniform float uCut; uniform float uMirror; uniform float uGlow; uniform vec3 uLime; uniform float uReach; uniform float uSolid;
uniform float uScanR; uniform float uScanK; uniform float uLink; uniform vec2 uOrigin;
float dofW(float dz){
  float c = clamp(abs(dz - uFocus) * uAper / max(dz, 0.4), 0., 1.);
  float wS = 1. - smoothstep(0.10, 0.40, c);
  float wF = smoothstep(0.45, 0.92, c);
  float wM = max(0., 1. - wS - wF);
  return uLayer < 0.5 ? wS : (uLayer < 1.5 ? wM * 0.85 : wF * 0.6);
}
vec3 shade(vec3 W, float br, float lime){
  vec3 d3 = W - uCam; float dz = dot(d3, uFwd); float dist = length(d3);
  float cut = smoothstep(uCut, uCut + 0.25, dz);
  float scan = exp(-pow((dz - uCut - 0.12) / 0.09, 2.)) * step(uCut, dz);
  float fog = exp(-max(dist - 6., 0.) * 0.03) * exp(-max(dz - uFocus - 1.5, 0.) * 0.16);
  float reach = 1. - smoothstep(uReach - 6., uReach, dz);
  float front = exp(-pow((dz - uReach + 2.5) / 2.0, 2.)) * step(uReach, 79.);
  if (uSolid > 0.5) { reach = (1. - reach) * 1.7; front = 0.; }
  float b = br * 0.8 * fog * cut * reach;
  float lg = lime * clamp(uGlow * 3., 0., 1.);
  vec3 col = mix(vec3(b), uLime * min(b * (1.0 + 1.6 * uGlow), 0.8), lg);
  // 측정한 랙에서 퍼지는 라임 스캔: 파면이 지나가면 잠깐 연결된 채로 남는다
  float dS = length(W.xz - uOrigin) + abs(W.y - 1.1) * 0.25;
  float fr = exp(-pow((dS - uScanR) / 0.8, 2.)) * uScanK;
  float inside = 1. - smoothstep(uScanR - 1.0, uScanR + 0.3, dS);
  float sf = exp(-max(dist - 6., 0.) * 0.012);
  float sb = br * 0.8 * cut * reach * sf;
  float trail = inside * exp(-max(uScanR - dS, 0.) / 3.) * uScanK;
  float wS = clamp(fr * 1.6 + trail * 0.5, 0., 1.) * (1. - lg);
  col = mix(col, uLime * sb * (1.0 + 3.0 * fr), wS);
  if (uMirror > 0.5) col *= 0.15 * exp(W.y * 0.8);
  return col * dofW(dz);
}`;
const VS_BASIC = /* glsl */`
attribute float aB; attribute float aLime; uniform float uMirror;
varying float vB; varying float vLime; varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); if (uMirror > 0.5) w.y = -w.y;
  vW = w.xyz; vB = aB; vLime = aLime; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS_BASIC = COMMON + /* glsl */`
varying float vB; varying float vLime; varying vec3 vW;
void main(){ gl_FragColor = vec4(shade(vW, vB, vLime), 1.); }`;
const VS_PT = /* glsl */`
attribute float aB; attribute float aLime; attribute float aPh; attribute float aK;
uniform float uMirror; uniform float uT; uniform float uPx;
varying float vB; varying float vLime; varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); if (uMirror > 0.5) w.y = -w.y;
  vW = w.xyz; vLime = aLime; vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv;
  float s = 0.016 * uPx / max(-mv.z, 0.05);
  gl_PointSize = clamp(s, 2.0, 40.0);
  vB = aB * min(1., s / 2.0) * (0.9 + 0.1 * sin(6.2831853 * (uT * aK + aPh))); }`;
const FS_PT = COMMON + /* glsl */`
varying float vB; varying float vLime; varying vec3 vW;
void main(){ float r = length(gl_PointCoord - 0.5) * 2.; float a = smoothstep(1., 0.15, r);
  gl_FragColor = vec4(shade(vW, vB * a * 0.9, vLime), 1.); }`;

const mk = (vs, fs, mirror) => new THREE.ShaderMaterial({
  vertexShader: vs, fragmentShader: fs, uniforms: { ...U, uMirror: { value: mirror ? 1 : 0 } },
  transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
function geo(buf, extra = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(buf.p, 3));
  g.setAttribute("aB", new THREE.Float32BufferAttribute(buf.b, 1));
  g.setAttribute("aLime", new THREE.Float32BufferAttribute(buf.l, 1));
  for (const [k, v] of Object.entries(extra)) g.setAttribute(k, new THREE.Float32BufferAttribute(v, 1));
  return g;
}
const gL = geo(LN), gF = geo(FC), gP = geo(PT, { aPh: PT.ph, aK: PT.k });
for (const m of [0, 1]) {
  const a = new THREE.LineSegments(gL, mk(VS_BASIC, FS_BASIC, m));
  const b = new THREE.Mesh(gF, mk(VS_BASIC, FS_BASIC, m));
  const c = new THREE.Points(gP, mk(VS_PT, FS_PT, m));
  for (const o of [a, b, c]) { o.frustumCulled = false; scene.add(o); }
}

// 공기 흐름 (회색 얇은 입자 줄기)
{
  const A = [], B = [], ph = [], kk = [], end = [], br = [], wob = [];
  const add = (a, b, p, k, w, brt) => { for (const e of [0, 1]) { A.push(...a); B.push(...b); ph.push(p); kk.push(k); end.push(e); br.push(brt); wob.push(w); } };
  const cold = [2.1]; const hot = [];
  for (let i = 0; i < ROWS - 1; i++) (i % 2 === 0 ? hot : cold).push(rowZ(i) - PITCH / 2);
  let s = 0;
  for (const z of cold) for (let n = 0; n < 520; n++, s++) {
    const r = (j) => hash(s, j, 7.3);
    const x = X0 + r(1) * (totalW - 8), y = 0.2 + r(2) * 1.9, dz = (r(3) - 0.5) * 1.4;
    const dir = r(4) > 0.5 ? 1 : -1;
    add([x, y, z + dz], [x + dir * (6 + r(5) * 4), y + (r(6) - 0.5) * 0.5, z + dz * 0.6], r(7), 1, 1 + Math.floor(r(8) * 3), 0.05 + r(9) * 0.05);
  }
  for (const z of cold) for (let n = 0; n < 160; n++, s++) {
    const r = (j) => hash(s, j, 3.1);
    const x = X0 + r(1) * totalW, zz = z + (r(2) - 0.5) * 1.2;
    add([x, 0.03, zz], [x + (r(3) - 0.5) * 0.6, 1.6 + r(4) * 0.6, zz + (r(5) > 0.5 ? 0.9 : -0.9)], r(6), 1, 1, 0.07);
  }
  for (const z of hot) for (let n = 0; n < 280; n++, s++) {
    const r = (j) => hash(s, j, 5.9);
    const x = X0 + r(1) * totalW, zz = z + (r(2) - 0.5) * 0.9;
    add([x, 0.5 + r(3) * 1.5, zz], [x + (r(4) - 0.5) * 2, HALL.ceil - 0.1, zz + (r(5) - 0.5) * 0.4], r(6), 1, 1 + Math.floor(r(7) * 2), 0.06);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(A, 3));
  g.setAttribute("aA", new THREE.Float32BufferAttribute(A, 3));
  g.setAttribute("aB3", new THREE.Float32BufferAttribute(B, 3));
  for (const [k, v] of Object.entries({ aPh: ph, aK: kk, aEnd: end, aBr: br, aWob: wob })) g.setAttribute(k, new THREE.Float32BufferAttribute(v, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, uMirror: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aA; attribute vec3 aB3; attribute float aPh; attribute float aK; attribute float aEnd; attribute float aBr; attribute float aWob;
      uniform float uT; varying float vB; varying vec3 vW;
      void main(){
        float f = fract(aPh + uT * aK); float ft = clamp(f - aEnd * 0.03, 0., 1.);
        vec3 p = mix(aA, aB3, ft);
        p.y += sin(ft * 6.2831853 * aWob + aPh * 40.) * 0.05;
        p.z += cos(ft * 6.2831853 * aWob + aPh * 23.) * 0.04;
        vB = aBr * pow(sin(3.14159265 * f), 1.4) * (1. - aEnd * 0.85);
        vW = p; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: COMMON + /* glsl */`varying float vB; varying vec3 vW; void main(){ gl_FragColor = vec4(shade(vW, vB, 0.), 1.); }`,
  });
  const o = new THREE.LineSegments(g, m); o.frustumCulled = false; scene.add(o);
}

// 대상 랙 후광과 바닥 반사광 (라임, 대상 랙에서만)
const glowMat = (strength, shape) => new THREE.ShaderMaterial({
  uniforms: { ...U, uMirror: { value: 0 }, uS: { value: strength } }, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: COMMON + `uniform float uS; varying vec2 vUv; varying vec3 vW;
    void main(){ vec2 q = (vUv - 0.5) * 2.; ${shape}
      vec3 d3 = vW - uCam; float dz = dot(d3, uFwd);
      float cut = smoothstep(uCut, uCut + 0.25, dz);
      gl_FragColor = vec4(uLime * a * uS * uGlow * cut * dofW(dz), 1.); }`,
});
const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.8), glowMat(0.045, "float a = exp(-dot(q*vec2(1.6,1.1), q*vec2(1.6,1.1)) * 2.2);"));
halo.position.set(tx, 1.1, tz); halo.frustumCulled = false; scene.add(halo);
const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), glowMat(0.05, "float a = exp(-dot(q*vec2(1.0,1.5), q*vec2(1.0,1.5)) * 3.0);"));
pool.rotation.x = -Math.PI / 2; pool.position.set(tx, 0.006, tz + 0.9); pool.frustumCulled = false; scene.add(pool);
// 바닥을 따라 번지는 스캔 링
const ringMat = new THREE.ShaderMaterial({
  uniforms: { ...U, uMirror: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: COMMON + `varying vec3 vW;
    void main(){ vec3 d3 = vW - uCam; float dz = dot(d3, uFwd);
      float r = length(vW.xz - uOrigin);
      float ring = exp(-pow((r - uScanR) / 0.45, 2.)) + 0.35 * exp(-pow((r - uScanR + 1.6) / 1.2, 2.));
      float wash = (1. - smoothstep(uScanR - 1., uScanR, r)) * exp(-max(uScanR - r, 0.) / 3.5) * uScanK;
      float g = max(1. - abs(fract(vW.x / 0.6) - 0.5) * 40., 0.) + max(1. - abs(fract(vW.z / 0.6) - 0.5) * 40., 0.);
      float edge = 1. - smoothstep(26., 34., r);
      float cut = smoothstep(uCut, uCut + 0.25, dz);
      float reach = uSolid > 0.5 ? 1. : 1. - smoothstep(uReach - 6., uReach, dz);
      float a = (ring * 0.20 * uScanK + wash * (0.03 + 0.12 * g)) * edge * cut * reach;
      gl_FragColor = vec4(uLime * a * (uSolid > 0.5 ? 1. : dofW(dz)), 1.); }`,
});
const scanFloor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), ringMat);
scanFloor.rotation.x = -Math.PI / 2; scanFloor.position.set(tx, 0.008, tz); scanFloor.frustumCulled = false; scene.add(scanFloor);
const ringMatSolid = ringMat.clone(); ringMatSolid.uniforms = { ...U, uMirror: { value: 0 }, uSolid: { value: 1 } }; ringMatSolid.depthTest = true;


// ───────── 실사 장면: 같은 공간의 불투명 랙, 반사 바닥, 유리 구조선 (투시 전에 보이는 모습) ─────────
const solid = new THREE.Scene();
solid.fog = new THREE.Fog("#000000", 28, 78);
const PEEL = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e5);       // 카메라 앞 투시 깊이까지 걷어 낸다
{
  const pm = new THREE.PMREMGenerator(renderer);
  solid.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  solid.environmentIntensity = 0.32;
}
solid.add(new THREE.HemisphereLight("#ffffff", "#000000", 0.18));
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
  return scanify(new THREE.MeshStandardMaterial({ map: t, emissiveMap: e, emissive: "#ffffff", emissiveIntensity: 2.4, metalness: 0.55, roughness: 0.42, clippingPlanes: [PEEL] }));
}
const rearTex = new THREE.CanvasTexture(cnv(64, 235, (g, w, h) => { g.fillStyle = "#0a0b0c"; g.fillRect(0, 0, w, h); g.fillStyle = "#1c1d20"; for (let y = 8; y < h - 8; y += 4) for (let x = 6; x < w - 6; x += 4) g.fillRect(x, y, 2, 2); }));
rearTex.colorSpace = THREE.SRGBColorSpace;
const sideM = scanify(new THREE.MeshStandardMaterial({ color: "#101113", metalness: 0.7, roughness: 0.35, clippingPlanes: [PEEL] }));
const topM = scanify(new THREE.MeshStandardMaterial({ color: "#16171a", metalness: 0.6, roughness: 0.5, clippingPlanes: [PEEL] }));
const rearM = scanify(new THREE.MeshStandardMaterial({ map: rearTex, metalness: 0.6, roughness: 0.45, clippingPlanes: [PEEL] }));
// 스캐너 빛: 외관 전경에서 측정한 랙 자리부터 바깥으로 스쳐 지나간다
function scanify(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uScanR: U.uScanR, uScanK: U.uScanK, uOrigin: U.uOrigin, uLimeS: U.uLime });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vScanW;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 sw = vec4(transformed, 1.);
        #ifdef USE_INSTANCING
          sw = instanceMatrix * sw;
        #endif
        vScanW = (modelMatrix * sw).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vScanW; uniform float uScanR; uniform float uScanK; uniform vec2 uOrigin; uniform vec3 uLimeS;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float sd = length(vScanW.xz - uOrigin) + abs(abs(vScanW.y) - 1.1) * 0.25;
        float sfr = exp(-pow((sd - uScanR) / 0.35, 2.));
        float str = (1. - smoothstep(uScanR - 0.6, uScanR + 0.2, sd)) * exp(-max(uScanR - sd, 0.) / 2.5);
        totalEmissiveRadiance += uLimeS * (sfr * 0.55 + str * 0.04) * uScanK;`);
  };
  return mat;
}
const STRIP = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.4), clippingPlanes: [PEEL] });
const mirror = new THREE.Group(); mirror.scale.y = -1; solid.add(mirror);
{
  const VAR = 4, groups = Array.from({ length: VAR }, () => []);
  RACKS.forEach((r, i) => groups[i % VAR].push(r));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  groups.forEach((rs, gi) => {
    const mats = [sideM, sideM, topM, topM, rackFront(1234 + gi * 77), rearM];
    for (const parent of [solid, mirror]) {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mats, rs.length);
      rs.forEach((r, k) => { q.setFromAxisAngle(up, r.f > 0 ? 0 : Math.PI); m.compose(new THREE.Vector3(r.cx, RH / 2, r.zc), q, new THREE.Vector3(RW - 0.012, RH, RD)); mesh.setMatrixAt(k, m); });
      parent.add(mesh);
    }
  });
  // 랙 밑 흰 조명줄 (실제 발광)
  const strip = STRIP;
  for (let i = 0; i < ROWS; i++) for (let g = 0; g < NG; g++) {
    const xa = X0 + g * (groupW + GAP), f = i % 2 === 0 ? 1 : -1, z = rowZ(i) + f * (RD / 2 + 0.05);
    for (const parent of [solid, mirror]) { const b = new THREE.Mesh(new THREE.BoxGeometry(groupW, 0.03, 0.05), strip); b.position.set(xa + groupW / 2, 0.02, z); parent.add(b); }
  }
  // 광택 바닥: 아래 거울상 위에 반투명 검정 판
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: "#000000", metalness: 0.0, roughness: 1.0, envMapIntensity: 0, transparent: true, opacity: 0.8, clippingPlanes: [PEEL] }));
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = 2; solid.add(floor);
  const sf = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), ringMatSolid);
  sf.rotation.x = -Math.PI / 2; sf.position.set(tx, 0.012, tz); sf.renderOrder = 3; sf.frustumCulled = false; solid.add(sf);
}
// 구조선과 유리면: 와이어와 같은 형상을 깊이 검사하며 그린다 (랙 뒤는 가려진다)
const mkSolid = (o, mirror, order) => {
  const mat = new THREE.ShaderMaterial({ vertexShader: o === "pt" ? VS_PT : VS_BASIC, fragmentShader: o === "pt" ? FS_PT : FS_BASIC,
    uniforms: { ...U, uMirror: { value: mirror ? 1 : 0 }, uSolid: { value: 1 } },
    transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  return mat;
};
for (const [m, order] of [[1, 1], [0, 4]]) {
  const a = new THREE.LineSegments(gL, mkSolid("l", m)), b = new THREE.Mesh(gF, mkSolid("f", m));
  for (const o of [a, b]) { o.frustumCulled = false; o.renderOrder = order; solid.add(o); }
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
  const e = e0;
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
  U.uLink.value = 0;
  // 외관 사진: 천천히 밀려 들어가다가, 투시가 깊어지며 와이어 내부로 넘어간다
  U.uReach.value = 80 * Math.pow(sm(0.2, 0.56, e), 1.4);
  outMat.uniforms.imgK.value = 0;
  STRIP.color.setScalar(2.4 * (1 - sm(0.08, 0.26, e)));   // 투시가 시작되면 조명줄은 조용히 꺼진다
  PEEL.normal.copy(U.uFwd.value); PEEL.constant = -(U.uFwd.value.dot(cam.position) + U.uReach.value);
  U.uT.value = t;
  halo.quaternion.copy(cam.quaternion);
}

// ───────── 후처리: 3겹 피사계 심도 + 번짐 ─────────
const SS = CAPTURE ? 2 : Math.min(window.devicePixelRatio || 1, 1.5);
let W = 0, H = 0, rtS, rtM, rtF, rtM2, rtF2, rtC, rtSolid, bloom;
const rtOpt = (samples = 0) => ({ type: THREE.HalfFloatType, samples, depthBuffer: false });
const fsq = new FullScreenQuad();
const copyMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null } }, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`, fragmentShader: `uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }` });
const blurMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t,vUv).rgb*0.2270270;
      c += (texture2D(t,vUv+dir*1.3846).rgb + texture2D(t,vUv-dir*1.3846).rgb)*0.3162162;
      c += (texture2D(t,vUv+dir*3.2308).rgb + texture2D(t,vUv-dir*3.2308).rgb)*0.0702703;
      gl_FragColor = vec4(c,1.); }` });
const compMat = new THREE.ShaderMaterial({ uniforms: { s: { value: null }, m: { value: null }, f: { value: null }, o: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D s; uniform sampler2D m; uniform sampler2D f; uniform sampler2D o; varying vec2 vUv;
    void main(){ vec3 c = texture2D(s,vUv).rgb + texture2D(m,vUv).rgb + texture2D(f,vUv).rgb + texture2D(o,vUv).rgb;
      gl_FragColor = vec4(c,1.); }` });
const outMat = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, px: { value: new THREE.Vector2() }, img: { value: null }, imgK: { value: 1 }, zoom: { value: 1 }, wide: { value: 1 }, zc: { value: new THREE.Vector2(0.625, 0.344) }, fit: { value: 1.3125 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D t; uniform vec2 px; uniform sampler2D img; uniform float imgK; uniform float zoom; uniform vec2 zc; uniform float fit; uniform float wide; varying vec2 vUv;
    vec3 srgb(vec3 c){ c = clamp(c,0.,1.); return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-0.055, step(0.0031308,c)); }
    void main(){
      vec3 c = texture2D(t,vUv).rgb;
      c *= 1.25; float m = max(max(c.r,c.g),c.b); if (m > 0.0001) c *= (m * (1. + m / 9.) / (1. + m)) / m * 1.35;
      // 외관 사진 (화면 높이에 맞추고 오른쪽 정렬, zc를 중심으로 확대)
      vec2 iu = vec2(1. - (1. - vUv.x) / fit, vUv.y);
      iu = zc + (iu - zc) / zoom;
      vec3 im = texture2D(img, clamp(iu, 0.001, 0.999)).rgb;
      c = mix(c, im, imgK);
      // 홈페이지용 가장자리: 왼쪽(글 영역)과 위아래가 검정으로 자연스럽게 녹아든다
      float u = vUv.x, y = vUv.y;
      float mk = mix(1., smoothstep(0.04, 0.6, u), wide);
      mk *= smoothstep(0.0, 0.16, y) * smoothstep(1.0, 0.86, y) * mix(1., smoothstep(1.0, 0.975, u), wide);
      c *= mk * mk * (3. - 2. * mk);
      float d = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898,78.233))) * 43758.5453) - 0.5;
      gl_FragColor = vec4(srgb(c) + d/255., 1.); }` });

function resize(w, h) {
  W = w; H = h;
  renderer.setSize(w, h, !CAPTURE);
  const iw = Math.round(w * SS), ih = Math.round(h * SS);
  [rtS, rtM, rtF, rtM2, rtF2, rtC].forEach(r => r && r.dispose());
  rtS = new THREE.WebGLRenderTarget(iw, ih, rtOpt(4));
  rtM = new THREE.WebGLRenderTarget(Math.round(iw / 2), Math.round(ih / 2), rtOpt(4));
  rtM2 = new THREE.WebGLRenderTarget(Math.round(iw / 2), Math.round(ih / 2), rtOpt());
  rtF = new THREE.WebGLRenderTarget(Math.round(iw / 4), Math.round(ih / 4), rtOpt(4));
  rtF2 = new THREE.WebGLRenderTarget(Math.round(iw / 4), Math.round(ih / 4), rtOpt());
  rtC = new THREE.WebGLRenderTarget(iw, ih, rtOpt());
  if (rtSolid) rtSolid.dispose();
  rtSolid = new THREE.WebGLRenderTarget(iw, ih, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
  if (bloom) bloom.dispose();
  bloom = new UnrealBloomPass(new THREE.Vector2(Math.round(iw / 2), Math.round(ih / 2)), 0.36, 0.5, 0.6);
  cam.aspect = w / h;
  // Wide layouts: shift the framing right so the lime rack clears the headline, and fade the left edge into the copy.
  const wide = w / h > 1.2;
  if (wide) cam.setViewOffset(w, h, -w * 0.16, 0, w, h); else cam.clearViewOffset();
  cam.updateProjectionMatrix();
  outMat.uniforms.wide.value = wide ? 1 : 0;
  outMat.uniforms.fit.value = (1920 / 823) / (w / h);
}
function blur(rt, tmp, scale, iters) {
  for (let i = 0; i < iters; i++) {
    const s = scale * (1 + i * 0.8);
    blurMat.uniforms.t.value = rt.texture; blurMat.uniforms.dir.value.set(s / rt.width, 0);
    fsq.material = blurMat; renderer.setRenderTarget(tmp); fsq.render(renderer);
    blurMat.uniforms.t.value = tmp.texture; blurMat.uniforms.dir.value.set(0, s / rt.height);
    renderer.setRenderTarget(rt); fsq.render(renderer);
  }
}
function draw() {
  U.uPx.value = (rtS.height / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  renderer.setClearColor(0x000000, 1);
  const layers = [rtS, rtM, rtF];
  for (let l = 0; l < 3; l++) {
    U.uLayer.value = l;
    if (l > 0) U.uPx.value = (layers[l].height / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    renderer.setRenderTarget(layers[l]); renderer.clear(); renderer.render(scene, cam);
  }
  blur(rtM, rtM2, 1.1, 1);
  blur(rtF, rtF2, 1.2, 2);
  U.uLayer.value = 0; U.uPx.value = (rtSolid.height / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  renderer.setRenderTarget(rtSolid); renderer.clear(true, true, true); renderer.render(solid, cam);
  compMat.uniforms.o.value = rtSolid.texture;
  compMat.uniforms.s.value = rtS.texture; compMat.uniforms.m.value = rtM.texture; compMat.uniforms.f.value = rtF.texture;
  fsq.material = compMat; renderer.setRenderTarget(rtC); fsq.render(renderer);
  bloom.render(renderer, null, rtC, 0, false);
  outMat.uniforms.t.value = rtC.texture; outMat.uniforms.px.value.set(1 / rtC.width, 1 / rtC.height);
  fsq.material = outMat; renderer.setRenderTarget(null); renderer.clear(); fsq.render(renderer);
}



const fit = () => { const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight); if (w !== W || h !== H) resize(w, h); };
fit();
const ro = new ResizeObserver(() => { fit(); if (!running) { setTime(0); draw(); } });
ro.observe(host);
let running = false, raf = 0, visible = true;
// At the top of the page the loop plays on its own. Scrolling the hero scrubs the pull-out instead:
// progress 0..1 runs the loop from the first scene to the end of the exterior shot (t = 0.70),
// so the whole move outside is seen before the page moves on. Back at the top the loop restarts from the first scene.
const SCRUB_END = 0.70;
let t0 = performance.now(), last = t0, shown = 0, scrubbing = false;
const frame = () => {
  raf = 0; if (!running) return;
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  const s = Math.max(0, Math.min(1, getProgress()));
  if (s > 0.002) {
    if (!scrubbing) { scrubbing = true; if (shown > SCRUB_END) shown = 0; }
    shown += (s * SCRUB_END - shown) * Math.min(1, dt * 7);
  } else {
    if (scrubbing) { scrubbing = false; t0 = now - shown * LOOP * 1000; if (shown < 0.01) t0 = now; }
    shown = ((now - t0) / 1000 / LOOP) % 1;
  }
  setTime(shown); draw(); raf = requestAnimationFrame(frame);
};
const start = () => { if (reduced || running || !visible) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); };
const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; };
const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); });
io.observe(host);
if (reduced) { setTime(0); draw(); } else start();
return {
  redraw() { if (!running) { setTime(0); draw(); } },
  dispose() {
    stop(); ro.disconnect(); io.disconnect();
    [rtS, rtM, rtF, rtM2, rtF2, rtC, rtSolid].forEach(r => r && r.dispose()); bloom?.dispose();
    solid.environment?.dispose?.();
    solid.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : [m]).forEach(x => { x?.map?.dispose?.(); x?.emissiveMap?.dispose?.(); x?.dispose?.(); }); });
    scene.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    renderer.dispose(); renderer.domElement.remove();
  },
};
}
