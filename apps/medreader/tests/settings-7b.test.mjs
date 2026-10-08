/* ============================================================
   tests/settings-7b.test.mjs — spec 16-D0 (7b 설정 AI 탭과 실제 호출)

   ★ 이 파일이 고정하는 것
     1. `[N]` gemini `errorParser` 의 지역 제한(`REGION`) 판정과 **판정 순서**
        — AUTH·BAD_REQUEST 보다 먼저 본다. 순서를 깨면 아래 R2·R3 가 빨개진다
        (지침 "변이 테스트" — 헛도는 테스트가 아님을 보고서에 기록).
     2. `provider.js` 가 `REGION` 을 **고치지 않고 그대로** 흘려보낸다
        (`verifyKey` → `{ok:false, code:'REGION', canSave:true}`, `complete` → `ProviderError.code`).
     3. 검증 결과 다섯 갈래가 **서로 다른 문구**이고, 지역 제한 문구·안내에 [키 설정]이 없다.
     4. [시험 번역] — 고정 예문 2문장, 걸린 시간 ms, usage `kind:'translate'`.
        `[수정 2026-10-08]` `json:true` + 스키마 `{ar, ko}` — 새 동작은 `settings-7b-fix.test.mjs`.
     5. 번역 따라가기 기본값(`speak` · 원문 읽기 켜짐)과 **같은 그리기 함수**.
     6. 키가 결과·메시지 어디에도 나가지 않는다.

   ★ 가짜 키는 **쪼개서** 쓴다 — 한 덩어리로 쓰면 GitHub 비밀 스캐너가 진짜 키로
     오해한다(`1f4ce7b`). 런타임 값은 이어 붙인 문자열이다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { gemini } from '../js/ai/adapters/gemini.js';
import { verifyKey, complete, CODES, ProviderError, checkKeyFormat, KEY_FORMAT } from '../js/ai/provider.js';
import { DEFAULTS } from '../js/settings.js';
import { BUNDLES, LANGS } from '../js/i18n/index.js';
import {
  OUTCOME, READALONG_MODES, DEFAULT_READALONG_MODE, SETTINGS_AI_HASH, TEST_SAMPLE,
  normalizeReadalongMode, readalongState, errorOutcome, verifyOutcome, outcomeKey,
  stateNotice, codeLabel, formatWarningKey, parseDailyCap, needsConsent,
  nativeLangName, voiceStatus, buildTestRequest, runVerify, runTestTranslation
} from '../js/ui/settings.js';
import { piiWarningTexts, PII_KEY } from '../js/ui/notice.js';

/* ── 더미 키 — 전부 가짜, 쪼개 둔다 ─────────────────────── */
const NEW_KEY = 'AQ.' + 'Ab_DUMMY_NOT_A_REAL_KEY_7b';
const OLD_KEY = 'AIza' + 'SyDUMMY_NOT_A_REAL_KEY_7b_000000000';
const ODD_KEY = 'zz9-DUMMY-NOT-A-REAL-KEY-7b-unknown-shape';

const REGION_MSG = 'User location is not supported for the API use.';

/* ── 도구 ───────────────────────────────────────────── */
function stubFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    return handler(url, init, calls.length - 1);
  };
  fn.calls = calls;
  return fn;
}

function jsonRes(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body
  };
}

function stubDb() {
  const rows = new Map();
  return {
    get: async (store, key) => rows.get(store + '/' + key),
    put: async (store, value) => { rows.set(store + '/' + value.day, value); },
    _only: () => (rows.size === 1 ? [...rows.values()][0] : null)
  };
}

const err = (status, gs, message) => ({ error: { code: status, status: gs, message: message } });

/* ══════════════════════════════════════════════════════
   1. `[N]` errorParser — 16-D0 다섯 줄 + 경계
   ══════════════════════════════════════════════════════ */

test('R1 ★ 400 + FAILED_PRECONDITION → REGION (16-D0 [N])', () => {
  assert.equal(gemini.errorParser(400, err(400, 'FAILED_PRECONDITION', 'Precondition check failed.')), 'REGION');
  // 메시지가 없어도 상태 조합만으로 REGION 이다.
  assert.equal(gemini.errorParser(400, err(400, 'FAILED_PRECONDITION')), 'REGION');
});

