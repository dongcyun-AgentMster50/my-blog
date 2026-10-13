/* ============================================================
   MedReader — 8i 행 표(spec 4-13) 테스트 RT1–RT15 + M10 계약

   픽스처는 전부 **지어낸 글**이다(낱말·이름표·인용·쪽 번호 모두). 원서 문장을 옮기지 않는다.
   기하는 실측 표(4-13-1)의 **모양**만 흉내 낸다: 이름표 11pt(행 안 세로 가운데) · 쪽 번호 9pt ·
   내용 8pt(행·소행 사이 틈). 좌표는 픽스처 값일 뿐 규칙이 쓰는 값이 아니다(규칙은 비율만 쓴다).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPageLayout, algoVersion } from '../js/text/layout.js';
import { detectRowTables, piecesOf, bandsOf, tracksOf, judge } from '../js/text/rowtable.js';
import { LAYOUT, ROWTABLE } from '../js/config.js';
import { toStored, fromStored } from '../js/text/store.js';
import { describePage, flowLineIdsOf, flowParasOf, FOLD_ROLES } from '../js/ui/reader.js';
import { buildUnits } from '../js/tts/text.js';
import { parseSections } from '../js/quiz/parser.js';
import { isAnswerStart, isQuestionStart, isOptionStart } from '../js/text/segment.js';

const W = 520, H = 720;
const OFF = Object.assign({}, ROWTABLE, { ENABLED: false });

function item(str, x, y, fs) {
  return { str: str, dir: 'ltr', transform: [fs, 0, 0, fs, x, y], width: str.length * fs * 0.5, height: fs, fontName: 'g_d0_f1', hasEOL: false };
}
function layout(items, pageNo = 7, R = ROWTABLE) {
  return buildPageLayout(items, { pageNo: pageNo, width: W, height: H, styles: {} }, LAYOUT, R);
}
const noAlgo = (L) => JSON.stringify(Object.assign({}, L, { algoVersion: 0 }));

/* 지어낸 낱말로 만든 산문 줄. 첫 줄은 글머리, 끝 줄은 마침표. */
const WORDS = ['zorvat', 'mekil', 'plon', 'trasse', 'vendo', 'quilar', 'basto', 'renu', 'fimal', 'oskat', 'dreva', 'lumin', 'sarto', 'pekal', 'nivo', 'tarma', 'gessel', 'orvin'];
function prose(n, seed, bullet = true) {
  const out = [];
  let w = seed * 7;
  for (let i = 0; i < n; i++) {
    let s = i === 0 && bullet ? '• ' + WORDS[w++ % WORDS.length] : WORDS[w++ % WORDS.length];
    while (s.length < 48) s += ' ' + WORDS[w++ % WORDS.length];
    if (i === n - 1) s = s.slice(0, 30).trim() + '.';
    out.push(s);
  }
  return out;
}

/* ── 행 표 픽스처 ───────────────────────────────────────
   rows: [{ label:[줄…], cells:[{ n, cite?, ref? }], refOnLabel? }], 사이에 { section: '…' } 또는 { wide: '…' }.
   x: A·R·P 열의 왼끝. 이름표는 행의 P 범위에 세로 가운데. 쪽 번호는 이름표 둘째(없으면 첫) 줄 높이.
   colhead: true 면 맨 위에 "Topic" + 긴 열 이름 조각(A 통로 안에서 시작). */
function rowTable(spec) {
  const x = Object.assign({ A: 89, R: 208, P: 256 }, spec.x || {});
  const items = [];
  let y = spec.top || 640;
  const LEAD = 9.5, CELL_GAP = 16, ROW_GAP = 18, LAB = 13;
  if (spec.colhead) {
    items.push(item('Topic', x.A, y, 11));
    items.push(item('Ref Page Key Notes Column', 193, y, 12));
    y -= 22;
  }
  let seed = 1;
  for (const r of spec.rows) {
    if (r.section) { items.push(item(r.section, x.A, y, 11)); y -= ROW_GAP + 2; continue; }
    if (r.wide) { items.push(item(r.wide, x.A, y, 11)); y -= ROW_GAP + 2; continue; }
    if (r.alone) { items.push(item(r.alone, x.A, y, 8)); y -= ROW_GAP; continue; }
    const first = y;
    const pLines = [], cellTop = [];
    r.cells.forEach(function (c, ci) {
      if (ci) y -= CELL_GAP - LEAD;
      cellTop.push(y);
      const ls = prose(c.n, seed++, c.bullet !== false);
      if (c.cite) ls.push('Varga T et al. J Test Med. [PMID: 3123456' + ci + ']');
      for (const s of ls) { items.push(item(s, x.P, y, 8)); pLines.push(y); y -= LEAD; }
    });
    const last = y + LEAD;
    const ctr = (first + last) / 2;
    const top = r.align === 'top' ? first : ctr + LAB * (r.label.length - 1) / 2;
    r.label.forEach(function (s, i) { items.push(item(s, x.A, top - LAB * i, 11)); });
    (r.refs || []).forEach(function (ref, i) {
      const ly = top - LAB * Math.min(r.label.length - 1, 1 + i);
      // 첫 쪽 번호는 이름표 둘째 줄 높이(같은 baseline — 4-5 가 한 줄로 묶게), 다음 것은 그 소행(칸) 첫 줄 높이
      items.push(item(ref, x.R, i === 0 ? ly : cellTop[Math.min(cellTop.length - 1, i)], 9));
    });
    y = last - ROW_GAP;
  }
  return items;
}

