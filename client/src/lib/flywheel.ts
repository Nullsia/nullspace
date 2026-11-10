/**
 * 데이터 플라이휠 3D 섹션의 일정과 데이터 계산. 화면과 무관한 순수 함수만 둔다.
 *
 * 한 바퀴 = 로봇(측정) → 데이터(축적) → 디지털 트윈(실측 보정) → CFD(예측, 불확실 구간 지정) → 다시 로봇.
 * 바퀴가 돌수록 한 바퀴 시간이 짧아지고(빨라지는 플라이휠), 로봇이 재는 범위가 불확실 구간으로 좁혀진다.
 *
 * 불확실 구간은 연출이 아니라 CFD 결과에서 고른다. 랙 흡기의 위아래 온도차와 옆 랙과의 온도차가 큰 랙일수록
 * 모델 오차가 결과를 크게 흔드는 곳이라, 그 순서로 앞에서부터 자른다. 바퀴별 개수(UNCERTAIN)는 시연용이다.
 * @see docs/renewal-2026-11.md
 */

import type { Patrol, TwinScene } from "./twin";

/** 바퀴별 길이 [초]. 뒤로 갈수록 짧아진다 */
export const LAPS = [16, 11, 7.5];
/** 마지막 바퀴 뒤 멈춰 보여주는 시간 [초] */
export const HOLD = 3.5;
/** 한 바퀴 안의 단계 비중. 순서는 STAGES 와 같다 */
const STAGE_W = [0.34, 0.22, 0.2, 0.24];
/** 바퀴마다 CFD 가 지정하는 불확실 랙 수 */
export const UNCERTAIN = [40, 16, 6];

export const STAGES = ["robot", "data", "twin", "cfd"] as const;
export type FlyStage = 0 | 1 | 2 | 3;

export const CYCLE = LAPS.reduce((a, b) => a + b, 0) + HOLD;

const STAGE_START = STAGE_W.map((_, i) => STAGE_W.slice(0, i).reduce((a, b) => a + b, 0));

export interface FlyTime {
  lap: number;
  stage: FlyStage;
  /** 단계 안 진행 0~1 */
  u: number;
  hold: boolean;
}

export function flyAt(t: number): FlyTime {
  let rest = ((t % CYCLE) + CYCLE) % CYCLE;
  for (let lap = 0; lap < LAPS.length; lap++) {
    if (rest < LAPS[lap]) {
      const f = rest / LAPS[lap];
      let stage = 0;
      while (stage < 3 && f >= STAGE_START[stage + 1]) stage++;
      return { lap, stage: stage as FlyStage, u: (f - STAGE_START[stage]) / STAGE_W[stage], hold: false };
    }
    rest -= LAPS[lap];
  }
  return { lap: LAPS.length - 1, stage: 3, u: 1, hold: true };
}

/** lap 바퀴 stage 단계의 진행 u 지점 시각 */
export function flyTimeOf(lap: number, stage: FlyStage, u = 0): number {
  const before = LAPS.slice(0, lap).reduce((a, b) => a + b, 0);
  return before + (STAGE_START[stage] + STAGE_W[stage] * u) * LAPS[lap];
}

/** 측정 지점이 있는 랙을 불확실한 순서로 정렬 */
export function rankUncertain(scene: TwinScene): string[] {
  const racks = scene.racks;
  const score = new Map<string, number>();
  for (const r of racks) {
    const vertical = Math.max(r.inletLo, r.inletMid, r.inletHi) - Math.min(r.inletLo, r.inletMid, r.inletHi);
    let side = 0;
    for (const o of racks) {
      if (o === r || o.row !== r.row) continue;
      if (Math.abs(o.x0 - r.x0) > r.w + 0.05) continue;
      side = Math.max(side, Math.abs(o.inletMid - r.inletMid), Math.abs(o.inletHi - r.inletHi));
    }
    score.set(r.id, vertical + side);
  }
  return racks.map((r) => r.id).sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0));
}

