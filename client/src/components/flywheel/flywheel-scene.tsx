"use client";
/* eslint-disable react-hooks/immutability --
 * 프레임 루프(useFrame)가 메시, 재질, 카메라와 부모가 넘긴 제어 ref(ctl, labels)에 매 프레임 값을 쓰는 것이 이 파일의 설계다.
 * 렌더 중에는 쓰지 않고 useFrame 과 effect 안에서만 쓴다. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { buildPatrol, loadScenario, tempRgb, toThree, type TwinData } from "@/lib/twin";
import { UNCERTAIN, buildRoute, flyAt, rankUncertain, routeAt, type FlyStage, type Route } from "@/lib/flywheel";
import { Flow, PROBE_DONE, PROBE_PENDING, PROBE_PENDING_SIZE, makeClip } from "../story/story-scene";
import { BANDS, CrahUnits, RackCabinets, makePaint, type RackPaint } from "@/components/twin/rack-cabinets";

/*
 * 데이터 플라이휠 3D 장면. 200랙 홀 둘레를 링이 감싸고, 링 위 펄스가 로봇 → 데이터 → 디지털 트윈 → CFD 노드를
 * 시계 방향으로 돌 때마다 홀이 그 단계 모습으로 바뀐다.
 *  - 로봇: 이번 바퀴 경로를 돌며 랙 앞 3높이를 잰다 (첫 바퀴는 전체, 다음부터 불확실 랙만)
 *  - 데이터: 측정 지점이 그래프로 이어지고, 값이 데이터 노드로 모인다. BMS, DCIM 도 계속 흘러 들어온다
 *  - 디지털 트윈: 보정 물결이 홀을 훑으며 랙이 온도 색으로 확정된다
 *  - CFD: 기류가 흐르고, 예측이 흔들리는 랙에 노란 외곽선이 깜박인다 (다음 바퀴 로봇의 목적지)
 * 시각은 부모의 ctl.t 하나로 정해진다. 버튼으로 단계를 건너뛰면 부모가 ctl.t 만 바꾼다.
 * @see docs/renewal-2026-11.md
 */

const BG = "#05070b";
const FILM = new THREE.Color("#1d4b57");
const AMBER = new THREE.Color("#fbbf24");
/** 링 반지름 [m]. 홀(18 x 26m)을 감싸도록 방 축에 맞춘 타원 */
const RING_X = 13.5;
const RING_Y = 18.5;

export interface FlyControl {
  t: number;
  playing: boolean;
}

export interface FlyLabels {
  nodes: (HTMLElement | null)[];
  edges: (HTMLElement | null)[];
  sources: (HTMLElement | null)[];
}

export interface FlyStatus {
  lap: number;
  stage: FlyStage;
  hold: boolean;
  measured: number;
  flagged: number;
}

