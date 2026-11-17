/* ============================================================
   MedReader — 필기·하이라이트 저장 (spec 17-16 2·3 — 20-1)

   ── 서비스 계층이다(3-2 — `notes/*` 행: `config`·`text/*`·`db`·`hash` 만) ──
   `ui/` 를 모른다. 문구를 만들지 않는다. 호출 0.

   ── 저장 위치 (9-2 `annotations` — DB 버전 3 그대로, 필드만) ──
   `{ id, kind:'highlight'|'note', docId, pageNo, fileHash, docTitle, anchor, color(highlight 만), note, group, createdAt, updatedAt }`
   레코드 **맨 위** `docId`·`pageNo` → `docId_pageNo` 인덱스로 쪽마다 한 번에 읽는다. 같은 스토어의 11 요약(`summary`·`outline`)은
   이 서비스가 읽지도 지우지도 않는다(`kind` 로 가른다).

   ── 문단을 넘는 선택 (20-D5) ── 문단마다 레코드 하나, 같은 `group`(첫 레코드 id). `remove` 는 그 묶음을 함께 지운다.
   한 문단 안이라도 인용이 `ANNO.QUOTE_MAX` 를 넘으면 같은 방법으로 나눈다.

   ── 다시 찾기 (20-D6) ── `placeOnPage` 가 쪽을 그릴 때 `resolve`(순수 `text/anchor.js`)로 다시 찾는다. **찾은 결과로 레코드를
   고쳐 쓰지 않는다** — 판(`anchor.algo`)이 다르고 `how ≠ 'exact'` 인 것만 그 자리에서 **한 번** `anchor.lineIds/start/end/algo` 를
   새 값으로(`db.patch` — 사용자가 고친 것이 아니라 `updatedAt` 은 그대로). 다음부터 1단계에 걸린다. 고아(null)는 지우지 않는다.

   ── 다시 붙이기 (20-D11 · 20-3 이 부른다) ── `reattach(fileHash, newId)` — 같은 `fileHash` 이고 `docId` 가 지금 문서 목록에 없는
   레코드의 `docId` 를 새 id 로(한 트랜잭션 — 요약·개요 레코드도 같은 규칙).
   ============================================================ */

import * as realDb from '../db.js';
import { ANNO } from '../config.js';
import { hashHex, normalizeForHash } from '../hash.js';
import { anchorOf, indexOfDesc, resolve } from '../text/anchor.js';
import { algoVersion as ALGO_VERSION } from '../text/layout.js';

export const STORE = 'annotations';
export const KIND = Object.freeze({ HIGHLIGHT: 'highlight', NOTE: 'note' });

function rq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function isMine(v) { return !!v && (v.kind === KIND.HIGHLIGHT || v.kind === KIND.NOTE); }
function str(v) { return typeof v === 'string' ? v : ''; }
function clip(s, n) { const x = str(s); return x.length > n ? x.slice(0, n) : x; }
function colorOf(c) { return ANNO.COLORS.indexOf(c) >= 0 ? c : ANNO.COLORS[0]; }
/** `[20-3]` 묶음 열쇠 — 같은 `group` 은 한 줄(없으면 제 id). 시트·필기 화면·셈이 같은 규칙. */
export function groupKey(v) { return String(v && v.group != null ? v.group : v && v.id); }

/** 문단 글의 해시 — 11 요약과 같은 식(`hashHex(normalizeForHash(…))`). */
export function textHashOf(text) {
  return hashHex(normalizeForHash(String(text == null ? '' : text)));
}

/**
 * `[20-2 — 20-1R #1]` 쪽 레이아웃(`fromStored` — 줄마다 bbox, PDF 좌표) → `boxOf(lineId)`. 레이아웃이 없으면 null
 * (앵커는 좌표 없이 만들어지고, 동점은 옛 규칙 — 저장한 첫 줄 번호). 순수.
 * @param {{lines?:Array<{id, bbox?:{x0,y0}}>}} layout
 * @returns {?function(string):?{x0:number, y0:number}}
 */
export function boxOfLayout(layout) {
  const lines = layout && Array.isArray(layout.lines) ? layout.lines : null;
  if (!lines || !lines.length) return null;
  const m = new Map();
  for (const l of lines) if (l && l.id != null && l.bbox) m.set(String(l.id), l.bbox);
  return (id) => m.get(String(id)) || null;
}

