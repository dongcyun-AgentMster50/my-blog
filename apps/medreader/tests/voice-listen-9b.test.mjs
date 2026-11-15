/* ============================================================
   tests/voice-listen-9b.test.mjs — 9b-1 음성 인식 서비스 (spec 17-1-2 2·4·5·7·9·10절)

   **가짜 인식기 클래스**로 Android Chrome 의 순서(error → end, 언어 불가는 듣기 전)를 흉내 낸다. 시간은 가짜 시계.

   L1  ★ 동기 시작 — `start(lang)` 호출 안에서 `recognition.start()` 1회, 설정(lang·continuous·interim·maxAlternatives 5)
   L2  결과 — 대안 ≤ 5(확신도 그대로) · tag · ms · end 한 번 · 결과 온 아랍어 태그 기억(saveTag) · 영어는 기억 안 함
   L3  ★ V5 사다리 — ar-SY language-not-supported → (end 뒤) 같은 누름에서 ar-JO start 1회 · fallback 이벤트 · 결과 tag = ar-JO
   L4  ★ V5 사다리 — end 가 안 와도 상한(RETRY_WAIT_MS) 뒤 다음 태그 · 앞 인식기 abort
   L5  ★ V5 기억 — 기억한 태그부터 시작 · 끝까지 실패 → error{code:'lang'} + 기억 지움
   L6  ★ V5 available() — 'unavailable' 인 태그로 start 하지 않음 · downloadable 은 씀 · 전부 unavailable 이면 사다리 전부 · 정적 메서드 this
   L7  ★ V6 classify 표 — 웹 오류 9종 + 상한 + start 예외 + 결과 없이 end + 모르는 값
   L8  ★ V6 서비스를 거친 분류 — network/offline · not-allowed 의 두 뜻(권한/바쁨) · 상한 → noSpeech + abort · start·생성자 예외 → service
   L9  ★ 한 번에 하나 — 듣는 중 start 무시(인식기 1개)
   L10 ★ 취소 — cancel 이벤트 · abort 1회 · 늦은 결과·오류 무시 · 사다리 대기 중 취소 = 새 인식기 없음
   L11 미지원(생성자 없음) — isSupported 거짓 · start = unsupported 오류 · 예외 0
   L12 오프라인이어도 막지 않고 시도(9b-D9) · isInfra
   L13 import 방향(3-2) — listen.js 는 config.js 만 · 브라우저 전역 직접 읽기 없음 · 'en-US' 를 박지 않음(W1)
   L14 [9b-2] 낮음-3(fallback 안 abort → 새 시도 없음) · 낮음-4(loadTag 예외에도 결과) · MAX_ALTS 한 곳(VOICE)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createListener, classify, tagsFor, alternativesOf, isInfra, CODES, LISTEN_DEFAULTS } from '../js/voice/listen.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ── 가짜 시계(tests/tts-speaker.test.mjs 의 것 + now) ── */
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
    },
    now: () => now,
    pending: () => jobs.size
  };
}

/* ── 가짜 인식기 클래스 ── */
function fakeRecognitionClass(o) {
  const opt = o || {};
  const instances = [];
  class FakeRec {
    constructor() {
      if (opt.ctorThrows) throw new Error('ctor');
      this.lang = '';
      this.continuous = true;
      this.interimResults = true;
      this.maxAlternatives = 1;
      this.startCalls = 0;
      this.abortCalls = 0;
      this.stopCalls = 0;
      this.onstart = this.onaudiostart = this.onresult = this.onnomatch = this.onerror = this.onend = null;
      instances.push(this);
      if (opt.log) opt.log.push('new');
    }
    start() {
      this.startCalls++;
      if (opt.log) opt.log.push('start:' + this.lang);
      if (opt.startThrows) throw new Error('InvalidStateError');
    }
    stop() { this.stopCalls++; }
    abort() { this.abortCalls++; if (opt.log) opt.log.push('abort:' + this.lang); }
    /** 시험이 부른다. result 는 배열의 배열 — `results[0][k].transcript`, `results[0].isFinal = true`. */
    fire(type, payload) {
      const h = this['on' + type];
      if (typeof h !== 'function') return;
      if (type === 'result') {
        const results = payload.map((alts) => { const r = alts.slice(); r.isFinal = true; return r; });
        h.call(this, { resultIndex: 0, results: results });
      } else if (type === 'error') {
        h.call(this, { error: payload });
      } else {
        h.call(this, {});
      }
    }
  }
  if (opt.available) FakeRec.available = opt.available;
  return { Rec: FakeRec, instances: instances };
}

