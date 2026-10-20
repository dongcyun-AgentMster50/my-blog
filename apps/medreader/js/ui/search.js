/* ============================================================
   MedReader — 검색 화면 · 결과 · 결과로 이동 · 검색 띠 (spec 17-8-7 · 17-8-8 · 17-8-12 §4 — 8g-4a)

   `[8g-4b]` 목차 탭(이 책 범위 — 개요, 없거나 쓰레기 개요면 heading 폴백 + 머리 문구)도 여기 있다(5b절).

   UI 계층이다. 엔진(`search/engine.js`)은 결과·오류 **코드**만 낸다 — 문구는 여기서 i18n 으로 만든다(3-2).
   문서 글자는 전부 `textContent` 다(13절 — `innerHTML` 을 쓰지 않는다). 조각의 `<mark>` 도 글자 조각이다.

   ── 라우트 (`#/search` 서재 전체 · `#/search/:docId` 이 책) ──────────────
   `main.js` 는 수정 범위 밖이다. 퀴즈 화면처럼 **스스로 본다** — 섹션의 `hidden` 이 풀리고(라우터 `showScreen`)
   해시가 검색이면 그린다(`syncRoute`, MutationObserver + hashchange). 검색어·결과·스크롤은 **모듈 메모리**(`S`)에
   두고 URL 에 넣지 않는다(S28). 리더 → 검색은 리더를 "숨기기만" 한다(`reader.leaveReader` 의 검색 갈래) —
   낭독이 이어지고, 결과를 누르면 그때 멈춘다(17-8-12 §4-5).

   ── 엔진 결과 세 통로 (8g-4 carryover 1–3) ─────────────────────
   ① 정상 결과 ② `error` 가 붙은 결과 — `ERR_SEARCH_*`(검색어, 적중 0) / `ERR_DB_*`(저장소 — **적중과 함께** 올 수
   있다: 결과를 보이고 안내 한 줄) ③ **reject**(채우기 첫 실패·versionchange 뒤 읽기 실패) — 일반 오류 안내.
   **앞 세대(취소된) 검색의 reject·결과는 무시**한다. 같은 세대의 `onPartial` 은 **바꿔 그린다**(두 번 올 수 있다).
   이 판단은 `createSearchRun`(순수 — 엔진을 주입받는다)이 한다. 테스트가 같은 함수를 쓴다.

   ── 결과로 이동 (17-8-12 §4-5) ────────────────────────────────
   결과를 누름 → (낭독 중·쪽 넘김 대기면) `controls.pauseForJump()` → `#/reader/:docId/:p` → 리더가 그린 뒤
   (`onPageRender` — controls 의 `speaker.reload` 구독 **뒤**, 다시 보이기·언어 바꿈은 `onPageRepaint`) 그 쪽 **화면 글자에서
   다시 찾아** 칠하고(`search-hit` 전부 · `search-cur` 고른 것 — 낭독 하이라이트와 레지스트리 이름이 다르다)
   본문 가운데로 굴리고 `controls.cueAt` 로 다음 [▶] 의 시작점을 그 문장에 둔다. 못 찾으면 쪽 맨 위 + 안내.
   ============================================================ */

import * as db from '../db.js';
import * as settings from '../settings.js';
import { SEARCH } from '../config.js';
import { t, formatNumber, onLangChange, applyTranslations, errorKey, getDir } from '../i18n/index.js';
import { parseRoute, go, replace, readerHash, searchHash, libraryHash } from '../router.js';
import * as engine from '../search/engine.js';
import { printedLabel, tocOf } from '../search/outline.js';
import { foldText, parseQuery, findIn, hitLength, snippetAt, rangesFor, SEARCH_ERR } from '../text/search.js';
import { flowParasOf } from '../text/screen.js';
// 17-8-10 3-2 — `joinPieces` 는 UI 가 tts/text.js 에서 가져와 순수 `rangesFor` 에 넘긴다(검색이 tts 를 import 하지 않게).
import { joinPieces } from '../tts/text.js';
import { docLangOf } from '../text/lang.js';
// `[8l]` 스캔본·깨짐 문서의 검색 안내 한 줄(17-5-1 3 · 19-1-3 §3-3) — 판정은 순수 `text/scan.js`.
import { searchNotice } from '../text/scan.js';
import * as charhl from './charhl.js';
import {
  onPageRender, onPageRepaint, onReaderLeave, readingSpot, currentScreen, lineElement,
  revealLine, revealRegion, revealTop, noteSearchJump, setViewAnchorHint
} from './reader.js';
import { pauseForJump, cueAt, speechState, onSpeechChange } from './controls.js';
import { openDoc, extractorFor } from './library.js';

/* ════════════════════════════════════════════════════════
   1. 순수 부분 — tests/search-ui-8g.test.mjs 가 고정한다.
   ════════════════════════════════════════════════════════ */

/** CSS Custom Highlight 레지스트리 이름(17-8-8) — 낭독 하이라이트(`medreader-current`)와 **달라** 서로 지우지 않는다. */
export const HL_HIT = 'search-hit';
export const HL_CUR = 'search-cur';

/** 묶음 순서 — 제목 → 본문 → 표(17-8-7). */
export const GROUP_ORDER = Object.freeze(['head', 'body', 'table']);

/**
 * 결과 묶기 — 묶음마다 **쪽당 한 줄**(그 쪽 그 묶음의 적중 수 · 첫 적중). 묶음은 제목 → 본문 → 표, 묶음 안은 쪽 순서.
 * @param {Array<{pageNo:number, at:number, len:number, kind:string}>} hits
 * @returns {Array<{kind:string, count:number, rows:Array<{pageNo:number, kind:string, count:number, first:Object}>}>}
 */
export function groupRows(hits) {
  const byKind = new Map();
  for (const h of hits || []) {
    if (!h || GROUP_ORDER.indexOf(h.kind) < 0) continue;
    let g = byKind.get(h.kind);
    if (!g) { g = { kind: h.kind, count: 0, rows: [], byPage: new Map() }; byKind.set(h.kind, g); }
    g.count++;
    let r = g.byPage.get(h.pageNo);
    if (!r) { r = { pageNo: h.pageNo, kind: h.kind, count: 0, first: h }; g.byPage.set(h.pageNo, r); g.rows.push(r); }
    r.count++;
    if (h.at < r.first.at) r.first = h;
  }
  const out = [];
  for (const k of GROUP_ORDER) {
    const g = byKind.get(k);
    if (!g) continue;
    g.rows.sort((a, b) => a.pageNo - b.pageNo);
    out.push({ kind: g.kind, count: g.count, rows: g.rows });
  }
  return out;
}

/**
 * 띠의 ‹ › 가 도는 순서 — 쪽 순서, 쪽 안은 본문 글자(제목·본문) → 표, 그 안은 오프셋.
 * @returns {Array<{pageNo:number, at:number, len:number, kind:string, table:boolean}>}
 */
export function bandList(hits) {
  return (hits || []).filter((h) => h && GROUP_ORDER.indexOf(h.kind) >= 0)
    .map((h) => ({ pageNo: h.pageNo, at: h.at, len: h.len, kind: h.kind, table: h.kind === 'table' }))
    .sort((a, b) => (a.pageNo - b.pageNo) || ((a.table ? 1 : 0) - (b.table ? 1 : 0)) || (a.at - b.at));
}

/** 결과 줄(쪽·묶음) → 띠 목록에서의 자리(그 줄의 첫 적중). 없으면 -1. */
export function bandIndexOfRow(list, row) {
  if (!row) return -1;
  const table = row.kind === 'table';
  const at = row.first ? row.first.at : null;
  let fallback = -1;
  for (let i = 0; i < list.length; i++) {
    const h = list[i];
    if (h.pageNo !== row.pageNo || h.table !== table) continue;
    if (h.at === at) return i;
    if (fallback < 0) fallback = i;
  }
  return fallback;
}

/** 띠 이동 — 끝에서 멈춘다(돌지 않는다). 갈 곳이 없으면 -1. */
export function bandStep(i, n, delta) {
  const j = i + delta;
  return j >= 0 && j < n ? j : -1;
}

/** 같은 쪽·같은 글자(본문/표) 안에서 몇 번째 적중인가 — 화면에서 다시 찾을 때 오프셋이 어긋나면 이 순번을 쓴다. */
export function nthOnPage(list, i) {
  const h = list[i];
  if (!h) return -1;
  let n = 0;
  for (let k = 0; k < i; k++) if (list[k].pageNo === h.pageNo && list[k].table === h.table) n++;
  return n;
}

/**
 * 화면 글자 — 흐름 문단마다 `joinPieces`, 문단 사이 `'\n'`(검색 레코드 `text` 와 같은 식 — 17-8-12 U6).
 * @param {Array} paras `flowParasOf(desc)`
 * @param {function} join `joinPieces`
 * @returns {{text:string, parts:Array<{base:number, joined:{text:string, spans:Array}}>}}
 */
export function screenIndex(paras, join) {
  let text = '';
  const parts = [];
  const list = Array.isArray(paras) ? paras : [];
  for (let i = 0; i < list.length; i++) {
    const j = join(list[i].lines || []);
    if (i) text += '\n';
    parts.push({ base: text.length, joined: j });
    text += j.text;
  }
  return { text: text, parts: parts };
}

/**
 * 4-8 표 영역 글자(검색 레코드 `table` 과 같은 식 — 줄마다 공백 하나로 접고 `'\n'`) + 영역별 구간.
 * @param {Object} layout `fromStored` 결과
 * @returns {{text:string, regions:Array<{id:string, start:number, end:number}>}}
 */
export function tableIndex(layout) {
  const L = layout || {};
  const byId = new Map();
  for (const l of (Array.isArray(L.lines) ? L.lines : [])) byId.set(l.id, l);
  const out = [];
  const regions = [];
  let len = 0;
  for (const g of (Array.isArray(L.regions) ? L.regions : [])) {
    let start = -1;
    for (const id of (Array.isArray(g.lineIds) ? g.lineIds : [])) {
      const l = byId.get(id);
      if (!l) continue;
      const s = String(l.text || '').replace(/\s+/g, ' ').trim();
      if (out.length) len += 1;                // 줄 사이 줄바꿈 한 글자
      if (start < 0) start = len;
      out.push(s);
      len += s.length;
    }
    if (start >= 0) regions.push({ id: String(g.id), start: start, end: len });
  }
  return { text: out.join('\n'), regions: regions };
}

