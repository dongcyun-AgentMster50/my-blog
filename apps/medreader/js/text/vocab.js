/* ══════════════════════════════════════════════════════════════════════
   text/vocab.js — 단어장 순수 함수 (spec 17-7 · 17-7-6 4-3·4-4·4-6 — 8f-1)

   순수 계층이다(3-1 · 16-A). `config` 와 `text/bidi.js` 만 import 한다. 브라우저 전역을 모른다 —
   낱말 단위 세그먼터 같은 것은 화면이 함수로 넘긴다(여기서는 쓰지 않는다). 시각은 **인자**(숫자 ms)로 받는다.

   - `normalizeTerm`        단어장 `term`(인덱스 'term' 이 보는 값) — NFKC·소문자·공백 하나·앞뒤 구두점 제거·`|` 제거
   - `findInSentenceTr`     문장 번역의 괄호 원어에서 낱말의 번역 후보 찾기(호출 0 — 17-7-2 2)
   - `newTermEntry`         `cards` `kind:'term'` 레코드 한 벌(9-2 `[신설 2026-10-12]` 필드 + 12 의 복습 필드)
   - `buildCsv`·`buildAnki`·`parseCsv`·`importPlan`  내보내기·가져오기(17-7-4 — 화면은 8f-3)

   ★ 시각 필드(`createdAt`·`updatedAt`·`dueAt`)는 **숫자 ms**(12-D10). CSV 의 `added`·`updated` 열만 사람이 읽게 ISO 로 쓴다.
   ★ 열 이름은 `VOCAB.CSV_COL`(config) 한 곳에서 온다.
   ══════════════════════════════════════════════════════════════════════ */

import { VOCAB } from '../config.js';
import { ltrRuns } from './bidi.js';

const COL = VOCAB.CSV_COL;

/** 보이지 않는 글자 — 숨은 하이픈(U+00AD)·폭 없는 공백·이음 제어·BOM. 낱말에서 뺀다(하이픈 결합 꼴 — 17-7-1). */
const INVISIBLE = /[­​-‍⁠﻿]/g;

/**
 * 17-7-6 4-3 — 단어장 `term`. NFKC → 소문자 → `|` 를 공백으로 → 공백 하나 → 앞뒤의 글자·숫자 아닌 것(구두점·기호·따옴표) 제거.
 * 낱말 **안**의 하이픈·아포스트로피는 둔다(`c-reactive`·`crohn's`). `|` 는 캐시 키 구분자라 남기지 않는다(키 `'w=' + term`).
 * @param {*} s
 * @returns {string}
 */
export function normalizeTerm(s) {
  return String(s == null ? '' : s)
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .toLowerCase()
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^\p{L}\p{M}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{M}\p{N}]+$/u, '');
}

/** `hay` 안에 `needle` 이 낱말 경계로 있는가(둘 다 `normalizeTerm` 결과). */
function hasWord(hay, needle) {
  if (!needle) return false;
  let from = 0;
  for (;;) {
    const at = hay.indexOf(needle, from);
    if (at < 0) return false;
    const before = at === 0 ? '' : hay[at - 1];
    const after = hay.slice(at + needle.length, at + needle.length + 1);
    if (!/[\p{L}\p{M}\p{N}]/u.test(before) && !/[\p{L}\p{M}\p{N}]/u.test(after)) return true;
    from = at + 1;
  }
}

/** 후보를 거슬러 오를 때 멈추는 글자 — 17-7-2 `، ؛ . : , ;` + 괄호 + 문장 끝(`؟ ? !`). */
const STOP = /[،؛.:,;()?!؟]/u;
const SPACE = /\s/u;

/** 낱말의 글자 체계 갈래 — 라틴·그 밖 글자·중립(숫자·기호만). */
function scriptClass(w) {
  if (/\p{Script=Latin}/u.test(w)) return 'latin';
  if (/\p{L}/u.test(w)) return 'other';
  return 'neutral';
}

