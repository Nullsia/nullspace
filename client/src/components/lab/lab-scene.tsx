"use client";
/* eslint-disable react-hooks/immutability --
 * 프레임 루프(useFrame)가 메시와 컨트롤 같은 three 객체에 매 프레임 값을 쓰는 것이 이 파일의 설계다.
 * 렌더 중에는 쓰지 않고 useFrame 과 effect 안에서만 쓴다. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadScenario, toThree, type ScenarioKey, type TwinData } from "@/lib/twin";
import { CrahUnits, RackCabinets, makePaint, rackColors, type RackPaint } from "@/components/twin/rack-cabinets";
import { Flow, Slice, makeClip } from "../story/story-scene";

/*
 * 시나리오 시뮬레이터의 3D 장면. 같은 200랙 홀에서 조건만 바꾼 CFD 결과를 고르면 그 결과로 바뀐다.
 *  - 랙 색은 이전 시나리오 색에서 0.6초 동안 새 색으로 넘어간다
 *  - 마우스는 끌어서 돌릴 수 있다. 터치 기기는 페이지 스크롤을 막지 않도록 끌기를 끄고 천천히 자동 회전만 한다
 *  - 휠 확대는 끈다 (페이지 스크롤을 가로채지 않게)
 * 그리기 부품(기류 입자, 단면)은 X-RAY 스토리와 같은 것을 쓴다.
 * @see docs/renewal-2026-11.md
 */

const BG = "#0b0b0b";

/** 랙은 언제나 꽉 찬 캐비닛이다. 시나리오를 바꾸면 칸 색만 이전 색에서 새 색으로 0.6초 동안 넘어간다 */
function Racks({ data }: { data: TwinData }) {
  const target = useMemo(() => rackColors(data), [data]);
  // 시나리오가 바뀌어도 같은 버퍼를 써야 이전 색에서 넘어간다. 처음 한 번만 만든다
  const [paint] = useState<React.RefObject<RackPaint>>(() => ({ current: makePaint(data, 1) }));
  const t = useRef(1);

  useEffect(() => {
    t.current = 0;
  }, [data]);

  useFrame((_, delta) => {
    const pt = paint.current;
    if (t.current >= 1) return;
    t.current = Math.min(1, t.current + delta / 0.6);
    // 지금 색에서 목표 색으로 조금씩 다가간다. 마지막 프레임에 정확히 맞춘다
    const k = t.current >= 1 ? 1 : Math.min(1, delta * 6);
    const arr = pt.colors;
    for (let i = 0; i < arr.length; i++) arr[i] += (target[i] - arr[i]) * k;
    pt.colorDirty = true;
  });

  return <RackCabinets data={data} paint={paint} />;
}

/** AI 고밀도 랙(S2)과 최고 흡기 랙 외곽선 */
function Highlights({ data }: { data: TwinData }) {
  const hotMat = useRef<THREE.LineBasicMaterial>(null);
  const { racks, room, kpi } = data.scene;
  const box = (w: number, h: number, d: number) => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
  const hd = useMemo(() => racks.filter((r) => r.hd), [racks]);
  const hot = racks.find((r) => r.id === kpi.hottestRack);
  // 최고 흡기가 27℃ 이하면 강조할 열점이 없다
  const showHot = hot && kpi.inletMaxC > 27;
  const geoms = useMemo(() => {
    const g = racks[0] ? box(racks[0].w + 0.12, racks[0].h + 0.12, racks[0].d + 0.12) : null;
    return g;
  }, [racks]);
  useEffect(() => () => geoms?.dispose(), [geoms]);
  useFrame(({ clock }) => {
    if (hotMat.current) hotMat.current.opacity = 0.55 + 0.45 * Math.sin(clock.elapsedTime * 5);
  });
  if (!geoms) return null;
  const at = (r: (typeof racks)[number]) => toThree(r.x0 + r.w / 2, r.y0 + r.d / 2, room.floor + r.h / 2);
  return (
    <>
      {hd.map((r) => (
        <lineSegments key={r.id} geometry={geoms} position={at(r)}>
          <lineBasicMaterial color="#c6ff3d" />
        </lineSegments>
      ))}
      {showHot && (
        <lineSegments geometry={geoms} position={at(hot)}>
          <lineBasicMaterial ref={hotMat} color="#ffffff" transparent />
        </lineSegments>
      )}
    </>
  );
}

