/* ============================================================
   성장 빙고 — 규칙 계층 (순수 함수)

   DOM, localStorage, 시계, 난수를 쓰지 않는다. 같은 입력이면 항상 같은 출력.
   모든 함수는 (board, core, ...)를 받고 core를 바꾸지 않는다. 상태를 바꾸는 함수는
   새 core를 돌려준다.

   "오늘"은 인자로 받는다. 이 파일이 시계를 보지 않기 때문에 테스트에서
   날짜를 마음대로 넣을 수 있고, 날짜 버그가 화면 계층에만 모인다.

   칸 id를 이 파일에 적지 않는다. 규칙은 칸의 속성(kind, ladder, level, window,
   weekly, strength, parts, cardio, impact, rest)만 본다.
   ============================================================ */
(function () {
  'use strict';

  var GB = (typeof window !== 'undefined')
    ? (window.GrowthBingo = window.GrowthBingo || {})
    : {};

  /* ── 날짜 ─────────────────────────────────────────────
     Date 객체를 쓰지 않고 달력 날짜를 "1970-01-01로부터의 일수"로 바꿔 계산한다
     (Howard Hinnant의 civil 알고리즘). 시각·시간대·서머타임이 끼어들 자리가 없다. */
  function daysFromCivil(y, m, d) {
    y -= m <= 2 ? 1 : 0;
    var era = Math.floor(y / 400);
    var yoe = y - era * 400;
    var doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }

  function civilFromDays(z) {
    z += 719468;
    var era = Math.floor(z / 146097);
    var doe = z - era * 146097;
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    var y = yoe + era * 400;
    var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    var mp = Math.floor((5 * doy + 2) / 153);
    var d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    var m = mp + (mp < 10 ? 3 : -9);
    return { y: y + (m <= 2 ? 1 : 0), m: m, d: d };
  }

  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var back = civilFromDays(daysFromCivil(y, mo, d));
    if (back.y !== y || back.m !== mo || back.d !== d) return null; // 2월 30일 같은 날짜
    return { y: y, m: mo, d: d };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function dayNumber(startDate, todayDate) {
    var a = parseDate(startDate), b = parseDate(todayDate);
    if (!a || !b) return NaN;
    return daysFromCivil(b.y, b.m, b.d) - daysFromCivil(a.y, a.m, a.d) + 1;
  }

  /** 시작일 기준 n일차의 날짜 문자열 "YYYY-MM-DD" */
  function dateOfDay(startDate, day) {
    var a = parseDate(startDate);
    if (!a) return null;
    var c = civilFromDays(daysFromCivil(a.y, a.m, a.d) + day - 1);
    return c.y + '-' + pad(c.m) + '-' + pad(c.d);
  }

  function weekOf(day) { return Math.ceil(day / 7); }

  /* ── 판 조회 ───────────────────────────────────────── */
  var indexCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function index(board) {
    var idx = indexCache && indexCache.get(board);
    if (idx) return idx;
    idx = { byId: {}, order: {} };
    board.cells.forEach(function (c, i) { idx.byId[c.id] = c; idx.order[c.id] = i; });
    if (indexCache) indexCache.set(board, idx);
    return idx;
  }
  function getCell(board, id) { return index(board).byId[id] || null; }

  function isArea(board, cell) { return cell.area !== 'family' && !!board.areas[cell.area]; }

  /* ── 진행 상황 ─────────────────────────────────────── */
  function stickersOf(core, cellId) {
    return core.stickers.filter(function (s) { return s.cell === cellId; });
  }

  function cellProgress(board, core, cellId) {
    var cell = getCell(board, cellId);
    var confirmed = 0, pending = 0;
    core.stickers.forEach(function (s) {
      if (s.cell !== cellId) return;
      if (s.status === 'confirmed') confirmed++;
      else if (s.status === 'pending') pending++;
    });
    return { boxes: cell.boxes, confirmed: confirmed, pending: pending, complete: confirmed >= cell.boxes };
  }

  /** 모든 칸의 진행을 한 번에 (줄·길잡이 계산용). id → progress */
  function progressMap(board, core) {
    var map = {};
    board.cells.forEach(function (c) { map[c.id] = { boxes: c.boxes, confirmed: 0, pending: 0, complete: false }; });
    core.stickers.forEach(function (s) {
      var p = map[s.cell];
      if (!p) return;
      if (s.status === 'confirmed') p.confirmed++;
      else if (s.status === 'pending') p.pending++;
    });
    board.cells.forEach(function (c) { map[c.id].complete = map[c.id].confirmed >= c.boxes; });
    return map;
  }

  /** 하루에 쓴 스티커(확인 대기 + 확정) */
  function todayUsage(board, core, day) {
    var byArea = {};
    Object.keys(board.areas).forEach(function (a) { byArea[a] = 0; });
    var total = 0;
    core.stickers.forEach(function (s) {
      if (s.day !== day) return;
      var cell = getCell(board, s.cell);
      if (!cell) return;
      total++;
      byArea[cell.area] = (byArea[cell.area] || 0) + 1;
    });
    return { total: total, byArea: byArea };
  }

  function latestDay(core) {
    var m = 0;
    core.stickers.forEach(function (s) { if (s.day > m) m = s.day; });
    return m;
  }

  function partsOverlap(a, b) {
    var pa = a.parts || [], pb = b.parts || [];
    return pa.some(function (p) { return pb.indexOf(p) >= 0; });
  }

  function fail(reason, detail) { return { ok: false, reason: reason, detail: detail || {} }; }

  /* ── 하나 눌러도 되는가: 검사 순서가 정해져 있다 (spec 12절) ──────────────
     앞에서 걸리면 그 사유를 돌려준다. 순서가 고정이어야 화면 문구와 테스트가 안정된다. */
  function canClaim(board, core, req) {
    var R = board.rules;
    var cell = getCell(board, req.cell);
    var today = req.today;
    var day = req.day === undefined ? today : req.day;
    var actor = req.actor || {};
    if (!cell) return fail('UNKNOWN_CELL', { cell: req.cell });

    if (actor.role !== 'owner') return fail('NOT_OWNER');
    if (today < 1) return fail('NOT_STARTED', { startsIn: 1 - today });
    if (today > R.DAYS) return fail('SEASON_OVER');
    var latest = latestDay(core);
    if (today < latest) return fail('CLOCK_SUSPECT', { latest: latest });
    if ((day !== today && day !== today - R.BACKDATE_DAYS) || day < 1 || day > R.DAYS) {
      return fail('BAD_DAY', { day: day, today: today });
    }

    var prog = cellProgress(board, core, cell.id);
    if (prog.confirmed + prog.pending >= cell.boxes) return fail('CELL_FULL', prog);

    var sameDay = core.stickers.filter(function (s) { return s.day === day; });
    var week = weekOf(day);

    if (sameDay.some(function (s) { return s.cell === cell.id; })) return fail('SAME_CELL_SAME_DAY');

    if (cell.window && (day < cell.window.from || day > cell.window.to)) {
      return fail('OUT_OF_WINDOW', { from: cell.window.from, to: cell.window.to, early: day < cell.window.from });
    }

    if (cell.ladder && cell.level > 1) {
      /* 아래 레벨은 "확정"으로 다 차 있어야 한다. 확인 대기는 세지 않는다.
         바로 아래만 보지 않고 전부 본다: 가져온 파일 등으로 아래가 빠진 상태가 와도 막는다. */
      var ids = board.ladders[cell.ladder];
      var lv;
      for (lv = cell.level - 1; lv >= 1; lv--) {
        var lower = getCell(board, ids[lv - 1]);
        var lp = cellProgress(board, core, lower.id);
        if (lp.confirmed < lower.boxes) {
          return fail('LEVEL_LOCKED', { lower: lower.id, confirmed: lp.confirmed, pending: lp.pending, boxes: lower.boxes, level: lv });
        }
      }
    }

    if (cell.ladder) {
      var sameLadder = sameDay.filter(function (s) {
        var o = getCell(board, s.cell);
        return o && o.ladder === cell.ladder;
      });
      if (sameLadder.length >= R.LADDER_DAILY_CAP) return fail('LADDER_DAILY', { cell: sameLadder[0].cell });
    }

    if (cell.weekly) {
      var inWeek = core.stickers.filter(function (s) { return s.cell === cell.id && weekOf(s.day) === week; });
      if (inWeek.length) return fail('WEEKLY_USED', { week: week, day: inWeek[0].day });
    }

    if (sameDay.length >= R.DAILY_CAP) return fail('DAILY_CAP', { total: sameDay.length });

    if (isArea(board, cell)) {
      var inArea = sameDay.filter(function (s) { var o = getCell(board, s.cell); return o && o.area === cell.area; });
      if (inArea.length >= R.AREA_DAILY_CAP) return fail('AREA_CAP', { area: cell.area });
    }

    function of(stickers, test) {
      return stickers.filter(function (s) { var o = getCell(board, s.cell); return o && test(o); });
    }
    var near = core.stickers.filter(function (s) { return s.day === day - 1 || s.day === day + 1; });

    if (cell.strength) {
      var st = of(sameDay, function (o) { return o.strength; });
      if (st.length >= R.STRENGTH_DAILY_CAP) return fail('STRENGTH_DAILY', { cell: st[0].cell });
      var pc = of(near, function (o) { return o.strength && partsOverlap(o, cell); });
      if (pc.length) {
        var o1 = getCell(board, pc[0].cell);
        var shared = (o1.parts || []).filter(function (p) { return (cell.parts || []).indexOf(p) >= 0; });
        return fail('PART_CONSECUTIVE', { cell: pc[0].cell, day: pc[0].day, parts: shared });
      }
    }

    if (cell.impact) {
      var im = of(sameDay, function (o) { return o.impact; });
      if (im.length >= R.IMPACT_DAILY_CAP) return fail('IMPACT_DAILY', { cell: im[0].cell });
      var ic = of(near, function (o) { return o.impact; });
      if (ic.length) return fail('IMPACT_CONSECUTIVE', { cell: ic[0].cell, day: ic[0].day });
    }

    if (cell.rest) {
      var hard = of(sameDay, function (o) { return o.strength || o.cardio; });
      if (hard.length) return fail('REST_CONFLICT', { cell: hard[0].cell });
    } else if (cell.strength || cell.cardio) {
      var rest = of(sameDay, function (o) { return o.rest; });
      if (rest.length) return fail('REST_CONFLICT', { cell: rest[0].cell });
    }

    return { ok: true };
  }

  /* ── 상태 전이 ─────────────────────────────────────── */
  function cloneCore(core) {
    return {
      startDate: core.startDate,
      seq: core.seq,
      stickers: core.stickers.map(function (s) { var o = {}; for (var k in s) o[k] = s[k]; return o; })
    };
  }

  function claim(board, core, req) {
    var chk = canClaim(board, core, req);
    if (!chk.ok) return chk;
    var day = req.day === undefined ? req.today : req.day;
    var next = cloneCore(core);
    next.seq = (core.seq || 0) + 1;
    var sticker = {
      id: 's' + next.seq,
      cell: req.cell,
      day: day,
      date: dateOfDay(core.startDate, day),
      status: 'pending',
      claimedAt: req.at || null,
      claimedBy: req.actor.id
    };
    next.stickers.push(sticker);
    return { ok: true, core: next, sticker: sticker };
  }

  function findSticker(core, id) {
    for (var i = 0; i < core.stickers.length; i++) if (core.stickers[i].id === id) return core.stickers[i];
    return null;
  }

  function removeSticker(core, id) {
    var next = cloneCore(core);
    next.stickers = next.stickers.filter(function (s) { return s.id !== id; });
    return next;
  }

  /** 도장은 한 날 + STAMP_GRACE_DAYS일 안에만 찍을 수 있다. */
  function canConfirm(board, core, req) {
    var R = board.rules;
    var actor = req.actor || {};
    if (actor.role !== 'verifier') return fail('NOT_VERIFIER');
    var s = findSticker(core, req.stickerId);
    if (!s) return fail('NO_STICKER');
    if (s.status !== 'pending') return fail('NOT_PENDING');
    if (req.today < latestDay(core)) return fail('CLOCK_SUSPECT', { latest: latestDay(core) });
    if (req.today > s.day + R.STAMP_GRACE_DAYS) return fail('STAMP_EXPIRED', { day: s.day });
    return { ok: true };
  }

  function confirm(board, core, req) {
    var chk = canConfirm(board, core, req);
    if (!chk.ok) return chk;
    var next = cloneCore(core);
    var s = findSticker(next, req.stickerId);
    s.status = 'confirmed';
    s.confirmedAt = req.at || null;
    s.confirmedBy = req.actor.id;
    s.alt = !!req.alt;
    return { ok: true, core: next, sticker: s };
  }

  /** 가족이 확인 대기를 돌려보낸다. */
  function reject(board, core, req) {
    var actor = req.actor || {};
    if (actor.role !== 'verifier') return fail('NOT_VERIFIER');
    var s = findSticker(core, req.stickerId);
    if (!s) return fail('NO_STICKER');
    if (s.status !== 'pending') return fail('NOT_PENDING');
    if (req.today < latestDay(core)) return fail('CLOCK_SUSPECT', { latest: latestDay(core) });
    return { ok: true, core: removeSticker(core, s.id), sticker: s };
  }

  /** 사다리는 위에서부터 취소한다: 위 레벨에 스티커(대기 포함)가 있으면 아래는 못 뺀다. */
  function canRevoke(board, core, stickerId) {
    var s = findSticker(core, stickerId);
    if (!s) return fail('NO_STICKER');
    var cell = getCell(board, s.cell);
    if (cell && cell.ladder) {
      var ids = board.ladders[cell.ladder];
      var lv;
      for (lv = cell.level + 1; lv <= ids.length; lv++) {
        if (stickersOf(core, ids[lv - 1]).length) return fail('HIGHER_LEVEL_EXISTS', { cell: ids[lv - 1] });
      }
    }
    return { ok: true };
  }

  /** 가족이 확정된 스티커를 취소한다. */
  function revoke(board, core, req) {
    var actor = req.actor || {};
    if (actor.role !== 'verifier') return fail('NOT_VERIFIER');
    var s = findSticker(core, req.stickerId);
    if (!s) return fail('NO_STICKER');
    if (s.status !== 'confirmed') return fail('NOT_CONFIRMED');
    if (req.today < latestDay(core)) return fail('CLOCK_SUSPECT', { latest: latestDay(core) });
    var chk = canRevoke(board, core, s.id);
    if (!chk.ok) return chk;
    return { ok: true, core: removeSticker(core, s.id), sticker: s };
  }

  /** 본인이 자기 확인 대기를 취소한다. */
  function cancelOwn(board, core, req) {
    var actor = req.actor || {};
    if (actor.role !== 'owner') return fail('NOT_OWNER');
    var s = findSticker(core, req.stickerId);
    if (!s) return fail('NO_STICKER');
    if (s.status !== 'pending') return fail('NOT_PENDING');
    return { ok: true, core: removeSticker(core, s.id), sticker: s };
  }

  /** 기한이 지난 확인 대기를 지운다. */
  function expirePending(board, core, today) {
    var grace = board.rules.STAMP_GRACE_DAYS;
    var expired = core.stickers.filter(function (s) { return s.status === 'pending' && today > s.day + grace; });
    if (!expired.length) return { core: core, expired: [] };
    var ids = {};
    expired.forEach(function (s) { ids[s.id] = true; });
    var next = cloneCore(core);
    next.stickers = next.stickers.filter(function (s) { return !ids[s.id]; });
    return { core: next, expired: expired };
  }

  /* ── 줄 ────────────────────────────────────────────── */

  /** 칸 집합에 사다리 선행 레벨을 더한 id 집합(객체)을 돌려준다. */
  function withPrerequisites(board, cellIds) {
    var set = {};
    cellIds.forEach(function (id) { set[id] = true; });
    Object.keys(board.ladders).forEach(function (l) {
      var ids = board.ladders[l];
      var top = 0;
      ids.forEach(function (id, i) { if (set[id]) top = i + 1; });
      var i;
      for (i = 0; i < top; i++) set[ids[i]] = true;
    });
    return set;
  }

  /** 줄 16개의 상태.
      remaining: 이 줄을 채우려면 더 붙여야 할 스티커 수 (사다리 선행 포함, 확인 대기는 이미 붙인 것으로 본다)
      hiddenPrereq: 그중 줄 밖 사다리 선행분 */
  function lineStatus(board, core) {
    var prog = progressMap(board, core);
    return board.lines.map(function (line) {
      var inLine = {};
      line.cells.forEach(function (id) { inLine[id] = true; });
      var all = withPrerequisites(board, line.cells);
      var remaining = 0, hidden = 0;
      Object.keys(all).forEach(function (id) {
        var p = prog[id];
        var rem = Math.max(0, p.boxes - p.confirmed - p.pending);
        remaining += rem;
        if (!inLine[id]) hidden += rem;
      });
      var complete = line.cells.every(function (id) { return prog[id].complete; });
      return { id: line.id, cells: line.cells, complete: complete, remaining: remaining, hiddenPrereq: hidden };
    });
  }

  /** 확정만 센 완성 줄 수 */
  function bingoCount(board, core) {
    var prog = progressMap(board, core);
    return board.lines.filter(function (line) {
      return line.cells.every(function (id) { return prog[id].complete; });
    }).length;
  }

  /* ── 죽은 칸 (spec 6-3) ──────────────────────────────
     기간 안에 어떻게 해도 완성할 수 없게 된 칸. */
  function isCellDead(board, core, cellId, today) {
    var R = board.rules;
    var cell = getCell(board, cellId);
    var p = cellProgress(board, core, cellId);
    if (p.complete) return false;
    var rem = cell.boxes - p.confirmed - p.pending;
    if (rem <= 0) return false; // 대기만으로 다 찼다: 도장을 받으면 완성
    var t = Math.max(today, 1);
    if (today > R.DAYS) return true;
    var daysLeft = R.DAYS - t + 1;

    /* 기간 끝 다음 날에도 "어제 한 일"로 기록할 수 있으므로(BACKDATE_DAYS) 그날까지는 살아 있다.
       기간이 끝나자마자 죽은 칸으로 표시하면 아직 채울 수 있는 칸에 ×가 뜬다. */
    if (cell.window && t > cell.window.to + R.BACKDATE_DAYS) return true;
    if (rem > daysLeft) return true;
    if (cell.weekly) {
      var weeksLeft = weekOf(R.DAYS) - weekOf(t) + 1;
      var doneThisWeek = core.stickers.some(function (s) { return s.cell === cellId && weekOf(s.day) === weekOf(t); });
      if (doneThisWeek) weeksLeft--;
      if (rem > weeksLeft) return true;
    }
    if (cell.ladder) {
      var ids = board.ladders[cell.ladder];
      var n = 0, lv;
      for (lv = 1; lv <= cell.level; lv++) {
        var lc = getCell(board, ids[lv - 1]);
        var lp = cellProgress(board, core, lc.id);
        n += Math.max(0, lc.boxes - lp.confirmed - lp.pending);
        if (lv < cell.level && isCellDead(board, core, lc.id, today)) return true;
      }
      var need = cell.strength ? 2 * n - 1 : n;
      if (need > daysLeft) return true;
    }
    return false;
  }

  /* ── 연속 기록 ─────────────────────────────────────── */
  function streak(board, core, today) {
    var days = {};
    core.stickers.forEach(function (s) { if (s.status === 'confirmed') days[s.day] = true; });
    var list = Object.keys(days).map(Number).sort(function (a, b) { return a - b; });
    var longest = 0, run = 0, prev = -10;
    list.forEach(function (d) {
      run = (d === prev + 1) ? run + 1 : 1;
      if (run > longest) longest = run;
      prev = d;
    });
    /* 오늘 아직 안 했어도 어제까지 이어진 기록은 "현재"로 보여 준다(경고·벌칙 없음). */
    var cur = 0;
    var d0 = days[today] ? today : today - 1;
    while (d0 >= 1 && days[d0]) { cur++; d0--; }
    return { current: cur, longest: longest };
  }

  /* ── 화면용: 한 칸이 지금 어떤 상태인가 ──────────────── */
  function availability(board, core, cellId, day, today) {
    var cell = getCell(board, cellId);
    var prog = cellProgress(board, core, cellId);
    var out = { cell: cellId, progress: prog };
    if (prog.complete) { out.state = 'complete'; out.icon = '✓'; out.ok = false; return out; }
    var chk = canClaim(board, core, { cell: cellId, day: day, today: today, actor: { id: 'me', role: 'owner' } });
    out.ok = chk.ok;
    out.reason = chk.reason;
    out.detail = chk.detail;
    if (isCellDead(board, core, cellId, today) && today >= 1) {
      out.state = 'dead'; out.icon = '✕'; return out;
    }
    if (chk.ok) { out.state = 'available'; out.icon = ''; return out; }
    switch (chk.reason) {
      case 'LEVEL_LOCKED': out.state = 'locked'; out.icon = '🔒'; break;
      case 'OUT_OF_WINDOW': out.state = chk.detail.early ? 'early' : 'late'; out.icon = chk.detail.early ? '⏳' : '✕'; break;
      case 'PART_CONSECUTIVE': case 'IMPACT_CONSECUTIVE': case 'STRENGTH_DAILY': case 'IMPACT_DAILY':
      case 'REST_CONFLICT': case 'WEEKLY_USED': case 'LADDER_DAILY':
        out.state = 'rest'; out.icon = '💤'; break;
      case 'CELL_FULL': out.state = 'full'; out.icon = '⌛'; break;
      default: out.state = 'blocked'; out.icon = '';
    }
    return out;
  }

  var rules = {
    daysFromCivil: daysFromCivil, civilFromDays: civilFromDays, parseDate: parseDate,
    dayNumber: dayNumber, dateOfDay: dateOfDay, weekOf: weekOf,
    getCell: getCell, cellProgress: cellProgress, progressMap: progressMap,
    canClaim: canClaim, claim: claim, canConfirm: canConfirm, confirm: confirm,
    reject: reject, revoke: revoke, canRevoke: canRevoke, cancelOwn: cancelOwn,
    expirePending: expirePending, withPrerequisites: withPrerequisites,
    lineStatus: lineStatus, bingoCount: bingoCount, todayUsage: todayUsage,
    availability: availability, isCellDead: isCellDead, streak: streak,
    latestDay: latestDay, cloneCore: cloneCore, findSticker: findSticker
  };

  GB.rules = rules;
  if (typeof module !== 'undefined' && module.exports) module.exports = rules;
})();
