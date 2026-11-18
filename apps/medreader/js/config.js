/* ============================================================
   MedReader — 상수 모음 (spec 2-3, 4절)

   값만 export 한다. 부작용 없음(spec 3-2 규칙).
   예외: pdf.js URL 조립용 순수 함수 — 버전·CDN 문자열이
   여러 곳에 흩어지는 것을 막기 위한 것이며 상태를 갖지 않는다.
   ============================================================ */

/* ────────────────────────────────────────────────────────
   pdf.js — spec 2-3
   버전은 이 상수 한 곳에만 적는다. 본체와 worker URL을
   같은 상수에서 조립해야 버전 불일치 예외가 생기지 않는다.
   ──────────────────────────────────────────────────────── */

// 고정 기준은 "가장 최신"이 아니라 "목표 기기에서 도는 가장 최신"이다(spec 2-3·18).
// 6.3.289 는 Map.prototype.getOrInsertComputed(TC39 Stage 3)를 17곳에서 호출해
// 사용자 데스크톱 Chrome 에서 로드 즉시 TypeError 로 죽었다(2026-09-18 실측).
// 5.4.149 는 그 메서드를 쓰지 않으며 같은 기기에서 729쪽 전수 추출을 통과했다.
export const PDFJS_VERSION = '5.4.149';

// spec 2-3 — 1순위 jsDelivr
export function PDFJS_CDN_PRIMARY(v = PDFJS_VERSION) {
  return 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + v + '/build/';
}

// spec 2-3 — 2순위 cdnjs (1순위 실패·타임아웃 시)
export function PDFJS_CDN_FALLBACK(v = PDFJS_VERSION) {
  return 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + v + '/';
}

// 끝의 슬래시를 보장한다(사용자가 ?pdfjs= 로 넘긴 값도 여기를 지난다).
function withSlash(base) {
  const b = String(base || '');
  return b.endsWith('/') ? b : b + '/';
}

// spec 2-3 — ESM 배포판. legacy 빌드는 쓰지 않는다.
export function pdfjsMainUrl(base = PDFJS_CDN_PRIMARY()) {
  return withSlash(base) + 'pdf.min.mjs';
}

// spec 2-3 — worker는 본체와 같은 base·같은 버전이어야 한다.
export function pdfjsWorkerUrl(base = PDFJS_CDN_PRIMARY()) {
  return withSlash(base) + 'pdf.worker.min.mjs';
}

// loader.js(2단계)가 순서대로 시도할 base 목록
export const PDFJS_BASES = [PDFJS_CDN_PRIMARY(), PDFJS_CDN_FALLBACK()];

// spec 4-0 — getTextContent 호출 옵션
export const PDF_TEXT_CONTENT_OPTIONS = Object.freeze({
  includeMarkedContent: false,
  disableNormalization: false
});

/* ────────────────────────────────────────────────────────
   줄 재구성 알고리즘 파라미터 — spec 4절
   숫자는 모두 spec 4절에서 온 값이다. 4절에 없는 값은
   주석에 근거를 적었다. 프로토타입 페이지의 슬라이더가
   이 객체를 복사해 일부 키만 덮어쓴다.
   ──────────────────────────────────────────────────────── */
export const LAYOUT = Object.freeze({
  /* 4-3 Y 클러스터링 */
  Y_TOL_FACTOR: 0.35,
  Y_TOL_MIN: 1.0,
  Y_TOL_MAX: 6.0,
  SUPERSCRIPT_SIZE_RATIO: 0.75,
  SUPERSCRIPT_DY_RATIO: 0.6,
  // 4-3 위첨자 예외의 보강: 위첨자는 "조각"이므로 폭이 이웃 줄의 이 비율을
  // 넘으면 흡수하지 않는다(14pt 제목 옆의 10pt 본문 줄이 빨려드는 것을 막는다).
  SUPERSCRIPT_WIDTH_RATIO: 0.35,
  // 4-3 위첨자 예외의 보강: 위첨자 조각의 폭 상한(em 단위). 본문 한 줄 전체가
  // 큰 제목 줄에 위첨자로 빨려드는 것을 막는다(제목 14pt vs 본문 10pt는
  // 0.75 비율 조건만으로는 걸러지지 않는다).
  SUPERSCRIPT_MAX_WIDTH_EM: 2.5,

  /* 4-6 텍스트 결합 */
  SPACE_GAP_FACTOR: 0.15,
  // 4-6의 "gap < -0.5 * fontSize 면 겹침" 임계. 절댓값으로 보관한다.
  OVERLAP_FACTOR: 0.5,

  /* 4-4 run 분할 */
  // [수정 2026-09-18] 초판은 2.0 이었고 그 값이 대상 서적에서 2단 검출을 전면
  // 실패시켰다. [실측] 이 책의 거터는 왼쪽 컬럼이 x≈306 에서 끝나고 오른쪽이
  // x≈321 에서 시작해 15pt 다. 본문이 10pt 이므로 2.0 의 임계는 20pt —
  // 거터가 run 경계로 인식되지 않아 4-5 히스토그램에 넣을 간격 자체가 생기지
  // 않는다. 1.2 는 단어 간격 상한(양쪽 정렬에서도 1.0em 을 잘 넘지 않는다)과
  // 실측 거터(1.5em) 사이의 값이다. 729쪽 전수에서 단어 간격이 run 으로
  // 잘못 쪼개지는 사례 없이 거터만 잡혔다(spec 4-4).
  RUN_GAP_FACTOR: 1.2,

  /* 4-5 컬럼 판별 */
  // 임계 자체는 건드리지 않는다. 실측에서 2단 페이지는 새 분모로 1.00,
  // 진짜 1단 페이지는 ≤0.35 로 뚜렷이 갈렸다. 임계를 낮추는 방식은 이미
  // 기각됐다 — 2단 검출은 늘었지만 붙음 후보가 오히려 증가했다(spec 4-5).
  GUTTER_MIN_RATIO: 0.55,
  // 4-5 거터 비율의 분모 하한. 분모는 "그 X 를 가로지르는 본문 줄 수"이므로
  // 페이지에 따라 아주 작아질 수 있다. 가로지르는 줄이 3개뿐인데 3개가 다
  // 끊긴다고 2단으로 보면 안 된다(비율 1.00 이 되어 버린다).
  //
  // [수정 2026-09-18] Review 가 실측으로 8 을 기각했다. 729쪽 스윕:
  //   하한  2단쪽  표region  긴낱말  손상3종
  //    4     232     259      137      0
  //    8     216     271      136      0
  //   16     186     333      137      1
  // 하한을 올려도 오탐은 전혀 줄지 않고(표 region 은 오히려 늘고) 정탐만
  // 버린다. cross=4~7 이면서 비율 1.00·MAD 통과인 진짜 2단 쪽이 8 하나에
  // 걸려 탈락했다. 4 로 내린다. 0 은 안 된다 — cross=0 이면
  // hist >= 0.55*0 이 공허하게 참이 되어 빈 bin 이 전부 거터 후보가 된다
  // (C9 가 이 하한을 고정한다).
  GUTTER_MIN_CROSSING: 4,
  GUTTER_BAND_LO: 0.30,
  GUTTER_BAND_HI: 0.70,
  SPAN_WIDTH_RATIO: 0.6,
  MIN_BODY_LINES: 8,
  // 4-5 (b) "페이지 폭을 pageWidth/100 크기 구간으로" → bin 개수 100
  GUTTER_BINS: 100,
  // 4-5 (b) band 유효 폭 하한 계수 (band 폭 >= 1.2 * medianFontSize)
  GUTTER_BAND_MIN_WIDTH_FACTOR: 1.2,
  // 4-5 (d) 좌·우 컬럼 좌변 표본 최소 개수
  GUTTER_MIN_STARTS: 4,
  // 4-5 (d) 좌변 정렬 검사 MAD 상한 계수
  GUTTER_MAD_FACTOR: 3,
  // 4-5 본문 후보 폰트 크기 대역 (중앙값의 0.7~1.4배)
  BODY_FONT_LO: 0.7,
  BODY_FONT_HI: 1.4,

  /* `[8q — spec 4-14-2]` 3단 본문(columns.js detectThree). 책 고유 값이 아니다 — 쪽 폭·본문 글자 크기에 대한
     비율과 run 모양만. `GUTTER_BAND_LO/HI` 는 넓히지 않는다(넓히면 의학책 2단의 다른 band 가 후보가 된다).
     되돌림: `COL3_ENABLED = false` **와 함께** `layout.js` `algoVersion` 을 **지금 값 + 1** 로(4-13-8 과 같은 규칙 —
     버전은 앞으로만. tests/cols3-8q C3-9 계약이 둘을 묶어 고정한다). */
  COL3_ENABLED: true,
  COL3_MIN_SEP: 0.2,      // C1 — 두 거터 중심 사이 ≥ 이 비율 × 쪽 폭
  COL3_MIN_LINES: 12,     // C2 — 구간마다 본문 후보 줄 수 하한
  COL3_PROSE: 25,         // C2 — 구간 run 평균 글자 수 하한(산문)
  COL3_FULL: 0.5,         // C2 — 꽉 찬 run 비율 하한(양끝 맞춤 산문 — 표 칸은 누더기)
  COL3_FULL_WIDTH: 0.85,  // C2 — "꽉 찬" = 폭 ≥ 이 값 × 그 구간 run 폭 기준값
  COL3_FULL_PCT: 0.9,     // C2 — 그 기준값 = 구간 run 폭의 이 백분위
  COL3_BALANCE: 0.4,      // C3 — 세 구간 줄 수 최소 ≥ 이 비율 × 최대
  // [정정 2026-11-17 — 8q Build] 거터를 Fm 넘게 가로지르는 run 이 span 이 되는 폭 하한(× 두 거터 사이 = 단 하나 폭).
  // 더 좁은 것(거터 위 그림 라벨)은 중심으로 단에 든다 — 라벨 하나가 세 단을 위·아래로 가르지 않게.
  COL3_SPAN_MIN: 0.5,
  // [정정 2026-11-17 — 8q Build] 3단 쪽에서 거터 x 를 덮는 아이템이 없고 그 틈이 이 값 × Fm 이상이면 run 을 거터에서
  // 가른다(큰 글씨 줄이 4-4 임계를 못 넘어 옆 단 글과 붙은 run). 실측 붙은 run 틈 1.13–1.33·Fm, 걸친 글 낱말 틈 0.17·Fm.
  COL3_SPLIT_GAP: 1.0,

  /* 4-9 문단 그룹핑 */
  PARA_LEADING_FACTOR: 1.6,
  PARA_INDENT_FACTOR: 0.8,
  PARA_SHORT_LINE_RATIO: 0.70,
  // 4-9 "Lm 계산 불가면 1.2 x Fm"
  LEADING_FALLBACK_FACTOR: 1.2,

  /* 4-8 표 감지 */
  TABLE_MIN_LINES: 3,
  TABLE_LEADING_FACTOR: 2.2,
  TABLE_COL_TOL_FACTOR: 1.5,
  TABLE_ALIGN_RATIO: 0.6,
  // 4-8 "신호가 2개 이상이면 block.length >= 2로 완화"
  TABLE_MIN_LINES_RELAXED: 2,
  TABLE_SIGNAL_MIN: 2,
  // 4-8 가점 신호: 표 글씨는 보통 Fm의 0.8~0.95배
  TABLE_FONT_LO: 0.8,
  TABLE_FONT_HI: 0.95,

  /* 4-7 역할 판정 */
  HEADER_ZONE: 0.08,
  FOOTER_ZONE: 0.08,
  PAGENO_ZONE: 0.10,
  HEADING_SIZE_RATIO: 1.15,
  // 4-7 표의 길이·비율 조건들
  HEADER_MAX_LEN: 80,
  // [수정 2026-10-10 — 공개 전 P2] spec 4-7 원문 1.1. 러닝 헤드는 본문보다 클 수 있다 —
  // [실측] CMDT 2026 머리말 10~12pt / 본문 9pt = 중앙 1.33, 최대 1.5×Fm 이라 1.1 로는
  // 253줄 중 4줄만 통과했다(196쪽에서 낭독에 남음). 이 상한은 이제 머리말 띠(아래) 안에서만
  // 쓰이고 쪽 맨 위의 큰 표제(장 첫 쪽 제목 — Harrison 2.8×Fm)만 막으면 된다.
  // 쪽 번호 진행이 맞는 띠는 이 상한을 보지 않는다(blocks.js classifyRoles).
  HEADER_FONT_RATIO: 1.6,
  HEADER_UPPER_RATIO: 0.6,
  // [신규 2026-10-10] 머리말 띠 — 쪽 맨 윗줄 묶음과 그 아래 첫 줄의 간격 하한(×Lm).
  // 4-7 heading 규칙의 "위 여백 ≥ 1.5×Lm"과 같은 뜻의 값이다(행간보다 뚜렷이 떨어짐).
  // [실측] CMDT 2026 머리말 아래 간격 최소 2.64×Lm, 머리말 없는 책(Harrison)의 맨 윗줄은
  // 중앙 1.0×Lm(본문 행간) — 상단 영역 안 본문 줄을 머리말에서 빼는 것이 이 값의 일이다.
  HEADER_BAND_GAP_FACTOR: 1.5,
  // [신규 2026-10-10] 머리말 띠의 "같은 줄 묶음" 허용폭(×Fm). 홀수 쪽 머리말이 장 제목과
  // "책 이름 쪽번호"로 나뉘어 글자 크기·baseline 이 조금 다른 두 줄이 되는 경우를 한 띠로 묶고,
  // 이웃 쪽 띠 줄과 "같은 자리"인지 볼 때도 이 폭을 쓴다.
  HEADER_ROW_TOL_FACTOR: 0.5,
  FOOTER_MAX_LEN: 120,
  FOOTER_FONT_RATIO: 0.85,
  HEADING_MAX_LEN: 60,
  HEADING_GAP_FACTOR: 1.5,

  /* 4-2 정규화 */
  // 4-0 "회전 판정 엡실론 0.01"
  ROTATE_EPS: 0.01,
  // 4-0 styles에 ascent/descent가 없을 때의 기본값
  DEFAULT_ASCENT: 0.8,
  DEFAULT_DESCENT: -0.2,
  // 4-2 "fontSize가 0이거나 NaN이면 페이지 중앙값으로 대체".
  // 페이지 전체가 0인 병적 입력에서 0 나눗셈을 막기 위한 최후 기본값이다.
  FALLBACK_FONT_SIZE: 10
});

