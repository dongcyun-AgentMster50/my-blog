/* ============================================================
   tests/vocab-8f.test.mjs — 8f-1 단어장 데이터 (spec 17-7 · 17-7-6 4-3·4-4·4-6 · 8 "8f-1" 수용 기준)

   - 순수 `text/vocab.js`: normalizeTerm · findInSentenceTr · CSV/Anki · parseCsv · importPlan
   - 서비스 `vocab/store.js`(fake-idb): save(중복 없음)·findTerm·update(edited·updatedAt)·list·changedSince·applyImport
     — ★ 시각은 숫자 ms, 복습 필드(`sm2`·`dueAt`·`reviewedAt`·`introducedAt`)를 덮지 않는다(12-D10·D18, crossstep 8f-1 ②)
   - `db.deleteDocument`: 그 문서의 `kind:'term'` 은 남고 문장 카드·kind 없는 카드는 지워진다
   - 내보낸 파일에 키 문자열 0건(가짜 키를 저장소에 둔 상태)
   실물 PDF 문장은 쓰지 않는다(지어낸 문장).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
const idb = installFakeIdb();

/* 키 저장소 흉내(13절 — 내보낸 파일에 키가 섞이지 않는지 보려고 가짜 키를 실제로 둔다). */
function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
globalThis.sessionStorage = memStorage();
globalThis.localStorage = memStorage();

const db = await import('../js/db.js');
const V = await import('../js/text/vocab.js');
const { createVocabStore, termIdOf } = await import('../js/vocab/store.js');
const { expandWord, clampSelection } = await import('../js/text/select.js');
const { VOCAB } = await import('../js/config.js');
const keys = await import('../js/privacy/keys.js');

const { normalizeTerm, findInSentenceTr, buildCsv, buildAnki, parseCsv, importPlan, newTermEntry, csvCell, unFormula } = V;
const T0 = new Date(2026, 10, 16, 9, 0, 0).getTime();
const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/* ══ 1. normalizeTerm · expandWord ══════════════════════ */

test('N1 normalizeTerm — NFKC·소문자·공백 하나·앞뒤 구두점 제거·`|` 제거·숨은 하이픈 제거, 낱말 안 하이픈·아포스트로피는 둔다', () => {
  assert.equal(normalizeTerm('  Rheumatoid   Arthritis, '), 'rheumatoid arthritis');
  assert.equal(normalizeTerm('ﬁbrosis'), 'fibrosis', 'NFKC 합자');
  assert.equal(normalizeTerm('ＣＲＰ'), 'crp', 'NFKC 전각');
  assert.equal(normalizeTerm('"(C-reactive protein)."'), 'c-reactive protein');
  assert.equal(normalizeTerm("Crohn's"), "crohn's");
  assert.equal(normalizeTerm('a|b'), 'a b');
  assert.ok(!normalizeTerm('|x|y|').includes('|'));
  assert.equal(normalizeTerm('car­dio​vascular'), 'cardiovascular');
  assert.equal(normalizeTerm('التهاب،'), 'التهاب');
  assert.equal(normalizeTerm('…'), '');
  assert.equal(normalizeTerm(null), '');
});

test('N2 하이픈 결합 낱말 → 결합된 꼴(`expandWord` + `normalizeTerm`) · 6낱말·60자 경계(`clampSelection`)', () => {
  // `.hy`(숨긴 하이픈)는 첫 텍스트 노드 밖 — 줄 글자는 "… cardio", 다음 줄 첫머리 "vascular risk".
  const line = 'Smoking raises cardio';
  const w = expandWord(line, 16, 18, 'vascular risk is high', null);
  assert.equal(w.joined, true);
  assert.equal(normalizeTerm(w.word), 'cardiovascular');
  const w2 = expandWord('the (Fever), and', 6, 8, null, null);
  assert.equal(normalizeTerm(w2.word), 'fever');
  assert.equal(clampSelection('one two three four five six').tooLong, false);
  assert.equal(clampSelection('one two three four five six seven').tooLong, true);
  assert.equal(clampSelection('x'.repeat(60)).tooLong, false);
  assert.equal(clampSelection('x'.repeat(61)).tooLong, true);
});

