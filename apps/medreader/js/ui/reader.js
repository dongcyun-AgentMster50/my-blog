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
     article.reflow[dir=ltr][lang={documents.lang}]
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
   본문 컨테이너는 `dir="ltr"` 고정이다. UI 가 아랍어여도 원서 본문은 LTR 이다.
   번역 블록(8단계)만 RTL 로 들어간다.
   `[7c]` `lang` 은 **문서의 원문 언어**(`documents.lang`)다 — en 고정이 아니다. 지원 원문
   en·fr·ko 가 전부 LTR 이라 `dir` 은 그대로 둔다. 서재 [⋯] 나 자동 추정이 바꾸면
   `medreader:doclang` 이벤트로 듣고 **새로고침 없이** 본문 `lang` 을 고치고 낭독 큐를
   다시 만들게 한다(`onPageRender` 구독자 — `ui/controls.js` 의 `speaker.reload()`).

   ── 7000쪽 ──────────────────────────────────────────────
   한 번에 **한 쪽만** DOM 에 둔다. 쪽을 넘기면 이전 DOM 을 통째로 버린다.
   ============================================================ */

import * as db from '../db.js';
import * as settings from '../settings.js';
import { t, applyTranslations, formatNumber, onLangChange } from '../i18n/index.js';
import { fromStored } from '../text/store.js';
import { FOLD_ROLES, REF_ROLE, describePage, flowParasOf } from '../text/screen.js';
import { go, replace, readerHash, libraryHash, quizHash, parseRoute } from '../router.js';
import { openDoc, extractorFor, markScanNoticed } from './library.js';
// `[8l]` 스캔본·글자 깨짐 안내 띠(17-5-1 3 · 19-1-3 §3-3) — 판정·키는 순수 `text/scan.js`.
import { bandKey } from '../text/scan.js';
import { initTypeset, closeTypeset, syncControls } from './typeset.js';
import { initControls, leaveControls, speechState } from './controls.js';
// 5-4 · 5-5 제안 칩 — 퀴즈 화면은 스스로 배선된다(이 import 가 그것을 읽힌다).
import { updateReaderChip, onQuizEntry } from './quiz.js';
import { TTS, ORIGINAL } from '../config.js';
import { docLangOf } from '../text/lang.js';
import { domainOf } from '../ai/prompts.js';
import * as render from '../pdf/render.js';
import * as charhl from './charhl.js';
import * as original from './original.js';
import { pickAnchorLine } from './original.js';
// `[8i-1]` 지금 그린 저장본이 옛 판인가 — 추출기와 같은 전역 버전(4-1)을 본다.
import { algoVersion as ALGO_VERSION } from '../text/layout.js';
// `[8g-3]` PDF 개요·쪽 라벨을 한가할 때 한 번 documents 에(17-8-12 §3) — 화면 변화 없음.
import { ensure as ensureOutline, isOutlineCurrent } from '../search/outline.js';
// `[8g-4a]` 검색 화면·결과로 이동·검색 띠(spec 17-8-12 §4). 리더는 입구와 훅만 준다 — 검색 규칙은 그쪽에 있다.
import { initSearch } from './search.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분 — tests/reader.test.mjs 가 고정한다.
   ──────────────────────────────────────────────────────── */

// `[8g-1 — spec 17-8-12 U6]` 화면 글자 함수는 순수 모듈 `text/screen.js` 로 옮겼다 — 같은 함수 객체를 다시 export 한다.
export { FOLD_ROLES, REF_ROLE, describePage, flowParasOf };

