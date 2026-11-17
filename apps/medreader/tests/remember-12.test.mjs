/* ============================================================
   tests/remember-12.test.mjs — 12-2 기억 카드 만들기: 띠 [☆] 세 모드 · 선택 줄 [기억 카드] · 음성 "기억"
   (spec 17-11 5 · 8 "12-2" 수용 기준 — fake-idb + 진짜 `createCardStore` + 가짜 readalong · 진짜 `createSpeaker`)

   R1  ★ cardInput — 앞면·원문 언어(8m Unit.lang → 문서)·문서·쪽·줄·문단·출처 · 표 안내·인용·문서/대상 없음 → null
   R2  unitsFor · selectionUnit · voiceUnit · starPressed — 탭 두 문장 → 둘 · seg 어긋나면 글로 · 표 안내 빠짐
   R3  ★ starTarget(세 모드) · touchHolds(단추 누름은 굴림 멈춤 아님)
   R4  ★ 띠 [☆] 낭독 — 메모리 번역 → back · origin band · [★] · 다시 → 지움 · 복습한 카드는 남김 + 한 줄 · 요청 0
   R5  ★ 뒷면 대기(pendingBacks) — 번역 pending 에서 앞면만 → 번역이 오면 그 카드에 back · 한 번만 · leave 뒤엔 안 채움
   R6  탭 두 문장 → 카드 둘 · [문단 전체]는 대상 아님 · 캐시(cachedFor) 번역 → back
   R7  ★ 설명 모드 — explain 사본 · origin explain · 설명 없는 기존 카드는 [☆](눌러 채움) · 채운 뒤 [★]
   R8  선택 줄 — 선택 시작 줄의 문장 · 두 번째는 "이미 있음" · 표 안내 줄 → none · 번역 끔(번역 없음)이면 앞면만
   R9  음성 fromVoice — 지금 문장(문장·줄 모드) · 낭독 전·표 안내 → none(카드 0)
   R10 ★ 음성 흐름(voice.js 갈래) — «احفظ» 낭독 중 → 저장 1 · 확인 줄 · 한 마디 → 되돌림(같은 문장 speaking) ·
        sayErrors=false → 한 마디 없이 되돌림 · none → 한 마디 → 되돌림 · 저장 기다리는 사이 손 → 되돌림 없음 · 주입 없음 → notYet
   R11 ★ 명령 표 — remember 꼴 공유 0 · "save" 혼자일 때만 · 부정 · 기존 명령 그대로
   R12 서재 삭제 확인 — 한 줄로 합침("단어장 항목 2건 · 기억 카드 3장은 남습니다" — `[12-3]` 조사 · 0 은 빠짐) · keptCount 셈
   R13 정적 — import 방향(pipeline·ai 0) · 띠 배선·마크업·CSS 논리 속성·48px · controls 배선 · i18n 4언어 · innerHTML 0 · 판본 무변
   지어낸 글자만. 실제 키·실제 호출 없음(fetch 를 막고 센다).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; throw new Error('호출 금지'); };

const db = await import('../js/db.js');
const C = await import('../js/srs/cards.js');
const R = await import('../js/ui/remember.js');
const TB = await import('../js/ui/trband.js');
const { createSpeaker } = await import('../js/tts/speaker.js');
const { createVoice } = await import('../js/ui/voice.js');
const { matchCommand, commandById, VOICE_COMMANDS } = await import('../js/voice/commands.js');
const { deleteKeepLines, deleteKeepCounts, deleteConfirmText } = await import('../js/ui/library.js');
const { SEL_ACTIONS } = await import('../js/ui/selbar.js');
const { BUNDLES } = await import('../js/i18n/index.js');
const { DEFAULTS } = await import('../js/settings.js');
const P = await import('../js/ai/prompts.js');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const flush = async (n) => { for (let i = 0; i < (n || 20); i++) await new Promise((r) => setTimeout(r, 0)); };
const LANGS = ['ar', 'en', 'fr', 'ko'];

const T0 = new Date(2026, 10, 17, 9, 0, 0).getTime();
let clock = T0;
const store = C.createCardStore({ now: () => clock });

async function reset() { for (const s of db.STORE_NAMES) await db.clearStore(s); }

/* ── 문장 단위(지어낸 것) · 리더 값 ─────────────────────── */
const S1 = 'Fever is common after surgery.';
const S2 = 'Most cases resolve within two days.';
const S3 = 'Persistent fever needs a work-up.';
const U = [
  { src: S1, seg: 0, lineIds: ['3:0'], paraId: '3:p1', lang: 'en' },
  { src: S2, seg: 1, lineIds: ['3:0', '3:1'], paraId: '3:p1', lang: 'en' },
  { src: 'Table 2 is shown here.', seg: null, lineIds: ['3:2'], paraId: '3:t', kind: 'table-notice' },
  { src: S3, seg: 2, lineIds: ['3:3'], paraId: '3:p2', lang: 'en' }
];
const CTX = { docId: 'docA', docTitle: 'Book A', page: 3, target: 'ar', docLang: 'en', domain: 'medical' };

