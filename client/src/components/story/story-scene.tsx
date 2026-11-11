"use client";
/* eslint-disable react-hooks/immutability --
 * 프레임 루프(useFrame)가 부모에게서 받은 ref(progress, hud, frame)에 매 프레임 값을 쓰는 것이 이 파일의 설계다.
 * React 상태를 거치면 초당 60번 다시 렌더된다. 렌더 중에는 쓰지 않고 useFrame 안에서만 쓴다. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  buildPatrol,
  fieldLayerRgba,
  loadScenario,
  patrolAt,
  tempRgb,
  toThree,
  type Patrol,
  type TwinData,
} from "@/lib/twin";
import { BANDS, CrahUnits, RackCabinets, makePaint, rackColors, type RackPaint } from "@/components/twin/rack-cabinets";

/*
 * 홈 X-RAY 스토리의 3D 장면. 화면 전체를 쓰고, 스크롤 위치(progress)가 영상의 재생 위치 역할을 한다.
 *
 * progress 0~6 (정수 부분 = 장면, 소수 부분 = 장면 안 진행도)
 *   0 투시     홀 전체를 판독 띠가 왕복 (히어로)
 *   1 겉모습   냉기 통로 입구에서 1인칭으로 걸어 들어간다. 전부 필름
 *   2 수집     로봇 뒤를 따라가는 추적 카메라. 스크롤만큼 로봇이 가고 측정 지점이 켜진다
 *   3 트윈     위에서 내려다보며 스크롤만큼 측정값 색이 칠해진다
 *   4 해석     기류와 1.1m 단면, 최고 흡기 랙(F10)으로 다가간다
 *   5 처방     컨테인먼트 벽이 솟고 랙 색이 S0 → S3 로 바뀐다
 *
 * 매 프레임 바뀌는 값(카메라, 로봇, 카운터)은 React 상태를 거치지 않고 ref 로 직접 쓴다.
 * 그리기 방식(인스턴스 랙, 유선 입자, 단면 텍스처)은 n-doras 디지털 트윈과 같다.
 * @see docs/renewal-2026-11.md
 */

export interface StoryHud {
  /** 장면 위에 띄우는 실시간 수치 */
  counter: HTMLElement | null;
  /** 최고 흡기 랙 위에 붙는 꼬리표 */
  tag: HTMLElement | null;
}

export interface StorySceneProps {
  progress: React.RefObject<number>;
  hud: React.RefObject<StoryHud>;
  active: boolean;
  reduced: boolean;
  onReady?: () => void;
}

const FILM = "#d4d4d4";
const BG = "#0b0b0b";
const PARTICLE_SPACING = 0.9;
const FLOW_SPEED = 1.5;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 판독 띠 안/밖 클리핑 평면. 재질들이 같은 객체를 공유해 상수만 바꾸면 전부 따라온다 */
export interface Clip {
  inside: THREE.Plane[];
  outside: THREE.Plane[];
  set: (lo: number, hi: number) => void;
}

export function makeClip(): Clip {
  const inLo = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  const inHi = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  const outLo = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  const outHi = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  return {
    inside: [inLo, inHi],
    outside: [outLo, outHi],
    set(lo, hi) {
      // 평면은 dot(n, p) + c >= 0 쪽을 남긴다
      inLo.constant = -lo;
      inHi.constant = hi;
      outLo.constant = lo;
      outHi.constant = -hi;
    },
  };
}

/** 장면 사이에 공유하는 프레임 상태. Director 가 매 프레임 채우고 나머지가 읽는다 */
interface Frame {
  stage: number;
  f: number;
  /** 2 장면의 로봇 진행 거리 [m] */
  robotD: number;
  /** 5 장면의 S0 → S3 섞임 정도 */
  fixMix: number;
  /** 색이 차오르는 앞선 위치 [CFD x, m]. 이 선이 지나간 랙부터 아래에서 위로 찬다 */
  front: number;
  /** 차오른 색 전체에 곱하는 수위 0~1 (다음 장면으로 넘어가며 비울 때) */
  level: number;
  /** 히어로 스캔 광선 위치 [CFD x, m]. 화면 밖이면 꺼진 것 */
  scan: number;
}

/** 앞선이 랙 가운데를 지난 뒤 랙 하나가 끝까지 차는 거리 [m] */
const FILL = 2.4;
/** 장면마다 애니메이션이 멈춰 쉬는 지점. 그 뒤(0.7~1)는 다음 장면 카메라로 넘어가는 구간이다 */
const REST = 0.7;
/** 장면 안 애니메이션 진행 0~1 (쉬는 지점에서 1) */
const play = (f: number) => Math.min(1, f / REST);

