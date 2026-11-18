/* ============================================================
   MedReader — AI 출제 응답의 자체 검증 (spec 10-4 "생성 후 자체 검증" 1–5 · 17-13 3-2 — 15-1)

   ── 순수 계층이다(3-1 · 3-2 · 16-A grep 대상) ──────────────
   `config` 와 같은 순수 계층(`ai/prompts.js` 의 `numberTokens` — 10-2 번역 검사·11-D7 숫자 거름과 **같은 함수**,
   `text/summary.js` 의 `hasForeignNumber`, `text/numexpr.js` 의 숫자 표현 덩어리 `numberSpans` — 16 개념도와 한 벌)만 import 한다.
   브라우저 전역·시계를 모른다. 로컬·무료(호출 0).

   ── 문항마다 (10-4 1–4 + 숫자 거름) ─────────────────────
     1. 근거 인용(`evidence`)을 정규화해 **보낸 문단 글**의 부분 문자열인가 → 아니면 관대한 2차(구두점 제거 · 공백은 한 칸 —
        숫자 사이의 `.`·`,`·숫자 앞 부호·숫자 뒤 `%`·`?`·`!` 는 남긴다: `7.5`≠`75`, `−2.5`≠`2.5`) → 그래도 없으면 `rejected`(저장하되 출제하지 않음).
        찾은 자리가 **낱말 가운데서 시작하거나 끝나면** 그 자리는 쓰지 않는다(1·2차 모두 — `ineffective`→`effective…`·`7.5`→`5…`).
        다른 자리·문단에서도 경계 맞는 자리가 없으면 `rejected`(`mid-word`). 판정은 원래 글자에서(`midWord`).
        찾으면 인용을 **보낸 문단 글의 그 자리 글자**로 바꿔 둔다 — 20 의 `findQuote`(문단 결합 글자 기준)가 그대로 다시 찾는다.
        인용이 `REVIEW.EVIDENCE_MIN`(20)자보다 짧으면 근거가 못 된다(아무 문단에나 맞는다) → `rejected`.
     2. 보기 정확히 5개 · 글자 A–E 한 번씩 · 보기 글 중복 없음 · 정답이 A–E.
     3. `evidenceParaId` 가 보낸 문단에 없거나 그 문단에서 인용이 안 나오면 → 인용을 찾은 문단으로 **교정**(`fixed`).
     4. 줄기·보기·해설·인용에 `[REDACTED]` → `rejected`.
     +  숫자 거름: 정답 보기·해설(대상·원문 언어)에 **보낸 글에 없는 숫자** → `rejected`(오답 보기의 숫자는 보지 않는다 — 틀린 값이 보기다).
   폐기율 > 50%(또는 문항 0) → `weak`(화면이 "충분히 만들지 못했습니다" — 자동 재호출 0, 10-4).
   ============================================================ */

import { REVIEW } from '../config.js';
import { numberTokens } from './prompts.js';
import { hasForeignNumber } from '../text/summary.js';
import { numberSpans } from '../text/numexpr.js';

export const LETTERS = Object.freeze(['A', 'B', 'C', 'D', 'E']);
export const REDACTED = '[REDACTED]';

/** 폐기 까닭(코드). 문구는 UI 가 고른다. */
export const REASON = Object.freeze({
  EMPTY: 'empty',         // 줄기·해설(대상 언어)이 비었다
  OPTIONS: 'options',     // 보기가 5개가 아니거나 빈 보기
  LETTERS: 'letters',     // 글자가 A–E 한 번씩이 아니다
  DUP: 'dup',             // 보기 글 중복
  ANSWER: 'answer',       // 정답 글자가 A–E 가 아니다
  REDACTED: 'redacted',   // [REDACTED]
  DUP_STEM: 'dupstem',    // 같은 응답 안 같은 줄기
  SHORT: 'short',         // 근거 인용이 너무 짧다
  EVIDENCE: 'evidence',   // 근거 인용을 보낸 글에서 찾지 못했다(지어냄·바꿔 씀)
  MID_WORD: 'mid-word',   // 찾았지만 낱말(수) 가운데서 시작·끝난다(`ineffective`→`effective…` — 15-2R #1)
  DIGITS: 'digits'        // 정답 보기·해설에 보낸 글 밖 숫자
});

