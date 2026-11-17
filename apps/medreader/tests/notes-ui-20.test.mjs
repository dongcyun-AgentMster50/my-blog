/* ============================================================
   tests/notes-ui-20.test.mjs — 20-3 필기 화면 · 내보내기 · 다시 붙이기 (spec 17-16 6 · 9 "20-3" — fake-idb · 순수)

   - R1  라우트 `#/notes` · `#/notes/:docId` · `#/notes/:docId/:a-b` · `notesHash` 왕복 · 이상한 범위는 그 책 전체
   - P1  ★ 줄(`rowsOf`) — 같은 group = 한 줄 · 메모는 대표 하나(옛 중복 메모도 한 번 — 20-2R #2) · 요약·개요는 거름
   - P2  ★ 책 → 장(개요 맨 위 깊이) → 쪽 → 자리 순(`viewBooks`) · 장 앞 쪽은 쪽 머리 · 지워진 책은 뒤(`gone`)
   - P3  거르기 칩(색·색 없는 메모·메모 있는 것·위치 못 찾은 것) · 쪽 범위 · 책 고르기 셈
   - E1  ★ 내보내기 Markdown — BOM · CRLF 만 · `#`·`##` · `> 인용` · 아랍어 메모 그대로(여러 줄) · 키 문자열 0 · 줄 수
   - D1  ★ 문서를 지워도 필기·요약이 남는다(20-1R #6 — 지금 규칙 `keepsOnDocDelete` 고정 · db.js 무변) · 삭제 확인 "필기 n"
   - D2  ★ 같은 PDF 다시 가져오기 → `reattach` 가 같은 fileHash 고아만 새 문서로(다른 PDF 0 · 살아 있는 문서 0) · 서재 배선
   - D3  ★ 셈 = 줄 수(20-2R #3 — 묶음 1 · 고아 포함, 쪽 시트 `groupRows` 와 같다) · 묶음 메모는 대표에만 저장(20-2R #2)
   - D4  흐름 — 메모 저장(대표만 · 옛 중복 걷힘) · 색 없는 메모를 빈 글로 = 지움 · 지우기(묶음) → 되살리기(같은 id)
   - D5  ★ 위치 못 찾은 줄(`findLost` — 읽기만, 고쳐 쓰기 0) · 아직 추출 안 된 쪽은 모름 · 지워진 책은 건너뜀
   - D6  9c — 문서 없는 필기도 넣는다(11 과 같은 규칙) · 같은 파일 두 번 = 한 번(멱등)
   - SB  ★ [20-2R #5] 선택 줄 기존 칸 — 메뉴 첫 자식이 필기 줄이어도 숨김·흐림이 제 칸에(`paintButtons`)
   - S1  정적 — innerHTML 0 · import 방향 · 마크업 · CSS 48px·논리 속성 · i18n 4언어 · 서재·main 배선 · import map
   지어낸 글자만. 호출 0.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
globalThis.sessionStorage = globalThis.sessionStorage || memStorage();
globalThis.localStorage = globalThis.localStorage || memStorage();

const db = await import('../js/db.js');
const R = await import('../js/router.js');
const A = await import('../js/notes/annotations.js');
const NU = await import('../js/ui/notes.js');
const NS = await import('../js/ui/notesheet.js');
const SB = await import('../js/ui/selbar.js');
const LIB = await import('../js/ui/library.js');
const { ANNO } = await import('../js/config.js');
const { OUTLINE_V } = await import('../js/search/outline.js');
const { joinHyphen } = await import('../js/text/hyphen.js');
const { indexOfDesc } = await import('../js/text/anchor.js');
const { BUNDLES, LANGS } = await import('../js/i18n/index.js');
const { exportBackup } = await import('../js/backup/export.js');
const IM = await import('../js/backup/import.js');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
function strip(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'); }
const T0 = new Date(2026, 10, 17, 12, 0, 0).getTime();
const clock = { t: T0 };
let idn = 0;
const store = A.createAnnotationStore({ now: () => clock.t, newId: () => 'ann:n' + (++idn) });

async function reset() { for (const s of db.STORE_NAMES) await db.clearStore(s); idn = 0; clock.t = T0; }
async function all(s) { const out = []; await db.iterate(s || 'annotations', {}, (v) => { out.push(v); }); return out; }

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
const at = (d, s) => indexOfDesc(d).idx.text.indexOf(s);

/** 지어낸 필기 레코드(서비스를 거치지 않음 — 줄·화면 모양 시험). */
function rec(id, over) {
  return Object.assign({ id: id, kind: 'highlight', docId: 'docA', pageNo: 12, fileHash: 'H1', docTitle: 'Book A', color: 'yellow', note: '',
    group: id, anchor: { start: { lineId: '12:1', off: 0 }, quote: { exact: 'quote ' + id } }, createdAt: T0, updatedAt: T0 }, over || {});
}
const DOC = { id: 'docA', title: 'Book A', fileName: 'a.pdf', pageCount: 60, fileHash: 'H1', outlineV: OUTLINE_V,
  outline: [{ t: 'Chapter One', p: 10, d: 1 }, { t: 'One.1', p: 11, d: 2 }, { t: 'Chapter Two', p: 30, d: 1 }] };

