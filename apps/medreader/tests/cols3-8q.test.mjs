/* ============================================================
   MedReader — 8q 3단 본문(spec 4-14-2) 테스트 C3-1–C3-18 (C3-11 이후는 `[정정 2026-11-17 — 8q Build]` 읽기 순서)

   픽스처는 전부 **지어낸 글**이다(낱말·제목·쪽 번호 모두). 원서 문장을 옮기지 않는다.
   기하는 3단 잡지 쪽의 **모양**만 흉내 낸다(세 단 양끝 맞춤, 거터 약 0.35·0.64W).
   좌표는 픽스처 값일 뿐 규칙이 쓰는 값이 아니다(규칙은 쪽 폭·글자 크기 비율만 쓴다).
   "12 와 같음" = 같은 입력을 `COL3_ENABLED:false` 로 돌린 결과와 PageLayout JSON 이 바이트 같다
   (C0 경로는 12 의 코드 그대로다 — dev/measure-cols3-8q.mjs 가 HEAD 사본과 전 쪽으로 대조한다).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPageLayout, algoVersion } from '../js/text/layout.js';
import { detectColumns } from '../js/text/columns.js';
import { normalizeItems, clusterLines, splitRuns } from '../js/text/lines.js';
import { LAYOUT } from '../js/config.js';

const W = 612, H = 792, FS = 9;
const OFF3 = Object.assign({}, LAYOUT, { COL3_ENABLED: false });

const WORDS = ['zorvat', 'mekil', 'plon', 'trasse', 'vendo', 'quilar', 'basto', 'renu', 'fimal', 'oskat',
  'dreva', 'lumin', 'sarto', 'pekal', 'nivo', 'tarma', 'gessel', 'orvin'];

function words(seed, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(WORDS[(seed * 7 + i * 5) % WORDS.length]);
  return out.join(' ');
}
function item(str, x, y, width, fs = FS) {
  return { str: str, dir: 'ltr', transform: [fs, 0, 0, fs, x, y], width: width, height: fs, fontName: 'g_d0_f1', hasEOL: false };
}
function layout(items, P = LAYOUT) {
  return buildPageLayout(items, { pageNo: 3, width: W, height: H, styles: {} }, P);
}
const noAlgo = (L) => JSON.stringify(Object.assign({}, L, { algoVersion: 0 }));
const textsOf = (L) => L.lines.filter((l) => l.role !== 'rotated').map((l) => l.text);
function rawColumns(items, P = LAYOUT) {
  const info = { pageNo: 3, width: W, height: H };
  const norm = normalizeItems(items, {}, P, info);
  const lines = clusterLines(norm.items, P);
  for (const l of lines) splitRuns(l, P);
  return detectColumns(lines, info, P);
}

/* 세 단 — x 범위(픽스처 값). 거터 [200,222] · [382,404] → 중심 약 0.345W · 0.642W */
const COLS = [[40, 200], [222, 382], [404, 564]];
// 문단 끝 줄은 짧게(6줄마다 — 5·11·17·23·29번째) 마침표로 끝난다 — 양끝 맞춤 산문의 모양
function proseRow(c, i) {
  const [x0, x1] = COLS[c];
  const full = (i % 6) !== 5;
  return item('c' + c + 'r' + String(i).padStart(2, '0') + ' ' + words(c * 31 + i, 5) + (full ? '' : '.'), x0, 0, full ? x1 - x0 : (x1 - x0) * 0.45);
}
/** 세 단 산문. rows[c] = 그 단 줄 수. y0 = 첫 줄 baseline. skip(c,i) 이면 그 자리 줄을 비운다. */
function threeCol(rows, y0 = 690, skip = () => false) {
  const items = [];
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < rows[c]; i++) {
      if (skip(c, i)) continue;
      const it = proseRow(c, i);
      it.transform[5] = y0 - 12 * i;
      items.push(it);
    }
  }
  return items;
}

