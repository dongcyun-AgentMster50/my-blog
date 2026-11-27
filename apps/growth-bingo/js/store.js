/* ============================================================
   성장 빙고 — 저장 (localStorage 래퍼, 검증, 내보내기·가져오기)

   이식할 때 이 파일 통째로 갈아 끼운다. 지켜야 할 약속은 두 가지:
     읽기 → state.core, 쓰기 ← state.core
   규칙 함수는 core를 받아 새 core를 돌려줄 뿐 저장하지 않는다.

   2048과 다른 점: 여기서는 기록이 사라지면 5주가 날아간다.
   그래서 저장이 막혀 있거나 실패하면 조용히 넘기지 않고 화면이 알릴 수 있게
   Store.problem()으로 사유를 돌려준다.
   ============================================================ */
(function () {
  'use strict';

  var GB = window.GrowthBingo = window.GrowthBingo || {};

  var KEY = 'apps.growth-bingo.state';
  var CORRUPT_KEY = 'apps.growth-bingo.corrupt';
  var SCHEMA = 1;
  var LOG_MAX = 200;
  var LOG_TYPES = ['expire', 'reject', 'revoke', 'cancel', 'pin-reset', 'start-change', 'import', 'reset'];

  var board = null;
  var memory = {};            // 저장소가 막혔을 때의 임시 보관
  var storageOk = null;       // null: 아직 모름
  var lastSaveError = null;   // 'quota' | 'blocked' | null
  var readOnly = false;       // 앱보다 새로운 schema면 저장하지 않는다
  var corruptRaw = null;

  /* ── 안전한 저장소 접근 ─────────────────────────────
     iframe 샌드박스·사파리 개인 정보 보호 모드에서는 window.localStorage에
     "접근하는 것만으로" 예외가 난다. 프로퍼티 접근까지 try/catch로 감싼다. */
  function ls() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  function probe() {
    var s = ls();
    if (!s) return false;
    try {
      s.setItem('apps.growth-bingo.probe', '1');
      s.removeItem('apps.growth-bingo.probe');
      return true;
    } catch (e) { return false; }
  }

  function rawGet(key) {
    var s = ls();
    if (s) { try { return s.getItem(key); } catch (e) { /* 아래 메모리로 */ } }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }

  function rawSet(key, value) {
    if (storageOk) {
      var s = ls();
      try {
        s.setItem(key, value);
        lastSaveError = null;
        return true;
      } catch (e) {
        lastSaveError = (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) ? 'quota' : 'blocked';
      }
    } else {
      lastSaveError = 'blocked';
    }
    memory[key] = value;
    return false;
  }

  function rawRemove(key) {
    var s = ls();
    if (s) { try { s.removeItem(key); } catch (e) { /* 무시 */ } }
    delete memory[key];
  }

  /* ── 상태 모양 ─────────────────────────────────────── */
  function defaultSettings() {
    return {
      rewards: { '3': '가족이 고른 간식', '5': '영화관 나들이', '7': '가족 뷔페' },
      pin: null,
      pinResetAt: null,
      theme: 'auto',
      guideMode: 'fewest',
      seenRewards: []
    };
  }

  function freshState(startDate) {
    return {
      schema: SCHEMA,
      boardId: board.id,
      core: { startDate: startDate || null, seq: 0, stickers: [] },
      log: [],
      settings: defaultSettings(),
      updatedAt: null
    };
  }

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  /* 읽은 뒤 검증: 모르는 칸·범위 밖 일차·모르는 상태의 스티커는 버리고 개수를 센다. */
  function sanitize(raw) {
    var dropped = 0;
    var out = freshState(null);
    var core = isObj(raw.core) ? raw.core : {};
    if (typeof core.startDate === 'string' && GB.rules.parseDate(core.startDate)) out.core.startDate = core.startDate;

    var ids = {};
    board.cells.forEach(function (c) { ids[c.id] = true; });
    var seen = {};
    var maxSeq = 0;
    (Array.isArray(core.stickers) ? core.stickers : []).forEach(function (s) {
      var ok = isObj(s) && typeof s.id === 'string' && !seen[s.id] && ids[s.cell] &&
        typeof s.day === 'number' && s.day === Math.floor(s.day) && s.day >= 1 && s.day <= board.rules.DAYS &&
        (s.status === 'pending' || s.status === 'confirmed');
      if (!ok) { dropped++; return; }
      seen[s.id] = true;
      var m = /^s(\d+)$/.exec(s.id);
      if (m && +m[1] > maxSeq) maxSeq = +m[1];
      var o = {
        id: s.id, cell: s.cell, day: s.day,
        date: typeof s.date === 'string' ? s.date : null,
        status: s.status,
        claimedAt: typeof s.claimedAt === 'string' ? s.claimedAt : null,
        claimedBy: typeof s.claimedBy === 'string' ? s.claimedBy : 'me'
      };
      if (s.status === 'confirmed') {
        o.confirmedAt = typeof s.confirmedAt === 'string' ? s.confirmedAt : null;
        o.confirmedBy = typeof s.confirmedBy === 'string' ? s.confirmedBy : 'family';
        o.alt = !!s.alt;
      }
      out.core.stickers.push(o);
    });
    out.core.seq = Math.max(maxSeq, typeof core.seq === 'number' && core.seq >= 0 ? Math.floor(core.seq) : 0);

    if (Array.isArray(raw.log)) {
      raw.log.forEach(function (e) {
        if (isObj(e) && typeof e.at === 'string' && LOG_TYPES.indexOf(e.type) >= 0) out.log.push(e);
      });
      out.log = out.log.slice(-LOG_MAX);
    }

    var st = isObj(raw.settings) ? raw.settings : {};
    var def = defaultSettings();
    if (isObj(st.rewards)) {
      ['3', '5', '7'].forEach(function (k) {
        if (typeof st.rewards[k] === 'string') def.rewards[k] = st.rewards[k].slice(0, 80);
      });
    }
    if (typeof st.pin === 'string' && /^\d{4}$/.test(st.pin)) def.pin = st.pin;
    if (typeof st.pinResetAt === 'string') def.pinResetAt = st.pinResetAt;
    if (st.theme === 'light' || st.theme === 'dark' || st.theme === 'auto') def.theme = st.theme;
    if (st.guideMode === 'fastest' || st.guideMode === 'fewest') def.guideMode = st.guideMode;
    if (Array.isArray(st.seenRewards)) def.seenRewards = st.seenRewards.filter(function (n) { return n === 3 || n === 5 || n === 7; });
    out.settings = def;
    out.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;
    return { state: out, dropped: dropped };
  }

  /* schema가 작으면 버전 순서대로 올린다 (지금은 1뿐이라 할 일이 없다). */
  function migrate(raw) { return raw; }

  /* ── 읽기 ──────────────────────────────────────────── */
  function load() {
    var text = rawGet(KEY);
    var res = { status: 'new', state: freshState(null), dropped: 0, readOnly: false };
    if (text === null) return res;

    var raw;
    try { raw = JSON.parse(text); } catch (e) { raw = undefined; }
    if (!isObj(raw) || typeof raw.schema !== 'number') {
      /* 깨진 원문은 지우지 않고 옮겨 두고, 새 상태로 시작한다. */
      corruptRaw = text;
      rawSet(CORRUPT_KEY, text);
      res.status = 'corrupt';
      res.corruptRaw = text;
      return res;
    }
    if (raw.schema > SCHEMA) {
      /* 이 앱보다 새로운 기록: 읽기 전용으로만 열고 절대 저장하지 않는다. */
      readOnly = true;
      res.status = 'future';
      res.readOnly = true;
      res.futureSchema = raw.schema;
      var sf = sanitize(raw);
      res.state = sf.state;
      return res;
    }
    raw = migrate(raw);
    if (raw.boardId !== board.id) {
      res.status = 'mismatch';
      res.boardId = raw.boardId;
      return res;
    }
    var s = sanitize(raw);
    res.status = 'ok';
    res.state = s.state;
    res.dropped = s.dropped;
    return res;
  }

  function init(b) {
    board = b;
    storageOk = probe();
    return load();
  }

  /* ── 쓰기 ──────────────────────────────────────────── */
  function save(state, nowIso) {
    if (readOnly) return { ok: false, error: 'readonly' };
    state.updatedAt = nowIso || state.updatedAt;
    var ok = rawSet(KEY, JSON.stringify(state));
    return { ok: ok, error: ok ? null : lastSaveError };
  }

  /** 저장이 막혔거나 실패했는가: 화면의 경고 띠 판단용. null이면 정상. */
  function problem() {
    if (readOnly) return 'readonly';
    if (!storageOk) return 'blocked';
    return lastSaveError;
  }

  function storedUpdatedAt() {
    var text = rawGet(KEY);
    if (text === null) return null;
    try { var o = JSON.parse(text); return isObj(o) ? (o.updatedAt || '') : null; } catch (e) { return null; }
  }

  function clear() {
    rawRemove(KEY);
    rawRemove(CORRUPT_KEY);
    corruptRaw = null;
    readOnly = false;
  }

  /* ── 내보내기·가져오기 ─────────────────────────────── */
  function exportText(state) { return JSON.stringify(state, null, 2); }

  function exportFileName(dateStr) { return 'growth-bingo-' + String(dateStr).replace(/-/g, '') + '.json'; }

  /** 가져올 파일을 검사하고 요약을 돌려준다. 실제 교체는 호출한 쪽이 확인 뒤에 한다. */
  function parseImport(text) {
    var raw;
    try { raw = JSON.parse(text); } catch (e) { return { ok: false, error: '파일을 읽을 수 없습니다. 성장 빙고에서 내보낸 파일이 맞는지 확인해 주세요.' }; }
    if (!isObj(raw) || typeof raw.schema !== 'number' || !isObj(raw.core)) {
      return { ok: false, error: '성장 빙고에서 내보낸 파일이 아닙니다.' };
    }
    if (raw.schema > SCHEMA) return { ok: false, error: '이 앱보다 새로운 버전에서 만든 파일이라 가져올 수 없습니다.' };
    raw = migrate(raw);
    if (raw.boardId !== board.id) return { ok: false, error: '다른 판(' + raw.boardId + ')의 기록이라 가져올 수 없습니다.' };
    var s = sanitize(raw);
    if (!s.state.core.startDate) return { ok: false, error: '시작일이 없는 파일입니다.' };
    return {
      ok: true,
      state: s.state,
      dropped: s.dropped,
      summary: {
        startDate: s.state.core.startDate,
        stickers: s.state.core.stickers.length,
        bingo: GB.rules.bingoCount(board, s.state.core)
      }
    };
  }

  /* 로그에 한 줄 더한다 (최근 200건만 보관). */
  function pushLog(state, entry) {
    state.log = state.log.concat([entry]).slice(-LOG_MAX);
  }

  GB.store = {
    KEY: KEY, SCHEMA: SCHEMA,
    init: init, save: save, problem: problem, clear: clear, freshState: freshState,
    storedUpdatedAt: storedUpdatedAt, reload: load,
    exportText: exportText, exportFileName: exportFileName, parseImport: parseImport,
    pushLog: pushLog, corruptText: function () { return corruptRaw; },
    isReadOnly: function () { return readOnly; }
  };
})();
