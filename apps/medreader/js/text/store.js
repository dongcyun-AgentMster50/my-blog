/* ============================================================
   MedReader — 저장본 생성·복원 (spec 9-2 줄이는 규칙 1·2·3)

   순수 모듈. 전역(브라우저 API·IndexedDB)을 전혀 모른다.
   2단계의 `extract.js` 가 저장 **직전**에 `toStored` 를 부르고,
   `db.js` 가 읽어 온 레코드를 `fromStored` 로 되살린다.

   ── 왜 필요한가 (spec 9-2 수정 2026-09-20) ──────────────
   `[실측]` 아이템을 뺀 저장본이 쪽당 평균 32.4KB(p90 50.3KB)다.
   729쪽이 24.2MB, 같은 비율이면 **7000쪽 ≈ 221MB** 로 IndexedDB 설계가
   통째로 흔들린다. 내역을 보면 **같은 글자가 최대 세 벌** 저장된다 —
   줄 text, run text, 문단 text.

   1. `paragraphs[].text` 를 저장하지 않는다. `lineIds` 와 4-10 하이픈
      규칙으로 읽을 때 조립한다(`joinParagraphText` 가 이미 순수 함수다).
   2. `runs[].text` 는 표 region 에 속한 줄에만 저장한다. run 텍스트의
      유일한 소비자는 4-8 의 AI 표 재구성이다. `x0`·`x1` 은 전 줄에 유지한다.
   3. 좌표는 소수 둘째 자리로 반올림한다. 0.01pt = 0.0035mm 로
      4-12 하이라이트에 충분하다.

   ── 계약 ────────────────────────────────────────────────
   * `toStored` → `fromStored` 왕복 후 문단 `text` 는 원본과 **바이트 단위로**
     같아야 한다. `tests/store.test.mjs` 가 이것을 고정한다.
   * `fromStored` 는 **저장본만으로** 동작한다(원본 items 없이).
   * `toStored` 는 입력 `PageLayout` 을 훼손하지 않는다.
   ============================================================ */

import { KEEP_HYPHEN_PREFIXES, KEEP_HYPHEN_SUFFIXES } from '../config.js';
import { joinParagraphText } from './hyphen.js';

/**
 * 저장본 형식 버전. `algoVersion`(알고리즘) 과 별개다 —
 * 같은 알고리즘 결과를 **담는 그릇**이 바뀌면 이 값을 올린다.
 */
export const storeVersion = 1;

/* spec 9-2 규칙 3 — 소수 둘째 자리 반올림.
   결정적이어야 한다(같은 입력 → 같은 출력). Math.round 는 결정적이고,
   -0 은 0 으로 접어 JSON·구조화 복제에서 표현이 갈리지 않게 한다. */
export function round2(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
}

function round2Box(b) {
  if (!b) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  return { x0: round2(b.x0), y0: round2(b.y0), x1: round2(b.x1), y1: round2(b.y1) };
}

/**
 * spec 9-2 — `PageLayout`(3-3) → 저장용 객체.
 *
 * 아이템 배열(`lines[].items`)은 저장하지 않는다(9-2 의 전제).
 * 나머지는 규칙 1·2·3 을 적용한다.
 *
 * @param {Object} pageLayout `buildPageLayout` 의 결과
 * @returns {Object} 저장용 객체 (평범한 JSON 값만 담는다)
 */
