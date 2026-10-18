/* ============================================================
   MedReader — 8i-2 본문 이름표 2열 표(spec 4-13-10) 테스트 RT20–RT32 (+ RT25b: 넓힌·물려받은 띠의 숨은 열)
   [8i-2b] RT30b–RT30e: D10 — R 표(쪽 번호 열)에서 물려받은 띠에 쪽 번호가 없어도 2열 경로가 아니다 · R 표의 P 열
   여러 run · R 표 띠 안 캡션. RT23b·RT28b: 살아남던 방어 조건(R6b P 줄 위 바깥 조각 · R2b 걸친 아이템).
   [8i-2c] RT33–RT35: 2열 표시(det.two)가 R7 물려받기 · R2b · R6b 뒤에도 남는다(8i-2b Review M1–M3).

   픽스처는 전부 **지어낸 글**이다(낱말·이름표·캡션 모두). 원서 문장을 옮기지 않는다.
   기하는 실측 2열 표(4-13-10 1절)의 **모양**만 흉내 낸다: 위 정렬 · 이름표·설명 8pt · 행간 9.5pt ·
   행 사이 틈 1.3×행간(< CELL_GAP). 좌표는 픽스처 값일 뿐 규칙이 쓰는 값이 아니다(규칙은 비율만 쓴다).

   2열 규칙은 `REQUIRE_REF:false` 에서만 열린다. 테스트는 설정을 명시해 (a) 어둡게 들이기(config true)와
   (b) 켜기(config false) 어느 판에서도 같은 것을 잰다:
     TWO = REQUIRE_REF false(2열 규칙 켬) · REF = REQUIRE_REF true(8i) · OFF = 7b 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPageLayout } from '../js/text/layout.js';
import { LAYOUT, ROWTABLE } from '../js/config.js';
import { describePage, flowParasOf } from '../js/ui/reader.js';
import { buildUnits } from '../js/tts/text.js';

const W = 520, H = 720;
const TWO = Object.assign({}, ROWTABLE, { REQUIRE_REF: false });
const REF = Object.assign({}, ROWTABLE, { REQUIRE_REF: true });
const OFF = Object.assign({}, ROWTABLE, { ENABLED: false });

function item(str, x, y, fs) {
  return { str: str, dir: 'ltr', transform: [fs, 0, 0, fs, x, y], width: str.length * fs * 0.5, height: fs, fontName: 'g_d0_f1', hasEOL: false };
}
function lay(items, R = TWO, probe) {
  return buildPageLayout(items, { pageNo: 7, width: W, height: H, styles: {}, rowTableProbe: probe }, LAYOUT, R);
}
const noAlgo = (L) => JSON.stringify(Object.assign({}, L, { algoVersion: 0 }));
const heads = (L) => L.paragraphs.filter((p) => p.kind === 'rowhead').map((p) => p.text);
const units = (L) => buildUnits(flowParasOf(describePage(L)), 'sentence');
const lineByText = (L, re) => L.lines.find((l) => re.test(l.text));
/* 행 = rowhead 문단과 그 뒤 rowhead 가 아닌 문단들(다음 rowhead 전까지) — { a, p: [문단 text] } */
function rowsOfL(L) {
  const out = [];
  for (const p of L.paragraphs) {
    if (p.kind === 'rowhead') out.push({ a: p.text, p: [] });
    else if (out.length) out[out.length - 1].p.push(p.text);
  }
  return out;
}
/* 행 표의 P 줄 수(행마다, rowhead 첫 줄 기준) */
function pLinesByHead(L) {
  const byId = new Map(L.lines.map((l) => [l.id, l]));
  const m = new Map();
  for (const p of L.paragraphs) {
    if (p.kind !== 'rowhead') continue;
    const r = byId.get(p.lineIds[0]).rt;
    m.set(p.text, L.lines.filter((l) => l.rt && l.rt.t === r.t && l.rt.row === r.row && l.rt.cell === 'P').length);
  }
  return m;
}
const itemBag = (L) => L.lines.flatMap((l) => l.items.map((it) => it.idx + ':' + it.str)).sort();

/* 지어낸 낱말로 만든 설명 줄. 첫 줄은 글머리, 끝 줄은 마침표(48자 안팎 — 8pt 에서 약 192pt). */
const WORDS = ['zorvat', 'mekil', 'plon', 'trasse', 'vendo', 'quilar', 'basto', 'renu', 'fimal', 'oskat', 'dreva', 'lumin', 'sarto', 'pekal', 'nivo', 'tarma', 'gessel', 'orvin'];
function prose(n, seed, len = 48) {
  const out = [];
  let w = seed * 7;
  for (let i = 0; i < n; i++) {
    let s = i === 0 ? '• ' + WORDS[w++ % WORDS.length] : WORDS[w++ % WORDS.length];
    while (s.length < len) s += ' ' + WORDS[w++ % WORDS.length];
    if (i === n - 1) s = s.slice(0, 30).trim() + '.';
    out.push(s);
  }
  return out;
}
const words = (n, seed, len) => { let w = seed * 5, s = WORDS[w++ % WORDS.length]; while (s.length < len) s += ' ' + WORDS[w++ % WORDS.length]; return s.slice(0, len).trim(); };

/* ── 2열 표 픽스처 (위 정렬) ─────────────────────────────
   rows: [{ label:[줄…], p: n | [줄…], fs? }] · { group:'…', fs } (옆 설명 없는 묶음 제목, 다음 행은 바로 아래) ·
         { line:'…', x, fs } (임의의 한 줄 — 넓은 줄·캡션·표 제목) · { prose2: n } (2단 산문 n줄).
   이름표 둘째 줄 이후는 설명 줄과 같은 행간(같은 높이)에 앉는다. 행 사이 틈 = GAP. */
const LEAD = 9.5, GAP = 1.3 * 9.5, XA = 60, XP = 160;
function twoCol(spec) {
  const items = [];
  let y = spec.top || 640;
  let seed = spec.seed || 1;
  for (const r of spec.rows) {
    if (r.group) { items.push(item(r.group, XA, y, r.fs || 10)); y -= r.after || 11; continue; }
    if (r.line) { items.push(item(r.line, r.x != null ? r.x : XA, y, r.fs || 8)); y -= r.after || GAP; continue; }
    if (r.prose2) {
      for (let i = 0; i < r.prose2; i++) {
        items.push(item(words(1, seed + i, 46), XA, y, 8));
        items.push(item(words(1, seed + i + 30, 46), 270, y, 8));
        y -= LEAD;
      }
      y -= GAP - LEAD;
      continue;
    }
    const ps = Array.isArray(r.p) ? r.p : prose(r.p, seed++);
    const y0 = y;
    for (const s of ps) {
      if (typeof s === 'string') items.push(item(s, XP, y, 8));
      else for (const run of s) items.push(item(run[0], run[1], y, 8));   // [[글, x], …] — 한 줄에 run 여럿
      y -= LEAD;
    }
    r.label.forEach((s, i) => items.push(item(s, XA, y0 - LEAD * i, r.fs || 8)));
    y = y + LEAD - GAP;
  }
  return items;
}