/* ══ R1 라우트 ═══════════════════════════════════════════ */

test('R1 라우트 — #/notes · #/notes/:docId · #/notes/:docId/:a-b · notesHash 왕복 · 화면 이름', () => {
  assert.deepEqual(R.parseRoute('#/notes').params, {});
  assert.equal(R.parseRoute('#/notes').name, 'notes');
  assert.deepEqual(R.parseRoute('#/notes/doc%20A').params, { docId: 'doc A' });
  assert.deepEqual(R.parseRoute('#/notes/docA/30-12').params, { docId: 'docA', range: { from: 12, to: 30 } }, '거꾸로 준 범위는 바로잡음');
  assert.deepEqual(R.parseRoute('#/notes/docA/x-1').params, { docId: 'docA' }, '이상한 범위 → 그 책 전체');
  assert.deepEqual(R.parseRoute('#/notes/docA/0-3').params, { docId: 'docA' });
  assert.equal(R.notesHash(), '#/notes');
  assert.equal(R.notesHash(''), '#/notes');
  assert.equal(R.notesHash('doc A'), '#/notes/doc%20A');
  assert.equal(R.notesHash('docA', { from: 9, to: 3 }), '#/notes/docA/3-9');
  for (const h of ['#/notes', R.notesHash('d/1'), R.notesHash('d', { from: 2, to: 5 })]) {
    const r = R.parseRoute(h);
    assert.equal(r.name, 'notes');
    assert.equal(R.notesHash(r.params.docId, r.params.range), h, '왕복');
  }
  assert.ok(R.SCREENS.includes('notes'));
  assert.match(read('../index.html'), /<section class="screen notes-screen" data-screen="notes" hidden>/);
});

/* ══ P 순수 ═══════════════════════════════════════════════ */

test('P1 ★ rowsOf — 같은 group 은 한 줄 · 메모는 대표 하나(옛 중복 메모도 한 번) · 인용은 자리 순 · 요약·개요는 거름', () => {
  const recs = [
    rec('g1', { note: '같은 메모', anchor: { start: { lineId: '12:1', off: 5 }, quote: { exact: 'first part' } } }),
    rec('g1b', { group: 'g1', note: '같은 메모', anchor: { start: { lineId: '12:3', off: 0 }, quote: { exact: 'second part' } }, createdAt: T0 + 1 }),
    rec('n1', { kind: 'note', color: undefined, note: 'ملاحظة', anchor: { start: { lineId: '12:2', off: 0 }, quote: { exact: 'n quote' } } }),
    { id: 'sum:1', kind: 'summary', docId: 'docA', pageNo: 12, gist: 'g' },
    { id: 'out:1', kind: 'outline', docId: 'docA', pageNo: 12 }
  ];
  const rows = NU.rowsOf(recs);
  assert.equal(rows.length, 2, '묶음 둘 → 한 줄 · 요약·개요 0');
  const g = rows.find((r) => r.id === 'g1');
  assert.equal(g.note, '같은 메모', '★ 한 번(두 번 이어 붙이지 않는다)');
  assert.equal(g.quote, 'first part second part');
  assert.deepEqual(g.ids, ['g1', 'g1b']);
  assert.equal(g.color, 'yellow');
  const n = rows.find((r) => r.id === 'n1');
  assert.deepEqual([n.kind, n.color, n.note], ['note', null, 'ملاحظة']);
  // 대표가 비고 조각에 메모가 있으면(옛 꼴) 그 메모
  const r2 = NU.rowsOf([rec('h1', { note: '' }), rec('h2', { group: 'h1', note: 'later' })]);
  assert.equal(r2[0].note, 'later');
  // 자리 — 첫 줄 읽기 순서 번호
  assert.deepEqual(NU.posOf(rec('x', { anchor: { start: { lineId: '12:17', off: 4 } } })), { line: 17, off: 4 });
  assert.equal(NU.posOf({}).line, 1e9);
});

