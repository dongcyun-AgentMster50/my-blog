/* ============================================================
   MedReader — PDF 특성 측정의 순수 집계 계층 (spec 2-4)

   I/O 를 모른다. pdf.js 도 모른다. 파일 시스템도 모른다.
   입력은 buildPageLayout() 의 결과(PageLayout)와 페이지별 계측값이고
   출력은 집계 객체·사람이 읽는 보고서 문자열·BOOK_PROFILE 초안 문자열이다.

   dev/profile.mjs 가 이 모듈을 쓴다. 앱 본체는 쓰지 않는다.
   js/ 아래 모듈은 **읽기만** 한다(import).
   ============================================================ */

import { LAYOUT } from '../js/config.js';
import { normalizeRepeatKey } from '../js/text/blocks.js';
import { toStored } from '../js/text/store.js';

/* ────────────────────────────────────────────────────────
   작은 집계 유틸 — 전부 순수 함수
   7000쪽에서도 메모리가 늘지 않도록 "값의 배열"을 쌓지 않고
   양자화한 히스토그램(정수 bucket → 개수)만 쌓는다.
   ──────────────────────────────────────────────────────── */

export function bump(map, key, n = 1) {
  map.set(key, (map.get(key) || 0) + n);
  return map;
}

/**
 * 키 개수 상한이 있는 카운터. 상한에 닿으면 1회짜리 키를 먼저 버린다.
 * (머리말·꼬리말 정규화 키처럼 종류가 문서 크기에 비례하는 집계용)
 */
export function bumpCapped(map, key, cap = 20000) {
  if (!map.has(key) && map.size >= cap) {
    for (const [k, v] of map) if (v <= 1) map.delete(k);
    if (map.size >= cap) return map;          // 전부 2회 이상이면 새 키는 버린다
  }
  return bump(map, key);
}

export function newHist(step) {
  return { step: step, map: new Map(), n: 0, sum: 0, min: Infinity, max: -Infinity };
}

export function histAdd(h, v, w = 1) {
  const x = Number(v);
  if (!Number.isFinite(x)) return h;
  bump(h.map, Math.round(x / h.step), w);
  h.n += w;
  h.sum += x * w;
  if (x < h.min) h.min = x;
  if (x > h.max) h.max = x;
  return h;
}

// 양자화 오차(±step/2)를 감수한 분위수. 빈 히스토그램이면 null.
export function histQuantile(h, q) {
  if (!h || !h.n) return null;
  const keys = Array.from(h.map.keys()).sort(function (a, b) { return a - b; });
  const target = q * h.n;
  let acc = 0;
  for (let i = 0; i < keys.length; i++) {
    acc += h.map.get(keys[i]);
    if (acc >= target) return keys[i] * h.step;
  }
  return keys[keys.length - 1] * h.step;
}

export function histMode(h) {
  if (!h || !h.n) return null;
  const keys = Array.from(h.map.keys()).sort(function (a, b) { return a - b; });
  let best = keys[0], bestN = h.map.get(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    const n = h.map.get(keys[i]);
    if (n > bestN) { best = keys[i]; bestN = n; }
  }
  return best * h.step;
}

export function histStats(h) {
  if (!h || !h.n) return { n: 0, min: null, max: null, mean: null, p50: null, p90: null, p99: null, mode: null };
  return {
    n: h.n,
    min: h.min,
    max: h.max,
    mean: h.sum / h.n,
    p50: histQuantile(h, 0.5),
    p90: histQuantile(h, 0.9),
    p99: histQuantile(h, 0.99),
    p995: histQuantile(h, 0.995),
    mode: histMode(h)
  };
}

// 값이 많은 순, 동률이면 키 사전순(결정성).
export function topEntries(map, n = 10) {
  const rows = Array.from(map.entries());
  rows.sort(function (a, b) {
    if (b[1] !== a[1]) return b[1] - a[1];
    return String(a[0]) < String(b[0]) ? -1 : (String(a[0]) > String(b[0]) ? 1 : 0);
  });
  return n > 0 ? rows.slice(0, n) : rows;
}

/* 표본이 충분한 최대 키. 꼬리에 1~2건 붙는 오검출(표 안의 큰 수가 문항 번호로 보이는 것 등)이
 * 상한을 끌어올리는 것을 막는다. 기준: 전체의 0.1% 이상이면서 3건 이상. */
export function robustMaxKey(map, minShare = 0.001, minCount = 3) {
  const total = sumValues(map);
  if (!total) return 0;
  let best = 0;
  for (const [k, v] of map) {
    const key = Number(k);
    if (!Number.isFinite(key)) continue;
    if (v >= minCount && v >= total * minShare && key > best) best = key;
  }
  return best;
}

// 개수가 n 이상인 키의 수 (반복 머리말·꼬리말 판정용)
export function countAtLeast(map, n) {
  let c = 0;
  for (const v of map.values()) if (v >= n) c++;
  return c;
}

export function sumValues(map) {
  let s = 0;
  for (const v of map.values()) s += v;
  return s;
}

/* ────────────────────────────────────────────────────────
   패턴 분류기 — 전부 순수 함수, 단위 테스트 대상
   ──────────────────────────────────────────────────────── */

/** 문항 번호 후보 형식. 순서가 중요하다(로마숫자를 알파벳보다 먼저 본다). */
export const Q_FORMATS = [
  ['roman-dash-num', /^\s*([IVXLCDM]{1,7})-(\d{1,6})\.\s+\S/],
  ['alpha-dash-num', /^\s*([A-Za-z]{1,5})-(\d{1,6})\.\s+\S/],
  ['num-dot', /^\s*()(\d{1,6})\.\s+\S/],
  ['num-paren', /^\s*()(\d{1,6})\)\s+\S/],
  ['num-bracket', /^\s*()\[(\d{1,6})\]\s*\S/],
  ['q-num', /^\s*(Q)\s?(\d{1,6})\s*[.):\s]/i],
  ['hash-num', /^\s*(#)\s?(\d{1,6})\s*[.):\s]/],
  ['ko-munje', /^\s*(문제)\s*(\d{1,6})\s*[.):\s]?/],
  ['ja-mon', /^\s*(問)\s*(\d{1,6})/]
];

/**
 * 줄·문단 머리의 문항 번호 형식을 판정한다.
 * @returns {{format:string, prefix:string|null, number:number, digits:number, rest:string}|null}
 */
export function classifyQuestionNumber(text) {
  const t = String(text == null ? '' : text);
  for (let i = 0; i < Q_FORMATS.length; i++) {
    const name = Q_FORMATS[i][0];
    const m = t.match(Q_FORMATS[i][1]);
    if (!m) continue;
    const digits = String(m[2]).length;
    return {
      format: name,
      prefix: m[1] ? m[1] : null,
      number: Number(m[2]),
      digits: digits,
      rest: t.slice(m[0].length - 1).trim()
    };
  }
  return null;
}

/** 캡션 접두어 후보. 언어를 가리지 않는다(라틴 + CJK + 한글). */
export const CAPTION_PREFIXES = new Set([
  'FIGURE', 'FIG', 'FIGS', 'TABLE', 'TAB', 'CHART', 'BOX', 'EXHIBIT', 'PLATE',
  'SCHEME', 'APPENDIX', 'ALGORITHM', 'PANEL', 'DIAGRAM', 'GRAPH', 'IMAGE',
  'FIGURA', 'TABLA', 'CUADRO', 'ABBILDUNG', 'TABELLE', 'TABLEAU'
]);
export const CAPTION_CJK = ['표', '그림', '도표', '사진', '図', '表', '圖', '写真'];

/** 캡션 접두어 바로 뒤 토큰의 **형태**. 값이 아니라 문법만 본다. */
export function classifyCaptionNumber(token) {
  const t = String(token == null ? '' : token).trim();
  if (!t) return 'none';
  if (/^\d+[.\-–]\d/.test(t)) return 'digit-dash-digit';
  if (/^\d/.test(t)) return 'digit';
  if (/^[IVXLCDM]{1,7}[-–.]\s?\d/.test(t)) return 'roman-dash-digit';
  if (/^[A-Za-z]{1,4}[-–.]\s?\d/.test(t)) return 'alpha-dash-digit';
  if (/^[IVXLCDM]{1,7}[.:]?$/.test(t)) return 'roman';
  return 'other';
}

/**
 * 캡션 후보 줄을 접두어 + 뒤 토큰 형태로 분해한다.
 * @returns {{prefix:string, shape:string, token:string}|null}
 */
export function classifyCaption(text) {
  const t = String(text == null ? '' : text).replace(/^\s+/, '');
  if (!t) return null;
  for (let i = 0; i < CAPTION_CJK.length; i++) {
    const p = CAPTION_CJK[i];
    if (t.startsWith(p)) {
      const rest = t.slice(p.length).replace(/^[\s.:]+/, '');
      const tok = (rest.match(/^\S{0,24}/) || [''])[0];
      return { prefix: p, shape: classifyCaptionNumber(tok), token: tok };
    }
  }
  const m = t.match(/^([A-Za-z]{2,12})\s*\.?\s*(\S{0,24})/);
  if (!m) return null;
  const word = m[1].toUpperCase();
  if (!CAPTION_PREFIXES.has(word)) return null;
  return { prefix: word, shape: classifyCaptionNumber(m[2]), token: m[2] };
}

