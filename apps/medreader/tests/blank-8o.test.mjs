/* ============================================================
   tests/blank-8o.test.mjs — 8o 빈칸 낭독 (spec 19-1-3 §6 · 결정 L-D11 (가))

   T-B1 네 꼴 × 언어 · T-B2 오탐 꼴 표(구분선·괘선·범위·줄 끝 하이픈·대시·URL) · T-B3 언어별 낱말(Unit.lang ‖ 문서 언어) ·
   T-B4 화면 글자·src·번역 요청·캐시 키 불변 · T-B5 단일 언어(의학책 꼴) 큐 바이트 동일 · T-B6 조각·줄 모드 ·
   한 곳(grep) · 실측 기록(숫자만).
   문장은 모두 지어낸 것이다(원서 문장 아님).
   ============================================================ */

import './fixtures/sync-digest.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';

import { SPEECH_BLANK } from '../js/config.js';
import { buildUnits, sentencesOf, normalizeSpeech, speechBlanks, blankWordFor } from '../js/tts/text.js';
import { joinHyphen } from '../js/text/hyphen.js';
import { createReadalong } from '../js/ai/readalong.js';
import { STATES } from '../js/ai/pipeline.js';
import { keyFor } from '../js/ai/cache.js';
import { buildPageLayout } from '../js/text/layout.js';
import { toStored, fromStored } from '../js/text/store.js';
import { describePage, flowParasOf } from '../js/text/screen.js';

const ln = (id, text, hyphen) => ({ id: id, text: text, hyphen: hyphen || 'none' });
const para = (id, lines, kind) => ({ id: id, kind: kind || 'body', lines: lines });
const flush = async (n) => { for (let i = 0; i < (n || 30); i++) await new Promise((r) => setImmediate(r)); };
const texts = (units) => units.map((u) => u.text);

/* ══ T-B1 네 꼴 × 언어 ═════════════════════════════════ */

test('T-B1 ★ 네 꼴(-{4,} · _{3,} · –{3,} · —{2,}) × 언어 3(en·ko·fr) — 낭독 사본에서 그 언어의 낱말', () => {
  const FORMS = ['----', '-------', '___', '______', '–––', '——', '———'];
  const WANT = { en: 'blank', ko: '빈칸', fr: 'blanc' };
  for (const lang of ['en', 'ko', 'fr']) {
    for (const f of FORMS) {
      const src = 'Fill ' + f + ' here.';
      const u = buildUnits([para('p', [ln('1', src)])], 'sentence', { lang: lang });
      assert.equal(u.length, 1);
      assert.equal(u[0].text, 'Fill ' + WANT[lang] + ' here.', lang + ' ' + f);
      assert.equal(u[0].src, src, 'src 는 원문 그대로');
    }
  }
  // 한 문장에 둘 — 둘 다 바뀐다
  assert.equal(normalizeSpeech('A ------- and B ___ .', null, { blank: 'blank' }), 'A blank and B blank.');
  // 꼴이 낱말에 붙어 있어도(문제집 "<-------" "(------)") 띄어서 바꾼다
  assert.equal(normalizeSpeech('<------- SV>', null, { blank: 'blank' }), '< blank SV>');
  assert.equal(normalizeSpeech('the (______) one', null, { blank: 'blank' }), 'the ( blank) one');
});

test('T-B1 config 표 — en·ko·fr 는 spec 낱말 그대로, ar 하나 더(문안 검토 대상) · es 는 아직 없다(8n)', () => {
  assert.deepEqual(Object.keys(SPEECH_BLANK).sort(), ['ar', 'en', 'fr', 'ko']);
  assert.equal(SPEECH_BLANK.en, 'blank');
  assert.equal(SPEECH_BLANK.ko, '빈칸');
  assert.equal(SPEECH_BLANK.fr, 'blanc');
  assert.ok(/^\p{Script=Arabic}+$/u.test(SPEECH_BLANK.ar));
  assert.ok(Object.isFrozen(SPEECH_BLANK));
});

/* ══ T-B2 오탐 꼴 표 ═══════════════════════════════════ */

