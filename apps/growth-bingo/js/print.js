/* ============================================================
   성장 빙고 — 인쇄용 판 그리기
   board-data.js만 읽는다(앱의 저장 기록은 읽지 않는다: 종이 판은 빈 판이다).
   쿼리: ?start=YYYY-MM-DD  날짜·주차별 기간을 인쇄
         ?detail=1          3장(칸별 기준표) 붙이기
         ?guide=1           스티커가 가장 적은 조합의 줄 번호에 표시
   ============================================================ */
(function () {
  'use strict';

  var board = window.GrowthBingo && window.GrowthBingo.board;
  var root = document.getElementById('sheets');
  if (!board || !board.selfCheck.ok) {
    root.innerHTML = '<p>판 데이터를 읽지 못했습니다.</p>';
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var start = /^\d{4}-\d{2}-\d{2}$/.test(params.get('start') || '') ? params.get('start') : '';
  var detail = params.get('detail') === '1';
  var guide = params.get('guide') === '1';

  /* "스티커가 가장 적은 조합 중 하나": 가로1·2·3 + 세로2·3·4 + 대각 ↙ (spec 3-4절) */
  var GUIDE_LINES = ['r1', 'r2', 'r3', 'c2', 'c3', 'c4', 'd2'];
  var DIGITS = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];

  function h(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* 시작일에서 n일차의 날짜. 연·월·일만 쓰고 UTC로 더해 서머타임에 흔들리지 않게 한다. */
  function dayText(day) {
    if (!start) return '';
    var p = start.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + day - 1));
    return (d.getUTCMonth() + 1) + '/' + d.getUTCDate();
  }
  function dayLong(day) {
    if (!start) return '';
    var p = start.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + day - 1));
    return d.getUTCFullYear() + '년 ' + (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일';
  }

  var KIND = { repeat: '반복', level: '레벨', fixed: '주차 고정', once: '1회' };
  function badge(cell) {
    if (cell.kind === 'level') return 'L' + cell.level;
    if (cell.kind === 'fixed') return Math.ceil(cell.window.from / 7) + '주';
    if (cell.weekly) return '주1';
    return '';
  }
  function kindText(cell) {
    var t = KIND[cell.kind];
    if (cell.kind === 'level') t = '레벨 ' + cell.level;
    if (cell.kind === 'fixed') t = '주차 고정';
    if (cell.weekly) t += ' · 주 1회';
    return t;
  }

  function cellHtml(cell) {
    var boxes = '';
    var i;
    for (i = 0; i < cell.boxes; i++) {
      boxes += '<span class="pbx">' + (cell.boxLabels ? h(cell.boxLabels[i].replace('km', '')) : '') + '</span>';
    }
    var b = badge(cell);
    return '<div class="pc a-' + cell.area + '">' +
      '<span class="corner-tri"></span>' +
      '<div class="top"><span class="mk">' + h(board.areas[cell.area].mark) + '</span>' + (b ? '<span class="bd">' + h(b) + '</span>' : '<span></span>') + '</div>' +
      '<div class="nm">' + h(cell.title) + (cell.boxLabels ? '<small>단위 km. 네모의 거리 이하로</small>' : '') + '</div>' +
      '<div class="bxs">' + boxes + '</div></div>';
  }

  function headHtml(lineId, glyph, cls) {
    var mark = guide && GUIDE_LINES.indexOf(lineId) >= 0 ? '<span class="gm">길</span>' : '';
    return '<div class="ph' + (cls ? ' ' + cls : '') + '">' + glyph + mark + '</div>';
  }

  function page1() {
    var byPos = {};
    board.cells.forEach(function (c) { byPos[c.row + '-' + c.col] = c; });
    var out = '<section class="sheet" aria-label="1장 판">';
    out += '<h1>성장 빙고 — 5주 7빙고</h1>';
    out += '<p class="sub">영어 · 체력 · AI 세 영역을 섞은 7×7 빙고. 칸의 네모를 스티커로 채우고, 가족이 도장을 찍어야 확정됩니다. 가로·세로·대각선 16줄 중 7줄을 완성하세요.</p>';
    out += '<div class="fields"><span>이름:</span><span class="short">시작일: ' + (start ? h(dayLong(1)) : '') + '</span><span class="short">종료일: ' + (start ? h(dayLong(35)) : '') + '</span></div>';
    out += '<div class="pboard" role="table" aria-label="7×7 빙고판">';
    out += headHtml('d1', '↘', 'corner');
    var c, r;
    for (c = 1; c <= 7; c++) out += headHtml('c' + c, DIGITS[c - 1]);
    for (r = 1; r <= 7; r++) {
      out += headHtml('r' + r, DIGITS[r - 1], 'row');
      for (c = 1; c <= 7; c++) out += cellHtml(byPos[r + '-' + c]);
    }
    /* 대각선 ↙의 머리표: 판 아래에 한 줄로 둔다 */
    out += '<div class="ph diag-foot">↙ <span class="gm-txt">대각선(오른쪽 위에서 왼쪽 아래로)</span>' + (guide ? '<span class="gm">길</span>' : '') + '</div>';
    out += '</div>';
    out += '<div class="legend"><span><i style="background:#000"></i>영 영어</span>' +
      '<span><i style="background:repeating-linear-gradient(135deg,#000 0 1px,#fff 1px 2px)"></i>체 체력</span>' +
      '<span><i style="background:radial-gradient(circle,#000 0.6px,#fff 0.8px) 0 0/2.4px 2.4px"></i>AI</span>' +
      '<span><i style="border:1.5px double #000;background:#fff"></i>가 가족 (가운데)</span>' +
      '<span>L = 레벨 칸(앞 레벨 도장 필요)</span><span>1주·3주·5주 = 주차 고정(2장 기간표)</span><span>주1 = 한 주에 1개</span>' +
      (guide ? '<span>길 = 스티커가 가장 적은 7줄 중 하나(가로 ①②③ + 세로 ②③④ + 대각 ↙)</span>' : '') + '</div>';
    out += '<div class="rewards">' + board.rules.REWARD_LINES.map(function (n) {
      return '<div class="reward"><b>' + n + '빙고 보상</b><span>&nbsp;</span></div>';
    }).join('') + '</div>';
    out += '</section>';
    return out;
  }

  function page2() {
    var R = board.rules;
    var out = '<section class="sheet" aria-label="2장 규칙">';
    out += '<h1>규칙</h1>';
    out += '<p class="sub"><b>하루에 스티커 ' + R.DAILY_CAP + '개까지 · 한 영역은 하루 ' + R.AREA_DAILY_CAP + '개까지 · 가족이 도장을 찍어야 확정</b></p>';
    out += '<div class="care"><b>아프면 멈춥니다.</b> 통증이 있으면 그 운동을 중단하고 그날은 쉬는 날이나 스트레칭 칸으로 바꿉니다. 통증이 이어지면 전문가와 상의하세요. 다쳐서 어떤 체력 칸을 못 하게 되면 가족과 상의해 <b>대체 미션</b>(예: 턱걸이 대신 걷기 20분)으로 도장을 받을 수 있습니다. 운동 내용(세트 수, 거리 등)은 일반적인 안전 원칙 수준의 예시이며 개인 처방이 아닙니다.</div>';
    out += '<ol class="rules-list">' +
      '<li><b>기간은 35일(5주).</b> 시작일이 1일차, 7일씩 1~5주차입니다.</li>' +
      '<li><b>목표는 7빙고.</b> 16줄 중 7줄의 칸을 모두 완성합니다. 3빙고·5빙고에도 작은 보상이 있습니다.</li>' +
      '<li><b>칸에는 네모가 1~5개.</b> 한 번 할 때마다 스티커 1개. 네모를 다 채우면 그 칸이 완성됩니다.</li>' +
      '<li><b>스티커는 가족이 도장을 찍어야 확정.</b> 한 날이나 그다음 날까지 도장을 받지 못하면 다시 해야 합니다.</li>' +
      '<li><b>하루 합쳐 ' + R.DAILY_CAP + '개, 한 영역은 하루 ' + R.AREA_DAILY_CAP + '개.</b> 기본 속도는 영어·체력·AI 하나씩 하루 3개이고 4번째는 밀린 날 만회용입니다. 가족 칸은 영역에 속하지 않지만 하루 ' + R.DAILY_CAP + '개에는 들어갑니다.</li>' +
      '<li><b>같은 칸은 하루 1개.</b></li>' +
      '<li><b>레벨 칸(사다리)</b>은 앞 레벨에 도장이 다 찍혀야 다음 레벨이 열리고, 사다리 하나에서 하루에 한 계단만 오릅니다.</li>' +
      '<li><b>주차 고정 칸</b>은 아래 표의 기간에만 인증할 수 있습니다.</li>' +
      '<li><b>1회 칸</b>은 언제든 한 번. <b>주 1회 칸</b>(가족 보고회, 쉬는 날)은 한 주에 1개만 받을 수 있습니다(5주 중 4번이면 완성).</li>' +
      '<li><b>근력 칸은 하루 1개</b>, 같은 부위는 이틀 연속 하지 않습니다(턱걸이=당기기, 푸시업=밀기, 스쿼트·런지=하체, 덤벨=당기기+밀기).</li>' +
      '<li><b>달리기와 트레일은 하루에 하나, 이틀 연속 금지.</b> 달리기 네모에 적힌 거리(3·3·5·5·7km)는 그날의 상한입니다.</li>' +
      '<li><b>쉬는 날 칸은 근력·유산소 칸을 하지 않은 날에만</b> 받을 수 있습니다.</li>' +
      '</ol>';

    out += '<h2>주차 고정 칸 기간표</h2><table><thead><tr><th>칸</th><th>기간</th>' + (start ? '<th>날짜</th>' : '') + '</tr></thead><tbody>';
    board.cells.filter(function (c) { return c.kind === 'fixed'; })
      .sort(function (a, b) { return a.window.from - b.window.from || (a.row - b.row); })
      .forEach(function (c) {
        out += '<tr><td>' + h(board.areas[c.area].name) + ' · ' + h(c.title) + '</td><td class="nowrap">' + c.window.from + '~' + c.window.to + '일차</td>' +
          (start ? '<td class="nowrap">' + h(dayText(c.window.from)) + ' ~ ' + h(dayText(c.window.to)) + '</td>' : '') + '</tr>';
      });
    out += '</tbody></table>';

    out += '<h2>주차별 날짜</h2><table><thead><tr><th>주차</th><th>일차</th><th>날짜</th></tr></thead><tbody>';
    var w;
    for (w = 1; w <= 5; w++) {
      out += '<tr><td>' + w + '주차</td><td>' + ((w - 1) * 7 + 1) + '~' + (w * 7) + '일차</td><td>' +
        (start ? h(dayText((w - 1) * 7 + 1)) + ' ~ ' + h(dayText(w * 7)) : '&nbsp;&nbsp;&nbsp;월 &nbsp;&nbsp;일 ~ &nbsp;&nbsp;&nbsp;월 &nbsp;&nbsp;일') + '</td></tr>';
    }
    out += '</tbody></table>';

    out += '<div class="promise"><b>가족 도장 약속</b><br>나는 인증을 가족에게 정직하게 보여 주고, 가족이 보고 도장을 찍은 스티커만 내 스티커로 인정합니다. 가족은 인증을 직접 확인한 뒤에 도장을 찍습니다.' +
      '<div class="sign"><span>본인 서명</span><span>가족 서명</span><span>날짜</span></div></div>';
    out += '</section>';
    return out;
  }

  function page3() {
    var out = '<section class="sheet" aria-label="3장 칸별 기준표">';
    out += '<h1>칸별 기준표</h1><p class="sub">스티커 1개를 붙이는 기준과, 가족이 도장을 찍을 때 보는 것입니다.</p>';
    out += '<table class="detail-table"><thead><tr><th>위치</th><th>칸</th><th>네모</th><th>한 번의 기준</th><th>가족이 보는 것</th></tr></thead><tbody>';
    board.cells.slice().sort(function (a, b) { return a.row - b.row || a.col - b.col; }).forEach(function (c) {
      out += '<tr><td>' + c.row + '-' + c.col + '</td><td><b>' + h(board.areas[c.area].mark) + '</b> ' + h(c.title) + '<br><small>' + h(kindText(c)) + '</small></td><td>' + c.boxes + '</td><td>' + h(c.unit) + '</td><td>' + h(c.verify) + '</td></tr>';
    });
    out += '</tbody></table></section>';
    return out;
  }

  function render() {
    root.innerHTML = page1() + page2() + (detail ? page3() : '');
  }

  /* 화면 위쪽 옵션: 값을 바꾸면 주소를 고쳐 다시 그린다. */
  function bind() {
    var s = document.getElementById('opt-start');
    var d = document.getElementById('opt-detail');
    var g = document.getElementById('opt-guide');
    s.value = start; d.checked = detail; g.checked = guide;
    function apply() {
      var q = new URLSearchParams();
      if (s.value) q.set('start', s.value);
      if (d.checked) q.set('detail', '1');
      if (g.checked) q.set('guide', '1');
      start = s.value || ''; detail = d.checked; guide = g.checked;
      try { window.history.replaceState(null, '', window.location.pathname + (q.toString() ? '?' + q.toString() : '')); } catch (e) { /* 주소를 못 바꿔도 화면은 바뀐다 */ }
      render();
    }
    s.addEventListener('change', apply);
    d.addEventListener('change', apply);
    g.addEventListener('change', apply);
    document.getElementById('do-print').addEventListener('click', function () { window.print(); });
  }

  render();
  bind();
})();