/** 가짜 readalong — 메모리(`get`) · 캐시 읽기(`cachedFor`) · 구독(`onChange`) · 요청 함수는 세기만(불리면 안 된다). */
function fakeRa(mem, cache) {
  const m = new Map(Object.entries(mem || {}));
  const fns = new Map();
  const calls = { requestTap: 0, retry: 0, cachedFor: 0 };
  return {
    calls,
    get: (src) => Object.assign({}, m.get(src) || { state: 'none' }),
    cachedFor: async (units) => {
      calls.cachedFor++;
      const out = new Map();
      for (const u of units) if (cache && cache[u.src]) out.set(u.seg, { src: u.src, text: cache[u.src] });
      return out;
    },
    onChange: (src, fn) => {
      if (!fns.has(src)) fns.set(src, new Set());
      fns.get(src).add(fn);
      return () => { const s = fns.get(src); if (s) s.delete(fn); };
    },
    requestTap: () => { calls.requestTap++; return Promise.resolve(); },
    retry: () => { calls.retry++; return Promise.resolve(); },
    /** 번역 도착 흉내 — 메모리를 바꾸고 구독자에게 알린다(readalong `setMem` 과 같은 꼴). */
    arrive: (src, text) => {
      m.set(src, { state: 'ready', text: text });
      for (const fn of Array.from(fns.get(src) || [])) fn({ src: src, state: 'ready', text: text });
    },
    listeners: (src) => (fns.get(src) ? fns.get(src).size : 0)
  };
}

function rig(o) {
  const x = o || {};
  const ra = x.ra || fakeRa(x.mem, x.cache);
  const rem = R.createRemember({ store: store, readalong: ra, speaker: x.speaker || null,
    units: () => x.units || U, ctx: () => Object.assign({}, CTX, x.ctx || {}) });
  return { ra, rem };
}

const idOf = (front, docId) => store.idFor({ front: front, targetLang: 'ar', docId: docId || 'docA' });
const allCards = async () => (await store.list({ kind: 'sentence' }));

/* ══ R1 cardInput ═══════════════════════════════════════ */
test('R1 ★ cardInput — 필드 · 원문 언어(Unit.lang → 문서) · 문장 아님·문서/대상 없음 → null', () => {
  const i = R.cardInput(U[1], CTX, 'band', { back: ' مرحبا  بك ', explain: '' });
  assert.deepEqual(i, { front: S2, back: 'مرحبا بك', explain: '', srcLang: 'en', targetLang: 'ar', docId: 'docA', docTitle: 'Book A',
    pageNo: 3, lineId: '3:0', paraId: '3:p1', origin: 'band', domain: 'medical' });
  assert.equal(R.cardInput(Object.assign({}, U[0], { lang: undefined }), Object.assign({}, CTX, { docLang: 'fr' }), 'tap').srcLang, 'fr', '단위 언어가 없으면 문서 언어(8m)');
  assert.equal(R.cardInput(Object.assign({}, U[0], { lang: 'es' }), CTX, 'tap').srcLang, 'es', '단위 언어가 이긴다(8m)');
  assert.equal(R.cardInput(U[2], CTX, 'band'), null, '표 안내');
  assert.equal(R.cardInput(Object.assign({}, U[0], { cite: true }), CTX, 'band'), null, '인용');
  assert.equal(R.cardInput({ src: '   ', seg: 4, lineIds: ['3:9'] }, CTX, 'band'), null, '빈 글');
  assert.equal(R.cardInput(U[0], Object.assign({}, CTX, { docId: '' }), 'band'), null, '문서 없음');
  assert.equal(R.cardInput(U[0], Object.assign({}, CTX, { target: '' }), 'band'), null, '대상 언어 없음');
  assert.equal(R.cardInput(U[0], Object.assign({}, CTX, { page: 'x' }), 'band').pageNo, null);
});

/* ══ R2 대상 고르기 ═════════════════════════════════════ */
test('R2 unitsFor · selectionUnit · voiceUnit · starPressed', () => {
  assert.deepEqual(R.unitsFor(U, { segs: [{ seg: 0, src: S1 }, { seg: 1, src: S2 }] }), [U[0], U[1]], '탭 두 문장 → 둘');
  assert.deepEqual(R.unitsFor(U, { segs: [{ seg: 9, src: S3 }] }), [U[3]], 'seg 가 어긋나면 글이 같은 단위');
  assert.deepEqual(R.unitsFor(U, { segs: [{ seg: 0, src: S1 }, { seg: 0, src: S1 }] }), [U[0]], '겹침 하나');
  assert.deepEqual(R.unitsFor(U, { segs: [{ seg: null, src: 'Table 2 is shown here.' }] }), [], '표 안내 빠짐');
  assert.deepEqual(R.unitsFor(U, { unit: U[3], segs: [{ seg: 0, src: S1 }] }), [U[3]], 'unit 이 이긴다(설명 모드)');
  assert.deepEqual(R.unitsFor(U, { unit: U[2] }), []);
  assert.deepEqual(R.unitsFor(null, null), []);
  // 선택 — 시작 줄·오프셋의 문장(`unitAt`)
  assert.equal(R.selectionUnit(U, { lineId: '3:3', start: 0 }), U[3]);
  assert.equal(R.selectionUnit(U, { lineId: '3:2', start: 0 }), null, '표 안내 줄은 문장이 아니다');
  assert.equal(R.selectionUnit(U, null), null);
  // 음성 — 문장 모드 = 큐 번호, 줄 모드 = 지금 줄을 담은 첫 문장, 낭독 전 = 없음
  assert.equal(R.voiceUnit(U, U[3], 3, 'sentence'), U[3]);
  assert.equal(R.voiceUnit(U, { lineIds: ['3:1'] }, 7, 'line'), U[1]);
  assert.equal(R.voiceUnit(U, null, 0, 'sentence'), null, '낭독 전');
  assert.equal(R.voiceUnit(U, U[2], 2, 'sentence'), U[2], '표 안내 위 — 그 단위(부르는 쪽이 none)');
  assert.equal(R.starPressed([true, true]), true);
  assert.equal(R.starPressed([true, false]), false);
  assert.equal(R.starPressed([]), false);
});

