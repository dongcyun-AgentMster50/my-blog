/* ============================================================
   MedReader — 리플로우 뷰 (spec 12-3 · 12-4 · 16-F)

   3단계가 남긴 `main.js` 의 `showReaderPlaceholder` 가 여기로 옮겨 왔다.
   라우터는 `#/reader/:docId/:page` 를 주고, 이 모듈이 그 한 쪽을 그린다.

   ── 문단을 그리는 길 (9-2) ──────────────────────────────
     `db.get('pages', [docId, pageNo])` → `fromStored(rec)` → `paragraphs[].text`

   저장본에는 `paragraphs[].text` 가 **없다**. `fromStored` 가 `lineIds` 와
   4-10 하이픈 규칙으로 매번 다시 조립한다. 줄 텍스트를 직접 이어 붙이면
   `cardio-` + `vascular` 가 `cardio- vascular` 로 새고, 사용자가 읽는 것은
   원서와 다른 글자가 된다. **`fromStored` 를 거치지 않는 경로를 만들지 마라.**

   ── 12-4 DOM 과 5단계의 앵커 ────────────────────────────
     article.reflow[dir=ltr][lang=en]
     └ section.page[data-page]
       ├ h2.page-label
       ├ p.para[data-para-id][data-kind]
       │  └ span.line[data-line-id][data-flow="1"]   ← ★ 6-5 하이라이트 앵커
       ├ figure.table-fallback[data-region-id]       ← 6단계가 크롭 이미지를 넣는다
       └ details.folded > span.line[data-flow="0"]   ← 머리말·꼬리말·쪽번호·회전 줄

   **`span.line` 이 5단계의 앵커다.** 줄 경계를 잃으면 하이라이트가 붙을 곳이
   없어진다. 하이픈으로 결합된 줄도 span 은 둘로 남기고, 보이지 않을 `-` 만
   `span.hy` 로 감싸 CSS 로 숨긴다(12-4). 낭독은 **`data-flow="1"` 인 줄만**
   돈다 — `flowLineIds()` 가 그 순서를 준다.

   ── 11-3 ────────────────────────────────────────────────
   본문 컨테이너는 `dir="ltr" lang="en"` 고정이다. UI 가 아랍어여도 원서
   본문은 LTR 이다. 번역 블록(8단계)만 RTL 로 들어간다.

   ── 7000쪽 ──────────────────────────────────────────────
   한 번에 **한 쪽만** DOM 에 둔다. 쪽을 넘기면 이전 DOM 을 통째로 버린다.
   ============================================================ */

import * as db from '../db.js';
import * as settings from '../settings.js';
import { t, applyTranslations, formatNumber, onLangChange } from '../i18n/index.js';
import { fromStored } from '../text/store.js';
import { joinHyphen } from '../text/hyphen.js';
import { go, replace, readerHash, libraryHash } from '../router.js';
import { openDoc, extractorFor } from './library.js';
import { initTypeset, closeTypeset, syncControls } from './typeset.js';
import { initControls, leaveControls } from './controls.js';
import { TTS } from '../config.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분 — tests/reader.test.mjs 가 고정한다.
   ──────────────────────────────────────────────────────── */

/**
 * 4-7 의 비본문 역할. 이 줄들은 문단에 들어가지 않고 `details` 로 접힌다
 * (4-7 오판의 복구 수단 — 본문이 머리말로 잘못 판정돼도 사용자가 펼쳐 볼 수 있다).
 *
 * ★ `rotated` 줄의 `bbox` 는 신뢰할 수 없다(Review 주의사항 5 — `lineBBox` 가
 *   90° 회전 아이템의 `width` 를 수평 폭으로 더한다). 그래서 이 뷰는 어떤
 *   줄의 좌표도 쓰지 않는다. **텍스트만** 그린다.
 */
export const FOLD_ROLES = Object.freeze(['header', 'footer', 'pageno', 'rotated']);

/** 쪽 번호는 1..pageCount 안으로 접는다. 쪽수를 모르면 1 이상만 본다. */
export function clampPage(page, pageCount) {
  const n = Math.floor(Number(page));
  const max = Math.floor(Number(pageCount)) || 0;
  if (!Number.isFinite(n) || n < 1) return 1;
  if (max >= 1 && n > max) return max;
  return n;
}

