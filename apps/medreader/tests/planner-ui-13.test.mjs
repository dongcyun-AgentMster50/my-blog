/* ============================================================
   tests/planner-ui-13.test.mjs — 13-2 학습 계획 화면 `#/planner` · 서재 "오늘" 줄 시험 줄 (spec 17-12 5 · 7 "13-2" · 9 결정 13-D7~D14)

   P1  라우트 `#/planner` · plannerHash · SCREENS · 섹션 하나 · main.js 배선 · 서재 "오늘" 줄 입구 · 설정 `reading.track` 줄
   P2  순수 — normExam(기본값·꼴) · examsOf(최대 5) · sortExams/nearestExam(가까운 것) · chapterRanges(위 두 깊이·같거나 얕은 다음 항목) ·
        examFromForm(검사·기본값) · resolveTargets(docId → fileHash → 없음)
   P3  ★ 화면 숫자 = planFor — planInputOf(복습 분 = reviewMinutes · 낭독 몫 = 하루 − 복습 · 사용량 34회·200,000자 → 1만 자당 1.7 실측) →
        planFor → examView 의 숫자가 plan 그대로(검색 글자→낭독 글자 계수 0.9 로도 — 자체 계산이면 어긋나는 입력)
   P4  ★ 상태 — 시험일 어제 → past(필요·호출 줄 없음) · 범위 다 읽음 → done · 상한 3·1.7·하루 300분 → overCap(설정 키는 바꾸지 않음 — P7 정적)
   P5  ★ 9c — 기기 A 의 시험(범위 docId·fileHash) 백업 → 기기 B(같은 PDF 다른 id): 설정 값 그대로, 화면이 fileHash 로 B 를 찾아 계산
   P6  서재 "오늘" 줄 — 시험 둘 → 가까운 것(날 수 = planFor calendarDays) · 지난 것만 → past · 없음 → null
   P7  정적 — ui/planner.js: innerHTML 0 · confirm( 0 · fetch 0 · ai/* import 0 · settings.set 은 'planner.exams' 하나 · 4언어 키 ·
        "점수"·"합격"·score·pass chance 0(13-2 키) · 고지 한 줄 · CSS
   P8  planFor 더함 — textToSpoken · calendarDays · progress.readPct/needCount · dayRead
   지어낸 글자만. 실제 키·실제 호출 없음.
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

let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; throw new Error('호출 금지'); };

const db = await import('../js/db.js');
const R = await import('../js/router.js');
const P = await import('../js/plan/planner.js');
const U = await import('../js/ui/planner.js');
const { exportBackup } = await import('../js/backup/export.js');
const IM = await import('../js/backup/import.js');
const { PLAN } = await import('../js/config.js');
const { DEFAULTS } = await import('../js/settings.js');
const { BUNDLES, LANGS } = await import('../js/i18n/index.js');

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
function strip(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'); }
const TODAY = '2026-11-17';
const T0 = new Date(2026, 10, 17, 9, 0, 0).getTime();

async function reset() { for (const s of db.STORE_NAMES) await db.clearStore(s); }

/* ── 공통 입력 ─────────────────────────────────────────── */
const DOC = { id: 'd1', title: 'Book One', fileHash: 's256:p:1:aaa', pageCount: 40, readStats: { pages: 10, chars: 40000 } };
function pageChars() {
  const m = {};
  for (let p = 5; p <= 24; p++) if (p !== 20) m[p] = 4000 + p * 10;   // 20쪽은 안 셈(평균으로)
  return { d1: m };
}
const EXAM = { id: 'e1', name: 'Cardio', date: '2026-11-27', minutesPerDay: 60, weekdays: [0, 1, 2, 3, 4, 5, 6], reserve: 0,
  targets: [{ docId: 'd1', fileHash: DOC.fileHash, from: 5, to: 24, label: 'Ch 2' }], createdAt: 1, updatedAt: 1 };
function ctx(over) {
  return Object.assign({
    today: TODAY, docs: [DOC], pageChars: pageChars(), readRanges: { d1: [[5, 6]] },
    log: { v: 1, days: { '2026-11-16': { both: { ms: 40 * 60000, chars: 16000, rateMs: 40 * 60000 } }, [TODAY]: { both: { ms: 7 * 60000 + 20000, chars: 2000, rateMs: 7 * 60000 + 20000 }, pages: 2 } } },
    srsLog: {}, counts: { due: 10, fresh: 5 },
    rows30: [{ day: '2026-11-10', byKind: { readalong: 34 }, charsTranslated: 200000 }],
    capSetting: 100, mode: 'speak', speakSource: true, rate: 1
  }, over || {});
}