test('R2 ★ 403 + "User location is not supported" → REGION (AUTH 가 아니다)', () => {
  // ★ 판정 순서를 깨서 AUTH 를 먼저 보게 하면 이 테스트가 빨개진다.
  assert.equal(gemini.errorParser(403, err(403, 'PERMISSION_DENIED', REGION_MSG)), 'REGION');
  assert.equal(gemini.errorParser(403, err(403, undefined, REGION_MSG)), 'REGION');
});

test('R3 ★ 400 + 지역 문구 → REGION (BAD_REQUEST 가 아니다)', () => {
  // ★ BAD_REQUEST 를 먼저 보게 하면 빨개진다.
  assert.equal(gemini.errorParser(400, err(400, 'INVALID_ARGUMENT', REGION_MSG)), 'REGION');
});

test('R4 사용자 결정 B — 대소문자를 무시하고, location 과 not supported 가 **둘 다** 있어야 한다', () => {
  assert.equal(gemini.errorParser(403, err(403, '', 'USER LOCATION IS NOT SUPPORTED for the API use.')), 'REGION');
  assert.equal(gemini.errorParser(403, err(403, '', 'Your location is Not Supported')), 'REGION');
  // 한쪽만 있으면 REGION 이 아니다 — 키 오류를 지역 제한으로 오안내하지 않는다.
  assert.equal(gemini.errorParser(403, err(403, '', 'Location header missing')), 'AUTH');
  assert.equal(gemini.errorParser(400, err(400, 'INVALID_ARGUMENT', 'This model is not supported')), 'BAD_REQUEST');
});

test('R5 403(지역 문구 없음) → AUTH, 401 → AUTH', () => {
  assert.equal(gemini.errorParser(403, err(403, 'PERMISSION_DENIED', 'Method doesn\'t allow unregistered callers.')), 'AUTH');
  assert.equal(gemini.errorParser(403, null), 'AUTH');
  assert.equal(gemini.errorParser(401, err(401, 'UNAUTHENTICATED', 'API key not valid.')), 'AUTH');
});

test('R6 400 + INVALID_ARGUMENT → BAD_REQUEST, 429 → RATE_LIMIT', () => {
  assert.equal(gemini.errorParser(400, err(400, 'INVALID_ARGUMENT', 'Invalid JSON payload received.')), 'BAD_REQUEST');
  assert.equal(gemini.errorParser(429, err(429, 'RESOURCE_EXHAUSTED', 'Quota exceeded.')), 'RATE_LIMIT');
  assert.equal(gemini.errorParser(429, null), 'RATE_LIMIT');
});

test('R7 FAILED_PRECONDITION 이라도 400 이 아니면 지역 판정을 상태 조합으로 하지 않는다', () => {
  // 사용자 분기는 `s === 400 && gs === 'FAILED_PRECONDITION'` 이다. 500 은 SERVER.
  assert.equal(gemini.errorParser(500, err(500, 'FAILED_PRECONDITION', 'internal')), 'SERVER');
});

/* ══════════════════════════════════════════════════════
   2. provider.js 가 REGION 을 그대로 흘려보낸다
   ══════════════════════════════════════════════════════ */

test('P1 ★ CODES.REGION 이 있다', () => {
  assert.equal(CODES.REGION, 'REGION');
});

test('P2 ★ verifyKey — 400 FAILED_PRECONDITION → {ok:false, code:REGION, canSave:true} (8-4)', async () => {
  const f = stubFetch(() => jsonRes(400, err(400, 'FAILED_PRECONDITION', REGION_MSG)));
  const r = await verifyKey(NEW_KEY, { fetch: f, db: stubDb() });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'REGION');
  assert.equal(r.canSave, true, '지역 제한은 키 저장을 막지 않는다 — 키는 멀쩡할 수 있다');
  assert.equal(r.status, 400);
});

test('P3 ★ verifyKey — 403 + 지역 문구 → REGION, 저장 허용 (AUTH 의 canSave:false 와 반대)', async () => {
  const f = stubFetch(() => jsonRes(403, err(403, 'PERMISSION_DENIED', REGION_MSG)));
  const r = await verifyKey(NEW_KEY, { fetch: f, db: stubDb() });
  assert.equal(r.code, 'REGION');
  assert.equal(r.canSave, true);
});

test('P4 ★ complete — REGION 은 ProviderError.code 로 그대로 나온다', async () => {
  const f = stubFetch(() => jsonRes(400, err(400, 'FAILED_PRECONDITION', REGION_MSG)));
  await assert.rejects(
    complete({ user: 'x', json: false }, { key: NEW_KEY, fetch: f, db: stubDb() }),
    (e) => e instanceof ProviderError && e.code === 'REGION' && e.status === 400
  );
});

