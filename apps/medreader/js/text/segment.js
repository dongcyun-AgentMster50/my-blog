/* ============================================================
   MedReader — 문장 분리와 문장 종결 판정 (spec 4-9, 5-3)

   순수 모듈. 번역 단위·문장 낭독 모드·문단 분리가 함께 쓴다.
   ============================================================ */

import { ABBREVIATIONS } from '../config.js';

// spec 5-3 — 문항 시작 "12. Which of the following"
export function isQuestionStart(text) {
  return /^\s*\d{1,3}\.\s+\S/.test(String(text == null ? '' : text));
}

// spec 5-3 — 보기 시작 "A. Checklists to ensure"
export function isOptionStart(text) {
  return /^\s*[A-E]\.\s+\S/.test(String(text == null ? '' : text));
}

// spec 5-3 — 해설 "1. The answer is A. (Chap. 1)"
export function isAnswerStart(text) {
  return /^\s*\d{1,3}\.\s+the\s+answers?\s+(is|are)\s+[A-E]\b/i.test(String(text == null ? '' : text));
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
