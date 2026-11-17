/* ============================================================
   tests/voice-ui-9b.test.mjs — 9b-2 음성 명령 흐름 (spec 17-1-2 9절 V7–V12 · 10절)

   `ui/voice.js` 의 `createVoice` 를 DOM 없이 — **진짜** `createSpeaker`(가짜 synth·가짜 시계 — tts-speaker·handsfree-9a 와 같은 모양)
   + 가짜 인식기 클래스(voice-listen-9b 와 같은 모양) + 가짜 설정 + 가짜 그리기. 브라우저 전역은 만지지 않는다(주입만).
   문장은 전부 지어낸 것이다.

   U1  ★ V7 동기 — speaking 에서 탭 → 같은 호출 안에서 speaker.pause() 다음 recognition.start() · 결과 next → +1 · speaking
   U2  ★ V7 멈춤에서 next → 하이라이트만 · paused · 쪽 끝(읽는 중) next → 다음 쪽(waiting-page/goToPage)
   U3  ★ V8 되돌림 — nomatch·no-speech·network → 안내 뒤 같은 인덱스 speaking · pause 명령 → paused 유지 · hidden → 되돌림 없음
   U4  ★ V9 again — 멈춤+phase tr → src · 같은 인덱스 · 읽던 중이었으면 원문부터(번역문 이어 읽기 아님)
   U5  ★ V10 번역 trOff/trOn(lastOn) · syncReadalong 1회 · 속도 faster/slower · 끝에서 안내
   U6  ★ V11 겹침 — 듣는 중 [▶](pressPlay)·9a play 액션 → abort 1회 후 평소 · 두 번째 탭 = 취소 · 듣는 중 start 재호출 무시
   U7  ★ V12 같은 인프라 오류 두 번째 → 음성 0 · 미지원 → 단추 0 · 예외 0
   U8  첫 사용 고지 카드 — [시작] 제스처 안에서 start · [취소] = 듣지 않음 · 꺼짐(voice.enabled=false) → 탭 무시
   U9  explain — `[11-4]` 켰다: 주입 함수로 설명 흐름 · 되돌림(주입 없으면 9b 안내) · 부정문 → 실행 0 · 안내
   U10 [말해 보기] — 실행 없이 기록 · tryLines · historyText · 최근 HISTORY 개
   U11 speaker.again() — 공개 함수 하나(약 8줄) · 다른 길에서 부르지 않음
   U12 `[9b-3]` D10 — 안내 중 다시 탭은 그 누름의 되돌림(`was`)을 이어받는다(9b2R-6 R5 빈틈)
   U13 `[9b-3]` 진짜 `setReadalongMode`·`lastOnMode`(ui/settings) — 끌 때 켜진 모드를 `lastOn` 에 남긴다(9b2R-6 R6 빈틈)
   W5  `[9b 다듬기 Review 중-1]` 가로 고지 카드 CSS — 폭은 화면 폭·높이 상한은 9b-2 식(바 위에서 자르지 않는다)
   U14 `[9b-3]` 못 맞춤 문구 — 들은 말이 없으면 빈 따옴표 없이(인식기 no-match · 빈 대안 · [말해 보기] 오류 줄) · Rb 화면 흐름
   W   배선·계층 소스 — controls·handsfree·settings·config·i18n·css
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createSpeaker } from '../js/tts/speaker.js';
import { createHandsfree } from '../js/ui/handsfree.js';
import {
  createVoice, createTry, tryLines, historyText, historySnapshot, clearHistory, recordHistory, isReading,
  ERROR_KEYS, barTight, recognitionOf, noMatchText
} from '../js/ui/voice.js';
import { setReadalongMode, lastOnMode } from '../js/ui/settings.js';
import * as settingsStore from '../js/settings.js';
import { VOICE, TTS_LANG_REGION } from '../js/config.js';
import { DEFAULTS } from '../js/settings.js';
import { BUNDLES } from '../js/i18n/index.js';
import { CODES } from '../js/voice/listen.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const flush = () => new Promise((r) => setTimeout(r, 0));

/* ── 가짜 시계 · 엔진 ───────────────────────────────────── */

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
        let pick = null; let key = null;
        for (const [k, j] of jobs) if (j.at <= target && (pick === null || j.at < pick.at)) { pick = j; key = k; }
        if (!pick) break;
        jobs.delete(key); now = pick.at; pick.fn();
      }
      now = target;
    },
    now: () => now,
    pending: () => jobs.size
  };
}

function fakeSynth(log) {
  const s = {
    speaking: false, pending: false, utt: [], current: null,
    speak(u) { if (log) log.push('speak:' + u.text); s.speaking = true; s.current = u; s.utt.push(u); },
    pause() { }, resume() { },
    cancel() { if (log) log.push('cancel'); const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    finish() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onend) u.onend(); },
    texts() { return s.utt.map((u) => u.text); }
  };
  return s;
}

function fakeRecognitionClass(log) {
  const instances = [];
  class FakeRec {
    constructor() {
      this.lang = ''; this.continuous = true; this.interimResults = true; this.maxAlternatives = 1;
      this.startCalls = 0; this.abortCalls = 0;
      this.onstart = this.onaudiostart = this.onresult = this.onnomatch = this.onerror = this.onend = null;
      instances.push(this);
    }
    start() { this.startCalls++; log.push('rec.start:' + this.lang); }
    stop() { }
    abort() { this.abortCalls++; log.push('rec.abort'); }
    fire(type, payload) {
      const h = this['on' + type];
      if (typeof h !== 'function') return;
      if (type === 'result') {
        const r = payload.map((t) => ({ transcript: t, confidence: 1 }));
        r.isFinal = true;
        h.call(this, { resultIndex: 0, results: [r] });
      } else if (type === 'error') h.call(this, { error: payload });
      else h.call(this, {});
    }
  }
  return { Rec: FakeRec, instances: instances };
}

/** 번역 맵 스텁(speaker-tr·handsfree-9a 와 같다). */
function fakeTr(initial) {
  const m = new Map(Object.entries(initial || {}));
  return { get: (u) => Object.assign({}, m.get(u.src) || { state: 'none' }), onChange: () => () => { } };
}

const P1 = ['Alpha is the first one.', 'Bravo comes after it.', 'Charlie ends this page.'];
const P2 = ['Delta opens the next page.'];
function line(id, text) { return { id: id, text: text, hyphen: 'none' }; }

function makeView() {
  const pages = {
    1: [{ id: 'p1', kind: 'body', lines: P1.map((t, i) => line('1:' + i, t)) }],
    2: [{ id: 'p2', kind: 'body', lines: P2.map((t, i) => line('2:' + i, t)) }]
  };
  const v = {
    page: 1, pageCount: 2, gotos: 0,
    paras: () => pages[v.page] || [],
    pageInfo: () => ({ page: v.page, pageCount: v.pageCount }),
    goToPage: (n) => { v.gotos++; v.page = n; return Promise.resolve(true); },
    show: () => true,
    markDone: () => { }
  };
  return v;
}