/**
 * `fromStored` 로 되살린 `PageLayout` → **DOM 기술(記述)**. 순수 함수다.
 *
 * 블록 셋:
 *   { type:'para',   id, kind, lines:[{id, text, hyphen:'none'|'hidden'|'kept'}] }
 *   { type:'table',  regionId, kind }
 *   { type:'folded', lines:[{id, text, role}] }
 *
 * 순서는 **읽기 순서**다 — `lines` 는 4-5 가 이미 컬럼 순서로 정렬해 두었으므로
 * 줄을 훑으며 처음 만나는 문단·표를 그 자리에 낸다. 접히는 줄은 모아서 맨 뒤에
 * 한 덩어리로 둔다(12-4 의 `details.folded`).
 *
 * `hyphen` 은 **줄 사이를 어떻게 이을지**다:
 *   'hidden' — 하이픈을 지우고 붙인다(`cardio-` + `vascular` → cardiovascular).
 *              끝의 `-` 를 `span.hy` 로 감춰 시각만 결합한다.
 *   'kept'   — 하이픈을 살려 붙인다(`methicillin-` + `resistant`).
 *   'none'   — 공백으로 잇는다.
 * 판정은 `fromStored` 가 문단 텍스트를 만들 때 쓴 것과 **같은 함수**(`joinHyphen`)다.
 * 그래서 화면 글자와 `paragraphs[].text` 가 어긋날 수 없다(테스트가 고정한다).
 */
export function describePage(layout) {
  const L = layout || {};
  const lines = Array.isArray(L.lines) ? L.lines : [];
  const paragraphs = Array.isArray(L.paragraphs) ? L.paragraphs : [];
  const regions = Array.isArray(L.regions) ? L.regions : [];

  const lineById = new Map();
  for (let i = 0; i < lines.length; i++) lineById.set(lines[i].id, lines[i]);

  const paraById = new Map();
  for (let i = 0; i < paragraphs.length; i++) paraById.set(paragraphs[i].id, paragraphs[i]);

  const regionById = new Map();
  const regionOfLine = new Map();
  for (let i = 0; i < regions.length; i++) {
    const g = regions[i];
    regionById.set(g.id, g);
    const ids = Array.isArray(g.lineIds) ? g.lineIds : [];
    for (let k = 0; k < ids.length; k++) regionOfLine.set(ids[k], g.id);
  }

  const foldSet = new Set(FOLD_ROLES);
  const blocks = [];
  const folded = [];
  const doneParas = new Set();
  const doneRegions = new Set();

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const regionId = regionOfLine.get(l.id) || l.regionId || null;

    if (regionId) {
      if (!doneRegions.has(regionId)) {
        doneRegions.add(regionId);
        const g = regionById.get(regionId);
        blocks.push({ type: 'table', regionId: regionId, kind: (g && g.kind) || 'table' });
      }
      continue;
    }

    if (foldSet.has(l.role)) {
      folded.push({ id: l.id, text: textOf(l), role: l.role });
      continue;
    }

    if (l.paraId && paraById.has(l.paraId)) {
      if (!doneParas.has(l.paraId)) {
        doneParas.add(l.paraId);
        blocks.push(paraBlock(paraById.get(l.paraId), lineById));
      }
      continue;
    }

    // 문단에 속하지 않은 본문 줄 — 잃어버리지 않는다. 한 줄짜리 문단으로 낸다.
    if (textOf(l)) blocks.push({ type: 'para', id: null, kind: 'body', lines: [{ id: l.id, text: textOf(l), hyphen: 'none' }] });
  }

  // 줄 목록에 없는 문단(저장본이 깨진 경우) — 조용히 버리지 않고 뒤에 붙인다.
  for (let i = 0; i < paragraphs.length; i++) {
    if (!doneParas.has(paragraphs[i].id)) {
      const b = paraBlock(paragraphs[i], lineById);
      if (b.lines.length) blocks.push(b);
    }
  }

  if (folded.length) blocks.push({ type: 'folded', lines: folded });

  return { pageNo: L.pageNo, blocks: blocks };
}

/** 기술된 블록들에서 **낭독이 도는 줄**의 id 를 읽기 순서로 뽑는다(5단계 계약). */
export function flowLineIdsOf(desc) {
  const out = [];
  const blocks = (desc && desc.blocks) || [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type !== 'para') continue;
    const ls = blocks[i].lines;
    for (let k = 0; k < ls.length; k++) out.push(ls[k].id);
  }
  return out;
}

