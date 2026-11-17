/* ============================================================
   MedReader — 단어장 화면 (spec 17-7-3 "화면" · 17-7-4 · 17-7-6 4-6 — 8f-3)

   ── 이 파일이 하는 일 ───────────────────────────────────
   `#/vocab`(전체) · `#/vocab/:docId`(그 책). 목록(책 고르기·찾기·정렬) · 편집(원어 오타·번역·짧은 뜻·품사·메모, 문맥 문장
   읽기 · [▶] · [원문 쪽으로 가기]) · 삭제(페이지 안 확인) · 내보내기(CSV 엑셀 · Anki) · 가져오기(CSV — 미리보기 뒤 적용).

   ── 지키는 것 ──────────────────────────────────────────
   ★ 호출(6절): 목록·찾기·편집·삭제·내보내기·가져오기·[▶] 는 **0**. [번역 안 된 것 모두 번역 (n)] 만 누를 때 **1호출**
     (≤ `VOCAB.BATCH_MAX` 20개·≤ `ai.maxReqChars`, 같은 대상 언어·같은 책 묶음 — 나머지는 다음 누름). 늘 `retry:true`
     (crossstep "8f-1 Review" ③ — 한 번 실패한 단어를 다시 누르면 다시 보낸다). 파이프라인은 단어 시트가 받은 **같은 것**
     (`wordsheet.termServices()` — 상태 기계·상한·사용량 한 벌). 보내는 것은 낱말·문장(교과서 원문)뿐 — 번역·메모는 넣지 않는다(13절).
   ★ 가져오기는 **미리보기 먼저**(새·바뀜·그대로·충돌·거절과 사유). [가져오기]를 눌러야 `applyImport`(한 트랜잭션).
     파일 `updated` 를 못 읽는 행(스프레드시트가 날짜를 바꿈)은 **충돌** — 고르기 전에는 기기 값 그대로(crossstep ①).
   ★ 내보내기: UTF-8 BOM·CRLF·RFC 4180·수식 접두(`text/vocab.js` `buildCsv`) · 파일 `medreader-vocab-YYYYMMDD.csv|.txt` ·
     `Blob` + `<a download>` + `revokeObjectURL` · 내보내면 `vocab.lastExportAt`. 파일에 교과서 문장이 든다는 한 줄(8cf-Q2 기본값).
   ★ 모든 글자 `textContent`/`appendBidiText` — `innerHTML` 0. 원어 칸 `dir=ltr`, 번역 칸은 대상 언어 방향, 표 방향은 UI.
   ★ 1절(순수)·2절(흐름 — DOM 없음)은 `tests/vocab-ui-8f.test.mjs` 가 잰다. 3절이 화면.
   ★ `[8f-3b — 8f-3 Review 고침 · 원칙: 기기 데이터를 조용히 덮거나 지우지 않는다]` ① 삭제 확인 대화의 리스너는 `initVocab` 에서 한 벌,
     대상 id 는 열 때 고정하고 **어떤 닫힘**(단추·Esc·`leaveVocab`)에도 `close` 이벤트가 지운다 ② 가져오기 적용은 계획 때 지문과 기기
     레코드를 다시 대 보고 달라진 항목은 건너뛴다("그사이 바뀜 — 건너뜀 n") ③ 파일은 **바이트**로 받아 `TextDecoder('utf-8', {fatal})`
     (UTF-16 BOM·잘못된 UTF-8 → 거절 "UTF-8 CSV 로 다시 저장"), 깨진 글자 줄은 거절, 미리보기에 바뀔 항목의 기기 값 → 파일 값
     ④ bulk 응답은 요청 때와 지문이 같은 항목에만 쓴다 ⑥ 모르는 열·깨진 따옴표 줄을 미리보기에 보인다(`tests/vocab-8f3b.test.mjs`).
   ============================================================ */

import { t, applyTranslations, onLangChange, dirOf, formatNumber } from '../i18n/index.js';
import * as db from '../db.js';
import * as settings from '../settings.js';
import { VOCAB } from '../config.js';
import { go, replace, vocabHash, readerHash, cardsHash } from '../router.js';
import { buildCsv, buildAnki, parseCsv, importPlan, planToApply, fieldValue, normalizeTerm, baseOf, TERM_CONTENT_FIELDS } from '../text/vocab.js';
import { docLangOf } from '../text/lang.js';
import { domainOf } from '../ai/prompts.js';
import { vocabStore } from '../vocab/store.js';
import { appendBidiText } from './bididom.js';
import { GATE_KEYS, BLOCKED_KEYS, TAP_BANNER_NOW, noticeBanner } from './trband.js';
import { termServices } from './wordsheet.js';
import { onPageRender, revealLine } from './reader.js';
// `[12-3 — spec 17-11 6]` 머리 [복습 (n)] — 오늘 복습할 단어 카드 수(`queue` — 읽기만) · 누르면 기억 카드 화면을 [단어] 칩으로.
import { cardStore, clampNewPerDay } from '../srs/cards.js';
import { presetCardsChip } from './cards.js';
import { resolveSpeech, speechPref } from '../tts/voices.js';
import { trSpeechText } from '../tts/text.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분
   ──────────────────────────────────────────────────────── */

/** 한 번에 그리는 줄 수(넘으면 [더 보기]) — 가져오기 상한 5,000줄을 한꺼번에 DOM 에 두지 않는다. */
export const VOCAB_PAGE = 200;

/** 정렬 — 추가일(새것 먼저) · 알파벳(원어). */
export const SORTS = Object.freeze(['added', 'alpha']);

/** 편집 화면이 고치는 내용 필드(문맥·문맥 번역·기본형은 읽기만 — 17-7-3). */
export const EDIT_FIELDS = Object.freeze(['surface', 'translation', 'gloss', 'pos', 'note']);

function fold(s) { return String(s == null ? '' : s).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim(); }

/** 그 책의 항목(`docId` 가 없으면 전체). */
export function scopeEntries(all, docId) {
  const list = Array.isArray(all) ? all.filter((e) => e && e.kind === 'term') : [];
  if (docId == null || docId === '') return list;
  return list.filter((e) => String(e.docId) === String(docId));
}

/**
 * 목록 줄 — 찾기(원어·번역 모두, NFKC·소문자 부분 일치 — 로컬 거르기) · 정렬(추가일 새것 먼저 / 원어 알파벳). 순수 함수.
 * @param {Object[]} entries
 * @param {{query?:string, sort?:'added'|'alpha'}} [o]
 */
export function viewRows(entries, o) {
  const x = o || {};
  const q = fold(x.query);
  let rows = (Array.isArray(entries) ? entries : []).slice();
  if (q) rows = rows.filter((e) => fold(e.term).includes(q) || fold(e.surface).includes(q) || fold(e.translation).includes(q));
  if (x.sort === 'alpha') {
    rows.sort((a, b) => String(a.term || '').localeCompare(String(b.term || '')) || (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
  } else {
    rows.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0) || String(a.term || '').localeCompare(String(b.term || '')));
  }
  return rows;
}

/** 문서 id → 문서 레코드. */
function docMap(docs) {
  if (docs instanceof Map) return docs;
  const m = new Map();
  for (const d of Array.isArray(docs) ? docs : []) if (d && d.id != null) m.set(String(d.id), d);
  return m;
}