test('T-B2 ★★ 오탐 꼴 표 — 바꾸지 않는다: 3개 하이픈·대시 둘·대시 하나·범위·낱말 속 하이픈·밑줄 둘·en 대시 둘·점선·URL 안', () => {
  const KEEP = [
    'Grade --- was not reported.',          // 하이픈 3개
    'It rose -- slowly -- over weeks.',      // 대시 대용 하이픈 2개
    'It rose — slowly — over weeks.',        // em 대시 하나
    'Doses of 10-20 mg and 3–4 days.',       // 범위
    'A well-known anti-inflammatory drug.',  // 낱말 속 하이픈
    'Use file__name here.',                  // 밑줄 2개
    'Week 1 –– rest.',                       // en 대시 2개
    'Chapter 1 ........ 12',                  // 목차 점선(넣지 않는 꼴)
    'Mixed - - - - spaced.',                 // 띄어 쓴 하이픈
    'See http://example.org/a____b today.'   // URL 안(→ link)
  ];
  for (const s of KEEP) {
    const u = buildUnits([para('p', [ln('1', s)])], 'sentence', { lang: 'en' });
    for (const x of u) assert.ok(!/blank/.test(x.text), s + ' → ' + x.text);
    assert.equal(speechBlanks(s, 'blank'), s.indexOf('http') >= 0 ? s : s, 'speechBlanks 입력 그대로: ' + s);
  }
  assert.equal(normalizeSpeech('See http://example.org/a____b today.', null, { blank: 'blank' }), 'See link today.');
});

test('T-B2 ★★ 구분선 줄(줄 전체가 꼴뿐)·표 괘선 줄은 그대로 — 문장·줄 모드 · 같은 문단의 글자 있는 줄 빈칸은 바뀐다', () => {
  const P = [
    para('a', [ln('1', 'He ------- the box.'), ln('2', '--------------------'), ln('3', '|------|-------|'), ln('4', '+-----+-----+'), ln('5', '______  ______'), ln('6', 'She ___ it too.')]),
    para('b', [ln('7', '-----------------')]),
    para('c', [ln('8', '———————')])
  ];
  const s = texts(buildUnits(P, 'sentence', { lang: 'en' }));
  // 꼴 앞에서는 문장을 나누지 않는다(분할 규칙 그대로) — 한 단위 안에서 구분선 줄만 그대로 남는다
  assert.deepEqual(s, [
    'He blank the box. -------------------- |------|-------| +-----+-----+ ______ ______ She blank it too.',
    '-----------------',
    '———————'
  ]);
  const l = texts(buildUnits(P, 'line', { lang: 'en' }));
  assert.deepEqual(l, ['He blank the box.', '--------------------', '|------|-------|', '+-----+-----+', '______ ______', 'She blank it too.', '-----------------', '———————']);
});

test('T-B2 ★ 구분선 판정은 문단 좌표의 줄 **전체**로 — 문단 둘째 문장 안의 구분선 줄(문장 시작이 0 이 아닐 때)도 제자리에서 지킨다', () => {
  const P = [para('p', [ln('1', 'First one here.'), ln('2', 'Second ------- part'), ln('3', '------------'), ln('4', 'ends ___ here.')])];
  const u = buildUnits(P, 'sentence', { lang: 'en' });
  assert.deepEqual(texts(u), ['First one here.', 'Second blank part ------------ ends blank here.']);
  // 줄 모드도 같은 판정
  assert.deepEqual(texts(buildUnits(P, 'line', { lang: 'en' })), ['First one here.', 'Second blank part', '------------', 'ends blank here.']);
});

test('T-B2 줄 끝 빈칸은 하이픈 결합이 아니다(hyphen.js — "--" 로 끝나면 공백으로 잇는다) · 줄 끝 하이픈 결합 낱말은 그대로', () => {
  assert.deepEqual(joinHyphen('The manager -------', 'the report.'), { joined: 'The manager ------- the report.', hyphenJoin: false, keptHyphen: false });
  const u = buildUnits([para('p', [ln('1', 'The manager -------'), ln('2', 'the cardio-', 'hidden'), ln('3', 'vascular report.')])], 'sentence', { lang: 'en' });
  assert.deepEqual(texts(u), ['The manager blank the cardiovascular report.']);
});

