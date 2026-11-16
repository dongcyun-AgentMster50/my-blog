/* ============================================================
   MedReader — 선택 동작 줄 (spec 17-7-6 4-2 · 3절 손짓 표 · 17-7-1)

   ── 이 파일이 하는 일 ───────────────────────────────────
   리플로우 본문 글자를 길게 눌러(브라우저 낱말 선택) 또는 손잡이로 늘려 고르면, 낭독 컨트롤 바(띠가 켜져 있으면 띠)
   **바로 위**에 동작 줄을 띄운다. 자체 타이머로 길게 누르기를 잡지 않는다 — `selectionchange` 만 듣는다(17-7-1).
     · `[단어 번역]`(기본 목록에서는 `hidden` — `[8f-2]` 단어 시트가 준비되면 controls 가 `refresh(showAction(…,'word'))` 로 켠다)
       · `[문장 번역]` · `[여기서부터 읽기]`
       · `[18]` `[찾아보기]` — `{q}` 의료 사이트 링크가 하나 이상일 때만(spec 17-9). 여는 일은 이 파일이 `ui/links.js` 로 곧바로
         (새 탭은 누름 안에서 — 팝업 차단), 그다음 `onAction('lookup')`(controls 는 듣기 취소만)
     · 단추 목록은 **데이터**(`SEL_ACTIONS`)에서 그린다 — 11 이 "보이는 3칸 + `[⋯]`"(설명·요약·여기서부터 읽기·검색)로
       바꿀 때 목록과 `selBarModel` 만 고치면 된다(crossstep-notes 8c-1)
   동작 자체는 모른다 — controls 가 넘긴 `onAction(id, snapshot)` 을 부른다(speaker·readalong·띠를 import 하지 않는다).

   ── 지키는 것 ──────────────────────────────────────────
   ★ 스냅숏: 선택이 바뀔 때(rAF 로 묶음) `{lineId, start, end, text, page}` 를 떠 둔다. 단추는 **스냅숏만** 쓴다 —
     Android 에서 단추를 누르는 순간 선택이 풀릴 수 있다 `[가정 — 실기기]`. 선택이 접히면 300ms 뒤 줄을 거둔다(그 사이 단추 탭이 닿게).
   ★ 시작점이 `article.reflow` 안 `span.line[data-flow="1"]` 일 때만. `.ra-tr`(8d 블록)·`.tr-band` 글자 선택에는 안 뜬다.
     원본 보기(캔버스)·검색 화면·퀴즈에는 붙지 않는다(리더 리플로우만).
   ★ 문구는 i18n(`data-i18n`) · 동작은 줄 하나의 위임 리스너(`data-sel-action`) · `innerHTML` 0.
   ============================================================ */

import { t, applyTranslations, onLangChange } from '../i18n/index.js';
import { lineOffsetOf, clampSelection } from '../text/select.js';
// `[18 — spec 17-9 · 결정 18-D1]` [찾아보기] — 검색어는 순수 `queryText`(8c-1 과 같은 6낱말·60자 상수), 여는 일·목록은 `ui/links.js`.
import { queryText } from '../text/links.js';
import { lookup, queryLinkCount, closeLookupMenu, lookupMenuOpen } from './links.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분 — `tests/taptr-8c.test.mjs`
   ──────────────────────────────────────────────────────── */

/**
 * 선택 동작 줄의 단추 — 논리 순서(RTL 에서 저절로 거울). `hidden` 은 아직 켜지 않은 칸.
 * `[11 — 넘길 것]` 보이는 3칸 [단어 번역][문장 번역][설명] + `[⋯]`(요약·여기서부터 읽기·검색 — 18 [찾아보기]).
 */
export const SEL_ACTIONS = Object.freeze([
  Object.freeze({ id: 'word', key: 'sel.word', hidden: true }),      // 8f-2 가 켠다
  Object.freeze({ id: 'sentence', key: 'sel.sentence' }),
  Object.freeze({ id: 'readFrom', key: 'sel.readFrom' }),
  // `[18 — spec 17-9]` 넷째 자리. `when:'links'` = `{q}` 링크가 하나 이상일 때만 보인다(`selBarModel` 셋째 인자). 11 이 `[⋯]` 안으로 옮긴다.
  Object.freeze({ id: 'lookup', key: 'sel.lookup', when: 'links' })
]);