interface Frame {
  t: number;
  lap: number;
  stage: FlyStage;
  u: number;
  hold: boolean;
  robotD: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 화면 기준 방향. 가로 화면은 긴 축(26m)이 좌우로, 세로 화면은 앞뒤로 놓이게 카메라를 돌린다 */
function frameAxes(landscape: boolean) {
  return landscape
    ? { right: new THREE.Vector3(0, 0, -1), far: new THREE.Vector3(-1, 0, 0), aRight: RING_Y, aFar: RING_X }
    : { right: new THREE.Vector3(1, 0, 0), far: new THREE.Vector3(0, 0, -1), aRight: RING_X, aFar: RING_Y };
}

/** 노드 각도. 로봇(왼쪽) → 데이터(먼 쪽) → 트윈(오른쪽) → CFD(가까운 쪽), 위에서 보면 시계 방향 */
const nodeAngle = (k: number) => Math.PI - (Math.PI / 2) * k;

function layoutOf({ data, landscape }: { data: TwinData; landscape: boolean }) {
  const { room } = data.scene;
  const [cx, , cz] = toThree(room.x / 2, room.y / 2, 0);
  const center = new THREE.Vector3(cx, room.floor, cz);
  const ax = frameAxes(landscape);
  const ringAt = (a: number, scale = 1, y = 0) =>
    center
      .clone()
      .addScaledVector(ax.right, Math.cos(a) * ax.aRight * scale)
      .addScaledVector(ax.far, Math.sin(a) * ax.aFar * scale)
      .setY(room.floor + y);
  return { center, ax, ringAt };
}

/* ───────── 링, 노드, 펄스 ───────── */

function Ring({ data, landscape, frame }: { data: TwinData; landscape: boolean; frame: React.RefObject<Frame> }) {
  const { ringAt } = layoutOf({ data, landscape });
  const tube = useMemo(() => {
    const pts = Array.from({ length: 160 }, (_, i) => ringAt((i / 160) * Math.PI * 2, 1, 0.02));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 320, 0.06, 8, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ringAt 는 data, landscape 로만 정해진다
  }, [data, landscape]);
  useEffect(() => () => tube.dispose(), [tube]);

  const comet = useRef<THREE.InstancedMesh>(null);
  const nodes = useRef<THREE.Group>(null);
  const TRAIL = 26;
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const s = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const fr = frame.current;
    const head = fr.hold ? nodeAngle(4) : nodeAngle(fr.stage + fr.u);
    const c = comet.current;
    if (c) {
      for (let i = 0; i < TRAIL; i++) {
        const k = 1 - i / TRAIL;
        const p = ringAt(head + i * 0.022, 1, 0.08);
        s.setScalar(fr.hold ? (i === 0 ? 1 : 0.001) : 0.25 + 0.75 * k * k);
        c.setMatrixAt(i, m.compose(p, q, s));
      }
      c.instanceMatrix.needsUpdate = true;
    }
    const g = nodes.current;
    if (!g) return;
    g.children.forEach((child, k) => {
      const on = !fr.hold && fr.stage === k;
      const pulse = on ? 1 + 0.12 * Math.sin(clock.elapsedTime * 5) : 0.8;
      child.scale.setScalar(pulse);
      const beam = child.children[1] as THREE.Mesh;
      const mat = beam.material as THREE.MeshBasicMaterial;
      mat.opacity += ((on ? 0.22 : 0) - mat.opacity) * 0.15;
      const disc = child.children[0] as THREE.Mesh;
      (disc.material as THREE.MeshBasicMaterial).color.set(on ? "#67e8f9" : "#1e5763");
    });
  });

  return (
    <>
      <mesh geometry={tube}>
        <meshBasicMaterial color="#1b4f5c" />
      </mesh>
      <instancedMesh ref={comet} args={[undefined, undefined, TRAIL]} frustumCulled={false}>
        <sphereGeometry args={[0.32, 14, 10]} />
        <meshBasicMaterial
          color="#a5f3fc"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <group ref={nodes}>
        {[0, 1, 2, 3].map((k) => {
          const p = ringAt(nodeAngle(k), 1, 0.03);
          return (
            <group key={k} position={p}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.7, 1.05, 40]} />
                <meshBasicMaterial color="#1e5763" side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, 2.2, 0]}>
                <cylinderGeometry args={[0.55, 0.9, 4.4, 24, 1, true]} />
                <meshBasicMaterial
                  color="#22d3ee"
                  transparent
                  opacity={0}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </>
  );
}

/* ───────── 랙: 미확인(필름) → 보정 물결 → 온도 색, 불확실 랙은 깜박임 ───────── */