function build(o) {
  const opt = o || {};
  const timers = fakeTimers();
  const fk = fakeRecognitionClass(opt.rec);
  const saved = [];
  let tag = opt.tag || '';
  const deps = {
    Recognition: opt.noCtor ? null : fk.Rec,
    timers: timers,
    now: timers.now,
    onLine: () => (opt.onLine === undefined ? true : opt.onLine),
    micState: () => (opt.mic === undefined ? null : opt.mic),
    loadTag: () => tag,
    saveTag: (t) => { saved.push(t); tag = t; }
  };
  if ('available' in opt) deps.available = opt.available;
  const L = createListener(deps);
  const events = [];
  for (const type of ['result', 'error', 'cancel', 'fallback', 'end']) {
    L.addEventListener(type, (ev) => events.push({ type: type, detail: ev.detail }));
  }
  return { L: L, timers: timers, recs: fk.instances, saved: saved, events: events, Rec: fk.Rec };
}

const types = (b) => b.events.map((e) => e.type);
const last = (b, type) => b.events.filter((e) => e.type === type).pop();

/* ══ L1 동기 시작 ══════════════════════════════════════════ */

test('L1 ★ 동기 시작 — start() 호출 안에서 recognition.start() 1회, 설정', () => {
  const log = [];
  const b = build({ rec: { log: log } });
  log.push('before');
  const ok = b.L.start('ar');
  log.push('after');
  assert.equal(ok, true);
  assert.deepEqual(log, ['before', 'new', 'start:ar-SY', 'after'], '같은 동기 호출 안에서 start');
  assert.equal(b.recs.length, 1);
  const r = b.recs[0];
  assert.equal(r.lang, 'ar-SY');
  assert.equal(r.continuous, false);
  assert.equal(r.interimResults, false);
  assert.equal(r.maxAlternatives, 5);
  assert.equal(r.startCalls, 1);
  assert.equal(b.L.isListening(), true);
  assert.equal(b.L.isSupported(), true);
  assert.deepEqual(b.events, []);
});

/* ══ L2 결과 ═══════════════════════════════════════════════ */

test('L2 결과 — 대안 ≤ 5 · tag · ms · end 한 번 · 아랍어 태그 기억', () => {
  const b = build();
  b.L.start('ar');
  b.timers.advance(1234);
  const alts = ['التالي', 'التالية', 'تالي', 'الثاني', 'التاني', 'السادس', 'السابع'].map((t, i) => ({ transcript: ' ' + t + ' ', confidence: i === 0 ? 0.8 : 0 }));
  b.recs[0].fire('result', [alts]);
  assert.deepEqual(types(b), ['result', 'end']);
  const d = last(b, 'result').detail;
  assert.equal(d.alternatives.length, 5);
  assert.deepEqual(d.alternatives[0], { transcript: 'التالي', confidence: 0.8 });
  assert.equal(d.alternatives[4].transcript, 'التاني');
  assert.equal(d.tag, 'ar-SY');
  assert.equal(d.ms, 1234);
  assert.deepEqual(d.tried, ['ar-SY']);
  assert.deepEqual(last(b, 'end').detail, { outcome: 'result' });
  assert.deepEqual(b.saved, ['ar-SY']);
  assert.equal(b.L.isListening(), false);
  assert.equal(b.timers.pending(), 0, '상한 타이머가 남지 않는다');
  // Chrome 이 그 뒤에 end 를 보내도 아무 일 없음
  b.recs[0].fire('end');
  assert.deepEqual(types(b), ['result', 'end']);

  // 같은 태그를 다시 받으면 다시 저장하지 않는다
  b.L.start('ar');
  b.recs[1].fire('result', [[{ transcript: 'قف', confidence: 1 }]]);
  assert.deepEqual(b.saved, ['ar-SY']);

  // 영어 — en-US, 기억 안 함
  const e = build();
  e.L.start('en');
  assert.equal(e.recs[0].lang, 'en-US');
  e.recs[0].fire('result', [[{ transcript: 'next', confidence: 0.5 }]]);
  assert.equal(last(e, 'result').detail.tag, 'en-US');
  assert.deepEqual(e.saved, []);

  // alternativesOf — 빈 글자 빼기 · 확신도 모름 = null
  assert.deepEqual(alternativesOf({ results: [Object.assign([{ transcript: '  ' }, { transcript: 'x' }], { isFinal: true })] }, 5),
    [{ transcript: 'x', confidence: null }]);
  assert.deepEqual(alternativesOf({}, 5), []);
});