/** 코드에 현재 박혀 있는 정규식들 — 죽은 코드 여부를 재기 위한 사본(읽기 전용). */
export const CURRENT_CODE_RE = Object.freeze({
  // blocks.js classifyRoles — figure-caption
  figureCaption: /^(FIGURE|FIG\.|TABLE)\s*\d/i,
  // blocks.js findCaption — 표 region 과 캡션 합치기
  tableCaption: /^TABLE\s*\d/i,
  // segment.js isOptionStart
  optionStart: /^\s*[A-E]\.\s+\S/,
  // segment.js QUESTION_RE
  questionStart: /^\s*(?:([IVXLC]{1,5})-)?(\d{1,3})\.\s+\S/,
  // segment.js ANSWER_RE
  answerStart: /^\s*(?:([IVXLC]{1,5})-)?(\d{1,3})\.\s+the\s+answers?\s+(?:is|are)\s+([A-E](?:\s*(?:,|and|&)\s*[A-E])*)\b/i,
  // blocks.js classifyRoles — pageno
  pageNo: /^\s*\d{1,4}\s*$/,
  // blocks.js classifyRoles — header
  headerPrefix: /^(SECTION|CHAPTER|PART)\b/i,
  // blocks.js classifyRoles — footer
  footerPrefix: /^(©|copyright|harrison|mcgraw)/i,
  // blocks.js hasUnitTokens
  unitTokens: /(\b\d+(\.\d+)?\b.*\b(mg|mcg|µg|g|kg|mL|L|PO|IV|IM|SC|%)\b)|(\bq\d+h\b)/i,
  // blocks.js newParagraph / paragraphKind
  bullet: /^[•·▪\-–]\s/
});

/** 정답 문구 후보 — 언어 중립으로 "번호 뒤 상용구"를 n-gram 으로 본다. */
export function ngramsOf(text, sizes = [3, 4]) {
  const words = String(text == null ? '' : text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  const out = [];
  for (let s = 0; s < sizes.length; s++) {
    const k = sizes[s];
    if (words.length < k) continue;
    out.push(words.slice(0, k).join(' '));
  }
  return out;
}

/** 글자 계통 분포 — lang 추정용. 문자열을 저장하지 않는다. */
export function tallyScripts(text, out) {
  const t = String(text == null ? '' : text);
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c < 0x30) continue;
    if (c <= 0x39) { out.digit++; continue; }
    if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0xc0 && c <= 0x24f)) { out.latin++; continue; }
    if (c >= 0x0400 && c <= 0x04ff) { out.cyrillic++; continue; }
    if (c >= 0x0600 && c <= 0x06ff) { out.arabic++; continue; }
    if (c >= 0xac00 && c <= 0xd7a3) { out.hangul++; continue; }
    if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x4e00 && c <= 0x9fff)) { out.cjk++; continue; }
    out.other++;
  }
  return out;
}

/* ────────────────────────────────────────────────────────
   누적 집계기
   ──────────────────────────────────────────────────────── */

export function createAcc(opts = {}) {
  return {
    params: opts.params || LAYOUT,
    docPages: Number(opts.docPages) || 0,
    mode: { pages: opts.pages || null, stride: opts.stride || 1, samples: !!opts.samples },

    pagesSeen: 0,
    pagesEmpty: 0,
    emptyPageList: [],
    pageSize: new Map(),
    linesPerPage: newHist(1),
    itemsPerPage: newHist(1),
    paragraphsPerPage: newHist(1),

    lineFont: newHist(0.1),
    pageFont: newHist(0.1),
    pageLeading: newHist(0.1),

    roles: new Map(),
    paraKinds: new Map(),

    columnCount: new Map(),
    multiGutterPages: 0,
    gutterWidth: newHist(0.5),
    gutterEm: newHist(0.05),
    gutterCenterRatio: newHist(0.01),
    gutterPagesMeasured: 0,
    itemGapEm: newHist(0.05),
    itemsPerLine: newHist(1),
    runsPerLine: newHist(1),

    qFormatLine: new Map(),
    qFormatPara: new Map(),
    qDigits: new Map(),
    qNumberMax: 0,
    qPrefix: new Map(),
    qCurrentReHits: 0,

    optUpper: new Map(),
    optSeq: new Map(),
    optLower: new Map(),
    optParen: new Map(),
    optCurrentReHits: 0,

    answerNgram: new Map(),
    answerLetters: new Map(),
    answerSeparators: new Map(),
    answerLineHits: 0,
    answerCurrentReHits: 0,

    captionShape: new Map(),
    captionLines: 0,
    captionCurrentRe: 0,
    captionTableRe: 0,
    captionRole: 0,
    captionInRegion: 0,
    regions: 0,

    headerKeys: new Map(),
    footerKeys: new Map(),
    headerZoneLines: 0,
    footerZoneLines: 0,
    headerPrefixHits: 0,
    footerPrefixHits: 0,
    pagenoDigits: new Map(),
    pagenoMax: 0,
    pagenoRole: 0,

    glueCandidates: 0,
    glueLines: 0,
    bboxOutOfPage: 0,
    longWords: 0,
    rotatedLines: 0,
    unitTokenLines: 0,
    bulletLines: 0,

    wideGapLines: 0,
    wideGapPages: new Map(),

    msPerPage: newHist(1),
    bytesPerPage: newHist(128),
    itemBytesPerPage: newHist(128),
    bytesLines: newHist(128),
    bytesParagraphs: newHist(128),
    bytesRegions: newHist(64),

    scripts: { latin: 0, hangul: 0, cjk: 0, arabic: 0, cyrillic: 0, digit: 0, other: 0 },
    words: 0,
    theHits: 0,

    samples: {
      caption: new Map(),
      question: new Map(),
      option: new Map(),
      header: new Map(),
      footer: new Map(),
      wideGap: new Map(),
      answer: new Map()
    }
  };
}

const SAMPLE_MAX_LEN = 40;
const SAMPLE_PER_KEY = 3;

function addSample(acc, bucket, key, text) {
  if (!acc.mode.samples) return;
  const b = acc.samples[bucket];
  if (!b) return;
  let arr = b.get(key);
  if (!arr) { if (b.size >= 40) return; arr = []; b.set(key, arr); }
  if (arr.length >= SAMPLE_PER_KEY) return;
  const s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim().slice(0, SAMPLE_MAX_LEN);
  if (s && arr.indexOf(s) < 0) arr.push(s);
}

// 작은 표본(한 페이지 안)의 분위수. 입력을 훼손하지 않는다.
export function quantileOf(values, q) {
  const a = values.filter(function (v) { return Number.isFinite(v); }).sort(function (p, x) { return p - x; });
  if (!a.length) return null;
  const i = Math.min(a.length - 1, Math.max(0, Math.round(q * (a.length - 1))));
  return a[i];
}

/**
 * 저장본 — spec 9-2. **`text/store.js` 의 `toStored` 를 그대로 쓴다.**
 *
 * `[Review 2]` 이 함수는 2a 단계에서 "items 만 떼어낸 얕은 복사본"이었다.
 * 2b 가 9-2 의 축소 규칙 1·2·3(문단 text 제거 · 표 밖 run text 제거 · 좌표
 * 반올림)을 `toStored` 로 구현한 뒤에도 그대로 남아 있어, 이 도구가 **실제로
 * 저장되지 않는 것까지 세고 있었다** — 729쪽에서 34.0KB/쪽로 나왔지만 진짜
 * 저장본은 21.9KB/쪽(JSON)·9.35KB/쪽(IndexedDB)이다. 7000쪽 환산이 238MB 대
 * 64MB 로 갈리는 차이라 새 자료 판단이 통째로 틀어진다. 정의를 하나로 묶는다.
 *
 * 원본 `layout` 은 훼손하지 않는다(`toStored` 의 계약).
 */
export function slimLayout(layout) {
  return toStored(layout || {});
}

const ENC = new TextEncoder();
export function jsonBytes(obj) {
  try { return ENC.encode(JSON.stringify(obj)).length; } catch (e) { return 0; }
}

/**
 * 페이지 한 장을 집계에 반영한다. **PageLayout 을 보관하지 않는다.**
 * @param {Object} acc createAcc() 결과 (제자리 변경)
 * @param {Object} layout buildPageLayout() 결과
 * @param {Object} ctx { itemCount, ms, bytes, itemBytes }
 */