/* ══ P1 ═════════════════════════════════════════════════ */
test('P1 라우트 `#/planner` · plannerHash · SCREENS · 섹션 · main.js · 서재 입구 · 설정 줄', () => {
  assert.ok(R.SCREENS.includes('planner'));
  assert.deepEqual(R.parseRoute('#/planner'), { name: 'planner', params: {}, raw: '#/planner' });
  assert.equal(R.parseRoute(R.plannerHash()).name, 'planner');
  assert.equal(R.parseRoute('#/plannerz').name, 'library');
  const html = src('../index.html');
  assert.equal((html.match(/data-screen="planner"/g) || []).length, 1);
  for (const id of ['plList', 'plAdd', 'plForm', 'plName', 'plDate', 'plMinutes', 'plDays', 'plReserve', 'plBook', 'plMode', 'plChapter', 'plFrom', 'plTo', 'plDelDialog', 'plDisclaimer']) {
    assert.ok(html.includes('id="' + id + '"'), id);
  }
  assert.ok(/id="plDisclaimer" data-i18n="planner\.disclaimer"/.test(html), '고지 한 줄');
  assert.ok(/<input type="date" class="pl-input" id="plDate">/.test(html), '날짜 칸');
  const main = src('../js/main.js');
  assert.ok(main.includes("import { initPlanner, showPlanner, leavePlanner } from './ui/planner.js';"));
  assert.ok(/initPlanner\(\);/.test(main) && /case 'planner': showPlanner\(\); break;/.test(main) && /if \(route\.name !== 'planner'\) leavePlanner\(\);/.test(main));
  const lib = src('../js/ui/library.js');
  assert.ok(lib.includes("import { libraryExamLine } from './planner.js';"));
  assert.ok(/b\.setAttribute\('data-nav', '#\/planner'\)/.test(lib), '입구 [계획]/[시험 계획 세우기]');
  assert.ok(/t\(ex \? 'planner\.open' : 'planner\.setup'\)/.test(lib));
  const st = src('../js/ui/settings.js');
  assert.ok(/settings\.set\('reading\.track', !!els\.readingTrack\.checked\)/.test(st));
  assert.ok(/els\.readingTrack\.checked = settings\.get\('reading\.track'\) !== false/.test(st));
});

