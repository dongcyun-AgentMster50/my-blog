/* ============================================================
   MedReader — 단어장 저장소 (spec 17-7-3 · 17-7-6 4-4 — 8f-1)

   ── 서비스 계층이다(3-2 · 17-7-6 5 import 방향) ─────────
   `config`·`db`·`text/vocab`·`hash` 만 import 한다. **`ui/`·`ai/` 를 모른다** — 단어 요청은 화면이
   파이프라인(`translateTerms`)을 부르고 결과를 여기에 넘긴다. 문구를 만들지 않는다.

   ── 저장 위치 ───────────────────────────────────────────
   새 스토어가 아니라 `cards` 의 `kind:'term'`(DB 버전 3 그대로 — 8cf-D14 `kind` 인덱스도 만들지 않는다).
   `term` 인덱스로 찾고, 목록은 `docId` 인덱스 또는 전체 훑기 후 `kind === 'term'` 으로 거른다.
   문서를 지워도 남는다(`db.deleteDocument` 의 `keepsOnDocDelete`).

   ── 시각·복습 필드 (12-D9·D10·D18) ───────────────────────
   `createdAt`·`updatedAt`·`dueAt` 은 **숫자 ms**. `updatedAt` 은 **내용 수정만** 올린다.
   `sm2`·`dueAt`·`reviewedAt`·`introducedAt`(복습 — 12 가 쓴다)은 `update`·`applyImport` 가 **덮지 않는다** —
   9c 병합 `max(updatedAt, reviewedAt)` 이 내용 수정과 복습을 따로 볼 수 있게.

   ── id ──────────────────────────────────────────────────
   `'vt:' + hashHex(targetLang + U+0001 + term)` — 같은 낱말·같은 대상 언어면 기기가 달라도 같은 id(9c 병합·CSV 가 id 로
   맞는다). U+0001 은 `normalizeForHash` 처럼 접히지 않는다. 원어를 고쳐 그 id 가 이미 다른 항목에 쓰였으면 `:` + 만든 시각을 붙인다.
   ============================================================ */

import * as realDb from '../db.js';
import { hashHex } from '../hash.js';
import { normalizeTerm, newTermEntry, fieldValue, baseOf, TERM_CONTENT_FIELDS } from '../text/vocab.js';

/** 사용자가 고칠 수 있는 필드(17-7-3 — 번역·뜻·메모, 원어 오타). `update` 가 이 밖은 받지 않는다. */
const EDITABLE = Object.freeze(TERM_CONTENT_FIELDS.concat(['docTitle', 'pageNo', 'lineId', 'origin', 'suspended', 'docId']));
/** 내용 필드 — 바뀌면 `updatedAt` 을 올린다. 사용자가 바꾸면 `edited:true`. */
const CONTENT = new Set(TERM_CONTENT_FIELDS);

function rq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 단어장 항목 id(위 머리말). */
export async function termIdOf(term, targetLang) {
  return 'vt:' + (await hashHex(String(targetLang) + '\u0001' + String(term)));
}

/**
 * 저장소 하나. 앱은 `vocabStore`(기본 인스턴스)를 쓰고, 테스트는 `db`·`now` 를 주입한다.
 * @param {{db?:Object, now?:()=>number}} [deps] `db` 는 `js/db.js` 와 같은 모양(`withTx`·`iterate`·`get`·`del`·`patch`)
 */
