/* ============================================================
   MedReader — 다단 컬럼 판별과 읽기 순서 (spec 4-5)

   순수 모듈. 전역을 참조하지 않는다.
   ============================================================ */

import { LAYOUT } from '../config.js';
import { median, mad, lineX0, lineMinIdx } from './lines.js';

/* ────────────────────────────────────────────────────────
   4단계 — 거터 탐지 (spec 4-5)
   ──────────────────────────────────────────────────────── */

// spec 4-5 — 본문 후보 줄: 상·하단 8% 밖 + 폰트가 중앙값의 0.7~1.4배
export function bodyCandidates(lines, pageInfo, params = LAYOUT) {
  const P = params || LAYOUT;
  const H = Number(pageInfo && pageInfo.height) || 0;
  const sizes = [];
  for (let i = 0; i < lines.length; i++) sizes.push(lines[i].fontSize);
  const Fm = median(sizes);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (H > 0) {
      if (l.baseline > H * (1 - P.HEADER_ZONE)) continue;
      if (l.baseline < H * P.FOOTER_ZONE) continue;
    }
    if (Fm > 0 && (l.fontSize < P.BODY_FONT_LO * Fm || l.fontSize > P.BODY_FONT_HI * Fm)) continue;
    out.push(l);
  }
  return { body: out, Fm: Fm };
}

/**
 * spec 4-5 — run 경계 히스토그램으로 2단 여부를 판정한다.
 * "거터를 가로지를 수 있는 본문 줄의 55% 이상이 같은 X 대역에서 끊긴다"가
 * 2단의 정의다(분모는 body.length 가 아니다 — 아래 (c) 참조).
 * 3단 이상은 지원하지 않는다(band 가 2개 이상이면 가장 강한 것 하나 + 경고).
 *
 * @returns {{count:number, gutters:number[], warn:(string|null)}}
 */
export function detectColumns(lines, pageInfo, params = LAYOUT) {
  const P = params || LAYOUT;
  const W = Number(pageInfo && pageInfo.width) || 0;
  const none = { count: 1, gutters: [], warn: null };
  if (!Array.isArray(lines) || !lines.length || !(W > 0)) return none;

  const cand = bodyCandidates(lines, pageInfo, P);
  const body = cand.body;
  const Fm = cand.Fm;
  if (body.length < P.MIN_BODY_LINES) return none;          // 정보 부족 → 1단

  // (b) 페이지 폭을 BIN 개로 나눈 히스토그램에 run 사이 간격 구간을 투영
  const BINS = P.GUTTER_BINS;
  const BIN = W / BINS;
  const hist = new Array(BINS).fill(0);
  for (let i = 0; i < body.length; i++) {
    const runs = body[i].runs || [];
    const marked = new Set();               // 한 줄은 bin 당 최대 1회
    for (let r = 1; r < runs.length; r++) {
      const g0 = runs[r - 1].x1;
      const g1 = runs[r].x0;
      if (!(g1 > g0)) continue;
      const lo = Math.max(0, Math.ceil(g0 / BIN));
      const hi = Math.min(BINS - 1, Math.floor(g1 / BIN) - 1);
      for (let b = lo; b <= hi; b++) {
        if (!marked.has(b)) { marked.add(b); hist[b] += 1; }
      }
    }
  }

  // (c) 페이지 중앙부에서 임계를 넘는 연속 bin 구간(band) 찾기
  //
  // 분모는 body.length 가 아니라 "그 bin 의 X 를 가로지르는 본문 줄 수"다.
  // 한쪽 컬럼에만 있는 줄은 거터를 가로지르지 않으므로 거터에서 끊길 수가
  // 없다 — 투표할 수 없는 표를 분모에 넣으면 비율이 구조적으로 희석된다.
  // 좌·우 baseline 이 어긋나는 문제집 조판에서는 그런 줄이 과반이라 2단
  // 페이지가 통째로 1단으로 판정됐다(spec 4-5 [수정 2026-09-18]).
  const loBin = Math.ceil(P.GUTTER_BAND_LO * BINS);
  const hiBin = Math.floor(P.GUTTER_BAND_HI * BINS);
  const cross = new Array(BINS).fill(0);
  for (let b = loBin; b <= hiBin; b++) {
    const X = (b + 0.5) * BIN;
    let c = 0;
    for (let i = 0; i < body.length; i++) {
      const runs = body[i].runs || [];
      if (!runs.length) continue;
      if (runs[0].x0 < X && runs[runs.length - 1].x1 > X) c++;
    }
    cross[b] = c;
  }

  const minWidth = P.GUTTER_BAND_MIN_WIDTH_FACTOR * (Fm > 0 ? Fm : 1);
  const bands = [];
  let start = -1;
  for (let b = loBin; b <= hiBin + 1; b++) {
    // 가로지르는 줄이 너무 적으면 표본 부족 → 그 bin 은 거터 후보가 아니다
    const ok = b <= hiBin && cross[b] >= P.GUTTER_MIN_CROSSING &&
      hist[b] >= P.GUTTER_MIN_RATIO * cross[b];
    if (ok && start < 0) start = b;
    if (!ok && start >= 0) {
      const end = b - 1;
      let sum = 0;
      for (let k = start; k <= end; k++) sum += hist[k];
      bands.push({ start: start, end: end, sum: sum, width: (end - start + 1) * BIN });
      start = -1;
    }
  }
  const valid = bands.filter(function (bd) { return bd.width >= minWidth; });
  if (!valid.length) return none;

  // 가장 강한 band 하나 (동률이면 왼쪽 것) — Map/Set 순회에 의존하지 않는다
  let best = valid[0];
  for (let i = 1; i < valid.length; i++) {
    if (valid[i].sum > best.sum || (valid[i].sum === best.sum && valid[i].start < best.start)) best = valid[i];
  }
  const warn = valid.length > 1 ? 'multi-gutter' : null;
  const gutterX = (best.start * BIN + (best.end + 1) * BIN) / 2;

  // (d) 검증 — 좌·우 컬럼의 좌변이 각각 정렬되어 있는가
  const leftStarts = [];
  const rightStarts = [];
  for (let i = 0; i < body.length; i++) {
    const runs = body[i].runs || [];
    for (let r = 0; r < runs.length; r++) {
      if (runs[r].x0 < gutterX) leftStarts.push(runs[r].x0);
      else if (runs[r].x0 > gutterX) rightStarts.push(runs[r].x0);
    }
  }
  if (leftStarts.length < P.GUTTER_MIN_STARTS || rightStarts.length < P.GUTTER_MIN_STARTS) return none;
  const madLimit = P.GUTTER_MAD_FACTOR * (Fm > 0 ? Fm : 1);
  if (mad(leftStarts) > madLimit || mad(rightStarts) > madLimit) return none;   // 좌변 미정렬 → 표일 가능성

  return { count: 2, gutters: [gutterX], warn: warn };
}

