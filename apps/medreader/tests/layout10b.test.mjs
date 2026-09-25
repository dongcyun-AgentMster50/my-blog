/* ============================================================
   10b — 세로 예산과 줌 하한

   CSS 는 Node 로 렌더할 수 없다. 그래서 **순수하게 떼어낼 수 있는 둘**만
   여기서 고정한다.

   ① 줌 하한 `min(폭 맞춤 배율, 0.8)` — 순수 함수 세 개(`ui/original.js`).
   ② 바 높이 토큰의 합 — `css/tokens.css` 를 **파일에서 읽어** 잰다.
      숫자를 여기 베껴 두면 다음에 누가 토큰을 늘려도 초록으로 남는다.
      읽어서 재면 빨개진다.

   `[실기기 · 갤럭시 Z Fold 7]` 이 두 가지가 각각 이렇게 보였다.
   - 접은 화면에서 원본 쪽이 화면보다 138px 넓어 좌우로 밀어야 했다(①).
   - 문항 보기 A~E 가 화면 밖으로 잘려 하단 바를 끌어 올려야 했다(②).
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { zoomFloor, clampZoom, stepZoom } from '../js/ui/original.js';
import { ORIGINAL } from '../js/config.js';

/* ────────────────────────────────────────────────────────
   ① 줌 하한 (12-5)
   ──────────────────────────────────────────────────────── */

/** 실측: 접은 화면 375px 에서 `.original-scroll` 의 clientWidth. */
const FOLD_AVAIL = 351;
const LETTER_PT = 612;      // US Letter 폭
const A4_PT = 595.28;       // A4 폭

const near = (got, want, eps = 1e-9) =>
  assert.ok(Math.abs(got - want) <= eps, `${got} ≈ ${want} 이어야 한다`);

test('Z1 접은 화면(375px)에서 하한은 폭 맞춤 배율까지 내려간다', () => {
  const floor = zoomFloor(LETTER_PT, FOLD_AVAIL);
  near(floor, FOLD_AVAIL / LETTER_PT);
  assert.ok(floor < ORIGINAL.ZOOM_MIN, '0.8 보다 작아야 한다 — 그래야 쪽 전체가 보인다');
});

test('Z2 A4 도 같다 — 폭이 좁으면 하한이 따라 내려간다', () => {
  near(zoomFloor(A4_PT, FOLD_AVAIL), FOLD_AVAIL / A4_PT);
});

test('Z3 넓은 화면(768px 태블릿)에서는 예전처럼 0.8 에서 멈춘다', () => {
  // 768 - 좌우 여백 24 = 744. 744/612 = 1.216 > 0.8 → 하한은 0.8 그대로.
  assert.equal(zoomFloor(LETTER_PT, 744), ORIGINAL.ZOOM_MIN);
});

test('Z4 좁은 쪽(명함만 한 PDF)은 폭 맞춤이 커서 하한이 0.8 로 남는다', () => {
  assert.equal(zoomFloor(200, FOLD_AVAIL), ORIGINAL.ZOOM_MIN);
});

test('Z5 넓은 쪽(가로로 눕힌 큰 도판)은 하한이 크게 내려간다', () => {
  const floor = zoomFloor(1000, FOLD_AVAIL);   // 0.351×
  near(floor, FOLD_AVAIL / 1000);
  assert.ok(floor >= ORIGINAL.ZOOM_FLOOR_MIN, '절대 바닥 아래로는 안 간다');
  assert.ok(floor < ORIGINAL.ZOOM_MIN);
});

test('Z5b A0 포스터처럼 극단적으로 넓으면 절대 바닥에서 멈춘다', () => {
  // 351/3370 = 0.104 — 여기까지 내려가면 글자를 읽을 수 없다.
  assert.equal(zoomFloor(3370, FOLD_AVAIL), ORIGINAL.ZOOM_FLOOR_MIN);
});

test('Z6 폭이 터무니없이 좁게 보고돼도 절대 바닥에서 멈춘다', () => {
  assert.equal(zoomFloor(3370, 1), ORIGINAL.ZOOM_FLOOR_MIN);
});