/** 글자에서 검색어 적중 — `[{at, len}]`(엔진과 같은 규칙: 접은 글자·대소문자 구분 약어는 원문). */
export function findOn(text, pq) {
  if (!pq || pq.error) return [];
  const hay = pq.cs ? String(text || '') : foldText(String(text || ''));
  return findIn(hay, pq).map((at) => ({ at: at, len: hitLength(hay, pq, at) }));
}

/**
 * 화면에서 다시 찾은 적중 중 고른 것 — 저장 오프셋이 그대로 있으면 그것, 아니면(판 어긋남) 같은 순번, 그것도 없으면 -1.
 * @param {number[]} ats 화면 적중 오프셋(오름차순)
 */
export function pickHit(ats, at, nth) {
  const i = ats.indexOf(at);
  if (i >= 0) return i;
  return Number.isInteger(nth) && nth >= 0 && nth < ats.length ? nth : -1;
}

/**
 * 화면 글자 적중 → 적중마다 줄 안 구간들(`rangesFor` — 줄바꿈 하이픈이면 두 줄). 문단을 넘는 적중은 없다(검색어에 '\n' 없음).
 * @returns {Array<Array<{id:string, start:number, end:number}>>}
 */
export function rangesOnScreen(idx, hits) {
  const out = [];
  for (const h of hits || []) {
    let part = null;
    for (const p of idx.parts) { if (h.at >= p.base && h.at < p.base + p.joined.text.length) { part = p; break; } }
    out.push(part ? rangesFor(part.joined, [{ at: h.at - part.base, len: h.len }])[0] : []);
  }
  return out;
}

/** 표 글자 적중 → 그 영역 id. */
export function regionAt(tidx, at) {
  for (const r of tidx.regions) if (at >= r.start && at < r.end) return r.id;
  return null;
}

/**
 * 결과의 오류 통로 — `{type:'ok'}` · `{type:'query', key}`(적중 0) · `{type:'db', key}`(적중과 함께 안내 한 줄).
 */
export function outcomeOf(r) {
  const code = r && typeof r.error === 'string' ? r.error : '';
  if (!code) return { type: 'ok' };
  if (code.indexOf('ERR_SEARCH_') === 0) return { type: 'query', key: code === SEARCH_ERR.LONG ? 'search.tooLong' : 'search.minChars' };
  if (code.indexOf('ERR_DB_') === 0) return { type: 'db', key: errorKey(code) };
  return { type: 'db', key: 'err.unknown' };
}

/** reject(③) → 일반 오류 안내 키. `DbError` 면 그 코드의 문구, 아니면 `err.unknown`. */
export function rejectKey(e) {
  return errorKey(e && e.code);
}

/** 최근 검색어 — 맨 앞에 넣고, 대소문자만 다른 같은 말은 하나로, 최대 `max`. 입력을 바꾸지 않는다. */
export function recentWith(list, q, max) {
  const s = String(q == null ? '' : q).replace(/\s+/g, ' ').trim();
  const cur = Array.isArray(list) ? list.filter((x) => typeof x === 'string' && x) : [];
  if (s.length < SEARCH.MIN_CHARS) return cur.slice(0, max);
  const low = s.toLowerCase();
  return [s].concat(cur.filter((x) => x.toLowerCase() !== low)).slice(0, max);
}

const SCRIPT_RE = Object.freeze({
  latin: /\p{Script=Latin}/u, hangul: /\p{Script=Hangul}/u, arabic: /\p{Script=Arabic}/u,
  greek: /\p{Script=Greek}/u, cjk: /\p{Script=Han}/u
});
const LANG_SCRIPT = Object.freeze({ en: 'latin', fr: 'latin', ko: 'hangul', ar: 'arabic' });

/**
 * 17-8-9 (가) — 검색어의 글자 체계가 책 언어와 다른가(아랍어로 친 검색어 · 영어 원서). 그리스 문자(β)는 의학 용어라 셈하지 않는다.
 * 책 언어를 모르면(목록 밖) 거짓.
 */
export function scriptMismatch(q, docLang) {
  const want = LANG_SCRIPT[String(docLang || 'en')];
  if (!want) return false;
  const s = String(q || '');
  if (SCRIPT_RE[want].test(s)) return false;
  for (const k of ['latin', 'hangul', 'arabic', 'cjk']) if (k !== want && SCRIPT_RE[k].test(s)) return true;
  return false;
}

/**
 * 검색 한 번의 세대 관리(carryover 1–3). 엔진을 주입받는다 — 순수(DOM 없음).
 *   doc(docId, q)   — `searchDoc`. 같은 세대의 `onPartial` 은 `draw({type:'partial', result})`(받는 쪽이 **바꿔** 그린다),
 *                     끝 `draw({type:'final', result})`, reject 는 `draw({type:'reject', error})`.
 *   library(q)      — `searchLibrary`. 책마다 `draw({type:'doc', result})`, 끝 `draw({type:'done', result})`.
 *   진행은 `draw({type:'progress', progress:{docId, done, total}})`.
 *   **앞 세대**의 partial·final·reject·progress 는 모두 버린다(취소된 검색의 reject 포함 — carryover 2).
 *   `cancelled` 결과도 버린다.
 */
export function createSearchRun(deps) {
  let gen = 0;
  const draw = (my, ev) => { if (my === gen) deps.draw(ev); };
  return {
    doc(docId, q) {
      const my = ++gen;
      let p;
      try {
        p = deps.searchDoc(docId, q, {
          onPartial: (r) => draw(my, { type: 'partial', result: r }),
          onProgress: (pr) => draw(my, { type: 'progress', progress: pr })
        });
      } catch (e) { p = Promise.reject(e); }
      return Promise.resolve(p).then(
        (r) => { if (r && r.cancelled) return; draw(my, { type: 'final', result: r }); },
        (e) => draw(my, { type: 'reject', error: e })
      );
    },
    library(q) {
      const my = ++gen;
      let p;
      try {
        p = deps.searchLibrary(q, {
          onPartial: (r) => { if (r && !r.cancelled) draw(my, { type: 'doc', result: r }); },
          onProgress: (pr) => draw(my, { type: 'progress', progress: pr })
        });
      } catch (e) { p = Promise.reject(e); }
      return Promise.resolve(p).then(
        (r) => { if (r && r.cancelled) return; draw(my, { type: 'done', result: r }); },
        (e) => draw(my, { type: 'reject', error: e })
      );
    },
    cancel() { gen++; },
    generation() { return gen; }
  };
}

/**
 * 결과로 가는 첫걸음(17-8-12 §4-5) — **먼저** 낭독을 멈추고(`pauseForJump`) 그다음 쪽으로 간다. 이미 그 쪽이 보이면
 * 이동 없이 그 자리에서 처리한다(같은 쪽 ‹ ›). 띠의 ‹ › 는 히스토리를 바꿔 쓰고(뒤로 한 번 = 결과 목록), 결과 목록에서
 * 누르면 쌓는다. env = {pauseForJump, screen, clear, mark, go, replace}. **순수**(주입) — 테스트가 같은 함수를 쓴다.
 * `[8g-4a-fix F1]` 해시를 바꾸기 직전에 `env.mark()`(= 리더 `noteSearchJump`) — 숨은 리더가 이것을 "뒤로 돌아옴"과 가른다.
 * @returns {{paused:boolean, same:boolean}}
 */
export function beginJump(env, target, fromBand) {
  const paused = !!env.pauseForJump();
  const scr = env.screen();
  const same = !!(scr && scr.visible && scr.ready && scr.docId === target.docId && scr.page === target.pageNo);
  if (!same) {
    env.clear();
    const hash = readerHash(target.docId, target.pageNo);
    env.mark();
    if (fromBand && scr && scr.visible) env.replace(hash); else env.go(hash);
  }
  return { paused: paused, same: same };
}

/**
 * `[8g-4b — carryover 25 · 8g-4a Review X1]` 기다리던 이동(`S.pending`)을 지금 그린 쪽에서 처리할 때인가 — 같은 책 ·
 * **같은 쪽** · 글자가 있는 쪽(자리표시자·깨진 쪽은 기다린다). 쪽 번호를 보지 않으면 숨은 리더가 넘긴 다른 쪽에 칠한다(F1 때의 길).
 * **순수**(tests/search-toc-8g4b.test.mjs).
 */
export function pendingDue(pend, scr) {
  return !!(pend && scr && pend.docId === scr.docId && pend.pageNo === scr.page && scr.ready);
}

/* ── 목차 탭 (17-8-6 · 17-8-12 §3·§4-2·§11-4 · 8g-4b) — 순수 부분 ─────────────── */

/**
 * 쪽 표시 키 — 인쇄 쪽 라벨이 있고 PDF 쪽과 다르면 "p. {인쇄} (PDF {쪽})", 아니면 "p. {쪽}"(17-8-12 §3). 숫자 꼴은 부르는 쪽이
 * `formatNumber` 로. 순수.
 * @returns {{key:'search.page'|'search.pageLabeled', page:number, label?:string}}
 */
export function pageKeyOf(pageLabels, p) {
  const lab = printedLabel(pageLabels, p);
  return lab ? { key: 'search.pageLabeled', page: p, label: lab } : { key: 'search.page', page: p };
}

/**
 * 목차 머리 안내 키(위에서부터). `tocOf` 결과를 받는다.
 *   개요를 아직 못 읽음(`outlineRead:false` — 오프라인 첫 열기) → `search.toc.unavailable`
 *   항목 0(개요·폴백 모두) → `search.toc.empty`
 *   폴백 → `search.toc.fallback` — **늘 보인다**(품질이 책마다 다르다). 쓰레기 개요를 버린 책(`outlineIgnored`)도 같은 문구(E5).
 * 문서가 없으면(null) `search.toc.empty`. 순수.
 */