/* ── C3-1 ─────────────────────────────────────────────── */
test('C3-1 3단 산문 → count 3, 거터 둘, 읽기 순서 col 0 → 1 → 2(각 단 위→아래), 줄 bbox 가 한 단 안', () => {
  const L = layout(threeCol([30, 30, 30]));
  assert.equal(L.columns.count, 3);
  assert.equal(L.columns.gutters.length, 2);
  const [g1, g2] = L.columns.gutters;
  assert.ok(g1 > 200 && g1 < 222 && g2 > 382 && g2 < 404, 'gutters ' + g1 + ',' + g2);
  assert.equal(L.stats.warn, null, 'band 가 정확히 둘이면 경고 없음');
  const t = textsOf(L);
  assert.equal(t.length, 90);
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < 30; i++) {
      assert.ok(t[c * 30 + i].startsWith('c' + c + 'r' + String(i).padStart(2, '0') + ' '), 'at ' + (c * 30 + i) + ': ' + t[c * 30 + i]);
    }
  }
  // 수용 기준 3 — 원본 보기 하이라이트(줄 bbox)가 한 단 안에 머문다
  const bodies = L.lines.filter((l) => l.role !== 'rotated');
  for (const l of bodies) {
    assert.ok(l.col === 0 || l.col === 1 || l.col === 2, 'col ' + l.col);
    const lo = l.col === 0 ? 0 : L.columns.gutters[l.col - 1];
    const hi = l.col === 2 ? W : L.columns.gutters[l.col];
    assert.ok(l.bbox.x0 >= lo && l.bbox.x1 <= hi, l.text + ' bbox ' + l.bbox.x0 + '–' + l.bbox.x1);
  }
  // 문단이 단을 넘나들지 않는다
  const byId = new Map(L.lines.map((l) => [l.id, l]));
  for (const p of L.paragraphs) {
    const cs = new Set(p.lineIds.map((id) => byId.get(id).col));
    assert.equal(cs.size, 1, '문단 ' + p.id + ' 이 단 ' + [...cs].join(',') + ' 에 걸침');
  }
});

/* ── C3-2 ─────────────────────────────────────────────── */
test('C3-2 2단 + 오른 단 보기 라벨 열(band 둘) → 3단 아님, 12 와 바이트 같음', () => {
  const items = [];
  for (let i = 0; i < 24; i++) {
    const y = 690 - 12 * i;
    items.push(item('left ' + words(i, 5), 40, y, 250));                        // 왼 단 산문 40–290
    items.push(item(String.fromCharCode(65 + (i % 5)) + '.', 316, y, 10));        // 라벨 열 316–326
    items.push(item(words(i + 50, 4), 346, y, 150 + (i % 4) * 15));               // 보기 글 346–
  }
  const raw = rawColumns(items);
  assert.notEqual(raw.count, 3);
  const L = layout(items), O = layout(items, OFF3);
  assert.equal(L.stats.warn, 'multi-gutter', '전제: band 가 둘 이상(8q 경로를 실제로 묻는다)');
  assert.equal(noAlgo(L), noAlgo(O));
});

/* ── C3-3 ─────────────────────────────────────────────── */
// 쪽 전체 4열 표 — 칸 글이 길지만 누더기(폭이 들쭉날쭉). 넷째 열은 드문드문. 좌변은 열마다 정렬.
test('C3-3 쪽 전체 4열 표(누더기 칸) → 3단 아님(C2 꽉 찬 비율), 12 와 바이트 같음', () => {
  const RAG = [1.0, 0.5, 0.7, 0.4, 0.9, 0.3, 0.6, 0.45];
  const items = [];
  for (let i = 0; i < 20; i++) {
    const y = 690 - 12 * i;
    const f = (k) => RAG[(i + k * 3) % RAG.length];
    items.push(item('name ' + words(i, 4), 40, y, 140 * f(0)));
    items.push(item('dose ' + words(i + 20, 4), 230, y, 130 * f(1)));
    items.push(item('note ' + words(i + 40, 4), 410, y, 90 * f(2)));
    if (i % 3 === 0) items.push(item('ref ' + words(i + 60, 4), 520, y, 50));
  }
  const raw = rawColumns(items);
  assert.notEqual(raw.count, 3);
  const L = layout(items), O = layout(items, OFF3);
  assert.equal(noAlgo(L), noAlgo(O));
  // 전제: 꽉 찬 비율만 빼면 3단으로 보이는 입력이다(변이 "C2 꽉 찬 비율 제거"가 여기서 빨개진다)
  const noFull = Object.assign({}, LAYOUT, { COL3_FULL: 0 });
  assert.equal(rawColumns(items, noFull).count, 3, '전제: C2 꽉 찬 비율이 이 표를 막는 유일한 조건');
});