/**
 * [번역 안 된 것 모두 번역] 대상인가 — 번역이 비었고, 원문 언어(항목 → 없으면 그 책)가 있고 대상 언어와 다르다.
 * @returns {string} 원문 언어(대상이면) 또는 ''
 */
export function bulkSrc(e, docs) {
  if (!e || e.kind !== 'term' || !e.term || !e.targetLang) return '';
  if (fieldValue('translation', e.translation)) return '';
  const doc = e.docId != null ? docMap(docs).get(String(e.docId)) : null;
  const src = e.srcLang || (doc ? docLangOf(doc) : '');
  return src && src !== e.targetLang ? src : '';
}

/** 단추의 (n) — 이 범위에서 번역이 빈 항목 수(대상 아닌 것은 세지 않는다 — 눌러도 줄지 않는 수를 보이지 않게). */
export function bulkCount(entries, docs) {
  const m = docMap(docs);
  return (Array.isArray(entries) ? entries : []).filter((e) => !!bulkSrc(e, m)).length;
}

/**
 * 한 번 누름의 묶음 — **1호출**. 번역이 빈 항목을 추가한 순서로, 첫 항목과 **같은 대상 언어·같은 책**만 최대 `VOCAB.BATCH_MAX` 개
 * (term 캐시 키에 책 id 가 든다 — 단어 시트와 같은 키라 한쪽이 받은 것은 다른 쪽에서 0호출). 글자 상한은 파이프라인이 자른다(`MORE`).
 * 항목은 낱말·본문 꼴·문맥·원문 언어뿐(번역·메모 없음 — 13절). 순수 함수.
 * @returns {?{target:string, docId:string, src:string, domain:string, items:Object[], ids:string[]}}
 */
export function bulkPlan(entries, docs) {
  const m = docMap(docs);
  const cand = (Array.isArray(entries) ? entries : []).filter((e) => !!bulkSrc(e, m))
    .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
  if (!cand.length) return null;
  const first = cand[0];
  const docKey = (e) => (e.docId == null ? '' : String(e.docId));
  const pick = cand.filter((e) => e.targetLang === first.targetLang && docKey(e) === docKey(first)).slice(0, VOCAB.BATCH_MAX);
  const doc = m.get(docKey(first)) || null;
  return {
    target: first.targetLang,
    docId: docKey(first),
    src: bulkSrc(first, m),
    domain: domainOf(doc),
    items: pick.map((e) => ({ term: e.term, surface: e.surface || e.term, context: e.context || '', src: bulkSrc(e, m) })),
    ids: pick.map((e) => String(e.id)),
    // `[8f-3b]` 요청 때 지문 — 응답이 오기 전에 사용자가 그 항목을 고쳤으면 쓰지 않는다(`update` 의 `ifBase`)
    bases: pick.map((e) => baseOf(e))
  };
}

/** "마지막 내보내기 뒤 바뀐 항목 n개" — `updatedAt` > `vocab.lastExportAt`(ms·ISO). 내보낸 적 없으면 `null`. */
export function changedCount(entries, lastExportAt) {
  let ms = NaN;
  if (typeof lastExportAt === 'number') ms = lastExportAt;
  else if (typeof lastExportAt === 'string' && lastExportAt.trim()) ms = /^\d+$/.test(lastExportAt.trim()) ? Number(lastExportAt) : Date.parse(lastExportAt);
  if (!Number.isFinite(ms)) return null;
  return (Array.isArray(entries) ? entries : []).filter((e) => (Number(e.updatedAt) || 0) > ms).length;
}

/** 파일 이름 `medreader-vocab-YYYYMMDD.csv|.txt`(기기 날짜). */
export function exportName(kind, nowMs) {
  const d = new Date(Number(nowMs) || 0);
  const p = (n) => String(n).padStart(2, '0');
  return 'medreader-vocab-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + (kind === 'anki' ? '.txt' : '.csv');
}

/**
 * 내보낼 파일 한 벌 — CSV(엑셀 — BOM·CRLF·수식 접두) 또는 Anki(탭 구분 머리 줄). 순수 함수(쓰지 않는다).
 * @returns {{name:string, mime:string, text:string}}
 */
export function exportFile(kind, entries, nowMs) {
  const list = Array.isArray(entries) ? entries : [];
  if (kind === 'anki') return { name: exportName('anki', nowMs), mime: 'text/plain;charset=utf-8', text: buildAnki(list) };
  return { name: exportName('csv', nowMs), mime: 'text/csv;charset=utf-8', text: buildCsv(list) };
}

/** 미리보기 숫자 — 새·바뀜·그대로·충돌·거절. */
export function importCounts(plan) {
  const p = plan || {};
  const n = (k) => (Array.isArray(p[k]) ? p[k].length : 0);
  return { add: n('add'), change: n('change'), same: n('same'), conflict: n('conflict'), reject: n('reject') };
}

/** 거절 사유 순서 — `[8f-3b]` 깨진 글자(`encoding`)·깨진 따옴표(`quote`)를 더함. */
export const REJECT_REASONS = Object.freeze(['term', 'target', 'dup', 'encoding', 'quote']);

/** 거절 사유별 줄 번호(파일의 줄 — 머리 줄이 1, 첫 데이터가 2). 사유 순서 고정. */
export function rejectSummary(plan) {
  const out = [];
  for (const reason of REJECT_REASONS) {
    const rows = ((plan && plan.reject) || []).filter((r) => r.reason === reason).map((r) => r.row + 2);
    if (rows.length) out.push({ reason: reason, rows: rows });
  }
  return out;
}

/** 줄 번호 목록 → "2, 5, 9 …"(앞 10개). */
export function rowList(rows) {
  const a = (Array.isArray(rows) ? rows : []).slice(0, 10).join(', ');
  return rows && rows.length > 10 ? a + ' …' : a;
}

/**
 * `[8f-3b — 8f3R-10 #3]` 파일 바이트 → 글. **UTF-8 만** 받는다 — `TextDecoder('utf-8', {fatal:true})`(BOM 은 뗀다).
 * UTF-16 BOM(`FF FE`·`FE FF`)이나 잘못된 UTF-8(엑셀 "CSV(쉼표로 분리)" = ANSI cp1256·cp949 …)이면 `{ok:false, reason:'encoding'}`
 * — 예전 `File.text()` 는 늘 UTF-8 로 읽어 아랍어가 `U+FFFD` 로 바뀐 채 "바뀜"이 되었다. 글이면 그대로 돌려준다(시험·탐침).
 * @param {ArrayBuffer|Uint8Array|string} input
 * @returns {{ok:true, text:string}|{ok:false, reason:'encoding'}}
 */
export function decodeCsvBytes(input) {
  if (typeof input === 'string') return { ok: true, text: input };
  let bytes = null;
  if (input instanceof Uint8Array) bytes = input;
  else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
  else if (input && ArrayBuffer.isView(input)) bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (!bytes) return { ok: false, reason: 'encoding' };
  if (bytes.length >= 2 && ((bytes[0] === 0xFF && bytes[1] === 0xFE) || (bytes[0] === 0xFE && bytes[1] === 0xFF))) return { ok: false, reason: 'encoding' };
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch (e) {
    return { ok: false, reason: 'encoding' };
  }
}

