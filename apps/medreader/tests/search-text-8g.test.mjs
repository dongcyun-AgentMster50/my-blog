/* ============================================================
   tests/search-text-8g.test.mjs — 8g 검색 글자 (spec 17-8-12 §7 · §8)

   S1  foldText 길이 보존 · 하이픈·악센트·따옴표
   S2  searchRecordOf 의 text = 화면 글자(describePage → flowParasOf → joinPieces) — 바이트 같다
   S3  text/screen.js 옮김 무변 — 두 옛 모듈이 같은 함수 객체를 다시 export, 순수성 grep
   S7  import map 표에 새 모듈 두 개
   (8g-1 이 순수 함수를 먼저 둔 몫) S8 일치 규칙 표 · S12 묶음 · S17 headingToc · 조각·강조 구간

   픽스처는 전부 **지어낸 글**이다(원서 문장이 아니다).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as screen from '../js/text/screen.js';
import * as reader from '../js/ui/reader.js';
import * as ttsText from '../js/tts/text.js';
import {
  searchRecordOf, foldText, parseQuery, findIn, hitLength, classifyHit, headFreq, headKey, headsOf,
  snippetAt, rangesFor, headingToc, searchKey, SEARCH_KEY, SEARCH_ERR, isWordChar
} from '../js/text/search.js';
import { fromStored, toStored, derivedHash } from '../js/text/store.js';
import { buildPageLayout } from '../js/text/layout.js';
import { SEARCH } from '../js/config.js';

const { describePage, flowParasOf, joinPieces } = screen;
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/* ══ 픽스처 — 저장본 모양(toStored)을 손으로 ══════════════ */

let LID = 0;
function line(text, o) {
  const p = o || {};
  return {
    id: p.id || ('l' + (++LID)), text: text, bbox: [0, 0, 100, 10], baseline: 0,
    fontSize: p.fs == null ? 10 : p.fs, col: p.col == null ? 0 : p.col, role: p.role || 'body',
    hyphenJoin: false, paraId: p.para == null ? null : p.para, regionId: p.region == null ? null : p.region, runs: []
  };
}
function stored(pageNo, lines, paras, regions) {
  return {
    pageNo: pageNo, width: 600, height: 800, algoVersion: 12, storeVersion: 1, derivedHash: derivedHash(),
    lines: lines,
    paragraphs: paras.map((p) => Object.assign({ bbox: [0, 0, 1, 1], continuesNext: false, continuesPrev: false }, p)),
    regions: regions || [],
    columns: { count: 1, gutters: [] },
    stats: { medianFontSize: 10, medianLeading: 12, bodyLeft: [], warn: null, widthFixed: 0 }
  };
}

/** 2단 쪽 — 합성 픽스처(synth-2col)를 실제 레이아웃에 통과시킨다. */
const SYN = JSON.parse(read('./fixtures/synth-2col.json'));
const REC_2COL = (() => {
  const L = buildPageLayout(SYN.items, { pageNo: SYN.pageNo, width: SYN.width, height: SYN.height, styles: SYN.styles });
  return toStored(L);
})();

/** 문단 안 빈 줄(Harrison 꼴) — 화면은 "res-" + 공백 둘로 잇고 fromStored 는 접는다. */
const REC_BLANK = stored(31, [
  line('Zorvatic treatment of res-', { para: 'p1', id: 'b1' }),
  line('   ', { para: 'p1', id: 'b2' }),
  line('piratory mekilosis is plon.', { para: 'p1', id: 'b3' }),
  line('Second paragraph trasse vendo.', { para: 'p2', id: 'b4' })
], [
  { id: 'p1', lineIds: ['b1', 'b2', 'b3'], kind: 'body' },
  { id: 'p2', lineIds: ['b4'], kind: 'body' }
]);

