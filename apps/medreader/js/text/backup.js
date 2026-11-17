/* ══════════════════════════════════════════════════════════════════════
   text/backup.js — 백업 파일 순수 함수 (spec 17-4-1 — 9c-1, 9c-2 가 가져다 쓴다)

   순수 계층이다(3-1 · 16-A). `config` 와 `text/vocab.js`(단어장 병합 규칙 `importPlan` — 다시 만들지 않는다)만 import 한다.
   브라우저 전역도, 저장소도, 키 저장소도 모른다. 시각·DB 판·해시 방식은 **인자**로 받는다.

   파일 꼴 — 한 파일 NDJSON(17-4-1 3):
     1행  {"t":"head","format":1,"app":"medreader","db":3,"algo":12,"createdAt":"ISO","hash":"s256"|"fnv",
           "include":{"cache":true,"settings":true},"counts":{…},"docs":[{id,title,fileHash,pageCount}…]}
     2행~ {"t":"rec","s":"<스토어>","v":{…}}   — 스토어 순서 `BACKUP.STORES`
     끝행 {"t":"end","counts":{…}}             — 없으면 "끝까지 쓰지 못한 파일"
   한 줄 = 레코드 하나. `JSON.stringify` 는 값 속 줄바꿈을 `\n` 으로 이스케이프하므로 줄 안에 날 줄바꿈이 없다.

   - `docForBackup`      documents 의 사용자 몫 필드만(`BACKUP.DOC_FIELDS`)
   - `settingsForBackup` 허용 목록 키만 · 키 모양 값은 뺀다
   - `headLine`·`recLine`·`endLine`·`parseLine`  줄 만들기·읽기. **모든 글자 값에서 키 모양(`BACKUP.KEY_PATTERNS` — 9c-1b)을 `[KEY]` 로 지운다**
   - `lineSplitter`      조각 → 줄(경계에 걸친 줄 이어 붙임, `\r\n`)
   - `readHead`          머리 줄 판정(판이 새로우면 거절 코드)
   - `remapRecord`       docId 바꿔 쓰기(같은 `fileHash` 가 다른 id 로 있을 때 — 9c-D3)
   - `mergeRecord`       스토어별 충돌 규칙(9c-D4 — 병합만, 지우지 않음, 멱등)
   - `backupAge`·`backupFileName`  화면 한 줄·파일 이름
   ══════════════════════════════════════════════════════════════════════ */

import { BACKUP, VOCAB } from '../config.js';
import { importPlan, TERM_REVIEW_FIELDS } from './vocab.js';

/* ────────────────────────────────────────────────────────
   1. 무엇을 담나
   ──────────────────────────────────────────────────────── */

const DOC_FIELDS = BACKUP.DOC_FIELDS;
const SETTINGS_ALLOW = new Set(BACKUP.SETTINGS_KEYS);

/** 키 모양 — 글자 값 안 어디든(`g`). `replace` 는 `lastIndex` 를 0 부터 다시 쓴다.
 *  `[9c-1b]` 넓은 `REDACT_PATTERNS`(로그 몫) 대신 백업 전용 `BACKUP.KEY_PATTERNS` — 하이픈 합성어·"Bearer of" 같은 낱말을 지우지 않는다. */
const KEY_RE = new RegExp(BACKUP.KEY_PATTERNS.join('|'), 'g');
/** 판정용(`g` 없음 — `test` 가 `lastIndex` 를 들고 다니지 않게). */
const KEY_TEST = new RegExp(BACKUP.KEY_PATTERNS.join('|'));

/** 글자 하나에서 키 모양을 지운다. */
export function scrubText(s) {
  return typeof s === 'string' ? s.replace(KEY_RE, '[KEY]') : s;
}

/** 값(깊이 무관)에 키 모양 글자가 들어 있는가. */
export function hasKeyShape(v) {
  if (typeof v === 'string') return KEY_TEST.test(v);
  if (!v || typeof v !== 'object') return false;
  try { return KEY_TEST.test(JSON.stringify(v)); } catch (e) { return true; }
}

/**
 * 17-4-1 2 — `documents` 레코드의 사용자 몫. `extraction`·`sectionIndex*`·모르는 필드는 빼고, 없는 필드는 만들지 않는다.
 * @param {Object} doc
 * @returns {Object|null}
 */