export function toStored(pageLayout) {
  const L = pageLayout || {};
  const lines = Array.isArray(L.lines) ? L.lines : [];
  const paragraphs = Array.isArray(L.paragraphs) ? L.paragraphs : [];
  const regions = Array.isArray(L.regions) ? L.regions : [];

  // 규칙 2 — run 텍스트를 남길 줄: 표 region 에 속한 줄.
  // `regions[].lineIds` 가 정본이고, 줄의 `regionId` 는 보조로 본다
  // (캡션 줄처럼 region 에 속하되 role 이 'table' 이 아닌 줄이 있다).
  const tableLineIds = new Set();
  for (let i = 0; i < regions.length; i++) {
    const ids = Array.isArray(regions[i].lineIds) ? regions[i].lineIds : [];
    for (let k = 0; k < ids.length; k++) tableLineIds.add(ids[k]);
  }

  const outLines = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const keepRunText = tableLineIds.has(l.id) || !!l.regionId;
    const runs = Array.isArray(l.runs) ? l.runs : [];
    const outRuns = [];
    for (let k = 0; k < runs.length; k++) {
      const r = runs[k];
      const rec = { x0: round2(r.x0), x1: round2(r.x1) };
      if (keepRunText) rec.text = r.text;      // 규칙 2
      outRuns.push(rec);
    }
    outLines.push({
      id: l.id,
      text: l.text,                            // 줄 text 는 본문이다 — 줄일 수 없다
      bbox: round2Box(l.bbox),                 // 규칙 3
      baseline: round2(l.baseline),
      fontSize: round2(l.fontSize),
      col: l.col,
      role: l.role,
      hyphenJoin: !!l.hyphenJoin,
      paraId: l.paraId == null ? null : l.paraId,
      regionId: l.regionId == null ? null : l.regionId,
      runs: outRuns
    });
  }

  const outParas = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    outParas.push({
      id: p.id,
      lineIds: Array.isArray(p.lineIds) ? p.lineIds.slice() : [],
      // 규칙 1 — text 는 저장하지 않는다. fromStored 가 lineIds 로 조립한다.
      kind: p.kind,
      bbox: round2Box(p.bbox),
      continuesNext: !!p.continuesNext,
      continuesPrev: !!p.continuesPrev
    });
  }

  const outRegions = [];
  for (let i = 0; i < regions.length; i++) {
    const g = regions[i];
    outRegions.push({
      id: g.id,
      kind: g.kind,
      bbox: round2Box(g.bbox),
      lineIds: Array.isArray(g.lineIds) ? g.lineIds.slice() : [],
      pageNo: g.pageNo
    });
  }

  const cols = L.columns || { count: 1, gutters: [] };
  const st = L.stats || {};
  const bodyLeft = Array.isArray(st.bodyLeft) ? st.bodyLeft.map(round2) : [];

  return {
    pageNo: L.pageNo,
    width: round2(L.width),
    height: round2(L.height),
    algoVersion: L.algoVersion,
    storeVersion: storeVersion,
    lines: outLines,
    paragraphs: outParas,
    regions: outRegions,
    columns: {
      count: cols.count,
      gutters: (Array.isArray(cols.gutters) ? cols.gutters : []).map(round2)
    },
    stats: {
      medianFontSize: round2(st.medianFontSize),
      medianLeading: round2(st.medianLeading),
      bodyLeft: bodyLeft,
      warn: st.warn == null ? null : st.warn,
      widthFixed: Number(st.widthFixed) || 0
    }
  };
}

/**
 * spec 9-2 규칙 1 — 저장본을 읽기용 객체로 되살린다.
 *
 * 문단 `text` 는 `lineIds` 로 줄 텍스트를 모아 4-10 의 하이픈 규칙
 * (`joinParagraphText`)으로 다시 만든다. 저장할 때와 **같은 함수·같은 집합**을
 * 쓰므로 결과는 원본과 바이트 단위로 같다.
 *
 * 원본 items 는 필요 없다. `lines[].items` 는 복원되지 않는다 —
 * 아이템이 필요한 소비자(있다면)는 PDF 에서 다시 추출해야 한다.
 *
 * @param {Object} stored `toStored` 의 결과
 * @param {Object} [opts] { keepPrefixes, keepSuffixes } — 책별 프로파일(2-4)이
 *                 하이픈 집합을 덮어쓸 때 쓴다. 저장할 때 쓴 집합과 같아야 한다.
 * @returns {Object} PageLayout 형태(아이템 없음, 문단 text 복원됨)
 */
export function fromStored(stored, opts = null) {
  const S = stored || {};
  const keepPrefixes = (opts && opts.keepPrefixes) || KEEP_HYPHEN_PREFIXES;
  const keepSuffixes = (opts && opts.keepSuffixes) || KEEP_HYPHEN_SUFFIXES;

  const lines = Array.isArray(S.lines) ? S.lines : [];
  const byId = new Map();
  for (let i = 0; i < lines.length; i++) byId.set(lines[i].id, lines[i]);

  const paragraphs = [];
  const src = Array.isArray(S.paragraphs) ? S.paragraphs : [];
  for (let i = 0; i < src.length; i++) {
    const p = src[i];
    const ids = Array.isArray(p.lineIds) ? p.lineIds : [];
    const texts = [];
    for (let k = 0; k < ids.length; k++) {
      const l = byId.get(ids[k]);
      // 저장본이 깨져 줄이 없으면 조용히 건너뛴다. 텍스트가 짧아질 뿐
      // 예외로 읽기를 막지는 않는다(9-4 의 재개 모델이 페이지를 다시 뽑는다).
      if (l) texts.push(l.text);
    }
    const joined = joinParagraphText(texts, keepPrefixes, keepSuffixes);
    paragraphs.push({
      id: p.id,
      lineIds: ids.slice(),
      text: joined.text,
      kind: p.kind,
      bbox: p.bbox,
      continuesNext: !!p.continuesNext,
      continuesPrev: !!p.continuesPrev
    });
  }

  const cols = S.columns || { count: 1, gutters: [] };
  return {
    pageNo: S.pageNo,
    width: S.width,
    height: S.height,
    algoVersion: S.algoVersion,
    storeVersion: S.storeVersion == null ? null : S.storeVersion,
    lines: lines,
    paragraphs: paragraphs,
    regions: Array.isArray(S.regions) ? S.regions : [],
    columns: { count: cols.count, gutters: Array.isArray(cols.gutters) ? cols.gutters : [] },
    stats: S.stats || {}
  };
}
