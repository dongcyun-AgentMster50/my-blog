/* ============================================================
   tests/tts-repeat.test.mjs — 5b: 속도 계단 · 표시 동기화 · 반복 재생

   실기기 피드백 셋을 고정한다.

   ① 속도가 **여섯 계단**이고, 옛 연속 슬라이더 값(0.7 같은)이 가장 가까운
      계단으로 맞춰진다.
   ② 속도 글자를 만드는 곳이 **한 군데**뿐이다 — 팝업 숫자와 컨트롤 바
      버튼이 어긋났던 버그가 되돌아오지 못하게 소스로 못을 박는다.
   ③ 반복 상태 기계 — 회차 감소·구간 되감기·무한·해제 후 복귀.

   ★ 이 파일에서 제일 중요한 것은 **R-W1** 이다: `onend` 가 유실돼도
     워치독이 반복을 이어 간다. 반복 중에 그것이 끊기면 낭독이 그 자리에
     영영 선다 — 실기기에서만 나타나고 데스크톱에서는 재현되지 않는다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createSpeaker, snapRate, snapRepeatCount, REPEAT_MODES } from '../js/tts/speaker.js';
import { watchdogMs } from '../js/tts/text.js';
import { TTS } from '../js/config.js';

/* ── 가짜 시계 (tts-speaker.test.mjs 와 같은 것) ───────── */
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
        for (const [k, j] of jobs) {
          if (j.at <= target && (pick === null || j.at < pick.at)) { pick = j; key = k; }
        }
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
    speaking: false, pending: false, spoken: [],
    pauseCalls: 0, cancelCalls: 0, current: null,
    speak(u) { s.speaking = true; s.current = u; s.spoken.push(u.text); },
    pause() { s.pauseCalls++; },
    resume() { s.pauseCalls++; },
    cancel() {
      s.cancelCalls++;
      const u = s.current;
      s.speaking = false; s.current = null;
      if (u && u.onerror) u.onerror({ error: 'canceled' });
    },
    finish() {
      const u = s.current;
      s.speaking = false; s.current = null;
      if (u && u.onend) u.onend();
    },
    fail(code) {
      const u = s.current;
      s.speaking = false; s.current = null;
      if (u && u.onerror) u.onerror({ error: code });
    }
  };
  return s;
}

function line(id, text) { return { id: id, text: text, hyphen: 'none' }; }

/** 한 쪽에 문장 넷(문단 둘). 구간 반복을 시험할 만큼 길다. */
function makeView() {
  const pages = {
    1: [
      { id: 'a', kind: 'body', lines: [line('1:1', 'Alpha one here.'), line('1:2', 'Beta two here.')] },
      { id: 'b', kind: 'body', lines: [line('1:3', 'Gamma three here.'), line('1:4', 'Delta four here.')] }
    ],
    2: [{ id: 'c', kind: 'body', lines: [line('2:1', 'Later page line.')] }]
  };
  const v = {
    page: 1, pageCount: 2, done: [],
    paras() { return pages[v.page] || []; },
    page_() { return { page: v.page, pageCount: v.pageCount }; },
    goToPage(n) { v.page = n; return Promise.resolve(true); },
    show() { return true; },
    markDone(u) { v.done.push(u.lineIds.join(',')); }
  };
  return v;
}

function build() {
  const synth = fakeSynth();
  const timers = fakeTimers();
  const view = makeView();
  const events = [];
  const sp = createSpeaker({
    synth: synth,
    timers: timers,
    makeUtterance: (text) => ({ text: text }),
    view: {
      paras: () => view.paras(),
      page: () => view.page_(),
      goToPage: (n) => view.goToPage(n),
      show: (u) => view.show(u),
      markDone: (u) => view.markDone(u)
    },
    requestWakeLock: () => Promise.resolve({ release() { } })
  });
  for (const type of ['linechange', 'statechange', 'end', 'error', 'repeatchange']) {
    sp.addEventListener(type, (ev) => events.push({ type: type, detail: ev.detail }));
  }
  return { sp: sp, synth: synth, timers: timers, view: view, events: events };
}

