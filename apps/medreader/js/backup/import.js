/* ══════════════════════════════════════════════════════════════════════
   backup/import.js — 백업 가져오기 서비스 (spec 17-4-1 5 — 9c-2)

   서비스 계층이다. `config`·`db`·`hash`·`text/*` 만 import 한다(17-4-1 7 — `backup/export.js` 와 같은 행).
   ★ 키 저장소·AI·화면 모듈은 **import 하지 않는다**(정적 시험). 다시 불러오기·파일 고르기·떠나기 확인은 화면(`ui/backup.js`) 몫.
   ★ 병합만 — 지우지 않는다(9c-D4). 같은 파일을 다시 넣어도 결과가 같다(멱등) — 끊긴 가져오기는 같은 파일로 처음부터 다시 하면 이어진다.
   ★ 흐름 읽기(9c-D6): `file.stream()` → (첫 두 바이트가 `1f 8b` 면) `DecompressionStream('gzip')` → `TextDecoderStream`(**엄격** —
     깨진 UTF-8 은 그 자리에서 멈춘다: 앞 줄들은 들어가고 결과에 `broken`) → `lineSplitter`(줄 길이 상한) → 줄마다 `JSON.parse` →
     `BACKUP.IMPORT_BATCH`(500) 줄마다 **트랜잭션 하나**. 힙에는 한 묶음만 남는다.
   ★ 기기 값을 조용히 덮지 않는다(8f-3b 원칙): 레코드마다 **쓰는 그 readwrite 트랜잭션 안에서** 기기 레코드를 읽고 `mergeRecord` 를
     부른다(`db.patch` 와 같은 보장 — 읽기와 쓰기 사이에 다른 쓰기가 끼어들 수 없다). `documents` 도 같은 트랜잭션 안에서 맞춘다.
   ══════════════════════════════════════════════════════════════════════ */

import * as realDb from '../db.js';
import { BACKUP, LINKS, SEARCH, SRS } from '../config.js';
import { hasSubtle } from '../hash.js';
import { TERM_CONTENT_FIELDS } from '../text/vocab.js';
import { lineSplitter, readHead, parseLine, remapRecord, mergeRecord, hasKeyShape } from '../text/backup.js';

/** 한 묶음 트랜잭션이 여는 스토어 — 파일에 담기는 스토어 전부(17-4-1 2). */
const TX_STORES = BACKUP.STORES.slice();
const STORE_SET = new Set(TX_STORES);

/** 미리보기의 "약 n MB" — 머리 줄에는 캐시 바이트가 없다(개수만). 기기 캐시가 없을 때 쓰는 레코드당 크기(`sizeBytes` 셈, 합성 실측 약 1.4KB). */
export const EST_CACHE_REC_BYTES = 1500;

/** 평문 파일 끝에서 끝 줄을 찾을 때 읽는 바이트(끝 줄은 개수 몇 개 — 작다). */
const TAIL_BYTES = 64 * 1024;

/** 18 의료 사이트 항목 id 꼴(`ui/links.js` 가 `data-id="…"` 선택자에 넣는다 — 줄바꿈·따옴표·역슬래시가 들면 선택자 예외). */
const LINK_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/* ────────────────────────────────────────────────────────
   1. 순수 도우미 (시험이 직접 잰다)
   ──────────────────────────────────────────────────────── */

/**
 * 파일의 문서를 이 기기에서 찾을 `fileHash` 후보 — 그대로 · (변형 키면) 바탕 해시 · 바탕 + 이 문서 쪽수의 변형 키.
 * 변형 키 꼴은 `ui/library.js` `variantIdentity`(`해시:n쪽수`)와 같다 — 서비스는 화면 모듈을 import 하지 않으므로 같은 꼴을 여기 적는다.
 * @param {string} fileHash
 * @param {number} pageCount
 * @returns {{list:string[], base:string|null, variant:string|null}}
 */
export function docHashCandidates(fileHash, pageCount) {
  if (typeof fileHash !== 'string' || !fileHash) return { list: [], base: null, variant: null };
  const base = fileHash.replace(/:n\d+$/, '');
  const n = Number(pageCount) || 0;
  const variant = n > 0 ? base + ':n' + n : null;
  const list = [fileHash];
  if (base !== fileHash) list.push(base);
  if (variant && list.indexOf(variant) < 0) list.push(variant);
  return { list: list, base: base, variant: variant };
}