export function docForBackup(doc) {
  if (!doc || typeof doc !== 'object' || doc.id == null) return null;
  const out = {};
  for (let i = 0; i < DOC_FIELDS.length; i++) {
    const k = DOC_FIELDS[i];
    if (Object.prototype.hasOwnProperty.call(doc, k) && doc[k] !== undefined) out[k] = doc[k];
  }
  return out;
}

/**
 * 17-4-1 4 — `settings` 행 중 허용 목록 키만. **키 모양 값은 빼고**(사용자가 다른 칸에 키를 붙여 넣었어도 파일에 가지 않는다).
 * @param {Iterable<{key:string, value:*}>} rows
 * @returns {{key:string, value:*}[]}
 */
export function settingsForBackup(rows) {
  const out = [];
  for (const r of rows || []) {
    if (!r || typeof r.key !== 'string' || !SETTINGS_ALLOW.has(r.key)) continue;
    if (r.value === undefined || hasKeyShape(r.value)) continue;
    out.push({ key: r.key, value: r.value });
  }
  return out;
}

/** 설정 키 하나가 담기는가(가져오기도 같은 판정 — 9c-2). */
export function settingAllowed(key) {
  return SETTINGS_ALLOW.has(String(key));
}

/* ────────────────────────────────────────────────────────
   2. 줄 만들기 · 읽기
   ──────────────────────────────────────────────────────── */

/** `JSON.stringify` 바꾸개 — 글자 **값**의 키 모양을 지운다(구조 글자 `"`·`,` 를 넘지 않게 값 단위로). */
function scrubber(k, v) {
  return typeof v === 'string' ? v.replace(KEY_RE, '[KEY]') : v;
}

function line(obj) {
  return JSON.stringify(obj, scrubber);
}

/**
 * 머리 줄.
 * @param {{createdAt:string, db:number, algo:number, hash:string, include:{cache:boolean, settings:boolean},
 *          counts:Object<string,number>, docs:{id:string, title:string, fileHash:string, pageCount:number}[]}} meta
 * @returns {string} 줄바꿈 없음
 */
export function headLine(meta) {
  const m = meta || {};
  const inc = m.include || {};
  return line({
    t: 'head',
    format: BACKUP.FORMAT,
    app: BACKUP.APP,
    db: Number(m.db) || 0,
    algo: Number(m.algo) || 0,
    createdAt: String(m.createdAt || ''),
    hash: m.hash === 'fnv' ? 'fnv' : 's256',
    include: { cache: inc.cache !== false, settings: inc.settings !== false },
    counts: Object.assign({}, m.counts || {}),
    docs: (Array.isArray(m.docs) ? m.docs : []).map((d) => ({
      id: d && d.id, title: d && d.title, fileHash: d && d.fileHash, pageCount: d && d.pageCount
    }))
  });
}

/** 레코드 줄. */
export function recLine(store, v) {
  return line({ t: 'rec', s: String(store), v: v });
}

/** 끝 줄. */
export function endLine(counts) {
  return line({ t: 'end', counts: Object.assign({}, counts || {}) });
}

/**
 * 한 줄 읽기(9c-2). 반쪽 줄·모르는 꼴은 `bad`.
 * @param {string} s
 * @returns {{kind:'head', head:Object}|{kind:'rec', store:string, v:Object}|{kind:'end', counts:Object}|{kind:'bad'}}
 */
export function parseLine(s) {
  let o;
  try { o = JSON.parse(String(s)); } catch (e) { return { kind: 'bad' }; }
  if (!o || typeof o !== 'object') return { kind: 'bad' };
  if (o.t === 'rec' && typeof o.s === 'string' && o.v && typeof o.v === 'object') return { kind: 'rec', store: o.s, v: o.v };
  if (o.t === 'end') return { kind: 'end', counts: o.counts && typeof o.counts === 'object' ? o.counts : {} };
  if (o.t === 'head') return { kind: 'head', head: o };
  return { kind: 'bad' };
}

/**
 * 머리 줄 판정(17-4-1 3). `format` 이 이 앱보다 크면 거절(`newer`), 이 앱 파일이 아니면 `not-backup`.
 * `db`·`algo` 는 진단용 — 판정에 쓰지 않는다(추출본을 담지 않는다).
 * @param {string} s 첫 줄
 * @returns {{ok:true, head:Object}|{ok:false, code:'not-backup'|'newer', head?:Object}}
 */