/* ── C3-4 ─────────────────────────────────────────────── */
test('C3-4 2단 목차 + 쪽 번호 열 → 3단 아님, 12 와 바이트 같음', () => {
  const items = [];
  for (let i = 0; i < 22; i++) {
    const y = 690 - 12 * i;
    items.push(item('Part ' + words(i, 3), 40, y, 150 + (i % 3) * 30));       // 왼 단 항목 40–250
    items.push(item(String(10 + i * 7), 268, y, 14));                          // 쪽 번호 268–282
    items.push(item('Part ' + words(i + 30, 3), 320, y, 150 + (i % 4) * 25));  // 오른 단 항목 320–
    items.push(item(String(200 + i * 9), 550, y, 18));                         // 쪽 번호 550–568
  }
  const L = layout(items), O = layout(items, OFF3);
  assert.notEqual(L.columns.count, 3);
  assert.equal(noAlgo(L), noAlgo(O));
});

/* ── C3-5 ─────────────────────────────────────────────── */
// [정정 2026-11-17 — 8q Build] 두 단(1–2)만 덮는 소제목은 그 두 단만 가른다 — 단 0 은 통째로 먼저.
test('C3-5 3단 + 가로지르는 제목 + 두 단(1–2)에 걸친 소제목 → 제목 → 단 0 전부 → 단 1·2 위 → 소제목 → 단 1·2 아래', () => {
  // 소제목 자리(12번째 줄 높이 — 위 줄 r11 은 문단 끝 마침표)는 col 1·2 를 비우고, 폭 340(< 0.6W)짜리 소제목이 두 단에 걸친다.
  const items = threeCol([30, 30, 30], 690, (c, i) => c > 0 && i === 12);
  items.push(item('ZORVAT MEKIL PLON TRASSE VENDO QUILAR', 60, 715, 480, 16));   // 가로지르는 제목(> 0.6W)
  items.push(item('Quilar basto renu fimal oskat dreva', 222, 690 - 12 * 12, 340, 11)); // 두 단에 걸친 소제목
  const L = layout(items);
  assert.equal(L.columns.count, 3);
  const t = textsOf(L);
  const at = (s) => t.findIndex((x) => x.startsWith(s));
  const title = at('ZORVAT MEKIL'), sub = at('Quilar basto');
  assert.equal(title, 0, '제목이 맨 앞');
  const sp = L.lines.find((l) => l.text.startsWith('Quilar basto'));
  assert.equal(sp.col, 'span', '두 단에 걸친 소제목은 span');
  // col0 r00–r29 → col1 r00–r11 → col2 r00–r11 → 소제목 → col1 r13–29 → col2 r13–29
  const tag = (c, i) => 'c' + c + 'r' + String(i).padStart(2, '0') + ' ';
  let k = 1;
  for (let i = 0; i < 30; i++) { assert.ok(t[k].startsWith(tag(0, i)), 'col0 ' + k + ': ' + t[k]); k++; }
  for (let c = 1; c < 3; c++) for (let i = 0; i < 12; i++) { assert.ok(t[k].startsWith(tag(c, i)), 'above ' + k + ': ' + t[k]); k++; }
  assert.equal(sub, k, '소제목은 단 1·2 위쪽 다음'); k++;
  for (let c = 1; c < 3; c++) for (let i = 13; i < 30; i++) { assert.ok(t[k].startsWith(tag(c, i)), 'below ' + k + ': ' + t[k]); k++; }
  assert.equal(k, t.length);
});

/* ── C3-6 ─────────────────────────────────────────────── */
test('C3-6 한 단이 짧음(셋째 단 12줄 < 0.4 × 32) → 3단 아님(C3 균형), 12 와 바이트 같음', () => {
  const items = threeCol([32, 32, 12]);
  assert.notEqual(rawColumns(items).count, 3);
  const L = layout(items), O = layout(items, OFF3);
  assert.equal(noAlgo(L), noAlgo(O));
  const noBal = Object.assign({}, LAYOUT, { COL3_BALANCE: 0 });
  assert.equal(rawColumns(items, noBal).count, 3, '전제: C3 균형이 이 쪽을 막는 유일한 조건');
});