/** 측정 지점이 어느 랙 앞인지 */
export function probeRack(scene: TwinScene, p: { x: number; y: number }): string | undefined {
  return scene.racks.find(
    (r) => p.x > r.x0 && p.x < r.x0 + r.w && Math.abs((r.front === "+y" ? r.y0 + r.d : r.y0) - p.y) < 0.2,
  )?.id;
}

export interface Route {
  path: [number, number][];
  dist: number[];
  length: number;
  /** 경로 위 측정 지점: 위치(CFD 좌표)와 경로상 거리 */
  /** idx 는 전체 순찰(patrol.probes)에서의 순번 */
  probes: { x: number; y: number; z: number; at: number; rack: string; idx: number }[];
}

function withDist(path: [number, number][]): { dist: number[]; length: number } {
  const dist = [0];
  for (let i = 1; i < path.length; i++) {
    dist.push(dist[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  }
  return { dist, length: dist[dist.length - 1] };
}

/**
 * 고른 랙만 들르는 순찰 경로. 통로 안에서는 통로 중심선을 따라가고, 다른 통로로 옮길 때는
 * 전체 순찰(buildPatrol)과 같이 통로 끝 여유 공간으로 돌아 나간다 (랙 열을 뚫고 지나가지 않게).
 * targets 가 없으면 전체 순찰 경로를 그대로 쓴다.
 */
export function buildRoute(scene: TwinScene, patrol: Patrol, targets?: Set<string>): Route {
  const all = patrol.probes.map((p, idx) => ({ ...p, idx, rack: probeRack(scene, p) ?? "" }));
  if (!targets) {
    return { path: patrol.path, dist: patrol.dist, length: patrol.length, probes: all.sort((a, b) => a.at - b.at) };
  }
  const tiles = [...scene.tiles].sort((a, b) => a.y0 - b.y0);
  const margin = 0.7;
  const picked = all.filter((p) => targets.has(p.rack)).sort((a, b) => a.at - b.at);
  const tileOf = (y: number) => tiles.findIndex((t) => y >= t.y0 - 0.2 && y <= t.y1 + 0.2);

  // 들를 지점: 랙 앞 통로 중심선 위 x. 같은 랙의 높이 3곳은 한 지점이다
  const stops: { x: number; tile: number }[] = [];
  for (const p of picked) {
    const tile = tileOf(p.y);
    const last = stops[stops.length - 1];
    if (last && last.tile === tile && Math.abs(last.x - p.x) < 0.01) continue;
    stops.push({ x: p.x, tile });
  }
  const mid = (i: number) => (tiles[i].y0 + tiles[i].y1) / 2;
  const path: [number, number][] = [];
  const stopAt: number[] = [];
  stops.forEach((s, i) => {
    const prev = stops[i - 1];
    if (prev && prev.tile !== s.tile) {
      const t = tiles[prev.tile];
      // 다음 통로로 가기 가까운 쪽 끝으로 나간다
      const endX = prev.x + s.x > t.x0 + t.x1 ? t.x1 + margin : t.x0 - margin;
      path.push([endX, mid(prev.tile)], [endX, mid(s.tile)]);
    }
    path.push([s.x, mid(s.tile)]);
    stopAt.push(path.length - 1);
  });
  if (path.length === 1) path.push([path[0][0] + 0.01, path[0][1]]);
  const { dist, length } = withDist(path);
  const probes = picked.map((p) => {
    const tile = tileOf(p.y);
    const k = stops.findIndex((s) => s.tile === tile && Math.abs(s.x - p.x) < 0.01);
    return { ...p, at: dist[stopAt[k]] ?? 0 };
  });
  return { path, dist, length, probes };
}

export function routeAt(r: Route, s: number): { x: number; y: number; heading: number } {
  const d = Math.min(Math.max(s, 0), r.length);
  let i = 1;
  while (i < r.dist.length - 1 && r.dist[i] < d) i++;
  const a = r.path[i - 1];
  const b = r.path[i];
  const seg = r.dist[i] - r.dist[i - 1] || 1;
  const f = Math.min(1, (d - r.dist[i - 1]) / seg);
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, heading: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
