/* ============================================================
   tests/cards-12.test.mjs — 12-1 기억 카드 서비스 (spec 17-11 4 · 8 "12-1" 수용 기준 — fake-idb)

   C1  ★ saveSentence — 두 번 → 한 장(created:false) · 대상 언어 다르면 둘 · 앞면만 → back 채움(`[12-3]` updatedAt 그대로) · id 경계(U+0001)
   C2  ★ review — sm2·dueAt·reviewedAt·introducedAt(처음만)만 바뀜, updatedAt·내용 그대로 · srs.log[오늘] n·ms·new · 60일
   C3  ★ queue — due(dueAt 순) → fresh(createdAt 순) · 오늘 새 카드 18 이면 20 중 2 · 멈춤·번역 빈 term 빠짐(noTr) ·
        뒷면 빈 문장 카드 들어감(noBack) · ISO 문자열 dueAt(8f 옛 값)도 숫자처럼
   C4  ★ fillBack — 주입 조회로 채움·저장 / 없으면 그대로 · 조회 밖 호출 0(fetch 0)
   C5  ★ deleteDocument — term·sentence 남음 · kind 없는 레코드 지워짐 · keptCount
   C6  ★ 9c 병합 — 기기 복습이 늦으면 복습 상태는 기기 · 파일이 내용만 늦으면 내용은 파일 · 멈춤은 suspendedAt 늦은 쪽 · 종단(내보내기 → 가져오기) 멱등
   C7  ★ 8f 와 함께 — CSV 가져오기(applyImport)로 번역을 고쳐도 sm2·dueAt 그대로 · changedSince 가 복습·멈춤 뒤 늘지 않음
   C8  removeIfFresh·remove·update·list·get
   C9  정적 — srs/cards.js import 는 config·db·hash·./sm2 만(ui·ai·tts 0) · 설정 키·허용 목록·srs.log 합치기
   C10 ★ [12-1b] id 의 책 칸 = 문서 fileHash 바탕 — 같은 PDF 의 두 문서·지우고 다시 가져온 문서 → 한 장(docId 는 지금 문서로) · 없으면 docId
   C10b ★ [12-1b] 9c — 두 기기가 같은 PDF 를 따로 가져와도 병합 뒤 한 장(변형 키 포함) · remapRecord 는 docId 만 · 멱등
        `[12-1c]` 둘 다 만들기만 한 카드면 B 의 빈 뒷면이 A 뒷면으로 채워짐(전에는 "" 고정)
   C11 ★ [12-1c] 9c 내용 묶음(순수) — ② 안 고친 카드는 고친 카드를 이기지 못함 · ① 빈 글자(back·note·explain)는 지우지 못함 · 둘 다 고치면 늦은 쪽
   C11b ★ [12-1c] 9c 종단 — V5 꼴 양방향(A←B·B←A) 뒷면·메모 지킴 · 두 번 = 한 번
        `[12-1d]` C11 에 — 빈 값 건너뜀은 글자 칸만(비글자 칸 빈 값·null 은 옮겨짐) · 같은 꼴·같은 시각의 다른 글자는 문자열이 큰 쪽
   C11c ★ [12-1d] 세 기기 — W3 꼴(이긴 쪽 빈 뒷면 · 진 두 기기 다른 뒷면) 수렴 · 씨앗 고정 무작위 돌기 갈라짐 0
   지어낸 글자만. 실제 키·실제 호출 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
const idb = installFakeIdb();

let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; throw new Error('호출 금지'); };

const db = await import('../js/db.js');
const C = await import('../js/srs/cards.js');
const S = await import('../js/srs/sm2.js');
const B = await import('../js/text/backup.js');
const V = await import('../js/text/vocab.js');
const IM = await import('../js/backup/import.js');
const { exportBackup } = await import('../js/backup/export.js');
const { createVocabStore } = await import('../js/vocab/store.js');
const { SRS, BACKUP } = await import('../js/config.js');
const { DEFAULTS } = await import('../js/settings.js');

const DAY = 86400000;
const T0 = new Date(2026, 10, 17, 9, 0, 0).getTime();
const DS = new Date(2026, 10, 17).getTime();
const DE = new Date(2026, 10, 18).getTime();
const TODAY = '2026-11-17';
const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

let clock = T0;
const cards = C.createCardStore({ now: () => clock });
const vocab = createVocabStore({ now: () => clock });

async function reset() {
  for (const s of db.STORE_NAMES) await db.clearStore(s);
}
const input = (o) => Object.assign({ front: 'Fever is common after surgery.', srcLang: 'en', targetLang: 'ar', docId: 'docA', docTitle: 'Book A',
  pageNo: 3, lineId: '3:4', paraId: '3:p1', origin: 'band', domain: 'medical' }, o || {});

/* ══ C1 saveSentence ═════════════════════════════════════ */
test('C1 ★ saveSentence — 한 장·created:false · 대상 언어 다르면 둘 · 앞면만 저장 뒤 back 채움([12-3] updatedAt 그대로) · id 경계', async () => {
  await reset();
  clock = T0;
  const a = await cards.saveSentence(input());
  assert.equal(a.created, true);
  const c = a.card;
  assert.equal(c.id, await C.sentenceIdOf('ar', 'docA', 'Fever is common after surgery.'));
  assert.ok(c.id.startsWith('sc:'));
  assert.equal(c.kind, 'sentence');
  assert.equal(c.back, '', '번역이 없으면 앞면만(12-D6)');
  assert.equal(c.explain, '');
  assert.ok(!('term' in c), 'term 필드 없음(인덱스 term 에 섞이지 않게)');
  for (const k of ['createdAt', 'updatedAt', 'dueAt']) assert.equal(c[k], T0, k + ' 숫자 ms');
  assert.deepEqual(c.sm2, { ease: 2.5, interval: 0, reps: 0, lapses: 0 });
  assert.deepEqual([c.reviewedAt, c.introducedAt, c.suspended, c.note, c.origin, c.pageNo, c.lineId, c.paraId, c.docTitle, c.domain, c.srcLang],
    [null, null, false, '', 'band', 3, '3:4', '3:p1', 'Book A', 'medical', 'en']);
  // 두 번 → 한 장(공백·NFKC 만 다른 앞면도 같은 카드)
  clock = T0 + 10;
  const b = await cards.saveSentence(input({ front: '  Fever  is common\nafter surgery. ' }));
  assert.equal(b.created, false);
  assert.equal(b.card.id, c.id);
  assert.equal(b.card.updatedAt, T0, '채울 것이 없으면 쓰지 않는다');
  // 대상 언어가 다르면 둘
  const k = await cards.saveSentence(input({ targetLang: 'ko' }));
  assert.equal(k.created, true);
  assert.notEqual(k.card.id, c.id);
  // 앞면만 저장 뒤 back 을 주면 채워진다 · explain 도. `[12-3 결정]` 자동 채움은 updatedAt 을 올리지 않는다(사람의 내용 수정만 — 9c 에서
  // 다른 기기의 손으로 쓴 뒷면을 덮지 않게). 전: updatedAt = T0 + 500.
  clock = T0 + 500;
  const f = await cards.saveSentence(input({ back: 'الحمى شائعة بعد الجراحة.', explain: 'شرح' }));
  assert.equal(f.created, false);
  assert.equal(f.card.back, 'الحمى شائعة بعد الجراحة.');
  assert.equal(f.card.explain, 'شرح');
  assert.equal(f.card.updatedAt, T0, '[12-3] 자동 채움 — updatedAt 그대로');
  assert.equal(f.card.createdAt, T0);
  // 이미 있는 back 은 덮지 않는다
  clock = T0 + 600;
  const g = await cards.saveSentence(input({ back: 'other' }));
  assert.equal(g.card.back, 'الحمى شائعة بعد الجراحة.');
  assert.equal(g.card.updatedAt, T0);
  // id 경계 — 앞면 "a b" + 문서 "c" 와 앞면 "a" + 문서 "b c" 는 다른 id(U+0001 은 공백으로 접히지 않는다)
  const x = await cards.saveSentence(input({ front: 'a b', docId: 'c' }));
  const y = await cards.saveSentence(input({ front: 'a', docId: 'b c' }));
  assert.equal(x.created && y.created, true);
  assert.notEqual(x.card.id, y.card.id);
  assert.notEqual(await C.sentenceIdOf('ar', 'c', 'a b'), await C.sentenceIdOf('ar', 'c a', 'b'));
  // 빈 입력
  assert.deepEqual(await cards.saveSentence(input({ front: '   ' })), { card: null, created: false });
  assert.deepEqual(await cards.saveSentence(input({ targetLang: '' })), { card: null, created: false });
  assert.deepEqual(await cards.saveSentence(input({ docId: '' })), { card: null, created: false });
  assert.equal((await cards.saveSentence(input({ front: 'Other.', origin: 'weird' }))).card.origin, null, '모르는 origin');
  // 동시에 두 번 → 한 장
  const [p1, p2] = await Promise.all([cards.saveSentence(input({ front: 'Twice.' })), cards.saveSentence(input({ front: 'Twice.' }))]);
  assert.equal([p1.created, p2.created].filter(Boolean).length, 1);
  assert.equal((await cards.list({ kind: 'sentence' })).filter((q) => q.front === 'Twice.').length, 1);
});

