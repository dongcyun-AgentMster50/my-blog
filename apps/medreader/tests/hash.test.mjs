/* ============================================================
   hash.js — spec 7-5 · 18절

   FNV-1a 64 는 **알려진 입력 → 알려진 출력**으로 고정한다. 이 값들은
   FNV 참조 구현의 공개 테스트 벡터다. 구현을 바꿔도 이 값이 바뀌면
   기존 캐시 키가 전부 무효가 된다는 뜻이므로, 실패는 곧 회귀다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fnv1a64Hex, hashHex, hashHexSync, hasSubtle, normalizeForHash, cacheKey,
  sampleRanges, fileIdentityHash, FULL_HASH_MAX, EDGE_CHUNK, MID_CHUNK, MID_SAMPLES
} from '../js/hash.js';

test('H1 FNV-1a 64 — 공개 테스트 벡터', () => {
  assert.equal(fnv1a64Hex(''), 'cbf29ce484222325');        // offset basis
  assert.equal(fnv1a64Hex('a'), 'af63dc4c8601ec8c');
  assert.equal(fnv1a64Hex('b'), 'af63df4c8601f1a5');
  assert.equal(fnv1a64Hex('foobar'), '85944171f73967e8');
});

/* 16비트 림브 구현이 맞는지는 **참조 구현과 맞대어** 본다.
   BigInt 판은 느리지만 명백히 옳다 — 빠른 쪽이 이것과 다르면 빠른 쪽이 틀렸다.
   공개 벡터 네 개만으로는 자리올림 버그가 숨을 수 있다. */
function fnvRef(str) {
  const MASK = (1n << 64n) - 1n;
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(str)) {
    h ^= BigInt(b);
    h = (h * 0x100000001b3n) & MASK;
  }
  return h.toString(16).padStart(16, '0');
}

test('H1b FNV-1a 64 — BigInt 참조 구현과 일치 (자리올림·오버플로)', () => {
  const cases = [
    '', 'a', 'ab', 'foobar', 'medreader',
    'µ≥½', '한글',            // 멀티바이트
    'x'.repeat(5000),                                // 자리올림이 충분히 도는 길이
    String.fromCharCode(0, 255, 128, 1)              // 경계 바이트
  ];
  for (const s of cases) {
    assert.equal(fnv1a64Hex(s), fnvRef(s), JSON.stringify(s.slice(0, 16)));
  }
});

test('H2 FNV-1a 64 — 길이는 항상 16자 hex', () => {
  for (const s of ['', 'a', 'medreader', '한글도 바이트로', 'x'.repeat(1000)]) {
    const h = fnv1a64Hex(s);
    assert.match(h, /^[0-9a-f]{16}$/, s.slice(0, 12));
  }
});

test('H3 FNV-1a 64 — UTF-8 바이트를 센다 (문자 수가 아니라)', () => {
  // 같은 문자열의 바이트 배열을 직접 넘겨도 같은 값이어야 한다.
  const bytes = new TextEncoder().encode('µ≥½');
  assert.equal(fnv1a64Hex('µ≥½'), fnv1a64Hex(bytes));
});