function Racks({
  data,
  frame,
  flagged,
}: {
  data: TwinData;
  frame: React.RefObject<Frame>;
  flagged: (fr: Frame) => (id: string) => number;
}) {
  const { racks, room } = data.scene;
  // 랙은 언제나 꽉 찬 캐비닛이다. 칸 색만 매 프레임 정한다
  const paint = useMemo<React.RefObject<RackPaint>>(() => ({ current: makePaint(data, 1) }), [data]);
  const colors = useMemo(() => {
    const c: [number, number, number] = [0, 0, 0];
    const col = new THREE.Color();
    return racks.map((r) =>
      [r.inletLo, r.inletMid, r.inletHi].map((t) => {
        tempRgb(t, c);
        return col.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace).clone();
      }),
    );
  }, [racks]);
  // 보정 물결이 지나가는 순서 (대각선 방향 0~1)
  const order = useMemo(() => {
    const v = racks.map((r) => r.x0 / room.x + r.y0 / room.y);
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    return v.map((x) => (x - lo) / (hi - lo || 1));
  }, [racks, room]);

  const tmp = useMemo(() => new THREE.Color(), []);
  const white = useMemo(() => new THREE.Color("#ffffff"), []);

  useFrame(({ clock }) => {
    const pt = paint.current;
    const fr = frame.current;
    const time = clock.elapsedTime;
    const flag = flagged(fr);
    // 첫 바퀴 트윈 단계 전에는 아무것도 모른다. 트윈 단계에서 물결이 지나간 랙부터 확정된다
    const wave = fr.stage === 2 && !fr.hold ? fr.u * 1.25 : fr.stage > 2 || fr.hold ? 2 : -1;
    racks.forEach((r, i) => {
      let known: number;
      if (fr.lap > 0) known = 1;
      else known = smooth(order[i] - 0.05, order[i] + 0.15, wave);
      const flash = fr.stage === 2 && !fr.hold ? Math.max(0, 1 - Math.abs(wave - order[i] - 0.05) * 8) : 0;
      const f = flag(r.id);
      for (let b = 0; b < BANDS.length; b++) {
        const shimmer = 0.75 + 0.25 * Math.sin(time * 2.2 + i * 0.7 + b);
        tmp.copy(FILM).multiplyScalar(shimmer).lerp(colors[i][b], known);
        if (f > 0) {
          const blink = 0.5 + 0.5 * Math.sin(time * 7 + i);
          tmp.lerp(AMBER, f * 0.35 * blink);
        }
        if (flash > 0) tmp.lerp(white, flash * 0.7);
        tmp.toArray(pt.colors, (i * BANDS.length + b) * 3);
      }
    });
    pt.colorDirty = true;
  });

  return <RackCabinets data={data} paint={paint} />;
}

function Flags({
  data,
  ids,
  frame,
  flagged,
}: {
  data: TwinData;
  ids: string[];
  frame: React.RefObject<Frame>;
  flagged: (fr: Frame) => (id: string) => number;
}) {
  const group = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: "#fbbf24", transparent: true }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const { racks, room } = data.scene;
  const list = useMemo(
    () => ids.map((id) => racks.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => Boolean(r)),
    [ids, racks],
  );
  const geom = useMemo(() => {
    const r = racks[0];
    return new THREE.EdgesGeometry(new THREE.BoxGeometry(r.w + 0.14, r.h + 0.14, r.d + 0.14));
  }, [racks]);
  useEffect(() => () => geom.dispose(), [geom]);
  useFrame(({ clock }) => {
    const flag = flagged(frame.current);
    mat.opacity = 0.55 + 0.45 * Math.sin(clock.elapsedTime * 7);
    group.current?.children.forEach((c, i) => {
      c.visible = flag(list[i].id) > 0.5;
    });
  });
  return (
    <group ref={group}>
      {list.map((r) => {
        const [x, y, z] = toThree(r.x0 + r.w / 2, r.y0 + r.d / 2, room.floor + r.h / 2);
        return <lineSegments key={r.id} geometry={geom} material={mat} position={[x, y, z]} visible={false} />;
      })}
    </group>
  );
}

/* ───────── 로봇과 측정 지점 ───────── */