/**
 * 지금 쪽의 화면 글자 · 문단 id · 문단 해시(`idx.parts` 순서).
 * @param {Object} desc `describePage(…)`
 * @returns {Promise<{idx:Object, paraIds:Array, paraHashes:string[]}>}
 */
export async function pageIndex(desc) {
  const { idx, paraIds } = indexOfDesc(desc);
  const paraHashes = await Promise.all(idx.parts.map((p) => textHashOf(p.joined.text)));
  return { idx: idx, paraIds: paraIds, paraHashes: paraHashes };
}

/**
 * 선택(화면 오프셋) → 문단마다, `QUOTE_MAX` 마다 자른 조각들 `[{from, to}]`(문단 사이 '\n' 은 빠진다). 순수.
 * @param {{text:string, parts:Array}} idx
 */
export function splitSelection(idx, from, to) {
  let a = Math.floor(Number(from));
  let b = Math.floor(Number(to));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
  if (b < a) { const x = a; a = b; b = x; }
  const out = [];
  for (const p of (idx && idx.parts) || []) {
    const s = Math.max(a, p.base);
    const e = Math.min(b, p.base + p.joined.text.length);
    for (let x = s; x < e; x += ANNO.QUOTE_MAX) out.push({ from: x, to: Math.min(e, x + ANNO.QUOTE_MAX) });
  }
  return out;
}

/**
 * 저장소 하나. 앱은 기본 인스턴스를 쓰고, 테스트는 `db`·`now`·`newId` 를 주입한다.
 * @param {{db?:Object, now?:()=>number, newId?:()=>string}} [deps]
 */
