"use client";
/* eslint-disable react-hooks/immutability --
 * 프레임 루프(useFrame)가 부모가 채운 paint ref 를 읽어 메시에 쓰는 것이 이 파일의 설계다. 렌더 중에는 쓰지 않는다. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { tempRgb, toThree, type TwinData, type TwinRack } from "@/lib/twin";
import { louvreTexture, rackCapTexture, rackDoorTexture, serverFaceTexture, withServerUv } from "@/lib/rack-art";

/*
 * 홈 3D 장면(X-RAY 스토리, 시나리오 시뮬레이터, 데이터 플라이휠)이 같이 쓰는 랙과 항온항습기.
 * datacenter-viewer 처럼 흑연색 캐비닛, 앞뒤 유공 문, 통풍 슬롯 상판으로 그린다.
 *
 * 온도 색은 문 안쪽 서버 앞면과 상판에만 칠한다. 랙은 아래, 가운데, 위 세 칸이고, 칸마다 색이 있다.
 * 장면은 RackPaint 에 칸 색(colors)과 랙마다 찬 정도(fill)를 쓰고 dirty 표시만 올린다. 그리기는 여기서 한다.
 *  - fill 0     캐비닛을 그리지 않는다(필름만 보이는 장면)
 *  - fill 0~1   캐비닛이 보이고, 꺼진 회색 서버가 아래 칸부터 색으로 켜진다
 *  - fill 1     세 칸이 다 켜지고 상판도 위 칸 색이 된다
 *
 * 깊이 순서(앞면 바깥으로): 본체 앞면, +2mm 꺼진 서버판, +4mm 색 칸 앞면, +12mm 문. 1cm 가까이 띄워 멀리서도 겹쳐 지글거리지 않는다.
 * 색 칸은 본체를 앞뒤로 4mm 뚫고 나온 얇은 상자 하나라서, 상자 하나로 앞면과 뒷면 서버가 같이 켜진다.
 * 부품마다 InstancedMesh 하나라 드로 콜은 7번이다.
 * @see docs/renewal-2026-11.md "랙 모양"
 */

/** 랙 칸 높이 범위 [m, 랙 바닥 기준]. 로봇 측정 높이(하, 중, 상)에 대응한다 */
export const BANDS: [number, number][] = [
  [0, 0.75],
  [0.75, 1.45],
  [1.45, 2.0],
];

export interface RackPaint {
  /** 칸 색, 선형 RGB. (랙 순번 * 3 + 칸) * 3 */
  colors: Float32Array;
  /** 랙마다 찬 정도 0~1 */
  fill: Float32Array;
  /** colors 를 바꿨으면 true. 그린 뒤 false 로 돌린다 */
  colorDirty: boolean;
  /** fill 을 바꿨으면 true. 그린 뒤 false 로 돌린다 */
  fillDirty: boolean;
}

export function makePaint(data: TwinData, fill = 1): RackPaint {
  const n = data.scene.racks.length;
  return {
    colors: new Float32Array(n * BANDS.length * 3),
    fill: new Float32Array(n).fill(fill),
    colorDirty: true,
    fillDirty: true,
  };
}

/** 흡기 온도로 칸 색을 만든다 (선형 RGB) */
export function rackColors(data: TwinData): Float32Array {
  const out = new Float32Array(data.scene.racks.length * BANDS.length * 3);
  const c: [number, number, number] = [0, 0, 0];
  const color = new THREE.Color();
  data.scene.racks.forEach((r, i) => {
    [r.inletLo, r.inletMid, r.inletHi].forEach((t, b) => {
      tempRgb(t, c);
      // instanceColor 는 선형 공간 값이라 sRGB 로 고른 색을 변환해 넣는다
      color.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
      const k = (i * BANDS.length + b) * 3;
      out[k] = color.r;
      out[k + 1] = color.g;
      out[k + 2] = color.b;
    });
  });
  return out;
}

const DOOR_INSET = 0.012;
const CAP_H = 0.022;
const RACK_GAP = 0.03;
/** 서버가 꽂히는 높이 범위 [m, 랙 바닥 기준] */
const BAY_LO = 0.05;
const BAY_TOP = 0.06;
const BODY = "#3b4149";
const CAP_OFF = new THREE.Color("#4a515b");
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

type ChassisPart = "body" | "cap" | "inFront" | "inBack" | "doorFront" | "doorBack";
const CHASSIS: ChassisPart[] = ["body", "cap", "inFront", "inBack", "doorFront", "doorBack"];

