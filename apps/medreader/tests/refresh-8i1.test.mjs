/* ============================================================
   tests/refresh-8i1.test.mjs — spec 4-13-9 "8i-1"
   판 바뀜 재추출 중 **지금 보고 있는 쪽**의 새 판이 저장되면 다시 그린다.

   지키는 것:
     · 다시 그리기 조건 — 옛 판으로 그린 지금 쪽만(다른 쪽·다른 문서·평소 쪽 저장엔 반응 안 함),
       낭독 중이면 미루고 멈추면 한다.
     · 재생 대기 — 지금 쪽이 옛 판이면 옛 읽기를 내지 않고 새 판을 기다렸다 새 판으로 시작한다.
     · 줄 id 대응 — 새 판에서 줄 id 가 바뀌어도 멈춘 자리·스크롤 기준 줄이 같은 글자로 간다.

   원서 문장은 넣지 않는다. 전부 지어낸 글자다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { isStaleRecord, createRefreshGate, buildLineRemap } from '../js/ui/reader.js';
import { createSpeaker } from '../js/tts/speaker.js';
import { algoVersion } from '../js/text/layout.js';

/* ── 가짜 시계·음성 엔진 (tts-speaker.test.mjs 와 같은 모양) ── */
function fakeTimers() {
  let now = 0;
  let seq = 1;
  const jobs = new Map();
  return {
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
    }
  };
}

function fakeSynth() {
  const s = {
    speaking: false, pending: false, spoken: [], current: null,
    speak(u) { s.speaking = true; s.current = u; s.spoken.push(u.text); },
    pause() { }, resume() { },
    cancel() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    finish() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onend) u.onend(); }
  };
  return s;
}

const tick = () => new Promise((r) => setTimeout(r, 0));
function line(id, text, hyphen) { return { id: id, text: text, hyphen: hyphen || 'none' }; }

/* 옛 판: 이름표 줄에 쪽 번호가 붙어 있다. 새 판: 이름표·내용이 행 단위로, 쪽 번호는 흐름 밖. */
const OLD = [
  { id: 'p0', kind: 'body', lines: [line('30:1', 'Zeta Topic & Omega-'), line('30:2', 'omegaphoria 4242')] },
  { id: 'p1', kind: 'body', lines: [line('30:3', 'First content sentence here.'), line('30:4', 'Second content sentence here.')] }
];
const NEW = [
  { id: 'q0', kind: 'rowhead', lines: [line('30:5', 'Zeta Topic & Omega-', 'kept'), line('30:6', 'omegaphoria')] },
  { id: 'q1', kind: 'body', lines: [line('30:7', 'First content sentence here.'), line('30:8', 'Second content sentence here.')] }
];
const NEW_REMAP = new Map([['30:1', '30:5'], ['30:2', '30:6'], ['30:3', '30:7'], ['30:4', '30:8']]);

/**
 * 리더 흉내 — 지금 쪽 저장본(옛/새), 문지기, speaker 를 실제 앱과 같은 순서로 잇는다:
 *   speaker statechange → gate.speech · 추출 저장 → gate.saved · 다시 그리기 → reload → (refreshed) reshow
 */
function harness(opts) {
  const o = opts || {};
  const synth = fakeSynth();
  const timers = fakeTimers();
  const R = { stale: o.stale !== false, paras: o.paras || OLD, remap: null, refreshes: 0, waiters: [], hl: [], shown: [] };
  let sp = null;
  const gate = createRefreshGate(() => {
    R.refreshes++;
    R.paras = NEW;
    R.stale = false;
    R.remap = NEW_REMAP;
    gate.shown('doc', 30, false);
    sp.reload();
    sp.reshow();
    const ws = R.waiters.splice(0);
    for (const w of ws) w(true);
  });
  sp = createSpeaker({
    synth: synth,
    timers: timers,
    makeUtterance: (text) => ({ text: text }),
    view: {
      paras: () => R.paras,
      page: () => ({ page: 30, pageCount: 40 }),
      goToPage: () => Promise.resolve(false),
      show: (u) => { R.shown.push(u.lineIds.join(',')); return true; },
      markDone: () => { },
      ready: () => !R.stale,
      whenReady: () => (R.stale ? new Promise((res) => R.waiters.push(res)) : Promise.resolve(true)),
      remapLine: (id) => (R.remap && R.remap.has(id) ? R.remap.get(id) : id),
      highlight: (u) => { R.hl.push(u.lineIds.join(',')); return true; }
    },
    requestWakeLock: () => Promise.resolve({ release() { } })
  });
  sp.addEventListener('statechange', () => gate.speech(sp.getState()));
  gate.shown('doc', 30, R.stale);
  sp.reload();           // 쪽을 처음 그렸을 때의 구독자(controls)와 같다 — 큐는 옛 판으로 만들어져 있다
  return { sp, synth, timers, gate, R };
}