function paraBlock(p, lineById) {
  const out = [];
  const ids = Array.isArray(p.lineIds) ? p.lineIds : [];
  for (let i = 0; i < ids.length; i++) {
    const l = lineById.get(ids[i]);
    if (!l) continue;                        // 저장본이 깨진 줄은 건너뛴다(fromStored 와 같은 태도)
    out.push({ id: l.id, text: textOf(l), hyphen: 'none' });
  }
  for (let i = 0; i < out.length - 1; i++) {
    const r = joinHyphen(out[i].text, out[i + 1].text);
    out[i].hyphen = r.hyphenJoin ? 'hidden' : (r.keptHyphen ? 'kept' : 'none');
  }
  return { type: 'para', id: p.id, kind: p.kind || 'body', lines: out };
}

function textOf(l) { return String((l && l.text) || '').trim(); }

/* ────────────────────────────────────────────────────────
   2. 상태 — 한 번에 한 쪽. 이전 쪽은 DOM 에서 버린다.
   ──────────────────────────────────────────────────────── */

let els = null;
const state = {
  docId: null,
  page: 1,
  pageCount: 0,
  doc: null,
  desc: null,
  currentLineId: null,
  /** 지금 이벤트를 듣고 있는 Extractor 와 해제 함수들 */
  wired: { docId: null, ex: null, off: [] },
  progress: null,
  /** 렌더 경쟁 방지 — 늦게 끝난 옛 렌더가 새 쪽을 덮어쓰지 않는다. */
  renderToken: 0,

  /* ── 6-5 자동 스크롤 ─────────────────────────────── */
  /** 지금 하이라이트된 줄들(문장 모드에서는 여럿). */
  currentLineIds: [],
  /** 마지막으로 **우리가** 스크롤한 시각 — 사용자 스크롤과 구분한다(최근 800ms). */
  programScrollAt: 0,
  /** 사용자가 직접 스크롤해 자동 스크롤을 쉬는 중인가. */
  scrollPaused: false,
  /** 자동 스크롤 복구 판정용 — 문단이 바뀌면 되살린다. */
  lastParaId: null
};

/** 줄 탭 구독자(`ui/controls.js`). 리더가 `speaker` 를 직접 import 하지 않는다. */
const lineTapListeners = new Set();
/** 쪽이 새로 그려졌다는 알림 구독자. */
const pageListeners = new Set();

export function onLineTap(fn) { lineTapListeners.add(fn); return () => lineTapListeners.delete(fn); }
export function onPageRender(fn) { pageListeners.add(fn); return () => pageListeners.delete(fn); }

export function initReader() {
  const root = document.querySelector('[data-screen="reader"]');
  if (!root) return;
  els = {
    root: root,
    title: root.querySelector('#readerTitle'),
    mount: root.querySelector('#readerMount'),
    progress: root.querySelector('#readerProgress'),
    progressLabel: root.querySelector('#readerProgressLabel'),
    progressFill: root.querySelector('#readerProgressFill'),
    pager: root.querySelector('#readerPager'),
    prev: root.querySelector('#pagePrev'),
    next: root.querySelector('#pageNext'),
    input: root.querySelector('#pageInput'),
    total: root.querySelector('#pageTotal'),
    backToLine: root.querySelector('#backToLine')
  };

  initTypeset();
  // 12-3 하단 컨트롤 바. 이 화면 안에서만 산다 — `main.js` 를 건드리지 않는다.
  initControls();

  els.prev.addEventListener('click', () => goPage(state.page - 1));
  els.next.addEventListener('click', () => goPage(state.page + 1));
  // 숫자 입력 — change(포커스 이탈·Enter)에서만 이동한다. 타이핑마다 이동하면
  // "7" 을 치는 순간 7쪽으로 튄다.
  els.input.addEventListener('change', () => goPage(els.input.value));
  els.input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); goPage(els.input.value); }
  });

  /* ── 6-5 줄 탭 ──────────────────────────────────────
     낭독 중이면 **그 줄부터 이동**. 낭독 중이 아니면 이 단계는 아무 것도
     하지 않는다 — 인라인 번역은 7단계 몫이다(6-5). 구독자가 판단한다.

     `click` 이 아니라 `pointerup` 을 쓰는 이유는 12-3 이 길게 누르기(번역)를
     예고하기 때문이다. 지금은 길게 누르기를 잡지 않는다(7단계). */
  els.mount.addEventListener('pointerup', (ev) => {
    const span = ev.target && ev.target.closest ? ev.target.closest('span.line[data-flow="1"]') : null;
    if (!span) return;
    // 글자를 드래그해 선택하는 중이면 탭이 아니다.
    const sel = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null;
    if (sel && String(sel).length > 0) return;
    const id = span.getAttribute('data-line-id');
    for (const fn of lineTapListeners) { try { fn(id); } catch (e) { /* 구독자 예외가 리더를 막지 않는다 */ } }
  });

  /* ── 6-5 사용자 스크롤 감지 ────────────────────────
     프로그램 스크롤과 사용자 스크롤을 **최근 800ms** 로 가른다. 우리가
     `scrollIntoView` 를 부르면 `scroll` 이벤트가 줄줄이 따라오는데, 그것을
     사용자 스크롤로 읽으면 자동 스크롤이 자기 자신 때문에 꺼진다. */
  window.addEventListener('scroll', onAnyScroll, { passive: true });

  els.backToLine.addEventListener('click', () => {
    state.scrollPaused = false;
    hideBackChip();
    scrollToCurrent(true);
  });

  // 언어가 바뀌면 이 화면의 동적 문장도 다시 만든다(16-H — 새로고침 없이).
  onLangChange(() => relabelReader());
}

