/* ============================================================
   tests/key-url-guard.test.mjs — 키는 URL 로 가지 않는다 (13절)

   ★ 이 파일은 **실제로 뚫렸던 구멍**을 막는다.

   어댑터가 `endpoint()` 에 키를 받지 않게 한 것만으로는 부족했다.
   모델 칸에 키를 붙여 넣으면 그 키가 **URL 경로에 그대로 실렸다** —
   `AQ.AbTEST…` 같은 키는 모델 이름 허용 목록
   `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` 을 **통과하기 때문이다**
   (영숫자·점·하이픈뿐이고 64자 미만).

   교훈: **형식을 좁히는 방어는 그 형식을 아는 만큼만 막는다.**
   그래서 `assertNoKeyInUrl` 은 형식을 추측하지 않고
   "이 URL 에 지금 이 키가 들어 있는가" 하나만 본다.

   키 문자열은 전부 **지어낸 더미**다. 진짜 키가 아니다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as provider from '../js/ai/provider.js';
import * as gemini from '../js/ai/adapters/gemini.js';

const ADAPTER = gemini.default || gemini.adapter || gemini;

/** 모델 이름 허용 목록을 **통과하는** 모양의 더미 키 — 이것이 실제로 뚫었다. */
const SNEAKY = 'AQ.AbDUMMYDUMMYDUMMYDUMMYDUMMY123';
/** 옛 형식 더미. */
const OLD = 'AIzaDUMMYDUMMYDUMMYDUMMYDUMMYDUMMY12';

const db = { get: async () => null, put: async () => { } };

/** 부른 URL 을 모으는 스텁. 한 번이라도 불렸다면 요청이 나간 것이다. */
function recorder(status, body) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init: init });
    return {
      ok: status >= 200 && status < 300, status: status,
      headers: { get: () => null },
      json: async () => body, text: async () => JSON.stringify(body)
    };
  };
  fn.calls = calls;
  return fn;
}

const OK_BODY = { candidates: [{ content: { parts: [{ text: '{}' }] } }], usageMetadata: {} };
const REQ = { system: 's', user: 'u', json: true, maxOutputTokens: 10, temperature: 0 };

/* ── 정상 경로 ──────────────────────────────────────────── */

test('K1 ★ 정상 호출 — 키는 URL 에 없고 **헤더로는 실제로 간다**', async () => {
  // 뒤 절이 중요하다. 이게 없으면 "키를 아무 데도 안 보낸다" 로도 앞 절이 통과한다.
  const f = recorder(200, OK_BODY);
  await provider.complete(REQ, {
    adapter: ADAPTER, key: OLD, model: 'gemini-2.5-flash-lite', fetch: f, db: db
  });
  assert.equal(f.calls.length, 1);
  assert.ok(f.calls[0].url.indexOf(OLD) < 0, '키가 URL 에 실렸다');
  const headers = f.calls[0].init.headers || {};
  assert.equal(headers['x-goog-api-key'], OLD, '헤더로 가지 않으면 이 테스트는 헛돈다');
});

/* ── 실제로 뚫렸던 구멍 ─────────────────────────────────── */

test('K2 ★★ 모델 칸에 키를 붙여 넣어도 요청이 **나가지 않는다**', async () => {
  // 이것이 뚫렸던 경로다. 허용 목록을 통과하는 모양이라 형식 검사로는 못 막는다.
  const f = recorder(200, OK_BODY);
  await assert.rejects(
    () => provider.complete(REQ, { adapter: ADAPTER, key: SNEAKY, model: SNEAKY, fetch: f, db: db }),
    (e) => {
      assert.ok(String(e.message).indexOf(SNEAKY) < 0, '거부 메시지에 키가 남았다');
      return true;
    }
  );
  assert.equal(f.calls.length, 0,
    '요청이 나갔다 — URL 은 이미 로그·리퍼러에 남는다. 보내기 **전에** 막아야 한다');
});

test('K3 옛 형식 키도 모델 칸으로 새지 않는다', async () => {
  const f = recorder(200, OK_BODY);
  await assert.rejects(() => provider.complete(REQ, {
    adapter: ADAPTER, key: OLD, model: OLD, fetch: f, db: db
  }));
  assert.equal(f.calls.length, 0);
});

test('K4 퍼센트 인코딩으로 숨겨도 걸린다', async () => {
  const f = recorder(200, OK_BODY);
  await assert.rejects(() => provider.complete(REQ, {
    adapter: ADAPTER, key: SNEAKY, model: encodeURIComponent(SNEAKY), fetch: f, db: db
  }));
  assert.equal(f.calls.length, 0);
});

/* ── 검증·모델 목록 경로도 같은 그물을 지난다 ──────────── */

test('K5 verifyKey 의 URL 에도 키가 없다', async () => {
  const f = recorder(200, { models: [] });
  await provider.verifyKey(SNEAKY, { provider: 'gemini', adapter: ADAPTER, key: SNEAKY, fetch: f, db: db });
  for (const c of f.calls) assert.ok(c.url.indexOf(SNEAKY) < 0);
});

test('K6 listModels 의 URL 에도 키가 없다', async () => {
  const f = recorder(200, { models: [{ name: 'models/gemini-2.5-flash-lite' }] });
  await provider.listModels(SNEAKY, { provider: 'gemini', adapter: ADAPTER, fetch: f, db: db });
  for (const c of f.calls) assert.ok(c.url.indexOf(SNEAKY) < 0);
});

/* ── 그물이 과하지 않은가 ───────────────────────────────── */

test('K7 짧은 문자열은 키로 치지 않는다 — 본문과 우연히 겹친다', async () => {
  // `key` 가 'models' 처럼 짧으면 정상 URL 에도 들어 있다. 그걸로 막으면
  // 아무 요청도 못 보낸다. 8자 미만은 보지 않는다.
  const f = recorder(200, OK_BODY);
  await provider.complete(REQ, {
    adapter: ADAPTER, key: 'models', model: 'gemini-2.5-flash-lite', fetch: f, db: db
  });
  assert.equal(f.calls.length, 1, '짧은 값 때문에 정상 호출이 막혔다');
});

test('K8 평범한 모델 이름은 그대로 통과한다', async () => {
  const f = recorder(200, OK_BODY);
  await provider.complete(REQ, {
    adapter: ADAPTER, key: SNEAKY, model: 'gemini-2.5-pro', fetch: f, db: db
  });
  assert.equal(f.calls.length, 1);
  assert.ok(f.calls[0].url.indexOf('gemini-2.5-pro') >= 0, '모델이 URL 에 실려야 정상이다');
});
