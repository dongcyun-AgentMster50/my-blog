/* ============================================================
   tests/library.test.mjs — spec 12-6 · 16-B

   ★ 이 파일이 지키는 것은 하나다: **`pageCount` 2차 비교**.

   `hash.js` 는 8MB 초과 파일의 13.22% 만 읽는 표본 해시다. Review 가
   "표본 밖 4,096바이트를 바꾼 파일이 **같은 `fileHash`** 를 낸다"를
   실제로 만들어 보였다. `hash.js:156` 주석은 "가져오기 단계에서
   `pageCount` 를 함께 비교한다"고 약속했지만, 가져오기 코드 자체가
   3단계 몫이라 그 방벽이 레포 어디에도 없었다.

   `identityFor` 가 그 판단이고, 여기가 그것을 고정한다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { identityFor, variantIdentity } from '../js/ui/library.js';

const H = 's256:p:23787348:aaaaaaaabbbbbbbbccccccccdddddddd';

test('L-1 기존 레코드가 없으면 새 문서다', () => {
  const d = identityFor(null, H, 729);
  assert.equal(d.reuse, false);
  assert.equal(d.identity, H);
  assert.equal(d.reason, 'new');
  assert.equal(identityFor(undefined, H, 729).reuse, false);
});

test('L-2 ★ 같은 해시 + 같은 쪽수 → 같은 파일. 중복 생성 금지 (16-B)', () => {
  const d = identityFor({ id: 'x', pageCount: 729 }, H, 729);
  assert.equal(d.reuse, true);
  assert.equal(d.identity, H, '기존 레코드의 키를 그대로 쓴다');
  assert.equal(d.reason, 'same');
});

test('L-3 ★★ 같은 해시 + 다른 쪽수 → 다른 파일 (Review 조건 1)', () => {
  // 표본 해시가 충돌한 경우. 쪽수가 2차 방벽이다.
  const d = identityFor({ id: 'x', pageCount: 729 }, H, 7000);
  assert.equal(d.reuse, false, '재사용하면 빈 문서가 완료 상태로 앉는다');
  assert.equal(d.reason, 'pagecount-mismatch');
  assert.notEqual(d.identity, H, 'fileHash 는 unique 인덱스다 — 같은 값을 쓸 수 없다');
  assert.equal(d.identity, variantIdentity(H, 7000));
});

test('L-4 ★ 변형 키는 결정적이다 — 같은 파일을 다시 가져오면 같은 키', () => {
  const a = identityFor({ id: 'x', pageCount: 729 }, H, 7000);
  const b = identityFor({ id: 'x', pageCount: 729 }, H, 7000);
  assert.equal(a.identity, b.identity);
  // 그리고 그 변형 레코드를 찾으면 재사용된다
  const found = identityFor({ id: 'y', pageCount: 7000 }, a.identity, 7000);
  assert.equal(found.reuse, true);
  assert.equal(found.reason, 'same');
});

test('L-5 쪽수가 0 인 레코드는 아직 열어 본 적 없는 것이다 — 채워 쓴다', () => {
  // proto-extract 가 만든 레코드가 이렇다(pageCount: 0 으로 만들고 나중에 채운다).
  const d = identityFor({ id: 'x', pageCount: 0 }, H, 729);
  assert.equal(d.reuse, true);
  assert.equal(d.reason, 'adopt');
  assert.equal(d.identity, H);
  // undefined·null 도 0 으로 본다
  assert.equal(identityFor({ id: 'x' }, H, 729).reason, 'adopt');
  assert.equal(identityFor({ id: 'x', pageCount: null }, H, 729).reason, 'adopt');
});

test('L-6 쪽수가 문자열로 저장돼 있어도 숫자로 비교한다', () => {
  assert.equal(identityFor({ pageCount: '729' }, H, 729).reuse, true);
  assert.equal(identityFor({ pageCount: '729' }, H, 730).reuse, false);
});

test('L-7 변형 키 형식 — 원래 해시가 접두사로 남는다', () => {
  const v = variantIdentity(H, 7000);
  assert.ok(v.startsWith(H), '원래 해시를 알아볼 수 있어야 한다');
  assert.equal(v, H + ':n7000');
  assert.equal(variantIdentity(H, 0), H + ':n0');
  assert.equal(variantIdentity(H, undefined), H + ':n0');
  // 변형의 변형이 무한히 늘지 않는다 — 두 번째 변형은 첫 변형과 같은 규칙이다
  assert.equal(variantIdentity(v, 7000), v + ':n7000');
});

test('L-8 ★ 729 → 7000 전환이 실제 시나리오다 (임시본 → 실자료)', () => {
  // 사용자는 지금 729쪽 임시본을 쓰고 곧 7000쪽 실자료를 받는다.
  // 두 파일이 우연히 같은 표본 해시를 내면 임시본 레코드가 열려
  // "7000쪽인데 추출이 done" 이 된다. 그것을 막는 것이 이 판단이다.
  const provisional = { id: 'prov', pageCount: 729, extraction: { done: true, pagesDone: 729 } };
  const d = identityFor(provisional, H, 7000);
  assert.equal(d.reuse, false);
  assert.notEqual(d.identity, provisional.fileHash);
});
