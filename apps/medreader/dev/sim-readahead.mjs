#!/usr/bin/env node
/* ============================================================
   낭독 동반 번역의 선행 창 시뮬레이션 (spec 7-8-3 refill 규칙)

     MEDREADER_PDFJS=<폴더> node apps/medreader/dev/sim-readahead.mjs <pdf> <시작쪽> <끝쪽>

   연속 쪽의 실제 문장 흐름에 refill 규칙을 돌려, 창 설정별 호출 수·청크 크기·
   "도착했는데 번역이 없는 문장" 수를 비교한다. 응답 지연은 0 으로 가정한다.
   2026-09-28 결과(인계 문서): 창 9,000·3,000 남으면 보냄 → 두 CMDT 모두 1만 자당 1.7회, 늦음 0.
   ============================================================ */
import { loadPdfjs, positional, pageLayout, sentenceUnits } from './measure-lib.mjs';

const [file, fromArg, toArg] = positional(process.argv);
if (!file || !fromArg || !toArg) { console.error('사용: sim-readahead.mjs <pdf> <시작쪽> <끝쪽>'); process.exit(2); }
const pdfjs = await loadPdfjs(process.argv);
const doc = await pdfjs.getDocument({ url: file }).promise;
const lens = [];
for (let p = Number(fromArg); p <= Number(toArg); p++) {
  const { L } = await pageLayout(doc, p);
  for (const u of sentenceUnits(L)) lens.push(u.text.length);
}

const MAX = 6000, HEAD = 600;
function run(RA, lead) {          // lead = 덮인 거리가 이 값 이하가 되면 보낸다
  const ready = new Uint8Array(lens.length);
  let calls = 0, late = 0; const chunks = [];
  const send = (idx) => { for (const k of idx) ready[k] = 1; calls++; chunks.push(idx.reduce((a, k) => a + lens[k], 0)); };
  const take = (cand, limit) => { const out = []; let a = 0; while (cand.length && (a + lens[cand[0]] <= limit || !out.length)) { a += lens[cand[0]]; out.push(cand.shift()); } return out; };
  const refill = (i, cold) => {
    for (;;) {
      let covered = 0; for (let k = i; k < lens.length && ready[k]; k++) covered += lens[k];
      if (!cold && covered > lead) return;
      const cand = []; let dist = 0;
      for (let k = i; k < lens.length && dist < RA; dist += lens[k], k++) if (!ready[k]) cand.push(k);
      if (!cand.length) return;
      if (cold) { send(take(cand, HEAD)); cold = false; if (!cand.length) continue; }
      send(take(cand, MAX));
    }
  };
  refill(0, true);
  for (let i = 1; i < lens.length; i++) { if (!ready[i]) late++; refill(i, false); }
  const total = lens.reduce((a, b) => a + b, 0);
  chunks.sort((a, b) => a - b);
  return { 호출: calls, '만 자당 호출': +(calls / total * 1e4).toFixed(2), '청크 중앙값': chunks[chunks.length >> 1], '도착 시 번역 없음': late };
}
console.log(`${fromArg}~${toArg}쪽, 문장 ${lens.length}, 글자 ${lens.reduce((a, b) => a + b, 0)}`);
console.table({
  'A. 창 9000 · 3000 남으면 보냄 (spec)': run(9000, 3000),
  'B. 창 6000 · 3000 남으면 보냄': run(6000, 3000),
  'C. 창 6000 · 다 읽으면 보냄': run(6000, 0)
});