/* ══ P2 ═════════════════════════════════════════════════ */
test('P2 순수 — normExam · examsOf · sortExams/nearestExam · chapterRanges · examFromForm · resolveTargets', () => {
  const n = U.normExam({ id: 'x', name: '  A   b ', date: '2026-12-01', minutesPerDay: 5, weekdays: [6, 1, 1, 9, 'x'], reserve: 99, targets: [{ docId: 'd', from: 9, to: 3 }, { docId: '', from: 1 }, { docId: 'd', from: -4, to: 0 }] });
  assert.deepEqual(n, { id: 'x', name: 'A b', date: '2026-12-01', minutesPerDay: 10, weekdays: [1, 6], reserve: 14,
    targets: [{ docId: 'd', fileHash: '', from: 3, to: 9, label: '' }], createdAt: 0, updatedAt: 0 });
  assert.equal(U.normExam({ id: 'x', date: '2026-02-30' }), null, '없는 날');
  assert.deepEqual(U.normExam({ id: 'y', date: '2026-12-01' }).weekdays, [0, 1, 2, 3, 4, 5, 6], '요일 없으면 매일');
  assert.equal(U.normExam({ id: 'y', date: '2026-12-01' }).minutesPerDay, 60);
  const six = Array.from({ length: 7 }, (_, i) => ({ id: 'e' + i, name: 'E' + i, date: '2026-12-0' + (i + 1) }));
  assert.equal(U.examsOf(six).length, PLAN.EXAMS_MAX);
  assert.deepEqual(U.examsOf('x'), []);
  const list = U.examsOf([{ id: 'a', date: '2026-12-20' }, { id: 'b', date: '2026-11-20' }, { id: 'c', date: '2026-11-10' }, { id: 'd', date: '2026-11-01' }, { id: 'e', date: TODAY }]);
  assert.deepEqual(U.sortExams(list, TODAY).map((e) => e.id), ['b', 'a', 'e', 'c', 'd'], '앞으로 가까운 것 → 지난 것(최근 먼저)');
  assert.equal(U.nearestExam(list, TODAY).id, 'b');
  assert.equal(U.nearestExam([], TODAY), null);
  // 장 — 위 두 깊이, 끝 = 같거나 얕은 다음 항목 − 1
  const toc = { items: [{ t: 'Front', p: null, d: 1 }, { t: 'Ch 1', p: 3, d: 1 }, { t: '1.1', p: 3, d: 2 }, { t: '1.2', p: 7, d: 2 }, { t: '1.2.a', p: 8, d: 3 },
    { t: 'Ch 2', p: 12, d: 1 }, { t: '2.1', p: 15, d: 2 }, { t: '', p: 16, d: 2 }] };
  assert.deepEqual(U.chapterRanges(toc, 30), [
    { title: 'Ch 1', from: 3, to: 11, d: 0 }, { title: '1.1', from: 3, to: 6, d: 1 }, { title: '1.2', from: 7, to: 11, d: 1 },
    { title: 'Ch 2', from: 12, to: 30, d: 0 }, { title: '2.1', from: 15, to: 30, d: 1 }]);
  assert.deepEqual(U.chapterRanges(null, 10), []);
  assert.deepEqual(U.chapterRanges({ items: [{ t: 'H', p: 4, d: 1 }, { t: 'I', p: 2, d: 1 }] }, 10), [{ title: 'H', from: 4, to: 10, d: 0 }, { title: 'I', from: 2, to: 10, d: 0 }], '쪽이 뒤로 가는 폴백 — 끝은 문서 끝');
  // 폼
  assert.deepEqual(U.examFromForm({ name: '', date: '2026-12-01', targets: [{ docId: 'd', from: 1, to: 2 }] }), { ok: false, err: 'planner.err.name' });
  assert.deepEqual(U.examFromForm({ name: 'A', date: '12/01/2026', targets: [{ docId: 'd', from: 1, to: 2 }] }), { ok: false, err: 'planner.err.date' });
  assert.deepEqual(U.examFromForm({ name: 'A', date: '2026-12-01', targets: [] }), { ok: false, err: 'planner.err.ranges' });
  const f = U.examFromForm({ name: 'x'.repeat(80), date: '2026-12-01', minutesPerDay: '900', reserve: '-3', weekdays: [5, 1], targets: [{ docId: 'd', fileHash: 'h', from: 4, to: 2, label: 'L' }] }, { id: 'keep', createdAt: 5 }, 99);
  assert.equal(f.ok, true);
  assert.deepEqual(f.exam, { id: 'keep', name: 'x'.repeat(60), date: '2026-12-01', minutesPerDay: 600, weekdays: [1, 5], reserve: 0,
    targets: [{ docId: 'd', fileHash: 'h', from: 2, to: 4, label: 'L' }], createdAt: 5, updatedAt: 99 });
  assert.ok(U.examFromForm({ name: 'n', date: '2026-12-01', targets: [{ docId: 'd', from: 1 }] }, null, 7).exam.id.startsWith('ex'), '새 id');
  // 책 찾기 — docId → fileHash → 없음
  const docs = [{ id: 'B', fileHash: 'h1' }, { id: 'C', fileHash: 'h2' }];
  const r = U.resolveTargets([{ docId: 'B', fileHash: 'zz', from: 1, to: 2 }, { docId: 'A', fileHash: 'h2', from: 3, to: 4 }, { docId: 'Q', fileHash: 'h9', from: 5, to: 6 }, { docId: 'Q', fileHash: '', from: 7, to: 7 }], docs);
  assert.deepEqual(r.map((x) => [x.docId, x.missing, x.savedId]), [['B', false, 'B'], ['C', false, 'A'], [null, true, 'Q'], [null, true, 'Q']]);
});

