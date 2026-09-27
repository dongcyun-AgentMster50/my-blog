/* ============================================================
   tests/redact-7a.test.mjs — spec 13절 "키 노출 금지"

   ★ 이 파일은 **가장 먼저 읽히도록** 쓰였다. 7a 단계 전체의 전제가
     "`redact` 가 실제로 지운다"이고, 이것이 헛돌면 나머지 방어는 전부
     허상이다.

   ── 픽스처 규칙 ─────────────────────────────────────────
   **진짜처럼 보이는 키를 쓰지 않는다.** 아래 값들은 `AIza`/`AQ.` 접두사와
   길이 조건만 맞춘 뻔한 더미이며, 본문에 `DUMMY_NOT_A_REAL_KEY` 가
   박혀 있다. 어딘가에 새어도 아무것도 열지 못한다.

   ── 무엇을 고정하는가 ───────────────────────────────────
   지침의 "`redact` 가 빠뜨리는 경우": 문장 가운데 · URL 쿼리 안 ·
   JSON 문자열 안 · 여러 개 · 객체 · 순환 참조. 그리고 **패턴이 빗나간
   키**(형식이 또 바뀐 경우)까지.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { redact, redactString, REDACTION } from '../js/privacy/redact.js';

/* ── 더미 키 (전부 가짜) ─────────────────────────────── */
const OLD_KEY = 'AIza' + 'SyDUMMY_NOT_A_REAL_KEY_000000000000';  // 값은 그대로 — 쪼개 두어야 GitHub 비밀 스캐너가 진짜 키로 오해하지 않는다
const NEW_KEY = 'AQ.Ab_DUMMY_NOT_A_REAL_KEY_00';
/** 8-4 가 경고한 "형식이 또 바뀔 수 있다" — 어떤 패턴에도 걸리지 않는 모양. */
const ODD_KEY = 'zz9-DUMMY-NOT-A-REAL-KEY-2026-format-unknown';

/** 그 어떤 결과에도 더미 키의 원문 조각이 남아 있으면 안 된다. */
function assertClean(s, key) {
  const str = typeof s === 'string' ? s : JSON.stringify(s);
  assert.equal(str.includes(key), false, '키 원문이 남았다: ' + str);
}

test('문장 가운데 있는 키를 지운다', () => {
  const out = redactString('응답이 이상합니다 ' + OLD_KEY + ' 다시 시도하세요');
  assertClean(out, OLD_KEY);
  assert.equal(out, '응답이 이상합니다 ' + REDACTION + ' 다시 시도하세요');
});

test('URL 쿼리 안의 키를 지운다 — 그리고 URL 의 나머지는 남긴다', () => {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + NEW_KEY + '&pageSize=1';
  const out = redactString(url);
  assertClean(out, NEW_KEY);
  // `&` 는 키 문자 집합에 없으므로 거기서 멈춰야 한다. 뒤 파라미터가 살아
  // 있어야 사람이 어떤 요청이었는지 알아볼 수 있다.
  assert.equal(out.endsWith('&pageSize=1'), true, '지나치게 먹어 치웠다: ' + out);
  assert.equal(out.includes('?key=' + REDACTION), true);
});

test('JSON 문자열 안의 키를 지운다', () => {
  const body = JSON.stringify({ error: { message: 'bad key ' + OLD_KEY, code: 400 } });
  const out = redactString(body);
  assertClean(out, OLD_KEY);
  // 지운 뒤에도 JSON 으로 다시 읽힌다(`[KEY]` 는 따옴표를 깨지 않는다).
  assert.equal(JSON.parse(out).error.code, 400);
});

test('한 문자열에 여러 개가 있어도 전부 지운다 (g 플래그 lastIndex 함정)', () => {
  const out = redactString([OLD_KEY, OLD_KEY, NEW_KEY, 'Bearer sometoken123'].join(' | '));
  assertClean(out, OLD_KEY);
  assertClean(out, NEW_KEY);
  assert.equal(out.includes('sometoken123'), false);
  const hits = out.split(REDACTION).length - 1;
  assert.equal(hits, 4, '넷 다 지워져야 한다: ' + out);
});

test('같은 정규식을 연달아 두 번 써도 두 번째가 새지 않는다', () => {
  // `redact` 가 패턴을 캐시하면 여기서 터진다 — `lastIndex` 가 남아
  // 두 번째 호출이 앞부분을 건너뛴다.
  const a = redactString('x ' + OLD_KEY);
  const b = redactString('x ' + OLD_KEY);
  assert.equal(a, b);
  assertClean(b, OLD_KEY);
});

test('Bearer 토큰을 지운다', () => {
  const out = redactString('Authorization: Bearer abcdef.ghijkl.mnopqr');
  assert.equal(out.includes('abcdef'), false);
  assert.equal(out, 'Authorization: ' + REDACTION);
});

