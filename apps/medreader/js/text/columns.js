/* ============================================================
   MedReader — 다단 컬럼 판별과 읽기 순서 (spec 4-5)

   순수 모듈. 전역을 참조하지 않는다.
   ============================================================ */

import { LAYOUT } from '../config.js';
import { median, mad, lineX0, lineMinIdx, isBlankItem } from './lines.js';

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
 * band 가 2개 이상이면 가장 강한 것 하나 + 경고(C0 — 지금 경로).
 *
 * `[8q — spec 4-14-2]` band 가 2개 이상이고 세 구간이 모두 양끝 맞춤 산문(C1–C4)일 때만
 * 3단(`count: 3`, `gutters: [g1, g2]`)이다. **C0 결과를 먼저 계산해 두고** 하나라도 실패하면
 * 그 결과를 그대로 돌려준다 — 3단이 아닌 쪽은 한 바이트도 바뀌지 않는다.
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
      // `[수정 2026-09-27]` **bin 의 중심이 간격 안에 드는가**로 센다.
      //
      // 전에는 간격에 **완전히 포함된** bin 만 셌다(`ceil(g0/BIN)` ~
      // `floor(g1/BIN) - 1`). 그러면 양 끝에서 최대 1 bin 씩, 합쳐 **2 bin 까지**
      // 실제 거터를 깎아 먹는다. bin 이 좁은 쪽(`W/100`)에서는 그 손실이 크다.
      //
      // `[실측 2026-09-27 · CMDT 2026]` 폭 517pt 쪽(BIN 5.17), 거터가 271→289 로
      // **18pt** 인데 옛 방식은 **2 bin = 10.3pt** 로 쟀다(43% 축소).
      // 밴드 최소폭이 `1.2 × Fm = 10.8pt` 라 **0.5pt 차이로 탈락**했고,
      // 표본 197쪽 중 158쪽이 1단으로 판정됐다 — 2단 본문을 좌우 한 줄씩
      // 번갈아 읽게 되는, 4-5 가 막으려던 바로 그 실패다.
      // 중심 기준으로 세면 같은 거터가 **4 bin = 20.7pt** 로 제대로 나온다.
      //
      // 옛 책(612pt 쪽, 거터 15pt)이 통과했던 것은 기하가 우연히 선 위에
      // 있었기 때문이다 — 임계값이 맞았던 게 아니라 **자가 짧았다.**
      const lo = Math.max(0, Math.ceil(g0 / BIN - 0.5));
      const hi = Math.min(BINS - 1, Math.ceil(g1 / BIN - 0.5) - 1);
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
  // C0 — 지금 경로의 결과를 먼저 정해 둔다(8q 가 실패하면 이것을 그대로 돌려준다).
  const madLimit = P.GUTTER_MAD_FACTOR * (Fm > 0 ? Fm : 1);
  let c0;
  if (leftStarts.length < P.GUTTER_MIN_STARTS || rightStarts.length < P.GUTTER_MIN_STARTS) c0 = none;
  else if (mad(leftStarts) > madLimit || mad(rightStarts) > madLimit) c0 = none;   // 좌변 미정렬 → 표일 가능성
  else c0 = { count: 2, gutters: [gutterX], warn: warn };

  // [8q — spec 4-14-2] 3단 판정. C1 의 "유효 band ≥ 2" 가 아니면 묻지 않는다.
  if (!P.COL3_ENABLED || valid.length < 2) return c0;
  const c3 = detectThree(body, valid, W, BIN, Fm, madLimit, P);
  return c3 || c0;
}

/* ────────────────────────────────────────────────────────
   `[8q — spec 4-14-2]` 3단 판정 C1–C4 — 순수. 실패하면 null(호출자가 C0 를 돌려준다).
   책 고유 값이 아니다 — 쪽 폭·본문 글자 크기에 대한 비율과 run 글자 수·모양만 본다.
   ──────────────────────────────────────────────────────── */