/* ══ P3 ═════════════════════════════════════════════════ */
test('P3 ★ 화면 숫자 = planFor — 복습 분을 빼고 · 사용량 1.7 실측 · 계수 0.9 로도 같은 값', () => {
  const c = ctx();
  const pi = U.planInputOf(U.normExam(EXAM), c);
  // 입력 — 복습 분(13-D13) · 1만 자당 실측 · 속도 실측(40분 ≥ 30분)
  const wantReview = P.reviewMinutes(15, {}, TODAY);
  assert.equal(wantReview, 2);
  assert.equal(pi.input.reviewMinToday, wantReview, '복습 분을 넘긴다');
  assert.equal(pi.reviewCount, 15);
  assert.equal(pi.calls.source, 'measured', 'readalong 34회 · 200,000자 → 실측');
  assert.ok(Math.abs(pi.calls.value - 1.7) < 1e-9, '1만 자당 1.7');
  assert.equal(pi.speed.source, 'measured');
  assert.equal(pi.bucket, 'both');
  assert.equal(pi.input.cap, 100);
  assert.equal(pi.input.textToSpoken, PLAN.TEXT_TO_SPOKEN);
  assert.deepEqual(pi.input.targets, [{ docId: 'd1', from: 5, to: 24 }]);
  const plan = P.planFor(pi.input);
  assert.equal(plan.readMinPerDay, 60 - wantReview, '낭독 몫 = 하루 − 복습');
  const v = U.examView(plan, pi, { log: c.log, today: TODAY });
  const check = (pl, vw, p) => {
    assert.deepEqual(vw.days, { n: pl.calendarDays, m: pl.days });
    assert.equal(vw.status, pl.status);
    assert.equal(vw.need.n, pl.needMinPerDay);
    assert.deepEqual([vw.finish.m, vw.finish.k, vw.finish.read, vw.finish.date, vw.finish.slack],
      [p.input.minutesPerDay, p.input.reviewMinToday, pl.readMinPerDay, pl.finishDay, pl.slackDays]);
    assert.deepEqual([vw.calls.c, vw.calls.d, vw.calls.cap], [pl.calls, pl.callsPerDay, p.input.cap]);
    assert.deepEqual([vw.progress.pct, vw.progress.x, vw.progress.y, vw.progress.left, vw.progress.counted, vw.progress.needCount],
      [pl.progress.readPct, pl.progress.readPages, pl.progress.pages, pl.remaining, pl.progress.counted, pl.progress.needCount]);
    assert.equal(vw.todayRead.y, pl.readMinPerDay);
    assert.deepEqual(vw.today, P.todayRange(p.input.targets, p.input.pageChars, p.input.readRanges, pl.dayChars, p.input.docStats));
    assert.equal(vw.overCap, pl.overCap);
  };
  check(plan, v, pi);
  assert.equal(plan.calendarDays, 10);
  assert.equal(plan.days, 10);
  assert.equal(v.today[0].from, 7, '읽은 5–6쪽 다음부터');
  assert.deepEqual(v.todayRead, { x: 7, y: 58 }, '오늘 낭독 7분 20초 → 7분');
  assert.deepEqual(v.calls.rate, 1.7);
  assert.equal(v.progress.x, 2);
  assert.equal(v.progress.y, 20);
  assert.equal(v.progress.counted, 19);
  assert.equal(v.progress.needCount, false, '19/20 = 95% — 세기 단추 없음');
  assert.deepEqual(v.ranges, [{ missing: false, docId: 'd1', label: 'Ch 2', from: 5, to: 24, readPages: 2, pages: 20 }]);
  // 계수 0.9(검색 → 낭독) — 자체 계산(남은 글자 ÷ 속도 ÷ 날)이면 어긋나는 입력에서도 같은 값
  const pi2 = Object.assign({}, pi, { input: Object.assign({}, pi.input, { textToSpoken: 0.9 }) });
  const plan2 = P.planFor(pi2.input);
  assert.notEqual(plan2.needMinPerDay, Math.ceil(plan2.remaining / pi2.input.speed / plan2.days), '전제: 자체 계산은 다르다');
  check(plan2, U.examView(plan2, pi2, { log: c.log, today: TODAY }), pi2);
  // 부동소수 찌꺼기(100000 × 1.7 ÷ 10000) — 화면도 17
  const pi3 = U.planInputOf(U.normExam(Object.assign({}, EXAM, { targets: [{ docId: 'd1', from: 1, to: 25 }] })),
    ctx({ pageChars: { d1: Object.fromEntries(Array.from({ length: 25 }, (_, i) => [i + 1, 4000])) }, readRanges: { d1: [] } }));
  const plan3 = P.planFor(pi3.input);
  assert.equal(plan3.remaining, 100000);
  assert.equal(plan3.calls, 17);
  assert.equal(U.examView(plan3, pi3, { log: c.log, today: TODAY }).calls.c, 17);
  // 번역 끔(show) → src 갈래 → 호출 줄 없음
  const pi4 = U.planInputOf(U.normExam(EXAM), ctx({ mode: 'show' }));
  assert.equal(pi4.bucket, 'src');
  assert.equal(U.examView(P.planFor(pi4.input), pi4, { log: c.log, today: TODAY }).calls, null);
  // 사용량 없음 → 1.7 기본 · 실측 3만 자 미만 → 기본
  assert.deepEqual(U.planInputOf(U.normExam(EXAM), ctx({ rows30: [] })).calls, { value: 1.7, source: 'default' });
  assert.deepEqual(U.planInputOf(U.normExam(EXAM), ctx({ rows30: [{ day: '2026-11-10', byKind: { readalong: 9 }, charsTranslated: 29999 }] })).calls.source, 'default');
  // 복습 분이 하루를 다 먹으면 낭독 0 · 상태 short
  const pi5 = U.planInputOf(U.normExam(Object.assign({}, EXAM, { minutesPerDay: 10 })), ctx({ counts: { due: 100, fresh: 0 } }));
  const plan5 = P.planFor(pi5.input);
  assert.equal(plan5.readMinPerDay, 0);
  assert.equal(U.examView(plan5, pi5, { log: c.log, today: TODAY }).finish.read, 0);
  assert.equal(plan5.status, 'short');
  assert.equal(fetchCalls, 0);
});

