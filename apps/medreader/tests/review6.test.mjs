/* ============================================================
   tests/review6.test.mjs — 6단계 Review 가 찾은 것들을 고정한다

   세 가지다.
     ① `reload()` 가 인자 없이 불리면 낭독이 쪽 첫 발화로 되돌아갔다.
        뷰를 바꿀 때마다 일어났다(실측 3/36 → 0/36).
     ② `/Rotate 90·270` 쪽에서 레이아웃에 회전된 치수를 넘겨
        4-6 클립이 줄 bbox 를 통째로 납작하게 만들었다(높이 0).
     ③ `algoVersion` 을 고정하는 테스트가 **없었다** — 변이(7→6)에
        아무 테스트도 빨개지지 않았다. 이 값이 바뀌면 모든 문서가
        재추출되므로, 바꾸는 일은 반드시 의도적이어야 한다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createSpeaker } from '../js/tts/speaker.js';
import { unrotatedPageSize } from '../js/pdf/extract.js';
import { buildPageLayout, algoVersion } from '../js/text/layout.js';
import { storeVersion } from '../js/text/store.js';

/* ────────────────────────────────────────────────────────
   ① reload() 가 제자리를 지키는가
   ──────────────────────────────────────────────────────── */

function fakeSynth() {
  const s = {
    speaking: false, current: null, spoken: [], cancelCalls: 0, pauseCalls: 0,
    speak(u) { s.speaking = true; s.current = u; s.spoken.push(u.text); },
    pause() { s.pauseCalls++; },
    resume() { s.pauseCalls++; },
    cancel() {
      s.cancelCalls++;
      const u = s.current; s.speaking = false; s.current = null;
      if (u && u.onerror) u.onerror({ error: 'canceled' });
    },
    finish() {
      const u = s.current; s.speaking = false; s.current = null;
      if (u && u.onend) u.onend();
    }
  };
  return s;
}

function fakeTimers() {
  let now = 0, seq = 1;
  const jobs = new Map();
  return {
    setTimeout: (fn, ms) => { const k = seq++; jobs.set(k, { fn, at: now + (Number(ms) || 0) }); return k; },
    clearTimeout: (k) => { jobs.delete(k); },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let pick = null, key = null;
        for (const [k, j] of jobs) if (j.at <= target && (pick === null || j.at < pick.at)) { pick = j; key = k; }
        if (!pick) break;
        jobs.delete(key); now = pick.at; pick.fn();
      }
      now = target;
    }
  };
}

const ln = (id, text) => ({ id, text, hyphen: 'none' });

/** 한 쪽에 문장 넷. 뷰를 바꿔도 내용은 같다 — 바뀌는 것은 화면뿐이다. */
function makeView() {
  const paras = [{
    id: 'p1', kind: 'body',
    lines: [ln('1:1', 'Alpha one.'), ln('1:2', 'Beta two.'), ln('1:3', 'Gamma three.'), ln('1:4', 'Delta four.')]
  }];
  return {
    paras: () => paras,
    page: () => ({ page: 1, pageCount: 2 }),
    goToPage: () => Promise.resolve(true),
    show: () => true,
    markDone: () => { }
  };
}

function build(view) {
  const synth = fakeSynth();
  const timers = fakeTimers();
  const sp = createSpeaker({
    synth, timers,
    makeUtterance: (text) => ({ text }),
    view: view || makeView(),
    requestWakeLock: () => Promise.resolve({ release() { } })
  });
  return { sp, synth, timers };
}

test('V1 ★ 인자 없는 reload() 가 낭독을 쪽 첫 발화로 되돌리지 않는다', () => {
  // 뷰 전환 경로: controls.js 의 onPageRender(() => speaker.reload()) 가
  // 인자 없이 부른다. 같은 쪽을 다시 그린 것이므로 제자리를 지켜야 한다.
  const { sp, synth } = build();
  sp.play();
  synth.finish();                       // 1 → 2
  synth.finish();                       // 2 → 3
  assert.equal(sp.getIndex(), 2, '사전 조건: 세 번째 발화를 읽고 있어야 한다');

  sp.reload();                          // ← 뷰 전환

  assert.equal(sp.getIndex(), 2, '뷰만 바꿨는데 낭독이 되돌아갔다');
  assert.equal(sp.getState(), 'speaking', '뷰 전환이 낭독을 멈췄다');
});

test('V2 reload(lineId) 로 기준 줄을 지정하면 그 줄로 간다', () => {
  const { sp, synth } = build();
  sp.play();
  synth.finish();
  sp.reload('1:4');
  assert.equal(sp.getIndex(), 3);
});