export function createAnnotationStore(deps) {
  const d = deps || {};
  const db = d.db || realDb;
  const now = typeof d.now === 'function' ? d.now : () => Date.now();
  let seq = 0;
  const newId = typeof d.newId === 'function' ? d.newId
    : () => ANNO.ID_PREFIX + now().toString(36) + ':' + (++seq).toString(36) + Math.random().toString(36).slice(2, 7);

  /**
   * 만들기 — 선택 하나 → 레코드 하나 이상(문단마다 · 긴 인용은 나눔, 같은 `group`). 한 트랜잭션.
   * @param {{docId:string, pageNo:number, desc:Object, from:number, to:number, kind?:string, color?:string, note?:string,
   *          fileHash?:string, docTitle?:string, algo?:number, layout?:Object}} input  `from`·`to` = 화면 글자(`screenIndex`) 오프셋
   *   · `[20-2]` `layout` = 지금 쪽 레이아웃(있으면 앵커에 첫 줄 PDF 좌표 `pos` — 동점 가르기)
   * @returns {Promise<Object[]>} 만든 레코드들(없으면 [])
   */
  async function create(input) {
    const i = input || {};
    const pageNo = Number(i.pageNo);
    if (!i.docId || !Number.isFinite(pageNo) || !i.desc) return [];
    const kind = i.kind === KIND.NOTE ? KIND.NOTE : KIND.HIGHLIGHT;
    const pi = await pageIndex(i.desc);
    const ctx = { pageNo: pageNo, algo: i.algo == null ? ALGO_VERSION : Number(i.algo), paraIds: pi.paraIds, paraHashes: pi.paraHashes,
      boxOf: boxOfLayout(i.layout) };
    const anchors = [];
    for (const c of splitSelection(pi.idx, i.from, i.to)) {
      const an = anchorOf(pi.idx, c.from, c.to, ctx);
      if (an) anchors.push(an);
    }
    if (!anchors.length) return [];
    const at = now();
    const recs = [];
    let group = null;
    for (const an of anchors) {
      // `[20-3 — 20-2R #2]` 묶음의 메모는 **대표 레코드(첫 레코드 — id = group) 하나에만**(spec 17-16 5 `[정정 20-2]`) — 다른 조각은 빈 메모.
      const rec = {
        id: newId(), kind: kind, docId: String(i.docId), pageNo: pageNo,
        fileHash: str(i.fileHash), docTitle: str(i.docTitle), anchor: an,
        note: group == null ? clip(i.note, ANNO.NOTE_MAX) : '', group: null, createdAt: at, updatedAt: at
      };
      if (kind === KIND.HIGHLIGHT) rec.color = colorOf(i.color);
      if (group == null) group = rec.id;
      rec.group = group;
      recs.push(rec);
    }
    await db.withTx([STORE], 'readwrite', async (tx, s) => {
      for (const r of recs) await rq(s[STORE].put(r));
    });
    return recs;
  }

  /**
   * 고치기 — 색·메모(사용자 손). `updatedAt` 새로. 필기 레코드가 아니면 쓰지 않는다.
   * @param {string} id
   * @param {{color?:string, note?:string}} change
   * @returns {Promise<{wrote:boolean, rec:Object|null}>}
   */
  function update(id, change) {
    const c = change || {};
    return db.patch(STORE, id, (cur) => {
      if (!isMine(cur)) return null;
      const part = {};
      if (c.color !== undefined && cur.kind === KIND.HIGHLIGHT) part.color = colorOf(c.color);
      if (c.note !== undefined) part.note = clip(c.note, ANNO.NOTE_MAX);
      if (!Object.keys(part).length) return null;
      part.updatedAt = now();
      return part;
    });
  }

  /**
   * 지우기 — 그 레코드와 같은 `group` 의 레코드 전부(같은 문서). 지운 레코드들을 돌려준다(되살리기 재료 — 20-2).
   * @returns {Promise<Object[]>}
   */
  function remove(id) {
    return db.withTx([STORE], 'readwrite', async (tx, s) => {
      const store = s[STORE];
      const cur = await rq(store.get(id));
      if (!isMine(cur)) return [];
      const gone = [cur];
      if (cur.group != null) {
        const rest = await new Promise((resolve, reject) => {
          const out = [];
          const req = store.index('docId').openCursor(cur.docId);
          req.onsuccess = () => {
            const c = req.result;
            if (!c) { resolve(out); return; }
            if (isMine(c.value) && c.value.group === cur.group && c.value.id !== cur.id) out.push(c.value);
            c.continue();
          };
          req.onerror = () => reject(req.error);
        });
        for (const r of rest) gone.push(r);
      }
      for (const r of gone) await rq(store.delete(r.id));
      return gone;
    });
  }

  /** 그 쪽 필기(`docId_pageNo` 인덱스) — 만든 순. */
  async function forPage(docId, pageNo) {
    const out = [];
    await db.iterate(STORE, { index: 'docId_pageNo', query: [String(docId), Number(pageNo)] }, (v) => {
      if (isMine(v)) out.push(v);
      return true;
    });
    return out.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
  }

  /** 목록 — `kind` 인덱스 둘 → `docId` 거름(주면) → 문서·쪽·만든 순. 문서가 지워진 레코드도 나온다. */
  async function list(opts) {
    const o = opts || {};
    const out = [];
    for (const k of ANNO.KINDS) {
      await db.iterate(STORE, { index: 'kind', query: k }, (v) => {
        if (isMine(v) && (o.docId == null || v.docId === String(o.docId))) out.push(v);
        return true;
      });
    }
    return out.sort((a, b) => {
      if (a.docId !== b.docId) return String(a.docId) < String(b.docId) ? -1 : 1;
      return ((Number(a.pageNo) || 0) - (Number(b.pageNo) || 0)) || ((Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
    });
  }

  /**
   * 수 — `pageNo` 를 주면 그 쪽만(쪽 칩 — 20-2), 아니면 그 문서 전체. 못 읽으면 0.
   * `[20-3 — 20-2R #3]` **묶음 수**(같은 `group` = 하나 — 쪽 필기 시트·필기 화면의 줄 수와 같다). 고아도 센다(시트에 줄이 있다).
   */
  async function count(docId, pageNo) {
    const groups = new Set();
    const byPage = pageNo !== undefined && pageNo !== null;
    try {
      await db.iterate(STORE, byPage ? { index: 'docId_pageNo', query: [String(docId), Number(pageNo)] } : { index: 'docId', query: String(docId) }, (v) => {
        if (isMine(v)) groups.add(groupKey(v));
        return true;
      });
    } catch (e) { return 0; }
    return groups.size;
  }

  /**
   * 다시 붙이기(20-D11) — 같은 `fileHash` 이고 `docId` 가 지금 `documents` 에 없는 레코드 → `docId = newId`. 한 트랜잭션.
   * 필기·요약·개요 모두(같은 스토어 · 같은 규칙). @returns {Promise<number>} 옮긴 수
   */
  function reattach(fileHash, newId) {
    if (!fileHash || newId == null) return Promise.resolve(0);
    return db.withTx(['documents', STORE], 'readwrite', async (tx, s) => {
      const docs = new Set((await rq(s.documents.getAllKeys())).map(String));
      const moved = await new Promise((resolve, reject) => {
        const out = [];
        const req = s[STORE].openCursor();
        req.onsuccess = () => {
          const c = req.result;
          if (!c) { resolve(out); return; }
          const v = c.value;
          if (v && v.fileHash === fileHash && !docs.has(String(v.docId)) && String(v.docId) !== String(newId)) out.push(v);
          c.continue();
        };
        req.onerror = () => reject(req.error);
      });
      for (const v of moved) await rq(s[STORE].put(Object.assign({}, v, { docId: String(newId) })));
      return moved.length;
    });
  }

  /**
   * 쪽을 그릴 때 — 그 쪽 필기를 지금 화면에서 다시 찾는다(20-D6). 판이 다르고 `how ≠ 'exact'` 인 것만 한 번 고쳐 쓴다.
   * @param {string} docId
   * @param {number} pageNo
   * @param {Object} desc 지금 쪽 `describePage(…)`
   * @param {{algo?:number, layout?:Object}} [opts]  `[20-2]` `layout` = 지금 쪽 레이아웃(동점 가르기 — 줄 PDF 좌표)
   * @returns {Promise<Array<{rec:Object, res:(Object|null)}>>} 고아는 `res: null`
   */
  async function placeOnPage(docId, pageNo, desc, opts) {
    const o = opts || {};
    const algo = o.algo == null ? ALGO_VERSION : Number(o.algo);
    const recs = await forPage(docId, pageNo);
    if (!recs.length || !desc) return recs.map((r) => ({ rec: r, res: null }));
    const pi = await pageIndex(desc);
    const boxOf = boxOfLayout(o.layout);
    const out = [];
    const fixes = [];
    for (const rec of recs) {
      const res = resolve(rec.anchor, pi.idx, { algo: algo, paraHashes: pi.paraHashes, boxOf: boxOf });
      out.push({ rec: rec, res: res });
      // `[20-2 — 20-1R #1]` 동점 규칙으로 정한 자리(`tie`)는 고쳐 쓰지 않는다 — 틀린 자리가 `exact` 로 굳지 않게(매번 다시 찾는다).
      if (res && !res.tie && res.how !== 'exact' && Number(rec.anchor && rec.anchor.algo) !== algo) fixes.push({ rec: rec, res: res });
    }
    for (const f of fixes) {
      const rs = f.res.ranges;
      const last = rs[rs.length - 1];
      const next = {
        lineIds: rs.map((r) => String(r.id)),
        start: { lineId: String(rs[0].id), off: rs[0].start },
        end: { lineId: String(last.id), off: last.end },
        algo: algo
      };
      try {
        const w = await db.patch(STORE, f.rec.id, (cur) => (isMine(cur) && Number(cur.anchor && cur.anchor.algo) !== algo
          ? { anchor: Object.assign({}, cur.anchor, next) } : null));
        if (w && w.wrote) f.rec.anchor = w.rec.anchor;
      } catch (e) { /* 고쳐 쓰기 실패는 칠하기를 막지 않는다 — 다음에 다시 찾는다 */ }
    }
    return out;
  }

  /**
   * `[20-2 — 20-D10]` 되살리기 — `remove` 가 돌려준 레코드를 그대로 다시 넣는다(3초 [되돌리기]). id·만든 때·`updatedAt` 그대로.
   * 필기 레코드가 아니면 넣지 않는다. 한 트랜잭션. @returns {Promise<number>} 넣은 수
   */
  function restore(recs) {
    const list = (Array.isArray(recs) ? recs : []).filter(isMine);
    if (!list.length) return Promise.resolve(0);
    return db.withTx([STORE], 'readwrite', async (tx, s) => {
      for (const r of list) await rq(s[STORE].put(r));
      return list.length;
    });
  }

  return { create, update, remove, forPage, list, count, reattach, placeOnPage, restore };
}

let shared = null;

/** 앱 기본 인스턴스. */
export function annotationStore() {
  if (!shared) shared = createAnnotationStore();
  return shared;
}
