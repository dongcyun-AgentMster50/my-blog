/* ══════════════════════════════════════════════════════════════════════
   text/vocab.js — 단어장 순수 함수 (spec 17-7 · 17-7-6 4-3·4-4·4-6 — 8f-1)

   순수 계층이다(3-1 · 16-A). `config` 와 `text/bidi.js` 만 import 한다. 브라우저 전역을 모른다 —
   낱말 단위 세그먼터 같은 것은 화면이 함수로 넘긴다(여기서는 쓰지 않는다). 시각은 **인자**(숫자 ms)로 받는다.

   - `normalizeTerm`        단어장 `term`(인덱스 'term' 이 보는 값) — NFKC·소문자·공백 하나·앞뒤 구두점 제거·`|` 제거
   - `findInSentenceTr`     문장 번역의 괄호 원어에서 낱말의 번역 후보 찾기(호출 0 — 17-7-2 2)
   - `newTermEntry`         `cards` `kind:'term'` 레코드 한 벌(9-2 `[신설 2026-10-12]` 필드 + 12 의 복습 필드)
   - `buildCsv`·`buildAnki`·`parseCsv`·`importPlan`  내보내기·가져오기(17-7-4 — 화면은 8f-3)
   - `[8f-3]` `fieldValue`(내용 값 정규화 한 규칙) · `fileTimeOf`(CSV 시각 — 이 앱이 쓴 꼴만) · `planToApply`(충돌 고르기 → 적용 계획)
   - `[8f-3b]` `ROW_FLAG`(파일 줄 거절 표식 — 깨진 따옴표 `quote`·깨진 글자 `encoding`) · `baseOf`(항목 내용 지문 — 계획 뒤
     기기에서 바뀐 항목을 적용 때 건너뛰려고)

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
/** 여러 줄 칸(메모) — 줄 끝을 LF 로 맞추고 앞뒤 공백만 걷는다(`<textarea>` 값과 CSV 칸 안 CRLF 가 같은 값이 되게). */
function multi(v) { return v == null ? '' : String(v).replace(/\r\n?/g, '\n').trim(); }

/** 품사 — 목록 안이면 그 값, 빈 값이면 ''(아직 모름), 그 밖은 'other'. */
export function normalizePos(v) {
  const p = str(v).toLowerCase();
  if (!p) return '';
  return VOCAB.POS.indexOf(p) >= 0 ? p : 'other';
}

/**
 * `[8f-3 — crossstep "8f-1 Review" ②]` 내용 필드 값 정규화 — **한 규칙**. `newTermEntry`·가져오기(`rowFields`)·
 * `store.update`·`importPlan` 비교가 모두 이것을 거친다(같은 값이 저장·내보내기·가져오기를 돌아도 같은 글자):
 * 메모 = 줄 끝 LF·앞뒤 공백만, 품사 = `normalizePos`, 그 밖 = 공백 하나·앞뒤 걷기.
 * @param {string} field  `TERM_CONTENT_FIELDS` 중 하나(그 밖도 받으면 한 줄 규칙)
 * @param {*} v
 * @returns {string}
 */
export function fieldValue(field, v) {
  if (field === 'note') return multi(v);
  if (field === 'pos') return normalizePos(v);
  return str(v);
}

/** 이 앱이 쓰는 시각 꼴 — `toISOString()`(초·밀리초·시간대 생략 가능) 또는 ms 숫자. */
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * `[8f-3 — crossstep "8f-1 Review" ①]` CSV `updated`·`added` 칸 → ms. **이 앱이 쓴 꼴만** 읽는다(ISO `…Z`·시간대 붙은 ISO·ms 숫자).
 * 스프레드시트가 바꿔 저장한 꼴(`16/11/2026 09:00`·`11/16/2026 9:00`·`2026-11-16 09:00`)은 `Date.parse` 가 읽더라도
 * 날짜·월 순서·시간대·초가 흔들리므로 **못 읽음(NaN)** — 가져오기는 그 행을 "충돌"로 보이고 사용자가 고른다.
 * `[8f-3b — 8f3R-10 #6(c)]` ms 숫자는 **13자리만**(2001–2286년). 10자리 유닉스 **초**를 ms 로 읽으면 1970년이 되어 파일 고침이
 * 말없이 "그대로"로 버려졌다 — 초·그 밖 자릿수는 못 읽음(충돌 — 미리보기에 두 값이 보인다).
 * @param {*} v
 * @returns {number} ms 또는 NaN
 */
