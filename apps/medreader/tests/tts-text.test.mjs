/* ============================================================
   tests/tts-text.test.mjs — spec 6-1 · 6-2 · 6-4 (5단계)

   ★ 이 파일이 지키는 것 하나: **음성 엔진에 들어가는 글자가 맞는가.**
     `span.line.textContent` 를 그대로 넣으면 "cardio 대시" 가 읽힌다 —
     하이픈 결합 줄은 끝의 `-` 를 CSS 로 감췄을 뿐 텍스트에 남아 있다(12-4).

   전부 순수 함수다. `speechSynthesis` 도 `document` 도 필요 없다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  joinPieces, normalizeSpeech, splitLong, buildUnits,
  expectedMs, watchdogMs, clampRate, indexOfLine
} from '../js/tts/text.js';
import { TTS } from '../js/config.js';

/* 픽스처 문장은 전부 지어낸 것이다(16-I — 원서 발췌를 레포에 넣지 않는다). */
function ln(id, text, hyphen) {
  return { id: id, text: text, hyphen: hyphen || 'none' };
}
function para(id, lines, kind) {
  return { id: id, kind: kind || 'body', lines: lines };
}

/* ── 하이픈 ───────────────────────────────────────────── */

test('X1 ★ 하이픈 결합 줄의 남은 "-" 를 턴다 — "cardio 대시" 가 읽히지 않는다', () => {
  const r = joinPieces([ln('1:1', 'The cardio-', 'hidden'), ln('1:2', 'vascular reply was slow.')]);
  assert.equal(r.text, 'The cardiovascular reply was slow.');
  assert.equal(r.text.indexOf('-'), -1);
});

test('X2 진짜 하이픈(kept)은 살린다 — 4-10 의 접미사 규칙이 만든 값', () => {
  const r = joinPieces([ln('1:1', 'the tricky-', 'kept'), ln('1:2', 'resistant strain')]);
  assert.equal(r.text, 'the tricky-resistant strain');
});

test('X3 이어지지 않는 줄은 공백 하나로 잇는다', () => {
  const r = joinPieces([ln('1:1', 'first line'), ln('1:2', 'second line')]);
  assert.equal(r.text, 'first line second line');
});

test('X4 마지막 줄의 "-" 는 건드리지 않는다 (다음 줄이 없다)', () => {
  const r = joinPieces([ln('1:1', 'a dangling-', 'hidden')]);
  assert.equal(r.text, 'a dangling-');
});

test('X5 각 줄이 원문의 어느 구간인지 정확히 안다 (문장 → 줄 역매핑의 토대)', () => {
  const r = joinPieces([ln('a', 'one two'), ln('b', 'three')]);
  assert.deepEqual(r.spans, [
    { id: 'a', start: 0, end: 7 },
    { id: 'b', start: 8, end: 13 }
  ]);
  assert.equal(r.text.slice(8, 13), 'three');
});

/* ── 정규화 ───────────────────────────────────────────── */

test('X6 URL·이메일은 "link" 로 — 주소를 한 글자씩 읽으면 못 듣는다', () => {
  assert.equal(normalizeSpeech('See https://example.org/a/b for more.'), 'See link for more.');
  assert.equal(normalizeSpeech('Write to nobody@example.org today.'), 'Write to link today.');
});

test('X7 기호는 config.TTS_SYMBOLS 표대로만 바뀐다', () => {
  assert.equal(normalizeSpeech('≥ 4 weeks'), 'greater than or equal to 4 weeks');
  assert.equal(normalizeSpeech('12% of cases'), '12 percent of cases');
  assert.equal(normalizeSpeech('5 ± 2'), '5 plus or minus 2');
});

test('X8 연속 대문자 약어는 건드리지 않는다 (6-1)', () => {
  assert.equal(normalizeSpeech('NSAIDs and COPD'), 'NSAIDs and COPD');
});

/* ── 300자 분할 (6-4) ─────────────────────────────────── */

test('X9 ★ 300자 이하는 쪼개지 않는다', () => {
  const s = 'a'.repeat(TTS.MAX_UTTER_CHARS);
  assert.deepEqual(splitLong(s, TTS.MAX_UTTER_CHARS), [s]);
});

test('X10 ★ 300자 초과는 쉼표·세미콜론에서 쪼갠다. 경계 문자는 앞 조각에 남는다', () => {
  const head = 'w '.repeat(100) + 'end,';           // 200자 + 경계
  const tail = 'x '.repeat(80) + 'done.';
  const parts = splitLong(head + ' ' + tail, TTS.MAX_UTTER_CHARS);
  assert.ok(parts.length >= 2, '쪼개지지 않았다');
  assert.ok(parts[0].endsWith(','), '경계 문자가 앞 조각에 남지 않았다: ' + parts[0].slice(-20));
  for (const p of parts) assert.ok(p.length <= TTS.MAX_UTTER_CHARS, '조각이 상한을 넘었다: ' + p.length);
  // 글자를 잃지 않는다
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), (head + ' ' + tail).replace(/\s+/g, ' '));
});

