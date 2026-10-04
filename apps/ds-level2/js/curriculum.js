/* ============================================================
   ds-level2 — 커리큘럼 트리 (색인과 글자 하나까지 1:1)

   사용자가 색인 자체를 암기하는 것이 목표이므로 항목을 재배열·병합하지
   않는다. 제목 문자열은 색인 원문에서 그대로 복사했다 — 고치려면 spec 2절과
   tools/validate.js 의 대조표도 함께 고쳐야 한다.
   콘텐츠와 무관한 구조 데이터라 registry.js 바로 다음에 로드되며,
   레지스트리는 DS2.curriculum 을 통해 노드 존재를 확인한다.
   ============================================================ */
(function (root) {
  'use strict';
  var DS2 = root.DS2 || (root.DS2 = {});

  // [id, label(색인 번호), name(색인 제목)]. label+name 을 공백으로 이으면 색인 한 줄이 된다.
  var INDEX = [
    ['a', 'part', '파트 A.', '전처리', null, [
      ['a-1', 'chapter', '1.', 'SQL 학습', [
        ['a-1-1', 'topic', '1-1', 'SQL 기초'],
        ['a-1-2', 'topic', '1-2', 'SQL 중급'],
        ['a-1-3', 'topic', '1-3', 'SQL 고급'],
        ['a-1-4', 'topic', '1-4', 'SQL ↔ Pandas']
      ]],
      ['a-2', 'chapter', '2.', 'Pandas 학습', [
        ['a-2-1', 'topic', '2-1', 'Pandas 기초'],
        ['a-2-2', 'topic', '2-2', 'Pandas 데이터 정제'],
        ['a-2-3', 'topic', '2-3', 'Pandas 변환과 집계'],
        ['a-2-4', 'topic', '2-4', 'Pandas 병합과 결합'],
        ['a-2-5', 'topic', '2-5', 'Pandas 시계열'],
        ['a-2-6', 'topic', '2-6', 'Pandas 고급']
      ]],
      ['a-3', 'chapter', '3.', '라이브러리별 기본 사용법', [
        ['a-3-1', 'topic', '3-1', 'Python Native 문법'],
        ['a-3-2', 'topic', '3-2', 'Pandas 문법 기본'],
        ['a-3-3', 'topic', '3-3', 'Pandas 문법 심화'],
        ['a-3-4', 'topic', '3-4', 'Scikit-Learn'],
        ['a-3-5', 'topic', '3-5', 'statsmodels'],
        ['a-3-6', 'topic', '3-6', 'Scipy'],
        ['a-3-7', 'topic', '3-7', '특수 라이브러리 및 수동 구현']
      ]],
      ['a-4', 'chapter', '4.', '복합 사용법', [
        ['a-4-1', 'topic', '4-1', '다중 컬럼 및 전처리'],
        ['a-4-2', 'topic', '4-2', '모델 평가 및 변수 선택'],
        ['a-4-3', 'topic', '4-3', '파라미터 튜닝 및 군집화'],
        ['a-4-4', 'topic', '4-4', '통계 검정 및 특수 모델링']
      ]]
    ]],
    ['b', 'part', '파트 B.', '운영자의 비법 모음', null, [
      // 파트 B 의 b-N 은 챕터이자 학습 토픽이다(카드·퀴즈·실습). 자식 b-N-2 는 퀴즈만 있는 점검 노드.
      ['b-1', 'topic', '1.', 'Python native 문법 익히기', [
        ['b-1-2', 'check', '1-2', '이해도 점검 문제']
      ]],
      ['b-2', 'topic', '2.', 'pandas 문법 익히기', [
        ['b-2-2', 'check', '2-2', '이해도 점검 문제']
      ]],
      ['b-3', 'topic', '3.', '복합 패턴 — Python + pandas 조합의 원리', [
        ['b-3-2', 'check', '3-2', '이해도 점검 문제']
      ]],
      ['b-4', 'topic', '4.', '신뢰구간과 선형회귀분석', [
        ['b-4-2', 'check', '4-2', '이해도 점검 문제']
      ]],
      ['b-5', 'topic', '5.', '가설검정', [
        ['b-5-2', 'check', '5-2', '이해도 점검 문제']
      ]]
    ]]
  ];

  var byId = {};
  var roots = [];
  var learnable = [];   // topic + check, 색인 순서 (prev/next·"이어서 학습"의 기준)
  var order = 0;

  function build(row, parent, depth) {
    var node = {
      id: row[0],
      type: row[1],          // part | chapter | topic | check
      label: row[2],         // 색인 번호 ("1-1", "2.", "파트 A.")
      name: row[3],          // 색인 제목 ("SQL 기초")
      title: row[2] + ' ' + row[3],  // 색인 한 줄 원문
      order: order++,
      depth: depth,
      parent: parent ? parent.id : null,
      part: parent ? (parent.part || parent.id) : null,
      // chapter = 콘텐츠 파일의 chapter 필드와 대조할 값. 파트B 는 b-N 자신이 챕터.
      chapter: null,
      children: [],
      prev: null,
      next: null
    };
    if (node.type === 'chapter') node.chapter = node.id;
    else if (node.type === 'topic' && parent && parent.type === 'chapter') node.chapter = parent.id;
    else if (node.type === 'topic' && parent && parent.type === 'part') node.chapter = node.id;      // b-N
    else if (node.type === 'check') node.chapter = parent.id;                                        // b-N-2 → b-N
    byId[node.id] = node;
    if (node.type === 'topic' || node.type === 'check') learnable.push(node.id);
    var kids = node.type === 'part' ? row[5] : row[4];
    if (kids) kids.forEach(function (k) { node.children.push(build(k, node, depth + 1).id); });
    return node;
  }
  INDEX.forEach(function (r) { roots.push(build(r, null, 0).id); });

  learnable.forEach(function (id, i) {
    byId[id].prev = i > 0 ? learnable[i - 1] : null;
    byId[id].next = i < learnable.length - 1 ? learnable[i + 1] : null;
  });

  /** 노드 아래의 학습 가능 노드(topic/check) id 를 색인 순서로. 자신이 학습 노드면 자신 포함. */
  function descendants(id) {
    var n = byId[id];
    if (!n) return [];
    var out = [];
    (function walk(x) {
      if (x.type === 'topic' || x.type === 'check') out.push(x.id);
      x.children.forEach(function (c) { walk(byId[c]); });
    })(n);
    return out;
  }

  DS2.curriculum = {
    byId: byId,
    roots: roots,                 // ['a', 'b']
    learnable: learnable,         // 31개
    chapters: Object.keys(byId).filter(function (id) { return byId[id].chapter === id; }), // a-1..a-4, b-1..b-5
    descendants: descendants,
    /** 짧은 표시용 — 상단바 제목 등. 파트 접두를 붙여 "A 2-3 Pandas 변환과 집계" 로. */
    shortTitle: function (id) {
      var n = byId[id];
      if (!n) return id;
      return n.title;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
