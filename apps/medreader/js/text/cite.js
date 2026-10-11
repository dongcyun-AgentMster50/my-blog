/* ============================================================
   MedReader — 인용 단위·참고문헌 묶음 판별 (spec 6-6-2 A · 8h-1)

   **순수 모듈이다.** 브라우저 전역을 모른다(16-A). `tts/text.js` 의 `buildUnits` 가
   문장 모드에서 **문단마다** `markReferences(문장들)` 을 부르고, 표시된 문장은
   `Unit.cite = true`·`seg = null` 이 된다 — 낭독 큐(설정이 꺼져 있으면)와 번역 입력에서 빠진다.
   **화면은 그대로다.** 추출(`pages`·`paragraphs`·`lines`)을 건드리지 않으므로 `algoVersion` 불변.

   ── 원칙 (spec 6-6 머리) ─────────────────────────────────
   · 판별은 **언어·책에 기대지 않는 꼴**만: 식별자 토큰(PMID·PMCID·DOI), 국제 인용 꼴
     (NLM/Vancouver "성 이니셜 et al. 학술지 연도;권:쪽"), 글머리 글리프. 책의 열 위치·글꼴·쪽 번호는 쓰지 않는다.
   · **오탐(본문을 건너뜀)이 미탐(인용을 읽음)보다 비싸다.** 모든 규칙에 닫힘 조건이 있고, 애매하면 읽는다.
     - A1 은 **단위 전체**가 인용 조각일 때만(본문 문장 안의 "(Smith, 2020)" 은 그대로 읽는다).
     - A2 는 머리 뒤 `REF_MAX_FOLLOW` 문장·`REF_MAX_CHARS` 글자 안에서 **닫혀야** 빼고, 쉼표로 끝난 머리는
       받지 않는다("Stage III, severe …" 반례 — spec 6-6-1).
   · 비라틴 문자(한글·아랍 문자) 인용은 어느 꼴에도 맞지 않는다 → 읽는다(미탐, spec 6-6-2).
   ============================================================ */

import { CITE } from '../config.js';

/* ── 꼴 ─────────────────────────────────────────────────── */

/** 식별자 — `[PMID: 123]` · `PMID 12345678` · `PMCID: PMC1234567` · `doi:10.1000/x` · `[DOI: …]`. 언어 무관. */
const ID_SRC = String.raw`\[\s*(?:PMID|PMCID|DOI)\s*:?\s*[^\]\s][^\]]*\]|\b(?:PMID|PMCID)\s*:?\s*(?:PMC)?\d{5,9}\b|\bdoi\s*:?\s*10\.\d{4,9}\/\S+`;
/** 전역 정규식은 `lastIndex` 를 들고 다니므로 쓸 때마다 새로 만든다(`replace` 전용). */
function idRe() { return new RegExp(ID_SRC, 'giu'); }

// 성: 대문자로 시작하는 낱말(하이픈·’ 허용). 이니셜: 대문자 1~5("GC-Y" 허용). ★ 'i' 플래그를 쓰지 않는다 —
// `/\p{Lu}/iu` 는 소문자에도 맞는다(Plan 측정 스크립트의 B2 가 이 함정에 걸렸다 — 8h-1 보고서).
const NAME = String.raw`\p{Lu}[\p{L}'’\-]+`;
const INITIALS = String.raw`\p{Lu}{1,5}(?:-\p{Lu}{1,2})?`;
const AUTHOR = String.raw`${NAME}(?:[ \-]${NAME}){0,2}\s${INITIALS}`;   // Dhanasekaran M · Smith-Jones AB · Van Der Berg JA
const AUTHORS = String.raw`${AUTHOR}(?:,\s${AUTHOR}){0,5}`;
const JWORD = String.raw`(?:\p{Lu}[\p{L}'’\-]*\.?|\(\p{Lu}[\p{L} ]*\)\.?|&)`;   // J · Endocr · Soc. · (Lond). · &
const JOURNAL = String.raw`${JWORD}(?:\s${JWORD}){0,9}`;
const PUB = String.raw`\d{4}[\d\s;:().,\-–A-Za-z]{0,40}`;                   // 2024;8:bvae033 — 소문자 낱말은 아래 검사가 막는다
const TAIL = String.raw`(?:,?\s+${JOURNAL})?(?:[.,]?\s*${PUB})?[.,]?`;