/** 행 표 쪽 — colhead·rowhead(+ref)·내용·인용·머리말·꼬리말·쪽 번호·heading. */
const REC_ROW = stored(44, [
  line('RUNNINGHEADXYZ Chapter Nine', { role: 'header', id: 'h1' }),
  line('Zorvat Disorders', { para: 'q0', id: 'r0', fs: 14 }),
  line('Topic COLHEADQQ Notes', { role: 'colhead', id: 'c1', fs: 11 }),
  line('Plonitis & Pseudo-', { para: 'q1', id: 'r1', fs: 16 }),
  line('hypoplonitis', { para: 'q1', id: 'r2', fs: 16 }),
  line('7777', { role: 'ref', id: 'f1', fs: 9 }),
  line('8888', { role: 'ref', id: 'f2', fs: 9 }),
  line('• quilar basto renu fimal oskat dreva cardio-', { para: 'q2', id: 'r3', fs: 8 }),
  line('vascular lumin sarto.', { para: 'q2', id: 'r4', fs: 8 }),
  line('Varga T et al. J Test Med. [PMID: 31234560]', { para: 'q3', id: 'r5', fs: 8 }),
  line('FOOTERQWERTY press', { role: 'footer', id: 'h2' }),
  line('PAGENO4321', { role: 'pageno', id: 'h3' })
], [
  { id: 'q0', lineIds: ['r0'], kind: 'heading' },
  { id: 'q1', lineIds: ['r1', 'r2'], kind: 'rowhead', refLineIds: ['f1'] },
  { id: 'q2', lineIds: ['r3', 'r4'], kind: 'body' },
  { id: 'q3', lineIds: ['r5'], kind: 'body' }
]);

/** 4-8 표 쪽 — 표 영역 줄은 table 에만. */
const REC_TABLE = stored(52, [
  line('Drug dosing in zorvatitis', { para: 't0', id: 'd0', fs: 13 }),
  line('Drug    Dose', { region: 'g1', role: 'table', id: 'd1' }),
  line('Zorvamycin   10 mg', { region: 'g1', role: 'table', id: 'd2' }),
  line('After the table, mekil plon trasse.', { para: 't1', id: 'd3' })
], [
  { id: 't0', lineIds: ['d0'], kind: 'heading' },
  { id: 't1', lineIds: ['d3'], kind: 'body' }
], [{ id: 'g1', kind: 'table', bbox: [0, 0, 1, 1], lineIds: ['d1', 'd2'], pageNo: 52 }]);

const ALL = [['2단', REC_2COL], ['빈 줄', REC_BLANK], ['행 표', REC_ROW], ['4-8 표', REC_TABLE]];

/** spec S2 의 기준식 — 화면 글자. */
const screenText = (rec) => flowParasOf(describePage(fromStored(rec))).map((p) => joinPieces(p.lines).text).join('\n');

/* ══ S1 접기 ══════════════════════════════════════════ */

test('S1 ★ foldText 는 무작위 유니코드 1만 개(서로게이트·결합 부호·İ 포함)에서 길이를 보존한다', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  const pools = [
    () => String.fromCharCode(Math.floor(rnd() * 0xD800)),
    () => String.fromCodePoint(0x10000 + Math.floor(rnd() * 0xFFFFF)),
    () => String.fromCharCode(0xD800 + Math.floor(rnd() * 0x800)),            // 외톨이 서로게이트
    () => 'é', () => 'İ', () => 'ẞ', () => 'ﬁ', () => 'Σ', () => '‐−­-',
    () => 'É', () => 'Ö', () => '’“”', () => 'β-Blocker'
  ];
  for (let n = 0; n < 10000; n++) {
    let s = '';
    const k = 1 + Math.floor(rnd() * 12);
    for (let i = 0; i < k; i++) s += pools[Math.floor(rnd() * pools.length)]();
    const f = foldText(s);
    assert.equal(f.length, s.length, 'n=' + n + ' ' + JSON.stringify(s));
  }
  assert.equal(foldText('İstanbul').length, 'İstanbul'.length);
  assert.equal(foldText('İ'), 'İ', '길이가 바뀌는 소문자는 원래 글자로 둔다');
});