function clean(s) {
  if (typeof s === 'number' && Number.isFinite(s)) return String(s);
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
}

/* ── 정규화 — 원래 오프셋 지도를 들고 간다 ─────────────────── */

const WS = /\s/u;
const PUNCT = /\p{P}/u;
const DIGIT = /\p{Nd}/u;

/** 글자 하나 → 정규화 글자(빈 문자열 = 지움). 따옴표·대시는 한 꼴로, 소프트 하이픈은 지움, 공백은 ' ', 나머지 NFKC. */
function mapChar(ch) {
  const c = ch.codePointAt(0);
  if (c === 0xAD) return '';                                                    // 소프트 하이픈
  if (c === 0x2018 || c === 0x2019 || c === 0x201A || c === 0x201B || c === 0x2032) return "'";
  if (c === 0x201C || c === 0x201D || c === 0x201E || c === 0x201F || c === 0x2033 || c === 0xAB || c === 0xBB) return '"';
  if ((c >= 0x2010 && c <= 0x2015) || c === 0x2212) return '-';                 // 하이픈·대시·빼기
  if (WS.test(ch)) return ' ';
  return ch.normalize('NFKC');
}

/**
 * 정규화 글자 + 지도. 공백은 하나로 접고 앞뒤를 뗀다. `starts[k]`·`ends[k]` = 정규화 글자 k 의 원래 [시작, 끝) 오프셋(UTF-16).
 * @returns {{s:string, starts:number[], ends:number[]}}
 */
export function normForm(text) {
  const t = String(text == null ? '' : text);
  let s = '';
  const starts = [];
  const ends = [];
  let off = 0;
  for (const ch of t) {
    const piece = mapChar(ch);
    const a = off;
    off += ch.length;
    for (const p of piece) {
      if (p === ' ' && (s === '' || s[s.length - 1] === ' ')) continue;
      s += p;
      for (let u = 0; u < p.length; u++) { starts.push(a); ends.push(off); }   // 지도는 UTF-16 단위(indexOf 와 같은 셈)
    }
  }
  while (s.endsWith(' ')) { s = s.slice(0, -1); starts.pop(); ends.pop(); }
  return { s: s, starts: starts, ends: ends };
}

/**
 * 관대한 2차 꼴 — 정규화 글자에서 구두점을 뺀다(15-1R 중간-1 고침: 뜻을 바꾸는 글자는 남긴다).
 *   · 공백은 지우지 않고 **한 칸으로 접는다**(낱말 경계 — `a symptomatic` ≠ `asymptomatic`, `3 10` ≠ `310`)
 *   · **숫자 사이의 구두점**(`7.5`·`1,500`)은 남긴다
 *   · 숫자 **앞** `-`·`+`·`±`·`.`(앞이 숫자가 아닐 때 — 부호·앞 소수점; `−` 는 `normForm` 이 `-` 로 바꿈) 남김
 *   · 숫자 **뒤** `%`·`‰` 남김 · `?`·`!` 남김(물음을 단정으로 바꾸지 못하게)
 * 지도는 원래 오프셋을 그대로 잇는다.
 */
export function looseForm(norm) {
  const n = norm || { s: '', starts: [], ends: [] };
  const a = Array.from(n.s);
  // 정규화 글자는 서로게이트 쌍일 수 있다 — 코드포인트 단위로 걷되 지도 번호(UTF-16 단위)를 함께 센다.
  let s = '';
  const starts = [];
  const ends = [];
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    const ch = a[i];
    const at = k;
    k += ch.length;
    const prev = i > 0 ? a[i - 1] : '';
    const next = i + 1 < a.length ? a[i + 1] : '';
    if (WS.test(ch)) {
      if (s && !s.endsWith(' ')) { s += ' '; starts.push(n.starts[at]); ends.push(n.ends[at]); }
      continue;
    }
    const keep = (DIGIT.test(prev) && DIGIT.test(next)) ||
      (/[-+±.]/.test(ch) && DIGIT.test(next) && !DIGIT.test(prev)) ||
      (/[%‰]/.test(ch) && DIGIT.test(prev)) || /[?!]/.test(ch);
    if (PUNCT.test(ch) && !keep) continue;
    s += ch;
    for (let u = 0; u < ch.length; u++) { starts.push(n.starts[at + u]); ends.push(n.ends[at + u]); }
  }
  while (s.endsWith(' ')) { s = s.slice(0, -1); starts.pop(); ends.pop(); }
  return { s: s, starts: starts, ends: ends };
}

