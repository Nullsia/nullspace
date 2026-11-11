/**
 * 홈 X-RAY 3D 장면용 CFD 데이터.
 *
 * 형식은 n-doras 디지털 트윈과 같다 (n-doras/frontend/src/lib/twin/scene.ts, 생성기 ns-cfd-poc/dc200/export_web.py).
 *   public/twin/<key>/scene.json  배치, 랙별 3높이 흡기온도, 격자 메타
 *   public/twin/<key>/field.bin   실내 온도 3D 격자. Uint8 양자화, x 가 가장 빠른 축, 255 = 고체
 *   public/twin/<key>/flow.bin    유선. Int32 nLines, 그 뒤로 [Int32 nPts, Float32 (x y z T) * nPts] 반복
 *
 * 좌표는 CFD 원본(x, y = 바닥, z = 높이, m)이고 three.js 변환은 toThree() 한 곳에서만 한다.
 * 홈에는 캔버스가 둘(히어로, 사이클)이라 같은 시나리오를 두 번 받지 않도록 프로미스를 모듈에 캐시한다.
 * @see docs/renewal-2026-11.md
 */

export type ScenarioKey = "S0_baseline" | "S2_ai_racks" | "S3_containment" | "S4_cont_22C" | "S5_cont_fail";

export interface TwinRack {
  id: string;
  /** 열 이름 (A, B, ...) */
  row: string;
  x0: number;
  y0: number;
  w: number;
  d: number;
  h: number;
  front: "+y" | "-y";
  inletLo: number;
  inletMid: number;
  inletHi: number;
  /** AI 고밀도 랙 (S2) */
  hd?: boolean;
}

export interface TwinScene {
  key: string;
  room: { x: number; y: number; floor: number; ceil: number };
  racks: TwinRack[];
  units: { id: string; x0: number; x1: number; y0: number; y1: number; failed?: boolean }[];
  tiles: { x0: number; x1: number; y0: number; y1: number }[];
  /** [[x0,y0,z0],[x1,y1,z1]] */
  containment: [number[], number[]][];
  field: {
    nx: number;
    ny: number;
    nz: number;
    spacing: number;
    origin: [number, number, number];
    tMin: number;
    tMax: number;
    solid: number;
  };
  flow: { dt: number };
  kpi: { hottestRack: string; inletMaxC: number; racksOver27: number; rciHi: number };
  setpointC: number;
  itKW: number;
}

/** 유선 1개. pts = (x y z T) 반복, rgb = 점마다 미리 칠한 색 */
export interface FlowLine {
  pts: Float32Array;
  rgb: Float32Array;
}

export interface TwinData {
  scene: TwinScene;
  field: Uint8Array;
  lines: FlowLine[];
}

const cache = new Map<ScenarioKey, Promise<TwinData>>();

export function loadScenario(key: ScenarioKey): Promise<TwinData> {
  let p = cache.get(key);
  if (!p) {
    p = fetchScenario(key);
    // 실패한 요청은 캐시에 남기지 않는다. 다음 호출이 다시 받게 한다
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

async function fetchScenario(key: ScenarioKey): Promise<TwinData> {
  const base = `/twin/${key}`;
  const [sceneRes, fieldRes, flowRes] = await Promise.all([
    fetch(`${base}/scene.json`),
    fetch(`${base}/field.bin`),
    fetch(`${base}/flow.bin`),
  ]);
  for (const r of [sceneRes, fieldRes, flowRes]) {
    if (!r.ok) throw new Error(`twin ${key} load failed: ${r.url} HTTP ${r.status}`);
  }
  const scene = (await sceneRes.json()) as TwinScene;
  const field = new Uint8Array(await fieldRes.arrayBuffer());
  const lines = parseFlow(await flowRes.arrayBuffer());
  return { scene, field, lines };
}

function parseFlow(buf: ArrayBuffer): FlowLine[] {
  const view = new DataView(buf);
  const n = view.getInt32(0, true);
  const lines: FlowLine[] = [];
  let offset = 4;
  const c: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const count = view.getInt32(offset, true);
    offset += 4;
    const pts = new Float32Array(buf.slice(offset, offset + count * 16));
    offset += count * 16;
    // 매 프레임 색을 계산하지 않도록 점마다 한 번만 칠해 둔다
    const rgb = new Float32Array(count * 3);
    for (let k = 0; k < count; k++) {
      tempRgb(pts[k * 4 + 3], c);
      rgb[k * 3] = c[0];
      rgb[k * 3 + 1] = c[1];
      rgb[k * 3 + 2] = c[2];
    }
    lines.push({ pts, rgb });
  }
  return lines;
}

/**
 * 온도 → 색 (0~1). 홈의 CFD 그림(ParaView, 16~32℃ 파랑, 흰색, 빨강)과 같은 축을 써서
 * 2D 그림과 3D 장면에서 같은 색이 같은 온도를 뜻하게 한다.
 */
// NULL SPACE palette: cool air reads as neutral grey, heat as increasingly intense lime (#C6FF3D).
const STOPS: [number, number, number, number][] = [
  [16, 0.12, 0.12, 0.12],
  [18, 0.17, 0.17, 0.17],
  [20, 0.24, 0.24, 0.24],
  [22.5, 0.33, 0.33, 0.33],
  [25, 0.44, 0.44, 0.44],
  [26.5, 0.36, 0.46, 0.11],
  [29, 0.58, 0.75, 0.18],
  [32, 0.78, 1, 0.24],
];

export function tempRgb(t: number, out: [number, number, number]): [number, number, number] {
  if (t <= STOPS[0][0]) {
    out[0] = STOPS[0][1];
    out[1] = STOPS[0][2];
    out[2] = STOPS[0][3];
    return out;
  }
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const f = (t - a[0]) / (b[0] - a[0]);
      out[0] = a[1] + (b[1] - a[1]) * f;
      out[1] = a[2] + (b[2] - a[2]) * f;
      out[2] = a[3] + (b[3] - a[3]) * f;
      return out;
    }
  }
  const last = STOPS[STOPS.length - 1];
  out[0] = last[1];
  out[1] = last[2];
  out[2] = last[3];
  return out;
}

