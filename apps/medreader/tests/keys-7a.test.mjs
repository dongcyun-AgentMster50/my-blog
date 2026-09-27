/* ============================================================
   tests/keys-7a.test.mjs — spec 13절 키 저장 · 9-3

   저장소는 **주입**한다(`tts/speaker.js` 가 `synth` 를 주입받는 것과 같다).
   Node 에는 `sessionStorage` 가 없고, 있다 해도 진짜를 쓰면 테스트끼리
   상태를 넘겨 준다.

   ★ 가장 중요한 것: **저장 위치를 바꾸면 이전 위치가 비워진다.**
     "이 기기에 기억"을 껐는데 `localStorage` 에 남아 있으면, 사용자는
     지웠다고 믿고 디스크에는 키가 남는다. 그 상태는 사용자가 알 방법이 없다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readKeySecret, readKeyMasked, saveKey, setRemember, clearKey,
  storedAt, hasKey, maskKey, storageKeyName,
  SESSION, LOCAL, NONE, CODES
} from '../js/privacy/keys.js';

/** 전부 가짜다. `AQ.` 접두사와 길이만 맞춘 더미. */
const KEY = 'AQ.Ab_DUMMY_NOT_A_REAL_KEY_6l';
const KEY2 = 'AIza' + 'SyDUMMY_NOT_A_REAL_KEY_000000000000';  // 값은 그대로 — 쪼개 두어야 GitHub 비밀 스캐너가 진짜 키로 오해하지 않는다

/** 최소한의 Storage 스텁. */
function mem() {
  const d = new Map();
  return {
    getItem: (k) => (d.has(k) ? d.get(k) : null),
    setItem: (k, v) => { d.set(k, String(v)); },
    removeItem: (k) => { d.delete(k); },
    _keys: () => [...d.keys()],
    _raw: d
  };
}

/** 접근만 해도 던지는 저장소 — 프라이빗 모드·쿠키 차단·샌드박스 iframe. */
function hostile() {
  return {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('SecurityError'); },
    removeItem() { throw new Error('SecurityError'); }
  };
}

function fresh() {
  const session = mem();
  const local = mem();
  return { session, local, stores: { session, local } };
}

test('9-3 저장소 키 이름은 medreader.key.{provider}', () => {
  assert.equal(storageKeyName('gemini'), 'medreader.key.gemini');
});

test('기본은 sessionStorage 다 (13절 — 탭 닫으면 소멸)', () => {
  const f = fresh();
  const r = saveKey('gemini', KEY, { stores: f.stores });
  assert.equal(r.ok, true);
  assert.equal(r.at, SESSION);
  assert.deepEqual(f.session._keys(), ['medreader.key.gemini']);
  assert.deepEqual(f.local._keys(), [], 'localStorage 에는 절대 들어가면 안 된다');
  assert.equal(storedAt('gemini', { stores: f.stores }), SESSION);
});

test('rememberKey 가 켜졌을 때만 localStorage 다', () => {
  const f = fresh();
  saveKey('gemini', KEY, { remember: true, stores: f.stores });
  assert.deepEqual(f.local._keys(), ['medreader.key.gemini']);
  assert.deepEqual(f.session._keys(), []);
  assert.equal(storedAt('gemini', { stores: f.stores }), LOCAL);
});

test('★ 세션 → 로컬 로 옮기면 세션이 비워진다', () => {
  const f = fresh();
  saveKey('gemini', KEY, { stores: f.stores });
  const r = setRemember('gemini', true, { stores: f.stores });
  assert.equal(r.ok, true);
  assert.equal(r.at, LOCAL);
  assert.equal(r.moved, true);
  assert.deepEqual(f.session._keys(), [], '이전 위치(session)가 남았다');
  assert.equal(f.local.getItem('medreader.key.gemini'), KEY);
});

test('★ 로컬 → 세션 로 옮기면 localStorage 에서 사라진다 (기억 끄기)', () => {
  const f = fresh();
  saveKey('gemini', KEY, { remember: true, stores: f.stores });
  assert.equal(f.local._keys().length, 1, '전제 확인');

  const r = setRemember('gemini', false, { stores: f.stores });
  assert.equal(r.at, SESSION);
  assert.deepEqual(f.local._keys(), [], '기억을 껐는데 디스크에 남았다');
  assert.equal(f.session.getItem('medreader.key.gemini'), KEY);
  // 원문은 그대로 옮겨져야 한다 — 옮기다 잃으면 사용자는 키를 다시 넣어야 한다.
  assert.equal(readKeySecret('gemini', { stores: f.stores }), KEY);
});

test('★ saveKey 는 늘 반대쪽을 비운다 — 두 곳에 동시에 남지 않는다', () => {
  const f = fresh();
  // 병적인 상태를 손으로 만든다(옛 버전이 남긴 찌꺼기 같은 것).
  f.local.setItem('medreader.key.gemini', KEY2);
  saveKey('gemini', KEY, { stores: f.stores });
  assert.deepEqual(f.local._keys(), [], '반대쪽 찌꺼기가 살아남았다');
  assert.equal(readKeySecret('gemini', { stores: f.stores }), KEY);
});

test('clearKey 는 양쪽 모두 지운다', () => {
  const f = fresh();
  f.session.setItem('medreader.key.gemini', KEY);
  f.local.setItem('medreader.key.gemini', KEY2);
  clearKey('gemini', { stores: f.stores });
  assert.deepEqual(f.session._keys(), []);
  assert.deepEqual(f.local._keys(), []);
  assert.equal(hasKey('gemini', { stores: f.stores }), false);
  assert.equal(storedAt('gemini', { stores: f.stores }), NONE);
});

