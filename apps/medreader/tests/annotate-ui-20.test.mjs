/* ============================================================
   tests/annotate-ui-20.test.mjs — 20-2 필기 만들기 · 음성 "표시" · 쪽 필기 시트 (spec 17-16 5 · 9 "20-2")
   + 20-1 Review 낮음 고침(20-1R #1 동점 PDF 좌표 · #3 원본 종이 색 · #4 우선순위 실제 값 · #5 칠하기 깜빡임)

   M1  ★ `[20-1R #1]` 동점 — PDF 좌표(anchor.pos): 3단 블록 순서 뒤바뀜(S2)·행 표 다시 매김(S3)에서 맞는 사본 · 좌표 없는 옛 레코드는
       옛 규칙(첫 줄 번호) · 동점 결과에 tie · 동점 아닌 결과엔 tie 없음
   M2  ★ `[20-1R #1]` 서비스 — 만들 때 layout 이 있으면 pos · 동점으로 정한 결과는 20-D6 고쳐 쓰기를 하지 않는다(patch 0, 매번 맞는 자리)
   M3  ★ `[20-1R #4]` 우선순위가 **실제로** 들어간다 — 가짜 CSS.highlights 의 priority 값(필기 0 < 검색 1 < 낭독 2)
   M4  `[20-1R #5]` paintNow 는 새 결과를 받은 뒤 걷는다(await 앞에 걷기 없음 — 칠할 쪽이 없을 때만) · layout 을 넘긴다
   M5  `[20-1R #3]` 원본 상자 색 = 종이 고정 토큰(--anno-paper-* — :root 한 곳) · 네 색 ΔE ≥ 25 · 점선 대비 ≥ 4.5
   U1  순수 — screenOffsetOf · selectionRange(한 줄·여러 줄·끝이 흐름 밖) · sentenceRange · overlapping · coveringHighlight
   U2  순수 — groupRows(묶음 한 줄·고아 끝) · annoStateOf · annoRowModel(만들기·고치기·색 바꾸기·메모 종류) · inheritWas · keyboardInset
   F1  ★ 흐름 — 선택 → 노랑 → 레코드 1·즉시 칠함(repaint) · 겹친 선택 → edit(같은 자리에 둘 0) · 색 바꾸기(묶음) · 메모 저장 → note · 점선
   F2  ★ 흐름 — 지우기(묶음) → 되살리기(같은 id·만든 때) · 색 없는 메모 빈 글 저장 = 지우기 · 쪽 다름 → 실패 · `<img onerror>` 는 글자 그대로
   F3  ★ 흐름 — 음성 "표시": 지금 문장(문장·줄 모드) 노랑 · 이미 덮였으면 already(레코드 0) · 표 안내·낭독 전 → none
   V1  ★ 음성 흐름 — «علّم» 낭독 중 → 칠함 1 · 확인 줄 · 한 마디 → **이어 읽기** · already · none · 손이 이김 · 주입 없음 → notYet
   V2  ★ 되돌림 이어받기(11-4bR 를 되풀이하지 않음) — 음성 설명 말하는 중 «علّم» · 단추 설명 띠가 멈춰 둔 읽기(주입 was) → 이어 읽기
   V3  ★ 명령 표 — mark 꼴 · 9b 다른 명령과 헷갈림 0(모든 동의어 전수) · 3낱말 규칙 · 부정 · 남는 오탐 기록
   S1  정적 — innerHTML 0 · import 방향 · 마크업(dir · maxlength · <dialog>) · CSS 48px · compact 칩 숨김 · i18n 4언어 · 판본 무변
   지어낸 글자만. 호출 0.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; throw new Error('호출 금지'); };

const db = await import('../js/db.js');
const N = await import('../js/notes/annotations.js');
const { ANNO } = await import('../js/config.js');
const { algoVersion: ALGO } = await import('../js/text/layout.js');
const { resolve, anchorOf, indexOfDesc } = await import('../js/text/anchor.js');
const AN = await import('../js/ui/annotate.js');
const NS = await import('../js/ui/notesheet.js');
const { annoRowModel, SEL_ACTIONS } = await import('../js/ui/selbar.js');
const { createSpeaker } = await import('../js/tts/speaker.js');
const { createVoice } = await import('../js/ui/voice.js');
const { matchCommand, commandById, VOICE_COMMANDS, normalizeBase } = await import('../js/voice/commands.js');
const { buildUnits } = await import('../js/tts/text.js');
const { flowParasOf } = await import('../js/text/screen.js');
const { BUNDLES } = await import('../js/i18n/index.js');
const { DEFAULTS } = await import('../js/settings.js');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
const flush = async (n) => { for (let i = 0; i < (n || 20); i++) await new Promise((r) => setTimeout(r, 0)); };
const LANGS = ['ar', 'en', 'fr', 'ko'];

/* ── 쪽 만들기 — desc(화면 글자) + layout(줄 bbox, PDF 좌표) ── */
function page(paras, pageNo) {
  const lines = [];
  const desc = {
    pageNo: pageNo || 7,
    blocks: paras.map((p) => {
      for (const l of p.lines) lines.push({ id: l[0], bbox: { x0: l[2], y0: l[3], x1: l[2] + 200, y1: l[3] + 10 } });
      return { type: 'para', id: p.id, kind: p.kind || 'body', lines: p.lines.map((l) => ({ id: l[0], text: l[1], hyphen: 'none' })) };
    })
  };
  return { desc: desc, layout: { pageNo: pageNo || 7, lines: lines } };
}
const at = (d, s, nth) => { const { idx } = indexOfDesc(d); let a = -1; for (let i = 0; i <= (nth || 0); i++) a = idx.text.indexOf(s, a + 1); return a; };
async function hashesOf(d) { return (await N.pageIndex(d)).paraHashes; }

/* 되풀이된 문단(같은 글·같은 앞뒤) — 쪽에 두 번 */
const REP = ['Repeat the dose if fever returns.', 'Check levels after the second dose.'];
const OTHER = (n) => ['Unrelated line number ' + n + ' here.', 'More unrelated text ' + n + '.'];

/* ══ M1 동점 — PDF 좌표 ══════════════════════════════════ */

