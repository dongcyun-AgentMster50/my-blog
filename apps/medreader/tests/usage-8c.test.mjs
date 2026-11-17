/* ============================================================
   tests/usage-8c.test.mjs — 8c-2 사용량 화면 · 80% 경고 (spec 15절 · 17-7-6 4-7 · 8 "8c-2")

   U  — 순수 `usageView`·`callsPer10k`·`readalongStats`·`pagesLeft`·`monthBars`·`staleDays`(DOM·DB 없음).
   W  — 80% 경고: 파이프라인 `onWarn`(흉내 fetch·메모리 DB — 실제 provider·gemini 어댑터를 지난다).
   K  — `cache.stats()` 종류별·읽기만.
   S  — 배선(배너 단추 · 입구 · 자리표시 키 지움 · 16-J).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createPipeline, dailyCapOf, capUsedOf, warnThreshold, STATES } from '../js/ai/pipeline.js';
import { createCache } from '../js/ai/cache.js';
import { localDay } from '../js/ai/provider.js';
import {
  usageView, callsPer10k, readalongStats, pagesLeft, monthBars, staleDays, dayShift, pruneUsage, SHOW_KINDS, MIN_STAT_PAGES, KEEP_DAYS
} from '../js/ui/usage.js';
import { remoteBanner } from '../js/ui/trband.js';
import { BUNDLES, LANGS } from '../js/i18n/index.js';
import { FAKE_KEY, memDb, stubFetch, jsonRes, geminiOk, docItems, settingsOf, manualTimers } from './fixtures/ai-stubs-8a.mjs';

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const T0 = new Date(2026, 10, 16, 9, 0, 0).getTime();     // 지역 시각 2026-11-16 09:00
const DAY = '2026-11-16';

/* ══════════════════════════════════════════════════════
   U. 순수 숫자
   ══════════════════════════════════════════════════════ */

const ROW = {
  day: DAY, calls: 12, byKind: { translate: 3, readalong: 6, term: 1, verify: 2, summarize: 0, quiz: 0, grade: 0, table: 0 },
  byProvider: { gemini: 12 }, tokensIn: 900, tokensOut: 1200, cacheHits: 5, ondeviceHits: 1, blocked429: 1, errors: 2,
  charsTranslated: 29500
};

test('U1 ★ usageView 오늘 — 호출(검증 포함) · 상한 셈은 검증 제외 · 종류별 따로 · 남은 수', () => {
  const v = usageView([ROW], { today: DAY, cap: 20, model: 'm1' });
  assert.equal(v.today.calls, 12, '오늘 호출 수는 실제 요청 수(검증 포함 — 16-J)');
  assert.equal(v.today.used, 10, '상한에 세는 호출 = calls − verify(15절)');
  assert.equal(v.today.verify, 2);
  assert.equal(v.today.cap, 20);
  assert.equal(v.today.left, 10);
  assert.equal(v.today.ratio, 0.5);
  const kinds = Object.fromEntries(v.today.kinds.map((k) => [k.kind, k.n]));
  // `[11-4 — spec 17-2-1 2-11 · 11 "8c-2"]` 설명(`explain`)도 늘 보이는 종류(요약과 같은 자리 — 0 이어도 한 줄).
  assert.deepEqual(kinds, { translate: 3, readalong: 6, term: 1, summarize: 0, explain: 0, verify: 2 }, '번역·낭독 번역·단어가 따로, 0 인 그 밖 종류는 숨김');
  assert.deepEqual(v.today.kinds.map((k) => k.kind).slice(0, SHOW_KINDS.length), SHOW_KINDS.slice());
  assert.equal(v.today.blocked429, 1);
  assert.equal(v.today.model, 'm1');
  assert.deepEqual(v.today.providers.map((p) => [p.id, p.n]), [['gemini', 12]]);
  // 상한이 이상하면 파이프라인과 같은 규칙(최소 1)
  assert.equal(usageView([ROW], { today: DAY, cap: 0 }).today.cap, 1);
  assert.equal(usageView([ROW], { today: DAY, cap: 'x' }).today.cap, 1);
  assert.equal(usageView([ROW], { today: DAY, cap: 5 }).today.left, 0, '넘쳐도 음수 아님');
  assert.equal(usageView([ROW], { today: DAY, cap: 5 }).today.ratio, 1);
  // 행이 없으면 0
  const e = usageView([], { today: DAY, cap: 100 });
  assert.equal(e.today.calls, 0);
  assert.equal(e.today.left, 100);
  assert.deepEqual(e.today.kinds.map((k) => k.n), [0, 0, 0, 0, 0, 0], '|| 0(`[11-4]` 설명 한 줄 더)');
  // 종류 목록 밖이라도 0 보다 크면 보인다(11 의 요약·표 …)
  const x = usageView([Object.assign({}, ROW, { byKind: { table: 2 } })], { today: DAY, cap: 9 });
  assert.ok(x.today.kinds.some((k) => k.kind === 'table' && k.n === 2));
});

