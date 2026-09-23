/* ============================================================
   MedReader — 백그라운드 추출 (spec 9-4)

   서비스 계층. DOM 을 모르고 `ui/` 를 import 하지 않는다. 진행 상황은
   **이벤트**로만 알린다(3-2): 'progress' · 'page' · 'pageerror' · 'done' · 'fatal'.

   ── 이 파일의 두 부분 ───────────────────────────────────
   위쪽은 **순수 함수**다(9-4 재개 모델). `node --test` 가 이 부분을 직접
   부른다 — 브라우저 없이 "다음에 어느 쪽을 뽑을 것인가"를 고정한다.
   아래쪽 `Extractor` 만 pdf.js·IndexedDB 를 안다.

   ── 7000쪽을 전제로 한 규칙 ────────────────────────────
   · 페이지 결과를 배열에 쌓지 않는다. 저장하고 버린다.
   · `page.cleanup()` 을 반드시 `finally` 에서 부른다.
   · 주기적으로 `pdfDoc.cleanup()` 을 불러 worker 쪽 캐시를 턴다.
   · `extraction` 을 쪽마다 쓰지 않는다(7000번의 documents 쓰기). 묶어서 쓴다.
   ============================================================ */

import { PDF_TEXT_CONTENT_OPTIONS, EXTRACT } from '../config.js';
import { buildPageLayout, algoVersion as ALGO_VERSION } from '../text/layout.js';
import { toStored, derivedHash as computeDerivedHash } from '../text/store.js';
import { hashHex } from '../hash.js';
import * as db from '../db.js';

export { ALGO_VERSION };

// spec 9-2 — 현재 파생 규칙 지문(하이픈 집합). 저장본의 값과 다르면 재추출 대상이다.
// 저장본에 문단 text 가 없고 읽을 때 조립되므로, 규칙이 바뀌면 같은 저장본이
// 다른 문단 텍스트를 낸다. storeVersion 은 그릇의 모양만 보므로 잡지 못한다.
export const DERIVED_HASH = computeDerivedHash();

/** 역할 재계산 경로의 시작값. 이웃이 생겨 다시 돌 때마다 +1 한다. */
export const ROLE_VERSION_BASE = 1;

/** `extraction.status` — UI 문자열이 아니라 코드다. */
export const STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  DONE: 'done',
  QUOTA: 'quota'          // QuotaExceededError 로 멈췄다(9-2 용량 관리)
});

/* ============================================================
   순수 부분 — spec 9-4 재개 모델
   ============================================================ */

/**
 * 저장된(또는 없는) `extraction` 을 정상 형태로 만든다.
 * @param {Object|null} ex
 * @returns {{done:boolean,pagesDone:number,cursor:number,failed:number[],algoVersion:number,roleDirty:number[],status:string}}
 */
export function normalizeExtraction(ex) {
  const e = ex || {};
  const failed = Array.isArray(e.failed) ? e.failed.filter(Number.isFinite).slice() : [];
  const roleDirty = Array.isArray(e.roleDirty) ? e.roleDirty.filter(Number.isFinite).slice() : [];
  failed.sort((a, b) => a - b);
  roleDirty.sort((a, b) => a - b);
  return {
    done: !!e.done,
    pagesDone: Number(e.pagesDone) || 0,
    cursor: Math.max(1, Math.floor(Number(e.cursor) || 1)),
    failed: dedupSorted(failed),
    algoVersion: Number(e.algoVersion) || 0,
    // spec 9-2 — 파생 규칙 지문. 옛 레코드에는 없다(그때는 null 이 되고
    // planResume 이 "규칙을 알 수 없다"로 보아 되감는다).
    derivedHash: typeof e.derivedHash === 'string' ? e.derivedHash : null,
    roleDirty: dedupSorted(roleDirty),
    status: e.status || STATUS.IDLE
  };
}

function dedupSorted(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i++) if (i === 0 || arr[i] !== arr[i - 1]) out.push(arr[i]);
  return out;
}