function Room({ data }: { data: TwinData }) {
  const { room, tiles, containment } = data.scene;
  const [cx, , cz] = toThree(room.x / 2, room.y / 2, 0);
  const outline = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(room.x, room.ceil - room.floor, room.y)),
    [room],
  );
  useEffect(() => () => outline.dispose(), [outline]);
  return (
    <group>
      <mesh position={[cx, room.floor - 0.01, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.x, room.y]} />
        <meshStandardMaterial color="#141414" roughness={0.95} />
      </mesh>
      <gridHelper args={[60, 60, "#2a2a2a", "#1a1a1a"]} position={[cx, room.floor - 0.02, cz]} />
      {tiles.map((t, i) => {
        const [x, , z] = toThree((t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2, 0);
        return (
          <mesh key={i} position={[x, room.floor, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[t.x1 - t.x0, t.y1 - t.y0]} />
            <meshBasicMaterial color="#222222" />
          </mesh>
        );
      })}
      <lineSegments geometry={outline} position={[cx, (room.floor + room.ceil) / 2, cz]}>
        <lineBasicMaterial color="#4a4a4a" />
      </lineSegments>
      <CrahUnits data={data} />
      {containment.map(([a, b], i) => {
        const [x, y, z] = toThree((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        return (
          <mesh key={i} position={[x, y, z]}>
            <boxGeometry args={[b[0] - a[0], b[2] - a[2], b[1] - a[1]]} />
            <meshStandardMaterial
              color="#e6e6e6"
              transparent
              opacity={0.22}
              depthWrite={false}
              emissive="#555555"
              emissiveIntensity={0.4}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export interface LabView { pos: THREE.Vector3; target: THREE.Vector3 }

/** Camera angle and zoom for each scenario, framed on what changes in it. */
function viewFor(data: TwinData): LabView {
  const { room, racks, units, key } = data.scene;
  const [cx, , cz] = toThree(room.x / 2, room.y / 2, 0);
  const c = new THREE.Vector3(cx, 0.3, cz);
  const at = (x: number, y: number) => { const [a, , b] = toThree(x, y, 0); return new THREE.Vector3(a, 0.6, b); };
  if (key === "S2_ai_racks") {
    const hd = racks.filter(r => r.hd);
    const t = hd.length ? hd.reduce((v, r) => v.add(at(r.x0 + r.w / 2, r.y0 + r.d / 2)), new THREE.Vector3()).divideScalar(hd.length) : c.clone();
    return { target: t, pos: t.clone().add(new THREE.Vector3(-8, 8.5, 9.5)) };
  }
  if (key === "S3_containment") return { target: c.clone(), pos: c.clone().add(new THREE.Vector3(19, 15, 17)) };
  if (key === "S4_cont_22C") return { target: c.clone(), pos: c.clone().add(new THREE.Vector3(-22, 27, -6)) };
  if (key === "S5_cont_fail") {
    const u = units.find(x => x.failed);
    if (u) {
      const t = at((u.x0 + u.x1) / 2, (u.y0 + u.y1) / 2);
      const away = c.clone().sub(t).setY(0).normalize();
      return { target: t.clone().lerp(c, 0.4), pos: t.clone().sub(away.clone().multiplyScalar(4)).add(new THREE.Vector3(0, 13, 0)).add(new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(9)) };
    }
  }
  return { target: c.clone(), pos: c.clone().add(new THREE.Vector3(-17, 18.7, 22)) };
}

function Controls({ view, interactive, reduced }: { view: LabView; interactive: boolean; reduced: boolean }) {
  const { camera, gl } = useThree();
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl]);
  const flying = useRef(true);
  useEffect(() => {
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minPolarAngle = Math.PI / 8;
    controls.enabled = interactive;
    // A drag takes over from the scripted camera until the next scenario.
    const stop = () => { flying.current = false; };
    controls.addEventListener("start", stop);
    return () => {
      controls.removeEventListener("start", stop);
      controls.dispose();
    };
  }, [controls, interactive]);
  useEffect(() => {
    flying.current = true;
    if (reduced) { camera.position.copy(view.pos); controls.target.copy(view.target); controls.update(); }
  }, [view, reduced, camera, controls]);
  useFrame((_, delta) => {
    if (flying.current) {
      const k = 1 - Math.exp(-delta * 2.6);
      camera.position.lerp(view.pos, k);
      controls.target.lerp(view.target, k);
      if (camera.position.distanceTo(view.pos) < 0.02 && controls.target.distanceTo(view.target) < 0.02) flying.current = false;
    }
    controls.update();
  });
  return null;
}

function Scene({ data, interactive, reduced }: { data: TwinData; interactive: boolean; reduced: boolean }) {
  const clip = useMemo(() => {
    const c = makeClip();
    // 띠 없이 전부 온도 색으로 보인다
    c.set(-100, 100);
    return c;
  }, []);
  const view = useMemo(() => viewFor(data), [data]);

  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 40, 100]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 8]} intensity={1.3} />
      <directionalLight position={[-12, 10, -6]} intensity={0.35} />
      <Room data={data} />
      <Racks data={data} />
      <Highlights data={data} />
      <Flow key={data.scene.key} data={data} clip={clip} />
      <Slice key={`s-${data.scene.key}`} data={data} clip={clip} />
      <Controls view={view} interactive={interactive} reduced={reduced} />
    </>
  );
}

export default function LabScene({
  scenario,
  active,
  interactive,
  reduced,
  onReady,
}: {
  scenario: ScenarioKey;
  active: boolean;
  interactive: boolean;
  reduced: boolean;
  onReady?: () => void;
}) {
  // 새 시나리오를 받는 동안에는 이전 장면을 그대로 둔다 (빈 화면 깜빡임 방지)
  const [data, setData] = useState<TwinData | null>(null);
  useEffect(() => {
    let alive = true;
    loadScenario(scenario)
      .then((d) => alive && setData(d))
      .catch((err) => console.error("[lab-scene]", err));
    return () => {
      alive = false;
    };
  }, [scenario]);

  if (!data) return null;
  const [cx, , cz] = toThree(data.scene.room.x / 2, data.scene.room.y / 2, 0);

  return (
    <Canvas
      camera={{ position: [cx - 17, 19, cz + 22], fov: 38, near: 0.1, far: 300 }}
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        onReady?.();
      }}
      style={{ touchAction: interactive ? "none" : "pan-y" }}
    >
      <Scene data={data} interactive={interactive} reduced={reduced} />
    </Canvas>
  );
}
