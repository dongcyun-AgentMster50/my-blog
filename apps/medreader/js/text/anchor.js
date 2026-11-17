/* ============================================================
   MedReader — 필기 앵커 (순수 모듈 · spec 17-16 3 — 20-1)

   ── 왜 인용인가 (20-D2) ─────────────────────────────────
   줄 id 는 `pageNo:읽기 순서 번호`라 판이 오르면(8q 다단 순서·8i 행 표) **같은 글의 id 가 바뀐다**. 그래서 앵커는
   줄 구간(빠른 길)에 더해 **인용**(W3C 웹 주석 TextQuoteSelector 와 같은 생각 — exact + 앞뒤 32자)과 **문단 해시**를 든다.
   쪽 번호는 PDF 쪽이라 재추출로 바뀌지 않는다 — 찾기는 그 쪽 안에서만 한다.

   ── 좌표계 ── 화면 글자(`screenIndex` — 흐름 문단마다 `joinPieces`, 문단 사이 '\n'). 인용은 **문단 결합 글자**
   (하이픈 결합 뒤)라 줄바꿈이 달라져도 같다. 돌려주는 `ranges` 는 줄 안 오프셋(10a `localRange` — 검색·낭독과 같은 꼴).

   ── 다시 찾기 `resolve` ──
     1. 판(`algo`) 같음 + 줄 구간의 글자 == exact          → 'exact'
     2. 같은 `textHash` 문단 안에서 exact                   → 'para'   (여럿이면 앞뒤 문맥이 가장 길게 맞는 것)
     3. 쪽 전체에서 exact                                   → 'page'   (같은 고르기)
     4. 공백·대소문자·하이픈을 접은 글자(`foldText`)로 2–3  → 'fuzzy'  (짧은 인용은 문맥이 맞아야 · 마지막에 문단 경계를 넘는
        자리도 — 판이 문단을 다르게 나눈 경우. 이때 `ranges` 는 두 문단 이상에 걸친다)
     5. 없음 → null(고아 — 레코드는 지우지 않는다)
   찾은 결과로 레코드를 고쳐 쓰는 판단은 서비스(`notes/annotations.js` — 20-D6)가 한다. 여기는 계산만.

   브라우저 전역(DOM·저장소·네트워크)을 모른다. 해시(비동기)는 부르는 쪽이 `paraHashes` 로 넘긴다.
   ============================================================ */

import { ANNO } from '../config.js';
import { foldText as foldChars, rangesFor } from './search.js';
import { flowParasOf, joinPieces, screenIndex } from './screen.js';

const WS = /\s/;

function int(v) { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : 0; }
function str(v) { return v == null ? '' : String(v); }

/**
 * 접은 글자 — 검색 접기(`text/search.js` `foldText`: 소문자·악센트·따옴표·하이픈/대시 → 공백, 길이 보존)를 지난 뒤
 * **공백을 모두 뺀다**(하이픈도 공백이 됐으므로 함께 빠진다). "cardio-vascular" · "cardiovascular" · "Cardio vascular" 가 같다.
 * @param {string} s
 * @returns {{text:string, map:number[]}} `map[i]` = 접은 글자 i 번째의 원래 오프셋
 */
export function foldText(s) {
  const f = foldChars(str(s));
  let out = '';
  const map = [];
  for (let i = 0; i < f.length; i++) {
    const c = f[i];
    if (WS.test(c)) continue;
    out += c;
    map.push(i);
  }
  return { text: out, map: map };
}

/** 설명(`describePage`) → 화면 글자와 문단 id(같은 순서). 검색이 쓰는 것과 **같은 함수**들을 지난다. */
export function indexOfDesc(desc) {
  const paras = flowParasOf(desc);
  return { idx: screenIndex(paras, joinPieces), paraIds: paras.map((p) => (p.id == null ? null : String(p.id))) };
}

/** 화면 오프셋 `at` 이 든 문단 번호. 문단 사이 '\n' 이면 다음 문단. 없으면 -1. */
export function partAt(idx, at) {
  const parts = (idx && idx.parts) || [];
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    if (at >= p.base && at < p.base + p.joined.text.length) return k;
    if (at < p.base) return k;
  }
  return -1;
}

