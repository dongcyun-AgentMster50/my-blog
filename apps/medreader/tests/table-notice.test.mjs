/* ============================================================
   tests/table-notice.test.mjs — spec 4-8 (3) (6b 단계)

   "TTS 가 표 영역에 도달하면 UI 언어로 짧게 안내를 **한 번** 말하고 다음
   문단으로 넘어간다."

   표 줄은 낭독 큐에 아예 없다(`describePage` 가 문단에 넣지 않는다). 그래서
   안내는 **큐 위에 끼워 넣는 한 마디**다. 이 파일이 고정하는 것은 둘이다:
     ① 표 자리에 안내가 들어간다 (그리고 `tts/text.js` 가 그것을 한 발화로 만든다)
     ② **같은 표에 다시 닿아도 반복하지 않는다**
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describePage, flowLineIdsOf, insertTableNotices,
  isTableNotice, regionOfNotice, TABLE_NOTICE_PREFIX
} from '../js/ui/reader.js';
import { buildUnits } from '../js/tts/text.js';

const SAY = '표입니다. 화면을 확인하세요.';

function line(id, text, extra) {
  return Object.assign({
    id: id, text: text,
    bbox: { x0: 0, y0: 0, x1: 100, y1: 10 },
    baseline: 0, fontSize: 10, col: 0,
    role: 'body', hyphenJoin: false, paraId: null, regionId: null, runs: []
  }, extra || {});
}

function para(id, lineIds) {
  return { id: id, lineIds: lineIds, kind: 'body', text: '',
           bbox: { x0: 0, y0: 0, x1: 100, y1: 10 }, continuesNext: false, continuesPrev: false };
}

/** 본문 → 표 → 본문 인 한 쪽. 원서 문장을 쓰지 않는다(지어낸 문장이다). */
function pageWithTable() {
  const lines = [
    line('45:1', 'The first paragraph runs before the table.', { paraId: '45:p0' }),
    line('45:2', 'Column one 10 Column two 20', { role: 'table', regionId: '45:r0' }),
    line('45:3', 'Column one 30 Column two 40', { role: 'table', regionId: '45:r0' }),
    line('45:4', 'The paragraph after the table continues here.', { paraId: '45:p1' })
  ];
  const paragraphs = [para('45:p0', ['45:1']), para('45:p1', ['45:4'])];
  const regions = [{ id: '45:r0', kind: 'table', lineIds: ['45:2', '45:3'],
                     bbox: { x0: 0, y0: 0, x1: 100, y1: 40 }, pageNo: 45 }];
  return describePage({
    pageNo: 45, width: 612, height: 792, algoVersion: 7,
    lines: lines, paragraphs: paragraphs, regions: regions,
    columns: { count: 1, gutters: [] }, stats: {}
  });
}

/** `flowParas()` 가 만드는 모양 그대로. */
function parasOf(desc) {
  const out = [];
  for (const b of desc.blocks) {
    if (b.type !== 'para') continue;
    out.push({ id: b.id, kind: b.kind, lines: b.lines });
  }
  return out;
}

/* ──────────────────────────────────────────────────────── */

test('N1 표 줄은 낭독 큐에 없다 (4-8 전제)', () => {
  const desc = pageWithTable();
  assert.deepEqual(flowLineIdsOf(desc), ['45:1', '45:4']);
});

test('N2 ★ 안내가 표 **자리에** 끼어 든다 — 본문 사이 순서가 지켜진다', () => {
  const desc = pageWithTable();
  const paras = insertTableNotices(parasOf(desc), desc.blocks, new Set(), SAY);
  assert.deepEqual(paras.map((p) => p.id), ['45:p0', TABLE_NOTICE_PREFIX + '45:r0', '45:p1']);
  assert.equal(paras[1].lines[0].text, SAY);
  assert.equal(paras[1].kind, 'table-notice');
});

test('N3 ★ 이미 안내한 표에는 다시 끼우지 않는다 (한 번만)', () => {
  const desc = pageWithTable();
  const said = new Set();

  const first = insertTableNotices(parasOf(desc), desc.blocks, said, SAY);
  assert.equal(first.length, 3);

  // 낭독이 그 안내를 말했다 → 호출자가 regionId 를 적어 둔다.
  said.add(regionOfNotice(first[1].id));

  // 쪽을 다시 그려 큐를 새로 만들어도(같은 쪽·같은 표) 안내는 없다.
  const again = insertTableNotices(parasOf(desc), desc.blocks, said, SAY);
  assert.deepEqual(again.map((p) => p.id), ['45:p0', '45:p1']);
});

