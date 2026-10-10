/* ============================================================
   tests/split-contract-8a.test.mjs — spec 7-8-2 "분할은 한 벌" R1~R6 · 3-2 · 16-D2

   번역 단위 = 낭독 단위. 문장을 나누는 함수가 두 곳에서 불리면 번역이 한 문장씩 밀린다.
   - R1 같은 입력에 `buildUnits` 두 번 → `sentencesOf` 가 같다
   - R2 모든 Unit 의 `src` 가 `sentencesOf` 안에 정확히 하나
   - R3 300자 분할 문장 — 조각 ≥ 2, 항목 1
   - R4 표 안내가 낀 큐와 안 낀 큐의 `sentencesOf` 가 같다
   - R5 (변이) `sentencesOf` 가 따로 나누면 R2 가 빨개진다 — 보고서에 기록(이 파일은 R2 를 고정한다)
   - R6 grep — `splitSentences` 호출은 `js/tts/text.js` 한 곳, 정의는 `js/text/segment.js` 한 곳

   픽스처 문장은 전부 지어낸 것이다(원서 문장 아님).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildUnits, sentencesOf, TABLE_NOTICE_KIND } from '../js/tts/text.js';
import { describePage, flowParasOf, insertTableNotices, tableNoticePara } from '../js/ui/reader.js';

const ln = (id, text, hyphen) => ({ id: id, text: text, hyphen: hyphen || 'none' });
const para = (id, lines, kind) => ({ id: id, kind: kind || 'body', lines: lines });

const LONG = 'The committee compared several regimens across many centers, ' +
  'including older agents, newer biologic agents, and combined approaches, ' +
  'while tracking laboratory markers, imaging findings, functional scores, ' +
  'and the frequency of adverse events over a follow-up period that, in some ' +
  'cohorts, extended well beyond the original protocol window of the study';

/** 약어(e.g.·Dr.)·하이픈 결합·기호·300자 초과·짧은 문단·쪽 끝 미완 문장이 다 들어 있는 한 쪽. */
function pageParas() {
  return [
    para('p1', [
      ln('1:1', 'continued from the previous page. Dr. Kim reviewed the'),
      ln('1:2', 'chart, e.g. Temperature and pulse, and noted a cardio-', 'hidden'),
      ln('1:3', 'vascular risk of ≥ 20% in 3 of 10 cases.')
    ]),
    para('p2', [ln('2:1', LONG + '.')]),
    para('p3', [ln('3:1', 'Short note.'), ln('3:2', 'Another one follows here.')]),
    para('p4', [ln('4:1', 'The final sentence on this page continues on the')])
  ];
}

/* ── R1 ─────────────────────────────────────────────── */

test('R1 같은 입력에 buildUnits 두 번 → sentencesOf 가 JSON 기준 같다', () => {
  const a = sentencesOf(buildUnits(pageParas(), 'sentence'));
  const b = sentencesOf(buildUnits(pageParas(), 'sentence'));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.ok(a.length >= 6, '픽스처가 문장을 충분히 만든다: ' + a.length);
});

/* ── R2 ─────────────────────────────────────────────── */

test('R2 ★ 모든 Unit 에 대해 sentencesOf 안에 src 가 같은 항목이 정확히 하나 (조각 포함)', () => {
  const units = buildUnits(pageParas(), 'sentence');
  const sents = sentencesOf(units);
  for (const u of units) {
    const n = sents.filter((s) => s.src === u.src).length;
    assert.equal(n, 1, 'src 가 ' + n + '번: ' + u.src.slice(0, 50));
  }
  // 거꾸로도 — 모든 항목이 어떤 Unit 의 src 다(번역이 발화에 1:1 로 붙는다).
  for (const s of sents) assert.ok(units.some((u) => u.src === s.src && u.seg === s.seg));
  // 약어에서 끊기지 않았다(분할이 한 벌이라는 것의 구체적 모습).
  assert.ok(sents.some((s) => /Dr\. Kim reviewed the chart, e\.g\. Temperature/.test(s.src)));
});

test('R2-보조 seg 는 0 부터 연속이고, 조각들은 같은 seg·같은 src', () => {
  const units = buildUnits(pageParas(), 'sentence');
  const segs = [...new Set(units.map((u) => u.seg))];
  assert.deepEqual(segs, segs.map((_, i) => i));
  for (const u of units) {
    const same = units.filter((x) => x.seg === u.seg);
    assert.ok(same.every((x) => x.src === u.src && x.paraId === u.paraId));
  }
});

/* ── R3 ─────────────────────────────────────────────── */

test('R3 300자 분할 문장: 조각 수 ≥ 2 인데 sentencesOf 항목은 1개', () => {
  const units = buildUnits(pageParas(), 'sentence');
  const long = units.filter((u) => u.paraId === 'p2');
  assert.ok(long.length >= 2, '조각 ' + long.length);
  assert.ok(long.every((u) => u.parts === long.length));
  const items = sentencesOf(units).filter((s) => s.paraId === 'p2');
  assert.equal(items.length, 1);
  assert.equal(items[0].src, LONG + '.');
});

/* ── R4 ─────────────────────────────────────────────── */

test('R4 표 안내가 낀 큐와 안 낀 큐의 sentencesOf 가 같다', () => {
  const plain = pageParas();
  const withNotice = [plain[0], tableNoticePara('r1', 'Table skipped.'), plain[1], plain[2],
    tableNoticePara('r2', 'Another table skipped.'), plain[3]];
  const a = sentencesOf(buildUnits(plain, 'sentence'));
  const b = sentencesOf(buildUnits(withNotice, 'sentence'));
  assert.deepEqual(b, a);
  // 안내 발화는 큐에는 있다(낭독은 한다) — 번호를 받지 않을 뿐이다.
  const nb = buildUnits(withNotice, 'sentence').filter((u) => u.kind === TABLE_NOTICE_KIND);
  assert.equal(nb.length, 2);
  assert.ok(nb.every((u) => u.seg === null));
});

