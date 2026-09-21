/* ============================================================
   MedReader — 하이픈 줄바꿈 결합 단위 테스트 (spec 4-11 표의 H1~H5)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { joinHyphen, joinParagraphText } from '../js/text/hyphen.js';
import { KEEP_HYPHEN_PREFIXES } from '../js/config.js';
import { buildPageLayout } from '../js/text/layout.js';

function item(str, x, y, o = {}) {
  const fs = o.fontSize == null ? 10 : o.fontSize;
  const w = o.width == null ? str.length * fs * 0.5 : o.width;
  return {
    str: str,
    dir: 'ltr',
    transform: [fs, 0, 0, fs, x, y],
    width: w,
    height: fs,
    fontName: 'g_d0_f1',
    hasEOL: !!o.hasEOL
  };
}

test('H1 "cardio-" + "vascular" → "cardiovascular"', () => {
  const r = joinHyphen('cardio-', 'vascular');
  assert.equal(r.joined, 'cardiovascular');
  assert.equal(r.hyphenJoin, true);
});

test('H2 "anti-" + "inflammatory" → "anti-inflammatory"', () => {
  const r = joinHyphen('anti-', 'inflammatory');
  assert.equal(r.joined, 'anti-inflammatory');
  assert.equal(r.keptHyphen, true);
});

test('H3 "2019-" + "2020" → 하이픈 유지, 공백 없이 결합하지 않는다', () => {
  const r = joinHyphen('2019-', '2020');
  assert.notEqual(r.joined, '20192020');
  assert.ok(r.joined === '2019- 2020' || r.joined === '2019-2020');
  assert.equal(r.hyphenJoin, false);
});

test('H4 "gram-" + "negative" → "gram-negative"', () => {
  assert.equal(joinHyphen('gram-', 'negative').joined, 'gram-negative');
});

test('H5 대시("—")로 끝나면 공백 결합', () => {
  const dash = String.fromCharCode(0x2014);
  const r = joinHyphen('an interruption' + dash, 'continues here');
  assert.equal(r.joined, 'an interruption' + dash + ' continues here');
  assert.equal(r.hyphenJoin, false);
  // en dash 와 이중 하이픈도 같다
  assert.equal(joinHyphen('range' + String.fromCharCode(0x2013), 'next').hyphenJoin, false);
  assert.equal(joinHyphen('em--', 'next').hyphenJoin, false);
});

test('H1~H5 문단 단위 결합과 Line.hyphenJoin 표시', () => {
  const { text, hyphenJoins } = joinParagraphText(['the patient had cardio-', 'vascular disease and anti-', 'inflammatory therapy']);
  assert.equal(text, 'the patient had cardiovascular disease and anti-inflammatory therapy');
  assert.deepEqual(hyphenJoins, [true, true, false]);

  // 파이프라인 전체에서도 같은 결과가 나오는지 (줄 텍스트는 원본 유지)
  const layout = buildPageLayout([
    item('the patient had cardio-', 72, 700, { width: 200 }),
    item('vascular disease and the risk', 72, 688, { width: 200 })
  ], { pageNo: 1, width: 612, height: 792 });
  assert.equal(layout.lines[0].text, 'the patient had cardio-');
  assert.equal(layout.lines[0].hyphenJoin, true);
  assert.equal(layout.paragraphs[0].text, 'the patient had cardiovascular disease and the risk');
});

test('H6 접미사 집합으로 하이픈 보존 — 집합은 인자로 주입한다', () => {
  // config.js 의 KEEP_HYPHEN_SUFFIXES 는 사용자가 채우는 TODO 자리이므로
  // 그 내용에 의존하지 않는다. 배선(인자로 받은 집합을 쓰는가)만 고정한다.
  const suffixes = new Set(['resistant']);
  const r = joinHyphen('methicillin-', 'resistant', KEEP_HYPHEN_PREFIXES, suffixes);
  assert.equal(r.joined, 'methicillin-resistant');
  assert.equal(r.keptHyphen, true);
  assert.equal(r.hyphenJoin, false);

  // 접미사 집합이 비어 있으면 줄바꿈 하이픈으로 보고 결합한다(현재 기본 동작).
  assert.equal(joinHyphen('methicillin-', 'resistant', KEEP_HYPHEN_PREFIXES, new Set()).joined,
    'methicillinresistant');

  // 접미사 집합이 H1 을 깨뜨리지 않는다.
  assert.equal(joinHyphen('cardio-', 'vascular', KEEP_HYPHEN_PREFIXES, suffixes).joined,
    'cardiovascular');

  // 문단 단위에서도 주입한 집합이 쓰인다.
  const p = joinParagraphText(['treated for methicillin-', 'resistant infection'],
    KEEP_HYPHEN_PREFIXES, suffixes);
  assert.equal(p.text, 'treated for methicillin-resistant infection');
  assert.deepEqual(p.hyphenJoins, [true, false]);
});
