#!/usr/bin/env node
/* ============================================================
   MedReader — 홈 화면 아이콘 만들기 (8j · spec 19-1-1 E3 (가))

     node apps/medreader/dev/make-icons.mjs          ← icons/ 의 SVG 1개 + PNG 4개를 다시 쓴다
     node apps/medreader/dev/make-icons.mjs --check  ← 쓰지 않고 지금 파일이 도안과 같은지만 (다르면 종료 코드 1)

   ── 왜 이렇게 ──────────────────────────────────────────
   · npm 0 — Node 내장 `zlib` 로 PNG 를 직접 쓴다(복잡한 SVG 래스터화 라이브러리 없이).
   · **도안은 아래 `DESIGN` 한 벌**이다. SVG 글자와 PNG 픽셀이 둘 다 여기서 나온다 —
     그래서 "SVG 와 PNG 의 그림이 다르다"는 일이 생기지 않는다(`tests/manifest-8j.test.mjs` 가
     파일과 이 생성기의 결과를 맞대 본다).
   · 도안: 파란 바탕(`--c-accent` #0b5c8a) 위에 **펼친 책**(흰색)과 그 위에서 양옆으로 퍼지는
     **소리 물결** "(( ))"(하이라이트 노랑 `--hl-bg` #ffef9e) — "읽어 주는 책". 의료 십자 같은
     오해 소지 표식은 쓰지 않는다. 위로 퍼지는 부채꼴 물결은 Wi-Fi(= 인터넷 필요)로 읽혀 피했다.
   · 만드는 것
       icons/icon.svg                any       (둥근 사각 바탕, 모서리 밖은 투명)
       icons/icon-192.png · -512.png any       (SVG 와 같은 그림)
       icons/icon-maskable-192.png · -512.png  maskable — 바탕을 칸 끝까지 채우고(OS 가 모양을 자른다)
                                               그림을 가운데 기준 0.8 배로 줄여 **안전 영역(지름 80% 원)** 안에 둔다
   · 래스터: 픽셀마다 4×4 표본, 표본마다 맨 위 도형의 색 → 평균. 부동소수 계산만 쓰므로
     기계가 달라도 같은 픽셀이 나온다. PNG 는 RGBA 8bit, 모든 줄 필터 0.
   ============================================================ */

import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 앱 폴더(`apps/medreader`) — 이 파일의 한 단계 위. */
export const APP_DIR = fileURLToPath(new URL('..', import.meta.url));
export const ICON_DIR = join(APP_DIR, 'icons');

/** 도안 좌표계(512 × 512). */
export const VIEW = 512;
/** maskable 의 그림 축소 배율 — 그림 전체가 반지름 0.4×VIEW 원 안에 든다(테스트 IC4 가 잰다). */
export const MASKABLE_SCALE = 0.8;

const BLUE = '#0b5c8a';
const WHITE = '#ffffff';
const YELLOW = '#ffef9e';

const WAVE_CX = 256;
const WAVE_CY = 202;
const WAVE_W = 22;

/**
 * 도안. 그리는 순서 = 배열 순서(뒤가 위).
 *   bg      바탕 — any: 둥근 사각(rx 96), maskable: 칸 전체
 *   poly    볼록 다각형(책 두 쪽)
 *   circle  소리의 근원 점
 *   arc     소리 물결 — 중심·반지름·각도 범위·굵기, 끝은 둥글게(stroke-linecap round)
 */
export const DESIGN = Object.freeze([
  { kind: 'bg', fill: BLUE, rx: 96 },
  { kind: 'poly', fill: WHITE, pts: [[104, 276], [248, 300], [248, 380], [104, 356]] },
  { kind: 'poly', fill: WHITE, pts: [[408, 276], [264, 300], [264, 380], [408, 356]] },
  // 오른쪽 ")" 두 겹 · 왼쪽 "(" 두 겹 — 책 위에서 양옆으로 퍼지는 소리
  { kind: 'arc', stroke: YELLOW, cx: WAVE_CX, cy: WAVE_CY, r: 46, a0: -42, a1: 42, w: WAVE_W },
  { kind: 'arc', stroke: YELLOW, cx: WAVE_CX, cy: WAVE_CY, r: 92, a0: -42, a1: 42, w: WAVE_W },
  { kind: 'arc', stroke: YELLOW, cx: WAVE_CX, cy: WAVE_CY, r: 46, a0: 138, a1: 222, w: WAVE_W },
  { kind: 'arc', stroke: YELLOW, cx: WAVE_CX, cy: WAVE_CY, r: 92, a0: 138, a1: 222, w: WAVE_W }
]);

