/* ============================================================
   tests/jsonrepair.test.mjs — spec 10-6 방어적 파싱 · 10-7 · 16-D2

   코드펜스 · 후행 쉼표 · 잘린 배열 · 스마트 따옴표 · 주석 · 스키마 위반.
   ★ 복구는 **문자열 밖에서만** 한다 — 번역문 속 `https://`·“인용”·쉼표를 망가뜨리지 않는다.
   ★ 잘린 응답은 **온전한 항목까지만** 살린다 — 반쪽 번역이 캐시에 눌러앉지 않게.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseAIJson, validateSchema } from '../js/ai/jsonrepair.js';
import { TRANSLATE_SCHEMA, TEST_PROMPT } from '../js/ai/prompts.js';
import { parseTestPair } from '../js/ui/settings.js';

const FENCE = '```';
const SEGS = '{"segments":[{"i":0,"t":"ترجمة أولى"},{"i":1,"t":"ترجمة ثانية"}],"notes":""}';

test('J1 ★ 코드펜스 — ```json … ``` · ``` … ``` · 한 줄 펜스 · 앞뒤 수다', () => {
  for (const text of [
    FENCE + 'json\n' + SEGS + '\n' + FENCE,
    FENCE + '\n' + SEGS + '\n' + FENCE,
    FENCE + 'json ' + SEGS + FENCE,
    'Here is the JSON:\n' + FENCE + 'json\n' + SEGS + '\n' + FENCE + '\nHope this helps.'
  ]) {
    const r = parseAIJson(text, TRANSLATE_SCHEMA);
    assert.equal(r.ok, true, text);
    assert.equal(r.value.segments.length, 2);
    assert.equal(r.repaired, true);
    assert.ok(r.repairs.includes('fence'), JSON.stringify(r.repairs));
  }
  // 펜스 없이 앞뒤에 말이 붙은 것은 2단계(첫 { ~ 마지막 })가 받는다.
  const r = parseAIJson('Sure! ' + SEGS + ' Done.', TRANSLATE_SCHEMA);
  assert.equal(r.ok, true);
  assert.deepEqual(r.repairs, ['slice']);
  // 멀쩡한 JSON 은 복구 표시가 없다.
  assert.deepEqual(parseAIJson(SEGS, TRANSLATE_SCHEMA), { ok: true, value: JSON.parse(SEGS), repaired: false, repairs: [] });
});

test('J2 ★ 후행 쉼표 — 문자열 안의 ", ]" 는 건드리지 않는다', () => {
  const r = parseAIJson('{"segments":[{"i":0,"t":"a, ] b",},],"notes":"",}', TRANSLATE_SCHEMA);
  assert.equal(r.ok, true);
  assert.equal(r.value.segments[0].t, 'a, ] b');
  assert.ok(r.repairs.includes('trailingComma'));
});

test('J3 ★ 잘린 배열 — 온전한 항목만 남고, 반쯤 온 항목은 버린다', () => {
  const cutInString = '{"segments":[{"i":0,"t":"ترجمة أولى"},{"i":1,"t":"ترجمة ثا';
  const r = parseAIJson(cutInString, TRANSLATE_SCHEMA);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.segments, [{ i: 0, t: 'ترجمة أولى' }], '반쪽 번역 "ترجمة ثا" 가 살아나면 안 된다');
  assert.ok(r.repairs.includes('truncated'));

  // 숫자 끝에서 잘림 — "i": 12 가 "i": 1 로 잘렸을 수 있다 → 그 항목을 믿지 않는다.
  const cutInNumber = '{"segments":[{"i":0,"t":"a b"},{"i":1';
  assert.deepEqual(parseAIJson(cutInNumber, TRANSLATE_SCHEMA).value.segments, [{ i: 0, t: 'a b' }]);
  // 키 뒤에서 잘림
  assert.deepEqual(parseAIJson('{"segments":[{"i":0,"t":"a b"},{"i":1,"t"', TRANSLATE_SCHEMA).value.segments, [{ i: 0, t: 'a b' }]);
  // 닫는 괄호만 빠짐 — 마지막 항목은 온전하다.
  assert.deepEqual(parseAIJson('{"segments":[{"i":0,"t":"a b"},{"i":1,"t":"c d"}', TRANSLATE_SCHEMA).value.segments,
    [{ i: 0, t: 'a b' }, { i: 1, t: 'c d' }]);
  // 맨 배열
  assert.deepEqual(parseAIJson('[1,2,3').value, [1, 2]);
  assert.deepEqual(parseAIJson('[1,2,3]').value, [1, 2, 3]);
});

test('J4 ★ 스마트 따옴표 — 구분자로 쓰인 것만 고친다(문자열 안 “인용”은 그대로)', () => {
  const r = parseAIJson('{“segments”: [{“i”: 0, “t”: “قال الطبيب”}], “notes”: “”}', TRANSLATE_SCHEMA);
  assert.equal(r.ok, true);
  assert.equal(r.value.segments[0].t, 'قال الطبيب');
  assert.ok(r.repairs.includes('smartQuotes'));
  const keep = parseAIJson('{"segments":[{"i":0,"t":"he said “stop” now"}]}', TRANSLATE_SCHEMA);
  assert.equal(keep.value.segments[0].t, 'he said “stop” now');
  assert.equal(keep.repaired, false);
});

test('J5 주석 — 문자열 밖만 지운다(번역문 속 // 는 남는다 — URL 은 10-7 이 따로 지운다)', () => {
  const r = parseAIJson('{"segments":[ // first\n{"i":0,"t":"a // b"} /* x */ ]}', TRANSLATE_SCHEMA);
  assert.equal(r.ok, true);
  assert.equal(r.value.segments[0].t, 'a // b');
  assert.ok(r.repairs.includes('comments'));
});