export function fileTimeOf(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) return NaN;
  if (/^\d{13}$/.test(t)) return Number(t);
  return ISO_TIME.test(t) ? Date.parse(t) : NaN;
}

/**
 * `[8f-3b — 8f3R-10 #2·#4]` 항목 내용 **지문** — `updatedAt` + `term` + 내용 필드(같은 정규화 `fieldValue`). 가져오기 계획·[번역 안 된 것
 * 모두 번역] 묶음을 세울 때 적어 두고, 쓸 때(`applyImport`·`update` 의 `ifBase`) 기기 레코드의 지문이 다르면 그 항목은 쓰지 않는다
 * (그사이 사용자가 고친 값을 옛 계획이 덮지 않게).
 * @param {Object} e
 * @returns {string}
 */
export function baseOf(e) {
  const x = e || {};
  return JSON.stringify([Number(x.updatedAt) || 0, String(x.term == null ? '' : x.term)].concat(TERM_CONTENT_FIELDS.map((k) => fieldValue(k, x[k]))));
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

/**
 * `[8f-3b — 8f3R-10 #6(b)]` 파일 줄 거절 표식(열 이름과 겹치지 않는 Symbol) — `parseCsv` 가 행 객체에 달고 `importPlan` 이 거절 사유로 쓴다.
 * `'quote'` 따옴표가 닫히지 않은(또는 닫는 따옴표 뒤에 글자가 붙은) 칸이 있는 줄 · `'encoding'` 깨진 글자(`U+FFFD`)가 든 줄.
 */
export const ROW_FLAG = Symbol('medreader.vocab.rowFlag');

/** 깨진 따옴표 되감기 상한 — 넘으면 남은 깨진 곳은 예전처럼 읽되 그 줄을 `quote` 로 표시한다(병적인 파일에서 시간을 묶지 않게). */
const QUOTE_REWINDS = 20;

/**
 * RFC 4180 행 나누기(따옴표·`""`·칸 안 줄바꿈, CRLF·LF·CR 줄 끝).
 * `[8f-3b — 8f3R-10 #6(b)]` 칸 첫머리 `"` 가 끝까지 닫히지 않거나 닫는 `"` 뒤에 `,`·줄 끝이 아닌 글자가 오면(엑셀이 쓰지 않는 꼴) —
 * 예전에는 뒤 줄들을 한 칸에 삼켜 미리보기 수에서 말없이 사라졌다. 이제 그 여는 `"` 로 **되감아** 글자로 읽고(뒤 줄은 제대로 나뉜다)
 * 그 줄에 `quote` 표시를 단다.
 * @returns {{rows:string[][], flags:(string|null)[]}}
 */
function csvRecords(text) {
  const rows = [];
  const flags = [];
  const literal = new Set();
  let row = [];
  let cell = '';
  let q = false;
  let bad = false;
  let open = null;          // 따옴표를 연 자리 — 되감기용
  let rewinds = 0;
  let i = 0;
  const n = text.length;
  const rewind = () => {
    literal.add(open.i);
    i = open.i; rows.length = open.rows; flags.length = open.rows; row = open.row.slice(); bad = open.bad;
    cell = ''; q = false; open = null; rewinds++;
  };
  for (;;) {
    while (i < n) {
      const ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
          const nx = text[i + 1];
          if (nx !== undefined && nx !== ',' && nx !== '\r' && nx !== '\n') {
            if (rewinds < QUOTE_REWINDS) { rewind(); continue; }
            bad = true;
          }
          q = false; open = null; i++; continue;
        }
        cell += ch; i++; continue;
      }
      if (ch === '"' && cell === '') {
        if (!literal.has(i)) { q = true; open = { i: i, rows: rows.length, row: row.slice(), bad: bad }; i++; continue; }
        bad = true;                                   // 되감은 여는 따옴표 — 글자로 읽고 줄을 표시
      }
      if (ch === ',') { row.push(cell); cell = ''; i++; continue; }
      if (ch === '\r' || ch === '\n') {
        row.push(cell); rows.push(row); flags.push(bad ? 'quote' : null); row = []; cell = ''; bad = false;
        i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
        continue;
      }
      cell += ch; i++;
    }
    if (q && open && rewinds < QUOTE_REWINDS) { rewind(); continue; }
    if (q) bad = true;                                // 상한을 넘어 끝까지 닫히지 않음 — 그 줄(삼킨 것 포함)은 표시
    break;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); flags.push(bad ? 'quote' : null); }
  const keep = [];
  const keepFlags = [];
  for (let k = 0; k < rows.length; k++) {
    if (rows[k].length === 1 && rows[k][0] === '') continue;
    keep.push(rows[k]);
    keepFlags.push(flags[k] || null);
  }
  return { rows: keep, flags: keepFlags };
}