function Robot({ data, routes, frame }: { data: TwinData; routes: Route[]; frame: React.RefObject<Frame> }) {
  const body = useRef<THREE.Group>(null);
  const floor = data.scene.room.floor;
  useFrame(() => {
    const fr = frame.current;
    const g = body.current;
    if (!g) return;
    g.visible = fr.stage === 0 && !fr.hold;
    if (!g.visible) return;
    const at = routeAt(routes[fr.lap], fr.robotD);
    const [x, , z] = toThree(at.x, at.y, 0);
    g.position.set(x, floor, z);
    g.rotation.y = at.heading;
  });
  return (
    <group ref={body} scale={1.6}>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.7, 0.26, 0.5]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[0.07, 1.6, 0.07]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      {[0.4, 1.1, 1.7].map((h) => (
        <mesh key={h} position={[0, h, 0.09]}>
          <boxGeometry args={[0.2, 0.09, 0.12]} />
          <meshBasicMaterial color="#22d3ee" />
        </mesh>
      ))}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[0.18, 1.6, 2.4]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight position={[0, 1.2, 0]} color="#22d3ee" intensity={8} distance={5} />
    </group>
  );
}

/** 이번 바퀴 측정 지점. 로봇 단계에서 지나간 곳부터 켜지고, 트윈 단계에서 사라진다 */
function Probes({ total, routes, frame }: { total: number; routes: Route[]; frame: React.RefObject<Frame> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const shownLap = useRef(-1);
  const lit = useRef(-1);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const fr = frame.current;
    const route = routes[fr.lap];
    const visible = !fr.hold && (fr.stage <= 1 || (fr.stage === 2 && fr.u < 0.6));
    m.visible = visible;
    if (mat.current) mat.current.opacity = fr.stage === 2 ? 1 - smooth(0.1, 0.6, fr.u) : 1;
    if (!visible) return;
    const mx = new THREE.Matrix4();
    if (shownLap.current !== fr.lap) {
      shownLap.current = fr.lap;
      lit.current = -1;
      for (let i = 0; i < total; i++) m.setMatrixAt(i, mx.makeScale(0, 0, 0));
      for (const p of route.probes) {
        const [x, y, z] = toThree(p.x, p.y, p.z);
        m.setMatrixAt(p.idx, mx.makeTranslation(x, y, z));
      }
      m.instanceMatrix.needsUpdate = true;
    }
    let n = route.probes.length;
    if (fr.stage === 0) {
      n = 0;
      while (n < route.probes.length && route.probes[n].at <= fr.robotD) n++;
    }
    if (n === lit.current) return;
    lit.current = n;
    // 스토리와 같은 규칙: 안 잰 점은 작고 옅은 회색, 잰 점은 청록
    route.probes.forEach((p, i) => {
      const [x, y, z] = toThree(p.x, p.y, p.z);
      const size = i < n ? 1 : PROBE_PENDING_SIZE;
      m.setMatrixAt(p.idx, mx.makeScale(size, size, size).setPosition(x, y, z));
      m.setColorAt(p.idx, i < n ? PROBE_DONE : PROBE_PENDING);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, total]} frustumCulled={false}>
      <sphereGeometry args={[0.06, 10, 8]} />
      <meshBasicMaterial ref={mat} transparent />
    </instancedMesh>
  );
}

/* ───────── 데이터: 측정 지점 그래프, 노드로 모이는 값, BMS/DCIM ───────── */