test('P5 ★ verifyKey 의 실패 메시지는 서버가 키를 되비춰도 지워져 있다', async () => {
  for (const key of [NEW_KEY, OLD_KEY, ODD_KEY]) {
    const f = stubFetch(() => jsonRes(403, err(403, 'PERMISSION_DENIED', REGION_MSG + ' key=' + key)));
    const r = await verifyKey(key, { fetch: f, db: stubDb() });
    assert.equal(r.code, 'REGION');
    assert.ok(!JSON.stringify(r).includes(key), '결과 어디에도 키가 없어야 한다: ' + key);
  }
});

/* ══════════════════════════════════════════════════════
   3. 검증 결과 다섯 갈래 (16-D0 [D]) — 서로 다른 문구, 지역 제한에 [키 설정] 없음
   ══════════════════════════════════════════════════════ */

const FIVE = [
  { name: '유효', res: () => jsonRes(200, { models: [] }), want: OUTCOME.VALID },
  { name: '무효', res: () => jsonRes(401, err(401, 'UNAUTHENTICATED', 'API key not valid.')), want: OUTCOME.INVALID },
  { name: '한도', res: () => jsonRes(429, err(429, 'RESOURCE_EXHAUSTED', 'Quota')), want: OUTCOME.LIMITED },
  { name: '지역 제한', res: () => jsonRes(400, err(400, 'FAILED_PRECONDITION', REGION_MSG)), want: OUTCOME.REGION },
  { name: '확인 불가', res: () => { throw new TypeError('Failed to fetch'); }, want: OUTCOME.UNKNOWN }
];

test('V1 ★ fetch 스텁 5종 → 다섯 갈래가 각각 나온다', async () => {
  for (const c of FIVE) {
    const r = await runVerify({ key: NEW_KEY, fetch: stubFetch(c.res), db: stubDb() });
    assert.equal(r.outcome, c.want, c.name);
  }
});

test('V2 ★ 다섯 갈래의 문구 키가 모두 다르고, 네 언어 모두에서 문장이 다르다', () => {
  const ks = FIVE.map((c) => outcomeKey(c.want, 'verify'));
  assert.equal(new Set(ks).size, 5, ks.join(','));
  for (const lang of LANGS) {
    const texts = ks.map((k) => BUNDLES[lang][k]);
    for (const s of texts) assert.equal(typeof s, 'string', lang + ' 에 문구가 없다');
    assert.equal(new Set(texts).size, 5, lang + ' — 다섯 갈래 문구가 겹친다');
  }
});

test('V3 ★ 지역 제한 — [키 설정]으로 보내지 않는다 (14-2)', () => {
  const n = stateNotice(CODES.REGION, 'Google Gemini');
  assert.equal(n.key, 'ai.state.region');
  assert.equal(n.params.provider, 'Google Gemini');
  assert.ok(n.actions.every((a) => a.nav !== SETTINGS_AI_HASH && !/settings/.test(a.nav)), '지역 제한 안내에 [키 설정]이 붙었다');
  // 문구에도 [키 설정] 버튼 글자가 섞여 있지 않다.
  for (const lang of LANGS) {
    const label = BUNDLES[lang]['settings.ai.open'];
    for (const k of ['ai.state.region', 'settings.ai.verify.region']) {
      assert.ok(!BUNDLES[lang][k].includes(label), lang + '.' + k + ' 에 [키 설정] 글자가 있다');
      assert.ok(BUNDLES[lang][k].includes('{provider}'), lang + '.' + k + ' 에 {provider} 가 없다');
    }
  }
});

test('V4 키 없음 안내에는 [키 설정] 딥링크가 있다 (12-2 · 7b ⑤ 입구)', () => {
  const n = stateNotice(CODES.NO_KEY, 'x');
  assert.equal(n.key, 'ai.state.noKey');
  assert.deepEqual(n.actions, [{ key: 'settings.ai.open', nav: SETTINGS_AI_HASH }]);
  assert.equal(stateNotice('RATE_LIMIT', 'x'), null);
});

