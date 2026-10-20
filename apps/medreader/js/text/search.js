/* ============================================================
   MedReader — 검색 글자·접기·일치 규칙 (순수 모듈 · spec 17-8-3 · 17-8-4 · 17-8-12)

   엔진(8g-2 `search/engine.js`)·목차(8g-3)·화면(8g-4)이 쓸 **순수 함수 전부**를 여기 먼저 둔다(8g-1).
   브라우저 전역(DOM·저장소·네트워크)을 모른다 — 16-A grep(tests/layout.test.mjs D2 ·
   tests/search-text-8g.test.mjs S3)이 지킨다. import 는 text/* 와 config 뿐(3-2).

   ── 검색 레코드 (`searchText` 스토어, 17-8-12 §1) ─────────
     { docId, pageNo, sk, algoVersion, text, table, heads:[{i, o, r}] }
   · `text`  = **화면 글자** — `describePage → flowParasOf → joinPieces`(리플로우·낭독·강조와 같은 함수, U6),
               문단 사이 '\n'. 그래서 결과 쪽에서 다시 찾기가 1:1 이다. `fromStored` 문단 text 가 아니다
               (문단 안 빈 줄에서 둘이 갈린다 — Harrison 17문단).
   · 넣는 것: 본문·heading·rowhead(이름표)·인용(cite — 화면에 있다, G2). 빼는 것: `ref`(쪽 번호 칸, G4)·
     `colhead`·접힌 역할(머리말·꼬리말·쪽 번호·회전) — 흐름 문단에 없으므로 구조로 빠진다.
   · `table` = 4-8 표 영역 줄 글자(줄마다 공백 하나로 접고 '\n'). 리플로우에는 크롭 이미지뿐이다.
   · `heads` = kind `heading` 문단만(rowhead 0 — 4-13-7). `i` 흐름 문단 순번, `o` text 안 오프셋,
               `r` 첫 줄 글자 크기 ÷ 쪽 본문 중앙값(소수 둘째).
   · `sk`    = `SEARCH.VERSION|DERIVED_HASH`(U4) — 하이픈 집합이 바뀌면 화면 글자도 바뀌므로 지문이 경첩에 든다.

   ── 접기·일치 (17-8-4) ─────────────────────────────────
   접기는 **길이를 보존하는 1:1 글자 치환**이다 — 원문 오프셋 = 접은 글자 오프셋. 원문을 저장하고
   접기는 읽을 때 한다(접기 규칙을 고쳐도 저장본을 다시 만들 필요가 없다).
   정규식을 검색어로 만들지 않는다 — `indexOf` + 낱말 경계 검사(이스케이프 결함 면이 없다).
   ============================================================ */

import { SEARCH, KEEP_HYPHEN_PREFIXES } from '../config.js';
import { derivedHash } from './store.js';
import { describePage, flowParasOf, joinPieces, localRange } from './screen.js';

/** 검색어 오류 코드 — UI 문자열이 아니다(3-2). */
export const SEARCH_ERR = Object.freeze({ SHORT: 'ERR_SEARCH_SHORT', LONG: 'ERR_SEARCH_LONG' });

/** 경첩 문자열(U4). 판이나 하이픈 지문 중 하나라도 바뀌면 다른 값이 된다. */
export function searchKey(version = SEARCH.VERSION, derived = derivedHash()) {
  return String(version) + '|' + String(derived);
}

/** 지금 앱의 경첩 — 추출·백필이 쓰는 값. */
export const SEARCH_KEY = searchKey();

/* ════════════════════════════════════════════════════════
   1. 검색 레코드
   ════════════════════════════════════════════════════════ */

/**
 * `fromStored` 로 되살린 쪽 → 검색 레코드(`docId` 는 부르는 쪽이 붙인다 — `fromStored` 는 docId 를 모른다).
 *
 * @param {Object} F    `fromStored(rec)` 결과
 * @param {Object} [desc] `describePage(F)` — 이미 있으면 넘긴다(없으면 여기서 만든다)
 * @param {{sk?:string}} [opts]
 * @returns {{pageNo:number, sk:string, algoVersion:number, text:string, table:string, heads:Array<{i:number,o:number,r:number}>}}
 */