function onAnyScroll() {
  if (!els || els.root.hidden) return;
  if (!state.currentLineIds.length) return;
  if (Date.now() - state.programScrollAt < TTS.USER_SCROLL_MS) return;   // 우리가 굴린 것
  if (state.scrollPaused) return;
  state.scrollPaused = true;
  showBackChip();
}

/**
 * 라우터의 `case 'reader'` 가 부른다. `params.docId`·`params.page` 는
 * `parseRoute` 가 이미 다듬어 준 값이다.
 */
export async function showReader(params) {
  if (!els) return;
  const docId = params && params.docId;
  if (!docId) { go(libraryHash()); return; }

  let doc = null;
  try {
    doc = await db.get('documents', docId);
  } catch (e) {
    banner(e, db.ERR.OPEN);
    return;
  }
  if (!doc) { go(libraryHash()); return; }

  const pageCount = Number(doc.pageCount) || 0;
  const wanted = clampPage(params.page, pageCount);
  if (wanted !== Number(params.page)) {
    // 범위 밖 딥링크 — 히스토리를 더럽히지 않고 정규화한다. replace 가
    // 라우터를 다시 돌려 이 함수가 곧바로 올바른 쪽으로 다시 불린다.
    replace(readerHash(docId, wanted));
    return;
  }

  const docChanged = state.docId !== docId;
  state.docId = docId;
  state.doc = doc;
  state.pageCount = pageCount;
  state.page = wanted;
  if (docChanged) state.progress = null;

  els.title.textContent = doc.title || doc.fileName || '';
  paintPager();
  paintProgressBar();

  await renderPage();
  await saveLastPage();

  // 백그라운드 추출을 되살린다(9-4). pdf.js 로드가 화면을 붙잡지 않도록
  // 그리기가 끝난 뒤에 부른다.
  wireExtractor(docId).catch((e) => banner(e, 'ERR_UNKNOWN'));
}

/** 리더를 떠날 때 — 팝오버를 닫고 DOM 을 비운다(7000쪽 메모리). */
export function leaveReader() {
  closeTypeset();
  // 리더를 떠나면 낭독도 멈춘다 — 서재에서 소리가 계속 나면 안 된다.
  leaveControls();
  if (els && els.mount) clear(els.mount);
  state.desc = null;
  state.currentLineId = null;
  state.currentLineIds = [];
  state.lastParaId = null;
  state.scrollPaused = false;
  hideBackChip();
}

/* ────────────────────────────────────────────────────────
   3. 쪽 그리기
   ──────────────────────────────────────────────────────── */

async function renderPage() {
  const token = ++state.renderToken;
  const docId = state.docId;
  const pageNo = state.page;

  let rec = null;
  try {
    rec = await db.get('pages', [docId, pageNo]);
  } catch (e) {
    banner(e, db.ERR.OPEN);
    return;
  }
  // 그 사이 사용자가 다른 쪽으로 갔다면 이 결과는 버린다.
  if (token !== state.renderToken) return;

  clear(els.mount);
  state.currentLineId = null;
  state.currentLineIds = [];

  if (!rec) {
    // 아직 추출되지 않은 쪽 — **빈 화면을 보여주지 않는다**(12-3).
    state.desc = null;
    els.mount.appendChild(preparingBlock());
    return;
  }

  let desc = null;
  try {
    desc = describePage(fromStored(rec));
  } catch (e) {
    // 저장본이 깨졌어도 리더가 죽지는 않는다. 9-4 가 그 쪽을 다시 뽑는다.
    state.desc = null;
    els.mount.appendChild(noticeBlock('reader.page.broken'));
    return;
  }
  state.desc = desc;
  els.mount.appendChild(renderDescription(desc));
  notifyPage();
}

