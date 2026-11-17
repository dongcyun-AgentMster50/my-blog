/* ============================================================
   tests/taptr-8c.test.mjs — 8c-1 탭 번역 · 선택 동작 줄 (spec 17-7-6 4-1 · 4-2 · 3절 · 수용 기준 "8c-1" `[N]`)

   ★ 이 파일이 고정하는 것
     1. `isTap` 표 — 누름 449ms·이동 9px·누를 때 선택 없음 → 탭 / 450ms·10px 초과·누를 때 선택·지금 선택 → 탭 아님
        `[8c-1b]` 다중 터치·짝 없는 up → 탭 아님 · `createTapTracker`(포인터별 기록) · `tapPlan`(문단 단위 요청) · 탭 요청 동시 1 ·
        `selBarStep`(접히면 거둠) · Esc·포커스·연결 회복 다시 보내기 — 8c-1 Review 8c1R-9 #1–#6
        `[8c-1c]` 본문 밖 뗌의 남은 기록(`release`) · 숨은 띠·편집 칸 Esc · 떠 있는 문단 마지막 탭의 대기 칸 · `liftEdge`·`outOfView`
        — 8c-1b 재검증 8c1bR-8 #1–#5·#7
     2. `segsOnLine`·`unitAt`·`paraUnitsOf` — 한 줄에서 두 문장이 갈리는 픽스처 · 300자 분할(ranges 없음) · 표 안내·인용만 있는 줄
     3. `tapGate` — consent → unsupported-lang → same-lang → no-key, mode off·unit line·trVoice false 여도 ok(유효 모드와 다른 점)
     4. `requestTap`(가짜 pipeline) — 문단 4문장 1회·4항목·메모리 ready · ready 2개면 2개만 · 두 번째 0회 · 8m 같은 언어 빠짐 · retry 전달
     5. `requestTap`(실제 pipeline) — 요청 본문 바이트가 낭독 동반 번역과 같다 · 같은 캐시 키(뒤 낭독 refill 0건) · 사용량 `translate`
     6. `speaker.sentenceUnits()` — 문장 모드면 큐와 같다 · 줄 모드면 `buildUnits(…,'sentence', 같은 opts)` · 큐·이벤트 불변 · R6
     7. 띠 탭 모드 `tapView` · 선택 줄 `selBarModel`·`clampSelection`·`lineOffsetOf`·`liftDelta`·`expandWord`
     8. 배선(소스) — 줄 탭 분기 순서 · [▶]·쪽 넘김 닫기 · inline 멈춤 · `isTap` 두 뷰 · 순수·import 방향 · i18n 4언어
   브라우저 실측(`[D]`)은 보고서 `.claude/tasks/medreader-build-8c1-taptr-report.md`.
   픽스처 문장은 전부 지어낸 것이다(16-I).
   ============================================================ */

import './fixtures/sync-digest.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isTap, TAP, segsOnLine, unitAt, paraUnitsOf, firstUnitsOf, lineOffsetOf, expandWord, clampSelection, liftDelta, SEL_LIMIT,
  createTapTracker, tapPlan, liftEdge, outOfView
} from '../js/text/select.js';
import { createReadalong, tapGate, effectiveMode, REASON, srcKey } from '../js/ai/readalong.js';
import { createPipeline, STATES } from '../js/ai/pipeline.js';
import { createCache } from '../js/ai/cache.js';
import { buildUnits } from '../js/tts/text.js';
import { createSpeaker } from '../js/tts/speaker.js';
import { tapView, GATE_KEYS, TAP_BANNER_NOW, escClosesTap, tapResendOnline } from '../js/ui/trband.js';
import { selBarModel, SEL_ACTIONS, HIDE_DELAY_MS, selBarStep } from '../js/ui/selbar.js';
import { BUNDLES, LANGS } from '../js/i18n/index.js';
import { memDb, stubFetch, echoTranslate, settingsOf, manualTimers, FAKE_KEY } from './fixtures/ai-stubs-8a.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const JS = fileURLToPath(new URL('../js', import.meta.url));
const flush = async (n) => { for (let i = 0; i < (n || 30); i++) await new Promise((r) => setImmediate(r)); };

/* ── 지어낸 쪽 ─────────────────────────────────────────── */

const ln = (id, text) => ({ id: id, text: text, hyphen: 'none' });
const para = (id, lines, kind) => ({ id: id, kind: kind || 'body', lines: lines });

/** p1: L1 에서 문장 0 이 끝나고 문장 1 이 시작(L2 로 이어짐), L2 에서 문장 2. p2: 문장 3·4. */
const PAGE = () => [
  para('p1', [ln('L1', 'Alpha beta gamma. Delta'), ln('L2', 'epsilon zeta. Eta theta.')]),
  para('p2', [ln('L3', 'Iota kappa lambda. Mu nu.')])
];
const UNITS = () => buildUnits(PAGE(), 'sentence', { lang: 'en' });

/* ══ 1. isTap ══════════════════════════════════════════ */

test('I1 ★ isTap 표 10줄 — 449ms·9px·누를 때 선택 없음 → 탭 / 450ms·10px 초과·누를 때 선택·지금 선택·[8c-1b] 다중 터치·짝 없는 up → 탭 아님', () => {
  const d = { t: 1000, x: 100, y: 200 };
  const rows = [
    [d, { t: 1449, x: 100, y: 200 }, false, true, '449ms'],
    [d, { t: 1450, x: 100, y: 200 }, false, false, '450ms'],
    [d, { t: 1100, x: 109, y: 200 }, false, true, '9px'],
    [d, { t: 1100, x: 106, y: 208 }, false, true, '10px 정확히(대각) — 초과 아님'],
    [d, { t: 1100, x: 111, y: 200 }, false, false, '11px'],
    [d, { t: 1100, x: 100, y: 200 }, true, false, '누를 때 선택(선택 풀기 탭)'],
    [d, { t: 1100, x: 100, y: 200, sel: true }, false, false, '지금 선택'],
    [null, { t: 1100, x: 100, y: 200 }, false, false, '[8c-1b] 짝 없는 pointerup(누름 기록 없음) — 탭 아님'],
    [d, { t: 1060, x: 100, y: 200 }, false, false, '[8c-1b] 다중 터치였음(60ms·0px 이어도)', true],
    [d, { t: 1060, x: 100, y: 200 }, false, true, '다중 터치 아님(같은 누름)', false]
  ];
  for (const [down, up, had, want, why, multi] of rows) assert.equal(isTap(down, up, had, multi), want, why);
  assert.equal(TAP.MAX_MS, 450);
  assert.equal(TAP.MAX_MOVE, 10);
  assert.equal(isTap(null, { t: 0, x: 0, y: 0, sel: true }, false), false);
});

test('I1b ★ [8c-1b] createTapTracker — 포인터별 기록: 두 손가락 동시·엄지 대고 다른 손가락 탭 → 어느 손가락도 탭 아님 · 한 손가락 → 탭', () => {
  const T = createTapTracker();
  const tapOf = (id, t, x, y) => { const d = T.up(id); return isTap(d, { t: t, x: x, y: y }, !!(d && d.sel), !!(d && d.multi)); };
  const touch = (id, t, x, y, primary) => T.down({ id: id, t: t, x: x, y: y, sel: false, primary: primary, type: 'touch' });
  // 한 손가락 보통 탭 → 1
  touch(1, 0, 10, 10, true);
  assert.equal(tapOf(1, 60, 10, 10), true, '한 손가락 60ms');
  assert.equal(T.size(), 0);
  // 두 손가락 정지 탭(down#21 → down#22 → up#22 → up#21) → 0
  touch(21, 1000, 10, 10, true);
  touch(22, 1020, 70, 14, false);
  assert.equal(tapOf(22, 1100, 70, 14), false, '둘째 손가락 — 다중 터치');
  assert.equal(tapOf(21, 1130, 10, 10), false, '★ 첫째 손가락 — 둘째 기록이 덮지 않았고, 이 제스처도 다중 터치');
  // 엄지 1.5s 대고 다른 손가락 탭 → 엄지 뗌 → 0
  touch(31, 2000, 10, 10, true);
  touch(32, 3500, 70, 14, false);
  assert.equal(tapOf(32, 3560, 70, 14), false, '다른 손가락');
  assert.equal(tapOf(31, 4000, 10, 10), false, '★ 엄지(누름 2s) — 다중 터치 + 450ms');
  // 다음 한 손가락 탭은 다시 탭(다중 표시가 남지 않는다)
  touch(41, 5000, 10, 10, true);
  assert.equal(tapOf(41, 5050, 10, 10), true);
  // 짝 없는 up(기록 없음) → 탭 아님
  assert.equal(tapOf(99, 6000, 10, 10), false, '짝 없는 up');
  // pointercancel·lostpointercapture → drop → 그 뒤 up 은 짝 없음
  touch(51, 7000, 10, 10, true);
  T.drop(51);
  assert.equal(tapOf(51, 7050, 10, 10), false, 'cancel 뒤 up');
  // 남은 찌꺼기(뗌을 못 받은 기록) — 같은 종류의 primary 누름이 오면 지운다(다음 탭이 다중으로 잘못 셈하지 않게)
  touch(61, 8000, 10, 10, true);
  touch(62, 9000, 10, 10, true);
  assert.equal(T.size(), 1, 'primary 누름이 같은 종류의 옛 기록을 지움');
  assert.equal(tapOf(62, 9050, 10, 10), true);
  // 마우스 — 같은 id 재사용은 덮어쓴다(한 칸)
  T.down({ id: 1, t: 10000, x: 5, y: 5, sel: false, primary: true, type: 'mouse' });
  T.down({ id: 1, t: 10100, x: 5, y: 5, sel: false, primary: true, type: 'mouse' });
  assert.equal(T.size(), 1);
  assert.equal(tapOf(1, 10150, 5, 5), true, '마우스 클릭');
  // 누를 때 선택 기록
  T.down({ id: 7, t: 0, x: 0, y: 0, sel: true, primary: true, type: 'touch' });
  assert.equal(T.up(7).sel, true);
});

