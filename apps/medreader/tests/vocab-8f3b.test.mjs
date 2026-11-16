/* ============================================================
   tests/vocab-8f3b.test.mjs — 8f-3b: 8f-3 Review 지적 고치기(데이터 안전 — 기기 데이터를 조용히 덮거나 지우지 않는다)
   review.md "8f-3 Review" 8f3R-10 #1–#8.

   B1 #1 삭제 확인 리스너 한 벌 · 대상은 열 때 고정 · 어떤 닫힘에도 지움 · leaveVocab 이 같은 길(소스) · 편집 대화도 한 벌
   B2 #2 미리보기 뒤 기기 편집 → 적용이 덮지 않고 건너뜀(skipped) · updatedAt 은 뒤로 가지 않는다 · 바뀔 항목 기기 → 파일 값
   B3 #3 UTF-8 아닌 파일(cp1256·UTF-16 BOM) → 거절 'encoding' · `U+FFFD` 줄 거절 · cp949 `?` 는 바뀔 항목 값으로 보인다 · 화면은 바이트로
   B4 #4 bulk 응답 전에 사용자가 고친 항목 → 쓰지 않음(stale) · update 의 ifBase
   B5 #5 파일 updated 가 지금보다 뒤 → 충돌(future) · 골라도 updatedAt ≤ 지금 · 새 항목 시각도 자름
   B6 #6 id 가 다른 대상 언어 항목 → 그 id 버림(그 항목 덮지 않음, 새 항목)
   B7 #7 유닉스 초 → 못 읽음(충돌) · 모르는 열 알림 · 깨진 따옴표 → 뒤 줄 살리고 그 줄 거절 'quote' · 엑셀 따옴표는 그대로
   B8 #8 reader.css 시트 compact — [닫기]는 끝 쪽 열 위 sticky(단추 줄과 겹치지 않음) · 8e 블록 무변
   B9 i18n 4언어 새 키 · 자리표시자
   지어낸 낱말만. 실제 키·실제 호출 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
globalThis.sessionStorage = globalThis.sessionStorage || memStorage();
globalThis.localStorage = globalThis.localStorage || memStorage();

const db = await import('../js/db.js');
const V = await import('../js/text/vocab.js');
const { createVocabStore } = await import('../js/vocab/store.js');
const U = await import('../js/ui/vocab.js');
const { VOCAB } = await import('../js/config.js');
const { BUNDLES, LANGS } = await import('../js/i18n/index.js');

const { buildCsv, parseCsv, importPlan, planToApply, fileTimeOf, baseOf, csvCell, ROW_FLAG } = V;
const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
function strip(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'); }
const fnBody = (s, name, next) => s.slice(s.indexOf(name), s.indexOf(next, s.indexOf(name) + name.length));

const T0 = new Date(2026, 10, 16, 12, 0, 0).getTime();
let clock = T0;
const store = createVocabStore({ now: () => clock });
const COLS = VOCAB.CSV_COLUMNS.slice();

async function seed(surface, over) {
  const r = await store.save(Object.assign({ surface: surface, srcLang: 'en', targetLang: 'ar', context: 'The ' + surface + ' was noted.',
    docId: 'docB', docTitle: 'Book B', pageNo: 3, lineId: '3:1', origin: 'user' }, over || {}));
  return r.entry;
}
function rowsToCsv(cols, rows, header) {
  const head = cols.map((c) => (header && header[c]) || c);
  return '﻿' + [head.map(csvCell).join(',')].concat(rows.map((r) => cols.map((c) => csvCell(r[c] == null ? '' : r[c])).join(','))).join('\r\n') + '\r\n';
}
function editRows(csv, fn) { const rows = parseCsv(csv).rows.map((r) => Object.assign({}, r)); fn(rows); return rows; }

/* ══ #1 삭제 확인 리스너 ══════════════════════════════════ */

