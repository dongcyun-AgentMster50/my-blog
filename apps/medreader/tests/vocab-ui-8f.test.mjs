/* ============================================================
   tests/vocab-ui-8f.test.mjs — 8f-3 단어장 화면 · CSV 내보내기/가져오기 (spec 17-7-3 화면 · 17-7-4 · 17-7-6 4-6 · 6 · 8 "8f-3")

   - crossstep "8f-1 Review" ① 파일 `updated` 가 비었거나 못 읽는 꼴(`dd/mm/yyyy`·`11/16/2026 9:00`·`2026-11-16 09:00`) → **충돌**
     (미리보기에서 고름) — 고르기 전에는 기기 값 그대로 · ② `store.update`·`importPlan` 이 같은 정규화 — 방금 내보낸 CSV 를 그대로
     가져오면 "그대로 n", `edited`·`updatedAt` 불변 · ③ [번역 안 된 것 모두 번역] 늘 `retry:true`
   - 미리보기 먼저(`createImportFlow` — read 는 쓰지 않는다) · 한 칸 고친 CSV → 바뀜 1 · 엑셀식 BOM·CRLF·따옴표·수식 접두
   - [번역 안 된 것 모두 번역 (25)] → 1호출(20개) → (5) · `i` 어긋남은 그 항목만 빈 채 · 동의 없음 → 0 · 같은 책·같은 대상만 한 묶음
   - 8f-2 남은 문제 2 — 사용자가 받아들인 다시 번역은 `edited:false` · 편집은 `edited:true`·"마지막 내보내기 뒤 바뀐 항목 1개"
   - 8f2R-8 ④ 질문 중 `retranslate` 무시 · ⑤ [AI] 연타 1호출 · ⑥ 문맥 바꾸기 patch 의 `docId` · ⑩ 여러 줄 선택 끝 넓히기 ·
     ②③⑦ 포커스·live·단추 자리(소스·마크업)
   - 라우트 `#/vocab`·`#/vocab/:docId` · 입구(서재 상단·카드 [⋯]·시트 링크) · 마크업·CSS·i18n·`innerHTML` 0·내보낸 파일 키 0
   실물 PDF 문장은 쓰지 않는다(지어낸 문장). 실제 키·실제 호출 없음.
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
const W = await import('../js/ui/wordsheet.js');
const R = await import('../js/router.js');
const { VOCAB } = await import('../js/config.js');
const keys = await import('../js/privacy/keys.js');
const { createPipeline } = await import('../js/ai/pipeline.js');
const { createCache } = await import('../js/ai/cache.js');
const { BUNDLES, LANGS } = await import('../js/i18n/index.js');
const { FAKE_KEY, memDb, stubFetch, jsonRes, geminiOk, settingsOf, manualTimers } = await import('./fixtures/ai-stubs-8a.mjs');

const { buildCsv, buildAnki, parseCsv, importPlan, planToApply, fieldValue, fileTimeOf } = V;
const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
function strip(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'); }

const T0 = new Date(2026, 10, 16, 12, 0, 0).getTime();
let clock = T0;
const store = createVocabStore({ now: () => clock });

/** 지어낸 항목 저장(실제 저장소). */
async function seed(surface, over) {
  const r = await store.save(Object.assign({ surface: surface, srcLang: 'en', targetLang: 'ar', context: 'The ' + surface + ' was noted.',
    docId: 'docU', docTitle: 'Book U', pageNo: 7, lineId: '7:3', origin: 'user' }, over || {}));
  return r.entry;
}

/** CSV 한 줄의 칸들(따옴표 없는 단순한 꼴만 — 시험 데이터용). */
function setCell(csv, rowIdx, col, value) {
  const p = parseCsv(csv);
  const rows = p.rows.map((r) => Object.assign({}, r));
  rows[rowIdx][col] = value;
  return '﻿' + [VOCAB.CSV_COLUMNS.join(',')].concat(rows.map((r) => VOCAB.CSV_COLUMNS.map((c) => V.csvCell(r[c] == null ? '' : r[c])).join(','))).join('\r\n') + '\r\n';
}

/* ══ 1. 라우트 · 입구 ══════════════════════════════════════ */