/** 같은 PDF 로 볼 수 있는가 — 쪽수가 같거나 한쪽이 모른다(0). `identityFor` 의 2차 방벽과 같은 판단. */
export function samePdf(dev, fileDoc) {
  const a = Number(dev && dev.pageCount) || 0;
  const b = Number(fileDoc && fileDoc.pageCount) || 0;
  return !a || !b || a === b;
}

/** 객체·배열 안 **속성 이름**이 키 모양이면 그 속성을 뺀다(9c1R #3 — 내보내기 지우개는 값만 본다). 바뀐 것이 없으면 같은 객체. */
function dropKeyNames(v, depth) {
  if (!v || typeof v !== 'object' || depth > 32) return v;
  if (Array.isArray(v)) {
    let out = null;
    for (let i = 0; i < v.length; i++) {
      const x = dropKeyNames(v[i], depth + 1);
      if (x !== v[i]) { if (!out) out = v.slice(); out[i] = x; }
    }
    return out || v;
  }
  let out = null;
  for (const k of Object.keys(v)) {
    if (hasKeyShape(k)) { if (!out) out = Object.assign({}, v); delete out[k]; continue; }
    const x = dropKeyNames(v[k], depth + 1);
    if (x !== v[k]) { if (!out) out = Object.assign({}, v); out[k] = x; }
  }
  return out || v;
}

/**
 * `links.medical` 항목 id 고치기(crossstep 18R-8) — 꼴이 틀린 id(줄바꿈·제어 문자·따옴표·역슬래시·빈 값·64자 넘음·겹침)는
 * **결정적인** 새 id(`i{번호}`)로 바꾼다. 같은 파일을 다시 넣으면 같은 값이 된다(멱등). 바꿀 것이 없으면 같은 배열.
 * @param {*} list
 * @returns {*}
 */
export function cleanLinkIds(list) {
  if (!Array.isArray(list)) return list;
  const used = new Set();
  for (const it of list) if (it && typeof it === 'object' && typeof it.id === 'string' && LINK_ID_RE.test(it.id)) used.add(it.id);
  const seen = new Set();
  let out = null;
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (!it || typeof it !== 'object') continue;
    const ok = typeof it.id === 'string' && LINK_ID_RE.test(it.id) && !seen.has(it.id);
    if (ok) { seen.add(it.id); continue; }
    let id = 'i' + i;
    while (used.has(id) || seen.has(id)) id += '_';
    seen.add(id);
    if (!out) out = list.slice();
    out[i] = Object.assign({}, it, { id: id });
  }
  return out || list;
}

/* ── `[9c-3 — 9c-2 Review 9c2R #2·#3]` 가져온 값의 타입·범위 · 사용자 목록 설정은 합집합 ───────────── */

/** 값의 꼴 이름 — `null`·`array`·`number`(유한)·그 밖 `typeof`. */
function kindOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isFinite(v) ? 'number' : 'bad';
  return typeof v;
}

/**
 * 설정 값이 그 키의 기본값(`settings.js` `DEFAULTS`)과 같은 꼴인가 — 손댄 파일의 `reader.fontSize:'huge'`·`ai.dailyCap:'unlimited'` 를 막는다.
 * 기본값이 `null` 인 키(`ui.lang`·`vocab.lastExportAt`·`links.medical`)는 "아직 없음"이라 null·글자·유한한 수·배열을 받는다(객체·불리언은 아님).
 * `defaults` 를 넘기지 않으면 보지 않는다(서비스는 `settings.js` 를 import 하지 않는다 — 화면이 넘긴다).
 * @returns {boolean}
 */
export function settingTypeOk(key, value, defaults) {
  if (!defaults || typeof defaults !== 'object') return true;
  if (!Object.prototype.hasOwnProperty.call(defaults, key)) return false;
  const want = kindOf(defaults[key]);
  const got = kindOf(value);
  if (got === 'bad' || got === 'undefined') return false;
  if (want === 'null') return got === 'null' || got === 'string' || got === 'number' || got === 'array';
  return got === want;
}

/**
 * 사용자 목록 설정을 **합집합**으로(9c2R #2 — 파일 값으로 통째 덮으면 이 기기에만 있던 의료 사이트·최근 검색어가 사라진다). 순수.
 * - `links.medical`: 둘 다 사용자 목록(배열)이면 **기기 순서 먼저** + 파일 항목 중 주소가 겹치지 않는 것 · `LINKS.MAX`(30)개까지 · 겹친 id 는
 *   `cleanLinkIds` 의 결정적 새 id. 기기가 `null`(= 기본 목록 — 손대지 않음)이면 파일 값 그대로(새 휴대폰), 파일이 `null` 이면 기기 그대로.
 * - `search.recent`: 기기 먼저 + 파일의 새 글자 · `SEARCH.RECENT_MAX` 개까지.
 * - `[12-1]` `srs.log`: 날짜 합집합 · 같은 날 칸마다 큰 값(`unionLog`).
 * 같은 파일을 두 번 넣어도 같다(이미 들어간 항목은 겹침으로 빠진다). 그 밖 키는 파일 값 그대로(덮기).
 * @returns {*} 쓸 값(기기와 깊게 같으면 병합이 `keep`)
 */