/* ── C3-7 ─────────────────────────────────────────────── */
test('C3-7 결정성 — 같은 입력 두 번이면 PageLayout JSON 바이트 같음', () => {
  const items = threeCol([30, 28, 29]);
  items.push(item('ZORVAT MEKIL PLON TRASSE VENDO QUILAR', 60, 715, 480, 16));
  const a = JSON.stringify(layout(items));
  const b = JSON.stringify(layout(JSON.parse(JSON.stringify(items))));
  assert.equal(a, b);
  assert.equal(JSON.parse(a).columns.count, 3);
});

/* ── C3-8 ─────────────────────────────────────────────── */
test('C3-8 COL3_ENABLED:false → 3단 판정을 묻지 않는다(12 경로 — col 2 줄 없음)', () => {
  const items = threeCol([30, 30, 30]);
  const O = layout(items, OFF3);
  assert.notEqual(O.columns.count, 3);
  assert.ok(O.lines.every((l) => l.col !== 2));
  assert.notEqual(rawColumns(items, OFF3).count, 3);
  // 켜면 3단 — 끄기만으로 결과가 갈린다
  assert.equal(layout(items).columns.count, 3);
});

/* ── C3-9 계약 ────────────────────────────────────────── */
test('C3-9 ★ 계약: COL3_ENABLED 와 algoVersion 은 함께 움직인다(되돌리면 지금 값 + 1 — 버전은 앞으로만)', () => {
  // 13 = 8q(3단). COL3_ENABLED=false 로 되돌리면서 13 을 그대로 두면 13 으로 저장된 3단 쪽(col 2 줄)이
  // 다시 뽑히지 않는다 — 14 이상으로 올려라.
  if (LAYOUT.COL3_ENABLED) assert.equal(algoVersion, 13, '3단이 켜진 판(8q)은 13');
  else assert.ok(algoVersion >= 14, 'COL3_ENABLED 를 끄면 algoVersion 을 14 이상으로');
});

/* ── C3-10 ────────────────────────────────────────────── */
test('C3-10 가운데 구간 좌변이 두 갈래(엇갈린 목록) → 3단 아님(C4 좌변 정렬), 12 와 바이트 같음', () => {
  const items = [];
  for (let i = 0; i < 26; i++) {
    const y = 690 - 12 * i;
    items.push(item('a' + i + ' ' + words(i, 5), 40, y, 160));
    items.push(item('b' + i + ' ' + words(i + 9, 5), i % 2 ? 300 : 222, y, 80));   // 222–302 또는 300–380
    items.push(item('c' + i + ' ' + words(i + 17, 5), 404, y, 160));
  }
  assert.notEqual(rawColumns(items).count, 3);
  const L = layout(items), O = layout(items, OFF3);
  assert.equal(noAlgo(L), noAlgo(O));
  const noMad = Object.assign({}, LAYOUT, { GUTTER_MAD_FACTOR: 1e9 });
  assert.equal(rawColumns(items, noMad).count, 3, '전제: C4 좌변 정렬이 이 쪽을 막는 유일한 조건');
});

/* ── C3-11 [정정 2026-11-17 — 8q Build] ───────────────── */
test('C3-11 둘째 거터 위의 짧은 그림 라벨(단 폭의 0.3, 작은 글자) → span 아님, 세 단이 끊기지 않고 col 0 → 1 → 2', () => {
  // 라벨 자리(12번째 줄 높이)는 col 1·2 를 비운다 — 그림 안이라 글이 없다.
  const items = threeCol([30, 30, 30], 690, (c, i) => c > 0 && i === 12);
  items.push(item('ZORVATIA', 370, 690 - 12 * 12, 46, 7));     // 370–416: 둘째 거터(약 393)를 Fm 넘게 가로지름
  const L = layout(items);
  assert.equal(L.columns.count, 3);
  assert.equal(L.lines.filter((l) => l.col === 'span').length, 0, '좁은 라벨은 span 이 아니다');
  const t = textsOf(L).filter((s) => /^c\dr\d\d /.test(s));
  const cols = t.map((s) => s[1]).join('');
  assert.match(cols, /^0+1+2+$/, '단 순서가 한 번씩만 바뀐다: ' + cols);
});