/* ══ 판정 ══════════════════════════════════════════════ */

test('RF1 옛 판 판정 — 저장본 algoVersion 이 지금보다 낮을 때만. 저장본 없음(자리표시자)은 옛 판이 아니다', () => {
  assert.equal(isStaleRecord({ algoVersion: algoVersion - 1 }), true);
  assert.equal(isStaleRecord({ algoVersion: algoVersion }), false);
  assert.equal(isStaleRecord({ algoVersion: algoVersion + 1 }), false);
  assert.equal(isStaleRecord({}), true, 'algoVersion 이 없는 저장본은 옛 판');
  assert.equal(isStaleRecord(null), false);
  assert.equal(isStaleRecord({ algoVersion: 10 }, 11), true);
});

/* ══ 문지기 — 다시 그리기 조건 ══════════════════════════ */

function gateWithCount() {
  const c = { n: 0 };
  const g = createRefreshGate(() => { c.n++; });
  return { g, c };
}

test('RF2 ★ 옛 판으로 그린 지금 쪽의 저장 + 낭독 중 아님 → 바로 다시 그린다', () => {
  const { g, c } = gateWithCount();
  g.shown('doc', 30, true);
  assert.equal(g.saved('doc', 30), 'refresh');
  assert.equal(c.n, 1);
});

test('RF3 ★ 낭독 중이면 미룬다 → 멈추면(paused) 한 번 한다, 그 뒤 idle 에서 또 하지 않는다', () => {
  const { g, c } = gateWithCount();
  g.shown('doc', 30, true);
  g.speech('speaking');
  assert.equal(g.saved('doc', 30), 'deferred');
  assert.equal(g.saved('doc', 30), 'deferred', '두 번 저장돼도 한 번만 미룬다');
  assert.equal(c.n, 0, '낭독 중에 다시 그렸다');
  assert.equal(g.snapshot().pending, true);
  assert.equal(g.speech('paused'), 'refresh');
  assert.equal(c.n, 1);
  assert.equal(g.speech('idle'), null);
  assert.equal(c.n, 1);
});

test('RF4 ★ 지금 쪽이 아닌 쪽·다른 문서의 저장엔 반응하지 않는다', () => {
  const { g, c } = gateWithCount();
  g.shown('doc', 30, true);
  assert.equal(g.saved('doc', 31), 'ignore');
  assert.equal(g.saved('doc', 29), 'ignore');
  assert.equal(g.saved('other', 30), 'ignore');
  g.speech('speaking');
  g.saved('doc', 31);
  g.speech('paused');
  assert.equal(c.n, 0);
});

test('RF5 ★ 평소(옛 판이 아닌 쪽) 저장 — 역할 재계산(4-7) 저장에도 다시 그리지 않는다(동작 불변)', () => {
  const { g, c } = gateWithCount();
  g.shown('doc', 30, false);
  assert.equal(g.saved('doc', 30), 'ignore');
  assert.equal(c.n, 0);
});

