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
import { go, replace, readerHash, libraryHash, quizHash } from '../router.js';
import { openDoc, extractorFor } from './library.js';
import { initTypeset, closeTypeset, syncControls } from './typeset.js';
import { initControls, leaveControls } from './controls.js';
// 5-4 · 5-5 제안 칩 — 퀴즈 화면은 스스로 배선된다(이 import 가 그것을 읽힌다).
import { updateReaderChip, onQuizEntry } from './quiz.js';
import { TTS, ORIGINAL } from '../config.js';
import * as render from '../pdf/render.js';
import * as charhl from './charhl.js';
import * as original from './original.js';
import { pickAnchorLine } from './original.js';

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

/**
 * 4-8 (3) — 낭독이 표에 닿으면 **한 번** 안내하고 다음 문단으로 넘어간다.
 *
 * 표 줄은 애초에 낭독 큐에 없다(`describePage` 가 문단에 넣지 않는다). 그래서
 * "닿았다"를 알리려면 **큐 위에 안내 한 마디를 끼워 넣는** 수밖에 없다. 낭독
 * 상태 기계(`tts/speaker.js`)와 컨트롤 바는 이 단계의 수정 범위 밖이고, 그
 * 둘을 건드리지 않고 6-4 의 제약(취소 후 60ms·세대 검사)을 지키는 길이
 * 이것뿐이다 — 안내도 그냥 한 발화다.
 *
 * **같은 표에 다시 닿아도 반복하지 않는다.** `announced` 에 든 region 은
 * 끼워 넣지 않는다(쪽을 다시 그려 큐를 새로 만들어도 마찬가지다).
 *
 * 순수 함수다 — 상태를 바꾸지 않고 새 배열을 돌려준다.
 *
 * @param {Array}  paras    `flowParas()` 가 낼 문단들(읽기 순서)
 * @param {Array}  blocks   `describePage().blocks` — 표가 어디에 끼어 있는지 안다
 * @param {Set}    announced 이미 안내한 regionId 들
 * @param {string} text     안내 문장(UI 언어 — 3-2 에 따라 문자열화는 UI 의 몫)
 */
export function insertTableNotices(paras, blocks, announced, text) {
  const list = Array.isArray(blocks) ? blocks : [];
  const src = Array.isArray(paras) ? paras : [];
  const said = announced || new Set();
  const say = String(text || '').trim();
  const out = [];
  const usedNotice = new Set();

  // `flowParas()` 는 `blocks` 의 문단을 **그 순서대로** 낸다. 그래서 id 로
  // 맞추지 않고 번호로 맞춘다 — 문단 id 는 null 일 수 있다(문단에 속하지
  // 않은 본문 줄).
  let pi = 0;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.type === 'para') {
      // 문단은 `flowParas()` 가 만든 객체를 **그대로** 쓴다(같은 줄 객체여야
      // `tts/text.js` 의 하이픈 결합이 화면 글자와 어긋나지 않는다).
      if (pi < src.length) out.push(src[pi]);
      pi++;
      continue;
    }
    if (b.type !== 'table' || !say) continue;
    const rid = String(b.regionId);
    if (said.has(rid) || usedNotice.has(rid)) continue;
    usedNotice.add(rid);
    out.push(tableNoticePara(rid, say));
  }

  // blocks 와 수가 맞지 않는 나머지 문단(방어) — 잃지 않는다.
  for (; pi < src.length; pi++) out.push(src[pi]);
  return out;
}

/** 안내 문단의 id 접두사. 화면의 줄 id 와 섞이지 않는 모양이어야 한다. */
export const TABLE_NOTICE_PREFIX = 'tablenotice:';

export function tableNoticePara(regionId, text) {
  const id = TABLE_NOTICE_PREFIX + regionId;
  return { id: id, kind: 'table-notice', lines: [{ id: id, text: text, hyphen: 'none' }] };
}

/** 이 id 가 표 안내인가. 그렇다면 화면에는 없는 줄이다(하이라이트 대상 아님). */
export function isTableNotice(id) {
  return typeof id === 'string' && id.indexOf(TABLE_NOTICE_PREFIX) === 0;
}