/* ══ T-B3 언어별 낱말 ══════════════════════════════════ */

const MIX = [
  para('m', [ln('1', 'She ------- the report yesterday.'), ln('2', '그는 어제 보고서를 ------- 했다.'), ln('3', '(------)')]),
  para('r', [ln('4', 'املأ ------- في الجملة.')])
];

test('T-B3 ★★ 말할 언어 = Unit.lang(8m) ‖ 문서 언어 — ko 문서 안 영어 예문 빈칸은 en 낱말, 물려받은 짧은 단위도 그 언어', () => {
  const on = buildUnits(MIX, 'sentence', { lang: 'ko', scriptSwitch: true });
  assert.deepEqual(on.map((u) => [u.lang || null, u.text]), [
    ['en', 'She blank the report yesterday.'],
    [null, '그는 어제 보고서를 빈칸 했다.'],
    [null, '( 빈칸)'],                                   // 짧음 → 앞 단위(문서 언어) 물려받음
    ['ar', 'املأ فراغ في الجملة.']
  ]);
  // 끄면(문서 언어만) 모두 ko 낱말
  const off = buildUnits(MIX, 'sentence', { lang: 'ko' });
  assert.deepEqual(texts(off), ['She 빈칸 the report yesterday.', '그는 어제 보고서를 빈칸 했다.', '( 빈칸)', 'املأ 빈칸 في الجملة.']);
  // en 문서 · 켬 — 한국어 문장이 따로 서면 ko 낱말
  const en = buildUnits([para('k', [ln('1', '그는 어제 보고서를 ------- 했다.')]), MIX[1]], 'sentence', { lang: 'en', scriptSwitch: true });
  assert.deepEqual(en.map((u) => [u.lang || null, u.text]), [['ko', '그는 어제 보고서를 빈칸 했다.'], ['ar', 'املأ فراغ في الجملة.']]);
  // 8m 의 알려진 한계 그대로: en 분할은 한글 앞에서 끊지 않아 "영어. 한국어." 가 한 단위(섞임 → 문서 목소리 → 문서 낱말)
  const enMix = buildUnits(MIX, 'sentence', { lang: 'en', scriptSwitch: true });
  assert.deepEqual(enMix.map((u) => [u.lang || null, u.text]), [[null, 'She blank the report yesterday. 그는 어제 보고서를 blank 했다.'], [null, '( blank)'], ['ar', 'املأ فراغ في الجملة.']]);
});

test('T-B3 ★ 표에 없는 언어는 쉼표 하나(짧은 쉼) · 언어 없음은 en · fr 문서는 blanc', () => {
  assert.equal(blankWordFor(undefined), 'blank');
  assert.equal(blankWordFor(''), 'blank');
  assert.equal(blankWordFor('und'), ',');
  assert.equal(blankWordFor('es'), ',');
  assert.equal(blankWordFor('fr'), 'blanc');
  const und = buildUnits([para('p', [ln('1', 'Él ------- la casa.')])], 'sentence', { lang: 'und' });
  assert.equal(und[0].text, 'Él, la casa.');
  const fr = buildUnits([para('p', [ln('1', 'Il ------- la maison.')])], 'sentence', { lang: 'fr' });
  assert.equal(fr[0].text, 'Il blanc la maison.');
  const none = buildUnits([para('p', [ln('1', 'It ------- the house.')])], 'sentence');
  assert.equal(none[0].text, 'It blank the house.');
});

test('T-B3 줄 모드 · 표 안내 문단도 같은 규칙(문서 언어) · 인용 단위도 낱말', () => {
  const l = buildUnits(MIX, 'line', { lang: 'ko', scriptSwitch: true });
  assert.deepEqual(texts(l), ['She blank the report yesterday.', '그는 어제 보고서를 빈칸 했다.', '( 빈칸)', 'املأ فراغ في الجملة.']);
});

/* ══ T-B4 불변 — 화면 글자·src·번역 요청·캐시 키 ═════════ */