const T1 = {
  rows: [
    { label: ['Zorvat Lesions &', 'Mekil Goiter'], refs: ['1106'], cells: [{ n: 3, cite: true }] },
    { label: ['Plonitis', '& Pseudo-', 'hypoplonitis'], refs: ['1130'], cells: [{ n: 5 }] },
    { label: ['Trasse &', 'Vendopenia'], refs: ['1138', '1139'], cells: [{ n: 4, cite: true }, { n: 3, cite: true }] },
    { label: ['Quilar Disease', 'of Basto (Renu', 'Fimalis)'], refs: ['1143'], cells: [{ n: 4, cite: true }] },
    { label: ['Oskat &', 'Drevalacia'], refs: ['1142'], cells: [{ n: 3, cite: true }] }
  ]
};
const LABELS_T1 = ['Zorvat Lesions & Mekil Goiter', 'Plonitis & Pseudo-hypoplonitis', 'Trasse & Vendopenia',
  'Quilar Disease of Basto (Renu Fimalis)', 'Oskat & Drevalacia'];

const lineOf = (L, id) => L.lines.find((l) => l.id === id);
const heads = (L) => L.paragraphs.filter((p) => p.kind === 'rowhead');
const flowIds = (L) => flowLineIdsOf(describePage(L));

/* ── RT1 ─────────────────────────────────────────────── */
test('RT1 ★ 3열 행 표: 행 수·행마다 이름표 → 내용 순서, 쪽 번호 줄은 role ref 이고 문단에 없다', () => {
  const L = layout(rowTable(T1));
  assert.deepEqual(heads(L).map((p) => p.text), LABELS_T1);
  // 행마다: 이름표 문단 바로 뒤에 그 행 내용 문단(들)이 오고, 다음 이름표 전에 다른 행 내용이 끼지 않는다
  const order = L.paragraphs.map((p) => (p.kind === 'rowhead' ? 'A' : 'P')).join('');
  assert.equal(order.replace(/P+/g, 'P'), 'APAPAPAPAP');
  const refs = L.lines.filter((l) => l.role === 'ref');
  assert.deepEqual(refs.map((l) => l.text), ['1106', '1130', '1138', '1139', '1143', '1142']);
  for (const r of refs) assert.equal(r.paraId, null, '쪽 번호 줄은 문단에 들지 않는다');
  assert.deepEqual(heads(L).map((p) => p.refLineIds.map((id) => lineOf(L, id).text)),
    [['1106'], ['1130'], ['1138', '1139'], ['1143'], ['1142']]);
  // 두 소행(칸)이 있는 행은 칸마다 문단이 갈린다(칸을 넘는 문단 없음)
  const row2 = L.lines.filter((l) => l.rt && l.rt.row === 2 && l.rt.cell === 'P');
  assert.deepEqual([...new Set(row2.map((l) => l.rt.k))], [0, 1]);
  for (const p of L.paragraphs) {
    const ks = new Set(p.lineIds.map((id) => { const r = lineOf(L, id).rt; return r ? r.row + ':' + r.cell + ':' + r.k : '-'; }));
    assert.equal(ks.size, 1, '문단 하나는 칸 하나 안에 있다: ' + p.text.slice(0, 20));
  }
  assert.ok(!L.paragraphs.some((p) => /\b11\d\d\b/.test(p.text)), '어느 문단에도 쪽 번호가 끼지 않는다');
});