test('객체를 통째로 넘겨도 안전하다 — 값·중첩·배열·키 이름까지', () => {
  const obj = {
    headers: { 'x-goog-api-key': NEW_KEY },
    tried: [OLD_KEY, { deep: { deeper: 'see ' + OLD_KEY } }],
    // 키 **이름**이 키인 병적인 경우
    [OLD_KEY]: 1,
    fine: 42
  };
  const out = redact(obj);
  assertClean(out, OLD_KEY);
  assertClean(out, NEW_KEY);
  assert.equal(out.fine, 42, '멀쩡한 값은 보존해야 한다');
  assert.equal(out.headers['x-goog-api-key'], REDACTION);
  assert.equal(out.tried[0], REDACTION);
  assert.equal(Object.prototype.hasOwnProperty.call(out, REDACTION), true, '키 이름도 지워야 한다');
});

test('Error 객체는 message 와 stack 을 모두 지운다', () => {
  const err = new Error('call failed for ' + OLD_KEY);
  const out = redact(err);
  assertClean(out, OLD_KEY);
  assert.equal(out.message, 'call failed for ' + REDACTION);
  assert.equal(typeof out.stack, 'string');
  assertClean(out.stack, OLD_KEY);
});

test('Error.cause 안의 키도 지운다', () => {
  const inner = new Error('inner ' + NEW_KEY);
  const err = new Error('outer');
  err.cause = inner;
  const out = redact(err);
  assertClean(JSON.stringify(out), NEW_KEY);
});

test('순환 참조에서 죽지 않는다', () => {
  const a = { name: 'a', key: OLD_KEY };
  const b = { name: 'b', back: a };
  a.forward = b;
  let out;
  assert.doesNotThrow(() => { out = redact(a); });
  assertClean(JSON.stringify(out), OLD_KEY);
  assert.equal(out.forward.back, '[Circular]');
});

test('자기 자신을 가리키는 배열에서도 죽지 않는다', () => {
  const arr = [OLD_KEY];
  arr.push(arr);
  let out;
  assert.doesNotThrow(() => { out = redact(arr); });
  assertClean(JSON.stringify(out), OLD_KEY);
});

test('getter 가 던지는 객체에서도 죽지 않는다', () => {
  const obj = { ok: 'fine' };
  Object.defineProperty(obj, 'boom', { get() { throw new Error('nope'); }, enumerable: true });
  let out;
  assert.doesNotThrow(() => { out = redact(obj); });
  assert.equal(out.boom, '[Throws]');
  assert.equal(out.ok, 'fine');
});

test('★ 패턴이 빗나간 키도 keys 옵션으로 지운다 (8-4 — 형식은 또 바뀐다)', () => {
  // 패턴만 믿으면 여기서 샌다. 이것이 두 번째 그물이 있는 이유다.
  const bare = redactString('server said: ' + ODD_KEY);
  assert.equal(bare.includes(ODD_KEY), true, '전제 확인 — 패턴만으로는 못 잡는 모양이어야 한다');

  const out = redactString('server said: ' + ODD_KEY, { keys: [ODD_KEY] });
  assertClean(out, ODD_KEY);
  assert.equal(out, 'server said: ' + REDACTION);
});

test('keys 옵션의 키에 정규식 메타문자가 있어도 안전하다', () => {
  // `AQ.` 의 `.` 이 정규식으로 새면 엉뚱한 곳이 지워지거나 안 지워진다.
  const out = redactString('a ' + NEW_KEY + ' b AQxAb_DUMMY_NOT_A_REAL_KEY_00 c', { keys: [NEW_KEY] });
  assertClean(out, NEW_KEY);
  // `AQ.` 의 점을 `.`(아무 글자)로 해석했다면 `AQx…` 도 함께 지워졌을 것이다.
  // 이 값은 `AQ\.` 패턴에도 걸리지 않으므로 그대로 남아야 한다.
  assert.equal(out.includes('AQxAb_DUMMY_NOT_A_REAL_KEY_00'), true, '엉뚱한 곳까지 지웠다: ' + out);
});

test('너무 짧은 keys 값은 무시한다 — 본문을 말살하지 않는다', () => {
  const out = redactString('the quick brown fox', { keys: ['e'] });
  assert.equal(out, 'the quick brown fox');
});

test('문자열이 아닌 원시값은 그대로 둔다', () => {
  assert.equal(redact(42), 42);
  assert.equal(redact(true), true);
  assert.equal(redact(null), null);
  assert.equal(redact(undefined), undefined);
});

test('빈 입력에서 죽지 않는다', () => {
  assert.equal(redactString(''), '');
  assert.equal(redactString(null), 'null');
  assert.deepEqual(redact({}), {});
});