/**
 * 진짜 speaker + 흐름. `log` 에 speaker.pause·rec.start 순서가 쌓인다.
 * `pressPlay` 는 controls 의 [▶] 본문 모양(첫 줄 cancel — 9b · 스캔본 갈래 없음 · syncReadalong 은 센다).
 */
function harness(o) {
  const opt = o || {};
  const log = [];
  const synth = fakeSynth(opt.synthLog ? log : null);
  const timers = fakeTimers();
  const view = makeView();
  const sp = createSpeaker({
    synth: synth, timers: timers, makeUtterance: (text) => ({ text: text }),
    translation: opt.tr || null,
    view: {
      paras: () => view.paras(), page: () => view.pageInfo(), goToPage: (n) => view.goToPage(n),
      show: () => view.show(), markDone: () => view.markDone()
    },
    requestWakeLock: () => Promise.resolve({ release() { } })
  });
  if (opt.tr) { sp.setDocLang('en-US'); sp.setTrVoice('ar-SA', null); sp.setReadalong({ mode: 'speak', speakSource: true }); }
  const origPause = sp.pause;
  const spy = Object.assign({}, sp, { pause: function () { log.push('speaker.pause'); return origPause(); } });
  const fk = fakeRecognitionClass(log);
  const env = {
    settings: Object.assign({ 'voice.noticeAt': 1 }, opt.settings || {}),
    sets: [], syncs: 0, paintRates: 0, modes: [], presses: 0, paints: [], statuses: [], notices: [], vibes: 0
  };
  // `[9b-3]` opt.store — 진짜 설정 저장소(`js/settings.js`)로 읽고 쓴다(진짜 `setReadalongMode` 와 같은 곳을 보게 — U13).
  const get = opt.store ? opt.store.get : (k) => (Object.prototype.hasOwnProperty.call(env.settings, k) ? env.settings[k] : DEFAULTS[k]);
  const set = opt.store
    ? (k, v) => { env.sets.push([k, v]); return opt.store.set(k, v).catch(() => { }); }
    : (k, v) => { env.sets.push([k, v]); env.settings[k] = v; return Promise.resolve(); };
  let voice = null;
  const pressPlay = () => {
    env.presses++;
    if (voice) voice.cancel();
    if (sp.getState() === 'speaking') sp.pause();
    else { env.syncs++; sp.play(); }
  };
  const t = (k, p) => {
    let s = BUNDLES.en[k];
    if (typeof s !== 'string') return k;
    for (const [n, v] of Object.entries(p || {})) s = s.split('{' + n + '}').join(String(v));
    return s;
  };
  voice = createVoice({
    Recognition: opt.noRec ? null : fk.Rec,
    speaker: spy,
    pressPlay: pressPlay,
    syncReadalong: () => { env.syncs++; },
    paintRate: () => { env.paintRates++; },
    setReadalongMode: opt.setReadalongMode ? (m) => { env.modes.push(m); return opt.setReadalongMode(m); } : (m) => {
      env.modes.push(m);
      const prev = get('readalong.mode');
      if (m !== 'off') env.settings['readalong.lastOn'] = m;
      else if (prev !== 'off') env.settings['readalong.lastOn'] = prev;
      env.settings['readalong.mode'] = m;
    },
    lastOnMode: opt.lastOnMode || ((g) => { const v = g('readalong.lastOn'); return v === 'show' || v === 'speak' ? v : 'speak'; }),
    getSetting: get,
    setSetting: set,
    uiLang: () => opt.ui || 'en',
    t: t,
    onLine: () => opt.onLine !== false,
    synth: opt.noSay ? null : synth,
    makeUtterance: (text) => ({ text: text }),
    sayVoice: () => ({ tag: 'en-US', voice: null }),
    vibrate: () => { env.vibes++; },
    timers: timers,
    now: timers.now,
    // `[11-4]` 음성 "설명" 주입(없으면 9b 의 "아직 없는 기능" 안내 그대로 — U9)
    onExplain: opt.onExplain,
    view: {
      paint: (s) => env.paints.push(s),
      status: (m) => env.statuses.push(m),
      notice: (open, h) => env.notices.push({ open: open, h: h || null })
    }
  });
  const rec = () => fk.instances[fk.instances.length - 1];
  const lastPaint = () => env.paints[env.paints.length - 1];
  const lastStatus = () => env.statuses[env.statuses.length - 1];
  const says = () => synth.texts().filter((x) => /again|work|available|speed/i.test(x));
  return { sp, synth, timers, view, voice, fk, rec, env, log, lastPaint, lastStatus, says, pressPlay };
}

/** 낭독을 시작해 i 번째 문장까지 와 있게. */
function startAt(h, i) {
  h.sp.play();
  for (let k = 0; k < i; k++) h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.sp.getIndex(), i);
}

/* ══ U1 V7 동기 ═════════════════════════════════════════ */

test('U1 ★ V7 — speaking 에서 탭: 같은 호출 안에서 pause 다음 start(await 없음) · 결과 next → +1 · speaking', () => {
  const h = harness();
  startAt(h, 0);
  h.voice.press();
  // ★ 돌아온 직후 — 비동기 틈 없이 둘 다 이미 일어났다(순서까지).
  assert.deepEqual(h.log.filter((x) => x === 'speaker.pause' || x.startsWith('rec.start')), ['speaker.pause', 'rec.start:' + TTS_LANG_REGION.en]);
  assert.equal(h.sp.getState(), 'paused');
  assert.equal(h.voice.isListening(), true);
  assert.equal(h.lastPaint().listening, true);
  assert.equal(h.lastStatus().kind, 'listening');
  assert.equal(h.env.vibes, 1);
  const r = h.rec();
  assert.equal(r.maxAlternatives, VOICE.MAX_ALTS);
  assert.equal(r.continuous, false);
  assert.equal(r.interimResults, false);
  r.fire('result', ['next']);
  r.fire('end');
  assert.equal(h.sp.getIndex(), 1);
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.voice.isListening(), false);
  assert.equal(h.lastPaint().listening, false);
  assert.equal(h.lastStatus().kind, 'confirm');
  assert.match(h.lastStatus().text, /next/i);
  h.timers.advance(VOICE.CONFIRM_MS);
  assert.equal(h.lastStatus(), null, '확인 줄은 CONFIRM_MS 뒤 지운다');
  // 흐름 소스 — begin 안 pause → start 사이에 await·then 없음
  const src = noComments(read('../js/ui/voice.js'));
  const b = src.slice(src.indexOf('function begin('), src.indexOf('function press()'));
  assert.ok(b.indexOf('sp.pause()') >= 0 && b.indexOf('sp.pause()') < b.indexOf('listener.start(lang)'), 'pause 가 start 앞');
  assert.ok(!/await|\.then\(/.test(b), '★ begin 은 동기');
  assert.ok(!/\bawait\b/.test(src.slice(src.indexOf('export function createVoice'), src.indexOf('export function tryLines'))), '흐름에 await 없음');
});

/* ══ U2 멈춤에서 next · 쪽 끝 ═══════════════════════════════ */