/** 새 쪽이 그려졌다 — 낭독 큐가 이 쪽 것으로 갈아탄다(`ui/controls.js`). */
function notifyPage() {
  for (const fn of pageListeners) {
    try { fn({ docId: state.docId, page: state.page }); } catch (e) { /* 구독자 예외 */ }
  }
}

/** 12-4 의 DOM 을 만든다. 문서 텍스트는 전부 `textContent` 다(13절 XSS). */
function renderDescription(desc) {
  const article = el('article', 'reflow');
  // 11-3 — UI 가 아랍어여도 원서 본문은 LTR·en 이다.
  article.setAttribute('dir', 'ltr');
  article.setAttribute('lang', 'en');

  const section = el('section', 'page');
  section.setAttribute('data-page', String(desc.pageNo));

  const label = el('h2', 'page-label');
  label.textContent = t('reader.pageLabel', { page: formatNumber(desc.pageNo) });
  section.appendChild(label);

  const blocks = desc.blocks || [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === 'para') section.appendChild(paraEl(b));
    else if (b.type === 'table') section.appendChild(tableEl(b));
    else if (b.type === 'folded') section.appendChild(foldedEl(b));
  }

  if (!blocks.length) section.appendChild(noticeBlock('reader.page.empty'));

  article.appendChild(section);
  return article;
}

function paraEl(b) {
  const p = el('p', 'para');
  if (b.id) p.setAttribute('data-para-id', b.id);
  p.setAttribute('data-kind', b.kind || 'body');
  for (let i = 0; i < b.lines.length; i++) {
    const ln = b.lines[i];
    p.appendChild(lineEl(ln, 1));
    // 12-4 — 하이픈으로 이어지는 줄 사이에는 공백 노드를 두지 않는다.
    const last = i === b.lines.length - 1;
    if (!last && ln.hyphen === 'none') p.appendChild(document.createTextNode(' '));
  }
  return p;
}

/**
 * `span.line[data-line-id]` — **5단계 하이라이트의 앵커**(6-5).
 * `data-flow="1"` 인 줄만 낭독이 돈다. 접힌 줄은 `0` 이다.
 */
function lineEl(ln, flow) {
  const span = el('span', 'line');
  span.setAttribute('data-line-id', ln.id);
  span.setAttribute('data-flow', flow ? '1' : '0');
  if (ln.role) span.setAttribute('data-role', ln.role);

  if (ln.hyphen === 'hidden' && ln.text.endsWith('-')) {
    // 원본 텍스트는 그대로 두고 시각만 결합한다(12-4).
    span.appendChild(document.createTextNode(ln.text.slice(0, -1)));
    const hy = el('span', 'hy');
    hy.textContent = '-';
    span.appendChild(hy);
  } else {
    span.textContent = ln.text;
  }
  return span;
}

/**
 * 표 region — 이 단계는 크롭 이미지를 만들지 않는다(6단계). `data-region-id` 를
 * 남겨 6단계가 이 자리를 찾을 수 있게 한다.
 */
function tableEl(b) {
  const fig = el('figure', 'table-fallback');
  fig.setAttribute('data-region-id', b.regionId);
  const cap = el('figcaption');
  cap.setAttribute('data-i18n', 'reader.table.placeholder');
  cap.textContent = t('reader.table.placeholder');
  fig.appendChild(cap);
  const btn = el('button', 'link');
  btn.type = 'button';
  btn.disabled = true;                       // 6단계가 켠다
  btn.setAttribute('data-action', 'original');
  btn.setAttribute('data-i18n', 'reader.table.viewOriginal');
  btn.textContent = t('reader.table.viewOriginal');
  fig.appendChild(btn);
  return fig;
}

/** 머리말·꼬리말·쪽번호·회전 줄 — 접어서 옅게. 탭하면 펼쳐진다(4-7 복구 수단). */
function foldedEl(b) {
  const d = el('details', 'folded');
  const sum = el('summary');
  sum.setAttribute('data-i18n', 'reader.folded.summary');
  sum.textContent = t('reader.folded.summary');
  d.appendChild(sum);
  const body = el('p', 'folded-lines');
  for (let i = 0; i < b.lines.length; i++) {
    body.appendChild(lineEl(b.lines[i], 0));
    if (i < b.lines.length - 1) body.appendChild(document.createTextNode(' '));
  }
  d.appendChild(body);
  return d;
}

