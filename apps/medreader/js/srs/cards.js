/* ============================================================
   MedReader — 기억 카드 서비스 (spec 17-11 4 — 12-1)

   ── 서비스 계층이다(3-2 — `srs/cards.js` 행은 `vocab/*`·`notes/*` 행과 같다) ──
   `config`·`db`·`hash`·`srs/sm2` 만 import 한다. **`ui/`·`ai/`·`tts/` 를 모른다** — 뒷면(번역)을 찾는 일은 화면이
   조회 함수(`lookup`)로 주입한다(메모리 → 캐시 읽기만). **호출 0** — 카드 만들기·복습·뒷면 채우기 모두 기기 안.

   ── 저장 위치 ───────────────────────────────────────────
   `cards` 스토어(DB 3 그대로 — `kind` 인덱스 없음). 문장 카드는 `kind:'sentence'`, 단어장 항목은 8f 의 `kind:'term'`.
   복습 상태(`sm2`·`dueAt`·`reviewedAt`·`introducedAt`)는 두 kind 에 같은 규칙으로 여기서 쓴다. 단어 **내용**은 단어장 화면이 고친다(12-D17).
   문서를 지워도 남는다(`db.keepsOnDocDelete` — 12-D8).

   ── 시각 (12-D9·D10) ─────────────────────────────────────
   전부 **숫자 ms**. `updatedAt` 은 **사람이 고친 내용만**(목록 편집의 뒷면·메모) — 복습은 `reviewedAt`, 멈춤/다시 켬은 `suspendedAt`.
   `[12-3]` 자동 채움(`saveSentence` 의 빈 뒷면·설명 채움 · `fillBack`)도 `updatedAt` 을 올리지 않는다 — 올리면 "고친 카드"가 되어
   9c 병합(`text/backup.js` `mergeSentence` — 안 고친 카드는 고친 카드를 이기지 못함)에서 다른 기기의 **손으로 쓴** 뒷면을 덮는다.
   그래야 8f "마지막 내보내기 뒤 바뀐 항목"이 복습으로 늘지 않고, 9c 병합이 내용·복습·멈춤을 따로 늦은 쪽으로 고른다.
   8f 옛 값(ISO 문자열 `dueAt`·`createdAt`)은 읽을 때 `dueMsOf`·`timeMs` 로 숫자로 바꿔 본다.

   ── 하루 기록 `settings['srs.log']` ─────────────────────
   `{'YYYY-MM-DD'(지역 날짜): {n, ms, new}}` · 60일. `review` 가 카드와 **같은 트랜잭션**에서 DB 에 직접 쓴다 — 그래서
   `settings.js` 메모리 맵의 값은 옛것이다. 읽을 때는 `readLog()`.
   ============================================================ */

import * as realDb from '../db.js';
import { hashHex, normalizeForHash } from '../hash.js';
import { SRS } from '../config.js';
import { next as sm2Next, isDue, isNew, startSm2 } from './sm2.js';

export const KIND = 'sentence';
export const LOG_KEY = 'srs.log';
/** 사용자가 고치는 문장 카드 내용(목록 편집 — 12-3). 바뀌면 `updatedAt`. */
const CONTENT_EDITABLE = Object.freeze(['back', 'note']);

function rq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function str(v) { return typeof v === 'string' ? v : v == null ? '' : String(v); }
function textOf(v) { return str(v).trim(); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

/** 시각 값 → ms(숫자 그대로 · ISO·숫자 글자 → 숫자). 못 읽으면 NaN. */
export function timeMs(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string' && v.trim()) {
    const t = v.trim();
    return /^\d+$/.test(t) ? Number(t) : Date.parse(t);
  }
  return NaN;
}

/** 카드의 다음 복습 시각(ms) — 8f 옛 ISO 문자열도 숫자로(12-D10). 못 읽으면 NaN(→ `isDue` 는 오늘 복습으로 본다). */
export function dueMsOf(card) {
  return timeMs(card && card.dueAt);
}

/** 그 시각이 속한 날(지역 시간)의 키 `YYYY-MM-DD`. */
export function dayKeyOf(ms) {
  const d = new Date(Number(ms) || 0);
  const z = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}