export function unionSetting(key, mine, theirs) {
  if (key === 'links.medical' || key === 'search.recent') {
    if (!Array.isArray(mine)) return theirs;          // 기기 = 기본 목록(null — 손대지 않음) → 파일 값
    if (!Array.isArray(theirs)) return mine;          // 파일 = 기본 목록(또는 꼴이 틀림) → 기기 그대로
  }
  if (key === 'links.medical') {
    const seen = new Set();
    const out = [];
    const urlOf = (it) => (it && typeof it === 'object' && typeof it.url === 'string' ? it.url.trim() : null);
    for (const it of mine) { const u = urlOf(it); if (u !== null) seen.add(u); out.push(it); }
    for (const it of theirs) {
      const u = urlOf(it);
      if (u === null || seen.has(u)) continue;
      seen.add(u);
      out.push(it);
    }
    return cleanLinkIds(out.slice(0, LINKS.MAX));
  }
  if (key === 'search.recent') {
    const out = [];
    for (const q of [].concat(mine, theirs)) if (typeof q === 'string' && q && out.indexOf(q) < 0) out.push(q);
    return out.slice(0, SEARCH.RECENT_MAX);
  }
  if (key === 'srs.log') return unionLog(mine, theirs);
  return theirs;
}

/**
 * `[12-1]` 기억 카드 하루 기록(`srs.log` — `{'YYYY-MM-DD': {n, ms, new}}`)은 학습 기록이다 — 파일 값으로 덮으면 이 기기에만 있던 날이 사라진다.
 * 날짜 합집합, 같은 날은 칸마다 큰 값(사용량 행과 같은 규칙 — 같은 파일 두 번 = 한 번), 최근 `SRS.LOG_DAYS` 날만(날짜 키 순).
 * 한쪽이 객체가 아니면 다른 쪽 그대로.
 */
function unionLog(mine, theirs) {
  const ok = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!ok(mine)) return theirs;
  if (!ok(theirs)) return mine;
  const out = {};
  const days = [...new Set(Object.keys(mine).concat(Object.keys(theirs)))].filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-SRS.LOG_DAYS);
  const n = (x) => (Number.isFinite(Number(x)) ? Math.max(0, Number(x)) : 0);
  for (const k of days) {
    const a = ok(mine[k]) ? mine[k] : {};
    const b = ok(theirs[k]) ? theirs[k] : {};
    out[k] = { n: Math.max(n(a.n), n(b.n)), ms: Math.max(n(a.ms), n(b.ms)), new: Math.max(n(a.new), n(b.new)) };
  }
  return out;
}

/** 시각 값(ms 숫자·ISO 글자)이 `nowMs` 보다 늦은가. 못 읽으면 false. */
function isFuture(v, nowMs) {
  const t = typeof v === 'number' ? v : typeof v === 'string' && v ? Date.parse(v) : NaN;
  return Number.isFinite(t) && t > nowMs;
}

/**
 * `[9c-3b — 9c3R #1]` 파일 문서의 **미래 시각**(이 기기 `nowMs` 보다 늦음 — 시계가 앞선 기기에서 만든 파일·손댄 파일) 다루기. 순수.
 * - 새 문서(`isNew`): `lastOpenedAt`·`addedAt` 을 지금으로 자른다(미래 시각이 서재 맨 위를 차지하지 않게).
 * - 기기에 있는 문서: 미래 `lastOpenedAt` 은 읽던 자리 비교에서 **기기 값 유지**(단어장 8f-3b "미래 시각 = 충돌 → 기기"와 같은 결) —
 *   `lastOpenedAt`·`lastPage`·`lastLineId` 를 빼고 병합한다. 지금으로 자르면 가져올 때마다 "지금"이 달라 늘 기기보다 새로워진다
 *   (같은 파일 두 번 ≠ 한 번 · 그사이 이 기기에서 더 읽은 진도가 파일 쪽으로 되돌아감).
 * 바꿀 것이 없으면 같은 객체.
 * @param {Object} v 파일 문서(`cleanRecord` 를 거친 것)
 * @param {number} nowMs
 * @param {boolean} isNew 이 기기에 같은 문서가 없다
 * @returns {Object}
 */