/* ── RT20 ────────────────────────────────────────────── */
const F20 = { rows: [
  { label: ['Zorvat'], p: 3 }, { label: ['Mekil'], p: 1 }, { label: ['Plonar'], p: 1 }, { label: ['Trasse'], p: 3 }
] };
test('RT20 ★ 위 정렬 2열 표, 행 사이 틈 1.3×행간(< CELL_GAP), 한 줄 이름표 + 한 줄 설명 두 행 연속 → 이름표가 따로 행', () => {
  const L = lay(twoCol(F20));
  assert.deepEqual(heads(L), ['Zorvat', 'Mekil', 'Plonar', 'Trasse']);
  assert.deepEqual([...pLinesByHead(L)], [['Zorvat', 3], ['Mekil', 1], ['Plonar', 1], ['Trasse', 3]]);
  // 낭독: 이름표 → 그 행 설명 → 다음 이름표
  const u = units(L).map((x) => x.kind === 'rowhead' ? 'A:' + x.text : 'P');
  assert.deepEqual(u.filter((x) => x.startsWith('A:')), ['A:Zorvat', 'A:Mekil', 'A:Plonar', 'A:Trasse']);
  assert.equal(u.join(' ').replace(/(P )+/g, 'P ').replace(/P$/, 'P'), 'A:Zorvat P A:Mekil P A:Plonar P A:Trasse P');
});

/* ── RT21 ────────────────────────────────────────────── */
/* 두 줄 이름표를 둘째 행에 둔다 — 첫 행이면 R6b(열 머리)가 "아래 P 줄 옆에 이름표 줄"을 행 시작으로 보아
 * 첫 줄을 열 머리로 접는다(spec 그대로의 규칙 — Build 보고 "남은 문제"에 적었다). */
const F21 = { rows: [
  { label: ['Vendo'], p: 3 }, { label: ['Zorvat mekil', 'plon trasse'], p: 3 }, { label: ['Quilar'], p: 2 }
] };
test('RT21 두 줄 이름표 — 둘째 줄이 설명 둘째 줄(간격 = 행간)과 같은 높이면 쪼개지 않는다', () => {
  const L = lay(twoCol(F21));
  assert.deepEqual(heads(L), ['Vendo', 'Zorvat mekil plon trasse', 'Quilar']);
  assert.deepEqual([...pLinesByHead(L)], [['Vendo', 3], ['Zorvat mekil plon trasse', 3], ['Quilar', 2]]);
});

/* ── RT22 ────────────────────────────────────────────── */
const F22 = { rows: [
  { label: ['Zorvat'], p: 3 }, { group: 'Gessel Orvin', fs: 10 }, { label: ['Trasse'], p: 3 }, { label: ['Vendo'], p: 2 }
] };
test('RT22 옆 설명 없는 묶음 제목 + 바로 아래 이름표 → 홀로 선 행 + 행, 묶음 제목은 7단계 역할', () => {
  const L = lay(twoCol(F22));
  const off = lay(twoCol(F22), OFF);
  assert.deepEqual(heads(L), ['Zorvat', 'Trasse', 'Vendo']);
  const g = lineByText(L, /^Gessel Orvin$/);
  assert.ok(g && g.rt && g.rt.cell === 'A', '묶음 제목은 표 안 이름표 열의 홀로 선 칸');
  assert.equal(g.role, lineByText(off, /^Gessel Orvin$/).role, '7단계 역할 그대로');
  assert.equal(g.role, 'heading', '전제: 7단계가 큰 글자 묶음 제목을 heading 으로 본다');
  const kinds = L.paragraphs.map((p) => (p.kind === 'rowhead' ? p.text : p.text === 'Gessel Orvin' ? 'G:' + p.kind : '.'));
  const seq = kinds.filter((k) => k !== '.');
  assert.deepEqual(seq, ['Zorvat', 'G:heading', 'Trasse', 'Vendo'], '묶음 제목은 첫 행과 둘째 행 사이, 이름표에 붙지 않는다');
});

/* ── RT23 ────────────────────────────────────────────── */
function f23() {
  const items = twoCol({ top: 640 - GAP, rows: [{ label: ['Zorvat'], p: 3 }, { label: ['Mekil'], p: 3 }, { label: ['Plon'], p: 2 }] });
  items.push(item('Maneuver', 112, 640, 8));      // 머리A — 통로 가운데
  items.push(item('Description', XP, 640, 8));    // 머리P
  return items;
}
test('RT23 ★ 맨 윗줄 "머리A(통로 가운데) | 머리P", 아래 첫 줄이 행 시작 → 열 머리 colhead(흐름 밖), 첫 행에 안 붙음', () => {
  const L = lay(f23());
  const ch = L.lines.filter((l) => l.role === 'colhead').map((l) => l.text).join(' ');
  assert.ok(/Maneuver/.test(ch) && /Description/.test(ch), '열 머리 줄: ' + ch);
  assert.deepEqual(heads(L), ['Zorvat', 'Mekil', 'Plon']);
  assert.deepEqual([...pLinesByHead(L)], [['Zorvat', 3], ['Mekil', 3], ['Plon', 2]]);
  assert.ok(!units(L).some((u) => /Maneuver|Description/.test(u.text)), '열 머리는 낭독하지 않는다');
});

/* [8i-2b] RT23b — R6b "P 줄 위에 이름표 열·구획 밖 조각이 있으면 열 머리가 아니다"(Review 8i2R-7 V5).
 * RT23 과 같은 머리 줄 위에, 이름표 열도 가로지름도 아닌 홀로 선 짧은 조각(오른쪽 끝 — 제3의 한 조각 열)을 둔다. */
