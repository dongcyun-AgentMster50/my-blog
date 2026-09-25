/* ============================================================
   tests/highlight10a.test.mjs — 10a: 하이라이트를 낭독 문장에 맞춘다
   (spec 6-5 · 4-12)

   ★ 이 파일이 지키는 것 둘.
     ① `Unit.ranges` 가 **읽고 있는 문장만** 가리킨다. 문장이 줄 중간에서
        시작해도 그 줄의 앞부분이 딸려 오지 않는다(`[실기기]` "두 줄·세 줄
        짜리 블럭"의 원인).
     ② 글자 오프셋 → PDF x 보간(`charRangeX`)이 run 경계에서 정확하고
        run 안쪽에서 단조롭다. 원본 뷰의 가로 자르기가 여기 달려 있다.

   전부 순수 함수다 — `document` 도 pdf.js 도 없다.
   픽스처 문장은 전부 지어낸 것이다(16-I — 원서 발췌를 레포에 넣지 않는다).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildUnits, localRange } from '../js/tts/text.js';
import { runCharSpans, charRangeX } from '../js/pdf/render.js';
import { TTS, ORIGINAL } from '../js/config.js';

function ln(id, text, hyphen) {
  return { id: id, text: text, hyphen: hyphen || 'none' };
}
function para(id, lines, kind) {
  return { id: id, kind: kind || 'body', lines: lines };
}
/** `unit.ranges` 를 줄 id 로 찾는다. */
function rangeOf(u, id) {
  return (u.ranges || []).filter((r) => r.id === id)[0] || null;
}
/** 그 구간이 실제로 가리키는 글자 — 기대와 눈으로 맞출 수 있게 잘라 준다. */
function sliceOf(lines, r) {
  const l = lines.filter((x) => x.id === r.id)[0];
  return String(l.text).slice(r.start, r.end);
}

/* ────────────────────────────────────────────────────────
   ① ranges — 문장이 줄 중간에서 시작할 때
   ──────────────────────────────────────────────────────── */

test('H1 ★ 문장이 줄 중간에서 시작하면 ranges 는 **그 문장만** 가리킨다 (앞 문장 꼬리 금지)', () => {
  const lines = [
    ln('1:1', 'The pain was mild. His mobility'),
    ln('1:2', 'is limited today.')
  ];
  const units = buildUnits([para('p1', lines)], 'sentence');
  assert.equal(units.length, 2);

  // 두 번째 문장은 1:1 의 **중간**에서 시작한다.
  const u = units[1];
  assert.equal(u.text, 'His mobility is limited today.');
  assert.deepEqual(u.lineIds, ['1:1', '1:2']);       // ★ lineIds 계약은 그대로

  const r1 = rangeOf(u, '1:1');
  assert.equal(r1.start, 19);                        // 'The pain was mild. ' 다음
  assert.equal(r1.end, 31);
  assert.equal(sliceOf(lines, r1), 'His mobility');  // ← 앞 문장이 섞이지 않았다

  const r2 = rangeOf(u, '1:2');
  assert.deepEqual([r2.start, r2.end], [0, 17]);
  assert.equal(sliceOf(lines, r2), 'is limited today.');
});

test('H2 첫 문장의 ranges 는 줄 앞에서 시작해 문장 끝에서 멈춘다 (뒤 문장 머리 금지)', () => {
  const lines = [ln('1:1', 'The pain was mild. His mobility'), ln('1:2', 'is limited today.')];
  const u = buildUnits([para('p1', lines)], 'sentence')[0];
  assert.equal(u.text, 'The pain was mild.');
  assert.deepEqual(u.lineIds, ['1:1']);
  assert.deepEqual(u.ranges, [{ id: '1:1', start: 0, end: 18 }]);
  assert.equal(sliceOf(lines, u.ranges[0]), 'The pain was mild.');
});

test('H3 ★ 문장이 세 줄에 걸치면 첫·가운데·마지막 줄의 start/end 가 각각 맞다', () => {
  const lines = [
    ln('1:1', 'A first sentence ends. The long one'),
    ln('1:2', 'runs across the middle line'),
    ln('1:3', 'and stops here. Another begins.')
  ];
  const u = buildUnits([para('p1', lines)], 'sentence')[1];
  assert.equal(u.text, 'The long one runs across the middle line and stops here.');
  assert.deepEqual(u.lineIds, ['1:1', '1:2', '1:3']);

  const a = rangeOf(u, '1:1');
  const b = rangeOf(u, '1:2');
  const c = rangeOf(u, '1:3');

  assert.equal(sliceOf(lines, a), 'The long one');                 // 첫 줄 — 뒤쪽만
  assert.deepEqual([b.start, b.end], [0, lines[1].text.length]);   // 가운데 줄 — 통째
  assert.equal(sliceOf(lines, b), 'runs across the middle line');
  assert.equal(sliceOf(lines, c), 'and stops here.');              // 마지막 줄 — 앞쪽만
  assert.equal(c.start, 0);
});

