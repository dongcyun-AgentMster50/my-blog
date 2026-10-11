#!/usr/bin/env node
/* ============================================================
   8h Plan 측정 — 인용 단위 판별·글머리 경계·각주 기호 (2026-10-11)

     MEDREADER_PDFJS=<폴더> node apps/medreader/dev/probe-citations-8h.mjs <pdf> [시작쪽] [끝쪽] [--step N] [--seed S] [--show|--all]
     --show 표본 몇 개 · --all 표본 저장소 전부(JSON 한 줄 — 오탐 전수 검토용)

   앱의 낭독 단위(`sentenceUnits` = `buildUnits(…,'sentence')`)를 그대로 받아,
   **제안 규칙**(spec 6-6 초안 — 아직 앱 코드가 아니다)을 여기서 흉내 낸다.
     A1. 인용 단위 판별 `isCitation(src)` — 식별자(PMID/PMCID/DOI)만 / "성 이니셜 et al. 학술지" 꼴만
     A2. 참고문헌 묶음 — 머리("성 이니셜 et al. " / "성 이니셜. ")부터 닫는 조각(식별자만 / 출판 정보만)까지
     B. 글머리 기호(• ▪ ◦ ‣ ● ■ ▸ ►) 앞, 식별자 괄호 끝 뒤에서 끊으면 바뀌는 단위(=번역 캐시가 빗나가는 문장)
     C. 각주 기호(∗ * † ‡ §)가 나오는 자리의 꼴 — 단어 끝 / 줄머리 / 피연산자 사이 / 그 밖
   오탐 검토용 표본은 **40자 이하**로만 찍는다(원서 문장을 길게 옮기지 않는다).
   js/ 는 읽기만 한다.
   ============================================================ */
import { loadPdfjs, positional, pageLayout, sentenceUnits } from './measure-lib.mjs';
import { splitSentences } from '../js/text/segment.js';

const argv = process.argv;
const [file, fromArg, toArg] = positional(argv);
if (!file) { console.error('사용: probe-citations-8h.mjs <pdf> [시작쪽] [끝쪽] [--step N] [--seed S] [--show|--all]'); process.exit(2); }
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const STEP = Math.max(1, Number(opt('--step', 1)) || 1);
const SHOW = argv.includes('--show');
let seed = Number(opt('--seed', 7)) || 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

const pdfjs = await loadPdfjs(argv);
const doc = await pdfjs.getDocument({ url: file }).promise;
const from = Number(fromArg) || 1, to = Math.min(Number(toArg) || doc.numPages, doc.numPages);

/* ── A. 제안 판별식 (언어·책에 기대지 않는 꼴만) ─────────────────── */
// 식별자: [PMID: 123] · PMID 123 · PMCID: PMC123 · doi:10.1000/x · [DOI: …]
const ID_TOKEN = /\[\s*(?:PMID|PMCID|DOI)\s*:?\s*[^\]\s][^\]]*\]|\b(?:PMID|PMCID)\s*:?\s*(?:PMC)?\d{5,9}\b|\bdoi\s*:?\s*10\.\d{4,9}\/\S+/giu;
const NAME = String.raw`\p{Lu}[\p{L}'’\-]+`;
const INITIALS = String.raw`\p{Lu}{1,5}(?:-\p{Lu}{1,2})?`;                           // M · AB · RJALM · GC-Y
const AUTHOR = String.raw`${NAME}(?:[ \-]${NAME}){0,2}\s${INITIALS}`;               // Dhanasekaran M · Smith-Jones AB · Van Der Berg JA
const AUTHORS = String.raw`${AUTHOR}(?:,\s${AUTHOR}){0,5}`;
const JWORD = String.raw`(?:\p{Lu}[\p{L}'’\-]*\.?|\(\p{Lu}[\p{L} ]*\)\.?|&)`;  // J · Endocr · Soc. · (Lond). · &
const JOURNAL = String.raw`${JWORD}(?:\s${JWORD}){0,9}`;
const PUB = String.raw`\d{4}[\d\s;:().,\-–A-Za-z]{0,40}`;                          // 2024;8:bvae… (선택)
const TAIL = String.raw`(?:,?\s+${JOURNAL})?(?:[.,]?\s*${PUB})?[.,]?`;
const ETAL_SEG = new RegExp(String.raw`^${AUTHORS},?\s+et\s+al\.?${TAIL}$`, 'u');     // 성 이니셜 et al. 학술지
const AUTH_SEG = new RegExp(String.raw`^${AUTHORS}\.\s+${JOURNAL}(?:[.,]?\s*${PUB})?[.,]?$`, 'u');   // et al. 없는 저자 + 학술지 — 식별자가 같은 단위에 있을 때만
const PUNCT_ONLY = /^[\s.,;:•▪◦‣●■▸►()\[\]]*$/u;
const MAX_CITE = 200;