/**
 * 17-7-4 CSV 읽기. BOM 을 떼고 머리 줄의 **열 이름**으로 맞춘다(순서 무관 — 엑셀에서 열을 옮겨도 된다).
 * 상한: `VOCAB.IMPORT_MAX_BYTES`(2MB)·`IMPORT_MAX_ROWS`(5,000 행) — 넘으면 통째로 거절.
 * @param {string} text
 * @returns {{ok:true, columns:string[], rows:Object[]}|{ok:false, reason:'size'|'rows'|'header'|'empty'}}
 *   `rows[k]` = 열 이름 → 칸 글자(수식 접두를 되돌린 값). 머리 줄에 없는 열은 키가 없다.
 *   `[8f-3b]` 깨진 따옴표 줄·`U+FFFD`(UTF-8 이 아닌 파일을 UTF-8 로 읽어 깨진 글자)가 든 줄은 `rows[k][ROW_FLAG]` = `'quote'`·`'encoding'`
 *   (`importPlan` 이 그 줄을 거절 — 미리보기에 사유와 줄 번호).
 */
export function parseCsv(text) {
  const s = typeof text === 'string' ? text : '';
  if (utf8Bytes(s) > VOCAB.IMPORT_MAX_BYTES) return { ok: false, reason: 'size' };
  const parsed = csvRecords(s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s);
  const recs = parsed.rows;
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
    // 깨진 글자가 먼저(파일을 다시 저장하라는 안내가 더 쓸모 있다) — 머리 줄에 없는 칸까지 본다
    if (recs[r].some((v) => typeof v === 'string' && v.indexOf('\uFFFD') >= 0)) o[ROW_FLAG] = 'encoding';
    else if (parsed.flags[r]) o[ROW_FLAG] = parsed.flags[r];
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
    // `[8f-3]` 이 앱이 쓴 꼴만(스프레드시트가 바꾼 날짜는 NaN — importPlan 이 "충돌"로)
    createdAt: fileTimeOf(g(COL.createdAt)),
    updatedAt: fileTimeOf(g(COL.updatedAt)),
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
 * `[8f-3 — crossstep "8f-1 Review" ①]` 내용이 다른데 파일 `updated` 칸이 비었거나 **이 앱이 쓴 꼴이 아니면**(`fileTimeOf` — 스프레드시트가
 * `dd/mm/yyyy` 등으로 바꿈·열을 지움) 어느 쪽이 새로운지 모른다 → **충돌**(`conflict`). 기기 값을 조용히 덮지 않는다 — 미리보기에서
 * 사용자가 고르기 전에는 적용 목록(`change`)에 들지 않는다(`planToApply`).
 * `[8f-3 — crossstep "8f-1 Review" ②]` 비교는 양쪽을 같은 규칙(`fieldValue`)으로 정규화한 뒤 — 겹공백·끝 줄바꿈만 다른 값은 "그대로".
 * 거절: 원어 빔(`term`)·대상 언어 빔(`target`)·같은 파일 안 같은 항목 두 번째(`dup`)·원어를 바꿔 다른 항목과 겹침(`dup`).
 * `[8f-3b]` ① 거절 `quote`·`encoding`(`parseCsv` 의 줄 표식 `ROW_FLAG`) ② 행 `id` 로 찾은 항목의 대상 언어가 행의 `target_lang` 과 다르면
 * 그 `id` 는 버리고 `term`+`target_lang` 으로 맞춘다(설계 4-6 ② 의 "없는 id" 와 같은 길 — 다른 대상 언어 항목을 덮지 않는다. 손으로 고친
 * 파일에서만 생긴다) ③ 파일 `updated` 가 **지금보다 뒤**(다른 기기 시계가 틀림)면 어느 쪽이 새로운지 모른다 → 충돌(`reason:'future'`).
 * 적용되는 `updatedAt` 은 `max(지금, 기기)` — 파일의 미래 시각을 저장하지 않는다(새 항목의 `createdAt`·`updatedAt` 도 지금으로 자른다)
 * ④ 바뀜·충돌 항목에 `base`(`baseOf(기기 항목)` — 적용 때 기기 레코드가 그사이 바뀌었으면 `applyImport` 가 건너뛴다).
 *
 * @param {Object[]} rows `parseCsv(…).rows`
 * @param {Object[]} existing 기기의 단어장 항목들
 * @param {{nowMs?:number, docs?:{id:string, title:string}[]}} [opts] `docs` — 이 기기의 문서(제목이 같으면 `docId` 를 잇는다)
 * @returns {{error:null|'rows', add:Object[], change:{id:string, patch:Object, row:number, base:string}[], same:{id:string, row:number}[],
 *           conflict:{id:string, patch:Object, row:number, reason:'time'|'future', base:string}[], reject:{row:number, reason:string}[]}}
 *   `add[k]` = `newTermEntry` 입력(`origin:'import'`, `row`), `change[k].patch` = 내용 필드 + `term`(원어가 바뀌면)·`edited`·`updatedAt`.
 *   `conflict[k].patch` 는 사용자가 "파일 것으로"를 고르면 그대로 `change` 가 된다. `row` 는 데이터 행 번호(0 부터).
 */
export function importPlan(rows, existing, opts) {
  const o = opts || {};
  const list = Array.isArray(rows) ? rows : [];
  const plan = { error: null, add: [], change: [], same: [], conflict: [], reject: [] };
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

  // 지금 시각을 모르면(nowMs 0 — 옛 호출) 미래 판정·자르기를 하지 않는다
  const clip = (t) => (nowMs > 0 ? Math.min(t, nowMs) : t);

  for (let r = 0; r < list.length; r++) {
    const flag = list[r] && list[r][ROW_FLAG];
    if (flag) { plan.reject.push({ row: r, reason: String(flag) }); continue; }
    const f = rowFields(list[r] || {});
    const term = normalizeTerm(f.surface);
    if (!term) { plan.reject.push({ row: r, reason: 'term' }); continue; }
    if (!f.targetLang) { plan.reject.push({ row: r, reason: 'target' }); continue; }
    const key = termKey(term, f.targetLang);
    // `[8f-3b]` id 로 찾은 항목이 다른 대상 언어면 그 id 는 쓰지 않는다(다른 언어 항목을 덮지 않게)
    const byFileId = f.id ? byId.get(f.id) || null : null;
    const idHit = byFileId && byFileId.targetLang === f.targetLang ? byFileId : null;
    const ex = idHit || byKey.get(key) || null;
    const mark = ex ? 'id:' + ex.id : 'k:' + key;
    if (seen.has(mark) || (ex && seen.has('k:' + key))) { plan.reject.push({ row: r, reason: 'dup' }); continue; }
    seen.add(mark);
    seen.add('k:' + key);

    if (!ex) {
      plan.add.push({
        row: r, id: f.id && !byFileId ? f.id : null, term: term, surface: f.surface, srcLang: f.srcLang, targetLang: f.targetLang,
        translation: f.translation || '', pos: f.pos || '', gloss: f.gloss || '', context: f.context || '',
        contextTr: f.contextTr || '', note: f.note || '', docTitle: f.docTitle,
        docId: docByTitle.has(f.docTitle) ? docByTitle.get(f.docTitle) : null, pageNo: f.pageNo,
        origin: 'import', edited: false,
        createdAt: Number.isFinite(f.createdAt) ? clip(f.createdAt) : nowMs,
        updatedAt: Number.isFinite(f.updatedAt) ? clip(f.updatedAt) : nowMs
      });
      continue;
    }

    // 원어를 고쳐 다른 항목과 겹치면 거절(같은 term+대상 언어는 한 항목 — 17-7-3)
    const other = byKey.get(key);
    if (other && other !== ex) { plan.reject.push({ row: r, reason: 'dup' }); continue; }
    const patch = {};
    for (const k of ['surface', 'translation', 'pos', 'gloss', 'context', 'contextTr', 'note']) {
      if (f[k] === undefined) continue;
      if (fieldValue(k, ex[k]) !== f[k]) patch[k] = f[k];       // ★ 양쪽 같은 정규화(②)
    }
    if (term !== ex.term) patch.term = term;
    if (!Object.keys(patch).length) { plan.same.push({ id: String(ex.id), row: r }); continue; }
    const exAt = Number(ex.updatedAt) || 0;
    const readable = Number.isFinite(f.updatedAt);
    // `[8f-3b]` 지금보다 뒤인 파일 시각은 믿지 않는다(그 시각을 저장하면 그 뒤 기기 고침이 늘 "더 오래됨"이 된다)
    const future = readable && nowMs > 0 && f.updatedAt > nowMs;
    const known = readable && !future;
    if (known && f.updatedAt < exAt) { plan.same.push({ id: String(ex.id), row: r, newerHere: true }); continue; }
    if (patch.translation !== undefined || patch.gloss !== undefined || patch.note !== undefined || patch.surface !== undefined) patch.edited = true;
    patch.updatedAt = Math.max(nowMs, exAt, known ? f.updatedAt : 0);
    const base = baseOf(ex);
    // ★ 시각을 못 읽으면(또는 미래) 어느 쪽이 새로운지 모른다 — 충돌(고르기 전에는 기기 값 그대로 — ①)
    if (!known) { plan.conflict.push({ id: String(ex.id), patch: patch, row: r, reason: future ? 'future' : 'time', base: base }); continue; }
    plan.change.push({ id: String(ex.id), patch: patch, row: r, base: base });
  }
  return plan;
}

/**
 * `[8f-3]` 미리보기에서 고른 결과 → `applyImport` 에 넘길 계획. 충돌은 사용자가 **"파일 것으로"를 고른 것만** `change` 에 든다
 * (고르지 않으면 기기 값 그대로). 순수 함수 — 원래 계획을 바꾸지 않는다.
 * @param {ReturnType<typeof importPlan>} plan
 * @param {Iterable<string>|null} useFile  "파일 것으로" 고른 충돌 항목 id 들
 * @returns {{add:Object[], change:{id:string, patch:Object, row:number}[]}}
 */
export function planToApply(plan, useFile) {
  const p = plan || {};
  const pick = new Set(useFile ? Array.from(useFile, String) : []);
  const chosen = (Array.isArray(p.conflict) ? p.conflict : []).filter((c) => pick.has(String(c.id)));
  return {
    add: Array.isArray(p.add) ? p.add.slice() : [],
    change: (Array.isArray(p.change) ? p.change : []).concat(chosen)
  };
}