/* ══ C2 review ═══════════════════════════════════════════ */
test('C2 ★ review — 복습 필드만(updatedAt·내용 그대로) · introducedAt 처음만 · srs.log[오늘] n·ms·new · 60일 · 단어도', async () => {
  await reset();
  clock = T0;
  const c = (await cards.saveSentence(input({ back: 'ب' }))).card;
  await cards.update(c.id, { note: 'my note' });
  const before = await cards.get(c.id);
  const N1 = T0 + 3600000;
  const r1 = await cards.review(c.id, 'good', { nowMs: N1, dayStartMs: DS, ms: 4200 });
  assert.deepEqual(r1.sm2, { ease: 2.5, interval: 1, reps: 1, lapses: 0 });
  assert.equal(r1.dueAt, DS + DAY);
  assert.equal(r1.reviewedAt, N1);
  assert.equal(r1.introducedAt, N1);
  for (const k of ['updatedAt', 'createdAt', 'back', 'note', 'front', 'explain', 'docId', 'suspended', 'id', 'kind']) assert.deepEqual(r1[k], before[k], k + ' 그대로');
  assert.deepEqual(await C.dayKeyOf(DS), TODAY);
  assert.deepEqual((await cards.readLog())[TODAY], { n: 1, ms: 4200, new: 1 });
  // 두 번째 — 새 카드가 아니므로 new 그대로 · introducedAt 그대로 · ms 상한 60초
  const N2 = N1 + 60000;
  const r2 = await cards.review(c.id, 'again', { nowMs: N2, dayStartMs: DS, ms: 999999 });
  assert.equal(r2.introducedAt, N1);
  assert.equal(r2.dueAt, N2 + 600000);
  assert.equal(r2.sm2.lapses, 1);
  assert.equal(r2.updatedAt, before.updatedAt);
  assert.deepEqual((await cards.readLog())[TODAY], { n: 2, ms: 4200 + 60000, new: 1 });
  // 저장소 레코드도 같다
  assert.deepEqual(idb.peek('medreader', 'cards', c.id), r2);
  // 모르는 단추·없는 카드
  assert.equal(await cards.review(c.id, 'perfect', { nowMs: N2, dayStartMs: DS }), null);
  assert.equal(await cards.review('sc:none', 'good', { nowMs: N2, dayStartMs: DS }), null);
  // 단어 카드도 같은 규칙(8f 항목 — sm2 있음·dueAt 숫자)
  const t = (await vocab.save({ surface: 'Fever', srcLang: 'en', targetLang: 'ar', translation: 'حمى', docId: 'docA' })).entry;
  const rt = await cards.review(t.id, 'easy', { nowMs: N2, dayStartMs: DS, ms: 1000 });
  assert.deepEqual([rt.sm2.interval, rt.sm2.reps, rt.sm2.ease], [4, 1, 2.65]);
  assert.equal(rt.updatedAt, t.updatedAt, '단어도 updatedAt 그대로');
  assert.equal(rt.translation, 'حمى');
  assert.deepEqual((await cards.readLog())[TODAY], { n: 3, ms: 65200, new: 2 });
  // 60일 — 오래된 날은 빠지고, 59일 전은 남는다
  await db.put('settings', { key: 'srs.log', value: { '2026-01-01': { n: 9, ms: 9, new: 9 }, '2026-09-19': { n: 1, ms: 1, new: 0 }, '2026-09-20': { n: 2, ms: 2, new: 0 },
    [TODAY]: { n: 3, ms: 65200, new: 2 } } });
  await cards.review(c.id, 'good', { nowMs: N2 + 1, dayStartMs: DS, ms: 0 });
  assert.deepEqual(Object.keys(await cards.readLog()).sort(), ['2026-09-19', '2026-09-20', TODAY], '오늘 포함 60일(9-19 = 59일 전) — 9-18 이전 빠짐');
  assert.equal(C.trimLog({ '2026-09-18': {}, '2026-09-19': {}, junk: {} }, DS)['2026-09-18'], undefined);
  assert.deepEqual(Object.keys(C.trimLog({ '2026-09-18': {}, '2026-09-19': {}, junk: {} }, DS)), ['2026-09-19']);
});

/* ══ C3 queue ════════════════════════════════════════════ */
test('C3 ★ queue — due(dueAt 순) → fresh(createdAt 순) · 새 카드 상한이 srs.log 를 본다 · 멈춤·번역 빈 term 빠짐 · noBack · ISO dueAt', async () => {
  await reset();
  const reviewed = (id, dueAt, extra) => Object.assign({ id: id, kind: 'sentence', front: id, back: 'b', docId: 'docA', targetLang: 'ar',
    createdAt: T0 - 50 * DAY, updatedAt: T0 - 50 * DAY, reviewedAt: T0 - DAY, introducedAt: T0 - 9 * DAY,
    sm2: { ease: 2.5, interval: 3, reps: 2, lapses: 0 }, dueAt: dueAt, suspended: false }, extra || {});
  await db.put('cards', reviewed('sc:due2', T0 - 1000));
  await db.put('cards', reviewed('sc:due1', T0 - 2 * DAY));
  await db.put('cards', reviewed('sc:dueLate', DE - 1, { back: '' }));               // 오늘 밤 — due, 뒷면 빔
  await db.put('cards', reviewed('sc:tomorrow', DE));                                // 내일 0시 — 아님
  await db.put('cards', reviewed('sc:susp', T0 - 3 * DAY, { suspended: true }));
  await db.put('cards', reviewed('sc:docB', T0 - 1000, { docId: 'docB' }));
  // 8f 옛 값 모사 — ISO 문자열 dueAt
  await db.put('cards', Object.assign(reviewed('vt:iso-past', new Date(T0 - 3 * DAY).toISOString()), { kind: 'term', term: 'a', translation: 'أ' }));
  await db.put('cards', Object.assign(reviewed('vt:iso-future', new Date(DE + 2 * DAY).toISOString()), { kind: 'term', term: 'b', translation: 'ب' }));
  // 새 카드 25장(createdAt 순서를 뒤섞어 넣음) — 하나는 번역 빈 term, 하나는 뒷면 빈 문장
  for (let i = 24; i >= 0; i--) {
    const base = { id: 'n' + String(i).padStart(2, '0'), docId: 'docA', targetLang: 'ar', createdAt: T0 - 100 + i, updatedAt: T0 - 100 + i,
      reviewedAt: null, introducedAt: null, sm2: { ease: 2.5, interval: 0, reps: 0, lapses: 0 }, dueAt: T0 - 100 + i, suspended: false };
    if (i === 3) await db.put('cards', Object.assign(base, { kind: 'term', term: 'x', translation: '' }));
    else if (i === 0) await db.put('cards', Object.assign(base, { kind: 'sentence', front: 'f', back: '' }));
    else await db.put('cards', Object.assign(base, { kind: i % 2 ? 'term' : 'sentence', term: i % 2 ? 't' + i : undefined, translation: 'tr', front: 'f', back: 'b' }));
  }
  await db.put('cards', { id: 'legacy', docId: 'docA', front: 'kindless', dueAt: 0 });   // kind 없음 — 줄에 들어가지 않음
  const Q = { nowMs: T0, dayStartMs: DS, dayEndMs: DE, newPerDay: 20 };
  let q = await cards.queue(Q);
  // iso-past(T0−3일, ISO 문자열) < due1(T0−2일) < docB = due2(T0−1초 — 같으면 createdAt·키 순) < dueLate(오늘 밤)
  assert.deepEqual(q.due.map((c) => c.id), ['vt:iso-past', 'sc:due1', 'sc:docB', 'sc:due2', 'sc:dueLate'], 'dueAt 오름차순 · ISO 문자열도 숫자처럼');
  assert.deepEqual(q.fresh.map((c) => c.id), ['n00', 'n01', 'n02', 'n04', 'n05', 'n06', 'n07', 'n08', 'n09', 'n10', 'n11', 'n12', 'n13', 'n14', 'n15', 'n16', 'n17', 'n18', 'n19', 'n20'],
    'createdAt 오름차순 · 번역 빈 term(n03) 빠짐 · 20장');
  assert.deepEqual(q.counts, { due: 5, fresh: 20, noBack: 2, noTr: 1 });
  // 오늘 이미 새 카드 18장 → 2장만
  await db.put('settings', { key: 'srs.log', value: { [TODAY]: { n: 30, ms: 1000, new: 18 }, '2026-11-16': { n: 1, ms: 1, new: 20 } } });
  q = await cards.queue(Q);
  assert.deepEqual(q.fresh.map((c) => c.id), ['n00', 'n01']);
  assert.equal(q.counts.fresh, 2);
  assert.equal(q.counts.due, 5, '복습할 것은 상한 없음');
  // 다음 날 — 새 카드 셈이 0 부터 · 내일 due 가 나타남 · ISO 미래는 아직
  q = await cards.queue({ nowMs: DE + 3600000, dayStartMs: DE, dayEndMs: DE + DAY, newPerDay: 20 });
  assert.equal(q.counts.fresh, 20);
  assert.ok(q.due.some((c) => c.id === 'sc:tomorrow'));
  assert.ok(!q.due.some((c) => c.id === 'vt:iso-future'));
  // 거르기 — kinds · docId · 상한 자르기(0–100)
  q = await cards.queue(Object.assign({}, Q, { kinds: ['term'] }));
  assert.ok(q.due.concat(q.fresh).every((c) => c.kind === 'term'));
  q = await cards.queue(Object.assign({}, Q, { docId: 'docB' }));
  assert.deepEqual(q.due.map((c) => c.id), ['sc:docB']);
  assert.equal((await cards.queue(Object.assign({}, Q, { newPerDay: -5 }))).counts.fresh, 0);
  await db.put('settings', { key: 'srs.log', value: {} });
  assert.equal((await cards.queue(Object.assign({}, Q, { newPerDay: 500 }))).counts.fresh, 24, '상한 100 · 새 카드 24장 전부(25 − 번역 빈 단어 1)');
  assert.equal((await cards.queue(Object.assign({}, Q, { newPerDay: 'x' }))).counts.fresh, 20, '못 읽으면 기본 20');
  assert.equal(C.clampNewPerDay(7.9), 7);
  // `[12-1b — 12-1R #3]` null·빈 글자는 "못 읽음" → 기본 20(`Number(null)` = 0 이 새 카드 0 을 만들지 않게) · 0 은 0
  for (const v of [null, undefined, '', '   ', 'x', NaN]) assert.equal(C.clampNewPerDay(v), SRS.NEW_PER_DAY, JSON.stringify(v) + ' → 기본');
  assert.equal(C.clampNewPerDay(0), 0);
  assert.equal(C.clampNewPerDay('5'), 5);
  assert.equal((await cards.queue(Object.assign({}, Q, { newPerDay: null }))).counts.fresh, 20, 'null → 기본 20');
});

