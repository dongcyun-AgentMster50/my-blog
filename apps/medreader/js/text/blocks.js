/* ============================================================
   MedReader — 역할 판정·표 감지·문단 그룹핑 (spec 4-7, 4-8, 4-9)

   순수 모듈. 전역을 참조하지 않는다.
   ============================================================ */

import { LAYOUT } from '../config.js';
import { median } from './lines.js';
import { joinParagraphText } from './hyphen.js';
import { isQuestionStart, isOptionStart, isAnswerStart, endsSentence } from './segment.js';

/* ────────────────────────────────────────────────────────
   공통 계산
   ──────────────────────────────────────────────────────── */

// spec 4-7 — 러닝 헤드 비교용 정규화: 숫자를 #으로 치환
export function normalizeRepeatKey(text) {
  return String(text == null ? '' : text)
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function upperRatio(text) {
  const letters = String(text).match(/[A-Za-z]/g);
  if (!letters || !letters.length) return 0;
  let up = 0;
  for (let i = 0; i < letters.length; i++) if (letters[i] >= 'A' && letters[i] <= 'Z') up++;
  return up / letters.length;
}

function inTopZone(line, H, ratio) { return H > 0 && line.baseline > H * (1 - ratio); }
function inBottomZone(line, H, ratio) { return H > 0 && line.baseline < H * ratio; }

// 흐름(문단·표)에 들어가는 줄인가
function isFlowRole(role) {
  return role === 'body' || role === 'heading' || role === 'figure-caption';
}

/**
 * spec 4-7 — 본문 폰트 중앙값 Fm 과 본문 행간 중앙값 Lm.
 * Lm 이 계산 불가능하면 1.2 x Fm (spec 4-9).
 */
export function pageMetrics(lines, pageInfo, params = LAYOUT) {
  const P = params || LAYOUT;
  const H = Number(pageInfo && pageInfo.height) || 0;
  const inner = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (inTopZone(l, H, P.HEADER_ZONE) || inBottomZone(l, H, P.FOOTER_ZONE)) continue;
    inner.push(l);
  }
  const pool = inner.length ? inner : lines;
  const sizes = [];
  for (let i = 0; i < pool.length; i++) sizes.push(pool[i].fontSize);
  const Fm = median(sizes) || P.FALLBACK_FONT_SIZE;

  // 같은 컬럼에서 이웃한 줄의 baseline 차
  const diffs = [];
  for (let i = 1; i < pool.length; i++) {
    if (pool[i].col !== pool[i - 1].col) continue;
    const d = pool[i - 1].baseline - pool[i].baseline;
    if (d > 0 && d <= 5 * Fm) diffs.push(d);
  }
  const Lm = median(diffs) || P.LEADING_FALLBACK_FACTOR * Fm;
  return { medianFontSize: Fm, medianLeading: Lm };
}

/**
 * 컬럼별 좌변(최빈 x0)과 폭 — spec 4-9 의 ctx.colLeft / colWidth.
 */
export function columnMetrics(lines, params = LAYOUT) {
  const groups = [];
  const index = new Map();
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!isFlowRole(l.role) || !l.bbox) continue;
    const key = String(l.col);
    if (!index.has(key)) { index.set(key, groups.length); groups.push({ col: l.col, x0: [], x1: [] }); }
    const g = groups[index.get(key)];
    g.x0.push(l.bbox.x0);
    g.x1.push(l.bbox.x1);
  }
  const out = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    out.push({ col: g.col, left: modeOf(g.x0), width: Math.max.apply(null, g.x1) - modeOf(g.x0) });
  }
  // 출력 순서를 컬럼 번호로 고정한다(결정성)
  out.sort(function (a, b) {
    const ak = typeof a.col === 'number' ? a.col : 1e6;
    const bk = typeof b.col === 'number' ? b.col : 1e6;
    return ak - bk;
  });
  return out;
}