function f23b() {
  const items = f23();
  items.push(item('Gessel orvin', 420, 640 + GAP, 8));
  return items;
}
test('RT23b R6b: 머리 줄 위에 이름표 열·구획 밖 조각이 있으면 맨 윗 P 줄을 열 머리로 접지 않는다', () => {
  const L = lay(f23b());
  assert.ok(lay(f23()).lines.some((l) => l.role === 'colhead'), '전제: 그 조각이 없으면(RT23) 열 머리');
  assert.ok(L.lines.some((l) => l.rt), '전제: 표는 잡힌다');
  assert.equal(L.lines.filter((l) => l.role === 'colhead').length, 0);
  assert.ok(units(L).some((u) => /Description/.test(u.text)), '접지 않은 줄은 읽힌다');
});

/* ── RT24 ────────────────────────────────────────────── */
const F24 = { rows: [
  { label: ['Zorvat'], p: ['Mekil plon trasse vendo quilar.'] }, { label: ['Trasse'], p: 3 }, { label: ['Vendo'], p: 3 }
] };
test('RT24 맨 윗줄이 마침표로 끝나는 짧은 설명이면(아래 줄이 행 시작이어도) 열 머리 아님 — 보통 첫 행', () => {
  const L = lay(twoCol(F24));
  assert.equal(L.lines.filter((l) => l.role === 'colhead').length, 0);
  assert.deepEqual(heads(L), ['Zorvat', 'Trasse', 'Vendo']);
  assert.deepEqual(rowsOfL(L)[0], { a: 'Zorvat', p: ['Mekil plon trasse vendo quilar.'] });
  // 아래 P 줄이 행간 간격으로 이어지는 꼴(행 시작 아님)도 열 머리가 아니다
  const L2 = lay(twoCol({ rows: [{ label: ['Zorvat'], p: 4 }, { label: ['Trasse'], p: 3 }] }));
  assert.equal(L2.lines.filter((l) => l.role === 'colhead').length, 0);
  assert.deepEqual(heads(L2), ['Zorvat', 'Trasse']);
});

/* ── RT25 ────────────────────────────────────────────── */
function f25() {
  const rows = [];
  let k = 0;
  for (const lab of ['Zorvat', 'Mekil', 'Plon', 'Trasse', 'Vendo']) {
    const p = [];
    for (let i = 0; i < 3; i++, k++) {
      // 둘에 하나는 run 둘(숨은 열 — 통로 12pt), 나머지는 두 열을 가로지르는 긴 run 하나
      p.push(k % 2 ? [[words(1, k, 24), XP], [words(1, k + 9, 24), XP + 24 * 4 + 12]] : words(1, k, 52));
    }
    rows.push({ label: [lab], p: p });
  }
  return twoCol({ rows: rows });
}
test('RT25 ★ 이름표 | 두 글 열(좁은 통로, P 줄 절반이 run 둘) → 행 표 0 (숨은 열 가드)', () => {
  const why = [];
  const L = lay(f25(), TWO, (r) => why.push(...r.reject));
  assert.equal(L.lines.filter((l) => l.rt).length, 0);
  assert.equal(noAlgo(L), noAlgo(lay(f25(), OFF)));
  assert.ok(why.includes('hidden'), '숨은 열 가드가 막았다: ' + why.join(','));
});

/* RT25b — Build 보강(spec 4-13-10 3절 "알려진 것" 2): 물려받는 띠에도 숨은 열 가드를 다시 건다. */
const SEC7 = 'SECTION SEVEN ZORVAT MEKIL PLON TRASSE VENDO QUILAR BASTO RENU FIMAL OSK';   // A 통로를 덮는 넓은 줄
function f25b() {
  // 위: 깨끗한 2열 표 · 장 제목 아래: 혼자서는 R3 를 못 넘는(P 4줄) 띠 — 설명 열 절반이 run 둘(숨은 열)
  const two = (k) => [[words(1, k, 24), XP], [words(1, k + 9, 24), XP + 108]];
  return twoCol({ rows: [
    { label: ['Zorvat'], p: 3 }, { label: ['Mekil'], p: 3 }, { label: ['Plon'], p: 3 },
    { line: SEC7, x: XA },
    { label: ['Vendo'], p: [words(1, 1, 52), two(2), words(1, 3, 52), two(4)] }
  ] });
}
test('RT25b 물려받는 띠(R7)도 숨은 열이면 표가 아니다 — 그 줄은 7b 없을 때와 같다', () => {
  const L = lay(f25b());
  const off = lay(f25b(), OFF);
  assert.deepEqual(heads(L), ['Zorvat', 'Mekil', 'Plon'], '위 표는 잡힌다');
  const yS = off.lines.find((l) => l.text === SEC7).baseline;
  const below = (X) => X.lines.filter((l) => l.baseline < yS - 1).map((l) => [l.text, l.role, l.col, l.rt || null]);
  assert.ok(below(L).length >= 4, '전제: 아래 띠 줄이 있다');
  assert.deepEqual(below(L), below(off));
});

/* ── RT26 ────────────────────────────────────────────── */
const WIDE_P = words(1, 3, 80);                                                    // 80자 × 4 = 320pt > 0.55W
const WIDE_A = 'CHAPTER SEVEN ' + words(1, 4, 66);                                 // A 통로부터 걸친 넓은 줄
function f26() {
  return twoCol({ rows: [
    // 1차 띠: 짧은 이름표 넷 + 넓은 줄 옆 'Plon'(홀로) — 통로가 넓게(짧은 이름표 끝 ~ P 시작) 잡힌다
    { label: ['Zorvat'], p: 3 }, { label: ['Mekil'], p: 3 }, { label: ['Pekal'], p: 3 }, { label: ['Nivo'], p: 3 },
    { label: ['Plon'], p: [WIDE_P].concat(prose(2, 5)) },
    { label: ['Trassevendo quilarbast'], p: 3 },               // 긴 이름표 — 중심이 1차 띠 통로 안
    { label: ['Renu'], p: 3 },
    { line: WIDE_A, x: XA },
    { label: ['Lumin'], p: 3 }, { label: ['Sarto'], p: 3 }
  ] });
}
test('RT26 ★ 설명 줄 일부가 0.55W 보다 넓음(P 시작에서 시작) → 한 표, 긴 이름표도 A · A 통로를 덮는 넓은 줄은 여전히 띠 경계', () => {
  const L = lay(f26());
  assert.deepEqual(heads(L), ['Zorvat', 'Mekil', 'Pekal', 'Nivo', 'Plon', 'Trassevendo quilarbast', 'Renu', 'Lumin', 'Sarto']);
  const wp = L.lines.find((l) => l.text === WIDE_P);
  const plon = L.lines.find((l) => l.text === 'Plon');
  assert.ok(wp.rt && wp.rt.cell === 'P', '넓은 설명 줄은 표의 P 칸');
  assert.equal(wp.rt.row, plon.rt.row, '넓은 설명 줄은 Plon 행');
  assert.equal(pLinesByHead(L).get('Plon'), 3);
  assert.equal(wp.rt.t, L.lines.find((l) => l.text === 'Renu').rt.t, '넓은 줄 위아래가 한 표');
  const wa = L.lines.find((l) => l.text === WIDE_A);
  assert.ok(wa && !wa.rt, 'A 통로를 덮는 넓은 줄은 표 밖(띠 경계)');
});