/* ══ L3·L4 사다리 ══════════════════════════════════════════ */

test('L3 ★ V5 사다리 — ar-SY 언어 불가 → end 뒤 같은 누름에서 ar-JO start 1회 → tag = ar-JO', () => {
  const b = build();
  b.L.start('ar');
  b.recs[0].fire('error', 'language-not-supported');
  assert.equal(b.recs.length, 1, 'end 전에는 다음 인식기를 만들지 않는다(바쁨 → not-allowed 방지)');
  assert.equal(b.L.isListening(), true, '사다리 대기도 듣는 중');
  b.recs[0].fire('end');
  assert.equal(b.recs.length, 2);
  assert.equal(b.recs[1].lang, 'ar-JO');
  assert.equal(b.recs[1].startCalls, 1);
  assert.deepEqual(types(b), ['fallback']);
  assert.deepEqual(last(b, 'fallback').detail, { from: 'ar-SY', to: 'ar-JO' });
  b.timers.advance(5000);   // 상한 타이머는 시도마다 새로
  assert.deepEqual(types(b), ['fallback']);
  b.recs[1].fire('result', [[{ transcript: 'التالي', confidence: 1 }]]);
  assert.deepEqual(types(b), ['fallback', 'result', 'end']);
  const d = last(b, 'result').detail;
  assert.equal(d.tag, 'ar-JO');
  assert.deepEqual(d.tried, ['ar-SY', 'ar-JO']);
  assert.deepEqual(b.saved, ['ar-JO'], '된 태그를 기억한다');
  // 다음 누름은 ar-JO 부터
  b.L.start('ar');
  assert.equal(b.recs[2].lang, 'ar-JO');
});

test('L4 ★ V5 사다리 — end 가 안 와도 RETRY_WAIT_MS 뒤 다음 태그, 앞 인식기 abort', () => {
  const b = build();
  b.L.start('ar');
  b.recs[0].fire('error', 'language-not-supported');
  b.timers.advance(LISTEN_DEFAULTS.RETRY_WAIT_MS - 1);
  assert.equal(b.recs.length, 1);
  b.timers.advance(1);
  assert.equal(b.recs.length, 2);
  assert.equal(b.recs[1].lang, 'ar-JO');
  assert.equal(b.recs[0].abortCalls, 1);
  // 늦게 온 앞 인식기의 end 는 무시
  b.recs[0].fire('end');
  assert.equal(b.recs.length, 2);
  assert.equal(b.L.isListening(), true);
});