/* ────────────────────────────────────────────────────────
   `[8i — spec 4-13]` 행 표("이름표 | (쪽 번호) | 산문")를 행 단위로 읽는 7b 단계(`text/rowtable.js`).
   **책 고유 값이 아니다** — x 좌표·글자 크기 절댓값·머리 낱말을 쓰지 않고, 쪽 폭·띠 글자 크기·
   열의 글 모양(길이·정수뿐)에 대한 **비율**만 둔다(2-4 · 여러 권·여러 언어 원칙).
   되돌림(4-13-8·4-13-10): `ENABLED = false`(7b 전부) 또는 `REQUIRE_REF = true`(8i-2 2열 표만)로 되돌리면
   **반드시** `layout.js` 의 `algoVersion` 을 **지금 값 + 1** 로 올린다(버전은 앞으로만 — 지금 판으로 저장된 쪽을
   다시 뽑게. `tests/rowtable-8i.test.mjs` M10 계약이 셋을 묶어 고정한다).
   ──────────────────────────────────────────────────────── */
export const ROWTABLE = Object.freeze({
  ENABLED: true,
  SPAN_RATIO: 0.55,          // R1 — 폭 > 이 비율×쪽 폭인 조각이 띠를 끊는다(가로지르는 장 제목·열 머리 행)
  // R1 — 쪽 위·아래 이 비율 안의 줄은 조각으로 넣지 않는다. **0 = 끔.** 시제품은 0.06 이었으나, 그러면 표 첫 내용
  // 줄이 그 띠에 걸린 쪽(CMDT 2026 33·34쪽)에서 그 줄만 표 밖에 남아 **표를 다 읽은 뒤에** 읽혔다(문장이 갈림).
  // 머리말·꼬리말·회전 줄은 역할로 이미 빠지고 쪽 번호 줄은 띠 맨 위·아래면 빠지므로(bandsOf) 영역 컷이 필요 없다.
  EDGE_ZONE: 0,
  MIN_PIECES: 6,             // R1 — 조각이 이보다 적은 띠는 R3 를 묻지 않는다(R7 로만 든다)
  CROSS_ALLOW: 0.08,         // R2 — 통로를 덮어도 되는 조각 수 = ⌊이 비율 × 띠 줄 수⌋
  CH_FACTOR: 0.8,            // R2 — 통로 폭 하한 = 이 값 × 띠 글자 크기 중앙값
  PROSE_CHARS: 25,           // R3 — 산문 열 평균 글자 수 하한 / 이름표 열 상한
  PROSE_INT_MAX: 0.5,        // R3 — 산문 열의 정수만 조각 비율 상한
  MIN_PROSE_LINES: 5,        // R3 — 산문 열 줄 수 하한
  LABEL_INT_MAX: 0.8,        // R3 — 이름표 열의 정수만 조각 비율 상한("정수만 열 아님")
  REF_INT_MIN: 0.999,        // R3 — 쪽 번호 열 = 조각이 전부 정수 꼴
  SPARSE: 0.6,               // R3 — 이름표 열 줄 수 < 이 비율 × 산문 열 줄 수
  SYNC: 0.8,                 // R3 (b) — 이름표 칸 중 산문 세로 범위 안에 든 비율 하한
  SYNC_TOL: 0.25,            // R3 (b) — 그 범위의 허용폭(× 띠 글자 크기 중앙값)
  LABEL_GUARD: 0.5,          // R3 (d) — 이름표 칸 첫 조각이 번호 라벨뿐인 비율이 이 이상이면 아니다
  REQUIRE_REF: false,        // R3 (e) — true 면 쪽 번호 열(R)이 하나 이상 있어야 한다(8i D1 (가)). [8i-2 — 4-13-9 D1 (나)]
                             //   false: R 없는 2열 표("이름표 | 설명")도 행 표 — 아래 HIDDEN_COL·ROW_GAP 등 2열 규칙이 열린다.
                             //   되돌림 = true 와 함께 algoVersion 지금 값 + 1(spec 4-13-10 7절)
  CELL_GAP: 1.4,             // R4 — 이웃 줄 간격 > 이 값 × 행간이면 새 칸
  LEAD_CAP: 1.3,             // R4 — 행간 = min(이웃 간격 중앙값, 이 값 × 열 글자 크기)
  ASC: 0.8,                  // R4 — 칸 위끝 = 첫 줄 baseline + 이 값 × 글자 크기
  DESC: 0.25,                // R4 — 칸 아래끝 = 끝 줄 baseline − 이 값 × 글자 크기
  ALIGN_TOL: 0.3,            // R5 — "첫 줄 높이가 같다"의 허용폭(× 글자 크기)
  TOP_ALIGN_RATIO: 0.7,      // R5 — 이름표 하나짜리 닻의 이 비율 이상이 첫 P 칸과 첫 줄이 같으면 위 정렬
  COLHEAD_MAX_CHARS: 60,     // R6 — 열 머리 줄(조각) 하나의 글자 수 상한(행 합이 아니다 — 21쪽 "Topic"+열 이름 = 62자)
  COLHEAD_GAP: 6,            // R6 — 띠 밖 열 머리 행과 표 맨 윗줄 간격 상한(× 띠 글자 크기 중앙값)
  INH_CROSS: 0.3,            // R7 (e) — 물려받는 띠의 가로지름 조각 ≤ 이 비율 × 띠 줄 수
  // [8i-2 — spec 4-13-10] 아래 둘은 **쪽 번호 열(R)이 없는 표(2열 표)에만** 쓰인다. R 있는 표(CMDT 21–38)는 8i 그대로.
  HIDDEN_COL: 0.2,           // R3 (f) — P 열 줄 중 조각(run)이 둘 이상인 줄 비율 ≥ 이 값이면 숨은 열이 있는 다열 표(2열 아님).
                             //   [실측] 잡힌 2열 표 0.00–0.07 · 다열 0.41·0.62 — 빈 구간 가운데. 1차 띠·넓힌 띠·물려받은 띠 모두에 건다
  ROW_GAP: 1.1,              // R5b·R6b — 행 시작 = 바로 위 P 줄과의 간격 > 이 값 × P 열 행간. [실측] 1.05–1.25 같은 결과,
                             //   1.0 이면 이름표 줄바꿈을 행으로 자르고(C365) 1.3 부터 붙은 이름표가 다시 붙는다(C484)
  // 쪽 번호 꼴: "1130" · "1130, 1138" · "1130–1132" (값·자릿수의 뜻은 보지 않는다 — 4-13-6)
  INT_ONLY: /^\d{1,5}(?:\s*[,–\-]\s*\d{1,5})*$/
});

/* ────────────────────────────────────────────────────────
   4-10 하이픈 결합에서 하이픈을 유지할 접두사
   gram/x/t/b 는 "gram-negative", "X-linked", "T-cell", "B-cell" 보호용.
   ──────────────────────────────────────────────────────── */
export const KEEP_HYPHEN_PREFIXES = new Set([
  'anti', 'non', 'self', 'post', 'pre', 'pro', 'co', 're', 'intra', 'inter',
  'sub', 'semi', 'multi', 'pseudo', 'extra', 'ultra', 'cross', 'long', 'short',
  'high', 'low', 'first', 'second', 'well', 'x', 't', 'b', 'gram', 'de', 'ex'
]);

/* 접미사 기준 하이픈 보존 — 실기기 P3 검증에서 드러난 결함의 수정 (spec 4-10)
 *
 * 앞부분(접두사)으로는 막을 수 없는 경우가 있다. 729쪽 전수 검사에서 나온 것들:
 *   "angiotensin-" + "converting"   → angiotensinconverting   (틀림)
 *   "methicillin-" + "resistant"    → methicillinresistant    (틀림)
 *   "piperacillin-" + "tazobactam"  → piperacillintazobactam  (틀림)
 * 앞부분이 약물명·병원체명이라 열거가 불가능하다. 반면 **뒷부분**은 열거된다.
 *
 * 여기에 든 낱말로 다음 줄이 시작하면 하이픈을 살린다.
 */
// 판단 기준: "X-<낱말>" 형태에서 하이픈이 **거의 항상 진짜**인가?
//   살려야 함  — "resistant" ("methicillin-resistant"에서 하이픈은 진짜)
//   살리면 안 됨 — "vascular" ("cardio-vascular"는 줄바꿈 하이픈, 4-11 H1이 결합을 요구)
//
// 왜 아래 낱말들이 안전한가: 줄바꿈 하이픈은 낱말 **내부**를 자르므로 다음 줄의
// 첫 조각은 낱말이 아니라 파편이다("available" → "avail-"+"able", "depen-"+"dent",
// "me-"+"diated"). 따라서 **그 자체로 온전한 다음절 낱말**은 줄바꿈 파편으로
// 나타나기 어렵다. 반대로 "able"·"tion"·"ally" 같은 흔한 어미는 파편으로 자주
// 나오므로 절대 넣지 않는다.
export const KEEP_HYPHEN_SUFFIXES = new Set([
  // 729쪽 실측에서 하이픈을 잃은 사례 (spec 4-10)
  'associated',    // antibiotic-associated, ventilator-associated, sarcoidosis-associated
  'resistant',     // methicillin-resistant, chloroquine-resistant, vancomycin-resistant
  'susceptible',   // glycopeptide-susceptible, vancomycin-susceptible
  'converting',    // angiotensin-converting
  'induced',       // antidepressant-induced
  'mediated',      // autoantibody-mediated
  'clavulanate',   // amoxicillin-clavulanate
  'tazobactam',    // piperacillin-tazobactam
  'oophorectomy',  // salpingo-oophorectomy

  // 의학 원서에서 같은 형태로 반복되는 복합 수식어 (예방적으로 추가)
  'dependent',     // insulin-dependent, dose-dependent
  'related',       // age-related, HIV-related
  'negative',      // culture-negative, HBeAg-negative
  'positive',      // culture-positive, ANA-positive
  'specific',      // antigen-specific, site-specific
  'based',         // evidence-based, population-based
  'sparing',       // potassium-sparing
  'releasing',     // gonadotropin-releasing
  'stimulating',   // thyroid-stimulating
  'binding',       // DNA-binding
  'blocking',      // beta-blocking
  'deficient',     // IgA-deficient
  'lowering',      // cholesterol-lowering
  'onset'          // adult-onset, late-onset
]);

