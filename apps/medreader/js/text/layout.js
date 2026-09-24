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
 * 5 — 1e단계: 4-8 표 감지 후보에 번호·글머리 라벨 가드(spec 4-8 신규 2026-09-19).
 *     4 로 추출된 페이지는 보기 라벨 뒤 행잡이 들여쓰기 때문에 보기 목록이 표로
 *     오탐되어 그 줄들이 role='table' 로 문단 밖에 있다(729쪽 13쪽 46줄). 줄이
 *     문단에 없으면 5절 파서가 복원할 수 없으므로 lines[].role·regions·paragraphs
 *     가 모두 달라진다 — 다시 추출해야 한다.
 * 6 — 2b단계: 4-2 아이템 폭 위생(spec 4-2 수정 2026-09-20).
 *     pdf.js item.width 의 2.13% 가 페이지 폭을 넘거나 음수인데, 5 까지는
 *     음수만 0 으로 접고 초과·NaN 을 그대로 흘려보냈다. 그 값이
 *     splitRuns 의 gap·4-5 거터 히스토그램·lineBBox 에 모두 들어가므로
 *     5 로 추출된 페이지는 (a) 줄 4.7% 의 bbox 가 페이지 밖(최대 9,337pt,
 *     페이지 폭 612pt)이고 (b) 깨진 폭이 낀 줄의 run 경계가 틀려 있다.
 *     (a)는 4-12 하이라이트가 페이지 폭의 15배짜리 사각형을 그린다는 뜻이고,
 *     (b)는 컬럼·표 판정까지 바꾼다 — 다시 추출해야 한다.
 * 7 — 6a단계: 4-6 줄 bbox 공백 제외 + 페이지 클립(spec 4-6 수정 2026-09-23).
 *     6 은 폭 위생으로 (a)를 고쳐다고 했으나 **절반만 맞았다.** 위생은
 *     `w > W` 를 보는데, 남은 결함은 `w` 가 정상이고 `x + w > W` 인 경우다.
 *     실측(365쪽·24,460줄): 줄의 4.39%(1,074개)가 여전히 페이지 밖 —
 *     공백 아이템 347개(32%, 초과 중앙값 192pt), 크롭 박스 밖의 정상
 *     텍스트 717개(67%, 초과 중앙값 22pt), x0<0 10개.
 *     6 으로 추출된 페이지는 그 bbox 를 `toStored` 에 그대로 담고 있고,
 *     6b 원본 넷 하이라이트 오버레이는 바로 그 값을 그린다 — 다시 추출해야 한다.
 *     (문단·영역 bbox 는 클립 전 값 그대로다 — 레이아웃 판정이 그 값을 쓴다.)
 * 8 — 9a단계: 5-3 정답 글자를 [A-E] → [A-J] 로 넓혔다(spec 5-3 수정 2026-09-24).
 *     spec 5-4 는 "정답 글자가 보기 범위 밖(예: F) → unverified" 라고 F 를 예로 드는데,
 *     [A-E] 로는 **F 가 정답 문단으로 인식조차 되지 않았다.**
 *     `[실측]` 729쪽에 `The answer is F.` 가 3건 있고, 7 까지는 그 셋이
 *     `question` 후보로 흘러 `paragraphs[].kind` 가 'answer' 가 아니었으며
 *     해설 본문은 **앞 문항의 해설에 흥수됐다.**
 *     전수 재측: question 1,392 → 1,389 / answer 1,187 → 1,190 (정확히 3개 이동).
 *     `kind` 가 저장본에 들어가므로 7 로 추출된 쪽은 틀린 문단 경계를
 *     들고 있다 — 다시 추출해야 한다.
 */
export const algoVersion = 8;

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

  // 1단계 — 정규화 (회전 아이템 분리, 폭 위생 — spec 4-2 수정 2026-09-20)
  const norm = normalizeItems(rawItems, pageInfo.styles || {}, P, info);

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

  // 마지막 — 페이지 사각형으로 bbox 클립 (spec 4-6 `[수정 2026-09-23 — 6a]`)
  //
  // **여기가 파이프라인의 끝이라서 여기다.** 위의 4·5·7·8·9 단계와 bodyLeft 는 모두
  // 클립 전 bbox 를 읽는다 — detectColumns/splitRuns 는 items·run 좌표를 직접 보고,
  // columnMetrics(4-9 ctx.colLeft/colWidth, bodyLeft)·newParagraph(들여쓰기·짧은 마지막 줄)
  // ·detectTables(영역 bbox 합집합)는 line.bbox 를 읽는다. 클립된 값을 먹이면
  // 오른쪽 끝이 전부 W 로 뭉개져 컬럼·문단 판정이 무너진다.
  //
  // width/height 가 0 이면 넘기지 않는다 — 0 으로 클립하면 모든 bbox 가 0 이 된다.
  const pageRect = (width > 0 && height > 0) ? { width: width, height: height } : null;
  let bboxDegenerate = 0;
  if (pageRect) {
    const all = ordered.concat(rotLines);
    for (let i = 0; i < all.length; i++) {
      const l = all[i];
      const before = l.bbox;
      const after = lineBBox(l, pageRect);
      l.bbox = after;
      // 클립이 결함을 가리지 않게: 클립 **때문에** 넓이가 0 이 된 줄을 센다.
      // (원래부터 폭 0 인 줄 — 예: 전부 공백인 줄 — 은 페이지 밖 신호가 아니다.)
      if (before &&
          ((before.x1 - before.x0 > 0 && after.x1 - after.x0 <= 0) ||
           (before.y1 - before.y0 > 0 && after.y1 - after.y0 <= 0))) {
        bboxDegenerate++;
      }
    }
  }

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
      warn: columns.warn || null,
      // spec 4-2 — 폭 위생이 고친 아이템 수. 새 책을 넣었을 때 이 수가 튀면
      // pdf.js 가 주는 폭 정보가 그 책에서 더 심하게 깨져 있다는 신호다.
      widthFixed: norm.stats.widthFixed,
      // spec 4-6 — 클립 후 넓이가 0 이 된 줄 수. 페이지 밖에 통째로 있는 줄이라는
      // 뜻이며, 클립이 진짜 결함을 덮고 있다는 신호다. 줄은 버리지 않는다.
      // 실측: 전수 729쪽에서 25건(1·226·655쪽) — 전부 페이지 **왼쪽** 밖이고 다수가 표지·책등의 회전 줄이다.
      bboxDegenerate: bboxDegenerate
    }
  };
}