/**
 * 17-7-2 2 · 17-7-6 4-3 — 문장 번역 `tr` 에서 낱말 `term` 의 번역 **후보**(호출 0).
 *
 * `ltrRuns(tr)` 의 괄호 묶음 중 `normalizeTerm(괄호 속)` 이 `normalizeTerm(term)` 을 낱말 경계로 포함하는 **첫** 묶음을 찾고,
 * 그 바로 앞 조각에서 뒤로 최대 `VOCAB.CANDIDATE_WORDS`(4) 낱말을 모은다. 멈춤: `، ؛ . : , ;`·다른 괄호·문장 끝 기호,
 * 그리고 **글자 체계가 바뀌는 낱말**(가장 가까운 낱말이 정한다 — 아랍어 대상이면 괄호 밖 영어 낱말에서 멈추고,
 * `fr` 처럼 라틴 대상이면 라틴 낱말을 그대로 모은다). 숫자·기호만인 낱말은 중립(넣되 체계를 정하지 않는다).
 * 낱말 수를 기계적으로 자르므로 **후보**다 — 화면이 "확인하세요"와 함께 보인다.
 *
 * @param {string} term
 * @param {string} tr  문장 번역
 * @returns {{candidate:string, sentenceTr:string, at:[number, number], paren:[number, number]}|null}
 *   `at` = 후보 시작 ~ 괄호 끝(밑줄 칠 곳), `paren` = 괄호 묶음. 괄호가 없거나 후보가 비면 null.
 */
export function findInSentenceTr(term, tr) {
  const want = normalizeTerm(term);
  const s = typeof tr === 'string' ? tr : '';
  if (!want || !s) return null;
  let pos = 0;
  let hit = null;
  const runs = ltrRuns(s);
  for (let k = 0; k < runs.length; k++) {
    const r = runs[k];
    const start = pos;
    pos += r.text.length;
    if (!r.ltr || r.text[0] !== '(' || r.text[r.text.length - 1] !== ')') continue;
    if (hasWord(normalizeTerm(r.text.slice(1, -1)), want)) { hit = [start, pos]; break; }
  }
  if (!hit) return null;

  const before = s.slice(0, hit[0]);
  let end = before.length;
  while (end > 0 && SPACE.test(before[end - 1])) end--;
  let i = end;
  let cand = end;
  let cls = null;
  let words = 0;
  while (words < VOCAB.CANDIDATE_WORDS) {
    let j = i;
    while (j > 0 && SPACE.test(before[j - 1])) j--;
    if (j === 0 || STOP.test(before[j - 1])) break;
    let k = j;
    while (k > 0 && !SPACE.test(before[k - 1]) && !STOP.test(before[k - 1])) k--;
    const c = scriptClass(before.slice(k, j));
    if (c !== 'neutral') {
      if (cls === null) cls = c;
      else if (c !== cls) break;
    }
    cand = k;
    i = k;
    words++;
  }
  if (cls === null || cand >= end) return null;
  return { candidate: s.slice(cand, end), sentenceTr: s, at: [cand, hit[1]], paren: [hit[0], hit[1]] };
}

/* ────────────────────────────────────────────────────────
   레코드 — 9-2 `[신설 2026-10-12]` 필드 + 12(17-11 4)의 복습 필드
   ──────────────────────────────────────────────────────── */

/** 9-2 `sm2` 기본값 `{ease:2.5, interval:0, reps:0, lapses:0}` — 부를 때마다 새 객체. */
export function defaultSm2() {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0 };
}

/** 사용자·CSV 가 고칠 수 있는 **내용** 필드(9c·`importPlan`·`applyImport` 가 같은 목록을 쓴다). 복습 필드(`sm2`·`dueAt`·`reviewedAt`·`introducedAt`)는 아니다. */
export const TERM_CONTENT_FIELDS = Object.freeze(['surface', 'translation', 'pos', 'gloss', 'lemma', 'context', 'contextTr', 'note']);

/** 복습 필드 — 가져오기·내용 수정이 **덮지 않는다**(12-D18). */
export const TERM_REVIEW_FIELDS = Object.freeze(['sm2', 'dueAt', 'reviewedAt', 'introducedAt']);

