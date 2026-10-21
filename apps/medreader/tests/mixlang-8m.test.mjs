/* ============================================================
   tests/mixlang-8m.test.mjs — 8m 문장별 글자 체계로 목소리 전환 (spec 19-1-2 2-1–2-6 · 19-1-3 §4)

   T-L1 `unitLang` 표 · T-L2 단일 언어 큐 불변(켬/끔 JSON 같음) · T-L3 혼합 문단(물려받기·기호 표) ·
   T-L4 speaker 단위마다 utt.lang·voice · T-L5 전환 음성 실패 → 문서 언어로 다시 · T-L6 readalong 같은 언어 생략 ·
   T-L7 요청 항목 `src` · 설정·문구 · 띄어진/붙은 한글 꼴 기록 · 실측 기록(숫자만).
   문장은 모두 지어낸 것이다(원서 문장 아님).
   ============================================================ */

import './fixtures/sync-digest.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { unitLang, scriptRuns, SCRIPT_SWITCH } from '../js/text/lang.js';
import { buildUnits, sentencesOf } from '../js/tts/text.js';
import { createSpeaker, CODES } from '../js/tts/speaker.js';
import { createReadalong } from '../js/ai/readalong.js';
import { createPipeline, STATES } from '../js/ai/pipeline.js';
import { createCache, keyFor } from '../js/ai/cache.js';
import { buildTranslateRequest, SRC_LINE, PROMPT_VERSION } from '../js/ai/prompts.js';
import { buildPageLayout } from '../js/text/layout.js';
import { toStored, fromStored } from '../js/text/store.js';
import { describePage, flowParasOf } from '../js/text/screen.js';
import { DEFAULTS } from '../js/settings.js';
import { BUNDLES, LANGS } from '../js/i18n/index.js';
import { FAKE_KEY, memDb, stubFetch, docItems, echoTranslate, settingsOf, manualTimers } from './fixtures/ai-stubs-8a.mjs';

const { langSpeechOf } = await import('../js/ui/controls.js');

const ln = (id, text, hyphen) => ({ id: id, text: text, hyphen: hyphen || 'none' });
const para = (id, lines, kind) => ({ id: id, kind: kind || 'body', lines: lines });
const flush = async (n) => { for (let i = 0; i < (n || 30); i++) await new Promise((r) => setImmediate(r)); };

/* ══ T-L1 unitLang ═════════════════════════════════════ */

test('T-L1 ★ 합성 18개 — dev 시제품과 같은 기대값(spec 19-1-2 2-2)', () => {
  const SYN = [
    ['en', 'The patient was treated with methotrexate.', null],
    ['en', '이 문장은 현재완료를 씁니다.', 'ko'],
    ['en', 'ADHD는 주의력 결핍 장애다.', 'ko'],
    ['en', 'Use despite + 명사', null],
    ['en', '예: I have lived here since 2010.', null],
    ['en', '(b)', null],
    ['en', '12.5 mg/kg', null],
    ['en', 'α-blockers and β-blockers', null],
    ['en', '참고', 'ko'],
    ['en', 'Note 참고: see Unit 12', null],
    ['en', 'التهاب المفاصل الروماتويدي', 'ar'],
    ['en', 'Rheumatoid arthritis (التهاب المفاصل)', null],
    ['ko', 'She has been working since morning.', 'en'],
    ['ko', '그녀는 아침부터 일하고 있다.', null],
    ['ko', 'since 는 시점, for 는 기간을 나타낸다.', null],
    ['ko', '학교(學校)에 갔다.', null],
    ['fr', 'Le patient a été traité.', null],
    ['fr', '환자는 치료를 받았다.', 'ko']
  ];
  for (const [dl, s, want] of SYN) assert.equal(unitLang(s, dl).lang, want, dl + ' | ' + s);
});

