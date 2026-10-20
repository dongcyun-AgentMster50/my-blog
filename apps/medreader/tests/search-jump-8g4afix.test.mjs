/* ============================================================
   tests/search-jump-8g4afix.test.mjs — 8g-4a-fix F1: 숨은 리더 쪽 넘김 뒤 "떠난 쪽 결과"로 가면 다음 쪽이 열렸다

   문제(8g-4a Review 8g4aR · headless 재현): 낭독 중 [🔍] → 검색 화면 뒤(숨은 리더)에서 61쪽 → 62쪽 →
   결과 목록에서 61쪽 결과 → **62쪽이 열렸다**(해시 62, 강조 0). `showReader` 의 숨은 리더 조건이
   "뒤로 돌아옴"(낭독이 간 쪽으로 replace — 의도)과 "결과로 이동"을 가르지 못했다.
   고침: 검색이 해시를 바꾸기 직전에 `env.mark()`(= 리더 `noteSearchJump`) → 리더의 `softEntry = 'jump'` →
   순수 `softReturnPlan` 이 'jump' 이면 'follow' 하지 않는다.

   FX1 표 — softReturnPlan(뒤로 돌아옴은 지금 그대로 'follow' · 결과로 이동은 원하는 쪽)
   FX2 beginJump — 숨은 리더는 "같은 쪽"이 아니다(X9) · 해시를 바꾸기 직전에 mark · 같은 쪽이면 mark 없음
   FX3 배선 — showReader 가 판정을 이 함수로만 · noteSearchJump · JUMP_ENV.mark · 결과 처리의 쪽 번호 확인(X1)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

const ui = await import('../js/ui/search.js');
const { softReturnPlan, noteSearchJump } = await import('../js/ui/reader.js');
const { readerHash } = await import('../js/router.js');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ══ FX1 순수 판정 ══════════════════════════════════════════ */

/** 기준 — 61쪽에서 [🔍] · 숨은 채 62쪽으로 넘어감 · 61쪽 해시로 옴 */
const BASE = Object.freeze({
  soft: true, sameDoc: true, entry: 'back', wanted: 61, fromPage: 61, page: 62,
  hiddenTurn: true, hasDom: true, stalePaint: false
});

const ROWS = [
  // [이름, 바꿀 칸, 기대]
  ['★ 뒤로 돌아옴 · 숨은 채 넘김 · 떠났던 쪽 해시 → 낭독이 간 쪽으로 replace(지금 동작 그대로)', {}, 'follow'],
  ['★ F1 — 결과로 이동(jump) · 떠났던 61쪽 결과 → 61쪽을 그린다(62쪽 아님)', { entry: 'jump' }, 'render'],
  ['결과로 이동 · 낭독이 간 62쪽의 결과 → 그 쪽이 이미 그려져 있다 → 보이기만', { entry: 'jump', wanted: 62 }, 'reshow'],
  ['결과로 이동 · 넘김 없음 · 같은 쪽 결과 → 보이기만', { entry: 'jump', hiddenTurn: false, page: 61 }, 'reshow'],
  ['결과로 이동 · 넘김 없음 · 다른 쪽 결과 → 그린다', { entry: 'jump', hiddenTurn: false, page: 61, wanted: 300 }, 'render'],
  ['뒤로 돌아옴 · 넘김 없음 · 같은 쪽 → 보이기만', { hiddenTurn: false, page: 61 }, 'reshow'],
  ['뒤로 돌아옴 · 넘김 표시 없이 쪽만 다름 → follow 아님(그린다)', { hiddenTurn: false }, 'render'],
  ['★ X8 — 뒤로 돌아옴 · 넘김 · 떠났던 쪽이 **아닌** 해시(60) → follow 아님(그 쪽을 그린다)', { wanted: 60 }, 'render'],
  ['follow 의 replace 뒤 다시 불림(넘김 표시 내림 · 해시 = 낭독 쪽) → 보이기만', { hiddenTurn: false, wanted: 62 }, 'reshow'],
  ['넘김 표시가 남았어도 해시 = 지금 쪽 → follow 아님(같은 해시로 replace 되풀이 없음) → 보이기만', { wanted: 62, fromPage: 62 }, 'reshow'],
  ['숨은 리더 아님(soft=false) → 그린다', { soft: false }, 'render'],
  ['다른 책 → 그린다', { sameDoc: false }, 'render'],
  ['다른 책 · jump → 그린다', { sameDoc: false, entry: 'jump' }, 'render'],
  ['같은 쪽이어도 DOM 없음 → 그린다', { hiddenTurn: false, page: 61, hasDom: false }, 'render'],
  ['같은 쪽이어도 원본 보기를 숨은 채 다시 그렸다 → 그린다', { entry: 'jump', wanted: 62, stalePaint: true }, 'render'],
  ['entry 없음 = 뒤로 돌아옴으로 본다', { entry: undefined }, 'follow']
];