test('U2 ★ 낭독 번역 효율 — 호출당 평균(정수)·1만 자당(소수 1자리)·calls 0 이면 —', () => {
  const v = usageView([ROW], { today: DAY, cap: 100 });
  assert.equal(v.ra.calls, 6);
  assert.equal(v.ra.chars, 29500);
  assert.equal(v.ra.perCall, 4917, '29500 / 6 = 4916.67 → 4917');
  assert.equal(v.ra.per10k, 2, '6 / 29500 × 10000 = 2.03 → 2.0');
  const r = readalongStats([{ day: DAY, byKind: { readalong: 17 }, charsTranslated: 100000 }]);
  assert.equal(r.per10k, 1.7);
  assert.equal(r.perCall, 5882);
  const z = readalongStats([{ day: DAY, byKind: { readalong: 0 }, charsTranslated: 0 }]);
  assert.equal(z.perCall, null);
  assert.equal(z.per10k, null);
  assert.equal(readalongStats([{ day: DAY, byKind: { readalong: 2 }, charsTranslated: 0 }]).perCall, null, '글자 0 이면 평균 없음');
  assert.equal(usageView([], { today: DAY, cap: 1 }).ra.perCall, null);
});

test('U3 ★ callsPer10k(rows) — 날짜 범위는 호출자가 고른다(13 계획) · 합으로 나눔 · 글자 0·minChars 미만이면 null', () => {
  const rows = [
    { day: '2026-11-01', byKind: { readalong: 10 }, charsTranslated: 50000 },
    { day: '2026-11-02', byKind: { readalong: 7 }, charsTranslated: 50000 },
    { day: '2026-11-03', byKind: { translate: 9 }, charsTranslated: 0 }
  ];
  assert.ok(Math.abs(callsPer10k(rows) - 1.7) < 1e-12, '(10+7) / 100000 × 10000');
  assert.equal(callsPer10k(rows.slice(0, 1)), 2);
  assert.equal(callsPer10k([]), null);
  assert.equal(callsPer10k(null), null);
  assert.equal(callsPer10k([{ day: 'x', byKind: { readalong: 3 } }]), null);
  assert.equal(callsPer10k(rows, { minChars: 30000 }) !== null, true);
  assert.equal(callsPer10k(rows, { minChars: 200000 }), null, '13 계획 — 3만 자 미만이면 기본값을 쓰게 null');
  // usageView 의 1만 자당과 같은 식(반올림만 다름)
  const v = usageView([ROW], { today: DAY, cap: 100 });
  assert.equal(v.ra.per10k, Math.round(callsPer10k([ROW]) * 10) / 10);
});

