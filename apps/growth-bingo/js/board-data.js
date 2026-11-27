/* ============================================================
   성장 빙고 — 판 데이터 (순수 데이터)

   DOM, localStorage, 시계, 난수를 쓰지 않는다. Node에서 require로도 읽힌다.
   규칙(rules.js)은 여기 적힌 칸의 "속성"만 보고 판정하므로,
   판을 다른 시즌 판으로 갈아 끼워도 규칙 코드는 그대로다.

   ※ 네모 수·칸 위치를 바꾸면 균형(spec 3-4절)이 달라진다.
     바꿀 때는 tests/balance.test.js의 기대값을 함께 고칠 것.
   ============================================================ */
(function () {
  'use strict';

  var GB = (typeof window !== 'undefined')
    ? (window.GrowthBingo = window.GrowthBingo || {})
    : {};

  var SIZE = 7;

  /* 칸 한 개를 만든다. 속성은 spec 11절의 목록 그대로. */
  function c(id, row, col, area, kind, title, short, boxes, unit, verify, extra) {
    var cell = {
      id: id, row: row, col: col, area: area, kind: kind,
      title: title, short: short, boxes: boxes, unit: unit, verify: verify
    };
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) cell[k] = extra[k];
      }
    }
    return cell;
  }

  var cells = [
    /* ── 1행 ── */
    c('A-LV5', 1, 1, 'ai', 'level', '미니 프로젝트 ⑤ 배포', '프5', 1,
      '완성한 미니 프로젝트를 다른 사람이 열 수 있게 공개하고 가족에게 1분 시연한다',
      '가족 휴대폰에서 주소(또는 공유 파일)가 열리는지', { ladder: 'ai', level: 5 }),
    c('E-LISTEN-B', 1, 2, 'en', 'repeat', '팟캐스트 듣기', '듣기B', 3,
      '비즈니스·기술 영어 팟캐스트를 10분 이상 듣고 내용을 우리말 한 줄로 적는다',
      '재생 기록 화면 + 메모 한 줄'),
    c('F-LV3', 1, 3, 'fit', 'level', '턱걸이 ③ 밴드 어시스트', '턱3', 2,
      '밴드나 발 받침의 도움을 받는 턱걸이 3세트. 세트마다 2~3개 더 할 수 있을 때 멈춘다',
      '한 세트 영상 또는 직접 봄', { ladder: 'fit', level: 3, strength: true, parts: ['pull'] }),
    c('F-PUSH', 1, 4, 'fit', 'repeat', '푸시업', '푸시', 3,
      '푸시업 3세트(무릎을 대도 인정). 자세가 무너지기 전에 멈춘다',
      '세트별 개수 메모 또는 영상', { strength: true, parts: ['push'] }),
    c('A-NEWTOOL', 1, 5, 'ai', 'repeat', '새 도구·기능 써 보기', '새도구', 4,
      '처음 써 보는 AI 도구나 기능 하나를 20분 이상 써 보고 "쓸 만한 점 · 아쉬운 점"을 2줄 적는다',
      '결과물 화면 + 메모 2줄'),
    c('E-W5', 1, 6, 'en', 'fixed', '3분 발표 녹음·비교', '끝녹음', 1,
      '3분 영어 발표를 녹음하고, 1주차 기준 녹음과 이어 들은 뒤 달라진 점 3가지를 적는다 (기준 녹음이 없으면 가장 오래된 사다리 녹음과 비교)',
      '녹음 2개의 날짜 + 달라진 점 3줄', { window: { from: 29, to: 35 } }),
    c('F-TRAIL', 1, 7, 'fit', 'repeat', '트레일·둘레길', '트레일', 2,
      '흙길·둘레길을 1시간 안팎 걷거나 가볍게 뛴다. 숨이 차도 대화가 되는 강도로',
      '운동 앱 경로 기록 또는 현장 사진', { cardio: true, impact: true }),

    /* ── 2행 ── */
    c('A-LV3', 2, 1, 'ai', 'level', '미니 프로젝트 ③ 구현', '프3', 3,
      '설계대로 30분 이상 구현하고 "오늘 된 것"을 한 줄 적는다',
      '바뀐 화면 또는 작업 기록', { ladder: 'ai', level: 3 }),
    c('A-ENG', 2, 2, 'ai', 'repeat', '영어로 AI 하기', '영어AI', 3,
      '영어 기술 영상·문서를 15분 보거나, 프롬프트를 영어로만 써서 15분 작업한다',
      '시청 기록 또는 영어 프롬프트 화면'),
    c('F-DB', 2, 3, 'fit', 'repeat', '덤벨 상체', '덤벨', 3,
      '덤벨 로우·프레스 등 상체 3종목을 2~3세트씩. 가벼운 무게에서 시작한다',
      '종목·무게·횟수 메모', { strength: true, parts: ['pull', 'push'] }),
    c('E-READ-B', 2, 4, 'en', 'repeat', '업무 문서 50문장 읽기', '읽기B', 4,
      '실적 보고서·업계 리포트·업무 메일 원문 50문장을 읽고 쓸 만한 표현 3개를 표현 노트에 적는다',
      '읽은 문서 + 표현 노트 3줄'),
    c('F-W1', 2, 5, 'fit', 'fixed', '시작 기록', '시작', 1,
      '정면·옆 사진, 매달리기 버틴 시간(또는 턱걸이 최대 개수), 푸시업 최대 개수를 적어 둔다',
      '기록 메모 (사진은 본인 보관, 찍었다는 것만 확인)', { window: { from: 1, to: 10 } }),
    c('A-TIP', 2, 6, 'ai', 'repeat', '팀에 팁 공유', '팁', 4,
      '직접 써 본 AI 활용 팁 하나를 팀 메신저나 회의에서 공유한다 (3줄 이상 또는 화면 1장)',
      '보낸 메시지 화면'),
    c('E-LV1', 2, 7, 'en', 'level', '발표 ① 1분·원고 보고', '발표1', 2,
      '업무 주제 1분 스피치 원고를 쓰고, 보면서 읽어 녹음한다',
      '녹음(1분 안팎) + 원고', { ladder: 'en', level: 1 }),

    /* ── 3행 ── */
    c('F-W3', 3, 1, 'fit', 'fixed', '중간 기록', '중간', 1,
      '시작 기록과 같은 항목을 다시 재고 한 줄 소감을 적는다',
      '기록 메모', { window: { from: 15, to: 24 } }),
    c('E-LV2', 3, 2, 'en', 'level', '발표 ② 1분·메모만', '발표2', 2,
      '키워드 3줄 메모만 보고 1분 스피치를 녹음한다',
      '녹음 + 키워드 메모', { ladder: 'en', level: 2 }),
    c('E-SHADOW', 3, 3, 'en', 'repeat', '쉐도잉', '쉐도잉', 3,
      '원어민 음성(발표·뉴스)을 10분 동안 따라 말한다',
      '마지막 1분 녹음 또는 가족이 직접 들음'),
    c('A-AUTO', 3, 4, 'ai', 'repeat', '업무 자동화', '자동화', 4,
      '반복 업무 하나를 골라 AI로 자동화하는 작업을 30분 한다 (같은 주제를 이어 가도 된다)',
      '만든 프롬프트·스크립트·결과 화면'),
    c('A-DECK', 3, 5, 'ai', 'once', '발표 자료 5장', '자료', 1,
      '"AI를 우리 팀 일에 쓰는 법"을 5장짜리 발표 자료로 만든다',
      '자료 5장'),
    c('F-LV4', 3, 6, 'fit', 'level', '턱걸이 ④ 네거티브', '턱4', 2,
      '위에서 천천히 내려오는 턱걸이 3세트, 세트당 3회 안팎',
      '한 세트 영상 또는 직접 봄', { ladder: 'fit', level: 4, strength: true, parts: ['pull'] }),
    c('E-RECALL', 3, 7, 'en', 'repeat', '어제 문장 다시 말하기', '암기', 3,
      '전날 읽거나 들은 문장 5개를 보지 않고 말한다 (표현 노트에서 고른다)',
      '가족이 노트를 들고 5문장을 확인'),

    /* ── 4행 ── */
    c('E-LV4', 4, 1, 'en', 'level', '발표 ④ 3분 + 질문', '발표4', 1,
      '3분 발표를 녹음하고, AI가 던진 질문 2개에 바로 답한다',
      '녹음 + AI 질문·답 기록', { ladder: 'en', level: 4 }),
    c('F-SWIM', 4, 2, 'fit', 'repeat', '수영', '수영', 3,
      '수영 30분 (쉬는 시간 포함)',
      '입장 기록 또는 운동 앱 기록', { cardio: true }),
    c('A-W1', 4, 3, 'ai', 'fixed', '5주 목표 선언', '선언', 1,
      '"5주 뒤 팀에 보여 줄 것" 한 문단과 미니 프로젝트 후보 3개를 적어 가족에게 설명한다',
      '적은 글을 가족이 읽음', { window: { from: 1, to: 10 } }),
    c('G-FAMILY', 4, 4, 'family', 'repeat', '가족 보고회', '가족', 4,
      '가족에게 빙고판을 보여 주며 한 주를 3분 동안 설명하고, 가족이 고른 "함께하기"(산책·보드게임·요리 등)를 30분 한다',
      '함께했으면 도장', { weekly: true }),
    c('F-LV2', 4, 5, 'fit', 'level', '턱걸이 ② 견갑 풀업', '턱2', 2,
      '매달려 팔은 편 채 어깨뼈만 당겼다 푸는 동작 3세트',
      '한 세트 영상 또는 직접 봄', { ladder: 'fit', level: 2, strength: true, parts: ['pull'] }),
    c('E-REAL', 4, 6, 'en', 'once', '실전 영어', '실전', 1,
      '실제 회의에서 영어로 한 번 발언한다. 기회가 없으면 업무 문서 1쪽을 영어로 요약해 동료에게 보낸다',
      '회의 일정·메모 또는 보낸 요약문'),
    c('A-MYAPP', 4, 7, 'ai', 'repeat', '내 앱 고치기', '내앱', 4,
      '내가 만든 앱의 기능 하나를 30분 이상 고치거나 더한다',
      '바뀌기 전후 화면'),

    /* ── 5행 ── */
    c('A-FOLLOW', 5, 1, 'ai', 'repeat', '따라 만들기', '따라', 4,
      '강의·튜토리얼을 보며 30분 이상 직접 따라 만든다',
      '따라 만든 결과 화면'),
    c('F-W5', 5, 2, 'fit', 'fixed', '종료 기록', '종료', 1,
      '시작 기록과 같은 항목을 재고 시작·종료를 나란히 비교한다',
      '비교 메모 (사진은 본인 보관)', { window: { from: 29, to: 35 } }),
    c('E-READ-A', 5, 3, 'en', 'repeat', '비즈니스 기사 50문장 읽기', '읽기A', 4,
      '영어 비즈니스 기사·칼럼 50문장을 읽고 표현 3개를 표현 노트에 적는다',
      '읽은 글 + 표현 노트 3줄'),
    c('A-LV1', 5, 4, 'ai', 'level', '미니 프로젝트 ① 아이디어', '프1', 1,
      '누가 어떤 불편을 겪는지, 무엇을 만들지 한 줄로 정의하고 꼭 필요한 기능 3개를 적는다',
      '적은 메모', { ladder: 'ai', level: 1 }),
    c('E-LISTEN-A', 5, 5, 'en', 'repeat', '실적 발표·강연 듣기', '듣기A', 4,
      '실적 발표(어닝콜)나 강연을 10분 이상 듣고 핵심 한 줄과 들린 표현 2개를 적는다',
      '재생 기록 + 메모'),
    c('A-LV2', 5, 6, 'ai', 'level', '미니 프로젝트 ② 설계', '프2', 2,
      '화면·기능·파일 구조를 정리하는 설계 작업 30분 (두 번에 걸쳐 1쪽을 완성)',
      '설계 문서', { ladder: 'ai', level: 2 }),
    c('F-LV5', 5, 7, 'fit', 'level', '턱걸이 ⑤ 맨몸 도전', '턱5', 1,
      '충분히 몸을 푼 뒤 맨몸 턱걸이 최대 개수를 재서 적는다. 0개여도 시도와 기록으로 인정',
      '영상 또는 직접 봄 + 기록', { ladder: 'fit', level: 5, strength: true, parts: ['pull'] }),

    /* ── 6행 ── */
    c('E-ROLE', 6, 1, 'en', 'repeat', 'AI 롤플레이', '롤플', 3,
      'AI와 회의·보고·협상 상황극을 영어로 10분 한다 (음성 권장)',
      '대화 기록 화면'),
    c('E-WRITE', 6, 2, 'en', 'repeat', '이메일 쓰고 첨삭', '메일', 3,
      '업무 이메일·메신저 3~5문장을 쓰고, AI 첨삭을 받아 고쳐 쓴다',
      '처음 글 · 첨삭 · 고친 글'),
    c('A-BLOG', 6, 3, 'ai', 'repeat', '블로그 글', '글', 2,
      '배운 것을 블로그 글 1편으로 써서 올린다',
      '올린 글'),
    c('F-LV1', 6, 4, 'fit', 'level', '턱걸이 ① 매달리기', '턱1', 2,
      '철봉에 매달려 편안히 버틸 수 있는 만큼 3세트',
      '버틴 시간 메모 또는 직접 봄', { ladder: 'fit', level: 1, strength: true, parts: ['pull'] }),
    c('F-LEGS', 6, 5, 'fit', 'repeat', '스쿼트·런지', '하체', 3,
      '스쿼트와 런지를 2~3세트씩 (맨몸 또는 덤벨)',
      '세트·횟수 메모', { strength: true, parts: ['legs'] }),
    c('F-REST', 6, 6, 'fit', 'repeat', '쉬는 날', '쉼', 4,
      '근력·유산소 칸을 하지 않고 쉰 날. 가벼운 산책과 스트레칭은 해도 된다',
      '그날 근력·유산소 칸이 비어 있는지', { weekly: true, rest: true }),
    c('A-W5', 6, 7, 'ai', 'fixed', '5주 회고', '회고', 1,
      '만든 것 · 배운 것 · 팀에 적용할 것 3가지를 회고 글로 정리한다',
      '회고 글', { window: { from: 29, to: 35 } }),

    /* ── 7행 ── */
    c('F-RUN', 7, 1, 'fit', 'repeat', '달리기 거리 늘리기', '달리기', 5,
      '네모에 적힌 거리 이하로 20분 이상 달린다. 네모 순서: 3km · 3km · 5km · 5km · 7km. 걷기를 섞거나 더 짧게 뛰어도 인정',
      '러닝 앱 기록', { boxLabels: ['3km', '3km', '5km', '5km', '7km'], cardio: true, impact: true }),
    c('A-APPLY', 7, 2, 'ai', 'once', '자동화 실전 적용', '적용', 1,
      '만든 자동화를 실제 업무에 한 번 쓰고 아낀 시간을 한 줄 적는다',
      '적용 결과 화면 + 메모'),
    c('A-LV4', 7, 3, 'ai', 'level', '미니 프로젝트 ④ 검증', '프4', 2,
      '직접 써 보며 문제 목록을 만들고 고치는 작업 30분 (가족·동료가 써 보면 더 좋다)',
      '문제 목록과 고친 내역', { ladder: 'ai', level: 4 }),
    c('E-W1', 7, 4, 'en', 'fixed', '기준 녹음', '첫녹음', 1,
      '준비 없이 "내 일 소개" 1분 영어 스피치를 녹음해 보관한다',
      '녹음 파일의 날짜', { window: { from: 1, to: 10 } }),
    c('E-LV3', 7, 5, 'en', 'level', '발표 ③ 2분 업무 보고', '발표3', 1,
      '이번 주 업무를 메모만 보고 2분 동안 보고하듯 말해 녹음한다',
      '녹음 + 메모', { ladder: 'en', level: 3 }),
    c('E-PHRASE', 7, 6, 'en', 'repeat', '회의 표현 5종', '회의말', 3,
      '동의 · 반대 · 되묻기 · 요약 · 제안 표현을 종류마다 2문장씩 소리 내어 말한다',
      '가족 앞에서 말하거나 녹음'),
    c('F-STRETCH', 7, 7, 'fit', 'repeat', '스트레칭·가동성', '스트', 4,
      '어깨·고관절·종아리 중심 스트레칭과 가동성 운동 15분',
      '직접 봄 또는 따라 한 영상 화면')
  ];

  var board = {
    id: 'growth-bingo-s1',
    size: SIZE,
    rules: {
      DAYS: 35, GOAL_LINES: 7, REWARD_LINES: [3, 5, 7],
      DAILY_CAP: 4, AREA_DAILY_CAP: 2,
      LADDER_DAILY_CAP: 1, STRENGTH_DAILY_CAP: 1, IMPACT_DAILY_CAP: 1,
      STAMP_GRACE_DAYS: 1, BACKDATE_DAYS: 1
    },
    areas: {
      en: { name: '영어', mark: '영' },
      fit: { name: '체력', mark: '체' },
      ai: { name: 'AI', mark: 'AI' },
      family: { name: '가족', mark: '가' }
    },
    ladders: {
      en: ['E-LV1', 'E-LV2', 'E-LV3', 'E-LV4'],
      fit: ['F-LV1', 'F-LV2', 'F-LV3', 'F-LV4', 'F-LV5'],
      ai: ['A-LV1', 'A-LV2', 'A-LV3', 'A-LV4', 'A-LV5']
    },
    /* 사다리 이름은 화면 문구용이다. */
    ladderNames: { en: '영어 발표', fit: '턱걸이', ai: '미니 프로젝트' },
    cells: cells
  };

  /* 16줄: 가로 7 → 세로 7 → 대각선 2. 이 순서가 조합 번호의 기준이다. */
  function buildLines(b) {
    var byPos = {};
    b.cells.forEach(function (cell) { byPos[cell.row + '-' + cell.col] = cell.id; });
    var lines = [];
    var i, k, ids;
    for (i = 1; i <= b.size; i++) {
      ids = [];
      for (k = 1; k <= b.size; k++) ids.push(byPos[i + '-' + k]);
      lines.push({ id: 'r' + i, type: 'row', no: i, label: '가로 ' + i + '줄', cells: ids });
    }
    for (i = 1; i <= b.size; i++) {
      ids = [];
      for (k = 1; k <= b.size; k++) ids.push(byPos[k + '-' + i]);
      lines.push({ id: 'c' + i, type: 'col', no: i, label: '세로 ' + i + '줄', cells: ids });
    }
    ids = [];
    for (k = 1; k <= b.size; k++) ids.push(byPos[k + '-' + k]);
    lines.push({ id: 'd1', type: 'diag', no: 1, label: '대각선 ↘', cells: ids });
    ids = [];
    for (k = 1; k <= b.size; k++) ids.push(byPos[k + '-' + (b.size + 1 - k)]);
    lines.push({ id: 'd2', type: 'diag', no: 2, label: '대각선 ↙', cells: ids });
    return lines;
  }
  board.lines = buildLines(board);

  /* 판 자체 검사: 49칸, 위치 중복 없음, 16줄 모두 세 영역 2칸 이상.
     결과만 돌려주고, 화면에 알리는 일은 app.js가 한다. */
  function validateBoard(b) {
    var errors = [];
    var ids = {}, pos = {};
    if (b.cells.length !== b.size * b.size) errors.push('칸 수가 ' + b.cells.length + '개입니다 (' + b.size * b.size + '개여야 함)');
    b.cells.forEach(function (cell) {
      if (ids[cell.id]) errors.push('칸 id 중복: ' + cell.id);
      ids[cell.id] = true;
      var p = cell.row + '-' + cell.col;
      if (pos[p]) errors.push('칸 위치 중복: ' + p);
      pos[p] = true;
    });
    var byId = {};
    b.cells.forEach(function (cell) { byId[cell.id] = cell; });
    b.lines.forEach(function (line) {
      var cnt = { en: 0, fit: 0, ai: 0 };
      line.cells.forEach(function (id) {
        var cell = byId[id];
        if (!cell) { errors.push(line.label + ': 없는 칸 ' + id); return; }
        if (cnt[cell.area] !== undefined) cnt[cell.area]++;
      });
      ['en', 'fit', 'ai'].forEach(function (a) {
        if (cnt[a] < 2) errors.push(line.label + ': ' + b.areas[a].name + ' 칸이 ' + cnt[a] + '개 (2개 이상이어야 함)');
      });
    });
    Object.keys(b.ladders).forEach(function (l) {
      b.ladders[l].forEach(function (id, i) {
        var cell = byId[id];
        if (!cell || cell.ladder !== l || cell.level !== i + 1) errors.push('사다리 ' + l + ' ' + (i + 1) + '단이 맞지 않음: ' + id);
      });
    });
    return { ok: errors.length === 0, errors: errors };
  }

  GB.board = board;
  GB.validateBoard = validateBoard;
  board.selfCheck = validateBoard(board);

  if (typeof module !== 'undefined' && module.exports) module.exports = board;
})();
