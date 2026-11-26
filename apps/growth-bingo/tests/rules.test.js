/* 규칙 시나리오 테스트 — spec 15절 A-2(31개)·A-3.
   실행: node tests/rules.test.js   (의존성 없음, assert 내장 모듈만 사용) */
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

var OWNER = { id: 'me', role: 'owner' };
var VERIFIER = { id: 'family', role: 'verifier' };
var seq = 0;

/* [칸 id, 일차, 상태?] 목록으로 core를 만든다. 상태 기본값은 확정(confirmed). */
function mk(list) {
  var stickers = list.map(function (x) {
    seq++;
    return { id: 'x' + seq, cell: x[0], day: x[1], date: null, status: x[2] || 'confirmed', claimedBy: 'me' };
  });
  return { startDate: '2026-12-01', seq: seq, stickers: stickers };
}
function claimReason(core, cell, day, today) {
  var r = rules.canClaim(board, core, { cell: cell, day: day, today: today === undefined ? day : today, actor: OWNER });
  return r.ok ? 'ok' : r.reason;
}
function eq(actual, expected, msg) { assert.strictEqual(actual, expected, msg); }

console.log('A-2 canClaim 시나리오');
check('1. 하루 4개 뒤 AI 칸 하나 더 → DAILY_CAP', function () {
  var core = mk([['E-READ-A', 3], ['E-LISTEN-A', 3], ['F-PUSH', 3], ['A-AUTO', 3]]);
  eq(claimReason(core, 'A-MYAPP', 3), 'DAILY_CAP');
});
check('2. 영어 2개 뒤 영어 세 번째 → AREA_CAP', function () {
  var core = mk([['E-READ-A', 3], ['E-LISTEN-A', 3]]);
  eq(claimReason(core, 'E-SHADOW', 3), 'AREA_CAP');
});
check('3. 영어 2 + 체력 1 뒤 가족 보고회 → ok (가족 칸은 영역 상한 없음)', function () {
  var core = mk([['E-READ-A', 3], ['E-LISTEN-A', 3], ['F-PUSH', 3]]);
  eq(claimReason(core, 'G-FAMILY', 3), 'ok');
});
check('4. 같은 칸 하루 두 번 → SAME_CELL_SAME_DAY', function () {
  eq(claimReason(mk([['E-READ-A', 3]]), 'E-READ-A', 3), 'SAME_CELL_SAME_DAY');
});
check('5. E-LV1 확정 1개 뒤 E-LV2 → LEVEL_LOCKED', function () {
  eq(claimReason(mk([['E-LV1', 1]]), 'E-LV2', 2), 'LEVEL_LOCKED');
});
check('6. E-LV1 확정 1 + 확인 대기 1 뒤 E-LV2 → LEVEL_LOCKED (대기는 안 센다)', function () {
  eq(claimReason(mk([['E-LV1', 1], ['E-LV1', 2, 'pending']]), 'E-LV2', 3), 'LEVEL_LOCKED');
});
check('7. E-LV1 확정 2(둘째가 4일차) 뒤 4일차 E-LV2 → LADDER_DAILY', function () {
  eq(claimReason(mk([['E-LV1', 3], ['E-LV1', 4]]), 'E-LV2', 4), 'LADDER_DAILY');
});
check('8. 위와 같은 상태에서 5일차 E-LV2 → ok', function () {
  eq(claimReason(mk([['E-LV1', 3], ['E-LV1', 4]]), 'E-LV2', 5), 'ok');
});
check('9. 아무것도 없을 때 A-LV3 → LEVEL_LOCKED (건너뛰기)', function () {
  eq(claimReason(mk([]), 'A-LV3', 3), 'LEVEL_LOCKED');
});
check('10. 3일차 F-LV1 → 4일차 F-LV1: PART_CONSECUTIVE', function () {
  eq(claimReason(mk([['F-LV1', 3]]), 'F-LV1', 4), 'PART_CONSECUTIVE');
});
check('11. 3일차 F-LV1 → 4일차 F-DB: PART_CONSECUTIVE (당기기 겹침)', function () {
  eq(claimReason(mk([['F-LV1', 3]]), 'F-DB', 4), 'PART_CONSECUTIVE');
});
check('12. 3일차 F-LV1 → 4일차 F-LEGS: ok', function () {
  eq(claimReason(mk([['F-LV1', 3]]), 'F-LEGS', 4), 'ok');
});
check('13. 3일차 F-LV1 → 3일차 F-LEGS: STRENGTH_DAILY', function () {
  eq(claimReason(mk([['F-LV1', 3]]), 'F-LEGS', 3), 'STRENGTH_DAILY');
});
check('14. 3일차 F-LV1 → 5일차 F-LV1: ok', function () {
  eq(claimReason(mk([['F-LV1', 3]]), 'F-LV1', 5), 'ok');
});
check('15. 5일차 F-PUSH(오늘 5일차) → "어제"(4일차)로 F-DB: PART_CONSECUTIVE (다음 날과 겹침)', function () {
  eq(claimReason(mk([['F-PUSH', 5]]), 'F-DB', 4, 5), 'PART_CONSECUTIVE');
});
check('16. 3일차 F-RUN → 4일차 F-TRAIL: IMPACT_CONSECUTIVE', function () {
  eq(claimReason(mk([['F-RUN', 3]]), 'F-TRAIL', 4), 'IMPACT_CONSECUTIVE');
});
check('17. 3일차 F-RUN → 3일차 F-TRAIL: IMPACT_DAILY', function () {
  eq(claimReason(mk([['F-RUN', 3]]), 'F-TRAIL', 3), 'IMPACT_DAILY');
});
check('18. 3일차 F-RUN → 3일차 F-SWIM: ok (수영은 충격 칸이 아님)', function () {
  eq(claimReason(mk([['F-RUN', 3]]), 'F-SWIM', 3), 'ok');
});
check('19. 3일차 F-SWIM → 3일차 F-REST: REST_CONFLICT', function () {
  eq(claimReason(mk([['F-SWIM', 3]]), 'F-REST', 3), 'REST_CONFLICT');
});
check('20. 3일차 F-REST → 3일차 F-PUSH: REST_CONFLICT', function () {
  eq(claimReason(mk([['F-REST', 3]]), 'F-PUSH', 3), 'REST_CONFLICT');
});
check('21. 3일차 F-REST → 3일차 F-STRETCH: ok', function () {
  eq(claimReason(mk([['F-REST', 3]]), 'F-STRETCH', 3), 'ok');
});
check('22. 3일차 F-REST → 6일차 F-REST: WEEKLY_USED', function () {
  eq(claimReason(mk([['F-REST', 3]]), 'F-REST', 6), 'WEEKLY_USED');
});
check('23. 7일차 F-REST → 8일차 F-REST: ok (주가 바뀜)', function () {
  eq(claimReason(mk([['F-REST', 7]]), 'F-REST', 8), 'ok');
});
check('24. E-W1: 10일차 ok / 11일차 OUT_OF_WINDOW', function () {
  eq(claimReason(mk([]), 'E-W1', 10), 'ok');
  eq(claimReason(mk([]), 'E-W1', 11), 'OUT_OF_WINDOW');
});
check('25. F-W3: 14일차 OUT_OF_WINDOW / 15 ok / 24 ok / 25 OUT_OF_WINDOW', function () {
  eq(claimReason(mk([]), 'F-W3', 14), 'OUT_OF_WINDOW');
  eq(claimReason(mk([]), 'F-W3', 15), 'ok');
  eq(claimReason(mk([]), 'F-W3', 24), 'ok');
  eq(claimReason(mk([]), 'F-W3', 25), 'OUT_OF_WINDOW');
});
check('26. E-W5: 28일차 OUT_OF_WINDOW / 29 ok / 35 ok', function () {
  eq(claimReason(mk([]), 'E-W5', 28), 'OUT_OF_WINDOW');
  eq(claimReason(mk([]), 'E-W5', 29), 'ok');
  eq(claimReason(mk([]), 'E-W5', 35), 'ok');
});
check('27. 오늘 5일차에 day=3으로 기록 → BAD_DAY', function () {
  eq(claimReason(mk([]), 'E-READ-A', 3, 5), 'BAD_DAY');
});
check('28. 오늘 36일차 → SEASON_OVER', function () {
  eq(claimReason(mk([]), 'E-READ-A', 35, 36), 'SEASON_OVER');
});
check('29. 시작일이 내일(오늘 0일차) → NOT_STARTED', function () {
  eq(claimReason(mk([]), 'E-READ-A', 1, rules.dayNumber('2026-12-02', '2026-12-01')), 'NOT_STARTED');
});
check('30. 8일차 스티커가 있는데 오늘 5일차 → CLOCK_SUSPECT', function () {
  eq(claimReason(mk([['E-READ-A', 8]]), 'E-SHADOW', 5), 'CLOCK_SUSPECT');
});
check('31. E-READ-A 확정 3 + 대기 1 (네모 4) → CELL_FULL', function () {
  var core = mk([['E-READ-A', 1], ['E-READ-A', 2], ['E-READ-A', 3], ['E-READ-A', 4, 'pending']]);
  eq(claimReason(core, 'E-READ-A', 5), 'CELL_FULL');
});