test('M1 ★ [20-1R #1] 동점은 PDF 좌표로 — 3단 블록 뒤바뀜(S2)·행 표 다시 매김(S3) 맞음 · 옛 레코드는 첫 줄 번호 · tie 표시', async () => {
  // S2 옛 판: 둘째 사본(오른쪽 단 아래 x300 y600)이 줄 7:7–7:8. 새 판(3단 순서 고침): 그 사본이 앞으로(7:1–7:2), 첫 사본은 뒤로(7:8–7:9)
  const old2 = page([
    { id: '7:p0', lines: [['7:1', REP[0], 50, 100], ['7:2', REP[1], 50, 112]] },
    { id: '7:p1', lines: [['7:3', OTHER(1)[0], 50, 300], ['7:4', OTHER(1)[1], 50, 312]] },
    { id: '7:p2', lines: [['7:5', OTHER(2)[0], 300, 100], ['7:6', OTHER(2)[1], 300, 112]] },
    { id: '7:p3', lines: [['7:7', REP[0], 300, 600], ['7:8', REP[1], 300, 612]] }
  ]);
  const new2 = page([
    { id: '7:p0', lines: [['7:1', REP[0], 300, 600], ['7:2', REP[1], 300, 612]] },
    { id: '7:p1', lines: [['7:3', OTHER(2)[0], 300, 100], ['7:4', OTHER(2)[1], 300, 112]] },
    { id: '7:p2', lines: [['7:5', OTHER(1)[0], 50, 300], ['7:6', OTHER(1)[1], 50, 312]] },
    { id: '7:p3', lines: [['7:8', REP[0], 50, 100], ['7:9', REP[1], 50, 112]] }
  ]);
  const oi = indexOfDesc(old2.desc);
  const a0 = at(old2.desc, 'if fever returns', 1);
  const boxOld = N.boxOfLayout(old2.layout);
  const an = anchorOf(oi.idx, a0, a0 + 'if fever returns'.length, { pageNo: 7, algo: ALGO - 1, paraIds: oi.paraIds, paraHashes: await hashesOf(old2.desc), boxOf: boxOld });
  assert.deepEqual(an.pos, { x0: 300, y0: 600 }, '★ 첫 줄 bbox 의 x0·y0');
  assert.equal(an.start.lineId, '7:7');
  const ni = indexOfDesc(new2.desc);
  const nh = await hashesOf(new2.desc);
  const boxNew = N.boxOfLayout(new2.layout);
  const r = resolve(an, ni.idx, { algo: ALGO, paraHashes: nh, boxOf: boxNew });
  assert.equal(r.how, 'para');
  assert.equal(r.tie, true, '★ 동점으로 정했다');
  assert.equal(r.ranges[0].id, '7:1', '★ 좌표가 같은 사본(옮겨진 둘째)');
  assert.deepEqual(boxNew(r.ranges[0].id), { x0: 300, y0: 600, x1: 500, y1: 610 });
  // 옛 레코드(좌표 없음) — 옛 규칙(저장한 첫 줄 7 에 가까운 7:8) = S2 에서 틀린 사본(20-1R 2 표 그대로 — 물러섬만 확인)
  const legacy = Object.assign({}, an); delete legacy.pos;
  const rl = resolve(legacy, ni.idx, { algo: ALGO, paraHashes: nh, boxOf: boxNew });
  assert.equal(rl.ranges[0].id, '7:8', '좌표 없는 옛 레코드는 첫 줄 번호 규칙');
  assert.equal(rl.tie, true);
  // 좌표를 모르는 판(boxOf 없음)도 옛 규칙
  assert.equal(resolve(an, ni.idx, { algo: ALGO, paraHashes: nh }).ranges[0].id, '7:8');

  // S3 행 표 다시 매김: 표적 옛 9:2 → 새 9:29, 다른 사본 옛 9:30 → 새 9:3
  const old3 = page([
    { id: '9:p0', lines: [['9:2', REP[0], 60, 200], ['9:3', REP[1], 60, 212]] },
    { id: '9:p1', lines: [['9:30', REP[0], 60, 700], ['9:31', REP[1], 60, 712]] }
  ], 9);
  const new3 = page([
    { id: '9:p0', lines: [['9:3', REP[0], 60, 700], ['9:4', REP[1], 60, 712]] },
    { id: '9:p1', lines: [['9:29', REP[0], 60, 200], ['9:30', REP[1], 60, 212]] }
  ], 9);
  const o3 = indexOfDesc(old3.desc);
  const b0 = at(old3.desc, 'Repeat the dose');
  const an3 = anchorOf(o3.idx, b0, b0 + 'Repeat the dose'.length, { pageNo: 9, algo: ALGO - 1, paraIds: o3.paraIds, paraHashes: await hashesOf(old3.desc), boxOf: N.boxOfLayout(old3.layout) });
  const n3 = indexOfDesc(new3.desc);
  const r3 = resolve(an3, n3.idx, { algo: ALGO, paraHashes: await hashesOf(new3.desc), boxOf: N.boxOfLayout(new3.layout) });
  assert.equal(r3.ranges[0].id, '9:29', '★ S3 — 좌표로 맞는 사본');
  const l3 = Object.assign({}, an3); delete l3.pos;
  assert.equal(resolve(l3, n3.idx, { algo: ALGO, paraHashes: await hashesOf(new3.desc) }).ranges[0].id, '9:3', '옛 규칙은 S3 에서 틀림(기록)');

  // 동점이 아니면 tie 없음(20-1 결과 꼴 그대로)
  const solo = page([{ id: '5:p0', lines: [['5:1', 'Only one copy of this sentence.', 10, 10]] }], 5);
  const si = indexOfDesc(solo.desc);
  const sa = anchorOf(si.idx, 0, 8, { pageNo: 5, algo: ALGO - 1, paraIds: si.paraIds, paraHashes: await hashesOf(solo.desc) });
  assert.equal('pos' in sa, false, 'boxOf 없으면 pos 필드 없음(옛 꼴)');
  const rs = resolve(sa, si.idx, { algo: ALGO, paraHashes: await hashesOf(solo.desc) });
  assert.equal('tie' in rs, false);
});

/* ══ M2 서비스 — 동점 결과는 고쳐 쓰지 않는다 ═════════════════ */

const T0 = new Date(2026, 10, 17, 9, 0, 0).getTime();
const clock = { t: T0 };
let idn = 0;
let patches = 0;
const countingDb = Object.assign({}, db, { patch: (...a) => { patches++; return db.patch(...a); } });
const store = N.createAnnotationStore({ db: countingDb, now: () => clock.t, newId: () => 'ann:u' + (++idn) });
async function reset() { for (const s of db.STORE_NAMES) await db.clearStore(s); idn = 0; patches = 0; clock.t = T0; }

test('M2 ★ [20-1R #1] 서비스 — layout 이 있으면 pos 저장 · 동점으로 정한 결과는 고쳐 쓰지 않는다(매번 좌표로 맞는 자리)', async () => {
  await reset();
  const old = page([
    { id: '7:p0', lines: [['7:1', REP[0], 50, 100], ['7:2', REP[1], 50, 112]] },
    { id: '7:p1', lines: [['7:7', REP[0], 300, 600], ['7:8', REP[1], 300, 612]] }
  ]);
  const neu = page([
    { id: '7:p0', lines: [['7:1', REP[0], 300, 600], ['7:2', REP[1], 300, 612]] },
    { id: '7:p1', lines: [['7:8', REP[0], 50, 100], ['7:9', REP[1], 50, 112]] }
  ]);
  const a = at(old.desc, 'Check levels', 1);
  const [rec] = await store.create({ docId: 'd', pageNo: 7, desc: old.desc, layout: old.layout, from: a, to: a + 'Check levels'.length, color: 'blue', algo: ALGO - 1 });
  assert.deepEqual(rec.anchor.pos, { x0: 300, y0: 612 }, '첫 줄(7:8) 좌표');
  patches = 0;
  for (let i = 0; i < 2; i++) {
    const [p] = await store.placeOnPage('d', 7, neu.desc, { layout: neu.layout });
    assert.equal(p.res.tie, true);
    assert.equal(p.res.ranges[0].id, '7:2', '★ 좌표 (300,612) 줄');
  }
  assert.equal(patches, 0, '★ 동점 결과는 20-D6 고쳐 쓰기 0(틀린 자리가 exact 로 굳지 않게)');
  const [after] = await store.forPage('d', 7);
  assert.equal(after.anchor.algo, ALGO - 1, '판 그대로 — 다음에도 다시 찾는다');
  // 동점 아닌 옛 판 레코드는 20-1 그대로 한 번 고쳐 쓴다(N3 과 같은 길)
  const b = at(old.desc, 'Repeat the dose');
  const one = page([{ id: '7:p0', lines: [['7:4', 'Unique sentence for the patch path.', 10, 10]] }]);
  await store.create({ docId: 'e', pageNo: 7, desc: one.desc, layout: one.layout, from: 0, to: 6, algo: ALGO - 1 });
  const moved = page([{ id: '7:p0', lines: [['7:40', 'Unique sentence for the patch path.', 10, 10]] }]);
  patches = 0;
  await store.placeOnPage('e', 7, moved.desc, { layout: moved.layout });
  assert.equal(patches, 1, '동점 아님 → 한 번 고쳐 씀');
  assert.ok(b >= 0);
});

/* ══ M3 우선순위 실제 값 ════════════════════════════════════ */