/* ── RT2 ─────────────────────────────────────────────── */
test('RT2 ★ 4-5 거터가 A–R 사이로 잡히든 R–P 사이로 잡히든 같은 행·같은 문단 텍스트(쪽 번호 0)', () => {
  const nearA = layout(rowTable(Object.assign({}, T1, { x: { R: 186, P: 256 } })));
  const nearP = layout(rowTable(Object.assign({}, T1, { x: { R: 226, P: 256 } })));
  const g1 = nearA.columns.gutters[0], g2 = nearP.columns.gutters[0];
  assert.ok(nearA.columns.count === 2 && nearP.columns.count === 2, '전제: 두 배치 모두 4-5 가 2단으로 본다');
  assert.ok(g1 > 186 + 18 && g1 < 256, `전제: R 이 A 쪽이면 거터는 R–P 사이(${g1})`);
  assert.ok(g2 > 140 && g2 < 226, `전제: R 이 P 쪽이면 거터는 A–R 사이(${g2})`);
  const txt = (L) => L.paragraphs.map((p) => p.kind + '|' + p.text);
  assert.deepEqual(txt(nearA), txt(nearP));
  assert.deepEqual(heads(nearA).map((p) => p.text), LABELS_T1);
  for (const L of [nearA, nearP]) {
    for (const h of heads(L)) assert.ok(!/\d/.test(h.text), '이름표에 쪽 번호가 붙지 않는다: ' + h.text);
    for (const l of L.lines) if (l.rt && l.rt.cell === 'A') assert.ok(!/\d/.test(l.text), '이름표 줄 하나에도 숫자가 없다: ' + l.text);
  }
});

/* ── RT3 ─────────────────────────────────────────────── */
test('RT3 2단 산문(양쪽 꽉 참, 행간 같음)은 행 표가 아니고 7b 없을 때와 바이트 동일', () => {
  const items = [];
  for (let i = 0; i < 40; i++) {
    const y = 640 - i * 10;
    items.push(item(prose(1, i, false)[0].replace(/\.$/, ''), 60, y, 8));
    items.push(item(prose(1, i + 50, false)[0].replace(/\.$/, ''), 272, y, 8));
  }
  const L = layout(items);
  assert.equal(L.lines.filter((l) => l.rt).length, 0);
  assert.equal(noAlgo(L), noAlgo(layout(items, 7, OFF)));
});

/* ── RT4 ─────────────────────────────────────────────── */
test('RT4 정답 번호 걸이("V-12." 왼쪽 열 + 쪽 번호 꼴 열 + 해설)는 라벨 가드로 행 표가 아니다', () => {
  const items = [];
  let y = 640;
  for (let q = 0; q < 6; q++) {
    items.push(item('V-' + (10 + q) + '.', 89, y, 11));
    items.push(item(String(300 + q), 208, y, 9));
    for (const s of prose(4, q)) { items.push(item(s, 256, y, 8)); y -= 9.5; }
    y -= 14;
  }
  const L = layout(items);
  assert.equal(L.lines.filter((l) => l.rt).length, 0);
  assert.equal(noAlgo(L), noAlgo(layout(items, 7, OFF)));
  // 가드가 막은 것이다(다른 조건이 아니다): 같은 띠에서 판정 이유가 'label'
  const why = [];
  layoutProbe(items, (p) => why.push(...p.reject));
  assert.ok(why.includes('label'), '판정 이유: ' + why.join(','));
});
function layoutProbe(items, fn) {
  return buildPageLayout(items, { pageNo: 7, width: W, height: H, styles: {}, rowTableProbe: fn }, LAYOUT, ROWTABLE);
}

/* ── RT5 ─────────────────────────────────────────────── */
test('RT5 4열 격자(약 용량 표)는 행 표가 아니고 4-8 결과 그대로', () => {
  const items = [];
  for (let i = 0; i < 10; i++) {
    const y = 600 - i * 10;
    items.push(item(WORDS[i] + 'ine', 60, y, 8));
    items.push(item((i + 1) * 5 + ' mg', 180, y, 8));
    items.push(item(i % 2 ? 'PO' : 'IV', 260, y, 8));
    items.push(item('q' + (6 + i % 3 * 2) + 'h', 330, y, 8));
  }
  const L = layout(items);
  assert.equal(L.lines.filter((l) => l.rt).length, 0);
  assert.equal(noAlgo(L), noAlgo(layout(items, 7, OFF)));
});