/** 단위 전체가 인용 조각들(식별자 · 저자-학술지)만으로 되어 있으면 그 종류, 아니면 null. */
const ID_ONLY = (t) => PUNCT_ONLY.test(String(t).replace(ID_TOKEN, ' '));
function isCitation(src) {
  const s = String(src).replace(/\s+/g, ' ').trim();
  if (!s || s.length > MAX_CITE) return null;
  let hadId = false;
  const rest = s.replace(ID_TOKEN, () => { hadId = true; return ' ; '; });
  const segs = rest.split(';').map((x) => x.replace(/^[\s•▪◦‣●■▸►.,]+|\s+$/gu, '')).filter((x) => !PUNCT_ONLY.test(x));
  if (!segs.length) return hadId ? 'id' : null;
  let etal = false;
  for (const g of segs) {
    if (ETAL_SEG.test(g)) { etal = true; continue; }
    if (hadId && AUTH_SEG.test(g)) continue;
    return null;
  }
  return etal ? (hadId ? 'etal+id' : 'etal') : (hadId ? 'id' : null);
}

/* ── B. 글머리 앞에서 끊기 ─────────────────────────────── */
const BULLET_MID = /\s(?=[•▪◦‣●■▸►]\s)/u;       // 앞에 공백이 있고 뒤에 공백이 오는 글머리 = 단위 중간의 항목 시작
// B' 식별자 괄호가 닫힌 뒤(다음 글자가 문장 시작 꼴) = 경계. "[PMID: 1] Foley L et al. …" → 둘로
const ID_CLOSE = /(?<=\[\s*(?:PMID|PMCID|DOI)\b[^\]]*\])[.;,]?\s(?=[\p{Lu}\[•▪◦‣●■▸►])/iu;
// 제목이 붙은 참고문헌 항목의 머리 — "성 이니셜 et al. <제목>…" (A2 후보, 지금 규칙은 읽는다)
const REF_HEAD = new RegExp(String.raw`^${AUTHORS},?\s+et\s+al\b`, 'u');
// A2 — 참고문헌 머리와 닫는 조각
// "Kaiser SK et al. " · "Munro MG et al; " · "Simeon R. " — 쉼표 끝은 받지 않는다("Stage III," 오탐)
const REF_START = new RegExp(String.raw`^${AUTHORS}(?:,?\s+et\s+al[.;]|\.)\s`, 'u');
const ETAL_HEAD = /\set\s+al[.;]\s/u;
const PUB_ONLY = /^\d{4}(?:\s\p{Lu}\p{Ll}{2}(?:\s\d{1,2})?)?;\s?\d+(?:\(\w+\))?(?::\s?[\w\-–]+)?\.?$/u;
const BOUNDARY = new RegExp(BULLET_MID.source + '|' + ID_CLOSE.source, 'iu');
function splitAtBullets(src) {
  const parts = String(src).split(BOUNDARY).filter((x) => x != null).map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) for (const s of splitSentences(p)) out.push(s);
  return out;
}

