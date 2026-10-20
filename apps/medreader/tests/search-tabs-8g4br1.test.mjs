/* ============================================================
   tests/search-tabs-8g4br1.test.mjs — 8g-4b-R1 검색 화면 탭(찾기 · 목차) 키보드 (WAI-ARIA tabs · 자동 선택)

   K1  tabKeyTarget 표 — → · ← · Home · End · 끝에서 넘어가기 · 그 밖 키는 -1
   K2  tabKeyTarget 표 — RTL(아랍어)은 ←/→ 가 뒤집힘(시각적 왼쪽 키 → 시각적 왼쪽 탭) · Home/End 는 그대로
   K3  tabKeyTarget — Alt·Ctrl·Meta 를 누른 채면 손대지 않음 · 이상한 입력
   K4  배선 — 탭 목록 keydown → onTabsKey → tabKeyTarget(계산된 방향) → preventDefault · 초점 → setTab
   K5  마크업 — role=tablist/tab/tabpanel · aria-selected · aria-controls · 고른 탭만 tabindex=0
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

const ui = await import('../js/ui/search.js');
const { tabKeyTarget } = ui;

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const k = (key, mods) => Object.assign({ key }, mods || {});

/* 탭 순번: 0 = 찾기 · 1 = 목차 (DOM 순서) */

test('K1 ★ LTR 표 — → 다음 · ← 앞 · Home 처음 · End 마지막 · 끝에서 넘어감', () => {
  const T = [
    // [키, 지금, 탭 수, 기대]
    ['ArrowRight', 0, 2, 1],   // ★ 찾기 → 목차 (Review R1)
    ['ArrowRight', 1, 2, 0],   // 끝 → 처음(넘어감)
    ['ArrowLeft', 1, 2, 0],    // 목차 → 찾기
    ['ArrowLeft', 0, 2, 1],    // 처음 → 끝(넘어감)
    ['Home', 1, 2, 0],
    ['Home', 0, 2, 0],
    ['End', 0, 2, 1],
    ['End', 1, 2, 1],
    ['ArrowRight', 1, 3, 2],
    ['ArrowRight', 2, 3, 0],
    ['ArrowLeft', 0, 3, 2],
    ['End', 0, 3, 2]
  ];
  for (const [key, i, n, want] of T) assert.equal(tabKeyTarget(k(key), i, n, false), want, `${key} @${i}/${n}`);
});