/** 안내 id → regionId. */
export function regionOfNotice(id) {
  return isTableNotice(id) ? id.slice(TABLE_NOTICE_PREFIX.length) : null;
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
  /** `fromStored` 가 되살린 PageLayout — 원본 뷰의 bbox 가 여기서 온다(4-12). */
  layout: null,
  currentLineId: null,
  /** 지금 이벤트를 듣고 있는 Extractor 와 해제 함수들 */
  wired: { docId: null, ex: null, off: [] },
  progress: null,
  /** 렌더 경쟁 방지 — 늦게 끝난 옛 렌더가 새 쪽을 덮어쓰지 않는다. */
  renderToken: 0,

  /* ── 6-5 자동 스크롤 ─────────────────────────────── */
  /** 지금 하이라이트된 줄들(문장 모드에서는 여럿). */
  currentLineIds: [],
  /** 10a — 그 줄들 **안의** 글자 구간(`Unit.ranges`). 없으면 줄 통째로 칠한다. */
  currentRanges: null,
  /** 마지막으로 **우리가** 스크롤한 시각 — 사용자 스크롤과 구분한다(최근 800ms). */
  programScrollAt: 0,
  /** 사용자가 직접 스크롤해 자동 스크롤을 쉬는 중인가. */
  scrollPaused: false,
  /** 자동 스크롤 복구 판정용 — 문단이 바뀌면 되살린다. */
  lastParaId: null,

  /* ── 6b 원본 뷰 ──────────────────────────────────── */
  /** 9-3 `reader.view` — 'reflow' | 'original'. 새로고침 후에도 유지된다. */
  view: 'reflow',
  /** 사용자가 마지막으로 탭한 줄 — `pickAnchorLine` 의 `ctx` 한 조각. */
  lastTappedLineId: null,
  /** 4-8 (3) — 이미 안내한 표 region(문서가 바뀌면 비운다). */
  announcedTables: new Set(),
  /** 4-8 폴백 — 크롭 이미지 **메모리 LRU 20개.** IndexedDB 에 넣지 않는다. */
  crops: render.createLru(ORIGINAL.CROP_CACHE_MAX, (key, val) => {
    // 쫓겨난 이미지의 objectURL 은 돌려준다 — 안 그러면 탭이 살아 있는 동안
    // 메모리에 남는다(7000쪽에서 이게 누적이다).
    if (val && val.url) { try { URL.revokeObjectURL(val.url); } catch (e) { /* 이미 해제됨 */ } }
  })
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
    backToLine: root.querySelector('#backToLine'),
    viewToggle: root.querySelector('#viewToggle'),
    quizChip: root.querySelector('#quizChipSlot'),
    quizBtn: root.querySelector('#readerQuizBtn')
  };

  /* ── 6b 원본 뷰 (12-5) ─────────────────────────────
     pdf.js 는 **원본 뷰를 요청할 때** 열린다(2-3). 실패하면 버튼을 끄고
     리플로우로 되돌린다 — 추출이 끝난 쪽은 pdf.js 없이 계속 읽힌다. */
  state.view = settings.get('reader.view') === 'original' ? 'original' : 'reflow';
  original.initOriginal({
    getPdfDoc: pdfDocFor,
    onLineTap: (id) => {
      state.lastTappedLineId = id == null ? null : String(id);
      for (const fn of lineTapListeners) { try { fn(id); } catch (e) { /* 구독자 예외 */ } }
    },
    onUnavailable: (code) => {
      banner({ code: code }, 'ERR_PDFJS_LOAD');
      setView('reflow', { persist: false });
    }
  });
  els.viewToggle.addEventListener('click', () => toggleView());
  paintViewToggle();

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
    state.lastTappedLineId = id;            // `pickAnchorLine` 의 ctx 한 조각
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
  if (docChanged) {
    // 4-8 — region id 는 쪽 안에서만 유일하다. 문서가 바뀌면 비운다
    // (같은 "45:r0" 이 다른 책의 다른 표일 수 있다).
    state.announcedTables = new Set();
    state.crops.clear();
    state.lastTappedLineId = null;
  }
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
  if (els && els.quizChip) els.quizChip.hidden = true;
  original.leaveOriginal();
  state.desc = null;
  state.layout = null;
  state.currentLineId = null;
  state.currentLineIds = [];
  state.currentRanges = null;
  clearCharHighlight();
  state.lastParaId = null;
  state.lastTappedLineId = null;
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
  original.leaveOriginal();
  state.currentLineId = null;
  state.currentLineIds = [];
  state.currentRanges = null;
  // 버린 DOM 을 가리키는 `Range` 를 레지스트리에 남기지 않는다(10a).
  clearCharHighlight();

  if (!rec) {
    // 아직 추출되지 않은 쪽 — **빈 화면을 보여주지 않는다**(12-3).
    state.desc = null;
    state.layout = null;
    els.mount.appendChild(preparingBlock());
    paintViewToggle();
    return;
  }

  let desc = null;
  let layout = null;
  try {
    layout = fromStored(rec);
    desc = describePage(layout);
  } catch (e) {
    // 저장본이 깨졌어도 리더가 죽지는 않는다. 9-4 가 그 쪽을 다시 뽑는다.
    state.desc = null;
    state.layout = null;
    els.mount.appendChild(noticeBlock('reader.page.broken'));
    paintViewToggle();
    return;
  }
  state.desc = desc;
  state.layout = layout;

  // `[수정 2026-09-25]` 퀴즈 칩·버튼은 **렌더와 무관하다** — `docId` 와 `page` 만
  // 있으면 판정할 수 있다. 이걸 `notifyPage()` 에만 매달아 뒀더니,
  // 원본 뷰에서 `showOriginal` 이 겹쳐 불려 렌더가 버려질 때(`token` 검사에서
  // 빠져나갈 때) **칩과 버튼이 함께 사라졌다** — `[실기기]` 사용자가 칩을
  // "나중에"로 닫은 뒤 퀴즈로 갈 길이 없던 것과 겹쳐 완전히 막혔다.
  // 그래서 버려질 수 있는 비동기 작업 **앞에서** 한 번 그린다.
  paintQuizChip();

  // ★ **낭독 큐는 뷰와 무관하다.** `desc` 는 두 뷰에서 똑같이 만들어 두고
  //   화면만 갈아 끼운다 — 원본 뷰에서도 낭독이 끊기지 않는다(6-4).
  await paintView(token);
  if (token !== state.renderToken) return;
  notifyPage();
}

