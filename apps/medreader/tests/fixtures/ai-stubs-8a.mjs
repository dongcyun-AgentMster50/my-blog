/* ============================================================
   tests/fixtures/ai-stubs-8a.mjs — 8a 테스트가 함께 쓰는 스텁(테스트 파일이 아니다 — `*.test.mjs` 아님)

   - `memDb()`    — `js/db.js` 와 같은 모양의 메모리 DB(`get`·`put`·`putAll`·`del`·`iterate`·`keysOf`).
                    `aiCache` 의 `createdAt`·`docId` 인덱스와 `usage` 행을 흉내 낸다.
   - `stubFetch()` — 호출을 기록하는 fetch. 처리 함수가 응답을 정한다.
   - `geminiOk()`  — Gemini 200 응답 본문.
   - `docItems()`  — 요청 본문의 `<<<DOC … >>>` 에서 보낸 문장 배열을 꺼낸다.
   - `echoTranslate()` — 보낸 문장마다 "번역"을 만들어 돌려주는 처리 함수(숫자 보존, 길이 비율 ≈ 1).

   ★ 가짜 키는 한 덩어리로 두지 않는다(GitHub 비밀 스캐너) — 조각을 이어 만든다.
   ============================================================ */

export const FAKE_KEY = 'AQ.' + 'Ab_DUMMY_NOT_A_REAL_KEY_8a_pipeline';

export function memDb() {
  const stores = new Map();
  const st = (name) => { if (!stores.has(name)) stores.set(name, new Map()); return stores.get(name); };
  const keyOf = (name, v) => (name === 'usage' ? v.day : name === 'aiCache' ? v.key : v.key);
  return {
    stores: stores,
    get: async (name, key) => {
      const v = st(name).get(key);
      return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
    },
    put: async (name, value) => { st(name).set(keyOf(name, value), JSON.parse(JSON.stringify(value))); },
    putAll: async (name, values) => {
      for (const v of values) st(name).set(keyOf(name, v), JSON.parse(JSON.stringify(v)));
      return values.length;
    },
    del: async (name, key) => { st(name).delete(key); },
    iterate: async (name, opts, fn) => {
      const o = opts || {};
      let rows = Array.from(st(name).entries());
      if (o.index) {
        rows = rows.filter(([, v]) => v && v[o.index] !== undefined);
        if (o.query !== undefined) rows = rows.filter(([, v]) => v[o.index] === o.query);
        rows.sort((a, b) => (a[1][o.index] < b[1][o.index] ? -1 : a[1][o.index] > b[1][o.index] ? 1 : 0));
      }
      let n = 0;
      for (const [k, v] of rows) {
        n++;
        if (fn(JSON.parse(JSON.stringify(v)), k) === false) break;
      }
      return n;
    },
    keysOf: async (name, index, query) => {
      const out = [];
      for (const [k, v] of st(name).entries()) {
        if (!index || (v && v[index] === query)) out.push(k);
      }
      return out;
    },
    usageRow: (day) => st('usage').get(day),
    size: (name) => st(name).size
  };
}

export function stubFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    return handler(url, init || {}, calls.length - 1);
  };
  fn.calls = calls;
  return fn;
}

export function jsonRes(status, body, headers) {
  const h = headers || {};
  return {
    ok: status >= 200 && status < 300,
    status: status,
    headers: { get: (n) => (Object.prototype.hasOwnProperty.call(h, n) ? h[n] : null) },
    json: async () => body
  };
}

export function geminiOk(text) {
  return {
    candidates: [{ content: { parts: [{ text: text }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 120 }
  };
}

/** 요청 본문 → 보낸 문장 배열 `[{i, text, frag?}]`. */
export function docItems(init) {
  const body = JSON.parse(init.body);
  const user = body.contents[0].parts[0].text;
  const a = user.indexOf('<<<DOC\n');
  const b = user.lastIndexOf('\n>>>');
  return JSON.parse(user.slice(a + 7, b));
}

/** 보낸 문장마다 `«…»` 로 감싼 "번역". 숫자·길이가 보존된다. `tweak(item)` 로 항목별로 바꿀 수 있다. */
export function echoTranslate(tweak) {
  return (url, init) => {
    const items = docItems(init);
    const segments = [];
    for (const it of items) {
      const t = tweak ? tweak(it) : '«' + it.text + '»';
      if (t === undefined) continue;          // 누락시키기
      segments.push({ i: it.i, t: t });
    }
    return jsonRes(200, geminiOk(JSON.stringify({ segments: segments, notes: '' })));
  };
}

/** 설정 읽기 스텁. */
export function settingsOf(over) {
  const base = {
    'ai.provider': 'gemini', 'ai.model': '', 'ai.dailyCap': 100, 'ai.maxReqChars': 6000,
    'ai.cacheLimitMB': 200, 'ai.useOnDevice': true
  };
  const m = Object.assign(base, over || {});
  return (k) => m[k];
}

/** 손으로 돌리는 타이머. `fire()` 가 걸린 것들을 실행한다. */
export function manualTimers() {
  let seq = 0;
  const live = new Map();
  return {
    set: (fn, ms) => { const id = ++seq; live.set(id, { fn: fn, ms: ms }); return id; },
    clear: (id) => { live.delete(id); },
    pending: () => Array.from(live.values()),
    /** `ms` 와 같은 지연으로 걸린 것들을 실행한다(없으면 전부). */
    fire: (ms) => {
      for (const [id, t] of Array.from(live.entries())) {
        if (ms === undefined || t.ms === ms) { live.delete(id); t.fn(); }
      }
    }
  };
}