/* ────────────────────────────────────────────────────────
   4-9 / 5절 문장 종결 판정 예외 (소문자 + 마침표 포함 형태로 보관)
   segment.js 와 blocks.js 가 공유한다.
   ──────────────────────────────────────────────────────── */
export const ABBREVIATIONS = new Set([
  'e.g.', 'i.e.', 'vs.', 'etc.', 'cf.', 'ca.', 'approx.', 'no.', 'nos.',
  'al.', 'fig.', 'figs.', 'tbl.', 'chap.', 'chaps.', 'sec.', 'ed.', 'eds.',
  'vol.', 'vols.', 'p.', 'pp.', 'dr.', 'mr.', 'mrs.', 'ms.', 'prof.', 'st.',
  'jr.', 'sr.', 'inc.', 'ltd.', 'min.', 'max.', 'wt.', 'mg.', 'kg.'
]);

/* ────────────────────────────────────────────────────────
   9-4 백그라운드 추출 파라미터 — 2c 단계에서 추가
   숫자의 근거는 7000쪽(실자료 예정) 규모다. 729쪽에서는 어느 값이든
   차이가 없지만 10배에서는 전부 비용으로 돌아온다.
   ──────────────────────────────────────────────────────── */
export const EXTRACT = Object.freeze({
  // getTextContent 결과(아이템 배열)를 몇 쪽분 들고 있을 것인가.
  // 역할 재계산(4-7)이 이웃 쪽의 아이템을 곧바로 다시 쓰므로 0 은 안 된다.
  // 3 이면 현재 쪽과 앞뒤 한 쪽이 캐시에 남는다. 7000쪽 × 아이템을 쌓으면 죽는다.
  ITEMS_CACHE_MAX: 3,

  // documents.extraction 을 쪽마다 쓰지 않는다. 7000쪽이면 7000번의
  // documents 쓰기이고 그 비용이 추출 자체보다 커진다.
  META_SAVE_EVERY_PAGES: 10,
  META_SAVE_EVERY_MS: 2000,

  // 9-4 "낭독 중에는 priority 2 를 초당 1페이지로 제한"
  SPEAKING_PAGE_MS: 1000,

  // pdfDoc.cleanup() 주기(쪽). worker 쪽 폰트·이미지 캐시를 턴다.
  PDFDOC_CLEANUP_EVERY: 100,

  // requestIdleCallback 이 계속 밀릴 때의 강제 실행 시한
  IDLE_TIMEOUT_MS: 1000
});

/* ────────────────────────────────────────────────────────
   6절 낭독 — 5단계에서 추가. 숫자의 출처는 전부 spec 6-1·6-2·6-4·6-5 다.

   ★ 여기 상수들은 **Android Chrome 버그 대응**이다. 기능 감지로 분기하지
     않는다 — 데스크톱에서도 같은 코드가 돈다(6-4 머리말).
   ──────────────────────────────────────────────────────── */
export const TTS = Object.freeze({
  /* 6-1 속도 */
  RATE_MIN: 0.5,
  RATE_MAX: 2.0,
  RATE_STEP: 0.1,

  /* 6-1 [수정 2026-09-22 · 실기기 피드백] 속도는 **계단식**이다.
   * 연속 슬라이더(0.1 단계)는 걷거나 누운 자세에서 엄지로 값을 맞출 수 없다.
   * 사용자가 직접 고른 여섯 단계 — "0.5, 0.75, 1, 1.25, 1.5, 1.8 이렇게 있음 충분해".
   * `RATE_MIN/MAX/STEP` 은 남긴다 — `tts/text.js` 의 `clampRate` 가 아직 쓰고,
   * 그 함수는 이 단계의 수정 범위 밖이다. 새 코드는 `snapRate`(speaker.js)를 쓴다. */
  RATE_STEPS: Object.freeze([0.5, 0.75, 1.0, 1.25, 1.5, 1.8]),

  /* 반복 재생 (5b) — 사용자 요구 "횟수도 정할 수 있게".
   * **0 은 무한**이다(사용자가 끌 때까지). 숫자로 두어 settings 에 그대로 저장된다. */
  REPEAT_COUNTS: Object.freeze([2, 3, 5, 0]),
  REPEAT_COUNT_DEFAULT: 3,

  /* 6-1 [수정 2026-09-21] 기본 낭독 단위는 **문장**이다.
   * `settings.js` 의 `DEFAULTS['tts.unit']` 은 초판 값('line')에 머물러 있고
   * 그 파일은 이 단계의 수정 범위 밖이다. 저장된 값이 없을 때는 이 상수를
   * 쓴다(`ui/controls.js` 가 `settings` 스토어의 행 존재를 직접 본다). */
  UNIT_DEFAULT: 'sentence',

  /* 6-4 "긴 utterance 잘림" — 약 200~300자에서 끊기고 onend 가 안 온다. */
  MAX_UTTER_CHARS: 300,

  /* 6-2 워치독. 영어 약 14자/초 @rate 1.0, 여유 3초, 그 2배에서 발동. */
  CHARS_PER_SEC: 14,
  WATCHDOG_PAD_MS: 3000,
  WATCHDOG_FACTOR: 2,

  /* 6-4 "cancel() 직후 speak() 무시" */
  CANCEL_DELAY_MS: 60,

  /* 6-3 "getVoices() 초기 빈 배열" */
  VOICES_TIMEOUT_MS: 1500,

  /* 6-1 "다음 페이지가 미추출이면 추출을 우선 요청하고 최대 5초 대기" */
  PAGE_WAIT_MS: 5000,

  /* `[8i-1 — spec 4-13-9]` 판 바뀜 재추출 중 **지금 쪽이 옛 판**일 때 재생을 누르면 그 쪽 새 판 저장을
     기다린다(지금 쪽은 우선순위 0 이라 짧다 — 데스크톱 실측 약 3초, 폰 [추정] 3–5배). 넘으면 멈춤으로
     돌아간다(옛 읽기를 내지 않는다). 다시 누르면 다시 기다린다. */
  FRESH_WAIT_MS: 20000,

  /* 6-5 자동 스크롤 "편안 영역" 과 사용자 스크롤 구분 창 */
  COMFORT_TOP: 0.30,
  COMFORT_BOTTOM: 0.65,
  USER_SCROLL_MS: 800
});

/* ────────────────────────────────────────────────────────
   `[9a — spec 17-1-1]` 이어폰·잠금 화면 버튼(Media Session). 화면은 `ui/handsfree.js`, 배선은 `ui/controls.js`.
   DB·algoVersion·캐시 키 무관 · 호출 0 · 오프라인 ○.
   ──────────────────────────────────────────────────────── */
export const HANDSFREE = Object.freeze({
  /* 세션 잡기(6절 · 결정 9-D1 (나)) — 'audio' = 낭독 중 무음 `<audio loop>` 를 함께 틀어 Chrome 미디어 세션·알림을 만든다.
     'none' = 핸들러·메타데이터만(오디오 0). 9a-0 실기기에서 두 기기 모두 "오디오 없이도 이어폰·알림이 온다"면 값만 'none'. */
  SESSION: 'audio',
  /* 무음 WAV — 8 kHz·8비트·모노, 10초 = 80,044 바이트. 5초 넘는 미디어만 "full" 포커스를 받는다(W1) → 여유 있게 10초. */
  SILENT_SECONDS: 10,
  SILENT_RATE: 8000,
  /* 무음 진폭 — 8비트 PCM 의 0 은 128. 9a-0 의 "거의 안 들리는 소리"는 넣지 않았다 — 바꿀 때는 이 값(또는 생성기)만. */
  SILENT_LEVEL: 128,
  /* 이어폰·알림으로 멈췄을 때 화면을 더 켜 두는 시간(결정 9-D3). 화면 [⏸] 로 멈추면 쥐지 않는다. */
  PAUSE_HOLD_MS: 300000,
  /* 알림 위치 막대(결정 9-D7) — 'off' = `setPositionState` 를 부르지 않는다(기본 — 10초 반복 막대 위험은 실기기 점검 묶음).
     'sentence' = 쪽 문장 진행(`{duration: 문장 수, position: index, playbackRate: 1}`). `seekto` 는 어느 쪽이든 걸지 않는다. */
  POSITION: 'off'
});

/* 6-1 — 기호 소수(少數)만 읽기 쉬운 낱말로. 연속 대문자 약어는 건드리지 않는다.
 * 키는 **한 글자**이거나 짧은 기호 문자열이고, 치환은 앞뒤에 공백을 붙여 들어간다
 * ("≥4" → "greater than or equal to 4"). 원서 텍스트 자체는 바뀌지 않는다 —
 * 낭독용 사본에서만 갈아 낀다.
 *
 * `[수정 7c — spec 6-1]` 치환 낱말은 영어이므로 표를 **원문 언어별**로 둔다.
 * `en` 이 원래 표 그대로다. `fr`·`ko` 는 실물 측정 전까지 **비워 둔다** — 프랑스어
 * 문장 속에 영어 "greater than" 이 끼는 것보다 기호를 그대로 두는 편이 낫다.
 * 표에 없는 언어(미지원 `und` 등)도 빈 표로 읽는다(`tts/text.js` 의 `symbolsFor`).
 */
export const TTS_SYMBOLS = Object.freeze({
  en: Object.freeze({
    '≥': 'greater than or equal to',
    '≤': 'less than or equal to',
    '±': 'plus or minus',
    'µ': 'micro',
    'μ': 'micro',
    '→': 'to',
    '%': 'percent'
  }),
  fr: Object.freeze({}),
  ko: Object.freeze({})
});

/* `[8h-1 — spec 6-6-4 C]` 각주·기호 문자. **언어 무관** — 기호 표(`TTS_SYMBOLS`)와 따로 둔다.
 * 낭독 사본에서만(`tts/text.js` 의 `speechMarks`): 피연산자 사이("HLA-B∗58:01" "STAR*D")면 `∗` → `*` 로만 바꾸고,
 * 그 밖(단어 끝 "Practice∗", 줄머리 "∗See", 따옴표 뒤)은 지운다. `src`·화면·번역 입력은 그대로(캐시 키 불변). */
export const SPEECH_MARKS = Object.freeze(['∗', '*', '†', '‡', '§']);   // ∗ * † ‡ §

/* `[8o — spec 19-1-3 §6 · 결정 L-D11 (가)]` 빈칸(문제집의 `-------`·`___`) 낭독 낱말 — **언어별**.
 * 낭독 사본에서만(`tts/text.js` 의 `speechBlanks`) — `src`·화면·번역 입력·검색은 그대로(캐시 키 불변).
 * 언어 = 그 단위의 말할 언어(8m `Unit.lang`) ‖ 문서 언어. 언어가 없으면 en(기호 표와 같은 규칙),
 * **표에 없는 언어는 쉼표 하나**(소리 없이 짧은 쉼 — 영어 낱말을 끼워 넣지 않는다).
 * fr·ar 문안 `[검토 — Nour·운영자]`(ar 은 spec 에 문안이 없어 Build 가 고른 것). es 는 8n 이 더했다(spec 19-1-3 §5). */
export const SPEECH_BLANK = Object.freeze({
  en: 'blank',
  ko: '빈칸',
  fr: 'blanc',
  ar: 'فراغ',
  es: 'espacio'
});

/* `[8h-1 — spec 6-6-2 A · 6-6-3 B]` 인용 단위·참고문헌 묶음·글머리 경계 (`text/cite.js` · `text/segment.js`).
 * 판별은 **언어·책에 기대지 않는 꼴**(식별자 토큰·국제 인용 꼴·글리프)만 쓴다. 숫자의 출처는 spec 6-6-1(CMDT 2026 전수). */
export const CITE = Object.freeze({
  MAX_UNIT_CHARS: 200,     // A1 — 이보다 긴 단위는 인용으로 보지 않는다(본문일 가능성이 크다)
  REF_MAX_FOLLOW: 4,       // A2 — 머리 다음 이 문장 수 안에서 닫혀야 묶음이다
  REF_MAX_CHARS: 400,      // A2 — 머리부터 닫는 문장까지 합계 글자 상한
  /* B1 — 글머리 글리프. 단위 중간에서 "공백 + 글리프 + 공백" 이면 글리프 **앞**에서 끊는다. */
  BULLETS: Object.freeze(['•', '▪', '◦', '‣', '●', '■', '▸', '►'])
});

