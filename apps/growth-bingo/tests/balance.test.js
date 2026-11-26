/* 균형 재현 테스트 — spec 3-4절·15절 A-1의 숫자가 판 데이터에서 그대로 나오는지 본다.
   실행: node tests/balance.test.js   (의존성 없음, assert 내장 모듈만 사용)
   숫자가 다르면 판 데이터(board-data.js)를 잘못 옮겼거나 네모 수를 손댄 것이다. */
'use strict';
var assert = require('assert');
var board = require('../js/board-data.js');
var rules = require('../js/rules.js');
var guide = require('../js/guide.js');

var passed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.log('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; }
}

var byId = {};
board.cells.forEach(function (c) { byId[c.id] = c; });
var emptyCore = { startDate: '2026-12-01', seq: 0, stickers: [] };

function median(sortedArr) { return sortedArr[Math.floor(sortedArr.length / 2)]; }
function sum(ids, filter) {
  return ids.reduce(function (a, id) { return a + ((!filter || filter(byId[id])) ? byId[id].boxes : 0); }, 0);
}

console.log('판 데이터');
check('자체 검사 통과, 49칸', function () {
  assert.strictEqual(board.selfCheck.ok, true, board.selfCheck.errors.join(' / '));
  assert.strictEqual(board.cells.length, 49);
});
check('칸 종류: 반복 25 · 레벨 14 · 주차 고정 7 · 1회 3', function () {
  var k = {};
  board.cells.forEach(function (c) { k[c.kind] = (k[c.kind] || 0) + 1; });
  assert.deepStrictEqual(k, { repeat: 25, level: 14, fixed: 7, once: 3 });
});
check('칸 수 영어 16 · 체력 16 · AI 16 · 가족 1', function () {
  var n = {};
  board.cells.forEach(function (c) { n[c.area] = (n[c.area] || 0) + 1; });
  assert.deepStrictEqual(n, { en: 16, fit: 16, ai: 16, family: 1 });
});
check('스티커 수 영어 39 · 체력 39 · AI 38 · 가족 4 · 전체 120', function () {
  var s = { en: 0, fit: 0, ai: 0, family: 0 }, total = 0;
  board.cells.forEach(function (c) { s[c.area] += c.boxes; total += c.boxes; });
  assert.deepStrictEqual(s, { en: 39, fit: 39, ai: 38, family: 4 });
  assert.strictEqual(total, 120);
});
check('가운데(4-4)가 가족 칸', function () {
  var m = board.cells.filter(function (c) { return c.row === 4 && c.col === 4; })[0];
  assert.strictEqual(m.id, 'G-FAMILY');
});

console.log('16줄 분포 (3-4절 조건 1 표)');
/* 가로1~7, 세로1~7, 대각 ↘, 대각 ↙ 순서. [영, 체, AI, 가족, 줄 스티커, 줄 밖 사다리 선행]
   spec 표의 "줄 스티커"는 줄 안의 칸만 센 값이라, 선행을 더한 필요량은 둘을 합친 값이다. */
var LINE_TABLE = [
  [2, 3, 2, 0, 16, 12], [2, 2, 3, 0, 20, 3], [3, 2, 2, 0, 16, 8], [2, 2, 2, 1, 16, 7],
  [2, 2, 3, 0, 17, 8], [2, 3, 2, 0, 18, 0], [3, 2, 2, 0, 17, 10],
  [2, 2, 3, 0, 18, 10], [3, 2, 2, 0, 16, 2], [2, 2, 3, 0, 17, 10], [2, 2, 2, 1, 19, 0],
  [2, 3, 2, 0, 16, 6], [3, 2, 2, 0, 17, 7], [2, 3, 2, 0, 17, 8],
  [2, 2, 2, 1, 23, 8], [2, 2, 2, 1, 23, 0]
];
check('16줄 모두 세 영역 2칸 이상, 영역 분포가 표와 같다', function () {
  assert.strictEqual(board.lines.length, 16);
  board.lines.forEach(function (line, i) {
    var n = { en: 0, fit: 0, ai: 0, family: 0 };
    line.cells.forEach(function (id) { n[byId[id].area]++; });
    var exp = LINE_TABLE[i];
    assert.deepStrictEqual([n.en, n.fit, n.ai, n.family], exp.slice(0, 4), line.label);
    assert(n.en >= 2 && n.fit >= 2 && n.ai >= 2, line.label);
  });
});
check('줄 스티커와 줄 밖 사다리 선행이 표와 같다', function () {
  var st = rules.lineStatus(board, emptyCore);
  st.forEach(function (ls, i) {
    assert.strictEqual(ls.remaining, LINE_TABLE[i][4] + LINE_TABLE[i][5], board.lines[i].label + ' 줄 스티커(선행 포함)');
    assert.strictEqual(ls.hiddenPrereq, LINE_TABLE[i][5], board.lines[i].label + ' 줄 밖 선행');
  });
});
check('주차 고정 칸 7개는 가로줄마다 1개, 세로줄마다 1개, 대각선에는 없다', function () {
  board.lines.forEach(function (line) {
    var n = line.cells.filter(function (id) { return byId[id].kind === 'fixed'; }).length;
    assert.strictEqual(n, line.type === 'diag' ? 0 : 1, line.label);
  });
});

