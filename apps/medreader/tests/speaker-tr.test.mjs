/* ============================================================
   tests/speaker-tr.test.mjs — 8b-1 발화 단계·번역문 음성·음성 목록 (spec 6-1 · 6-2 · 6-3 · 7-8-4/5 · 16-D3 RA7~RA11)

   speaker 는 스텁 synth·가짜 타이머로 몬다(tts-speaker.test.mjs 와 같은 방식 — 데스크톱에서 재현되지
   않는 것을 인위로 만든다). 번역 쪽은 둘 중 하나:
     · `fakeTr`  — get/onChange 만 가진 번역 맵(단계 전이만 볼 때)
     · 실제 `createReadalong` + 곧장 답하는 파이프라인 스텁 — 화면 배선(controls)과 같은 이벤트 연결(RA9)
   `[8b-1 — 오케스트레이터 결정 2026-10-10]` 운영자 폰 진단: 첫 getVoices() 0개 → 9ms 뒤 92개, 영어 5·ko·fr 있음,
   **아랍어 0개인데 lang 'ar-SA' 만으로 소리 남** → "목록에 없음 ≠ 말할 수 없음". RA9 를 그 뜻으로 고정한다.
   문장은 전부 지어낸 것이다.
   ============================================================ */

// 캐시 키 해시의 끝나는 시점을 실제 시계에서 떼어 낸다(8b Review — 간헐 실패 원인, 픽스처 머리말 참고). 맨 먼저.
import './fixtures/sync-digest.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createSpeaker, CODES } from '../js/tts/speaker.js';
import { trSpeechText, trSpeechParts, splitLong } from '../js/tts/text.js';
import { ltrRuns } from '../js/text/bidi.js';
import {
  createVoiceWatch, voiceVerdict, loadVoices, pickVoice, speechLang, VOICE_ERRORS
} from '../js/tts/voices.js';
import { createReadalong, effectiveMode } from '../js/ai/readalong.js';
import { READALONG, TTS } from '../js/config.js';
import en from '../js/i18n/en.js';
import ar from '../js/i18n/ar.js';
import fr from '../js/i18n/fr.js';
import ko from '../js/i18n/ko.js';

/* ── 가짜 시계 · 엔진 ─────────────────────────────────── */

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
    now: () => now
  };
}

function fakeSynth() {
  const s = {
    speaking: false, pending: false, utt: [], current: null,
    speak(u) { s.speaking = true; s.current = u; s.utt.push(u); },
    cancel() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    finish() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onend) u.onend(); },
    fail(code) { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: code }); },
    texts() { return s.utt.map((u) => u.text); }
  };
  return s;
}

const SENTS = ['Alpha is first here.', 'Bravo comes second.', 'Charlie ends the page.'];
function line(id, text) { return { id: id, text: text, hyphen: 'none' }; }

function makeView(sents, opts) {
  const o = opts || {};
  const paras = o.paras || [{ id: 'p1', kind: 'body', lines: sents.map((t, i) => line('1:' + i, t)) }];
  const v = {
    shown: [], done: [],
    paras: () => paras,
    page: () => ({ page: 1, pageCount: 1 }),
    goToPage: () => Promise.resolve(false),
    show: (u) => { v.shown.push(u.src); return true; },
    markDone: (u) => { v.done.push(u.src); }
  };
  return v;
}

/** 번역 맵 스텁 — `set(src, {state, text})` 가 구독자에게 알린다. */
function fakeTr(initial) {
  const m = new Map(Object.entries(initial || {}));
  const fns = new Map();
  return {
    get: (u) => Object.assign({}, m.get(u.src) || { state: 'none' }),
    onChange: (u, fn) => {
      if (!fns.has(u.src)) fns.set(u.src, new Set());
      fns.get(u.src).add(fn);
      return () => fns.get(u.src).delete(fn);
    },
    set: (src, rec) => { m.set(src, rec); (fns.get(src) || new Set()).forEach((fn) => fn(rec)); },
    listeners: (src) => (fns.get(src) || new Set()).size
  };
}

const TRX = (s) => 'ترجمة ' + s.length;          // 지어낸 "번역문"

function build(o) {
  const opts = o || {};
  const synth = fakeSynth();
  const timers = fakeTimers();
  const view = makeView(opts.sents || SENTS, opts);
  const tr = opts.tr || fakeTr(opts.trInit);
  const sp = createSpeaker({
    synth: synth, timers: timers, makeUtterance: (text) => ({ text: text }), view: view,
    translation: opts.noTranslation ? null : tr, requestWakeLock: () => Promise.resolve(null)
  });
  const events = [];
  for (const type of ['error', 'phasechange', 'queue', 'linechange']) sp.addEventListener(type, (ev) => events.push({ type: type, detail: ev.detail }));
  sp.setDocLang('en-US');
  sp.setTrVoice('ar-SA', null);
  sp.setReadalong({ mode: opts.mode || 'speak', speakSource: opts.speakSource });
  return { sp, synth, timers, view, tr, events };
}

const readyAll = (sents) => Object.fromEntries(sents.map((s) => [s, { state: 'ready', text: TRX(s) }]));

/* ══ RA7 발화 순서 ═══════════════════════════════════════ */

test('RA7a ★ speak + ready → [src, tr, src, tr, …], tr 은 대상 언어 lang 으로', () => {
  const h = build({ trInit: readyAll(SENTS) });
  h.sp.play();
  for (let i = 0; i < 6; i++) h.synth.finish();
  assert.deepEqual(h.synth.texts(), [SENTS[0], TRX(SENTS[0]), SENTS[1], TRX(SENTS[1]), SENTS[2], TRX(SENTS[2])]);
  assert.deepEqual(h.synth.utt.map((u) => u.lang), ['en-US', 'ar-SA', 'en-US', 'ar-SA', 'en-US', 'ar-SA']);
  const phases = h.events.filter((e) => e.type === 'phasechange').map((e) => e.detail.phase);
  assert.deepEqual(phases.slice(0, 3), ['tr', 'src', 'tr']);
});