/* `[7c — spec 6-1]` 고를 음성이 없을 때 `utterance.lang` 에 넣는 언어별 기본 지역.
 * `[8k · 다듬기 1]` 사용자가 목소리를 고르면 그 음성 자신의 태그, 억양만 고르면 그 억양이 우선이고, 아무것도 안 골랐으면
 * 이 태그만 보낸다(voice 없이 — 휴대폰 설정 따름). 고르는 곳은 `tts/voices.js` 의 `resolveSpeech`(`defaultSpeechTag`).
 * 코드의 다른 곳에 지역 태그를 박지 않는다 — 여기 한 곳이다.
 * `[8n — spec 19-1-3 §5]` es 는 지역 기본값 es-ES. `TTS_SYMBOLS` 에 es 표는 두지 않는다(빈 표 — 엔진에 맡김). */
export const TTS_LANG_REGION = Object.freeze({
  en: 'en-US',
  fr: 'fr-FR',
  ko: 'ko-KR',
  es: 'es-ES'
});

/* ────────────────────────────────────────────────────────
   `[9b — spec 17-1-2 7]` 음성 명령. 매칭은 `voice/commands.js`(순수), 듣기는 `voice/listen.js`(서비스), 화면·배선은
   `ui/voice.js`·`ui/controls.js`. DB·algoVersion·캐시 키 무관 · AI 호출 0. 인식된 글자는 메모리에만(최근 `HISTORY`).
   ──────────────────────────────────────────────────────── */
export const VOICE = Object.freeze({
  /* 한 번 듣기의 앱 상한(5절 "말 없음") — 시도마다 다시 잰다. `[가정 — 실기기 V-3]` */
  LISTEN_MAX_MS: 8000,
  /* 실패 안내 음성 한 마디의 상한 — 끝나지 않아도 이 시간 뒤 원래 상태로 되돌린다(5절). */
  SAY_MAX_MS: 4000,
  /* 인식 대안을 몇 개까지 보나 — 인식기(`maxAlternatives`)와 매칭(`matchCommand`)이 **이 한 값**을 본다(9b1R-8 4). */
  MAX_ALTS: 5,
  /* 아랍어 인식 태그 사다리(9b-D4) — 레반트 → 이웃 레반트 → 일반. `[가정 — 실기기 V-1]` */
  AR_TAGS: Object.freeze(['ar-SY', 'ar-JO', 'ar']),
  /* 영어 인식 태그 — 지역 태그는 위 `TTS_LANG_REGION` 한 곳(값을 다시 적으면 tests/srclang-wiring-7c W1). */
  EN_TAG: TTS_LANG_REGION.en,
  /* 사다리 다음 칸을 시작하기 전 앞 인식기의 `end` 를 기다리는 상한(9b-1 B1 — 바쁨 → not-allowed 오안내 방지). */
  RETRY_WAIT_MS: 300,
  /* 최근 기록 수(메모리만 — [말해 보기]·[결과 복사]·`__medreader.voice()`). */
  HISTORY: 10,
  /* 명령 확인 줄(«들은 말» → 명령 이름)을 보이는 시간. */
  CONFIRM_MS: 2000,
  /* `[9b-2]` 실패 안내 줄을 보이는 시간(다음 누름이 먼저 오면 그때 지운다). */
  NOTICE_MS: 8000,
  /* `[운영자 결정 2026-11-15 ①]` 한 낱말 동의어의 **포함** 일치는 말 전체가 이 낱말 수 이하일 때만(전체 일치는 그대로). */
  PART_MAX_WORDS: 3,
  /* `[9b — 결정 9b-D3]` 좁은 바 — 마이크 단추가 보이고 이 미디어 조건이 맞으면 하단 바에 `data-bar-tight="on"`(진행 표시를 시각적으로만
     숨기고 버튼 여백을 줄인다 — css/reader.css). 조건은 **여기 한 곳** — 8e(가로 화면)가 조건만 더해 다시 쓴다. 값은 Build 실측(보고서).
     `[8e — spec 12-8-1 (2)·(7)]` 낮은 화면(compact, tokens.css 와 같은 `max-height: 520px`)을 더했다 — 합친 바 한 줄에서 진행 표시를
     같은 속성으로 숨긴다(새 장치 없음). 쉼표 = 또는. */
  BAR_TIGHT_MEDIA: '(max-width: 400px), (max-height: 520px)'
});

/* ────────────────────────────────────────────────────────
   5-4 · 5-5 퀴즈 — 9b 단계에서 추가.
   **기존 키(LAYOUT·KEEP_HYPHEN_*)는 건드리지 않는다.**
   숫자의 출처는 spec 5-4 와 7000쪽 규모다.
   ──────────────────────────────────────────────────────── */
export const QUIZ = Object.freeze({
  /* 5-4 제안 칩 조건 — `verified / questions >= 0.6` 이고 `questions >= 5`.
     파서의 `isQuizWorthy` 가 기본값으로 같은 수를 갖지만, 임계가 두 곳에
     적혀 있으면 언젠가 어긋난다. 호출자는 늘 이 값을 넘긴다. */
  MIN_QUESTIONS: 5,
  MIN_VERIFIED_RATIO: 0.6,

  /* 섹션 인덱스 1단계 — 섹션의 쪽 범위를 구할 때 한 번에 파싱하는 쪽 수.
     7000쪽이면 이 창이 219번 돌고, 창 하나가 메모리에 드는 최대량이다.
     (투영 뒤 한 쪽 ≈ 4KB 이므로 32쪽 ≈ 128KB.) */
  SCAN_WINDOW_PAGES: 32,

  /* 섹션 인덱스 2단계 — 섹션 범위 앞뒤에 더하는 여유 쪽 수.
     1단계의 창 경계에서 잘린 이어짐 문단을 되찾는다. */
  SPAN_PAD_PAGES: 1,

  /* 병적인 입력(쪽마다 새 `sec-p{n}`)에서 2단계가 폭주하지 않게 하는 상한.
     `[실측]` 729쪽이 14섹션이므로 7000쪽 환산 약 135섹션이다. */
  SECTION_INDEX_MAX: 200,

  /* 5-3 그림 문항 크롭 — 메모리 LRU 개수. 퀴즈는 한 문항씩만 보므로
     원본 뷰(20개)보다 작아도 된다. IndexedDB 에는 넣지 않는다(4-8). */
  CROP_CACHE_MAX: 8,

  /* 5-3 그림 문항 크롭 — 문항 문단 bbox 아래로 더 담을 여백(pt).
     다음 문항 직전까지가 원칙이지만, 보기 문단까지 bbox 를 합치고
     이 여백만 더한다(그림이 보기 아래에 오는 조판 대비). */
  CROP_EXTRA_PT: 24
});

/* ────────────────────────────────────────────────────────
   12-5 · 4-8 · 4-12 원본 뷰 — 6b 단계에서 추가.
   **기존 키(LAYOUT·KEEP_HYPHEN_*)는 건드리지 않는다.** 원본 뷰가 쓰는
   숫자만 새 키로 모은다(16-K: 파라미터는 config 한 곳에).
   ──────────────────────────────────────────────────────── */
export const ORIGINAL = Object.freeze({
  /* 12-5 — 앱 안 [−][+] 줌 범위. 16-F 가 0.8·1.5·3.0 에서 오버레이를 검사한다. */
  ZOOM_MIN: 0.8,
  ZOOM_MAX: 3.0,
  /* `[10b]` 12-5 는 "페이지 폭을 화면 폭에 맞춘 scale 을 기본"이라고 했는데
     하한 0.8 이 그것을 막았다. 접은 화면(375px)의 폭 맞춤은 0.57~0.61× 라
     처음 열자마자 좌우로 밀어야 쪽 전체가 보였다(`[실기기 · Fold 7]`).
     실질 하한은 **min(폭 맞춤 배율, ZOOM_MIN)** 이다(`ui/original.js`).
     이 값은 그 아래를 받치는 절대 바닥 — 폭이 비정상적으로 좁게 보고돼도
     여기보다 작아지지 않는다. 상한 3.0 은 그대로. */
  ZOOM_FLOOR_MIN: 0.25,
  /* 한 번 누를 때의 배율. 0.8 → 1.0 → 1.25 … 3.0 로 로그 간격에 가깝다. */
  ZOOM_FACTOR: 1.25,

  /* 4-6 — 하이라이트 상자는 줄 bbox 사방에 `0.15 × fontSize` 를 더해 그린다.
     순수 계층은 원값만 주므로 이 padding 은 **UI(이 단계)의 몫**이다. */
  HL_PAD_FACTOR: 0.15,

  /* `[수정 2026-09-25 — 10a]` 4-12 — 오버레이는 합집합 1개가 아니라 **덮는 줄마다 1개**다.
     한 발화가 걸치는 줄은 현실적으로 ≤ 5개다. 상한을 두어 7000쪽에서도 DOM 이
     줄 수만큼 늘지 않게 한다(풀에서 재사용하고, 넘치면 앞에서 자른다). */
  HL_MAX_BOXES: 8,

  /* 4-8 폴백 — 표 크롭. `scale = 2 × devicePixelRatio`(상한 3). */
  CROP_SCALE_FACTOR: 2,
  CROP_SCALE_MAX: 3,
  /* 4-8 — 표 영역 사방 여백 6pt. 표 테두리가 잘리지 않게 한다. */
  CROP_PAD_PT: 6,
  /* 4-8 — 크롭 이미지는 **메모리에만** 둔다(IndexedDB 금지). LRU 20개. */
  CROP_CACHE_MAX: 20,

  /* `[수정 2026-10-12 — 12-5 캔버스 해상도]` 고정 상한 `DPR_MAX: 2` 를 **픽셀 수 예산**으로 바꿨다.
     옛 근거("3.0× 줌 × dpr 3 이면 한 변이 5000px 을 넘어 저사양 기기에서 canvas 할당이 실패한다")는
     **크게 볼 때**의 이야기인데, 고정 상한이 **작게 볼 때까지** 해상도를 깎았다 — 폰(dpr ≈ 3)에서
     2배로 그린 뒤 1.5배 늘려 9pt 표의 가는 글자(i·l·o)가 사라졌다(Nour 캡처, CMDT 31쪽 66%).
     이제 `render.canvasRatio(dpr, cssW, cssH) = max(1, min(dpr, √(MAX_CANVAS_PIXELS / 면적),
     MAX_CANVAS_SIDE / 한 변))` — 작게·폭 맞춤일 때는 기기 밀도 그대로, 크게 확대할 때만 예산이 깎는다.
     3.0× 에서는 옛 규칙(13.4MP·약 54MB)보다 오히려 작다(8MP 이하). 표 크롭(4-8)의 전체 쪽 캔버스도
     같은 예산을 넘지 않는다(`renderRegionImage`). 숫자는 여기 한 곳에만 둔다. */
  /* 캔버스 한 장의 픽셀 수 상한 — RGBA 4바이트면 약 32MB. 저사양 보호.
     [가정] Chrome Android 의 캔버스 상한은 기기 메모리에 달렸다 — 실기기 3.0× 에서 할당 실패가 없는지 본다. */
  MAX_CANVAS_PIXELS: 8388608,
  /* 캔버스 한 변 상한 — GPU 텍스처 상한이 낮은 기기 보호. [가정] */
  MAX_CANVAS_SIDE: 4096
});

/* ────────────────────────────────────────────────────────
   8절 AI 프로바이더 · 13절 키 보호 — 7a 단계에서 추가.
   **기존 키(LAYOUT·KEEP_HYPHEN_*·TTS·QUIZ·ORIGINAL)는 건드리지 않는다.**

   ★ 여기에 **진짜 키를 적지 않는다.** 여기 있는 것은 키의 *모양*뿐이다.
   ──────────────────────────────────────────────────────── */