test('T-L1 짧음·섞임 갈래 — 이모지·숫자만·"COVID-19 환자"·아랍 발음 부호·동률', () => {
  assert.deepEqual(unitLang('😀👍', 'en'), { lang: null, short: true, mixed: false }, '이모지는 글자가 아니다');
  assert.deepEqual(unitLang('12.5 / 30 %', 'en'), { lang: null, short: true, mixed: false }, '숫자만');
  assert.deepEqual(unitLang('A', 'ko'), { lang: null, short: true, mixed: false }, '라틴 1글자');
  assert.deepEqual(unitLang('(b)', 'ko').short, true);
  // "COVID-19 환자" — 라틴 덩어리 1 대 한글 1 → 동률 → 섞임(문서 언어)
  assert.deepEqual(unitLang('COVID-19 환자', 'en'), { lang: null, short: false, mixed: true });
  assert.deepEqual(unitLang('COVID-19 환자', 'ko'), { lang: null, short: false, mixed: true });
  assert.equal(unitLang('COVID-19 환자가 늘었다', 'en').lang, 'ko', '한글 덩어리 2 대 1');
  // 아랍 발음 부호(타슈킬)는 결합 문자 — 낱말 하나를 쪼개지 않는다
  const tashkeel = 'مُحَمَّدٌ طَبِيبٌ';
  assert.equal(scriptRuns(tashkeel).runs.arabic, 2);
  assert.equal(unitLang(tashkeel, 'en').lang, 'ar');
  assert.equal(unitLang(tashkeel, 'ar').lang, null, '문서 언어와 같으면 예외 없음');
  // 3/5 경계 — 덩어리 3 대 2 는 60% 정확히 → 갈림, 2 대 1 대 … 처럼 60% 미만은 섞임
  assert.equal(unitLang('one two three 넷 다섯', 'ko').lang, 'en', '3/5 = 60% 는 갈린다');
  assert.equal(unitLang('one two 셋 넷 لا', 'ko').mixed, true, '2/5 — 섞임');
  assert.deepEqual(SCRIPT_SWITCH, { MIN_LETTERS: 2, SHARE_NUM: 3, SHARE_DEN: 5 });
  // 그리스·한자는 중립 — 세지 않는다
  assert.equal(unitLang('αβγ δεζ', 'ko').short, true);
  assert.equal(unitLang('學校 病院', 'en').short, true);
  // ko 문서 안 라틴 → en, fr 문서 안 라틴 → 문서 언어(예외 없음), und 문서 안 라틴 → en
  assert.equal(unitLang('The cat sat.', 'ko').lang, 'en');
  assert.equal(unitLang('The cat sat.', 'fr').lang, null);
  assert.equal(unitLang('The cat sat.', 'und').lang, 'en');
});

/* ══ T-L2 단일 언어 큐 불변 ═════════════════════════════ */

const LONG = 'The committee compared several regimens across many centers, including older agents, newer biologic agents, and combined approaches, while tracking laboratory markers, imaging findings, functional scores, and the frequency of adverse events over a follow-up period that, in some cohorts, extended well beyond the original window.';
const TU_PARAS = [
  para('p1', [ln('1:1', 'continued from before. Dr. Kim reviewed the'), ln('1:2', 'chart, e.g. Temperature and pulse, and noted a cardio-', 'hidden'), ln('1:3', 'vascular risk of ≥ 20% in 3 of 10 cases.')]),
  para('p2', [ln('2:1', LONG)]),
  para('p3', [ln('3:1', 'Treatment Options')], 'heading'),
  para('p4', [ln('4:1', 'See www.example.org for more. Smith et al. showed'), ln('4:2', 'that rest helps (Lee, 2020). [Note] Values vary.')]),
  para('tablenotice:5:r0', [ln('n1', 'Table skipped.')], 'table-notice'),
  para('p5', [ln('5:1', 'The final sentence continues on the')])
];

test('T-L2 ★★ 기존 픽스처(8h T-U) — en·fr 문서는 scriptSwitch 켬/끔 큐 JSON 이 바이트까지 같다(lang 속성 0개)', () => {
  for (const lang of ['en', 'fr']) {
    for (const unit of ['sentence', 'line']) {
      const off = JSON.stringify(buildUnits(TU_PARAS, unit, { lang: lang }));
      const on = JSON.stringify(buildUnits(TU_PARAS, unit, { lang: lang, scriptSwitch: true }));
      assert.equal(on, off, lang + ' ' + unit);
      assert.ok(!/"lang":/.test(on));
    }
  }
  // 기본(옵션 없음)은 끔 — 8m 이전과 같다
  assert.equal(JSON.stringify(buildUnits(TU_PARAS, 'sentence', { lang: 'ko' })), JSON.stringify(buildUnits(TU_PARAS, 'sentence', { lang: 'ko', scriptSwitch: false })));
});

