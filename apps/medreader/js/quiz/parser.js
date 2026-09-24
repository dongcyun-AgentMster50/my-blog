/* ============================================================
   MedReader — 문제/보기/정답/해설 구조 파서 (spec 5절)

   **순수 계층**(3-1). document·window·fetch·indexedDB·navigator·localStorage 를
   쓰지 않는다. 입력은 PageLayout[](3-3), 출력은 ParsedSection[](5-2).
   UI 문자열을 만들지 않는다(3-2) — 코드와 구조만 낸다.

   감지 규칙(5-3)의 정규식은 text/segment.js 한 벌만 쓴다. 여기서 다시 쓰지 않는다.
   ============================================================ */

import {
  isQuestionStart, parseQuestionNumber,
  isAnswerStart, parseAnswerStart,
  isOptionStart
} from '../text/segment.js';

/* 5-3 의 나머지 규칙 — segment.js 가 갖고 있지 않은 것만 여기 둔다. */
const FIGURE_RE = /\b(figure|image|shown (below|above)|photograph|radiograph|ECG|x-ray)\b/i;
const SECTION_HEADING_RE = /^\s*(SECTION|CHAPTER)\b/i;
const SECTION_HINT_RE = /choose the (one )?best (single )?(response|answer)/i;

export const PARSER_DEFAULTS = Object.freeze({
  // 문항 시작 뒤 첫 보기(A.)를 찾을 때 허용하는 stem 이어짐 문단 수
  stemLookahead: 3,
  // 5-3 — 번호 연속성이 깨졌을 때 기대 번호를 몇 문단까지 찾아보는가
  holdLookahead: 3,
  // 5-3 — 보기 최소 2개(A,B), 최대 5개(E)
  minOptions: 2,
  maxOptions: 5,
  // 해설이 책 끝까지 흘러가지 않게 막는 안전장치
  maxExplanationParas: 30,
  // 섹션 제목을 찾을 때 거슬러 보는 문단 수
  titleLookback: 6
});

function str(v) { return String(v == null ? '' : v); }
function errMsg(e) { return (e && e.message) ? String(e.message) : String(e); }

/** 문항 id — 5-4. 재파싱을 건너 살아남아야 하므로 결정적이다. */
export function makeQuestionId(docId, sectionId, number) {
  return str(docId) + ':' + str(sectionId) + ':q' + Number(number);
}

/** 5-2 [수정 2026-09-24 — 9a] — sectionId 는 로마숫자 기반. 쪽 범위가 아니다. */
export function makeSectionId(roman, firstPageNo) {
  return roman ? ('sec-' + String(roman).toUpperCase()) : ('sec-p' + Number(firstPageNo));
}

/* ---------------------------------------------------------------
   1) PageLayout[] → 읽기 순서 문단 스트림 (페이지 경계를 지운다)
   --------------------------------------------------------------- */

function collectParagraphs(pageLayouts, errors) {
  const out = [];
  const layouts = Array.isArray(pageLayouts) ? pageLayouts.slice() : [];
  layouts.sort(function (a, b) {
    return (Number(a && a.pageNo) || 0) - (Number(b && b.pageNo) || 0);
  });
  for (let k = 0; k < layouts.length; k++) {
    const L = layouts[k];
    let pageNo = 0;
    let paras = [];
    try {
      pageNo = Number(L && L.pageNo) || 0;
      paras = (L && Array.isArray(L.paragraphs)) ? L.paragraphs : [];
    } catch (e) { errors.push(errMsg(e)); continue; }
    for (let i = 0; i < paras.length; i++) {
      // 문단 하나가 던져도 나머지는 계속 읽는다 (5-4 — 파서가 리더를 죽이면 안 된다)
      try {
        const p = paras[i];
        const text = str(p && p.text);
        const e = {
          id: str(p && p.id),
          pageNo: pageNo,
          kind: str(p && p.kind),
          text: text,
          trimmed: text.trim(),
          answer: null, q: null, isOption: false
        };
        // 4-9 와 같은 우선순위: answer 는 question 의 진부분집합이므로 먼저 본다.
        if (isAnswerStart(text)) {
          e.answer = parseAnswerStart(text);
        } else if (isQuestionStart(text)) {
          e.q = parseQuestionNumber(text);
        } else if (isOptionStart(text)) {
          e.isOption = true;
        }
        out.push(e);
      } catch (e2) { errors.push(errMsg(e2)); }
    }
  }
  return out;
}

/* isOptionStart 가 `^\s*[A-E]\.\s+\S` 를 이미 보장한다 — 정규식을 다시 쓰지 않고 잘라 쓴다. */
function optionLetter(entry) { return entry.trimmed.charAt(0); }
function optionBody(entry) { return entry.trimmed.slice(2).trim(); }