export function addPage(acc, layout, ctx = {}) {
  const P = acc.params;
  const W = Number(layout.width) || 0;
  const H = Number(layout.height) || 0;
  const lines = Array.isArray(layout.lines) ? layout.lines : [];
  const paras = Array.isArray(layout.paragraphs) ? layout.paragraphs : [];

  acc.pagesSeen++;
  bump(acc.pageSize, Math.round(W) + 'x' + Math.round(H));
  histAdd(acc.linesPerPage, lines.length);
  histAdd(acc.itemsPerPage, Number(ctx.itemCount) || 0);
  histAdd(acc.paragraphsPerPage, paras.length);
  if (Number.isFinite(ctx.ms)) histAdd(acc.msPerPage, ctx.ms);
  if (Number.isFinite(ctx.bytes)) histAdd(acc.bytesPerPage, ctx.bytes);
  if (Number.isFinite(ctx.itemBytes)) histAdd(acc.itemBytesPerPage, ctx.itemBytes);
  if (Number.isFinite(ctx.bytesLines)) histAdd(acc.bytesLines, ctx.bytesLines);
  if (Number.isFinite(ctx.bytesParagraphs)) histAdd(acc.bytesParagraphs, ctx.bytesParagraphs);
  if (Number.isFinite(ctx.bytesRegions)) histAdd(acc.bytesRegions, ctx.bytesRegions);

  let hasText = false;
  for (let i = 0; i < lines.length; i++) if ((lines[i].text || '').trim()) { hasText = true; break; }
  if (!hasText) {
    acc.pagesEmpty++;
    if (acc.emptyPageList.length < 50) acc.emptyPageList.push(layout.pageNo);
  }

  const stats = layout.stats || {};
  const Fm = Number(stats.medianFontSize) || 0;
  if (Fm > 0) histAdd(acc.pageFont, Fm);
  if (Number(stats.medianLeading) > 0) histAdd(acc.pageLeading, stats.medianLeading);

  const cols = layout.columns || { count: 1, gutters: [] };
  bump(acc.columnCount, cols.count);
  if (stats.warn === 'multi-gutter') acc.multiGutterPages++;
  acc.regions += Array.isArray(layout.regions) ? layout.regions.length : 0;

  // ── 거터 실측: 2단 페이지에서 좌 컬럼 오른쪽 끝 ↔ 우 컬럼 왼쪽 끝
  //
  // 재는 것은 **그 페이지에서 가장 좁은 거터**다 — RUN_GAP_FACTOR 는 그것도 넘겨야 한다.
  //   왼쪽 컬럼의 오른쪽 끝  = col0 줄 x1 의 p90 (최빈값은 ragged right 에서 "흔한 줄 길이"를 가리킨다)
  //   오른쪽 컬럼의 왼쪽 끝  = col1 줄 x0 의 p10 (최빈값은 들여쓴 줄을 가리킬 수 있다)
  // 둘 다 detectColumns 가 찾은 거터 X 의 **제 쪽**에 있는 줄로 한정한다. 거터를 가로지르는
  // 넓은 run 과 폭이 깨진 아이템(x1 이 페이지 밖)이 섞이면 값이 무의미해진다.
  if (cols.count === 2) {
    const gx = (cols.gutters && cols.gutters.length) ? cols.gutters[0] : W / 2;
    const leftX1 = [], rightX0 = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.bbox || l.role !== 'body') continue;
      if (l.col === 0 && l.bbox.x1 <= gx && l.bbox.x1 > 0) leftX1.push(l.bbox.x1);
      else if (l.col === 1 && l.bbox.x0 >= gx && l.bbox.x0 <= W) rightX0.push(l.bbox.x0);
    }
    if (leftX1.length >= 4 && rightX0.length >= 4) {
      const L = quantileOf(leftX1, 0.9);
      const R = quantileOf(rightX0, 0.1);
      const g = R - L;
      if (Number.isFinite(g) && g > 0 && g < W * 0.5) {
        histAdd(acc.gutterWidth, g);
        if (Fm > 0) histAdd(acc.gutterEm, g / Fm);
        acc.gutterPagesMeasured++;
      }
    }
    if (W > 0 && cols.gutters && cols.gutters.length) histAdd(acc.gutterCenterRatio, cols.gutters[0] / W);
  }

  let prevOpt = null;                       // 보기 글자의 연속성 추적 (읽기 순서)

  const headTop = H > 0 ? H * (1 - P.HEADER_ZONE) : Infinity;
  const footTop = H > 0 ? H * P.FOOTER_ZONE : -Infinity;
  const pgTop = H > 0 ? H * (1 - P.PAGENO_ZONE) : Infinity;
  const pgBottom = H > 0 ? H * P.PAGENO_ZONE : -Infinity;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const text = l.text || '';
    bump(acc.roles, l.role || 'null');
    if (l.role === 'rotated') { acc.rotatedLines++; continue; }
    if (Number(l.fontSize) > 0) histAdd(acc.lineFont, l.fontSize);
    const runs = Array.isArray(l.runs) ? l.runs : [];
    histAdd(acc.runsPerLine, runs.length);
    if (!text) continue;

    tallyScripts(text, acc.scripts);
    const wm = text.match(/[\p{L}\p{N}]+/gu);
    if (wm) acc.words += wm.length;
    const th = text.match(/\bthe\b/gi);
    if (th) acc.theHits += th.length;

    // 품질 지표
    if (W > 0 && l.bbox && (l.bbox.x1 > W * 1.02 || l.bbox.x0 < -W * 0.02)) acc.bboxOutOfPage++;

    const glue = text.match(/[a-z][A-Z]/g);
    if (glue) { acc.glueCandidates += glue.length; acc.glueLines++; }
    const lw = text.match(/[A-Za-z]{20,}/g);
    if (lw) acc.longWords += lw.length;
    if (CURRENT_CODE_RE.unitTokens.test(text)) acc.unitTokenLines++;
    if (CURRENT_CODE_RE.bullet.test(text)) acc.bulletLines++;

    // 컬럼 탐지 실패 후보 — run 사이 x 간격이 페이지 폭 1/3 초과
    if (W > 0) {
      for (let r = 1; r < runs.length; r++) {
        if (runs[r].x0 - runs[r - 1].x1 > W / 3) {
          acc.wideGapLines++;
          bumpCapped(acc.wideGapPages, layout.pageNo, 4000);
          addSample(acc, 'wideGap', 'gap', text);
          break;
        }
      }
    }

    // 아이템 사이 X 간격(em) — run 분할 임계가 무엇이든 영향을 받지 않는 원자료다.
    // **단어 간격이 아니다.** pdf.js 가 낱말을 하나의 아이템으로 묶어 내보내면
    // 낱말 사이 공백은 아이템 안에 숨고, 여기 남는 것은 조판 간격(거터·표 셀)뿐이다.
    // 줄당 아이템 수를 함께 재서 그 여부를 판단할 수 있게 한다.
    if (l.role === 'body' && Fm > 0 && l.fontSize >= P.BODY_FONT_LO * Fm && l.fontSize <= P.BODY_FONT_HI * Fm) {
      const items = Array.isArray(l.items) ? l.items : [];
      let prev = null;
      let solid = 0;
      for (let k = 0; k < items.length; k++) {
        const it = items[k];
        if (!it.str || /^\s*$/.test(it.str)) continue;
        solid++;
        if (prev) {
          const gap = it.x - (prev.x + prev.w);
          if (gap > 0 && gap < 20 * l.fontSize) histAdd(acc.itemGapEm, gap / l.fontSize);
        }
        prev = it;
      }
      histAdd(acc.itemsPerLine, solid);
    }

    // 머리말·꼬리말·쪽번호 영역
    if (H > 0 && l.baseline > headTop) {
      acc.headerZoneLines++;
      bumpCapped(acc.headerKeys, normalizeRepeatKey(text));
      if (CURRENT_CODE_RE.headerPrefix.test(text)) acc.headerPrefixHits++;
      addSample(acc, 'header', 'top', text);
    } else if (H > 0 && l.baseline < footTop) {
      acc.footerZoneLines++;
      bumpCapped(acc.footerKeys, normalizeRepeatKey(text));
      if (CURRENT_CODE_RE.footerPrefix.test(text)) acc.footerPrefixHits++;
      addSample(acc, 'footer', 'bottom', text);
    }
    if (H > 0 && (l.baseline > pgTop || l.baseline < pgBottom)) {
      const m = text.trim().match(/^(\d{1,8})$/);
      if (m) {
        bump(acc.pagenoDigits, m[1].length);
        const v = Number(m[1]);
        if (v > acc.pagenoMax) acc.pagenoMax = v;
      }
    }
    if (l.role === 'pageno') acc.pagenoRole++;

    // 캡션
    const cap = classifyCaption(text);
    if (cap) {
      acc.captionLines++;
      bump(acc.captionShape, cap.prefix + ' + ' + cap.shape);
      addSample(acc, 'caption', cap.prefix + ' + ' + cap.shape, text);
      if (CURRENT_CODE_RE.figureCaption.test(text)) acc.captionCurrentRe++;
      if (CURRENT_CODE_RE.tableCaption.test(text)) acc.captionTableRe++;
    }
    if (l.role === 'figure-caption') {
      acc.captionRole++;
      if (l.regionId) acc.captionInRegion++;
    }

    // 문항 번호 (줄 머리)
    const q = classifyQuestionNumber(text);
    if (q) {
      bump(acc.qFormatLine, q.format);
      bump(acc.qDigits, q.digits);
      if (q.number > acc.qNumberMax) acc.qNumberMax = q.number;
      if (q.prefix) bumpCapped(acc.qPrefix, q.prefix, 500);
      if (CURRENT_CODE_RE.questionStart.test(text)) acc.qCurrentReHits++;
      addSample(acc, 'question', q.format, text);

      // 정답 문구 후보 — 번호 뒤 n-gram
      const grams = ngramsOf(q.rest);
      for (let g = 0; g < grams.length; g++) bumpCapped(acc.answerNgram, grams[g], 30000);

      const am = q.rest.match(/^\s*(?:the\s+)?answers?\s+(?:is|are)\s+([A-Za-z])\b(.*)$/i);
      if (am) {
        acc.answerLineHits++;
        bump(acc.answerLetters, am[1].toUpperCase());
        addSample(acc, 'answer', 'phrase', text);
        const tail = am[2] || '';
        const sep = tail.match(/^\s*(,|and|&|or|\/)\s*[A-Za-z]\b/i);
        if (sep) bump(acc.answerSeparators, sep[1].toLowerCase());
        if (CURRENT_CODE_RE.answerStart.test(text)) acc.answerCurrentReHits++;
      }
    }

    // 보기 글자
    const om = text.match(/^\s*([A-Za-z])([.)])\s+\S/);
    if (om) {
      const ch = om[1];
      if (om[2] === ')') bump(acc.optParen, ch.toUpperCase());
      else if (ch >= 'A' && ch <= 'Z') bump(acc.optUpper, ch);
      else bump(acc.optLower, ch);
      if (om[2] === '.' && CURRENT_CODE_RE.optionStart.test(text)) acc.optCurrentReHits++;
      addSample(acc, 'option', ch + om[2], text);
      /* 빈도만으로는 진짜 보기와 머리글자("S. aureus" 같은 줄)를 가를 수 없다 —
       * 이 책에서 F(5건)보다 S(8건)·I(6건)가 더 많다. 가르는 것은 **연속성**이다:
       * 보기는 바로 앞에 한 글자 앞선 보기가 온다. 6지선다 F 는 E 뒤에 오고,
       * 머리글자는 아무 뒤에나 온다. 이 값으로 보기 글자 범위를 정한다. */
      const up = ch.toUpperCase();
      if (prevOpt && up.charCodeAt(0) === prevOpt.charCodeAt(0) + 1) bump(acc.optSeq, up);
      prevOpt = up;
    } else if (text.length > 0 && !/^\s*$/.test(text) && l.role !== 'body') {
      prevOpt = null;
    }
  }

  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    bump(acc.paraKinds, p.kind || 'null');
    const q = classifyQuestionNumber(p.text || '');
    if (q) bump(acc.qFormatPara, q.format);
  }

  return acc;
}

/* ────────────────────────────────────────────────────────
   마무리 — 요약 객체
   ──────────────────────────────────────────────────────── */

