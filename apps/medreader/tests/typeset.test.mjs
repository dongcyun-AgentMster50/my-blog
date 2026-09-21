/* ============================================================
   tests/typeset.test.mjs — spec 12-3 · 16-F · 9-3 (4단계)

   `Aa` 가 바꾸는 것은 결국 **CSS 변수 네 개**다. 그 사상(寫像)이 여기 고정된다.

   ★ 9-3 의 키를 지어내지 않았는지도 여기서 본다. `settings.DEFAULTS` 에 없는
     키를 쓰면 저장은 되지만 `get()` 이 `undefined` 를 돌려주고, 화면은 조용히
     기본값으로 돌아간다 — 사용자에게는 "설정이 안 먹는다"로 보인다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { typesetVars, clampNumber, normalizeTheme, LIMITS, THEMES, FONT_STACKS } from '../js/ui/typeset.js';
import { DEFAULTS } from '../js/settings.js';

test('T1 ★ 4단계가 쓰는 설정 키가 9-3 에 전부 있다 — 새 키를 지어내지 않았다', () => {
  for (const key of ['reader.fontSize', 'reader.lineHeight', 'reader.letterSpacing',
                     'reader.font', 'reader.showDone', 'ui.theme']) {
    assert.ok(Object.prototype.hasOwnProperty.call(DEFAULTS, key), key + ' 가 9-3 목록에 없다');
  }
  // 12-3 의 기본값과 어긋나면 눈 피로 기본값이 무너진다.
  assert.equal(DEFAULTS['reader.fontSize'], 22);
  assert.equal(DEFAULTS['reader.lineHeight'], 1.7);
  assert.equal(DEFAULTS['reader.letterSpacing'], 0);
});

test('T2 기본값 → CSS 변수', () => {
  const v = typesetVars({ fontSize: 22, lineHeight: 1.7, letterSpacing: 0, font: 'system' });
  assert.deepEqual(v, {
    '--reader-fs': '22px',
    '--reader-lh': '1.7',
    '--reader-ls': '0em',
    '--reader-font': FONT_STACKS.system
  });
});

test('T3 ★ 12-3 의 범위 밖 값은 접힌다 — 16px 미만·40px 초과가 새지 않는다', () => {
  assert.equal(typesetVars({ fontSize: 9 })['--reader-fs'], '16px');
  assert.equal(typesetVars({ fontSize: 120 })['--reader-fs'], '40px');
  assert.equal(typesetVars({ lineHeight: 0.2 })['--reader-lh'], '1.3');
  assert.equal(typesetVars({ lineHeight: 9 })['--reader-lh'], '2.2');
  assert.equal(typesetVars({ letterSpacing: -1 })['--reader-ls'], '0em');
  assert.equal(typesetVars({ letterSpacing: 5 })['--reader-ls'], '0.1em');
  assert.equal(LIMITS.fontSize.min, 16);
  assert.equal(LIMITS.fontSize.max, 40);
});

test('T4 쓰레기 입력에도 던지지 않고 기본값으로 떨어진다', () => {
  const v = typesetVars({ fontSize: 'big', lineHeight: null, letterSpacing: undefined, font: 'comic' });
  assert.equal(v['--reader-fs'], '22px');
  assert.equal(v['--reader-lh'], '1.7');
  assert.equal(v['--reader-ls'], '0em');
  assert.equal(v['--reader-font'], FONT_STACKS.system, '모르는 서체는 시스템 스택이다');
  assert.doesNotThrow(() => typesetVars(null));
  assert.doesNotThrow(() => typesetVars(undefined));
  assert.equal(clampNumber('x', LIMITS.fontSize, 22), 22);
});

test('T5 서체 두 가지 (12-3)', () => {
  assert.equal(typesetVars({ font: 'serif' })['--reader-font'], 'var(--font-body-serif)');
  assert.equal(typesetVars({ font: 'sans' })['--reader-font'], 'var(--font-body-sans)');
});

test('T6 ★ 테마 4종 + system (16-F). 모르는 값은 system 이다', () => {
  assert.deepEqual(THEMES.slice(), ['system', 'light', 'dark', 'sepia', 'contrast']);
  for (const th of ['light', 'dark', 'sepia', 'contrast', 'system']) {
    assert.equal(normalizeTheme(th), th);
  }
  assert.equal(normalizeTheme('solarized'), 'system');
  assert.equal(normalizeTheme(null), 'system');
  assert.equal(normalizeTheme(undefined), 'system');
  assert.equal(normalizeTheme(''), 'system');
  // 9-3 의 기본값이 THEMES 안에 있어야 한다.
  assert.ok(THEMES.indexOf(DEFAULTS['ui.theme']) >= 0);
});

test('T7 행간·자간은 부동소수 찌꺼기를 남기지 않는다 (슬라이더가 1.7000000000000002 를 준다)', () => {
  assert.equal(typesetVars({ lineHeight: 1.7000000000000002 })['--reader-lh'], '1.7');
  assert.equal(typesetVars({ letterSpacing: 0.030000000000000002 })['--reader-ls'], '0.03em');
});