test('L5 ★ V5 기억한 태그부터 · 끝까지 실패 → lang + 기억 지움', () => {
  const b = build({ tag: 'ar-JO' });
  b.L.start('ar');
  assert.equal(b.recs[0].lang, 'ar-JO');
  b.recs[0].fire('error', 'language-not-supported'); b.recs[0].fire('end');
  assert.equal(b.recs[1].lang, 'ar');
  b.recs[1].fire('error', 'language-not-supported'); b.recs[1].fire('end');
  assert.equal(b.recs.length, 2, '사다리 끝 — 더 만들지 않는다');
  assert.deepEqual(types(b), ['fallback', 'error', 'end']);
  const d = last(b, 'error').detail;
  assert.equal(d.code, 'lang');
  assert.equal(d.raw, 'language-not-supported');
  assert.deepEqual(d.tried, ['ar-JO', 'ar']);
  assert.deepEqual(b.saved, [''], '기억을 지워 다음 누름은 맨 위부터');
  b.L.start('ar');
  assert.equal(b.recs[2].lang, 'ar-SY');

  // 기억 없이 셋 다 실패
  const c = build();
  c.L.start('ar');
  for (let i = 0; i < 3; i++) { c.recs[i].fire('error', 'language-not-supported'); c.recs[i].fire('end'); }
  assert.deepEqual(c.recs.map((r) => r.lang), ['ar-SY', 'ar-JO', 'ar']);
  assert.equal(last(c, 'error').detail.code, 'lang');
  assert.deepEqual(c.saved, []);
  // 영어는 사다리가 없다
  const e = build();
  e.L.start('en');
  e.recs[0].fire('error', 'language-not-supported');
  assert.equal(last(e, 'error').detail.code, 'lang');
  assert.equal(e.recs.length, 1);

  // tagsFor — 순수
  assert.deepEqual(tagsFor('ar', ''), ['ar-SY', 'ar-JO', 'ar']);
  assert.deepEqual(tagsFor('ar', 'ar'), ['ar']);
  assert.deepEqual(tagsFor('ar', 'xx-YY'), ['ar-SY', 'ar-JO', 'ar']);
  assert.deepEqual(tagsFor('ar', '', ['ar-SY']), ['ar-JO', 'ar']);
  assert.deepEqual(tagsFor('ar', '', new Set(['ar-SY', 'ar-JO', 'ar'])), ['ar-SY', 'ar-JO', 'ar']);
  assert.deepEqual(tagsFor('en', 'ar-JO'), ['en-US']);
});

test('L6 ★ V5 available() — unavailable 만 건너뜀 · 전부면 믿지 않음 · 정적 메서드 this', async () => {
  const asked = [];
  const ans = { 'ar-SY': 'unavailable', 'ar-JO': 'downloadable', 'ar': 'available' };
  const b = build({ available: (o) => { asked.push(o); return Promise.resolve(ans[o.langs[0]]); } });
  const first = await b.L.preflight('ar');
  assert.equal(first, 'ar-JO');
  assert.deepEqual(asked, [{ langs: ['ar-SY'] }, { langs: ['ar-JO'] }]);
  assert.equal(b.recs.length, 0, 'preflight 는 인식기를 만들지 않는다');
  b.L.start('ar');
  assert.deepEqual(b.recs.map((r) => r.lang), ['ar-JO'], 'unavailable 인 ar-SY 로 start 하지 않는다');

  // 전부 unavailable → 그 답을 믿지 않고 사다리 전부
  const all = build({ available: () => Promise.resolve('unavailable') });
  assert.equal(await all.L.preflight('ar'), null);
  assert.deepEqual(all.L.skipped().sort(), ['ar', 'ar-JO', 'ar-SY']);
  all.L.start('ar');
  assert.equal(all.recs[0].lang, 'ar-SY');

  // available 이 던지면 모름(null) — 건너뛰지 않는다
  const thr = build({ available: () => Promise.reject(new Error('x')) });
  assert.equal(await thr.L.preflight('ar'), null);
  thr.L.start('ar');
  assert.equal(thr.recs[0].lang, 'ar-SY');

  // available 없음 → null, 아무 일 없음
  const none = build({ available: null });
  assert.equal(await none.L.preflight('ar'), null);

  // 주입 생략 → Recognition.available 을 정적 메서드로(this = 생성자) 부른다
  let self = null;
  const st = build({ rec: { available: function (o) { self = this; return Promise.resolve(o.langs[0] === 'ar-SY' ? 'unavailable' : 'available'); } } });
  assert.equal(await st.L.preflight('ar'), 'ar-JO');
  assert.equal(self, st.Rec);
  // 영어
  const en = build({ available: (o) => Promise.resolve(o.langs[0] === 'en-US' ? 'available' : 'unavailable') });
  assert.equal(await en.L.preflight('en'), 'en-US');
});

/* ══ L7·L8 오류 분류 ═══════════════════════════════════════ */