/**
 * 글자 범위 판정.
 * @param {Map} map 글자별 등장 빈도
 * @param {Map|null} seq 글자별 "바로 앞 글자 뒤에 이어서 나온" 횟수. 주어지면 **이쪽이 기준**이다.
 *
 * 빈도만 보면 안 된다 — 이 책에서 6지선다의 F(5건)보다 머리글자 S(8건)·I(6건)가 많다.
 * 보기 글자는 A 부터 끊기지 않고 이어진다는 성질로 가른다.
 */
function letterRange(map, seq = null) {
  const present = [];
  for (const [k, v] of map) if (v > 0) present.push(k);
  present.sort();
  if (!present.length) return { max: null, contiguous: null, present: [], basis: 'none' };
  const total = sumValues(map);
  let contiguous = null;
  if (seq && sumValues(seq) > 0) {
    // 1~2건짜리 연속은 우연일 수 있다(E 뒤에 마침 "F." 로 시작하는 줄이 온 경우).
    // 3건 이상을 요구한다 — 6지선다가 다섯 문항만 있어도 통과하는 낮은 문턱이다.
    const minSeq = 3;
    if ((map.get('A') || 0) > 0) contiguous = 'A';
    for (let i = 1; i < 26; i++) {
      const ch = String.fromCharCode(65 + i);
      if ((seq.get(ch) || 0) < minSeq) break;
      contiguous = ch;
    }
    return { max: present[present.length - 1], contiguous: contiguous, present: present, basis: 'sequence' };
  }
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    const n = map.get(ch) || 0;
    if (n <= 0 || n < total * 0.005) break;
    contiguous = ch;
  }
  return { max: present[present.length - 1], contiguous: contiguous, present: present, basis: 'share' };
}

