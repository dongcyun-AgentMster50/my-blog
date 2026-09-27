/* ============================================================
   tests/gutter-bins.test.mjs — 거터 히스토그램은 실제 폭을 재야 한다 (4-5)

   ★ 이 파일은 **실제로 놓쳤던 것**을 막는다.

   히스토그램이 간격에 **완전히 포함된** bin 만 세면, 양 끝에서
   최대 1 bin 씩(합쳐 2 bin) 실제 거터를 깎아 먹는다.

   `[실측 2026-09-27 · CMDT 2026]`
     쪽 폭 517pt → BIN 5.17pt,  거터 271→289 = **18pt**
     옛 방식:   2 bin = 10.3pt   ← 43% 축소
     밴드 최소폭 1.2 × Fm(9pt) = 10.8pt
     → **0.5pt 차로 탈락.** 표본 197쪽 중 158쪽이 1단으로 판정됐고,
       2단 본문이 좌우 한 줄씩 번갈아 읽히게 됐다.

   옛 책(612pt·거터 15pt)이 통과했던 것은 임계값이 맞아서가 아니라
   **기하가 우연히 선 위에 있었기 때문**이다. 자가 짧았다.

   픽스처 문장은 전부 지어낸 것이다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { detectColumns } from '../js/text/columns.js';
import { LAYOUT } from '../js/config.js';

/**
 * 2단 쪽을 만든다. 좌·우 컬럼에 같은 y 로 줄을 깔고 그 사이에 `gutter` 만큼 띄운다.
 * `detectColumns` 는 `line.runs` 를 보므로 run 을 직접 만들어 준다.
 */
function twoColumnPage(opts) {
  const o = opts || {};
  const W = o.width || 517;
  const fs = o.fontSize || 9;
  const leftX = o.leftX || 60;
  const gutter = o.gutter === undefined ? 18 : o.gutter;
  const colW = o.colW || 211;
  const n = o.lines || 28;
  const rightX = leftX + colW + gutter;

  const lines = [];
  for (let i = 0; i < n; i++) {
    const y = 700 - i * (fs + 2);
    const mk = (x0, x1) => ({
      x0: x0, x1: x1,
      items: [{ x: x0, y: y, w: x1 - x0, fontSize: fs, str: 'word', ascent: 0.8, descent: -0.2, idx: i }]
    });
    lines.push({
      // `bodyCandidates` 는 **줄의** fontSize·baseline 을 읽는다. 빼먹으면
      // Fm 이 0 이 돼 밴드 최소폭이 1.2pt 로 주저앉고, 그러면 **낱말 사이도
      // 거터가 된다.** 이 픽스처를 처음 쌀 때 실제로 그렇게 됐고,
      // G4 가 "코드 퇴보" 처럼 빨개졌다 — 틀린 것은 픽스처였다.
      fontSize: fs,
      baseline: y,
      items: [].concat(mk(leftX, leftX + colW).items, mk(rightX, rightX + colW).items),
      runs: [mk(leftX, leftX + colW), mk(rightX, rightX + colW)],
      bbox: { x0: leftX, x1: rightX + colW, y0: y, y1: y + fs }
    });
  }
  return { lines: lines, pageInfo: { width: W, height: 720 } };
}

test('G1 ★★ 18pt 거터 · 폭 517pt · 9pt 본문 — 2단으로 잡힌다 (CMDT 실측 조건)', () => {
  // 옛 방식은 이 조건에서 10.3pt 로 재 10.8pt 문턱에 0.5pt 차로 탈락했다.
  const { lines, pageInfo } = twoColumnPage({ width: 517, gutter: 18, fontSize: 9 });
  const res = detectColumns(lines, pageInfo, LAYOUT);
  assert.equal(res.count, 2, '실제 18pt 거터를 1단으로 봤다 — 좌우가 번갈아 읽힌다');
  assert.ok(res.gutters.length === 1);
  assert.ok(res.gutters[0] > 260 && res.gutters[0] < 300, '거터 위치가 엉뚱하다: ' + res.gutters[0]);
});

test('G2 옛 책 조건(612pt · 15pt 거터 · 10pt 본문)도 그대로 2단이다', () => {
  const { lines, pageInfo } = twoColumnPage({
    width: 612, gutter: 15, fontSize: 10, leftX: 72, colW: 253
  });
  const res = detectColumns(lines, pageInfo, LAYOUT);
  assert.equal(res.count, 2, '되던 것이 안 되면 퇴보다');
});

test('G3 ★ 측정이 실제 폭을 반영한다 — 거터를 넓히면 계속 잡힌다', () => {
  // 문턱은 1.2 × Fm = 10.8pt 이지만, bin 구간화 때문에 **문턱 바로 위는
  // 컬럼 위치의 위상에 따라 갈린다**(BIN 이 5.17pt 라 중심 2개가 들어가야 한다).
  // 그걸 정밀하게 단정하는 테스트는 거짓말이 된다 — 여유 있는 폭만 고정한다.
  // 실제 책들의 거터는 15–18pt 다(CMDT 18, Harrison 15).
  for (const gutter of [15, 18, 24, 30, 40]) {
    const { lines, pageInfo } = twoColumnPage({ gutter: gutter, colW: 200 });
    const res = detectColumns(lines, pageInfo, LAYOUT);
    assert.equal(res.count, 2, gutter + 'pt 거터를 놓쳤다');
  }
});

test('G4 ★ 너무 좁은 간격은 여전히 거터가 아니다 — 낱말 사이를 거터로 보면 안 된다', () => {
  // 밴드 최소폭(1.2 × Fm)이 지켜야 하는 것. 9pt 본문이면 10.8pt 미만.
  for (const gutter of [4, 8, 10]) {
    const { lines, pageInfo } = twoColumnPage({ gutter: gutter, fontSize: 9 });
    const res = detectColumns(lines, pageInfo, LAYOUT);
    assert.equal(res.count, 1, gutter + 'pt 간격을 거터로 봤다 — 낱말 사이가 컬럼이 된다');
  }
});

test('G5 1단 쪽은 1단이다', () => {
  const lines = [];
  for (let i = 0; i < 20; i++) {
    const y = 700 - i * 12;
    const run = { x0: 60, x1: 460,
      items: [{ x: 60, y: y, w: 400, fontSize: 9, str: 'w', ascent: 0.8, descent: -0.2, idx: i }] };
    lines.push({ fontSize: 9, baseline: y, items: run.items, runs: [run],
      bbox: { x0: 60, x1: 460, y0: y, y1: y + 9 } });
  }
  const res = detectColumns(lines, { width: 517, height: 720 }, LAYOUT);
  assert.equal(res.count, 1);
});

test('G6 가로지르는 줄이 적으면 2단으로 보지 않는다 (GUTTER_MIN_CROSSING)', () => {
  const { lines, pageInfo } = twoColumnPage({ lines: 3 });
  const res = detectColumns(lines, pageInfo, LAYOUT);
  assert.equal(res.count, 1, '표본 3줄로 2단을 단정하면 안 된다');
});