/** 그 시각이 속한 날(지역 시간)의 0시 ms. */
export function dayStartOf(ms) {
  const d = new Date(Number(ms) || 0);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 하루 기록에서 오늘 포함 `SRS.LOG_DAYS` 날보다 오래된 날을 뺀 사본. */
export function trimLog(log, dayStartMs) {
  const src = log && typeof log === 'object' && !Array.isArray(log) ? log : {};
  const cut = dayKeyOf(dayStartMs - (SRS.LOG_DAYS - 1) * SRS.DAY_MS + SRS.DAY_MS / 2);
  const out = {};
  for (const k of Object.keys(src)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && k >= cut) out[k] = src[k];
  return out;
}

/**
 * 번역이 빈 단어 카드인가 — 복습 줄에서 빼는 카드(12-D15 · `queue` 의 `counts.noTr`). 순수.
 * `[15-2b]` 15 묶음 "복습할 n"(`ui/review.js` `cardsInRange`)이 같은 판정을 쓴다 — 12-3 범위 화면과 같은 수(15-2R #2).
 */
export function isNoTrTerm(c) {
  return !!c && c.kind === 'term' && !textOf(c.translation);
}

/** 하루 새 카드 수(설정 값) → 0–100 정수, 못 읽으면 기본(`[12-1b]` null·빈 글자도 — `Number(null)` 은 0 이라 따로 본다). */
export function clampNewPerDay(v) {
  if (v == null || (typeof v === 'string' && !v.trim())) return SRS.NEW_PER_DAY;
  const n = Number(v);
  if (!Number.isFinite(n)) return SRS.NEW_PER_DAY;
  return Math.max(0, Math.min(SRS.NEW_PER_DAY_MAX, Math.floor(n)));
}

/**
 * `[12-1b]` 문장 카드 id 의 "책" 칸 — 문서 `fileHash` 에서 쪽수 변형 꼬리(`:n쪽수` — 서재 가져오기가 표본 해시가 겹친 다른 PDF 와
 * 가르려고 붙임)를 뗀 바탕 해시. 같은 PDF 면 기기·다시 가져오기와 무관하게 같은 값이다(문서 id 는 기기마다·가져올 때마다 새 uuid).
 * `fileHash` 가 없는 문서(옛·특이)면 문서 id 로 물러선다 — 그런 문서는 9c 가 `fileHash` 로 맞출 수도 없으니(`remapRecord` 0) 잃는 것이 없다.
 * @param {string} fileHash
 * @param {string} docId
 * @returns {string}
 */
export function sentenceDocKey(fileHash, docId) {
  const base = str(fileHash).replace(/:n\d+$/, '');
  return base || str(docId);
}

/**
 * 문장 카드 id(12-D7 · `[12-1b]`) — `'sc:' + hashHex(대상 언어 + U+0001 + 책 칸 + U+0001 + normalizeForHash(앞면))`.
 * 책 칸 = `sentenceDocKey(문서 fileHash, docId)`(문서 id 가 아니다 — 두 기기가 같은 PDF 를 따로 가져와도 같은 id).
 * 같은 책·같은 문장·같은 대상 언어면 같은 id(중복 0 · 9c 두 기기 병합). U+0001 은 `normalizeForHash` 가 공백으로 접지 않는다.
 * 화면은 문서 레코드를 들고 있으면 `sentenceIdOf(tl, sentenceDocKey(doc.fileHash, doc.id), front)`, 아니면 `cardStore.idFor(…)`.
 */
export async function sentenceIdOf(targetLang, docKey, front) {
  return SRS.ID_PREFIX + (await hashHex(str(targetLang) + '\u0001' + str(docKey) + '\u0001' + normalizeForHash(str(front))));
}

/** 입력 → 새 문장 카드(id 는 `saveSentence` 가). */
function newSentenceCard(i, at) {
  return {
    kind: KIND,
    front: textOf(i.front),
    back: textOf(i.back),
    explain: textOf(i.explain),
    srcLang: str(i.srcLang),
    targetLang: str(i.targetLang),
    docId: str(i.docId),
    docTitle: str(i.docTitle),
    pageNo: num(i.pageNo),
    lineId: i.lineId == null ? null : str(i.lineId),
    paraId: i.paraId == null ? null : str(i.paraId),
    origin: SRS.ORIGINS.indexOf(i.origin) >= 0 ? i.origin : null,
    domain: str(i.domain),
    note: '',
    createdAt: at,
    updatedAt: at,
    reviewedAt: null,
    introducedAt: null,
    sm2: startSm2(),
    dueAt: at,
    suspended: false
  };
}

/**
 * 저장소 하나. 앱은 `cardStore`(기본 인스턴스)를 쓰고, 테스트는 `db`·`now` 를 주입한다.
 * @param {{db?:Object, now?:()=>number}} [deps] `db` 는 `js/db.js` 와 같은 모양(`withTx`·`iterate`·`get`·`patch`)
 */
export function createCardStore(deps) {
  const d = deps || {};
  const db = d.db || realDb;
  const now = typeof d.now === 'function' ? d.now : () => Date.now();

  /** `[12-1b]` 그 문서의 id 책 칸 — 문서 레코드의 `fileHash` 바탕(없으면 docId). 해시는 트랜잭션 밖에서 계산해야 하므로 따로 읽는다. */
  async function docKeyFor(docId) {
    const doc = await db.get('documents', docId);
    return sentenceDocKey(doc && doc.fileHash, docId);
  }

  /**
   * `[12-1b]` 이 문장의 카드 id(화면이 `[★]` 상태를 `get(id)` 로 볼 때 — 문서 레코드를 읽어 책 칸을 맞춘다).
   * @param {{front:string, targetLang:string, docId:string}} input
   * @returns {Promise<string|null>} 앞면·대상 언어·문서가 비면 null
   */
  async function idFor(input) {
    const i = input || {};
    const front = textOf(i.front);
    const tl = str(i.targetLang);
    const docId = str(i.docId);
    if (!normalizeForHash(front) || !tl || !docId) return null;
    return sentenceIdOf(tl, await docKeyFor(docId), front);
  }

  /**
   * 지금 문장을 카드로. 같은 id 가 있으면 새로 만들지 않고, 기존 카드의 `back`(또는 `explain`)이 비었고 입력에 있으면 **채운다**
   * (`[12-3]` `updatedAt` 은 그대로 — 자동 채움은 사람의 내용 수정이 아니다). 찾기와 쓰기는 한 트랜잭션(두 번 눌러도 한 장).
   * `[12-1b]` id 는 문서 `fileHash` 바탕으로 만든다(`sentenceDocKey`) — 같은 PDF 를 지우고 다시 가져온 문서(새 docId)에서 같은 문장을
   * 저장하면 옛 카드를 만난다: 그 카드의 `docId`·`docTitle` 을 **지금 문서로 고친다**(그래야 "이 책 복습"·`keptCount` 에 다시 잡힘).
   * 내용·복습 상태·`updatedAt` 은 그대로(문서 옮김은 사용자 내용 수정이 아니다 — 9c 는 `docId` 를 `remapRecord` 로 맞춘다).
   * @param {{front:string, back?:string, explain?:string, srcLang?:string, targetLang:string, docId:string, docTitle?:string,
   *          pageNo?:number, lineId?:string, paraId?:string, origin?:string, domain?:string}} input
   * @returns {Promise<{card:Object|null, created:boolean}>} 앞면·대상 언어·문서가 비면 `{card:null, created:false}`
   */
  async function saveSentence(input) {
    const i = input || {};
    const at = now();
    const rec = newSentenceCard(i, at);
    if (!normalizeForHash(rec.front) || !rec.targetLang || !rec.docId) return { card: null, created: false };
    const id = await sentenceIdOf(rec.targetLang, await docKeyFor(rec.docId), rec.front);
    return db.withTx(['cards'], 'readwrite', async (tx, s) => {
      const cur = await rq(s.cards.get(id));
      if (cur) {
        const fill = {};
        if (cur.kind === KIND && !textOf(cur.back) && rec.back) fill.back = rec.back;
        if (cur.kind === KIND && !textOf(cur.explain) && rec.explain) fill.explain = rec.explain;
        if (cur.kind === KIND && cur.docId !== rec.docId) {
          fill.docId = rec.docId;
          if (rec.docTitle && rec.docTitle !== cur.docTitle) fill.docTitle = rec.docTitle;
        }
        if (!Object.keys(fill).length) return { card: cur, created: false };
        const nextRec = Object.assign({}, cur, fill);   // `[12-3]` 채움·문서 옮김 모두 updatedAt 그대로
        await rq(s.cards.put(nextRec));
        return { card: nextRec, created: false };
      }
      rec.id = id;
      await rq(s.cards.put(rec));
      return { card: rec, created: true };
    });
  }

  /** 아무 카드나 하나(문장·단어). 없으면 null. */
  async function get(id) {
    const v = await db.get('cards', id);
    return v === undefined ? null : v;
  }

  /**
   * 아직 복습하지 않은 문장 카드만 지운다(띠 [★] 다시 누름 — 잘못 누름 되돌리기, 12-D5). 한 트랜잭션.
   * @returns {Promise<boolean>} 지웠으면 true(복습한 카드·단어·없음 → false)
   */
  async function removeIfFresh(id) {
    return db.withTx(['cards'], 'readwrite', async (tx, s) => {
      const cur = await rq(s.cards.get(id));
      if (!cur || cur.kind !== KIND || cur.reviewedAt) return false;
      await rq(s.cards.delete(id));
      return true;
    });
  }

  /** 문장 카드 지우기(목록 [삭제]). 단어는 단어장이 지운다. @returns {Promise<boolean>} */
  async function remove(id) {
    return db.withTx(['cards'], 'readwrite', async (tx, s) => {
      const cur = await rq(s.cards.get(id));
      if (!cur || cur.kind !== KIND) return false;
      await rq(s.cards.delete(id));
      return true;
    });
  }

  /**
   * 사용자 수정. 문장 카드: `back`·`note`(내용 — 바뀌면 `updatedAt`) · `suspended`(멈춤 — 바뀌면 `suspendedAt`, `updatedAt` 은 그대로).
   * 단어 카드: `suspended` 만(내용은 단어장 편집 — 12-D17). 바뀐 것이 없으면 쓰지 않는다.
   * @returns {Promise<Object|null>} 고친(또는 그대로인) 레코드, 없거나 kind 가 다르면 null
   */
  async function update(id, patch) {
    const p = patch || {};
    const at = now();
    const r = await db.patch('cards', id, (cur) => {
      if (!cur || (cur.kind !== KIND && cur.kind !== 'term')) return null;
      const out = {};
      if (cur.kind === KIND) {
        for (const k of CONTENT_EDITABLE) {
          if (!Object.prototype.hasOwnProperty.call(p, k)) continue;
          const v = textOf(p[k]);
          if (v !== textOf(cur[k])) out[k] = v;
        }
        if (Object.keys(out).length) out.updatedAt = Math.max(at, Number(cur.updatedAt) || 0);
      }
      if (typeof p.suspended === 'boolean' && p.suspended !== !!cur.suspended) {
        out.suspended = p.suspended;
        out.suspendedAt = at;
      }
      return Object.keys(out).length ? out : null;
    });
    if (!r.rec || (r.rec.kind !== KIND && r.rec.kind !== 'term')) return null;
    return r.rec;
  }

  /**
   * 목록 — 전체 훑기(또는 `docId` 인덱스) 후 거름(`kind` 인덱스 없음 — 12-D10). `createdAt` 오름차순.
   * `[12-3]` `docId` 를 주면 **"이 책" 묶음**: `docId` 필드가 같은 카드 + **지워진 문서**(문서 레코드 없음)의 문장 카드 중 id 의 책 칸이
   * 이 문서의 책 칸(`sentenceDocKey(fileHash)`)과 같은 것 — 같은 PDF 를 지우고 다시 가져온 책에서 "다시 저장한 문장만" 새 문서로
   * 옮겨 가던 틈(12-1bR 정보-3). 지워진 문서 하나의 카드는 모두 같은 책 칸이므로 그 문서의 카드 한 장으로 재 본다(해시는 문서마다 1번).
   * 살아 있는 다른 문서의 카드는 가져오지 않는다(표본 해시가 겹친 다른 PDF — 변형 키 — 를 섞지 않는다). 레코드는 고치지 않는다(읽기만).
   * @param {{kind?:'sentence'|'term', docId?:string}} [q]
   * @returns {Promise<Object[]>}
   */
  async function list(q) {
    const o = q || {};
    const docId = o.docId != null && o.docId !== '' ? String(o.docId) : null;
    const kinds = o.kind ? [o.kind] : [KIND, 'term'];
    const out = [];
    const key = docId && kinds.indexOf(KIND) >= 0 ? await docKeyFor(docId) : null;
    if (key && key !== docId) {
      // 이 문서에 fileHash 가 있다 — 지워진 같은 PDF 의 카드를 찾으려면 전체를 훑는다
      const orphans = new Map();
      await db.iterate('cards', {}, (v) => {
        if (!v || kinds.indexOf(v.kind) < 0) return true;
        if (String(v.docId) === docId) out.push(v);
        else if (v.kind === KIND && typeof v.id === 'string' && v.id.indexOf(SRS.ID_PREFIX) === 0) {
          const k = String(v.docId);
          if (!orphans.has(k)) orphans.set(k, []);
          orphans.get(k).push(v);
        }
        return true;
      });
      if (orphans.size) {
        const live = new Set((await db.keysOf('documents')).map(String));
        for (const [k, group] of orphans) {
          if (live.has(k)) continue;
          const c = group[0];
          if ((await sentenceIdOf(c.targetLang, key, c.front)) === c.id) for (const g of group) out.push(g);
        }
      }
    } else {
      await db.iterate('cards', docId ? { index: 'docId', query: docId } : {}, (v) => {
        if (v && kinds.indexOf(v.kind) >= 0) out.push(v);
        return true;
      });
    }
    out.sort((a, b) => (timeMs(a.createdAt) || 0) - (timeMs(b.createdAt) || 0));
    return out;
  }

  /** 하루 기록(`srs.log`) — DB 에서 바로 읽는다. 없으면 `{}`. */
  async function readLog() {
    const row = await db.get('settings', LOG_KEY);
    const v = row && row.value;
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  }

  /**
   * 오늘 복습 줄.
   *   due   — 이미 매긴 카드 중 오늘 복습할 것(`dueAt` 오름차순)
   *   fresh — 새 카드(`createdAt` 오름차순), `newPerDay − log[오늘].new` 장까지
   *   뺌    — 멈춘 카드 · 번역 빈 단어(`counts.noTr`, 12-D15). 뒷면 빈 문장 카드는 넣고 `counts.noBack` 에 센다.
   * @param {{nowMs?:number, dayStartMs?:number, dayEndMs?:number, newPerDay?:number, kinds?:string[], docId?:string}} [opts]
   * @returns {Promise<{due:Object[], fresh:Object[], counts:{due:number, fresh:number, noBack:number, noTr:number}}>}
   */
  async function queue(opts) {
    const o = opts || {};
    const nowMs = Number.isFinite(o.nowMs) ? o.nowMs : now();
    const dayStartMs = Number.isFinite(o.dayStartMs) ? o.dayStartMs : dayStartOf(nowMs);
    const dayEndMs = Number.isFinite(o.dayEndMs) ? o.dayEndMs : dayStartMs + SRS.DAY_MS;
    const kinds = Array.isArray(o.kinds) && o.kinds.length ? o.kinds : [KIND, 'term'];
    const all = await list({ docId: o.docId });
    const log = await readLog();
    const today = log[dayKeyOf(dayStartMs)];
    const doneNew = today && Number.isFinite(Number(today.new)) ? Math.max(0, Number(today.new)) : 0;
    const room = Math.max(0, clampNewPerDay(o.newPerDay === undefined ? SRS.NEW_PER_DAY : o.newPerDay) - doneNew);
    const due = [];
    const freshAll = [];
    let noTr = 0;
    for (const c of all) {
      if (kinds.indexOf(c.kind) < 0 || c.suspended) continue;
      if (isNoTrTerm(c)) { noTr++; continue; }
      if (isNew(c)) freshAll.push(c);
      else if (isDue(Object.assign({}, c, { dueAt: dueMsOf(c) }), dayEndMs)) due.push(c);
    }
    const dueKey = (c) => { const t = dueMsOf(c); return Number.isFinite(t) ? t : -Infinity; };
    due.sort((a, b) => dueKey(a) - dueKey(b) || (timeMs(a.createdAt) || 0) - (timeMs(b.createdAt) || 0));
    const fresh = freshAll.slice(0, room);   // `list` 가 이미 createdAt 오름차순
    const noBack = due.concat(fresh).filter((c) => c.kind === KIND && !textOf(c.back)).length;
    return { due: due, fresh: fresh, counts: { due: due.length, fresh: fresh.length, noBack: noBack, noTr: noTr } };
  }

  /**
   * 한 장 매기기 — **한 트랜잭션**(`cards`+`settings`)에서 읽고 `sm2`·`dueAt`·`reviewedAt`·(처음이면)`introducedAt` 만 바꿔 쓴다.
   * `updatedAt`·내용은 그대로(12-D9). 하루 기록 `srs.log[오늘]` 에 `{n+1, ms+…(상한 60초), new+(새 카드였으면 1)}`, 60일만 남김.
   * @param {string} id
   * @param {'again'|'hard'|'good'|'easy'} grade
   * @param {{nowMs?:number, dayStartMs?:number, ms?:number}} [opts]
   * @returns {Promise<Object|null>} 매긴 카드(없거나 모르는 단추·kind 면 null)
   */
  async function review(id, grade, opts) {
    if (SRS.GRADES.indexOf(grade) < 0) return null;
    const o = opts || {};
    const nowMs = Number.isFinite(o.nowMs) ? o.nowMs : now();
    const dayStartMs = Number.isFinite(o.dayStartMs) ? o.dayStartMs : dayStartOf(nowMs);
    const spent = Math.max(0, Math.min(SRS.MAX_REVIEW_MS, Number(o.ms) || 0));
    return db.withTx(['cards', 'settings'], 'readwrite', async (tx, s) => {
      const cur = await rq(s.cards.get(id));
      if (!cur || (cur.kind !== KIND && cur.kind !== 'term')) return null;
      const wasNew = isNew(cur);
      const r = sm2Next(cur.sm2, grade, { nowMs: nowMs, dayStartMs: dayStartMs });
      const nextRec = Object.assign({}, cur, {
        sm2: r.sm2,
        dueAt: r.dueAt,
        reviewedAt: nowMs,
        introducedAt: cur.introducedAt == null ? nowMs : cur.introducedAt
      });
      await rq(s.cards.put(nextRec));
      const row = await rq(s.settings.get(LOG_KEY));
      const log = trimLog(row && row.value, dayStartMs);
      const key = dayKeyOf(dayStartMs);
      const day = log[key] && typeof log[key] === 'object' ? log[key] : {};
      log[key] = { n: (Number(day.n) || 0) + 1, ms: (Number(day.ms) || 0) + spent, new: (Number(day.new) || 0) + (wasNew ? 1 : 0) };
      await rq(s.settings.put({ key: LOG_KEY, value: log }));
      return nextRec;
    });
  }

  /**
   * 뒷면이 빈 문장 카드를 **주입된 조회**로 채운다(호출 0 — 조회는 메모리·캐시 읽기만, 화면이 넘긴다).
   * `lookup(front, docId, targetLang)` → 번역 글자(없으면 빈 값). 찾으면 그사이 다른 쪽이 채우지 않았을 때만 저장.
   * `[12-3]` `updatedAt` 은 올리지 않는다(자동 채움 — 사람의 내용 수정이 아니다. 위 머리말 "시각").
   * @returns {Promise<Object>} 채운(또는 그대로인) 카드
   */
  async function fillBack(card, lookup) {
    if (!card || card.kind !== KIND || textOf(card.back) || typeof lookup !== 'function') return card;
    let tr;
    try { tr = await lookup(card.front, card.docId, card.targetLang); } catch (e) { return card; }
    const back = textOf(tr);
    if (!back) return card;
    const r = await db.patch('cards', card.id, (cur) => (cur && cur.kind === KIND && !textOf(cur.back) ? { back: back } : null));
    return r.rec || card;
  }

  /** 그 문서의 기억 카드(문장) 수 — 문서를 지워도 남는다(서재 삭제 확인 "기억 카드 m" — 12-2). `[12-3]` "이 책" 묶음(`list`). */
  async function keptCount(docId) {
    return (await list({ kind: KIND, docId: docId })).length;
  }

  return {
    saveSentence: saveSentence,
    idFor: idFor,
    get: get,
    remove: remove,
    removeIfFresh: removeIfFresh,
    update: update,
    list: list,
    queue: queue,
    review: review,
    fillBack: fillBack,
    keptCount: keptCount,
    readLog: readLog
  };
}

/** 앱 기본 인스턴스(`js/db.js`). */
export const cardStore = createCardStore();