test('RA7b ★ pending 이 1초 뒤 도착 → 그 tr 을 읽는다 (tr-wait 은 발화 없음)', () => {
  const h = build({ trInit: { [SENTS[0]]: { state: 'pending' } } });
  h.sp.play();
  h.synth.finish();                                   // src 끝 → tr-wait
  assert.equal(h.sp.getPhase(), 'tr-wait');
  assert.equal(h.synth.current, null, 'tr-wait 동안 걸린 발화가 없다');
  h.timers.advance(1000);
  h.tr.set(SENTS[0], { state: 'ready', text: TRX(SENTS[0]) });
  assert.equal(h.synth.current.text, TRX(SENTS[0]));
  assert.equal(h.sp.getPhase(), 'tr');
});

test('RA7c ★ 도착 안 함 → TR_WAIT_MS 뒤 다음 src, 그 문장의 tr 은 끝까지 없다(되돌아가 읽지 않음)', () => {
  const h = build({ trInit: { [SENTS[0]]: { state: 'pending' } } });
  h.sp.play();
  h.synth.finish();
  h.timers.advance(READALONG.TR_WAIT_MS - 1);
  assert.equal(h.sp.getPhase(), 'tr-wait');
  h.timers.advance(1);
  assert.equal(h.synth.current.text, SENTS[1], '다음 원문');
  h.tr.set(SENTS[0], { state: 'ready', text: TRX(SENTS[0]) });        // 늦게 도착
  h.synth.finish(); h.synth.finish();
  assert.ok(h.synth.texts().indexOf(TRX(SENTS[0])) < 0, '건너뛴 문장의 번역문을 읽지 않았다');
  assert.equal(h.tr.listeners(SENTS[0]), 0, '구독이 풀렸다');
});

test('RA7d ★ failed·blocked·none → 대기 0(타이머 없이 곧장 다음 src)', () => {
  for (const st of ['failed', 'blocked', 'none']) {
    const h = build({ trInit: st === 'none' ? {} : { [SENTS[0]]: { state: st } } });
    h.sp.play();
    h.synth.finish();
    assert.equal(h.synth.current.text, SENTS[1], st);
    assert.equal(h.sp.getPhase(), 'src');
  }
});

test('RA7e ★ tr 중 pause() → resume() → 같은 tr 처음부터 (6-4 — pause() 는 쓰지 않는다)', () => {
  const h = build({ trInit: readyAll(SENTS) });
  h.sp.play();
  h.synth.finish();                                     // → tr
  assert.equal(h.synth.current.text, TRX(SENTS[0]));
  h.sp.pause();
  assert.equal(h.sp.getState(), 'paused');
  h.sp.resume();
  h.timers.advance(TTS.CANCEL_DELAY_MS);
  assert.equal(h.synth.current.text, TRX(SENTS[0]), '같은 번역문');
  assert.equal(h.sp.getPhase(), 'tr');
  h.synth.finish();
  assert.equal(h.synth.current.text, SENTS[1]);
});

test('RA7f ★ tr-wait 중 stop() 뒤 번역이 도착해도 아무것도 읽지 않는다(세대) · 일시정지 뒤 도착도', () => {
  const h = build({ trInit: { [SENTS[0]]: { state: 'pending' } } });
  h.sp.play();
  h.synth.finish();
  const n = h.synth.utt.length;
  h.sp.stop();
  h.tr.set(SENTS[0], { state: 'ready', text: TRX(SENTS[0]) });
  h.timers.advance(READALONG.TR_WAIT_MS * 3);
  assert.equal(h.synth.utt.length, n);
  const g = build({ trInit: { [SENTS[0]]: { state: 'pending' } } });
  g.sp.play(); g.synth.finish();
  const m = g.synth.utt.length;
  g.sp.pause();
  g.tr.set(SENTS[0], { state: 'ready', text: TRX(SENTS[0]) });
  g.timers.advance(READALONG.TR_WAIT_MS * 3);
  assert.equal(g.synth.utt.length, m);
  // 재개 — tr-wait 은 tr 로 본다: 도착했으니 읽는다
  g.sp.resume(); g.timers.advance(TTS.CANCEL_DELAY_MS);
  assert.equal(g.synth.current.text, TRX(SENTS[0]));
});

test('RA7g speak 가 아니면(show·off) 단계가 한 줄도 돌지 않는다 — 원문만, 지금까지와 같다', () => {
  for (const mode of ['show', 'off']) {
    const h = build({ mode: mode, trInit: readyAll(SENTS) });
    h.sp.play();
    h.synth.finish(); h.synth.finish(); h.synth.finish();
    assert.deepEqual(h.synth.texts(), SENTS, mode);
    assert.equal(h.events.filter((e) => e.type === 'phasechange').length, 0);
  }
});

test('RA7h 연속 LAG_NOTICE_AFTER 문장의 tr-wait 이 상한에 걸리면 TR_LAGGING 한 번', () => {
  const many = ['One a.', 'Two b.', 'Three c.', 'Four d.', 'Five e.'];
  const h = build({ sents: many, trInit: Object.fromEntries(many.map((s) => [s, { state: 'pending' }])) });
  h.sp.play();
  for (let i = 0; i < 5; i++) { h.synth.finish(); h.timers.advance(READALONG.TR_WAIT_MS); }
  const lag = h.events.filter((e) => e.type === 'error' && e.detail.code === CODES.TR_LAGGING);
  assert.equal(lag.length, 1);
});

