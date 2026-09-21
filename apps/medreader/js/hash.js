/* ============================================================
   MedReader — 해시 (spec 7-5 · 18절)

   순수 계층이다. 전역은 `globalThis.crypto` **존재 검사** 하나만
   본다(16-K 예외). `document`·`window`·`fetch`·`indexedDB` 를 모른다.

   두 가지 쓰임이 있다.
     1) 캐시 키 (7-5)          — 짧은 텍스트, 보안 컨텍스트면 SHA-256
     2) 파일 동일성 판별 (9-2) — `documents.fileHash` unique 인덱스

   보안 컨텍스트가 아니면(LAN http 로 접속한 실기기) `crypto.subtle` 이
   없다. 그때는 FNV-1a 64 로 떨어진다. 두 알고리즘의 결과가 한 저장소에
   섞여도 구분되도록 **접두사**를 붙인다: `s256:` / `fnv:`.
   ============================================================ */

/* ────────────────────────────────────────────────────────
   FNV-1a 64비트
   BigInt 을 쓰지 않는다 — 파일 샘플(수 MB)을 바이트 단위로 도는데
   BigInt 곱셈은 너무 느리다. 16비트 림브 4개로 64비트를 흉내낸다.

     basis = 0xcbf29ce484222325
     prime = 0x00000100000001b3  → 림브 [0x01b3, 0x0000, 0x0100, 0x0000]
   ──────────────────────────────────────────────────────── */
function fnv1a64Limbs(bytes) {
  let h0 = 0x2325, h1 = 0x8422, h2 = 0x9ce4, h3 = 0xcbf2;
  for (let i = 0; i < bytes.length; i++) {
    h0 ^= bytes[i] & 0xff;
    // 64비트 곱셈 (mod 2^64) — 넘치는 자리는 버린다
    let t0 = h0 * 0x01b3;
    let t1 = h1 * 0x01b3;
    let t2 = h2 * 0x01b3 + h0 * 0x0100;
    let t3 = h3 * 0x01b3 + h1 * 0x0100;
    t1 += Math.floor(t0 / 0x10000); h0 = t0 & 0xffff;
    t2 += Math.floor(t1 / 0x10000); h1 = t1 & 0xffff;
    t3 += Math.floor(t2 / 0x10000); h2 = t2 & 0xffff;
    h3 = t3 & 0xffff;
  }
  return [h0, h1, h2, h3];
}

function hex4(n) { return (n & 0xffff).toString(16).padStart(4, '0'); }

/** UTF-8 바이트를 만든다. TextEncoder 는 전역이지만 Node·브라우저 양쪽 표준이다. */
function utf8(str) {
  return new TextEncoder().encode(String(str));
}

/**
 * FNV-1a 64 — 16자 hex.
 * @param {string|Uint8Array} input
 * @returns {string} 접두사 없는 16자 hex
 */
export function fnv1a64Hex(input) {
  const bytes = typeof input === 'string' ? utf8(input) : input;
  const h = fnv1a64Limbs(bytes);
  return hex4(h[3]) + hex4(h[2]) + hex4(h[1]) + hex4(h[0]);
}

/* ────────────────────────────────────────────────────────
   SHA-256 — 보안 컨텍스트에서만
   ──────────────────────────────────────────────────────── */

/** `crypto.subtle` 을 쓸 수 있는가. 존재 검사만 한다(16-K 예외). */
export function hasSubtle() {
  return !!(globalThis.crypto && globalThis.crypto.subtle && globalThis.crypto.subtle.digest);
}

function toHex(buf) {
  const v = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < v.length; i++) s += v[i].toString(16).padStart(2, '0');
  return s;
}

/**
 * spec 7-5 — 해시 문자열. 접두사로 알고리즘을 구분한다.
 *   보안 컨텍스트: `s256:` + 64자 hex
 *   폴백:        `fnv:` + 16자 hex + `:` + 바이트 길이
 *
 * 폴백에 길이를 붙이는 이유: 64비트는 생일 문제로 2^32(약 43억) 개에서
 * 충돌이 기대된다. 길이를 함께 보면 서로 다른 길이의 입력끼리는
 * 구조적으로 갈린다 — 캐시 키의 오염을 실질적으로 없앤다.
 *
 * @param {string|Uint8Array} input
 * @returns {Promise<string>}
 */
