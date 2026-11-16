/* ============================================================
   MedReader — 저장한 요약·범위 개요 (spec 17-2-1 4-4 · 4-6 — 11-1)

   ── 서비스 계층이다(3-2 — `notes/*` 행은 `vocab/*`·`search/*` 행과 같다) ──
   `config`·`db`·`hash`·`text/summary` 만 import 한다. **`ui/`·`ai/` 를 모른다** — 요약 요청은 화면이 파이프라인
   (`summarize`·`outline`)을 부르고 그 결과를 여기에 넘긴다. 문구를 만들지 않는다.

   ── 저장 위치 (9-2 `annotations` — DB 버전 3 그대로) ─────
   `kind:'summary'`(문단 요약 하나) · `kind:'outline'`(범위 개요 하나). 레코드 **맨 위**에 `docId`·`pageNo` 를 둔다 —
   `docId_pageNo` 인덱스가 잡는다. 원문 문단 글은 **저장하지 않는다**(크기·사본 — 해시 `anchor.textHash` 로 다시 찾는다).
   문서를 지워도 남는다(`db.keepsOnDocDelete` — `annotations` 스토어 전체, 11-D8 · 20-D11).

   ── 같은 문단 다시 저장 = 대체 (11-D10) ───────────────────
   같은 `docId` + `anchor.textHash` + `target` 이 있으면 새로 만들지 않고 그 레코드를 바꾼다(`id`·`createdAt` 유지,
   `updatedAt` 만 새로). 찾기와 쓰기는 한 트랜잭션(두 번 눌러도 한 레코드). 개요는 같은 `docId` + 범위(`from`·`to`) + `target`.

   ── 시각 ── 숫자 ms(`createdAt`·`updatedAt` — 9c 병합이 `updatedAt` 새로운 쪽을 고른다).
   ============================================================ */

import * as realDb from '../db.js';
import { hashHex, normalizeForHash } from '../hash.js';
import { compareAnchor, clean, relocate as relocatePure } from '../text/summary.js';

export const STORE = 'annotations';
/** 9-2 `annotations.kind` 에 더한 값 둘. */
export const KIND = Object.freeze({ SUMMARY: 'summary', OUTLINE: 'outline' });

function rq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 문단 글의 해시 — 캐시 키와 같은 정규화(`normalizeForHash`)·같은 해시(`hashHex`). 저장 요약의 `anchor.textHash`. */
export function textHashOf(text) {
  return hashHex(normalizeForHash(String(text == null ? '' : text)));
}

/** 지금 쪽 문단들에 `textHash` 를 채운다(`relocate` 의 재료 — 원문 글은 이 함수 안에서만 쓰고 저장하지 않는다). */
export async function withHashes(paras) {
  const list = Array.isArray(paras) ? paras : [];
  const hs = await Promise.all(list.map((p) => textHashOf(p && p.text)));
  return list.map((p, i) => Object.assign({}, p, { textHash: hs[i] }));
}

/** `relocate` — 순수 쪽(`text/summary.js`)을 그대로 내보낸다. */
export const relocate = relocatePure;

function arr(v) { return Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : []; }
function str(v) { return typeof v === 'string' ? v : ''; }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

/**
 * 파이프라인 결과 + 문단 → `summary` 레코드(`id`·시각은 `save` 가). 원문 글(`para.text`)은 해시만 쓰고 담지 않는다.
 * @param {{docId:string, pageNo:number, docTitle?:string, fileHash?:string, para:{paraId:string, lineIds?:string[], text?:string},
 *          textHash?:string, target:string, src?:string, langs?:string[], value:{gist:string, gistSrc?:string, points?:Array, terms?:Array},
 *          domain?:string, cacheKey?:string, provider?:string, model?:string, promptVersion?:number}} input
 */