/* ══ RA8 반복 · markDone ═══════════════════════════════ */

test('RA8 ★ 문장 반복(2회) + speak → [src, tr, src, tr] 뒤 다음 문장, markDone 은 두 번째 tr 이 끝난 뒤 1회', () => {
  const h = build({ trInit: readyAll(SENTS) });
  h.sp.setRepeat('unit', 2);
  h.sp.play();
  h.synth.finish();                       // src
  assert.equal(h.view.done.length, 0, 'src 뒤 markDone 없음');
  h.synth.finish();                       // tr (1회차)
  assert.equal(h.view.done.length, 0, '첫 회차 뒤 markDone 없음');
  h.synth.finish();                       // src
  h.synth.finish();                       // tr (2회차)
  assert.deepEqual(h.synth.texts().slice(0, 5), [SENTS[0], TRX(SENTS[0]), SENTS[0], TRX(SENTS[0]), SENTS[1]]);
  assert.deepEqual(h.view.done, [SENTS[0]], 'markDone 1회');
});

test('RA8b 300자 분할 원문(조각 둘) + speak → 조각 둘을 다 읽은 뒤에 tr, markDone 은 조각마다 한 번(문장 끝에서)', () => {
  const long = 'Delta ' + 'word '.repeat(70).trim() + ', and then ' + 'more '.repeat(30).trim() + '.';
  assert.ok(long.length > 300);
  const h = build({ sents: [long, SENTS[1]], trInit: { [long.replace(/\s+/g, ' ')]: { state: 'ready', text: 'ت' }, [SENTS[1]]: { state: 'ready', text: 'ب' } } });
  h.sp.play();
  h.synth.finish();
  assert.equal(h.sp.getPhase(), 'src', '첫 조각 뒤엔 둘째 조각');
  h.synth.finish();
  assert.equal(h.synth.current.text, 'ت');
  assert.equal(h.view.done.length, 0);
  h.synth.finish();
  assert.equal(h.view.done.length, 2, '두 조각 모두 읽은 표시');
  assert.equal(h.synth.current.text, SENTS[1]);
});

/* ══ RA9 번역문 음성 — 목록에 없음 ≠ 말할 수 없음 ══════════ */

function integrated(o) {
  const opts = o || {};
  const synth = fakeSynth();
  const timers = fakeTimers();
  const view = makeView(SENTS);
  const fns = new Set();
  const pipeline = {
    state: () => 'ready', onState: (fn) => { fns.add(fn); return () => fns.delete(fn); }, retry: async () => 'ready',
    translate: async (segs) => ({ status: 'ready', calls: 1, results: segs.map((s) => ({ state: 'ready', text: TRX(s.text) })) })
  };
  const ra = createReadalong({ pipeline: pipeline, cache: { getMany: async () => new Map() }, loadParas: async () => null, saveReadStats: async () => { } });
  const sp = createSpeaker({ synth: synth, timers: timers, makeUtterance: (text) => ({ text: text }), view: view, translation: ra, requestWakeLock: () => Promise.resolve(null) });
  const notices = [];
  ra.addEventListener('notice', (e) => notices.push(e.detail));
  // controls.js 와 같은 배선
  sp.addEventListener('queue', (e) => ra.onQueue(e.detail.page, e.detail.units, e.detail.seg));
  sp.addEventListener('linechange', (e) => ra.onProgress(e.detail.page, e.detail.seg));
  sp.addEventListener('statechange', () => ra.setActive(sp.getState() === 'speaking'));
  const ctx = () => ({ mode: 'speak', consented: true, srcLang: 'en', supportedSrc: ['en', 'fr', 'ko'], targetLang: 'ar', unit: 'sentence', hasKey: true, trVoice: sp.isTrDisabled() ? false : null });
  const sync = () => { const em = ra.setContext(ctx()); sp.setReadalong({ mode: em.mode, speakSource: true }); };
  sp.addEventListener('error', (e) => { if (e.detail.code === CODES.TR_VOICE_FAILED) sync(); });
  ra.setDoc({ docId: 'd', lang: 'en', target: 'ar', pageCount: 1 });
  // 운영자 폰처럼: 목록에 아랍어 음성이 없다 → voice 없이 lang 만
  const listVoices = [{ lang: 'en_US', name: 'e', voiceURI: 'e' }, { lang: 'ko_KR', name: 'k', voiceURI: 'k' }];
  const v = pickVoice('ar', listVoices);
  assert.equal(v, null, '전제: 목록에 아랍어 없음');
  sp.setDocLang('en-US');
  sp.setTrVoice(speechLang('ar', v), v);
  sync();
  return { sp, ra, synth, timers, view, notices, sync };
}

const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };

test('RA9a ★ 목록에 ar 없음 + 번역문 발화 성공 → speak 유지·알림 0 (lang 만으로 시도: ar-SA)', async () => {
  const h = integrated();
  sync0(h);
  h.sp.play();
  await settle();
  h.synth.finish();                                  // src
  assert.equal(h.synth.current.text, TRX(SENTS[0]));
  assert.equal(h.synth.current.lang, 'ar-SA');
  assert.equal(h.synth.current.voice, undefined, 'voice 객체 없이');
  h.synth.finish();                                  // tr 성공
  h.synth.finish(); h.synth.finish();
  assert.equal(h.ra.mode().mode, 'speak');
  assert.equal(h.notices.length, 0);
  assert.equal(h.synth.texts().filter((t) => t.startsWith('ترجمة')).length, 2);
});
function sync0(h) { h.sync(); }