/** "텍스트 준비 중 312/729" — 빈 화면 대신(12-3). */
function preparingBlock() {
  const box = el('div', 'page-preparing');
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');

  const p = el('p', 'preparing-label');
  p.id = 'preparingLabel';
  p.textContent = preparingText();
  box.appendChild(p);

  const track = el('div', 'progress-track');
  const fill = el('div', 'progress-fill');
  fill.style.inlineSize = preparingPercent() + '%';
  track.appendChild(fill);
  box.appendChild(track);
  return box;
}

function preparingText() {
  const pr = liveProgress();
  if (!pr || !Number(pr.pageCount)) return t('reader.preparing.unknown');
  return t('reader.preparing', {
    done: formatNumber(Number(pr.pagesDone) || 0),
    total: formatNumber(Number(pr.pageCount) || 0)
  });
}

function preparingPercent() {
  const pr = liveProgress();
  const total = (pr && Number(pr.pageCount)) || 0;
  const done = (pr && Number(pr.pagesDone)) || 0;
  return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
}

/** 살아 있는 추출 진행. 없으면 문서에 저장된 `extraction` 을 읽는다(9-4). */
function liveProgress() {
  if (state.progress) return state.progress;
  const doc = state.doc;
  if (!doc) return null;
  const ex = doc.extraction || {};
  return {
    pagesDone: Number(ex.pagesDone) || 0,
    pageCount: Number(doc.pageCount) || 0,
    done: !!ex.done
  };
}

function noticeBlock(key) {
  const p = el('p', 'muted page-notice');
  p.setAttribute('data-i18n', key);
  p.textContent = t(key);
  return p;
}

/* ────────────────────────────────────────────────────────
   4. 쪽 이동 — 라우트가 정본이다(뒤로가기가 동작해야 한다).
   ──────────────────────────────────────────────────────── */

function goPage(v) {
  const next = clampPage(v, state.pageCount);
  if (next === state.page) { paintPager(); return; }   // 입력창의 잘못된 값을 되돌린다
  go(readerHash(state.docId, next));
}

function paintPager() {
  els.input.value = String(state.page);
  els.input.min = '1';
  if (state.pageCount > 0) els.input.max = String(state.pageCount);
  els.total.textContent = t('reader.page.of', {
    page: formatNumber(state.page),
    total: state.pageCount ? formatNumber(state.pageCount) : '—'
  });
  els.prev.disabled = state.page <= 1;
  els.next.disabled = state.pageCount > 0 && state.page >= state.pageCount;
}

/** 9-2 — 마지막 읽은 위치. 서재의 [이어 읽기]가 이 필드를 읽는다. */
async function saveLastPage() {
  const docId = state.docId;
  const page = state.page;
  const lineId = state.currentLineId || firstFlowLineId();
  try {
    const doc = await db.get('documents', docId);
    if (!doc) return;
    if (Number(doc.lastPage) === page && doc.lastLineId === lineId) return;
    doc.lastPage = page;
    doc.lastLineId = lineId;
    await db.put('documents', doc);
    state.doc = doc;
  } catch (e) {
    // 위치 저장 실패로 읽기를 막지 않는다. 다음 쪽에서 다시 시도된다.
  }
}

function firstFlowLineId() {
  const ids = state.desc ? flowLineIdsOf(state.desc) : [];
  return ids.length ? ids[0] : null;
}

/* ────────────────────────────────────────────────────────
   5. 추출기 배선 — 지금 보고 있는 쪽을 우선순위로 올린다(9-4).
   ──────────────────────────────────────────────────────── */

async function wireExtractor(docId) {
  const ex = await openDoc(docId) || extractorFor(docId);
  if (!ex) return;
  if (state.docId !== docId) return;          // 그 사이 다른 문서로 갔다

  if (state.wired.ex !== ex) {
    unwire();
    const onProgress = (e) => {
      state.progress = e.detail;
      paintProgressBar();
      paintPreparing();
    };
    const onPage = (e) => {
      // 지금 보고 있는 쪽이 방금 준비됐다 — 자리표시자를 진짜 본문으로 바꾼다.
      if (Number(e.detail.pageNo) === state.page && !state.desc) renderPage();
    };
    ex.addEventListener('progress', onProgress);
    ex.addEventListener('page', onPage);
    state.wired = {
      docId: docId, ex: ex,
      off: [
        () => ex.removeEventListener('progress', onProgress),
        () => ex.removeEventListener('page', onPage)
      ]
    };
  }
  ex.setCurrentPage(state.page);
}