test('J6 ★ 스키마 위반 — 실패 필드·항목 제거, required 누락이면 SCHEMA', () => {
  // 항목 하나의 t 가 숫자 → 그 항목만 빠진다(→ 10-2 개수 누락). 스키마 밖 필드는 버린다.
  const r = parseAIJson('{"segments":[{"i":0,"t":"ok"},{"i":1,"t":5},{"i":"2","t":"num str","x":1}],"notes":"","evil":"y"}', TRANSLATE_SCHEMA);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { segments: [{ i: 0, t: 'ok' }, { i: 2, t: 'num str' }], notes: '' });
  assert.ok(r.repairs.includes('schema'));
  // 루트의 required(segments) 누락
  assert.deepEqual(parseAIJson('{"notes":"x"}', TRANSLATE_SCHEMA), { ok: false, code: 'SCHEMA', repairs: [] });
  // 타입이 아예 다름
  assert.equal(parseAIJson('[1,2]', TRANSLATE_SCHEMA).code, 'SCHEMA');
  // 정수 자리의 소수
  assert.deepEqual(parseAIJson('{"segments":[{"i":0.5,"t":"a"}]}', TRANSLATE_SCHEMA).value.segments, []);
  // enum · minItems · maxLength
  const s = { type: 'object', properties: { a: { type: 'string', enum: ['x', 'y'] }, b: { type: 'array', minItems: 2, items: { type: 'string', maxLength: 3 } } }, required: ['b'] };
  assert.equal(validateSchema({ a: 'z', b: ['ab', 'cd'] }, s).value.a, undefined);
  assert.equal(validateSchema({ b: ['abcd', 'cd'] }, s).ok, false, 'maxLength 로 빠져 minItems 미달');
});

test('J7 10-7 — 출력 문자열 안의 URL 은 지운다', () => {
  const r = parseAIJson('{"segments":[{"i":0,"t":"راجع https://evil.example/x?y=1 الآن"}]}', TRANSLATE_SCHEMA);
  assert.equal(r.value.segments[0].t, 'راجع الآن');
  assert.ok(r.repairs.includes('schema'));
});

test('J8 PARSE — 고칠 수 없으면 코드로 돌려준다(던지지 않는다)', () => {
  for (const bad of ['', '   ', 'no json here', '{{{', null, undefined, 42]) {
    const r = parseAIJson(bad, TRANSLATE_SCHEMA);
    assert.equal(r.ok, false, String(bad));
    assert.ok(r.code === 'PARSE' || r.code === 'SCHEMA');
  }
});

test('J9 ★ [시험 번역] — 코드펜스 JSON 이 이제 두 블록(짝)이 된다 · 잘린 응답은 짝이 아니다', () => {
  const pair = '{"ar":"التهاب المفاصل","ko":"류마티스 관절염"}';
  const fenced = parseTestPair(FENCE + 'json\n' + pair + '\n' + FENCE);
  assert.equal(fenced.ok, true, '7b Review: 코드펜스로 감싼 JSON 이 원문 한 블록으로 보였다');
  assert.deepEqual(fenced.pair, { ar: 'التهاب المفاصل', ko: '류마티스 관절염' });
  assert.equal(fenced.raw, FENCE + 'json\n' + pair + '\n' + FENCE, 'raw 는 받은 그대로');
  // 잘린 것은 닫아서 살리지 않는다(진단 버튼 — MAX_TOKENS 가 가려지면 안 된다).
  assert.equal(parseTestPair('{"ar": "a", "ko": "b"').ok, false);
  assert.equal(parseTestPair(FENCE + 'json\n{"ar":"a","ko":"b' ).ok, false);
  // 스키마(ar·ko 둘 다 필수)
  assert.equal(parseTestPair(FENCE + '{"ar":"a"}' + FENCE).ok, false);
  assert.ok(TEST_PROMPT.SCHEMA.required.includes('ko'));
});

test('J10 순수 계층 — jsonrepair.js·prompts.js 는 브라우저 API·console 을 모른다 (주석까지)', () => {
  for (const rel of ['ai/jsonrepair.js', 'ai/prompts.js']) {
    const src = readFileSync(new URL('../js/' + rel, import.meta.url), 'utf8');
    for (const word of ['document', 'window', 'fetch(', 'indexedDB', 'navigator', 'localStorage', 'console']) {
      assert.ok(!src.includes(word), rel + ' 에 ' + word);
    }
  }
});

test('J11 [Review 8a] 그대로 파싱되는 JSON 은 펜스로 자르지 않는다 — 번역문 속 ``` 가 있어도', () => {
  const raw = '{"segments":[{"i":0,"t":"نص فيه ' + FENCE + ' علامة"}],"notes":""}';
  const r = parseAIJson(raw, TRANSLATE_SCHEMA);
  assert.equal(r.ok, true);
  assert.equal(r.value.segments[0].t, 'نص فيه ' + FENCE + ' علامة');
  assert.deepEqual(r.repairs, []);
  // 펜스로 감싼 것은 여전히 걷어 낸다.
  assert.equal(parseAIJson(FENCE + 'json\n' + raw + '\n' + FENCE, TRANSLATE_SCHEMA).ok, true);
});