test('V5 verifyOutcome — 429 는 ok:true 로 와도 "한도"다 (유효보다 먼저)', () => {
  assert.equal(verifyOutcome({ ok: true, code: 'RATE_LIMIT', limited: true }), OUTCOME.LIMITED);
  assert.equal(verifyOutcome({ ok: true, code: null }), OUTCOME.VALID);
  assert.equal(verifyOutcome({ ok: false, code: 'NO_KEY' }), OUTCOME.NO_KEY);
  assert.equal(verifyOutcome({ ok: false, code: 'SERVER' }), OUTCOME.UNKNOWN);
  assert.equal(verifyOutcome({ ok: false, code: 'BAD_REQUEST' }), OUTCOME.UNKNOWN);
  assert.equal(verifyOutcome(null), OUTCOME.UNKNOWN);
  assert.equal(errorOutcome('ABORTED'), OUTCOME.ABORTED);
  assert.equal(outcomeKey(OUTCOME.ABORTED, 'verify'), null);
  assert.equal(outcomeKey(OUTCOME.VALID, 'test'), 'settings.ai.test.valid');
});

test('V6 확인 불가 — 네트워크·CORS 깃발이 화면까지 온다 (8-3)', async () => {
  const r = await runVerify({ key: NEW_KEY, fetch: stubFetch(() => { throw new TypeError('Failed to fetch'); }), db: stubDb() });
  assert.equal(r.outcome, OUTCOME.UNKNOWN);
  assert.equal(r.maybeBlocked, true);
  assert.equal(r.canSave, true);
});

test('V7 걸린 시간은 주입한 시계로 잰다 · 코드 표시에 키가 들어갈 자리가 없다', async () => {
  let now = 1000;
  const clock = () => now;
  const f = stubFetch(() => { now += 321; return jsonRes(200, { models: [] }); });
  const r = await runVerify({ key: NEW_KEY, fetch: f, db: stubDb(), clock });
  assert.equal(r.ms, 321);
  assert.equal(codeLabel(r.code, r.status), 'OK · HTTP 200');
  assert.equal(codeLabel('REGION', 400), 'REGION · HTTP 400');
  assert.equal(codeLabel('UNKNOWN', 0), 'UNKNOWN');
});

/* ══════════════════════════════════════════════════════
   4. [시험 번역] (12-7 1번)
   ══════════════════════════════════════════════════════ */

test('T1 ★ 고정 예문은 지어낸 **의학** 두 문장이고, 한 번에 아랍어·한국어를 JSON 으로 받는다 [수정 2026-10-08]', () => {
  assert.equal(TEST_SAMPLE.length, 2);
  for (const s of TEST_SAMPLE) assert.match(s, /^[A-Z][^.?!]*[.?!]$/, '한 문장이어야 한다: ' + s);
  const all = TEST_SAMPLE.join(' ');
  // 질환명·약물명·숫자/단위가 들어 있다 — 일상문으로는 의학 번역 품질을 볼 수 없었다.
  assert.match(all, /arthritis/i);
  assert.match(all, /methotrexate|adalimumab/i);
  assert.match(all, /\d+\s*(mg\/L|minutes)/);
  // 치료 지시·용량 권고로 읽히지 않는다.
  assert.ok(!/\b(take|should|must|dose of|daily)\b/i.test(all), '지시·용량 권고처럼 읽힌다: ' + all);
  // 이전 일상문은 사라졌다.
  assert.ok(!/glass of water/i.test(all));

  const req = buildTestRequest();
  assert.equal(req.json, true, '[수정 2026-10-08] JSON 으로 두 언어를 받는다');
  assert.deepEqual([...req.schema.required], ['ar', 'ko']);
  assert.ok(req.user.includes('<<<DOC\n' + all + '\n>>>'), '예문은 DOC 구분자 안에 있다(10-1)');
  // 본문에 json 강제와 스키마가 실제로 실렸는가 — 어댑터 본문으로 확인한다.
  const body = gemini.bodyBuilder(req, 'gemini-3.5-flash-lite');
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(Object.keys(body.generationConfig.responseSchema.properties), ['ar', 'ko']);
});

