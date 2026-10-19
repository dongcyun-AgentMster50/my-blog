/* ============================================================
   MedReader — 목차·쪽 라벨 (서비스 계층 · spec 17-8-6 · 17-8-12 §3 "개요 읽기 시점" · 8g-3)

   PDF 개요(북마크)와 쪽 라벨(인쇄 쪽 번호)을 **한 번** 읽어 `documents` 레코드에 둔다 — 다음부터는
   PDF 를 열지 않고 목차를 그린다. DOM·`window` 를 모르고 `ui/`·`pdf/` 를 import 하지 않는다
   (3-2: `search/*` 는 `config`·`text/*`·`db` 만). pdf.js 문서 객체는 **UI 가 넘긴다**(리더가 이미 연 것).
   사용자 문자열을 만들지 않는다 — 상태·오류 **코드**만.

   ── 저장 (documents 레코드에 필드 추가 — DB 버전과 무관, 9-1) ──────
     outline    [{t, p, d}]  제목 · PDF 쪽(1부터) · 깊이(최상위 1). 쪽을 못 정하면 p:null(화면은 흐리게).
                             개요가 없는 PDF 는 [] — 그래도 `outlineV` 를 써서 다시 읽지 않는다.
     pageLabels [string]     `getPageLabels()` — **있고 하나라도 `String(p)` 와 다를 때만**(CMDT 2026). 아니면 쓰지 않는다.
     outlineV   OUTLINE_V    이 값이면 이미 읽었다(멱등). 규칙을 바꾸면 올린다 → 다시 읽는다.
   `documents` 에 두므로 [텍스트 다시 추출](`resetDerived`)이 지우지 않는다 — PDF 에서 온 것이다(U3).

   ── 쪽 해석 (17-8-1 방식) ─────────────────────────────────
     dest 가 문자열(이름 대상) → `getDestination(name)` → 배열. 배열(명시 대상)의 [0] 이
     정수면 그것이 쪽 순번(0부터), 객체(ref)면 `getPageIndex(ref)`. 대상 없음(URL·동작 항목)·해석 실패·
     범위 밖·**어느 호출이 던져도** 그 항목만 `p:null` — 예외를 밖으로 내지 않는다.
     `getOutline()`·`getPageLabels()` 자체가 던지면 **저장하지 않는다**(다음 기회에 다시 — 반쯤 읽은 것을
     `outlineV` 로 굳히지 않는다).

   ── 개요가 없는 책의 폴백 (17-8-6 · U11 — `text/search.js` `headingToc`, 변형 C) ──
     **저장하지 않고 목차를 열 때마다 만든다**(`tocOf`). 이유: 폴백은 `searchText.heads` 만 쓰는데
     그것은 추출·백필이 진행되며 늘어난다 — 저장하면 덜 된 목록이 굳는다. 또 pdf.js 를 못 받은
     오프라인 첫 열기에도 폴백은 된다(17-8-12 §3). 비용은 그 책 heading 줄만 남겨 읽는 커서 한 번.
   ============================================================ */

import { SEARCH } from '../config.js';
import * as db from '../db.js';
import { headingToc, headsOf } from '../text/search.js';

/** 개요 저장 규칙의 판. `documents.outlineV` 가 이 값이면 PDF 를 다시 보지 않는다. */
export const OUTLINE_V = 1;

/** 개요 항목 상한(이상한 PDF 가 레코드를 키우지 않게 — 세 책 37·61·50). */
export const OUTLINE_MAX_ITEMS = 5000;

/** 오류 코드 — UI 문자열이 아니다(3-2). DB 실패는 `db.ERR` 코드 그대로. */
export const OUTLINE_ERR = Object.freeze({
  READ: 'ERR_OUTLINE_READ',         // getOutline·getPageLabels 가 던졌다(손상·워커 종료)
  MISMATCH: 'ERR_OUTLINE_MISMATCH'  // 넘겨받은 pdf 문서의 쪽 수가 그 문서 레코드와 다르다
});

const DB_CODES = new Set(Object.values(db.ERR));

/** 이 문서 레코드가 지금 판으로 개요를 이미 읽었는가. */
export function isOutlineCurrent(doc) {
  return !!doc && doc.outlineV === OUTLINE_V && Array.isArray(doc.outline);
}

