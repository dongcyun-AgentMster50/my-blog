/* ============================================================
   tests/readlog-13.test.mjs — 13-1 낭독 기록 · 읽은 쪽 · speaker `pagedone` (spec 17-12 4 · 7 "13-1" 수용 기준 — fake-idb)

   L1  ★ 가짜 speaker·가짜 시계 — speaking 60초 동안 단위 넷(글자 합 400) → 그날 both.ms 60000·chars 400 · rateMs = 속도 × ms
   L2  ★ 빼는 시간 — paused 동안 0 · 반복 켜짐 동안 0(글자도) · linechange 사이 5분 → 120초만 · 같은 index 재시작 글자 0 ·
        표 안내(src null)는 시간만 · 갈래는 그때의 bucketOf
   L3  ★ 쓰기 횟수 — linechange 로는 0 · 60초마다 · 멈춤 · 숨김 · 떠남에서만(쪽 넘김 대기는 쓰지 않음)
   L4  ★ pagedone(실제 createSpeaker) — 쪽 끝 자동 넘김에서 한 번(hop 0) · 빈 쪽 넘김에서는 그 빈 쪽 없음 · 마지막 쪽 끝에서 한 번 ·
        사용자 [다음]·stop·cue 로 끝을 지난 시작에서는 없음 · 문장 반복·멈춤/재개와 겹쳐도 한 번
   L5  ★ 읽은 쪽(fake-idb) — 없던 @read 만들기 · [[3,5]]+6 → [[3,6]] · 손으로 4 안 읽음 → [[3,3],[5,6]] · 퀴즈 progress 와 섞이지 않음 ·
        문서 없으면 쓰지 않음 · deleteDocument 뒤 없음
   L6  ★ reading.track:false → 기록 0(붙지 않음) · markRead 는 됨
   L7  ★ 종단 — 실제 speaker + 기록기: 두 쪽 끝까지 → @read [[1,2]] · reading.log 오늘 ms·chars·pages 2
   L8  ★ 9c — reading.log 날짜·갈래 큰 값 합치기(멱등) · 내보내기 → 가져오기: 설정 세 키 · @read 합집합 · 두 번 = 한 번
   L9  정적 — readlog import 는 config·db·./planner 만(tts·ui·ai 0) · controls 배선 · speaker emit('pagedone') 한 곳 · dayKeyOf = cards.dayKeyOf ·
        설정 키·허용 목록
   지어낸 글자만. 실제 키·실제 호출 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; throw new Error('호출 금지'); };

const db = await import('../js/db.js');
const RL = await import('../js/plan/readlog.js');
const { createSpeaker } = await import('../js/tts/speaker.js');
const { watchdogMs } = await import('../js/tts/text.js');
const { exportBackup } = await import('../js/backup/export.js');
const IM = await import('../js/backup/import.js');
const C = await import('../js/srs/cards.js');
const { PLAN, BACKUP } = await import('../js/config.js');
const { DEFAULTS } = await import('../js/settings.js');

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const T0 = new Date(2026, 10, 17, 9, 0, 0).getTime();
const TODAY = '2026-11-17';
const S = 1000;

async function reset() {
  for (const s of db.STORE_NAMES) await db.clearStore(s);
}
const tick = () => new Promise((r) => setTimeout(r, 0));

/* ── 가짜 시계(시각 = 타이머 시각) ─────────────────────── */
function fakeTimers(start) {
  let now = start;
  let seq = 1;
  const jobs = new Map();
  return {
    now: () => now,
    setTimeout: (fn, ms) => { const k = seq++; jobs.set(k, { fn: fn, at: now + (Number(ms) || 0) }); return k; },
    clearTimeout: (k) => { jobs.delete(k); },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let pick = null;
        let key = null;
        for (const [k, j] of jobs) if (j.at <= target && (pick === null || j.at < pick.at)) { pick = j; key = k; }
        if (!pick) break;
        jobs.delete(key);
        now = pick.at;
        pick.fn();
      }
      now = target;
    },
    pending: () => jobs.size
  };
}