test('RF6 옛 판에서 새 판으로 다시 그린 뒤에도 그 쪽 저장(이웃이 생겨 역할 재계산)은 따라간다 — 다른 쪽에 가면 끊는다', () => {
  const { g, c } = gateWithCount();
  g.shown('doc', 30, true);
  g.saved('doc', 30);
  g.shown('doc', 30, false);              // 다시 그린 결과(새 판)
  assert.equal(g.saved('doc', 30), 'refresh');
  assert.equal(c.n, 2);
  g.shown('doc', 31, false);              // 다른 쪽
  g.shown('doc', 30, false);              // 돌아옴 — 이제 새 판으로 열렸다
  assert.equal(g.saved('doc', 30), 'ignore');
});

test('RF7 미뤄 둔 다시 그리기는 쪽을 새로 그리면(다른 쪽·같은 쪽) 버린다 — 쪽 끝으로 넘어가면 할 필요가 없다', () => {
  const { g, c } = gateWithCount();
  g.shown('doc', 30, true);
  g.speech('speaking');
  g.saved('doc', 30);
  assert.equal(g.speech('waiting-page'), null, '다음 쪽을 기다리는 동안 옛 쪽을 다시 그렸다');
  g.shown('doc', 31, false);
  g.speech('speaking');
  g.speech('paused');
  assert.equal(c.n, 0);
});

test('RF8 다음 쪽·새 판을 기다리는 동안(waiting-page)의 저장은 바로 다시 그린다(읽고 있는 것이 없다)', () => {
  const { g, c } = gateWithCount();
  g.shown('doc', 30, true);
  g.speech('waiting-page');
  assert.equal(g.saved('doc', 30), 'refresh');
  assert.equal(c.n, 1);
});

test('RF9 리더를 떠나면 따라가기를 끊는다', () => {
  const { g, c } = gateWithCount();
  g.shown('doc', 30, true);
  g.left();
  assert.equal(g.saved('doc', 30), 'ignore');
  assert.equal(c.n, 0);
});

/* ══ 줄 id 대응 ════════════════════════════════════════ */

function L(id, text, box, paraId) {
  return { id: id, text: text, bbox: { x0: box[0], y0: box[1], x1: box[2], y1: box[3] }, role: 'body', paraId: paraId, regionId: null, hyphenJoin: false };
}
function layoutOf(lines, paras) {
  return { pageNo: 30, width: 600, height: 800, algoVersion: algoVersion, lines: lines, paragraphs: paras, regions: [] };
}

test('RF10 ★ 줄 id 대응 — 같은 id·같은 글자는 그대로, 바뀐 id 는 같은 글자로, 갈라진 줄은 겹치는 자리로, 나머지는 문단 순서로', () => {
  const oldL = layoutOf([
    L('30:1', 'Keep me', [10, 700, 200, 712], 'a'),
    L('30:2', 'Label words & Pre- 4242', [10, 680, 400, 692], 'a'),
    L('30:3', 'Moved line text', [10, 660, 300, 672], 'b'),
    L('30:4', 'Vanished text', [10, 100, 300, 112], 'b')
  ], [{ id: 'a', kind: 'body', lineIds: ['30:1', '30:2'] }, { id: 'b', kind: 'body', lineIds: ['30:3', '30:4'] }]);
  const ref = Object.assign(L('30:13', '4242', [350, 680, 400, 692], null), { role: 'ref' });
  const newL = layoutOf([
    L('30:1', 'Keep me', [10, 700, 200, 712], 'x'),
    L('30:11', 'Label words & Pre-', [10, 680, 200, 692], 'y'),
    ref,
    L('30:12', 'Moved line text', [10, 660, 300, 672], 'z'),
    L('30:14', 'Other words', [10, 400, 300, 412], 'z')
  ], [
    { id: 'x', kind: 'body', lineIds: ['30:1'] },
    { id: 'y', kind: 'rowhead', lineIds: ['30:11'], refLineIds: ['30:13'] },
    { id: 'z', kind: 'body', lineIds: ['30:12', '30:14'] }
  ]);
  const m = buildLineRemap(oldL, newL);
  assert.equal(m.get('30:1'), '30:1');
  assert.equal(m.get('30:2'), '30:11', '쪽 번호 칸이 갈라진 이름표 줄 → 이름표 줄(쪽 번호 줄 아님)');
  assert.equal(m.get('30:3'), '30:12');
  assert.equal(m.get('30:4'), '30:14', '겹치는 자리가 없으면 같은 문단 순서');
  for (const v of m.values()) assert.notEqual(v, '30:13', '쪽 번호 줄은 낭독 줄이 아니다');
});

