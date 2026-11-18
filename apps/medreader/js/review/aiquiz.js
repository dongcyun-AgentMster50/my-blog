/* ============================================================
   MedReader — AI 출제 서비스 (spec 17-13 3 — 15-1)

   ── 서비스 계층이다(3-2 — `review/*` 행은 `notes/*` 행과 같다) ──
   `config`·`db`·`hash`·`text/*` 만 import 한다. **`ui/`·`ai/` 를 모른다** — 파이프라인은 부르는 쪽이 **주입**한다(`make({pipeline})` —
   `pipeline.makeQuiz` 하나만 쓴다). 문구를 만들지 않는다(상태 코드만).

   ── 하는 일 ─────────────────────────────────────────────
   · 입력 모으기 — 범위 쪽(`pages`)을 **커서로 한 쪽씩** 읽어 그 자리에서 흐름 문단 글(`fromStored → describePage → flowParasOf →
     joinPieces`)만 남기고 쪽 레코드는 버린다(퀴즈 `makeIo` 와 같은 방식 — 장 하나 40쪽이어도 메모리에 쪽 하나).
     읽은 쪽(13 `@read`) · 저장 요약(11 `annotations` `summary`) · 이 범위 AI 문항이 쓴 문단(`usedParaIds`)을 모아 `passageFor`(순수)에 넘긴다.
   · 저장 — `questions` `source:'ai'`(DB 3 그대로). id = `docId:ai-p{a}-{b}:ai` + 줄기 해시 8자 → 같은 응답을 다시 받아도 중복 0.
     verified·rejected 둘 다 저장한다(rejected 는 출제하지 않음 — 10-4 5). 문서가 없으면 쓰지 않는다(지운 문서를 되살리지 않는다).
   · 다시 추출은 AI 문항을 지우지 않고(`db.keepsOnReset` — 15-D6), 문서 삭제는 함께 지운다(`CASCADE_STORES` 그대로 — 15-D7).
   ============================================================ */

import * as realDb from '../db.js';
import { PLAN, REVIEW } from '../config.js';
import { hashHex, normalizeForHash } from '../hash.js';
import { fromStored } from '../text/store.js';
import { describePage, flowParasOf, joinPieces } from '../text/screen.js';
import { passageFor, aiSectionId, rangeOf, isQuizPara, readPagesIn } from '../text/review.js';

export const STORE = 'questions';
export const SOURCE = 'ai';

/** 결과 상태(파이프라인 상태 말고) — 보내지 않은 까닭. 문구는 UI 가 고른다. */
export const MAKE = Object.freeze({
  BAD_RANGE: 'bad-range',       // 범위 꼴이 틀림
  NO_PIPELINE: 'no-pipeline',   // 파이프라인이 주입되지 않음
  UNREAD: 'unread',             // 범위에 읽은 쪽이 없다(15-D4 — 단추 흐림)
  NO_PASSAGE: 'no-passage'      // 읽은 쪽은 있으나 남은 후보 문단이 없다(다 썼거나 짧은 문단뿐)
});

function rq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 줄기 해시 앞 `REVIEW.ID_HASH_CHARS`(8)자 — 캐시 키와 같은 정규화·같은 해시(`s256:`·`fnv:` 머리를 뗀다). */
export async function stemHash(stem) {
  const h = await hashHex(normalizeForHash(String(stem == null ? '' : stem)));
  return h.replace(/^[a-z0-9]+:/, '').slice(0, REVIEW.ID_HASH_CHARS);
}

/** 문항 id `docId:sectionId:ai{해시8}`. */
export function questionId(docId, sectionId, hash8) {
  return String(docId) + ':' + String(sectionId) + ':ai' + String(hash8);
}

/**
 * 검증 결과 문항 하나 → 저장 레코드(9-2 필드 + 3-3). `id`·`number`·`createdAt` 은 `save` 가 정한다.
 * @param {Object} q `groundQuiz` 의 문항
 * @param {{docId:string, sectionId:string, src:string, target:string, domain?:string, provider?:string, model?:string}} m
 */