/* ── 가짜 speaker — 이벤트만 ──────────────────────────── */
function fakeSpeaker() {
  const bus = new EventTarget();
  let state = 'idle';
  let rate = 1;
  const repeat = { mode: 'off', count: 3, pass: 0, from: 0, to: 0 };
  const fire = (t, d) => bus.dispatchEvent(new CustomEvent(t, { detail: d }));
  return {
    addEventListener: bus.addEventListener.bind(bus),
    removeEventListener: bus.removeEventListener.bind(bus),
    getState: () => state,
    getRate: () => rate,
    getRepeat: () => Object.assign({}, repeat),
    setRate(r) { rate = r; },
    set(s) { state = s; fire('statechange', { state: s }); },
    line(page, index, text) { fire('linechange', { page: page, index: index, src: text === undefined ? 'x'.repeat(100) : text, seg: index }); },
    repeat(mode) { repeat.mode = mode; fire('repeatchange', Object.assign({}, repeat)); },
    pagedone(page) { fire('pagedone', { page: page }); }
  };
}

function rig(o) {
  const x = o || {};
  const timers = fakeTimers(x.start || T0);
  let bucket = x.bucket || 'both';
  const rl = RL.createReadLog({ now: timers.now, timers: timers, getSetting: x.getSetting });
  const sp = fakeSpeaker();
  const ok = rl.attach(sp, Object.assign({ docIdOf: () => 'docA', bucketOf: () => bucket }, x.attach || {}));
  return { rl: rl, sp: sp, timers: timers, ok: ok, setBucket: (b) => { bucket = b; } };
}
const todayOf = async (rl) => (await rl.readLog()).days[TODAY] || {};

/* ══ L1 ═════════════════════════════════════════════════ */
test('L1 ★ speaking 60초 · 단위 넷(글자 합 400) → both.ms 60000·chars 400 · rateMs = 1.25 × ms', async () => {
  await reset();
  const h = rig();
  assert.equal(h.ok, true);
  h.sp.setRate(1.25);
  h.sp.set('speaking');
  for (let i = 0; i < 4; i++) { h.sp.line(1, i); h.timers.advance(15 * S); }
  h.sp.set('paused');
  await h.rl.flush();
  const d = await todayOf(h.rl);
  assert.deepEqual(d.both, { ms: 60000, chars: 400, rateMs: 75000 });
  assert.equal(d.src, undefined);
  const lg = await h.rl.readLog();
  assert.equal(lg.v, 1);
  assert.equal(fetchCalls, 0);
});

/* ══ L2 ═════════════════════════════════════════════════ */
test('L2 ★ 빼는 시간 — paused 0 · 반복 0 · 사이 5분 → 120초 · 같은 index 글자 0 · 표 안내 · 갈래', async () => {
  // paused 동안 0 · 재개한 같은 단위는 글자 0
  await reset();
  let h = rig();
  h.sp.set('speaking'); h.sp.line(1, 0); h.timers.advance(10 * S);
  h.sp.set('paused'); h.timers.advance(100 * S);
  h.sp.set('speaking'); h.sp.line(1, 0); h.timers.advance(10 * S);
  h.sp.set('paused');
  await h.rl.flush();
  assert.deepEqual((await todayOf(h.rl)).both, { ms: 20000, chars: 100, rateMs: 20000 });
  // 반복 켜짐 동안 0(시간·글자)
  await reset();
  h = rig();
  h.sp.set('speaking'); h.sp.line(1, 0); h.timers.advance(10 * S);
  h.sp.repeat('unit');
  for (let k = 0; k < 5; k++) { h.timers.advance(10 * S); h.sp.line(1, 0); }
  h.sp.line(1, 1); h.timers.advance(10 * S);   // 반복 중 다음 단위로 — 세지 않음
  h.sp.repeat('off');
  h.sp.line(1, 2); h.timers.advance(10 * S);
  h.sp.set('paused');
  await h.rl.flush();
  assert.deepEqual((await todayOf(h.rl)).both, { ms: 20000, chars: 200, rateMs: 20000 });
  // linechange 사이 5분 → 120초만(그 뒤 다시 셈)
  await reset();
  h = rig();
  h.sp.set('speaking'); h.sp.line(1, 0); h.timers.advance(300 * S);
  h.sp.line(1, 1); h.timers.advance(10 * S);
  h.sp.set('paused');
  await h.rl.flush();
  assert.equal((await todayOf(h.rl)).both.ms, 130000);
  // 표 안내(src null) — 시간은 세고 글자 0 · 갈래는 그때의 bucketOf
  await reset();
  h = rig({ bucket: 'src' });
  h.sp.set('speaking'); h.sp.line(1, 0, null); h.timers.advance(5 * S);
  h.sp.line(1, 1, 'abcde'); h.timers.advance(5 * S);
  h.setBucket('tr');
  h.sp.line(1, 2, 'xyz'); h.timers.advance(5 * S);
  h.sp.set('idle');
  await h.rl.flush();
  const d = await todayOf(h.rl);
  assert.deepEqual(d.src, { ms: 10000, chars: 5, rateMs: 10000 });
  assert.deepEqual(d.tr, { ms: 5000, chars: 3, rateMs: 5000 });
});