/** 랙 하나의 부품 행렬. 문 앞면 방향은 r.front (CFD +y = three -z) */
function chassisMatrix(part: ChassisPart, r: TwinRack, floor: number, out: THREE.Matrix4) {
  const [x, , zc] = toThree(r.x0 + r.w / 2, r.y0 + r.d / 2, 0);
  const w = r.w - RACK_GAP;
  const sFront = r.front === "+y" ? -1 : 1;
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const face = (side: 1 | -1, offset: number) => zc + sFront * side * (r.d / 2 + offset);
  const turn = (side: 1 | -1) => q.setFromAxisAngle(UP, sFront * side > 0 ? 0 : Math.PI);
  switch (part) {
    case "body":
      p.set(x, floor + r.h / 2, zc);
      s.set(w, r.h, r.d - DOOR_INSET * 2);
      break;
    case "cap":
      p.set(x, floor + r.h + CAP_H / 2, zc);
      s.set(w - 0.01, CAP_H, r.d - 0.02);
      break;
    case "inFront":
    case "inBack": {
      const side = part === "inFront" ? 1 : -1;
      p.set(x, floor + (BAY_LO + r.h - BAY_TOP) / 2, face(side, 0.002 - DOOR_INSET));
      turn(side);
      s.set(w - 0.05, r.h - BAY_TOP - BAY_LO, 1);
      break;
    }
    case "doorFront":
    case "doorBack": {
      const side = part === "doorFront" ? 1 : -1;
      p.set(x, floor + 0.03 + (r.h - 0.05) / 2, face(side, 0));
      turn(side);
      s.set(w - 0.02, r.h - 0.05, 1);
      break;
    }
  }
  return out.compose(p, q, s);
}

/** 색 칸 높이 범위. 서버가 꽂히는 범위 밖으로 나가지 않게 자른다 */
function bandRange(b: number, h: number): [number, number] {
  const [z0, z1] = BANDS[b];
  return [Math.max(z0, BAY_LO), Math.min(z1, h - BAY_TOP)];
}

/** 인스턴스마다 서버 그림을 미는 양 (랙마다 같은 값) */
function seeds(n: number, per: number) {
  const a = new Float32Array(n * per);
  for (let i = 0; i < n; i++) {
    const v = Math.abs((Math.sin(i * 12.9898 + 4.1414) * 43758.5453) % 1);
    for (let k = 0; k < per; k++) a[i * per + k] = v;
  }
  return a;
}

