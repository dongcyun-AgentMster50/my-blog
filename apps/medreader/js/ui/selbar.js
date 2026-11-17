/* ============================================================
   MedReader — 선택 동작 줄 (spec 17-7-6 4-2 · 3절 손짓 표 · 17-7-1)

   ── 이 파일이 하는 일 ───────────────────────────────────
   리플로우 본문 글자를 길게 눌러(브라우저 낱말 선택) 또는 손잡이로 늘려 고르면, 낭독 컨트롤 바(띠가 켜져 있으면 띠)
   **바로 위**에 동작 줄을 띄운다. 자체 타이머로 길게 누르기를 잡지 않는다 — `selectionchange` 만 듣는다(17-7-1).
   `[11-2 — spec 17-2-1 · 결정 11-D3 (가)]` **보이는 칸 고정 + `[⋯]`** — 언어별 폭을 재지 않는다(10b 결함 교훈):
     · 보이는 칸: `[단어 번역]`(기본 목록에서는 `hidden` — `[8f-2]` 단어 시트가 준비되면 controls 가 `refresh(showAction(…,'word'))` 로 켠다)
       · `[문장 번역]` · `[11-4]` 셋째 칸 `[설명]`(`SEL_ACTIONS` 의 `sentence` 다음 자리) · `[⋯]`
     · `[⋯]` 안(`more:true` — 줄 위 작은 메뉴, `role="menu"`): `[요약]`(그 문단이 요약 대상이 아니면 흐림 — 누르면 `sum.notEligible` 한 줄)
       · `[여기서부터 읽기]` · `[12-2]` `[기억 카드]`(결과 한 줄은 `note(key)`) · `[18]` `[찾아보기]` — `{q}` 의료 사이트 링크가 하나 이상일 때만(spec 17-9). 여는 일은 이 파일이
         `ui/links.js` 로 곧바로(새 탭은 누름 안에서 — 팝업 차단), 그다음 `onAction('lookup')`(controls 는 듣기 취소만).
         링크가 둘 이상이면 18 목록이 `[⋯]` 메뉴 자리(선택 줄 위)에 뜬다 — 18 의 Esc 층·`armAnchor` 그대로.
     · 단추 목록은 **데이터**(`SEL_ACTIONS`)에서 그린다(crossstep-notes 8c-1).
   동작 자체는 모른다 — controls 가 넘긴 `onAction(id, snapshot)` 을 부른다(speaker·readalong·띠를 import 하지 않는다).
   `[⋯]` 메뉴의 Esc 는 18 목록과 같은 층(창 붙잡기 — 띠·시트보다 먼저, 메뉴만 닫고 `[⋯]` 로 포커스).

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
 * `[11-2 — 11-D3]` `more:true` 는 `[⋯]` 메뉴 안. 보이는 칸 = [단어 번역][문장 번역][설명] + `[⋯]`(요약·여기서부터 읽기·찾아보기).
 * `[11-4]` `sentence` 다음에 `explain`(보이는 셋째 칸)을 더했다.
 */
export const SEL_ACTIONS = Object.freeze([
  Object.freeze({ id: 'word', key: 'sel.word', hidden: true }),      // 8f-2 가 켠다
  Object.freeze({ id: 'sentence', key: 'sel.sentence' }),
  // `[11-4 — spec 17-2-1 4-7 · 11-D3]` 보이는 셋째 칸 — [문장 번역]과 같은 선택 스냅숏(선택 시작 줄의 문장)
  Object.freeze({ id: 'explain', key: 'sel.explain' }),
  // ↑ 보이는 칸 · ↓ `[⋯]` 안
  Object.freeze({ id: 'summary', key: 'sel.summary', more: true }),
  Object.freeze({ id: 'readFrom', key: 'sel.readFrom', more: true }),
  // `[12-2 — spec 17-11 5 · 12-D5]` [기억 카드] — 선택 시작 줄의 문장을 카드로(문장 아래 표시·번역 끔에서도 · 호출 0)
  Object.freeze({ id: 'remember', key: 'sel.remember', more: true }),
  // `[18 — spec 17-9]` `when:'links'` = `{q}` 링크가 하나 이상일 때만 보인다(`selBarModel` 셋째 인자). `[11-2]` `[⋯]` 안으로 옮겼다.
  Object.freeze({ id: 'lookup', key: 'sel.lookup', when: 'links', more: true })
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
 * `[11-2]` `more` = `[⋯]` 메뉴 안의 칸(그리는 자리만 다르다 — 흐림·숨김 규칙은 같다).
 * @returns {{id:string, key:string, hidden:boolean, disabled:boolean, note:string, more:boolean}[]}
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
      note: lk ? 'links.tooLong' : 'sel.tooLong',
      more: !!a.more
    };
  });
}