/** 시각 값 → ms. 숫자면 그대로, 문자열이면 `Date.parse`(ISO), 못 읽으면 NaN. */
export function msOf(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string' && v.trim()) {
    const t = v.trim();
    if (/^\d+$/.test(t)) return Number(t);
    return Date.parse(t);
  }
  return NaN;
}

function str(v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); }
function multi(v) { return v == null ? '' : String(v).trim(); }

/** 품사 — 목록 안이면 그 값, 빈 값이면 ''(아직 모름), 그 밖은 'other'. */
export function normalizePos(v) {
  const p = str(v).toLowerCase();
  if (!p) return '';
  return VOCAB.POS.indexOf(p) >= 0 ? p : 'other';
}

/**
 * `cards` `kind:'term'` 레코드 한 벌(`id` 는 호출자 — 서비스가 정한다). 시각은 숫자 ms(12-D10), `dueAt = createdAt`.
 * @param {Object} input `{term?, surface, srcLang, targetLang, translation?, pos?, lemma?, gloss?, context?, contextTr?,
 *                         docId?, docTitle?, pageNo?, lineId?, origin?, edited?, note?, createdAt?, updatedAt?}`
 * @param {number} nowMs
 * @returns {Object}
 */
export function newTermEntry(input, nowMs) {
  const x = input || {};
  const surface = str(x.surface) || str(x.term);
  const created = Number.isFinite(msOf(x.createdAt)) ? msOf(x.createdAt) : Number(nowMs) || 0;
  const updated = Number.isFinite(msOf(x.updatedAt)) ? msOf(x.updatedAt) : created;
  const page = Math.floor(Number(x.pageNo));
  return {
    id: x.id == null ? null : String(x.id),
    kind: 'term',
    term: normalizeTerm(x.term || surface),
    surface: surface,
    srcLang: str(x.srcLang),
    targetLang: str(x.targetLang),
    translation: str(x.translation),
    pos: normalizePos(x.pos),
    lemma: str(x.lemma),
    gloss: str(x.gloss),
    context: str(x.context),
    contextTr: str(x.contextTr),
    docId: x.docId == null || x.docId === '' ? null : String(x.docId),
    docTitle: str(x.docTitle),
    pageNo: Number.isFinite(page) && page > 0 ? page : null,
    lineId: x.lineId == null || x.lineId === '' ? null : String(x.lineId),
    origin: VOCAB.ORIGINS.indexOf(x.origin) >= 0 ? x.origin : 'user',
    edited: !!x.edited,
    note: multi(x.note),
    createdAt: created,
    updatedAt: updated,
    sm2: defaultSm2(),
    dueAt: created,
    reviewedAt: null,
    introducedAt: null,
    suspended: false
  };
}

/* ────────────────────────────────────────────────────────
   17-7-4 내보내기 — CSV(엑셀) · Anki
   ──────────────────────────────────────────────────────── */

/** 수식 주입(13절) — `= + - @`·탭·CR 로 시작하는 칸. 앞의 `'` 들을 지나 본다(되돌릴 때 정확히 하나만 떼기 위해). */
const FORMULA = /^'*[=+\-@\t\r]/;