/* ── C3-12 [정정 2026-11-17 — 8q Build] ───────────────── */
test('C3-12 쪽 아래 두 단(0–1) 폭 상자 → 단 0 → 단 1 → 단 2 전부 → 상자(상자 줄 사이에 옆 단 줄이 끼지 않는다)', () => {
  // 위 18줄은 세 단, 그 아래 단 0·1 자리에 두 단 폭 상자 8줄(폭 320 — 0.6W 미만), 단 2 는 30줄 끝까지.
  const items = threeCol([18, 18, 30]);
  for (let i = 0; i < 8; i++) items.push(item('box' + i + ' ' + words(i + 70, 8), 44, 690 - 12 * (19 + i), 320));
  const L = layout(items);
  assert.equal(L.columns.count, 3);
  const t = textsOf(L);
  const kinds = t.map((s) => (s.startsWith('box') ? 'b' : s[1])).join('');
  assert.equal(kinds, '0'.repeat(18) + '1'.repeat(18) + '2'.repeat(30) + 'b'.repeat(8));
  for (let i = 0; i < 8; i++) assert.ok(t[66 + i].startsWith('box' + i + ' '), t[66 + i]);
  // 쪽 아래 띠(FOOTER_ZONE)의 쪽 번호 줄이 상자 밑에 있어도 같다 — 쪽 번호는 본문으로 세지 않는다
  const withFolio = items.concat([item('64 ZORVAT MONTHLY', 40, 40, 90)]);
  const t2 = textsOf(layout(withFolio));
  const k2 = t2.map((s) => (s.startsWith('box') ? 'b' : s.startsWith('64 ') ? 'f' : s[1])).join('');
  assert.equal(k2.replace('f', ''), kinds, '쪽 번호 줄 하나만 더해졌다: ' + k2);
});

/* ── C3-14 [정정 2026-11-17 — 8q Build] ───────────────── */
test('C3-14 큰 글씨 줄이 둘째 거터 너머 단 2 글과 한 run 으로 붙음 → 거터에서 갈라 단 2 는 끊기지 않는다', () => {
  // 14번째 줄 높이: 13pt 인용 글(120–380, 첫 거터를 덮음) + 단 2 글(395–470). 둘째 거터(약 393) 위 틈 15pt 는
  // 4-4 임계(1.2×13=15.6) 아래라 한 run(120–470, 폭 0.57W — 폭 규칙 밖)이 되고, 두 거터를 다 가로질러 쪽을 자를 뻔했다.
  const items = threeCol([30, 30, 30], 690, (c, i) => i === 13);
  items.push(item('Quote zorvat mekil plon trasse', 120, 690 - 12 * 13, 260, 13));
  items.push(item('c2r13 ' + words(75, 4), 395, 690 - 12 * 13, 75));
  const L = layout(items);
  assert.equal(L.columns.count, 3);
  const t = textsOf(L);
  const c2 = t.map((s, i) => (s.startsWith('c2r') ? i : -1)).filter((i) => i >= 0);
  assert.equal(c2.length, 30, '단 2 줄 30(갈라진 조각 포함)');
  assert.equal(c2[29] - c2[0], 29, '단 2 가 이어 읽힌다');
  const q = L.lines.find((l) => l.text.startsWith('Quote'));
  assert.equal(q.col, 'span');
  assert.ok(!/c2r13/.test(q.text), '인용 줄에 단 2 글이 붙지 않는다');
  // 위 줄(r12)이 꽉 찬 본문 줄(문단 중간)이고 아래로 이어지므로 인용은 끼움 — 세 단을 다 읽은 뒤
  const kinds = t.map((s) => (s.startsWith('Quote') ? 'q' : s[1])).join('');
  assert.equal(kinds, '0'.repeat(29) + '1'.repeat(29) + '2'.repeat(30) + 'q');
});

