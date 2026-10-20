/* ============================================================
   MedReader — 스캔본·글자 깨짐 판정 (spec 17-5-1 2 · 19-1-3 §3-2 — 8l)

   **순수 모듈이다.** pdf.js 도 저장소도 모른다. 쪽마다 센 **숫자**(글자 수·깨진 글자 수·이미지 연산 수·
   텍스트 연산 수)를 받아 판정을 낸다. 표본 쪽을 읽고(`getTextContent`·`getOperatorList`) 저장하는 일은
   서비스(`ui/library.js` — `attach` 다음)가 한다.

   ── 판정 (17-5-1 2 · 19-1-3 §3-2) ─────────────────────────
     표본 = 문서의 10–90% 구간을 12 등분한 쪽(12쪽 이하 문서는 전부)
     1. 글자 0 표본이 75% 이상 → 그중 최대 2쪽만 이미지 연산을 센다
          확인한 쪽 중 이미지 ≥ 1 이 하나라도 → 'scan'   (스캔본)
          전부 0                              → 'notext' (빈 쪽뿐·글자를 선으로 그린 PDF·글꼴 매핑 없는 PDF)
     2. 표본 합 글자 ≥ 500 이고 FFFD·PUA·제어 문자가 5% 이상 → 'garbled'
     3. 그 밖 → 'text'
   글자 0 판정이 먼저다(스캔본이면 깨진 글자를 보지 않는다). 띄어진 글자 비율은 쓰지 않는다(19-1-3 §3-1).

   ── `textOps` (8l carryover — Harry Potter 2 꼴) ─────────────
   "그리기 명령(showText)은 있는데 추출 글자 0"인 PDF 는 이미지가 없어 'notext' 다. 앱 안내는 스캔본과 같다
   (새 문구 없음). 다만 확인한 쪽의 **텍스트 연산 수**를 함께 남겨, 운영자 가이드가 `--skip-text` 가 아니라
   `--force-ocr` 를 안내할 근거로 쓴다(`documents.scan.textOps`).
   ============================================================ */

import { SCAN } from '../config.js';

/** 안내 갈래 — 스캔본·글자 없음은 같은 안내, 깨짐은 따로. */
export const VERDICTS = Object.freeze(['text', 'scan', 'notext', 'garbled']);

/** `[P1 경합]` 판정 저장이 맡은 `documents` 필드(7c `LANG_FIELDS` 와 같은 꼴). */
export const SCAN_FIELDS = Object.freeze(['scan']);

/**
 * 표본 쪽 번호. `pageCount ≤ PROBE` 면 1..N 전부, 아니면 [FROM·N, TO·N] 구간을 PROBE 등분한 칸의 가운데 쪽
 * (반올림·1..N 으로 자름·중복 제거·오름차순). O1 측정(조사 `diag-one.mjs`)과 같은 식이다.
 * @param {number} pageCount
 * @returns {number[]}
 */
export function probePages(pageCount) {
  const n = Math.floor(Number(pageCount) || 0);
  if (n <= 0) return [];
  if (n <= SCAN.PROBE) return Array.from({ length: n }, (_, i) => i + 1);
  const a = SCAN.FROM * n;
  const b = SCAN.TO * n;
  const seen = new Set();
  for (let k = 0; k < SCAN.PROBE; k++) {
    const p = Math.round(a + (b - a) * (k + 0.5) / SCAN.PROBE);
    seen.add(Math.min(n, Math.max(1, p)));
  }
  return [...seen].sort((x, y) => x - y);
}

/** 공백류(`\s`) — 글자 수에도 깨진 글자 수에도 넣지 않는다. */
const RE_SPACE = /\s/;

/**
 * 문자열 하나의 글자 수와 깨진 글자 수. **코드 포인트** 단위(서로게이트 쌍은 한 글자).
 *   chars = `\s` 가 아닌 글자 수(17-5-1 의 "공백 제외 글자 수")
 *   bad   = U+FFFD + PUA(U+E000–F8FF · U+F0000–10FFFD) + 제어(U+0000–001F · U+007F–009F 중 `\s` 가 아닌 것)
 * @param {string} str
 * @returns {{chars:number, bad:number}}
 */
export function garbleCount(str) {
  let chars = 0;
  let bad = 0;
  if (typeof str !== 'string' || !str) return { chars, bad };
  for (const ch of str) {
    if (RE_SPACE.test(ch)) continue;
    chars++;
    const cp = ch.codePointAt(0);
    if (cp === 0xFFFD ||
        (cp >= 0xE000 && cp <= 0xF8FF) || (cp >= 0xF0000 && cp <= 0x10FFFD) ||
        cp <= 0x1F || (cp >= 0x7F && cp <= 0x9F)) bad++;
  }
  return { chars, bad };
}

