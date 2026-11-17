/* ============================================================
   tests/anchor-20.test.mjs — 20-1 필기 앵커 (spec 17-16 3 · 9 "20-1" [N] — 순수)

   - A1 같은 판 → 'exact' · A2 ★ 줄 id 를 모두 바꾼 판(문단 순서 뒤섞기) → 'para' 로 같은 글자(앞에 같은 인용·같은 문맥의 미끼 문단)
   - A3 문단 해시도 다른 판(그 문단 한 낱말 바뀜) → 'page' · A4 ★ 같은 낱말이 쪽에 셋 → prefix·suffix 로 맞는 것
   - A5 하이픈 줄바꿈이 바뀜("cardio-\nvascular" ↔ 한 줄) → 같은 글자 · 지킨 하이픈 ↔ 붙은 낱말 → 'fuzzy'
   - A6 인용이 사라짐 → null · A7 접은 글자·짧은 인용 오탐 막기·anchorOf 다듬기·findQuote · A8 같은 판이어도 줄 글자가 다르면 'exact' 아님
   - A9 `screenIndex`·`rangesOnScreen` 옮김 — `ui/search.js` 가 같은 함수 객체를 다시 export, 옛 자리에 정의 없음
   지어낸 글자만.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

const A = await import('../js/text/anchor.js');
const screen = await import('../js/text/screen.js');
const { hashHex, normalizeForHash } = await import('../js/hash.js');
const { ANNO } = await import('../js/config.js');
const { joinHyphen } = await import('../js/text/hyphen.js');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/**
 * 설명(`describePage` 꼴) — paras: [{id, lines:[[줄 id, 글자]…]}]. 하이픈 잇기는 앱과 같은 `joinHyphen` 판정.
 */
function desc(paras) {
  return {
    pageNo: 7,
    blocks: paras.map((p) => {
      const lines = p.lines.map(([id, text]) => ({ id: id, text: text, hyphen: 'none' }));
      for (let i = 0; i < lines.length - 1; i++) {
        const r = joinHyphen(lines[i].text, lines[i + 1].text);
        lines[i].hyphen = r.hyphenJoin ? 'hidden' : (r.keptHyphen ? 'kept' : 'none');
      }
      return { type: 'para', id: p.id, kind: 'body', lines: lines };
    })
  };
}
async function hashes(idx) {
  return Promise.all(idx.parts.map((p) => hashHex(normalizeForHash(p.joined.text))));
}
async function made(d, quote, nth, algo) {
  const { idx, paraIds } = A.indexOfDesc(d);
  const ph = await hashes(idx);
  let at = -1;
  for (let i = 0; i <= (nth || 0); i++) at = idx.text.indexOf(quote, at + 1);
  assert.ok(at >= 0, 'quote 없음: ' + quote);
  const an = A.anchorOf(idx, at, at + quote.length, { pageNo: 7, algo: algo == null ? 13 : algo, paraIds: paraIds, paraHashes: ph });
  return { an, idx, at };
}
async function find(d, an, algo) {
  const { idx } = A.indexOfDesc(d);
  const res = A.resolve(an, idx, { algo: algo == null ? 14 : algo, paraHashes: await hashes(idx) });
  return { res, idx, text: res ? idx.text.slice(res.at, res.at + res.len) : null };
}
/** 줄 구간 → 그 줄 글자(줄 id → 글자 표). */
function rangeText(d, ranges) {
  const byId = new Map();
  for (const b of d.blocks) for (const l of b.lines) byId.set(l.id, l.text);
  return ranges.map((r) => byId.get(r.id).slice(r.start, r.end)).join('|');
}

const P1 = { id: 'p0', lines: [['7:1', 'Ferritin levels rise in iron overload and'], ['7:2', 'fall in deficiency states of the marrow.']] };
const P2 = { id: 'p1', lines: [['7:3', 'Transferrin saturation above 45 percent'], ['7:4', 'warrants genetic testing for hemochromatosis.']] };
const P3 = { id: 'p2', lines: [['7:5', 'Phlebotomy remains the mainstay of therapy'], ['7:6', 'in patients with confirmed overload.']] };
const Q = 'genetic testing for hemochromatosis';

/* ══ A1 같은 판 ═══════════════════════════════════════ */