/* ══ L3 쓰기 횟수 ═════════════════════════════════════════ */
test('L3 ★ 쓰기 — linechange 로는 0 · 60초마다 · 멈춤 · 숨김 · 떠남(쪽 넘김 대기 0)', async () => {
  await reset();
  const h = rig();
  const w = () => h.rl.stats().writes;
  h.sp.set('speaking');
  for (let i = 0; i < 10; i++) { h.sp.line(1, i); h.timers.advance(5 * S); }
  await h.rl.whenWritten();
  assert.equal(w(), 0, '50초 — 문장 열 개에도 쓰기 0');
  h.timers.advance(10 * S);
  await h.rl.whenWritten();
  assert.equal(w(), 1, '60초에 한 번');
  h.sp.set('waiting-page'); h.timers.advance(2 * S); h.sp.set('speaking'); h.sp.line(2, 0);
  await h.rl.whenWritten();
  assert.equal(w(), 1, '쪽 넘김 대기는 쓰지 않는다');
  h.timers.advance(5 * S);
  h.sp.set('paused');
  await h.rl.whenWritten();
  assert.equal(w(), 2, '멈춤에 한 번');
  await h.rl.onHidden();
  assert.equal(w(), 2, '모은 것이 없으면 숨김에도 쓰지 않는다');
  h.sp.set('speaking'); h.sp.line(2, 1); h.timers.advance(5 * S);
  await h.rl.onHidden();
  assert.equal(w(), 3, '숨김에 한 번(낭독 중)');
  h.timers.advance(5 * S);
  await h.rl.detach();
  assert.equal(w(), 4, '떠남에 한 번');
  assert.equal(h.timers.pending(), 0, '떼면 타이머 없음');
  const d = await todayOf(h.rl);
  assert.equal(d.both.ms, 50000 + 10000 + 5000 + 5000 + 5000, '대기 2초는 빠짐');
  h.sp.set('paused');
  await h.rl.whenWritten();
  assert.equal(w(), 4, '뗀 뒤 이벤트는 듣지 않는다');
});

/* ══ L4 pagedone — 실제 speaker ═══════════════════════════ */
function fakeSynth() {
  const s = {
    speaking: false, pending: false, current: null, spoken: [],
    speak(u) { s.speaking = true; s.current = u; s.spoken.push(u.text); },
    pause() { }, resume() { },
    cancel() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    finish() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onend) u.onend(); }
  };
  return s;
}
const ln = (id, text) => ({ id: id, text: text, hyphen: 'none' });
function realRig(pages, timers, order) {
  const synth = fakeSynth();
  const t = timers || fakeTimers(T0);
  const v = { page: 1, pageCount: Object.keys(pages).length };
  const sp = createSpeaker({
    synth: synth, timers: t, makeUtterance: (text) => ({ text: text }),
    view: {
      paras: () => pages[v.page] || [],
      page: () => ({ page: v.page, pageCount: v.pageCount }),
      goToPage: (n) => { v.page = n; return Promise.resolve(true); },
      show: () => true, markDone: () => { },
      lineOrder: () => (order && order[v.page]) || []
    },
    requestWakeLock: () => Promise.resolve({ release() { } })
  });
  const done = [];
  sp.addEventListener('pagedone', (ev) => done.push(ev.detail.page));
  return { sp: sp, synth: synth, timers: t, view: v, done: done };
}
const THREE = {
  1: [{ id: 'p1', kind: 'body', lines: [ln('1:1', 'First one here.'), ln('1:2', 'Second one here.')] }],
  2: [],
  3: [{ id: 'p3', kind: 'body', lines: [ln('3:1', 'Third one here.')] }]
};

