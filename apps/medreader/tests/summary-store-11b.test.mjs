/* ============================================================
   tests/summary-store-11b.test.mjs — 11-1 저장 (spec 17-2-1 4-4 · 8 "11-1" 수용 기준 — fake-idb)

   - `notes/summaries`: 같은 문단·같은 대상 두 번 저장 → 한 레코드(`updatedAt` 만 새로 — 11-D10) · 대상 언어가 다르면 둘 ·
     `list({docId, kind})` 쪽·문단 순 · `docId_pageNo` 인덱스로 잡힘 · 원문 문단 글 저장 0 · `relocate`(같은 해시 → 그 문단, 없으면 null) ·
     `findFor`·`count`·`remove`(필기는 지우지 않음) · `saveOutline`(같은 범위·대상이면 대체)
   - ★ `db.deleteDocument` 뒤 `summary`·`outline` 이 남는다 — `[정정 2026-11-17 — 11-1 Build]` 20-D11 방향(필기는 남김)으로
     **다른 `annotations`(가짜 `highlight`)도 남는다**(수용 기준의 "지워짐"을 뒤집어 시험). 단어장 term 은 남고 term **캐시**는 지운다(RM5).
   - 9c 백업: `kind:'summary'|'outline'` 레코드가 **문서 없이도** 내보내지고 가져와진다(9c-1·9c-2 코드 그대로 — 확인만).
   지어낸 글자만. 실제 키·실제 호출 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
const idb = installFakeIdb();

const db = await import('../js/db.js');
const S = await import('../js/notes/summaries.js');
const { hashHex, normalizeForHash } = await import('../js/hash.js');
const { exportBackup } = await import('../js/backup/export.js');
const IM = await import('../js/backup/import.js');
const B = await import('../js/text/backup.js');

const T0 = new Date(2026, 10, 17, 9, 0, 0).getTime();
const clock = { t: T0 };
const store = S.createSummaryStore({ now: () => clock.t });

const TXT = 'Serum ferritin above 500 ng/mL suggests overload. Repeat testing is advised after 6 months.';
const TXT2 = 'Chronic cough has many causes. Most cases improve without specific therapy over time.';
const VAL = { gist: 'ملخص', gistSrc: 'Gist', points: [{ t: 'نقطة', sub: ['فرع'] }], terms: [{ src: 'ferritin', tr: 'فيريتين' }] };

function input(over) {
  return Object.assign({
    docId: 'docZ', pageNo: 12, docTitle: 'Book Z', fileHash: 's256:p:1:zzz',
    para: { paraId: '12:p3', lineIds: ['12:30', '12:31'], text: TXT },
    target: 'ar', src: 'en', langs: ['ar', 'en'], value: VAL, domain: 'medical',
    cacheKey: 'summarize|ar|docZ|s256:x|l=ar+en', provider: 'gemini', model: 'm', promptVersion: 1
  }, over || {});
}

async function reset() {
  for (const s of db.STORE_NAMES) await db.clearStore(s);
}
async function all(storeName) {
  const out = [];
  await db.iterate(storeName, {}, (v) => { out.push(v); });
  return out;
}

test('N1 ★ 같은 문단·같은 대상 두 번 저장 → 한 레코드(id·createdAt 유지, updatedAt 만 새로) · 대상 언어가 다르면 둘', async () => {
  await reset();
  clock.t = T0;
  const a = await store.save(input());
  assert.equal(a.created, true);
  clock.t = T0 + 5000;
  const b = await store.save(input({ value: Object.assign({}, VAL, { gist: 'ملخص جديد' }) }));
  assert.equal(b.created, false);
  assert.equal(b.rec.id, a.rec.id);
  const rows = await all('annotations');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].gist, 'ملخص جديد', '새 내용으로 대체');
  assert.equal(rows[0].createdAt, T0);
  assert.equal(rows[0].updatedAt, T0 + 5000);
  clock.t = T0 + 9000;
  const c = await store.save(input({ target: 'ko', langs: ['ko', 'en'] }));
  assert.equal(c.created, true);
  assert.notEqual(c.rec.id, a.rec.id);
  assert.equal((await all('annotations')).length, 2);
  // 문단 글이 조금 달라도(공백) 같은 해시 → 같은 레코드
  const d = await store.save(input({ para: { paraId: '12:p3', lineIds: [], text: '  ' + TXT.replace(' ', '   ') + ' ' } }));
  assert.equal(d.created, false);
  assert.equal((await all('annotations')).length, 2);
});

test('N2 ★ 레코드 꼴 — 맨 위 docId·pageNo(docId_pageNo 인덱스로 잡힘) · anchor.textHash = 캐시 키와 같은 정규화 해시 · 원문 문단 글 0', async () => {
  await reset();
  clock.t = T0;
  const r = (await store.save(input())).rec;
  assert.equal(r.kind, 'summary');
  assert.equal(r.docId, 'docZ');
  assert.equal(r.pageNo, 12);
  assert.equal(r.anchor.textHash, await hashHex(normalizeForHash(TXT)));
  assert.equal(r.anchor.textHash, await S.textHashOf(TXT));
  assert.deepEqual(r.anchor, { pageNo: 12, lineIds: ['12:30', '12:31'], paraId: '12:p3', textHash: r.anchor.textHash });
  assert.equal(r.fileHash, 's256:p:1:zzz');
  assert.deepEqual(r.langs, ['ar', 'en']);
  assert.equal(r.docTitle, 'Book Z');
  assert.ok(!('text' in r));
  assert.equal(JSON.stringify(await all('annotations')).indexOf('Repeat testing'), -1, '★ 원문 문단 글은 저장하지 않는다');
  const viaIndex = [];
  await db.iterate('annotations', { index: 'docId_pageNo', query: ['docZ', 12] }, (v) => { viaIndex.push(v.id); });
  assert.deepEqual(viaIndex, [r.id]);
  const viaKind = [];
  await db.iterate('annotations', { index: 'kind', query: 'summary' }, (v) => { viaKind.push(v.id); });
  assert.deepEqual(viaKind, [r.id]);
  // 필수가 없으면 저장하지 않는다
  assert.equal(await store.save(input({ docId: '' })), null);
  assert.equal(await store.save(input({ pageNo: undefined })), null);
  assert.equal(await store.save(input({ value: { gist: ' ' } })), null);
  assert.equal(await store.save(input({ para: { paraId: 'x', text: '' } })), null);
});

test('N3 list({docId, kind}) — 쪽·문단 순(문단 번호는 수로 — p10 > p9) · 다른 책·다른 kind 빠짐 · findFor · count · remove(필기 레코드는 지우지 않음)', async () => {
  await reset();
  clock.t = T0;
  const mk = (pageNo, n, text, docId) => store.save(input({ docId: docId || 'docZ', pageNo: pageNo, para: { paraId: pageNo + ':p' + n, lineIds: [], text: text } }));
  await mk(14, 0, 'Fourteen zero paragraph text here. Second sentence.');
  await mk(12, 10, 'Twelve ten paragraph text here. Second sentence.');
  await mk(12, 9, 'Twelve nine paragraph text here. Second sentence.');
  await mk(3, 0, 'Other book paragraph text here. Second sentence.', 'docY');
  await db.put('annotations', { id: 'hl1', kind: 'highlight', docId: 'docZ', pageNo: 12, anchor: { pageNo: 12 } });
  const l = await store.list({ docId: 'docZ', kind: 'summary' });
  assert.deepEqual(l.map((x) => x.anchor.paraId), ['12:p9', '12:p10', '14:p0']);
  assert.equal((await store.list()).length, 4, 'docId 없으면 전체');
  assert.equal((await store.list({ docId: 'docZ', kind: 'outline' })).length, 0);
  const h = await S.textHashOf('Twelve nine paragraph text here. Second sentence.');
  assert.equal((await store.findFor('docZ', h, 'ar')).anchor.paraId, '12:p9');
  assert.equal(await store.findFor('docZ', h, 'ko'), null);
  assert.equal(await store.count('docZ'), 3);
  assert.equal(await store.remove('hl1'), false, '필기는 이 함수로 지우지 않는다');
  assert.ok(await db.get('annotations', 'hl1'));
  assert.equal(await store.remove(l[0].id), true);
  assert.equal(await store.count('docZ'), 2);
  assert.equal(await store.remove('nope'), false);
});

test('N4 saveOutline — 같은 문서·범위·대상이면 대체 · 범위가 다르면 둘 · pageNo = 범위 첫 쪽 · count 에 듦', async () => {
  await reset();
  clock.t = T0;
  const o = (from, to, title) => store.saveOutline({
    docId: 'docZ', docTitle: 'Book Z', range: { from: from, to: to, label: 'Ch' }, target: 'ar',
    value: { title: title, points: [{ t: 'أ', sub: [{ t: 'ب', sub: ['ج'] }] }] }, sources: ['sum:1', 'sum:2'], promptVersion: 1
  });
  const a = await o(10, 14, 'أول');
  clock.t = T0 + 100;
  const b = await o(10, 14, 'ثاني');
  assert.equal(a.rec.id, b.rec.id);
  assert.equal(b.created, false);
  const c = await o(15, 20, 'آخر');
  assert.equal(c.created, true);
  const l = await store.list({ docId: 'docZ', kind: 'outline' });
  assert.deepEqual(l.map((x) => x.title), ['ثاني', 'آخر']);
  assert.equal(l[0].pageNo, 10);
  assert.equal(l[0].kind, 'outline');
  assert.deepEqual(l[0].sources, ['sum:1', 'sum:2']);
  assert.equal(await store.count('docZ'), 2);
  assert.equal(await store.count('docZ', 'summary'), 0);
  assert.equal(await store.saveOutline({ docId: 'docZ', range: { from: 1 }, target: 'ar', value: { title: 't' } }), null);
});

test('N5 ★ relocate — 지금 쪽 문단들(withHashes)에서 같은 해시 → 그 문단 · 다시 추출로 글이 바뀌면 null(쪽 처음으로)', async () => {
  await reset();
  const r = (await store.save(input())).rec;
  const paras = await S.withHashes([{ paraId: '12:p0', text: TXT2 }, { paraId: '12:p4', text: TXT }]);
  assert.equal(store.relocate(r, paras).paraId, '12:p4', '문단 번호가 바뀌어도 해시로 찾는다');
  assert.ok(!('text' in r));
  const changed = await S.withHashes([{ paraId: '12:p3', text: TXT + ' Extra.' }]);
  assert.equal(S.relocate(r, changed), null);
});

test('D1 ★ deleteDocument — summary·outline 남음 · [정정 11-1 — 20-D11] 다른 annotations(가짜 highlight)도 남음 · 단어장·[12-1] 문장 카드 남음 · term 캐시·쪽은 지움', async () => {
  await reset();
  await db.put('documents', { id: 'docZ', title: 'Book Z', fileHash: 'hz' });
  await db.put('documents', { id: 'docY', title: 'Book Y', fileHash: 'hy' });
  const s1 = (await store.save(input())).rec;
  const o1 = (await store.saveOutline({ docId: 'docZ', range: { from: 1, to: 3 }, target: 'ar', value: { title: 'م', points: [] } })).rec;
  await db.put('annotations', { id: 'hl:z', kind: 'highlight', docId: 'docZ', pageNo: 4, anchor: { pageNo: 4 } });
  await db.put('annotations', { id: 'note:y', kind: 'note', docId: 'docY', pageNo: 1 });
  await db.put('cards', { id: 'vt:z', kind: 'term', docId: 'docZ', term: 'ferritin', targetLang: 'ar' });
  await db.put('cards', { id: 'sc:z', kind: 'sentence', docId: 'docZ', front: 'a' });
  await db.put('aiCache', { key: 'term|ar|docZ|h|w=x', kind: 'term', docId: 'docZ', createdAt: 1 });
  await db.put('aiCache', { key: 'summarize|ar|docZ|h|l=ar+en', kind: 'summarize', docId: 'docZ', createdAt: 1 });
  await db.put('pages', { docId: 'docZ', pageNo: 1, text: 'x' });
  const c = await db.deleteDocument('docZ');
  assert.equal(idb.peek('medreader', 'documents', 'docZ'), undefined);
  assert.ok(idb.peek('medreader', 'annotations', s1.id), '★ 저장 요약은 남는다');
  assert.ok(idb.peek('medreader', 'annotations', o1.id), '★ 저장 개요는 남는다');
  assert.ok(idb.peek('medreader', 'annotations', 'hl:z'), '★ [정정 — 20-D11] 필기·하이라이트도 남는다(스토어 전체)');
  assert.ok(idb.peek('medreader', 'annotations', 'note:y'), '다른 문서 필기 그대로');
  assert.equal(c.annotations, 0, 'annotations 는 하나도 지우지 않는다');
  assert.equal(idb.peek('medreader', 'annotations', s1.id).docTitle, 'Book Z', 'docTitle 사본이 출처를 대신한다');
  assert.ok(idb.peek('medreader', 'cards', 'vt:z'), '단어장 그대로(8f-1)');
  assert.ok(idb.peek('medreader', 'cards', 'sc:z'), '[12-1 — 12-D8] 문장 카드도 남는다');
  assert.equal(idb.peek('medreader', 'aiCache', 'term|ar|docZ|h|w=x'), undefined, '★ term 캐시는 지운다(RM5 — 스토어 조건)');
  assert.equal(idb.peek('medreader', 'aiCache', 'summarize|ar|docZ|h|l=ar+en'), undefined, '요약 캐시도 지운다(저장 요약만 남는다)');
  assert.equal(c.pages, 1);
  // 판정 한 곳
  assert.equal(db.keepsOnDocDelete({ kind: 'term' }), true, '기본 스토어 = cards(8f-1 호출 그대로)');
  assert.equal(db.keepsOnDocDelete({ kind: 'term' }, 'cards'), true);
  assert.equal(db.keepsOnDocDelete({ kind: 'term' }, 'aiCache'), false);
  assert.equal(db.keepsOnDocDelete({ kind: 'sentence' }, 'cards'), true, '[12-1 — 12-D8]');
  assert.equal(db.keepsOnDocDelete({ kind: 'sentence' }, 'aiCache'), false);
  assert.equal(db.keepsOnDocDelete({ kind: 'highlight' }, 'annotations'), true);
  assert.equal(db.keepsOnDocDelete(null, 'annotations'), true);
  assert.equal(db.keepsOnDocDelete({ kind: 'summary' }, 'pages'), false);
  assert.equal(db.DB_VERSION, 3, 'DB 버전 그대로');
  // 지운 뒤에도 목록·세기
  assert.equal((await store.list({ docId: 'docZ' })).length, 1);
  assert.equal(await store.count('docZ'), 2);
});

test('B1 ★ 9c 백업 — 문서가 없는(지워진) summary·outline 레코드도 내보내지고, 빈 기기에 가져오면 문서 없이 들어간다 · 다시 가져와도 그대로(멱등)', async () => {
  await reset();
  const s1 = (await store.save(input())).rec;
  const o1 = (await store.saveOutline({ docId: 'docZ', range: { from: 1, to: 3, label: 'Ch' }, target: 'ar', value: { title: 'م', points: [{ t: 'أ', sub: [] }] } })).rec;
  assert.equal(await db.get('documents', 'docZ'), undefined, '전제: 문서 없음');
  const r = await exportBackup({ now: T0 });
  const file = new File([r.blob], r.name);
  await reset();
  const res = await IM.importBackup(file, { now: T0 + 1000 });
  assert.ok(!res.error, JSON.stringify(res.error || null));
  const got = await all('annotations');
  assert.deepEqual(got.map((x) => x.id).sort(), [s1.id, o1.id].sort());
  assert.deepEqual(got.find((x) => x.id === s1.id), s1, '레코드 그대로');
  assert.equal(await db.get('documents', 'docZ'), undefined, '문서는 생기지 않는다');
  const res2 = await IM.importBackup(new File([r.blob], r.name), { now: T0 + 2000 });
  assert.ok(!res2.error);
  assert.deepEqual(await all('annotations'), got, '멱등');
  // 순수 규칙 — 기기에 없으면 add, 파일 쪽이 새로우면 put
  assert.equal(B.mergeRecord('annotations', null, s1).op, 'add');
  assert.equal(B.mergeRecord('annotations', s1, Object.assign({}, s1, { updatedAt: s1.updatedAt + 1 })).op, 'put');
  assert.equal(B.mergeRecord('annotations', s1, s1).op, 'keep');
  assert.equal(IM.cleanRecord('annotations', s1), s1, '꼴 검사 통과(바뀌지 않음)');
});