for (const [name, patch, want] of ROWS) {
  test('FX1 softReturnPlan — ' + name, () => {
    assert.equal(softReturnPlan(Object.assign({}, BASE, patch)), want);
  });
}

test('FX1 softReturnPlan — 빈 입력은 그린다 · 입력을 바꾸지 않는다(순수)', () => {
  assert.equal(softReturnPlan(null), 'render');
  assert.equal(softReturnPlan(undefined), 'render');
  const o = Object.assign({}, BASE);
  const snap = JSON.stringify(o);
  softReturnPlan(o);
  assert.equal(JSON.stringify(o), snap);
  // 리더가 초기화되지 않았으면 noteSearchJump 는 아무 일도 하지 않는다(숨은 리더가 없다)
  assert.doesNotThrow(() => noteSearchJump());
});

/* ══ FX2 beginJump — 숨은 리더 · mark ════════════════════════ */

function envOf(scr, log) {
  return {
    pauseForJump: () => { log.push('pause'); return true; },
    screen: () => scr, clear: () => log.push('clear'), mark: () => log.push('mark'),
    go: (x) => log.push('go ' + x), replace: (x) => log.push('replace ' + x)
  };
}

test('FX2 ★ X9 — 숨은 리더(visible=false)가 바로 그 쪽을 그려 두었어도 "같은 쪽"이 아니다 → mark → go(쌓기)', () => {
  const log = [];
  const r = ui.beginJump(envOf({ visible: false, ready: true, docId: 'D', page: 61 }, log), { docId: 'D', pageNo: 61 }, false);
  assert.deepEqual(r, { paused: true, same: false });
  assert.deepEqual(log, ['pause', 'clear', 'mark', 'go ' + readerHash('D', 61)]);
  // 띠에서 눌렀어도(fromBand) 리더가 숨어 있으면 쌓는다(검색 화면 항목을 바꿔 쓰지 않는다)
  log.length = 0;
  ui.beginJump(envOf({ visible: false, ready: true, docId: 'D', page: 61 }, log), { docId: 'D', pageNo: 61 }, true);
  assert.deepEqual(log, ['pause', 'clear', 'mark', 'go ' + readerHash('D', 61)]);
});

test('FX2 ★ F1 — 숨은 리더가 62쪽으로 넘어간 뒤 61쪽 결과 → mark 가 go **앞** · 보이는 같은 쪽이면 mark 없음', () => {
  const log = [];
  ui.beginJump(envOf({ visible: false, ready: true, docId: 'D', page: 62 }, log), { docId: 'D', pageNo: 61 }, false);
  assert.deepEqual(log, ['pause', 'clear', 'mark', 'go ' + readerHash('D', 61)], '★ 해시를 바꾸기 직전에 리더에게 "이동"이라고 알린다');
  log.length = 0;
  const same = ui.beginJump(envOf({ visible: true, ready: true, docId: 'D', page: 61 }, log), { docId: 'D', pageNo: 61 }, true);
  assert.deepEqual(same, { paused: true, same: true });
  assert.deepEqual(log, ['pause'], '보이는 같은 쪽 — 해시를 바꾸지 않으니 mark 도 없다');
  log.length = 0;
  ui.beginJump(envOf({ visible: true, ready: true, docId: 'D', page: 3 }, log), { docId: 'D', pageNo: 61 }, true);
  assert.deepEqual(log, ['pause', 'clear', 'mark', 'replace ' + readerHash('D', 61)]);
});

/* ══ FX3 배선 ═════════════════════════════════════════════════ */