test('L4 ★ pagedone — 자동 넘김 한 번 · 빈 쪽 없음 · 마지막 쪽 한 번 · [다음]·stop·끝 지난 시작 없음 · 반복·멈춤 겹쳐도 한 번', async () => {
  // 자동 넘김: 1쪽 끝 → pagedone 1 · 빈 2쪽 넘김 → 없음 · 3쪽(마지막) 끝 → pagedone 3, 그 뒤 end
  let h = realRig(THREE);
  let ended = 0;
  h.sp.addEventListener('end', () => { ended++; });
  h.sp.play();
  h.synth.finish(); h.synth.finish();
  await tick(); await tick();
  assert.equal(h.view.page, 3);
  assert.deepEqual(h.done, [1], '빈 쪽(2)은 pagedone 없음');
  h.synth.finish();
  await tick();
  assert.deepEqual(h.done, [1, 3]);
  assert.equal(ended, 1);
  // 사용자 [다음] 으로 쪽 끝을 넘김 → 없음 · stop → 없음
  h = realRig(THREE);
  h.sp.play();
  h.sp.next(); h.timers.advance(100);
  h.sp.next(); h.timers.advance(100);
  await tick(); await tick();
  assert.equal(h.view.page, 3, '[다음] 으로 넘어감');
  assert.deepEqual(h.done, []);
  h.sp.stop();
  assert.deepEqual(h.done, []);
  // 멈춤·재개 뒤 끝까지 → 한 번 · 마지막 문장 반복(2회)과 겹쳐도 한 번
  h = realRig(THREE);
  h.sp.play();
  h.sp.pause(); h.sp.resume(); h.timers.advance(100);
  h.synth.finish();
  h.sp.setRepeat('unit', 2);
  h.synth.finish(); h.synth.finish();
  await tick(); await tick();
  assert.deepEqual(h.done, [1], '반복 두 번 뒤에 한 번');
  // 이 쪽 마지막 발화 뒤의 줄(걸러진 인용 줄 — 화면 순서만 있음)을 눌러 시작 → 쪽 끝을 지나 다음 쪽(읽지 않음) → 없음
  h = realRig({ 1: THREE[1], 2: THREE[3] }, null, { 1: ['1:1', '1:2', '1:3'] });
  h.sp.play('1:3');
  h.timers.advance(100);
  await tick(); await tick();
  assert.equal(h.view.page, 2, '다음 쪽으로 감');
  assert.deepEqual(h.done, [], '끝을 지난 시작은 읽은 쪽이 아니다');
});

/* ══ L5 읽은 쪽 ═══════════════════════════════════════════ */
test('L5 ★ 읽은 쪽 — @read 만들기 · [[3,5]]+6 → [[3,6]] · 4 안 읽음 → [[3,3],[5,6]] · 퀴즈 progress 무변 · 문서 없음 · 삭제 연쇄', async () => {
  await reset();
  await db.put('documents', { id: 'docA', title: 'A', pageCount: 40, fileHash: 'h:a' });
  await db.put('progress', { docId: 'docA', sectionId: 'II', readLineCount: 7, score: 3, updatedAt: 5 });
  const timers = fakeTimers(T0);
  const rl = RL.createReadLog({ now: timers.now, timers: timers });
  assert.deepEqual(await rl.readRanges('docA'), [], '퀴즈 레코드는 읽은 쪽이 아니다');
  assert.deepEqual(await rl.markRead('docA', 3, 5, true), [[3, 5]]);
  const r1 = await db.get('progress', ['docA', PLAN.READ_SECTION]);
  assert.deepEqual(r1, { docId: 'docA', sectionId: '@read', ranges: [[3, 5]], pages: 3, updatedAt: T0 });
  timers.advance(S);
  assert.deepEqual(await rl.markRead('docA', 6, 6, true), [[3, 6]]);
  timers.advance(S);
  assert.deepEqual(await rl.markRead('docA', 4, 4, false), [[3, 3], [5, 6]]);
  const r3 = await db.get('progress', ['docA', '@read']);
  assert.deepEqual([r3.pages, r3.updatedAt], [3, T0 + 2 * S]);
  const w = rl.stats().markWrites;
  assert.deepEqual(await rl.markRead('docA', 5, 6, true), [[3, 3], [5, 6]], '바뀐 것 없음');
  assert.equal(rl.stats().markWrites, w, '같으면 쓰지 않는다');
  assert.deepEqual(await db.get('progress', ['docA', 'II']), { docId: 'docA', sectionId: 'II', readLineCount: 7, score: 3, updatedAt: 5 }, '퀴즈 레코드 그대로');
  assert.equal(await rl.markRead('gone', 1, 2, true), null, '문서 없으면 쓰지 않는다');
  assert.equal(await db.get('progress', ['gone', '@read']), undefined);
  assert.deepEqual(await rl.markRead('docA', 1, 2, false), [[3, 3], [5, 6]]);
  await db.deleteDocument('docA');
  assert.equal(await db.get('progress', ['docA', '@read']), undefined, '문서 삭제 연쇄');
  assert.deepEqual(await rl.readRanges('docA'), []);
});