export const AI = Object.freeze({
  /* 9-3 `ai.provider` 기본값과 같아야 한다. */
  DEFAULT_PROVIDER: 'gemini',

  /* 8-4 가장 저렴·경량 Flash 계열. 설정에서 바꾼다.
     **무료 티어 한도 수치는 코드 어디에도 적지 않는다**(8-4).
     `[수정 2026-10-08]` 운영자 결정 — `gemini-3.5-flash-lite`("아랍어가 잘 나와야 한다").
     `gemini-2.5-flash-lite` 는 지원 종료 단계라 **새 키에는 404** 였다(2026-10-05 실키 확인).
     저장된 `gemini-2.5-*` 는 `settings.js` 가 "설정 안 됨"으로 읽는다. */
  DEFAULT_MODEL: Object.freeze({ gemini: 'gemini-3.5-flash-lite' }),

  /* 8-4 `listModels()` 가 실패했을 때의 폴백 목록. 기본 모델이 맨 앞. */
  STATIC_MODELS: Object.freeze({
    gemini: Object.freeze(['gemini-3.5-flash-lite', 'gemini-3.5-flash'])
  }),

  /* 8-5 요청 하나의 상한(입력 + maxOutputTokens). 넘으면 파이프라인(8단계)이 쪼갠다. */
  MAX_REQ_TOKENS: 8000,

  /* 8-5 토큰 근사. 라틴은 4자/토큰, 아랍어·한글은 2자/토큰.
     비율 임계는 분수로 둔다 — 0.3 은 이진 부동소수에 정확히 담기지 않아
     "정확히 30%" 경계가 기기마다 달라질 수 있다(정수 비교로 고정한다). */
  TOKEN_CHARS_LATIN: 4,
  TOKEN_CHARS_WIDE: 2,
  WIDE_RATIO_NUM: 3,
  WIDE_RATIO_DEN: 10,

  /* 13절 키 저장 위치. 기본 `sessionStorage`, `privacy.rememberKey` 가
     켜졌을 때만 `localStorage`. **`settings` 스토어에는 넣지 않는다**(9-3). */
  KEY_STORAGE_PREFIX: 'medreader.key.',

  /* 13절 표시용 마스킹 `AQ.Ab…6l` — 앞 5자 + … + 뒤 2자.
     `MASK_MIN_LEN` 보다 짧으면 통째로 가린다(짧은 키는 5+2 만으로 거의 다 드러난다). */
  MASK_HEAD: 5,
  MASK_TAIL: 2,
  MASK_ELLIPSIS: '…',
  MASK_MIN_LEN: 8,

  /* 9-2 `usage.byKind` 의 고정 키. */
  USAGE_KINDS: Object.freeze(['translate', 'summarize', 'quiz', 'grade', 'table', 'verify']),

  /* 8-4 검증 호출이 `usage` 에 남기는 종류(대시보드 투명성). */
  VERIFY_KIND: 'verify',

  /* `[8a]` 9-2 · 15절 — 낭독 동반 번역 원격 호출의 `usage.byKind` 키.
     `USAGE_KINDS` 에 넣지 않고 따로 둔다: 7a 테스트가 **빈 행**의 키 여섯 개를 고정한다.
     `bumpUsage` 는 이 키도 받아 **처음 쓰일 때** 행에 만든다(대시보드는 `|| 0` 으로 읽는다). */
  READALONG_KIND: 'readalong',

  /* `[8f-1]` 17-7-6 4-3 — 단어 요청(단어장 [AI 로 번역]·[번역 안 된 것 모두 번역])의 `usage.byKind` 키이자
     캐시 `kind`. `READALONG_KIND` 와 같은 까닭으로 `USAGE_KINDS` 에 넣지 않는다(7a 빈 행 테스트 무변) —
     처음 쓰일 때 행에 생긴다. 상한(`ai.dailyCap`)에는 들어간다(검증만 빠진다 — 15절). */
  TERM_KIND: 'term',

  /* `[11-4 — spec 17-2-1 4-7]` 문장 설명(11a — 선택 줄 [설명]·음성 "설명")의 `usage.byKind` 키이자 캐시 `kind`.
     `READALONG_KIND`·`TERM_KIND` 와 같은 까닭으로 `USAGE_KINDS` 밖(7a 빈 행 키 여섯 그대로) — 처음 쓰일 때 행에 생긴다.
     상한(`ai.dailyCap`)·80% 경고에는 들어간다. */
  EXPLAIN_KIND: 'explain',

  /* `[16-1 — spec 17-14 2]` 그림 개념도(저장한 개요 → 노드·관계)의 `usage.byKind` 키이자 캐시 `kind`.
     `EXPLAIN_KIND` 와 같은 까닭으로 `USAGE_KINDS` 밖(7a 빈 행 키 여섯 그대로) — 처음 쓰일 때 행에 생긴다. 상한·80% 경고에는 들어간다. */
  DIAGRAM_KIND: 'diagram'
});

/* ────────────────────────────────────────────────────────
   `[8f-1]` 17-7 단어장 · 17-7-6 4-3·4-4·4-6 — 상수. **추가만** 했다.
   ★ 무료 티어 한도 숫자는 여기에도 없다(15절). 호출 한 번에 담는 낱말 수는 비용 모양이다(17-7-2 "묶음 번역").
   ──────────────────────────────────────────────────────── */
export const VOCAB = Object.freeze({
  /* 17-7-2 — 한 요청(=한 번 누름)에 담는 낱말 수 상한. 글자 상한은 `ai.maxReqChars`(PIPELINE.MAX_REQ_CHARS)와 같다. */
  BATCH_MAX: 20,
  /* 17-7-2 — `maxOutputTokens = 항목 수 × PER_ITEM + PAD` */
  OUT_TOKENS_PER_ITEM: 120,
  OUT_TOKENS_PAD: 100,
  /* 17-7-2 검증 — 번역 ≤ 200자(넘으면 그 항목 실패), 짧은 뜻 ≤ 300자(넘으면 자름), 기본형 ≤ 100자(넘으면 자름) */
  TRANSLATION_MAX: 200,
  GLOSS_MAX: 300,
  LEMMA_MAX: 100,
  /* 17-7-2 품사 목록 — 밖이면 'other' */
  POS: Object.freeze(['noun', 'verb', 'adj', 'adv', 'abbr', 'phrase', 'other']),
  /* 17-7-2 `findInSentenceTr` — 괄호 앞에서 뒤로 거슬러 올라갈 최대 낱말 수 */
  CANDIDATE_WORDS: 4,
  /* 17-7-4 가져오기 상한 — 넘으면 통째로 거절 */
  IMPORT_MAX_BYTES: 2 * 1024 * 1024,
  IMPORT_MAX_ROWS: 5000,
  /* 17-7-4 CSV 열 이름(영어 고정 — 가져오기가 이름으로 맞춘다). 순서도 이대로 내보낸다. */
  CSV_COLUMNS: Object.freeze(['term', 'translation', 'pos', 'gloss', 'context', 'context_translation', 'note',
    'document', 'page', 'source_lang', 'target_lang', 'added', 'updated', 'id']),
  /* 단어장 항목 필드(9-2) → 위 열 이름. `text/vocab.js` 는 열 이름을 이 표로만 읽는다(순수 계층 grep — 16-A). */
  CSV_COL: Object.freeze({
    surface: 'term', translation: 'translation', pos: 'pos', gloss: 'gloss', context: 'context',
    contextTr: 'context_translation', note: 'note', docTitle: 'document', pageNo: 'page',
    srcLang: 'source_lang', targetLang: 'target_lang', createdAt: 'added', updatedAt: 'updated', id: 'id'
  }),
  /* 17-7-4 Anki 머리 줄(Anki 2.1.55+ `[가정]`) */
  ANKI_HEADER: Object.freeze(['#separator:tab', '#html:false', '#columns:Front\tBack\tContext\tNote\tSource']),
  /* 9-2 cards `origin` 값 */
  ORIGINS: Object.freeze(['sentence', 'ai', 'user', 'import'])
});

/* ────────────────────────────────────────────────────────
   `[11-1]` 17-2-1 — 문단 요약(11b)·범위 개요(11c) 상수. **추가만** 했다.
   ★ 무료 티어 한도 숫자는 여기에도 없다(15절). 출력 토큰은 요청 하나의 상한(`AI.MAX_REQ_TOKENS`) 안에서 묶음을 자르는 몫이다.
   ──────────────────────────────────────────────────────── */
export const SUMMARY = Object.freeze({
  /* 17-2-1 3 `eligible` — 요약할 수 있는 문단(7-3 그대로): kind `body`·`list`, 문장 2개 이상, 글자 60자 이상 */
  KINDS: Object.freeze(['body', 'list']),
  MIN_SENTENCES: 2,
  MIN_CHARS: 60,
  /* 4-1 — `maxOutputTokens = 문단 수 × PER_PARA + PAD` */
  OUT_TOKENS_PER_PARA: 700,
  OUT_TOKENS_PAD: 200,
  /* 4-1 `checkSummary` 상한 — 넘으면 **자른다**(실패 아님) */
  GIST_MAX: 600,
  MAX_POINTS: 4,
  MAX_SUB: 3,
  POINT_MAX: 200,
  MAX_TERMS: 5,
  TERM_MAX: 80,
  /* 캐시 값·저장 레코드의 `promptVersion`(키에는 넣지 않는다 — 7-5). 번역 `PROMPT_VERSION` 과 따로 센다. */
  PROMPT_VERSION: 1
});

export const OUTLINE = Object.freeze({
  /* 4-6 — 깊이별 항목 상한(위 8 · 아래 4 · 그 아래 3). 깊이 3 고정(gemini 스키마는 재귀가 없다). */
  MAX_POINTS: Object.freeze([8, 4, 3]),
  TITLE_MAX: 200,
  POINT_MAX: 200,
  /* 요청 하나의 출력 상한 — 입력(저장한 요약 ≤ `ai.maxReqChars`) + 이것 ≤ `AI.MAX_REQ_TOKENS` 를 넘으면 보내지 않는다 */
  OUT_TOKENS: 4000,
  /* 캐시 키 `extra`(4-6 — `keyFor(docId, 입력 글, target, 'summarize', 'outline')`) */
  KEY_EXTRA: 'outline',
  PROMPT_VERSION: 1
});

/* `[11-4]` 17-2-1 4-7 · 11-D15 · 11-D20 — 문장 설명(11a) 상수. **추가만** 했다. 무료 티어 숫자 없음(15절). */
export const EXPLAIN = Object.freeze({
  /* 맥락 = 그 문단 글 — 문장을 가운데 두고 앞뒤로 잘라 이 글자 수까지(11-D15) */
  CONTEXT_CHARS: 1500,
  /* `checkExplain` — 결과 ≤ 3문장·400자(약 20–30초) · 넘으면 **문장 경계에서 자른다**(실패 아님) */
  MAX_SENTENCES: 3,
  MAX_CHARS: 400,
  MAX_TERMS: 3,
  TERM_MAX: 80,
  OUT_TOKENS: 600,
  /* 캐시 키 `extra` = `'ctx=' + 문단 해시 앞 12자`(11-D20 — 같은 문장이라도 문단이 다르면 다른 설명) */
  CTX_HASH_CHARS: 12,
  /* 캐시 값의 `promptVersion`(키에는 넣지 않는다 — 7-5). 번역·요약 판본과 따로 센다. */
  PROMPT_VERSION: 1
});

/* `[15-1]` spec 17-13 3 — AI 출제(섹션 복습 묶음의 AI 문제) 상수. **추가만** 했다. 무료 티어 숫자 없음(15절).
   사용량·캐시 `kind` 는 9-2 고정 키 `'quiz'`(`AI.USAGE_KINDS` — 7a 빈 행 무변). 입력 글자 상한은 `ai.maxReqChars`(PIPELINE.MAX_REQ_CHARS). */
export const REVIEW = Object.freeze({
  /* 한 번 누름 = 1호출 · 5문항(15-D5) */
  QUIZ_N: 5,
  /* `maxOutputTokens = 문항 수 × PER_Q + PAD`(아랍어 해설 팽창 — 실기기 확인 거리) */
  OUT_TOKENS_PER_Q: 900,
  OUT_TOKENS_PAD: 200,
  /* 출제 입력 문단 — kind `body`·`list`, 60자 이상(요약 대상 규칙과 같은 값) */
  PARA_KINDS: Object.freeze(['body', 'list']),
  PARA_MIN_CHARS: 60,
  /* 근거 인용 최소 글자(지시문 "20–200 characters" — 짧은 인용은 아무 문단에나 맞아 근거가 못 된다) */
  EVIDENCE_MIN: 20,
  /* AI 문항 sectionId 머리(`ai-p{a}-{b}` — 원서 파서 id 와 겹치지 않는다) · id 줄기 해시 글자 수 */
  SECTION_PREFIX: 'ai-p',
  ID_HASH_CHARS: 8,
  /* 캐시 값·저장 레코드의 `promptVersion`(키에는 넣지 않는다 — 7-5). 번역·요약·설명 판본과 따로 센다. */
  PROMPT_VERSION: 1
});

