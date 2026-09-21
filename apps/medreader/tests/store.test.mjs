/* ============================================================
   MedReader — 저장본 생성·복원 테스트 (spec 9-2 줄이는 규칙 1·2·3)

   S1 왕복 — toStored → fromStored 후 문단 text 가 원본과 바이트 단위로 같다
            (하이픈 결합 "cardio-"+"vascular" 와 하이픈 보존 "anti-"+"inflammatory" 를
             한 문단 안에 섞어 검증한다)
   S2 규칙 1 — 저장본에 paragraphs[].text 가 없다
   S3 규칙 2 — run text 는 표 region 줄에만. 표 밖은 x0·x1 만 남는다
   S4 규칙 3 — 좌표가 소수 2자리 이하이고 반올림이 결정적이다
   S5 fromStored 는 저장본만으로 동작한다 (원본 items 없이)
   S6 실제 픽스처 왕복 (2단 + 표 + 하이픈 + 위첨자)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildPageLayout, algoVersion } from '../js/text/layout.js';
import { toStored, fromStored, round2, storeVersion } from '../js/text/store.js';

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/synth-2col.json', import.meta.url), 'utf8'));

function item(str, x, y, o = {}) {
  const fs = o.fontSize == null ? 10 : o.fontSize;
  const w = o.width == null ? str.length * fs * 0.5 : o.width;
  return {
    str: str, dir: 'ltr',
    transform: [fs, 0, 0, fs, x, y],
    width: w, height: fs,
    fontName: o.fontName || 'g_d0_f1',
    hasEOL: !!o.hasEOL
  };
}

// 하이픈 결합과 하이픈 보존이 **한 문단 안에** 섞여 있는 페이지.
// 좌표에 일부러 긴 소수를 넣어 규칙 3(반올림)도 함께 걸리게 한다.
function hyphenPage() {
  const rows = [
    'Long-term management of chronic cardio-',
    'vascular disease in the elderly requires anti-',
    'inflammatory therapy that is carefully titrated to',
    'the response of the individual patient over time.'
  ];
  const items = [];
  for (let i = 0; i < rows.length; i++) {
    items.push(item(rows[i], 72.123456789, 700.987654321 - 12 * i, { width: rows[i].length * 5 }));
  }
  return buildPageLayout(items, { pageNo: 7, width: 612, height: 792 });
}

function fixturePage() {
  return buildPageLayout(FIXTURE.items, {
    pageNo: FIXTURE.pageNo,
    width: FIXTURE.width,
    height: FIXTURE.height,
    styles: FIXTURE.styles
  });
}

/* ─────────────────────────────────────────────────────── */

test('S1 왕복 — 문단 text 가 원본과 바이트 단위로 같다 (하이픈 결합 + 보존 혼합)', () => {
  const L = hyphenPage();

  // 전제: 한 문단 안에 두 하이픈 경우가 모두 들어 있어야 시험이 성립한다
  assert.equal(L.paragraphs.length, 1, '네 줄이 한 문단이어야 한다');
  const orig = L.paragraphs[0].text;
  assert.ok(orig.includes('cardiovascular'), '"cardio-"+"vascular" 는 하이픈을 지우고 붙는다: ' + orig);
  assert.ok(orig.includes('anti-inflammatory'), '"anti-"+"inflammatory" 는 하이픈을 살린다: ' + orig);

  const stored = toStored(L);
  const back = fromStored(stored);

  assert.equal(back.paragraphs.length, L.paragraphs.length);
  for (let i = 0; i < L.paragraphs.length; i++) {
    const a = L.paragraphs[i].text;
    const b = back.paragraphs[i].text;
    // 바이트 단위 동일 — 문자열 비교로는 정규화 차이를 놓칠 수 있으므로 UTF-8 바이트로 본다
    assert.deepEqual(Buffer.from(b, 'utf8'), Buffer.from(a, 'utf8'),
      '문단 ' + i + ' text 가 왕복에서 달라졌다\n  원본: ' + a + '\n  복원: ' + b);
  }
  // 하이픈 표시도 저장본을 거쳐 그대로 살아 있어야 한다 (TTS 가 두 줄을 한 번에 읽는다, 4-10)
  const origJoin = L.lines.map(l => l.hyphenJoin);
  const backJoin = back.lines.map(l => l.hyphenJoin);
  assert.deepEqual(backJoin, origJoin);
  assert.ok(origJoin.some(Boolean), '하이픈 결합 줄이 있어야 한다');
});