/* ══ C4 fillBack ═════════════════════════════════════════ */
test('C4 ★ fillBack — 주입 조회로 채움·저장([12-3] updatedAt 그대로) / 못 찾으면 그대로 · 이미 있으면 조회 안 함 · 조회 밖 호출 0', async () => {
  await reset();
  clock = T0;
  const c = (await cards.saveSentence(input())).card;
  const seen = [];
  const lookupNone = async (front, docId, tl) => { seen.push([front, docId, tl]); return ''; };
  const f0 = await cards.fillBack(c, lookupNone);
  assert.equal(f0.back, '');
  assert.equal((await cards.get(c.id)).updatedAt, T0, '못 찾으면 쓰지 않는다');
  assert.deepEqual(seen, [['Fever is common after surgery.', 'docA', 'ar']]);
  const mem = new Map([['Fever is common after surgery.', 'الحمى شائعة.']]);
  clock = T0 + 77;
  const f1 = await cards.fillBack(c, async (front) => mem.get(front) || null);
  assert.equal(f1.back, 'الحمى شائعة.');
  assert.equal(f1.updatedAt, T0, '[12-3 결정] 자동 채움 — updatedAt 그대로(전: T0 + 77)');
  assert.equal((await cards.get(c.id)).back, 'الحمى شائعة.', '저장됨');
  let called = 0;
  const f2 = await cards.fillBack(f1, async () => { called++; return 'x'; });
  assert.equal(called, 0, '뒷면이 있으면 조회하지 않는다');
  assert.equal(f2.back, 'الحمى شائعة.');
  assert.equal((await cards.fillBack(c, async () => { throw new Error('boom'); })).back, '', '조회 실패 → 그대로');
  assert.equal(await cards.fillBack(null, lookupNone), null);
  assert.equal(fetchCalls, 0, '★ 카드 서비스 전체에서 원격 요청 0');
});

/* ══ C5 연쇄 삭제 ════════════════════════════════════════ */
test('C5 ★ deleteDocument — 그 문서의 term·sentence 카드 남음 · kind 없는 가짜 레코드 지워짐 · keptCount', async () => {
  await reset();
  clock = T0;
  await db.put('documents', { id: 'docZ', title: 'Z', fileHash: 'hz' });
  const s1 = (await cards.saveSentence(input({ docId: 'docZ', front: 'One.' }))).card;
  const s2 = (await cards.saveSentence(input({ docId: 'docZ', front: 'Two.' }))).card;
  await cards.saveSentence(input({ docId: 'docY', front: 'Other book.' }));
  const t = (await vocab.save({ surface: 'Gout', targetLang: 'ar', docId: 'docZ', docTitle: 'Z' })).entry;
  await db.put('cards', { id: 'old:1', docId: 'docZ', front: 'kindless' });
  await db.put('aiCache', { key: 'translate|ar|docZ|h', kind: 'translate', docId: 'docZ', createdAt: 1 });
  assert.equal(await cards.keptCount('docZ'), 2);
  const r = await db.deleteDocument('docZ');
  assert.equal(r.cards, 1, 'kind 없는 것만 지움');
  for (const id of [s1.id, s2.id, t.id]) assert.ok(idb.peek('medreader', 'cards', id), id + ' 남음');
  assert.equal(idb.peek('medreader', 'cards', 'old:1'), undefined);
  assert.equal(idb.peek('medreader', 'aiCache', 'translate|ar|docZ|h'), undefined, '캐시는 지운다');
  assert.equal(await cards.keptCount('docZ'), 2, '지운 뒤에도 센다(docTitle 사본)');
  assert.equal(await cards.keptCount('docY'), 1);
  assert.equal(db.keepsOnDocDelete({ kind: 'sentence' }), true);
  assert.equal(db.keepsOnDocDelete({ kind: 'sentence' }, 'aiCache'), false);
  assert.equal(db.keepsOnDocDelete({}), false);
  assert.equal(db.DB_VERSION, 3);
});