// 1pt 격자로 반올림한 최빈값. 동률이면 작은 값(결정성).
function modeOf(values) {
  if (!values.length) return 0;
  const counts = new Map();
  for (let i = 0; i < values.length; i++) {
    const k = Math.round(values[i]);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const keys = Array.from(counts.keys()).sort(function (a, b) { return a - b; });
  let best = keys[0], bestN = counts.get(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    const n = counts.get(keys[i]);
    if (n > bestN) { best = keys[i]; bestN = n; }
  }
  return best;
}

/* ────────────────────────────────────────────────────────
   7단계 — 역할 판정 (spec 4-7)
   ──────────────────────────────────────────────────────── */

/**
 * spec 4-7 — header / footer / pageno / heading / figure-caption / body.
 * 줄은 읽기 순서로 들어온다고 가정한다. line.role 을 갱신하고 통계를 돌려준다.
 *
 * @param {Array} neighborLayouts 앞뒤 페이지의 PageLayout (이미 추출된 것만)
 */
export function classifyRoles(lines, pageInfo, params = LAYOUT, neighborLayouts = []) {
  const P = params || LAYOUT;
  const H = Number(pageInfo && pageInfo.height) || 0;
  const stats = pageMetrics(lines, pageInfo, P);
  const Fm = stats.medianFontSize;
  const Lm = stats.medianLeading;

  // 이웃 페이지의 머리말·꼬리말 후보 텍스트 집합 (숫자 치환 정규화)
  const neighborKeys = new Set();
  const nbs = Array.isArray(neighborLayouts) ? neighborLayouts : [];
  for (let i = 0; i < nbs.length; i++) {
    const nl = nbs[i] || {};
    const nlines = Array.isArray(nl.lines) ? nl.lines : [];
    const nh = Number(nl.height) || H;
    for (let k = 0; k < nlines.length; k++) {
      const l = nlines[k];
      const top = nh > 0 && l.baseline > nh * (1 - P.HEADER_ZONE);
      const bottom = nh > 0 && l.baseline < nh * P.FOOTER_ZONE;
      if (l.role === 'header' || l.role === 'footer' || top || bottom) {
        neighborKeys.add(normalizeRepeatKey(l.text));
      }
    }
  }

  // 위쪽 여백의 기준은 "같은 컬럼의 직전 본문 흐름 줄"이다.
  // [보강] 머리말·꼬리말·페이지 번호를 기준으로 삼으면 컬럼 첫 본문 줄의
  // 여백이 항상 Lm을 크게 넘어 본문이 heading 으로 오판된다(spec 4-11 P4 위험).
  // 기준 줄이 아예 없으면 짧은 줄 규칙을 적용하지 않고 폰트 크기 규칙만 본다.
  const lastFlowByCol = new Map();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text || '';
    const key = String(line.col);
    const prev = lastFlowByCol.get(key) || null;
    const gapAbove = prev ? (prev.baseline - line.baseline) : -1;
    const next = i + 1 < lines.length ? lines[i + 1] : null;

    // pageno — 상·하단 10% + 숫자만
    if ((inTopZone(line, H, P.PAGENO_ZONE) || inBottomZone(line, H, P.PAGENO_ZONE)) &&
        (/^\s*\d{1,4}\s*$/.test(text) || /^(page\s*)?\d{1,4}$/i.test(text.trim()))) {
      line.role = 'pageno';
      continue;
    }

    const repeats = neighborKeys.has(normalizeRepeatKey(text));

    // header — 상단 8%
    if (inTopZone(line, H, P.HEADER_ZONE) && text.length <= P.HEADER_MAX_LEN &&
        line.fontSize <= P.HEADER_FONT_RATIO * Fm &&
        (repeats || upperRatio(text) >= P.HEADER_UPPER_RATIO || /^(SECTION|CHAPTER|PART)\b/i.test(text))) {
      line.role = 'header';
      continue;
    }

    // footer — 하단 8%
    if (inBottomZone(line, H, P.FOOTER_ZONE) && text.length <= P.FOOTER_MAX_LEN &&
        (repeats || /^(©|copyright|harrison|mcgraw)/i.test(text) ||
         line.fontSize <= P.FOOTER_FONT_RATIO * Fm)) {
      line.role = 'footer';
      continue;
    }

    // figure-caption — 표 영역 힌트로도 쓰인다
    if (/^(FIGURE|FIG\.|TABLE)\s*\d/i.test(text)) {
      line.role = 'figure-caption';
      lastFlowByCol.set(key, line);
      continue;
    }

    // heading
    const bigger = line.fontSize >= P.HEADING_SIZE_RATIO * Fm;
    /* spec 4-7 [수정 2026-09-18] — 짧은 줄 규칙의 문항·보기·정답 가드.
     * 이 경로는 "짧다 + 종결 부호 없다 + 위 여백이 크다"는 약한 신호 셋으로만
     * 제목을 판정한다. [실측] 문항 stem 첫 줄 "I-42. An 18-year-old boy presents to"
     * 와 보기 "A. Primary" 가 정확히 그 모양이라 heading 으로 새고, 이어서 4-9 의
     * newParagraph 가 prev.role === 'heading' 으로 다음 줄을 떼어내 stem 이 두
     * 문단으로 쪼개졌다(question 문단 1,393개 중 1,012개가 줄 1개, 그중 953개가
     * 첫 줄 role heading — 4-11 P7 실패 1,191건 중 977건).
     * 명시적 번호·글머리 패턴은 약한 신호를 이긴다(4-9 kind 우선순위와 같은 원칙).
     * 정규식은 segment.js 의 것을 그대로 쓴다 — 여기에 복제하지 않는다.
     * bigger 경로는 건드리지 않는다: 진짜 큰 제목은 계속 heading 이다. */
    const numbered = isQuestionStart(text) || isOptionStart(text) || isAnswerStart(text);
    const shortNoStop = !numbered &&
      text.length > 0 && text.length <= P.HEADING_MAX_LEN &&
      !/[.!?…]["”')\]]*$/.test(text) &&
      gapAbove >= P.HEADING_GAP_FACTOR * Lm &&
      !!next && next.fontSize <= P.HEADING_SIZE_RATIO * Fm &&
      !inTopZone(next, H, P.HEADER_ZONE) && !inBottomZone(next, H, P.FOOTER_ZONE);
    if (bigger || shortNoStop) {
      line.role = 'heading';
      lastFlowByCol.set(key, line);
      continue;
    }

    line.role = 'body';
    lastFlowByCol.set(key, line);
  }
  return stats;
}

/* ────────────────────────────────────────────────────────
   8단계 — 표 영역 감지 (spec 4-8)
   ──────────────────────────────────────────────────────── */

// 열 정렬 검사: run 시작 x 를 클러스터링해 block 줄의 60% 이상에 등장하는 클러스터 수
function alignedColumns(block, tol, ratio) {
  const pts = [];
  for (let i = 0; i < block.length; i++) {
    const runs = block[i].runs || [];
    for (let r = 0; r < runs.length; r++) pts.push({ x: runs[r].x0, line: i });
  }
  pts.sort(function (a, b) { return (a.x - b.x) || (a.line - b.line); });
  const clusters = [];
  let cur = null;
  for (let i = 0; i < pts.length; i++) {
    if (!cur || pts[i].x - cur.last > tol) {
      cur = { last: pts[i].x, lines: new Set([pts[i].line]) };
      clusters.push(cur);
    } else {
      cur.last = pts[i].x;
      cur.lines.add(pts[i].line);
    }
  }
  let n = 0;
  for (let i = 0; i < clusters.length; i++) {
    if (clusters[i].lines.size >= ratio * block.length) n++;
  }
  return n;
}

// spec 4-8 가점 신호 — 숫자·단위가 많은가
function hasUnitTokens(block) {
  let hit = 0;
  for (let i = 0; i < block.length; i++) {
    if (/(\b\d+(\.\d+)?\b.*\b(mg|mcg|µg|g|kg|mL|L|PO|IV|IM|SC|%)\b)|(\bq\d+h\b)/i.test(block[i].text || '')) hit++;
  }
  return hit >= Math.ceil(block.length / 2);
}

/**
 * spec 4-8 — 컬럼별로 표 영역을 찾는다.
 * 감지된 줄의 role 을 'table' 로 바꾸고 Region 배열을 돌려준다.
 */
export function detectTables(lines, pageInfo, params = LAYOUT, stats = null) {
  const P = params || LAYOUT;
  const pageNo = (pageInfo && pageInfo.pageNo) != null ? pageInfo.pageNo : 0;
  const m = stats || pageMetrics(lines, pageInfo, P);
  const Fm = m.medianFontSize;
  const Lm = m.medianLeading;
  const regions = [];

  // 컬럼별 줄 묶음 (읽기 순서 유지)
  const groups = [];
  const index = new Map();
  for (let i = 0; i < lines.length; i++) {
    const key = String(lines[i].col);
    if (!index.has(key)) { index.set(key, groups.length); groups.push([]); }
    groups[index.get(key)].push(lines[i]);
  }

  for (let g = 0; g < groups.length; g++) {
    const colLines = groups[g];
    // 후보: run 2개 이상인 본문 줄
    const blocks = [];
    let cur = null;
    let prevCand = null;
    for (let i = 0; i < colLines.length; i++) {
      const l = colLines[i];
      const isCand = l.role === 'body' && (l.runs || []).length >= 2;
      if (!isCand) { cur = null; prevCand = null; continue; }
      if (cur && prevCand && (prevCand.baseline - l.baseline) <= P.TABLE_LEADING_FACTOR * Lm) {
        cur.push(l);
      } else {
        cur = [l];
        blocks.push(cur);
      }
      prevCand = l;
    }

    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b];
      if (block.length < P.TABLE_MIN_LINES_RELAXED) continue;

      // 가점 신호
      const caption = findCaption(colLines, block, Lm, P);
      let signals = 0;
      if (caption) signals++;
      let small = 0;
      for (let i = 0; i < block.length; i++) {
        if (block[i].fontSize >= P.TABLE_FONT_LO * Fm && block[i].fontSize <= P.TABLE_FONT_HI * Fm) small++;
      }
      if (small >= Math.ceil(block.length / 2)) signals++;
      if (hasUnitTokens(block)) signals++;

      const minLines = signals >= P.TABLE_SIGNAL_MIN ? P.TABLE_MIN_LINES_RELAXED : P.TABLE_MIN_LINES;
      if (block.length < minLines) continue;
      if (alignedColumns(block, P.TABLE_COL_TOL_FACTOR * Fm, P.TABLE_ALIGN_RATIO) < 2) continue;

      const rid = pageNo + ':t' + regions.length;
      const bbox = unionBBox(block.map(function (l) { return l.bbox; }));
      const lineIds = [];
      for (let i = 0; i < block.length; i++) {
        block[i].role = 'table';
        block[i].regionId = rid;
        lineIds.push(block[i].id);
      }
      if (caption) {
        caption.regionId = rid;
        lineIds.unshift(caption.id);
        mergeBBox(bbox, caption.bbox);
      }
      // 표 사이에 끼어 있는 run 1개짜리 줄(긴 셀 텍스트)도 bbox 안이면 포함
      for (let i = 0; i < colLines.length; i++) {
        const l = colLines[i];
        if (l.regionId || l.role !== 'body' || !l.bbox) continue;
        if (l.bbox.y0 >= bbox.y0 && l.bbox.y1 <= bbox.y1 && l.bbox.x0 >= bbox.x0 - 1 && l.bbox.x1 <= bbox.x1 + 1) {
          l.role = 'table';
          l.regionId = rid;
          lineIds.push(l.id);
        }
      }
      regions.push({ id: rid, kind: 'table', bbox: bbox, lineIds: lineIds, pageNo: pageNo });
    }
  }
  return regions;
}

