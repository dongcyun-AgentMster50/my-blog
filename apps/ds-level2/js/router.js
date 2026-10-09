/* ============================================================
   ds-level2 — 해시 라우터

   단일 페이지 + 해시 라우팅(spec 7절). file:// 에서도 해시는 문제없고, 데이터 11파일을
   페이지마다 다시 로드하지 않으며 퀴즈 세션·타이머 상태가 전환에 날아가지 않는다.
   라우터는 해시를 {name, params} 로 해석해 등록된 핸들러를 부르고, 뷰별 스크롤 위치를
   sessionStorage 에 저장·복원한다. 잘못된 경로는 'notfound' 로 넘겨 앱이 홈 + 토스트로 처리.
   ============================================================ */
(function (root) {
  'use strict';
  var E = root.__DS2 || (root.__DS2 = {});

  // [정규식, 이름, 파라미터 이름들]
  var ROUTES = [
    [/^\/?$/, 'home', []],
    [/^\/tree\/?$/, 'tree', []],
    [/^\/topic\/([a-b](?:-\d){1,2})(?:\/(card|quiz|lab))?\/?$/, 'topic', ['id', 'tab']],
    [/^\/wrong\/?$/, 'wrong', []],
    [/^\/review\/?$/, 'review', []],
    [/^\/exam\/?$/, 'exam', []],
    [/^\/exam\/run\/?$/, 'examRun', []],
    [/^\/exam\/result\/([A-Za-z0-9_-]+)\/?$/, 'examResult', ['examId']],
    [/^\/glossary\/?$/, 'glossary', []],
    [/^\/glossary\/([a-z0-9-]+)\/?$/, 'glossary', ['termId']],
    [/^\/settings\/?$/, 'settings', []]
  ];

  function parse(hash) {
    var path = String(hash || '').replace(/^#/, '');
    if (!path) path = '/';
    var query = '';
    var qi = path.indexOf('?');
    if (qi >= 0) { query = path.slice(qi + 1); path = path.slice(0, qi); }
    try { path = decodeURIComponent(path); } catch (e) { /* 그대로 */ }
    for (var i = 0; i < ROUTES.length; i++) {
      var m = ROUTES[i][0].exec(path);
      if (m) {
        var params = {};
        ROUTES[i][2].forEach(function (k, j) { if (m[j + 1] !== undefined) params[k] = m[j + 1]; });
        return { name: ROUTES[i][1], params: params, path: path, query: query, hash: '#' + path };
      }
    }
    return { name: 'notfound', params: {}, path: path, query: query, hash: '#' + path };
  }

  var SCROLL_KEY = 'apps.ds-level2.scroll';
  function scrollMap() {
    try { return JSON.parse(E.store.session.get(SCROLL_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveScroll(path) {
    var m = scrollMap();
    m[path] = root.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;
    E.store.session.set(SCROLL_KEY, JSON.stringify(m));
  }
  function restoreScroll(path) {
    var y = scrollMap()[path] || 0;
    try { root.scrollTo(0, y); } catch (e) { /* 무시 */ }
  }

  var handler = null;
  var current = null;
  var started = false;

  function dispatch() {
    var route = parse(root.location.hash);
    if (current) saveScroll(current.path);
    var prev = current;
    current = route;
    if (handler) handler(route, prev);
    // 렌더 직후 복원. 같은 경로(탭 전환 등)로 재진입해도 저장값이 있으면 그 자리로.
    restoreScroll(route.path);
  }

  function go(hash) {
    if (hash.charAt(0) !== '#') hash = '#' + hash;
    if (root.location.hash === hash) dispatch(); // 같은 해시면 hashchange 가 안 나므로 직접
    else root.location.hash = hash;
  }
  function replace(hash) {
    if (hash.charAt(0) !== '#') hash = '#' + hash;
    try { root.history.replaceState(null, '', hash); dispatch(); }
    catch (e) { root.location.hash = hash; }
  }
  function back(fallback) {
    // 히스토리가 앱 밖(블로그)으로 나가면 안 되므로, 이전 라우트가 없으면 fallback 으로.
    if (fallback) go(fallback);
    else root.history.back();
  }

  function start(fn) {
    handler = fn;
    if (!started) {
      started = true;
      root.addEventListener('hashchange', dispatch);
    }
    dispatch();
  }

  E.router = { ROUTES: ROUTES, parse: parse, go: go, replace: replace, back: back, start: start,
    current: function () { return current; }, saveScroll: saveScroll };
})(typeof globalThis !== 'undefined' ? globalThis : window);