export function tocNoteKeys(toc) {
  if (!toc) return ['search.toc.empty'];
  const keys = [];
  if (!toc.outlineRead) keys.push('search.toc.unavailable');
  const n = Array.isArray(toc.items) ? toc.items.length : 0;
  if (!n) keys.push('search.toc.empty');
  else if (toc.source === 'fallback') keys.push('search.toc.fallback');
  return keys;
}

/**
 * 지금 읽는 쪽이 든 항목 — 쪽이 `page` 이하인 항목 중 쪽이 가장 큰 것(같은 쪽이면 뒤 — 더 깊은 항목). `p:null` 은 셈하지 않는다.
 * 없으면 -1. 순수.
 */
export function tocCurrentIndex(items, page) {
  const pg = Number(page);
  if (!Array.isArray(items) || !Number.isFinite(pg)) return -1;
  let best = -1;
  let bp = -Infinity;
  for (let i = 0; i < items.length; i++) {
    const p = items[i] && items[i].p;
    if (Number.isInteger(p) && p <= pg && p >= bp) { best = i; bp = p; }
  }
  return best;
}

/**
 * 목차 줄 모형 — 깊이대로 들여 쓰고(깊이 3 이상은 한 칸 더 들이지 않는다) **깊이 3 이상은 접는다**(17-8-6): 그 위 깊이 2 항목(접기 단위)이
 * 펼쳐져 있을 때만 보인다. 펼침은 사용자가 고른 값(`open` Map — 접기 단위 순번 → 참/거짓)이 이기고, 고르지 않았으면 **지금 항목이 든
 * 가지만** 펼친다. `p:null`(쪽을 못 정한 항목)은 `disabled`(흐리게·못 누름). 순수 — 입력을 바꾸지 않는다.
 * @param {Array<{t:string, p:(number|null), d:number}>} items
 * @param {number|null} page 지금 읽는 쪽
 * @param {Map<number, boolean>} [open]
 * @returns {Array<{i:number, t:string, p:(number|null), d:number, indent:number, disabled:boolean, current:boolean,
 *           fold:number, kids:number, open:boolean, hidden:boolean}>}
 */
export function tocRows(items, page, open) {
  const list = Array.isArray(items) ? items : [];
  const chosen = open instanceof Map ? open : new Map();
  const cur = tocCurrentIndex(list, page);
  const rows = [];
  let unit = -1;
  for (let i = 0; i < list.length; i++) {
    const it = list[i] || {};
    const d = Math.max(1, Math.floor(Number(it.d)) || 1);
    if (d <= 2) unit = d === 2 ? i : -1;
    const p = Number.isInteger(it.p) && it.p >= 1 ? it.p : null;
    rows.push({
      i: i, t: String(it.t == null ? '' : it.t), p: p, d: d, indent: Math.min(d, 3) - 1,
      disabled: p == null, current: i === cur, fold: d >= 3 ? unit : -1, kids: 0, open: false, hidden: false
    });
  }
  const curUnit = cur >= 0 ? rows[cur].fold : -1;
  for (const r of rows) if (r.fold >= 0) rows[r.fold].kids++;
  const isOpen = (u) => (chosen.has(u) ? !!chosen.get(u) : u === curUnit);
  for (const r of rows) {
    if (r.kids > 0) r.open = isOpen(r.i);
    if (r.fold >= 0) r.hidden = !isOpen(r.fold);
  }
  return rows;
}

/**
 * `[8g-4b-R1]` 탭 목록 키보드(WAI-ARIA tabs · 자동 선택) — 이 키로 갈 탭 순번, 이 키가 아니면 `-1`(기본 동작 그대로).
 * ←/→ 는 **시각적** 방향이다: RTL(아랍어)에서는 탭이 오른쪽부터 놓이므로 ← 가 다음(+1), → 가 앞(−1). 끝에서는 **넘어간다**
 * (마지막 → 처음, 처음 → 마지막). Home 처음 · End 마지막. Alt·Ctrl·Meta 를 누른 채면 손대지 않는다(브라우저 뒤로 등). 순수.
 * @param {{key:string, altKey?:boolean, ctrlKey?:boolean, metaKey?:boolean}} ev
 * @param {number} i      지금 초점 탭 순번
 * @param {number} n      탭 수
 * @param {boolean} rtl   탭 목록이 RTL 인가
 * @returns {number}
 */
export function tabKeyTarget(ev, i, n, rtl) {
  if (!ev || ev.altKey || ev.ctrlKey || ev.metaKey) return -1;
  const cnt = Math.floor(Number(n)) || 0;
  if (cnt < 1) return -1;
  const at = Math.min(cnt - 1, Math.max(0, Math.floor(Number(i)) || 0));
  switch (ev.key) {
    case 'ArrowRight': return (at + (rtl ? -1 : 1) + cnt) % cnt;
    case 'ArrowLeft': return (at + (rtl ? 1 : -1) + cnt) % cnt;
    case 'Home': return 0;
    case 'End': return cnt - 1;
    default: return -1;
  }
}

/**
 * `[8g-4b — 8g-4a Review F2]` 이 그리기 뒤 고른 적중으로 **다시 cue** 하는가 — 마지막으로 간 적중이 이 쪽이고
 * (가) 새 판으로 다시 그렸다(`refreshed` — 8g-4a 그대로) 또는 (나) **같은 쪽을 다른 뷰로** 다시 그렸고 다음 [▶] 시작점이 아직
 * 검색이 정한 것이다(`owned` — ▶ 하면 풀린다). (나)가 없으면 멈춘 채 원본 ↔ 리플로우를 오가는 동안 speaker 의 "첫 줄 기준" 되살리기가
 * 적중 문장 앞 문장으로 한 칸씩 물러났다. 순수.
 */
export function shouldRecue(info, scr, lj, prev, owned) {
  if (!scr || !lj || lj.docId !== scr.docId || lj.pageNo !== scr.page) return false;
  if (info && info.refreshed) return true;
  return !!owned && !!prev && prev.docId === scr.docId && prev.page === scr.page && prev.view !== scr.view;
}

/** 결과 모형 — 이벤트를 받아 **바꿔** 쓴다(덧붙이지 않는다). */
export function newModel(scope, query) {
  return { scope: scope, query: query, result: null, docs: new Map(), progress: new Map(), error: null, final: false, partial: false };
}

export function applyEvent(m, ev) {
  if (!m || !ev) return m;
  switch (ev.type) {
    case 'partial': m.result = ev.result; m.partial = true; break;
    case 'final': m.result = ev.result; m.partial = false; m.final = true; break;
    case 'doc': if (ev.result && ev.result.docId != null) m.docs.set(ev.result.docId, ev.result); break;
    case 'done':
      if (ev.result && Array.isArray(ev.result.docs)) for (const d of ev.result.docs) m.docs.set(d.docId, d);
      if (ev.result && ev.result.error) m.queryError = ev.result.error;
      m.final = true;
      break;
    case 'progress': if (ev.progress && ev.progress.docId != null) m.progress.set(ev.progress.docId, { done: ev.progress.done, total: ev.progress.total }); break;
    case 'reject': m.error = ev.error || {}; m.final = true; break;
    default: break;
  }
  return m;
}

/* ════════════════════════════════════════════════════════
   2. 상태 — 모듈 메모리(검색어는 URL 에 넣지 않는다 · S28)
   ════════════════════════════════════════════════════════ */

let root = null;
let els = null;
const S = {
  shown: false, routeKey: null, prevRoute: null,
  scope: 'doc',            // 'doc' | 'library'
  docId: null,             // 이 책 범위의 책(리더에서 들어왔을 때)
  doc: null,               // 그 책 documents 레코드(제목·언어·쪽 라벨)
  query: '',
  model: null,
  scrollY: 0,
  spot: null,              // 읽던 자리 {docId, page, lineId, start, speaking} — [🔍] 를 누를 때(띠가 없을 때만)
  band: null,              // {docId, query, pq, list, i, lang}
  pending: null,           // 리더가 그린 뒤 할 일 {kind:'hit'|'spot', docId, pageNo, ...}
  lastJump: null,          // 마지막으로 간 적중 {docId, pageNo, i} — 다시 그리기(새 판·뷰·언어) 뒤 다시 칠하고 다시 cue
  docRecs: new Map(),      // docId → documents 레코드(서재 범위 제목)
  snips: new Map(),        // `${docId}|${pageNo}|${kind}` → snippetAt 결과(작다 — 쪽 글자는 들고 있지 않는다)
  debounce: null,
  /* `[8g-4b]` 목차 탭 — 이 책 범위에서만(서재 범위엔 없다). 탭·스크롤·펼침은 모듈 메모리(뒤로 = 그 탭 그대로). */
  tab: 'find',             // 'find' | 'toc'
  toc: null,               // {docId, data(tocOf 결과), error, prep:{done,total}|null, prepError}
  tocScrollY: 0,
  tocOpen: new Map(),      // 접기 단위 순번 → 펼침(사용자가 고른 것만)
  tocToken: 0,
  curLine: null,           // `[8g-4b F2]` 지금 칠해 둔 고른 적중 줄 {docId, page, id} — 뷰 전환 기준 줄 힌트
  lastView: null,          // `[8g-4b F2]` 마지막으로 처리한 그리기 {docId, page, view} — 뷰 전환을 알아본다
  cueOwned: false          // `[8g-4b F2]` 다음 [▶] 시작점을 검색이 정했다(▶ 하면 풀린다)
};
let run = null;
let io = null;
const snipQueue = new Set();
let snipTimer = null;

/* ════════════════════════════════════════════════════════
   3. 배선
   ════════════════════════════════════════════════════════ */