/**
 * 12-3 뷰 전환 — 같은 쪽을 리플로우로 그릴지 원본 canvas 로 그릴지.
 * 원본 뷰가 실패하면 **조용히 리플로우로 되돌린다**(2-3: 앱은 죽지 않는다).
 */
async function paintView(token) {
  if (state.view === 'original' && !original.originalUnavailable()) {
    const ok = await original.showOriginal(els.mount, {
      docId: state.docId, pageNo: state.page, layout: state.layout
    });
    if (token !== state.renderToken) return;
    if (ok) { paintViewToggle(); return; }
    // pdf.js 가 없다 → `onUnavailable` 이 이미 `state.view` 를 되돌렸다.
    state.view = 'reflow';
    clear(els.mount);
  }
  // `[수정 2026-09-26]` 그릴 쪽이 없으면 안내만 남긴다.
  // `state.desc` 는 저장본이 깨졌거나 문서가 지워진 뒤 뷰를 바꾸면 null 이다.
  // 그대로 넘기면 `renderDescription` 이 `desc.pageNo` 에서 터진다(실측).
  if (!state.desc) {
    els.mount.appendChild(noticeBlock('reader.page.broken'));
    paintViewToggle();
    return;
  }
  els.mount.appendChild(renderDescription(state.desc));
  paintViewToggle();
  // 4-8 폴백 — 표 자리에 크롭 이미지를 넣는다. pdf.js 가 없으면 조용히
  // 자리표시자로 남는다(리플로우 읽기는 계속된다).
  fillTableCrops(token);
}

/* ────────────────────────────────────────────────────────
   3-b. 뷰 전환 (12-3 · 12-5)
   ──────────────────────────────────────────────────────── */

/** 원본 뷰·표 크롭이 쓰는 PDFDocumentProxy. pdf.js 로드는 여기서만 일어난다. */
async function pdfDocFor(docId) {
  const ex = extractorFor(docId) || await openDoc(docId);
  return (ex && ex.pdfDoc) || null;
}