test('L7 ★ V6 classify 표', () => {
  const T = [
    // [raw, ctx, 기대]
    ['not-allowed', {}, 'permission'],
    ['not-allowed', { started: true }, 'busy'],
    ['not-allowed', { everOk: true }, 'busy'],
    ['not-allowed', { mic: 'granted' }, 'busy'],
    ['not-allowed', { mic: 'denied', started: true, everOk: true }, 'permission'],
    ['not-allowed', { mic: 'prompt' }, 'permission'],
    ['service-not-allowed', {}, 'service'],
    ['bad-grammar', {}, 'service'],
    ['start-threw', {}, 'service'],
    ['network', {}, 'network'],
    ['network', { onLine: true }, 'network'],
    ['network', { onLine: false }, 'offline'],
    ['audio-capture', {}, 'mic'],
    ['language-not-supported', {}, 'lang'],
    ['no-speech', {}, 'noSpeech'],
    ['timeout', {}, 'noSpeech'],
    ['end-without-result', {}, 'noSpeech'],
    ['no-match', {}, 'noMatch'],
    ['no-alternatives', {}, 'noMatch'],
    ['aborted', {}, 'aborted'],
    ['something-new', {}, 'service'],
    ['', {}, 'service']
  ];
  for (const [raw, ctx, want] of T) assert.equal(classify(raw, ctx), want, raw + ' ' + JSON.stringify(ctx));
  assert.equal(classify('network'), 'network');
  // 분류 값은 CODES 안
  const codes = new Set(Object.values(CODES));
  for (const [raw, ctx] of T) assert.ok(codes.has(classify(raw, ctx)), raw);
});

test('L8 ★ V6 서비스를 거친 분류', () => {
  const run = (o, script) => {
    const b = build(o);
    b.L.start(o.lang || 'ar');
    script(b);
    return b;
  };
  // network — onLine 에 따라
  let b = run({ onLine: false }, (x) => { x.recs[0].fire('error', 'network'); x.recs[0].fire('end'); });
  assert.equal(last(b, 'error').detail.code, 'offline');
  assert.deepEqual(types(b), ['error', 'end'], 'error 뒤 end 는 한 번');
  b = run({ onLine: true }, (x) => x.recs[0].fire('error', 'network'));
  assert.equal(last(b, 'error').detail.code, 'network');
  assert.equal(last(b, 'error').detail.raw, 'network');
  // not-allowed — 듣기 전 = 권한, 듣기 시작 뒤 = 바쁨, 마이크 granted = 바쁨
  b = run({}, (x) => x.recs[0].fire('error', 'not-allowed'));
  assert.equal(last(b, 'error').detail.code, 'permission');
  b = run({}, (x) => { x.recs[0].fire('start'); x.recs[0].fire('error', 'not-allowed'); });
  assert.equal(last(b, 'error').detail.code, 'busy');
  b = run({}, (x) => { x.recs[0].fire('audiostart'); x.recs[0].fire('error', 'not-allowed'); });
  assert.equal(last(b, 'error').detail.code, 'busy');
  b = run({ mic: 'granted' }, (x) => x.recs[0].fire('error', 'not-allowed'));
  assert.equal(last(b, 'error').detail.code, 'busy');
  b = run({ mic: 'denied' }, (x) => { x.recs[0].fire('start'); x.recs[0].fire('error', 'not-allowed'); });
  assert.equal(last(b, 'error').detail.code, 'permission');
  // 한 번 결과를 받은 뒤의 not-allowed = 바쁨(권한은 있었다)
  b = run({}, (x) => { x.recs[0].fire('result', [[{ transcript: 'قف' }]]); x.L.start('ar'); x.recs[1].fire('error', 'not-allowed'); });
  assert.equal(last(b, 'error').detail.code, 'busy');
  // 그 밖
  for (const [raw, code] of [['service-not-allowed', 'service'], ['audio-capture', 'mic'], ['no-speech', 'noSpeech'],
    ['no-match', 'noMatch'], ['aborted', 'aborted'], ['bad-grammar', 'service'], ['weird', 'service']]) {
    b = run({}, (x) => x.recs[0].fire('error', raw));
    assert.equal(last(b, 'error').detail.code, code, raw);
    assert.equal(b.L.isListening(), false, raw);
  }
  // nomatch 이벤트 · 대안 0
  b = run({}, (x) => x.recs[0].fire('nomatch'));
  assert.equal(last(b, 'error').detail.code, 'noMatch');
  b = run({}, (x) => x.recs[0].fire('result', [[{ transcript: '   ' }]]));
  assert.equal(last(b, 'error').detail.code, 'noMatch');
  // 결과 없이 end
  b = run({}, (x) => x.recs[0].fire('end'));
  assert.equal(last(b, 'error').detail.code, 'noSpeech');
  assert.equal(last(b, 'error').detail.raw, 'end-without-result');
  // 앱 상한 → abort + noSpeech
  b = run({}, (x) => x.timers.advance(LISTEN_DEFAULTS.LISTEN_MAX_MS - 1));
  assert.deepEqual(b.events, []);
  b.timers.advance(1);
  assert.equal(last(b, 'error').detail.code, 'noSpeech');
  assert.equal(last(b, 'error').detail.raw, 'timeout');
  assert.equal(last(b, 'error').detail.ms, LISTEN_DEFAULTS.LISTEN_MAX_MS);
  assert.equal(b.recs[0].abortCalls, 1);
  b.recs[0].fire('error', 'aborted'); b.recs[0].fire('end');   // abort 의 뒤따름은 무시
  assert.deepEqual(types(b), ['error', 'end']);
  // start() 예외 → service, 듣는 중 아님
  b = build({ rec: { startThrows: true } });
  assert.equal(b.L.start('ar'), false);
  assert.equal(last(b, 'error').detail.code, 'service');
  assert.equal(last(b, 'error').detail.raw, 'start-threw');
  assert.equal(b.L.isListening(), false);
  assert.equal(b.timers.pending(), 0);
  // 생성자 예외 → service
  b = build({ rec: { ctorThrows: true } });
  assert.doesNotThrow(() => b.L.start('ar'));
  assert.equal(last(b, 'error').detail.code, 'service');
});