test('H4 ★ 하이픈으로 이어진 줄에서 오프셋이 줄 길이를 넘지 않는다', () => {
  const lines = [ln('1:1', 'The cardio-', 'hidden'), ln('1:2', 'vascular reply was slow.')];
  const u = buildUnits([para('p1', lines)], 'sentence')[0];
  assert.equal(u.text, 'The cardiovascular reply was slow.');

  const a = rangeOf(u, '1:1');
  // `joinPieces` 가 `-` 를 뗀 **뒤** 기준이다 → 10 ( 'The cardio' ), 화면 글자 수 11 이하.
  assert.deepEqual([a.start, a.end], [0, 10]);
  assert.ok(a.end <= lines[0].text.length, 'ranges 가 줄 텍스트 길이를 넘지 않는다');
  assert.equal(sliceOf(lines, a), 'The cardio');

  const b = rangeOf(u, '1:2');
  assert.deepEqual([b.start, b.end], [0, 24]);
  assert.ok(b.end <= lines[1].text.length);
});

test('H5 ★ splitLong 으로 쪼개지면 ranges 를 붙이지 않는다 (틀린 구간을 그리느니 줄 단위)', () => {
  // 300자를 넘기되 쉼표가 있어 여러 조각으로 갈리는 한 문장.
  const chunk = 'the quiet room held a long list of words, ';
  const longText = (chunk.repeat(9) + 'and then it finally ended.').trim();
  assert.ok(longText.length > TTS.MAX_UTTER_CHARS);

  const units = buildUnits([para('p1', [ln('1:1', longText)])], 'sentence');
  assert.ok(units.length > 1, '실제로 쪼개졌다');
  for (let i = 0; i < units.length; i++) {
    assert.equal(units[i].parts, units.length);
    assert.equal(units[i].ranges, undefined, '쪼개진 발화에는 ranges 가 없다');
    assert.deepEqual(units[i].lineIds, ['1:1'], 'lineIds 는 그대로 있다');
  }
});

test('H6 쪼개지지 않은 짧은 문장에는 ranges 가 있다 (H5 의 대조군)', () => {
  const u = buildUnits([para('p1', [ln('1:1', 'A short line.')])], 'sentence')[0];
  assert.equal(u.parts, 1);
  assert.deepEqual(u.ranges, [{ id: '1:1', start: 0, end: 13 }]);
});

test('H7 줄 모드에서도 ranges 는 줄 통째다 (가운데 줄과 같은 모양)', () => {
  const lines = [ln('1:1', 'first line'), ln('1:2', 'second line')];
  const units = buildUnits([para('p1', lines)], 'line');
  assert.deepEqual(units[0].ranges, [{ id: '1:1', start: 0, end: 10 }]);
  assert.deepEqual(units[1].ranges, [{ id: '1:2', start: 0, end: 11 }]);
});

test('H8 ★ lineIds 계약이 바뀌지 않았다 — ranges 는 더한 것뿐이다', () => {
  const lines = [
    ln('1:1', 'A first sentence ends. The long one'),
    ln('1:2', 'runs across the middle line'),
    ln('1:3', 'and stops here.')
  ];
  const units = buildUnits([para('p1', lines)], 'sentence');
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    assert.ok(Array.isArray(u.lineIds) && u.lineIds.length > 0);
    // ranges 의 줄 집합은 lineIds 와 **같은 순서, 같은 목록**이다.
    assert.deepEqual((u.ranges || []).map((r) => r.id), u.lineIds);
  }
});

/* ── 클램프 자체 (마지막 방어선) ──────────────────────────
   `buildUnits` 를 거치면 `Math.max`/`Math.min` 과 `e<=s` 폴백이 값을 먼저
   가둬서 클램프가 시험되지 않는다(변이 확인 결과). `spansIn` 이 어긋난 span
   을 돌려주는 병적 경로가 유일한 진입로이므로 경계를 여기서 직접 고정한다. */