export function searchRecordOf(F, desc, opts) {
  const L = F || {};
  const d = desc || describePage(L);
  const paras = flowParasOf(d);
  const lines = Array.isArray(L.lines) ? L.lines : [];
  const byId = new Map();
  for (let i = 0; i < lines.length; i++) byId.set(lines[i].id, lines[i]);
  const med = Number(L.stats && L.stats.medianFontSize) || 0;

  let text = '';
  const heads = [];
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    const j = joinPieces(p.lines);
    if (i) text += '\n';
    const o = text.length;
    text += j.text;
    if (p.kind === 'heading') {
      const l0 = byId.get(p.lines[0] && p.lines[0].id);
      const fs = l0 ? Number(l0.fontSize) : 0;
      const r = fs > 0 && med > 0 ? Math.round((fs / med) * 100) / 100 : 0;
      heads.push({ i: i, o: o, r: r });
    }
  }

  const tl = [];
  const regions = Array.isArray(L.regions) ? L.regions : [];
  for (let g = 0; g < regions.length; g++) {
    const ids = Array.isArray(regions[g].lineIds) ? regions[g].lineIds : [];
    for (let k = 0; k < ids.length; k++) {
      const l = byId.get(ids[k]);
      if (l) tl.push(String(l.text || '').replace(/\s+/g, ' ').trim());
    }
  }

  return {
    pageNo: L.pageNo,
    sk: (opts && typeof opts.sk === 'string') ? opts.sk : SEARCH_KEY,
    algoVersion: L.algoVersion,
    text: text,
    table: tl.join('\n'),
    heads: heads
  };
}

/* ════════════════════════════════════════════════════════
   2. 접기 — 길이 보존 1:1
   ════════════════════════════════════════════════════════ */

// 하이픈·대시: U+002D · U+00AD(무른 하이픈) · U+2010–2015 · U+2212(빼기) → 공백
const DASH_RE = /[-­‐-―−]/;
const SQUOTE_RE = /[‘’‛′]/;
const DQUOTE_RE = /[“”‟″]/;
// '-'(2D)·A–Z·ASCII 밖만 함수로 — 나머지 ASCII 는 그대로다(빠른 길)
const FOLD_RE = /[^\x00-\x2C\x2E-\x40\x5B-\x7F]/g;
const FOLD_MEMO = new Map();
const FOLD_MEMO_MAX = 4096;

function fold1(ch) {
  const hit = FOLD_MEMO.get(ch);
  if (hit !== undefined) return hit;
  let c = ch.toLowerCase();
  // ★ 길이 가드 — `İ`.toLowerCase() 는 두 글자다. 길이가 바뀌면 그 글자만 원래대로(오프셋 보존).
  if (c.length !== 1) c = ch;
  const d = c.normalize('NFD');
  if (d.length > 1 && /^[a-z]$/.test(d[0]) && /^\p{M}+$/u.test(d.slice(1))) c = d[0];   // é → e
  if (DASH_RE.test(c)) c = ' ';
  else if (SQUOTE_RE.test(c)) c = "'";
  else if (DQUOTE_RE.test(c)) c = '"';
  if (FOLD_MEMO.size < FOLD_MEMO_MAX) FOLD_MEMO.set(ch, c);
  return c;
}

/**
 * 소문자·하이픈 → 공백·악센트 라틴 → 기본 글자·굽은 따옴표 → 곧은 따옴표. **길이를 바꾸지 않는다.**
 * 그리스 문자(`β`)는 그대로 둔다 — 검색어 쪽 변형이 `beta` 와 잇는다.
 * @param {string} s
 * @returns {string} `s.length` 와 같은 길이
 */
export function foldText(s) {
  return String(s == null ? '' : s).replace(FOLD_RE, fold1);
}