/* ══ L9 한 번에 하나 ═══════════════════════════════════════ */

test('L9 ★ 한 번에 하나 — 듣는 중 start 무시', () => {
  const b = build();
  assert.equal(b.L.start('ar'), true);
  assert.equal(b.L.start('ar'), false);
  assert.equal(b.L.start('en'), false);
  assert.equal(b.recs.length, 1);
  assert.equal(b.recs[0].startCalls, 1);
  // 사다리 대기 중에도
  b.recs[0].fire('error', 'language-not-supported');
  assert.equal(b.L.start('ar'), false);
  b.recs[0].fire('end');
  assert.equal(b.recs.length, 2);
});

/* ══ L10 취소 ══════════════════════════════════════════════ */

test('L10 ★ 취소 — cancel · abort 1회 · 늦은 콜백 무시 · 사다리 대기 중 취소', () => {
  const b = build();
  b.L.start('ar');
  b.timers.advance(700);
  assert.equal(b.L.abort(), true);
  assert.deepEqual(types(b), ['cancel', 'end']);
  assert.equal(last(b, 'cancel').detail.ms, 700);
  assert.equal(b.recs[0].abortCalls, 1);
  assert.equal(b.L.isListening(), false);
  b.recs[0].fire('error', 'aborted');
  b.recs[0].fire('result', [[{ transcript: 'التالي' }]]);
  b.recs[0].fire('end');
  b.timers.advance(20000);
  assert.deepEqual(types(b), ['cancel', 'end'], '늦은 콜백·상한 무시');
  assert.equal(b.L.abort(), false, '듣는 중이 아니면 false');
  assert.deepEqual(b.saved, []);

  // 사다리 대기 중 취소 → 새 인식기 없음
  const c = build();
  c.L.start('ar');
  c.recs[0].fire('error', 'language-not-supported');
  c.L.abort();
  c.recs[0].fire('end');
  c.timers.advance(5000);
  assert.equal(c.recs.length, 1);
  assert.deepEqual(types(c), ['cancel', 'end']);

  // 취소 뒤 다시 시작 가능
  b.L.start('ar');
  assert.equal(b.recs.length, 2);
});

/* ══ L11 미지원 ════════════════════════════════════════════ */

test('L11 미지원 — 생성자 없음', async () => {
  const b = build({ noCtor: true });
  assert.equal(b.L.isSupported(), false);
  assert.equal(b.L.start('ar'), false);
  assert.equal(last(b, 'error').detail.code, 'unsupported');
  assert.equal(b.L.isListening(), false);
  assert.equal(b.L.abort(), false);
  assert.equal(await b.L.preflight('ar'), null);
  assert.doesNotThrow(() => createListener());
  assert.equal(createListener({}).isSupported(), false);
});