/**
 * `[8f-2]` 목록에서 한 칸을 켠 사본(`hidden` 을 뗀다) — 단어 시트가 준비되면 controls 가 `refresh(showAction(SEL_ACTIONS, 'word'))`.
 * 시트가 없으면(마크업·의존 없음) 목록을 바꾸지 않으므로 [단어 번역]은 숨은 그대로다. 순수 함수.
 * @param {ReadonlyArray<{id:string, key:string, hidden?:boolean}>} list
 * @param {string} id
 */
export function showAction(list, id) {
  return Object.freeze((Array.isArray(list) ? list : []).map((a) => Object.freeze(a.id === id ? { id: a.id, key: a.key } : Object.assign({}, a))));
}

/** 접힌 선택을 거두기까지(단추 탭이 닿을 틈). */
export const HIDE_DELAY_MS = 300;

/**
 * 단추 목록 → 그릴 칸들. [단어 번역]은 선택이 6낱말·60자를 넘으면 흐림(`disabled` — 누르면 `sel.tooLong` 한 줄). 순수 함수.
 * `[18]` [찾아보기](`when:'links'`)는 `ctx.links`(`{q}` 링크 수)가 0 이면 숨김, 검색어(`queryText`)가 없으면(6낱말·60자 초과·
 * 구두점뿐) 흐림 — 누르면 `links.tooLong` 한 줄. `note` = 흐린 칸을 누를 때의 문구 키.
 * @param {ReadonlyArray<{id:string, key:string, hidden?:boolean, when?:string}>} actions
 * @param {?{text:string}} snap
 * @param {{links?:number}} [ctx]
 * @returns {{id:string, key:string, hidden:boolean, disabled:boolean, note:string}[]}
 */
export function selBarModel(actions, snap, ctx) {
  const long = !!snap && clampSelection(snap.text).tooLong;
  const links = ctx && Number(ctx.links) > 0;
  const noQuery = !!snap && queryText(snap.text) === null;
  return (Array.isArray(actions) ? actions : []).map((a) => {
    const lk = a.when === 'links';
    return {
      id: a.id, key: a.key, hidden: !!a.hidden || (lk && !links),
      disabled: (a.id === 'word' && long) || (lk && noQuery),
      note: lk ? 'links.tooLong' : 'sel.tooLong'
    };
  });
}

/**
 * `[8c-1b]` 선택이 바뀐 뒤 줄을 어떻게 할까(`update` 의 판단 — node 테스트가 고정한다). 순수 함수.
 *   · 스냅숏이 있다 → 보인다(거두기 예약은 취소) · 줄이 숨어 있다 처음 뜨면 가림 굴리기 한 번(`lift`)
 *   · 스냅숏이 없다(선택이 접힘·밖으로 나감) → 줄이 보이고 거두기 예약이 없으면 `HIDE_DELAY_MS` 뒤 거두기 예약(`hideLater`)
 * @param {boolean} hasSnap
 * @param {{hidden:boolean, hiding:boolean}} view  줄이 숨었는가 · 거두기 예약이 걸려 있는가
 * @returns {{show:boolean, lift:boolean, cancelHide:boolean, hideLater:boolean}}
 */
export function selBarStep(hasSnap, view) {
  const v = view || {};
  if (hasSnap) return { show: true, lift: !!v.hidden, cancelHide: !!v.hiding, hideLater: false };
  return { show: false, lift: false, cancelHide: false, hideLater: !v.hidden && !v.hiding };
}

/* ────────────────────────────────────────────────────────
   2. 화면
   ──────────────────────────────────────────────────────── */

let els = null;
let deps = null;
/** 마지막 스냅숏 — 단추가 쓴다. 줄을 거둘 때 지운다. */
let snap = null;
let rafPending = false;
let hideTimer = null;
let actions = SEL_ACTIONS;

/**
 * @param {{root:Element, onAction:(id:string, snap:Object)=>void, lift?:(bottom:number, edge:number)=>void}} d
 *   `lift` — 선택 아래변이 이 줄 윗변 − 4px 보다 아래면 그만큼 굴린다(controls → reader `liftAbove`).
 * @returns {{hide:Function, clear:Function, refresh:Function}}
 */
export function initSelBar(d) {
  if (els || typeof document === 'undefined') return api();
  const x = d || {};
  const bar = document.getElementById('selBar');
  if (!bar || !x.root || typeof x.onAction !== 'function') return api();
  els = { root: x.root, bar: bar, list: bar.querySelector('#selActions'), note: bar.querySelector('#selNote') };
  deps = x;
  render(null);

  document.addEventListener('selectionchange', onSelectionChange);
  // 데스크톱 마우스 — 단추를 누르는 순간 본문 선택이 풀리지 않게(터치에서는 스냅숏이 지킨다).
  bar.addEventListener('mousedown', (ev) => { ev.preventDefault(); });
  bar.addEventListener('click', onClick);
  onLangChange(() => { if (els) applyTranslations(els.bar); });
  attachDebugHook();
  return api();
}

