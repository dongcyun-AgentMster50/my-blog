#!/usr/bin/env node
/* ============================================================
   8h-1 측정 — 앱의 인용·글머리·각주 기호 규칙을 실제 책에 돌린다 (2026-10-11)

     MEDREADER_PDFJS=<폴더> node apps/medreader/dev/measure-cite-8h.mjs <pdf> [시작쪽] [끝쪽] [--page N]
     --page N   그 쪽의 낭독 단위 목록(40자 이하)만 찍는다 — cite 표시·발화에 ∗ 가 남았는지
     --all      오탐 검토용 표본을 JSON 한 줄로 더 찍는다(40자 이하): A1 et al. 전부 · A2 묶음(무작위 200) · et al. 없는 A2 머리 전부

   Plan 의 `probe-citations-8h.mjs` 는 규칙을 **흉내** 냈다. 이 스크립트는 **앱 코드**를 그대로 쓴다:
     · 앱 쪽 수치 — `sentenceUnits`(= 앱 `buildUnits(…,'sentence')`) 결과의 `Unit.cite`
     · Plan 과 같은 칸 — 8h 이전 분할(아래 `legacySplit` — 7c/8h 이전 사본)로 만든 문장에 **앱의**
       `citationKind`·`splitSentences`·`referenceRuns` 를 적용해 Plan 의 A1 · B · A2 칸을 같은 정의로 센다.
   js/ 는 읽기만 한다. 원서 문장은 40자 이하로만 찍는다.
   ============================================================ */
import { loadPdfjs, positional, pageLayout, sentenceUnits } from './measure-lib.mjs';
import { splitSentences, endsSentence } from '../js/text/segment.js';
import { citationKind, referenceRuns, isReferenceHead } from '../js/text/cite.js';
import { joinPieces, speechMarks } from '../js/tts/text.js';
import { SPEECH_MARKS } from '../js/config.js';

const argv = process.argv;
const [file, fromArg, toArg] = positional(argv);
if (!file) { console.error('사용: measure-cite-8h.mjs <pdf> [시작쪽] [끝쪽] [--page N]'); process.exit(2); }
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = Number(opt('--page', 0)) || 0;
const ALL = argv.includes('--all');
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const S = { etal: [], a2: [], a2NoEtal: [] };
const push = (arr, x, n) => { if (arr.length < n) arr.push(x); else { const k = Math.floor(rnd() * (arr.length + 1)); if (k < n) arr[k] = x; } };
const PUB_ALONE = /^\d{4}(?:\s\p{Lu}\p{Ll}{2}(?:\s\d{1,2})?)?;\s?\d+(?:\(\w+\))?(?::\s?[\w\-–]+)?\.?$/u;

const pdfjs = await loadPdfjs(argv);
const doc = await pdfjs.getDocument({ url: file }).promise;
const from = ONLY || Number(fromArg) || 1;
const to = ONLY || Math.min(Number(toArg) || doc.numPages, doc.numPages);
const cut = (s) => String(s).replace(/\s+/g, ' ').slice(0, 40);