/** 정규화 글자(코드포인트) 수. */
function cpLen(s) { let n = 0; for (const ch of String(s)) { if (ch) n++; } return n; }

/* ── 낱말 경계(15-2R #1 · F8) — 찾은 자리가 낱말·수 가운데서 시작·끝나면 그 자리는 근거가 못 된다 ──
   부분 문자열 일치만 보면 `ineffective`→`effective in children…`·`atypical`→`typical…`·`painless`→`…pain` 처럼
   부정 접두·접미가 떨어진 **반대 뜻** 인용이 정확 일치로 통과한다(저장·화면 인용도 그 글). 그래서 원래 글자에서 경계를 본다.
     · 앞 글자와 첫 글자가 둘 다 글자·숫자(`\p{L}\p{N}` + 결합 부호 `\p{M}` — 아랍어 하라카트는 앞 글자에 붙는다)면 가운데.
       끝 글자와 뒤 글자도 같은 식.
     · 수 사이 `.`·`,`·`٫`·`٬`(`7.5`·`1,500`·`٧٫٥`)와 글자 사이 하이픈(`-`·U+2010·U+2011 — `non-invasive`·`pain-free`)은 낱말(수)의
       일부로 본다(의료 안전 쪽: `7.5 mg`→`5 mg…`·`HIV-negative`→`…HIV`).
     · 15-2c(15-2bR #1 — 숫자에 붙은 기호에서 잘려 값이 바뀜): 수 사이 대시 `–`·`—`(`3–5`→`5`)와 글자·숫자 사이 `:`·`/`
       (`1:1000`→`1000`·`mg/kg`→`mg`)도 잇는 글자다. 수 바로 앞 부호·비교(`-`·`−`·`+`·`±`·`<`·`>`·`≤`·`≥`·`~`·`≈` — 그 앞이
       글자가 아닐 때)에서 시작하거나(`−2.5`→`2.5`) 수 바로 뒤 `%`·`‰`·`°` 앞에서 끝나면(`30%`→`30`) 가운데다.
       덧붙임: 부호 목록에 `–`·`—`(빼기로 쓰인 대시), 부호와 수 사이 공백 한 칸까지(`< 3.0`·`≥ 75`), 끝 쪽 `٪`·수 뒤 공백 한 칸 뒤
       단위(`30 %`), 수 사이 `^`(`10^9`). 대가: 문장 끝 대시(` — 5 patients`) 뒤 수로 시작하는 정당 인용도 폐기.
     · 15-2d: 수 쪽 판정은 **숫자 표현 덩어리** 하나로 정리했다(`numberSpans` — 부호 + 수·이음 + 단위 기호). 인용의 시작·끝이
       덩어리 안(처음·끝이 아닌 곳)이면 가운데 — 시작·끝 대칭(`10 – 20`→`…10`·`1.5 × 10^9`→`10^9…`·`…1.5` 도 폐기).
     · 15-2e(원문 언어 공통 표기): 수 + NBSP·얇은 공백·좁은 NBSP + 정확히 세 자리(프랑스어 천 단위 `150 000`) · 물결 범위
       `3~5`·전각 `～`·`〜` · 음수 지수 `10⁻⁹`·`10^-6` 도 덩어리 안 이음. 보통 공백 + 세 자리는 잇지 않는다(나열 `5 100`).
       글자 사이 대시는 경계다(`disease—defined`). 기호까지 넣은 인용(`(−2.5)`·`<3.0 mg`·`1:1000`)은 그대로 통과.
     · 서식 글자(`\p{Cf}` — 소프트 하이픈·ZWJ·ZWNJ·방향 표시)는 건너뛰고 본다(`Hypo+소프트하이픈+natremia` 는 한 낱말).
     · 정규화가 한 글자를 여럿으로 펼친 자리(리가처 `ﬁ`→`fi`)의 가운데서 시작·끝나면 가운데.
   문단 처음·끝·공백·구두점(`'`·`(`·`:` 등)·대시 경계는 그대로 통과한다(문장 가운데서 시작하되 낱말 처음에서 — 정당). */

