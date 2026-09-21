/* ============================================================
   MedReader — 아이템 정규화·줄 재구성·텍스트 결합 (spec 4-2, 4-3, 4-4, 4-6)

   순수 모듈. 전역(브라우저 API)을 전혀 참조하지 않는다.
   Math / String / Array / Map / Set / Number / Object / JSON 만 쓴다.
   ============================================================ */

import { LAYOUT } from '../config.js';

/* ────────────────────────────────────────────────────────
   작은 수학 유틸 — columns.js / blocks.js 와 공유한다.
   ──────────────────────────────────────────────────────── */

export function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

// 중앙값. 빈 배열이면 0. 입력을 훼손하지 않는다.
export function median(values) {
  const a = [];
  for (let i = 0; i < values.length; i++) {
    const v = Number(values[i]);
    if (Number.isFinite(v)) a.push(v);
  }
  if (!a.length) return 0;
  a.sort((p, q) => p - q);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

// spec 4-5 (d) — 중앙값 절대편차
export function mad(values) {
  const m = median(values);
  const dev = [];
  for (let i = 0; i < values.length; i++) {
    const v = Number(values[i]);
    if (Number.isFinite(v)) dev.push(Math.abs(v - m));
  }
  return median(dev);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// spec 4-2 — 공백만 있는 아이템인가 (버리지는 않되 폭 계산에서 뺀다)
export function isBlankItem(it) {
  return it.str === '' || /^\s+$/.test(it.str);
}

/* ────────────────────────────────────────────────────────
   1단계 — 정규화 (spec 4-2)
   ──────────────────────────────────────────────────────── */

// spec 4-2 — NBSP는 일반 공백으로, 소프트 하이픈·제로폭 문자는 제거.
// 그 외 문자는 건드리지 않는다(µ, ≥, ½ 등 의학 기호 보존).
function cleanStr(s) {
  return String(s)
    .replace(/\u00A0/g, ' ')
    .replace(/\u00AD/g, '')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
}

/**
 * spec 4-2 `[수정 2026-09-20]` — pdf.js getTextContent().items 를 TextItem[] 으로 정규화한다.
 * 회전 아이템은 본문 파이프라인에서 분리해 따로 돌려준다.
 *
 * 폭 위생: `[실측]` pdf.js 가 주는 item.width 의 2.13%(97,127개 중 2,069개)가
 * 페이지 폭을 넘거나 음수다. 그 값이 그대로 흘러가면
 *   (a) splitRuns 의 gap = cur.x − (prev.x + prev.w) 가 거대한 음수가 되어 run 분할이 무너지고,
 *   (b) 4-5 거터 히스토그램의 간격 구간이 오염되며,
 *   (c) lineBBox 가 깨져 줄 4.7% 의 bbox 가 페이지 밖으로 나간다(최대 9,337pt, 페이지 폭 612pt).
 * (c)는 4-12 의 하이라이트 오버레이가 페이지 폭의 15배짜리 사각형을 그린다는 뜻이다.
 * **원본 str 은 건드리지 않는다** — 위생은 좌표·폭에만 적용한다.
 *
 * @param {Array} rawItems getTextContent().items
 * @param {Object} styles  getTextContent().styles
 * @param {Object} params  알고리즘 파라미터(기본 LAYOUT)
 * @param {Object} [pageInfo] { width } — 페이지 폭. 선택 인자이며, 주지 않으면
 *                 "폭 초과" 판정을 건너뛴다(판단 근거가 없는 값을 추측으로 바꾸지 않는다).
 * @returns {{items:Array, rotated:Array, stats:Object}}
 */
export function normalizeItems(rawItems, styles, params = LAYOUT, pageInfo = null) {
  const P = params || LAYOUT;
  const st = styles || {};
  const list = Array.isArray(rawItems) ? rawItems : [];
  const kept = [];

  const pw = pageInfo ? Number(pageInfo.width) : NaN;
  const pageWidth = Number.isFinite(pw) && pw > 0 ? pw : 0;
  let widthNegative = 0, widthNaN = 0, widthOverflow = 0;

  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    // 방어: str 이 문자열이 아닌 아이템(마크드 콘텐츠 등)은 버린다
    if (!raw || typeof raw.str !== 'string') continue;

    const tr = Array.isArray(raw.transform) ? raw.transform : [0, 0, 0, 0, 0, 0];
    const a = num(tr[0]), b = num(tr[1]), c = num(tr[2]), d = num(tr[3]);
    const x = num(tr[4]), y = num(tr[5]);

    const rawW = Number(raw.width);
    const h = num(raw.height);

    // spec 4-0: 폰트 크기는 hypot(b, d). 회전·스큐가 있어도 안전하다.
    let fontSize = Math.hypot(b, d);
    if (!(fontSize > 0)) fontSize = Math.hypot(a, c);

    const str = cleanStr(raw.str);

    // spec 4-2 폭 위생 — 순서: 음수 → 0, NaN·페이지 폭 초과 → 추정 대체.
    // 추정치 str.length × fontSize × 0.5 의 0.5em 은 라틴 문자 평균 자폭이다.
    // fontSize 가 아직 0 이면(페이지 전체가 병적) 후처리 중앙값 대체 뒤에
    // 고칠 수 없으므로 여기서는 FALLBACK_FONT_SIZE 로 추정한다.
    let w;
    if (!Number.isFinite(rawW)) {
      widthNaN++;
      w = str.length * (fontSize > 0 ? fontSize : P.FALLBACK_FONT_SIZE) * 0.5;
    } else if (rawW < 0) {
      widthNegative++;
      w = 0;
    } else if (pageWidth > 0 && rawW > pageWidth) {
      widthOverflow++;
      w = str.length * (fontSize > 0 ? fontSize : P.FALLBACK_FONT_SIZE) * 0.5;
    } else {
      w = rawW;
    }

    // spec 4-2: 빈 아이템은 줄 끝 힌트만 직전 아이템에 옮기고 버린다
    if (str === '' && (w === 0 || !Number.isFinite(x) || !Number.isFinite(y))) {
      if (raw.hasEOL === true && kept.length) kept[kept.length - 1].hasEOL = true;
      continue;
    }

    const fontName = typeof raw.fontName === 'string' ? raw.fontName : '';
    const style = st[fontName] || null;
    let ascent = style ? num(style.ascent) : 0;
    let descent = style ? num(style.descent) : 0;
    if (!(ascent > 0)) ascent = P.DEFAULT_ASCENT;
    if (!(descent < 0)) descent = P.DEFAULT_DESCENT;

    kept.push({
      str: str,
      x: x,
      y: y,
      w: w,
      h: h,
      fontSize: fontSize,
      fontName: fontName,
      ascent: ascent,
      descent: descent,
      rotated: Math.abs(b) > P.ROTATE_EPS || Math.abs(c) > P.ROTATE_EPS,
      hasEOL: raw.hasEOL === true,
      sup: false,
      idx: i
    });
  }

  // spec 4-2 — fontSize 가 0/NaN 인 아이템은 페이지 중앙값으로 대체
  const sizes = [];
  for (let i = 0; i < kept.length; i++) if (kept[i].fontSize > 0) sizes.push(kept[i].fontSize);
  const med = median(sizes);
  const fallback = med > 0 ? med : P.FALLBACK_FONT_SIZE;
  const items = [];
  const rotated = [];
  for (let i = 0; i < kept.length; i++) {
    const it = kept[i];
    if (!(it.fontSize > 0)) it.fontSize = fallback;
    (it.rotated ? rotated : items).push(it);
  }
  return {
    items: items,
    rotated: rotated,
    // spec 4-2 — 몇 개를 고쳤는지 센다. 7000쪽 실자료에서 이 수가 튀면
    // 새 자료의 폭 정보가 더 심하게 깨져 있다는 신호다.
    stats: {
      widthFixed: widthNegative + widthNaN + widthOverflow,
      widthNegative: widthNegative,
      widthNaN: widthNaN,
      widthOverflow: widthOverflow
    }
  };
}

/* ────────────────────────────────────────────────────────
   2단계 — Y 클러스터링 (spec 4-3)
   ──────────────────────────────────────────────────────── */

function newLine(it) {
  return {
    items: [it],
    baseline: it.y,
    fontSize: it.fontSize,
    col: 0,
    role: 'body',
    runs: [],
    text: '',
    bbox: null,
    hyphenJoin: false,
    paraId: null,
    regionId: null,
    // 내부 누적값(가중 baseline, 최대 폭 아이템). 출력에는 포함하지 않는다.
    _wsum: it.fontSize,
    _bsum: it.y * it.fontSize,
    _maxW: it.w,
    _maxIdx: it.idx
  };
}

/**
 * spec 4-3 — 줄 합류 판정. 'normal' | 'sup' | null 을 돌려준다.
 * 'sup' 은 위첨자 예외로 합류한 경우이며 baseline 가중치가 0이다.
 */
export function joinKind(line, item, params = LAYOUT) {
  const P = params || LAYOUT;
  const ref = Math.min(line.fontSize, item.fontSize);
  const tol = clamp(P.Y_TOL_FACTOR * ref, P.Y_TOL_MIN, P.Y_TOL_MAX);
  const dy = Math.abs(line.baseline - item.y);
  if (dy <= tol) return 'normal';
  if (item.fontSize <= P.SUPERSCRIPT_SIZE_RATIO * line.fontSize &&
      item.w <= P.SUPERSCRIPT_MAX_WIDTH_EM * line.fontSize &&
      dy <= P.SUPERSCRIPT_DY_RATIO * line.fontSize) return 'sup';
  return null;
}

// spec 4-3 — sameLine()
export function sameLine(line, item, params = LAYOUT) {
  return joinKind(line, item, params) !== null;
}

function pushItem(line, it, kind) {
  line.items.push(it);
  if (kind === 'sup') {
    // spec 4-3: 위첨자로 합류한 아이템은 baseline 을 끌어올리지 않는다
    it.sup = true;
  } else {
    line._wsum += it.fontSize;
    line._bsum += it.y * it.fontSize;
    if (line._wsum > 0) line.baseline = line._bsum / line._wsum;
  }
  // spec 4-3: line.fontSize 는 "가장 넓은 아이템"의 fontSize (동률이면 앞선 idx)
  if (it.w > line._maxW || (it.w === line._maxW && it.idx < line._maxIdx)) {
    line._maxW = it.w;
    line._maxIdx = it.idx;
    line.fontSize = it.fontSize;
  }
}

/**
 * spec 4-3 — Y 내림차순 안정 정렬 후 직전 줄과만 비교해 묶는다.
 * 2단 페이지에서 좌·우 컬럼이 한 줄로 묶이는 것은 의도된 동작이며
 * 4단계(reassignByColumn)에서 다시 나뉜다.
 */
export function clusterLines(items, params = LAYOUT) {
  const P = params || LAYOUT;
  const src = Array.isArray(items) ? items : [];
  for (let i = 0; i < src.length; i++) src[i].sup = false;   // 재실행 시 상태 초기화

  const sorted = src.slice().sort(function (p, q) {
    if (q.y !== p.y) return q.y - p.y;          // y 내림차순
    if (p.x !== q.x) return p.x - q.x;          // x 오름차순
    return p.idx - q.idx;                       // 명시적 tie-breaker
  });

  const lines = [];
  let cur = null;
  for (let i = 0; i < sorted.length; i++) {
    const it = sorted[i];
    const kind = cur ? joinKind(cur, it, P) : null;
    if (kind) pushItem(cur, it, kind);
    else { cur = newLine(it); lines.push(cur); }
  }

  const merged = absorbSmallLines(lines, P);

  // spec 4-3 — 줄 내부는 x 오름차순(동률이면 idx). 원 스트림 순서를 믿지 않는다.
  for (let i = 0; i < merged.length; i++) {
    merged[i].items.sort(function (p, q) {
      if (p.x !== q.x) return p.x - q.x;
      return p.idx - q.idx;
    });
  }
  return merged;
}

/**
 * spec 4-3 위첨자 예외의 2차 통과.
 *
 * [보강] 4-3 의 의사코드는 "y 내림차순으로 훑으며 직전 줄과 비교"인데,
 * 위첨자는 baseline 이 본문보다 위에 있어 본문보다 *먼저* 나온다. 그래서
 * 위첨자가 홀로 새 줄을 열고, 뒤따르는 큰 본문 아이템은 (작은 쪽 기준의
 * 좁은 허용오차 때문에) 그 줄에 합류하지 못한다 — 예외가 한 번도 발동하지
 * 않는다. 클러스터링 후 "모든 아이템이 이웃 줄의 0.75배 이하이고 baseline
 * 차가 0.6×이웃 폰트 이내인 줄"을 이웃에 흡수시켜 같은 결과를 만든다.
 * 흡수된 아이템은 sup=true 이므로 baseline·bbox 를 끌어올리지 않는다.
 */
function absorbSmallLines(lines, P) {
  if (lines.length < 2) return lines;
  const dropped = new Array(lines.length).fill(false);

  for (let i = 0; i < lines.length; i++) {
    if (dropped[i]) continue;
    const L = lines[i];
    let best = -1;
    let bestDy = Infinity;
    const cands = [i - 1, i + 1];
    for (let k = 0; k < cands.length; k++) {
      const j = cands[k];
      if (j < 0 || j >= lines.length || dropped[j]) continue;
      const T = lines[j];
      if (!T.items.length) continue;
      let small = true;
      for (let n = 0; n < L.items.length; n++) {
        if (L.items[n].fontSize > P.SUPERSCRIPT_SIZE_RATIO * T.fontSize) { small = false; break; }
      }
      if (!small) continue;
      // [보강] 위첨자는 "조각"이다. 폭이 이웃 줄에 견줄 만하거나 이웃 줄의
      // X 범위 밖에 있으면(다른 컬럼·다른 요소) 흡수하지 않는다.
      if (spanWidth(L) > P.SUPERSCRIPT_WIDTH_RATIO * spanWidth(T)) continue;
      if (spanWidth(L) > P.SUPERSCRIPT_MAX_WIDTH_EM * T.fontSize) continue;
      const slack = 2 * T.fontSize;
      if (minX(L) < minX(T) - slack || maxX(L) > maxX(T) + slack) continue;
      const dy = Math.abs(T.baseline - L.baseline);
      if (dy <= P.SUPERSCRIPT_DY_RATIO * T.fontSize && dy < bestDy) { best = j; bestDy = dy; }
    }
    if (best < 0) continue;
    const T = lines[best];
    for (let n = 0; n < L.items.length; n++) {
      L.items[n].sup = true;
      T.items.push(L.items[n]);
    }
    dropped[i] = true;
  }

  const out = [];
  for (let i = 0; i < lines.length; i++) if (!dropped[i]) out.push(lines[i]);
  return out;
}

function minX(line) {
  let v = Infinity;
  for (let i = 0; i < line.items.length; i++) if (line.items[i].x < v) v = line.items[i].x;
  return Number.isFinite(v) ? v : 0;
}

function maxX(line) {
  let v = -Infinity;
  for (let i = 0; i < line.items.length; i++) {
    const r = line.items[i].x + line.items[i].w;
    if (r > v) v = r;
  }
  return Number.isFinite(v) ? v : 0;
}

function spanWidth(line) {
  const w = maxX(line) - minX(line);
  return w > 0 ? w : 0;
}

/* ────────────────────────────────────────────────────────
   3단계 — run 분할 (spec 4-4)
   ──────────────────────────────────────────────────────── */

function newRun(it) {
  const blank = isBlankItem(it);
  return {
    items: [it],
    x0: it.x,
    x1: blank ? it.x : it.x + it.w,
    _solid: !blank
  };
}

function extendRun(run, it) {
  run.items.push(it);
  if (isBlankItem(it)) return;                 // 공백 아이템은 run 폭에 넣지 않는다
  if (!run._solid) { run.x0 = it.x; run.x1 = it.x + it.w; run._solid = true; return; }
  if (it.x < run.x0) run.x0 = it.x;
  if (it.x + it.w > run.x1) run.x1 = it.x + it.w;
}

/**
 * spec 4-4 — 큰 X 간격(RUN_GAP_FACTOR x fontSize, 현재 1.2)으로 줄을 run 으로 나눈다.
 * [보강] 간격 계산의 기준은 "직전 비공백 아이템"이다. pdf.js 가 거터·표 셀
 * 사이에 폭 있는 공백 아이템을 끼워 넣으면 간격이 두 조각으로 쪼개져
 * 컬럼 거터가 감지되지 않기 때문이다(4-2가 공백 아이템을 남기도록 정한 결과).
 */
export function splitRuns(line, params = LAYOUT) {
  const P = params || LAYOUT;
  const items = line.items;
  const runs = [];
  let cur = null;
  let lastSolid = null;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!cur) {
      cur = newRun(it);
      runs.push(cur);
      if (!isBlankItem(it)) lastSolid = it;
      continue;
    }
    if (isBlankItem(it)) { extendRun(cur, it); continue; }
    if (!lastSolid) { extendRun(cur, it); lastSolid = it; continue; }
    const gap = it.x - (lastSolid.x + lastSolid.w);
    if (gap > P.RUN_GAP_FACTOR * line.fontSize) {
      cur = newRun(it);
      runs.push(cur);
    } else {
      extendRun(cur, it);
    }
    lastSolid = it;
  }
  line.runs = runs;
  return runs;
}