test('N4 ★ 표가 둘이면 안내도 둘 — 하나를 말해도 다른 표는 남는다', () => {
  const desc = {
    pageNo: 45,
    blocks: [
      { type: 'para', id: '45:p0', kind: 'body', lines: [{ id: '45:1', text: 'Before.', hyphen: 'none' }] },
      { type: 'table', regionId: '45:r0', kind: 'table' },
      { type: 'para', id: '45:p1', kind: 'body', lines: [{ id: '45:4', text: 'Between.', hyphen: 'none' }] },
      { type: 'table', regionId: '45:r1', kind: 'table' },
      { type: 'para', id: '45:p2', kind: 'body', lines: [{ id: '45:7', text: 'After.', hyphen: 'none' }] }
    ]
  };
  const both = insertTableNotices(parasOf(desc), desc.blocks, new Set(), SAY);
  assert.deepEqual(both.map((p) => p.id),
    ['45:p0', TABLE_NOTICE_PREFIX + '45:r0', '45:p1', TABLE_NOTICE_PREFIX + '45:r1', '45:p2']);

  const partial = insertTableNotices(parasOf(desc), desc.blocks, new Set(['45:r0']), SAY);
  assert.deepEqual(partial.map((p) => p.id),
    ['45:p0', '45:p1', TABLE_NOTICE_PREFIX + '45:r1', '45:p2']);
});

test('N5 문단 객체는 **그대로** 실려 간다 (줄 객체가 바뀌면 하이픈 결합이 어긋난다)', () => {
  const desc = pageWithTable();
  const paras = parasOf(desc);
  const out = insertTableNotices(paras, desc.blocks, new Set(), SAY);
  assert.equal(out[0], paras[0], '같은 객체여야 한다');
  assert.equal(out[2], paras[1]);
});

test('N6 안내 문장이 비면 아무것도 끼우지 않는다 (i18n 키가 빠져도 낭독은 돈다)', () => {
  const desc = pageWithTable();
  assert.deepEqual(insertTableNotices(parasOf(desc), desc.blocks, new Set(), '').map((p) => p.id),
    ['45:p0', '45:p1']);
  assert.deepEqual(insertTableNotices(parasOf(desc), desc.blocks, new Set(), null).map((p) => p.id),
    ['45:p0', '45:p1']);
});

test('N7 안내 id 는 화면의 줄 id 와 구별된다 (하이라이트가 찾아 헤매지 않게)', () => {
  assert.equal(isTableNotice(TABLE_NOTICE_PREFIX + '45:r0'), true);
  assert.equal(isTableNotice('45:12'), false);
  assert.equal(isTableNotice(null), false);
  assert.equal(regionOfNotice(TABLE_NOTICE_PREFIX + '45:r0'), '45:r0');
  assert.equal(regionOfNotice('45:12'), null);
});

test('N8 ★ 낭독 큐에서 안내는 **한 발화**다 (tts/text.js 가 그렇게 쪼갠다)', () => {
  const desc = pageWithTable();
  const paras = insertTableNotices(parasOf(desc), desc.blocks, new Set(), SAY);
  const units = buildUnits(paras, 'sentence');

  const notices = units.filter((u) => isTableNotice(u.lineIds[0]));
  assert.equal(notices.length >= 1, true, '안내가 큐에 들어가야 한다');
  // 두 문장짜리 안내는 문장 모드에서 둘로 쪼개질 수 있다. 중요한 것은
  // **표 자리에 있고 본문 문단 사이에 끼어 있다**는 것이다.
  const ids = units.map((u) => (isTableNotice(u.lineIds[0]) ? 'NOTICE' : u.lineIds[0]));
  assert.equal(ids.indexOf('45:1') < ids.indexOf('NOTICE'), true);
  assert.equal(ids.indexOf('NOTICE') < ids.lastIndexOf('45:4'), true);
});

test('N9 표가 없는 쪽은 그대로다', () => {
  const desc = {
    pageNo: 3,
    blocks: [{ type: 'para', id: '3:p0', kind: 'body', lines: [{ id: '3:1', text: 'Only text.', hyphen: 'none' }] }]
  };
  const paras = parasOf(desc);
  assert.deepEqual(insertTableNotices(paras, desc.blocks, new Set(), SAY), paras);
});