/* ══ C6 9c 병합 ══════════════════════════════════════════ */
test('C6 ★ 9c 병합(순수) — 내용은 updatedAt · 복습 상태는 reviewedAt · 멈춤은 suspendedAt 늦은 쪽(같으면 기기) · 단어 멈춤도', async () => {
  await reset();
  clock = T0;
  const base = (await cards.saveSentence(input({ back: 'old' }))).card;
  // 기기: 늦게 복습함 · 파일: 뒷면만 고침(updatedAt 늦음), 복습은 옛것
  const mine = await cards.review(base.id, 'good', { nowMs: T0 + 9 * 3600000, dayStartMs: DS });
  const theirs = Object.assign({}, base, { back: 'new', note: 'n', updatedAt: T0 + 3600000, reviewedAt: T0 + 1000, sm2: { ease: 2.35, interval: 1, reps: 1, lapses: 0 }, dueAt: 5 });
  const r = B.mergeRecord('cards', mine, theirs, { nowMs: T0 + DAY });
  assert.deepEqual(r, { op: 'patch', patch: { back: 'new', note: 'n', updatedAt: T0 + 3600000 } }, '내용은 파일 · 복습 상태는 기기(더 늦게 복습)');
  const merged = Object.assign({}, mine, r.patch);
  assert.deepEqual(B.mergeRecord('cards', merged, theirs, { nowMs: T0 + DAY }), { op: 'keep' }, '두 번째 = keep(멱등)');
  // 파일 복습이 더 늦다 — 복습 상태만 파일
  const later = Object.assign({}, base, { reviewedAt: T0 + 20 * 3600000, sm2: { ease: 2.65, interval: 4, reps: 1, lapses: 0 }, dueAt: DS + 4 * DAY, introducedAt: T0 + 20 * 3600000 });
  assert.deepEqual(B.mergeRecord('cards', mine, later, {}), { op: 'patch', patch: { sm2: later.sm2, dueAt: later.dueAt, reviewedAt: later.reviewedAt, introducedAt: later.introducedAt } });
  // 멈춤 — 기기에서 멈춤(suspendedAt) → 파일(멈춤 없음, 옛것)은 지지 않게 · 파일이 더 늦게 다시 켰으면 파일
  clock = T0 + 30 * 3600000;
  const susp = await cards.update(base.id, { suspended: true });
  assert.equal(susp.suspended, true);
  assert.equal(susp.suspendedAt, T0 + 30 * 3600000);
  assert.equal(susp.updatedAt, mine.updatedAt, '멈춤은 내용이 아니다 — updatedAt 그대로');
  assert.deepEqual(B.mergeRecord('cards', susp, Object.assign({}, base, { suspended: false })), { op: 'keep' }, '파일에 멈춤 시각 없음 → 기기');
  assert.deepEqual(B.mergeRecord('cards', susp, Object.assign({}, base, { suspended: false, suspendedAt: T0 + 31 * 3600000 })),
    { op: 'patch', patch: { suspended: false, suspendedAt: T0 + 31 * 3600000 } });
  // `[12-1b — 12-1R #5]` 파일이 내용만 늦고(멈춤 시각 없음·suspended:false) — 내용은 파일, 멈춤은 내용 묶음에 섞이지 않고 기기
  assert.deepEqual(B.mergeRecord('cards', susp, Object.assign({}, base, { back: 'later', updatedAt: T0 + 50 * 3600000, suspended: false })),
    { op: 'patch', patch: { back: 'later', updatedAt: T0 + 50 * 3600000 } }, '내용 묶음이 멈춤 필드를 가져가지 않는다');
  // 단어 — 멈춤도 suspendedAt 늦은 쪽(내용·복습과 따로)
  const t = (await vocab.save({ surface: 'Edema', targetLang: 'ar', translation: 'وذمة', docId: 'docA' })).entry;
  clock = T0 + 40 * 3600000;
  const ts = await cards.update(t.id, { suspended: true, back: 'ignored', translation: 'ignored' });
  assert.deepEqual([ts.suspended, ts.suspendedAt, ts.updatedAt, ts.translation, ts.back], [true, T0 + 40 * 3600000, t.updatedAt, 'وذمة', undefined], '단어는 멈춤만');
  assert.deepEqual(B.mergeRecord('cards', ts, t, { nowMs: T0 + DAY * 2 }), { op: 'keep' }, '파일(멈춤 전) → 기기 그대로');
  assert.deepEqual(B.mergeRecord('cards', t, ts, { nowMs: T0 + DAY * 2 }), { op: 'patch', patch: { suspended: true, suspendedAt: T0 + 40 * 3600000 } }, '파일이 늦게 멈춤 → 멈춤만');
  // 8f 단어장 store.update 의 멈춤도 suspendedAt
  clock = T0 + 41 * 3600000;
  const vs = await vocab.update(t.id, { suspended: false });
  assert.deepEqual([vs.suspended, vs.suspendedAt, vs.updatedAt], [false, T0 + 41 * 3600000, t.updatedAt]);
});

test('C6b ★ 9c 종단 — 기기 B(더 늦은 복습·빈 뒷면) 에 기기 A 파일(뒷면 고침) 가져오기 → 뒷면은 A · 복습 상태는 B · srs.log 날짜별 큰 값 · 두 번 = 한 번', async () => {
  await reset();
  // 기기 A — 저장·복습 1번·뒤에 뒷면 고침
  clock = T0;
  const id = (await cards.saveSentence(input())).card.id;
  await cards.review(id, 'good', { nowMs: T0 + 3600000, dayStartMs: DS, ms: 3000 });
  clock = T0 + 5 * 3600000;
  await cards.update(id, { back: 'A-back' });
  await db.put('settings', { key: 'srs.log', value: { '2026-11-10': { n: 5, ms: 50, new: 2 }, [TODAY]: { n: 1, ms: 3000, new: 1 } } });
  await db.put('settings', { key: 'srs.newPerDay', value: 15 });
  const ex = await exportBackup({ now: T0 + 6 * 3600000, gzip: false });
  const file = new File([ex.blob], ex.name);
  // 기기 B — 같은 카드, 두 번 복습(더 늦게), 뒷면 없음, 다른 날 기록
  await reset();
  clock = T0;
  await cards.saveSentence(input());
  await cards.review(id, 'good', { nowMs: T0 + 3600000, dayStartMs: DS, ms: 1000 });
  await cards.review(id, 'good', { nowMs: DE + 3600000, dayStartMs: DE, ms: 2000 });
  const b = await cards.get(id);
  await db.put('settings', { key: 'srs.log', value: Object.assign({ '2026-11-12': { n: 7, ms: 70, new: 3 } }, await cards.readLog()) });
  const r1 = await IM.importBackup(file, { now: DE + 7200000, defaults: DEFAULTS });
  assert.equal(r1.ok, true);
  const c = await cards.get(id);
  assert.equal(c.back, 'A-back', '내용은 늦은 쪽(A)');
  assert.equal(c.updatedAt, T0 + 5 * 3600000);
  assert.deepEqual([c.sm2, c.dueAt, c.reviewedAt, c.introducedAt], [b.sm2, b.dueAt, b.reviewedAt, b.introducedAt], '복습 상태는 늦은 쪽(B)');
  assert.equal(c.sm2.reps, 2);
  const log = await cards.readLog();
  assert.deepEqual(log['2026-11-10'], { n: 5, ms: 50, new: 2 }, 'A 에만 있던 날');
  assert.deepEqual(log['2026-11-12'], { n: 7, ms: 70, new: 3 }, 'B 에만 있던 날');
  assert.deepEqual(log[TODAY], { n: 1, ms: 3000, new: 1 }, '같은 날은 칸마다 큰 값');
  assert.deepEqual(log['2026-11-18'], { n: 1, ms: 2000, new: 0 });
  assert.equal((await db.get('settings', 'srs.newPerDay')).value, 15, 'srs.newPerDay 담음 — 파일 값');
  const snap = async () => JSON.stringify([await db.get('cards', id), await db.get('settings', 'srs.log'), await db.get('settings', 'srs.newPerDay')]);
  const s1 = await snap();
  const r2 = await IM.importBackup(file, { now: DE + 9000000, defaults: DEFAULTS });
  assert.equal(r2.ok, true);
  assert.equal(await snap(), s1, '같은 파일 두 번 = 한 번');
  assert.equal(fetchCalls, 0);
});

/* ══ C7 8f 와 함께 ═══════════════════════════════════════ */
test('C7 ★ 8f — CSV 가져오기로 번역을 고쳐도 sm2·dueAt·reviewedAt·introducedAt 그대로 · changedSince 가 복습·멈춤 뒤 늘지 않음', async () => {
  await reset();
  clock = T0;
  const t = (await vocab.save({ surface: 'Dyspnea', srcLang: 'en', targetLang: 'ar', translation: 'ضيق', docId: 'docA', context: 'Dyspnea at rest.' })).entry;
  await vocab.save({ surface: 'Cough', srcLang: 'en', targetLang: 'ar', translation: 'سعال', docId: 'docA' });
  const lastExport = T0 + 10;
  assert.equal((await vocab.changedSince(lastExport)).length, 0);
  // 복습·멈춤 — 바뀐 항목이 늘지 않는다
  const rv = await cards.review(t.id, 'good', { nowMs: T0 + 3600000, dayStartMs: DS, ms: 500 });
  await cards.review(t.id, 'easy', { nowMs: DE + 3600000, dayStartMs: DE, ms: 500 });
  clock = T0 + 2 * DAY;
  await cards.update(t.id, { suspended: true });
  await cards.update(t.id, { suspended: false });
  assert.equal((await vocab.changedSince(lastExport)).length, 0, '★ 복습·멈춤은 "바뀐 항목"이 아니다');
  const reviewedRec = await vocab.findTerm('dyspnea', 'ar');
  assert.equal(reviewedRec.sm2.reps, 2);
  assert.ok(rv.reviewedAt);
  // CSV 로 번역을 고쳐 가져오기
  clock = T0 + 3 * DAY;
  const csv = V.buildCsv([Object.assign({}, reviewedRec, { translation: 'ضيق النفس' })]);
  const plan = V.importPlan(V.parseCsv(csv).rows, await vocab.list(), { nowMs: clock });
  assert.equal(plan.change.length, 1);
  const res = await vocab.applyImport(V.planToApply(plan, null));
  assert.equal(res.changed, 1);
  const after = await vocab.findTerm('dyspnea', 'ar');
  assert.equal(after.translation, 'ضيق النفس');
  for (const k of ['sm2', 'dueAt', 'reviewedAt', 'introducedAt', 'suspended', 'suspendedAt']) assert.deepEqual(after[k], reviewedRec[k], k + ' 그대로(12-D18)');
  assert.equal((await vocab.changedSince(lastExport)).length, 1, '번역 고침만 "바뀐 항목"');
});

