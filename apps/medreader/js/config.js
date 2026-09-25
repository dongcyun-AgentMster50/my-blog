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
  HEADER_FONT_RATIO: 1.1,
  HEADER_UPPER_RATIO: 0.6,
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
  PAGE_POLL_MS: 200,

  /* 6-5 자동 스크롤 "편안 영역" 과 사용자 스크롤 구분 창 */
  COMFORT_TOP: 0.30,
  COMFORT_BOTTOM: 0.65,
  USER_SCROLL_MS: 800
});

/* 6-1 — 기호 소수(少數)만 읽기 쉬운 낱말로. 연속 대문자 약어는 건드리지 않는다.
 * 키는 **한 글자**이거나 짧은 기호 문자열이고, 치환은 앞뒤에 공백을 붙여 들어간다
 * ("≥4" → "greater than or equal to 4"). 원서 텍스트 자체는 바뀌지 않는다 —
 * 낭독용 사본에서만 갈아 낀다.
 */
export const TTS_SYMBOLS = Object.freeze({
  '≥': 'greater than or equal to',
  '≤': 'less than or equal to',
  '±': 'plus or minus',
  'µ': 'micro',
  'μ': 'micro',
  '→': 'to',
  '%': 'percent'
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

  /* 렌더 canvas 의 devicePixelRatio 상한. 3.0× 줌 × dpr 3 이면 한 변이
     5000px 을 넘어 저사양 기기에서 canvas 할당이 실패한다. */
  DPR_MAX: 2
});