function graphGeometry(route: Route): THREE.BufferGeometry {
  const seg: number[] = [];
  const push = (a: Route["probes"][number], b: Route["probes"][number]) => {
    seg.push(...toThree(a.x, a.y, a.z), ...toThree(b.x, b.y, b.z));
  };
  // 같은 랙 앞 높이 3곳을 세로로, 같은 통로 같은 높이의 이웃 랙을 가로로 잇는다
  const byKey = new Map<string, Route["probes"]>();
  for (const p of route.probes) {
    const k = `${p.y.toFixed(2)}|${p.z.toFixed(2)}`;
    byKey.set(k, [...(byKey.get(k) ?? []), p]);
  }
  for (const row of byKey.values()) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) if (row[i].x - row[i - 1].x < 0.8) push(row[i - 1], row[i]);
  }
  const byRack = new Map<string, Route["probes"]>();
  for (const p of route.probes) {
    const k = `${p.x.toFixed(2)}|${p.y.toFixed(2)}`;
    byRack.set(k, [...(byRack.get(k) ?? []), p]);
  }
  for (const col of byRack.values()) {
    col.sort((a, b) => a.z - b.z);
    for (let i = 1; i < col.length; i++) push(col[i - 1], col[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  return g;
}

function DataStage({
  data,
  routes,
  frame,
  landscape,
}: {
  data: TwinData;
  routes: Route[];
  frame: React.RefObject<Frame>;
  landscape: boolean;
}) {
  const { ringAt, ax, center } = layoutOf({ data, landscape });
  const graphs = useMemo(() => routes.map(graphGeometry), [routes]);
  useEffect(() => () => graphs.forEach((g) => g.dispose()), [graphs]);
  const graphRefs = useRef<THREE.Group>(null);
  const node = useMemo(() => ringAt(nodeAngle(1), 1, 1.2), [ringAt]);

  // 노드로 날아가는 값. 바퀴마다 최대 240개를 고르게 뽑는다
  const packets = useMemo(
    () =>
      routes.map((r) => {
        const step = Math.max(1, Math.ceil(r.probes.length / 240));
        return r.probes.filter((_, i) => i % step === 0).map((p) => new THREE.Vector3(...toThree(p.x, p.y, p.z)));
      }),
    [routes],
  );
  const MAX = 240;
  const pktGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    return g;
  }, []);
  useEffect(() => () => pktGeom.dispose(), [pktGeom]);
  const pkts = useRef<THREE.Points>(null);

  // BMS, DCIM: 데이터 노드 바깥쪽 먼 곳에서 계속 흘러 들어온다
  const sources = useMemo(() => sourcePositions(center, ax), [center, ax]);
  const STREAM = 14;
  const streamGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sources.length * STREAM * 3), 3));
    return g;
  }, [sources.length]);
  useEffect(() => () => streamGeom.dispose(), [streamGeom]);
  const streams = useRef<THREE.Points>(null);
  const streamMat = useRef<THREE.PointsMaterial>(null);
  const linkGeom = useMemo(() => {
    const seg: number[] = [];
    for (const s of sources) seg.push(s.x, s.y, s.z, node.x, node.y, node.z);
    return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  }, [sources, node]);
  useEffect(() => () => linkGeom.dispose(), [linkGeom]);

  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const fr = frame.current;
    const inData = fr.stage === 1 && !fr.hold;
    // 그래프: 데이터 단계에서 나타나 트윈 단계 초반까지 남는다
    graphRefs.current?.children.forEach((c, lap) => {
      const k =
        lap !== fr.lap || fr.hold
          ? 0
          : fr.stage === 1
            ? smooth(0, 0.35, fr.u)
            : fr.stage === 2
              ? 1 - smooth(0, 0.5, fr.u)
              : 0;
      c.visible = k > 0;
      ((c as THREE.LineSegments).material as THREE.LineBasicMaterial).opacity = 0.55 * k;
    });

    const pos = pktGeom.attributes.position.array as Float32Array;
    const list = packets[fr.lap];
    for (let i = 0; i < MAX; i++) {
      const p0 = list[i];
      const f = p0 && inData ? Math.min(1, Math.max(0, (fr.u - (i / list.length) * 0.45 - 0.1) / 0.4)) : 0;
      if (!p0 || f <= 0 || f >= 1) {
        pos[i * 3 + 1] = -100;
        continue;
      }
      // 위로 솟았다가 노드로 떨어지는 2차 곡선
      a.copy(p0)
        .lerp(node, 0.5)
        .setY(Math.max(p0.y, node.y) + 5);
      b.copy(p0)
        .multiplyScalar((1 - f) * (1 - f))
        .addScaledVector(a, 2 * f * (1 - f))
        .addScaledVector(node, f * f);
      pos[i * 3] = b.x;
      pos[i * 3 + 1] = b.y;
      pos[i * 3 + 2] = b.z;
    }
    pktGeom.attributes.position.needsUpdate = true;
    if (pkts.current) pkts.current.visible = inData;

    const sp = streamGeom.attributes.position.array as Float32Array;
    sources.forEach((s, si) => {
      for (let j = 0; j < STREAM; j++) {
        const f = (clock.elapsedTime * 0.25 + j / STREAM + si * 0.37) % 1;
        a.copy(s).lerp(node, f);
        sp.set([a.x, a.y, a.z], (si * STREAM + j) * 3);
      }
    });
    streamGeom.attributes.position.needsUpdate = true;
    if (streamMat.current) streamMat.current.opacity = inData ? 1 : 0.45;
  });

  return (
    <>
      <group ref={graphRefs}>
        {graphs.map((g, i) => (
          <lineSegments key={i} geometry={g} visible={false}>
            <lineBasicMaterial color="#67e8f9" transparent opacity={0} depthWrite={false} />
          </lineSegments>
        ))}
      </group>
      <points ref={pkts} geometry={pktGeom} frustumCulled={false}>
        <pointsMaterial size={0.22} color="#a5f3fc" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <lineSegments geometry={linkGeom}>
        <lineBasicMaterial color="#1e5763" />
      </lineSegments>
      {sources.map((s, i) => (
        <mesh key={i} position={s}>
          <boxGeometry args={[1.1, 1.1, 1.1]} />
          <meshStandardMaterial color="#334155" emissive="#0e7490" emissiveIntensity={0.4} />
        </mesh>
      ))}
      <points ref={streams} geometry={streamGeom} frustumCulled={false}>
        <pointsMaterial
          ref={streamMat}
          size={0.2}
          color="#67e8f9"
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}