/* ══ L6 track false ══════════════════════════════════════ */
test('L6 ★ reading.track:false → 붙지 않음·기록 0 · markRead 는 됨', async () => {
  await reset();
  await db.put('documents', { id: 'docA', title: 'A', pageCount: 4, fileHash: 'h:a' });
  const h = rig({ getSetting: (k) => (k === 'reading.track' ? false : undefined) });
  assert.equal(h.ok, false);
  assert.equal(h.rl.isAttached(), false);
  h.sp.set('speaking'); h.sp.line(1, 0); h.timers.advance(70 * S); h.sp.pagedone(1); h.sp.set('paused');
  await h.rl.onHidden();
  await h.rl.detach();
  assert.deepEqual((await h.rl.readLog()).days, {});
  assert.equal(h.rl.stats().writes, 0);
  assert.equal(await db.get('progress', ['docA', '@read']), undefined, '읽은 쪽 자동 표시도 없음');
  assert.deepEqual(await h.rl.markRead('docA', 2, 3, true), [[2, 3]], '손으로 고침은 된다');
  // attach 의 track 함수가 이긴다
  const h2 = rig({ attach: { track: () => false } });
  assert.equal(h2.ok, false);
  const h3 = rig({ getSetting: () => false, attach: { track: () => true } });
  assert.equal(h3.ok, true);
  await h3.rl.detach();
});

/* ══ L7 종단 ═════════════════════════════════════════════ */
test('L7 ★ 실제 speaker + 기록기 — 두 쪽 끝까지 → @read [[1,2]] · 오늘 ms·chars·pages 2', async () => {
  await reset();
  await db.put('documents', { id: 'docA', title: 'A', pageCount: 2, fileHash: 'h:a' });
  const pages = {
    1: [{ id: 'p1', kind: 'body', lines: [ln('1:1', 'First one here.'), ln('1:2', 'Second one here.')] }],
    2: [{ id: 'p2', kind: 'body', lines: [ln('2:1', 'Third one here.')] }]
  };
  const timers = fakeTimers(T0);
  const h = realRig(pages, timers);
  assert.ok(watchdogMs('Second one here.', 1) > 1000, '1초씩 감아도 워치독이 먼저 오지 않는다');
  const rl = RL.createReadLog({ now: timers.now, timers: timers });
  assert.equal(rl.attach(h.sp, { docIdOf: () => 'docA', bucketOf: () => 'src' }), true);
  h.sp.play();
  timers.advance(S); h.synth.finish();
  timers.advance(S); h.synth.finish();
  await tick(); await tick();
  timers.advance(S); h.synth.finish();
  await tick(); await tick();
  await rl.flush();
  assert.equal(h.sp.getState(), 'idle');
  assert.deepEqual(h.done, [1, 2]);
  assert.deepEqual(await rl.readRanges('docA'), [[1, 2]]);
  const d = (await rl.readLog()).days[TODAY];
  assert.deepEqual(d.src, { ms: 3000, chars: 'First one here.'.length + 'Second one here.'.length + 'Third one here.'.length, rateMs: 3000 });
  assert.equal(d.pages, 2);
  assert.equal(rl.stats().writes, 1, '끝(idle)에 한 번');
  await rl.detach();
  assert.equal(fetchCalls, 0);
});