export function initSearch() {
  if (root || typeof document === 'undefined') return;
  root = document.querySelector('[data-screen="search"]');
  const readerRoot = document.querySelector('[data-screen="reader"]');
  const openBtn = readerRoot ? readerRoot.querySelector('#readerSearchBtn') : null;
  if (openBtn) openBtn.hidden = !SEARCH.ENABLED;
  if (!root) return;
  els = {
    back: root.querySelector('#searchBack'),
    scope: root.querySelector('#searchScope'),
    form: root.querySelector('#searchForm'),
    input: root.querySelector('#searchInput'),
    clear: root.querySelector('#searchClear'),
    recent: root.querySelector('#searchRecent'),
    chips: root.querySelector('#searchChips'),
    status: root.querySelector('#searchStatus'),
    results: root.querySelector('#searchResults'),
    tabs: root.querySelector('#searchTabs'),
    tabFind: root.querySelector('#searchTabFind'),
    tabToc: root.querySelector('#searchTabToc'),
    toc: root.querySelector('#searchToc'),
    band: readerRoot ? readerRoot.querySelector('#searchBand') : null,
    bandQ: readerRoot ? readerRoot.querySelector('#searchBandQ') : null,
    bandPrev: readerRoot ? readerRoot.querySelector('#searchBandPrev') : null,
    bandNext: readerRoot ? readerRoot.querySelector('#searchBandNext') : null,
    bandPos: readerRoot ? readerRoot.querySelector('#searchBandPos') : null,
    bandBack: readerRoot ? readerRoot.querySelector('#searchBandBack') : null,
    bandClose: readerRoot ? readerRoot.querySelector('#searchBandClose') : null,
    bandNote: readerRoot ? readerRoot.querySelector('#searchBandNote') : null
  };
  if (!SEARCH.ENABLED) {
    // §9 되돌림 — 입구·띠를 숨기고 라우트는 서재로 돌린다.
    if (els.band) els.band.hidden = true;
    watchRoute();
    return;
  }

  run = createSearchRun({ searchDoc: engine.searchDoc, searchLibrary: engine.searchLibrary, draw: onRunEvent });

  if (openBtn) openBtn.addEventListener('click', openFromReader);
  els.back.addEventListener('click', goBack);
  els.scope.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-scope]');
    if (b && !b.hidden) setScope(b.getAttribute('data-scope'));
  });
  els.form.addEventListener('submit', (ev) => { ev.preventDefault(); submitNow(); });
  els.input.addEventListener('input', onInput);
  els.clear.addEventListener('click', () => {
    els.input.value = '';
    onInput();
    try { els.input.focus(); } catch (e) { /* 초점 실패는 무해 */ }
  });
  els.chips.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-q]');
    if (!b) return;
    els.input.value = b.getAttribute('data-q');
    submitNow();
  });
  els.results.addEventListener('click', onResultsClick);
  if (els.tabs && els.toc) {
    els.tabs.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[role="tab"]');
      if (b) setTab(b === els.tabToc ? 'toc' : 'find');
    });
    els.tabs.addEventListener('keydown', onTabsKey);
    els.toc.addEventListener('click', onTocClick);
  }

  if (els.band) {
    els.bandPrev.addEventListener('click', () => stepBand(-1));
    els.bandNext.addEventListener('click', () => stepBand(1));
    els.bandBack.addEventListener('click', backToSpot);
    els.bandClose.addEventListener('click', closeBand);
  }

  // 리더가 그린 뒤(controls 의 speaker.reload 구독 **뒤** — initReader 가 initControls 다음에 이것을 부른다)
  onPageRender(onReaderPage);
  onPageRepaint(onReaderPage);
  onReaderLeave(() => { clearPaint(); });
  // `[8g-4b — 8g-4a Review F2]` 뷰를 바꿀 때 리더가 이 줄(보이면)을 기준으로 삼는다 — 원본 ↔ 리플로우 뒤에도 적중이 화면 안
  setViewAnchorHint(() => {
    const c = S.curLine;
    const scr = currentScreen();
    return c && scr && c.docId === scr.docId && c.page === scr.page ? c.id : null;
  });
  // 낭독을 [▶] 하면 띠는 남고 강조는 지운다(읽는 문장 하이라이트와 겹치지 않게 — 17-8-8)
  onSpeechChange((st) => { if (st === 'speaking') { clearPaint(); S.cueOwned = false; } });

  window.addEventListener('scroll', () => {
    if (!S.shown || !root || root.hidden) return;
    if (S.tab === 'toc') S.tocScrollY = window.scrollY || 0; else S.scrollY = window.scrollY || 0;
  }, { passive: true });
  onLangChange(relabel);
  watchRoute();
}

function watchRoute() {
  if (typeof MutationObserver === 'function') {
    new MutationObserver(syncRoute).observe(root, { attributes: true, attributeFilter: ['hidden'] });
  }
  window.addEventListener('hashchange', (ev) => {
    try { S.prevRoute = parseRoute(new URL(ev.oldURL).hash).name; } catch (e) { S.prevRoute = null; }
    setTimeout(syncRoute, 0);
  });
}

/** 섹션이 보이고 해시가 검색이면 그린다. 떠나면 정리한다. 몇 번 불려도 같다. */
function syncRoute() {
  if (!root) return;
  const r = parseRoute(typeof location !== 'undefined' ? location.hash : '');
  const visible = !root.hidden;
  if (r.name === 'search' && visible) {
    if (!SEARCH.ENABLED) { replace(libraryHash()); return; }
    const key = r.params.docId || '';
    if (!S.shown || S.routeKey !== key) {
      S.shown = true;
      S.routeKey = key;
      showSearch(r.params);
    }
  } else if (S.shown) {
    S.shown = false;
    leaveSearch();
  }
}

/* ════════════════════════════════════════════════════════
   4. 검색 화면
   ════════════════════════════════════════════════════════ */

/** 리더 [🔍] — 읽던 자리를 기억하고(띠가 없을 때만 — 검색을 이어 가는 중이면 처음 자리를 지킨다) 이 책 범위로. */
function openFromReader() {
  const spot = readingSpot();
  if (!spot || spot.docId == null) return;
  if (!S.band || !S.spot) S.spot = spot;
  go(searchHash(spot.docId));
}

async function showSearch(params) {
  const docId = params && params.docId ? String(params.docId) : null;
  const changed = docId !== S.docId;
  S.docId = docId;
  if (changed) {
    S.scope = docId ? 'doc' : 'library';
    S.doc = null;
    S.model = null;
    S.scrollY = 0;
    // `[8g-4b]` 다른 책 — 목차 탭도 처음부터(찾기 탭)
    S.tab = 'find';
    S.toc = null;
    S.tocScrollY = 0;
    S.tocOpen = new Map();
    S.tocToken++;
  }
  if (!docId) S.scope = 'library';
  paintScope();
  els.input.value = S.query;
  paintRecent();
  paintModel();
  // `[8g-4b]` 목차 탭이었으면(뒤로 돌아옴) 그 탭 그대로 — 가진 목록을 먼저 그리고 지금 쪽 표시만 새로
  if (S.tab === 'toc') showToc(true);
  // 스크롤은 **먼저** 되돌린다(뒤로 = 결과 목록·스크롤 그대로 — S28). 아래 기다림 동안 리더의 스크롤이 보이지 않게.
  restoreScroll();
  if (docId) {
    const had = !!S.doc;
    try { S.doc = await db.get('documents', docId); } catch (e) { S.doc = null; }
    if (!S.shown || S.docId !== docId) return;
    if (S.doc) S.docRecs.set(docId, S.doc);
    paintScope();
    if (S.tab === 'toc' && S.toc && S.toc.data) paintToc();
    // 처음 연 책 — 쪽 라벨(인쇄 쪽 번호)을 알게 됐으니 결과 줄을 다시 그린다
    if (!had && S.doc && S.model) { paintModel(); restoreScroll(); }
    // 17-8-12 2-2 — 화면을 여는 순간 캐시 채우기 + 백필(세대를 올리지 않는다). 실패는 검색이 안내한다.
    engine.prepareDoc(docId, { onProgress: (p) => { if (S.shown && S.scope === 'doc' && !S.query) paintPrep(p); } })
      .then(() => { if (S.shown && S.scope === 'doc' && !S.query) paintStatus([]); }, () => { /* 검색이 같은 오류를 안내한다 */ });
  }
  // 떠날 때 끝나지 않은 검색이었으면(결과가 부분) 다시 찾는다. 끝난 결과는 그대로.
  if (S.query && (!S.model || !S.model.final || S.model.scope !== S.scope)) runSearch(true);
  if (changed && !S.query) { try { els.input.focus({ preventScroll: true }); } catch (e) { /* 무해 */ } }
}

function leaveSearch() {
  if (S.debounce) { clearTimeout(S.debounce); S.debounce = null; }
  S.tocToken++;
  if (run) run.cancel();
  engine.cancel();
}

function restoreScroll() {
  const y = (S.tab === 'toc' ? S.tocScrollY : S.scrollY) || 0;
  const apply = () => { try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); } };
  apply();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(apply);
}

function goBack() {
  if (S.prevRoute === 'reader' || S.prevRoute === 'library') { history.back(); return; }
  go(S.docId ? readerHash(S.docId, (S.spot && S.spot.docId === S.docId && S.spot.page) || 1) : libraryHash());
}

function setScope(scope) {
  const next = scope === 'doc' && S.docId ? 'doc' : 'library';
  if (next === S.scope) return;
  S.scope = next;
  S.model = null;
  paintScope();
  if (S.query) runSearch(true); else paintModel();
}

function paintScope() {
  if (!els) return;
  const bs = els.scope.querySelectorAll('button[data-scope]');
  for (const b of bs) {
    const sc = b.getAttribute('data-scope');
    // 서재에서 들어오면 '서재'만(17-8-12 §4-1)
    b.hidden = sc === 'doc' && !S.docId;
    b.setAttribute('aria-pressed', sc === S.scope ? 'true' : 'false');
  }
  els.scope.hidden = !S.docId;
  paintTabs();
}

/* ── `[8g-4b]` 탭 [찾기] [목차] — 목차는 이 책 범위에서만(17-8-7 · 17-8-12 §4-1) ── */

function tocAllowed() { return S.scope === 'doc' && !!S.docId && !!els && !!els.tabs && !!els.toc; }