test('T-L2 ko 로 표시된 영어 픽스처는 켜면 영어 문장이 en 예외가 된다(그것이 O2 의 요청) — 다른 속성은 그대로', () => {
  const off = buildUnits(TU_PARAS, 'sentence', { lang: 'ko' });
  const on = buildUnits(TU_PARAS, 'sentence', { lang: 'ko', scriptSwitch: true });
  assert.equal(on.length, off.length);
  for (let i = 0; i < on.length; i++) {
    const a = Object.assign({}, on[i]);
    delete a.lang;
    // 기호 표: ko 표는 비어 있고 en 표는 "≥ → greater than…" — 영어 문장은 이제 en 표로 읽는다
    if (on[i].lang === 'en' && on[i].text !== off[i].text) { delete a.text; const b = Object.assign({}, off[i]); delete b.text; assert.deepEqual(a, b); continue; }
    assert.deepEqual(a, off[i]);
  }
  assert.ok(on.filter((u) => u.lang === 'en').length > 0);
  assert.ok(on.filter((u) => u.kind === 'table-notice').every((u) => !('lang' in u)), '표 안내는 판별하지 않는다');
});

test('T-L2 ★ 합성 2단 쪽(실제 레이아웃 → 저장본 → 화면 문단) — en 문서 켬/끔 같다', () => {
  const FX = JSON.parse(readFileSync(new URL('./fixtures/synth-2col.json', import.meta.url), 'utf8'));
  const L = buildPageLayout(FX.items, { pageNo: FX.pageNo, width: FX.width, height: FX.height, styles: FX.styles });
  const paras = flowParasOf(describePage(fromStored(toStored(L))));
  assert.ok(paras.length > 3);
  for (const unit of ['sentence', 'line']) {
    assert.equal(JSON.stringify(buildUnits(paras, unit, { lang: 'en', scriptSwitch: true })), JSON.stringify(buildUnits(paras, unit, { lang: 'en' })), unit);
  }
});

/* ══ T-L3 혼합 문단 ═════════════════════════════════════ */

test('T-L3 ★ [영어 문장, 한국어 문장, "(b)"] → lang [없음, ko, ko(물려받음)] · 한국어 단위의 기호 표 = ko', () => {
  // en 문서의 문장 분할은 마침표 뒤가 라틴 대문자·숫자·괄호일 때만 끊는다(segment.js — 8m 은 분할을 바꾸지 않는다).
  // 그래서 한국어 문장은 "(a)" 로 시작하게 둔다 — 아래 "분할 한계" 기록 참고.
  const paras = [
    para('p1', [ln('1:1', 'The rate rose by 20% this year. (a) 비율이 20% 올랐다. (b)')]),
    para('p2', [ln('2:1', '(c)')])                     // 다른 문단 — 물려받지 않는다
  ];
  const us = buildUnits(paras, 'sentence', { lang: 'en', scriptSwitch: true });
  assert.deepEqual(us.map((u) => u.src), ['The rate rose by 20% this year.', '(a) 비율이 20% 올랐다.', '(b)', '(c)']);
  assert.deepEqual(us.map((u) => u.lang), [undefined, 'ko', 'ko', undefined]);
  assert.ok(!('lang' in us[0]) && !('lang' in us[3]), '예외 없는 단위에는 속성 자체가 없다');
  assert.equal(us[0].text, 'The rate rose by 20 percent this year.', '영어는 en 표');
  assert.equal(us[1].text, '(a) 비율이 20% 올랐다.', '한국어 문장의 % 를 영어 낱말로 읽지 않는다');
  // 줄 모드도 같은 규칙(줄 단위)
  const lines = buildUnits([para('q', [ln('a', 'An English line here.'), ln('b', '한국어 줄입니다.'), ln('c', '1)')])], 'line', { lang: 'en', scriptSwitch: true });
  assert.deepEqual(lines.map((u) => u.lang), [undefined, 'ko', 'ko']);
  // 300자 조각은 같은 src 라 같은 lang
  const longKo = '가나다라마바사 '.repeat(50).trim() + '.';
  const parts = buildUnits([para('k', [ln('k1', longKo)])], 'sentence', { lang: 'en', scriptSwitch: true });
  assert.ok(parts.length >= 2 && parts.every((u) => u.lang === 'ko'));
  // sentencesOf 항목은 lang 을 들고 간다(있을 때만)
  const so = sentencesOf(us);
  assert.deepEqual(so.map((s) => s.lang), [undefined, 'ko', 'ko', undefined]);
  assert.ok(!('lang' in so[0]));
});