/* ══ 2. findInSentenceTr ═══════════════════════════════ */

const AR = 'يعاني المريض من التهاب المفاصل الروماتويدي (rheumatoid arthritis) منذ سنوات.';

test('F1 ★ 아랍어 — `arthritis`·`rheumatoid arthritis` → 괄호 앞 아랍어 후보(최대 4낱말) · 밑줄 자리 · 대소문자·NFKC 무시', () => {
  for (const t of ['arthritis', 'rheumatoid arthritis', 'Rheumatoid  ARTHRITIS', 'ＡＲＴＨＲＩＴＩＳ']) {
    const r = findInSentenceTr(t, AR);
    assert.ok(r, t);
    assert.equal(r.candidate, 'من التهاب المفاصل الروماتويدي', t);
    assert.equal(r.sentenceTr, AR);
    assert.equal(AR.slice(r.at[0], r.at[1]), 'من التهاب المفاصل الروماتويدي (rheumatoid arthritis)');
    assert.equal(AR.slice(r.paren[0], r.paren[1]), '(rheumatoid arthritis)');
  }
  assert.equal(findInSentenceTr('rheumatoid', AR).candidate, 'من التهاب المفاصل الروماتويدي');
  assert.equal(findInSentenceTr('arth', AR), null, '낱말 경계 — 조각은 안 맞는다');
  assert.equal(findInSentenceTr('fever', AR), null, '괄호 속에 없다');
  assert.equal(findInSentenceTr('arthritis', 'يعاني المريض من التهاب المفاصل منذ سنوات.'), null, '괄호 없는 번역 → null');
  assert.equal(findInSentenceTr('', AR), null);
});

test('F2 멈춤 — `،`·다른 괄호·괄호 밖 라틴 낱말(아랍어 대상)에서 멈춘다', () => {
  const a = 'ارتفاع الضغط، ثم التهاب المفاصل (arthritis) لاحقاً.';
  assert.equal(findInSentenceTr('arthritis', a).candidate, 'ثم التهاب المفاصل');
  const b = 'الحمى (fever) والتهاب الكبد (hepatitis) شائعان.';
  assert.equal(findInSentenceTr('hepatitis', b).candidate, 'والتهاب الكبد', '앞 괄호에서 멈춤');
  assert.equal(findInSentenceTr('fever', b).candidate, 'الحمى');
  const c = 'تحليل CRP يظهر التهاب الأوعية (vasculitis) أحياناً';
  assert.equal(findInSentenceTr('vasculitis', c).candidate, 'يظهر التهاب الأوعية', '괄호 밖 영어 낱말에서 멈춤');
  const d = 'نتيجة: (arthritis)';
  assert.equal(findInSentenceTr('arthritis', d), null, '후보가 비면 null');
});

test('F3 ko·fr 대상 각 1 — 괄호가 붙어 있어도(ko), 라틴 대상이면 괄호 밖 라틴 낱말을 모은다(fr)', () => {
  const ko = '환자는 류마티스 관절염(rheumatoid arthritis)을 앓았다.';
  const rk = findInSentenceTr('rheumatoid arthritis', ko);
  assert.equal(rk.candidate, '환자는 류마티스 관절염');
  assert.equal(ko.slice(rk.paren[0], rk.paren[1]), '(rheumatoid arthritis)');
  const ko2 = '그 뒤, 류마티스 관절염(rheumatoid arthritis)이 왔다.';
  assert.equal(findInSentenceTr('arthritis', ko2).candidate, '류마티스 관절염');
  const fr = 'Elle souffre de polyarthrite rhumatoïde (rheumatoid arthritis) depuis 2019.';
  assert.equal(findInSentenceTr('arthritis', fr).candidate, 'souffre de polyarthrite rhumatoïde');
  const fr2 = 'Hier, une polyarthrite (arthritis) est apparue.';
  assert.equal(findInSentenceTr('arthritis', fr2).candidate, 'une polyarthrite');
});