function sourcePositions(center: THREE.Vector3, ax: ReturnType<typeof frameAxes>): THREE.Vector3[] {
  // 데이터 노드(먼 쪽 가운데)의 왼쪽 바깥. 그림의 BMS, DCIM 자리와 같다
  return [-0.55, -0.85].map((r, i) =>
    center
      .clone()
      .addScaledVector(ax.right, ax.aRight * r)
      .addScaledVector(ax.far, ax.aFar * (1.18 + i * 0.12))
      .setY(center.y + 1.5),
  );
}

/* ───────── 감독: 시각, 카메라, 라벨 ───────── */

function Director({
  data,
  routes,
  ctl,
  frame,
  labels,
  landscape,
  reduced,
  onStatus,
  flaggedCount,
}: {
  data: TwinData;
  routes: Route[];
  ctl: React.RefObject<FlyControl>;
  frame: React.RefObject<Frame>;
  labels: React.RefObject<FlyLabels>;
  landscape: boolean;
  reduced: boolean;
  onStatus: (s: FlyStatus) => void;
  flaggedCount: (fr: Frame) => number;
}) {
  const { camera, size } = useThree();
  const { ringAt, ax, center } = layoutOf({ data, landscape });
  const sources = useMemo(() => sourcePositions(center, ax), [center, ax]);
  const last = useRef("");
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const c = ctl.current;
    if (c.playing && !reduced) c.t += Math.min(delta, 0.1);
    const ft = flyAt(c.t);
    const fr = frame.current;
    fr.t = c.t;
    fr.lap = ft.lap;
    fr.stage = ft.stage;
    fr.u = ft.u;
    fr.hold = ft.hold;
    // 경로 양 끝에서 천천히 출발하고 멈춘다
    fr.robotD = smooth(0, 1, Math.min(1, ft.u * 1.08)) * routes[ft.lap].length;

    const status: FlyStatus = {
      lap: ft.lap,
      stage: ft.stage,
      hold: ft.hold,
      measured: routes[ft.lap].probes.length,
      flagged: flaggedCount(fr),
    };
    const key = `${status.lap}|${status.stage}|${status.hold}|${status.flagged}`;
    if (key !== last.current) {
      last.current = key;
      onStatus(status);
    }

    // 카메라: 링 전체가 들어오는 거리에서 아주 천천히 좌우로 흔든다
    const persp = camera as THREE.PerspectiveCamera;
    const elev = landscape ? 0.62 : 0.78;
    const vfov = THREE.MathUtils.degToRad(persp.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * persp.aspect);
    const halfW = ax.aRight + (landscape ? 2.5 : 4.5);
    const halfD = ax.aFar * Math.sin(elev) + 3;
    const dist = Math.max(halfW / Math.tan(hfov / 2), halfD / Math.tan(vfov / 2)) + ax.aFar * Math.cos(elev) * 0.35;
    const sway = reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.12) * 0.07;
    const back = ax.far
      .clone()
      .multiplyScalar(-1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), sway);
    camera.position
      .copy(center)
      .addScaledVector(back, dist * Math.cos(elev))
      .setY(center.y + dist * Math.sin(elev));
    camera.lookAt(center.x, center.y - (landscape ? 1.5 : 2.5), center.z);

    // 라벨 위치
    const L = labels.current;
    const place = (el: HTMLElement | null, p: THREE.Vector3) => {
      if (!el) return;
      v.copy(p).project(camera);
      // 라벨이 캔버스 밖으로 잘리지 않게 가장자리 안쪽으로 붙잡는다
      const hw = el.offsetWidth / 2 + 8;
      const hh = el.offsetHeight / 2 + 8;
      const x = Math.min(size.width - hw, Math.max(hw, (v.x * 0.5 + 0.5) * size.width));
      const y = Math.min(size.height - hh, Math.max(hh, (-v.y * 0.5 + 0.5) * size.height));
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    };
    for (let k = 0; k < 4; k++) {
      place(L.nodes[k], ringAt(nodeAngle(k), 1, 0));
      place(L.edges[k], ringAt(nodeAngle(k + 0.5), 1.2, 0));
    }
    sources.forEach((s, i) => place(L.sources[i], s.clone().setY(s.y + 1.1)));
  });

  return null;
}

