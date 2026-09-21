/* ============================================================
   MedReader — 하이픈 줄바꿈 결합 (spec 4-10)

   순수 모듈. 전역을 참조하지 않는다.
   결합은 "문단 텍스트"에서만 한다. 줄 텍스트는 원본("cardio-")
   그대로 두어야 원본 뷰 하이라이트와 1:1이 유지된다.
   ============================================================ */

import { KEEP_HYPHEN_PREFIXES, KEEP_HYPHEN_SUFFIXES } from '../config.js';

/**
 * spec 4-10 — 앞 줄 끝의 하이픈을 보고 두 줄을 어떻게 이을지 결정한다.
 *
 * @param {string} prevText 앞 줄(또는 여기까지 이어 붙인 문단) 텍스트
 * @param {string} curText  다음 줄 텍스트
 * @param {Set<string>} keepSet 하이픈을 살릴 접두사 집합
 * @returns {{joined:string, hyphenJoin:boolean, keptHyphen:boolean}}
 *          hyphenJoin: 하이픈을 지우고 붙였는가 (cardio- + vascular)
 *          keptHyphen: 하이픈을 살려 붙였는가 (anti- + inflammatory)
 */
export function joinHyphen(prevText, curText, keepSet = KEEP_HYPHEN_PREFIXES,
                           keepSuffixSet = KEEP_HYPHEN_SUFFIXES) {
  const prev = String(prevText == null ? '' : prevText);
  const cur = String(curText == null ? '' : curText);
  if (prev === '') return { joined: cur, hyphenJoin: false, keptHyphen: false };
  if (cur === '') return { joined: prev, hyphenJoin: false, keptHyphen: false };

  const spaced = { joined: prev + ' ' + cur, hyphenJoin: false, keptHyphen: false };

  // 하이픈으로 끝나지 않으면 공백 결합
  if (!prev.endsWith('-')) return spaced;
  // 대시(--, en dash, em dash)는 줄바꿈 하이픈이 아니다
  if (prev.endsWith('--') || prev.endsWith('–') || prev.endsWith('—')) return spaced;

  // "-" 앞이 글자가 아니면(숫자 범위 "2019-" 등) 원래 있던 하이픈이다
  const m = prev.match(/([A-Za-z]+)-$/);
  if (!m) return spaced;

  // 다음 줄이 소문자로 시작하지 않으면(대문자·숫자) 원래 있던 하이픈일 가능성이 크다
  const t = cur.match(/^([a-z][a-z]*)/);
  if (!t) return spaced;

  const head = m[1].toLowerCase();
  if (keepSet && keepSet.has(head)) {
    return { joined: prev + cur, hyphenJoin: false, keptHyphen: true };
  }
  // 접미사 기준 — "methicillin-" + "resistant" 처럼 앞부분이 열거 불가능한 경우.
  // 다음 줄의 첫 낱말이 목록에 있으면 하이픈을 살린다(spec 4-10, P3 수정).
  if (keepSuffixSet && keepSuffixSet.has(t[1].toLowerCase())) {
    return { joined: prev + cur, hyphenJoin: false, keptHyphen: true };
  }
  return { joined: prev.slice(0, -1) + cur, hyphenJoin: true, keptHyphen: false };
}

/**
 * spec 4-9 / 4-10 — 줄 텍스트 배열을 문단 텍스트 하나로 잇는다.
 * hyphenJoins[i] 는 "i번째 줄이 다음 줄과 하이픈으로 결합되었는가"이며
 * Line.hyphenJoin 에 그대로 들어간다(하이픈을 살린 경우도 결합으로 본다 —
 * TTS가 두 줄을 한 번에 읽어야 하는 것은 같기 때문이다, spec 4-10 각주).
 */
export function joinParagraphText(lineTexts, keepSet = KEEP_HYPHEN_PREFIXES,
                                  keepSuffixSet = KEEP_HYPHEN_SUFFIXES) {
  const texts = Array.isArray(lineTexts) ? lineTexts : [];
  const hyphenJoins = texts.map(() => false);
  let out = '';
  for (let i = 0; i < texts.length; i++) {
    const t = String(texts[i] == null ? '' : texts[i]).trim();
    if (i === 0) { out = t; continue; }
    const r = joinHyphen(out, t, keepSet, keepSuffixSet);
    out = r.joined;
    hyphenJoins[i - 1] = r.hyphenJoin || r.keptHyphen;
  }
  return { text: out.replace(/\s+/g, ' ').trim(), hyphenJoins };
}