test('S1 ★ β-blocker·Beta-Blockers·beta blocker·β blocker — 하이픈은 공백, β 는 그대로, 따옴표·악센트', () => {
  assert.equal(foldText('β-blocker'), 'β blocker');
  assert.equal(foldText('β blocker'), 'β blocker');
  assert.equal(foldText('Beta-Blockers'), 'beta blockers');
  assert.equal(foldText('beta blocker'), 'beta blocker');
  assert.equal(foldText('a‐b‑c–d—e−f­g'), 'a b c d e f g');
  assert.equal(foldText('‘x’ “y”'), "'x' \"y\"");
  assert.equal(foldText('Café Ökonom Sjögren'), 'cafe okonom sjogren');
  // 검색어 변형이 β 와 beta 를 잇는다 — 네 꼴이 모두 한 검색어로 찾힌다
  const pq = parseQuery('beta blocker');
  for (const s of ['β-blocker', 'Beta-Blockers', 'beta blocker', 'β blocker']) {
    assert.equal(findIn(foldText(s), pq).length, 1, s);
  }
});

/* ══ S2 저장 글자 = 화면 글자 ═══════════════════════════ */

test('S2 ★ searchRecordOf.text 가 flowParasOf(describePage(fromStored(rec))).map(joinPieces).join("\\n") 과 바이트 같다', () => {
  for (const [name, rec] of ALL) {
    const F = fromStored(rec);
    const r = searchRecordOf(F);
    assert.equal(r.text, screenText(rec), name);
    assert.equal(Buffer.compare(Buffer.from(r.text, 'utf8'), Buffer.from(screenText(rec), 'utf8')), 0, name);
    // desc 를 넘겨도 같다
    assert.deepEqual(searchRecordOf(F, describePage(F)), r, name);
    assert.equal(r.pageNo, rec.pageNo);
    assert.equal(r.algoVersion, rec.algoVersion);
    assert.equal(r.sk, SEARCH_KEY);
  }
  assert.ok(REC_2COL.paragraphs.length >= 4, '2단 픽스처가 문단을 낸다');
});

test('S2 ★ 문단 안 빈 줄 — 화면 글자를 저장한다(fromStored 문단 text 가 아니다)', () => {
  const F = fromStored(REC_BLANK);
  const r = searchRecordOf(F);
  const fp = F.paragraphs.map((p) => p.text).join('\n');
  assert.notEqual(fp, screenText(REC_BLANK), '전제: 이 픽스처에서 둘이 갈린다');
  assert.equal(r.text, screenText(REC_BLANK));
  assert.match(r.text, /res- {2}piratory/, '화면은 "res-" + 공백 둘');
});

test('S2 ★ 행 표 쪽 — rowhead·인용은 text 에, ref·colhead·머리말·꼬리말·쪽 번호는 어디에도 없다 · heads 는 heading 만', () => {
  const r = searchRecordOf(fromStored(REC_ROW));
  for (const bad of ['7777', '8888', 'COLHEADQQ', 'RUNNINGHEADXYZ', 'FOOTERQWERTY', 'PAGENO4321']) {
    assert.equal(r.text.includes(bad), false, 'text 에 ' + bad);
    assert.equal(r.table.includes(bad), false, 'table 에 ' + bad);
  }
  assert.ok(r.text.includes('Plonitis & Pseudo-hypoplonitis'), 'rowhead 글자(하이픈이 산다 — pseudo)');
  assert.ok(r.text.includes('[PMID: 31234560]'), '인용 글자(화면에 있다 — G2)');
  assert.ok(r.text.includes('cardiovascular'), '줄바꿈 하이픈은 화면처럼 붙는다');
  assert.equal(r.table, '');
  // heads: kind heading 만(글자가 더 큰 rowhead 는 없다), r = 14/10
  assert.deepEqual(r.heads, [{ i: 0, o: 0, r: 1.4 }]);
  assert.deepEqual(headsOf(Object.assign({ pageNo: 44 }, r)).map((h) => h.t), ['Zorvat Disorders']);
});

test('S2 ★ 4-8 표 영역 줄은 table 에만(공백 하나로 접어 줄마다 "\\n")', () => {
  const r = searchRecordOf(fromStored(REC_TABLE));
  assert.equal(r.table, 'Drug Dose\nZorvamycin 10 mg');
  assert.equal(r.text.includes('Zorvamycin'), false);
  assert.equal(r.text, 'Drug dosing in zorvatitis\nAfter the table, mekil plon trasse.');
  assert.deepEqual(r.heads, [{ i: 0, o: 0, r: 1.3 }]);
});