/* ── RT6 ─────────────────────────────────────────────── */
test('RT6 이름표 "& Pseudo-" / "hypo…" 두 줄 → rowhead 문단 하나, 하이픈 유지 결합', () => {
  const L = layout(rowTable(T1));
  const h = heads(L).find((p) => p.text.includes('Pseudo'));
  assert.equal(h.text, 'Plonitis & Pseudo-hypoplonitis');
  assert.equal(h.lineIds.length, 3, '세 줄이 한 문단');
  // 낭독: 이름표가 한 단위다
  const units = buildUnits(flowParasOf(describePage(L)), 'sentence');
  assert.ok(units.some((u) => u.text === 'Plonitis & Pseudo-hypoplonitis'));
});

/* ── RT7 ─────────────────────────────────────────────── */
const T7 = {
  rows: [
    { label: ['Zorvat Lesions'], refs: ['210'], cells: [{ n: 4 }] },
    { section: 'CHAPTER 9: SAMPLE ORVIN DISORDERS ZZ' },
    { label: ['Mekil Plonitis'], refs: ['215'], cells: [{ n: 5 }] },
    { label: ['Trasse Vendo'], refs: ['216'], cells: [{ n: 4 }] },
    { label: ['Quilar Basto'], refs: ['220'], cells: [{ n: 3 }] },
    { label: ['Renu Fimal'], refs: ['224'], cells: [{ n: 3 }] },
    { alone: '∗See chapter notes.' }
  ]
};
test('RT7 표 안 가로지르는 장 제목 = 구획 행(heading) · P 가 없는 이름표 칸(각주) = 홀로 선 행', () => {
  const L = layout(rowTable(T7));
  const kinds = L.paragraphs.map((p) => p.kind + ':' + p.text.slice(0, 14));
  const iSec = L.paragraphs.findIndex((p) => p.text.startsWith('CHAPTER 9'));
  assert.ok(iSec > 0, kinds.join(' / '));
  assert.equal(L.paragraphs[iSec].kind, 'heading');
  const secLine = lineOf(L, L.paragraphs[iSec].lineIds[0]);
  assert.equal(secLine.rt.cell, 'S');
  // 구획은 첫 행과 둘째 행 사이
  assert.equal(L.paragraphs[iSec - 1].kind === 'rowhead' ? 'x' : heads(L).findIndex((p) => p.text === 'Zorvat Lesions'), 0);
  assert.equal(L.paragraphs[iSec + 1].text, 'Mekil Plonitis');
  // 각주는 rowhead 가 아니라 본문 문단 하나(맨 끝)
  const last = L.paragraphs[L.paragraphs.length - 1];
  assert.equal(last.text, '∗See chapter notes.');
  assert.notEqual(last.kind, 'rowhead');
  assert.deepEqual(heads(L).map((p) => p.text), ['Zorvat Lesions', 'Mekil Plonitis', 'Trasse Vendo', 'Quilar Basto', 'Renu Fimal']);
});

/* ── RT8 ─────────────────────────────────────────────── */
test('RT8 이름표 · 정수 열 · 또 다른 글 열(점수 꼴) · 산문 → 행 표 아님(조건 c), 정수 열을 ref 로 만들지 않는다', () => {
  const items = [];
  let y = 640;
  const score = ['12', '15', '18', '20', 'high', '14'];
  for (let r = 0; r < 6; r++) {
    items.push(item(WORDS[r] + ' Item', 70, y - 9.5, 11));
    items.push(item(String(400 + r), 160, y - 9.5, 9));
    items.push(item(score[r], 200, y - 9.5, 9));
    for (const s of prose(3, r)) { items.push(item(s, 256, y, 8)); y -= 9.5; }
    y -= 14;
  }
  const L = layout(items);
  assert.equal(L.lines.filter((l) => l.rt || l.role === 'ref').length, 0);
  assert.equal(noAlgo(L), noAlgo(layout(items, 7, OFF)));
});

/* ── RT9 (D1 (가) 판 — 쪽 번호 열 있는 위 정렬 표) ───────── */
const T9 = {
  rows: [
    { label: ['Zorvat'], refs: ['31'], align: 'top', cells: [{ n: 2 }, { n: 2 }, { n: 2 }] },
    { label: ['Mekil'], refs: ['33'], align: 'top', cells: [{ n: 2 }, { n: 6 }] }
  ]
};
test('RT9 위 정렬 표: 닻 사이 칸은 앞 이름표로(가운데 정렬 DP 로 나누지 않는다)', () => {
  const L = layout(rowTable(T9));
  assert.deepEqual(heads(L).map((p) => p.text), ['Zorvat', 'Mekil']);
  const pOfRow = (row) => L.lines.filter((l) => l.rt && l.rt.cell === 'P' && l.rt.row === row).length;
  assert.equal(pOfRow(heads(L).length ? lineOf(L, heads(L)[0].lineIds[0]).rt.row : 0), 6, '첫 행 = 세 칸 6줄');
  assert.equal(pOfRow(lineOf(L, heads(L)[1].lineIds[0]).rt.row), 8, '둘째 행 = 두 칸 8줄');
});