/**
 * `[11-2 — 17-2-1 3]` [요약] 칸의 흐림 — 선택한 문단이 요약 대상이 아니면(`ok === false` — 제목·문항·한 문장·60자 미만)
 * 흐리고 누르면 `sum.notEligible` 한 줄. `ok` 가 모름(`undefined` — 아직 재지 않음)이면 그대로. 순수 함수.
 * @param {ReturnType<typeof selBarModel>} model
 * @param {boolean|undefined} ok
 */
export function withSummary(model, ok) {
  return (Array.isArray(model) ? model : []).map((m) => (m.id === 'summary' && ok === false
    ? Object.assign({}, m, { disabled: true, note: 'sum.notEligible' }) : m));
}

/** `[11-2]` `[⋯]` 를 보일까 — 메뉴 안에 보이는 칸이 하나라도 있을 때. 순수 함수. */
export function moreVisible(model) {
  return (Array.isArray(model) ? model : []).some((m) => m.more && !m.hidden);
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
/** `[11-2]` `[⋯]` 메뉴가 떠 있으면 `{keyFn, downFn}`, 아니면 null. */
let more = null;
/** `[11-2]` [요약] 칸 — 이 스냅숏의 문단이 요약 대상인가(메뉴를 열 때 잰다 · 모르면 undefined). */
let summaryOk;

/**
 * @param {{root:Element, onAction:(id:string, snap:Object)=>void, lift?:(bottom:number, edge:number)=>void,
 *          canSummarize?:(snap:Object)=>boolean}} d
 *   `lift` — 선택 아래변이 이 줄 윗변 − 4px 보다 아래면 그만큼 굴린다(controls → reader `liftAbove`).
 *   `canSummarize` — `[11-2]` [요약] 흐림 판정(controls → `ask.canSummarize` — 호출 0, 읽기만). `[⋯]` 를 열 때 한 번.
 * @returns {{hide:Function, clear:Function, refresh:Function}}
 */
export function initSelBar(d) {
  if (els || typeof document === 'undefined') return api();
  const x = d || {};
  const bar = document.getElementById('selBar');
  if (!bar || !x.root || typeof x.onAction !== 'function') return api();
  els = { root: x.root, bar: bar, list: bar.querySelector('#selActions'), note: bar.querySelector('#selNote'),
    moreBtn: bar.querySelector('#selMoreBtn'), menu: bar.querySelector('#selMore') };
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

function api() { return { hide: hide, clear: clear, refresh: refresh, top: top, note: note }; }

/**
 * `[12-2]` 줄 위 한 줄 안내(i18n 키) — [기억 카드] 결과("기억 카드에 넣었습니다" 등). 줄이 숨어 있으면 아무것도 하지 않는다.
 * 흐린 칸의 안내(`data-sel-note`)와 같은 자리(`#selNote`) — 줄을 거두면(`hide`) 함께 지워진다.
 */
export function note(key) {
  if (!els || !els.note || els.bar.hidden || !key) return;
  els.note.textContent = t(key);
  els.note.hidden = false;
}

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
  // 선택이 다른 글자로 바뀌면 옛 검색어의 목록은 닫는다. `[11-2]` `[⋯]` 메뉴도 같은 규칙(그 안에서 [찾아보기]를 고른다).
  if (lookupMenuOpen() || more) {
    if (!s) return;
    if (!snap || s.text !== snap.text) { closeLookupMenu(true); closeMore(false); }
  }
  const step = selBarStep(!!s, { hidden: els.bar.hidden, hiding: hideTimer !== null });
  if (step.cancelHide) { clearTimeout(hideTimer); hideTimer = null; }
  if (step.show) {
    if (!snap || snap.lineId !== s.lineId || snap.start !== s.start || snap.text !== s.text) summaryOk = undefined;
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

/**
 * 목록 데이터에서 단추를 (다시) 그린다. 같은 칸이면 속성만 고친다. `[11-2]` 보이는 칸은 `#selActions`, `more` 칸은
 * `[⋯]` 메뉴 `#selMore`(`role="menuitem"`) — 장치(위임 리스너 `data-sel-action`)는 하나.
 */
function render(s) {
  const model = withSummary(selBarModel(actions, s, { links: queryLinkCount() }), summaryOk);
  const inMenu = !!els.menu && !!els.moreBtn;
  const bar = inMenu ? model.filter((m) => !m.more) : model;
  const menu = inMenu ? model.filter((m) => m.more) : [];
  paintButtons(els.list, bar, false);
  if (inMenu) {
    paintButtons(els.menu, menu, true);
    els.moreBtn.hidden = !moreVisible(model);
  }
}

function paintButtons(host, model, item) {
  if (host.children.length !== model.length || Array.from(host.children).some((b, i) => b.getAttribute('data-sel-action') !== model[i].id)) {
    while (host.firstChild) host.removeChild(host.firstChild);
    for (const m of model) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = item ? 'sel-btn sel-more-item' : 'sel-btn';
      b.setAttribute('data-sel-action', m.id);
      b.setAttribute('data-i18n', m.key);
      if (item) { b.setAttribute('role', 'menuitem'); b.tabIndex = -1; }
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

/* ── `[11-2]` `[⋯]` 메뉴 — 18 목록과 같은 꼴(줄 위 · 창 붙잡기 Esc · 바깥 누름이면 닫힘 · 화살표) ── */

/** 메뉴를 연다 — 그때 [요약] 흐림을 잰다(호출 0). `byKey` 면 첫 칸에 포커스. */
function openMore(byKey) {
  if (!els || !els.menu || !els.moreBtn || more) return;
  closeLookupMenu(true);
  // 손가락으로 `[⋯]` 를 누르는 순간 선택이 풀려 거두기가 예약됐을 수 있다 — 메뉴가 떠 있는 동안은 거두지 않는다(update 의 규칙).
  if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
  if (snap && deps && typeof deps.canSummarize === 'function') {
    try { summaryOk = !!deps.canSummarize(Object.assign({}, snap)); } catch (e) { summaryOk = undefined; }
  }
  render(snap);
  try {
    const top = els.bar.getBoundingClientRect().top;
    els.menu.style.maxBlockSize = Math.max(96, Math.floor(top - 8)) + 'px';
  } catch (e) { /* 그대로 */ }
  const keyFn = (ev) => onMoreKey(ev);
  const downFn = (ev) => { if (more && !els.bar.contains(ev.target)) closeMore(false); };
  more = { keyFn: keyFn, downFn: downFn };
  els.menu.hidden = false;
  els.moreBtn.setAttribute('aria-expanded', 'true');
  window.addEventListener('keydown', keyFn, true);        // 띠(document 캡처)·시트보다 먼저 — Esc 는 메뉴만 닫는다(18 목록과 같은 층)
  document.addEventListener('pointerdown', downFn, true);
  const items = menuItems();
  items.forEach((b, k) => { b.tabIndex = k === 0 ? 0 : -1; });
  if (byKey && items[0]) items[0].focus();
}

/** 메뉴를 닫는다. `back` 이면 포커스를 `[⋯]` 로(Esc). */
function closeMore(back) {
  if (!more) return;
  const m = more;
  more = null;
  window.removeEventListener('keydown', m.keyFn, true);
  document.removeEventListener('pointerdown', m.downFn, true);
  if (els && els.menu) els.menu.hidden = true;
  if (els && els.moreBtn) {
    els.moreBtn.setAttribute('aria-expanded', 'false');
    if (back) { try { els.moreBtn.focus(); } catch (e) { /* 그대로 */ } }
  }
}

function menuItems() {
  return els && els.menu ? Array.from(els.menu.querySelectorAll('button[data-sel-action]')).filter((b) => !b.hidden) : [];
}

function onMoreKey(ev) {
  if (!more) return;
  if (ev.key === 'Escape' || ev.key === 'Esc') {
    if (ev.isComposing) return;
    ev.preventDefault();
    ev.stopPropagation();
    closeMore(true);
    return;
  }
  if (!els.menu.contains(ev.target)) return;
  const items = menuItems();
  const i = items.indexOf(ev.target);
  let j = -1;
  if (ev.key === 'ArrowDown') j = (i + 1) % items.length;
  else if (ev.key === 'ArrowUp') j = (i - 1 + items.length) % items.length;
  else if (ev.key === 'Home') j = 0;
  else if (ev.key === 'End') j = items.length - 1;
  else if (ev.key === 'Tab') { closeMore(false); return; }
  if (j < 0) return;
  ev.preventDefault();
  items.forEach((b, k) => { b.tabIndex = k === j ? 0 : -1; });
  items[j].focus();
}

function show() {
  attachDebugHook();                     // `[11-2]` main.js 가 부팅 끝에 전역 객체를 새로 만든다 — 줄이 뜰 때 다시 붙인다(있으면 그대로)
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
  closeMore(false);                      // `[11-2]` `[⋯]` 메뉴도
  snap = null;
  summaryOk = undefined;
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
  closeMore(false);
  while (els.list.firstChild) els.list.removeChild(els.list.firstChild);
  if (els.menu) while (els.menu.firstChild) els.menu.removeChild(els.menu.firstChild);
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
  // `[11-2]` `[⋯]` — 메뉴를 열고 닫는다(키보드로 열면 첫 칸에 포커스).
  const mb = ev.target && ev.target.closest ? ev.target.closest('#selMoreBtn') : null;
  if (mb && els.bar.contains(mb)) {
    if (more) closeMore(false); else if (snap) openMore(ev.detail === 0);
    return;
  }
  const b = ev.target && ev.target.closest ? ev.target.closest('button[data-sel-action]') : null;
  if (!b || !els.bar.contains(b) || b.hidden) return;
  const id = b.getAttribute('data-sel-action');
  const inMenu = !!els.menu && els.menu.contains(b);
  if (inMenu) closeMore(false);          // 메뉴 칸을 골랐다 — 메뉴는 닫는다(18 목록·한 줄 안내는 줄 위에 그대로)
  if (b.getAttribute('aria-disabled') === 'true') {
    if (els.note) { els.note.textContent = t(b.getAttribute('data-sel-note') || 'sel.tooLong'); els.note.hidden = false; }
    return;
  }
  const s = snap;
  if (!s) return;
  if (id === 'lookup') {
    // `[18 — spec 17-9]` 새 탭은 **이 누름 안에서 곧바로**(팝업 차단을 피한다) — controls 보다 먼저. 낭독은 건드리지 않는다.
    // `[11-2]` 메뉴 안에서 골랐으면 목록을 닫을 때 포커스는 `[⋯]` 로(고른 칸은 메뉴와 함께 숨었다).
    let r = 'none';
    try {
      r = lookup(s.text, els.bar, { back: inMenu && els.moreBtn ? els.moreBtn : b, byKey: ev.detail === 0, onClose: onSelectionChange });
    } catch (e) { /* 열지 못해도 줄은 남는다 */ }
    if (r === 'tooLong' && els.note) { els.note.textContent = t('links.tooLong'); els.note.hidden = false; }
    if (r === 'menu' && hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }   // 목록이 떠 있는 동안은 거두지 않는다
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
        buttons: Array.from(els.list.children).map((b) => ({ id: b.getAttribute('data-sel-action'), hidden: b.hidden })),
        // `[11-2]` `[⋯]` 메뉴 — 보이는가·열렸나·칸(이름·숨김·흐림)·[요약] 판정
        more: els.moreBtn ? { shown: !els.moreBtn.hidden, open: !!more, expanded: els.moreBtn.getAttribute('aria-expanded'),
          items: els.menu ? Array.from(els.menu.children).map((b) => ({ id: b.getAttribute('data-sel-action'), hidden: b.hidden,
            disabled: b.getAttribute('aria-disabled') === 'true' })) : [] } : null,
        summaryOk: summaryOk === undefined ? null : summaryOk };
    },
    /** `[11-2]` 측정용 — `[⋯]` 메뉴를 연다/닫는다(누름 없이). */
    openMore: function (byKey) { openMore(!!byKey); return !!more; },
    closeMore: function () { closeMore(false); return !more; }
  };
}

/** 리더에 다시 들어올 때 디버그 훅을 다시 붙인다(`main.js` 가 전역 객체를 새로 만든다 — controls 와 같은 이유). */
export function reattach() { attachDebugHook(); }