test('RA9b ★ 목록에 ar 없음 + 첫 번역문 발화 오류 → show 로 내려가고 알림 1회, 이후 tr 발화 0건', async () => {
  const h = integrated();
  h.sp.play();
  await settle();
  h.synth.finish();                                  // src
  assert.equal(h.synth.current.text, TRX(SENTS[0]));
  h.synth.fail('language-unavailable');              // 첫 tr 실패
  assert.equal(h.ra.mode().mode, 'show');
  assert.equal(h.notices.length, 1);
  assert.equal(h.notices[0].code, 'no-voice');
  assert.equal(h.synth.current.text, SENTS[1], '원문은 계속');
  h.synth.finish(); h.synth.finish();
  assert.equal(h.synth.texts().filter((t) => t.startsWith('ترجمة')).length, 1, '이후 tr 발화 0건');
  h.sync(); h.sync();
  assert.equal(h.notices.length, 1, '알림은 한 번');
});

test('RA9c 첫 tr 이 성공한 뒤의 오류는 그 발화만 건너뛴다(TR_SKIPPED, 음성 불가로 보지 않음) · 음성이 생기면 tr 을 다시 허락', () => {
  const h = build({ trInit: readyAll(SENTS) });
  h.sp.play();
  h.synth.finish(); h.synth.finish();               // 첫 문장 src·tr 성공
  h.synth.finish();                                 // src 2
  h.synth.fail('audio-busy');                       // tr 2 실패
  const codes = h.events.filter((e) => e.type === 'error').map((e) => e.detail.code);
  assert.ok(codes.indexOf(CODES.TR_SKIPPED) >= 0);
  assert.ok(codes.indexOf(CODES.TR_VOICE_FAILED) < 0);
  assert.equal(h.sp.isTrDisabled(), false);
  const g = build({ trInit: readyAll(SENTS) });
  g.sp.play(); g.synth.finish(); g.synth.fail('synthesis-failed');
  assert.equal(g.sp.isTrDisabled(), true);
  g.sp.setTrVoice('ar-SA', { lang: 'ar_SA', name: 'x' });
  assert.equal(g.sp.isTrDisabled(), false, '음성이 목록에 생기면 다시 시도한다');
});

/* ══ RA10 speakSource = false ═════════════════════════ */

test('RA10 ★ speakSource=false — 원문 발화 0건, 하이라이트는 문장마다 1건, 번역 없는 문장은 원문으로 읽는다', () => {
  const h = build({ speakSource: false, trInit: { [SENTS[0]]: { state: 'ready', text: TRX(SENTS[0]) }, [SENTS[1]]: { state: 'failed' }, [SENTS[2]]: { state: 'ready', text: TRX(SENTS[2]) } } });
  h.sp.play();
  assert.equal(h.synth.current.text, TRX(SENTS[0]), '원문 없이 곧장 번역문');
  h.synth.finish();
  assert.equal(h.synth.current.text, SENTS[1], '번역 없는 문장은 원문으로');
  h.synth.finish();
  assert.equal(h.synth.current.text, TRX(SENTS[2]));
  h.synth.finish();
  assert.deepEqual(h.synth.texts(), [TRX(SENTS[0]), SENTS[1], TRX(SENTS[2])]);
  assert.deepEqual(h.view.shown, SENTS, '하이라이트는 문장마다 1건');
  const srcSpoken = h.synth.texts().filter((t) => SENTS.indexOf(t) >= 0 && t !== SENTS[1]);
  assert.equal(srcSpoken.length, 0, '번역 있는 문장의 원문 발화 0건');
});

test('RA10b speakSource=false + pending 이 끝내 안 옴 → 그 문장을 원문으로(소리가 끊기지 않게)', () => {
  const h = build({ speakSource: false, trInit: { [SENTS[0]]: { state: 'pending' } } });
  h.sp.play();
  assert.equal(h.sp.getPhase(), 'tr-wait');
  h.timers.advance(READALONG.TR_WAIT_MS);
  assert.equal(h.synth.current.text, SENTS[0]);
  assert.equal(h.view.shown.length, 1, '다시 칠하지 않는다');
});

/* ══ RA11 번역문 분할 · 괄호 속 라틴 문자 ══════════════════ */

test('RA11 ★ 번역문 300자 분할이 ، 와 ؛ 에서 끊는다(경계 문자는 앞 조각에)', () => {
  const a = 'ب'.repeat(180) + '، ' + 'ت'.repeat(150);
  const parts = trSpeechParts(a);
  assert.equal(parts.length, 2);
  assert.ok(parts[0].endsWith('،'));
  const b = 'ب'.repeat(200) + '؛ ' + 'ت'.repeat(150);
  const pb = trSpeechParts(b);
  assert.equal(pb.length, 2);
  assert.ok(pb[0].endsWith('؛'));
  // 원문 분할(기본 경계)은 그대로 — 아랍 쉼표에서 끊지 않는다(공백도 없으면 통째로 둔다)
  const c = 'ب'.repeat(180) + '،' + 'ت'.repeat(150);
  assert.equal(splitLong(c, 300).length, 1);
  assert.equal(trSpeechParts(c).length, 2, '번역문은 ، 에서 끊는다(공백이 없어도)');
  assert.deepEqual([...READALONG.SPLIT_BREAKS_TR], ['،', '؛', ',', ';']);
});