/* ── RT27 ────────────────────────────────────────────── */
function f27() {
  return twoCol({ rows: [
    { label: ['Zorvat'], p: 3 }, { label: ['Mekil'], p: 3 }, { label: ['Plon'], p: 3 },
    { label: ['Trasse'], p: prose(2, 9).concat([words(1, 6, 80)]) },   // 끝 줄이 넓은 설명 줄(P 시작에서 시작 — 띠를 넓힌다)
    { prose2: 4 }                                                       // 바로 아래 2단 산문(왼쪽 단 줄이 통로를 덮음)
  ] });
}
test('RT27 ★ 2열 표 바로 아래 2단 산문(왼쪽 단 줄이 통로를 덮음) → 산문 줄은 표 밖, 7b 없을 때와 같은 줄·순서', () => {
  const L = lay(f27());
  const off = lay(f27(), OFF);
  assert.deepEqual(heads(L), ['Zorvat', 'Mekil', 'Plon', 'Trasse']);
  const yW = L.lines.find((l) => l.text === words(1, 6, 80)).baseline;
  assert.ok(L.lines.find((l) => l.text === words(1, 6, 80)).rt, '전제: 넓은 설명 줄은 표 안(띠 넓히기)');
  const below = (X) => X.lines.filter((l) => l.baseline < yW - 1).map((l) => [l.text, l.role, l.col, l.rt || null]);
  assert.equal(below(L).length, below(off).length);
  assert.ok(below(L).length >= 4);
  assert.deepEqual(below(L), below(off));
});

/* ── RT28 ────────────────────────────────────────────── */
const JOINED = 'Trasse vendo quilar bas';     // 23자 × 4 = 92pt → 60..152, 설명 첫 줄(160)과 틈 8pt < run 문턱
function f28() {
  const items = twoCol({ rows: [
    { label: ['Zorvat mekil pl'], p: 3 }, { label: ['Mekil plon tra'], p: 3 },
    { label: [JOINED], p: prose(3, 3, 36) },              // 붙은 run 이 0.55W 를 넘지 않게(넘으면 띠 경계)
    { label: ['Vendo quilar ba'], p: 3 }, { label: ['Renu fimal oska'], p: 3 }
  ] });
  return items;
}
test('RT28 ★ 이름표 줄과 설명 첫 줄이 한 run(아이템 둘) → 아이템 경계에서 나뉨 · 글자 다중 집합 동일 · 원래 run 다시 내지 않음', () => {
  const off = lay(f28(), OFF);
  const joined = off.lines.find((l) => l.text.startsWith(JOINED + ' •'));
  assert.ok(joined && joined.runs.length === 1, '전제: 7b 없을 때 이름표와 설명 첫 줄이 한 run');
  const L = lay(f28());
  assert.deepEqual(heads(L), ['Zorvat mekil pl', 'Mekil plon tra', JOINED, 'Vendo quilar ba', 'Renu fimal oska']);
  assert.equal(pLinesByHead(L).get(JOINED), 3);
  assert.deepEqual(itemBag(L), itemBag(off), '글자(아이템)를 잃거나 두 번 내지 않는다');
  assert.ok(!L.lines.some((l) => l.text.startsWith(JOINED + ' •')), '붙은 원래 줄이 다시 나오지 않는다');
});

/* [8i-2b] RT28b — R2b 는 "앞 아이템이 P 시작 **전에** 끝날 때"만 자른다(Review 8i2R-7 V3).
 * 셋째 행 첫 줄: 이름표 아이템이 P 시작(160)을 지나 176 에서 끝나고, 바로 다음 아이템이 178 에서 시작하는 한 run —
 * 자를 경계가 깨끗하지 않다. */
const STRAD = 'Trasse vendo quilar basto ren';      // 29자 × 4 = 116 → 60..176
const STRAD_P = 'xenoplast quarrin vetu';            // WORDS 에 없는 낱말(다른 줄과 헷갈리지 않게)
function f28b() {
  return twoCol({ rows: [
    { label: ['Zorvat mekil pl'], p: 3 }, { label: ['Mekil plon tra'], p: 3 },
    { label: [], p: [[[STRAD, XA], [STRAD_P, 178]]].concat(prose(2, 3, 36)) },
    { label: ['Vendo quilar ba'], p: 3 }, { label: ['Renu fimal oska'], p: 3 }
  ] });
}
test('RT28b R2b: 아이템이 P 시작을 넘어 걸치면 그 run 은 자르지 않는다 — 한 줄 그대로 · 글자 다중 집합 동일', () => {
  const off = lay(f28b(), OFF);
  const j = off.lines.find((l) => l.text.startsWith(STRAD));
  assert.ok(j && j.runs.length === 1 && j.text.includes(STRAD_P), '전제: 7b 없을 때 걸친 아이템과 다음 아이템이 한 run');
  const L = lay(f28b());
  assert.ok(L.lines.some((l) => l.rt), '전제: 표는 잡힌다');
  const got = L.lines.filter((l) => l.text.includes(STRAD) || l.text.includes(STRAD_P));
  assert.equal(got.length, 1, '두 아이템이 한 줄에 그대로: ' + got.map((l) => l.text.slice(0, 20)).join(' / '));
  assert.ok(got[0].text.startsWith(STRAD) && got[0].text.includes(STRAD_P));
  assert.deepEqual(itemBag(L), itemBag(off));
});