console.log('11,440 조합 (3-4절 조건 2)');
var combos = guide.allCombos(board, 7);
var totals = [], areaTotals = { en: [], fit: [], ai: [] };
combos.forEach(function (cb) {
  totals.push(sum(cb.cells));
  ['en', 'fit', 'ai'].forEach(function (a) {
    areaTotals[a].push(sum(cb.cells, function (c) { return c.area === a; }));
  });
});
function asc(a, b) { return a - b; }
var sorted = totals.slice().sort(asc);

check('조합 수 11,440', function () { assert.strictEqual(combos.length, 11440); });
check('스티커 수(선행 포함): 최소 86 · 중앙 96 · 최대 120', function () {
  assert.strictEqual(sorted[0], 86);
  assert.strictEqual(median(sorted), 96);
  assert.strictEqual(sorted[sorted.length - 1], 120);
});
check('평균 96.6', function () {
  var mean = totals.reduce(function (a, b) { return a + b; }, 0) / totals.length;
  assert.strictEqual(mean.toFixed(1), '96.6');
});
check('85~105 안 11,245개 · 105 초과 195개 · 85 미만 0개', function () {
  var inside = totals.filter(function (v) { return v >= 85 && v <= 105; }).length;
  assert.strictEqual(inside, 11245);
  assert.strictEqual(totals.filter(function (v) { return v > 105; }).length, 195);
  assert.strictEqual(totals.filter(function (v) { return v < 85; }).length, 0);
});
check('분위: 1% 89 · 5% 91 · 25% 94 · 50% 96 · 75% 99 · 95% 103 · 99% 107', function () {
  var q = function (p) { return sorted[Math.floor(sorted.length * p)]; };
  assert.deepStrictEqual([q(0.01), q(0.05), q(0.25), q(0.5), q(0.75), q(0.95), q(0.99)], [89, 91, 94, 96, 99, 103, 107]);
});
check('영역별 최소/중앙/최대: 영어 21/31/39 · 체력 21/32/39 · AI 20/30/38', function () {
  var want = { en: [21, 31, 39], fit: [21, 32, 39], ai: [20, 30, 38] };
  Object.keys(want).forEach(function (a) {
    var s = areaTotals[a].slice().sort(asc);
    assert.deepStrictEqual([s[0], median(s), s[s.length - 1]], want[a], a);
  });
});
check('최소 86 조합은 7개, 88 이하는 109개, 최대 120은 2개', function () {
  assert.strictEqual(totals.filter(function (v) { return v === 86; }).length, 7);
  assert.strictEqual(totals.filter(function (v) { return v <= 88; }).length, 109);
  assert.strictEqual(totals.filter(function (v) { return v === 120; }).length, 2);
});
check('최소 86 조합 중에 "가로1·2·3 + 세로2·3·4 + 대각 ↙"가 있다', function () {
  var want = 'r1,r2,r3,c2,c3,c4,d2';
  var hit = combos.filter(function (cb, i) { return totals[i] === 86 && cb.lines.join(',') === want; });
  assert.strictEqual(hit.length, 1);
});
check('어떤 조합이든 영역마다 스티커 20개 이상 (한 영역을 건너뛰는 7빙고는 없다)', function () {
  ['en', 'fit', 'ai'].forEach(function (a) { assert(Math.min.apply(null, areaTotals[a]) >= 20, a); });
});
check('필요한 칸 수: 최소 35 · 중앙 39', function () {
  var cnt = combos.map(function (cb) { return cb.cells.length; }).sort(asc);
  assert.strictEqual(cnt[0], 35);
  assert.strictEqual(median(cnt), 39);
});
check('턱걸이 LV1은 모든 조합에, 프로젝트 LV1은 11,440개 중 11,439개에 들어간다', function () {
  /* spec은 둘 다 100%라고 적었지만 실제로는 AI 사다리 칸이 하나도 없는 조합이 1개 있다. */
  assert.strictEqual(combos.filter(function (cb) { return cb.cells.indexOf('F-LV1') >= 0; }).length, 11440);
  assert.strictEqual(combos.filter(function (cb) { return cb.cells.indexOf('A-LV1') >= 0; }).length, 11439);
});
check('가족 칸은 조합의 93.1%에 들어간다', function () {
  var n = combos.filter(function (cb) { return cb.cells.indexOf('G-FAMILY') >= 0; }).length;
  assert.strictEqual((n / combos.length * 100).toFixed(1), '93.1');
});