const WORD = /[\p{L}\p{N}\p{M}]/u;
const FMT = /\p{Cf}/u;
const MARK = /\p{M}/u;
const HYPHEN = /^[-‐‑]$/u;
const RATIO = /^[:/]$/u;                                                  // 15-2c — 글자·숫자 사이 `mg/kg`·`1:1000`(붙음)

/** 원래 글자의 오프셋 `i` 앞(`dir` −1)·뒤(+1) 글자 최대 `n` 개(가까운 것부터) — 서식 글자(`marks` 면 결합 부호도)는 건너뛴다. */
function around(text, i, dir, n, marks) {
  const out = [];
  let k = i;
  while (out.length < n) {
    let ch;
    if (dir < 0) {
      if (k <= 0) break;
      const lo = text.charCodeAt(k - 1);
      const w = lo >= 0xDC00 && lo <= 0xDFFF && k >= 2 && (text.charCodeAt(k - 2) & 0xFC00) === 0xD800 ? 2 : 1;
      ch = text.slice(k - w, k);
      k -= w;
    } else {
      if (k >= text.length) break;
      ch = String.fromCodePoint(text.codePointAt(k));
      k += ch.length;
    }
    if (!FMT.test(ch) && !(marks && MARK.test(ch))) out.push(ch);
  }
  return out;
}

/** `j` 가 `x`·`y` 사이에서 낱말을 잇는 글자인가 — 글자·숫자 사이 하이픈·`:`·`/`(`pain-free`·`mg/kg`·`COVID-19`). 수끼리는 `numberSpans`. */
function joins(x, j, y) {
  if (!x || !j || !y) return false;
  return (HYPHEN.test(j) || RATIO.test(j)) && WORD.test(x) && WORD.test(y);
}

/* 숫자 표현 덩어리 `numberSpans`(15-2d · 15-2e)는 `text/numexpr.js` 로 옮겼다 — 16 개념도 라벨 판정과 한 벌(16-1R 중간-1). 기본 갈래 결과는 같다. */

/** 오프셋 `i` 가 숫자 표현 덩어리 **안**(덩어리의 처음·끝이 아닌 곳)인가 — 시작·끝 대칭. */
function inNumber(text, i) {
  return numberSpans(text).some((x) => x[0] < i && i < x[1]);
}

/**
 * 원래 글자의 오프셋 `i`(두 글자 사이)가 낱말(수) 안쪽인가. `end`(인용 끝)면 뒤의 결합 부호는 건너뛰고 본다 —
 * 끝 글자의 하라카트만 빠진 인용(`…للمريض` ↔ 문단 `…للمريضِ`)은 낱말을 자른 것이 아니다.
 */
function inside(text, i, end) {
  const [a, a2] = around(text, i, -1, 2);
  const [b, b2] = around(text, i, 1, 2, end);
  if (!a || !b) return false;                                  // 문단 처음·끝
  if (WORD.test(a) && WORD.test(b)) return true;
  if (inNumber(text, i)) return true;                          // 숫자 표현 덩어리 안(`−¦2.5`·`10 –¦ 20`·`1.5 × ¦10^9`·`30¦ %`)
  return joins(a2, a, b) || joins(a, b, b2);                   // 잇는 글자 바로 뒤·바로 앞
}

/** 꼴 `form` 의 `[at, at+len)` 자리가 낱말 가운데서 시작하거나 끝나는가(원래 글자 `text` 로 판정). */
function midWord(form, at, len, text) {
  const s = form.starts[at];
  const e = form.ends[at + len - 1];
  if (at > 0 && form.starts[at - 1] === s && WORD.test(text.slice(s, form.ends[at]))) return true;              // 펼친 글자 가운데서 시작
  if (at + len < form.starts.length && form.ends[at + len] === e &&
    WORD.test(text.slice(form.starts[at + len - 1], e))) return true;                                            // 펼친 글자 가운데서 끝
  return inside(text, s, false) || inside(text, e, true);
}