/* ── RT29 ────────────────────────────────────────────── */
const CAP1 = 'Figure 3. Zorvat mekil plon trasse vendo quilar (ab';   // 7단계 figure-caption, 통로를 덮음(띠 안 — 0.55W 미만)
const CAP2 = 'diagnosis).';
function f29() {
  return twoCol({ rows: [
    { label: ['Zorvat'], p: 3 }, { label: ['Mekil'], p: 3 },
    { line: CAP1, x: XA, after: LEAD }, { line: CAP2, x: XA },
    { label: ['Plon'], p: 3 }, { label: ['Trasse'], p: 3 }
  ] });
}
test('RT29 ★ 띠 안 figure-caption 줄 · 홀로 선 캡션 둘째 줄 → 캡션이 띠를 끊음 · 홀로 선 칸 역할 유지', () => {
  const L = lay(f29());
  const off = lay(f29(), OFF);
  const c1 = L.lines.find((l) => l.text === CAP1);
  assert.equal(c1.role, 'figure-caption');
  assert.ok(!c1.rt, '캡션 줄은 표의 칸·구획이 아니다(띠를 끊는다)');
  assert.deepEqual(heads(L), ['Zorvat', 'Mekil', 'Plon', 'Trasse']);
  const c2 = L.lines.find((l) => l.text === CAP2);
  assert.equal(c2.role, off.lines.find((l) => l.text === CAP2).role, '캡션 둘째 줄은 7단계 역할 그대로');
  assert.notEqual(L.paragraphs.find((p) => p.lineIds.includes(c2.id)).kind, 'rowhead');
  // 읽기 순서: Mekil 행 → 캡션 → 둘째 줄 → Plon 행
  const seq = L.paragraphs.map((p) => p.text).filter((t) => /^(Zorvat|Mekil|Plon|Trasse|Figure 3|diagnosis)/.test(t));
  assert.deepEqual(seq.map((t) => t.split(' ')[0]), ['Zorvat', 'Mekil', 'Figure', 'diagnosis).', 'Plon', 'Trasse']);
});

/* ── RT30 ────────────────────────────────────────────── */
/* 8i 의 3열(쪽 번호 열) 표 픽스처 — tests/rowtable-8i.test.mjs 의 rowTable 과 같은 모양(가운데 정렬 11pt 이름표). */
function rowTable(spec) {
  const x = { A: 89, R: 208, P: 256 };
  const items = [];
  let y = spec.top || 640;
  const LD = 9.5, CELL = 16, ROWG = 18, LAB = 13;
  if (spec.colhead) { items.push(item('Topic', x.A, y, 11)); items.push(item('Ref Page Key Notes Column', 193, y, 12)); y -= 22; }
  let seed = 1;
  for (const r of spec.rows) {
    if (r.section) { items.push(item(r.section, x.A, y, r.fs || 11)); y -= ROWG + 2; continue; }
    if (r.wide) { items.push(item(r.wide, x.A, y, 11)); y -= ROWG + 2; continue; }
    if (r.line) { items.push(item(r.line, x.A, y, r.fs || 8)); y -= ROWG; continue; }   // [8i-2b] 임의의 한 줄(캡션)
    const first = y;
    const cellTop = [];
    r.cells.forEach(function (c, ci) {
      if (ci) y -= CELL - LD;
      cellTop.push(y);
      prose(c.n, seed++).forEach(function (s, li) {
        if (c.split && c.split.includes(li)) {   // [8i-2b] 이 줄은 run 둘(틈 12pt — 숨은 열 모양)
          const a = s.slice(0, 20 + (li % 3) * 3).trim(), b = s.slice(a.length).trim();
          items.push(item(a, x.P, y, 8)); items.push(item(b, x.P + a.length * 4 + 12, y, 8));
        } else items.push(item(s, x.P, y, 8));
        y -= LD;
      });
    });
    const last = y + LD;
    const top = (first + last) / 2 + LAB * (r.label.length - 1) / 2;
    r.label.forEach(function (s, i) { items.push(item(s, x.A, top - LAB * i, 11)); });
    (r.refs || []).forEach(function (ref, i) {
      items.push(item(ref, x.R, i === 0 ? top - LAB * Math.min(r.label.length - 1, 1) : cellTop[Math.min(cellTop.length - 1, i)], 9));
    });
    y = last - ROWG;
  }
  return items;
}
const T1 = { rows: [
  { label: ['Zorvat Lesions &', 'Mekil Goiter'], refs: ['1106'], cells: [{ n: 3 }] },
  { label: ['Plonitis', '& Pseudo-', 'hypoplonitis'], refs: ['1130'], cells: [{ n: 5 }] },
  { label: ['Trasse &', 'Vendopenia'], refs: ['1138', '1139'], cells: [{ n: 4 }, { n: 3 }] },
  { label: ['Quilar Disease', 'of Basto (Renu', 'Fimalis)'], refs: ['1143'], cells: [{ n: 4 }] },
  { label: ['Oskat &', 'Drevalacia'], refs: ['1142'], cells: [{ n: 3 }] }
] };
const T14 = { colhead: true, rows: [
  { section: 'CHAPTER 1: SAMPLE ZORVAT PREVENTION' },
  { label: ['Zorvat Lesions &', 'Mekil Goiter'], refs: ['104'], cells: [{ n: 3 }] },
  { wide: 'CHAPTER 2: ORVIN GESSEL AND SARTO PEKAL DISORDERS OF NIVO TARMA' },
  { label: ['Plonitis &', 'Trasse'], refs: ['130'], cells: [{ n: 4 }] },
  { label: ['Vendo Quilar'], refs: ['138'], cells: [{ n: 4 }] },
  { label: ['Basto Renu &', 'Fimal Oskat'], refs: ['143'], cells: [{ n: 3 }] },
  { wide: 'CHAPTER 3: DREVA LUMIN AND SARTO PEKAL DISORDERS OF GESSEL ORV' },
  { label: ['Lumin &', 'Drevalacia'], refs: ['155'], cells: [{ n: 3 }] }
] };
/* 구획 줄이 7단계 body(8pt·마침표)인 R 표 — 2열 규칙(구획 역할 유지)이 R 표에 새면 heading → body 로 바뀐다 */
const T7b = { rows: [
  { label: ['Zorvat Lesions'], refs: ['210'], cells: [{ n: 4 }] },
  { section: 'Chapter nine sample orvin disorders zz.', fs: 8 },
  { label: ['Mekil Plonitis'], refs: ['215'], cells: [{ n: 5 }] },
  { label: ['Trasse Vendo'], refs: ['216'], cells: [{ n: 4 }] },
  { label: ['Quilar Basto'], refs: ['220'], cells: [{ n: 3 }] }
] };
test('RT30 ★ R(쪽 번호 열) 있는 표는 2열 규칙을 거치지 않는다 — REQUIRE_REF false 여도 8i 와 JSON 바이트 동일', () => {
  for (const [name, spec] of [['RT1', T1], ['RT14', T14], ['RT7b', T7b]]) {
    const a = lay(rowTable(spec), TWO), b = lay(rowTable(spec), REF);
    assert.ok(b.lines.some((l) => l.role === 'ref'), name + ' 전제: 8i 가 R 표로 잡는다');
    assert.equal(noAlgo(a), noAlgo(b), name);
  }
  const L = lay(rowTable(T7b), TWO);
  const sec = L.lines.find((l) => l.text.startsWith('Chapter nine'));
  assert.equal(sec.rt && sec.rt.cell, 'S', '전제: 구획 줄');
  assert.equal(sec.role, 'heading', 'R 표의 구획 줄은 8i 그대로 heading');
  assert.equal(lay(rowTable(T7b), OFF).lines.find((l) => l.text.startsWith('Chapter nine')).role, 'body', '전제: 7단계는 body');
});

