/* ============================================================
   tests/annotations-20.test.mjs — 20-1 필기 저장·칠하기 (spec 17-16 2·4 · 9 "20-1" [N] — fake-idb)

   - N1 만들기 → 레코드 꼴(맨 위 docId·pageNo · anchor · 색 · group) · `docId_pageNo` 인덱스로 읽기(`forPage`) · 원문 쪽 글 저장 0
   - N2 문단을 넘는 선택 → 문단마다 레코드(같은 group) · `remove` 가 묶음을 함께 지움 · 11 요약 레코드는 건드리지 않음
   - N3 ★ 판(algo)이 다르고 how ≠ exact 인 레코드는 **처음 그릴 때 한 번만** 고쳐 씀(updatedAt 그대로) · 두 번째는 exact
   - N4 같은 판에서 how ≠ exact → 고쳐 쓰지 않음 · 고아(null)는 지우지 않음
   - N5 ★ `reattach` — 같은 fileHash 고아만 옮김(다른 fileHash·살아 있는 문서 것은 그대로, 요약 레코드도 같은 규칙)
   - N6 `update`·`count`·`list`·`splitSelection`
   - N7 칠하기 묶음(`paintGroups`) · 원본 필기 상자(`annoBoxes` — 줄 bbox 안 · 회전 줄 제외 · 200 넘으면 줄 통째로 합침)
   - N8 ★ 우선순위 필기 0 < 검색 1 < 낭독 2 — 세 곳이 같은 함수·같은 상수로 둔다 · 새 파일 innerHTML 0
   지어낸 글자만. 호출 0.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

const db = await import('../js/db.js');
const N = await import('../js/notes/annotations.js');
const { ANNO } = await import('../js/config.js');
const { algoVersion: ALGO } = await import('../js/text/layout.js');
const { joinHyphen } = await import('../js/text/hyphen.js');
const { indexOfDesc } = await import('../js/text/anchor.js');
const { annoBoxes } = await import('../js/ui/original.js');
const { paintGroups, NAMES } = await import('../js/ui/annotate.js');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const T0 = new Date(2026, 10, 17, 9, 0, 0).getTime();
const clock = { t: T0 };
let idn = 0;
let patches = 0;
const countingDb = Object.assign({}, db, { patch: (...a) => { patches++; return db.patch(...a); } });
const store = N.createAnnotationStore({ db: countingDb, now: () => clock.t, newId: () => 'ann:t' + (++idn) });

function desc(paras, pageNo) {
  return {
    pageNo: pageNo || 12,
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
const PA = { id: '12:p0', lines: [['12:1', 'Iron studies guide the workup of anemia in adults.'], ['12:2', 'Low ferritin confirms deficiency in most cases.']] };
const PB = { id: '12:p1', lines: [['12:3', 'Oral iron is first-line for most patients.'], ['12:4', 'Intravenous iron suits malabsorption.']] };
const D1 = desc([PA, PB]);
const at = (d, s, nth) => { const { idx } = indexOfDesc(d); let a = -1; for (let i = 0; i <= (nth || 0); i++) a = idx.text.indexOf(s, a + 1); return a; };

async function reset() { for (const s of db.STORE_NAMES) await db.clearStore(s); idn = 0; patches = 0; clock.t = T0; }
async function all() { const out = []; await db.iterate('annotations', {}, (v) => { out.push(v); }); return out; }
function base(over) {
  return Object.assign({ docId: 'docA', pageNo: 12, desc: D1, kind: 'highlight', color: 'green', fileHash: 's256:p:1:aaa', docTitle: 'Book A' }, over || {});
}

test('N1 ★ 만들기 → 레코드 꼴 · docId_pageNo 로 읽기 · 원문 쪽 글은 저장하지 않는다', async () => {
  await reset();
  const a = at(D1, 'Low ferritin');
  const recs = await store.create(base({ from: a, to: a + 'Low ferritin confirms'.length, note: 'x'.repeat(ANNO.NOTE_MAX + 50) }));
  assert.equal(recs.length, 1);
  const r = recs[0];
  assert.deepEqual([r.id, r.kind, r.docId, r.pageNo, r.color, r.group, r.fileHash, r.docTitle], ['ann:t1', 'highlight', 'docA', 12, 'green', 'ann:t1', 's256:p:1:aaa', 'Book A']);
  assert.equal(r.note.length, ANNO.NOTE_MAX, '메모 2,000자에서 자름');
  assert.deepEqual([r.createdAt, r.updatedAt], [T0, T0]);
  assert.equal(r.anchor.algo, ALGO, '★ 만들 때 판 = 코드의 algoVersion(상수를 박지 않는다)');
  assert.deepEqual(r.anchor.lineIds, ['12:2']);
  assert.equal(r.anchor.quote.exact, 'Low ferritin confirms');
  assert.equal(r.anchor.paraId, '12:p0');
  assert.match(r.anchor.textHash, /^(s256|fnv):/);
  // 다른 쪽·다른 문서 레코드는 forPage 에 안 든다
  await store.create(base({ pageNo: 13, from: a, to: a + 3 }));
  await store.create(base({ docId: 'docB', from: a, to: a + 3 }));
  const pg = await store.forPage('docA', 12);
  assert.deepEqual(pg.map((x) => x.id), ['ann:t1']);
  // note 종류에는 색이 없다 · 없는 색은 첫 색
  const n = await store.create(base({ kind: 'note', color: 'red', from: a, to: a + 3 }));
  assert.equal('color' in n[0], false);
  const y = await store.create(base({ color: 'red', from: a, to: a + 3 }));
  assert.equal(y[0].color, 'yellow');
  // 원문 쪽 글 전체(문단 글)를 담지 않는다 — 인용·앞뒤 32자만
  const s = JSON.stringify(await all());
  assert.ok(!s.includes(PA.lines[0][1]), '첫 줄 글 전체가 저장되지 않았다');
  // 빈 선택·잘못된 입력
  assert.deepEqual(await store.create(base({ from: a, to: a })), []);
  assert.deepEqual(await store.create(base({ desc: null, from: 0, to: 5 })), []);
});

test('N2 ★ 문단을 넘는 선택 → 문단마다 레코드(같은 group) · remove 가 묶음을 함께 지움 · 요약 레코드는 건드리지 않음', async () => {
  await reset();
  await db.put('annotations', { id: 'sum:1', kind: 'summary', docId: 'docA', pageNo: 12, anchor: { textHash: 'h' }, target: 'ar', gist: 'g' });
  const a = at(D1, 'most cases');
  const b = at(D1, 'Oral iron is') + 'Oral iron is'.length;
  const recs = await store.create(base({ from: a, to: b }));
  assert.equal(recs.length, 2);
  assert.deepEqual(recs.map((r) => r.anchor.quote.exact), ['most cases.', 'Oral iron is']);
  assert.deepEqual(recs.map((r) => r.group), ['ann:t1', 'ann:t1']);
  const other = await store.create(base({ from: a, to: a + 4 }));
  // 긴 선택 — QUOTE_MAX 마다 나눈다
  const { idx } = indexOfDesc(desc([{ id: 'L', lines: [['12:9', 'abc '.repeat(250)]] }]));
  const parts = N.splitSelection(idx, 0, idx.text.length);
  assert.equal(parts.length, 3);
  assert.ok(parts.every((c) => c.to - c.from <= ANNO.QUOTE_MAX));
  assert.deepEqual(N.splitSelection(indexOfDesc(D1).idx, 9, 3)[0].from, 3, '거꾸로 준 선택');
  // 지우기
  const gone = await store.remove('ann:t2');
  assert.deepEqual(gone.map((r) => r.id).sort(), ['ann:t1', 'ann:t2'], '★ 묶음 전체');
  const left = (await all()).map((r) => r.id).sort();
  assert.deepEqual(left, [other[0].id, 'sum:1'].sort());
  assert.deepEqual(await store.remove('sum:1'), [], '요약은 이 서비스로 지우지 않는다');
  assert.equal((await store.list()).some((r) => r.kind === 'summary'), false);
  assert.equal(await store.count('docA'), 1);
});

test('N3 ★ 판이 다르고 how ≠ exact 인 레코드는 처음 그릴 때 한 번만 고쳐 쓴다(updatedAt 그대로) — 두 번째는 exact', async () => {
  await reset();
  const a = at(D1, 'Intravenous iron');
  const [r] = await store.create(base({ from: a, to: a + 'Intravenous iron suits'.length, algo: ALGO - 1 }));
  // 새 판: 줄 id 가 모두 바뀌고 문단 순서가 바뀌었다
  const D2 = desc([{ id: '12:p0', lines: [['12:11', PB.lines[0][1]], ['12:12', PB.lines[1][1]]] }, { id: '12:p1', lines: [['12:13', PA.lines[0][1]], ['12:14', PA.lines[1][1]]] }]);
  clock.t = T0 + 9000;
  patches = 0;
  const p1 = await store.placeOnPage('docA', 12, D2);
  assert.equal(p1.length, 1);
  assert.equal(p1[0].res.how, 'para');
  assert.deepEqual(p1[0].res.ranges.map((x) => x.id), ['12:12']);
  assert.equal(patches, 1, '★ 한 번 고쳐 씀');
  const saved = (await all())[0];
  assert.equal(saved.anchor.algo, ALGO);
  assert.deepEqual(saved.anchor.lineIds, ['12:12']);
  assert.deepEqual(saved.anchor.start, { lineId: '12:12', off: 0 });
  assert.equal(saved.anchor.quote.exact, r.anchor.quote.exact, '인용은 그대로');
  assert.equal(saved.updatedAt, T0, '사용자가 고친 것이 아니다 — updatedAt 그대로(9c 병합)');
  const p2 = await store.placeOnPage('docA', 12, D2);
  assert.equal(p2[0].res.how, 'exact', '다음부터 빠른 길');
  assert.equal(patches, 1, '★ 두 번째 그리기에서는 쓰지 않는다');
});

test('N4 같은 판에서 how ≠ exact 면 고쳐 쓰지 않는다 · 고아(null)는 레코드를 지우지 않는다', async () => {
  await reset();
  const a = at(D1, 'Oral iron');
  await store.create(base({ from: a, to: a + 'Oral iron is first'.length }));
  const D2 = desc([PA, { id: '12:p1', lines: [['12:30', 'Note: ' + PB.lines[0][1]], ['12:31', PB.lines[1][1]]] }]);
  patches = 0;
  const p = await store.placeOnPage('docA', 12, D2);
  assert.notEqual(p[0].res.how, 'exact');
  assert.equal(patches, 0, '같은 판 — 쓰지 않는다');
  const gone = desc([PA]);
  const q = await store.placeOnPage('docA', 12, gone);
  assert.equal(q[0].res, null);
  assert.equal((await all()).length, 1, '고아도 남는다');
  assert.deepEqual(await store.placeOnPage('docA', 99, D1), []);
});

test('N5 ★ reattach — 같은 fileHash 이고 문서 목록에 없는 docId 만 새 id 로(요약 레코드도) · 다른 fileHash·살아 있는 문서는 그대로', async () => {
  await reset();
  await db.put('documents', { id: 'docNew', fileHash: 'H1', title: 'A' });
  await db.put('documents', { id: 'docLive', fileHash: 'H1x', title: 'B' });
  const mk = (id, docId, fileHash, kind) => db.put('annotations', { id, kind: kind || 'highlight', docId, pageNo: 3, fileHash, anchor: {}, color: 'yellow' });
  await mk('a1', 'docOld', 'H1');
  await mk('a2', 'docOld', 'H1', 'note');
  await mk('s1', 'docOld', 'H1', 'summary');
  await mk('b1', 'docGone', 'H2');
  await mk('c1', 'docLive', 'H1');
  const n = await store.reattach('H1', 'docNew');
  assert.equal(n, 3);
  const by = new Map((await all()).map((r) => [r.id, r.docId]));
  assert.deepEqual([by.get('a1'), by.get('a2'), by.get('s1'), by.get('b1'), by.get('c1')], ['docNew', 'docNew', 'docNew', 'docGone', 'docLive']);
  assert.equal(await store.reattach('H1', 'docNew'), 0, '두 번째는 옮길 것이 없다');
  assert.equal(await store.reattach('', 'docNew'), 0);
  assert.equal(await store.count('docNew', 3), 2, '쪽 수 — 필기만(요약 빼고)');
});

test('N6 update(색·메모 — updatedAt 새로) · count · list 순서', async () => {
  await reset();
  const a = at(D1, 'Iron studies');
  const [r] = await store.create(base({ from: a, to: a + 4 }));
  clock.t = T0 + 5;
  const w = await store.update(r.id, { color: 'pink', note: 'hi' });
  assert.equal(w.wrote, true);
  assert.deepEqual([w.rec.color, w.rec.note, w.rec.updatedAt, w.rec.createdAt], ['pink', 'hi', T0 + 5, T0]);
  assert.equal((await store.update(r.id, {})).wrote, false);
  assert.equal((await store.update('nope', { note: 'x' })).wrote, false);
  const [nt] = await store.create(base({ kind: 'note', from: a, to: a + 4 }));
  await store.update(nt.id, { color: 'blue' });
  assert.equal('color' in (await db.get('annotations', nt.id)), false, 'note 에는 색을 달지 않는다');
  await store.create(base({ pageNo: 2, from: a, to: a + 4 }));
  await store.create(base({ docId: 'docB', from: a, to: a + 4 }));
  assert.deepEqual((await store.list({ docId: 'docA' })).map((x) => x.pageNo), [2, 12, 12]);
  assert.equal((await store.list()).length, 4);
  assert.equal(await store.count('docA'), 3);
  assert.equal(await store.count('docA', 12), 2);
});

/* ══ N7 칠하기 묶음 · 원본 상자 ═════════════════════════ */

