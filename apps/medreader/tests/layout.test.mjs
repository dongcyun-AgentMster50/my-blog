/* ============================================================
   MedReader — 파이프라인 전체 테스트
   D1 결정성 (spec 4-11 P10 / 16-A)
   D2 순수성 (spec 16-A / 16-K — text/* 가 브라우저 전역을 참조하지 않는다)
   D3 성능   (spec 4-11 P9 — 페이지당 15ms. 느린 환경을 감안해 경고만 한다)
   F1 합성 픽스처 (2단 + 표 + 러닝 헤드 + 하이픈 + 위첨자)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildPageLayout, algoVersion } from '../js/text/layout.js';
import { LAYOUT } from '../js/config.js';

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

function runFixture(params) {
  return buildPageLayout(FIXTURE.items, {
    pageNo: FIXTURE.pageNo,
    width: FIXTURE.width,
    height: FIXTURE.height,
    styles: FIXTURE.styles
  }, params);
}

test('F1 합성 2단 픽스처: 컬럼·읽기 순서·표·역할·하이픈·공백', () => {
  const L = runFixture();
  assert.equal(L.algoVersion, algoVersion);
  assert.equal(L.columns.count, 2);

  const flow = L.lines.filter(l => l.role !== 'rotated');
  // (a) 읽기 순서: 좌 컬럼이 모두 나온 뒤 우 컬럼
  const firstRight = flow.findIndex(l => l.col === 1);
  const lastLeft = flow.map(l => l.col).lastIndexOf(0);
  assert.ok(firstRight > lastLeft, '좌 컬럼이 모두 끝난 뒤 우 컬럼이 나와야 한다');

  // (b) 줄 경계 단어 붙음 없음
  const para = L.paragraphs.map(p => p.text).join(' ');
  assert.ok(para.includes('poses the least cardiovascular risk'));
  assert.ok(!para.includes('leastcardiovascular'));

  // (c) 표 감지
  assert.equal(L.regions.length, 1);
  assert.equal(L.regions[0].kind, 'table');
  assert.ok(!para.includes('Ibuprofen'), '표 줄은 문단에 들어가지 않는다');

  // (d) 러닝 헤드·페이지 번호
  assert.equal(flow.find(l => l.text.startsWith('SECTION I')).role, 'header');
  assert.equal(flow.find(l => l.text === '23').role, 'pageno');

  // (e) 하이픈 결합
  assert.ok(para.includes('cardiovascular disease remains'));

  // 위첨자: 본문 줄에 합류하되 bbox 를 끌어올리지 않는다
  const supLine = flow.find(l => l.text.endsWith('day1'));
  assert.ok(supLine, '위첨자가 본문 줄에 합류해야 한다');
  assert.equal(supLine.bbox.y1, 664 + 0.9 * 10);
});

test('D1 결정성 — 같은 입력 2회 처리 결과가 JSON 기준 동일', () => {
  const a = JSON.stringify(runFixture());
  const b = JSON.stringify(runFixture());
  assert.equal(a, b);

  // 파라미터를 바꿔도 같은 파라미터면 같은 결과
  const custom = { ...LAYOUT, SPACE_GAP_FACTOR: 0.25 };
  assert.equal(JSON.stringify(runFixture(custom)), JSON.stringify(runFixture(custom)));
});

test('D2 순수성 — text/* 가 브라우저 전역을 참조하지 않는다', () => {
  const dir = new URL('../js/text/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js'));
  assert.ok(files.length >= 6, 'text/ 모듈이 6개 이상이어야 한다');
  const banned = /\b(document|window|fetch|indexedDB|pdfjsLib|navigator|localStorage)\b/;
  const hits = [];
  for (const f of files) {
    const src = readFileSync(fileURLToPath(new URL(f, dir)), 'utf8');
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (banned.test(lines[i])) hits.push(f + ':' + (i + 1) + ' ' + lines[i].trim());
    }
  }
  assert.deepEqual(hits, []);
});

test('D3 성능 — 2,000 아이템 페이지 레이아웃 평균 시간 (15ms 초과 시 경고)', () => {
  const items = [];
  for (let r = 0; r < 100; r++) {
    const y = 740 - 7 * r;
    for (let c = 0; c < 20; c++) {
      const left = c < 10;
      items.push(item('word' + c, (left ? 72 : 340) + (c % 10) * 20, y, { width: 18 }));
    }
  }
  assert.equal(items.length, 2000);

  const N = 100;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) buildPageLayout(items, { pageNo: 1, width: 612, height: 792 });
  const t1 = process.hrtime.bigint();
  const avg = Number(t1 - t0) / 1e6 / N;
  if (avg > 15) console.warn('[경고] 2,000 아이템 평균 ' + avg.toFixed(2) + 'ms — spec P9 기준 15ms 초과');
  else console.log('평균 ' + avg.toFixed(2) + 'ms / 페이지 (2,000 아이템)');
  assert.ok(avg < 200, '평균이 200ms를 넘으면 알고리즘에 O(n^2) 경로가 있다');
});