/* ══ C8 removeIfFresh·remove·update·list ══════════════════ */
test('C8 removeIfFresh(복습 전만) · remove(문장만) · update(뒷면·메모 → updatedAt, 같으면 그대로) · list(kind·docId·createdAt 순)', async () => {
  await reset();
  clock = T0;
  const a = (await cards.saveSentence(input({ front: 'A.' }))).card;
  clock = T0 + 1;
  const b = (await cards.saveSentence(input({ front: 'B.', docId: 'docB' }))).card;
  const t = (await vocab.save({ surface: 'Rash', targetLang: 'ar', docId: 'docA' })).entry;
  assert.equal(await cards.removeIfFresh(a.id), true, '복습 전 → 지움');
  assert.equal(await cards.get(a.id), null);
  await cards.review(b.id, 'hard', { nowMs: T0 + 5, dayStartMs: DS });
  assert.equal(await cards.removeIfFresh(b.id), false, '복습한 카드는 지우지 않는다');
  assert.ok(await cards.get(b.id));
  assert.equal(await cards.removeIfFresh(t.id), false, '단어는 지우지 않는다');
  assert.equal(await cards.remove(t.id), false, '단어는 단어장이 지운다');
  assert.ok(await cards.get(t.id));
  clock = T0 + 100;
  const u = await cards.update(b.id, { back: '  ترجمة  ', note: 'm', front: 'hack', sm2: null, dueAt: 0, updatedAt: 1 });
  assert.deepEqual([u.back, u.note, u.front, u.updatedAt, u.sm2.reps], ['ترجمة', 'm', 'B.', T0 + 100, 1]);
  clock = T0 + 200;
  assert.equal((await cards.update(b.id, { back: 'ترجمة', note: 'm' })).updatedAt, T0 + 100, '바뀐 것이 없으면 그대로');
  assert.equal(await cards.update('nope', { back: 'x' }), null);
  const c = (await cards.saveSentence(input({ front: 'C.' }))).card;
  assert.deepEqual((await cards.list()).map((x) => x.id), [b.id, t.id, c.id], 'createdAt 순');
  assert.deepEqual((await cards.list({ kind: 'sentence' })).map((x) => x.id), [b.id, c.id]);
  assert.deepEqual((await cards.list({ kind: 'term' })).map((x) => x.id), [t.id]);
  assert.deepEqual((await cards.list({ docId: 'docB' })).map((x) => x.id), [b.id]);
  assert.equal(await cards.remove(b.id), true);
  assert.equal(await cards.get(b.id), null);
  assert.ok(Number.isNaN(C.dueMsOf({ dueAt: 'junk' })));
  assert.equal(C.dueMsOf({ dueAt: '1763370000000' }), 1763370000000);
  assert.equal(C.dueMsOf({ dueAt: new Date(T0).toISOString() }), T0);
});