test('K1 ★ 탭 목록 키가 아니면 -1 — 기본 동작 그대로(Tab · Enter · Space · ↑ · ↓ · 글자)', () => {
  for (const key of ['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'a', 'PageDown', 'Escape', '']) {
    assert.equal(tabKeyTarget(k(key), 0, 2, false), -1, JSON.stringify(key));
    assert.equal(tabKeyTarget(k(key), 1, 2, true), -1, JSON.stringify(key) + ' rtl');
  }
});

test('K2 ★ RTL 표 — ← 가 다음(시각적 왼쪽 탭) · → 가 앞 · 끝에서 넘어감 · Home/End 는 DOM 처음/마지막', () => {
  const T = [
    ['ArrowLeft', 0, 2, 1],    // ★ 아랍어: 찾기(오른쪽) → ← → 목차(왼쪽)
    ['ArrowRight', 1, 2, 0],   // ★ 목차(왼쪽) → → → 찾기(오른쪽)
    ['ArrowLeft', 1, 2, 0],    // 넘어감
    ['ArrowRight', 0, 2, 1],   // 넘어감
    ['Home', 1, 2, 0],
    ['End', 0, 2, 1],
    ['ArrowLeft', 1, 3, 2],
    ['ArrowRight', 1, 3, 0],
    ['ArrowRight', 0, 3, 2]
  ];
  for (const [key, i, n, want] of T) assert.equal(tabKeyTarget(k(key), i, n, true), want, `rtl ${key} @${i}/${n}`);
  // LTR 과 정말 반대인가(탭 셋, 가운데에서)
  assert.notEqual(tabKeyTarget(k('ArrowRight'), 1, 3, true), tabKeyTarget(k('ArrowRight'), 1, 3, false));
  assert.equal(tabKeyTarget(k('ArrowRight'), 1, 3, true), tabKeyTarget(k('ArrowLeft'), 1, 3, false));
});

test('K3 수식 키 · 이상한 입력 — Alt+← (브라우저 뒤로) 등은 손대지 않음 · 탭 0개 · 순번 밖은 끝에 붙임', () => {
  for (const m of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
    assert.equal(tabKeyTarget(k('ArrowLeft', m), 1, 2, false), -1, JSON.stringify(m));
    assert.equal(tabKeyTarget(k('ArrowRight', m), 0, 2, true), -1, JSON.stringify(m));
    assert.equal(tabKeyTarget(k('Home', m), 1, 2, false), -1);
  }
  assert.equal(tabKeyTarget(k('ArrowRight', { shiftKey: true }), 0, 2, false), 1, 'Shift 는 막지 않는다');
  assert.equal(tabKeyTarget(null, 0, 2, false), -1);
  assert.equal(tabKeyTarget(k('ArrowRight'), 0, 0, false), -1, '탭 없음');
  assert.equal(tabKeyTarget(k('ArrowRight'), 0, 1, false), 0, '탭 하나면 제자리');
  assert.equal(tabKeyTarget(k('ArrowRight'), 7, 2, false), 0, '순번이 넘치면 마지막으로 보고 넘어감');
  assert.equal(tabKeyTarget(k('ArrowLeft'), -3, 2, false), 1, '음수면 처음으로 보고 넘어감');
  assert.equal(tabKeyTarget(k('End'), 0, '2', false), 1, '문자열 수');
});

test('K4 ★ 배선 — 탭 목록 keydown → onTabsKey → tabKeyTarget(계산된 방향 · RTL) → preventDefault → 초점 → setTab(자동 선택)', () => {
  const s = noComments(read('../js/ui/search.js'));
  const init = s.slice(s.indexOf('export function initSearch('), s.indexOf('function watchRoute('));
  assert.match(init, /els\.tabs\.addEventListener\('keydown', onTabsKey\);/, '★ 탭 목록에 keydown');
  assert.ok(init.indexOf("els.tabs.addEventListener('keydown'") > init.indexOf('if (els.tabs && els.toc) {'), '탭이 있을 때만');
  const fn = s.slice(s.indexOf('function onTabsKey('), s.indexOf('function onInput('));
  assert.ok(fn.length > 0 && s.indexOf('function onTabsKey(') > 0, 'onTabsKey 있음');
  assert.match(fn, /if \(!els \|\| !tocAllowed\(\)\) return;/, '서재 범위(탭 숨김)엔 아무것도 안 함');
  assert.match(fn, /const order = \[els\.tabFind, els\.tabToc\];/, 'DOM 순서 = 순번');
  assert.match(fn, /order\.indexOf\(ev\.target\)/);
  assert.match(fn, /getComputedStyle\(els\.tabs\)\.direction === 'rtl'/, '★ 시각적 방향 — 탭 목록의 계산된 방향');
  assert.match(fn, /getDir\(\) === 'rtl'/, '계산 실패면 UI 언어 방향');
  assert.match(fn, /const j = tabKeyTarget\(ev, i, order\.length, rtl\);/);
  assert.match(fn, /if \(j < 0\) return;/, '다른 키는 기본 동작 그대로(preventDefault 안 함)');
  const pd = fn.indexOf('ev.preventDefault()'), fo = fn.indexOf('order[j].focus()'), st = fn.indexOf("setTab(order[j] === els.tabToc ? 'toc' : 'find')");
  assert.ok(pd > fn.indexOf('if (j < 0) return;') && pd < fo && fo < st, '★ preventDefault → 초점 → 선택(누름과 같은 순서)');
  // 고른 탭만 tabindex=0 (paintTabs 그대로)
  const pt = s.slice(s.indexOf('function paintTabs('), s.indexOf('function setTab('));
  assert.match(pt, /els\.tabFind\.tabIndex = toc \? -1 : 0;/);
  assert.match(pt, /els\.tabToc\.tabIndex = toc \? 0 : -1;/);
  assert.match(pt, /els\.tabFind\.setAttribute\('aria-selected', toc \? 'false' : 'true'\);/);
  assert.match(pt, /els\.tabToc\.setAttribute\('aria-selected', toc \? 'true' : 'false'\);/);
});

test('K5 마크업 — tablist · tab(aria-selected · aria-controls · 안 고른 탭 tabindex=-1) · tabpanel(aria-labelledby)', () => {
  const html = read('../index.html');
  const tl = html.match(/<div class="search-tabs" id="searchTabs"[^>]*>/);
  assert.ok(tl && /role="tablist"/.test(tl[0]));
  const f = html.match(/<button[^>]*id="searchTabFind"[^>]*>/)[0];
  const t = html.match(/<button[^>]*id="searchTabToc"[^>]*>/)[0];
  assert.match(f, /role="tab"/); assert.match(f, /aria-selected="true"/); assert.match(f, /aria-controls="searchResults"/);
  assert.doesNotMatch(f, /tabindex="-1"/, '고른 탭은 Tab 순서에');
  assert.match(t, /role="tab"/); assert.match(t, /aria-selected="false"/); assert.match(t, /aria-controls="searchToc"/); assert.match(t, /tabindex="-1"/);
  assert.match(html, /id="searchResults" role="tabpanel" aria-labelledby="searchTabFind"/);
  assert.match(html, /id="searchToc" role="tabpanel" aria-labelledby="searchTabToc"/);
});