/* ══ L8 9c ═══════════════════════════════════════════════ */
test('L8 ★ 9c — reading.log 합치기(멱등) · 내보내기 → 가져오기 설정 세 키 · @read 합집합 · 두 번 = 한 번', async () => {
  const A = { v: 1, days: { '2026-11-10': { both: { ms: 100, chars: 10, rateMs: 100 }, pages: 1 }, [TODAY]: { src: { ms: 500, chars: 50, rateMs: 500 }, pages: 2 } } };
  const B = { v: 1, days: { '2026-11-12': { tr: { ms: 70, chars: 7, rateMs: 70 } }, [TODAY]: { src: { ms: 300, chars: 90, rateMs: 450 }, both: { ms: 9, chars: 1, rateMs: 9 }, pages: 1 } } };
  const u = IM.unionSetting('reading.log', B, A);
  assert.deepEqual(u.days[TODAY], { src: { ms: 500, chars: 90, rateMs: 500 }, both: { ms: 9, chars: 1, rateMs: 9 }, pages: 2 });
  assert.deepEqual(Object.keys(u.days).sort(), ['2026-11-10', '2026-11-12', TODAY]);
  assert.deepEqual(IM.unionSetting('reading.log', u, A), u, '두 번 = 한 번');
  assert.deepEqual(IM.unionSetting('reading.log', {}, A), A, '기기 값이 꼴이 아니면 파일 값');
  assert.deepEqual(IM.unionSetting('reading.log', B, 'x'), B);
  const many = { v: 1, days: {} };
  for (let i = 0; i < 70; i++) many.days['2026-0' + (1 + Math.floor(i / 28)) + '-' + String(1 + (i % 28)).padStart(2, '0')] = { pages: 1 };
  assert.equal(Object.keys(IM.unionSetting('reading.log', many, { v: 1, days: {} }).days).length, PLAN.LOG_DAYS);
  for (const [k, v] of [['reading.log', A], ['reading.track', false], ['planner.exams', [{ id: 'e1' }]]]) assert.equal(IM.settingTypeOk(k, v, DEFAULTS), true, k);
  assert.equal(IM.settingTypeOk('reading.track', 'no', DEFAULTS), false);
  assert.equal(IM.settingTypeOk('planner.exams', {}, DEFAULTS), false);
  // 종단 — 기기 A 의 백업을 기기 B 에(같은 PDF, 다른 id)
  await reset();
  await db.put('documents', { id: 'docA', title: 'A', pageCount: 40, fileHash: 's256:p:1:aaa', addedAt: T0, lastOpenedAt: T0 });
  await db.put('progress', { docId: 'docA', sectionId: '@read', ranges: [[1, 3]], pages: 3, updatedAt: T0 });
  await db.put('settings', { key: 'reading.log', value: A });
  await db.put('settings', { key: 'reading.track', value: false });
  const exam = { id: 'e1', name: 'Cardio', date: '2026-12-01', minutesPerDay: 60, weekdays: [0, 1, 2, 3, 4, 5, 6], reserve: 0, targets: [{ docId: 'docA', from: 1, to: 40, label: 'Ch 1' }], createdAt: T0, updatedAt: T0 };
  await db.put('settings', { key: 'planner.exams', value: [exam] });
  const ex = await exportBackup({ now: T0 + S, gzip: false });
  const file = new File([ex.blob], ex.name);
  const text = await file.text();
  for (const k of ['reading.log', 'reading.track', 'planner.exams']) assert.ok(text.includes('"key":"' + k + '"'), k + ' 담음');
  await reset();
  await db.put('documents', { id: 'devA', title: 'A', pageCount: 40, fileHash: 's256:p:1:aaa', addedAt: T0, lastOpenedAt: T0 + 5 * S });
  await db.put('progress', { docId: 'devA', sectionId: '@read', ranges: [[7, 9]], pages: 3, updatedAt: T0 + 2 * S });
  await db.put('settings', { key: 'reading.log', value: B });
  const r1 = await IM.importBackup(file, { now: T0 + 10 * S, defaults: DEFAULTS });
  assert.equal(r1.ok, true);
  const rl = RL.createReadLog();
  assert.deepEqual(await rl.readRanges('devA'), [[1, 3], [7, 9]], '두 기기의 읽은 쪽을 다 남긴다');
  assert.equal((await db.get('progress', ['devA', '@read'])).pages, 6);
  assert.deepEqual((await rl.readLog()).days, u.days, '날짜·갈래 큰 값');
  assert.equal((await db.get('settings', 'reading.track')).value, false, '파일 값');
  assert.deepEqual((await db.get('settings', 'planner.exams')).value, [exam], '파일 값(13-2 — 범위 docId 는 옮기지 않음, 남은 문제)');
  const snap = async () => JSON.stringify([await db.get('progress', ['devA', '@read']), await db.get('settings', 'reading.log'),
    await db.get('settings', 'reading.track'), await db.get('settings', 'planner.exams')]);
  const s1 = await snap();
  const r2 = await IM.importBackup(file, { now: T0 + 20 * S, defaults: DEFAULTS });
  assert.equal(r2.ok, true);
  assert.equal(await snap(), s1, '같은 파일 두 번 = 한 번');
  assert.equal(fetchCalls, 0);
});