test('U2 ★ V7 — 멈춤에서 next → 하이라이트만 · paused · 쪽 끝(읽는 중) next → 다음 쪽', async () => {
  const h = harness();
  startAt(h, 1);
  h.sp.pause();
  h.voice.press();
  assert.equal(h.log.filter((x) => x === 'speaker.pause').length, 0, '멈춤이면 pause 를 다시 부르지 않는다');
  h.rec().fire('result', ['next']);
  assert.equal(h.sp.getIndex(), 2);
  assert.equal(h.sp.getState(), 'paused');
  // 쪽 끝 + 멈춤 → 아무 일 없음(9-D5)
  h.voice.press();
  h.rec().fire('result', ['next']);
  assert.equal(h.sp.getIndex(), 2);
  assert.equal(h.sp.getState(), 'paused');
  assert.equal(h.view.gotos, 0);
  // 쪽 끝 + 읽는 중 → 화면 [다음] 과 같게 다음 쪽
  h.pressPlay();
  assert.equal(h.sp.getState(), 'speaking');
  h.voice.press();
  h.rec().fire('result', ['التالي', 'next']);       // en 모드 — 아랍어 대안은 none, 둘째에서 맞음
  assert.equal(h.view.gotos, 1, 'goToPage 1회');
  await flush();
  assert.equal(h.view.page, 2);
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.sp.getIndex(), 0);
});

/* ══ U3 V8 되돌림 ═══════════════════════════════════════ */

test('U3 ★ V8 — nomatch·no-speech·network → 안내 뒤 같은 인덱스 speaking · pause 명령 유지 · hidden 되돌림 없음', () => {
  const h = harness();
  startAt(h, 1);
  // nomatch — 상태 줄([명령 보기]) + 한 마디 → 말이 끝나면 되돌림
  h.voice.press();
  h.rec().fire('result', ['hello how are you']);
  assert.equal(h.sp.getState(), 'paused', '안내 한 마디가 끝날 때까지 멈춤');
  assert.equal(h.lastStatus().kind, 'error');
  assert.equal(h.lastStatus().list, true);
  assert.equal(h.synth.current.text, BUNDLES.en['voice.noMatch.say']);
  assert.equal(h.voice.isListening(), true, '안내 중(되돌림 대기)도 "듣기 흐름 중"');
  h.synth.finish();                                  // 한 마디 끝 → 되돌림
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.sp.getIndex(), 1);
  // 한 마디가 끝나지 않아도 SAY_MAX_MS 뒤 되돌림
  h.voice.press();
  h.rec().fire('result', ['zzz']);
  assert.equal(h.sp.getState(), 'paused');
  h.timers.advance(VOICE.SAY_MAX_MS);
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.sp.getIndex(), 1);
  // no-speech — 음성 없이 곧장 되돌림
  const n0 = h.synth.utt.length;
  h.voice.press();
  h.rec().fire('error', 'no-speech');
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.sp.getIndex(), 1);
  assert.equal(h.synth.utt.filter((u) => u.text === BUNDLES.en['voice.say.fail']).length, 0);
  assert.ok(h.synth.utt.length > n0);
  // 결과 없이 end(앱 상한과 같은 갈래) — noSpeech
  h.voice.press();
  h.timers.advance(VOICE.LISTEN_MAX_MS);
  assert.equal(h.sp.getState(), 'speaking');
  // network — 안내(이어폰 문구) + 한 마디 → 되돌림
  h.voice.press();
  h.rec().fire('error', 'network');
  assert.equal(h.sp.getState(), 'paused');
  assert.ok(h.lastStatus().text.indexOf(BUNDLES.en['voice.err.network']) === 0);
  assert.ok(h.lastStatus().text.indexOf(BUNDLES.en['voice.earphoneOk']) > 0, '인프라 실패 = 이어폰 문구');
  assert.equal(h.synth.current.text, BUNDLES.en['voice.say.fail']);
  h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.sp.getIndex(), 1);
  // offline 갈래
  const off = harness({ onLine: false });
  startAt(off, 0);
  off.voice.press();
  off.rec().fire('error', 'network');
  assert.ok(off.lastStatus().text.indexOf(BUNDLES.en['voice.err.offline']) === 0);
  // pause 명령 → 멈춤 유지(되돌리지 않는다)
  h.voice.press();
  h.rec().fire('result', ['pause']);
  assert.equal(h.sp.getState(), 'paused');
  h.timers.advance(VOICE.SAY_MAX_MS + VOICE.CONFIRM_MS);
  assert.equal(h.sp.getState(), 'paused');
  // hidden — 듣는 중 숨김 → abort · 되돌림 없음
  h.pressPlay();
  assert.equal(h.sp.getState(), 'speaking');
  h.voice.press();
  const r = h.rec();
  h.voice.onHidden();
  assert.equal(r.abortCalls, 1);
  assert.equal(h.voice.isListening(), false);
  h.timers.advance(VOICE.SAY_MAX_MS * 2);
  assert.equal(h.sp.getState(), 'paused', '되돌림 없음');
  // 안내 중 hidden → 한 마디를 거두고 되돌림 없음
  h.pressPlay();
  h.voice.press();
  h.rec().fire('result', ['nothing like a command here']);
  assert.ok(h.voice.isListening());
  h.voice.onHidden();
  h.timers.advance(VOICE.SAY_MAX_MS * 2);
  assert.equal(h.sp.getState(), 'paused');
  // aborted(우리가 부르지 않은 중단) — 문구 없이 되돌림
  h.pressPlay();
  h.voice.press();
  h.rec().fire('error', 'aborted');
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.lastStatus(), null);
});

/* ══ U4 V9 again ═══════════════════════════════════════ */

test('U4 ★ V9 — again: 멈춤+tr → src · 같은 인덱스 · 읽던 중이었으면 원문부터', () => {
  const tr = fakeTr({ 'Alpha is the first one.': { state: 'ready', text: 'ترجمة ألفا', parts: ['ترجمة ألفا'] }, 'Bravo comes after it.': { state: 'ready', text: 'ترجمة برافو', parts: ['ترجمة برافو'] } });
  const h = harness({ tr: tr });
  h.sp.play();
  assert.equal(h.sp.getPhase(), 'src');
  h.synth.finish();                                  // 원문 끝 → 번역문
  assert.equal(h.sp.getPhase(), 'tr');
  assert.equal(h.sp.getIndex(), 0);
  // 읽는 중(번역 단계)에서 again
  h.voice.press();
  assert.equal(h.sp.getState(), 'paused');
  assert.equal(h.sp.getPhase(), 'tr', '멈춤은 단계를 바꾸지 않는다');
  h.rec().fire('result', ['again']);
  assert.equal(h.sp.getPhase(), 'src');
  assert.equal(h.sp.getIndex(), 0);
  assert.equal(h.sp.getState(), 'speaking');
  h.timers.advance(100);
  assert.equal(h.synth.current.text, 'Alpha is the first one.', '★ 원문부터(번역문 이어 읽기가 아니다)');
  // 멈춤 + tr 에서 again → src, 하이라이트만
  h.synth.finish();
  assert.equal(h.sp.getPhase(), 'tr');
  h.sp.pause();
  h.voice.press();
  h.rec().fire('result', ['repeat']);
  assert.equal(h.sp.getPhase(), 'src');
  assert.equal(h.sp.getIndex(), 0);
  assert.equal(h.sp.getState(), 'paused');
  // 그 뒤 [▶] = 원문부터
  h.pressPlay();
  h.timers.advance(100);
  assert.equal(h.synth.current.text, 'Alpha is the first one.');
});