test('S2 규칙 1 — 저장본에 paragraphs[].text 가 없다', () => {
  const stored = toStored(hyphenPage());
  assert.ok(stored.paragraphs.length > 0);
  for (const p of stored.paragraphs) {
    assert.ok(!Object.prototype.hasOwnProperty.call(p, 'text'),
      'paragraphs[].text 는 저장하지 않는다 (spec 9-2 규칙 1)');
    assert.ok(Array.isArray(p.lineIds) && p.lineIds.length > 0);
  }
  // 저장본 어디에도 문단 text 문자열이 통째로 들어 있으면 안 된다
  const json = JSON.stringify(stored);
  assert.ok(!json.includes('cardiovascular disease'),
    '문단 text 가 저장본에 새어 들어갔다');
  // 줄 text 는 원본 그대로 남는다 ("cardio-" — 4-10, 원본 뷰와 1:1)
  assert.ok(json.includes('cardio-'));
});

test('S3 규칙 2 — run text 는 표 region 줄에만, 표 밖은 x0·x1 만', () => {
  const L = fixturePage();
  assert.ok(L.regions.length >= 1, '픽스처에 표 region 이 있어야 한다');
  const tableIds = new Set();
  for (const g of L.regions) for (const id of g.lineIds) tableIds.add(id);

  const stored = toStored(L);
  let inTableWithText = 0, outTableRuns = 0;
  for (const l of stored.lines) {
    for (const r of l.runs) {
      assert.equal(typeof r.x0, 'number', 'run.x0 은 전 줄에 유지한다');
      assert.equal(typeof r.x1, 'number', 'run.x1 은 전 줄에 유지한다');
      if (tableIds.has(l.id)) {
        assert.equal(typeof r.text, 'string', '표 줄의 run text 는 남는다 (4-8 AI 표 재구성)');
        inTableWithText++;
      } else {
        assert.ok(!Object.prototype.hasOwnProperty.call(r, 'text'),
          '표 밖 run text 는 저장하지 않는다 (spec 9-2 규칙 2)');
        outTableRuns++;
      }
    }
  }
  assert.ok(inTableWithText > 0, '표 안 run 이 하나도 없으면 시험이 성립하지 않는다');
  assert.ok(outTableRuns > 0, '표 밖 run 이 하나도 없으면 시험이 성립하지 않는다');
});

test('S4 규칙 3 — 좌표는 소수 2자리, 반올림은 결정적', () => {
  const L = hyphenPage();
  const stored = toStored(L);

  // 원본에는 긴 소수가 들어 있다 (그대로 저장하면 낭비다)
  assert.ok(String(L.lines[0].bbox.x0).length > 6, '원본 좌표가 이미 짧으면 시험이 성립하지 않는다');

  const ok = v => {
    assert.equal(typeof v, 'number');
    assert.equal(v, Math.round(v * 100) / 100, '소수 2자리를 넘는 값: ' + v);
  };
  for (const l of stored.lines) {
    ok(l.bbox.x0); ok(l.bbox.y0); ok(l.bbox.x1); ok(l.bbox.y1);
    ok(l.baseline); ok(l.fontSize);
    for (const r of l.runs) { ok(r.x0); ok(r.x1); }
  }
  for (const p of stored.paragraphs) { ok(p.bbox.x0); ok(p.bbox.y0); ok(p.bbox.x1); ok(p.bbox.y1); }
  for (const g of stored.regions) { ok(g.bbox.x0); ok(g.bbox.y0); ok(g.bbox.x1); ok(g.bbox.y1); }

  // 결정적: 같은 입력 → 같은 출력 (JSON 기준 동일)
  assert.equal(JSON.stringify(toStored(hyphenPage())), JSON.stringify(stored));
  assert.equal(JSON.stringify(toStored(L)), JSON.stringify(stored), 'toStored 가 입력을 훼손하면 2회차가 달라진다');

  // round2 자체의 경계
  assert.equal(round2(-246.26916608000022), -246.27);
  assert.equal(round2(0.005), 0.01);
  assert.equal(round2(-0.004), 0);
  assert.ok(!Object.is(round2(-0.004), -0), '-0 은 0 으로 접는다');
  assert.equal(round2(NaN), 0);
  assert.equal(round2(Infinity), 0);
});