test('RF11 같은 글자가 여러 줄이면 쪽 위 자리가 가까운 것', () => {
  const oldL = layoutOf([L('o1', 'Same', [10, 100, 60, 110], 'a'), L('o2', 'Same', [10, 500, 60, 510], 'a')],
    [{ id: 'a', kind: 'body', lineIds: ['o1', 'o2'] }]);
  const newL = layoutOf([L('n1', 'Same', [10, 500, 60, 510], 'a'), L('n2', 'Same', [10, 100, 60, 110], 'a')],
    [{ id: 'a', kind: 'body', lineIds: ['n1', 'n2'] }]);
  const m = buildLineRemap(oldL, newL);
  assert.equal(m.get('o1'), 'n2');
  assert.equal(m.get('o2'), 'n1');
});

/* ══ speaker — 재생 대기 ══════════════════════════════ */

test('RF12 ★ 옛 판 쪽에서 재생 → 말하지 않고 기다린다(waiting-page · 새 판 대기) → 새 판 저장 → 새 판 첫 문장부터', async () => {
  const h = harness();
  h.sp.play();
  assert.equal(h.synth.spoken.length, 0, '옛 판을 읽었다');
  assert.equal(h.sp.getState(), 'waiting-page');
  assert.equal(h.sp.isWaitingFresh(), true);
  h.sp.play();                                   // 기다리는 중에 또 눌렀다
  assert.equal(h.synth.spoken.length, 0);
  assert.equal(h.gate.saved('doc', 30), 'refresh', '대기 중(waiting-page)의 저장은 바로 다시 그린다');
  await tick();
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.synth.spoken.length, 1);
  assert.equal(h.synth.spoken[0], 'Zeta Topic & Omega-omegaphoria', '새 판 이름표 한 덩어리가 첫 발화');
  assert.ok(h.synth.spoken.every((t) => !/4242/.test(t)), '옛 읽기(쪽 번호 섞임)가 나왔다');
});

test('RF13 새 판이 상한 안에 오지 않으면 paused — 옛 판을 읽지 않는다. 다시 누르면 다시 기다린다', async () => {
  const h = harness();
  h.sp.play();
  const ws = h.R.waiters.splice(0);
  ws[0](false);
  await tick();
  assert.equal(h.sp.getState(), 'paused');
  assert.equal(h.sp.isWaitingFresh(), false);
  assert.equal(h.synth.spoken.length, 0);
  h.sp.play();
  assert.equal(h.sp.getState(), 'waiting-page');
  assert.equal(h.synth.spoken.length, 0);
});

test('RF14 기다리는 중에 멈추면(stop·pause) 새 판이 와도 말하지 않는다(세대)', async () => {
  const h = harness();
  h.sp.play();
  h.sp.pause();
  assert.equal(h.sp.getState(), 'paused');
  h.gate.saved('doc', 30);                       // 멈춘 상태 → 바로 다시 그린다(대기자 풀림)
  await tick();
  assert.equal(h.synth.spoken.length, 0, '멈췄는데 읽기 시작했다');
  assert.equal(h.sp.getState(), 'paused');
});

test('RF15 줄 탭(그 줄부터)으로 시작해도 옛 판이면 기다렸다가 **같은 글자의 새 줄**부터', async () => {
  const h = harness();
  h.sp.play('30:3');
  assert.equal(h.synth.spoken.length, 0);
  h.gate.saved('doc', 30);
  await tick();
  assert.equal(h.synth.spoken[0], 'First content sentence here.');
});