test('U4 ★ 오늘 상한까지 약 n쪽 — 그 책 쪽당 글자에 반비례(두 스텁 readStats) · pages < 5·평균 없음이면 숨김', () => {
  const row = { day: DAY, calls: 4, byKind: { readalong: 4 }, charsTranslated: 24000 };      // 호출당 6000자
  const a = usageView([row], { today: DAY, cap: 14, doc: { title: 'A', readStats: { pages: 10, chars: 20000 } } });   // 쪽당 2000
  const b = usageView([row], { today: DAY, cap: 14, doc: { title: 'B', readStats: { pages: 10, chars: 40000 } } });   // 쪽당 4000
  assert.equal(a.pages.n, 30, '(14 − 4) × 6000 ÷ 2000');
  assert.equal(b.pages.n, 15, '쪽당 글자 두 배 → 남은 쪽 절반');
  assert.equal(a.pages.perPage, 2000);
  assert.equal(a.pages.title, 'A');
  assert.equal(usageView([row], { today: DAY, cap: 14, doc: { title: 'C', readStats: { pages: MIN_STAT_PAGES - 1, chars: 8000 } } }).pages, null, 'pages < 5 숨김');
  assert.equal(usageView([{ day: DAY, calls: 2, byKind: { translate: 2 } }], { today: DAY, cap: 14, doc: { title: 'A', readStats: { pages: 10, chars: 20000 } } }).pages, null, '평균 없음 숨김');
  assert.equal(usageView([row], { today: DAY, cap: 14, doc: null }).pages, null);
  assert.equal(usageView([row], { today: DAY, cap: 14, doc: { title: 'A' } }).pages, null, 'readStats 없음');
  assert.equal(pagesLeft(0, 6000, { pages: 10, chars: 20000 }).n, 0);
  assert.equal(pagesLeft(-3, 6000, { pages: 10, chars: 20000 }).n, 0);
  // 상한은 검증을 뺀 셈으로 남는다
  const vr = { day: DAY, calls: 6, byKind: { readalong: 4, verify: 2 }, charsTranslated: 24000 };
  assert.equal(usageView([vr], { today: DAY, cap: 14, doc: { title: 'A', readStats: { pages: 10, chars: 20000 } } }).pages.n, 30);
});

test('U5 ★ 이번 달 — 막대 31칸(그달 밖은 out) · 높이는 그날/그달 최대 · 합계·절약·적중률(이번 달만)', () => {
  const rows = [
    { day: '2026-11-01', calls: 4, cacheHits: 2, ondeviceHits: 0 },
    { day: '2026-11-15', calls: 8, cacheHits: 1, ondeviceHits: 1 },
    { day: DAY, calls: 2, cacheHits: 0, ondeviceHits: 0 },
    { day: '2026-10-31', calls: 50, cacheHits: 40, ondeviceHits: 0 }       // 지난달 — 합계에 넣지 않음
  ];
  const v = usageView(rows, { today: DAY, cap: 100 });
  assert.equal(v.month.cells.length, 31);
  assert.equal(v.month.cells.filter((c) => c.out).length, 1, '11월은 30일 → 31번째 칸 out');
  assert.equal(v.month.max, 8);
  assert.equal(v.month.cells[14].h, 1);
  assert.equal(v.month.cells[0].h, 0.5);
  assert.equal(v.month.cells[15].today, true);
  assert.equal(v.month.cells[16].future, true);
  assert.equal(v.month.total, 14);
  assert.equal(v.month.saved, 4);
  assert.equal(v.month.hitRate, 4 / 18);
  assert.equal(usageView([], { today: DAY, cap: 1 }).month.hitRate, null);
  const feb = monthBars([], '2027-02-10');
  assert.equal(feb.cells.filter((c) => c.out).length, 3);
  assert.equal(feb.max, 0);
  assert.ok(feb.cells.every((c) => c.h === 0));
});

test('U6 90일 지난 행 — dayShift 달력 · staleDays 는 날짜 꼴만', () => {
  assert.equal(dayShift('2026-03-01', -1), '2026-02-28');
  assert.equal(dayShift('2026-01-01', -90), '2025-10-03');
  assert.equal(dayShift('nope', 1), null);
  const days = ['2026-08-17', '2026-08-18', '2026-08-19', DAY, 'junk'];
  assert.equal(KEEP_DAYS, 90);
  assert.equal(dayShift(DAY, -90), '2026-08-18');
  assert.deepEqual(staleDays(days, DAY), ['2026-08-17'], '90일 전 날(08-18)은 남긴다');
  assert.deepEqual(staleDays(days, 'x'), []);
});