/* ══ R3 starTarget · touchHolds ═══════════════════════════ */
test('R3 ★ starTarget 세 모드 · touchHolds', () => {
  assert.equal(TB.starTarget({ enabled: false, cur: { src: S1, seg: 0 } }), null, '배선 없으면 없음');
  const b = TB.starTarget({ enabled: true, cur: { src: S1, seg: 0 } });
  assert.equal(b.origin, 'band');
  assert.deepEqual(b.segs, [{ seg: 0, src: S1 }]);
  assert.equal(TB.starTarget({ enabled: true, cur: { src: 'Table 2', seg: null } }), null, '표 안내·인용(seg 없음)');
  assert.equal(TB.starTarget({ enabled: true, cur: { src: null, seg: null } }), null, '재생 전');
  const tp = TB.starTarget({ enabled: true, tap: { full: false, segs: [{ seg: 0, src: S1 }, { seg: 1, src: S2 }] } });
  assert.equal(tp.origin, 'tap');
  assert.equal(tp.segs.length, 2);
  assert.equal(TB.starTarget({ enabled: true, tap: { full: true, segs: [{ seg: 0, src: S1 }] } }), null, '[문단 전체] 보기에서는 숨김');
  assert.equal(TB.starTarget({ enabled: true, tap: { full: false, segs: [] } }), null, '번역 대상 문장 없음');
  assert.equal(TB.starTarget({ enabled: true, note: { id: 4, state: 'pending', unit: U[0] } }), null, '설명 준비 중');
  assert.equal(TB.starTarget({ enabled: true, note: { id: 4, state: 'ready', unit: null, text: 'x' } }), null, '문장을 모르면 없음');
  const n = TB.starTarget({ enabled: true, note: { id: 4, state: 'ready', unit: U[0], text: 'شرح' } });
  assert.deepEqual([n.origin, n.unit, n.explain], ['explain', U[0], 'شرح']);
  assert.notEqual(TB.starTarget({ enabled: true, note: { id: 5, state: 'ready', unit: U[0], text: 'شرح' } }).key, n.key, '다른 설명이면 다시 묻는다');
  assert.notEqual(b.key, TB.starTarget({ enabled: true, cur: { src: S2, seg: 1 } }).key, '문장이 바뀌면 다시 묻는다');
  // 띠를 만진 것 — 본문은 굴림 멈춤, [☆] 단추(안의 글리프 포함)는 아니다
  const inStar = { closest: (sel) => (sel === '[data-tr-action="remember"]' ? {} : null) };
  const inText = { closest: () => null };
  assert.equal(TB.touchHolds(inStar), false, '★ 단추 누름은 굴림 멈춤이 아니다');
  assert.equal(TB.touchHolds(inText), true);
  assert.equal(TB.touchHolds(null), true);
});

/* ══ R4 띠 낭독 ════════════════════════════════════════ */
test('R4 ★ 띠 [☆] 낭독 — 메모리 번역 → back · [★] · 다시 → 지움 · 복습한 카드는 남김 + 한 줄 · 요청 0', async () => {
  await reset();
  clock = T0;
  const { ra, rem } = rig({ mem: { [S1]: { state: 'ready', text: 'الحمى شائعة بعد الجراحة.' } } });
  const tg = { origin: 'band', segs: [{ seg: 0, src: S1 }] };
  assert.deepEqual(await rem.stateFor(tg), { pressed: false });
  const r1 = await rem.toggle(tg);
  assert.deepEqual(r1, { pressed: true, key: 'remember.saved' });
  const cs = await allCards();
  assert.equal(cs.length, 1);
  assert.deepEqual([cs[0].kind, cs[0].front, cs[0].back, cs[0].origin, cs[0].srcLang, cs[0].lineId, cs[0].pageNo],
    ['sentence', S1, 'الحمى شائعة بعد الجراحة.', 'band', 'en', '3:0', 3]);
  assert.equal(cs[0].id, await idOf(S1), 'id 는 cardStore.idFor(12-1b)');
  assert.deepEqual(await rem.stateFor(tg), { pressed: true }, '[★]');
  assert.equal(rem.debug().pending, 0, '뒷면이 있으면 기다리지 않는다');
  // 다시 → 복습 전 카드 지움
  assert.deepEqual(await rem.toggle(tg), { pressed: false, key: 'remember.removed' });
  assert.equal((await allCards()).length, 0);
  // 복습한 카드(reviewedAt 심음) → 남기고 한 줄
  await rem.toggle(tg);
  await db.patch('cards', await idOf(S1), () => ({ reviewedAt: T0 + 5 }));
  assert.deepEqual(await rem.toggle(tg), { pressed: true, key: 'remember.reviewed' });
  assert.equal((await allCards()).length, 1, '★ 복습한 카드는 지우지 않는다');
  assert.deepEqual([ra.calls.requestTap, ra.calls.retry, fetchCalls], [0, 0, 0], '★ 요청 0');
});