test('M3 ★ [20-1R #4] 우선순위가 실제로 들어간다 — CSS.highlights 의 priority: 필기 0 < 검색 1 < 낭독 2', () => {
  class FakeHighlight { constructor(...r) { this.ranges = r; this.priority = 7; } }
  const reg = new Map();
  const saved = { CSS: globalThis.CSS, Highlight: globalThis.Highlight, document: globalThis.document };
  globalThis.CSS = { highlights: reg };
  globalThis.Highlight = FakeHighlight;
  globalThis.document = { createRange: () => ({ setStart() { }, setEnd() { } }), querySelectorAll: () => [] };
  try {
    const line = { firstChild: { nodeType: 3, length: 60 }, classList: { add() { }, remove() { } } };
    const n = AN.paintReflow([{ key: 'yellow', ranges: [{ id: '1:1', start: 0, end: 5 }] }, { key: 'note', ranges: [{ id: '1:2', start: 1, end: 4 }] }], () => line);
    assert.equal(n, 2);
    assert.equal(reg.get('anno-yellow').priority, ANNO.PRIORITY.ANNO, '필기 = 0(새 Highlight 의 7 을 덮음)');
    assert.equal(reg.get('anno-note').priority, ANNO.PRIORITY.ANNO);
    // 검색·낭독이 쓰는 같은 함수(ui/search.js · ui/reader.js — N8 이 호출 자리를 지킨다)
    reg.set('search-hit', new FakeHighlight());
    reg.set('search-cur', new FakeHighlight());
    reg.set('medreader-current', new FakeHighlight());
    assert.equal(AN.prioritize('search-hit', ANNO.PRIORITY.SEARCH), true);
    AN.prioritize('search-cur', ANNO.PRIORITY.SEARCH);
    AN.prioritize('medreader-current', ANNO.PRIORITY.SPEAKER);
    const p = (k) => reg.get(k).priority;
    assert.deepEqual([p('anno-yellow'), p('search-hit'), p('search-cur'), p('medreader-current')], [0, 1, 1, 2], '★ 값이 실제로 들어간다');
    assert.ok(p('anno-yellow') < p('search-hit') && p('search-hit') < p('medreader-current'), '필기 < 검색 < 낭독');
    assert.equal(AN.prioritize('nope', 2), false, '없는 이름');
    AN.clearReflow();
    assert.equal(reg.has('anno-yellow'), false, '걷기');
  } finally {
    globalThis.CSS = saved.CSS; globalThis.Highlight = saved.Highlight; globalThis.document = saved.document;
    if (saved.CSS === undefined) delete globalThis.CSS;
    if (saved.Highlight === undefined) delete globalThis.Highlight;
    if (saved.document === undefined) delete globalThis.document;
  }
});

/* ══ M4 깜빡임 · M5 종이 색 ═════════════════════════════════ */

test('M4 [20-1R #5] paintNow — 걷기는 새 결과를 받은 뒤(await 앞에는 칠할 쪽이 없을 때만) · layout 을 넘긴다 · placedNow 공개', () => {
  const src = strip(read('../js/ui/annotate.js'));
  const body = src.slice(src.indexOf('export async function paintNow('), src.indexOf('export function placedNow('));
  const before = body.slice(0, body.indexOf('await'));
  const lines = before.split('\n').filter((l) => /clearReflow\(\)/.test(l));
  assert.equal(lines.length, 1, 'await 앞 걷기는 한 줄');
  assert.match(lines[0], /if \(!scr \|\| !scr\.ready \|\| !scr\.desc\)/, '칠할 쪽이 없을 때만');
  assert.match(body, /placeOnPage\(scr\.docId, scr\.page, scr\.desc, \{ layout: scr\.layout \}\)/);
  assert.match(body, /if \(now\.view === 'original'\) \{ clearReflow\(\); original\.setAnnotations\(groups\);/);
  assert.match(body, /return paintReflow\(groups, lineElement\);/, 'paintReflow 가 걷고 같은 틱에 칠한다');
  assert.equal(typeof AN.placedNow, 'function');
  assert.equal(AN.placedNow(), null, '칠하기 전엔 null');
});

test('M5 [20-1R #3] 원본 상자 = 종이 고정 색 — :root 한 곳 · 네 색 ΔE ≥ 25 · 덮인 글자 ≥ 4.5 · 점선 ≥ 4.5', () => {
  const tok = read('../css/tokens.css');
  const css = read('../css/reader.css');
  for (const k of ['yellow', 'green', 'blue', 'pink', 'note']) {
    assert.equal((tok.match(new RegExp('--anno-paper-' + k + ':', 'g')) || []).length, 1, k + ' 는 테마마다 다시 정의하지 않는다');
    const rule = k === 'note' ? /\.original \.anno-box\.anno-note \{ border-block-end: 2px dotted var\(--anno-paper-note\);/
      : new RegExp('\\.original \\.anno-box\\.anno-' + k + ' \\{ background: var\\(--anno-paper-' + k + '\\); \\}');
    assert.match(css, rule);
  }
  assert.doesNotMatch(css, /\.original \.anno-box[^{]*\{[^}]*var\(--anno-(yellow|green|blue|pink|note)\)/, '원본 상자에 테마 토큰 0');
  const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16));
  const val = (k) => hex(tok.match(new RegExp('--anno-paper-' + k + ':\\s*(#[0-9a-fA-F]{6})'))[1]);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const Lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = Lum(a), y = Lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const lab = (c) => { const [r, g, b] = c.map(lin); const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]; };
  const mix = (c, bg, a) => c.map((v, i) => a * v + (1 - a) * bg[i]);
  const W = [255, 255, 255];
  const box = {};
  for (const k of ['yellow', 'green', 'blue', 'pink']) box[k] = mix(val(k), W, 0.38);
  const ks = Object.keys(box);
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const a = lab(box[ks[i]]), b = lab(box[ks[j]]);
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) >= 25, ks[i] + '–' + ks[j]);
  }
  for (const k of ks) assert.ok(ratio(mix(val(k), [0, 0, 0], 0.38), box[k]) >= 4.5, k + ' 덮인 검은 글자');
  assert.ok(ratio(mix(val('note'), W, 0.9), W) >= 4.5, '메모 점선');
  assert.match(css, /\.original \.anno-box \{[^}]*opacity: 0\.38;/, '잰 불투명도 그대로');
});

/* ══ U1·U2 순수 ════════════════════════════════════════════ */

const PA = { id: '3:p0', lines: [['3:1', 'Fever is common after surgery. Most cases', 10, 10], ['3:2', 'resolve within two days.', 10, 22]] };
const PB = { id: '3:p1', lines: [['3:3', 'Persistent fever needs a work-up.', 10, 40]] };
const PG = page([PA, PB], 3);

