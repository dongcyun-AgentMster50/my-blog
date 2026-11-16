/* ============================================================
   tests/say-11.test.mjs — 11-2 한 번 말하기(`tts/say.js`) · 시트 [▶ 듣기] 경로(`ui/ask.js` `listen`)
   (spec 17-2-1 4-3 7 · 4-5 sayer · 11-D13 · 11-D15 규칙 · 8 "11-2" 수용 기준)

   Y1  한 조각 — 대상 언어 태그(`speechOf`)·속도 · onend → 'end' · busy
   Y2  ★ 300자 넘으면 `splitLong`(번역문 경계 `،`) 조각을 차례로 — 다 끝나야 'end'
   Y3  ★ stop() — 'stopped' · synth.cancel · 늦은 onend 무시 · 말하는 중 새 say → 앞 것 'stopped'
   Y4  워치독 — onend 를 잃으면 `trWatchdogMs` 뒤 다음 조각(멈추지 않는다)
   Y5  엔진 취소 오류(interrupted·canceled) → 'stopped'(되돌림 없음) · 다른 오류 → 다음 조각 → 'end'
   Y6  엔진 없음·빈 글 → 곧장 'end'
   Y7  ★ 시트 [▶ 듣기](`ask.listen`) — 괄호 원어는 소리에서 뺀다(`trSpeechText`) · 읽던 중이면 멈추고 말한 뒤 [▶](pressPlay) ·
       멈춤이면 멈춘 채 · 듣는 중 손(stop) → 되돌림 없음
   Y8  계층 — say.js 는 config·tts/text 만 import, 전역(window·speechSynthesis) 0 · innerHTML 0
   지어낸 글만.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createSayer } from '../js/tts/say.js';
import { trSpeechText, trWatchdogMs, splitLong } from '../js/tts/text.js';
import { TTS, READALONG } from '../js/config.js';
import { createAsk } from '../js/ui/ask.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const flush = () => new Promise((r) => setTimeout(r, 0));

function fakeTimers() {
  let now = 0;
  let seq = 1;
  const jobs = new Map();
  return {
    setTimeout: (fn, ms) => { const k = seq++; jobs.set(k, { fn: fn, at: now + (Number(ms) || 0), ms: ms }); return k; },
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
    pending: () => Array.from(jobs.values())
  };
}

/** 가짜 엔진 — speak 를 쌓고, finish/fail 로 지금 것을 끝낸다. cancel 은 지금 것에 onerror('canceled'). */
function fakeSynth() {
  const s = {
    utt: [], current: null, cancels: 0,
    speak(u) { s.utt.push(u); s.current = u; },
    cancel() { s.cancels++; const u = s.current; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    finish() { const u = s.current; s.current = null; if (u && u.onend) u.onend({}); },
    fail(code) { const u = s.current; s.current = null; if (u && u.onerror) u.onerror({ error: code }); },
    texts() { return s.utt.map((u) => u.text); }
  };
  return s;
}

function rig(o) {
  const x = o || {};
  const synth = x.noSynth ? null : fakeSynth();
  const timers = fakeTimers();
  const sayer = createSayer({
    synth: synth, timers: timers, makeUtterance: (text) => ({ text: text }),
    speechOf: (lang) => ({ tag: lang === 'ar' ? 'ar-SA' : lang === 'ko' ? 'ko-KR' : 'en-US', voice: null }),
    rate: () => x.rate || 1
  });
  return { synth, timers, sayer };
}

test('Y1 한 조각 — 태그·속도 · onend → end · busy', async () => {
  const { synth, sayer } = rig({ rate: 1.25 });
  let how = null;
  const p = sayer.say('ملخص قصير.', 'ar').then((h) => { how = h; });
  assert.equal(sayer.busy(), true);
  assert.equal(synth.utt.length, 1);
  assert.equal(synth.utt[0].lang, 'ar-SA', '대상 언어 태그(8k 해석 — 휴대폰 설정 따름)');
  assert.equal(synth.utt[0].rate, 1.25);
  synth.finish();
  await p;
  assert.equal(how, 'end');
  assert.equal(sayer.busy(), false);
  assert.equal(sayer.stats().says, 1);
});

test('Y2 ★ 300자 넘으면 splitLong(، 경계) 조각을 차례로 — 다 끝나야 end', async () => {
  const { synth, sayer } = rig();
  const part = 'كلمة '.repeat(40).trim();              // 약 200자
  const text = [part, part, part].join('، ');           // 약 600자 — 번역문 경계 «،»
  const want = splitLong(text, TTS.MAX_UTTER_CHARS, READALONG.SPLIT_BREAKS_TR);
  assert.ok(want.length >= 2);
  let how = null;
  const p = sayer.say(text, 'ar').then((h) => { how = h; });
  for (let k = 0; k < want.length; k++) {
    assert.equal(synth.utt.length, k + 1, '한 번에 한 조각');
    assert.equal(synth.utt[k].text, want[k]);
    await flush();
    assert.equal(how, null, '아직 끝나지 않았다');
    synth.finish();
  }
  await p;
  assert.equal(how, 'end');
  assert.ok(synth.utt.every((u) => u.text.length <= TTS.MAX_UTTER_CHARS));
});

test('Y3 ★ stop — stopped · cancel · 늦은 onend 무시 · 새 say 는 앞 것을 끊는다', async () => {
  const { synth, sayer } = rig();
  let a = null;
  const pa = sayer.say('first text.', 'en').then((h) => { a = h; });
  const u0 = synth.current;
  assert.equal(sayer.stop(), true);
  await pa;
  assert.equal(a, 'stopped');
  assert.equal(synth.cancels, 1);
  assert.equal(sayer.busy(), false);
  if (u0.onend) u0.onend({});                          // 늦게 온 onend — 아무 일도 없다
  assert.equal(synth.utt.length, 1);
  assert.equal(sayer.stop(), false, '말하는 중이 아니면 false');
  // 말하는 중 새 say
  let b = null; let c = null;
  const pb = sayer.say('second.', 'en').then((h) => { b = h; });
  const pc = sayer.say('third.', 'en').then((h) => { c = h; });
  await pb;
  assert.equal(b, 'stopped');
  synth.finish();
  await pc;
  assert.equal(c, 'end');
});

test('Y4 워치독 — onend 를 잃으면 trWatchdogMs 뒤 다음 조각', async () => {
  const { synth, timers, sayer } = rig();
  const text = ('word '.repeat(50).trim() + ', ') + 'word '.repeat(50).trim();
  const parts = splitLong(text, TTS.MAX_UTTER_CHARS, READALONG.SPLIT_BREAKS_TR);
  assert.equal(parts.length, 2);
  let how = null;
  const p = sayer.say(text, 'en').then((h) => { how = h; });
  assert.equal(synth.utt.length, 1);
  const ms = trWatchdogMs(parts[0], 1);
  timers.advance(ms - 1);
  assert.equal(synth.utt.length, 1, '아직');
  timers.advance(1);
  assert.equal(synth.utt.length, 2, '워치독 → 다음 조각');
  synth.finish();
  await p;
  assert.equal(how, 'end');
  assert.equal(sayer.stats().watchdogs, 1);
});

test('Y5 엔진 취소 오류 → stopped · 다른 오류 → 다음 조각 → end', async () => {
  for (const code of ['interrupted', 'canceled']) {
    const { synth, sayer } = rig();
    let how = null;
    const p = sayer.say('a sentence.', 'en').then((h) => { how = h; });
    synth.fail(code);
    await p;
    assert.equal(how, 'stopped', code);
  }
  const { synth, sayer } = rig();
  let how = null;
  const p = sayer.say('a sentence.', 'en').then((h) => { how = h; });
  synth.fail('synthesis-failed');
  await p;
  assert.equal(how, 'end', '오류여도 막히지 않는다 — 되돌림으로 간다');
  assert.equal(sayer.stats().errors, 1);
});

test('Y6 엔진 없음·빈 글 → 곧장 end', async () => {
  assert.equal(await rig({ noSynth: true }).sayer.say('x.', 'en'), 'end');
  assert.equal(await rig().sayer.say('   ', 'en'), 'end');
  assert.equal(await rig().sayer.say(null, 'en'), 'end');
});

/* ── Y7 시트 [▶ 듣기] — ask.listen ─────────────────────── */

function fakeSpeaker(state0) {
  const sp = { state: state0, log: [],
    getState() { return sp.state; },
    pause() { sp.log.push('pause'); sp.state = 'paused'; } };
  return sp;
}

test('Y7 ★ [▶ 듣기] — 괄호 원어는 소리에서 뺀다 · 읽던 중이면 멈추고 말한 뒤 [▶] · 멈춤이면 멈춘 채 · 손이 닿으면 되돌림 없음', async () => {
  const gist = 'التهاب المفاصل (rheumatoid arthritis) مزمن، ويصيب المفاصل الصغيرة (small joints).';
  // 읽던 중
  {
    const { synth, sayer } = rig();
    const sp = fakeSpeaker('speaking');
    let presses = 0;
    const ask = createAsk({ speaker: sp, sayer: sayer, pressPlay: () => { presses++; sp.state = 'speaking'; } });
    const p = ask.listen(gist, 'ar');
    assert.deepEqual(sp.log, ['pause'], '말하기 전에 낭독을 멈춘다');
    assert.equal(synth.utt.length, 1);
    assert.equal(synth.utt[0].text, trSpeechText(gist));
    assert.ok(!/arthritis|small joints|\(/.test(synth.utt[0].text), '★ 괄호 속 라틴(원어)은 소리에 없다');
    assert.equal(synth.utt[0].lang, 'ar-SA', '대상 언어 음성');
    synth.finish();
    assert.equal(await p, 'end');
    assert.equal(presses, 1, '읽던 중이었으면 이어 읽기([▶] 와 같은 함수)');
  }
  // 멈춤 — 말한 뒤 멈춘 채
  {
    const { synth, sayer } = rig();
    const sp = fakeSpeaker('paused');
    let presses = 0;
    const ask = createAsk({ speaker: sp, sayer: sayer, pressPlay: () => { presses++; } });
    const p = ask.listen(gist, 'ar');
    assert.deepEqual(sp.log, []);
    synth.finish();
    assert.equal(await p, 'end');
    assert.equal(presses, 0, '멈춘 채');
  }
  // 손이 이긴다 — 듣는 중 stop(controls `cancelVoice` → sayer.stop) → 되돌림 없음
  {
    const { sayer } = rig();
    const sp = fakeSpeaker('speaking');
    let presses = 0;
    const ask = createAsk({ speaker: sp, sayer: sayer, pressPlay: () => { presses++; } });
    const p = ask.listen(gist, 'ar');
    sayer.stop();
    assert.equal(await p, 'stopped');
    assert.equal(presses, 0, '되돌림 없음');
  }
});

test('Y8 계층 — say.js 는 config·tts/text 만 · 전역 0 · innerHTML 0 · ask.js 는 trSpeechText 를 [▶ 듣기]·음성 둘 다에서', () => {
  const s = strip(read('../js/tts/say.js'));
  const imports = [...s.matchAll(/^import [^;]* from '([^']+)';/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['../config.js', './text.js']);
  assert.ok(!/\b(window|document|navigator|speechSynthesis|SpeechSynthesisUtterance)\b/.test(s), 'synth 는 주입(speaker.js 와 같다)');
  assert.ok(!/innerHTML/.test(s));
  const a = strip(read('../js/ui/ask.js'));
  assert.equal((a.match(/sayer\.say\(trSpeechText\(/g) || []).length, 2, '[▶ 듣기]·음성 "요약" 모두 괄호 원어를 뺀 글');
  const c = strip(read('../js/ui/controls.js'));
  assert.match(c, /speechOf: function \(lang\) \{ return langSpeechOf\(lang, voices, settings\.get\); \}/, '번역문 음성과 같은 해석(8k)');
  assert.match(c, /function cancelVoice\(\) \{ if \(voice\) voice\.cancel\(\); if \(sayer\) sayer\.stop\(\); \}/, '★ 손이 이긴다 — [▶]·이전·다음·줄 탭·9a 가 같은 자리');
});