test('N7 paintGroups — 색마다 · 메모 있는 하이라이트는 note 에도 · 고아 건너뜀 · NAMES 다섯', () => {
  const R = (id) => ({ ranges: [{ id: id, start: 0, end: 3 }], how: 'page' });
  const g = paintGroups([
    { rec: { kind: 'highlight', color: 'green' }, res: R('1') },
    { rec: { kind: 'highlight', color: 'yellow', note: '메모' }, res: R('2') },
    { rec: { kind: 'note', note: 'x' }, res: R('3') },
    { rec: { kind: 'highlight', color: 'blue' }, res: null },
    { rec: { kind: 'highlight', color: 'weird' }, res: R('4') }
  ]);
  assert.deepEqual(g.map((x) => [x.key, x.ranges.map((r) => r.id)]), [['yellow', ['2', '4']], ['green', ['1']], ['note', ['2', '3']]]);
  assert.deepEqual(Object.values(NAMES), ['anno-yellow', 'anno-green', 'anno-blue', 'anno-pink', 'anno-note']);
});

function oLine(id, x0, y0, opt) {
  const o = opt || {};
  return { id, text: o.text || 'abcdefghij', bbox: { x0, y0, x1: x0 + 100, y1: y0 + 12 }, fontSize: 10, role: o.role || 'body', runs: [{ x0, x1: x0 + 100 }] };
}

