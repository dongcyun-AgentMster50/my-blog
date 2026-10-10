/* ============================================================
   tests/key-shape-p1.test.mjs — 공개 전 묶음 P1 ③ 키 형식 경고 · 키 가리기 (spec 8-4 `[수정 2026-10-12]` · 13절)

   사실(오케스트레이터 재현): 옛 지우개 `AQ\.[0-9A-Za-z_\-]{20,}` 은 몸통에 `.`·`~` 등이 든 키를
   **통째로** 놓쳤다. Nour 의 정상 키에는 "형식이 낯섭니다" 경고가 떴다 — 그런 글자가 있을 가능성이 높다.
   그리고 `ProviderError` 생성자는 실제 키 값 없이 패턴만 썼다.

   ★ 가짜 키는 **실행 중에 이어 붙여** 만든다 — 소스에 한 덩어리로 두지 않는다(GitHub 비밀 스캐너).
     전부 `DUMMY`·`NOTREAL` 이 박힌 더미다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { redact, redactString, setSecretSource } from '../js/privacy/redact.js';
import {
  complete, verifyKey, checkKeyFormat, diagnoseKey, ProviderError, CODES, KEY_FORMAT
} from '../js/ai/provider.js';
import { formatWarningKey, keyDiagnosisParts, runVerify, runTestTranslation } from '../js/ui/settings.js';
import { AI_KEY_PATTERNS, REDACT_PATTERNS, KEY_SHAPES, AI } from '../js/config.js';
import { BUNDLES, LANGS } from '../js/i18n/index.js';

/* ── 가짜 키 — 실행 중에 만든다 ─────────────────────── */
const join = (...p) => p.join('');
const HEAD = join('A', 'Q', '.');
/** 몸통에 문제 글자 `c` 가 든 신형 가짜 키. 문제 글자 뒤에도 긴 꼬리가 있다(통째로 놓치는지 보려고). */
const keyWith = (c) => join(HEAD, 'Ab', 'DUMMY', 'x7', c, 'NOTREAL', 'KEY', 'tail', '0042');
const PUNCT = ['.', '~', '+', '/', '='];
const KEYS = PUNCT.map(keyWith);
const MIXED = join(HEAD, 'Ab', 'DUM', '.', 'MY~', 'NOT+', 'REAL/', 'KEY=', 'zz', '99');

/** 키의 어떤 8글자 조각도 남아 있으면 안 된다(부분 유출까지 잡는다). */
function assertNoFragment(out, key, label) {
  const s = typeof out === 'string' ? out : JSON.stringify(out);
  for (let i = 0; i + 8 <= key.length; i++) {
    const frag = key.slice(i, i + 8);
    assert.equal(s.includes(frag), false, (label || '') + ' 키 조각 "' + frag + '" 이 남았다: ' + s);
  }
}

/* ── 저장소 흉내(sessionStorage) ────────────────────── */
function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear()
  };
}
function withStoredKey(key, fn) {
  const prev = globalThis.sessionStorage;
  const st = memStorage();
  st.setItem(AI.KEY_STORAGE_PREFIX + 'gemini', key);
  globalThis.sessionStorage = st;
  const done = () => { if (prev === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = prev; };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') return r.finally(done);
    done();
    return r;
  } catch (e) { done(); throw e; }
}

/* ── fetch·db 스텁 ──────────────────────────────────── */
function stubFetch(handler) {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url: String(url), init: init || {} }); return handler(url, init); };
  fn.calls = calls;
  return fn;
}
const jsonRes = (status, body) => ({
  ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body
});
function stubDb() {
  const rows = new Map();
  return {
    get: async (s, k) => rows.get(s + '/' + k),
    put: async (s, v) => { rows.set(s + '/' + v.day, v); },
    _all: () => [...rows.values()]
  };
}

