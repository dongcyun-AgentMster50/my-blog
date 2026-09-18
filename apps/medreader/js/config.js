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

export const PDFJS_VERSION = '6.3.289';

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
  RUN_GAP_FACTOR: 2.0,

  /* 4-5 컬럼 판별 */
  GUTTER_MIN_RATIO: 0.55,
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