/* ── RT10 ────────────────────────────────────────────── */
test('RT10 결정성 — 같은 입력 두 번 → JSON 바이트 동일', () => {
  for (const spec of [T1, T7, T9]) {
    const a = JSON.stringify(layout(rowTable(spec)));
    const b = JSON.stringify(layout(rowTable(spec)));
    assert.equal(a, b);
  }
});

/* ── RT11 ────────────────────────────────────────────── */
test('RT11 toStored → fromStored: rt · refLineIds · rowhead 보존, 문단 text 동일', () => {
  const L = layout(rowTable(T1));
  const S = JSON.parse(JSON.stringify(toStored(L)));
  const B = fromStored(S);
  assert.deepEqual(B.paragraphs.map((p) => [p.kind, p.text, p.refLineIds || null]),
    L.paragraphs.map((p) => [p.kind, p.text, p.refLineIds || null]));
  assert.deepEqual(B.lines.map((l) => l.rt || null), L.lines.map((l) => l.rt || null));
  assert.ok(B.lines.some((l) => l.rt && l.rt.cell === 'R'));
  // 행 표가 없는 쪽의 저장본에는 rt·refLineIds 필드 자체가 없다(옛 모양 그대로)
  const plain = toStored(layout([item('Zorvat mekil plon trasse vendo.', 60, 600, 10)]));
  assert.ok(plain.lines.every((l) => !('rt' in l)) && plain.paragraphs.every((p) => !('refLineIds' in p)));
});

/* ── RT12 ────────────────────────────────────────────── */
test('RT12 ★ describePage/flowLineIds/buildUnits: ref·colhead 줄은 흐름 밖, 단위 순서 A→P, 정수 단독 단위 0, P 칸 인용은 cite', () => {
  const L = layout(rowTable(Object.assign({}, T1, { colhead: true })));
  const desc = describePage(L);
  const flow = new Set(flowLineIdsOf(desc));
  const off = L.lines.filter((l) => l.role === 'ref' || l.role === 'colhead');
  assert.ok(off.some((l) => l.role === 'colhead'), '전제: 열 머리 줄이 잡혔다');
  for (const l of off) assert.ok(!flow.has(l.id), l.role + ' 줄이 흐름에 있다: ' + l.text);
  // rowhead 블록이 쪽 번호를 보여 준다(화면) — 줄이 아니다
  const rh = desc.blocks.filter((b) => b.kind === 'rowhead');
  assert.equal(rh.length, 5);
  assert.deepEqual(rh[2].refs, ['1138', '1139']);
  // 열 머리는 접힌 줄로 간다(잃지 않는다), 이름표가 있는 행의 쪽 번호는 접힌 줄에도 없다
  const folded = desc.blocks.find((b) => b.type === 'folded');
  assert.ok(folded && folded.lines.some((l) => l.role === 'colhead'));
  assert.ok(!folded.lines.some((l) => l.role === 'ref'));
  assert.ok(FOLD_ROLES.includes('colhead'));
  const units = buildUnits(flowParasOf(desc), 'sentence');
  assert.equal(units.filter((u) => ROWTABLE.INT_ONLY.test(u.text.trim())).length, 0);
  assert.ok(!units.some((u) => /Ref Page Key|^Topic$/.test(u.text)), '열 머리 낭독 0');
  const kinds = units.map((u) => u.kind);
  assert.equal(kinds[0], 'rowhead');
  assert.equal(units[0].text, LABELS_T1[0]);
  assert.ok(kinds.indexOf('rowhead', 1) > kinds.findIndex((k) => k !== 'rowhead'), '첫 이름표 → 그 내용 → 다음 이름표');
  const cites = units.filter((u) => u.cite);
  assert.ok(cites.length >= 5 && cites.every((u) => /Varga|PMID/.test(u.text)), 'P 칸 인용 단위는 cite 그대로');
});

