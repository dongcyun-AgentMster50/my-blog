/* ============================================================
   MedReader — 문장 분리와 문장 종결 판정 (spec 4-9, 5-3)

   순수 모듈. 번역 단위·문장 낭독 모드·문단 분리가 함께 쓴다.
   ============================================================ */

import { ABBREVIATIONS } from '../config.js';

/* spec 5-3 [수정 2026-09-18] — 문항 번호는 "12." 뿐 아니라 "I-42."·"IV-62." 형태를 받는다.
 * [실측] 대상 서적(729쪽)은 섹션 로마숫자 + 하이픈 + 번호를 쓴다. 로마숫자 부분은
 * **선택적 캡처**라 옛 "12." 형태도 그대로 걸린다. 번호 연속성 검사는 (\d{1,3}) 로 하고
 * 로마숫자가 바뀌면 섹션 경계로 본다 — 그래서 두 부분을 나눠 돌려주는 파서를 함께 둔다.
 */
const QUESTION_RE = /^\s*(?:([IVXLC]{1,5})-)?(\d{1,3})\.\s+\S/;

// spec 5-3 정답 정규식. 문항 정규식의 진부분집합이므로 kind 판정은 answer 를 먼저 본다(4-9).
// `[수정 2026-09-24 — 9a]` 정답 글자를 **[A-J]** 로 넓혔다.
// 원래 [A-E] 였는데, spec 5-4 가 "정답 글자가 보기 범위 밖(예: F) → unverified"
// 라고 F 를 콕 집어 예로 드는데 **F 는 정답 문단으로 인식조차 되지 않았다.**
// `[실측]` 729쪽에 `The answer is F.` 가 **3건** 있다(넓은 그물 1,190 vs 좁은 1,187).
// 그 셋은 `answer` 가 아니라 `question` 후보로 흘러갔고, 해설 본문은
// **앞 문항의 해설에 흡수됐다.** 인식은 넓히고, 보기 범위 밖인지는
// 파서가 **실제 보기 글자와 대조해** 판정한다(quiz/parser.js) — 5-4 가 정한 바다.
// 보기 자체는 5-3 그대로 A~E 가 최대다(`isOptionStart` 는 그대로 둔다).
const ANSWER_RE = /^\s*(?:([IVXLC]{1,5})-)?(\d{1,3})\.\s+the\s+answers?\s+(?:is|are)\s+([A-J](?:\s*(?:,|and|&)\s*[A-J])*)\b/i;

function str(text) { return String(text == null ? '' : text); }

// spec 5-3 — 문항 시작 "12. Which of the following" / "I-42. An 18-year-old …"
export function isQuestionStart(text) {
  return QUESTION_RE.test(str(text));
}

/**
 * spec 5-3 — 문항 번호를 섹션과 번호로 나눠 돌려준다. 5절 파서(9단계)의 번호 연속성·
 * 섹션 경계 판정이 쓴다.
 * @returns {{section: string|null, number: number}|null}
 */
export function parseQuestionNumber(text) {
  const m = str(text).match(QUESTION_RE);
  if (!m) return null;
  return { section: m[1] || null, number: Number(m[2]) };
}

// spec 5-3 — 보기 시작 "A. Checklists to ensure"
export function isOptionStart(text) {
  return /^\s*[A-E]\.\s+\S/.test(str(text));
}

// spec 5-3 — 해설 "1. The answer is A. (Chap. 1)" / "IV-62. The answer is C. (Chap. 42)"
export function isAnswerStart(text) {
  return ANSWER_RE.test(str(text));
}

/**
 * spec 5-3 — 정답 문단을 섹션·번호·정답 글자들로 나눠 돌려준다.
 * "The answers are B and D." → letters ['B','D']
 * @returns {{section: string|null, number: number, letters: string[]}|null}
 */
export function parseAnswerStart(text) {
  const m = str(text).match(ANSWER_RE);
  if (!m) return null;
  // 구분자로 먼저 쪼갠다. 통째로 [A-E] 를 긁으면 "and" 의 A·D 가 딸려 온다.
  const letters = m[3].split(/\s*(?:,|and|&)\s*/i)
    .map(function (s) { return s.trim().toUpperCase(); })
    .filter(function (s) { return /^[A-J]$/.test(s); });
  return { section: m[1] ? m[1].toUpperCase() : null, number: Number(m[2]), letters: letters };
}

/**
 * spec 4-9 — 마지막 토큰이 약어인가.
 * 단일 대문자 + 마침표(머리글자)도 약어로 본다. "A." 는 보기 시작이므로
 * 호출부(문단 분리)가 isOptionStart 를 먼저 본다.
 */
export function endsWithAbbrev(text) {
  const t = String(text == null ? '' : text).trim();
  if (!t) return false;
  const m = t.match(/(\S+)$/);
  if (!m) return false;
  const tok = m[1].toLowerCase();
  if (ABBREVIATIONS.has(tok)) return true;
  // 머리글자: "J." "A." — 앞이 글자가 아니어야 한다(문장 끝 "...a." 오탐 방지는 아님)
  if (/(^|[\s(\[«"'])[A-Z]\.$/.test(t)) return true;
  return false;
}

// spec 4-9 — endsSentence(t)
export function endsSentence(text) {
  const t = String(text == null ? '' : text).trim();
  if (!t) return false;
  if (!/[.!?…]["”')\]]*$/.test(t)) return false;
  return !endsWithAbbrev(t);
}

/**
 * spec 4-9 / 7-2 — 문장 분리. 약어·머리글자 예외를 지킨다.
 * 종결 부호 뒤에 공백이 오고 다음 글자가 문장 시작처럼 보일 때만 자른다.
 */
export function splitSentences(text) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const out = [];
  let start = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '…') continue;
    let j = i + 1;
    while (j < t.length && '"”\')]'.indexOf(t[j]) >= 0) j++;
    if (j >= t.length) break;
    if (t[j] !== ' ') continue;
    const head = t.slice(start, j);
    if (!endsSentence(head)) continue;
    const next = t[j + 1];
    if (!next) break;
    // 소문자로 이어지면 문장이 끝난 것이 아니다
    if (!/[A-Z0-9(\[«"“']/.test(next)) continue;
    out.push(head.trim());
    start = j + 1;
  }
  const tail = t.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}
