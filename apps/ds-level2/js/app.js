/* ============================================================
   ds-level2 — 부팅과 셸(크롬) 동작

   테마·글자 크기·임베드 감지, 상단바/탭바/사이드바 상태, 용어 바텀시트, 토스트,
   복사 버튼, 라우터 디스패치 → views. 전역은 window.DS2(콘텐츠)와 window.__DS2(엔진)뿐.
   ============================================================ */
(function (root) {
  'use strict';
  var E = root.__DS2 || (root.__DS2 = {});
  var DS2 = root.DS2;
  var S = E.store, R = E.router, F = E.format, L = E.leitner, V = E.views;
  var html = document.documentElement;

  var app = E.app = {};
  var embedded = html.hasAttribute('data-embed');
  app.embedded = embedded;
  app.coarse = (function () { try { return root.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();

  /* ── 테마 / 글자 크기 ──────────────────────────────────── */
  var urlTheme = (function () { var m = /[?&]theme=(light|dark)/.exec(root.location.search); return m ? m[1] : null; })();
  function applyTheme() {
    var t = urlTheme || S.getSettings().theme;
    if (t !== 'light' && t !== 'dark') {
      var dark = false;
      try { dark = root.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { /* */ }
      t = dark ? 'dark' : 'light';
    }
    html.setAttribute('data-theme', t);
  }
  function applyFont() {
    if (S.getSettings().fontScale === 1.15) html.setAttribute('data-font', 'large'); else html.removeAttribute('data-font');
  }
  app.applyTheme = applyTheme;
  app.applyFont = applyFont;
  try {
    var mq = root.matchMedia('(prefers-color-scheme: dark)');
    var onScheme = function () { if (S.getSettings().theme === 'auto' && !urlTheme) applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onScheme); else if (mq.addListener) mq.addListener(onScheme);
  } catch (e) { /* */ }

  /* ── 토스트 / 라이브 영역 ─────────────────────────────── */
  var toastEl = document.getElementById('toast'), toastTimer = null;
  app.toast = function (msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  };
  var liveEl = document.getElementById('live'), liveFlip = false;
  // 같은 문구가 연속되면 스크린리더가 다시 읽지 않으므로 보이지 않는 문자를 번갈아 붙인다.
  app.announce = function (msg) { liveFlip = !liveFlip; liveEl.textContent = msg + (liveFlip ? '​' : ''); };

  /* ── 상단바 ───────────────────────────────────────────── */
  var titleEl = document.getElementById('topbar-title'), progressEl = document.getElementById('topbar-progress'),
      quitBtn = document.getElementById('btn-quit'), backBtn = document.getElementById('btn-back'), themeBtn = document.getElementById('btn-theme'),
      menuBtn = document.getElementById('btn-menu');
  var TITLES = { home: '데이터 사이언스 레벨2', tree: '커리큘럼 트리', wrong: '오답 노트', review: '오늘 복습', exam: '모의고사', examRun: '모의고사 진행', examResult: '모의고사 결과', glossary: '용어 사전', settings: '설정' };
  app.setTitle = function (t) { titleEl.textContent = t; document.title = (t === TITLES.home ? '' : t + ' · ') + '데이터 사이언스 레벨2 학습'; };

  var quitHandler = null;
  /** 퀴즈·모의고사 진행 중: 탭바 숨김, 상단바에 진행률과 [종료]만 (오터치 방지) */
  app.setSession = function (on, opts) {
    opts = opts || {};
    if (on) {
      html.setAttribute('data-session', '');
      progressEl.hidden = !opts.progress; progressEl.textContent = opts.progress || '';
      progressEl.classList.toggle('urgent', !!opts.urgent);
      quitBtn.hidden = false; quitHandler = opts.onQuit || null;
      backBtn.hidden = true; themeBtn.hidden = true;
    } else {
      html.removeAttribute('data-session');
      progressEl.hidden = true; quitBtn.hidden = true; quitHandler = null;
      backBtn.hidden = false; themeBtn.hidden = false;
    }
  };
  quitBtn.addEventListener('click', function () { if (quitHandler) quitHandler(); });
  themeBtn.addEventListener('click', function () {
    var now = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    S.setSetting('theme', now); urlTheme = null; applyTheme();
    app.toast(now === 'dark' ? '어두운 테마' : '밝은 테마');
  });
  backBtn.addEventListener('click', function () {
    var r = R.current();
    var parent = { topic: '#/tree', examRun: '#/exam', examResult: '#/exam', glossary: '#/glossary', wrong: '#/', review: '#/', exam: '#/', settings: '#/', tree: '#/' }[r && r.name] || '#/';
    if (r && r.name === 'glossary' && !r.params.termId) parent = '#/';
    if (r && r.name === 'wrong' && r.query) parent = '#/wrong';
    R.go(parent);
  });

  /* ── 메뉴 시트 / 용어 시트 ───────────────────────────── */
  var moreSheet = document.getElementById('more-sheet'), moreBackdrop = document.getElementById('more-backdrop'), moreBtn = document.getElementById('tab-more');
  var termSheet = document.getElementById('term-sheet'), termBackdrop = document.getElementById('term-backdrop');
  var lastFocus = null;
  function openMore(opener) {
    lastFocus = opener || document.activeElement;
    moreSheet.hidden = false; moreBackdrop.hidden = false;
    moreBtn.setAttribute('aria-expanded', 'true'); menuBtn.setAttribute('aria-expanded', 'true');
    var first = moreSheet.querySelector('a:not(.embed-only), a');
    if (first) first.focus();
  }
  function closeMore() {
    if (moreSheet.hidden) return;
    moreSheet.hidden = true; moreBackdrop.hidden = true;
    moreBtn.setAttribute('aria-expanded', 'false'); menuBtn.setAttribute('aria-expanded', 'false');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  moreBtn.addEventListener('click', function () { if (moreSheet.hidden) openMore(moreBtn); else closeMore(); });
  menuBtn.addEventListener('click', function () { if (moreSheet.hidden) openMore(menuBtn); else closeMore(); });
  moreBackdrop.addEventListener('click', closeMore);
  document.getElementById('more-close').addEventListener('click', closeMore);
  moreSheet.addEventListener('click', function (e) { if (e.target.closest('a')) closeMore(); });

  app.openTerm = function (id, opener) {
    var t = DS2.term(id);
    if (!t) { app.toast('사전에 없는 용어입니다: ' + id); return; }
    lastFocus = opener || document.activeElement;
    document.getElementById('term-title').innerHTML = F.escape(t.ko) + ' <span class="en">(' + F.escape(t.en) + ')</span>';
    document.getElementById('term-def').innerHTML = F.inline(t.def);
    var meta = [];
    t.nodes.forEach(function (n) { if (DS2.curriculum.byId[n]) meta.push('<a href="#/topic/' + n + '">' + F.escape(DS2.curriculum.byId[n].title) + '</a>'); });
    var rel = t.related.filter(function (r) { return DS2.term(r); }).map(function (r) { return '<button type="button" class="term" data-term="' + r + '">' + F.escape(DS2.term(r).ko) + '</button>'; });
    var nq = DS2.questionsByTerm(id).length;
    document.getElementById('term-meta').innerHTML = (meta.length ? '관련 노드: ' + meta.join(' · ') : '') + (rel.length ? (meta.length ? '<br>' : '') + '관련 용어: ' + rel.join(' · ') : '') + (nq ? (meta.length || rel.length ? '<br>' : '') + '관련 문제 ' + nq + '개' : '');
    document.getElementById('term-link').setAttribute('href', '#/glossary/' + id);
    termSheet.hidden = false; termBackdrop.hidden = false;
    document.getElementById('term-close').focus();
  };
  function closeTerm() {
    if (termSheet.hidden) return;
    termSheet.hidden = true; termBackdrop.hidden = true;
    if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) lastFocus.focus();
  }
  app.closeTerm = closeTerm;
  termBackdrop.addEventListener('click', closeTerm);
  document.getElementById('term-close').addEventListener('click', closeTerm);
  document.getElementById('term-link').addEventListener('click', function () { termSheet.hidden = true; termBackdrop.hidden = true; });
  termSheet.addEventListener('click', function (e) { var a = e.target.closest('a[href^="#/"]'); if (a) { termSheet.hidden = true; termBackdrop.hidden = true; } });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeTerm(); closeMore(); }
  });

  /* ── 복사 ─────────────────────────────────────────────── */
  app.copyText = function (txt, btn) {
    var label = btn ? btn.textContent : '';
    function done(ok) {
      if (!btn) { if (ok) app.toast('복사됨'); return; }
      if (ok) { btn.textContent = '복사됨'; setTimeout(function () { btn.textContent = label; }, 1500); }
    }
    function fallback() {
      // file:// 등 비보안 컨텍스트: 임시 textarea 선택 + execCommand. 그것도 실패하면 코드를 선택 상태로 두고 안내.
      var ok = false;
      try {
        var ta = document.createElement('textarea');
        ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) { ok = false; }
      if (!ok && btn) {
        var pre = btn.parentNode && btn.parentNode.querySelector('pre');
        if (pre) { try { var sel = root.getSelection(), range = document.createRange(); range.selectNodeContents(pre); sel.removeAllRanges(); sel.addRange(range); } catch (e2) { /* */ } }
        app.toast('자동 복사가 막혔습니다. 선택된 코드를 길게 눌러 복사하세요');
      }
      done(ok);
    }
    if (root.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { done(true); }, fallback);
    } else fallback();
  };

  /* ── 전역 위임 클릭: 용어 버튼·복사 버튼 ─────────────── */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-term]');
    if (t) { e.preventDefault(); app.openTerm(t.getAttribute('data-term'), t); return; }
    var c = e.target.closest('[data-copy]');
    if (c) { e.preventDefault(); app.copyText(c.getAttribute('data-copy'), c); }
  });

  /* ── 내비게이션 하이라이트·배지 ──────────────────────── */
  function setNav(name) {
    var key = { examRun: 'exam', examResult: 'exam' }[name] || name;
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (a) {
      if (a.getAttribute('data-nav') === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  app.updateBadges = function () {
    var p = S.get();
    var due = L.dueIds(p.quiz).filter(function (id) { return DS2.question(id); }).length;
    var wrong = L.wrongIds(p.quiz).filter(function (id) { return DS2.question(id); }).length;
    ['side-review-count', 'tab-review-count'].forEach(function (id) { var b = document.getElementById(id); b.hidden = !due; b.textContent = due; });
    ['side-wrong-count', 'more-wrong-count'].forEach(function (id) { var b = document.getElementById(id); b.hidden = !wrong; b.textContent = wrong; });
  };

  /* ── 라우팅 ───────────────────────────────────────────── */
  var viewEl = document.getElementById('view');
  app.notFound = function (route) {
    app.toast('없는 주소입니다: ' + route.hash);
    R.replace('#/');
  };
  function dispatch(route) {
    // 진행 중 세션은 라우트가 바뀌면 끝난다(채점 결과는 이미 저장되어 있다).
    if (V.hasSession()) V.endSession();
    V.stopExamTimer();
    if (route.name !== 'examRun') app.setSession(false);
    closeTerm(); closeMore();
    var fn = V[route.name];
    if (!fn) return app.notFound(route);
    app.setTitle(TITLES[route.name] || TITLES.home);
    setNav(route.name);
    viewEl.innerHTML = '';
    try {
      fn(viewEl, route);
    } catch (e) {
      try { console.error('[ds-level2] 화면 렌더 실패', route, e); } catch (e2) { /* */ }
      viewEl.innerHTML = '<section class="card"><h2>화면을 그리지 못했습니다</h2><p class="small muted">' + F.escape(String(e && e.message || e)) + '</p><a class="btn" href="#/">홈으로</a></section>';
    }
    app.updateBadges();
  }

  /* ── 부팅 ─────────────────────────────────────────────── */
  function boot() {
    applyTheme(); applyFont();
    S.load();
    if (DS2.warnings.length) { try { console.warn('[ds-level2] 콘텐츠 경고 ' + DS2.warnings.length + '건 — 설정 화면에서 확인', DS2.warnings.slice(0, 5)); } catch (e) { /* */ } }
    var st = DS2.stats();
    try { console.info('[ds-level2] 파일 ' + st.files + ' · 문제 ' + st.questions + ' · 실습 ' + st.practices + ' · 용어 ' + st.terms + (S.ok ? '' : ' · 저장소 사용 불가(메모리 폴백)')); } catch (e) { /* */ }
    R.start(dispatch);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