/* `[16-1]` spec 17-14 2·3 — 그림 개념도(요청·검증·배치) 상수. **추가만** 했다. 무료 티어 숫자 없음(15절).
   사용량·캐시 `kind` 는 `AI.DIAGRAM_KIND`. 입력 = 저장한 개요(11c)뿐 — 원문을 다시 보내지 않는다(16-D2). */
export const DIAGRAM = Object.freeze({
  /* 16-D3 — 360px 폰에서 읽을 수 있는 크기. 남은 관계가 이보다 적으면 `few-relations`(캐시 0) */
  MAX_NODES: 12,
  MAX_EDGES: 16,
  MIN_EDGES: 2,
  /* 16-D5 — 관계 종류 고정 8개, '치료' 없음(a → b 를 위 → 아래로 읽는다) */
  RELS: Object.freeze(['cause', 'leads', 'part', 'type', 'sign', 'test', 'assoc', 'contrast']),
  /* `checkDiagram` — 라벨·원어 ≤ 60자, 제목 ≤ 120자(넘으면 숫자를 쪼개지 않고 자른다) */
  LABEL_MAX: 60,
  TITLE_MAX: 120,
  /* DOC(경로 꼬리표 줄들) 글자 상한 — 넘으면 3단을 빼고 2단까지, 그래도 넘으면 보내지 않는다 */
  INPUT_MAX: 4000,
  OUT_TOKENS: 1500,
  /* 캐시 값의 `promptVersion`(키에는 넣지 않는다 — 7-5). 다른 판본과 따로 센다. */
  PROMPT_VERSION: 1,
  /* 3 배치(`text/diagram.js` `layoutDiagram` 의 `P` 기본값 — px). 노드 상자 폭 ≤ NODE_MAX_W(글 폭은 양옆 PAD_X 를 뺀 것). */
  LAYOUT: Object.freeze({
    NODE_MAX_W: 140, MAX_LINES: 3, ELLIPSIS: '…',
    PAD_X: 8, PAD_Y: 6, LINE_H: 16, SRC_LINE_H: 13, MIN_NODE_W: 40,
    GAP_X: 24, DUMMY_GAP: 12, GAP_Y: 44, FOLD_GAP_Y: 14, FOLD_INDENT: 20, MARGIN: 8,
    LABEL_PAD_X: 4, LABEL_H: 14, LABEL_NUDGE: 10,
    /* 무게중심 훑기 횟수(아래 → 위 번갈아) */
    SWEEPS: 4,
    /* `measure` 를 주지 않았을 때의 글자 폭(글자 수 × 이 값 — 시험·대비용) */
    CHAR_W: 7
  })
});

/* ────────────────────────────────────────────────────────
   `[12-1]` 17-11 3·4 — 기억 카드(SRS) 상수. **추가만** 했다. 호출 0(카드·복습·뒷면 채우기 전부 기기 안).
   SM-2 + Anki 식 4단추 변형(12-D4): 다시 10분 · 어려움 ×1.2 · 쉬움 ×1.3 · ease 바닥 1.3 · 최대 365일.
   ──────────────────────────────────────────────────────── */
export const SRS = Object.freeze({
  DAY_MS: 86400000,
  /* "다시" — 지금부터 이만큼 뒤(12-D12) */
  AGAIN_MS: 10 * 60 * 1000,
  MAX_INTERVAL_DAYS: 365,
  /* sm2 처음 값 `{ease, interval(일), reps, lapses}` */
  START: Object.freeze({ ease: 2.5, interval: 0, reps: 0, lapses: 0 }),
  EASE_MIN: 1.3,
  /* 단추별 ease 변화 — 다시 −0.20 · 어려움 −0.15 · 쉬움 +0.15(좋음은 그대로) */
  EASE_DELTA: Object.freeze({ again: -0.2, hard: -0.15, good: 0, easy: 0.15 }),
  HARD_FACTOR: 1.2,
  EASY_BONUS: 1.3,
  /* 처음 매길 때의 간격(일) — 좋음 1 → 두 번째 좋음 6 · 어려움 1 · 쉬움 4 */
  FIRST_DAYS: Object.freeze({ hard: 1, good: 1, easy: 4 }),
  SECOND_GOOD_DAYS: 6,
  GRADES: Object.freeze(['again', 'hard', 'good', 'easy']),
  /* 하루 새 카드(`srs.newPerDay` 기본 — 12-D11). 설정 값은 0–100 으로 자른다. */
  NEW_PER_DAY: 20,
  NEW_PER_DAY_MAX: 100,
  /* 한 장 매기기 시간 상한(자리를 비운 시간을 세지 않음 — 12-3) · 하루 기록 `srs.log` 를 남기는 날 수 */
  MAX_REVIEW_MS: 60000,
  LOG_DAYS: 60,
  /* 문장 카드 `origin`(17-11 4) · id 머리(12-D7) */
  ORIGINS: Object.freeze(['band', 'tap', 'explain', 'select', 'voice']),
  ID_PREFIX: 'sc:'
});

/* ────────────────────────────────────────────────────────
   `[20-1]` 17-16 2·3·4 — 필기·하이라이트 상수. **추가만** 했다. 호출 0 · DB 버전 3 그대로(`annotations` 필드만).
   ──────────────────────────────────────────────────────── */
export const ANNO = Object.freeze({
  KINDS: Object.freeze(['highlight', 'note']),
  COLORS: Object.freeze(['yellow', 'green', 'blue', 'pink']),
  /* 인용 `quote.exact` 최대 글자 — 넘는 선택은 같은 `group` 의 레코드 여럿으로 나눈다(20-D5 와 같은 장치) · 앞뒤 문맥 · 메모 */
  QUOTE_MAX: 400,
  CONTEXT: 32,
  NOTE_MAX: 2000,
  /* 접은 글자(공백·대소문자·하이픈)로 찾기(4단계)는 인용이 이만큼 길거나 앞뒤 문맥이 이만큼 맞을 때만 받는다(짧은 낱말 오탐 방지) */
  FUZZY_MIN_CHARS: 12,
  FUZZY_MIN_CONTEXT: 8,
  /* 원본 보기 필기 상자 상한(쪽마다) — 넘으면 줄 통째 상자로 합친다 */
  MAX_BOXES_PAGE: 200,
  /* `Highlight.priority` — 겹치면 낭독이 맨 위, 그다음 검색, 필기가 맨 아래(20-D9) */
  PRIORITY: Object.freeze({ ANNO: 0, SEARCH: 1, SPEAKER: 2 }),
  ID_PREFIX: 'ann:'
});

/* ────────────────────────────────────────────────────────
   `[13-1]` 17-12 2·3·4 — 학습 계획·낭독 기록 상수. **추가만** 했다. 호출 0. 점수를 예측하지 않는다(13-D11).
   기본 낭독 속도·쪽 글자·1만 자당 호출은 `[가정]`/옛 실측 — 이 기기 실측(`reading.log`·사용량)이 있으면 그것이 이긴다.
   ──────────────────────────────────────────────────────── */
export const PLAN = Object.freeze({
  /* 낭독 기록(`plan/readlog.js`) — `linechange` 사이가 이보다 길면 넘는 몫은 세지 않는다(멈춘 엔진·자리 비움) · 쓰기 간격 · 남기는 날 수 */
  MAX_GAP_MS: 120000,
  FLUSH_MS: 60000,
  LOG_DAYS: 60,
  LOG_V: 1,
  /* 읽은 쪽 레코드 `progress {docId, sectionId:'@read', ranges, pages, updatedAt}` — 퀴즈 섹션 id(로마숫자·`sec-none`)와 겹치지 않는다 */
  READ_SECTION: '@read',
  /* 모드 갈래 — `src`(번역 끔·show) · `both`(speak + 원문도) · `tr`(speak, 원문 안 읽음) */
  BUCKETS: Object.freeze(['src', 'both', 'tr']),
  /* 속도 실측 — 최근 이 날 수(오늘 포함) 합이 이 시간 이상이면 실측. 아니면 기본 추정(원문 글자/분 × tts.rate) `[가정]` */
  SPEED_DAYS: 14,
  MEASURE_MIN_MS: 30 * 60 * 1000,
  DEFAULT_CPM: Object.freeze({ src: 840, both: 370, tr: 660 }),
  /* 쪽 글자를 모를 때(범위·readStats 모두 없음) `[가정]` */
  DEFAULT_PAGE_CHARS: 3000,
  /* 1만 자당 호출 — 내 사용량 최근 30일 `charsTranslated` 합이 이 글자 이상일 때만 실측(`ui/usage.js` `callsPer10k(rows, {minChars})`), 아니면 1.7 `[실측 2026-09-28]` */
  CALLS_DAYS: 30,
  CALLS_MIN_CHARS: 30000,
  DEFAULT_CALLS_PER_10K: 1.7,
  /* 하루 호출이 상한 × 이 비율을 넘으면 `overCap`(탭·단어·요약 몫을 남긴다 — 안내 한 줄만, 설정은 바꾸지 않는다 13-D10) */
  CAP_SHARE: 0.8,
  /* 여유가 이 날 수 미만이면 `tight` */
  TIGHT_SLACK_DAYS: 2,
  /* 오늘 복습 — 장당 시간을 모를 때(`srs.log` 최근 14일 n 0) `[가정]` */
  REVIEW_SEC_DEFAULT: 8,
  EXAMS_MAX: 5,
  /* `[13-2 — spec 17-12 2]` 낭독 글자 ÷ 검색 글자(남은 글자는 검색 글자, 속도는 낭독 글자). `[실측 2026-11-17]` CMDT 2026 본문 표본 20쪽
     (앱 추출 경로 — 문장 단위 `src`, 인용 뺌 ÷ `searchText.text`): 83,841 ÷ 86,759 = **0.966**(쪽 중앙 0.988 · 범위 0.819–0.995). 차 3.4% 가
     설계 문턱 5% 안이라 계수를 두지 않는다(1 — 남은 시간이 조금 크게 = 안전 쪽). `planFor({textToSpoken})` 가 받는다. */
  TEXT_TO_SPOKEN: 1
});

/* ────────────────────────────────────────────────────────
   `[8a]` 7-6 · 10-2 · 7-5 — 번역 파이프라인 상수. **추가만** 했다.
   ★ 무료 티어 한도 숫자는 여기에도 없다(15절). 상한은 사용자의 `ai.dailyCap` 이다.
   ──────────────────────────────────────────────────────── */
export const PIPELINE = Object.freeze({
  /* 7-6 — 요청 하나의 타임아웃. 넘으면 abort 하고 `cooldown`. */
  TIMEOUT_MS: 30000,

  /* 7-6 — 5xx·네트워크 오류·타임아웃 뒤 쉬는 시간. 연달아 실패하면 한 단계씩, 최대 3단계.
     성공하면 첫 단계로 돌아간다. */
  COOLDOWN_STEPS_MS: Object.freeze([30000, 60000, 120000]),

  /* 7-6 — **자동 재시도는 5xx 에 대해 즉시 1회만.** 그 밖의 어떤 경우에도 0. */
  SERVER_RETRIES: 1,

  /* 10-2 밀림 방지 — `len(번역) / len(원문)` 이 [1/5, 5] 밖이면 그 항목 `failed`.
     분수로 둔다 — 0.2 는 이진 부동소수에 정확히 담기지 않는다(tokens.js 와 같은 이유). */
  LEN_RATIO_MIN_NUM: 1,
  LEN_RATIO_MIN_DEN: 5,
  LEN_RATIO_MAX: 5,

  /* 10-2 `[수정 2026-10-10 — 운영자 결정]` 원문(`Unit.src`)이 이 글자 수 **미만**이면 길이 비율을
     보지 않는다(숫자 보존 검사는 그대로). `ECG.` 같은 약어 한 낱말은 아랍어로 풀어 쓰면 5배를 넘는다. */
  SHORT_SRC_CHARS: 20,

  /* 10-2 — 한 청크에서 밀림 검사(길이 비율·숫자 소실)에 걸린 항목이 이 비율을 **넘으면**
     청크 전체를 파싱 실패로 본다. 1/5 = 20%. */
  CHUNK_FAIL_NUM: 1,
  CHUNK_FAIL_DEN: 5,

  /* 10-2 — `maxOutputTokens = estimateTokens(입력) × 3 + 200`, `temperature 0.2`. */
  OUT_TOKEN_FACTOR: 3,
  OUT_TOKEN_PAD: 200,
  TEMPERATURE: 0.2,

  /* 7-5 · 9-3 — `ai.cacheLimitMB` 설정이 없을 때의 상한과, 최근 정리 때 남길 여유(상한의 90% 까지 지운다).
     여유를 두지 않으면 상한 근처에서 쓸 때마다 한 항목씩 지우는 정리가 매번 돈다. */
  CACHE_LIMIT_MB: 200,
  CACHE_TRIM_NUM: 9,
  CACHE_TRIM_DEN: 10,

  /* 7-1 원칙 3 — `ai.maxReqChars` 설정이 없을 때 요청 하나의 원문 글자 상한. */
  MAX_REQ_CHARS: 6000
});