/**
 * 선택(화면 오프셋 `from`–`to`) → 앵커. **한 문단 안**만 — 문단을 넘는 선택·`QUOTE_MAX` 를 넘는 선택은 부르는 쪽이 나눈다
 * (20-D5 — 넘는 몫은 여기서 잘린다). 앞뒤 공백은 뺀다.
 * @param {{text:string, parts:Array}} idx `screenIndex(…)`
 * @param {{pageNo?:number, algo?:number, paraIds?:Array, paraHashes?:Array}} [ctx] `paraIds`·`paraHashes` 는 `idx.parts` 와 같은 순서
 * @returns {Object|null}
 */
export function anchorOf(idx, from, to, ctx) {
  const c = ctx || {};
  let a = int(from);
  let b = int(to);
  if (b < a) { const x = a; a = b; b = x; }
  const k = partAt(idx, a);
  if (k < 0) return null;
  const p = idx.parts[k];
  const t = p.joined.text;
  let s = Math.min(t.length, Math.max(0, a - p.base));
  let e = Math.min(t.length, Math.max(0, b - p.base));
  while (s < e && WS.test(t[s])) s++;
  if (e - s > ANNO.QUOTE_MAX) e = s + ANNO.QUOTE_MAX;
  while (e > s && WS.test(t[e - 1])) e--;
  if (!(e > s)) return null;
  const rs = rangesFor(p.joined, [{ at: s, len: e - s }])[0] || [];
  if (!rs.length) return null;
  const n = ANNO.CONTEXT;
  const last = rs[rs.length - 1];
  return {
    pageNo: c.pageNo == null ? null : Number(c.pageNo),
    algo: c.algo == null ? null : Number(c.algo),
    lineIds: rs.map((r) => String(r.id)),
    start: { lineId: String(rs[0].id), off: rs[0].start },
    end: { lineId: String(last.id), off: last.end },
    paraId: Array.isArray(c.paraIds) && c.paraIds[k] != null ? String(c.paraIds[k]) : null,
    textHash: Array.isArray(c.paraHashes) && c.paraHashes[k] ? String(c.paraHashes[k]) : null,
    quote: { exact: t.slice(s, e), prefix: t.slice(Math.max(0, s - n), s), suffix: t.slice(e, e + n) }
  };
}

/* ── 문맥 점수 — 앞 글자의 꼬리가 prefix 의 꼬리와, 뒤 글자의 머리가 suffix 의 머리와 몇 자 맞는가 ── */