test('T-B4 ★★ 화면 글자 불변 — 입력 줄(화면이 그리는 글자)은 한 글자도 안 바뀐다 · ranges 는 원래 줄 좌표', () => {
  const P = [para('p', [ln('1', 'Choose one. He -------'), ln('2', 'the box ___ today.')])];
  const before = JSON.stringify(P);
  const u = buildUnits(P, 'sentence', { lang: 'en' });
  assert.equal(JSON.stringify(P), before);
  assert.equal(u[1].text, 'He blank the box blank today.');
  // ranges 가 가리키는 화면 글자는 원문(빈칸 꼴 그대로)
  const lines = { 1: P[0].lines[0].text, 2: P[0].lines[1].text };
  assert.equal(u[1].ranges.map((r) => lines[r.id].slice(r.start, r.end)).join(' '), 'He ------- the box ___ today.');
});

test('T-B4 ★ 빈칸 말고는 모두 같다 — 같은 길이 낱말로 바꾼 문단과 seg·lineIds·ranges·part·kind 가 같다', () => {
  const A = [para('p', [ln('1', 'Choose one. He ------- the'), ln('2', 'box ___ today. Done.')])];
  const B = [para('p', [ln('1', 'Choose one. He zzzzzzz the'), ln('2', 'box zzz today. Done.')])];
  const a = buildUnits(A, 'sentence', { lang: 'en' });
  const b = buildUnits(B, 'sentence', { lang: 'en' });
  const strip = (x) => x.map((u) => { const o = Object.assign({}, u); delete o.text; delete o.src; return o; });
  assert.deepEqual(strip(a), strip(b));
  assert.deepEqual(a.map((u) => u.src), ['Choose one.', 'He ------- the box ___ today.', 'Done.']);
});

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

test('T-B4 ★★ 번역 요청·캐시 키 불변 — 요청 글자는 빈칸 꼴 그대로(src) · 키는 원문으로', async () => {
  const S1 = 'The manager ------- the report on time.';
  const S2 = 'Please fill ___ before noon.';
  const pipeline = recPipeline();
  const ra = createReadalong({
    pipeline: pipeline,
    cache: { getMany: async () => new Map() },
    getSetting: (k) => (k === 'tts.scriptSwitch' ? true : k === 'ai.maxReqChars' ? 6000 : undefined),
    saveReadStats: async () => {},
    loadParas: async () => null
  });
  ra.setDoc({ docId: 'd1', lang: 'en', target: 'ko', pageCount: 1 });
  ra.setContext({ mode: 'show', consented: true, srcLang: 'en', supportedSrc: ['en', 'fr', 'ko'], targetLang: 'ko', unit: 'sentence', hasKey: true });
  ra.setActive(true);
  const units = buildUnits([para('a', [ln('1:0', S1)]), para('b', [ln('1:1', S2)])], 'sentence', { lang: 'en', scriptSwitch: true });
  assert.deepEqual(texts(units), ['The manager blank the report on time.', 'Please fill blank before noon.']);
  ra.onQueue(1, units, units[0].seg);
  await flush();
  const sent = pipeline.calls.flatMap((c) => c.segs);
  assert.deepEqual(sent.map((s) => s.text), [S1, S2]);
  assert.deepEqual(sentencesOf(units).map((s) => s.src), [S1, S2]);
  assert.equal(await keyFor('d1', units[0].src, 'ko', 'readalong'), await keyFor('d1', S1, 'ko', 'readalong'));
});

/* ══ T-B5 단일 언어(의학책 꼴) 큐 바이트 동일 ═════════════ */

// 의학책에 실제로 나오는 하이픈·대시 꼴(범위·줄 끝 결합·대시·구분선·괘선·URL 속 밑줄) — 빈칸 꼴 없음.
const MED = [
  para('m1', [ln('1:1', 'Doses of 10-20 mg/kg were used -- in some cases — up to 40 mg.'), ln('1:2', 'A cardio-', 'hidden'), ln('1:3', 'vascular event (see Fig. 3–4) was rare; anti-', 'kept'), ln('1:4', 'inflammatory agents were graded --- or ––, not __ scored.')]),
  para('m2', [ln('2:1', '------------')]),
  para('m3', [ln('3:1', 'Results by group are shown below.'), ln('3:2', '--------------------'), ln('3:3', '|------|-------|'), ln('3:4', 'See http://example.org/a____b for ≥ 5% of cases.')]),
  para('m4', [ln('4:1', 'Week 1 — rest. Week 2 – walk.')], 'heading'),
  para('tablenotice:5:r0', [ln('n1', 'Table skipped.')], 'table-notice')
];