/** 낱말 글자인가(`[\p{L}\p{N}]`). 경계 검사에 쓴다. 범위 밖(undefined)은 아니다. */
export function isWordChar(c) {
  if (c === undefined || c === '') return false;
  const k = c.charCodeAt(0);
  if ((k >= 97 && k <= 122) || (k >= 48 && k <= 57) || (k >= 65 && k <= 90)) return true;
  if (k < 128) return false;
  return /[\p{L}\p{N}]/u.test(c);
}

/* ════════════════════════════════════════════════════════
   3. 검색어 → 변형 · 일치
   ════════════════════════════════════════════════════════ */

const GREEK = Object.freeze({ alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', kappa: 'κ' });
const GREEK_BACK = Object.freeze(Object.fromEntries(Object.entries(GREEK).map(([a, b]) => [b, a])));
const MAX_VARIANTS = 8;

/** 합성어 변형에 쓰는 접두(U7) — 줄바꿈 하이픈을 살리는 접두 중 `COMPOUND_MIN_PREFIX` 자 이상. */
export function compoundPrefixes(set = KEEP_HYPHEN_PREFIXES, min = SEARCH.COMPOUND_MIN_PREFIX) {
  return [...(set || [])].map(String).filter((x) => x.length >= min);
}
const COMPOUND = Object.freeze(compoundPrefixes());

/**
 * 검색어 → `{q, cs, whole, variants}` 또는 `{error, q}`.
 *   · 2~5자 전부 대문자(숫자 섞임 가능)면 **대소문자 구분 + 낱말 전체**(`MI` 가 mild·mi 를 덮지 않게)
 *   · 접은 길이 3자 이하면 낱말 전체, 4자 이상이면 **낱말 시작 접두**(뒤는 열림)
 *   · 그리스 문자 ↔ 이름 변형(`beta` ↔ `β`) · 합성어 변형(U7: `preeclampsia` ↔ `pre eclampsia`)
 * `cs` 면 원문에서, 아니면 `foldText(원문)` 에서 찾는다(`findIn`).
 * @param {string} q
 * @param {{compound?:boolean}} [opts] compound:false = 합성어 변형 없이(측정·비교용)
 */
export function parseQuery(q, opts) {
  const compound = !(opts && opts.compound === false);
  const s = String(q == null ? '' : q).replace(/\s+/g, ' ').trim();
  if (s.length < SEARCH.MIN_CHARS) return { error: SEARCH_ERR.SHORT, q: s };
  if (s.length > SEARCH.MAX_CHARS) return { error: SEARCH_ERR.LONG, q: s };
  if (/^[A-Z0-9]{2,5}$/.test(s) && /[A-Z]/.test(s)) return { q: s, cs: true, whole: true, variants: [s] };

  const f = foldText(s).replace(/\s+/g, ' ').trim();
  // 하이픈만인 검색어("--")는 접으면 비어 버린다 — 빈 변형으로 indexOf 를 돌리지 않는다.
  if (f.length < SEARCH.MIN_CHARS) return { error: SEARCH_ERR.SHORT, q: s };
  const whole = f.length <= 3;
  let vs = [''];
  const toks = f.split(' ');
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k];
    const alts = [tok];
    if (GREEK[tok]) alts.push(GREEK[tok]);
    if (GREEK_BACK[tok]) alts.push(GREEK_BACK[tok]);
    const nx = [];
    for (const v of vs) for (const a of alts) nx.push(k ? v + ' ' + a : a);
    vs = nx.slice(0, MAX_VARIANTS);
  }
  if (compound && !whole) {
    const more = [];
    for (const v of vs) {
      for (const pf of COMPOUND) {
        if (v.startsWith(pf + ' ') && v.length > pf.length + 3 && v.indexOf(' ', pf.length + 1) < 0) more.push(pf + v.slice(pf.length + 1));
        else if (v.startsWith(pf) && v.length >= pf.length + 3 && v.indexOf(' ') < 0) more.push(pf + ' ' + v.slice(pf.length));
      }
    }
    vs = vs.concat(more);
  }
  return { q: s, cs: false, whole: whole, variants: [...new Set(vs)] };
}

