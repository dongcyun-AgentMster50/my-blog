/* ============================================================
   tests/provider-7a.test.mjs — spec 8-1 · 8-2 · 8-3 · 8-4 · 13절 · 15절

   ★ `fetch` 를 **주입**한다. 실제 키도, 네트워크도 없이 전수 검증한다
     (`tts/speaker.js` 가 `synth` 를 주입받는 것과 같은 방식).
     실제 호출 검증은 사용자가 자기 키로 실기기에서 한다.

   ★ 이 파일이 지키는 것 중 첫째는 **키가 URL 에 들어가지 않는다**이다.
     그 단언이 헛돌지 않도록, 같은 테스트가 **키가 헤더로는 실제로 갔다**는
     것도 함께 확인한다 — 키를 아예 안 보내면 URL 단언은 공짜로 통과한다.

   ── 픽스처 ──────────────────────────────────────────────
   전부 가짜 키다. 접두사와 길이만 맞춘 더미이고 본문에
   `DUMMY_NOT_A_REAL_KEY` 가 박혀 있다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  complete, verifyKey, listModels, getAdapter, checkKeyFormat,
  bumpUsage, emptyUsageRow, localDay, parseRetryAfter,
  ProviderError, CODES, KEY_FORMAT, ADAPTERS
} from '../js/ai/provider.js';
import { gemini } from '../js/ai/adapters/gemini.js';

const KEY = 'AQ.Ab_DUMMY_NOT_A_REAL_KEY_6l';
const OLD_KEY = 'AIza' + 'SyDUMMY_NOT_A_REAL_KEY_000000000000';  // 값은 그대로 — 쪼개 두어야 GitHub 비밀 스캐너가 진짜 키로 오해하지 않는다
/** 8-4 "형식이 또 바뀔 수 있다" — 어떤 패턴에도 안 걸리는 모양. */
const ODD_KEY = 'zz9-DUMMY-NOT-A-REAL-KEY-2026-unknown-shape';

/* ── 도구 ───────────────────────────────────────────── */

/** 호출을 기록하는 fetch 스텁. */
function stubFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    return handler(url, init, calls.length - 1);
  };
  fn.calls = calls;
  return fn;
}

function jsonRes(status, body, headers) {
  const h = headers || {};
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n) => (Object.prototype.hasOwnProperty.call(h, n) ? h[n] : null) },
    json: async () => body
  };
}

/** `db.js` 자리에 끼우는 최소 스텁 — `get`/`put` 두 개뿐이다. */
function stubDb() {
  const rows = new Map();
  return {
    get: async (store, key) => rows.get(store + '/' + key),
    put: async (store, value) => { rows.set(store + '/' + value.day, value); },
    _row: (day) => rows.get('usage/' + day),
    _only: () => (rows.size === 1 ? [...rows.values()][0] : null),
    _size: () => rows.size
  };
}

const REQ = { system: 'S', user: 'U', json: true, maxOutputTokens: 256, temperature: 0.2 };