test('TX ★ 번역문 발화 텍스트 — 괄호 속 라틴 묶음만 빼고 화면 판정(ltrRuns)과 같은 괄호를 쓴다', () => {
  const t = 'ارتفاع بروتين سي التفاعلي (C-reactive protein) فوق ١٠ ملغ/لتر، وفحوص الدم (blood tests) طبيعية.';
  const out = trSpeechText(t);
  assert.ok(!/[A-Za-z]/.test(out), out);
  assert.ok(out.indexOf('  ') < 0, '이중 공백 없음');
  assert.ok(!/\s[،.]/.test(out), '구두점 앞 공백 없음');
  assert.ok(out.indexOf('التفاعلي فوق') >= 0);
  assert.ok(out.endsWith('طبيعية.'));
  // 같은 판정: 뺀 묶음은 정확히 ltrRuns 가 ltr 로 격리한 괄호 묶음이다
  const removed = ltrRuns(t).filter((r) => r.ltr && r.text.startsWith('(')).map((r) => r.text);
  assert.deepEqual(removed, ['(C-reactive protein)', '(blood tests)']);
  // 대상 언어 글자가 섞인 괄호는 남긴다 · 괄호 밖 라틴(mg/L)은 남긴다 · 라틴 없는 괄호는 남긴다
  assert.equal(trSpeechText('دواء (مثل aspirin) هنا'), 'دواء (مثل aspirin) هنا');
  assert.equal(trSpeechText('جرعة 10 mg/L فقط'), 'جرعة 10 mg/L فقط');
  assert.equal(trSpeechText('العدد (٣٠) هنا'), 'العدد (٣٠) هنا');
  // 한국어 대상도 같은 규칙(언어를 박지 않았다)
  assert.equal(trSpeechText('류마티스 관절염(rheumatoid arthritis)은 만성 질환이다.'), '류마티스 관절염은 만성 질환이다.');
  assert.equal(trSpeechText(''), '');
});

test('TX2 번역문 발화에서 괄호가 빠져도 화면 텍스트는 그대로(입력을 바꾸지 않는다)', () => {
  const h = build({ trInit: { [SENTS[0]]: { state: 'ready', text: 'نص (Latin words) هنا' } } });
  h.sp.play(); h.synth.finish();
  assert.equal(h.synth.current.text, 'نص هنا');
  assert.equal(h.tr.get({ src: SENTS[0] }).text, 'نص (Latin words) هنا');
});

/* ══ 6-1 표 안내 발화 — UI 언어 음성 ══════════════════════ */

test('TN ★ 표 안내(kind table-notice) 발화는 UI 언어로, 본문은 원문 언어로', () => {
  const paras = [
    { id: 'p1', kind: 'body', lines: [line('1:0', SENTS[0])] },
    { id: 'tablenotice:r0', kind: 'table-notice', lines: [line('tablenotice:r0', 'هذا جدول.')] }
  ];
  const h = build({ paras: paras, mode: 'off' });
  h.sp.setNoticeVoice('ar-SA', null);
  h.sp.play();
  h.synth.finish();
  assert.deepEqual(h.synth.utt.map((u) => u.lang), ['en-US', 'ar-SA']);
  // 지정하지 않으면 지금까지와 같다(원문 언어)
  const g = build({ paras: paras, mode: 'off' });
  g.sp.play(); g.synth.finish();
  assert.deepEqual(g.synth.utt.map((u) => u.lang), ['en-US', 'en-US']);
});

/* ══ 원문 "음성 없음" — 실제 발화 오류로만 ════════════════ */

test('NV ★ 원문 발화 오류(언어·음성 없음)일 때만 NO_VOICE · 성공한 적이 있으면 일반 오류는 NO_VOICE 가 아니다', () => {
  const h = build({ mode: 'off' });
  h.sp.play();
  h.synth.fail('language-unavailable');
  h.timers.advance(TTS.CANCEL_DELAY_MS);
  h.synth.fail('language-unavailable');
  const codes = h.events.filter((e) => e.type === 'error').map((e) => e.detail.code);
  assert.deepEqual(codes, [CODES.NO_VOICE, CODES.LINE_SKIPPED]);
  const g = build({ mode: 'off' });
  g.sp.play(); g.synth.finish();                    // 원문 발화 성공
  g.synth.fail('audio-busy'); g.timers.advance(TTS.CANCEL_DELAY_MS); g.synth.fail('audio-busy');
  assert.deepEqual(g.events.filter((e) => e.type === 'error').map((e) => e.detail.code), [CODES.LINE_SKIPPED]);
  assert.ok(VOICE_ERRORS.indexOf('voice-unavailable') >= 0 && VOICE_ERRORS.indexOf('audio-busy') < 0);
});

/* ══ 음성 목록 감시 — 운영자 폰 재현 ════════════════════ */

function voiceSynth(lists) {
  let cur = lists[0] || [];
  const fns = new Set();
  return {
    getVoices: () => cur.slice(),
    addEventListener: (t, fn) => { if (t === 'voiceschanged') fns.add(fn); },
    removeEventListener: (t, fn) => fns.delete(fn),
    change: (next) => { cur = next; fns.forEach((fn) => fn()); }
  };
}
const V = (lang, i) => ({ lang: lang, name: 'v' + lang + i, voiceURI: 'u' + lang + i, localService: true });
/** 진단 수치 꼴의 92개 — 영어 5·ko 1·fr 2·아랍어 0, 나머지는 다른 언어. */
function list92() {
  const out = ['en_AU', 'en_GB', 'en_IN', 'en_NG', 'en_US', 'ko_KR', 'fr_FR', 'fr_CA'].map((l, i) => V(l, i));
  for (let i = out.length; i < 92; i++) out.push(V(['de_DE', 'es_ES', 'it_IT', 'ja_JP', 'hi_IN', 'pt_BR'][i % 6], i));
  return out;
}