/* ────────────────────────────────────────────────────────
   컬럼별 줄 재편 (spec 4-5)
   ──────────────────────────────────────────────────────── */

function makeLine(src, runs, col) {
  const items = [];
  for (let i = 0; i < runs.length; i++) {
    for (let k = 0; k < runs[i].items.length; k++) items.push(runs[i].items[k]);
  }
  items.sort(function (p, q) {
    if (p.x !== q.x) return p.x - q.x;
    return p.idx - q.idx;
  });
  // fontSize 는 가장 넓은 아이템 기준(4-3과 같은 규칙)
  let fs = src.fontSize, maxW = -Infinity, maxIdx = Infinity;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.w > maxW || (it.w === maxW && it.idx < maxIdx)) { maxW = it.w; maxIdx = it.idx; fs = it.fontSize; }
  }
  return {
    items: items,
    baseline: src.baseline,
    fontSize: fs,
    col: col,
    role: 'body',
    runs: runs,
    text: '',
    bbox: null,
    hyphenJoin: false,
    paraId: null,
    regionId: null
  };
}

/**
 * spec 4-5 — 2단으로 판정되면 Y로 합쳐진 임시 줄을 run 단위로 컬럼에 배정해
 * 다시 줄을 만든다. 거터를 가로지르는 넓은 run 은 'span'.
 */
export function reassignByColumn(lines, columns, pageInfo, params = LAYOUT) {
  const P = params || LAYOUT;
  const W = Number(pageInfo && pageInfo.width) || 0;
  const src = Array.isArray(lines) ? lines : [];
  if (!columns || columns.count < 2 || !columns.gutters.length) {
    for (let i = 0; i < src.length; i++) src[i].col = 0;
    return src.slice();
  }
  const gx = columns.gutters[0];
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    const left = [], right = [], span = [];
    const runs = line.runs || [];
    for (let r = 0; r < runs.length; r++) {
      const run = runs[r];
      if (W > 0 && (run.x1 - run.x0) > P.SPAN_WIDTH_RATIO * W) { span.push(run); continue; }
      if ((run.x0 + run.x1) / 2 < gx) left.push(run);
      else right.push(run);
    }
    if (left.length) out.push(makeLine(line, left, 0));
    if (right.length) out.push(makeLine(line, right, 1));
    if (span.length) out.push(makeLine(line, span, 'span'));
  }
  return out;
}

/* ────────────────────────────────────────────────────────
   5단계 — 읽기 순서 (spec 4-5)
   ──────────────────────────────────────────────────────── */

function byReadingY(a, b) {
  if (b.baseline !== a.baseline) return b.baseline - a.baseline;   // 위 → 아래
  const ax = lineX0(a), bx = lineX0(b);
  if (ax !== bx) return ax - bx;
  return lineMinIdx(a) - lineMinIdx(b);                            // 명시적 tie-breaker
}

/**
 * spec 4-5 — 컬럼 우선 → 위에서 아래.
 * span 줄(폭 넓은 제목·표)은 밴드 경계가 되어, 그 위쪽 양 컬럼을 모두 읽은 뒤 읽는다.
 */
export function orderLines(lines, columns, pageInfo) {
  const src = Array.isArray(lines) ? lines.slice() : [];
  if (!columns || columns.count < 2) return src.sort(byReadingY);

  const spans = src.filter(function (l) { return l.col === 'span'; }).sort(byReadingY);
  const rest = src.filter(function (l) { return l.col !== 'span'; }).sort(byReadingY);
  const result = [];
  let i = 0;
  for (let s = 0; s < spans.length; s++) {
    const sp = spans[s];
    const band = [];
    while (i < rest.length && rest[i].baseline > sp.baseline) { band.push(rest[i]); i++; }
    pushBand(result, band);
    result.push(sp);
  }
  pushBand(result, rest.slice(i));
  return result;
}

function pushBand(result, band) {
  for (let i = 0; i < band.length; i++) if (band[i].col === 0) result.push(band[i]);
  for (let i = 0; i < band.length; i++) if (band[i].col === 1) result.push(band[i]);
}