function paintTabs() {
  if (!els || !els.tabs || !els.toc) return;
  const allow = tocAllowed();
  if (!allow) S.tab = 'find';
  els.tabs.hidden = !allow;
  const toc = S.tab === 'toc';
  els.tabFind.setAttribute('aria-selected', toc ? 'false' : 'true');
  els.tabToc.setAttribute('aria-selected', toc ? 'true' : 'false');
  els.tabFind.tabIndex = toc ? -1 : 0;
  els.tabToc.tabIndex = toc ? 0 : -1;
  els.results.hidden = toc;
  els.status.hidden = toc;
  els.toc.hidden = !toc;
  if (toc) els.recent.hidden = true;
}

function setTab(tab) {
  const next = tab === 'toc' && tocAllowed() ? 'toc' : 'find';
  if (next === S.tab) return;
  if (S.tab === 'toc') S.tocScrollY = window.scrollY || 0; else S.scrollY = window.scrollY || 0;
  S.tab = next;
  paintTabs();
  if (next === 'toc') { showToc(false); return; }
  paintRecent();
  paintModel();
  restoreScroll();
}

/** `[8g-4b-R1]` 탭 목록 ←/→/Home/End — 초점을 옮기며 그 탭을 고른다(자동 선택). RTL 은 탭 목록의 계산된 방향으로 본다. */
function onTabsKey(ev) {
  if (!els || !tocAllowed()) return;
  const order = [els.tabFind, els.tabToc];
  const i = order.indexOf(ev.target);
  if (i < 0) return;
  let rtl = getDir() === 'rtl';
  try { rtl = getComputedStyle(els.tabs).direction === 'rtl'; } catch (e) { /* 계산 실패면 UI 언어 방향 */ }
  const j = tabKeyTarget(ev, i, order.length, rtl);
  if (j < 0) return;
  ev.preventDefault();
  // 초점 먼저, 그다음 선택 — 누름과 같은 순서(누름도 초점이 먼저 간다). 목차 탭이 "지금 항목으로 굴림"을 해도 초점이 되돌리지 않는다.
  try { order[j].focus(); } catch (e) { /* 초점 실패는 무해 */ }
  setTab(order[j] === els.tabToc ? 'toc' : 'find');
}

function onInput() {
  const q = els.input.value;
  // 목차 탭에서 검색어를 치기 시작하면 찾기 탭으로
  if (S.tab === 'toc' && q.trim()) setTab('find');
  paintRecent();
  if (S.debounce) { clearTimeout(S.debounce); S.debounce = null; }
  if (!q.trim()) { S.query = ''; S.model = null; if (run) run.cancel(); engine.cancel(); paintModel(); return; }
  // 이 책은 멈춤 250ms 뒤 자동, 서재 전체는 [찾기]/Enter 로만(17-8-5)
  if (S.scope !== 'doc') return;
  S.debounce = setTimeout(() => { S.debounce = null; S.query = els.input.value; runSearch(false); }, SEARCH.DEBOUNCE_MS);
}

function submitNow() {
  if (S.debounce) { clearTimeout(S.debounce); S.debounce = null; }
  if (S.tab === 'toc') setTab('find');
  S.query = els.input.value;
  remember(S.query);
  runSearch(true);
}

function remember(q) {
  if (parseQuery(q).error) return;
  const next = recentWith(settings.get('search.recent'), q, SEARCH.RECENT_MAX);
  settings.set('search.recent', next).catch(() => { /* 저장 실패가 검색을 막지 않는다 */ });
  paintRecent();
}

function runSearch(force) {
  const q = String(S.query || '');
  if (!q.trim()) { S.model = null; paintModel(); return; }
  if (!force && S.model && S.model.query === q && S.model.scope === S.scope && S.model.final) return;
  S.model = newModel(S.scope, q);
  S.scrollY = 0;
  paintModel();
  if (S.scope === 'doc' && S.docId) run.doc(S.docId, q);
  else run.library(q);
}

/** `createSearchRun` 이 걸러 준(지금 세대만) 이벤트 → 모형 → 화면. */
function onRunEvent(ev) {
  if (!S.model) return;
  applyEvent(S.model, ev);
  if (ev.type === 'doc' && ev.result) ensureDocRec(ev.result.docId);
  if (ev.type === 'progress' && S.model.scope === 'library') { paintLibProgress(ev.progress); return; }
  if (ev.type === 'progress') { paintModelStatus(); return; }
  paintModel();
}

async function ensureDocRec(docId) {
  if (S.docRecs.has(docId)) return;
  S.docRecs.set(docId, null);
  try { S.docRecs.set(docId, await db.get('documents', docId)); } catch (e) { /* 제목 없이 */ }
  if (S.shown && S.model && S.model.scope === 'library') paintModel();
}

/* ── 그리기 ─────────────────────────────────────────────── */

function paintRecent() {
  const list = Array.isArray(settings.get('search.recent')) ? settings.get('search.recent') : [];
  const show = S.tab !== 'toc' && !els.input.value.trim() && list.length > 0;
  els.recent.hidden = !show;
  clear(els.chips);
  if (!show) return;
  for (const q of list.slice(0, SEARCH.RECENT_MAX)) {
    const b = el('button', 'search-chip');
    b.type = 'button';
    b.setAttribute('data-q', q);
    b.setAttribute('dir', 'auto');
    b.textContent = q;
    els.chips.appendChild(b);
  }
}

function paintStatus(lines) {
  clear(els.status);
  for (const ln of lines) {
    const p = el('p', 'search-status-line' + (ln.tone ? ' is-' + ln.tone : ''));
    if (ln.node) p.appendChild(ln.node); else p.textContent = ln.text;
    els.status.appendChild(p);
  }
}

function paintPrep(p) {
  if (!p || !(p.total > 0) || p.done >= p.total) { paintStatus([]); return; }
  paintStatus([{ text: t('search.preparing', { done: formatNumber(p.done), total: formatNumber(p.total) }) }]);
}

function docLang(docId) {
  const d = S.docRecs.get(docId) || (docId === S.docId ? S.doc : null);
  return docLangOf(d);
}

/** "“{q}”을(를) 찾지 못했습니다" — 문구는 UI 언어, 검색어는 `<bdi dir=auto>` 로 격리(17-8-7 · S22). */
function isolated(key, q) {
  const tpl = t(key, { q: '\u0000' });
  const frag = document.createDocumentFragment();
  const parts = tpl.split('\u0000');
  frag.appendChild(document.createTextNode(parts[0]));
  if (parts.length > 1) {
    const b = document.createElement('bdi');
    b.setAttribute('dir', 'auto');
    b.textContent = q;
    frag.appendChild(b);
    frag.appendChild(document.createTextNode(parts.slice(1).join('')));
  }
  return frag;
}

function langName(lang) {
  const k = 'onboarding.lang.' + lang;
  const v = t(k);
  return v === k ? String(lang) : v;
}

function paintModelStatus() {
  const m = S.model;
  if (!m) { paintStatus([]); return; }
  const lines = [];
  if (m.error) { lines.push({ text: t(rejectKey(m.error)), tone: 'error' }); paintStatus(lines); return; }
  if (m.scope === 'doc') {
    const r = m.result;
    const pr = m.progress.get(S.docId);
    if (pr && pr.total > 0 && pr.done < pr.total) lines.push({ text: t('search.preparing', { done: formatNumber(pr.done), total: formatNumber(pr.total) }) });
    if (!r) { paintStatus(lines); return; }
    const oc = outcomeOf(r);
    if (oc.type === 'query') { lines.push({ text: t(oc.key) }); paintStatus(lines); return; }
    // `[8l]` 스캔본·글자 없음: 결과 0 이면 "찾지 못했습니다" 대신 한 줄 · 깨짐: 결과 위에 한 줄
    const sd = S.docRecs.get(S.docId) || S.doc;
    const sn = searchNotice(sd && sd.scan && sd.scan.verdict, { final: !!m.final, hits: r.hits.length });
    if (sn && !sn.replace) lines.push({ text: t(sn.key) });
    if (oc.type === 'db') lines.push({ text: t(oc.key), tone: 'error' });
    if (r.pageCount > 0 && r.pagesCovered < r.pageCount) {
      lines.push({ text: t('search.partial', { done: formatNumber(r.pagesCovered), total: formatNumber(r.pageCount) }) });
    }
    if (sn && sn.replace) {
      lines.push({ text: t(sn.key) });
    } else if (m.final && !r.hits.length) {
      lines.push({ node: isolated('search.empty', m.query) });
      if (scriptMismatch(m.query, docLang(S.docId))) lines.push({ text: t('search.scriptHint', { lang: langName(docLang(S.docId)) }) });
    }
  } else {
    if (m.queryError) {
      const oc = outcomeOf({ error: m.queryError });
      lines.push({ text: t(oc.key) });
      paintStatus(lines);
      return;
    }
    if (m.final) {
      let total = 0;
      for (const d of m.docs.values()) total += d.hits.length;
      if (!total) {
        lines.push({ node: isolated('search.empty', m.query) });
        const langs = [...m.docs.keys()].map((id) => docLang(id));
        if (langs.length && langs.every((l) => scriptMismatch(m.query, l))) lines.push({ text: t('search.scriptHint', { lang: langName(langs[0]) }) });
      }
    }
  }
  paintStatus(lines);
}

function paintModel() {
  if (!els) return;
  paintModelStatus();
  clear(els.results);
  if (io) { io.disconnect(); }
  const m = S.model;
  if (!m) return;
  els.results.setAttribute('aria-busy', m.final ? 'false' : 'true');
  if (m.error) return;
  if (m.scope === 'doc') {
    const r = m.result;
    if (!r || outcomeOf(r).type === 'query') return;
    paintGroups(els.results, S.docId, r);
  } else {
    if (m.queryError) return;
    for (const [docId, r] of m.docs) els.results.appendChild(docSection(docId, r));
    // 백필 진행 중인(아직 결과가 오지 않은) 책
    for (const [docId, p] of m.progress) {
      if (m.docs.has(docId) || !(p.total > 0) || p.done >= p.total) continue;
      els.results.appendChild(prepSection(docId, p));
    }
  }
  observeRows();
}

