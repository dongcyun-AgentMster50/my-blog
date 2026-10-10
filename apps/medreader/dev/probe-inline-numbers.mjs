#!/usr/bin/env node
/* ============================================================
   본문 줄 사이에 끼어드는 숫자(여백 줄번호·표식) 조사

     MEDREADER_PDFJS=<폴더> node apps/medreader/dev/probe-inline-numbers.mjs <pdf> <쪽> [쪽…]

   2026-10-05 운영자가 CMDT 2026 37쪽 리플로우에서 "ankle 1654 arthritis",
   "brac- 1653 ing" 처럼 줄마다 1씩 줄어드는 4자리 숫자를 보았다. 낭독에도 읽힌다.
   숫자 아이템의 위치·크기·폰트를 본문과 비교하고, 레이아웃이 그것을 어느 줄에 붙였는지 본다.
   원서 문장은 40자까지만 출력한다.
   ============================================================ */
import { loadPdfjs, positional, pageLayout } from './measure-lib.mjs';

const [file, ...pages] = positional(process.argv);
if (!file || !pages.length) { console.error('사용: probe-inline-numbers.mjs <pdf> <쪽> [쪽…]'); process.exit(2); }
const pdfjs = await loadPdfjs(process.argv);
const doc = await pdfjs.getDocument({ url: file }).promise;
const NUM = /^\s*\d{3,5}\s*$/;
const size = (it) => Math.hypot(it.transform[0], it.transform[1]);
const r1 = (x) => Math.round(x * 10) / 10;

for (const ps of pages) {
  const p = Number(ps);
  const { L, tc, size: pg } = await pageLayout(doc, p);
  const nums = tc.items.filter((it) => NUM.test(it.str));
  const body = tc.items.filter((it) => it.str.trim().length > 3 && !NUM.test(it.str));
  const bs = body.map(size).sort((a, b) => a - b);
  const fontCount = {};
  for (const it of body) fontCount[it.fontName] = (fontCount[it.fontName] || 0) + 1;
  const xs = nums.map((it) => it.transform[4]);
  console.log(`\n── ${p}쪽 ${Math.round(pg.width)}x${Math.round(pg.height)} · 아이템 ${tc.items.length} · 숫자 아이템 ${nums.length}`);
  console.log(`  본문 크기 중앙값 ${r1(bs[bs.length >> 1] || 0)} · 본문 폰트 상위 ${JSON.stringify(Object.entries(fontCount).sort((a, b) => b[1] - a[1]).slice(0, 2))}`);
  if (nums.length) {
    console.log(`  숫자 x 범위 ${r1(Math.min(...xs))}~${r1(Math.max(...xs))} (쪽 폭 ${Math.round(pg.width)})`);
    for (const it of nums.slice(0, 6)) {
      console.log(`  "${it.str.trim()}" x=${r1(it.transform[4])} y=${r1(it.transform[5])} 크기=${r1(size(it))} w=${r1(it.width)} font=${it.fontName} ${(tc.styles[it.fontName] || {}).fontFamily || ''}`);
    }
  }
  console.log(`  bboxDegenerate ${L.stats.bboxDegenerate} · 컬럼 ${JSON.stringify(L.columns && L.columns.count)}`);
  const hit = L.lines.filter((l) => nums.some((it) => l.text.includes(it.str.trim())) && /[a-z]{3}/.test(l.text));
  console.log(`  숫자가 섞인 본문 줄 ${hit.length}/${L.lines.length}`);
  for (const l of hit.slice(0, 4)) {
    const n = nums.find((it) => l.text.includes(it.str.trim())).str.trim();
    const at = l.text.indexOf(n);
    console.log(`   [${l.role} col=${l.col}] …${l.text.slice(Math.max(0, at - 18), at + n.length + 18)}…`);
  }
}