/** `[8f-3b — 8f3R-10 #6(a)]` 머리 줄의 모르는 열(무시된다) — 일부만 번역한 머리 줄(`메모`·`수정일`)을 미리보기가 알린다. */
export function unknownColumns(columns) {
  const out = [];
  for (const c of Array.isArray(columns) ? columns : []) {
    const k = String(c == null ? '' : c).trim();
    if (k && VOCAB.CSV_COLUMNS.indexOf(k) < 0 && out.indexOf(k) < 0) out.push(k);
  }
  return out;
}

/**
 * 편집 칸 → patch(바뀐 내용 필드만, `fieldValue` 로 정규화 — 저장소·CSV 와 같은 규칙). 원어를 비우면 `{error:'term'}`.
 * @param {Object} entry
 * @param {{surface?:string, translation?:string, gloss?:string, pos?:string, note?:string}} form
 * @returns {{patch:Object}|{error:'term'}}
 */
export function editPatch(entry, form) {
  const e = entry || {};
  const f = form || {};
  const patch = {};
  for (const k of EDIT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(f, k)) continue;
    const v = fieldValue(k, f[k]);
    if (v !== fieldValue(k, e[k])) patch[k] = v;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'surface') && !normalizeTerm(patch.surface)) return { error: 'term' };
  return { patch: patch };
}

/**
 * 책 고르기 선택지 — 전체 + 이 기기의 책(항목이 있는 책 먼저 제목 순) + 지워진 책(항목만 남음 — `docTitle`).
 * @returns {{value:string, title:string, n:number, gone:boolean}[]}
 */
export function scopeOptions(all, docs) {
  const list = scopeEntries(all, null);
  const m = docMap(docs);
  const count = new Map();
  const gone = new Map();
  for (const e of list) {
    const k = e.docId == null ? '' : String(e.docId);
    if (!k) continue;
    count.set(k, (count.get(k) || 0) + 1);
    if (!m.has(k) && !gone.has(k)) gone.set(k, e.docTitle || k);
  }
  const titleOf = (d) => String(d.title || d.fileName || d.id);
  const live = Array.from(m.values()).map((d) => ({ value: String(d.id), title: titleOf(d), n: count.get(String(d.id)) || 0, gone: false }))
    .sort((a, b) => (b.n > 0) - (a.n > 0) || a.title.localeCompare(b.title));
  const dead = Array.from(gone.entries()).map(([k, title]) => ({ value: k, title: String(title), n: count.get(k) || 0, gone: true }))
    .sort((a, b) => a.title.localeCompare(b.title));
  return [{ value: '', title: '', n: list.length, gone: false }].concat(live, dead);
}

/* ────────────────────────────────────────────────────────
   2. 흐름 — DOM 없이(테스트가 가짜 저장소·가짜 파이프라인으로 잰다)
   ──────────────────────────────────────────────────────── */

/**
 * 가져오기 — **미리보기 먼저.** `read` 는 계획만 세우고 쓰지 않는다. `apply` 가 고른 충돌만 더해 한 트랜잭션으로 쓴다.
 * @param {{store:{list:Function, applyImport:Function}, now?:()=>number, docs?:()=>(Object[]|Promise<Object[]>)}} deps
 */
export function createImportFlow(deps) {
  const d = deps || {};
  const now = typeof d.now === 'function' ? d.now : () => Date.now();
  let cur = null;

  /**
   * @param {string|ArrayBuffer|Uint8Array} input  파일 바이트(화면) 또는 글(시험) — 바이트는 UTF-8 만(`decodeCsvBytes`)
   * @returns {Promise<{ok:true, view:Object}|{ok:false, reason:string}>}
   */
  async function read(input) {
    cur = null;
    const dec = decodeCsvBytes(input);
    if (!dec.ok) return { ok: false, reason: dec.reason };
    const p = parseCsv(dec.text);
    if (!p.ok) return { ok: false, reason: p.reason };
    const existing = await d.store.list();
    const docs = typeof d.docs === 'function' ? (await d.docs()) || [] : [];
    const plan = importPlan(p.rows, existing, { nowMs: now(), docs: docs.map((x) => ({ id: x.id, title: x.title || x.fileName || '' })) });
    if (plan.error) return { ok: false, reason: plan.error };
    const byId = new Map(existing.map((e) => [String(e.id), e]));
    // 바뀔 항목(기기 → 파일) — 계획이 서면 바뀌지 않으므로 한 번만 만든다(5,000줄이어도 고르기마다 다시 세지 않게)
    const changes = plan.change.map((c) => describe(byId, c));
    cur = { plan: plan, byId: byId, picks: new Set(), changes: changes, columns: unknownColumns(p.columns) };
    return { ok: true, view: view() };
  }

  /** 계획 한 줄 → 미리보기 줄(필드별 기기 값 / 파일 값). */
  function describe(byId, c) {
    const ex = byId.get(String(c.id)) || {};
    const fields = Object.keys(c.patch).filter((k) => TERM_CONTENT_FIELDS.indexOf(k) >= 0)
      .map((k) => ({ field: k, here: fieldValue(k, ex[k]), file: c.patch[k] }));
    return { id: String(c.id), row: c.row + 2, term: ex.surface || ex.term || '', targetLang: ex.targetLang || '', srcLang: ex.srcLang || '', fields: fields };
  }

  /** 미리보기 모양 — 숫자·거절 사유·모르는 열·바뀔 항목(기기 → 파일)·충돌(기기 값 / 파일 값, 고름 여부). */
  function view() {
    if (!cur) return null;
    const conflicts = cur.plan.conflict.map((c) => Object.assign(describe(cur.byId, c), { useFile: cur.picks.has(String(c.id)) }));
    return { counts: importCounts(cur.plan), rejects: rejectSummary(cur.plan), columns: cur.columns.slice(), changes: cur.changes, conflicts: conflicts };
  }

  /** 충돌 하나(또는 `id` 없이 전부)를 "파일 것으로" 고르기/풀기. */
  function pick(id, on) {
    if (!cur) return null;
    const ids = id == null ? cur.plan.conflict.map((c) => String(c.id)) : [String(id)];
    for (const k of ids) { if (on) cur.picks.add(k); else cur.picks.delete(k); }
    return view();
  }

  /** [가져오기] — 고른 것만. 끝나면 계획을 버린다. */
  async function apply() {
    if (!cur) return null;
    const plan = planToApply(cur.plan, cur.picks);
    cur = null;
    return d.store.applyImport(plan);
  }

  function cancel() { cur = null; }
  function pending() { return !!cur; }

  return { read, view, pick, apply, cancel, pending };
}

/**
 * [번역 안 된 것 모두 번역 (n)] 한 번 — **최대 1호출**. 동의가 없으면 보내지 않는다(문지기). 받은 번역은
 * `update(…, {user:false})` + `origin:'ai'`·`edited:false`(사용자가 부른 AI 번역을 받아들임 — 8f-3 규칙).
 * 실패·`i` 어긋남·막힘 항목은 그대로 빈 채(다음 누름이 `retry:true` 로 다시 보낸다).
 * `[8f-3b — 8f3R-10 #4]` 쓸 때 `{ifBase: 요청 때 지문}` — 응답을 기다리는 동안 사용자가 그 항목을 고쳤으면 저장소가 쓰지 않고 null →
 * `stale` 로 센다(직접 친 번역을 AI 번역으로 덮지 않는다).
 * @param {Object[]} entries  이 범위의 항목
 * @param {{translateTerms:Function, update:Function, docs?:Object[]|Map, consented:boolean}} deps
 * @returns {Promise<{gate:?string, calls:number, sent:number, done:number, failed:number, more:number, blocked:?string, stale:number}>}
 */
