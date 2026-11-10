import * as THREE from "three";

/*
 * 홈 3D 장면의 랙, 항온항습기 재질에 쓰는 절차 텍스처(캔버스로 그린다). 외부 이미지를 받지 않는다.
 * 그림 방식은 datacenter-viewer 의 lib/site/textures.ts (유공 문, 상판 통풍 슬롯, 루버)를 줄여 옮긴 것이다.
 * 브라우저에서만 부른다(장면은 Canvas 안에서만 만든다). 한 번 만든 텍스처는 캐시한다.
 * @see docs/renewal-2026-11.md "랙 모양"
 */

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function finish(key: string, c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** 0..1 결정적 난수 (매번 같은 그림) */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 유공 문. 구멍 자리는 투명(alpha 0)이라 문 안쪽 서버가 비쳐 보인다.
 * 앞문은 한 짝에 손잡이, 뒷문은 두 짝이다.
 */
export function rackDoorTexture(kind: "front" | "back"): THREE.Texture {
  const key = `door:${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 256;
  const H = 768;
  const { c, g } = canvas(W, H);
  const fr = 12;
  g.fillStyle = "#2b3037";
  g.fillRect(0, 0, W, H);
  g.clearRect(fr, fr, W - fr * 2, H - fr * 2);
  const panels =
    kind === "front"
      ? [[fr, W - fr]]
      : [
          [fr, W / 2 - 3],
          [W / 2 + 3, W - fr],
        ];
  if (kind === "back") {
    g.fillStyle = "#23272d";
    g.fillRect(W / 2 - 3, fr, 6, H - fr * 2);
  }
  for (const [a, b] of panels) {
    // 8px 격자에 6px 구멍. 금속 띠도 살짝 비친다(alpha 0.7)
    g.globalAlpha = 0.7;
    g.fillStyle = "#59606a";
    g.fillRect(a, fr, b - a, H - fr * 2);
    g.globalAlpha = 1;
    for (let y = fr + 6; y < H - fr - 6; y += 8) {
      const off = ((y / 8) | 0) % 2 ? 4 : 0;
      for (let x = a + 6 + off; x < b - 6; x += 8) g.clearRect(x, y, 6, 6);
    }
    g.fillStyle = "rgba(255,255,255,0.16)";
    g.fillRect(a, fr, b - a, 2);
  }
  if (kind === "front") {
    g.fillStyle = "#a3abb5";
    g.fillRect(W - fr - 22, H * 0.42, 9, H * 0.16);
    g.fillStyle = "rgba(0,0,0,0.55)";
    g.fillRect(W - fr - 14, H * 0.42, 2, H * 0.16);
  }
  return finish(key, c);
}

/** 상판: 흰 바탕에 통풍 슬롯 두 묶음. 인스턴스 색(온도)을 곱해 칠한다 */
export function rackCapTexture(): THREE.Texture {
  const key = "cap";
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 128;
  const H = 256;
  const { c, g } = canvas(W, H);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.fillRect(0, 0, W, 3);
  g.fillRect(0, H - 3, W, 3);
  g.fillRect(0, 0, 3, H);
  g.fillRect(W - 3, 0, 3, H);
  for (const [y0, y1] of [
    [H * 0.18, H * 0.42],
    [H * 0.58, H * 0.82],
  ]) {
    for (let y = y0; y < y1; y += 7) {
      g.fillStyle = "rgba(0,0,0,0.42)";
      g.fillRect(W * 0.2, y, W * 0.6, 3);
    }
  }
  return finish(key, c);
}

/**
 * 랙 안 서버 앞면. 가로는 랙 안쪽 폭 전체(양옆 마운트 레일 포함), 세로는 SERVER_PERIOD 미터만큼이고 위아래로 이어 붙는다.
 * 밝은 회색 바탕이라 곱하는 색(온도 색, 꺼진 회색)이 그대로 드러난다. 1U, 2U 서버와 막음판이 섞여 있다.
 */
export const SERVER_PERIOD = 0.9;
export function serverFaceTexture(): THREE.Texture {
  const key = "servers";
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 256;
  const H = 512;
  // 1U = 44.45mm. 0.9m 는 약 20U
  const U = H / 20;
  const { c, g } = canvas(W, H);
  const r = rng(7);
  // 마운트 레일
  g.fillStyle = "#3a4048";
  g.fillRect(0, 0, W, H);
  const x0 = 14;
  const x1 = W - 14;
  g.fillStyle = "#6d747d";
  for (let y = 4; y < H; y += U / 3) {
    g.fillRect(5, y, 4, 3);
    g.fillRect(W - 9, y, 4, 3);
  }
  let u = 0;
  while (u < 20) {
    const roll = r();
    const size = roll < 0.12 ? 1 : roll < 0.55 ? 1 : roll < 0.9 ? 2 : 4;
    const n = Math.min(size, 20 - u);
    const y = u * U;
    const h = n * U;
    if (roll < 0.12) {
      // 막음판
      g.fillStyle = "#4a5058";
      g.fillRect(x0, y + 1, x1 - x0, h - 2);
    } else {
      g.fillStyle = "#e6e9ed";
      g.fillRect(x0, y + 1, x1 - x0, h - 2);
      // 디스크 베이 또는 통풍 구멍
      const bays = n === 1 ? 10 : 8;
      const bw = ((x1 - x0) * 0.72) / bays;
      for (let i = 0; i < bays; i++) {
        const bx = x0 + 8 + i * bw;
        g.fillStyle = "#8b939d";
        g.fillRect(bx, y + 3, bw - 3, h - 6);
        g.fillStyle = "#b9c0c8";
        g.fillRect(bx + 1, y + 4, bw - 5, 2);
      }
      // 손잡이 쪽 통풍 슬롯
      g.fillStyle = "#6a727c";
      for (let yy = y + 4; yy < y + h - 4; yy += 3) g.fillRect(x1 - 52, yy, 30, 1.5);
      // 상태 LED
      g.fillStyle = "#ffffff";
      g.fillRect(x1 - 14, y + h / 2 - 2, 4, 4);
      if (r() < 0.6) g.fillRect(x1 - 20, y + h / 2 - 2, 4, 4);
    }
    u += n;
  }
  return finish(key, c, true);
}

/** 항온항습기 외함: 밝은 회색 판, 아래 2/3 는 가로 루버 */
export function louvreTexture(): THREE.Texture {
  const key = "louvre";
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 256;
  const H = 512;
  const { c, g } = canvas(W, H);
  g.fillStyle = "#dfe4ea";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(70, 80, 92, 0.35)";
  g.fillRect(0, 0, W, 3);
  g.fillRect(0, 0, 3, H);
  g.fillRect(W - 3, 0, 3, H);
  g.fillRect(0, H * 0.3, W, 2);
  // 계기 창과 표시등
  g.fillStyle = "#1f2933";
  g.fillRect(W * 0.3, H * 0.1, W * 0.4, H * 0.1);
  g.fillStyle = "#5eead4";
  g.fillRect(W * 0.34, H * 0.13, W * 0.18, H * 0.04);
  g.fillStyle = "#22c55e";
  g.fillRect(W * 0.6, H * 0.14, 8, 8);
  const top = H * 0.36;
  const bot = H - 18;
  g.fillStyle = "#c3cad3";
  g.fillRect(14, top, W - 28, bot - top);
  for (let y = top + 4; y < bot - 4; y += 11) {
    g.fillStyle = "#5b6672";
    g.fillRect(16, y, W - 32, 4);
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.fillRect(16, y + 4, W - 32, 2);
  }
  return finish(key, c);
}

/**
 * 서버 그림의 세로 uv 를 월드 높이로 정한다. 칸 높이가 차오르며 바뀌어도 그림이 눌리지 않고 제자리에 있다.
 * 인스턴스마다 aSeed 만큼 그림을 밀어 모든 랙이 같은 무늬로 보이지 않게 한다.
 */
export function withServerUv<M extends THREE.Material>(mat: M, key: string): M {
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nattribute float aSeed;").replace(
      "#include <uv_vertex>",
      `#include <uv_vertex>
#ifdef USE_MAP
vMapUv = vec2(uv.x, (instanceMatrix * vec4(position, 1.0)).y / ${SERVER_PERIOD.toFixed(3)} + aSeed);
#endif`,
    );
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}
