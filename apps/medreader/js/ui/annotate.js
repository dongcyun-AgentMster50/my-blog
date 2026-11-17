/* ============================================================
   MedReader — 필기 칠하기 (spec 17-16 4 — 20-1)

   ── 리플로우 ── 쪽을 그릴 때(`onPageRender`)·다시 붙일 때(`onPageRepaint`) 그 쪽 레코드를 읽어(`docId_pageNo`) 다시 찾고
   (`annotations.placeOnPage` → 순수 `resolve` — 인용이 정본, `buildLineRemap` 에 기대지 않는다) 색마다 이름 하나
   `anno-yellow`·`anno-green`·`anno-blue`·`anno-pink`·`anno-note` 로 `charhl.paintCharRanges`. 메모가 붙은 하이라이트도
   `anno-note`(점선 밑줄)에 함께 든다. 미지원 브라우저는 줄 클래스 `.anno-line-{색}`(줄 통째 옅은 배경 — 물러섬).
   우선순위(`Highlight.priority`, 20-D9): 필기 0 < 검색 1 < 낭독 2 — 겹치면 낭독 하이라이트가 위.
   ── 원본 보기 ── `original.setAnnotations` — 오버레이의 **필기 층**(`.anno-layer`, 낭독 상자 풀과 따로).
   ── 표시만 ── 본문 DOM 에 아무것도 끼우지 않는다(11-D22 와 같은 까닭). 만들기 UI 는 20-2.

   UI 계층이다. 문구를 만들지 않는다.
   ============================================================ */

import { ANNO } from '../config.js';
import * as charhl from './charhl.js';
import * as original from './original.js';
import { annotationStore } from '../notes/annotations.js';
import { onPageRender, onPageRepaint, onReaderLeave, currentScreen, lineElement } from './reader.js';

/** 레지스트리 이름(색 넷 + 메모). 검색(`search-hit`·`search-cur`)·낭독(`medreader-current`)과 이름이 다르다. */
export const NAMES = Object.freeze({
  yellow: 'anno-yellow', green: 'anno-green', blue: 'anno-blue', pink: 'anno-pink', note: 'anno-note'
});
const ALL_NAMES = Object.keys(NAMES).map((k) => NAMES[k]);
const LINE_CLASSES = Object.keys(NAMES).map((k) => 'anno-line-' + k);

/**
 * 레지스트리에 올린 하이라이트의 쌓는 순서(`ANNO.PRIORITY`). 지원하지 않거나 그 이름이 없으면 할 일이 없다.
 * 검색(`ui/search.js`)·낭독(`ui/reader.js`)도 이 함수로 자기 순서를 둔다(한 벌).
 */
export function prioritize(name, priority) {
  if (!charhl.highlightsSupported()) return false;
  try {
    const h = CSS.highlights.get(String(name));
    if (!h) return false;
    h.priority = Number(priority) || 0;
    return true;
  } catch (e) { return false; }
}

/**
 * 찾은 필기 → 칠할 묶음. **순수**.
 * @param {Array<{rec:Object, res:(Object|null)}>} placed `placeOnPage` 결과(고아는 건너뛴다)
 * @returns {Array<{key:string, ranges:Array<{id,start,end}>}>} key = 색 넷 · 'note'. 비지 않은 것만, `NAMES` 순서.
 */
export function paintGroups(placed) {
  const by = new Map();
  const add = (key, rs) => { if (!by.has(key)) by.set(key, []); for (const r of rs) by.get(key).push(r); };
  for (const p of placed || []) {
    if (!p || !p.res || !p.rec) continue;
    const rs = p.res.ranges || [];
    if (!rs.length) continue;
    const rec = p.rec;
    if (rec.kind === 'highlight') add(ANNO.COLORS.indexOf(rec.color) >= 0 ? rec.color : ANNO.COLORS[0], rs);
    if (rec.kind === 'note' || (typeof rec.note === 'string' && rec.note.trim())) add('note', rs);
  }
  const out = [];
  for (const k of Object.keys(NAMES)) if (by.has(k)) out.push({ key: k, ranges: by.get(k) });
  return out;
}