test('I1c ★ [8c-1c] 본문 밖 뗌의 남은 기록 — 문서 붙잡기 단계 release 가 표시 · 다음 누름이 종류와 무관하게 지움 · 진짜 동시 누름은 그대로 다중', () => {
  const T = createTapTracker();
  const tapOf = (id, t, x, y) => { const d = T.up(id); return isTap(d, { t: t, x: x, y: y }, !!(d && d.sel), !!(d && d.multi)); };
  const dn = (id, t, primary, type) => T.down({ id: id, t: t, x: 10, y: 10, sel: false, primary: primary, type: type });
  // ★ 8c1bR-8 #1: 마우스를 본문에서 누르고 본문 밖에서 뗌(본문 up 없음 — 문서 붙잡기 단계 release 만) → 손가락 탭 2번 모두 탭
  dn(1, 0, true, 'mouse');
  T.release(1);
  assert.equal(T.size(), 1, 'release 는 지우지 않는다(같은 이벤트가 곧 본문에 닿을 수 있다)');
  dn(11, 1000, true, 'touch');
  assert.equal(T.size(), 1, '★ 떼어진 마우스 기록은 다음 누름이 지운다(종류 무관)');
  assert.equal(tapOf(11, 1060, 10, 10), true, '★ 손가락 탭 1');
  dn(12, 2000, true, 'touch');
  assert.equal(tapOf(12, 2060, 10, 10), true, '★ 손가락 탭 2');
  // 펜도 같다
  dn(2, 3000, true, 'pen');
  T.release(2);
  dn(13, 3500, true, 'touch');
  assert.equal(tapOf(13, 3560, 10, 10), true, '펜 본문 밖 뗌 뒤 손가락 탭');
  // 본문에 닿은 보통 뗌: release(붙잡기) → up(본문) 순서여도 그 기록으로 판정한다
  dn(3, 4000, true, 'mouse');
  T.release(3);
  assert.equal(tapOf(3, 4060, 10, 10), true, '★ 붙잡기 단계 표시가 본문 판정을 막지 않는다');
  // 진짜 동시 누름(아직 안 뗀 마우스 + 손가락)은 다중 그대로 — 표시 없는 기록은 다른 종류 primary 가 지우지 않는다
  dn(4, 5000, true, 'mouse');
  dn(14, 5100, true, 'touch');
  assert.equal(tapOf(14, 5160, 10, 10), false, '아직 누르고 있는 마우스 + 손가락 → 다중');
  assert.equal(tapOf(4, 5200, 10, 10), false);
  // 두 손가락 정지(먼저 뗀 손가락의 release·up 뒤 남은 손가락) — 다중 그대로
  dn(21, 6000, true, 'touch');
  dn(22, 6020, false, 'touch');
  T.release(22);
  assert.equal(tapOf(22, 6100, 10, 10), false, '둘째 손가락');
  T.release(21);
  assert.equal(tapOf(21, 6130, 10, 10), false, '★ 첫째 손가락 — 여전히 다중');
  // 엄지 대고(아직 안 뗌) 다른 손가락: 다른 손가락이 primary 가 아니면 엄지 기록은 남는다
  dn(31, 7000, true, 'touch');
  dn(32, 8500, false, 'touch');
  T.release(32);
  assert.equal(tapOf(32, 8560, 10, 10), false);
  T.release(31);
  assert.equal(tapOf(31, 9000, 10, 10), false);
  assert.equal(T.size(), 0);
});

/* ══ 2. 줄 → 문장 ══════════════════════════════════════ */

test('I2 ★ segsOnLine·unitAt — 한 줄에서 두 문장이 갈린다(앞 오프셋 → 앞 seg, 뒤 → 뒤 seg, 줄 탭 → 두 seg 순서대로)', () => {
  const u = UNITS();
  assert.deepEqual(segsOnLine(u, 'L1'), [0, 1]);
  assert.deepEqual(segsOnLine(u, 'L2'), [1, 2]);
  assert.deepEqual(segsOnLine(u, 'L3'), [3, 4]);
  assert.equal(unitAt(u, 'L1', 3).seg, 0, '앞 문장 글자');
  assert.equal(unitAt(u, 'L1', 19).seg, 1, '뒤 문장 글자');
  assert.equal(unitAt(u, 'L1', 17).seg, 1, '문장 사이 공백 → 뒤에 시작하는 문장');
  assert.equal(unitAt(u, 'L2', 2).seg, 1);
  assert.equal(unitAt(u, 'L2', 20).seg, 2);
  assert.equal(unitAt(u, 'L2', 999).seg, 2, '줄 끝 너머 → 그 줄 마지막 구간');
  assert.equal(unitAt(u, 'nope', 0), null);
  // 문단 전체 — L1 탭이면 p1 의 문장 셋(0·1·2), p2 는 아니다
  assert.deepEqual(paraUnitsOf(u, segsOnLine(u, 'L1')).map((x) => x.seg), [0, 1, 2]);
  assert.deepEqual(paraUnitsOf(u, [3]).map((x) => x.seg), [3, 4]);
  assert.deepEqual(firstUnitsOf(u, [2, 0]).map((x) => x.seg), [2, 0], 'segs 순서를 지킨다');
});

test('I2b 300자 분할(ranges 없음) → lineIds 로 · 표 안내·인용만 있는 줄 → 빈 목록', () => {
  const long = ('Word '.repeat(90)).trim() + '.';
  const u = buildUnits([para('p3', [ln('M1', long.slice(0, 200)), ln('M2', long.slice(200))])], 'sentence', { lang: 'en' });
  assert.ok(u.length >= 2 && u.every((x) => !x.ranges), '픽스처: 300자 분할 조각에는 ranges 가 없다');
  assert.deepEqual(segsOnLine(u, 'M2'), [0]);
  assert.equal(unitAt(u, 'M2', 5).seg, 0);
  assert.equal(firstUnitsOf(u, [0])[0], u[0], '조각이면 첫 조각이 대표');
  const notice = buildUnits([para('tablenotice:r1', [ln('tablenotice:r1', 'Table skipped.')], 'table-notice')], 'sentence', { lang: 'en' });
  assert.deepEqual(segsOnLine(notice, 'tablenotice:r1'), []);
  const cite = [{ text: '[PMID: 1]', lineIds: ['C1'], ranges: [{ id: 'C1', start: 0, end: 9 }], paraId: 'p9', cite: true, src: '[PMID: 1]' }];
  assert.deepEqual(segsOnLine(cite, 'C1'), [], '인용(seg 없음)');
  assert.equal(unitAt(cite, 'C1', 2), null);
});

