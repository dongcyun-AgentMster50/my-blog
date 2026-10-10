/* ============================================================
   tests/fixtures/sync-digest.mjs — `crypto.subtle.digest` 를 **같은 값**의 마이크로태스크 해시로 바꾼다
   (테스트 파일이 아니다 — `*.test.mjs` 아님. import 하는 것만으로 설치된다.)

   ── 왜 (8b Review — 간헐 실패 원인) ──────────────────────
   캐시 키(`hash.js` `hashHex` → `crypto.subtle.digest`)는 Node 에서 **libuv 스레드 풀**에서 계산되고
   끝나는 시점이 실제 시계를 따른다. readalong 테스트는 "setImmediate 를 N 번 돌리면 일이 다 끝난다"
   (`flush`·`settle`)고 가정하는데, 기계가 바쁘면 해시가 그 N 번 안에 안 끝나 요청이 아직 안 나간
   상태에서 단언이 돈다(RA2 `actual 2, expected 3` 등). 재현: 테스트 8개를 동시에 40번 → 7번 빨강,
   해시를 3ms 늦추면(스크래치패드 preload) 12개가 매번 빨강.

   여기서는 `node:crypto` 의 동기 SHA-256 으로 **같은 바이트**를 돌려주되 Promise 로 감싼다 — 키 값
   (`s256:` + 64 hex)은 그대로이고, 끝나는 시점만 마이크로태스크로 정해진다(가짜 타이머와 같은 취지).
   제품 코드는 바꾸지 않는다 — 제품은 tick 수에 기대지 않는다.
   ============================================================ */

import { createHash } from 'node:crypto';

const subtle = globalThis.crypto && globalThis.crypto.subtle;
if (subtle && !subtle.__syncDigest) {
  const orig = subtle.digest.bind(subtle);
  subtle.digest = function digest(alg, data) {
    const name = typeof alg === 'string' ? alg : alg && alg.name;
    if (String(name).toUpperCase() !== 'SHA-256') return orig(alg, data);
    const bytes = data instanceof Uint8Array ? data
      : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        : new Uint8Array(data);
    const h = createHash('sha256').update(bytes).digest();
    return Promise.resolve(h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength));
  };
  Object.defineProperty(subtle, '__syncDigest', { value: true });
}