/* ══ 3. CSV · Anki ═════════════════════════════════════ */

function entry(over) {
  return Object.assign(newTermEntry({
    surface: 'Arthritis', srcLang: 'en', targetLang: 'ar', translation: 'التهاب المفاصل', pos: 'noun',
    gloss: 'التهاب في المفصل', context: 'Arthritis, a joint "disease",\nis common.', contextTr: 'التهاب المفاصل شائع.',
    note: 'my, "note"\nline 2', docTitle: 'Book, One', docId: 'docA', pageNo: 12, lineId: '12:3', origin: 'ai',
    createdAt: T0, updatedAt: T0 + 5
  }, T0), { id: 'vt:x1' }, over || {});
}

test('C1 ★ CSV — BOM 으로 시작 · CRLF · 열 이름 14개 · 쉼표·따옴표·줄바꿈·아랍어 칸이 왕복 후 같다', () => {
  const e1 = entry();
  const e2 = entry({ id: 'vt:x2', surface: 'CRP', term: 'crp', translation: 'بروتين سي التفاعلي', note: '', pageNo: null, docTitle: '' });
  const csv = buildCsv([e1, e2]);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(csv.slice(1).split('\r\n')[0], VOCAB.CSV_COLUMNS.join(','));
  assert.equal(VOCAB.CSV_COLUMNS.length, 14);
  assert.ok(!/[^\r]\n/.test(csv.replace(/"[^"]*(?:""[^"]*)*"/g, '')), '따옴표 밖 줄 끝은 모두 CRLF');
  const p = parseCsv(csv);
  assert.equal(p.ok, true);
  assert.equal(p.rows.length, 2);
  const r = p.rows[0];
  assert.equal(r.term, 'Arthritis');
  assert.equal(r.translation, e1.translation);
  assert.equal(r.context, e1.context);
  assert.equal(r.note, e1.note);
  assert.equal(r.document, 'Book, One');
  assert.equal(r.page, '12');
  assert.equal(r.added, new Date(T0).toISOString());
  assert.equal(r.updated, new Date(T0 + 5).toISOString());
  assert.equal(r.id, 'vt:x1');
  assert.equal(p.rows[1].page, '');
  // 왕복: 그대로 가져오면 "그대로 2"
  const plan = importPlan(p.rows, [e1, e2], { nowMs: T0 + 100 });
  assert.equal(plan.same.length, 2, JSON.stringify(plan));
  assert.equal(plan.add.length + plan.change.length + plan.reject.length, 0);
});

test('C2 ★ 수식 주입(13절) — `=SUM(1)` 메모 → `\'=SUM(1)` 로 나가고 가져오면 원래대로 · `\'tis` 는 그대로 · `+ - @`·탭 · 여러 `\'` 도 정확히 왕복', () => {
  assert.equal(csvCell('=SUM(1)'), "'=SUM(1)");
  assert.equal(csvCell("'tis"), "'tis");
  assert.equal(csvCell('-5'), "'-5");
  assert.equal(csvCell('@x'), "'@x");
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell('\tx'), "'\tx");
  for (const v of ['=SUM(1)', "'tis", "'=x", "''=y", '-5', 'plain', '@a', 'a=b']) assert.equal(unFormula(csvCell(v).replace(/^"|"$/g, '')), v, v);
  const e = entry({ note: '=SUM(1)', gloss: "'tis fine" });
  const csv = buildCsv([e]);
  assert.ok(csv.includes(",'=SUM(1),") || csv.includes("'=SUM(1)"), '나갈 때 접두');
  const r = parseCsv(csv).rows[0];
  assert.equal(r.note, '=SUM(1)');
  assert.equal(r.gloss, "'tis fine");
});