/** 만드는 PNG 네 개(manifest 의 `icons` 와 같은 이름·크기). */
export const PNGS = Object.freeze([
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true }
]);

const rad = (d) => d * Math.PI / 180;
const fmt = (n) => String(Math.round(n * 100) / 100);

/* ── SVG ─────────────────────────────────────────────── */

/** `icons/icon.svg` 의 글자(LF). */
export function svgOf() {
  const L = [];
  L.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VIEW + ' ' + VIEW + '">');
  L.push('  <!-- MedReader — 펼친 책 + 소리 물결. dev/make-icons.mjs 가 만든다(손으로 고치지 않는다). -->');
  for (const s of DESIGN) {
    if (s.kind === 'bg') {
      L.push('  <rect width="' + VIEW + '" height="' + VIEW + '" rx="' + s.rx + '" fill="' + s.fill + '"/>');
    } else if (s.kind === 'poly') {
      L.push('  <path d="M' + s.pts.map((p) => p[0] + ' ' + p[1]).join(' L') + 'Z" fill="' + s.fill + '"/>');
    } else if (s.kind === 'circle') {
      L.push('  <circle cx="' + s.cx + '" cy="' + s.cy + '" r="' + s.r + '" fill="' + s.fill + '"/>');
    } else if (s.kind === 'arc') {
      const x0 = s.cx + s.r * Math.cos(rad(s.a0)), y0 = s.cy + s.r * Math.sin(rad(s.a0));
      const x1 = s.cx + s.r * Math.cos(rad(s.a1)), y1 = s.cy + s.r * Math.sin(rad(s.a1));
      // 각도가 커지는 쪽(화면에서 시계 방향) = sweep-flag 1. 90° 라 large-arc 0.
      L.push('  <path d="M' + fmt(x0) + ' ' + fmt(y0) + ' A' + s.r + ' ' + s.r + ' 0 0 1 ' + fmt(x1) + ' ' + fmt(y1) +
        '" fill="none" stroke="' + s.stroke + '" stroke-width="' + s.w + '" stroke-linecap="round"/>');
    }
  }
  L.push('</svg>');
  return L.join('\n') + '\n';
}

/* ── 래스터 ──────────────────────────────────────────── */

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