export async function runBulk(entries, deps) {
  const d = deps || {};
  const out = { gate: null, calls: 0, sent: 0, done: 0, failed: 0, more: 0, blocked: null, stale: 0 };
  if (!d.consented) { out.gate = 'consent'; return out; }
  const plan = bulkPlan(entries, d.docs);
  if (!plan) return out;
  let res = null;
  try {
    res = await d.translateTerms(plan.items, { src: plan.src, target: plan.target, docId: plan.docId, domain: plan.domain, retry: true });
  } catch (e) { res = null; }
  out.sent = plan.items.length;
  out.calls = (res && Number(res.calls)) || 0;
  const results = res && Array.isArray(res.results) ? res.results : [];
  for (let i = 0; i < plan.ids.length; i++) {
    const r = results[i];
    if (r && r.state === 'ready' && r.value && fieldValue('translation', r.value.translation)) {
      try {
        const rec = await d.update(plan.ids[i], { translation: r.value.translation, gloss: r.value.gloss || '', pos: r.value.pos || '',
          lemma: r.value.lemma || '', origin: 'ai', edited: false }, { user: false, ifBase: plan.bases[i] });
        if (rec === null) out.stale++; else out.done++;
      } catch (e) { out.failed++; }
    } else if (r && r.state === 'blocked') {
      if (!out.blocked) out.blocked = r.code || 'blocked';
    } else if (r && r.state === 'skipped' && r.code === 'MORE') {
      out.more++;
    } else {
      out.failed++;
    }
  }
  return out;
}

/* ────────────────────────────────────────────────────────
   3. 화면
   ──────────────────────────────────────────────────────── */

let root = null;
let els = null;
const S = { docId: null, query: '', sort: 'added', all: [], docs: [], shown: VOCAB_PAGE, editId: null, busy: false, seq: 0, spoke: false };
let importFlow = null;
/** [원문 쪽으로 가기] — 그 쪽이 그려지면 그 줄을 본문 가운데로(편안 영역 안). */
let pendingReveal = null;
/** 열린 편집이 끝나면 포커스를 돌려줄 줄 id. */
let editFrom = null;
/**
 * `[8f-3b — 8f3R-10 #1]` 삭제 확인 대화의 대상 id — **열 때 고정**, 대화가 어떤 길로 닫히든(`close` 이벤트) 지운다.
 * 리스너는 `initVocab` 에서 한 벌만 단다(예전: 열 때마다 달고 단추·Esc 에서만 뗌 → 화면을 떠나며 닫힌 대화의 리스너가 남아
 * 다음 [삭제]가 앞 항목까지 지웠다).
 */
let delTarget = null;
/** 미리보기에 그리는 "바뀔 항목" 최대 수(나머지는 "… 외 n개"). */
export const CHANGE_SHOW = 30;

export function initVocab() {
  if (typeof document === 'undefined' || els) return;
  root = document.querySelector('[data-screen="vocab"]');
  if (!root) return;
  const q = (s) => root.querySelector(s);
  els = {
    title: q('#vocabTitle'), review: q('#vocabReview'), scope: q('#vocabScope'), find: q('#vocabFind'), sort: q('#vocabSort'),
    bulk: q('#vocabBulk'), exportBtn: q('#vocabExportBtn'), file: q('#vocabFile'),
    changed: q('#vocabChanged'), status: q('#vocabStatus'),
    exportPanel: q('#vocabExport'), exportWhat: q('#vocabExportWhat'),
    preview: q('#vocabPreview'), counts: q('#vocabCounts'), rejects: q('#vocabRejects'),
    conflicts: q('#vocabConflicts'), conflictList: q('#vocabConflictList'),
    count: q('#vocabCount'), list: q('#vocabList'), more: q('#vocabMore'), empty: q('#vocabEmpty'), emptyText: q('#vocabEmptyText'),
    edit: q('#vocabEdit'), form: q('#vocabEditForm'), head: q('#vocabEditHead'), src: q('#vocabEditSrc'),
    term: q('#vocabEditTerm'), tr: q('#vocabEditTr'), gloss: q('#vocabEditGloss'), pos: q('#vocabEditPos'),
    ctxRow: q('#vocabEditCtxRow'), ctx: q('#vocabEditCtx'), ctxTr: q('#vocabEditCtxTr'), note: q('#vocabEditNote'),
    goto: q('#vocabGoto'), editStatus: q('#vocabEditStatus'), del: q('#vocabDelDialog'), delTitle: q('#vocabDelTitle')
  };
  // `[8f-3b]` 바뀔 항목(기기 → 파일) — 충돌 목록 앞에 JS 가 만든다(마크업 무변)
  els.changes = document.createElement('div');
  els.changes.className = 'vocab-changes';
  els.changes.id = 'vocabChanges';
  els.changes.hidden = true;
  els.changesHead = document.createElement('p');
  els.changesHead.className = 'vocab-changes-head';
  els.changeList = document.createElement('ul');
  els.changeList.className = 'vocab-conflict-list vocab-change-list';
  els.changes.appendChild(els.changesHead);
  els.changes.appendChild(els.changeList);
  els.preview.insertBefore(els.changes, els.conflicts);
  importFlow = createImportFlow({ store: vocabStore, docs: () => S.docs });

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  els.find.addEventListener('input', () => { S.query = els.find.value; S.shown = VOCAB_PAGE; renderList(); });
  els.file.addEventListener('change', onFile);
  // Enter 로 편집 저장(`method=dialog` 의 기본 닫기 대신) — 메모(textarea)의 Enter 는 줄바꿈 그대로
  els.form.addEventListener('submit', (ev) => { ev.preventDefault(); saveEdit(); });
  els.edit.addEventListener('close', () => { S.editId = null; stopSpeech(); focusRow(editFrom); });
  // `[8f-3b]` 삭제 확인 — 리스너 한 벌. 대상은 `delTarget`(열 때 고정), 닫히면(어떤 길이든) 지운다.
  els.del.addEventListener('click', onDelClick);
  els.del.addEventListener('cancel', (ev) => { ev.preventDefault(); closeDel(); });
  els.del.addEventListener('close', () => { if (!els.del.open) delTarget = null; });
  onLangChange(() => { if (!root) return; applyTranslations(root); if (!root.hidden) render(); });
  // [원문 쪽으로 가기] — 리더가 그 쪽을 그린 뒤 그 줄로(다른 쪽·다른 책이면 버린다)
  onPageRender((p) => {
    const x = pendingReveal;
    if (!x || !p) return;
    pendingReveal = null;
    if (String(p.docId) !== String(x.docId) || Number(p.page) !== Number(x.page) || x.lineId == null) return;
    const run = () => { try { revealLine(x.lineId, null); } catch (e) { /* 줄이 없으면 쪽 맨 위 그대로 */ } };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(run, 0)); else setTimeout(run, 0);
  });
  attachDebugHook();
}

/** 라우터 — `#/vocab` · `#/vocab/:docId`. */
export async function showVocab(params) {
  if (!root) return;
  const docId = params && params.docId != null && params.docId !== '' ? String(params.docId) : null;
  if (docId !== S.docId) { S.shown = VOCAB_PAGE; }
  S.docId = docId;
  applyTranslations(root);
  attachDebugHook();          // main.js 가 부팅 끝에 `window.__medreader` 를 새로 만든다 — 화면에 들어올 때 다시 단다
  await load();
}