/* ───────── 조립 ───────── */

function Scene({
  data,
  ctl,
  labels,
  reduced,
  onStatus,
}: {
  data: TwinData;
  ctl: React.RefObject<FlyControl>;
  labels: React.RefObject<FlyLabels>;
  reduced: boolean;
  onStatus: (s: FlyStatus) => void;
}) {
  const { size } = useThree();
  const landscape = size.width >= size.height * 1.05;
  const frame = useRef<Frame>({ t: 0, lap: 0, stage: 0, u: 0, hold: false, robotD: 0 });
  const clip = useMemo(() => {
    const c = makeClip();
    c.set(-100, 100);
    return c;
  }, []);
  const patrol = useMemo(() => buildPatrol(data.scene), [data]);
  const full = useMemo(() => buildRoute(data.scene, patrol), [data, patrol]);
  // 로봇이 잴 수 있는(측정 지점이 있는) 랙 중에서만 고른다
  const ranked = useMemo(() => {
    const measurable = new Set(full.probes.map((p) => p.rack));
    return rankUncertain(data.scene).filter((id) => measurable.has(id));
  }, [data, full]);
  const sets = useMemo(() => UNCERTAIN.map((n) => new Set(ranked.slice(0, n))), [ranked]);
  // 첫 바퀴는 전체, 다음 바퀴는 직전 바퀴 CFD 가 지정한 랙만
  const routes = useMemo(
    () => [full, ...sets.slice(0, -1).map((s) => buildRoute(data.scene, patrol, s))],
    [data, patrol, full, sets],
  );
  const order = useMemo(() => {
    const { racks, room } = data.scene;
    const m = new Map<string, number>();
    const v = racks.map((r) => r.x0 / room.x + r.y0 / room.y);
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    racks.forEach((r, i) => m.set(r.id, (v[i] - lo) / (hi - lo || 1)));
    return m;
  }, [data]);

  /**
   * 불확실 표시(0~1). lap 바퀴 CFD 단계 중반에 sets[lap] 이 켜지고,
   * 다음 바퀴 트윈 단계의 보정 물결이 지나가면 꺼진다.
   */
  const flagged = useMemo(
    () => (fr: Frame) => {
      if (fr.hold) return (id: string) => (sets[fr.lap].has(id) ? 1 : 0);
      if (fr.stage === 3 && fr.u >= 0.35) return (id: string) => (sets[fr.lap].has(id) ? smooth(0.35, 0.5, fr.u) : 0);
      if (fr.lap === 0) return () => 0;
      const prev = sets[fr.lap - 1];
      if (fr.stage < 2) return (id: string) => (prev.has(id) ? 1 : 0);
      const wave = fr.stage === 2 ? fr.u * 1.25 : 2;
      return (id: string) =>
        prev.has(id) ? 1 - smooth((order.get(id) ?? 0) - 0.05, (order.get(id) ?? 0) + 0.1, wave) : 0;
    },
    [sets, order],
  );
  const flaggedCount = useMemo(
    () => (fr: Frame) => {
      if (fr.hold || (fr.stage === 3 && fr.u >= 0.35)) return sets[fr.lap].size;
      if (fr.lap === 0) return 0;
      return sets[fr.lap - 1].size;
    },
    [sets],
  );

  const flow = useRef<THREE.Group>(null);
  useFrame(() => {
    const fr = frame.current;
    if (flow.current) flow.current.visible = fr.hold || fr.stage === 3;
  });

  const { room, tiles } = data.scene;
  const [cx, , cz] = toThree(room.x / 2, room.y / 2, 0);

  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 45, 120]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 8]} intensity={1.2} />
      <directionalLight position={[-12, 10, -6]} intensity={0.35} />
      <Director
        data={data}
        routes={routes}
        ctl={ctl}
        frame={frame}
        labels={labels}
        landscape={landscape}
        reduced={reduced}
        onStatus={onStatus}
        flaggedCount={flaggedCount}
      />
      <mesh position={[cx, room.floor - 0.01, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.x, room.y]} />
        <meshStandardMaterial color="#0c121d" roughness={0.95} />
      </mesh>
      <gridHelper args={[80, 80, "#111c2b", "#0b1420"]} position={[cx, room.floor - 0.03, cz]} />
      {tiles.map((t, i) => {
        const [x, , z] = toThree((t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2, 0);
        return (
          <mesh key={i} position={[x, room.floor, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[t.x1 - t.x0, t.y1 - t.y0]} />
            <meshBasicMaterial color="#132033" />
          </mesh>
        );
      })}
      <CrahUnits data={data} />
      <Ring data={data} landscape={landscape} frame={frame} />
      <Racks data={data} frame={frame} flagged={flagged} />
      <Flags data={data} ids={ranked.slice(0, UNCERTAIN[0])} frame={frame} flagged={flagged} />
      <group ref={flow} visible={false}>
        <Flow data={data} clip={clip} />
      </group>
      <Probes total={patrol.probes.length} routes={routes} frame={frame} />
      <Robot data={data} routes={routes} frame={frame} />
      <DataStage data={data} routes={routes} frame={frame} landscape={landscape} />
    </>
  );
}

export default function FlywheelScene({
  ctl,
  labels,
  active,
  reduced,
  onReady,
  onStatus,
}: {
  ctl: React.RefObject<FlyControl>;
  labels: React.RefObject<FlyLabels>;
  active: boolean;
  reduced: boolean;
  onReady?: () => void;
  onStatus: (s: FlyStatus) => void;
}) {
  const [data, setData] = useState<TwinData | null>(null);
  useEffect(() => {
    let alive = true;
    loadScenario("S0_baseline")
      .then((d) => alive && setData(d))
      .catch((err) => console.error("[flywheel-scene]", err));
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return null;
  return (
    <Canvas
      camera={{ position: [40, 30, 0], fov: 36, near: 0.1, far: 400 }}
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        onReady?.();
      }}
      style={{ touchAction: "pan-y" }}
    >
      <Scene data={data} ctl={ctl} labels={labels} reduced={reduced} onStatus={onStatus} />
    </Canvas>
  );
}