/*
 * 스토리의 랙. 캐비닛 그리기는 RackCabinets 가 하고, 여기서는 칸이 찬 정도와 칸 색만 정한다.
 *  - 차오르기: 앞선(front)이 지나간 랙부터 아래, 가운데, 위 칸 순서로 찬다. 캐비닛은 차오르기 시작한 랙에만 보이고,
 *    그 전(01 겉모습, 02 수집)에는 필름만 보인다
 *  - 처방 장면에서 칸 색이 S0 → S3 로 바뀌고, 히어로에서는 스캔 광선이 지나가는 랙을 잠깐 밝힌다
 */
function Racks({
  base,
  fix,
  clip,
  frame,
}: {
  base: TwinData;
  fix: TwinData | null;
  clip: Clip;
  frame: React.RefObject<Frame>;
}) {
  const film = useRef<THREE.InstancedMesh>(null);
  const count = base.scene.racks.length * BANDS.length;
  const from = useMemo(() => rackColors(base), [base]);
  const to = useMemo(() => (fix ? rackColors(fix) : null), [fix]);
  const paint = useRef<RackPaint>(makePaint(base, 0));
  const lastMix = useRef(-1);
  const lastFill = useRef("");
  const wasScanning = useRef(false);
  // 칸(instance)마다 랙 가운데 x
  const rackX = useMemo(() => base.scene.racks.flatMap((r) => BANDS.map(() => r.x0 + r.w / 2)), [base]);

  useEffect(() => {
    const { racks, room } = base.scene;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    racks.forEach((r, i) => {
      BANDS.forEach(([z0, z1], b) => {
        const [x, y, z] = toThree(r.x0 + r.w / 2, r.y0 + r.d / 2, room.floor + (z0 + z1) / 2);
        m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(r.w - 0.05, z1 - z0, r.d - 0.05));
        film.current?.setMatrixAt(i * BANDS.length + b, m);
      });
    });
    if (film.current) {
      film.current.instanceMatrix.needsUpdate = true;
      film.current.computeBoundingSphere();
    }
    paint.current = makePaint(base, 0);
    lastFill.current = "";
    lastMix.current = -1;
  }, [base]);

  useFrame(() => {
    const fr = frame.current;
    const pt = paint.current;
    const key = `${fr.front.toFixed(3)}|${fr.level.toFixed(3)}`;
    if (key !== lastFill.current) {
      lastFill.current = key;
      base.scene.racks.forEach((r, i) => {
        pt.fill[i] = Math.min(1, Math.max(0, (fr.front - (r.x0 + r.w / 2)) / FILL)) * fr.level;
      });
      pt.fillDirty = true;
    }
    const mix = to ? fr.fixMix : 0;
    const scanning = fr.scan > -50;
    if (!scanning && !wasScanning.current && Math.abs(mix - lastMix.current) < 0.002) return;
    wasScanning.current = scanning;
    lastMix.current = mix;
    const arr = pt.colors;
    for (let i = 0; i < arr.length; i++) arr[i] = to ? from[i] + (to[i] - from[i]) * mix : from[i];
    // 스캔 광선: 지나가는 랙을 잠깐 밝힌다. 랙 모양은 그대로 둔다
    if (scanning) {
      for (let k = 0; k < rackX.length; k++) {
        const g = Math.exp(-(((rackX[k] - fr.scan) / 0.9) ** 2)) * 0.55;
        if (g < 0.01) continue;
        for (let c = 0; c < 3; c++) arr[k * 3 + c] += (1 - arr[k * 3 + c]) * g;
      }
    }
    pt.colorDirty = true;
  });

  return (
    <>
      <RackCabinets data={base} paint={paint} />
      <instancedMesh ref={film} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={FILM}
          transparent
          opacity={0.06}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          clippingPlanes={clip.outside}
          clipIntersection
        />
      </instancedMesh>
      <RackEdges data={base} clip={clip} />
    </>
  );
}