/* ══ P4 ═════════════════════════════════════════════════ */
test('P4 ★ 상태 — past · done · overCap(상한 3·1.7·하루 300분)', () => {
  const past = U.planInputOf(U.normExam(Object.assign({}, EXAM, { date: '2026-11-16' })), ctx());
  const pp = P.planFor(past.input);
  assert.equal(pp.status, 'past');
  const pv = U.examView(pp, past, { log: {}, today: TODAY });
  assert.equal(pv.need, null);
  assert.equal(pv.calls, null);
  assert.deepEqual(pv.today, []);
  assert.equal(pv.days.n, -1);
  const done = U.planInputOf(U.normExam(EXAM), ctx({ readRanges: { d1: [[1, 40]] } }));
  const dp = P.planFor(done.input);
  assert.equal(dp.status, 'done');
  const dv = U.examView(dp, done, { log: {}, today: TODAY });
  assert.equal(dv.need, null);
  assert.equal(dv.progress.pct, 100);
  const oc = U.planInputOf(U.normExam(Object.assign({}, EXAM, { minutesPerDay: 300, targets: [{ docId: 'd1', from: 1, to: 40 }] })), ctx({ capSetting: 3, counts: { due: 0, fresh: 0 }, log: {} }));
  const op = P.planFor(oc.input);
  assert.equal(oc.input.cap, 3);
  assert.equal(op.overCap, true, '370 × 300 × 1.7 ÷ 10000 = 18.9 > 3 × 0.8');
  assert.equal(U.examView(op, oc, { log: {}, today: TODAY }).overCap, true);
  const ok = U.planInputOf(U.normExam(EXAM), ctx({ capSetting: 100 }));
  assert.equal(U.examView(P.planFor(ok.input), ok, { log: {}, today: TODAY }).overCap, false);
});