test('N7 ★ annoBoxes — 줄 bbox 안 · 가로 자름 · 회전 줄 제외 · 200 을 넘으면 줄 통째 상자로 합침', () => {
  const layout = { width: 600, height: 800, lines: [oLine('1:1', 50, 700), oLine('1:2', 50, 680), oLine('1:3', 50, 660, { role: 'rotated' })] };
  const { boxes, merged } = annoBoxes(layout, [{ key: 'yellow', ranges: [{ id: '1:1', start: 2, end: 5 }, { id: '1:2', start: 0, end: 10 }, { id: '1:3', start: 0, end: 4 }] }]);
  assert.equal(merged, false);
  assert.deepEqual(boxes.map((b) => b.id), ['1:1', '1:2'], '회전 줄 없음');
  const pad = 10 * 0.15;
  for (const b of boxes) {
    const l = layout.lines.find((x) => x.id === b.id);
    assert.ok(b.x0 >= l.bbox.x0 - 10 && b.x1 <= l.bbox.x1 + 10 && b.y0 >= l.bbox.y0 - 10 && b.y1 <= l.bbox.y1 + 10, '줄 bbox(여백 포함) 안');
  }
  assert.ok(boxes[0].x1 - boxes[0].x0 < 50, '첫 상자는 글자 구간으로 자름(3/10 폭 + 여백)');
  assert.ok(pad > 0);
  // 250 구간(한 줄에 여러 필기) → 줄 통째로 합침
  const many = [];
  for (let i = 0; i < 250; i++) many.push({ id: i % 2 ? '1:1' : '1:2', start: i % 5, end: (i % 5) + 2 });
  const m = annoBoxes(layout, [{ key: 'green', ranges: many }, { key: 'note', ranges: [{ id: '1:1', start: 0, end: 2 }] }]);
  assert.equal(m.merged, true);
  assert.ok(m.boxes.length <= ANNO.MAX_BOXES_PAGE);
  assert.deepEqual(m.boxes.map((b) => b.key + '|' + b.id), ['green|1:2', 'green|1:1', 'note|1:1']);
  assert.deepEqual(annoBoxes(null, []).boxes, []);
  assert.equal(annoBoxes(layout, [{ key: 'pink', ranges: many }], 3).boxes.length, 2, '상한을 주면 그 안');
});