// 블록 바로 위의 "TABLE n" 캡션 줄
function findCaption(colLines, block, Lm, P) {
  const topY = block[0].baseline;
  let best = null;
  for (let i = 0; i < colLines.length; i++) {
    const l = colLines[i];
    if (l.role !== 'figure-caption' || !/^TABLE\s*\d/i.test(l.text || '')) continue;
    const d = l.baseline - topY;
    if (d > 0 && d <= P.TABLE_LEADING_FACTOR * Lm) {
      if (!best || l.baseline < best.baseline) best = l;
    }
  }
  return best;
}

function unionBBox(boxes) {
  const out = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let i = 0; i < boxes.length; i++) mergeBBox(out, boxes[i]);
  if (!Number.isFinite(out.x0)) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  return out;
}

function mergeBBox(target, box) {
  if (!box) return;
  if (box.x0 < target.x0) target.x0 = box.x0;
  if (box.y0 < target.y0) target.y0 = box.y0;
  if (box.x1 > target.x1) target.x1 = box.x1;
  if (box.y1 > target.y1) target.y1 = box.y1;
}

/* ────────────────────────────────────────────────────────
   9단계 — 문단 그룹핑 (spec 4-9)
   ──────────────────────────────────────────────────────── */

/**
 * spec 4-9 — 새 문단 시작 조건.
 * ctx: { Lm, Fm, colLeft, colWidth }
 */