/** 격자 한 층(z 인덱스)을 RGBA 텍스처 바이트로. 고체 칸은 투명 */
export function fieldLayerRgba(scene: TwinScene, field: Uint8Array, k: number, alpha = 215): Uint8Array {
  const { nx, ny, tMin, tMax, solid } = scene.field;
  const out = new Uint8Array(nx * ny * 4);
  const base = k * nx * ny;
  const c: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < nx * ny; i++) {
    const q = field[base + i];
    if (q === solid) continue;
    tempRgb(tMin + (q / 254) * (tMax - tMin), c);
    out[i * 4] = Math.round(c[0] * 255);
    out[i * 4 + 1] = Math.round(c[1] * 255);
    out[i * 4 + 2] = Math.round(c[2] * 255);
    out[i * 4 + 3] = alpha;
  }
  return out;
}

/** CFD 좌표(z 위) → three.js 좌표(y 위). 오른손 좌표계를 유지하려고 y 를 -z 로 보낸다 */
export function toThree(x: number, y: number, z: number): [number, number, number] {
  return [x, z, -y];
}

/** 로봇이 측정하는 흡입 높이 [m, 바닥 기준]. N-Prover 상, 중, 하 */
export const PROBE_HEIGHTS = [0.4, 1.1, 1.7];

export interface Patrol {
  /** CFD 좌표 (x, y) 꼭짓점 */
  path: [number, number][];
  /** 꼭짓점까지 누적 거리 */
  dist: number[];
  length: number;
  /** 측정 지점 (CFD x, y, z) 과 경로상 거리 */
  probes: { x: number; y: number; z: number; at: number }[];
}

/**
 * 냉기 통로(바닥 타일이 깔린 통로)를 지그재그로 도는 순회 경로와 측정 지점.
 * 측정 지점은 통로에 앞면을 댄 랙의 앞면, 흡입 높이 3곳이다.
 */
export function buildPatrol(scene: TwinScene): Patrol {
  const tiles = [...scene.tiles].sort((a, b) => a.y0 - b.y0);
  const margin = 0.7;
  const path: [number, number][] = [];
  tiles.forEach((t, i) => {
    const y = (t.y0 + t.y1) / 2;
    const xa = t.x0 - margin;
    const xb = t.x1 + margin;
    if (i % 2 === 0) path.push([xa, y], [xb, y]);
    else path.push([xb, y], [xa, y]);
  });

  const dist = [0];
  for (let i = 1; i < path.length; i++) {
    dist.push(dist[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  }

  const probes: Patrol["probes"] = [];
  tiles.forEach((t, i) => {
    // 이 통로 구간의 시작 거리와 진행 방향
    const segStart = dist[i * 2];
    const forward = i % 2 === 0;
    const xa = t.x0 - margin;
    const xb = t.x1 + margin;
    for (const r of scene.racks) {
      const facesUp = r.front === "+y" && Math.abs(r.y0 + r.d - t.y0) < 0.05;
      const facesDown = r.front === "-y" && Math.abs(r.y0 - t.y1) < 0.05;
      if (!facesUp && !facesDown) continue;
      const x = r.x0 + r.w / 2;
      const along = forward ? x - xa : xb - x;
      const fy = facesUp ? t.y0 + 0.08 : t.y1 - 0.08;
      for (const h of PROBE_HEIGHTS) {
        probes.push({ x, y: fy, z: scene.room.floor + h, at: segStart + along });
      }
    }
  });

  return { path, dist, length: dist[dist.length - 1], probes };
}

/** 경로 위 거리 s 지점의 (x, y)와 진행 방향 각도 */
export function patrolAt(p: Patrol, s: number): { x: number; y: number; heading: number } {
  const d = ((s % p.length) + p.length) % p.length;
  let i = 1;
  while (i < p.dist.length - 1 && p.dist[i] < d) i++;
  const a = p.path[i - 1];
  const b = p.path[i];
  const seg = p.dist[i] - p.dist[i - 1] || 1;
  const f = (d - p.dist[i - 1]) / seg;
  return {
    x: a[0] + (b[0] - a[0]) * f,
    y: a[1] + (b[1] - a[1]) * f,
    heading: Math.atan2(b[1] - a[1], b[0] - a[0]),
  };
}
