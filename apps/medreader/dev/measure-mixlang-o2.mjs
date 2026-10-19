/* ============================================================
   MedReader — O2 문장별 글자 체계(스크립트) 판별 시제품 · 측정 (spec 19-1-2, Plan 2026-10-19)

   앱 코드는 읽기만 한다. 아래 `unitLang` 은 **시제품**이다(Build 가 `text/lang.js` 에 옮길 후보).
   두 가지를 한다:
     1. 합성 예시(영한·영아·영불 혼합, 짧은 단위·숫자·약어)를 판별해 기대값과 비교한다.
     2. 실제 책(단일 언어)을 앱과 같은 낭독 단위로 나눠, 문서 언어와 **다르게** 판별되는 단위 수를 센다
        (= 단일 언어 책에서 목소리가 잘못 바뀌는 횟수. 0 이어야 한다).

     MEDREADER_PDFJS=<pdf.mjs> node apps/medreader/dev/measure-mixlang-o2.mjs [<pdf> --doc-lang en --step k]
   원서 문장은 출력하지 않는다(다르게 판별된 단위는 앞 40자까지만, 최대 10개).
   ============================================================ */

import fs from 'node:fs';
import { loadPdfjs, positional, pageLayout, sentenceUnits } from './measure-lib.mjs';

/* ── 시제품 규칙 ───────────────────────────────────────── */
// 글자 체계 → 말할 언어. 이 표에 없는 체계(그리스 문자 α·β, 한자, 가나 …)는 **중립** — 세지 않는다.
const SCRIPT_LANG = { hangul: 'ko', arabic: 'ar', latin: null /* 라틴은 문서 언어 또는 en */ };
const LATIN_DOC = new Set(['en', 'fr']);
const RULE = { MIN_LETTERS: 2, MIN_SHARE_NUM: 3, MIN_SHARE_DEN: 5 /* 0.6 */ };

const RE = {
  hangul: /\p{Script=Hangul}/u, arabic: /\p{Script=Arabic}/u, latin: /\p{Script=Latin}/u, letter: /\p{L}/u
};
function scriptOf(ch) {
  if (!RE.letter.test(ch)) return null;
  if (RE.hangul.test(ch)) return 'hangul';
  if (RE.arabic.test(ch)) return 'arabic';
  if (RE.latin.test(ch)) return 'latin';
  return 'other';
}

/** 같은 체계 글자가 이어진 덩어리(낱말 비슷한 것)의 수와 글자 수. */
export function scriptRuns(text) {
  const runs = { hangul: 0, arabic: 0, latin: 0 };
  const letters = { hangul: 0, arabic: 0, latin: 0 };
  let prev = null;
  for (const ch of String(text || '')) {
    const s = scriptOf(ch);
    if (s && s !== 'other') {
      letters[s]++;
      if (s !== prev) runs[s]++;
    }
    prev = s && s !== 'other' ? s : (s === 'other' ? 'other' : null);
  }
  return { runs, letters };
}

/**
 * 단위 하나의 말할 언어. 문서 언어와 같으면 `null`(예외 없음). 판단 못 하면 `null`.
 * @param {string} src  Unit.src
 * @param {string} docLang  documents.lang (en|fr|ko)
 */
export function unitLang(src, docLang) {
  const { runs, letters } = scriptRuns(src);
  const total = letters.hangul + letters.arabic + letters.latin;
  if (total < RULE.MIN_LETTERS) return null;                      // "A", "(b)", "12." — 물려받기(호출자)
  const nRuns = runs.hangul + runs.arabic + runs.latin;
  let best = null; let bestN = 0; let tie = false;
  for (const s of ['hangul', 'arabic', 'latin']) {
    if (runs[s] > bestN) { best = s; bestN = runs[s]; tie = false; } else if (runs[s] === bestN && bestN > 0) tie = true;
  }
  if (!best || tie) return null;
  if (bestN * RULE.MIN_SHARE_DEN < nRuns * RULE.MIN_SHARE_NUM) return null;   // 60% 미만 — 섞였다, 문서 언어로
  let lang = SCRIPT_LANG[best];
  if (best === 'latin') lang = LATIN_DOC.has(docLang) ? docLang : 'en';      // ko 문서 안 라틴 = en [가정]
  return lang === docLang ? null : lang;
}

/* ── 1. 합성 예시 ──────────────────────────────────────── */
const SYN = [
  // [문서 언어, 단위, 기대]
  ['en', 'The patient was treated with methotrexate.', null],
  ['en', '이 문장은 현재완료를 씁니다.', 'ko'],
  ['en', 'ADHD는 주의력 결핍 장애다.', 'ko'],
  ['en', 'Use despite + 명사', null],
  ['en', '예: I have lived here since 2010.', null],
  ['en', '(b)', null],
  ['en', '12.5 mg/kg', null],
  ['en', 'α-blockers and β-blockers', null],
  ['en', '참고', 'ko'],
  ['en', 'Note 참고: see Unit 12', null],
  ['en', 'التهاب المفاصل الروماتويدي', 'ar'],
  ['en', 'Rheumatoid arthritis (التهاب المفاصل)', null],
  ['ko', 'She has been working since morning.', 'en'],
  ['ko', '그녀는 아침부터 일하고 있다.', null],
  ['ko', 'since 는 시점, for 는 기간을 나타낸다.', null],
  ['ko', '학교(學校)에 갔다.', null],
  ['fr', 'Le patient a été traité.', null],
  ['fr', '환자는 치료를 받았다.', 'ko']
];
let ok = 0; const bad = [];
for (const [dl, s, want] of SYN) {
  const got = unitLang(s, dl);
  if (got === want) ok++; else bad.push({ dl, s, want, got, runs: scriptRuns(s).runs });
}
console.log(JSON.stringify({ synthetic: { total: SYN.length, ok, bad } }, null, 1));

/* ── 2. 실제 책 ────────────────────────────────────────── */
const argv = process.argv;
const file = positional(argv)[0];
if (file) {
  const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const docLang = opt('--doc-lang', 'en');
  const step = Math.max(1, Number(opt('--step', 5)) || 5);
  const from = Number(opt('--from', 1)) || 1;
  const pdfjs = await loadPdfjs(argv);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  const t0 = Date.now();
  let pagesSeen = 0; let units = 0; let switched = 0; let tMs = 0;
  const byLang = {}; const examples = [];
  const to = Math.min(doc.numPages, Number(opt('--to', doc.numPages)) || doc.numPages);
  for (let p = from; p <= to; p += step) {
    const { L } = await pageLayout(doc, p);
    const us = sentenceUnits(L);
    pagesSeen++;
    const seen = new Set();
    for (const u of us) {
      if (seen.has(u.src)) continue;      // 300자 조각은 문장 하나로
      seen.add(u.src);
      units++;
      const a = performance.now();
      const l = unitLang(u.src, docLang);
      tMs += performance.now() - a;
      if (l) {
        switched++; byLang[l] = (byLang[l] || 0) + 1;
        if (examples.length < 10) examples.push({ p, lang: l, head: u.src.slice(0, 40) });
      }
    }
  }
  console.log(JSON.stringify({ book: file.split(/[\\/]/).pop(), docLang, step, pagesSeen, units, switched, byLang, examples, unitLangMsTotal: +tMs.toFixed(1), totalMs: Date.now() - t0 }, null, 1));
  await doc.destroy();
}