/* ══ N8 우선순위 · 소스 ═════════════════════════════════ */

test('N8 ★ 우선순위 필기 0 < 검색 1 < 낭독 2 — 세 곳이 같은 함수(prioritize)·같은 상수로 둔다', () => {
  const P = ANNO.PRIORITY;
  assert.ok(P.ANNO < P.SEARCH && P.SEARCH < P.SPEAKER, '필기 < 검색 < 낭독');
  const an = read('../js/ui/annotate.js');
  const se = read('../js/ui/search.js');
  const rd = read('../js/ui/reader.js');
  assert.match(an, /prioritize\(name, ANNO\.PRIORITY\.ANNO\)/);
  assert.match(se, /prioritize\(HL_HIT, ANNO\.PRIORITY\.SEARCH\)/);
  assert.match(se, /prioritize\(HL_CUR, ANNO\.PRIORITY\.SEARCH\)/);
  assert.match(rd, /prioritize\(HL_NAME, ANNO\.PRIORITY\.SPEAKER\)/);
  assert.match(rd, /initAnnotate\(\);/);
  // 리더는 필기 구독을 검색 뒤에 건다
  assert.ok(rd.indexOf('initAnnotate();') > rd.indexOf('initSearch();'));
});

test('N8 새 파일·고친 칠하기 자리에 innerHTML 0 · 서비스는 ui/·ai/ 를 모른다 · 본문 DOM 에 끼우지 않는다', () => {
  for (const f of ['../js/text/anchor.js', '../js/notes/annotations.js', '../js/ui/annotate.js', '../js/ui/original.js']) {
    assert.doesNotMatch(read(f).replace(/\/\*[\s\S]*?\*\//g, ''), /innerHTML|insertAdjacentHTML/, f);
  }
  const svc = read('../js/notes/annotations.js');
  for (const im of svc.match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || []) assert.doesNotMatch(im, /\/(ui|ai)\//, im);
  const an = read('../js/ui/annotate.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(an, /appendChild|insertBefore|createElement|textContent\s*=/, '리플로우 본문에 요소를 끼우지 않는다');
  // CSS — 다섯 이름 · 줄 클래스 · 네 테마 토큰
  const css = read('../css/reader.css');
  for (const n of Object.values(NAMES)) assert.match(css, new RegExp('::highlight\\(' + n + '\\)'));
  for (const k of ['yellow', 'green', 'blue', 'pink', 'note']) assert.match(css, new RegExp('\\.anno-line-' + k + ' '));
  const tok = read('../css/tokens.css');
  assert.equal((tok.match(/--anno-yellow:/g) || []).length, 5, ':root · 시스템 어두움 · dark · sepia · contrast');
  // 낭독 줄 클래스(.is-current)가 물러섬 줄 클래스보다 뒤 — 같은 명시도에서 낭독 배경이 이긴다
  assert.ok(css.indexOf('.reflow .line.anno-line-yellow') < css.indexOf('.reflow .line.is-current {'));
});