test('RF16 새 판이 아닌 쪽(ready 참)에서는 지금과 같다 — 탭 핸들러 안에서 즉시 말한다(6-4 (5))', () => {
  const h = harness({ stale: false, paras: NEW });
  h.sp.play();
  assert.equal(h.synth.spoken.length, 1);
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.sp.isWaitingFresh(), false);
});

/* ══ 통합 — 낭독 중 미룸 · 멈춘 뒤 적용 · 멈춘 자리 유지 ════ */

test('RF17 ★ 낭독 중 새 판 저장 → 큐·화면 그대로(미룸) → 멈추면 다시 그리고 멈춘 자리가 같은 글자의 새 줄로 옮는다', () => {
  // 옛 판으로 이미 읽는 중인 경우(8i-1 이전에 시작한 낭독 등) — 문지기는 낭독을 끊지 않는다.
  const h = harness();
  h.R.stale = false;                             // 재생 문을 열어 옛 판 큐로 읽기 시작(미룸만 본다)
  h.sp.play();
  h.R.stale = true;
  h.synth.finish();                              // 옛 판 두 번째 발화로
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.gate.saved('doc', 30), 'deferred');
  assert.equal(h.R.refreshes, 0, '낭독 중에 다시 그렸다');
  const idxBefore = h.sp.getIndex();
  const cur = h.sp.getCurrent();
  assert.ok(cur.lineIds.indexOf('30:3') >= 0);
  h.sp.pause();
  assert.equal(h.R.refreshes, 1, '멈췄는데 다시 그리지 않았다');
  const after = h.sp.getCurrent();
  assert.deepEqual(after.lineIds, ['30:7'], '멈춘 자리가 새 줄로 옮지 않았다');
  assert.equal(h.sp.getIndex(), idxBefore);
  assert.deepEqual(h.R.hl, ['30:7'], '멈춘 자리를 다시 칠하지 않았다');
  h.sp.play();
  assert.equal(h.synth.spoken[h.synth.spoken.length - 1], 'First content sentence here.');
});

test('RF18 reshow 는 멈춘 상태에서만 칠한다(낭독 중·처음 상태는 아무것도 하지 않는다)', () => {
  const h = harness({ stale: false, paras: NEW });
  assert.equal(h.sp.reshow(), false);
  h.sp.play();
  assert.equal(h.sp.reshow(), false);
  h.sp.pause();
  assert.equal(h.sp.reshow(), true);
});

/* ══ 8i-1c — 다시 그리는 도중 재생해도 첫 문장을 두 번 읽지 않는다 ══════════════
   원본 보기는 canvas 그리기(paintView)가 비동기다. 다시 그리기가 저장본을 읽자마자 `stale` 을 내리면, 그리는 사이
   재생이 새 판 큐로 시작하고 뒤이은 `refreshed` 알림의 `reload()` 가 읽던 첫 문장을 처음부터 다시 읽었다.
   이제 다시 그리기는 시작부터 `notifyPage` 뒤까지 `refreshing` 을 세워 `pageFresh` 가 거짓이다. */

import { readFileSync } from 'node:fs';
import { pageFresh } from '../js/ui/reader.js';

const settle = async (n) => { for (let i = 0; i < (n || 8); i++) await new Promise((r) => setTimeout(r, 2)); };

/**
 * 비동기 paintView 를 흉내 낸 리더 — `renderPage({refresh})` 와 같은 순서:
 *   시작(refreshing = token) → 저장본 읽기(비동기) → stale·refreshing·새 판 → **비동기 그리기**(테스트가 끝낸다)
 *   → notifyPage({refreshed}) = reload·reshow → (finally) refreshing 내림.
 * speaker 의 view.ready/whenReady 는 앱(controls → currentPageReady·whenCurrentPageReady)처럼 `pageFresh` 를 본다(폴링).
 */