/**
 * `hay` 안의 적중 시작 오프셋(오름차순·중복 없음). `limit` 에 닿으면 앞에서 자른다.
 * @param {string} hay `pq.cs` 면 원문, 아니면 `foldText(원문)`
 * @param {Object} pq  `parseQuery` 결과(오류면 빈 배열)
 * @param {number} [limit]
 * @returns {number[]}
 */
export function findIn(hay, pq, limit = Infinity) {
  const out = [];
  if (!pq || pq.error || !Array.isArray(pq.variants)) return out;
  const h = String(hay == null ? '' : hay);
  for (const v of pq.variants) {
    const n = v.length;
    if (!n) continue;
    let i = h.indexOf(v);
    while (i >= 0) {
      if ((i === 0 || !isWordChar(h[i - 1])) && (!pq.whole || !isWordChar(h[i + n]))) out.push(i);
      i = h.indexOf(v, i + 1);
    }
  }
  if (pq.variants.length > 1) {
    out.sort((a, b) => a - b);
    for (let k = out.length - 1; k > 0; k--) if (out[k] === out[k - 1]) out.splice(k, 1);
  }
  return out.length > limit ? out.slice(0, Math.max(0, limit)) : out;
}

/** `at` 에서 맞은 변형의 길이(변형마다 다르다 — `beta` 4 · `β` 1). 없으면 0. */
export function hitLength(hay, pq, at) {
  if (!pq || pq.error || !Array.isArray(pq.variants)) return 0;
  const h = String(hay == null ? '' : hay);
  let best = 0;
  for (const v of pq.variants) if (v.length > best && h.startsWith(v, at)) best = v.length;
  return best;
}

/* ════════════════════════════════════════════════════════
   4. 제목 묶음 (17-8-5 · U8)
   ════════════════════════════════════════════════════════ */