test('T-L3 아랍 문자 문단(en 문서) → ar · ko 문서 안 영어 예문 → en(ko 분할은 한글 앞에서도 끊는다)', () => {
  const us = buildUnits([para('a', [ln('1', 'The term is explained below.')]), para('b', [ln('2', 'التهاب المفاصل مرض مزمن.')])], 'sentence', { lang: 'en', scriptSwitch: true });
  assert.deepEqual(us.map((u) => u.lang), [undefined, 'ar']);
  const ko = buildUnits([para('k', [ln('1', '다음 예문을 보자. She has lived here since 2010.')])], 'sentence', { lang: 'ko', scriptSwitch: true });
  assert.deepEqual(ko.map((u) => u.lang), [undefined, 'en']);
});

/* ══ T-L4·T-L5 speaker ═════════════════════════════════ */

function fakeTimers() {
  let now = 0; let seq = 1; const jobs = new Map();
  return {
    setTimeout: (fn, ms) => { const k = seq++; jobs.set(k, { fn, at: now + (Number(ms) || 0) }); return k; },
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
    }
  };
}

function fakeSynth() {
  const s = {
    speaking: false, pending: false, utt: [], current: null,
    speak(u) { s.speaking = true; s.current = u; s.utt.push(u); },
    cancel() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    finish() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onend) u.onend(); },
    fail(code) { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: code }); }
  };
  return s;
}

const EN1 = 'The patient was stable after the walk.';
const KO1 = '환자는 산책 뒤 안정적이었다.';
const EN2 = 'Fever was not noted again.';
const KO2 = '열은 다시 나지 않았다.';
const NOTICE = 'This page has a table.';
const KO_VOICE = { name: 'KO voice', lang: 'ko_KR', voiceURI: 'urn:ko' };

const MIX_PARAS = [
  para('p1', [ln('1:0', EN1)]),
  para('p1b', [ln('1:1', KO1)]),
  para('p2', [ln('2:0', EN2)]),
  para('tablenotice:r0', [ln('tablenotice:r0', NOTICE)], 'table-notice'),
  para('p3', [ln('3:0', KO2)])
];

function rig(o) {
  const opts = o || {};
  const synth = fakeSynth();
  const timers = fakeTimers();
  const lines = [];
  const errors = [];
  const view = {
    paras: () => opts.paras || MIX_PARAS,
    page: () => ({ page: 1, pageCount: 1 }),
    goToPage: () => Promise.resolve(false),
    show: () => true,
    markDone: () => {}
  };
  const deps = { synth, timers, view, makeUtterance: (text) => ({ text }), requestWakeLock: () => Promise.resolve(null) };
  if (opts.translation) deps.translation = opts.translation;
  if (opts.scriptSwitch) deps.scriptSwitch = opts.scriptSwitch;
  deps.langSpeech = opts.langSpeech || ((lang) => (lang === 'ko' ? { tag: 'ko-KR', voice: KO_VOICE } : { tag: lang + '-XX', voice: null }));
  const sp = createSpeaker(deps);
  sp.setDocLang('en-US');
  sp.setNoticeVoice('fr-FR', null);
  sp.addEventListener('linechange', (ev) => lines.push(ev.detail));
  sp.addEventListener('error', (ev) => errors.push(ev.detail));
  return { sp, synth, timers, lines, errors };
}

function runAll(h, n) { h.sp.play(); for (let i = 0; i < n; i++) h.synth.finish(); }
const said = (h) => h.synth.utt.map((u) => ({ text: u.text, lang: u.lang, voice: u.voice ? u.voice.name : null }));