/** 리플로우 칠하기 — 레지스트리(우선순위 0), 미지원이면 줄 클래스. 칠한 묶음 수. */
export function paintReflow(groups, findLine) {
  clearReflow();
  let n = 0;
  for (const g of groups || []) {
    const name = NAMES[g.key];
    if (!name) continue;
    const ok = charhl.paintCharRanges(name, g.ranges, findLine);
    if (ok) { prioritize(name, ANNO.PRIORITY.ANNO); n++; continue; }
    for (const r of g.ranges) {
      const node = findLine(String(r.id));
      if (node) node.classList.add('anno-line-' + g.key);
    }
    n++;
  }
  return n;
}

/** 리플로우의 필기 칠하기를 모두 걷는다(레지스트리 다섯 이름 + 줄 클래스). */
export function clearReflow() {
  for (const name of ALL_NAMES) charhl.clearCharRanges(name);
  if (typeof document === 'undefined') return;
  const sel = LINE_CLASSES.map((c) => '.' + c).join(', ');
  for (const n of document.querySelectorAll(sel)) n.classList.remove(...LINE_CLASSES);
}

/* ── 배선 ─────────────────────────────────────────────── */

let wired = false;
let seq = 0;
let store = null;
/** `[20-2]` 마지막으로 칠한 쪽의 찾은 결과 — 선택 줄 겹침 판정·쪽 필기 시트·쪽 칩이 읽는다(DB 를 다시 읽지 않게). */
let last = null;
const paintedListeners = new Set();

/** `ui/reader.js` 의 `initReader` 가 부른다(검색 뒤). 구독만 한다. */
export function initAnnotate(deps) {
  if (wired) return;
  wired = true;
  store = (deps && deps.store) || annotationStore();
  onPageRender(() => { paintNow(); });
  onPageRepaint(() => { paintNow(); });
  onReaderLeave(() => { seq++; last = null; clearReflow(); });
}

/**
 * 지금 쪽의 필기를 다시 찾아 칠한다. 늦게 끝난 옛 쪽 결과는 버린다.
 * `[20-2 — 20-1R #5]` 걷기는 **새 결과를 받은 뒤** 같은 틱에(`paintReflow` 가 걷고 바로 칠한다) — 같은 쪽 다시 알림 때 한 프레임
 * 꺼졌다 켜지지 않게. 칠할 쪽이 없으면(자리표시자·떠남) 곧장 걷는다.
 */
export async function paintNow() {
  const token = ++seq;
  const scr = currentScreen();
  if (!scr || !scr.ready || !scr.desc) { last = null; clearReflow(); return 0; }
  let placed = [];
  try {
    placed = await (store || annotationStore()).placeOnPage(scr.docId, scr.page, scr.desc, { layout: scr.layout });
  } catch (e) { if (token === seq) { last = null; clearReflow(); } return 0; }      // 저장소를 못 읽어도 읽기는 계속된다
  if (token !== seq) return 0;
  const now = currentScreen();
  if (!now || now.docId !== scr.docId || now.page !== scr.page || now.desc !== scr.desc) return 0;
  const groups = paintGroups(placed);
  last = { docId: now.docId, page: now.page, desc: now.desc, placed: placed };
  for (const fn of paintedListeners) { try { fn(last); } catch (e) { /* 구독자 예외 */ } }
  if (now.view === 'original') { clearReflow(); original.setAnnotations(groups); return groups.length; }
  return paintReflow(groups, lineElement);
}

/** `[20-2]` 지금 쪽의 찾은 필기(`placeOnPage` 결과) — 그 쪽을 칠한 뒤에만(아니면 null). */
export function placedNow() {
  const scr = currentScreen();
  if (!last || !scr || scr.docId !== last.docId || scr.page !== last.page || scr.desc !== last.desc) return null;
  return last.placed;
}

/** `[20-2]` 칠할 때마다 `fn({docId, page, placed})` — 쪽 칩이 수를 다시 센다. 해제 함수를 돌려준다. */
export function onPainted(fn) { paintedListeners.add(fn); return () => paintedListeners.delete(fn); }