function paintViewToggle() {
  if (!els || !els.viewToggle) return;
  const isOriginal = state.view === 'original';
  const down = original.originalUnavailable();
  els.viewToggle.disabled = down;
  els.viewToggle.setAttribute('aria-pressed', isOriginal ? 'true' : 'false');
  // 버튼은 **갈 곳**을 말한다 — 지금 상태가 아니라.
  const key = isOriginal ? 'reader.view.reflow' : 'reader.view.original';
  els.viewToggle.textContent = t(key);
  els.viewToggle.setAttribute('aria-label', t(key));
}

/**
 * 12-3 — "같은 줄을 기준으로 위치를 유지한다". 어느 줄로 착지할지는
 * `pickAnchorLine`(사람이 채운다)이 고르고, **null 이면 쪽 첫 줄**이다.
 */
async function toggleView() {
  if (!els || original.originalUnavailable()) return;
  // 기준 줄은 **바꾸기 전** 화면에서 고른다. 바꾼 뒤에는 그 사실이 사라진다.
  const anchor = resolveAnchor();
  const next = state.view === 'original' ? 'reflow' : 'original';
  await setView(next, { persist: true, anchor: anchor });
}

/**
 * @param {'reflow'|'original'} view
 * @param {Object} opts persist — 9-3 `reader.view` 에 저장할 것인가
 *                     anchor  — 착지할 줄 id (없으면 쪽 첫 줄)
 */
async function setView(view, opts) {
  const o = opts || {};
  const next = view === 'original' ? 'original' : 'reflow';
  const changed = state.view !== next;
  state.view = next;
  if (o.persist) settings.set('reader.view', next).catch(() => { /* 저장 실패가 읽기를 막지 않는다 */ });
  if (!els || els.root.hidden) { paintViewToggle(); return; }
  if (!changed) { paintViewToggle(); return; }
  await renderPage();
  landOn(o.anchor);
}

/** 뷰를 바꾸기 **직전**에 지금 화면이 아는 사실을 모아 기준 줄을 고른다. */
function resolveAnchor() {
  const seen = visibleNow();
  const ctx = {
    speaking: state.currentLineIds.length > 0,
    currentLineId: state.currentLineId,
    visibleLineIds: seen.visible,
    viewportCenterLineId: seen.center,
    lastTappedLineId: state.lastTappedLineId
  };
  let picked = null;
  try {
    picked = pickAnchorLine(ctx);
  } catch (e) {
    picked = null;          // 사람이 채우는 자리다. 비어 있어도 뷰 전환은 돈다.
  }
  const id = picked == null ? null : String(picked);
  // 고른 줄이 이 쪽에 없으면 쓰지 않는다(빈 함수·엉뚱한 값 모두 여기서 걸린다).
  if (!id || flowLineIds().indexOf(id) < 0) return null;
  return id;
}

/** 새 뷰에서 그 줄로 화면을 맞춘다. `null` 이면 쪽 첫 줄이다. */
function landOn(lineId) {
  const id = lineId || firstFlowLineId();
  if (!id) return;
  if (state.view === 'original') { original.scrollToLine(id); return; }
  const node = lineElement(id);
  if (!node) return;
  state.programScrollAt = Date.now();
  try { node.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) { node.scrollIntoView(true); }
}

/** 지금 화면에 보이는 줄들(읽기 순서)과 세로 중앙에 가장 가까운 줄. */
function visibleNow() {
  if (state.view === 'original') return original.visibleLineIds();
  if (!els || !els.mount) return { visible: [], center: null };
  const vh = (typeof window !== 'undefined' && window.innerHeight) || 0;
  const list = els.mount.querySelectorAll('span.line[data-flow="1"]');
  const visible = [];
  let center = null;
  let best = Infinity;
  for (let i = 0; i < list.length; i++) {
    const r = list[i].getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) continue;
    const id = list[i].getAttribute('data-line-id');
    visible.push(id);
    const d = Math.abs((r.top + r.bottom) / 2 - vh / 2);
    if (d < best) { best = d; center = id; }
  }
  return { visible: visible, center: center };
}

/* ────────────────────────────────────────────────────────
   3-c. 표 크롭 폴백 (4-8) — 이미지는 **메모리 LRU 20개**만.
   ──────────────────────────────────────────────────────── */