/** 제목 비교 키 — 접고, 낱말 글자 밖은 공백 하나로. */
export function headKey(s) {
  return foldText(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** 레코드의 heading 글자들 — `[{p, i, o, r, t}]`(쪽 안 순서). */
export function headsOf(rec) {
  const out = [];
  if (!rec) return out;
  const text = String(rec.text || '');
  const hs = Array.isArray(rec.heads) ? rec.heads : [];
  for (let k = 0; k < hs.length; k++) {
    const h = hs[k];
    const e = text.indexOf('\n', h.o);
    out.push({ p: rec.pageNo, i: h.i, o: h.o, r: h.r, t: text.slice(h.o, e < 0 ? text.length : e) });
  }
  return out;
}

/** 책 전체 heading 빈도표(키 → 수). 일반 소제목("Treatment" 등)을 가린다. */
export function headFreq(recs) {
  const m = new Map();
  for (const rec of recs || []) for (const h of headsOf(rec)) {
    const k = headKey(h.t);
    if (k) m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/**
 * 적중 하나의 묶음 — `'head' | 'body' | 'table'`.
 *   · `opts.table` = 표 글자(`rec.table`)에서 난 적중 → 'table'
 *   · heading 문단 안의 적중 → 'head', 단 그 글자가 책에서 `REPEAT_HEADING` 번 이상이면 'body'(U8)
 *   · 나머지(본문·rowhead·인용) → 'body'
 * @param {Object} rec 검색 레코드
 * @param {number} at  `rec.text` 안 오프셋
 * @param {{table?:boolean, freq?:Map<string,number>}} [opts]
 */
export function classifyHit(rec, at, opts) {
  const o = opts || {};
  if (o.table) return 'table';
  const text = String((rec && rec.text) || '');
  const hs = (rec && Array.isArray(rec.heads)) ? rec.heads : [];
  for (let k = 0; k < hs.length; k++) {
    const h = hs[k];
    if (at < h.o) continue;
    const e = text.indexOf('\n', h.o);
    const end = e < 0 ? text.length : e;
    if (at >= end) continue;
    if (o.freq && (o.freq.get(headKey(text.slice(h.o, end))) || 0) >= SEARCH.REPEAT_HEADING) return 'body';
    return 'head';
  }
  return 'body';
}

/* ════════════════════════════════════════════════════════
   5. 결과 조각 · 강조 구간
   ════════════════════════════════════════════════════════ */

/**
 * 적중 앞뒤 `n` 자(낱말 경계로 넓힘, 그 문단 안에서만). 화면은 세 조각을 `textContent` 로 넣는다(13절).
 * @returns {{before:string, hit:string, after:string, cutStart:boolean, cutEnd:boolean}}
 */
export function snippetAt(text, at, len, n = SEARCH.SNIPPET) {
  const s = String(text == null ? '' : text);
  const A = Math.min(Math.max(0, Math.floor(Number(at)) || 0), s.length);
  const B = Math.min(s.length, A + Math.max(0, Math.floor(Number(len)) || 0));
  const lo = A > 0 ? s.lastIndexOf('\n', A - 1) + 1 : 0;
  let hi = s.indexOf('\n', B);
  if (hi < 0) hi = s.length;
  let a = Math.max(lo, A - n);
  let b = Math.min(hi, B + n);
  while (a > lo && isWordChar(s[a - 1])) a--;
  while (b < hi && isWordChar(s[b])) b++;
  return { before: s.slice(a, A), hit: s.slice(A, B), after: s.slice(B, b), cutStart: a > 0, cutEnd: b < s.length };
}

/**
 * 문단 결합 글자(`joinPieces` 결과)의 적중들 → 적중마다 **줄 안 오프셋 구간들**(10a `localRange`).
 * 줄바꿈 하이픈으로 갈린 낱말은 구간 둘이 된다.
 * @param {{text:string, spans:Array<{id,start,end}>}} joined
 * @param {Array<{at:number, len:number}>} hits
 * @returns {Array<Array<{id:string, start:number, end:number}>>}
 */
export function rangesFor(joined, hits) {
  const spans = (joined && Array.isArray(joined.spans)) ? joined.spans : [];
  const out = [];
  for (const h of hits || []) {
    const a = Number(h.at), b = Number(h.at) + Number(h.len);
    const rs = [];
    for (const sp of spans) if (sp.start < b && sp.end > a) rs.push(localRange(sp, a, b));
    out.push(rs);
  }
  return out;
}

/* ════════════════════════════════════════════════════════
   6. 개요가 없는 책의 heading 폴백 목차 (17-8-6 · U11 — 변형 C)
   ════════════════════════════════════════════════════════ */

const DIGITS_ONLY = /^[\d\s.,–-]+$/;

/* `[8g-3b — 17-8-12 §11-3]` 폴백 후보 규칙 R1–R8. 정규식은 기준 정의 `dev/measure-toc-8g3b.mjs` 와 **글자 그대로**
   (S36 이 94권에서 항목 집합 차 0 을 본다 — 하나를 고치면 저쪽도 함께). */
const ELLIPSIS_END = /(\.\.|…)\s*[.!?]?["”’']?$/u;
const SENT_END = /(\p{L}+)([.!?])["”’']?$/u;
const MULTI = /\p{Ll}{2,}[.!?]["”’']?\s+["“‘]?\p{Lu}/u;
const DIALOG_START = /^(["“”„«»‘’'‹›]|[—–]\s)/u;
const DIALOG_END = /["“”»’'‹›]$/u;
const OCR_SYMBOL = /[{}®£¢§©_~^=<>\\@¤°]/;
/* `[8g-4b — 8g-3b Review 관찰 · carryover 16]` R2 약어 예외('etc.')는 **대소문자가 있는 글자로만 된 낱말**에만 —
   한글·아랍 글자는 음절·글자 하나가 낱말 길이를 짧게 만들어 "…이야." 같은 문장 끝이 약어로 통과했다. */
const CASED_WORD = /^[\p{Lu}\p{Ll}]+$/u;
const countOf = (s, re) => (String(s).match(re) || []).length;
/* 셈용 — 기준 정의의 count 인자와 같은 글자(부를 때마다 정규식 객체를 새로 만들지 않게 올려 둔다). g 깃발이지만
   String.prototype.match 는 lastIndex 를 0 으로 되돌리고 시작하므로 함께 써도 상태가 남지 않는다. */
const LETTER_G = /\p{L}/gu;
const CASED_G = /[\p{Lu}\p{Ll}]/gu;
const UPPER_G = /\p{Lu}/gu;
const SENT_LAST = '.!?"”’\'';     // SENT_END 가 맞으려면 끝 글자가 이 중 하나여야 한다
const HAS_STOP = /[.!?]/;          // MULTI 가 맞으려면 이 부호가 하나는 있어야 한다

/**
 * 이 heading 을 폴백 목차 후보에서 빼는 까닭 — 코드 문자열 또는 null(남긴다). UI 문자열이 아니다(3-2).
 *   'small'    R1 본문보다 뚜렷이 작은 글자(`r < TOC_MIN_R`)
 *   'noise'    R6 숫자만이 아닌데 문자 3개 미만이거나 공백 뺀 글자 중 문자 비율 < 0.5
 *   'sentence' R2 문장 끝(말줄임 뒤 부호·닫는 괄호 뒤 부호·대소문자 있는 글자 3자 이하 낱말 + 마침표는 아님)
 *   'multi'    R3 한 문단에 두 문장
 *   'symbol'   R7 OCR 잡음 기호(세로 막대는 아님 — OCR 이 대문자 I 를 그렇게 읽는다)
 *   'long'     R5 `TOC_MAX_LEN` 자 초과
 *   'dialog'   R4 따옴표로 시작·끝, 줄표 + 공백으로 시작(붙임표 `-ing` 는 아님)
 *   'weak'     R8 본문 크기(`r < TOC_WEAK_R`)인데 대소문자 있는 글이 '대문자 4자 이상·90% 이상'이 아니다
 * 검사 순서는 집계용일 뿐 남기느냐 빼느냐에는 영향이 없다. R9·R10 은 책 전체를 봐야 해서 `headingToc` 안에 있다.
 * @param {{t:string, r:number}} h
 * @returns {null|'small'|'noise'|'sentence'|'multi'|'symbol'|'long'|'dialog'|'weak'}
 */
export function tocDropReason(h) {
  const raw = String(h.t);
  const t = raw.trim();
  if (h.r < SEARCH.TOC_MIN_R) return 'small';
  if (!DIGITS_ONLY.test(raw)) {
    const L = countOf(raw, LETTER_G);
    if (L < 3 || L / Math.max(1, raw.replace(/\s/g, '').length) < 0.5) return 'noise';
  }
  // 빠른 길(결과 같음): SENT_END 는 끝 글자가 부호·닫는 따옴표일 때만, MULTI 는 [.!?] 가 있을 때만 맞을 수 있다.
  if (SENT_LAST.indexOf(t.charAt(t.length - 1)) >= 0 && !ELLIPSIS_END.test(t)) {
    const m = SENT_END.exec(t);
    if (m && !(m[2] === '.' && m[1].length <= 3 && CASED_WORD.test(m[1]))) return 'sentence';
  }
  if (HAS_STOP.test(t) && MULTI.test(t)) return 'multi';
  if (OCR_SYMBOL.test(raw)) return 'symbol';
  if (t.length > SEARCH.TOC_MAX_LEN) return 'long';
  if (DIALOG_START.test(t) || DIALOG_END.test(t)) return 'dialog';
  if (h.r < SEARCH.TOC_WEAK_R) {
    const cased = countOf(raw, CASED_G);
    if (cased >= 1 && !DIGITS_ONLY.test(raw) &&
        !(cased >= 4 && countOf(raw, UPPER_G) / cased >= 0.9)) return 'weak';
  }
  return null;
}

/**
 * (a) 같은 글자가 반복 문턱 이상인 제목과 `tocDropReason` 에 걸리는 제목을 후보에서 빼고(뺀 것은 상한을
 * 차지하지 않는다) (b) 글자 크기 비 `r` 의 상위 층부터 내려가며 항목이 `TOC_FALLBACK_MAX` 를 넘기 직전까지만
 * 남긴 평평한 목록. 숫자만인 항목(장 번호)은 **같은 쪽 바로 다음 heading** 을 제목으로 붙이고(U11), 붙일 것이
 * 없으면 뺀다(R9). heads 에 rowhead 는 없다(구조로 0).
 * 반복 문턱(R10) = `min(REPEAT_HEADING, max(TOC_REPEAT_MIN, ⌈pages/2⌉))` — `opts.pages` 가 없으면 `REPEAT_HEADING`.
 * 층 고르기는 정렬 한 번 + 누적 수(층마다 후보 전체를 다시 거르지 않는다 — OCR 책은 층이 수백).
 * @param {Array} recs 검색 레코드(쪽 순서)
 * @param {{max?:number, pages?:number}} [opts]
 * @returns {Array<{t:string, p:number, r:number}>}
 */
export function headingToc(recs, opts) {
  const o = opts || {};
  const max = o.max || SEARCH.TOC_FALLBACK_MAX;
  const pages = Number(o.pages);
  const rep = Number.isFinite(pages) && pages > 0
    ? Math.min(SEARCH.REPEAT_HEADING, Math.max(SEARCH.TOC_REPEAT_MIN, Math.ceil(pages / 2)))
    : SEARCH.REPEAT_HEADING;
  const all = [];
  const sorted = (recs || []).slice().sort((a, b) => a.pageNo - b.pageNo);
  for (const rec of sorted) for (const h of headsOf(rec)) all.push(h);
  const keys = all.map((h) => headKey(h.t));
  const freq = new Map();
  for (const k of keys) if (k) freq.set(k, (freq.get(k) || 0) + 1);
  // 반복 문턱을 넘은 heading 을 r 별로 묶는다(쪽 순서 그대로).
  const byR = new Map();
  for (let n = 0; n < all.length; n++) {
    const k = keys[n];
    if (!k || !(freq.get(k) < rep)) continue;
    const g = byR.get(all[n].r);
    if (g) g.push(n); else byR.set(all[n].r, [n]);
  }
  // 층 고르기: r 을 내림차순으로 한 번 정렬하고 위 층부터 R1–R8 을 판정하며 남은 수를 누적한다 — 누적이 max 를
  // 넘는 층에서 멈춘다(그 아래 층은 판정하지 않는다). 뺀 heading 은 누적에 들지 않는다(§11-3).
  const keep = new Uint8Array(all.length);
  const tiers = [...byR.keys()].sort((a, b) => b - a);
  let floor = null;
  let kept = 0;
  for (const r of tiers) {
    const g = byR.get(r);
    let c = 0;
    for (const n of g) if (!tocDropReason(all[n])) { keep[n] = 1; c++; }
    if (kept + c > max) break;
    kept += c;
    floor = r;
  }
  const out = [];
  if (floor === null) return out;
  for (let n = 0; n < all.length; n++) {
    if (!keep[n]) continue;
    const h = all[n];
    if (!(h.r >= floor)) continue;
    let t = h.t;
    if (DIGITS_ONLY.test(t)) {
      const nx = all[n + 1];
      if (nx && nx.p === h.p) t = t + ' ' + nx.t;
      if (DIGITS_ONLY.test(t)) continue;                     // R9 붙일 것 없는 숫자만 항목(쪽 번호 줄 등)
    }
    out.push({ t: t, p: h.p, r: h.r });
  }
  return out;
}
