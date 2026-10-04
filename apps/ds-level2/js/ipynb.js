/* ============================================================
   ds-level2 — 실습 데이터 → .ipynb (nbformat 4.5) 생성 + Blob 다운로드

   정적 노트북을 저장소에 두지 않는다. 버튼을 누르면 등록된 실습 데이터로 JSON 을 만들어
   내려받는다 — 정답·힌트·셀이 데이터 한 곳에만 존재하므로 불일치가 생기지 않는다.
   nbformat_minor 5 는 모든 셀에 id([A-Za-z0-9-_] 1~64자)를 요구한다. 실습 id 에서 파생한다.
   앱의 미니 마크업은 거의 그대로 마크다운이므로 [[term]] → **한글(영문)** 치환만 한다.
   ============================================================ */
(function (root) {
  'use strict';
  var E = root.__DS2 || (root.__DS2 = {});

  function text(v) { return E.format ? E.format.text(v) : (Array.isArray(v) ? v.join('\n') : String(v == null ? '' : v)); }

  /** 미니 마크업 → 마크다운. [[id|label]] / [[id]] 만 바꾼다. */
  function toMarkdown(src) {
    return text(src).replace(/\[\[([a-z0-9-]+)(?:\|([^\]]*))?\]\]/g, function (_, id, label) {
      var t = root.DS2 && root.DS2.term(id);
      if (!t) return label || id;
      return '**' + (label || t.ko) + '(' + t.en + ')**';
    });
  }

  function md(id, source) { return { cell_type: 'markdown', id: id, metadata: {}, source: source }; }
  function code(id, source) { return { cell_type: 'code', id: id, metadata: {}, execution_count: null, outputs: [], source: source }; }
  var DOTS = ['', '●○○', '●●○', '●●●'];

  function practiceCells(p, index, includeSolution) {
    var cells = [];
    var task = '## 실습 ' + index + '. ' + text(p.title) + ' (난이도 ' + (p.difficulty || '-') + ')\n\n' + toMarkdown(p.task);
    var hints = Array.isArray(p.hint) ? p.hint : (p.hint ? [p.hint] : []);
    if (hints.length) {
      task += '\n\n<details><summary>힌트</summary>\n\n' + hints.map(function (h) { return '- ' + toMarkdown(h); }).join('\n') + '\n\n</details>';
    }
    cells.push(md(p.id + '-task', task));
    cells.push(code(p.id + '-setup', text(p.setup)));
    cells.push(code(p.id + '-work', '# 풀이를 여기에 작성하세요\n'));
    if (includeSolution) {
      cells.push(md(p.id + '-solution', '<details><summary>모범 답안</summary>\n\n```python\n' + text(p.solution) + '\n```\n\n' + toMarkdown(p.explanation) + '\n\n</details>'));
    }
    return cells;
  }

  /** 범위(topic id 또는 chapter/part id)에 속한 [노드, 실습[]] 목록 — 실습이 있는 노드만 */
  function groups(scopeId) {
    var cur = root.DS2.curriculum;
    var node = cur.byId[scopeId];
    if (!node) return [];
    return cur.descendants(scopeId).map(function (id) {
      return { node: cur.byId[id], practices: root.DS2.practicesOf(id) };
    }).filter(function (g) { return g.practices.length > 0; });
  }

  /** nbformat 4.5 JSON 문자열. opts.includeSolution */
  function build(scopeId, opts) {
    opts = opts || {};
    var cur = root.DS2.curriculum;
    var scope = cur.byId[scopeId];
    if (!scope) return null;
    var gs = groups(scopeId);
    var cells = [];
    var isMulti = gs.length > 1 || (scope.type !== 'topic' && scope.type !== 'check');
    var guide = '각 과제의 **준비 셀**을 실행한 뒤, **풀이 셀**에 코드를 쓰고 값을 앱에 입력하세요.';
    if (isMulti) cells.push(md(scopeId + '-intro', '# ' + scope.title + ' — 실습\n\n' + guide));
    var n = 0;
    gs.forEach(function (g) {
      if (isMulti) cells.push(md(g.node.id + '-intro', '# ' + g.node.title + ' — 실습'));
      else cells.push(md(g.node.id + '-intro', '# ' + g.node.title + ' — 실습\n\n' + guide));
      g.practices.forEach(function (p, i) {
        n++;
        practiceCells(p, i + 1, !!opts.includeSolution).forEach(function (c) { cells.push(c); });
      });
    });
    if (!n) return null;
    var nb = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: { name: 'python3', display_name: 'Python 3', language: 'python' },
        language_info: { name: 'python' },
        ds_level2: { scope: scopeId, generated: new Date().toISOString(), app: 'ds-level2 v1', solutions: !!opts.includeSolution }
      },
      cells: cells
    };
    return JSON.stringify(nb, null, 1);
  }

  function filename(scopeId) { return 'ds-level2_' + scopeId + '.ipynb'; }

  /** Blob 다운로드. 모바일 Safari 는 새 탭을 열 수 있으므로 UI 는 "PC 권장"을 함께 보인다. */
  function download(name, json) {
    try {
      var blob = new Blob([json], { type: 'application/x-ipynb+json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
      return true;
    } catch (e) {
      return false;
    }
  }

  E.ipynb = { toMarkdown: toMarkdown, build: build, filename: filename, download: download, groups: groups, DOTS: DOTS };
})(typeof globalThis !== 'undefined' ? globalThis : window);