console.log('A-2 보충');
check('본인 역할이 아니면 NOT_OWNER (검사 순서 1번)', function () {
  var r = rules.canClaim(board, mk([]), { cell: 'E-READ-A', day: 1, today: 1, actor: VERIFIER });
  assert.deepStrictEqual([r.ok, r.reason], [false, 'NOT_OWNER']);
});
check('"어제 한 일"(day = today-1)은 허용, 1일차에는 어제가 없다', function () {
  eq(claimReason(mk([]), 'E-READ-A', 4, 5), 'ok');
  eq(claimReason(mk([]), 'E-READ-A', 0, 1), 'BAD_DAY');
});
check('LEVEL_LOCKED 상세: 아래 레벨의 확정·대기 수를 돌려준다', function () {
  var r = rules.canClaim(board, mk([['E-LV1', 1], ['E-LV1', 2, 'pending']]), { cell: 'E-LV2', day: 3, today: 3, actor: OWNER });
  assert.deepStrictEqual([r.detail.lower, r.detail.confirmed, r.detail.pending, r.detail.boxes], ['E-LV1', 1, 1, 2]);
});

console.log('A-3 상태 전이');
check('대기 스티커: 4일차에 confirm 성공, 5일차에는 실패, expirePending이 지운다', function () {
  var core = mk([['E-READ-A', 3, 'pending']]);
  var id = core.stickers[0].id;
  assert.strictEqual(rules.confirm(board, core, { stickerId: id, today: 4, actor: VERIFIER, at: 't' }).ok, true);
  var late = rules.confirm(board, core, { stickerId: id, today: 5, actor: VERIFIER });
  assert.deepStrictEqual([late.ok, late.reason], [false, 'STAMP_EXPIRED']);
  var ex = rules.expirePending(board, core, 5);
  assert.strictEqual(ex.expired.length, 1);
  assert.strictEqual(ex.core.stickers.length, 0);
  assert.strictEqual(rules.expirePending(board, core, 4).expired.length, 0);
});
check('confirm·revoke(·reject)에 owner 역할을 넣으면 거부된다', function () {
  var core = mk([['E-READ-A', 3, 'pending'], ['E-SHADOW', 3, 'confirmed']]);
  assert.strictEqual(rules.confirm(board, core, { stickerId: core.stickers[0].id, today: 3, actor: OWNER }).reason, 'NOT_VERIFIER');
  assert.strictEqual(rules.revoke(board, core, { stickerId: core.stickers[1].id, today: 3, actor: OWNER }).reason, 'NOT_VERIFIER');
  assert.strictEqual(rules.reject(board, core, { stickerId: core.stickers[0].id, today: 3, actor: OWNER }).reason, 'NOT_VERIFIER');
});
check('verifier는 claim·cancelOwn을 못 한다', function () {
  var core = mk([['E-READ-A', 3, 'pending']]);
  assert.strictEqual(rules.cancelOwn(board, core, { stickerId: core.stickers[0].id, actor: VERIFIER }).reason, 'NOT_OWNER');
});
check('확인 대기만으로 한 줄을 채워도 bingoCount는 0, 모두 확정하면 1', function () {
  var line = board.lines[0]; // 가로 1
  var list = [];
  line.cells.forEach(function (id) {
    var cell = rules.getCell(board, id), i;
    for (i = 0; i < cell.boxes; i++) list.push([id, 1 + i, 'pending']);
  });
  assert.strictEqual(rules.bingoCount(board, mk(list)), 0);
  list.forEach(function (x) { x[2] = 'confirmed'; });
  var full = mk(list);
  assert.strictEqual(rules.bingoCount(board, full), 1);
  /* 확정 스티커를 revoke하면 줄 수가 줄어든다 (가족 모드의 취소) */
  var target = full.stickers.filter(function (s) { return s.cell === 'E-LISTEN-B'; })[0];
  var rv = rules.revoke(board, full, { stickerId: target.id, today: 35, actor: VERIFIER });
  assert.strictEqual(rv.ok, true);
  assert.strictEqual(rules.bingoCount(board, rv.core), 0);
});
check('E-LV2에 스티커가 있으면 E-LV1 revoke는 HIGHER_LEVEL_EXISTS, E-LV2를 먼저 지우면 된다', function () {
  var core = mk([['E-LV1', 1], ['E-LV1', 2], ['E-LV2', 3, 'pending']]);
  var lv1 = core.stickers[0], lv2 = core.stickers[2];
  var r = rules.revoke(board, core, { stickerId: lv1.id, today: 3, actor: VERIFIER });
  assert.deepStrictEqual([r.ok, r.reason], [false, 'HIGHER_LEVEL_EXISTS']);
  var rj = rules.reject(board, core, { stickerId: lv2.id, today: 3, actor: VERIFIER });
  assert.strictEqual(rj.ok, true);
  assert.strictEqual(rules.revoke(board, rj.core, { stickerId: lv1.id, today: 3, actor: VERIFIER }).ok, true);
});
check('모든 전이 함수가 입력 core를 바꾸지 않는다 (호출 전후 깊은 비교)', function () {
  var core = mk([['E-READ-A', 3, 'pending'], ['E-LV1', 3, 'confirmed'], ['E-SHADOW', 1, 'pending']]);
  var snap = JSON.stringify(core);
  rules.claim(board, core, { cell: 'A-AUTO', day: 3, today: 3, actor: OWNER, at: 't' });
  rules.confirm(board, core, { stickerId: core.stickers[0].id, today: 3, actor: VERIFIER });
  rules.reject(board, core, { stickerId: core.stickers[0].id, today: 3, actor: VERIFIER });
  rules.revoke(board, core, { stickerId: core.stickers[1].id, today: 3, actor: VERIFIER });
  rules.cancelOwn(board, core, { stickerId: core.stickers[0].id, actor: OWNER });
  rules.expirePending(board, core, 30);
  rules.lineStatus(board, core); rules.bingoCount(board, core);
  guide.plan(board, core, { today: 3, mode: 'fewest' });
  assert.strictEqual(JSON.stringify(core), snap);
});
check('claim은 새 core를 돌려주고 id·일차·날짜·상태가 맞다', function () {
  var core = { startDate: '2026-12-01', seq: 7, stickers: [] };
  var r = rules.claim(board, core, { cell: 'E-READ-A', day: 3, today: 4, actor: OWNER, at: '2026-12-04T09:00:00+09:00' });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual([r.sticker.id, r.sticker.day, r.sticker.date, r.sticker.status], ['s8', 3, '2026-12-03', 'pending']);
  assert.strictEqual(core.stickers.length, 0);
  assert.strictEqual(r.core.seq, 8);
});