export function newParagraph(prev, cur, ctx, params = LAYOUT) {
  const P = params || LAYOUT;
  if (!prev) return true;
  if (cur.col !== prev.col) return true;
  if (cur.role === 'heading' || prev.role === 'heading') return true;
  const dy = prev.baseline - cur.baseline;
  if (dy > P.PARA_LEADING_FACTOR * ctx.Lm) return true;                                   // 행간 급증
  if (cur.bbox.x0 - ctx.colLeft > P.PARA_INDENT_FACTOR * ctx.Fm && endsSentence(prev.text)) return true;  // 들여쓰기
  if (isQuestionStart(cur.text) || isOptionStart(cur.text)) return true;                  // 문항·보기 시작
  if (prev.bbox.x1 < ctx.colLeft + P.PARA_SHORT_LINE_RATIO * ctx.colWidth && endsSentence(prev.text)) return true; // 짧은 마지막 줄
  if (/^[•·▪\-–]\s/.test(cur.text)) return true;                      // 글머리표
  return false;
}

/* spec 4-9 [수정 2026-09-18] — 문단 kind 우선순위:
 *   answer → question → option → heading → list → body
 *
 * answer 는 question 의 진부분집합이므로 반드시 먼저 본다.
 * heading 은 문항·보기보다 **뒤**다. 4-7 의 heading 판정은 "짧고 마침표가 없다"는
 * 약한 신호에 기대므로, [실측] 보기 "A. Primary" 와 문항 stem "I-42. An 18-year-old …"
 * 가 줄 role 단계에서 heading 으로 먼저 걸린다(1~60쪽에서 보기형 문단 735개 중
 * 108개가 heading 으로 샜다). 명시적 번호·글머리 패턴이 있는 문단이 항상 우선이다.
 * 줄 role 판정(4-7)은 건드리지 않는다 — 여기서 순서만 바꾼다.
 */