test('U1 순수 — 화면 오프셋 · 선택 구간 · 문장 구간 · 겹침 · 덮음', () => {
  const { idx, paraIds } = indexOfDesc(PG.desc);
  assert.equal(NS.screenOffsetOf(idx, '3:1', 0), 0);
  assert.equal(idx.text.slice(NS.screenOffsetOf(idx, '3:2', 0), NS.screenOffsetOf(idx, '3:2', 7)), 'resolve');
  assert.equal(NS.screenOffsetOf(idx, '3:2', 999), NS.screenOffsetOf(idx, '3:2', 'resolve within two days.'.length), '줄 길이로 가둠');
  assert.equal(NS.screenOffsetOf(idx, 'zz', 0), null);
  // 한 줄
  let r = NS.selectionRange(idx, { lineId: '3:1', start: 0, end: 5 });
  assert.equal(idx.text.slice(r.from, r.to), 'Fever');
  // 여러 줄(끝 줄 · 끝 오프셋) — 문단을 넘어도 화면 구간 하나(나누기는 서비스 splitSelection)
  r = NS.selectionRange(idx, { lineId: '3:1', start: 31, end: 41, endLineId: '3:3', endOff: 10 });
  assert.equal(idx.text.slice(r.from, r.to), 'Most cases resolve within two days.\nPersistent');
  // 끝이 흐름 밖 → 시작 줄 끝까지(end)
  r = NS.selectionRange(idx, { lineId: '3:1', start: 31, end: 41 });
  assert.equal(idx.text.slice(r.from, r.to), 'Most cases');
  assert.equal(NS.selectionRange(idx, { lineId: '3:1', start: 4, end: 4 }), null, '빈 구간');
  assert.equal(NS.selectionRange(idx, null), null);
  // 문장 — 줄을 넘는 문장
  const units = buildUnits(flowParasOf(PG.desc), 'sentence');
  const s2 = NS.sentenceRange(idx, paraIds, units[1]);
  assert.equal(idx.text.slice(s2.from, s2.to), 'Most cases resolve within two days.');
  assert.equal(NS.sentenceRange(idx, paraIds, { paraId: 'tablenotice:r1', src: 'x', lineIds: [] }), null, '표 안내');
  assert.equal(NS.sentenceRange(idx, paraIds, null), null);
  // 같은 문장이 문단에 두 번 — 단위의 첫 줄 뒤 것
  const dup = page([{ id: '4:p0', lines: [['4:1', 'Rest. Rest.', 0, 0], ['4:2', 'Rest.', 0, 12]] }], 4);
  const di = indexOfDesc(dup.desc);
  const r2 = NS.sentenceRange(di.idx, di.paraIds, { paraId: '4:p0', src: 'Rest.', lineIds: ['4:2'] });
  assert.equal(r2.from, di.idx.text.lastIndexOf('Rest.'));
  // 겹침·덮음
  const placed = [
    { rec: { id: 'a', group: 'a', kind: 'highlight', color: 'yellow' }, res: { at: 6, len: 10, ranges: [{ id: '3:1', start: 6, end: 16 }] } },
    { rec: { id: 'b', group: 'b', kind: 'note', note: 'n' }, res: { at: 40, len: 5, ranges: [{ id: '3:2', start: 0, end: 5 }] } },
    { rec: { id: 'c', group: 'c', kind: 'highlight', color: 'pink' }, res: null }
  ];
  assert.deepEqual(NS.overlapping(placed, 0, 7).map((p) => p.rec.id), ['a']);
  assert.deepEqual(NS.overlapping(placed, 16, 40).map((p) => p.rec.id), [], '맞닿기만 — 겹침 아님');
  assert.deepEqual(NS.overlapping(placed, 10, 42).map((p) => p.rec.id), ['a', 'b']);
  assert.equal(NS.coveringHighlight(placed, 7, 15).id, 'a');
  assert.equal(NS.coveringHighlight(placed, 5, 15), null, '반만 덮음');
  assert.equal(NS.coveringHighlight(placed, 41, 44), null, '메모는 하이라이트가 아니다');
});

test('U2 순수 — 쪽 필기 줄 · 겹침 꼴 · 필기 줄 모델 · was 이어받기 · 키보드 높이', () => {
  const q = (s) => ({ quote: { exact: s } });
  const placed = [
    { rec: { id: 'g1', group: 'g1', kind: 'highlight', color: 'green', note: 'مذكرة note', anchor: q('first part'), createdAt: 1 }, res: { at: 50, len: 10, ranges: [{ id: '3:3', start: 0, end: 10 }] } },
    { rec: { id: 'g2', group: 'g1', kind: 'highlight', color: 'green', note: '', anchor: q('second'), createdAt: 1 }, res: { at: 70, len: 6, ranges: [{ id: '3:4', start: 0, end: 6 }] } },
    { rec: { id: 'x', group: 'x', kind: 'note', note: 'only note', anchor: q('early'), createdAt: 5 }, res: { at: 3, len: 5, ranges: [{ id: '3:1', start: 3, end: 8 }] } },
    { rec: { id: 'o', group: 'o', kind: 'highlight', color: 'pink', note: '', anchor: q('gone'), createdAt: 2 }, res: null }
  ];
  const rows = NS.groupRows(placed);
  assert.deepEqual(rows.map((r) => [r.id, r.color, r.orphan, r.n]), [['x', null, false, 1], ['g1', 'green', false, 2], ['o', 'pink', true, 1]], '자리 순 · 묶음 한 줄 · 고아 끝');
  assert.equal(rows[1].quote, 'first part second');
  assert.equal(rows[1].note, 'مذكرة note');
  assert.deepEqual([rows[1].lineId, rows[1].range], ['3:3', { start: 0, end: 10 }]);
  assert.equal(NS.leaderOf([{ id: 'b', group: 'a' }, { id: 'a', group: 'a' }]).id, 'a');
  // 겹침 꼴
  assert.deepEqual(NS.annoStateOf(placed, { from: 0, to: 2 }), { mode: 'create' });
  assert.deepEqual(NS.annoStateOf(placed, { from: 72, to: 74 }), { mode: 'edit', id: 'g1', group: 'g1', kind: 'highlight', color: 'green', hasNote: true }, '묶음의 대표');
  assert.deepEqual(NS.annoStateOf(placed, null), { mode: 'create' });
  // 필기 줄 모델
  const C = ANNO.COLORS;
  assert.deepEqual(annoRowModel({ mode: 'create' }, null, C).map((m) => m.act + (m.color ? ':' + m.color : '')), ['color:yellow', 'color:green', 'color:blue', 'color:pink', 'note']);
  assert.deepEqual(annoRowModel({ mode: 'edit', kind: 'highlight', color: 'blue' }, null, C).map((m) => m.act), ['edit', 'recolor', 'remove']);
  const rc = annoRowModel({ mode: 'edit', kind: 'highlight', color: 'blue' }, 'recolor', C);
  assert.deepEqual(rc.map((m) => [m.color, m.pressed]), [['yellow', false], ['green', false], ['blue', true], ['pink', false]]);
  assert.deepEqual(annoRowModel({ mode: 'edit', kind: 'note' }, null, C).map((m) => m.act), ['edit', 'remove'], '색 없는 메모는 색 바꾸기 없음');
  assert.deepEqual(annoRowModel(null, null, C), []);
  // was 이어받기
  assert.equal(NS.inheritWas('paused', { was: 'speaking' }, true), 'speaking', '★ 설명 띠가 멈춰 둔 읽기');
  assert.equal(NS.inheritWas('paused', { was: 'speaking' }, false), 'paused', '띠가 닫혔으면 잇지 않음');
  assert.equal(NS.inheritWas('speaking', { was: 'paused' }, true), 'speaking');
  assert.equal(NS.inheritWas('idle', null, true), 'idle');
  // 키보드
  assert.equal(NS.keyboardInset(915, { height: 560, offsetTop: 0 }), 355);
  assert.equal(NS.keyboardInset(915, { height: 900, offsetTop: 0 }), 0, '주소창 정도는 키보드 아님');
  assert.equal(NS.keyboardInset(915, null), 0);
});

/* ══ F 흐름 ════════════════════════════════════════════════ */

function flowRig(o) {
  const x = o || {};
  const scr = { docId: 'docA', page: 3, desc: PG.desc, layout: PG.layout, view: 'reflow', ready: true };
  const env = { placed: [], repaints: 0 };
  const flow = NS.createAnnoFlow({
    store: store,
    screen: () => (x.noScreen ? null : scr),
    placed: () => env.placed,
    repaint: async () => { env.repaints++; env.placed = await store.placeOnPage(scr.docId, scr.page, scr.desc, { layout: scr.layout }); },
    meta: () => ({ fileHash: 's256:p:1:aaa', docTitle: 'Book A' }),
    units: () => buildUnits(flowParasOf(scr.desc), 'sentence'),
    current: () => x.cur ? x.cur() : { cur: null, idx: 0, unit: 'sentence' }
  });
  return { flow, env, scr };
}