console.log('A-3 죽은 칸과 길잡이');
check('11일차에 E-W1이 비어 있으면 죽은 칸이고, 길잡이 조합에 가로7·세로4가 들어가지 않는다', function () {
  var core = mk([]);
  assert.strictEqual(rules.isCellDead(board, core, 'E-W1', 11), true);
  assert.strictEqual(rules.isCellDead(board, core, 'E-W1', 10), false);
  var p = guide.plan(board, core, { today: 11, mode: 'fewest' });
  assert.strictEqual(p.status, 'ok');
  assert.strictEqual(p.lines.indexOf('r7'), -1);
  assert.strictEqual(p.lines.indexOf('c4'), -1);
  assert.strictEqual(p.cells.indexOf('E-W1'), -1);
});
check('주 1회 칸: 가족 보고회를 1·2주차에 건너뛰고 15일차가 되면 죽은 칸 (남은 주 3 < 필요 4)', function () {
  assert.strictEqual(rules.isCellDead(board, mk([]), 'G-FAMILY', 14), false);
  assert.strictEqual(rules.isCellDead(board, mk([]), 'G-FAMILY', 15), true);
});
check('주차 고정 칸은 기간이 끝나면 죽고, 이미 채웠으면 죽지 않는다', function () {
  assert.strictEqual(rules.isCellDead(board, mk([['F-W3', 15]]), 'F-W3', 30), false);
  assert.strictEqual(rules.isCellDead(board, mk([]), 'F-W3', 25), true);
});
check('사다리 아래 레벨이 죽으면 위 레벨도 죽는다 (턱걸이는 하루 걸러라 남은 날이 두 배 필요)', function () {
  /* 34일차: 턱걸이 LV1~LV3를 모두 하려면 6개 → 하루 걸러 11일 필요, 남은 날 2 */
  assert.strictEqual(rules.isCellDead(board, mk([]), 'F-LV3', 34), true);
  assert.strictEqual(rules.isCellDead(board, mk([]), 'F-LV1', 1), false);
});
check('길잡이: 확인 대기는 남은 스티커에서 빠지고, 같은 상태에서는 같은 조합이 나온다', function () {
  var core = mk([['E-READ-A', 1, 'pending'], ['A-FOLLOW', 1, 'confirmed']]);
  var a = guide.plan(board, core, { today: 2, mode: 'fewest' });
  var b = guide.plan(board, core, { today: 2, mode: 'fewest' });
  assert.deepStrictEqual(a.lines, b.lines);
  assert.strictEqual(a.remaining, 84);
});
check('"가장 빨리"의 예상 완료일은 "가장 적게"와 같거나 빠르다', function () {
  var core = mk([['E-READ-A', 1], ['A-FOLLOW', 1], ['F-PUSH', 1]]);
  var both = guide.planBoth(board, core, { today: 2 });
  assert(both.fastest.finishBase <= both.fewest.finishBase);
});
check('이미 7줄을 달성하면 길잡이는 status "done"', function () {
  var list = [];
  board.cells.forEach(function (c) { var i; for (i = 0; i < c.boxes; i++) list.push([c.id, 1 + i]); });
  var p = guide.plan(board, mk(list), { today: 35, mode: 'fewest' });
  assert.strictEqual(p.status, 'done');
});
check('7빙고가 불가능해지면 최대 줄 수로 바꿔 알린다', function () {
  /* 36일차 직전까지 아무것도 안 한 상태: 남은 날 1일로는 어떤 7줄도 못 채운다 */
  var p = guide.plan(board, mk([]), { today: 35, mode: 'fewest' });
  assert.strictEqual(p.status, 'impossible');
  assert(p.maxLines < 7);
});
check('estimateFinish 손 계산 대조: 새 판 가로1·2·3 + 세로2·3·4 + 대각 ↙ → 기본 29일차', function () {
  /* 이 조합에는 5주차 고정 칸이 들어 있어 시작 일차 29가 하한이다. 나머지 하한은 모두 그보다 작다:
     가족 보고회 4개는 (1+4-2)*7+1 = 22, 턱걸이 사다리 9개는 1+2*(9-1) = 17,
     영역별 남은 수 최댓값은 29 이하라 1+29-1 = 29 이하. 따라서 최댓값은 29. */
  var d = guide.estimateFinish(board, mk([]), ['r1', 'r2', 'r3', 'c2', 'c3', 'c4', 'd2'], 1, 'base');
  assert.strictEqual(d, 29);
  /* 같은 조합을 15일차에 3개를 채운 뒤 보면 5주차 고정 칸 때문에 여전히 29 아래로 내려가지 않는다. */
  var d2 = guide.estimateFinish(board, mk([['E-READ-A', 14], ['A-FOLLOW', 14]]), ['r1', 'r2', 'r3', 'c2', 'c3', 'c4', 'd2'], 15, 'base');
  assert(d2 >= 29);
});
check('날짜: 일차 계산은 로컬 연·월·일만 쓴다 (서머타임 전환 주에도 하루씩)', function () {
  assert.strictEqual(rules.dayNumber('2026-03-01', '2026-03-01'), 1);
  /* 미국 서머타임 시작일(2026-03-08)과 한국/유럽 전환일을 지나도 하루씩 오른다. */
  var d, prev = 0;
  for (d = 1; d <= 35; d++) {
    var s = rules.dateOfDay('2026-03-01', d);
    var n = rules.dayNumber('2026-03-01', s);
    assert.strictEqual(n, d);
    assert.strictEqual(n - prev, 1);
    prev = n;
  }
  assert.strictEqual(rules.dateOfDay('2026-03-01', 35), '2026-04-04');
  assert.strictEqual(rules.dateOfDay('2026-12-20', 14), '2027-01-02'); // 해가 바뀐다
  assert.strictEqual(rules.dateOfDay('2028-02-27', 3), '2028-02-29'); // 윤년
  assert.strictEqual(rules.dayNumber('2026-12-02', '2026-12-01'), 0);
  assert.strictEqual(rules.weekOf(1), 1); assert.strictEqual(rules.weekOf(7), 1);
  assert.strictEqual(rules.weekOf(8), 2); assert.strictEqual(rules.weekOf(35), 5);
});
check('streak: 확정 스티커가 있는 날이 이어진 길이 (오늘 아직 안 했어도 어제까지 이어진 기록은 유지)', function () {
  var core = mk([['E-READ-A', 1], ['E-READ-A', 2], ['E-READ-A', 4], ['E-READ-A', 5], ['E-READ-A', 6, 'pending']]);
  assert.deepStrictEqual(rules.streak(board, core, 5), { current: 2, longest: 2 });
  assert.deepStrictEqual(rules.streak(board, core, 6), { current: 2, longest: 2 });
  assert.deepStrictEqual(rules.streak(board, core, 9), { current: 0, longest: 2 });
});

console.log('J 구조: 순수 파일에 금지 항목이 없다');
check('board-data.js·rules.js·guide.js에 document·localStorage·Date.now·new Date(·Math.random이 없다', function () {
  var fs = require('fs'), path = require('path');
  ['board-data.js', 'rules.js', 'guide.js'].forEach(function (f) {
    var src = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // 주석은 제외
    ['document', 'localStorage', 'Date.now', 'new Date(', 'Math.random'].forEach(function (bad) {
      assert.strictEqual(src.indexOf(bad), -1, f + '에 ' + bad);
    });
  });
});
check('rules.js와 guide.js에 칸 id 문자열이 박혀 있지 않다', function () {
  var fs = require('fs'), path = require('path');
  ['rules.js', 'guide.js'].forEach(function (f) {
    var src = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
    board.cells.forEach(function (c) {
      assert.strictEqual(src.indexOf("'" + c.id + "'"), -1, f + '에 ' + c.id);
      assert.strictEqual(src.indexOf('"' + c.id + '"'), -1, f + '에 ' + c.id);
    });
  });
});

console.log('\n' + passed + '개 통과' + (process.exitCode ? ', 실패 있음' : ''));