test('A1 ★ 같은 판 → exact · 줄 구간·문단·해시·인용(앞뒤 32자)이 앵커에 든다', async () => {
  const d = desc([P1, P2, P3]);
  const { an } = await made(d, Q);
  assert.equal(an.algo, 13);
  assert.equal(an.pageNo, 7);
  assert.deepEqual(an.lineIds, ['7:4']);
  assert.deepEqual(an.start, { lineId: '7:4', off: 9 });
  assert.equal(an.paraId, 'p1');
  assert.match(an.textHash, /^(s256|fnv):/);
  assert.equal(an.quote.exact, Q);
  assert.equal(an.quote.prefix.length, ANNO.CONTEXT);
  assert.ok(an.quote.suffix.startsWith('.'));
  const r = await find(d, an, 13);
  assert.equal(r.res.how, 'exact');
  assert.equal(r.text, Q);
  assert.deepEqual(r.res.ranges, [{ id: '7:4', start: 9, end: 9 + Q.length }]);
});

/* ══ A2 줄 id 모두 바뀜 ════════════════════════════════ */

test('A2 ★ 줄 id 를 모두 바꾸고 문단 순서를 뒤섞은 판 → para 로 같은 글자 · 같은 인용·같은 문맥의 미끼 문단보다 해시 문단이 이긴다', async () => {
  const d1 = desc([P1, P2, P3]);
  const { an } = await made(d1, Q);
  // 미끼: 앞에 같은 인용 + 같은 앞뒤 문맥(그러나 글 전체는 다르다 — 문단 해시가 다르다)
  const decoy = { id: 'q9', lines: [['7:90', 'Transferrin saturation above 45 percent'], ['7:91', 'warrants genetic testing for hemochromatosis. Repeat yearly.']] };
  const ren = (p, k) => ({ id: 'n' + k, lines: p.lines.map(([id, t], i) => ['7:' + (100 + k * 10 + i), t]) });
  const d2 = desc([decoy, ren(P3, 1), ren(P1, 2), ren(P2, 3)]);
  const r = await find(d2, an, 14);
  assert.equal(r.res.how, 'para', '★ 문단 해시로 찾았다(2단계)');
  assert.equal(r.text, Q);
  assert.deepEqual(r.res.ranges.map((x) => x.id), ['7:131'], '★ 새 줄 id — 미끼(7:91)가 아니다');
  assert.equal(rangeText(d2, r.res.ranges), Q);
  // 판은 같은데 줄 id 가 바뀌었으면(1단계 실패) 역시 2단계
  const r2 = await find(d2, an, 13);
  assert.equal(r2.res.how, 'para');
});

/* ══ A3 문단 해시도 다름 ═══════════════════════════════ */

test('A3 ★ 문단 해시도 다른 판(그 문단 앞 낱말 하나 바뀜) → page 로 같은 글자', async () => {
  const d1 = desc([P1, P2, P3]);
  const { an } = await made(d1, Q);
  const P2b = { id: 'x1', lines: [['7:31', 'Transferrin saturation above 50 percent'], ['7:32', 'warrants genetic testing for hemochromatosis.']] };
  const d2 = desc([P1, P2b, P3]);
  const r = await find(d2, an);
  assert.equal(r.res.how, 'page');
  assert.equal(r.text, Q);
  assert.deepEqual(r.res.ranges.map((x) => x.id), ['7:32']);
});

/* ══ A4 같은 낱말 셋 ═══════════════════════════════════ */

test('A4 ★ 같은 낱말이 쪽에 셋 → prefix·suffix 가 가장 길게 맞는 것(둘째·셋째)', async () => {
  const T = { id: 'p0', lines: [['7:1', 'Dose A: give aspirin daily with food.'], ['7:2', 'Dose B: give aspirin weekly if tolerated.'], ['7:3', 'Dose C: give aspirin monthly at most.']] };
  const d1 = desc([T]);
  for (const nth of [1, 2]) {
    const { an, at } = await made(d1, 'give aspirin', nth);
    // 줄 id 를 바꾼 판(1단계 실패) — 문단 글자는 같다
    const d2 = desc([{ id: 'z', lines: T.lines.map(([id, t], i) => ['7:' + (50 + i), t]) }]);
    const r = await find(d2, an);
    assert.equal(r.res.how, 'para');
    assert.equal(r.res.at, at, '★ ' + (nth + 1) + '번째 자리(첫 자리가 아니다)');
    assert.deepEqual(r.res.ranges.map((x) => x.id), ['7:5' + nth]);
  }
});