test('T-L4 ★ 단위마다 utt.lang·voice — ko 단위는 ko 음성, 뒤의 영어 단위는 문서 언어로 돌아온다 · 표 안내 불변', () => {
  const h = rig();
  runAll(h, 5);
  assert.deepEqual(said(h), [
    { text: EN1, lang: 'en-US', voice: null },
    { text: KO1, lang: 'ko-KR', voice: 'KO voice' },
    { text: EN2, lang: 'en-US', voice: null },
    { text: NOTICE, lang: 'fr-FR', voice: null },
    { text: KO2, lang: 'ko-KR', voice: 'KO voice' }
  ]);
});

test('T-L4 tts.scriptSwitch 끔 — 모든 단위가 문서 언어(큐에 lang 없음) · langSpeech 가 없으면 voice 없이 기본 태그', () => {
  const off = rig({ scriptSwitch: () => false });
  runAll(off, 5);
  assert.deepEqual(said(off).map((u) => u.lang), ['en-US', 'en-US', 'en-US', 'fr-FR', 'en-US']);
  const h = rig({ langSpeech: () => null });
  runAll(h, 2);
  assert.deepEqual(said(h)[1], { text: KO1, lang: 'ko-KR', voice: null }, 'defaultSpeechTag(ko)');
  // 설정은 큐를 만들 때마다 읽는다 — setScriptSwitch(false)(deps 없음)도 다음 큐부터
  const s = rig({ scriptSwitch: undefined });
  s.sp.setScriptSwitch(false);
  runAll(s, 2);
  assert.deepEqual(said(s).slice(0, 2).map((u) => u.lang), ['en-US', 'en-US']);
});

test('T-L4 langSpeechOf — 8k 해석 함수(resolveSpeech) 그대로: 고른 음성·억양·휴대폰 설정 따름', () => {
  const list = [KO_VOICE, { name: 'EN GB', lang: 'en_GB', voiceURI: 'urn:engb' }];
  const get = (k) => ({ 'tts.voice.ko': 'urn:ko', 'tts.accent.en': 'en-GB' })[k] ?? DEFAULTS[k];
  assert.deepEqual(langSpeechOf('ko', list, get), { tag: 'ko-KR', voice: KO_VOICE });
  assert.deepEqual(langSpeechOf('en', list, get), { tag: 'en-GB', voice: null });
  const none = langSpeechOf('ar', [], (k) => DEFAULTS[k]);
  assert.equal(none.voice, null);
  assert.equal(none.tag, 'ar-SA');
});

test('T-L5 ★ ko 단위 language-unavailable(재시도 뒤에도) → NO_VOICE 없음 · 같은 단위를 문서 언어로 · 안내 1회 · 이후 ko 전환 없음', () => {
  const h = rig();
  h.sp.play();
  h.synth.finish();                                   // EN1
  assert.equal(h.synth.utt[1].lang, 'ko-KR');
  h.synth.fail('language-unavailable');               // KO1 — 1회 재시도
  h.timers.advance(100);
  assert.equal(h.synth.utt[2].lang, 'ko-KR', '기존 1회 재시도는 그대로');
  h.synth.fail('language-unavailable');
  h.timers.advance(100);
  assert.deepEqual(said(h)[3], { text: KO1, lang: 'en-US', voice: null }, '같은 단위를 문서 언어로 다시');
  h.synth.finish(); h.synth.finish(); h.synth.finish(); // KO1(en) · EN2 · NOTICE
  assert.deepEqual(said(h)[6], { text: KO2, lang: 'en-US', voice: null }, '세션 동안 ko 전환 끔');
  assert.deepEqual(h.errors.map((e) => e.code), [CODES.SWITCH_NO_VOICE]);
  assert.equal(h.errors[0].lang, 'ko');
  assert.deepEqual(h.sp.getSwitchOff(), ['ko']);
  assert.ok(!h.errors.some((e) => e.code === CODES.NO_VOICE || e.code === CODES.LINE_SKIPPED));
});

test('T-L5 전환 단위의 다른 오류(재시도 뒤) — 건너뛰지만 NO_VOICE(문서 언어 판정)는 내지 않는다 · 문서 언어 단위의 음성 오류는 그대로 NO_VOICE', () => {
  const h = rig();
  h.sp.play();
  h.synth.finish();
  h.synth.fail('synthesis-failed'); h.timers.advance(100);
  h.synth.fail('synthesis-failed'); h.timers.advance(100);
  assert.deepEqual(h.errors.map((e) => e.code), [CODES.LINE_SKIPPED]);
  assert.equal(h.synth.current.text, EN2);
  const d = rig();
  d.sp.play();
  d.synth.fail('language-unavailable'); d.timers.advance(100);
  d.synth.fail('language-unavailable'); d.timers.advance(100);
  assert.deepEqual(d.errors.map((e) => e.code), [CODES.NO_VOICE, CODES.LINE_SKIPPED]);
});