test('U7 ★ 화면 열 때 지우기(pruneUsage — load 가 부르는 것) — 91일 전만 지우고 90·89일·오늘은 남김 · 지우기 실패는 화면을 막지 않음', async () => {
  // `[8c-2b]` 8c2R #5 — 경계(KEEP_DAYS)가 load() 자리에서 30 으로 바뀌어도 잡히게 89·90·91 일을 함께 둔다.
  const d = (n) => dayShift(DAY, -n);
  const rows = [91, 90, 89, 30, 0].map((n) => ({ day: d(n), calls: n }));
  rows.push({ day: 'not-a-day', calls: 1 });
  const gone = [];
  const r = await pruneUsage(rows, DAY, async (day) => { gone.push(day); });
  assert.deepEqual(gone, [d(91)], '91일 전 하나만');
  assert.equal(r.cleaned, 1);
  assert.deepEqual(r.keep.map((x) => x.day), [d(90), d(89), d(30), DAY, 'not-a-day'], '90·89·30일 전·오늘·날짜 아닌 키는 남김');
  // 지우기가 던져도: 그 행은 화면에서 빼고(다음에 다시), 셈에 넣지 않고, 다른 행은 그대로
  const r2 = await pruneUsage([{ day: d(200) }, { day: d(91) }, { day: DAY }], DAY, async (day) => { if (day === d(200)) throw new Error('locked'); });
  assert.equal(r2.cleaned, 1);
  assert.deepEqual(r2.keep.map((x) => x.day), [DAY]);
  assert.deepEqual((await pruneUsage(null, DAY, async () => {})).keep, []);
});

/* ══════════════════════════════════════════════════════
   W. 80% 경고 — 파이프라인 onWarn
   ══════════════════════════════════════════════════════ */

/** 번역·단어 요청 둘 다 받는 흉내 응답. */
function echoBoth() {
  return (url, init) => {
    const items = docItems(init);
    if (items.length && typeof items[0].term === 'string') {
      const out = items.map((it) => ({ i: it.i, term: it.term, lemma: it.term, pos: 'noun', translation: 'ترجمة ' + it.term, gloss: 'شرح' }));
      return jsonRes(200, geminiOk(JSON.stringify({ items: out, notes: '' })));
    }
    return jsonRes(200, geminiOk(JSON.stringify({ segments: items.map((it) => ({ i: it.i, t: '«' + it.text + '»' })), notes: '' })));
  };
}

function rig(over) {
  const o = over || {};
  const db = o.db || memDb();
  const timers = manualTimers();
  const clock = o.clock || { t: T0 };
  const cache = createCache({ db: db, now: () => clock.t });
  const fetch = o.fetch || stubFetch(echoBoth());
  const p = createPipeline({
    fetch: fetch, db: db, cache: cache, getKey: () => FAKE_KEY,
    getSetting: settingsOf(Object.assign({ 'ai.dailyCap': 10, 'ai.warnAt': 0.8 }, o.settings || {})),
    now: () => clock.t, isOnline: () => true, setTimer: timers.set, clearTimer: timers.clear, listen: false
  });
  const warns = [];
  if (o.listen !== false) p.onWarn((w) => warns.push(w));
  return { p, db, clock, fetch, warns };
}

let seq = 0;
const one = (p, kind) => p.translate(['Sentence number ' + (++seq) + ' about fever.'], { src: 'en', target: 'ar', kind: kind || 'translate', docId: 'd1' });

test('W1 ★ 상한 10 · warnAt 0.8 → 8번째 호출 뒤 한 번, 9·10번째 없음 · 그날 행에 capWarned', async () => {
  const { p, db, warns } = rig();
  for (let i = 1; i <= 7; i++) await one(p);
  assert.equal(warns.length, 0, '7번째까지 없음');
  await one(p);
  assert.equal(warns.length, 1, '8번째 뒤 한 번');
  assert.deepEqual({ used: warns[0].used, cap: warns[0].cap, warnAt: warns[0].warnAt, day: warns[0].day }, { used: 8, cap: 10, warnAt: 0.8, day: DAY });
  assert.equal(db.usageRow(DAY).capWarned, true);
  await one(p);
  await one(p);
  assert.equal(warns.length, 1, '9·10번째 없음');
  assert.equal(p.state(), STATES.READY);
  const r = await one(p);
  assert.equal(r.results[0].code, STATES.CAPPED, '11번째는 상한(보내지 않음)');
  assert.equal(warns.length, 1);
});

