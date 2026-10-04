/* ============================================================
   ds-level2 — 화면 렌더 (홈 / 트리 / 토픽 / 오답 / 복습 / 모의고사 / 사전 / 설정)

   각 뷰는 (el, route) 를 받아 el.innerHTML 을 채우고 필요한 리스너를 붙인다.
   HTML 은 문자열로 조립하되 콘텐츠는 전부 format.js(이스케이프·마크업)를 거친다.
   채점·상자·출제는 순수 모듈(grader/leitner/exam)에 맡기고, 여기서는 상태를 그리기만 한다.
   화면당 문제 1개만 렌더(400문제 성능), 목록은 텍스트 행만.
   ============================================================ */
(function (root) {
  'use strict';
  var E = root.__DS2 || (root.__DS2 = {});
  var DS2 = root.DS2;
  var F = E.format, S = E.store, L = E.leitner, G = E.grader, X = E.exam, R = E.router;
  var esc = F.escape;
  var cur = DS2.curriculum;
  var DOTS = ['', '●○○', '●●○', '●●●'];
  var KIND = { concept: '개념', output: '출력 예측', bug: '오류 찾기', fill: '빈칸' };
  var TYPE = { mcq: '객관식', ox: 'OX', short: '단답' };

  function app() { return E.app; }
  function text(v) { return F.text(v); }
  function pct(n, d) { return d ? Math.round(n * 100 / d) : 0; }
  function el(id) { return document.getElementById(id); }
  function q(container, sel) { return container.querySelector(sel); }
  function qa(container, sel) { return Array.prototype.slice.call(container.querySelectorAll(sel)); }
  function on(container, sel, type, fn) {
    qa(container, sel).forEach(function (n) { n.addEventListener(type, fn); });
  }
  function nodeTitle(id) { var n = cur.byId[id]; return n ? n.title : id; }
  function partLetter(id) { return id.charAt(0).toUpperCase(); }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }

  /** 모든 학습 노드의 상태 맵. 렌더마다 다시 계산(31×12 — 가볍다). */
  function allStatuses(progress) {
    var out = {};
    cur.learnable.forEach(function (id) {
      var n = cur.byId[id];
      out[id] = L.nodeStatus(n, DS2.questionsOf(id), DS2.practicesOf(id), progress, !!DS2.card(id));
    });
    return out;
  }
  function firstIncomplete(statuses) {
    for (var i = 0; i < cur.learnable.length; i++) {
      var s = statuses[cur.learnable[i]];
      if (s.status === 'learning') return cur.learnable[i];
    }
    for (var j = 0; j < cur.learnable.length; j++) {
      var t = statuses[cur.learnable[j]];
      if (t.status === 'none') return cur.learnable[j];
    }
    return null;
  }
  function statusDot(status) {
    var label = { done: '완료', learning: '학습중', none: '미학습', empty: '준비 중' }[status] || '';
    return '<span class="status-dot ' + status + '" aria-hidden="true"></span><span class="status-text ' + status + '">' + label + '</span>';
  }
  function termChips(ids) {
    if (!ids || !ids.length) return '';
    return '<div class="chips">' + ids.map(function (id) {
      var t = DS2.term(id);
      if (!t) return '<span class="chip">' + esc(id) + '</span>';
      return '<button type="button" class="chip term" data-term="' + esc(id) + '">' + esc(t.ko) + ' <span class="muted">(' + esc(t.en) + ')</span></button>';
    }).join('') + '</div>';
  }
  function ring(ratio, label) {
    var r = 36, c = 2 * Math.PI * r;
    return '<div class="ring" role="img" aria-label="' + esc(label) + '"><svg viewBox="0 0 84 84"><circle class="track" cx="42" cy="42" r="' + r + '"></circle>' +
      '<circle class="fill" cx="42" cy="42" r="' + r + '" stroke-dasharray="' + (c * ratio).toFixed(1) + ' ' + c.toFixed(1) + '"></circle></svg>' +
      '<div class="ring-label">' + Math.round(ratio * 100) + '%</div></div>';
  }
  function bar(ratio, cls) {
    return '<div class="bar ' + (cls || '') + '" aria-hidden="true"><span style="width:' + Math.round(ratio * 100) + '%"></span></div>';
  }
  function fullscreenHref() {
    var search = root.location.search.replace(/([?&])embed=1&?/, '$1').replace(/[?&]$/, '');
    return root.location.pathname.split('/').pop() + search + root.location.hash;
  }

  /* ════════════════════════════════════════════════════════
     홈
     ════════════════════════════════════════════════════════ */
  function home(view) {
    var p = S.get();
    var st = allStatuses(p);
    var doneNodes = cur.learnable.filter(function (id) { return st[id].status === 'done'; }).length;
    var totalQ = DS2.allQuestions().length, triedQ = Object.keys(p.quiz).filter(function (id) { return DS2.question(id); }).length;
    var totalP = DS2.allPractices().length, solvedP = Object.keys(p.practice).filter(function (id) { return p.practice[id].solved && DS2.practice(id); }).length;
    var due = L.dueIds(p.quiz).filter(function (id) { return DS2.question(id); }).length;
    var wrong = L.wrongIds(p.quiz).filter(function (id) { return DS2.question(id); }).length;
    var next = firstIncomplete(st);
    var recent = p.exams.slice(0, 8);
    var embedded = app().embedded;
    var partA = L.groupStatus(cur.descendants('a'), st), partB = L.groupStatus(cur.descendants('b'), st);

    var html = '';
    html += '<section class="card"><div class="hero">' + ring(doneNodes / 31, '전체 진도 ' + doneNodes + '/31 노드 완료') +
      '<div><h2 style="margin-bottom:.25rem">데이터 사이언스 레벨2</h2>' +
      '<div class="stat-line">노드 <strong>' + doneNodes + '/31</strong> 완료 · 문제 ' + triedQ + '/' + totalQ + ' · 실습 ' + solvedP + '/' + totalP + '</div>' +
      (next ? '<a class="btn btn-primary" style="margin-top:.6rem" href="#/topic/' + next + '">▶ 이어서 학습: ' + esc(nodeTitle(next)) + '</a>'
            : (totalQ ? '<p class="notice notice-ok" style="margin-top:.6rem">모든 노드를 완료했습니다. 복습과 모의고사로 유지하세요.</p>' : '<p class="muted small" style="margin-top:.6rem">콘텐츠가 아직 등록되지 않았습니다.</p>')) +
      '</div></div></section>';

    html += '<div class="dash-tiles">' +
      '<div class="tile"><span class="num">' + due + '</span><span class="lbl">오늘 복습</span><a class="btn btn-sm' + (due ? ' btn-primary' : '') + '" href="#/review">' + (due ? '시작' : '복습 없음') + '</a></div>' +
      '<div class="tile"><span class="num">' + wrong + '</span><span class="lbl">오답 노트</span><a class="btn btn-sm" href="#/wrong">' + (wrong ? '다시 풀기' : '보기') + '</a></div></div>';

    html += '<section class="card"><div class="row between"><h3 style="margin:0">최근 모의고사</h3><a class="btn btn-sm" href="#/exam">' + (recent.length ? '모의고사 보기' : '모의고사 시작') + '</a></div>';
    if (recent.length) {
      var rates = recent.slice().reverse().map(function (x) { return x.n ? x.score / x.n : 0; });
      html += '<p style="margin:.5rem 0 0">' + recent.slice(0, 3).map(function (x) { return '<a href="#/exam/result/' + esc(x.id) + '">' + x.score + '/' + x.n + '</a>'; }).join(' · ') +
        ' <span class="spark" aria-label="최근 점수 추이">' + X.sparkline(rates) + '</span></p>';
    } else html += '<p class="muted small" style="margin:.5rem 0 0">아직 응시 기록이 없습니다.</p>';
    html += '</section>';

    if (!embedded) {
      html += '<section class="card part-bars">' +
        '<div class="row"><span style="width:4.5rem">파트 A</span>' + bar(partA.total ? partA.done / 21 : 0) + '<span class="small nowrap">' + partA.done + '/21</span></div>' +
        '<div class="row"><span style="width:4.5rem">파트 B</span>' + bar(partB.total ? partB.done / 10 : 0) + '<span class="small nowrap">' + partB.done + '/10</span></div>' +
        '<a class="btn btn-sm" href="#/tree" style="margin-top:.5rem">커리큘럼 트리 보기</a></section>';
    } else {
      html += '<a class="btn btn-block" href="' + esc(fullscreenHref()) + '" target="_top" rel="noopener">전체 화면으로 열기 ↗</a>';
    }
    view.innerHTML = html;
  }

  /* ════════════════════════════════════════════════════════
     트리
     ════════════════════════════════════════════════════════ */
  var TREE_KEY = 'apps.ds-level2.tree.open';
  function openState() { try { return JSON.parse(S.session.get(TREE_KEY) || 'null'); } catch (e) { return null; } }

  function tree(view) {
    var p = S.get();
    var st = allStatuses(p);
    var open = openState();
    if (!open) {
      // 기본: 진행 중인 챕터만 펼침. 진행 중이 없으면 첫 미완료 챕터.
      open = {};
      var anyActive = false;
      cur.chapters.forEach(function (ch) { var g = L.groupStatus(cur.descendants(ch), st); if (g.active || (g.done > 0 && g.done < g.total)) { open[ch] = true; anyActive = true; } });
      if (!anyActive) { var first = firstIncomplete(st); if (first) open[cur.byId[first].chapter] = true; }
    }

    function nodeRow(id, sub) {
      var n = cur.byId[id], s = st[id];
      var meta;
      if (s.status === 'empty') meta = '준비 중';
      else if (s.status === 'done') meta = Math.round(s.rate * 100) + '%' + (s.practiceTotal ? ' · 실습 ' + s.practiceSolved + '/' + s.practiceTotal : '');
      else if (s.status === 'learning') meta = s.attempted + '/' + s.total + (s.practiceTotal ? ' · 실습 ' + s.practiceSolved + '/' + s.practiceTotal : '');
      else meta = s.total + '문제' + (s.practiceTotal ? ' · 실습 ' + s.practiceTotal : '');
      return '<li class="tree-node' + (sub ? ' sub' : '') + '"><div class="tree-row"><a href="#/topic/' + id + '">' + statusDot(s.status) +
        '<span class="grow">' + esc(n.title) + '</span><span class="meta">' + esc(meta) + '</span></a></div></li>';
    }
    function chapterBlock(chId) {
      var ch = cur.byId[chId];
      var g = L.groupStatus(cur.descendants(chId), st);
      var isOpen = !!open[chId];
      return '<li class="tree-chapter" data-chapter="' + chId + '" data-open="' + isOpen + '"><div class="tree-row">' +
        '<button type="button" class="tree-toggle" aria-expanded="' + isOpen + '" aria-label="' + esc(ch.title) + ' 펼치기/접기"></button>' +
        '<span class="grow">' + esc(ch.title) + '</span><span class="meta">' + g.done + '/' + ch.children.length + (g.done === ch.children.length && g.total ? ' ●' : '') + '</span></div>' +
        '<ul>' + ch.children.map(function (id) { return nodeRow(id, false); }).join('') + '</ul></li>';
    }
    function partBTopic(id) {
      var n = cur.byId[id];
      return nodeRow(id, false) + n.children.map(function (c) { return nodeRow(c, true); }).join('');
    }
    var html = '<ul class="tree">';
    ['a', 'b'].forEach(function (pid) {
      var part = cur.byId[pid];
      var g = L.groupStatus(cur.descendants(pid), st);
      html += '<li class="tree-part"><div class="tree-row"><span class="grow">' + esc(part.title) + '</span><span class="meta">' + g.done + '/' + cur.descendants(pid).length + '</span></div><ul>';
      html += part.children.map(function (c) { return cur.byId[c].type === 'chapter' ? chapterBlock(c) : partBTopic(c); }).join('');
      html += '</ul></li>';
    });
    html += '</ul><p class="muted small" style="margin-top:1rem">● 완료 = 요약 카드 열람 + 전 문제 시도 + 최근 정답률 80% 이상. 실습은 완료 조건에 들어가지 않습니다.</p>';
    view.innerHTML = html;
    on(view, '.tree-toggle', 'click', function (e) {
      var li = e.currentTarget.closest('.tree-chapter');
      var now = li.getAttribute('data-open') !== 'true';
      li.setAttribute('data-open', String(now));
      e.currentTarget.setAttribute('aria-expanded', String(now));
      open[li.getAttribute('data-chapter')] = now;
      S.session.set(TREE_KEY, JSON.stringify(open));
    });
  }

  /* ════════════════════════════════════════════════════════
     토픽 (요약 / 퀴즈 / 실습 탭)
     ════════════════════════════════════════════════════════ */
  function topic(view, route) {
    var id = route.params.id;
    var node = cur.byId[id];
    if (!node || (node.type !== 'topic' && node.type !== 'check')) return app().notFound(route);
    var isCheck = node.type === 'check';
    var tab = route.params.tab || (isCheck ? 'quiz' : 'card');
    if (isCheck) tab = 'quiz';
    var p = S.get();
    var questions = DS2.questionsOf(id), practices = DS2.practicesOf(id), card = DS2.card(id);
    var st = L.nodeStatus(node, questions, practices, p, !!card);
    app().setTitle(node.title);

    var html = '<div class="topic-head"><h2>' + esc(node.title) + '</h2><span class="small">' + statusDot(st.status) + '</span></div>';
    if (!isCheck) {
      html += '<div class="tabs" role="tablist" aria-label="토픽 탭">' +
        tabBtn('card', '요약', tab) + tabBtn('quiz', '퀴즈 ' + st.attempted + '/' + st.total, tab) + tabBtn('lab', '실습 ' + st.practiceSolved + '/' + st.practiceTotal, tab) + '</div>';
    }
    html += '<div id="tab-panel" role="tabpanel"></div>';
    html += prevNext(node);
    view.innerHTML = html;
    on(view, '[role="tab"]', 'click', function (e) { R.replace('#/topic/' + id + '/' + e.currentTarget.getAttribute('data-tab')); });
    on(view, '[role="tab"]', 'keydown', function (e) {
      var tabs = qa(view, '[role="tab"]'), i = tabs.indexOf(e.currentTarget);
      if (e.key === 'ArrowRight') tabs[(i + 1) % tabs.length].focus();
      if (e.key === 'ArrowLeft') tabs[(i + tabs.length - 1) % tabs.length].focus();
    });
    var panel = q(view, '#tab-panel');
    if (tab === 'card') cardTab(panel, node, card, questions);
    else if (tab === 'lab') labTab(panel, node, practices, route);
    else quizTab(panel, node, questions, st);
  }
  function tabBtn(key, label, active) {
    return '<button type="button" role="tab" data-tab="' + key + '" aria-selected="' + (key === active) + '" tabindex="' + (key === active ? 0 : -1) + '">' + esc(label) + '</button>';
  }
  function prevNext(node) {
    return '<nav class="prevnext" aria-label="이전·다음 토픽">' +
      (node.prev ? '<a class="btn btn-sm" href="#/topic/' + node.prev + '">← ' + esc(nodeTitle(node.prev)) + '</a>' : '<span></span>') +
      (node.next ? '<a class="btn btn-sm" href="#/topic/' + node.next + '" style="text-align:right">' + esc(nodeTitle(node.next)) + ' →</a>' : '<span></span>') + '</nav>';
  }

  function cardTab(panel, node, card, questions) {
    if (!card) {
      panel.innerHTML = '<p class="notice">요약 카드가 준비 중입니다.</p>' + (questions.length ? '<a class="btn btn-primary" href="#/topic/' + node.id + '/quiz">퀴즈로 →</a>' : '');
      return;
    }
    S.markCard(node.id); // 열람 기록 — 완료 조건의 하나
    var html = '<div class="summary-block">' + F.render(card.summary) + '</div>';
    if (card.concepts && card.concepts.length) html += '<h3>핵심 개념</h3><ul>' + card.concepts.map(function (c) { return '<li>' + F.inline(c) + '</li>'; }).join('') + '</ul>';
    if (card.terms && card.terms.length) html += '<h3>반드시 알아야 할 용어</h3>' + termChips(card.terms);
    if (card.patterns && card.patterns.length) {
      html += '<h3>핵심 코드 패턴 <span class="muted small">' + card.patterns.length + '개</span></h3>';
      card.patterns.forEach(function (pt, i) {
        html += '<details class="pattern"' + (i === 0 ? ' open' : '') + '><summary>' + (i + 1) + '. ' + F.inline(pt.title) + '</summary>' +
          F.codeBlock(pt.code, pt.lang) + (pt.note ? '<div class="small">' + F.render(pt.note) + '</div>' : '') + '</details>';
      });
    }
    if (card.pitfalls && card.pitfalls.length) html += '<h3>시험 함정</h3><ul class="pitfalls">' + card.pitfalls.map(function (c) { return '<li>' + F.inline(c) + '</li>'; }).join('') + '</ul>';
    html += '<div class="btn-group" style="margin-top:1rem">' + (questions.length ? '<a class="btn btn-primary" href="#/topic/' + node.id + '/quiz">퀴즈 시작 →</a>' : '<span class="muted small">퀴즈 준비 중</span>') + '</div>';
    panel.innerHTML = html;
  }

  function quizTab(panel, node, questions, st) {
    if (!questions.length) { panel.innerHTML = '<p class="notice">이 노드의 문제가 준비 중입니다.</p>'; return; }
    var p = S.get();
    var wrong = questions.filter(function (q0) { var r = p.quiz[q0.id]; return r && r.last === false; }).length;
    var html = '<section class="card"><div class="row between"><div><strong>' + questions.length + '문제</strong> · 시도 ' + st.attempted + ' · 오답 ' + wrong +
      (st.attempted ? ' · 최근 정답률 ' + Math.round(st.rate * 100) + '%' : '') + '</div></div>' +
      bar(st.total ? st.lastCorrect / st.total : 0, st.status === 'done' ? 'ok' : '') +
      '<p class="muted small" style="margin:.5rem 0 .75rem">미시도 → 오답 → 나머지 순으로 전부 출제됩니다. 채점 즉시 진도가 저장되므로 중간에 그만두어도 됩니다.</p>' +
      '<div class="btn-group"><button type="button" class="btn btn-primary" id="quiz-start">퀴즈 시작</button>' +
      (wrong ? '<button type="button" class="btn" id="quiz-wrong">오답만 다시 (' + wrong + ')</button>' : '') + '</div></section>';
    if (!st.cardRead && node.type !== 'check') html += '<p class="notice notice-info">완료 판정에는 요약 카드 열람이 필요합니다. <a href="#/topic/' + node.id + '/card">요약 보기</a></p>';
    panel.innerHTML = html;
    var view = panel.closest('.view');
    q(panel, '#quiz-start').addEventListener('click', function () {
      startQuizSession(view, { questions: L.orderForSession(questions, S.get().quiz), node: node, source: 'topic', backHash: '#/topic/' + node.id + '/quiz' });
    });
    var wb = q(panel, '#quiz-wrong');
    if (wb) wb.addEventListener('click', function () {
      var ws = questions.filter(function (q0) { var r = S.get().quiz[q0.id]; return r && r.last === false; });
      startQuizSession(view, { questions: L.shuffle(ws), node: node, source: 'topic', backHash: '#/topic/' + node.id + '/quiz' });
    });
  }

  /* ════════════════════════════════════════════════════════
     퀴즈 세션 (토픽 퀴즈 · 오답 다시 풀기 · 복습 공용)
     opts: { questions, node?, source, backHash, title? }
     ════════════════════════════════════════════════════════ */
  var session = null; // 현재 진행 중인 세션 (라우트가 바뀌면 app 이 endSession 을 부른다)

  function startQuizSession(view, opts) {
    var before = opts.node ? L.nodeStatus(opts.node, DS2.questionsOf(opts.node.id), DS2.practicesOf(opts.node.id), S.get(), !!DS2.card(opts.node.id)).status : null;
    session = { qs: opts.questions, idx: 0, results: [], opts: opts, before: before, view: view, selected: null, revealed: false };
    app().setSession(true, { progress: '1/' + session.qs.length, onQuit: quitSession });
    renderQuestion();
  }
  function quitSession() {
    if (!session) return;
    if (session.results.length) finishSession();
    else { var back = session.opts.backHash; endSession(); R.go(back); }
  }
  function endSession() {
    session = null;
    app().setSession(false);
  }

  function recordBadge(rec) {
    if (!rec) return '<span class="tag">처음 푸는 문제</span>';
    return '<span class="tag">상자 ' + rec.box + ' · ' + rec.correct + '회 정답' + (rec.wrong ? ' · ' + rec.wrong + '회 오답' : '') + '</span>';
  }
  function questionMeta(q0, rec) {
    var n = cur.byId[q0.node];
    return '<div class="quiz-meta"><span class="tag">' + esc(partLetter(q0.node) + ' ' + (n ? n.title : q0.node)) + '</span>' +
      '<span class="tag">' + (TYPE[q0.type] || q0.type) + ' · ' + (KIND[q0.kind] || q0.kind || '') + '</span>' +
      '<span class="dots" aria-label="난이도 ' + q0.difficulty + '">' + DOTS[q0.difficulty] + '</span>' + recordBadge(rec) + '</div>';
  }
  function choicesHtml(q0) {
    if (q0.type === 'mcq') {
      return '<div class="choices" role="radiogroup" aria-label="보기">' + q0.choices.map(function (c, i) {
        return '<button type="button" class="choice" role="radio" aria-checked="false" data-i="' + i + '"><span class="key" aria-hidden="true">' + (i + 1) + '</span><span class="txt">' + F.inline(c) + '</span><span class="mark" aria-hidden="true"></span></button>';
      }).join('') + '</div>';
    }
    if (q0.type === 'ox') {
      return '<div class="choices ox" role="radiogroup" aria-label="O 또는 X">' +
        '<button type="button" class="choice" role="radio" aria-checked="false" data-i="o"><span class="txt">O</span><span class="mark" aria-hidden="true"></span></button>' +
        '<button type="button" class="choice" role="radio" aria-checked="false" data-i="x"><span class="txt">X</span><span class="mark" aria-hidden="true"></span></button></div>';
    }
    return '<div class="short-input"><input type="text" id="short-answer" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="정답 입력" placeholder="한 단어로 입력 (예: transform)"></div>';
  }
  function questionBody(q0) {
    return '<div class="quiz-prompt">' + F.render(q0.prompt) + '</div>' + (q0.code ? F.codeBlock(q0.code, q0.lang || 'text') : '');
  }

  function renderQuestion() {
    var s = session;
    var q0 = s.qs[s.idx];
    var rec = S.get().quiz[q0.id];
    s.selected = null; s.revealed = false;
    app().setSession(true, { progress: (s.idx + 1) + '/' + s.qs.length, onQuit: quitSession });
    var html = '<div class="quiz" id="quiz">' + questionMeta(q0, rec) + questionBody(q0) + choicesHtml(q0) +
      '<div class="quiz-actions"><button type="button" class="btn btn-primary" id="btn-check" disabled>정답 확인</button></div>' +
      '<div id="quiz-result"></div></div>';
    s.view.innerHTML = html;
    var box = q(s.view, '#quiz');
    on(box, '.choice', 'click', function (e) { select(e.currentTarget.getAttribute('data-i')); });
    var input = q(box, '#short-answer');
    if (input) {
      input.addEventListener('input', function () { s.selected = input.value; q(box, '#btn-check').disabled = !input.value.trim(); });
      if (!app().embedded) input.focus();
    }
    q(box, '#btn-check').addEventListener('click', check);
    box.addEventListener('keydown', keyHandler);
    if (!input && !app().embedded) { var first = q(box, '.choice'); if (first) first.focus(); }
  }
  function select(v) {
    var s = session; if (!s || s.revealed) return;
    s.selected = v;
    qa(s.view, '.choice').forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-i') === String(v))); });
    q(s.view, '#btn-check').disabled = false;
  }
  function keyHandler(e) {
    var s = session; if (!s) return;
    var inInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    var q0 = s.qs[s.idx];
    if (e.key === 'Enter') {
      if (e.target && e.target.classList && e.target.classList.contains('term')) return;
      if (s.revealed) { var nb = q(s.view, '#btn-next'); if (nb && document.activeElement !== nb) { e.preventDefault(); nb.click(); } return; }
      if (inInput || (e.target && e.target.classList && e.target.classList.contains('choice'))) { e.preventDefault(); if (s.selected !== null && s.selected !== '') check(); }
      return;
    }
    if (inInput || s.revealed) return;
    if (q0.type === 'mcq' && /^[1-5]$/.test(e.key) && Number(e.key) <= q0.choices.length) { e.preventDefault(); select(Number(e.key) - 1); }
    if (q0.type === 'ox') {
      if (e.key === 'o' || e.key === 'O' || e.key === '1') { e.preventDefault(); select('o'); }
      if (e.key === 'x' || e.key === 'X' || e.key === '2') { e.preventDefault(); select('x'); }
    }
  }
  function check() {
    var s = session; if (!s || s.revealed) return;
    var q0 = s.qs[s.idx];
    var input = q0.type === 'mcq' ? Number(s.selected) : q0.type === 'ox' ? s.selected : s.selected;
    if (q0.type === 'short' && !String(input || '').trim()) return;
    var r = G.gradeQuestion(q0, input);
    var rec = S.recordQuiz(q0.id, r.correct, s.opts.source);
    s.results.push({ q: q0, correct: r.correct, given: input });
    s.revealed = true;
    // 보기 상태 표시
    qa(s.view, '.choice').forEach(function (b) {
      var key = b.getAttribute('data-i');
      var isAnswer = q0.type === 'mcq' ? Number(key) === q0.answer : (key === 'o') === q0.answer;
      var mine = String(key) === String(s.selected);
      b.disabled = true;
      if (isAnswer) { b.setAttribute('data-state', 'correct'); q(b, '.mark').textContent = '✔'; b.setAttribute('aria-label', '정답: ' + b.textContent.trim()); }
      else if (mine) { b.setAttribute('data-state', 'wrong'); q(b, '.mark').textContent = '✘'; b.setAttribute('aria-label', '내가 고른 오답: ' + b.textContent.trim()); }
    });
    var si = q(s.view, '#short-answer'); if (si) si.disabled = true;
    q(s.view, '#btn-check').hidden = true;
    var last = s.idx === s.qs.length - 1;
    var ex = text(q0.explanation);
    var long = ex.split('\n').length > 8 || ex.length > 480;
    var collapse = r.correct && long; // 오답은 읽어야 하는 순간이므로 접지 않는다
    var html = '<p class="result-line ' + (r.correct ? 'ok' : 'bad') + '">' + (r.correct ? '✔ 정답입니다' : '✘ 오답입니다. 정답은 ' + esc(r.answerText)) +
      (q0.type === 'short' && !r.correct ? ' <span class="muted small">(입력: ' + esc(String(input)) + ')</span>' : '') + '</p>' +
      '<div class="explanation' + (collapse ? ' collapsed' : '') + '" id="explanation">' + F.render(q0.explanation) + '</div>' +
      (collapse ? '<button type="button" class="btn-link explanation-more" id="btn-more">해설 더 보기</button>' : '') +
      termChips(q0.terms) +
      '<p class="small muted">상자 ' + rec.box + (rec.due ? ' · 다음 복습 ' + rec.due : ' · 졸업') + '</p>' +
      '<div class="quiz-actions"><button type="button" class="btn btn-primary" id="btn-next">' + (last ? '결과 보기' : '다음 →') + '</button></div>';
    q(s.view, '#quiz-result').innerHTML = html;
    app().announce(r.correct ? '정답입니다' : '오답입니다. 정답은 ' + r.answerText);
    var more = q(s.view, '#btn-more');
    if (more) more.addEventListener('click', function () { q(s.view, '#explanation').classList.remove('collapsed'); more.remove(); });
    var nb = q(s.view, '#btn-next');
    nb.addEventListener('click', next);
    nb.focus();
  }
  function next() {
    var s = session; if (!s) return;
    if (s.idx < s.qs.length - 1) { s.idx++; renderQuestion(); try { root.scrollTo(0, 0); } catch (e) { /* */ } }
    else finishSession();
  }
  function finishSession() {
    var s = session; if (!s) return;
    var total = s.results.length, correct = s.results.filter(function (r) { return r.correct; }).length;
    var wrongs = s.results.filter(function (r) { return !r.correct; });
    var node = s.opts.node;
    var after = node ? L.nodeStatus(node, DS2.questionsOf(node.id), DS2.practicesOf(node.id), S.get(), !!DS2.card(node.id)) : null;
    var html = '<section class="card session-done"><h2>세션 완료</h2><div class="score">' + pct(correct, total) + '%</div><p>' + correct + '/' + total + ' 정답' +
      (total < s.qs.length ? ' <span class="muted small">(' + s.qs.length + '문제 중 ' + total + '개 풀고 종료)</span>' : '') + '</p>';
    if (node && after) {
      var changed = s.before !== after.status;
      html += '<p class="small">' + esc(node.title) + ' — ' + statusDot(after.status) + (changed ? ' <span class="pill-ok tag">' + ({ none: '미학습', learning: '학습중', done: '완료' }[s.before] || '') + ' → ' + ({ none: '미학습', learning: '학습중', done: '완료' }[after.status]) + '</span>' : '') +
        (after.status !== 'done' && !after.cardRead && after.needCard ? ' <span class="muted">요약 카드를 열람하면 완료 판정이 가능합니다.</span>' : '') + '</p>';
    }
    html += '</section>';
    if (wrongs.length) {
      html += '<section class="card"><div class="row between"><h3 style="margin:0">틀린 문제 ' + wrongs.length + '</h3><button type="button" class="btn btn-sm" id="btn-retry">바로 다시 풀기</button></div><ul class="wrong-list">' +
        wrongs.map(function (r) { return '<li><button type="button" data-read="' + esc(r.q.id) + '"><span class="q">' + esc(F.plain(r.q.prompt, 80)) + '</span><span class="tag">' + esc(r.q.id) + '</span></button></li>'; }).join('') + '</ul></section>';
    }
    html += '<div class="btn-group">';
    if (s.opts.source === 'topic' && node) {
      if (node.next) html += '<a class="btn btn-primary" href="#/topic/' + node.next + '">다음 토픽: ' + esc(nodeTitle(node.next)) + '</a>';
      if (node.type !== 'check' && DS2.practicesOf(node.id).length) html += '<a class="btn" href="#/topic/' + node.id + '/lab">실습으로</a>';
      html += '<a class="btn" href="#/topic/' + node.id + '/quiz">퀴즈 탭으로</a>';
    } else {
      html += '<a class="btn btn-primary" href="#/">홈</a><a class="btn" href="' + esc(s.opts.backHash) + '">돌아가기</a>';
    }
    html += '</div>';
    var view = s.view, back = s.opts.backHash;
    endSession();
    app().setTitle(node ? node.title : (s.opts.title || '세션 완료'));
    view.innerHTML = html;
    var retry = q(view, '#btn-retry');
    if (retry) retry.addEventListener('click', function () {
      startQuizSession(view, { questions: wrongs.map(function (r) { return r.q; }), node: node, source: s.opts.source, backHash: back, title: s.opts.title });
    });
    on(view, '[data-read]', 'click', function (e) { readQuestion(view, e.currentTarget.getAttribute('data-read'), back); });
    try { root.scrollTo(0, 0); } catch (e) { /* */ }
  }

  /** 읽기 모드: 문제·정답·해설만 (풀지 않음) */
  function readQuestion(view, qid, backHash) {
    var q0 = DS2.question(qid);
    if (!q0) return;
    var rec = S.get().quiz[qid];
    var r = G.gradeQuestion(q0, null);
    var html = '<section class="card">' + questionMeta(q0, rec) + questionBody(q0);
    if (q0.type === 'mcq') html += '<ol class="choices" style="list-style:none;padding:0">' + q0.choices.map(function (c, i) {
      return '<li class="choice"' + (i === q0.answer ? ' data-state="correct"' : '') + '><span class="key" aria-hidden="true">' + (i + 1) + '</span><span class="txt">' + F.inline(c) + '</span><span class="mark">' + (i === q0.answer ? '✔' : '') + '</span></li>';
    }).join('') + '</ol>';
    html += '<p class="result-line ok">정답: ' + esc(r.answerText) + '</p><div class="explanation">' + F.render(q0.explanation) + '</div>' + termChips(q0.terms) + '</section>' +
      '<div class="btn-group"><button type="button" class="btn btn-primary" id="btn-solve">이 문제 다시 풀기</button><a class="btn" href="' + esc(backHash) + '">목록으로</a>' +
      '<a class="btn" href="#/topic/' + q0.node + '">' + esc(nodeTitle(q0.node)) + '</a></div>';
    app().setTitle('문제 읽기 — ' + esc(q0.id));
    view.innerHTML = html;
    q(view, '#btn-solve').addEventListener('click', function () {
      startQuizSession(view, { questions: [q0], node: null, source: 'wrong', backHash: backHash, title: '다시 풀기' });
    });
    try { root.scrollTo(0, 0); } catch (e) { /* */ }
  }

  /* ════════════════════════════════════════════════════════
     실습 탭
     ════════════════════════════════════════════════════════ */
  function labTab(panel, node, practices, route) {
    if (!practices.length) { panel.innerHTML = '<p class="notice">이 노드의 실습 과제가 준비 중입니다.</p>'; return; }
    var p = S.get();
    var sel = (route.query.match(/(?:^|&)p=([^&]+)/) || [])[1];
    var cur0 = practices.filter(function (x) { return x.id === sel; })[0];
    if (!cur0) {
      var html = '<ul class="lab-list">' + practices.map(function (pr, i) {
        var r = p.practice[pr.id];
        var state = r && r.solved ? '<span class="tag pill-ok">정답</span>' : r && r.gaveUp ? '<span class="tag pill-warn">답 봄</span>' : r ? '<span class="tag">' + r.attempts + '회 시도</span>' : '<span class="tag">미완</span>';
        return '<li><a href="#/topic/' + node.id + '/lab?p=' + esc(pr.id) + '"><span class="dots" aria-label="난이도 ' + pr.difficulty + '">' + DOTS[pr.difficulty] + '</span><span class="grow"><div class="title">실습 ' + (i + 1) + '. ' + F.inline(pr.title) + '</div><div class="small muted">' + esc(F.plain(pr.task, 70)) + '</div></span>' + state + '</a></li>';
      }).join('') + '</ul>' + notebookTools(node) +
        '<p class="muted small" style="margin-top:.75rem">앱은 Python 을 실행하지 않습니다. 셀을 복사해 개인 Jupyter 에서 실행하고 값만 입력하세요.</p>';
      panel.innerHTML = html;
      bindNotebook(panel, node);
      return;
    }
    labDetail(panel, node, practices, cur0);
  }
  function notebookTools(node) {
    var mobile = app().coarse;
    var ch = node.chapter;
    return '<div class="lab-tools"><label class="check small"><input type="checkbox" id="nb-sol"> 모범 답안 포함</label>' +
      '<button type="button" class="btn btn-sm" data-nb="' + node.id + '"' + (mobile ? ' title="PC에서 내려받기 권장"' : '') + '>이 토픽 노트북(.ipynb) 내려받기</button>' +
      (ch && ch !== node.id ? '<button type="button" class="btn btn-sm" data-nb="' + ch + '">챕터 전체</button>' : '') +
      (mobile ? '<span class="muted small">모바일에서는 셀 복사를 권장합니다. 노트북은 PC에서 내려받으세요.</span>' : '') + '</div>';
  }
  function bindNotebook(panel) {
    on(panel, '[data-nb]', 'click', function (e) {
      var scope = e.currentTarget.getAttribute('data-nb');
      var inc = !!(q(panel, '#nb-sol') && q(panel, '#nb-sol').checked);
      var json = E.ipynb.build(scope, { includeSolution: inc });
      if (!json) { app().toast('이 범위에는 실습이 없습니다'); return; }
      if (E.ipynb.download(E.ipynb.filename(scope), json)) app().toast(E.ipynb.filename(scope) + ' 내려받기');
      else app().toast('이 브라우저에서는 내려받기를 지원하지 않습니다');
    });
  }
  function labDetail(panel, node, practices, pr) {
    var i = practices.indexOf(pr);
    var rec = S.get().practice[pr.id] || { solved: false, attempts: 0, gaveUp: false };
    var revealed = rec.solved || rec.gaveUp;
    var isNum = pr.answer.type === 'number' || pr.answer.type === 'int';
    var hints = Array.isArray(pr.hint) ? pr.hint : (pr.hint ? [pr.hint] : []);
    var html = '<div class="quiz-meta"><span class="tag">실습 ' + (i + 1) + '/' + practices.length + '</span><span class="dots" aria-label="난이도 ' + pr.difficulty + '">' + DOTS[pr.difficulty] + '</span>' +
      (rec.solved ? '<span class="tag pill-ok">정답</span>' : rec.gaveUp ? '<span class="tag pill-warn">답을 본 과제</span>' : rec.attempts ? '<span class="tag">' + rec.attempts + '회 시도</span>' : '') +
      (pr.verified && pr.verified.by !== 'python' ? '<span class="tag pill-warn" title="정답이 Python 으로 재검증되지 않았습니다">미검증</span>' : '') + '</div>' +
      '<h3>' + F.inline(pr.title) + '</h3><div>' + F.render(pr.task) + '</div>' +
      F.codeBlock(pr.setup, 'python', { label: '데이터 준비 셀' }) +
      (hints.length ? '<details' + (S.getSettings().showHintByDefault ? ' open' : '') + '><summary>힌트 보기</summary>' + hints.map(function (h) { return F.render(h); }).join('') + '</details>' : '') +
      '<div class="lab-answer"><input type="text" id="lab-input" inputmode="' + (isNum ? 'decimal' : 'text') + '" autocomplete="off" aria-label="답 입력" placeholder="' + (isNum ? (pr.answer.type === 'number' ? '소수 ' + (pr.answer.decimals || 0) + '자리까지' : '정수') : '문자열') + '"' + (rec.solved ? ' disabled' : '') + '>' +
      '<button type="button" class="btn btn-primary" id="lab-check"' + (rec.solved ? ' disabled' : '') + '>확인</button></div>' +
      '<div id="lab-result" role="status">' + (rec.solved ? '<p class="result-line ok">✔ 정답 처리된 과제입니다</p>' : '') + '</div>' +
      (!revealed ? '<button type="button" class="btn-link" id="lab-giveup">포기하고 답 보기</button>' : '') +
      '<div id="lab-solution"' + (revealed ? '' : ' hidden') + '><details open><summary>모범 답안 코드' + (!rec.solved ? ' · 정답 ' + esc(G.expectedText(pr.answer)) : '') + '</summary>' +
      F.codeBlock(pr.solution, 'python') + '<div>' + F.render(pr.explanation) + '</div></details>' + termChips(pr.terms) + '</div>' +
      '<div class="prevnext">' + (i > 0 ? '<a class="btn btn-sm" href="#/topic/' + node.id + '/lab?p=' + esc(practices[i - 1].id) + '">← 실습 ' + i + '</a>' : '<a class="btn btn-sm" href="#/topic/' + node.id + '/lab">목록</a>') +
      (i < practices.length - 1 ? '<a class="btn btn-sm" href="#/topic/' + node.id + '/lab?p=' + esc(practices[i + 1].id) + '">실습 ' + (i + 2) + ' →</a>' : '<a class="btn btn-sm" href="#/topic/' + node.id + '/lab">목록</a>') + '</div>' +
      notebookTools(node);
    panel.innerHTML = html;
    bindNotebook(panel, node);
    var input = q(panel, '#lab-input'), result = q(panel, '#lab-result');
    function doCheck() {
      var g = G.gradePractice(pr.answer, input.value);
      if (g.status === 'invalid') { result.innerHTML = '<p class="result-line bad">' + esc(g.message) + '</p>'; return; }
      var r2 = S.recordPractice(pr.id, g.status === 'correct', false);
      if (g.status === 'correct') {
        result.innerHTML = '<p class="result-line ok">✔ 정답입니다' + (r2.gaveUp ? ' <span class="muted small">(답을 본 과제)</span>' : '') + '</p>';
        input.disabled = true; q(panel, '#lab-check').disabled = true;
        var gu = q(panel, '#lab-giveup'); if (gu) gu.remove();
        q(panel, '#lab-solution').hidden = false;
        q(panel, '#lab-solution summary').textContent = '모범 답안 코드';
      } else {
        result.innerHTML = '<p class="result-line bad">✘ ' + esc(g.shown) + '는 정답이 아닙니다 <span class="muted small">(입력값 ' + esc(input.value.trim()) + ' → ' + esc(g.shown) + '으로 비교했습니다 · ' + r2.attempts + '회 시도)</span></p>';
      }
    }
    q(panel, '#lab-check').addEventListener('click', doCheck);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doCheck(); } });
    var gu = q(panel, '#lab-giveup');
    if (gu) gu.addEventListener('click', function () {
      S.recordPractice(pr.id, false, true);
      q(panel, '#lab-solution').hidden = false;
      gu.remove();
      result.innerHTML = '<p class="result-line bad">답을 본 과제로 기록되었습니다. 값을 직접 구해 입력하면 정답 처리됩니다.</p>';
    });
  }

  /* ════════════════════════════════════════════════════════
     오답 노트
     ════════════════════════════════════════════════════════ */
  function wrong(view, route) {
    var readId = (route.query.match(/(?:^|&)q=([^&]+)/) || [])[1];
    if (readId && DS2.question(readId)) return readQuestion(view, readId, '#/wrong');
    var p = S.get();
    var ids = L.wrongIds(p.quiz).filter(function (id) { return DS2.question(id); });
    if (!ids.length) { view.innerHTML = '<section class="card"><h2>오답 노트</h2><p class="muted">마지막 시도가 오답인 문제가 없습니다. 퀴즈를 풀면 자동으로 쌓이고, 다시 맞히면 자동으로 빠집니다.</p><a class="btn" href="#/tree">트리로</a></section>'; return; }
    var groups = {};
    ids.forEach(function (id) { var n = DS2.question(id).node; (groups[n] || (groups[n] = [])).push(id); });
    var nodeIds = Object.keys(groups).sort(function (a, b) {
      var wa = groups[a].reduce(function (s, id) { return s + (p.quiz[id].wrong || 0); }, 0), wb = groups[b].reduce(function (s, id) { return s + (p.quiz[id].wrong || 0); }, 0);
      return wb - wa || cur.byId[a].order - cur.byId[b].order;
    });
    var html = '<div class="row between" style="margin-bottom:.75rem"><h2 style="margin:0">오답 노트 <span class="badge">' + ids.length + '</span></h2><button type="button" class="btn btn-primary btn-sm" id="wrong-all">전부 다시 풀기</button></div>';
    nodeIds.forEach(function (n) {
      html += '<section class="card"><div class="row between"><h3 style="margin:0">' + esc(nodeTitle(n)) + ' <span class="muted small">' + groups[n].length + '</span></h3><button type="button" class="btn btn-sm" data-node="' + n + '">다시 풀기</button></div><ul class="wrong-list">' +
        groups[n].map(function (id) { var q0 = DS2.question(id); return '<li><a href="#/wrong?q=' + esc(id) + '"><span class="q">' + esc(F.plain(q0.prompt, 80)) + '</span><span class="tag">✘ ' + (p.quiz[id].wrong || 0) + '</span></a></li>'; }).join('') + '</ul></section>';
    });
    html += '<p class="muted small">탭하면 문제와 해설을 읽기 모드로 봅니다. 정렬: 틀린 횟수 많은 순.</p>';
    view.innerHTML = html;
    q(view, '#wrong-all').addEventListener('click', function () {
      startQuizSession(view, { questions: ids.map(DS2.question), node: null, source: 'wrong', backHash: '#/wrong', title: '오답 다시 풀기' });
    });
    on(view, '[data-node]', 'click', function (e) {
      var n = e.currentTarget.getAttribute('data-node');
      startQuizSession(view, { questions: groups[n].map(DS2.question), node: cur.byId[n], source: 'wrong', backHash: '#/wrong', title: '오답 다시 풀기' });
    });
  }

  /* ════════════════════════════════════════════════════════
     오늘 복습
     ════════════════════════════════════════════════════════ */
  function review(view) {
    var p = S.get();
    var ids = L.dueIds(p.quiz).filter(function (id) { return DS2.question(id); });
    var byNode = {};
    ids.forEach(function (id) { var n = DS2.question(id).node; (byNode[n] || (byNode[n] = [])).push(id); });
    var nodes = Object.keys(byNode).sort(function (a, b) { return cur.byId[a].order - cur.byId[b].order; });
    var boxes = [0, 0, 0, 0, 0];
    Object.keys(p.quiz).forEach(function (id) { if (DS2.question(id)) boxes[p.quiz[id].box] = (boxes[p.quiz[id].box] || 0) + 1; });
    var html = '<section class="card"><h2>오늘 복습 <span class="badge">' + ids.length + '</span></h2>';
    if (!ids.length) html += '<p class="muted">오늘 복습할 문제가 없습니다. 라이트너 상자 1·2·3 의 문제가 기한(1·3·7일)이 되면 여기에 쌓입니다.</p>';
    else html += '<p class="small muted">기한이 오래된 것부터 출제됩니다. 정답이면 다음 상자로, 오답이면 상자 1로 돌아갑니다.</p>' +
      '<div class="row"><button type="button" class="btn btn-primary" id="review-start">전체 시작 (' + ids.length + ')</button>' +
      (nodes.length > 1 ? '<select id="review-node" aria-label="노드별로 나눠 풀기" style="flex:1;min-width:10rem"><option value="">노드별로 나눠 풀기…</option>' + nodes.map(function (n) { return '<option value="' + n + '">' + esc(nodeTitle(n)) + ' (' + byNode[n].length + ')</option>'; }).join('') + '</select>' : '') + '</div>';
    html += '</section>';
    html += '<section class="card"><h3>상자 분포</h3><div class="node-bars">' + [1, 2, 3, 4].map(function (b) {
      var total = boxes.slice(1).reduce(function (s, x) { return s + x; }, 0);
      return '<div class="row"><span class="name">상자 ' + b + ' <span class="muted small">' + ({ 1: '1일', 2: '3일', 3: '7일', 4: '졸업' }[b]) + '</span></span>' + bar(total ? boxes[b] / total : 0) + '<span class="pct">' + boxes[b] + '</span></div>';
    }).join('') + '</div></section>';
    view.innerHTML = html;
    var start = q(view, '#review-start');
    if (start) start.addEventListener('click', function () {
      startQuizSession(view, { questions: ids.map(DS2.question), node: null, source: 'review', backHash: '#/review', title: '오늘 복습' });
    });
    var sel = q(view, '#review-node');
    if (sel) sel.addEventListener('change', function () {
      if (!sel.value) return;
      startQuizSession(view, { questions: byNode[sel.value].map(DS2.question), node: cur.byId[sel.value], source: 'review', backHash: '#/review', title: '오늘 복습' });
    });
  }

  /* ════════════════════════════════════════════════════════
     모의고사
     ════════════════════════════════════════════════════════ */
  var EXAM_KEY = 'apps.ds-level2.exam.run';
  function loadRun() { try { return JSON.parse(S.session.get(EXAM_KEY) || 'null'); } catch (e) { return null; } }
  function saveRun(run) { S.session.set(EXAM_KEY, JSON.stringify(run)); }

  function exam(view) {
    var p = S.get();
    var run = loadRun();
    var settings = S.getSettings();
    var html = '';
    if (run && run.exam) html += '<p class="notice notice-info row between">진행 중인 모의고사가 있습니다 (' + Object.keys(run.answers).length + '/' + run.exam.n + ' 답함). <a class="btn btn-sm" href="#/exam/run">이어서</a></p>';
    html += '<section class="card"><h2>모의고사 설정</h2>' +
      '<div class="field"><label>문제 수</label><div class="seg" role="group" aria-label="문제 수"><button type="button" data-n="20" aria-pressed="true">20</button><button type="button" data-n="40" aria-pressed="false">40</button></div></div>' +
      '<div class="field"><label>범위</label><div class="seg" role="group" aria-label="범위"><button type="button" data-scope="all" aria-pressed="true">전체</button><button type="button" data-scope="a" aria-pressed="false">파트 A</button><button type="button" data-scope="b" aria-pressed="false">파트 B</button><button type="button" data-scope="custom" aria-pressed="false">챕터 선택</button></div></div>' +
      '<div class="scope-list" id="scope-list" hidden>' + cur.chapters.map(function (ch) {
        var n = DS2.allQuestions().filter(function (q0) { return cur.byId[q0.node].chapter === ch; }).length;
        return '<label class="check"><input type="checkbox" value="' + ch + '"' + (n ? '' : ' disabled') + '> ' + esc(nodeTitle(ch)) + ' <span class="muted small">' + n + '문제</span></label>';
      }).join('') + '</div>' +
      '<label class="check"><input type="checkbox" id="exam-timer"' + (settings.examTimer ? ' checked' : '') + '> 제한 시간 (문제당 60초)</label>' +
      '<p class="muted small">범위 안 노드를 돌며 노드마다 고르게 뽑습니다(졸업한 문제 포함). 채점은 제출 시 한 번에 하고, 결과는 라이트너 상자에도 반영됩니다.</p>' +
      '<button type="button" class="btn btn-primary btn-block" id="exam-start">모의고사 시작</button><p class="small notice-bad" id="exam-err" hidden></p></section>';
    if (p.exams.length) {
      html += '<section class="card"><h3>최근 결과 <span class="muted small">최근 ' + p.exams.length + '회</span></h3><ul class="wrong-list">' + p.exams.map(function (x) {
        return '<li><a href="#/exam/result/' + esc(x.id) + '"><span class="q"><strong>' + x.score + '/' + x.n + '</strong> <span class="muted small">' + esc(fmtDate(x.at)) + ' · ' + esc(x.scope && x.scope.length ? x.scope.map(nodeTitle).join(', ') : '전체') + '</span></span><span class="tag">리포트</span></a></li>';
      }).join('') + '</ul></section>';
    }
    view.innerHTML = html;
    var n = 20, scope = 'all';
    on(view, '[data-n]', 'click', function (e) { n = Number(e.currentTarget.getAttribute('data-n')); qa(view, '[data-n]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === e.currentTarget)); }); });
    on(view, '[data-scope]', 'click', function (e) { scope = e.currentTarget.getAttribute('data-scope'); qa(view, '[data-scope]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === e.currentTarget)); }); q(view, '#scope-list').hidden = scope !== 'custom'; });
    q(view, '#exam-start').addEventListener('click', function () {
      var sc = scope === 'all' ? [] : scope === 'custom' ? qa(view, '#scope-list input:checked').map(function (c) { return c.value; }) : [scope];
      if (scope === 'custom' && !sc.length) { var err = q(view, '#exam-err'); err.hidden = false; err.textContent = '챕터를 하나 이상 선택하세요.'; return; }
      beginExam(sc, n, undefined, q(view, '#exam-timer').checked);
    });
  }
  function beginExam(scope, n, seed, timer) {
    var ex = X.buildExam(scope, n, seed, cur, DS2.questionsOf);
    if (!ex.questionIds.length) { app().toast('선택한 범위에 문제가 없습니다'); return; }
    if (ex.questionIds.length < n) app().toast('범위 안 문제가 ' + ex.questionIds.length + '개뿐이라 그만큼만 출제합니다');
    saveRun({ exam: ex, answers: {}, idx: 0, startedAt: Date.now(), limitSec: timer ? ex.questionIds.length * X.secondsPerQuestion() : 0, warned: {} });
    R.go('#/exam/run');
  }

  var examTimerId = null;
  function stopExamTimer() { if (examTimerId) { clearInterval(examTimerId); examTimerId = null; } }

  function examRun(view) {
    var run = loadRun();
    if (!run || !run.exam) { app().toast('진행 중인 모의고사가 없습니다'); R.replace('#/exam'); return; }
    var ex = run.exam;
    var total = ex.questionIds.length;
    app().setSession(true, { progress: '', onQuit: function () { submit(true); } });
    stopExamTimer();

    function tick() {
      if (!run.limitSec) { app().setSession(true, { progress: (run.idx + 1) + '/' + total, onQuit: function () { submit(true); } }); return; }
      var rem = X.remaining(run.startedAt, run.limitSec, Date.now());
      app().setSession(true, { progress: (run.idx + 1) + '/' + total + ' · ' + X.fmtClock(rem), urgent: rem <= 60, onQuit: function () { submit(true); } });
      if (rem <= 300 && !run.warned.m5) { run.warned.m5 = true; saveRun(run); app().announce('5분 남았습니다'); }
      if (rem <= 60 && !run.warned.m1) { run.warned.m1 = true; saveRun(run); app().announce('1분 남았습니다'); app().toast('1분 남았습니다'); }
      if (rem <= 0) { submit(false, true); }
    }
    function render() {
      var qid = ex.questionIds[run.idx];
      var q0 = DS2.question(qid);
      if (!q0) { run.idx = Math.min(run.idx + 1, total - 1); return render(); }
      var given = run.answers[qid];
      var html = '<div class="quiz" id="exam-q">' +
        '<div class="quiz-meta"><span class="tag">문제 ' + (run.idx + 1) + '/' + total + '</span><span class="tag">' + esc(partLetter(q0.node) + ' ' + nodeTitle(q0.node)) + '</span><span class="dots">' + DOTS[q0.difficulty] + '</span></div>' +
        questionBody(q0) + choicesHtml(q0) +
        '<div class="quiz-actions"><button type="button" class="btn" id="ex-prev"' + (run.idx === 0 ? ' disabled' : '') + '>← 이전</button>' +
        (run.idx < total - 1 ? '<button type="button" class="btn btn-primary" id="ex-next">다음 →</button>' : '<button type="button" class="btn btn-primary" id="ex-submit">제출</button>') + '</div>' +
        '<div class="exam-grid" aria-label="문제 번호">' + ex.questionIds.map(function (id, i) {
          return '<button type="button" data-goto="' + i + '" data-answered="' + (run.answers[id] !== undefined) + '"' + (i === run.idx ? ' aria-current="true"' : '') + ' aria-label="문제 ' + (i + 1) + (run.answers[id] !== undefined ? ' 답함' : '') + '">' + (i + 1) + '</button>';
        }).join('') + '</div>' +
        '<p class="small muted">답한 문제 ' + Object.keys(run.answers).length + '/' + total + ' · <button type="button" class="btn-link" id="ex-submit-early">지금 제출</button></p></div>';
      view.innerHTML = html;
      var box = q(view, '#exam-q');
      if (given !== undefined) {
        qa(box, '.choice').forEach(function (b) { var k = b.getAttribute('data-i'); b.setAttribute('aria-checked', String(k === String(given) || (q0.type === 'ox' && (given === true ? 'o' : 'x') === k))); });
        var si = q(box, '#short-answer'); if (si) si.value = given;
      }
      on(box, '.choice', 'click', function (e) {
        var k = e.currentTarget.getAttribute('data-i');
        run.answers[qid] = q0.type === 'mcq' ? Number(k) : (k === 'o');
        qa(box, '.choice').forEach(function (b) { b.setAttribute('aria-checked', String(b === e.currentTarget)); });
        saveRun(run);
        qa(box, '[data-goto]')[run.idx].setAttribute('data-answered', 'true');
      });
      var input = q(box, '#short-answer');
      if (input) input.addEventListener('input', function () { if (input.value.trim()) run.answers[qid] = input.value; else delete run.answers[qid]; saveRun(run); qa(box, '[data-goto]')[run.idx].setAttribute('data-answered', String(input.value.trim() !== '')); });
      box.addEventListener('keydown', function (e) {
        var inInput = e.target.tagName === 'INPUT';
        if (e.key === 'Enter' && !inInput) { e.preventDefault(); var nb = q(box, '#ex-next') || q(box, '#ex-submit'); nb.click(); return; }
        if (e.key === 'Enter' && inInput) { e.preventDefault(); var nb2 = q(box, '#ex-next') || q(box, '#ex-submit'); nb2.click(); return; }
        if (inInput) return;
        if (q0.type === 'mcq' && /^[1-5]$/.test(e.key) && Number(e.key) <= q0.choices.length) { e.preventDefault(); qa(box, '.choice')[Number(e.key) - 1].click(); }
        if (q0.type === 'ox' && /^[oOxX12]$/.test(e.key)) { e.preventDefault(); qa(box, '.choice')[/^[oO1]$/.test(e.key) ? 0 : 1].click(); }
      });
      var prev = q(box, '#ex-prev'); prev.addEventListener('click', function () { run.idx--; saveRun(run); render(); });
      var nx = q(box, '#ex-next'); if (nx) nx.addEventListener('click', function () { run.idx++; saveRun(run); render(); });
      on(box, '[data-goto]', 'click', function (e) { run.idx = Number(e.currentTarget.getAttribute('data-goto')); saveRun(run); render(); });
      var sb = q(box, '#ex-submit'); if (sb) sb.addEventListener('click', function () { submit(true); });
      q(box, '#ex-submit-early').addEventListener('click', function () { submit(true); });
      tick();
      try { root.scrollTo(0, 0); } catch (e) { /* */ }
    }
    var confirming = false;
    function submit(ask, timeUp) {
      var unanswered = total - Object.keys(run.answers).length;
      if (ask && !timeUp && unanswered > 0 && !confirming) {
        confirming = true;
        app().toast('답하지 않은 문제가 ' + unanswered + '개 있습니다. 다시 누르면 제출합니다');
        setTimeout(function () { confirming = false; }, 4000);
        return;
      }
      stopExamTimer();
      var graded = X.grade(ex, run.answers, DS2.question);
      graded.items.forEach(function (it) { if (it.answered) S.recordQuiz(it.qid, it.correct, 'exam'); });
      var result = { id: ex.id, at: new Date().toISOString(), scope: ex.scope, n: graded.total, seed: ex.seed, score: graded.score,
        byNode: graded.byNode, durationSec: Math.round((Date.now() - run.startedAt) / 1000), timeUp: !!timeUp, limitSec: run.limitSec,
        items: graded.items.map(function (it) { return { q: it.qid, g: it.given === undefined ? null : it.given, c: it.correct }; }) };
      S.addExam(result);
      S.session.remove(EXAM_KEY);
      app().setSession(false);
      if (timeUp) app().toast('시간이 종료되어 자동 제출되었습니다');
      R.replace('#/exam/result/' + result.id);
    }
    render();
    if (run.limitSec) examTimerId = setInterval(function () { if (!loadRun()) { stopExamTimer(); return; } tick(); }, 1000);
  }

  function examResult(view, route) {
    var p = S.get();
    var x = p.exams.filter(function (e) { return e.id === route.params.examId; })[0];
    if (!x) return app().notFound(route);
    var weak = X.weakestNodes(x.byNode || {});
    var html = '<section class="card session-done"><h2>모의고사 결과</h2><div class="score">' + x.score + '/' + x.n + ' <span class="muted" style="font-size:1rem">(' + pct(x.score, x.n) + '%)</span></div>' +
      '<p class="small muted">' + esc(fmtDate(x.at)) + ' · 소요 ' + X.fmtClock(x.durationSec || 0) + (x.timeUp ? ' · 시간 종료 자동 제출' : '') + ' · 범위 ' + esc(x.scope && x.scope.length ? x.scope.map(nodeTitle).join(', ') : '전체') + ' · seed ' + x.seed + '</p>' +
      '<div class="btn-group"><button type="button" class="btn" id="exam-again">같은 문제로 다시</button><a class="btn" href="#/exam">새 모의고사</a></div></section>';
    if (weak.length) {
      html += '<section class="card"><h3>노드별 정답률 <span class="muted small">약한 순</span></h3><div class="node-bars">' + weak.map(function (w) {
        return '<div class="row"><span class="name">' + esc(partLetter(w.node) + ' ' + nodeTitle(w.node)) + '</span>' + bar(w.rate, w.rate >= 0.8 ? 'ok' : w.rate < 0.5 ? 'bad' : '') + '<span class="pct">' + w.correct + '/' + w.total + '</span></div>';
      }).join('') + '</div></section>';
      var top = weak.filter(function (w) { return w.rate < 1; }).slice(0, 3);
      if (top.length) html += '<section class="card"><h3>약점 상위 ' + top.length + '</h3>' + top.map(function (w) {
        var n = cur.byId[w.node];
        return '<div class="row between" style="padding:.4rem 0;border-bottom:1px solid var(--border)"><span>' + esc(nodeTitle(w.node)) + ' <span class="muted small">' + pct(w.correct, w.total) + '%</span></span><span class="row">' +
          (n.type !== 'check' ? '<a class="btn btn-sm" href="#/topic/' + w.node + '/card">요약 카드</a>' : '') + '<a class="btn btn-sm" href="#/topic/' + w.node + '/quiz">이 노드 퀴즈</a></span></div>';
      }).join('') + '</section>';
    }
    if (x.items && x.items.length) {
      html += '<section class="card"><h3>문제별 검토</h3>' + x.items.map(function (it, i) {
        var q0 = DS2.question(it.q);
        if (!q0) return '';
        var r = G.gradeQuestion(q0, null);
        var mine = it.g === null ? '미응답' : q0.type === 'mcq' ? G.CIRCLED[it.g] : q0.type === 'ox' ? (it.g ? 'O' : 'X') : String(it.g);
        return '<details class="review-item"><summary><span class="' + (it.c ? 'pill-ok' : 'pill-bad') + ' tag">' + (it.c ? '정답' : '오답') + '</span>&nbsp;' + (i + 1) + '. ' + esc(F.plain(q0.prompt, 60)) + '</summary>' +
          questionBody(q0) + '<p><strong>정답 ' + esc(r.answerText) + '</strong> · 내 답 ' + esc(mine) + '</p><div class="explanation">' + F.render(q0.explanation) + '</div>' + termChips(q0.terms) + '</details>';
      }).join('') + '</section>';
    }
    view.innerHTML = html;
    q(view, '#exam-again').addEventListener('click', function () { beginExam(x.scope || [], x.n, x.seed, !!x.limitSec); });
  }

  /* ════════════════════════════════════════════════════════
     용어 사전
     ════════════════════════════════════════════════════════ */
  var glossSort = 'ko';
  function glossary(view, route) {
    var all = DS2.allTerms();
    var focusId = route.params.termId;
    var html = '<div class="gloss-search"><div class="row"><input type="search" id="gloss-q" placeholder="한글·영문·id 검색" aria-label="용어 검색" autocomplete="off">' +
      '<div class="seg" role="group" aria-label="정렬"><button type="button" data-sort="ko" aria-pressed="' + (glossSort === 'ko') + '">ㄱㄴㄷ</button><button type="button" data-sort="en" aria-pressed="' + (glossSort === 'en') + '">ABC</button></div></div>' +
      '<p class="small muted" style="margin:.4rem 0 0" id="gloss-count"></p></div><ul class="gloss-list" id="gloss-list"></ul>';
    view.innerHTML = html;
    var list = q(view, '#gloss-list'), input = q(view, '#gloss-q'), count = q(view, '#gloss-count');
    function draw() {
      var kw = input.value.trim().toLowerCase();
      var items = all.filter(function (t) { return !kw || t.ko.toLowerCase().indexOf(kw) >= 0 || t.en.toLowerCase().indexOf(kw) >= 0 || t.id.indexOf(kw) >= 0; });
      items.sort(function (a, b) { var x = glossSort === 'ko' ? a.ko : a.en.toLowerCase(), y = glossSort === 'ko' ? b.ko : b.en.toLowerCase(); return x.localeCompare(y, glossSort === 'ko' ? 'ko' : 'en'); });
      count.textContent = items.length + '개 용어' + (all.length !== items.length ? ' / 전체 ' + all.length : '');
      list.innerHTML = items.map(function (t) {
        var nq = DS2.questionsByTerm(t.id).length;
        return '<li class="gloss-item" id="term-' + esc(t.id) + '" tabindex="-1"><h3>' + esc(t.ko) + ' <span class="en">(' + esc(t.en) + ')</span></h3><div>' + F.render(t.def) + '</div>' +
          '<div class="row small">' + (t.nodes.length ? t.nodes.map(function (n) { return cur.byId[n] ? '<a href="#/topic/' + n + '">' + esc(nodeTitle(n)) + '</a>' : ''; }).join('') : '') +
          (nq ? '<a href="#/glossary/' + esc(t.id) + '" class="muted">관련 문제 ' + nq + '개</a>' : '') + '</div>' +
          (t.related.length ? termChips(t.related.filter(function (r) { return DS2.term(r); })) : '') +
          (focusId === t.id && nq ? '<div class="card" style="margin-top:.5rem"><strong class="small">이 용어 관련 문제</strong><ul class="wrong-list">' + DS2.questionsByTerm(t.id).map(function (q0) { return '<li><a href="#/wrong?q=' + esc(q0.id) + '"><span class="q">' + esc(F.plain(q0.prompt, 70)) + '</span><span class="tag">' + esc(q0.id) + '</span></a></li>'; }).join('') + '</ul></div>' : '') +
          '</li>';
      }).join('') || '<li class="muted" style="padding:1rem 0">' + (all.length ? '검색 결과가 없습니다.' : '등록된 용어가 없습니다.') + '</li>';
    }
    draw();
    input.addEventListener('input', draw);
    on(view, '[data-sort]', 'click', function (e) { glossSort = e.currentTarget.getAttribute('data-sort'); qa(view, '[data-sort]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === e.currentTarget)); }); draw(); });
    if (focusId) {
      var target = q(view, '#term-' + focusId.replace(/[^a-z0-9-]/g, ''));
      if (target) {
        target.style.background = 'var(--accent-muted)';
        if (!app().embedded) { try { target.scrollIntoView({ block: 'start' }); } catch (e) { /* */ } target.focus(); }
      } else if (!DS2.term(focusId)) app().toast('사전에 없는 용어입니다: ' + focusId);
    } else if (!app().embedded && !app().coarse) input.focus();
  }

  /* ════════════════════════════════════════════════════════
     설정
     ════════════════════════════════════════════════════════ */
  function settings(view) {
    var s = S.getSettings();
    var stats = DS2.stats();
    var unverified = DS2.allPractices().filter(function (p) { return !p.verified || p.verified.by !== 'python'; }).length;
    var w = DS2.warnings.length;
    var html = '<section class="card"><h2>설정</h2>' +
      item('테마', '', '<div class="seg" role="group" aria-label="테마">' + ['auto', 'light', 'dark'].map(function (t) { return '<button type="button" data-theme="' + t + '" aria-pressed="' + (s.theme === t) + '">' + ({ auto: '자동', light: '밝게', dark: '어둡게' })[t] + '</button>'; }).join('') + '</div>') +
      item('글자 크기', '', '<div class="seg" role="group" aria-label="글자 크기"><button type="button" data-font="1" aria-pressed="' + (s.fontScale === 1) + '">보통</button><button type="button" data-font="1.15" aria-pressed="' + (s.fontScale === 1.15) + '">크게</button></div>') +
      item('모의고사 제한 시간', '문제당 60초. 설정 화면에서 매번 바꿀 수 있습니다.', '<input type="checkbox" id="set-timer"' + (s.examTimer ? ' checked' : '') + ' aria-label="제한 시간 기본값">') +
      item('실습 힌트 기본 펼침', '', '<input type="checkbox" id="set-hint"' + (s.showHintByDefault ? ' checked' : '') + ' aria-label="힌트 기본 펼침">') + '</section>';

    html += '<section class="card"><h3>진도 내보내기 / 가져오기</h3>' +
      (!S.ok ? '<p class="notice notice-warn">이 브라우저에서는 진도가 저장되지 않습니다. 탭을 닫으면 사라지니 내보내기로 보관하세요.</p>' : '') +
      (S.hadCorrupt() ? '<p class="notice notice-warn">손상된 진도 파일이 발견되어 <code>apps.ds-level2.progress.corrupt</code> 에 보관하고 빈 진도로 시작했습니다.</p>' : '') +
      '<div class="btn-group"><button type="button" class="btn" id="btn-export">JSON 내려받기</button><button type="button" class="btn" id="btn-export-copy">JSON 복사</button></div>' +
      '<div class="field" style="margin-top:.75rem"><label for="import-text">가져오기 — 파일 선택 또는 붙여넣기</label><input type="file" id="import-file" accept="application/json,.json" aria-label="진도 파일 선택" style="margin-bottom:.5rem">' +
      '<textarea id="import-text" placeholder="내보낸 JSON 을 여기에 붙여넣기"></textarea></div>' +
      '<label class="check"><input type="checkbox" id="import-overwrite"> 기존 진도 덮어쓰기 (기본은 병합: 문제별로 더 최신 기록 채택)</label>' +
      '<button type="button" class="btn btn-primary" id="btn-import">가져오기</button><div id="import-result" style="margin-top:.5rem"></div></section>';

    html += '<section class="card"><h3>진도 초기화</h3><p class="small muted">문제·실습·카드·모의고사 기록을 모두 지웁니다. 설정은 유지됩니다.</p><button type="button" class="btn btn-danger" id="btn-reset">진도 초기화</button></section>';

    html += '<section class="card"><h3>데이터</h3><p class="small">파일 ' + stats.files + ' · 카드 ' + stats.cards + ' · 문제 ' + stats.questions + ' · 실습 ' + stats.practices + ' · 용어 ' + stats.terms + '</p>' +
      '<p class="small">콘텐츠 경고 ' + w + '건' + (w ? ' <button type="button" class="btn-link" id="btn-warn">보기</button>' : '') + (unverified ? ' · <span class="pill-warn tag">미검증 실습 ' + unverified + '개</span>' : '') + '</p>' +
      '<pre class="warn-list" id="warn-list" hidden></pre><p class="small muted">ds-level2 v1 · 데이터 사이언스 레벨2 학습앱 · 외부 요청 없음</p></section>';
    view.innerHTML = html;

    on(view, '[data-theme]', 'click', function (e) { var t = e.currentTarget.getAttribute('data-theme'); S.setSetting('theme', t); app().applyTheme(); qa(view, '[data-theme]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === e.currentTarget)); }); });
    on(view, '[data-font]', 'click', function (e) { var f = Number(e.currentTarget.getAttribute('data-font')); S.setSetting('fontScale', f); app().applyFont(); qa(view, '[data-font]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === e.currentTarget)); }); });
    q(view, '#set-timer').addEventListener('change', function (e) { S.setSetting('examTimer', e.target.checked); });
    q(view, '#set-hint').addEventListener('change', function (e) { S.setSetting('showHintByDefault', e.target.checked); });
    q(view, '#btn-export').addEventListener('click', function () {
      var json = S.exportJSON();
      if (E.ipynb.download(S.exportFilename(), json)) app().toast(S.exportFilename() + ' 내려받기'); else { q(view, '#import-text').value = json; app().toast('내려받기 불가 — 아래 상자에 JSON 을 넣었습니다'); }
    });
    q(view, '#btn-export-copy').addEventListener('click', function (e) { app().copyText(S.exportJSON(), e.currentTarget); });
    q(view, '#import-file').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function () { q(view, '#import-text').value = String(reader.result || ''); };
      reader.readAsText(f);
    });
    q(view, '#btn-import').addEventListener('click', function () {
      var txt = q(view, '#import-text').value.trim();
      var out = q(view, '#import-result');
      if (!txt) { out.innerHTML = '<p class="notice notice-warn">가져올 JSON 이 없습니다.</p>'; return; }
      var r = S.importJSON(txt, q(view, '#import-overwrite').checked);
      if (!r.ok) { out.innerHTML = '<p class="notice notice-bad">' + esc(r.error) + '</p>'; return; }
      out.innerHTML = '<p class="notice notice-ok">' + (r.overwrite ? '덮어쓰기 완료' : '병합 완료') + ' — 문제 ' + r.merged.quiz + ' · 실습 ' + r.merged.practice + ' · 카드 ' + r.merged.cards + ' · 모의고사 ' + r.merged.exams + ' 반영. 이전 진도는 백업 키에 보관.</p>';
      app().updateBadges();
    });
    var resetBtn = q(view, '#btn-reset'), armed = false, timer = null;
    resetBtn.addEventListener('click', function () {
      if (!armed) { armed = true; resetBtn.textContent = '정말 초기화하려면 다시 누르세요'; resetBtn.classList.add('btn-primary'); timer = setTimeout(function () { armed = false; resetBtn.textContent = '진도 초기화'; resetBtn.classList.remove('btn-primary'); }, 5000); return; }
      clearTimeout(timer); S.reset(); armed = false; resetBtn.textContent = '초기화됨'; resetBtn.disabled = true; app().updateBadges(); app().toast('진도를 초기화했습니다');
    });
    var wb = q(view, '#btn-warn');
    if (wb) wb.addEventListener('click', function () {
      var pre = q(view, '#warn-list'); pre.hidden = !pre.hidden;
      pre.textContent = DS2.warnings.map(function (x) { return JSON.stringify(x); }).join('\n');
    });
    function item(label, desc, control) {
      return '<div class="settings-item"><div><div class="lbl">' + label + '</div>' + (desc ? '<div class="desc">' + desc + '</div>' : '') + '</div>' + control + '</div>';
    }
  }

  E.views = { home: home, tree: tree, topic: topic, wrong: wrong, review: review, exam: exam, examRun: examRun, examResult: examResult,
    glossary: glossary, settings: settings, allStatuses: allStatuses, firstIncomplete: firstIncomplete,
    hasSession: function () { return !!session; }, endSession: endSession, stopExamTimer: stopExamTimer, readQuestion: readQuestion };
})(typeof globalThis !== 'undefined' ? globalThis : window);
