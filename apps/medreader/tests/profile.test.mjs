/* ============================================================
   MedReader — dev/profile-lib.mjs 순수 집계 함수 단위 테스트 (spec 2-4)

   측정 도구의 **분류·집계 로직만** 본다. pdf.js·파일 시스템은 건드리지 않는다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  newHist, histAdd, histQuantile, histMode, histStats, bumpCapped, topEntries,
  classifyQuestionNumber, classifyCaption, classifyCaptionNumber, ngramsOf,
  tallyScripts, createAcc, addPage, finalize, renderBookProfile, slimLayout, jsonBytes,
  robustMaxKey, quantileOf, CURRENT_CODE_RE
} from '../dev/profile-lib.mjs';

/* ── 히스토그램 ─────────────────────────────────────────── */

test('histQuantile: 양자화 히스토그램의 중앙값·최빈값', () => {
  const h = newHist(0.5);
  [1, 1, 1, 2, 2, 3, 10].forEach(v => histAdd(h, v));
  assert.equal(histQuantile(h, 0.5), 2);           // [1,1,1,2,2,3,10] 의 4번째
  assert.equal(histMode(h), 1);
  const s = histStats(h);
  assert.equal(s.n, 7);
  assert.equal(s.min, 1);
  assert.equal(s.max, 10);
});

test('histStats: 빈 히스토그램은 null 을 돌려준다(추측하지 않는다)', () => {
  const s = histStats(newHist(1));
  assert.equal(s.n, 0);
  assert.equal(s.p50, null);
  assert.equal(s.mode, null);
});

test('bumpCapped: 키 상한에 닿으면 1회짜리를 버려 메모리를 묶는다', () => {
  const m = new Map();
  for (let i = 0; i < 10; i++) bumpCapped(m, 'k' + i, 5);
  bumpCapped(m, 'keep', 5);
  bumpCapped(m, 'keep', 5);
  assert.ok(m.size <= 5);
  assert.equal(m.get('keep'), 2);
});

test('topEntries: 개수 내림차순, 동률이면 키 사전순(결정성)', () => {
  const m = new Map([['b', 2], ['a', 2], ['c', 5]]);
  assert.deepEqual(topEntries(m, 3), [['c', 5], ['a', 2], ['b', 2]]);
});

test('quantileOf: 입력 배열을 훼손하지 않는다', () => {
  const a = [5, 1, 3];
  assert.equal(quantileOf(a, 0.5), 3);
  assert.deepEqual(a, [5, 1, 3]);
  assert.equal(quantileOf([], 0.5), null);
});

/* ── 문항 번호 형식 ─────────────────────────────────────── */

test('classifyQuestionNumber: 로마 접두를 알파벳 접두보다 먼저 본다', () => {
  const r = classifyQuestionNumber('IV-62. A patient presents');
  assert.equal(r.format, 'roman-dash-num');
  assert.equal(r.prefix, 'IV');
  assert.equal(r.number, 62);
  assert.equal(r.digits, 2);
});

test('classifyQuestionNumber: 코드의 \\d{1,3} 상한을 넘는 번호도 잰다', () => {
  const r = classifyQuestionNumber('1024. Which of the following');
  assert.equal(r.format, 'num-dot');
  assert.equal(r.digits, 4);
  // 현재 코드의 QUESTION_RE 는 이걸 못 잡는다 — 그 대비가 이 도구의 목적이다
  assert.equal(CURRENT_CODE_RE.questionStart.test('1024. Which of the following'), false);
});

test('classifyQuestionNumber: 문항이 아닌 줄은 null', () => {
  assert.equal(classifyQuestionNumber('The patient was discharged.'), null);
  assert.equal(classifyQuestionNumber(''), null);
  assert.equal(classifyQuestionNumber(null), null);
});

/* ── 캡션 ───────────────────────────────────────────────── */

test('classifyCaptionNumber: 번호 문법 분류', () => {
  assert.equal(classifyCaptionNumber('II-9'), 'roman-dash-digit');
  assert.equal(classifyCaptionNumber('9'), 'digit');
  assert.equal(classifyCaptionNumber('3-1'), 'digit-dash-digit');
  assert.equal(classifyCaptionNumber('A-4'), 'alpha-dash-digit');
  assert.equal(classifyCaptionNumber('IV'), 'roman');
  assert.equal(classifyCaptionNumber('shows'), 'other');
  assert.equal(classifyCaptionNumber(''), 'none');
});