/** run 이 몇 번째 구간인가 — 중심 x 이상인 거터 수(0·1·2). 2단의 `c < gx ? 0 : 1` 과 같은 경계. */
function segOf(c, gs) {
  let k = 0;
  while (k < gs.length && c >= gs[k]) k++;
  return k;
}

function detectThree(body, valid, W, BIN, Fm, madLimit, P) {
  // C1 — sum 상위 두 band(동률이면 왼쪽 것), 중심을 왼쪽부터. 둘 사이가 COL3_MIN_SEP·W 이상.
  const top = valid.slice().sort(function (a, b) {
    if (b.sum !== a.sum) return b.sum - a.sum;
    return a.start - b.start;
  });
  const gs = [top[0], top[1]].map(function (bd) {
    return (bd.start * BIN + (bd.end + 1) * BIN) / 2;
  }).sort(function (a, b) { return a - b; });
  if (!(gs[1] - gs[0] >= P.COL3_MIN_SEP * W)) return null;

  // C2 — 세 구간마다 거터를 가로지르지 않는 run 의 줄 수·평균 글자·꽉 찬 비율
  const seg = [0, 1, 2].map(function () { return { lines: 0, chars: 0, ws: [], starts: [] }; });
  for (let i = 0; i < body.length; i++) {
    const runs = body[i].runs || [];
    const hit = [false, false, false];
    for (let r = 0; r < runs.length; r++) {
      const run = runs[r];
      const k = segOf((run.x0 + run.x1) / 2, gs);
      if ((k > 0 && run.x0 < gs[k - 1]) || (k < 2 && run.x1 > gs[k])) continue;   // 거터를 가로지른다
      let n = 0;
      const its = run.items || [];
      for (let t = 0; t < its.length; t++) n += String(its[t].str || '').length;
      const s = seg[k];
      s.chars += n;
      s.ws.push(run.x1 - run.x0);
      s.starts.push(run.x0);
      hit[k] = true;
    }
    for (let k = 0; k < 3; k++) if (hit[k]) seg[k].lines += 1;
  }
  const counts = [];
  for (let k = 0; k < 3; k++) {
    const s = seg[k];
    if (s.lines < P.COL3_MIN_LINES) return null;
    const nRuns = s.ws.length;
    if (!(s.chars / nRuns >= P.COL3_PROSE)) return null;
    // 꽉 찬 run — 그 구간 run 폭 90백분위의 0.85 이상. 양끝 맞춤 산문은 높고 표 칸은 누더기라 낮다.
    const w = s.ws.slice().sort(function (a, b) { return a - b; });
    const ref = w[Math.min(w.length - 1, Math.floor(w.length * P.COL3_FULL_PCT))];
    let full = 0;
    for (let t = 0; t < w.length; t++) if (w[t] >= P.COL3_FULL_WIDTH * ref) full++;
    if (!(full / w.length >= P.COL3_FULL)) return null;
    counts.push(s.lines);
  }

  // C3 — 균형: 세 구간 줄 수의 최소 ≥ COL3_BALANCE × 최대(짧은 캡션 단은 3단이 아니다)
  if (Math.min(counts[0], counts[1], counts[2]) < P.COL3_BALANCE * Math.max(counts[0], counts[1], counts[2])) return null;

  // C4 — 구간마다 run 시작 x 가 정렬돼 있다(4-5 (d) 와 같은 한계)
  for (let k = 0; k < 3; k++) {
    const st = seg[k].starts;
    if (st.length < P.GUTTER_MIN_STARTS) return null;
    if (mad(st) > madLimit) return null;
  }

  return { count: 3, gutters: gs, warn: valid.length > 2 ? 'multi-gutter' : null };
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
  if (columns.count === 3 && columns.gutters.length >= 2) return reassignThree(src, columns.gutters, W, P);
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

/**
 * `[8q — spec 4-14-2]` 3단 — 열 = run 중심 왼쪽(이하)의 거터 수(0·1·2). 'span' = 2단 규칙(폭 > SPAN_WIDTH_RATIO·W)
 * **또는** 거터를 양쪽으로 Fm 넘게 가로지르는 run(두 단에 걸친 소제목·상자). count 2 경로는 위 그대로다.
 *
 * `[정정 2026-11-17 — 8q Build]` span 줄에 덮는 단을 단다(내부 값 `_cov` — 출력·저장에 들어가지 않는다):
 * 'all' = 폭 규칙이거나 두 거터를 다 가로지름 · '01' = 첫 거터만(단 0–1) · '12' = 둘째 거터만(단 1–2).
 * 읽기 순서(orderThree)가 두 단짜리 span 으로 나머지 한 단까지 자르지 않게 하려는 것이다.
 */
const isBlank = isBlankItem;

function runOf(items) {
  let x0 = Infinity, x1 = -Infinity;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (isBlank(it)) continue;
    if (it.x < x0) x0 = it.x;
    if (it.x + it.w > x1) x1 = it.x + it.w;
  }
  if (x0 === Infinity) { x0 = items[0].x; x1 = items[0].x; }
  return { items: items, x0: x0, x1: x1, _solid: true };
}