/* ══ L12 오프라인 · isInfra ════════════════════════════════ */

test('L12 오프라인이어도 막지 않고 시도(9b-D9) · isInfra', () => {
  const b = build({ onLine: false });
  assert.equal(b.L.start('ar'), true);
  assert.equal(b.recs[0].startCalls, 1);
  for (const c of ['permission', 'busy', 'service', 'network', 'offline', 'mic', 'lang']) assert.equal(isInfra(c), true, c);
  for (const c of ['noSpeech', 'noMatch', 'aborted', 'unsupported']) assert.equal(isInfra(c), false, c);
});

/* ══ L13 import 방향 ═══════════════════════════════════════ */

test('L13 import 방향(3-2) — listen.js 는 config.js 만 · 전역 직접 읽기 없음', () => {
  const src = noComments(read('../js/voice/listen.js'));
  const imports = Array.from(src.matchAll(/^\s*import\b[^;]*?from\s*'([^']+)'/gm)).map((m) => m[1]);
  assert.deepEqual(imports, ['../config.js'], 'config 만(ui·speaker·i18n·settings 없음)');
  assert.ok(!/'en-US'/.test(src), '지역 태그를 박지 않는다(W1)');
  assert.ok(!/\bimport\s*\(/.test(src), '동적 import 없음');
  assert.ok(!/\b(window|document|navigator|localStorage|SpeechRecognition|webkitSpeechRecognition|speechSynthesis)\b/.test(src),
    '브라우저 전역을 직접 읽지 않는다(주입)');
  assert.deepEqual(LISTEN_DEFAULTS.AR_TAGS, ['ar-SY', 'ar-JO', 'ar']);
  assert.equal(LISTEN_DEFAULTS.EN_TAG, 'en-US');
  assert.equal(LISTEN_DEFAULTS.LISTEN_MAX_MS, 8000);
  assert.equal(LISTEN_DEFAULTS.MAX_ALTS, 5);
});

/* ══ L14 `[9b-2]` 9b-1 Review 낮음-3·4 고침 ═══════════════════ */

test('L14 [9b-2] fallback 핸들러 안 abort() → 새 시도 없음·예외 없음 · loadTag 가 던져도 결과를 버리지 않는다 · MAX_ALTS 한 곳', async () => {
  // 낮음-3 — fallback 안에서 abort(): cancel + end 로 끝나고, 다음 인식기를 만들지 않는다(옛 코드는 TypeError).
  const b = build();
  b.L.addEventListener('fallback', () => { b.L.abort(); });
  b.L.start('ar');
  b.recs[0].fire('error', 'language-not-supported');
  b.recs[0].fire('end');
  assert.equal(b.recs.length, 1, '새 시도 없음');
  assert.deepEqual(types(b), ['fallback', 'cancel', 'end']);
  assert.equal(b.L.isListening(), false);
  // 낮음-4 — 던지는 저장소여도 결과 이벤트는 나간다
  const timers = fakeTimers();
  const fk = fakeRecognitionClass();
  const L = createListener({ Recognition: fk.Rec, timers: timers, now: timers.now,
    loadTag: () => { throw new Error('storage'); }, saveTag: () => { throw new Error('storage'); } });
  const ev = [];
  for (const t of ['result', 'error', 'end']) L.addEventListener(t, (e) => ev.push(t + ':' + (e.detail.code || '')));
  L.start('ar');
  fk.instances[0].fire('result', [[{ transcript: 'التالي', confidence: 1 }]]);
  assert.deepEqual(ev, ['result:', 'end:']);
  // MAX_ALTS — 인식기와 매칭이 같은 값(config VOICE)
  const { VOICE } = await import('../js/config.js');
  const { MAX_ALTS } = await import('../js/voice/commands.js');
  assert.equal(LISTEN_DEFAULTS, VOICE);
  assert.equal(MAX_ALTS, VOICE.MAX_ALTS);
  assert.equal(fk.instances[0].maxAlternatives, VOICE.MAX_ALTS);
});