/* ────────────────────────────────────────────────────────
   6단계 — 텍스트 결합과 bbox (spec 4-6)
   ──────────────────────────────────────────────────────── */

/**
 * spec 4-6 — 줄 안에서 인접 아이템을 이으며 공백 삽입을 판정한다.
 * 공백이 빠지는 실수가 공백이 하나 더 들어가는 실수보다 낭독에 치명적이므로
 * 임계(0.15 x fontSize)는 공백을 넣는 쪽으로 여유를 둔다.
 */
export function joinText(line, params = LAYOUT) {
  const P = params || LAYOUT;
  const items = line.items;
  let out = '';
  for (let i = 0; i < items.length; i++) {
    const cur = items[i];
    if (i === 0) { out = cur.str; continue; }
    const prev = items[i - 1];
    const gap = cur.x - (prev.x + prev.w);

    // 겹침: 가짜 볼드·밑줄용 이중 인쇄. 같은 문자열이면 버린다.
    if (gap < -P.OVERLAP_FACTOR * cur.fontSize && cur.str.trim() === prev.str.trim()) continue;

    const needSpace = !out.endsWith(' ') && !cur.str.startsWith(' ') &&
      gap > P.SPACE_GAP_FACTOR * Math.min(prev.fontSize, cur.fontSize);
    out = out + (needSpace ? ' ' : '') + cur.str;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * spec 4-6 — 줄 bbox (PDF 좌표, 원점 좌하단).
 * 위첨자 아이템은 y1 계산에서 제외해 줄 박스가 위로 튀지 않게 한다.
 */
export function lineBBox(line) {
  const items = line.items;
  if (!items || !items.length) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, supY1 = -Infinity;
  let hasBase = false;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const top = it.y + it.ascent * it.fontSize;
    const bottom = it.y + it.descent * it.fontSize;
    if (it.x < x0) x0 = it.x;
    if (it.x + it.w > x1) x1 = it.x + it.w;
    if (bottom < y0) y0 = bottom;
    if (top > supY1) supY1 = top;
    if (!it.sup) { if (top > y1) y1 = top; hasBase = true; }
  }
  if (!hasBase) y1 = supY1;
  return { x0: x0, y0: y0, x1: x1, y1: y1 };
}

// 줄의 왼쪽 끝 x — 읽기 순서 정렬의 tie-breaker 로 쓴다(bbox 계산 전에도 필요).
export function lineX0(line) {
  let x0 = Infinity;
  for (let i = 0; i < line.items.length; i++) if (line.items[i].x < x0) x0 = line.items[i].x;
  return Number.isFinite(x0) ? x0 : 0;
}

// 줄이 가진 가장 작은 원본 인덱스 — 최종 tie-breaker.
export function lineMinIdx(line) {
  let m = Infinity;
  for (let i = 0; i < line.items.length; i++) if (line.items[i].idx < m) m = line.items[i].idx;
  return Number.isFinite(m) ? m : 0;
}