test('C3 Anki — 머리 줄 3개 · 탭 구분 다섯 칸 · 칸 안 탭·줄바꿈은 공백 · 수식 접두 없음', () => {
  const txt = buildAnki([entry({ note: '=x\tY' })]);
  const lines = txt.split('\n');
  assert.deepEqual(lines.slice(0, 3), ['#separator:tab', '#html:false', '#columns:Front\tBack\tContext\tNote\tSource']);
  const cells = lines[3].split('\t');
  assert.equal(cells.length, 5);
  assert.equal(cells[0], 'Arthritis');
  assert.equal(cells[1], 'التهاب المفاصل — التهاب في المفصل');
  assert.equal(cells[2], 'Arthritis, a joint "disease", is common.');
  assert.equal(cells[3], '=x Y', '수식 접두 없음, 탭은 공백');
  assert.equal(cells[4], 'Book, One p.12');
});

/* ══ 4. parseCsv · importPlan ══════════════════════════ */

const HEAD = VOCAB.CSV_COLUMNS.join(',');
const row = (o) => VOCAB.CSV_COLUMNS.map((c) => csvCell(o[c] == null ? '' : o[c])).join(',');

test('I1 ★ importPlan — id 같고 updated 새로움 → 바뀜 · 오래됨 → 그대로 · 같음(엑셀에서 칸만 고침) → 바뀜 · 내용 같음 → 그대로', () => {
  const ex = entry();
  const iso = (t) => new Date(t).toISOString();
  const base = { term: 'Arthritis', translation: ex.translation, pos: 'noun', gloss: ex.gloss, context: ex.context,
    context_translation: ex.contextTr, note: ex.note, document: ex.docTitle, page: '12', source_lang: 'en', target_lang: 'ar',
    added: iso(T0), updated: iso(T0 + 5), id: 'vt:x1' };
  const csv = HEAD + '\r\n' + [
    row(Object.assign({}, base, { translation: 'أحدث', updated: iso(T0 + 999) })),   // 새로움 → 바뀜
    row(Object.assign({}, base, { id: 'vt:x2', term: 'CRP', translation: 'قديم', updated: iso(T0 - 999) })),  // 오래됨 → 그대로
    row(Object.assign({}, base, { id: 'vt:x3', term: 'Fever', note: 'edited in excel' })),   // 같은 시각 + 내용 다름 → 바뀜
    row(Object.assign({}, base, { id: 'vt:x4', term: 'Rash' }))                              // 내용 같음 → 그대로
  ].join('\r\n');
  const exs = [ex,
    entry({ id: 'vt:x2', surface: 'CRP', term: 'crp', translation: 'بروتين', updatedAt: T0 }),
    entry({ id: 'vt:x3', surface: 'Fever', term: 'fever' }),
    entry({ id: 'vt:x4', surface: 'Rash', term: 'rash' })];
  const plan = importPlan(parseCsv(csv).rows, exs, { nowMs: T0 + 2000 });
  assert.deepEqual(plan.change.map((c) => c.id).sort(), ['vt:x1', 'vt:x3']);
  assert.deepEqual(plan.same.map((c) => c.id).sort(), ['vt:x2', 'vt:x4']);
  assert.equal(plan.same.find((s) => s.id === 'vt:x2').newerHere, true);
  const c1 = plan.change.find((c) => c.id === 'vt:x1');
  assert.deepEqual(Object.keys(c1.patch).sort(), ['edited', 'translation', 'updatedAt']);
  assert.equal(c1.patch.translation, 'أحدث');
  assert.equal(c1.patch.updatedAt, T0 + 2000);
  for (const c of plan.change) for (const k of ['sm2', 'dueAt', 'reviewedAt', 'introducedAt', 'createdAt', 'id', 'kind']) assert.ok(!(k in c.patch), k);
});