/** 이 블록 동안 console.* 로 나간 모든 것을 모은다. */
async function captureConsole(fn) {
  const seen = [];
  const names = ['log', 'info', 'warn', 'error', 'debug'];
  const saved = {};
  for (const n of names) { saved[n] = console[n]; console[n] = (...a) => { seen.push(a.map(String).join(' ')); }; }
  try { await fn(); } finally { for (const n of names) console[n] = saved[n]; }
  return seen.join('\n');
}

/* ══════════════════════════════════════════════════════
   (가) 패턴 — 두 곳이 같은 상수에서
   ══════════════════════════════════════════════════════ */

test('KS1 ★ 형식 검사와 지우개가 같은 상수에서 나온다 (두 벌 금지)', () => {
  assert.ok(REDACT_PATTERNS.includes(KEY_SHAPES.GOOGLE_AQ));
  assert.ok(REDACT_PATTERNS.includes(KEY_SHAPES.GOOGLE_AIZA));
  assert.ok(AI_KEY_PATTERNS.gemini.source.includes(KEY_SHAPES.GOOGLE_AQ.replace(/\//g, '\\/')) ||
            AI_KEY_PATTERNS.gemini.source.includes(KEY_SHAPES.GOOGLE_AQ));
  assert.ok(AI_KEY_PATTERNS.gemini.source.includes(KEY_SHAPES.GOOGLE_AIZA));
});

test('KS2 ★ 몸통에 . ~ + / = 가 든 신형 키 — 형식 경고 없음 (Nour 경고의 원인 후보 1)', () => {
  for (const k of KEYS.concat([MIXED])) {
    assert.equal(checkKeyFormat('gemini', k).code, KEY_FORMAT.OK, k.slice(0, 6));
    assert.equal(formatWarningKey('gemini', k), null);
  }
});

test('KS3 ★ 패턴만으로(실제 키 없이) 몸통에 . ~ + / = 가 든 키를 통째로 지운다', () => {
  for (const k of KEYS.concat([MIXED])) {
    for (const ctx of [
      'server said: ' + k + ' is bad',
      JSON.stringify({ error: { message: 'key ' + k } }),
      '<p>' + k + '</p>',
      "x-goog-api-key='" + k + "'",
      k
    ]) {
      const out = redactString(ctx);
      assertNoFragment(out, k, 'redactString');
      assert.ok(out.includes('[KEY]'));
    }
    assertNoFragment(redact(new Error('boom ' + k)), k, 'redact(Error)');
  }
});

test('KS4 ★ 20자 하한 — 정상 문장은 지우지 않는다 · 따옴표·꺾쇠·공백에서 끊긴다', () => {
  for (const s of ['AQ.1 level', 'See AQ.2 and AQ.3.', 'The AQ.short~key is fine', 'pH 7.4 AQ.abc']) {
    assert.equal(redactString(s), s, s);
  }
  const k = keyWith('.');
  assert.equal(redactString('"' + k + '","next":1'), '"[KEY]","next":1', 'JSON 따옴표에서 끊긴다');
  assert.equal(redactString('<b>' + k + '</b>'), '<b>[KEY]</b>', '꺾쇠에서 끊긴다');
  assert.equal(redactString(k + ' rest'), '[KEY] rest', '공백에서 끊긴다');
  // 출력 가능 ASCII 바깥(비 ASCII)은 몸통이 아니다 — 아랍어 문장과 붙어 있어도 문장을 먹지 않는다.
  assert.equal(redactString(k + 'مرحبا'), '[KEY]مرحبا');
});

/* ══════════════════════════════════════════════════════
   (나) 실제 키 값 — ProviderError 포함 모든 경로
   ══════════════════════════════════════════════════════ */

/** 패턴이 못 잡는 모양 — 몸통에 따옴표가 든 신형 키(경고는 뜬다). 실제 키 값 그물만 잡는다. */
const QUOTED = join(HEAD, 'Ab', 'DUMMY', '"', 'NOTREAL', 'KEY', 'quoted', '77');
const ODD = join('zz9', '-DUMMY', '-NOTREAL', '-KEY', '-p1', '-shape');

test('KS5 전제 — 패턴만으로는 QUOTED·ODD 의 꼬리를 못 지운다 (이 테스트들이 헛돌지 않게)', () => {
  assert.equal(redactString('x ' + ODD).includes(ODD), true);
  assert.equal(redactString('x ' + QUOTED).includes('NOTREALKEYquoted77'), true);
});

test('KS6 ★ ProviderError — 저장된 실제 키로도 지운다 (예전에는 패턴만)', () => {
  for (const k of [QUOTED, ODD].concat(KEYS)) {
    withStoredKey(k, () => {
      const e = new ProviderError({ code: CODES.UNKNOWN, status: 0, message: 'echo ' + k + ' end' });
      assertNoFragment(e.message, k, 'ProviderError.message');
      assertNoFragment(JSON.stringify(e.toJSON()), k, 'toJSON');
    });
  }
});

test('KS7 ★ ProviderError — 저장 안 된(입력 중) 키는 info.keys 로 지운다', () => {
  const e = new ProviderError({ code: CODES.UNKNOWN, status: 0, message: 'echo ' + ODD, keys: [ODD] });
  assertNoFragment(e.message, ODD);
  assert.equal('keys' in e, false, '키 목록을 오류 객체에 달고 다니지 않는다');
  assert.equal(JSON.stringify(e.toJSON()).includes('keys'), false);
});

test('KS8 ★ 저장된 키 그물은 redactString 의 모든 호출에 걸린다 (keys 를 잊은 호출자)', () => {
  withStoredKey(QUOTED, () => {
    assertNoFragment(redactString('forgot keys: ' + QUOTED), QUOTED);
    assertNoFragment(redact({ deep: ['x', 'y ' + QUOTED] }), QUOTED);
  });
  // 저장소가 비면 그 그물도 빈다(키를 지운 뒤 남지 않는다).
  assert.equal(redactString('x ' + ODD).includes(ODD), true);
});

test('KS9 공급자가 던져도 지우기는 멈추지 않는다 (패턴으로 계속)', () => {
  const k = keyWith('~');
  const prev = setSecretSource(() => { throw new Error('storage blocked'); });
  assert.equal(typeof prev, 'function', 'provider.js 가 공급자를 꽂아 두었다');
  try {
    assertNoFragment(redactString('x ' + k), k);
  } finally {
    setSecretSource(prev);           // provider.js 가 꽂은 공급자를 되돌린다
  }
});

test('KS10 ★ complete — 서버가 키를 되비춰도·fetch 가 키를 품고 던져도 ProviderError.message 와 usage 행에 없다', async () => {
  for (const k of KEYS.concat([MIXED, QUOTED, ODD])) {
    await withStoredKey(k, async () => {
      const db = stubDb();
      const logged = await captureConsole(async () => {
        const f400 = stubFetch(() => jsonRes(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'bad ' + k } }));
        await assert.rejects(complete({ user: 'U' }, { key: k, fetch: f400, db }), (e) => {
          assert.ok(e instanceof ProviderError);
          assertNoFragment(e.message, k, '400');
          return true;
        });
        const fThrow = stubFetch(() => { throw new TypeError('Failed to fetch ' + k); });
        await assert.rejects(complete({ user: 'U' }, { key: k, fetch: fThrow, db }), (e) => {
          assertNoFragment(e.message, k, 'fetch throw');
          return true;
        });
      });
      assertNoFragment(logged, k, 'console');
      for (const row of db._all()) assertNoFragment(JSON.stringify(row), k, 'usage');
      // 키는 헤더로는 실제로 갔다 — 단언이 공짜로 통과하지 않게.
    });
  }
});