/* ── C. 각주 기호의 자리 ───────────────────────────────── */
const MARK = /[∗*†‡§]/gu;
function markContext(t, i) {
  const prev = i > 0 ? t[i - 1] : '';
  const next = i + 1 < t.length ? t[i + 1] : '';
  const isOperand = (c) => /[\p{L}\p{N})\]]/u.test(c);
  // 피연산자 사이: "2 * 3" · "2*3" · "a*b"
  if ((isOperand(prev) && isOperand(next)) ||
      (prev === ' ' && next === ' ' && /[\p{N})]/u.test(t[i - 2] || '') && /[\p{N}(]/u.test(t[i + 2] || ''))) return 'operand';
  // 단어 끝 각주: 앞이 글자·숫자·닫는 괄호·마침표, 뒤가 공백·끝·구두점·다른 기호
  if (/[\p{L}\p{N})\].,;:]/u.test(prev) && (next === '' || /[\s.,;:)\]∗*†‡§]/u.test(next))) return 'word-end';
  // 머리(단위 처음 또는 공백 뒤) + 뒤에 공백/글자: 각주 본문 머리 "* Data from" · "†Includes"
  if ((prev === '' || prev === ' ') && (next === '' || /[\s\p{L}]/u.test(next))) return 'lead';
  return 'other';
}

const c = {
  units: 0, chars: 0,
  citeUnits: 0, citeChars: 0, cite: { id: 0, etal: 0, 'etal+id': 0 },
  pmidAny: 0, pmidMixed: 0,           // PMID 가 든 단위 / 그중 인용만이 아닌 것(본문+PMID)
  etalShortMiss: 0,                   // 160자 미만 "et al." 단위 중 판별식이 놓친 것
  bulletUnits: 0, bulletOnly: 0, missUnits: 0, missChars: 0, mixedAfter: 0, a2Runs: 0, a2Pieces: 0, a2Chars: 0, a2Open: 0, a2NoEtal: 0, refTitle: 0, refTitleChars: 0, bulletChars: 0, bulletPieces: 0, bulletCitePieces: 0, bulletCiteChars: 0,
  marks: { operand: 0, 'word-end': 0, lead: 0, other: 0 }, markBy: {},
  pagesWithCite: 0, pagesSeen: 0,
  dashLead: 0                         // 줄머리 "– " (en dash) 줄 수
};
const S = { a2NoEtal: [], a2: [], a2Mid: [], a2Open: [], refTitle: [], mixedAfter: [], id: [], etal: [], etalid: [], miss: [], mixed: [], bullet: [], markOther: [], markOperand: [], markLead: [], markWord: [] };
const push = (arr, s, n = 400) => { if (arr.length < n) arr.push(s); else { const k = Math.floor(rnd() * (arr.length + 1)); if (k < n) arr[k] = s; } };
const cut = (s) => String(s).replace(/\s+/g, ' ').slice(0, 40);