/** 실패 목록에 넣는다(오름차순·중복 없음). 원본을 바꾸지 않는다. */
export function addSorted(list, pageNo) {
  const out = (list || []).slice();
  if (out.indexOf(pageNo) >= 0) return out;
  out.push(pageNo);
  out.sort((a, b) => a - b);
  return out;
}

export function removeFrom(list, pageNo) {
  return (list || []).filter((n) => n !== pageNo);
}

/**
 * spec 9-4 — `algoVersion` 이 오르면 `cursor ← 1`, `failed ← []`.
 * 쪽별로는 `pages[i].algoVersion < ALGO_VERSION` 인 것만 실제로 재계산하는데,
 * 그 판정은 `pages` 의 `docId_algoVersion` 인덱스가 한다(값을 읽지 않는다).
 *
 * @param {Object|null} ex 저장된 extraction
 * @param {number} [algo] 현재 알고리즘 버전
 * @returns {Object} 정상화 + 필요하면 되감긴 extraction (`reextract` 표시 포함)
 */
/**
 * `[신규 2026-09-23 — 6단계 Review]` 레이아웃에 넘길 **회전 전** 쪽 치수.
 *
 * pdf.js `page.view` 는 cropBox `[x0, y0, x1, y1]` 를 회전 전 사용자 공간으로 준다.
 * 이것이 `getTextContent()` 아이템 좌표와 같은 공간이다. 값이 없거나 0 이면
 * 회전된 viewport 치수로 물러선다 — **추측해서 뒤바꾸지는 않는다**(4-2 와 같은 관례).
 *
 * @param {Array}  view      page.view
 * @param {number} fallbackW 회전된 viewport 폭
 * @param {number} fallbackH 회전된 viewport 높이
 * @returns {{width:number, height:number}}
 */
export function unrotatedPageSize(view, fallbackW, fallbackH) {
  const fw = Number(fallbackW) || 0;
  const fh = Number(fallbackH) || 0;
  if (!Array.isArray(view) || view.length < 4) return { width: fw, height: fh };
  const w = Math.abs(Number(view[2]) - Number(view[0]));
  const h = Math.abs(Number(view[3]) - Number(view[1]));
  if (!(Number.isFinite(w) && w > 0) || !(Number.isFinite(h) && h > 0)) {
    return { width: fw, height: fh };
  }
  return { width: w, height: h };
}

export function planResume(ex, algo = ALGO_VERSION, derived = DERIVED_HASH) {
  const e = normalizeExtraction(ex);
  // spec 9-2 — 파생 규칙(하이픈 집합)이 바뀌면 저장본은 그대로여도 읽을 때
  // 조립되는 문단 텍스트가 달라지고, 저장된 kind 는 옛 텍스트로 판정된 채 남는다.
  // algoVersion 과 같은 취급으로 되감는다. derivedHash 가 아예 없는 옛 레코드도
  // 되감는다 — 그때의 규칙을 알 수 없으므로 같다고 가정하면 안 된다.
  const derivedChanged = e.derivedHash !== derived;
  if (e.algoVersion < algo || derivedChanged) {
    return Object.assign(e, {
      cursor: 1, failed: [], roleDirty: [], done: false,
      algoVersion: algo, derivedHash: derived, reextract: true,
      reextractReason: e.algoVersion < algo ? 'algo' : 'derived'
    });
  }
  return Object.assign(e, { reextract: false, reextractReason: null });
}

/**
 * spec 9-4 우선순위 0·1 — 현재 쪽 주변.
 *   priority 0: 현재, 현재±1
 *   priority 1: 현재±2 … ±5
 * 앞쪽(다음 쪽)을 뒤쪽보다 먼저 둔다 — 읽기는 대개 앞으로 간다.
 *
 * @param {number|null} current
 * @param {number} pageCount
 * @returns {Array<{pageNo:number, priority:number}>}
 */