test('T-L4 ★ 번역 대상 언어와 같은 단위 — 번역문 단계 없음 · linechange seg 비움(띠 "번역 없음") · 다른 단위는 그대로', () => {
  const asked = [];
  const translation = {
    get: (u) => { asked.push(u.src); return { state: 'ready', text: 'TR' }; },
    onChange: () => () => {}
  };
  const h = rig({ translation: translation });
  h.sp.setTrVoice('ko-KR', null, true);               // 대상 ko
  h.sp.setReadalong({ mode: 'speak', speakSource: true });
  h.sp.play();
  h.synth.finish();                                   // EN1 → tr
  assert.equal(h.synth.current.text, 'TR');
  h.synth.finish();                                   // tr → KO1
  assert.equal(h.synth.current.text, KO1);
  h.synth.finish();                                   // KO1 → (tr 없음) EN2
  assert.equal(h.synth.current.text, EN2);
  assert.ok(!asked.includes(KO1), 'ko 단위는 번역을 묻지 않는다');
  const byText = (s) => h.lines.find((l) => l.src === s);
  assert.equal(byText(KO1).seg, null);
  assert.equal(Number.isInteger(byText(EN1).seg), true);
  assert.equal(Number.isInteger(byText(EN2).seg), true);
});

/* ══ T-L6 readalong ════════════════════════════════════ */

function recPipeline() {
  const calls = [];
  return {
    calls,
    state: () => STATES.READY,
    onState: () => () => {},
    retry: async () => STATES.READY,
    translate: async (segs, ctx) => {
      calls.push({ segs: segs.map((s) => Object.assign({}, s)), ctx: ctx });
      return { status: STATES.READY, calls: 1, results: segs.map((s) => ({ state: 'ready', text: 'TR(' + s.text + ')' })) };
    }
  };
}

const RA_PAGE = [
  para('a', [ln('1:0', EN1)]),
  para('a2', [ln('1:2', KO1)]),
  para('a3', [ln('1:3', EN2)]),
  para('b', [ln('1:1', 'التهاب المفاصل مرض مزمن.')])
];

async function raRun(target, sw) {
  const pipeline = recPipeline();
  const ra = createReadalong({
    pipeline: pipeline,
    cache: { getMany: async () => new Map() },
    getSetting: (k) => (k === 'tts.scriptSwitch' ? sw : k === 'ai.maxReqChars' ? 6000 : undefined),
    saveReadStats: async () => {},
    loadParas: async () => null
  });
  ra.setDoc({ docId: 'd1', lang: 'en', target: target, pageCount: 1 });
  ra.setContext({ mode: 'show', consented: true, srcLang: 'en', supportedSrc: ['en', 'fr', 'ko'], targetLang: target, unit: 'sentence', hasKey: true });
  ra.setActive(true);
  const opts = { lang: 'en' };
  if (sw !== false) opts.scriptSwitch = true;
  const units = buildUnits(RA_PAGE, 'sentence', opts);
  ra.onQueue(1, units, units[0].seg);
  await flush();
  return { ra, pipeline, units };
}

test('T-L6 ★ 대상 ko — ko 문장은 요청에 없다(호출 감소) · 나머지는 같은 텍스트(캐시 키 불변) · ar 문장은 src', async () => {
  const on = await raRun('ko', true);
  const sent = on.pipeline.calls.flatMap((c) => c.segs);
  assert.deepEqual(sent.map((s) => s.text), [EN1, EN2, 'التهاب المفاصل مرض مزمن.']);
  assert.deepEqual(sent.map((s) => s.src), [undefined, undefined, 'ar']);
  assert.deepEqual(on.ra.get(KO1), { state: 'none' });
  const off = await raRun('ko', false);
  const sentOff = off.pipeline.calls.flatMap((c) => c.segs);
  assert.deepEqual(sentOff.map((s) => s.text), [EN1, KO1, EN2, 'التهاب المفاصل مرض مزمن.'], '끄면 8m 이전과 같다');
  assert.ok(sentOff.every((s) => !('src' in s)));
  // 같은 원문 = 같은 키(7-5 는 원문 언어를 넣지 않는다)
  assert.equal(await keyFor('d1', EN1, 'ko', 'readalong'), await keyFor('d1', EN1, 'ko', 'readalong'));
  const chars = (list) => list.reduce((n, s) => n + [...s.text].length, 0);
  assert.equal(chars(sentOff) - chars(sent), [...KO1].length, '줄어든 글자 = ko 문장');
});