/* ---------------------------------------------------------------
   2) 문항 후보 한 건의 stem·보기 블록 추출 (5-3)
   --------------------------------------------------------------- */

function extractBlock(paras, i, cfg) {
  const stem = [paras[i]];
  const options = [];
  let j = i + 1;

  // 문항 본문 — 첫 보기(A.) 직전까지. 페이지에 걸쳐 있어도 이어진다.
  while (j < paras.length) {
    const p = paras[j];
    if (p.answer || p.q) break;
    if (p.isOption) break;                      // A 든 아니든 보기 구간 판정으로 넘긴다
    if (stem.length - 1 >= cfg.stemLookahead) break;
    stem.push(p);
    j++;
  }

  // 보기 — 글자가 A, B, C… 로 연속이어야 한다.
  let want = 65; // 'A'
  while (j < paras.length && options.length < cfg.maxOptions) {
    const p = paras[j];
    if (p.answer || p.q) break;
    if (p.isOption) {
      if (optionLetter(p).charCodeAt(0) !== want) break;   // 글자 건너뜀 → 여기서 끊는다
      options.push({ letter: optionLetter(p), text: optionBody(p), paraId: p.id });
      want++; j++;
      continue;
    }
    // 보기 사이의 일반 문단: 바로 다음이 기대 글자 보기라면 앞 보기가 페이지를 넘어온 것이다.
    if (options.length && j + 1 < paras.length) {
      const nx = paras[j + 1];
      if (nx.isOption && !nx.answer && !nx.q && optionLetter(nx).charCodeAt(0) === want) {
        const last = options[options.length - 1];
        last.text = (last.text + ' ' + p.trimmed).trim();
        j++;
        continue;
      }
    }
    break;
  }

  return { stem: stem, options: options, end: j };
}

/** 5-3 — 번호 연속성이 깨졌을 때 기대 번호가 곧 나오는지 본다(나오면 이 후보가 오탐이다). */
function holdFinds(paras, from, to, roman, wanted) {
  const end = Math.min(to, paras.length);
  for (let k = Math.max(0, from); k < end; k++) {
    const p = paras[k];
    if (!p.q) continue;
    const r = p.q.section ? String(p.q.section).toUpperCase() : null;
    if (r !== roman) continue;
    if (p.q.number === wanted) return true;
  }
  return false;
}

/** 5-2 — "SECTION I …" 헤더 또는 첫 heading. 없으면 null. */
function titleNear(paras, i, cfg) {
  let heading = null;
  for (let k = i - 1; k >= 0 && k >= i - cfg.titleLookback; k--) {
    const p = paras[k];
    if (!p.trimmed) continue;
    if (SECTION_HEADING_RE.test(p.trimmed)) return p.trimmed;
    if (heading === null && p.kind === 'heading') heading = p.trimmed;
  }
  return heading;
}

/* 5-3 — 해설은 정답 문단부터 다음 정답 문단 직전까지(페이지 경계 포함). */
function extractExplanation(paras, i, cfg) {
  const ids = [paras[i].id];
  const texts = [paras[i].trimmed];
  let j = i + 1;
  while (j < paras.length && (j - i) <= cfg.maxExplanationParas) {
    const p = paras[j];
    if (p.answer) break;
    if (SECTION_HEADING_RE.test(p.trimmed)) break;
    if (SECTION_HINT_RE.test(p.trimmed)) break;
    // 해설 뒤에 문제 블록이 다시 나오는 조판 방어: 보기(A.)가 바로 뒤따르는 문항은 진짜다.
    if (p.q) {
      const nx = paras[j + 1];
      if (nx && nx.isOption && optionLetter(nx) === 'A') break;
    }
    ids.push(p.id);
    texts.push(p.trimmed);
    j++;
  }
  return { ids: ids, text: texts.join('\n'), end: j };
}

/* ---------------------------------------------------------------
   3) 본체
   --------------------------------------------------------------- */

function newSection(id, roman, pageNo, title) {
  return {
    sectionId: id, title: title == null ? null : title, roman: roman,
    startPage: pageNo, expected: 0,
    qs: [], answers: new Map(), dupAnswerNumbers: new Set(),
    errors: []
  };
}

/**
 * spec 5-2 — PageLayout[] → ParsedSection[] + 진단 수치.
 * 예외는 밖으로 새지 않는다(5-4): stats.error 로만 남는다.
 */