export function aiRecord(q, m) {
  const x = q || {};
  const withSrc = !!m.src && m.src !== m.target;
  const ex = x.explanation || {};
  const rec = {
    docId: String(m.docId),
    sectionId: String(m.sectionId),
    source: SOURCE,
    status: x.status === 'verified' ? 'verified' : 'rejected',
    stem: String(x.stem || ''),
    options: (Array.isArray(x.options) ? x.options : []).map((o) => ({ letter: String(o && o.letter || ''), text: String(o && o.text || '') })),
    answer: x.answer && Array.isArray(x.answer.letters) ? { letters: x.answer.letters.slice() } : null,
    explanation: withSrc ? { tr: String(ex.tr || ''), src: String(ex.src || '') } : { tr: String(ex.tr || '') },
    langs: withSrc ? { tr: String(m.target), src: String(m.src) } : { tr: String(m.target) },
    evidence: String(x.evidence || ''),
    grounding: (Array.isArray(x.grounding) ? x.grounding : []).map((g) => ({ quote: String(g.quote), pageNo: Number(g.pageNo), paraId: String(g.paraId) })),
    pageNo: Number.isFinite(Number(x.pageNo)) && x.pageNo !== null ? Number(x.pageNo) : null,
    paraIds: (Array.isArray(x.paraIds) ? x.paraIds : []).map(String),
    hasFigure: false,
    promptVersion: REVIEW.PROMPT_VERSION,
    model: m.model ? String(m.model) : null,
    provider: m.provider ? String(m.provider) : null,
    domain: m.domain ? String(m.domain) : ''
  };
  if (rec.status === 'rejected' && x.reason) rec.reason = String(x.reason);
  return rec;
}

/**
 * 서비스 하나. 앱은 기본 인스턴스(`aiQuiz`)를 쓰고, 테스트는 `db`·`now` 를 주입한다.
 * @param {{db?:Object, now?:()=>number, readRanges?:(docId:string)=>Promise<number[][]>}} [deps]
 *   `readRanges` — 읽은 쪽 구간(없으면 `progress` `@read` 레코드를 직접 읽는다 — 13-1 `readLog.readRanges` 와 같은 레코드)
 */