/* ══ U5 V10 번역 · 속도 ══════════════════════════════════ */

test('U5 ★ V10 — trOff·trOn(lastOn) · syncReadalong 1회 · 속도 계단 · 끝 안내', () => {
  const h = harness({ settings: { 'readalong.mode': 'show' } });
  startAt(h, 0);
  h.sp.pause();
  let s0 = h.env.syncs;
  h.voice.press();
  h.rec().fire('result', ['translation off']);
  assert.equal(h.env.settings['readalong.mode'], 'off');
  assert.equal(h.env.settings['readalong.lastOn'], 'show', 'lastOn 보존');
  assert.equal(h.env.syncs - s0, 1, 'syncReadalong 1회');
  assert.equal(h.sp.getState(), 'paused');
  s0 = h.env.syncs;
  h.voice.press();
  h.rec().fire('result', ['translation on']);
  assert.equal(h.env.settings['readalong.mode'], 'show', 'lastOn 복원');
  assert.equal(h.env.syncs - s0, 1);
  // 이미 켜져 있으면 바꾸지 않는다(되돌림만)
  const m0 = h.env.modes.length;
  h.voice.press();
  h.rec().fire('result', ['with translation']);
  assert.equal(h.env.modes.length, m0);
  // 읽는 중이었으면 되돌림이 [▶] 같은 함수 — 그 안의 syncReadalong 하나
  h.pressPlay();
  s0 = h.env.syncs;
  h.voice.press();
  h.rec().fire('result', ['no translation']);
  assert.equal(h.env.settings['readalong.mode'], 'off');
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.env.syncs - s0, 1, '되돌림의 pressPlay 안에서 한 번');
  // lastOn 기본 speak
  const d = harness({ settings: { 'readalong.mode': 'off', 'readalong.lastOn': 'bogus' } });
  d.voice.press();
  d.rec().fire('result', ['translate']);
  assert.equal(d.env.settings['readalong.mode'], 'speak');
  // 속도 — 1.0 → faster → 1.25 저장 + paintRate
  assert.equal(h.sp.getRate(), 1);
  h.voice.press();
  h.rec().fire('result', ['faster']);
  assert.equal(h.sp.getRate(), 1.25);
  assert.deepEqual(h.env.sets.filter((x) => x[0] === 'tts.rate').pop(), ['tts.rate', 1.25]);
  assert.ok(h.env.paintRates >= 1);
  assert.equal(h.sp.getState(), 'speaking');
  // 1.8 에서 faster → 그대로 + voice.rate.max(상태 줄 + 한 마디)
  h.sp.setRate(1.8);
  h.voice.press();
  h.rec().fire('result', ['speed up']);
  assert.equal(h.sp.getRate(), 1.8);
  assert.equal(h.lastStatus().text, BUNDLES.en['voice.rate.max']);
  assert.equal(h.synth.current.text, BUNDLES.en['voice.rate.max']);
  h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking');
  h.sp.setRate(0.5);
  h.voice.press();
  h.rec().fire('result', ['slower']);
  assert.equal(h.sp.getRate(), 0.5);
  assert.equal(h.lastStatus().text, BUNDLES.en['voice.rate.min']);
});

/* ══ U6 V11 겹침 ════════════════════════════════════════ */

test('U6 ★ V11 — 듣는 중 [▶]·9a play → abort 1회 후 평소 · 두 번째 탭 = 취소 · start 재호출 무시', () => {
  const h = harness();
  startAt(h, 1);
  h.voice.press();
  const r = h.rec();
  assert.equal(h.sp.getState(), 'paused');
  h.pressPlay();                                     // 화면 [▶] — 첫 줄이 cancel
  assert.equal(r.abortCalls, 1);
  assert.equal(h.voice.isListening(), false);
  assert.equal(h.sp.getState(), 'speaking', '그 단추는 평소대로(멈춤 → 재생)');
  assert.equal(h.sp.getIndex(), 1);
  // 늦게 온 결과는 무시
  r.fire('result', ['next']);
  assert.equal(h.sp.getIndex(), 1);
  // 9a — 진짜 handsfree 에 isListening·cancel 주입
  const ms = { handlers: {}, playbackState: 'none', metadata: null, setActionHandler(a, f) { this.handlers[a] = f; } };
  const hf = createHandsfree({
    mediaSession: ms, MediaMetadata: null, makeAudio: null, isHidden: () => false,
    speaker: h.sp, pressPlay: h.pressPlay, meta: () => ({ title: 'Zorvat', page: 1, pageCount: 2 }),
    getSetting: (k) => DEFAULTS[k], timers: h.timers, config: { SESSION: 'none' },
    isListening: () => h.voice.isListening(), cancel: () => h.voice.cancel()
  });
  hf.arm();
  h.voice.press();
  const r2 = h.rec();
  assert.equal(h.sp.getState(), 'paused');
  ms.handlers.play();                                // 이어폰 ⏯ — 듣기 취소 후 평소(멈춤 → 재생)
  assert.equal(r2.abortCalls, 1);
  assert.equal(h.sp.getState(), 'speaking');
  h.voice.press();
  const r3 = h.rec();
  ms.handlers.nexttrack();
  assert.equal(r3.abortCalls, 1);
  assert.equal(h.sp.getIndex(), 2, '그 단추는 평소대로 — 멈춤에서 다음(하이라이트만)');
  assert.equal(h.sp.getState(), 'paused');
  // 두 번째 마이크 탭 = 취소(되돌림 없음)
  h.pressPlay();
  h.voice.press();
  const r4 = h.rec();
  h.voice.press();
  assert.equal(r4.abortCalls, 1);
  assert.equal(h.voice.isListening(), false);
  h.timers.advance(VOICE.SAY_MAX_MS * 2);
  assert.equal(h.sp.getState(), 'paused');
  // 듣는 중 start 재호출 무시 — 인식기 1개
  const n = h.fk.instances.length;
  h.voice.press();
  assert.equal(h.fk.instances.length, n + 1);
  // 다른 길(줄 탭 등)로 읽기가 시작되면 듣기 취소
  h.sp.play();
  assert.equal(h.rec().abortCalls, 1);
  assert.equal(h.voice.isListening(), false);
  // 안내 중 [▶] — 한 마디를 거두고(되돌림 없이) 평소대로
  h.voice.press();
  h.rec().fire('result', ['xyzzy']);
  assert.ok(h.voice.isListening());
  h.pressPlay();
  assert.equal(h.voice.isListening(), false);
  assert.equal(h.sp.getState(), 'speaking');
  h.timers.advance(VOICE.SAY_MAX_MS);
  assert.equal(h.sp.getState(), 'speaking');
});

/* ══ U7 V12 ═════════════════════════════════════════════ */