test('I2c ★ [8c-1b] tapPlan — 띠 = 탭한 줄의 문장, 요청 = 그 문단 전체(문단 단위 1회) · 고른 문장 · 번역 대상 거름', () => {
  const u = UNITS();
  const p = tapPlan(u, 'L2', null, null);
  assert.deepEqual(p.hit.map((s) => s.seg), [1, 2], '그 줄과 겹치는 문장');
  assert.deepEqual(p.paraUnits.map((x) => x.seg), [0, 1, 2], '★ 요청은 문단 p1 전체 — 탭한 문장만이 아니다');
  assert.deepEqual(p.para.map((s) => s.seg), [0, 1, 2]);
  assert.deepEqual(p.hit[0], { seg: 1, src: u.find((x) => x.seg === 1).src });
  // 선택 줄 [문장 번역] — 고른 문장만 띠에, 요청은 여전히 문단
  const q = tapPlan(u, 'L3', [4], null);
  assert.deepEqual(q.hit.map((s) => s.seg), [4]);
  assert.deepEqual(q.paraUnits.map((x) => x.seg), [3, 4]);
  // 번역 대상이 아닌 문장(8m 등)은 띠·[문단 전체] 목록에서 빠진다(요청 거름은 requestTap 몫)
  const r = tapPlan(u, 'L1', null, (x) => x.seg !== 0);
  assert.deepEqual(r.hit.map((s) => s.seg), [1]);
  assert.deepEqual(r.para.map((s) => s.seg), [1, 2]);
  // 표 안내·인용만 있는 줄 → 빈 계획
  const cite = [{ text: '[PMID: 1]', lineIds: ['C1'], ranges: [{ id: 'C1', start: 0, end: 9 }], paraId: 'p9', cite: true, src: '[PMID: 1]' }];
  assert.deepEqual(tapPlan(cite, 'C1', null, null), { hit: [], paraUnits: [], para: [] });
});

/* ══ 3. tapGate ════════════════════════════════════════ */

test('I3 ★ tapGate — consent → unsupported-lang → same-lang → no-key 순서 · mode off·unit line·trVoice false 여도 ok', () => {
  const ok = { mode: 'speak', consented: true, srcLang: 'en', supportedSrc: ['en', 'fr'], targetLang: 'ar', unit: 'sentence', hasKey: true };
  const rows = [
    [{}, REASON.CONSENT],
    [Object.assign({}, ok, { consented: false, srcLang: 'xx', targetLang: 'xx', hasKey: false }), REASON.CONSENT],
    [Object.assign({}, ok, { srcLang: 'xx', targetLang: 'xx', hasKey: false }), REASON.UNSUPPORTED_LANG],
    [Object.assign({}, ok, { targetLang: 'en', hasKey: false }), REASON.SAME_LANG],
    [Object.assign({}, ok, { hasKey: false }), REASON.NO_KEY],
    [ok, null]
  ];
  for (const [ctx, want] of rows) {
    const g = tapGate(ctx);
    assert.equal(g.reason, want, JSON.stringify(ctx));
    assert.equal(g.ok, want === null);
  }
  // 유효 모드와 다른 점 — 탭은 낭독 동반 번역의 모드·단위·번역문 음성을 보지 않는다
  const diff = [
    [{ mode: 'off' }, REASON.OFF],
    [{ unit: 'line' }, REASON.LINE_MODE],
    [{ trVoice: false, mode: 'speak' }, REASON.NO_VOICE]
  ];
  for (const [over, emReason] of diff) {
    const ctx = Object.assign({}, ok, over);
    assert.equal(effectiveMode(ctx).reason, emReason);
    assert.deepEqual(tapGate(ctx), { ok: true, reason: null });
  }
});

/* ══ 4. requestTap — 가짜 pipeline ══════════════════════ */

function fakePipeline(answer) {
  const calls = [];
  let st = STATES.READY;
  return {
    calls: calls,
    retries: 0,
    state: () => st,
    set: (s) => { st = s; },
    onState: () => () => { },
    retry: async function () { this.retries++; st = STATES.READY; return st; },
    translate: async (segs, ctx) => {
      calls.push({ segs: segs.map((s) => Object.assign({}, s)), ctx: Object.assign({}, ctx) });
      return { status: st, calls: 1, results: segs.map((s) => (answer ? answer(s) : { state: 'ready', text: 'TR(' + s.text + ')' })) };
    }
  };
}

function rigTap(o) {
  const opts = o || {};
  const pipe = opts.pipeline || fakePipeline(opts.answer);
  const ra = createReadalong({
    pipeline: pipe,
    cache: { getMany: async () => new Map() },
    getSetting: (k) => (k === 'tts.scriptSwitch' ? true : k === 'ai.maxReqChars' ? 6000 : undefined),
    saveReadStats: async () => { },
    loadParas: async () => null
  });
  ra.setDoc({ docId: 'doc1', lang: 'en', target: opts.target || 'ar', pageCount: 3, domain: 'medical' });
  // 낭독 동반 번역은 꺼 둔다(mode off) — 탭은 유효 모드와 무관해야 한다
  ra.setContext({ mode: 'off', consented: true, srcLang: 'en', supportedSrc: ['en'], targetLang: opts.target || 'ar', unit: 'line', hasKey: true });
  return { ra, pipe };
}

const FOUR = () => buildUnits([para('q1', [ln('Q1', 'One sentence here. Two sentence here.'), ln('Q2', 'Three sentence here. Four sentence here.')])], 'sentence', { lang: 'en' });

test('I4 ★ requestTap — 문단 4문장 → translate 1회·4항목·kind translate, 결과가 메모리에(get ready)', async () => {
  const { ra, pipe } = rigTap();
  const u = FOUR();
  assert.equal(u.length, 4);
  const r = await ra.requestTap(u, { all: u, page: 1 });
  assert.equal(pipe.calls.length, 1);
  assert.equal(pipe.calls[0].segs.length, 4);
  assert.equal(pipe.calls[0].ctx.kind, 'translate', '사용량 종류 = translate(charsTranslated 는 낭독만)');
  assert.equal(pipe.calls[0].ctx.domain, 'medical', '[8p] 문서 문체를 그대로');
  assert.equal(pipe.calls[0].ctx.retry, false);
  assert.equal(r.sent, 4);
  for (const x of u) assert.deepEqual(ra.get(x.src), { state: 'ready', text: 'TR(' + x.src + ')' });
  assert.equal(ra.stats().calls, 0, '낭독 동반 번역의 기록과 따로');
  assert.equal(ra.stats().taps, 1);
});

/** `[8c-1b]` 시간 상한 — 거름이 빠져 요청이 영영 안 끝나도 테스트가 멈추지 않고 빨강이 된다. */
function within(p, ms, what) {
  let timer = null;
  const late = new Promise((res) => { timer = setTimeout(() => res('__late__'), ms); if (timer.unref) timer.unref(); });
  return Promise.race([p, late]).then((v) => { clearTimeout(timer); assert.notEqual(v, '__late__', what + ' — ' + ms + 'ms 안에 끝나지 않았다'); return v; });
}

test('I4b ★ requestTap — 메모리 ready 2개면 나머지 2만 · 같은 문단 두 번 → 두 번째 0회 · pending 도 건너뜀', { timeout: 10000 }, async () => {
  const { ra, pipe } = rigTap();
  const u = FOUR();
  await ra.requestTap([u[0], u[1]], { all: u });
  assert.equal(pipe.calls.length, 1);
  await ra.requestTap(u, { all: u });
  assert.equal(pipe.calls.length, 2);
  assert.deepEqual(pipe.calls[1].segs.map((s) => s.text), [u[2].src, u[3].src]);
  await ra.requestTap(u, { all: u });
  assert.equal(pipe.calls.length, 2, '★ 두 번째 같은 문단 = 0회');
  // pending — 떠 있는 동안 다시 탭해도 새 요청 없음
  const slow = fakePipeline();
  let release;
  slow.translate = (segs) => { slow.calls.push({ segs: segs }); return new Promise((res) => { release = () => res({ status: 'ready', calls: 1, results: segs.map(() => ({ state: 'ready', text: 'x' })) }); }); };
  const h = rigTap({ pipeline: slow });
  const p1 = h.ra.requestTap(u, { all: u });
  await flush(3);
  assert.equal(h.ra.get(u[0].src).state, 'pending');
  await within(h.ra.requestTap(u, { all: u }), 2000, '떠 있는 같은 문단 다시 탭');
  assert.equal(slow.calls.length, 1);
  release();
  await within(p1, 2000, '첫 요청');
  assert.equal(h.ra.get(u[3].src).state, 'ready');
});