test('W2 ★ 같은 날 새 파이프라인(새로고침)도 없음 · 다음 날 다시', async () => {
  const db = memDb();
  const clock = { t: T0 };
  const a = rig({ db, clock });
  for (let i = 0; i < 8; i++) await one(a.p);
  assert.equal(a.warns.length, 1);
  const b = rig({ db, clock });                       // 새로고침 = 새 파이프라인, 같은 DB
  await one(b.p);
  assert.equal(b.warns.length, 0, '그날 행의 capWarned — 하루 한 번');
  clock.t = T0 + 24 * 3600 * 1000;                    // 다음 날
  for (let i = 0; i < 7; i++) await one(b.p);
  assert.equal(b.warns.length, 0);
  await one(b.p);
  assert.equal(b.warns.length, 1, '다음 날 8번째 뒤 다시');
  assert.equal(b.warns[0].day, '2026-11-17');
  assert.equal(db.usageRow('2026-11-17').capWarned, true);
});

test('W3 ★ warnAt 0 · 1 · 1.5 · 문자열 · NaN → 경고 없음 · warnThreshold 규칙', async () => {
  for (const w of [0, 1, 1.5, '0.8', NaN, null, -0.2]) {
    const { p, warns, db } = rig({ settings: { 'ai.warnAt': w } });
    for (let i = 0; i < 10; i++) await one(p);
    assert.equal(warns.length, 0, String(w));
    assert.equal(db.usageRow(DAY).capWarned, undefined, String(w));
  }
  assert.equal(warnThreshold(10, 0.8), 8);
  assert.equal(warnThreshold(10, 0.7), 7, '부동소수 꼬리(7.000000000000001)를 올리지 않는다');
  assert.equal(warnThreshold(3, 0.8), 3, 'ceil(2.4)');
  assert.equal(warnThreshold(1, 0.8), 1);
  assert.equal(warnThreshold(0, 0.8), 1, '상한은 최소 1');
  assert.equal(warnThreshold(10, '0.8'), null);
  assert.equal(dailyCapOf('7.9'), 7);
  assert.equal(dailyCapOf(-3), 1);
  assert.equal(capUsedOf({ calls: 9, byKind: { verify: 4 } }), 5);
  assert.equal(capUsedOf(null), 0);
});

test('W4 ★ 검증 호출은 문턱에 세지 않는다(overCap 과 같은 셈)', async () => {
  const db = memDb();
  await db.put('usage', { day: DAY, calls: 5, byKind: { verify: 5 } });
  const { p, warns } = rig({ db });
  for (let i = 0; i < 7; i++) await one(p);
  assert.equal(warns.length, 0, 'calls 12 지만 상한 셈 7');
  await one(p);
  assert.equal(warns.length, 1);
  assert.equal(warns[0].used, 8);
});

test('W5 ★ 상한 3 → 3번째 호출 뒤 경고 1회 + capped, 4번째 보내지 않음(16-D4)', async () => {
  const { p, warns, fetch } = rig({ settings: { 'ai.dailyCap': 3 } });
  await one(p, 'readalong');
  await one(p, 'readalong');
  assert.equal(warns.length, 0);
  await one(p, 'readalong');
  assert.equal(warns.length, 1, 'ceil(3 × 0.8) = 3');
  const r = await one(p, 'readalong');
  assert.equal(r.results[0].code, STATES.CAPPED);
  assert.equal(fetch.calls.length, 3, '이후 요청 0');
  await one(p);
  assert.equal(warns.length, 1);
});

test('W6 ★ 낭독·탭·단어 요청 어느 길로 넘어도 같은 경고(한 곳)', async () => {
  for (const path of ['readalong', 'translate', 'term']) {
    const { p, warns } = rig();
    for (let i = 0; i < 7; i++) await one(p, i % 2 ? 'readalong' : 'translate');
    assert.equal(warns.length, 0, path);
    if (path === 'term') await p.translateTerms([{ term: 'fever', context: 'Fever ' + (++seq) + ' noted.' }], { src: 'en', target: 'ar', docId: 'd1' });
    else await one(p, path);
    assert.equal(warns.length, 1, path);
    assert.equal(warns[0].used, 8, path);
  }
});