test('I2 importPlan — id 없음 → term+target_lang 으로 맞춤 · 없으면 새 항목(origin import, 문서 제목 → docId) · 거절(원어 빔·대상 빔·같은 행 두 번)', () => {
  const ex = entry();
  const csv = HEAD + '\r\n' + [
    row({ term: 'ARTHRITIS!', translation: 'جديد', target_lang: 'ar', updated: new Date(T0 + 50).toISOString() }),  // id 없음 → x1 과 맞춤(바뀜)
    row({ term: 'Edema', translation: 'وذمة', target_lang: 'ar', document: 'My Book', page: '7', source_lang: 'en' }),   // 새 항목
    row({ term: '', translation: 'x', target_lang: 'ar' }),        // 원어 빔
    row({ term: 'Gout', translation: 'نقرس', target_lang: '' }),    // 대상 빔
    row({ term: 'edema', translation: 'وذمة 2', target_lang: 'ar' }) // 같은 파일 안 두 번째
  ].join('\r\n');
  const plan = importPlan(parseCsv(csv).rows, [ex], { nowMs: T0 + 100, docs: [{ id: 'docB', title: 'My Book' }] });
  assert.deepEqual(plan.change.map((c) => c.id), ['vt:x1']);
  assert.equal(plan.add.length, 1);
  const a = plan.add[0];
  assert.equal(a.term, 'edema');
  assert.equal(a.origin, 'import');
  assert.equal(a.docId, 'docB');
  assert.equal(a.createdAt, T0 + 100);
  assert.deepEqual(plan.reject.map((r) => r.reason), ['term', 'target', 'dup']);
  const ne = newTermEntry(a, T0 + 100);
  assert.equal(ne.pageNo, 7);
  assert.equal(ne.kind, 'term');
  assert.equal(typeof ne.createdAt, 'number');
  assert.equal(ne.dueAt, ne.createdAt);
});

test('I3 상한 — 2MB 넘는 글·5,000 행 넘는 CSV → 통째로 거절 · 머리 줄에 term/target_lang 없음 → 거절', () => {
  assert.equal(VOCAB.IMPORT_MAX_BYTES, 2 * 1024 * 1024);
  assert.equal(VOCAB.IMPORT_MAX_ROWS, 5000);
  const big = HEAD + '\r\n' + 'x'.repeat(VOCAB.IMPORT_MAX_BYTES);
  assert.deepEqual(parseCsv(big), { ok: false, reason: 'size' });
  const arBig = HEAD + '\r\n' + 'ع'.repeat(Math.ceil(VOCAB.IMPORT_MAX_BYTES / 2));   // 글자 수는 1MB 남짓이지만 UTF-8 은 2MB 넘음
  assert.equal(parseCsv(arBig).reason, 'size');
  const many = HEAD + '\r\n' + Array.from({ length: 5001 }, (_, i) => 'w' + i + ',,,,,,,,,,ar,,,').join('\r\n');
  assert.deepEqual(parseCsv(many), { ok: false, reason: 'rows' });
  const ok5000 = HEAD + '\r\n' + Array.from({ length: 5000 }, (_, i) => 'w' + i + ',,,,,,,,,,ar,,,').join('\r\n');
  assert.equal(parseCsv(ok5000).ok, true);
  assert.equal(importPlan(Array.from({ length: 5001 }, () => ({ term: 'a', target_lang: 'ar' })), []).error, 'rows');
  assert.deepEqual(parseCsv('a,b\r\n1,2'), { ok: false, reason: 'header' });
  assert.equal(parseCsv('').ok, false);
  // 열 순서가 바뀌어도(엑셀에서 옮김) 이름으로 맞춘다 · LF 줄 끝도 받는다
  const r = parseCsv('target_lang,term\nar,Fever\n');
  assert.deepEqual(r.rows, [{ target_lang: 'ar', term: 'Fever' }]);
});

/* ══ 5. 서비스 (fake-idb) ══════════════════════════════ */

let clock = T0;
const store = createVocabStore({ now: () => clock });

