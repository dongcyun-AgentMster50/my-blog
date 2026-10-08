/* `[신설 2026-10-08]` 모델 드롭다운 — 운영자 결정 "안정판만, 필요한 몇 개만, 예전 모델은 필요 없다".
 *
 * 입력은 **운영자가 2026-10-08 실키 확인에서 캡처한 실제 드롭다운**의 이름들이다.
 * 제외 목록 방식에서는 `Nano Banana`·`Robotics-ER`·`Omni`·`gemma`·`*-latest`·`*-preview` 가
 * 그대로 통과했다. 이 테스트는 허용 목록 + 계열별 최신 하나를 고정한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { gemini } from '../js/ai/adapters/gemini.js';
import { usableModels } from '../js/ui/settings.js';

const DEF = 'gemini-3.5-flash-lite';

/** 캡처에 보인 표시 이름에 대응하는 API id(공식 모델 문서 꼴) + 다른 계열 몇 개. */
const REAL_IDS = [
  'gemini-3.5-flash-lite', 'gemma-4-26b-a4b-it', 'gemma-4-31b-it',
  'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest',
  'gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-3.1-pro-preview-customtools',
  'gemini-3.1-flash-lite-preview', 'gemini-3.1-flash-lite',
  'nano-banana-pro', 'nano-banana-2.1',
  'gemini-3.5-flash', 'gemini-omni-flash-preview', 'gemini-omni-1.1-flash',
  'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.8-flash',
  'gemini-robotics-er-2-preview',
  'gemini-3.8-flash-tts', 'gemini-3.1-flash-image', 'gemini-3.5-live-translate-preview',
  'gemini-3.5-transcribe', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'
];

function apiPage(ids) {
  return { models: ids.map((id) => ({ name: 'models/' + id, displayName: id.toUpperCase(), supportedGenerationMethods: ['generateContent'] })) };
}

test('S1 ★ modelsParser — 안정판 꼴(gemini-<버전>-flash-lite|flash|pro)만 통과한다', () => {
  const ids = gemini.modelsParser(apiPage(REAL_IDS)).map((m) => m.id);
  for (const bad of ['gemma-4-31b-it', 'gemini-flash-latest', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview',
    'nano-banana-pro', 'gemini-omni-1.1-flash', 'gemini-robotics-er-2-preview', 'gemini-3.8-flash-tts',
    'gemini-3.1-flash-image', 'gemini-3.5-live-translate-preview', 'gemini-3.5-transcribe']) {
    assert.ok(!ids.includes(bad), bad + ' 는 빠져야 한다');
  }
  for (const ok of ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash']) {
    assert.ok(ids.includes(ok), ok + ' 는 남아야 한다(줄이는 일은 curateModels 몫)');
  }
});

test('S2 ★ curateModels — 계열마다 최신 하나, 기본 모델은 늘 맨 앞', () => {
  const parsed = gemini.modelsParser(apiPage(REAL_IDS));
  const out = gemini.curateModels(parsed, DEF).map((m) => m.id);
  // 캡처 기준: flash-lite 최신 = 3.5(기본), flash 최신 = 3.8.
  // pro 는 안정판 꼴이 지원 종료 중인 2.5 하나뿐이라 **여기서는** 남는다 — 2.5 를 빼는 일은
  // 한 단계 앞 `usableModels`(지원 종료 필터)의 몫이다. 두 단계를 합친 결과는 S5 가 본다.
  assert.deepEqual(out, ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-pro']);
});

test('S3 curateModels — 기본보다 새 flash-lite 가 나오면 기본과 새것을 둘 다 남긴다', () => {
  const parsed = gemini.modelsParser(apiPage(['gemini-3.5-flash-lite', 'gemini-3.6-flash-lite', 'gemini-3.5-flash', 'gemini-4-pro']));
  assert.deepEqual(gemini.curateModels(parsed, DEF).map((m) => m.id),
    ['gemini-3.5-flash-lite', 'gemini-3.6-flash-lite', 'gemini-3.5-flash', 'gemini-4-pro']);
});

test('S4 curateModels — 버전 비교는 숫자로(3.10 > 3.9), 쪽 순서와 무관', () => {
  const parsed = gemini.modelsParser(apiPage(['gemini-3.10-flash', 'gemini-3.9-flash', 'gemini-3.5-flash-lite']));
  assert.deepEqual(gemini.curateModels(parsed, DEF).map((m) => m.id), ['gemini-3.5-flash-lite', 'gemini-3.10-flash']);
  const rev = gemini.modelsParser(apiPage(['gemini-3.9-flash', 'gemini-3.10-flash']));
  assert.deepEqual(gemini.curateModels(rev, 'none').map((m) => m.id), ['gemini-3.10-flash']);
});

test('S5 ★ usableModels — 어댑터를 받으면 정리된 목록, 2.5 는 여전히 빠진다', () => {
  const parsed = gemini.modelsParser(apiPage(REAL_IDS));
  const out = usableModels(parsed, gemini).map((m) => m.id);
  assert.deepEqual(out, ['gemini-3.5-flash-lite', 'gemini-3.8-flash']);
  assert.ok(!out.some((id) => id.startsWith('gemini-2.5-')));
  // 어댑터가 없으면 정리하지 않고 2.5 만 뺀다(다른 프로바이더 대비).
  const plain = usableModels([{ id: 'gemini-2.5-pro' }, { id: 'x-model' }]).map((m) => m.id);
  assert.deepEqual(plain, ['x-model']);
});