export function priorityTargets(current, pageCount) {
  const out = [];
  if (!Number.isFinite(current) || current == null) return out;
  const c = Math.round(current);
  const push = (n, p) => { if (n >= 1 && n <= pageCount) out.push({ pageNo: n, priority: p }); };
  push(c, 0);
  push(c + 1, 0);
  push(c - 1, 0);
  for (let d = 2; d <= 5; d++) { push(c + d, 1); push(c - d, 1); }
  return out;
}

/**
 * 순차 커서를 **이미 끝난 쪽·실패한 쪽 너머로** 민다.
 * @param {number} cursor
 * @param {number} pageCount
 * @param {(n:number)=>boolean} has 이미 저장돼 있는가
 * @param {number[]} failed
 * @returns {number} 다음에 시도할 쪽 번호 (끝났으면 pageCount + 1)
 */
export function advanceCursor(cursor, pageCount, has, failed) {
  const f = new Set(failed || []);
  let c = Math.max(1, Math.floor(cursor) || 1);
  while (c <= pageCount && (has(c) || f.has(c))) c++;
  return c;
}

/**
 * spec 9-4 — 다음에 뽑을 쪽. **재개의 핵심이다.**
 *
 * @param {Object} st
 *   st.current    {number|null} 사용자가 보고 있는 쪽
 *   st.pageCount  {number}
 *   st.cursor     {number}      priority 2 순차 스캔 위치
 *   st.failed     {number[]}
 *   st.has        {(n)=>boolean} 이미 저장돼 있는가
 *   st.inFlight   {Set<number>}  지금 처리 중
 *   st.retriedPages {Set<number>} 이번 재시도 순회에서 이미 다시 시도한 쪽.
 *                 **쪽 단위로 들고 있어야 한다.** 불리언 하나로 두면 실패가
 *                 둘 이상일 때 첫 쪽만 재시도하고 나머지가 영구 구멍이 된다
 *                 (E16 이 이 버그를 잡았다).
 *   st.roleQueue  {number[]}     이웃이 생겨 역할만 다시 돌 쪽
 * @returns {{pageNo:number, priority:number}|null} null = 더 할 일이 없다
 */
export function nextPage(st) {
  const pageCount = st.pageCount;
  const has = st.has || (() => false);
  const busy = st.inFlight || new Set();
  const failed = st.failed || [];

  // 이미 실패한 쪽은 **우선순위 창에서도** 건너뛴다.
  // 건너뛰지 않으면 현재 쪽 ±5 안의 한 쪽이 계속 던질 때 그 쪽만 무한히 다시
  // 시도하며 순차 스캔이 굶는다. 729쪽 실측에서 실제로 그랬다 — 5쪽에
  // 영구 실패를 주입했더니 같은 쪽을 99번 다시 잡았다(E19 가 이것을 고정한다).
  // 재시도는 9-4 가 정한 자리, 즉 순차 스캔이 끝난 뒤의 한 바퀴에서만 한다.
  const failedSet = new Set(failed);
  for (const t of priorityTargets(st.current, pageCount)) {
    if (busy.has(t.pageNo) || has(t.pageNo) || failedSet.has(t.pageNo)) continue;
    return t;
  }

  const c = advanceCursor(st.cursor, pageCount, has, failed);
  if (c <= pageCount && !busy.has(c)) return { pageNo: c, priority: 2 };

  // 순차 스캔이 끝났다 → 실패 목록을 **한 번 더** (9-4).
  // "한 번 더"는 목록 전체를 한 바퀴 도는 것이다. 쪽 하나가 아니다.
  if (c > pageCount) {
    const tried = st.retriedPages || new Set();
    for (const f of failed) {
      if (!busy.has(f) && !has(f) && !tried.has(f)) return { pageNo: f, priority: 3 };
    }
  }

  // 마지막으로, 이웃이 나중에 생긴 쪽의 역할 재계산 (4-7 · 전체 재추출 금지)
  const rq = st.roleQueue || [];
  for (const r of rq) if (!busy.has(r)) return { pageNo: r, priority: 4 };

  return null;
}