/* ── RT13 ────────────────────────────────────────────── */
test('RT13 퀴즈 파서에 rowhead 문단을 섞어도 문항·보기 결과 불변', () => {
  const kindOf = (t) => isAnswerStart(t) ? 'answer' : isQuestionStart(t) ? 'question' : isOptionStart(t) ? 'option' : 'body';
  const texts = ['I-1. Zorvat mekil plon trasse?', 'A. vendo quilar', 'B. basto renu', 'C. fimal oskat', 'D. dreva lumin',
    'I-2. Sarto pekal nivo tarma?', 'A. gessel orvin', 'B. zorvat plon', 'C. mekil trasse', 'D. vendo basto'];
  const page = (withRow) => {
    const ps = texts.map((t, i) => ({ id: '9:p' + i, text: t, kind: kindOf(t) }));
    if (withRow) ps.splice(5, 0, { id: '9:px', text: 'Zorvat Lesions & Mekil Goiter', kind: 'rowhead', refLineIds: ['9:1'] });
    return { pageNo: 9, width: W, height: H, paragraphs: ps };
  };
  const a = parseSections([page(false)], { docId: 'd' });
  const b = parseSections([page(true)], { docId: 'd' });
  const shape = (secs) => secs.map((s) => s.questions.map((q) => [q.number, q.options.map((o) => o.letter)]));
  assert.deepEqual(shape(b), shape(a));
});

/* ── RT14 ────────────────────────────────────────────── */
const T14 = {
  colhead: true,
  rows: [
    { section: 'CHAPTER 1: SAMPLE ZORVAT PREVENTION' },
    { label: ['Zorvat Lesions &', 'Mekil Goiter'], refs: ['104'], cells: [{ n: 3 }] },
    { wide: 'CHAPTER 2: ORVIN GESSEL AND SARTO PEKAL DISORDERS OF NIVO TARMA' },
    { label: ['Plonitis &', 'Trasse'], refs: ['130'], cells: [{ n: 4 }] },
    { label: ['Vendo Quilar'], refs: ['138'], cells: [{ n: 4 }] },
    { label: ['Basto Renu &', 'Fimal Oskat'], refs: ['143'], cells: [{ n: 3 }] },
    { wide: 'CHAPTER 3: DREVA LUMIN AND SARTO PEKAL DISORDERS OF GESSEL ORV' },
    { label: ['Lumin &', 'Drevalacia'], refs: ['155'], cells: [{ n: 3 }] }
  ]
};
test('RT14 ★ 한 행짜리 띠(장 제목 사이)도 행이다 — R7 물려받기: 첫·끝 한 행 포함, 순서 위→아래', () => {
  const L = layout(rowTable(T14));
  assert.deepEqual(heads(L).map((p) => p.text),
    ['Zorvat Lesions & Mekil Goiter', 'Plonitis & Trasse', 'Vendo Quilar', 'Basto Renu & Fimal Oskat', 'Lumin & Drevalacia']);
  for (const v of ['104', '130', '138', '143', '155']) {
    const l = L.lines.find((x) => x.text === v);
    assert.equal(l && l.role, 'ref', v + ' 는 쪽 번호 줄');
  }
  assert.ok(L.lines.some((l) => l.role === 'colhead' && l.text === 'Topic'), '열 머리(띠 안) 잡힘');
  const units = buildUnits(flowParasOf(describePage(L)), 'sentence');
  assert.ok(!units.some((u) => /^(Topic|Ref Page Key)/.test(u.text)));
  assert.equal(units.filter((u) => ROWTABLE.INT_ONLY.test(u.text.trim())).length, 0);
});

/* ── RT15 ────────────────────────────────────────────── */
test('RT15 표 아래(가로지르는 줄 하나 뒤) 2단 산문 띠는 물려받지 않는다(R7 (e)) — 그 줄들은 7b 없을 때와 같다', () => {
  const items = rowTable(T1);
  items.push(item('CHAPTER 5: ZORVAT MEKIL PLON AND TRASSE VENDO QUILAR BASTO RENU', 60, 300, 11));
  for (let i = 0; i < 12; i++) {
    const y = 280 - i * 10;
    // 왼 단 줄은 대개 표의 A|R 통로를 통째로 덮는다(가로지름) — 실측 45쪽 모양. 짧은 줄만 A 영역 안.
    const left = i % 4 === 3 ? 'oskat dreva.' : prose(2, i + 20, false)[0].slice(0, 36);
    items.push(item(left, 89, y, 8));
    items.push(item(prose(1, i + 70, false)[0].replace(/\.$/, ''), 256, y, 8));
  }
  const L = layout(items);
  const off = layout(items, 7, OFF);
  const below = (Lx) => Lx.lines.filter((l) => l.baseline < 295 && l.role !== 'rotated').map((l) => [l.text, l.role, l.col, l.rt || null]);
  assert.deepEqual(below(L).map((x) => x.slice(0, 2)), below(off).map((x) => x.slice(0, 2)));
  assert.ok(below(L).every((x) => x[3] === null), '아래 산문 줄에는 rt 가 없다');
  assert.equal(heads(L).length, 5, '위 표는 그대로 잡힌다');
});