/* ══ ① 속도 계단 ══════════════════════════════════════ */

test('R1 ★ 사용자가 고른 여섯 계단 — 0.5 / 0.75 / 1.0 / 1.25 / 1.5 / 1.8', () => {
  assert.deepEqual(Array.from(TTS.RATE_STEPS), [0.5, 0.75, 1.0, 1.25, 1.5, 1.8]);
  assert.ok(Object.isFrozen(TTS.RATE_STEPS));
});

test('R2 ★ 옛 설정 호환 — 목록에 없는 값은 가장 가까운 계단으로', () => {
  assert.equal(snapRate(0.7), 0.75, '연속 슬라이더 시절의 0.7 이 0.75 로 와야 한다');
  assert.equal(snapRate(0.9), 1.0);
  assert.equal(snapRate(1.1), 1.0);
  assert.equal(snapRate(1.3), 1.25);
  assert.equal(snapRate(1.7), 1.8);
  assert.equal(snapRate(2.0), 1.8, '옛 최대값 2.0 은 새 최대 단계로 내려온다');
  assert.equal(snapRate(0.1), 0.5);
});

test('R3 계단 값 자신은 그대로 남는다 — 특히 1.25 (0.1 반올림이면 1.3 이 된다)', () => {
  for (const v of TTS.RATE_STEPS) assert.equal(snapRate(v), v);
  assert.equal(snapRate('1.25'), 1.25, '문자열도 같은 값이어야 한다(버튼 속성에서 온다)');
});

test('R4 쓰레기 입력은 1.0 으로 — 던지지 않는다', () => {
  assert.equal(snapRate('nope'), 1);
  assert.equal(snapRate(null), 1);
  assert.equal(snapRate(undefined), 1);
  assert.equal(snapRate(NaN), 1);
});

test('R5 speaker.setRate 는 계단에만 앉는다', () => {
  const h = build();
  h.sp.setRate(0.7);
  assert.equal(h.sp.getRate(), 0.75);
  h.sp.setRate(1.25);
  assert.equal(h.sp.getRate(), 1.25, 'clampRate 를 쓰면 1.3 이 되어 계단 밖으로 떨어진다');
});

test('R6 반복 횟수 정규화 — 0 은 무한, 1 은 2 로, 쓰레기는 기본값', () => {
  assert.equal(snapRepeatCount(0), 0);
  assert.equal(snapRepeatCount(1), 2);
  assert.equal(snapRepeatCount(3), 3);
  assert.equal(snapRepeatCount('5'), 5);
  assert.equal(snapRepeatCount('nope'), TTS.REPEAT_COUNT_DEFAULT);
  assert.equal(snapRepeatCount(-4), TTS.REPEAT_COUNT_DEFAULT);
  assert.deepEqual(Array.from(TTS.REPEAT_COUNTS), [2, 3, 5, 0]);
});

/* ══ ② 표시 동기화 — 소스에 못을 박는다 ═════════════════

   팝업의 `1.0×` 와 컨트롤 바의 `0.7×` 가 어긋났던 원인은 **속도를 바꾼
   핸들러가 자기 쪽만 다시 그린 것**이었다(슬라이더 `input` → `paintBar()`
   만 돌고 팝업 안의 `#ttsRateOut` 은 열 때 그린 값 그대로 남았다).
   고친 모양을 유지하는 유일한 방법은 "쓰는 곳이 하나"임을 검사하는 것이다.
   ══════════════════════════════════════════════════════ */

const CONTROLS_SRC = fs.readFileSync(
  fileURLToPath(new URL('../js/ui/controls.js', import.meta.url)), 'utf8');