test('H4 접두사로 알고리즘을 구분한다', async () => {
  const sync = hashHexSync('abc');
  assert.match(sync, /^fnv:[0-9a-f]{16}:3$/);

  const any = await hashHex('abc');
  if (hasSubtle()) {
    assert.equal(any, 's256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  } else {
    assert.match(any, /^fnv:/);
  }
  // 두 경로의 키가 절대 섞이지 않는다 — 접두사가 다르면 문자열이 다르다
  assert.equal(sync.split(':')[0], 'fnv');
  assert.equal(any.split(':')[0], hasSubtle() ? 's256' : 'fnv');
  if (hasSubtle()) assert.notEqual(any, sync);
});

test('H5 폴백 키에는 길이가 붙는다 — 64비트 충돌의 두 번째 방벽', () => {
  assert.equal(hashHexSync('').endsWith(':0'), true);
  assert.equal(hashHexSync('abcd').endsWith(':4'), true);
});

test('H6 normalize — NFKC + 공백 축약 + 트림 (7-5)', () => {
  assert.equal(normalizeForHash('  a   b \n c  '), 'a b c');
  assert.equal(normalizeForHash('ﬁ'), 'fi');                 // NFKC 합자 분해
  assert.equal(normalizeForHash('a\u00a0b'), 'a b');          // NBSP 도 \s 다
});

test('H7 cacheKey — 7-5 형식 그대로', async () => {
  const k = await cacheKey('doc1', ' Hello   world ', 'ar', 'translate');
  const parts = k.split('|');
  assert.equal(parts[0], 'translate');
  assert.equal(parts[1], 'ar');
  assert.equal(parts[2], 'doc1');
  assert.equal(parts.length, 4);                              // extra 없으면 4토막

  const k2 = await cacheKey('doc1', 'Hello world', 'ar', 'translate');
  assert.equal(k, k2, '공백만 다른 입력은 같은 키여야 한다');

  const k3 = await cacheKey('doc1', 'Hello world', 'ar', 'summarize', 'ar+en');
  assert.equal(k3.split('|').length, 5);
  assert.equal(k3.endsWith('|ar+en'), true);
  assert.notEqual(k3.split('|')[3], undefined);
});

test('H8 cacheKey — kind·lang·docId 가 다르면 키가 다르다', async () => {
  const base = await cacheKey('d', 't', 'ar', 'translate');
  assert.notEqual(base, await cacheKey('d', 't', 'en', 'translate'));
  assert.notEqual(base, await cacheKey('d2', 't', 'ar', 'translate'));
  assert.notEqual(base, await cacheKey('d', 't', 'ar', 'summarize'));
});

/* ── 대용량 파일 해시 전략 ─────────────────────────────── */

test('H9 작은 파일은 통째로 읽는다', () => {
  assert.deepEqual(sampleRanges(0), []);
  assert.deepEqual(sampleRanges(1000), [[0, 1000]]);
  assert.deepEqual(sampleRanges(FULL_HASH_MAX), [[0, FULL_HASH_MAX]]);
});

test('H10 큰 파일은 읽기량이 크기와 무관하게 일정하다', () => {
  const small = sampleRanges(FULL_HASH_MAX + 1);
  const big = sampleRanges(200 * 1024 * 1024);
  const huge = sampleRanges(2 * 1024 * 1024 * 1024);
  const bytes = (r) => r.reduce((a, b) => a + (b[1] - b[0]), 0);

  // 2MB(앞뒤) + 16 × 64KB = 3MB 가 상한이다
  const cap = 2 * EDGE_CHUNK + MID_SAMPLES * MID_CHUNK;
  for (const r of [small, big, huge]) assert.ok(bytes(r) <= cap, '읽기량 ' + bytes(r));
  assert.equal(bytes(big), cap);
  assert.equal(bytes(huge), cap);
  assert.ok(bytes(huge) < 4 * 1024 * 1024, '2GB 파일도 4MB 미만만 읽는다');
});

test('H11 구간은 오름차순이고 겹치지 않으며 파일 안에 있다', () => {
  for (const size of [9e6, 2e7, 1e8, 3e8, 1.7e9]) {
    const r = sampleRanges(size);
    for (let i = 0; i < r.length; i++) {
      assert.ok(r[i][0] >= 0 && r[i][1] <= Math.floor(size), 'size ' + size);
      assert.ok(r[i][0] < r[i][1]);
      if (i > 0) assert.ok(r[i - 1][1] <= r[i][0], '겹침 size ' + size);
    }
    // 앞과 뒤를 반드시 포함한다 — 증분 저장은 뒤가 바뀐다
    assert.equal(r[0][0], 0);
    assert.equal(r[r.length - 1][1], Math.floor(size));
  }
});

/** size·slice 만 가진 가짜 Blob — 전역 없이 테스트한다. */
function fakeBlob(bytes) {
  return {
    size: bytes.length,
    slice(s, e) {
      const part = bytes.slice(s, e);
      return { arrayBuffer: async () => part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) };
    }
  };
}

test('H12 fileIdentityHash — 같은 내용은 같은 키, 한 바이트만 달라도 다른 키', async () => {
  const a = new Uint8Array(4096).map((_, i) => i & 0xff);
  const b = a.slice();
  b[1234] = (b[1234] + 1) & 0xff;

  const ha = await fileIdentityHash(fakeBlob(a));
  assert.equal(ha, await fileIdentityHash(fakeBlob(a.slice())));
  assert.notEqual(ha, await fileIdentityHash(fakeBlob(b)));
});

test('H13 fileIdentityHash — 표본 기반 키에는 size 가 박힌다', async () => {
  // 큰 파일을 통째로 만들지 않고, 크기만 크고 slice 는 0으로 채워 주는 가짜.
  const big = (size) => ({
    size: size,
    slice(s, e) {
      const n = Math.max(0, e - s);
      return { arrayBuffer: async () => new ArrayBuffer(n) };
    }
  });
  const k1 = await fileIdentityHash(big(FULL_HASH_MAX + 1000));
  const k2 = await fileIdentityHash(big(FULL_HASH_MAX + 2000));
  assert.match(k1, /:p:\d+:/);
  assert.notEqual(k1, k2, '크기가 다르면 표본이 같아도 키가 다르다');
  assert.ok(k1.includes(':p:' + (FULL_HASH_MAX + 1000) + ':'));

  // 작은 파일은 표본 표시가 없다
  const small = await fileIdentityHash(fakeBlob(new Uint8Array(10)));
  assert.equal(small.includes(':p:'), false);
});