export function readHead(s) {
  const p = parseLine(s);
  if (p.kind !== 'head') return { ok: false, code: 'not-backup' };
  const h = p.head;
  const f = Number(h.format);
  if (h.app !== BACKUP.APP || !Number.isInteger(f) || f < 1) return { ok: false, code: 'not-backup' };
  if (f > BACKUP.FORMAT) return { ok: false, code: 'newer', head: h };
  return { ok: true, head: h };
}

/**
 * 글자 조각 → 줄(17-4-1 5 메모리). 조각 경계에 걸친 줄은 이어 붙이고, `\r\n` 의 `\r` 은 뗀다(경계에 걸쳐도).
 * 빈 줄은 내지 않는다. 바이트 → 글자는 **호출자 몫**(UTF-8 다바이트 글자가 조각 경계에 걸리는 것은 디코더가 잇는다).
 * `[9c-2 — 9c1R #10]` 줄 하나가 `maxLine`(기본 `BACKUP.MAX_LINE_CHARS`) 글자를 넘으면 그 줄은 **버리고**(다음 줄바꿈까지 읽지 않고 흘림)
 * `long` 을 하나 올린다 — 줄바꿈 없는 큰 파일을 조각마다 처음부터 다시 잇던 일(10MB 279ms·100MB 수십 초)이 없다. 이어지는 조각은
 * 목록에 모았다가 줄바꿈을 만날 때 한 번만 잇는다.
 * @param {{maxLine?:number}} [opts]
 * @returns {{push:(chunk:string)=>string[], end:()=>string[], readonly long:number}}
 */
export function lineSplitter(opts) {
  const max = opts && Number(opts.maxLine) > 0 ? Number(opts.maxLine) : BACKUP.MAX_LINE_CHARS;
  let pend = [];          // 아직 줄바꿈을 못 만난 조각들
  let pendLen = 0;
  let skipping = false;   // 상한을 넘은 줄 — 다음 줄바꿈까지 버린다
  let long = 0;
  const clean = (x) => (x.charCodeAt(x.length - 1) === 13 ? x.slice(0, -1) : x);
  const keep = (piece) => {
    if (skipping || !piece) return;
    pend.push(piece);
    pendLen += piece.length;
    if (pendLen > max) { skipping = true; long++; pend = []; pendLen = 0; }
  };
  const take = (out, last) => {
    if (skipping) { skipping = false; return; }
    const l = clean(pend.length ? pend.join('') + last : last);
    pend = [];
    pendLen = 0;
    if (l.length > max) { long++; return; }
    if (l.trim()) out.push(l);
  };
  return {
    push(chunk) {
      const s = chunk == null ? '' : String(chunk);
      const out = [];
      let from = 0;
      for (;;) {
        const nl = s.indexOf('\n', from);
        if (nl < 0) { keep(from ? s.slice(from) : s); break; }
        if (skipping) skipping = false;
        else take(out, s.slice(from, nl));
        from = nl + 1;
      }
      return out;
    },
    end() {
      const out = [];
      take(out, '');
      skipping = false;
      return out;
    },
    get long() { return long; }
  };
}

/* ────────────────────────────────────────────────────────
   3. docId 바꿔 쓰기 (9c-D3 — 같은 fileHash 가 이 기기에 다른 id 로 있을 때만)
   ──────────────────────────────────────────────────────── */

function mapOf(remap) {
  if (remap instanceof Map) return remap;
  return new Map(Object.entries(remap || {}));
}

/** `{docId}:…` 꼴 id 의 앞 칸만 바꾼다. */
function remapPrefixed(id, m) {
  if (typeof id !== 'string') return id;
  const at = id.indexOf(':');
  if (at <= 0) return id;
  const head = id.slice(0, at);
  return m.has(head) ? m.get(head) + id.slice(at) : id;
}

/**
 * 17-4-1 5 — 레코드 하나의 docId 를 바꿔 쓴다. 바꿀 것이 없으면 **같은 객체**를 돌려준다.
 * `aiCache.key` 는 `kind|target|docId|해시[|extra]` 의 셋째 칸만(해시·`w=낱말` 은 그대로).
 * @param {string} store
 * @param {Object} rec
 * @param {Map<string,string>|Object<string,string>} remap 옛 id → 이 기기 id
 * @returns {Object}
 */