function summaryRecord(input, textHash) {
  const i = input || {};
  const p = i.para || {};
  const v = i.value || {};
  const pageNo = num(i.pageNo);
  const rec = {
    kind: KIND.SUMMARY,
    docId: String(i.docId),
    pageNo: pageNo,
    docTitle: str(i.docTitle),
    anchor: {
      pageNo: pageNo,
      lineIds: Array.isArray(p.lineIds) ? p.lineIds.map(String) : [],
      paraId: p.paraId == null ? null : String(p.paraId),
      textHash: textHash
    },
    target: String(i.target),
    src: str(i.src),
    langs: Array.isArray(i.langs) ? i.langs.map(String) : [],
    gist: str(v.gist),
    gistSrc: str(v.gistSrc),
    points: arr(v.points),
    terms: arr(v.terms),
    domain: str(i.domain),
    cacheKey: str(i.cacheKey),
    provider: str(i.provider) || null,
    model: str(i.model) || null,
    promptVersion: num(i.promptVersion)
  };
  if (str(i.fileHash)) rec.fileHash = i.fileHash;        // 20-D11 — 같은 PDF 에 다시 붙이기의 재료(있을 때만)
  return rec;
}

/**
 * 저장소 하나. 앱은 기본 인스턴스를 만들어 쓰고, 테스트는 `db`·`now` 를 주입한다.
 * @param {{db?:Object, now?:()=>number}} [deps] `db` 는 `js/db.js` 와 같은 모양(`withTx`·`iterate`·`get`)
 */
