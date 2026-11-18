/* ============================================================
   tests/fixtures/diagram-graphs-16.mjs — 16-1 배치 품질 표의 합성 그래프 10개(테스트 파일이 아니다 — `*.test.mjs` 아님)
   `tests/diagram-16.test.mjs` 와 스크래치 품질 표 스크립트가 함께 쓴다. 지어낸 라벨만(원서 문장 없음).
   ============================================================ */

const LABELS = [
  'Hyponatremia', 'Low serum sodium below the normal range', 'SIADH', 'Thiazide diuretics', 'Confusion and seizures',
  'Serum osmolality', 'Urine sodium', 'Hypovolemia', 'Euvolemia', 'Hypervolemia', 'Heart failure', 'Cirrhosis',
  'Adrenal insufficiency', 'Hypothyroidism', 'Water restriction', 'Gradual correction'
];

/** `ids` 노드 · `es` 엣지 `[a, b, r?]` · `src` 원어를 붙일 노드 번호들 · `paths` 노드별 경로(없으면 `k+1`). */
function g(name, ids, es, extra) {
  const x = extra || {};
  const nodes = ids.map((id, k) => {
    const n = { id: id, t: LABELS[k % LABELS.length], p: (x.paths && x.paths[k]) || String((k % 8) + 1) };
    if (x.src && x.src.indexOf(k) >= 0) n.src = 'terme original ' + id;
    return n;
  });
  return { name: name, graph: { nodes: nodes, edges: es.map((e) => ({ a: e[0], b: e[1], r: e[2] || 'cause' })) } };
}

const N12 = Array.from({ length: 12 }, (_, i) => 'n' + (i + 1));

export const GRAPHS = [
  g('사슬 5', ['a', 'b', 'c', 'd', 'e'], [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e']]),
  g('나무 10', ['r', 'x', 'y', 'z', 'x1', 'x2', 'y1', 'y2', 'z1', 'z2'],
    [['r', 'x', 'type'], ['r', 'y', 'type'], ['r', 'z', 'type'], ['x', 'x1', 'sign'], ['x', 'x2', 'sign'], ['y', 'y1', 'sign'],
      ['y', 'y2', 'sign'], ['z', 'z1', 'test'], ['z', 'z2', 'test']], { src: [0, 1, 2] }),
  g('고리 3', ['A', 'B', 'C'], [['A', 'B'], ['B', 'C'], ['C', 'A']]),
  g('고리 + 꼬리', ['a', 'b', 'c', 'd', 'e'], [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'b', 'leads'], ['d', 'e']]),
  g('두 층 건너기', ['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'd', 'assoc'], ['b', 'd', 'assoc']]),
  g('엣지 없는 노드', ['a', 'b', 'c', 'u', 'v', 'w'], [['a', 'b'], ['a', 'c']], { paths: ['1', '1.1', '1.2', '2.1.3', '3', '2.2'] }),
  g('12노드 16엣지 꽉 참', N12,
    [['n1', 'n2'], ['n1', 'n3'], ['n2', 'n4'], ['n3', 'n4'], ['n2', 'n5'], ['n3', 'n6'], ['n4', 'n7'], ['n5', 'n7'], ['n6', 'n8'],
      ['n7', 'n9'], ['n8', 'n9'], ['n9', 'n10'], ['n6', 'n11'], ['n11', 'n12'], ['n10', 'n12'], ['n1', 'n12', 'assoc']], { src: [0, 3, 6, 9] }),
  g('마름모', ['a', 'b', 'c', 'd'], [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd']]),
  g('엇갈린 두 줄', ['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4'],
    [['a1', 'b4'], ['a2', 'b3'], ['a3', 'b2'], ['a4', 'b1'], ['a1', 'b1', 'contrast']]),
  g('섞임(고리·양방향·건너기)', N12,
    [['n1', 'n2'], ['n2', 'n1', 'contrast'], ['n2', 'n3'], ['n3', 'n4'], ['n4', 'n2', 'leads'], ['n1', 'n5'], ['n5', 'n6'], ['n6', 'n7'],
      ['n1', 'n7', 'assoc'], ['n7', 'n8'], ['n8', 'n5', 'leads'], ['n3', 'n9'], ['n9', 'n10'], ['n10', 'n11'], ['n4', 'n11', 'part'], ['n11', 'n12']])
];

/** 고리가 있는 그래프(배치는 워커에서만 — 고리 끊기 변이가 전체 시험을 막지 않게). */
export const CYCLIC = new Set(['고리 3', '고리 + 꼬리', '섞임(고리·양방향·건너기)']);