test('VW1 ★ 재현 — 첫 getVoices() 0개 → 9ms 뒤 92개: 그 사이 판정은 "확인 중"(없음 아님), 뒤에는 영어 있음 · 아랍어는 "목록에 없음"(없음 아님)', () => {
  const t = fakeTimers();
  const s = voiceSynth([[]]);
  const w = createVoiceWatch(s, { timers: t });
  const seen = [];
  w.subscribe((snap) => seen.push(snap));
  assert.equal(voiceVerdict('en', w.snapshot()), 'checking', '0개인 동안 판정하지 않는다');
  t.advance(9);
  s.change(list92());
  assert.equal(voiceVerdict('en', w.snapshot()), 'yes');
  assert.equal(voiceVerdict('ar', w.snapshot()), 'checking', '안정 전');
  t.advance(READALONG.VOICES_SETTLE_MS);
  assert.equal(w.snapshot().settled, true);
  assert.equal(voiceVerdict('ar', w.snapshot()), 'unlisted', '목록에 없음 — 들어 보기로 확정');
  assert.equal(voiceVerdict('ar', w.snapshot(), 'ok'), 'yes');
  assert.equal(voiceVerdict('ar', w.snapshot(), 'fail'), 'no');
  assert.ok(seen.length >= 2);
});

test('VW2 ★ 오경고의 경로 — 옛 loadVoices 는 엔진이 1.5초 넘게 늦으면 빈 목록을 최종으로 준다 · 감시자는 늦게 온 목록도 받는다', async () => {
  // 옛 경로: 그 빈 목록으로 controls 가 "영어 음성 없음"을 판정했다(923f60c 시점).
  const s = voiceSynth([[]]);
  const p = loadVoices(s, 30);
  await new Promise((r) => setTimeout(r, 60));
  s.change(list92());                                  // 타임아웃 뒤에 도착
  assert.deepEqual(await p, [], '옛 loadVoices — 빈 목록이 최종');
  // 새 경로
  const t = fakeTimers();
  const s2 = voiceSynth([[]]);
  const w = createVoiceWatch(s2, { timers: t });
  t.advance(TTS.VOICES_TIMEOUT_MS);                    // 타임아웃 — 빈 목록도 첫 응답
  assert.equal(w.snapshot().loaded, true);
  t.advance(2000);
  s2.change(list92());                                 // 엔진이 늦게 깼다
  assert.equal(voiceVerdict('en', w.snapshot()), 'yes', '늦게 온 목록으로 다시 판정');
});

test('VW3 ★ 지침 4 — 첫 목록에 ko 만 → 1초 뒤 en·ar 추가 → 판정이 "있음"으로 바뀌고 "없음"은 한 번도 나오지 않는다', () => {
  const t = fakeTimers();
  const s = voiceSynth([[V('ko_KR', 0)]]);
  const w = createVoiceWatch(s, { timers: t });
  const verdicts = [];
  const judge = (snap) => verdicts.push(voiceVerdict('en', snap) + '/' + voiceVerdict('ar', snap));
  judge(w.snapshot());
  w.subscribe(judge);
  t.advance(1000);
  s.change([V('ko_KR', 0), V('en_US', 1), V('ar_SA', 2)]);
  t.advance(READALONG.VOICES_SETTLE_MS * 2);
  assert.equal(verdicts[verdicts.length - 1], 'yes/yes');
  assert.ok(verdicts.every((v) => v.indexOf('no') < 0 && v.indexOf('unlisted') < 0), '없음·목록에 없음 0회: ' + verdicts.join(' '));
});

test('VW4 감시자는 voiceschanged 를 계속 듣는다(안정 뒤에도) · stop 하면 풀린다 · 엔진이 없으면 곧장 안정', () => {
  const t = fakeTimers();
  const s = voiceSynth([[V('en_US', 0)]]);
  const w = createVoiceWatch(s, { timers: t });
  t.advance(READALONG.VOICES_SETTLE_MS);
  assert.equal(w.snapshot().settled, true);
  let n = 0;
  w.subscribe(() => n++);
  s.change([V('en_US', 0), V('ar_SA', 1)]);
  assert.equal(n, 1);
  assert.equal(voiceVerdict('ar', w.snapshot()), 'yes');
  s.change([V('en_US', 0), V('ar_SA', 1)]);           // 같은 목록 — 알리지 않는다
  assert.equal(n, 1);
  w.stop();
  s.change([]);
  assert.equal(n, 1);
  const none = createVoiceWatch(null);
  assert.deepEqual([none.snapshot().loaded, none.snapshot().settled], [true, true]);
  assert.equal(speechLang('ar', null), 'ar-SA');
  assert.equal(speechLang('ko', null), 'ko-KR');
  assert.equal(speechLang('ar', { lang: 'ar_EG' }), 'ar-EG');
});

/* ══ 배선 — 소스를 읽어 고정 (controls·settings 는 DOM 에 묶여 node 에서 못 돈다) ══ */

