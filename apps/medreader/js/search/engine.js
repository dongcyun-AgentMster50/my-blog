/* ============================================================
   MedReader — 검색 엔진 (서비스 계층 · spec 17-8-2 · 17-8-3 · 17-8-5 · 17-8-12 — 8g-2)

   `searchText`(쪽별 검색 글자, 8g-1)를 읽어 찾는다. DOM·`window` 를 모르고 `ui/`·`pdf/` 를
   import 하지 않는다(3-2: `search/*` 는 `config`·`text/*`·`db` 만). 사용자 문자열을 만들지 않는다 —
   결과·오류 **코드**만 돌려준다. 일치 규칙은 전부 순수 모듈 `text/search.js` 의 함수다(접기·검색어·
   적중·묶음) — 엔진은 읽기·캐시·순서·상한·취소만 맡는다.

   ── 무엇을 하나 ──────────────────────────────────────────
   · **백필**(17-8-3 · U4 · U10): 지금 algoVersion 의 `pages` 키(`docId_algoVersion`)와 지금 경첩의
     `searchText` 키(`docId_sk` = `[docId, SEARCH_KEY]`)를 **값을 읽지 않고** 비교해 빠진 쪽만 `pages` 를
     읽어 만든다(`BACKFILL_BATCH` 쪽씩 한 readwrite 트랜잭션 — 읽기와 쓰기가 같은 트랜잭션이라 추출기의
     쓰기와 엇갈리지 않는다). 옛 algoVersion 쪽은 만들지 않는다(재추출이 `pages` 와 함께 쓴다).
     만드는 레코드는 추출(`writePageAndSearch`)과 같은 식 — `{docId} + searchRecordOf(fromStored(rec))`.
     책마다 한 번(같은 책의 백필은 한 작업을 함께 기다린다).
   · **열린 책 메모리 캐시**(한 권): 그 책 `searchText` 를 `READ_BATCH` 쪽씩 읽어 원문 + 접은 글자 +
     heading 빈도표(U8)를 든다. 다른 책을 찾으면 바뀐다. 서재 전체 검색은 다른 책을 캐시하지 않는다
     (읽고 접고 찾고 버린다 — 메모리는 한 권분).
   · `notePage(docId, pageNo)` — 추출기 `page` 이벤트. 캐시된 책이면 그 쪽만 **다음 검색 전에** 다시 읽는다.
     `invalidate(docId)` — [텍스트 다시 추출]·재추출. 캐시를 버리고 다음 검색이 다시 채운다.
   · **세대 취소**(8b 와 같은 방식): `searchDoc`·`searchLibrary` 를 부를 때마다 세대가 오른다. 앞 세대
     검색은 `onPartial` 을 더 부르지 않고 `{cancelled:true}`(적중 0)로 끝난다. `signal`(AbortSignal)도 같다.
   · 상한: 책당 적중 `MAX_HITS_PER_DOC`(1,000) — 쪽 순서로 채우고(쪽 안은 본문 글자 → 표 글자),
     넘는 적중이 하나라도 있으면 `truncated`. 결과 순서는 묶음 head → body → table, 묶음 안은 쪽·오프셋 순.
   · 부분 추출: 있는 쪽만 찾는다 — `pagesCovered`(찾은 쪽 수)와 `pageCount`(documents)를 함께 준다.

   ── 결과 모양 (17-8-5) ───────────────────────────────────
     { docId, query, hits:[{pageNo, at, len, kind:'head'|'body'|'table'}], pagesCovered, pageCount, truncated,
       error?, cancelled?, partial?, preparing? }
     `at`·`len` 은 그 쪽 `text`(kind 'table' 이면 `table`) 안의 오프셋·길이 — 접기가 길이를 보존하므로 원문과 같다.
   ============================================================ */

import { SEARCH } from '../config.js';
import * as db from '../db.js';
import { algoVersion as ALGO_VERSION } from '../text/layout.js';
import { fromStored } from '../text/store.js';
import {
  searchRecordOf, SEARCH_KEY, foldText, parseQuery, findIn, hitLength, classifyHit, headFreq
} from '../text/search.js';