/** 랙 외곽선을 선분 하나로 합쳐 그린다 (200대 × 12변). 필름 쪽에서만 보인다 */
function RackEdges({ data, clip }: { data: TwinData; clip: Clip }) {
  const geom = useMemo(() => {
    const { racks, room } = data.scene;
    const pos: number[] = [];
    const e = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
    for (const r of racks) {
      const [x0, , z0] = toThree(r.x0, r.y0, 0);
      const [x1, , z1] = toThree(r.x0 + r.w, r.y0 + r.d, 0);
      const y0 = room.floor;
      const y1 = room.floor + r.h;
      const c = [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ];
      for (const i of e) pos.push(...c[i]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, [data]);
  useEffect(() => () => geom.dispose(), [geom]);

  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color={FILM} transparent opacity={0.32} clippingPlanes={clip.outside} clipIntersection />
    </lineSegments>
  );
}

function Room({ data, frame }: { data: TwinData; frame: React.RefObject<Frame> }) {
  const { room, tiles } = data.scene;
  const [cx, , cz] = toThree(room.x / 2, room.y / 2, 0);
  const outline = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(room.x, room.ceil - room.floor, room.y)),
    [room],
  );
  useEffect(() => () => outline.dispose(), [outline]);
  // 타일 재질은 한 벌을 나눠 쓴다. 색 하나만 바꾸면 모든 냉기 통로가 같이 밝아진다
  const tileMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#1c1c1c" }), []);
  useEffect(() => () => tileMat.dispose(), [tileMat]);
  const base = useMemo(() => new THREE.Color("#1c1c1c"), []);
  const lit = useMemo(() => new THREE.Color("#5c7a1a"), []);

  useFrame(() => {
    // 수집 장면에서 냉기 통로 바닥을 밝혀 로봇 경로를 보여준다
    const fr = frame.current;
    const k = fr.stage === 2 ? 1 : fr.stage === 1 ? smooth(0.6, 1, fr.f) : 0;
    tileMat.color.copy(base).lerp(lit, k);
  });

  return (
    <group>
      <mesh position={[cx, room.floor - 0.01, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.x, room.y]} />
        <meshStandardMaterial color="#121212" roughness={0.95} />
      </mesh>
      <gridHelper args={[60, 60, "#1e1e1e", "#151515"]} position={[cx, room.floor - 0.02, cz]} />
      {tiles.map((t, i) => {
        const [x, , z] = toThree((t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2, 0);
        return (
          <mesh key={i} position={[x, room.floor, z]} rotation={[-Math.PI / 2, 0, 0]} material={tileMat}>
            <planeGeometry args={[t.x1 - t.x0, t.y1 - t.y0]} />
          </mesh>
        );
      })}
      <lineSegments geometry={outline} position={[cx, (room.floor + room.ceil) / 2, cz]}>
        <lineBasicMaterial color="#3a3a3a" />
      </lineSegments>
      <CrahUnits data={data} />
    </group>
  );
}

function Containment({ data, frame }: { data: TwinData; frame: React.RefObject<Frame> }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const fr = frame.current;
    const k = fr.stage === 5 ? smooth(0, 0.4, fr.f) : 0;
    g.visible = k > 0.001;
    g.children.forEach((c) => {
      c.scale.y = Math.max(0.001, k);
    });
  });
  return (
    <group ref={group}>
      {data.scene.containment.map(([a, b], i) => {
        // 바닥에서 솟아오르도록 원점을 아래 면에 둔다
        const [x, , z] = toThree((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
        const h = b[2] - a[2];
        return (
          <group key={i} position={[x, a[2], z]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[b[0] - a[0], h, b[1] - a[1]]} />
              <meshStandardMaterial
                color="#c6ff3d"
                transparent
                opacity={0.4}
                depthWrite={false}
                emissive="#5c7a1a"
                emissiveIntensity={0.6}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function Flow({ data, clip }: { data: TwinData; clip: Clip }) {
  const { lines, scene } = data;
  const dt = scene.flow.dt;

  const layout = useMemo(() => {
    const owner: number[] = [];
    const slot: number[] = [];
    const offsets = lines.map((_, i) => ((i * 0.6180339) % 1) * PARTICLE_SPACING);
    lines.forEach((ln, i) => {
      const duration = (ln.pts.length / 4 - 1) * dt;
      const n = Math.max(1, Math.ceil(duration / PARTICLE_SPACING));
      for (let k = 0; k < n; k++) {
        owner.push(i);
        slot.push(k);
      }
    });
    return { owner, slot, offsets, count: owner.length };
  }, [lines, dt]);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(layout.count * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(layout.count * 3), 3));
    return g;
  }, [layout.count]);
  useEffect(() => () => geom.dispose(), [geom]);

  const clock = useRef(0);
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((_, delta) => {
    const g = pointsRef.current?.geometry;
    if (!g) return;
    clock.current += Math.min(delta, 0.1) * FLOW_SPEED;
    const pos = g.attributes.position.array as Float32Array;
    const col = g.attributes.color.array as Float32Array;
    for (let p = 0; p < layout.count; p++) {
      const ln = lines[layout.owner[p]];
      const n = ln.pts.length / 4;
      const duration = (n - 1) * dt;
      const tau =
        ((clock.current + layout.offsets[layout.owner[p]]) % PARTICLE_SPACING) + layout.slot[p] * PARTICLE_SPACING;
      if (tau >= duration) {
        pos[p * 3 + 1] = -100;
        continue;
      }
      const fi = tau / dt;
      const i0 = Math.floor(fi);
      const w = fi - i0;
      const i1 = Math.min(i0 + 1, n - 1);
      const a = i0 * 4;
      const b = i1 * 4;
      pos[p * 3] = ln.pts[a] + (ln.pts[b] - ln.pts[a]) * w;
      pos[p * 3 + 1] = ln.pts[a + 2] + (ln.pts[b + 2] - ln.pts[a + 2]) * w;
      pos[p * 3 + 2] = -(ln.pts[a + 1] + (ln.pts[b + 1] - ln.pts[a + 1]) * w);
      const ca = i0 * 3;
      const cb = i1 * 3;
      col[p * 3] = ln.rgb[ca] + (ln.rgb[cb] - ln.rgb[ca]) * w;
      col[p * 3 + 1] = ln.rgb[ca + 1] + (ln.rgb[cb + 1] - ln.rgb[ca + 1]) * w;
      col[p * 3 + 2] = ln.rgb[ca + 2] + (ln.rgb[cb + 2] - ln.rgb[ca + 2]) * w;
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  });

  return (
    <>
      <points ref={pointsRef} geometry={geom} frustumCulled={false}>
        <pointsMaterial
          size={0.17}
          sizeAttenuation
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          clippingPlanes={clip.inside}
        />
      </points>
      <points geometry={geom} frustumCulled={false}>
        <pointsMaterial
          size={0.09}
          sizeAttenuation
          color={FILM}
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          clippingPlanes={clip.outside}
          clipIntersection
        />
      </points>
    </>
  );
}

export function Slice({ data, clip }: { data: TwinData; clip: Clip }) {
  const { scene, field } = data;
  const { nx, ny, nz, spacing, origin } = scene.field;
  const height = 1.1;
  const k = Math.min(nz - 1, Math.max(0, Math.round((scene.room.floor + height - origin[2]) / spacing)));
  const texture = useMemo(() => {
    const tex = new THREE.DataTexture(fieldLayerRgba(scene, field, k, 140), nx, ny, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, [scene, field, k, nx, ny]);
  useEffect(() => () => texture.dispose(), [texture]);
  const [cx, y, cz] = toThree(scene.room.x / 2, scene.room.y / 2, scene.room.floor + height);
  return (
    <mesh position={[cx, y, cz]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[nx * spacing, ny * spacing]} />
      <meshBasicMaterial
        map={texture}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        clippingPlanes={clip.inside}
      />
    </mesh>
  );
}

/** N-Prover. 스크롤만큼 순회 경로를 가고, 지나간 측정 지점이 켜진다 */
/*
 * 로봇 측정 지점(랙 흡기면 앞, 상, 중, 하 3높이). 사람은 로봇 빔과 같은 청록을 "잰 곳"으로 읽는다.
 * 안 잰 점은 작고 옅은 회색이라 필름 위에서 구멍처럼 보이지 않고, 로봇이 지나가면 크게 청록으로 켜지며 잠깐 커졌다 돌아온다.
 * 예전에는 안 잰 점을 짙은 남색 구로 그려 01 겉모습 눈높이에서 검은 얼룩처럼 보였고 센서로 오해받았다(2026-11-10).
 */
export const PROBE_PENDING = new THREE.Color("#8f8f8f");
export const PROBE_PENDING_SIZE = 0.4;
export const PROBE_DONE = new THREE.Color("#c6ff3d");
/** 잰 점이 커졌다 돌아오는 로봇 이동 거리 [m] */
const PROBE_POP = 0.6;

function Robot({
  data,
  patrol,
  frame,
  hud,
}: {
  data: TwinData;
  patrol: Patrol;
  frame: React.RefObject<Frame>;
  hud: React.RefObject<StoryHud>;
}) {
  const body = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const probes = useRef<THREE.InstancedMesh>(null);
  const lit = useRef(-1);
  const floor = data.scene.room.floor;
  const sorted = useMemo(() => [...patrol.probes].sort((a, b) => a.at - b.at), [patrol]);
  const temps = useMemo(
    () =>
      sorted.map((p) => {
        const r = data.scene.racks.find(
          (rk) => p.x > rk.x0 && p.x < rk.x0 + rk.w && Math.abs((rk.front === "+y" ? rk.y0 + rk.d : rk.y0) - p.y) < 0.2,
        );
        if (!r) return 20;
        const h = p.z - floor;
        return h < 0.75 ? r.inletLo : h < 1.45 ? r.inletMid : r.inletHi;
      }),
    [sorted, data, floor],
  );

  const scratch = useMemo(
    () => ({
      c: new THREE.Color(),
      rgb: [0, 0, 0] as [number, number, number],
      mtx: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      p: new THREE.Vector3(),
      sc: new THREE.Vector3(),
    }),
    [],
  );

  useEffect(() => {
    const m = probes.current;
    if (!m) return;
    sorted.forEach((_, i) => m.setColorAt(i, PROBE_PENDING));
    lit.current = -1;
  }, [sorted]);

  useFrame(({ clock }) => {
    const fr = frame.current;
    const showRobot = fr.stage === 2 || (fr.stage === 1 && fr.f > 0.55);
    const showProbes = fr.stage === 2 || fr.stage === 3 || (fr.stage === 1 && fr.f > 0.55);
    if (body.current) {
      body.current.visible = showRobot;
      const at = patrolAt(patrol, Math.min(fr.robotD, patrol.length - 0.01));
      const [x, , z] = toThree(at.x, at.y, 0);
      body.current.position.set(x, floor, z);
      // CFD 진행 방향 (cos h, sin h) 는 three 에서 (cos h, -sin h) 라서 y 축 회전각이 h 그대로다
      body.current.rotation.y = at.heading;
    }
    if (beam.current) {
      const mat = beam.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.12 + 0.08 * Math.sin(clock.elapsedTime * 6);
    }
    const m = probes.current;
    if (!m) return;
    m.visible = showProbes;
    const colored = fr.stage >= 3;
    let n = 0;
    if (!colored) while (n < sorted.length && sorted[n].at <= fr.robotD) n++;
    if (fr.stage === 2 && hud.current.counter) {
      hud.current.counter.textContent = `측정 지점 ${n.toLocaleString()} / ${sorted.length.toLocaleString()}`;
    }
    // 막 잰 점이 커졌다 돌아오는 동안(PROBE_POP 미터)은 매 프레임 다시 그린다
    const popping = !colored && n > 0 && fr.robotD - sorted[n - 1].at < PROBE_POP;
    const key = colored ? -2 : n;
    if (key === lit.current && !popping) return;
    lit.current = key;
    const { c, rgb, mtx, q, p, sc } = scratch;
    for (let i = 0; i < sorted.length; i++) {
      let size = 1;
      if (colored) {
        tempRgb(temps[i], rgb);
        c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
      } else if (i < n) {
        const t = Math.min(1, (fr.robotD - sorted[i].at) / PROBE_POP);
        size = 1 + 0.6 * Math.sin(t * Math.PI);
        c.copy(PROBE_DONE);
      } else {
        size = PROBE_PENDING_SIZE;
        c.copy(PROBE_PENDING);
      }
      const [x, y, z] = toThree(sorted[i].x, sorted[i].y, sorted[i].z);
      m.setMatrixAt(i, mtx.compose(p.set(x, y, z), q, sc.setScalar(size)));
      m.setColorAt(i, c);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={probes} args={[undefined, undefined, sorted.length]} frustumCulled={false}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshBasicMaterial />
      </instancedMesh>
      <group ref={body}>
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.7, 0.26, 0.5]} />
          <meshStandardMaterial color="#e6e6e6" roughness={0.35} metalness={0.2} />
        </mesh>
        {[-0.25, 0.25].map((x) =>
          [-0.2, 0.2].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 0.07, z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.05, 14]} />
              <meshStandardMaterial color="#3a3a3a" />
            </mesh>
          )),
        )}
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[0.07, 1.6, 0.07]} />
          <meshStandardMaterial color="#a3a3a3" metalness={0.4} roughness={0.4} />
        </mesh>
        {[0.4, 1.1, 1.7].map((h) => (
          <mesh key={h} position={[0, h, 0.09]}>
            <boxGeometry args={[0.2, 0.09, 0.12]} />
            <meshBasicMaterial color="#c6ff3d" />
          </mesh>
        ))}
        {/* 센서 빛 띠: 앞쪽(랙 방향) 양옆으로 펼쳐지는 측정 범위 */}
        <mesh ref={beam} position={[0, 1.05, 0]}>
          <boxGeometry args={[0.18, 1.6, 2.4]} />
          <meshBasicMaterial
            color="#c6ff3d"
            transparent
            opacity={0.15}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <pointLight position={[0, 1.2, 0]} color="#c6ff3d" intensity={6} distance={4} />
      </group>
    </>
  );
}

function Hottest({
  data,
  frame,
  hud,
}: {
  data: TwinData;
  frame: React.RefObject<Frame>;
  hud: React.RefObject<StoryHud>;
}) {
  const mat = useRef<THREE.LineBasicMaterial>(null);
  const line = useRef<THREE.LineSegments>(null);
  const { camera, size } = useThree();
  const rack = data.scene.racks.find((r) => r.id === data.scene.kpi.hottestRack);
  const geom = useMemo(
    () => (rack ? new THREE.EdgesGeometry(new THREE.BoxGeometry(rack.w + 0.14, rack.h + 0.14, rack.d + 0.14)) : null),
    [rack],
  );
  useEffect(() => () => geom?.dispose(), [geom]);
  const top = useMemo(() => {
    if (!rack) return new THREE.Vector3();
    const [x, y, z] = toThree(rack.x0 + rack.w / 2, rack.y0 + rack.d / 2, data.scene.room.floor + rack.h + 0.3);
    return new THREE.Vector3(x, y, z);
  }, [rack, data]);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const fr = frame.current;
    const k = fr.stage === 4 ? smooth(0.25, 0.55, fr.f) : 0;
    if (line.current) line.current.visible = k > 0;
    if (mat.current) mat.current.opacity = (0.55 + 0.45 * Math.sin(clock.elapsedTime * 5)) * k;
    const tag = hud.current.tag;
    if (!tag) return;
    if (k <= 0) {
      tag.style.opacity = "0";
      return;
    }
    v.copy(top).project(camera);
    const x = (v.x * 0.5 + 0.5) * size.width;
    const y = (-v.y * 0.5 + 0.5) * size.height;
    tag.style.opacity = String(k);
    tag.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  });

  if (!rack || !geom) return null;
  const [x, y, z] = toThree(rack.x0 + rack.w / 2, rack.y0 + rack.d / 2, data.scene.room.floor + rack.h / 2);
  return (
    <lineSegments ref={line} geometry={geom} position={[x, y, z]}>
      <lineBasicMaterial ref={mat} color="#ffffff" transparent />
    </lineSegments>
  );
}