test('Z7 단서가 없으면(폭 0·NaN·음수) 12-5 의 0.8 을 그대로 쓴다', () => {
  for (const args of [[0, 351], [612, 0], [NaN, 351], [612, NaN], [-612, 351], [612, -1], [undefined, undefined]]) {
    assert.equal(zoomFloor(args[0], args[1]), ORIGINAL.ZOOM_MIN, String(args));
  }
});

test('Z8 [−] 는 하한에서 멈춘다 — 그 아래로 내려가지 않는다', () => {
  const floor = zoomFloor(LETTER_PT, FOLD_AVAIL);
  let s = 1.5;
  for (let i = 0; i < 40; i++) s = stepZoom(s, -1, floor);
  near(s, floor);
  assert.equal(stepZoom(floor, -1, floor), floor, '하한에서 한 번 더 눌러도 그 자리');
});

test('Z9 [+] 는 상한 3.0 에서 멈춘다 (10b 가 상한을 건드리지 않았다)', () => {
  const floor = zoomFloor(LETTER_PT, FOLD_AVAIL);
  let s = floor;
  for (let i = 0; i < 40; i++) s = stepZoom(s, 1, floor);
  assert.equal(s, ORIGINAL.ZOOM_MAX);
  assert.equal(stepZoom(ORIGINAL.ZOOM_MAX, 1, floor), ORIGINAL.ZOOM_MAX);
});

test('Z10 하한에서 [+] 한 번 → 반드시 올라간다 (버튼이 헛돌지 않는다)', () => {
  const floor = zoomFloor(LETTER_PT, FOLD_AVAIL);
  assert.ok(stepZoom(floor, 1, floor) > floor);
  near(stepZoom(floor, 1, floor), floor * ORIGINAL.ZOOM_FACTOR);
});

test('Z11 clampZoom — 하한을 안 주면 12-5 의 0.8 을 쓴다(옛 동작 그대로)', () => {
  assert.equal(clampZoom(0.5), ORIGINAL.ZOOM_MIN);
  assert.equal(clampZoom(9), ORIGINAL.ZOOM_MAX);
  assert.equal(clampZoom(NaN), ORIGINAL.ZOOM_MIN);
  assert.equal(clampZoom(1.5), 1.5);
});

test('Z12 clampZoom — 하한을 주면 그 사이로 자른다', () => {
  const floor = 0.57;
  assert.equal(clampZoom(0.1, floor), floor);
  assert.equal(clampZoom(0.57, floor), floor);
  assert.equal(clampZoom(99, floor), ORIGINAL.ZOOM_MAX);
});

/* ────────────────────────────────────────────────────────
   ② 세로 예산 — tokens.css 를 **읽어서** 잰다
   ──────────────────────────────────────────────────────── */

const TOKENS_CSS = fileURLToPath(new URL('../css/tokens.css', import.meta.url));

/** `:root { … }` 첫 블록의 `--name: value` 를 전부 거둔다. */
function readRootTokens(path) {
  const src = readFileSync(path, 'utf8');
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const at = stripped.indexOf(':root');
  assert.ok(at >= 0, 'tokens.css 에 :root 블록이 있어야 한다');
  const open = stripped.indexOf('{', at);
  const close = stripped.indexOf('}', open);
  assert.ok(open > 0 && close > open, ':root 블록을 못 읽었다');
  const body = stripped.slice(open + 1, close);

  const out = new Map();
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(body)) !== null) out.set(m[1], m[2].trim());
  return out;
}