test('F1 ★ 흐름 — 노랑 → 레코드 1·즉시 칠함 · 겹친 선택 → 고치기(같은 자리에 둘 0) · 색 바꾸기 · 메모 → note 점선', async () => {
  await reset();
  const { flow, env } = flowRig();
  const snap = { lineId: '3:1', start: 0, end: 5, text: 'Fever', page: 3 };
  assert.deepEqual(flow.stateFor(snap), { mode: 'create' });
  const r = await flow.highlight(snap, 'yellow');
  assert.equal(r.ok, true);
  assert.equal(r.recs.length, 1, '★ 레코드 1');
  assert.equal(env.repaints, 1, '★ 즉시 칠함(20-1 의 길)');
  const recs = await store.forPage('docA', 3);
  assert.deepEqual([recs.length, recs[0].color, recs[0].kind, recs[0].anchor.quote.exact, recs[0].fileHash, recs[0].docTitle], [1, 'yellow', 'highlight', 'Fever', 's256:p:1:aaa', 'Book A']);
  assert.ok(recs[0].anchor.pos, '앵커에 PDF 좌표');
  assert.deepEqual(AN.paintGroups(env.placed).map((g) => g.key), ['yellow']);
  // 같은 자리를 다시 고르면 고치기 꼴 — 선택 줄이 [색 바꾸기]·[지우기]를 보인다(같은 자리에 둘을 만들지 않는다)
  const st = flow.stateFor({ lineId: '3:1', start: 2, end: 4, page: 3 });
  assert.deepEqual(st, { mode: 'edit', id: recs[0].id, group: recs[0].id, kind: 'highlight', color: 'yellow', hasNote: false }, '★ 겹침 판정');
  // 문단을 넘는 선택 → 두 레코드(같은 group) → 색 바꾸기는 묶음 전부
  const m = await flow.highlight({ lineId: '3:2', start: 0, end: 7, endLineId: '3:3', endOff: 10, page: 3 }, 'green');
  assert.equal(m.recs.length, 2);
  assert.equal(m.recs[0].group, m.recs[1].group);
  const rc = await flow.recolor(m.recs[1].id, 'pink');
  assert.equal(rc.ok, true);
  const all = await store.forPage('docA', 3);
  assert.deepEqual(all.filter((x) => x.group === m.recs[0].group).map((x) => x.color), ['pink', 'pink'], '묶음 전부');
  // 메모 — 하이라이트에 메모 → 대표에만 · note 이름(점선)
  const sv = await flow.saveNote(m.recs[1].id, 'سطر عربي mixed with English');
  assert.equal(sv.ok, true);
  const g = (await store.forPage('docA', 3)).filter((x) => x.group === m.recs[0].group);
  assert.deepEqual(g.map((x) => x.note), ['سطر عربي mixed with English', ''], '묶음의 대표 하나에만');
  assert.ok(AN.paintGroups(env.placed).some((x) => x.key === 'note'), '★ 점선 밑줄 이름');
  // 새 메모(색 없음)
  const nn = await flow.createNote({ lineId: '3:3', start: 11, end: 16, page: 3 }, 'check');
  assert.equal(nn.ok, true);
  assert.equal(nn.recs[0].kind, 'note');
  assert.equal('color' in nn.recs[0], false);
  assert.equal(fetchCalls, 0, '호출 0');
});

test('F2 ★ 흐름 — 지우기(묶음) → 되살리기(같은 id·만든 때) · 빈 메모 = 지우기 · 쪽 다름·화면 없음 → 실패 · <img onerror> 는 글자', async () => {
  await reset();
  const { flow, env } = flowRig();
  const m = await flow.highlight({ lineId: '3:2', start: 0, end: 7, endLineId: '3:3', endOff: 10, page: 3 }, 'blue');
  const before = await store.forPage('docA', 3);
  const gone = await flow.remove(m.recs[0].id);
  assert.equal(gone.length, 2, '★ 묶음 함께');
  assert.equal((await store.forPage('docA', 3)).length, 0);
  assert.deepEqual(AN.paintGroups(env.placed), [], '다시 칠함 — 빈 쪽');
  const n = await flow.undo(gone);
  assert.equal(n, 2);
  const back = await store.forPage('docA', 3);
  assert.deepEqual(back.map((r) => [r.id, r.createdAt, r.updatedAt, r.color]), before.map((r) => [r.id, r.createdAt, r.updatedAt, r.color]), '★ 지운 그대로');
  assert.equal(await store.restore([{ id: 'sum:1', kind: 'summary' }]), 0, '필기가 아니면 넣지 않는다');
  // 색 없는 메모 — 빈 글로 저장하면 지운다(되살리기 재료)
  const nn = await flow.createNote({ lineId: '3:1', start: 0, end: 5, page: 3 }, '<img src=x onerror="window.__xss=1">');
  assert.equal(nn.recs[0].note, '<img src=x onerror="window.__xss=1">', '글자 그대로(그리기는 textContent)');
  const e = await flow.saveNote(nn.recs[0].id, '   ');
  assert.deepEqual([e.ok, e.key, e.gone.length], [true, 'anno.removed', 1]);
  // 실패 갈래
  assert.deepEqual(await flow.createNote({ lineId: '3:1', start: 0, end: 5, page: 3 }, ''), { ok: false, key: 'anno.note.empty' });
  assert.equal((await flow.highlight({ lineId: '3:1', start: 0, end: 5, page: 4 }, 'yellow')).ok, false, '다른 쪽 스냅숏');
  assert.equal((await flowRig({ noScreen: true }).flow.highlight({ lineId: '3:1', start: 0, end: 5, page: 3 }, 'yellow')).ok, false, '화면 없음');
  assert.equal(flowRig({ noScreen: true }).flow.stateFor({ lineId: '3:1', start: 0, end: 5, page: 3 }), null, '화면 없음 → 줄 없음');
});

test('F3 ★ 흐름 — 음성 "표시": 지금 문장(문장·줄 모드) 노랑 · 이미 덮임 → already(레코드 0) · 표 안내·낭독 전 → none', async () => {
  await reset();
  const units = buildUnits(flowParasOf(PG.desc), 'sentence');
  let cur = { cur: units[1], idx: 1, unit: 'sentence' };
  const { flow, env } = flowRig({ cur: () => cur });
  const r = await flow.markCurrent();
  assert.deepEqual([r.ok, r.key], [true, 'voice.mark.done']);
  const recs = await store.forPage('docA', 3);
  // 줄 둘에 걸친 문장이지만 한 문단 — 레코드 하나
  assert.deepEqual(recs.map((x) => [x.kind, x.color, x.anchor.quote.exact, x.anchor.lineIds.length]), [['highlight', 'yellow', 'Most cases resolve within two days.', 2]]);
  assert.equal(env.repaints, 1);
  // 이미 표시 — 그대로(레코드 0)
  const again = await flow.markCurrent();
  assert.deepEqual([again.ok, again.already, again.key], [true, true, 'voice.mark.already']);
  assert.equal((await store.forPage('docA', 3)).length, recs.length);
  // 줄 모드 — 지금 줄(3:3)을 담은 문장
  const lineUnits = buildUnits(flowParasOf(PG.desc), 'line');
  cur = { cur: lineUnits.find((u) => u.lineIds[0] === '3:3'), idx: 2, unit: 'line' };
  const l = await flow.markCurrent();
  assert.equal(l.ok, true);
  assert.ok((await store.forPage('docA', 3)).some((x) => x.anchor.quote.exact === 'Persistent fever needs a work-up.'), '줄 모드 — 그 줄의 문장');
  // 낭독 전 · 표 안내
  cur = { cur: null, idx: 0, unit: 'sentence' };
  assert.deepEqual(await flow.markCurrent(), { ok: false, key: 'voice.mark.none' });
  // 표 안내 단위(쪽 문단이 아니다) → none
  const tn = NS.createAnnoFlow({ store: store, screen: () => ({ docId: 'docA', page: 3, desc: PG.desc, layout: PG.layout, ready: true }), placed: () => [],
    units: () => [{ paraId: 'tablenotice:r1', src: 'Table 1 is shown here.', lineIds: ['tablenotice:r1.0'], kind: 'table-notice' }],
    current: () => ({ cur: { lineIds: ['tablenotice:r1.0'] }, idx: 0, unit: 'sentence' }) });
  assert.deepEqual(await tn.markCurrent(), { ok: false, key: 'voice.mark.none' }, '표 안내 → none');
  assert.equal(fetchCalls, 0);
});

/* ══ V 음성 흐름 ═══════════════════════════════════════════ */