test('U7 ★ V12 — 같은 인프라 오류 두 번째는 음성 0 · 다른 오류는 첫 번째 · 미지원 → 단추 0 · 예외 0', () => {
  const h = harness();
  startAt(h, 0);
  const sayCount = () => h.synth.utt.filter((u) => u.text === BUNDLES.en['voice.say.fail']).length;
  h.voice.press();
  h.rec().fire('error', 'network');
  assert.equal(sayCount(), 1);
  h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking');
  h.voice.press();
  h.rec().fire('error', 'network');
  assert.equal(sayCount(), 1, '★ 두 번째 같은 인프라 실패 — 음성 없이');
  assert.equal(h.lastStatus().kind, 'error', '상태 줄은 그대로');
  assert.equal(h.sp.getState(), 'speaking', '곧장 되돌림');
  h.voice.press();
  h.rec().fire('error', 'audio-capture');
  assert.equal(sayCount(), 2, '다른 인프라 실패는 첫 번째');
  // voice.sayErrors=false → 음성 없이 곧장 되돌림
  const q = harness({ settings: { 'voice.sayErrors': false } });
  startAt(q, 0);
  q.voice.press();
  q.rec().fire('error', 'service-not-allowed');
  assert.equal(q.synth.utt.filter((u) => u.text === BUNDLES.en['voice.say.fail']).length, 0);
  assert.equal(q.sp.getState(), 'speaking');
  // 미지원 — 단추 0 · 탭 무시 · 예외 0
  const u = harness({ noRec: true });
  startAt(u, 0);
  u.voice.arm();
  assert.equal(u.lastPaint().visible, false);
  assert.equal(u.voice.supported(), false);
  u.voice.press();
  assert.equal(u.sp.getState(), 'speaking', '아무 일도 없다');
  assert.equal(u.voice.cancel(), false);
  assert.equal(u.voice.debug().supported, false);
  assert.equal(recognitionOf(null), null);
  assert.equal(recognitionOf({}), null);
  const W = function () { };
  assert.equal(recognitionOf({ webkitSpeechRecognition: W }), W);
  assert.equal(recognitionOf({ SpeechRecognition: W, webkitSpeechRecognition: function () { } }), W);
  // 오류 코드 → 키 표(5절 + busy·aborted)
  for (const c of Object.values(CODES)) assert.ok(c in ERROR_KEYS, c);
  assert.equal(ERROR_KEYS.aborted, null);
  // 좁은 바 판정 — 마이크가 보일 때만
  assert.equal(barTight(true, true), true);
  assert.equal(barTight(false, true), false);
  assert.equal(barTight(true, false), false);
});

/* ══ U8 고지 카드 · 꺼짐 ══════════════════════════════════ */

test('U8 첫 사용 고지 카드 — [시작] 제스처 안에서 start · noticeAt 기록 · [취소] = 듣지 않음 · voice.enabled=false', () => {
  const h = harness({ settings: { 'voice.noticeAt': 0 } });
  startAt(h, 0);
  h.voice.press();
  assert.equal(h.fk.instances.length, 0, '카드부터 — 아직 듣지 않는다');
  const card = h.env.notices[h.env.notices.length - 1];
  assert.equal(card.open, true);
  assert.equal(h.sp.getState(), 'speaking', '카드가 떠 있는 동안 읽기는 그대로');
  card.h.start();                                    // [시작] 탭 — 그 안에서 곧장
  assert.equal(h.fk.instances.length, 1);
  assert.equal(h.rec().startCalls, 1);
  assert.equal(h.sp.getState(), 'paused');
  assert.ok(h.env.settings['voice.noticeAt'] > 0 || h.env.sets.some((x) => x[0] === 'voice.noticeAt'));
  assert.equal(h.env.notices[h.env.notices.length - 1].open, false);
  h.rec().fire('result', ['next']);
  // 두 번째부터 카드 없음
  const n = h.env.notices.length;
  h.voice.press();
  assert.equal(h.env.notices.length, n);
  assert.equal(h.voice.isListening(), true);
  h.voice.cancel();
  // [취소]
  const c = harness({ settings: { 'voice.noticeAt': 0 } });
  c.voice.press();
  c.env.notices[c.env.notices.length - 1].h.cancel();
  assert.equal(c.fk.instances.length, 0);
  // 꺼짐 — 단추 숨김 · 탭 무시
  const off = harness({ settings: { 'voice.enabled': false } });
  off.voice.arm();
  assert.equal(off.lastPaint().visible, false);
  off.voice.press();
  assert.equal(off.fk.instances.length, 0);
  // 기본값(9-3)
  assert.equal(DEFAULTS['voice.enabled'], true);
  assert.equal(DEFAULTS['voice.cmdLang'], 'auto');
  assert.equal(DEFAULTS['voice.tag'], '');
  assert.equal(DEFAULTS['voice.noticeAt'], 0);
  assert.equal(DEFAULTS['voice.sayErrors'], true);
  assert.equal(DEFAULTS['readalong.lastOn'], 'speak');
});

/* ══ U9 explain · 부정문 · 아랍어 ════════════════════════ */

test('U9 explain → `[11-4]` 설명 흐름(주입 함수) — "아직 없는 기능" 아님 · 주입이 없으면 안내 · 부정문 → 실행 0 · ar UI → ar-SY 태그 · 아랍어 명령', async () => {
  // `[11-4 — spec 17-2-1 4-5]` explain 을 켰다 — 9b 의 notYet 기대를 고친다: 주입(`onExplain`)이 있으면 설명 흐름, 끝나면 되돌림.
  const calls = [];
  let finish = null;
  const e = harness({ onExplain: (o) => { calls.push(o); return Promise.resolve({ ok: true, done: new Promise((r) => { finish = r; }) }); } });
  startAt(e, 1);
  e.voice.press();
  e.rec().fire('result', ['explain this']);
  assert.equal(calls.length, 1, '주입 함수 한 번');
  assert.equal(calls[0].via, 'voice');
  assert.equal(calls[0].was, 'speaking', '9b 흐름의 was');
  assert.notEqual(e.lastStatus().text, BUNDLES.en['voice.notYet'], '★ "아직 없는 기능" 이 아니다');
  assert.equal(e.lastStatus().text, BUNDLES.en['explain.pending']);
  await flush();
  assert.equal(e.lastStatus().kind, 'confirm');
  assert.equal(e.sp.getState(), 'paused', '설명을 말하는 동안 멈춤');
  finish('end');
  await flush();
  await flush();
  assert.equal(e.sp.getState(), 'speaking', '끝나면 그 문장부터 이어 읽기');
  assert.equal(e.sp.getIndex(), 1);
  // 주입이 없으면(옛 배선) 9b 안내 장치 그대로 — 되돌림
  const h = harness();
  startAt(h, 1);
  h.voice.press();
  h.rec().fire('result', ['explain this']);
  assert.equal(h.lastStatus().text, BUNDLES.en['voice.notYet']);
  assert.equal(h.sp.getIndex(), 1);
  h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking');
  // 부정문 — "don't stop" 은 멈춤이 아니다(결정 ②) → 못 맞춤 안내 → 되돌림(계속 읽기)
  h.voice.press();
  h.rec().fire('result', ["don't stop"]);
  assert.equal(h.lastStatus().kind, 'error');
  h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.sp.getIndex(), 1);
  // ar UI — 아랍어 모드
  const a = harness({ ui: 'ar' });
  startAt(a, 0);
  a.voice.press();
  assert.equal(a.rec().lang, VOICE.AR_TAGS[0]);
  a.rec().fire('result', ['التالي من فضلك']);
  assert.equal(a.sp.getIndex(), 1);
  assert.equal(a.sp.getState(), 'speaking');
  assert.ok(a.env.sets.some((x) => x[0] === 'voice.tag' && x[1] === 'ar-SY'), '된 태그 기억');
  a.voice.press();
  a.rec().fire('result', ['لا توقف']);
  assert.equal(a.lastStatus().kind, 'error', '부정문 — 멈춤 아님');
  // 기록에 남는다(글자·명령·태그·ms) — 메모리만
  const dbg = a.voice.debug();
  assert.ok(dbg.history.length >= 2);
  assert.equal(dbg.history[0].heard[0], 'لا توقف');
  assert.equal(dbg.history[0].id, null);
  assert.equal(dbg.history[1].id, 'next');
  assert.equal(dbg.history[1].tag, 'ar-SY');
  assert.equal(dbg.cmdLang, 'ar');
});