test('S1 ★ save — 새 항목(숫자 ms·dueAt=createdAt·복습 필드 기본) · 같은 term+대상 언어 다시 → 새로 만들지 않고 기존 · findTerm', async () => {
  clock = T0;
  const a = await store.save({ surface: 'Arthritis', srcLang: 'en', targetLang: 'ar', context: 'Arthritis is common.', docId: 'docA', docTitle: 'A', pageNo: 3, origin: 'sentence', translation: 'التهاب المفاصل' });
  assert.equal(a.created, true);
  const e = a.entry;
  assert.equal(e.id, await termIdOf('arthritis', 'ar'));
  assert.equal(e.kind, 'term');
  assert.equal(e.term, 'arthritis');
  for (const k of ['createdAt', 'updatedAt', 'dueAt']) assert.equal(typeof e[k], 'number', k);
  assert.equal(e.dueAt, e.createdAt);
  assert.deepEqual(e.sm2, { ease: 2.5, interval: 0, reps: 0, lapses: 0 });
  assert.equal(e.reviewedAt, null);
  assert.equal(e.introducedAt, null);
  assert.equal(e.suspended, false);
  clock = T0 + 10;
  const b = await store.save({ surface: 'ARTHRITIS.', srcLang: 'en', targetLang: 'ar', context: 'Other sentence.', docId: 'docB' });
  assert.equal(b.created, false);
  assert.equal(b.entry.id, e.id);
  assert.equal(b.entry.context, 'Arthritis is common.', '기존 항목 그대로(문맥 바꾸기는 화면이 묻고 update)');
  const c = await store.save({ surface: 'Arthritis', srcLang: 'en', targetLang: 'ko', context: 'x', docId: 'docA' });
  assert.equal(c.created, true, '대상 언어가 다르면 다른 항목');
  assert.equal((await store.findTerm('  arthritis ', 'ar')).id, e.id);
  assert.equal((await store.findTerm('arthritis', 'fr')), null);
  assert.equal((await store.save({ surface: '...', targetLang: 'ar' })).entry, null);
  // 동시에 두 번 눌러도 한 항목(찾기와 쓰기가 한 트랜잭션)
  const [p1, p2] = await Promise.all([
    store.save({ surface: 'Edema', targetLang: 'ar', docId: 'docA' }),
    store.save({ surface: 'edema', targetLang: 'ar', docId: 'docA' })
  ]);
  assert.equal([p1.created, p2.created].filter(Boolean).length, 1);
  assert.equal((await store.list()).filter((x) => x.term === 'edema').length, 1);
});

test('S2 ★ update — 사용자 수정 → edited·updatedAt(숫자 ms) · 복습 필드·createdAt·id 는 그대로 · 원어 고치면 term 다시', async () => {
  const e = await store.findTerm('arthritis', 'ar');
  // 12 가 복습한 것처럼 복습 필드를 심어 둔다
  await db.put('cards', Object.assign({}, e, { sm2: { ease: 2.6, interval: 3, reps: 2, lapses: 0 }, dueAt: T0 + 86400000, reviewedAt: T0 + 7, introducedAt: T0 + 1 }));
  clock = T0 + 500;
  const u = await store.update(e.id, { translation: 'تهاب', note: 'mine', sm2: null, dueAt: 0, id: 'hack', kind: 'sentence', createdAt: 1 }, { user: true });
  assert.equal(u.translation, 'تهاب');
  assert.equal(u.edited, true);
  assert.equal(u.updatedAt, T0 + 500);
  assert.deepEqual(u.sm2, { ease: 2.6, interval: 3, reps: 2, lapses: 0 });
  assert.equal(u.dueAt, T0 + 86400000);
  assert.equal(u.reviewedAt, T0 + 7);
  assert.equal(u.introducedAt, T0 + 1);
  assert.equal(u.createdAt, e.createdAt);
  assert.equal(u.id, e.id);
  assert.equal(u.kind, 'term');
  clock = T0 + 600;
  const same = await store.update(e.id, { translation: 'تهاب' }, { user: true });
  assert.equal(same.updatedAt, T0 + 500, '바뀐 것이 없으면 updatedAt 그대로');
  const s2 = await store.update(e.id, { surface: 'Arthritides' }, { user: true });
  assert.equal(s2.term, 'arthritides');
  const ai = await store.update(e.id, { gloss: 'AI gloss' });
  assert.equal(ai.updatedAt, T0 + 600, '내용 수정은 updatedAt');
  await store.update(e.id, { surface: 'Arthritis' }, { user: true });
});