/** 묶음 순서(17-8-7) — 제목 → 본문 → 표. */
export const KIND_ORDER = Object.freeze({ head: 0, body: 1, table: 2 });

let gen = 0;            // 검색 세대 — 새 검색이 오르면 앞 검색의 결과를 버린다
let cache = null;       // 열린 책 한 권: newCache()
const bfJobs = new Map();   // docId → 백필 작업(같은 책은 하나를 함께 기다린다)

function reqP(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/* ════════════════════════════════════════════════════════
   1. 캐시 항목
   ════════════════════════════════════════════════════════ */

/** 검색 레코드 → 캐시 항목(원문 + 접은 글자). 모양이 깨진 레코드는 null(찾지 않는다). */
function entryOf(rec) {
  if (!rec || typeof rec.text !== 'string') return null;
  const n = Number(rec.pageNo);
  if (!Number.isInteger(n)) return null;
  const table = typeof rec.table === 'string' ? rec.table : '';
  return {
    pageNo: n, text: rec.text, table: table,
    heads: Array.isArray(rec.heads) ? rec.heads : [],
    folded: foldText(rec.text), tfolded: table ? foldText(table) : ''
  };
}

function newCache(docId) {
  return {
    docId: docId, map: new Map(), order: null, freq: new Map(), dirty: new Set(),
    loading: null, loaded: false, stale: false, bfDone: false, refreshing: null
  };
}

function addFreq(c, e, sign) {
  for (const [k, n] of headFreq([e])) {
    const v = (c.freq.get(k) || 0) + sign * n;
    if (v > 0) c.freq.set(k, v); else c.freq.delete(k);
  }
}

function putEntry(c, e) {
  const old = c.map.get(e.pageNo);
  if (old) addFreq(c, old, -1);
  c.map.set(e.pageNo, e);
  addFreq(c, e, +1);
  c.order = null;
}

function dropEntry(c, pageNo) {
  const old = c.map.get(pageNo);
  if (!old) return;
  addFreq(c, old, -1);
  c.map.delete(pageNo);
  c.order = null;
}

function sortedEntries(c) {
  if (!c.order) c.order = [...c.map.values()].sort((a, b) => a.pageNo - b.pageNo);
  return c.order;
}

/* ════════════════════════════════════════════════════════
   2. 읽기 — searchText 를 docId 범위로 READ_BATCH 쪽씩
   ════════════════════════════════════════════════════════ */

function readBatch(docId, after) {
  const range = after == null
    ? IDBKeyRange.bound([docId, -Infinity], [docId, Infinity])
    : IDBKeyRange.bound([docId, after], [docId, Infinity], true, false);
  return db.withTx('searchText', 'readonly', (tx, s) => reqP(s.searchText.getAll(range, SEARCH.READ_BATCH)));
}

/** 그 책 searchText 를 쪽 순서로 묶음마다 `onBatch(recs)`. `stop()` 이 참이면 멈춘다. */
async function eachBatch(docId, onBatch, stop) {
  let after = null;
  for (;;) {
    const recs = await readBatch(docId, after);
    if (stop && stop()) return false;
    if (!recs.length) return true;
    onBatch(recs);
    if (recs.length < SEARCH.READ_BATCH) return true;
    after = recs[recs.length - 1].pageNo;
  }
}

async function loadCache(c) {
  await eachBatch(c.docId, (recs) => {
    for (const r of recs) { const e = entryOf(r); if (e) putEntry(c, e); }
  }, () => c.stale);
  c.loaded = true;
}

/** `notePage` 로 표시된 쪽만 다시 읽는다(없어졌으면 뺀다). 도는 중이면 그것이 끝나기를 기다린 뒤 남은 것을. */
async function refreshDirty(c) {
  while (c.refreshing) await c.refreshing;
  if (!c.dirty.size) return;
  c.refreshing = rereadDirty(c).finally(() => { c.refreshing = null; });
  await c.refreshing;
}

async function rereadDirty(c) {
  const ns = [...c.dirty].sort((a, b) => a - b);
  c.dirty.clear();
  const recs = await db.withTx('searchText', 'readonly', (tx, s) =>
    Promise.all(ns.map((n) => reqP(s.searchText.get([c.docId, n])))));
  if (c.stale) return;
  for (let i = 0; i < ns.length; i++) {
    const e = entryOf(recs[i]);
    if (e && e.pageNo === ns[i]) putEntry(c, e); else dropEntry(c, ns[i]);
  }
}

/* ════════════════════════════════════════════════════════
   3. 백필 (17-8-3 · U4 · U10)
   ════════════════════════════════════════════════════════ */

/** 백필할 쪽 — 지금 algoVersion `pages` 중 지금 경첩 `searchText` 가 없는 쪽(값을 읽지 않는다). */
export async function backfillPlan(docId) {
  const [pk, sk] = await Promise.all([
    db.keysOf('pages', 'docId_algoVersion', IDBKeyRange.bound([docId, ALGO_VERSION], [docId, Infinity])),
    db.keysOf('searchText', 'docId_sk', IDBKeyRange.only([docId, SEARCH_KEY]))
  ]);
  const have = new Set(sk.map((k) => k[1]));
  return [...new Set(pk.map((k) => k[1]))].filter((n) => !have.has(n)).sort((a, b) => a - b);
}

/** 한 묶음 — `pages` 읽기와 `searchText` 쓰기가 한 readwrite 트랜잭션. 깨진 저장본은 건너뛴다. */
async function backfillBatch(docId, ns) {
  const made = [];
  let failed = 0;
  await db.withTx(['pages', 'searchText'], 'readwrite', (tx, s) => new Promise((resolve) => {
    let left = ns.length;
    if (!left) { resolve(); return; }
    const one = () => { if (--left === 0) resolve(); };
    for (const n of ns) {
      const r = s.pages.get([docId, n]);
      r.onsuccess = () => {
        const rec = r.result;
        if (rec) {
          try {
            // 추출(`writePageAndSearch`)과 같은 식 — 화면 글자. 키 칸(pageNo)은 읽은 키로 못 박는다.
            const st = Object.assign({ docId: docId }, searchRecordOf(fromStored(rec)));
            st.pageNo = n;
            s.searchText.put(st);
            made.push(st);
          } catch (e) { failed++; }
        }
        one();
      };
      r.onerror = () => { failed++; one(); };
    }
  }));
  return { made: made, failed: failed };
}

/**
 * 그 책의 백필. 같은 책에 이미 도는 작업이 있으면 그것을 함께 기다린다. 묶음이 끝날 때마다 열린 책
 * 캐시에 바로 넣는다. `SEARCH.ENABLED = false`(되돌림 스위치)면 아무것도 쓰지 않는다.
 * @param {string} docId
 * @param {{onProgress?:function({docId,done,total}):void}} [opts]
 * @returns {Promise<{total:number, done:number, written:number, failed:number}>}
 */
export function backfill(docId, opts) {
  const o = opts || {};
  const cur = bfJobs.get(docId);
  if (cur && !cur.cancelled) {
    if (o.onProgress) cur.listeners.add(o.onProgress);
    return cur.promise;
  }
  const job = { cancelled: false, listeners: new Set(o.onProgress ? [o.onProgress] : []), planned: null, promise: null };
  let planned;
  job.planned = new Promise((r) => { planned = r; });
  const out = { total: 0, done: 0, written: 0, failed: 0 };
  const tell = () => {
    for (const fn of job.listeners) { try { fn({ docId: docId, done: out.done, total: out.total }); } catch (e) { /* 화면 쪽 예외가 백필을 막지 않는다 */ } }
  };
  bfJobs.set(docId, job);
  job.promise = (async () => {
    if (!SEARCH.ENABLED) { planned(0); return out; }
    let missing = [];
    try { missing = await backfillPlan(docId); } finally { planned(missing.length); }
    out.total = missing.length;
    if (!missing.length) return out;
    tell();
    for (let i = 0; i < missing.length && !job.cancelled; i += SEARCH.BACKFILL_BATCH) {
      const ns = missing.slice(i, i + SEARCH.BACKFILL_BATCH);
      const r = await backfillBatch(docId, ns);
      out.done += ns.length;
      out.written += r.made.length;
      out.failed += r.failed;
      if (cache && cache.docId === docId && !cache.stale && !job.cancelled) {
        for (const st of r.made) { const e = entryOf(st); if (e) putEntry(cache, e); }
      }
      tell();
    }
    return out;
  })().finally(() => { if (bfJobs.get(docId) === job) bfJobs.delete(docId); });
  return job.promise;
}

/* ════════════════════════════════════════════════════════
   4. 찾기 — 쪽 순서로 상한까지 (본문 글자 → 표 글자)
   ════════════════════════════════════════════════════════ */

function newScan(maxHits) {
  const cap = maxHits == null ? SEARCH.MAX_HITS_PER_DOC : Math.max(0, Number(maxHits));
  return { hits: [], room: Number.isNaN(cap) ? SEARCH.MAX_HITS_PER_DOC : cap, truncated: false };
}

/**
 * 항목들(쪽 순서)에서 찾아 `st` 에 더한다. 상한을 채운 뒤에는 **하나라도 더 있는지만** 보고 멈춘다.
 * `kindOf(e, at)` 가 본문 적중의 묶음을 정한다.
 */
function scanInto(st, entries, pq, kindOf) {
  for (let k = 0; k < entries.length && !st.truncated; k++) {
    const e = entries[k];
    const hay = pq.cs ? e.text : e.folded;
    const tab = e.table ? (pq.cs ? e.table : e.tfolded) : '';
    if (st.room <= 0) {
      if (findIn(hay, pq, 1).length || (tab && findIn(tab, pq, 1).length)) st.truncated = true;
      continue;
    }
    const t = findIn(hay, pq, st.room + 1);
    if (t.length > st.room) { st.truncated = true; t.length = st.room; }
    for (const at of t) st.hits.push({ pageNo: e.pageNo, at: at, len: hitLength(hay, pq, at), kind: kindOf(e, at) });
    st.room -= t.length;
    if (st.truncated || !tab) continue;
    const u = findIn(tab, pq, st.room + 1);
    if (u.length > st.room) { st.truncated = true; u.length = st.room; }
    for (const at of u) st.hits.push({ pageNo: e.pageNo, at: at, len: hitLength(tab, pq, at), kind: 'table' });
    st.room -= u.length;
  }
}

/** 결과 순서 — 묶음(head → body → table), 묶음 안은 쪽 → 오프셋. */
export function orderHits(hits) {
  return hits.sort((a, b) => (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) || (a.pageNo - b.pageNo) || (a.at - b.at));
}

function scanCache(c, pq, maxHits) {
  const st = newScan(maxHits);
  scanInto(st, sortedEntries(c), pq, (e, at) => classifyHit(e, at, { freq: c.freq }));
  return { hits: orderHits(st.hits), pagesCovered: c.map.size, truncated: st.truncated };
}

/** 적중이 든 heading 문단의 글자(없으면 null) — 서재 범위에서 빈도표가 다 모인 뒤 묶음을 정할 때 쓴다. */
function headingTextAt(e, at) {
  if (classifyHit(e, at) !== 'head') return null;
  for (const h of e.heads) {
    if (at < h.o) continue;
    const x = e.text.indexOf('\n', h.o);
    const end = x < 0 ? e.text.length : x;
    if (at < end) return e.text.slice(h.o, end);
  }
  return null;
}

/* ════════════════════════════════════════════════════════
   5. 공개 API
   ════════════════════════════════════════════════════════ */

function cancelled(base) {
  return Object.assign(base, { hits: [], truncated: false, cancelled: true });
}

/** 열린 책 캐시를 채운다(다른 책이면 바꾼다). 그사이 무효화되면 다시. */
async function ensureLoaded(docId) {
  for (let tries = 0; tries < 3; tries++) {
    if (!cache || cache.docId !== docId || cache.stale) cache = newCache(docId);
    const c = cache;
    if (!c.loading) c.loading = loadCache(c);
    await c.loading;
    if (!c.stale && cache === c) return c;
  }
  return cache && cache.docId === docId ? cache : newCache(docId);
}

/**
 * 캐시 채우기 + 백필 + 표시된 쪽 다시 읽기. 검색 화면을 여는 순간 부른다(17-8-12 2-2) — 세대를 올리지 않는다.
 * `hook(c, total)` 은 백필할 쪽이 있을 때 백필을 기다리기 **전에** 한 번(그때까지의 쪽으로 먼저 찾게).
 */
async function ready(docId, o, hook) {
  const c = await ensureLoaded(docId);
  if (!c.bfDone) {
    const p = backfill(docId, { onProgress: o.onProgress });
    const job = bfJobs.get(docId);
    const total = job ? await job.planned : 0;
    if (total > 0 && hook) hook(c, total);
    const r = await p;
    if (!c.stale && r.done === r.total) c.bfDone = true;
  }
  await refreshDirty(c);
  return c;
}

/**
 * 검색 화면을 열 때 — 그 책 캐시를 미리 채운다(백필 포함). 진행 중 검색을 취소하지 않는다.
 * @returns {Promise<{docId:string, pagesCovered:number}>}
 */
export async function prepareDoc(docId, opts) {
  const c = await ready(docId, opts || {}, null);
  return { docId: docId, pagesCovered: c.map.size };
}

async function searchDocAt(docId, query, o, my, docRec) {
  const alive = () => my === gen && !(o.signal && o.signal.aborted);
  const pq = parseQuery(query);
  const base = { docId: docId, query: pq.q, hits: [], pagesCovered: 0, pageCount: 0, truncated: false };
  if (pq.error) return Object.assign(base, { error: pq.error });
  const doc = docRec !== undefined ? docRec : await db.get('documents', docId);
  if (!alive()) return cancelled(base);
  base.pageCount = Number(doc && doc.pageCount) || 0;
  const onProgress = o.onProgress ? (p) => { if (alive()) o.onProgress(p); } : null;
  const c = await ready(docId, { onProgress: onProgress }, (cc, total) => {
    // 백필 중에도 이미 있는 쪽은 찾는다 — 먼저 그 결과를 보낸다
    if (!alive() || !o.onPartial || !cc.map.size) return;
    o.onPartial(Object.assign({}, base, scanCache(cc, pq, o.maxHits), { partial: true, preparing: { done: 0, total: total } }));
  });
  if (!alive()) return cancelled(base);
  return Object.assign(base, scanCache(c, pq, o.maxHits));
}

/**
 * 한 책에서 찾는다(17-8-5). 부를 때마다 세대가 올라 앞 검색은 버려진다.
 * @param {string} docId
 * @param {string} query
 * @param {{signal?:AbortSignal, onPartial?:function(Object):void, onProgress?:function(Object):void, maxHits?:number}} [opts]
 */
export function searchDoc(docId, query, opts) {
  const my = ++gen;
  return searchDocAt(docId, query, opts || {}, my, undefined);
}

/** 캐시하지 않는 책 — 읽고 접고 찾고 버린다. 묶음은 빈도표가 다 모인 뒤 정한다(U8). */
async function streamDoc(d, pq, o, alive) {
  const base = { docId: d.id, query: pq.q, hits: [], pagesCovered: 0, pageCount: Number(d.pageCount) || 0, truncated: false };
  await backfill(d.id, { onProgress: o.onProgress ? (p) => { if (alive()) o.onProgress(p); } : undefined });
  if (!alive()) return cancelled(base);
  const st = newScan(o.maxHits);
  const freq = new Map();
  let covered = 0;
  const ok = await eachBatch(d.id, (recs) => {
    const es = [];
    for (const r of recs) { const e = entryOf(r); if (e) es.push(e); }
    covered += es.length;
    for (const [k, n] of headFreq(es)) freq.set(k, (freq.get(k) || 0) + n);
    if (!st.truncated) scanInto(st, es, pq, (e, at) => { const t = headingTextAt(e, at); return t == null ? 'body' : { t: t }; });
  }, () => !alive());
  if (!ok || !alive()) return cancelled(base);
  for (const h of st.hits) {
    if (h.kind && typeof h.kind === 'object') h.kind = classifyHit({ text: h.kind.t, heads: [{ i: 0, o: 0, r: 0 }] }, 0, { freq: freq });
  }
  return Object.assign(base, { hits: orderHits(st.hits), pagesCovered: covered, truncated: st.truncated });
}

/**
 * 서재 전체(17-8-5): 책마다 차례로(열린 책 먼저, 그다음 최근에 연 순), 끝난 책부터 `onPartial(책 결과)`.
 * @returns {Promise<{query:string, docs:Object[], error?:string, cancelled?:boolean}>}
 */
export async function searchLibrary(query, opts) {
  const o = opts || {};
  const my = ++gen;
  const alive = () => my === gen && !(o.signal && o.signal.aborted);
  const pq = parseQuery(query);
  const out = { query: pq.q, docs: [] };
  if (pq.error) return Object.assign(out, { error: pq.error });
  const docs = await db.withTx('documents', 'readonly', (tx, s) => reqP(s.documents.getAll()));
  if (!alive()) return { query: pq.q, docs: [], cancelled: true };
  const openId = cache && !cache.stale ? cache.docId : null;
  docs.sort((a, b) => ((b.id === openId) - (a.id === openId)) || ((Number(b.lastOpenedAt) || 0) - (Number(a.lastOpenedAt) || 0)));
  for (const d of docs) {
    const r = d.id === openId
      ? await searchDocAt(d.id, query, { signal: o.signal, onProgress: o.onProgress, maxHits: o.maxHits }, my, d)
      : await streamDoc(d, pq, o, alive);
    if (!alive() || r.cancelled) return { query: pq.q, docs: [], cancelled: true };
    out.docs.push(r);
    if (o.onPartial) o.onPartial(r);
  }
  return out;
}

/** 진행 중 검색을 모두 버린다(화면을 떠날 때). */
export function cancel() { gen++; }

/**
 * `[배선 — 추출기 'page' 이벤트]` 그 쪽 검색 글자가 새로 쓰였다. 캐시된 책이면 다음 검색 전에 그 쪽만
 * 다시 읽는다. 캐시가 없거나 다른 책이면 아무 일도 하지 않는다(읽기 0).
 */
export function notePage(docId, pageNo) {
  const n = Math.floor(Number(pageNo));
  if (!cache || cache.stale || cache.docId !== docId || !Number.isFinite(n)) return;
  cache.dirty.add(n);
}

/**
 * `[배선 — 텍스트 다시 추출·재추출·삭제]` 그 책 캐시를 버리고 도는 백필을 멈춘다. 다음 검색이 다시 채운다.
 * `docId` 를 빼면 전부.
 */
export function invalidate(docId) {
  const all = docId === undefined;
  if (cache && (all || cache.docId === docId)) { cache.stale = true; cache = null; }
  for (const [id, job] of bfJobs) if (all || id === docId) job.cancelled = true;
}

/** 진단·테스트용 — 지금 캐시의 모양(글자는 내지 않는다). */
export function cacheInfo() {
  if (!cache) return null;
  return { docId: cache.docId, pages: cache.map.size, dirty: cache.dirty.size, loaded: cache.loaded, backfilled: cache.bfDone };
}