/**
 * 문단 하나에서 needle(같은 꼴의 정규화)의 원래 [시작, 끝) — 낱말 경계가 맞는 첫 자리. 없으면 null,
 * 일치는 있으나 모두 낱말 가운데면 `{mid:true}`.
 */
function locate(form, needle, text) {
  if (!needle.s) return null;
  const t = String(text);
  const len = needle.s.length;
  let mid = false;
  for (let at = form.s.indexOf(needle.s); at >= 0; at = form.s.indexOf(needle.s, at + 1)) {
    if (midWord(form, at, len, t)) { mid = true; continue; }
    const s = form.starts[at];
    const e = form.ends[at + len - 1];
    const quote = t.slice(s, e).trim();
    if (quote) return { start: s, end: e, quote: quote };
  }
  return mid ? { mid: true } : null;
}

/**
 * 근거 인용 찾기 — 1차(정규화 부분 문자열) 전 문단 → 2차(관대한 꼴) 전 문단. 주장한 문단(`claimed`)을 먼저 본다.
 * 낱말 가운데서 시작·끝나는 자리는 건너뛴다 — 경계 맞는 자리가 어디에도 없고 가운데 자리만 있었으면 `{mid:true}`.
 * @param {{paraId:string, pageNo:number, text:string}[]} paras 보낸 문단
 * @returns {{paraId:string, pageNo:number, quote:string, how:'exact'|'loose', at:number}|{mid:true}|null} `at` = 문단 번호
 */
export function findEvidence(paras, evidence, claimed) {
  const list = Array.isArray(paras) ? paras : [];
  const ev = normForm(evidence);
  if (!ev.s) return null;
  const evLoose = looseForm(ev);
  const order = [];
  const c = claimed == null ? '' : String(claimed);
  const ci = c ? list.findIndex((p) => p && String(p.paraId) === c) : -1;
  if (ci >= 0) order.push(ci);
  for (let i = 0; i < list.length; i++) if (i !== ci) order.push(i);
  const forms = new Map();
  const formOf = (i) => {
    if (!forms.has(i)) { const nf = normForm(list[i].text); forms.set(i, { n: nf, l: null }); }
    return forms.get(i);
  };
  let mid = false;
  for (const pass of ['exact', 'loose']) {
    if (pass === 'loose' && !evLoose.s) break;
    for (const i of order) {
      const p = list[i];
      if (!p || typeof p.text !== 'string') continue;
      const f = formOf(i);
      let hit;
      if (pass === 'exact') hit = locate(f.n, ev, p.text);
      else { if (!f.l) f.l = looseForm(f.n); hit = locate(f.l, evLoose, p.text); }
      if (hit && hit.mid) { mid = true; continue; }
      if (hit) return { paraId: String(p.paraId), pageNo: Number(p.pageNo), quote: hit.quote, how: pass, at: i };
    }
  }
  return mid ? { mid: true } : null;
}

/** 보기 글 중복 판정 꼴 — 관대한 꼴 + 소문자. */
function dupKey(s) { return looseForm(normForm(s)).s.toLowerCase(); }

/**
 * 문항 하나. 결과 꼴(저장 레코드의 알맹이 — `review/aiquiz.js` 가 id·섹션·시각을 더한다):
 * `{status:'verified'|'rejected', reason?, stem, options:[{letter,text}], answer:{letters:[X]}|null, explanation:{tr, src?},
 *   evidence, grounding:[{quote, pageNo, paraId}], pageNo, paraIds:[], fixed?, how?}`
 */
