/* ============================================================
   tests/srclang-wiring-7c.test.mjs — spec 16-D1 `[D]` grep · 6-3 원문 음성 배선 (7c)

   `ui/controls.js` 는 DOM 에 묶여 node 에서 돌릴 수 없다. 그래서 이 파일은
   **소스를 읽어** 배선을 고정한다(R6 와 같은 방식 — 주석은 지우고 본다).
   동작은 브라우저에서 `__medreader.tts.docLang()` 로 확인했다(보고서).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import en from '../js/i18n/en.js';
import ar from '../js/i18n/ar.js';
import fr from '../js/i18n/fr.js';
import ko from '../js/i18n/ko.js';

const JS = join(dirname(fileURLToPath(import.meta.url)), '..', 'js') + '/';

function jsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsFiles(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

test('W1 ★ 16-D1 grep — 원문 언어 en 고정이 남아 있지 않다 (config 언어별 표·ui/quiz.js 제외)', () => {
  // ui/quiz.js 는 영어 문제집 전용 화면(5절)이라 제외한다(오케스트레이터 결정 2026-10-10).
  const EXEMPT = new Set(['ui/quiz.js']);
  const hits = [];
  for (const f of jsFiles(JS)) {
    const rel = f.slice(JS.length).replace(/\\/g, '/');
    if (EXEMPT.has(rel)) continue;
    const code = stripComments(readFileSync(f, 'utf8'));
    if (/pickVoice\(\s*'en'/.test(code)) hits.push(rel + " pickVoice('en'");
    if (/setAttribute\(\s*'lang'\s*,\s*'en'\s*\)/.test(code)) hits.push(rel + " setAttribute('lang', 'en')");
    const enUS = code.match(/'en-US'/g) || [];
    // config.js 는 언어별 기본 지역 표(`TTS_LANG_REGION`) 한 곳만 허용한다.
    const allowed = rel === 'config.js' ? 1 : 0;
    if (enUS.length > allowed) hits.push(rel + " 'en-US' ×" + enUS.length);
  }
  assert.deepEqual(hits, []);
});

test('W2 ★ controls — 원문 음성은 sourceLang() 으로 고르고, 쪽 알림에서 큐보다 먼저 다시 고른다', () => {
  const code = stripComments(readFileSync(join(JS, 'ui/controls.js'), 'utf8'));
  assert.match(code, /import\s*\{[^}]*\bsourceLang\b[^}]*\}\s*from\s*'\.\/reader\.js'/);
  const body = code.match(/function syncSourceVoice\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(body, 'syncSourceVoice 가 있다');
  assert.match(body[1], /const lang = sourceLang\(\)/);
  assert.match(body[1], /pickVoice\(lang,/);
  assert.match(body[1], /speaker\.setVoice\(lang,/);
  assert.match(body[1], /speaker\.setDocLang\(utteranceLang\(lang,/);
  // 순서 — 음성을 먼저, 큐를 나중에(새 큐가 새 언어로 나뉘도록).
  assert.match(code, /onPageRender\(\(\) => \{\s*syncSourceVoice\(\);\s*speaker\.reload\(\);/);
  // 음성 목록을 읽은 뒤에도 다시 고른다.
  const refresh = code.match(/async function refreshVoices\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(refresh && /syncSourceVoice\(\)/.test(refresh[1]));
});

test('W3 ★ reader.tts.noVoice 는 {lang} 을 받고, 호출부가 원문 언어 이름을 넘긴다 (6-3)', () => {
  for (const [name, dict] of [['en', en], ['ar', ar], ['fr', fr], ['ko', ko]]) {
    assert.match(dict['reader.tts.noVoice'], /\{lang\}/, name);
  }
  const code = stripComments(readFileSync(join(JS, 'ui/controls.js'), 'utf8'));
  // 매개변수 없이 부르는 곳이 없다.
  assert.equal((code.match(/notice\('reader\.tts\.noVoice'\)/g) || []).length, 0);
  assert.match(code, /notice\('reader\.tts\.noVoice',\s*'warn',\s*\{\s*lang:/);
  // `[7c Review]` 낭독 중 음성 없음(CODES.NO_VOICE) 경로도 원문 언어 이름을 쓴다 — 'en' 으로 되돌리는 변이가 살아남았다.
  assert.match(code, /code === CODES\.NO_VOICE\)\s*\{\s*noVoiceNotice\(sourceLang\(\)\)/);
});