export function createVocabStore(deps) {
  const d = deps || {};
  const db = d.db || realDb;
  const now = typeof d.now === 'function' ? d.now : () => Date.now();

  /**
   * 같은 `term`(정규화) + `targetLang` 항목. 없으면 null. 호출 0.
   * @returns {Promise<Object|null>}
   */
  async function findTerm(term, targetLang) {
    const t = normalizeTerm(term);
    const tl = String(targetLang || '');
    if (!t || !tl) return null;
    let hit = null;
    await db.iterate('cards', { index: 'term', query: t }, (v) => {
      if (v && v.kind === 'term' && v.targetLang === tl) { hit = v; return false; }
      return true;
    });
    return hit;
  }

  /**
   * 저장. 같은 `term`+`targetLang` 이 이미 있으면 **새로 만들지 않고** 그 항목을 돌려준다(화면이 열어 보이고
   * `[문맥을 이 문장으로 바꾸기]`만 준다 — 17-7-3). 찾기와 쓰기는 한 트랜잭션(두 번 눌러도 한 항목).
   * @param {Object} entry `newTermEntry` 입력(`surface`·`targetLang` 필수)
   * @returns {Promise<{entry:Object|null, created:boolean}>} 원어·대상 언어가 비면 `{entry:null, created:false}`
   */
  async function save(entry) {
    const at = now();
    const rec = newTermEntry(entry, at);
    if (!rec.term || !rec.targetLang) return { entry: null, created: false };
    const baseId = await termIdOf(rec.term, rec.targetLang);
    return db.withTx(['cards'], 'readwrite', async (tx, s) => {
      const store = s.cards;
      const same = await new Promise((resolve, reject) => {
        const req = store.index('term').openCursor(rec.term);
        req.onsuccess = () => {
          const c = req.result;
          if (!c) { resolve(null); return; }
          if (c.value && c.value.kind === 'term' && c.value.targetLang === rec.targetLang) { resolve(c.value); return; }
          c.continue();
        };
        req.onerror = () => reject(req.error);
      });
      if (same) return { entry: same, created: false };
      const taken = await rq(store.get(baseId));
      rec.id = taken ? baseId + ':' + at : baseId;
      await rq(store.put(rec));
      return { entry: rec, created: true };
    });
  }

  /**
   * 고치기. `EDITABLE` 필드만 받는다(`id`·`kind`·`term`·복습 필드·`createdAt` 은 무시). `surface` 가 바뀌면 `term` 을 다시 만든다.
   * 내용 필드가 실제로 바뀌면 `updatedAt = now`, `opts.user` 면 `edited:true`. 바뀐 것이 없으면 쓰지 않는다.
   * `[8f-3 — crossstep "8f-1 Review" ②]` 내용 값은 `fieldValue`(가져오기·CSV 와 **같은 규칙**)로 정규화한 뒤 비교·저장한다 —
   * 겹공백·끝 줄바꿈만 다른 값은 "바뀌지 않음"(edited·updatedAt 그대로), 그래서 내보낸 CSV 를 그대로 가져와도 "그대로".
   * `[8f-3 — 8f-2 남은 문제 2]` 사용자 수정이 아닐 때(`opts.user` 아님) patch 의 `edited`(참/거짓)를 받는다 — 사용자가 받아들인
   * 다시 번역([이 문맥으로 다시 번역]·[번역 안 된 것 모두 번역])은 `edited:false` 로 고친 표시를 내린다. `edited` 가 바뀌어도 `updatedAt`.
   * `[8f-3b — 8f3R-10 #4]` `opts.ifBase`(= `baseOf(요청 때 항목)`)를 주면 같은 트랜잭션 안에서 기기 레코드의 지문을 다시 보고, 다르면
   * (그사이 사용자가 고침) **쓰지 않고 null** — [번역 안 된 것 모두 번역] 응답이 그사이 직접 친 번역을 덮지 않게.
   * @returns {Promise<Object|null>} 고친(또는 그대로인) 레코드, 없거나 term 이 아니거나 `ifBase` 가 어긋나면 null
   */
  async function update(id, patch, opts) {
    const o = opts || {};
    const p = patch || {};
    let stale = false;
    const r = await db.patch('cards', id, (cur) => {
      if (!cur || cur.kind !== 'term') return null;
      if (typeof o.ifBase === 'string' && baseOf(cur) !== o.ifBase) { stale = true; return null; }
      const next = {};
      let content = false;
      for (const k of EDITABLE) {
        if (!Object.prototype.hasOwnProperty.call(p, k)) continue;
        const isContent = CONTENT.has(k);
        const v = isContent ? fieldValue(k, p[k]) : p[k];
        if (isContent ? fieldValue(k, cur[k]) === v : cur[k] === v) continue;
        next[k] = v;
        if (isContent) content = true;
      }
      if (Object.prototype.hasOwnProperty.call(next, 'surface')) {
        const t = normalizeTerm(next.surface);
        if (!t) return null;                      // 원어를 비울 수는 없다
        if (t !== cur.term) next.term = t;
      }
      // `[12-1 — 8f1R]` 멈춤은 내용이 아니다(`updatedAt` 그대로) — 대신 `suspendedAt` 으로 9c 병합이 늦은 쪽을 고른다.
      if (Object.prototype.hasOwnProperty.call(next, 'suspended')) next.suspendedAt = now();
      if (!o.user && typeof p.edited === 'boolean' && p.edited !== !!cur.edited) { next.edited = p.edited; content = true; }
      if (!Object.keys(next).length) return null;
      if (content) {
        next.updatedAt = now();
        if (o.user) next.edited = true;
      }
      return next;
    });
    if (stale || !r.rec || r.rec.kind !== 'term') return null;
    return r.rec;
  }

  /** 지우기 — term 항목만. @returns {Promise<boolean>} */
  async function remove(id) {
    const cur = await db.get('cards', id);
    if (!cur || cur.kind !== 'term') return false;
    await db.del('cards', id);
    return true;
  }

  /**
   * 목록 — `docId` 를 주면 그 문서의 것(`docId` 인덱스), 아니면 전체 훑기. `createdAt` 오름차순.
   * @param {{docId?:string}} [q]
   * @returns {Promise<Object[]>}
   */
  async function list(q) {
    const docId = q && q.docId != null && q.docId !== '' ? String(q.docId) : null;
    const out = [];
    await db.iterate('cards', docId ? { index: 'docId', query: docId } : {}, (v) => {
      if (v && v.kind === 'term') out.push(v);
      return true;
    });
    out.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
    return out;
  }

  /** 그 문서의 단어장 수(서재 삭제 확인 "단어장 n개는 남습니다" — 8f-2). */
  async function countByDoc(docId) {
    return (await list({ docId: docId })).length;
  }

  /**
   * `t`(ms 또는 ISO — `vocab.lastExportAt`) 뒤에 내용이 바뀐 항목. `t` 가 없으면(내보낸 적 없음) 전부.
   * @returns {Promise<Object[]>}
   */
  async function changedSince(t) {
    const all = await list();
    let ms = NaN;
    if (typeof t === 'number') ms = t;
    else if (typeof t === 'string' && t.trim()) ms = /^\d+$/.test(t.trim()) ? Number(t.trim()) : Date.parse(t);
    if (!Number.isFinite(ms)) return all;
    return all.filter((e) => (Number(e.updatedAt) || 0) > ms);
  }

  /**
   * 가져오기 계획(`text/vocab.js` `importPlan`)을 **한 트랜잭션**으로 쓴다.
   * - `add` → `newTermEntry` + id(파일의 `id` 가 있고 기기에 비어 있으면 그것, 아니면 `termIdOf`). 같은 `term`+대상 언어가
   *   그사이 생겼으면 건너뛴다(`skipped`).
   * - `change` → 기존 레코드에 `patch` 의 **내용 필드·term·edited·updatedAt 만** 합친다. `sm2`·`dueAt`·`reviewedAt`·
   *   `introducedAt`·`createdAt`·`id`·`kind`·`docId` 는 **기기 값 그대로**(12-D18).
   * - `[8f-3b — 8f3R-10 #2]` `change[k].base`(계획 때 `baseOf(기기 항목)`)가 있고 지금 레코드의 지문과 다르면 — 미리보기 뒤에 사용자가
   *   그 항목을 고쳤다 — **쓰지 않고 건너뛴다**(`skipped`). `updatedAt` 은 `max(기기, patch)` — 어떤 경우에도 뒤로 가지 않는다.
   *   `skipped` 는 모두 "계획 뒤 그사이 바뀜"이다(그사이 생긴 같은 낱말·지워진 항목·고친 항목) — 화면이 "그사이 바뀜 — 건너뜀 n".
   * @returns {Promise<{added:number, changed:number, skipped:number}>}
   */
  async function applyImport(plan) {
    const p = plan || {};
    const adds = Array.isArray(p.add) ? p.add : [];
    const changes = Array.isArray(p.change) ? p.change : [];
    const at = now();
    const recs = adds.map((a) => newTermEntry(Object.assign({}, a, { origin: 'import' }), at)).filter((r) => r.term && r.targetLang);
    const ids = await Promise.all(recs.map((r) => termIdOf(r.term, r.targetLang)));
    const ALLOWED = new Set(TERM_CONTENT_FIELDS.concat(['term', 'edited', 'updatedAt']));
    return db.withTx(['cards'], 'readwrite', async (tx, s) => {
      const store = s.cards;
      let added = 0;
      let changed = 0;
      let skipped = 0;
      for (let i = 0; i < recs.length; i++) {
        const rec = recs[i];
        const dupe = await new Promise((resolve, reject) => {
          const req = store.index('term').openCursor(rec.term);
          req.onsuccess = () => {
            const c = req.result;
            if (!c) { resolve(false); return; }
            if (c.value && c.value.kind === 'term' && c.value.targetLang === rec.targetLang) { resolve(true); return; }
            c.continue();
          };
          req.onerror = () => reject(req.error);
        });
        if (dupe) { skipped++; continue; }
        // 파일의 id 가 기기에서 비어 있으면 그대로(다른 기기와 같은 id 유지), 아니면 termIdOf, 그것도 쓰였으면 꼬리를 붙인다.
        const fileId = rec.id && rec.id.trim() ? rec.id.trim() : '';
        let id = fileId && !(await rq(store.get(fileId))) ? fileId : ids[i];
        if (id === ids[i] && (await rq(store.get(id)))) id = ids[i] + ':' + at + ':' + i;
        rec.id = id;
        await rq(store.put(rec));
        added++;
      }
      for (let i = 0; i < changes.length; i++) {
        const c = changes[i] || {};
        const cur = await rq(store.get(c.id));
        if (!cur || cur.kind !== 'term') { skipped++; continue; }
        if (typeof c.base === 'string' && baseOf(cur) !== c.base) { skipped++; continue; }   // ★ 그사이 바뀜 — 덮지 않는다
        const next = Object.assign({}, cur);
        const patch = c.patch || {};
        for (const k of Object.keys(patch)) if (ALLOWED.has(k)) next[k] = patch[k];
        if (Object.prototype.hasOwnProperty.call(patch, 'updatedAt')) next.updatedAt = Math.max(Number(cur.updatedAt) || 0, Number(patch.updatedAt) || 0);
        await rq(store.put(next));
        changed++;
      }
      return { added: added, changed: changed, skipped: skipped };
    });
  }

  return {
    findTerm: findTerm,
    save: save,
    update: update,
    remove: remove,
    list: list,
    countByDoc: countByDoc,
    changedSince: changedSince,
    applyImport: applyImport
  };
}

/** 앱 기본 인스턴스(`js/db.js`). */
export const vocabStore = createVocabStore();