/* ── RT30b–RT30e [8i-2b] ─────────────────────────────── */
/* D10 구멍(Review 8i2R-6 B): R 표 → 넓은 장 제목 → R7 로 물려받은 아래 띠(행 사이 구획 줄 + P 칸 둘인 행)에 쪽 번호가 하나도 없다.
 * 8i-2 판은 이 띠의 `det.R` 이 비어 2열 규칙(구획 역할 유지 · R5b 이름표 쪼개기 …)을 탔다 — REQUIRE_REF true 에서도.
 * 아래 띠는 혼자서는 R3 를 못 넘는다(2열 표로 새로 잡히지 않고 물려받기만 한다). */
const SEC_BELOW = 'Orvin tarma gessel pekal sarto nivo lumin';
const d10 = (top) => ({ rows: top.concat([
  { label: ['Lumin &', 'Drevalacia'], cells: [{ n: 3 }] },
  { section: SEC_BELOW, fs: 8 },                                          // 구획 줄(7단계 body)
  { label: ['Sarto &', 'Pekalosis'], cells: [{ n: 2 }, { n: 2 }] }        // 둘째 이름표 줄 = 둘째 P 칸 첫 줄 높이(R5b 가 새면 쪼갠다)
]) });
const D10_TOP = [
  { label: ['Zorvat Lesions &', 'Mekil Goiter'], refs: ['104'], cells: [{ n: 3 }] },
  { label: ['Plonitis &', 'Trasse'], refs: ['130'], cells: [{ n: 4 }] },
  { label: ['Vendo Quilar'], refs: ['138'], cells: [{ n: 4 }] },
  { label: ['Basto Renu &', 'Fimal Oskat'], refs: ['143'], cells: [{ n: 3 }] },
  { wide: 'CHAPTER 3: DREVA LUMIN AND SARTO PEKAL DISORDERS OF GESSEL ORV' }
];
const belowSig = (L) => { const i = L.lines.findIndex((l) => /^CHAPTER 3/.test(l.text)); return L.lines.slice(i).map((l) => [l.role, l.col, l.rt ? l.rt.cell + l.rt.row : '-'].join(' ')); };
/* 8i(246e392) 코드로 뽑은 아래 띠 줄 [role col 칸+행] — 장 제목부터 */
const D10_8I = ['heading span -', 'body rA A4', 'body rA A4', 'body rP P4', 'body rP P4', 'body rP P4', 'heading rS S5',
  'body rA A6', 'body rA A6', 'body rP P6', 'body rP P6', 'body rP P6', 'body rP P6'];
test('RT30b ★ D10: R 표에서 물려받은 띠에 쪽 번호가 없어도 2열 경로가 아니다 — REQUIRE_REF false·true 모두 8i 와 같다', () => {
  const items = rowTable(d10(D10_TOP));
  const a = lay(items, TWO), b = lay(items, REF);
  assert.equal(b.lines.filter((l) => l.role === 'ref').length, 4, '전제: 위 표만 쪽 번호가 있다');
  assert.ok(b.lines.some((l) => l.text === 'Lumin &' && l.rt && l.rt.cell === 'A'), '전제: 아래 띠도 물려받아 행 표');
  assert.equal(lay(items, OFF).lines.find((l) => l.text === SEC_BELOW).role, 'body', '전제: 구획 줄은 7단계 body');
  for (const [name, L] of [['REQUIRE_REF false', a], ['REQUIRE_REF true', b]]) {
    const sec = L.lines.find((l) => l.text === SEC_BELOW);
    assert.equal(sec.rt && sec.rt.cell, 'S', name + ' 구획 줄');
    assert.equal(sec.role, 'heading', name + ': R 표의 구획 줄은 8i 그대로 heading(2열 역할 유지 아님)');
    assert.deepEqual(heads(L).slice(-2), ['Lumin & Drevalacia', 'Sarto & Pekalosis'], name + ': 이름표를 R5b 로 쪼개지 않는다');
    assert.deepEqual(belowSig(L), D10_8I, name + ': 8i 와 같은 줄·역할·칸');
  }
  assert.equal(noAlgo(a), noAlgo(b), 'REQUIRE_REF false·true JSON 바이트 동일');
});

/* V4(Review 8i2R-7): (f) 숨은 열 가드는 2열 표에만 — R 표는 P 줄 여럿이 run 둘이어도 8i 그대로 R 표 */
const T30c = [
  { label: ['Zorvat Lesions &', 'Mekil Goiter'], refs: ['104'], cells: [{ n: 3, split: [1] }] },
  { label: ['Plonitis &', 'Trasse'], refs: ['130'], cells: [{ n: 4, split: [0, 2] }] },
  { label: ['Vendo Quilar'], refs: ['138'], cells: [{ n: 4, split: [1] }] },
  { label: ['Basto Renu &', 'Fimal Oskat'], refs: ['143'], cells: [{ n: 3 }] }
];
test('RT30c R 표의 P 줄 일부가 run 둘(비율 ≥ HIDDEN_COL)이어도 숨은 열 가드를 걸지 않는다 — 8i 그대로 R 표', () => {
  const items = rowTable({ rows: T30c });
  const off = lay(items, OFF);
  const pY = new Set(), multiY = new Set();
  for (const l of off.lines) for (const r of l.runs) if (r.x0 >= 250) { pY.add(l.baseline); if (l.runs.filter((q) => q.x0 >= 250).length >= 2) multiY.add(l.baseline); }
  assert.ok(multiY.size >= ROWTABLE.HIDDEN_COL * pY.size, '전제: run 둘인 P 줄 비율 ≥ HIDDEN_COL (' + multiY.size + '/' + pY.size + ')');
  const a = lay(items, TWO), b = lay(items, REF);
  assert.equal(b.lines.filter((l) => l.role === 'ref').length, 4, '8i 는 R 표로 잡는다');
  assert.deepEqual(heads(a), ['Zorvat Lesions & Mekil Goiter', 'Plonitis & Trasse', 'Vendo Quilar', 'Basto Renu & Fimal Oskat']);
  assert.equal(noAlgo(a), noAlgo(b));
});