/* ══ P5 ═════════════════════════════════════════════════ */
test('P5 ★ 9c — 다른 기기(같은 PDF·다른 id)에서 시험 범위를 fileHash 로 찾는다', async () => {
  await reset();
  await db.put('documents', { id: 'devA', title: 'A', pageCount: 40, fileHash: 's256:p:1:aaa', addedAt: T0, lastOpenedAt: T0 });
  await db.put('progress', { docId: 'devA', sectionId: '@read', ranges: [[5, 6]], pages: 2, updatedAt: T0 });
  const exam = Object.assign({}, EXAM, { targets: [{ docId: 'devA', fileHash: 's256:p:1:aaa', from: 5, to: 24, label: 'Ch 2' }] });
  await db.put('settings', { key: 'planner.exams', value: [exam] });
  const ex = await exportBackup({ now: T0 + 1000, gzip: false });
  const file = new File([ex.blob], ex.name);
  await reset();
  await db.put('documents', { id: 'devB', title: 'A', pageCount: 40, fileHash: 's256:p:1:aaa', addedAt: T0, lastOpenedAt: T0 });
  const r = await IM.importBackup(file, { now: T0 + 5000, defaults: DEFAULTS });
  assert.equal(r.ok, true);
  const saved = (await db.get('settings', 'planner.exams')).value;
  assert.equal(saved[0].targets[0].docId, 'devA', '9c 무변 — 설정 값은 그대로');
  const docs = [await db.get('documents', 'devB')];
  const res = U.resolveTargets(U.examsOf(saved)[0].targets, docs);
  assert.deepEqual([res[0].docId, res[0].missing], ['devB', false]);
  const { readLogStore } = await import('../js/plan/readlog.js');
  const pi = U.planInputOf(U.examsOf(saved)[0], ctx({ docs: docs, pageChars: { devB: pageChars().d1 }, readRanges: { devB: await readLogStore.readRanges('devB') } }));
  assert.deepEqual(pi.input.targets, [{ docId: 'devB', from: 5, to: 24 }]);
  const plan = P.planFor(pi.input);
  assert.equal(plan.progress.readPages, 2, '가져온 @read 도 함께');
  // fileHash 가 없는(옛) 범위는 찾지 못함 → 빠짐(missing)
  const old = U.resolveTargets([{ docId: 'devA', fileHash: '', from: 1, to: 2 }], docs);
  assert.equal(old[0].missing, true);
  assert.equal(fetchCalls, 0);
});

/* ══ P6 ═════════════════════════════════════════════════ */
test('P6 서재 "오늘" 줄 — 시험 둘 → 가까운 것 · 지난 것만 → past · 없음 → null', () => {
  const two = [{ id: 'far', name: 'Far', date: '2026-12-20' }, { id: 'near', name: 'Near', date: '2026-11-27' }];
  const l = U.libraryExamLine(two, TODAY);
  assert.equal(l.exam.id, 'near');
  assert.equal(l.days, 10);
  assert.equal(l.past, false);
  const p = U.libraryExamLine([{ id: 'old', name: 'Old', date: '2026-11-01' }], TODAY);
  assert.equal(p.past, true);
  assert.equal(U.libraryExamLine([], TODAY), null);
  assert.equal(U.libraryExamLine(undefined, TODAY), null);
});