test('T-L7 ★ 대상 ar — 문서 언어와도 대상 언어와도 다른 ko 문장만 src:ko · ar 문장(대상)은 빠진다', async () => {
  const r = await raRun('ar', true);
  const sent = r.pipeline.calls.flatMap((c) => c.segs);
  assert.deepEqual(sent.map((s) => s.text), [EN1, KO1, EN2]);
  assert.deepEqual(sent.map((s) => s.src), [undefined, 'ko', undefined]);
  assert.equal(r.pipeline.calls[0].ctx.src, 'en', '문서 언어는 그대로');
});

test('T-L7 buildTranslateRequest — src 는 문서 언어와 다르고 이름이 있을 때만 · 없으면 8m 이전과 같은 요청', () => {
  const L = { src: 'en', target: 'ar' };
  const plain = buildTranslateRequest([{ text: EN1 }, { text: EN2, frag: 'head' }], L);
  const same = buildTranslateRequest([{ text: EN1, src: 'en' }, { text: EN2, frag: 'head', src: null }], L);
  assert.deepEqual(same, plain, 'src = 문서 언어·null 은 아무것도 바꾸지 않는다');
  assert.ok(!plain.user.includes(SRC_LINE));
  const bad = buildTranslateRequest([{ text: EN1, src: 'xx' }], L);
  assert.ok(!bad.user.includes('"src"'), '모르는 코드는 버린다');
  const mix = buildTranslateRequest([{ text: EN1 }, { text: KO1, src: 'ko' }], L);
  assert.ok(mix.user.includes(SRC_LINE));
  const a = mix.user.indexOf('<<<DOC\n');
  const items = JSON.parse(mix.user.slice(a + 7, mix.user.lastIndexOf('\n>>>')));
  assert.deepEqual(items, [{ i: 0, text: EN1 }, { i: 1, text: KO1, src: 'ko' }]);
  assert.ok(PROMPT_VERSION >= 2);   // `[8p]` 3 — 번역 문체(domain). 8m 이 올린 판 이상
});

test('T-L7 실제 파이프라인 — 요청 본문의 항목 src · 기기 내 번역은 src 없는 항목만(같은 언어 쌍)', async () => {
  const db = memDb();
  const fetch = stubFetch(echoTranslate());
  const odAsked = [];
  const p = createPipeline({
    fetch: fetch, db: db, cache: createCache({ db: db, now: () => 0 }), getKey: () => FAKE_KEY,
    getSetting: settingsOf(), now: () => 0, isOnline: () => true, setTimer: manualTimers().set, clearTimer: () => {},
    ondevice: async (texts) => { odAsked.push(texts.slice()); return texts.map((t) => 'OD(' + t + ')'); },
    listen: false
  });
  const r = await p.translate([{ text: EN1 }, { text: KO1, src: 'ko' }], { src: 'en', target: 'ar', kind: 'readalong', docId: 'd' });
  assert.deepEqual(odAsked, [[EN1]], 'ko 항목은 기기 내 번역(en→ar)에 넣지 않는다');
  assert.equal(fetch.calls.length, 1);
  assert.deepEqual(docItems(fetch.calls[0].init), [{ i: 0, text: KO1, src: 'ko' }]);
  assert.deepEqual(r.results.map((x) => x.state), ['ready', 'ready']);
  assert.equal(r.results[0].text, 'OD(' + EN1 + ')');
  // src 가 없으면 지금처럼 전부 기기 내
  const p2 = createPipeline({
    fetch: stubFetch(echoTranslate()), db: memDb(), cache: createCache({ db: memDb(), now: () => 0 }), getKey: () => FAKE_KEY,
    getSetting: settingsOf(), now: () => 0, isOnline: () => true, setTimer: manualTimers().set, clearTimer: () => {},
    ondevice: async (texts) => texts.map((t) => 'OD(' + t + ')'), listen: false
  });
  const r2 = await p2.translate([{ text: EN1 }, { text: EN2, src: 'en' }], { src: 'en', target: 'ar', kind: 'readalong', docId: 'd' });
  assert.deepEqual(r2.results.map((x) => x.text), ['OD(' + EN1 + ')', 'OD(' + EN2 + ')']);
});