/* ────────────────────────────────────────────────────────
   `[8b-1]` 7-8-6 — 낭독 동반 번역 상수. **추가만** 했다.
   ★ 무료 티어 한도 숫자는 여기에도 없다(15절).
   ──────────────────────────────────────────────────────── */
export const READALONG = Object.freeze({
  /* 창 `READ_AHEAD_CHARS = ai.maxReqChars(기본 PIPELINE.MAX_REQ_CHARS) × 이 값` = 9,000자.
     숫자를 두 곳에 두지 않는다. 선행 요청 문턱 = 창 − maxReqChars(기본 3,000) —
     덮인 거리가 이 이하로 떨어지면 다음 청크를 보낸다. maxReqChars 를 바꾸면 같은 비율로 따라간다. */
  READ_AHEAD_FACTOR: 1.5,

  /* 냉시작(커서 문장이 아직 메모리에 없음) head 청크 크기. 0 이면 head 를 끈다(RA12 의 스텁). */
  HEAD_CHARS: 600,

  /* speak 모드에서 번역 도착을 기다리는 상한(6-2 `tr-wait`). [가정] 8b 실기기에서 조정 */
  TR_WAIT_MS: 4000,

  /* 연속 이만큼 `tr-wait` 이 상한으로 끝나면 `lagging` 을 한 번 알린다(6-2). */
  LAG_NOTICE_AFTER: 3,

  /* 번역문 300자 분할 경계(6-4 · RA11). 대상 언어가 바뀌어도 해가 없는 문자들. */
  SPLIT_BREAKS_TR: Object.freeze(['،', '؛', ',', ';']),

  /* [가정] 번역문 워치독용 초당 글자 수(7-8-6 `TTS.CHARS_PER_SEC_TR`). 8b 실기기에서 잰다.
     TTS 블록은 8b-1 의 수정 범위 밖이라 이 블록에 둔다. */
  CHARS_PER_SEC_TR: 10,

  /* 창을 걸으며 문단을 불러올 때, 문장이 하나도 없는 쪽(표뿐인 쪽 등)을 이만큼까지만 건너뛴다. */
  MAX_EMPTY_PAGES: 20,

  /* 음성 목록이 "안정됐다"고 보는 시간 — 첫 응답 뒤 이만큼 목록이 바뀌지 않으면.
     [가정] Android 가 기본 언어 음성만 먼저 주고 나머지를 `voiceschanged` 로 늦게 주는 경우
     (2026-10-10 운영자 폰). "음성 없음" 판정·알림은 안정된 뒤에만 한다. */
  VOICES_SETTLE_MS: 3000,

  /* 번역문·표 안내 발화의 `utterance.lang` 기본 지역(고른 음성이 없을 때). 음성 객체 없이 이 태그만으로
     소리가 나는 것을 확인했다 — 2026-10-10 운영자 폰(Galaxy·Chrome 154) 진단: 목록에 아랍어 음성 0개,
     `lang = 'ar-SA'`·voice 없음으로 발화 → 실제로 아랍어가 들렸다. 원문 언어 표(`TTS_LANG_REGION`)와 겹치는
     언어는 거기서 읽는다(여기는 그 표에 없는 대상 언어만). */
  TR_LANG_REGION: Object.freeze({ ar: 'ar-SA' })
});

/* `[수정 2026-10-12 — 8-4 Nour 키 형식 경고 · 13절 지우개]` 키 **모양의 원본** — 한 곳에만 둔다.
   형식 검사(`AI_KEY_PATTERNS`)와 지우개(`REDACT_PATTERNS`)가 **둘 다 이 문자열에서** 만들어진다.
   예전에는 두 벌이었고, 신형 몸통 `[0-9A-Za-z_-]` 가 좁아서 몸통에 `.`·`~`·`+`·`/`·`=` 가 든 키는
   (가) 정상 키인데 "형식이 낯섭니다" 경고가 떴고(Nour) (나) 지우개가 **키 전체를 놓쳤다**.
   신형 몸통 = 출력 가능 ASCII(\x21-\x7E) 에서 따옴표(" ' `)·꺾쇠(< >)만 뺀 것 — 공백·따옴표·꺾쇠에서
   끊기므로 JSON·HTML·문장 안에서도 키까지만 지운다. 키에 그런 글자가 들어 있으면 경고가 뜨고(경고일 뿐)
   지우개는 그 앞까지만 지운다 — 그 경우는 실제 키 값 그물(`redact` 의 저장된 키)이 받는다.
   길이 하한(20)은 그대로 — "AQ.1 level" 같은 문장을 지우지 않는다. */
export const KEY_SHAPES = Object.freeze({
  GOOGLE_AIZA: 'AIza[0-9A-Za-z_\\-]{30,}',
  GOOGLE_AQ: 'AQ\\.[\\x21\\x23-\\x26\\x28-\\x3B\\x3D\\x3F-\\x5F\\x61-\\x7E]{20,}'
});

/* 8-4 키 형식 검사 — **길이 하한만** 두고 정확한 길이를 강제하지 않는다.
   불일치는 **경고만** 하고 저장을 막지 않는다(형식이 또 바뀔 수 있다).
   경고의 목적은 "다른 프로바이더 키를 잘못 넣었다" 같은 큰 실수를 잡는 것이지 몸통 글자 검사가 아니다. */
export const AI_KEY_PATTERNS = Object.freeze({
  gemini: new RegExp('^(?:' + KEY_SHAPES.GOOGLE_AIZA + '|' + KEY_SHAPES.GOOGLE_AQ + ')$')
});

/* 13절 `redact.js` 가 `[KEY]` 로 지울 것들.
   **정규식 객체가 아니라 source 문자열로 둔다** — `g` 플래그가 붙은 정규식은
   `lastIndex` 를 들고 다녀서, 같은 객체를 두 번 쓰면 두 번째 치환이 조용히
   앞부분을 건너뛴다. `redact` 가 호출마다 새로 컴파일한다.

   목록은 `AI_KEY_PATTERNS` 보다 **넓다**. 지우는 쪽은 넓을수록 안전하고,
   아직 어댑터가 없는 프로바이더(openai·mistral·openrouter)의 키가 오류
   객체를 타고 흘러나오는 경우까지 덮는다. */
export const REDACT_PATTERNS = Object.freeze([
  KEY_SHAPES.GOOGLE_AIZA,        // 구형 Google API 키 — 형식 검사와 같은 상수
  KEY_SHAPES.GOOGLE_AQ,          // 신형 Google API 키 — 형식 검사와 같은 상수
  'Bearer\\s+\\S+',              // 13절이 명시한 형태 (openai-compat 계열)
  'sk-[A-Za-z0-9_\\-]{16,}'      // openai/mistral 계열 키가 헤더 밖에 나왔을 때
]);

/* ────────────────────────────────────────────────────────
   `[8g — spec 17-8-12]` 검색(키워드·제목·목차). **기존 키는 건드리지 않는다.**
   8g-1 은 데이터만(DB 3 · `searchText` 스토어 · 추출이 함께 씀). 화면·엔진은 8g-2~4.
   ──────────────────────────────────────────────────────── */
export const SEARCH = Object.freeze({
  /* 되돌림 스위치(17-8-12 §9) — false 면 입구를 숨기고 **추출도 `searchText` 를 쓰지 않는다**
     (그 쪽의 옛 검색 글자는 같은 트랜잭션에서 지운다 — 다시 켜면 백필이 만든다). DB 버전은 내리지 않는다. */
  ENABLED: true,
  /* 검색 레코드 모양·조립 규칙의 판. 경첩 `sk = VERSION|DERIVED_HASH`(U4) — 오르면 백필이 전부 다시 만든다. */
  VERSION: 1,
  MIN_CHARS: 2,
  MAX_CHARS: 60,
  MAX_HITS_PER_DOC: 1000,
  /* 결과 조각 — 적중 앞뒤 글자 수(낱말 경계로 넓힌다) */
  SNIPPET: 40,
  DEBOUNCE_MS: 250,
  /* 캐시 채우기 getAll 한 번의 쪽 수 / 백필 한 트랜잭션의 쪽 수 */
  READ_BATCH: 200,
  BACKFILL_BATCH: 50,
  /* 개요가 없는 책의 heading 폴백 목차 상한(17-8-6) */
  TOC_FALLBACK_MAX: 200,
  /* 같은 글자가 그 책에서 이만큼 이상 나오는 heading 은 일반 소제목 — 제목 묶음·폴백에서 뺀다(U8) */
  REPEAT_HEADING: 10,
  /* `[8g-3b — 17-8-12 §11-3]` 폴백 후보 규칙(저장 글자 무관 — VERSION 그대로).
     R1 이보다 작은 글자는 뺀다 · R8 이보다 작으면(본문 크기) 대소문자 있는 글은 대문자 제목만 ·
     R5 이보다 긴 줄은 뺀다 · R10 짧은 책의 반복 문턱 하한(문턱 = min(REPEAT_HEADING, max(이것, ⌈쪽 수/2⌉))) */
  TOC_MIN_R: 0.9,
  TOC_WEAK_R: 1.15,
  TOC_MAX_LEN: 80,
  TOC_REPEAT_MIN: 3,
  /* 최근 검색어 칩(기기 안 settings `search.recent`) */
  RECENT_MAX: 5,
  /* 합성어 변형(U7) — KEEP_HYPHEN_PREFIXES 중 이 길이 이상만 붙이고 띄운다 */
  COMPOUND_MIN_PREFIX: 3
});

/* ────────────────────────────────────────────────────────
   `[8l — spec 17-5-1 2 · 19-1-3 §3-2]` 스캔본·글자 깨짐 감지. 판정은 순수 `text/scan.js`, 저장·안내는 UI.
   `documents.scan` 은 스키마 없는 필드라 DB 버전·`algoVersion` 무관. 규칙이 바뀌면 VERSION 을 올린다 —
   옛 판정(`scan.v` < VERSION)은 그 문서를 다음에 열 때 한 번 다시 돈다.
   ──────────────────────────────────────────────────────── */
export const SCAN = Object.freeze({
  VERSION: 1,
  /* 표본: 문서의 FROM–TO 구간을 PROBE 등분한 쪽(PROBE 쪽 이하 문서는 전부) */
  PROBE: 12,
  FROM: 0.10,
  TO: 0.90,
  /* 표본의 NUM/DEN(75%) 이상이 글자 0 이면 스캔본 후보 → 그중 IMG_CONFIRM 쪽만 이미지 연산을 센다 */
  MIN_TEXTLESS_NUM: 3,
  MIN_TEXTLESS_DEN: 4,
  IMG_CONFIRM: 2,
  /* 공백 아닌 글자가 이 수 이하인 쪽 = 글자 0 */
  EMPTY_CHARS: 0,
  /* 19-1-3 §3-2 — 표본 합에서 FFFD·PUA·제어 문자가 NUM/DEN(5%) 이상이면 'garbled'. 표본 합 MIN_CHARS 미만이면 판단하지 않음 */
  GARBLE_NUM: 1,
  GARBLE_DEN: 20,
  GARBLE_MIN_CHARS: 500,
  /* `[8l Build — spec 밖 작은 값]` 첫 쪽 표시를 막지 않게: 추출기가 첫 쪽을 내거나 이만큼 지나면 판정을 시작한다 */
  START_AFTER_MS: 1500
});

