/* ============================================================
   ds-level2 — 콘텐츠 검증기 (spec 10절 B 의 기계 검사 전부)

   두 환경에서 같은 코드가 돈다.
   - Node:    node tools/validate.js data/a1-sql.js [...]   (인수 없으면 data/*.js 전부)
              registry.js·curriculum.js·대상 파일을 vm 컨텍스트에 로드한 뒤 검사한다.
              종료 코드: 에러가 하나라도 있으면 1.
   - 브라우저: tools/validate.html 이 <script> 로 데이터를 로드한 뒤 DS2Validate.run() 호출.

   ERROR  = 스키마 위반·채점 불가·계약 위반. 콘텐츠 에이전트가 반드시 고친다.
   WARNING = 할당·분포·품질 권고에서 벗어남. 사유를 적어 보고하면 된다.
   앱 런타임은 이 파일을 로드하지 않는다.
   ============================================================ */
(function (root) {
  'use strict';

  var V = {};

  /* ────────────────────────────────────────────────────────
     기준표 — spec 2절(제목), 4절(할당)
     ──────────────────────────────────────────────────────── */
  // 트리가 색인과 달라지는 것을 막는 하드코딩 대조표 (spec 11절). curriculum.js 와 독립적으로 유지한다.
  V.TITLES = {
    'a-1-1': '1-1 SQL 기초', 'a-1-2': '1-2 SQL 중급', 'a-1-3': '1-3 SQL 고급', 'a-1-4': '1-4 SQL ↔ Pandas',
    'a-2-1': '2-1 Pandas 기초', 'a-2-2': '2-2 Pandas 데이터 정제', 'a-2-3': '2-3 Pandas 변환과 집계',
    'a-2-4': '2-4 Pandas 병합과 결합', 'a-2-5': '2-5 Pandas 시계열', 'a-2-6': '2-6 Pandas 고급',
    'a-3-1': '3-1 Python Native 문법', 'a-3-2': '3-2 Pandas 문법 기본', 'a-3-3': '3-3 Pandas 문법 심화',
    'a-3-4': '3-4 Scikit-Learn', 'a-3-5': '3-5 statsmodels', 'a-3-6': '3-6 Scipy',
    'a-3-7': '3-7 특수 라이브러리 및 수동 구현',
    'a-4-1': '4-1 다중 컬럼 및 전처리', 'a-4-2': '4-2 모델 평가 및 변수 선택',
    'a-4-3': '4-3 파라미터 튜닝 및 군집화', 'a-4-4': '4-4 통계 검정 및 특수 모델링',
    'b-1': '1. Python native 문법 익히기', 'b-1-2': '1-2 이해도 점검 문제',
    'b-2': '2. pandas 문법 익히기', 'b-2-2': '2-2 이해도 점검 문제',
    'b-3': '3. 복합 패턴 — Python + pandas 조합의 원리', 'b-3-2': '3-2 이해도 점검 문제',
    'b-4': '4. 신뢰구간과 선형회귀분석', 'b-4-2': '4-2 이해도 점검 문제',
    'b-5': '5. 가설검정', 'b-5-2': '5-2 이해도 점검 문제'
  };
  // 챕터별 토픽당 실습 수 (spec 4절). 점검 노드는 0.
  var PRACTICE_QUOTA = { 'a-1': 2, 'a-2': 3, 'a-3': 2, 'a-4': 3, 'b-1': 2, 'b-2': 2, 'b-3': 2, 'b-4': 2, 'b-5': 2 };

  V.quotaFor = function (node) {
    if (node.type === 'check') {
      return { q: 20, type: { mcq: 12, ox: 3, short: 5 }, diff: [6, 10, 4],
        kindMin: { output: 6 }, p: 0, card: 0 };
    }
    return { q: 12, type: { mcq: 7, ox: 2, short: 3 }, diff: [4, 6, 2],
      kindMin: { concept: 5, output: 3, bug: 1, fill: 1 },
      p: PRACTICE_QUOTA[node.chapter] || 2, card: 1 };
  };

  /* ────────────────────────────────────────────────────────
     파일 텍스트 검사 — 템플릿 리터럴(백틱 문자열) 탐지
     문자열·주석 상태를 추적하며 1패스 스캔한다. "..." 안의 백틱(인라인 코드 마크업)은
     정상이고, 문자열·주석 밖에서 만나는 백틱만 템플릿 리터럴의 시작이다.
     ──────────────────────────────────────────────────────── */
  V.scanBackticks = function (src) {
    var hits = [];
    var state = null; // null | '"' | "'" | '//' | '/*'
    var line = 1;
    for (var i = 0; i < src.length; i++) {
      var ch = src[i], nx = src[i + 1];
      if (ch === '\n') line++;
      if (state === '"' || state === "'") {
        if (ch === '\\') { i++; if (src[i] === '\n') line++; continue; }
        if (ch === state || ch === '\n') state = null; // 줄바꿈이면 깨진 문자열 — 어차피 구문 오류
        continue;
      }
      if (state === '//') { if (ch === '\n') state = null; continue; }
      if (state === '/*') { if (ch === '*' && nx === '/') { state = null; i++; } continue; }
      if (ch === '"' || ch === "'") { state = ch; continue; }
      if (ch === '/' && nx === '/') { state = '//'; i++; continue; }
      if (ch === '/' && nx === '*') { state = '/*'; i++; continue; }
      if (ch === '`') hits.push(line);
    }
    return hits;
  };

  /* ────────────────────────────────────────────────────────
     헬퍼
     ──────────────────────────────────────────────────────── */
  function text(v) {
    if (Array.isArray(v)) return v.map(function (s) { return s == null ? '' : String(s); }).join('\n');
    return v == null ? '' : String(v);
  }
  function isText(v) {
    if (typeof v === 'string') return true;
    if (!Array.isArray(v)) return false;
    for (var i = 0; i < v.length; i++) if (typeof v[i] !== 'string') return false;
    return true;
  }
  var RE_LINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
  function links(s) {
    var out = [], m;
    RE_LINK.lastIndex = 0;
    while ((m = RE_LINK.exec(s))) out.push(m[1].trim());
    return out;
  }
  var CIRCLED = '①②③④⑤';
  function pct(n, d) { return d ? Math.round(n * 100 / d) : 0; }
  function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
  function lpad(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }
  // 한글은 2칸 폭. 표 정렬용 대략치.
  function width(s) { var w = 0; for (var i = 0; i < s.length; i++) w += /[ᄀ-ᇿ㄰-㆏가-힯　-〿＀-￯─-◿←-⇿]/.test(s[i]) ? 2 : 1; return w; }
  function padw(s, n) { s = String(s); var w = width(s); return w < n ? s + Array(n - w + 1).join(' ') : s; }

  /* ────────────────────────────────────────────────────────
     본 검사
     DS2   : 데이터가 등록된 레지스트리 (vm 컨텍스트의 것 또는 window.DS2)
     files : [{ name, text? }]  — text 가 있으면 백틱 검사. 없으면 건너뛰고 note 를 남긴다.
     opts  : { all: boolean }   — true 면 콘텐츠 없는 노드도 경고
     ──────────────────────────────────────────────────────── */
  V.run = function (DS2, files, opts) {
    opts = opts || {};
    files = files || [];
    var errors = [], warnings = [], notes = [];
    function err(file, id, msg) { errors.push({ file: file || '-', id: id || '-', msg: msg }); }
    function warn(file, id, msg) { warnings.push({ file: file || '-', id: id || '-', msg: msg }); }

    var cur = DS2.curriculum;
    if (!cur) { err('curriculum.js', '-', 'DS2.curriculum 없음 — curriculum.js 가 로드되지 않았다'); return finish(); }

    // 0. 트리 제목 대조 (31개)
    Object.keys(V.TITLES).forEach(function (id) {
      var n = cur.byId[id];
      if (!n) err('curriculum.js', id, '트리에 노드가 없다');
      else if (n.title !== V.TITLES[id]) err('curriculum.js', id, '제목이 색인과 다름: "' + n.title + '" ≠ "' + V.TITLES[id] + '"');
    });
    if (cur.learnable.length !== 31) err('curriculum.js', '-', '학습 노드 수 ' + cur.learnable.length + ' ≠ 31');

    // 1. 파일 텍스트: 백틱
    var textScanned = 0;
    files.forEach(function (f) {
      if (typeof f.text !== 'string') return;
      textScanned++;
      var hits = V.scanBackticks(f.text);
      if (hits.length) err(f.name, '-', '템플릿 리터럴(백틱 문자열) 사용 — 줄 ' + hits.slice(0, 8).join(', ') + (hits.length > 8 ? ' …(' + hits.length + '곳)' : ''));
      // 주석 속 "DS2.register()" 언급을 세지 않도록 여는 중괄호까지 본다.
      var regCount = (f.text.match(/DS2\.register\s*\(\s*\{/g) || []).length;
      if (regCount !== 1) warn(f.name, '-', 'DS2.register() 호출이 ' + regCount + '회 (1회 권장)');
    });
    if (textScanned < files.length) notes.push('파일 텍스트를 읽지 못해 백틱 검사를 건너뛴 파일 ' + (files.length - textScanned) + '개');

    // 2. 레지스트리가 등록 중 남긴 경고 → 대부분 ERROR
    DS2.warnings.forEach(function (w) {
      var id = w.id || w.node || '-';
      var msg = w.type + (w.reason ? ': ' + w.reason : '') + (w.fields ? ': 필수 필드 누락 ' + w.fields.join(', ') : '');
      if (w.type === 'term-conflict') {
        warn(w.files.join(' vs '), w.id, '용어 정의 충돌 — "' + trunc(w.defs[0]) + '" vs "' + trunc(w.defs[1]) + '" (선등록 유지, 사람이 병합)');
      } else if (w.type === 'card-duplicate') {
        err(w.file, id, '카드 중복 등록 (' + w.keptFrom + ' 것을 유지)');
      } else if (/duplicate/.test(w.type)) {
        err(w.file, id, 'id 중복 (먼저 등록: ' + w.firstFile + ')');
      } else {
        err(w.file, id, msg);
      }
    });

    var termIds = {};
    DS2.allTerms().forEach(function (t) { termIds[t.id] = t; });
    function checkTerms(file, id, arr, label) {
      if (!Array.isArray(arr)) return;
      arr.forEach(function (t) {
        if (typeof t !== 'string') err(file, id, label + ' 항목이 문자열이 아님');
        else if (!termIds[t]) err(file, id, label + ' "' + t + '" 가 사전에 없음 (자기 파일에서 정의해야 한다)');
      });
    }
    function checkLinks(file, id, s, label) {
      links(text(s)).forEach(function (t) {
        if (!termIds[t]) err(file, id, label + '의 [[' + t + ']] 를 해석할 수 없음 (사전에 없음)');
      });
    }

    // 3. 용어
    DS2.allTerms().forEach(function (t) {
      var file = DS2.termFileOf(t.id);
      checkLinks(file, t.id, t.def, 'def');
      if (t.def && t.def.length < 10) warn(file, t.id, '정의가 너무 짧음 (' + t.def.length + '자)');
      t.nodes.forEach(function (n) { if (!cur.byId[n]) warn(file, t.id, 'nodes 의 "' + n + '" 가 트리에 없음'); });
      t.related.forEach(function (r) { if (!termIds[r]) warn(file, t.id, 'related 의 "' + r + '" 가 사전에 없음'); });
    });

    // 4. 문제
    var perNode = {};
    function bucket(nodeId) {
      return perNode[nodeId] || (perNode[nodeId] = {
        q: 0, type: { mcq: 0, ox: 0, short: 0 }, diff: [0, 0, 0], kind: { concept: 0, output: 0, bug: 0, fill: 0 },
        ans: {}, mcq: 0, p: 0, pdiff: [], card: 0, files: {}
      });
    }
    var LANGS = { python: 1, sql: 1, text: 1 };
    DS2.allQuestions().forEach(function (q) {
      var file = DS2.fileOf(q.id);
      var b = bucket(q.node);
      b.q++; b.files[file] = 1;
      if (b.type[q.type] != null) b.type[q.type]++;
      if (q.difficulty >= 1 && q.difficulty <= 3) b.diff[q.difficulty - 1]++;
      if (b.kind[q.kind] != null) b.kind[q.kind]++;

      // 챕터 일치
      var node = cur.byId[q.node];
      var ch = DS2.chapterOf(file);
      if (ch && node && ch !== node.chapter) err(file, q.id, '파일 chapter "' + ch + '" ≠ 노드 소속 챕터 "' + node.chapter + '"');

      // 코드/언어
      if (q.code != null) {
        if (!isText(q.code)) err(file, q.id, 'code 는 string | string[]');
        if (!q.lang) err(file, q.id, 'code 가 있으면 lang 필수');
        else if (!LANGS[q.lang]) err(file, q.id, 'lang "' + q.lang + '" (python|sql|text)');
      } else if (q.kind === 'output' || q.kind === 'bug' || q.kind === 'fill') {
        // 빈칸 문제는 프롬프트의 인라인 코드(`...____...`)만으로도 성립한다(spec 3-3 예시).
        if (!/`/.test(text(q.prompt))) warn(file, q.id, 'kind=' + q.kind + ' 인데 code 가 없음');
      }
      if (q.prompt != null && !isText(q.prompt)) err(file, q.id, 'prompt 는 string | string[]');
      if (q.explanation != null && !isText(q.explanation)) err(file, q.id, 'explanation 은 string | string[]');

      // type 별 답
      if (q.type === 'mcq') {
        b.mcq++;
        b.ans[q.answer] = (b.ans[q.answer] || 0) + 1;
        if (q.choices.length < 3 || q.choices.length > 5) err(file, q.id, 'mcq choices 는 3~5개 (현재 ' + q.choices.length + ')');
        q.choices.forEach(function (c, i) { if (!isText(c)) err(file, q.id, 'choices[' + i + '] 가 문자열이 아님'); });
        if (q.choices.length === 5 && CIRCLED.length < 5) { /* 불가 */ }
      } else if (q.type === 'short') {
        var a = q.answer.trim();
        if (/\s/.test(a)) err(file, q.id, 'short 정답은 1토큰(공백 없음): "' + a + '"');
        if (a.length > 30) err(file, q.id, 'short 정답 30자 초과 (' + a.length + ')');
        if (q.accept != null) {
          if (!Array.isArray(q.accept)) err(file, q.id, 'accept 는 string[]');
          else q.accept.forEach(function (x) { if (typeof x !== 'string') err(file, q.id, 'accept 항목이 문자열이 아님'); });
        }
        if (q.choices) warn(file, q.id, 'short 에 choices 가 있음 (무시됨)');
      } else if (q.type === 'ox') {
        if (q.choices) warn(file, q.id, 'ox 에 choices 가 있음 (무시됨)');
      }

      // 해설
      var ex = text(q.explanation);
      if (ex.trim().length < 60) err(file, q.id, 'explanation 60자 미만 (' + ex.trim().length + '자)');
      if (!/정답/.test(ex)) warn(file, q.id, '해설 첫 줄에 "정답" 명시 권장 (**정답: ②**)');
      if (q.type === 'mcq') {
        var circ = 0;
        for (var ci = 0; ci < q.choices.length; ci++) if (ex.indexOf(CIRCLED[ci]) >= 0) circ++;
        var mentioned = 0;
        q.choices.forEach(function (c, i) {
          if (i === q.answer) return;
          var plain = text(c).replace(/[`*]/g, '').trim();
          if (plain.length >= 2 && ex.indexOf(plain) >= 0) mentioned++;
        });
        if (circ < 2 && mentioned < 2) err(file, q.id, 'mcq 해설에 오답 보기 언급 부족 (①②③④ 또는 보기 텍스트 2개 이상 필요)');
      }

      // 용어
      if (!Array.isArray(q.terms) || !q.terms.length) err(file, q.id, 'terms 1개 이상 필수');
      else {
        if (q.terms.length > 5) warn(file, q.id, 'terms 5개 초과 (' + q.terms.length + ')');
        checkTerms(file, q.id, q.terms, 'terms');
      }
      checkLinks(file, q.id, q.prompt, 'prompt');
      checkLinks(file, q.id, q.explanation, 'explanation');
      if (q.choices) q.choices.forEach(function (c) { checkLinks(file, q.id, c, 'choices'); });
      if (!links(ex).length) warn(file, q.id, '해설에 [[term]] 링크가 없음 (최소 1개 권장)');
    });

    // 5. 실습
    var RE_SEED = /default_rng\(\s*\d+\s*\)|random_state\s*=\s*\d+|np\.random\.seed\(\s*\d+\s*\)|\brandom\.seed\(\s*\d+\s*\)|\bseed\s*=\s*\d+/;
    var RE_RANDOM = /\brng\b|random|make_\w+\(|\.sample\(|shuffle|train_test_split|KMeans|RandomForest|GradientBoosting|permutation|bootstrap/i;
    var FORBIDDEN = [
      [/https?:\/\//, 'URL(http)'],
      [/\burlopen\b/, 'urlopen'],
      [/\brequests\b/, 'requests'],
      [/\bfetch_\w+/, 'sklearn fetch_* (다운로드)'],
      [/\b(?:sns|seaborn)\.load_dataset\b/, 'seaborn.load_dataset'],
      [/\b(?:sm|statsmodels)(?:\.api)?\.datasets\b/, 'statsmodels.datasets (다운로드)'],
      [/read_csv\(\s*["']\w+:\/\//, 'read_csv(URL)']
    ];
    var ATYPES = { number: 1, int: 1, string: 1 };
    DS2.allPractices().forEach(function (p) {
      var file = DS2.fileOf(p.id);
      var b = bucket(p.node);
      b.p++; b.files[file] = 1;
      if (p.difficulty) b.pdiff.push(p.difficulty);
      var node = cur.byId[p.node];
      var ch = DS2.chapterOf(file);
      if (ch && node && ch !== node.chapter) err(file, p.id, '파일 chapter "' + ch + '" ≠ 노드 소속 챕터 "' + node.chapter + '"');
      if (node && node.type === 'check') warn(file, p.id, '점검 노드에는 실습을 두지 않는다');

      ['task', 'setup', 'solution', 'explanation', 'hint', 'title'].forEach(function (k) {
        if (p[k] != null && !isText(p[k])) err(file, p.id, k + ' 는 string | string[]');
      });
      var setup = text(p.setup), sol = text(p.solution);
      var code = setup + '\n' + sol;
      if (!RE_SEED.test(setup)) {
        if (RE_RANDOM.test(code)) err(file, p.id, 'setup 에 고정 시드 없음 (default_rng(n) / random_state=n / np.random.seed(n))');
        else warn(file, p.id, 'setup 에 시드가 없음 — 리터럴 데이터만 쓴다면 무시 가능');
      }
      FORBIDDEN.forEach(function (f) { if (f[0].test(code)) err(file, p.id, '금지 패턴 ' + f[1]); });
      if (/\bpd\.read_sql\b/.test(sol) && !/sqlite3/.test(setup)) warn(file, p.id, 'read_sql 을 쓰는데 setup 에 sqlite3 인메모리 DB 가 없음');

      var a = p.answer || {};
      if (!ATYPES[a.type]) err(file, p.id, 'answer.type "' + a.type + '" (number|int|string)');
      if (a.type === 'number') {
        if (typeof a.decimals !== 'number' || a.decimals !== Math.floor(a.decimals) || a.decimals < 0 || a.decimals > 6) err(file, p.id, 'number 답은 decimals(0~6) 필수');
        else if (!/반올림|자리|소수|정수/.test(text(p.task))) warn(file, p.id, 'task 문장에 반올림 자릿수를 명시해야 한다');
        if (typeof a.value === 'number' && typeof a.decimals === 'number') {
          var r = Math.round(a.value * Math.pow(10, a.decimals)) / Math.pow(10, a.decimals);
          if (Math.abs(r - a.value) > 1e-9) warn(file, p.id, 'answer.value ' + a.value + ' 가 decimals=' + a.decimals + ' 로 반올림되어 있지 않음 (' + r + ')');
        }
      }
      if (a.type === 'string' && a.accept != null && !Array.isArray(a.accept)) err(file, p.id, 'answer.accept 는 string[]');
      if (!p.verified || typeof p.verified !== 'object' || !p.verified.by) err(file, p.id, 'verified { by, at, env } 필수');
      else if (p.verified.by !== 'python') warn(file, p.id, '미검증 실습 (verified.by=' + p.verified.by + (p.verified.reason ? ': ' + p.verified.reason : '') + ')');
      if (text(p.explanation).trim().length < 30) warn(file, p.id, '실습 해설이 짧음 (30자 미만)');
      if (p.hint != null && Array.isArray(p.hint) && p.hint.length > 3) warn(file, p.id, 'hint 는 0~3개');

      if (!Array.isArray(p.terms) || !p.terms.length) err(file, p.id, 'terms 1개 이상 필수');
      else checkTerms(file, p.id, p.terms, 'terms');
      ['task', 'hint', 'explanation'].forEach(function (k) { checkLinks(file, p.id, p[k], k); });
    });

    // 6. 카드
    DS2.allCards().forEach(function (c) {
      var file = c._file;
      var node = cur.byId[c.node];
      var b = bucket(c.node);
      b.card++; b.files[file] = 1;
      var ch = DS2.chapterOf(file);
      if (ch && node && ch !== node.chapter) err(file, c.node, '카드: 파일 chapter "' + ch + '" ≠ 노드 챕터 "' + node.chapter + '"');
      if (node && node.type === 'check') warn(file, c.node, '점검 노드에는 카드를 두지 않는다 (퀴즈만)');
      if (node && text(c.title) !== node.name && text(c.title) !== node.title) warn(file, c.node, '카드 title "' + text(c.title) + '" 이 색인 제목 "' + node.name + '" 과 다름');
      function range(arr, name, lo, hi) {
        if (!Array.isArray(arr)) return;
        if (arr.length < lo || arr.length > hi) warn(file, c.node, '카드 ' + name + ' ' + arr.length + '개 (권장 ' + lo + '~' + hi + ')');
      }
      range(c.concepts, 'concepts', 3, 8);
      range(c.terms, 'terms', 3, 12);
      range(c.patterns, 'patterns', 3, 7);
      range(c.pitfalls, 'pitfalls', 0, 5);
      if (Array.isArray(c.concepts)) c.concepts.forEach(function (x, i) { if (!isText(x)) err(file, c.node, 'concepts[' + i + '] 가 문자열이 아님'); checkLinks(file, c.node, x, 'concepts'); });
      if (Array.isArray(c.pitfalls)) c.pitfalls.forEach(function (x, i) { if (!isText(x)) err(file, c.node, 'pitfalls[' + i + '] 가 문자열이 아님'); checkLinks(file, c.node, x, 'pitfalls'); });
      checkLinks(file, c.node, c.summary, 'summary');
      if (Array.isArray(c.patterns)) c.patterns.forEach(function (pt, i) {
        var tag = 'patterns[' + i + ']';
        if (!pt || typeof pt !== 'object') { err(file, c.node, tag + ' 가 객체가 아님'); return; }
        if (!isText(pt.title) || !text(pt.title).trim()) err(file, c.node, tag + '.title 필수');
        if (!LANGS[pt.lang]) err(file, c.node, tag + '.lang "' + pt.lang + '" (python|sql|text)');
        if (!isText(pt.code) || !text(pt.code).trim()) err(file, c.node, tag + '.code 필수');
        if (pt.note != null && !isText(pt.note)) err(file, c.node, tag + '.note 는 string | string[]');
        checkLinks(file, c.node, pt.note, tag + '.note');
      });
      checkTerms(file, c.node, c.terms, '카드 terms');
    });

    // 7. 노드별 할당 비교 (_sample.js 만의 노드는 제외)
    var rows = [];
    var sampleOnly = function (b) {
      var fs = Object.keys(b.files);
      return fs.length > 0 && fs.every(function (f) { return /^_sample\.js$/.test(f) || /\/_sample\.js$/.test(f); });
    };
    cur.learnable.forEach(function (id) {
      var node = cur.byId[id];
      var b = perNode[id];
      var quota = V.quotaFor(node);
      if (!b) {
        if (opts.all) warn('-', id, '콘텐츠 없음 (준비 중으로 표시됨)');
        return;
      }
      var fileLabel = Object.keys(b.files).join(',');
      var skew = 0, skewIdx = -1;
      Object.keys(b.ans).forEach(function (k) { if (b.ans[k] > skew) { skew = b.ans[k]; skewIdx = Number(k); } });
      var skewPct = pct(skew, b.mcq);
      var issues = [];
      if (!sampleOnly(b)) {
        function cmp(label, got, want) {
          if (Math.abs(got - want) > 1) { issues.push(label + ' ' + got + '/' + want); warn(fileLabel, id, label + ' ' + got + '개 — 할당 ' + want + ' (±1 밖)'); }
        }
        cmp('문제', b.q, quota.q);
        cmp('mcq', b.type.mcq, quota.type.mcq);
        cmp('ox', b.type.ox, quota.type.ox);
        cmp('short', b.type.short, quota.type.short);
        cmp('난이도1', b.diff[0], quota.diff[0]);
        cmp('난이도2', b.diff[1], quota.diff[1]);
        cmp('난이도3', b.diff[2], quota.diff[2]);
        Object.keys(quota.kindMin).forEach(function (k) {
          if (b.kind[k] < quota.kindMin[k]) { issues.push('kind:' + k + ' ' + b.kind[k] + '<' + quota.kindMin[k]); warn(fileLabel, id, 'kind ' + k + ' ' + b.kind[k] + '개 — 최소 ' + quota.kindMin[k]); }
        });
        if (b.q && b.type.short / b.q > 0.3 + 1e-9 && b.type.short - quota.type.short > 1) warn(fileLabel, id, 'short 비율 ' + pct(b.type.short, b.q) + '% (30% 이하 권장)');
        if (b.p !== quota.p) { issues.push('실습 ' + b.p + '/' + quota.p); warn(fileLabel, id, '실습 ' + b.p + '개 — 할당 ' + quota.p); }
        else if (quota.p > 0) {
          var want = quota.p === 2 ? [1, 2] : [1, 2, 3];
          var got = b.pdiff.slice().sort().join(',');
          if (got !== want.slice(0, quota.p).join(',')) warn(fileLabel, id, '실습 난이도 {' + got + '} — 권장 {' + want.slice(0, quota.p).join(',') + '}');
        }
        if (b.card !== quota.card) { issues.push('카드 ' + b.card + '/' + quota.card); if (quota.card && !b.card) warn(fileLabel, id, '요약 카드 없음'); }
        if (b.mcq >= 4 && skewPct >= 60) { issues.push('정답' + CIRCLED[skewIdx] + ' ' + skewPct + '%'); warn(fileLabel, id, 'mcq 정답 인덱스 편중 — ' + CIRCLED[skewIdx] + ' 가 ' + skewPct + '% (60% 이상)'); }
      }
      // id 연속성
      var qids = DS2.questionsOf(id).map(function (q) { return Number(q.id.slice(-2)); });
      for (var i = 0; i < qids.length; i++) if (qids[i] !== i + 1) { warn(fileLabel, id, '문제 번호가 01부터 연속이 아님 (' + qids.join(',') + ')'); break; }
      var pids = DS2.practicesOf(id).map(function (p) { return Number(p.id.slice(-2)); });
      for (var j = 0; j < pids.length; j++) if (pids[j] !== j + 1) { warn(fileLabel, id, '실습 번호가 01부터 연속이 아님 (' + pids.join(',') + ')'); break; }

      rows.push({
        node: id, q: b.q, quotaQ: quota.q, type: b.type, diff: b.diff, kind: b.kind,
        p: b.p, quotaP: quota.p, card: b.card, quotaCard: quota.card, skew: skewPct, skewIdx: skewIdx,
        issues: issues, sample: sampleOnly(b)
      });
    });

    return finish();

    function finish() {
      return {
        errors: errors, warnings: warnings, notes: notes, rows: rows || [],
        stats: DS2.stats ? DS2.stats() : null, files: files.map(function (f) { return f.name; })
      };
    }
  };

  function trunc(s) { s = String(s || ''); return s.length > 40 ? s.slice(0, 40) + '…' : s; }

  /* ────────────────────────────────────────────────────────
     사람이 읽는 출력
     ──────────────────────────────────────────────────────── */
  V.format = function (r) {
    var out = [];
    out.push('ds-level2 콘텐츠 검증 — 파일: ' + (r.files.length ? r.files.join(', ') : '(없음)'));
    if (r.stats) out.push('등록: 카드 ' + r.stats.cards + ' · 문제 ' + r.stats.questions + ' · 실습 ' + r.stats.practices + ' · 용어 ' + r.stats.terms);
    out.push('');
    out.push(padw('노드', 7) + lpad('문제', 7) + lpad('mcq/ox/sh', 11) + lpad('난이도1/2/3', 13) + lpad('c/o/b/f', 10) + lpad('실습', 6) + lpad('카드', 5) + lpad('정답편중', 9) + '  비고');
    r.rows.forEach(function (x) {
      out.push(padw(x.node, 7) + lpad(x.q + '/' + x.quotaQ, 7) +
        lpad(x.type.mcq + '/' + x.type.ox + '/' + x.type.short, 11) +
        lpad(x.diff.join('/'), 13) +
        lpad(x.kind.concept + '/' + x.kind.output + '/' + x.kind.bug + '/' + x.kind.fill, 10) +
        lpad(x.p + '/' + x.quotaP, 6) + lpad(x.card + '/' + x.quotaCard, 5) +
        lpad(x.skewIdx >= 0 ? CIRCLED[x.skewIdx] + x.skew + '%' : '-', 9) +
        '  ' + (x.sample ? '(샘플 — 할당 비교 제외)' : x.issues.join(', ')));
    });
    if (!r.rows.length) out.push('(검사할 노드 콘텐츠가 없음)');
    r.notes.forEach(function (n) { out.push('참고: ' + n); });
    if (r.errors.length) {
      out.push('');
      out.push('ERRORS (' + r.errors.length + ')');
      r.errors.forEach(function (e) { out.push('  [E] ' + e.file + ' ' + e.id + ' — ' + e.msg); });
    }
    if (r.warnings.length) {
      out.push('');
      out.push('WARNINGS (' + r.warnings.length + ')');
      r.warnings.forEach(function (w) { out.push('  [W] ' + w.file + ' ' + w.id + ' — ' + w.msg); });
    }
    out.push('');
    out.push('ERRORS: ' + r.errors.length + '  WARNINGS: ' + r.warnings.length);
    return out.join('\n');
  };

  root.DS2Validate = V;

  /* ────────────────────────────────────────────────────────
     Node CLI
     ──────────────────────────────────────────────────────── */
  var isNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  if (isNode) module.exports = V;
  if (isNode && require.main === module) {
    var fs = require('fs'), path = require('path'), vm = require('vm');
    var appDir = path.resolve(__dirname, '..');
    var args = process.argv.slice(2);
    var all = false;
    if (!args.length) {
      all = true;
      var dataDir = path.join(appDir, 'data');
      args = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter(function (f) { return /\.js$/.test(f) && f !== '_sample.js'; })
        .sort().map(function (f) { return path.join(dataDir, f); }) : [];
    }
    var ctx = vm.createContext({ console: console });
    function load(file, label) {
      var src = fs.readFileSync(file, 'utf8');
      vm.runInContext(src, ctx, { filename: label || file });
      return src;
    }
    load(path.join(appDir, 'js', 'registry.js'), 'registry.js');
    load(path.join(appDir, 'js', 'curriculum.js'), 'curriculum.js');
    var files = [];
    var loadErrors = [];
    args.forEach(function (f) {
      var abs = path.resolve(f);
      var name = path.basename(abs);
      if (!fs.existsSync(abs)) { loadErrors.push({ file: name, id: '-', msg: '파일 없음: ' + abs }); return; }
      var src = fs.readFileSync(abs, 'utf8');
      files.push({ name: name, text: src });
      ctx.DS2.__currentFile = name;
      try {
        vm.runInContext(src, ctx, { filename: name });
      } catch (e) {
        loadErrors.push({ file: name, id: '-', msg: '로드 실패 (' + (e && e.name) + '): ' + (e && e.message) + (e && e.stack ? '\n        ' + String(e.stack).split('\n').slice(0, 3).join('\n        ') : '') });
      }
    });
    ctx.DS2.__currentFile = undefined;
    var result = V.run(ctx.DS2, files, { all: all });
    result.errors = loadErrors.concat(result.errors);
    process.stdout.write(V.format(result) + '\n');
    process.exit(result.errors.length ? 1 : 0);
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