/** 카메라와 판독 띠, 프레임 상태를 스크롤 위치에서 계산한다 */
function Director({
  base,
  patrol,
  progress,
  frame,
  clip,
  hud,
  reduced,
}: {
  base: TwinData;
  patrol: Patrol;
  progress: React.RefObject<number>;
  frame: React.RefObject<Frame>;
  clip: Clip;
  hud: React.RefObject<StoryHud>;
  reduced: boolean;
}) {
  const { camera, size } = useThree();
  const { room, racks, kpi } = base.scene;
  const [cx, , cz] = toThree(room.x / 2, room.y / 2, 0);
  const playP = useRef(progress.current);
  const pending = useRef({ k: -1, since: 0 });
  const committed = useRef(-1);
  const look = useRef(new THREE.Vector3(cx, 0, cz));
  const sweepT = useRef(0);
  // 열(x)마다 랙 오른쪽 끝. 필름을 랙 경계에서만 자르려고 쓴다
  const edges = useMemo(() => [...new Set(racks.map((r) => +(r.x0 + r.w).toFixed(3)))].sort((a, b) => a - b), [racks]);
  const rackW = racks[0]?.w ?? 0.6;
  const tmp = useMemo(
    () => ({ p0: new THREE.Vector3(), l0: new THREE.Vector3(), p1: new THREE.Vector3(), l1: new THREE.Vector3() }),
    [],
  );

  // 가장 가운데 냉기 통로 (1인칭으로 걸어 들어가는 곳)
  const aisle = useMemo(() => {
    const t = [...base.scene.tiles].sort((a, b) => a.y0 - b.y0)[Math.floor(base.scene.tiles.length / 2)];
    return { y: (t.y0 + t.y1) / 2, x0: t.x0, x1: t.x1 };
  }, [base]);
  const hot = useMemo(() => {
    const r = racks.find((rk) => rk.id === kpi.hottestRack) ?? racks[0];
    const [x, y, z] = toThree(r.x0 + r.w / 2, r.y0 + r.d / 2, room.floor + 1.1);
    return new THREE.Vector3(x, y, z);
  }, [racks, kpi, room]);

  // 화면이 세로로 길면(모바일) 같은 장면을 담으려고 뒤로 물러난다
  const far = size.width / size.height < 0.9 ? 1.55 : 1;

  // 가로 화면에서는 왼쪽에 글 카드가 있으므로 장면 중심을 오른쪽으로 민다
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (size.width / size.height > 1.1)
      cam.setViewOffset(size.width, size.height, -size.width * 0.17, 0, size.width, size.height);
    // 세로 화면에서는 아래쪽에 글 카드가 있으므로 장면을 위로 올린다
    else cam.setViewOffset(size.width, size.height, 0, size.height * 0.16, size.width, size.height);
  }, [camera, size]);

  /** 장면별 카메라. 위치와 바라보는 점을 out 에 쓴다 */
  const shot = (stage: number, f: number, time: number, pos: THREE.Vector3, at: THREE.Vector3) => {
    switch (stage) {
      case 0: {
        const a = -0.72 + Math.sin(time * 0.08) * 0.08;
        const r = 30 * far;
        pos.set(cx + Math.sin(a) * r, 18 * far, cz + Math.cos(a) * r);
        at.set(cx, 0, cz - 0.5);
        return;
      }
      case 1: {
        // 통로 입구 눈높이에서 안쪽으로 걸어 들어간다
        const [, , z] = toThree(0, aisle.y, 0);
        const x = aisle.x0 - 1.6 + play(f) * 4.5;
        pos.set(x, room.floor + 1.65, z);
        at.set(x + 6, room.floor + 1.1, z);
        return;
      }
      case 2: {
        // 로봇 뒤 3인칭 추적
        const d = Math.min(play(f), 0.999) * patrol.length;
        const p = patrolAt(patrol, d);
        const ahead = patrolAt(patrol, Math.min(d + 2.2, patrol.length - 0.01));
        const [rx, , rz] = toThree(p.x, p.y, 0);
        const [ax, , az] = toThree(ahead.x, ahead.y, 0);
        const dx = ax - rx;
        const dz = az - rz;
        const len = Math.hypot(dx, dz) || 1;
        const back = 4.6 * far;
        pos.set(rx - (dx / len) * back, room.floor + 3.4 * far, rz - (dz / len) * back + 1.2);
        at.set(rx + (dx / len) * 1.5, room.floor + 0.9, rz + (dz / len) * 1.5);
        return;
      }
      case 3:
        pos.set(cx - 3, 38 * far, cz + 12 * far);
        at.set(cx, 0, cz - 0.5);
        return;
      case 4: {
        // 3/4 시점에서 최고 흡기 랙으로 다가간다
        const k = smooth(0.2, 0.65, f);
        pos.set(cx - 14 * far, 16 * far, cz + 18 * far).lerp(new THREE.Vector3(hot.x - 5.5, hot.y + 5, hot.z + 7.5), k);
        at.set(cx, 0.4, cz).lerp(hot, k);
        return;
      }
      default:
        pos.set(cx - 9 * far, 22 * far, cz + 20 * far);
        at.set(cx, 0.2, cz - 0.5);
    }
  };

  useFrame(({ clock }, delta) => {
    const target = progress.current;
    /*
     * 스크롤은 "몇 번째 장면인가"만 정하고, 장면 안 움직임은 일정한 속도로 재생한다.
     * 사람마다 스크롤 속도가 달라 위치를 그대로 따라가면 빨리 감기와 느린 재생이 섞이기 때문이다.
     * 재생 머리(playP)는 지금 장면의 쉬는 지점(REST)까지 영상 속도로 가서 멈춘다.
     * 바로 다음 장면이면 남은 거리에 비례해 조금 빨라지고, 두 장면 이상 건너뛰면 사이 장면을 생략한다.
     */
    if (reduced) playP.current = target;
    else {
      // 스크롤이 장면을 스쳐 지나가는 것(빠른 스크롤, 단계 버튼의 부드러운 스크롤)은 무시하고
      // 0.3초 넘게 머문 장면만 확정한다
      const seen = Math.min(5, Math.floor(target));
      if (seen !== pending.current.k) pending.current = { k: seen, since: clock.elapsedTime };
      if (clock.elapsedTime - pending.current.since > 0.3 || committed.current < 0) committed.current = seen;
      const k = committed.current;
      const goal = k === 5 ? 5.999 : k + REST;
      // 두 장면 이상 건너뛰면 사이 장면을 빨리 감지 않고 목표 장면 처음으로 바로 간다 (카메라는 따로 부드럽게 옮겨 간다)
      if (Math.abs(k - Math.floor(playP.current)) >= 2) playP.current = k;
      const d = goal - playP.current;
      const base = 0.24;
      const speed = Math.min(base * Math.max(1, Math.abs(d) * 1.6), Math.abs(d) * 3 + 0.02);
      playP.current += Math.sign(d) * Math.min(Math.abs(d), speed * Math.min(delta, 0.1));
    }
    const p = Math.min(5.999, Math.max(0, playP.current));
    const stage = Math.floor(p);
    const f = p - stage;
    const fr = frame.current;
    fr.stage = stage;
    fr.f = f;
    fr.robotD = stage === 2 ? Math.min(play(f), 0.999) * patrol.length : 0;
    fr.fixMix = stage === 5 ? smooth(0.1, 0.6, f) : 0;

    // 색이 차오르는 앞선. 차오르기는 03 트윈 장면에서만 쓴다
    const span = room.x + FILL + 1;
    fr.scan = -100;
    if (stage === 0) {
      // 히어로는 첫 화면부터 꽉 찬 랙을 보여주고, 스캔 광선만 홀을 왕복한다
      if (!reduced) sweepT.current += delta;
      fr.front = span;
      // 다음 장면(필름)으로 넘어가며 비운다
      fr.level = 1 - smooth(REST, 0.95, f);
      if (!reduced) fr.scan = -2 + (room.x + 4) * (0.5 - 0.5 * Math.cos((sweepT.current / 7) * Math.PI));
    } else if (stage <= 2) {
      fr.front = -1;
      fr.level = 0;
    } else if (stage === 3) {
      fr.front = -1 + span * smooth(0.02, REST, f);
      fr.level = 1;
    } else {
      fr.front = span;
      fr.level = 1;
    }
    // 필름과 기류는 끝까지 찬 랙까지만 걷어 낸다. 랙 경계에서 잘라 칸이 반쯤 잘려 보이지 않게 한다
    let hi = -1;
    if (fr.level >= 0.999) for (const e of edges) if (e - rackW / 2 + FILL <= fr.front) hi = e;
    if (hi >= edges[edges.length - 1]) hi = room.x + 2;
    clip.set(-1, hi);

    if (stage === 5 && hud.current.counter) {
      hud.current.counter.textContent = `27℃ 초과 랙 ${Math.round(33 * (1 - fr.fixMix))}대`;
    }

    // 카메라: 장면 끝 30% 에서 다음 장면 카메라로 넘어간다
    const time = clock.elapsedTime;
    shot(stage, f, time, tmp.p0, tmp.l0);
    const w = stage < 5 ? smooth(0.7, 1, f) : 0;
    if (w > 0) {
      shot(stage + 1, 0, time, tmp.p1, tmp.l1);
      tmp.p0.lerp(tmp.p1, w);
      tmp.l0.lerp(tmp.l1, w);
    }
    const k = reduced ? 1 : Math.min(1, delta * 5);
    camera.position.lerp(tmp.p0, k);
    look.current.lerp(tmp.l0, k);
    camera.lookAt(look.current);
  });

  return null;
}