/** ms → ISO(사람이 읽는 열). 없으면 ''. */
function isoOf(v) {
  const t = msOf(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
}

/**
 * CSV 칸 하나. 수식처럼 보이면 앞에 `'`(13절), 쉼표·따옴표·줄바꿈이 있으면 RFC 4180 따옴표(안의 `"` 는 `""`).
 * @param {*} v
 * @returns {string}
 */
export function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (FORMULA.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** 항목 → CSV 한 줄의 값들(열 순서 `VOCAB.CSV_COLUMNS`). */
function csvValues(e) {
  const x = e || {};
  const byCol = {};
  byCol[COL.surface] = x.surface || x.term || '';
  byCol[COL.translation] = x.translation;
  byCol[COL.pos] = x.pos;
  byCol[COL.gloss] = x.gloss;
  byCol[COL.context] = x.context;
  byCol[COL.contextTr] = x.contextTr;
  byCol[COL.note] = x.note;
  byCol[COL.docTitle] = x.docTitle;
  byCol[COL.pageNo] = x.pageNo == null ? '' : x.pageNo;
  byCol[COL.srcLang] = x.srcLang;
  byCol[COL.targetLang] = x.targetLang;
  byCol[COL.createdAt] = isoOf(x.createdAt);
  byCol[COL.updatedAt] = isoOf(x.updatedAt);
  byCol[COL.id] = x.id;
  return VOCAB.CSV_COLUMNS.map((c) => byCol[c]);
}

/**
 * 17-7-4 CSV — UTF-8 BOM(`﻿`) + 머리 줄(열 이름 14개) + 항목마다 한 줄, 줄 끝 CRLF(마지막 줄 뒤에도).
 * @param {Object[]} entries
 * @returns {string}
 */
export function buildCsv(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const lines = [VOCAB.CSV_COLUMNS.map(csvCell).join(',')];
  for (let i = 0; i < list.length; i++) lines.push(csvValues(list[i]).map(csvCell).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Anki 칸 — 탭·줄바꿈은 공백(칸 구분이 탭이다). 수식 접두는 붙이지 않는다(엑셀용이 아니다). */
function ankiCell(v) {
  return (v == null ? '' : String(v)).replace(/[\t\r\n]+/g, ' ').trim();
}

/**
 * 17-7-4 Anki — 머리 줄 3개(`#separator:tab` · `#html:false` · `#columns:Front	Back	Context	Note	Source`) + 탭 구분.
 * Front = 원어, Back = 번역(+ " — " 짧은 뜻), Context = 문맥 문장, Note = 메모, Source = 책 제목(+ " p.쪽").
 * @param {Object[]} entries
 * @returns {string}
 */
export function buildAnki(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const lines = VOCAB.ANKI_HEADER.slice();
  for (let i = 0; i < list.length; i++) {
    const e = list[i] || {};
    const back = ankiCell(e.translation) + (ankiCell(e.gloss) ? ' — ' + ankiCell(e.gloss) : '');
    const src = ankiCell(e.docTitle) + (e.pageNo ? ' p.' + e.pageNo : '');
    lines.push([ankiCell(e.surface || e.term), back, ankiCell(e.context), ankiCell(e.note), src.trim()].join('\t'));
  }
  return lines.join('\n') + '\n';
}

/* ────────────────────────────────────────────────────────
   17-7-4 가져오기 — 같은 CSV 형식만
   ──────────────────────────────────────────────────────── */

/** UTF-8 바이트 수(코드포인트로 센다 — 전역 인코더를 쓰지 않는다). */
export function utf8Bytes(s) {
  let n = 0;
  for (const ch of String(s == null ? '' : s)) {
    const c = ch.codePointAt(0);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

/** `csvCell` 의 수식 접두를 되돌린다 — 뒤가 `= + - @`·탭·CR 일 때만 `'` 하나를 뗀다(`'tis` 는 그대로). */
export function unFormula(s) {
  return /^'+[=+\-@\t\r]/.test(s) ? s.slice(1) : s;
}

/** RFC 4180 행 나누기(따옴표·`""`·칸 안 줄바꿈, CRLF·LF·CR 줄 끝). */
function csvRecords(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        q = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"' && cell === '') { q = true; i++; continue; }
    if (ch === ',') { row.push(cell); cell = ''; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      row.push(cell); rows.push(row); row = []; cell = '';
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    cell += ch; i++;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/**
 * 17-7-4 CSV 읽기. BOM 을 떼고 머리 줄의 **열 이름**으로 맞춘다(순서 무관 — 엑셀에서 열을 옮겨도 된다).
 * 상한: `VOCAB.IMPORT_MAX_BYTES`(2MB)·`IMPORT_MAX_ROWS`(5,000 행) — 넘으면 통째로 거절.
 * @param {string} text
 * @returns {{ok:true, columns:string[], rows:Object[]}|{ok:false, reason:'size'|'rows'|'header'|'empty'}}
 *   `rows[k]` = 열 이름 → 칸 글자(수식 접두를 되돌린 값). 머리 줄에 없는 열은 키가 없다.
 */
export function parseCsv(text) {
  const s = typeof text === 'string' ? text : '';
  if (utf8Bytes(s) > VOCAB.IMPORT_MAX_BYTES) return { ok: false, reason: 'size' };
  const recs = csvRecords(s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s);
  if (!recs.length) return { ok: false, reason: 'empty' };
  const columns = recs[0].map((c) => String(c).trim().toLowerCase());
  if (columns.indexOf(COL.surface) < 0 || columns.indexOf(COL.targetLang) < 0) return { ok: false, reason: 'header' };
  if (recs.length - 1 > VOCAB.IMPORT_MAX_ROWS) return { ok: false, reason: 'rows' };
  const rows = [];
  for (let r = 1; r < recs.length; r++) {
    const o = {};
    for (let c = 0; c < columns.length; c++) {
      if (!columns[c] || Object.prototype.hasOwnProperty.call(o, columns[c])) continue;
      o[columns[c]] = unFormula(recs[r][c] == null ? '' : recs[r][c]);
    }
    rows.push(o);
  }
  return { ok: true, columns: columns, rows: rows };
}

/** 가져온 행 → 내용 필드(항목 모양). */
function rowFields(row) {
  const g = (col) => (Object.prototype.hasOwnProperty.call(row, col) ? row[col] : undefined);
  const out = {
    surface: str(g(COL.surface)),
    translation: str(g(COL.translation)),
    pos: normalizePos(g(COL.pos)),
    gloss: str(g(COL.gloss)),
    context: str(g(COL.context)),
    contextTr: str(g(COL.contextTr)),
    note: multi(g(COL.note)),
    docTitle: str(g(COL.docTitle)),
    pageNo: g(COL.pageNo),
    srcLang: str(g(COL.srcLang)).toLowerCase(),
    targetLang: str(g(COL.targetLang)).toLowerCase(),
    createdAt: msOf(g(COL.createdAt)),
    updatedAt: msOf(g(COL.updatedAt)),
    id: str(g(COL.id))
  };
  // 파일에 없는 열은 "바꾸지 않음"(undefined)으로 둔다 — 열을 지운 CSV 가 기기 값을 지우지 않게.
  for (const f of ['translation', 'pos', 'gloss', 'context', 'contextTr', 'note']) {
    if (g(COL[f]) === undefined) out[f] = undefined;
  }
  return out;
}

/** 항목 키 `term + U+0001 + targetLang`(U+0001 은 정규화가 접지 않는다 — 8f-1 정정 1 과 같은 까닭). */
function termKey(term, target) {
  return term + '\u0001' + target;
}

/**
 * 17-7-4 · 17-7-6 4-6 가져오기 계획(쓰지 않는다 — 서비스 `applyImport` 가 한 트랜잭션으로 쓴다).
 *
 * 맞추기: 행의 `id` 가 기기에 있으면 그 항목, 없으면(빈 `id`·다른 기기의 `id`) `term`+`target_lang` 으로, 그래도 없으면 새 항목.
 * 맞춘 항목: 내용(`TERM_CONTENT_FIELDS` 중 파일에 있는 열)이 같으면 **그대로**. 다르면 파일의 `updated` 가 기기 `updatedAt` 보다
 * **이르지 않을 때**(같거나 늦을 때) **바뀜** — 엑셀에서 칸만 고친 파일은 `updated` 가 내보낸 때 그대로라 같다(8f-1 정정 3).
 * 기기에서 내보낸 뒤 고친 항목(기기가 더 늦음)은 그대로 — 기기 것이 이긴다.
 * 거절: 원어 빔(`term`)·대상 언어 빔(`target`)·같은 파일 안 같은 항목 두 번째(`dup`)·원어를 바꿔 다른 항목과 겹침(`dup`).
 *
 * @param {Object[]} rows `parseCsv(…).rows`
 * @param {Object[]} existing 기기의 단어장 항목들
 * @param {{nowMs?:number, docs?:{id:string, title:string}[]}} [opts] `docs` — 이 기기의 문서(제목이 같으면 `docId` 를 잇는다)
 * @returns {{error:null|'rows', add:Object[], change:{id:string, patch:Object, row:number}[], same:{id:string, row:number}[],
 *           reject:{row:number, reason:string}[]}}
 *   `add[k]` = `newTermEntry` 입력(`origin:'import'`, `row`), `change[k].patch` = 내용 필드 + `term`(원어가 바뀌면)·`edited`·`updatedAt`.
 *   `row` 는 데이터 행 번호(0 부터).
 */
export function importPlan(rows, existing, opts) {
  const o = opts || {};
  const list = Array.isArray(rows) ? rows : [];
  const plan = { error: null, add: [], change: [], same: [], reject: [] };
  if (list.length > VOCAB.IMPORT_MAX_ROWS) { plan.error = 'rows'; return plan; }
  const nowMs = Number(o.nowMs) || 0;
  const byId = new Map();
  const byKey = new Map();
  for (const e of Array.isArray(existing) ? existing : []) {
    if (!e || e.kind !== 'term') continue;
    if (e.id != null) byId.set(String(e.id), e);
    byKey.set(termKey(e.term, e.targetLang), e);
  }
  const docByTitle = new Map();
  for (const d of Array.isArray(o.docs) ? o.docs : []) if (d && d.title) docByTitle.set(str(d.title), String(d.id));
  const seen = new Set();

  for (let r = 0; r < list.length; r++) {
    const f = rowFields(list[r] || {});
    const term = normalizeTerm(f.surface);
    if (!term) { plan.reject.push({ row: r, reason: 'term' }); continue; }
    if (!f.targetLang) { plan.reject.push({ row: r, reason: 'target' }); continue; }
    const key = termKey(term, f.targetLang);
    const ex = (f.id && byId.get(f.id)) || byKey.get(key) || null;
    const mark = ex ? 'id:' + ex.id : 'k:' + key;
    if (seen.has(mark) || (ex && seen.has('k:' + key))) { plan.reject.push({ row: r, reason: 'dup' }); continue; }
    seen.add(mark);
    seen.add('k:' + key);

    if (!ex) {
      plan.add.push({
        row: r, id: f.id || null, term: term, surface: f.surface, srcLang: f.srcLang, targetLang: f.targetLang,
        translation: f.translation || '', pos: f.pos || '', gloss: f.gloss || '', context: f.context || '',
        contextTr: f.contextTr || '', note: f.note || '', docTitle: f.docTitle,
        docId: docByTitle.has(f.docTitle) ? docByTitle.get(f.docTitle) : null, pageNo: f.pageNo,
        origin: 'import', edited: false,
        createdAt: Number.isFinite(f.createdAt) ? f.createdAt : nowMs,
        updatedAt: Number.isFinite(f.updatedAt) ? f.updatedAt : nowMs
      });
      continue;
    }

    // 원어를 고쳐 다른 항목과 겹치면 거절(같은 term+대상 언어는 한 항목 — 17-7-3)
    const other = byKey.get(key);
    if (other && other !== ex) { plan.reject.push({ row: r, reason: 'dup' }); continue; }
    const patch = {};
    for (const k of ['surface', 'translation', 'pos', 'gloss', 'context', 'contextTr', 'note']) {
      if (f[k] === undefined) continue;
      if (String(ex[k] == null ? '' : ex[k]) !== f[k]) patch[k] = f[k];
    }
    if (term !== ex.term) patch.term = term;
    if (!Object.keys(patch).length) { plan.same.push({ id: String(ex.id), row: r }); continue; }
    const exAt = Number(ex.updatedAt) || 0;
    if (Number.isFinite(f.updatedAt) && f.updatedAt < exAt) { plan.same.push({ id: String(ex.id), row: r, newerHere: true }); continue; }
    if (patch.translation !== undefined || patch.gloss !== undefined || patch.note !== undefined || patch.surface !== undefined) patch.edited = true;
    patch.updatedAt = Math.max(nowMs, exAt, Number.isFinite(f.updatedAt) ? f.updatedAt : 0);
    plan.change.push({ id: String(ex.id), patch: patch, row: r });
  }
  return plan;
}
