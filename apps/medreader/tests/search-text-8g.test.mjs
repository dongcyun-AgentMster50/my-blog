/* ============================================================
   tests/search-text-8g.test.mjs — 8g 검색 글자 (spec 17-8-12 §7 · §8)

   S3  text/screen.js 옮김 무변 — 두 옛 모듈이 같은 함수 객체를 다시 export, 순수성 grep
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as screen from '../js/text/screen.js';
import * as reader from '../js/ui/reader.js';
import * as ttsText from '../js/tts/text.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/* ══ S3 옮김 무변 ═════════════════════════════════════ */

test('S3 ★ ui/reader.js · tts/text.js 가 text/screen.js 의 **같은 함수 객체**를 다시 export 한다', () => {
  for (const name of ['describePage', 'flowParasOf', 'FOLD_ROLES', 'REF_ROLE']) {
    assert.ok(screen[name] !== undefined, 'screen.' + name);
    assert.equal(reader[name], screen[name], 'reader.' + name);
  }
  for (const name of ['joinPieces', 'localRange']) {
    assert.equal(typeof screen[name], 'function', 'screen.' + name);
    assert.equal(ttsText[name], screen[name], 'tts/text.' + name);
  }
  // 옛 자리에 정의가 남아 있지 않다(두 벌이 되면 한쪽만 고쳐질 수 있다)
  const rd = read('../js/ui/reader.js');
  const tt = read('../js/tts/text.js');
  for (const re of [/export function describePage\(/, /export function flowParasOf\(/, /function paraBlock\(/, /export const FOLD_ROLES\s*=/, /export const REF_ROLE\s*=/]) {
    assert.doesNotMatch(rd, re, 'reader.js 에 정의가 남았다: ' + re);
  }
  for (const re of [/export function joinPieces\(/, /export function localRange\(/]) {
    assert.doesNotMatch(tt, re, 'tts/text.js 에 정의가 남았다: ' + re);
  }
});

test('S3 ★ text/screen.js · text/search.js 는 document·window·indexedDB·fetch 를 참조하지 않는다 (16-A)', () => {
  const banned = /\b(document|window|indexedDB|fetch)\b/;
  for (const f of ['../js/text/screen.js', '../js/text/search.js']) {
    let src;
    try { src = read(f); } catch (e) { if (f.endsWith('search.js')) continue; throw e; }
    const hits = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => banned.test(l));
    assert.deepEqual(hits, [], f);
    // import 는 text/* · config 만(ui·tts·db·pdf 금지 — 3-2)
    const imports = src.match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || [];
    for (const im of imports) assert.match(im, /from\s*['"](\.\/[a-z]+\.js|\.\.\/config\.js)['"]/, f + ': ' + im);
  }
});