export function RackCabinets({ data, paint }: { data: TwinData; paint: React.RefObject<RackPaint> }) {
  const bandRef = useRef<THREE.InstancedMesh>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const inFrontRef = useRef<THREE.InstancedMesh>(null);
  const inBackRef = useRef<THREE.InstancedMesh>(null);
  const doorFrontRef = useRef<THREE.InstancedMesh>(null);
  const doorBackRef = useRef<THREE.InstancedMesh>(null);
  const { racks, room } = data.scene;
  const n = racks.length;
  const count = n * BANDS.length;
  // 랙마다 위 칸이 찬 정도. 상판 색을 꺼진 회색에서 온도 색으로 옮긴다
  const capK = useMemo(() => new Float32Array(n), [n]);
  const shown = useRef<boolean[]>([]);
  // 랙, 부품마다 미리 만든 행렬. 보일 때만 꽂는다
  const chassis = useMemo(
    () =>
      Object.fromEntries(
        CHASSIS.map((part) => [part, racks.map((r) => chassisMatrix(part, r, room.floor, new THREE.Matrix4()))]),
      ) as Record<ChassisPart, THREE.Matrix4[]>,
    [racks, room],
  );

  const geo = useMemo(() => {
    const band = new THREE.BoxGeometry(1, 1, 1);
    band.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds(n, BANDS.length), 1));
    const inner = new THREE.PlaneGeometry(1, 1);
    inner.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds(n, 1), 1));
    return { band, inner, plane: new THREE.PlaneGeometry(1, 1), box: new THREE.BoxGeometry(1, 1, 1) };
  }, [n]);
  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g.dispose();
    },
    [geo],
  );

  const mats = useMemo(() => {
    const servers = serverFaceTexture();
    // 켜진 서버: 조명과 무관하게 온도 색이 그대로 보이도록 MeshBasic(톤 매핑 끔). 인스턴스 색을 서버 그림에 곱한다
    const lit = withServerUv(new THREE.MeshBasicMaterial({ map: servers, toneMapped: false }), "rack-servers-lit");
    const dark = withServerUv(
      new THREE.MeshStandardMaterial({ map: servers, color: "#4b525c", roughness: 0.7, metalness: 0.2 }),
      "rack-servers-dark",
    );
    const door = (kind: "front" | "back") =>
      new THREE.MeshStandardMaterial({
        map: rackDoorTexture(kind),
        transparent: true,
        roughness: 0.45,
        metalness: 0.45,
      });
    // 상자 면 순서 +x, -x, +y(윗면), -y, +z, -z. 통풍 슬롯 무늬는 윗면에만 (두께 2cm 옆면에 붙이면 줄무늬가 눌려 점처럼 튄다)
    const capTop = new THREE.MeshBasicMaterial({ map: rackCapTexture(), toneMapped: false });
    const capSide = new THREE.MeshBasicMaterial({ color: "#c9cdd2", toneMapped: false });
    return {
      lit,
      dark,
      doorFront: door("front"),
      doorBack: door("back"),
      cap: [capSide, capSide, capTop, capSide, capSide, capSide],
      body: new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.5, metalness: 0.3 }),
    };
  }, []);
  useEffect(
    () => () => {
      for (const m of Object.values(mats)) for (const x of [m].flat()) x.dispose();
    },
    [mats],
  );

  useEffect(() => {
    // 색 버퍼를 만들어 두고 다음 프레임에 전부 다시 그린다
    bandRef.current?.setColorAt(0, new THREE.Color());
    capRef.current?.setColorAt(0, new THREE.Color());
    shown.current = [];
    paint.current.fillDirty = true;
    paint.current.colorDirty = true;
  }, [data, paint]);

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }),
    [],
  );

  useFrame(() => {
    const band = bandRef.current;
    const pt = paint.current;
    if (!band?.instanceColor) return;
    if (pt.fillDirty) {
      pt.fillDirty = false;
      pt.colorDirty = true;
      const parts: Record<ChassisPart, THREE.InstancedMesh | null> = {
        body: bodyRef.current,
        cap: capRef.current,
        inFront: inFrontRef.current,
        inBack: inBackRef.current,
        doorFront: doorFrontRef.current,
        doorBack: doorBackRef.current,
      };
      const { m, q, p, s } = tmp;
      let moved = false;
      racks.forEach((r, i) => {
        const local = pt.fill[i];
        BANDS.forEach((_, b) => {
          const [z0, z1] = bandRange(b, r.h);
          const k = Math.min(1, Math.max(0, local * BANDS.length - b));
          // 칸 사이에 틈을 두지 않아 다 차면 서버 전체가 한 번에 켜진 것처럼 보인다
          const h = (z1 - z0) * k;
          const [x, y, z] = toThree(r.x0 + r.w / 2, r.y0 + r.d / 2, room.floor + z0 + h / 2);
          m.compose(p.set(x, y, z), q, s.set(r.w - RACK_GAP - 0.06, h, r.d - DOOR_INSET * 2 + 0.008));
          // 빈 칸은 크기 0 으로 숨긴다. 높이만 0 에 가깝게 두면 윗면이 납작한 색 판으로 남아 필름을 가린다
          band.setMatrixAt(i * BANDS.length + b, k > 0 ? m : ZERO);
          if (b === BANDS.length - 1) capK[i] = k;
        });
        const show = local > 0;
        if (shown.current[i] !== show) {
          shown.current[i] = show;
          moved = true;
          for (const part of CHASSIS) parts[part]?.setMatrixAt(i, show ? chassis[part][i] : ZERO);
        }
      });
      band.instanceMatrix.needsUpdate = true;
      band.computeBoundingSphere();
      if (moved)
        for (const part of CHASSIS) {
          const pm = parts[part];
          if (!pm) continue;
          pm.instanceMatrix.needsUpdate = true;
          pm.computeBoundingSphere();
        }
    }
    if (!pt.colorDirty) return;
    pt.colorDirty = false;
    (band.instanceColor.array as Float32Array).set(pt.colors);
    band.instanceColor.needsUpdate = true;
    // 상판: 위 칸 색을 위 칸이 찬 만큼 섞는다
    const capColor = capRef.current?.instanceColor;
    if (capColor) {
      const ca = capColor.array as Float32Array;
      const arr = pt.colors;
      for (let i = 0; i < n; i++) {
        const k = capK[i];
        const src = (i * BANDS.length + BANDS.length - 1) * 3;
        ca[i * 3] = CAP_OFF.r + (arr[src] - CAP_OFF.r) * k;
        ca[i * 3 + 1] = CAP_OFF.g + (arr[src + 1] - CAP_OFF.g) * k;
        ca[i * 3 + 2] = CAP_OFF.b + (arr[src + 2] - CAP_OFF.b) * k;
      }
      capColor.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={bodyRef} args={[geo.box, mats.body, n]} frustumCulled={false} />
      <instancedMesh ref={capRef} args={[geo.box, mats.cap, n]} frustumCulled={false} />
      <instancedMesh ref={inFrontRef} args={[geo.inner, mats.dark, n]} frustumCulled={false} />
      <instancedMesh ref={inBackRef} args={[geo.inner, mats.dark, n]} frustumCulled={false} />
      <instancedMesh ref={bandRef} args={[geo.band, mats.lit, count]} frustumCulled={false} />
      <instancedMesh ref={doorFrontRef} args={[geo.plane, mats.doorFront, n]} frustumCulled={false} />
      <instancedMesh ref={doorBackRef} args={[geo.plane, mats.doorBack, n]} frustumCulled={false} />
    </>
  );
}

/**
 * 항온항습기(바닥형). 받침 위에 밝은 외함, 긴 면(앞, 뒤)에 루버와 계기 창, 나머지는 민판.
 * failed 인 장비는 외함을 붉게 칠하고 빛나게 한다(시뮬레이터의 고장 시나리오).
 */
export function CrahUnits({ data, failedLime = false }: { data: TwinData; failedLime?: boolean }) {
  const { units, room } = data.scene;
  const mats = useMemo(() => {
    const make = (failed: boolean) => {
      // failedLime: 솔루션 페이지에서는 멈춘 장비를 라임으로 칠하고 은은하게 빛나게 한다
      const lime = failed && failedLime;
      const tint = lime ? "#c6ff3d" : failed ? "#4a4a4a" : "#ffffff";
      const glow = lime ? { emissive: new THREE.Color("#c6ff3d"), emissiveIntensity: 0.35 } : {};
      const louvre = new THREE.MeshStandardMaterial({
        map: louvreTexture(),
        color: tint,
        roughness: 0.55,
        metalness: 0.1,
        ...glow,
      });
      const plain = new THREE.MeshStandardMaterial({
        color: lime ? "#c6ff3d" : failed ? "#2c2c2c" : "#d3d9e0",
        roughness: 0.55,
        metalness: 0.1,
        ...glow,
      });
      const top = new THREE.MeshStandardMaterial({ color: lime ? "#dcff8a" : failed ? "#333333" : "#aab3bd", roughness: 0.6, ...glow });
      // 상자 면 순서 +x, -x, +y, -y, +z, -z
      return {
        x: [louvre, louvre, top, plain, plain, plain],
        z: [plain, plain, top, plain, louvre, louvre],
        all: [louvre, plain, top],
      };
    };
    return {
      ok: make(false),
      failed: make(true),
      plinth: new THREE.MeshStandardMaterial({ color: "#1f252d", roughness: 0.8 }),
    };
  }, [failedLime]);
  useEffect(
    () => () => {
      for (const m of [...mats.ok.all, ...mats.failed.all, mats.plinth]) m.dispose();
    },
    [mats],
  );

  return (
    <>
      {units.map((u) => {
        const [x, , z] = toThree((u.x0 + u.x1) / 2, (u.y0 + u.y1) / 2, 0);
        const alongY = u.y1 - u.y0 > u.x1 - u.x0;
        const set = u.failed ? mats.failed : mats.ok;
        return (
          <group key={u.id} position={[x, room.floor, z]}>
            <mesh position={[0, 0.04, 0]} material={mats.plinth}>
              <boxGeometry args={[u.x1 - u.x0 - 0.1, 0.08, u.y1 - u.y0 - 0.1]} />
            </mesh>
            <mesh position={[0, 0.08 + 0.96, 0]} material={alongY ? set.x : set.z}>
              <boxGeometry args={[u.x1 - u.x0 - 0.06, 1.92, u.y1 - u.y0 - 0.06]} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