/**
 * 한 쪽의 텍스트 아이템(`getTextContent().items`)을 센다 — 아이템의 `str` 만 본다(숫자만 돌려준다).
 * @param {Array<{str?:string}>} items
 * @returns {{chars:number, bad:number}}
 */
export function countItems(items) {
  let chars = 0;
  let bad = 0;
  for (const it of items || []) {
    if (!it || typeof it.str !== 'string') continue;
    const g = garbleCount(it.str);
    chars += g.chars;
    bad += g.bad;
  }
  return { chars, bad };
}

/** 표본 중 글자 0 이 75% 이상인가 — 이미지 확인으로 갈지. 표본이 없으면 아니다. */
export function textlessEnough(probed, textless) {
  const p = Number(probed) || 0;
  if (p <= 0) return false;
  return (Number(textless) || 0) * SCAN.MIN_TEXTLESS_DEN >= p * SCAN.MIN_TEXTLESS_NUM;
}

function isTextless(s) { return (Number(s && s.chars) || 0) <= SCAN.EMPTY_CHARS; }

/**
 * 이미지 연산을 셀 쪽 — 글자 0 판정이 났을 때만, 글자 0 표본 중 앞의 IMG_CONFIRM 쪽. 아니면 빈 배열.
 * @param {Array<{pageNo:number, chars:number}>} samples
 * @returns {number[]}
 */
export function imageCheckPages(samples) {
  const list = Array.isArray(samples) ? samples : [];
  const empty = list.filter(isTextless);
  if (!textlessEnough(list.length, empty.length)) return [];
  return empty.slice(0, SCAN.IMG_CONFIRM).map((s) => s.pageNo);
}

/**
 * 판정. `samples` 는 표본 쪽마다 `{pageNo, chars, bad, imgs?, textOps?}` — `imgs`·`textOps` 는 이미지 확인을 한 쪽만.
 * @param {Array<{pageNo:number, chars:number, bad?:number, imgs?:number, textOps?:number}>} samples
 * @returns {{verdict:string, probed:number, textless:number, img:number, chars:number, bad:number, textOps:(number|null)}}
 *   img = 확인한 쪽 중 이미지 연산이 있는 쪽 수 · chars·bad = 표본 합 · textOps = 확인한 쪽의 텍스트 연산 합(확인 안 했으면 null)
 */
export function scanVerdict(samples) {
  const list = Array.isArray(samples) ? samples : [];
  let chars = 0;
  let bad = 0;
  let textless = 0;
  for (const s of list) {
    chars += Math.max(0, Number(s && s.chars) || 0);
    bad += Math.max(0, Number(s && s.bad) || 0);
    if (isTextless(s)) textless++;
  }
  const out = { verdict: 'text', probed: list.length, textless: textless, img: 0, chars: chars, bad: bad, textOps: null };
  if (textlessEnough(list.length, textless)) {
    const checked = list.filter((s) => isTextless(s) && typeof s.imgs === 'number' && Number.isFinite(s.imgs));
    let ops = 0;
    for (const s of checked) {
      if (Number(s.imgs) >= 1) out.img++;
      ops += Math.max(0, Number(s.textOps) || 0);
    }
    out.textOps = checked.length ? ops : null;
    out.verdict = out.img > 0 ? 'scan' : 'notext';
    return out;
  }
  if (chars >= SCAN.GARBLE_MIN_CHARS && bad * SCAN.GARBLE_DEN >= chars * SCAN.GARBLE_NUM) out.verdict = 'garbled';
  return out;
}

/**
 * `documents.scan` 에 넣을 레코드. 같은 갈래로 이미 닫은 띠(`noticed`)는 지킨다 — 판이 올라 다시 판정해도
 * 갈래가 같으면 같은 안내를 다시 띄우지 않는다.
 * @param {Object} res  `scanVerdict` 결과
 * @param {Object|null} prev  지금 저장된 `documents.scan`(없으면 null)
 * @param {number} [now]
 */
export function scanRecord(res, prev, now) {
  const r = res || {};
  const rec = {
    v: SCAN.VERSION,
    verdict: VERDICTS.indexOf(r.verdict) >= 0 ? r.verdict : 'text',
    probed: Number(r.probed) || 0,
    textless: Number(r.textless) || 0,
    img: Number(r.img) || 0,
    chars: Number(r.chars) || 0,
    bad: Number(r.bad) || 0,
    at: Number.isFinite(now) ? now : Date.now()
  };
  if (Number.isFinite(r.textOps)) rec.textOps = r.textOps;
  if (prev && prev.noticed === true && noticeKind(prev.verdict) && noticeKind(prev.verdict) === noticeKind(rec.verdict)) rec.noticed = true;
  return rec;
}

