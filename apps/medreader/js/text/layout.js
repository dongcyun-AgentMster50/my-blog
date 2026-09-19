/* ============================================================
   MedReader — 줄 재구성 파이프라인 (spec 4-1)

   순수 모듈. 입력은 pdf.js getTextContent() 결과와 같은 형태의 값이고
   출력은 spec 3-3 의 PageLayout 이다. 브라우저 API를 전혀 모른다.
   ============================================================ */

import { LAYOUT } from '../config.js';
import {
  normalizeItems, clusterLines, splitRuns, joinText, lineBBox
} from './lines.js';
import { detectColumns, reassignByColumn, orderLines } from './columns.js';
import { classifyRoles, detectTables, groupParagraphs, columnMetrics } from './blocks.js';

/**
 * 알고리즘 버전. 알고리즘을 고치면 값을 올린다.
 * pages 스토어의 값이 이보다 작은 페이지는 다시 추출한다(spec 3-3, 9절).
 *
 * 2 — 1b단계: run 분할 임계 2.0 → 1.2, 거터 비율의 분모를
 *     body.length → "그 X 를 가로지르는 본문 줄 수"(spec 4-4·4-5 수정 2026-09-18).
 *     1 로 추출된 페이지는 컬럼이 병합되어 있으므로 반드시 다시 추출해야 한다.
 * 3 — 1c단계: 문단 kind 판정 수정(spec 4-9·5-3 수정 2026-09-18).
 *     문항·정답 번호가 "I-42."·"IV-62." 형태를 받고, kind 우선순위가
 *     answer → question → option → heading → list → body 로 바뀌었다.
 *     2 로 추출된 페이지는 paragraphs[].kind 가 틀려 있다(question 이 거의 잡히지
 *     않고 보기가 heading 으로 샜다). 5절 파서가 kind 를 쓰므로 다시 추출해야 한다.
 * 4 — 1d단계: 4-7 짧은 줄 heading 규칙에 문항·보기·정답 가드(spec 4-7 수정 2026-09-18).
 *     3 으로 추출된 페이지는 문항 stem 첫 줄과 보기 줄의 role 이 'heading' 이고,
 *     그 때문에 4-9 의 newParagraph 가 stem 을 두 문단으로 쪼개 놓았다
 *     (question 문단의 72.6%가 줄 1개짜리). lines[].role 과 paragraphs 경계가
 *     모두 달라지므로 다시 추출해야 한다.
 */
export const algoVersion = 4;

// 출력용 Run — 내부 items 참조를 떼고 좌표·텍스트만 남긴다(spec 4-8 표 재구성이 run 텍스트를 쓴다).
function publicRun(run, params) {
  return {
    x0: run.x0,
    x1: run.x1,
    text: joinText({ items: run.items }, params)
  };
}

// 출력용 Line — 내부 누적값(_wsum 등)을 제거한다(결정성·직렬화 크기).
function publicLine(line, params) {
  const runs = (line.runs || []).map(function (r) { return publicRun(r, params); });
  return {
    id: line.id,
    text: line.text,
    bbox: line.bbox,
    baseline: line.baseline,
    fontSize: line.fontSize,
    col: line.col,
    role: line.role,
    hyphenJoin: !!line.hyphenJoin,
    paraId: line.paraId,
    regionId: line.regionId || null,
    runs: runs,
    items: (line.items || []).map(function (it) {
      return {
        str: it.str, x: it.x, y: it.y, w: it.w, h: it.h,
        fontSize: it.fontSize, fontName: it.fontName,
        ascent: it.ascent, descent: it.descent,
        rotated: it.rotated, hasEOL: it.hasEOL, sup: it.sup, idx: it.idx
      };
    })
  };
}

/**
 * spec 4-1 — 10단계 파이프라인.
 *
 * @param {Array} rawItems getTextContent().items 그대로
 * @param {Object} pageInfo { pageNo, width, height, styles, neighborLayouts }
 * @param {Object} params 알고리즘 파라미터(기본 LAYOUT). 프로토타입 페이지가 일부만 덮어쓴다.
 * @returns {Object} PageLayout
 */
export function buildPageLayout(rawItems, pageInfo = {}, params = LAYOUT) {
  const P = params || LAYOUT;
  const pageNo = pageInfo.pageNo != null ? pageInfo.pageNo : 0;
  const width = Number(pageInfo.width) || 0;
  const height = Number(pageInfo.height) || 0;
  const info = {
    pageNo: pageNo,
    width: width,
    height: height,
    neighborLayouts: pageInfo.neighborLayouts || []
  };

  // 1단계 — 정규화 (회전 아이템 분리)
  const norm = normalizeItems(rawItems, pageInfo.styles || {}, P);

  // 2·3단계 — Y 클러스터링 → run 분할
  let lines = clusterLines(norm.items, P);
  for (let i = 0; i < lines.length; i++) splitRuns(lines[i], P);

  // 4단계 — 컬럼 판별 → 컬럼별 줄 재편
  const columns = detectColumns(lines, info, P);
  lines = reassignByColumn(lines, columns, info, P);

  // 5단계 — 읽기 순서
  const ordered = orderLines(lines, columns, info);

  // 6단계 — 텍스트 결합과 bbox
  for (let i = 0; i < ordered.length; i++) {
    ordered[i].id = pageNo + ':' + i;
    ordered[i].text = joinText(ordered[i], P);
    ordered[i].bbox = lineBBox(ordered[i]);
  }

  // 회전 줄은 본문 파이프라인 밖에서 따로 묶는다 (spec 4-2, 4-7)
  const rotLines = clusterLines(norm.rotated, P);
  for (let i = 0; i < rotLines.length; i++) {
    const l = rotLines[i];
    splitRuns(l, P);
    l.id = pageNo + ':r' + i;
    l.text = joinText(l, P);
    l.bbox = lineBBox(l);
    l.role = 'rotated';
    l.col = -1;
  }

  // 7단계 — 역할 판정
  const metrics = classifyRoles(ordered, info, P, info.neighborLayouts);

  // 8단계 — 표 영역
  const regions = detectTables(ordered, info, P, metrics);

  // 9단계 — 문단
  const paragraphs = groupParagraphs(ordered, Object.assign({}, info), P, metrics);

  const bodyLeft = columnMetrics(ordered, P).map(function (c) { return c.left; });

  return {
    pageNo: pageNo,
    width: width,
    height: height,
    algoVersion: algoVersion,
    lines: ordered.concat(rotLines).map(function (l) { return publicLine(l, P); }),
    paragraphs: paragraphs,
    regions: regions,
    columns: { count: columns.count, gutters: columns.gutters.slice() },
    stats: {
      medianFontSize: metrics.medianFontSize,
      medianLeading: metrics.medianLeading,
      bodyLeft: bodyLeft,
      warn: columns.warn || null
    }
  };
}