function paintGroups(host, docId, r) {
  const groups = groupRows(r.hits);
  for (const g of groups) {
    const sec = el('section', 'search-group');
    sec.setAttribute('data-kind', g.kind);
    const h = el('h2', 'search-group-head');
    h.textContent = t('search.group.' + g.kind, { n: formatNumber(g.count) });
    sec.appendChild(h);
    for (const row of g.rows) sec.appendChild(rowEl(docId, row));
    host.appendChild(sec);
  }
  if (r.truncated) {
    const p = el('p', 'search-more muted');
    p.textContent = t('search.tooMany');
    host.appendChild(p);
  }
}

function pageText(docId, p) {
  const d = S.docRecs.get(docId) || (docId === S.docId ? S.doc : null);
  return pageTextOf(d && d.pageLabels, p);
}

function pageTextOf(pageLabels, p) {
  const k = pageKeyOf(pageLabels, p);
  return t(k.key, { label: k.label, page: formatNumber(k.page) });
}

function rowEl(docId, row) {
  const b = el('button', 'search-row');
  b.type = 'button';
  b.setAttribute('data-doc', docId);
  b.setAttribute('data-kind', row.kind);
  b.setAttribute('data-page', String(row.pageNo));
  b.setAttribute('data-at', String(row.first.at));
  b.setAttribute('data-len', String(row.first.len));
  const top = el('span', 'search-row-top');
  const pg = el('span', 'search-row-page');
  pg.textContent = pageText(docId, row.pageNo);
  const cnt = el('span', 'search-row-count');
  cnt.textContent = t('search.count', { n: formatNumber(row.count) });
  top.appendChild(pg);
  top.appendChild(cnt);
  b.appendChild(top);
  const sn = el('span', 'search-snip');
  // 원서 글자 — UI 가 아랍어여도 LTR, lang = 문서 원문 언어(11-3 · 17-8-7)
  sn.setAttribute('dir', 'ltr');
  sn.setAttribute('lang', docLang(docId));
  b.appendChild(sn);
  const cached = S.snips.get(snipKey(docId, row.pageNo, row.kind));
  if (cached) fillSnip(sn, cached);
  return b;
}

function docSection(docId, r) {
  const d = S.docRecs.get(docId);
  const det = el('details', 'search-doc');
  det.setAttribute('data-doc', docId);
  if (r.hits.length) det.open = true;
  const sum = el('summary', 'search-doc-head');
  sum.textContent = t('search.library.doc', {
    title: (d && (d.title || d.fileName)) || docId,
    n: formatNumber(r.hits.length),
    done: formatNumber(r.pagesCovered || 0),
    total: formatNumber(r.pageCount || 0)
  });
  det.appendChild(sum);
  const oc = outcomeOf(r);
  if (oc.type === 'db') appendNote(det, t(oc.key), 'error');
  if (r.pageCount > 0 && r.pagesCovered < r.pageCount) {
    appendNote(det, t('search.partial', { done: formatNumber(r.pagesCovered), total: formatNumber(r.pageCount) }));
    const ex = d && d.extraction;
    if (!extractorFor(docId) && !(ex && ex.done)) {
      const b = el('button', 'search-prep');
      b.type = 'button';
      b.setAttribute('data-prep', docId);
      b.textContent = t('search.continuePrep');
      det.appendChild(b);
    }
  }
  paintGroups(det, docId, r);
  return det;
}

function prepSection(docId, p) {
  const d = S.docRecs.get(docId);
  const box = el('div', 'search-doc search-doc-prep');
  box.setAttribute('data-prep-doc', docId);
  const h = el('p', 'search-doc-head');
  h.textContent = (d && (d.title || d.fileName)) || '';
  box.appendChild(h);
  appendNote(box, t('search.preparing', { done: formatNumber(p.done), total: formatNumber(p.total) }));
  return box;
}

function paintLibProgress(p) {
  if (!p || p.docId == null) return;
  ensureDocRec(p.docId);
  if (S.model && S.model.docs.has(p.docId)) return;
  const old = els.results.querySelector('[data-prep-doc="' + cssEscape(p.docId) + '"]');
  if (!(p.total > 0) || p.done >= p.total) { if (old) old.remove(); return; }
  const box = prepSection(p.docId, p);
  if (old) old.replaceWith(box); else els.results.appendChild(box);
}

function appendNote(host, text, tone) {
  const p = el('p', 'search-note' + (tone ? ' is-' + tone : ''));
  p.textContent = text;
  host.appendChild(p);
}

/* ── 결과 조각 — 그 줄이 보일 때만 그 쪽 원문 레코드를 읽는다(17-8-5 · 원문을 메모리에 들고 있지 않는다) ── */

function snipKey(docId, pageNo, kind) { return docId + '|' + pageNo + '|' + kind; }

function observeRows() {
  const rows = els.results.querySelectorAll('button.search-row');
  if (!rows.length) return;
  if (typeof IntersectionObserver !== 'function') {
    for (let i = 0; i < Math.min(30, rows.length); i++) queueSnip(rows[i]);
    return;
  }
  if (!io) {
    io = new IntersectionObserver((ents) => {
      for (const en of ents) if (en.isIntersecting) { io.unobserve(en.target); queueSnip(en.target); }
    }, { rootMargin: '400px 0px' });
  }
  for (const r of rows) {
    if (r.querySelector('.search-snip').firstChild) continue;
    io.observe(r);
  }
}

function queueSnip(row) {
  snipQueue.add(row);
  if (snipTimer) return;
  snipTimer = setTimeout(flushSnips, 0);
}

async function flushSnips() {
  snipTimer = null;
  const rows = [...snipQueue].slice(0, 30);
  for (const r of rows) snipQueue.delete(r);
  if (snipQueue.size) snipTimer = setTimeout(flushSnips, 30);
  const want = new Map();
  for (const r of rows) {
    const k = r.getAttribute('data-doc') + '|' + r.getAttribute('data-page');
    if (!want.has(k)) want.set(k, []);
    want.get(k).push(r);
  }
  let recs = [];
  const keys = [...want.keys()].map((k) => { const i = k.lastIndexOf('|'); return [k.slice(0, i), Number(k.slice(i + 1))]; });
  try {
    recs = await db.withTx('searchText', 'readonly', (tx, s) => Promise.all(keys.map((key) => new Promise((resolve) => {
      const q = s.searchText.get(key);
      q.onsuccess = () => resolve(q.result || null);
      q.onerror = () => resolve(null);
    }))));
  } catch (e) { return; }
  for (let i = 0; i < keys.length; i++) {
    const rec = recs[i];
    if (!rec) continue;
    for (const row of want.get(keys[i][0] + '|' + keys[i][1])) {
      const kind = row.getAttribute('data-kind');
      const sn = snipOf(kind === 'table' ? rec.table : rec.text, Number(row.getAttribute('data-at')), Number(row.getAttribute('data-len')));
      S.snips.set(snipKey(keys[i][0], keys[i][1], kind), sn);
      if (row.isConnected) fillSnip(row.querySelector('.search-snip'), sn);
    }
  }
}

/**
 * 결과 조각 — `snippetAt` + 말줄임 표시는 **잘린 쪽에만**(문단 처음·끝에서 시작·끝나면 '…' 없음). 순수.
 * @returns {{before, hit, after, cutStart:boolean, cutEnd:boolean}}
 */
export function snipOf(text, at, len) {
  const s = String(text == null ? '' : text);
  const sn = snippetAt(s, at, len);
  const a = Math.max(0, Math.floor(Number(at)) || 0);
  const lo = a > 0 ? s.lastIndexOf('\n', a - 1) + 1 : 0;
  let hi = s.indexOf('\n', a + sn.hit.length);
  if (hi < 0) hi = s.length;
  return Object.assign(sn, { cutStart: a - sn.before.length > lo, cutEnd: a + sn.hit.length + sn.after.length < hi });
}

/** 조각 = 세 글자 조각(`textContent`) — 적중만 `<mark>`. 검색어·원문이 HTML 로 해석될 길이 없다(S21). */
function fillSnip(host, sn) {
  if (!host) return;
  clear(host);
  host.appendChild(document.createTextNode((sn.cutStart ? '…' : '') + sn.before));
  const mk = document.createElement('mark');
  mk.textContent = sn.hit;
  host.appendChild(mk);
  host.appendChild(document.createTextNode(sn.after + (sn.cutEnd ? '…' : '')));
}

/* ════════════════════════════════════════════════════════
   5. 결과로 이동 · 검색 띠
   ════════════════════════════════════════════════════════ */

function onResultsClick(ev) {
  const prep = ev.target.closest('button[data-prep]');
  if (prep) {
    prep.disabled = true;
    openDoc(prep.getAttribute('data-prep')).catch(() => { prep.disabled = false; });
    return;
  }
  const row = ev.target.closest('button.search-row');
  if (!row) return;
  const docId = row.getAttribute('data-doc');
  const r = S.model && (S.model.scope === 'doc' ? S.model.result : S.model.docs.get(docId));
  if (!r) return;
  remember(S.model.query);
  const band = { docId: docId, query: S.model.query, pq: parseQuery(S.model.query), list: bandList(r.hits), i: 0 };
  const i = bandIndexOfRow(band.list, {
    pageNo: Number(row.getAttribute('data-page')), kind: row.getAttribute('data-kind'),
    first: { at: Number(row.getAttribute('data-at')) }
  });
  if (i < 0) return;
  S.band = band;
  jumpTo(i, false);
}

function readerVisible() {
  const scr = currentScreen();
  return !!(scr && scr.visible);
}

/**
 * 띠 목록의 i 번째 적중으로. 결과 목록에서 누르면 히스토리에 쌓고(뒤로 = 결과 목록), 띠의 ‹ › 는 바꿔 쓴다
 * (‹ › 를 여러 번 눌러도 뒤로 한 번에 결과 목록 — 17-8-12 §4-3).
 */