/** 이 문서를 (다시) 판정해야 하는가 — `scan` 이 없거나 옛 판. */
export function needsScan(doc) {
  if (!doc) return false;
  const s = doc.scan;
  return !s || typeof s !== 'object' || !(Number(s.v) >= SCAN.VERSION);
}

/** 안내 갈래 — `'scan'`(스캔본·글자 없음) · `'garbled'` · null(안내 없음). */
export function noticeKind(verdict) {
  if (verdict === 'scan' || verdict === 'notext') return 'scan';
  if (verdict === 'garbled') return 'garbled';
  return null;
}

/** 갈래별 i18n 키(17-5-1 3 · 19-1-3 §3-3). 키를 여기 한 곳에 둔다. */
export const NOTICE_KEYS = Object.freeze({
  scan: Object.freeze({ badge: 'library.card.scan', band: 'reader.scan.notice', search: 'reader.scan.noSearch' }),
  garbled: Object.freeze({ badge: 'library.card.garbled', band: 'reader.scan.garbled', search: 'reader.scan.garbledSearch' })
});

/** 문서 레코드 → 안내 갈래. */
export function docNoticeKind(doc) {
  return noticeKind(doc && doc.scan && doc.scan.verdict);
}

/** 서재 카드 배지 키(없으면 null). */
export function badgeKey(doc) {
  const k = docNoticeKind(doc);
  return k ? NOTICE_KEYS[k].badge : null;
}

/** 리더 상단 띠 키 — 안내 갈래가 있고 아직 닫지 않았을 때만(문서당 한 번). */
export function bandKey(doc) {
  const k = docNoticeKind(doc);
  if (!k || doc.scan.noticed === true) return null;
  return NOTICE_KEYS[k].band;
}

/**
 * ▶ 를 막을지(17-5-1 3 — 재생 시작 지점에서만). 스캔본·글자 없음 문서에서 지금 쪽의 큐가 비었고 낭독 중이 아니면
 * 넘기지 않고 `reader.scan.noRead` 를 보인다. 깨짐(`garbled`)은 막지 않는다(L-D10). 텍스트 문서는 그대로.
 * @param {string|null} verdict
 * @param {{state:string, empty:boolean}} o  speaker 상태, 지금 쪽 큐가 비었는가
 */
export function blocksPlay(verdict, o) {
  if (noticeKind(verdict) !== 'scan') return false;
  const st = o && o.state;
  if (st === 'speaking' || st === 'waiting-page') return false;
  return !!(o && o.empty);
}

/**
 * 이 책 검색 화면의 안내 줄(17-5-1 3 · 19-1-3 §3-3).
 *   스캔본·글자 없음: 결과 0 일 때 "찾지 못했습니다" **대신** `reader.scan.noSearch` → `{key, replace:true}`
 *   깨짐: 결과가 있든 없든 **위에** 한 줄 `reader.scan.garbledSearch` → `{key, replace:false}`
 *   그 밖·아직 결과 없음: null
 * @param {string|null} verdict
 * @param {{final:boolean, hits:number}} o
 */
export function searchNotice(verdict, o) {
  const k = noticeKind(verdict);
  if (!k || !o) return null;
  if (k === 'garbled') return { key: NOTICE_KEYS.garbled.search, replace: false };
  if (o.final && !(Number(o.hits) > 0)) return { key: NOTICE_KEYS.scan.search, replace: true };
  return null;
}

/* ── 연산 표 — pdf.js `OPS` 를 받아 번호 집합을 만든다(서비스가 `fnArray` 를 셀 때) ── */

const IMG_OP_NAMES = Object.freeze([
  'paintImageXObject', 'paintInlineImageXObject', 'paintImageMaskXObject', 'paintImageXObjectRepeat',
  'paintInlineImageXObjectGroup', 'paintImageMaskXObjectGroup', 'paintSolidColorImageMask'
]);
const TEXT_OP_NAMES = Object.freeze(['showText', 'showSpacedText', 'nextLineShowText', 'nextLineSetSpacingShowText']);

function opSet(OPS, names) {
  const s = new Set();
  for (const n of names) if (OPS && Number.isInteger(OPS[n])) s.add(OPS[n]);
  return s;
}

/** 이미지 그리기 연산 번호(O1 측정과 같은 7종). */
export function imageOpIds(OPS) { return opSet(OPS, IMG_OP_NAMES); }
/** 글자 그리기 연산 번호. */
export function textOpIds(OPS) { return opSet(OPS, TEXT_OP_NAMES); }

/** `fnArray` 에서 집합에 든 연산 수. */
export function countOps(fnArray, ids) {
  let n = 0;
  if (!fnArray || !ids) return 0;
  for (let i = 0; i < fnArray.length; i++) if (ids.has(fnArray[i])) n++;
  return n;
}