test('A4b 같은 글·같은 문맥이 쪽에 두 번(되풀이된 문단) → 점수가 같으면 저장한 첫 줄에 가까운 것', async () => {
  const S = 'Check renal function before contrast.';
  const d1 = desc([{ id: 'a', lines: [['7:10', S]] }, P1, { id: 'b', lines: [['7:40', S]] }]);
  const { an } = await made(d1, 'renal function', 1);
  assert.equal(an.start.lineId, '7:40');
  // 다른 판(1단계 건너뜀) · 줄 번호가 조금 밀렸다
  const d2 = desc([{ id: 'a', lines: [['7:11', S]] }, P1, { id: 'b', lines: [['7:42', S]] }]);
  const r = await find(d2, an);
  assert.deepEqual(r.res.ranges.map((x) => x.id), ['7:42'], '★ 둘째 자리(첫 자리가 아니다)');
  const { an: a0 } = await made(d1, 'renal function', 0);
  assert.deepEqual((await find(d2, a0)).res.ranges.map((x) => x.id), ['7:11']);
});

/* ══ A5 하이픈 줄바꿈 ═════════════════════════════════ */

test('A5 ★ 하이픈 줄바꿈이 바뀜("cardio-\\nvascular" ↔ 한 줄) → 같은 글자 · 두 줄 구간 ↔ 한 줄 구간', async () => {
  const two = { id: 'p0', lines: [['7:1', 'Smoking raises cardio-'], ['7:2', 'vascular risk in every age group.']] };
  const one = { id: 'p0', lines: [['7:8', 'Smoking raises cardiovascular'], ['7:9', 'risk in every age group.']] };
  const d1 = desc([two]);
  assert.equal(d1.blocks[0].lines[0].hyphen, 'hidden');
  const { an } = await made(d1, 'cardiovascular risk');
  assert.deepEqual(an.lineIds, ['7:1', '7:2'], '줄 구간 둘');
  const r = await find(desc([one]), an);
  assert.ok(r.res, '찾는다');
  assert.equal(r.text, 'cardiovascular risk');
  assert.deepEqual(r.res.ranges.map((x) => x.id), ['7:8', '7:9']);
  // 거꾸로 — 한 줄에서 만든 앵커를 두 줄 판에서
  const b = await made(desc([one]), 'cardiovascular risk');
  const r2 = await find(d1, b.an);
  assert.equal(r2.text, 'cardiovascular risk');
  assert.equal(rangeText(d1, r2.res.ranges), 'cardio|vascular risk');
});

test('A5b 지킨 하이픈 ↔ 붙은 낱말·대소문자 → fuzzy(접은 글자) 로 같은 자리', async () => {
  const a = desc([{ id: 'p0', lines: [['7:1', 'Methicillin-Resistant strains spread in hospital wards quickly.']] }]);
  const b = desc([{ id: 'p0', lines: [['7:2', 'methicillin resistant strains spread in hospital wards quickly.']] }]);
  const { an } = await made(a, 'Methicillin-Resistant strains spread');
  const r = await find(b, an);
  assert.equal(r.res.how, 'fuzzy');
  assert.equal(r.text, 'methicillin resistant strains spread');
});

test('A5c 판이 문단을 다르게 나눔(한 문단 → 두 문단) → 경계를 넘는 fuzzy · 줄 구간이 두 문단에 걸친다', async () => {
  const one = desc([{ id: 'p0', lines: [['7:1', 'Hepatic iron overload is graded by MRI.'], ['7:2', 'Biopsy is rarely needed today.']] }]);
  const two = desc([{ id: 'a', lines: [['7:5', 'Hepatic iron overload is graded by MRI.']] }, { id: 'b', lines: [['7:6', 'Biopsy is rarely needed today.']] }]);
  const { an } = await made(one, 'graded by MRI. Biopsy is rarely');
  const r = await find(two, an);
  assert.equal(r.res.how, 'fuzzy');
  assert.deepEqual(r.res.ranges, [{ id: '7:5', start: 25, end: 39 }, { id: '7:6', start: 0, end: 16 }]);
  // 짧은 인용은 경계를 넘어서도 문맥 없이 받지 않는다
  const s = await made(one, 'MRI. Biopsy');
  const bare = desc([{ id: 'a', lines: [['7:8', 'Order an MRI.']] }, { id: 'b', lines: [['7:9', 'Biopsy later.']] }]);
  assert.equal((await find(bare, s.an)).res, null);
});

/* ══ A6 사라짐 ═════════════════════════════════════════ */

test('A6 ★ 인용이 사라짐 → null(고아)', async () => {
  const { an } = await made(desc([P1, P2, P3]), Q);
  const r = await find(desc([P1, P3]), an);
  assert.equal(r.res, null);
  assert.equal(A.resolve(an, { text: '', parts: [] }, {}), null);
  assert.equal(A.resolve({}, A.indexOfDesc(desc([P1])).idx, {}), null);
});

/* ══ A7 작은 것들 ══════════════════════════════════════ */