export function docTimesFor(v, nowMs, isNew) {
  if (!v || typeof v !== 'object' || !Number.isFinite(Number(nowMs))) return v;
  const now = Number(nowMs);
  if (isNew) {
    const p = {};
    for (const k of ['lastOpenedAt', 'addedAt']) if (v[k] !== undefined && isFuture(v[k], now)) p[k] = now;
    return Object.keys(p).length ? Object.assign({}, v, p) : v;
  }
  if (!isFuture(v.lastOpenedAt, now)) return v;
  const x = Object.assign({}, v);
  delete x.lastOpenedAt;
  delete x.lastPage;
  delete x.lastLineId;
  return x;
}

/** 0 이상 정수인가(쪽수) · 1 이상 정수인가(쪽 번호). */
function natural(v, min) { return typeof v === 'number' && Number.isInteger(v) && v >= min; }

/**
 * 가져올 레코드 다듬기 — 키 모양 속성 이름 빼기 · 의료 사이트 id 꼴 ·
 * `[9c-3 — 9c2R #3]` 문서 `lastPage`/`pageCount` 꼴이 틀리면 그 필드를 뺌(미래 시각은 여기서 자르지 않는다 — 새 문서인지 알아야 해서
 * `docStep` 이 `docTimesFor` 로, 9c-3b) ·
 * 설정은 `DEFAULTS` 와 같은 꼴일 때만(아니면 null — 그 줄 건너뜀) · `term` 이 없는 단어장 항목은 null(건너뜀).
 * @param {string} store
 * @param {*} v
 * @param {{nowMs?:number, defaults?:Object}} [o]
 * @returns {*} 다듬은 레코드(넣지 않을 것이면 null)
 */
export function cleanRecord(store, v, o) {
  const opt = o || {};
  let x = dropKeyNames(v, 0);
  if (!x || typeof x !== 'object') return x;
  if (store === 'settings') {
    if (!settingTypeOk(x.key, x.value, opt.defaults)) return null;
    if (x.key === 'links.medical') {
      const fixed = cleanLinkIds(x.value);
      if (fixed !== x.value) x = Object.assign({}, x, { value: fixed });
    }
  } else if (store === 'documents') {
    const drop = [];
    if (x.lastPage !== undefined && x.lastPage !== null && !natural(x.lastPage, 1)) drop.push('lastPage');
    if (x.pageCount !== undefined && x.pageCount !== null && !natural(x.pageCount, 0)) drop.push('pageCount');
    if (drop.length) {
      x = Object.assign({}, x);
      for (const k of drop) delete x[k];
    }
  } else if (store === 'cards' && x.kind === 'term') {
    if (typeof x.term !== 'string' || !x.term.trim()) return null;
  }
  return x;
}

/** 유효한 IndexedDB 키(이 앱이 쓰는 꼴 — 글자·유한한 수·그 배열)인가. 틀린 키로 `put` 하면 묶음 트랜잭션이 통째로 무너진다. */
function validKey(k) {
  if (typeof k === 'string') return true;
  if (typeof k === 'number') return Number.isFinite(k);
  if (Array.isArray(k)) return k.length > 0 && k.every((x) => typeof x === 'string' || (typeof x === 'number' && Number.isFinite(x)));
  return false;
}

function keyPathOf(d, store) {
  const schema = (d.SCHEMA_V1 || realDb.SCHEMA_V1).find((x) => x.name === store);
  return schema ? schema.keyPath : null;
}

function keyOf(keyPath, v) {
  return Array.isArray(keyPath) ? keyPath.map((p) => v[p]) : v[keyPath];
}

/* ────────────────────────────────────────────────────────
   2. 파일 열기 — 흐름(바이트 → 글자)
   ──────────────────────────────────────────────────────── */

/** 첫 두 바이트로 gzip 을 가린다(이름은 믿지 않는다 — 메신저가 풀어 놓고 이름만 남길 수 있다). */
async function isGzip(file) {
  const b = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  return b.length === 2 && b[0] === 0x1f && b[1] === 0x8b;
}

async function openText(file) {
  const gz = await isGzip(file);
  let s = file.stream();
  if (gz) {
    if (typeof DecompressionStream !== 'function') { const e = new Error('no-gzip'); e.code = 'no-gzip'; throw e; }
    s = s.pipeThrough(new DecompressionStream('gzip'));
  }
  // 엄격 디코더 — 깨진 UTF-8 은 대체 글자(U+FFFD)로 조용히 바꾸지 않고 오류로 멈춘다(번역·필기 글자가 몰래 망가지지 않게).
  s = s.pipeThrough(new TextDecoderStream('utf-8', { fatal: true }));
  return { reader: s.getReader(), gz: gz };
}