test('I4e ★ [8c-1b] requestTap 한 번에 하나 — 다른 문단 셋을 빠르게: 동시 1 · 대기 한 칸(새 탭이 앞 대기를 버림) → 2회 · 끝나면 다음', { timeout: 10000 }, async () => {
  const three = buildUnits([para('a', [ln('A1', 'Alpha one here. Alpha two here.')]), para('b', [ln('B1', 'Beta one here.')]),
    para('c', [ln('C1', 'Gamma one here. Gamma two here.')])], 'sentence', { lang: 'en' });
  const byPara = (id) => three.filter((x) => x.paraId === id);
  const slow = fakePipeline();
  const gates = [];
  let inflight = 0; let maxInflight = 0;
  slow.translate = (segs) => {
    slow.calls.push({ segs: segs.map((s) => s.text) });
    inflight++; maxInflight = Math.max(maxInflight, inflight);
    return new Promise((res) => { gates.push(() => { inflight--; res({ status: 'ready', calls: 1, results: segs.map(() => ({ state: 'ready', text: 'x' })) }); }); });
  };
  const { ra } = rigTap({ pipeline: slow });
  const pa = ra.requestTap(byPara('a'), { all: three });
  await flush(3);
  const pb = ra.requestTap(byPara('b'), { all: three });
  const pc = ra.requestTap(byPara('c'), { all: three });
  await flush(3);
  assert.equal(slow.calls.length, 1, '★ 떠 있는 동안 새 요청 0(동시 1)');
  assert.deepEqual(await within(pb, 2000, '버려진 대기'), { calls: 0, sent: 0, dropped: true }, '앞 대기(b)는 보내지 않고 버림');
  assert.equal(ra.get(byPara('b')[0].src).state, 'none', 'b 는 메모리에도 pending 이 남지 않는다(다시 탭하면 보낸다)');
  assert.equal(ra.stats().tapWaiting, true);
  gates.shift()();
  await within(pa, 2000, 'a');
  await flush(5);
  assert.equal(slow.calls.length, 2, 'a 가 끝나자 대기 칸(c)을 보냄');
  assert.deepEqual(slow.calls[1].segs, byPara('c').map((x) => x.src));
  gates.shift()();
  const rc = await within(pc, 2000, 'c');
  assert.equal(rc.sent, 2);
  assert.equal(maxInflight, 1);
  assert.equal(ra.stats().tapBusy, false);
  assert.equal(ra.stats().tapWaiting, false);
  // 그 뒤 b 를 다시 탭하면 보낸다(문단당 1)
  const pb2 = ra.requestTap(byPara('b'), { all: three });
  await flush(3);
  gates.shift()();
  assert.equal((await within(pb2, 2000, 'b 다시')).sent, 1);
  assert.equal(slow.calls.length, 3);
  // 대기 중 문서가 바뀌면 대기 칸은 버림(새 서비스로)
  const h = rigTap({ pipeline: slow });
  const pd = h.ra.requestTap(byPara('a'), { all: three });
  await flush(3);
  const pe = h.ra.requestTap(byPara('c'), { all: three });
  h.ra.setDoc({ docId: 'doc2', lang: 'en', target: 'ar', pageCount: 3 });
  gates.shift()();
  await within(pd, 2000, '문서 바뀜 — 떠 있던 것');
  assert.equal((await within(pe, 2000, '문서 바뀜 — 대기')).dropped, true);
  assert.equal(slow.calls.length, 4, '대기 칸은 새 문서에 보내지 않는다');
});

test('I4f ★ [8c-1c] 마지막 탭의 문단이 이미 떠 있으면 대기 칸을 비운다 — A(문단 P) → B(문단 Q) → A\'(P 다른 줄) = 1회(Q 를 보내지 않음)', { timeout: 10000 }, async () => {
  const two = buildUnits([para('p', [ln('P1', 'Papa one here.'), ln('P2', 'Papa two here.')]), para('q', [ln('Q1', 'Quebec one here.')])], 'sentence', { lang: 'en' });
  const byPara = (id) => two.filter((x) => x.paraId === id);
  const slow = fakePipeline();
  const gates = [];
  slow.translate = (segs) => {
    slow.calls.push({ segs: segs.map((s) => s.text) });
    return new Promise((res) => { gates.push(() => res({ status: 'ready', calls: 1, results: segs.map(() => ({ state: 'ready', text: 'x' })) })); });
  };
  const { ra } = rigTap({ pipeline: slow });
  const pa = ra.requestTap(byPara('p'), { all: two });
  await flush(3);
  const pb = ra.requestTap(byPara('q'), { all: two });
  assert.equal(ra.stats().tapWaiting, true, 'B 는 대기 칸');
  const pa2 = await within(ra.requestTap(byPara('p'), { all: two }), 2000, "A' (떠 있는 문단)");
  assert.deepEqual(pa2, { calls: 0, sent: 0 }, "A' 는 보낼 것 없음(P 가 떠 있다)");
  assert.deepEqual(await within(pb, 2000, '비운 대기'), { calls: 0, sent: 0, dropped: true }, '★ 지나간 탭 B 는 보내지 않고 버림');
  assert.equal(ra.stats().tapWaiting, false);
  gates.shift()();
  await within(pa, 2000, 'A');
  await flush(5);
  assert.equal(slow.calls.length, 1, '★ 마지막 탭(P)만 — Q 를 보내지 않았다');
  assert.equal(ra.get(byPara('q')[0].src).state, 'none');
  // 받은 문단(ready)이 마지막 탭이어도 같다: C(Q, 떠 있음) → A''(P, ready) 는 0, 대기 없음
  const pq = ra.requestTap(byPara('q'), { all: two });
  await flush(3);
  assert.deepEqual(await within(ra.requestTap(byPara('p'), { all: two }), 2000, 'ready 문단'), { calls: 0, sent: 0 });
  gates.shift()();
  await within(pq, 2000, 'Q');
  assert.equal(slow.calls.length, 2);
});

test('I4c requestTap — [8m] 대상 언어와 같은 문장은 항목에서 빠진다 · retry:true 전달(막힌 상태면 pipeline.retry 먼저) · 실패·막힘 기록', async () => {
  const { ra, pipe } = rigTap({ target: 'fr' });
  const u = FOUR();
  const mixed = u.map((x, i) => (i === 1 ? Object.assign({}, x, { lang: 'fr' }) : x));
  await ra.requestTap(mixed, { all: mixed });
  assert.equal(pipe.calls.length, 1);
  assert.equal(pipe.calls[0].segs.length, 3);
  assert.ok(pipe.calls[0].segs.every((s) => s.text !== u[1].src));
  assert.equal(ra.translatable(mixed[1]), false);
  // 실패 → failed, retry:true 로 다시
  const bad = fakePipeline(() => ({ state: 'failed', code: 'SERVER' }));
  const h = rigTap({ pipeline: bad });
  await h.ra.requestTap(u, { all: u });
  assert.equal(h.ra.get(u[0].src).state, 'failed');
  bad.set(STATES.EXHAUSTED);
  await h.ra.requestTap(u, { all: u, retry: true });
  assert.equal(bad.retries, 1, '막힌 원격 상태 — 사용자 [다시 시도]가 pipeline.retry() 먼저');
  assert.equal(bad.calls[1].ctx.retry, true);
  // 막힘(원격 상태가 막힌 상태) → blocked
  const blk = fakePipeline(() => ({ state: 'blocked', code: 'offline' }));
  blk.set(STATES.OFFLINE);
  const h2 = rigTap({ pipeline: blk });
  await h2.ra.requestTap(u, { all: u });
  assert.deepEqual(h2.ra.get(u[0].src), { state: 'blocked', code: 'offline' });
  // 문서가 없으면 0
  const h3 = rigTap();
  h3.ra.setDoc({ docId: null, lang: 'en', target: 'ar' });
  assert.deepEqual(await h3.ra.requestTap(u, { all: u }), { calls: 0, sent: 0 });
});

test('I4d requestTap — 조각 표시(frag)는 쪽 전체 기준(낭독 동반 번역과 같다) · tapGate() 는 마지막 setContext 문맥', async () => {
  const { ra, pipe } = rigTap();
  const all = buildUnits([para('a', [ln('A1', 'continued from before. Whole one.')]), para('b', [ln('B1', 'Second para here. And it runs on')])], 'sentence', { lang: 'en' });
  const paraB = all.filter((x) => x.paraId === 'b');
  await ra.requestTap(paraB, { all: all });
  assert.deepEqual(pipe.calls[0].segs.map((s) => s.frag), [null, 'head'], '마지막 문장만 head — 문단 B 의 첫 문장은 쪽 첫 문장이 아니다');
  ra.setContext({ consented: true, srcLang: 'en', supportedSrc: ['en'], targetLang: 'ar', hasKey: false });
  assert.deepEqual(ra.tapGate(), { ok: false, reason: REASON.NO_KEY });
});

/* ══ 5. requestTap — 실제 pipeline(요청 본문 바이트·캐시 공유) ══ */

function realPipe(fetch, db) {
  const timers = manualTimers();
  const cache = createCache({ db: db, now: () => 0 });
  const pipeline = createPipeline({
    fetch: fetch, db: db, cache: cache, getKey: () => FAKE_KEY,
    getSetting: settingsOf({ 'ai.maxReqChars': 6000, 'ai.useOnDevice': false }),
    now: () => new Date(2026, 10, 16, 14).getTime(), isOnline: () => true,
    setTimer: timers.set, clearTimer: timers.clear, listen: false
  });
  return { pipeline, cache };
}