test('A7 foldText — 공백·대소문자·하이픈·대시를 접고 원래 오프셋을 든다', () => {
  const f = A.foldText('Cardio-  Vascular–risk');
  assert.equal(f.text, 'cardiovascularrisk');
  assert.equal(f.map.length, f.text.length);
  assert.equal(f.map[0], 0);
  assert.equal(f.map[6], 9, '하이픈·공백 둘 뒤 V 의 원래 자리');
});

test('A7 짧은 인용은 문맥이 맞지 않으면 접은 글자로 받지 않는다(낱말 안 오탐 막기)', async () => {
  const d1 = desc([{ id: 'p0', lines: [['7:1', 'The MI was ruled out early.']] }]);
  const { an } = await made(d1, 'MI');
  const d2 = desc([{ id: 'p0', lines: [['7:5', 'Milk and similar foods were allowed.']] }]);
  assert.equal((await find(d2, an)).res, null, 'mi(lk) 에 붙지 않는다');
});

test('A7 anchorOf — 앞뒤 공백을 빼고, QUOTE_MAX 에서 자르고, 문단 사이 \\n 에서 시작하면 다음 문단', async () => {
  const long = 'word '.repeat(150).trim();
  const d = desc([P1, { id: 'p1', lines: [['7:9', long]] }]);
  const { idx } = A.indexOfDesc(d);
  const base = idx.parts[1].base;
  const an = A.anchorOf(idx, base - 1, base + long.length, {});
  assert.ok(an.quote.exact.length <= ANNO.QUOTE_MAX && an.quote.exact.length >= ANNO.QUOTE_MAX - 1);
  assert.ok(!/^\s|\s$/.test(an.quote.exact), '자른 끝의 공백도 뺀다');
  assert.equal(an.quote.prefix, '', '문단 처음');
  assert.equal(an.paraId, null);
  const sp = A.anchorOf(idx, base + 3, base + 6, {});
  assert.equal(sp.quote.exact, 'd w', '가운데 공백은 남는다');
  assert.equal(A.anchorOf(idx, base + 4, base + 5, {}), null, '공백뿐이면 null');
});

test('A7 findQuote — 판·줄 구간 없이 인용만으로(15 근거 찾기)', () => {
  const d = desc([P1, P2, P3]);
  const r = A.findQuote(d, { exact: 'Phlebotomy remains', prefix: '', suffix: ' the mainstay' });
  assert.equal(r.how, 'page');
  assert.deepEqual(r.ranges, [{ id: '7:5', start: 0, end: 18 }]);
  assert.equal(A.findQuote(d, { exact: 'not on this page' }), null);
});

test('A8 ★ 같은 판이어도 저장한 줄 구간의 글자가 인용과 다르면 exact 가 아니다(그 자리에 다른 글)', async () => {
  const d1 = desc([P1, P2, P3]);
  const { an } = await made(d1, Q);
  // 같은 줄 id(7:4) 에 다른 글 — 인용은 7:6 으로 옮겼다
  const d2 = desc([P1,
    { id: 'p1', lines: [['7:3', 'Transferrin saturation above 45 percent'], ['7:4', 'warrants careful review of the family history.']] },
    { id: 'p2', lines: [['7:5', 'Phlebotomy remains the mainstay of therapy'], ['7:6', 'after genetic testing for hemochromatosis.']] }]);
  const r = await find(d2, an, 13);
  assert.notEqual(r.res.how, 'exact');
  assert.equal(r.text, Q);
  assert.deepEqual(r.res.ranges.map((x) => x.id), ['7:6']);
});

/* ══ A9 옮김 ═══════════════════════════════════════════ */

test('A9 ★ screenIndex·rangesOnScreen 은 text/screen.js 로 옮겼다 — ui/search.js 가 같은 함수 객체를 다시 export, 옛 정의 없음', async () => {
  const ui = await import('../js/ui/search.js');
  assert.equal(ui.screenIndex, screen.screenIndex);
  assert.equal(ui.rangesOnScreen, screen.rangesOnScreen);
  const src = read('../js/ui/search.js');
  assert.doesNotMatch(src, /export function screenIndex\(/);
  assert.doesNotMatch(src, /export function rangesOnScreen\(/);
  // text/anchor.js 는 순수 — 브라우저 전역을 모르고 import 는 text/* 와 config 만
  const an = read('../js/text/anchor.js');
  const lines = an.split('\n').filter((l) => /\b(document|window|indexedDB|fetch|localStorage)\b/.test(l) && !/^\s*(\*|\/\/|\/\*)/.test(l));
  assert.deepEqual(lines, []);
  for (const im of an.match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || []) assert.match(im, /from\s*['"](\.\/[a-z]+\.js|\.\.\/config\.js)['"]/);
});
