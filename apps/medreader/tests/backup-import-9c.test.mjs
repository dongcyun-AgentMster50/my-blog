/* ============================================================
   tests/backup-import-9c.test.mjs — 9c-2 백업 가져오기 (spec 17-4-1 5 · "9c-2 수용 기준" [N] — fake-idb 종단)

   I1  lineSplitter 줄 길이 상한 — 첫 줄 전에 넘으면 long · 가운데 긴 줄만 버림 · 줄바꿈 없는 20MB 도 빠르게(9c1R #10)
   I2  순수 도우미 — docHashCandidates·samePdf·cleanLinkIds(18R-8)·cleanRecord(속성 이름 키 모양 — 9c1R #3)
   I3  ★ 빈 DB 에 가져오기(gzip·평문) — 문서(blob 없음·extraction 처음 값)·스토어별 개수 = 머리 줄 counts · 파생 0
   I4  ★ 같은 fileHash 의 다른 id 문서가 있는 DB → 그 id 로 바뀌어 들어감(캐시 키 셋째 칸·진도 키·문항 접두…) · 새 문서 0 · 변형 키
   I5  ★ 멱등 — 같은 파일 두 번 = 한 번(전 스토어 깊은 비교) — 빈 기기·값이 다른 기기
   I6  ★ 데이터 안전 — 기기 쪽이 더 새로운 진도·단어·카드·필기·자리는 그대로 · 복습 필드 불변 · 캐시 hits·createdAt 보존
   I7  term — id 다음 term+targetLang 으로 기기 항목 찾기(다른 id) · 원어를 바꿔 다른 항목과 겹치면(dup) 내용 그대로
   I8  ★ 잘린 파일 — 평문(반쪽 줄 하나만 버림)·gzip(흐름 끝 잘림) · 깨진 UTF-8 은 그 자리에서 멈춤(앞까지 들어감)
   I9  거절 — format 2 → newer · 다른 파일 → not-backup · 줄바꿈 없는 큰 파일 → not-backup(첫 줄 상한)
   I10 설정 — [설정도 가져오기] 끔 → 설정 0 · 허용 밖·키 모양 → 건너뜀 · 의료 사이트 id 꼴 고침 · 속성 이름 키 모양 빠짐
   I11 미리보기 — 머리 줄·문서 목록만(이미 있음/새로 생김) · 잘림(평문 true/false, gzip null) · hash 다름
   I12 멈춤(signal) → 다시 같은 파일 → 한 번에 넣은 것과 같다 · 진행 알림
   I13 지운 항목 — 기기에서 지운 단어·문서가 파일에 있으면 다시 생긴다(병합만 — 설계 결과), 수는 결과 ops 에
   I14 정적 — backup/import.js 의 import 는 config·db·hash·text/* 만, 웹 저장소·화면 낱말 0
   I15 화면 배선(소스) — 가져오기 단추·파일 고르기(accept 비움)·미리보기·떠나기 확인·다시 불러오기 · i18n 4언어
   지어낸 글자만. 실제 키·실제 호출 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

const db = await import('../js/db.js');
const B = await import('../js/text/backup.js');
const { exportBackup } = await import('../js/backup/export.js');
const IM = await import('../js/backup/import.js');
const { BACKUP } = await import('../js/config.js');
const { BUNDLES, LANGS } = await import('../js/i18n/index.js');

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const T0 = new Date(2026, 10, 17, 9, 30, 0).getTime();
const NOW = T0 + 3600000;

async function reset() {
  for (const s of db.STORE_NAMES) await db.clearStore(s);
}
/** 모든 스토어의 깊은 스냅숏(키 순서). Blob 은 크기만. */
async function snap() {
  const o = {};
  for (const s of db.STORE_NAMES) {
    const rows = [];
    await db.iterate(s, {}, (v, k) => { rows.push([JSON.stringify(k), s === 'blobs' ? { size: v.blob && v.blob.size } : v]); });
    o[s] = rows;
  }
  return JSON.stringify(o);
}
async function countAll() {
  const o = {};
  for (const s of db.STORE_NAMES) o[s] = Number(await db.count(s));
  return o;
}
function fileOf(parts, name) {
  return new File(Array.isArray(parts) ? parts : [parts], name || 'medreader-backup-20261117-0930.jsonl');
}
async function exportFile(opts) {
  const r = await exportBackup(Object.assign({ now: T0 }, opts || {}));
  return { file: fileOf([r.blob], r.name), r: r };
}
async function textOfFile(f) {
  return new Response(f.stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
const imp = (file, o) => IM.importBackup(file, Object.assign({ now: NOW }, o || {}));

/** 지어낸 서재 — 스토어마다 몇 개씩(9c-1 K 시험의 seed 와 같은 꼴 + 링크·문장 카드·AI 문항). */
async function seedLibrary() {
  await db.put('documents', {
    id: 'docA', title: 'Book A', fileName: 'a.pdf', size: 1234, pageCount: 40, fileHash: 's256:p:1:aaa', addedAt: T0, lastOpenedAt: T0,
    lastPage: 3, lastLineId: '3:7', lang: 'en', langSource: 'auto', langGuess: 'en', domain: 'medical', readStats: { pages: 3, chars: 9000 },
    outline: [{ t: 'Ch 1', p: 1, d: 0 }], outlineV: 1, pageLabels: null, scan: { v: 1, verdict: 'text' }, columnsHint: null,
    extraction: { done: true, pagesDone: 40, cursor: 41, failed: [], algoVersion: 12 }, sectionIndex: [{ id: 'I' }],
    sectionIndexDone: true, sectionIndexVersion: 3
  });
  await db.put('documents', { id: 'docB', title: 'Book B', fileName: 'b.pdf', size: 99, pageCount: 2, fileHash: 'fnv:p:1:bbb', addedAt: T0,
    lastOpenedAt: T0, lastPage: 1, lastLineId: null, lang: 'fr', langSource: 'user', langGuess: null,
    extraction: { done: false, pagesDone: 1, cursor: 2, failed: [], algoVersion: 12 } });
  await db.put('blobs', { docId: 'docA', blob: new Blob([new Uint8Array(32)]) });
  await db.put('pages', { docId: 'docA', pageNo: 1, algoVersion: 12, lines: ['p'] });
  await db.put('searchText', { docId: 'docA', pageNo: 1, sk: '1|x', algoVersion: 12, text: 'p', table: '', heads: [] });
  await db.put('questions', { id: 'docA:I:q1', docId: 'docA', sectionId: 'I', source: 'book', stem: 's' });
  await db.put('questions', { id: 'docA:I:ai1', docId: 'docA', sectionId: 'I', source: 'ai', stem: 'ai stem' });
  await db.put('attempts', { id: 'att1', docId: 'docA', sectionId: 'I', items: [{ questionId: 'docA:I:q1', chosen: 'A', correct: false }], at: T0 });
  await db.put('mistakes', { id: 'mis1', questionId: 'docA:I:q1', attemptId: 'att1', docId: 'docA', resolvedAt: null });
  await db.put('progress', { docId: 'docA', sectionId: 'I', score: 1, updatedAt: T0 });
  await db.put('progress', { docId: 'docA', sectionId: '@read', ranges: [[1, 3]], pages: 3, updatedAt: T0 });
  await db.put('cards', term({ id: 'vt:s256:t1', context: 'Line one\nline two', docId: 'docA', updatedAt: T0, createdAt: T0, dueAt: T0 }));
  await db.put('cards', term({ id: 'vt:s256:t2', term: 'edema', surface: 'edema', translation: 'وذمة', docId: 'docA', updatedAt: T0, createdAt: T0, dueAt: T0 }));
  await db.put('cards', { id: 'sc:1', kind: 'sentence', front: 'f', back: 'b', updatedAt: T0, reviewedAt: null, docId: 'docA' });
  await db.put('annotations', { id: 'an1', docId: 'docA', pageNo: 2, kind: 'note', text: 'my "note"\twith tab', updatedAt: T0 });
  await db.put('usage', { day: '2026-11-17', calls: 4, byKind: { translate: 0, readalong: 4 }, byProvider: { gemini: 4 }, tokensIn: 10, tokensOut: 20 });
  await db.put('settings', { key: 'ui.lang', value: 'ar' });
  await db.put('settings', { key: 'reader.fontSize', value: 24 });
  await db.put('settings', { key: 'links.medical', value: [{ id: 'pubmed', name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/?term={q}' }] });
  await db.put('settings', { key: 'privacy.consentedAt', value: '2026-11-01T00:00:00Z' });
  for (let i = 0; i < 3; i++) {
    await db.put('aiCache', { key: 'translate|ar|docA|s256:' + 'ab'.repeat(16) + i, docId: 'docA', kind: 'translate', targetLang: 'ar',
      result: 'ترجمة ' + i, createdAt: T0 + i, hits: i, sizeBytes: 100 });
  }
  await db.put('aiCache', { key: 'term|ar|docA|s256:' + 'cd'.repeat(16) + '|w=dyspnea', docId: 'docA', kind: 'term', targetLang: 'ar',
    result: { translation: 'ضيق' }, createdAt: T0, hits: 0, sizeBytes: 50 });
}

function term(over) {
  return Object.assign({ id: 'vt:s256:1', kind: 'term', term: 'dyspnea', surface: 'Dyspnea', srcLang: 'en', targetLang: 'ar',
    translation: 'ضيق النفس', pos: 'noun', gloss: '', lemma: '', context: 'c', contextTr: '', note: '', docId: 'docA', docTitle: 'Book A', pageNo: 1,
    origin: 'user', edited: false, createdAt: 1000, updatedAt: 2000, sm2: { ease: 2.5, interval: 0, reps: 0, lapses: 0 }, dueAt: 1000,
    reviewedAt: null, introducedAt: null, suspended: false }, over || {});
}

/** 이 서재의 백업(gzip·평문) 두 꼴. */
async function seedAndExport() {
  await reset();
  await seedLibrary();
  const gz = await exportFile();
  const plain = await exportFile({ gzip: false });
  return { gz: gz.file, plain: plain.file, head: JSON.parse((await plain.file.text()).split('\n')[0]) };
}

/* ══ I1 lineSplitter 상한 ═════════════════════════════════ */
test('I1 lineSplitter 줄 길이 상한 — 넘는 줄만 버림(long) · 조각에 걸쳐도 · 줄바꿈 없는 20MB 도 빠르다', () => {
  const sp = B.lineSplitter({ maxLine: 10 });
  const got = [];
  got.push(...sp.push('ab\n0123456'), ...sp.push('789XYZ\ncd'), ...sp.push('\n'), ...sp.push('0123456789A'), ...sp.push('BC'));
  got.push(...sp.end());
  assert.deepEqual(got, ['ab', 'cd']);
  assert.equal(sp.long, 2, '가운데 긴 줄 하나 + 끝 긴 줄 하나');
  // 상한 바로 아래는 그대로, \r\n 의 \r 은 뗀다
  const sp2 = B.lineSplitter({ maxLine: 10 });
  assert.deepEqual([...sp2.push('0123456789\r\n'), ...sp2.end()], ['0123456789']);
  // 줄바꿈을 만나기 전에 곧바로 안다 — 가져오기가 첫 줄 전 상한을 넘으면 파일 끝까지 읽지 않고 거절한다(9c1R #10)
  const sp4 = B.lineSplitter({ maxLine: 100 });
  sp4.push('x'.repeat(60));
  assert.equal(sp4.long, 0);
  sp4.push('x'.repeat(60));
  assert.equal(sp4.long, 1, '조각에서 바로');
  // 기본 상한 = config
  assert.equal(BACKUP.MAX_LINE_CHARS, 8 * 1024 * 1024);
  // 줄바꿈 없는 20MB — 조각마다 처음부터 다시 잇지 않는다
  const chunk = 'x'.repeat(64 * 1024);
  const sp3 = B.lineSplitter();
  const t = Date.now();
  let n = 0;
  for (let i = 0; i < 320; i++) n += sp3.push(chunk).length;
  n += sp3.end().length;
  assert.equal(n, 0);
  assert.equal(sp3.long, 1);
  assert.ok(Date.now() - t < 2000, '20MB ' + (Date.now() - t) + 'ms');
});

/* ══ I2 순수 도우미 ═══════════════════════════════════════ */
test('I2 docHashCandidates·samePdf·cleanLinkIds·cleanRecord', () => {
  assert.deepEqual(IM.docHashCandidates('s256:p:1:aaa', 40), { list: ['s256:p:1:aaa', 's256:p:1:aaa:n40'], base: 's256:p:1:aaa', variant: 's256:p:1:aaa:n40' });
  assert.deepEqual(IM.docHashCandidates('s256:p:1:aaa:n40', 40).list, ['s256:p:1:aaa:n40', 's256:p:1:aaa']);
  assert.deepEqual(IM.docHashCandidates('h', 0), { list: ['h'], base: 'h', variant: null });
  assert.deepEqual(IM.docHashCandidates(null, 3).list, []);
  assert.ok(IM.samePdf({ pageCount: 40 }, { pageCount: 40 }) && IM.samePdf({ pageCount: 0 }, { pageCount: 40 }) && !IM.samePdf({ pageCount: 41 }, { pageCount: 40 }));
  // 의료 사이트 id — 줄바꿈·따옴표·역슬래시·빈 값·겹침은 결정적인 새 id, 나머지는 같은 객체
  const ok = [{ id: 'pubmed', name: 'P', url: 'u' }, { id: 'u0abc12', name: 'Q', url: 'u' }];
  assert.equal(IM.cleanLinkIds(ok), ok);
  const bad = [{ id: 'a\nb', name: 'A' }, { id: 'pubmed', name: 'B' }, { id: 'x"]', name: 'C' }, { id: '', name: 'D' }, { id: 'pubmed', name: 'E' }, { name: 'F' }, { id: 'i0', name: 'G' }];
  const fixed = IM.cleanLinkIds(bad);
  assert.deepEqual(fixed.map((x) => x.id), ['i0_', 'pubmed', 'i2', 'i3', 'i4', 'i5', 'i0']);
  assert.deepEqual(IM.cleanLinkIds(fixed), fixed, '두 번 = 한 번');
  for (const x of fixed) assert.match(x.id, /^[A-Za-z0-9_-]+$/);
  assert.equal(bad[0].id, 'a\nb', '원본을 고치지 않는다');
  // 속성 이름이 키 모양이면 그 속성만 뺀다(값 지우개는 내보내기가 이미 했다 — 9c1R #3)
  const AIZA = 'AIza' + 'SyFAKEFAKEFAKEFAKEFAKEFAKEFAKE12345';
  const u = { day: 'D', calls: 2, byProvider: { gemini: 2 }, byKind: { translate: 1 } };
  u.byProvider[AIZA] = 9;
  const c = IM.cleanRecord('usage', u);
  assert.deepEqual(c, { day: 'D', calls: 2, byProvider: { gemini: 2 }, byKind: { translate: 1 } });
  assert.ok(Object.keys(u.byProvider).includes(AIZA), '원본 무변');
  const plain = { day: 'D', calls: 1 };
  assert.equal(IM.cleanRecord('usage', plain), plain, '바꿀 것 없으면 같은 객체');
  const s = IM.cleanRecord('settings', { key: 'links.medical', value: bad });
  assert.equal(s.value[0].id, 'i0_');
});

/* ══ I3 빈 DB 에 가져오기 ═════════════════════════════════ */
test('I3 ★ 빈 DB 에 가져오기 — 문서(blob 없음·extraction 처음 값)·개수 = 머리 줄 counts · 파생 0 (gzip·평문)', async () => {
  const f = await seedAndExport();
  for (const file of [f.gz, f.plain]) {
    await reset();
    const r = await imp(file);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.gz, file === f.gz && typeof CompressionStream === 'function');
    assert.equal(r.truncated, false);
    assert.equal(r.broken, false);
    assert.equal(r.bad, 0);
    assert.deepEqual(r.mismatch, []);
    const c = await countAll();
    for (const s of BACKUP.STORES) assert.equal(c[s], f.head.counts[s] || 0, s + ' 개수 = 머리 줄');
    assert.equal(c.documents, 2);
    for (const s of ['blobs', 'pages', 'searchText', 'sections']) assert.equal(c[s], 0, s + ' 는 들어오지 않는다');
    const a = await db.get('documents', 'docA');
    assert.deepEqual(a.extraction, db.derivedDocReset().extraction, '추출본이 없으니 처음 값');
    assert.equal(a.sectionIndexDone, false);
    assert.equal(a.lastPage, 3);
    assert.equal(a.lastLineId, '3:7');
    assert.equal(a.fileHash, 's256:p:1:aaa');
    assert.equal(await db.get('blobs', 'docA'), undefined, 'PDF 필요');
    assert.deepEqual(r.remap, {}, '새 기기 — 바꿔 쓸 일 없음');
    assert.equal((await db.get('settings', 'ui.lang')).value, 'ar');
    assert.equal(await db.get('settings', 'privacy.consentedAt'), undefined, '동의는 새 기기에서 다시');
    assert.equal((await db.get('cards', 'vt:s256:t1')).context, 'Line one\nline two');
    assert.equal(r.ops.aiCache.add, 4);
  }
});

/* ══ I4 docId 바꿔 쓰기 ═══════════════════════════════════ */
test('I4 ★ 같은 fileHash 의 다른 id 문서 → 그 id 로 들어감 · 캐시 키 셋째 칸·진도·문항·시도·오답·카드·필기 · 새 문서 0', async () => {
  const f = await seedAndExport();
  await reset();
  // 기기 B 가 같은 PDF 를 먼저 가져왔다(다른 id) — 더 늦게 열었다
  await db.put('documents', { id: 'devA', title: 'Book A (B)', fileName: 'a.pdf', size: 1234, pageCount: 40, fileHash: 's256:p:1:aaa', addedAt: NOW,
    lastOpenedAt: NOW, lastPage: 1, lastLineId: null, lang: 'en', langSource: 'auto', extraction: { done: true, pagesDone: 40, cursor: 41, failed: [], algoVersion: 12 } });
  await db.put('blobs', { docId: 'devA', blob: new Blob([new Uint8Array(8)]) });
  const r = await imp(f.gz);
  assert.equal(r.ok, true);
  assert.deepEqual(r.remap, { docA: 'devA' });
  const docs = await db.keysOf('documents');
  assert.deepEqual(docs.sort(), ['devA', 'docB'], '같은 책은 하나 — 새 문서는 docB 뿐');
  const keys = await db.keysOf('aiCache');
  assert.equal(keys.length, 4);
  for (const k of keys) {
    const parts = k.split('|');
    assert.equal(parts[2], 'devA', '셋째 칸: ' + k);
    assert.ok(/^s256:/.test(parts[3]), '해시 그대로');
  }
  assert.ok(keys.some((k) => k.endsWith('|w=dyspnea')), 'extra(w=) 그대로');
  for (const v of await collect('aiCache')) assert.equal(v.docId, 'devA');
  assert.ok(await db.get('progress', ['devA', '@read']));
  assert.ok(await db.get('progress', ['devA', 'I']));
  assert.equal(await db.get('progress', ['docA', 'I']), undefined);
  assert.equal((await db.get('questions', 'devA:I:ai1')).docId, 'devA');
  assert.deepEqual((await db.get('attempts', 'att1')).items.map((x) => x.questionId), ['devA:I:q1']);
  assert.equal((await db.get('mistakes', 'mis1')).questionId, 'devA:I:q1');
  assert.equal((await db.get('cards', 'vt:s256:t1')).docId, 'devA');
  assert.equal((await db.get('annotations', 'an1')).docId, 'devA');
  const dev = await db.get('documents', 'devA');
  assert.equal(dev.lastPage, 1, '기기가 더 늦게 열었다 — 기기 자리');
  assert.equal(dev.extraction.done, true, '기기의 추출은 건드리지 않는다');
  assert.equal(dev.title, 'Book A (B)');
  assert.ok(await db.get('blobs', 'devA'), 'blob 그대로');
  // 두 번째 — 같다
  const before = await snap();
  const r2 = await imp(f.gz);
  assert.deepEqual(r2.remap, { docA: 'devA' });
  assert.equal(await snap(), before, '바꿔 쓰기도 멱등');
});

test('I4b 변형 키 — 기기의 같은 해시가 다른 PDF(쪽수 다름)면 새 문서는 쪽수 변형 키 · 기기에 변형이 있으면 그것과 맞춘다', async () => {
  const f = await seedAndExport();
  await reset();
  await db.put('documents', { id: 'other', title: 'Other', pageCount: 99, fileHash: 's256:p:1:aaa', lastOpenedAt: 1 });
  const r = await imp(f.plain);
  assert.equal(r.ok, true);
  assert.equal((await db.get('documents', 'docA')).fileHash, 's256:p:1:aaa:n40', '서재 가져오기가 매길 값');
  assert.equal((await db.get('documents', 'other')).fileHash, 's256:p:1:aaa');
  // 이미 변형 키로 같은 PDF 가 있는 기기
  await reset();
  await db.put('documents', { id: 'other', title: 'Other', pageCount: 99, fileHash: 's256:p:1:aaa', lastOpenedAt: 1 });
  await db.put('documents', { id: 'devA', title: 'A', pageCount: 40, fileHash: 's256:p:1:aaa:n40', lastOpenedAt: 1, lastPage: 1 });
  const r2 = await imp(f.plain);
  assert.deepEqual(r2.remap, { docA: 'devA' });
  assert.equal((await db.keysOf('documents')).length, 3, 'other · devA · docB');
  assert.equal((await db.get('documents', 'devA')).lastPage, 3, '파일이 더 늦게 열었다 — 파일 자리');
  // 파일 쪽이 변형 키(A 기기에서 다른 PDF 와 겹쳤던 책)이고 이 기기에는 바탕 키가 비어 있다 → 바탕 키로(서재 가져오기가 찾도록)
  await reset();
  const lines = (await f.plain.text()).split('\n');
  const vr = lines.map((l) => (l.includes('"s":"documents"') ? l.replace('"fileHash":"s256:p:1:aaa"', '"fileHash":"s256:p:1:aaa:n40"') : l));
  const r3 = await imp(fileOf(vr.join('\n')));
  assert.equal(r3.ok, true);
  assert.equal((await db.get('documents', 'docA')).fileHash, 's256:p:1:aaa');
});

async function collect(store) {
  const out = [];
  await db.iterate(store, {}, (v) => { out.push(v); });
  return out;
}

/* ══ I5 멱등 ══════════════════════════════════════════════ */
test('I5 ★ 멱등 — 같은 파일 두 번 = 한 번(전 스토어 깊은 비교) — 빈 기기 · 값이 다른 기기', async () => {
  const f = await seedAndExport();
  await reset();
  await imp(f.gz);
  const once = await snap();
  await imp(f.gz, { now: NOW + 5000 });
  assert.equal(await snap(), once, '빈 기기: 두 번 = 한 번');
  await imp(f.plain, { now: NOW + 9000 });
  assert.equal(await snap(), once, '평문으로 한 번 더 = 그대로');
  // 값이 다른 기기 — 옛 자리·적은 사용량·다른 번역·다른 읽은 구간
  await reset();
  await db.put('documents', { id: 'docA', title: 'Book A', pageCount: 40, fileHash: 's256:p:1:aaa', lastOpenedAt: 1, lastPage: 1, lang: 'en', langSource: 'auto' });
  await db.put('usage', { day: '2026-11-17', calls: 9, byKind: { translate: 7 }, capWarned: true });
  await db.put('cards', term({ id: 'vt:s256:t1', translation: 'old', updatedAt: 1, createdAt: 1, docId: 'docA' }));
  await db.put('progress', { docId: 'docA', sectionId: '@read', ranges: [[7, 9]], pages: 3, updatedAt: 1 });
  await imp(f.gz);
  const b = await snap();
  await imp(f.gz, { now: NOW + 7000 });
  assert.equal(await snap(), b, '값이 다른 기기: 두 번 = 한 번');
  const u = await db.get('usage', '2026-11-17');
  assert.deepEqual([u.calls, u.byKind.translate, u.byKind.readalong, u.capWarned], [9, 7, 4, true], '필드별 큰 값 · OR (합이 아니다)');
  assert.deepEqual((await db.get('progress', ['docA', '@read'])).ranges, [[1, 3], [7, 9]], '읽은 구간 합집합');
  assert.equal((await db.get('cards', 'vt:s256:t1')).translation, 'ضيق النفس', '파일 쪽이 더 새로움');
  assert.equal((await db.get('documents', 'docA')).lastPage, 3);
});

/* ══ I6 데이터 안전 ═══════════════════════════════════════ */
test('I6 ★ 데이터 안전 — 기기 쪽이 더 새로운 진도·단어·카드·필기·자리는 덮이지 않고, 복습 필드·캐시 hits/createdAt 은 그대로', async () => {
  const f = await seedAndExport();
  await reset();
  const LATE = T0 + 86400000;
  await db.put('documents', { id: 'docA', title: 'Mine', pageCount: 40, fileHash: 's256:p:1:aaa', lastOpenedAt: LATE, lastPage: 30, lastLineId: '30:2',
    lang: 'ko', langSource: 'user', domain: 'general', readStats: { pages: 50 }, extraction: { done: true, pagesDone: 40, cursor: 41, failed: [], algoVersion: 12 } });
  await db.put('progress', { docId: 'docA', sectionId: 'I', score: 9, updatedAt: LATE });
  const myTerm = term({ id: 'vt:s256:t1', translation: 'mine-newer', context: 'mine', updatedAt: LATE, createdAt: 1, docId: 'docA',
    sm2: { ease: 2.8, interval: 6, reps: 3, lapses: 0 }, dueAt: LATE + 5, reviewedAt: LATE - 5, introducedAt: 7, suspended: true });
  await db.put('cards', myTerm);
  await db.put('cards', { id: 'sc:1', kind: 'sentence', front: 'f', back: 'mine', updatedAt: T0 - 5, reviewedAt: LATE, docId: 'docA' });
  await db.put('annotations', { id: 'an1', docId: 'docA', pageNo: 2, kind: 'note', text: 'mine newer', updatedAt: LATE });
  await db.put('mistakes', { id: 'mis1', questionId: 'docA:I:q1', attemptId: 'att1', docId: 'docA', resolvedAt: LATE });
  const ck = 'translate|ar|docA|s256:' + 'ab'.repeat(16) + '0';
  await db.put('aiCache', { key: ck, docId: 'docA', kind: 'translate', targetLang: 'ar', result: 'mine', createdAt: 5, hits: 77, sizeBytes: 100 });
  const r = await imp(f.gz);
  assert.equal(r.ok, true);
  const d = await db.get('documents', 'docA');
  assert.deepEqual([d.lastPage, d.lastLineId, d.lastOpenedAt, d.lang, d.langSource, d.domain, d.readStats.pages, d.title, d.extraction.done],
    [30, '30:2', LATE, 'ko', 'user', 'general', 50, 'Mine', true]);
  assert.equal((await db.get('progress', ['docA', 'I'])).score, 9);
  assert.deepEqual(await db.get('cards', 'vt:s256:t1'), myTerm, '단어 — 내용·복습 필드·suspended 전부 그대로');
  assert.equal((await db.get('cards', 'sc:1')).back, 'mine', '문장 카드 — 기기 복습이 더 늦다');
  assert.equal((await db.get('annotations', 'an1')).text, 'mine newer');
  assert.equal((await db.get('mistakes', 'mis1')).resolvedAt, LATE);
  const c = await db.get('aiCache', ck);
  assert.deepEqual([c.result, c.hits, c.createdAt], ['mine', 77, 5], '캐시 — 기기 값 보존');
  // 파일 쪽 복습이 더 늦을 때만 복습 필드(내용과 따로)
  await reset();
  await db.put('cards', term({ id: 'vt:s256:t1', updatedAt: T0, createdAt: T0, dueAt: T0, context: 'Line one\nline two', docId: 'docA', reviewedAt: 1 }));
  const lines = (await f.plain.text()).split('\n').map((l) => (l.includes('"vt:s256:t1"')
    ? l.replace('"reviewedAt":null', '"reviewedAt":' + (T0 + 50)).replace('"dueAt":' + T0, '"dueAt":' + (T0 + 999)) : l));
  await imp(fileOf(lines.join('\n')));
  const t1 = await db.get('cards', 'vt:s256:t1');
  assert.deepEqual([t1.reviewedAt, t1.dueAt, t1.updatedAt], [T0 + 50, T0 + 999, T0], '복습만 바뀌고 내용 시각은 그대로');
});

/* ══ I7 term 맞추기 ═══════════════════════════════════════ */
test('I7 term — 다른 id 의 같은 낱말은 term+targetLang 으로 찾아 그 항목에 · 원어를 바꿔 다른 항목과 겹치면 내용 그대로(dup)', async () => {
  const f = await seedAndExport();
  await reset();
  // 다른 기기에서 새로 저장한 같은 낱말(fnv id) — 더 옛것
  await db.put('cards', term({ id: 'vt:fnv:abc:7', translation: 'قديم', updatedAt: 5, createdAt: 5, docId: null }));
  const r = await imp(f.gz);
  assert.equal(r.ok, true);
  const terms = (await collect('cards')).filter((c) => c.kind === 'term' && c.term === 'dyspnea');
  assert.equal(terms.length, 1, '같은 낱말이 둘이 되지 않는다');
  assert.equal(terms[0].id, 'vt:fnv:abc:7');
  assert.equal(terms[0].translation, 'ضيق النفس', '파일이 더 새로움 → 내용만');
  assert.equal(terms[0].context, 'Line one line two', '내용은 8f importPlan 그대로 — 그 정규화(공백 하나로)까지 같다');
  // dup — 기기의 t2(edema) 를 파일이 dyspnea 로 고쳤는데 기기에 dyspnea 가 따로 있다
  await reset();
  await db.put('cards', term({ id: 'vt:s256:t2', term: 'edema', surface: 'edema', translation: 'وذمة', updatedAt: 5, createdAt: 5 }));
  await db.put('cards', term({ id: 'vt:other', translation: 'X', updatedAt: 5, createdAt: 5 }));
  const lines = (await f.plain.text()).split('\n').map((l) => (l.includes('"vt:s256:t2"')
    ? l.replace('"term":"edema"', '"term":"dyspnea"').replace('"surface":"edema"', '"surface":"Dyspnea"') : l));
  const r2 = await imp(fileOf(lines.join('\n')));
  assert.equal(r2.dup, 1);
  assert.equal((await db.get('cards', 'vt:s256:t2')).term, 'edema', '겹치는 원어로 바꾸지 않는다');
  assert.equal((await db.get('cards', 'vt:other')).term, 'dyspnea');
});

/* ══ I8 잘린 파일 ═════════════════════════════════════════ */
test('I8 ★ 잘린 파일 — 평문: 반쪽 줄 하나만 버리고 나머지 · gzip: 흐름 끝 잘림 · 깨진 UTF-8: 그 앞까지', async () => {
  const f = await seedAndExport();
  const text = await f.plain.text();
  const ls = text.split('\n');
  // 마지막 캐시 줄 가운데에서 자름(끝 줄 없음)
  const cutAt = text.indexOf(ls[ls.length - 3]) + 30;
  await reset();
  const r = await imp(fileOf(text.slice(0, cutAt)));
  assert.equal(r.ok, true);
  assert.equal(r.truncated, true);
  assert.equal(r.bad, 1, '반쪽 줄 하나');
  assert.equal(Number(await db.count('aiCache')), f.head.counts.aiCache - 1, '나머지는 들어감');
  assert.equal(Number(await db.count('cards')), f.head.counts.cards);
  // gzip 을 가운데에서 자름 — 흐름이 깨진다(앞까지는 들어간다)
  {
    await reset();
    await seedLibrary();
    let seed = 11;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed; };
    const rows = [];
    for (let i = 0; i < 2000; i++) rows.push({ key: 'translate|ar|docA|fnv:' + String(i).padStart(6, '0'), docId: 'docA', kind: 'translate',
      result: 'ترجمة ' + rnd().toString(36) + rnd().toString(36), createdAt: i, hits: 0, sizeBytes: 10 });
    await db.putAll('aiCache', rows);
    const big = gzipSync(Buffer.from(await (await exportBackup({ gzip: false, now: T0 })).blob.text()));
    await reset();
    const rg = await imp(fileOf([big.subarray(0, Math.floor(big.length * 0.6))], 'x.jsonl.gz'));
    assert.equal(rg.gz, true);
    assert.equal(rg.ok, true);
    assert.equal(rg.truncated, true);
    assert.equal(rg.broken, true);
    assert.equal(Number(await db.count('documents')), 2);
    const nc = Number(await db.count('aiCache'));
    assert.ok(nc > 500 && nc < 2004, '앞까지 ' + nc);
  }
  // 깨진 UTF-8(엄격 디코더) — 셋째 줄 뒤에 0xFF → 그 앞 줄까지
  await reset();
  const enc = new TextEncoder();
  const head3 = ls.slice(0, 3).join('\n') + '\n';
  const rb = await imp(fileOf([enc.encode(head3), new Uint8Array([0xff, 0xfe, 0x41]), enc.encode('\n' + ls.slice(3).join('\n'))]));
  assert.equal(rb.ok, true);
  assert.equal(rb.broken, true);
  assert.equal(rb.records, 2, '깨진 곳 앞 두 줄만');
  assert.equal(Number(await db.count('documents')), 2);
  assert.equal(Number(await db.count('aiCache')), 0);
});

/* ══ I9 거절 ══════════════════════════════════════════════ */
test('I9 거절 — format 2 → newer(아무것도 쓰지 않음) · 다른 파일 → not-backup · 줄바꿈 없는 큰 파일 → not-backup(첫 줄 상한)', async () => {
  const f = await seedAndExport();
  const text = await f.plain.text();
  const nl = text.indexOf('\n');
  const head2 = JSON.stringify(Object.assign(JSON.parse(text.slice(0, nl)), { format: 2 }));
  for (const gz of [false, true]) {
    await reset();
    const body = head2 + text.slice(nl);
    const r = await imp(fileOf([gz ? gzipSync(Buffer.from(body)) : body]));
    assert.deepEqual([r.ok, r.code], [false, 'newer']);
    assert.equal(Number(await db.count('documents')), 0, '아무것도 쓰지 않는다');
    const p = await IM.previewBackup(fileOf([gz ? gzipSync(Buffer.from(body)) : body]));
    assert.deepEqual(p, { ok: false, code: 'newer' });
  }
  assert.equal((await imp(fileOf('{"hello":1}\n{"t":"rec"}\n'))).code, 'not-backup');
  assert.equal((await imp(fileOf([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])]))).code, 'not-backup', 'PDF 를 잘못 고름');
  assert.equal((await imp(fileOf(''))).code, 'not-backup');
  assert.equal((await IM.previewBackup(fileOf('nope'))).code, 'not-backup');
  // 줄바꿈 없는 큰 글자(상한 넘음) — 끝까지 읽지 않고 거절
  const big = new Blob(Array.from({ length: 10 }, () => 'x'.repeat(1024 * 1024)));
  const t = Date.now();
  const rb = await imp(fileOf([big]));
  assert.equal(rb.code, 'not-backup');
  assert.ok(rb.long >= 1);
  assert.ok(Date.now() - t < 5000);
});

/* ══ I10 설정 ═════════════════════════════════════════════ */
test('I10 설정 — 끔 → 설정 0 · 허용 밖·키 모양 건너뜀 · 의료 사이트 id 꼴 고침', async () => {
  const f = await seedAndExport();
  await reset();
  const r = await imp(f.gz, { withSettings: false });
  assert.equal(r.ok, true);
  assert.equal(Number(await db.count('settings')), 0);
  assert.equal(r.ops.settings.skip, f.head.counts.settings);
  // 손댄 파일 — 허용 밖·키 모양·id 꼴이 틀린 링크
  await reset();
  const text = await f.plain.text();
  const ls = text.split('\n');
  const extra = [
    B.recLine('settings', { key: 'privacy.consentedAt', value: 'x' }),
    JSON.stringify({ t: 'rec', s: 'settings', v: { key: 'ai.model', value: 'AIza' + 'SyFAKEFAKEFAKEFAKEFAKEFAKEFAKE12345' } }),
    JSON.stringify({ t: 'rec', s: 'settings', v: { key: 'search.recent', value: ['a'], ['AIza' + 'SyFAKEFAKEFAKEFAKEFAKEFAKEFAKE99999']: 1 } }),
    JSON.stringify({ t: 'rec', s: 'blobs', v: { docId: 'docA' } }),
    JSON.stringify({ t: 'rec', s: 'settings', v: { key: 'links.medical', value: [{ id: 'bad\nid', name: 'X', url: 'https://x.example/?q={q}' }] } })
  ];
  ls.splice(2, 0, ...extra);
  const r2 = await imp(fileOf(ls.join('\n')));
  assert.equal(r2.ok, true);
  assert.equal(await db.get('settings', 'privacy.consentedAt'), undefined);
  assert.equal(await db.get('settings', 'ai.model'), undefined, '키 모양 값');
  assert.deepEqual(await db.get('settings', 'search.recent'), { key: 'search.recent', value: ['a'] }, '키 모양 속성 이름은 빠지고 값은 들어감');
  assert.equal(Number(await db.count('blobs')), 0, '파일의 blobs 줄은 넣지 않는다');
  const links = (await db.get('settings', 'links.medical')).value;
  assert.ok(Array.isArray(links));
  for (const l of links) assert.match(l.id, /^[A-Za-z0-9_-]+$/, '줄바꿈 id 없음');
  assert.ok(r2.mismatch.length > 0, '머리 줄과 실제 개수가 다르면 알린다');
});

/* ══ I11 미리보기 ═════════════════════════════════════════ */
test('I11 미리보기 — 머리 줄·문서 목록만 · 이미 있음/새로 생김 · 잘림(평문 true/false · gzip null) · hash 다름', async () => {
  const f = await seedAndExport();
  await reset();
  await db.put('documents', { id: 'devA', title: 'A', pageCount: 40, fileHash: 's256:p:1:aaa', lastOpenedAt: 1 });
  const p = await IM.previewBackup(f.gz);
  assert.equal(p.ok, true);
  assert.deepEqual(p.docs, { total: 2, existing: 1, fresh: 1 });
  assert.deepEqual(p.counts, f.head.counts);
  assert.equal(p.truncated, typeof CompressionStream === 'function' ? null : false, 'gzip 은 끝까지 풀어야 안다');
  assert.equal(p.include.cache, true);
  assert.equal(p.createdAt, new Date(T0).toISOString());
  assert.equal(typeof p.hashMismatch, 'boolean');
  const pp = await IM.previewBackup(f.plain);
  assert.equal(pp.truncated, false);
  const text = await f.plain.text();
  assert.equal((await IM.previewBackup(fileOf(text.slice(0, text.length - 40)))).truncated, true);
  // hash 가 다른 파일 — 경고만(캐시는 그래도 넣는다)
  const other = JSON.parse(text.split('\n')[0]);
  other.hash = other.hash === 's256' ? 'fnv' : 's256';
  const p2 = await IM.previewBackup(fileOf(JSON.stringify(other) + text.slice(text.indexOf('\n'))));
  assert.equal(p2.hashMismatch, !p.hashMismatch);
  // 미리보기는 아무것도 쓰지 않는다
  assert.equal(Number(await db.count('documents')), 1);
  assert.equal(Number(await db.count('aiCache')), 0);
});

/* ══ I12 멈춤 → 다시 ══════════════════════════════════════ */
test('I12 멈춤(signal) → 같은 파일로 다시 → 한 번에 넣은 것과 같다 · 진행 알림은 끝까지', async () => {
  await reset();
  await seedLibrary();
  const rows = [];
  for (let i = 0; i < 1300; i++) rows.push({ key: 'translate|ar|docA|fnv:' + String(i).padStart(6, '0'), docId: 'docA', kind: 'translate', result: 'r' + i, createdAt: i, hits: 0, sizeBytes: 10 });
  await db.putAll('aiCache', rows);
  const { file } = await exportFile();
  // 한 번에
  await reset();
  const seen = [];
  const full = await imp(file, { onProgress: (p) => seen.push(p) });
  assert.equal(full.ok, true);
  const want = await snap();
  assert.ok(seen.length >= 3, '묶음마다 알림');
  const last = seen[seen.length - 1];
  assert.equal(last.done, last.total, '진행 막대가 끝까지');
  // 두 묶음 뒤 멈춤
  await reset();
  const sig = { aborted: false };
  let n = 0;
  const part = await imp(file, { signal: sig, onProgress: (p) => { if (p.done > 0 && ++n === 2) sig.aborted = true; } });
  assert.equal(part.stopped, true);
  assert.equal(part.ok, false);
  const mid = Number(await db.count('aiCache'));
  assert.ok(mid > 0 && mid < 1304, '중간까지 ' + mid);
  const again = await imp(file);
  assert.equal(again.ok, true);
  assert.equal(await snap(), want, '끊고 다시 = 한 번에');
});

/* ══ I13 지운 항목 ════════════════════════════════════════ */
test('I13 지운 항목 — 기기에서 지운 단어·문서가 파일에 있으면 다시 생긴다(병합만 — 설계), 들어온 수는 ops.add 에', async () => {
  const f = await seedAndExport();
  await reset();
  await imp(f.gz);
  await db.del('cards', 'vt:s256:t2');           // 이 기기에서 단어 하나 지움
  await db.deleteDocument('docB');               // 문서 하나 지움
  const r = await imp(f.gz);
  assert.ok(await db.get('cards', 'vt:s256:t2'), '지운 단어가 다시 생긴다(설계 — 지움을 옮기지 않는다)');
  assert.ok(await db.get('documents', 'docB'));
  assert.equal(r.ops.cards.add, 1);
  assert.equal(r.ops.documents.add, 1);
});

/* ══ I14 정적 ═════════════════════════════════════════════ */
test('I14 정적 — backup/import.js 는 config·db·hash·text/* 만 import · 웹 저장소·화면 낱말 0', () => {
  const s = src('../js/backup/import.js');
  for (const sp of [...s.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])) {
    assert.ok(/^\.\.\/(config|db|hash)\.js$|^\.\.\/text\/[a-z]+\.js$/.test(sp), 'import.js import ' + sp);
  }
  assert.ok(!/\bimport\(/.test(s), '동적 import 없음');
  assert.ok(!/localStorage|sessionStorage/.test(s));
  assert.ok(!/innerHTML|document\.|createElement|location\./.test(s));
  // 쓰기는 트랜잭션 안에서 읽은 기기 값으로(db.patch 와 같은 보장) — 한 묶음 한 트랜잭션
  assert.match(s, /withTx\(TX_STORES, 'readwrite'/);
  assert.match(s, /new TextDecoderStream\('utf-8', \{ fatal: true \}\)/);
  // db.js 는 고치지 않는다(DB 판 3)
  assert.equal(db.DB_VERSION, 3);
});

/* ══ I15 화면 배선 · i18n ═════════════════════════════════ */
test('I15 화면 — 가져오기 단추·파일 고르기(accept 없음)·미리보기·설정 체크·떠나기 확인·다시 불러오기 · i18n 4언어', () => {
  const ui = src('../js/ui/backup.js');
  for (const f of ["'beforeunload'", 'location.reload()', 'previewBackup(', 'importBackup(', "input.type = 'file'", "'backup.withSettings'",
    "'backup.import.leave'", "'backup.imported'", "'hashchange'"]) assert.ok(ui.includes(f), f);
  assert.ok(!/accept\s*=/.test(ui), 'accept 는 비워 둔다(Android 파일 고르기)');
  assert.ok(!/innerHTML/.test(ui));
  for (const m of ui.matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.ok(!/\/ai\//.test(m[1]), 'ui/backup.js import ' + m[1]);
  const keys = new Set();
  for (const m of ui.matchAll(/['"](backup\.[a-zA-Z.]+)['"]/g)) if (!m[1].endsWith('.')) keys.add(m[1]);
  keys.delete('backup.lastExportAt');
  keys.delete('backup.last.days');
  keys.delete('backup.part.');
  for (const lang of LANGS) for (const k of keys) assert.equal(typeof BUNDLES[lang][k], 'string', lang + ' ' + k);
  // 안내 줄은 가져오기가 생겼으니 6절 문구로(9c-1 보고 남은 문제 1)
  assert.ok(!/아직 가져오기가 없습니다/.test(BUNDLES.ko['backup.howto']));
  assert.match(BUNDLES.ko['backup.howto'], /같은 PDF/);
});

/* ══ I16 `[9c-3 — 9c2R #6]` 시험 틈 R2·R3·R5 ═══════════════════ */
test('I16 [9c2R #6] 같은 낱말·다른 대상 언어 기기 항목은 따로 · 끝 줄 뒤 레코드는 넣지 않음 · 키가 틀린 줄은 그 줄만 건너뜀', async () => {
  const f = await seedAndExport();
  // R2 — term 인덱스로 찾을 때 대상 언어까지 본다: 기기의 fr 항목(다른 id)은 그대로, 파일의 ar 항목은 따로 들어온다
  await reset();
  await db.put('cards', term({ id: 'vt:fnv:fr:1', targetLang: 'fr', translation: 'dyspnée', updatedAt: 5, createdAt: 5, docId: null }));
  const r = await imp(f.gz);
  assert.equal(r.ok, true);
  const dys = (await collect('cards')).filter((c) => c.kind === 'term' && c.term === 'dyspnea');
  assert.deepEqual(dys.map((c) => c.targetLang).sort(), ['ar', 'fr'], '대상 언어가 다르면 다른 항목');
  assert.equal((await db.get('cards', 'vt:fnv:fr:1')).translation, 'dyspnée', '기기 fr 항목 내용 그대로');
  // R3 — 끝 줄 뒤에 붙은 레코드(손댄 파일)는 넣지 않는다
  await reset();
  const text = (await f.plain.text()).replace(/\n+$/, '');
  const after = JSON.stringify({ t: 'rec', s: 'annotations', v: { id: 'after-end', docId: 'docA', text: 'x', updatedAt: T0 } });
  const r3 = await imp(fileOf(text + '\n' + after + '\n'));
  assert.equal(r3.ok, true);
  assert.equal(await db.get('annotations', 'after-end'), undefined, '끝 줄 뒤 레코드 0');
  assert.equal(r3.bad, 1);
  // R5 — 키가 틀린 줄(sectionId 없는 진도·객체 키 사용량)은 그 줄만 건너뛰고, 묶음 트랜잭션은 무너지지 않는다(뒤 줄까지 들어감)
  await reset();
  const ls = text.split('\n');
  const badKeys = [
    JSON.stringify({ t: 'rec', s: 'progress', v: { docId: 'docA', score: 1, updatedAt: T0 } }),
    JSON.stringify({ t: 'rec', s: 'usage', v: { day: { x: 1 }, calls: 1 } })
  ];
  ls.splice(2, 0, ...badKeys);
  const r5 = await imp(fileOf(ls.join('\n')));
  assert.equal(r5.ok, true, '쓰기 실패 없음 ' + r5.code);
  assert.ok(r5.ops.progress.skip >= 1 && r5.ops.usage.skip >= 1);
  assert.equal(Number(await db.count('aiCache')), f.head.counts.aiCache, '마지막 캐시 줄까지 들어감');
});

/* ══ I17 `[9c-3 — 9c2R #2·#3]` 설정 합집합 · 타입·범위 ════════════ */
const { LINKS, SEARCH } = await import('../js/config.js');
const { DEFAULTS } = await import('../js/settings.js');

test('I17 [9c2R #2] 의료 사이트·최근 검색어는 합집합(기기 먼저·주소로 겹침 제거·상한) · null(기본 목록) 쪽 · 멱등', async () => {
  const L = (id, url) => ({ id: id, name: id, url: url });
  const mine = [L('pubmed', 'https://pubmed.ncbi.nlm.nih.gov/?term={q}'), L('mine', 'https://mine.example/?q={q}')];
  const theirs = [L('pubmed', 'https://pubmed.ncbi.nlm.nih.gov/?term={q}'), L('mine', 'https://other.example/?q={q}'), L('t3', 'https://t3.example/{q}')];
  const u = IM.unionSetting('links.medical', mine, theirs);
  assert.deepEqual(u.map((x) => x.url), ['https://pubmed.ncbi.nlm.nih.gov/?term={q}', 'https://mine.example/?q={q}', 'https://other.example/?q={q}', 'https://t3.example/{q}'], '기기 순서 먼저, 주소로 겹침 제거');
  assert.equal(new Set(u.map((x) => x.id)).size, u.length, '겹친 id 는 새 id');
  assert.deepEqual(u.slice(0, 2), mine, '기기 항목은 그대로');
  assert.deepEqual(IM.unionSetting('links.medical', u, theirs), u, '멱등');
  assert.deepEqual(IM.unionSetting('links.medical', null, theirs), theirs, '기기 = 기본 목록(null) → 파일 값(새 휴대폰)');
  assert.deepEqual(IM.unionSetting('links.medical', mine, null), mine, '파일 = 기본 목록 → 기기 그대로');
  const many = Array.from({ length: 40 }, (_, i) => L('x' + i, 'https://x' + i + '.example/{q}'));
  assert.equal(IM.unionSetting('links.medical', mine, many).length, LINKS.MAX, '상한');
  assert.deepEqual(IM.unionSetting('search.recent', ['b', 'a'], ['a', 'c', 'd', 'e', 'f']), ['b', 'a', 'c', 'd', 'e'].slice(0, SEARCH.RECENT_MAX));
  assert.deepEqual(IM.unionSetting('search.recent', [], ['q']), ['q']);
  assert.equal(IM.unionSetting('ui.lang', 'ko', 'ar'), 'ar', '그 밖 설정은 파일 값(덮기)');
  // 실제 가져오기 — 기기에만 있던 의료 사이트·최근 검색어가 남는다 · 두 번 = 한 번
  const f = await seedAndExport();
  await reset();
  await db.put('settings', { key: 'links.medical', value: [L('mine', 'https://mine.example/?q={q}')] });
  await db.put('settings', { key: 'search.recent', value: ['asthma'] });
  await db.put('settings', { key: 'ui.lang', value: 'en' });
  const r = await imp(f.gz);
  assert.equal(r.ok, true);
  const links = (await db.get('settings', 'links.medical')).value;
  assert.deepEqual(links.map((x) => x.url), ['https://mine.example/?q={q}', 'https://pubmed.ncbi.nlm.nih.gov/?term={q}']);
  assert.equal((await db.get('settings', 'ui.lang')).value, 'ar', '그 밖 설정은 파일 값');
  const s1 = await snap();
  await imp(f.gz);
  assert.equal(await snap(), s1, '같은 파일 두 번 = 한 번');
});

test('I18 [9c2R #3 · 9c3R #1] 타입·범위 — 설정은 DEFAULTS 와 같은 꼴일 때만 · 문서 미래 시각은 새 문서만 지금으로(기존 문서는 기기 유지) · lastPage·pageCount 꼴 · term 없는 항목 거절', async () => {
  assert.equal(IM.settingTypeOk('reader.fontSize', 24, DEFAULTS), true);
  assert.equal(IM.settingTypeOk('reader.fontSize', 'huge', DEFAULTS), false);
  assert.equal(IM.settingTypeOk('ai.dailyCap', 'unlimited', DEFAULTS), false);
  assert.equal(IM.settingTypeOk('ai.dailyCap', Infinity, DEFAULTS), false);
  assert.equal(IM.settingTypeOk('reader.showDone', 'yes', DEFAULTS), false);
  assert.equal(IM.settingTypeOk('search.recent', 'a', DEFAULTS), false);
  assert.equal(IM.settingTypeOk('ui.lang', 'ar', DEFAULTS), true, '기본 null 키는 글자도');
  assert.equal(IM.settingTypeOk('links.medical', [], DEFAULTS), true);
  assert.equal(IM.settingTypeOk('links.medical', { a: 1 }, DEFAULTS), false);
  assert.equal(IM.settingTypeOk('vocab.lastExportAt', 1700000000000, DEFAULTS), true);
  assert.equal(IM.settingTypeOk('reader.fontSize', 'huge', null), true, 'defaults 없으면 보지 않는다');
  const fut = { id: 'd', lastOpenedAt: NOW + 9e9, addedAt: '9999-01-01T00:00:00Z', lastPage: 'abc', pageCount: 'many' };
  const d = IM.cleanRecord('documents', fut, { nowMs: NOW });
  assert.deepEqual([d.lastOpenedAt, d.addedAt, 'lastPage' in d, 'pageCount' in d], [NOW + 9e9, fut.addedAt, false, false], 'cleanRecord 는 꼴만(시각은 docStep 몫)');
  const n = IM.docTimesFor(d, NOW, true);
  assert.deepEqual([n.lastOpenedAt, n.addedAt], [NOW, NOW], '새 문서 — 미래 시각은 지금으로');
  const e = IM.docTimesFor({ id: 'd', lastOpenedAt: NOW + 9e9, lastPage: 7, lastLineId: '7:1', lang: 'fr' }, NOW, false);
  assert.deepEqual(['lastOpenedAt' in e, 'lastPage' in e, 'lastLineId' in e, e.lang], [false, false, false, 'fr'], '기존 문서 — 읽던 자리는 기기 유지');
  const ok = { id: 'd', lastOpenedAt: NOW - 5, addedAt: NOW - 9, lastPage: 3, pageCount: 40 };
  assert.equal(IM.cleanRecord('documents', ok, { nowMs: NOW }), ok, '맞는 레코드는 같은 객체');
  assert.equal(IM.docTimesFor(ok, NOW, true), ok);
  assert.equal(IM.docTimesFor(ok, NOW, false), ok);
  assert.equal(IM.cleanRecord('cards', { id: 'vt:x', kind: 'term', term: '  ', targetLang: 'ar' }), null);
  assert.equal(IM.cleanRecord('cards', { id: 'vt:x', kind: 'term', targetLang: 'ar' }), null);
  assert.equal(IM.cleanRecord('settings', { key: 'reader.fontSize', value: 'huge' }, { defaults: DEFAULTS }), null);
  // 실제 가져오기 — 손댄 파일
  const f = await seedAndExport();
  await reset();
  const ls = (await f.plain.text()).split('\n').map((l) => (l.includes('"s":"documents"') && l.includes('"docA"')
    ? l.replace(/"lastOpenedAt":\d+/, '"lastOpenedAt":253370764800000') : l));
  ls.splice(3, 0,
    JSON.stringify({ t: 'rec', s: 'settings', v: { key: 'reader.fontSize', value: 'huge' } }),
    JSON.stringify({ t: 'rec', s: 'cards', v: { id: 'vt:noterm', kind: 'term', targetLang: 'ar', translation: 'x' } }));
  const r = await imp(fileOf(ls.join('\n')), { defaults: DEFAULTS });
  assert.equal(r.ok, true);
  assert.equal((await db.get('documents', 'docA')).lastOpenedAt, NOW, '미래 시각은 지금으로');
  assert.equal((await db.get('settings', 'reader.fontSize')).value, 24, '틀린 꼴은 건너뛰고 파일의 맞는 값');
  assert.equal(await db.get('cards', 'vt:noterm'), undefined);
  // `[9c-3b — 9c3R #1]` 다른 now 로 두 번 가져오기 = 한 번(두 번째 keep) · 그사이 기기 진도가 앞섰으면 되돌아가지 않음
  const ff = fileOf(ls.join('\n'));
  const s1 = await snap();
  const r2 = await imp(ff, { defaults: DEFAULTS, now: NOW + 5000 });
  assert.equal(await snap(), s1, '다른 now 로 두 번 = 한 번');
  assert.deepEqual([r2.ops.documents.keep, r2.ops.documents.patch], [2, 0], '두 번째는 keep');
  await db.patch('documents', 'docA', { lastOpenedAt: NOW + 6000, lastPage: 10 });
  await imp(ff, { defaults: DEFAULTS, now: NOW + 9000 });
  assert.equal((await db.get('documents', 'docA')).lastPage, 10, '그사이 더 읽은 진도는 되돌아가지 않음');
});