test('B1 ★ #1 삭제 확인 — 리스너는 initVocab 에서 한 벌 · 대상 id 는 열 때 고정 · 어떤 닫힘(단추·Esc·close·leaveVocab)에도 지움 · 편집 대화도 한 벌', () => {
  const ui = strip(src('../js/ui/vocab.js'));
  const ask = fnBody(ui, 'function askDelete(', 'function closeDel(');
  assert.ok(!/addEventListener|removeEventListener/.test(ask), '★ 열 때마다 리스너를 달지 않는다(남는 리스너 0)');
  assert.match(ask, /delTarget = String\(e\.id\);/, '대상은 열 때 고정');
  const init = fnBody(ui, 'export function initVocab(', 'export async function showVocab(');
  assert.equal((init.match(/els\.del\.addEventListener\(/g) || []).length, 3, 'click·cancel·close 한 벌');
  assert.match(init, /els\.del\.addEventListener\('click', onDelClick\);/);
  assert.match(init, /els\.del\.addEventListener\('cancel', \(ev\) => \{ ev\.preventDefault\(\); closeDel\(\); \}\);/);
  assert.match(init, /els\.del\.addEventListener\('close', \(\) => \{ if \(!els\.del\.open\) delTarget = null; \}\);/, '★ 어떤 길로 닫혀도 대상 지움');
  assert.equal((ui.match(/els\.del\.addEventListener\(/g) || []).length, 3, 'initVocab 밖에서 삭제 대화에 리스너를 달지 않는다');
  const close = fnBody(ui, 'function closeDel(', 'async function onDelClick(');
  assert.match(close, /delTarget = null;\s*closeDialog\(els && els\.del\);/);
  const leave = fnBody(ui, 'export function leaveVocab(', 'async function load(');
  assert.match(leave, /closeDel\(\);/, '★ 화면을 떠날 때도 같은 정리 경로');
  assert.ok(!/closeDialog\(els\.del\)/.test(leave));
  const on = fnBody(ui, 'async function onDelClick(', 'function closeDialog(');
  assert.match(on, /const id = delTarget;[\s\S]*closeDel\(\);\s*if \(!ok \|\| id == null\) return;[\s\S]*vocabStore\.remove\(id\)/, '[삭제]는 고정한 대상 하나만');
  // 편집 대화 — 리스너는 initVocab 의 close 한 벌, 대상(S.editId)은 열 때 정하고 close 가 지운다(같은 꼴)
  assert.equal((ui.match(/els\.edit\.addEventListener\(/g) || []).length, 1);
  assert.match(init, /els\.edit\.addEventListener\('close', \(\) => \{ S\.editId = null;/);
  assert.match(leave, /closeDialog\(els\.edit\);/);
});

/* ══ #2 미리보기 뒤 편집 ══════════════════════════════════ */

test('B2 ★ #2 미리보기 뒤 기기에서 고친 항목 → [가져오기]가 덮지 않고 건너뜀(skipped 1) · updatedAt 뒤로 0 · 바뀔 항목에 기기 → 파일 값', async () => {
  clock = T0;
  const e = await seed('Stalecase', { translation: 'قديم' });
  const other = await seed('Freshcase', { translation: 'آخر' });
  const rows = editRows(buildCsv([e, other]), (rr) => { rr[0].translation = 'من الملف'; rr[1].translation = 'ملف 2'; });
  const flow = U.createImportFlow({ store: store, now: () => clock, docs: () => [] });
  const r = await flow.read(rowsToCsv(COLS, rows));
  assert.deepEqual(r.view.counts, { add: 0, change: 2, same: 0, conflict: 0, reject: 0 });
  const ch = r.view.changes.find((x) => x.id === e.id);
  assert.deepEqual(ch.fields.map((f) => [f.field, f.here, f.file]), [['translation', 'قديم', 'من الملف']], '★ 바뀔 항목 — 기기 값 → 파일 값');
  assert.equal(ch.row, 2);
  clock = T0 + 10000;
  await store.update(e.id, { translation: 'تعديل المستخدم' }, { user: true });
  const mid = await store.findTerm('stalecase', 'ar');
  clock = T0 + 20000;
  const res = await flow.apply();
  assert.deepEqual(res, { added: 0, changed: 1, skipped: 1 }, '★ 그사이 바뀐 항목은 건너뜀 — 다른 항목은 적용');
  const fin = await store.findTerm('stalecase', 'ar');
  assert.equal(fin.translation, 'تعديل المستخدم', '★ 사용자 값 그대로');
  assert.equal(fin.updatedAt, mid.updatedAt, 'updatedAt 그대로(뒤로 가지 않음)');
  assert.equal((await store.findTerm('freshcase', 'ar')).translation, 'ملف 2');
  // 계획 줄에 지문 — 기기 항목의 baseOf(바뀜·충돌 모두)
  const fr = await store.findTerm('freshcase', 'ar');
  const p2 = importPlan(editRows(buildCsv([fr]), (rr) => { rr[0].translation = 'ملف 3'; }), await store.list(), { nowMs: clock });
  assert.deepEqual(p2.change.map((c) => c.base), [baseOf(fr)]);
  const p3 = importPlan(editRows(buildCsv([fr]), (rr) => { rr[0].translation = 'ملف 4'; rr[0].updated = ''; }), await store.list(), { nowMs: clock });
  assert.deepEqual(p3.conflict.map((c) => c.base), [baseOf(fr)]);
  // updatedAt 은 어떤 경우에도 뒤로 가지 않는다(지문 없는 손 계획 — patch 시각이 더 이름)
  const cur = await store.findTerm('freshcase', 'ar');
  await store.applyImport({ add: [], change: [{ id: cur.id, patch: { note: 'x', updatedAt: cur.updatedAt - 99999 } }] });
  assert.equal((await store.findTerm('freshcase', 'ar')).updatedAt, cur.updatedAt, '★ max(기기, patch)');
  // 화면 — 건너뜀이 있으면 "그사이 바뀜 — 건너뜀 n"
  const ui = strip(src('../js/ui/vocab.js'));
  assert.match(ui, /if \(r && r\.skipped\) setStatus\('vocab\.import\.doneStale', \{ add: formatNumber\(r\.added\), change: formatNumber\(r\.changed\), skipped: formatNumber\(r\.skipped\) \}\);/);
  const st = strip(src('../js/vocab/store.js'));
  assert.match(st, /if \(typeof c\.base === 'string' && baseOf\(cur\) !== c\.base\) \{ skipped\+\+; continue; \}/);
});

/* ══ #3 인코딩 ════════════════════════════════════════════ */

const CP1256 = { 'ت': 0xCA, 'ر': 0xD1, 'ج': 0xCC, 'م': 0xE3, 'ة': 0xC9, 'ش': 0xD4, 'ح': 0xCD, 'ق': 0xDE };
function ansi(text) {
  const out = [];
  for (const ch of text) { const c = ch.codePointAt(0); out.push(c < 0x80 ? c : CP1256[ch] != null ? CP1256[ch] : 0x3F); }
  return new Uint8Array(out);
}

test('B3 ★ #3 UTF-8 아닌 CSV — cp1256(ANSI)·UTF-16 LE/BE BOM 바이트 → 거절 encoding(기기 변화 0) · UTF-8(BOM 있음/없음) 통과 · U+FFFD 줄 거절 · cp949 `?` 는 바뀔 항목 값으로 보임', async () => {
  clock = T0 + 100000;
  const ents = [];
  for (let i = 0; i < 4; i++) { clock++; ents.push(await seed('Encword' + i, { translation: 'ترجمة رقم ' + i, gloss: 'شرح' })); }
  const csv = buildCsv(ents);
  const enc = new TextEncoder();
  // 순수 디코딩
  assert.deepEqual(U.decodeCsvBytes(ansi(csv.slice(1))), { ok: false, reason: 'encoding' }, '★ 잘못된 UTF-8');
  const le = new Uint8Array([0xFF, 0xFE, 0x74, 0x00]);
  const be = new Uint8Array([0xFE, 0xFF, 0x00, 0x74]);
  assert.deepEqual(U.decodeCsvBytes(le), { ok: false, reason: 'encoding' }, 'UTF-16 LE BOM');
  assert.deepEqual(U.decodeCsvBytes(be.buffer), { ok: false, reason: 'encoding' }, 'UTF-16 BE BOM(ArrayBuffer)');
  const u8 = U.decodeCsvBytes(enc.encode(csv));
  assert.equal(u8.ok, true);
  assert.equal(u8.text, csv.slice(1), 'BOM 은 뗀다');
  assert.equal(U.decodeCsvBytes(enc.encode(csv.slice(1))).text, csv.slice(1), 'BOM 없는 UTF-8');
  assert.deepEqual(U.decodeCsvBytes('글'), { ok: true, text: '글' });
  assert.deepEqual(U.decodeCsvBytes(null), { ok: false, reason: 'encoding' });
  // 흐름 — 바이트로 읽으면 거절, 기기 변화 0
  const before = JSON.stringify(await store.list());
  const flow = U.createImportFlow({ store: store, now: () => clock, docs: () => [] });
  assert.deepEqual(await flow.read(ansi(csv.slice(1))), { ok: false, reason: 'encoding' });
  assert.equal(flow.pending(), false);
  assert.deepEqual(await flow.read(new Uint8Array([0xFF, 0xFE].concat(Array.from(Buffer.from(csv.slice(1), 'utf16le'))))), { ok: false, reason: 'encoding' });
  const ok = await flow.read(enc.encode(csv));
  assert.deepEqual(ok.view.counts, { add: 0, change: 0, same: 4, conflict: 0, reject: 0 }, '정상 UTF-8 바이트 → 그대로 n');
  flow.cancel();
  // 글로 받았는데 U+FFFD 가 든 줄(예전 File.text() 꼴) → 그 줄 거절
  const broken = new TextDecoder('utf-8').decode(ansi(csv.slice(1)));
  assert.ok(broken.includes(String.fromCharCode(0xFFFD)), '전제: 예전 File.text() 꼴이면 깨진 글자');
  const p = parseCsv(broken);
  assert.equal(p.rows.filter((r) => r[ROW_FLAG] === 'encoding').length, 4);
  const r = await flow.read(broken);
  assert.deepEqual(r.view.counts, { add: 0, change: 0, same: 0, conflict: 0, reject: 4 });
  assert.deepEqual(r.view.rejects, [{ reason: 'encoding', rows: [2, 3, 4, 5] }]);
  await flow.apply();
  assert.equal(JSON.stringify(await store.list()), before, '★ 기기 변화 0');
  // cp949 — 아랍 글자가 `?`(유효한 UTF-8 — 막을 수 없다) → 바뀔 항목에 기기 값 → 파일 값(번역 칸)
  const q = await flow.read(enc.encode(csv.slice(1).replace(/[؀-ۿ]/g, '?')));
  assert.equal(q.view.counts.change, 4);
  const tr = q.view.changes[0].fields.find((f) => f.field === 'translation');
  assert.ok(/[؀-ۿ]/.test(tr.here) && /\?\?/.test(tr.file), '★ 사용자가 눈으로 알아챌 값');
  flow.cancel();
  // 화면 — 바이트로 읽고(File.text() 0) 거절 사유 키에 encoding
  const ui = strip(src('../js/ui/vocab.js'));
  const onFile = fnBody(ui, 'async function onFile(', 'function renderPreview(');
  assert.match(onFile, /bytes = await f\.arrayBuffer\(\);/);
  assert.ok(!/f\.text\(\)/.test(onFile), '★ File.text() 쓰지 않음');
  assert.match(onFile, /\['size', 'rows', 'header', 'empty', 'encoding'\]/);
  assert.match(ui, /new TextDecoder\('utf-8', \{ fatal: true \}\)/);
});

/* ══ #4 bulk 경합 ═════════════════════════════════════════ */

test('B4 ★ #4 bulk 응답이 오기 전에 사용자가 그 항목 번역을 직접 저장 → 응답이 덮지 않음(stale 1) · 다른 항목은 씀 · update ifBase 어긋남 = null·쓰지 않음', async () => {
  clock = T0 + 200000;
  const a = await seed('Raceword', { translation: '' });
  clock++;
  const b = await seed('Calmword', { translation: '' });
  let release;
  const gate = new Promise((res) => { release = res; });
  const p = U.runBulk([a, b], { consented: true, docs: [{ id: 'docB', lang: 'en' }],
    translateTerms: async (items) => { await gate; return { calls: 1, results: items.map((it) => ({ state: 'ready', value: { translation: 'ذكاء ' + it.term, gloss: 'g', pos: 'noun', lemma: '' } })) }; },
    update: (id, patch, o) => store.update(id, patch, o) });
  clock = T0 + 210000;
  await store.update(a.id, { translation: 'كتبه المستخدم' }, { user: true });
  release();
  const r = await p;
  assert.deepEqual([r.calls, r.done, r.stale, r.failed], [1, 1, 1, 0]);
  const fa = await store.findTerm('raceword', 'ar');
  assert.equal(fa.translation, 'كتبه المستخدم', '★ 직접 친 번역 그대로');
  assert.equal(fa.edited, true);
  assert.equal((await store.findTerm('calmword', 'ar')).translation, 'ذكاء calmword');
  assert.equal(U.bulkPlan([Object.assign({}, b, { translation: '' })], []).bases[0], baseOf(Object.assign({}, b, { translation: '' })), '요청 때 지문');
  // update ifBase — 어긋나면 null·쓰지 않음, 맞으면 씀
  const cur = await store.findTerm('calmword', 'ar');
  assert.equal(await store.update(cur.id, { gloss: 'X' }, { user: false, ifBase: 'nope' }), null);
  assert.equal((await store.findTerm('calmword', 'ar')).gloss, 'g');
  assert.equal((await store.update(cur.id, { gloss: 'Y' }, { user: false, ifBase: baseOf(cur) })).gloss, 'Y');
});

/* ══ #5 미래 시각 ═════════════════════════════════════════ */

test('B5 ★ #5 파일 updated 가 지금보다 뒤(2099·ms) → 충돌 future(기기 그대로) · 골라도 updatedAt = max(지금, 기기) · 새 항목 시각은 지금으로 자름 · nowMs 없으면 예전대로', async () => {
  clock = T0 + 300000;
  const e = await seed('Futureword', { translation: 'قبل' });
  const rows = editRows(buildCsv([e]), (rr) => { rr[0].note = 'from future'; rr[0].updated = '2099-01-01T00:00:00.000Z'; });
  rows.push({ term: 'Newfuture', target_lang: 'ar', translation: 'ج', added: '2099-01-01T00:00:00.000Z', updated: '4102444800000' });
  const nowMs = T0 + 310000;
  const plan = importPlan(rows, await store.list(), { nowMs: nowMs });
  assert.equal(plan.change.length, 0);
  assert.deepEqual(plan.conflict.map((c) => [c.id, c.reason]), [[e.id, 'future']], '★ 미래 → 충돌');
  assert.ok(plan.conflict[0].patch.updatedAt <= nowMs, '★ 파일의 미래 시각을 patch 에 넣지 않는다');
  assert.equal(plan.add[0].createdAt, nowMs, '새 항목 createdAt 지금으로');
  assert.equal(plan.add[0].updatedAt, nowMs, '새 항목 updatedAt 지금으로');
  clock = nowMs;
  await store.applyImport(planToApply(plan, [e.id]));
  const g = await store.findTerm('futureword', 'ar');
  assert.equal(g.note, 'from future');
  assert.ok(g.updatedAt <= nowMs, '★ 2099 를 저장하지 않는다');
  assert.ok((await store.findTerm('newfuture', 'ar')).updatedAt <= nowMs);
  // 그 뒤 기기에서 고친 것을 같은 미래 파일이 덮지 않는다(8f3R I3b)
  clock = nowMs + 1000;
  await store.update(g.id, { note: 'device later' }, { user: true });
  const again = importPlan(rows.slice(0, 1), await store.list(), { nowMs: nowMs + 2000 });
  assert.equal(again.change.length, 0);
  assert.equal(again.conflict.length, 1);
  // 지금 시각을 모르는 옛 호출(nowMs 없음)은 예전 규칙(미래 판정 없음)
  assert.equal(importPlan(rows.slice(0, 1), await store.list(), {}).change.length, 1);
  assert.match(BUNDLES.ko['vocab.import.conflictHelp'], /지금보다 뒤/);
});

/* ══ #6 id + 다른 대상 언어 ════════════════════════════════ */

test('B6 ★ #6 행 id 는 ar 항목인데 target_lang 이 fr → ar 항목을 덮지 않고 fr 새 항목(파일 id 는 쓰지 않음) · 같은 대상이면 예전처럼 id 로 맞춤', async () => {
  clock = T0 + 400000;
  const e = await seed('Langword', { translation: 'عربي' });
  const rows = parseCsv(buildCsv([e])).rows;
  const swap = [Object.assign({}, rows[0], { target_lang: 'fr', translation: 'français' })];
  const plan = importPlan(swap, await store.list(), { nowMs: clock });
  assert.deepEqual([plan.add.length, plan.change.length, plan.conflict.length], [1, 0, 0]);
  assert.equal(plan.add[0].id, null, '다른 대상 언어 항목의 id 를 새 항목에 쓰지 않는다');
  await store.applyImport(plan);
  const ar = await store.findTerm('langword', 'ar');
  assert.equal(ar.translation, 'عربي', '★ ar 항목 그대로');
  const fr = await store.findTerm('langword', 'fr');
  assert.equal(fr.translation, 'français');
  assert.notEqual(fr.id, ar.id);
  const same = [Object.assign({}, rows[0], { term: 'Langword renamed', translation: 'عربي جديد' })];
  assert.deepEqual(importPlan(same, await store.list(), { nowMs: clock }).change.map((c) => c.id), [e.id], '같은 대상이면 id 로(원어 고침)');
});

/* ══ #7 말없이 버려지던 파일 쪽 ═══════════════════════════ */

test('B7 ★ #7 유닉스 초(10자리) → 못 읽음(충돌, 1970년으로 "그대로" 아님) · 머리 줄 모르는 열 알림 · 깨진 따옴표 — 뒤 줄 살리고 그 줄만 quote 거절 · 엑셀 따옴표 그대로', async () => {
  assert.ok(Number.isNaN(fileTimeOf('1763290000')), '10자리 = 초 → 못 읽음');
  assert.ok(Number.isNaN(fileTimeOf('17632900001234')), '14자리');
  assert.equal(fileTimeOf(String(T0)), T0, '13자리 ms 는 읽음');
  clock = T0 + 500000;
  const ents = [];
  for (let i = 0; i < 6; i++) { clock++; ents.push(await seed('Quoteword' + i, { translation: 'ترجمة ' + i, context: 'Ctx ' + i + ', "q".' })); }
  const csv = buildCsv(ents);
  // 유닉스 초 + 내용 고침 → 충돌(미리보기에 두 값)
  const sec = editRows(csv, (rr) => { rr[0].note = 'file note'; rr[0].updated = '1763290000'; });
  const ps = importPlan(sec, await store.list(), { nowMs: clock });
  assert.deepEqual([ps.change.length, ps.conflict.length], [0, 1], '★ 말없이 버리지 않는다');
  // 모르는 열
  const flow = U.createImportFlow({ store: store, now: () => clock, docs: () => [] });
  const part = await flow.read(rowsToCsv(COLS, parseCsv(csv).rows, { note: '메모', updated: '수정일' }));
  assert.deepEqual(part.view.columns, ['메모', '수정일'], '★ 모르는 열');
  flow.cancel();
  assert.deepEqual(U.unknownColumns(['term', ' extra ', '', 'extra', 'id']), ['extra']);
  // 깨진 따옴표 — (a) 끝까지 안 닫힘(문맥에 따옴표 없음) (b) 닫는 따옴표 뒤에 글자(문맥에 따옴표 있음)
  for (const [label, ctxQuote] of [['a', false], ['b', true]]) {
    const list = ctxQuote ? ents : ents.map((x) => Object.assign({}, x, { context: 'Plain ' + x.term }));
    const lines = buildCsv(list).split('\r\n');
    const parts = lines[3].split(',');
    parts[1] = '"' + parts[1];
    lines[3] = parts.join(',');
    const broken = lines.join('\r\n');
    const p = parseCsv(broken);
    assert.equal(p.rows.length, 6, label + ' ★ 뒤 줄이 삼켜지지 않는다');
    assert.deepEqual(p.rows.map((r) => r[ROW_FLAG] || null), [null, null, 'quote', null, null, null], label);
    const plan = importPlan(p.rows, await store.list(), { nowMs: clock });
    assert.deepEqual(plan.reject, [{ row: 2, reason: 'quote' }], label);
    assert.deepEqual(U.rejectSummary(plan), [{ reason: 'quote', rows: [4] }], label + ' 파일 줄 번호');
  }
  // 엑셀이 쓰는 꼴은 그대로(따옴표 안 "" · 칸 가운데 따옴표 · 칸 안 줄바꿈)
  const ok = parseCsv('term,target_lang,note\r\n"a ""b"" c",ar,"x\r\ny"\r\nd"e,ar,5" tall\r\n');
  assert.deepEqual(ok.rows.map((r) => [r.term, r.note, r[ROW_FLAG] || null]), [['a "b" c', 'x\r\ny', null], ['d"e', '5" tall', null]]);
  // 깨진 따옴표가 많아도 멈추지 않는다(되감기 상한)
  const many = 'term,target_lang\r\n' + Array.from({ length: 300 }, (_, i) => '"w' + i + ',ar').join('\r\n') + '\r\n';
  const t0 = Date.now();
  const pm = parseCsv(many);
  assert.ok(Date.now() - t0 < 3000, '상한 안');
  assert.equal(pm.ok, true);
  assert.ok(pm.rows.some((r) => r[ROW_FLAG] === 'quote'));
  // 화면 — 모르는 열 줄
  const ui = strip(src('../js/ui/vocab.js'));
  assert.match(ui, /t\('vocab\.import\.reason\.columns', \{ cols:/);
  assert.deepEqual(U.REJECT_REASONS.slice(), ['term', 'target', 'dup', 'encoding', 'quote']);
});

/* ══ #8 reader.css 시트 compact ═══════════════════════════ */

test('B8 ★ #8 단어 시트 compact(max-height 520) — [닫기]는 끝 쪽 열 위 sticky(아래 sticky 아님 → 단추 줄과 겹치지 않음) · 라벨은 칸 옆 · 폭 880 · 8e 블록·기본 시트 규칙 무변', () => {
  const css = src('../css/reader.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const at = css.lastIndexOf('@media (max-height: 520px) {');
  const first = css.indexOf('@media (max-height: 520px) {');
  assert.ok(at > first, '시트 블록은 8e 블록 뒤(파일 끝) — 8e 시험의 첫 블록은 그대로');
  assert.ok(css.slice(first, first + 400).includes('.reader-dock'), '첫 compact 블록은 8e 합친 바');
  const blk = css.slice(at);
  const rule = (sel) => { const i = blk.indexOf(sel + ' {'); assert.ok(i >= 0, sel); return blk.slice(i, blk.indexOf('}', i)); };
  const sheet = rule('.word-sheet');
  assert.match(sheet, /max-inline-size: 880px;/);
  assert.match(sheet, /display: grid;/);
  assert.match(sheet, /grid-template-columns: minmax\(0, 1fr\) auto;/);
  const close = rule('.word-sheet > .ws-close');
  assert.match(close, /grid-column: 2;/);
  assert.match(close, /position: sticky;/);
  assert.match(close, /inset-block-start: 0;/);
  assert.match(close, /inset-block-end: auto;/, '★ 아래 sticky 를 걷는다(단추 줄 위에 앉지 않음)');
  assert.match(close, /min-inline-size: var\(--tap\);/);
  assert.match(rule('.word-sheet > *'), /grid-column: 1;/);
  assert.match(rule('.word-sheet .ws-field:not([hidden])'), /display: flex;/, '숨은 칸을 다시 보이지 않게 :not([hidden])');
  assert.ok(!/\b(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/.test(blk), '논리 속성만');
  // 기본(세로) 시트 규칙은 그대로 — 아래 sticky [닫기]
  assert.match(css, /\.word-sheet > \.ws-close \{\s*position: sticky;\s*inset-block-end: 0;/);
});

/* ══ i18n ═════════════════════════════════════════════════ */

test('B9 i18n 4언어 — 새 거절 사유·인코딩 안내·바뀔 항목·그사이 바뀜 키 · 자리표시자 · ar·fr 은 en 복사가 아님', () => {
  const keys = { 'vocab.import.err.encoding': [], 'vocab.import.reason.encoding': ['{rows}'], 'vocab.import.reason.quote': ['{rows}'],
    'vocab.import.reason.columns': ['{cols}'], 'vocab.import.changes': ['{n}'], 'vocab.import.changesMore': ['{n}'],
    'vocab.import.doneStale': ['{add}', '{change}', '{skipped}'] };
  for (const l of LANGS) {
    for (const [k, ph] of Object.entries(keys)) {
      const v = BUNDLES[l][k];
      assert.ok(typeof v === 'string' && v.length > 5, l + ' ' + k);
      for (const x of ph) assert.ok(v.includes(x), l + ' ' + k + ' ' + x);
    }
    assert.match(BUNDLES[l]['vocab.import.err.encoding'], /UTF-8/, l);
  }
  for (const k of Object.keys(keys)) for (const l of ['ar', 'fr']) assert.notEqual(BUNDLES[l][k], BUNDLES.en[k], l + ' ' + k);
});
