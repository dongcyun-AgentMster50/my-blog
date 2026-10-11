#!/usr/bin/env node
/* ============================================================
   인용 꼬리가 낭독 단위가 되는 빈도 (2026-10-11, Nour 녹화 영상에서 발견)

     MEDREADER_PDFJS=<폴더> node apps/medreader/dev/probe-citations.mjs <pdf> [시작쪽] [끝쪽]

   CMDT 표 "Key/New Advances" 의 한 칸이 본문 문장 + "Dhanasekaran M et al. J Endocr Soc."
   + "[PMID: 39502476]" 세 단위로 나뉘어, 인용 둘이 원문·아랍어로 따로 낭독됐다.
   앱과 같은 낭독 단위(`sentenceUnits`)를 세어, 인용만으로 된 단위가 얼마나 되는지 본다.
   원서 문장은 40자 이하로만 찍는다.
   ============================================================ */
import { loadPdfjs, positional, pageLayout, sentenceUnits } from './measure-lib.mjs';

const [file, fromArg, toArg] = positional(process.argv);
if (!file) { console.error('사용: probe-citations.mjs <pdf> [시작쪽] [끝쪽]'); process.exit(2); }
const pdfjs = await loadPdfjs(process.argv);
const doc = await pdfjs.getDocument({ url: file }).promise;
const from = Number(fromArg) || 1, to = Math.min(Number(toArg) || doc.numPages, doc.numPages);

const PMID = /^\[?\s*PMID:?\s*\d{5,9}\s*\]?\.?$/i;          // "[PMID: 39502476]"
const ETAL = /\bet al\b\.?/i;                                // "Dhanasekaran M et al. J Endocr Soc."
const LONGNUM = /\d{5,}/;                                    // 다섯 자리 이상 숫자(아랍어로 읽으면 긴 수사)

const c = { units: 0, chars: 0, pmid: 0, pmidChars: 0, etal: 0, etalChars: 0, longnum: 0, pagesWith: 0 };
const samples = { pmid: [], etal: [], longnum: [] };
for (let p = from; p <= to; p++) {
  const { L } = await pageLayout(doc, p);
  let hit = false;
  for (const u of sentenceUnits(L)) {
    const t = u.text.trim();
    c.units++; c.chars += t.length;
    if (PMID.test(t)) { c.pmid++; c.pmidChars += t.length; hit = true; if (samples.pmid.length < 3) samples.pmid.push(p + ': ' + t.slice(0, 40)); continue; }
    // 짧은(120자 미만) "et al." 단위만 인용으로 친다 — 본문 문장 안의 "et al." 은 빼려고.
    if (ETAL.test(t) && t.length < 120) { c.etal++; c.etalChars += t.length; hit = true; if (samples.etal.length < 5) samples.etal.push(p + ': ' + t.slice(0, 40)); continue; }
    if (LONGNUM.test(t)) { c.longnum++; if (samples.longnum.length < 5) samples.longnum.push(p + ': ' + t.slice(0, 40)); }
  }
  if (hit) c.pagesWith++;
  if (p % 200 === 0) console.error('…' + p + '쪽');
}
const pct = (a, b) => (b ? (100 * a / b).toFixed(2) + '%' : '-');
console.log(`쪽 ${from}–${to} · 단위 ${c.units} · 글자 ${c.chars}`);
console.log(`PMID 단위 ${c.pmid} (${pct(c.pmid, c.units)}) · 글자 ${c.pmidChars}`);
console.log(`et al. 인용 단위 ${c.etal} (${pct(c.etal, c.units)}) · 글자 ${c.etalChars}`);
console.log(`인용 단위가 있는 쪽 ${c.pagesWith}`);
console.log(`그 밖에 다섯 자리 이상 숫자가 든 단위 ${c.longnum}`);
console.log(JSON.stringify(samples, null, 1));