/** 쪽 번호는 1..pageCount 안으로 접는다. 쪽수를 모르면 1 이상만 본다. */
export function clampPage(page, pageCount) {
  const n = Math.floor(Number(page));
  const max = Math.floor(Number(pageCount)) || 0;
  if (!Number.isFinite(n) || n < 1) return 1;
  if (max >= 1 && n > max) return max;
  return n;
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

function textOf(l) { return String((l && l.text) || '').trim(); }

/* ────────────────────────────────────────────────────────
   1-b. `[8i-1 — spec 4-13-9]` 판 바뀜 재추출 중 "지금 보고 있는 쪽"을 새 판으로

   `algoVersion` 이 오르면(4-13-7) 추출기가 모든 쪽을 다시 쓴다(지금 쪽 ±5 우선). 그런데 리더는 쪽을
   **연 순간의 저장본**으로 그리고, 추출 `page` 이벤트에는 자리표시자일 때만 반응했다 — 지금 쪽은 새 판이
   저장돼도 옛 판 그대로 남아 재생하면 옛 읽기("& Pseudo- 1130")가 나왔다(8i Review 8i-8).
   이제: **옛 판으로 그린 쪽**은 그 쪽 저장을 따라가 다시 그린다. 낭독 중이면 멈출 때까지 미룬다.
   평소(옛 판이 아닌 쪽)에는 지금까지와 같다 — 역할 재계산(4-7) 저장에도 다시 그리지 않는다.
   ──────────────────────────────────────────────────────── */

/** 이 저장본이 지금 알고리즘보다 옛 판인가. 저장본이 없으면 거짓(자리표시자는 옛 판이 아니다). */
export function isStaleRecord(rec, algo) {
  if (!rec) return false;
  const cur = algo === undefined ? ALGO_VERSION : Number(algo);
  return (Number(rec.algoVersion) || 0) < cur;
}

/**
 * 다시 그리기 문지기. **순수**하다 — DOM·추출기·speaker 를 모르고 `refresh()` 만 부른다(테스트가 고정).
 *
 *   shown(docId, page, stale)  쪽을 그렸다. 다른 쪽이면 따라가기를 끊는다. 옛 판이면 따라가기 시작.
 *                              어느 경우든 미뤄 둔 다시 그리기는 버린다(방금 최신 저장본을 읽었다).
 *   saved(docId, page)         추출기가 그 쪽을 저장했다 → 'ignore' | 'deferred' | 'refresh'
 *                              지금 쪽이 아니거나 따라가는 쪽이 아니면 무시(평소 동작 불변).
 *   speech(state)              speaker 상태. `'speaking'` 이면 미룬다. 멈춤·처음·오류가 되면 미뤄 둔 것을 한다.
 *                              `'waiting-page'`(다음 쪽·새 판을 기다림)은 읽는 중이 아니다 — 바로 다시 그리되,
 *                              미뤄 둔 것을 거기서 풀지는 않는다(쪽 끝 → 곧 다른 쪽이 그려져 무의미하다).
 *   left()                     리더를 떠났다.
 */
export function createRefreshGate(refresh) {
  let key = null;
  let follow = false;
  let pending = false;
  let speaking = false;
  const keyOf = (docId, page) => String(docId) + '\u0000' + String(Math.floor(Number(page)));
  function run() {
    try {
      const r = refresh();
      if (r && typeof r.catch === 'function') r.catch(() => { /* 다시 그리기 실패가 낭독·읽기를 막지 않는다 */ });
    } catch (e) { /* 같은 이유 */ }
  }
  return {
    shown(docId, page, stale) {
      const k = keyOf(docId, page);
      if (k !== key) { key = k; follow = false; }
      pending = false;
      if (stale) follow = true;
    },
    saved(docId, page) {
      if (keyOf(docId, page) !== key || !follow) return 'ignore';
      if (speaking) { pending = true; return 'deferred'; }
      run();
      return 'refresh';
    },
    speech(st) {
      speaking = st === 'speaking';
      if (speaking || st === 'waiting-page' || !pending) return null;
      pending = false;
      run();
      return 'refresh';
    },
    left() { key = null; follow = false; pending = false; },
    snapshot() { return { following: follow, pending: pending, speaking: speaking }; }
  };
}

/**
 * 옛 판 → 새 판 **줄 id 대응**(낭독 줄만). 같은 쪽을 새 판으로 다시 그리면 줄 id 가 바뀔 수 있다(8i: 이름표·쪽 번호
 * 칸이 갈라지고 읽기 순서가 바뀐다). 스크롤 기준 줄·멈춘 자리(다음 재생 시작점)·탭한 줄을 옮길 때 쓴다.
 *   ① 같은 id 에 같은 글자 → 그대로
 *   ② 같은 글자의 새 줄 → 여럿이면 쪽 위 자리(bbox 중심)가 가장 가까운 것
 *   ③ 쪽 위에서 겹치는 넓이가 가장 큰 새 줄(같은 글자 자리 — "& Pseudo- 1130" → "& Pseudo-")
 *   ④ 같은 문단 순서 — 낭독 줄 순번을 비례로 옮긴다
 * @returns {Map<string,string>} 옛 id → 새 id
 */
export function buildLineRemap(oldLayout, newLayout) {
  const out = new Map();
  if (!oldLayout || !newLayout) return out;
  let oldIds = [];
  let newIds = [];
  try {
    oldIds = flowLineIdsOf(describePage(oldLayout));
    newIds = flowLineIdsOf(describePage(newLayout));
  } catch (e) { return out; }
  if (!newIds.length) return out;
  const oldById = new Map();
  const newById = new Map();
  for (const l of (oldLayout.lines || [])) oldById.set(String(l.id), l);
  for (const l of (newLayout.lines || [])) newById.set(String(l.id), l);
  const newPos = new Map();
  const byText = new Map();
  for (let i = 0; i < newIds.length; i++) {
    const id = String(newIds[i]);
    newPos.set(id, i);
    const tx = textOf(newById.get(id));
    if (!byText.has(tx)) byText.set(tx, []);
    byText.get(tx).push(id);
  }
  const lastOld = Math.max(1, oldIds.length - 1);
  for (let k = 0; k < oldIds.length; k++) {
    const id = String(oldIds[k]);
    const ol = oldById.get(id);
    const tx = textOf(ol);
    if (newPos.has(id) && textOf(newById.get(id)) === tx) { out.set(id, id); continue; }
    let pick = null;
    const same = tx ? (byText.get(tx) || []) : [];
    if (same.length === 1) pick = same[0];
    else if (same.length > 1) pick = nearestByBox(same, ol, newById, k, newPos);
    if (!pick) pick = maxOverlap(newIds, ol, newById);
    if (!pick) pick = String(newIds[Math.min(newIds.length - 1, Math.round(k * (newIds.length - 1) / lastOld))]);
    out.set(id, pick);
  }
  return out;
}

function boxOf(l) {
  const b = l && l.bbox;
  if (!b) return null;
  const x0 = Number(b.x0), y0 = Number(b.y0), x1 = Number(b.x1), y1 = Number(b.y1);
  if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
  return { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
}

function nearestByBox(ids, ol, byId, k, pos) {
  const a = boxOf(ol);
  let best = null;
  let bestD = Infinity;
  for (const id of ids) {
    const b = boxOf(byId.get(id));
    const d = a && b
      ? Math.hypot((a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2, (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2)
      : Math.abs((pos.get(id) || 0) - k);
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

function maxOverlap(ids, ol, byId) {
  const a = boxOf(ol);
  if (!a) return null;
  let best = null;
  let bestA = 0;
  for (const raw of ids) {
    const id = String(raw);
    const b = boxOf(byId.get(id));
    if (!b) continue;
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (w <= 0 || h <= 0) continue;
    if (w * h > bestA) { bestA = w * h; best = id; }
  }
  return best;
}

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
  /** `[8i-1]` 지금 그린 저장본이 옛 판(`algoVersion` 이 낮다)인가 — 재생이 새 판을 기다린다. */
  stale: false,
  /** `[8i-1c]` 지금 쪽을 새 판으로 **다시 그리는 중**인 렌더의 token(0 = 아님). 그리기·`refreshed` 알림이 끝나야 0. */
  refreshing: 0,
  /** `[8i-1]` 방금 새 판으로 다시 그렸다면 옛 줄 id → 새 줄 id. 다른 렌더에서는 null. */
  lineRemap: null,

  /* ── `[8g-4a]` 검색 화면 뒤에 숨은 리더 (17-8-12 §4-5) ── */
  /** 검색 화면으로 가며 **숨기기만** 했다 — DOM·낭독이 그대로 살아 있다(`leaveReader` 의 검색 갈래). */
  soft: false,
  /** 숨기기 직전 리더의 스크롤 — 다시 보일 때 되돌린다(창 스크롤은 화면들이 함께 쓴다). */
  softScrollY: 0,
  /** 숨어 있는 동안 낭독이 쪽을 넘겼다(해시는 옛 쪽) — 다시 보일 때 낭독이 간 쪽으로 따라간다. */
  hiddenTurn: false,
  /** 숨어 있는 동안 UI 언어가 바뀌었다 — 다시 보일 때 동적 문구를 다시 만든다. */
  relabelPending: false,
  /** 숨길 때의 쪽(그 해시로 돌아오면 "돌아온 것") · 숨은 채 다시 그렸는가 · 리더가 보일 때의 마지막 스크롤. */
  softFromPage: 0,
  hiddenRender: false,
  lastScrollY: 0,
  /** `[8g-4a-fix F1]` 검색 화면에서 리더로 오는 길 — 'back'(뒤로) | 'jump'(결과·[읽던 곳으로] — `noteSearchJump`). `softReturnPlan` 의 입력. */
  softEntry: 'back',

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

/** `[8g-4a — spec 17-8-12 §4-5]` DOM 을 새로 붙인 뒤(언어 바꿈 · 검색 화면에서 돌아와 다시 보임) — `notifyPage` 와 따로, 큐를 갈지 않는다. */
const repaintListeners = new Set();
/** 구독자는 `{docId, page, reason:'relabel'|'reshown'}` 를 받는다. 쪽을 새로 그리면(뷰 전환 포함) `onPageRender` 가 온다. */
export function onPageRepaint(fn) { repaintListeners.add(fn); return () => repaintListeners.delete(fn); }
/** `[8g-4a]` 리더를 정말로 떠났다(검색 화면으로 숨기기는 아니다) — 검색 강조 레지스트리를 지우게. */
const leaveListeners = new Set();
export function onReaderLeave(fn) { leaveListeners.add(fn); return () => leaveListeners.delete(fn); }

function notifyRepaint(reason) {
  for (const fn of repaintListeners) {
    try { fn({ docId: state.docId, page: state.page, reason: reason }); } catch (e) { /* 구독자 예외 */ }
  }
}
/** 구독자는 `{docId, page, refreshed?}` 를 받는다. `refreshed` 는 `[8i-1]` 같은 쪽을 새 판으로 다시 그렸을 때만 참. */
export function onPageRender(fn) { pageListeners.add(fn); return () => pageListeners.delete(fn); }

/** `[8i-1]` 지금 쪽 다시 그리기 문지기(1-b). */
const refreshGate = createRefreshGate(() => refreshCurrentPage());

/**
 * `[8i-1]` speaker 상태를 알려 준다(`ui/controls.js` — 리더는 speaker 를 import 하지 않는다).
 * 낭독 중이면 지금 쪽 다시 그리기를 미루고, 멈추면 미뤄 둔 것을 한다.
 */
export function setSpeechState(st) { refreshGate.speech(st); }

/**
 * `[8i-1c]` 지금 쪽을 읽어도 되는가 — 옛 판이 아니고, 새 판으로 **다시 그리는 중이 아니다**.
 * 다시 그리기는 저장본을 읽자마자 `stale` 을 내리지만 원본 보기는 canvas 그리기가 비동기라, 그 사이 재생이 시작되면
 * 뒤이은 `refreshed` 알림의 `reload()` 가 읽던 첫 문장을 처음부터 다시 읽었다(8i-1b 6-5 ①). 그래서 다시 그리는 렌더는
 * 시작부터 `notifyPage` 뒤까지 `refreshing` 을 세워 둔다. 평소 렌더는 `refreshing` 을 세우지 않는다 — 동작 불변.
 * **순수**(테스트가 고정).
 */
export function pageFresh(st) { return !!st && !st.stale && !st.refreshing; }

/** `[8i-1]` 지금 쪽 글자가 최신 판인가(speaker `view.ready`). 자리표시자·깨진 쪽은 참 — 그때 동작은 그대로. */
export function currentPageReady() { return pageFresh(state); }

/**
 * `[8i-1]` 지금 쪽이 새 판으로 다시 그려질 때까지(speaker `view.whenReady`). 상한 `TTS.FRESH_WAIT_MS`.
 * 그 사이 다른 쪽·문서로 가면 false.
 */
export function whenCurrentPageReady(timeoutMs) {
  if (pageFresh(state)) return Promise.resolve(true);
  const ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : TTS.FRESH_WAIT_MS;
  const docId = state.docId;
  const page = state.page;
  // `[8i-3]` 폴링 대신 렌더 끝 알림(`renderDone`)마다 판정한다 — 다른 쪽·문서로 가면 그 렌더의 끝에서 false.
  // `[8i-3b]` 판정식은 `freshWaitCheck`(순수 — 테스트가 같은 함수를 쓴다).
  return renderDone.wait(() => freshWaitCheck(state, pageFresh(state), docId, page), ms);
}

/**
 * `[8i-3b]` 새 판 대기(`whenCurrentPageReady`)의 렌더 끝 판정 — `renderDone.wait` 의 check. **순수**.
 *   st     리더 상태(`docId`·`page`)
 *   fresh  지금 쪽이 최신 판인가 — 부르는 쪽이 `pageFresh(state)` 로 잰다(옛 판·다시 그리는 중이면 거짓)
 * 기다리기 시작한 문서·쪽(`docId`·`page`)을 떠났으면 false, 최신이면 true(`[8i-1c]` 다시 그리기의 `refreshed` 알림 뒤에야),
 * 그 밖은 undefined(계속 기다림 — 상한 뒤 false).
 */
export function freshWaitCheck(st, fresh, docId, page) {
  if (st.docId !== docId || st.page !== page) return false;
  if (fresh) return true;
  return undefined;
}

/**
 * `[8i-3b]` 낭독이 넘어갈 쪽 `target` 을 지금 읽어도 되는가. **순수**.
 *   같은 쪽 · 글자(`desc`)가 있음(자리표시자·깨진 쪽은 없다) · `fresh`(부르는 쪽이 `pageFresh(state)` 로 잰다 — 옛 판·다시 그리는 중이면 거짓).
 * `goToPageForSpeech` 의 바로 풀기와 렌더 끝 판정(`pageTurnCheck`)이 같이 쓴다.
 */
export function speechPageReady(st, target, fresh) {
  return st.page === target && !!st.desc && !!fresh;
}

/**
 * `[8i-3b]` 쪽 넘김 대기(`goToPageForSpeech`)의 렌더 끝 판정 — `renderDone.wait` 의 check. **순수**.
 * 기다리던 문서(`docId`)·쪽(`target`)의 렌더 끝(`r`)이 아니면 undefined(계속 기다림). 그 렌더 끝에서 `speechPageReady` 면 true,
 * 아니면 undefined — 자리표시자(아직 추출 안 됨)·옛 판 렌더 끝에는 풀지 않고 다음 렌더 끝(또는 상한 뒤 false)을 기다린다.
 */
export function pageTurnCheck(st, fresh, r, docId, target) {
  if (r.docId !== docId || r.page !== target) return undefined;
  if (speechPageReady(st, target, fresh)) return true;
  return undefined;
}

/**
 * `[8i-3]` 렌더 끝 알림 대기열 — 쪽 렌더가 **다 그리고 구독자에게 알린(`notifyPage`) 뒤**, 기다리던 쪽을 깨운다.
 * 예전에는 200 ms 폴링이 `state.desc`(그리기 **앞**에서 선다)를 보고 풀려, 원본 보기에서 canvas 를 그리는 사이에
 * 다음 쪽 낭독이 시작되고 뒤이은 `notifyPage` 의 `reload()` 가 그 첫 문장을 처음부터 다시 읽었다(6b 부터).
 * `check(info)` 가 true → 참으로, false → 거짓으로 풀고, 그 밖(undefined)이면 계속 기다린다. 상한 `ms` 뒤 거짓.
 * **순수**(테스트가 고정) — 시계는 주입할 수 있다.
 */
export function createRenderDone(clock) {
  const c = clock || { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (k) => clearTimeout(k) };
  const waiters = new Set();
  return {
    wait(check, ms) {
      return new Promise((resolve) => {
        let timer = null;
        const w = (info) => {
          let v;
          try { v = check(info); } catch (e) { v = false; }
          if (v === true || v === false) done(v);
        };
        const done = (v) => {
          if (!waiters.has(w)) return;
          waiters.delete(w);
          if (timer !== null) { c.clearTimeout(timer); timer = null; }
          resolve(v);
        };
        waiters.add(w);
        timer = c.setTimeout(() => done(false), ms);
      });
    },
    /** 렌더 하나가 끝났다(`{docId, page}` — 그 렌더가 그린 쪽). 기다리던 것을 모두 한 번씩 판정한다. */
    settled(info) {
      for (const w of Array.from(waiters)) w(info || {});
    },
    size() { return waiters.size; }
  };
}

const renderDone = createRenderDone();

/** `[8i-1]` 새 판으로 다시 그린 뒤 옛 줄 id → 새 줄 id(speaker `view.remapLine`). 모르면 그대로. */
export function remapLineId(id) {
  if (id == null || !state.lineRemap) return id;
  const v = state.lineRemap.get(String(id));
  return v == null ? id : v;
}

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
    quizBtn: root.querySelector('#readerQuizBtn'),
    // `[8l]` 스캔본·깨짐 안내 띠(문서당 한 번)
    scanNotice: root.querySelector('#scanNotice'),
    scanNoticeText: root.querySelector('#scanNoticeText'),
    scanNoticeOriginal: root.querySelector('#scanNoticeOriginal'),
    scanNoticeClose: root.querySelector('#scanNoticeClose')
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
  // `[8g-4a]` 검색 — controls 의 `onPageRender`(speaker.reload) 구독 **뒤에** 등록돼야 한다(17-8-12 §4-5). `main.js` 는 범위 밖.
  initSearch();

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

  // 7c — 열린 문서의 **원문** 언어가 바뀌었다(서재 [⋯] 또는 자동 추정).
  document.addEventListener('medreader:doclang', (ev) => onDocLang(ev.detail || {}));
  // `[8p]` 열린 문서의 번역 문체가 바뀌었다(서재 [⋯]) — 레코드 값만 고친다. 큐·화면은 그대로(다음 요청부터).
  document.addEventListener('medreader:docdomain', (ev) => onDocDomain(ev.detail || {}));

  // `[8l]` 스캔본·깨짐 판정이 막 저장됐다(가져온 직후 — 리더가 이미 열려 있다) · 띠의 두 단추.
  document.addEventListener('medreader:docscan', (ev) => onDocScan(ev.detail || {}));
  if (els.scanNoticeClose) els.scanNoticeClose.addEventListener('click', () => dismissScanNotice(false));
  if (els.scanNoticeOriginal) els.scanNoticeOriginal.addEventListener('click', () => dismissScanNotice(true));
}

/* ── `[8l]` 스캔본·글자 깨짐 안내 띠 (spec 17-5-1 3 · 19-1-3 §3-3) ──────────────
   그 문서를 열 때 **문서당 한 번** — [닫기]·[원본 보기] 를 누르면 `documents.scan.noticed = true`(자기 필드만,
   `library.markScanNoticed`). 판정은 막는 것이 없다 — 안내만 하고 원본 보기·추출·낭독 시도는 그대로다. */

/** 지금 열린 문서의 판정(`documents.scan.verdict`) — 없으면 null. `ui/controls.js` 의 ▶ 갈래가 읽는다. */
export function docScanVerdict() {
  const s = state.doc && state.doc.scan;
  return s && typeof s.verdict === 'string' ? s.verdict : null;
}

function onDocScan(d) {
  if (!d || d.docId == null || String(d.docId) !== String(state.docId) || !state.doc) return;
  state.doc = Object.assign({}, state.doc, { scan: d.scan || null });
  paintScanNotice();
}

/** 띠를 지금 문서 상태대로 그린다(키가 없으면 숨김). 글자는 전부 i18n 키 → textContent. */
function paintScanNotice() {
  if (!els || !els.scanNotice) return;
  const key = els.root.hidden ? null : bandKey(state.doc);
  els.scanNotice.hidden = !key;
  if (!key) return;
  els.scanNotice.setAttribute('data-kind', state.doc.scan.verdict === 'garbled' ? 'garbled' : 'scan');
  if (els.scanNoticeText) {
    els.scanNoticeText.setAttribute('data-i18n', key);
    els.scanNoticeText.textContent = t(key);
  }
  if (els.scanNoticeOriginal) els.scanNoticeOriginal.disabled = original.originalUnavailable();
}

/** [닫기]·[원본 보기] — 띠를 닫고 `noticed` 를 저장한다. 저장 실패는 조용히(다음에 다시 뜰 뿐). */
function dismissScanNotice(toOriginal) {
  const docId = state.docId;
  if (state.doc && state.doc.scan) state.doc = Object.assign({}, state.doc, { scan: Object.assign({}, state.doc.scan, { noticed: true }) });
  if (els && els.scanNotice) els.scanNotice.hidden = true;
  if (docId != null) markScanNoticed(docId).catch(() => { /* 다음에 열 때 다시 뜬다 */ });
  if (toOriginal && !original.originalUnavailable()) setView('original', { persist: true });
}

/**
 * `[7c]` 원문 언어 변경 — 본문 `lang` 을 고치고, 쪽 구독자에게 알려 낭독 큐를 다시 만든다.
 * 쪽을 다시 그리지 않는다(글자는 그대로다). 값이 같으면 아무것도 하지 않는다 —
 * 낭독 중에 같은 언어로 "바뀌었다"고 큐를 갈면 읽던 문장이 처음부터 다시 나온다.
 */
function onDocLang(d) {
  if (!d || d.docId == null || String(d.docId) !== String(state.docId) || !state.doc) return;
  const next = typeof d.lang === 'string' && d.lang ? d.lang : 'en';
  const before = docLangOf(state.doc);
  state.doc = Object.assign({}, state.doc, { lang: next, langSource: d.langSource });
  if (next === before) return;
  // 리더를 떠나 있으면 고칠 화면이 없다 — 다음 `showReader` 가 레코드를 새로 읽는다.
  if (!els || els.root.hidden) return;
  const article = els && els.mount ? els.mount.querySelector('article.reflow') : null;
  if (article) article.setAttribute('lang', next);
  notifyPage();
}

/**
 * `[7c]` 지금 열린 문서의 원문 언어(`documents.lang`, 없으면 `'en'`).
 * 원문 음성(`controls.applySourceSpeech` → `resolveSpeech(sourceLang(), …)`)·낭독 큐의 언어가 이것을 읽는다.
 */
export function sourceLang() { return docLangOf(state.doc); }

/**
 * `[8p — spec 19-1-3 §7]` 지금 열린 문서의 번역 문체(`documents.domain`, 없으면 `'medical'`).
 * 낭독 동반 번역(`controls.syncReadalong` → `readalong.setDoc`)이 읽어 요청 지시문에 넘긴다.
 */
export function docDomain() { return domainOf(state.doc); }

/** `[8p]` 번역 문체 변경 — 레코드 값만. 쪽을 다시 그리거나 큐를 갈지 않는다(글자·낭독 단위는 그대로다). */
function onDocDomain(d) {
  if (!d || d.docId == null || String(d.docId) !== String(state.docId) || !state.doc) return;
  state.doc = Object.assign({}, state.doc, { domain: domainOf(d) });
}

function onAnyScroll() {
  if (!els || els.root.hidden) return;
  // `[8g-4a]` 검색 화면으로 숨길 때 되돌릴 자리 — 숨긴 뒤에는 창 높이가 바뀌어 scrollY 가 이미 잘려 있다.
  state.lastScrollY = window.scrollY || 0;
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

  // `[8g-4a — spec 17-8-12 §4-5]` 검색 화면에서 돌아왔다 — 숨겨 둔 리더(DOM·낭독)가 그대로 살아 있다.
  // `[8g-4a-fix F1]` 판정은 순수 `softReturnPlan` — 뒤로 돌아옴과 결과로 이동(`noteSearchJump`)을 `softEntry` 로 가른다.
  const plan = softReturnPlan({
    soft: state.soft, sameDoc: state.docId === docId, entry: state.softEntry, wanted: wanted,
    fromPage: state.softFromPage, page: state.page, hiddenTurn: state.hiddenTurn,
    hasDom: !!els.mount.firstChild, stalePaint: state.view === 'original' && state.hiddenRender
  });
  state.softEntry = 'back';
  // 숨어 있는 동안 낭독이 쪽을 넘겼고 떠났던 쪽으로 돌아왔다(Android 뒤로) — 화면은 낭독이 간 쪽이다. 해시를 그쪽으로.
  if (plan === 'follow') {
    state.hiddenTurn = false;
    replace(readerHash(docId, state.page));
    return;
  }
  if (plan === 'reshow') {
    reshowReader(doc);
    return;
  }
  // `[8g-4b — 8g-4a Review F3 · spec 17-8-12 §4-5]` 숨은 리더에서 **다른 책**으로(서재 범위 결과) — 숨기기만 했던 리더를 정말로
  // 떠난 것처럼 정리한다(낭독 멈춤·번역 띠·원본 보기·다시 그리기 문지기). 안 하면 빈 번역 띠가 남았다.
  if (state.soft && state.docId !== docId) leaveReaderNow();
  state.soft = false;
  state.hiddenTurn = false;
  state.hiddenRender = false;

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
  paintScanNotice();          // `[8l]`

  await renderPage();
  await saveLastPage();

  // 백그라운드 추출을 되살린다(9-4). pdf.js 로드가 화면을 붙잡지 않도록
  // 그리기가 끝난 뒤에 부른다.
  wireExtractor(docId).catch((e) => banner(e, 'ERR_UNKNOWN'));
}

/**
 * `[8g-4a-fix F1]` 검색 화면에서 리더로 올 때 숨은 리더를 어떻게 보일지 — **순수**(tests/search-jump-8g4afix.test.mjs 가 같은 함수를 쓴다).
 * - `'follow'` — **뒤로** 돌아왔고(entry `'back'`) 숨은 동안 낭독이 쪽을 넘겼고 떠났던 쪽 해시로 왔다 → 해시를 낭독이 간 쪽으로 바꿔 쓴다.
 * - `'reshow'` — 숨은 리더가 바로 그 쪽을 그려 두었다 → 다시 그리지 않고 보이기만(낭독이 읽던 문장을 처음부터 다시 읽지 않게).
 * - `'render'` — 그 밖. **결과로 이동**(entry `'jump'`)은 숨은 동안 넘어간 쪽과 상관없이 원하는 쪽을 그린다(F1: 떠났던 쪽 결과 → 다음 쪽이 열렸다).
 * @param {{soft:boolean, sameDoc:boolean, entry:('back'|'jump'), wanted:number, fromPage:number, page:number,
 *          hiddenTurn:boolean, hasDom:boolean, stalePaint:boolean}} o  stalePaint = 원본 보기를 숨은 채 다시 그렸다(canvas 를 다시 그려야 한다)
 * @returns {'follow'|'reshow'|'render'}
 */
export function softReturnPlan(o) {
  if (!o || !o.soft || !o.sameDoc) return 'render';
  if (o.entry !== 'jump' && o.hiddenTurn && o.wanted === o.fromPage && o.page !== o.wanted) return 'follow';
  if (o.page === o.wanted && o.hasDom && !o.stalePaint) return 'reshow';
  return 'render';
}

/**
 * `[8g-4a-fix F1]` 검색이 결과(·[읽던 곳으로])로 **해시를 바꾸기 직전**에 부른다(`search.beginJump` 의 `env.mark`) — 다음 `showReader` 는
 * 뒤로 돌아옴이 아니라 이동이다. 리더가 숨어 있을 때만 의미가 있다(보이는 리더는 `softReturnPlan` 이 어차피 'render').
 */
export function noteSearchJump() {
  if (state.soft) state.softEntry = 'jump';
}

/**
 * `[8g-4a]` 숨겨 둔 리더를 다시 보인다(검색 화면에서 뒤로·같은 쪽 결과) — 다시 그리지 않는다(다시 그리면 낭독이 읽던
 * 문장을 처음부터 다시 읽는다). 스크롤을 되돌리고 `onPageRepaint` 로 알린다(검색이 강조를 다시 칠한다).
 */
function reshowReader(doc) {
  state.soft = false;
  state.hiddenTurn = false;
  if (doc) state.doc = doc;
  els.title.textContent = (state.doc && (state.doc.title || state.doc.fileName)) || '';
  paintPager();
  paintProgressBar();
  paintScanNotice();          // `[8l]` 숨은 동안 판정이 왔을 수 있다
  const y = state.hiddenRender ? 0 : state.softScrollY;
  state.hiddenRender = false;
  state.programScrollAt = Date.now();
  try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); }
  if (state.relabelPending) { state.relabelPending = false; relabelReader(); return; }
  notifyRepaint('reshown');
}

/** `[8g-4a]` 리더 → 검색 화면인가(리더가 살아 있고 해시가 검색). 그때는 숨기기만 한다. */
function searchOverReader() {
  if (!els || state.docId == null || !els.mount || !els.mount.firstChild) return false;
  try { return parseRoute(typeof location !== 'undefined' ? location.hash : '').name === 'search'; } catch (e) { return false; }
}

/** 리더를 떠날 때 — 팝오버를 닫고 DOM 을 비운다(7000쪽 메모리). */
export function leaveReader() {
  // `[8g-4a — spec 17-8-12 §4-5]` 검색 화면으로 갈 때는 **숨기기만** 한다 — 낭독은 이어지고(결과를 누를 때 멈춘다),
  // 돌아오면(Android 뒤로) 그 화면 그대로다. 검색 화면에서 다른 곳으로 가면 그때 정말로 떠난다(아래).
  if (searchOverReader()) {
    if (!state.soft) { state.softScrollY = state.lastScrollY; state.softFromPage = state.page; }
    state.soft = true;
    state.softEntry = 'back';
    closeTypeset();
    return;
  }
  leaveReaderNow();
}

/** 리더를 정말로 떠난다 — `leaveReader`(검색 화면이 아닐 때)와 `[8g-4b F3]` 숨은 리더에서 다른 책으로 갈 때. */
function leaveReaderNow() {
  state.soft = false;
  state.softEntry = 'back';
  state.hiddenTurn = false;
  state.hiddenRender = false;
  state.relabelPending = false;
  for (const fn of leaveListeners) { try { fn(); } catch (e) { /* 구독자 예외 */ } }
  closeTypeset();
  // 리더를 떠나면 낭독도 멈춘다 — 서재에서 소리가 계속 나면 안 된다.
  leaveControls();
  if (els && els.mount) clear(els.mount);
  if (els && els.quizChip) els.quizChip.hidden = true;
  if (els && els.scanNotice) els.scanNotice.hidden = true;   // `[8l]`
  original.leaveOriginal();
  state.desc = null;
  state.layout = null;
  state.stale = false;
  state.refreshing = 0;
  state.lineRemap = null;
  refreshGate.left();
  // `[8i-3]` 폴링 시절처럼 떠난 순간의 상태로 기다리던 것을 판정한다(쪽 넘김은 `desc` 가 없어 상한 뒤 false).
  renderDone.settled({ docId: state.docId, page: null });
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

/**
 * @param {Object} [opts]
 * @param {Object} [opts.refresh] `[8i-1]` 같은 쪽을 새 판으로 다시 그린다 — `captureView()` 가 잡은 옛 화면
 *                                (옛 layout · 스크롤 기준 줄). 줄 id 를 옮기고 스크롤을 지키고 구독자에게 `refreshed` 를 알린다.
 */
async function renderPage(opts) {
  const cap = (opts && opts.refresh) || null;
  const token = ++state.renderToken;
  const docId = state.docId;
  const pageNo = state.page;
  // `[8i-1c]` 다시 그리기는 **시작부터** 지금 쪽을 "준비 안 됨"으로 둔다(`pageFresh`) — 저장본을 읽는 동안·그리는 동안
  // 재생이 시작되면 뒤이은 `refreshed` 의 `reload()` 가 첫 문장을 다시 읽는다. 끝(`notifyPage` 뒤)에서 내린다.
  if (cap) state.refreshing = token;

  let rec = null;
  try {
    rec = await db.get('pages', [docId, pageNo]);
  } catch (e) {
    if (token === state.renderToken) { state.refreshing = 0; renderDone.settled({ docId: docId, page: pageNo }); }
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
  // `[8i-1]` 방금 읽은 저장본이 옛 판이면 이 쪽 저장을 따라간다(1-b). 최신을 읽었으니 미뤄 둔 다시 그리기는 버린다.
  state.stale = isStaleRecord(rec);
  // `[8i-1c]` 이 렌더가 지금 쪽의 주인이다 — 다시 그리기면 계속 세워 두고, 평소 렌더면(앞 다시 그리기가 버려졌어도) 내린다.
  state.refreshing = cap ? token : 0;
  state.lineRemap = null;
  refreshGate.shown(docId, pageNo, state.stale);

  if (!rec) {
    // 아직 추출되지 않은 쪽 — **빈 화면을 보여주지 않는다**(12-3).
    state.refreshing = 0;
    state.desc = null;
    state.layout = null;
    els.mount.appendChild(preparingBlock());
    paintViewToggle();
    renderDone.settled({ docId: docId, page: pageNo });   // `[8i-3]` 렌더 끝 — 기다리던 쪽 판정(이 쪽은 아직 읽을 것이 없다)
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
    state.stale = false;
    state.refreshing = 0;
    els.mount.appendChild(noticeBlock('reader.page.broken'));
    paintViewToggle();
    renderDone.settled({ docId: docId, page: pageNo });
    return;
  }
  if (cap && cap.layout) {
    state.lineRemap = buildLineRemap(cap.layout, layout);
    state.lastTappedLineId = remapLineId(state.lastTappedLineId);
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
  try {
    await paintView(token);
    if (token !== state.renderToken) return;
    if (cap) restoreView(cap);
    notifyPage(cap ? { refreshed: true } : null);
  } finally {
    // `[8i-1c]` 그리기와 `refreshed` 알림(큐를 새 판으로 갈았다)이 끝난 **뒤에야** 지금 쪽이 준비됨 — 기다리던 재생이
    // 여기서 풀린다. 더 새 렌더가 시작했으면 그 렌더가 정한다(역할 재계산 다시 그리기가 겹친 경우).
    if (token === state.renderToken && state.refreshing === token) state.refreshing = 0;
    // `[8i-3]` 그리기·`notifyPage`(큐를 이 쪽 것으로 갈았다)·`refreshing` 내림 **뒤** — 기다리던 쪽 넘김·새 판 대기가 여기서 풀린다.
    // 버려진 렌더(token 이 밀림)는 알리지 않는다 — 마지막 렌더가 알린다.
    if (token === state.renderToken) renderDone.settled({ docId: docId, page: pageNo });
  }
  // `[8i-1]` 옛 판을 읽는 사이에 새 판이 이미 저장됐을 수 있다(이벤트가 `shown` 보다 먼저 왔다) — 따라잡는다.
  if (state.stale && token === state.renderToken) catchUpStale();
}

/** `[8i-1]` 추출기가 지금 쪽을 이미 최신 판으로 저장했는데 화면이 옛 판이면 다시 그리기를 청한다. */
function catchUpStale() {
  if (!state.stale || !state.docId) return;
  const ex = extractorFor(state.docId);
  if (ex && typeof ex.hasCurrent === 'function' && ex.hasCurrent(state.page)) refreshGate.saved(state.docId, state.page);
}

/**
 * `[8i-1]` 지금 쪽을 새 판으로 다시 그린다(문지기가 부른다 — 낭독 중이 아닐 때만).
 * 화면을 비우기 **전에** 스크롤 기준을 잡는다.
 */
async function refreshCurrentPage() {
  if (!els || els.root.hidden || !state.docId) return;
  await renderPage({ refresh: captureView() });
}

/** 다시 그리기 직전의 화면 — 옛 layout, 리플로우면 가운데 줄과 그 화면 위치, 원본이면 스크롤 상자 위치. */
function captureView() {
  const cap = { layout: state.layout, view: state.view, anchorId: null, anchorTop: 0, scrollY: 0, orig: null };
  try { cap.scrollY = window.scrollY || window.pageYOffset || 0; } catch (e) { cap.scrollY = 0; }
  if (state.view === 'original') {
    const sc = els && els.mount ? els.mount.querySelector('.original-scroll') : null;
    if (sc) cap.orig = { top: sc.scrollTop, left: sc.scrollLeft };
    return cap;
  }
  const seen = visibleNow();
  const id = seen.center || (seen.visible.length ? seen.visible[0] : null);
  const node = id ? lineElement(id) : null;
  if (node) { cap.anchorId = String(id); cap.anchorTop = node.getBoundingClientRect().top; }
  return cap;
}

/** 다시 그린 뒤 — 같은 줄(새 id)이 같은 화면 높이에 오게 한다. 못 찾으면 옛 스크롤 값으로. */
function restoreView(cap) {
  if (!cap || cap.view !== state.view) return;
  state.programScrollAt = Date.now();          // 우리가 굴린 것 — 사용자 스크롤로 읽지 않게(6-5)
  if (state.view === 'original') {
    const sc = els.mount.querySelector('.original-scroll');
    if (sc && cap.orig) { sc.scrollTop = cap.orig.top; sc.scrollLeft = cap.orig.left; }
    return;
  }
  const node = cap.anchorId ? lineElement(remapLineId(cap.anchorId)) : null;
  if (node) {
    const dy = node.getBoundingClientRect().top - cap.anchorTop;
    if (Math.abs(dy) >= 1) {
      try { window.scrollBy({ top: dy, behavior: 'instant' }); } catch (e) { window.scrollBy(0, dy); }
    }
    return;
  }
  try { window.scrollTo({ top: cap.scrollY, behavior: 'instant' }); } catch (e) { window.scrollTo(0, cap.scrollY); }
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

/** `[8g-4b — F2]` 뷰 전환 기준 줄의 힌트(검색 — 지금 칠해 둔 고른 적중 줄 id 또는 null). 리더는 search 를 import 하지 않는다. */
let viewAnchorHint = null;
export function setViewAnchorHint(fn) { viewAnchorHint = typeof fn === 'function' ? fn : null; }

/**
 * `[8g-4b — F2]` 힌트 줄을 기준 줄로 쓸 수 있는가 — 이 쪽 흐름 줄이고 **지금 보인다**(사용자가 다른 곳으로 굴렸으면 그 자리를 지킨다).
 * **순수**(tests/search-toc-8g4b.test.mjs). 아니면 null(평소 규칙 `pickAnchorLine`).
 */
export function hintedAnchor(hint, visible, flowIds) {
  if (hint == null) return null;
  const id = String(hint);
  if (!id || !Array.isArray(visible) || visible.indexOf(id) < 0) return null;
  if (!Array.isArray(flowIds) || flowIds.indexOf(id) < 0) return null;
  return id;
}

/** 뷰를 바꾸기 **직전**에 지금 화면이 아는 사실을 모아 기준 줄을 고른다. */
function resolveAnchor() {
  const seen = visibleNow();
  // `[8g-4b — 8g-4a Review F2]` 검색이 칠해 둔 적중 줄이 지금 보이면 그 줄을 지킨다(원본 보기는 쪽 전체가 한 화면이라
  // 가운데 줄이 적중이 아니었다 — 리플로우로 돌아오면 적중이 화면 밖이었다).
  let hinted = null;
  try { hinted = viewAnchorHint ? viewAnchorHint() : null; } catch (e) { hinted = null; }
  const hit = hintedAnchor(hinted, seen.visible, flowLineIds());
  if (hit) return hit;
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
function notifyPage(extra) {
  for (const fn of pageListeners) {
    try { fn(Object.assign({ docId: state.docId, page: state.page }, extra || null)); } catch (e) { /* 구독자 예외 */ }
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
  // 11-3 — UI 가 아랍어여도 원서 본문은 LTR 이다. `[7c]` lang 은 문서의 원문 언어.
  article.setAttribute('dir', 'ltr');
  article.setAttribute('lang', sourceLang());

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

  // `[8l — 17-5-1 3]` 블록이 0개인 쪽 — **문서 판정과 무관하게** 안내 + [원본 보기](CMDT 2021 앞붙이에도 쓸모 있다).
  // 옛 키 `reader.page.empty` 는 남겨 두고 쓰지 않는다(10단계 i18n 정리 때 지운다).
  if (!blocks.length) section.appendChild(noTextNotice());

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
  // [8i — spec 4-13-5 · D4] 행 표 이름표 끝의 쪽 번호. `.line` 이 아니다 — 하이라이트·탭·낭독이 닿지 않는다.
  if (b.refs && b.refs.length) {
    const r = el('span', 'rt-ref');
    r.textContent = b.refs.join(' · ');
    p.appendChild(r);
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

/** `[8l]` 빈 쪽 안내 — 문구 + [원본 보기]. 원본 보기를 못 쓰면 단추를 끈다. */
function noTextNotice() {
  const box = el('div', 'page-notext');
  box.appendChild(noticeBlock('reader.page.noText'));
  const b = el('button', 'page-notext-original');
  b.type = 'button';
  b.setAttribute('data-i18n', 'reader.view.original');
  b.textContent = t('reader.view.original');
  b.disabled = original.originalUnavailable();
  b.addEventListener('click', () => { if (!original.originalUnavailable()) setView('original', { persist: true }); });
  box.appendChild(b);
  return box;
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
  // 부팅 직후 첫 `showReader` 가 문서를 정하기 전에 누르면 `#/reader/null/N` 으로 갔다가 서재로 튕겼다(review.md PR-4-6).
  if (!state.docId) return;
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
    const res = await writeLastPage(docId, page, lineId);
    // 다른 문서로 옮겨 갔으면 그 문서의 state.doc 을 덮지 않는다.
    if (res.wrote && state.docId === docId) state.doc = res.rec;
  } catch (e) {
    // 위치 저장 실패로 읽기를 막지 않는다. 다음 쪽에서 다시 시도된다.
  }
}

/**
 * `[P1 경합]` 마지막 위치 쓰기 — **자기 필드(`lastPage`·`lastLineId`)만** 한 트랜잭션에서 합친다.
 * 예전에는 미리 읽은 레코드를 통째로 `put` 해서, 그사이 서재 [⋯] 에서 고른 원문 언어를
 * 옛 값으로 되돌렸다(review.md 7c8-5 재현). 같으면 쓰지 않는다.
 * @returns {Promise<{wrote:boolean, rec:Object|null}>}
 */
export function writeLastPage(docId, page, lineId) {
  return db.patch('documents', docId, (cur) => {
    if (Number(cur.lastPage) === page && cur.lastLineId === lineId) return null;
    return { lastPage: page, lastLineId: lineId };
  });
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
      if (Number(e.detail.pageNo) === state.page && !state.desc) { renderPage(); return; }
      // `[8i-1]` 옛 판으로 그린 쪽의 새 판이 저장됐다 — 문지기가 판단한다(지금 쪽·따라가는 쪽만, 낭독 중이면 미룸).
      refreshGate.saved(docId, Number(e.detail.pageNo));
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
  // `[8i-1]` 배선 전에 지금 쪽 새 판이 이미 저장됐을 수 있다(이벤트를 놓쳤다).
  catchUpStale();
  scheduleOutline(docId, ex);
}

/**
 * `[8g-3]` 첫 그리기·추출기 배선 **뒤** 한가할 때 한 번 `outline.ensure` — 이미 읽은 책(`outlineV`)은 부르지 않는다.
 * 실패·다른 책으로 감은 조용히 넘긴다(리더에 영향 0) — 다음에 이 책을 그릴 때 다시 시도한다.
 */
function scheduleOutline(docId, ex) { outlineScheduler.schedule(docId, ex); }

/**
 * `[8g-4b — 8g-3 Review 5절 · carryover 13]` 개요 읽기 예약의 몸통 — **순수 공장**(주입: 이미 읽었나 · 지금 책 · 읽기 · 한가할 때).
 * 테스트가 가짜 `requestIdleCallback` 으로 행동을 본다(예전 테스트는 소스 정규식이라 R8·R9 변이가 살아남았다).
 *   - 이미 읽은 책·같은 책이 이미 예약됨 → 예약하지 않는다(false)
 *   - 한가할 때 돈다 — 그때 **예약 표시를 풀고**(실패한 책은 다음 그리기에서 다시 시도), 다른 책으로 갔거나 pdf 문서가 없으면 읽지 않는다
 *   - 읽기 실패는 조용히(리더에 영향 0) · 예약 자체가 던지면 표시를 푼다
 */
export function createOutlineScheduler(deps) {
  let queued = null;
  return {
    schedule(docId, ex) {
      if (deps.isCurrent() || queued === docId) return false;
      queued = docId;
      const run = () => {
        if (queued === docId) queued = null;
        if (deps.docId() !== docId || !ex || !ex.pdfDoc) return;
        Promise.resolve().then(() => deps.ensure(docId, ex.pdfDoc)).catch(() => { /* 조용히 — 다음 기회에 */ });
      };
      try { deps.idle(run); } catch (e) { queued = null; }
      return true;
    },
    queued() { return queued; }
  };
}

/** 한가할 때 한 번(`requestIdleCallback` 상한 5초, 없으면 1.5초 뒤). 테스트가 가짜 전역으로 부른다. */
export function outlineIdle(fn) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 5000 });
  else setTimeout(fn, 1500);
}

const outlineScheduler = createOutlineScheduler({
  isCurrent: () => isOutlineCurrent(state.doc),
  docId: () => state.docId,
  ensure: (docId, pdfDoc) => ensureOutline(docId, pdfDoc),
  idle: outlineIdle
});

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

/* ────────────────────────────────────────────────────────
   `[8g-4a — spec 17-8-12 §4-3 · §4-5]` 검색이 쓰는 계약 — 읽던 자리 · 지금 화면 · 결과로 굴리기
   ──────────────────────────────────────────────────────── */

/**
 * 읽던 자리 — 검색 화면을 열 때 기억한다([읽던 곳으로]). 낭독 하이라이트가 있으면(낭독 중·멈춤) 그 단위의 첫 줄·글자,
 * 없으면 화면 가운데 줄(원본 보기도 같은 판정 `visibleNow`).
 * @returns {{docId:string, page:number, lineId:(string|null), start:number, speaking:boolean}|null}
 */
export function readingSpot() {
  if (!els || state.docId == null) return null;
  const sp = speechState();
  let lineId = null;
  let start = 0;
  if (state.currentLineIds.length) {
    lineId = String(state.currentLineIds[0]);
    const r = Array.isArray(state.currentRanges) ? state.currentRanges.find((x) => x && String(x.id) === lineId) : null;
    start = r ? Number(r.start) || 0 : 0;
  } else {
    const seen = visibleNow();
    lineId = seen.center || (seen.visible.length ? seen.visible[0] : null) || firstFlowLineId();
  }
  return { docId: state.docId, page: state.page, lineId: lineId == null ? null : String(lineId), start: start, speaking: sp === 'speaking' || sp === 'waiting-page' };
}

/**
 * 지금 그려진 쪽 — 검색이 그 쪽 **화면 글자**에서 적중을 다시 찾는다(검색 레코드 `text` 와 같은 함수 `flowParasOf(desc)`).
 * `ready` = 글자가 있는 쪽이 그려져 있다(자리표시자·깨진 쪽은 거짓). `visible` = 리더가 보인다(검색 화면 뒤가 아니다).
 */
export function currentScreen() {
  if (!els || state.docId == null) return null;
  return {
    docId: state.docId, page: state.page, view: state.view, desc: state.desc, layout: state.layout,
    lang: sourceLang(), ready: !!state.desc && !!els.mount.firstChild, visible: !els.root.hidden && !state.soft
  };
}

/**
 * 결과로 굴리기 — 그 줄(구간 `range` 가 있으면 그 글자들)을 **보이는 본문 영역의 세로 가운데**로(S23 ±20%).
 * `programScrollAt` 을 세운다(6-5 — 사용자 스크롤로 읽지 않게). 원본 보기는 그 줄로 굴리고, 낭독 하이라이트가 없으면
 * 기존 줄 오버레이로 그 줄을 보인다(글자 구간은 리플로우 전용 — 17-8-8).
 */
export function revealLine(lineId, range) {
  if (!els || lineId == null) return false;
  state.programScrollAt = Date.now();
  if (state.view === 'original') {
    const ok = original.scrollToLine(String(lineId));
    if (!state.currentLineIds.length) original.setCurrentOriginal([String(lineId)], range ? [range] : null);
    return ok;
  }
  const node = lineElement(lineId);
  if (!node) return false;
  let rect = null;
  const tn = node.firstChild;
  if (range && tn && tn.nodeType === 3 && typeof document.createRange === 'function') {
    try {
      const rg = document.createRange();
      rg.setStart(tn, Math.min(tn.length, Math.max(0, Number(range.start) || 0)));
      rg.setEnd(tn, Math.min(tn.length, Math.max(0, Number(range.end) || 0)));
      const r = rg.getBoundingClientRect();
      if (r && r.height > 0) rect = r;
    } catch (e) { rect = null; }
  }
  if (!rect) rect = node.getBoundingClientRect();
  centerRect(rect);
  return true;
}

/** 표 적중 — 그 표 크롭(`figure[data-region-id]`)을 본문 가운데로. 원본 보기는 그 표 자리로. */
export function revealRegion(regionId) {
  if (!els || regionId == null) return false;
  state.programScrollAt = Date.now();
  if (state.view === 'original') return original.scrollToRegion(String(regionId));
  const figs = els.mount.querySelectorAll('figure[data-region-id]');
  for (let i = 0; i < figs.length; i++) {
    if (figs[i].getAttribute('data-region-id') !== String(regionId)) continue;
    const r = figs[i].getBoundingClientRect();
    const vh = window.innerHeight || 0;
    const area = bodyArea(vh);
    // 표는 키가 클 수 있다 — 가운데가 아니라 머리를 본문 영역 위쪽에
    const dy = r.top - (area.top + BODY_EDGE_PX * 4);
    try { window.scrollBy({ top: dy, behavior: 'instant' }); } catch (e) { window.scrollBy(0, dy); }
    return true;
  }
  return false;
}

/** 다시 찾지 못했다 — 쪽 맨 위로(17-8-3 "틀린 강조보다 강조 없음"). */
export function revealTop() {
  if (!els) return;
  state.programScrollAt = Date.now();
  if (state.view === 'original') { const sc = els.mount.querySelector('.original-scroll'); if (sc) sc.scrollTop = 0; }
  try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
}

function centerRect(rect) {
  const vh = window.innerHeight || 0;
  if (!vh || !rect) return;
  const area = bodyArea(vh);
  const want = area.top + (area.bottom - area.top) / 2 - rect.height / 2;
  const dy = rect.top - want;
  if (Math.abs(dy) < 1) return;
  try { window.scrollBy({ top: dy, behavior: 'instant' }); } catch (e) { window.scrollBy(0, dy); }
}

/**
 * ★ 5단계 낭독 큐의 입력. 지금 쪽의 **문단**을 읽기 순서로 준다.
 * `lines[i].hyphen` 이 "다음 줄과 어떻게 잇는가"이고, `tts/text.js` 가 그것으로
 * `cardio-` 의 `-` 를 털어 한 발화로 묶는다.
 */
export function flowParas() {
  const blocks = (state.desc && state.desc.blocks) || [];
  // 4-8 (3) — 표 자리에 안내 한 마디를 끼운다. 이미 말한 표는 빠진다.
  return insertTableNotices(flowParasOf(state.desc), blocks, state.announcedTables, t('reader.tts.tableSkipped'));
}

/**
 * ★ `[8b-1]` spec 7-8-2 원칙 2 — 낭독 동반 번역(`ai/readalong.js`)에 주입하는 `loadParas(n)`.
 * 서비스가 화면 계층을 import 하지 않도록 리더가 대신 읽어 준다(3-2). 지금 쪽과 **같은 함수**
 * (`flowParasOf(describePage(fromStored(rec)))`)를 지난다 — 표 안내는 끼우지 않는다(번역 입력이 아니다).
 * 아직 추출되지 않은 쪽·깨진 저장본·문서가 없으면 **null**(서비스가 그 경계에서 끊는다 — 기다리지 않는다).
 * 추출 우선순위는 건드리지 않는다(7-8-3).
 * @param {number} pageNo
 * @returns {Promise<Array|null>}
 */
export async function loadFlowParas(pageNo) {
  const docId = state.docId;
  const n = Math.floor(Number(pageNo));
  if (docId == null || !Number.isFinite(n) || n < 1) return null;
  if (state.pageCount > 0 && n > state.pageCount) return null;
  let rec = null;
  try { rec = await db.get('pages', [docId, n]); } catch (e) { return null; }
  if (!rec || state.docId !== docId) return null;
  try { return flowParasOf(describePage(fromStored(rec))); } catch (e) { return null; }
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

  // `[8g-4a]` 검색 화면 뒤에 숨어 있으면 굴리지 않는다 — 창 스크롤은 지금 검색 화면의 것이다.
  if (!state.scrollPaused && settings.get('reader.autoScroll') !== false && !els.root.hidden) scrollToCurrent(false);
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
  // `[8b-2]` 6-5 — 편안 영역은 창 높이가 아니라 **보이는 본문 영역**(상단바 아래 ~ 하단 바·자막 띠 위)의 30~65% 다.
  // 띠가 켜지면 창 높이의 65% 가 띠 아래에 떨어질 수 있다(12-3 수치). 그리고 문장의 **끝**이 띠에 가려도
  // 편안 영역 밖으로 본다(16-D3 B4 — 끝 줄 아래변 ≤ 띠 윗변 − 4px). 잣대는 줄 상자가 아니라 **칠해진 문장**이다 —
  // 큰 글자에서 원서 한 줄(`span.line`)은 화면 여러 줄로 접히고 문장은 그 중간에서 시작·끝난다.
  const area = bodyArea(vh);
  const h = area.bottom - area.top;
  const ext = sentenceExtent(node);
  const inComfort = ext.top >= area.top + h * TTS.COMFORT_TOP && ext.firstBottom <= area.top + h * TTS.COMFORT_BOTTOM &&
    ext.bottom <= area.bottom - BODY_EDGE_PX;
  if (inComfort && !force) return;

  state.programScrollAt = Date.now();
  const behavior = reducedMotion() ? 'auto' : 'smooth';
  // 첫 화면 줄을 본문 영역 가운데로(옛 동작과 같은 자리). 그 자리에서 문장 끝이 띠·하단 바에 닿는 긴 문장이면
  // 끝이 본문 영역 안에 오도록 올리고, 그래도 영역보다 길면 시작을 영역 맨 위에 둔다(읽기 시작점이 먼저다).
  const rowH = ext.firstBottom - ext.top;
  const sh = ext.bottom - ext.top;
  let want = area.top + h / 2 - rowH / 2;
  if (want + sh > area.bottom - BODY_EDGE_PX * 2) want = area.bottom - BODY_EDGE_PX * 2 - sh;
  if (want < area.top + BODY_EDGE_PX) want = area.top + BODY_EDGE_PX;
  const dy = ext.top - want;
  try { window.scrollBy({ top: dy, behavior: behavior }); } catch (e) { window.scrollBy(0, dy); }
}

/**
 * `[8b-2]` 지금 문장이 화면에서 차지하는 세로 범위 `{top, bottom, firstBottom}`(px).
 * 글자 구간 하이라이트(10a)가 칠해져 있으면 그 Range 들의 상자, 아니면 줄 요소들의 상자.
 */
function sentenceExtent(firstNode) {
  let rects = [];
  try {
    const hl = charhl.highlightsSupported() ? CSS.highlights.get(HL_NAME) : null;
    if (hl && state.currentRanges) hl.forEach((rg) => { rects.push(...Array.from(rg.getClientRects())); });
  } catch (e) { rects = []; }
  rects = rects.filter((q) => q.width > 0 && q.height > 0);
  if (!rects.length) {
    for (let i = 0; i < state.currentLineIds.length; i++) {
      const n = lineElement(state.currentLineIds[i]);
      if (n) rects.push(...Array.from(n.getClientRects()));
    }
    rects = rects.filter((q) => q.height > 0);
  }
  if (!rects.length) { const r = firstNode.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, firstBottom: r.bottom }; }
  const trb = els.mount.querySelector('.ra-tr[data-ra-current]'); if (trb && trb.getBoundingClientRect().height > 0) rects.push(trb.getBoundingClientRect());   // `[8d — 7-7-1 · 6-5]` 잣대 = 문장 + 지금 번역 블록
  let top = Infinity;
  let bottom = -Infinity;
  for (const q of rects) { if (q.top < top) top = q.top; if (q.bottom > bottom) bottom = q.bottom; }
  // 첫 화면 줄 — 맨 위 상자와 세로로 겹치는 상자들의 아래변
  let firstBottom = top;
  for (const q of rects) if (q.top < top + 1 && q.bottom > firstBottom) firstBottom = q.bottom;
  return { top: top, bottom: bottom, firstBottom: firstBottom };
}

/** `[8b-2]` 본문 끝 줄과 띠 사이에 남기는 틈(16-D3 B4 "띠 윗변 − 4px"). */
const BODY_EDGE_PX = 4;

/**
 * `[8b-2]` 6-5 보이는 본문 영역 `[--bar-top, innerHeight − --reader-chrome-bottom − safe-area]`(px).
 * 아래 경계는 **토큰을 그대로 쓰는 탐침**의 윗변으로 잰다 — 띠가 켜지면(`<html data-tr-band="on">`)
 * 토큰이 늘어나 경계가 저절로 올라간다. 계산식을 JS 에 두 벌 두지 않는다.
 */
function bodyArea(vh) {
  let top = 0;
  try { top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-top')) || 0; } catch (e) { top = 0; }
  // `[8g-4a]` 검색 띠(상단바 아래에 붙는다)가 보이면 본문 영역은 그 아래부터.
  const band = els && els.root ? els.root.querySelector('#searchBand') : null;
  if (band && !band.hidden) {
    const br = band.getBoundingClientRect();
    if (br.height > 0) top = Math.max(top, br.bottom);
  }
  let bottom = vh;
  const probe = chromeProbe();
  if (probe) {
    const pr = probe.getBoundingClientRect();
    if (pr.height > 0) bottom = Math.min(vh, pr.top);
  }
  return { top: top, bottom: Math.max(top + 1, bottom) };
}

/** 아래 크롬 높이 탐침 — 보이지 않고 눌리지 않는 고정 상자 하나(reader.css `.chrome-probe`). */
function chromeProbe() {
  if (!els || !els.root) return null;
  let p = els.root.querySelector('.chrome-probe');
  if (!p) {
    p = document.createElement('div');
    p.className = 'chrome-probe';
    p.setAttribute('aria-hidden', 'true');
    els.root.appendChild(p);
  }
  return p;
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
  // `[8i-1]` 옛 판으로 그려진 쪽은 아직 "그려지지 않은" 쪽으로 본다 — 새 판이 그려질 때까지 기다린다(재추출 중에만).
  // `[8i-1c]` 새 판으로 다시 그리는 중인 쪽도 — `refreshed` 알림 뒤에 넘어간다(그 알림의 `reload()` 가 첫 문장을 다시 읽지 않게).
  // `[8i-3b]` 판정식은 `speechPageReady`·`pageTurnCheck`(순수 — 테스트가 같은 함수를 쓴다).
  if (speechPageReady(state, target, pageFresh(state))) return Promise.resolve(true);

  // `[8i-3 — spec 4-13-9]` 200 ms 폴링 대신 **그 쪽 렌더의 끝 알림**(그리기·`notifyPage` 뒤)으로 푼다. 폴링은 `state.desc` 가
  // 그리기 앞에서 서는 바람에 원본 보기 canvas 를 그리는 사이에 풀렸다 → 낭독 시작 → `notifyPage` 의 `reload()` 가 첫 문장을
  // 처음부터 다시 읽었다. 이제 원본 보기는 그리기 시간만큼 늦게 시작하고(운영자 결정), 리플로우는 폴링 틱을 기다리지 않는다.
  // 상한·다른 쪽으로 감·리더를 떠남은 전과 같이 상한 뒤 false. 버려진 렌더는 알리지 않는다.
  const docId = state.docId;
  const waiting = renderDone.wait((r) => pageTurnCheck(state, pageFresh(state), r, docId, target), TTS.PAGE_WAIT_MS);
  // `[8g-4a]` 검색 화면 뒤에서 읽는 중이면 화면(해시)을 바꾸지 않고 숨은 리더에서 다음 쪽을 그린다 — 검색 화면이 갑자기 리더로 바뀌지 않게.
  if (state.soft) turnHidden(target);
  else go(readerHash(state.docId, target));
  return waiting;
}

/** `[8g-4a]` 숨은 리더의 쪽 넘김 — 다시 보일 때(떠났던 쪽 해시로 돌아오면) `showReader` 가 해시를 이 쪽으로 따라간다. */
function turnHidden(target) {
  state.page = target;
  state.hiddenTurn = true;
  state.hiddenRender = true;
  paintPager();
  if (state.wired.ex) { try { state.wired.ex.setCurrentPage(target); } catch (e) { /* 추출 우선순위만 */ } }
  renderPage().then(() => saveLastPage(), () => { /* renderPage 가 스스로 안내한다 */ });
}

/* ────────────────────────────────────────────────────────
   7. 작은 도구들
   ──────────────────────────────────────────────────────── */

/** 언어 전환 — 정적 문구는 `applyTranslations`, 동적 문구는 다시 만든다. */
function relabelReader() {
  if (!els) return;
  applyTranslations(els.root);
  syncControls();
  // `[8g-4a]` 검색 화면 뒤에 숨어 있으면 다시 보일 때 다시 만든다(`reshowReader`).
  if (els.root.hidden) { if (state.soft) state.relabelPending = true; return; }
  paintPager();
  paintProgressBar();
  paintViewToggle();
  paintScanNotice();          // `[8l]`
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
    notifyRepaint('relabel');           // `[8g-4a]` DOM 을 새로 붙였다 — 검색 강조를 다시 칠하게
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