export function finalize(acc) {
  const P = acc.params;
  const font = histStats(acc.pageFont);
  const lineFont = histStats(acc.lineFont);
  const leading = histStats(acc.pageLeading);
  const gutter = histStats(acc.gutterWidth);
  const gutterEm = histStats(acc.gutterEm);
  const itemGap = histStats(acc.itemGapEm);
  const itemsPerLine = histStats(acc.itemsPerLine);
  const bytes = histStats(acc.bytesPerPage);
  const ms = histStats(acc.msPerPage);
  const meanOf = function (h) { return h.n ? h.sum / h.n : 0; };
  const byteParts = {
    lines: meanOf(acc.bytesLines),
    paragraphs: meanOf(acc.bytesParagraphs),
    regions: meanOf(acc.bytesRegions)
  };

  /* RUN_GAP_FACTOR 권장값.
   *
   * 기준은 **거터 폭의 하한**이다 — "거터는 반드시 run 경계가 되어야 한다"가
   * 이 상수의 존재 이유이므로(spec 4-4·4-5), 임계는 가장 좁은 거터보다도 낮아야 한다.
   * 페이지별 거터 폭(em)의 p10 을 하한으로 잡고 20% 여유를 둔 값을 0.1 단위로 내린다.
   *
   * 위쪽 한계(단어 간격이 run 으로 쪼개지지 않을 것)는 **이 PDF 에서 직접 잴 수 없다.**
   * pdf.js 가 낱말을 묶어 내보내면 낱말 사이 공백은 아이템 안에 숨는다(줄당 아이템 수가
   * 그 지표다). 그래서 아이템 간격 분포를 함께 싣고 판단 근거로만 쓴다.
   */
  const gutterLow = histQuantile(acc.gutterEm, 0.1);
  let recommend = null;
  let recommendNote = '';
  if (gutterLow != null && gutterLow > 0.4) {
    recommend = Math.floor(gutterLow * 0.8 * 10) / 10;
    if (recommend < 0.5) recommend = 0.5;
    recommendNote = '거터 폭 p10=' + gutterLow.toFixed(2) + 'em 의 0.8배 (거터보다 확실히 작게)';
  } else {
    recommendNote = '측정 불가 — 2단 쪽 표본 부족(' + acc.gutterPagesMeasured + '쪽)';
  }
  // 권장값을 썼을 때 아이템 간격 중 몇 %가 run 경계가 되는가 (현재값과 비교용)
  const splitShare = function (f) {
    if (!acc.itemGapEm.n || f == null) return null;
    let over = 0;
    for (const [k, v] of acc.itemGapEm.map) if (k * acc.itemGapEm.step > f) over += v;
    return over / acc.itemGapEm.n;
  };

  const optU = letterRange(acc.optUpper, acc.optSeq);
  const answerL = letterRange(acc.answerLetters);

  const qTop = topEntries(acc.qFormatLine, 1)[0] || null;
  const qDigitsMax = Math.max.apply(null, Array.from(acc.qDigits.keys()).concat([0]));
  const qDigitsRobust = robustMaxKey(acc.qDigits);
  const qDigitsOutliers = topEntries(acc.qDigits, 0).filter(function (r) { return r[0] > qDigitsRobust; });
  const pagenoDigitsMax = Math.max.apply(null, Array.from(acc.pagenoDigits.keys()).concat([0]));
  const pagenoDigitsRobust = robustMaxKey(acc.pagenoDigits);

  const sc = acc.scripts;
  const scTotal = sc.latin + sc.hangul + sc.cjk + sc.arabic + sc.cyrillic + sc.other || 1;
  let lang = null;
  const latinRatio = sc.latin / scTotal;
  if (latinRatio > 0.9) lang = (acc.theHits / Math.max(1, acc.words)) > 0.02 ? 'en' : null;
  else if (sc.hangul / scTotal > 0.3) lang = 'ko';
  else if (sc.arabic / scTotal > 0.3) lang = 'ar';
  else if (sc.cjk / scTotal > 0.3) lang = null;

  const scale = acc.docPages > 0 && acc.pagesSeen > 0 ? acc.docPages / acc.pagesSeen : 1;

  const warnings = [];
  const add = (sev, msg) => warnings.push({ sev: sev, msg: msg });

  if (acc.captionLines > 0 && acc.captionCurrentRe === 0) {
    add('DEAD', 'blocks.js classifyRoles 의 figure-caption 정규식 /^(FIGURE|FIG\\.|TABLE)\\s*\\d/i 이 ' +
      '이 책에서는 **죽은 코드**다 — 캡션 후보 ' + acc.captionLines + '줄 중 0건 일치, role=figure-caption ' +
      acc.captionRole + '건. 따라서 4-8 의 캡션 가점 신호·TABLE_MIN_LINES 완화 경로·region bbox 합치기(findCaption)도 ' +
      '모두 죽은 코드다(표 region ' + acc.regions + '개 중 캡션 병합 ' + acc.captionInRegion + '건).');
  } else if (acc.captionLines > 0 && acc.captionCurrentRe < acc.captionLines * 0.5) {
    add('WARN', '캡션 정규식이 후보 ' + acc.captionLines + '줄 중 ' + acc.captionCurrentRe + '줄만 잡는다.');
  }
  if (acc.captionTableRe === 0 && acc.captionLines > 0) {
    add('DEAD', 'blocks.js findCaption 의 /^TABLE\\s*\\d/i 일치 0건 — 표 region 에 캡션이 붙는 경로가 **죽은 코드**다.');
  }
  if (optU.contiguous && optU.contiguous > 'E') {
    let beyond = 0;
    for (let c = 'F'.charCodeAt(0); c <= optU.contiguous.charCodeAt(0); c++) beyond += acc.optUpper.get(String.fromCharCode(c)) || 0;
    add('MISS', 'segment.js isOptionStart 의 [A-E] 가 이 책의 보기 범위 A-' + optU.contiguous +
      ' 를 못 담는다 — ' + beyond + '줄 누락.');
  }
  if (answerL.max && answerL.max > 'E') {
    add('MISS', 'segment.js ANSWER_RE 의 정답 글자 [A-E] 범위 밖 정답이 있다(최대 ' + answerL.max + ').');
  }
  if (qDigitsRobust > 3) {
    add('MISS', 'segment.js QUESTION_RE 의 \\d{1,3} 상한을 넘는 문항 번호가 **일상적으로** 있다(표본이 충분한 최대 ' +
      qDigitsRobust + '자리).');
  } else if (qDigitsMax > 3) {
    add('INFO', '문항 번호 자릿수 이상치 — ' + qDigitsOutliers.map(function (r) { return r[0] + '자리 ' + r[1] + '건'; }).join(', ') +
      '(최대 번호 ' + acc.qNumberMax + '). 표 안의 수가 문항 번호처럼 보인 것일 수 있어 상한 계산에서 뺐다. ' +
      'QUESTION_RE 의 \\d{1,3} 은 이 책에서는 맞지만 7000쪽에서는 넘칠 수 있다.');
  }
  if (pagenoDigitsMax > 4) {
    add('MISS', 'blocks.js classifyRoles 의 쪽번호 \\d{1,4} 상한을 넘는다(최대 자릿수 ' + pagenoDigitsMax + ').');
  } else if (acc.docPages >= 1000) {
    add('WARN', '쪽번호 자릿수 최대 ' + pagenoDigitsMax + ' — 문서가 ' + acc.docPages + '쪽이므로 상한을 5로 올려 둘 것.');
  }
  if (acc.footerPrefixHits > Math.max(2, acc.footerZoneLines * 0.005)) {
    add('WARN', 'classifyRoles 의 꼬리말 정규식에 서적명·출판사가 하드코딩되어 있고 이 책에서 ' +
      acc.footerPrefixHits + '줄이 그 이름으로 걸렸다 — 다른 책에서는 0이 된다.');
  } else if (acc.footerZoneLines > 0) {
    add('DEAD', 'classifyRoles 의 /^(©|copyright|harrison|mcgraw)/i 가 꼬리말 영역 ' + acc.footerZoneLines +
      '줄 중 ' + acc.footerPrefixHits + '줄만 잡는다 — 사실상 죽은 코드다. 이 책의 꼬리말은 반복 문자열(3회 이상 ' +
      countAtLeast(acc.footerKeys, 3) + '종, 최다 ' + (topEntries(acc.footerKeys, 1)[0] || [null, 0])[1] +
      '회)과 폰트 크기로만 걸린다.');
  }
  if (acc.headerZoneLines > 0 && acc.headerPrefixHits <= Math.max(2, acc.headerZoneLines * 0.005)) {
    add('DEAD', 'classifyRoles 의 /^(SECTION|CHAPTER|PART)\\b/i 가 머리말 영역 ' + acc.headerZoneLines +
      '줄 중 ' + acc.headerPrefixHits + '줄만 잡는다 — 사실상 죽은 코드다. 이 책은 반복되는 running head 가 거의 없다(' +
      '3회 이상 반복 ' + countAtLeast(acc.headerKeys, 3) + '종, role=header ' + (acc.roles.get('header') || 0) + '줄).');
  }
  if (recommend != null && Math.abs(recommend - P.RUN_GAP_FACTOR) > 0.25) {
    add('WARN', 'RUN_GAP_FACTOR 현재값 ' + P.RUN_GAP_FACTOR + ' 대비 권장값 ' + recommend + ' (' + recommendNote + ').');
  }
  if (gutterEm.n && gutterEm.p50 != null && histQuantile(acc.gutterEm, 0.1) != null &&
      gutterEm.p90 != null && gutterEm.p90 > gutterEm.p50 * 2) {
    add('WARN', '거터 폭이 쪽마다 크게 다르다(p10 ' + n2(histQuantile(acc.gutterEm, 0.1)) + 'em / p50 ' +
      n2(gutterEm.p50) + 'em / p90 ' + n2(gutterEm.p90) + 'em) — 단일 RUN_GAP_FACTOR 로는 가장 좁은 거터에 맞춰야 한다.');
  }
  if (itemsPerLine.p50 != null && itemsPerLine.p50 <= 2) {
    add('INFO', '본문 줄당 아이템이 중앙값 ' + n2(itemsPerLine.p50, 0) + '개다 — pdf.js 가 낱말을 묶어 내보낸다. ' +
      '**단어 간격은 이 PDF 에서 직접 측정할 수 없고**, 아이템 간격(p50 ' + n2(itemGap.p50) +
      'em)은 조판 간격이지 단어 간격이 아니다.');
  }
  if (acc.unitTokenLines === 0) {
    add('DEAD', 'blocks.js hasUnitTokens 의 임상 단위 정규식 일치 0건 — 이 책에서는 표 가점 신호가 죽은 코드다.');
  }
  const bytesMean = bytes.mean;
  // 기준값은 spec 9-2 `[수정 2026-09-20]` 의 실측치다 — 축소 규칙 1·2·3 을 적용한
  // 저장본이 쪽당 20.6KB(JSON). 초판의 "5~10KB" 는 아이템을 뺀 것만 센 추정이었고
  // 이미 철회됐다. 여유를 1.5배 두고, 넘을 때만 "이 책이 더 무겁다"고 알린다.
  if (bytesMean != null && bytesMean / 1024 > 31) {
    add('WARN', 'spec 9-2 실측(축소 규칙 적용 후 쪽당 20.6KB JSON)보다 이 책이 무겁다 — 저장본이 쪽당 평균 ' +
      (bytesMean / 1024).toFixed(1) + 'KB(p90 ' + (bytes.p90 / 1024).toFixed(1) + 'KB)다(줄 ' +
      (byteParts.lines / 1024).toFixed(1) + 'KB / 문단 ' + (byteParts.paragraphs / 1024).toFixed(1) +
      'KB / 영역 ' + (byteParts.regions / 1024).toFixed(1) + 'KB per page). ' +
      'IndexedDB 실점유는 JSON 바이트의 약 0.40배다(9-2).');
  }
  if (acc.pagesEmpty > 0) {
    add('WARN', '텍스트가 0인 쪽 ' + acc.pagesEmpty + '개 — 스캔 이미지 쪽일 수 있다(OCR 없음).');
  }
  if (acc.wideGapLines > 0) {
    add('INFO', '컬럼 탐지 실패 후보(run 간격 > 페이지폭/3) ' + acc.wideGapLines + '줄 / ' + acc.wideGapPages.size + '쪽.');
  }
  if (lang == null) {
    add('WARN', '본문 언어를 자신 있게 판정하지 못했다 — BOOK_PROFILE.lang 을 손으로 채울 것.');
  }

  return {
    mode: acc.mode,
    docPages: acc.docPages,
    pagesSeen: acc.pagesSeen,
    scale: scale,
    pagesEmpty: acc.pagesEmpty,
    emptyPageList: acc.emptyPageList.slice(),
    pageSize: topEntries(acc.pageSize, 5),
    linesPerPage: histStats(acc.linesPerPage),
    itemsPerPage: histStats(acc.itemsPerPage),
    paragraphsPerPage: histStats(acc.paragraphsPerPage),
    font: font,
    lineFont: lineFont,
    leading: leading,
    roles: topEntries(acc.roles, 0),
    paraKinds: topEntries(acc.paraKinds, 0),
    columnCount: topEntries(acc.columnCount, 0),
    twoColPages: acc.columnCount.get(2) || 0,
    oneColPages: acc.columnCount.get(1) || 0,
    multiGutterPages: acc.multiGutterPages,
    gutter: gutter,
    gutterEm: gutterEm,
    gutterPagesMeasured: acc.gutterPagesMeasured,
    gutterCenterRatio: histStats(acc.gutterCenterRatio),
    itemGap: itemGap,
    itemsPerLine: itemsPerLine,
    runsPerLine: histStats(acc.runsPerLine),
    runGapFactor: {
      current: P.RUN_GAP_FACTOR,
      gutterLow: gutterLow,
      recommend: recommend,
      note: recommendNote,
      splitShareCurrent: splitShare(P.RUN_GAP_FACTOR),
      splitShareRecommend: splitShare(recommend)
    },
    qFormatLine: topEntries(acc.qFormatLine, 0),
    qFormatPara: topEntries(acc.qFormatPara, 0),
    qTop: qTop,
    qDigits: topEntries(acc.qDigits, 0),
    qDigitsMax: qDigitsMax,
    qDigitsRobust: qDigitsRobust,
    qDigitsOutliers: qDigitsOutliers,
    qNumberMax: acc.qNumberMax,
    qPrefix: topEntries(acc.qPrefix, 12),
    qPrefixKinds: acc.qPrefix.size,
    qCurrentReHits: acc.qCurrentReHits,
    optUpper: topEntries(acc.optUpper, 0),
    optSeq: topEntries(acc.optSeq, 0),
    optLower: topEntries(acc.optLower, 0),
    optParen: topEntries(acc.optParen, 0),
    optRange: optU,
    optCurrentReHits: acc.optCurrentReHits,
    // 5회 이상 반복되는 상용구만 남기고, 숫자를 품은 것은 뺀다(원서 내용이 새지 않게).
    answerNgram: topEntries(acc.answerNgram, 40)
      .filter(function (r) { return r[1] >= 5 && !/\d/.test(r[0]); })
      .slice(0, 12),
    answerLetters: topEntries(acc.answerLetters, 0),
    answerRange: answerL,
    answerSeparators: topEntries(acc.answerSeparators, 0),
    answerLineHits: acc.answerLineHits,
    answerCurrentReHits: acc.answerCurrentReHits,
    caption: {
      lines: acc.captionLines,
      shapes: topEntries(acc.captionShape, 15),
      currentRe: acc.captionCurrentRe,
      tableRe: acc.captionTableRe,
      role: acc.captionRole,
      inRegion: acc.captionInRegion,
      regions: acc.regions
    },
    headerKeys: topEntries(acc.headerKeys, 10),
    footerKeys: topEntries(acc.footerKeys, 10),
    headerKeyKinds: acc.headerKeys.size,
    footerKeyKinds: acc.footerKeys.size,
    headerRepeated: countAtLeast(acc.headerKeys, 3),
    footerRepeated: countAtLeast(acc.footerKeys, 3),
    headerZoneLines: acc.headerZoneLines,
    footerZoneLines: acc.footerZoneLines,
    headerPrefixHits: acc.headerPrefixHits,
    footerPrefixHits: acc.footerPrefixHits,
    pagenoDigits: topEntries(acc.pagenoDigits, 0),
    pagenoDigitsMax: pagenoDigitsMax,
    pagenoDigitsRobust: pagenoDigitsRobust,
    pagenoMax: acc.pagenoMax,
    pagenoRole: acc.pagenoRole,
    quality: {
      glueCandidates: acc.glueCandidates,
      glueLines: acc.glueLines,
      bboxOutOfPage: acc.bboxOutOfPage,
      longWords: acc.longWords,
      rotatedLines: acc.rotatedLines,
      unitTokenLines: acc.unitTokenLines,
      bulletLines: acc.bulletLines,
      emptyPages: acc.pagesEmpty
    },
    wideGap: {
      lines: acc.wideGapLines,
      pages: acc.wideGapPages.size,
      top: topEntries(acc.wideGapPages, 15)
    },
    perf: {
      ms: ms,
      bytes: bytes,
      itemBytes: histStats(acc.itemBytesPerPage),
      totalBytesSeen: acc.bytesPerPage.sum,
      projectedBytes: acc.bytesPerPage.n ? (acc.bytesPerPage.sum / acc.bytesPerPage.n) * (acc.docPages || acc.pagesSeen) : 0,
      projectedMs: acc.msPerPage.n ? (acc.msPerPage.sum / acc.msPerPage.n) * (acc.docPages || acc.pagesSeen) : 0,
      parts: byteParts
    },
    scripts: acc.scripts,
    lang: lang,
    langEvidence: { latinRatio: latinRatio, theRatio: acc.theHits / Math.max(1, acc.words), words: acc.words },
    warnings: warnings,
    samples: acc.mode.samples ? serializeSamples(acc.samples) : null
  };
}