test('classifyCaption: "TABLE II-9" 는 잡고 현재 코드 정규식은 못 잡는다', () => {
  const c = classifyCaption('TABLE II-9 Something');
  assert.equal(c.prefix, 'TABLE');
  assert.equal(c.shape, 'roman-dash-digit');
  assert.equal(CURRENT_CODE_RE.figureCaption.test('TABLE II-9 Something'), false);
  assert.equal(CURRENT_CODE_RE.figureCaption.test('TABLE 9 Something'), true);
});

test('classifyCaption: 한글·일본어 접두어도 본다 / 아닌 줄은 null', () => {
  assert.equal(classifyCaption('표 3-1 검사 소견').shape, 'digit-dash-digit');
  assert.equal(classifyCaption('図 12 の所見').shape, 'digit');
  assert.equal(classifyCaption('Patients with fever'), null);
});

/* ── n-gram · 글자 계통 ─────────────────────────────────── */

test('ngramsOf: 앞쪽 3·4낱말만 뽑는다', () => {
  assert.deepEqual(ngramsOf('The answer is C. (Chap. 42)'), ['the answer is', 'the answer is c']);
  assert.deepEqual(ngramsOf('one two'), []);
});

test('tallyScripts: 글자 계통을 센다(문자열을 보관하지 않는다)', () => {
  const out = { latin: 0, hangul: 0, cjk: 0, arabic: 0, cyrillic: 0, digit: 0, other: 0 };
  tallyScripts('abc 한글 12', out);
  assert.equal(out.latin, 3);
  assert.equal(out.hangul, 2);
  assert.equal(out.digit, 2);
});

/* ── 누적 집계 ──────────────────────────────────────────── */

// 최소한의 PageLayout 모형 — buildPageLayout 의 출력 형태만 흉내 낸다.
function line(o) {
  return Object.assign({
    id: '1:0', text: '', bbox: { x0: 0, y0: 0, x1: 100, y1: 10 }, baseline: 400,
    fontSize: 10, col: 0, role: 'body', hyphenJoin: false, paraId: null,
    regionId: null, runs: [], items: []
  }, o);
}

function layoutOf(lines, o = {}) {
  return Object.assign({
    pageNo: 1, width: 612, height: 792, algoVersion: 5,
    lines: lines, paragraphs: [], regions: [],
    columns: { count: 1, gutters: [] },
    stats: { medianFontSize: 10, medianLeading: 12, bodyLeft: [72], warn: null }
  }, o);
}

test('addPage/finalize: 캡션 죽은 코드가 경고로 드러난다', () => {
  const acc = createAcc({ docPages: 2 });
  addPage(acc, layoutOf([
    line({ text: 'TABLE II-9 Diagnostic criteria' }),
    line({ text: 'FIGURE II-3 The pathway', id: '1:1' })
  ]), { itemCount: 20, ms: 3, bytes: 4096, itemBytes: 20000 });
  const s = finalize(acc);
  assert.equal(s.caption.lines, 2);
  assert.equal(s.caption.currentRe, 0);
  assert.equal(s.caption.role, 0);
  const dead = s.warnings.filter(w => w.sev === 'DEAD' && /figure-caption/.test(w.msg));
  assert.equal(dead.length, 1);
});

test('addPage/finalize: 보기 글자가 F 까지면 [A-E] 누락이 경고로 나온다', () => {
  const acc = createAcc({ docPages: 1 });
  const lines = [];
  const letters = 'ABCDEF';
  for (let i = 0; i < 60; i++) {
    const ch = letters[i % 6];
    lines.push(line({ id: '1:' + i, text: ch + '. Option text here' }));
  }
  addPage(acc, layoutOf(lines), { itemCount: 100, ms: 2, bytes: 5000, itemBytes: 9000 });
  const s = finalize(acc);
  assert.equal(s.optRange.contiguous, 'F');
  assert.equal(s.optCurrentReHits, 50);                 // A~E 만 현재 정규식에 걸린다
  assert.ok(s.warnings.some(w => w.sev === 'MISS' && /isOptionStart/.test(w.msg)));
});