test('S5 fromStored 는 저장본만으로 동작한다 (원본 items 없이)', () => {
  const L = hyphenPage();
  const stored = toStored(L);
  // 저장본에 items 가 없다는 것부터 확인한다 (spec 9-2 의 전제)
  for (const l of stored.lines) {
    assert.ok(!Object.prototype.hasOwnProperty.call(l, 'items'), '아이템 배열은 저장하지 않는다');
  }
  // 구조화 복제/JSON 을 흉내 내 원본 객체 참조를 완전히 끊는다
  const wire = JSON.parse(JSON.stringify(stored));
  const back = fromStored(wire);
  assert.equal(back.paragraphs[0].text, L.paragraphs[0].text);
  assert.equal(back.algoVersion, algoVersion);
  assert.equal(stored.storeVersion, storeVersion);
  assert.equal(back.columns.count, L.columns.count);
  assert.equal(back.regions.length, L.regions.length);
});

test('S6 실제 픽스처 왕복 — 2단 + 표 + 하이픈 + 위첨자 문단 text 전부 일치', () => {
  const L = fixturePage();
  const back = fromStored(JSON.parse(JSON.stringify(toStored(L))));
  assert.ok(L.paragraphs.length >= 3);
  for (let i = 0; i < L.paragraphs.length; i++) {
    assert.deepEqual(
      Buffer.from(back.paragraphs[i].text, 'utf8'),
      Buffer.from(L.paragraphs[i].text, 'utf8'),
      '문단 ' + i + ' (' + L.paragraphs[i].id + ') text 불일치'
    );
  }
  // kind·bbox·lineIds 도 그대로 온다
  assert.deepEqual(back.paragraphs.map(p => p.kind), L.paragraphs.map(p => p.kind));
  assert.deepEqual(back.paragraphs.map(p => p.lineIds), L.paragraphs.map(p => p.lineIds));
});

test('S7 저장본이 실제로 작아진다 — 규칙 1·2·3 의 합', () => {
  const L = fixturePage();
  // 비교 기준: 아이템만 뺀 저장본 (spec 9-2 의 "현재" 상태)
  const naive = {
    pageNo: L.pageNo, width: L.width, height: L.height, algoVersion: L.algoVersion,
    lines: L.lines.map(l => ({
      id: l.id, text: l.text, bbox: l.bbox, baseline: l.baseline, fontSize: l.fontSize,
      col: l.col, role: l.role, hyphenJoin: l.hyphenJoin, paraId: l.paraId, regionId: l.regionId,
      runs: (l.runs || []).map(r => ({ x0: r.x0, x1: r.x1, text: r.text }))
    })),
    paragraphs: L.paragraphs, regions: L.regions, columns: L.columns, stats: L.stats
  };
  const a = Buffer.byteLength(JSON.stringify(naive), 'utf8');
  const b = Buffer.byteLength(JSON.stringify(toStored(L)), 'utf8');
  assert.ok(b < a, '저장본이 작아져야 한다: ' + a + ' → ' + b);
  console.log('  합성 픽스처 저장본: ' + a + ' → ' + b + ' 바이트 (−' + (100 - b / a * 100).toFixed(0) + '%)');
});