/* ════════════════════════════════════════════════════════
   1. PDF 에서 읽기 (db 없음 — 측정 스크립트도 쓴다)
   ════════════════════════════════════════════════════════ */

/** 개요 트리 → 앞 순서(문서 순서) 평평한 목록 `[{it, d}]`. 재귀 대신 스택 — 깊은 트리에서 넘치지 않게. */
function flatten(outline, max) {
  const out = [];
  const stack = [];
  const push = (items, d) => { for (let k = (items ? items.length : 0) - 1; k >= 0; k--) stack.push({ it: items[k], d: d }); };
  push(Array.isArray(outline) ? outline : [], 1);
  while (stack.length && out.length < max) {
    const x = stack.pop();
    if (!x.it || typeof x.it !== 'object') continue;
    out.push(x);
    if (Array.isArray(x.it.items) && x.it.items.length) push(x.it.items, x.d + 1);
  }
  return out;
}

/** 항목 하나의 PDF 쪽(1부터) 또는 null. 던지지 않는다. */
async function pageOfDest(pdfDoc, dest, numPages) {
  try {
    let d = dest;
    if (typeof d === 'string') d = await pdfDoc.getDestination(d);
    if (!Array.isArray(d) || d[0] == null) return null;
    const ref = d[0];
    const idx = typeof ref === 'number' ? ref : await pdfDoc.getPageIndex(ref);
    if (!Number.isInteger(idx) || idx < 0 || (numPages > 0 && idx >= numPages)) return null;
    return idx + 1;
  } catch (e) {
    return null;
  }
}

/** 라벨이 쓸모 있는가 — 배열이고 하나라도 `String(p)` 와 다르다. */
function usefulLabels(labels) {
  if (!Array.isArray(labels) || !labels.length) return false;
  for (let i = 0; i < labels.length; i++) if (String(labels[i]) !== String(i + 1)) return true;
  return false;
}

/**
 * pdf.js 문서에서 개요·쪽 라벨을 읽는다. `getOutline`·`getPageLabels` 가 던지면 그대로 던진다
 * (부르는 쪽이 저장하지 않게). 항목별 해석 실패는 `p:null`.
 * @returns {Promise<{outline:Array<{t:string,p:(number|null),d:number}>, pageLabels:(string[]|null)}>}
 */
export async function readOutline(pdfDoc) {
  const numPages = Number(pdfDoc && pdfDoc.numPages) || 0;
  const tree = await pdfDoc.getOutline();
  const flat = flatten(tree, OUTLINE_MAX_ITEMS);
  const outline = [];
  for (const { it, d } of flat) {
    const p = it.dest ? await pageOfDest(pdfDoc, it.dest, numPages) : null;
    outline.push({ t: String(it.title == null ? '' : it.title).trim(), p: p, d: d });
  }
  const raw = typeof pdfDoc.getPageLabels === 'function' ? await pdfDoc.getPageLabels() : null;
  const pageLabels = usefulLabels(raw) ? raw.map((l) => String(l == null ? '' : l)) : null;
  return { outline: outline, pageLabels: pageLabels };
}

/* ════════════════════════════════════════════════════════
   2. ensure — 한 번 읽어 documents 에 (멱등)
   ════════════════════════════════════════════════════════ */

const jobs = new Map();   // docId → 진행 중인 ensure(같은 책은 하나를 함께 기다린다)

/**
 * 그 책의 개요·쪽 라벨을 아직 안 읽었으면 읽어 `db.patch` 로 저장한다. 이미 있으면 PDF 를 부르지 않는다.
 * **거절하지 않는다** — 결과 코드만. 실패하면 저장하지 않으므로 다음 호출이 다시 시도한다.
 * @param {string} docId
 * @param {Object} pdfDoc  리더가 연 PDFDocumentProxy(UI 가 넘긴다)
 * @returns {Promise<{status:'saved'|'cached'|'missing'|'off'|'error', items?:number, labels?:boolean, code?:string}>}
 */
export function ensure(docId, pdfDoc) {
  if (!SEARCH.ENABLED) return Promise.resolve({ status: 'off' });
  if (!docId || !pdfDoc || typeof pdfDoc.getOutline !== 'function') return Promise.resolve({ status: 'error', code: OUTLINE_ERR.READ });
  const cur = jobs.get(docId);
  if (cur) return cur;
  const job = run(docId, pdfDoc).finally(() => { if (jobs.get(docId) === job) jobs.delete(docId); });
  jobs.set(docId, job);
  return job;
}