/** `var(--x)` 를 펴고 `calc(...)` 를 계산해 px 숫자로 만든다. */
function px(tokens, name, depth = 0) {
  assert.ok(depth < 12, `${name} — var() 가 순환한다`);
  const raw = tokens.get(name);
  assert.ok(raw != null, `tokens.css 에 ${name} 이 없다`);

  // var(--a) 를 값으로 바꾼다(기본값 문법은 이 파일에서 쓰지 않는다).
  const expanded = raw.replace(/var\(\s*(--[a-z0-9-]+)\s*\)/gi,
    (_, n) => String(px(tokens, n, depth + 1)) + 'px');

  const expr = expanded.replace(/calc\(/gi, '(').replace(/px\b/g, '').trim();
  assert.ok(/^[\d\s.+\-*/()]+$/.test(expr), `${name} → "${raw}" 는 px 로 환산할 수 없다`);
  // 검증된 산술식만 들어온다.
  const v = Function('"use strict";return (' + expr + ');')();
  assert.ok(Number.isFinite(v), `${name} 계산 실패: ${raw}`);
  return v;
}

/** 12-3 — 리더 화면에서 본문이 아닌 것이 세로로 쓰는 높이의 합. */
function verticalBudget(tokens) {
  return px(tokens, '--bar-top')
    + px(tokens, '--tts-h')
    + px(tokens, '--tts-gap')
    + px(tokens, '--pager-h')
    + px(tokens, '--notice-total');
}

/* 10b 이전 실측 합은 239.3px 이었다(상단바 56.88 + 컨트롤 81 + 틈 3 + 쪽이동
   73 + 고지 25.5). 16-G 의 48px 터치 하한 때문에 이론상 바닥은 177px 이라
   그 위에 여유를 조금 두고 못 박는다. 다음에 누가 바를 다시 살찌우면 여기가
   빨개진다. */
const BUDGET_MAX = 200;

test('T1 바 높이 토큰의 합이 세로 예산 안에 든다', () => {
  const tokens = readRootTokens(TOKENS_CSS);
  const sum = verticalBudget(tokens);
  assert.ok(sum <= BUDGET_MAX,
    `바 세로 합 ${sum}px 가 예산 ${BUDGET_MAX}px 를 넘었다 — 원본 쪽 아래가 잘린다`);
});

test('T2 토큰이 **실제 렌더 높이**를 말한다 — 각 바는 안의 터치 타깃보다 크다', () => {
  const tokens = readRootTokens(TOKENS_CSS);
  const tap = px(tokens, '--tap');
  const play = px(tokens, '--tap-play');
  const pad = px(tokens, '--bar-pad');

  // 상단 바: --tap 버튼 + 아래 테두리 1 (패딩 없음)
  assert.ok(px(tokens, '--bar-top') >= tap + 1,
    '--bar-top 이 실제보다 작으면 이 값을 빼는 곳들이 화면 밖으로 흐른다');
  // 쪽 이동 바: --tap + 위아래 --bar-pad + 위 테두리 1
  assert.ok(px(tokens, '--pager-h') >= tap + pad * 2 + 1, '--pager-h 가 실제보다 작다');
  // 컨트롤 바: --tap-play + 위아래 --bar-pad + 위 테두리 1
  assert.ok(px(tokens, '--tts-h') >= play + pad * 2 + 1, '--tts-h 가 실제보다 작다');
});

test('T3 16-G — 터치 타깃 하한 48px 를 토큰이 깨지 않는다', () => {
  const tokens = readRootTokens(TOKENS_CSS);
  assert.equal(px(tokens, '--tap'), 48);
  assert.ok(px(tokens, '--tap-play') >= 48, '재생 버튼도 48px 밑으로 내리지 않는다');
  assert.ok(px(tokens, '--tap-play') <= px(tokens, '--tap-lg'), '재생 버튼은 큰 버튼보다 크지 않다');
});

test('T4 16-I — 고정 고지는 없어지지 않는다 (얇아질 뿐)', () => {
  const tokens = readRootTokens(TOKENS_CSS);
  const notice = px(tokens, '--notice-total');
  assert.ok(notice > 0, '고지 바 높이가 0 이면 고지가 사라진다');
  // 글자 --fs-sm × line-height 1.35 + 위아래 --notice-pad 는 들어가야 한다.
  const need = px(tokens, '--fs-sm') * 1.35 + px(tokens, '--notice-pad') * 2;
  assert.ok(notice >= need, `고지 한 줄(${need.toFixed(2)}px)이 안 들어간다`);
});

test('T5 --reader-chrome-bottom 은 아래 세 바 + 틈의 합과 정확히 같다', () => {
  const tokens = readRootTokens(TOKENS_CSS);
  const want = px(tokens, '--notice-total') + px(tokens, '--pager-h')
    + px(tokens, '--tts-gap') + px(tokens, '--tts-h');
  assert.equal(px(tokens, '--reader-chrome-bottom'), want);
});

test('T6 하단 바 사이에 틈이 있다 — 겹치면 쪽이 넘어가는 오조작이 난다', () => {
  const tokens = readRootTokens(TOKENS_CSS);
  assert.ok(px(tokens, '--tts-gap') >= 0);
});