test('H8b ★ 클램프 — 어긋난 span 이 와도 오프셋이 줄 길이를 넘지 않는다', () => {
  const sp = { id: '1:1', start: 100, end: 110 };        // 길이 10 짜리 줄

  // 구간이 줄보다 훨씬 뒤 → 교집합이 비어 **줄 통째**로 돌아간다.
  assert.deepEqual(localRange(sp, 500, 600), { id: '1:1', start: 0, end: 10 });
  // 구간이 줄보다 앞 → 같은 폴백.
  assert.deepEqual(localRange(sp, 0, 20), { id: '1:1', start: 0, end: 10 });
  // 한쪽만 걸치는 정상 구간 — 줄 안으로 접힌다.
  assert.deepEqual(localRange(sp, 104, 400), { id: '1:1', start: 4, end: 10 });
  assert.deepEqual(localRange(sp, 0, 107), { id: '1:1', start: 0, end: 7 });
  // 빈 줄(start === end)은 빈 구간이다 — 그릴 것이 없다.
  assert.deepEqual(localRange({ id: 'e', start: 7, end: 7 }, 0, 99), { id: 'e', start: 0, end: 0 });

  // 전수: 어떤 from/to 를 줘도 [0, len] 밖으로 나가지 않는다.
  for (let from = 90; from <= 120; from++) {
    for (let to = 90; to <= 120; to++) {
      const r = localRange(sp, from, to);
      assert.ok(r.start >= 0 && r.end <= 10 && r.end >= r.start, from + '..' + to);
    }
  }
});

/* ────────────────────────────────────────────────────────
   ② x 보간 — 원본 뷰의 가로 자르기 (4-12)
   ──────────────────────────────────────────────────────── */

/* 본문 줄: run 텍스트가 저장되지 않는다(`text/store.js` 규칙 2) → 폭 비례. */
const bodyLine = {
  id: '1:1',
  text: 'abcdefghij',                                  // 10글자
  bbox: { x0: 100, y0: 700, x1: 200, y1: 712 },
  fontSize: 10,
  role: 'body',
  runs: [{ x0: 100, x1: 150 }, { x0: 160, x1: 210 }]   // 폭 50 + 50
};

/* 폭이 **다른** run 둘. 균등 배정과 폭 비례 배정을 구별하는 대조군이다. */
const lopsidedLine = {
  id: '1:2',
  text: 'abcdefghij',                                  // 10글자
  bbox: { x0: 0, y0: 700, x1: 100, y1: 712 },
  fontSize: 10,
  role: 'body',
  runs: [{ x0: 0, x1: 80 }, { x0: 90, x1: 110 }]       // 폭 80 + 20 → 글자 8 + 2
};

/* 표 줄: run 텍스트가 저장된다 → 정확히 맞춘다. */
const tableLine = {
  id: '2:1',
  text: 'left right',
  bbox: { x0: 100, y0: 700, x1: 220, y1: 712 },
  fontSize: 10,
  role: 'table',
  runs: [{ x0: 100, x1: 140, text: 'left' }, { x0: 180, x1: 230, text: 'right' }]
};

test('H9 run 폭 비례 — 글자가 run 에 반씩 배정된다', () => {
  assert.deepEqual(runCharSpans(bodyLine), [
    { x0: 100, x1: 150, c0: 0, c1: 5 },
    { x0: 160, x1: 210, c0: 5, c1: 10 }
  ]);
});

test('H9b ★ 배정은 run **폭**에 비례한다 — 균등 분배가 아니다', () => {
  assert.deepEqual(runCharSpans(lopsidedLine), [
    { x0: 0, x1: 80, c0: 0, c1: 8 },        // 균등이면 c1 === 5 였을 것이다
    { x0: 90, x1: 110, c0: 8, c1: 10 }
  ]);
  // 넓은 run 의 글자는 좁은 run 의 글자와 같은 폭이다(10pt) — 폭 비례의 뜻이다.
  assert.deepEqual(charRangeX(lopsidedLine, 0, 1), { x0: 0, x1: 10 });
  assert.deepEqual(charRangeX(lopsidedLine, 8, 9), { x0: 90, x1: 100 });
});

test('H10 run 텍스트가 있으면 줄 텍스트 안에서 정확히 찾는다 (표 줄)', () => {
  assert.deepEqual(runCharSpans(tableLine), [
    { x0: 100, x1: 140, c0: 0, c1: 4 },
    { x0: 180, x1: 230, c0: 5, c1: 10 }
  ]);
});

