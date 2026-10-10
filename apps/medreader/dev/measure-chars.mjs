#!/usr/bin/env node
/* ============================================================
   쪽당 "낭독 동반 번역이 보낼 글자 수"와 6,000자 청크 호출 수 (spec 7-8-3)

     MEDREADER_PDFJS=<폴더> node apps/medreader/dev/measure-chars.mjs <pdf> [stride=5]

   앱의 buildUnits(문장)를 그대로 거친 글자 수를 잰다. 2026-09-28 실측:
   CMDT 2026 평균 4,511 · Harrison 4,031 · CMDT 2021 1,907 (인계 문서).
   ============================================================ */
import { loadPdfjs, positional, pageLayout, sentenceUnits } from './measure-lib.mjs';

const MAX = 6000;
const [file, strideArg] = positional(process.argv);
if (!file) { console.error('사용: measure-chars.mjs <pdf> [stride]'); process.exit(2); }
const stride = Number(strideArg || 5);
const pdfjs = await loadPdfjs(process.argv);
const doc = await pdfjs.getDocument({ url: file }).promise;

const chars = [], units = [], calls = [];
for (let p = 1; p <= doc.numPages; p += stride) {
  const { L } = await pageLayout(doc, p);
  const U = sentenceUnits(L);
  let c = 0, n = U.length ? 1 : 0, acc = 0;
  for (const u of U) {
    const k = u.text.length; c += k;
    if (acc + k > MAX && acc > 0) { n++; acc = 0; }
    acc += k;
  }
  chars.push(c); units.push(U.length); calls.push(n);
}
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
console.log(JSON.stringify({
  전체쪽: doc.numPages, 표본쪽: chars.length, '빈 쪽(0자)': chars.filter((c) => c === 0).length,
  '쪽당 글자 평균': avg(chars), 중앙값: q(chars, .5), p90: q(chars, .9), 최대: Math.max(...chars),
  '6000자 초과 쪽 %': +(100 * chars.filter((c) => c > MAX).length / chars.length).toFixed(1),
  '쪽당 문장 평균': avg(units),
  '책 전체 글자(추정)': Math.round(avg(chars) * doc.numPages)
}, null, 1));