test('T2 ★ 성공 — 번역문·걸린 시간·결과 코드, usage 는 kind:translate (12-7)', async () => {
  let now = 50;
  const db = stubDb();
  const pair = { ar: 'التهاب المفاصل الروماتويدي (rheumatoid arthritis)', ko: '류마티스 관절염(rheumatoid arthritis)' };
  const f = stubFetch(() => {
    now += 1234;
    return jsonRes(200, {
      candidates: [{ content: { parts: [{ text: '  ' + JSON.stringify(pair) + '  ' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 15 }
    });
  });
  const r = await runTestTranslation({ key: NEW_KEY, fetch: f, db, clock: () => now });
  assert.equal(r.outcome, OUTCOME.VALID);
  assert.equal(r.text, JSON.stringify(pair));
  assert.deepEqual(r.pair, pair);
  assert.equal(r.ms, 1234);
  assert.equal(r.code, 'OK');
  assert.equal(f.calls.length, 1, '1회만 보낸다');
  assert.equal(f.calls[0].init.method, 'POST');
  assert.ok(!f.calls[0].url.includes(NEW_KEY), '키는 URL 에 없다');
  assert.equal(f.calls[0].init.headers['x-goog-api-key'], NEW_KEY, '키는 헤더로 간다');
  const row = db._only();
  assert.equal(row.byKind.translate, 1, 'usage 에 kind:translate 로 기록된다');
});

test('T3 ★ 시험 번역도 같은 다섯 갈래 — 생성만 지역으로 막히는 경우를 가른다 (8-4)', async () => {
  const cases = [
    [() => jsonRes(403, err(403, 'PERMISSION_DENIED', REGION_MSG)), OUTCOME.REGION],
    [() => jsonRes(400, err(400, 'FAILED_PRECONDITION', 'x')), OUTCOME.REGION],
    [() => jsonRes(401, err(401, 'UNAUTHENTICATED', 'bad')), OUTCOME.INVALID],
    [() => jsonRes(429, err(429, 'RESOURCE_EXHAUSTED', 'q')), OUTCOME.LIMITED],
    [() => { throw new TypeError('Failed to fetch'); }, OUTCOME.UNKNOWN],
    [() => jsonRes(500, {}), OUTCOME.UNKNOWN]
  ];
  for (const [h, want] of cases) {
    const r = await runTestTranslation({ key: NEW_KEY, fetch: stubFetch(h), db: stubDb() });
    assert.equal(r.outcome, want);
    assert.equal(r.text, '');
  }
});

test('T4 ★ 시험 번역 — 오류 메시지·결과 어디에도 키가 없다 (서버가 되비춰도)', async () => {
  for (const key of [NEW_KEY, OLD_KEY, ODD_KEY]) {
    const f = stubFetch(() => jsonRes(400, err(400, 'INVALID_ARGUMENT', 'bad request for ' + key)));
    const r = await runTestTranslation({ key, fetch: f, db: stubDb() });
    assert.ok(!JSON.stringify(r).includes(key), key);
    const g = stubFetch(() => { throw new Error('boom ' + key); });
    const r2 = await runTestTranslation({ key, fetch: g, db: stubDb() });
    assert.ok(!JSON.stringify(r2).includes(key), key);
  }
});

test('T5 ★ 모델 칸에 키가 들어가 있어도 보내지 않고, 결과에 키가 없다 (16-D0 마지막 줄)', async () => {
  const f = stubFetch(() => jsonRes(200, {}));
  const r = await runTestTranslation({ key: NEW_KEY, model: NEW_KEY, fetch: f, db: stubDb() });
  assert.equal(f.calls.length, 0, 'assertNoKeyInUrl 이 보내기 전에 막아야 한다');
  assert.equal(r.outcome, OUTCOME.UNKNOWN);
  assert.equal(r.code, 'BAD_REQUEST');
  assert.ok(!JSON.stringify(r).includes(NEW_KEY));
});

test('T6 키가 없으면 네트워크를 건드리지 않는다', async () => {
  const f = stubFetch(() => jsonRes(200, {}));
  const r = await runTestTranslation({ key: '', fetch: f, db: stubDb() });
  assert.equal(r.outcome, OUTCOME.NO_KEY);
  assert.equal(f.calls.length, 0);
  const v = await runVerify({ key: '   ', fetch: f, db: stubDb() });
  assert.equal(v.outcome, OUTCOME.NO_KEY);
  assert.equal(f.calls.length, 0);
});

/* ══════════════════════════════════════════════════════
   5. 키 형식 경고 (16-D0 [D] — 경고만, 저장은 막지 않는다)
   ══════════════════════════════════════════════════════ */

test('F1 ★ 구형 AIza…·신형 AQ.… 는 경고 없음, 다른 형식은 경고만', () => {
  assert.equal(formatWarningKey('gemini', NEW_KEY), null);
  assert.equal(formatWarningKey('gemini', OLD_KEY), null);
  assert.equal(formatWarningKey('gemini', ODD_KEY), 'settings.ai.key.unfamiliar');
  // 경고여도 형식 검사는 ok — 저장을 막을 근거가 아니다(8-4).
  const r = checkKeyFormat('gemini', ODD_KEY);
  assert.equal(r.ok, true);
  assert.equal(r.code, KEY_FORMAT.UNFAMILIAR);
  assert.equal(formatWarningKey('gemini', ''), null);
});

/* ══════════════════════════════════════════════════════
   6. 번역 따라가기 (16-D0 [D]) — 기본값과 같은 그리기 함수
   ══════════════════════════════════════════════════════ */

test('A1 ★ 기본값 — readalong.mode = speak, speakSource = true (사용자 확정)', () => {
  assert.equal(DEFAULTS['readalong.mode'], 'speak');
  assert.equal(DEFAULTS['readalong.speakSource'], true);
  assert.equal(DEFAULT_READALONG_MODE, 'speak');
  assert.deepEqual([...READALONG_MODES], ['off', 'show', 'speak']);
  const s = readalongState((k) => DEFAULTS[k]);
  assert.deepEqual(s, { mode: 'speak', speakSource: true, sourceEnabled: true });
});

test('A2 모르는 값은 기본으로, speakSource 는 false 로 명시했을 때만 꺼진다', () => {
  assert.equal(normalizeReadalongMode('loud'), 'speak');
  assert.equal(normalizeReadalongMode(undefined), 'speak');
  assert.equal(normalizeReadalongMode('off'), 'off');
  const s = readalongState((k) => ({ 'readalong.mode': 'show', 'readalong.speakSource': false })[k]);
  assert.deepEqual(s, { mode: 'show', speakSource: false, sourceEnabled: false });
  assert.equal(readalongState((k) => (k === 'readalong.mode' ? 'speak' : undefined)).speakSource, true);
});

test('A3 ★ 설정 AI 탭과 속도 팝오버가 **같은 그리기 함수**를 쓴다 (12-3 · 16-D0)', () => {
  const controls = readFileSync(new URL('../js/ui/controls.js', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/ui/settings.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(controls, /import\s*\{\s*renderReadalongRow\s*\}\s*from\s*'\.\/settings\.js'/);
  assert.match(controls, /renderReadalongRow\(els\.readalongHost\)/);
  assert.match(ui, /renderReadalongRow\(els\.readalongHost\)/);
  // 정적 HTML 에는 빈 그릇이 두 개(설정·팝오버) 있고, 모드 버튼은 HTML 에 없다.
  assert.equal((html.match(/data-readalong-host/g) || []).length, 2);
  assert.ok(!/data-readalong-mode/.test(html), '모드 버튼은 그리기 함수가 만든다');
  // "나중에 켜집니다" 같은 문구를 두지 않는다(12-7).
  for (const lang of LANGS) {
    for (const [k, v] of Object.entries(BUNDLES[lang])) {
      if (k.indexOf('readalong') < 0) continue;
      assert.ok(!/8b/.test(v), lang + '.' + k + ' 에 단계 안내가 있다');
    }
  }
});

test('A4 번역 언어 자국어 이름 · 번역문 음성 유무 (voices = [] 스텁)', () => {
  assert.equal(nativeLangName('ar'), 'العربية');
  assert.equal(nativeLangName('ko'), '한국어');
  assert.equal(voiceStatus('ar', []), 'no');
  assert.equal(voiceStatus('ar', [{ lang: 'ar_SA', name: 'x' }]), 'yes', 'Android 의 언더스코어도 잡는다');
  assert.equal(voiceStatus('ar', [{ lang: 'en-US', name: 'x' }]), 'no');
});

/* ══════════════════════════════════════════════════════
   7. 동의·상한·경고 컴포넌트·문구 규칙
   ══════════════════════════════════════════════════════ */

test('C1 ★ 동의 전이면 AI 버튼은 동의 카드로 간다 (13절)', () => {
  assert.equal(needsConsent(null), true);
  assert.equal(needsConsent(''), true);
  assert.equal(needsConsent(undefined), true);
  assert.equal(needsConsent('2026-10-03T00:00:00.000Z'), false);
  const ui = readFileSync(new URL('../js/ui/settings.js', import.meta.url), 'utf8');
  // 두 버튼 핸들러가 모두 동의 관문을 지난다.
  assert.match(ui, /async function onVerify\(\) \{\s*if \(busy \|\| !requireConsent\(\)\) return;/);
  assert.match(ui, /async function onTest\(\) \{\s*if \(busy \|\| !requireConsent\(\)\) return;/);
});

test('C2 일일 상한 — 1 이상의 정수만', () => {
  assert.equal(parseDailyCap('100'), 100);
  assert.equal(parseDailyCap('12.7'), 12);
  assert.equal(parseDailyCap('0'), null);
  assert.equal(parseDailyCap('-3'), null);
  assert.equal(parseDailyCap('abc'), null);
  assert.equal(parseDailyCap(''), null);
  assert.equal(DEFAULTS['ai.dailyCap'], 100);
  assert.equal(DEFAULTS['ai.cacheLimitMB'], 200, '9-3 [수정 2026-09-28]');
});

test('C3 ★ piiWarning — 아랍어가 언제나 첫 줄, UI 가 아랍어면 한 줄만 (12-7)', () => {
  const ar = piiWarningTexts('ar');
  assert.equal(ar.length, 1);
  assert.equal(ar[0].lang, 'ar');
  assert.equal(ar[0].dir, 'rtl');
  for (const ui of ['en', 'fr', 'ko']) {
    const lines = piiWarningTexts(ui);
    assert.equal(lines.length, 2);
    assert.equal(lines[0].lang, 'ar');
    assert.equal(lines[1].lang, ui);
    assert.equal(lines[1].text, BUNDLES[ui][PII_KEY]);
  }
  assert.equal(piiWarningTexts('xx').length, 1, '모르는 언어는 아랍어 한 줄');
});

test('C4 ★ 무료 티어 한도 숫자를 문구에 쓰지 않는다 (8-4) — 새 문구에 숫자 0건', () => {
  const scoped = (k) => /^(settings\.(ai|readalong)|readalong\.|ai\.state\.|privacy\.pii)/.test(k);
  for (const lang of LANGS) {
    for (const [k, v] of Object.entries(BUNDLES[lang])) {
      if (!scoped(k)) continue;
      assert.ok(!/[0-9٠-٩]/.test(v.replace(/\{\w+\}/g, '')), lang + '.' + k + ' 에 숫자가 있다: ' + v);
    }
  }
});

test('C5 ★ 새 UI 파일은 console·innerHTML 을 쓰지 않는다 (13절)', () => {
  for (const f of ['../js/ui/settings.js', '../js/ui/notice.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(!/\bconsole\s*\./.test(src), f + ' 가 console 을 부른다');
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(src), f + ' 가 HTML 문자열을 꽂는다');
  }
});

test('C6 ★ 화면 이동 버튼은 data-nav 하나 — 입구 세 곳 (12-7)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  // 서재 상단바 [설정] · 속도 팝오버 [번역 설정]
  assert.match(html, /data-i18n="nav\.settings" data-nav="#\/settings\/ai"/);
  assert.match(html, /data-nav="#\/settings\/ai" data-i18n="reader\.readalong\.settings"/);
  // 키 없음 안내 [키 설정] — main.js 가 actions 를 data-nav 버튼으로 그린다.
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(main, /b\.setAttribute\('data-nav', a\.nav\)/);
  // 새 CSS 에 물리 방향 속성이 없다(16-H).
  const css = readFileSync(new URL('../css/screens.css', import.meta.url), 'utf8');
  const tail = css.slice(css.indexOf('설정 — AI 탭'));
  assert.ok(tail.length > 100);
  assert.ok(!/(^|[^-])\b(left|right)\s*:|margin-(left|right)|padding-(left|right)|border-(left|right)/.test(tail));
});

test('C7 ★ 9-3 — API 키는 settings 스토어 기본값에 없다', () => {
  for (const k of Object.keys(DEFAULTS)) assert.ok(!/key\b/i.test(k) || k === 'privacy.rememberKey', k);
});

/* ── Review 7b 가 더한 것 ─────────────────────────────── */

test('C8 ★ "이 기기에 기억" 확인란이 이미 저장된 키를 옮긴다 — 끄면 localStorage 에서 지운다 (13절)', () => {
  // Review 변이: 이 호출을 빼도 631개가 전부 통과했다(화면 결선은 node 에서 안 보인다).
  // keys.setRemember 의 동작 자체는 keys-7a 가 고정하고, 여기서는 화면이 그것을 부르는지만 본다.
  // 주석은 걷어 낸다 — 주석 처리된 호출이 통과로 세어지지 않게.
  const ui = readFileSync(new URL('../js/ui/settings.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const body = ui.slice(ui.indexOf('function onRememberChange()'));
  assert.ok(body.length > 0, 'onRememberChange 가 없다');
  const fn = body.slice(0, body.indexOf('\n}\n'));
  assert.match(fn, /keys\.setRemember\(providerId\(\),\s*on\)/, '확인란을 바꿔도 저장된 키가 옮겨지지 않는다');
  assert.match(ui, /els\.remember\.addEventListener\('change', onRememberChange\)/);
});

test('V8 ★ 지역 제한 문구 — "API" 를 밝히고, VPN·우회를 말하지 않는다 (8-2 · 13절)', () => {
  // Nour 는 시리아에서 소비자용 Gemini 앱을 쓴다. 문구가 "Gemini 를 못 쓴다"로 읽히면
  // 자기 경험과 어긋나 문구를 믿지 않는다 — 막힌 것은 **API** 다.
  for (const lang of LANGS) {
    for (const k of ['ai.state.region', 'settings.ai.verify.region']) {
      const v = BUNDLES[lang][k];
      assert.ok(/\bAPI\b/.test(v), lang + '.' + k + ' 에 API 가 없다: ' + v);
      assert.ok(!/vpn|proxy|우회|프록시|contourn|وكيل|بروكسي/i.test(v), lang + '.' + k + ' 가 우회를 안내한다: ' + v);
    }
  }
});

/* ══════════════════════════════════════════════════════
   8. 7b Review R1 — 무효 키(400 INVALID_ARGUMENT + API_KEY_INVALID)는 AUTH
   ══════════════════════════════════════════════════════ */

const BAD_KEY_MSG = 'API key not valid. Please pass a valid API key.';
const BAD_KEY_BODY = {
  error: {
    code: 400, status: 'INVALID_ARGUMENT', message: BAD_KEY_MSG,
    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }]
  }
};

test('K1 ★ 400 INVALID_ARGUMENT + details.reason API_KEY_INVALID → AUTH (BAD_REQUEST 가 아니다)', () => {
  assert.equal(gemini.errorParser(400, BAD_KEY_BODY), 'AUTH');
  // details 의 **어느 항목이든** — 첫 항목이 다른 종류여도 잡는다.
  const mixed = { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'x',
    details: [{ '@type': 'type.googleapis.com/google.rpc.Help' }, null, { reason: 'API_KEY_INVALID' }] } };
  assert.equal(gemini.errorParser(400, mixed), 'AUTH');
});

test('K2 ★ details 없이 메시지만 "API key not valid" 여도 AUTH (대소문자 무시)', () => {
  assert.equal(gemini.errorParser(400, err(400, 'INVALID_ARGUMENT', BAD_KEY_MSG)), 'AUTH');
  assert.equal(gemini.errorParser(400, err(400, '', 'API KEY NOT VALID.')), 'AUTH');
});

test('K3 400 INVALID_ARGUMENT + 다른 메시지는 여전히 BAD_REQUEST', () => {
  assert.equal(gemini.errorParser(400, err(400, 'INVALID_ARGUMENT', 'Invalid JSON payload received.')), 'BAD_REQUEST');
  assert.equal(gemini.errorParser(400, { error: { status: 'INVALID_ARGUMENT', message: 'bad', details: [{ reason: 'OTHER' }] } }), 'BAD_REQUEST');
});

test('K4 ★ 순서 고정 — 지역 문구가 섞인 400 은 무효 키 표지가 있어도 REGION', () => {
  const both = { error: { code: 400, status: 'INVALID_ARGUMENT', message: REGION_MSG + ' ' + BAD_KEY_MSG,
    details: [{ reason: 'API_KEY_INVALID' }] } };
  assert.equal(gemini.errorParser(400, both), 'REGION');
  assert.equal(gemini.errorParser(400, { error: { status: 'FAILED_PRECONDITION', message: BAD_KEY_MSG } }), 'REGION');
});

test('K5 ★ verifyKey·runVerify — 무효 키 응답은 "무효"이고 저장 불가 (틀린 키가 저장되지 않는다)', async () => {
  const r = await verifyKey(NEW_KEY, { fetch: stubFetch(() => jsonRes(400, BAD_KEY_BODY)), db: stubDb() });
  assert.equal(r.code, 'AUTH');
  assert.equal(r.canSave, false);
  const v = await runVerify({ key: NEW_KEY, fetch: stubFetch(() => jsonRes(400, BAD_KEY_BODY)), db: stubDb() });
  assert.equal(v.outcome, OUTCOME.INVALID);
  assert.equal(v.canSave, false);
  const tr = await runTestTranslation({ key: NEW_KEY, fetch: stubFetch(() => jsonRes(400, BAD_KEY_BODY)), db: stubDb() });
  assert.equal(tr.outcome, OUTCOME.INVALID);
});