/* ── C3-15 [정정 2026-11-17 — 8q Build · 8q-b] ────────── */
test('C3-15 한 밴드에 두 단(0–1) 상자 8줄 + 단 1–2 에 걸친 소제목 하나(섞임) → 어느 쪽도 단을 자르지 않고 세 단 뒤에, 상자 줄은 이어 읽힌다', () => {
  // 소제목은 문단 끝(r05 마침표) 다음 r06 자리 — 끼움은 아니다. 상자는 쪽 아래 단 0·1. 한 밴드에 '01'·'12' 가 섞이면
  // 가운데 단 1 을 두 덩어리가 달리 자르므로 [8q-b] 둘 다 자르지 않는다 — 단 0 → 1 → 2 가 끊기지 않는다.
  const items = threeCol([18, 18, 30], 690, (c, i) => c > 0 && i === 6);
  items.push(item('Bridge basto renu fimal oskat dreva', 230, 690 - 12 * 6, 330));          // 단 1–2 (0.6W 미만)
  for (let i = 0; i < 8; i++) items.push(item('box' + i + ' ' + words(i + 70, 8), 44, 690 - 12 * (19 + i), 320));
  const L = layout(items);
  assert.equal(L.columns.count, 3);
  const t = textsOf(L);
  const b = t.map((s, i) => (s.startsWith('box') ? i : -1)).filter((i) => i >= 0);
  assert.equal(b.length, 8);
  assert.equal(b[7] - b[0], 7, '상자 8줄이 이어진다: ' + b.join(','));
  const kinds = t.map((s) => (s.startsWith('box') ? 'b' : s.startsWith('Bridge') ? 'x' : s[1])).join('');
  assert.equal(kinds, '0'.repeat(18) + '1'.repeat(17) + '2'.repeat(29) + 'x' + 'b'.repeat(8));
});

/* ── C3-16 [정정 2026-11-17 — 8q Build] ───────────────── */
test('C3-16 쪽 제목 아래 단 0–1 폭 머리 줄들(첫 줄이 단 2 첫 줄과 같은 높이) → 제목 → 머리 → 단 0 → 단 1 → 단 2', () => {
  const items = threeCol([30, 30, 30], 690, (c, i) => c < 2 && i < 6);
  items.push(item('ZORVAT MEKIL PLON TRASSE VENDO QUILAR', 40, 715, 520, 16));
  for (const i of [0, 1, 3]) items.push(item('Head' + i + ' ' + words(i + 80, 5), 60, 690 - 12 * i, 270, 11));
  const L = layout(items);
  assert.equal(L.columns.count, 3);
  const t = textsOf(L);
  const kinds = t.map((s) => (s.startsWith('ZORVAT') ? 'T' : s.startsWith('Head') ? 'h' : s[1])).join('');
  assert.equal(kinds, 'Thhh' + '0'.repeat(24) + '1'.repeat(24) + '2'.repeat(30));
});

/* ── C3-17 [정정 2026-11-17 — 8q Build] ───────────────── */
test('C3-17 단 0 글이 옆으로 둘러 흐르는 단 0–1 인용구(위 줄은 문단 끝) → 끼움 — 세 단을 끊지 않고 다 읽은 뒤 인용구', () => {
  // r12–r14 자리: 단 0 은 좁은 줄(40–110)로 이어지고, 단 1 은 비우고, 인용구(130–370)가 단 0–1 에 걸친다.
  const items = threeCol([30, 30, 30], 690, (c, i) => c < 2 && i >= 12 && i <= 14);
  for (let i = 12; i <= 14; i++) {
    items.push(item('c0r' + i + ' ' + words(i, 2), 40, 690 - 12 * i, 70));
    items.push(item('Pull' + i + ' ' + words(i + 40, 4), 130, 690 - 12 * i, 240, 12));
  }
  const L = layout(items);
  assert.equal(L.columns.count, 3);
  const t = textsOf(L);
  const kinds = t.map((s) => (s.startsWith('Pull') ? 'p' : s[1])).join('');
  assert.equal(kinds, '0'.repeat(30) + '1'.repeat(27) + '2'.repeat(30) + 'ppp');
});

/* ── C3-18 [정정 2026-11-17 — 8q Build] ───────────────── */
test('C3-18 두 단(0–1) 폭 쪽 제목(위·옆에 본문 없음) + 단 1–2 소제목 → 제목은 세 단 경계처럼, 소제목은 단 1·2 만 가른다', () => {
  const items = threeCol([30, 30, 30], 690, (c, i) => c > 0 && i === 12);
  items.push(item('ZORVAT MEKIL PLON TRASSE', 40, 715, 330, 16));                       // 40–370: 첫 거터만 가로지름(0.6W 미만)
  items.push(item('Quilar basto renu fimal oskat dreva', 222, 690 - 12 * 12, 340, 11)); // 단 1–2 소제목(위 줄 r11 문단 끝)
  const L = layout(items);
  assert.equal(L.columns.count, 3);
  const t = textsOf(L);
  const kinds = t.map((s) => (s.startsWith('ZORVAT') ? 'T' : s.startsWith('Quilar') ? 's' : s[1])).join('');
  assert.equal(kinds, 'T' + '0'.repeat(30) + '1'.repeat(12) + '2'.repeat(12) + 's' + '1'.repeat(17) + '2'.repeat(17));
});