test('I5 ★ requestTap(실제 pipeline) — 요청 본문 바이트가 낭독 동반 번역 요청과 같다 · 같은 캐시 키 → 뒤 refill 0건 · byKind.translate', async () => {
  const u = FOUR();
  // (가) 탭 경로
  const dbA = memDb();
  const fA = stubFetch(echoTranslate());
  const A = realPipe(fA, dbA);
  const ra = createReadalong({ pipeline: A.pipeline, cache: A.cache, getSetting: settingsOf({ 'ai.maxReqChars': 6000 }), saveReadStats: async () => { }, loadParas: async () => null });
  ra.setDoc({ docId: 'doc1', lang: 'en', target: 'ar', pageCount: 1 });
  ra.setContext({ mode: 'show', consented: true, srcLang: 'en', supportedSrc: ['en'], targetLang: 'ar', unit: 'sentence', hasKey: true });
  await ra.requestTap(u, { all: u, page: 1 });
  assert.equal(fA.calls.length, 1);
  // (나) 같은 문장을 낭독 동반 번역의 kind 로 직접 — 본문 바이트 비교
  const dbB = memDb();
  const fB = stubFetch(echoTranslate());
  const B = realPipe(fB, dbB);
  await B.pipeline.translate(u.map((x, i, arr) => ({ text: x.src, frag: null })), { src: 'en', target: 'ar', kind: 'readalong', docId: 'doc1' });
  assert.equal(fB.calls.length, 1);
  assert.equal(fA.calls[0].init.body, fB.calls[0].init.body, '★ 새 요청 꼴 없음 — 바이트 동일');
  assert.equal(fA.calls[0].url, fB.calls[0].url);
  // 낭독 동반 번역이 같은 쪽을 읽으면 — 메모리 ready → 요청 0
  ra.setActive(true);
  await ra.onQueue(1, u, u[0].seg);
  await ra.idle();
  await flush();
  assert.equal(fA.calls.length, 1, '탭이 받은 문장은 낭독 때 0회');
  // 새 서비스(새로고침)·같은 캐시 → 캐시 적중
  const ra2 = createReadalong({ pipeline: A.pipeline, cache: A.cache, getSetting: settingsOf({ 'ai.maxReqChars': 6000 }), saveReadStats: async () => { }, loadParas: async () => null });
  ra2.setDoc({ docId: 'doc1', lang: 'en', target: 'ar', pageCount: 1 });
  const r2 = await ra2.requestTap(u, { all: u });
  assert.equal(r2.calls, 0);
  assert.equal(fA.calls.length, 1, '★ 새로고침 뒤 같은 문단 = 요청 0(캐시)');
  assert.equal(ra2.get(u[2].src).state, 'ready');
  const rows = [];
  await dbA.iterate('usage', {}, (v) => rows.push(v));
  const today = rows[0] || {};
  assert.equal((today.byKind || {}).translate, 1, 'byKind.translate');
  assert.ok(!(today.byKind || {}).readalong);
  assert.ok((today.cacheHits || 0) >= 1, '캐시 적중이 사용량에');
  assert.ok(!today.charsTranslated, 'charsTranslated 는 낭독 동반 번역만(15절)');
});

/* ══ 6. speaker.sentenceUnits ══════════════════════════ */

function fakeSynth() {
  const s = { speaking: false, pending: false, utt: [], speak(u) { s.speaking = true; s.utt.push(u); }, cancel() { s.speaking = false; } };
  return s;
}
function fakeTimers() {
  return { setTimeout: () => 0, clearTimeout: () => { } };
}

function rigSpeaker(paras) {
  const view = {
    paras: () => paras,
    page: () => ({ page: 1, pageCount: 1 }),
    goToPage: () => Promise.resolve(false),
    show: () => true, markDone: () => { }, lineOrder: () => []
  };
  const sp = createSpeaker({ synth: fakeSynth(), timers: fakeTimers(), makeUtterance: (t) => ({ text: t }), view: view,
    translation: null, requestWakeLock: () => Promise.resolve(null) });
  const events = [];
  for (const k of ['queue', 'linechange', 'statechange']) sp.addEventListener(k, (ev) => events.push({ type: k, detail: ev.detail }));
  sp.setDocLang('en-US');
  return { sp, events };
}

test('I6 ★ speaker.sentenceUnits — 문장 모드면 큐와 같다(깊은 비교) · 줄 모드면 buildUnits(…,"sentence", 같은 opts) · 큐·상태·이벤트 불변', () => {
  const paras = PAGE();
  const h = rigSpeaker(paras);
  h.sp.setUnit('sentence');
  h.sp.reload();
  const q = h.events.filter((e) => e.type === 'queue').pop().detail.units;
  assert.deepEqual(h.sp.sentenceUnits(), q);
  assert.notEqual(h.sp.sentenceUnits(), q, '사본');
  h.sp.setUnit('line');
  h.sp.reload();
  const lineQ = h.events.filter((e) => e.type === 'queue').pop().detail.units;
  const before = h.events.length;
  const total = h.sp.getTotal();
  const got = h.sp.sentenceUnits();
  assert.deepEqual(got, buildUnits(paras, 'sentence', { lang: 'en', scriptSwitch: true }));
  assert.ok(lineQ.length !== got.length || lineQ[0].text !== got[0].text, '픽스처: 줄 큐와 문장 단위가 다르다');
  assert.equal(h.events.length, before, '이벤트 0');
  assert.equal(h.sp.getTotal(), total, '큐 그대로');
  assert.equal(h.sp.getState(), 'idle');
  assert.equal(h.sp.getUnit(), 'line');
});