function commonTail(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}
function commonHead(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * 후보 [s, e) 의 문맥 점수. prefix 가 문단 처음까지 닿은 인용(32자 미만)은 후보도 문단 처음이면 +1(뒤도 같게).
 * `fold` 면 양쪽을 접은 글자로 비교한다.
 */
function contextScore(t, s, e, q, fold) {
  const n = ANNO.CONTEXT;
  const pre = str(q.prefix);
  const suf = str(q.suffix);
  let before = t.slice(Math.max(0, s - (fold ? n * 2 : n)), s);
  let after = t.slice(e, e + (fold ? n * 2 : n));
  let P = pre;
  let S = suf;
  if (fold) { before = foldText(before).text; after = foldText(after).text; P = foldText(pre).text; S = foldText(suf).text; }
  let sc = commonTail(before, P) + commonHead(after, S);
  if (pre.length < n && (fold ? foldText(t.slice(0, s)).text === P : t.slice(0, s) === pre)) sc += 1;
  if (suf.length < n && (fold ? foldText(t.slice(e)).text === S : t.slice(e) === suf)) sc += 1;
  return sc;
}

/** 1단계 — 판이 같을 때 저장한 줄 구간의 글자가 exact 와 같으면 그 자리. */
function byLines(A, idx, exact) {
  const st = A.start || {};
  const en = A.end || {};
  if (st.lineId == null || en.lineId == null) return null;
  for (let k = 0; k < idx.parts.length; k++) {
    const j = idx.parts[k].joined;
    let s = -1;
    let e = -1;
    for (const sp of j.spans) {
      if (String(sp.id) === String(st.lineId)) s = sp.start + int(st.off);
      if (String(sp.id) === String(en.lineId)) e = sp.start + int(en.off);
    }
    if (s < 0 && e < 0) continue;
    if (s < 0 || e < 0 || !(e > s)) return null;
    if (j.text.slice(s, e) !== exact) return null;
    return { k: k, s: s, e: e, score: contextScore(j.text, s, e, A.quote || {}, false) };
  }
  return null;
}

/* ── 같은 점수의 후보 가르기 — 같은 글·같은 앞뒤 문맥이 쪽에 두 번 있으면(되풀이된 문단) 글자로는 가를 수 없다.
   그때는 **저장한 첫 줄에 가장 가까운** 후보(줄 id 끝 번호 = 읽기 순서 — 판이 줄을 다시 매기지 않았으면 바로 그 줄). ── */

function lineNo(id) { const m = /(\d+)$/.exec(str(id)); return m ? Number(m[1]) : null; }
/** 문단 결합 글자의 오프셋 `s` 가 든 줄 id. */
function lineAtOff(joined, s) {
  for (const sp of joined.spans) if (s < sp.end) return sp.id;
  return joined.spans.length ? joined.spans[joined.spans.length - 1].id : null;
}
/** 후보 순위 — 점수가 높을수록, 같으면 저장한 첫 줄과 가까울수록. `want` = 저장한 첫 줄 번호(없으면 null). */
function better(c, best, want) {
  if (!best) return true;
  if (c.score !== best.score) return c.score > best.score;
  if (want == null || c.near == null) return false;
  return best.near == null || c.near < best.near;
}
function nearOf(id, want) { const n = lineNo(id); return want == null || n == null ? null : Math.abs(n - want); }

/** 2·3단계 — 문단들 `ks` 안의 exact 자리 중 문맥 점수가 가장 높은 것(같으면 저장한 첫 줄에 가까운 것, 그것도 같으면 앞의 것). */
function exactIn(idx, ks, q, want) {
  const exact = str(q.exact);
  let best = null;
  for (const k of ks) {
    const j = idx.parts[k].joined;
    const t = j.text;
    let at = t.indexOf(exact);
    while (at >= 0) {
      const c = { k: k, s: at, e: at + exact.length, score: contextScore(t, at, at + exact.length, q, false), near: nearOf(lineAtOff(j, at), want) };
      if (better(c, best, want)) best = c;
      at = t.indexOf(exact, at + 1);
    }
  }
  return best;
}

/** 4단계 — 접은 글자로 같은 고르기. 짧은 인용은 문맥이 `FUZZY_MIN_CONTEXT` 이상 맞아야 받는다. */
function fuzzyIn(idx, ks, q, want) {
  const F = foldText(q.exact).text;
  if (!F) return null;
  let best = null;
  for (const k of ks) {
    const j = idx.parts[k].joined;
    const t = j.text;
    const ft = foldText(t);
    let i = ft.text.indexOf(F);
    while (i >= 0) {
      const s = ft.map[i];
      const e = ft.map[i + F.length - 1] + 1;
      const c = { k: k, s: s, e: e, score: contextScore(t, s, e, q, true), near: nearOf(lineAtOff(j, s), want) };
      if (better(c, best, want)) best = c;
      i = ft.text.indexOf(F, i + 1);
    }
  }
  if (!best) return null;
  if (F.length < ANNO.FUZZY_MIN_CHARS && best.score < ANNO.FUZZY_MIN_CONTEXT) return null;
  return best;
}

/**
 * 4단계 끝 — **문단 경계를 넘어** 쪽 전체 접은 글자에서(판이 문단을 다르게 나눴다 — 접기가 문단 사이 '\n' 도 공백으로 뺀다).
 * 문단 안 자리는 `fuzzyIn` 이 이미 봤으므로 경계를 넘는 자리만 본다. 받는 규칙은 같다. 좌표는 화면 글자(`abs`).
 */
function fuzzyAcross(idx, q, want) {
  const F = foldText(q.exact).text;
  if (!F) return null;
  const ft = foldText(idx.text);
  let best = null;
  let i = ft.text.indexOf(F);
  while (i >= 0) {
    const s = ft.map[i];
    const e = ft.map[i + F.length - 1] + 1;
    if (idx.text.slice(s, e).indexOf('\n') >= 0) {
      const k = partAt(idx, s);
      const p = idx.parts[k];
      const c = { abs: true, k: k, s: s, e: e, score: contextScore(idx.text, s, e, q, true), near: nearOf(lineAtOff(p.joined, s - p.base), want) };
      if (better(c, best, want)) best = c;
    }
    i = ft.text.indexOf(F, i + 1);
  }
  if (!best) return null;
  if (F.length < ANNO.FUZZY_MIN_CHARS && best.score < ANNO.FUZZY_MIN_CONTEXT) return null;
  return best;
}

function done(idx, r, how) {
  if (r.abs) {
    // 문단을 넘는 자리 — 문단마다 줄 구간을 모은다(`rangesOnScreen` 과 같은 `rangesFor`)
    const ranges = [];
    for (const p of idx.parts) {
      const a = Math.max(r.s, p.base);
      const b = Math.min(r.e, p.base + p.joined.text.length);
      if (b > a) for (const x of rangesFor(p.joined, [{ at: a - p.base, len: b - a }])[0] || []) ranges.push(x);
    }
    if (!ranges.length) return null;
    return { ranges: ranges, how: how, score: r.score, para: r.k, at: r.s, len: r.e - r.s };
  }
  const p = idx.parts[r.k];
  const ranges = rangesFor(p.joined, [{ at: r.s, len: r.e - r.s }])[0] || [];
  if (!ranges.length) return null;
  return { ranges: ranges, how: how, score: r.score, para: r.k, at: p.base + r.s, len: r.e - r.s };
}

/**
 * 앵커 → 지금 화면의 자리. 못 찾으면 null(고아).
 * @param {Object} anchor `anchorOf` 결과(저장본)
 * @param {{text:string, parts:Array}} idx 지금 쪽 `screenIndex(…)`
 * @param {{algo?:number, paraHashes?:Array}} [opts] 지금 판 · 지금 문단 해시(`idx.parts` 순서)
 * @returns {{ranges:Array<{id,start,end}>, how:('exact'|'para'|'page'|'fuzzy'), score:number, para:number, at:number, len:number}|null}
 */
export function resolve(anchor, idx, opts) {
  const A = anchor || {};
  const q = A.quote || {};
  const exact = str(q.exact);
  if (!exact || !idx || !Array.isArray(idx.parts) || !idx.parts.length) return null;
  const o = opts || {};

  if (o.algo != null && A.algo != null && Number(A.algo) === Number(o.algo)) {
    const r = byLines(A, idx, exact);
    if (r) return done(idx, r, 'exact');
  }

  const all = idx.parts.map((_, k) => k);
  const hashes = Array.isArray(o.paraHashes) ? o.paraHashes : null;
  const same = hashes && A.textHash ? all.filter((k) => hashes[k] === A.textHash) : [];
  const want = A.start ? lineNo(A.start.lineId) : null;

  let r = same.length ? exactIn(idx, same, q, want) : null;
  if (r) return done(idx, r, 'para');
  r = exactIn(idx, all, q, want);
  if (r) return done(idx, r, 'page');
  r = same.length ? fuzzyIn(idx, same, q, want) : null;
  if (!r) r = fuzzyIn(idx, all, q, want);
  if (!r) r = fuzzyAcross(idx, q, want);
  if (r) return done(idx, r, 'fuzzy');
  return null;
}

/**
 * 인용만으로 찾기 — `resolve` 의 2–4단계(15 근거 찾기가 쓴다). 판·줄 구간이 없다.
 * @param {Object} desc `describePage(…)`
 * @param {{exact:string, prefix?:string, suffix?:string}} quote
 * @param {{textHash?:string, paraHashes?:Array}} [opts]
 */
export function findQuote(desc, quote, opts) {
  const o = opts || {};
  const { idx } = indexOfDesc(desc);
  return resolve({ quote: quote || {}, textHash: o.textHash || null }, idx, { paraHashes: o.paraHashes });
}