/**
 * `[정정 2026-11-17 — 8q Build]` 3단 쪽에서만 — 거터 x 를 덮는 글자 아이템이 없고 그 자리 틈이 COL3_SPLIT_GAP·Fm 이상이면
 * run 을 거터에서 가른다. 4-4 run 분할 임계(1.2 × **그 줄** 글자 크기)는 큰 글씨 인용구 줄에서 거터(약 1.2·Fm)를
 * 못 넘어 인용구·옆 단·셋째 단 글이 한 run 이 되고, 그 run 이 두 거터를 다 가로질러 쪽을 밴드로 잘랐다
 * (SciAm 1999-01 93쪽). 실측 3단 쪽 거터 가로지름 819 중 793 은 아이템이 거터를 덮는다(진짜 걸친 글) — 틈은 26,
 * 그중 붙은 run 의 틈은 1.13–1.33·Fm, 진짜 걸친 줄의 낱말 사이 틈 0.17·Fm. 폭 > SPAN_WIDTH_RATIO·W run 은 그대로.
 */
function splitAtGutters(run, gs, Fm, P) {
  const items = run.items || [];
  for (let g = 0; g < gs.length; g++) {
    const X = gs[g];
    if (!(run.x0 < X && run.x1 > X)) continue;
    let covered = false, L = -Infinity, R = Infinity;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (isBlank(it)) continue;
      if (it.x < X && it.x + it.w > X) { covered = true; break; }
      if (it.x + it.w <= X) { if (it.x + it.w > L) L = it.x + it.w; } else if (it.x < R) R = it.x;
    }
    if (covered || !(R - L >= P.COL3_SPLIT_GAP * Fm)) continue;
    const left = [], right = [];
    for (let i = 0; i < items.length; i++) (items[i].x < X ? left : right).push(items[i]);
    if (!left.length || !right.length) continue;
    return splitAtGutters(runOf(left), gs, Fm, P).concat(splitAtGutters(runOf(right), gs, Fm, P));
  }
  return [run];
}