function asyncHarness() {
  const synth = fakeSynth();
  const cut = [];
  const baseCancel = synth.cancel;
  synth.cancel = () => { if (synth.current) cut.push(synth.current.text); baseCancel(); };
  const timers = fakeTimers();
  const st = { stale: true, refreshing: 0, token: 0 };
  const R = { paras: OLD, remap: null, paints: [], refreshes: 0 };
  let sp = null;
  async function refreshRender() {
    const token = ++st.token;
    st.refreshing = token;
    await tick();                                          // db.get
    if (token !== st.token) return;
    st.stale = false;
    st.refreshing = token;
    R.paras = NEW;
    R.remap = NEW_REMAP;
    gate.shown('doc', 30, false);
    await new Promise((res) => R.paints.push(res));        // 원본 보기 canvas — 비동기
    try {
      if (token !== st.token) return;
      sp.reload();                                         // notifyPage({refreshed:true}) 첫 구독자
      sp.reshow();                                         // 둘째 구독자
    } finally {
      if (token === st.token && st.refreshing === token) st.refreshing = 0;
    }
  }
  const gate = createRefreshGate(() => { R.refreshes++; return refreshRender(); });
  sp = createSpeaker({
    synth: synth,
    timers: timers,
    makeUtterance: (text) => ({ text: text }),
    view: {
      paras: () => R.paras,
      page: () => ({ page: 30, pageCount: 40 }),
      goToPage: () => Promise.resolve(false),
      show: () => true,
      markDone: () => { },
      ready: () => pageFresh(st),
      whenReady: () => new Promise((res) => { const poll = () => (pageFresh(st) ? res(true) : setTimeout(poll, 1)); poll(); }),
      remapLine: (id) => (R.remap && R.remap.has(id) ? R.remap.get(id) : id),
      highlight: () => true
    },
    requestWakeLock: () => Promise.resolve({ release() { } })
  });
  sp.addEventListener('statechange', () => gate.speech(sp.getState()));
  gate.shown('doc', 30, true);
  sp.reload();
  return { sp, synth, timers, gate, R, st, cut };
}

function noRepeat(spoken) {
  for (let i = 1; i < spoken.length; i++) if (spoken[i] === spoken[i - 1]) return false;
  return true;
}

test('RF19 pageFresh — 옛 판이거나 다시 그리는 중이면 거짓, 둘 다 아니면 참(평소 쪽은 refreshing 을 세우지 않는다)', () => {
  assert.equal(pageFresh({ stale: false, refreshing: 0 }), true);
  assert.equal(pageFresh({ stale: true, refreshing: 0 }), false);
  assert.equal(pageFresh({ stale: false, refreshing: 3 }), false, '다시 그리는 중인데 준비됨');
  assert.equal(pageFresh({ stale: true, refreshing: 3 }), false);
  assert.equal(pageFresh(null), false);
});

test('RF20 ★ 원본 보기 — 다시 그리는(비동기 canvas) 도중 재생 → 기다렸다 refreshed 뒤에 시작: 첫 문장 1번, 끊긴 발화 0', async () => {
  const h = asyncHarness();
  assert.equal(h.gate.saved('doc', 30), 'refresh');
  await settle();
  assert.equal(h.R.paints.length, 1, '그리는 중이어야 한다');
  assert.equal(h.st.stale, false, '저장본은 이미 새 판으로 읽었다(이 틈이 문제였다)');
  h.sp.play();
  assert.equal(h.synth.spoken.length, 0, '다시 그리는 도중에 말하기 시작했다');
  assert.equal(h.sp.getState(), 'waiting-page');
  await settle();
  assert.equal(h.synth.spoken.length, 0, '그리기가 안 끝났는데 기다림이 풀렸다');
  h.R.paints[0]();                                         // canvas 다 그림 → notifyPage(refreshed)
  await settle();
  h.timers.advance(500);
  assert.equal(h.sp.getState(), 'speaking');
  assert.deepEqual(h.synth.spoken, ['Zeta Topic & Omega-omegaphoria'], '첫 문장이 한 번만, 새 판 이름표 한 덩어리로');
  assert.deepEqual(h.cut, [], '시작 직후 끊긴 발화가 있다');
  h.synth.finish();
  h.timers.advance(500);
  assert.ok(noRepeat(h.synth.spoken), '같은 문장이 연달아 나왔다: ' + JSON.stringify(h.synth.spoken));
  assert.ok(h.synth.spoken.every((t) => !/4242/.test(t)), '옛 읽기가 나왔다');
});