async function fillTableCrops(token) {
  if (!els || !els.mount) return;
  const figs = els.mount.querySelectorAll('figure.table-fallback');
  if (!figs.length) return;
  const regions = (state.layout && state.layout.regions) || [];
  const byId = new Map();
  for (let i = 0; i < regions.length; i++) byId.set(String(regions[i].id), regions[i]);

  for (let i = 0; i < figs.length; i++) {
    const fig = figs[i];
    const rid = fig.getAttribute('data-region-id');
    const region = byId.get(String(rid));
    if (!region) continue;
    try {
      const img = await cropFor(rid, region);
      if (token !== state.renderToken) return;       // 그 사이 쪽이 바뀌었다
      if (!img) { paintCropFailed(fig); continue; }
      paintCrop(fig, img, rid);
    } catch (e) {
      if (token !== state.renderToken) return;
      // pdf.js 가 없다 — 자리표시자를 남기고 **리플로우는 계속 읽힌다**(2-3).
      paintCropFailed(fig);
    }
  }
}

/** LRU 20개. 같은 표를 다시 보면 렌더하지 않는다(4-8). */
async function cropFor(regionId, region) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const scale = render.cropScale(dpr);
  const key = render.cropKey(state.docId, state.page, regionId, scale);
  const hit = state.crops.get(key);
  if (hit) return hit;

  const box = render.cropBox(region.bbox, { width: state.layout.width, height: state.layout.height });
  if (!box) return null;

  const pdfDoc = await pdfDocFor(state.docId);
  if (!pdfDoc) return null;
  const out = await render.renderRegionImage(pdfDoc, state.page, box, {
    scale: scale,
    makeCanvas: (w, h) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return c;
    }
  });
  if (!out || !out.blob) return null;
  const img = { url: URL.createObjectURL(out.blob), width: out.width, height: out.height };
  state.crops.set(key, img);
  return img;
}

function paintCrop(fig, img, regionId) {
  const old = fig.querySelector('img.table-crop');
  if (old) old.remove();
  // 핀치 줌이 되도록 이미지는 자체 스크롤 상자 안에 둔다(4-8).
  let box = fig.querySelector('.table-crop-box');
  if (!box) {
    box = el('div', 'table-crop-box');
    fig.insertBefore(box, fig.querySelector('button') || null);
  }
  clear(box);
  const im = el('img', 'table-crop');
  im.src = img.url;
  im.alt = t('reader.table.crop');
  im.decoding = 'async';
  box.appendChild(im);

  const btn = fig.querySelector('button[data-action="original"]');
  if (btn) {
    btn.disabled = false;
    btn.onclick = () => openRegionInOriginal(regionId);
  }
}

function paintCropFailed(fig) {
  const cap = fig.querySelector('figcaption');
  if (cap) {
    cap.setAttribute('data-i18n', 'reader.table.cropFailed');
    cap.textContent = t('reader.table.cropFailed');
  }
  const btn = fig.querySelector('button[data-action="original"]');
  if (btn) btn.disabled = original.originalUnavailable();
  if (btn && !btn.disabled) btn.onclick = () => openRegionInOriginal(fig.getAttribute('data-region-id'));
}

/** 4-8 — [원본으로 보기]: 원본 뷰로 바꾸고 그 표 자리로 스크롤한다(12-5). */
async function openRegionInOriginal(regionId) {
  await setView('original', { persist: true });
  original.scrollToRegion(regionId);
}

/** 새 쪽이 그려졌다 — 낭독 큐가 이 쪽 것으로 갈아탄다(`ui/controls.js`). */
function notifyPage() {
  for (const fn of pageListeners) {
    try { fn({ docId: state.docId, page: state.page }); } catch (e) { /* 구독자 예외 */ }
  }
  paintQuizChip();
}

/**
 * 5-4 — [이 섹션 퀴즈 풀기] 칩. 판단·파싱은 전부 `ui/quiz.js` 가 한다.
 * **리더는 기다리지 않는다** — 파싱이 실패해도 칩이 안 뜰 뿐이다.
 */
function paintQuizChip() {
  if (!els || !els.quizChip) return;
  try {
    updateReaderChip(els.quizChip, {
      docId: state.docId, doc: state.doc, page: state.page,
      extractor: extractorFor(state.docId)
    });
  } catch (e) { /* 칩이 리더를 막지 않는다(5-4) */ }
}