/* ══ R5 뒷면 대기 ═══════════════════════════════════════ */
test('R5 ★ pendingBacks — 앞면만 → 번역이 오면 그 카드에 back(한 번) · leave 뒤엔 채우지 않음', async () => {
  await reset();
  clock = T0;
  const { ra, rem } = rig({ mem: { [S2]: { state: 'pending' } } });
  const r = await rem.toggle({ origin: 'band', segs: [{ seg: 1, src: S2 }] });
  assert.equal(r.key, 'remember.saved');
  let c = await store.get(await idOf(S2));
  assert.equal(c.back, '', '번역 pending → 앞면만(12-D6)');
  assert.equal(rem.debug().pending, 1);
  assert.equal(ra.listeners(S2), 1);
  clock = T0 + 1000;
  ra.arrive(S2, 'معظم الحالات تزول خلال يومين.');
  await flush();
  c = await store.get(await idOf(S2));
  assert.equal(c.back, 'معظم الحالات تزول خلال يومين.', '★ 같은 카드에 채워짐');
  assert.equal(c.updatedAt, T0, '[12-3 결정] 채움(fillBack)은 updatedAt 을 올리지 않는다(전: T0 + 1000 — 내용 수정으로 봄)');
  assert.equal(rem.debug().pending, 0, '한 번 채우면 구독을 푼다');
  assert.equal(ra.listeners(S2), 0);
  assert.equal(rem.debug().filled, 1);
  // leave — 기다리던 카드는 이 세션 밖 번역으로 채우지 않는다
  await rem.toggle({ origin: 'band', segs: [{ seg: 2, src: S3 }] });
  assert.equal(rem.debug().pending, 1);
  rem.leave();
  assert.equal(rem.debug().pending, 0);
  ra.arrive(S3, 'نص');
  await flush();
  assert.equal((await store.get(await idOf(S3))).back, '', 'leave 뒤엔 채우지 않는다');
  assert.equal(fetchCalls, 0);
});

/* ══ R6 탭 · 캐시 ══════════════════════════════════════ */
test('R6 탭 두 문장 → 카드 둘(origin tap) · 캐시(cachedFor) 번역 → back · [★] 은 둘 다 있을 때만', async () => {
  await reset();
  const { ra, rem } = rig({ cache: { [S1]: 'من الكاش', [S2]: 'ترجمة ثانية' } });
  const tg = { origin: 'tap', segs: [{ seg: 0, src: S1 }, { seg: 1, src: S2 }] };
  // 하나만 먼저 있으면 [☆](모두가 아님)
  await store.saveSentence(R.cardInput(U[0], CTX, 'select'));
  assert.deepEqual(await rem.stateFor(tg), { pressed: false });
  const r = await rem.toggle(tg);
  assert.deepEqual(r, { pressed: true, key: 'remember.saved' });
  const cs = await allCards();
  assert.equal(cs.length, 2);
  const b = cs.find((x) => x.front === S2);
  assert.deepEqual([b.origin, b.back], ['tap', 'ترجمة ثانية'], '캐시 읽기만으로 뒷면');
  const a = cs.find((x) => x.front === S1);
  assert.equal(a.back, 'من الكاش', '먼저 있던 앞면만 카드도 빈 뒷면을 채운다(saveSentence)');
  assert.ok(ra.calls.cachedFor >= 1);
  assert.deepEqual([ra.calls.requestTap, fetchCalls], [0, 0]);
});

/* ══ R7 설명 모드 ═══════════════════════════════════════ */
test('R7 ★ 설명 모드 — explain 사본 · origin explain · 설명 없는 기존 카드는 [☆] → 눌러 채움 → [★]', async () => {
  await reset();
  const { rem } = rig({ mem: { [S3]: { state: 'ready', text: 'الحمى المستمرة تحتاج فحصًا.' } } });
  const tg = { origin: 'explain', unit: U[3], explain: 'الجملة تقول إن الحمى (fever) المستمرة تحتاج فحصًا.' };
  let r = await rem.toggle(tg);
  assert.deepEqual(r, { pressed: true, key: 'remember.saved' });
  let c = await store.get(await idOf(S3));
  assert.deepEqual([c.origin, c.explain, c.back], ['explain', tg.explain, 'الحمى المستمرة تحتاج فحصًا.']);
  // 낭독 띠에서 이미 만든(설명 없는) 카드 — 설명 모드에서는 [☆]
  await reset();
  await rem.toggle({ origin: 'band', segs: [{ seg: 2, src: S3 }] });
  assert.deepEqual(await rem.stateFor({ origin: 'band', segs: [{ seg: 2, src: S3 }] }), { pressed: true });
  assert.deepEqual(await rem.stateFor(tg), { pressed: false }, '설명 사본이 없으면 [☆]');
  r = await rem.toggle(tg);
  assert.deepEqual(r, { pressed: true, key: 'remember.saved' }, '누르면 지우지 않고 설명을 채운다');
  c = await store.get(await idOf(S3));
  assert.deepEqual([c.origin, c.explain], ['band', tg.explain], '처음 출처는 그대로 · 설명 채움');
  assert.equal((await allCards()).length, 1);
});