test('프로바이더끼리 섞이지 않는다', () => {
  const f = fresh();
  saveKey('gemini', KEY, { stores: f.stores });
  saveKey('openai', KEY2, { stores: f.stores });
  assert.equal(readKeySecret('gemini', { stores: f.stores }), KEY);
  assert.equal(readKeySecret('openai', { stores: f.stores }), KEY2);
  clearKey('gemini', { stores: f.stores });
  assert.equal(readKeySecret('openai', { stores: f.stores }), KEY2, '남의 키를 지웠다');
});

/* ── 막힌 저장소 (13절 — 여기서 던지면 설정 화면이 통째로 죽는다) ── */

test('저장소가 막혀 있어도 던지지 않는다 — 읽기', () => {
  const stores = { session: hostile(), local: hostile() };
  assert.doesNotThrow(() => {
    assert.equal(readKeySecret('gemini', { stores }), null);
    assert.equal(hasKey('gemini', { stores }), false);
    assert.equal(storedAt('gemini', { stores }), NONE);
    assert.equal(readKeyMasked('gemini', { stores }), '');
  });
});

test('저장소가 막혀 있어도 던지지 않는다 — 쓰기·지우기', () => {
  const stores = { session: hostile(), local: hostile() };
  let r;
  assert.doesNotThrow(() => { r = saveKey('gemini', KEY, { stores }); });
  assert.equal(r.ok, false);
  assert.equal(r.code, CODES.BLOCKED, '실패 사유를 코드로 알려야 한다(문구가 아니라)');
  assert.doesNotThrow(() => clearKey('gemini', { stores }));
  assert.doesNotThrow(() => setRemember('gemini', true, { stores }));
});

test('저장소가 아예 없어도(null) 던지지 않는다', () => {
  const stores = { session: null, local: null };
  assert.doesNotThrow(() => {
    assert.equal(readKeySecret('gemini', { stores }), null);
    assert.equal(saveKey('gemini', KEY, { stores }).ok, false);
  });
});

test('한쪽만 막혀 있으면 살아 있는 쪽을 쓴다', () => {
  const session = hostile();
  const local = mem();
  const stores = { session, local };
  const r = saveKey('gemini', KEY, { remember: true, stores });
  assert.equal(r.ok, true);
  assert.equal(r.at, LOCAL);
  assert.equal(readKeySecret('gemini', { stores }), KEY);
});

test('빈 키는 저장하지 않는다', () => {
  const f = fresh();
  const r = saveKey('gemini', '   ', { stores: f.stores });
  assert.equal(r.ok, false);
  assert.equal(r.code, CODES.EMPTY);
  assert.deepEqual(f.session._keys(), []);
});

test('앞뒤 공백은 잘라서 저장한다 (붙여넣기에 개행이 딸려 온다)', () => {
  const f = fresh();
  saveKey('gemini', '  ' + KEY + '\n', { stores: f.stores });
  assert.equal(readKeySecret('gemini', { stores: f.stores }), KEY);
});

/* ── 마스킹 (13절 `AQ.Ab…6l`) ────────────────────────── */

test('마스킹은 앞 5자 + … + 뒤 2자 — 13절의 예시와 정확히 같다', () => {
  assert.equal(maskKey(KEY), 'AQ.Ab…6l');
});

test('마스킹된 값에는 원문의 가운데가 없다', () => {
  const m = maskKey(KEY2);
  assert.equal(m.includes('DUMMY'), false);
  assert.equal(m.length < KEY2.length, true);
  assert.equal(m, 'AIzaS…00');
});

test('짧은 값은 통째로 가린다 — 5+2 를 적용하면 전시가 된다', () => {
  assert.equal(maskKey('abc'), '…');
  assert.equal(maskKey('abcdefg'), '…');   // 7자: MASK_MIN_LEN(8) 미만
  assert.equal(maskKey(''), '');
});

test('readKeyMasked 는 원문을 절대 돌려주지 않는다', () => {
  const f = fresh();
  saveKey('gemini', KEY, { stores: f.stores });
  const shown = readKeyMasked('gemini', { stores: f.stores });
  assert.equal(shown.includes('DUMMY'), false);
  assert.notEqual(shown, KEY);
  assert.equal(shown, 'AQ.Ab…6l');
});

test('키가 없으면 마스킹은 빈 문자열', () => {
  const f = fresh();
  assert.equal(readKeyMasked('gemini', { stores: f.stores }), '');
});

test('세션에 값이 있으면 로컬보다 우선한다 (다른 탭이 방금 기억을 껐을 때)', () => {
  const f = fresh();
  f.local.setItem('medreader.key.gemini', KEY2);
  f.session.setItem('medreader.key.gemini', KEY);
  assert.equal(readKeySecret('gemini', { stores: f.stores }), KEY);
  assert.equal(storedAt('gemini', { stores: f.stores }), SESSION);
});

test('저장할 키가 없을 때 setRemember 는 조용히 아무것도 안 한다', () => {
  const f = fresh();
  const r = setRemember('gemini', true, { stores: f.stores });
  assert.equal(r.ok, true);
  assert.equal(r.at, NONE);
  assert.equal(r.moved, false);
  assert.deepEqual(f.local._keys(), []);
});