function paragraphKind(linesOfPara, text) {
  if (isAnswerStart(text)) return 'answer';
  if (isQuestionStart(text)) return 'question';
  if (isOptionStart(text)) return 'option';
  let allHeading = true;
  for (let i = 0; i < linesOfPara.length; i++) if (linesOfPara[i].role !== 'heading') allHeading = false;
  if (allHeading && linesOfPara.length) return 'heading';
  if (/^[•·▪\-–]\s/.test(text)) return 'list';
  return 'body';
}

/**
 * spec 4-9 — 읽기 순서대로 본문·제목 줄을 문단으로 묶는다.
 * 표 줄과 머리말·꼬리말·페이지 번호·회전 줄은 문단에 넣지 않는다.
 */
export function groupParagraphs(lines, pageInfo, params = LAYOUT, stats = null) {
  const P = params || LAYOUT;
  const pageNo = (pageInfo && pageInfo.pageNo) != null ? pageInfo.pageNo : 0;
  const m = stats || pageMetrics(lines, pageInfo, P);
  const cols = columnMetrics(lines, P);
  const colIndex = new Map();
  for (let i = 0; i < cols.length; i++) colIndex.set(String(cols[i].col), cols[i]);

  const flow = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!isFlowRole(l.role)) continue;     // table/header/footer/pageno/rotated 제외
    if (l.regionId) continue;              // 표 영역에 흡수된 캡션 줄 제외
    flow.push(l);
  }

  const paragraphs = [];
  let cur = null;
  let prev = null;
  for (let i = 0; i < flow.length; i++) {
    const line = flow[i];
    const cm = colIndex.get(String(line.col)) || { left: line.bbox.x0, width: 1 };
    const ctx = { Lm: m.medianLeading, Fm: m.medianFontSize, colLeft: cm.left, colWidth: cm.width || 1 };
    if (newParagraph(prev, line, ctx, P)) {
      cur = { id: pageNo + ':p' + paragraphs.length, lineIds: [], _lines: [], kind: 'body', bbox: null, text: '', continuesNext: false, continuesPrev: false };
      paragraphs.push(cur);
    }
    cur.lineIds.push(line.id);
    cur._lines.push(line);
    line.paraId = cur.id;
    prev = line;
  }

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const texts = p._lines.map(function (l) { return l.text; });
    const joined = joinParagraphText(texts);
    p.text = joined.text;
    for (let k = 0; k < p._lines.length; k++) p._lines[k].hyphenJoin = joined.hyphenJoins[k];
    p.bbox = unionBBox(p._lines.map(function (l) { return l.bbox; }));
    p.kind = paragraphKind(p._lines, p.text);
    delete p._lines;
  }

  // spec 4-9 — 페이지 경계 문단 연결 표시 (물리적으로 합치지는 않는다)
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    if (paragraphs[i].kind === 'heading') continue;
    paragraphs[i].continuesNext = !endsSentence(paragraphs[i].text);
    break;
  }
  const nbs = (pageInfo && Array.isArray(pageInfo.neighborLayouts)) ? pageInfo.neighborLayouts : [];
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i].kind === 'heading') continue;
    const first = paragraphs[i];
    let prevPageContinues = false;
    for (let k = 0; k < nbs.length; k++) {
      const nl = nbs[k];
      if (!nl || Number(nl.pageNo) !== Number(pageNo) - 1) continue;
      const ps = Array.isArray(nl.paragraphs) ? nl.paragraphs : [];
      for (let q = ps.length - 1; q >= 0; q--) {
        if (ps[q].kind === 'heading') continue;
        prevPageContinues = !!ps[q].continuesNext;
        break;
      }
    }
    first.continuesPrev = prevPageContinues || /^[a-z]/.test(first.text);
    break;
  }

  return paragraphs;
}