/* ══ C9 정적·설정 ════════════════════════════════════════ */
test('C9 ★ 정적 — srs/cards.js import 는 config·db·hash·./sm2 만 · 설정 키·허용 목록 · srs.log 합치기(순수) · 버전 불변', async () => {
  const code = src('../js/srs/cards.js');
  const imports = (code.match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || []).map((s) => s.replace(/^[\s\S]*from\s*/, '').replace(/['"]/g, '')).sort();
  assert.deepEqual(imports, ['../config.js', '../db.js', '../hash.js', './sm2.js']);
  assert.ok(!/\b(innerHTML|document|window)\b/.test(code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')), 'DOM 0');
  assert.equal(DEFAULTS['srs.newPerDay'], SRS.NEW_PER_DAY);
  assert.deepEqual(DEFAULTS['srs.log'], {});
  assert.ok(BACKUP.SETTINGS_KEYS.includes('srs.newPerDay') && BACKUP.SETTINGS_KEYS.includes('srs.log'));
  assert.ok(B.settingAllowed('srs.newPerDay') && B.settingAllowed('srs.log'));
  assert.equal(IM.settingTypeOk('srs.log', { [TODAY]: { n: 1 } }, DEFAULTS), true);
  assert.equal(IM.settingTypeOk('srs.log', [1], DEFAULTS), false);
  assert.equal(IM.settingTypeOk('srs.newPerDay', '20', DEFAULTS), false);
  const mine = { '2026-11-01': { n: 2, ms: 10, new: 1 }, '2026-11-02': { n: 1, ms: 5, new: 0 } };
  const theirs = { '2026-11-02': { n: 3, ms: 1, new: 1 }, '2026-11-03': { n: 1, ms: 1, new: 1 }, bad: { n: 9 } };
  const u = IM.unionSetting('srs.log', mine, theirs);
  assert.deepEqual(u, { '2026-11-01': { n: 2, ms: 10, new: 1 }, '2026-11-02': { n: 3, ms: 5, new: 1 }, '2026-11-03': { n: 1, ms: 1, new: 1 } });
  assert.deepEqual(IM.unionSetting('srs.log', u, theirs), u, '두 번 = 한 번');
  assert.deepEqual(IM.unionSetting('srs.log', null, theirs), theirs);
  const many = {};
  for (let i = 0; i < 70; i++) many['2026-' + String(1 + Math.floor(i / 28)).padStart(2, '0') + '-' + String(1 + (i % 28)).padStart(2, '0')] = { n: 1, ms: 1, new: 0 };
  assert.equal(Object.keys(IM.unionSetting('srs.log', many, {})).length, SRS.LOG_DAYS, '최근 60일만');
  assert.equal(db.DB_VERSION, 3);
  assert.equal(typeof S.next, 'function');
});

/* ══ C10 `[12-1b — 12-1R #2]` id 의 책 칸 = 문서 fileHash 바탕 ═══════════ */
const docRec = (id, fileHash, o) => Object.assign({ id: id, title: 'Book ' + id, fileName: 'same.pdf', size: 1234, pageCount: 40, fileHash: fileHash,
  addedAt: T0, lastOpenedAt: T0, lastPage: 1, lang: 'en', langSource: 'auto' }, o || {});

test('C10 ★ 문장 카드 id = fileHash 바탕(변형 꼬리 뗌) · 같은 PDF 의 두 문서 → 한 장(docId·docTitle 은 지금 문서로, 내용·복습 그대로) · fileHash 없으면 docId', async () => {
  await reset();
  // 순수 — 책 칸
  assert.equal(C.sentenceDocKey('s256:p:1:abc:n40', 'd1'), 's256:p:1:abc', '쪽수 변형 꼬리 뗌');
  assert.equal(C.sentenceDocKey('s256:p:1:abc', 'd1'), 's256:p:1:abc');
  assert.equal(C.sentenceDocKey('', 'd1'), 'd1', 'fileHash 없음 → docId');
  assert.equal(C.sentenceDocKey(undefined, 'd1'), 'd1');
  assert.equal(C.sentenceDocKey(':n40', 'd1'), 'd1', '꼬리뿐이면 docId');
  // id 경계 그대로(책 칸이 해시여도) — 앞면 "a b" + 책 "c" ≠ 앞면 "a" + 책 "b c"
  assert.notEqual(await C.sentenceIdOf('ar', 'c', 'a b'), await C.sentenceIdOf('ar', 'b c', 'a'));
  // 같은 PDF 를 두 번 가져온 두 문서(한쪽은 쪽수 변형 키) — 같은 문장은 한 장
  await db.put('documents', docRec('d1', 's256:p:1:abc'));
  await db.put('documents', docRec('d2', 's256:p:1:abc:n40', { title: 'Book d2' }));
  clock = T0;
  const a = await cards.saveSentence(input({ docId: 'd1', docTitle: 'Book d1', back: 'ب' }));
  assert.equal(a.created, true);
  assert.equal(a.card.id, await C.sentenceIdOf('ar', 's256:p:1:abc', input().front), 'id 는 fileHash 바탕');
  assert.notEqual(a.card.id, await C.sentenceIdOf('ar', 'd1', input().front), 'docId 가 아니다');
  assert.equal(await cards.idFor(input({ docId: 'd1' })), a.card.id, 'idFor = saveSentence 의 id');
  assert.equal(await cards.idFor(input({ docId: 'd2' })), a.card.id, '다른 문서 같은 PDF → 같은 id');
  assert.equal(await cards.idFor(input({ front: ' ' })), null);
  const rv = await cards.review(a.card.id, 'good', { nowMs: T0 + 1000, dayStartMs: DS });
  clock = T0 + 5000;
  const b = await cards.saveSentence(input({ docId: 'd2', docTitle: 'Book d2', back: 'other' }));
  assert.equal(b.created, false, '★ 한 장');
  assert.equal(b.card.id, a.card.id);
  assert.deepEqual([b.card.docId, b.card.docTitle], ['d2', 'Book d2'], 'docId·docTitle 은 지금 문서로');
  for (const k of ['back', 'front', 'note', 'createdAt', 'updatedAt', 'sm2', 'dueAt', 'reviewedAt', 'introducedAt', 'suspended', 'pageNo', 'lineId'])
    assert.deepEqual(b.card[k], rv[k], k + ' 그대로');
  assert.deepEqual(await cards.get(a.card.id), b.card, '저장됨');
  assert.equal((await cards.list({ kind: 'sentence' })).length, 1);
  // docId 필드로 거르는 함수들 — 지금 문서 쪽에 잡힌다
  assert.equal(await cards.keptCount('d2'), 1);
  assert.equal(await cards.keptCount('d1'), 0);
  assert.deepEqual((await cards.list({ docId: 'd2' })).map((x) => x.id), [a.card.id]);
  assert.deepEqual((await cards.queue({ nowMs: DE + 3600000, dayStartMs: DE, dayEndMs: DE + DAY, docId: 'd2' })).due.map((x) => x.id), [a.card.id]);
  // 같은 문서에서 다시 → 쓰지 않음(같은 객체 값)
  clock = T0 + 6000;
  assert.deepEqual((await cards.saveSentence(input({ docId: 'd2', docTitle: 'Book d2' }))).card, b.card);
  // 옮기면서 빈 뒷면을 채운다 — `[12-3 결정]` 채움도 updatedAt 그대로(전: 그때만 T0 + 7000)
  const e = (await cards.saveSentence(input({ docId: 'd1', front: 'Empty back.' }))).card;
  clock = T0 + 7000;
  const e2 = (await cards.saveSentence(input({ docId: 'd2', front: 'Empty back.', back: 'ف' }))).card;
  assert.deepEqual([e2.id, e2.docId, e2.back, e2.updatedAt], [e.id, 'd2', 'ف', e.updatedAt]);
  // 같은 기기 — 문서를 지우고 같은 PDF 를 다시 가져옴(새 docId) → 남은 카드를 만남(한 장, docId 새 문서)
  await db.deleteDocument('d2');
  await db.deleteDocument('d1');
  assert.equal((await cards.list({ kind: 'sentence' })).length, 2, '문서를 지워도 남는다(12-D8)');
  await db.put('documents', docRec('d3', 's256:p:1:abc'));
  clock = T0 + 9000;
  const c = await cards.saveSentence(input({ docId: 'd3', docTitle: 'Book d3' }));
  assert.deepEqual([c.created, c.card.id, c.card.docId, c.card.docTitle, c.card.reviewedAt], [false, a.card.id, 'd3', 'Book d3', rv.reviewedAt]);
  assert.equal((await cards.list({ kind: 'sentence' })).length, 2, '새 카드 0');
  // fileHash 없는 문서(옛·특이) → docId 로 물러섬(두 문서면 두 장 — 9c 도 이런 문서는 맞추지 못한다)
  await db.put('documents', { id: 'n1', title: 'N1' });
  const n1 = await cards.saveSentence(input({ docId: 'n1', front: 'No hash.' }));
  assert.equal(n1.card.id, await C.sentenceIdOf('ar', 'n1', 'No hash.'));
  assert.equal(await cards.idFor(input({ docId: 'n1', front: 'No hash.' })), n1.card.id);
  const n2 = await cards.saveSentence(input({ docId: 'n2', front: 'No hash.' }));
  assert.equal(n2.created, true, '문서 레코드가 없으면 docId — 다른 문서는 다른 카드');
  assert.equal(fetchCalls, 0);
});

test('C10b ★ 9c — 두 기기가 같은 PDF 를 따로 가져옴(문서 id 다름·한쪽은 변형 키) → 병합 뒤 카드 한 장(docId 는 기기 문서) · remapRecord 는 docId 만 · 두 번 = 한 번', async () => {
  // remapRecord — 문장 카드는 docId 만 바뀌고 id 는 그대로
  const rr = B.remapRecord('cards', { id: 'sc:x', kind: 'sentence', docId: 'devA' }, { devA: 'devB' });
  assert.deepEqual(rr, { id: 'sc:x', kind: 'sentence', docId: 'devB' });
  // 기기 A — 같은 PDF(문서 devA), 카드 저장·복습·뒷면
  await reset();
  await db.put('documents', docRec('devA', 's256:p:1:same', { title: 'Book' }));
  clock = T0;
  const idA = (await cards.saveSentence(input({ docId: 'devA', docTitle: 'Book', back: 'A-back' }))).card.id;
  await cards.review(idA, 'easy', { nowMs: T0 + 3600000, dayStartMs: DS, ms: 1000 });
  const ex = await exportBackup({ now: T0 + 2 * 3600000, gzip: false });
  const file = new File([ex.blob], ex.name);
  for (const variant of [false, true]) {
    // 기기 B — 같은 PDF 를 따로 가져옴(문서 devB). variant: B 에는 표본 해시가 겹친 다른 PDF 가 먼저 있어 이 책이 쪽수 변형 키
    await reset();
    if (variant) await db.put('documents', docRec('other', 's256:p:1:same', { pageCount: 99, title: 'Other' }));
    await db.put('documents', docRec('devB', variant ? 's256:p:1:same:n40' : 's256:p:1:same', { title: 'Book (B)' }));
    clock = T0 + 10;
    const mineB = (await cards.saveSentence(input({ docId: 'devB', docTitle: 'Book (B)' }))).card;
    assert.equal(mineB.id, idA, '★ 같은 문장 = 같은 id(기기마다 다른 docId 와 무관)');
    await cards.review(idA, 'good', { nowMs: DE + 3600000, dayStartMs: DE, ms: 500 });
    const r = await IM.importBackup(file, { now: DE + 7200000, defaults: DEFAULTS });
    assert.equal(r.ok, true);
    assert.deepEqual(r.remap, { devA: 'devB' }, variant ? '변형 키 문서로 맞춤' : '같은 fileHash 문서로 맞춤');
    const sent = (await cards.list({ kind: 'sentence' }));
    assert.equal(sent.length, 1, '★ 카드 한 장' + (variant ? '(변형)' : ''));
    const got = sent[0];
    assert.equal(got.docId, 'devB', 'docId 는 이 기기 문서');
    // `[12-1c]` 둘 다 만들기만 한 카드 → 내용 묶음은 늦게 만든 B. 다만 B 의 빈 뒷면은 A 의 뒷면을 지우지 못하고 빈 칸이 채워진다(①).
    assert.equal(got.back, 'A-back', '빈 뒷면(B)은 채워짐 — 12-1c ①(전에는 "" — 내용 묶음 통째)');
    assert.equal(got.docTitle, 'Book (B)', '나머지 내용은 늦은 쪽(B) 그대로');
    assert.equal(got.reviewedAt, DE + 3600000, '복습 상태는 늦은 쪽(B)');
    assert.equal(await cards.keptCount('devB'), 1);
    assert.equal(await cards.idFor(input({ docId: 'devB' })), idA, '가져온 카드를 이 기기에서 id 로 다시 찾는다');
    const snap = async () => JSON.stringify(await cards.list());
    const s1 = await snap();
    const r2 = await IM.importBackup(file, { now: DE + 9000000, defaults: DEFAULTS });
    assert.equal(r2.ok, true);
    assert.equal(await snap(), s1, '같은 파일 두 번 = 한 번');
  }
  assert.equal(fetchCalls, 0);
});

/* ══ C11 [12-1c] 합쳐진 문장 카드의 내용 묶음 ═══════════════ */
test('C11 ★ [12-1c] 9c 내용 묶음(순수) — ② 안 고친 카드는 고친 카드를 이기지 못함 · ① 빈 글자는 비지 않은 값을 지우지 않음(필드별) · 둘 다 고치면 늦은 쪽 · 멱등', () => {
  const H = 3600000;
  const card = (o) => Object.assign({ id: 'sc:x', kind: 'sentence', front: 'Fever is common.', back: '', explain: '', note: '', srcLang: 'en', targetLang: 'ar',
    docId: 'dev', docTitle: 'Book', pageNo: 3, createdAt: T0, updatedAt: T0, reviewedAt: null, introducedAt: null,
    sm2: { ease: 2.5, interval: 0, reps: 0, lapses: 0 }, dueAt: T0, suspended: false }, o);
  const apply = (mine, r) => (r.op === 'patch' ? Object.assign({}, mine, r.patch) : mine);
  // 같은 레코드끼리 두 번째 병합 = keep 인지
  const twice = (mine, theirs, msg) => {
    const r = B.mergeRecord('cards', mine, theirs, {});
    const merged = apply(mine, r);
    assert.deepEqual(B.mergeRecord('cards', merged, theirs, {}), { op: 'keep' }, '두 번 = 한 번 — ' + msg);
    return { r: r, merged: merged };
  };
  // V5 꼴 — A: 만든 뒤 뒷면·메모 고침(updatedAt > createdAt). B: 다음 날 만들기만(빈 뒷면·메모, updatedAt = createdAt)
  const A = card({ back: 'A-back', note: 'A-note', updatedAt: T0 + H });
  const Bc = card({ createdAt: T0 + DAY, updatedAt: T0 + DAY, dueAt: T0 + DAY, docTitle: 'Book (B)' });
  const ab = twice(A, Bc, 'A←B');
  assert.deepEqual(ab.r, { op: 'keep' }, '★ A←B: 늦게 만들기만 한 B 는 고친 A 를 이기지 못함(뒷면·메모·시각 그대로)');
  const ba = twice(Bc, A, 'B←A');
  assert.deepEqual(ba.r, { op: 'patch', patch: { back: 'A-back', note: 'A-note', docTitle: 'Book', createdAt: T0, updatedAt: T0 + H } },
    '★ B←A: 고친 A 의 내용이 이김(updatedAt 이 더 이르더라도)');
  assert.deepEqual(B.mergeRecord('cards', ba.merged, Bc, {}), { op: 'keep' }, 'B←A 뒤 다시 B 의 옛 파일 → 그대로');
  // ② 는 빈 값만이 아니다 — B 가 만들 때 다른 뒷면(자동 번역)을 넣었어도 A 가 고친 뒷면을 이기지 못함
  const Bauto = card({ back: 'B-auto', createdAt: T0 + DAY, updatedAt: T0 + DAY });
  assert.deepEqual(B.mergeRecord('cards', A, Bauto, {}), { op: 'keep' }, '② A←B(자동 뒷면)');
  assert.equal(twice(Bauto, A, 'B(자동)←A').merged.back, 'A-back', '② B←A');
  // 둘 다 고침 → 늦은 쪽(지금 규칙) — 양방향
  const A2 = card({ back: 'A1', note: 'An', updatedAt: T0 + H });
  const B2 = card({ back: 'B1', note: 'Bn', updatedAt: T0 + 2 * H });
  assert.deepEqual(twice(A2, B2, 'A2←B2').r, { op: 'patch', patch: { back: 'B1', note: 'Bn', updatedAt: T0 + 2 * H } }, '둘 다 고침 — 늦은 B');
  assert.deepEqual(B.mergeRecord('cards', B2, A2, {}), { op: 'keep' }, '둘 다 고침 — 기기(B)가 늦음');
  // 둘 다 만들기만 → 늦게 만든 쪽(지금 규칙)이지만 빈 칸은 채움(C10b 꼴)
  const A3 = card({ back: 'A-made' });
  const B3 = card({ createdAt: T0 + 10, updatedAt: T0 + 10, docTitle: 'Book (B)' });
  assert.deepEqual(twice(B3, A3, 'B3←A3').r, { op: 'patch', patch: { back: 'A-made' } }, '기기(B)가 이기되 빈 뒷면만 채움(updatedAt 그대로)');
  assert.deepEqual(twice(A3, B3, 'A3←B3').r, { op: 'patch', patch: { docTitle: 'Book (B)', createdAt: T0 + 10, updatedAt: T0 + 10 } },
    '파일(B)이 이기되 B 의 빈 뒷면이 A 뒷면을 지우지 않음');
  // ① 한쪽만 빈 필드(필드별) — 파일이 이김: 뒷면은 파일, 빈 메모는 기기 메모를 지우지 않음 · 공백만은 빈 값
  const M4 = card({ back: 'old', note: 'M-note', explain: 'M-ex', updatedAt: T0 + H });
  const T4 = card({ back: 'new', note: '', explain: '  ', updatedAt: T0 + 2 * H });
  assert.deepEqual(twice(M4, T4, 'M4←T4').r, { op: 'patch', patch: { back: 'new', updatedAt: T0 + 2 * H } }, '① 파일이 이겨도 빈 메모·공백 설명은 기기 값 유지');
  // 기기가 이김: 기기의 빈 메모만 파일 값으로 채움, 기기 뒷면은 그대로
  const M5 = card({ back: 'mine', note: '', updatedAt: T0 + 2 * H });
  const T5 = card({ back: 'theirs', note: 'T-note', updatedAt: T0 + H });
  assert.deepEqual(twice(M5, T5, 'M5←T5').r, { op: 'patch', patch: { note: 'T-note' } }, '① 기기가 이겨도 빈 칸은 채움');
  // 시각을 모르는 옛·특이 레코드(createdAt 없음)는 고친 것으로 본다 — 지금 규칙(updatedAt)
  const old = card({ back: 'legacy', updatedAt: T0 + H });
  delete old.createdAt;
  assert.deepEqual(B.mergeRecord('cards', old, Bauto, {}), { op: 'keep' }, '모름 = 고침 → 만들기만 한 파일이 이기지 못함');
  // 복습·멈춤 묶음은 여전히 따로
  const rv = card({ back: 'A-back', updatedAt: T0 + H, reviewedAt: T0 + 2 * H, sm2: { ease: 2.5, interval: 1, reps: 1, lapses: 0 }, dueAt: T0 + DAY });
  const rB = card({ createdAt: T0 + DAY, updatedAt: T0 + DAY, reviewedAt: T0 + DAY + H, sm2: { ease: 2.6, interval: 4, reps: 2, lapses: 0 }, dueAt: T0 + 5 * DAY });
  assert.deepEqual(B.mergeRecord('cards', rv, rB, {}), { op: 'patch', patch: { sm2: rB.sm2, dueAt: rB.dueAt, reviewedAt: rB.reviewedAt } },
    '내용은 고친 A · 복습 상태는 늦게 복습한 B');
  // `[12-1d — 12-1cR #3]` 빈 값 건너뜀은 글자 칸(back·note·explain)만 — 파일이 이기면 비글자 칸의 빈 값·null 은 그대로 옮겨진다
  const M6 = card({ back: 'm', docTitle: 'Book', lineId: '3:4', paraId: '3:p1', updatedAt: T0 + H });
  const T6 = card({ back: 'm', docTitle: '', lineId: null, paraId: '   ', updatedAt: T0 + 2 * H });
  assert.deepEqual(twice(M6, T6, 'M6←T6').r, { op: 'patch', patch: { docTitle: '', lineId: null, paraId: '   ', updatedAt: T0 + 2 * H } },
    '비글자 칸(docTitle·lineId·paraId)의 빈 값은 건너뛰지 않음');
  // `[12-1d — 12-1cR #1]` 같은 꼴·같은 updatedAt("같으면 기기" 자리)에서 둘 다 비지 않은 다른 글자 → 문자열이 큰 쪽(기기·순서 무관)
  const P7 = card({ back: 'L1-auto', note: 'n', explain: 'zeta', updatedAt: T0 + H });
  const Q7 = card({ back: 'L2-auto', note: 'n', explain: 'alpha', updatedAt: T0 + H, docTitle: 'Book (Q)' });
  const pq = twice(P7, Q7, 'P7←Q7');
  const qp = twice(Q7, P7, 'Q7←P7');
  assert.deepEqual(pq.r, { op: 'patch', patch: { back: 'L2-auto' } }, '같은 시각 — 큰 뒷면을 받고 내 큰 설명은 지킴(docTitle·시각은 기기)');
  assert.deepEqual(qp.r, { op: 'patch', patch: { explain: 'zeta' } }, '반대 방향도 같은 글자로');
  assert.deepEqual([pq.merged.back, pq.merged.note, pq.merged.explain], [qp.merged.back, qp.merged.note, qp.merged.explain], '양방향 같은 글자');
  // 시각이 다르면(둘 다 고침) 큰 쪽 규칙이 끼지 않음 — 늦은 쪽 그대로
  assert.deepEqual(B.mergeRecord('cards', card({ back: 'zz', updatedAt: T0 + 2 * H }), card({ back: 'aa', updatedAt: T0 + H }), {}), { op: 'keep' }, '시각 다름 → 기기(늦음) 그대로');
  // 꼴이 다르면(한쪽만 고침) 큰 쪽 규칙이 끼지 않음 — 고친 쪽 그대로
  assert.deepEqual(B.mergeRecord('cards', card({ back: 'aa', updatedAt: T0 + H }), card({ back: 'zz', createdAt: T0 + H, updatedAt: T0 + H }), {}), { op: 'keep' },
    '같은 updatedAt 이어도 꼴이 다르면(고침 vs 만들기만) 고친 기기 그대로');
});

test('C11c ★ [12-1d] 세 기기 — 이긴 W 의 빈 뒷면 / 진 L1·L2 의 다른 뒷면 → 어떤 교환 순서든 셋 다 같은 뒷면으로 수렴 · 멱등 · 씨앗 고정 무작위 돌기 갈라짐 0', () => {
  const H = 3600000;
  const card = (o) => Object.assign({ id: 'sc:y', kind: 'sentence', front: 'Fever is common.', back: '', explain: '', note: '', srcLang: 'en', targetLang: 'ar',
    docId: 'dev', docTitle: 'Book', pageNo: 3, createdAt: T0, updatedAt: T0, reviewedAt: null, introducedAt: null,
    sm2: { ease: 2.5, interval: 0, reps: 0, lapses: 0 }, dueAt: T0, suspended: false }, o);
  const imp = (mine, theirs) => {
    const r = B.mergeRecord('cards', mine, theirs, {});
    return r.op === 'patch' ? Object.assign({}, mine, r.patch) : mine;
  };
  const strip = (c) => { const o = Object.assign({}, c); for (const k of ['docId', 'sm2', 'dueAt', 'reviewedAt', 'introducedAt']) delete o[k]; return JSON.stringify(o); };
  // 12-1cR W3 꼴 — W 만든 뒤 메모 고침(가장 늦음, 뒷면 빔) / L1·L2 만들 때 자동 뒷면(서로 다름)
  const W = card({ createdAt: T0 + 2 * DAY, updatedAt: T0 + 2 * DAY + H, note: 'W-note' });
  const L1 = card({ back: 'L1-auto' });
  const L2 = card({ createdAt: T0 + DAY, updatedAt: T0 + DAY, back: 'L2-auto' });
  let l2 = imp(L2, W);            // L2 ← W(아직 아무것도 안 받은 W 의 파일)
  let w = imp(W, L1);             // W ← L1 : 빈 뒷면 채움
  let l1 = imp(L1, w);
  for (let k = 0; k < 3; k++) { w = imp(imp(w, l1), l2); l1 = imp(imp(l1, w), l2); l2 = imp(imp(l2, w), l1); }
  assert.deepEqual([w.back, l1.back, l2.back], ['L2-auto', 'L2-auto', 'L2-auto'], '★ 셋 다 같은 뒷면(전에는 W·L1 = L1-auto, L2 = L2-auto 로 갈라짐)');
  assert.deepEqual([w.note, l1.note, l2.note], ['W-note', 'W-note', 'W-note']);
  assert.equal(strip(w), strip(l1)); assert.equal(strip(l1), strip(l2));
  assert.equal(strip(imp(w, l2)), strip(w), '한 번 더 = 그대로');
  // 씨앗 고정 무작위 돌기 — 한 기기 변형(만든 날 2 × 안 고침·고침 × 뒷면 4 × 메모 2) · 옛 파일 섞어 8번 → 모두가 모두를 3바퀴
  const variants = (tag, shift) => {
    const out = [];
    for (const c of [T0 + shift, T0 + DAY + shift]) for (const ed of [false, true]) for (const back of ['', '  ', tag + '-a', tag + '-b']) for (const note of ['', tag + '-n']) {
      if (!ed && note) continue;
      out.push(card({ createdAt: c, updatedAt: ed ? c + H : c, back: back, note: note, docTitle: 'Book ' + tag }));
    }
    return out;
  };
  const pool = [variants('A', 0), variants('B', 3 * H), variants('C', 7 * H)];
  let s = 20261117 >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  let diverge = 0, unstable = 0, erased = 0;
  for (let t = 0; t < 600; t++) {
    const orig = pool.map((p) => p[Math.floor(rnd() * p.length)]);
    const dev = orig.slice();
    const files = orig.map((o) => [o]);
    for (let st = 0; st < 8; st++) {
      const i = Math.floor(rnd() * 3); let j = Math.floor(rnd() * 2); if (j >= i) j++;
      dev[i] = imp(dev[i], files[j][Math.floor(rnd() * files[j].length)]);
      files[i].push(dev[i]);
    }
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== j) dev[i] = imp(dev[i], dev[j]);
    const before = dev.map(strip);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== j) dev[i] = imp(dev[i], dev[j]);
    if (dev.some((d, k) => strip(d) !== before[k])) unstable++;
    if (!dev.every((d) => strip(d) === strip(dev[0]))) diverge++;
    for (const f of ['back', 'note']) if (orig.some((o) => o[f].trim()) && dev.some((d) => !String(d[f] || '').trim())) erased++;
  }
  assert.deepEqual({ diverge, unstable, erased }, { diverge: 0, unstable: 0, erased: 0 }, '세 기기 — 갈라짐·불안정·지움 0');
});

test('C11b ★ [12-1c] 9c 종단 — V5 꼴 양방향(A 뒷면·메모 고침 / B 다음 날 만들기만) → 어느 쪽에서 가져와도 뒷면·메모 지킴 · 복습 상태 늦은 쪽 · 두 번 = 한 번', async () => {
  const buildA = async () => {
    await reset();
    await db.put('documents', docRec('devA', 's256:p:1:same', { title: 'Book' }));
    clock = T0;
    const c = (await cards.saveSentence(input({ docId: 'devA', docTitle: 'Book', back: 'A-back' }))).card;
    clock = T0 + 3600000;
    await cards.update(c.id, { note: 'A-note' });
    await cards.review(c.id, 'good', { nowMs: T0 + 3700000, dayStartMs: DS, ms: 800 });
    return c.id;
  };
  const buildB = async () => {
    await reset();
    await db.put('documents', docRec('devB', 's256:p:1:same', { title: 'Book (B)' }));
    clock = T0 + DAY;
    return (await cards.saveSentence(input({ docId: 'devB', docTitle: 'Book (B)' }))).card.id;
  };
  const exportFile = async (now) => { const ex = await exportBackup({ now: now, gzip: false }); return new File([ex.blob], ex.name); };
  const snap = async () => JSON.stringify(await cards.list());
  const id = await buildA();
  const a0 = await cards.get(id);
  const fA = await exportFile(T0 + 3800000);
  assert.equal(await buildB(), id, '같은 PDF·같은 문장 = 같은 id');
  const fB = await exportFile(T0 + DAY + 100);
  // B ← A
  assert.equal((await IM.importBackup(fA, { now: T0 + DAY + 200, defaults: DEFAULTS })).ok, true);
  const onB = await cards.list({ kind: 'sentence' });
  assert.equal(onB.length, 1);
  assert.deepEqual([onB[0].back, onB[0].note, onB[0].docId], ['A-back', 'A-note', 'devB'], '★ B 가 A 의 뒷면·메모를 받음(docId 는 B 문서)');
  assert.deepEqual([onB[0].sm2, onB[0].reviewedAt], [a0.sm2, a0.reviewedAt], '복습 상태는 복습한 A');
  const sB = await snap();
  assert.equal((await IM.importBackup(fA, { now: T0 + DAY + 300, defaults: DEFAULTS })).ok, true);
  assert.equal(await snap(), sB, 'B←A 두 번 = 한 번');
  // A ← B(만들기만 한 B 의 파일)
  await buildA();
  assert.equal((await IM.importBackup(fB, { now: T0 + DAY + 400, defaults: DEFAULTS })).ok, true);
  const onA = await cards.get(id);
  assert.equal((await cards.list({ kind: 'sentence' })).length, 1);
  assert.deepEqual([onA.back, onA.note, onA.updatedAt, onA.createdAt], ['A-back', 'A-note', a0.updatedAt, a0.createdAt], '★ A 의 뒷면·메모·시각 지킴');
  assert.deepEqual([onA.sm2, onA.reviewedAt], [a0.sm2, a0.reviewedAt], '복습 상태 그대로');
  const sA = await snap();
  assert.equal((await IM.importBackup(fB, { now: T0 + DAY + 500, defaults: DEFAULTS })).ok, true);
  assert.equal(await snap(), sA, 'A←B 두 번 = 한 번');
  assert.equal(fetchCalls, 0);
});