/** 화면을 떠날 때 — 대화·미리보기·내보내기 고르기·낭독([▶])을 거둔다. 목록·찾기·정렬은 메모리에 둔다(돌아오면 그대로). */
export function leaveVocab() {
  if (!els) return;
  closeDel();                 // `[8f-3b]` 단추·Esc 와 같은 정리 경로(대상 지움)
  closeDialog(els.edit);
  if (importFlow) importFlow.cancel();
  els.preview.hidden = true;
  showExport(false);
  stopSpeech();
}

async function load() {
  const my = ++S.seq;
  let all = [];
  const docs = [];
  try {
    all = await vocabStore.list();
    await db.iterate('documents', {}, (v) => { if (v && v.id != null) docs.push(v); });
  } catch (e) {
    banner(e);
  }
  if (my !== S.seq) return;
  S.all = all;
  S.docs = docs;
  render();
  renderReview(my);
}

/** `[12-3]` 머리 [복습 (n)] — n = 이 범위의 오늘 복습할 단어 카드(복습할 것 + 새 카드). 0 이면 숨김. */
async function renderReview(my) {
  let n = 0;
  try {
    const q = await cardStore.queue({ kinds: ['term'], docId: S.docId || undefined, newPerDay: clampNewPerDay(settings.get('srs.newPerDay')) });
    n = q.counts.due + q.counts.fresh;
  } catch (e) { n = 0; }
  if (my !== S.seq || !els) return;
  els.review.hidden = n === 0;
  els.review.textContent = t('vocab.review', { n: formatNumber(n) });
  els.review.setAttribute('data-n', String(n));
}

function docsById() { return docMap(S.docs); }

function scoped() { return scopeEntries(S.all, S.docId); }

function render() {
  if (!els) return;
  const m = docsById();
  const doc = S.docId ? m.get(S.docId) : null;
  const goneTitle = S.docId && !doc ? (S.all.find((e) => String(e.docId) === S.docId) || {}).docTitle : '';
  els.title.textContent = S.docId ? t('vocab.titleDoc', { title: doc ? (doc.title || doc.fileName || '') : (goneTitle || '') }) : t('vocab.title');
  renderScope();
  for (const b of els.sort.querySelectorAll('[data-sort]')) b.setAttribute('aria-pressed', b.getAttribute('data-sort') === S.sort ? 'true' : 'false');
  if (els.find.value !== S.query) els.find.value = S.query;
  renderChanged();
  renderBulk();
  renderList();
}

function renderScope() {
  const sel = els.scope;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  const opts = scopeOptions(S.all, S.docs);
  let has = false;
  for (const o of opts) {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = !o.value ? t('vocab.scope.all', { n: formatNumber(o.n) })
      : t(o.gone ? 'vocab.scope.gone' : 'vocab.scope.doc', { title: o.title, n: formatNumber(o.n) });
    if (o.value === (S.docId || '')) { op.selected = true; has = true; }
    sel.appendChild(op);
  }
  if (!has && S.docId) {
    // 항목도 문서도 없는 책 id(지어낸 주소) — 그 값을 그대로 둔다(빈 목록)
    const op = document.createElement('option');
    op.value = S.docId;
    op.textContent = t('vocab.scope.gone', { title: S.docId, n: '0' });
    op.selected = true;
    sel.appendChild(op);
  }
}

function renderChanged() {
  const n = changedCount(S.all, settings.get('vocab.lastExportAt'));
  els.changed.textContent = n === null ? t('vocab.changed.never', { n: formatNumber(S.all.length) }) : t('vocab.changed', { n: formatNumber(n) });
}

function renderBulk() {
  const n = termServices() ? bulkCount(scoped(), docsById()) : 0;
  els.bulk.hidden = n === 0;
  els.bulk.textContent = t('vocab.bulk', { n: formatNumber(n) });
  els.bulk.setAttribute('data-n', String(n));
  if (S.busy) els.bulk.setAttribute('aria-disabled', 'true'); else els.bulk.removeAttribute('aria-disabled');
}

function posLabel(p) { return p ? t('vocab.pos.' + p) : ''; }

function renderList() {
  const entries = scoped();
  const rows = viewRows(entries, { query: S.query, sort: S.sort });
  const list = els.list;
  while (list.firstChild) list.removeChild(list.firstChild);
  const m = docsById();
  const n = Math.min(rows.length, S.shown);
  for (let i = 0; i < n; i++) list.appendChild(rowEl(rows[i], m));
  els.more.hidden = rows.length <= n;
  els.more.textContent = rows.length > n ? t('vocab.more', { n: formatNumber(rows.length - n) }) : '';
  els.count.textContent = entries.length ? t('vocab.count', { n: formatNumber(rows.length) }) : '';
  els.empty.hidden = rows.length > 0;
  els.emptyText.textContent = entries.length ? t('vocab.noMatch') : t('vocab.empty');
}

function rowEl(e, docs) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'vocab-row';
  b.setAttribute('data-va', 'edit');
  b.setAttribute('data-id', String(e.id));
  const term = document.createElement('span');
  term.className = 'vocab-term';
  term.setAttribute('dir', 'ltr');
  if (e.srcLang) term.setAttribute('lang', e.srcLang);
  term.textContent = e.surface || e.term || '';
  const tr = document.createElement('span');
  tr.className = 'vocab-tr';
  const trText = fieldValue('translation', e.translation);
  if (trText) {
    const tl = e.targetLang || '';
    if (tl) { tr.setAttribute('lang', tl); tr.setAttribute('dir', dirOf(tl)); }
    appendBidiText(tr, trText, dirOf(tl));
  } else {
    tr.classList.add('vocab-none');
    tr.textContent = t('vocab.noTr');
  }
  const meta = document.createElement('span');
  meta.className = 'vocab-meta';
  const bits = [];
  if (e.pos) bits.push(posLabel(e.pos));
  if (e.pageNo) bits.push(t('vocab.page', { page: formatNumber(e.pageNo) }));
  if (!S.docId && (e.docTitle || (e.docId && docs.get(String(e.docId))))) {
    const d = e.docId ? docs.get(String(e.docId)) : null;
    bits.push(d ? (d.title || d.fileName || '') : e.docTitle);
  }
  meta.textContent = bits.filter(Boolean).join(' · ');
  b.appendChild(term);
  b.appendChild(tr);
  if (meta.textContent) b.appendChild(meta);
  li.appendChild(b);
  return li;
}

function setStatus(key, params) { els.status.textContent = key ? t(key, params || undefined) : ''; }

/* ── 동작 ──────────────────────────────────────────── */

function onClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('[data-va]') : null;
  if (!b || !root.contains(b) || b.getAttribute('aria-disabled') === 'true') return;
  const a = b.getAttribute('data-va');
  if (a === 'review') { presetCardsChip('term'); go(cardsHash(S.docId)); return; }   // `[12-3]` 단어 복습
  if (a === 'sort') { S.sort = SORTS.indexOf(b.getAttribute('data-sort')) >= 0 ? b.getAttribute('data-sort') : 'added'; S.shown = VOCAB_PAGE; render(); return; }
  if (a === 'more') { S.shown += VOCAB_PAGE; renderList(); return; }
  if (a === 'bulk') { bulk(); return; }
  if (a === 'export') { showExport(els.exportPanel.hidden); return; }
  if (a === 'export-csv' || a === 'export-anki') { doExport(a === 'export-anki' ? 'anki' : 'csv'); return; }
  if (a === 'import') { showExport(false); els.file.click(); return; }
  if (a === 'import-apply') { applyImport(); return; }
  if (a === 'import-cancel') { importFlow.cancel(); els.preview.hidden = true; setStatus(null); return; }
  if (a === 'edit') { openEdit(b.getAttribute('data-id')); return; }
  if (a === 'edit-save') { saveEdit(); return; }
  if (a === 'edit-delete') { askDelete(); return; }
  if (a === 'edit-close') { closeDialog(els.edit); return; }
  if (a === 'goto') { gotoSource(); return; }
  if (a === 'play-term' || a === 'play-tr') { play(a === 'play-tr'); }
}

function onChange(ev) {
  const x = ev.target;
  if (x === els.scope) {
    // 해시를 히스토리에 쌓지 않고 바꾼다(라우터가 다시 그린다)
    replace(vocabHash(els.scope.value || null));
    return;
  }
  if (x && x.getAttribute && x.getAttribute('data-va') === 'pick') {
    renderPreview(importFlow.pick(x.getAttribute('data-id'), x.checked));
    return;
  }
  if (x && x.getAttribute && x.getAttribute('data-va') === 'pick-all') {
    renderPreview(importFlow.pick(null, x.checked));
  }
}

/* ── [번역 안 된 것 모두 번역 (n)] ─────────────────── */

async function bulk() {
  const sv = termServices();
  if (!sv || S.busy) return;
  S.busy = true;
  renderBulk();
  setStatus('readalong.pending');
  let r = null;
  try {
    r = await runBulk(scoped(), {
      translateTerms: (items, opts) => sv.pipeline.translateTerms(items, opts),
      update: (id, patch, o) => vocabStore.update(id, patch, o),
      docs: docsById(),
      consented: !!settings.get('privacy.consentedAt')
    });
  } catch (e) { r = null; }
  S.busy = false;
  if (!r) setStatus('vs.failed');
  else if (r.gate) { setStatus(GATE_KEYS[r.gate] || 'readalong.failed'); raiseBanner(r.gate); }
  else if (r.blocked && !r.done) { setStatus(BLOCKED_KEYS[r.blocked] || 'readalong.failed'); raiseBanner(r.blocked); }
  else if (r.failed) setStatus('vocab.bulk.failed', { done: formatNumber(r.done), n: formatNumber(r.failed) });
  else setStatus('vocab.bulk.done', { n: formatNumber(r.done) });
  lastBulk = r;
  await load();
}
let lastBulk = null;

/** no-key·consent — 사용자가 번역을 불렀으므로 상태 바 배너를 바로(탭 번역·단어 시트와 같은 문구). */
function raiseBanner(code) {
  if (TAP_BANNER_NOW.indexOf(code) < 0) return;
  const b = noticeBanner(code, '');
  if (!b) return;
  document.dispatchEvent(new CustomEvent('medreader:banner', { detail: { key: b.key, tone: 'warn', params: b.params || null, actions: b.actions || [] } }));
}

/* ── 내보내기 ──────────────────────────────────────── */

function showExport(on) {
  els.exportPanel.hidden = !on;
  els.exportBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
  if (on) els.exportWhat.textContent = t('vocab.export.what', { n: formatNumber(S.all.length) });
}

async function doExport(kind) {
  const nowMs = Date.now();
  // 17-7-4 — "변경 사항을 파일에 저장" = 지금 단어장 **전체**(고친 내용 포함)를 새 파일로
  const f = exportFile(kind, viewRows(S.all, { sort: 'alpha' }), nowMs);
  try {
    const blob = new Blob([f.text], { type: f.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.rel = 'noopener';
    a.hidden = true;
    root.appendChild(a);
    a.click();
    root.removeChild(a);
    // 내려받기가 시작된 뒤 거둔다(바로 거두면 일부 브라우저가 받지 못한다)
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* 이미 거둠 */ } }, 30000);
  } catch (e) {
    setStatus('vocab.export.failed');
    return;
  }
  try { await settings.set('vocab.lastExportAt', nowMs); } catch (e) { /* 표시만 못 함 — 파일은 받았다 */ }
  showExport(false);
  setStatus('vocab.export.done', { name: f.name });
  renderChanged();
}

/* ── 가져오기 ──────────────────────────────────────── */

async function onFile() {
  const f = els.file.files && els.file.files[0];
  els.file.value = '';
  if (!f) return;
  els.preview.hidden = true;
  if (Number(f.size) > VOCAB.IMPORT_MAX_BYTES) { setStatus('vocab.import.err.size'); return; }
  // `[8f-3b]` 바이트로 읽는다 — UTF-8 이 아니면 흐름이 거절한다(`File.text()` 는 늘 UTF-8 로 읽어 깨진 글자를 만든다)
  let bytes = null;
  try { bytes = await f.arrayBuffer(); } catch (e) { setStatus('vocab.import.err.read'); return; }
  let r = null;
  try { r = await importFlow.read(bytes); } catch (e) { r = { ok: false, reason: 'read' }; }
  if (!r.ok) { setStatus('vocab.import.err.' + (['size', 'rows', 'header', 'empty', 'encoding'].indexOf(r.reason) >= 0 ? r.reason : 'read')); return; }
  setStatus(null);
  renderPreview(r.view);
  els.preview.hidden = false;
  try { els.preview.scrollIntoView({ block: 'nearest' }); } catch (e) { /* 굴리지 못해도 보인다 */ }
}

function renderPreview(v) {
  if (!v) return;
  const c = v.counts;
  els.counts.textContent = t('vocab.import.counts', { add: formatNumber(c.add), change: formatNumber(c.change), same: formatNumber(c.same),
    conflict: formatNumber(c.conflict), reject: formatNumber(c.reject) });
  while (els.rejects.firstChild) els.rejects.removeChild(els.rejects.firstChild);
  for (const r of v.rejects) {
    const li = document.createElement('li');
    li.textContent = t('vocab.import.reason.' + r.reason, { rows: rowList(r.rows) });
    els.rejects.appendChild(li);
  }
  // `[8f-3b]` 모르는 열 — 무시된다는 것을 알린다(일부만 번역한 머리 줄의 고침이 말없이 버려지지 않게)
  if (v.columns && v.columns.length) {
    const li = document.createElement('li');
    li.className = 'vocab-columns';
    li.textContent = t('vocab.import.reason.columns', { cols: v.columns.slice(0, 8).join(', ') + (v.columns.length > 8 ? ' …' : '') });
    els.rejects.appendChild(li);
  }
  // `[8f-3b]` 바뀔 항목 — 기기 값 → 파일 값(깨진 글자·`?` 로 바뀐 번역을 숫자만이 아니라 눈으로 알아챌 수 있게)
  renderChanges(v.changes || []);
  els.conflicts.hidden = !v.conflicts.length;
  const list = els.conflictList;
  while (list.firstChild) list.removeChild(list.firstChild);
  if (v.conflicts.length > 1) {
    const li = document.createElement('li');
    li.className = 'vocab-pick-all';
    li.appendChild(checkRow('pick-all', null, v.conflicts.every((x) => x.useFile), t('vocab.import.pickAll')));
    list.appendChild(li);
  }
  for (const x of v.conflicts) {
    const li = document.createElement('li');
    li.className = 'vocab-conflict';
    const head = document.createElement('p');
    head.className = 'vocab-conflict-term';
    head.setAttribute('dir', 'ltr');
    if (x.srcLang) head.setAttribute('lang', x.srcLang);
    head.textContent = x.term;
    li.appendChild(head);
    for (const f of x.fields) {
      const p = document.createElement('p');
      p.className = 'vocab-conflict-field';
      const lab = document.createElement('span');
      lab.className = 'vocab-conflict-label';
      lab.textContent = fieldLabel(f.field) + ' — ';
      p.appendChild(lab);
      p.appendChild(valueSpan(t('vocab.import.here'), f.here, f.field, x));
      p.appendChild(document.createTextNode(' · '));
      p.appendChild(valueSpan(t('vocab.import.file'), f.file, f.field, x));
      li.appendChild(p);
    }
    li.appendChild(checkRow('pick', x.id, x.useFile, t('vocab.import.useFile')));
    list.appendChild(li);
  }
}