test('P2 ★ viewBooks — 책 → 장(개요 맨 위 깊이) → 쪽 → 자리 순 · 장 앞 쪽은 쪽 머리 · 지워진 책 뒤', () => {
  const recs = [
    rec('a31', { pageNo: 31 }),
    rec('a12b', { pageNo: 12, anchor: { start: { lineId: '12:9', off: 0 }, quote: { exact: 'later on page' } } }),
    rec('a12a', { pageNo: 12, anchor: { start: { lineId: '12:2', off: 3 }, quote: { exact: 'earlier on page' } } }),
    rec('a5', { pageNo: 5 }),
    rec('a10', { pageNo: 10 }),
    rec('z1', { docId: 'docGone', docTitle: 'Old Book', pageNo: 3, fileHash: 'HX' }),
    rec('b1', { docId: 'docB', docTitle: 'Another', pageNo: 1, fileHash: 'H2' })
  ];
  const docs = [DOC, { id: 'docB', title: 'Another', pageCount: 5 }];
  const books = NU.viewBooks(NU.rowsOf(recs), docs);
  assert.deepEqual(books.map((b) => [b.docId, b.gone]), [['docB', false], ['docA', false], ['docGone', true]], '이 기기 책 제목 순 · 지워진 책 뒤');
  const a = books[1];
  assert.deepEqual(a.groups.map((g) => g.head.kind === 'chapter' ? 'c:' + g.head.title : 'p:' + g.head.page), ['p:5', 'c:Chapter One', 'c:Chapter Two']);
  assert.deepEqual(a.groups[1].rows.map((r) => r.id), ['a10', 'a12a', 'a12b'], '★ 쪽 → 쪽 안 자리 순');
  assert.deepEqual([a.groups[1].head.from, a.groups[1].head.to], [10, 29]);
  assert.equal(books[2].title, 'Old Book', '지워진 책 = docTitle');
  // 개요 없는 책 → 쪽 머리
  assert.deepEqual(books[0].groups.map((g) => g.head.kind), ['page']);
});

test('P3 거르기 칩 · 쪽 범위 · 위치 못 찾은 것(고아 + 지워진 책) · 책 고르기 셈(줄 수)', () => {
  const rows = NU.rowsOf([
    rec('y', { color: 'yellow', pageNo: 3 }), rec('g', { color: 'green', pageNo: 4, note: 'm' }), rec('p', { color: 'pink', pageNo: 9 }),
    rec('n', { kind: 'note', note: 'only memo', pageNo: 5 }), rec('o', { docId: 'docGone', pageNo: 2 }),
    rec('g2', { group: 'g', color: 'green', pageNo: 4 })
  ]);
  const ids = (f, lost, live) => NU.filterRows(rows, f, lost, live).map((r) => r.id).sort();
  assert.deepEqual(ids({}), ['g', 'n', 'o', 'p', 'y']);
  assert.deepEqual(ids({ colors: ['yellow', 'pink'] }), ['o', 'p', 'y'], 'o 는 노랑(기본)');
  assert.deepEqual(ids({ colors: ['note'] }), ['n'], '색 없는 메모');
  assert.deepEqual(ids({ memo: true }), ['g', 'n']);
  assert.deepEqual(ids({ colors: ['green'], memo: true }), ['g'], '칩은 함께(그리고)');
  const live = new Set(['docA']);
  const lost = new Set(['docA\u0001p']);
  assert.deepEqual(ids({ lost: true }, lost, live), ['o', 'p'], '★ 고아 + 이 기기에 없는 책');
  assert.deepEqual(ids({ range: { from: 3, to: 4 } }), ['g', 'y']);
  assert.deepEqual(ids({ colors: ['weird'] }), ['g', 'n', 'o', 'p', 'y'], '모르는 색은 무시');
  const opts = NU.scopeOptions(rows, [{ id: 'docA', title: 'Book A' }]);
  assert.deepEqual(opts.map((o) => [o.value, o.n, o.gone]), [['', 5, false], ['docA', 4, false], ['docGone', 1, true]], '셈 = 줄 수(묶음 1)');
  assert.equal(NU.isLost({ key: 'k', docId: 'docA' }, new Set(), live), false);
});

/* ══ E1 내보내기 ═══════════════════════════════════════════ */