function api() { return { hide: hide, clear: clear, refresh: refresh, top: top }; }

/** `[8c-1b]` 줄 윗변(px, 뷰포트 기준) — 숨어 있으면 null. 탭 띠가 새로 뜰 때 선택 글자 가림 굴리기(controls `openTapFor`)가 쓴다. */
export function top() {
  if (!els || els.bar.hidden) return null;
  const r = els.bar.getBoundingClientRect();
  return r && r.height > 0 ? r.top : null;
}

function onSelectionChange() {
  if (rafPending) return;
  rafPending = true;
  const run = () => { rafPending = false; update(); };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else setTimeout(run, 16);
}

/** 지금 선택을 다시 본다(rAF 안). */
function update() {
  if (!els) return;
  const s = snapshotOf(typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null);
  // `[18]` [찾아보기] 목록이 떠 있는 동안 선택이 풀려도(손가락 탭) 줄을 거두지 않는다 — 고르거나 닫으면(`onClose`) 다시 본다.
  // 선택이 다른 글자로 바뀌면 옛 검색어의 목록은 닫는다.
  if (lookupMenuOpen()) {
    if (!s) return;
    if (!snap || s.text !== snap.text) closeLookupMenu(true);
  }
  const step = selBarStep(!!s, { hidden: els.bar.hidden, hiding: hideTimer !== null });
  if (step.cancelHide) { clearTimeout(hideTimer); hideTimer = null; }
  if (step.show) {
    snap = s;
    render(s);
    show();
    if (step.lift) liftSelection();
    return;
  }
  if (step.hideLater) hideTimer = setTimeout(() => { hideTimer = null; hide(); }, HIDE_DELAY_MS);
}

function elOf(n) { return !n ? null : n.nodeType === 1 ? n : n.parentElement; }

/** 줄 안 오프셋 — 첫 텍스트 노드 기준(I1 좌표). `.hy`·이음 공백 안이면 줄 끝. */
function offsetIn(line, node, off) {
  const first = line.firstChild;
  const len = first && first.nodeType === 3 ? first.data.length : 0;
  if (first && node === first) return lineOffsetOf({ at: 'text', offset: off, len: len });
  if (node === line) return lineOffsetOf({ at: off === 0 ? 'before' : 'after', len: len });
  return lineOffsetOf({ at: 'after', len: len });
}

/**
 * 선택 → 스냅숏. 리더 리플로우 본문 줄에서 **시작**하는 선택만.
 * @returns {?{lineId:string, start:number, end:number, text:string, page:?number}}
 */
function snapshotOf(sel) {
  if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
  if (els.root.hidden) return null;
  const text = String(sel);
  if (!text.trim()) return null;
  const r = sel.getRangeAt(0);
  const startEl = elOf(r.startContainer);
  if (!startEl || !els.root.contains(startEl)) return null;
  if (startEl.closest('.ra-tr, .tr-band, #selBar')) return null;
  const line = startEl.closest('span.line[data-flow="1"]');
  if (!line || !line.closest('article.reflow')) return null;
  const id = line.getAttribute('data-line-id');
  if (!id) return null;
  const start = offsetIn(line, r.startContainer, r.startOffset);
  const endEl = elOf(r.endContainer);
  const endLine = endEl ? endEl.closest('span.line[data-flow="1"]') : null;
  const first = line.firstChild;
  const len = first && first.nodeType === 3 ? first.data.length : 0;
  const end = endLine === line ? offsetIn(line, r.endContainer, r.endOffset) : len;
  const sec = line.closest('section.page');
  const pg = sec ? Number(sec.getAttribute('data-page')) : NaN;
  // `[8f-2]` `multi` — 선택이 다음 줄까지 걸쳤다(단어 시트가 줄 글자 대신 선택 글자로 원어를 만든다 — `wordsheet.pickSurface`).
  return { lineId: id, start: start, end: Math.max(start, end), text: text.slice(0, 400), page: Number.isFinite(pg) ? pg : null,
    multi: endLine !== line };
}