function Scene({
  base,
  fix,
  progress,
  hud,
  reduced,
}: {
  base: TwinData;
  fix: TwinData | null;
  progress: React.RefObject<number>;
  hud: React.RefObject<StoryHud>;
  reduced: boolean;
}) {
  const clip = useMemo(() => makeClip(), []);
  const frame = useRef<Frame>({ stage: 0, f: 0, robotD: 0, fixMix: 0, front: -1, level: 0, scan: -100 });
  const patrol = useMemo(() => buildPatrol(base.scene), [base]);
  const [stage, setStage] = useState(0);
  const flowS0 = useRef<THREE.Group>(null);
  const flowS3 = useRef<THREE.Group>(null);
  const slice = useRef<THREE.Group>(null);

  useFrame(() => {
    const fr = frame.current;
    if (fr.stage !== stage) setStage(fr.stage);
    // 기류는 투시(0), 해석(4), 처방(5)에서. 처방 중반부터 컨테인먼트 결과로 바뀐다
    const showFlow = fr.stage === 0 || fr.stage >= 4;
    const useFix = fr.stage === 5 && fr.fixMix > 0.5 && fix;
    if (flowS0.current) flowS0.current.visible = showFlow && !useFix;
    if (flowS3.current) flowS3.current.visible = Boolean(showFlow && useFix);
    if (slice.current) slice.current.visible = fr.stage === 0 || fr.stage === 4;
  });

  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 30, 95]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[10, 20, 8]} intensity={1.3} />
      <directionalLight position={[-12, 10, -6]} intensity={0.35} />
      <Director base={base} patrol={patrol} progress={progress} frame={frame} clip={clip} hud={hud} reduced={reduced} />
      <Room data={base} frame={frame} />
      <Racks base={base} fix={fix} clip={clip} frame={frame} />
      <group ref={flowS0}>
        <Flow data={base} clip={clip} />
      </group>
      {fix && (
        <group ref={flowS3} visible={false}>
          <Flow data={fix} clip={clip} />
        </group>
      )}
      <group ref={slice}>
        <Slice data={base} clip={clip} />
      </group>
      {fix && <Containment data={fix} frame={frame} />}
      <Robot data={base} patrol={patrol} frame={frame} hud={hud} />
      <Hottest data={base} frame={frame} hud={hud} />
    </>
  );
}

export default function StoryScene({ progress, hud, active, reduced, onReady }: StorySceneProps) {
  const [base, setBase] = useState<TwinData | null>(null);
  const [fix, setFix] = useState<TwinData | null>(null);

  useEffect(() => {
    let alive = true;
    loadScenario("S0_baseline")
      .then((d) => {
        if (!alive) return;
        setBase(d);
        // 처방 장면용 데이터는 첫 장면을 띄운 뒤에 받는다
        return loadScenario("S3_containment").then((s3) => alive && setFix(s3));
      })
      .catch((err) => console.error("[story-scene]", err));
    return () => {
      alive = false;
    };
  }, []);

  if (!base) return null;

  return (
    <Canvas
      camera={{ position: [-20, 24, 20], fov: 40, near: 0.1, far: 300 }}
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        onReady?.();
      }}
    >
      <Scene base={base} fix={fix} progress={progress} hud={hud} reduced={reduced} />
    </Canvas>
  );
}