test('H11 ★ run 경계에서 정확하다 — 오차 0', () => {
  // 첫 run 통째: 글자 0..5 → x 100..150
  assert.deepEqual(charRangeX(bodyLine, 0, 5), { x0: 100, x1: 150 });
  // 둘째 run 통째: 글자 5..10 → x 160..210 (run 사이 간격을 덮지 않는다)
  assert.deepEqual(charRangeX(bodyLine, 5, 10), { x0: 160, x1: 210 });
  // 표 줄의 run 경계도 같다.
  assert.deepEqual(charRangeX(tableLine, 0, 4), { x0: 100, x1: 140 });
  assert.deepEqual(charRangeX(tableLine, 5, 10), { x0: 180, x1: 230 });
});

test('H12 ★ run 안쪽은 글자 수 비례로 보간한다', () => {
  // 첫 run 5글자에 폭 50 → 글자 하나가 10pt.
  assert.deepEqual(charRangeX(bodyLine, 1, 3), { x0: 110, x1: 130 });
  assert.deepEqual(charRangeX(bodyLine, 0, 1), { x0: 100, x1: 110 });
  // 두 run 에 걸치면 시작 run 의 안쪽 ~ 끝 run 의 안쪽.
  assert.deepEqual(charRangeX(bodyLine, 3, 7), { x0: 130, x1: 180 });
});

test('H13 ★ 범위 밖 오프셋은 run 교집합이 접는다. 빈 구간이면 null (호출자가 줄 통째로 돌아간다)', () => {
  assert.deepEqual(charRangeX(bodyLine, -5, 999), { x0: 100, x1: 210 });   // 줄 전체로 접힌다
  assert.equal(charRangeX(bodyLine, 4, 4), null);                          // 빈 구간
  assert.equal(charRangeX(bodyLine, 7, 3), null);                          // 뒤집힌 구간
  assert.equal(charRangeX(bodyLine, 20, 30), null);                        // 통째로 밖
  assert.equal(charRangeX(bodyLine, 'x', 3), null);                        // 숫자가 아니다
  // run 사이 공백만 걸리면 그릴 x 가 없다 → null (호출자가 줄 통째 상자로 돌아간다)
  assert.equal(charRangeX(tableLine, 4, 5), null);
  // 그 공백을 낀 구간은 양쪽 run 을 잇는다.
  assert.deepEqual(charRangeX(tableLine, 3, 6), { x0: 130, x1: 190 });
});

test('H14 자른 구간은 언제나 줄 전체 구간 안에 들어간다 (전수)', () => {
  const full = charRangeX(bodyLine, 0, bodyLine.text.length);
  for (let s = 0; s < bodyLine.text.length; s++) {
    for (let e = s + 1; e <= bodyLine.text.length; e++) {
      const r = charRangeX(bodyLine, s, e);
      assert.ok(r, s + '..' + e + ' 는 그릴 수 있다');
      assert.ok(r.x0 >= full.x0 - 1e-9 && r.x1 <= full.x1 + 1e-9, s + '..' + e + ' 가 줄 밖으로 나갔다');
      assert.ok(r.x1 > r.x0);
    }
  }
});

test('H15 runs 가 없으면 줄 bbox 를 run 하나로 친다 (저장본이 얇아도 죽지 않는다)', () => {
  const bare = { id: '3:1', text: 'abcd', bbox: { x0: 0, y0: 0, x1: 40, y1: 10 }, runs: [] };
  assert.deepEqual(runCharSpans(bare), [{ x0: 0, x1: 40, c0: 0, c1: 4 }]);
  assert.deepEqual(charRangeX(bare, 1, 2), { x0: 10, x1: 20 });
  assert.deepEqual(runCharSpans({ id: 'x', text: '', runs: [] }), []);
  assert.equal(charRangeX({ id: 'x', text: 'ab' }, 0, 1), null);            // bbox 도 없다
  assert.equal(charRangeX(null, 0, 1), null);
});

test('H16 4-12 — 상자 상한이 설정에 있다 (줄 수만큼 DOM 을 만들지 않는다)', () => {
  assert.equal(typeof ORIGINAL.HL_MAX_BOXES, 'number');
  assert.ok(ORIGINAL.HL_MAX_BOXES >= 1 && ORIGINAL.HL_MAX_BOXES <= 16);
});