/* ══ U10 [말해 보기] ═══════════════════════════════════════ */

test('U10 [말해 보기] — 실행 없이 기록 · tryLines · historyText · 최근 HISTORY 개', () => {
  clearHistory();
  const log = [];
  const fk = fakeRecognitionClass(log);
  const timers = fakeTimers();
  const seen = [];
  const tr = createTry({ Recognition: fk.Rec, timers: timers, now: timers.now, getSetting: (k) => DEFAULTS[k], uiLang: () => 'en' }, (s) => seen.push(s));
  tr.press();
  assert.equal(tr.isListening(), true);
  assert.equal(seen[seen.length - 1].listening, true);
  fk.instances[0].fire('result', ['nexd', 'next', 'text']);
  const rec = seen[seen.length - 1].rec;
  assert.equal(rec.kind, 'try');
  assert.equal(rec.id, 'next');
  assert.equal(rec.altIndex, 1);
  assert.deepEqual(rec.heard, ['nexd', 'next', 'text']);
  const t = (k, p) => { let s = BUNDLES.en[k]; for (const [n, v] of Object.entries(p || {})) s = s.split('{' + n + '}').join(String(v)); return s; };
  const lines = tryLines(rec, t);
  assert.equal(lines.length, 4);
  assert.match(lines[3], /alternative 2/);
  assert.match(lines[3], new RegExp(TTS_LANG_REGION.en));
  // 오류
  tr.press();
  fk.instances[1].fire('error', 'network');
  const er = seen[seen.length - 1].rec;
  assert.equal(er.error, 'network');
  assert.match(tryLines(er, t)[0], /network/);
  // 듣는 중 다시 탭 = 취소
  tr.press();
  tr.press();
  assert.equal(fk.instances[2].abortCalls, 1);
  // 기록 — 최근 HISTORY 개 · 복사 글자
  for (let i = 0; i < VOICE.HISTORY + 3; i++) recordHistory({ at: i, kind: 'cmd', lang: 'en', tag: 'en-US', ms: i, heard: ['x' + i], id: null, altIndex: -1 });
  const snap = historySnapshot();
  assert.equal(snap.length, VOICE.HISTORY);
  assert.deepEqual(snap[0].heard, ['x' + (VOICE.HISTORY + 2)]);
  const text = historyText();
  assert.equal(text.split('\n').length, VOICE.HISTORY);
  assert.match(text.split('\n')[0], /«x12»/);
  clearHistory();
  assert.equal(historySnapshot().length, 0);
  assert.equal(isReading('waiting-page'), true);
  assert.equal(isReading('paused'), false);
});

/* ══ U11 speaker.again ═══════════════════════════════════ */