test('S3 list·countByDoc·changedSince(ms·ISO·없음)·remove', async () => {
  const all = await store.list();
  assert.ok(all.length >= 3);
  assert.ok(all.every((x) => x.kind === 'term'));
  const a = await store.list({ docId: 'docA' });
  assert.ok(a.length >= 2 && a.every((x) => x.docId === 'docA'));
  assert.equal(await store.countByDoc('docA'), a.length);
  const since = await store.changedSince(T0 + 550);
  assert.ok(since.length >= 1 && since.every((x) => x.updatedAt > T0 + 550));
  assert.equal((await store.changedSince(new Date(T0 + 550).toISOString())).length, since.length);
  assert.equal((await store.changedSince(null)).length, all.length, '내보낸 적 없음 → 전부');
  const ko = await store.findTerm('arthritis', 'ko');
  assert.equal(await store.remove(ko.id), true);
  assert.equal(await store.findTerm('arthritis', 'ko'), null);
  await db.put('cards', { id: 'sc:1', kind: 'sentence', docId: 'docA', front: 'x' });
  assert.equal(await store.remove('sc:1'), false, '문장 카드는 단어장 remove 가 지우지 않는다');
  assert.ok(!(await store.list()).some((x) => x.id === 'sc:1'));
});

test('S4 ★ applyImport — 한 트랜잭션 · 바뀜은 내용만 덮고 sm2·dueAt·reviewedAt·introducedAt·createdAt·docId 그대로 · 새 항목 id', async () => {
  const before = await store.findTerm('arthritis', 'ar');
  assert.ok(before.reviewedAt, '전제: 복습 필드 있음');
  clock = T0 + 9000;
  const csv = buildCsv([Object.assign({}, before, { translation: 'من الملف', note: 'file note' })]);
  const rows = parseCsv(csv).rows;
  rows.push({ term: 'Gout', translation: 'نقرس', target_lang: 'ar', id: 'vt:from-other-device', document: 'Gone Book' });
  const plan = importPlan(rows, await store.list(), { nowMs: clock });
  assert.equal(plan.change.length, 1);
  assert.equal(plan.add.length, 1);
  const r = await store.applyImport(plan);
  assert.deepEqual(r, { added: 1, changed: 1, skipped: 0 });
  const after = await store.findTerm('arthritis', 'ar');
  assert.equal(after.translation, 'من الملف');
  assert.equal(after.note, 'file note');
  assert.equal(after.edited, true);
  assert.equal(after.updatedAt, T0 + 9000);
  for (const k of ['sm2', 'dueAt', 'reviewedAt', 'introducedAt', 'createdAt', 'id', 'docId', 'kind']) assert.deepEqual(after[k], before[k], k);
  const g = await store.findTerm('gout', 'ar');
  assert.equal(g.id, 'vt:from-other-device', '다른 기기의 id 를 그대로');
  assert.equal(g.origin, 'import');
  assert.equal(g.docId, null);
  assert.equal(g.docTitle, 'Gone Book');
  assert.equal(typeof g.createdAt, 'number');
  // 같은 계획을 다시 쓰면 새 항목은 건너뛴다(중복 없음)
  const again = await store.applyImport({ add: plan.add, change: [] });
  assert.deepEqual(again, { added: 0, changed: 0, skipped: 1 });
});

test('S5 9c 병합 꼴 — term 항목의 updatedAt·reviewedAt 이 숫자(또는 null)라 max(updatedAt, reviewedAt) 를 바로 셀 수 있다', async () => {
  for (const e of await store.list()) {
    assert.equal(typeof e.updatedAt, 'number');
    assert.ok(e.reviewedAt === null || typeof e.reviewedAt === 'number');
    assert.ok(Number.isFinite(Math.max(e.updatedAt, e.reviewedAt || 0)));
  }
});