function fakeTimers() {
  let now = 0; let seq = 1; const jobs = new Map();
  return {
    setTimeout: (fn, ms) => { const k = seq++; jobs.set(k, { fn: fn, at: now + (Number(ms) || 0) }); return k; },
    clearTimeout: (k) => { jobs.delete(k); },
    advance(ms) { const target = now + ms; for (;;) { let pick = null; let key = null; for (const [k, j] of jobs) if (j.at <= target && (pick === null || j.at < pick.at)) { pick = j; key = k; } if (!pick) break; jobs.delete(key); now = pick.at; pick.fn(); } now = target; },
    now: () => now
  };
}
function fakeSynth() {
  const s = { speaking: false, pending: false, utt: [], current: null,
    speak(u) { s.speaking = true; s.current = u; s.utt.push(u); }, pause() { }, resume() { },
    cancel() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    finish() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onend) u.onend(); },
    texts() { return s.utt.map((u) => u.text); } };
  return s;
}
function fakeRecClass() {
  const inst = [];
  class FakeRec {
    constructor() { this.lang = ''; this.onstart = this.onaudiostart = this.onresult = this.onnomatch = this.onerror = this.onend = null; inst.push(this); }
    start() { } stop() { } abort() { }
    fire(alts) { const r = alts.map((t) => ({ transcript: t, confidence: 1 })); r.isFinal = true; if (this.onresult) this.onresult({ resultIndex: 0, results: [r] }); if (this.onend) this.onend({}); }
  }
  return { Rec: FakeRec, inst: inst };
}
function voiceRig(o) {
  const x = o || {};
  const synth = fakeSynth();
  const timers = fakeTimers();
  const paras = [{ id: 'p1', kind: 'body', lines: ['Alpha is the first one.', 'Bravo comes after it.', 'Charlie ends this page.'].map((t, i) => ({ id: '1:' + i, text: t, hyphen: 'none' })) }];
  const sp = createSpeaker({ synth: synth, timers: timers, makeUtterance: (t) => ({ text: t }),
    view: { paras: () => paras, page: () => ({ page: 1, pageCount: 1 }), goToPage: () => Promise.resolve(false), show: () => true, markDone: () => { } },
    requestWakeLock: () => Promise.resolve({ release() { } }) });
  const fk = fakeRecClass();
  const env = { settings: Object.assign({ 'voice.noticeAt': 1, 'voice.cmdLang': 'ar' }, x.settings || {}), statuses: [], calls: 0, sayerBusy: false, doneResolve: null };
  const get = (k) => (Object.prototype.hasOwnProperty.call(env.settings, k) ? env.settings[k] : DEFAULTS[k]);
  let voice = null;
  const pressPlay = () => { if (voice) voice.cancel(); if (sp.getState() === 'speaking') sp.pause(); else sp.play(); };
  const t = (k, p) => { let s = BUNDLES.en[k]; if (typeof s !== 'string') return k; for (const [n, v] of Object.entries(p || {})) s = s.split('{' + n + '}').join(String(v)); return s; };
  const sayer = { busy: () => env.sayerBusy, stop: () => { if (env.sayerBusy) { env.sayerBusy = false; if (env.doneResolve) env.doneResolve('stopped'); } } };
  voice = createVoice({
    Recognition: fk.Rec, speaker: sp, pressPlay: pressPlay, getSetting: get, setSetting: () => Promise.resolve(), uiLang: () => 'ar', t: t,
    synth: synth, makeUtterance: (text) => ({ text: text }), sayVoice: () => ({ tag: 'ar-SA', voice: null }), timers: timers, now: timers.now, sayer: sayer,
    onExplain: (a) => { env.sayerBusy = true; return Promise.resolve({ ok: true, done: new Promise((r) => { env.doneResolve = r; }) }); },
    onMark: x.noDep ? undefined : (a) => { env.calls++; env.arg = a; return x.result ? x.result(a) : Promise.resolve({ ok: true, key: 'voice.mark.done' }); },
    view: { paint: () => { }, status: (m) => env.statuses.push(m), notice: () => { } }
  });
  return { sp, synth, timers, voice, fk, env, rec: () => fk.inst[fk.inst.length - 1] };
}

test('V1 ★ 음성 «علّم» — 낭독 중 칠함 1 · 확인 줄 · 한 마디 → 이어 읽기 · already · none · 손이 이김 · 주입 없음', async () => {
  let h = voiceRig();
  h.sp.play(); h.synth.finish();
  assert.deepEqual([h.sp.getState(), h.sp.getIndex()], ['speaking', 1]);
  h.voice.press();
  assert.equal(h.sp.getState(), 'paused');
  const n0 = h.synth.utt.length;
  h.rec().fire(['علّم']);
  await flush();
  assert.equal(h.env.calls, 1, '주입 1회');
  assert.equal(h.env.arg.via, 'voice');
  const conf = h.env.statuses.filter((m) => m && m.kind === 'confirm');
  assert.equal(conf.length, 1);
  assert.match(conf[0].text, new RegExp(BUNDLES.en['voice.cmd.mark']));
  assert.deepEqual(h.synth.texts().slice(n0), [BUNDLES.en['voice.mark.done']], '한 마디');
  h.synth.finish();
  assert.deepEqual([h.sp.getState(), h.sp.getIndex()], ['speaking', 1], '★ 이어 읽기 — 같은 문장부터');
  assert.equal(h.voice.debug().stats.restores, 1);
  // 이미 표시 → already 한 마디 → 이어 읽기
  h = voiceRig({ result: () => Promise.resolve({ ok: true, already: true, key: 'voice.mark.already' }) });
  h.sp.play(); h.voice.press(); h.rec().fire(['ظلل']);
  await flush();
  assert.ok(h.synth.texts().includes(BUNDLES.en['voice.mark.already']));
  h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking');
  // none → 상태 줄 + 한 마디 → 되돌림 (ar 명령 언어에서 라틴 «mark this» 는 아랍어 후보가 없어 영어 표로 — 9b-D5)
  h = voiceRig({ result: () => Promise.resolve({ ok: false, key: 'voice.mark.none' }) });
  h.sp.play(); h.voice.press(); h.rec().fire(['mark this']);
  await flush();
  assert.equal(h.env.calls, 1);
  assert.ok(h.env.statuses.some((m) => m && m.text === BUNDLES.en['voice.mark.none']));
  assert.ok(h.synth.texts().includes(BUNDLES.en['voice.mark.none']));
  h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking', 'none 뒤에도 되돌림');
  // 칠하기를 기다리는 사이 손 → 되돌림 없음
  let res = null;
  h = voiceRig({ result: () => new Promise((r) => { res = r; }) });
  h.sp.play(); h.voice.press(); h.rec().fire(['علّم']);
  await flush();
  assert.equal(h.voice.isListening(), true, '기다림도 바쁨');
  h.voice.cancel();
  res({ ok: true });
  await flush();
  assert.equal(h.sp.getState(), 'paused', '★ 손이 이긴다');
  assert.equal(h.voice.debug().stats.restores, 0);
  // 주입 없음 → notYet
  h = voiceRig({ noDep: true });
  h.sp.play(); h.voice.press(); h.rec().fire(['علّم']);
  await flush();
  assert.ok(h.synth.texts().includes(BUNDLES.en['voice.notYet']));
  // 멈춤 중 «علّم» → 칠하고 멈춤 그대로(읽기를 시작하지 않는다)
  h = voiceRig();
  h.sp.play(); h.sp.pause();
  h.voice.press(); h.rec().fire(['علّم']);
  await flush(); h.synth.finish();
  assert.equal(h.sp.getState(), 'paused', '멈춤이었으면 멈춤');
  assert.equal(fetchCalls, 0);
});