/**
 * spec 9-4 완료 조건 — `failed` 가 비고 모든 쪽이 저장돼 있다.
 *
 * **1쪽부터** 훑는다. `st.cursor` 부터 훑으면 "cursor 아래는 전부 저장됐거나
 * 실패했다"는 불변식을 저장본이 지켜 준다고 **믿는** 것이 된다. 그 믿음이
 * 깨지면(같은 docId 의 pageCount 가 줄었다 · 레코드가 손상됐다) `cursor` 하나
 * 때문에 `done` 이 선다 — `[Review 2 실측]` `cursor: 99999` 인 20쪽 문서에서
 * 저장된 쪽이 **0개인데** `done = true` 가 됐다. 그러면 5절 파서가 빈 문서 위를
 * 돌고 사용자에게는 "완료"가 보인다.
 * 비용은 `pageCount` 번의 Set 조회뿐이고 완료 판정은 문서당 몇 번뿐이다.
 */
export function isComplete(st) {
  const c = advanceCursor(1, st.pageCount, st.has || (() => false), []);
  return c > st.pageCount && (st.failed || []).length === 0;
}

/* ============================================================
   서비스 부분 — pdf.js · IndexedDB
   ============================================================ */

function idle(fn, timeout) {
  if (typeof requestIdleCallback === 'function') return requestIdleCallback(fn, { timeout: timeout || EXTRACT.IDLE_TIMEOUT_MS });
  return setTimeout(fn, 0);
}

/** 0 이 유효한 핸들일 수 있어 null 로 구분한다. */
function cancelIdle(handle) {
  if (handle == null) return;
  if (typeof cancelIdleCallback === 'function' && typeof requestIdleCallback === 'function') {
    cancelIdleCallback(handle);
  } else {
    clearTimeout(handle);
  }
}

export class Extractor extends EventTarget {
  /**
   * @param {Object} opts
   *   opts.docId     {string}
   *   opts.pdfDoc    {Object} PDFDocumentProxy
   *   opts.pageCount {number}
   *   opts.params    {Object} 선택 — 책별 프로파일(2-4)이 LAYOUT 을 덮어쓸 때
   */
  constructor(opts) {
    super();
    this.docId = opts.docId;
    this.pdfDoc = opts.pdfDoc;
    this.pageCount = Number(opts.pageCount) || 0;
    this.params = opts.params || undefined;

    this.current = null;        // 사용자가 보고 있는 쪽
    this.speaking = false;      // 낭독 중 — priority 2 를 초당 1쪽으로
    this.running = false;
    this.stopped = false;
    // 이번 재시도 순회에서 이미 다시 시도한 쪽 (9-4 "한 번 더")
    this.retriedPages = new Set();

    this.stored = new Set();    // algoVersion 이 최신인 쪽 번호
    this.inFlight = new Set();
    this.roleQueue = [];
    this.ex = normalizeExtraction(null);

    this.itemsCache = new Map(); // pageNo → {items, styles, width, height} (EXTRACT.ITEMS_CACHE_MAX 쪽)
    this.stats = { widthFixed: 0, items: 0, pagesBuilt: 0, buildMs: 0, recomputed: 0 };

    this._handle = null;
    this._dirtyMeta = 0;        // 마지막 저장 이후 바뀐 쪽 수
    this._lastSave = 0;
  }

  /* ── 외부에서 조작하는 것들 ──────────────────────── */
  setCurrentPage(n) {
    const v = Number(n);
    this.current = Number.isFinite(v) ? v : null;
  }

  setSpeaking(on) { this.speaking = !!on; }

  pause() {
    if (!this.running) return;
    this.running = false;
    cancelIdle(this._handle);
    this._handle = null;
    this.ex.status = STATUS.PAUSED;
    this._saveMeta(true);
    this._emitProgress();
  }

  stop() {
    this.stopped = true;
    this.pause();
  }