/**
 * `[신규 2026-09-25]` 상단바 퀴즈 버튼 — **닫을 수 없는 입구.**
 *
 * 칩은 "나중에"로 닫을 수 있는데 그게 **유일한 입구**였다.
 * `[실기기]` 사용자: "나중에 눌러서 닫혀버렸어 어떻게 켜는지 몰러. (안보임)"
 * 문구가 거짓말을 한 셈이다 — "나중에"라고 써 놓고 돌아올 길을 안 만들었다.
 *
 * 칩과 **같은 판정**(`chipEntry` — 5-4 의 0.6 · 5문항)을 쓴다.
 * 그래서 자격 없는 섹션에서는 버튼도 안 보인다 — 규칙이 두 벌이 되면 어긋난다.
 */
function paintQuizButton(entry, docId) {
  if (!els || !els.quizBtn) return;
  if (!entry || docId !== state.docId) {
    els.quizBtn.hidden = true;
    els.quizBtn.onclick = null;
    return;
  }
  els.quizBtn.hidden = false;
  els.quizBtn.onclick = () => go(quizHash(docId, entry.sectionId));
}

/* 칩이 자격을 판정할 때마다 버튼도 같이 그린다 — 판정은 한 벌이다. */
onQuizEntry(paintQuizButton);

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
    // 12-4 — 하이픈으로 이어지는 줄 사이에는 공백을 두지 않는다.
    //
    // [수정 2026-09-22] 줄 사이 공백을 **span 밖의 텍스트 노드**로 두었더니
    // 실기기에서 하이라이트에 틈이 생겼다("should| undergo"). 공백이
    // `.is-current` 배경 밖에 있어 두 상자가 끊겨 보였고, 리플로우된 화면 줄과
    // PDF 원본 줄이 다르게 접히므로 그 틈이 **낱말 한가운데** 떨어지기도 했다.
    // 공백을 **앞 줄 span 안**으로 옮기면 하이라이트가 이어진다.
    const last = i === b.lines.length - 1;
    const joinSpace = !last && ln.hyphen === 'none';
    p.appendChild(lineEl(ln, 1, joinSpace));
  }
  return p;
}

/**
 * `span.line[data-line-id]` — **5단계 하이라이트의 앵커**(6-5).
 * `data-flow="1"` 인 줄만 낭독이 돈다. 접힌 줄은 `0` 이다.
 */
function lineEl(ln, flow, joinSpace) {
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
  // 다음 줄로 잇는 공백은 **span 안**에 둔다 — 밖에 두면 하이라이트가 끊긴다.
  if (joinSpace) span.appendChild(document.createTextNode(' '));
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
  return setCurrentLines([lineId]);
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
  // 4-8 (3) — 표 자리에 안내 한 마디를 끼운다. 이미 말한 표는 빠진다.
  return insertTableNotices(out, blocks, state.announcedTables, t('reader.tts.tableSkipped'));
}

/* ────────────────────────────────────────────────────────
   ★ `[수정 2026-09-25 — 10a]` 리플로우 하이라이트 (spec 6-5)

   줄 단위 `.is-current` 는 문장이 줄 중간에서 시작할 때 **앞 문장 꼬리까지**
   칠했다(`[실기기]` "두 줄·세 줄짜리 블럭"). 이제 `Unit.ranges` 의 글자 구간을
   **CSS Custom Highlight API** 로 칠한다.

   ★ **DOM 을 건드리지 않는다.** 줄 span 을 쪼개면 6a 에서 한 번 데었던 이음새
     문제가 돌아온다(하이라이트가 낱말을 자르던 그 건). `Range` 는 텍스트 노드를
     가리키기만 한다.

   ★ 지원하지 않는 브라우저에서는 **지금의 줄 단위 `.is-current` 로 물러선다.**
     기능 손실은 없다 — 넓게 칠할 뿐이다.
   ──────────────────────────────────────────────────────── */

const HL_NAME = 'medreader-current';

/* `[수정 2026-09-26]` 본문은 `ui/charhl.js` 로 빠졌다 — 퀴즈 해설 낭독도
   같은 장치를 써야 하는데, 복사하면 규칙이 두 벌이 된다. */
