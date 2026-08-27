/* ============================================================
   2048 — 게임 로직

   외부 의존성 없음. ES 모듈이 아니라 클래식 스크립트다.
   모듈로 두면 file:// 에서 CORS로 차단되어 더블클릭 실행이 막힌다.
   전역 오염은 파일 전체를 IIFE로 감싸서 막는다.
   ============================================================ */
(function () {
  'use strict';

  /* ────────────────────────────────────────────────────────
     CONFIG
     ──────────────────────────────────────────────────────── */
  var CONFIG = {
    SIZE: 4,
    WIN_VALUE: 2048,
    SPAWN_FOUR_RATE: 0.1,
    SWIPE_MIN_PX: 24,   // 스와이프 인정 최소 거리(하한)
    SWIPE_RATIO: 0.06,  // 보드 폭 대비 임계 비율. 작은 화면에서도 짧은 스와이프를 인정한다.
    STORAGE_KEY: 'apps.2048.best' // 블로그의 "theme" 키와 섞이지 않도록 네임스페이스를 붙인다.
  };
  var SIZE = CONFIG.SIZE;
  var CELL_COUNT = SIZE * SIZE;

  /* ────────────────────────────────────────────────────────
     state — 순수 데이터. DOM 참조를 담지 않는다.
     ──────────────────────────────────────────────────────── */
  var state = {
    grid: [],
    score: 0,
    best: 0,
    won: false,
    keepPlaying: false,
    over: false,
    newRecord: false, // 이번 판에서 최고 기록을 갱신했는가 (게임 오버 문구용)
    snapshot: null    // 1단계 실행 취소용 단일 스냅샷
  };

  /* ────────────────────────────────────────────────────────
     규칙 계층 — DOM을 전혀 모른다.
     이 계층이 순수하기 때문에 콘솔에서 함수 단위로 검증할 수 있다.
     ──────────────────────────────────────────────────────── */

  /**
   * 한 줄을 이루는 보드 인덱스를 "미는 방향의 벽에서 가까운 순"으로 돌려준다.
   * 격자를 회전시키지 않고 읽는 순서만 바꾸므로, 합쳐진 칸의 실제 보드
   * 인덱스가 그대로 나온다. 이 정렬이 "벽에 가까운 쌍부터 합친다"는
   * 우선순위 규칙을 별도 코드 없이 보장한다.
   */
  function lineIndices(dir, lineNo) {
    var idxs = [];
    var k;
    for (k = 0; k < SIZE; k++) {
      if (dir === 'left') {
        idxs.push(lineNo * SIZE + k);
      } else if (dir === 'right') {
        idxs.push(lineNo * SIZE + (SIZE - 1 - k));
      } else if (dir === 'up') {
        idxs.push(k * SIZE + lineNo);
      } else if (dir === 'down') {
        idxs.push((SIZE - 1 - k) * SIZE + lineNo);
      }
    }
    return idxs;
  }

  /**
   * 벽에서 가까운 순으로 정렬된 길이 SIZE의 값 배열을 밀어 합친다.
   * 반환: { out, gained, mergedAt } — out도 같은 순서다.
   */
  function collapse(values) {
    var compact = [];
    var out = [];
    var mergedAt = [];
    var gained = 0;
    var i;

    for (i = 0; i < values.length; i++) {
      if (values[i] !== 0) compact.push(values[i]);
    }

    i = 0;
    while (i < compact.length) {
      if (i + 1 < compact.length && compact[i] === compact[i + 1]) {
        var merged = compact[i] * 2;
        mergedAt.push(out.length);
        out.push(merged);
        gained += merged;
        // ★ 두 칸을 한 번에 소비한다. 합쳐서 만든 merged는 out에만 들어가고
        //   compact의 남은 값과 다시 비교되지 않으므로 이중 합치기가 원천 차단된다.
        //   ([2,2,4,0] → [4,4,0,0]) 별도의 병합 플래그 배열이 필요 없는 이유다.
        i += 2;
      } else {
        out.push(compact[i]);
        i += 1;
      }
    }

    while (out.length < SIZE) out.push(0);

    return { out: out, gained: gained, mergedAt: mergedAt };
  }

  /**
   * 격자를 한 방향으로 민다.
   * 반환: { changed, gainedTotal, mergedBoardIndices }
   */
  function move(dir) {
    var changed = false;
    var gainedTotal = 0;
    var mergedBoardIndices = [];
    var n, k, idxs, values, res;

    for (n = 0; n < SIZE; n++) {
      idxs = lineIndices(dir, n);
      values = [];
      for (k = 0; k < SIZE; k++) values.push(state.grid[idxs[k]]);

      res = collapse(values);

      for (k = 0; k < SIZE; k++) {
        if (state.grid[idxs[k]] !== res.out[k]) {
          state.grid[idxs[k]] = res.out[k];
          changed = true;
        }
      }
      gainedTotal += res.gained;
      for (k = 0; k < res.mergedAt.length; k++) {
        mergedBoardIndices.push(idxs[res.mergedAt[k]]);
      }
    }

    return { changed: changed, gainedTotal: gainedTotal, mergedBoardIndices: mergedBoardIndices };
  }

  /** 빈 칸 하나에 타일을 놓고 그 인덱스를 돌려준다. 빈 칸이 없으면 -1. */
  function spawnTile() {
    var empty = [];
    var i;
    for (i = 0; i < state.grid.length; i++) {
      if (state.grid[i] === 0) empty.push(i);
    }
    if (empty.length === 0) return -1;

    var idx = empty[Math.floor(Math.random() * empty.length)];
    state.grid[idx] = Math.random() < CONFIG.SPAWN_FOUR_RATE ? 4 : 2;
    return idx;
  }

  /** 움직일 수 있는가. 빈 칸이 있으면 즉시 true. */
  function hasMove() {
    var r, c, v;
    if (state.grid.indexOf(0) !== -1) return true;

    // 오른쪽·아래만 보면 모든 인접 쌍을 중복 없이 덮는다.
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        v = state.grid[r * SIZE + c];
        if (c + 1 < SIZE && v === state.grid[r * SIZE + c + 1]) return true;
        if (r + 1 < SIZE && v === state.grid[(r + 1) * SIZE + c]) return true;
      }
    }
    return false;
  }

  /** 승리 타일 도달 여부. 계속하기로 4096이 나와도 판정이 흔들리지 않도록 >= 로 본다. */
  function hasWinTile() {
    var i;
    for (i = 0; i < state.grid.length; i++) {
      if (state.grid[i] >= CONFIG.WIN_VALUE) return true;
    }
    return false;
  }

  function emptyCount() {
    var i, n = 0;
    for (i = 0; i < state.grid.length; i++) {
      if (state.grid[i] === 0) n++;
    }
    return n;
  }

  /* ────────────────────────────────────────────────────────
     저장 계층
     ──────────────────────────────────────────────────────── */

  /**
   * 샌드박스 iframe·프라이빗 모드·서드파티 저장소 차단 환경에서는
   * window.localStorage "프로퍼티 접근 자체"가 SecurityError를 던진다.
   * 그래서 값 파싱이 아니라 접근 전체를 try/catch로 감싼다.
   * 실패해도 조용히 세션 메모리로 폴백한다 — 사용자에게 알려봐야 할 수 있는 일이 없다.
   */
  var safeStorage = (function () {
    var memory = {};
    return {
      get: function (key) {
        try {
          return window.localStorage.getItem(key);
        } catch (e) {
          return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
        }
      },
      set: function (key, value) {
        try {
          window.localStorage.setItem(key, value);
        } catch (e) {
          memory[key] = value;
        }
      }
    };
  })();

  function readBest() {
    var raw = safeStorage.get(CONFIG.STORAGE_KEY);
    var n = Number(raw);
    // 손상되거나 조작된 값이 NaN으로 화면에 뜨는 것을 막는다.
    return (raw !== null && raw !== '' && Number.isFinite(n) && n >= 0) ? n : 0;
  }

  /* ────────────────────────────────────────────────────────
     렌더 계층 — 상태를 읽기만 한다.
     ──────────────────────────────────────────────────────── */
  var board, cells = [], elScore, elBest, elScoreBox, elUndo, elRestart,
      elOverlay, elOverlayTitle, elOverlayDesc, elOverlayRecord,
      elOverlayPrimary, elOverlayNew, elLive, elGame;

  var reduceMotion = false;
  var overlayMode = null; // 'win' | 'over' | null

  function buildBoard() {
    var frag = document.createDocumentFragment();
    var i, cell;
    for (i = 0; i < CELL_COUNT; i++) {
      cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('data-value', '0');
      // 숫자 16개가 개별로 낭독되면 소음이다. 판 상태는 라이브 영역 문구로 전한다.
      cell.setAttribute('aria-hidden', 'true');
      cell.addEventListener('animationend', clearCellAnimation);
      cells.push(cell);
      frag.appendChild(cell);
    }
    board.appendChild(frag);
  }

  function clearCellAnimation(e) {
    e.currentTarget.classList.remove('is-new', 'is-merged');
  }

  function render(newIndex, mergedIndices) {
    var i, v, cell;

    for (i = 0; i < cells.length; i++) {
      cell = cells[i];
      v = state.grid[i];
      cell.classList.remove('is-new', 'is-merged');
      cell.setAttribute('data-value', String(v));
      // 2048을 넘는 값마다 색을 추가하지 않는다. 하나의 스타일을 공유시킨다.
      if (v > CONFIG.WIN_VALUE) cell.setAttribute('data-big', 'true');
      else cell.removeAttribute('data-big');
      cell.textContent = v === 0 ? '' : String(v);
    }

    // 클래스를 지운 뒤 리플로우를 한 번 강제해야 같은 칸에서 애니메이션이 다시 시작된다.
    void board.offsetWidth;

    if (mergedIndices) {
      for (i = 0; i < mergedIndices.length; i++) {
        cells[mergedIndices[i]].classList.add('is-merged');
      }
    }
    if (typeof newIndex === 'number' && newIndex >= 0) {
      cells[newIndex].classList.add('is-new');
    }

    updateHud();
  }

  function updateHud() {
    elScore.textContent = String(state.score);
    elBest.textContent = String(state.best);
    elUndo.disabled = (state.snapshot === null);
  }

  function showScoreFloat(gained) {
    if (reduceMotion || gained <= 0) return;
    var span = document.createElement('span');
    span.className = 'score-float';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = '+' + gained;
    span.addEventListener('animationend', function () {
      if (span.parentNode) span.parentNode.removeChild(span);
    });
    elScoreBox.appendChild(span);
  }

  /** 이동마다 16칸을 다 읽으면 소음이므로 요약만 전한다. */
  function announce() {
    var msg;
    if (state.over) {
      msg = '게임 종료. 최종 점수 ' + state.score + '점';
    } else if (state.won && !state.keepPlaying) {
      msg = '2048 달성. 현재 점수 ' + state.score + '점';
    } else {
      msg = '점수 ' + state.score + '점, 빈 칸 ' + emptyCount() + '개';
    }
    elLive.textContent = msg;
  }

  function showOverlay(mode) {
    overlayMode = mode;
    if (mode === 'win') {
      elOverlayTitle.textContent = '2048 달성!';
      elOverlayDesc.textContent = '현재 점수 ' + state.score + '점';
      elOverlayRecord.hidden = true;
      elOverlayPrimary.textContent = '계속하기';
      elOverlayPrimary.disabled = false;
    } else {
      elOverlayTitle.textContent = '더 이상 움직일 수 없습니다';
      elOverlayDesc.textContent = '최종 점수 ' + state.score + '점';
      elOverlayRecord.hidden = !state.newRecord;
      elOverlayPrimary.textContent = '되돌리기';
      // 게임 오버에서도 되돌리기를 허용한다 — 마지막 실수 복구가 가장 필요한 순간이다.
      elOverlayPrimary.disabled = (state.snapshot === null);
    }
    elOverlay.hidden = false;
    // 키보드 사용자가 Tab을 헤매지 않도록 주 버튼으로 포커스를 옮긴다.
    (elOverlayPrimary.disabled ? elOverlayNew : elOverlayPrimary).focus();
  }

  function hideOverlay() {
    overlayMode = null;
    elOverlay.hidden = true;
  }

  /* ────────────────────────────────────────────────────────
     게임 흐름
     ──────────────────────────────────────────────────────── */

  function newGame() {
    var i;
    state.grid = [];
    for (i = 0; i < CELL_COUNT; i++) state.grid.push(0);
    state.score = 0;
    state.won = false;
    state.keepPlaying = false;
    state.over = false;
    state.newRecord = false;
    state.snapshot = null; // 새 게임은 스냅샷을 비운다.

    spawnTile();
    spawnTile();

    hideOverlay();
    disarmRestart();
    render(-1, []);
    announce();
  }

  function handleMove(dir) {
    if (state.over) return;
    if (!elOverlay.hidden) return; // 오버레이가 떠 있는 동안 이동은 무시한다.

    // 이동 "전" 상태를 담아둔다. 실제로 변했을 때만 스냅샷으로 채택한다.
    var snap = {
      grid: state.grid.slice(),
      score: state.score,
      won: state.won,
      keepPlaying: state.keepPlaying
    };

    var res = move(dir);

    // ★ 무효 이동: 타일도 만들지 않고 스냅샷도 남기지 않는다.
    //   여기서 타일을 만들면 벽에 대고 입력하는 것만으로 판이 채워져 죽는다.
    if (!res.changed) return;

    state.snapshot = snap;
    state.score += res.gainedTotal;
    if (state.score > state.best) {
      state.best = state.score;
      state.newRecord = true;
      safeStorage.set(CONFIG.STORAGE_KEY, String(state.best)); // 갱신될 때만 쓴다.
    }

    var newIndex = spawnTile();

    var pending = null;
    if (!state.won && hasWinTile()) {
      state.won = true; // won 플래그로 1회만 발동. 4096, 8192에 다시 뜨면 안 된다.
      pending = 'win';
    }
    // 판정은 새 타일 생성 "직후"에 한다. 생성 전에 보면 마지막 빈 칸이 채워진 경우를 놓친다.
    if (!hasMove()) {
      state.over = true;
      pending = 'over';
    }

    render(newIndex, res.mergedBoardIndices);
    showScoreFloat(res.gainedTotal);
    announce();
    if (pending) showOverlay(pending);
  }

  function undo() {
    if (!state.snapshot) return;
    state.grid = state.snapshot.grid.slice();
    state.score = state.snapshot.score;
    state.won = state.snapshot.won;
    state.keepPlaying = state.snapshot.keepPlaying;
    state.over = false;
    state.snapshot = null; // 연속 undo는 없다 — 시행착오로 최적해를 찾는 치트를 막는다.

    hideOverlay();
    render(-1, []);
    announce();
    focusGame();
  }

  function keepPlaying() {
    state.keepPlaying = true;
    hideOverlay();
    announce();
    focusGame();
  }

  /* 다시 시작 — confirm()은 iframe 안에서 부모 페이지까지 블로킹하므로 쓰지 않고,
     버튼 라벨이 바뀌는 인라인 확인 상태를 쓴다. */
  var restartArmed = false;
  var restartTimer = null;

  function disarmRestart() {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    restartArmed = false;
    if (elRestart) {
      elRestart.textContent = '새 게임';
      elRestart.classList.remove('is-armed');
    }
  }

  function onRestartClick() {
    if (state.score > 0 && !restartArmed) {
      restartArmed = true;
      elRestart.textContent = '정말 새 게임?';
      elRestart.classList.add('is-armed');
      restartTimer = setTimeout(disarmRestart, 3000);
      return;
    }
    newGame();
    focusGame();
  }

  /* ────────────────────────────────────────────────────────
     입력 계층
     ──────────────────────────────────────────────────────── */
  var KEY_DIRS = {
    arrowleft: 'left', arrowright: 'right', arrowup: 'up', arrowdown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down'
  };

  function focusGame() {
    // preventScroll: 포커스를 옮기다가 부모 페이지가 게임 위치로 튀는 것을 막는다.
    elGame.focus({ preventScroll: true });
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var key = typeof e.key === 'string' ? e.key.toLowerCase() : '';
    var dir = KEY_DIRS[key];
    if (!dir) return; // 방향키가 아니면 preventDefault를 걸지 않는다(Tab 이동 보존).

    // 방향키를 처리했으면 반드시 막는다. 그러지 않으면 iframe 문서가 스크롤되어 판이 흔들린다.
    e.preventDefault();
    handleMove(dir);
  }

  /* 포인터(스와이프) — 터치·펜·마우스를 한 코드로 처리한다. */
  var activePointerId = null;
  var startX = 0, startY = 0;

  function onPointerDown(e) {
    if (activePointerId !== null) return; // 멀티터치는 첫 포인터만 추적한다.
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    try {
      board.setPointerCapture(e.pointerId); // 손가락이 보드 밖으로 나가도 up을 받는다.
    } catch (err) {
      /* 캡처 실패는 치명적이지 않다. 그대로 진행한다. */
    }
    focusGame();
  }

  function onPointerUp(e) {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;

    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    var threshold = Math.max(CONFIG.SWIPE_MIN_PX, board.clientWidth * CONFIG.SWIPE_RATIO);

    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return; // 탭이지 스와이프가 아니다.

    // 대각선도 더 큰 성분으로 확정 해석한다 — "아무 일도 안 일어나는" 답답함이 없다.
    var dir;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
    else dir = dy > 0 ? 'down' : 'up';

    handleMove(dir);
  }

  function onPointerCancel() {
    activePointerId = null;
  }

  /* ────────────────────────────────────────────────────────
     부팅
     ──────────────────────────────────────────────────────── */
  function applyThemeParam() {
    // 임베드 측이 ?theme=dark 로 테마를 명시할 수 있다.
    // 지정이 없으면 CSS의 prefers-color-scheme가 알아서 대응한다.
    var theme;
    try {
      theme = new URLSearchParams(window.location.search).get('theme');
    } catch (e) {
      theme = null;
    }
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  function init() {
    elGame = document.getElementById('game');
    board = document.getElementById('board');
    elScore = document.getElementById('score');
    elBest = document.getElementById('best');
    elScoreBox = document.getElementById('score-box');
    elUndo = document.getElementById('undo');
    elRestart = document.getElementById('restart');
    elOverlay = document.getElementById('overlay');
    elOverlayTitle = document.getElementById('overlay-title');
    elOverlayDesc = document.getElementById('overlay-desc');
    elOverlayRecord = document.getElementById('overlay-record');
    elOverlayPrimary = document.getElementById('overlay-primary');
    elOverlayNew = document.getElementById('overlay-new');
    elLive = document.getElementById('live');

    applyThemeParam();

    try {
      reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      reduceMotion = false;
    }

    buildBoard();
    state.best = readBest();

    elGame.addEventListener('keydown', onKeyDown);
    // focus/blur는 버블링하지 않아 되돌리기 버튼으로 Tab하면 안내가 잘못 뜬다.
    // focusin/focusout은 자손 포커스까지 포함하므로 "게임에 포커스가 있다"는 상태와 정확히 맞는다.
    elGame.addEventListener('focusin', function () {
      elGame.setAttribute('data-focused', 'true');
    });
    elGame.addEventListener('focusout', function () {
      elGame.removeAttribute('data-focused');
    });

    board.addEventListener('pointerdown', onPointerDown);
    board.addEventListener('pointerup', onPointerUp);
    board.addEventListener('pointercancel', onPointerCancel);
    // 2차 스크롤 방어: touch-action을 모르는 구형 브라우저 대비.
    // 보드에만 붙인다 — 문서 전체에 붙이면 점수판·버튼 주변 스크롤까지 죽는다.
    board.addEventListener('touchmove', function (e) {
      e.preventDefault();
    }, { passive: false });

    elUndo.addEventListener('click', undo);
    elRestart.addEventListener('click', onRestartClick);
    elOverlayPrimary.addEventListener('click', function () {
      if (overlayMode === 'win') keepPlaying();
      else undo();
    });
    elOverlayNew.addEventListener('click', function () {
      newGame();
      focusGame();
    });

    newGame();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* 디버그 전용 — Review 단계에서 콘솔로 순수 함수를 직접 검증하기 위한 통로다.
     게임 로직은 이 객체를 사용하지 않는다. */
  window.__2048 = {
    collapse: collapse,
    lineIndices: lineIndices,
    getState: function () {
      return {
        grid: state.grid.slice(),
        score: state.score,
        best: state.best,
        won: state.won,
        keepPlaying: state.keepPlaying,
        over: state.over,
        hasSnapshot: state.snapshot !== null
      };
    }
  };
})();