test('KS11 ★ verifyKey · 설정 화면 [검증]·[시험 번역] 결과(화면에 그리는 문구 재료)에도 없다', async () => {
  for (const k of KEYS.concat([QUOTED, ODD])) {
    await withStoredKey(k, async () => {
      const echo = () => jsonRes(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'echo ' + k } });
      const v = await verifyKey(k, { fetch: stubFetch(echo), db: stubDb() });
      assertNoFragment(JSON.stringify(v), k, 'verifyKey');
      const logged = await captureConsole(async () => {
        const rv = await runVerify({ key: k, fetch: stubFetch(echo), db: stubDb() });
        assertNoFragment(JSON.stringify(rv), k, 'runVerify');
        const rt = await runTestTranslation({ key: k, fetch: stubFetch(echo), db: stubDb() });
        assertNoFragment(JSON.stringify(rt), k, 'runTestTranslation');
        const rt2 = await runTestTranslation({ key: k, fetch: stubFetch(() => { throw new Error('boom ' + k); }), db: stubDb() });
        assertNoFragment(JSON.stringify(rt2), k, 'runTestTranslation throw');
      });
      assertNoFragment(logged, k, 'console');
    });
  }
});

test('KS12 키는 헤더로는 실제로 간다 — 위 단언들이 공짜로 통과하지 않는다', async () => {
  const k = keyWith('.');
  const f = stubFetch(() => jsonRes(400, { error: { message: 'x' } }));
  await assert.rejects(complete({ user: 'U' }, { key: k, fetch: f, db: stubDb() }));
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].init.headers['x-goog-api-key'], k);
  assert.equal(f.calls[0].url.includes(k), false);
});