test('R4-보조 insertTableNotices 를 거친 실제 경로도 같다 (flowParasOf → 안내 끼우기)', () => {
  const layout = {
    pageNo: 7,
    lines: [
      { id: '7:1', text: 'Fever was common. It resolved quickly.', paraId: 'a' },
      { id: '7:2', text: 'cell', regionId: 'r1' },
      { id: '7:3', text: 'Rash appeared in 4 of 12 cases.', paraId: 'b' }
    ],
    paragraphs: [{ id: 'a', kind: 'body', lineIds: ['7:1'] }, { id: 'b', kind: 'body', lineIds: ['7:3'] }],
    regions: [{ id: 'r1', kind: 'table', lineIds: ['7:2'] }]
  };
  const desc = describePage(layout);
  const bare = flowParasOf(desc);
  const noticed = insertTableNotices(bare, desc.blocks, new Set(), 'Table skipped.');
  assert.equal(noticed.length, bare.length + 1);
  assert.deepEqual(sentencesOf(buildUnits(noticed, 'sentence')), sentencesOf(buildUnits(bare, 'sentence')));
});

/* ── Unit 필드 ──────────────────────────────────────── */

test('Unit.src 는 낭독 정규화 이전의 원문 — 기호는 src 에 남고 text 에서는 낱말이 된다', () => {
  const units = buildUnits(pageParas(), 'sentence');
  const u = units.find((x) => /cardiovascular/.test(x.src));
  assert.ok(u, '하이픈 결합 뒤의 원문(cardiovascular)이 src 에 있다');
  assert.match(u.src, /≥ 20%/);
  assert.ok(!/≥/.test(u.text), 'text 는 낭독용으로 바뀐다: ' + u.text);
  assert.equal(u.kind, 'body');
});

test('frag — 쪽 첫 문장이 소문자로 시작하면 tail, 쪽 끝 문장이 안 끝났으면 head, 그 밖 null', () => {
  const s = sentencesOf(buildUnits(pageParas(), 'sentence'));
  assert.equal(s[0].frag, 'tail');
  assert.equal(s[s.length - 1].frag, 'head');
  assert.ok(s.slice(1, -1).every((x) => x.frag === null));
  // 깨끗한 쪽은 둘 다 null.
  const clean = sentencesOf(buildUnits([para('q', [ln('q:1', 'One sentence. Two sentences.')])], 'sentence'));
  assert.deepEqual(clean.map((x) => x.frag), [null, null]);
});

test('sentencesOf 는 seg 오름차순·seg 당 하나이고 표 안내를 뺀다 (입력 순서가 섞여도)', () => {
  const units = buildUnits(pageParas(), 'sentence');
  const shuffled = units.slice().reverse();
  assert.deepEqual(sentencesOf(shuffled).map((x) => x.seg), sentencesOf(units).map((x) => x.seg));
  assert.deepEqual(sentencesOf([]), []);
  assert.deepEqual(sentencesOf([{ text: 't', src: 't', seg: null, kind: TABLE_NOTICE_KIND }]), []);
});

/* ── R6 · 3-2 grep ──────────────────────────────────── */

const JS = fileURLToPath(new URL('../js/', import.meta.url));

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

test('R6 ★ grep — splitSentences 호출은 js/tts/text.js 한 곳, 정의는 js/text/segment.js 한 곳', () => {
  const callers = [];
  const definers = [];
  for (const f of jsFiles(JS)) {
    const code = stripComments(readFileSync(f, 'utf8'));
    const rel = f.slice(JS.length).replace(/\\/g, '/');
    if (/export function splitSentences\s*\(/.test(code)) definers.push(rel);
    if (/(?<!function )\bsplitSentences\s*\(/.test(code)) callers.push(rel);
  }
  assert.deepEqual(definers, ['text/segment.js']);
  assert.deepEqual(callers, ['tts/text.js']);
  // 그 한 곳에서도 호출은 한 번(buildUnits 안)뿐이다.
  const tts = stripComments(readFileSync(join(JS, 'tts/text.js'), 'utf8'));
  assert.equal((tts.match(/\bsplitSentences\s*\(/g) || []).length, 1);
});

test('3-2 ★ ai/* 는 ui/ 와 text/segment 를 import 하지 않는다', () => {
  const dir = join(JS, 'ai');
  for (const f of jsFiles(dir)) {
    const src = readFileSync(f, 'utf8');
    const imports = src.match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || [];
    for (const im of imports) {
      assert.ok(!/['"][^'"]*\/ui\//.test(im), f + ' 가 ui 를 import 한다: ' + im);
      assert.ok(!/text\/segment/.test(im), f + ' 가 text/segment 를 import 한다: ' + im);
    }
  }
});

test('flowParas() 는 flowParasOf 에 표 안내만 더한 것이다 (같은 함수를 지난다)', () => {
  const src = readFileSync(join(JS, 'ui/reader.js'), 'utf8');
  const fn = src.slice(src.indexOf('export function flowParas()'), src.indexOf('export function flowParasOf('));
  assert.match(fn, /insertTableNotices\(flowParasOf\(state\.desc\)/);
  assert.doesNotMatch(fn, /for \(/, 'flowParas 안에 문단 고르기가 따로 남아 있다');
});