function groundOne(q, paras, allowed, withSrc, seen) {
  const x = q && typeof q === 'object' ? q : {};
  const stem = clean(x.stem);
  const rawOpts = Array.isArray(x.options) ? x.options : [];
  const options = rawOpts.map((o) => ({ letter: clean(o && o.letter).toUpperCase(), text: clean(o && o.text) }));
  const sorted = options.slice().sort((a, b) => (a.letter < b.letter ? -1 : a.letter > b.letter ? 1 : 0));
  const ans = clean(x.answer).toUpperCase();
  const ex = x.explanation && typeof x.explanation === 'object' ? x.explanation : {};
  const tr = clean(ex.tr);
  const srcEx = withSrc ? clean(ex.src) : '';
  const evidence = clean(x.evidence);
  const claimed = clean(x.evidenceParaId);
  const claimedPara = claimed ? paras.find((p) => String(p.paraId) === claimed) : null;

  const out = {
    status: 'verified', stem: stem, options: sorted,
    answer: LETTERS.indexOf(ans) >= 0 ? { letters: [ans] } : null,
    explanation: withSrc ? { tr: tr, src: srcEx } : { tr: tr },
    evidence: evidence, grounding: [],
    pageNo: claimedPara ? Number(claimedPara.pageNo) : null,
    paraIds: claimedPara ? [String(claimedPara.paraId)] : []
  };
  const reject = (reason) => Object.assign(out, { status: 'rejected', reason: reason });

  if (!stem || !tr) return reject(REASON.EMPTY);
  if (options.length !== LETTERS.length || options.some((o) => !o.text)) return reject(REASON.OPTIONS);
  if (sorted.map((o) => o.letter).join('') !== LETTERS.join('')) return reject(REASON.LETTERS);
  if (new Set(options.map((o) => dupKey(o.text))).size !== options.length) return reject(REASON.DUP);
  if (!out.answer) return reject(REASON.ANSWER);
  const texts = [stem, tr, srcEx, evidence].concat(options.map((o) => o.text));
  if (texts.some((s) => s.indexOf(REDACTED) >= 0)) return reject(REASON.REDACTED);
  const sk = dupKey(stem);
  if (seen.has(sk)) return reject(REASON.DUP_STEM);
  seen.add(sk);
  if (cpLen(normForm(evidence).s) < REVIEW.EVIDENCE_MIN) return reject(REASON.SHORT);

  const hit = findEvidence(paras, evidence, claimed);
  if (!hit) return reject(REASON.EVIDENCE);
  if (hit.mid) return reject(REASON.MID_WORD);
  out.evidence = hit.quote;
  out.grounding = [{ quote: hit.quote, pageNo: hit.pageNo, paraId: hit.paraId }];
  out.pageNo = hit.pageNo;
  out.paraIds = [hit.paraId];
  out.how = hit.how;
  if (hit.paraId !== claimed) out.fixed = true;

  const right = sorted.find((o) => o.letter === ans);
  const foreign = (s) => hasForeignNumber(s, allowed, numberTokens);
  if (foreign(right ? right.text : '') || foreign(tr) || foreign(srcEx)) return reject(REASON.DIGITS);
  return out;
}

/**
 * 10-4 자체 검증 — 응답 값 하나(`{questions:[…]}`) → 문항마다 verified/rejected.
 * @param {{paraId:string, pageNo:number, text:string}[]} items 보낸 문단(요청 DOC 와 같은 것)
 * @param {*} value `jsonrepair` 가 돌려준 값
 * @param {{withSrc?:boolean, n?:number}} [opts] `withSrc` = 원문 ≠ 대상(해설 원문 언어를 받는다) · `n` = 받을 문항 상한(기본 `REVIEW.QUIZ_N` — 넘는 것은 보지 않는다)
 * @returns {{questions:Object[], total:number, verified:number, rejected:number, weak:boolean, fixed:number}}
 */
export function groundQuiz(items, value, opts) {
  const o = opts || {};
  const withSrc = o.withSrc !== false;
  const cap = Number.isInteger(o.n) && o.n > 0 ? o.n : REVIEW.QUIZ_N;
  const paras = (Array.isArray(items) ? items : []).filter((p) => p && typeof p.text === 'string' && p.paraId != null)
    .map((p) => ({ paraId: String(p.paraId), pageNo: Number(p.pageNo), text: p.text }));
  const allowed = numberTokens(paras.map((p) => p.text).join('\n'));
  const raw = value && Array.isArray(value.questions) ? value.questions.slice(0, cap) : [];
  const seen = new Set();
  const questions = raw.map((q) => groundOne(q, paras, allowed, withSrc, seen));
  const rejected = questions.filter((q) => q.status === 'rejected').length;
  const total = questions.length;
  return {
    questions: questions,
    total: total,
    verified: total - rejected,
    rejected: rejected,
    weak: total === 0 || rejected * 2 > total,             // 폐기율 > 50%(정수 비교 — 같으면 넘지 않는다)
    fixed: questions.filter((q) => q.fixed).length
  };
}