export function createSummaryStore(deps) {
  const d = deps || {};
  const db = d.db || realDb;
  const now = typeof d.now === 'function' ? d.now : () => Date.now();

  /** 한 트랜잭션 안에서 `docId` 인덱스를 훑어 `match` 첫 레코드. */
  function findIn(store, docId, match) {
    return new Promise((resolve, reject) => {
      const req = store.index('docId').openCursor(docId);
      req.onsuccess = () => {
        const c = req.result;
        if (!c) { resolve(null); return; }
        if (match(c.value)) { resolve(c.value); return; }
        c.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }

  /** 대체 저장 — 같은 것이 있으면 그 `id`·`createdAt` 을 지키고 나머지를 바꾼다. 없으면 새 id(`base`, 쓰였으면 `:시각`). */
  function upsert(rec, base, match) {
    const at = now();
    return db.withTx([STORE], 'readwrite', async (tx, s) => {
      const store = s[STORE];
      const same = await findIn(store, rec.docId, match);
      let created = false;
      if (same) {
        rec.id = same.id;
        rec.createdAt = Number.isFinite(Number(same.createdAt)) ? Number(same.createdAt) : at;
      } else {
        const taken = await rq(store.get(base));
        rec.id = taken ? base + ':' + at : base;
        rec.createdAt = at;
        created = true;
      }
      rec.updatedAt = at;
      await rq(store.put(rec));
      return { rec: rec, created: created };
    });
  }

  /**
   * 문단 요약 저장(11-D10 대체). `textHash` 를 주지 않으면 `para.text` 로 만든다.
   * @returns {Promise<{rec:Object, created:boolean}|null>} 문서·쪽·대상 언어·요지가 없으면 null
   */
  async function save(input) {
    const i = input || {};
    const textHash = typeof i.textHash === 'string' && i.textHash ? i.textHash
      : (i.para && typeof i.para.text === 'string' && i.para.text.trim() ? await textHashOf(i.para.text) : '');
    const rec = summaryRecord(i, textHash);
    if (!i.docId || rec.pageNo === null || !i.target || !textHash || !clean(rec.gist)) return null;
    const base = 'sum:' + (await hashHex(rec.docId + '\u0001' + textHash + '\u0001' + rec.target));
    return upsert(rec, base, (v) => !!v && v.kind === KIND.SUMMARY && v.target === rec.target &&
      !!v.anchor && v.anchor.textHash === textHash);
  }

  /**
   * 범위 개요 저장(같은 `docId`·범위·대상 언어면 대체). `pageNo` = 범위 첫 쪽.
   * @param {{docId:string, docTitle?:string, fileHash?:string, range:{from:number, to:number, label?:string}, target:string,
   *          value:{title:string, points:Array}, sources?:string[], domain?:string, cacheKey?:string, provider?:string,
   *          model?:string, promptVersion?:number}} input
   * @returns {Promise<{rec:Object, created:boolean}|null>}
   */
  async function saveOutline(input) {
    const i = input || {};
    const r = i.range || {};
    const from = num(r.from);
    const to = num(r.to);
    const v = i.value || {};
    if (!i.docId || from === null || to === null || !i.target || !clean(v.title)) return null;
    const rec = {
      kind: KIND.OUTLINE,
      docId: String(i.docId),
      pageNo: from,
      docTitle: str(i.docTitle),
      range: { from: from, to: to, label: str(r.label) },
      target: String(i.target),
      title: str(v.title),
      points: arr(v.points),
      sources: Array.isArray(i.sources) ? i.sources.map(String) : [],
      domain: str(i.domain),
      cacheKey: str(i.cacheKey),
      provider: str(i.provider) || null,
      model: str(i.model) || null,
      promptVersion: num(i.promptVersion)
    };
    if (str(i.fileHash)) rec.fileHash = i.fileHash;
    const base = 'out:' + (await hashHex(rec.docId + '\u0001' + from + '-' + to + '\u0001' + rec.target));
    return upsert(rec, base, (x) => !!x && x.kind === KIND.OUTLINE && x.target === rec.target &&
      !!x.range && Number(x.range.from) === from && Number(x.range.to) === to);
  }

  /** 같은 문단(해시)·같은 대상 언어의 저장 요약. 없으면 null. 호출 0. */
  async function findFor(docId, textHash, target) {
    if (!docId || !textHash) return null;
    let hit = null;
    await db.iterate(STORE, { index: 'docId', query: String(docId) }, (v) => {
      if (v && v.kind === KIND.SUMMARY && v.target === target && v.anchor && v.anchor.textHash === textHash) { hit = v; return false; }
      return true;
    });
    return hit;
  }

  /**
   * 목록 — `kind` 인덱스(기본 `summary`) → `docId` 거름(주면) → 쪽·문단 순. 문서가 지워진 레코드도 그대로 나온다(`docTitle` 로 묶는다).
   * @param {{docId?:string, kind?:string}} [opts]
   */
  async function list(opts) {
    const o = opts || {};
    const kind = o.kind === KIND.OUTLINE ? KIND.OUTLINE : KIND.SUMMARY;
    const out = [];
    await db.iterate(STORE, { index: 'kind', query: kind }, (v) => {
      if (v && (o.docId === undefined || o.docId === null || v.docId === String(o.docId))) out.push(v);
      return true;
    });
    return out.sort((a, b) => {
      if (a.docId !== b.docId) return String(a.docId) < String(b.docId) ? -1 : 1;
      return compareAnchor(a, b);
    });
  }

  /** 그 문서의 저장 요약 수(`kind` 를 주지 않으면 요약 + 개요 — 서재 삭제 확인 "남습니다" 줄의 재료). 못 읽으면 0. */
  async function count(docId, kind) {
    let n = 0;
    try {
      await db.iterate(STORE, { index: 'docId', query: String(docId) }, (v) => {
        if (v && (kind ? v.kind === kind : (v.kind === KIND.SUMMARY || v.kind === KIND.OUTLINE))) n++;
        return true;
      });
    } catch (e) { return 0; }
    return n;
  }

  /** 지우기 — 요약·개요 레코드만(다른 `annotations` — 필기 — 는 이 함수로 지우지 않는다). @returns {Promise<boolean>} */
  function remove(id) {
    return db.withTx([STORE], 'readwrite', async (tx, s) => {
      const store = s[STORE];
      const cur = await rq(store.get(id));
      if (!cur || (cur.kind !== KIND.SUMMARY && cur.kind !== KIND.OUTLINE)) return false;
      await rq(store.delete(id));
      return true;
    });
  }

  return { save: save, saveOutline: saveOutline, findFor: findFor, list: list, count: count, remove: remove, relocate: relocatePure };
}

let shared = null;

/** 앱 기본 인스턴스. */
export function summaryStore() {
  if (!shared) shared = createSummaryStore();
  return shared;
}