test('FX3 ★ showReader — 숨은 리더 판정은 softReturnPlan 하나 · 입력이 state 의 그 칸들 · follow = 낭독 쪽 replace · reshow = reshowReader', () => {
  const src = noComments(read('../js/ui/reader.js'));
  const sr = src.slice(src.indexOf('export async function showReader('), src.indexOf('export function softReturnPlan('));
  assert.ok(sr.length > 200, 'showReader 를 찾았다');
  const call = sr.slice(sr.indexOf('softReturnPlan({'), sr.indexOf('});', sr.indexOf('softReturnPlan({')));
  assert.ok(call.length > 0, '★ showReader 가 softReturnPlan 을 부른다');
  for (const re of [
    /soft: state\.soft,/, /sameDoc: state\.docId === docId,/, /entry: state\.softEntry,/, /wanted: wanted,/,
    /fromPage: state\.softFromPage,/, /page: state\.page,/, /hiddenTurn: state\.hiddenTurn,/,
    /hasDom: !!els\.mount\.firstChild,/, /stalePaint: state\.view === 'original' && state\.hiddenRender/
  ]) assert.match(call, re);
  assert.match(sr, /state\.softEntry = 'back';\s*if \(plan === 'follow'\) \{\s*state\.hiddenTurn = false;\s*replace\(readerHash\(docId, state\.page\)\);\s*return;\s*\}/,
    '★ follow — 낭독이 간 쪽(state.page)으로 바꿔 쓴다 · 판정 뒤 길 표시를 내린다');
  assert.match(sr, /if \(plan === 'reshow'\) \{\s*reshowReader\(doc\);\s*return;\s*\}/);
  // 옛 조건(뒤로/이동을 가르지 못함)이 showReader 에 남아 있지 않다
  assert.ok(!/state\.hiddenTurn &&/.test(sr), '숨은 리더 조건을 따로 두지 않는다');
  assert.ok(sr.indexOf('softReturnPlan({') < sr.indexOf('state.soft = false;'), '판정이 숨김 해제보다 먼저');
});

test('FX3 ★ noteSearchJump — 숨어 있을 때만 jump · 검색 화면으로 숨길 때·정말 떠날 때 back 으로', () => {
  const src = noComments(read('../js/ui/reader.js'));
  const nj = src.slice(src.indexOf('export function noteSearchJump('), src.indexOf('function reshowReader('));
  assert.match(nj, /\{\s*if \(state\.soft\) state\.softEntry = 'jump';\s*\}/);
  const lv = src.slice(src.indexOf('export function leaveReader('), src.indexOf('async function renderPage('));
  assert.match(lv, /if \(searchOverReader\(\)\) \{[^}]*\}\s*state\.soft = true;\s*state\.softEntry = 'back';/, '숨길 때 back(지난 이동 표시가 남지 않게)');
  assert.match(lv, /\n  state\.soft = false;\s*state\.softEntry = 'back';/, '정말 떠날 때 back');
  assert.match(src, /softEntry: 'back',/, '처음 값 back');
});

test('FX3 ★ 검색 배선 — JUMP_ENV.mark = noteSearchJump · beginJump 가 해시 바꾸기 직전에 mark · X1 결과 처리의 쪽 번호 확인', () => {
  const s = noComments(read('../js/ui/search.js'));
  assert.match(s, /import \{[^}]*\bnoteSearchJump\b[^}]*\} from '\.\/reader\.js';/);
  assert.match(s, /const JUMP_ENV = Object\.freeze\(\{[^\n]*\bmark: \(\) => noteSearchJump\(\),[^\n]*\}\);/, '★ 진짜 env 의 mark 가 리더에 알린다');
  const bj = s.slice(s.indexOf('export function beginJump('), s.indexOf('export function newModel('));
  assert.match(bj, /env\.mark\(\);\s*if \(fromBand && scr && scr\.visible\) env\.replace\(hash\); else env\.go\(hash\);/);
  // jumpTo · backToSpot 둘 다 beginJump(JUMP_ENV, …) 로만 해시를 바꾼다
  assert.equal((s.match(/beginJump\(JUMP_ENV, /g) || []).length, 2);
  // X1 — 기다리던 이동은 **그 쪽**이 그려졌을 때만 처리한다(다른 쪽에 칠하지 않는다 — F1 때 62쪽에 칠할 뻔한 길)
  const rp = s.slice(s.indexOf('function onReaderPage('), s.indexOf('function locate('));
  assert.match(rp, /if \(pend && pend\.docId === scr\.docId && pend\.pageNo === scr\.page && scr\.ready\) \{/);
});