  /* ── 시작·재개 ──────────────────────────────────── */
  async prepare() {
    const doc = await db.get('documents', this.docId);
    this.ex = planResume(doc && doc.extraction, ALGO_VERSION);
    if (this.ex.reextract) {
      // algoVersion 이 올랐다 — 되감았다. 쪽별 판정은 아래 인덱스가 한다.
      this.dispatchEvent(new CustomEvent('reextract', { detail: { algoVersion: ALGO_VERSION } }));
    }
    // 앱이 갑자기 닫히면 status 가 'running' 인 채로 남는다. 지금 도는 것은
    // 없으므로 'paused' 로 고쳐 둔다 — 그래야 UI 가 "추출 중"을 거짓으로 그리지 않는다.
    if (this.ex.status === STATUS.RUNNING) this.ex.status = STATUS.PAUSED;
    await this._loadStoredSet();
    this.roleQueue = this.ex.roleDirty.slice();
    this.ex.pagesDone = this.stored.size;
    // 9-4 의 불변식 검산 — "cursor 아래는 전부 저장됐거나 실패했다".
    // 건강한 저장본이면 아래 값은 cursor 와 **정확히 같아** 아무 일도 하지 않는다.
    // 작으면 저장본이 불변식을 깬 것이므로(pageCount 가 바뀐 문서·손상된 레코드)
    // 구멍의 첫 쪽으로 되감는다. 이미 메모리에 있는 Set 조회라 7000쪽에서도 공짜다.
    const firstGap = advanceCursor(1, this.pageCount, (n) => this.stored.has(n), this.ex.failed);
    if (firstGap < this.ex.cursor) this.ex.cursor = firstGap;
    this._emitProgress();
    return this.ex;
  }

  /** `docId_algoVersion` 인덱스로 **값을 읽지 않고** 최신 쪽 집합을 만든다. */
  async _loadStoredSet() {
    this.stored = new Set();
    const range = IDBKeyRange.bound([this.docId, ALGO_VERSION], [this.docId, Infinity]);
    const keys = await db.keysOf('pages', 'docId_algoVersion', range);
    for (const k of keys) this.stored.add(k[1]);
  }

  async start() {
    if (this.running) return;
    if (!this.ex || this.ex.status === STATUS.IDLE) await this.prepare();
    this.stopped = false;
    this.running = true;
    // 사용자가 다시 시작하면 실패 목록도 다시 한 바퀴 돈다
    // (설정 > 고급의 [실패한 페이지 다시 시도]가 이 경로다)
    this.retriedPages = new Set();
    this.ex.status = STATUS.RUNNING;
    this._emitProgress();
    this._schedule(0);
  }

  _schedule(delayMs) {
    if (!this.running) return;
    cancelIdle(this._handle);
    if (delayMs > 0) {
      this._handle = setTimeout(() => { this._handle = null; this._tick(); }, delayMs);
    } else {
      this._handle = idle(() => { this._handle = null; this._tick(); });
    }
  }