test('T-B5 ★★ 의학책 꼴·합성 2단 쪽 — 8o 이전(HEAD 48bf203 의 tts/text.js)과 큐 JSON 지문이 같다(문장·줄 · 언어 3 · 전환 켬/끔)', () => {
  // 지문은 8o 이전 `js/tts/text.js`(커밋 48bf203)로 같은 픽스처를 돌려 얻은 sha256(JSON.stringify(buildUnits(…))).
  const WANT = {
    'med en sentence': '37bbbf8245a33bbad82c359909fd1948bc276fb76dd9c00d9d955f87a906a690',
    'med en sentence sw': '37bbbf8245a33bbad82c359909fd1948bc276fb76dd9c00d9d955f87a906a690',
    'med en line': '9d16ac8681e2fc31d3bd50a74c2140900206b1d6053fca913fc8262688f474c7',
    'med en line sw': '9d16ac8681e2fc31d3bd50a74c2140900206b1d6053fca913fc8262688f474c7',
    'med fr sentence': '854c0a5b0d50520ad6bd288e0c745920f64930fd9babc57f414a47a307ca8c3a',
    'med fr sentence sw': '854c0a5b0d50520ad6bd288e0c745920f64930fd9babc57f414a47a307ca8c3a',
    'med fr line': '18f5cb9d0a317fcc05fc8ddc2f483b5156cece8cba3481c6c970bf73c19b1f07',
    'med fr line sw': '18f5cb9d0a317fcc05fc8ddc2f483b5156cece8cba3481c6c970bf73c19b1f07',
    'med ko sentence': '854c0a5b0d50520ad6bd288e0c745920f64930fd9babc57f414a47a307ca8c3a',
    'med ko sentence sw': 'c9342c5f1c9aa54225cb26daf5bb6c6f42380a30a46e101ef78c8d4cabae6341',
    'med ko line': '18f5cb9d0a317fcc05fc8ddc2f483b5156cece8cba3481c6c970bf73c19b1f07',
    'med ko line sw': 'cc4d0466c560227017a8db4eb6652ed9ee389f1ca559a7a039f0d07c4c55b56c',
    '2col en sentence': 'c318e2c1dd9094edfae8038025e4f80b3b85cf128c7fcaa09617fe1fa41698a9',
    '2col en sentence sw': 'c318e2c1dd9094edfae8038025e4f80b3b85cf128c7fcaa09617fe1fa41698a9',
    '2col en line': '262cb17fbf912c5360bb6cda7a1ed04fcd4eb32b89acd926c29bc35d275a66c7',
    '2col en line sw': '262cb17fbf912c5360bb6cda7a1ed04fcd4eb32b89acd926c29bc35d275a66c7',
    '2col fr sentence': 'c318e2c1dd9094edfae8038025e4f80b3b85cf128c7fcaa09617fe1fa41698a9',
    '2col fr sentence sw': 'c318e2c1dd9094edfae8038025e4f80b3b85cf128c7fcaa09617fe1fa41698a9',
    '2col fr line': '262cb17fbf912c5360bb6cda7a1ed04fcd4eb32b89acd926c29bc35d275a66c7',
    '2col fr line sw': '262cb17fbf912c5360bb6cda7a1ed04fcd4eb32b89acd926c29bc35d275a66c7',
    '2col ko sentence': 'c318e2c1dd9094edfae8038025e4f80b3b85cf128c7fcaa09617fe1fa41698a9',
    '2col ko sentence sw': '357a47ad5baa6856251686bc88bb8cb6a4171a479850612c74ad38d7ca444685',
    '2col ko line': '262cb17fbf912c5360bb6cda7a1ed04fcd4eb32b89acd926c29bc35d275a66c7',
    '2col ko line sw': '5d46521f76eeda5c02daf36b4c1079668d71531314d317bf4cfb5a6fab23e4a2'
  };
  const FX = JSON.parse(readFileSync(new URL('./fixtures/synth-2col.json', import.meta.url), 'utf8'));
  const L = buildPageLayout(FX.items, { pageNo: FX.pageNo, width: FX.width, height: FX.height, styles: FX.styles });
  const SYN = flowParasOf(describePage(fromStored(toStored(L))));
  for (const [name, paras] of [['med', MED], ['2col', SYN]]) {
    for (const lang of ['en', 'fr', 'ko']) {
      for (const unit of ['sentence', 'line']) {
        for (const sw of [false, true]) {
          const k = [name, lang, unit, sw ? 'sw' : ''].join(' ').trim();
          const j = JSON.stringify(buildUnits(paras, unit, sw ? { lang: lang, scriptSwitch: true } : { lang: lang }));
          assert.equal(createHash('sha256').update(j).digest('hex'), WANT[k], k);
        }
      }
    }
  }
});

