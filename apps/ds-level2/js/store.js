/* ============================================================
   ds-level2 — 진도·설정 저장 (store)

   safeStorage: localStorage 프로퍼티 접근 자체를 try/catch 로 감싼다(Safari 프라이빗,
   샌드박스 iframe 에서는 접근만 해도 예외). 실패하면 메모리 폴백으로 앱은 그대로 돌고,
   store.ok 가 false 가 되어 설정 화면이 "저장되지 않습니다"를 알린다 — 2048 과 달리
   여기서는 진도가 핵심 가치라 사용자에게 알려야 한다(spec 5-8).

   진도 스키마 v1 (키 apps.ds-level2.progress.v1):
     { version, updatedAt, quiz:{qid:{box,due,last,correct,wrong,at}}, practice:{pid:{solved,attempts,at,gaveUp}},
       cards:{nodeId: isoTime}, exams:[...최근 20] }
   읽을 때 version 을 확인해 migrate 체인을 태우고, 파싱 실패·형식 오류면 손상본을
   …progress.corrupt 로 옮겨 두고(덮어쓰지 않는다) 빈 진도로 시작한다.
   쓰기는 변경 즉시 — 문제 채점마다 한 번. 400문제라도 수십 KB 다.
   ============================================================ */
(function (root) {
  'use strict';
  var E = root.__DS2 || (root.__DS2 = {});

  var KEY = {
    progress: 'apps.ds-level2.progress.v1',
    settings: 'apps.ds-level2.settings.v1',
    corrupt: 'apps.ds-level2.progress.corrupt',
    backup: 'apps.ds-level2.progress.backup'
  };
  var MAX_EXAMS = 20;

  /* ────────────────────────────────────────────────────────
     safeStorage — localStorage / sessionStorage 공용 래퍼
     ──────────────────────────────────────────────────────── */
  function makeSafe(getStorage) {
    var memory = {};
    var ok = false;
    try {
      var s = getStorage();
      var probe = '__ds2_probe__';
      s.setItem(probe, '1');
      s.removeItem(probe);
      ok = true;
    } catch (e) { ok = false; }
    return {
      ok: ok,
      get: function (k) {
        try { return getStorage().getItem(k); }
        catch (e) { return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null; }
      },
      set: function (k, v) {
        try { getStorage().setItem(k, v); return true; }
        catch (e) { memory[k] = v; return false; }
      },
      remove: function (k) {
        try { getStorage().removeItem(k); } catch (e) { /* 무시 */ }
        delete memory[k];
      }
    };
  }
  var local = makeSafe(function () { return root.localStorage; });
  var session = makeSafe(function () { return root.sessionStorage; });

  /* ────────────────────────────────────────────────────────
     진도
     ──────────────────────────────────────────────────────── */
  function emptyProgress() {
    return { version: 1, updatedAt: null, quiz: {}, practice: {}, cards: {}, exams: [] };
  }
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }

  /** 형식 검사. 느슨하게 — 필드 하나가 깨졌다고 전체를 버리지 않고 그 필드만 비운다. */
  function sanitize(p) {
    if (!isObj(p) || typeof p.version !== 'number') return null;
    var out = emptyProgress();
    out.updatedAt = typeof p.updatedAt === 'string' ? p.updatedAt : null;
    if (isObj(p.quiz)) Object.keys(p.quiz).forEach(function (id) {
      var r = p.quiz[id];
      if (isObj(r) && typeof r.box === 'number') {
        out.quiz[id] = { box: r.box, due: typeof r.due === 'string' ? r.due : null, last: !!r.last,
          correct: r.correct | 0, wrong: r.wrong | 0, at: typeof r.at === 'string' ? r.at : null };
      }
    });
    if (isObj(p.practice)) Object.keys(p.practice).forEach(function (id) {
      var r = p.practice[id];
      if (isObj(r)) out.practice[id] = { solved: !!r.solved, attempts: r.attempts | 0, at: typeof r.at === 'string' ? r.at : null, gaveUp: !!r.gaveUp };
    });
    if (isObj(p.cards)) Object.keys(p.cards).forEach(function (id) {
      if (typeof p.cards[id] === 'string') out.cards[id] = p.cards[id];
    });
    if (Array.isArray(p.exams)) out.exams = p.exams.filter(function (x) { return isObj(x) && typeof x.id === 'string'; }).slice(0, MAX_EXAMS);
    return out;
  }

  /** version 이 미래에 올라가면 여기서 v → v+1 변환을 이어 붙인다. */
  function migrate(p) {
    if (p.version === 1) return p;
    return null; // 알 수 없는 버전 → 손상으로 취급
  }

  var progress = null;
  var corruptSeen = false;

  function load() {
    var raw = local.get(KEY.progress);
    if (raw == null || raw === '') { progress = emptyProgress(); return progress; }
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    var clean = parsed ? sanitize(migrate(isObj(parsed) ? parsed : {}) || {}) : null;
    if (!clean) {
      // 덮어쓰지 않고 옮겨 둔다. 사용자가 내보내기로 복구를 시도할 여지를 남긴다.
      if (local.get(KEY.corrupt) == null) local.set(KEY.corrupt, raw);
      corruptSeen = true;
      progress = emptyProgress();
      return progress;
    }
    progress = clean;
    return progress;
  }
  function get() { return progress || load(); }
  function save() {
    var p = get();
    p.updatedAt = new Date().toISOString();
    local.set(KEY.progress, JSON.stringify(p));
    return p;
  }

  /* ────────────────────────────────────────────────────────
     기록 — 뷰가 호출하는 쓰기 API. 각각 저장까지 한다.
     ──────────────────────────────────────────────────────── */
  function recordQuiz(qid, correct, source, now) {
    var p = get();
    var rec = E.leitner.applyResult(p.quiz[qid], correct, now || new Date());
    if (source) rec.source = source; // "exam" 등. 통계용 구분일 뿐 규칙은 같다
    p.quiz[qid] = rec;
    save();
    return rec;
  }
  function recordPractice(pid, solved, gaveUp) {
    var p = get();
    var prev = p.practice[pid] || { solved: false, attempts: 0 };
    p.practice[pid] = {
      solved: !!(prev.solved || solved),
      attempts: (prev.attempts | 0) + 1,
      at: new Date().toISOString(),
      gaveUp: !!(prev.gaveUp || gaveUp)
    };
    save();
    return p.practice[pid];
  }
  function markCard(nodeId) {
    var p = get();
    if (!p.cards[nodeId]) { p.cards[nodeId] = new Date().toISOString(); save(); return true; }
    return false;
  }
  function addExam(exam) {
    var p = get();
    p.exams = [exam].concat(p.exams.filter(function (x) { return x.id !== exam.id; })).slice(0, MAX_EXAMS);
    save();
  }
  function reset() {
    progress = emptyProgress();
    local.remove(KEY.progress);
    corruptSeen = false;
  }

  /* ────────────────────────────────────────────────────────
     설정
     ──────────────────────────────────────────────────────── */
  var DEFAULT_SETTINGS = { version: 1, theme: 'auto', fontScale: 1, examTimer: true, showHintByDefault: false };
  var settings = null;
  function getSettings() {
    if (settings) return settings;
    var out = {};
    for (var k in DEFAULT_SETTINGS) out[k] = DEFAULT_SETTINGS[k];
    try {
      var raw = local.get(KEY.settings);
      var s = raw ? JSON.parse(raw) : null;
      if (isObj(s)) {
        if (s.theme === 'light' || s.theme === 'dark' || s.theme === 'auto') out.theme = s.theme;
        if (s.fontScale === 1 || s.fontScale === 1.15) out.fontScale = s.fontScale;
        if (typeof s.examTimer === 'boolean') out.examTimer = s.examTimer;
        if (typeof s.showHintByDefault === 'boolean') out.showHintByDefault = s.showHintByDefault;
      }
    } catch (e) { /* 깨진 설정은 기본값 */ }
    settings = out;
    return settings;
  }
  function setSetting(k, v) {
    var s = getSettings();
    s[k] = v;
    local.set(KEY.settings, JSON.stringify(s));
    return s;
  }

  /* ────────────────────────────────────────────────────────
     내보내기 / 가져오기
     ──────────────────────────────────────────────────────── */
  function exportJSON() {
    var p = get();
    return JSON.stringify({ app: 'ds-level2', exportedAt: new Date().toISOString(), progress: p }, null, 2);
  }
  function exportFilename(d) {
    d = d || new Date();
    var s = E.leitner.dayStr(d).replace(/-/g, '');
    return 'ds-level2-progress-' + s + '.json';
  }
  function newer(a, b) { // at 문자열 비교. 없는 쪽이 진다.
    if (!a) return b; if (!b) return a;
    return (a.at || '') >= (b.at || '') ? a : b;
  }
  /**
   * text: 내보낸 JSON (또는 progress 객체 자체). overwrite=false 면 병합:
   * 문제·실습별로 at 이 최신인 기록, 카드는 둘 중 있는 것(이른 시각), exams 는 id 합집합.
   * 가져오기 전에 현재 진도를 backup 키에 복사한다.
   */
  function importJSON(text, overwrite) {
    var parsed;
    try { parsed = typeof text === 'string' ? JSON.parse(text) : text; }
    catch (e) { return { ok: false, error: 'JSON 을 읽을 수 없습니다: ' + e.message }; }
    var src = isObj(parsed) && isObj(parsed.progress) ? parsed.progress : parsed;
    var incoming = sanitize(migrate(isObj(src) ? src : {}) || {});
    if (!incoming) return { ok: false, error: 'ds-level2 진도 형식이 아닙니다(version 필드 없음).' };

    local.set(KEY.backup, JSON.stringify(get()));
    var cur = get();
    var result = overwrite ? incoming : emptyProgress();
    var merged = { quiz: 0, practice: 0, cards: 0, exams: 0 };
    if (!overwrite) {
      var ids = {}, k;
      for (k in cur.quiz) ids[k] = 1; for (k in incoming.quiz) ids[k] = 1;
      for (k in ids) { result.quiz[k] = newer(cur.quiz[k], incoming.quiz[k]); if (incoming.quiz[k] && result.quiz[k] === incoming.quiz[k]) merged.quiz++; }
      ids = {};
      for (k in cur.practice) ids[k] = 1; for (k in incoming.practice) ids[k] = 1;
      for (k in ids) { result.practice[k] = newer(cur.practice[k], incoming.practice[k]); if (incoming.practice[k] && result.practice[k] === incoming.practice[k]) merged.practice++; }
      ids = {};
      for (k in cur.cards) ids[k] = 1; for (k in incoming.cards) ids[k] = 1;
      for (k in ids) {
        var a = cur.cards[k], b = incoming.cards[k];
        result.cards[k] = (a && b) ? (a < b ? a : b) : (a || b);
        if (b && !a) merged.cards++;
      }
      var seen = {};
      result.exams = cur.exams.concat(incoming.exams).filter(function (x) {
        if (seen[x.id]) return false; seen[x.id] = 1; return true;
      }).sort(function (x, y) { return (y.at || '') < (x.at || '') ? -1 : 1; }).slice(0, MAX_EXAMS);
      merged.exams = result.exams.length - cur.exams.length;
    } else {
      merged = { quiz: Object.keys(incoming.quiz).length, practice: Object.keys(incoming.practice).length,
        cards: Object.keys(incoming.cards).length, exams: incoming.exams.length };
    }
    progress = result;
    save();
    return { ok: true, merged: merged, overwrite: !!overwrite };
  }

  E.store = {
    KEY: KEY, ok: local.ok, local: local, session: session,
    load: load, get: get, save: save,
    recordQuiz: recordQuiz, recordPractice: recordPractice, markCard: markCard, addExam: addExam, reset: reset,
    getSettings: getSettings, setSetting: setSetting,
    exportJSON: exportJSON, exportFilename: exportFilename, importJSON: importJSON,
    hadCorrupt: function () { return corruptSeen || local.get(KEY.corrupt) != null; },
    emptyProgress: emptyProgress
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