/** 성 이니셜 [,] et al[.] [학술지] [출판] */
const ETAL_SEG = new RegExp(String.raw`^${AUTHORS},?\s+et\s+al\.?${TAIL}$`, 'u');
/** 성 이니셜. 학술지 [출판] — 같은 단위에 식별자가 있을 때만 인용으로 본다. */
const AUTH_SEG = new RegExp(String.raw`^${AUTHORS}\.\s+${JOURNAL}(?:[.,]?\s*${PUB})?[.,]?$`, 'u');

const BULLET_CHARS = CITE.BULLETS.join('');
const PUNCT_ONLY = new RegExp('^[\\s.,;:()\\[\\]' + BULLET_CHARS + ']*$', 'u');
const LEAD_TRIM = new RegExp('^[\\s.,' + BULLET_CHARS + ']+', 'u');

/** spec 6-6-2 "PUB — 소문자 낱말 없음". 숫자에 붙은 전자 위치 토큰(e16002, bvae033)은 낱말이 아니다. */
const LOWER_WORD = /(?<![\p{L}\p{N}])\p{Ll}{2,}(?![\p{L}\p{N}])/u;
const ET_AL = /\bet\s+al\b/gu;

/** A2 머리 — "성 이니셜 et al. 제목…" · "성 이니셜 et al; …" · "성 이니셜. 제목…". 선택적 "12. " 번호 머리.
 *  ★ 쉼표로 끝나는 머리("Stage III, severe …")는 받지 않는다. */
const REF_START = new RegExp(String.raw`^(?:\d{1,3}\.\s)?${AUTHORS}(?:,?\s+et\s+al[.;]|\.)\s`, 'u');
/** A2 닫힘 — 출판 정보만인 문장 "2022;40:381." · "2021 Mar 4;12(3):e1–9." */
const PUB_ONLY = /^\d{4}(?:\s\p{Lu}\p{Ll}{2}(?:\s\d{1,2})?)?;\s?\d+(?:\(\w+\))?(?::\s?[\w\-–]+)?\.?$/u;

function str(v) { return String(v == null ? '' : v); }

/* ── A1 ─────────────────────────────────────────────────── */

/**
 * spec 6-6-2 A1 — 단위 **전체**가 인용 조각(식별자 / 저자-학술지)만으로 되어 있는가.
 * @param {string} src 문장 원문(`Unit.src`)
 * @returns {'id'|'etal'|'etal+id'|null} 종류. 아니면 null
 */
export function citationKind(src) {
  const s = str(src).replace(/\s+/g, ' ').trim();
  if (!s || s.length > CITE.MAX_UNIT_CHARS) return null;
  let hadId = false;
  const rest = s.replace(idRe(), function () { hadId = true; return ' ; '; });
  const segs = rest.split(';')
    .map(function (x) { return x.replace(LEAD_TRIM, '').replace(/\s+$/u, ''); })
    .filter(function (x) { return !PUNCT_ONLY.test(x); });
  if (!segs.length) return hadId ? 'id' : null;
  let etal = false;
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i];
    // 소문자 낱말이 하나라도 있으면 산문이다(학술지·출판 정보에는 없다) — 애매하면 읽는다.
    if (LOWER_WORD.test(g.replace(ET_AL, ' '))) return null;
    if (ETAL_SEG.test(g)) { etal = true; continue; }
    if (hadId && AUTH_SEG.test(g)) continue;
    return null;
  }
  return etal ? (hadId ? 'etal+id' : 'etal') : (hadId ? 'id' : null);
}