/* ────────────────────────────────────────────────────────
   `[18 — spec 17-9]` 의료 사이트 북마크 + 검색어 바로가기 — **링크만**(스크래핑·응답 읽기·계정 정보 없음, 호출 0 — 13절 · E7).
   검증은 순수 `text/links.js`, 저장은 설정 키 `links.medical`(null = 아래 DEFAULTS). `{q}` 자리에 고른 글자가 들어간다.
   ★ 기본 목록은 검색 주소를 2026-11-16 확인한 무료·공개 넷만(결정 18-D3). 추천(SUGGESTED)은 설정 [추천 링크 추가]에서만.
   `check:'unverified'` = 검색 주소 꼴을 아직 확인하지 못함(실기기 몫) · `paid:true` = 유료 구독(Nour 구독 뒤 — N9).
   ──────────────────────────────────────────────────────── */
export const LINKS = Object.freeze({
  MAX: 30,             // 목록 최대 수
  NAME_MAX: 60,        // 이름(앞뒤 공백 뗀 뒤 코드 포인트)
  URL_MAX: 2000,       // 주소 글자 수
  QUERY: '{q}',        // 검색어 자리
  DEFAULTS: Object.freeze([
    Object.freeze({ id: 'medlineplus', name: 'MedlinePlus', url: 'https://vsearch.nlm.nih.gov/vivisimo/cgi-bin/query-meta?v%3Aproject=medlineplus&v%3Asources=medlineplus-bundle&query={q}' }),
    Object.freeze({ id: 'pubmed', name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/?term={q}' }),
    Object.freeze({ id: 'wikipedia-en', name: 'Wikipedia (English)', url: 'https://en.wikipedia.org/w/index.php?search={q}' }),
    Object.freeze({ id: 'dailymed', name: 'DailyMed', url: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?query={q}' })
  ]),
  SUGGESTED: Object.freeze([
    Object.freeze({ id: 'msd-pro', name: 'MSD Manual (Professional)', url: 'https://www.msdmanuals.com/professional/searchresults?query={q}', check: 'unverified' }),
    Object.freeze({ id: 'radiopaedia', name: 'Radiopaedia', url: 'https://radiopaedia.org/search?q={q}', check: 'unverified' }),
    Object.freeze({ id: 'ncbi-bookshelf', name: 'NCBI Bookshelf (StatPearls)', url: 'https://www.ncbi.nlm.nih.gov/books/?term={q}', check: 'unverified' }),
    Object.freeze({ id: 'uptodate', name: 'UpToDate', url: 'https://www.uptodate.com/contents/search?search={q}', check: 'unverified', paid: true })
  ])
});

/* ────────────────────────────────────────────────────────
   `[9c-1 — spec 17-4-1]` 백업·옮기기 — 한 파일 NDJSON(+gzip). 키는 절대 담지 않는다(17-4).
   순수 `text/backup.js` 가 줄을 만들고, 서비스 `backup/export.js` 가 스토어를 커서로 읽어 이어 붙인다.
   ★ 설정 허용 목록은 **명시 목록**이다 — 새 설정 키는 저절로 들어가지 않는다. `settings.js` `DEFAULTS` 의 모든 키가
     `SETTINGS_KEYS`(담음)·`SETTINGS_SKIP`(안 담음) 둘 중 **하나에만** 있어야 한다(tests/backup-9c.test.mjs — 빠지면 빨강).
     12·13(SRS·계획)의 `srs.*`·`reading.*`·`planner.exams` 는 아직 키가 없다 — 12-1·13-1 이 더한다.
     `[12-1]` `srs.newPerDay`·`srs.log`(학습 기록) 담음 — `srs.log` 는 가져올 때 날짜별 큰 값으로 합친다(`backup/import.js` `unionSetting`).
     `[13-1]` `reading.track`·`reading.log`(학습 기록 — `plan/readlog.js` 가 DB 에 직접 씀, 가져올 때 날짜·갈래별 큰 값)·`planner.exams` 담음.
   ──────────────────────────────────────────────────────── */
export const BACKUP = Object.freeze({
  /* 파일 꼴의 판. 가져오기는 이보다 큰 판을 거절한다(17-4-1 3). */
  FORMAT: 1,
  APP: 'medreader',
  /* 내보내기 — 한 트랜잭션에서 읽어 Blob 한 조각으로 만드는 줄 수(9c-D6). JS 힙에는 이만큼만 남는다. */
  BATCH: 1000,
  /* 가져오기(9c-2) — 한 트랜잭션에 쓰는 줄 수(9c-D6). */
  IMPORT_BATCH: 500,
  /* "마지막 백업 n일 전" 이 이 날 수를 넘으면 그 줄만 주의 색(9c-D8). */
  STALE_DAYS: 30,
  FILE_PREFIX: 'medreader-backup-',
  /* 스토어 순서 — 파일도 이 순서(가져오기가 `documents` 로 docId 맞추기 표를 먼저 만든다). 담지 않는 것: blobs(책별 PDF 따로)·
     pages·searchText·sections(파생 — 다시 추출) — 17-4-1 2. `questions` 는 `source:'ai'` 만. */
  STORES: Object.freeze(['documents', 'settings', 'usage', 'progress', 'attempts', 'mistakes', 'questions', 'cards', 'annotations', 'aiCache']),
  /* 캐시 끄기(17-4-1 6)로 빠지는 스토어 */
  CACHE_STORE: 'aiCache',
  /* `[9c-1b — 9c1R #1]` 백업 줄 지우개·설정 행 빼기의 키 모양(source 문자열 — 쓰는 쪽이 새로 컴파일). `REDACT_PATTERNS`(로그·오류·요청 검사)는
     **넓은 그대로** 두고 백업만 좁힌다 — 백업은 사용자 글자(단어 문맥·필기·제목·검색어)를 담으므로 넓은 꼴이 낱말을 지우면 파일 글자가 영구히 바뀐다.
     Google 꼴은 `KEY_SHAPES` 그대로. `sk-` 는 왼쪽 경계(앞이 영숫자·하이픈이 아님 — `low-risk-to-…`·`task-sk-…` 안에서 걸리지 않게)·
     키 글자 집합·몸통 20자 이상. `Bearer` 는 뒤 토큰이 키 꼴일 때만 — 토큰 글자 집합(RFC 6750 b64token)·12자 이상·**숫자 하나 이상**
     (낱말 "Bearer of …"·"Bearer responsibilities" 는 남는다. 무작위 토큰에 숫자가 없을 확률은 무시할 만하다).
     `[9c-1c — 9c1bR #1·#2·#4]` `sk-` 경계에 "URL 인코딩 `%XX` 바로 뒤"·"글자 그대로 적힌 이스케이프(`\n`·`\t`·`\r`·`\b`·`\f`·`\"`·`\'`·`\/`·`\uXXXX`) 바로 뒤"를
     더한다 — 한 글자 경계는 `%20` 의 `0`·`\n` 의 `n` 을 영숫자로 봐서 `%20sk-…`·붙여 넣은 JSON 의 `\nsk-…` 를 놓쳤다. 영숫자·하이픈에 바로 붙은 꼴
     (`abcsk-…`·`api-key-sk-…`)은 합성어와 구별이 안 돼 남긴다(기록). `Bearer` 는 대소문자 무시·`%20`·`:` 뒤도 보고, 토큰은 "숫자 하나 이상(12자 이상)
     **또는** 20자 이상" — 숫자 없는 긴 토큰(접두 없는 32자 키)도 지운다. "Bearer responsibilities"(16자)·"bearer bonds" 는 그대로.
     `[9c-2 — 9c1cR #2·#3]` `sk-` 경계에 JSON 밖 이스케이프·이중 인코딩 뒤를 더한다 — `\xXX`·8진 `\ooo`·`%uXXXX`·이중 퍼센트 인코딩
     `%25XX`·quoted-printable `=XX`(9c-1 판은 지웠고 9c-1c 판은 놓쳤다). `Bearer` 에는 왼쪽 경계 — 앞이 글자·하이픈이면 보지 않는다
     (`standard-bearer`·`weight-bearer`·`pallbearer` 뒤 긴 낱말 오탐). 단 `%XX`·글자 그대로 적힌 이스케이프(`\n` 등) 바로 뒤는 `sk-` 와 같이 본다. */
  KEY_PATTERNS: Object.freeze([
    KEY_SHAPES.GOOGLE_AIZA,
    KEY_SHAPES.GOOGLE_AQ,
    '(?:(?<![A-Za-z\\-])|(?<=%[0-9A-Fa-f]{2})|(?<=\\\\[nrtbf"\'/]))[Bb][Ee][Aa][Rr][Ee][Rr](?:\\s+|%20|:\\s*)(?:(?=[A-Za-z0-9._~+/=\\-]*[0-9])[A-Za-z0-9._~+/=\\-]{12,}|[A-Za-z0-9._~+/=\\-]{20,})',
    '(?:(?<![A-Za-z0-9\\-])|(?<=%(?:25)?[0-9A-Fa-f]{2})|(?<=\\\\[nrtbf"\'/])|(?<=\\\\u[0-9A-Fa-f]{4})|(?<=\\\\x[0-9A-Fa-f]{2})|(?<=%u[0-9A-Fa-f]{4})|(?<=\\\\[0-7]{3})|(?<==[0-9A-F]{2}))sk-[A-Za-z0-9_\\-]{20,}'
  ]),
  /* `[9c-2 — 9c1R #10]` 가져오기 줄 하나의 글자 수 상한. 줄바꿈 없는 엉뚱한 파일(PDF 를 잘못 고름 등)을 끝까지 이어 붙이지 않는다 —
     첫 줄 전에 넘으면 "백업 파일이 아님", 그 뒤면 그 줄만 버린다. 이 앱의 가장 긴 줄(큰 책의 개요·긴 필기)도 수백 KB 다. */
  MAX_LINE_CHARS: 8 * 1024 * 1024,
  /* `documents` 의 사용자 몫 필드(17-4-1 2). `extraction`·`sectionIndex*` 와 모르는 필드는 담지 않는다.
     `outlineV` 는 `outline` 을 읽은 판(search/outline.js) — 없으면 개요를 "아직 못 읽음"으로 본다(9c-1 Build 정정). */
  DOC_FIELDS: Object.freeze(['id', 'title', 'fileName', 'size', 'pageCount', 'fileHash', 'addedAt', 'lastOpenedAt', 'lastPage',
    'lastLineId', 'lang', 'langSource', 'langGuess', 'domain', 'readStats', 'outline', 'outlineV', 'pageLabels', 'scan', 'columnsHint']),
  /* 담는다(17-4-1 4). `reader.*`·`readalong.*` 는 DEFAULTS 에서 펼친 목록. */
  SETTINGS_KEYS: Object.freeze([
    'ui.lang', 'ui.theme',
    'reader.view', 'reader.fontSize', 'reader.lineHeight', 'reader.letterSpacing', 'reader.font', 'reader.showDone', 'reader.autoScroll',
    'tts.rate', 'tts.unit', 'tts.repeat.count', 'tts.autoSummarize', 'tts.wakeLock', 'tts.readCitations', 'tts.scriptSwitch', 'tts.mediaKeys',
    'voice.enabled', 'voice.cmdLang', 'voice.sayErrors',
    'readalong.mode', 'readalong.speakSource', 'readalong.display', 'readalong.lastOn',
    'search.recent', 'vocab.lastExportAt', 'links.medical',
    'srs.newPerDay', 'srs.log',
    'reading.track', 'reading.log', 'planner.exams',
    'ai.provider', 'ai.model', 'ai.translationLang', 'ai.summaryLangs', 'ai.useOnDevice', 'ai.dailyCap', 'ai.warnAt',
    'ai.cacheLimitMB', 'ai.maxReqChars',
    'privacy.piiCheck'
  ]),
  /* 담지 않는다 — 기기 몫(목소리 URI·억양·인식 태그)·개인정보 몫(마이크 고지·AI 전송 동의·키 기억 여부 — 9c-D5)·
     새 기기가 다시 볼 것(온보딩)·진단(`dev.debug`·`ai.proxyUrl`)·백업 자신(`backup.*`). */
  SETTINGS_SKIP: Object.freeze([
    'tts.voice.en', 'tts.voice.ar', 'tts.voice.fr', 'tts.voice.ko', 'tts.voice.es',
    'tts.accent.en', 'tts.accent.ar', 'tts.accent.fr', 'tts.accent.ko', 'tts.accent.es',
    'voice.tag', 'voice.noticeAt',
    'privacy.consentedAt', 'privacy.rememberKey',
    'onboarding.done', 'dev.debug', 'ai.proxyUrl',
    'backup.lastExportAt'
  ])
});