/* ══ R8 선택 줄 ═══════════════════════════════════════ */
test('R8 선택 줄 [기억 카드] — 시작 줄의 문장 · 두 번째는 이미 있음 · 표 안내 → none · 번역 없음 → 앞면만', async () => {
  await reset();
  const { ra, rem } = rig({});
  const r1 = await rem.fromSelection({ lineId: '3:3', start: 2, end: 9 });
  assert.deepEqual(r1, { ok: true, created: true, key: 'remember.saved' });
  const c = await store.get(await idOf(S3));
  assert.deepEqual([c.origin, c.back], ['select', ''], '번역 끔·캐시 없음 → 앞면만');
  assert.deepEqual(await rem.fromSelection({ lineId: '3:3', start: 0 }), { ok: true, created: false, key: 'remember.exists' });
  assert.deepEqual(await rem.fromSelection({ lineId: '3:2', start: 0 }), { ok: false, key: 'voice.remember.none' }, '표 안내 줄');
  assert.equal((await allCards()).length, 1);
  assert.deepEqual([ra.calls.requestTap, fetchCalls], [0, 0]);
});

/* ══ R9 음성 fromVoice ═════════════════════════════════ */
test('R9 fromVoice — 지금 문장(문장·줄 모드) · 낭독 전·표 안내 → none(카드 0)', async () => {
  await reset();
  const sp = (cur, idx, unit) => ({ getCurrent: () => cur, getIndex: () => idx, getUnit: () => unit });
  assert.deepEqual(await rig({ speaker: sp(null, 0, 'sentence') }).rem.fromVoice(), { ok: false, key: 'voice.remember.none' }, '낭독 전');
  assert.deepEqual(await rig({ speaker: sp(U[2], 2, 'sentence') }).rem.fromVoice(), { ok: false, key: 'voice.remember.none' }, '표 안내 위');
  assert.equal((await allCards()).length, 0, '카드 0');
  const r = await rig({ speaker: sp(U[1], 1, 'sentence'), mem: { [S2]: { state: 'ready', text: 'ب' } } }).rem.fromVoice();
  assert.deepEqual(r, { ok: true, created: true, key: 'remember.saved' });
  const r2 = await rig({ speaker: sp({ lineIds: ['3:3'] }, 0, 'line') }).rem.fromVoice();
  assert.equal(r2.ok, true, '줄 모드 — 지금 줄을 담은 문장');
  const cs = await allCards();
  assert.deepEqual(cs.map((x) => [x.front, x.origin]).sort(), [[S2, 'voice'], [S3, 'voice']]);
  assert.equal(fetchCalls, 0);
});

/* ══ R10 음성 흐름 (voice.js) ═══════════════════════════ */

function fakeTimers() {
  let now = 0; let seq = 1; const jobs = new Map();
  return {
    setTimeout: (fn, ms) => { const k = seq++; jobs.set(k, { fn: fn, at: now + (Number(ms) || 0) }); return k; },
    clearTimeout: (k) => { jobs.delete(k); },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let pick = null; let key = null;
        for (const [k, j] of jobs) if (j.at <= target && (pick === null || j.at < pick.at)) { pick = j; key = k; }
        if (!pick) break;
        jobs.delete(key); now = pick.at; pick.fn();
      }
      now = target;
    },
    now: () => now
  };
}
function fakeSynth() {
  const s = { speaking: false, pending: false, utt: [], current: null,
    speak(u) { s.speaking = true; s.current = u; s.utt.push(u); }, pause() { }, resume() { },
    cancel() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    finish() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onend) u.onend(); },
    texts() { return s.utt.map((u) => u.text); } };
  return s;
}
function fakeRecClass() {
  const inst = [];
  class FakeRec {
    constructor() { this.lang = ''; this.onstart = this.onaudiostart = this.onresult = this.onnomatch = this.onerror = this.onend = null; inst.push(this); }
    start() { } stop() { } abort() { }
    fire(alts) {
      const r = alts.map((t) => ({ transcript: t, confidence: 1 }));
      r.isFinal = true;
      if (this.onresult) this.onresult({ resultIndex: 0, results: [r] });
      if (this.onend) this.onend({});
    }
  }
  return { Rec: FakeRec, inst: inst };
}

function voiceRig(o) {
  const x = o || {};
  const synth = fakeSynth();
  const timers = fakeTimers();
  const paras = [{ id: 'p1', kind: 'body', lines: ['Alpha is the first one.', 'Bravo comes after it.', 'Charlie ends this page.'].map((t, i) => ({ id: '1:' + i, text: t, hyphen: 'none' })) }];
  const sp = createSpeaker({ synth: synth, timers: timers, makeUtterance: (t) => ({ text: t }),
    view: { paras: () => paras, page: () => ({ page: 1, pageCount: 1 }), goToPage: () => Promise.resolve(false), show: () => true, markDone: () => { } },
    requestWakeLock: () => Promise.resolve({ release() { } }) });
  const fk = fakeRecClass();
  const env = { settings: Object.assign({ 'voice.noticeAt': 1, 'voice.cmdLang': 'ar' }, x.settings || {}), statuses: [], presses: 0, calls: 0 };
  const get = (k) => (Object.prototype.hasOwnProperty.call(env.settings, k) ? env.settings[k] : DEFAULTS[k]);
  let voice = null;
  const pressPlay = () => { env.presses++; if (voice) voice.cancel(); if (sp.getState() === 'speaking') sp.pause(); else sp.play(); };
  const t = (k, p) => {
    let s = BUNDLES.en[k];
    if (typeof s !== 'string') return k;
    for (const [n, v] of Object.entries(p || {})) s = s.split('{' + n + '}').join(String(v));
    return s;
  };
  voice = createVoice({
    Recognition: fk.Rec, speaker: sp, pressPlay: pressPlay, getSetting: get, setSetting: () => Promise.resolve(), uiLang: () => 'ar', t: t,
    synth: synth, makeUtterance: (text) => ({ text: text }), sayVoice: () => ({ tag: 'ar-SA', voice: null }), timers: timers, now: timers.now,
    onRemember: x.noDep ? undefined : (a) => { env.calls++; env.arg = a; return x.result ? x.result() : Promise.resolve({ ok: true, created: true, key: 'remember.saved' }); },
    view: { paint: () => { }, status: (m) => env.statuses.push(m), notice: () => { } }
  });
  return { sp, synth, timers, voice, fk, env, rec: () => fk.inst[fk.inst.length - 1] };
}