test('V2 ★ 되돌림 이어받기 — 음성 설명을 말하는 중 «علّم» · 단추 설명 띠가 멈춰 둔 읽기(주입 was) → 끝나면 이어 읽기', async () => {
  // ① 음성 «اشرح»(A) 말하는 중 마이크 다시 → «علّم»(B): B 의 was 는 A 가 만든 paused 지만 A 의 was(speaking)를 이어받는다
  let h = voiceRig();
  h.sp.play(); h.synth.finish();
  h.voice.press();
  h.rec().fire(['اشرح']);
  await flush();
  assert.equal(h.env.sayerBusy, true, 'A 가 말하는 중');
  assert.equal(h.sp.getState(), 'paused');
  h.voice.press();                                   // A 를 끊고 다시 듣기
  h.rec().fire(['علّم']);
  await flush();
  assert.equal(h.env.calls, 1);
  h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking', '★ A 때 읽던 대로 이어 읽기(11-4bR 를 되풀이하지 않음)');
  // ② 단추 설명이 멈춰 둔 읽기 — 마이크를 누른 순간 paused · 주입이 was:'speaking' 을 돌려준다(controls `inheritWas`)
  h = voiceRig({ result: (a) => Promise.resolve({ ok: true, key: 'voice.mark.done', was: NS.inheritWas(a.was, { was: 'speaking' }, true) }) });
  h.sp.play(); h.sp.pause();                         // 단추 설명이 멈춤(흉내)
  h.voice.press();
  assert.equal(h.env.arg, undefined);
  h.rec().fire(['علم']);
  await flush();
  assert.equal(h.env.arg.was, 'paused');
  h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking', '★ 띠가 멈춰 둔 읽기를 이어 읽는다');
  // ③ 띠가 닫혔으면(주입이 paused 그대로) 이어 읽지 않는다
  h = voiceRig({ result: (a) => Promise.resolve({ ok: true, was: NS.inheritWas(a.was, { was: 'speaking' }, false) }) });
  h.sp.play(); h.sp.pause(); h.voice.press(); h.rec().fire(['علم']);
  await flush(); h.synth.finish();
  assert.equal(h.sp.getState(), 'paused');
});

test('V2 ★ [20-2R #1] 묵은 설명 was — 읽는 중 단추 [설명] → 재개 → 손으로 멈춤 → 음성 «اشرح»(다른 띠) → «علّم» → 끝나면 paused', async () => {
  // controls 와 같은 꼴: 단추 [설명]의 was 를 **그 띠 번호와 함께**(`createExplainHold`) · 띠는 가짜(열린 번호 하나)
  const band = { open: 0, seq: 0, openNote() { this.open = ++this.seq; return this.open; }, close() { this.open = 0; }, isNoteOpen(id) { return id != null && this.open === id; } };
  const hold = NS.createExplainHold((id) => band.isNoteOpen(id));
  const h = voiceRig({ result: (a) => Promise.resolve({ ok: true, key: 'voice.mark.done', was: hold.was(a.was) }) });
  h.sp.play(); h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking');
  // ① 읽는 중 단추 [설명] — 누르기 전 was = speaking, ask 가 띠(1)를 열고 읽기를 멈춘다
  const pre = hold.before(h.sp.getState());
  const id1 = band.openNote();
  hold.after(id1, pre);
  h.sp.pause();
  assert.deepEqual(hold.held(), { id: 1, was: 'speaking' });
  // ② 말한 뒤 재개 — 띠 닫힘 · 읽기 다시
  band.close();
  h.sp.play();
  // ③ 손으로 멈춤 → ④ 음성 «اشرح»(멈춤 중) — 음성 설명이 다른 띠(2)를 연다(열린 채 남음)
  h.sp.pause();
  h.voice.press();
  h.rec().fire(['اشرح']);
  await flush();
  band.openNote();
  assert.equal(band.open, 2);
  h.env.sayerBusy = false;
  if (h.env.doneResolve) h.env.doneResolve('end');
  await flush(); h.synth.finish(); await flush();
  assert.equal(h.sp.getState(), 'paused', '음성 설명은 멈춤 중 들어왔다 — 멈춤 그대로');
  // ⑤ «علّم» — 옛 단추 설명 띠(1)는 닫혔다 → 이어받지 않는다
  h.voice.press();
  h.rec().fire(['علّم']);
  await flush();
  assert.equal(h.env.calls, 1);
  h.synth.finish();
  await flush();
  assert.equal(h.sp.getState(), 'paused', '★ 들어오기 전 paused — 옛 설명의 was(speaking)로 읽기를 다시 시작하지 않는다');
  // 옛 꼴(아무 띠든 열려 있나 — 불리언)이었으면 다시 읽었다(회귀 고정)
  assert.equal(NS.inheritWas('paused', { id: 1, was: 'speaking' }, band.open > 0), 'speaking', '옛 꼴은 다른 띠를 옛 띠로 여겼다');
  assert.equal(NS.inheritWas('paused', { id: 1, was: 'speaking' }, (id) => band.isNoteOpen(id)), 'paused');
  // 그 띠가 아직 열려 있으면 잇는다(설계 ③ 그대로) · 번호 없는 held 는 잇지 않는다
  assert.equal(NS.inheritWas('paused', { id: 2, was: 'speaking' }, (id) => band.isNoteOpen(id)), 'speaking');
  assert.equal(NS.inheritWas('paused', { was: 'speaking' }, (id) => band.isNoteOpen(id)), 'paused');
  hold.clear();
  assert.equal(hold.held(), null);
  // controls 배선 — 띠 번호로 본다(불리언 isNoteOpen() 0)
  const c = strip(read('../js/ui/controls.js'));
  assert.match(c, /explainHold = createExplainHold\(function \(id\) \{ return !!trband && trband\.isNoteOpen\(id\); \}\);/);
  assert.match(c, /was: explainHold \? explainHold\.was\(o && o\.was\) : \(o && o\.was\)/);
  assert.doesNotMatch(c, /trband\.isNoteOpen\(\)/, '★ 아무 띠나 열려 있나로 보지 않는다');
});

/* ══ V3 명령 표 ════════════════════════════════════════════ */

test('V3 ★ 명령 표 — mark 꼴 · 다른 명령과 헷갈림 0(전수) · 3낱말 규칙 · 부정 · 남는 오탐 기록', () => {
  const c = commandById('mark');
  assert.ok(c && c.enabled);
  assert.deepEqual(c.ar, ['علّم', 'علم', 'ظلل', 'ظلّل', 'تظليل', 'علّم الجملة'], '설계 표 그대로 [검토 — Nour·운영자]');
  assert.deepEqual(c.en, ['highlight', 'mark', 'mark this']);
  // `[20-3 — 20-2R #7 권장안]` «علم»·"mark" 는 혼자 말할 때만(`exact`) `[검토 — Nour·운영자]`
  assert.deepEqual(c.exact, ['علم', 'mark']);
  assert.equal(VOICE_COMMANDS[VOICE_COMMANDS.length - 1].id, 'mark', '표 끝(다른 명령 순서 그대로)');
  // 전수: mark 동의어 → mark, 다른 명령의 모든 동의어 → mark 아님(그 명령 그대로)
  for (const s of c.ar) assert.equal(matchCommand([s], 'ar').id, 'mark', s);
  for (const s of c.en) assert.equal(matchCommand([s], 'en').id, 'mark', s);
  const markForms = new Set(c.ar.concat(c.en).map(normalizeBase));
  for (const o of VOICE_COMMANDS) {
    if (o.id === 'mark') continue;
    for (const s of o.ar.concat(o.arLoan)) { assert.ok(!markForms.has(normalizeBase(s)), s); assert.equal(matchCommand([s], 'ar').id, o.id, 'ar «' + s + '»'); }
    for (const s of o.en) assert.equal(matchCommand([s], 'en').id, o.id, 'en «' + s + '»');
  }
  for (const [s, l, want] of [
    ['من فضلك علّم', 'ar', 'mark'], ['علّم الجملة', 'ar', 'mark'], ['ظلّل هذه', 'ar', 'mark'], ['please highlight', 'en', 'mark'], ['mark this one', 'en', 'mark'],
    ['اقرأ', 'ar', 'play'], ['اشرح', 'ar', 'explain'], ['احفظ', 'ar', 'remember'], ['وقف', 'ar', 'pause'],
    ['لا تعلم', 'ar', null], ["don't highlight", 'en', null], ['لا علّم', 'ar', null],
    // 9b 결정 ①: 4낱말 이상 문장 속 한 낱말 동의어는 명령이 아니다
    ['highlight the key findings in this chapter', 'en', null], ['علم الأمراض عند الأطفال مهم', 'ar', null]
  ]) assert.equal(matchCommand([s], l).id, want, l + ' «' + s + '»');
  // `[20-3 — 20-2R #7]` 오탐 닫힘 — 2–3낱말 의학 용어(«علم الأمراض» 병리학 등)·"question mark"·"mark twain" → null
  for (const [s, l] of [['علم الأمراض', 'ar'], ['علم الأدوية', 'ar'], ['علم التشريح', 'ar'], ['علم وظائف الأعضاء', 'ar'],
    ['question mark', 'en'], ['mark twain', 'en']]) assert.equal(matchCommand([s], l).id, null, l + ' «' + s + '»');
  // 그대로 mark — 혼자 «علّم»·«علم» · «علّم الجملة» · 군말 «علّم من فضلك» · «ظلل»·«ظلّل الجملة»·«تظليل» · "mark" 혼자 · "mark this"
  for (const [s, l] of [['علّم', 'ar'], ['علم', 'ar'], ['علّم الجملة', 'ar'], ['علّم من فضلك', 'ar'], ['ظلل', 'ar'], ['ظلّل الجملة', 'ar'],
    ['تظليل', 'ar'], ['mark', 'en'], ['mark this', 'en'], ['Mark.', 'en']]) assert.equal(matchCommand([s], l).id, 'mark', l + ' «' + s + '»');
});