  async _tick() {
    if (!this.running) return;
    const target = nextPage({
      current: this.current,
      pageCount: this.pageCount,
      cursor: this.ex.cursor,
      failed: this.ex.failed,
      has: (n) => this.stored.has(n),
      inFlight: this.inFlight,
      retriedPages: this.retriedPages,
      roleQueue: this.roleQueue
    });

    if (!target) {
      await this._finish();
      return;
    }

    if (target.priority === 3) this.retriedPages.add(target.pageNo);

    this.inFlight.add(target.pageNo);
    try {
      if (target.priority === 4) await this._recomputeRoles(target.pageNo);
      else await this._processPage(target.pageNo);
    } catch (e) {
      if (e && e.code === db.ERR.QUOTA) {
        this.running = false;
        this.ex.status = STATUS.QUOTA;
        await this._saveMeta(true);
        this.dispatchEvent(new CustomEvent('fatal', { detail: { code: db.ERR.QUOTA, pageNo: target.pageNo } }));
        this._emitProgress();
        return;
      }
      // 한 쪽이 던져도 전체를 멈추지 않는다 (9-4). 다만 두 가지를 함께 해야 한다.
      //
      // ① **역할 큐에서 뺀다.** 빼지 않으면 priority 4 가 같은 쪽을 영원히 다시
      //    잡는다 — E19 가 우선순위 창에서 고친 병이 역할 재계산 경로에 그대로
      //    다시 나 있었다. `[Review 2 실측]` `_recomputeRoles` 가 던지게 했더니
      //    1.5초에 298회를 다시 잡고 `pageerror` 를 298번 쏘았다.
      // ② **이미 저장된 쪽은 `failed` 에 넣지 않는다.** 역할 재계산(4-7) 실패나
      //    `_saveMeta` 실패는 "그 쪽이 없다"는 뜻이 아니다. 넣으면 nextPage 의
      //    재시도 경로가 `!has(f)` 로 걸러 **영원히 빼내지 못하고**(저장돼 있으니
      //    성공으로 지워질 기회도 없다) `done` 이 끝내 서지 않는다 —
      //    `[Review 2 실측]` 저장된 4쪽을 failed 에 넣자 재시작해도 그대로였다.
      this.ex.roleDirty = removeFrom(this.ex.roleDirty, target.pageNo);
      this.roleQueue = this.roleQueue.filter((n) => n !== target.pageNo);
      if (!this.stored.has(target.pageNo)) {
        this.ex.failed = addSorted(this.ex.failed, target.pageNo);
      }
      this.dispatchEvent(new CustomEvent('pageerror', {
        detail: { pageNo: target.pageNo, message: e && e.message ? e.message : String(e) }
      }));
    } finally {
      this.inFlight.delete(target.pageNo);
    }

    // 낭독 중에는 priority 2 이하를 초당 1쪽으로 (9-4)
    const slow = this.speaking && target.priority >= 2;
    this._emitProgress();
    this._schedule(slow ? EXTRACT.SPEAKING_PAGE_MS : 0);
  }

  /** 이웃 저장본을 넘긴다. 저장본(아이템 없음)으로 충분하다(Review 1-§10-2). */
  async _neighborLayouts(pageNo) {
    const out = [];
    for (const n of [pageNo - 1, pageNo + 1]) {
      if (n < 1 || n > this.pageCount || !this.stored.has(n)) continue;
      const rec = await db.get('pages', [this.docId, n]);
      if (rec) out.push(rec);
    }
    return out;
  }

  _neighborMask(pageNo) {
    const prev = pageNo <= 1 ? true : this.stored.has(pageNo - 1);
    const next = pageNo >= this.pageCount ? true : this.stored.has(pageNo + 1);
    return { prev: prev, next: next, complete: prev && next };
  }

  async _getItems(pageNo) {
    const hit = this.itemsCache.get(pageNo);
    if (hit) return hit;
    const page = await this.pdfDoc.getPage(pageNo);
    try {
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent(PDF_TEXT_CONTENT_OPTIONS);
      // spec 4-0 방어 — str 이 문자열이 아닌 아이템은 버린다
      const items = [];
      for (let i = 0; i < tc.items.length; i++) {
        const it = tc.items[i];
        if (it && typeof it.str === 'string') items.push(it);
      }
      // `[수정 2026-09-23 — 6단계 Review]` 레이아웃 좌표계는 **회전 전** PDF 사용자
      // 공간이다. `getTextContent()` 아이템의 transform 은 `/Rotate` 를 반영하지 않는데
      // `getViewport({scale:1})` 의 width/height 는 반영해 90·270 에서 뒤바뀐다.
      // 그 값으로 4-6 클립을 걸면 줄 bbox 가 통째로 납작해진다
      // (실측: /Rotate 90 에서 y0=y1=612, 높이 0, 10줄 중 7줄 degenerate).
      // 렌더는 회전된 viewport 를 그대로 쓰고 bbox → 화면 변환은
      // `convertToViewportPoint` 가 회전을 처리하므로 여기만 고치면 된다.
      const size = unrotatedPageSize(page.view, vp.width, vp.height);
      const rec = { items: items, styles: tc.styles || {}, width: size.width, height: size.height };
      this.itemsCache.set(pageNo, rec);
      // 최대 3쪽만 들고 있는다 — 7000쪽에서 메모리가 터지지 않게
      while (this.itemsCache.size > EXTRACT.ITEMS_CACHE_MAX) {
        const oldest = this.itemsCache.keys().next().value;
        this.itemsCache.delete(oldest);
      }
      return rec;
    } finally {
      page.cleanup();
    }
  }