test('U1 라우트 — `#/vocab`(전체)·`#/vocab/:docId`(그 책) · vocabHash 왕복(인코딩) · SCREENS · 섹션 하나 · 입구 셋(서재 상단·카드 [⋯]·시트 링크) · main.js 배선', () => {
  assert.deepEqual(R.parseRoute('#/vocab'), { name: 'vocab', params: {}, raw: '#/vocab' });
  assert.deepEqual(R.parseRoute('#/vocab/').params, {});
  const id = 'doc id/with:odd';
  const r = R.parseRoute(R.vocabHash(id));
  assert.deepEqual([r.name, r.params.docId], ['vocab', id]);
  assert.equal(R.vocabHash(null), '#/vocab');
  assert.equal(R.vocabHash(''), '#/vocab');
  assert.ok(R.SCREENS.includes('vocab'));
  const html = src('../index.html');
  assert.equal((html.match(/data-screen="vocab"/g) || []).length, 1);
  assert.match(html, /<button type="button" id="libraryVocabBtn" data-i18n="vocab\.open" data-nav="#\/vocab"><\/button>/, '서재 상단 [단어장]');
  const lib = strip(src('../js/ui/library.js'));
  assert.match(lib, /vb\.setAttribute\('data-action', 'vocab'\);/, '카드 [⋯] "이 책의 단어장"');
  assert.match(lib, /if \(btn\.getAttribute\('data-action'\) === 'vocab'\) \{\s*go\(vocabHash\(docId\)\);/);
  const main = strip(src('../js/main.js'));
  assert.match(main, /import \{ initVocab, showVocab, leaveVocab \} from '\.\/ui\/vocab\.js';/);
  assert.match(main, /initVocab\(\);/);
  assert.match(main, /if \(route\.name !== 'vocab'\) leaveVocab\(\);/);
  assert.match(main, /case 'vocab': showVocab\(route\.params\); break;/);
});

/* ══ 2. crossstep ① 못 읽는 updated → 충돌 ══════════════════ */

test('U2 ★ fileTimeOf — 이 앱이 쓴 꼴(ISO·ms)만 읽는다 · 스프레드시트가 바꾼 꼴은 NaN', () => {
  const iso = new Date(T0).toISOString();
  assert.equal(fileTimeOf(iso), T0);
  assert.equal(fileTimeOf(iso.replace(/\.\d{3}Z$/, 'Z')), Math.floor(T0 / 1000) * 1000);
  assert.equal(fileTimeOf('2026-11-16T12:00:00+09:00'), Date.parse('2026-11-16T12:00:00+09:00'));
  assert.equal(fileTimeOf(String(T0)), T0);
  for (const bad of ['16/11/2026 12:00', '11/16/2026 12:00', '2026-11-16 12:00', '2026-11-16', '16.11.2026', 'yesterday', '', '   ', null, undefined, 'NaN']) {
    assert.ok(Number.isNaN(fileTimeOf(bad)), String(bad));
  }
  assert.ok(!Number.isNaN(Date.parse('11/16/2026 12:00')), '전제: Date.parse 는 미국식 날짜를 읽는다(그래서 쓰지 않는다)');
});

test('U3 ★ 못 읽는 updated(dd/mm/yyyy·미국식·빈칸·열 지움) + 내용 다름 → 충돌 · 고르기 전 기기 값 그대로 · 고른 것만 적용 · 내용 같으면 그대로', async () => {
  clock = T0;
  const a = await seed('Myalgia', { translation: 'ألم عضلي' });
  const b = await seed('Edema', { translation: 'وذمة' });
  const c = await seed('Gout', { translation: 'نقرس' });
  const d = await seed('Rash', { translation: 'طفح' });
  clock = T0 + 60000;
  // 기기에서 내보낸 뒤 기기에서 고침(기기가 더 새로움) — 옛 파일 값으로 조용히 돌아가면 안 된다(8f1R-8 #2 실측 재현)
  await store.update(a.id, { translation: 'ألم في العضلات' }, { user: true });
  const exported = buildCsv([a, b, c, d]);       // a 는 고치기 전 값(옛 파일)
  let csv = setCell(exported, 0, 'updated', '16/11/2026 12:00');                 // dd/mm/yyyy — a: 옛 번역 + 못 읽는 시각
  csv = setCell(csv, 1, 'translation', 'وذمة جديدة');
  csv = setCell(csv, 1, 'updated', '11/16/2026 12:00');                          // 미국식(Date.parse 는 읽지만 받지 않는다)
  csv = setCell(csv, 2, 'note', 'excel note');
  csv = setCell(csv, 2, 'updated', '');                                          // 빈칸
  csv = setCell(csv, 3, 'updated', '2026-11-16 12:00');                          // 내용 같음 → 그대로(충돌 아님)
  const plan = importPlan(parseCsv(csv).rows, await store.list(), { nowMs: T0 + 120000 });
  assert.deepEqual(plan.conflict.map((x) => x.id).sort(), [a.id, b.id, c.id].sort(), JSON.stringify(plan));
  assert.equal(plan.change.length, 0, '★ 못 읽는 시각은 바뀜이 아니다');
  assert.ok(plan.same.some((s) => s.id === d.id));
  assert.ok(plan.conflict.every((x) => x.reason === 'time'));
  // 열을 지운 CSV — updated 열 자체가 없다
  const noCol = parseCsv(exported).rows.map((r) => { const o = Object.assign({}, r); delete o.updated; return o; });
  noCol[1].translation = 'وذمة 2';
  const p2 = importPlan(noCol, await store.list(), { nowMs: T0 });
  assert.deepEqual(p2.conflict.map((x) => x.id).sort(), [a.id, b.id].sort(), '열이 없어도 충돌(a 는 기기에서 고친 것 · b 는 파일에서 고친 것)');
  assert.equal(p2.change.length, 0);
  // 흐름 — 미리보기 → 고르지 않고 적용 → 기기 값 그대로
  const flow = U.createImportFlow({ store: store, now: () => T0 + 120000, docs: () => [] });
  const r = await flow.read(csv);
  assert.equal(r.ok, true);
  assert.deepEqual(r.view.counts, { add: 0, change: 0, same: 1, conflict: 3, reject: 0 });
  const ca = r.view.conflicts.find((x) => x.id === a.id);
  assert.deepEqual(ca.fields.map((f) => [f.field, f.here, f.file]), [['translation', 'ألم في العضلات', 'ألم عضلي']], '기기 값 / 파일 값');
  assert.equal(ca.useFile, false, '기본은 기기 것');
  const before = await store.list();
  const res = await flow.apply();
  assert.deepEqual(res, { added: 0, changed: 0, skipped: 0 });
  const after = await store.list();
  assert.deepEqual(after, before, '★ 고르기 전에는 기기 값 그대로(updatedAt·edited 포함)');
  // 다시 읽고 b 만 파일 것으로 → b 만 바뀜
  await flow.read(csv);
  const v = flow.pick(b.id, true);
  assert.equal(v.conflicts.find((x) => x.id === b.id).useFile, true);
  await flow.apply();
  assert.equal((await store.findTerm('edema', 'ar')).translation, 'وذمة جديدة');
  assert.equal((await store.findTerm('myalgia', 'ar')).translation, 'ألم في العضلات', '고르지 않은 a 는 그대로');
  assert.equal((await store.findTerm('gout', 'ar')).note, '');
  // planToApply — 순수, 원래 계획을 바꾸지 않는다
  const ap = planToApply(plan, [c.id]);
  assert.deepEqual(ap.change.map((x) => x.id), [c.id]);
  assert.equal(plan.change.length, 0);
  assert.deepEqual(planToApply(plan, null).change, []);
});

/* ══ 3. crossstep ② 정규화 — 그대로 가져오기 = 변화 0 ═══════════ */

test('U4 ★ store.update 가 내용 값을 같은 규칙으로 정규화(겹공백·끝 줄바꿈) · 같은 값이면 쓰지 않음 · 내보낸 CSV 그대로 → 그대로 n·edited·updatedAt 불변', async () => {
  clock = T0 + 200000;
  const e = await seed('Pruritus', { translation: 'حكة' });
  clock = T0 + 210000;
  const u = await store.update(e.id, { translation: '  حكة   شديدة \n', gloss: 'a  b', note: 'line 1\r\nline 2  \n' }, { user: true });
  assert.equal(u.translation, 'حكة شديدة', '공백 하나·앞뒤 걷기');
  assert.equal(u.gloss, 'a b');
  assert.equal(u.note, 'line 1\nline 2', '메모 — 줄 끝 LF·앞뒤만');
  assert.equal(u.updatedAt, T0 + 210000);
  clock = T0 + 220000;
  const same = await store.update(e.id, { translation: 'حكة  شديدة', note: '\nline 1\nline 2' }, { user: true });
  assert.equal(same.updatedAt, T0 + 210000, '★ 정규화하면 같은 값 — updatedAt 그대로');
  // 옛 레코드(정규화 전 값이 저장돼 있던 것 — 8f-2 배포판이 쓴 것)도 그대로 가져오기에서 "그대로"
  const legacy = Object.assign({}, await store.findTerm('pruritus', 'ar'), { translation: 'حكة   شديدة ', contextTr: ' x  y ' });
  await db.put('cards', legacy);
  const all = await store.list();
  const csv = buildCsv(all);
  const plan = importPlan(parseCsv(csv).rows, all, { nowMs: T0 + 300000 });
  assert.equal(plan.change.length + plan.conflict.length + plan.add.length + plan.reject.length, 0, JSON.stringify(plan.change));
  assert.equal(plan.same.length, all.length, '★ 그대로 n');
  // 흐름으로 적용해도 아무 레코드도 바뀌지 않는다
  const flow = U.createImportFlow({ store: store, now: () => T0 + 300000 });
  const r = await flow.read(csv);
  assert.deepEqual(r.view.counts, { add: 0, change: 0, same: all.length, conflict: 0, reject: 0 });
  await flow.apply();
  assert.deepEqual(await store.list(), all, '★ edited·updatedAt 불변');
  assert.equal(fieldValue('pos', 'NOUN'), 'noun');
  assert.equal(fieldValue('pos', 'weird'), 'other');
  assert.equal(fieldValue('note', ' a\r\nb '), 'a\nb');
  assert.equal(fieldValue('translation', ' a \n b '), 'a b');
});

test('U5 ★ 한 칸 고친 CSV → 바뀜 1 · 엑셀식(BOM·CRLF·모든 칸 따옴표·수식 접두) 그대로 → 변화 0 · `=SUM(1)` 메모 왕복', async () => {
  clock = T0 + 400000;
  const f = await seed('Fever', { translation: 'حمى', note: '=SUM(1)', gloss: '@risk, "high"' });
  const all = await store.list();
  const csv = buildCsv(all);
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.includes("'=SUM(1)"), '수식 접두로 나간다');
  assert.ok(csv.includes('"\'@risk, ""high"""'), '접두 + 따옴표');
  // 엑셀이 다시 저장한 꼴 — 모든 칸 따옴표(안의 " 는 ""), 수식 접두 `'` 그대로, CRLF, BOM 그대로
  const rec = parseCsv(csv);
  const xl = (v) => { const s = /^'*[=+\-@\t\r]/.test(v) ? "'" + v : v; return '"' + s.replace(/"/g, '""') + '"'; };
  const excel = '﻿' + [VOCAB.CSV_COLUMNS.map((c) => '"' + c + '"').join(',')]
    .concat(rec.rows.map((r) => VOCAB.CSV_COLUMNS.map((c) => xl(r[c] || '')).join(','))).join('\r\n') + '\r\n';
  const p0 = parseCsv(excel);
  assert.equal(p0.ok, true);
  assert.equal(p0.rows.find((r) => r.term === 'Fever').note, '=SUM(1)', '가져오면 원래대로');
  const flow = U.createImportFlow({ store: store, now: () => T0 + 500000 });
  const r0 = await flow.read(excel);
  assert.deepEqual(r0.view.counts, { add: 0, change: 0, same: all.length, conflict: 0, reject: 0 }, '엑셀식 그대로 → 그대로 n');
  flow.cancel();
  // 한 칸 고침(번역) — updated 는 내보낸 때 그대로(같은 시각 + 내용 다름 → 바뀜 — 8f-1 정정 ①)
  const idx = rec.rows.findIndex((x) => x.term === 'Fever');
  const one = setCell(csv, idx, 'translation', 'حمّى');
  const r1 = await flow.read(one);
  assert.deepEqual(r1.view.counts, { add: 0, change: 1, same: all.length - 1, conflict: 0, reject: 0 }, '★ 바뀜 1');
  await flow.apply();
  const g = await store.findTerm('fever', 'ar');
  assert.equal(g.translation, 'حمّى');
  assert.equal(g.edited, true);
  assert.equal(g.note, '=SUM(1)');
  assert.equal(g.id, f.id);
});

test('U6 ★ 미리보기 먼저 — read 는 쓰지 않는다(applyImport 0) · apply 만 한 번 · 거절 사유와 줄 번호 · 상한·머리 줄 오류', async () => {
  const log = { apply: 0 };
  const spy = { list: async () => [], applyImport: async (p) => { log.apply++; log.plan = p; return { added: p.add.length, changed: p.change.length, skipped: 0 }; } };
  const flow = U.createImportFlow({ store: spy, now: () => T0, docs: () => [{ id: 'dB', title: 'My Book' }] });
  const H = VOCAB.CSV_COLUMNS.join(',');
  const row = (o) => VOCAB.CSV_COLUMNS.map((c) => V.csvCell(o[c] == null ? '' : o[c])).join(',');
  const csv = H + '\r\n' + [row({ term: 'Edema', target_lang: 'ar', document: 'My Book' }), row({ term: '', target_lang: 'ar' }),
    row({ term: 'Gout', target_lang: '' }), row({ term: 'edema', target_lang: 'ar' })].join('\r\n');
  const r = await flow.read(csv);
  assert.equal(log.apply, 0, '★ 미리보기만 — 아직 쓰지 않는다');
  assert.equal(flow.pending(), true);
  assert.deepEqual(r.view.counts, { add: 1, change: 0, same: 0, conflict: 0, reject: 3 });
  assert.deepEqual(r.view.rejects, [{ reason: 'term', rows: [3] }, { reason: 'target', rows: [4] }, { reason: 'dup', rows: [5] }], '파일 줄 번호(머리 줄 = 1)');
  await flow.apply();
  assert.equal(log.apply, 1);
  assert.equal(log.plan.add[0].docId, 'dB', '제목이 같은 이 기기 책에 잇는다');
  assert.equal(flow.pending(), false);
  assert.equal(await flow.apply(), null, '계획을 버렸다 — 두 번 쓰지 않는다');
  assert.deepEqual(await flow.read('a,b\r\n1,2'), { ok: false, reason: 'header' });
  assert.deepEqual(await flow.read(H + '\r\n' + 'x'.repeat(VOCAB.IMPORT_MAX_BYTES)), { ok: false, reason: 'size' });
  assert.equal(U.rowList([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), '2, 3, 4, 5, 6, 7, 8, 9, 10, 11 …');
  // 화면은 [가져오기] 단추에서만 apply 를 부른다
  const ui = strip(src('../js/ui/vocab.js'));
  assert.equal((ui.match(/importFlow\.apply\(\)/g) || []).length, 1);
  assert.match(ui, /async function applyImport\(\) \{\s*if \(!importFlow\.pending\(\)\) return;/);
  assert.match(ui, /if \(a === 'import-apply'\) \{ applyImport\(\); return; \}/);
  const onFile = ui.slice(ui.indexOf('async function onFile('), ui.indexOf('function renderPreview('));
  assert.ok(!/apply/.test(onFile.replace(/applyTranslations/g, '')), '파일을 고른 것만으로는 적용하지 않는다');
});

/* ══ 4. [번역 안 된 것 모두 번역 (n)] ═══════════════════════ */

function fakeTerms(mode) {
  const calls = [];
  const fn = async (items, opts) => {
    calls.push({ items, opts });
    const results = items.map((it, i) => {
      if (mode === 'mismatch' && (i === 3 || i === 7)) return { state: 'failed', code: 'MISSING' };
      if (mode === 'blocked') return { state: 'blocked', code: 'capped' };
      return { state: 'ready', value: { translation: 'ترجمة ' + it.term, gloss: 'شرح', pos: 'noun', lemma: it.term } };
    });
    return { status: 'ready', calls: mode === 'blocked' ? 0 : 1, results };
  };
  fn.calls = calls;
  return fn;
}

test('U7 ★ [번역 안 된 것 모두 번역 (25)] → 1호출·20개(retry:true) → (5) · `i` 어긋남 2개는 그 항목만 빈 채 → (7) · 다시 누름 → 다시 보냄', async () => {
  clock = T0 + 1000000;
  const ids = [];
  for (let i = 0; i < 25; i++) {
    clock++;
    ids.push((await seed('bulkword' + String.fromCharCode(97 + i), { docId: 'docBulk', docTitle: 'Bulk', translation: '', note: 'MY_NOTE_' + i })).id);
  }
  await seed('alreadydone', { docId: 'docBulk', translation: 'موجود' });
  const docs = [{ id: 'docBulk', title: 'Bulk', lang: 'en', domain: 'general' }];
  const scope = async () => U.scopeEntries(await store.list(), 'docBulk');
  assert.equal(U.bulkCount(await scope(), docs), 25);
  const tt = fakeTerms('mismatch');
  const r = await U.runBulk(await scope(), { translateTerms: tt, update: (id, p, o) => store.update(id, p, o), docs, consented: true });
  assert.equal(tt.calls.length, 1, '★ 누름 1번 = 1호출');
  assert.equal(tt.calls[0].items.length, VOCAB.BATCH_MAX);
  assert.deepEqual(tt.calls[0].opts, { src: 'en', target: 'ar', docId: 'docBulk', domain: 'general', retry: true }, '★ retry:true(crossstep ③)');
  for (const it of tt.calls[0].items) assert.deepEqual(Object.keys(it).sort(), ['context', 'src', 'surface', 'term'], '낱말·문장·언어뿐 — 메모·번역 0');
  assert.ok(!JSON.stringify(tt.calls[0].items).includes('MY_NOTE'));
  assert.deepEqual(tt.calls[0].items.map((x) => x.term), ids.slice(0, 20).map((_, i) => 'bulkword' + String.fromCharCode(97 + i)), '추가한 순서');
  assert.deepEqual([r.calls, r.sent, r.done, r.failed, r.more, r.blocked, r.gate], [1, 20, 18, 2, 0, null, null]);
  assert.equal(U.bulkCount(await scope(), docs), 7, '★ (25) → 남은 5 + 실패 2');
  const got = (await scope()).find((e) => e.term === 'bulkworda');
  assert.equal(got.translation, 'ترجمة bulkworda');
  assert.equal(got.origin, 'ai');
  assert.equal(got.edited, false);
  assert.equal(got.gloss, 'شرح');
  assert.equal(got.note, 'MY_NOTE_0', '메모는 그대로');
  assert.equal((await scope()).find((e) => e.term === 'bulkwordd').translation, '', '★ 어긋난 항목은 빈 채');
  // 다시 누름 — 실패 2 + 남은 5 → 1호출
  const t2 = fakeTerms();
  const r2 = await U.runBulk(await scope(), { translateTerms: t2, update: (id, p, o) => store.update(id, p, o), docs, consented: true });
  assert.equal(t2.calls.length, 1);
  assert.equal(t2.calls[0].items.length, 7);
  assert.ok(t2.calls[0].items.some((x) => x.term === 'bulkwordd'), '실패한 단어를 다시 보낸다');
  assert.equal(r2.done, 7);
  assert.equal(U.bulkCount(await scope(), docs), 0);
  assert.equal(U.bulkPlan(await scope(), docs), null);
  const t3 = fakeTerms();
  await U.runBulk(await scope(), { translateTerms: t3, update: () => {}, docs, consented: true });
  assert.equal(t3.calls.length, 0, '번역할 것이 없으면 0');
});

test('U8 bulk 문지기·묶음 — 동의 없음 → 0호출 · 막힘(capped) → 쓰지 않음 · 같은 대상 언어·같은 책만 한 묶음 · 원문 언어 = 항목 → 책 · 같은 언어·언어 모름은 세지 않음', async () => {
  const mk = (id, over) => Object.assign({ id, kind: 'term', term: id, surface: id, srcLang: 'en', targetLang: 'ar', translation: '', docId: 'D1', createdAt: 1 }, over);
  const list = [mk('a', { createdAt: 3 }), mk('b', { targetLang: 'ko', createdAt: 1 }), mk('c', { createdAt: 2 }), mk('d', { docId: 'D2', createdAt: 4 }),
    mk('e', { srcLang: '', docId: 'D3', createdAt: 5 }), mk('f', { srcLang: '', docId: null, createdAt: 6 }), mk('g', { srcLang: 'ar', createdAt: 7 })];
  const docs = [{ id: 'D3', lang: 'fr' }];
  assert.equal(U.bulkSrc(list[4], docs), 'fr', '항목 원문 언어가 없으면 그 책 언어');
  assert.equal(U.bulkSrc(list[5], docs), '', '언어를 모르면 대상 아님');
  assert.equal(U.bulkSrc(list[6], docs), '', '원문 = 대상 언어');
  assert.equal(U.bulkCount(list, docs), 5);
  const p = U.bulkPlan(list, docs);
  assert.deepEqual([p.target, p.docId, p.ids], ['ko', 'D1', ['b']], '가장 먼저 추가한 항목의 묶음(대상 ko · 책 D1)만');
  const p2 = U.bulkPlan(list.filter((x) => x.id !== 'b'), docs);
  assert.deepEqual(p2.ids, ['c', 'a'], '같은 대상·같은 책 — 추가한 순');
  assert.equal(p2.domain, 'medical', '책이 없으면 기본 문체');
  const tt = fakeTerms();
  const r = await U.runBulk(list, { translateTerms: tt, update: () => { throw new Error('no'); }, docs, consented: false });
  assert.deepEqual([tt.calls.length, r.gate], [0, 'consent'], '★ 동의 없음 → 보내지 않는다');
  const ups = [];
  const tb = fakeTerms('blocked');
  const rb = await U.runBulk(list, { translateTerms: tb, update: async (id) => { ups.push(id); }, docs, consented: true });
  assert.deepEqual([rb.blocked, rb.done, ups.length], ['capped', 0, 0], '막힘 → 아무것도 쓰지 않는다');
  const many = Array.from({ length: 30 }, (_, i) => mk('w' + i, { createdAt: i }));
  assert.equal(U.bulkPlan(many, []).items.length, VOCAB.BATCH_MAX);
});

test('U9 ★ bulk + 실제 파이프라인·흉내 Gemini — 25개 → 요청 1건·20항목 · 응답에서 i 하나 빠짐 → 그 항목만 빈 채 · 사용자 메모 본문 0 · byKind.term', async () => {
  const mdb = memDb();
  const fetchCalls = [];
  const fetch = stubFetch((url, init) => {
    fetchCalls.push(init);
    const user = JSON.parse(init.body).contents[0].parts[0].text;
    const items = JSON.parse(user.slice(user.indexOf('<<<DOC\n') + 7, user.lastIndexOf('\n>>>')));
    const out = items.filter((it) => it.i !== 5).map((it) => ({ i: it.i, term: it.term, lemma: it.term, pos: 'noun', translation: 'ترجمة', gloss: 'شرح' }));
    return jsonRes(200, geminiOk(JSON.stringify({ items: out, notes: '' })));
  });
  const timers = manualTimers();
  const p = createPipeline({ fetch, db: mdb, cache: createCache({ db: mdb, now: () => T0 }), getKey: () => FAKE_KEY,
    getSetting: settingsOf(), now: () => T0, isOnline: () => true, setTimer: timers.set, clearTimer: timers.clear, listen: false });
  const ents = Array.from({ length: 25 }, (_, i) => ({ id: 'x' + i, kind: 'term', term: 'term' + i, surface: 'Term' + i, srcLang: 'en', targetLang: 'ar',
    translation: '', note: 'USERNOTE', context: 'Context sentence ' + i + '.', docId: 'DD', createdAt: i }));
  const ups = new Map();
  const r = await U.runBulk(ents, { translateTerms: (i, o) => p.translateTerms(i, o), update: async (id, patch) => { ups.set(id, patch); }, docs: [], consented: true });
  assert.equal(fetchCalls.length, 1, '★ 요청 1건');
  const user = JSON.parse(fetchCalls[0].body).contents[0].parts[0].text;
  assert.equal(JSON.parse(user.slice(user.indexOf('<<<DOC\n') + 7, user.lastIndexOf('\n>>>'))).length, 20);
  assert.ok(!fetchCalls[0].body.includes('USERNOTE'), '사용자 글 0');
  assert.deepEqual([r.done, r.failed], [19, 1]);
  assert.ok(!ups.has('x5'), '★ i 빠진 항목은 쓰지 않는다');
  assert.equal(ups.get('x0').origin, 'ai');
  assert.equal(ups.get('x0').edited, false);
  assert.ok(!ups.has('x20'), '21번째부터는 다음 누름');
});

/* ══ 5. 편집 · edited 규칙 · 바뀐 항목 수 ═══════════════════ */

test('U10 ★ 편집 — editPatch(바뀐 것만·정규화) → update(user) → edited:true·updatedAt · "마지막 내보내기 뒤 바뀐 항목 1개" · 원어 빔 거절 · 삭제', async () => {
  clock = T0 + 2000000;
  const e = await seed('Dyspnea', { translation: 'ضيق النفس', pos: 'noun' });
  const lastExport = T0 + 2000500;
  clock = T0 + 2001000;
  assert.equal(U.changedCount(await store.list(), lastExport), 0);
  const r = U.editPatch(e, { surface: 'Dyspnea', translation: ' ضيق  التنفس ', gloss: '', pos: 'NOUN', note: 'my note ' });
  assert.deepEqual(r.patch, { translation: 'ضيق التنفس', note: 'my note' }, '바뀐 것만(품사 대소문자·빈 뜻은 같음)');
  const u = await store.update(e.id, r.patch, { user: true });
  assert.equal(u.edited, true);
  assert.equal(u.updatedAt, T0 + 2001000);
  assert.equal(U.changedCount(await store.list(), lastExport), 1, '★ 마지막 내보내기 뒤 바뀐 항목 1개');
  assert.equal(U.changedCount(await store.list(), new Date(lastExport).toISOString()), 1, 'ISO 도');
  assert.equal(U.changedCount([], null), null, '내보낸 적 없음');
  assert.deepEqual(U.editPatch(e, { surface: ' ... ' }), { error: 'term' });
  assert.deepEqual(U.editPatch(e, { surface: 'Dyspnoea' }).patch, { surface: 'Dyspnoea' });
  assert.equal(await store.remove(e.id), true);
  assert.equal(await store.findTerm('dyspnea', 'ar'), null);
});

test('U11 ★ 8f-2 남은 문제 2 — 사용자가 받아들인 다시 번역은 edited:false · 사용자 수정은 patch 의 edited 를 무시하고 true', async () => {
  clock = T0 + 3000000;
  const e = await seed('Syncope', { translation: 'إغماء' });
  await store.update(e.id, { translation: 'غشي' }, { user: true });
  assert.equal((await store.findTerm('syncope', 'ar')).edited, true);
  const tt = async () => ({ status: 'ready', calls: 1, results: [{ state: 'ready', value: { translation: 'إغماء', gloss: 'فقدان وعي', pos: 'noun', lemma: 'syncope' } }] });
  const f = W.createSheetFlow({ store, translateTerms: tt, sentenceTr: async () => null, gate: () => ({ ok: true }) });
  await f.open({ surface: 'syncope', srcLang: 'en', docLang: 'en', targetLang: 'ar', context: 'The Syncope was noted.', unit: null, docId: 'docU', docTitle: 'Book U', pageNo: 7, lineId: '7:3' });
  const ask = await f.retranslate();
  assert.equal(ask.ask, true, '고친 항목 — 먼저 묻는다');
  clock = T0 + 3001000;
  await f.confirmAsk();
  const after = await store.findTerm('syncope', 'ar');
  assert.equal(after.translation, 'إغماء');
  assert.equal(after.edited, false, '★ 받아들인 다시 번역 → 고친 표시 내림');
  assert.equal(after.origin, 'ai');
  // 다음 다시 번역은 묻지 않는다
  const again = await f.retranslate();
  assert.equal(again.ask, false);
  // 사용자 수정은 patch 의 edited:false 를 무시
  const u = await store.update(e.id, { translation: 'x', edited: false }, { user: true });
  assert.equal(u.edited, true);
  const ws = strip(src('../js/ui/wordsheet.js'));
  assert.match(ws, /origin: 'ai', edited: false, context: q\.context/);
});

/* ══ 6. 8f-2 Review 넘김 — 시트 ═══════════════════════════ */

test('U12 ★ 8f2R ④ 질문 중 retranslate 다시 → 아무것도 안 함(묻지 않은 force 0) · ⑤ [AI] 연타(진행 중) → translateTerms 1번 · ⑥ 문맥 바꾸기 patch 에 docId', async () => {
  const entry = { id: 'vt:q', kind: 'term', term: 'arthritis', translation: 'MINE', edited: true, context: 'Old sentence.', docId: 'D_OLD' };
  const log = [];
  const st = { findTerm: async () => entry, save: async () => ({ entry, created: false }), update: async (id, patch, o) => { log.push({ patch, o }); return Object.assign({}, entry, patch); } };
  let n = 0;
  const tt = async () => { n++; return { status: 'ready', calls: 1, results: [{ state: 'ready', value: { translation: 'T', gloss: '', pos: '', lemma: '' } }] }; };
  const f = W.createSheetFlow({ store: st, translateTerms: tt, sentenceTr: async () => 'جملة', gate: () => ({ ok: true }) });
  const Q = { surface: 'arthritis', srcLang: 'en', docLang: 'en', targetLang: 'ar', context: 'New sentence here.', unit: null, docId: 'D_NEW', docTitle: 'New', pageNo: 9, lineId: '9:1' };
  await f.open(Q);
  assert.equal((await f.retranslate()).ask, true);
  const twice = await f.retranslate();
  assert.equal(n, 0, '★ 질문 중 다시 불러도 보내지 않는다');
  assert.equal(twice.ask, true, '질문 그대로');
  f.cancelAsk();
  // ⑥ 문맥 바꾸기 — 다른 책 문장으로 바꾸면 docId 가 옮겨간다
  await f.useContext();
  assert.equal(log[0].patch.docId, 'D_NEW', '★ docId');
  assert.equal(log[0].patch.pageNo, 9);
  assert.equal(log[0].patch.lineId, '9:1');
  assert.deepEqual(log[0].o, { user: false });
  // ⑤ [AI] 연타 — 진행 중 공유가 없는 가짜 파이프라인으로도 1번
  let release;
  let m = 0;
  const slow = async () => { m++; await new Promise((r) => { release = r; }); return { status: 'ready', calls: 1, results: [{ state: 'ready', value: { translation: 'S', gloss: '', pos: '', lemma: '' } }] }; };
  const g = W.createSheetFlow({ store: { findTerm: async () => null, save: async () => ({}), update: async () => null }, translateTerms: slow, sentenceTr: async () => null, gate: () => ({ ok: true }) });
  await g.open(Object.assign({}, Q, { surface: 'nodule' }));
  const p1 = g.ai();
  const p2 = g.ai();
  const p3 = g.ai();
  await new Promise((r) => setImmediate(r));
  assert.equal(m, 1, '★ 진행 중 다시 누름 → 1번');
  release();
  await Promise.all([p1, p2, p3]);
  assert.equal(g.view().draft.translation, 'S');
});

test('U13 8f2R ⑩ 여러 줄 선택 끝이 낱말 가운데면 넓힘 — wordTailAt · pickSurface endTail(선택이 낱말 글자로 끝날 때만)', () => {
  assert.equal(W.wordTailAt('arthritis is common', 5), 'itis');
  assert.equal(W.wordTailAt('arthritis is common', 9), '', '낱말 끝');
  assert.equal(W.wordTailAt('arthritis is common', 10), '', '공백 뒤');
  assert.equal(W.wordTailAt("crohn's disease", 3), "hn's", '아포스트로피 안 낱말');
  assert.equal(W.wordTailAt('C-reactive protein', 3), 'eactive');
  assert.equal(W.wordTailAt('abc', 0), '');
  assert.equal(W.wordTailAt('abc', 3), '');
  assert.equal(W.pickSurface({ lineText: 'with rheumatoid', start: 5, end: 15, multi: true, selText: 'rheumatoid\narthr', endTail: 'itis' }), 'rheumatoid arthritis', '★ 끝 넓힘');
  assert.equal(W.pickSurface({ lineText: 'with rheumatoid', start: 5, end: 15, multi: true, selText: 'rheumatoid\narthritis ', endTail: 'xx' }), 'rheumatoid arthritis', '공백으로 끝난 선택엔 붙이지 않는다');
  assert.equal(W.pickSurface({ lineText: 'with Rheumatoid', start: 8, end: 15, multi: true, selText: 'umatoid\narthritis.' }), 'Rheumatoid arthritis', '8f-2 W1 그대로');
  const ws = strip(src('../js/ui/wordsheet.js'));
  assert.match(ws, /endTail: snap\.multi \? endTailOf\(line\) : null/);
});

test('U14 8f2R ②③⑦ — 포커스 잃음 방지(질문 → [그대로 두기]) · 상태 줄을 비우지 않음 · #wsAsk live · 단추 줄이 짧은 뜻·문장 번역 위 · 단어장 링크 켜기 · termServices', () => {
  const ws = strip(src('../js/ui/wordsheet.js'));
  assert.ok(!/els\.status\.textContent = v\.ask \? ''/.test(ws), '★ 질문 중 상태 줄을 비우지 않는다');
  assert.match(ws, /els\.status\.textContent = v\.ask \? t\('vs\.found\.saved'\)/);
  assert.match(ws, /if \(els\.askQ\) els\.askQ\.textContent = v\.ask \? t\('vs\.overwriteAsk'\) : '';/);
  assert.match(ws, /const hadFocus = typeof document !== 'undefined' && els\.sheet\.contains\(document\.activeElement\);/);
  assert.match(ws, /if \(hadFocus\) keepFocus\(v\);/);
  const kf = ws.slice(ws.indexOf('function keepFocus('), ws.indexOf('function paintLink('));
  assert.match(kf, /if \(v\.ask\) next = els\.ask\.querySelector\('\[data-ws-action="askNo"\]'\);/, '질문 → [그대로 두기]');
  assert.match(kf, /\.ws-actions \[data-ws-action\]/);
  assert.match(ws, /els\.link\.setAttribute\('href', vocabHash\(q\.docId\)\);/, '★ 시트 링크 #/vocab/:docId');
  assert.match(ws, /export function termServices\(\)/);
  const html = src('../index.html');
  const sheet = html.slice(html.indexOf('id="wordSheet"'), html.indexOf('</div>\n\n    <!-- `[8e'));
  assert.match(sheet, /<div class="ws-ask" id="wsAsk" role="group" aria-labelledby="wsAskQ" aria-live="polite" hidden>/);
  const at = (s) => sheet.indexOf(s);
  assert.ok(at('id="wsField"') < at('id="wsAsk"') && at('id="wsAsk"') < at('id="wsActions"') && at('id="wsActions"') < at('id="wsGlossRow"') && at('id="wsActions"') < at('id="wsCtxRow"'), '★ 단추 줄이 번역 칸 바로 아래(⑦)');
  // ⑧ vs.hint 는 이제 생긴 단어장 화면([번역 안 된 것 모두 번역])과 맞는 말이다 — 네 언어 모두 단어장/모아 번역을 말한다
  assert.match(BUNDLES.ko['vs.hint'], /단어장에서 모아 번역/);
  assert.match(BUNDLES.ko['vocab.bulk'], /번역 안 된 것 모두 번역/);
});

/* ══ 7. 내보내기 · 순수 목록 ═══════════════════════════════ */

test('U15 ★ 내보내기 — 파일 이름·BOM·CRLF·줄 수 · Anki 머리 3줄 · 키 문자열 0(가짜 키를 저장소에 둠) · 공유 주의 한 줄(4언어) · Blob·revoke·lastExportAt', async () => {
  const FAKE = 'AQ.' + 'Ab_DUMMY_NOT_A_REAL_KEY_8f3_vocab_ui';
  keys.saveKey('gemini', FAKE);
  assert.equal(keys.readKeySecret('gemini'), FAKE);
  const list = await store.list();
  assert.ok(list.length >= 5);
  const now = new Date(2026, 0, 5, 9, 0, 0).getTime();
  const c = U.exportFile('csv', list, now);
  assert.equal(c.name, 'medreader-vocab-20260105.csv');
  assert.match(c.mime, /^text\/csv/);
  assert.equal(c.text.charCodeAt(0), 0xFEFF);
  assert.equal(parseCsv(c.text).rows.length, list.length);
  const a = U.exportFile('anki', list, now);
  assert.equal(a.name, 'medreader-vocab-20260105.txt');
  assert.deepEqual(a.text.split('\n').slice(0, 3), VOCAB.ANKI_HEADER.slice());
  assert.equal(a.text.split('\n').filter(Boolean).length, list.length + 3);
  for (const f of [c, a]) { assert.equal(f.text.indexOf(FAKE), -1); assert.equal(f.text.indexOf('Ab_DUMMY'), -1); }
  keys.clearKey('gemini');
  const html = src('../index.html');
  const panel = html.slice(html.indexOf('id="vocabExport"'), html.indexOf('id="vocabPreview"'));
  assert.match(panel, /data-i18n="vocab\.export\.share"/, '★ 공유 주의 한 줄(8cf-Q2)');
  for (const l of LANGS) assert.ok(BUNDLES[l]['vocab.export.share'].length > 10, l);
  const ui = strip(src('../js/ui/vocab.js'));
  assert.match(ui, /URL\.createObjectURL\(blob\)/);
  assert.match(ui, /URL\.revokeObjectURL\(url\)/);
  assert.match(ui, /a\.download = f\.name;/);
  assert.match(ui, /await settings\.set\('vocab\.lastExportAt', nowMs\);/);
  assert.match(ui, /exportFile\(kind, viewRows\(S\.all, \{ sort: 'alpha' \}\), nowMs\)/, '17-7-4 — 단어장 전체');
});

test('U16 목록 — scopeEntries·viewRows(찾기: 원어·번역, NFKC·소문자 · 정렬: 추가일 새것 먼저/알파벳) · scopeOptions(지운 책) · importCounts·rejectSummary', () => {
  const mk = (id, over) => Object.assign({ id, kind: 'term', term: id, surface: id, translation: '', targetLang: 'ar', docId: 'A', createdAt: 0 }, over);
  const all = [mk('zeta', { createdAt: 1, translation: 'زيتا' }), mk('alpha', { createdAt: 3, surface: 'Alpha' }), mk('mid', { createdAt: 2, docId: 'GONE', docTitle: 'Old Book' }),
    { id: 's1', kind: 'sentence', docId: 'A' }];
  assert.equal(U.scopeEntries(all, null).length, 3, 'term 만');
  assert.deepEqual(U.scopeEntries(all, 'A').map((e) => e.id), ['zeta', 'alpha']);
  assert.deepEqual(U.viewRows(U.scopeEntries(all), {}).map((e) => e.id), ['alpha', 'mid', 'zeta'], '추가일 새것 먼저');
  assert.deepEqual(U.viewRows(U.scopeEntries(all), { sort: 'alpha' }).map((e) => e.id), ['alpha', 'mid', 'zeta']);
  assert.deepEqual(U.viewRows(U.scopeEntries(all), { query: 'ＡＬＰ' }).map((e) => e.id), ['alpha'], 'NFKC·소문자');
  assert.deepEqual(U.viewRows(U.scopeEntries(all), { query: 'زيت' }).map((e) => e.id), ['zeta'], '번역으로도');
  const opts = U.scopeOptions(all, [{ id: 'A', title: 'Book A' }, { id: 'B', title: 'Book B' }]);
  assert.deepEqual(opts.map((o) => [o.value, o.n, o.gone]), [['', 3, false], ['A', 2, false], ['B', 0, false], ['GONE', 1, true]]);
  assert.equal(opts[3].title, 'Old Book', '지운 책은 docTitle 사본');
  assert.deepEqual(U.importCounts({ add: [1], change: [], same: [1, 2], conflict: [1], reject: [] }), { add: 1, change: 0, same: 2, conflict: 1, reject: 0 });
  assert.deepEqual(U.rejectSummary({ reject: [{ row: 0, reason: 'dup' }, { row: 4, reason: 'term' }] }), [{ reason: 'term', rows: [6] }, { reason: 'dup', rows: [2] }]);
  assert.equal(U.exportName('csv', new Date(2026, 10, 16).getTime()), 'medreader-vocab-20261116.csv');
});

/* ══ 8. 마크업 · CSS · i18n · 위생 ═══════════════════════════ */

test('U17 마크업·CSS — 원어 칸 dir=ltr · 편집·삭제는 페이지 안 <dialog>(confirm 0) · 48px · 논리 속성만 · 시트 링크 48px', () => {
  const html = src('../index.html');
  const sec = html.slice(html.indexOf('data-screen="vocab"'), html.indexOf('<!-- ════ 사용량'));
  assert.match(sec, /<dialog class="vocab-edit" id="vocabEdit"/);
  assert.match(sec, /<dialog class="confirm-dialog" id="vocabDelDialog"/);
  assert.match(sec, /<input type="text" id="vocabEditTerm" dir="ltr"/);
  assert.match(sec, /<p class="vocab-ctx-src" id="vocabEditCtx" dir="ltr"><\/p>/);
  assert.ok(!/onclick|style=/.test(sec));
  assert.match(html, /"\.\/js\/ui\/vocab\.js": "\.\/js\/ui\/vocab\.js\?v=[0-9a-f]{10}"/, 'import map 도장');
  const ui = strip(src('../js/ui/vocab.js'));
  assert.ok(!/\bconfirm\(/.test(ui), 'confirm() 쓰지 않음');
  assert.match(ui, /term\.setAttribute\('dir', 'ltr'\);/, '목록 원어 칸 dir=ltr');
  const css = src('../css/screens.css');
  const v = css.slice(css.indexOf('`[8f-3 — spec 17-7-3 화면'));
  assert.ok(v.length > 500);
  assert.match(v, /\.vocab-row \{[\s\S]*?min-block-size: var\(--tap\);/);
  assert.match(v, /\.vocab-tools select,\s*\.vocab-tools input\[type="search"\] \{[\s\S]*?min-block-size: var\(--tap\);/);
  assert.match(v, /\.vocab-check \{[\s\S]*?min-block-size: var\(--tap\);/);
  assert.match(v, /\.word-sheet \.ws-vocab \{[\s\S]*?min-block-size: var\(--tap\);/);
  assert.ok(!/\b(left|right|margin-left|margin-right|padding-left|padding-right|text-align:\s*(left|right))\s*:/.test(v.replace(/\/\*[\s\S]*?\*\//g, '')), '논리 속성만(16-H)');
});

test('U18 i18n 4언어 — 화면·마크업이 쓰는 키가 모두 있다 · 품사 7개 UI 언어 · 자리표시자 · innerHTML 0 · 호출 길은 termServices 하나 · import 방향', () => {
  const ui = src('../js/ui/vocab.js');
  const html = src('../index.html');
  const sec = html.slice(html.indexOf('data-screen="vocab"'), html.indexOf('<!-- ════ 사용량'));
  const used = new Set();
  for (const m of ui.matchAll(/'((?:vocab|vs|readalong|library\.card)\.[a-zA-Z.]+)'/g)) if (!m[1].endsWith('.') && m[1] !== 'vocab.lastExportAt') used.add(m[1]);
  for (const m of sec.matchAll(/data-i18n(?:-aria)?="([a-zA-Z.]+)"/g)) used.add(m[1]);
  for (const p of VOCAB.POS) used.add('vocab.pos.' + p);
  for (const r of ['term', 'target', 'dup']) used.add('vocab.import.reason.' + r);
  for (const r of ['size', 'rows', 'header', 'empty', 'read']) used.add('vocab.import.err.' + r);
  used.add('library.card.vocab');
  assert.ok(used.size >= 50, String(used.size));
  for (const l of LANGS) for (const k of used) assert.ok(typeof BUNDLES[l][k] === 'string' && BUNDLES[l][k].length > 0, l + ' ' + k);
  assert.match(BUNDLES.en['vocab.bulk'], /\{n\}/);
  assert.match(BUNDLES.ar['vocab.import.counts'], /\{add\}[\s\S]*\{change\}[\s\S]*\{same\}[\s\S]*\{conflict\}[\s\S]*\{reject\}/);
  const s = strip(ui);
  assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(s), 'innerHTML 0');
  assert.ok(!/\bfetch\(|buildTermRequest|TERM_SCHEMA|createPipeline/.test(s), '요청 꼴·파이프라인을 직접 만들지 않는다');
  assert.equal((s.match(/pipeline\.translateTerms\(/g) || []).length, 1, '호출 길 하나(bulk — 시트와 같은 파이프라인)');
  assert.match(s, /translateTerms: \(items, opts\) => sv\.pipeline\.translateTerms\(items, opts\)/);
  const pure = s.slice(s.indexOf('export const VOCAB_PAGE'), s.indexOf('let root = null;'));
  assert.ok(!/\b(document|window|navigator)\b/.test(pure), '순수·흐름 부분은 DOM 을 모른다');
  // 서비스 계층 import 방향 그대로(8f-1 K2) — store 는 ui·ai 를 모른다
  const st = strip(src('../js/vocab/store.js'));
  assert.ok(!/from '\.\.\/(ui|ai)\//.test(st));
});