test('W7 ★ 같은 파이프라인의 동시 호출이 문턱을 함께 넘어도 한 번(행 읽기가 겹쳐도)', async () => {
  const db = memDb();
  const get = db.get;
  // 경고 확인(`checkWarn`)의 행 읽기만 늦춰 세 호출의 확인이 **함께** 읽는 중이게 한다(확인과 표시 사이의 틈).
  db.get = async (name, key) => {
    if (name === 'usage' && /checkWarn/.test(String(new Error().stack))) await new Promise((r) => setTimeout(r, 20));
    return get(name, key);
  };
  const { p, warns } = rig({ db });
  for (let i = 0; i < 7; i++) await one(p);
  await Promise.all([one(p), one(p), one(p)]);
  assert.equal(warns.length, 1);
  assert.equal(db.usageRow(DAY).calls, 10);
});

test('W7b ★ 그날 행에 표시를 못 써도(저장 실패) 같은 파이프라인에서는 한 번', async () => {
  const db = memDb();
  const put = db.put;
  db.put = async (name, v) => { if (name === 'usage' && v && v.capWarned) throw new Error('quota'); return put(name, v); };
  const { p, warns } = rig({ db });
  for (let i = 0; i < 10; i++) await one(p);
  assert.equal(warns.length, 1);
  assert.equal(db.usageRow(DAY).capWarned, undefined);
});

test('W8 ★ 구독자가 없으면 행을 건드리지 않고, 요청 본문은 구독자가 있든 없든 바이트 단위 같다', async () => {
  const a = rig({ listen: false });
  const b = rig();
  const sents = [];
  for (let i = 0; i < 10; i++) sents.push('Same sentence ' + i + ' with 3 mg dose.');
  for (const s of sents) {
    await a.p.translate([s], { src: 'en', target: 'ar', docId: 'x' });
    await b.p.translate([s], { src: 'en', target: 'ar', docId: 'x' });
  }
  assert.deepEqual(a.fetch.calls.map((c) => c.init.body), b.fetch.calls.map((c) => c.init.body));
  assert.deepEqual(a.fetch.calls.map((c) => c.url), b.fetch.calls.map((c) => c.url));
  const ra = Object.assign({}, a.db.usageRow(DAY));
  const rb = Object.assign({}, b.db.usageRow(DAY));
  assert.equal(ra.capWarned, undefined, '구독자 없음 — 표시 없음(사용량 행 꼴 HEAD 그대로)');
  assert.equal(rb.capWarned, true);
  delete rb.capWarned;
  assert.deepEqual(ra, rb, '그 밖의 사용량 행은 같다');
  assert.equal(b.warns.length, 1);
});

test('W9 구독자 예외가 번역을 막지 않고 되돌림 함수가 듣기를 끊는다', async () => {
  const { p } = rig({ listen: false });
  const got = [];
  p.onWarn(() => { throw new Error('boom'); });
  const off = p.onWarn((w) => got.push(w));
  off();
  for (let i = 0; i < 8; i++) {
    const r = await one(p);
    assert.equal(r.results[0].state, 'ready');
  }
  assert.equal(got.length, 0);
});