/* ── RT16·RT17 (8i Review 보강) ───────────────────────── */
/* RT16 — 띠를 끊는 장 제목(폭 > ROWTABLE.SPAN_RATIO×W)이 4-5 의 'span' 폭(SPAN_WIDTH_RATIO×W)에는 못 미쳐
 * 오른쪽 단(col 1)으로 분류되면, 4-5 읽기 순서에서 그 줄은 왼쪽 단(이름표) 줄들 **뒤**에 놓인다.
 * 그 자리에 그대로 두면 아래 띠(그 장의 행)와 쪽 끝까지 다 읽은 뒤에 장 제목을 읽는다(CMDT 2026 31쪽 실측 모양). */
test('RT16 ★ 두 행 표 띠 사이의 장 제목은 4-5 가 오른쪽 단으로 보내도 두 띠 사이에서 읽힌다', () => {
  const title = 'CHAPTER 2: ORVIN GESSEL AND SARTO PEKAL DISORDERS OF NIV';   // 56자 × 5.5 = 308pt: 0.55W < 폭 < 0.6W
  const wpt = title.length * 11 * 0.5;
  assert.ok(wpt > ROWTABLE.SPAN_RATIO * W && wpt <= LAYOUT.SPAN_WIDTH_RATIO * W, '전제: 7b 경계이지만 4-5 span 은 아니다');
  const spec = { rows: T14.rows.slice(1, 6).map((r) => (r.wide ? { wide: title } : r)) };
  const L = layout(rowTable(spec));
  const tl = L.lines.find((l) => l.text === title);
  assert.ok(tl && tl.col !== 'span', '전제: 4-5 는 이 줄을 span 으로 보지 않는다');
  const seq = L.paragraphs.map((p) => (p.text === title ? 'T' : p.kind === 'rowhead' ? p.text.slice(0, 6) : '')).filter(Boolean);
  assert.deepEqual(seq, ['Zorvat', 'T', 'Ploniti', 'Vendo Q', 'Basto R'].map((x) => (x === 'T' ? 'T' : x.slice(0, 6))));
});

/* RT17 — 표 안에 든 짧은 장 제목(이름표 열 안, 옆에 내용 없음)은 홀로 선 행이다. 7단계가 heading 으로 본 줄이면
 * heading 문단으로 남는다(8i 전과 같은 화면·8g 목차). CMDT 2026 35쪽 "CHAPTER 44: …" 모양. */
test('RT17 홀로 선 이름표 칸이 7단계 heading 이면 heading 문단(rowhead·body 아님), 자리는 두 행 사이', () => {
  const spec = { rows: [T1.rows[0], T1.rows[1], { section: 'CHAPTER 9: PLON' }, T1.rows[2], T1.rows[3]] };
  const L = layout(rowTable(spec));
  const i = L.paragraphs.findIndex((p) => p.text === 'CHAPTER 9: PLON');
  assert.ok(i > 0, '장 제목 문단이 있다');
  const tl = L.lines.find((l) => l.text === 'CHAPTER 9: PLON');
  assert.equal(tl.rt && tl.rt.cell, 'A', '전제: 이름표 열 안의 홀로 선 칸이다');
  assert.equal(L.paragraphs[i].kind, 'heading');
  assert.equal(tl.role, 'heading');
  const hs = L.paragraphs.map((p, k) => [p.kind, k]).filter((x) => x[0] === 'rowhead').map((x) => x[1]);
  assert.ok(hs.filter((k) => k < i).length === 2 && hs.filter((k) => k > i).length === 2, '두 번째 행과 세 번째 행 사이');
  // 내용이 옆에 있는 이름표 칸은 그대로 rowhead(heading 이 아니다 — D6)
  assert.equal(heads(L).length, 4);
});

/* RT18 — Build 가 시제품과 다르게 한 EDGE_ZONE 0(쪽 위·아래 띠를 자르지 않음)을 고정한다. 표 첫 내용 줄이 쪽 위 6% 안에
 * 있어도(CMDT 2026 33·34쪽 모양) 그 행의 내용으로 읽혀야 한다 — 잘라 내면 표를 다 읽은 뒤에 따로 읽힌다. */