const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('WR1 ★ controls — 목록만으로 "음성 없음"을 내지 않는다(availability·loadVoices 0) · 감시자 구독 · NO_VOICE 는 발화 오류 경로', () => {
  const c = strip(readFileSync(new URL('../js/ui/controls.js', import.meta.url), 'utf8'));
  assert.ok(!/availability\(/.test(c), '목록 판정(availability)으로 배너를 내지 않는다');
  assert.ok(!/loadVoices\(/.test(c), '첫 응답을 최종으로 쓰는 loadVoices 를 쓰지 않는다');
  assert.match(c, /sharedVoiceWatch\(synth\)/);
  assert.match(c, /watch\.subscribe\(applyVoices\)/);
  const sync = c.match(/function syncSourceVoice\(\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.ok(!/noVoiceNotice\(/.test(sync), 'syncSourceVoice 가 음성 없음 배너를 내지 않는다');
  assert.match(sync, /notice\('reader\.tts\.unsupportedLang'/);
  // 배선: queue·linechange·statechange → readalong, translation 주입, loadParas 주입
  assert.match(c, /translation: readalong/);
  assert.match(c, /loadParas: loadFlowParas/);
  assert.match(c, /readalong\.onQueue\(d\.page, d\.units, d\.seg\)/);
  assert.match(c, /readalong\.onProgress\(d\.page, d\.seg\)/);
  assert.match(c, /readalong\.setActive\(speaker\.getState\(\) === 'speaking'\)/);
  // 재생 탭 핸들러 — 유효 모드를 동기로 다시 읽고 곧장 play(await 없음)
  assert.match(c, /else \{ syncReadalong\(\); speaker\.play\(\); \}/);
  assert.ok(!/async function syncReadalong/.test(c));
});

test('WR2 ★ settings — 번역문 음성 세 갈래 + [들어 보기](data-action 위임 한 장치) · 같은 감시자 · 시험 문장은 선택지마다', () => {
  const s = strip(readFileSync(new URL('../js/ui/settings.js', import.meta.url), 'utf8'));
  assert.match(s, /case 'voice-test': runVoiceTest\(\); break;/);
  assert.match(s, /setAttribute\('data-action', 'voice-test'\)/);
  assert.ok(!/onclick/.test(s));
  assert.match(s, /sharedVoiceWatch\(synth\)/);
  assert.match(s, /voiceVerdict\(targetLang\(\), snap, readVoiceTest\(targetLang\(\)\)\)/);
  assert.match(s, /'settings\.readalong\.voice\.unlisted'/);
  assert.ok(!/loadVoices\(/.test(s));
});

test('WR3 i18n — 새 키 세 개가 네 언어에 있고 비어 있지 않다(키 집합 동일은 I1)', () => {
  for (const [name, d] of [['en', en], ['ar', ar], ['fr', fr], ['ko', ko]]) {
    for (const k of ['reader.tts.unsupportedLang', 'settings.readalong.voice.unlisted', 'settings.readalong.voice.test']) {
      assert.ok(typeof d[k] === 'string' && d[k].length > 0, name + ' ' + k);
    }
    assert.ok(!/und/.test(d['reader.tts.unsupportedLang']));
  }
});

test('WR4 effectiveMode 는 목록 판정을 받지 않는다 — controls 는 trVoice 를 실제 발화 오류(isTrDisabled)에서만 false 로', () => {
  const c = strip(readFileSync(new URL('../js/ui/controls.js', import.meta.url), 'utf8'));
  assert.match(c, /trVoice: speaker\.isTrDisabled\(\) \? false : null/);
  assert.equal(effectiveMode({ mode: 'speak', consented: true, srcLang: 'en', supportedSrc: ['en'], targetLang: 'ar', hasKey: true, trVoice: null }).mode, 'speak');
});

test('VW5 목록이 바뀌는 동안에는 안정 시계를 다시 건다 — 안정은 마지막 변화 뒤 VOICES_SETTLE_MS', () => {
  const t = fakeTimers();
  const s = voiceSynth([[V('ko_KR', 0)]]);
  const w = createVoiceWatch(s, { timers: t });
  t.advance(READALONG.VOICES_SETTLE_MS - 500);
  s.change([V('ko_KR', 0), V('en_US', 1)]);
  t.advance(600);                                       // 첫 응답 + SETTLE 은 지났다
  assert.equal(w.snapshot().settled, false, '마지막 변화로부터는 아직');
  assert.equal(voiceVerdict('ar', w.snapshot()), 'checking');
  t.advance(READALONG.VOICES_SETTLE_MS);
  assert.equal(w.snapshot().settled, true);
});

test('RA7f2 ★ tr-wait 중 일시정지 → 재개(다음 원문이 시작됨) 뒤 옛 대기 타이머·도착 알림이 와도 겹쳐 읽지 않는다(세대)', () => {
  const h = build({ trInit: { [SENTS[0]]: { state: 'pending' } } });
  h.sp.play();
  h.synth.finish();                                  // → tr-wait
  h.sp.pause();
  h.sp.resume();                                     // 도착 안 함 → 다음 원문
  h.timers.advance(TTS.CANCEL_DELAY_MS);
  assert.equal(h.synth.current.text, SENTS[1]);
  const n = h.synth.utt.length;
  h.timers.advance(READALONG.TR_WAIT_MS * 2);         // 옛 tr-wait 타이머 자리
  h.tr.set(SENTS[0], { state: 'ready', text: TRX(SENTS[0]) });   // 옛 도착 알림 자리
  assert.equal(h.synth.utt.length, n, '겹쳐 걸린 발화가 없다');
  assert.equal(h.synth.current.text, SENTS[1]);
});

/* ══ 8b Review — 운영자 폰 상황을 한 줄로 잇는다(감시자 → controls 와 같은 배선 → speaker·readalong) ══ */

/**
 * 진단 수치 그대로: 첫 getVoices() 0개 → 9ms 뒤 voiceschanged 로 92개(영어 5·ko·fr 2·아랍어 0).
 * 배선은 controls.js 의 applyVoices → syncSourceVoice·syncTrVoice 와 같은 일을 한다(DOM 이 없어 손으로 옮김).
 * 세는 것: "음성 없음"이 나올 수 있는 두 통로 — speaker 의 NO_VOICE(원문 배너)와 readalong 의 notice no-voice.
 */
function phoneRig(opts) {
  const o = opts || {};
  const t = fakeTimers();
  const vs = voiceSynth([[]]);
  const synth = fakeSynth();
  const watch = createVoiceWatch(vs, { timers: t });
  const view = makeView(SENTS);
  const pipeline = {
    state: () => 'ready', onState: () => () => { }, retry: async () => 'ready',
    translate: async (segs) => ({ status: 'ready', calls: 1, results: segs.map((s) => ({ state: 'ready', text: TRX(s.text) + ' (Latin gloss)' })) })
  };
  const ra = createReadalong({ pipeline: pipeline, cache: { getMany: async () => new Map() }, loadParas: async () => null, saveReadStats: async () => { } });
  const sp = createSpeaker({ synth: synth, timers: t, makeUtterance: (text) => ({ text: text }), view: view, translation: ra, requestWakeLock: () => Promise.resolve(null) });
  const errors = [];
  const notices = [];
  sp.addEventListener('error', (e) => errors.push(e.detail.code));
  ra.addEventListener('notice', (e) => notices.push(e.detail.code));
  sp.addEventListener('queue', (e) => ra.onQueue(e.detail.page, e.detail.units, e.detail.seg));
  sp.addEventListener('linechange', (e) => ra.onProgress(e.detail.page, e.detail.seg));
  sp.addEventListener('statechange', () => ra.setActive(sp.getState() === 'speaking'));
  const sync = () => {
    const em = ra.setContext({ mode: 'speak', consented: true, srcLang: 'en', supportedSrc: ['en', 'fr', 'ko'], targetLang: 'ar', unit: 'sentence', hasKey: true, trVoice: sp.isTrDisabled() ? false : null });
    sp.setReadalong({ mode: em.mode, speakSource: true });
  };
  sp.addEventListener('error', (e) => { if (e.detail.code === CODES.TR_VOICE_FAILED) sync(); });
  const verdicts = [];
  const apply = (snap) => {
    const en = pickVoice('en', snap.voices);
    if (en) sp.setVoice('en', en);
    sp.setDocLang(en ? String(en.lang).replace(/_/g, '-') : 'en-US');
    const arV = pickVoice('ar', snap.voices);
    const was = sp.isTrDisabled();
    sp.setTrVoice(speechLang('ar', arV), arV);
    if (was && !sp.isTrDisabled()) sync();
    verdicts.push(voiceVerdict('en', snap) + '/' + voiceVerdict('ar', snap));
  };
  watch.subscribe(apply);
  apply(watch.snapshot());
  ra.setDoc({ docId: 'd', lang: 'en', target: 'ar', pageCount: 1 });
  sync();
  return { t, vs, synth, sp, ra, errors, notices, verdicts, watch };
}

test('RV1 ★ (8b Review) 운영자 폰 — 0개 → 9ms 뒤 92개(아랍어 0): 그 사이·뒤 어디서도 "영어 음성 없음" 0 · 아랍어 speak 유지·알림 0 · lang ar-SA·voice 없음 · 괄호 속 라틴은 발화에서만 빠진다', async () => {
  const h = phoneRig();
  h.sp.play();                                       // 목록이 오기 전에 재생(탭 핸들러 — 0개)
  await settle();
  assert.equal(h.synth.current.lang, 'en-US', '목록 전 — voice 없이 lang 으로');
  h.t.advance(9);
  h.vs.change(list92());                             // 9ms 뒤 92개
  h.synth.finish();                                  // src 1 성공
  assert.equal(h.synth.current.lang, 'ar-SA');
  assert.equal(h.synth.current.voice, undefined, '아랍어 voice 객체 없이');
  assert.equal(h.synth.current.text, TRX(SENTS[0]), '발화에서는 괄호 속 라틴이 빠진다');
  assert.equal(h.ra.get(SENTS[0]).text, TRX(SENTS[0]) + ' (Latin gloss)', '띠가 읽는 화면 텍스트는 괄호 그대로');
  h.synth.finish();                                  // tr 1 성공
  assert.ok(h.synth.current.voice && /^en/.test(h.synth.current.voice.lang), '목록이 온 뒤 원문은 영어 voice');
  h.synth.finish(); h.synth.finish();
  h.t.advance(READALONG.VOICES_SETTLE_MS * 2);       // 안정 뒤
  assert.deepEqual(h.errors.filter((c) => c === CODES.NO_VOICE || c === CODES.TR_VOICE_FAILED), []);
  assert.deepEqual(h.notices, [], '"번역문 음성 없음" 알림 0');
  assert.equal(h.ra.mode().mode, 'speak');
  assert.ok(h.verdicts.every((v) => !/^no|\/no$/.test(v)), '"없음" 판정 0: ' + h.verdicts.join(' '));
  assert.equal(h.verdicts[h.verdicts.length - 1], 'yes/unlisted', '설정 화면은 "목록에 없음 — 들어 보기"');
});

test('RV2 ★ (8b Review) 같은 폰 + 첫 번역문 발화 오류 → 그때만 show·알림 1 · 원문 "음성 없음" 0 · 원문은 계속', async () => {
  const h = phoneRig();
  h.sp.play();
  await settle();
  h.t.advance(9);
  h.vs.change(list92());
  h.synth.finish();                                  // src 1
  assert.equal(h.notices.length, 0, '오류 전에는 알림 0');
  h.synth.fail('language-unavailable');              // 첫 tr 오류
  assert.equal(h.ra.mode().mode, 'show');
  assert.deepEqual(h.notices, ['no-voice']);
  assert.equal(h.synth.current.text, SENTS[1], '원문은 멈추지 않는다');
  h.synth.finish(); h.synth.finish();
  h.t.advance(READALONG.VOICES_SETTLE_MS * 2);
  assert.equal(h.notices.length, 1, '알림은 한 번');
  assert.ok(h.errors.indexOf(CODES.NO_VOICE) < 0, '원문(영어) 음성 없음은 0');
});