test('W10 ★ 경고 행을 읽은 직후 자정이 지나도 표시는 그날 행에 — 다음 날 8번째 뒤 경고 다시(8c2R #1)', async () => {
  const D0 = '2026-11-16';
  const D1 = '2026-11-17';
  const db = memDb();
  await db.put('usage', { day: D0, calls: 7, byKind: { translate: 7 } });
  const clock = { t: new Date(2026, 10, 16, 23, 59, 59, 900).getTime() };
  const get = db.get;
  let jumped = false;
  // 80% 경고 확인(checkWarn)이 그날 행을 읽은 **직후** 시계를 자정 너머로 — 표시 쓰기는 그 뒤에 일어난다.
  db.get = async (name, key) => {
    const v = await get(name, key);
    if (!jumped && name === 'usage' && /checkWarn/.test(String(new Error().stack))) {
      jumped = true;
      clock.t = new Date(2026, 10, 17, 0, 0, 0, 10).getTime();
    }
    return v;
  };
  const { p, warns } = rig({ db, clock });
  await one(p);
  assert.equal(jumped, true, '시험 장치: checkWarn 안에서 시계가 넘어감');
  assert.equal(warns.length, 1);
  assert.equal(warns[0].day, D0);
  assert.equal(db.usageRow(D0).capWarned, true, '표시는 읽은 그날(D) 행에');
  assert.equal(db.usageRow(D1), undefined, '다음 날 행을 표시만으로 만들지 않는다');
  clock.t = new Date(2026, 10, 17, 9, 0, 0).getTime();
  for (let i = 0; i < 7; i++) await one(p);
  assert.equal(warns.length, 1, '다음 날 7번째까지 없음');
  await one(p);
  assert.equal(warns.length, 2, '다음 날 8번째 뒤 한 번');
  assert.equal(warns[1].day, D1);
  assert.equal(db.usageRow(D1).capWarned, true);
});

