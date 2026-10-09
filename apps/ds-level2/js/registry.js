/* ============================================================
   ds-level2 — 콘텐츠 레지스트리 (window.DS2)

   콘텐츠 파일(data/*.js) 11개가 각자 DS2.register({...}) 한 번씩만
   호출하는, 콘텐츠 ↔ 엔진 사이의 유일한 접점이다.
   - 가장 먼저 로드된다(index.html 첫 <script>).
   - 브라우저와 Node `vm` 양쪽에서 돈다. 검증 도구(tools/validate.js,
     extract_practice.js)가 이 파일을 vm 컨텍스트에 그대로 흘려 넣으므로
     window 가 없어도 globalThis 에 DS2 를 만든다.
   - 등록은 누적(additive)이다. 같은 노드에 두 파일이 문제를 보태도 합쳐진다
     (파트A 2장·3장이 두 파일로 갈라진 이유).
   - 등록 시 최소 검증을 하고, 깨진 항목은 조용히 사라지지 않도록
     DS2.warnings 에 남긴다. 경고가 있어도 앱은 뜬다(설정 화면에 수 표시).
   ============================================================ */
(function (root) {
  'use strict';

  var DS2 = root.DS2 || (root.DS2 = {});
  DS2.version = '1';

  /* ────────────────────────────────────────────────────────
     내부 저장소. 전부 closure 안에 두고 읽기 API 로만 노출한다.
     ──────────────────────────────────────────────────────── */
  var store;
  function reset() {
    store = {
      cards: {},        // nodeId → card
      questions: [],    // 등록 순서 보존
      qById: {},
      qByNode: {},      // nodeId → question[]
      practices: [],
      pById: {},
      pByNode: {},
      terms: {},        // termId → term
      termOrder: [],    // 등록 순서 (사전 정렬은 뷰가 한다)
      termFile: {},     // termId → 처음 정의한 파일
      fileOf: {},       // 문제/실습 id → 파일 (검증 도구가 "이 파일 것만" 고를 때 쓴다)
      files: [],        // register() 가 호출된 파일 이름 목록
      chapters: {},     // file → chapter
      qByTerm: null     // 용어 → 문제 역인덱스 (지연 생성)
    };
    DS2.warnings.length = 0;
  }
  DS2.warnings = [];
  reset();
  DS2._reset = reset; // validate.html 이 여러 번 재검증할 때 쓴다. 앱 런타임은 호출하지 않는다.

  /* ────────────────────────────────────────────────────────
     유틸
     ──────────────────────────────────────────────────────── */
  var RE_QID = /^([ab]-\d(?:-\d)?)-q(\d{2})$/;
  var RE_PID = /^([ab]-\d(?:-\d)?)-p(\d{2})$/;
  var RE_TERM = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var TYPES = { mcq: 1, ox: 1, short: 1 };
  var KINDS = { concept: 1, output: 1, bug: 1, fill: 1 };

  /** string | string[] → string. 줄 배열은 "\n"으로 합친다. 그 외는 ''. */
  function text(v) {
    if (Array.isArray(v)) return v.map(function (s) { return s == null ? '' : String(s); }).join('\n');
    if (v == null) return '';
    return String(v);
  }
  DS2.text = text;

  function isText(v) {
    if (typeof v === 'string') return true;
    if (!Array.isArray(v)) return false;
    for (var i = 0; i < v.length; i++) if (typeof v[i] !== 'string') return false;
    return true;
  }
  function nonEmptyText(v) { return isText(v) && text(v).trim().length > 0; }

  function warn(type, detail) {
    detail = detail || {};
    detail.type = type;
    DS2.warnings.push(detail);
    return detail;
  }

  /** 지금 실행 중인 콘텐츠 파일 이름. 브라우저는 currentScript, vm 은 __currentFile. */
  function currentFile(pack) {
    if (pack && typeof pack.file === 'string') return pack.file;
    if (typeof DS2.__currentFile === 'string') return DS2.__currentFile;
    try {
      if (typeof document !== 'undefined' && document.currentScript) {
        var src = document.currentScript.getAttribute('src') || '';
        return src.split('/').pop() || src;
      }
    } catch (e) { /* 샌드박스 등 — 이름 없이 간다 */ }
    return 'register#' + (store.files.length + 1);
  }

  /** 커리큘럼은 curriculum.js 가 DS2.curriculum 으로 붙인다. 없으면 노드 검사를 건너뛴다. */
  function nodeExists(id) {
    var c = DS2.curriculum;
    if (!c) return true;
    var n = c.byId[id];
    return !!(n && (n.type === 'topic' || n.type === 'check'));
  }

  /* ────────────────────────────────────────────────────────
     등록
     ──────────────────────────────────────────────────────── */
  function registerCard(nodeId, card, file) {
    if (!card || typeof card !== 'object') {
      warn('card-invalid', { file: file, node: nodeId, reason: '객체가 아님' }); return;
    }
    if (card.node !== nodeId) {
      warn('card-invalid', { file: file, node: nodeId, reason: 'node 필드(' + card.node + ')가 키와 다름' });
    }
    if (!nodeExists(nodeId)) {
      warn('card-invalid', { file: file, node: nodeId, reason: '트리에 없는 노드' }); return;
    }
    var missing = [];
    if (!nonEmptyText(card.title)) missing.push('title');
    if (!nonEmptyText(card.summary)) missing.push('summary');
    if (!Array.isArray(card.concepts) || !card.concepts.length) missing.push('concepts');
    if (!Array.isArray(card.terms) || !card.terms.length) missing.push('terms');
    if (!Array.isArray(card.patterns) || !card.patterns.length) missing.push('patterns');
    if (missing.length) {
      // 필수 필드가 빠져도 렌더는 가능하므로 유지하고 경고만 남긴다.
      warn('card-missing', { file: file, node: nodeId, fields: missing });
    }
    if (store.cards[nodeId]) {
      // 카드는 노드당 하나. 나중 것을 무시한다 (먼저 로드된 파일이 이긴다).
      warn('card-duplicate', { file: file, node: nodeId, keptFrom: store.cards[nodeId]._file });
      return;
    }
    card._file = file;
    store.cards[nodeId] = card;
  }

  function registerQuestion(q, i, file) {
    var where = { file: file, index: i };
    if (!q || typeof q !== 'object') { warn('question-invalid', mix(where, { reason: '객체가 아님' })); return; }
    where.id = q.id;
    var m = RE_QID.exec(String(q.id || ''));
    if (!m) { warn('question-invalid', mix(where, { reason: 'id 형식 (<node>-qNN)' })); return; }
    if (q.node !== m[1]) { warn('question-invalid', mix(where, { reason: 'node(' + q.node + ')가 id 접두와 다름' })); return; }
    if (!nodeExists(q.node)) { warn('question-invalid', mix(where, { reason: '트리에 없는 노드 ' + q.node })); return; }
    if (!TYPES[q.type]) { warn('question-invalid', mix(where, { reason: 'type ' + q.type })); return; }
    if (store.qById[q.id]) { warn('question-duplicate', mix(where, { firstFile: store.fileOf[q.id] })); return; }

    var missing = [];
    if (!KINDS[q.kind]) missing.push('kind');
    if (!(q.difficulty === 1 || q.difficulty === 2 || q.difficulty === 3)) missing.push('difficulty');
    if (!nonEmptyText(q.prompt)) missing.push('prompt');
    if (!nonEmptyText(q.explanation)) missing.push('explanation');
    if (!Array.isArray(q.terms) || !q.terms.length) missing.push('terms');
    var answerOk = false;
    if (q.type === 'mcq') {
      answerOk = Array.isArray(q.choices) && q.choices.length >= 2 &&
        typeof q.answer === 'number' && q.answer === Math.floor(q.answer) &&
        q.answer >= 0 && q.answer < q.choices.length;
    } else if (q.type === 'ox') {
      answerOk = typeof q.answer === 'boolean';
    } else {
      answerOk = typeof q.answer === 'string' && q.answer.trim().length > 0;
    }
    if (!answerOk) {
      // 채점이 불가능한 문제는 출제하면 안 된다. 버린다.
      warn('question-invalid', mix(where, { reason: 'answer/choices 형식 (' + q.type + ')' })); return;
    }
    if (missing.length) warn('question-missing', mix(where, { fields: missing }));

    store.questions.push(q);
    store.qById[q.id] = q;
    (store.qByNode[q.node] || (store.qByNode[q.node] = [])).push(q);
    store.fileOf[q.id] = file;
    store.qByTerm = null;
  }

  function registerPractice(p, i, file) {
    var where = { file: file, index: i };
    if (!p || typeof p !== 'object') { warn('practice-invalid', mix(where, { reason: '객체가 아님' })); return; }
    where.id = p.id;
    var m = RE_PID.exec(String(p.id || ''));
    if (!m) { warn('practice-invalid', mix(where, { reason: 'id 형식 (<node>-pNN)' })); return; }
    if (p.node !== m[1]) { warn('practice-invalid', mix(where, { reason: 'node(' + p.node + ')가 id 접두와 다름' })); return; }
    if (!nodeExists(p.node)) { warn('practice-invalid', mix(where, { reason: '트리에 없는 노드 ' + p.node })); return; }
    if (store.pById[p.id]) { warn('practice-duplicate', mix(where, { firstFile: store.fileOf[p.id] })); return; }
    var a = p.answer;
    var answerOk = a && typeof a === 'object' && (
      (a.type === 'number' && typeof a.value === 'number' && isFinite(a.value)) ||
      (a.type === 'int' && typeof a.value === 'number' && a.value === Math.floor(a.value)) ||
      (a.type === 'string' && typeof a.value === 'string' && a.value.trim().length > 0));
    if (!answerOk) { warn('practice-invalid', mix(where, { reason: 'answer 형식' })); return; }

    var missing = [];
    if (!nonEmptyText(p.title)) missing.push('title');
    if (!(p.difficulty === 1 || p.difficulty === 2 || p.difficulty === 3)) missing.push('difficulty');
    if (!nonEmptyText(p.task)) missing.push('task');
    if (!nonEmptyText(p.setup)) missing.push('setup');
    if (!nonEmptyText(p.solution)) missing.push('solution');
    if (!nonEmptyText(p.explanation)) missing.push('explanation');
    if (!Array.isArray(p.terms) || !p.terms.length) missing.push('terms');
    if (!p.verified || typeof p.verified !== 'object') missing.push('verified');
    if (missing.length) warn('practice-missing', mix(where, { fields: missing }));

    store.practices.push(p);
    store.pById[p.id] = p;
    (store.pByNode[p.node] || (store.pByNode[p.node] = [])).push(p);
    store.fileOf[p.id] = file;
  }

  function registerTerm(t, i, file) {
    var where = { file: file, index: i };
    if (!t || typeof t !== 'object') { warn('term-invalid', mix(where, { reason: '객체가 아님' })); return; }
    where.id = t.id;
    if (typeof t.id !== 'string' || !RE_TERM.test(t.id)) { warn('term-invalid', mix(where, { reason: 'id 슬러그 형식' })); return; }
    var missing = [];
    if (!nonEmptyText(t.ko)) missing.push('ko');
    if (!nonEmptyText(t.en)) missing.push('en');
    if (!nonEmptyText(t.def)) missing.push('def');
    if (missing.length) warn('term-missing', mix(where, { fields: missing }));

    var prev = store.terms[t.id];
    if (prev) {
      // 먼저 등록된 정의를 유지한다. 정의가 다르면 사람이 Review 에서 병합할 수 있게 남긴다.
      if (text(prev.def).trim() !== text(t.def).trim()) {
        warn('term-conflict', { id: t.id, files: [store.termFile[t.id], file], defs: [text(prev.def), text(t.def)] });
      }
      // 관련 노드/용어는 합집합으로 보탠다 — 정의가 아니라 링크일 뿐이므로 충돌이 아니다.
      prev.nodes = union(prev.nodes, t.nodes);
      prev.related = union(prev.related, t.related);
      return;
    }
    var copy = {
      id: t.id, ko: text(t.ko), en: text(t.en), def: text(t.def),
      nodes: union([], t.nodes), related: union([], t.related)
    };
    store.terms[t.id] = copy;
    store.termOrder.push(t.id);
    store.termFile[t.id] = file;
  }

  function union(a, b) {
    var out = Array.isArray(a) ? a.slice() : [];
    if (Array.isArray(b)) b.forEach(function (x) { if (typeof x === 'string' && out.indexOf(x) < 0) out.push(x); });
    return out;
  }
  function mix(a, b) { for (var k in b) a[k] = b[k]; return a; }

  /**
   * 콘텐츠 파일의 유일한 진입점.
   * pack = { chapter, cards:{nodeId:card}, questions:[], practices:[], terms:[] }
   * 어떤 필드도 선택이다(빈 파일도 등록 가능). 예외를 던지지 않는다 — 콘텐츠 한 파일이
   * 깨져도 나머지 파일과 앱은 살아야 한다.
   */
  DS2.register = function (pack) {
    var file = currentFile(pack);
    store.files.push(file);
    if (!pack || typeof pack !== 'object') { warn('register-invalid', { file: file, reason: '인수가 객체가 아님' }); return; }
    if (typeof pack.chapter !== 'string') warn('register-missing', { file: file, fields: ['chapter'] });
    else store.chapters[file] = pack.chapter;

    var k, i;
    if (pack.cards && typeof pack.cards === 'object') {
      for (k in pack.cards) if (Object.prototype.hasOwnProperty.call(pack.cards, k)) registerCard(k, pack.cards[k], file);
    }
    if (pack.questions != null) {
      if (!Array.isArray(pack.questions)) warn('register-invalid', { file: file, reason: 'questions 가 배열이 아님' });
      else for (i = 0; i < pack.questions.length; i++) registerQuestion(pack.questions[i], i, file);
    }
    if (pack.practices != null) {
      if (!Array.isArray(pack.practices)) warn('register-invalid', { file: file, reason: 'practices 가 배열이 아님' });
      else for (i = 0; i < pack.practices.length; i++) registerPractice(pack.practices[i], i, file);
    }
    if (pack.terms != null) {
      if (!Array.isArray(pack.terms)) warn('register-invalid', { file: file, reason: 'terms 가 배열이 아님' });
      else for (i = 0; i < pack.terms.length; i++) registerTerm(pack.terms[i], i, file);
    }
  };
  // spec 에서 이름이 언급된 별칭. 용어만 따로 등록할 때.
  DS2.registerTerms = function (terms) { DS2.register({ chapter: '-', terms: terms }); };

  /* ────────────────────────────────────────────────────────
     읽기 API — 반환 배열은 복사본이다(호출자가 정렬·셔플해도 안전).
     ──────────────────────────────────────────────────────── */
  function byId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }

  DS2.getNode = function (id) {
    return (DS2.curriculum && DS2.curriculum.byId[id]) || null;
  };
  DS2.questionsOf = function (nodeId) { return (store.qByNode[nodeId] || []).slice().sort(byId); };
  DS2.practicesOf = function (nodeId) { return (store.pByNode[nodeId] || []).slice().sort(byId); };
  DS2.card = function (nodeId) { return store.cards[nodeId] || null; };
  DS2.term = function (id) { return store.terms[id] || null; };
  DS2.question = function (id) { return store.qById[id] || null; };
  DS2.practice = function (id) { return store.pById[id] || null; };
  DS2.allQuestions = function () { return store.questions.slice().sort(byId); };
  DS2.allPractices = function () { return store.practices.slice().sort(byId); };
  DS2.allTerms = function () { return store.termOrder.map(function (id) { return store.terms[id]; }); };
  DS2.allCards = function () { return Object.keys(store.cards).sort().map(function (k) { return store.cards[k]; }); };
  DS2.files = function () { return store.files.slice(); };
  DS2.chapterOf = function (file) { return store.chapters[file] || null; };
  DS2.fileOf = function (id) { return store.fileOf[id] || null; };
  DS2.termFileOf = function (id) { return store.termFile[id] || null; };
  DS2.hasContent = function (nodeId) {
    return !!(store.cards[nodeId] || store.qByNode[nodeId] || store.pByNode[nodeId]);
  };

  /** 용어 → 그 용어를 태그한 문제. 부팅 후 첫 호출에 1회 만든다(spec 5-7). */
  DS2.questionsByTerm = function (termId) {
    if (!store.qByTerm) {
      var idx = {};
      store.questions.forEach(function (q) {
        (Array.isArray(q.terms) ? q.terms : []).forEach(function (t) {
          (idx[t] || (idx[t] = [])).push(q);
        });
      });
      store.qByTerm = idx;
    }
    return (store.qByTerm[termId] || []).slice().sort(byId);
  };

  DS2.stats = function () {
    return {
      files: store.files.length,
      cards: Object.keys(store.cards).length,
      questions: store.questions.length,
      practices: store.practices.length,
      terms: store.termOrder.length,
      warnings: DS2.warnings.length
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