export function remapRecord(store, rec, remap) {
  if (!rec || typeof rec !== 'object') return rec;
  const m = mapOf(remap);
  if (!m.size) return rec;
  const out = Object.assign({}, rec);
  let changed = false;
  const swapField = (f) => {
    if (typeof out[f] === 'string' && m.has(out[f])) { out[f] = m.get(out[f]); changed = true; }
  };
  switch (store) {
    case 'documents':
      swapField('id');
      break;
    case 'aiCache': {
      swapField('docId');
      if (typeof out.key === 'string') {
        const parts = out.key.split('|');
        if (parts.length >= 4 && m.has(parts[2])) { parts[2] = m.get(parts[2]); out.key = parts.join('|'); changed = true; }
      }
      break;
    }
    case 'questions': {
      swapField('docId');
      const id = remapPrefixed(out.id, m);
      if (id !== out.id) { out.id = id; changed = true; }
      break;
    }
    case 'attempts': {
      swapField('docId');
      if (Array.isArray(out.items)) {
        let any = false;
        const items = out.items.map((it) => {
          if (!it || typeof it !== 'object') return it;
          const q = remapPrefixed(it.questionId, m);
          if (q === it.questionId) return it;
          any = true;
          return Object.assign({}, it, { questionId: q });
        });
        if (any) { out.items = items; changed = true; }
      }
      break;
    }
    case 'mistakes': {
      swapField('docId');
      const q = remapPrefixed(out.questionId, m);
      if (q !== out.questionId) { out.questionId = q; changed = true; }
      break;
    }
    case 'progress':
    case 'cards':        // `[12-1b]` 문장 카드 id 는 문서 `fileHash` 바탕(docId 가 아님 — srs/cards.js `sentenceDocKey`)이라 바꿀 것이 없다 — `docId` 만
    case 'annotations':
      swapField('docId');
      break;
    default:
      break;
  }
  return changed ? out : rec;
}

/* ────────────────────────────────────────────────────────
   4. 병합 (9c-D4 — 병합만, 지우지 않음, 스토어별 규칙, 멱등)

   돌려주는 것:
     {op:'add', value}    기기에 없다 — 넣는다
     {op:'put', value}    기기 레코드를 통째로 바꾼다
     {op:'patch', patch}  기기 레코드의 필드만(documents·cards term — 가져오기는 `db.patch` 안에서 다시 부른다)
     {op:'keep'}          기기 것 그대로
     {op:'skip', reason}  넣지 않는다(허용 목록 밖·키 모양·원서 문항·꼴이 틀림)
   ──────────────────────────────────────────────────────── */

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

/** 깊은 같음(JSON 값만 — 이 앱 레코드의 꼴). */
export function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameValue(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!sameValue(a[k], b[k])) return false;
  return true;
}

/** 시각 값 → ms(숫자·ISO). 못 읽으면 0. */
function timeOf(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string' && v) { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; }
  return 0;
}

function empty(v) {
  return v === undefined || v === null || (Array.isArray(v) && v.length === 0);
}

/** documents — 기기 레코드의 필드만 고친다(17-4-1 5 표). */
function mergeDoc(mine, theirs) {
  const p = {};
  // 읽던 자리 — 마지막으로 연 시각이 늦은 쪽(그 시각도 함께 — 서재 순서·다음 비교가 같은 값을 본다)
  if (timeOf(theirs.lastOpenedAt) > timeOf(mine.lastOpenedAt)) {
    if (theirs.lastPage !== undefined && theirs.lastPage !== mine.lastPage) p.lastPage = theirs.lastPage;
    if (theirs.lastLineId !== undefined && theirs.lastLineId !== mine.lastLineId) p.lastLineId = theirs.lastLineId;
    p.lastOpenedAt = theirs.lastOpenedAt;
  }
  // 원문 언어 — 파일이 사용자가 고른 것이고 기기는 아니면
  if (theirs.langSource === 'user' && mine.langSource !== 'user') {
    for (const k of ['lang', 'langSource', 'langGuess']) {
      if (theirs[k] !== undefined && !sameValue(theirs[k], mine[k])) p[k] = theirs[k];
    }
  }
  if (empty(mine.domain) && !empty(theirs.domain)) p.domain = theirs.domain;
  const rp = (x) => num(x && x.pages);
  if (theirs.readStats && typeof theirs.readStats === 'object' && rp(theirs.readStats) > rp(mine.readStats)) p.readStats = theirs.readStats;
  // PDF 에서 온 것 — 기기에 없을 때만(`outlineV` 는 `outline` 과 한 묶음)
  if (empty(mine.outline) && !empty(theirs.outline)) {
    p.outline = theirs.outline;
    if (theirs.outlineV !== undefined) p.outlineV = theirs.outlineV;
  }
  for (const k of ['pageLabels', 'scan', 'columnsHint']) {
    if (empty(mine[k]) && !empty(theirs[k])) p[k] = theirs[k];
  }
  return Object.keys(p).length ? { op: 'patch', patch: p } : { op: 'keep' };
}

