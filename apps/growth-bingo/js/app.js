/* ============================================================
   성장 빙고 — 화면 계층

   규칙 판정은 rules.js, 길잡이 계산은 guide.js, 저장은 store.js, 가족 확인은
   family-gate.js가 한다. 이 파일은 그 결과를 그리고 눌림을 받아 넘기는 일만 한다.
   (옮겨 갈 앱에서는 이 파일을 다시 만든다.)

   confirm()·alert()·prompt()는 쓰지 않는다. 블로그 메인에 iframe으로 들어가므로
   부모 페이지까지 멈출 수 있다. 확인 절차는 화면 안 대화 상자로 만든다.
   ============================================================ */
(function () {
  'use strict';

  var GB = window.GrowthBingo = window.GrowthBingo || {};
  var board = GB.board, rules = GB.rules, guide = GB.guide, store = GB.store, gate = GB.familyGate;
  var APP_VERSION = '1.0.0';

  var params = new URLSearchParams(window.location.search);
  var EMBED = params.get('embed') === '1' || (function () { try { return window.self !== window.top; } catch (e) { return true; } })();

  /* ── 상태 ──────────────────────────────────────────
     S: 저장되는 상태 (store.js의 모양)  /  UI: 화면에만 있는 상태 */
  var S = null;
  var UI = {
    tab: 'board',
    day: 0,               // 오늘 일차 (0 이하: 시작 전)
    todayStr: '',
    claimYesterday: false, // "어제 한 일" 전환
    selectedLine: null,
    focusCell: null,       // roving tabindex가 가리키는 칸
    version: 0,            // core가 바뀔 때마다 올려 길잡이 캐시를 무효화한다
    planPreviewAlt: false,
    notices: [],           // 사라지지 않는 안내 띠 (닫기 가능)
    loadStatus: 'ok',
    loadInfo: null,
    sheetNote: '',
    pendingFocus: null
  };
  var planCache = {};
  var lastPlanMs = null;
  var dialogStack = [];

  /* ── 작은 도구 ─────────────────────────────────────── */
  function h(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* 기기의 로컬 날짜. 시각·시간대는 판정에 쓰지 않고 연·월·일만 꺼낸다. */
  function localDateStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function nowIso() {
    var d = new Date();
    var off = -d.getTimezoneOffset();
    var sign = off >= 0 ? '+' : '-';
    off = Math.abs(off);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) +
      sign + pad2(Math.floor(off / 60)) + ':' + pad2(off % 60);
  }
  function mdText(dateStr) {
    var p = rules.parseDate(dateStr);
    return p ? p.m + '월 ' + p.d + '일' : '';
  }
  function dayDate(day) { return S.core.startDate ? rules.dateOfDay(S.core.startDate, day) : null; }
  function dayMd(day) { var d = dayDate(day); return d ? mdText(d) : ''; }

  function cellOf(id) { return rules.getCell(board, id); }
  function areaName(a) { return board.areas[a] ? board.areas[a].name : a; }
  function started() { return !!S.core.startDate; }
  function seasonOver() { return UI.day > board.rules.DAYS; }

  var KIND_NAME = { repeat: '반복', level: '레벨', fixed: '주차 고정', once: '1회' };
  var PART_NAME = { pull: '당기기', push: '밀기', legs: '하체' };

  function kindText(cell) {
    var t = KIND_NAME[cell.kind];
    if (cell.kind === 'level') t = '레벨 ' + cell.level;
    if (cell.kind === 'fixed') t = '주차 고정 (' + cell.window.from + '~' + cell.window.to + '일차)';
    if (cell.weekly) t += ' · 주 1회';
    if (cell.strength) t += ' · 근력(' + (cell.parts || []).map(function (p) { return PART_NAME[p] || p; }).join('+') + ')';
    else if (cell.cardio) t += ' · 유산소' + (cell.impact ? '(충격)' : '');
    if (cell.rest) t += ' · 휴식';
    return t;
  }
  function badgeText(cell) {
    if (cell.kind === 'level') return 'L' + cell.level;
    if (cell.kind === 'fixed') return rules.weekOf(cell.window.from) + '주';
    if (cell.weekly) return '주1';
    return '';
  }

  /* 스크린 리더용 상태 영역 */
  function announce(msg) {
    var el = $('#live');
    if (!el) return;
    el.textContent = '';
    window.setTimeout(function () { el.textContent = msg; }, 20);
  }

  /* ── 날짜 갱신 ─────────────────────────────────────
     앱을 열어 둔 채 자정이 지나면 화면이 어제에 머문다. 그래서 조작 직전마다
     오늘 일차를 다시 계산하고, 바뀌었으면 만료 정리 후 다시 그린다. */
  function computeDay() {
    UI.todayStr = localDateStr();
    return S.core.startDate ? rules.dayNumber(S.core.startDate, UI.todayStr) : 0;
  }

  function refreshDay(silent) {
    if (!S) return false;
    var before = UI.day, beforeStr = UI.todayStr;
    UI.day = computeDay();
    var changed = before !== UI.day || beforeStr !== UI.todayStr;
    if (started()) {
      var ex = rules.expirePending(board, S.core, UI.day);
      if (ex.expired.length) {
        S.core = ex.core;
        ex.expired.forEach(function (st) {
          store.pushLog(S, { at: nowIso(), type: 'expire', cell: st.cell, day: st.day });
        });
        UI.version++;
        persist();
        var names = ex.expired.map(function (st) { return cellOf(st.cell).title + '(' + st.day + '일차)'; });
        UI.notices.push({ id: 'expire-' + Date.now(), kind: 'warn', text: '도장을 못 받아 사라진 인증 ' + ex.expired.length + '건: ' + names.join(', ') });
        changed = true;
      }
    }
    if (changed && !silent) {
      if (before !== 0 && before !== UI.day && S.core.startDate) announce('날짜가 바뀌었습니다. 오늘은 ' + UI.day + '일차입니다.');
      UI.version++;
      render();
    }
    return changed;
  }

  /* ── 저장 ──────────────────────────────────────────── */
  function persist() {
    if (EMBED) return;
    /* updatedAt은 "다른 탭이 먼저 썼는가"를 가르는 표지라 밀리초까지 적는다.
       초 단위면 같은 초 안의 두 탭 저장이 서로를 알아보지 못해 한쪽 기록이 덮인다. */
    store.save(S, new Date().toISOString());
    renderBanners();
  }

  /* 다른 탭에서 바뀌었는지 보고 다시 읽는다. 조작 직전에 불러서
     "오래된 화면으로 새 기록을 덮어쓰는" 일을 막는다. */
  function syncFromStorage() {
    var stored = store.storedUpdatedAt();
    if (stored === null || stored === (S.updatedAt || '')) return false;
    if (S.updatedAt === null && stored === '') return false;
    var res = store.reload();
    if (res.status === 'ok') {
      S = res.state;
      UI.version++;
      return true;
    }
    return false;
  }

  /** 상태를 바꾸는 조작의 공통 틀: 날짜 새로 계산 → 저장소와 동기 → 조작 → 저장 → 다시 그림. */
  function act(fn) {
    if (EMBED || store.isReadOnly()) return;
    var syncedFromOther = syncFromStorage();
    refreshDay(true);
    var res = fn();
    if (syncedFromOther) UI.version++;
    UI.version++;
    persist();
    render();
    refreshOpenDialogs();
    return res;
  }

  /* ── 대화 상자 ─────────────────────────────────────
     시트(role="dialog")와 확인 상자(role="alertdialog") 공용.
     열리면 포커스를 안으로 옮겨 가두고, Esc로 닫고, 닫히면 연 버튼으로 돌려준다. */
  var FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function openDialog(opts) {
    var opener = document.activeElement;
    /* 연 버튼은 화면이 다시 그려지면 사라질 수 있다. 같은 칸·같은 버튼을 다시 찾을 단서를 적어 둔다. */
    var openerKey = opener && opener.getAttribute ? {
      id: opener.id || null, cell: opener.getAttribute('data-cell'), fk: opener.getAttribute('data-fk'), action: opener.getAttribute('data-action')
    } : null;
    var overlay = document.createElement('div');
    overlay.className = 'overlay' + (opts.sheet ? ' overlay-sheet' : '');
    var dlg = document.createElement('div');
    dlg.className = 'dialog' + (opts.sheet ? ' sheet' : '');
    dlg.setAttribute('role', opts.role || 'dialog');
    dlg.setAttribute('aria-modal', 'true');
    var titleId = 'dlg-title-' + (dialogStack.length + 1);
    dlg.setAttribute('aria-labelledby', titleId);
    dlg.innerHTML =
      '<div class="dialog-head"><h2 class="dialog-title" id="' + titleId + '" tabindex="-1">' + h(opts.title) + '</h2>' +
      (opts.noClose ? '' : '<button type="button" class="btn dialog-x" data-dlg-close aria-label="닫기">✕</button>') + '</div>' +
      '<div class="dialog-body"></div>';
    overlay.appendChild(dlg);
    $('#modal-root').appendChild(overlay);
    var body = $('.dialog-body', dlg);
    var closed = false;

    function findOpener() {
      if (opener && document.contains(opener)) return opener;
      if (!openerKey) return null;
      if (openerKey.id) return document.getElementById(openerKey.id);
      if (openerKey.cell && openerKey.action === 'open-cell') return $('.cell[data-cell="' + openerKey.cell + '"]') || $('[data-action="open-cell"][data-cell="' + openerKey.cell + '"]');
      if (openerKey.fk) return $('[data-fk="' + openerKey.fk + '"]');
      return null;
    }

    function onKey(e) {
      /* 가장 위에 열린 상자만 키를 받는다. 포커스가 상자 밖(문서)으로 빠져도 Esc와 Tab이 동작해야 한다. */
      if (dialogStack[dialogStack.length - 1] !== handle) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!opts.noClose) handle.close();
        return;
      }
      if (e.key !== 'Tab') return;
      var items = $$(FOCUSABLE, dlg).filter(function (el) { return el.offsetParent !== null; });
      if (!items.length) { e.preventDefault(); return; }
      var firstEl = items[0], lastEl = items[items.length - 1];
      if (!dlg.contains(document.activeElement)) { e.preventDefault(); firstEl.focus(); }
      else if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }

    var handle = {
      el: dlg, body: body, overlay: overlay,
      close: function (result) {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKey, true);
        var i = dialogStack.indexOf(handle);
        if (i >= 0) dialogStack.splice(i, 1);
        overlay.remove();
        document.body.classList.toggle('has-dialog', dialogStack.length > 0);
        var back = findOpener();
        if (back && typeof back.focus === 'function') back.focus({ preventScroll: true });
        if (opts.onClose) opts.onClose(result);
      },
      refresh: function () {
        if (closed || !opts.render) return;
        var ae = document.activeElement;
        var inside = ae && dlg.contains(ae);
        var keepAttr = inside ? (ae.hasAttribute('data-keep') ? 'data-keep' : (ae.hasAttribute('data-fk') ? 'data-fk' : null)) : null;
        var keep = keepAttr ? ae.getAttribute(keepAttr) : null;
        var scroll = body.scrollTop;
        body.innerHTML = '';
        opts.render(body, handle.close, handle);
        body.scrollTop = scroll;
        var el = keep ? $('[' + keepAttr + '="' + keep + '"]', body) : null;
        /* 누른 버튼이 사라졌으면(예: 도장을 찍어 목록에서 빠짐) 상자 제목으로 포커스를 돌려 놓는다. */
        if (el) el.focus({ preventScroll: true });
        else if (inside) $('.dialog-title', dlg).focus({ preventScroll: true });
      }
    };
    dialogStack.push(handle);
    document.body.classList.add('has-dialog');
    document.addEventListener('keydown', onKey, true);

    var first = opts.render(body, handle.close, handle);

    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay && !opts.modalOnly) handle.close(); });
    dlg.addEventListener('click', function (e) { if (e.target.closest('[data-dlg-close]')) handle.close(); });
    var target = (first && first.focus) ? first : $('.dialog-title', dlg);
    target.focus();
    return handle;
  }

  function refreshOpenDialogs() { dialogStack.slice().forEach(function (d) { d.refresh(); }); }

  /** 확인 상자: 예/아니오. Promise<boolean> */
  function askDialog(opts) {
    return new Promise(function (resolve) {
      var result = false;
      openDialog({
        title: opts.title, role: 'alertdialog',
        onClose: function () { resolve(result); },
        render: function (body, close) {
          body.innerHTML = '<p class="dialog-text">' + opts.text + '</p>' +
            '<div class="dialog-actions"><button type="button" class="btn" data-no>' + h(opts.no || '그만두기') + '</button>' +
            '<button type="button" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-yes>' + h(opts.yes || '확인') + '</button></div>';
          $('[data-no]', body).addEventListener('click', function () { close(); });
          $('[data-yes]', body).addEventListener('click', function () { result = true; close(); });
          return $('[data-no]', body);
        }
      });
    });
  }

  /* ── 화면용 계산 (렌더마다 한 번) ──────────────────── */
  var DIGITS = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];
  var AREA_ORDER = ['en', 'fit', 'ai'];

  function getPlan(mode) {
    var key = UI.version + '|' + UI.day + '|' + mode;
    if (planCache[key]) return planCache[key];
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    var p = guide.plan(board, S.core, { today: UI.day, mode: mode });
    lastPlanMs = (window.performance && performance.now) ? performance.now() - t0 : null;
    planCache = {}; // 오래된 항목은 버린다
    planCache[key] = p;
    return p;
  }

  function claimDayNow() { return UI.claimYesterday ? UI.day - 1 : UI.day; }

  function derive() {
    var D = {};
    D.prog = rules.progressMap(board, S.core);
    D.lines = rules.lineStatus(board, S.core);
    D.lineById = {};
    D.lines.forEach(function (l) { D.lineById[l.id] = l; });
    D.bingo = rules.bingoCount(board, S.core);
    D.usage = rules.todayUsage(board, S.core, claimDayNow());
    D.confirmed = S.core.stickers.filter(function (s) { return s.status === 'confirmed'; }).length;
    D.pending = S.core.stickers.filter(function (s) { return s.status === 'pending'; });
    D.mode = S.settings.guideMode;
    D.altMode = D.mode === 'fewest' ? 'fastest' : 'fewest';
    D.shownMode = UI.planPreviewAlt ? D.altMode : D.mode;
    D.plan = started() ? getPlan(D.shownMode) : null;
    D.planCells = {}; D.planLines = {};
    if (D.plan && D.plan.status !== 'done') {
      (D.plan.cells || []).forEach(function (id) { D.planCells[id] = true; });
      (D.plan.lines || []).forEach(function (id) { D.planLines[id] = true; });
    }
    D.av = {};
    var day = claimDayNow();
    board.cells.forEach(function (c) { D.av[c.id] = rules.availability(board, S.core, c.id, day, UI.day); });
    D.streak = rules.streak(board, S.core, UI.day);
    return D;
  }

  /* ── 안내 띠 ───────────────────────────────────────── */
  function renderBanners() {
    var el = $('#banners');
    if (!el) return;
    var out = [];
    var problem = store.problem();
    if (problem === 'readonly') {
      out.push('<div class="banner banner-warn" role="alert">이 앱보다 새로운 버전에서 만든 기록이라 <strong>읽기만</strong> 할 수 있습니다. 저장하지 않습니다.</div>');
    } else if (problem === 'quota') {
      out.push('<div class="banner banner-error" role="alert">저장 공간이 가득 차 기록을 저장하지 못했습니다. 설정에서 <strong>내보내기</strong>로 백업하세요.</div>');
    } else if (problem) {
      out.push('<div class="banner banner-error" role="alert">이 브라우저에서는 저장이 막혀 있어 창을 닫으면 기록이 사라집니다. 설정의 <strong>[내보내기]</strong>로 백업하세요.</div>');
    }
    if (UI.loadStatus === 'corrupt') {
      out.push('<div class="banner banner-warn" role="alert">저장된 기록을 읽지 못했습니다. 원문은 지우지 않고 따로 보관했습니다. ' +
        '<button type="button" class="btn btn-small" data-action="export-corrupt">원문 내보내기</button></div>');
    }
    if (UI.loadStatus === 'mismatch') {
      out.push('<div class="banner banner-warn" role="alert">저장된 기록이 다른 판(' + h(UI.loadInfo) + ')의 것이라 쓰지 않았습니다. 지우지는 않았습니다.</div>');
    }
    if (UI.loadInfo && UI.loadStatus === 'ok' && UI.loadInfo.dropped) {
      out.push('<div class="banner banner-warn">저장된 기록 중 읽을 수 없는 스티커 ' + UI.loadInfo.dropped + '개는 건너뛰었습니다.</div>');
    }
    if (started() && UI.day >= 1 && S.core.stickers.length && UI.day < rules.latestDay(S.core)) {
      out.push('<div class="banner banner-error" role="alert">기기 날짜가 기록보다 앞서 있습니다(기록은 ' + rules.latestDay(S.core) + '일차까지 있는데 오늘은 ' + UI.day + '일차). 날짜가 돌아올 때까지 [했어요]와 [도장]을 막았습니다. 기록은 그대로입니다.</div>');
    }
    if (gate.isUnlocked()) {
      var resetNote = '';
      if (S.settings.pinResetAt) {
        var since = rules.dayNumber(S.settings.pinResetAt.slice(0, 10), UI.todayStr);
        if (since >= 1 && since <= 7) resetNote = ' · ' + mdText(S.settings.pinResetAt.slice(0, 10)) + '에 비밀번호가 다시 설정되었습니다';
      }
      out.push('<div class="banner banner-family" role="status">가족 확인 중' + h(resetNote) +
        ' <button type="button" class="btn btn-small" data-action="lock">잠그기</button></div>');
    }
    UI.notices.forEach(function (n) {
      out.push('<div class="banner banner-' + (n.kind === 'warn-act' ? 'warn' : (n.kind || 'info')) + '" role="status">' + h(n.text) +
        ' <button type="button" class="btn btn-small" data-action="dismiss-notice" data-id="' + h(n.id) + '">닫기</button></div>');
    });
    el.innerHTML = out.join('');
  }

  /* ── 머리 ──────────────────────────────────────────── */
  function renderHead(D) {
    var dayText;
    if (!started()) dayText = '시작 전';
    else if (UI.day < 1) dayText = '시작까지 ' + (1 - UI.day) + '일';
    else if (UI.day > board.rules.DAYS) dayText = '5주 끝';
    else dayText = UI.day + '일차 · ' + rules.weekOf(UI.day) + '주차';
    var streakText = D.streak.current > 0 ? '🔥 ' + D.streak.current + '일' : '';
    var goal = board.rules.GOAL_LINES;
    var bingoText = D.bingo > goal ? D.bingo + '/' + board.lines.length : D.bingo + '/' + goal;
    var cap = board.rules.DAILY_CAP;
    var usageTotal = rules.todayUsage(board, S.core, UI.day).total;
    $('#head-day').textContent = dayText;
    $('#head-streak').textContent = streakText;
    $('#head-streak').setAttribute('aria-label', streakText ? '연속 ' + D.streak.current + '일' : '');
    $('#head-summary').textContent = '빙고 ' + bingoText + ' · 스티커 ' + D.confirmed + ' · 오늘 ' + usageTotal + '/' + cap;
    var fam = $('#head-family');
    if (fam) {
      fam.textContent = gate.isUnlocked() ? '가족 확인 끄기' : '가족 도장';
      fam.hidden = !started();
    }
  }

  /* ── 판 ────────────────────────────────────────────── */
  function boxesHtml(cell, prog, labels) {
    var out = '';
    var i;
    for (i = 0; i < cell.boxes; i++) {
      var st = i < prog.confirmed ? 'on' : (i < prog.confirmed + prog.pending ? 'pend' : 'off');
      var label = labels && cell.boxLabels ? '<span class="bx-l">' + h(cell.boxLabels[i]) + '</span>' : '';
      out += '<span class="bx bx-' + st + '">' + label + '</span>';
    }
    return out;
  }

  function stateText(cell, av, prog) {
    if (av.state === 'complete') return '완성';
    if (av.state === 'dead') return '기간이 지나 완성할 수 없음';
    if (av.ok) return UI.claimYesterday ? '어제 한 일로 할 수 있음' : '오늘 할 수 있음';
    if (av.state === 'locked') return '아래 레벨이 열려야 함';
    if (av.state === 'early') return '기간 전';
    if (av.state === 'late') return '기간 지남';
    if (av.state === 'rest') return '오늘은 쉼';
    if (av.state === 'full') return '네모가 다 참(도장 대기)';
    return '지금은 할 수 없음';
  }

  function cellHtml(cell, D) {
    var av = D.av[cell.id], prog = D.prog[cell.id];
    var cls = ['cell', 'area-' + cell.area];
    if (av.state === 'complete') cls.push('is-complete');
    else if (av.state === 'dead') cls.push('is-dead');
    else if (av.state === 'locked' || av.state === 'early' || av.state === 'late' || av.state === 'rest') cls.push('is-off');
    if (D.planCells[cell.id]) cls.push('is-guide');
    if (UI.selectedLine && D.lineById[UI.selectedLine] && D.lineById[UI.selectedLine].cells.indexOf(cell.id) >= 0) cls.push('is-hl');
    var m = board.areas[cell.area].mark;
    var badge = badgeText(cell);
    var ico = av.state === 'complete' ? '✓' : (av.icon || '');
    var label = cell.row + '행 ' + cell.col + '열, ' + areaName(cell.area) + ', ' + KIND_NAME[cell.kind] + ' 칸, ' + cell.title +
      ', 네모 ' + cell.boxes + '개 중 ' + prog.confirmed + '개' + (prog.pending ? '(확인 대기 ' + prog.pending + ')' : '') + ', ' + stateText(cell, av, prog);
    var tab = UI.focusCell === cell.id ? '0' : '-1';
    return '<div role="gridcell" class="gc">' +
      '<button type="button" class="' + cls.join(' ') + '" data-action="open-cell" data-cell="' + h(cell.id) + '" data-row="' + cell.row + '" data-col="' + cell.col + '" tabindex="' + tab + '" aria-label="' + h(label) + '">' +
      '<span class="c-corner" aria-hidden="true"></span>' +
      '<span class="c-top" aria-hidden="true"><span class="c-mark">' + h(m) + '</span><span class="c-badge">' + h(badge) + '</span></span>' +
      '<span class="c-name" aria-hidden="true">' + h(cell.short) + '</span>' +
      '<span class="c-boxes" aria-hidden="true">' + boxesHtml(cell, prog) + '</span>' +
      '<span class="c-ico" aria-hidden="true">' + h(ico) + '</span>' +
      '</button></div>';
  }

  function lineHeadHtml(line, glyph, D, extraCls) {
    var st = D.lineById[line.id];
    var cls = ['lh', extraCls || ''];
    if (st.complete) cls.push('is-done');
    var inGuide = !!D.planLines[line.id];
    if (inGuide) cls.push('is-guide');
    if (UI.selectedLine === line.id) cls.push('is-sel');
    var label = line.label + ', 남은 스티커 ' + st.remaining + '개' + (st.complete ? ', 완성' : '') + (inGuide ? ', 길잡이 추천' : '');
    return '<button type="button" class="' + cls.join(' ') + '" data-action="line" data-line="' + h(line.id) + '" aria-label="' + h(label) + '" aria-pressed="' + (UI.selectedLine === line.id) + '">' +
      '<span class="lh-n" aria-hidden="true">' + glyph + '</span>' + (inGuide ? '<span class="lh-g" aria-hidden="true">길</span>' : '') + '</button>';
  }

  function boardHtml(D) {
    var lineMap = {};
    board.lines.forEach(function (l) { lineMap[l.id] = l; });
    var out = '<div class="board-grid" role="grid" aria-label="성장 빙고 판, 7행 7열" aria-rowcount="7" aria-colcount="7">';
    out += '<div role="row" class="brow brow-head"><div role="columnheader" class="gc">' + lineHeadHtml(lineMap.d1, '↘', D, 'lh-diag') + '</div>';
    var c;
    for (c = 1; c <= 7; c++) out += '<div role="columnheader" class="gc">' + lineHeadHtml(lineMap['c' + c], DIGITS[c - 1], D) + '</div>';
    out += '</div>';
    var r;
    for (r = 1; r <= 7; r++) {
      out += '<div role="row" class="brow"><div role="rowheader" class="gc">' + lineHeadHtml(lineMap['r' + r], DIGITS[r - 1], D) + '</div>';
      for (c = 1; c <= 7; c++) {
        var id = lineMap['r' + r].cells[c - 1];
        out += cellHtml(cellOf(id), D);
      }
      out += '</div>';
    }
    out += '<div role="row" class="brow brow-foot"><div role="rowheader" class="gc">' + lineHeadHtml(lineMap.d2, '↙', D, 'lh-diag') + '</div></div>';
    out += '</div>';
    return out;
  }

  function lineInfoHtml(D) {
    if (!UI.selectedLine) return '<p class="line-info muted">줄 머리표를 누르면 그 줄의 남은 스티커를 보여 줍니다.</p>';
    var line = board.lines.filter(function (l) { return l.id === UI.selectedLine; })[0];
    var st = D.lineById[line.id];
    return '<p class="line-info"><strong>' + h(line.label) + '</strong>: ' + (st.complete ? '완성했습니다.' :
      '남은 스티커 ' + st.remaining + '개' + (st.hiddenPrereq ? ' (줄 밖 사다리 선행 ' + st.hiddenPrereq + '개 포함)' : '')) + '</p>';
  }

  function guideHtml(D) {
    if (!started()) return '';
    var p = D.plan;
    var sel = '<label class="guide-mode">길잡이 <select data-action="guide-mode" aria-label="길잡이 기준">' +
      '<option value="fewest"' + (D.mode === 'fewest' ? ' selected' : '') + '>스티커가 가장 적게</option>' +
      '<option value="fastest"' + (D.mode === 'fastest' ? ' selected' : '') + '>가장 빨리</option></select></label>';
    var text = '';
    var alt = '';
    var goal = board.rules.GOAL_LINES;
    if (UI.day > board.rules.DAYS) {
      text = '5주가 끝났습니다.';
    } else if (!p) {
      text = '';
    } else if (p.status === 'done') {
      text = '7빙고를 달성했습니다! ' + (p.next ? '다음 줄까지 남은 스티커 ' + p.next.remaining + '개' : '');
    } else if (p.status === 'impossible') {
      text = '지금은 ' + goal + '빙고가 어렵습니다. 최대 ' + p.maxLines + '빙고까지 가능합니다.';
    } else {
      var d = function (n) { return n + '일차(' + (dayMd(n) || '') + ')'; };
      text = '남은 스티커 <strong>' + p.remaining + '</strong> · ' +
        (p.late ? '기본 속도로는 기간 안에 어려움' : '기본 속도면 <strong>' + d(Math.max(p.finishBase, Math.max(UI.day, 1))) + '</strong>');
      if (UI.day >= 4 && p.finishRecent !== p.finishBase) {
        text += ' · 최근 속도(하루 ' + (Math.round(p.pace * 10) / 10) + '개)면 ' + d(p.finishRecent);
      }
      var other = getPlan(UI.planPreviewAlt ? D.mode : D.altMode);
      var mine = D.plan;
      if (other.status === 'ok' && mine.status === 'ok') {
        var diff = mine.finishBase - other.finishBase;
        if (!UI.planPreviewAlt && diff >= 1) {
          alt = '<p class="guide-alt">다른 줄을 고르면 ' + diff + '일 빨리 끝납니다 <button type="button" class="btn btn-small" data-action="preview-alt">보기</button></p>';
        } else if (UI.planPreviewAlt) {
          alt = '<p class="guide-alt">다른 기준의 줄을 보고 있습니다. <button type="button" class="btn btn-small" data-action="preview-alt">원래대로</button></p>';
        }
      }
    }
    return '<section class="guide" aria-label="길잡이"><div class="guide-row">' + sel + '<p class="guide-text" id="guide-text">' + text + '</p></div>' + alt + '</section>';
  }

  function panelBoard(D) {
    var out = '';
    if (!started()) out += '<p class="card">시작일을 정하면 5주가 시작됩니다.</p>';
    else if (UI.day < 1) out += '<p class="card">시작까지 <strong>' + (1 - UI.day) + '일</strong> 남았습니다 (' + mdText(S.core.startDate) + '). 판은 미리 볼 수 있고 기록은 시작일부터 할 수 있습니다.</p>';
    else if (UI.day > board.rules.DAYS) out += finishHtml(D);
    out += guideHtml(D);
    out += '<div class="board-wrap">' + boardHtml(D) + '</div>';
    out += lineInfoHtml(D);
    out += '<ul class="legend" aria-label="범례"><li><span class="bx bx-off"></span> 비어 있음</li><li><span class="bx bx-pend"></span> 확인 대기</li><li><span class="bx bx-on"></span> 도장 확정</li><li><span class="lg-guide"></span> 길잡이 추천 칸</li></ul>';
    return out;
  }

  function finishHtml(D) {
    var areas = { en: 0, fit: 0, ai: 0, family: 0 };
    S.core.stickers.forEach(function (s) { if (s.status === 'confirmed') areas[cellOf(s.cell).area]++; });
    var rw = board.rules.REWARD_LINES.map(function (n) {
      return '<li>' + n + '빙고 ' + (D.bingo >= n ? '✓ 달성' : '미달성') + ': ' + h(S.settings.rewards[n]) + '</li>';
    }).join('');
    var startEnd = ['시작 기록', '종료 기록'].map(function (t) {
      var c = board.cells.filter(function (x) { return x.title === t; })[0];
      return c ? t + ' ' + (D.prog[c.id].complete ? '있음' : '없음') : '';
    }).filter(Boolean).join(' · ');
    return '<section class="card finish"><h2>5주를 마쳤습니다</h2>' +
      '<p>빙고 <strong>' + D.bingo + '</strong>줄 · 스티커 <strong>' + D.confirmed + '</strong>개 (영어 ' + areas.en + ' · 체력 ' + areas.fit + ' · AI ' + areas.ai + ' · 가족 ' + areas.family + ')</p>' +
      '<ul class="plain">' + rw + '</ul><p>' + h(startEnd) + '</p>' +
      '<p class="muted">35일차에 한 확인 대기는 36일차까지 가족이 도장을 찍을 수 있습니다. 판과 현황은 계속 볼 수 있습니다.</p>' +
      '<div class="btn-row"><button type="button" class="btn" data-action="export">내보내기</button> ' +
      '<a class="btn" href="print.html" target="_blank" rel="noopener">인쇄용 판</a> ' +
      '<button type="button" class="btn btn-danger" data-action="reset">새로 시작(초기화)</button></div></section>';
  }

  /* ── 못 하는 이유를 가족에게 읽어 줄 문장으로 ─────── */
  function dayWord(day) { return day === UI.day ? '오늘' : '어제'; }
  function partsText(parts) { return (parts || []).map(function (p) { return PART_NAME[p] || p; }).join('·'); }

  function reasonText(av, cell, day) {
    var d = av.detail || {};
    var w = dayWord(day);
    switch (av.reason) {
      case 'NOT_OWNER': return '가족 확인 중에는 기록하지 않습니다. 먼저 [잠그기]를 눌러 주세요.';
      case 'NOT_STARTED': return '아직 시작 전입니다. 시작일은 ' + mdText(S.core.startDate) + '입니다.';
      case 'SEASON_OVER': return '5주가 끝나 더 기록할 수 없습니다.';
      case 'CLOCK_SUSPECT': return '기기 날짜가 기록보다 앞서 있어 기록할 수 없습니다. 날짜가 돌아오면 풀립니다.';
      case 'BAD_DAY': return '오늘이나 어제만 기록할 수 있습니다.';
      case 'CELL_FULL': return '이 칸의 네모를 모두 채웠습니다 (도장을 기다리는 것 포함).';
      case 'SAME_CELL_SAME_DAY': return '이 칸은 하루에 1개입니다. ' + w + '는 이미 했습니다.';
      case 'OUT_OF_WINDOW':
        if (d.early) return d.from + '일차(' + dayMd(d.from) + ')부터 할 수 있습니다.';
        /* 기간 끝 다음 날: 오늘 날짜로는 안 되지만 "어제 한 일"로는 아직 기록할 수 있다. */
        if (!UI.claimYesterday && UI.day === d.to + board.rules.BACKDATE_DAYS) return '기간(' + d.from + '~' + d.to + '일차)이 어제 끝났습니다. 어제 했다면 [어제 한 일 기록]으로 바꿔 오늘까지 기록할 수 있습니다.';
        return '기간(' + d.from + '~' + d.to + '일차)이 지났습니다. 이 칸이 든 줄은 완성할 수 없습니다.';
      case 'LEVEL_LOCKED': {
        var lower = cellOf(d.lower);
        if (d.confirmed + d.pending >= d.boxes) return lower.title + '에 확인 대기 중인 스티커가 있습니다(지금 ' + d.confirmed + '개 확정, ' + d.pending + '개 확인 대기). 가족 도장을 받으면 열립니다.';
        return lower.title + '에 도장 ' + d.boxes + '개가 다 찍혀야 열립니다 (지금 ' + d.confirmed + '개 확정, ' + d.pending + '개 확인 대기).';
      }
      case 'LADDER_DAILY': return board.ladderNames[cell.ladder] + ' 사다리는 하루에 한 계단만 오릅니다.';
      case 'WEEKLY_USED': return '이 칸은 한 주에 1개입니다. ' + d.week + '주차에는 이미 했습니다.';
      case 'DAILY_CAP':
        return w + ' ' + board.rules.DAILY_CAP + '개를 다 채웠습니다.' + (day === UI.day ? ' 내일 다시.' : '');
      case 'AREA_CAP': return areaName(d.area) + '는 ' + w + ' ' + board.rules.AREA_DAILY_CAP + '개를 채웠습니다.';
      case 'STRENGTH_DAILY': return '근력 운동은 하루에 하나만 합니다 (' + w + ' ' + cellOf(d.cell).title + ' 기록이 있습니다).';
      case 'PART_CONSECUTIVE': {
        var when = d.day === day - 1 ? '전날' : (d.day === day + 1 ? '다음 날' : d.day + '일차');
        return when + ' ' + cellOf(d.cell).title + ' 기록이 있어 ' + w + '는 ' + partsText(d.parts) + ' 운동을 쉽니다.';
      }
      case 'IMPACT_DAILY': return '달리기·트레일은 하루에 하나만 합니다.';
      case 'IMPACT_CONSECUTIVE': return '달리기·트레일은 이틀 연속 하지 않습니다 (' + d.day + '일차에 ' + cellOf(d.cell).title + ').';
      case 'REST_CONFLICT':
        return cell.rest ? '쉬는 날은 근력·유산소를 하지 않은 날에만 받을 수 있습니다 (' + cellOf(d.cell).title + ' 기록 있음).'
          : '그날을 쉬는 날로 기록해서 근력·유산소 칸은 할 수 없습니다.';
      default: return '지금은 기록할 수 없습니다.';
    }
  }

  /* 이 칸의 [했어요]가 지금 되는가. 사유까지 한 번에. */
  function claimState(cellId) {
    var cell = cellOf(cellId);
    var day = claimDayNow();
    var prog = rules.cellProgress(board, S.core, cellId);
    if (store.isReadOnly()) return { ok: false, text: '읽기 전용이라 기록할 수 없습니다.' };
    if (prog.complete) return { ok: false, text: '이 칸은 완성했습니다.' };
    var chk = rules.canClaim(board, S.core, { cell: cellId, day: day, today: UI.day, actor: gate.currentActor() });
    if (chk.ok) return { ok: true };
    return { ok: false, text: reasonText(chk, cell, day) };
  }

  function claimButton(cellId, label, extraCls) {
    var st = claimState(cellId);
    var id = 'why-' + cellId;
    return '<button type="button" class="btn btn-primary btn-claim ' + (extraCls || '') + '" data-action="claim" data-cell="' + h(cellId) + '" data-fk="claim:' + h(cellId) + '"' +
      (st.ok ? '' : ' aria-disabled="true" aria-describedby="' + h(id) + '"') + '>' + h(label || '했어요') + '</button>' +
      (st.ok ? '' : '<span class="why" id="' + h(id) + '">' + h(st.text) + '</span>');
  }

  /* ── 스티커 한 줄 (도장·취소 버튼 포함) ────────────── */
  function stickerRowHtml(s) {
    var cell = cellOf(s.cell);
    var status = s.status === 'confirmed' ? '확정' + (s.alt ? ' (대체 미션)' : '') : '확인 대기';
    var deadline = '';
    if (s.status === 'pending') {
      deadline = s.day + board.rules.STAMP_GRACE_DAYS === UI.day ? ' <strong class="due">오늘까지 도장을 받아야 합니다</strong>' : ' <span class="muted">' + (s.day + board.rules.STAMP_GRACE_DAYS) + '일차까지</span>';
    }
    var actions = '';
    if (gate.isUnlocked()) {
      if (s.status === 'pending') {
        actions = (cell.area === 'fit' ? '<label class="alt"><input type="checkbox" data-alt="' + h(s.id) + '"> 대체 미션으로 인정</label>' : '') +
          '<button type="button" class="btn btn-primary" data-action="stamp" data-id="' + h(s.id) + '" data-fk="stamp:' + h(s.id) + '">도장</button>' +
          '<button type="button" class="btn" data-action="reject" data-id="' + h(s.id) + '">돌려보내기</button>';
      } else {
        actions = '<button type="button" class="btn" data-action="revoke" data-id="' + h(s.id) + '">취소</button>';
      }
    } else if (s.status === 'pending') {
      actions = '<button type="button" class="btn" data-action="cancel-own" data-id="' + h(s.id) + '">내 기록 취소</button>';
    }
    return '<li class="srow s-' + s.status + '"><div class="srow-main"><strong>' + h(cell.title) + '</strong> ' +
      '<span class="muted">' + s.day + '일차(' + h(dayMd(s.day)) + ') · ' + status + '</span>' + deadline + '</div>' +
      (actions ? '<div class="srow-actions">' + actions + '</div>' : '') + '</li>';
  }

  /* ── 칸 상세 시트 ──────────────────────────────────── */
  var sheetCellId = null;

  function openSheet(cellId) {
    sheetCellId = cellId;
    UI.sheetNote = '';
    var cell = cellOf(cellId);
    openDialog({
      title: cell.title, sheet: true, role: 'dialog',
      onClose: function () { sheetCellId = null; UI.sheetNote = ''; },
      render: function (body, close, handle) {
        var D = derive();
        var prog = D.prog[cellId];
        var pos = cell.row + '행 ' + cell.col + '열';
        var stickers = S.core.stickers.filter(function (s) { return s.cell === cellId; }).sort(function (a, b) { return a.day - b.day; });
        var lines = board.lines.filter(function (l) { return l.cells.indexOf(cellId) >= 0; }).map(function (l) {
          var st = D.lineById[l.id];
          return '<li>' + h(l.label) + ' — ' + (st.complete ? '완성' : '남은 스티커 ' + st.remaining + '개' + (st.hiddenPrereq ? ' (줄 밖 선행 ' + st.hiddenPrereq + ' 포함)' : '')) + '</li>';
        }).join('');
        body.innerHTML =
          (UI.sheetNote ? '<p class="banner banner-warn" role="status">' + h(UI.sheetNote) + '</p>' : '') +
          '<p class="sheet-meta"><span class="area-tag area-' + cell.area + '">' + h(board.areas[cell.area].mark) + '</span> ' + h(areaName(cell.area)) + ' · ' + pos + ' · ' + h(kindText(cell)) + '</p>' +
          '<dl class="sheet-dl"><dt>한 번의 기준 (스티커 1개)</dt><dd>' + h(cell.unit) + '</dd>' +
          '<dt>가족이 보는 것</dt><dd>' + h(cell.verify) + '</dd></dl>' +
          '<div class="sheet-boxes area-' + cell.area + '" aria-label="네모 ' + cell.boxes + '개 중 확정 ' + prog.confirmed + '개, 확인 대기 ' + prog.pending + '개">' + boxesHtml(cell, prog, true) + '</div>' +
          (stickers.length ? '<ul class="slist">' + stickers.map(stickerRowHtml).join('') + '</ul>' : '<p class="muted">아직 붙인 스티커가 없습니다.</p>') +
          '<div class="claim-block">' + claimDayToggle() + claimButton(cellId) + '</div>' +
          (cell.kind === 'fixed' ? '<p class="muted">이 칸은 ' + cell.window.from + '~' + cell.window.to + '일차(' + h(dayMd(cell.window.from)) + '~' + h(dayMd(cell.window.to)) + ')에만 할 수 있습니다.</p>' : '') +
          '<h3 class="sheet-h">이 칸이 속한 줄</h3><ul class="plain">' + lines + '</ul>';
        return $('.btn-claim', body) || $('.dialog-title', handle.el);
      }
    });
  }

  function claimDayToggle() {
    if (!started() || UI.day < 1 || UI.day > board.rules.DAYS) return '';
    return '<div class="seg" role="group" aria-label="기록할 날">' +
      '<button type="button" class="seg-b' + (!UI.claimYesterday ? ' on' : '') + '" data-action="day-mode" data-mode="today" aria-pressed="' + !UI.claimYesterday + '" data-keep="seg-today">오늘</button>' +
      '<button type="button" class="seg-b' + (UI.claimYesterday ? ' on' : '') + '" data-action="day-mode" data-mode="yesterday" aria-pressed="' + UI.claimYesterday + '"' + (UI.day <= 1 ? ' aria-disabled="true"' : '') + ' data-keep="seg-yesterday">어제 한 일 기록</button></div>';
  }

  /* ── [오늘] ────────────────────────────────────────── */
  function usageHtml(D) {
    var u = D.usage, R = board.rules;
    return '<p class="usage" aria-label="남은 상한">전체 <strong>' + u.total + '/' + R.DAILY_CAP + '</strong> · ' +
      AREA_ORDER.map(function (a) { return areaName(a) + ' ' + u.byArea[a] + '/' + R.AREA_DAILY_CAP; }).join(' · ') + '</p>';
  }

  function claimRow(cell, D, showWhy) {
    var prog = D.prog[cell.id];
    return '<li class="crow"><div class="crow-main"><span class="area-tag area-' + cell.area + '">' + h(board.areas[cell.area].mark) + '</span> ' +
      '<button type="button" class="linkish" data-action="open-cell" data-cell="' + h(cell.id) + '">' + h(cell.title) + '</button> ' +
      '<span class="muted">네모 ' + (prog.confirmed + prog.pending) + '/' + cell.boxes + '</span></div>' +
      '<div class="crow-act">' + (showWhy === false ? '' : claimButton(cell.id)) + '</div></li>';
  }

  function panelToday(D) {
    var out = '';
    if (!started()) return '<p class="card">시작일을 정하면 기록할 수 있습니다.</p>';
    if (UI.day < 1) return '<p class="card">시작까지 <strong>' + (1 - UI.day) + '일</strong> 남았습니다. 시작일(' + mdText(S.core.startDate) + ')부터 기록할 수 있습니다.</p>';
    if (UI.day > board.rules.DAYS) {
      out += finishHtml(D);
      if (D.pending.length) out += '<h2 class="sec">도장을 기다리는 스티커</h2><ul class="slist">' + D.pending.map(stickerRowHtml).join('') + '</ul>' + familyButton();
      return out;
    }
    var day = claimDayNow();
    out += '<div class="today-top">' + claimDayToggle() + '</div>';
    out += '<h2 class="sec">' + (UI.claimYesterday ? '어제(' + day + '일차)' : '오늘(' + day + '일차)') + ' 남은 상한</h2>' + usageHtml(D);

    /* 확인 대기 */
    out += '<h2 class="sec">확인 대기 <span class="muted">' + D.pending.length + '개</span></h2>';
    if (D.pending.length) {
      var urgent = D.pending.some(function (s) { return s.day + board.rules.STAMP_GRACE_DAYS === UI.day; });
      if (urgent) out += '<p class="due-note">오늘까지 도장을 받아야 하는 것이 있습니다.</p>';
      out += '<ul class="slist">' + D.pending.map(stickerRowHtml).join('') + '</ul>';
      out += familyButton();
    } else {
      out += '<p class="muted">도장을 기다리는 스티커가 없습니다.</p>';
    }

    /* 오늘 추천 */
    var plan = D.plan;
    var recIds = [];
    if (plan && plan.status === 'ok') recIds = guide.recommendToday(board, S.core, plan, day, UI.day);
    out += '<h2 class="sec">' + (UI.claimYesterday ? '어제' : '오늘') + ' 추천</h2>';
    if (recIds.length) {
      out += '<ul class="clist">' + recIds.map(function (id) { return claimRow(cellOf(id), D); }).join('') + '</ul>';
    } else {
      out += '<p class="muted">' + (D.usage.total >= board.rules.DAILY_CAP ? '오늘은 ' + board.rules.DAILY_CAP + '개를 다 채웠습니다. 내일 다시.' : '추천할 칸이 없습니다. 아래 목록에서 고를 수 있습니다.') + '</p>';
    }

    /* 할 수 있는 다른 칸 / 못 하는 칸 */
    var can = {}, cannot = [];
    AREA_ORDER.concat(['family']).forEach(function (a) { can[a] = []; });
    board.cells.forEach(function (c) {
      var av = D.av[c.id];
      if (av.state === 'complete') return;
      if (av.ok && recIds.indexOf(c.id) < 0) can[c.area].push(c);
      else if (!av.ok) cannot.push(c);
    });
    var canHtml = AREA_ORDER.concat(['family']).map(function (a) {
      if (!can[a].length) return '';
      return '<h3 class="sheet-h">' + h(areaName(a)) + '</h3><ul class="clist">' + can[a].map(function (c) { return claimRow(c, D); }).join('') + '</ul>';
    }).join('');
    out += '<details class="fold"><summary>' + (UI.claimYesterday ? '어제' : '오늘') + ' 할 수 있는 다른 칸</summary>' + (canHtml || '<p class="muted">없습니다.</p>') + '</details>';
    var cannotHtml = cannot.map(function (c) {
      var st = claimState(c.id);
      return '<li class="crow"><div class="crow-main"><span class="area-tag area-' + c.area + '">' + h(board.areas[c.area].mark) + '</span> ' +
        '<button type="button" class="linkish" data-action="open-cell" data-cell="' + h(c.id) + '">' + h(c.title) + '</button>' +
        '<div class="why-inline">' + h(st.text || reasonText({ reason: D.av[c.id].reason, detail: D.av[c.id].detail }, c, day)) + '</div></div></li>';
    }).join('');
    out += '<details class="fold"><summary>' + (UI.claimYesterday ? '어제' : '오늘') + '은 못 하는 칸 <span class="muted">' + cannot.length + '개</span></summary><ul class="clist">' + (cannotHtml || '<li class="muted">없습니다.</li>') + '</ul></details>';
    return out;
  }

  function familyButton() {
    return '<p><button type="button" class="btn btn-primary" data-action="family">' + (gate.isUnlocked() ? '가족 확인 끄기' : '가족 도장') + '</button></p>';
  }

  /* ── [현황] ────────────────────────────────────────── */
  function logText(e) {
    var cell = e.cell && cellOf(e.cell) ? cellOf(e.cell).title : '';
    var when = mdText((e.at || '').slice(0, 10));
    switch (e.type) {
      case 'expire': return when + ' · 도장을 못 받아 사라짐: ' + cell + '(' + e.day + '일차)';
      case 'reject': return when + ' · 가족이 돌려보냄: ' + cell + '(' + e.day + '일차)';
      case 'revoke': return when + ' · 가족이 취소: ' + cell + '(' + e.day + '일차)';
      case 'cancel': return when + ' · 내가 취소: ' + cell + '(' + e.day + '일차)';
      case 'pin-reset': return when + ' · 가족 비밀번호를 다시 정함';
      case 'start-change': return when + ' · 시작일을 ' + mdText(e.to) + '로 바꿈';
      case 'import': return when + ' · 가져오기로 기록을 바꿈';
      case 'reset': return when + ' · 초기화';
      default: return when;
    }
  }

  function panelStatus(D) {
    var R = board.rules, goal = R.GOAL_LINES;
    var out = '<section class="card"><h2 class="sec first">빙고</h2>';
    out += '<p class="big">' + (D.bingo > goal ? D.bingo + '/' + board.lines.length : D.bingo + '/' + goal) + ' <span class="muted">줄 완성</span></p>';
    var nextReward = R.REWARD_LINES.filter(function (n) { return D.bingo < n; })[0];
    if (nextReward) out += '<p class="muted">다음 보상(' + nextReward + '빙고)까지 ' + (nextReward - D.bingo) + '줄</p>';
    out += '</section>';

    var tot = { en: 0, fit: 0, ai: 0, family: 0 }, conf = { en: 0, fit: 0, ai: 0, family: 0 }, pend = { en: 0, fit: 0, ai: 0, family: 0 };
    board.cells.forEach(function (c) { tot[c.area] += c.boxes; conf[c.area] += D.prog[c.id].confirmed; pend[c.area] += D.prog[c.id].pending; });
    out += '<section class="card"><h2 class="sec first">스티커 ' + D.confirmed + '개 <span class="muted">/ 판 전체 120개</span></h2>';
    AREA_ORDER.concat(['family']).forEach(function (a) {
      out += '<div class="bar-row"><span class="bar-l area-' + a + '">' + h(areaName(a)) + '</span><div class="bar" role="img" aria-label="' + h(areaName(a)) + ' 확정 ' + conf[a] + ', 확인 대기 ' + pend[a] + ', 전체 ' + tot[a] + '">' +
        '<span class="bar-c area-' + a + '" style="width:' + (conf[a] / tot[a] * 100) + '%"></span><span class="bar-p area-' + a + '" style="width:' + (pend[a] / tot[a] * 100) + '%"></span></div>' +
        '<span class="bar-n">' + conf[a] + (pend[a] ? '+' + pend[a] : '') + '/' + tot[a] + '</span></div>';
    });
    out += '<p class="muted">+ 숫자는 확인 대기입니다.</p></section>';

    var sorted = D.lines.map(function (l, i) { return { l: l, i: i }; }).sort(function (a, b) {
      return (a.l.complete === b.l.complete ? 0 : (a.l.complete ? 1 : -1)) || a.l.remaining - b.l.remaining || a.i - b.i;
    });
    out += '<section class="card"><h2 class="sec first">줄 16개 <span class="muted">남은 스티커 순</span></h2><ul class="lines">' + sorted.map(function (x) {
      var line = board.lines[x.i];
      return '<li class="' + (x.l.complete ? 'done' : '') + '"><button type="button" class="linkish" data-action="line-go" data-line="' + h(line.id) + '">' + h(line.label) + '</button>' +
        '<span>' + (x.l.complete ? '완성 ✓' : '남은 ' + x.l.remaining + (x.l.hiddenPrereq ? ' (선행 ' + x.l.hiddenPrereq + ' 포함)' : '')) + '</span></li>';
    }).join('') + '</ul></section>';

    out += '<section class="card"><h2 class="sec first">사다리</h2><ul class="plain">' + Object.keys(board.ladders).map(function (l) {
      var ids = board.ladders[l], done = 0, cur = null;
      ids.forEach(function (id, i) { if (D.prog[id].complete && done === i) done = i + 1; });
      cur = done < ids.length ? cellOf(ids[done]) : null;
      return '<li><strong>' + h(board.ladderNames[l]) + '</strong>: ' + (done === ids.length ? '끝까지 올랐습니다' : (done ? 'LV' + done + ' 완료 · ' : '') + h(cur.title) + ' 진행 중') + '</li>';
    }).join('') + '</ul></section>';

    out += '<section class="card"><h2 class="sec first">연속 기록</h2><p>현재 <strong>' + D.streak.current + '일</strong> · 최장 <strong>' + D.streak.longest + '일</strong></p>' +
      '<p class="muted">도장이 찍힌 스티커가 있는 날이 이어진 길이입니다. 쉬는 날 칸도 스티커라 쉬어도 끊기지 않습니다.</p></section>';

    var perWeek = [0, 0, 0, 0, 0];
    S.core.stickers.forEach(function (s) { if (s.status === 'confirmed') perWeek[rules.weekOf(s.day) - 1]++; });
    var maxW = Math.max(21, Math.max.apply(null, perWeek));
    out += '<section class="card"><h2 class="sec first">주차별 스티커</h2><div class="weeks" role="img" aria-label="주차별 스티커 ' + perWeek.join(', ') + '">' + perWeek.map(function (n, i) {
      return '<div class="wk"><div class="wk-bar"><span style="height:' + (n / maxW * 100) + '%"></span></div><span class="wk-n">' + n + '</span><span class="wk-l">' + (i + 1) + '주</span></div>';
    }).join('') + '</div></section>';

    out += '<section class="card"><h2 class="sec first">보상</h2><ul class="plain">' + R.REWARD_LINES.map(function (n) {
      return '<li>' + (D.bingo >= n ? '✓ ' : '○ ') + n + '빙고 — ' + h(S.settings.rewards[n]) + (D.bingo >= n ? ' <span class="muted">달성</span>' : '') + '</li>';
    }).join('') + '</ul></section>';

    out += '<section class="card"><h2 class="sec first">기록</h2>' + (S.log.length ? '<ul class="plain log">' + S.log.slice().reverse().map(function (e) { return '<li>' + h(logText(e)) + '</li>'; }).join('') + '</ul>' : '<p class="muted">만료·취소·돌려보내기 내역이 없습니다.</p>') + '</section>';
    return out;
  }

  /* ── [규칙] ────────────────────────────────────────── */
  function panelRules() {
    var R = board.rules;
    var out = '<section class="card"><h2 class="sec first">3줄 요약</h2><ol class="plain">' +
      '<li><strong>하루에 스티커 ' + R.DAILY_CAP + '개까지</strong></li>' +
      '<li><strong>한 영역은 하루 ' + R.AREA_DAILY_CAP + '개까지</strong></li>' +
      '<li><strong>가족이 도장을 찍어야 확정</strong></li></ol></section>';
    out += '<section class="card care"><h2 class="sec first">아프면 멈춥니다</h2>' +
      '<p>통증이 있으면 그 운동을 중단하고 그날은 쉬는 날이나 스트레칭 칸으로 바꿉니다. 통증이 이어지면 전문가와 상의하세요. ' +
      '다쳐서 어떤 체력 칸을 못 하게 되면 가족과 상의해 <strong>대체 미션</strong>(예: 턱걸이 대신 걷기 20분)으로 도장을 받을 수 있습니다. 가족이 도장을 찍을 때 "대체 미션으로 인정"을 표시합니다.</p>' +
      '<p class="muted">이 앱의 운동 내용(세트 수, 거리 등)은 일반적인 안전 원칙 수준의 예시입니다. 개인 처방이 아닙니다.</p></section>';
    function fold(title, html, open) { return '<details class="fold"' + (open ? ' open' : '') + '><summary>' + title + '</summary>' + html + '</details>'; }
    out += fold('1. 기본', '<ol class="plain"><li><strong>기간은 35일(5주).</strong> 시작일이 1일차, 7일씩 1~5주차입니다.</li>' +
      '<li><strong>목표는 7빙고.</strong> 가로·세로·대각선 16줄 중 7줄의 칸을 모두 완성하면 됩니다. 3빙고·5빙고에도 작은 보상이 있습니다.</li>' +
      '<li><strong>칸에는 네모가 1~5개 있습니다.</strong> 한 번 할 때마다 스티커 1개. 네모를 다 채워야 그 칸이 완성됩니다.</li>' +
      '<li><strong>스티커는 가족이 도장을 찍어야 확정됩니다.</strong> 내가 "했어요"를 누르면 \'확인 대기\'가 되고, 가족이 인증을 보고 도장을 찍습니다.</li>' +
      '<li><strong>도장은 한 날이나 그다음 날까지.</strong> 그 뒤에는 확인 대기가 사라지고 다시 해야 합니다. 깜빡하고 안 눌렀으면 다음 날 "어제 한 일"로 기록할 수 있습니다(그 경우 그날 안에 도장을 받아야 합니다).</li></ol>', true);
    out += fold('2. 하루에 할 수 있는 양', '<ol class="plain" start="6"><li><strong>하루에 스티커는 모두 합쳐 ' + R.DAILY_CAP + '개까지.</strong> 기본 속도는 영어·체력·AI 하나씩 하루 3개입니다. 4번째는 밀린 날 만회용입니다.</li>' +
      '<li><strong>한 영역은 하루 ' + R.AREA_DAILY_CAP + '개까지.</strong> 가족 칸은 영역에 속하지 않지만 하루 ' + R.DAILY_CAP + '개에는 들어갑니다.</li>' +
      '<li><strong>같은 칸은 하루 1개.</strong></li></ol>');
    out += fold('3. 칸의 종류', '<ol class="plain" start="9"><li><strong>반복 칸</strong> — 네모 2~5개. 하루에 1개씩 채웁니다.</li>' +
      '<li><strong>레벨 칸(사다리)</strong> — 영역마다 사다리가 하나 있습니다(영어 발표 LV1~4, 턱걸이 LV1~5, 미니 프로젝트 LV1~5). 앞 레벨에 도장이 다 찍혀야 다음 레벨이 열립니다. 한 사다리에서는 하루에 한 계단(스티커 1개)만 오릅니다.</li>' +
      '<li><strong>주차 고정 칸</strong> — 정해진 기간에만 인증할 수 있습니다. 시작 계열(영어 기준 녹음, 체력 시작 기록, AI 목표 선언)은 1~10일차, 체력 중간 기록은 15~24일차, 종료 계열(영어 3분 발표 비교, 체력 종료 기록, AI 회고)은 29~35일차입니다.</li>' +
      '<li><strong>1회 칸</strong> — 네모 1개. 언제든 한 번.</li>' +
      '<li><strong>주 1회 칸</strong> — 가족 보고회와 쉬는 날은 한 주에 1개만 받을 수 있습니다. 네모가 4개라 5주 중 4번이면 완성입니다(한 주는 빠져도 됩니다).</li></ol>');
    out += fold('4. 다치지 않기 위한 체력 규칙', '<ol class="plain" start="14"><li><strong>근력 칸은 하루 1개.</strong> 근력 칸은 턱걸이 사다리, 푸시업, 스쿼트·런지, 덤벨 상체입니다.</li>' +
      '<li><strong>같은 부위는 이틀 연속 하지 않습니다.</strong> 턱걸이 사다리는 \'당기기\', 푸시업은 \'밀기\', 스쿼트·런지는 \'하체\', 덤벨 상체는 \'당기기+밀기\'로 봅니다. 그래서 턱걸이는 언제나 하루 이상 띄우게 됩니다.</li>' +
      '<li><strong>달리기와 트레일은 하루에 하나, 이틀 연속 금지.</strong></li>' +
      '<li><strong>달리기 거리는 네모 순서대로만 늘립니다.</strong> 네모에 적힌 거리(3km·3km·5km·5km·7km)는 그날의 상한입니다. 더 짧게 뛰거나 걷기를 섞어도 스티커는 인정합니다.</li>' +
      '<li><strong>쉬는 날 칸은 근력·유산소 칸을 하지 않은 날에만</strong> 받을 수 있습니다. 스트레칭과 기록 칸은 같이 해도 됩니다.</li></ol>');
    out += fold('5. 규칙을 판정할 때 무엇을 세는가', '<p>하루 상한·영역 상한·같은 칸 하루 1개·근력과 달리기 간격·주 1회·쉬는 날 충돌은 <strong>확인 대기와 확정을 모두</strong> 셉니다. 칸 완성·줄 완성·빙고 수·레벨 열림은 <strong>확정만</strong> 셉니다. 날짜는 도장 찍은 날이 아니라 "한 날"(스티커의 일차) 기준입니다.</p>');
    out += '<section class="card"><h2 class="sec first">가족 확인에 대해</h2><p><strong>이것은 보안 장치가 아니라 약속 장치입니다.</strong> 비밀번호는 이 기기에 그대로 저장되어 개발자 도구로 볼 수 있습니다. 본인이 스스로 도장을 찍지 않겠다는 약속을 한 번 더 떠올리게 하는 것이 목적입니다.</p></section>';
    out += '<p><a class="btn" href="print.html" target="_blank" rel="noopener">인쇄용 판 열기</a></p>';
    return out;
  }

  /* ── [설정] ────────────────────────────────────────── */
  function panelSettings(D) {
    var s = S.settings;
    var out = '';
    out += '<section class="card"><h2 class="sec first">시작일</h2>' +
      '<div class="field-row"><label for="start-date" class="sr-only">시작일</label><input type="date" id="start-date" value="' + h(S.core.startDate || '') + '">' +
      '<button type="button" class="btn" data-action="start-change">바꾸기</button></div>' +
      '<p class="help">스티커는 날짜가 아니라 일차로 저장되어 시작일을 옮기면 기록이 함께 따라갑니다. 기록이 있으면 시작일을 앞당기는 것만 됩니다.</p></section>';
    out += '<section class="card"><h2 class="sec first">보상 문구</h2>' + board.rules.REWARD_LINES.map(function (n) {
      return '<div class="field"><label for="rw-' + n + '">' + n + '빙고</label><input type="text" id="rw-' + n + '" data-reward="' + n + '" maxlength="80" value="' + h(s.rewards[n]) + '"></div>';
    }).join('') + '<p class="help">가족 단위 보상입니다. 문구는 언제든 고칠 수 있습니다.</p></section>';
    out += '<section class="card"><h2 class="sec first">가족 비밀번호</h2><div id="pin-manage"></div>' +
      '<p class="help"><strong>이것은 보안 장치가 아니라 약속 장치입니다.</strong> 비밀번호는 이 기기에 그대로 저장되어 개발자 도구로 볼 수 있습니다. 본인이 스스로 도장을 찍지 않겠다는 약속을 한 번 더 떠올리게 하는 것이 목적입니다.</p></section>';
    out += '<section class="card"><h2 class="sec first">화면</h2><div class="radios" role="radiogroup" aria-label="화면 색">' +
      [['auto', '자동'], ['light', '밝게'], ['dark', '어둡게']].map(function (x) {
        return '<label class="radio"><input type="radio" name="theme" value="' + x[0] + '"' + (s.theme === x[0] ? ' checked' : '') + '> ' + x[1] + '</label>';
      }).join('') + '</div></section>';
    out += '<section class="card"><h2 class="sec first">길잡이 기준</h2><div class="radios" role="radiogroup" aria-label="길잡이 기준">' +
      [['fewest', '스티커가 가장 적게'], ['fastest', '가장 빨리']].map(function (x) {
        return '<label class="radio"><input type="radio" name="gmode" value="' + x[0] + '"' + (s.guideMode === x[0] ? ' checked' : '') + '> ' + x[1] + '</label>';
      }).join('') + '</div></section>';
    out += '<section class="card"><h2 class="sec first">내보내기 · 가져오기</h2>' +
      '<div class="btn-row"><button type="button" class="btn" data-action="export">내보내기 (파일로 저장)</button></div>' +
      '<details class="fold"><summary>내용 보기·복사</summary><textarea id="export-text" class="mono" readonly rows="6" aria-label="내보낸 내용">' + h(store.exportText(S)) + '</textarea>' +
      '<button type="button" class="btn" data-action="copy-export">복사</button></details>' +
      '<h3 class="sheet-h">가져오기</h3>' +
      '<p class="help">가져오면 지금 기록이 모두 바뀝니다 (합치지 않습니다). 바꾸기 전에 지금 기록을 자동으로 파일로 저장합니다.</p>' +
      '<div class="field"><label for="import-file">파일 고르기</label><input type="file" id="import-file" accept=".json,application/json"></div>' +
      '<div class="field"><label for="import-text">또는 붙여넣기</label><textarea id="import-text" class="mono" rows="4"></textarea></div>' +
      '<button type="button" class="btn" data-action="import-check">가져오기 확인</button></section>';
    out += '<section class="card"><h2 class="sec first">초기화</h2><p class="help">스티커와 기록을 모두 지우고 처음부터 시작합니다.</p>' +
      '<button type="button" class="btn btn-danger" data-action="reset">초기화</button></section>';
    out += '<section class="card"><h2 class="sec first">버전</h2><p class="muted">앱 ' + APP_VERSION + ' · 판 ' + h(board.id) + ' · 스키마 ' + store.SCHEMA + '</p>' +
      '<p class="muted">기록은 이 브라우저에만 저장됩니다. 다른 기기로 옮기려면 내보내기를 쓰세요.</p></section>';
    return out;
  }

  /* ── 전체 그리기 ───────────────────────────────────── */
  var TABS = [['board', '판'], ['today', '오늘'], ['status', '현황'], ['rules', '규칙'], ['settings', '설정']];

  function render() {
    if (EMBED || !S) return;
    var D = derive();
    renderHead(D);
    renderBanners();
    TABS.forEach(function (t) {
      var b = $('#tab-' + t[0]);
      var on = UI.tab === t[0];
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('on', on);
    });
    var panel = $('#panel');
    panel.setAttribute('aria-labelledby', 'tab-' + UI.tab);
    var scrollY = window.scrollY;
    var ae = document.activeElement;
    var fk = ae && panel.contains(ae) ? ae.getAttribute('data-fk') : null;
    var focusedCell = ae && ae.classList && ae.classList.contains('cell') && panel.contains(ae) ? ae.getAttribute('data-cell') : null;
    if (!UI.focusCell) UI.focusCell = board.cells[0].id;

    var html = '';
    if (UI.tab === 'board') html = panelBoard(D);
    else if (UI.tab === 'today') html = panelToday(D);
    else if (UI.tab === 'status') html = panelStatus(D);
    else if (UI.tab === 'rules') html = panelRules();
    else html = panelSettings(D);
    panel.innerHTML = html;
    if (UI.tab === 'settings') gate.renderManage($('#pin-manage'), onPinChanged);

    window.scrollTo(0, scrollY);
    if (focusedCell) { var c = $('.cell[data-cell="' + focusedCell + '"]', panel); if (c) c.focus({ preventScroll: true }); }
    else if (fk) { var f = $('[data-fk="' + fk + '"]', panel); if (f) f.focus({ preventScroll: true }); }
  }

  function setTab(name, focus) {
    UI.tab = name;
    render();
    if (focus) $('#tab-' + name).focus();
  }

  /* 비밀번호 저장과 재설정 기록은 gate.init의 setPin이 이미 했다. 여기서는 알리기만 한다. */
  function onPinChanged(kind) {
    announce(kind === 'reset' ? '가족 비밀번호를 다시 정했습니다.' : '가족 비밀번호를 바꿨습니다.');
  }

  /* ── 조작 ──────────────────────────────────────────── */
  function completeLineIds() { return rules.lineStatus(board, S.core).filter(function (l) { return l.complete; }).map(function (l) { return l.id; }); }
  function lineLabel(id) { return board.lines.filter(function (l) { return l.id === id; })[0].label; }

  function afterChange(before) {
    var after = completeLineIds();
    var gained = after.filter(function (id) { return before.indexOf(id) < 0; });
    if (gained.length) announce(gained.map(lineLabel).join(', ') + ' 완성. ' + after.length + '빙고.');
    /* 보상 축하: 처음 3·5·7에 닿을 때만. 취소로 내려가도 이미 본 축하는 다시 띄우지 않는다. */
    var reach = board.rules.REWARD_LINES.filter(function (n) { return after.length >= n && S.settings.seenRewards.indexOf(n) < 0; });
    if (reach.length) {
      reach.forEach(function (n) { S.settings.seenRewards.push(n); });
      persist();
      var top = reach[reach.length - 1];
      window.setTimeout(function () { celebrate(top); }, 50);
    }
  }

  function celebrate(n) {
    openDialog({
      title: n + '빙고 달성!', role: 'dialog',
      render: function (body, close) {
        body.innerHTML = '<p class="celebrate" aria-hidden="true">🎉</p><p class="dialog-text">' + n + '줄을 완성했습니다. 보상은 <strong>' + h(S.settings.rewards[n]) + '</strong>입니다.' +
          (n >= board.rules.GOAL_LINES ? ' 7빙고 뒤에도 35일차까지 계속 채울 수 있습니다.' : '') + '</p>' +
          '<div class="dialog-actions"><button type="button" class="btn btn-primary" data-ok>좋아요</button></div>';
        $('[data-ok]', body).addEventListener('click', function () { close(); });
        return $('[data-ok]', body);
      }
    });
  }

  /* 안 된 조작은 스크린 리더 안내만으로 끝내지 않고 눈에도 보이게 안내 띠로 남긴다. */
  function warn(text) {
    UI.notices = UI.notices.filter(function (n) { return n.kind !== 'warn-act'; });
    UI.notices.push({ id: 'act-' + Date.now(), kind: 'warn-act', text: text });
    renderBanners();
    /* 칸 상세 시트가 위를 덮고 있으면 띠가 가려지므로 시트 안에도 보여 준다. */
    if (sheetCellId) { UI.sheetNote = text; refreshOpenDialogs(); }
  }

  function doClaim(cellId) {
    var msg = '';
    var failed = false;
    var before = completeLineIds();
    act(function () {
      var day = claimDayNow();
      var res = rules.claim(board, S.core, { cell: cellId, day: day, today: UI.day, at: nowIso(), actor: gate.currentActor() });
      if (!res.ok) {
        msg = reasonText(res, cellOf(cellId), day);
        failed = true;
        return;
      }
      S.core = res.core;
      var u = rules.todayUsage(board, S.core, day);
      msg = cellOf(cellId).title + ' 칸, 확인 대기로 기록했습니다. ' + dayWord(day) + ' ' + board.rules.DAILY_CAP + '개 중 ' + u.total + '개.';
    });
    announce(msg);
    if (failed) warn(msg);
    afterChange(before);
  }

  function needVerifier() {
    if (gate.isUnlocked()) return Promise.resolve(true);
    return gate.requestVerifier();
  }

  function doStamp(id, alt) {
    var before = completeLineIds();
    var msg = '';
    var failed = false;
    act(function () {
      var res = rules.confirm(board, S.core, { stickerId: id, today: UI.day, at: nowIso(), actor: gate.currentActor(), alt: alt });
      if (!res.ok) { failed = true; msg = res.reason === 'STAMP_EXPIRED' ? '도장 기한이 지났습니다.' : res.reason === 'CLOCK_SUSPECT' ? '기기 날짜가 기록보다 앞서 있어 도장을 막았습니다.' : '도장을 찍지 못했습니다.'; return; }
      S.core = res.core;
      msg = cellOf(res.sticker.cell).title + ' 도장을 찍었습니다.' + (alt ? ' 대체 미션으로 인정했습니다.' : '');
    });
    announce(msg);
    if (failed) warn(msg);
    afterChange(before);
  }

  function removeWithLog(kind, id, fnName) {
    var msg = '';
    var failed = false;
    act(function () {
      var res = rules[fnName](board, S.core, { stickerId: id, today: UI.day, actor: gate.currentActor() });
      if (!res.ok) {
        msg = res.reason === 'HIGHER_LEVEL_EXISTS' ? '위 레벨의 스티커를 먼저 취소하세요.' : '처리하지 못했습니다.';
        failed = true;
        return;
      }
      S.core = res.core;
      store.pushLog(S, { at: nowIso(), type: kind, cell: res.sticker.cell, day: res.sticker.day });
      msg = cellOf(res.sticker.cell).title + ' 스티커를 ' + (kind === 'reject' ? '돌려보냈습니다.' : '취소했습니다.') + ' 지금 ' + rules.bingoCount(board, S.core) + '빙고.';
    });
    announce(msg);
    if (failed) warn(msg);
  }

  function toggleFamily() {
    if (gate.isUnlocked()) { gate.lock(); return; }
    if (!gate.isConfigured()) { announce('가족 비밀번호가 아직 없습니다. 설정에서 정해 주세요.'); return; }
    gate.requestVerifier().then(function (ok) { if (ok) announce('가족 확인 모드입니다.'); });
  }

  /* 도장·취소처럼 가족만 할 수 있는 버튼은 잠겨 있으면 확인 절차부터 거친다. */
  function withVerifier(fn) {
    needVerifier().then(function (ok) { if (ok) fn(); });
  }

  /* ── 파일 내보내기 ─────────────────────────────────── */
  function download(name, text) {
    try {
      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return true;
    } catch (e) { return false; }
  }

  function doExport() {
    var ok = download(store.exportFileName(UI.todayStr || localDateStr()), store.exportText(S));
    announce(ok ? '내보내기 파일을 저장했습니다.' : '파일 저장이 막혀 있습니다. 설정의 [내용 보기·복사]를 쓰세요.');
    if (!ok) { UI.tab = 'settings'; render(); }
  }

  /* ── 시작일 바꾸기 (spec 7절) ──────────────────────── */
  function doStartChange() {
    var input = $('#start-date');
    var val = input && input.value;
    if (!val || !rules.parseDate(val)) { announce('날짜를 골라 주세요.'); return; }
    if (val === S.core.startDate) return;
    var newToday = rules.dayNumber(val, UI.todayStr);
    var latest = rules.latestDay(S.core);
    if (S.core.stickers.length && latest > newToday) {
      var limit = rules.dateOfDay(UI.todayStr, 2 - latest);
      UI.notices.push({ id: 'start-' + Date.now(), kind: 'warn', text: '기록이 있어 시작일을 ' + mdText(limit) + '보다 늦출 수 없습니다. 새로 시작하려면 초기화하세요.' });
      renderBanners();
      return;
    }
    askDialog({
      title: '시작일 바꾸기',
      text: '시작일을 <strong>' + h(mdText(val)) + '</strong>로 바꿉니다. 오늘이 <strong>' + newToday + '일차</strong>가 됩니다.' + (S.core.stickers.length ? ' 스티커는 일차 그대로 따라갑니다.' : ''),
      yes: '바꾸기'
    }).then(function (ok) {
      if (!ok) return;
      act(function () {
        S.core = rules.cloneCore(S.core);
        S.core.startDate = val;
        S.core.stickers.forEach(function (st) { st.date = rules.dateOfDay(val, st.day); });
        store.pushLog(S, { at: nowIso(), type: 'start-change', to: val });
        UI.day = computeDay();
      });
      announce('시작일을 ' + mdText(val) + '로 바꿨습니다. 오늘은 ' + UI.day + '일차입니다.');
    });
  }

  /* ── 가져오기 ──────────────────────────────────────── */
  function doImportCheck(text) {
    var res = store.parseImport(text);
    if (!res.ok) { UI.notices.push({ id: 'imp-' + Date.now(), kind: 'error', text: res.error }); renderBanners(); return; }
    var sm = res.summary;
    askDialog({
      title: '가져오기',
      text: '시작일 ' + h(mdText(sm.startDate)) + ', 스티커 ' + sm.stickers + '개, 빙고 ' + sm.bingo + '줄인 기록으로 <strong>지금 기록을 모두 바꿉니다.</strong>' +
        (res.dropped ? ' (읽을 수 없는 스티커 ' + res.dropped + '개는 건너뜁니다.)' : '') +
        (S.core.stickers.length ? ' 바꾸기 전에 지금 기록을 파일로 저장합니다.' : ''),
      yes: '바꾸기', danger: true
    }).then(function (ok) {
      if (!ok) return;
      if (S.core.stickers.length) download('growth-bingo-before-import-' + (UI.todayStr || localDateStr()).replace(/-/g, '') + '.json', store.exportText(S));
      act(function () {
        var next = res.state;
        var count = rules.bingoCount(board, next.core);
        next.settings.seenRewards = board.rules.REWARD_LINES.filter(function (n) { return count >= n; });
        next.log = next.log.concat([{ at: nowIso(), type: 'import' }]);
        S = next;
        UI.day = computeDay();
      });
      applyTheme();
      announce('가져왔습니다.');
    });
  }

  /* ── 초기화 (spec 8-5) ─────────────────────────────── */
  function doReset() {
    openDialog({
      title: '초기화', role: 'alertdialog',
      render: function (body, close) {
        var verified = !gate.isConfigured();
        body.innerHTML = '<p class="dialog-text">스티커 ' + S.core.stickers.length + '개와 기록이 <strong>모두 지워집니다.</strong></p>' +
          '<p><button type="button" class="btn" data-export>먼저 내보내기</button></p>' +
          '<p><button type="button" class="btn" data-verify>' + (verified ? '가족 확인 완료 ✓' : '가족 비밀번호 입력') + '</button></p>' +
          '<div class="field"><label for="reset-word">아래 칸에 <strong>초기화</strong> 세 글자를 직접 쳐 주세요</label><input type="text" id="reset-word" autocomplete="off"></div>' +
          '<div class="dialog-actions"><button type="button" class="btn" data-no>그만두기</button><button type="button" class="btn btn-danger" data-go aria-disabled="true">지우기</button></div>';
        var go = $('[data-go]', body), word = $('#reset-word', body), vbtn = $('[data-verify]', body);
        function sync() {
          var ok = verified && word.value.trim() === '초기화';
          go.setAttribute('aria-disabled', ok ? 'false' : 'true');
        }
        $('[data-export]', body).addEventListener('click', doExport);
        vbtn.addEventListener('click', function () {
          if (verified) return;
          gate.requestVerifier({ keepLocked: true }).then(function (ok) {
            if (ok) { verified = true; vbtn.textContent = '가족 확인 완료 ✓'; sync(); }
          });
        });
        word.addEventListener('input', sync);
        $('[data-no]', body).addEventListener('click', function () { close(); });
        go.addEventListener('click', function () {
          if (go.getAttribute('aria-disabled') === 'true') return;
          close();
          wipeAll();
        });
        return $('[data-no]', body);
      }
    });
  }

  function wipeAll() {
    gate.lock();
    store.clear();
    S = store.freshState(null);
    UI.version++; UI.notices = []; UI.tab = 'board'; UI.selectedLine = null; UI.claimYesterday = false;
    UI.loadStatus = 'ok'; UI.loadInfo = null;
    UI.day = 0;
    applyTheme();
    render();
    announce('초기화했습니다. 처음부터 시작합니다.');
    openWizard();
  }

  /* ── 첫 실행 마법사 (spec 5-6) ─────────────────────── */
  function openWizard() {
    var draft = { start: localDateStr(), pin: null, rewards: { '3': S.settings.rewards['3'], '5': S.settings.rewards['5'], '7': S.settings.rewards['7'] } };
    openDialog({
      title: '성장 빙고 시작하기', role: 'dialog', noClose: true, modalOnly: true,
      render: function (body, close, handle) {
        function step1() {
          body.innerHTML = '<p class="step">1 / 3</p><p class="dialog-text">5주(35일) 7빙고를 시작할 날을 골라 주세요. 시작일이 1일차입니다.</p>' +
            '<div class="field"><label for="w-start">시작일</label><input type="date" id="w-start" value="' + h(draft.start) + '"></div>' +
            '<div class="dialog-actions"><button type="button" class="btn btn-primary" data-next>다음</button></div>';
          $('[data-next]', body).addEventListener('click', function () {
            var v = $('#w-start', body).value;
            if (!rules.parseDate(v)) { $('#w-start', body).focus(); return; }
            draft.start = v; step2();
          });
          $('#w-start', body).focus();
        }
        function step2() {
          body.innerHTML = '<p class="step">2 / 3</p><div id="w-pin"></div>';
          gate.renderSetup($('#w-pin', body), function (pin) { draft.pin = pin; step3(); });
          var pi = $('.pin-input', body); if (pi) pi.focus();
        }
        function step3() {
          body.innerHTML = '<p class="step">3 / 3</p><p class="dialog-text">3빙고 · 5빙고 · 7빙고 보상을 정해 주세요. 나중에 설정에서 고칠 수 있습니다.</p>' +
            board.rules.REWARD_LINES.map(function (n) {
              return '<div class="field"><label for="w-r' + n + '">' + n + '빙고</label><input type="text" id="w-r' + n + '" maxlength="80" value="' + h(draft.rewards[n]) + '"></div>';
            }).join('') + '<div class="dialog-actions"><button type="button" class="btn btn-primary" data-done>시작하기</button></div>';
          $('[data-done]', body).addEventListener('click', function () {
            board.rules.REWARD_LINES.forEach(function (n) { var v = $('#w-r' + n, body).value.trim(); if (v) draft.rewards[n] = v; });
            close();
            S.core.startDate = draft.start;
            S.settings.pin = draft.pin;
            S.settings.rewards = draft.rewards;
            UI.day = computeDay();
            UI.version++;
            persist();
            render();
            announce('시작했습니다. 오늘은 ' + (UI.day >= 1 ? UI.day + '일차' : '시작 전') + '입니다.');
          });
          $('#w-r3', body).focus();
        }
        step1();
        return $('#w-start', body);
      }
    });
  }

  /* ── 테마 ──────────────────────────────────────────── */
  function applyTheme() {
    var t = params.get('theme') || (S && S.settings.theme) || 'auto';
    var root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
  }

  /* ── 이벤트 ────────────────────────────────────────── */
  function onClick(e) {
    var tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { setTab(tabBtn.getAttribute('data-tab')); return; }
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var a = el.getAttribute('data-action');
    var id = el.getAttribute('data-id');
    var cellId = el.getAttribute('data-cell');

    /* 못 하는 이유를 보여 주려고 비활성 버튼도 눌림은 받되 아무것도 하지 않는다. */
    if (el.getAttribute('aria-disabled') === 'true') {
      if (a === 'claim') announce(claimState(cellId).text);
      return;
    }

    switch (a) {
      case 'open-cell': UI.focusCell = cellId; openSheet(cellId); break;
      case 'line': UI.selectedLine = UI.selectedLine === el.getAttribute('data-line') ? null : el.getAttribute('data-line'); render(); break;
      case 'line-go': UI.selectedLine = el.getAttribute('data-line'); setTab('board'); break;
      case 'claim': doClaim(cellId); break;
      case 'stamp': {
        /* 같은 스티커의 체크 상자가 [오늘] 목록과 칸 상세 시트에 둘 다 있을 수 있다.
           누른 도장 버튼이 든 줄의 상자만 읽는다. */
        var row = el.closest('.srow');
        var altBox = row ? row.querySelector('[data-alt]') : null;
        var altOn = !!(altBox && altBox.checked);
        withVerifier(function () { doStamp(id, altOn); });
        break;
      }
      case 'reject': withVerifier(function () { removeWithLog('reject', id, 'reject'); }); break;
      case 'revoke': withVerifier(function () { removeWithLog('revoke', id, 'revoke'); }); break;
      case 'cancel-own': removeWithLog('cancel', id, 'cancelOwn'); break;
      case 'day-mode':
        UI.claimYesterday = el.getAttribute('data-mode') === 'yesterday';
        render(); refreshOpenDialogs();
        break;
      case 'family': toggleFamily(); break;
      case 'lock': gate.lock(); break;
      case 'dismiss-notice':
        UI.notices = UI.notices.filter(function (n) { return n.id !== id; });
        renderBanners();
        break;
      case 'preview-alt': UI.planPreviewAlt = !UI.planPreviewAlt; render(); break;
      case 'export': doExport(); break;
      case 'export-corrupt': download('growth-bingo-corrupt.txt', store.corruptText() || ''); break;
      case 'copy-export': {
        var ta = $('#export-text');
        if (ta) {
          ta.select();
          try { document.execCommand('copy'); announce('복사했습니다.'); } catch (err) { announce('복사하지 못했습니다. 직접 선택해 복사하세요.'); }
        }
        break;
      }
      case 'import-check': {
        var txt = ($('#import-text') || {}).value || '';
        if (!txt.trim()) { announce('가져올 내용을 붙여 넣거나 파일을 골라 주세요.'); break; }
        doImportCheck(txt);
        break;
      }
      case 'reset': doReset(); break;
      case 'start-change': doStartChange(); break;
    }
  }

  function onChange(e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-action') === 'guide-mode') {
      act(function () { S.settings.guideMode = t.value; UI.planPreviewAlt = false; });
    } else if (t.name === 'theme') {
      act(function () { S.settings.theme = t.value; });
      applyTheme();
    } else if (t.name === 'gmode') {
      act(function () { S.settings.guideMode = t.value; UI.planPreviewAlt = false; });
    } else if (t.hasAttribute('data-reward')) {
      var n = t.getAttribute('data-reward');
      var v = t.value.trim();
      if (v) act(function () { S.settings.rewards[n] = v; });
    } else if (t.id === 'import-file' && t.files && t.files[0]) {
      var reader = new FileReader();
      reader.onload = function () { var box = $('#import-text'); if (box) box.value = String(reader.result); doImportCheck(String(reader.result)); };
      reader.readAsText(t.files[0]);
    }
  }

  /* 판 안에서 방향키로 칸을 옮긴다 (roving tabindex). */
  function onKeydown(e) {
    var cellBtn = e.target.closest && e.target.closest('.cell');
    if (cellBtn && $('#panel').contains(cellBtn)) {
      var r = +cellBtn.getAttribute('data-row'), c = +cellBtn.getAttribute('data-col');
      var nr = r, nc = c;
      switch (e.key) {
        case 'ArrowRight': nc = Math.min(7, c + 1); break;
        case 'ArrowLeft': nc = Math.max(1, c - 1); break;
        case 'ArrowDown': nr = Math.min(7, r + 1); break;
        case 'ArrowUp': nr = Math.max(1, r - 1); break;
        case 'Home': nc = 1; break;
        case 'End': nc = 7; break;
        default: return;
      }
      e.preventDefault();
      var next = $('.cell[data-row="' + nr + '"][data-col="' + nc + '"]', $('#panel'));
      if (next) focusCell(next);
      return;
    }
    var tab = e.target.closest && e.target.closest('[role="tab"]');
    if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      var i = TABS.map(function (x) { return 'tab-' + x[0]; }).indexOf(tab.id);
      var j = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
      e.preventDefault();
      setTab(TABS[j][0], true);
    }
  }

  function focusCell(btn) {
    var prev = $('.cell[tabindex="0"]', $('#panel'));
    if (prev) prev.tabIndex = -1;
    btn.tabIndex = 0;
    UI.focusCell = btn.getAttribute('data-cell');
    btn.focus();
  }

  function onFocusIn(e) {
    var b = e.target.closest && e.target.closest('.cell');
    if (!b || b.tabIndex === 0) return;
    var prev = $('.cell[tabindex="0"]', $('#panel'));
    if (prev) prev.tabIndex = -1;
    b.tabIndex = 0;
    UI.focusCell = b.getAttribute('data-cell');
  }

  /* ── 임베드: 읽기 전용 요약 한 화면 (spec 10절) ───── */
  function renderEmbed() {
    var prog = rules.progressMap(board, S.core);
    var bingo = rules.bingoCount(board, S.core);
    var confirmed = S.core.stickers.filter(function (s) { return s.status === 'confirmed'; }).length;
    var pending = S.core.stickers.filter(function (s) { return s.status === 'pending'; }).length;
    var has = started() && UI.day >= 1;
    var head = !started() ? '' : (UI.day < 1 ? '시작까지 ' + (1 - UI.day) + '일' : (UI.day > board.rules.DAYS ? '5주 끝' : UI.day + '일차 / ' + board.rules.DAYS));
    var usage = has && UI.day <= board.rules.DAYS ? rules.todayUsage(board, S.core, UI.day).total : 0;
    var lineMap = board.lines.slice(0, 7);
    var cells = '';
    lineMap.forEach(function (line) {
      line.cells.forEach(function (id) {
        var c = cellOf(id), p = prog[id];
        var fill = Math.round(p.confirmed / c.boxes * 100);
        var pf = Math.round((p.confirmed + p.pending) / c.boxes * 100);
        cells += '<span class="mc area-' + c.area + (p.complete ? ' is-complete' : '') + '" style="--fill:' + fill + '%;--pfill:' + pf + '%"><span class="c-corner"></span></span>';
      });
    });
    $('#app').innerHTML =
      '<a class="embed" href="index.html" target="_top" aria-label="성장 빙고, 전체 화면으로 열기">' +
      '<div class="embed-head"><strong>성장 빙고</strong><span>' + h(head) + '</span></div>' +
      (started() ? '<p class="embed-sum">빙고 ' + bingo + '/' + board.rules.GOAL_LINES + ' · 스티커 ' + confirmed + '</p>' : '<p class="embed-sum">영어·체력·AI를 섞은 5주 7빙고</p>') +
      '<div class="mini" aria-hidden="true">' + cells + '</div>' +
      (started() ? '<p class="embed-sum">오늘 ' + usage + '/' + board.rules.DAILY_CAP + ' · 확인 대기 ' + pending + '</p>' : '<p class="embed-sum">하루 4칸 · 가족 도장 · 길잡이</p>') +
      '<p class="embed-open">전체 화면으로 열기 ↗</p></a>';
  }

  /* ── 시작 ──────────────────────────────────────────── */
  function fatal(msg) {
    var app = $('#app');
    if (app) app.innerHTML = '<div class="banner banner-error" role="alert">' + h(msg) + '</div>';
  }

  function init() {
    if (!board || !board.selfCheck.ok) {
      console.error('판 데이터 오류:', board && board.selfCheck.errors);
      fatal('판 데이터 오류: ' + (board ? board.selfCheck.errors.join(' / ') : '판을 읽지 못했습니다.'));
      return;
    }
    if (EMBED) document.documentElement.setAttribute('data-embed', '');
    var res = store.init(board);
    UI.loadStatus = res.status;
    UI.loadInfo = res.status === 'mismatch' ? res.boardId : (res.dropped ? { dropped: res.dropped } : null);
    S = res.state;
    applyTheme();
    UI.day = computeDay();

    if (EMBED) {
      /* 임베드는 읽기만 한다. 저장을 못 읽어도 오류 없이 빈 판 미리 보기를 보인다. */
      renderEmbed();
      return;
    }

    gate.init({
      getPin: function () { return S.settings.pin; },
      setPin: function (pin, kind) {
        act(function () { S.settings.pin = pin; if (kind === 'reset') { S.settings.pinResetAt = nowIso(); store.pushLog(S, { at: nowIso(), type: 'pin-reset' }); } });
      },
      openDialog: openDialog
    });
    gate.onChange(function (unlocked) {
      UI.version++;
      render();
      refreshOpenDialogs();
      announce(unlocked ? '가족 확인 모드입니다.' : '가족 확인 모드를 잠갔습니다.');
    });

    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('focusin', onFocusIn);
    $('#head-family').addEventListener('click', toggleFamily);

    /* 자정이 지나도 화면이 어제에 머물지 않도록 여러 신호에서 날짜를 다시 계산한다. */
    var recheck = function () { refreshDay(); };
    document.addEventListener('visibilitychange', function () { if (!document.hidden) recheck(); });
    window.addEventListener('focus', recheck);
    window.addEventListener('pageshow', recheck);
    window.setInterval(recheck, 60000);

    /* 다른 탭에서 바뀌면 다시 읽어 그린다. */
    window.addEventListener('storage', function (e) {
      if (e.key !== null && e.key !== store.KEY) return;
      var r = store.reload();
      if (r.status === 'ok' || r.status === 'new') {
        S = r.state;
        UI.version++;
        UI.day = computeDay();
        render();
        refreshOpenDialogs();
      }
    });

    refreshDay(true);
    render();
    /* 저장된 시작일이 없으면 첫 실행 마법사. 읽기 전용(새 버전 기록)으로 열었을 때는 띄우지 않는다. */
    if (!started() && !store.isReadOnly()) openWizard();
  }

  GB.debug = {
    getState: function () {
      return JSON.parse(JSON.stringify({
        state: S,
        ui: { tab: UI.tab, day: UI.day, today: UI.todayStr, claimYesterday: UI.claimYesterday, loadStatus: UI.loadStatus, familyUnlocked: gate.isUnlocked() },
        lastPlanMs: lastPlanMs
      }));
    },
    planMs: function () { return lastPlanMs; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