/** 200 OK 한 번. */
function okBody(text) {
  return {
    candidates: [{ content: { parts: [{ text: text || '{"a":1}' }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7 }
  };
}

/* ══════════════════════════════════════════════════════
   ★ 1. 키가 URL 에 들어가지 않는다 (13절 규칙 1)
   ══════════════════════════════════════════════════════ */

test('★ complete: 키가 URL 에 없다 — 그리고 헤더로는 실제로 간다', async () => {
  const f = stubFetch(() => jsonRes(200, okBody()));
  await complete(REQ, { key: KEY, fetch: f, db: stubDb() });

  assert.equal(f.calls.length, 1);
  const { url, init } = f.calls[0];

  // (a) 키가 URL 어디에도 없다.
  assert.equal(url.includes(KEY), false, 'URL 에 키가 들어갔다: ' + url);
  assert.equal(/[?&]key=/.test(url), false, 'Gemini 의 ?key= 쿼리를 썼다: ' + url);
  assert.equal(url.includes('?'), false, '이 요청에는 쿼리가 아예 없어야 한다: ' + url);

  // (b) ★ 그런데 키는 **분명히 전송됐다**. 이 단언이 없으면 (a) 는
  //     "키를 아무 데도 안 넣었다"로도 통과해 버린다.
  assert.equal(init.headers['x-goog-api-key'], KEY, '키가 헤더로 가지 않았다');

  // (c) 8-2 표의 엔드포인트 그대로.
  assert.equal(
    url,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent'
  );
  assert.equal(init.method, 'POST');
});

test('★ verifyKey: 키가 URL 에 없다 — 헤더로 간다 (8-4 의 가장 싼 요청)', async () => {
  const f = stubFetch(() => jsonRes(200, { models: [] }));
  await verifyKey(KEY, { fetch: f, db: stubDb() });

  const { url, init } = f.calls[0];
  assert.equal(url.includes(KEY), false, 'URL 에 키가 들어갔다: ' + url);
  assert.equal(/[?&]key=/.test(url), false);
  assert.equal(init.headers['x-goog-api-key'], KEY, '키가 헤더로 가지 않았다');
  // 8-4 — `GET /v1beta/models?pageSize=1`, 토큰 소비 0.
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1');
  assert.equal(init.method, 'GET');
});

test('★ 모델 이름이 이상해도 쿼리를 만들어 내지 못한다', async () => {
  const f = stubFetch(() => jsonRes(200, okBody()));
  // 설정에서 사용자가 바꿀 수 있는 값이다. 여기로 `?key=` 를 밀어 넣는 길을 막는다.
  await complete(REQ, { key: KEY, model: 'evil?key=' + KEY, fetch: f, db: stubDb() });
  const url = f.calls[0].url;
  assert.equal(url.includes(KEY), false, '모델 이름을 타고 키가 URL 에 들어갔다: ' + url);
  assert.equal(url.includes('?'), false, '모델 이름이 쿼리를 만들었다: ' + url);
});

test('★ 어댑터의 endpoint 는 키를 인자로 받지도 않는다', () => {
  // 받지 않으면 넣을 수 없다. 함수 arity 로 그것을 못 박는다.
  assert.equal(gemini.endpoint.length, 1, 'endpoint(model) 하나만 받아야 한다');
  assert.equal(gemini.verifyEndpoint.length, 0, 'verifyEndpoint() 는 인자가 없어야 한다');
  assert.equal(gemini.endpoint('m').includes('key'), false);
  assert.equal(gemini.verifyEndpoint().includes('key='), false);
});

/* ══════════════════════════════════════════════════════
   ★ 2. 오류 메시지에 키가 없다 (13절 규칙 2)
   ══════════════════════════════════════════════════════ */

test('★ 서버가 키를 되비춰 줘도 오류 메시지로 새지 않는다', async () => {
  // Google 은 400 응답에 요청 일부를 그대로 담아 주는 일이 있다.
  const leaky = 'API key not valid: ' + OLD_KEY +
                ' (request: https://generativelanguage.googleapis.com/v1beta/models?key=' + OLD_KEY + ')';
  const f = stubFetch(() => jsonRes(400, { error: { message: leaky, status: 'INVALID_ARGUMENT' } }));

  const err = await complete(REQ, { key: OLD_KEY, fetch: f, db: stubDb() }).then(
    () => null,
    (e) => e
  );
  assert.ok(err instanceof ProviderError, 'ProviderError 로 감싸야 한다');
  assert.equal(err.message.includes(OLD_KEY), false, '오류 메시지로 키가 샜다: ' + err.message);
  assert.equal(err.message.includes('[KEY]'), true, '지워졌다는 흔적이 남아야 한다');
  // `[수정 2026-10-03 — 7b Review R1]` "API key not valid" 메시지는 이제 AUTH 다(무효 키).
  // 이 테스트의 요지는 코드가 아니라 **키가 새지 않는다**이다.
  assert.equal(err.code, CODES.AUTH);
  assert.equal(err.status, 400);
  // 직렬화해도 새지 않는다(에러 리포트·`JSON.stringify` 경로).
  assert.equal(JSON.stringify(err).includes(OLD_KEY), false);
  assert.equal(JSON.stringify(err.toJSON()).includes(OLD_KEY), false);
});

test('★ 패턴에 안 걸리는 모양의 키도 오류 메시지로 새지 않는다', async () => {
  // 8-4: 형식은 또 바뀔 수 있다. 그때 패턴은 조용히 빗나간다.
  // `provider` 가 실제 키를 `redact` 에 함께 넘기므로 그래도 막힌다.
  const f = stubFetch(() => jsonRes(403, { error: { message: 'forbidden for ' + ODD_KEY } }));
  const err = await verifyKeyError(ODD_KEY, f);
  assert.equal(err.includes(ODD_KEY), false, '형식이 낯선 키가 샜다: ' + err);
});

async function verifyKeyError(key, f) {
  const e = await complete(REQ, { key, fetch: f, db: stubDb() }).then(() => null, (x) => x);
  return e ? e.message : '';
}

test('★ fetch 가 키를 품은 예외를 던져도 새지 않는다', async () => {
  const f = stubFetch(() => {
    // 실제로 있는 일이다 — 네트워크 계층이 요청 URL·헤더를 예외에 담는다.
    const e = new TypeError('Failed to fetch (x-goog-api-key: ' + KEY + ')');
    e.request = { headers: { 'x-goog-api-key': KEY } };
    throw e;
  });
  const err = await complete(REQ, { key: KEY, fetch: f, db: stubDb() }).then(() => null, (e) => e);
  assert.ok(err instanceof ProviderError);
  assert.equal(err.message.includes(KEY), false, '예외를 타고 키가 샜다: ' + err.message);
  assert.equal(JSON.stringify(err.toJSON()).includes(KEY), false);
  // 원본 예외를 `cause` 로 달지 않는다 — 달면 그 안의 헤더가 따라 나온다.
  assert.equal(err.cause, undefined, '원본 예외가 cause 로 따라 나왔다');
});

test('★ 응답 파싱이 키를 품은 예외를 던져도 새지 않는다', async () => {
  // 어댑터를 바꿔 끼우지 않는다 — `ADAPTERS` 와 어댑터 객체는 동결돼 있고,
  // 그게 맞다(아래 테스트가 그것을 고정한다). 대신 **파서가 실제로 던지게**
  // 만든다: 본문 대신 속성 접근마다 던지는 Proxy 를 준다. 프록시·확장 프로그램이
  // 망가진 본문을 주는 상황과 같은 경로이며, `provider` 의 try/catch 를 지난다.
  const f = stubFetch(() => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => new Proxy({}, {
      get(t, prop) {
        // `await` 는 먼저 `then` 을 읽는다. 거기서 던지면 `readJson` 의
        // try/catch 가 삼켜 버려 파서까지 가지 못한다 — 통과시킨다.
        if (prop === 'then') return undefined;
        throw new Error('parse blew up with ' + KEY);
      }
    })
  }));
  const err = await complete(REQ, { key: KEY, fetch: f, db: stubDb() }).then(() => null, (e) => e);
  assert.ok(err instanceof ProviderError, 'ProviderError 로 감싸지 않았다');
  assert.equal(err.message.includes(KEY), false, '파서 예외를 타고 키가 샜다: ' + err.message);
  assert.equal(err.message.includes('[KEY]'), true);
});

test('어댑터 등록과 어댑터 객체는 동결돼 있다 (런타임 교체 금지)', () => {
  assert.equal(Object.isFrozen(ADAPTERS), true);
  assert.equal(Object.isFrozen(gemini), true);
  assert.equal(ADAPTERS.gemini, gemini);
});

test('★ ProviderError 생성자는 메시지를 한 번 더 지운다 (마지막 그물)', () => {
  const e = new ProviderError({ code: CODES.UNKNOWN, status: 0, message: 'raw ' + OLD_KEY });
  assert.equal(e.message.includes(OLD_KEY), false);
  assert.equal(e.message, 'raw [KEY]');
});

/* ══════════════════════════════════════════════════════
   ★ 3. console 과 settings 스토어 (13절 규칙 3·4)
   ══════════════════════════════════════════════════════ */

const SOURCES = [
  'privacy/redact.js',
  'privacy/keys.js',
  'ai/provider.js',
  'ai/tokens.js',
  'ai/adapters/gemini.js'
];

function srcOf(rel) {
  return readFileSync(new URL('../js/' + rel, import.meta.url), 'utf8');
}

/**
 * 주석을 지운 소스. 이 파일들의 주석은 "`console.*` 에 키를 찍지 마라" 같은
 * 규칙을 적고 있어서, 주석째 검사하면 **규칙을 적었다는 이유로** 빨개진다.
 * 그러면 다음 사람이 규칙을 주석에서 지우는 쪽으로 테스트를 통과시킨다.
 */
function codeOf(rel) {
  return srcOf(rel)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

test('★ 7a 의 어떤 파일도 console 을 부르지 않는다 (dev.debug 여도 — 13절)', () => {
  for (const rel of SOURCES) {
    assert.equal(/console\s*\./.test(codeOf(rel)), false, rel + ' 이 console 을 부른다');
  }
  // 주석 제거가 과해서 코드가 통째로 사라지면 위 단언이 공짜로 통과한다.
  assert.equal(codeOf('ai/provider.js').includes('export async function complete'), true);
  // 그리고 제거가 실제로 일어났는지도 확인한다(주석의 `console.*` 이 남아 있으면
  // 이 테스트는 규칙이 아니라 문서를 검사하게 된다).
  assert.equal(srcOf('privacy/redact.js').includes('console'), true, '전제 확인 — 주석에는 있다');
});

test('★ 키 저장 경로가 settings 스토어를 건드리지 않는다 (9-3 명시)', () => {
  for (const rel of ['privacy/keys.js', 'ai/provider.js']) {
    const src = srcOf(rel);
    assert.equal(/from\s+['"].*settings\.js['"]/.test(src), false, rel + ' 이 settings.js 를 import 한다');
    assert.equal(src.includes("'settings'"), false, rel + ' 에 settings 스토어 이름이 있다');
  }
});

test('★ 저장소 키 이름은 sessionStorage/localStorage 용이지 DB 스토어가 아니다', async () => {
  const { storageKeyName } = await import('../js/privacy/keys.js');
  assert.equal(storageKeyName('gemini'), 'medreader.key.gemini');
  const { STORE_NAMES } = await import('../js/db.js');
  assert.equal(STORE_NAMES.includes('medreader.key.gemini'), false);
});

/* ══════════════════════════════════════════════════════
   4. 상태 코드 매핑 (8-2)
   ══════════════════════════════════════════════════════ */

test('200 — 텍스트와 usage 를 돌려준다', async () => {
  const f = stubFetch(() => jsonRes(200, okBody('{"t":"ok"}')));
  const r = await complete(REQ, { key: KEY, fetch: f, db: stubDb() });
  assert.equal(r.text, '{"t":"ok"}');
  assert.deepEqual(r.usage, { input: 11, output: 7 });
  assert.equal(r.provider, 'gemini');
  assert.equal(r.model, 'gemini-3.5-flash-lite');   // [수정 2026-10-08] 기본 모델 변경
});

test('401 · 403 → AUTH', async () => {
  for (const s of [401, 403]) {
    const f = stubFetch(() => jsonRes(s, { error: { message: 'nope' } }));
    const e = await complete(REQ, { key: KEY, fetch: f, db: stubDb() }).then(() => null, (x) => x);
    assert.equal(e.code, CODES.AUTH, s + ' 가 AUTH 로 가지 않았다');
    assert.equal(e.status, s);
  }
});

test('429 → RATE_LIMIT, Retry-After 를 초로 읽어 넘긴다 (8-2)', async () => {
  const f = stubFetch(() => jsonRes(429, { error: { message: 'slow down' } }, { 'Retry-After': '42' }));
  const e = await complete(REQ, { key: KEY, fetch: f, db: stubDb() }).then(() => null, (x) => x);
  assert.equal(e.code, CODES.RATE_LIMIT);
  assert.equal(e.retryAfter, 42);
});

test('429 에 Retry-After 가 없으면 null 이다 (0 이 아니다)', async () => {
  const f = stubFetch(() => jsonRes(429, {}));
  const e = await complete(REQ, { key: KEY, fetch: f, db: stubDb() }).then(() => null, (x) => x);
  assert.equal(e.code, CODES.RATE_LIMIT);
  assert.equal(e.retryAfter, null, '0 이면 "지금 당장 재시도"로 읽힌다');
});

test('Retry-After 가 HTTP-date 로 와도 초로 바꾼다', () => {
  const now = Date.parse('2026-09-26T10:00:00Z');
  assert.equal(parseRetryAfter('Sat, 26 Sep 2026 10:00:30 GMT', now), 30);
  assert.equal(parseRetryAfter('30', now), 30);
  assert.equal(parseRetryAfter('', now), null);
  assert.equal(parseRetryAfter(null, now), null);
  assert.equal(parseRetryAfter('nonsense', now), null);
  // 이미 지난 시각이면 음수가 아니라 0.
  assert.equal(parseRetryAfter('Sat, 26 Sep 2026 09:59:00 GMT', now), 0);
});

test('500 → SERVER', async () => {
  const f = stubFetch(() => jsonRes(500, { error: { message: 'boom' } }));
  const e = await complete(REQ, { key: KEY, fetch: f, db: stubDb() }).then(() => null, (x) => x);
  assert.equal(e.code, CODES.SERVER);
});

test('400 → BAD_REQUEST', async () => {
  const f = stubFetch(() => jsonRes(400, { error: { message: 'bad' } }));
  const e = await complete(REQ, { key: KEY, fetch: f, db: stubDb() }).then(() => null, (x) => x);
  assert.equal(e.code, CODES.BAD_REQUEST);
});

test('TypeError(네트워크·CORS) → UNKNOWN + maybeBlocked (8-3)', async () => {
  const f = stubFetch(() => { throw new TypeError('Failed to fetch'); });
  const e = await complete(REQ, { key: KEY, fetch: f, db: stubDb() }).then(() => null, (x) => x);
  assert.equal(e.code, CODES.UNKNOWN, 'CORS 와 네트워크를 코드로 가르려 들면 안 된다');
  assert.equal(e.maybeBlocked, true, '호출자가 안내를 고를 수 있게 깃발은 세워야 한다');
  assert.equal(e.status, 0);
});

test('본문이 JSON 이 아니어도 죽지 않는다 (프록시가 HTML 을 준다)', async () => {
  const f = stubFetch(() => ({
    ok: false, status: 502,
    headers: { get: () => null },
    json: async () => { throw new SyntaxError('Unexpected token <'); }
  }));
  const e = await complete(REQ, { key: KEY, fetch: f, db: stubDb() }).then(() => null, (x) => x);
  assert.equal(e.code, CODES.SERVER);
  assert.equal(e.message, '');
});

test('finishReason: SAFETY → SAFETY 코드 (8-2). 200 으로 온다', async () => {
  const f = stubFetch(() => jsonRes(200, {
    candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }]
  }));
  const e = await complete(REQ, { key: KEY, fetch: f, db: stubDb() }).then(() => null, (x) => x);
  assert.equal(e.code, CODES.SAFETY);
  assert.equal(e.status, 200);
});

test('promptFeedback.blockReason 도 SAFETY 로 간다 (candidates 가 아예 없다)', async () => {
  const f = stubFetch(() => jsonRes(200, { promptFeedback: { blockReason: 'SAFETY' } }));
  const e = await complete(REQ, { key: KEY, fetch: f, db: stubDb() }).then(() => null, (x) => x);
  assert.equal(e.code, CODES.SAFETY);
});

test('키가 없으면 네트워크를 건드리지 않는다', async () => {
  const f = stubFetch(() => jsonRes(200, okBody()));
  const e = await complete(REQ, { key: '', fetch: f, db: stubDb() }).then(() => null, (x) => x);
  assert.equal(e.code, CODES.NO_KEY);
  assert.equal(f.calls.length, 0, '키도 없이 요청을 보냈다');
});

test('8-2 본문 모양 — systemInstruction · contents · responseMimeType', async () => {
  const f = stubFetch(() => jsonRes(200, okBody()));
  await complete(REQ, { key: KEY, fetch: f, db: stubDb() });
  const body = JSON.parse(f.calls[0].init.body);
  assert.deepEqual(body.systemInstruction, { parts: [{ text: 'S' }] });
  assert.deepEqual(body.contents, [{ role: 'user', parts: [{ text: 'U' }] }]);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.generationConfig.maxOutputTokens, 256);
  assert.equal(body.generationConfig.temperature, 0.2);
  // 본문에도 키는 없다.
  assert.equal(f.calls[0].init.body.includes(KEY), false);
});

/* ══════════════════════════════════════════════════════
   5. verifyKey 의 네 갈래 + usage 기록 (8-4)
   ══════════════════════════════════════════════════════ */

test('verifyKey 200 → ok', async () => {
  const db = stubDb();
  const f = stubFetch(() => jsonRes(200, { models: [] }));
  const r = await verifyKey(KEY, { fetch: f, db });
  assert.deepEqual(r, { ok: true, code: null, status: 200, canSave: true });
});

test('verifyKey 401/403 → AUTH, 저장 불가', async () => {
  for (const s of [401, 403]) {
    const f = stubFetch(() => jsonRes(s, { error: { message: 'bad key' } }));
    const r = await verifyKey(KEY, { fetch: f, db: stubDb() });
    assert.equal(r.ok, false);
    assert.equal(r.code, CODES.AUTH);
    assert.equal(r.canSave, false, 'AUTH 만이 저장을 막을 근거다');
  }
});

test('★ verifyKey 429 → ok 이되 한도 표시 (8-4 — 키는 유효하다)', async () => {
  const f = stubFetch(() => jsonRes(429, { error: { status: 'RESOURCE_EXHAUSTED' } }, { 'Retry-After': '60' }));
  const r = await verifyKey(KEY, { fetch: f, db: stubDb() });
  assert.equal(r.ok, true, '429 는 키가 틀렸다는 뜻이 아니다');
  assert.equal(r.limited, true);
  assert.equal(r.code, CODES.RATE_LIMIT);
  assert.equal(r.retryAfter, 60);
  assert.equal(r.canSave, true);
});

test('★ verifyKey 네트워크 실패 → UNKNOWN, 저장은 허용 (8-3 · 8-4)', async () => {
  const f = stubFetch(() => { throw new TypeError('Failed to fetch'); });
  const r = await verifyKey(KEY, { fetch: f, db: stubDb() });
  assert.equal(r.ok, false);
  assert.equal(r.code, CODES.UNKNOWN);
  assert.equal(r.canSave, true, '"확인 불가, 나중에 다시" — 저장은 막지 않는다');
  assert.equal(r.maybeBlocked, true, 'CORS 일 수도 있다는 깃발');
});

test('verifyKey 는 절대 던지지 않는다 (설정 화면의 버튼 하나다)', async () => {
  const cases = [
    stubFetch(() => { throw new TypeError('x'); }),
    stubFetch(() => { throw new Error('weird'); }),
    stubFetch(() => jsonRes(500, null)),
    stubFetch(() => ({ ok: false, status: 502, headers: { get: () => null }, json: async () => { throw new Error('html'); } }))
  ];
  for (const f of cases) {
    const r = await verifyKey(KEY, { fetch: f, db: stubDb() });
    assert.equal(typeof r.ok, 'boolean');
  }
  // 프로바이더 이름이 틀려도 던지지 않는다.
  const r2 = await verifyKey(KEY, { provider: 'nope', fetch: cases[0], db: stubDb() });
  assert.equal(r2.code, CODES.NO_PROVIDER);
  assert.equal(r2.ok, false);
});

test('verifyKey 500 → 저장은 허용 (키 문제라고 단정할 수 없다)', async () => {
  const f = stubFetch(() => jsonRes(500, {}));
  const r = await verifyKey(KEY, { fetch: f, db: stubDb() });
  assert.equal(r.ok, false);
  assert.equal(r.code, CODES.SERVER);
  assert.equal(r.canSave, true);
});

test('★ 검증 호출도 usage 에 kind:verify 로 기록된다 (8-4 대시보드 투명성)', async () => {
  const db = stubDb();
  const day = localDay();
  const f = stubFetch(() => jsonRes(200, { models: [] }));
  await verifyKey(KEY, { fetch: f, db });

  const row = db._row(day);
  assert.ok(row, 'usage 행이 없다');
  assert.equal(row.calls, 1);
  assert.equal(row.byKind.verify, 1, 'kind:verify 로 기록되지 않았다');
  assert.equal(row.byProvider.gemini, 1);
  assert.equal(row.tokensIn, 0, '8-4 — 가장 싼 요청은 토큰을 쓰지 않는다');
});

test('★ usage 행에 키가 들어가지 않는다', async () => {
  const db = stubDb();
  const f = stubFetch(() => jsonRes(200, okBody()));
  await complete(REQ, { key: KEY, fetch: f, db, kind: 'translate' });
  const dump = JSON.stringify(db._row(localDay()));
  assert.equal(dump.includes(KEY), false, 'usage 스토어로 키가 샜다');
});

/* ══════════════════════════════════════════════════════
   6. AbortSignal (8단계 파이프라인이 취소한다)
   ══════════════════════════════════════════════════════ */

test('★ 이미 취소된 signal 이면 요청을 보내지 않는다', async () => {
  const ac = new AbortController();
  ac.abort();
  const f = stubFetch(() => jsonRes(200, okBody()));
  const e = await complete(REQ, { key: KEY, fetch: f, signal: ac.signal, db: stubDb() })
    .then(() => null, (x) => x);
  assert.equal(e.code, CODES.ABORTED);
  assert.equal(f.calls.length, 0, '취소됐는데 요청이 나갔다');
});

test('★ fetch 가 AbortError 로 거부하면 ABORTED 다', async () => {
  const f = stubFetch(() => {
    const e = new Error('aborted');
    e.name = 'AbortError';
    throw e;
  });
  const e = await complete(REQ, { key: KEY, fetch: f, db: stubDb() }).then(() => null, (x) => x);
  assert.equal(e.code, CODES.ABORTED);
  assert.equal(e.maybeBlocked, false, '취소는 네트워크 차단이 아니다');
});

test('★ 응답이 온 뒤에 취소됐어도 결과를 흘리지 않는다', async () => {
  const ac = new AbortController();
  const f = stubFetch(() => {
    ac.abort();            // 응답 직전에 사용자가 취소했다
    return jsonRes(200, okBody('늦은 응답'));
  });
  const e = await complete(REQ, { key: KEY, fetch: f, signal: ac.signal, db: stubDb() })
    .then((r) => r, (x) => x);
  assert.ok(e instanceof ProviderError, '취소 뒤에 결과가 흘러나왔다');
  assert.equal(e.code, CODES.ABORTED);
});

test('signal 은 fetch 로 그대로 넘어간다 (실제 취소는 브라우저가 한다)', async () => {
  const ac = new AbortController();
  const f = stubFetch(() => jsonRes(200, okBody()));
  await complete(REQ, { key: KEY, fetch: f, signal: ac.signal, db: stubDb() });
  assert.equal(f.calls[0].init.signal, ac.signal);
});

test('verifyKey 도 취소를 존중한다', async () => {
  const ac = new AbortController();
  ac.abort();
  const f = stubFetch(() => jsonRes(200, {}));
  const r = await verifyKey(KEY, { fetch: f, signal: ac.signal, db: stubDb() });
  assert.equal(r.code, CODES.ABORTED);
  assert.equal(f.calls.length, 0);
});

/* ══════════════════════════════════════════════════════
   7. usage 기록 (15절 · 9-2)
   ══════════════════════════════════════════════════════ */

test('9-2 usage 행 모양 — byKind 의 고정 키 여섯 개', () => {
  const row = emptyUsageRow('2026-09-26');
  assert.deepEqual(Object.keys(row.byKind).sort(),
    ['grade', 'quiz', 'summarize', 'table', 'translate', 'verify']);
  assert.equal(row.calls, 0);
  assert.equal(row.blocked429, 0);
});

test('9-2 usage 키는 로컬 날짜다 (UTC 가 아니다)', () => {
  const d = new Date(2026, 0, 5, 23, 30, 0);   // 지역 시각 1월 5일 23:30
  assert.equal(localDay(d), '2026-01-05');
  assert.match(localDay(), /^\d{4}-\d{2}-\d{2}$/);
});

test('15절 — 호출이 시작될 때 calls++ 한다 (실패해도 기록된다)', async () => {
  const db = stubDb();
  const f = stubFetch(() => jsonRes(500, {}));
  await complete(REQ, { key: KEY, fetch: f, db, kind: 'summarize' }).catch(() => {});
  const row = db._row(localDay());
  assert.equal(row.calls, 1, '응답이 실패해도 비용은 발생했을 수 있다');
  assert.equal(row.byKind.summarize, 1);
  assert.equal(row.errors, 1);
});

test('429 는 blocked429 로도 센다', async () => {
  const db = stubDb();
  const f = stubFetch(() => jsonRes(429, {}));
  await complete(REQ, { key: KEY, fetch: f, db, kind: 'translate' }).catch(() => {});
  const row = db._row(localDay());
  assert.equal(row.blocked429, 1);
  assert.equal(row.errors, 1);
});

test('8-5 — 응답의 실제 usage 를 기록한다', async () => {
  const db = stubDb();
  const f = stubFetch(() => jsonRes(200, okBody()));
  await complete(REQ, { key: KEY, fetch: f, db, kind: 'translate' });
  const row = db._row(localDay());
  assert.equal(row.tokensIn, 11);
  assert.equal(row.tokensOut, 7);
  assert.equal(row.byKind.translate, 1);
});

test('여러 번 불러도 같은 행에 누적된다', async () => {
  const db = stubDb();
  const f = stubFetch(() => jsonRes(200, okBody()));
  await complete(REQ, { key: KEY, fetch: f, db, kind: 'translate' });
  await complete(REQ, { key: KEY, fetch: f, db, kind: 'translate' });
  const row = db._row(localDay());
  assert.equal(row.calls, 2);
  assert.equal(row.tokensIn, 22);
  assert.equal(db._size(), 1, '하루에 행은 하나다');
});

test('9-2 밖의 kind 는 byKind 에 새로 만들지 않는다 (오타가 눌러앉는다)', async () => {
  const db = stubDb();
  await bumpUsage({ calls: 1, kind: 'transalte', provider: 'gemini' }, { db });
  const row = db._row(localDay());
  assert.equal(Object.prototype.hasOwnProperty.call(row.byKind, 'transalte'), false);
  assert.equal(row.calls, 1, '총 호출 수는 그래도 센다');
});

test('usage 기록이 실패해도 AI 호출은 성공한다', async () => {
  const brokenDb = {
    get: async () => { throw new Error('IndexedDB 가 죽었다'); },
    put: async () => { throw new Error('IndexedDB 가 죽었다'); }
  };
  const f = stubFetch(() => jsonRes(200, okBody('살아 있다')));
  const r = await complete(REQ, { key: KEY, fetch: f, db: brokenDb });
  assert.equal(r.text, '살아 있다', '대시보드 때문에 번역이 죽으면 안 된다');
});

test('동시에 여러 번 올려도 셈이 사라지지 않는다 (읽기-고치기-쓰기 경합)', async () => {
  const db = stubDb();
  await Promise.all([
    bumpUsage({ calls: 1, kind: 'translate', provider: 'gemini' }, { db }),
    bumpUsage({ calls: 1, kind: 'translate', provider: 'gemini' }, { db }),
    bumpUsage({ calls: 1, kind: 'translate', provider: 'gemini' }, { db })
  ]);
  assert.equal(db._row(localDay()).calls, 3);
});

/* ══════════════════════════════════════════════════════
   8. 키 형식 검사 (8-4 — 경고만, 저장은 막지 않는다)
   ══════════════════════════════════════════════════════ */

test('8-4 — 알려진 두 형식은 OK', () => {
  assert.equal(checkKeyFormat('gemini', OLD_KEY).code, KEY_FORMAT.OK);
  assert.equal(checkKeyFormat('gemini', KEY).code, KEY_FORMAT.OK);
});

test('★ 8-4 — 낯선 형식은 경고일 뿐, 저장을 막지 않는다', () => {
  const r = checkKeyFormat('gemini', ODD_KEY);
  assert.equal(r.code, KEY_FORMAT.UNFAMILIAR);
  assert.equal(r.ok, true, '형식은 또 바뀔 수 있다 — 막으면 안 된다');
});

test('빈 키만이 형식 검사에서 떨어진다', () => {
  assert.equal(checkKeyFormat('gemini', '').ok, false);
  assert.equal(checkKeyFormat('gemini', '   ').code, KEY_FORMAT.EMPTY);
});

test('keyPattern 은 길이 하한만 둔다 (8-4)', () => {
  const p = gemini.keyPattern;
  assert.equal(p.test('AIza' + 'a'.repeat(30)), true);
  assert.equal(p.test('AIza' + 'a'.repeat(200)), true, '위쪽 길이를 강제하면 안 된다');
  assert.equal(p.test('AIza' + 'a'.repeat(29)), false);
  assert.equal(p.test('AQ.' + 'a'.repeat(20)), true);
  assert.equal(p.test('AQ.' + 'a'.repeat(19)), false);
});

/* ══════════════════════════════════════════════════════
   9. 모델 목록 (8-4)
   ══════════════════════════════════════════════════════ */

test('listModels 성공 → 원격 목록', async () => {
  const f = stubFetch(() => jsonRes(200, {
    models: [
      { name: 'models/gemini-2.5-flash-lite', displayName: 'Flash Lite', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] }
    ]
  }));
  const r = await listModels(KEY, { fetch: f });
  assert.equal(r.fromRemote, true);
  assert.deepEqual(r.models, [{ id: 'gemini-2.5-flash-lite', label: 'Flash Lite' }]);
  assert.equal(f.calls[0].url.includes(KEY), false);
});

test('listModels 실패 → staticModels 로 떨어지고 던지지 않는다', async () => {
  const f = stubFetch(() => { throw new TypeError('Failed to fetch'); });
  const r = await listModels(KEY, { fetch: f });
  assert.equal(r.fromRemote, false);
  assert.equal(r.models.length > 0, true);
  assert.equal(r.models[0].id, 'gemini-3.5-flash-lite');   // [수정 2026-10-08] 기본 모델 변경
});

test('getAdapter 는 모르는 프로바이더에 ProviderError 를 낸다', () => {
  assert.equal(getAdapter().id, 'gemini');
  assert.equal(getAdapter('gemini').id, 'gemini');
  assert.throws(() => getAdapter('nope'), (e) => e instanceof ProviderError && e.code === CODES.NO_PROVIDER);
});