export function createAiQuiz(deps) {
  const d = deps || {};
  const db = d.db || realDb;
  const now = typeof d.now === 'function' ? d.now : () => Date.now();

  async function readRanges(docId) {
    if (typeof d.readRanges === 'function') return (await d.readRanges(String(docId))) || [];
    const rec = await db.get('progress', [String(docId), PLAN.READ_SECTION]);
    return rec && Array.isArray(rec.ranges) ? rec.ranges : [];
  }

  /** 이 범위의 AI 문항(만든 순서). `all` 이 아니면 verified 만(퀴즈 화면이 읽는 것 — rejected 는 출제하지 않는다). */
  async function list(docId, a, b, opts) {
    const r = rangeOf(a, b);
    if (!r) return [];
    const sid = aiSectionId(r[0], r[1]);
    const all = !!(opts && opts.all);
    const out = [];
    await db.iterate(STORE, { index: 'docId_sectionId', query: IDBKeyRange.only([String(docId), sid]) }, (q) => {
      if (q && q.source === SOURCE && (all || q.status === 'verified')) out.push(q);
    });
    return out.sort((x, y) => (Number(x.number) || 0) - (Number(y.number) || 0));
  }

  /** 이 범위 AI 문항이 쓴 문단(verified 의 근거 문단 · rejected 는 주장한 문단이 보낸 글에 있었을 때) — 같은 문단으로 또 만들지 않는다. */
  async function usedParaIds(docId, a, b) {
    return (await history(docId, a, b)).used;
  }

  /**
   * 쓴 문단 + 보낸 횟수(15-1R 낮음-2). 보낸 문단 목록은 그 누름으로 저장한 문항마다 `sentParaIds`(같은 목록)로 남는다 —
   * 같은 목록은 한 번 누름으로 센다(같은 입력 = 캐시 0호출이라 정말 한 번 보낸 것). 새 스토어·DB 판 0.
   * @returns {Promise<{used:Set<string>, sent:Map<string, number>}>}
   */
  async function history(docId, a, b) {
    const used = new Set();
    const batches = new Set();
    const sent = new Map();
    for (const q of await list(docId, a, b, { all: true })) {
      for (const p of Array.isArray(q.paraIds) ? q.paraIds : []) used.add(String(p));
      const s = Array.isArray(q.sentParaIds) ? q.sentParaIds.map(String) : null;
      if (!s || !s.length) continue;
      const key = s.join('\n');
      if (batches.has(key)) continue;
      batches.add(key);
      for (const p of new Set(s)) sent.set(p, (sent.get(p) || 0) + 1);
    }
    return { used: used, sent: sent };
  }

  /** 범위 쪽의 저장 요약이 붙은 문단 — `paraId` 와 `textHash` 둘 다(재추출로 문단 id 가 바뀌어도 해시로 맞는다). */
  async function summarized(docId, a, b) {
    const r = rangeOf(a, b);
    const s = new Set();
    if (!r) return s;
    await db.iterate('annotations', { index: 'docId_pageNo', query: IDBKeyRange.bound([String(docId), r[0]], [String(docId), r[1]]) }, (rec) => {
      if (!rec || rec.kind !== 'summary' || !rec.anchor) return;
      if (rec.anchor.paraId) s.add(String(rec.anchor.paraId));
      if (rec.anchor.textHash) s.add(String(rec.anchor.textHash));
    });
    return s;
  }

  /**
   * 범위 쪽의 출제 후보 문단 `[{paraId, pageNo, kind, text}]`(읽기 순서). 쪽 레코드는 커서 안에서 쓰고 버린다 —
   * 남기는 것은 후보 문단(kind body·list · 60자 이상)의 글뿐. 깨진 쪽 하나는 건너뛴다.
   * `withHash` 면 문단 글의 `textHash`(저장 요약과 같은 해시)를 붙인다.
   */
  async function loadParas(docId, a, b, withHash) {
    const r = rangeOf(a, b);
    if (!r) return [];
    const out = [];
    await db.iterate('pages', { query: IDBKeyRange.bound([String(docId), r[0]], [String(docId), r[1]]) }, (row) => {
      try {
        const desc = describePage(fromStored(row));
        for (const p of flowParasOf(desc)) {
          if (p.id == null) continue;
          const para = { paraId: String(p.id), pageNo: Number(row.pageNo), kind: p.kind || 'body', text: joinPieces(p.lines).text };
          if (isQuizPara(para)) out.push(para);
        }
      } catch (e) { /* 깨진 저장본 한 쪽은 건너뛴다 */ }
    });
    if (withHash) {
      const hs = await Promise.all(out.map((p) => hashHex(normalizeForHash(p.text))));
      for (let i = 0; i < out.length; i++) out[i].textHash = hs[i];
    }
    return out;
  }

  /**
   * 출제 입력(보내지 않는다 — 단추 아래 "약 n자 · 남은 문단 m" 의 재료이자 `make` 가 보낼 것).
   * @returns {Promise<{items:Array, chars:number, left:number, candidates:number, readPages:number, pages:number, sectionId:string}>}
   */
  async function passage(docId, a, b, opts) {
    const r = rangeOf(a, b);
    if (!r) return { items: [], chars: 0, left: 0, candidates: 0, fresh: 0, readPages: 0, pages: 0, sectionId: '' };
    const read = await readRanges(docId);
    const readPages = readPagesIn(read, r[0], r[1]);
    const base = { readPages: readPages, pages: r[1] - r[0] + 1, sectionId: aiSectionId(r[0], r[1]) };
    if (!readPages) return Object.assign({ items: [], chars: 0, left: 0, candidates: 0, fresh: 0 }, base);
    const sum = await summarized(docId, r[0], r[1]);
    const h = await history(docId, r[0], r[1]);
    let hashes = false;
    for (const k of sum) if (/^(s256|fnv):/.test(k)) { hashes = true; break; }
    const paras = await loadParas(docId, r[0], r[1], hashes);
    const p = passageFor({ paras: paras, readRanges: read, usedParaIds: h.used, summarized: sum, sent: h.sent, budget: opts && opts.budget });
    return Object.assign(p, base);
  }

  /**
   * 검증 결과(`groundQuiz` 값) → `questions` 에 저장. 한 트랜잭션: 문서가 있는지 보고, 이 섹션의 기존 문항을 읽어
   * 같은 id 면 `number`·`createdAt` 을 지키고 바꾼다(verified 를 rejected 로 덮지는 않는다). 새 문항은 다음 번호.
   * @param {{questions:Object[]}} value
   * @param {{src:string, target:string, domain?:string, provider?:string, model?:string}} meta
   * @returns {Promise<{wrote:number, verified:number, rejected:number, ids:string[]}|null>} 문서가 없으면 null
   */
  async function save(docId, a, b, value, meta) {
    const r = rangeOf(a, b);
    const qs = value && Array.isArray(value.questions) ? value.questions : [];
    if (!r || !qs.length) return { wrote: 0, verified: 0, rejected: 0, ids: [] };
    const sid = aiSectionId(r[0], r[1]);
    const id = String(docId);
    const m = Object.assign({}, meta || {}, { docId: id, sectionId: sid });
    const sentIds = Array.isArray(m.sent) ? m.sent.map(String).filter((s) => s !== '') : [];
    // 해시(비동기)는 트랜잭션 **밖에서** — 트랜잭션 안에서 IDB 아닌 것을 기다리면 트랜잭션이 끝난다.
    const recs = [];
    const seen = new Set();
    for (const q of qs) {
      const rec = aiRecord(q, m);
      if (sentIds.length) rec.sentParaIds = sentIds.slice();          // 15-1R — 이 누름에 보낸 문단(보낸 횟수 세기)
      rec.id = questionId(id, sid, await stemHash(rec.stem || JSON.stringify(q)));
      if (seen.has(rec.id)) continue;                              // 같은 응답 안 같은 줄기 — 앞의 것
      seen.add(rec.id);
      recs.push(rec);
    }
    const at = now();
    return db.withTx(['documents', STORE], 'readwrite', async (tx, s) => {
      const doc = await rq(s.documents.get(id));
      if (!doc) return null;
      const have = new Map();
      let max = 0;
      await new Promise((resolve, reject) => {
        const req = s[STORE].index('docId_sectionId').openCursor(IDBKeyRange.only([id, sid]));
        req.onsuccess = () => {
          const c = req.result;
          if (!c) { resolve(); return; }
          have.set(c.value.id, c.value);
          max = Math.max(max, Number(c.value.number) || 0);
          c.continue();
        };
        req.onerror = () => reject(req.error);
      });
      const out = { wrote: 0, verified: 0, rejected: 0, ids: [] };
      for (const rec of recs) {
        const old = have.get(rec.id);
        if (old && old.status === 'verified' && rec.status === 'rejected') continue;
        rec.number = old ? old.number : ++max;
        rec.createdAt = old && Number.isFinite(Number(old.createdAt)) ? old.createdAt : at;
        await rq(s[STORE].put(rec));
        out.wrote++;
        out[rec.status === 'verified' ? 'verified' : 'rejected']++;
        out.ids.push(rec.id);
      }
      return out;
    });
  }

  /**
   * [문제 만들기 5개] — 입력 고르기 → `pipeline.makeQuiz`(최대 1호출) → 저장. **사용자가 누를 때만** 부른다.
   * @param {{docId:string, a:number, b:number, pipeline:{makeQuiz:Function}, src:string, target:string, domain?:string,
   *          retry?:boolean, force?:boolean, signal?:AbortSignal, budget?:number}} o
   * @returns {Promise<Object>} `{status, calls, state, code?, cached, sectionId, chars, left, sent, total, verified, rejected, weak, saved}` — 던지지 않는다(저장 실패만 `saveError`)
   */
  async function make(o) {
    const x = o || {};
    const r = rangeOf(x.a, x.b);
    if (!r) return { status: MAKE.BAD_RANGE, calls: 0 };
    if (!x.pipeline || typeof x.pipeline.makeQuiz !== 'function') return { status: MAKE.NO_PIPELINE, calls: 0 };
    const docId = String(x.docId);
    const p = await passage(docId, r[0], r[1], { budget: x.budget });
    const base = { sectionId: p.sectionId, chars: p.chars, left: p.left, fresh: p.fresh, readPages: p.readPages };
    if (!p.readPages) return Object.assign({ status: MAKE.UNREAD, calls: 0 }, base);
    if (!p.items.length) return Object.assign({ status: MAKE.NO_PASSAGE, calls: 0 }, base);
    const res = await x.pipeline.makeQuiz(p.items, {
      src: x.src, target: x.target, docId: docId, domain: x.domain, retry: !!x.retry, force: !!x.force, signal: x.signal
    });
    const r0 = (res && Array.isArray(res.results) && res.results[0]) || {};
    const out = Object.assign({ status: res && res.status, calls: (res && res.calls) || 0, state: r0.state, code: r0.code, cached: !!r0.cached,
      sent: (res && res.sent) || [] }, base);
    const v = r0.state === 'ready' ? r0.value : null;
    if (!v) return out;
    Object.assign(out, { total: v.total, verified: v.verified, rejected: v.rejected, weak: !!v.weak });
    try {
      out.saved = await save(docId, r[0], r[1], v, { src: x.src, target: x.target, domain: x.domain, provider: res.provider, model: res.model,
        sent: out.sent });
    } catch (e) {
      out.saveError = String((e && e.name) || 'Error');
    }
    return out;
  }

  /** 한 문서의 AI 문항 수(서재 삭제 확인 "AI 문제 n개도 지워집니다" — 15-2). */
  async function countForDoc(docId) {
    let n = 0;
    await db.iterate(STORE, { index: 'docId', query: IDBKeyRange.only(String(docId)) }, (q) => { if (q && q.source === SOURCE) n++; });
    return n;
  }

  return {
    readRanges: readRanges,
    list: list,
    usedParaIds: usedParaIds,
    history: history,
    summarized: summarized,
    loadParas: loadParas,
    passage: passage,
    save: save,
    make: make,
    countForDoc: countForDoc
  };
}

/** 앱 기본 인스턴스(`js/db.js`). */
export const aiQuiz = createAiQuiz();