test('V3 기준 줄이 새 큐에 없으면 처음으로 간다 — 쪽 넘김이 이 경로다', () => {
  // 쪽을 넘기면 지금 줄(1:x)은 새 쪽의 큐에 없다 → indexOfLine 이 -1 → 0.
  const paras2 = [{ id: 'p2', kind: 'body', lines: [ln('2:1', 'Next page one.'), ln('2:2', 'Next page two.')] }];
  const view = makeView();
  const { sp, synth } = build(view);
  sp.play();
  synth.finish();
  synth.finish();
  assert.equal(sp.getIndex(), 2);

  view.paras = () => paras2;            // 쪽이 넘어갔다
  sp.reload();

  assert.equal(sp.getIndex(), 0, '다른 쪽으로 넘어갔으면 그 쪽 처음부터여야 한다');
});

test('V4 멈춰 있을 때 reload() 는 재생을 시작하지 않는다', () => {
  const { sp, synth } = build();
  sp.reload();
  assert.equal(sp.getState(), 'idle');
  assert.equal(synth.spoken.length, 0);
});

/* ────────────────────────────────────────────────────────
   ② 회전 쪽 치수
   ──────────────────────────────────────────────────────── */

test('V5 ★ /Rotate 90·270 의 뒤바뀐 치수 대신 회전 전 치수를 쓴다', () => {
  // pdf.js: page.view 는 회전 전 cropBox, getViewport 는 회전 후.
  // getTextContent() 좌표는 **회전 전** 공간이므로 page.view 를 써야 한다.
  const view = [0, 0, 612, 792];
  assert.deepEqual(unrotatedPageSize(view, 792, 612), { width: 612, height: 792 },
    '회전된 viewport 치수를 그대로 쓰면 클립이 bbox 를 납작하게 만든다');
  assert.deepEqual(unrotatedPageSize(view, 612, 792), { width: 612, height: 792 });
});

test('V6 page.view 가 없거나 깨졌으면 viewport 치수로 물러선다 (추측하지 않는다)', () => {
  assert.deepEqual(unrotatedPageSize(null, 612, 792), { width: 612, height: 792 });
  assert.deepEqual(unrotatedPageSize([0, 0], 612, 792), { width: 612, height: 792 });
  assert.deepEqual(unrotatedPageSize([0, 0, 0, 0], 612, 792), { width: 612, height: 792 });
  assert.deepEqual(unrotatedPageSize([0, 0, NaN, 792], 612, 792), { width: 612, height: 792 });
});

test('V7 원점이 0 이 아닌 cropBox 도 폭·높이로 환산한다', () => {
  assert.deepEqual(unrotatedPageSize([20, 30, 632, 822], 0, 0), { width: 612, height: 792 });
});

test('V8 ★ 회전 쪽 치수로 클립하면 줄이 납작해진다 — 왜 고쳤는지', () => {
  // 실측 재현: /Rotate 90 에서 vp 는 [792, 612] 인데 텍스트는 y≈700 에 있다.
  const items = [];
  for (let i = 0; i < 5; i++) {
    items.push({
      str: 'Rotated line ' + i,
      transform: [12, 0, 0, 12, 72, 700 - i * 14],
      width: 120, height: 12, fontName: 'F1'
    });
  }
  const wrong = buildPageLayout(items, { pageNo: 1, width: 792, height: 612, styles: {} });
  const right = buildPageLayout(items, { pageNo: 1, width: 612, height: 792, styles: {} });

  assert.ok(wrong.stats.bboxDegenerate > 0, '뒤바뀐 치수인데 degenerate 가 0 이면 이 결함을 못 잡는다');
  assert.equal(right.stats.bboxDegenerate, 0, '회전 전 치수로는 납작해지지 않아야 한다');
  assert.ok(right.lines[0].bbox.y1 - right.lines[0].bbox.y0 > 0, '줄 높이가 살아 있어야 한다');
});

/* ────────────────────────────────────────────────────────
   ③ 재추출 경첩을 고정한다
   ──────────────────────────────────────────────────────── */

test('V9 ★ algoVersion 은 8 이다 — 바꾸려면 이 테스트를 같이 고쳐야 한다', () => {
  // 이 숫자를 올리면 **이미 저장된 모든 문서가 재추출된다**(9-4 planResume).
  // 7000쪽 문서에서는 그 대가가 크다. 그러니 우발적으로 바뀌면 안 된다.
  // 올릴 이유가 생겼다면 layout.js 의 버전 이력 주석에 근거를 적고 여기를 고쳐라.
  // 7 → 8: 9a 에서 5-3 정답 글자를 [A-J] 로 넓혀 paragraphs[].kind 가 3개 바뀜다.
  assert.equal(algoVersion, 8);
});

test('V10 storeVersion 은 1 이다 — 저장 그릇 모양이 바뀔 때만 올린다', () => {
  assert.equal(storeVersion, 1);
});