/* V6(Review 8i2R-7): R1b(캡션 줄이 띠를 끊음)는 R 표 띠를 다시 자르지 않는다 */
const CAP30 = 'Figure 3. Zorvat mekil plon trasse vendo quilar (ab';
const T30d = [
  { label: ['Zorvat Lesions &', 'Mekil Goiter'], refs: ['104'], cells: [{ n: 3 }] },
  { label: ['Plonitis &', 'Trasse'], refs: ['130'], cells: [{ n: 4 }] },
  { line: CAP30 },
  { label: ['Vendo Quilar'], refs: ['138'], cells: [{ n: 4 }] },
  { label: ['Basto Renu &', 'Fimal Oskat'], refs: ['143'], cells: [{ n: 3 }] }
];
test('RT30d R 표 띠 안의 figure-caption 줄 — REQUIRE_REF false 여도 띠를 끊지 않는다(8i 와 JSON 바이트 동일)', () => {
  const items = rowTable({ rows: T30d });
  assert.equal(lay(items, OFF).lines.find((l) => l.text === CAP30).role, 'figure-caption', '전제: 7단계 캡션');
  const a = lay(items, TWO), b = lay(items, REF);
  const c = b.lines.find((l) => l.text === CAP30);
  assert.ok(c.rt && c.rt.cell === 'S', '8i: 캡션 줄은 R 표 띠 안 구획 줄');
  assert.equal(b.lines.filter((l) => l.role === 'ref').length, 4);
  assert.equal(noAlgo(a), noAlgo(b));
});

/* 위 셋을 한 쪽에 — R 표 + P 열 여러 run + 띠 안 캡션 + 쪽 번호 없는 물려받은 띠 */
test('RT30e R 표 + run 둘 + 띠 안 캡션 + 쪽 번호 없는 물려받은 띠 → REQUIRE_REF false·true JSON 바이트 동일, 아래 띠는 8i 그대로', () => {
  const top = T30c.slice(0, 2).concat([{ line: CAP30 }], T30c.slice(2), [D10_TOP[4]]);
  const items = rowTable(d10(top));
  const a = lay(items, TWO), b = lay(items, REF);
  assert.equal(b.lines.filter((l) => l.role === 'ref').length, 4);
  assert.ok(b.lines.find((l) => l.text === CAP30).rt, '전제: 캡션은 R 표 띠 안');
  assert.equal(noAlgo(a), noAlgo(b));
  assert.equal(a.lines.find((l) => l.text === SEC_BELOW).role, 'heading');
  assert.deepEqual(heads(a).slice(-2), ['Lumin & Drevalacia', 'Sarto & Pekalosis']);
});

/* ── RT31 ────────────────────────────────────────────── */
test('RT31 ★ 되돌림 스위치: REQUIRE_REF true 면 RT20–RT29 픽스처가 7b 없을 때와 바이트 동일', () => {
  const fx = { RT20: twoCol(F20), RT21: twoCol(F21), RT22: twoCol(F22), RT23: f23(), RT24: twoCol(F24), RT25: f25(), RT25b: f25b(),
    RT26: f26(), RT27: f27(), RT28: f28(), RT29: f29(), RT32: f32(), RT23b: f23b(), RT28b: f28b(),
    RT33: f33(), RT33b: f33b(), RT34: f34(), RT35: f35() };
  for (const [name, items] of Object.entries(fx)) {
    const on = lay(items, TWO);
    if (name !== 'RT25') assert.ok(on.lines.some((l) => l.rt), name + ' 전제: 2열 규칙이 켜지면 표가 잡힌다');
    assert.equal(noAlgo(lay(items, REF)), noAlgo(lay(items, OFF)), name);
  }
});

/* ── RT32 ────────────────────────────────────────────── */
const TITLE = 'TABLE IX-12 Zorvat mekil plon trasse';      // 'TABLE' + 로마 숫자 — 7단계 캡션 정규식에 안 걸린다(body)
function f32() {
  return twoCol({ rows: [
    { line: TITLE, x: XA },
    { label: ['Zorvat'], p: 3 }, { label: ['Mekil'], p: 3 }, { label: ['Plon'], p: 3 }, { label: ['Trasse'], p: 3 }
  ] });
}
test('RT32 2열 표 안 "TABLE …" 구획 줄(7단계 body) → 구획 줄 role body(heading 아님)', () => {
  const L = lay(f32());
  const t = L.lines.find((l) => l.text === TITLE);
  assert.equal(lay(f32(), OFF).lines.find((l) => l.text === TITLE).role, 'body', '전제: 7단계 body');
  assert.ok(t.rt && t.rt.cell === 'S', '전제: 표 안 구획 줄');
  assert.equal(t.role, 'body');
  assert.notEqual(L.paragraphs.find((p) => p.lineIds.includes(t.id)).kind, 'heading');
  assert.deepEqual(heads(L), ['Zorvat', 'Mekil', 'Plon', 'Trasse']);
});

/* ── RT33–RT35 [8i-2c] ───────────────────────────────── */
/* 2열 표시 `det.two` 는 det 를 다시 만드는 세 곳 — R7 `inheritFrom` 의 2열 가지 · R2b · R6b 의 `Object.assign` — 을
 * 지나서도 남아야 한다(8i-2b Review 8i2bR-4 M1–M3). 빠지면 그 띠가 R 표 경로로 떨어져 띠 안 구획 줄이 heading 이 되고
 * (R 표 경로 역할), R5b 이름표 쪼개기도 안 돈다. 세 테스트 모두 "그 단계가 실제로 돌았다"를 전제로 먼저 확인하고,
 * 띠 안 구획 줄(7단계 body — 지어낸 낱말)이 2열 경로대로 body 인지 본다. */
const SEC33 = 'Orvin tarma gessel pekal sarto nivo';        // 35자 × 4 = 140pt → 60..200: 통로를 덮는 구획 줄(0.55W 미만 — 띠 안)
const WIDE33 = 'Zorvat mekil plon trasse vendo quilar basto renu fimal oskat dreva lumin sarto pekal nivo tarma gessel';   // > 0.55W, A 통로에서 시작 → 띠 경계
const tablesOf = (items) => { const d = []; lay(items, TWO, (r) => d.push(...r.tables)); return d; };

