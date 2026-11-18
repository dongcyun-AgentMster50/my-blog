/* ============================================================
   tests/cards-ui-12.test.mjs — 12-3 기억 카드 복습 화면 `#/cards` · 목록 · 서재 "오늘" 줄
   (spec 17-11 6 · 7 표 12-3 행 · 8 "12-3" 수용 기준 · 10 결정 12-D3·D12·D14·D15·D17 · crossstep "12-3 결정 후보"·"이 책" 묶음)

   K1  라우트 `#/cards`·`#/cards/:docId` · cardsHash 왕복 · SCREENS · 섹션 하나 · 입구 셋(서재 "오늘" 줄·단어장 [복습 (n)]·카드 [⋯]) · main.js 배선
   K2  순수 — kindsOf · requeue(3장 뒤 · 적으면 끝) · spanText · markParts · faceOf · listRows · bookOptions · dayOf · todayLine
   K3  ★ 카드 6장(문장 3·단어 3 — 번역 빈 단어 1·내일 due 1) → "오늘" 줄 셈 = queue().counts · 흐름: 앞면 → 답 보기 → 쉬움 →
        dueAt = previewLabels 의 쉬움 · updatedAt 그대로 · ms · 끝 화면 숫자(오늘 n = srs.log · 내일 m) · 요청 0
   K4  ★ "다시" → 같은 카드가 3장 뒤에 다시 · dueAt = now+10분 · 남은 카드가 적으면 끝에
   K5  ★ 거르기 칩 [단어] → term 만 · [문장] → sentence 만 · `docId` → 그 책만 · 칩은 세션(저장 0)
   K6  ★ 뒷면 빈 문장 카드 — 캐시(aiCache translate 키)에 번역이 있으면 채워 저장(updatedAt 그대로) · 없으면 뒷면 빈 채(화면은 "번역 없음") ·
        지운 문서의 카드는 지금 책 docId 키로도 찾는다 · 요청 0
   K7  ★ 날짜 넘김(가짜 시계 23:59 → 00:01) — 내일 due 카드가 나타나고 오늘 새 카드 셈이 0 부터 · 보이던 카드 유지 · 날 경계는 지역 날짜(Asia/Seoul)
   K8  [목록] 편집 — 뒷면 고침 → updatedAt 오름(사람 편집) · 비우기 허용 · 멈춤 → 복습 줄에서 빠짐(suspendedAt) · 삭제 · 단어는 목록 밖
   K9  ★ "이 책" 묶음(fileHash) — 지우고 다시 가져온 같은 PDF 의 남은 카드가 list·queue·keptCount 에 잡힘 · 살아 있는 다른 문서(변형 키)는 섞지 않음 ·
        fileHash 없는 문서·다른 PDF 는 안 잡힘
   K10 ★ 자동 채움은 updatedAt 을 올리지 않는다 → 9c 병합에서 다른 기기의 손으로 쓴 뒷면이 이긴다(양방향) · 사람 편집은 올린다
   K11 정적 — cards.js import(호출 길 0 — pipeline·fetch 없음, ai 는 cache 의 keyFor 만) · innerHTML 0 · confirm() 0 · 4언어 키 · 마크업·CSS
   K12 `[12-2R #1]` 선택 줄 `[⋯]` 메뉴 — 넘치면 두 열(`sel-more-cols`) · CSS `:not([hidden])`
   K13 합성 5,000장 — queue·list 시간(기록 · 넉넉한 상한)
   지어낸 문장만. 실제 키·실제 호출 없음.
   ============================================================ */

process.env.TZ = 'Asia/Seoul';   // 날 경계 시험(K7)이 UTC 와 갈리게 — 서머타임 없는 +9

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

let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; throw new Error('호출 금지'); };