/* ── C3-13 [정정 2026-11-17 — 8q Build] ───────────────── */
function quoteAt(r0, mod) {
  // r0–r0+2 자리는 세 단을 비우고 세 줄짜리 큰 글씨 덩어리(세 단 · 단 0–1 · 단 1–2 폭으로 갈림)를 놓는다.
  const items = threeCol([30, 30, 30], 690, (c, i) => i >= r0 && i <= r0 + 2);
  if (mod) mod(items);
  items.push(item('Quote one zorvat mekil plon trasse vendo quilar', 60, 690 - 12 * r0, 480, 12));   // 세 단(> 0.6W)
  items.push(item('quote two basto renu fimal oskat', 40, 690 - 12 * (r0 + 1), 340, 12));           // 단 0–1
  items.push(item('quote three dreva lumin sarto', 230, 690 - 12 * (r0 + 2), 320, 12));             // 단 1–2
  const L = layout(items);
  assert.equal(L.columns.count, 3);
  const t = textsOf(L);
  const q = ['Quote one', 'quote two', 'quote three'].map((s) => t.findIndex((x) => x.startsWith(s)));
  assert.ok(q[0] >= 0 && q[1] === q[0] + 1 && q[2] === q[1] + 1, '세 줄이 이어진다: ' + q.join(','));
  return t.map((s) => (/^[Qq]uote/.test(s) ? 'q' : s[1])).join('');
}
test('C3-13 쪽 가운데 세 줄 덩어리 — 한 덩어리로 이어 읽힌다. 위 줄이 꽉 찬 본문 줄이면 끼움(세 단 뒤), 짧은 줄(문단 끝)이면 소제목(경계)', () => {
  // 위 줄 r12 가 꽉 찬 줄(문단 중간) → 인용구(끼움): 단 0 → 1 → 2 를 끊지 않고 다 읽은 뒤 인용구
  assert.equal(quoteAt(13), '0'.repeat(27) + '1'.repeat(27) + '2'.repeat(27) + 'qqq');
  // 위 줄 r11 이 짧은 줄(문단 끝) → 소제목(경계): 위 세 단 → 덩어리 → 아래 세 단
  assert.equal(quoteAt(12), '0'.repeat(12) + '1'.repeat(12) + '2'.repeat(12) + 'qqq' + '0'.repeat(15) + '1'.repeat(15) + '2'.repeat(15));
});

/* ── C3-19 이후 [8q-b 2026-11-17] — 끼움은 판형 신호만(문장 부호·언어 무관), 덮는 단 모두를 본다 ── */
/** 단 줄 텍스트 바꾸기(그 행의 세 단) */
function retext(items, row, f) {
  for (const it of items) if (/^c\dr\d\d /.test(it.str) && Number(it.str.slice(3, 5)) === row) it.str = f(it.str);
}
test('C3-19 끼움 판정은 문장 끝 부호와 무관 — 위 줄 끝이 。·؟·！ 여도 꽉 찬 줄이면 끼움, 마침표 없는 짧은 줄이면 경계', () => {
  const inset = '0'.repeat(27) + '1'.repeat(27) + '2'.repeat(27) + 'qqq';
  const bound = '0'.repeat(12) + '1'.repeat(12) + '2'.repeat(12) + 'qqq' + '0'.repeat(15) + '1'.repeat(15) + '2'.repeat(15);
  for (const mark of ['。', '؟', '！', '.', '?']) {
    assert.equal(quoteAt(13, (its) => retext(its, 12, (s) => s + mark)), inset, '꽉 찬 위 줄 + ' + mark);
  }
  assert.equal(quoteAt(12, (its) => retext(its, 11, (s) => s.replace(/\.$/, ''))), bound, '짧은 위 줄(부호 없음)');
});