test('E1 ★ 내보내기 Markdown — BOM · CRLF 만 · # · ## · > 인용 · 아랍어 메모 그대로(여러 줄) · 키 문자열 0 · 줄 수', async () => {
  await reset();
  const FAKE = 'AIzaSyFAKE_notes_key_0000000000000000';
  await db.put('settings', { key: 'ai.key', value: FAKE });
  const memo = 'ملاحظة: الحديد مهم\nسطر ثانٍ — line two\u2028third';
  const recs = [
    rec('a1', { pageNo: 12, note: memo, anchor: { start: { lineId: '12:1', off: 0 }, quote: { exact: 'Low ferritin\nconfirms' } } }),
    rec('a2', { pageNo: 5, color: 'blue', anchor: { start: { lineId: '5:1', off: 0 }, quote: { exact: 'Page five quote' } } }),
    rec('z1', { docId: 'docGone', docTitle: 'Old <img src=x onerror=alert(1)>', pageNo: 3, kind: 'note', note: 'gone memo' })
  ];
  const books = NU.viewBooks(NU.rowsOf(recs), [DOC]);
  const md = NU.exportMarkdown(books, { untitled: '(none)', color: (r) => (r.color || 'note'), gone: () => 'Import again to re-attach.' });
  assert.equal(md.charCodeAt(0), 0xFEFF, 'BOM');
  assert.ok(md.endsWith('\r\n'));
  assert.equal(md.replace(/\r\n/g, '').includes('\n'), false, '★ CRLF 만(외톨이 LF 0)');
  assert.equal(md.includes('\r\r'), false);
  const lines = md.slice(1).split('\r\n');
  assert.equal(lines[0], '# Book A');
  assert.ok(lines.includes('## p. 5'), '장 앞 쪽 = 쪽 머리');
  assert.ok(lines.includes('## Chapter One (p. 10–29)'));
  assert.ok(lines.includes('> Page five quote'));
  assert.ok(lines.includes('> Low ferritin confirms'), '인용은 한 줄로 접음');
  assert.ok(lines.includes('ملاحظة: الحديد مهم') && lines.includes('سطر ثانٍ — line two') && lines.includes('third'), '★ 아랍어 메모 그대로(줄 나눔 유지)');
  assert.ok(lines.includes('— p. 12 · yellow'));
  assert.ok(lines.includes('# Old <img src=x onerror=alert(1)>') && lines.includes('Import again to re-attach.'), '지워진 책 묶음 + 다시 붙음 안내');
  // 인용 줄 바로 다음은 빈 줄(메모가 인용 안으로 이어 붙지 않게 — Markdown 게으른 이어짐)
  const qi = lines.indexOf('> Low ferritin confirms');
  assert.equal(lines[qi + 1], '');
  assert.equal(md.includes(FAKE), false, '★ 키 문자열 0');
  assert.equal(md.includes('settings'), false);
  assert.equal(lines[lines.length - 1], '', '끝은 CRLF');
  assert.equal(lines.length - 1, md.split('\r\n').length - 1, '줄 수 셈 = 화면 측정 훅 `lastExport.lines` 와 같은 식(Blob 가로채 비교용)');
  assert.match(NU.exportName(T0), /^medreader-notes-20261117\.md$/);
  assert.deepEqual(NU.memoLines('\n  a  \r\n\r\nb\u2029\n'), ['  a', '', 'b']);
});

/* ══ D 저장소(fake-idb) ════════════════════════════════════ */

test('D1 ★ 문서를 지워도 필기·요약이 남는다(지금 규칙 고정 — db.js 무변) · 다른 연쇄 스토어는 지워진다 · 삭제 확인 "필기 n"', async () => {
  await reset();
  await db.put('documents', { id: 'docA', title: 'Book A', fileHash: 'H1' });
  await db.put('pages', { docId: 'docA', pageNo: 12, algoVersion: 13, lines: [] });
  const a = at(D1, 'Low ferritin');
  await store.create({ docId: 'docA', pageNo: 12, desc: D1, from: a, to: at(D1, 'Oral iron is') + 6, color: 'pink', fileHash: 'H1', docTitle: 'Book A' });
  await store.create({ docId: 'docA', pageNo: 12, desc: D1, kind: 'note', note: 'm', from: a, to: a + 4, fileHash: 'H1', docTitle: 'Book A' });
  await db.put('annotations', { id: 'sum:1', kind: 'summary', docId: 'docA', pageNo: 12, fileHash: 'H1' });
  assert.equal(await store.count('docA'), 2, '묶음 둘(문단 넘는 선택 1 + 메모 1)');
  const counts = await LIB.deleteKeepCounts('docA', { vocab: { countByDoc: async () => 0 }, cards: { keptCount: async () => 0 }, summaries: { count: async () => 1 } });
  assert.deepEqual(counts, { vocab: 0, summaries: 1, notes: 2 });
  const lines = LIB.deleteKeepLines(counts);
  assert.deepEqual(lines.map((l) => l.key), ['library.card.deleteConfirmSummaries', 'library.card.deleteConfirmNotes']);
  const tk = (k, p) => BUNDLES.ko[k].replace(/\{(\w+)\}/g, (m, n) => String(p[n]));
  assert.match(LIB.deleteConfirmText('Book A', lines, tk), /저장한 요약 1건 · 필기 2건은 남습니다/);
  assert.deepEqual(LIB.deleteKeepLines({ notes: 0 }), [], '0 이면 조각 없음');
  await db.deleteDocument('docA');
  const left = await all();
  assert.equal(left.length, 4, '★ 필기 3 레코드 + 요약 1 — 모두 남음');
  assert.equal(await db.get('documents', 'docA'), undefined);
  assert.equal(await db.get('pages', ['docA', 12]), undefined, '연쇄 스토어(pages)는 지워진다');
  assert.equal(db.keepsOnDocDelete({ kind: 'highlight' }, 'annotations'), true);
  assert.equal(db.keepsOnDocDelete({ kind: 'anything' }, 'annotations'), true, '스토어 전체(11-D8 문구 → 20-D11)');
  // db.js 무변 — 판정 한 곳(`keepsOnDocDelete`)이 annotations 를 남긴다(설계 "CASCADE_STORES 에서 뺌" 은 옛 사실 — 20-1R #6)
  const dbs = read('../js/db.js');
  assert.match(dbs, /if \(name === 'annotations'\) return true;/);
});