for (let p = from; p <= to; p += STEP) {
  const { L } = await pageLayout(doc, p);
  c.pagesSeen++;
  for (const ln of L.lines) if (/^[–—]\s/.test(String(ln.text || ''))) c.dashLead++;
  let hit = false;
  const pieces = [];   // A2 — 쪽 안의 조각 열(B·B' 로 끊은 뒤) {t, para, cite}
  for (const u of sentenceUnits(L)) {
    if (u.part !== 0) continue;                    // 300자 조각은 문장 하나로 센다
    const t = String(u.src || u.text).trim();
    if (!t) continue;
    c.units++; c.chars += t.length;

    const kind = isCitation(t);
    if (kind) {
      c.citeUnits++; c.citeChars += t.length; c.cite[kind]++; hit = true;
      push(kind === 'id' ? S.id : kind === 'etal' ? S.etal : S.etalid, p + ': ' + cut(t));
    } else if (/\bet al\b/i.test(t) && t.length < MAX_CITE && !/\b\p{Ll}{4,}\b/u.test(t.replace(/\bet al\b/gi, ''))) {
      // 소문자 낱말(4자+)이 없는데도 놓친 "et al." 단위 — 미탐 후보
      c.etalShortMiss++; push(S.miss, p + ': ' + cut(t), 80);
    }
    if (/PMID/i.test(t)) { c.pmidAny++; if (!kind) { c.pmidMixed++; push(S.mixed, p + ': …' + cut(t.slice(Math.max(0, t.search(/PMID/i) - 30)))); } }

    for (const pc of (BOUNDARY.test(t) ? splitAtBullets(t) : [t])) pieces.push({ t: pc, para: u.paraId, cite: !!isCitation(pc) });
    if (BOUNDARY.test(t)) {
      c.bulletUnits++; c.bulletChars += t.length;
      if (BULLET_MID.test(t)) c.bulletOnly++;
      if (!kind) { c.missUnits++; c.missChars += t.length; }   // 번역 캐시가 빗나가는 문장(지금 번역 대상인데 src 가 바뀐다)
      const pieces = splitAtBullets(t);
      c.bulletPieces += pieces.length;
      for (const pc of pieces) {
        if (isCitation(pc)) { c.bulletCitePieces++; c.bulletCiteChars += pc.length; }
        else if (REF_HEAD.test(pc)) { c.refTitle++; c.refTitleChars += pc.length; push(S.refTitle, p + ': ' + cut(pc), 200); }
        else if (/PMID/i.test(pc)) { c.mixedAfter++; push(S.mixedAfter, p + ': …' + cut(pc.slice(Math.max(0, pc.search(/PMID/i) - 30))), 60); }
      }
      push(S.bullet, p + ': ' + cut(t), 40);
    } else if (/PMID/i.test(t) && !kind) { c.mixedAfter++; push(S.mixedAfter, p + ': …' + cut(t.slice(Math.max(0, t.search(/PMID/i) - 30))), 60); }

    MARK.lastIndex = 0;
    let m;
    while ((m = MARK.exec(t))) {
      const k = markContext(t, m.index);
      c.marks[k]++;
      c.markBy[m[0] + ' ' + k] = (c.markBy[m[0] + ' ' + k] || 0) + 1;
      const around = t.slice(Math.max(0, m.index - 18), m.index + 18);
      if (k === 'other') push(S.markOther, p + ': ' + cut(around), 30);
      if (k === 'operand') push(S.markOperand, p + ': ' + cut(around), 30);
      if (k === 'lead') push(S.markLead, p + ': ' + cut(around), 20);
      if (k === 'word-end') push(S.markWord, p + ': ' + cut(around), 20);
    }
  }
  // A2 — 참고문헌 묶음: 머리(성 이니셜 [et al.] + . 또는 ;) 부터 닫는 조각(식별자만 / 출판 정보만)까지, 같은 문단, 최대 5조각·400자
  for (let i = 0; i < pieces.length; i++) {
    const h = pieces[i];
    if (h.cite || !REF_START.test(h.t)) continue;
    let n = h.t.length, j = i + 1, closed = -1;
    if (PUB_ONLY.test(h.t.split(' ').slice(-1)[0] || '')) closed = i;
    for (; closed < 0 && j < pieces.length && j <= i + 4 && pieces[j].para === h.para; j++) {
      n += pieces[j].t.length; if (n > 400) break;
      if (PUB_ONLY.test(pieces[j].t) || (pieces[j].cite && ID_ONLY(pieces[j].t))) { closed = j; break; }
      if (pieces[j].cite) break;                  // 사이에 다른 인용(et al. 학술지)이 끼면 묶음이 아니다
    }
    if (closed < 0) { c.a2Open++; push(S.a2Open, p + ': ' + cut(h.t), 60); continue; }
    let chars = 0; for (let k = i; k <= closed; k++) if (!pieces[k].cite) { chars += pieces[k].t.length; c.a2Pieces++; }
    c.a2Runs++; c.a2Chars += chars; if (!ETAL_HEAD.test(h.t)) { c.a2NoEtal++; push(S.a2NoEtal, p + ': ' + cut(h.t) + ' | ' + (closed - i + 1), 200); }
    push(S.a2, p + ': ' + cut(h.t) + ' | ' + (closed - i + 1) + ' | ' + cut(pieces[closed].t), 300);
    for (let k = i + 1; k < closed; k++) push(S.a2Mid, p + ': ' + cut(pieces[k].t), 300);
    i = closed;
  }
  if (hit) c.pagesWithCite++;
  if (c.pagesSeen % 200 === 0) console.error('…' + p + '쪽');
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(2) + '%' : '-');
console.log(`쪽 ${from}–${to} (간격 ${STEP}, ${c.pagesSeen}쪽) · 문장 단위 ${c.units} · 글자 ${c.chars}`);
console.log(`A 인용 단위 ${c.citeUnits} (${pct(c.citeUnits, c.units)}) · 글자 ${c.citeChars} (${pct(c.citeChars, c.chars)}) · 내역 ${JSON.stringify(c.cite)} · 인용 있는 쪽 ${c.pagesWithCite} (${pct(c.pagesWithCite, c.pagesSeen)})`);
console.log(`A PMID 든 단위 ${c.pmidAny} · 그중 인용만이 아닌 것 ${c.pmidMixed}`);
console.log(`A 미탐 후보(소문자 낱말 없는 짧은 et al. 인데 판별 안 됨) ${c.etalShortMiss}`);
console.log(`B 단위 중간 글머리 ${c.bulletUnits} 단위 (${pct(c.bulletUnits, c.units)}) · 글자 ${c.bulletChars} (${pct(c.bulletChars, c.chars)}) → 조각 ${c.bulletPieces} · 그중 인용 ${c.bulletCitePieces} (글자 ${c.bulletCiteChars})`);
console.log(`B (글머리만 ${c.bulletOnly} 단위) · 끊은 뒤에도 PMID 가 본문과 붙은 조각 ${c.mixedAfter}`);
console.log(`B 캐시 빗나감(지금 번역 대상인데 src 가 바뀌는 단위) ${c.missUnits} (${pct(c.missUnits, c.units)}) · 글자 ${c.missChars} (${pct(c.missChars, c.chars)})`);
console.log(`A2 후보(끊은 뒤 "성 이니셜 et al. 제목…" 조각 — 지금 규칙은 읽는다) ${c.refTitle} · 글자 ${c.refTitleChars}`);
console.log(`A2 참고문헌 묶음 ${c.a2Runs} 묶음 · 인용 아닌 조각 ${c.a2Pieces} · 글자 ${c.a2Chars} (${pct(c.a2Chars, c.chars)}) · 머리는 있는데 닫히지 않음 ${c.a2Open} · et al. 없는 머리 ${c.a2NoEtal}`);
console.log(`B 줄머리 "– " 줄 ${c.dashLead}`);
console.log(`C 기호 자리 ${JSON.stringify(c.marks)}`);
console.log(`C 기호별 ${JSON.stringify(c.markBy)}`);
if (argv.includes('--all')) console.log(JSON.stringify(S));
else if (SHOW) {
  const pick = (arr, n) => arr.slice().sort(() => rnd() - 0.5).slice(0, n);
  console.log(JSON.stringify({
    id: pick(S.id, 15), etal: pick(S.etal, 60), etalid: pick(S.etalid, 15), miss: pick(S.miss, 30), mixed: pick(S.mixed, 20),
    bullet: pick(S.bullet, 15), mixedAfter: pick(S.mixedAfter, 20), refTitle: pick(S.refTitle, 10), a2: pick(S.a2, 30), a2Mid: pick(S.a2Mid, 40), a2Open: pick(S.a2Open, 30), a2NoEtal: pick(S.a2NoEtal, 40), markWord: pick(S.markWord, 15), markLead: pick(S.markLead, 15), markOperand: pick(S.markOperand, 20), markOther: pick(S.markOther, 20)
  }, null, 1));
}