test('RF21 ★ 대기 경로(C2) — 옛 판에서 바로 재생 → 대기 → 새 판 다시 그리기(비동기) 도중엔 풀리지 않고 refreshed 뒤 1번', async () => {
  const h = asyncHarness();
  h.sp.play();
  assert.equal(h.sp.getState(), 'waiting-page');
  assert.equal(h.gate.saved('doc', 30), 'refresh', '대기 중 저장은 바로 다시 그린다');
  await settle();
  assert.equal(h.R.paints.length, 1);
  await settle();
  assert.equal(h.synth.spoken.length, 0, '다시 그리는 도중(stale 은 이미 거짓)에 대기가 풀렸다');
  h.R.paints[0]();
  await settle();
  h.timers.advance(500);
  assert.deepEqual(h.synth.spoken, ['Zeta Topic & Omega-omegaphoria']);
  assert.deepEqual(h.cut, []);
});

test('RF22 대기 중에 역할 재계산 다시 그리기가 겹쳐도(앞 렌더는 버려짐) 마지막 refreshed 뒤에 한 번만 시작한다', async () => {
  const h = asyncHarness();
  h.sp.play();
  h.gate.saved('doc', 30);                                 // 새 판(1) 다시 그리기 시작
  await settle();
  assert.equal(h.gate.saved('doc', 30), 'refresh', '역할 재계산 저장도 따라간다(아직 대기 중)');
  await settle();
  assert.equal(h.R.paints.length, 2);
  h.R.paints[0]();                                         // 앞 렌더 끝 — 이미 버려짐(token)
  await settle();
  assert.equal(h.synth.spoken.length, 0, '버려진 렌더가 준비됨을 세웠다');
  assert.equal(h.st.refreshing, 2);
  h.R.paints[1]();
  await settle();
  h.timers.advance(500);
  assert.deepEqual(h.synth.spoken, ['Zeta Topic & Omega-omegaphoria']);
  assert.deepEqual(h.cut, []);
  assert.equal(h.st.refreshing, 0);
});

test('RF23 리더 소스 순서 — 다시 그리기는 시작에 refreshing 을 세우고, paintView·notifyPage(refreshed) 뒤 finally 에서 내린다. 준비 판정 세 곳은 pageFresh', () => {
  const src = readFileSync(new URL('../js/ui/reader.js', import.meta.url), 'utf8');
  const a = src.indexOf('async function renderPage(');
  const b = src.indexOf('function catchUpStale(', a);
  assert.ok(a > 0 && b > a);
  const body = src.slice(a, b);
  const at = (s) => { const i = body.indexOf(s); assert.ok(i >= 0, '없다: ' + s); return i; };
  assert.ok(at('if (cap) state.refreshing = token;') < at("await db.get('pages'"));
  assert.ok(at("await db.get('pages'") < at('state.refreshing = cap ? token : 0;'));
  assert.ok(at('state.refreshing = cap ? token : 0;') < at('await paintView(token);'));
  assert.ok(at('await paintView(token);') < at('notifyPage(cap ? { refreshed: true } : null);'));
  assert.ok(at('notifyPage(cap ? { refreshed: true } : null);') < at('} finally {'));
  assert.ok(at('} finally {') < at('state.refreshing === token) state.refreshing = 0;'));
  const fn = (name) => {
    const i = src.indexOf('export function ' + name + '(');
    assert.ok(i >= 0, name);
    const j = src.indexOf('\n}\n', i);
    return src.slice(i, j);
  };
  assert.match(fn('currentPageReady'), /return pageFresh\(state\)/);
  assert.equal((fn('whenCurrentPageReady').match(/pageFresh\(state\)/g) || []).length, 2);
  const go = fn('goToPageForSpeech');
  assert.equal((go.match(/pageFresh\(state\)/g) || []).length, 2);
  assert.ok(!/!state\.stale/.test(go));
});
