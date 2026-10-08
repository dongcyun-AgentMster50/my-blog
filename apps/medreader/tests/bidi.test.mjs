/* `[신설 2026-10-08]` 아랍어 속 영어 괄호 — 방향 격리 조각(text/bidi.js) + 화면 연결.
 * 입력은 운영자 실키 확인(2026-10-08) 캡처의 [시험 번역] 아랍어 결과 그대로다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ltrRuns } from '../js/text/bidi.js';

const AR = 'التهاب المفاصل الروماتويدي (rheumatoid arthritis) هو مرض مناعي ذاتي مزمن (chronic autoimmune disease) ' +
  'غالباً ما يسبب تيبساً صباحياً (morning stiffness) يستمر لأكثر من 30 دقيقة. ميثوتريكسات (methotrexate) ' +
  'واداليموماب (adalimumab) هما دواءان معدلان للمرض (disease-modifying drugs)، وقد تظهر فحوصات الدم (blood tests) ' +
  'مستوى بروتين التفاعل سي (C-reactive protein) أعلى من 10 ملغ/لتر.';

const join = (runs) => runs.map((r) => r.text).join('');

test('B1 ★ 글자를 잃거나 더하지 않는다 — 조각을 이으면 원문', () => {
  for (const s of [AR, '', 'abc', 'عربي فقط', '(x)', 'a (b) c', '10 mg/L', '((nested (C-x)))']) {
    assert.equal(join(ltrRuns(s)), s, JSON.stringify(s));
  }
  assert.deepEqual(ltrRuns(''), []);
  assert.deepEqual(ltrRuns(undefined), []);
});

test('B2 ★ 영어 괄호는 괄호까지 한 조각 — 캡처에서 갈라지던 "(C-reactive protein)"', () => {
  const ltr = ltrRuns(AR).filter((r) => r.ltr).map((r) => r.text);
  assert.deepEqual(ltr, [
    '(rheumatoid arthritis)', '(chronic autoimmune disease)', '(morning stiffness)', '(methotrexate)',
    '(adalimumab)', '(disease-modifying drugs)', '(blood tests)', '(C-reactive protein)'
  ]);
});

test('B3 아랍어·숫자는 격리하지 않는다(숫자는 주변 방향을 따라도 바르다)', () => {
  const rtl = ltrRuns(AR).filter((r) => !r.ltr).map((r) => r.text).join('|');
  assert.ok(rtl.includes('30 دقيقة'));
  assert.ok(rtl.includes('10 ملغ/لتر'));
  assert.deepEqual(ltrRuns('عربي 30 فقط'), [{ text: 'عربي 30 فقط', ltr: false }]);
});

test('B4 괄호 밖 라틴 연속 — 낱말 사이 붙임표·빗금·공백까지 한 조각, 프랑스어 악센트도', () => {
  assert.deepEqual(ltrRuns('قيمة C-reactive protein عالية').filter((r) => r.ltr).map((r) => r.text), ['C-reactive protein']);
  assert.deepEqual(ltrRuns('جرعة mg/L فقط').filter((r) => r.ltr).map((r) => r.text), ['mg/L']);
  assert.deepEqual(ltrRuns('مرض (polyarthrite rhumatoïde) مزمن').filter((r) => r.ltr).map((r) => r.text), ['(polyarthrite rhumatoïde)']);
});

test('B5 ★ 화면 연결 — 번역 본문은 appendBidiText 로, rtl 일 때만 <bdi dir="ltr">, 조각은 textContent', () => {
  const src = readFileSync(new URL('../js/ui/settings.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ ltrRuns \} from '\.\.\/text\/bidi\.js'/);
  assert.match(src, /appendBidiText\(body, r\.pair\[code\], a\.dir\)/, '번역 블록 본문은 appendBidiText 를 거친다');
  const fn = src.slice(src.indexOf('function appendBidiText'), src.indexOf('function paintTestOutput'));
  assert.match(fn, /if \(dir !== 'rtl'\) \{ el\.textContent = s; return; \}/);
  assert.match(fn, /createElement\('bdi'\)/);
  assert.match(fn, /iso\.dir = 'ltr'/);
  assert.match(fn, /iso\.textContent = /);
  assert.doesNotMatch(fn, /innerHTML/);
});

test('B6 순수 계층 — text/bidi.js 는 브라우저 API 를 모른다(16-A)', () => {
  const src = readFileSync(new URL('../js/text/bidi.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(src, /\b(document|window|fetch|indexedDB|navigator|localStorage)\b/);
});