const JUMP_ENV = Object.freeze({ pauseForJump: () => pauseForJump(), screen: () => currentScreen(), clear: () => clearPaint(), mark: () => noteSearchJump(), go: (h) => go(h), replace: (h) => replace(h) });

function jumpTo(i, fromBand) {
  const b = S.band;
  if (!b || i < 0 || i >= b.list.length) return;
  b.i = i;
  const hit = b.list[i];
  // 이동이 해시를 바꾸면 리더가 그린 뒤 `onReaderPage` 가 이 `pending` 을 처리한다 — 그래서 먼저 둔다.
  S.pending = { kind: 'hit', docId: b.docId, pageNo: hit.pageNo, i: i, paused: false };
  const pend = S.pending;
  const r = beginJump(JUMP_ENV, { docId: b.docId, pageNo: hit.pageNo }, fromBand);
  pend.paused = r.paused;
  paintBand();
  if (r.same && S.pending === pend) onReaderPage({ docId: b.docId, page: hit.pageNo });
}

function stepBand(delta) {
  const b = S.band;
  if (!b) return;
  const j = bandStep(b.i, b.list.length, delta);
  if (j >= 0) jumpTo(j, true);
}

/** [읽던 곳으로] — 기억한 쪽·줄로 가서 그 줄로 굴리고, 낭독 시작점도 그 자리(멈춘 채 — 운영자 결정 G3). */
function backToSpot() {
  const sp = S.spot;
  if (!sp) return;
  S.pending = { kind: 'spot', docId: sp.docId, pageNo: sp.page, lineId: sp.lineId, start: sp.start, paused: false };
  const pend = S.pending;
  const r = beginJump(JUMP_ENV, { docId: sp.docId, pageNo: sp.page }, true);
  pend.paused = r.paused;
  if (r.same && S.pending === pend) onReaderPage({ docId: sp.docId, page: sp.page });
}

/** ✕ — 강조와 띠를 지운다. 검색 화면 상태(검색어·결과)는 남긴다. */
function closeBand() {
  S.band = null;
  S.spot = null;
  S.pending = null;
  S.lastJump = null;
  clearPaint();
  paintBand();
}

function paintBand() {
  if (!els || !els.band) return;
  const b = S.band;
  const scr = currentScreen();
  const on = !!b && !!scr && scr.docId === b.docId;
  els.band.hidden = !on;
  if (!on) return;
  clear(els.bandQ);
  const q = document.createElement('bdi');
  q.setAttribute('dir', 'auto');
  q.textContent = b.query;
  els.bandQ.appendChild(q);
  els.bandPos.textContent = t('search.band.pos', { i: formatNumber(b.i + 1), n: formatNumber(b.list.length) });
  els.bandPrev.disabled = bandStep(b.i, b.list.length, -1) < 0;
  els.bandNext.disabled = bandStep(b.i, b.list.length, 1) < 0;
  els.bandBack.hidden = !S.spot;
}

function bandNote(keys) {
  if (!els || !els.bandNote) return;
  const ks = (keys || []).filter(Boolean);
  els.bandNote.hidden = !ks.length;
  els.bandNote.textContent = ks.map((k) => t(k)).join(' · ');
  els.bandNote.setAttribute('data-keys', ks.join(' '));
}

/**
 * 리더가 쪽을 그렸다(`onPageRender` — `{docId, page, refreshed?}`) 또는 다시 붙였다(`onPageRepaint` — 언어 바꿈·다시 보이기).
 * 기다리던 이동이 이 쪽이면 처리하고, 아니면 이 쪽의 적중을 다시 칠한다(띠가 이 책이면).
 */
function onReaderPage(info) {
  const scr = currentScreen();
  if (!scr) return;
  paintBand();
  const pend = S.pending;
  if (pendingDue(pend, scr)) {
    S.pending = null;
    S.lastView = { docId: scr.docId, page: scr.page, view: scr.view };
    if (pend.kind === 'spot') { doSpot(scr, pend); return; }
    if (pend.kind === 'top') { doTop(scr, pend); return; }
    doHit(scr, pend);
    return;
  }
  const prev = S.lastView;
  S.lastView = { docId: scr.docId, page: scr.page, view: scr.view };
  repaint(scr, shouldRecue(info, scr, S.lastJump, prev, S.cueOwned));
}

/** 이 쪽 적중 전부(+ 고른 것)를 화면 글자에서 다시 찾는다. */
function locate(scr, b) {
  const out = { all: [], cur: null, found: false, table: false, lineId: null, start: 0, regionId: null };
  if (!b || !scr.desc) return out;
  const idx = screenIndex(flowParasOf(scr.desc), joinPieces);
  const hits = findOn(idx.text, b.pq);
  out.all = rangesOnScreen(idx, hits);
  const want = b.list[b.i];
  if (!want || want.pageNo !== scr.page) return out;
  const nth = nthOnPage(b.list, b.i);
  if (want.table) {
    const ti = tableIndex(scr.layout);
    const th = findOn(ti.text, b.pq);
    const k = pickHit(th.map((h) => h.at), want.at, nth);
    out.table = true;
    if (k >= 0) { out.found = true; out.regionId = regionAt(ti, th[k].at); }
    return out;
  }
  const k = pickHit(hits.map((h) => h.at), want.at, nth);
  if (k < 0 || !out.all[k] || !out.all[k].length) return out;
  out.found = true;
  out.cur = out.all[k];
  out.lineId = String(out.cur[0].id);
  out.start = out.cur[0].start;
  return out;
}

function doHit(scr, pend) {
  const b = S.band;
  if (!b || b.docId !== scr.docId) return;
  b.i = pend.i;
  paintBand();
  const loc = locate(scr, b);
  paint(loc);
  const notes = [];
  if (!loc.found) {
    revealTop();
    notes.push('search.notOnPage');
  } else if (loc.table) {
    revealRegion(loc.regionId);
    notes.push('search.inTable');
  } else {
    revealLine(loc.lineId, loc.cur[0]);
    settleReveal(scr, loc);
    cueHere(loc.lineId, loc.start);
  }
  if (pend.paused) notes.push('search.paused');
  bandNote(notes);
  S.lastJump = { docId: scr.docId, pageNo: scr.page, i: pend.i };
}

function doSpot(scr, pend) {
  S.lastJump = null;
  repaint(scr, false);
  if (pend.lineId != null) {
    revealLine(pend.lineId, null);
    cueHere(pend.lineId, pend.start);
  }
  bandNote(pend.paused ? ['search.paused'] : []);
}

/** `[8g-4b]` 목차 항목으로 왔다 — 그 쪽 맨 위, 멈춤·처음이면 다음 [▶] 도 그 쪽 첫 줄부터. 띠가 이 책이면 이 쪽 적중은 다시 칠한다. */
function doTop(scr, pend) {
  repaint(scr, false);
  revealTop();
  const paras = scr.desc ? flowParasOf(scr.desc) : [];
  const first = paras.length && paras[0].lines && paras[0].lines.length ? paras[0].lines[0].id : null;
  if (first != null) cueHere(String(first), 0);
  bandNote(pend.paused ? ['search.paused'] : []);
}

/** 멈춤·처음이면 다음 [▶] 의 시작점을 그 문장으로(낭독 중이면 건드리지 않는다). */
function cueHere(lineId, start) {
  const st = speechState();
  if ((st === 'paused' || st === 'idle') && cueAt(lineId, start)) S.cueOwned = true;
}

/** 크롭 그림이 늦게 붙어 적중이 밀리면 한 번 더 가운데로(그사이 사용자가 굴렸으면 그대로). */
function settleReveal(scr, loc) {
  const y0 = window.scrollY;
  setTimeout(() => {
    const now = currentScreen();
    if (!now || now.docId !== scr.docId || now.page !== scr.page || !now.visible) return;
    if (Math.abs((window.scrollY || 0) - y0) > 2) return;
    revealLine(loc.lineId, loc.cur[0]);
  }, 400);
}

/** 이 쪽의 적중을 다시 칠한다(다시 그리기·다른 쪽). `again` = 새 판으로 다시 그렸다 → 다시 cue(§4-5). */
function repaint(scr, again) {
  const b = S.band;
  if (!b || b.docId !== scr.docId || !scr.ready) { clearPaint(); return; }
  if (speechState() === 'speaking') { clearPaint(); return; }
  const loc = locate(scr, b);
  paint(loc);
  if (again && loc.found && !loc.table) cueHere(loc.lineId, loc.start);
  if (scr.view === 'original' && loc.found && !loc.table && S.lastJump && S.lastJump.pageNo === scr.page) revealLine(loc.lineId, loc.cur[0]);
}

/* ── 칠하기 — CSS Custom Highlight(이름 둘) · 미지원이면 줄 클래스(charhl 규칙 그대로) ── */

function paint(loc) {
  clearPaint();
  const all = [];
  for (const rs of loc.all) for (const r of rs) all.push(r);
  if (!all.length && !loc.cur && !(loc.table && loc.regionId != null)) return;
  const okAll = all.length ? charhl.paintCharRanges(HL_HIT, all, lineElement) : false;
  const okCur = loc.cur ? charhl.paintCharRanges(HL_CUR, loc.cur, lineElement) : false;
  if (!okAll) for (const r of all) { const n = lineElement(r.id); if (n) n.classList.add('search-hit-line'); }
  if (loc.cur && !okCur) for (const r of loc.cur) { const n = lineElement(r.id); if (n) n.classList.add('search-cur-line'); }
  if (loc.cur && loc.cur.length) {
    const scr = currentScreen();
    if (scr) S.curLine = { docId: scr.docId, page: scr.page, id: String(loc.cur[0].id) };
  }
  if (loc.table && loc.regionId != null) {
    const fig = document.querySelector('[data-screen="reader"] figure[data-region-id="' + cssEscape(loc.regionId) + '"]');
    if (fig) fig.classList.add('search-cur-fig');
  }
}

function clearPaint() {
  S.curLine = null;
  charhl.clearCharRanges(HL_HIT);
  charhl.clearCharRanges(HL_CUR);
  if (typeof document === 'undefined') return;
  const ns = document.querySelectorAll('.search-hit-line, .search-cur-line, .search-cur-fig');
  for (const n of ns) n.classList.remove('search-hit-line', 'search-cur-line', 'search-cur-fig');
}