test('R10 ★ 음성 "기억" — 저장 1 · 확인 줄 · 한 마디 → 되돌림 · sayErrors 꺼짐 · none · 손이 이김 · 주입 없음', async () => {
  // 낭독 중 «احفظ» → 저장 · 확인 줄 · 한 마디(«Saved.» — UI 문구) → 끝나면 같은 문장부터 이어 읽기
  let h = voiceRig();
  h.sp.play(); h.synth.finish();
  assert.deepEqual([h.sp.getState(), h.sp.getIndex()], ['speaking', 1]);
  h.voice.press();
  assert.equal(h.sp.getState(), 'paused');
  const n0 = h.synth.utt.length;
  h.rec().fire(['احفظ']);
  await flush();
  assert.equal(h.env.calls, 1, '저장 주입 1회');
  assert.equal(h.env.arg.via, 'voice');
  const conf = h.env.statuses.filter((m) => m && m.kind === 'confirm');
  assert.equal(conf.length, 1, '확인 줄');
  assert.match(conf[0].text, new RegExp(BUNDLES.en['voice.cmd.remember']));
  assert.deepEqual(h.synth.texts().slice(n0), [BUNDLES.en['voice.remember.done']], '한 마디 1');
  assert.equal(h.sp.getState(), 'paused', '말하는 동안은 멈춤');
  h.synth.finish();
  assert.deepEqual([h.sp.getState(), h.sp.getIndex()], ['speaking', 1], '★ 되돌림 — 같은 문장부터 이어 읽기');
  assert.equal(h.voice.debug().stats.restores, 1);
  // sayErrors 꺼짐 → 한 마디 없이 곧장 되돌림
  h = voiceRig({ settings: { 'voice.sayErrors': false } });
  h.sp.play();
  h.voice.press();
  const n1 = h.synth.utt.length;
  h.rec().fire(['احفظ']);
  await flush();
  assert.equal(h.env.calls, 1);
  assert.equal(h.synth.texts().slice(n1).filter((s) => s === BUNDLES.en['voice.remember.done']).length, 0, '한 마디 없음');
  assert.equal(h.sp.getState(), 'speaking', '★ 곧장 되돌림');
  // 표 안내 위 → none 한 마디 → 되돌림
  h = voiceRig({ result: () => Promise.resolve({ ok: false, key: 'voice.remember.none' }) });
  h.sp.play();
  h.voice.press();
  h.rec().fire(['remember']);
  await flush();
  assert.ok(h.env.statuses.some((m) => m && m.text === BUNDLES.en['voice.remember.none']), 'none 상태 줄');
  assert.ok(h.synth.texts().includes(BUNDLES.en['voice.remember.none']), 'none 한 마디');
  h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking', 'none 뒤에도 되돌림');
  // 저장을 기다리는 사이 손(마이크 다시·[▶]) → 되돌림 없음
  let resolve = null;
  h = voiceRig({ result: () => new Promise((r) => { resolve = r; }) });
  h.sp.play();
  h.voice.press();
  h.rec().fire(['احفظ']);
  await flush();
  assert.equal(h.voice.isListening(), true, '저장 기다림도 "바쁨"(9a·화면 단추가 먼저 cancel)');
  h.voice.cancel();
  resolve({ ok: true, created: true, key: 'remember.saved' });
  await flush();
  assert.equal(h.sp.getState(), 'paused', '★ 손이 이긴다 — 되돌림 없음');
  assert.equal(h.voice.debug().stats.restores, 0);
  // 주입 없음 → 9b "아직 없는 기능" 안내 그대로
  h = voiceRig({ noDep: true });
  h.sp.play();
  h.voice.press();
  h.rec().fire(['احفظ']);
  await flush();
  assert.ok(h.synth.texts().includes(BUNDLES.en['voice.notYet']));
  assert.equal(fetchCalls, 0);
});