test('W11 비동기 구독자가 거절해도 처리 안 된 거절 0 · 번역 그대로 · 다른 구독자는 받음(8c2R #3)', async () => {
  const unhandled = [];
  const onUnhandled = (e) => { unhandled.push(String((e && e.message) || e)); };
  process.on('unhandledRejection', onUnhandled);
  try {
    const { p } = rig({ listen: false });
    let calledAsync = 0;
    const got = [];
    p.onWarn(async () => { calledAsync++; throw new Error('async boom'); });
    p.onWarn((w) => got.push(w.used));
    for (let i = 0; i < 9; i++) {
      const r = await one(p);
      assert.equal(r.results[0].state, 'ready');
    }
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(calledAsync, 1);
    assert.deepEqual(got, [8]);
    assert.deepEqual(unhandled, [], '거절이 파이프라인 밖으로 새지 않는다');
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

/* ══════════════════════════════════════════════════════
   K. cache.stats()
   ══════════════════════════════════════════════════════ */

test('K1 ★ stats() — 수·크기·종류별·가장 오래된 시각, 그리고 아무것도 지우지 않는다', async () => {
  const db = memDb();
  let t = 1000;
  const c = createCache({ db: db, now: () => t, limitBytes: () => 1 });     // 상한 1바이트여도 stats 는 정리하지 않는다
  await db.putAll('aiCache', [
    { key: 'a', kind: 'translate', docId: 'd', targetLang: 'ar', result: 'x', createdAt: 500, sizeBytes: 10 },
    { key: 'b', kind: 'translate', docId: 'd', targetLang: 'ar', result: 'y', createdAt: 700, sizeBytes: 20 },
    { key: 'c', kind: 'term', docId: 'd', targetLang: 'ar', result: { translation: 'z' }, createdAt: 900, sizeBytes: 30 }
  ]);
  const before = JSON.stringify(Array.from(db.stores.get('aiCache').entries()));
  const s = await c.stats();
  assert.equal(s.count, 3);
  assert.equal(s.bytes, 60);
  assert.deepEqual(s.byKind, { translate: 2, term: 1 });
  assert.equal(s.oldestAt, 500);
  assert.equal(JSON.stringify(Array.from(db.stores.get('aiCache').entries())), before, '읽기만');
  assert.equal(c._total(), 60, '셈만 맞춘다');
  const e = await createCache({ db: memDb() }).stats();
  assert.deepEqual(e, { count: 0, bytes: 0, byKind: {}, oldestAt: null });
  t = 2000;
});

/* ══════════════════════════════════════════════════════
   S. 배선 · 문구 · 16-J
   ══════════════════════════════════════════════════════ */

test('S1 ★ capped 배너에 [사용량 보기](#/usage) — [번역 설정] 은 그대로 앞', () => {
  const b = remoteBanner('capped', { cap: 3 });
  assert.deepEqual(b.actions.map((a) => a.nav), ['#/settings/ai', '#/usage']);
  assert.equal(b.actions[1].key, 'usage.open');
  for (const s of ['offline', 'exhausted', 'cooldown', 'region', 'model', 'no-key']) {
    const x = remoteBanner(s, { providerLabel: 'G' });
    assert.ok(!(x.actions || []).some((a) => a.nav === '#/usage'), s + ' 에는 붙이지 않는다');
  }
});

test('S2 ★ i18n — 자리표시 키 2개는 없고, usage.*·ai.capWarn 이 4언어에(자리표시자 같음)', () => {
  const need = ['ai.capWarn', 'usage.title', 'usage.open', 'usage.calls', 'usage.left', 'usage.ra', 'usage.ra.none', 'usage.pagesLeft',
    'usage.blocked429', 'usage.month.sum', 'usage.cache.sum', 'usage.cache.toSettings', 'usage.studio', 'usage.cleaned', 'usage.error'];
  for (const k of SHOW_KINDS) need.push('usage.kind.' + k);
  for (const lang of LANGS) {
    assert.equal(BUNDLES[lang]['usage.placeholder.title'], undefined, lang);
    assert.equal(BUNDLES[lang]['usage.placeholder.body'], undefined, lang);
    for (const k of need) assert.ok(typeof BUNDLES[lang][k] === 'string' && BUNDLES[lang][k], lang + ' ' + k);
    for (const p of ['{pct}', '{used}', '{cap}']) assert.ok(BUNDLES[lang]['ai.capWarn'].includes(p), lang + ' capWarn ' + p);
  }
  const usageKeys = Object.keys(BUNDLES.en).filter((k) => k.startsWith('usage.'));
  assert.ok(usageKeys.length >= 25, '약 25키 — ' + usageKeys.length);
});

test('S3 ★ 배선 — controls 가 onWarn → ai.capWarn 배너, main 이 #/usage 를 그리고, 입구 둘(설정 · 배너)', () => {
  const controls = src('../js/ui/controls.js');
  assert.match(controls, /pipeline\.onWarn\(/);
  assert.match(controls, /key: 'ai\.capWarn'/);
  assert.equal((controls.match(/createPipeline\(/g) || []).length, 1, '파이프라인은 하나 — 낭독·탭·단어 시트·단어장이 같은 것');
  const main = src('../js/main.js');
  assert.match(main, /case 'usage': showUsage\(\)/);
  assert.match(main, /initUsage\(\)/);
  const html = src('../index.html');
  assert.ok(!html.includes('usage.placeholder'), '자리표시 섹션을 바꿨다');
  assert.match(html, /data-nav="#\/usage" data-i18n="usage\.open"/, '설정 AI 탭 입구');
  assert.match(html, /data-nav="#\/settings\/cache"/, '[설정에서 비우기]');
  const settingsUi = src('../js/ui/settings.js');
  assert.match(settingsUi, /params\.tab === 'cache'/);
});

test('S4 ★ 사용량 화면은 호출 0 — usage.js 가 pipeline·fetch·complete 를 부르지 않는다 · innerHTML 0', () => {
  const u = src('../js/ui/usage.js');
  assert.ok(!/\bfetch\(/.test(u));
  assert.ok(!/\.complete\(|\.translate\(|translateTerms|createPipeline|runJob/.test(u));
  assert.ok(!/\.innerHTML\b/.test(u));
});

test('S5 ★ 16-J — 무료 티어 한도 숫자 없음(사용량 화면·문구·파이프라인)', () => {
  const files = ['../js/ui/usage.js', '../js/ai/pipeline.js', '../js/i18n/ko.js', '../js/i18n/en.js', '../js/i18n/fr.js', '../js/i18n/ar.js', '../index.html'];
  for (const f of files) {
    const s = src(f);
    assert.ok(!/\b\d+\s*(RPM|RPD|TPM)\b/i.test(s), f + ' RPM/RPD 숫자');
    assert.ok(!/\b(1500|1,500|250|15)\s*(requests|calls|회|طلب)/i.test(s), f + ' 무료 한도 숫자');
  }
});