/* 8h 이전 분할 — tests/srclang-7c.test.mjs 의 legacySplit 과 같은 사본. */
function legacySplit(text) {
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
    if (!/[A-Z0-9(\[«"“']/.test(next)) continue;
    out.push(head.trim());
    start = j + 1;
  }
  const tail = t.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

const MARKS = new Set(SPEECH_MARKS);
const countMarks = (s) => { let n = 0; for (const ch of String(s)) if (MARKS.has(ch)) n++; return n; };

const c = {
  pages: 0,
  // 앱 쪽(8h 뒤 실제 큐)
  appUnits: 0, appChars: 0, appCite: 0, appCiteChars: 0, appPagesWithCite: 0, appSpokenMarkStar: 0,
  // Plan 칸(8h 이전 문장 위에서)
  units: 0, chars: 0, a1: 0, a1Chars: 0, a1Kind: { id: 0, etal: 0, 'etal+id': 0 },
  bUnits: 0, bPieces: 0, bCite: 0, bCiteChars: 0, bMiss: 0, bMissChars: 0, bBulletOnly: 0,
  a2Runs: 0, a2Pieces: 0, a2Chars: 0, a2Open: 0,
  marks: 0, marksKept: 0,
  pubAloneRead: 0                     // 출판 정보만인 문장인데 읽는 것(앞 문장이 A1 인용 — 미탐 기록)
};

for (let p = from; p <= to; p++) {
  const { L } = await pageLayout(doc, p);
  c.pages++;
  // ── 앱 쪽 ──
  const units = sentenceUnits(L);
  let pageCite = false;
  for (const u of units) {
    if (u.part !== 0) continue;
    const t = String(u.src).trim();
    if (!t) continue;
    c.appUnits++; c.appChars += t.length;
    if (u.cite) { c.appCite++; c.appCiteChars += t.length; pageCite = true; }
    else if (PUB_ALONE.test(t)) c.pubAloneRead++;
    if (ALL && u.cite && /\bet al\b/.test(t) && citationKind(t)) S.etal.push(p + ': ' + cut(t));
    c.marks += countMarks(t); c.marksKept += countMarks(speechMarks(t));
  }
  for (const u of units) if (u.text.indexOf('\u2217') >= 0) c.appSpokenMarkStar++;
  if (pageCite) c.appPagesWithCite++;
  if (ONLY) {
    for (const u of units) console.log((u.cite ? 'cite ' : '     ') + String(u.seg).padStart(4) + ' │ ' + cut(u.src) + (u.text.indexOf('\u2217') >= 0 ? '  ← 발화에 ∗' : ''));
  }

  // ── Plan 칸 ──
  const byId = new Map(L.lines.map((l) => [l.id, l]));
  for (const pa of L.paragraphs) {
    const lines = pa.lineIds.map((id) => byId.get(id)).filter(Boolean)
      .map((l) => ({ id: l.id, text: l.text, hyphen: l.hyphenJoin ? 'hidden' : 'none' }));
    if (!lines.length) continue;
    const joined = joinPieces(lines).text;
    for (const t0 of legacySplit(joined)) {
      const t = t0.trim();
      if (!t) continue;
      c.units++; c.chars += t.length;
      const k = citationKind(t);
      if (k) { c.a1++; c.a1Chars += t.length; c.a1Kind[k]++; }
      const pieces = splitSentences(t);
      if (pieces.length > 1) {
        c.bUnits++; c.bPieces += pieces.length;
        if (/\s[•▪◦‣●■▸►]\s/u.test(t)) c.bBulletOnly++;
        if (!k) { c.bMiss++; c.bMissChars += t.length; }
        for (const pc of pieces) if (citationKind(pc)) { c.bCite++; c.bCiteChars += pc.length; }
      }
    }
    // A2 — 앱 분할(8h 뒤) 문장 위에서
    const sents = splitSentences(joined);
    const runs = referenceRuns(sents);
    const inRun = new Set();
    for (const r of runs) {
      c.a2Runs++;
      for (let i = r.from; i <= r.to; i++) { inRun.add(i); if (!citationKind(sents[i])) { c.a2Pieces++; c.a2Chars += sents[i].length; } }
      if (ALL) {
        const row = p + ': ' + cut(sents[r.from]) + ' | ' + (r.to - r.from + 1) + ' | ' + cut(sents[r.to]);
        push(S.a2, row, 200);
        if (!/\set\s+al[.;]\s/u.test(sents[r.from])) S.a2NoEtal.push(row);
      }
    }
    for (let i = 0; i < sents.length; i++) if (!inRun.has(i) && isReferenceHead(sents[i])) c.a2Open++;
  }
  if (!ONLY && c.pages % 200 === 0) console.error('…' + p + '쪽');
}

if (!ONLY) {
  const pct = (a, b) => (b ? (100 * a / b).toFixed(2) + '%' : '-');
  console.log(`쪽 ${from}–${to} (${c.pages}쪽)`);
  console.log(`[앱] 문장 단위 ${c.appUnits} · 글자 ${c.appChars} · cite ${c.appCite} (${pct(c.appCite, c.appUnits)}) · 글자 ${c.appCiteChars} (${pct(c.appCiteChars, c.appChars)}) · 인용 있는 쪽 ${c.appPagesWithCite} · 발화에 ∗ 남은 단위 ${c.appSpokenMarkStar}`);
  console.log(`[Plan 칸] 8h 이전 문장 ${c.units} · 글자 ${c.chars}`);
  console.log(`  A1 ${c.a1} (${pct(c.a1, c.units)}) · 글자 ${c.a1Chars} · ${JSON.stringify(c.a1Kind)}`);
  console.log(`  B 바뀌는 단위 ${c.bUnits} → 조각 ${c.bPieces} · 그중 인용 ${c.bCite} (글자 ${c.bCiteChars}) · 글머리 포함 ${c.bBulletOnly} · 캐시 빗나감 ${c.bMiss} (글자 ${c.bMissChars}, ${pct(c.bMissChars, c.chars)})`);
  console.log(`  A2 묶음 ${c.a2Runs} · 인용 아닌 조각 ${c.a2Pieces} · 글자 ${c.a2Chars} (${pct(c.a2Chars, c.chars)}) · 닫히지 않은 머리 ${c.a2Open}`);
  console.log(`  C 기호 ${c.marks} · 남김(피연산자) ${c.marksKept} · 지움 ${c.marks - c.marksKept}`);
  console.log(`[미탐 기록] 출판 정보만인데 읽는 문장 ${c.pubAloneRead}`);
  if (ALL) console.log(JSON.stringify(S));
}