/** A1 판정(참·거짓). */
export function isCitation(src) {
  return citationKind(src) !== null;
}

/** 식별자만 있는 문장인가 — "[PMID: 123]" · "PMID 12345678." (A2 닫힘에 쓴다) */
export function isIdOnly(src) {
  const s = str(src);
  let had = false;
  const rest = s.replace(idRe(), function () { had = true; return ' '; });
  return had && PUNCT_ONLY.test(rest);
}

/* ── A2 ─────────────────────────────────────────────────── */

/** A2 머리 꼴인가("성 이니셜 et al. …" · "성 이니셜. …", 쉼표 머리 제외). 측정 도구가 "닫히지 않은 머리"를 셀 때 쓴다. */
export function isReferenceHead(src) {
  const s = str(src);
  return citationKind(s) === null && REF_START.test(s);
}

/**
 * spec 6-6-2 A2 — 한 문단의 연속 문장에서 **참고문헌 묶음**을 찾는다.
 *
 *   머리 h(A1 아님 · `REF_START`) 다음 최대 `REF_MAX_FOLLOW` 문장(머리 포함 합계 `REF_MAX_CHARS` 글자 이하)
 *   안에서 닫는 문장 c(식별자만 · 출판 정보만)가 나오면 묶음 [h, c]. h 자신이 출판 정보로 끝나면 [h, h].
 *   ★ 사이에 다른 인용(A1)이 끼면 묶음이 아니다. ★ 닫히지 않으면 묶음이 없다(읽는다).
 *
 * 같은 문단 안에서만 본다(호출자가 문단마다 부른다). 쪽을 넘는 문헌은 닫히지 않아 읽힌다(미탐 — 기록).
 *
 * @param {string[]} sents `splitSentences` 결과(한 문단)
 * @returns {{from:number, to:number}[]} 묶음들(문장 번호, 양끝 포함). 겹치지 않는다
 */
export function referenceRuns(sents) {
  const list = Array.isArray(sents) ? sents.map(str) : [];
  const kinds = list.map(citationKind);
  const runs = [];
  for (let i = 0; i < list.length; i++) {
    const h = list[i];
    if (kinds[i] !== null || !REF_START.test(h)) continue;
    let closed = -1;
    const toks = h.split(' ');
    if (PUB_ONLY.test(toks[toks.length - 1] || '')) closed = i;
    let n = h.length;
    for (let j = i + 1; closed < 0 && j < list.length && j <= i + CITE.REF_MAX_FOLLOW; j++) {
      n += list[j].length;
      if (n > CITE.REF_MAX_CHARS) break;
      if (PUB_ONLY.test(list[j]) || (kinds[j] !== null && isIdOnly(list[j]))) { closed = j; break; }
      if (kinds[j] !== null) break;                 // 사이에 다른 인용 — 묶음이 아니다
    }
    if (closed < 0) continue;                       // 닫히지 않았다 — 읽는다
    runs.push({ from: i, to: closed });
    i = closed;
  }
  return runs;
}

/**
 * spec 6-6-2 — 한 문단의 연속 문장에서 **인용인 문장**을 표시한다(A1 ∪ A2).
 *   A1 — 문장 하나만 보고 `citationKind` 가 참.
 *   A2 — `referenceRuns` 의 묶음 안의 모든 문장.
 * `tts/text.js` 의 `buildUnits` 가 문장 모드에서 문단마다 부른다.
 *
 * @param {string[]} sents `splitSentences` 결과(한 문단)
 * @returns {boolean[]} 같은 길이
 */
export function markReferences(sents) {
  const list = Array.isArray(sents) ? sents.map(str) : [];
  const out = list.map(function (s) { return citationKind(s) !== null; });
  const runs = referenceRuns(list);
  for (let r = 0; r < runs.length; r++) {
    for (let k = runs[r].from; k <= runs[r].to; k++) out[k] = true;
  }
  return out;
}