export function parseSectionsWithStats(pageLayouts, opts) {
  const o = opts || {};
  const cfg = {
    stemLookahead: o.stemLookahead == null ? PARSER_DEFAULTS.stemLookahead : o.stemLookahead,
    holdLookahead: o.holdLookahead == null ? PARSER_DEFAULTS.holdLookahead : o.holdLookahead,
    minOptions: o.minOptions == null ? PARSER_DEFAULTS.minOptions : o.minOptions,
    maxOptions: o.maxOptions == null ? PARSER_DEFAULTS.maxOptions : o.maxOptions,
    maxExplanationParas: o.maxExplanationParas == null ? PARSER_DEFAULTS.maxExplanationParas : o.maxExplanationParas,
    titleLookback: o.titleLookback == null ? PARSER_DEFAULTS.titleLookback : o.titleLookback
  };
  const docId = str(o.docId) || 'doc';

  const errors = [];
  const order = [];
  const byId = new Map();
  const diag = {
    paragraphs: 0, questionCandidates: 0, answerParas: 0,
    rejectedNoOptions: 0, rejectedContinuity: 0,
    acceptedQuestions: 0, duplicateAnswerNumbers: 0,
    candidatesWithoutRoman: 0, acceptedWithoutRoman: 0
  };

  function getOrCreate(id, roman, pageNo, title) {
    let s = byId.get(id);
    if (!s) { s = newSection(id, roman, pageNo, title); byId.set(id, s); order.push(s); }
    else if (s.title == null && title != null) s.title = title;
    return s;
  }

  try {
    const paras = collectParagraphs(pageLayouts, errors);
    diag.paragraphs = paras.length;
    let current = null;
    let lastQuestionSection = null;

    for (let i = 0; i < paras.length; i++) {
      const p = paras[i];
      try {
        /* ---- 정답·해설 ---- */
        if (p.answer) {
          diag.answerParas++;
          const roman = p.answer.section ? String(p.answer.section).toUpperCase() : null;
          let sec;
          if (roman) {
            sec = getOrCreate(makeSectionId(roman, p.pageNo), roman, p.pageNo, titleNear(paras, i, cfg));
          } else if (lastQuestionSection) {
            sec = lastQuestionSection;              // 로마숫자 없는 책: 직전 문항 섹션에 붙는다
          } else {
            sec = getOrCreate(makeSectionId(null, p.pageNo), null, p.pageNo, titleNear(paras, i, cfg));
          }
          const ex = extractExplanation(paras, i, cfg);
          const n = p.answer.number;
          if (sec.answers.has(n)) {
            // 조용히 덮어쓰지 않는다 — 먼저 나온 것을 남기고 번호를 표시해 둔다(5-4).
            sec.dupAnswerNumbers.add(n);
            diag.duplicateAnswerNumbers++;
          } else {
            sec.answers.set(n, {
              number: n, letters: p.answer.letters.slice(),
              explanationParaIds: ex.ids, explanation: ex.text, pageNo: p.pageNo
            });
          }
          continue;
        }

        if (!p.q) continue;

        /* ---- 문항 후보 ---- */
        diag.questionCandidates++;
        const roman = p.q.section ? String(p.q.section).toUpperCase() : null;
        const n = p.q.number;
        if (!roman) diag.candidatesWithoutRoman++;

        // 그물 1 — 보기 존재. 보기가 2개 미만이면 번호 목록으로 본다(5-3).
        const blk = extractBlock(paras, i, cfg);
        if (blk.options.length < cfg.minOptions) { diag.rejectedNoOptions++; continue; }

        // 그물 2 — 번호 연속성(5-3)
        const holdTo = blk.end + cfg.holdLookahead;
        let sec = null;
        if (roman) {
          sec = byId.get(makeSectionId(roman, p.pageNo));
          if (sec && sec.qs.length && n !== sec.expected && n !== 1 &&
              holdFinds(paras, i + 1, holdTo, roman, sec.expected)) {
            diag.rejectedContinuity++; continue;
          }
          if (!sec) sec = getOrCreate(makeSectionId(roman, p.pageNo), roman, p.pageNo, titleNear(paras, i, cfg));
        } else {
          const cont = current && current.roman === null &&
                       (current.qs.length === 0 || n === current.expected);
          if (cont) {
            sec = current;
          } else {
            if (current && current.roman === null && current.qs.length && n !== 1 &&
                holdFinds(paras, i + 1, holdTo, null, current.expected)) {
              diag.rejectedContinuity++; continue;
            }
            // 번호가 1로 되돌아가거나 이어지지 않으면 새 섹션(5-3). id 가 같으면 같은 섹션이다.
            sec = getOrCreate(makeSectionId(null, p.pageNo), null, p.pageNo, titleNear(paras, i, cfg));
          }
        }

        const stemText = blk.stem.map(function (s) { return s.trimmed; }).join(' ').trim();
        const optText = blk.options.map(function (t) { return t.text; }).join(' ');
        sec.qs.push({
          number: n,
          stemParaIds: blk.stem.map(function (s) { return s.id; }),
          stem: stemText,
          options: blk.options,
          pageNo: blk.stem[0].pageNo,
          hasFigure: FIGURE_RE.test(stemText) || FIGURE_RE.test(optText)
        });
        sec.expected = n + 1;
        current = sec;
        lastQuestionSection = sec;
        diag.acceptedQuestions++;
        if (!roman) diag.acceptedWithoutRoman++;
      } catch (e) {
        const target = current || (order.length ? order[order.length - 1] : null);
        if (target) target.errors.push(errMsg(e)); else errors.push(errMsg(e));
      }
    }
  } catch (e) {
    errors.push(errMsg(e));
  }

  /* ---- 매칭과 상태 (5-4) ---- */
  const sections = [];
  for (let s = 0; s < order.length; s++) {
    const sec = order[s];
    const questions = [];
    let answered = 0, unverified = 0, duplicates = 0;
    try {
      const counts = new Map();
      for (let k = 0; k < sec.qs.length; k++) {
        counts.set(sec.qs[k].number, (counts.get(sec.qs[k].number) || 0) + 1);
      }
      for (let k = 0; k < sec.qs.length; k++) {
        const q = sec.qs[k];
        const a = sec.answers.get(q.number) || null;
        const dup = (counts.get(q.number) || 0) > 1;
        if (dup) duplicates++;
        let status = 'verified';
        if (!a) {
          status = 'unverified';                       // 해설이 아직 추출되지 않았거나 정답이 없다
        } else if (!a.letters.length) {
          status = 'unverified';
        } else {
          const have = new Set();
          for (let z = 0; z < q.options.length; z++) have.add(q.options[z].letter);
          for (let z = 0; z < a.letters.length; z++) {
            if (!have.has(a.letters[z])) { status = 'unverified'; break; }  // 보기 범위 밖(예: F)
          }
        }
        if (dup || sec.dupAnswerNumbers.has(q.number)) status = 'unverified'; // 번호 중복
        if (a) answered++;
        if (status === 'unverified') unverified++;
        questions.push({
          id: makeQuestionId(docId, sec.sectionId, q.number),
          sectionId: sec.sectionId,
          number: q.number,
          stemParaIds: q.stemParaIds,
          stem: q.stem,
          options: q.options,
          pageNo: q.pageNo,
          hasFigure: q.hasFigure,
          answer: a ? { letters: a.letters.slice(), explanationParaIds: a.explanationParaIds, explanation: a.explanation } : null,
          status: status
        });
      }
    } catch (e) {
      sec.errors.push(errMsg(e));
    }
    if (!questions.length && !sec.answers.size) continue;
    const stats = {
      questions: questions.length,
      answered: answered,
      unverified: unverified,
      duplicates: duplicates
    };
    if (sec.errors.length) stats.error = sec.errors.join(' | ');
    sections.push({
      sectionId: sec.sectionId,
      title: sec.title,
      startPage: sec.startPage,
      questions: questions,
      answers: sec.answers,
      stats: stats
    });
  }

  if (errors.length) {
    const msg = errors.join(' | ');
    if (sections.length) {
      sections[0].stats.error = sections[0].stats.error ? (sections[0].stats.error + ' | ' + msg) : msg;
    } else {
      sections.push({
        sectionId: 'sec-none', title: null, startPage: 0,
        questions: [], answers: new Map(),
        stats: { questions: 0, answered: 0, unverified: 0, duplicates: 0, error: msg }
      });
    }
  }

  return { sections: sections, diagnostics: diag };
}

/** spec 5-2 — 공개 계약. 절대 던지지 않는다. */
export function parseSections(pageLayouts, opts) {
  try {
    return parseSectionsWithStats(pageLayouts, opts).sections;
  } catch (e) {
    return [{
      sectionId: 'sec-none', title: null, startPage: 0,
      questions: [], answers: new Map(),
      stats: { questions: 0, answered: 0, unverified: 0, duplicates: 0, error: errMsg(e) }
    }];
  }
}

/** 5-4 — 퀴즈 제안 칩 조건. UI 문자열이 아니라 판정만 낸다. */
export function isQuizWorthy(section, minQuestions, minRatio) {
  if (!section || !section.stats) return false;
  const q = Number(section.stats.questions) || 0;
  const v = q - (Number(section.stats.unverified) || 0);
  const mq = minQuestions == null ? 5 : minQuestions;
  const mr = minRatio == null ? 0.6 : minRatio;
  return q >= mq && (v / q) >= mr;
}