function unwire() {
  const offs = state.wired.off || [];
  for (let i = 0; i < offs.length; i++) { try { offs[i](); } catch (e) { /* 이미 사라진 리스너 */ } }
  state.wired = { docId: null, ex: null, off: [] };
}

function paintProgressBar() {
  const pr = liveProgress();
  const hide = !pr || !pr.pageCount || pr.done;
  els.progress.hidden = !!hide;
  if (hide) return;
  els.progressLabel.textContent = t('reader.preparing', {
    done: formatNumber(Number(pr.pagesDone) || 0),
    total: formatNumber(Number(pr.pageCount) || 0)
  });
  els.progressFill.style.inlineSize = preparingPercent() + '%';
}

function paintPreparing() {
  const label = els.mount.querySelector('#preparingLabel');
  if (!label) return;
  label.textContent = preparingText();
  const fill = els.mount.querySelector('.page-preparing .progress-fill');
  if (fill) fill.style.inlineSize = preparingPercent() + '%';
}

/* ────────────────────────────────────────────────────────
   6. 5단계(TTS)가 쓸 계약 — 하이라이트 앵커
   ──────────────────────────────────────────────────────── */

/** 지금 화면에 있는 **낭독 대상** 줄 id 를 읽기 순서로. */
export function flowLineIds() {
  return state.desc ? flowLineIdsOf(state.desc) : [];
}

/** `lineId` 의 `span.line` 요소. 없으면 null. */
export function lineElement(lineId) {
  if (!els || !els.mount || lineId == null) return null;
  const list = els.mount.querySelectorAll('span.line[data-flow="1"]');
  for (let i = 0; i < list.length; i++) {
    if (list[i].getAttribute('data-line-id') === String(lineId)) return list[i];
  }
  return null;
}

/**
 * 6-5 — 현재 줄 하이라이트. 이전 `.is-current` 를 떼고 새 줄에 붙인다.
 * 자동 스크롤은 **5단계의 몫**이다(편안 영역 규칙·사용자 스크롤 해제).
 * @returns {boolean} 그 줄이 지금 화면에 있었는가
 */
export function setCurrent(lineId) {
  if (!els || !els.mount) return false;
  const prev = els.mount.querySelector('span.line.is-current');
  if (prev) prev.classList.remove('is-current');
  const next = lineElement(lineId);
  if (!next) return false;
  next.classList.add('is-current');
  state.currentLineId = String(lineId);
  state.currentLineIds = [String(lineId)];
  return true;
}

/** 5단계가 "이 줄까지 읽었다"를 표시할 때. 설정 `reader.showDone` 을 따른다. */
export function markDone(lineId, on) {
  if (!settings.get('reader.showDone')) return;
  const elx = lineElement(lineId);
  if (elx) elx.classList.toggle('is-done', on !== false);
}

export function currentPage() { return { docId: state.docId, page: state.page, pageCount: state.pageCount }; }

/**
 * ★ 5단계 낭독 큐의 입력. 지금 쪽의 **문단**을 읽기 순서로 준다.
 * `lines[i].hyphen` 이 "다음 줄과 어떻게 잇는가"이고, `tts/text.js` 가 그것으로
 * `cardio-` 의 `-` 를 털어 한 발화로 묶는다.
 */
export function flowParas() {
  const blocks = (state.desc && state.desc.blocks) || [];
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type !== 'para') continue;
    out.push({ id: blocks[i].id, kind: blocks[i].kind, lines: blocks[i].lines });
  }
  return out;
}

/**
 * 6-5 — 문장이 걸친 **모든 줄**에 하이라이트를 준다. 문장 모드가 기본이라
 * 한 발화가 원본 줄 3~4개에 걸친다(2단 조판이라 줄이 8~10낱말로 짧다).
 * @returns {boolean} 그 줄들이 지금 쪽에 있었는가
 */
export function setCurrentLines(lineIds) {
  if (!els || !els.mount) return false;
  const ids = Array.isArray(lineIds) ? lineIds : [lineIds];

  const prev = els.mount.querySelectorAll('span.line.is-current');
  for (let i = 0; i < prev.length; i++) prev[i].classList.remove('is-current');

  let first = null;
  for (let i = 0; i < ids.length; i++) {
    const node = lineElement(ids[i]);
    if (!node) continue;
    node.classList.add('is-current');
    if (!first) first = node;
  }
  if (!first) return false;
  state.currentLineIds = ids.map(String);
  state.currentLineId = String(ids[0]);
  return true;
}