test('R7 ★ 속도 글자를 쓰는 곳이 하나다 — paintRate() 안에서만', () => {
  const writes = CONTROLS_SRC.match(/els\.(rate|rateOut)\.textContent\s*=/g) || [];
  assert.ok(writes.length >= 2, '속도 글자를 아무 데서도 쓰지 않는다');

  const body = CONTROLS_SRC.slice(CONTROLS_SRC.indexOf('function paintRate()'));
  const end = body.indexOf('\nfunction ');
  const paintRate = body.slice(0, end < 0 ? body.length : end);

  const inside = paintRate.match(/els\.(rate|rateOut)\.textContent\s*=/g) || [];
  assert.equal(inside.length, writes.length,
    'paintRate() 밖에서 속도 글자를 쓰는 곳이 있다 — 다시 어긋난다');

  // 그 한 곳은 speaker 에서 값을 읽는다(화면에 고인 값이 아니라).
  assert.ok(/speaker\.getRate\(\)/.test(paintRate), 'paintRate 가 speaker 를 읽지 않는다');
  // 버튼과 팝업이 **같은 문자열**을 쓴다.
  assert.ok(/els\.rate\.textContent = label;[\s\S]{0,80}els\.rateOut\.textContent = label;/.test(paintRate),
    '두 자리가 같은 값에서 그려지지 않는다');
});