/* ══ 6. 연쇄 삭제 ═════════════════════════════════════ */

test('D1 ★ deleteDocument — 그 문서의 kind:term 은 남고 문장 카드·kind 없는 카드는 지워진다 · 다른 문서 카드 그대로', async () => {
  await db.put('documents', { id: 'docZ', title: 'Z', fileHash: 'hz' });
  await db.put('documents', { id: 'docY', title: 'Y', fileHash: 'hy' });
  const t = await store.save({ surface: 'Myalgia', srcLang: 'en', targetLang: 'ar', docId: 'docZ', docTitle: 'Z' });
  await db.put('cards', { id: 'sc:z1', kind: 'sentence', docId: 'docZ', front: 'a' });
  await db.put('cards', { id: 'old:z2', docId: 'docZ', term: 'legacy' });
  await db.put('cards', { id: 'sc:y1', kind: 'sentence', docId: 'docY', front: 'b' });
  const c = await db.deleteDocument('docZ');
  assert.equal(c.cards, 2, '지운 카드 수 = 문장 카드 + kind 없는 카드');
  assert.equal(idb.peek('medreader', 'documents', 'docZ'), undefined);
  assert.ok(idb.peek('medreader', 'cards', t.entry.id), '★ 단어장 항목은 남는다');
  assert.equal(idb.peek('medreader', 'cards', t.entry.id).docTitle, 'Z', 'docTitle 사본이 출처를 대신한다');
  assert.equal(idb.peek('medreader', 'cards', 'sc:z1'), undefined);
  assert.equal(idb.peek('medreader', 'cards', 'old:z2'), undefined);
  assert.ok(idb.peek('medreader', 'cards', 'sc:y1'), '다른 문서 카드 그대로');
  assert.equal(db.keepsOnDocDelete({ kind: 'term' }), true);
  assert.equal(db.keepsOnDocDelete({ kind: 'sentence' }), false);
  assert.equal(db.keepsOnDocDelete(null), false);
  assert.equal(db.DB_VERSION, 3, 'DB 버전 그대로');
});

/* ══ 7. 키 문자열 · 계층 ══════════════════════════════ */

test('K1 ★ 내보낸 파일(CSV·Anki)에 키 문자열 0건 — 가짜 키를 저장소에 둔 상태', async () => {
  const FAKE = 'AQ.' + 'Ab_DUMMY_NOT_A_REAL_KEY_8f1_vocab';
  keys.saveKey('gemini', FAKE);
  assert.equal(keys.readKeySecret('gemini'), FAKE, '전제: 키가 저장소에 있다');
  const list = await store.list();
  assert.ok(list.length >= 3);
  for (const out of [buildCsv(list), buildAnki(list)]) {
    assert.ok(out.length > 100);
    assert.equal(out.indexOf(FAKE), -1);
    assert.equal(out.indexOf('Ab_DUMMY'), -1);
  }
  keys.clearKey('gemini');
});

test('K2 계층 — text/vocab.js 는 순수(브라우저 전역·세그먼터 0, import 는 config·bidi) · vocab/store.js 는 config·db·text·hash 만(ui·ai 0)', () => {
  const v = src('../js/text/vocab.js');
  assert.ok(!/\b(document|window|fetch|indexedDB|navigator|localStorage|sessionStorage|Segmenter)\b/.test(v));
  assert.deepEqual((v.match(/from\s+'[^']+'/g) || []).sort(), ["from '../config.js'", "from './bidi.js'"]);
  const s = src('../js/vocab/store.js');
  const imps = (s.match(/^\s*import[^;]*from\s*'([^']+)'/gm) || []).map((x) => x.replace(/^[\s\S]*from\s*'/, '').replace(/'$/, ''));
  assert.ok(imps.length >= 3);
  for (const m of imps) assert.match(m, /^\.\.\/(config|db|hash)\.js$|^\.\.\/text\//, m);
  assert.ok(!/\/(ui|ai|pdf|tts)\//.test(s.replace(/\/\*[\s\S]*?\*\//g, '')));
});