/**
 * 낭독이 한 발화로 옮겨 갈 때 화면이 하는 일 전부: 하이라이트 + 자동 스크롤.
 * @param {{lineIds: string[], paraId: string|null}} unit
 */
export function showSpoken(unit) {
  const u = unit || {};
  const ok = setCurrentLines(u.lineIds || []);
  if (!ok) return false;

  // 6-5 — 문단이 바뀌면 자동 스크롤을 되살린다(사용자가 딴 데를 보다가도
  // 새 문단에서는 따라가고 싶어 한다).
  if (u.paraId != null && u.paraId !== state.lastParaId) {
    state.lastParaId = u.paraId;
    if (state.scrollPaused) { state.scrollPaused = false; hideBackChip(); }
  }

  if (!state.scrollPaused && settings.get('reader.autoScroll') !== false) scrollToCurrent(false);
  return true;
}

/**
 * 6-5 자동 스크롤. **편안 영역(상단 30%~하단 65%) 밖일 때만** 움직인다.
 * 줄마다 스크롤하면 화면이 계속 흔들려 눈 피로가 되레 나빠진다.
 */
function scrollToCurrent(force) {
  const node = state.currentLineIds.length ? lineElement(state.currentLineIds[0]) : null;
  if (!node || typeof node.getBoundingClientRect !== 'function') return;
  const vh = window.innerHeight || 0;
  if (!vh) return;
  const r = node.getBoundingClientRect();
  const inComfort = r.top >= vh * TTS.COMFORT_TOP && r.bottom <= vh * TTS.COMFORT_BOTTOM;
  if (inComfort && !force) return;

  state.programScrollAt = Date.now();
  try {
    node.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  } catch (e) {
    node.scrollIntoView(true);        // 옛 브라우저 — 옵션 객체를 모른다
  }
}

function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

function showBackChip() { if (els && els.backToLine) els.backToLine.hidden = false; }
function hideBackChip() { if (els && els.backToLine) els.backToLine.hidden = true; }

/**
 * 6-1 — 낭독이 쪽 끝에 닿았다. 다음 쪽으로 옮기고 **그 쪽이 그려질 때까지**
 * 기다린다(최대 5초). 미추출 쪽이면 `wireExtractor` 가 우선순위를 올려 두었고
 * 추출이 끝나는 순간 `renderPage` 가 돈다.
 *
 * @returns {Promise<boolean>} 5초 안에 낭독할 것이 생겼는가
 */
export function goToPageForSpeech(pageNo) {
  const target = clampPage(pageNo, state.pageCount);
  if (state.pageCount > 0 && Number(pageNo) > state.pageCount) return Promise.resolve(false);
  if (state.page === target && state.desc) return Promise.resolve(true);

  return new Promise((resolve) => {
    let timer = null;
    let poll = null;
    const done = (v) => {
      if (timer !== null) { clearTimeout(timer); timer = null; }
      if (poll !== null) { clearInterval(poll); poll = null; }
      resolve(v);
    };
    timer = setTimeout(() => done(false), TTS.PAGE_WAIT_MS);
    poll = setInterval(() => {
      if (state.page === target && state.desc) done(true);
    }, TTS.PAGE_POLL_MS);
    go(readerHash(state.docId, target));
  });
}

/* ────────────────────────────────────────────────────────
   7. 작은 도구들
   ──────────────────────────────────────────────────────── */

/** 언어 전환 — 정적 문구는 `applyTranslations`, 동적 문구는 다시 만든다. */
function relabelReader() {
  if (!els) return;
  applyTranslations(els.root);
  syncControls();
  if (els.root.hidden) return;
  paintPager();
  paintProgressBar();
  // 쪽 라벨·자리표시자 문장이 언어를 타므로 그린 것을 다시 그린다.
  if (state.desc) {
    clear(els.mount);
    els.mount.appendChild(renderDescription(state.desc));
    if (state.currentLineId) setCurrent(state.currentLineId);
  } else {
    renderPage();
  }
}

function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

/** 예외의 **코드**만 배너로 넘긴다. 문장은 배너가 i18n 으로 만든다(3-2). */
function banner(err, fallbackCode) {
  document.dispatchEvent(new CustomEvent('medreader:banner', {
    detail: { code: (err && err.code) || fallbackCode || 'ERR_UNKNOWN', tone: 'error' }
  }));
}