/* ════════════════════════════════════════════════════════
   5b. `[8g-4b]` 목차 탭 (17-8-6 · 17-8-12 §3·§4-2·§11-4 · S19)
   개요(`documents.outline`)가 있으면 그것, 없거나 쓰레기 개요면 heading 폴백(`tocOf` — 저장하지 않음). 타이핑 0 으로 장을 옮긴다.
   폴백은 그 책 `searchText.heads` 로 만들므로 **먼저 백필**(`engine.prepareDoc` — 검색 화면이 연 순간 이미 시작한 것을 함께
   기다린다, carryover 12). 항목 누름 → 그 쪽 맨 위(결과로 가는 길과 같이: 낭독 중이면 멈추고 → 쪽 이동).
   ════════════════════════════════════════════════════════ */

/** 지금 읽는 쪽 — 리더가 이 책이면(숨어 있어도) 그 쪽, 아니면 마지막으로 읽은 쪽. */
function tocPage() {
  const scr = currentScreen();
  if (scr && scr.docId === S.docId && scr.page) return scr.page;
  const d = S.doc;
  const p = d && Number(d.lastPage);
  return p > 0 ? p : null;
}

/** 목차 탭을 보인다. `back` = 뒤로 돌아옴(스크롤은 restoreScroll 이 되돌린다) — 아니면 지금 항목으로 굴린다. */
function showToc(back) {
  if (!S.docId) return;
  const have = !!(S.toc && S.toc.docId === S.docId && S.toc.data);
  if (have) {
    paintToc();
    if (!back) scrollTocToCurrent();
  }
  loadToc(S.docId, !have && !back);
}

async function loadToc(docId, scrollCur) {
  const my = ++S.tocToken;
  const alive = () => my === S.tocToken && S.shown && S.docId === docId;
  if (!S.toc || S.toc.docId !== docId) S.toc = { docId: docId, data: null, error: null, prep: null, prepError: null };
  const T = S.toc;
  if (!T.data) paintToc();
  let data;
  try {
    data = await tocOf(docId);
    if (!alive()) return;
    if (data && data.source === 'fallback') {
      // 지금 있는 heads 로 먼저 보이고, 백필이 끝나면 다시 만든다(목록이 늘 수 있다)
      if (!T.data) { T.data = data; T.error = null; if (S.tab === 'toc') { paintToc(); if (scrollCur) scrollTocToCurrent(); } }
      const pr = await engine.prepareDoc(docId, {
        onProgress: (p) => { if (alive() && S.toc === T) { T.prep = p; paintTocPrep(); } }
      });
      if (!alive()) return;
      T.prepError = pr && pr.error ? pr.error : null;
      data = await tocOf(docId);
      if (!alive()) return;
    }
  } catch (e) {
    if (!alive() || S.toc !== T) return;
    T.error = e;
    T.prep = null;
    if (S.tab === 'toc') paintToc();
    return;
  }
  if (S.toc !== T) return;
  const changed = !T.data || tocKey(T.data) !== tocKey(data);
  const first = !T.data;
  T.data = data;
  T.error = null;
  T.prep = null;
  if (S.tab !== 'toc') return;
  if (changed || T.prepError) paintToc(); else paintTocPrep();
  if (first && scrollCur) scrollTocToCurrent();
}

/** 목록이 바뀌었는가 — 다시 그리면 스크롤·펼침이 흔들리므로 같으면 그리지 않는다. */
function tocKey(d) {
  if (!d) return '';
  return [d.source, d.outlineRead, d.outlineIgnored, (d.items || []).length].concat((d.items || []).map((x) => x.p + ':' + x.d + ':' + x.t)).join('\u0001');
}

function paintTocPrep() {
  if (!els || !els.toc) return;
  const T = S.toc;
  let n = els.toc.querySelector('.toc-prep');
  const on = !!(T && T.prep && T.prep.total > 0 && T.prep.done < T.prep.total);
  if (!on) { if (n) n.remove(); return; }
  if (!n) {
    n = el('p', 'search-note toc-prep');
    els.toc.insertBefore(n, els.toc.firstChild);
  }
  n.textContent = t('search.preparing', { done: formatNumber(T.prep.done), total: formatNumber(T.prep.total) });
}

function paintToc() {
  if (!els || !els.toc) return;
  const host = els.toc;
  clear(host);
  const T = S.toc;
  if (!T) return;
  host.setAttribute('aria-busy', T.data || T.error ? 'false' : 'true');
  paintTocPrep();
  if (T.error) { appendNote(host, t(rejectKey(T.error)), 'error'); return; }
  if (!T.data) return;      // 아직 읽는 중
  if (T.prepError) appendNote(host, t(errorKey(T.prepError)), 'error');
  for (const k of tocNoteKeys(T.data)) appendNote(host, t(k), k === 'search.toc.empty' ? null : 'toc');
  const items = T.data.items || [];
  if (!items.length) return;
  const labels = Array.isArray(T.data.pageLabels) ? T.data.pageLabels : (S.doc && S.doc.pageLabels);
  const lang = docLang(S.docId);
  const ol = el('ol', 'toc-list');
  for (const r of tocRows(items, tocPage(), S.tocOpen)) ol.appendChild(tocRowEl(r, labels, lang));
  host.appendChild(ol);
}

function tocRowEl(r, labels, lang) {
  const li = el('li', 'toc-item' + (r.current ? ' is-here' : ''));
  li.setAttribute('data-d', String(r.d));
  li.style.setProperty('--toc-indent', String(r.indent));
  if (r.hidden) li.hidden = true;
  const b = el('button', 'toc-row');
  b.type = 'button';
  b.setAttribute('data-toc', String(r.i));
  if (r.disabled) {
    // 쪽을 못 정한 항목(17-8-6) — 흐리게, 누를 수 없다
    b.disabled = true;
    b.classList.add('is-nopage');
  } else {
    b.setAttribute('data-page', String(r.p));
  }
  if (r.current) b.setAttribute('aria-current', 'true');
  const tt = el('span', 'toc-title');
  tt.id = 'tocT' + r.i;
  // 개요 제목·heading 은 원서 글자 — UI 가 아랍어여도 LTR, lang = 문서 언어(17-8-7 · 17-8-12 §4-4)
  tt.setAttribute('dir', 'ltr');
  tt.setAttribute('lang', lang);
  tt.textContent = r.t;
  b.appendChild(tt);
  const meta = el('span', 'toc-meta');
  if (r.p != null) {
    const pg = el('span', 'toc-page');
    pg.textContent = pageTextOf(labels, r.p);
    meta.appendChild(pg);
  }
  if (r.current) {
    const here = el('span', 'toc-here');
    here.textContent = t('search.toc.here');
    meta.appendChild(here);
  }
  if (meta.firstChild) b.appendChild(meta);
  li.appendChild(b);
  if (r.kids > 0) {
    // 깊이 3 이상을 접고 펴는 단추 — 이름은 그 항목 제목(새 문구 없음)
    const f = el('button', 'toc-fold');
    f.type = 'button';
    f.setAttribute('data-fold', String(r.i));
    f.setAttribute('aria-expanded', r.open ? 'true' : 'false');
    f.setAttribute('aria-labelledby', tt.id);
    const g = el('span', 'toc-fold-glyph');
    g.setAttribute('aria-hidden', 'true');
    g.textContent = '›';
    f.appendChild(g);
    li.appendChild(f);
  }
  return li;
}

function scrollTocToCurrent() {
  if (!els || !els.toc) return;
  const cur = els.toc.querySelector('.toc-row[aria-current="true"]');
  if (!cur || cur.closest('[hidden]')) { try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); } return; }
  try { cur.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e) { cur.scrollIntoView(); }
  S.tocScrollY = window.scrollY || 0;
}

function onTocClick(ev) {
  const f = ev.target.closest('button[data-fold]');
  if (f) {
    const i = Number(f.getAttribute('data-fold'));
    S.tocOpen.set(i, f.getAttribute('aria-expanded') !== 'true');
    const y = window.scrollY || 0;
    paintToc();
    try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); }
    return;
  }
  const b = ev.target.closest('button.toc-row');
  if (!b || b.disabled) return;
  const p = Number(b.getAttribute('data-page'));
  if (!Number.isInteger(p) || p < 1 || !S.docId) return;
  tocJump(p);
}

/** 목차 항목 → 그 쪽 맨 위. 결과로 가는 길과 같다(`beginJump` — 낭독 중이면 멈춤 → 숨은 리더에 "이동" 표시 → 쌓는 이동). */
function tocJump(p) {
  S.tocScrollY = window.scrollY || 0;
  S.pending = { kind: 'top', docId: S.docId, pageNo: p, paused: false };
  const pend = S.pending;
  const r = beginJump(JUMP_ENV, { docId: S.docId, pageNo: p }, false);
  pend.paused = r.paused;
  if (r.same && S.pending === pend) onReaderPage({ docId: S.docId, page: p });
}

/* ════════════════════════════════════════════════════════
   6. 작은 도구들
   ════════════════════════════════════════════════════════ */

function relabel() {
  if (!root) return;
  applyTranslations(root);
  if (els && els.band) applyTranslations(els.band);
  paintBand();
  if (S.shown) { paintRecent(); paintModel(); if (S.tab === 'toc') paintToc(); }
}

function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

function cssEscape(s) {
  const v = String(s);
  if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') return CSS.escape(v);
  return v.replace(/["\\]/g, '\\$&');
}

/** 진단용 — 지금 검색 상태의 모양(글자는 검색어뿐). */
export function searchState() {
  return {
    shown: S.shown, scope: S.scope, docId: S.docId, query: S.query,
    band: S.band ? { docId: S.band.docId, i: S.band.i, n: S.band.list.length } : null,
    spot: S.spot ? { docId: S.spot.docId, page: S.spot.page, lineId: S.spot.lineId } : null,
    dir: getDir()
  };
}