export async function hashHex(input) {
  const bytes = typeof input === 'string' ? utf8(input) : input;
  if (hasSubtle()) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return 's256:' + toHex(digest);
  }
  return 'fnv:' + fnv1a64Hex(bytes) + ':' + bytes.length;
}

/** 동기 폴백 — `crypto.subtle` 이 있어도 FNV 를 쓴다(테스트·비동기 불가 지점). */
export function hashHexSync(input) {
  const bytes = typeof input === 'string' ? utf8(input) : input;
  return 'fnv:' + fnv1a64Hex(bytes) + ':' + bytes.length;
}

/* ────────────────────────────────────────────────────────
   spec 7-5 — 캐시 키
   ──────────────────────────────────────────────────────── */

/** 7-5 `normalize(text)` */
export function normalizeForHash(text) {
  return String(text).normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/**
 * spec 7-5 캐시 키 조립.
 *   `${kind}|${targetLang}|${docId}|${hash(normalize(text))}${extra ? '|' + extra : ''}`
 *
 * @param {string} docId
 * @param {string} text
 * @param {string} targetLang
 * @param {'translate'|'summarize'|'quiz'|'table'|'grade'} kind
 * @param {string} [extra]
 * @returns {Promise<string>}
 */
export async function cacheKey(docId, text, targetLang, kind, extra = '') {
  const h = await hashHex(normalizeForHash(text));
  return kind + '|' + targetLang + '|' + docId + '|' + h + (extra ? '|' + extra : '');
}

/* ============================================================
   파일 동일성 판별 (spec 9-2 `documents.fileHash` unique)

   ── 왜 전체를 읽지 않는가 ──────────────────────────────
   7000쪽 실자료는 200MB 를 넘을 수 있다. `file.arrayBuffer()` 로 전체를
   올리면 (a) 200MB 가 한 번에 힙에 올라오고 (b) Android Chrome 에서
   그대로 탭이 죽는다. pdf.js 가 이미 같은 버퍼를 들고 있으므로 순간
   점유는 두 배가 된다.

   ── 목적 ──────────────────────────────────────────────
   **암호학적 무결성이 아니라 "이 파일을 전에 가져왔는가"** 다. 악의적
   충돌을 방어할 이유가 없다(파일은 사용자 자신의 것이다).

   ── 전략 ──────────────────────────────────────────────
   `size` 와 함께 고정 위치의 조각들만 읽어 그 연결을 해시한다.
     · 앞 1MB      — 헤더·XRef·생성기 정보
     · 뒤 1MB      — PDF 의 trailer·startxref. **증분 저장은 여기가 바뀐다**
     · 가운데 16개 × 64KB 를 균등 간격으로 — 본문 내용
   총 읽기량은 파일 크기와 무관하게 **약 3MB** 다.
   작은 파일(<= FULL_HASH_MAX)은 그냥 전체를 읽는다 — 더 싸고 더 정확하다.

   ── 충돌 위험 ─────────────────────────────────────────
   서로 다른 두 파일이 같은 키를 가지려면 **크기가 바이트 단위로 같고**
   앞 1MB·뒤 1MB·균등 간격 16개 구간이 **전부** 같아야 한다.
   · 같은 책의 다른 판·다른 압축: 크기가 거의 확실히 다르다.
   · 증분 업데이트(주석 추가 등): 크기가 늘고 trailer 가 바뀐다.
   · 남는 위험: 크기가 정확히 같고 표본 밖 본문만 다른 경우. 현실에서는
     "같은 도구로 만든 두 파일의 내부 몇 바이트만 다름" 정도이며,
     그래도 가운데 16개 표본을 피해야 한다.
   그래서 **키에 size 를 문자열로 박아 넣고**, 가져오기 단계에서
   `pageCount` 를 함께 비교한다(같은 해시인데 쪽수가 다르면 다른 파일로
   취급한다). 이 두 겹이면 사용자 자신의 서재에서 실질적 위험은 없다.
   위험을 완전히 없애려면 전체 해시뿐인데, 그건 위의 (a)(b) 대가를 낸다.
   ============================================================ */

/** 이 크기 이하는 전체를 읽는다 (8MB). */
export const FULL_HASH_MAX = 8 * 1024 * 1024;
/** 앞·뒤 조각 크기 (1MB). */
export const EDGE_CHUNK = 1024 * 1024;
/** 가운데 표본 개수와 크기. */
export const MID_SAMPLES = 16;
export const MID_CHUNK = 64 * 1024;

/**
 * 표본 구간 목록을 만든다. **순수 함수** — 테스트가 이것을 고정한다.
 * 구간은 오름차순이고 서로 겹치지 않는다.
 *
 * @param {number} size 파일 바이트 수
 * @returns {Array<[number, number]>} [start, end) 목록. 전체를 읽어야 하면 [[0, size]]
 */
export function sampleRanges(size) {
  const n = Math.max(0, Math.floor(size));
  if (n <= FULL_HASH_MAX) return n > 0 ? [[0, n]] : [];

  const raw = [];
  raw.push([0, EDGE_CHUNK]);
  // 가운데: 앞 조각 끝 ~ 뒤 조각 시작 사이를 균등 분할
  const lo = EDGE_CHUNK;
  const hi = n - EDGE_CHUNK;
  if (hi > lo) {
    const span = hi - lo;
    for (let i = 0; i < MID_SAMPLES; i++) {
      // (i + 0.5) / MID_SAMPLES 위치. 끝에 붙지 않게 중앙 정렬한다.
      const start = lo + Math.floor(span * ((i + 0.5) / MID_SAMPLES)) - Math.floor(MID_CHUNK / 2);
      const s = Math.max(lo, Math.min(hi - MID_CHUNK, start));
      raw.push([s, s + MID_CHUNK]);
    }
  }
  raw.push([n - EDGE_CHUNK, n]);

  // 겹치는 구간을 합친다(작은 파일·촘촘한 표본에서 생긴다).
  raw.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const r of raw) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) { last[1] = Math.max(last[1], r[1]); continue; }
    out.push([r[0], r[1]]);
  }
  return out;
}