  async _buildAndStore(pageNo, roleVersion) {
    const src = await this._getItems(pageNo);
    const mask = this._neighborMask(pageNo);
    const neighbors = await this._neighborLayouts(pageNo);

    const t0 = Date.now();
    const layout = buildPageLayout(src.items, {
      pageNo: pageNo, width: src.width, height: src.height,
      styles: src.styles, neighborLayouts: neighbors
    }, this.params);
    this.stats.buildMs += Date.now() - t0;
    this.stats.pagesBuilt++;
    this.stats.items += src.items.length;
    this.stats.widthFixed += Number(layout.stats && layout.stats.widthFixed) || 0;

    const rec = toStored(layout);
    rec.docId = this.docId;
    rec.pageNo = pageNo;
    rec.roleVersion = roleVersion;
    rec.extractedAt = Date.now();
    rec.neighborsUsed = { prev: mask.prev, next: mask.next };
    let text = '';
    for (let i = 0; i < rec.lines.length; i++) text += rec.lines[i].text + '\n';
    rec.textHash = await hashHex(text);

    await db.put('pages', rec);
    return { rec: rec, mask: mask };
  }

  async _processPage(pageNo) {
    const { mask } = await this._buildAndStore(pageNo, ROLE_VERSION_BASE);

    const wasStored = this.stored.has(pageNo);
    this.stored.add(pageNo);
    if (!wasStored) this.ex.pagesDone++;
    this.ex.failed = removeFrom(this.ex.failed, pageNo);
    // 커서는 앞으로만 간다. 방금 저장한 쪽이 커서 자리였다면 그 너머로 밀린다.
    this.ex.cursor = advanceCursor(this.ex.cursor, this.pageCount, (n) => this.stored.has(n), this.ex.failed);

    // 이웃이 없어 역할을 약하게 판정했다면 나중에 다시 돈다(4-7)
    if (!mask.complete) this.ex.roleDirty = addSorted(this.ex.roleDirty, pageNo);
    else this.ex.roleDirty = removeFrom(this.ex.roleDirty, pageNo);

    this.dispatchEvent(new CustomEvent('page', { detail: { pageNo: pageNo } }));

    // 방금 이 쪽이 생겨서 **이웃**의 역할 판정이 좋아질 수 있다(4-7).
    //
    // 여기서 **바로** 다시 도는 것이 중요하다. 순차 스캔은 n → n+1 로 가므로
    // n 을 저장한 직후 n−1 의 아이템이 아직 itemsCache 에 있다. 그때 다시 돌면
    // 비용은 buildPageLayout 한 번(≈1ms)뿐이다. 뒤로 미뤄 큐에 쌓으면 나중에
    // getPage + getTextContent 를 **처음부터 다시** 해야 하고, 729쪽 실측에서
    // 그 경로는 초당 5.6쪽까지 떨어졌다(전수 재계산에 약 2분 — 7000쪽이면 20분).
    // 큐는 임의 접근(사용자가 500쪽을 먼저 열어 캐시가 비어 있는 경우)의 대비책으로만 남긴다.
    for (const n of [pageNo - 1, pageNo + 1]) {
      if (n < 1 || n > this.pageCount) continue;
      if (this.ex.roleDirty.indexOf(n) < 0) continue;
      if (!this._neighborMask(n).complete) continue;
      if (this.itemsCache.has(n)) await this._recomputeRoles(n);
      else if (this.roleQueue.indexOf(n) < 0) this.roleQueue.push(n);
    }

    await this._saveMeta(false);
  }