/* ══ L9 정적 ═════════════════════════════════════════════ */
test('L9 정적 — readlog import · controls 배선 · speaker pagedone 한 곳 · dayKeyOf · 설정 키·허용 목록', () => {
  const s = src('../js/plan/readlog.js');
  const imports = [...s.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['../config.js', '../db.js', './planner.js']);
  for (const bad of ['../tts/', '../ui/', '../ai/', "from '../settings.js'", 'document.', 'window.']) assert.ok(!s.includes(bad), bad);
  const ctl = src('../js/ui/controls.js');
  assert.ok(/import \{ readLogStore, bucketFor \} from '\.\.\/plan\/readlog\.js';/.test(ctl));
  assert.ok(/readLogStore\.attach\(speaker, \{ docIdOf: \(\) => currentPage\(\)\.docId, bucketOf: readBucket, track: \(\) => settings\.get\('reading\.track'\) !== false \}\)/.test(ctl));
  assert.ok(/speaker\.stop\(\);\n\s+readLogStore\.detach\(\);/.test(ctl), '떠날 때 stop 뒤에 뗀다');
  assert.ok(ctl.includes("readLogStore.onHidden()"));
  const spk = src('../js/tts/speaker.js');
  assert.equal(spk.match(/emit\('pagedone'/g).length, 1);
  assert.ok(spk.includes("if (auto === true && hop === 0 && p) emit('pagedone', { page: p.page });"));
  assert.ok(spk.includes('if (i >= units.length) { advancePage(0, true); return; }'));
  for (const ms of [T0, T0 + 15 * 3600000, new Date(2026, 1, 28, 23, 59).getTime(), 0, new Date(2028, 1, 29, 0, 0, 1).getTime()]) {
    assert.equal(RL.dayKeyOf(ms), C.dayKeyOf(ms), String(ms));
  }
  assert.equal(DEFAULTS['reading.track'], true);
  assert.deepEqual(DEFAULTS['reading.log'], {});
  assert.ok(Object.isFrozen(DEFAULTS['reading.log']));
  assert.deepEqual(DEFAULTS['planner.exams'], []);
  for (const k of ['reading.track', 'reading.log', 'planner.exams']) assert.ok(BACKUP.SETTINGS_KEYS.includes(k), k);
  assert.equal(RL.LOG_KEY, 'reading.log');
});

/* ══ 13-1R 고침 (13-2 Build) ═════════════════════════════
   L10 ★ #1 실제 createSpeaker — 300자 넘는 문장(조각 셋)을 끝까지 → 글자 = 문장 길이 한 번(조각마다 다시 세지 않음) ·
        둘째 조각에서 멈춤 → 재개해도 한 번 · 다음 문장은 셈
   L11 #2 속도 바꿈 — 바꾸기 전 구간은 옛 속도로(rateMs 10×1 + 10×2)
   L12 #3 자정 걸침 — 23:59:30 부터 60초 → 두 날에 30초씩
   L13 #4 같은 쪽 pagedone 두 번(쪽 넘김 실패 뒤 다시 재생) → 그날 pages 한 번 · 다른 쪽·다른 날은 셈 */
const LONG = Array.from({ length: 40 }, (_, i) => 'word' + i + ' alpha beta').join(' ') + '.';

test('L10 ★ #1 실제 speaker — 300자 넘는 문장 조각 셋 → 글자 한 번 · 멈춤/재개 뒤에도 한 번', async () => {
  const { buildUnits } = await import('../js/tts/text.js');
  const pages = { 1: [{ id: 'p1', kind: 'body', lines: [ln('1:1', LONG), ln('1:2', 'Short tail here.')] }] };
  const units = buildUnits(pages[1], 'sentence');
  assert.ok(units.length >= 4 && units[0].parts >= 3, '조각 셋 이상(' + units.map((u) => u.part + '/' + u.parts).join(',') + ')');
  const want = LONG.length + 'Short tail here.'.length;
  // 끝까지
  await reset();
  let timers = fakeTimers(T0);
  let h = realRig(pages, timers);
  let rl = RL.createReadLog({ now: timers.now, timers: timers });
  const seen = [];
  h.sp.addEventListener('linechange', (e) => seen.push(e.detail.index));
  rl.attach(h.sp, { docIdOf: () => 'docA', bucketOf: () => 'src' });
  h.sp.play();
  for (let k = 0; k < 10 && h.sp.getState() === 'speaking'; k++) { timers.advance(S); h.synth.finish(); await tick(); }
  await rl.flush();
  assert.ok(seen.length >= units.length, '조각마다 linechange 가 온다(speaker 그대로)');
  let d = (await rl.readLog()).days[TODAY];
  assert.equal(d.src.chars, want, '글자 = 실제 문장 길이 합');
  await rl.detach();
  // 둘째 조각에서 멈춤 → 재개 → 끝까지
  await reset();
  timers = fakeTimers(T0);
  h = realRig(pages, timers);
  rl = RL.createReadLog({ now: timers.now, timers: timers });
  rl.attach(h.sp, { docIdOf: () => 'docA', bucketOf: () => 'src' });
  h.sp.play();
  timers.advance(S); h.synth.finish(); await tick();
  timers.advance(S); h.sp.pause(); timers.advance(5 * S); h.sp.resume(); timers.advance(100);
  for (let k = 0; k < 10 && h.sp.getState() === 'speaking'; k++) { timers.advance(S); h.synth.finish(); await tick(); }
  await rl.flush();
  d = (await rl.readLog()).days[TODAY];
  assert.equal(d.src.chars, want, '멈춤·재개 뒤에도 문장 한 번');
  await rl.detach();
  // 열쇠 — 조각은 같은 열쇠, 다른 문장은 다른 열쇠, lineId 없는 옛 꼴은 index
  assert.equal(RL.unitKey('d', { page: 1, index: 0, lineId: '1:1', src: LONG }), RL.unitKey('d', { page: 1, index: 2, lineId: '1:1', src: LONG }));
  assert.notEqual(RL.unitKey('d', { page: 1, index: 3, lineId: '1:2', src: 'a' }), RL.unitKey('d', { page: 1, index: 4, lineId: '1:2', src: 'b' }));
  assert.notEqual(RL.unitKey('d', { page: 1, index: 0, src: 'x' }), RL.unitKey('d', { page: 1, index: 1, src: 'x' }));
  assert.equal(fetchCalls, 0);
});

test('L11 #2 속도 바꿈 — 바꾸기 전 구간은 옛 속도로', async () => {
  await reset();
  const h = rig();
  h.sp.set('speaking'); h.sp.line(1, 0); h.timers.advance(10 * S);
  h.sp.setRate(2); h.sp.set('speaking');      // speaker setRate 는 statechange{rate} 를 낸다
  h.sp.line(1, 0); h.timers.advance(10 * S);
  h.sp.set('paused');
  await h.rl.flush();
  assert.deepEqual((await todayOf(h.rl)).both, { ms: 20000, chars: 100, rateMs: 30000 });
});

test('L12 #3 자정 걸침 — 두 날로 나눔', async () => {
  await reset();
  const h = rig({ start: new Date(2026, 10, 17, 23, 59, 30).getTime() });
  h.sp.set('speaking');
  for (let k = 0; k < 3; k++) { h.sp.line(1, k); h.timers.advance(20 * S); }
  h.sp.set('paused');
  await h.rl.flush();
  const lg = (await h.rl.readLog()).days;
  assert.equal(lg['2026-11-17'].both.ms, 30000);
  assert.equal(lg['2026-11-18'].both.ms, 30000);
  assert.equal(lg['2026-11-17'].both.chars + lg['2026-11-18'].both.chars, 300);
  assert.equal(RL.nextMidnight(new Date(2026, 10, 17, 23, 59, 30).getTime()), new Date(2026, 10, 18).getTime());
});

test('L13 #4 같은 쪽 pagedone 두 번 → 그날 pages 한 번', async () => {
  await reset();
  await db.put('documents', { id: 'docA', title: 'A', pageCount: 9, fileHash: 'h:a' });
  const h = rig();
  h.sp.set('speaking'); h.sp.line(5, 0); h.timers.advance(5 * S);
  h.sp.pagedone(5); h.sp.set('paused');                     // 쪽 넘김 실패(PAGE_TIMEOUT) → paused
  h.sp.set('speaking'); h.sp.line(5, 0); h.timers.advance(5 * S);
  h.sp.pagedone(5);                                          // 다시 재생 → 같은 쪽 끝 한 번 더
  h.sp.pagedone(6);
  h.sp.set('paused');
  await h.rl.flush();
  assert.equal((await todayOf(h.rl)).pages, 2, '5쪽 한 번 + 6쪽');
  let rr = [];
  for (let k = 0; k < 50 && JSON.stringify(rr) !== '[[5,6]]'; k++) { await tick(); rr = await h.rl.readRanges('docA'); }
  assert.deepEqual(rr, [[5, 6]]);
  assert.equal(h.rl.stats().pagesDone, 3, '진단 셈은 사건 수 그대로');
});