const db = await import('../js/db.js');
const R = await import('../js/router.js');
const C = await import('../js/srs/cards.js');
const S2 = await import('../js/srs/sm2.js');
const B = await import('../js/text/backup.js');
const U = await import('../js/ui/cards.js');
const L = await import('../js/ui/library.js');
const { keyFor } = await import('../js/ai/cache.js');
const { SRS } = await import('../js/config.js');
const { BUNDLES, LANGS } = await import('../js/i18n/index.js');

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
function strip(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'); }

const DAY = 86400000;
const T0 = new Date(2026, 10, 17, 9, 0, 0).getTime();          // 지역(서울) 2026-11-17 09:00
const DS = new Date(2026, 10, 17).getTime();
const DE = new Date(2026, 10, 18).getTime();
let clock = T0;
const store = C.createCardStore({ now: () => clock });

async function reset() { for (const s of db.STORE_NAMES) await db.clearStore(s); }

/** 지어낸 카드 — 문장/단어. */
function sent(id, o) {
  return Object.assign({ id: id, kind: 'sentence', front: 'Sentence ' + id + ' is short.', back: 'جملة ' + id, explain: '', srcLang: 'en', targetLang: 'ar',
    docId: 'docA', docTitle: 'Book A', pageNo: 3, lineId: '3:1', paraId: '3:p0', origin: 'band', domain: 'medical', note: '',
    createdAt: T0 - 1000, updatedAt: T0 - 1000, reviewedAt: null, introducedAt: null, sm2: { ease: 2.5, interval: 0, reps: 0, lapses: 0 },
    dueAt: T0 - 1000, suspended: false }, o || {});
}
function term(id, o) {
  return Object.assign({ id: id, kind: 'term', term: id, surface: id, translation: 'ترجمة ' + id, gloss: 'شرح', context: 'The ' + id + ' was noted here.',
    contextTr: 'سياق', srcLang: 'en', targetLang: 'ar', docId: 'docA', docTitle: 'Book A', pageNo: 4, lineId: '4:2',
    createdAt: T0 - 900, updatedAt: T0 - 900, reviewedAt: null, introducedAt: null, sm2: { ease: 2.5, interval: 0, reps: 0, lapses: 0 },
    dueAt: T0 - 900, suspended: false }, o || {});
}
const reviewed = (dueAt) => ({ reviewedAt: T0 - 3 * DAY, introducedAt: T0 - 9 * DAY, sm2: { ease: 2.5, interval: 3, reps: 2, lapses: 0 }, dueAt: dueAt });

function flowOf(o) {
  const x = o || {};
  return U.createReviewFlow({ store: store, now: () => clock, lookup: x.lookup || U.cacheLookup(db, x.extra || null), newPerDay: () => (x.npd === undefined ? 20 : x.npd) });
}

/* ══ K1 라우트 · 입구 ═══════════════════════════════════ */

test('K1 라우트 `#/cards`·`#/cards/:docId` · cardsHash 왕복 · SCREENS · 섹션 하나 · 입구 셋 · main.js 배선', () => {
  assert.deepEqual(R.parseRoute('#/cards'), { name: 'cards', params: {}, raw: '#/cards' });
  assert.deepEqual(R.parseRoute('#/cards/').params, {});
  const id = 'doc id/with:odd';
  const r = R.parseRoute(R.cardsHash(id));
  assert.deepEqual([r.name, r.params.docId], ['cards', id]);
  assert.equal(R.cardsHash(null), '#/cards');
  assert.equal(R.cardsHash(''), '#/cards');
  assert.ok(R.SCREENS.includes('cards'));
  const html = src('../index.html');
  assert.equal((html.match(/data-screen="cards"/g) || []).length, 1);
  // 입구 1 — 서재 맨 위 "오늘" 줄(숨김으로 시작 · [복습 시작] → #/cards)
  assert.match(html, /<div class="card lib-today" id="libraryToday" role="region" aria-labelledby="libraryTodayText" hidden>/);
  assert.match(html, /<button type="button" class="primary" id="libraryTodayBtn" data-nav="#\/cards"><\/button>/);
  assert.ok(html.indexOf('id="libraryToday"') < html.indexOf('id="libraryImport"'), '서재 본문 맨 위');
  assert.ok(!/data-nav="#\/cards"[^>]*id="library(Vocab|Search)Btn"/.test(html));
  // 서재 상단 줄은 늘리지 않는다(12-D14) — 상단 줄 단추 넷 그대로
  const head = html.slice(html.indexOf('data-screen="library"'), html.indexOf('id="libraryToday"'));
  assert.equal((head.match(/<button /g) || []).length, 4);
  // 입구 2 — 단어장 머리 [복습 (n)] → [단어] 칩
  assert.match(html, /<button type="button" id="vocabReview" data-va="review" hidden><\/button>/);
  const voc = strip(src('../js/ui/vocab.js'));
  assert.match(voc, /if \(a === 'review'\) \{ presetCardsChip\('term'\); go\(cardsHash\(S\.docId\)\); return; \}/);
  assert.match(voc, /cardStore\.queue\(\{ kinds: \['term'\], docId: S\.docId \|\| undefined/);
  // 입구 3 — 서재 카드 [⋯] "이 책 복습"
  const lib = strip(src('../js/ui/library.js'));
  assert.match(lib, /cb\.setAttribute\('data-action', 'cards'\);/);
  assert.match(lib, /if \(btn\.getAttribute\('data-action'\) === 'cards'\) \{\s*go\(cardsHash\(docId\)\);/);
  assert.match(lib, /await renderToday\(\);/);
  const main = strip(src('../js/main.js'));
  assert.match(main, /import \{ initCards, showCards, leaveCards \} from '\.\/ui\/cards\.js';/);
  assert.match(main, /initCards\(\);/);
  assert.match(main, /if \(route\.name !== 'cards'\) leaveCards\(\);/);
  assert.match(main, /case 'cards': showCards\(route\.params\); break;/);
});

/* ══ K2 순수 ═══════════════════════════════════════════ */

test('K2 순수 — kindsOf · requeue · spanText · markParts · faceOf · listRows · bookOptions · dayOf · todayLine', () => {
  assert.deepEqual(U.kindsOf('term'), ['term']);
  assert.deepEqual(U.kindsOf('sentence'), ['sentence']);
  assert.deepEqual(U.kindsOf('all'), ['sentence', 'term']);
  assert.deepEqual(U.kindsOf('x'), ['sentence', 'term']);
  // "다시" — 지금 카드(맨 앞)를 빼고 3장 뒤
  assert.deepEqual(U.requeue(['a', 'b', 'c', 'd', 'e', 'f'], 'a'), ['b', 'c', 'd', 'a', 'e', 'f']);
  assert.deepEqual(U.requeue(['a', 'b', 'c'], 'a'), ['b', 'c', 'a'], '적으면 끝에');
  assert.deepEqual(U.requeue(['a'], 'a'), ['a'], '혼자면 곧바로 다시');
  assert.deepEqual(U.requeue(['a', 'b', 'a2'], 'a', 1), ['b', 'a', 'a2']);
  assert.equal(U.AGAIN_GAP, 3);
  const tr = (k, p) => k + ':' + (p ? p.n : '');
  // `[다듬기 5]` 수에 따른 꼴은 UI 언어 범주 키 — en 은 기본 키 그대로(ar·fr 범주 키는 polish-5 Z8)
  assert.equal(U.spanText({ n: 10, unit: 'min' }, tr, 'en'), 'cards.span.min:10');
  assert.equal(U.spanText({ n: 4, unit: 'day' }, tr, 'en'), 'cards.span.day:4');
  assert.equal(U.spanText({ n: 1, unit: 'weird' }, tr, 'en'), 'cards.span.day:1');
  // 문맥 밑줄 — 대소문자 무시 · 정규식 글자 · 없으면 null
  assert.deepEqual(U.markParts('The Edema was noted.', 'edema'), ['The ', 'Edema', ' was noted.']);
  assert.deepEqual(U.markParts('dose (mg) given', '(mg)'), ['dose ', '(mg)', ' given']);
  assert.equal(U.markParts('nothing here', 'edema'), null);
  assert.equal(U.markParts('', 'x'), null);
  // 앞·뒷면 모양
  const fs = U.faceOf(sent('s1', { back: '  ب  ', explain: 'شرح' }));
  assert.deepEqual([fs.kind, fs.front, fs.back, fs.explain, fs.srcLang, fs.targetLang], ['sentence', 'Sentence s1 is short.', 'ب', 'شرح', 'en', 'ar']);
  const ft = U.faceOf(term('edema', { surface: 'Edema', translation: '' }));
  assert.deepEqual([ft.kind, ft.front, ft.mark, ft.back, ft.gloss, ft.contextTr], ['term', 'Edema', 'Edema', '', 'شرح', 'سياق']);
  // 목록 줄 — 문장만 · 만든 날(새것 먼저) · 다음 복습(이른 것 먼저, 멈춤은 뒤)
  const rows = [sent('a', { createdAt: 1, dueAt: 50 }), sent('b', { createdAt: 3, dueAt: 10 }), term('t'), sent('c', { createdAt: 2, dueAt: 5, suspended: true })];
  assert.deepEqual(U.listRows(rows, 'created').map((x) => x.id), ['b', 'c', 'a']);
  assert.deepEqual(U.listRows(rows, 'due').map((x) => x.id), ['b', 'a', 'c']);
  const opts = U.bookOptions([sent('a'), sent('b', { docId: 'gone', docTitle: 'Old' }), term('t')], [{ id: 'docA', title: 'Book A' }, { id: 'docZ', title: 'Z' }]);
  assert.deepEqual(opts.map((o) => [o.value, o.n, o.gone]), [['', 2, false], ['docA', 1, false], ['docZ', 0, false], ['gone', 1, true]]);
  const d = U.dayOf(T0);
  assert.deepEqual([d.dayStartMs, d.dayEndMs, d.key], [DS, DE, '2026-11-17']);
  assert.deepEqual(L.todayLine(0, { due: 3, fresh: 2 }), { show: false, due: 3, fresh: 2, start: true }, '카드 0장이면 줄 없음');
  assert.deepEqual(L.todayLine(4, { due: 0, fresh: 0 }), { show: true, due: 0, fresh: 0, start: false });
});

/* ══ K3 흐름 — 6장 · 쉬움 · 끝 화면 ═══════════════════════ */

async function seedSix() {
  await reset();
  await db.put('documents', { id: 'docA', title: 'Book A', fileName: 'a.pdf', fileHash: 's256:p:1:aaa', pageCount: 10 });
  await db.put('cards', sent('s-due', Object.assign({ createdAt: T0 - 50 * DAY }, reviewed(T0 - DAY))));      // 복습할 것
  await db.put('cards', sent('s-new', { createdAt: T0 - 500 }));                                             // 새 카드
  await db.put('cards', sent('s-noback', { back: '', createdAt: T0 - 400 }));                                // 새 카드 · 뒷면 빔
  await db.put('cards', term('t-new', { createdAt: T0 - 300 }));                                             // 새 단어
  await db.put('cards', term('t-notr', { translation: '', createdAt: T0 - 200 }));                           // 번역 빈 단어 — 빠짐(noTr)
  await db.put('cards', term('t-tomorrow', Object.assign({ createdAt: T0 - 60 * DAY }, reviewed(DE + 5))));  // 내일 due
}

test('K3 ★ 6장 → "오늘" 줄 = queue().counts · 앞면 → 답 보기 → 쉬움 → dueAt = previewLabels · updatedAt 그대로 · 끝 화면 숫자 · 요청 0', async () => {
  await seedSix();
  clock = T0;
  const q = await store.queue({ nowMs: T0, dayStartMs: DS, dayEndMs: DE, newPerDay: 20 });
  assert.deepEqual(q.counts, { due: 1, fresh: 3, noBack: 1, noTr: 1 });
  const line = L.todayLine(await db.count('cards'), q.counts);
  assert.deepEqual(line, { show: true, due: 1, fresh: 3, start: true }, '★ "오늘" 줄 = queue().counts');
  const f = flowOf({ lookup: async () => '' });
  let v = await f.start({ chip: 'all' });
  assert.deepEqual([v.state, v.face, v.left, v.fresh, v.noTr], ['card', 'front', 4, 3, 1]);
  assert.deepEqual(f.line(), ['s-due', 's-new', 's-noback', 't-new'], '복습할 것 → 새 카드(createdAt 순)');
  assert.equal(v.previews, null, '앞면에는 간격 없음');
  // 앞면 → 답 보기 → 쉬움
  clock = T0 + 4000;
  v = await f.reveal();
  assert.equal(v.face, 'back');
  assert.equal(v.previews.length, 4);
  const easy = v.previews.find((p) => p.grade === 'easy');
  assert.deepEqual(v.previews.map((p) => p.grade), SRS.GRADES);
  const before = await store.get('s-due');
  const r = await f.grade('easy');
  assert.equal(r.rec.dueAt, easy.dueAt, '★ 매긴 카드의 dueAt = previewLabels 의 쉬움');
  const after = await store.get('s-due');
  assert.equal(after.updatedAt, before.updatedAt, 'updatedAt 그대로(12-D9)');
  assert.equal(after.reviewedAt, T0 + 4000);
  assert.deepEqual((await store.readLog())['2026-11-17'], { n: 1, ms: 4000, new: 0 }, 'ms = 앞면을 보인 때부터');
  assert.deepEqual([r.view.state, r.view.face, r.view.left, r.view.id], ['card', 'front', 3, 's-new']);
  // 나머지 셋 — 좋음
  for (const id of ['s-new', 's-noback', 't-new']) {
    assert.equal(f.view().id, id);
    await f.reveal();
    await f.grade('good');
  }
  v = f.view();
  assert.equal(v.state, 'done');
  // 내일: 오늘 매긴 새 카드 셋(좋음 → 1일) + 내일 due 단어 = 4 · 오늘 4장
  assert.deepEqual(v.done, { today: 4, tomorrow: 4, total: null });
  assert.equal(fetchCalls, 0, '★ 요청 0');
});

/* ══ K4 "다시" ═════════════════════════════════════════ */

test('K4 ★ "다시" → 같은 카드가 3장 뒤에 다시 · dueAt = now + 10분 · 줄이 짧으면 끝에', async () => {
  await reset();
  for (let i = 0; i < 6; i++) await db.put('cards', sent('n' + i, { createdAt: T0 - 100 + i }));
  clock = T0;
  const f = flowOf();
  await f.start({});
  assert.deepEqual(f.line(), ['n0', 'n1', 'n2', 'n3', 'n4', 'n5']);
  await f.reveal();
  clock = T0 + 2000;
  const r = await f.grade('again');
  assert.equal(r.rec.dueAt, T0 + 2000 + SRS.AGAIN_MS, '★ dueAt = now + 10분');
  assert.deepEqual(f.line(), ['n1', 'n2', 'n3', 'n0', 'n4', 'n5'], '★ 3장 뒤에 다시');
  assert.equal(r.view.again, 1);
  for (const id of ['n1', 'n2', 'n3']) { assert.equal(f.view().id, id); await f.reveal(); await f.grade('good'); }
  assert.equal(f.view().id, 'n0', '★ 같은 카드가 다시 나옴');
  assert.equal(f.view().fresh, 2, '"다시" 카드는 이제 새 카드가 아니다');
  // 줄이 짧으면 끝에
  await f.reveal();
  await f.grade('again');
  assert.deepEqual(f.line(), ['n4', 'n5', 'n0']);
  assert.equal(fetchCalls, 0);
});

/* ══ K5 거르기 칩 · 책 ═════════════════════════════════ */

test('K5 ★ 거르기 칩 [단어]→term 만 · [문장]→sentence 만 · docId → 그 책만 · 칩은 저장하지 않음', async () => {
  await seedSix();
  await db.put('cards', sent('s-other', { docId: 'docB', docTitle: 'Book B', createdAt: T0 - 100 }));
  clock = T0;
  const f = flowOf();
  let v = await f.start({ chip: 'term' });
  assert.equal(v.chip, 'term');
  assert.deepEqual(f.line(), ['t-new'], '★ [단어] → term 만');
  v = await f.setChip('sentence');
  assert.deepEqual(f.line(), ['s-due', 's-new', 's-noback', 's-other'], '★ [문장] → sentence 만');
  v = await f.setChip('all');
  assert.equal(f.line().length, 5);
  const fb = flowOf();
  await fb.start({ docId: 'docB' });
  assert.deepEqual(fb.line(), ['s-other'], '★ #/cards/:docId → 그 책만');
  const fa = flowOf();
  await fa.start({ docId: 'docA', chip: 'term' });
  assert.deepEqual(fa.line(), ['t-new']);
  assert.equal(await db.get('settings', 'cards.chip'), undefined, '칩은 저장하지 않는다(세션 동안만)');
  // 카드가 하나도 없는 범위 → empty
  const fz = flowOf();
  assert.equal((await fz.start({ docId: 'nope' })).state, 'empty');
});

/* ══ K6 뒷면 채우기(캐시 읽기) ═════════════════════════ */

test('K6 ★ 뒷면 빈 문장 카드 — 캐시에 번역 → 채움·저장(updatedAt 그대로) · 없으면 빈 채 · 지운 문서는 지금 책 키로 · 요청 0', async () => {
  await seedSix();
  clock = T0;
  const c0 = await store.get('s-noback');
  // 캐시에 그 문장 번역을 심는다 — 낭독 동반·탭 번역이 쓰는 바로 그 키(translate · 문서 · 대상 · 원문)
  await db.put('aiCache', { key: await keyFor('docA', c0.front, 'ar', 'translate'), kind: 'translate', docId: 'docA', targetLang: 'ar', result: 'ترجمة مخزنة', createdAt: 1 });
  const f = flowOf({ npd: 20 });
  await f.start({ chip: 'sentence' });
  while (f.view().id !== 's-noback') { await f.reveal(); await f.grade('good'); }
  const v = await f.reveal();
  assert.equal(v.card.back, 'ترجمة مخزنة', '★ 캐시에서 채움');
  const stored = await store.get('s-noback');
  assert.equal(stored.back, 'ترجمة مخزنة', '★ 저장됨');
  assert.equal(stored.updatedAt, c0.updatedAt, '[12-3 결정] 자동 채움 — updatedAt 그대로');
  // 캐시에도 없으면 빈 채(화면은 "번역 없음" + [쪽으로 가기])
  await db.put('cards', sent('s-none', { back: '', front: 'Nothing cached for this one.', createdAt: T0 - 50 }));
  const g = flowOf();
  await g.start({ chip: 'sentence' });
  while (g.view().id !== 's-none') { await g.reveal(); await g.grade('good'); }
  const w = await g.reveal();
  assert.equal(w.face, 'back');
  assert.equal(U.faceOf(w.card).back, '', '★ 캐시에 없으면 뒷면 없음');
  assert.equal((await store.get('s-none')).back, '');
  // 지운 문서의 카드 — 그 문서 캐시는 지워졌다(deleteDocument) → 지금 책(docNew) 키로 찾는다
  await db.put('aiCache', { key: await keyFor('docNew', 'Orphan sentence here.', 'ar', 'translate'), kind: 'translate', docId: 'docNew', targetLang: 'ar', result: 'يتيم', createdAt: 1 });
  const look = U.cacheLookup(db, () => 'docNew');
  assert.equal(await look('Orphan sentence here.', 'docGone', 'ar'), 'يتيم');
  assert.equal(await U.cacheLookup(db, null)('Orphan sentence here.', 'docGone', 'ar'), '', '지금 책을 모르면 못 찾음');
  assert.equal(await look('  Orphan   sentence here. ', 'docGone', 'ar'), 'يتيم', '공백만 다른 앞면도 같은 키(normalizeForHash)');
  assert.equal(fetchCalls, 0, '★ 요청 0');
});

/* ══ K7 날짜 넘김 ══════════════════════════════════════ */

test('K7 ★ 날짜 넘김(23:59 → 00:01) — 내일 due 카드가 나타나고 오늘 새 카드 셈이 0 부터 · 보이던 카드 유지 · 지역 날짜', async () => {
  await reset();
  const N = new Date(2026, 10, 17, 23, 59, 0).getTime();
  const M = new Date(2026, 10, 18, 0, 1, 0).getTime();
  await db.put('cards', sent('due-now', Object.assign({ createdAt: T0 - 9 * DAY }, reviewed(T0 - DAY))));
  await db.put('cards', sent('due-tomorrow', Object.assign({ createdAt: T0 - 8 * DAY }, reviewed(DE + 60000))));   // 11-18 00:01
  await db.put('cards', sent('fresh1', { createdAt: T0 - 300 }));
  await db.put('cards', sent('fresh2', { createdAt: T0 - 200 }));
  await db.put('settings', { key: 'srs.log', value: { '2026-11-17': { n: 5, ms: 1000, new: 2 } } });   // 오늘 새 카드 이미 2장
  clock = N;
  const f = flowOf({ npd: 3 });
  let v = await f.start({});
  assert.deepEqual(f.line(), ['due-now', 'fresh1'], '23:59 — 내일 due 없음 · 오늘 새 카드 상한(3) 중 1장만 남음');
  assert.equal(v.fresh, 1);
  // due-now 를 "다시"(dueAt = 내일 00:09) → 줄 [fresh1, due-now] · fresh1 의 뒷면을 보는 중에 자정
  await f.reveal();
  await f.grade('again');
  assert.deepEqual(f.line(), ['fresh1', 'due-now']);
  await f.reveal();
  assert.equal(await f.rollover(), false, '같은 날이면 그대로');
  clock = M;
  assert.equal(await f.rollover(), true, '★ 날이 바뀜');
  v = f.view();
  assert.equal(v.dayKey, '2026-11-18');
  // 새 날의 줄 = 복습할 것(dueAt 순: due-tomorrow 00:01 → due-now 00:09) + 새 카드(셈 0 부터 — 3장 중 둘) · 보이던 fresh1 은 맨 앞에 그대로
  assert.deepEqual(f.line(), ['fresh1', 'due-tomorrow', 'due-now', 'fresh2'], '★ 내일 due 카드가 나타나고 새 카드 셈이 0 부터 · 보이던 카드 유지');
  assert.deepEqual([v.id, v.face, v.fresh], ['fresh1', 'back', 2], '★ 보이던 카드·면 유지');
  assert.equal(await f.rollover(), false);
  // 날 경계는 지역 날짜 — 서울 00:30 은 UTC 로는 전날 15:30
  const early = new Date(2026, 10, 18, 0, 30).getTime();
  assert.equal(U.dayOf(early).key, '2026-11-18');
  assert.equal(U.dayOf(early).dayStartMs, new Date(2026, 10, 18).getTime());
  await reset();
  await db.put('cards', sent('due-1830', Object.assign({ createdAt: T0 - 9 * DAY }, reviewed(new Date(2026, 10, 18, 0, 10).getTime()))));
  clock = early;
  const g = flowOf();
  await g.start({});
  assert.deepEqual(g.line(), ['due-1830'], '★ 지역 자정 뒤 — 오늘(11-18) due');
});

/* ══ K8 [목록] 편집 ═══════════════════════════════════ */

test('K8 [목록] — 뒷면 고침 → updatedAt 오름 · 비우기 · 멈춤 → 복습 줄에서 빠짐(suspendedAt) · 삭제 · 단어는 목록 밖', async () => {
  await seedSix();
  clock = T0 + 10;
  const u = await store.update('s-new', { back: 'ترجمة جديدة', note: 'm' });
  assert.equal(u.updatedAt, T0 + 10, '★ 사람이 고친 뒷면 → updatedAt 오름');
  clock = T0 + 20;
  const e = await store.update('s-new', { back: '' });
  assert.deepEqual([e.back, e.updatedAt], ['', T0 + 20], '비우기 허용(9c 에서 다른 기기 값으로 다시 찰 수 있음 — 12-1c 기록)');
  clock = T0 + 30;
  const s = await store.update('s-due', { suspended: true });
  assert.deepEqual([s.suspended, s.suspendedAt, s.updatedAt], [true, T0 + 30, T0 - 1000], '멈춤은 suspendedAt — updatedAt 그대로(12-1 ②)');
  const f = flowOf();
  await f.start({});
  assert.ok(!f.line().includes('s-due'), '★ 멈춤 → 복습 줄에서 빠짐');
  assert.equal(await store.remove('s-noback'), true);
  assert.equal(await store.get('s-noback'), null);
  assert.equal(await store.remove('t-new'), false, '단어는 단어장이 지운다');
  const rows = U.listRows(await store.list({ kind: 'sentence' }), 'created');
  assert.ok(rows.every((r) => r.kind === 'sentence'));
  assert.deepEqual(rows.map((r) => r.id).sort(), ['s-due', 's-new']);
});

/* ══ K9 "이 책" 묶음 ═══════════════════════════════════ */

test('K9 ★ "이 책" — 지우고 다시 가져온 같은 PDF 의 남은 카드가 list·queue·keptCount 에 · 다른 문서·fileHash 없음·다른 PDF 는 안 섞임', async () => {
  await reset();
  clock = T0;
  const H = 's256:p:1:book';
  await db.put('documents', { id: 'd1', title: 'Book', fileHash: H, pageCount: 40 });
  const a = (await store.saveSentence({ front: 'Kept card one.', targetLang: 'ar', docId: 'd1', docTitle: 'Book', origin: 'band', srcLang: 'en' })).card;
  const b = (await store.saveSentence({ front: 'Kept card two.', targetLang: 'ar', docId: 'd1', docTitle: 'Book', origin: 'band', srcLang: 'en' })).card;
  await db.deleteDocument('d1');
  // 같은 PDF 를 다시 가져옴(새 docId) — 아직 아무 문장도 다시 저장하지 않았다
  await db.put('documents', { id: 'd3', title: 'Book again', fileHash: H, pageCount: 40 });
  const c = (await store.saveSentence({ front: 'New card.', targetLang: 'ar', docId: 'd3', docTitle: 'Book again', origin: 'band', srcLang: 'en' })).card;
  assert.deepEqual((await store.list({ docId: 'd3' })).map((x) => x.id).sort(), [a.id, b.id, c.id].sort(), '★ 남은 카드가 "이 책"에');
  assert.equal(await store.keptCount('d3'), 3, '★ keptCount 도 묶음');
  const q = await store.queue({ nowMs: T0, dayStartMs: DS, dayEndMs: DE, docId: 'd3' });
  assert.equal(q.counts.fresh, 3, '★ "이 책 복습" 줄');
  assert.deepEqual([(await store.get(a.id)).docId], ['d1'], '읽기만 — 레코드는 고치지 않는다');
  // 살아 있는 다른 문서(표본 해시가 겹친 다른 PDF — 변형 키)의 카드는 섞지 않는다
  await db.put('documents', { id: 'dv', title: 'Variant', fileHash: H + ':n99', pageCount: 99 });
  const v = (await store.saveSentence({ front: 'Variant card.', targetLang: 'ar', docId: 'dv', docTitle: 'Variant', origin: 'band', srcLang: 'en' })).card;
  assert.ok(!(await store.list({ docId: 'd3' })).some((x) => x.id === v.id), '살아 있는 다른 문서는 안 섞임');
  assert.equal(await store.keptCount('dv'), 3, '변형 키 문서 쪽에서는 지운 같은 책 칸 카드(a·b)도 묶인다 — 살아 있는 d3 의 카드는 아님(12-1bR 낮음-2 기록 그대로)');
  // 다른 PDF 의 지운 문서 카드는 안 잡힘
  await db.put('documents', { id: 'o1', title: 'Other', fileHash: 's256:p:1:other', pageCount: 5 });
  const o = (await store.saveSentence({ front: 'Other book card.', targetLang: 'ar', docId: 'o1', docTitle: 'Other', origin: 'band', srcLang: 'en' })).card;
  await db.deleteDocument('o1');
  assert.ok(!(await store.list({ docId: 'd3' })).some((x) => x.id === o.id));
  // fileHash 없는 문서 → 묶지 않음(docId 필드만)
  await db.put('documents', { id: 'nh', title: 'No hash' });
  assert.deepEqual(await store.list({ docId: 'nh' }), []);
  // 지운 문서 자체로 물으면 docId 필드로(전과 같음)
  assert.equal(await store.keptCount('d1'), 2);
  // 흐름도 같은 묶음
  const f = flowOf();
  await f.start({ docId: 'd3' });
  assert.equal(f.line().length, 3);
  assert.equal(fetchCalls, 0);
});

/* ══ K10 자동 채움 시각 결정 ═══════════════════════════ */

test('K10 ★ 자동 채움은 updatedAt 을 올리지 않는다 → 9c 병합에서 다른 기기의 손으로 쓴 뒷면이 이김(양방향) · 사람 편집은 올림', async () => {
  await reset();
  await db.put('documents', { id: 'dA', title: 'Book', fileHash: 's256:p:1:merge', pageCount: 9 });
  clock = T0;
  const made = (await store.saveSentence({ front: 'Merge me.', targetLang: 'ar', docId: 'dA', docTitle: 'Book', origin: 'voice', srcLang: 'en' })).card;
  clock = T0 + 5 * 3600000;
  const auto = await store.fillBack(made, async () => 'آلي');
  assert.deepEqual([auto.back, auto.updatedAt, auto.createdAt], ['آلي', T0, T0], '★ 기기 A: 자동 채움 — 안 고친 카드 그대로');
  clock = T0 + 6 * 3600000;
  const again = await store.saveSentence({ front: 'Merge me.', targetLang: 'ar', docId: 'dA', docTitle: 'Book', origin: 'band', srcLang: 'en', explain: 'شرح' });
  assert.equal(again.card.updatedAt, T0, 'saveSentence 의 빈 칸 채움도 그대로');
  // 기기 B: 같은 카드(먼저 만들어짐)에 손으로 뒷면을 씀 — 자동 채움보다 이른 시각
  const handB = Object.assign({}, made, { back: 'يدوي', createdAt: T0 - 3600000, updatedAt: T0 + 3600000 });
  const mineA = await store.get(made.id);
  const intoA = B.mergeRecord('cards', mineA, handB, {});
  assert.equal(intoA.op, 'patch');
  assert.equal(intoA.patch.back, 'يدوي', '★ A 가 B 를 가져옴 — 손으로 쓴 뒷면이 자동 채움을 이김');
  const intoB = B.mergeRecord('cards', handB, mineA, {});
  assert.ok(intoB.op === 'keep' || !('back' in (intoB.patch || {})), '★ B 가 A 를 가져와도 손으로 쓴 뒷면 그대로');
  // 사람 편집은 올림
  clock = T0 + 7 * 3600000;
  const ed = await store.update(made.id, { back: 'تعديل' });
  assert.equal(ed.updatedAt, T0 + 7 * 3600000);
  assert.equal(fetchCalls, 0);
});

/* ══ K11 정적 ══════════════════════════════════════════ */

test('K11 정적 — cards.js 호출 길 0 · innerHTML 0 · confirm() 0 · 시계는 Date.now 하나 · 4언어 키 · 마크업 · CSS', () => {
  const code = src('../js/ui/cards.js');
  const bare = strip(code);
  const imports = (code.match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || []).map((s) => s.replace(/^[\s\S]*from\s*/, '').replace(/['"]/g, ''));
  assert.ok(!imports.some((p) => /pipeline|readalong|gemini|provider|\/ai\/(?!cache\.js)/.test(p)), '★ AI 호출 길 import 0: ' + imports.join(','));
  assert.match(code, /import \{ keyFor \} from '\.\.\/ai\/cache\.js';/, 'ai 는 cache 의 keyFor(키 문자열)만');
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon/.test(bare), 'fetch 0');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(bare), 'innerHTML 0');
  assert.ok(!/\bconfirm\(/.test(bare), 'confirm() 0 — 페이지 안 확인');
  assert.ok(!/new Date\(\)/.test(bare), '시계는 Date.now 하나(가짜 시계 시험)');
  const html = src('../index.html');
  const sec = html.slice(html.indexOf('data-screen="cards"'), html.indexOf('</section>', html.indexOf('data-screen="cards"')));
  assert.match(sec, /id="cardsFrontText" dir="ltr"/, '앞면 칸 dir=ltr');
  assert.equal((sec.match(/data-ca="grade"/g) || []).length, 4);
  assert.match(sec, /<dialog class="confirm-dialog" id="cardsDelDialog"/);
  for (const k of ['cards.title', 'cards.show', 'cards.grade.again', 'cards.grade.hard', 'cards.grade.good', 'cards.grade.easy', 'cards.noBack', 'cards.goto',
    'cards.done', 'cards.empty', 'cards.noTr', 'cards.span.min', 'cards.span.day', 'cards.span.month', 'cards.span.year', 'cards.span.hour',
    'library.today', 'library.today.start', 'library.card.cards', 'vocab.review', 'cards.disclaimer', 'cards.list.count']) {
    for (const l of LANGS) assert.equal(typeof BUNDLES[l][k], 'string', l + ' ' + k);
  }
  for (const l of LANGS) for (const k of Object.keys(BUNDLES.en).filter((x) => x.startsWith('cards.'))) assert.ok(BUNDLES[l][k], l + ' ' + k);
  // `[12-2R #5]` en 복수 "1 memory cards" 꼴 없음 · ko 숫자 뒤 "는" 없음
  assert.ok(!/\{n\} memory cards|\{n\} word-list/.test(BUNDLES.en['library.card.deleteConfirmCards'] + BUNDLES.en['library.card.deleteConfirmVocab']));
  assert.ok(!/\{list\} 는/.test(BUNDLES.ko['library.card.deleteKeeps']));
  const css = src('../css/screens.css');
  assert.match(css, /\.cards-grades \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
  assert.ok(!/(?:^|[;{\s])(?:margin|padding|inset|border)-(?:left|right)\b|(?:^|[;{\s])(?:left|right)\s*:\s*[\w-]/m.test(css.slice(css.indexOf('[12-3 — spec 17-11 6]'))), '논리 속성만');
  const voc = src('../js/ui/vocab.js');
  assert.ok(!/innerHTML/.test(strip(voc)));
});

/* ══ K12 선택 줄 [⋯] 두 열 ═════════════════════════════ */

test('K12 `[12-2R #1]` 선택 줄 `[⋯]` 메뉴 — 줄 위 공간에 넘치면 두 열(`sel-more-cols`) · 닫힌 메뉴는 숨김 그대로', () => {
  const sb = strip(src('../js/ui/selbar.js'));
  assert.match(sb, /els\.menu\.classList\.remove\('sel-more-cols'\);/);
  assert.match(sb, /if \(els\.menu\.scrollHeight > els\.menu\.clientHeight \+ 1\) els\.menu\.classList\.add\('sel-more-cols'\);/);
  assert.ok(sb.indexOf("classList.add('sel-more-cols')") > sb.indexOf('els.menu.hidden = false;'), '보인 뒤에 잰다');
  const css = src('../css/reader.css');
  assert.match(css, /\.sel-bar \.sel-more-menu\.sel-more-cols:not\(\[hidden\]\) \{\s*display: grid;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

/* ══ K13 합성 5,000장 ══════════════════════════════════ */

test('K13 합성 5,000장 — queue·list 시간(기록)', async () => {
  await reset();
  await db.put('documents', { id: 'docP', title: 'Perf', fileHash: 's256:p:1:perf', pageCount: 900 });
  const recs = [];
  for (let i = 0; i < 5000; i++) {
    const base = i % 2 ? term('pt' + i, { docId: 'docP', createdAt: T0 - 5000 + i }) : sent('ps' + i, { docId: i % 4 ? 'docP' : 'gone' + (i % 7), createdAt: T0 - 5000 + i });
    if (i % 3 === 0) Object.assign(base, reviewed(T0 - (i % 5) * DAY));
    recs.push(base);
  }
  await db.putAll('cards', recs);
  clock = T0;
  let t0 = performance.now();
  const q = await store.queue({ nowMs: T0, dayStartMs: DS, dayEndMs: DE, newPerDay: 20 });
  const tQueue = performance.now() - t0;
  t0 = performance.now();
  const ls = await store.list({ kind: 'sentence', docId: 'docP' });
  const tList = performance.now() - t0;
  t0 = performance.now();
  const rows = U.listRows(ls, 'due');
  const tRows = performance.now() - t0;
  console.log('# K13 5000장 queue ' + tQueue.toFixed(0) + 'ms · list(이 책) ' + tList.toFixed(0) + 'ms · listRows ' + tRows.toFixed(0) + 'ms · due ' + q.counts.due + ' fresh ' + q.counts.fresh + ' rows ' + rows.length);
  assert.ok(q.counts.due > 0 && q.counts.fresh === 20);
  assert.ok(tQueue < 15000 && tList < 15000, 'fake-idb 에서도 넉넉한 상한(실측은 headless)');
});