/* RT33 — M1: R7 물려받기(2열 부모 → 넓은 줄 아래 띠)가 자식 det 에 `two` 를 준다. */
function f33() {
  return twoCol({ rows: [
    { label: ['Zorvat'], p: 3 }, { label: ['Mekil'], p: 3 }, { label: ['Plon'], p: 3 },
    { line: WIDE33 },
    { label: ['Trasse'], p: 3 }, { line: SEC33 }, { label: ['Vendo'], p: 3 }
  ] });
}
function f33b() {
  // 아래 띠 첫 행: 두 줄 이름표의 둘째 줄('Vendo')이 행 시작 P 줄과 같은 높이 — R5b 가 새 이름표 칸으로 자른다
  return twoCol({ rows: [
    { label: ['Zorvat'], p: 3 }, { label: ['Mekil'], p: 3 }, { label: ['Plon'], p: 3 },
    { line: WIDE33 },
    { label: ['Trasse quilar', 'Vendo'], p: ['Basto renu fimal oskat dreva lumin sarto pekal.', 'Gessel orvin nivo tarma plon mekil zorvat.'] },
    { label: ['Oskat'], p: 3 }
  ] });
}
test('RT33 R7: 2열 부모에게서 물려받은 띠도 2열 — 띠 안 구획 줄 body · R5b 이름표 쪼개기 (M1)', () => {
  const L = lay(f33());
  const tb = tablesOf(f33());
  assert.ok(tb.some((t) => !t.inherited) && tb.some((t) => t.inherited), '전제: 1차 띠 + 물려받은 띠: ' + JSON.stringify(tb.map((t) => t.inherited)));
  assert.ok(!L.lines.find((l) => l.text === WIDE33).rt, '전제: 넓은 줄은 표 밖(띠 경계)');
  assert.deepEqual(heads(L), ['Zorvat', 'Mekil', 'Plon', 'Trasse', 'Vendo']);
  const s = L.lines.find((l) => l.text === SEC33);
  assert.equal(lay(f33(), OFF).lines.find((l) => l.text === SEC33).role, 'body', '전제: 7단계 body');
  assert.ok(s.rt && s.rt.cell === 'S', '전제: 물려받은 띠 안 구획 줄');
  assert.equal(s.role, 'body', '2열 경로 역할(R 표 경로면 heading)');
  assert.notEqual(L.paragraphs.find((p) => p.lineIds.includes(s.id)).kind, 'heading');
  // 두 줄 이름표: 둘째 줄이 행 시작 높이면 다음 행 이름표 — 앞 행에 붙지 않는다
  const L2 = lay(f33b());
  assert.ok(tablesOf(f33b()).some((t) => t.inherited), '전제: 물려받은 띠');
  assert.deepEqual(heads(L2), ['Zorvat', 'Mekil', 'Plon', 'Trasse quilar Vendo', 'Oskat']);
});

/* RT34 — M2: R2b(붙은 run 쪼개기) 뒤 다시 만든 det 에도 `two` 가 남는다. RT28 꼴에 행을 늘리고(띠 줄 25 → 통로를 덮어도
 * 되는 조각 ⌊0.08×25⌋ = 2: 붙은 run + 구획 줄) 띠 안에 구획 줄을 둔다. */
function f34() {
  return twoCol({ rows: [
    { label: ['Zorvat mekil pl'], p: 3 }, { label: ['Mekil plon tra'], p: 3 },
    { label: [JOINED], p: prose(3, 3, 36) },
    { line: SEC33 },
    { label: ['Vendo quilar ba'], p: 3 }, { label: ['Renu fimal oska'], p: 3 },
    { label: ['Fimal oskat dre'], p: 3 }, { label: ['Lumin sarto pek'], p: 3 }, { label: ['Nivo tarma gess'], p: 3 }
  ] });
}
test('RT34 R2b: 붙은 run 을 쪼갠 띠도 2열 — 띠 안 구획 줄 body (M2)', () => {
  const off = lay(f34(), OFF);
  assert.ok(off.lines.some((l) => l.text.startsWith(JOINED + ' •')), '전제: 7b 없을 때 이름표와 설명 첫 줄이 한 run');
  assert.equal(off.lines.find((l) => l.text === SEC33).role, 'body', '전제: 7단계 body');
  const L = lay(f34());
  assert.ok(L.lines.some((l) => l.text === JOINED && l.rt && l.rt.cell === 'A'), '전제: R2b 가 쪼갰다');
  assert.equal(heads(L).length, 8);
  const s = L.lines.find((l) => l.text === SEC33);
  assert.ok(s.rt && s.rt.cell === 'S', '전제: 띠 안 구획 줄');
  assert.equal(s.role, 'body', '2열 경로 역할(R 표 경로면 heading)');
  assert.deepEqual(itemBag(L), itemBag(off));
});

/* RT35 — M3: R6b(2열 열 머리) 뒤 다시 만든 det 에도 `two` 가 남는다. RT23 꼴 + 행 사이 구획 줄. */
function f35() {
  const items = twoCol({ top: 640 - GAP, rows: [
    { label: ['Zorvat'], p: 3 }, { label: ['Mekil'], p: 3 }, { line: SEC33 }, { label: ['Plon'], p: 2 }, { label: ['Trasse'], p: 3 }
  ] });
  items.push(item('Maneuver', 112, 640, 8));      // 머리A — 통로 가운데
  items.push(item('Description', XP, 640, 8));    // 머리P
  return items;
}
test('RT35 R6b: 열 머리를 접은 띠도 2열 — 띠 안 구획 줄 body (M3)', () => {
  const L = lay(f35());
  assert.ok(tablesOf(f35()).some((t) => t.head2), '전제: R6b 가 열 머리를 접었다');
  assert.ok(L.lines.some((l) => l.role === 'colhead' && /Description/.test(l.text)));
  assert.deepEqual(heads(L), ['Zorvat', 'Mekil', 'Plon', 'Trasse']);
  const s = L.lines.find((l) => l.text === SEC33);
  assert.equal(lay(f35(), OFF).lines.find((l) => l.text === SEC33).role, 'body', '전제: 7단계 body');
  assert.ok(s.rt && s.rt.cell === 'S', '전제: 띠 안 구획 줄');
  assert.equal(s.role, 'body', '2열 경로 역할(R 표 경로면 heading)');
});

/* 결정성 — 2열 경로도 같은 입력 두 번이면 바이트 동일 */
test('RT20–RT32 결정성: 같은 입력 두 번 → JSON 바이트 동일', () => {
  for (const items of [twoCol(F20), f23(), f26(), f27(), f28(), f29()]) assert.equal(JSON.stringify(lay(items)), JSON.stringify(lay(items)));
});