/** 목록 데이터에서 단추를 (다시) 그린다. 같은 칸이면 속성만 고친다. */
function render(s) {
  const model = selBarModel(actions, s, { links: queryLinkCount() });
  const host = els.list;
  if (host.children.length !== model.length) {
    while (host.firstChild) host.removeChild(host.firstChild);
    for (const m of model) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sel-btn';
      b.setAttribute('data-sel-action', m.id);
      b.setAttribute('data-i18n', m.key);
      host.appendChild(b);
    }
    applyTranslations(els.bar);
  }
  for (let i = 0; i < model.length; i++) {
    const b = host.children[i];
    b.hidden = model[i].hidden;
    if (model[i].disabled) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
    b.setAttribute('data-sel-note', model[i].note);
  }
}

function show() {
  if (!els.bar.hidden) return;
  els.bar.hidden = false;
  if (els.note) { els.note.hidden = true; els.note.textContent = ''; }
  document.documentElement.setAttribute('data-sel-bar', 'on');
}

/** 줄을 거둔다(선택은 그대로). */
export function hide() {
  if (!els) return;
  if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
  closeLookupMenu(true);                 // `[18]` 목록은 줄 안에 있다 — 줄과 함께 거둔다
  snap = null;
  els.bar.hidden = true;
  if (els.note) { els.note.hidden = true; els.note.textContent = ''; }
  document.documentElement.removeAttribute('data-sel-bar');
}

/** 선택을 지우고 줄을 거둔다([여기서부터 읽기] · 리더 떠남). */
export function clear() {
  try { const sel = window.getSelection(); if (sel && sel.rangeCount) sel.removeAllRanges(); } catch (e) { /* 선택 없음 */ }
  hide();
}

/** 단추 목록을 바꾼다(8f-2 [단어 번역] 켜기·11 재배치). */
export function refresh(list) {
  if (Array.isArray(list)) actions = list;
  if (!els) return;
  closeLookupMenu(true);
  while (els.list.firstChild) els.list.removeChild(els.list.firstChild);
  render(snap);
}

/** 선택 상자가 이 줄에 가리면 그만큼 굴린다(4-1 과 같은 함수 — reader `liftAbove`). */
function liftSelection() {
  if (!deps || typeof deps.lift !== 'function') return;
  try {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const rr = sel.getRangeAt(0).getBoundingClientRect();
    const br = els.bar.getBoundingClientRect();
    if (rr && br && br.height > 0) deps.lift(rr.bottom, br.top);
  } catch (e) { /* 굴리지 못해도 줄은 뜬다 */ }
}

function onClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('button[data-sel-action]') : null;
  if (!b || !els.bar.contains(b) || b.hidden) return;
  const id = b.getAttribute('data-sel-action');
  if (b.getAttribute('aria-disabled') === 'true') {
    if (els.note) { els.note.textContent = t(b.getAttribute('data-sel-note') || 'sel.tooLong'); els.note.hidden = false; }
    return;
  }
  const s = snap;
  if (!s) return;
  if (id === 'lookup') {
    // `[18 — spec 17-9]` 새 탭은 **이 누름 안에서 곧바로**(팝업 차단을 피한다) — controls 보다 먼저. 낭독은 건드리지 않는다.
    let r = 'none';
    try {
      r = lookup(s.text, els.bar, { back: b, byKey: ev.detail === 0, onClose: onSelectionChange });
    } catch (e) { /* 열지 못해도 줄은 남는다 */ }
    if (r === 'tooLong' && els.note) { els.note.textContent = t('links.tooLong'); els.note.hidden = false; }
  }
  try { deps.onAction(id, Object.assign({}, s)); } catch (e) { /* 동작 오류가 줄을 막지 않는다 */ }
}

/* ── `[D]` 측정 훅 — 선택 글자는 담지 않는다(길이·줄 id·오프셋만) ── */
function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  if (g.selbar && g.selbar.__mine) return;
  g.selbar = {
    __mine: true,
    state: function () {
      if (!els) return null;
      return { hidden: els.bar.hidden, snap: snap ? { lineId: snap.lineId, start: snap.start, end: snap.end, chars: snap.text.length, page: snap.page } : null,
        buttons: Array.from(els.list.children).map((b) => ({ id: b.getAttribute('data-sel-action'), hidden: b.hidden })) };
    }
  };
}

/** 리더에 다시 들어올 때 디버그 훅을 다시 붙인다(`main.js` 가 전역 객체를 새로 만든다 — controls 와 같은 이유). */
export function reattach() { attachDebugHook(); }