function serializeSamples(samples) {
  const out = {};
  for (const k of Object.keys(samples)) {
    const rows = [];
    for (const [key, arr] of samples[k]) rows.push([key, arr.slice()]);
    rows.sort(function (a, b) { return String(a[0]) < String(b[0]) ? -1 : 1; });
    out[k] = rows;
  }
  return out;
}

/* ────────────────────────────────────────────────────────
   사람이 읽는 보고서
   ──────────────────────────────────────────────────────── */

function n2(v, d = 2) { return v == null ? 'n/a' : Number(v).toFixed(d); }
function pad(s, w) { s = String(s); return s.length >= w ? s : s + ' '.repeat(w - s.length); }
function padL(s, w) { s = String(s); return s.length >= w ? s : ' '.repeat(w - s.length) + s; }
function kb(bytes) { return bytes == null ? 'n/a' : (bytes / 1024).toFixed(1) + 'KB'; }

function table(rows, widths) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i];
    let line = '';
    for (let c = 0; c < cells.length; c++) {
      line += (c === 0 ? '' : '  ') + (c === 0 ? pad(cells[c], widths[c]) : padL(cells[c], widths[c]));
    }
    out.push('  ' + line.replace(/\s+$/, ''));
  }
  return out;
}

function pairList(rows, limit = 12) {
  return rows.slice(0, limit).map(function (r) { return r[0] + '=' + r[1]; }).join('  ');
}

export function formatReport(s, meta = {}) {
  const L = [];
  const H = (t) => { L.push(''); L.push('── ' + t + ' ' + '─'.repeat(Math.max(0, 66 - t.length))); };

  L.push('='.repeat(72));
  L.push('MedReader PDF 프로파일 — ' + (meta.file || '(unknown)'));
  L.push('='.repeat(72));
  L.push('문서 쪽수      : ' + s.docPages);
  L.push('측정한 쪽수    : ' + s.pagesSeen +
    (s.mode.stride > 1 ? ('  (--stride ' + s.mode.stride + ' 표본, 배율 ×' + s.scale.toFixed(1) + ')') : '') +
    (s.mode.pages ? ('  (--pages ' + s.mode.pages + ')') : ''));
  if (meta.interrupted) L.push('※ 중단됨(SIGINT) — 여기까지의 집계다.');
  L.push('알고리즘 버전  : ' + (meta.algoVersion == null ? 'n/a' : meta.algoVersion));

  H('1. 기본');
  L.push(...table([
    ['쪽 크기(상위)', s.pageSize.map(r => r[0] + '×' + r[1] + '쪽').join(', ')],
    ['본문 폰트 Fm', '중앙값 ' + n2(s.font.p50) + 'pt  (쪽별 중앙값 분포 ' + n2(s.font.min) + '~' + n2(s.font.max) + ')'],
    ['줄 폰트 분포', 'p50 ' + n2(s.lineFont.p50) + '  p90 ' + n2(s.lineFont.p90) + '  p99 ' + n2(s.lineFont.p99) + '  max ' + n2(s.lineFont.max)],
    ['행간 Lm', '중앙값 ' + n2(s.leading.p50) + 'pt  (' + n2(s.leading.min) + '~' + n2(s.leading.max) + ')'],
    ['쪽당 아이템', 'p50 ' + n2(s.itemsPerPage.p50, 0) + '  p90 ' + n2(s.itemsPerPage.p90, 0) + '  max ' + n2(s.itemsPerPage.max, 0)],
    ['쪽당 줄', 'p50 ' + n2(s.linesPerPage.p50, 0) + '  p90 ' + n2(s.linesPerPage.p90, 0) + '  max ' + n2(s.linesPerPage.max, 0)],
    ['쪽당 문단', 'p50 ' + n2(s.paragraphsPerPage.p50, 0) + '  p90 ' + n2(s.paragraphsPerPage.p90, 0)],
    ['줄 role 분포', pairList(s.roles, 12)],
    ['문단 kind 분포', pairList(s.paraKinds, 12)]
  ], [16, 0]));

  H('2. 거터 · 컬럼');
  L.push(...table([
    ['컬럼 판정', s.columnCount.map(r => r[0] + '단 ' + r[1] + '쪽').join(', ') +
      (s.multiGutterPages ? ('  (multi-gutter 경고 ' + s.multiGutterPages + '쪽)') : '')],
    ['2단 비율', s.twoColPages + ' / ' + s.pagesSeen + ' = ' + n2(100 * s.twoColPages / Math.max(1, s.pagesSeen), 1) + '%'],
    ['거터 폭 실측', s.gutter.n ? (n2(s.gutter.p50, 1) + 'pt (최빈 ' + n2(s.gutter.mode, 1) + 'pt, p90 ' + n2(s.gutter.p90, 1) +
      'pt, 표본 ' + s.gutterPagesMeasured + '쪽)') : '측정 불가 (2단 쪽 부족)'],
    ['거터 폭(em)', s.gutterEm.n ? (n2(s.gutterEm.p50) + 'em (p10~p90 ' + n2(histQuantileOf(s.gutterEm, 'min')) + '~' + n2(s.gutterEm.p90) + ')') : '측정 불가'],
    ['거터 X 위치', s.gutterCenterRatio.n ? ('페이지 폭의 ' + n2(100 * s.gutterCenterRatio.p50, 1) + '%') : '측정 불가'],
    ['아이템 간격(em)', s.itemGap.n ? ('p50 ' + n2(s.itemGap.p50) + '  p90 ' + n2(s.itemGap.p90) + '  p99 ' + n2(s.itemGap.p99) +
      '  max ' + n2(s.itemGap.max) + '   ※ 단어 간격이 아니다') : '측정 불가'],
    ['본문 줄당 아이템', s.itemsPerLine.n ? ('p50 ' + n2(s.itemsPerLine.p50, 0) + '  p90 ' + n2(s.itemsPerLine.p90, 0) +
      '  max ' + n2(s.itemsPerLine.max, 0) + (s.itemsPerLine.p50 <= 2 ? '  → 낱말이 아이템 안에 묶여 있다' : '')) : '측정 불가'],
    ['줄당 run', 'p50 ' + n2(s.runsPerLine.p50, 0) + '  p90 ' + n2(s.runsPerLine.p90, 0) + '  max ' + n2(s.runsPerLine.max, 0)],
    ['RUN_GAP_FACTOR', '현재 ' + s.runGapFactor.current + ' / 권장 ' + (s.runGapFactor.recommend == null ? '측정 불가' : s.runGapFactor.recommend) +
      '  (' + s.runGapFactor.note + ')'],
    ['  → 쪼개지는 비율', (s.runGapFactor.splitShareCurrent == null ? 'n/a' : '현재값 ' + n2(100 * s.runGapFactor.splitShareCurrent, 1) + '%') +
      (s.runGapFactor.splitShareRecommend == null ? '' : ' / 권장값 ' + n2(100 * s.runGapFactor.splitShareRecommend, 1) + '%') +
      '  (아이템 간격 중 run 경계가 되는 비율)']
  ], [16, 0]));

  H('3. 문항 번호 형식');
  L.push(...table([
    ['줄 머리 빈도', s.qFormatLine.length ? s.qFormatLine.map(r => r[0] + '=' + r[1]).join('  ') : '없음'],
    ['문단 머리 빈도', s.qFormatPara.length ? s.qFormatPara.map(r => r[0] + '=' + r[1]).join('  ') : '없음'],
    ['최빈 형식', s.qTop ? (s.qTop[0] + ' (' + s.qTop[1] + '줄)') : '없음'],
    ['번호 자릿수', s.qDigits.map(r => r[0] + '자리=' + r[1]).join('  ') + '  → 표본이 충분한 최대 ' + s.qDigitsRobust + '자리' +
      (s.qDigitsOutliers.length ? ('  (이상치: ' + s.qDigitsOutliers.map(r => r[0] + '자리 ' + r[1] + '건' ) + ' — 표 안의 수가 문항 번호로 보인 것일 수 있다)') : '')],
    ['섹션 접두 종류', s.qPrefixKinds + '종  ' + pairList(s.qPrefix, 12)],
    ['현재 QUESTION_RE', s.qCurrentReHits + '줄 일치']
  ], [16, 0]));

  H('4. 보기 글자');
  L.push(...table([
    ['"X." 형식', s.optUpper.length ? s.optUpper.slice().sort((a, b) => a[0] < b[0] ? -1 : 1).map(r => r[0] + '=' + r[1]).join('  ') : '없음'],
    ['"X)" 형식', s.optParen.length ? s.optParen.slice().sort((a, b) => a[0] < b[0] ? -1 : 1).map(r => r[0] + '=' + r[1]).join('  ') : '없음'],
    ['소문자 "x."', s.optLower.length ? s.optLower.slice().sort((a, b) => a[0] < b[0] ? -1 : 1).map(r => r[0] + '=' + r[1]).join('  ') : '없음'],
    ['연속 등장', s.optSeq.length ? s.optSeq.slice().sort((a, b) => a[0] < b[0] ? -1 : 1).map(r => r[0] + '=' + r[1]).join('  ') +
      '   (앞 글자 바로 뒤에 온 횟수 — 진짜 보기의 표지)' : '없음'],
    ['실사용 범위', s.optRange.contiguous ? ('A-' + s.optRange.contiguous + '  (판정 근거: ' + s.optRange.basis +
      ', 등장 최대 글자는 ' + s.optRange.max + ' 이지만 연속되지 않는다)') : '판정 불가'],
    ['현재 [A-E] 일치', s.optCurrentReHits + '줄']
  ], [16, 0]));

  H('5. 정답 문구');
  L.push(...table([
    ['번호 뒤 n-gram', s.answerNgram.length ? s.answerNgram.map(r => '"' + r[0] + '"×' + r[1]).join('  ') : '(5회 이상 반복되는 상용구 없음)'],
    ['정답 줄 수', String(s.answerLineHits)],
    ['정답 글자 분포', s.answerLetters.length ? s.answerLetters.slice().sort((a, b) => a[0] < b[0] ? -1 : 1).map(r => r[0] + '=' + r[1]).join('  ') : '없음'],
    ['구분자', s.answerSeparators.length ? pairList(s.answerSeparators, 8) : '없음'],
    ['현재 ANSWER_RE', s.answerCurrentReHits + '줄 일치 (실측 정답 줄 ' + s.answerLineHits + ')']
  ], [16, 0]));

  H('6. 캡션  ★ 이 도구를 만든 직접적 이유');
  L.push(...table([
    ['캡션 후보 줄', String(s.caption.lines)],
    ['접두어+번호형태', s.caption.shapes.length ? s.caption.shapes.map(r => r[0] + '=' + r[1]).join('  ') : '없음'],
    ['현재 정규식', '/^(FIGURE|FIG\\.|TABLE)\\s*\\d/i → ' + s.caption.currentRe + '건'],
    ['findCaption', '/^TABLE\\s*\\d/i → ' + s.caption.tableRe + '건'],
    ['role=figure-caption', String(s.caption.role)],
    ['표 region', s.caption.regions + '개, 그중 캡션 병합 ' + s.caption.inRegion + '건']
  ], [16, 0]));

  H('7. 머리말 · 꼬리말 · 쪽번호');
  L.push(...table([
    ['머리말 영역 줄', String(s.headerZoneLines) + '  (SECTION|CHAPTER|PART 일치 ' + s.headerPrefixHits + ')'],
    ['반복 머리말', s.headerKeyKinds + '종 중 3회 이상 반복 ' + s.headerRepeated + '종  (상위 빈도 ' +
      (s.headerKeys.map(r => r[1]).join(',') || '-') + ')  ※ 문자열은 --samples 에서만'],
    ['꼬리말 영역 줄', String(s.footerZoneLines) + '  (©|copyright|harrison|mcgraw 일치 ' + s.footerPrefixHits + ')'],
    ['반복 꼬리말', s.footerKeyKinds + '종 중 3회 이상 반복 ' + s.footerRepeated + '종  (상위 빈도 ' +
      (s.footerKeys.map(r => r[1]).join(',') || '-') + ')'],
    ['쪽번호 자릿수', s.pagenoDigits.map(r => r[0] + '자리=' + r[1]).join('  ') + '  → 최대 ' + s.pagenoDigitsMax +
      '자리 / 최대값 ' + s.pagenoMax],
    ['role=pageno', String(s.pagenoRole)]
  ], [16, 0]));

  H('8. 품질 지표');
  L.push(...table([
    ['[a-z][A-Z] 붙음', s.quality.glueCandidates + '건 / ' + s.quality.glueLines + '줄'],
    ['20자 이상 낱말', String(s.quality.longWords)],
    ['bbox 페이지 이탈', String(s.quality.bboxOutOfPage) + '줄  (아이템 width 가 깨진 줄 — 거터·컬럼 계산을 흔든다)'],
    ['텍스트 0인 쪽', s.quality.emptyPages + (s.emptyPageList.length ? ('  ' + JSON.stringify(s.emptyPageList.slice(0, 20))) : '')],
    ['회전 줄', String(s.quality.rotatedLines)],
    ['임상 단위 줄', String(s.quality.unitTokenLines)],
    ['글머리표 줄', String(s.quality.bulletLines)]
  ], [16, 0]));

  H('9. 컬럼 탐지 실패 후보');
  L.push(...table([
    ['run 간격>W/3', s.wideGap.lines + '줄 / ' + s.wideGap.pages + '쪽'],
    ['상위 쪽', s.wideGap.top.length ? s.wideGap.top.map(r => 'p' + r[0] + '(' + r[1] + ')').join(' ') : '없음']
  ], [16, 0]));

  H('10. 용량 · 성능');
  const proj = s.perf.projectedBytes;
  L.push(...table([
    ['buildPageLayout', n2(s.perf.ms.mean) + ' ms/쪽 (p90 ' + n2(s.perf.ms.p90, 0) + ', max ' + n2(s.perf.ms.max, 0) + ')'],
    ['저장본/쪽', kb(s.perf.bytes.mean) + ' (p50 ' + kb(s.perf.bytes.p50) + ', p90 ' + kb(s.perf.bytes.p90) + ', max ' + kb(s.perf.bytes.max) + ')'],
    ['items 포함/쪽', kb(s.perf.itemBytes.mean) + ' — spec 9-2 가 저장하지 말라는 쪽'],
    ['저장본 내역/쪽', 'lines ' + kb(s.perf.parts.lines) + '  paragraphs ' + kb(s.perf.parts.paragraphs) +
      '  regions ' + kb(s.perf.parts.regions) + '   ※ 축소 규칙 1·2·3 적용 후(toStored)'],
    ['전체 예상 용량', (proj / 1048576).toFixed(1) + 'MB JSON / 약 ' + (proj * 0.40 / 1048576).toFixed(1) +
      'MB IndexedDB  (' + (s.docPages || s.pagesSeen) + '쪽 × 평균, 9-2 의 0.40배 실측)'],
    ['spec 9-2 실측 대비', '기준 쪽당 20.6KB(JSON) → ' + (s.perf.bytes.mean == null ? 'n/a' :
      (s.perf.bytes.mean / 1024 <= 20.6 ? '이 책이 더 가볍다' : '이 책이 더 무겁다(' + kb(s.perf.bytes.mean) + ')'))],
    ['전체 예상 시간', (s.perf.projectedMs / 1000).toFixed(1) + '초 (레이아웃 계산만, PDF 파싱 제외)']
  ], [16, 0]));

  H('11. 언어');
  L.push(...table([
    ['글자 계통', Object.keys(s.scripts).map(k => k + '=' + s.scripts[k]).join('  ')],
    ['라틴 비율', n2(100 * s.langEvidence.latinRatio, 1) + '%   "the" 비율 ' + n2(100 * s.langEvidence.theRatio, 2) + '% (낱말 ' + s.langEvidence.words + ')'],
    ['추정 lang', s.lang == null ? '판정 불가 → 손으로 채울 것' : s.lang]
  ], [16, 0]));

  H('★ 경고 — 코드 상수/정규식과 측정값의 불일치');
  if (!s.warnings.length) L.push('  (없음)');
  for (let i = 0; i < s.warnings.length; i++) {
    const w = s.warnings[i];
    L.push('  [' + w.sev + '] ' + w.msg);
  }

  if (s.samples) {
    H('진단용 예시 (--samples, 40자 이하로 자름)');
    for (const k of Object.keys(s.samples)) {
      const rows = s.samples[k];
      if (!rows.length) continue;
      L.push('  · ' + k);
      for (let i = 0; i < rows.length; i++) {
        L.push('      ' + pad(rows[i][0], 22) + rows[i][1].map(t => '｢' + t + '｣').join(' '));
      }
    }
  }

  L.push('');
  return L.join('\n');
}