/* ══ R11 명령 표 ═══════════════════════════════════════ */
test('R11 ★ 명령 표 — remember 꼴 · "save" 혼자일 때만 · 부정 · 기존 명령 그대로', () => {
  const c = commandById('remember');
  assert.ok(c && c.enabled);
  assert.deepEqual(c.ar, ['احفظ', 'احفظها', 'احفظ الجملة', 'تذكر', 'ذكرني']);
  assert.deepEqual(c.en, ['remember', 'remember this', 'save this', 'keep this', 'save']);
  assert.deepEqual(c.exact, ['save']);
  // `[20-2]` 표 끝에 `mark` 가 더해졌다 — remember 는 그 바로 앞(다른 명령 순서 그대로)
  assert.equal(VOICE_COMMANDS[VOICE_COMMANDS.length - 2].id, 'remember', '표 끝 앞(다른 명령 순서 그대로)');
  assert.equal(VOICE_COMMANDS[VOICE_COMMANDS.length - 1].id, 'mark');
  for (const [s, l, want] of [
    ['احفظ', 'ar', 'remember'], ['من فضلك احفظ', 'ar', 'remember'], ['احفظ الجملة', 'ar', 'remember'], ['ذكرني', 'ar', 'remember'],
    ['remember', 'en', 'remember'], ['Please remember this!', 'en', 'remember'], ['save', 'en', 'remember'], ['save', 'ar', 'remember'],
    // "save" 한 낱말은 혼자일 때만(exact) · 두 낱말 구("save this")는 9b 규칙대로 말 안에서도 맞는다("speed up" 과 같음 — 기록)
    ['save the patient', 'en', null], ['please save', 'en', 'remember'], ['save this one', 'en', 'remember'], ["don't save this", 'en', null], ['لا احفظ', 'ar', null],
    ['I remember the patient', 'en', null],
    ['اقرأ', 'ar', 'play'], ['وقف', 'ar', 'pause'], ['اشرح', 'ar', 'explain'], ['لخص', 'ar', 'summarize'], ['next', 'en', 'next'],
    ['احفظ', 'en', null]
  ]) assert.equal(matchCommand([s], l).id, want, l + ' «' + s + '»');
});

/* ══ R12 서재 삭제 확인 ═════════════════════════════════ */
test('R12 서재 삭제 확인 — 한 줄("단어장 항목 2건 · 기억 카드 3장은 남습니다" — [12-3] 조사) · 0 은 빠짐 · keptCount 셈', async () => {
  assert.deepEqual(deleteKeepLines({ vocab: 2, cards: 3, summaries: 0 }), [
    { key: 'library.card.deleteConfirmVocab', params: { n: 2 } }, { key: 'library.card.deleteConfirmCards', params: { n: 3 } }]);
  const ko = (k, p) => { let s = BUNDLES.ko[k]; for (const [n, v] of Object.entries(p || {})) s = s.split('{' + n + '}').join(String(v)); return s; };
  const text = deleteConfirmText('T', deleteKeepLines({ vocab: 2, cards: 3, summaries: 0 }), ko);
  assert.equal(text.split('\n').length, 2, '머리 + 한 줄');
  // `[12-3 — 12-2R #5 ③]` 숫자 뒤 "는" → 받침 있는 단위(건·장) + "은"("기억 카드 3장은" 꼴). 전: '단어장 2 · 기억 카드 3 는 남습니다'
  assert.equal(text.split('\n')[1], '단어장 항목 2건 · 기억 카드 3장은 남습니다');
  assert.equal(deleteConfirmText('T', deleteKeepLines({ vocab: 1, cards: 1, summaries: 4 }), ko).split('\n')[1], '단어장 항목 1건 · 기억 카드 1장 · 저장한 요약 4건은 남습니다');
  assert.equal(deleteConfirmText('T', deleteKeepLines({}), ko).split('\n').length, 1, '남는 것 없으면 머리만');
  for (const l of LANGS) {
    const en = (k, p) => { let s = BUNDLES[l][k]; for (const [n, v] of Object.entries(p || {})) s = s.split('{' + n + '}').join(String(v)); return s; };
    const line = deleteConfirmText('T', deleteKeepLines({ vocab: 2, cards: 3 }), en).split('\n')[1];
    assert.ok(line.includes('2') && line.includes('3') && line.includes(' · '), l + ' ' + line);
    assert.match(BUNDLES[l]['library.card.deleteKeeps'], /\{list\}/);
    assert.match(BUNDLES[l]['library.card.deleteConfirmCards'], /\{n\}/);
  }
  // 셈 — 가짜 저장소 · 실제 저장소(fake-idb)
  assert.deepEqual(await deleteKeepCounts('d', { vocab: { countByDoc: async () => 2 }, cards: { keptCount: async () => 3 }, summaries: { count: async () => 0 } }), { vocab: 2, cards: 3 });
  assert.deepEqual(await deleteKeepCounts('d', { vocab: { countByDoc: async () => 0 }, cards: { keptCount: async () => { throw new Error('x'); } }, summaries: { count: async () => 0 } }), { vocab: 0 }, '못 읽어도 확인은 뜬다');
  await reset();
  const { rem } = rig({});
  await rem.fromSelection({ lineId: '3:0', start: 0 });
  await rem.fromSelection({ lineId: '3:3', start: 0 });
  assert.equal((await deleteKeepCounts('docA')).cards, 2);
});