test('R8 연속 슬라이더는 사라졌다 — 계단 버튼만 남는다', () => {
  assert.ok(!/rateInput/.test(CONTROLS_SRC), '슬라이더 참조가 남아 있다');
  const html = fs.readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
  assert.ok(!/id="ttsRateInput"/.test(html), 'index.html 에 속도 슬라이더가 남아 있다');
  assert.ok(/id="ttsRateSteps"/.test(html));
  // 계단 숫자는 HTML 에 없다 — `config.js` 한 곳에서만 읽는다.
  assert.ok(!/data-rate="/.test(html), 'HTML 에 속도 숫자를 박아 두면 config 와 어긋난다');
});

/* ══ ③ 반복 상태 기계 ═════════════════════════════════ */

test('R9 모드 목록은 off/unit/range 셋이고, 모르는 값은 off 다', () => {
  assert.deepEqual(Array.from(REPEAT_MODES), ['off', 'unit', 'range']);
  const h = build();
  h.sp.setRepeat('nonsense');
  assert.equal(h.sp.getRepeat().mode, 'off');
});

test('R10 ★ 한 문장 반복 — N번 읽고 다음으로 넘어간다', () => {
  const h = build();
  h.sp.play();
  h.sp.setRepeat('unit', 3);
  assert.deepEqual(h.synth.spoken, ['Alpha one here.']);

  h.synth.finish();                       // 1회 끝
  assert.deepEqual(h.synth.spoken, ['Alpha one here.', 'Alpha one here.']);
  assert.equal(h.sp.getIndex(), 0);
  assert.equal(h.sp.getRepeat().pass, 1);

  h.synth.finish();                       // 2회 끝
  assert.equal(h.synth.spoken.length, 3);
  assert.equal(h.sp.getIndex(), 0);

  h.synth.finish();                       // 3회 끝 → 다음 발화
  assert.equal(h.synth.spoken[3], 'Beta two here.');
  assert.equal(h.sp.getIndex(), 1);
  assert.equal(h.sp.getRepeat().pass, 0, '회차가 다음 발화로 새면 안 된다');
});

test('R11 반복 중인 줄은 아직 "읽은 줄"이 아니다 — 마지막 회차에만 표시한다', () => {
  const h = build();
  h.sp.play();
  h.sp.setRepeat('unit', 2);
  h.synth.finish();
  assert.deepEqual(h.view.done, [], '반복 중인데 벌써 옅게 칠했다');
  h.synth.finish();
  assert.deepEqual(h.view.done, ['1:1']);
});

test('R12 ★ 구간 반복 — 끝에서 시작으로 되감긴다', () => {
  const h = build();
  h.sp.play();
  h.sp.setRepeat('range', 2);
  h.sp.setRepeatEdge('from');             // 0 번
  h.sp.next();                            // 1 번으로
  h.timers.advance(TTS.CANCEL_DELAY_MS);
  h.sp.next();                            // 2 번으로
  h.timers.advance(TTS.CANCEL_DELAY_MS);
  h.sp.setRepeatEdge('to');               // 구간 = 0..2
  assert.deepEqual(
    { from: h.sp.getRepeat().from, to: h.sp.getRepeat().to }, { from: 0, to: 2 });

  const before = h.synth.spoken.length;
  h.synth.finish();                       // 2 번(구간 끝) 끝 → 0 번으로 되감김
  assert.equal(h.sp.getIndex(), 0);
  assert.equal(h.synth.spoken[before], 'Alpha one here.');

  h.synth.finish();                       // 0 → 1
  assert.equal(h.sp.getIndex(), 1);
  h.synth.finish();                       // 1 → 2
  assert.equal(h.sp.getIndex(), 2);
  h.synth.finish();                       // 2 = 2회차 끝 → 구간을 벗어나 3 번
  assert.equal(h.sp.getIndex(), 3);
  assert.equal(h.sp.getRepeat().pass, 0);
});

test('R13 구간을 고르면 기본값은 지금 문단이다 (아무것도 안 찍어도 뜻이 통한다)', () => {
  const h = build();
  h.sp.play();
  h.sp.setRepeat('range', 2);
  const r = h.sp.getRepeat();
  assert.deepEqual({ from: r.from, to: r.to }, { from: 0, to: 1 }, '첫 문단은 발화 0~1 이다');
});

test('R14 ★ 무한 반복 — 끌 때까지 같은 자리를 돈다', () => {
  const h = build();
  h.sp.play();
  h.sp.setRepeat('unit', 0);
  for (let i = 0; i < 12; i++) h.synth.finish();
  assert.equal(h.sp.getIndex(), 0, '무한 반복이 저절로 풀렸다');
  assert.equal(h.synth.spoken.length, 13);

  // 끄면 원래 흐름으로 돌아온다.
  h.sp.setRepeat('off');
  h.synth.finish();
  assert.equal(h.sp.getIndex(), 1);
  assert.equal(h.synth.spoken[h.synth.spoken.length - 1], 'Beta two here.');
});

test('R15 반복을 켜고 끄는 것은 지금 발화를 건드리지 않는다 (6-4 60ms·세대 규칙 무손상)', () => {
  const h = build();
  h.sp.play();
  const spoken = h.synth.spoken.length;
  const cancels = h.synth.cancelCalls;
  h.sp.setRepeat('unit', 5);
  h.sp.setRepeat('off');
  assert.equal(h.synth.spoken.length, spoken, '반복 설정이 발화를 다시 걸었다');
  assert.equal(h.synth.cancelCalls, cancels, '반복 설정이 cancel 했다');
  assert.equal(h.synth.pauseCalls, 0, '★ 6-4 (1) — pause() 는 영원히 0 이다');
});

test('R16 ★ 워치독이 반복 경로에서도 돈다 — onend 가 유실돼도 멈추지 않는다', () => {
  const h = build();
  h.sp.play();
  h.sp.setRepeat('unit', 3);

  h.synth.finish();                       // 1회 끝 → 같은 발화를 다시 건다
  assert.equal(h.synth.spoken.length, 2);

  // ★ 여기서 **다음 한 발화의 onend 를 오지 않게** 한다(16-C 의 [D]).
  h.sp.simulateStall();
  h.synth.finish();                       // 2회 끝 → 3회차를 거는데, 그것이 먹통이다
  const stalled = h.synth.spoken.length;
  assert.equal(h.synth.spoken[stalled - 1], 'Alpha one here.');

  // 아무 일도 일어나지 않는다 — onend 가 영영 오지 않는다.
  h.timers.advance(watchdogMs('Alpha one here.', h.sp.getRate()) - 1);
  assert.equal(h.synth.spoken.length, stalled, '워치독이 너무 일찍 울었다');

  // 워치독 + cancel 후 60ms.
  h.timers.advance(1 + TTS.CANCEL_DELAY_MS);
  assert.ok(h.synth.spoken.length > stalled, '★ 반복 중에 onend 가 유실되자 낭독이 그 자리에 섰다');
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.sp.getRepeat().pass, 0, '3회차까지 셌으므로 회차가 돌아왔어야 한다');
  assert.equal(h.sp.getIndex(), 1, '워치독이 반복을 끝내고 다음 발화로 넘겼어야 한다');
});