test('U11 speaker.again() — 공개 함수 하나(약 8줄) · 큐 없으면 아무 일 없음 · 다른 길에서 부르지 않음', () => {
  const synth = fakeSynth();
  const timers = fakeTimers();
  const v = makeView();
  const sp = createSpeaker({ synth: synth, timers: timers, makeUtterance: (text) => ({ text: text }),
    view: { paras: () => v.paras(), page: () => v.pageInfo(), goToPage: (n) => v.goToPage(n), show: () => true, markDone: () => { } } });
  sp.again();                                        // 큐 없음 — 던지지 않는다
  assert.equal(sp.getState(), 'idle');
  sp.play();
  synth.finish();
  assert.equal(sp.getIndex(), 1);
  sp.again();
  timers.advance(100);
  assert.equal(synth.current.text, 'Bravo comes after it.');
  assert.equal(sp.getIndex(), 1);
  const src = read('../js/tts/speaker.js');
  const body = src.slice(src.indexOf('  function again() {'), src.indexOf('  function setRate(r) {'));
  assert.ok(body.split('\n').length <= 12, 'again() 는 작다');
  assert.match(body, /phase = 'src';\s*trPart = 0;\s*audibleIdx = -1;\s*if \(state === 'speaking'\) restart\(index\);\s*else show\(units\[index\]\);/);
  const code = noComments(src);
  assert.equal((code.match(/\bagain\(\)/g) || []).length, 1, 'speaker 안에서는 정의만');
  const ctl = noComments(read('../js/ui/controls.js'));
  assert.ok(!/\.again\(/.test(ctl), 'controls 는 부르지 않는다(음성 명령만)');
  assert.ok(!/SpeechRecognition|ui\/voice|voice\/commands|voice\/listen/.test(code), 'speaker 는 9b 모듈을 모른다');
});

/* ══ W 배선 ═════════════════════════════════════════════ */

test('W1 ★ controls — 배선 · [▶](pressPlay)·[이전]·[다음]·줄 탭 첫 줄 취소 · 떠날 때 leave · 숨김 취소 · 9a 주입 · 디버그 훅', () => {
  const c = noComments(read('../js/ui/controls.js'));
  assert.match(c, /import \{ createVoice, mountVoice, recognitionOf \} from '\.\/voice\.js';/);
  assert.equal((c.match(/createVoice\(/g) || []).length, 1);
  assert.match(c, /recognitionOf\(typeof window !== 'undefined' \? window : null\)/);
  for (const k of ['speaker: speaker,', 'pressPlay: pressPlay,', 'syncReadalong: syncReadalong,', 'paintRate: paintRate,', 'setReadalongMode: setReadalongMode,']) {
    assert.ok(c.indexOf(k) >= 0, k);
  }
  const pp = c.slice(c.indexOf('function pressPlay()'), c.indexOf('function noReadNotice()'));
  assert.match(pp, /^function pressPlay\(\) \{\s*cancelVoice\(\);/, '★ [▶] 첫 줄 취소');
  assert.ok(!/await|\.then\(/.test(pp));
  assert.match(c, /els\.prev\.addEventListener\('click', \(\) => \{ cancelVoice\(\); speaker\.prev\(\); \}\);/);
  assert.match(c, /els\.next\.addEventListener\('click', \(\) => \{ cancelVoice\(\); speaker\.next\(\); \}\);/);
  assert.match(c, /onLineTap\(\(lineId\) => \{\s*cancelVoice\(\);/);
  assert.match(c, /isListening: function \(\) \{ return !!voice && voice\.isListening\(\); \},\s*cancel: cancelVoice/);
  const leave = c.slice(c.indexOf('export function leaveControls'), c.indexOf('function restoreSettings'));
  assert.ok(leave.indexOf('voice.leave()') >= 0 && leave.indexOf('voice.leave()') < leave.indexOf('speaker.stop()'), '멈추기 전에 거둔다');
  assert.match(c, /if \(document\.visibilityState === 'hidden'\) voice\.onHidden\(\);/);
  assert.match(c, /onPageRender\(\(\) => \{ voice\.arm\(\); \}\);/);
  assert.match(c, /g\.voice = voiceDebug/);
  assert.match(c, /mounted\.button\.addEventListener\('click', \(\) => voice\.press\(\)\);/);
});

test('W2 ★ handsfree — 주입 2개 · 액션 첫 줄 취소 · speaker 는 그대로', () => {
  const src = noComments(read('../js/ui/handsfree.js'));
  const h = src.slice(src.indexOf('function handle(action) {'), src.indexOf('function setHandlers('));
  assert.match(h, /^function handle\(action\) \{\s*if \(typeof d\.isListening === 'function' && typeof d\.cancel === 'function' && d\.isListening\(\)\) d\.cancel\(\);/);
  assert.ok(!/\bvoice\b/.test(src.replace(/isListening|cancel/g, '')), 'handsfree 는 voice 모듈을 모른다(주입만)');
});

test('W3 ★ voice.js 계층 · 전역 · innerHTML 0 · 설정 묶음 배선 · config VOICE 한 곳', () => {
  const src = noComments(read('../js/ui/voice.js'));
  const imports = [...src.matchAll(/^import [^;]* from '([^']+)';/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['../config.js', '../i18n/index.js', '../settings.js', '../voice/commands.js', '../voice/listen.js']);
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(src));
  const core = src.slice(src.indexOf('export function createVoice'), src.indexOf('export function recognitionOf'));
  assert.ok(!/\b(window|document|navigator|localStorage|speechSynthesis|SpeechRecognition|webkitSpeechRecognition)\b/.test(core), '흐름은 전역을 읽지 않는다');
  assert.ok(!/console\./.test(src), '인식 글자를 콘솔로 내지 않는다');
  assert.ok(!/localStorage|sessionStorage|indexedDB|fetch\(/.test(src), '저장·전송 없음(메모리만)');
  const ui = noComments(read('../js/ui/settings.js'));
  assert.match(ui, /export function setReadalongMode\(mode\)/);
  assert.match(ui, /setReadalongMode\(m\.getAttribute\('data-readalong-mode'\)\)/, '화면 단추도 같은 길');
  assert.match(ui, /settings\.set\('readalong\.lastOn'/);
  assert.match(ui, /els\.voiceCmd = buildVoiceSettings\(root,/);
  assert.match(ui, /if \(els\.voiceCmd\) els\.voiceCmd\.show\(params && params\.tab\);/);
  // config — VOICE 한 곳 · EN_TAG 는 TTS_LANG_REGION.en(값을 다시 적지 않는다 — W1) · MAX_ALTS 를 둘 다 본다
  const cfg = noComments(read('../js/config.js'));
  assert.match(cfg, /EN_TAG: TTS_LANG_REGION\.en,/);
  assert.equal(VOICE.RETRY_WAIT_MS, 300);
  assert.equal(VOICE.EN_TAG, TTS_LANG_REGION.en);
  assert.equal(VOICE.PART_MAX_WORDS, 3);
  assert.equal(typeof VOICE.BAR_TIGHT_MEDIA, 'string');
  const cm = noComments(read('../js/voice/commands.js'));
  assert.match(cm, /export const MAX_ALTS = VOICE\.MAX_ALTS;/);
  const ls = noComments(read('../js/voice/listen.js'));
  assert.match(ls, /export const LISTEN_DEFAULTS = VOICE;/);
  // css — 56px · 좁은 바는 속성 하나
  const css = read('../css/reader.css');
  assert.match(css, /\.tts-bar \.tts-mic \{[^}]*min-inline-size: var\(--tap-play\);/);
  assert.match(css, /\.tts-bar\[data-bar-tight="on"\] \.tts-progress \{/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.tts-bar \.tts-mic\[aria-pressed="true"\] \{ animation: none;/);
  // index.html — 정적 그릇 없음(JS 가 만든다) · import map 에 voice 모듈 셋
  const html = read('../index.html');
  assert.ok(!/id="ttsMic"|id="voiceNotice"/.test(html));
  for (const m of ['ui/voice.js', 'voice/commands.js', 'voice/listen.js']) {
    assert.match(html, new RegExp('"\\./js/' + m.replace('/', '\\/').replace('.', '\\.') + '": "\\./js/' + m.replace('/', '\\/').replace('.', '\\.') + '\\?v=[0-9a-f]{10}"'));
  }
});

test('W4 i18n — voice.* 키 4개 언어 · fr·ko 실제 번역 · ar 은 아랍 문자 · VPN 을 말하지 않는다', () => {
  const keys = Object.keys(BUNDLES.en).filter((k) => k.startsWith('voice.'));
  assert.ok(keys.length >= 22, String(keys.length));
  for (const l of ['ar', 'fr', 'ko']) {
    for (const k of keys) assert.equal(typeof BUNDLES[l][k], 'string', l + ' ' + k);
  }
  const translated = (l) => keys.filter((k) => BUNDLES[l][k] !== BUNDLES.en[k] && !/^\{/.test(BUNDLES.en[k])).length;
  assert.ok(translated('ko') >= keys.length - 3, 'ko 실제 번역');
  assert.ok(translated('fr') >= keys.length - 6, 'fr 실제 번역');
  for (const k of ['voice.err.permission', 'voice.notice.body', 'voice.cmd.next']) {
    assert.match(BUNDLES.ar[k], /[\u0600-\u06FF]/, k);
    assert.match(BUNDLES.ko[k], /[가-힣]/, k);
  }
  for (const l of ['en', 'ar', 'fr', 'ko']) {
    for (const k of keys) assert.ok(!/VPN/i.test(BUNDLES[l][k]), '13절 — VPN 을 말하지 않는다: ' + l + ' ' + k);
    assert.match(BUNDLES[l]['voice.notice.body'], /Google/);
    assert.match(BUNDLES[l]['voice.err.network'] + BUNDLES[l]['voice.earphoneOk'], /\S/);
  }
  for (const c of ['play', 'pause', 'next', 'prev', 'again', 'trOn', 'trOff', 'slower', 'faster']) assert.ok(BUNDLES.en['voice.cmd.' + c], c);
});

/* ══ U12–U14 9b-3 다듬기 ═══════════════════════════════ */

test('U12 [9b-3] D10 — 안내 중 다시 탭은 그 누름의 was 를 이어받는다(읽던 중 → 명령 뒤 다시 읽기)', () => {
  const h = harness();
  startAt(h, 1);
  h.voice.press();                                   // 읽던 중 탭 → 멈춤 · 듣기
  h.rec().fire('result', ['blah blah blah']);        // 못 맞춤 → 안내 한 마디(되돌림 대기, was = speaking)
  assert.equal(h.sp.getState(), 'paused');
  assert.ok(h.voice.isListening());
  h.voice.press();                                   // ★ 안내 중 다시 탭 — 지금 상태는 paused 지만 was 는 speaking 을 이어받는다
  assert.equal(h.rec().startCalls, 1, '다시 듣기');
  h.rec().fire('result', ['next']);
  assert.equal(h.sp.getIndex(), 2);
  assert.equal(h.sp.getState(), 'speaking', '★ 이어받은 was(speaking) — 명령 뒤 읽기를 잇는다');
  // 다시 못 맞추면 안내가 끝난 뒤에도 이어받은 was 로 되돌린다
  h.voice.press();
  h.rec().fire('result', ['zzz']);
  h.voice.press();
  h.rec().fire('result', ['qqq']);
  assert.equal(h.sp.getState(), 'paused');
  h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking', '두 번 못 맞춰도 처음 누름의 was 로 되돌림');
  // 멈춘 채 시작한 누름은 이어받아도 멈춘 채
  h.sp.pause();
  h.voice.press();
  h.rec().fire('result', ['zzz']);
  h.voice.press();
  h.rec().fire('result', ['next']);
  assert.equal(h.sp.getState(), 'paused');
});

test('U13 [9b-3] 진짜 setReadalongMode·lastOnMode — trOff 가 켜진 모드를 lastOn 에 남기고 trOn 이 그것을 되살린다', () => {
  settingsStore._setCacheForTest({ 'voice.noticeAt': 1, 'readalong.mode': 'show', 'readalong.lastOn': 'speak' });
  try {
    const h = harness({ store: settingsStore, setReadalongMode: setReadalongMode, lastOnMode: lastOnMode });
    startAt(h, 0);
    h.sp.pause();
    h.voice.press();
    h.rec().fire('result', ['translation off']);
    assert.equal(settingsStore.get('readalong.mode'), 'off');
    assert.equal(settingsStore.get('readalong.lastOn'), 'show', '★ 끌 때 켜져 있던 모드(show)를 기억');
    h.voice.press();
    h.rec().fire('result', ['translation on']);
    assert.equal(settingsStore.get('readalong.mode'), 'show', '★ lastOn 으로 되살림(기본 speak 아님)');
    assert.deepEqual(h.env.modes, ['off', 'show']);
    // 이미 꺼져 있을 때 다시 끄기 — lastOn 을 off 로 덮지 않는다
    setReadalongMode('off');
    setReadalongMode('off');
    assert.equal(settingsStore.get('readalong.lastOn'), 'show');
  } finally {
    settingsStore._setCacheForTest({});
  }
});

test('U14 [9b-3] 못 맞춤 문구 — 들은 말이 없으면 따옴표 없이 · 들은 말은 따옴표 안 · Rb(부정된 첫 대안) → 실행 0', () => {
  const t = (k, p) => { let s = BUNDLES.en[k]; for (const [n, v] of Object.entries(p || {})) s = s.split('{' + n + '}').join(String(v)); return s; };
  for (const l of ['en', 'ar', 'fr', 'ko']) {
    assert.equal(typeof BUNDLES[l]['voice.noMatch.none'], 'string', l);
    assert.ok(!/[“”«»"]/.test(BUNDLES[l]['voice.noMatch.none']), l + ' — 따옴표 없음');
    assert.ok(!/\{text\}/.test(BUNDLES[l]['voice.noMatch.none']), l);
  }
  assert.equal(noMatchText(t, ''), BUNDLES.en['voice.noMatch.none']);
  assert.equal(noMatchText(t, '   '), BUNDLES.en['voice.noMatch.none']);
  assert.equal(noMatchText(t, null), BUNDLES.en['voice.noMatch.none']);
  assert.equal(noMatchText(t, 'hello'), 'Didn’t catch a command: “hello”');
  // 인식기 no-match(코드) — 상태 줄에 빈 “” 없음
  const h = harness();
  startAt(h, 0);
  h.voice.press();
  h.rec().fire('nomatch');
  assert.equal(h.lastStatus().kind, 'error');
  assert.equal(h.lastStatus().text, BUNDLES.en['voice.noMatch.none']);
  assert.ok(!/“”/.test(h.lastStatus().text));
  assert.equal(h.lastStatus().list, true, '[명령 보기] 는 그대로');
  h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking');
  // 정규화 뒤 빈 말이어도 인식기가 준 글자가 있으면 그 글자를 따옴표 안에 보인다(무엇을 들었는지)
  h.voice.press();
  h.rec().fire('result', ['...']);
  assert.equal(h.lastStatus().text, 'Didn’t catch a command: “...”', '글자가 있으면 그대로 보인다');
  h.synth.finish();
  // [말해 보기] 오류 줄
  const line = tryLines({ error: CODES.NO_MATCH, heard: [] }, t)[0];
  assert.ok(!/“”/.test(line), line);
  assert.ok(line.indexOf(BUNDLES.en['voice.noMatch.none']) === 0, line);
  // Rb — 첫 대안이 부정되면 아래 대안이 부정어를 잃었어도 실행 0(멈춤 아님 → 안내 뒤 계속 읽기)
  const a = harness({ ui: 'ar' });
  startAt(a, 1);
  a.voice.press();
  a.rec().fire('result', ['لا توقف', 'توقف']);
  assert.equal(a.lastStatus().kind, 'error');
  assert.equal(a.voice.debug().history[0].id, null);
  assert.deepEqual(a.voice.debug().history[0].trace, ['negated:pause']);
  a.synth.finish();
  assert.equal(a.sp.getState(), 'speaking', '★ 반대 동작(멈춤) 없음 — 계속 읽기');
  assert.equal(a.sp.getIndex(), 1);
});

test('W5 [9b 다듬기 Review 중-1] 가로 고지 카드 CSS — 폭 넓힘 · 높이 상한은 9b-2 식(고지 글을 카드 안 스크롤 뒤로 숨기지 않는다)', () => {
  const css = read('../css/reader.css');
  const i = css.indexOf('@media (max-height: 500px) {\n  .voice-notice {');
  assert.ok(i > 0, '가로 규칙');
  const rule = css.slice(i, css.indexOf('\n  }', i));
  assert.match(rule, /max-inline-size: none;/);
  assert.match(rule, /padding: var\(--sp-3\);/);
  assert.match(rule, /max-block-size: calc\(100dvh - var\(--bar-top\) - var\(--sp-4\)\);/, '★ 높이 상한 = 9b-2 식(바 위에서 자르지 않는다 — 330–360px 가로 높이에서 고지 글 100%)');
  assert.ok(!/--tts-h|--pager-h|--reader-chrome-bottom/.test(rule), '하단 바 높이를 높이 상한에서 빼지 않는다');
});