/* ══ P7 정적 ═════════════════════════════════════════════ */
test('P7 정적 — 호출 길 0 · 쓰는 설정은 planner.exams 하나 · innerHTML 0 · 4언어 키 · 금지 문구 0 · CSS', () => {
  const s = strip(src('../js/ui/planner.js'));
  for (const bad of ['innerHTML', 'confirm(', 'fetch(', 'XMLHttpRequest', "from '../ai/"]) assert.ok(!s.includes(bad), bad);
  const sets = [...s.matchAll(/settings\.set\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert.ok(sets.length >= 2);
  assert.deepEqual([...new Set(sets)], ['planner.exams'], '상한·모드를 바꾸지 않는다(13-D10)');
  assert.ok(!/settings\.(reset|set)\((?!'planner\.exams')/.test(s));
  assert.ok(!/db\.(put|patch|del)\(/.test(s), 'DB 에 직접 쓰지 않는다(markRead·백필은 서비스)');
  const imports = [...src('../js/ui/planner.js').matchAll(/^import [^;]*? from '([^']+)';/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['../config.js', '../db.js', '../i18n/index.js', '../plan/planner.js', '../plan/readlog.js', '../router.js',
    '../search/engine.js', '../search/outline.js', '../settings.js', '../srs/cards.js', './rangepick.js', './usage.js']);   // `[15-2]` 범위 고르기 옮김
  // 4언어 키 — 쓰는 키가 다 있고, 결과 예측 문구 없음
  const used = new Set([...src('../js/ui/planner.js').matchAll(/'((?:planner|library\.todayExam|settings\.reading)[a-zA-Z.]*)'/g)].map((m) => m[1]));
  for (const m of src('../index.html').matchAll(/data-i18n="(planner\.[a-zA-Z.]+)"/g)) used.add(m[1]);
  for (const k of ['planner.open', 'planner.setup', 'library.todayExam', 'library.todayExam.past', 'settings.reading.track', 'settings.reading.track.help']) used.add(k);
  used.delete('planner.exams');
  assert.ok(used.size >= 60, String(used.size));
  const FORBID = /점수|합격|\bscore|pass chance|\bpass\b|réussite|نجاح|درجة|احتمال/i;
  for (const lang of LANGS) {
    for (const k of used) assert.ok(typeof BUNDLES[lang][k] === 'string' && BUNDLES[lang][k], lang + ' ' + k);
    for (const k of Object.keys(BUNDLES[lang])) {
      if (!/^(planner\.|library\.todayExam|settings\.reading\.)/.test(k)) continue;
      assert.ok(!FORBID.test(BUNDLES[lang][k]), lang + ' ' + k + ' 결과 예측 문구');
    }
  }
  assert.equal(BUNDLES.ko['planner.disclaimer'], '읽기 시간만 계획합니다 — 시험 결과를 예측하지 않습니다.');
  const css = src('../css/screens.css');
  for (const sel of ['.pl-chip[aria-pressed="true"]', '.pl-input {', '.planner-screen [hidden]', '.lib-today-extra button', '.pl-fix summary']) assert.ok(css.includes(sel), sel);
  assert.ok(/\.pl-chip \{[^}]*min-inline-size: var\(--tap\)/.test(css), '칩 48px');
  assert.ok(!/margin-left|margin-right|padding-left|padding-right|text-align: (left|right)/.test(css.slice(css.indexOf('[13-2 — spec 17-12 5]'))), '논리 속성만');
});

/* ══ P8 planFor 더함 ═════════════════════════════════════ */
test('P8 planFor — textToSpoken · calendarDays · readPct/needCount · dayRead', () => {
  const base = { today: TODAY, exam: '2026-11-27', minutesPerDay: 60, speed: 370, callsPer10k: 1.7, cap: 100, remaining: 180000 };
  const a = P.planFor(base);
  const b = P.planFor(Object.assign({}, base, { textToSpoken: 1 }));
  assert.deepEqual(a, b, '1 이면 전과 같다');
  const c = P.planFor(Object.assign({}, base, { textToSpoken: 0.9 }));
  assert.equal(c.needMinPerDay, Math.ceil(Math.round(180000 / (370 / 0.9) / 10 * 1e6) / 1e6), '검색 글자 ÷ (낭독 속도 ÷ 0.9)');
  assert.equal(c.needMinPerDay, 44);
  assert.equal(c.calls, Math.ceil(180000 * 0.9 * 1.7 / 10000), '호출은 낭독 글자로');
  assert.equal(c.callsPerDay, a.callsPerDay, '하루 호출 = 속도 × 분 × 1.7 그대로');
  assert.equal(c.dayChars, Math.round(370 / 0.9 * 60), '하루 검색 글자');
  assert.equal(P.planFor(Object.assign({}, base, { textToSpoken: 0 })).needMinPerDay, a.needMinPerDay, '0·이상한 값은 1');
  assert.equal(a.calendarDays, 10);
  assert.equal(P.planFor(Object.assign({}, base, { exam: '2026-11-10' })).calendarDays, -7);
  assert.equal(P.planFor(Object.assign({}, base, { exam: 'x' })).calendarDays, null);
  const t = P.planFor({ today: TODAY, exam: '2026-11-27', minutesPerDay: 60, speed: 370, targets: [{ docId: 'd', from: 1, to: 20 }],
    pageChars: { d: Object.fromEntries(Array.from({ length: 18 }, (_, i) => [i + 1, 1000])) }, readRanges: { d: [[1, 3]] } });
  assert.deepEqual([t.progress.readPct, t.progress.counted, t.progress.pages, t.progress.needCount], [15, 18, 20, true], '18/20 = 90% < 95%');
  const t2 = P.planFor({ today: TODAY, exam: '2026-11-27', minutesPerDay: 60, speed: 370, targets: [], pageChars: {}, readRanges: {} });
  assert.equal(t2.progress.readPct, 100);
  assert.equal(t2.progress.needCount, false);
  assert.deepEqual(P.dayRead({ v: 1, days: { [TODAY]: { src: { ms: 60000, chars: 1, rateMs: 1 }, tr: { ms: 89999, chars: 1, rateMs: 1 }, pages: 3 } } }, TODAY), { ms: 149999, min: 2, pages: 3 });
  assert.deepEqual(P.dayRead(null, TODAY), { ms: 0, min: 0, pages: 0 });
  assert.equal(PLAN.TEXT_TO_SPOKEN, 1, '실측 0.966 — 5% 문턱 안(spec 17-12 2)');
  // 순수 그대로
  const ps = strip(src('../js/plan/planner.js'));
  for (const bad of ['Date', 'document', 'window']) assert.ok(!ps.includes(bad), bad);
});
