/* ============================================================
   성장 빙고 — 길잡이 (순수 함수)

   16줄 중 7줄을 고르는 11,440가지 조합을 전부 계산해
   "지금 가장 가까운 7줄"과 예상 완료일을 돌려준다.
   전수 계산이 가장 단순하고 틀릴 곳이 적어서 가지치기·캐시는 넣지 않았다
   (조합표만 판마다 한 번 만들어 둔다).

   DOM, localStorage, 시계, 난수를 쓰지 않는다. 오늘 일차는 인자로 받는다.
   ============================================================ */
(function () {
  'use strict';

  var GB = (typeof window !== 'undefined')
    ? (window.GrowthBingo = window.GrowthBingo || {})
    : {};
  var rules = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./rules.js')
    : GB.rules;

  var AREAS = ['en', 'fit', 'ai'];

  /* ── 조합표 ──────────────────────────────────────────
     판마다 k줄 조합을 한 번만 만든다. cells는 (조합 수 × 칸 수)의 0/1 표이고,
     줄의 칸 합집합에 사다리 선행 레벨을 더한 것이다.
     줄 하나만 보면 놓치는 "줄 밖 선행"이 스티커 수에 들어가야 하기 때문이다. */
  var tableCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function boardInfo(board) {
    var idx = {};
    board.cells.forEach(function (c, i) { idx[c.id] = i; });
    var lineMasks = board.lines.map(function (line) { return line.cells.map(function (id) { return idx[id]; }); });
    var ladderIdx = {};
    Object.keys(board.ladders).forEach(function (l) { ladderIdx[l] = board.ladders[l].map(function (id) { return idx[id]; }); });
    return { idx: idx, lineMasks: lineMasks, ladderIdx: ladderIdx, n: board.cells.length };
  }

  function getTable(board, k) {
    var perBoard = tableCache && tableCache.get(board);
    if (!perBoard) { perBoard = { info: boardInfo(board), byK: {} }; if (tableCache) tableCache.set(board, perBoard); }
    if (perBoard.byK[k]) return perBoard.byK[k];

    var info = perBoard.info;
    var L = board.lines.length;
    var combos = [];
    (function rec(start, picked) {
      if (picked.length === k) { combos.push(picked.slice()); return; }
      var i;
      for (i = start; i < L; i++) { picked.push(i); rec(i + 1, picked); picked.pop(); }
    })(0, []);

    var cells = new Uint8Array(combos.length * info.n);
    combos.forEach(function (lines, ci) {
      var base = ci * info.n;
      lines.forEach(function (li) { info.lineMasks[li].forEach(function (cidx) { cells[base + cidx] = 1; }); });
      Object.keys(info.ladderIdx).forEach(function (l) {
        var ids = info.ladderIdx[l];
        var top = -1, i;
        for (i = 0; i < ids.length; i++) if (cells[base + ids[i]]) top = i;
        for (i = 0; i < top; i++) cells[base + ids[i]] = 1;
      });
    });
    var table = { k: k, combos: combos, cells: cells, n: info.n };
    perBoard.byK[k] = table;
    return table;
  }

  /* ── 상태에서 한 번 뽑는 값들 ─────────────────────── */
  function recentPace(board, core, today) {
    /* 최근 속도: 지난 7일(시작 후 7일이 안 됐으면 지난 날 전부)의 확정 스티커 / 날 수.
       3일차 이전이거나 0이면 기본 속도(하루 3개)로 대신한다. */
    var DEFAULT = 3;
    if (today <= 3) return DEFAULT;
    var from = Math.max(1, today - 6);
    var n = 0;
    core.stickers.forEach(function (s) { if (s.status === 'confirmed' && s.day >= from && s.day <= today) n++; });
    if (n === 0) return DEFAULT;
    return n / (today - from + 1);
  }

  function makeContext(board, core, today) {
    getTable(board, board.rules.GOAL_LINES); // 칸 번호표(info)를 만들어 둔다
    var info = tableCache.get(board).info;
    var t0 = Math.max(today, 1);
    var prog = rules.progressMap(board, core);
    var usage = rules.todayUsage(board, core, t0);
    /* 오늘 쓸 수 있는 상한이 남아 있지 않으면 내일부터 센다. */
    var t = (today >= 1 && usage.total >= board.rules.DAILY_CAP) ? t0 + 1 : t0;
    var weekT = rules.weekOf(t);

    var cs = board.cells.map(function (c, i) {
      var p = prog[c.id];
      var rem = Math.max(0, c.boxes - p.confirmed - p.pending);
      var weeklyDone = false;
      if (c.weekly) {
        weeklyDone = core.stickers.some(function (s) { return s.cell === c.id && rules.weekOf(s.day) === weekT; });
      }
      return {
        i: i, cell: c, rem: rem, placed: p.confirmed + p.pending,
        area: AREAS.indexOf(c.area), // -1: 가족
        dead: rules.isCellDead(board, core, c.id, today),
        weeklyDone: weeklyDone
      };
    });
    return { board: board, core: core, today: today, t: t, cs: cs, info: info, pace: recentPace(board, core, today) };
  }

  /* ── 예상 완료일 (spec 6-2) ──────────────────────────
     일정을 실제로 짜지 않고 규칙별 하한의 최댓값으로 구한다.
     speed: 'base'(영역마다 하루 1개) | 'cap'(하루 4개·영역 2개) | 'recent'(하루 p개) */
  function estimate(ctx, table, ci, speed) {
    var board = ctx.board, R = board.rules, n = table.n, base = ci * n;
    var t = ctx.t;
    var e = t - 1;
    var total = 0;
    var areaRem = [0, 0, 0];
    var ladderN = {}, ladderStrength = {};
    var S = 0, M = 0;
    var i;
    for (i = 0; i < n; i++) {
      if (!table.cells[base + i]) continue;
      var c = ctx.cs[i];
      if (c.rem <= 0) continue;
      var cell = c.cell;
      total += c.rem;
      if (c.area >= 0) areaRem[c.area] += c.rem;

      var own = t + c.rem - 1;                      // 같은 칸은 하루 1개
      if (cell.weekly) {
        var w0 = rules.weekOf(t) + (c.weeklyDone ? 1 : 0);
        own = Math.max(t, (w0 + c.rem - 2) * 7 + 1); // 주에 1개
      }
      if (cell.window) own = Math.max(own, cell.window.from + c.rem - 1);
      if (own > e) e = own;

      if (cell.ladder) {
        ladderN[cell.ladder] = (ladderN[cell.ladder] || 0) + c.rem;
        if (cell.strength) ladderStrength[cell.ladder] = true;
      }
      if (cell.strength) S += c.rem;
      if (cell.impact) M += c.rem;
    }
    if (total === 0) return t - 1; // 남은 것이 없으면 이미 끝

    Object.keys(ladderN).forEach(function (l) {
      var cnt = ladderN[l];
      var span = ladderStrength[l] ? t + 2 * (cnt - 1) : t + cnt - 1; // 하루 한 계단, 턱걸이는 하루 걸러
      if (span > e) e = span;
    });
    if (S > 0 && t + S - 1 > e) e = t + S - 1;
    if (M > 0 && t + 2 * (M - 1) > e) e = t + 2 * (M - 1);

    var maxArea = Math.max(areaRem[0], areaRem[1], areaRem[2]);
    if (speed === 'cap') {
      var capArea = Math.ceil(maxArea / R.AREA_DAILY_CAP);
      var capAll = Math.ceil(total / R.DAILY_CAP);
      e = Math.max(e, t + capArea - 1, t + capAll - 1);
    } else if (speed === 'recent') {
      e = Math.max(e, t + Math.ceil(total / ctx.pace - 1e-9) - 1);
    } else {
      e = Math.max(e, t + maxArea - 1);
    }
    return e;
  }

  /* ── 길잡이 본체 ───────────────────────────────────── */
  function evaluate(ctx, table, mode) {
    var n = table.n, nCombos = table.combos.length;
    var best = -1, bR = 0, bD = 0, bP = 0;
    var ci, i;
    var feasible = 0;
    for (ci = 0; ci < nCombos; ci++) {
      var base = ci * n, R = 0, placed = 0, dead = false;
      for (i = 0; i < n; i++) {
        if (!table.cells[base + i]) continue;
        var c = ctx.cs[i];
        if (c.dead) { dead = true; break; }
        R += c.rem; placed += c.placed;
      }
      if (dead) continue;
      feasible++;
      var D = estimate(ctx, table, ci, 'base');
      var better;
      if (best < 0) better = true;
      else if (mode === 'fastest') {
        better = D < bD || (D === bD && (R < bR || (R === bR && placed > bP)));
      } else {
        better = R < bR || (R === bR && (D < bD || (D === bD && placed > bP)));
      }
      if (better) { best = ci; bR = R; bD = D; bP = placed; }
    }
    return { index: best, R: bR, D: bD, placed: bP, feasible: feasible };
  }

  function cellIdsOf(board, table, ci) {
    var out = [], base = ci * table.n;
    board.cells.forEach(function (c, i) { if (table.cells[base + i]) out.push(c.id); });
    return out;
  }

  /**
   * 지금 상태에서 가장 가까운 목표 줄 조합.
   * 반환 status: 'ok' | 'impossible'(목표 줄 수는 못 채우지만 maxLines까지는 가능) | 'done'(이미 달성)
   */
  function plan(board, core, opts) {
    opts = opts || {};
    var today = opts.today;
    var mode = opts.mode === 'fastest' ? 'fastest' : 'fewest';
    var goal = board.rules.GOAL_LINES;
    var DAYS = board.rules.DAYS;
    var ctx = makeContext(board, core, today);

    if (rules.bingoCount(board, core) >= goal) {
      /* 달성 뒤에는 길잡이를 끄고 "다음 줄까지 남은 스티커"만 알린다. */
      var next = null;
      rules.lineStatus(board, core).forEach(function (ls) {
        if (ls.complete) return;
        var dead = ls.cells.some(function (id) { return rules.isCellDead(board, core, id, today); });
        if (dead) return;
        if (!next || ls.remaining < next.remaining) next = { lineId: ls.id, remaining: ls.remaining };
      });
      return { status: 'done', mode: mode, next: next };
    }

    var table = getTable(board, goal);
    var r = evaluate(ctx, table, mode);
    if (r.index >= 0) {
      return describe(board, ctx, table, r.index, mode, 'ok', goal, r.feasible, DAYS);
    }
    var k;
    for (k = goal - 1; k >= 1; k--) {
      var tk = getTable(board, k);
      var rk = evaluate(ctx, tk, mode);
      if (rk.index >= 0) return describe(board, ctx, tk, rk.index, mode, 'impossible', k, rk.feasible, DAYS);
    }
    return { status: 'impossible', mode: mode, maxLines: 0, lines: [], cells: [] };
  }

  function describe(board, ctx, table, ci, mode, status, lineCount, feasible, DAYS) {
    var lines = table.combos[ci].map(function (li) { return board.lines[li].id; });
    var cells = cellIdsOf(board, table, ci);
    var R = 0, placed = 0;
    cells.forEach(function (id) { var c = ctx.cs[ctx.info.idx[id]]; R += c.rem; placed += c.placed; });
    var D = estimate(ctx, table, ci, 'base');
    var Dcap = estimate(ctx, table, ci, 'cap');
    var Drecent = estimate(ctx, table, ci, 'recent');
    return {
      status: status, mode: mode, maxLines: lineCount, lines: lines, cells: cells,
      comboIndex: ci, remaining: R, placed: placed, feasible: feasible,
      finishBase: D, finishCap: Dcap, finishRecent: Drecent, pace: ctx.pace,
      late: D > DAYS
    };
  }

  /** 두 기준(가장 적게 / 가장 빨리)을 다 계산해 차이를 알려 준다. */
  function planBoth(board, core, opts) {
    var a = plan(board, core, { today: opts.today, mode: 'fewest' });
    var b = plan(board, core, { today: opts.today, mode: 'fastest' });
    return { fewest: a, fastest: b };
  }

  /** 조합 하나의 예상 완료일을 줄 id 배열로 직접 구한다 (손 계산 대조용). */
  function estimateFinish(board, core, lineIds, today, speed) {
    var ctx = makeContext(board, core, today);
    var info = ctx.info;
    var li = lineIds.map(function (id) { return board.lines.map(function (l) { return l.id; }).indexOf(id); });
    var set = {};
    li.forEach(function (i) { board.lines[i].cells.forEach(function (id) { set[id] = true; }); });
    var all = rules.withPrerequisites(board, Object.keys(set));
    var row = new Uint8Array(info.n);
    Object.keys(all).forEach(function (id) { row[info.idx[id]] = 1; });
    return estimate(ctx, { n: info.n, cells: row }, 0, speed || 'base');
  }

  /** 모든 7줄 조합의 (선행 포함) 칸 id 목록과 줄 id — 균형 검증용 */
  function allCombos(board, k) {
    var table = getTable(board, k || board.rules.GOAL_LINES);
    return table.combos.map(function (lines, ci) {
      return { lines: lines.map(function (li) { return board.lines[li].id; }), cells: cellIdsOf(board, table, ci) };
    });
  }

  /** 모든 조합에 대해 예상 완료일의 최솟값 (균형 검증용) */
  function minFinish(board, core, today, speed) {
    var table = getTable(board, board.rules.GOAL_LINES);
    var ctx = makeContext(board, core, today);
    var min = Infinity, ci;
    for (ci = 0; ci < table.combos.length; ci++) {
      var d = estimate(ctx, table, ci, speed || 'base');
      if (d < min) min = d;
    }
    return min;
  }

  /* ── 오늘 추천 (spec 6-4) ────────────────────────────
     길잡이 조합의 칸 중 오늘 할 수 있는 칸을 정해진 순서로 늘어놓고,
     영역마다 위에서 1개씩 뽑는다. 간격 규칙이 있는 칸을 뒤로 미루면
     막판에 하루 걸러밖에 못 해 날을 버리게 되므로 앞쪽에 둔다. */
  function recommendToday(board, core, pl, day, today) {
    if (!pl || !pl.cells || !pl.cells.length) return [];
    var prog = rules.progressMap(board, core);
    var lastDayOfWeek = day % 7 === 0;
    var order = {};
    board.cells.forEach(function (c, i) { order[c.id] = i; });

    function rank(cell) {
      var p = prog[cell.id];
      var rem = cell.boxes - p.confirmed - p.pending;
      if (cell.weekly && lastDayOfWeek) return [0, 0, order[cell.id]];
      if (cell.window) return [1, cell.window.to, order[cell.id]];
      if (cell.weekly) return [2, 0, order[cell.id]];
      if (cell.ladder) return [3, cell.level, order[cell.id]];
      if (cell.strength || cell.impact) return [4, -rem, order[cell.id]];
      return [5, -rem, order[cell.id]];
    }

    var cands = pl.cells.map(function (id) { return rules.getCell(board, id); }).filter(function (cell) {
      var p = prog[cell.id];
      return cell.boxes - p.confirmed - p.pending > 0;
    });
    cands.sort(function (a, b) {
      var ra = rank(a), rb = rank(b), i;
      for (i = 0; i < 3; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return 0;
    });

    var picks = [];
    var work = core;
    var taken = {};
    ['en', 'fit', 'ai', 'family'].forEach(function (area) {
      var i;
      for (i = 0; i < cands.length; i++) {
        var cell = cands[i];
        if (cell.area !== area || taken[cell.id]) continue;
        /* 가족 칸은 이번 주에 비어 있을 때만 (canClaim의 WEEKLY_USED가 걸러 준다) */
        var res = rules.claim(board, work, { cell: cell.id, day: day, today: today, actor: { id: 'me', role: 'owner' } });
        if (res.ok) { picks.push(cell.id); taken[cell.id] = true; work = res.core; break; }
      }
    });
    return picks;
  }

  var guide = {
    recentPace: recentPace, plan: plan, planBoth: planBoth, estimateFinish: estimateFinish,
    allCombos: allCombos, minFinish: minFinish, recommendToday: recommendToday
  };

  GB.guide = guide;
  if (typeof module !== 'undefined' && module.exports) module.exports = guide;
})();