/** 바뀔 항목 목록(앞 `CHANGE_SHOW` 개) — 원어 + 필드별 "기기: «…» → 파일: «…»". 글자는 textContent/`<bdi>` 만. */
function renderChanges(changes) {
  const list = els.changeList;
  while (list.firstChild) list.removeChild(list.firstChild);
  els.changes.hidden = !changes.length;
  if (!changes.length) return;
  els.changesHead.textContent = t('vocab.import.changes', { n: formatNumber(changes.length) });
  const n = Math.min(changes.length, CHANGE_SHOW);
  for (let i = 0; i < n; i++) {
    const x = changes[i];
    const li = document.createElement('li');
    li.className = 'vocab-conflict vocab-change';
    const head = document.createElement('p');
    head.className = 'vocab-conflict-term';
    head.setAttribute('dir', 'ltr');
    if (x.srcLang) head.setAttribute('lang', x.srcLang);
    head.textContent = x.term;
    li.appendChild(head);
    for (const f of x.fields) {
      const p = document.createElement('p');
      p.className = 'vocab-conflict-field';
      const lab = document.createElement('span');
      lab.className = 'vocab-conflict-label';
      lab.textContent = fieldLabel(f.field) + ' — ';
      p.appendChild(lab);
      p.appendChild(valueSpan(t('vocab.import.here'), f.here, f.field, x));
      // 읽는 방향으로 "기기 → 파일"(아랍어 UI 는 ←)
      p.appendChild(document.createTextNode(document.documentElement.getAttribute('dir') === 'rtl' ? ' ← ' : ' → '));
      p.appendChild(valueSpan(t('vocab.import.file'), f.file, f.field, x));
      li.appendChild(p);
    }
    list.appendChild(li);
  }
  if (changes.length > n) {
    const li = document.createElement('li');
    li.className = 'vocab-change-more';
    li.textContent = t('vocab.import.changesMore', { n: formatNumber(changes.length - n) });
    list.appendChild(li);
  }
}

function fieldLabel(k) {
  const map = { surface: 'vocab.edit.term', translation: 'vs.translation', gloss: 'vs.gloss', pos: 'vocab.edit.pos',
    context: 'vocab.edit.context', contextTr: 'vs.context', note: 'vocab.edit.note' };
  return t(map[k] || 'vocab.edit.term');
}

/** "기기: «값»" — 값의 방향은 그 필드의 언어(번역·뜻·문장 번역 = 대상, 원어·문맥 = ltr, 메모 = auto). */
function valueSpan(label, value, field, x) {
  const s = document.createElement('span');
  s.className = 'vocab-conflict-val';
  s.appendChild(document.createTextNode(label + ': '));
  const v = document.createElement('bdi');
  const tgt = ['translation', 'gloss', 'contextTr'].indexOf(field) >= 0;
  if (tgt && x.targetLang) { v.setAttribute('lang', x.targetLang); v.setAttribute('dir', dirOf(x.targetLang)); }
  else if (field === 'surface' || field === 'context') v.setAttribute('dir', 'ltr');
  else v.setAttribute('dir', 'auto');
  v.textContent = value === '' ? t('vocab.import.blank') : field === 'pos' ? (posLabel(value) || t('vocab.pos.none')) : value;
  s.appendChild(v);
  return s;
}

function checkRow(va, id, checked, text) {
  const lab = document.createElement('label');
  lab.className = 'vocab-check';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.setAttribute('data-va', va);
  if (id != null) cb.setAttribute('data-id', id);
  cb.checked = !!checked;
  lab.appendChild(cb);
  lab.appendChild(document.createTextNode(text));
  return lab;
}

async function applyImport() {
  if (!importFlow.pending()) return;
  let r = null;
  try { r = await importFlow.apply(); } catch (e) { banner(e); }
  els.preview.hidden = true;
  // `[8f-3b]` 미리보기 뒤에 바뀐 항목은 덮지 않고 건너뛴다 — 몇 개인지 알린다
  if (r && r.skipped) setStatus('vocab.import.doneStale', { add: formatNumber(r.added), change: formatNumber(r.changed), skipped: formatNumber(r.skipped) });
  else if (r) setStatus('vocab.import.done', { add: formatNumber(r.added), change: formatNumber(r.changed) });
  await load();
}

/* ── 편집 ──────────────────────────────────────────── */

function entryById(id) { return S.all.find((e) => String(e.id) === String(id)) || null; }

function openEdit(id) {
  const e = entryById(id);
  if (!e || !els.edit) return;
  S.editId = String(e.id);
  editFrom = String(e.id);
  const docs = docsById();
  const doc = e.docId != null ? docs.get(String(e.docId)) : null;
  const tl = e.targetLang || '';
  els.head.textContent = e.surface || e.term || '';
  if (e.srcLang) els.head.setAttribute('lang', e.srcLang); else els.head.removeAttribute('lang');
  els.src.textContent = doc ? t('vocab.edit.source', { title: doc.title || doc.fileName || '', page: e.pageNo ? formatNumber(e.pageNo) : '—' })
    : e.docTitle ? t('vocab.edit.sourceGone', { title: e.docTitle }) : '';
  els.term.value = e.surface || e.term || '';
  if (e.srcLang) els.term.setAttribute('lang', e.srcLang);
  for (const [el, v] of [[els.tr, e.translation], [els.gloss, e.gloss]]) {
    el.value = v || '';
    if (tl) { el.setAttribute('lang', tl); el.setAttribute('dir', dirOf(tl)); } else { el.removeAttribute('lang'); el.setAttribute('dir', 'auto'); }
  }
  fillPos(e.pos || '');
  els.note.value = e.note || '';
  els.ctx.textContent = e.context || '';
  if (e.srcLang) els.ctx.setAttribute('lang', e.srcLang);
  els.ctxRow.hidden = !e.context;
  while (els.ctxTr.firstChild) els.ctxTr.removeChild(els.ctxTr.firstChild);
  els.ctxTr.hidden = !e.contextTr;
  if (e.contextTr) {
    if (tl) { els.ctxTr.setAttribute('lang', tl); els.ctxTr.setAttribute('dir', dirOf(tl)); }
    appendBidiText(els.ctxTr, e.contextTr, dirOf(tl));
  }
  els.goto.hidden = !(doc && e.pageNo);
  els.editStatus.textContent = '';
  if (typeof els.edit.showModal === 'function') { if (!els.edit.open) els.edit.showModal(); } else els.edit.setAttribute('open', '');
  // 첫 포커스는 원어 머리(자판이 저절로 뜨지 않게 — 단어 시트와 같은 규칙)
  try { els.head.focus({ preventScroll: true }); } catch (err) { /* 포커스 못 옮겨도 대화는 열린다 */ }
}