/* ══ 설정 · 문구 · 화면 자리 ═════════════════════════════ */

test('설정 tts.scriptSwitch — 기본 켬(O-D5 (가)) · 네 언어 문구 3개 · 설정 화면 자리', () => {
  assert.equal(DEFAULTS['tts.scriptSwitch'], true);
  for (const l of LANGS) {
    const b = BUNDLES[l];
    for (const k of ['settings.tts.scriptSwitch', 'settings.tts.scriptSwitch.help', 'reader.tts.switchNoVoice']) {
      assert.equal(typeof b[k], 'string', l + ' ' + k);
      assert.ok(b[k].length > 5);
    }
    assert.ok(b['reader.tts.switchNoVoice'].includes('{lang}'), l);
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(/id="ttsScriptSwitch"/.test(html) && /data-i18n="settings\.tts\.scriptSwitch"/.test(html));
});

/* ══ 기록 — 띄어진·붙은 한글 꼴(한국어 OCR) · 실측 숫자 ══════════════ */

test('기록 — 띄어진 한글("패 턴 이 …" 꼴)은 한글 덩어리를 부풀려 ko 쪽, 붙은 한글은 줄여 라틴 쪽으로 기운다(고치지 않음)', () => {
  const spaced = '패 턴 이 사 용 된 문 장 pattern';
  assert.equal(scriptRuns(spaced).runs.hangul, 8);
  assert.equal(unitLang(spaced, 'en').lang, 'ko');
  const normal = '패턴이 사용된 문장 is a pattern';
  assert.equal(unitLang(normal, 'ko').mixed, true, '3 대 3 — 섞임');
  const glued = '패턴이사용된문장 is a pattern';
  assert.equal(scriptRuns(glued).runs.hangul, 1);
  assert.equal(unitLang(glued, 'ko').lang, 'en', '붙으면 덩어리 1 대 3 → en');
});

test('기록 — 분할 한계: en 문서에서 "영어 문장. 한국어 문장." 은 한 단위(마침표 뒤 한글은 문장 시작으로 보지 않는다) → 섞임 → 문서 목소리', () => {
  const us = buildUnits([para('p', [ln('1', 'The rate rose. 비율이 크게 올랐다.')])], 'sentence', { lang: 'en', scriptSwitch: true });
  assert.equal(us.length, 1);
  assert.ok(!('lang' in us[0]));
  assert.equal(unitLang(us[0].src, 'en').mixed, true);
});

test('기록 [실측 2026-10-21 — 8m Build 첫 단계] 숫자만 — 해커스 87개 섞임 10.06% · 단일 언어 책 섞임 0', () => {
  const HK = { files: 87, units: 14729, mixed: 1482, lineJoin: 356, tinyTie: 302, otherHeavy: 1169, switchEn: 1593, switchKo: 5 };
  assert.equal(Math.round((HK.mixed / HK.units) * 10000) / 100, 10.06);
  assert.equal(Math.round((HK.lineJoin / HK.mixed) * 100), 24);
  assert.equal(Math.round((HK.tinyTie / HK.mixed) * 100), 20);
  const SAMPLES = [[175, 19], [647, 101], [347, 43]];   // DM B2 · Part7 B2 · bulls eye B2 (단위, 섞임)
  assert.deepEqual(SAMPLES.map(([u, m]) => Math.round((m / u) * 10000) / 100), [10.86, 15.61, 12.39]);
  const SINGLE = { cmdt2026: [2047, 0, 0], cmdt2021: [2272, 0, 0], harrison: [845, 0, 0], grammarOcr: [825, 0, 0] };   // [단위, 예외, 섞임]
  for (const k of Object.keys(SINGLE)) assert.deepEqual(SINGLE[k].slice(1), [0, 0], k);
});