test('D2 ★ 같은 PDF 다시 가져오기 — reattach 는 같은 fileHash 고아만(다른 PDF·살아 있는 문서 0) · 칠해질 쪽에서 찾힘 · 서재 배선', async () => {
  await reset();
  await db.put('documents', { id: 'docOld', title: 'Book A', fileHash: 'H1' });
  await db.put('documents', { id: 'docOther', title: 'Other', fileHash: 'H2' });
  const a = at(D1, 'Oral iron');
  const [h] = await store.create({ docId: 'docOld', pageNo: 12, desc: D1, from: a, to: a + 'Oral iron is'.length, fileHash: 'H1', docTitle: 'Book A' });
  await store.create({ docId: 'docOther', pageNo: 12, desc: D1, from: a, to: a + 4, fileHash: 'H2', docTitle: 'Other' });
  await db.put('annotations', { id: 'sum:old', kind: 'summary', docId: 'docOld', pageNo: 12, fileHash: 'H1' });
  await db.deleteDocument('docOld');
  await db.deleteDocument('docOther');
  // 다른 PDF 를 가져옴(H3) → 아무것도 붙지 않는다
  await db.put('documents', { id: 'docNewX', title: 'X', fileHash: 'H3' });
  assert.equal(await store.reattach('H3', 'docNewX'), 0, '★ 다른 PDF 에는 붙지 않는다');
  // 같은 PDF(H1) → 그 필기·요약만 새 문서로
  await db.put('documents', { id: 'docNew', title: 'Book A', fileHash: 'H1' });
  assert.equal(await store.reattach('H1', 'docNew'), 2);
  const by = new Map((await all()).map((r) => [r.id, r.docId]));
  assert.equal(by.get(h.id), 'docNew');
  assert.equal(by.get('sum:old'), 'docNew', '요약 레코드도(11 의 fileHash 사본)');
  assert.equal([...by.values()].filter((d) => d === 'docOther').length, 1, '다른 PDF 의 고아는 그대로');
  // 새 문서 쪽에서 다시 찾힌다(칠해짐)
  const placed = await store.placeOnPage('docNew', 12, D1);
  assert.equal(placed.length, 1);
  assert.ok(placed[0].res && placed[0].res.ranges.length, '★ 새 문서에서 칠해질 자리');
  // 서재 — 새 문서를 넣은 뒤(attach 전) reattach(doc.fileHash, doc.id) · [⋯] "이 책의 필기"
  const lib = strip(read('../js/ui/library.js'));
  const imp = lib.slice(lib.indexOf('async function importFile('), lib.indexOf('function newDocument('));
  assert.match(imp, /moved = await annotationStore\(\)\.reattach\(doc\.fileHash, doc\.id\);/);
  assert.ok(imp.indexOf('reattach(doc.fileHash') > imp.indexOf("await db.put('documents', doc);") && imp.indexOf('reattach(doc.fileHash') < imp.indexOf('await attach(doc, pdfDoc);'));
  assert.match(lib, /nb\.setAttribute\('data-action', 'notes'\);/);
  assert.match(lib, /go\(notesHash\(docId\)\);/);
  // reattach 는 한 트랜잭션(documents + annotations)
  const svc = read('../js/notes/annotations.js');
  assert.match(svc, /db\.withTx\(\['documents', STORE\], 'readwrite'/);
});

test('D3 ★ 셈 = 줄 수(20-2R #3 — 묶음 1 · 고아 포함, 쪽 시트 groupRows 와 같다) · 묶음 메모는 대표에만(20-2R #2)', async () => {
  await reset();
  const a = at(D1, 'most cases');
  const b = at(D1, 'Oral iron is') + 'Oral iron is'.length;
  const recs = await store.create({ docId: 'docA', pageNo: 12, desc: D1, kind: 'note', note: 'one memo', from: a, to: b, fileHash: 'H1' });
  assert.equal(recs.length, 2);
  assert.deepEqual(recs.map((r) => r.note), ['one memo', ''], '★ 대표(첫 레코드 = group)에만');
  assert.equal(recs[0].id, recs[0].group);
  const saved = await all();
  assert.deepEqual(saved.map((r) => r.note).sort(), ['', 'one memo']);
  await store.create({ docId: 'docA', pageNo: 12, desc: D1, from: at(D1, 'Iron'), to: at(D1, 'Iron') + 4, fileHash: 'H1' });
  // 고아 하나(그 쪽 글에 없는 인용)
  await db.put('annotations', { id: 'orph', kind: 'highlight', docId: 'docA', pageNo: 12, color: 'blue', note: '', group: 'orph',
    anchor: { pageNo: 12, algo: 1, lineIds: ['12:9'], start: { lineId: '12:9', off: 0 }, end: { lineId: '12:9', off: 5 }, paraId: '12:p9', textHash: 'x',
      quote: { exact: 'nowhere on this page', prefix: '', suffix: '' } }, createdAt: T0, updatedAt: T0 });
  const placed = await store.placeOnPage('docA', 12, D1);
  assert.equal(placed.length, 4, '레코드 넷');
  const rows = NS.groupRows(placed);
  assert.equal(rows.length, 3, '쪽 시트 줄 셋(묶음 1 · 고아 1)');
  assert.equal(await store.count('docA', 12), rows.length, '★ 칩 숫자 = 시트 줄 수');
  assert.equal(await store.count('docA'), 3);
  assert.equal(NU.rowsOf(await all()).length, 3, '필기 화면 줄도 같다');
  // 칩은 이 셈을 쓴다(리더)
  assert.match(read('../js/ui/reader.js'), /annotationStore\(\)\.count\(docId, page\)/);
});

test('D4 흐름 — 메모 저장(대표만 · 옛 중복 걷힘) · 색 없는 메모 빈 글 = 지움 · 지우기(묶음) → 되살리기(같은 id·만든 때)', async () => {
  await reset();
  await db.put('annotations', rec('g1', { note: 'dup', anchor: { start: { lineId: '12:1', off: 0 }, quote: { exact: 'a' } } }));
  await db.put('annotations', rec('g1b', { group: 'g1', note: 'dup', anchor: { start: { lineId: '12:3', off: 0 }, quote: { exact: 'b' } } }));
  await db.put('annotations', rec('n1', { kind: 'note', note: 'x', color: undefined }));
  let recs = await store.list();
  const flow = NU.createNotesFlow({ store: store, recs: () => recs });
  let rows = NU.rowsOf(recs);
  const g = rows.find((r) => r.id === 'g1');
  assert.equal(flow.hasNote(g), true);
  const r1 = await flow.saveNote(g, '<img src=x onerror=alert(1)> новое');
  assert.deepEqual([r1.ok, r1.key], [true, 'anno.note.saved']);
  const saved = new Map((await all()).map((r) => [r.id, r.note]));
  assert.equal(saved.get('g1'), '<img src=x onerror=alert(1)> новое', '대표에 글자 그대로');
  assert.equal(saved.get('g1b'), '', '★ 옛 중복 메모 걷힘');
  assert.equal((await flow.saveNote(g, 'y'.repeat(ANNO.NOTE_MAX + 9))).ok, true);
  assert.equal((await db.get('annotations', 'g1')).note.length, ANNO.NOTE_MAX);
  // 색 없는 메모를 빈 글로 → 지움(되살리기 재료)
  recs = await store.list();
  const n = NU.rowsOf(recs).find((r) => r.id === 'n1');
  const r2 = await flow.saveNote(n, '   ');
  assert.deepEqual([r2.ok, r2.key, r2.gone.length], [true, 'anno.removed', 1]);
  assert.equal(await db.get('annotations', 'n1'), undefined);
  assert.equal(await flow.undo(r2.gone), 1);
  assert.equal((await db.get('annotations', 'n1')).createdAt, T0);
  // 지우기 — 묶음 전부 → 되살리기
  recs = await store.list();
  rows = NU.rowsOf(recs);
  const gone = await flow.remove(rows.find((r) => r.id === 'g1'));
  assert.deepEqual(gone.map((r) => r.id).sort(), ['g1', 'g1b']);
  assert.equal(await flow.undo(gone), 2);
  assert.deepEqual((await all()).map((r) => r.id).sort(), ['g1', 'g1b', 'n1']);
  // 되돌리기 합치기(3초 안 두 번 — 20-2R #4)
  assert.deepEqual(NS.mergeGone([{ id: 'a' }], [{ id: 'b' }, { id: 'a' }]).map((r) => r.id), ['a', 'b']);
  assert.deepEqual(NS.mergeGone(null, [{ id: 'c' }]).map((r) => r.id), ['c']);
  assert.match(strip(read('../js/ui/notesheet.js')), /toastGone = mergeGone\(toastGone && els && els\.toast && !els\.toast\.hidden \? toastGone : null, gone\);/);
});

test('D5 ★ 위치 못 찾은 줄 — 읽기만(고쳐 쓰기 0) · 묶음 하나라도 찾으면 아님 · 아직 추출 안 된 쪽은 모름 · 지워진 책 건너뜀', async () => {
  await reset();
  const a = at(D1, 'Low ferritin');
  const [ok] = await store.create({ docId: 'docA', pageNo: 12, desc: D1, from: a, to: a + 12, fileHash: 'H1', algo: 1 });
  const [lostRec] = await store.create({ docId: 'docA', pageNo: 12, desc: D1, from: at(D1, 'Intravenous'), to: at(D1, 'Intravenous') + 11, fileHash: 'H1' });
  const [unknown] = await store.create({ docId: 'docA', pageNo: 13, desc: desc([PA], 13), from: 0, to: 4, fileHash: 'H1' });
  const [gone] = await store.create({ docId: 'docGone', pageNo: 12, desc: D1, from: a, to: a + 4, fileHash: 'HX' });
  const before = JSON.stringify(await all());
  const now = desc([PA, { id: '12:p1', lines: [['12:3', 'Oral iron is first-line for most patients.']] }]);   // 'Intravenous …' 사라짐
  const loads = [];
  const lost = await NU.findLost(await store.list(), new Set(['docA']), {
    load: async (docId, p) => { loads.push(docId + ':' + p); return p === 12 ? { desc: now, layout: null } : null; }
  });
  assert.deepEqual([...lost], ['docA\u0001' + lostRec.group], '★ 사라진 인용 하나만');
  assert.ok(!lost.has('docA\u0001' + ok.group) && !lost.has('docA\u0001' + unknown.group), '찾음 · 모름(아직 추출 전)은 고아 아님');
  assert.deepEqual(loads.sort(), ['docA:12', 'docA:13'], '지워진 책은 쪽을 읽지 않는다');
  assert.equal(JSON.stringify(await all()), before, '★ 읽기만 — 판이 달라도 고쳐 쓰지 않는다(algo 1 레코드 그대로)');
  assert.ok(gone);
  // 묶음 — 조각 하나라도 찾으면 고아 아님
  await reset();
  const two = await store.create({ docId: 'docA', pageNo: 12, desc: D1, from: at(D1, 'most cases'), to: at(D1, 'Oral iron is') + 12, fileHash: 'H1' });
  assert.equal(two.length, 2);
  const lost2 = await NU.findLost(await store.list(), new Set(['docA']), { load: async () => ({ desc: desc([PB]) }) });
  assert.equal(lost2.size, 0, '둘째 조각이 찾히면 그 줄은 고아가 아니다(쪽 시트 groupRows 와 같은 판정)');
  // 기본 길: 저장본 없음 → null
  assert.equal(await NU.loadPageDesc('nope', 1), null);
});

test('D6 9c — 문서 없는 필기도 넣는다(11 과 같은 규칙) · 같은 파일 두 번 = 한 번(멱등)', async () => {
  await reset();
  await db.put('documents', { id: 'docA', title: 'Book A', fileName: 'a.pdf', pageCount: 3, fileHash: 's256:p:1:aaa', addedAt: T0, lastOpenedAt: T0,
    lastPage: 1, lang: 'en', extraction: { done: true, pagesDone: 3, cursor: 4, failed: [], algoVersion: 13 } });
  await db.put('annotations', rec('live1', { docId: 'docA', fileHash: 's256:p:1:aaa', note: 'ملاحظة' }));
  await db.put('annotations', rec('orph1', { docId: 'docGone', docTitle: 'Old', fileHash: 's256:p:1:zzz', note: 'kept' }));
  const r = await exportBackup({ now: T0, gzip: false });
  const file = new File([r.blob], r.name);
  await reset();
  const imp = (f) => IM.importBackup(f, { now: T0 + 1000 });
  await imp(file);
  const after1 = JSON.stringify((await all()).sort((x, y) => (x.id < y.id ? -1 : 1)));
  assert.ok(await db.get('annotations', 'orph1'), '★ 문서 없는 필기도 들어온다');
  assert.equal((await db.get('annotations', 'orph1')).note, 'kept');
  assert.equal((await db.get('annotations', 'live1')).note, 'ملاحظة');
  await imp(file);
  const after2 = JSON.stringify((await all()).sort((x, y) => (x.id < y.id ? -1 : 1)));
  assert.equal(after2, after1, '★ 멱등');
});

/* ══ SB 선택 줄 기존 칸 ═══════════════════════════════════ */

function fakeEl(attrs) {
  const a = new Map(Object.entries(attrs || {}));
  return { hidden: false, hasAttribute: (k) => a.has(k), getAttribute: (k) => (a.has(k) ? a.get(k) : null), setAttribute: (k, v) => a.set(k, String(v)),
    removeAttribute: (k) => a.delete(k), _a: a };
}

test('SB ★ [20-2R #5] 선택 줄 기존 칸 — 메뉴 첫 자식이 필기 줄이어도 숨김·흐림·안내가 제 칸에(paintButtons)', () => {
  const anno = fakeEl({ class: 'sel-anno' });
  const ids = ['summary', 'readFrom', 'remember', 'lookup'];
  const btns = ids.map((id) => fakeEl({ 'data-sel-action': id }));
  const host = { children: [anno].concat(btns) };
  const model = [
    { id: 'summary', hidden: false, disabled: true, note: 'sum.off' },
    { id: 'readFrom', hidden: false, disabled: false, note: '' },
    { id: 'remember', hidden: false, disabled: false, note: '' },
    { id: 'lookup', hidden: true, disabled: false, note: 'links.none' }
  ];
  SB.paintButtons(host, model, true);
  assert.deepEqual(btns.map((b) => [b.getAttribute('data-sel-action'), b.hidden, b.getAttribute('aria-disabled'), b.getAttribute('data-sel-note')]), [
    ['summary', false, 'true', 'sum.off'], ['readFrom', false, null, ''], ['remember', false, null, ''], ['lookup', true, null, 'links.none']
  ], '★ 칸마다 제 모델');
  assert.equal(anno.hidden, false, '필기 줄은 건드리지 않는다');
  assert.equal(anno.getAttribute('aria-disabled'), null);
  assert.equal(anno.getAttribute('data-sel-note'), null);
});

/* ══ S1 정적 ═══════════════════════════════════════════════ */

test('S1 정적 — innerHTML 0 · import 방향 · 마크업 · CSS 48px·논리 속성 · i18n 4언어 · 서재·main 배선 · import map · 판본 무변', () => {
  const n = strip(read('../js/ui/notes.js'));
  assert.doesNotMatch(n, /innerHTML|outerHTML|insertAdjacentHTML|\bconfirm\(|document\.write/);
  const imp = [...n.matchAll(/^import [^;]* from '([^']+)';/gm)].map((m) => m[1]);
  for (const p of imp) assert.doesNotMatch(p, /\/ai\/|pipeline|backup/, p);
  assert.ok(!/\bfetch\(|pipeline|aiCache|privacy\/keys/.test(n), '★ 호출 0 · 캐시·키를 읽지 않는다');
  assert.match(n, /q\.setAttribute\('dir', 'ltr'\);/, '인용 dir=ltr');
  assert.match(n, /n\.setAttribute\('dir', 'auto'\);/, '메모 dir=auto');
  assert.match(n, /new Blob\(\[text\], \{ type: 'text\/markdown;charset=utf-8' \}\)/);
  assert.match(n, /URL\.revokeObjectURL\(url\)/);
  // 마크업
  const html = read('../index.html');
  const sec = html.slice(html.indexOf('data-screen="notes"'), html.indexOf('<!-- ════ 학습 계획'));
  assert.equal((sec.match(/data-nf="color"/g) || []).length, 5, '색 넷 + 색 없는 메모');
  assert.match(sec, /data-nf="memo"/);
  assert.match(sec, /data-nf="lost"/);
  assert.match(sec, /<textarea id="notesMemoText" dir="auto" rows="4" maxlength="2000"/);
  assert.match(sec, /<p class="notes-memo-quote" id="notesMemoQuote" dir="ltr"><\/p>/);
  assert.match(sec, /data-i18n="notes\.export\.share"/);
  assert.match(sec, /<dialog class="confirm-dialog" id="notesDelDialog"/);
  assert.match(html, /<a class="pn-all" id="pnAll" href="#\/notes" data-i18n="anno\.page\.all" hidden><\/a>/);
  assert.match(html, /"\.\/js\/ui\/notes\.js": "\.\/js\/ui\/notes\.js\?v=[0-9a-f]{10}"/, 'import map 도장');
  // CSS — 48px · 논리 속성만
  const css = read('../css/screens.css');
  const block = css.slice(css.indexOf('/* ── `[20-3 — spec 17-16 6]` 필기 화면'));
  assert.ok(block.length > 800);
  assert.ok(!/(?<![-\w])(left|right|top|bottom|margin-left|margin-right|padding-left|padding-right|width|height)\s*:/.test(block), '논리 속성만');
  for (const sel of ['.notes-chip', '.notes-item', '.notes-btn', '.page-notes .pn-all']) {
    assert.match(block, new RegExp(sel.replace(/\./g, '\\.').replace(/ /g, ' ') + ' \\{[^}]*min-block-size: var\\(--tap\\);'), sel);
  }
  // i18n — 4언어 같은 키
  const keys = Object.keys(BUNDLES.en).filter((k) => k.startsWith('notes.')).concat(['anno.page.all', 'library.card.notes', 'library.card.deleteConfirmNotes', 'library.import.reattached']);
  assert.ok(keys.length >= 34, String(keys.length));
  for (const l of LANGS) for (const k of keys) assert.ok(typeof BUNDLES[l][k] === 'string' && BUNDLES[l][k].length > 0, l + ' ' + k);
  for (const l of LANGS) assert.match(BUNDLES[l]['library.card.deleteConfirmNotes'], /\{n\}/);
  // main 배선
  const main = strip(read('../js/main.js'));
  assert.match(main, /initNotes\(\);/);
  assert.match(main, /if \(route\.name !== 'notes'\) leaveNotes\(\);/);
  assert.match(main, /case 'notes': showNotes\(route\.params\); break;/);
  // 판본 무변
  assert.equal(db.DB_VERSION, 3);
  assert.equal(ANNO.QUOTE_MAX, 400);
  assert.equal(ANNO.NOTE_MAX, 2000);
});