function fillPos(cur) {
  const sel = els.pos;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  for (const p of [''].concat(VOCAB.POS)) {
    const op = document.createElement('option');
    op.value = p;
    op.textContent = p ? posLabel(p) : t('vocab.pos.none');
    if (p === cur) op.selected = true;
    sel.appendChild(op);
  }
}

async function saveEdit() {
  const e = entryById(S.editId);
  if (!e) return;
  const r = editPatch(e, { surface: els.term.value, translation: els.tr.value, gloss: els.gloss.value, pos: els.pos.value, note: els.note.value });
  if (r.error) { els.editStatus.textContent = t('vocab.edit.termEmpty'); return; }
  if (!Object.keys(r.patch).length) { els.editStatus.textContent = t('vocab.edit.unchanged'); return; }
  if (r.patch.surface !== undefined) {
    const other = await vocabStore.findTerm(r.patch.surface, e.targetLang);
    if (other && String(other.id) !== String(e.id)) { els.editStatus.textContent = t('vocab.edit.dup'); return; }
  }
  let rec = null;
  try { rec = await vocabStore.update(e.id, r.patch, { user: true }); } catch (err) { rec = null; }
  if (!rec) { els.editStatus.textContent = t('vs.saveFailed'); return; }
  closeDialog(els.edit);
  setStatus('vs.saved');
  await load();
  focusRow(String(e.id));
}

/**
 * 페이지 안 확인(서재 [텍스트 다시 추출]과 같은 장치 — `confirm()` 쓰지 않음). 첫 초점 [취소].
 * `[8f-3b]` 리스너는 `initVocab` 의 한 벌(`onDelClick`) — 여기서는 대상 id 만 고정하고 연다.
 */
function askDelete() {
  const e = entryById(S.editId);
  const dlg = els.del;
  if (!e || !dlg) return;
  applyTranslations(dlg);
  els.delTitle.textContent = t('vocab.delete.title', { term: e.surface || e.term || '' });
  delTarget = String(e.id);
  if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
  const cancel = dlg.querySelector('button[data-dialog="cancel"]');
  if (cancel) cancel.focus();
}

/** 삭제 확인 닫기 — 단추·Esc·화면 떠남이 모두 이 길(대상을 바로 지운다 — `close` 이벤트는 비동기라 기다리지 않는다). */
function closeDel() {
  delTarget = null;
  closeDialog(els && els.del);
}

/** 삭제 확인의 단추 — [삭제]면 **열 때 고정한** 대상만 지운다. */
async function onDelClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('button[data-dialog]') : null;
  if (!b) return;
  const id = delTarget;
  const ok = b.getAttribute('data-dialog') === 'ok';
  closeDel();
  if (!ok || id == null) return;
  let done = false;
  try { done = await vocabStore.remove(id); } catch (err) { done = false; }
  if (!done) { els.editStatus.textContent = t('vs.saveFailed'); return; }
  editFrom = null;
  closeDialog(els.edit);
  setStatus('vocab.deleted');
  await load();
}

function closeDialog(dlg) {
  if (!dlg) return;
  if (typeof dlg.close === 'function') { if (dlg.open) dlg.close(); } else dlg.removeAttribute('open');
}

function focusRow(id) {
  if (id == null || !els || root.hidden) return;
  const b = els.list.querySelector('.vocab-row[data-id="' + cssEscape(id) + '"]');
  if (b) { try { b.focus({ preventScroll: false }); } catch (e) { /* 줄이 없으면 그대로 */ } }
}

/** [원문 쪽으로 가기] — 그 쪽을 열고, 그려지면 그 줄을 본문 가운데로(`revealLine` — 6-5 편안 영역). 문서가 없으면 단추가 없다. */
function gotoSource() {
  const e = entryById(S.editId);
  if (!e || e.docId == null || !e.pageNo || !docsById().has(String(e.docId))) return;
  pendingReveal = { docId: String(e.docId), page: Number(e.pageNo), lineId: e.lineId == null ? null : String(e.lineId) };
  editFrom = null;
  closeDialog(els.edit);
  go(readerHash(e.docId, e.pageNo));
}

/* ── [▶] 원어 = 원문 음성 · 번역 = 번역문 음성 (6-3 해석 함수 그대로 — 호출 0) ── */

function play(tr) {
  const e = entryById(S.editId);
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!e || !synth || typeof SpeechSynthesisUtterance !== 'function') return;
  const lang = tr ? e.targetLang : e.srcLang || 'en';
  // 번역문 낭독은 괄호 속 라틴 병기를 뺀다(운영자 결정 2026-10-08 — 화면은 그대로)
  const text = tr ? trSpeechText(els.tr.value || e.translation || '') : String(els.term.value || e.surface || e.term || '');
  if (!text || !lang) return;
  try { synth.cancel(); } catch (err) { /* 엔진 없음 */ }
  let voices = [];
  try { voices = synth.getVoices() || []; } catch (err) { voices = []; }
  const r = resolveSpeech(lang, voices, speechPref(settings.get, lang));
  const u = new SpeechSynthesisUtterance(text);
  u.lang = r.tag;
  if (r.voice) u.voice = r.voice;
  S.spoke = true;
  try { synth.speak(u); } catch (err) { /* 소리 못 냄 — 화면은 그대로 */ }
}

function stopSpeech() {
  if (!S.spoke) return;
  S.spoke = false;
  try { if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* 엔진 없음 */ }
}

/* ── 작은 도구 ─────────────────────────────────────── */

function cssEscape(s) {
  if (globalThis.CSS && typeof CSS.escape === 'function') return CSS.escape(s);
  return String(s).replace(/["\\]/g, '\\$&');
}

function banner(err) {
  document.dispatchEvent(new CustomEvent('medreader:banner', { detail: { code: (err && err.code) || 'ERR_UNKNOWN', tone: 'error' } }));
}

/* ── `[D]` 측정 훅 — 글자는 담지 않는다(수·키·불리언만) ── */
function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  g.vocab = {
    state: function () {
      if (!els) return null;
      const rows = viewRows(scoped(), { query: S.query, sort: S.sort });
      return { docId: S.docId, all: S.all.length, scoped: scoped().length, rows: rows.length, drawn: els.list.children.length,
        sort: S.sort, query: S.query.length, bulkN: Number(els.bulk.getAttribute('data-n')) || 0, bulkShown: !els.bulk.hidden,
        busy: S.busy, lastBulk: lastBulk, preview: !els.preview.hidden, conflicts: els.conflictList.querySelectorAll('.vocab-conflict').length,
        editOpen: !!(els.edit && els.edit.open), delOpen: !!(els.del && els.del.open), goto: !els.goto.hidden,
        services: !!termServices(), exportOpen: !els.exportPanel.hidden, changed: changedCount(S.all, settings.get('vocab.lastExportAt')),
        changesShown: els.changeList.querySelectorAll('.vocab-change').length, columnsNote: !!els.rejects.querySelector('.vocab-columns'),
        delTarget: delTarget != null };
    }
  };
}