/**
 * 파일(Blob) 동일성 키. 전역을 쓰지 않는다 — 인자로 받은 객체의
 * `size` 와 `slice()` 만 쓴다(테스트에서 가짜 Blob 으로 대체 가능).
 *
 * 형식: `s256:p:<size>:<hex64>` (표본) / `s256:<hex64>` (전체)
 *       `fnv:p:<size>:<hex16>`  (표본) / `fnv:<hex16>:<len>` (전체)
 *
 * @param {{size:number, slice:Function}} blob
 * @returns {Promise<string>}
 */
export async function fileIdentityHash(blob) {
  const size = Number(blob && blob.size) || 0;
  const ranges = sampleRanges(size);
  const full = ranges.length === 1 && ranges[0][0] === 0 && ranges[0][1] === size;

  // size 를 먼저 넣는다 — 표본이 같아도 크기가 다르면 키가 갈린다.
  const head = utf8(String(size) + ':' + ranges.length + ';');
  let total = head.length;
  const parts = [head];
  for (const [s, e] of ranges) {
    const buf = await blob.slice(s, e).arrayBuffer();
    const u8 = new Uint8Array(buf);
    parts.push(u8);
    total += u8.length;
  }
  const joined = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { joined.set(p, off); off += p.length; }

  const h = await hashHex(joined);
  if (full) return h;
  // 표본 기반임을 키에 남긴다. 전략이 바뀌면 키가 달라져야 한다.
  const i = h.indexOf(':');
  return h.slice(0, i + 1) + 'p:' + size + ':' + h.slice(i + 1);
}