function dbCode(e) {
  if (e && DB_CODES.has(e.code)) return e.code;
  return db.isQuotaError(e) ? db.ERR.QUOTA : db.ERR.OPEN;
}

async function run(docId, pdfDoc) {
  let doc;
  try {
    doc = await db.get('documents', docId);
  } catch (e) {
    return { status: 'error', code: dbCode(e) };
  }
  if (!doc) return { status: 'missing' };
  if (isOutlineCurrent(doc)) return { status: 'cached' };
  const n = Number(pdfDoc.numPages) || 0;
  if (Number(doc.pageCount) > 0 && n > 0 && Number(doc.pageCount) !== n) return { status: 'error', code: OUTLINE_ERR.MISMATCH };

  let got;
  try {
    got = await readOutline(pdfDoc);
  } catch (e) {
    return { status: 'error', code: OUTLINE_ERR.READ };
  }
  const part = { outline: got.outline, outlineV: OUTLINE_V };
  if (got.pageLabels) part.pageLabels = got.pageLabels;
  let res;
  try {
    // 트랜잭션 안에서 다시 본다 — 그사이 다른 곳이 이미 썼으면 덮지 않는다.
    res = await db.patch('documents', docId, (rec) => (isOutlineCurrent(rec) ? null : part));
  } catch (e) {
    return { status: 'error', code: dbCode(e) };
  }
  if (!res.rec) return { status: 'missing' };
  if (!res.wrote) return { status: 'cached' };
  return { status: 'saved', items: got.outline.length, labels: !!got.pageLabels };
}

/* ════════════════════════════════════════════════════════
   3. 목차 — 저장된 개요, 없으면 heading 폴백(그때마다)
   ════════════════════════════════════════════════════════ */

/** 검색 레코드를 heading 줄만 남긴 작은 꼴로(폴백이 쓰는 것만 — 책 전체 글자를 메모리에 올리지 않는다). */
function slim(rec) {
  const hs = headsOf(rec);
  if (!hs.length) return null;
  const heads = [];
  const parts = [];
  let o = 0;
  for (const h of hs) {
    heads.push({ i: h.i, o: o, r: h.r });
    parts.push(h.t);
    o += h.t.length + 1;
  }
  return { pageNo: rec.pageNo, text: parts.join('\n'), heads: heads };
}

/**
 * 목차 탭이 그릴 것. 개요를 읽었고 항목이 있으면 그것, 아니면 `searchText.heads` 로 만든 폴백(저장하지 않음).
 * @returns {Promise<null|{source:'outline'|'fallback', items:Array<{t:string,p:(number|null),d:number}>,
 *           pageLabels:(string[]|null), outlineRead:boolean}>}
 *   `outlineRead:false` = PDF 개요를 아직 못 읽었다(오프라인 첫 열기 — 화면 `search.toc.unavailable`).
 *   문서가 없으면 null. DB 읽기 실패는 거절(`db.ERR` 코드) — 화면이 일반 오류로.
 */
export async function tocOf(docId) {
  const doc = await db.get('documents', docId);
  if (!doc) return null;
  const read = isOutlineCurrent(doc);
  const pageLabels = Array.isArray(doc.pageLabels) ? doc.pageLabels : null;
  if (read && doc.outline.length) return { source: 'outline', items: doc.outline, pageLabels: pageLabels, outlineRead: true };
  const recs = [];
  await db.iterate('searchText', { index: 'docId', query: docId }, (rec) => {
    const s = rec && rec.docId === docId ? slim(rec) : null;
    if (s) recs.push(s);
  });
  const items = headingToc(recs).map((h) => ({ t: h.t, p: h.p, d: 1 }));
  return { source: 'fallback', items: items, pageLabels: pageLabels, outlineRead: read };
}

/** 인쇄 쪽 라벨 — 있고 `String(p)` 와 다르면 그 글자, 아니면 null("p. {p}" 만). 화면 쪽 표시(17-8-12 §3). */
export function printedLabel(pageLabels, p) {
  if (!Array.isArray(pageLabels) || !Number.isInteger(p) || p < 1 || p > pageLabels.length) return null;
  const l = pageLabels[p - 1];
  if (l == null || l === '' || String(l) === String(p)) return null;
  return String(l);
}