function inRoundRect(x, y, w, h, r) {
  if (x < 0 || y < 0 || x > w || y > h) return false;
  const cx = x < r ? r : x > w - r ? w - r : x;
  const cy = y < r ? r : y > h - r ? h - r : y;
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** 볼록 다각형 — 모든 변의 같은 쪽에 있으면 안. */
function inConvex(x, y, pts) {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (c === 0) continue;
    const s = c > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** 둥근 끝 호 — 중심선(호)까지 거리가 굵기의 절반 이하. */
function onArc(x, y, s) {
  const dx = x - s.cx, dy = y - s.cy;
  const half = s.w / 2;
  // 빠른 거절 — 둥근 끝을 포함해 획 위의 점은 모두 중심에서 r ± half 사이다(삼각 부등식). 결과는 같다.
  const d2 = dx * dx + dy * dy;
  if (d2 > (s.r + half) * (s.r + half) || d2 < (s.r - half) * (s.r - half)) return false;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  // 각도 범위가 ±180° 를 넘어가도(왼쪽 호 138°~222°) 되도록 가운데 각에서 잰다.
  const mid = (s.a0 + s.a1) / 2;
  const off = ((ang - mid) % 360 + 540) % 360 - 180;
  if (Math.abs(off) <= (s.a1 - s.a0) / 2) {
    const d = Math.sqrt(dx * dx + dy * dy) - s.r;
    return d >= -half && d <= half;
  }
  for (const a of [s.a0, s.a1]) {
    const ex = s.cx + s.r * Math.cos(rad(a)), ey = s.cy + s.r * Math.sin(rad(a));
    const ddx = x - ex, ddy = y - ey;
    if (ddx * ddx + ddy * ddy <= half * half) return true;
  }
  return false;
}

/**
 * 도안 좌표 (x, y) 의 색(맨 위 도형) — 아무것도 없으면 null(투명).
 * maskable 이면 바탕은 칸 전체이고, 그림은 가운데 기준 `MASKABLE_SCALE` 배.
 */
export function colorAt(x, y, maskable) {
  let out = null;
  const c = VIEW / 2;
  const gx = maskable ? c + (x - c) / MASKABLE_SCALE : x;
  const gy = maskable ? c + (y - c) / MASKABLE_SCALE : y;
  for (const s of DESIGN) {
    if (s.kind === 'bg') {
      if (maskable ? (x >= 0 && y >= 0 && x <= VIEW && y <= VIEW) : inRoundRect(x, y, VIEW, VIEW, s.rx)) out = s.fill;
    } else if (s.kind === 'poly') {
      if (inConvex(gx, gy, s.pts)) out = s.fill;
    } else if (s.kind === 'circle') {
      const dx = gx - s.cx, dy = gy - s.cy;
      if (dx * dx + dy * dy <= s.r * s.r) out = s.fill;
    } else if (s.kind === 'arc') {
      if (onArc(gx, gy, s)) out = s.stroke;
    }
  }
  return out;
}

const SS = 4;   // 한 변 표본 수

/** size × size RGBA(Uint8Array, 행 우선). */
export function rasterize(size, maskable) {
  const px = new Uint8Array(size * size * 4);
  const k = VIEW / size;
  const cache = new Map();
  for (let py = 0; py < size; py++) {
    for (let pxl = 0; pxl < size; pxl++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxl + (sx + 0.5) / SS) * k;
          const y = (py + (sy + 0.5) / SS) * k;
          const col = colorAt(x, y, maskable);
          if (!col) continue;
          let rgb = cache.get(col);
          if (!rgb) { rgb = hex(col); cache.set(col, rgb); }
          r += rgb[0]; g += rgb[1]; b += rgb[2]; a += 1;
        }
      }
      const o = (py * size + pxl) * 4;
      if (a) {
        px[o] = Math.round(r / a);
        px[o + 1] = Math.round(g / a);
        px[o + 2] = Math.round(b / a);
        px[o + 3] = Math.round(255 * a / (SS * SS));
      }
    }
  }
  return px;
}

/* ── PNG ─────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

export const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** RGBA → PNG(8bit, 색 유형 6, 줄 필터 0). */
export function pngOf(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([PNG_SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** PNG 머리(IHDR)의 너비·높이·비트 깊이·색 유형. PNG 가 아니면 던진다. */
export function pngHeader(buf) {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIG)) throw new Error('PNG 서명이 아니다');
  if (buf.toString('ascii', 12, 16) !== 'IHDR') throw new Error('첫 청크가 IHDR 이 아니다');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bitDepth: buf[24], colorType: buf[25] };
}

/* ── 명령줄 ────────────────────────────────────────── */
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const check = process.argv.includes('--check');
  const want = [{ file: 'icon.svg', data: Buffer.from(svgOf(), 'utf8') }];
  for (const p of PNGS) want.push({ file: p.file, data: pngOf(p.size, p.size, rasterize(p.size, p.maskable)), png: p });
  if (check) {
    const bad = [];
    for (const w of want) {
      const f = join(ICON_DIR, w.file);
      if (!existsSync(f)) { bad.push(w.file + ' 없음'); continue; }
      const have = readFileSync(f);
      // PNG 는 압축 결과가 zlib 판에 따라 다를 수 있어 **픽셀**로 비교한다(테스트가 같은 일을 한다).
      // 여기서는 크기만 본다 — 픽셀 비교는 tests/manifest-8j.test.mjs IC3.
      if (w.png) {
        const hd = pngHeader(have);
        if (hd.width !== w.png.size || hd.height !== w.png.size) bad.push(w.file + ' 크기 ' + hd.width + '×' + hd.height);
      } else if (have.toString('utf8').replace(/\r\n/g, '\n') !== w.data.toString('utf8')) bad.push(w.file + ' 내용이 다르다');
    }
    if (bad.length) { console.error('make-icons: ' + bad.join(' · ') + ' — `node apps/medreader/dev/make-icons.mjs` 를 돌려라'); process.exit(1); }
    console.log('make-icons: 그대로다 (' + want.length + '개)');
  } else {
    mkdirSync(ICON_DIR, { recursive: true });
    for (const w of want) writeFileSync(join(ICON_DIR, w.file), w.data);
    console.log('make-icons: ' + want.map((w) => w.file + ' ' + w.data.length + 'B').join(' · '));
  }
}