  /** 4-7 역할 재계산 — **그 쪽만** 다시 돈다. 전체 재추출이 아니다. */
  async _recomputeRoles(pageNo) {
    const prev = await db.get('pages', [this.docId, pageNo]);
    const roleVersion = (prev && Number(prev.roleVersion) || ROLE_VERSION_BASE) + 1;
    await this._buildAndStore(pageNo, roleVersion);
    this.stats.recomputed++;
    this.ex.roleDirty = removeFrom(this.ex.roleDirty, pageNo);
    this.roleQueue = this.roleQueue.filter((n) => n !== pageNo);
    this.dispatchEvent(new CustomEvent('page', { detail: { pageNo: pageNo, roleVersion: roleVersion } }));
    await this._saveMeta(false);
  }

  async _finish() {
    this.running = false;
    cancelIdle(this._handle);
    this._handle = null;
    const complete = isComplete({
      cursor: this.ex.cursor, pageCount: this.pageCount,
      has: (n) => this.stored.has(n), failed: this.ex.failed
    });
    this.ex.done = complete;
    this.ex.status = complete ? STATUS.DONE : STATUS.PAUSED;
    await this._saveMeta(true);
    this._emitProgress();
    this.dispatchEvent(new CustomEvent(complete ? 'done' : 'stalled', {
      detail: { failed: this.ex.failed.slice() }
    }));
  }

  /**
   * `documents.extraction` 저장. 쪽마다 쓰지 않는다 —
   * 7000쪽이면 documents 에 7000번 쓰는 셈이고, 그 비용이 추출보다 크다.
   * 10쪽마다 또는 2초마다 쓰고, 멈출 때는 반드시 쓴다.
   */
  async _saveMeta(force) {
    this._dirtyMeta++;
    const now = Date.now();
    if (!force && this._dirtyMeta < EXTRACT.META_SAVE_EVERY_PAGES && now - this._lastSave < EXTRACT.META_SAVE_EVERY_MS) return;
    this._dirtyMeta = 0;
    this._lastSave = now;
    const doc = await db.get('documents', this.docId);
    if (!doc) return;
    doc.extraction = {
      done: this.ex.done,
      pagesDone: this.ex.pagesDone,
      cursor: this.ex.cursor,
      failed: this.ex.failed.slice(),
      algoVersion: ALGO_VERSION,
      // spec 9-2 — 파생 규칙 지문. 이것을 빼면 planResume 이 매번
      // "규칙을 알 수 없다"로 보아 되감고, 진짜 규칙 변경을 감지하는
      // 기능이 죽는다(항상 울리는 경보).
      derivedHash: DERIVED_HASH,
      roleDirty: this.ex.roleDirty.slice(),
      status: this.ex.status
    };
    await db.put('documents', doc);
    // worker 쪽 캐시를 주기적으로 턴다 (7000쪽 메모리)
    if (this.pdfDoc && typeof this.pdfDoc.cleanup === 'function' && this.stats.pagesBuilt % EXTRACT.PDFDOC_CLEANUP_EVERY === 0) {
      try { await this.pdfDoc.cleanup(); } catch (e) { /* 캐시 정리 실패는 치명적이지 않다 */ }
    }
  }

  _emitProgress() {
    this.dispatchEvent(new CustomEvent('progress', {
      detail: {
        pagesDone: this.ex.pagesDone,
        pageCount: this.pageCount,
        cursor: this.ex.cursor,
        failed: this.ex.failed.slice(),
        roleDirty: this.ex.roleDirty.length,
        status: this.ex.status,
        done: this.ex.done,
        stats: Object.assign({}, this.stats)
      }
    }));
  }
}