test('X11 쉼표가 없으면 공백에서라도 쪼갠다 (워치독만 믿지 않는다)', () => {
  const s = ('word '.repeat(120)).trim();
  const parts = splitLong(s, TTS.MAX_UTTER_CHARS);
  assert.ok(parts.length >= 2);
  for (const p of parts) assert.ok(p.length <= TTS.MAX_UTTER_CHARS);
});

/* ── 낭독 큐 (6-1) ────────────────────────────────────── */

test('X12 ★ 줄 모드 — 하이픈으로 이어지는 줄들은 한 발화다', () => {
  const units = buildUnits([para('p1', [
    ln('1:1', 'The cardio-', 'hidden'),
    ln('1:2', 'vascular reply was slow.'),
    ln('1:3', 'A second line here.')
  ])], 'line');

  assert.equal(units.length, 2);
  assert.equal(units[0].text, 'The cardiovascular reply was slow.');
  assert.deepEqual(units[0].lineIds, ['1:1', '1:2']);
  assert.deepEqual(units[1].lineIds, ['1:3']);
});

test('X13 ★ 문장 모드가 기본 — 문단을 문장으로 나누고 걸친 줄을 전부 준다 (6-1 [수정 2026-09-21])', () => {
  const units = buildUnits([para('p1', [
    ln('1:1', 'The first short one.'),
    ln('1:2', 'A second claim starts'),
    ln('1:3', 'and ends here.')
  ])], 'sentence');

  assert.equal(units.length, 2);
  assert.equal(units[0].text, 'The first short one.');
  assert.deepEqual(units[0].lineIds, ['1:1']);
  assert.equal(units[1].text, 'A second claim starts and ends here.');
  assert.deepEqual(units[1].lineIds, ['1:2', '1:3'], '문장이 걸친 줄이 전부 하이라이트되어야 한다');
});

test('X14 문장 모드에서도 하이픈은 털린다', () => {
  const units = buildUnits([para('p1', [
    ln('1:1', 'A cardio-', 'hidden'),
    ln('1:2', 'vascular event.')
  ])], 'sentence');
  assert.equal(units.length, 1);
  assert.equal(units[0].text, 'A cardiovascular event.');
  assert.deepEqual(units[0].lineIds, ['1:1', '1:2']);
});

test('X15 약어가 문장을 끊지 않는다 (segment.js 의 계약을 그대로 쓴다)', () => {
  const units = buildUnits([para('p1', [ln('1:1', 'Use e.g. the second form. Then stop.')])], 'sentence');
  assert.equal(units.length, 2);
  assert.equal(units[0].text, 'Use e.g. the second form.');
});

test('X16 300자 초과 문장은 여러 발화지만 lineIds 는 그대로다 (하이라이트 유지 — 6-4)', () => {
  const long = 'This clause repeats, ' .repeat(30) + 'and then it finally stops.';
  const units = buildUnits([para('p1', [ln('1:1', long)])], 'sentence');
  assert.ok(units.length >= 2, '쪼개지지 않았다');
  assert.equal(units[0].parts, units.length);
  for (const u of units) assert.deepEqual(u.lineIds, ['1:1']);
});

test('X17 빈 문단·빈 줄은 큐에 들어가지 않는다 (조용한 발화로 멈춰 보이지 않게)', () => {
  const units = buildUnits([para('p1', [ln('1:1', '   ')]), para('p2', [])], 'sentence');
  assert.deepEqual(units, []);
});

test('X18 표 줄은 애초에 오지 않는다 — flowParas 가 문단만 주기 때문이다', () => {
  // 4단계 계약의 재확인: buildUnits 의 입력은 para 블록뿐이다.
  const units = buildUnits([para('p1', [ln('1:1', 'Body text only.')])], 'sentence');
  assert.equal(units.length, 1);
});

/* ── 워치독·속도 (6-2 · 6-1) ──────────────────────────── */

test('X19 ★ 워치독 시간 = (len / (14 × rate)) × 1000 + 3000, 발동은 그 2배', () => {
  const text = 'a'.repeat(140);
  assert.equal(expectedMs(text, 1), (140 / 14) * 1000 + 3000);     // 13000
  assert.equal(watchdogMs(text, 1), 26000);
  // 빠르게 읽으면 기대 시간이 준다
  assert.ok(expectedMs(text, 2) < expectedMs(text, 1));
});

test('X20 워치독은 rate 가 0·NaN 이어도 무한대가 되지 않는다', () => {
  assert.ok(Number.isFinite(watchdogMs('abc', 0)));
  assert.ok(Number.isFinite(watchdogMs('abc', NaN)));
});

test('X21 속도는 0.5~2.0, 0.1 단계. 부동소수 찌꺼기를 남기지 않는다', () => {
  assert.equal(clampRate(0.1), 0.5);
  assert.equal(clampRate(9), 2);
  assert.equal(clampRate(1.7000000000000002), 1.7);
  assert.equal(clampRate('1.25'), 1.3);
  assert.equal(clampRate('nope'), 1);
});

test('X22 줄 탭 → 그 줄이 든 발화의 자리 (없으면 -1)', () => {
  const units = buildUnits([para('p1', [
    ln('1:1', 'One sentence here.'),
    ln('1:2', 'Another one follows.')
  ])], 'sentence');
  assert.equal(indexOfLine(units, '1:2'), 1);
  assert.equal(indexOfLine(units, '9:9'), -1);
});