/** usage — 같은 날이면 필드별 큰 값(수), 불리언은 OR(`capWarned` — 8c2R), 객체는 안으로. 같은 파일 두 번 = 한 번. */
function maxMerge(a, b) {
  if (typeof a === 'number' || typeof b === 'number') {
    if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
    return typeof a === 'number' ? a : b;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return a === true || b === true;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const out = Object.assign({}, a);
    for (const k of Object.keys(b)) out[k] = Object.prototype.hasOwnProperty.call(a, k) ? maxMerge(a[k], b[k]) : b[k];
    return out;
  }
  return a === undefined ? b : a;
}

/** 정수 쪽 구간 합집합 — `[[a,b]…]`, 붙은 구간도 하나로. */
export function unionRanges(x, y) {
  const all = [];
  for (const r of [].concat(Array.isArray(x) ? x : [], Array.isArray(y) ? y : [])) {
    if (!Array.isArray(r) || r.length < 2) continue;
    const a = Math.floor(Number(r[0]));
    const b = Math.floor(Number(r[1]));
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    all.push(a <= b ? [a, b] : [b, a]);
  }
  all.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const out = [];
  for (const r of all) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

/** progress — `updatedAt` 늦은 쪽. `sectionId:'@read'`(13 — 읽은 쪽)는 구간 합집합. */
function mergeProgress(mine, theirs) {
  if (theirs.sectionId === '@read' && (Array.isArray(mine.ranges) || Array.isArray(theirs.ranges))) {
    const ranges = unionRanges(mine.ranges, theirs.ranges);
    const pages = ranges.reduce((n, r) => n + (r[1] - r[0] + 1), 0);
    const updatedAt = Math.max(num(mine.updatedAt), num(theirs.updatedAt));
    const next = Object.assign({}, mine, { ranges: ranges, pages: pages, updatedAt: updatedAt });
    return sameValue(next, mine) ? { op: 'keep' } : { op: 'put', value: next };
  }
  return num(theirs.updatedAt) > num(mine.updatedAt) ? { op: 'put', value: theirs } : { op: 'keep' };
}

/** 단어장 항목 → `importPlan` 이 읽는 CSV 행 꼴(열 이름은 `importPlan` 과 같은 config 표 `VOCAB.CSV_COL` 에서). 시각은 ms 숫자 그대로. */
/** 시각 칸 → ms 숫자(못 읽으면 `''` — `importPlan` 이 "시각 못 읽음"으로 본다). */
function msOrEmpty(v) {
  return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : '';
}

function termRow(rec) {
  const C = VOCAB.CSV_COL;
  const ms = msOrEmpty;
  const row = {};
  row[C.surface] = rec.surface || rec.term || '';
  for (const f of ['translation', 'pos', 'gloss', 'context', 'contextTr', 'note', 'docTitle', 'srcLang', 'targetLang']) {
    row[C[f]] = rec[f] == null ? '' : rec[f];
  }
  row[C.pageNo] = rec.pageNo == null ? '' : rec.pageNo;
  row[C.createdAt] = ms(rec.createdAt);
  row[C.updatedAt] = ms(rec.updatedAt);
  row[C.id] = rec.id == null ? '' : String(rec.id);
  return row;
}

/**
 * cards `kind:'term'` — 8f `importPlan` 을 **그대로 부른다**(id → 그다음 `term`+`targetLang`, 내용이 다르면 `updatedAt` 늦은 쪽).
 * 백업에는 미리보기 고르기가 없다 → `importPlan` 의 충돌(`conflict` — 시각을 못 읽음·미래 시각)·거절은 **기기 값 유지**.
 * `[9c-1b]` 파일 `updatedAt` = 기기 `updatedAt` 이면 내용은 **기기 값 유지**(`importPlan` 을 부르지 않음 — CSV 의 "같음 = 파일" 규칙은 백업 갈래에서만 뺀다).
 * 내용이 파일 쪽으로 바뀌면 `edited` 는 파일 항목의 값(AI 번역이 더 새로우면 "고침" 표시가 붙지 않게).
 * 복습 필드(`sm2`·`dueAt`·`reviewedAt`·`introducedAt`)는 내용과 따로 — 파일 쪽 `reviewedAt` 이 늦을 때만(12-1 `srs/cards.js` `review` 가 쓴다).
 * `[12-1]` 멈춤(`suspended`·`suspendedAt`)도 따로 — 파일 쪽 `suspendedAt` 이 늦을 때만(없으면 기기 — 9c-1 의 "내용 밖 필드는 기기" 그대로).
 */
function mergeTerm(mine, theirs, o) {
  if (mine.kind !== 'term') return { op: 'keep' };
  const p = {};
  // `[9c-1b — 9c1R #1]` 내용 시각이 **같으면 기기**(문장 카드·필기·문서와 같게). CSV `importPlan` 은 같음 = 파일(엑셀에서 칸만 고친
  // 파일)이지만, 백업은 같은 기기 왕복이 흔하다 — 같은 시각에 내용이 다르면 파일 쪽이 손상(옛 지우개 `[KEY]` 등)일 수 있다.
  const tf = msOrEmpty(theirs.updatedAt);
  const sameTime = tf !== '' && tf === msOrEmpty(mine.updatedAt);
  const plan = sameTime ? null : importPlan([termRow(theirs)], [mine], { nowMs: num(o.nowMs) });
  if (plan && plan.change.length === 1) {
    Object.assign(p, plan.change[0].patch);
    if (Object.prototype.hasOwnProperty.call(p, 'edited')) p.edited = !!theirs.edited;
  }
  laterGroup(p, mine, theirs, 'reviewedAt', TERM_REVIEW_FIELDS);
  laterGroup(p, mine, theirs, 'suspendedAt', SUSPEND_FIELDS);
  return Object.keys(p).length ? { op: 'patch', patch: p } : { op: 'keep' };
}

/** `[12-1]` 멈춤(`suspended`)과 그 시각 — 내용·복습과 따로 `suspendedAt` 늦은 쪽(8f1R — `updatedAt` 을 올리지 않는 필드가 지지 않게). */
const SUSPEND_FIELDS = Object.freeze(['suspended', 'suspendedAt']);

/** 파일 쪽 `clock` 시각이 더 늦으면 `fields` 중 기기와 다른 값을 `p` 에 담는다(같거나 없으면 기기 — 멱등). */
function laterGroup(p, mine, theirs, clock, fields) {
  if (!(num(theirs[clock]) > num(mine[clock]))) return;
  for (const k of fields) if (theirs[k] !== undefined && !sameValue(theirs[k], mine[k])) p[k] = theirs[k];
}

/**
 * `[12-1 — 9c1R #8]` 문장 카드(그 밖 `kind`) — 레코드를 통째로 고르지 않고 **세 묶음을 따로** 늦은 쪽으로(같으면 기기):
 *   내용(아래 둘을 뺀 모든 필드) ← `updatedAt` · 복습 상태(`sm2`·`dueAt`·`reviewedAt`·`introducedAt`) ← `reviewedAt` ·
 *   멈춤(`suspended`·`suspendedAt`) ← `suspendedAt`.
 * 그래서 다른 기기에서 뒷면만 고친 파일이 이 기기의 더 최근 복습 상태를 옛것으로 덮지 않는다. 같은 파일 두 번 = 한 번(늦은 쪽 시각이 같아진다).
 * `[12-1c — 12-1bR #1]` 내용 묶음의 이긴 쪽: ② 만든 뒤 고치지 않은 카드(`updatedAt <= createdAt`)는 고친 카드를 이기지 못한다
 * (둘 다 같은 꼴이면 지금처럼 `updatedAt` 늦은 쪽, 같으면 기기). ① 글자 내용(`back`·`note`·`explain`)은 필드마다 **빈 값이 비지 않은
 * 값을 지우지 않는다** — 이긴 쪽이 비었으면 진 쪽 값을 남기고(파일이 이겨도 기기 값 유지, 기기가 이겨도 빈 칸은 파일 값으로 채움).
 * 채움은 `updatedAt` 을 올리지 않는다(멱등 — 두 번째엔 빈 칸이 없다). 대가: 일부러 비운 글자는 다른 기기의 옛 값으로 다시 찬다.
 */
const SENTENCE_TEXT_FIELDS = Object.freeze(['back', 'note', 'explain']);

function blankText(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

/** 만든 뒤 내용을 고쳤나 — 두 시각이 숫자로 있고 `updatedAt <= createdAt` 이면 "안 고침". 모르면(옛·특이 레코드) 고친 것으로 본다(지금 규칙). */
function sentenceEdited(c) {
  const cr = Number(c.createdAt);
  const up = Number(c.updatedAt);
  if (!Number.isFinite(cr) || !Number.isFinite(up) || cr <= 0) return true;
  return up > cr;
}

function mergeSentence(mine, theirs) {
  if (mine.kind !== theirs.kind) return { op: 'keep' };
  const p = {};
  const mineEdited = sentenceEdited(mine);
  const theirsEdited = sentenceEdited(theirs);
  const theirsWins = mineEdited !== theirsEdited ? theirsEdited : num(theirs.updatedAt) > num(mine.updatedAt);
  if (theirsWins) {
    const skip = new Set(['id', 'kind'].concat(TERM_REVIEW_FIELDS, SUSPEND_FIELDS));
    for (const k of Object.keys(theirs)) {
      if (skip.has(k) || theirs[k] === undefined || sameValue(theirs[k], mine[k])) continue;
      if (SENTENCE_TEXT_FIELDS.indexOf(k) >= 0 && blankText(theirs[k]) && !blankText(mine[k])) continue;
      p[k] = theirs[k];
    }
  } else {
    // `[12-1d — 12-1cR #1]` 내용 시각이 같은 자리(같은 꼴·같은 `updatedAt` — "같으면 기기")에서 글자 칸이 둘 다 비지 않고 다르면
    // 기기·순서와 무관하게 **문자열이 큰 쪽**(UTF-16 코드 단위 비교)을 고른다 — 채움이 시각을 올리지 않아 세 기기 이상에서
    // 같은 시각·다른 글자로 영영 남던 꼴을 막는다(교환·결합·멱등 → 수렴). 지는 값은 원래도 "같으면 기기"에서 진 쪽.
    const tie = mineEdited === theirsEdited && num(theirs.updatedAt) === num(mine.updatedAt);
    for (const k of SENTENCE_TEXT_FIELDS) {
      if (blankText(mine[k])) { if (!blankText(theirs[k])) p[k] = theirs[k]; }
      else if (tie && !blankText(theirs[k]) && String(theirs[k]) > String(mine[k])) p[k] = theirs[k];
    }
  }
  laterGroup(p, mine, theirs, 'reviewedAt', TERM_REVIEW_FIELDS);
  laterGroup(p, mine, theirs, 'suspendedAt', SUSPEND_FIELDS);
  return Object.keys(p).length ? { op: 'patch', patch: p } : { op: 'keep' };
}

/**
 * 17-4-1 5 — 같은 레코드가 기기에 있을 때(없으면 `mine` 은 null)의 규칙. 순수 — 넘긴 객체를 고치지 않는다.
 * @param {string} store
 * @param {Object|null} mine  이 기기 레코드(cards term 은 가져오기가 id → `term`+`targetLang` 으로 찾은 것)
 * @param {Object} theirs     파일 레코드(이미 `remapRecord` 를 거친 것)
 * @param {{nowMs?:number, docReset?:Object}} [opts] `docReset` — 새 문서에 덮을 파생 필드 처음 값(`db.derivedDocReset()`)
 * @returns {{op:'add'|'put', value:Object}|{op:'patch', patch:Object}|{op:'keep'}|{op:'skip', reason:string}}
 */
export function mergeRecord(store, mine, theirs, opts) {
  const o = opts || {};
  if (!theirs || typeof theirs !== 'object') return { op: 'skip', reason: 'shape' };
  const has = mine !== null && mine !== undefined;
  switch (store) {
    case 'documents': {
      const d = docForBackup(theirs);
      if (!d) return { op: 'skip', reason: 'shape' };
      if (!has) return { op: 'add', value: Object.assign({}, d, o.docReset || {}) };
      return mergeDoc(mine, d);
    }
    case 'settings': {
      if (!settingAllowed(theirs.key)) return { op: 'skip', reason: 'not-allowed' };
      if (theirs.value === undefined || hasKeyShape(theirs.value)) return { op: 'skip', reason: 'key-shape' };
      const v = { key: theirs.key, value: theirs.value };
      if (!has) return { op: 'add', value: v };
      return sameValue(mine.value, theirs.value) ? { op: 'keep' } : { op: 'put', value: v };
    }
    case 'usage': {
      if (!has) return { op: 'add', value: theirs };
      const next = maxMerge(mine, theirs);
      next.day = mine.day;
      return sameValue(next, mine) ? { op: 'keep' } : { op: 'put', value: next };
    }
    case 'progress':
      return has ? mergeProgress(mine, theirs) : { op: 'add', value: theirs };
    case 'attempts':
      return has ? { op: 'keep' } : { op: 'add', value: theirs };
    case 'mistakes':
      if (!has) return { op: 'add', value: theirs };
      return mine.resolvedAt == null && theirs.resolvedAt != null ? { op: 'put', value: theirs } : { op: 'keep' };
    case 'questions':
      if (theirs.source !== 'ai') return { op: 'skip', reason: 'derived' };
      return has ? { op: 'keep' } : { op: 'add', value: theirs };
    case 'cards':
      if (!has) return { op: 'add', value: theirs };
      if (theirs.kind === 'term') {
        // id 는 같은데 대상 언어가 다른 꼴(손댄 파일) — importPlan 이 새 항목으로 보지만 같은 id 를 덮게 된다 → 기기 것
        if (mine.id === theirs.id && mine.targetLang !== theirs.targetLang) return { op: 'keep' };
        return mergeTerm(mine, theirs, o);
      }
      return mergeSentence(mine, theirs);
    case 'annotations':
      if (!has) return { op: 'add', value: theirs };
      return num(theirs.updatedAt) > num(mine.updatedAt) ? { op: 'put', value: theirs } : { op: 'keep' };
    case 'aiCache':
      // 같은 키 = 같은 입력의 번역 — 어느 쪽도 맞다. 기기 것(`hits`·`createdAt`)을 지킨다.
      return has ? { op: 'keep' } : { op: 'add', value: theirs };
    default:
      return { op: 'skip', reason: 'store' };
  }
}

/* ────────────────────────────────────────────────────────
   5. 화면 한 줄 · 파일 이름
   ──────────────────────────────────────────────────────── */

/** 그 시각이 속한 날(지역 시간)의 0시 ms. */
function dayStart(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * "마지막 백업" 한 줄의 상태(9c-D8). 날 수는 **달력 날**(지역 시간) — 어제 밤 백업은 오늘 아침 "1일 전".
 * @param {*} lastMs `backup.lastExportAt`(ms 또는 ISO, null)
 * @param {number} nowMs
 * @returns {{state:'never'}|{state:'today', days:0, stale:false}|{state:'days', days:number, stale:boolean}}
 */
export function backupAge(lastMs, nowMs) {
  const last = timeOf(lastMs);
  if (!last) return { state: 'never' };
  const days = Math.max(0, Math.round((dayStart(num(nowMs)) - dayStart(last)) / 86400000));
  if (days === 0) return { state: 'today', days: 0, stale: false };
  return { state: 'days', days: days, stale: days > BACKUP.STALE_DAYS };
}

/**
 * `medreader-backup-YYYYMMDD-HHmm.jsonl.gz`(압축이 없으면 `.jsonl`) — 지역 시간.
 * @param {number} nowMs
 * @param {boolean} gz
 */
export function backupFileName(nowMs, gz) {
  const d = new Date(num(nowMs));
  const p = (n) => (n < 10 ? '0' + n : String(n));
  return BACKUP.FILE_PREFIX + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) +
    (gz ? '.jsonl.gz' : '.jsonl');
}