/* ══ S1 정적 ═══════════════════════════════════════════════ */

test('S1 정적 — innerHTML 0 · import 방향 · 마크업 · CSS 48px · compact · i18n · 손이 이김 · 판본 무변', () => {
  for (const f of ['../js/ui/notesheet.js', '../js/ui/selbar.js', '../js/ui/annotate.js', '../js/text/anchor.js', '../js/notes/annotations.js']) {
    assert.doesNotMatch(strip(read(f)), /innerHTML|outerHTML|insertAdjacentHTML|\bconfirm\(|document\.write/, f);
  }
  const ns = strip(read('../js/ui/notesheet.js'));
  const imp = [...ns.matchAll(/^import [^;]* from '([^']+)';/gm)].map((m) => m[1]).sort();
  // `[20-3]` + `../router.js`(쪽 필기 시트 "이 책 필기 모두" → `notesHash`)
  assert.deepEqual(imp, ['../config.js', '../i18n/index.js', '../notes/annotations.js', '../router.js', '../text/anchor.js', './annotate.js', './reader.js', './remember.js']);
  assert.ok(!/pipeline|\bfetch\b|speaker\.(pause|play|stop|cancel)|\.pause\(\)/.test(ns), '★ 호출 0 · 낭독을 건드리지 않는다');
  assert.doesNotMatch(ns, /charhl|paintCharRanges|CSS\.highlights/, '자체 칠하기 0 — 20-1 의 길(repaint)만');
  // controls — 필기 갈래는 낭독을 멈추지 않는다
  const c = strip(read('../js/ui/controls.js'));
  const fa = c.slice(c.indexOf('function onAnnoAction('), c.indexOf('function noteUnitFor('));
  assert.ok(fa.length > 100);
  assert.ok(!/speaker\.|pressPlay|readalong/.test(fa), '★ 만들기·지우기는 낭독을 멈추지 않는다');
  assert.match(c, /onMark: function \(o\) \{/);
  assert.match(c, /annoState: function \(s\) \{ return annoFlow \? annoFlow\.stateFor\(s\) : null; \},/);
  // voice.js — remember 와 같은 꼴(확인 줄 → 한 마디 → restore)
  const v = strip(read('../js/ui/voice.js'));
  assert.match(v, /case 'mark':\s*mark\(was, heard\);/);
  assert.match(v, /confirm\('mark', heard\);\s*say\(r\.already \? 'voice\.mark\.already' : 'voice\.mark\.done', back\);/);
  assert.ok(!/notesheet|annotations|annotate/.test(v), 'voice.js 는 주입만');
  // 선택 줄 — 칸 목록 무변(필기 줄은 따로)
  assert.deepEqual(SEL_ACTIONS.map((a) => a.id), ['word', 'sentence', 'explain', 'summary', 'readFrom', 'remember', 'lookup']);
  const sb = strip(read('../js/ui/selbar.js'));
  assert.match(sb, /els\.menu\.insertBefore\(els\.anno, els\.menu\.firstChild\);/, '메뉴 맨 위');
  // 마크업
  const html = read('../index.html');
  const sheet = html.slice(html.indexOf('id="noteSheet"'), html.indexOf('id="pageNotes"'));
  assert.match(sheet, /<p class="ns-quote" id="nsQuote" dir="ltr"><\/p>/);
  assert.match(sheet, /<textarea class="ns-text" id="nsText" dir="auto" rows="4" maxlength="2000"/);
  assert.equal(ANNO.NOTE_MAX, 2000);
  assert.ok(sheet.indexOf('data-ns-action="save"') < sheet.indexOf('data-ns-action="delete"') && sheet.indexOf('data-ns-action="delete"') < sheet.indexOf('data-ns-action="close"'), '[저장]·[지우기]·[닫기]');
  assert.match(html, /<dialog class="confirm-dialog" id="annoDelDialog"/);
  assert.match(html, /<button type="button" class="anno-chip" id="annoChip" data-i18n="anno\.chip" data-i18n-n="0" hidden><\/button>/);
  assert.ok(html.indexOf('id="quizChipSlot"') < html.indexOf('id="annoChip"') && html.indexOf('id="annoChip"') < html.indexOf('id="searchBand"'), '퀴즈 칩 자리 옆');
  assert.match(html, /"\.\/js\/ui\/notesheet\.js": "\.\/js\/ui\/notesheet\.js\?v=[0-9a-f]{10}"/, 'import map 도장');
  // CSS — 48px · 논리 속성 · compact 칩 숨김 · 시트 열리면 선택 줄 숨김 · 키보드
  const css = read('../css/reader.css');
  const block = css.slice(css.indexOf('/* ── `[20-2 — spec 17-16 5]` 메모 시트'), css.indexOf('/* ── 하단 컨트롤 바'));
  assert.ok(block.length > 500);
  assert.ok(!/(?<![-\w])(left|right|margin-left|margin-right|padding-left|padding-right|width|height)\s*:/.test(block), '논리 속성만');
  assert.match(block, /\.note-sheet \.ns-btn \{[^}]*min-block-size: var\(--tap\);/);
  assert.match(block, /\.page-notes \.pn-row \{[^}]*min-block-size: var\(--tap\);/);
  assert.match(block, /\.anno-toast \.anno-toast-undo \{[^}]*min-block-size: var\(--tap\);/);
  assert.match(block, /\.note-sheet\[data-kb="on"\] \{\s*inset-block-end: calc\(var\(--ns-kb, 0px\) \+ var\(--sp-2\)\);/);
  assert.match(block, /\.note-sheet \.ns-actions \{\s*position: sticky;\s*inset-block-end: 0;/, '★ [저장] 줄은 아래 sticky');
  assert.match(block, /:root\[data-note-sheet="on"\] \.sel-bar,/);
  assert.match(css, /\.sel-bar \.sel-anno \.sel-btn\.sel-swatch \{[^}]*inline-size: var\(--tap\);/);
  assert.match(css, /\.anno-chip \{[^}]*min-block-size: var\(--tap\);/);
  const compact = css.slice(css.lastIndexOf('@media (max-height: 520px) {'));
  assert.match(compact, /\.anno-chip,\s*\.anno-chip:not\(\[hidden\]\) \{ display: none; \}/, '★ 8e compact 에서 칩 숨김');
  // i18n — 4언어 같은 키 · ar·fr 는 [검토]
  const keys = Object.keys(BUNDLES.en).filter((k) => k.startsWith('anno.') || k.startsWith('voice.mark.')).concat(['voice.cmd.mark']);
  assert.ok(keys.length >= 30, String(keys.length));
  for (const l of LANGS) for (const k of keys) assert.ok(typeof BUNDLES[l][k] === 'string' && BUNDLES[l][k].length > 0, l + ' ' + k);
  for (const l of LANGS) assert.match(BUNDLES[l]['anno.chip'], /\{n\}/);
  // 판본 무변
  assert.equal(db.DB_VERSION, 3);
  assert.equal(ANNO.QUOTE_MAX, 400);
});