function highlightsSupported() { return charhl.highlightsSupported(); }

function clearCharHighlight() { charhl.clearCharRanges(HL_NAME); }

function paintCharHighlight(ranges) {
  return charhl.paintCharRanges(HL_NAME, ranges, lineElement);
}

/**
 * 6-5 — 문장이 걸친 **모든 줄**에 하이라이트를 준다. 문장 모드가 기본이라
 * 한 발화가 원본 줄 3~4개에 걸친다(2단 조판이라 줄이 8~10낱말로 짧다).
 *
 * @param {string[]} lineIds 자동 스크롤·쪽 판정의 계약 — **바뀌지 않았다**
 * @param {Array<{id,start,end}>} [ranges] 10a — 줄 안의 글자 구간
 * @returns {boolean} 그 줄들이 지금 쪽에 있었는가
 */
export function setCurrentLines(lineIds, ranges) {
  if (!els || !els.mount) return false;
  const ids = (Array.isArray(lineIds) ? lineIds : [lineIds]).filter((x) => x != null);
  if (!ids.length) return false;
  const rs = Array.isArray(ranges) && ranges.length ? ranges : null;

  /* 4-8 (3) — 표 안내는 **화면에 없는 줄**이다. 하이라이트할 곳이 없지만
     "이 쪽에 없다"(false)도 아니다 — false 를 돌려주면 낭독이 쪽을 넘기려
     든다. 안내를 말한 것으로 표시하고 true 를 돌려준다. */
  if (isTableNotice(String(ids[0]))) {
    const rid = regionOfNotice(String(ids[0]));
    if (rid) state.announcedTables.add(rid);
    return true;
  }

  if (state.view === 'original') {
    const ok = original.setCurrentOriginal(ids, rs);
    if (!ok) return false;
    state.currentLineIds = ids.map(String);
    state.currentRanges = rs;
    state.currentLineId = String(ids[0]);
    return true;
  }

  const prev = els.mount.querySelectorAll('span.line.is-current');
  for (let i = 0; i < prev.length; i++) prev[i].classList.remove('is-current');

  // ★ 10a — 글자 구간을 칠할 수 있으면 줄 클래스는 **붙이지 않는다**. 붙이면
  //   줄 통째가 다시 칠해져 고친 것이 무의미해진다.
  const charOk = rs ? paintCharHighlight(rs) : false;
  if (!charOk) clearCharHighlight();

  let first = null;
  for (let i = 0; i < ids.length; i++) {
    const node = lineElement(ids[i]);
    if (!node) continue;
    if (!charOk) node.classList.add('is-current');
    if (!first) first = node;
  }
  if (!first) { clearCharHighlight(); return false; }
  state.currentLineIds = ids.map(String);
  state.currentRanges = rs;
  state.currentLineId = String(ids[0]);
  return true;
}

/**
 * 낭독이 한 발화로 옮겨 갈 때 화면이 하는 일 전부: 하이라이트 + 자동 스크롤.
 * @param {{lineIds: string[], paraId: string|null}} unit
 */
export function showSpoken(unit) {
  const u = unit || {};
  // 10a — `ranges` 는 `tts/text.js` 가 만들고 `speaker` 가 그대로 들고 온다.
  const ok = setCurrentLines(u.lineIds || [], u.ranges);
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
  if (state.view === 'original') {
    state.programScrollAt = Date.now();
    original.scrollCurrentIntoView(!!force);
    return;
  }
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
  paintViewToggle();
  // 원본 뷰는 canvas 라 글자가 언어를 타지 않는다. 줌 표시·대체 텍스트만 고친다.
  if (state.view === 'original') { original.relabelOriginal(); return; }
  // 쪽 라벨·자리표시자 문장이 언어를 타므로 그린 것을 다시 그린다.
  if (state.desc) {
    const ids = state.currentLineIds.slice();
    const rs = state.currentRanges;
    clear(els.mount);
    // DOM 을 버리면 `Range` 들도 떠 있는 노드를 가리킨다 — 레지스트리를 비운다.
    clearCharHighlight();
    els.mount.appendChild(renderDescription(state.desc));
    fillTableCrops(state.renderToken);
    if (ids.length) setCurrentLines(ids, rs);
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