test('C3-20 쪽 머리 난 이름(큰 글씨 · 단 폭에 가까움) 아래 세 단 폭 기사 제목 → 제목이 본문 앞(끼움 아님)', () => {
  const items = threeCol([30, 30, 30], 690, (c, i) => i < 6);
  items.push(item('ZORVAT MEKIL', 40, 690, 150, 16));                                       // 난 이름 — 본문 글자 크기 밖
  items.push(item('Quilar basto renu fimal oskat dreva lumin', 40, 690 - 12 * 3, 520, 16)); // 세 단 폭 제목
  const L = layout(items);
  assert.equal(L.columns.count, 3);
  const t = textsOf(L);
  const kinds = t.map((s) => (s.startsWith('ZORVAT') ? 'k' : s.startsWith('Quilar') ? 'T' : s[1])).join('');
  assert.equal(kinds, 'kT' + '0'.repeat(24) + '1'.repeat(24) + '2'.repeat(24));
});

test('C3-21 앞 기사 아래 단 0–1 새 기사 제목(단 0 위 줄은 짧은 머리 줄, 단 1 위 줄은 꽉 차지만 아래가 없음) → 경계', () => {
  // 단 0: r0–r19 + 짧은 머리 줄(r20 자리) · 제목 두 줄(r22–r23) · 새 기사 r24–r29. 단 1: r0–r21(앞 기사 끝 — r21 은
  // 꽉 찬 줄) 뿐, 그 아래는 그림 자리. 단 2: 30줄.
  const items = threeCol([30, 22, 30], 690, (c, i) => c === 0 && i >= 20 && i <= 23);
  items.push(item('KICKER ' + words(90, 1), 40, 690 - 12 * 20, 50));
  items.push(item('Title one ' + words(91, 4), 40, 690 - 12 * 22, 330, 11));
  items.push(item('title two ' + words(92, 4), 40, 690 - 12 * 23, 330, 11));
  const L = layout(items);
  assert.equal(L.columns.count, 3);
  const t = textsOf(L);
  const kinds = t.map((s) => (s.startsWith('KICKER') ? 'k' : /^[Tt]itle/.test(s) ? 't' : s[1])).join('');
  assert.equal(kinds, '0'.repeat(20) + 'k' + '1'.repeat(22) + 'tt' + '0'.repeat(6) + '2'.repeat(30));
});

test('C3-22 글이 감싸 도는 한 줄 인용구(baseline 이 옆 줄과 어긋남) → 옆 줄(글자 상자 겹침·x 비켜 섬)로 끼움', () => {
  // 단 0 r12–r15 는 좁은 줄(40–110), 단 1 r12–r15 는 비움. 인용 한 줄은 r13·r14 사이 높이(130–370, 12pt).
  // 위 줄은 단 0 짧은 줄 · 단 1 r11 문단 끝 — "꽉 찬 위 줄" 신호가 없어도 옆으로 비켜 선 줄이 끼움을 알린다.
  const items = threeCol([30, 30, 30], 690, (c, i) => c < 2 && i >= 12 && i <= 15);
  for (let i = 12; i <= 15; i++) items.push(item('c0r' + i + ' ' + words(i, 2), 40, 690 - 12 * i, 70));
  items.push(item('Pull ' + words(60, 4), 130, 690 - 12 * 13.5, 240, 12));
  const L = layout(items);
  assert.equal(L.columns.count, 3);
  const t = textsOf(L);
  const kinds = t.map((s) => (s.startsWith('Pull') ? 'p' : s[1])).join('');
  assert.equal(kinds, '0'.repeat(30) + '1'.repeat(26) + '2'.repeat(30) + 'p');
});

test('C3-23 단 1–2 캡션: 단 1 위 줄은 문단 끝이지만 단 2 위 줄은 꽉 차고 아래로 이어짐 → 덮는 단 모두를 보아 끼움', () => {
  const items = threeCol([30, 30, 30], 690, (c, i) => (c > 0 && (i === 12 || i === 13)) || (c === 2 && i === 11));
  items.push(item('c2r11 ' + words(2 * 31 + 11, 5), 404, 690 - 12 * 11, 160));             // 단 2 r11 은 꽉 찬 줄
  items.push(item('Cap one ' + words(64, 5), 230, 690 - 12 * 12, 320, 8));
  items.push(item('cap two ' + words(65, 5), 230, 690 - 12 * 13, 320, 8));
  const L = layout(items);
  assert.equal(L.columns.count, 3);
  const t = textsOf(L);
  const kinds = t.map((s) => (/^[Cc]ap /.test(s) ? 'c' : s[1])).join('');
  assert.equal(kinds, '0'.repeat(30) + '1'.repeat(28) + '2'.repeat(28) + 'cc');
});