test('I6b R6 — splitSentences 호출은 여전히 두 파일 · speaker 의 buildUnits 는 queueOf 한 곳', () => {
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
  const callers = walk(JS).filter((p) => /\bsplitSentences\s*\(/.test(readFileSync(p, 'utf8')))
    .map((p) => p.slice(JS.length + 1).replace(/\\/g, '/')).sort();
  assert.deepEqual(callers, ['text/segment.js', 'tts/text.js']);
  const sp = strip(read('../js/tts/speaker.js'));
  assert.equal((sp.match(/\bbuildUnits\s*\(/g) || []).length, 1);
  const su = sp.slice(sp.indexOf('sentenceUnits: function'), sp.indexOf('getCurrent: function'));
  assert.match(su, /queueOf\(.*, true, 'sentence'\)/, '줄 모드도 같은 queueOf(peek)');
  assert.ok(!/units\s*=|emit\(|state\s*=/.test(su), '읽기만');
});

/* ══ 7. 띠 탭 모드 · 선택 줄 순수 부분 ══════════════════ */

test('I7 ★ tapView — 준비된 번역 이어 붙이기 · 가장 무거운 상태 한 줄 · 문지기 사유 · 빈 목록 tap.none', () => {
  const r = (t) => ({ state: 'ready', text: t });
  assert.deepEqual(tapView([r('أ'), r('ب')], {}), { state: 'ready', text: 'أ ب', noteKey: null, retry: false, code: null });
  const v = tapView([r('أ'), { state: 'pending' }], {});
  assert.equal(v.state, 'pending'); assert.equal(v.text, 'أ'); assert.equal(v.noteKey, 'readalong.pending');
  const f = tapView([{ state: 'pending' }, { state: 'failed', code: 'SERVER' }, { state: 'blocked', code: 'offline' }], {});
  assert.equal(f.state, 'failed'); assert.equal(f.retry, true);
  const b = tapView([{ state: 'blocked', code: 'exhausted' }], {});
  assert.equal(b.noteKey, 'readalong.blocked.exhausted'); assert.equal(b.retry, true);
  const n = tapView([{ state: 'none' }], { remote: 'offline' });
  assert.equal(n.state, 'blocked'); assert.equal(n.noteKey, 'readalong.blocked.offline');
  assert.deepEqual(tapView([], {}), { state: 'none', text: '', noteKey: 'tap.none', retry: false, code: null });
  for (const reason of Object.keys(GATE_KEYS)) {
    const g = tapView(null, { gate: { ok: false, reason: reason } });
    assert.equal(g.noteKey, GATE_KEYS[reason]);
    assert.equal(g.retry, false);
  }
  assert.deepEqual(Object.keys(GATE_KEYS).sort(), [REASON.CONSENT, REASON.NO_KEY, REASON.SAME_LANG, REASON.UNSUPPORTED_LANG].sort());
  assert.deepEqual(TAP_BANNER_NOW.slice().sort(), ['consent', 'no-key']);
});

test('I7b 선택 줄 — SEL_ACTIONS(단어 번역 hidden · 문장 번역 · 여기서부터 읽기) · selBarModel 흐림 · clampSelection 6낱말·60자', () => {
  // `[18]` `lookup`([찾아보기] — `{q}` 링크가 있을 때만, ctx 없으면 숨김)이 붙었다(links-18 L9 가 본다).
  // `[11-2 — 11-D3]` [요약]이 더해지고 [요약]·[여기서부터 읽기]·[찾아보기]는 `[⋯]` 안(`more`) — 보이는 칸은 [단어 번역][문장 번역].
  // `[11-4 — 11-D3]` 보이는 셋째 칸 [설명](`sentence` 다음 — [문장 번역]과 같은 스냅숏, 흐림·숨김 없음).
  assert.deepEqual(SEL_ACTIONS.map((a) => a.id), ['word', 'sentence', 'explain', 'summary', 'readFrom', 'lookup']);
  assert.deepEqual(SEL_ACTIONS.filter((a) => !a.more).map((a) => a.id), ['word', 'sentence', 'explain']);
  assert.equal(SEL_ACTIONS[0].hidden, true, '8c-1 에서는 마크업만(8f-2 가 켠다)');
  assert.equal(HIDE_DELAY_MS, 300);
  const m = selBarModel(SEL_ACTIONS, { text: 'myocardial' });
  assert.deepEqual(m.map((x) => [x.id, x.hidden, x.disabled]), [['word', true, false], ['sentence', false, false], ['explain', false, false], ['summary', false, false], ['readFrom', false, false], ['lookup', true, false]]);
  const long = selBarModel(SEL_ACTIONS, { text: 'a b c d e f g' });
  assert.equal(long[0].disabled, true);
  assert.equal(long[1].disabled, false, '[문장 번역]은 길어도 된다');
  assert.equal(SEL_LIMIT.WORDS, 6); assert.equal(SEL_LIMIT.CHARS, 60);
  assert.deepEqual(clampSelection('a b c d e f'), { words: 6, chars: 11, tooLong: false });
  assert.equal(clampSelection('a b c d e f g').tooLong, true);
  assert.equal(clampSelection('x'.repeat(60)).tooLong, false);
  assert.equal(clampSelection('x'.repeat(61)).tooLong, true);
  assert.equal(clampSelection('  ').words, 0);
});

test('I7c lineOffsetOf · liftDelta · expandWord(하이픈 결합·구두점)', () => {
  assert.equal(lineOffsetOf({ at: 'text', offset: 5, len: 10 }), 5);
  assert.equal(lineOffsetOf({ at: 'text', offset: 50, len: 10 }), 10);
  assert.equal(lineOffsetOf({ at: 'before', len: 10 }), 0);
  assert.equal(lineOffsetOf({ at: 'after', len: 10 }), 10, '.hy·이음 공백 안 → 줄 끝');
  assert.equal(liftDelta(500, 600), 0);
  assert.equal(liftDelta(596, 600), 0, '아래변 = 윗변 − 4px 이면 그대로');
  assert.equal(liftDelta(597, 600), 1);
  assert.equal(liftDelta(650.2, 600), 55);
  assert.equal(liftDelta(NaN, 600), 0);
  const w = expandWord('The cardio', 6, 7, 'vascular system', null);
  assert.equal(w.word, 'cardiovascular'); assert.equal(w.joined, true);
  assert.deepEqual(expandWord('see (arthritis), now', 7, 9, null, null), { start: 5, end: 14, word: 'arthritis', joined: false });
  assert.equal(expandWord('a word here', 3, 4, 'next', null).word, 'word', '줄 끝이 아니면 잇지 않는다');
  const seg = (s) => [{ index: 0, segment: 'The', isWordLike: true }, { index: 3, segment: ' ', isWordLike: false }, { index: 4, segment: 'heart', isWordLike: true }];
  assert.equal(expandWord('The heart', 5, 6, null, seg).word, 'heart');
});

test('I7f ★ [8c-1c] liftEdge — 선택 줄이 떠 있으면 그 윗변(띠보다 위) · 없으면 띠 윗변 · outOfView — 줄이 본문 영역을 조금이라도 벗어남', () => {
  assert.equal(liftEdge(520, 640), 520, '★ 선택 줄 윗변 기준(8c1R-9 #4 — 띠가 새로 떠 선택 줄이 올라갔다)');
  assert.equal(liftEdge(null, 640), 640, '선택 줄 없음 → 띠 윗변');
  assert.equal(liftEdge(0, 640), 0, '0 도 값이다');
  assert.equal(liftEdge(null, null), null);
  assert.equal(liftEdge(NaN, 640), 640);
  // 굴림량이 실제로 달라진다(같은 줄 아래변 600): 선택 줄 520 기준이면 굴리고, 띠 640 기준이면 그대로
  assert.equal(liftDelta(600, liftEdge(520, 640), 4), 84);
  assert.equal(liftDelta(600, liftEdge(null, 640), 4), 0);
  assert.equal(outOfView(100, 130, 49, 800), false, '안');
  assert.equal(outOfView(-400, -370, 49, 800), true, '★ 위로 굴려 화면 밖');
  assert.equal(outOfView(30, 60, 49, 800), true, '상단 바 밑에 걸침');
  assert.equal(outOfView(790, 820, 49, 800), true, '아래 바 밑에 걸침');
  assert.equal(outOfView(NaN, 1, 0, 1), false, '수가 아니면 굴리지 않음');
});

test('I7d ★ [8c-1b] selBarStep — 선택이 접히면 거두기 예약 · 다시 고르면 예약 취소 · 처음 뜰 때만 굴림 (+ update 배선)', () => {
  assert.deepEqual(selBarStep(true, { hidden: true, hiding: false }), { show: true, lift: true, cancelHide: false, hideLater: false }, '처음 뜸 → 굴림');
  assert.deepEqual(selBarStep(true, { hidden: false, hiding: false }), { show: true, lift: false, cancelHide: false, hideLater: false }, '손잡이 끌기 — 다시 굴리지 않음');
  assert.deepEqual(selBarStep(true, { hidden: false, hiding: true }), { show: true, lift: false, cancelHide: true, hideLater: false }, '거두기 예약 중 다시 고름 → 취소');
  assert.deepEqual(selBarStep(false, { hidden: false, hiding: false }), { show: false, lift: false, cancelHide: false, hideLater: true }, '★ 접힘 → 300ms 뒤 거둠');
  assert.equal(selBarStep(false, { hidden: false, hiding: true }).hideLater, false, '예약이 이미 있으면 또 걸지 않음');
  assert.equal(selBarStep(false, { hidden: true, hiding: false }).hideLater, false, '숨어 있으면 할 일 없음');
  const sb = strip(read('../js/ui/selbar.js'));
  const up = sb.slice(sb.indexOf('function update()'), sb.indexOf('function elOf('));
  assert.match(up, /const step = selBarStep\(!!s, \{ hidden: els\.bar\.hidden, hiding: hideTimer !== null \}\);/);
  assert.match(up, /if \(step\.hideLater\) hideTimer = setTimeout\(\(\) => \{ hideTimer = null; hide\(\); \}, HIDE_DELAY_MS\);/);
  assert.match(up, /if \(step\.cancelHide\) \{ clearTimeout\(hideTimer\); hideTimer = null; \}/);
});

test('I7e ★ [8c-1b] Esc — 띠가 가장 위일 때만 닫는다 · [×]·Esc 는 포커스를 탭한 줄로 · 연결 회복 때 offline 막힌 탭 문단 한 번 다시', () => {
  assert.equal(escClosesTap({ tapOpen: true, prevented: false, layers: 0 }), true);
  assert.equal(escClosesTap({ tapOpen: false, layers: 0 }), false, '띠가 탭 모드가 아니면 아무 일 없음');
  assert.equal(escClosesTap({ tapOpen: true, prevented: true, layers: 0 }), false, '다른 손이 이미 씀');
  assert.equal(escClosesTap({ tapOpen: true, layers: 1 }), false, '★ 팝오버·시트·dialog·[≡] 가 위에 있으면 그쪽 몫');
  // `[8c-1c]` 숨은 띠(검색 화면 뒤 리더)·편집 칸 대상은 손대지 않는다(8c1bR-8 #2·#3)
  assert.equal(escClosesTap({ tapOpen: true, prevented: false, layers: 0, shown: false }), false, '★ 리더 화면이 숨었다');
  assert.equal(escClosesTap({ tapOpen: true, prevented: false, layers: 0, editing: true }), false, '★ 쪽 번호·검색어 입력칸');
  assert.equal(escClosesTap({ tapOpen: true, prevented: false, layers: 0, shown: true, editing: false }), true, '띠 안 단추 등');
  const tb = strip(read('../js/ui/trband.js'));
  assert.match(tb, /document\.addEventListener\('keydown', onEscKey, true\);/, '★ Esc 리스너(붙잡기 단계 — 위층이 자기 Esc 로 닫히기 전에 본다)');
  const esc = tb.slice(tb.indexOf('function onEscKey('), tb.indexOf('function dropTap'));
  assert.match(esc, /escClosesTap\(\{ tapOpen: true, prevented: ev\.defaultPrevented, layers: upperLayers\(\), shown: bandShown\(\), editing: isEditable\(ev\.target\) \}\)/);
  assert.match(esc, /ev\.preventDefault\(\);\s*closeTapByUser\(true\);/, '[8c-1c] Esc = 키보드로 닫음(화면 밖 줄이면 굴려 보임)');
  const shown = tb.slice(tb.indexOf('function bandShown('), tb.indexOf('function dropTap'));
  assert.match(shown, /const reader = els\.band\.closest\('\[data-screen="reader"\]'\);\s*if \(reader && reader\.hidden\) return false;/, '★ 화면 섹션의 숨김까지 본다');
  assert.match(shown, /getClientRects\(\)\.length > 0/);
  const ed = tb.slice(tb.indexOf('function isEditable('), tb.indexOf('export function tapResendOnline'));
  assert.match(ed, /closest\('input, textarea, select, \[contenteditable\]:not\(\[contenteditable="false"\]\)'\)/);
  assert.match(ed, /isContentEditable/);
  // 리더를 숨기기만 하고 떠날 때(검색 화면) 띠를 닫는다 — 포커스 되돌림 없이(closeTap)
  const rdl = strip(read('../js/ui/reader.js'));
  const lv = rdl.slice(rdl.indexOf('export function leaveReader('), rdl.indexOf('function leaveReaderNow('));
  assert.match(lv, /if \(searchOverReader\(\)\) \{[\s\S]*?closeTapBand\(\);\s*return;\s*\}/, '★ 검색 갈래에서 탭 띠를 닫는다');
  const cb = strip(read('../js/ui/controls.js'));
  assert.match(cb, /export function closeTapBand\(\) \{\s*if \(trband\) trband\.closeTap\(\);\s*\}/, '포커스를 건드리지 않는 닫기');
  assert.match(cb, /onPageRepaint\(\(\) => \{ if \(trband\) trband\.sync\(\); \}\);/, '★ 다시 보이면 띠 자리를 다시 잡는다(보이기 모드 낭독 띠가 숨은 채 남지 않게)');
  const layers = tb.slice(tb.indexOf('function upperLayers('), tb.indexOf('function onEscKey('));
  assert.match(layers, /dialog\[open\], \[role="dialog"\]:not\(\[hidden\]\)/);
  assert.match(layers, /chromeToggle/);
  assert.match(tb, /else if \(b\.getAttribute\('data-tr-action'\) === 'close'\) closeTapByUser\(ev\.detail === 0\);/, '[×] 도 포커스를 되돌리는 길(키보드로 누른 [×] 만 굴림 — 8c-1c)');
  const byUser = tb.slice(tb.indexOf('function closeTapByUser('), tb.indexOf('function upperLayers('));
  // `[11-4]` 설명 모드면 닫은 뒤 `onClose`(말하기 멈춤) 한 줄이 그 사이에 든다 — 순서(닫기 → 포커스 되돌림)는 그대로.
  assert.match(byUser, /const back = tap\.focusBack;[\s\S]*?closeTap\(\);[\s\S]*?if \(back\) \{ try \{ back\(!!byKey\);/);
  assert.ok(byUser.indexOf('closeTap();') < byUser.indexOf('if (back)'), '닫은 뒤 포커스');
  const c = strip(read('../js/ui/controls.js'));
  assert.match(c, /focusBack: function \(reveal\) \{ focusLine\(lineId, reveal\); \}/);
  const rd = strip(read('../js/ui/reader.js'));
  const fl = rd.slice(rd.indexOf('export function focusLine('), rd.indexOf('function centerRect('));
  assert.match(fl, /focusQuiet\(els\.mount\)/, '줄이 없으면 리더 본문');
  assert.match(fl, /preventScroll: true/);
  // `[8c-1c]` 키보드로 닫았고(reveal) 줄이 본문 영역 밖이면 가장 가까운 쪽으로만 굴린다(프로그램 스크롤 표시)
  assert.match(fl, /^export function focusLine\(lineId, reveal\) \{/);
  assert.match(fl, /focusQuiet\(span\)\) \{\s*if \(!reveal\) return;/, '★ 손가락·마우스 [×] 는 굴리지 않는다');
  assert.match(fl, /if \(outOfView\(r\.top, r\.bottom, area\.top, area\.bottom\)\) \{\s*state\.programScrollAt = Date\.now\(\);\s*try \{ span\.scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\);/);
  // 연결 회복
  const off = { state: 'blocked', code: 'offline' };
  assert.equal(tapResendOnline([{ state: 'ready', text: 'x' }, off], 'offline', false), true);
  assert.equal(tapResendOnline([off], 'offline', true), false, '★ 한 번만');
  assert.equal(tapResendOnline([off], 'exhausted', false), false, '오프라인에서 돌아온 것만');
  assert.equal(tapResendOnline([{ state: 'blocked', code: 'exhausted' }], 'offline', false), false);
  assert.equal(tapResendOnline([{ state: 'ready', text: 'x' }], 'offline', false), false, '받을 것이 없으면 0');
  const rem = tb.slice(tb.indexOf('function onRemote('), tb.indexOf('function providerLabel('));
  assert.match(rem, /if \(state === 'ready'\) \{[\s\S]*?resendTapOnline\(d\.prev\);\s*return;/);
  assert.match(rem, /tap\.resent = true;\s*Promise\.resolve\(\)\.then\(tap\.resend\)/);
  assert.match(c, /resend: function \(\) \{ return ask\(false\); \}/, '다시 보내기는 retry 표시 없이(사용자 [다시 시도]가 아니다)');
});

/* ══ 8. 배선 (소스) ═════════════════════════════════════ */

test('I8 ★ controls — 줄 탭: 첫 줄 듣기 취소 → speaking·paused 이동(지금 그대로) → waiting-page 무시 → 그 밖 탭 번역', () => {
  const c = strip(read('../js/ui/controls.js'));
  const tap = c.slice(c.indexOf('onLineTap((lineId) => {'), c.indexOf('selbar = initSelBar('));
  assert.match(tap, /^onLineTap\(\(lineId\) => \{\s*cancelVoice\(\);\s*const s = speaker\.getState\(\);\s*if \(s === 'speaking' \|\| s === 'paused'\) \{ speaker\.play\(lineId\); return; \}\s*if \(s === 'waiting-page'\) return;\s*openTapFor\(lineId, null\);/);
  const pp = c.slice(c.indexOf('function pressPlay()'), c.indexOf('function noReadNotice()'));
  assert.match(pp, /^function pressPlay\(\) \{\s*cancelVoice\(\);\s*if \(trband\) trband\.closeTap\(\);/, '[▶] 가 탭 띠를 닫는다');
  assert.match(c, /onPageRender\(\(\) => \{ if \(trband\) trband\.closeTap\(\); \}\);/, '쪽 넘김이 닫는다');
  assert.match(c, /trband\.setInlineSuspend\(function \(on\) \{ if \(inlinetr\) inlinetr\.suspend\(on\); \}\);/, '★ inline 멈춤 배선');
  const open = c.slice(c.indexOf('function openTapFor('), c.indexOf('function onSelAction('));
  assert.match(open, /syncReadalong\(\);[\s\S]*speaker\.sentenceUnits\(\)[\s\S]*readalong\.tapGate\(\)[\s\S]*trband\.openTap\([\s\S]*if \(gate\.ok && hit\.length\) ask\(false\)/);
  // `[8c-1b]` 계획은 순수 tapPlan(I2c) — 요청은 그 문단 단위, 띠는 번역 대상 문장만(8m·표 안내·인용)
  assert.match(open, /const plan = tapPlan\(units, lineId, segsWanted, \(u\) => readalong\.translatable\(u\)\);/);
  assert.match(open, /const paraUnits = plan\.paraUnits;/);
  assert.match(open, /readalong\.requestTap\(paraUnits, \{ all: units, page: page, retry: !!retry \}\)/);
  assert.match(open, /liftLineAbove\(lineId, liftEdge\(selbar \? selbar\.top\(\) : null, trband\.bandTop\(\)\)\);/, '[8c-1b] 선택 줄이 떠 있으면 그 윗변 기준(규칙은 I7f liftEdge — 8c-1c)');
  const sel = c.slice(c.indexOf('function onSelAction('));
  assert.match(sel, /^function onSelAction\(id, snap\) \{\s*cancelVoice\(\);/, '선택 줄 단추도 손이 이긴다');
  assert.match(c, /if \(selbar\) selbar\.hide\(\);/);
});

test('I8b 띠·inline·리더·원본 — openTap 이 inline 을 멈추고 닫으면 되돌림 · linechange 가 닫음 · isTap 두 뷰 · 가림 굴리기', () => {
  const tb = strip(read('../js/ui/trband.js'));
  const open = tb.slice(tb.indexOf('export function openTap'), tb.indexOf('export function closeTap'));
  assert.match(open, /if \(!was && suspendInline\) \{ try \{ suspendInline\(true\);/);
  assert.match(open, /TAP_BANNER_NOW\.indexOf\(reason\) >= 0/);
  const drop = tb.slice(tb.indexOf('function dropTap'), tb.indexOf('function unwatchTap'));
  assert.match(drop, /suspendInline\(false\)/);
  const line = tb.slice(tb.indexOf('function onLine(d)'), tb.indexOf('function onPhase'));
  assert.match(line, /^function onLine\(d\) \{\s*if \(tap\) closeTap\(\);/);
  const sync = tb.slice(tb.indexOf('export function sync'), tb.indexOf('export function leave'));
  assert.match(sync, /const visible = \(on \|\| !!tap\) && !\(reader && reader\.hidden\);/);
  assert.ok(!/sp\.(play|pause|stop|next|prev|setReadalong|setRate)\(/.test(tb), '띠는 speaker 를 조작하지 않는다');
  const il = strip(read('../js/ui/inlinetr.js'));
  assert.match(il, /if \(on && !suspended\) document\.documentElement\.setAttribute\('data-tr-inline', 'on'\);/);
  assert.match(il, /export function suspend\(on\) \{\s*suspended = !!on;/);
  const rd = strip(read('../js/ui/reader.js'));
  assert.match(rd, /import \{ isTap, createTapTracker, liftDelta, outOfView \} from '\.\.\/text\/select\.js';/);
  // `[8c-1c]` 문서 붙잡기 단계 — 뗌은 표시(release), 취소는 지움. 두 뷰 같은 규칙(8c1bR-8 #1)
  assert.match(rd, /document\.addEventListener\('pointerup', \(ev\) => \{ taps\.release\(ev\.pointerId\); \}, \{ capture: true, passive: true \}\);/);
  assert.match(rd, /document\.addEventListener\('pointercancel', \(ev\) => \{ taps\.drop\(ev\.pointerId\); \}, \{ capture: true, passive: true \}\);/);
  // `[8c-1b]` 포인터별 기록 · 다중 터치 입력 · 취소·캡처 잃음이 지움 — 두 뷰 같은 규칙
  assert.match(rd, /if \(!isTap\(down, \{ t: ev\.timeStamp, x: ev\.clientX, y: ev\.clientY, sel: hasTextSelection\(\) \}, !!\(down && down\.sel\), !!\(down && down\.multi\)\)\) return;/);
  assert.match(rd, /const taps = createTapTracker\(\);/);
  assert.match(rd, /const down = taps\.up\(ev\.pointerId\);/);
  assert.match(rd, /taps\.down\(\{ id: ev\.pointerId, t: ev\.timeStamp, x: ev\.clientX, y: ev\.clientY, sel: hasTextSelection\(\), primary: ev\.isPrimary, type: ev\.pointerType \}\);/);
  assert.match(rd, /els\.mount\.addEventListener\('pointercancel', \(ev\) => \{ taps\.drop\(ev\.pointerId\); \}/);
  assert.match(rd, /els\.mount\.addEventListener\('lostpointercapture', \(ev\) => \{ taps\.drop\(ev\.pointerId\); \}/);
  assert.ok(!/tapDown/.test(rd), '한 칸 기록이 남지 않는다');
  const og = strip(read('../js/ui/original.js'));
  assert.match(og, /if \(!isTap\(down, \{ t: ev\.timeStamp, x: ev\.clientX, y: ev\.clientY, sel: hasSel\(\) \}, !!\(down && down\.sel\), !!\(down && down\.multi\)\)\) return;/);
  assert.match(og, /const taps = createTapTracker\(\);/);
  assert.match(og, /const down = taps\.up\(ev\.pointerId\);/);
  assert.match(og, /pageWrap\.addEventListener\('pointercancel', \(ev\) => \{ taps\.drop\(ev\.pointerId\); \}/);
  assert.match(og, /pageWrap\.addEventListener\('lostpointercapture', \(ev\) => \{ taps\.drop\(ev\.pointerId\); \}/);
  assert.ok(!/tapDown/.test(og));
  assert.match(og, /document\.addEventListener\('pointerup', onDocPointerUp, \{ capture: true, passive: true \}\);/);
  assert.match(og, /document\.addEventListener\('pointercancel', onDocPointerCancel, \{ capture: true, passive: true \}\);/);
  assert.match(og, /function onDocPointerUp\(ev\) \{ taps\.release\(ev\.pointerId\); \}/);
  assert.match(og, /function onDocPointerCancel\(ev\) \{ taps\.drop\(ev\.pointerId\); \}/);
  assert.match(og, /taps\.down\(\{ id: ev\.pointerId, t: ev\.timeStamp, x: ev\.clientX, y: ev\.clientY, sel: hasSel\(\), primary: ev\.isPrimary, type: ev\.pointerType \}\);/);
  const lift = rd.slice(rd.indexOf('export function liftAbove'), rd.indexOf('export function liftLineAbove'));
  assert.match(lift, /state\.view !== 'reflow'/, '리플로우만');
  assert.match(lift, /state\.programScrollAt = Date\.now\(\);/, '6-5 사용자 스크롤과 섞이지 않게');
});

test('I8c 순수·import 방향 — text/select.js 순수(전역 0) · readalong 은 ui 를 모른다 · selbar 는 speaker·readalong 을 모른다 · innerHTML 0', () => {
  const s = read('../js/text/select.js');
  assert.ok(!/\b(document|window)\b|Intl\.Segmenter|^import /m.test(s), 'select.js 는 순수(주석 포함)');
  const ra = strip(read('../js/ai/readalong.js'));
  assert.ok(!/from '\.\.\/ui\//.test(ra));
  assert.ok(!/buildTranslateRequest|TRANSLATE_SCHEMA|fetch\(/.test(ra), '요청 꼴을 직접 만들지 않는다(pipeline.translate 하나)');
  const sb = strip(read('../js/ui/selbar.js'));
  assert.ok(!/tts\/|ai\/|from '\.\/(controls|trband|reader)\.js'/.test(sb));
  for (const f of ['../js/ui/selbar.js', '../js/text/select.js', '../js/ui/trband.js', '../js/ui/controls.js']) {
    assert.ok(!/innerHTML/.test(strip(read(f))), f + ' innerHTML 0');
  }
  assert.ok(!/onclick/.test(strip(read('../js/ui/selbar.js'))));
});

test('I8d index.html — 띠 머리 끝 단추 칸([문단 전체]·[☆] 자리·[×]) 번역문 앞 · 선택 줄 region · i18n 4언어 같은 키', () => {
  const html = read('../index.html');
  const band = html.slice(html.indexOf('id="trBand"'), html.indexOf('id="trStatus"'));
  const tools = band.indexOf('id="trTools"');
  assert.ok(tools > 0 && tools < band.indexOf('id="trText"'));
  assert.ok(band.indexOf('id="trPara"') < band.indexOf('id="trSlot"') && band.indexOf('id="trSlot"') < band.indexOf('id="trClose"'), '논리 순서 [문단 전체] · [☆] · [×]');
  assert.match(band, /<button type="button" class="tr-close" id="trClose" data-tr-action="close"\s+data-i18n-aria="tap\.close">/);
  assert.match(band, /id="trPara" data-tr-action="para" aria-pressed="false"/);
  assert.match(html, /<div class="sel-bar" id="selBar" role="region" data-i18n-aria="sel\.bar" hidden>/);
  assert.match(html, /"\.\/js\/ui\/selbar\.js": "\.\/js\/ui\/selbar\.js\?v=[0-9a-f]{10}"/, 'import map 도장');
  assert.match(html, /"\.\/js\/text\/select\.js": "\.\/js\/text\/select\.js\?v=[0-9a-f]{10}"/);
  const keys = ['tap.close', 'tap.para', 'tap.none', 'sel.bar', 'sel.word', 'sel.sentence', 'sel.readFrom', 'sel.tooLong'];
  for (const l of LANGS) for (const k of keys) assert.ok(typeof BUNDLES[l][k] === 'string' && BUNDLES[l][k].length > 0, l + ' ' + k);
  for (const k of Object.values(GATE_KEYS)) for (const l of LANGS) assert.ok(BUNDLES[l][k], l + ' ' + k);
  const css = read('../css/reader.css');
  assert.match(css, /\.sel-bar \{[\s\S]*?inset-block-end: calc\(var\(--reader-chrome-bottom\) \+ 4px/, '띠가 켜져 있으면 띠 위(토큰 하나)');
  assert.match(css, /\.sel-bar \.sel-btn \{[\s\S]*?min-block-size: var\(--tap\);/);
  assert.match(css, /\.tr-band \.tr-tools > button \{[\s\S]*?min-block-size: var\(--tap\);[\s\S]*?min-inline-size: var\(--tap\);/);
});