// gutterEm 의 하단값 표기를 위한 보조 (histStats 결과에서 min 을 꺼낸다)
function histQuantileOf(stats, key) { return stats ? stats[key] : null; }

/* ────────────────────────────────────────────────────────
   BOOK_PROFILE 초안 (spec 2-4 필드 구조)
   ──────────────────────────────────────────────────────── */

function slug(name) {
  return String(name || 'book')
    .replace(/\.[Pp][Dd][Ff]$/, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48) || 'book';
}

function todo(reason) { return 'null,   // TODO: 측정값 불충분 — ' + reason; }

export function renderBookProfile(s, meta = {}) {
  const id = slug(meta.file);
  const L = [];
  const q = s.qTop ? s.qTop[0] : null;

  // 섹션 접두 — roman-dash-num 이 최빈이고 접두 토큰이 로마숫자뿐일 때만 정규식을 쓴다
  let sectionPrefix;
  const romanish = s.qPrefix.filter(function (r) { return /^[IVXLCDM]{1,7}$/.test(r[0]); });
  const prefixLen = s.qPrefix.reduce(function (m, r) { return Math.max(m, String(r[0]).length); }, 0);
  if (q === 'roman-dash-num' && romanish.length && romanish.length === s.qPrefix.length) {
    sectionPrefix = '/[IVXLCDM]{1,' + Math.max(5, prefixLen) + '}/,';
  } else if (q === 'alpha-dash-num' && s.qPrefix.length) {
    sectionPrefix = '/[A-Z]{1,' + Math.max(3, prefixLen) + '}/,';
  } else if (q && s.qPrefix.length === 0) {
    sectionPrefix = 'null,';
  } else {
    sectionPrefix = todo('문항 번호 표본 ' + (s.qTop ? s.qTop[1] : 0) + '줄, 접두 ' + s.qPrefixKinds + '종');
  }

  const optLetters = s.optRange.contiguous ? "'A-" + s.optRange.contiguous + "'," : todo('보기 줄 표본 부족');
  // 자릿수 상한은 **이상치가 아니라 표본이 충분한 최대값**에 여유를 더해 정한다.
  const numberMax = s.qDigitsRobust > 0 ? (Math.max(s.qDigitsRobust + 1, 4) + ',') : todo('문항 번호 없음');
  const pageNoMax = s.pagenoDigitsRobust > 0
    ? (Math.max(s.pagenoDigitsRobust, String(Math.max(s.docPages, s.pagenoMax)).length) + 1 + ',')
    : todo('쪽번호 줄 없음');

  // 정답 문구 — 상용구 n-gram 중 정답 줄에서 실제로 쓰인 것이 있을 때만 정규식화
  let answerPhrase;
  if (s.answerLineHits >= 5) {
    answerPhrase = '/the answers? (is|are)/i,';
  } else {
    answerPhrase = todo('정답 줄 ' + s.answerLineHits + '건 — 언어가 다르거나 해설이 없는 책일 수 있다');
  }
  const seps = s.answerSeparators.map(function (r) { return r[0]; });
  const answerSeparators = seps.length
    ? '/' + seps.map(function (x) { return x === '/' ? '\\/' : x; }).join('|') + '/i,'
    : '/,|and|&|or/i,   // TODO: 구분자 사례 0건 — 기본값';

  /* 캡션 — **번호를 달고 나오는 접두어만** 넣는다.
   * "panel is within normal:" 처럼 본문이 우연히 접두어 낱말로 시작한 것은 뒤 토큰이
   * 번호가 아니다(shape='other'). 그것까지 정규식에 넣으면 본문이 캡션으로 둔갑한다. */
  const NUMBERED = ['digit', 'roman-dash-digit', 'digit-dash-digit', 'alpha-dash-digit'];
  const capPrefixes = Array.from(new Set(s.caption.shapes
    .filter(function (r) { return NUMBERED.indexOf(String(r[0]).split(' + ')[1]) >= 0 && r[1] >= 3; })
    .map(function (r) { return String(r[0]).split(' + ')[0]; })));
  const capDropped = Array.from(new Set(s.caption.shapes
    .filter(function (r) { return NUMBERED.indexOf(String(r[0]).split(' + ')[1]) < 0 || r[1] < 3; })
    .map(function (r) { return String(r[0]).split(' + ')[0]; })))
    .filter(function (p) { return capPrefixes.indexOf(p) < 0; });
  const capShapes = new Set(s.caption.shapes.map(function (r) { return String(r[0]).split(' + ')[1]; }));
  const captionPrefixes = capPrefixes.length
    ? '/^(' + capPrefixes.map(function (p) { return p === 'FIG' ? 'FIG\\.?' : p; }).join('|') + ')\\b/i,' +
      (capDropped.length ? ('   // 번호 없이 나온 접두어는 뺐다(본문 오탐): ' + capDropped.join(', ')) : '')
    : todo('번호를 단 캡션 후보 0건');
  let captionNumber;
  if (capShapes.has('roman-dash-digit') && capShapes.has('digit')) captionNumber = '/^\\s*(?:[IVXLCDM]{1,7}-)?\\d/,';
  else if (capShapes.has('roman-dash-digit')) captionNumber = '/^\\s*[IVXLCDM]{1,7}-\\d/,';
  else if (capShapes.has('digit')) captionNumber = '/^\\s*\\d/,';
  else captionNumber = todo('캡션 번호 형태 표본 부족');

  // 영역 줄의 0.5%(최소 3건)도 못 잡으면 "쓰이지 않는 규칙"으로 본다.
  const headerAlive = s.headerPrefixHits > Math.max(2, s.headerZoneLines * 0.005);
  const footerAlive = s.footerPrefixHits > Math.max(2, s.footerZoneLines * 0.005);
  const headerPrefixes = headerAlive
    ? '/^(SECTION|CHAPTER|PART)\\b/i,   // 머리말 영역 ' + s.headerZoneLines + '줄 중 ' + s.headerPrefixHits + '줄 일치'
    : 'null,   // TODO: 머리말 영역 ' + s.headerZoneLines + '줄 중 SECTION|CHAPTER|PART 일치는 ' + s.headerPrefixHits +
      '줄뿐이다. 이 책은 3회 이상 반복되는 running head 가 ' + s.headerRepeated + '종밖에 없어 접두어로도 반복으로도 잡히지 않는다';
  const footerPatterns = footerAlive
    ? '/^(©|copyright)/i,   // 꼬리말 영역 ' + s.footerZoneLines + '줄 중 ' + s.footerPrefixHits +
      '줄 일치 — 서적명·출판사는 여기에 직접 적을 것'
    : 'null,   // TODO: 꼬리말 영역 ' + s.footerZoneLines + '줄 중 ©|copyright|서적명 일치는 ' + s.footerPrefixHits +
      '줄뿐이다. 이 책의 꼬리말은 반복 문자열(3회 이상 ' + s.footerRepeated + '종, 최다 ' +
      (s.footerKeys.length ? s.footerKeys[0][1] : 0) + '회)과 폰트 크기로만 걸린다';

  const bullets = s.quality.bulletLines;
  const unitLines = s.quality.unitTokenLines;
  const runGap = s.runGapFactor.recommend;

  L.push('/* ============================================================');
  L.push('   BOOK_PROFILE 초안 — dev/profile.mjs 자동 생성 (spec 2-4)');
  L.push('');
  L.push('   원본       : ' + (meta.file || '(unknown)'));
  L.push('   측정       : ' + s.pagesSeen + ' / ' + s.docPages + '쪽' +
    (s.mode.stride > 1 ? (' (--stride ' + s.mode.stride + ')') : '') + '   생성 ' + (meta.now || ''));
  L.push('   ※ 초안이다. TODO 표시는 측정으로 정할 수 없었던 값이다 — 손으로 채운다.');
  L.push('   ※ 이 파일에는 원서 문장이 들어가지 않는다(패턴·빈도·수치만).');
  L.push('   ============================================================ */');
  L.push('');
  L.push('export const BOOK_PROFILE = {');
  L.push('  id: ' + JSON.stringify(id) + ',');
  L.push('  title: null,   // TODO: 손으로 적는다 (측정 대상이 아니다)');
  L.push('  lang: ' + (s.lang ? JSON.stringify(s.lang) + ',' : todo('라틴 ' + (100 * s.langEvidence.latinRatio).toFixed(1) +
    '%, "the" ' + (100 * s.langEvidence.theRatio).toFixed(2) + '%')));
  L.push('');
  L.push('  question: {');
  L.push('    // 최빈 형식: ' + (s.qTop ? s.qTop[0] + ' (' + s.qTop[1] + '줄)' : '없음') +
    ' / 전체: ' + (s.qFormatLine.map(function (r) { return r[0] + '=' + r[1]; }).join(', ') || '없음'));
  L.push('    sectionPrefix: ' + sectionPrefix);
  L.push('    numberMax: ' + numberMax + '   // 표본이 충분한 최대 ' + s.qDigitsRobust + '자리 + 여유 1' +
    (s.qDigitsOutliers.length ? ('. 이상치 ' + s.qDigitsOutliers.map(function (r) { return r[0] + '자리 ' + r[1] + '건'; }).join(',') +
      '(최대 번호 ' + s.qNumberMax + ')는 오검출로 보고 버렸다') : ''));
  L.push('    // 보기 글자 범위는 빈도가 아니라 **연속성**으로 정했다(' + s.optRange.basis + '). ' +
    '앞 글자 뒤에 이어 나온 횟수: ' + (s.optSeq.slice().sort(function (a, b) { return a[0] < b[0] ? -1 : 1; })
      .map(function (r) { return r[0] + ':' + r[1]; }).join(' ') || '없음'));
  L.push('    optionLetters: ' + optLetters + '   // 등장 빈도 ' +
    (s.optUpper.slice().sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }).map(function (r) { return r[0] + ':' + r[1]; }).join(' ') || '없음'));
  L.push('    answerPhrase: ' + answerPhrase + '   // 정답 줄 ' + s.answerLineHits + '건');
  L.push('    answerSeparators: ' + answerSeparators);
  L.push('    answerLetters: ' + (s.answerRange.max ? "'A-" + s.answerRange.max + "'," : 'null,') +
    '   // 실측 정답 글자 ' + (s.answerLetters.map(function (r) { return r[0] + ':' + r[1]; }).join(' ') || '없음'));
  L.push('  },');
  L.push('');
  L.push('  roles: {');
  L.push('    headerPrefixes: ' + headerPrefixes);
  L.push('    footerPatterns: ' + footerPatterns);
  L.push('    pageNoMax: ' + pageNoMax + '   // 실측 최대 ' + s.pagenoDigitsMax + '자리(쪽번호 ' + s.pagenoMax + '), 문서 ' + s.docPages + '쪽');
  L.push('    captionPrefixes: ' + captionPrefixes);
  L.push('    captionNumber: ' + captionNumber);
  L.push('    // 실측 캡션: ' + (s.caption.shapes.map(function (r) { return r[0] + '=' + r[1]; }).join(', ') || '없음'));
  L.push('    // 현재 코드 정규식 일치 ' + s.caption.currentRe + '건 / role=figure-caption ' + s.caption.role + '건');
  L.push('  },');
  L.push('');
  L.push('  text: {');
  L.push('    keepHyphenPrefixes: null,   // TODO: 측정 대상이 아니다 — config.js 기본값을 쓰거나 손으로 적는다');
  L.push('    keepHyphenSuffixes: null,   // TODO: 같음 ([a-z][A-Z] 붙음 후보 ' + s.quality.glueCandidates + '건 참고)');
  L.push('    abbreviations: null,        // TODO: 같음');
  L.push('    unitTokens: ' + (unitLines > 0
    ? '/mg|mcg|µg|g|kg|mL|L|PO|IV|IM|SC|%/i,   // 실측 일치 ' + unitLines + '줄'
    : 'null,   // TODO: 실측 일치 0줄 — 이 책에서는 표 가점 신호로 쓸 수 없다'));
  L.push('    bulletChars: ' + (bullets > 0
    ? '/[•·▪\\-–]/,   // 실측 글머리표 줄 ' + bullets
    : 'null,   // TODO: 글머리표 줄 0건'));
  L.push('  },');
  L.push('');
  L.push('  layoutOverrides: {');
  if (runGap != null) {
    L.push('    // 거터 실측 ' + n2(s.gutter.p50, 1) + 'pt (중앙값 ' + n2(s.gutterEm.p50) + 'em, p10 ' +
      n2(s.runGapFactor.gutterLow) + 'em, 표본 ' + s.gutterPagesMeasured + '쪽)');
    L.push('    RUN_GAP_FACTOR: ' + runGap + (Math.abs(runGap - s.runGapFactor.current) <= 0.25
      ? '   // 현재 LAYOUT 값 ' + s.runGapFactor.current + ' 과 사실상 같다 — 생략해도 된다'
      : '   // 현재 LAYOUT 값 ' + s.runGapFactor.current + ' 과 다르다'));
  } else {
    L.push('    // ' + s.runGapFactor.note);
    L.push('    RUN_GAP_FACTOR: ' + todo(s.runGapFactor.note));
  }
  L.push('  }');
  L.push('};');
  L.push('');
  L.push('export default BOOK_PROFILE;');
  L.push('');
  return L.join('\n');
}