function reassignThree(src, gutters, W, P) {
  const gs = gutters.slice().sort(function (a, b) { return a - b; });
  const sizes = [];
  for (let i = 0; i < src.length; i++) sizes.push(src[i].fontSize);
  const m = median(sizes);
  const Fm = m > 0 ? m : 1;
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    const cols = [[], [], []], span = [];
    let c01 = false, c12 = false;
    const runs = [];
    const raw = line.runs || [];
    for (let r = 0; r < raw.length; r++) {
      const isWide = W > 0 && (raw[r].x1 - raw[r].x0) > P.SPAN_WIDTH_RATIO * W;
      const parts = isWide ? [raw[r]] : splitAtGutters(raw[r], gs, Fm, P);
      for (let t = 0; t < parts.length; t++) runs.push(parts[t]);
    }
    for (let r = 0; r < runs.length; r++) {
      const run = runs[r];
      if (W > 0 && (run.x1 - run.x0) > P.SPAN_WIDTH_RATIO * W) { span.push(run); c01 = true; c12 = true; continue; }
      // 가로지르는 run 은 단 하나 폭의 COL3_SPAN_MIN 이상일 때만 span — 거터 위의 짧은 그림 라벨(SciAm 1999-01
      // 21쪽 — 단 폭의 0.27)이 단을 위·아래로 가르지 않게. 좁은 것은 중심으로 단에 든다.
      const wide = (run.x1 - run.x0) >= P.COL3_SPAN_MIN * (gs[1] - gs[0]);
      const x01 = wide && run.x0 < gs[0] - Fm && run.x1 > gs[0] + Fm;
      const x12 = wide && run.x0 < gs[1] - Fm && run.x1 > gs[1] + Fm;
      if (x01 || x12) { span.push(run); if (x01) c01 = true; if (x12) c12 = true; continue; }
      cols[segOf((run.x0 + run.x1) / 2, gs)].push(run);
    }
    for (let k = 0; k < 3; k++) if (cols[k].length) out.push(makeLine(line, cols[k], k));
    if (span.length) {
      const sl = makeLine(line, span, 'span');
      sl._cov = c01 && c12 ? 'all' : (c01 ? '01' : '12');
      out.push(sl);
    }
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
 * `[8q]` 3단이면 밴드 안에서 col 0 → 1 → 2.
 */
export function orderLines(lines, columns, pageInfo, params = LAYOUT) {
  const src = Array.isArray(lines) ? lines.slice() : [];
  if (!columns || columns.count < 2) return src.sort(byReadingY);
  if (columns.count === 3) return orderThree(src, Number(pageInfo && pageInfo.height) || 0, params || LAYOUT);

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

// [8q] col 0 → 1 → 2. 2단 쪽에는 col 2 줄이 없으므로 결과가 그대로다.
function pushBand(result, band) {
  for (let i = 0; i < band.length; i++) if (band[i].col === 0) result.push(band[i]);
  for (let i = 0; i < band.length; i++) if (band[i].col === 1) result.push(band[i]);
  for (let i = 0; i < band.length; i++) if (band[i].col === 2) result.push(band[i]);
}

/* ────────────────────────────────────────────────────────
   `[8q — spec 4-14-2 · 정정 2026-11-17 — 8q Build]` 3단 읽기 순서.

   세 단을 다 덮는 span('all')은 2단과 똑같이 쪽을 밴드로 자른다. 두 단만 덮는 span('01'·'12' — 두 단 폭 상자·
   캡션·소제목)은 **그 두 단만** 하위 밴드로 자르고 나머지 한 단은 통째로 읽는다. 설계 원안("span 은 모두 밴드
   경계")대로면 쪽 아래 두 단 폭 상자의 줄마다 옆 단 줄이 한 줄씩 끼어 읽혔다(SciAm 1999-01 88쪽) — 실측 3단
   115쪽 중 92쪽에 두 단 span 652줄. (거터 위 짧은 그림 라벨은 reassignThree 의 COL3_SPAN_MIN 이 span 에서 뺀다.)
     · 위아래로 이어진 span 줄은 한 덩어리(spanBlocks) — 덮는 단을 합친다.
     · 본문 흐름 가운데 끼운 덩어리(인용구·요약·캡션 — findInsets: 덮는 단의 글이 덩어리를 건너거나 감싸 흐름)는
       경계가 아니다 — 밴드 세 단 뒤에. 판형 신호만(꽉 찬 본문 줄 · 옆으로 비켜 선 줄) — `[8q-b]` 문장 부호 신호를 뺐다.
     · '12'(단 1–2): 단 0 전부 → 단 1·2 하위 밴드(단 1 → 단 2 → span) 차례로.
     · '01'(단 0–1): 단 0·1 하위 밴드 차례로, 단 2 전부는 아래 orderBand3 의 자리(k)에.
     · 한 밴드에 '01'·'12' 가 섞이면 그 밴드의 두 단 덩어리는 자르지 않고 끼움처럼 세 단 뒤에(orderThree).
       `[8q-b]` 앞 판의 "줄 수 적은 쪽을 경계로" 를 뺐다.
   ──────────────────────────────────────────────────────── */

const COV_COLS = { '01': [0, 1], '12': [1, 2], all: [0, 1, 2] };

/**
 * span 덩어리 — 위아래로 이어진 span 줄(그 사이에 두 줄이 덮는 단의 본문 줄이 없다)은 한 덩어리이고 덮는 단을 합친다.
 * 세 줄짜리 인용구가 'all' · '01' · '12' 로 갈려도(SciAm 2004-11 44쪽) 한 덩어리 'all' 이 되고, 두 단 폭 상자의
 * 줄들(옆 단 줄이 사이사이 있다)은 한 덩어리 '01' 로 남는다. 반환: 줄 → 덩어리의 덮는 단.
 */
function spanBlocks(spans, rest, Fm) {
  const kindOf = new Map();
  const blockOf = new Map();
  let block = [], cols = new Set(), id = 0;
  function flush() {
    const k = cols.has(0) && cols.has(2) ? 'all' : (cols.has(0) ? '01' : '12');
    for (let i = 0; i < block.length; i++) { kindOf.set(block[i], k); blockOf.set(block[i], id); }
    block = []; cols = new Set(); id++;
  }
  for (let s = 0; s < spans.length; s++) {
    const sp = spans[s];
    const mine = COV_COLS[sp._cov] || COV_COLS.all;
    if (block.length) {
      const prev = block[block.length - 1];
      const u = new Set(cols);
      for (let i = 0; i < mine.length; i++) u.add(mine[i]);
      // 사이의 본문 줄 — 단, 상자 제 줄(좌변이 위·아래 span 좌변과 Fm 안, 두 줄까지)은 덩어리를 끊지 않는다
      // (거터를 못 넘는 상자 안 짧은 끝줄 — SciAm 2004-11 44쪽).
      let between = 0, inset = 0;
      for (let i = 0; i < rest.length; i++) {
        const l = rest[i];
        // 아래 span 과 같은 baseline 의 줄도 센다 — 그 옆 단 글이 있으면 위 덩어리의 이어짐이 아니다(1999-01 89쪽)
        if (!(l.baseline < prev.baseline && l.baseline >= sp.baseline && u.has(l.col))) continue;
        const x = lineX0(l);
        if (Math.abs(x - lineX0(prev)) <= Fm || Math.abs(x - lineX0(sp)) <= Fm) inset++;
        else between++;
      }
      if (between || inset > 2) flush();
    }
    block.push(sp);
    for (let i = 0; i < mine.length; i++) cols.add(mine[i]);
  }
  if (block.length) flush();
  return { kindOf: kindOf, blockOf: blockOf };
}

/** 정렬된 줄을 정렬된 경계 줄로 자른다 — 결과[j] 는 경계 j 위쪽(baseline 이 더 큰) 줄. 길이 = 경계 수 + 1. */
function cutBy(lines, cuts) {
  const out = [];
  let i = 0;
  for (let s = 0; s < cuts.length; s++) {
    const band = [];
    while (i < lines.length && lines[i].baseline > cuts[s].baseline) { band.push(lines[i]); i++; }
    out.push(band);
  }
  out.push(lines.slice(i));
  return out;
}

/** 줄 폭 — run 의 x 범위(bbox 계산 전이라 run 값을 쓴다). */
function lineWidth(l) {
  const runs = l.runs || [];
  let x0 = Infinity, x1 = -Infinity;
  for (let i = 0; i < runs.length; i++) {
    if (runs[i].x0 < x0) x0 = runs[i].x0;
    if (runs[i].x1 > x1) x1 = runs[i].x1;
  }
  return x1 > x0 ? x1 - x0 : 0;
}

/** 줄의 x 범위·세로 글자 상자(아이템 ascent·descent — lineBBox 와 같은 값, 클립 없음). */
function lineBox(l) {
  const runs = l.runs || [], items = l.items || [];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < runs.length; i++) {
    if (runs[i].x0 < x0) x0 = runs[i].x0;
    if (runs[i].x1 > x1) x1 = runs[i].x1;
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const t = it.y + (Number(it.ascent) || 0) * it.fontSize, b = it.y + (Number(it.descent) || 0) * it.fontSize;
    if (t > y1) y1 = t;
    if (b < y0) y0 = b;
  }
  if (!(y1 > y0)) { y0 = l.baseline; y1 = l.baseline + l.fontSize; }
  return { x0: x0, x1: x1, y0: y0, y1: y1 };
}

/** 줄 a 가 줄 b 의 옆에 있다 — 세로 글자 상자가 겹치고(한쪽이 다른 쪽 위에 있지 않다) x 범위는 겹치지 않는다(글이 b 를 둘러 흐름). */
function besideOf(a, b) {
  const p = lineBox(a), q = lineBox(b);
  if (!(Math.min(p.y1, q.y1) > Math.max(p.y0, q.y0))) return false;
  return p.x1 <= q.x0 || p.x0 >= q.x1;
}

/**
 * 끼움 덩어리 — 본문 흐름 **가운데** 놓인 인용구·요약·캡션·상자. 덩어리가 덮는 단 **어느 하나에서** 바로 위 줄이 꽉 찬
 * 본문 줄(문단 중간 — 본문 글자 크기이고 폭 ≥ COL3_FULL_WIDTH × 그 단 줄 폭 기준값, C2 의 "꽉 찬 run" 과 같은 정의)이고
 * 같은 단에서 덩어리 아래로 본문이 이어지면, 그 단의 글이 덩어리를 건너 흐른다는 뜻이다 — 밴드를 자르지 않고 그 밴드의
 * 세 단을 다 읽은 뒤에 읽는다. 덮는 단마다 위 줄이 짧은 줄(문단 끝)·머리글·없음이면 소제목·제목 — 원안대로 경계다.
 * 판형 신호만 본다(문장 부호·낱말·언어 무관). `[8q-b 2026-11-17]` 앞 판은 덮는 첫 단만, 위 줄의 문장 끝 부호로 판정해
 * 머리글("난 이름") 아래 제목·새 기사 제목을 끼움으로 오판했다(8q Review 8qR-3).
 */
function findInsets(spans, rest, blocks, H, P, Fm) {
  const inBody = function (l) {
    return !(H > 0) || (l.baseline <= H * (1 - P.HEADER_ZONE) && l.baseline >= H * P.FOOTER_ZONE);
  };
  const bodyFont = function (l) {
    return l.fontSize >= P.BODY_FONT_LO * Fm && l.fontSize <= P.BODY_FONT_HI * Fm;
  };
  // 단마다 줄 폭 기준값 — 본문 띠·본문 글자 크기 줄 폭의 COL3_FULL_PCT 백분위(C2 와 같은 기준)
  const ref = [0, 1, 2].map(function (c) {
    const w = [];
    for (let i = 0; i < rest.length; i++) if (rest[i].col === c && inBody(rest[i]) && bodyFont(rest[i])) w.push(lineWidth(rest[i]));
    w.sort(function (a, b) { return a - b; });
    return w.length ? w[Math.min(w.length - 1, Math.floor(w.length * P.COL3_FULL_PCT))] : 0;
  });
  const fullBody = function (l) {
    return bodyFont(l) && ref[l.col] > 0 && lineWidth(l) >= P.COL3_FULL_WIDTH * ref[l.col];
  };
  const byBlock = new Map();
  for (let i = 0; i < spans.length; i++) {
    const id = blocks.blockOf.get(spans[i]);
    if (!byBlock.has(id)) byBlock.set(id, []);
    byBlock.get(id).push(spans[i]);
  }
  const out = new Set();
  byBlock.forEach(function (ls) {
    const top = ls[0], bottom = ls[ls.length - 1];
    const cov = COV_COLS[blocks.kindOf.get(top)] || COV_COLS.all;
    const a = cov[0];
    const above = [null, null, null], below = [false, false, false];
    let beside = false;
    for (let i = 0; i < rest.length; i++) {
      const l = rest[i];
      if (cov.indexOf(l.col) < 0 || !inBody(l)) continue;
      const c = l.col;
      if (l.baseline > top.baseline && (!above[c] || l.baseline < above[c].baseline)) above[c] = l;
      if (l.baseline < bottom.baseline) below[c] = true;
      // 덩어리 옆(같은 높이 안)에 덮는 첫 단 본문 줄이 있으면 글이 덩어리를 둘러 흐른다 — 끼움(SciAm 2000-03 86쪽 인용구 첫 줄).
      // 좌변이 덩어리 줄 좌변과 Fm 안인 줄은 덩어리 제 줄이다(spanBlocks 와 같은 예외 — 2004-11 86쪽 제목 사이 줄).
      if (c !== a) continue;
      const x = lineX0(l);
      let own = false;
      for (let s = 0; s < ls.length; s++) if (Math.abs(x - lineX0(ls[s])) <= Fm) own = true;
      if (own) continue;
      if (l.baseline <= top.baseline && l.baseline >= bottom.baseline) beside = true;
      // `[8q-b]` 덩어리 줄과 같은 높이(글자 상자가 겹침)에서 옆으로 비켜 선 줄 — 글이 인용구를 감싸 돈다. 한 줄짜리
      // 덩어리는 위 baseline 범위가 한 점이라 이것으로 본다.
      for (let s = 0; s < ls.length && !beside; s++) if (besideOf(l, ls[s])) beside = true;
    }
    let flows = false;
    for (let t = 0; t < cov.length; t++) {
      const c = cov[t];
      if (above[c] && below[c] && fullBody(above[c])) flows = true;
    }
    if (beside || flows) for (let i = 0; i < ls.length; i++) out.add(ls[i]);
  });
  return out;
}

function topTitles(spans, rest, blocks, H, P) {
  const inBody = function (l) {
    return !(H > 0) || (l.baseline <= H * (1 - P.HEADER_ZONE) && l.baseline >= H * P.FOOTER_ZONE);
  };
  const byBlock = new Map();
  for (let i = 0; i < spans.length; i++) {
    const k = blocks.kindOf.get(spans[i]);
    if (k !== '01' && k !== '12') continue;
    const id = blocks.blockOf.get(spans[i]);
    if (!byBlock.has(id)) byBlock.set(id, []);
    byBlock.get(id).push(spans[i]);
  }
  byBlock.forEach(function (ls) {
    const bottom = ls[ls.length - 1];
    for (let i = 0; i < rest.length; i++) if (inBody(rest[i]) && rest[i].baseline >= bottom.baseline) return;
    for (let i = 0; i < ls.length; i++) blocks.kindOf.set(ls[i], 'all');
  });
}

function orderThree(src, H, P) {
  const rest = src.filter(function (l) { return l.col !== 'span'; }).sort(byReadingY);
  const all = src.filter(function (l) { return l.col === 'span'; }).sort(byReadingY);
  const sizes = [];
  for (let i = 0; i < src.length; i++) sizes.push(src[i].fontSize);
  const m = median(sizes);
  const Fm = m > 0 ? m : 1;
  const blocks = spanBlocks(all, rest, Fm);
  const kindOf = blocks.kindOf;
  const insetSet = findInsets(all, rest, blocks, H, P, Fm);
  const insets = all.filter(function (l) { return insetSet.has(l); });
  const spans = all.filter(function (l) { return !insetSet.has(l); });
  // 두 단 덩어리인데 옆·위에 본문 줄이 하나도 없으면(본문이 전부 그 아래) 쪽 머리 제목이다 — 세 단 경계('all')와 같다.
  // 두 단 폭 쪽 제목 아래 단 1–2 소제목이 같은 밴드에서 "섞임"으로 묶이는 것을 막는다(합성 3단 쪽 — 8q headless).
  topTitles(spans, rest, blocks, H, P);
  const isPartial = function (l) { const k = kindOf.get(l); return k === '01' || k === '12'; };
  const full = spans.filter(function (l) { return !isPartial(l); });
  const part = spans.filter(isPartial);
  const gb = cutBy(rest, full);
  const gp = cutBy(part, full);
  const gi = cutBy(insets, full);
  const result = [];
  for (let j = 0; j < gb.length; j++) {
    // 한 밴드에 '01'·'12' 두 단 덩어리가 섞이면 가운데 단 1 을 두 덩어리가 서로 다르게 자르게 되어 한 가지 하위 밴드
    // 자르기가 없다 — 그 밴드의 두 단 덩어리는 자르지 않고 끼움처럼 세 단 뒤에 읽는다(단 순서·줄 끼임이 생기지 않는 쪽).
    // `[8q-b 2026-11-17]` 앞 판은 줄 수가 적은 쪽을 경계로 바꿔 아래 덩어리 줄과 옆 단 줄이 번갈아 읽혔다(8qR-3).
    let mixed = false;
    for (let i = 1; i < gp[j].length; i++) if (kindOf.get(gp[j][i]) !== kindOf.get(gp[j][0])) mixed = true;
    const tail = mixed ? gi[j].concat(gp[j]).sort(byReadingY) : gi[j];
    orderBand3(result, gb[j], mixed ? [] : gp[j], blocks, H, P);
    for (let i = 0; i < tail.length; i++) result.push(tail[i]);   // 끼움 덩어리 — 그 밴드 세 단 뒤
    if (j < full.length) result.push(full[j]);
  }
  return result;
}

function orderBand3(result, lines, parts, blocks, H, P) {
  const kindOf = blocks.kindOf;
  if (!parts.length) { pushBand(result, lines); return; }
  const kind = kindOf.get(parts[0]);                       // 섞임은 orderThree 가 미리 끼움으로 뺐다 — 한 가지
  const out = kind === '12' ? 0 : 2;                       // 두 단 span 밖의 단
  const outside = lines.filter(function (l) { return l.col === out; });
  const group = lines.filter(function (l) { return l.col !== out; });
  const sb = cutBy(group, parts);
  // '01' 일 때 단 2 를 끼울 자리 k: 단 0·1 본문이 있는 **마지막** 하위 밴드 뒤. 그래서 쪽 아래 상자는 세 단을 다 읽은
  // 뒤에, 위의 제목·상자는 그 아래 단 0·1 을 다 읽은 뒤 단 2 로 간다. 세지 않는 줄: 쪽 위·아래 띠(HEADER_ZONE·
  // FOOTER_ZONE — bodyCandidates 와 같은 띠)의 쪽 번호·잡지 이름 줄, 한 span 덩어리 안에 낀 줄(상자 안 짧은 끝줄)
  // (SciAm 2004-11 44쪽 · 1999-01 5쪽).
  const inBody = function (l) {
    return !(H > 0) || (l.baseline <= H * (1 - P.HEADER_ZONE) && l.baseline >= H * P.FOOTER_ZONE);
  };
  let k = 0;
  for (let j = sb.length - 1; j > 0; j--) {
    const inside = j < parts.length && blocks.blockOf.get(parts[j - 1]) === blocks.blockOf.get(parts[j]);
    if (!inside && sb[j].some(inBody)) { k = j; break; }
  }
  if (out === 0) for (let i = 0; i < outside.length; i++) result.push(outside[i]);
  for (let j = 0; j < sb.length; j++) {
    pushBand(result, sb[j]);
    if (out === 2 && j === k) for (let i = 0; i < outside.length; i++) result.push(outside[i]);
    if (j < parts.length) result.push(parts[j]);
  }
}