test('S2 searchKey — SEARCH.VERSION|DERIVED_HASH, 어느 하나가 바뀌면 다른 값', () => {
  assert.equal(SEARCH_KEY, SEARCH.VERSION + '|' + derivedHash());
  assert.notEqual(searchKey(SEARCH.VERSION + 1), SEARCH_KEY);
  assert.notEqual(searchKey(SEARCH.VERSION, derivedHash(new Set(['zzz']))), SEARCH_KEY);
  assert.equal(searchRecordOf(fromStored(REC_BLANK), null, { sk: 'x' }).sk, 'x');
});

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

test('S3 ★ text/screen.js · text/search.js 는 document·window·indexedDB·fetch 를 참조하지 않는다 (16-A) · import 는 text/* 와 config 만', () => {
  const banned = /\b(document|window|indexedDB|fetch)\b/;
  for (const f of ['../js/text/screen.js', '../js/text/search.js']) {
    const src = read(f);
    const hits = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => banned.test(l));
    assert.deepEqual(hits, [], f);
    const imports = src.match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || [];
    for (const im of imports) assert.match(im, /from\s*['"](\.\/[a-z]+\.js|\.\.\/config\.js)['"]/, f + ': ' + im);
  }
});

/* ══ S7 import map ═══════════════════════════════════ */

test('S7 import map 표에 text/screen.js · text/search.js 가 있다', () => {
  const html = read('../index.html');
  for (const p of ['./js/text/screen.js', './js/text/search.js']) {
    assert.match(html, new RegExp('"' + p.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '": "' + p.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\?v=[0-9a-f]{10}"'), p);
  }
});

/* ══ S8 (순수 몫) 검색어 규칙 표 ═══════════════════════════ */

const hits = (text, q) => { const pq = parseQuery(q); return findIn(pq.cs ? text : foldText(text), pq); };
const words = (text, q) => { const pq = parseQuery(q); const hay = pq.cs ? text : foldText(text); return findIn(hay, pq).map((at) => text.slice(at, at + hitLength(hay, pq, at))); };

test('S8 ★ MI 는 mild·mi·MIS 를 안 찾고 MI.·(MI) 는 찾는다 · mi 는 낱말 전체', () => {
  const t = 'Acute MI. After (MI) the mild mi and MIS, migraine.';
  assert.deepEqual(words(t, 'MI'), ['MI', 'MI']);
  const pq = parseQuery('MI');
  assert.equal(pq.cs, true);
  assert.equal(pq.whole, true);
  assert.deepEqual(words(t, 'mi'), ['MI', 'MI', 'mi'], 'mi 는 낱말 전체 — mild·migraine·MIS 아님');
});

test('S8 ★ 4자 이상은 낱말 시작 접두 — metform 은 metformin, blocker 는 blockers · 앞은 낱말 경계', () => {
  assert.deepEqual(words('Start metformin; avoid premetformin.', 'metform'), ['metform']);
  assert.equal(hits('beta-blockers and blocker', 'blocker').length, 2);
  assert.equal(parseQuery('metform').whole, false);
});

test('S8 ★ 하이픈·합성어 — beta blocker 세 꼴 · pre-eclampsia ↔ preeclampsia ↔ pre eclampsia · pseudohypo… 이름표 · betablocker 는 안 맞춤', () => {
  const t = 'β-blocker; beta blocker; Beta-Blockers.';
  for (const q of ['beta blocker', 'beta-blocker', 'β-blocker']) assert.equal(hits(t, q).length, 3, q);
  const p = 'Severe preeclampsia. Mild pre-eclampsia. Late pre eclampsia.';
  for (const q of ['pre-eclampsia', 'preeclampsia', 'pre eclampsia']) assert.equal(hits(p, q).length, 3, q);
  // 이름표 픽스처의 화면 글자 "Plonitis & Pseudo-hypoplonitis" — 붙인 검색어로 찾는다
  const row = searchRecordOf(fromStored(REC_ROW)).text;
  assert.equal(hits(row, 'pseudohypoplonitis').length, 1);
  assert.equal(hits(row, 'pseudo-hypoplonitis').length, 1);
  // 목록 밖 접두(beta)는 붙여 쓴 검색어로 찾지 않는다(과설계 — 17-8-4)
  assert.equal(hits('beta-blocker', 'betablocker').length, 0);
  // 합성어 변형 없이는 못 찾는다(V4 가 빨개지는 자리)
  assert.equal(findIn(foldText(row), parseQuery('pseudohypoplonitis', { compound: false })).length, 0);
});

test('S8 ★ 검색어 길이 — 1자 ERR_SEARCH_SHORT · 61자 ERR_SEARCH_LONG · 하이픈뿐이면 SHORT · 정규식 메타 문자는 글자 그대로', () => {
  assert.equal(parseQuery('a').error, SEARCH_ERR.SHORT);
  assert.equal(SEARCH_ERR.SHORT, 'ERR_SEARCH_SHORT');
  assert.equal(parseQuery('x'.repeat(61)).error, SEARCH_ERR.LONG);
  assert.equal(SEARCH_ERR.LONG, 'ERR_SEARCH_LONG');
  assert.equal(parseQuery('x'.repeat(60)).error, undefined);
  assert.equal(parseQuery('--').error, SEARCH_ERR.SHORT);
  assert.equal(parseQuery('   ').error, SEARCH_ERR.SHORT);
  assert.deepEqual(findIn('abc', parseQuery('a')), [], '오류 검색어는 빈 결과');
  assert.doesNotThrow(() => parseQuery('(a+b)*['));
  assert.deepEqual(words('x (a+b)*[ y (a+b)', '(a+b)*['), ['(a+b)*[']);
  assert.deepEqual(words('a.b axb', 'a.b'), ['a.b']);
});

test('S8 그리스 문자 ↔ 이름 변형은 OR · limit 에서 자른다 · 중복 오프셋 없음', () => {
  const pq = parseQuery('alpha blockade');
  assert.ok(pq.variants.includes('α blockade'));
  assert.equal(hits('α-blockade and alpha blockade', 'alpha blockade').length, 2);
  assert.deepEqual(findIn('the the the', parseQuery('the'), 2), [0, 4]);
  const at = findIn(foldText('beta beta'), parseQuery('beta'));
  assert.deepEqual(at, [0, 5]);
  assert.equal(isWordChar('é'), true);
  assert.equal(isWordChar('-'), false);
  assert.equal(isWordChar(undefined), false);
});

/* ══ S12 (순수 몫) 묶음 ═════════════════════════════════ */

test('S12 ★ classifyHit — heading = head, 같은 글자 10번 이상인 heading = body, 표 = table, rowhead·인용 = body', () => {
  const rec = Object.assign({ pageNo: 44 }, searchRecordOf(fromStored(REC_ROW)));
  const at = (s) => rec.text.indexOf(s);
  assert.equal(classifyHit(rec, at('Disorders')), 'head');
  assert.equal(classifyHit(rec, at('hypoplonitis')), 'body', 'rowhead');
  assert.equal(classifyHit(rec, at('PMID')), 'body', '인용');
  assert.equal(classifyHit(rec, 0, { table: true }), 'table');
  // 일반 소제목 강등(U8)
  const freq = new Map([[headKey('Zorvat Disorders'), SEARCH.REPEAT_HEADING]]);
  assert.equal(classifyHit(rec, at('Disorders'), { freq: freq }), 'body');
  freq.set(headKey('Zorvat Disorders'), SEARCH.REPEAT_HEADING - 1);
  assert.equal(classifyHit(rec, at('Disorders'), { freq: freq }), 'head');
});

test('S12 headFreq — 책 전체 heading 빈도(접은 키)', () => {
  const recs = [];
  for (let p = 1; p <= 12; p++) recs.push({ pageNo: p, text: 'Treatment\nbody ' + p, heads: [{ i: 0, o: 0, r: 1.2 }] });
  recs.push({ pageNo: 13, text: 'TREATMENT:\nx', heads: [{ i: 0, o: 0, r: 1.2 }] });
  const f = headFreq(recs);
  assert.equal(f.get('treatment'), 13);
  assert.equal(classifyHit(recs[0], 2, { freq: f }), 'body');
});

/* ══ S17 (순수 몫) heading 폴백 목차 ═══════════════════════ */

test('S17 ★ headingToc — 반복 제목 빠짐 · 숫자만인 항목에 같은 쪽 다음 heading 을 붙임 · 상한 · rowhead 0', () => {
  const recs = [];
  for (let p = 1; p <= 30; p++) {
    const parts = [];
    const heads = [];
    const add = (t, r) => { heads.push({ i: parts.length, o: parts.join('\n').length + (parts.length ? 1 : 0), r: r }); parts.push(t); };
    if (p % 10 === 1) { add(String(p), 2.4); add('Zorvat Chapter ' + p, 1.8); }
    add('Treatment', 2.4);                                   // 30번 반복 — 일반 소제목
    add('Section ' + p, 1.2);
    parts.push('body text ' + p);
    recs.push({ pageNo: p, text: parts.join('\n'), heads: heads });
  }
  const toc = headingToc(recs);
  assert.equal(toc.some((e) => /Treatment/.test(e.t)), false, '반복 제목이 없다');
  assert.ok(toc.length <= SEARCH.TOC_FALLBACK_MAX);
  // 상위 층(2.4)에는 숫자 3개뿐 → 다음 층 1.8 까지 6개, 1.2 층을 더하면 36 — 200 안이라 다 들어간다
  assert.equal(toc.length, 36);
  const ch = toc.filter((e) => e.r === 2.4);
  assert.deepEqual(ch.map((e) => e.t), ['1 Zorvat Chapter 1', '11 Zorvat Chapter 11', '21 Zorvat Chapter 21']);
  // 상한이 작으면 위 층만
  const small = headingToc(recs, { max: 10 });
  assert.deepEqual(small.map((e) => e.r), [2.4, 1.8, 2.4, 1.8, 2.4, 1.8]);
  // 글자가 큰 rowhead 는 heads 에 없으므로 목차에도 없다(구조로 0)
  const row = Object.assign({ pageNo: 44 }, searchRecordOf(fromStored(REC_ROW)));
  assert.deepEqual(headingToc([row]).map((e) => e.t), ['Zorvat Disorders']);
});

/* ══ 조각·강조 구간 ═════════════════════════════════════ */

test('snippetAt — 앞뒤 n 자를 낱말 경계로 넓히고 문단을 넘지 않는다 · 세 조각', () => {
  const t = 'first para here\nalpha beta gamma delta epsilon zeta eta theta\nlast';
  const at = t.indexOf('delta');
  const s = snippetAt(t, at, 5, 8);
  assert.equal(s.hit, 'delta');
  assert.equal(s.before, 'beta gamma ');
  assert.equal(s.after, ' epsilon');
  assert.equal(s.cutStart, true);
  assert.equal(s.cutEnd, true);
  const s2 = snippetAt(t, 0, 5, 100);
  assert.equal(s2.before + s2.hit + s2.after, 'first para here');
  assert.equal(s2.cutStart, false);
});

test('rangesFor ★ 줄바꿈 하이픈으로 갈린 낱말 — 두 줄에 걸친 구간 둘(10a localRange)', () => {
  const F = fromStored(REC_ROW);
  const paras = flowParasOf(describePage(F));
  const p = paras.find((x) => x.lines.some((l) => /cardio-$/.test(l.text)));
  const j = joinPieces(p.lines);
  const pq = parseQuery('cardiovascular');
  const at = findIn(foldText(j.text), pq);
  assert.equal(at.length, 1);
  const rs = rangesFor(j, [{ at: at[0], len: hitLength(foldText(j.text), pq, at[0]) }]);
  assert.equal(rs.length, 1);
  assert.equal(rs[0].length, 2, '두 줄');
  assert.deepEqual(rs[0].map((r) => r.id), ['r3', 'r4']);
  const l3 = p.lines.find((l) => l.id === 'r3').text;
  assert.equal(l3.slice(rs[0][0].start, rs[0][0].end), 'cardio');
  assert.equal('vascular lumin sarto.'.slice(rs[0][1].start, rs[0][1].end), 'vascular');
  for (const r of rs[0]) assert.ok(r.end > r.start, '빈 구간 없음');
});