/* ══ R13 정적 ═══════════════════════════════════════════ */
test('R13 정적 — import 방향 · 띠 배선·마크업·CSS · controls · selbar · i18n · innerHTML 0 · 판본 무변', () => {
  const rm = strip(read('../js/ui/remember.js'));
  const imp = [...rm.matchAll(/^import [^;]* from '([^']+)';/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imp, ['../srs/cards.js', '../text/select.js', '../text/summary.js', './ask.js'], 'remember 는 카드 서비스·순수·ask 순수 export 만');
  assert.ok(!/pipeline|requestTap|\bfetch\b|innerHTML|\bdocument\b|\bwindow\b|sentenceIdOf/.test(rm), '요청·DOM·id 직접 계산 0');
  assert.match(rm, /store\.idFor\(/, '[★] id 는 cardStore.idFor');
  assert.match(rm, /store\.removeIfFresh\(id\)/, '복습 전 카드만');
  // 띠
  const tb = strip(read('../js/ui/trband.js'));
  assert.match(tb, /const hold = \(ev\) => \{ if \(touchHolds\(ev && ev\.target\)\) roll\.held = true; \};/, '★ 단추 누름은 굴림 멈춤으로 새지 않는다');
  assert.match(tb, /=== 'remember'\) onStar\(\);/);
  assert.ok(!/onStar[\s\S]{0,400}speaker|sp\.(pause|play|stop)\(/.test(tb.slice(tb.indexOf('function onStar('), tb.indexOf('function flash('))), '[☆] 는 낭독을 건드리지 않는다');
  assert.match(tb, /setRemember: setRemember, refreshStar: refreshStar,/);
  assert.match(tb, /noteBanner: noteBanner, dropNoteBanner: dropNoteBanner \}/, '11-4c api 끝 그대로');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(tb));
  const html = read('../index.html');
  const band = html.slice(html.indexOf('id="trBand"'), html.indexOf('id="trStatus"'));
  assert.ok(band.indexOf('id="trPara"') < band.indexOf('id="trSlot"') && band.indexOf('id="trSlot"') < band.indexOf('id="trStar"')
    && band.indexOf('id="trStar"') < band.indexOf('id="trReplay"') && band.indexOf('id="trReplay"') < band.indexOf('id="trClose"'), '[☆] 는 [×] 앞 자리');
  assert.match(band, /<button type="button" class="tr-star" id="trStar" data-tr-action="remember"\s+aria-pressed="false" data-i18n-aria="remember\.add">/);
  assert.match(html, /"\.\/js\/ui\/remember\.js": "\.\/js\/ui\/remember\.js\?v=[0-9a-f]{10}"/, 'import map 도장');
  const css = read('../css/reader.css');
  const sc = css.slice(css.indexOf('.tr-band .tr-tools > .tr-slot > .tr-star {'), css.indexOf('/* `[11-4 — spec 17-2-1 4-7]` 설명 모드'));
  assert.match(sc, /inline-size: var\(--tap\);[\s\S]*?min-block-size: var\(--tap\);/, '48×48');
  assert.ok(!/(?<![-\w])(left|right|margin-left|margin-right|padding-left|padding-right|width|height)\s*:/.test(sc), '논리 속성만');
  assert.match(sc, /\.tr-star\[aria-pressed="true"\]/);
  // controls 배선 — pipeline 을 넘기지 않는다
  const c = strip(read('../js/ui/controls.js'));
  const cr = c.slice(c.indexOf('remember = createRemember({'), c.indexOf('trband.setRemember({'));
  assert.ok(cr.length > 0 && !/pipeline/.test(cr), '★ 기억 카드에는 파이프라인이 없다(호출 0)');
  assert.match(c, /onRemember: function \(\) \{\s*return remember \? remember\.fromVoice\(\)/);
  assert.match(c, /\} else if \(id === 'remember'\) \{[\s\S]*?remember\.fromSelection\(snap\)/);
  assert.match(c, /if \(remember\) remember\.leave\(\);/, '리더를 떠나면 뒷면 기다림을 거둔다');
  assert.match(c, /explainSnap = id === 'explain' \? snap : null;/);
  // voice.js — 주입만 · 되돌림은 say 한 곳
  const v = strip(read('../js/ui/voice.js'));
  assert.ok(!/remember\.js|cards\.js|pipeline/.test(v), 'voice.js 는 주입만');
  assert.match(v, /case 'remember':\s*remember\(was, heard\);/);
  assert.match(v, /confirm\('remember', heard\);\s*say\('voice\.remember\.done', was\);/, '★ 한 마디 → restore(was)');
  // selbar
  assert.deepEqual(SEL_ACTIONS.filter((a) => a.more).map((a) => a.id), ['summary', 'readFrom', 'remember', 'lookup']);
  assert.ok(!/innerHTML/.test(strip(read('../js/ui/selbar.js'))));
  // i18n — 4언어 같은 키
  const keys = Object.keys(BUNDLES.en).filter((k) => k.startsWith('remember.') || k.startsWith('voice.remember.'))
    .concat(['sel.remember', 'voice.cmd.remember', 'library.card.deleteConfirmCards', 'library.card.deleteKeeps']);
  assert.ok(keys.length >= 13, String(keys.length));
  for (const l of LANGS) for (const k of keys) assert.ok(typeof BUNDLES[l][k] === 'string' && BUNDLES[l][k].length > 0, l + ' ' + k);
  assert.equal(BUNDLES.ar['voice.remember.done'], 'تم الحفظ');
  // 판본 무변
  assert.equal(db.DB_VERSION, 3);
  assert.deepEqual([P.PROMPT_VERSION, P.TERM_PROMPT_VERSION], [3, 1]);
});