function cancel(reader) {
  try { const p = reader.cancel(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 이미 닫힘 */ }
}

/** 첫 줄(머리 줄)만 읽는다. */
async function readFirstLine(file) {
  const src = await openText(file);
  const sp = lineSplitter();
  try {
    for (;;) {
      const r = await src.reader.read();
      if (r.done) { const l = sp.end(); return { line: l[0] || null, gz: src.gz }; }
      const ls = sp.push(r.value);
      if (ls.length) return { line: ls[0], gz: src.gz };
      if (sp.long) return { line: null, gz: src.gz };
    }
  } finally {
    cancel(src.reader);
  }
}

/** 평문 파일이 끝 줄로 끝나는가(true) · 아닌가(false). gzip 은 끝까지 풀어야 알 수 있다 → null(가져오기가 끝에 알린다). */
async function hasEndLine(file, gz) {
  if (gz) return null;
  const size = Number(file.size) || 0;
  const text = await file.slice(Math.max(0, size - TAIL_BYTES), size).text();
  const ls = text.split('\n');
  for (let i = ls.length - 1; i >= 0; i--) {
    const l = ls[i].replace(/\r$/, '');
    if (!l.trim()) continue;
    return parseLine(l).kind === 'end';
  }
  return false;
}

/* ────────────────────────────────────────────────────────
   3. 미리보기 — 머리 줄과 문서 목록만(본문을 훑지 않는다, 17-4-1 5)
   ──────────────────────────────────────────────────────── */

/** 이 기기에서 그 문서를 찾는다(트랜잭션 밖 — 미리보기 몫). */
async function findDocOnDevice(d, fd) {
  if (!fd || fd.id == null) return null;
  const same = await d.get('documents', fd.id);
  if (same) return same;
  for (const c of docHashCandidates(fd.fileHash, fd.pageCount).list) {
    const hit = await d.findByFileHash(c);
    if (hit && samePdf(hit, fd)) return hit;
  }
  return null;
}

/**
 * 가져오기 전 미리보기.
 * @param {Blob} file
 * @param {{db?:Object}} [opts]
 * @returns {Promise<{ok:false, code:'not-backup'|'newer'|'read'|'no-gzip'}|{ok:true, gz:boolean, head:Object, createdAt:string,
 *   include:{cache:boolean, settings:boolean}, counts:Object<string,number>, docs:{total:number, existing:number, fresh:number},
 *   hashMismatch:boolean, truncated:boolean|null}>}
 */
export async function previewBackup(file, opts) {
  const d = (opts && opts.db) || realDb;
  let first;
  try { first = await readFirstLine(file); } catch (e) {
    return { ok: false, code: e && e.code === 'no-gzip' ? 'no-gzip' : 'not-backup' };
  }
  if (!first.line) return { ok: false, code: 'not-backup' };
  const h = readHead(first.line);
  if (!h.ok) return { ok: false, code: h.code };
  const head = h.head;
  const docs = Array.isArray(head.docs) ? head.docs : [];
  let existing = 0;
  for (const fd of docs) if (await findDocOnDevice(d, fd)) existing++;
  let truncated = null;
  try { const end = await hasEndLine(file, first.gz); truncated = end === null ? null : !end; } catch (e) { truncated = null; }
  const inc = head.include || {};
  return {
    ok: true, gz: first.gz, head: head, createdAt: String(head.createdAt || ''),
    include: { cache: inc.cache !== false, settings: inc.settings !== false },
    counts: Object.assign({}, head.counts || {}),
    docs: { total: docs.length, existing: existing, fresh: docs.length - existing },
    hashMismatch: head.hash !== (hasSubtle() ? 's256' : 'fnv'),
    truncated: truncated
  };
}

/* ────────────────────────────────────────────────────────
   4. 쓰기 — 묶음 하나 = readwrite 트랜잭션 하나
   ──────────────────────────────────────────────────────── */

function tally(ctx, store, op) {
  const t = ctx.ops[store] || (ctx.ops[store] = { add: 0, put: 0, patch: 0, keep: 0, skip: 0 });
  t[op] = (t[op] || 0) + 1;
}

/** mergeRecord 결과를 그 트랜잭션에 적용한다(`mine` 은 같은 트랜잭션에서 읽은 기기 레코드). */
function apply(st, store, mine, r, ctx) {
  if (r.op === 'add' || r.op === 'put') st.put(r.value);
  else if (r.op === 'patch') st.put(Object.assign({}, mine, r.patch));
  tally(ctx, store, r.op);
}

function reqGet(src, key, ok, fail) {
  const r = src.get(key);
  r.onsuccess = () => ok(r.result);
  r.onerror = () => fail(r.error);
}

/**
 * documents 한 줄 — 같은 id → 같은 `fileHash`(변형 포함, 쪽수가 맞을 때) → 새 문서(원래 id, PDF 필요, 파생 처음 값).
 * 2번이면 `remap[파일 id] = 기기 id`. 새 문서의 `fileHash` 는 이 기기의 서재 가져오기가 같은 PDF 에 매길 값(바탕 해시가 비어 있으면 바탕,
 * 다른 PDF 가 차지하고 있으면 쪽수 변형)으로 둔다 — 그래야 나중에 서재에서 같은 PDF 를 넣으면 이 문서를 찾는다.
 */
function docStep(s, v, ctx, next, fail) {
  const st = s.documents;
  if (typeof v.id !== 'string' || !v.id) { tally(ctx, 'documents', 'skip'); next(); return; }
  reqGet(st, v.id, (cur) => {
    // `[9c-3b]` 기기에 있는 문서 — 파일의 미래 `lastOpenedAt` 은 읽던 자리 비교에서 빠진다(기기 유지 · 멱등)
    const old = docTimesFor(v, ctx.nowMs, false);
    if (cur) { apply(st, 'documents', cur, mergeRecord('documents', cur, old, { nowMs: ctx.nowMs }), ctx); next(); return; }
    const c = docHashCandidates(v.fileHash, v.pageCount);
    const taken = new Map();
    let i = 0;
    const tryNext = () => {
      if (i >= c.list.length) { addNew(); return; }
      const h = c.list[i++];
      reqGet(st.index('fileHash'), h, (hit) => {
        taken.set(h, hit || null);
        if (hit && samePdf(hit, v)) {
          ctx.remap.set(v.id, hit.id);
          const theirs = remapRecord('documents', old, ctx.remap);
          apply(st, 'documents', hit, mergeRecord('documents', hit, theirs, { nowMs: ctx.nowMs }), ctx);
          next();
          return;
        }
        tryNext();
      }, fail);
    };
    const addNew = () => {
      // `[9c-3b]` 새 문서만 미래 시각을 지금으로 자른다
      const r = mergeRecord('documents', null, docTimesFor(v, ctx.nowMs, true), { nowMs: ctx.nowMs, docReset: ctx.docReset });
      if (r.op === 'add' && c.base) {
        r.value.fileHash = !taken.get(c.base) ? c.base : (c.variant || v.fileHash);
        if (taken.get(r.value.fileHash)) { tally(ctx, 'documents', 'skip'); next(); return; }   // 쪽수를 모르는 변형까지 찼다 — 넣지 않는다
      }
      apply(st, 'documents', null, r, ctx);
      next();
    };
    tryNext();
  }, fail);
}

/**
 * cards — id 로 찾고, term 은 그다음 `term` 인덱스 + `targetLang` 으로도 찾는다(다른 기기에서 새로 저장한 같은 낱말은 id 가 다르다 — 8f1R).
 * id 로 찾은 항목의 원어를 파일이 바꿨는데 그 원어가 이 기기의 **다른** 항목과 겹치면(`dup` — importPlan 은 한 항목만 받아 못 본다)
 * 내용은 바꾸지 않는다(복습 필드만).
 */
function cardStep(s, v, ctx, next, fail) {
  const st = s.cards;
  const isTerm = v.kind === 'term';
  const byTerm = (cb) => {
    if (!isTerm || typeof v.term !== 'string' || !v.term) { cb([]); return; }
    const r = st.index('term').getAll(v.term);
    r.onsuccess = () => cb((r.result || []).filter((x) => x && x.kind === 'term' && x.targetLang === v.targetLang));
    r.onerror = () => fail(r.error);
  };
  const finish = (mine, dup) => {
    let r = mergeRecord('cards', mine, v, { nowMs: ctx.nowMs });
    if (dup && r.op === 'patch') {
      const p = {};
      for (const k of Object.keys(r.patch)) {
        if (TERM_CONTENT_FIELDS.indexOf(k) < 0 && k !== 'term' && k !== 'edited' && k !== 'updatedAt') p[k] = r.patch[k];
      }
      r = Object.keys(p).length ? { op: 'patch', patch: p } : { op: 'keep' };
      ctx.dup++;
    }
    apply(st, 'cards', mine, r, ctx);
    next();
  };
  reqGet(st, v.id, (byId) => {
    if (!isTerm) { finish(byId || null, false); return; }
    if (byId && byId.kind === 'term' && byId.targetLang === v.targetLang) {
      if (typeof v.term !== 'string' || v.term === byId.term) { finish(byId, false); return; }
      byTerm((list) => finish(byId, list.some((x) => x.id !== byId.id)));
      return;
    }
    byTerm((list) => finish(list[0] || byId || null, false));
  }, fail);
}

/** 그 밖 스토어 — 기본 키로 기기 레코드를 읽어 병합. */
function plainStep(s, d, store, v, ctx, next, fail) {
  const key = keyOf(keyPathOf(d, store), v);
  if (!validKey(key)) { tally(ctx, store, 'skip'); next(); return; }
  reqGet(s[store], key, (cur) => {
    const mine = cur === undefined ? null : cur;
    // `[9c-3 — 9c2R #2]` 의료 사이트·최근 검색어는 기기 것과 합친다(그 밖 설정은 파일 값으로 덮기 — 17-4-1 5 표)
    const theirs = store === 'settings' && mine ? Object.assign({}, v, { value: unionSetting(v.key, mine.value, v.value) }) : v;
    apply(s[store], store, mine, mergeRecord(store, mine, theirs, { nowMs: ctx.nowMs }), ctx);
    next();
  }, fail);
}

/** 레코드 묶음을 트랜잭션 하나로. 요청은 콜백으로 이어 걸어 트랜잭션이 도중에 끝나지 않게 한다. */
function writeBatch(d, recs, ctx) {
  return d.withTx(TX_STORES, 'readwrite', (tx, s) => new Promise((resolve, reject) => {
    let i = 0;
    const next = () => {
      while (i < recs.length) {
        const rec = recs[i++];
        const store = rec.store;
        if (!STORE_SET.has(store)) { tally(ctx, store, 'skip'); continue; }
        if (store === 'settings' && !ctx.withSettings) { tally(ctx, store, 'skip'); continue; }
        // documents 가 아닌 레코드는 이 순간의 docId 바꿔 쓰기 표로(문서 줄이 파일 앞에 있다 — 같은 묶음 안에서도 앞에서 이미 채워졌다)
        let v = cleanRecord(store, rec.v, { nowMs: ctx.nowMs, defaults: ctx.defaults });
        if (!v || typeof v !== 'object') { tally(ctx, store, 'skip'); continue; }
        if (store === 'documents') { docStep(s, v, ctx, next, reject); return; }
        v = remapRecord(store, v, ctx.remap);
        if (store === 'cards') {
          if (!validKey(v.id)) { tally(ctx, store, 'skip'); continue; }
          cardStep(s, v, ctx, next, reject);
          return;
        }
        plainStep(s, d, store, v, ctx, next, reject);
        return;
      }
      resolve();
    };
    next();
  }));
}

/* ────────────────────────────────────────────────────────
   5. 가져오기
   ──────────────────────────────────────────────────────── */

/**
 * 백업 파일 하나를 이 기기에 병합한다(호출 0 · 오프라인 ○). 다시 불러오기는 화면 몫.
 *
 * @param {Blob} file
 * @param {{withSettings?:boolean, now?:number, batch?:number, db?:Object, signal?:{aborted:boolean},
 *          defaults?:Object, onProgress?:(p:{done:number, total:number, store:string})=>void}} [opts]
 *   `defaults` — `settings.js` `DEFAULTS`(화면이 넘긴다 — 설정 값이 같은 꼴일 때만 넣는다, 9c2R #3). 없으면 꼴을 보지 않는다.
 * @returns {Promise<{ok:boolean, code:string|null, gz:boolean, head:Object|null, lines:number, records:number, bad:number, long:number,
 *   ended:boolean, truncated:boolean, broken:boolean, stopped:boolean, endCounts:Object|null, seen:Object<string,number>,
 *   ops:Object<string,{add:number, put:number, patch:number, keep:number, skip:number}>, remap:Object<string,string>, dup:number,
 *   mismatch:{store:string, head:number, end:number|null, seen:number}[]}>}
 *   `truncated` — 끝 줄이 없었다(있는 데까지 넣음) · `broken` — 흐름이 중간에 깨졌다(gzip 끝 잘림·깨진 UTF-8) · `stopped` — 화면이 멈췄다
 */
export async function importBackup(file, opts) {
  const o = opts || {};
  const d = o.db || realDb;
  const size = Number(o.batch) > 0 ? Math.floor(Number(o.batch)) : BACKUP.IMPORT_BATCH;
  const progress = typeof o.onProgress === 'function' ? o.onProgress : () => {};
  const aborted = () => !!(o.signal && o.signal.aborted);
  const res = {
    ok: false, code: null, gz: false, head: null, lines: 0, records: 0, bad: 0, long: 0, ended: false, truncated: false,
    broken: false, stopped: false, endCounts: null, seen: {}, ops: {}, remap: {}, dup: 0, mismatch: []
  };
  const ctx = {
    remap: new Map(), withSettings: o.withSettings !== false, nowMs: Number(o.now) || Date.now(),
    defaults: o.defaults && typeof o.defaults === 'object' ? o.defaults : null,
    docReset: (d.derivedDocReset || realDb.derivedDocReset)(), ops: res.ops, dup: 0
  };

  let src;
  try { src = await openText(file); } catch (e) { res.code = e && e.code === 'no-gzip' ? 'no-gzip' : 'read'; return res; }
  res.gz = src.gz;
  const sp = lineSplitter();
  let batch = [];
  let total = 0;
  let lastStore = '';

  const flush = async () => {
    if (!batch.length) return;
    const b = batch;
    batch = [];
    await writeBatch(d, b, ctx);
    res.records += b.length;
    progress({ done: res.records, total: Math.max(total, res.records), store: lastStore });
  };
  /** 줄 하나. 머리 줄이 틀리면 'fail'. */
  const handle = async (line) => {
    res.lines++;
    if (!res.head) {
      const h = readHead(line);
      if (!h.ok) { res.code = h.code; return 'fail'; }
      res.head = h.head;
      const c = h.head.counts || {};
      for (const k of Object.keys(c)) if (STORE_SET.has(k) && (k !== 'settings' || ctx.withSettings)) total += Number(c[k]) || 0;
      progress({ done: 0, total: total, store: '' });
      return null;
    }
    if (res.ended) { res.bad++; return null; }            // 끝 줄 뒤의 글자 — 넣지 않는다
    const p = parseLine(line);
    if (p.kind === 'rec') {
      res.seen[p.store] = (res.seen[p.store] || 0) + 1;
      lastStore = p.store;
      batch.push(p);
      if (batch.length >= size) await flush();
    } else if (p.kind === 'end') {
      res.ended = true;
      res.endCounts = p.counts;
    } else {
      res.bad++;                                             // 반쪽 줄·모르는 줄 — 그 줄만 버린다
    }
    return null;
  };

  let failed = null;
  try {
    outer: for (;;) {
      if (aborted()) { res.stopped = true; break; }
      let r;
      try { r = await src.reader.read(); } catch (e) { res.broken = true; break; }   // gzip 끝 잘림·깨진 UTF-8 — 앞까지는 들어간다
      if (r.done) {
        for (const l of sp.end()) if (await handle(l) === 'fail') break outer;
        break;
      }
      for (const l of sp.push(r.value)) {
        if (await handle(l) === 'fail') break outer;
        if (aborted()) { res.stopped = true; break outer; }
      }
      if (!res.head && sp.long) { res.code = 'not-backup'; break; }      // 줄바꿈 없는 큰 파일 — 첫 줄 전에 상한을 넘음
    }
    // 남은 묶음 — 멈추거나 흐름이 깨져도 이미 읽은 줄은 넣는다(멱등 — 같은 파일로 다시 하면 이어진다)
    if (res.head && !res.code) await flush();
  } catch (e) {
    failed = e;
  } finally {
    cancel(src.reader);
  }
  res.long = sp.long;
  res.dup = ctx.dup;
  for (const [a, b] of ctx.remap) res.remap[a] = b;
  if (!res.head && !res.code) res.code = 'not-backup';
  if (failed) { res.code = failed && failed.code === 'ERR_DB_QUOTA' ? 'quota' : 'write'; return res; }
  if (res.code) return res;
  res.truncated = !res.ended;
  // 머리 줄 개수와 끝 줄·실제가 다르면 끝에 한 줄로 알린다(17-4-1 5 미리보기)
  const hc = res.head.counts || {};
  const names = new Set([].concat(Object.keys(hc), Object.keys(res.seen), Object.keys(res.endCounts || {})));
  for (const k of names) {
    const hv = Number(hc[k]) || 0;
    const ev = res.endCounts ? Number(res.endCounts[k]) || 0 : null;
    const sv = res.seen[k] || 0;
    if (res.ended && (hv !== ev || ev !== sv)) res.mismatch.push({ store: k, head: hv, end: ev, seen: sv });
  }
  res.ok = !res.stopped;
  return res;
}