test('RT18 표 첫 내용 줄이 쪽 맨 위(위 6% 안)에 있어도 첫 행의 내용으로 읽힌다(EDGE_ZONE 0)', () => {
  const top = Math.round(H * 0.965);
  const L = layout(rowTable(Object.assign({}, T1, { top: top })));
  const first = L.lines.find((l) => Math.abs(l.baseline - top) < 0.5 && /^•/.test(l.text));
  assert.ok(first, '전제: 맨 윗줄이 글머리 내용 줄');
  assert.ok(first.rt && first.rt.cell === 'P' && first.rt.row === lineOf(L, heads(L)[0].lineIds[0]).rt.row,
    '맨 윗줄은 첫 행의 내용 칸');
  const ps = L.paragraphs;
  const i = ps.findIndex((p) => p.lineIds.includes(first.id));
  assert.equal(ps[i - 1] && ps[i - 1].kind, 'rowhead', '첫 이름표 바로 뒤에 읽힌다');
});

/* RT19 — 열 머리 글자 상한은 **조각마다**(Build 가 다르게 한 곳 2). "Topic" + 긴 열 이름(합 62자, 실측 21쪽 모양)도 열 머리다. */
test('RT19 열 머리 조각 합이 60자를 넘어도(조각마다 ≤ 60) 열 머리로 접힌다 — 낭독에 없다', () => {
  const longHead = 'Key New Advances Affecting Clinical Practice Notes Column';   // 57자
  const items = rowTable(Object.assign({}, T1, { colhead: false, top: 618 }));
  items.push(item('Topic', 89, 640, 11));
  items.push(item(longHead, 193, 640, 8));
  assert.ok('Topic'.length + longHead.length > ROWTABLE.COLHEAD_MAX_CHARS, '전제: 합은 상한을 넘는다');
  const L = layout(items);
  assert.deepEqual(L.lines.filter((l) => l.role === 'colhead').map((l) => l.text).sort(), [longHead, 'Topic'].sort());
  const units = buildUnits(flowParasOf(describePage(L)), 'sentence');
  assert.ok(!units.some((u) => /^(Topic|Key New Advances)/.test(u.text)), '열 머리는 낭독하지 않는다');
  assert.equal(heads(L).length, 5);
});

/* ── 7b 단계 단위 ─────────────────────────────────────── */
test('7b 순수: 행 표가 없으면 입력 배열을 그대로 돌려준다(새 배열도 아니다)', () => {
  const lines = [];
  const r = detectRowTables(lines, { width: W, height: H });
  assert.equal(r.lines, lines);
  const r2 = detectRowTables([{ role: 'body', baseline: 100, fontSize: 8, runs: [{ x0: 10, x1: 50, items: [] }] }], { width: W, height: H });
  assert.equal(r2.tables.length, 0);
});

test('7b 규칙은 책 고유 값을 쓰지 않는다 — 표를 통째로 옮기고 키워도(×1.2) 같은 행', () => {
  const base = rowTable(T1);
  const moved = base.map((it) => Object.assign({}, it, { transform: [it.transform[0], 0, 0, it.transform[3], it.transform[4] * 0.9 - 20, it.transform[5] - 40] }));
  const L1 = layout(base), L2 = layout(moved);
  assert.deepEqual(heads(L2).map((p) => p.text), heads(L1).map((p) => p.text));
});

/* ── M10 계약: 7b 를 끄면 algoVersion 도 올린다 ────────── */
test('M10 ★ 계약: ROWTABLE.ENABLED 와 algoVersion 은 함께 움직인다(끄면 12 이상 — 버전은 앞으로만)', () => {
  if (ROWTABLE.ENABLED) assert.equal(algoVersion, 11, '7b 가 켜진 판은 11');
  else assert.ok(algoVersion >= 12, '7b 를 끈 채 algoVersion 을 그대로 두면 11 로 저장된 쪽(ref 줄)이 옛 규칙과 섞인다 — 12 로 올려라');
});

/* 진단 함수 내보내기(측정 도구가 쓴다) — 모양만 */
test('7b 진단: piecesOf/bandsOf/tracksOf/judge 가 RT1 의 띠를 행 표로 판정한다', () => {
  const L0 = layout(rowTable(T1), 7, OFF);
  assert.equal(L0.lines.filter((l) => l.rt).length, 0, '꺼지면 rt 없음');
  const why = [];
  layoutProbe(rowTable(T1), (p) => why.push(p.tables.length));
  assert.ok(why[0] >= 1);
  assert.equal(typeof piecesOf, 'function'); assert.equal(typeof bandsOf, 'function');
  assert.equal(typeof tracksOf, 'function'); assert.equal(typeof judge, 'function');
});