test('R17 무한 반복 중에 onend 가 유실돼도 같은 자리를 계속 읽는다 (조용히 죽지 않는다)', () => {
  const h = build();
  h.sp.play();
  h.sp.setRepeat('unit', 0);
  h.sp.simulateStall();
  h.synth.finish();
  const stalled = h.synth.spoken.length;
  h.timers.advance(watchdogMs('Alpha one here.', h.sp.getRate()) + TTS.CANCEL_DELAY_MS);
  assert.equal(h.synth.spoken.length, stalled + 1);
  assert.equal(h.sp.getIndex(), 0);
  assert.equal(h.sp.getState(), 'speaking');
});

test('R18 못 읽는 문장을 문장 반복이 붙들지 않는다 — 건너뛰고 앞으로 간다', () => {
  const h = build();
  h.sp.play();
  h.sp.setRepeat('unit', 0);              // 무한
  h.synth.fail('synthesis-failed');       // 1차 → 재시도
  h.timers.advance(TTS.CANCEL_DELAY_MS);
  h.synth.fail('synthesis-failed');       // 2차 → 건너뛴다
  assert.equal(h.sp.getIndex(), 1, '무한 반복이 읽히지 않는 문장을 영원히 붙들었다');
  const codes = h.events.filter((e) => e.type === 'error').map((e) => e.detail.code);
  assert.ok(codes.indexOf('TTS_LINE_SKIPPED') >= 0);
});

test('R19 쪽이 넘어가면 구간 반복은 풀린다 (구간은 그 쪽의 인덱스였다)', async () => {
  const h = build();
  h.sp.play();
  h.sp.setRepeat('range', 2);
  assert.equal(h.sp.getRepeat().mode, 'range');

  h.sp.reload();                          // 새 쪽이 그려졌다 = 큐 교체
  assert.equal(h.sp.getRepeat().mode, 'off', '없는 인덱스를 가리키는 구간이 남았다');
});

test('R20 stop() 은 반복까지 끈다 — 리더에 다시 들어와서 "왜 안 넘어가지"가 되지 않게', () => {
  const h = build();
  h.sp.play();
  h.sp.setRepeat('unit', 5);
  h.sp.stop();
  assert.equal(h.sp.getRepeat().mode, 'off');
  assert.equal(h.sp.getRepeat().pass, 0);
});

test('R21 repeatchange 이벤트가 UI 가 그릴 것을 전부 담는다 (3-2 — 문장은 만들지 않는다)', () => {
  const h = build();
  h.sp.play();
  h.events.length = 0;
  h.sp.setRepeat('unit', 3);
  const ev = h.events.filter((e) => e.type === 'repeatchange').pop();
  assert.ok(ev, 'repeatchange 가 오지 않았다');
  assert.deepEqual(Object.keys(ev.detail).sort(), ['count', 'from', 'mode', 'pass', 'to']);
  for (const v of Object.values(ev.detail)) {
    assert.ok(typeof v === 'string' || typeof v === 'number', '서비스 계층이 UI 문자열을 만들었다');
  }
});