/* ══ T-B6 300자 조각 ═══════════════════════════════════ */

test('T-B6 300자를 넘어 쪼개진 문장 — 조각마다 낱말 · 같은 src · ranges 없음(6-5 그대로)', () => {
  const LONG = 'The committee compared ------- regimens across many centers, including older agents, newer biologic agents, and combined approaches, while tracking laboratory markers, imaging findings, functional scores, and the frequency of adverse events over a follow-up period that, in some cohorts, extended ___ beyond the original window.';
  const u = buildUnits([para('p', [ln('1', LONG)])], 'sentence', { lang: 'en' });
  assert.ok(u.length >= 2);
  assert.ok(u.every((x) => x.src === LONG && !('ranges' in x)));
  assert.equal(u.map((x) => x.text).join(' ').match(/blank/g).length, 2);
  assert.ok(u.every((x) => !/-{4,}|_{3,}/.test(x.text)));
});

/* ══ 한 곳 ═════════════════════════════════════════════ */

test('★ 빈칸 낱말은 낭독 사본 한 곳 — speechBlanks·SPEECH_BLANK 를 쓰는 곳은 js/tts/text.js(와 표의 config.js)뿐', () => {
  const root = new URL('../js/', import.meta.url);
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const u = new URL(name, dir);
      if (statSync(u).isDirectory()) { walk(new URL(name + '/', dir)); continue; }
      if (!name.endsWith('.js')) continue;
      const t = readFileSync(u, 'utf8');
      if (/speechBlanks|SPEECH_BLANK|blankWordFor/.test(t)) hits.push(u.href.slice(root.href.length));
    }
  };
  walk(root);
  assert.deepEqual(hits.sort(), ['config.js', 'tts/text.js']);
});

/* ══ 실측 기록 ═════════════════════════════════════════ */

test('기록 [실측 2026-10-21 — 8o Build] 숫자만 — 해커스 87개·의학책 3권', () => {
  // 앱 추출 경로(레이아웃 → 저장본 → 화면 문단) 그대로, 낭독 문단의 줄마다 센 꼴과 HEAD(48bf203) 큐와의 차이(문장 모드 · 전환 켬).
  const R = {
    hackers: { files: 87, pages: 397, units: 14909, hyphen4: 289, under3: 23, enDash3: 0, emDash2: 0, ruleLinesKept: 4, unitsChanged: 295, wordKo: 276, wordEn: 19, splitPartsChanged: 2, srcChanged: 0, suspectOf308: 1 },
    cmdt2026: { pages: 1967, under3: 3, unitsChanged: 2, pagesChanged: 1, srcChanged: 0 },   // 한 쪽 — 점수 계산 서식의 "= ______" 칸(진짜 빈칸)
    cmdt2021: { pages: 5051, blanks: 0, unitsChanged: 0 },
    harrison: { pages: 729, blanks: 0, unitsChanged: 0 }
  };
  const h = R.hackers;
  assert.equal(h.hyphen4 + h.under3, 312);                      // 8m M6 의 87개 289 · 23 과 같다
  assert.equal(h.wordKo + h.wordEn, h.unitsChanged);
  assert.equal(R.cmdt2021.unitsChanged + R.harrison.unitsChanged, 0);
  assert.ok(h.suspectOf308 / (h.hyphen4 - h.ruleLinesKept + h.under3) < 0.01);
});