/* ══════════════════════════════════════════════════════
   (다) 형식 진단 — 키를 드러내지 않는다
   ══════════════════════════════════════════════════════ */

test('KS13 ★ diagnoseKey — 길이·알려진 시작·보통 밖 글자 종류와 개수만', () => {
  const k = join(HEAD, 'Ab', 'DUMMY', '​', 'NOT', ' ', 'REAL', '.', 'KEY', '.', 'x');
  const d = diagnoseKey(k);
  assert.equal(d.length, Array.from(k).length);
  assert.equal(d.knownHead, true);
  assert.deepEqual(d.odd, [{ label: '.', count: 2 }, { label: 'U+0020', count: 1 }, { label: 'U+200B', count: 1 }]);
  const s = JSON.stringify(d);
  for (const frag of ['DUMMY', 'NOT', 'REAL', 'KEY', 'Ab']) assert.equal(s.includes(frag), false, frag);
  assert.equal(diagnoseKey(join('sk', '-', 'DUMMYNOTREALKEY123456')).knownHead, false);
  assert.equal(diagnoseKey(''), null);
  assert.equal(diagnoseKey('   '), null);
});

test('KS14 ★ 경고 옆 진단 문구 — 네 언어, 키 조각 0, 경고가 뜨는 모양에서만 뜻이 있다', () => {
  const bad = join(HEAD, 'Ab', 'DUMMY', '​', 'NOTREALKEY', 'tail', '1234');
  assert.equal(formatWarningKey('gemini', bad), 'settings.ai.key.unfamiliar', '보이지 않는 글자는 여전히 경고');
  const parts = keyDiagnosisParts(bad);
  const text = parts.map((p) => (p.text !== undefined ? p.text : p.ltr)).join('');
  assertNoFragment(text, bad, '진단 줄');
  assert.ok(parts.some((p) => p.ltr === 'U+200B×1'), JSON.stringify(parts));
  const short = join(HEAD, 'Ab', 'DUMMY12');
  assert.equal(formatWarningKey('gemini', short), 'settings.ai.key.unfamiliar', '짧은 몸통은 경고');
  const sp = keyDiagnosisParts(short).map((p) => p.text || p.ltr).join('');
  assert.ok(sp.includes(String(short.length)), sp);
  for (const k of ['settings.ai.key.diag', 'settings.ai.key.diag.length', 'settings.ai.key.diag.head',
                   'settings.ai.key.diag.chars', 'settings.ai.key.diag.clean']) {
    for (const lang of LANGS) {
      assert.equal(typeof BUNDLES[lang][k], 'string', lang + ' ' + k);
    }
  }
  assert.ok(BUNDLES.en['settings.ai.key.diag.length'].includes('{len}'));
  for (const lang of LANGS) assert.ok(BUNDLES[lang]['settings.ai.key.diag.length'].includes('{len}'), lang);
});