console.log('길잡이 (새 판)');
check('guide가 고른 조합의 남은 스티커가 86', function () {
  var p = guide.plan(board, emptyCore, { today: 1, mode: 'fewest' });
  assert.strictEqual(p.status, 'ok');
  assert.strictEqual(p.remaining, 86);
  assert.strictEqual(p.lines.join(','), 'r1,r2,r3,c2,c3,c4,d2');
  assert.strictEqual(p.feasible, 11440);
});
check('estimateFinish의 최솟값: 기본 속도 29 · 상한 속도 23', function () {
  assert.strictEqual(guide.minFinish(board, emptyCore, 1, 'base'), 29);
  assert.strictEqual(guide.minFinish(board, emptyCore, 1, 'cap'), 23);
});
check('가장 적게 / 가장 빨리 모두 기본 속도 29일차에 끝나는 조합을 고른다', function () {
  assert.strictEqual(guide.plan(board, emptyCore, { today: 1, mode: 'fewest' }).finishBase, 29);
  assert.strictEqual(guide.plan(board, emptyCore, { today: 1, mode: 'fastest' }).finishBase, 29);
});
check('스티커 최소(86) 조합 7개의 기본 속도 완료일은 29·29·29·29·30·30·31', function () {
  var ds = [];
  combos.forEach(function (cb, i) {
    if (totals[i] === 86) ds.push(guide.estimateFinish(board, emptyCore, cb.lines, 1, 'base'));
  });
  assert.deepStrictEqual(ds.sort(asc), [29, 29, 29, 29, 30, 30, 31]);
});
check('기본 속도 완료일 분포: 31일차 이내 1,491개 · 35일 안 9,855개', function () {
  var ds = combos.map(function (cb) { return guide.estimateFinish(board, emptyCore, cb.lines, 1, 'base'); });
  assert.strictEqual(ds.filter(function (d) { return d <= 31; }).length, 1491);
  assert.strictEqual(ds.filter(function (d) { return d <= 35; }).length, 9855);
});
check('상한 속도: 22일차 이전에 끝나는 조합은 없고 23일차가 최소', function () {
  /* spec 3-4절의 "23일차 4개"는 일정을 실제로 짠 값이다. estimateFinish는 하한이라
     상한 속도에서 조금 낙관적일 수 있어(spec 6-2절) 개수는 같지 않다. 최솟값만 본다. */
  var ds = combos.map(function (cb) { return guide.estimateFinish(board, emptyCore, cb.lines, 1, 'cap'); });
  assert.strictEqual(Math.min.apply(null, ds), 23);
  assert.strictEqual(ds.filter(function (d) { return d < 23; }).length, 0);
});

console.log('\n' + passed + '개 통과' + (process.exitCode ? ', 실패 있음' : ''));