test('보기 글자 범위는 빈도가 아니라 연속성으로 정한다 (F 는 살리고 머리글자는 버린다)', () => {
  const acc = createAcc({ docPages: 1 });
  const lines = [];
  let i = 0;
  // 5지선다 20문항 + 6지선다 5문항(연속 문턱 3건을 넘는 최소 규모)
  for (let qn = 0; qn < 25; qn++) {
    const letters = qn >= 20 ? 'ABCDEF' : 'ABCDE';
    for (const ch of letters) lines.push(line({ id: '1:' + (i++), text: ch + '. Option text' }));
    lines.push(line({ id: '1:' + (i++), text: 'Stem of the next question follows here.' }));
  }
  // 머리글자 줄 — 빈도는 F 보다 많지만 앞 글자가 R 이 아니다
  for (let k = 0; k < 9; k++) {
    lines.push(line({ id: '1:s' + k, text: 'S. aureus was isolated' }));
    lines.push(line({ id: '1:h' + k, text: 'Some other body line.' }));
  }
  addPage(acc, layoutOf(lines), { itemCount: 300, ms: 4, bytes: 9000, itemBytes: 15000 });
  const s = finalize(acc);
  assert.equal(s.optRange.basis, 'sequence');
  assert.equal(s.optRange.contiguous, 'F');      // E 뒤에 온 F 는 진짜 보기
  assert.equal(s.optRange.max, 'S');             // 등장 최대 글자는 S 지만 연속되지 않는다
  assert.ok(s.warnings.some(w => w.sev === 'MISS' && /isOptionStart/.test(w.msg)));
});

test('robustMaxKey: 1~2건짜리 이상치가 자릿수 상한을 끌어올리지 못한다', () => {
  const m = new Map([[2, 1600], [3, 700], [4, 1], [6, 1]]);
  assert.equal(robustMaxKey(m), 3);
});

test('addPage: 컬럼 탐지 실패 후보(run 간격 > 페이지폭/3)를 센다', () => {
  const acc = createAcc({ docPages: 1 });
  addPage(acc, layoutOf([
    line({ text: 'left part      right part', runs: [{ x0: 72, x1: 200, text: 'left part' }, { x0: 460, x1: 540, text: 'right part' }] }),
    line({ id: '1:1', text: 'normal line', runs: [{ x0: 72, x1: 300, text: 'normal line' }] })
  ]), { itemCount: 8, ms: 1, bytes: 1000, itemBytes: 2000 });
  const s = finalize(acc);
  assert.equal(s.wideGap.lines, 1);
  assert.equal(s.wideGap.pages, 1);
});

test('addPage: 2단 쪽에서 거터 폭을 실측한다', () => {
  const acc = createAcc({ docPages: 1 });
  const lines = [];
  for (let i = 0; i < 6; i++) {
    lines.push(line({ id: '1:L' + i, col: 0, bbox: { x0: 72, y0: 0, x1: 306, y1: 10 }, baseline: 700 - i * 12 }));
    lines.push(line({ id: '1:R' + i, col: 1, bbox: { x0: 321, y0: 0, x1: 540, y1: 10 }, baseline: 700 - i * 12 }));
  }
  addPage(acc, layoutOf(lines, { columns: { count: 2, gutters: [313] } }), { itemCount: 50, ms: 2, bytes: 4000, itemBytes: 8000 });
  const s = finalize(acc);
  assert.equal(s.gutter.p50, 15);
  assert.equal(s.gutterEm.p50, 1.5);
  assert.equal(s.twoColPages, 1);
});

test('slimLayout/jsonBytes: 저장본에서 items 가 빠진다 (spec 9-2)', () => {
  const l = layoutOf([line({ items: [{ str: 'x', x: 1, y: 2, w: 3, h: 4 }] })]);
  const slim = slimLayout(l);
  assert.equal(slim.lines[0].items, undefined);
  assert.equal(l.lines[0].items.length, 1);             // 원본을 훼손하지 않는다
  assert.ok(jsonBytes(slim) < jsonBytes(l));
});

test('renderBookProfile: 유효한 JS 이고, 못 정한 값은 TODO 로 남는다', () => {
  const acc = createAcc({ docPages: 3 });
  addPage(acc, layoutOf([line({ text: 'TABLE II-9 Criteria' })]), { itemCount: 5, ms: 1, bytes: 900, itemBytes: 1800 });
  const src = renderBookProfile(finalize(acc), { file: 'Some Book.pdf', now: '2026-09-20' });
  assert.ok(/export const BOOK_PROFILE = \{/.test(src));
  assert.ok(/id: "some-book"/.test(src));
  assert.ok(/TODO: 측정값 불충분/.test(src));
  // 문법 검사 — new Function 은 모듈 문법을 못 받으므로 export 를 떼고 본다
  const body = src.replace(/export default[\s\S]*$/, '').replace(/^export /gm, '');
  assert.doesNotThrow(() => new Function(body));
});
