/* ============================================================
   tests/search-db-8g.test.mjs — 8g-1 데이터 (spec 17-8-12 §7 · §8) — fixtures/fake-idb 로 db.js 를 그대로 돌린다

   S4  DB 2 → 3: searchText(인덱스 docId·docId_sk)만 생기고 다른 스토어 레코드 불변 · 멱등 ·
       deleteDocument·resetDerived 가 searchText 를 지우고 documents.outline·pageLabels 는 남긴다 · DB_VERSION ≥ 3
   S5  한 트랜잭션: searchText 쓰기가 던지면 그 쪽 pages 도 없고 failed 에 든다 · 정상이면 둘 다 · sk ·
       역할 재계산도 둘을 함께
   S6  (Node 몫) versionchange — db.js 가 이벤트를 내고 연결을 닫아 새 판이 막히지 않는다 · main.js 배너 배선 ·
       err.dbUpgraded 네 언어. 실제 두 탭은 headless 브라우저로 따로 본다(보고서). `[8g-2]` 새 판 열기에 2초 상한.
   S5b `[8g-2 — 8g-1 Review 보강 ①]` SEARCH.ENABLED=false 갈래를 행동으로(js/ 사본의 스위치를 끈다)

   8g-2 엔진(`search/engine.js`)
   S8  규칙 표를 searchDoc 으로(경계값 — 8g-1 Review 보강 ②)
   S9  백필: 빠진 쪽만 pages.get · 경첩(sk) · 옛 algoVersion 제외 · 묶음·진행·onPartial
   S10 부분 추출 · S11 상한 1,000·truncated·세대 취소 · S12 묶음·순서(서재 범위 포함) · S13 notePage·invalidate·배선

   ★ 이 파일은 S6 이 DB 를 시험용 4 로 올린 뒤에는 db.js 가 열리지 않는다 — DB 를 쓰는 테스트는 S6 앞에 둔다.
   fake-idb 는 복합 키 한 칸이 undefined 여도 받아 준다(실제 IndexedDB 는 DataError) — 백필 레코드의 키 칸을 따로 본다.

   픽스처 글자는 지어낸 것이다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
const idb = installFakeIdb();

const db = await import('../js/db.js');
const { Extractor, normalizeExtraction, ALGO_VERSION, DERIVED_HASH, writePageAndSearch } = await import('../js/pdf/extract.js');
const { SEARCH } = await import('../js/config.js');
const { fromStored } = await import('../js/text/store.js');
const { describePage, flowParasOf, joinPieces } = await import('../js/text/screen.js');
const BUNDLES = {
  ko: (await import('../js/i18n/ko.js')).default, en: (await import('../js/i18n/en.js')).default,
  ar: (await import('../js/i18n/ar.js')).default, fr: (await import('../js/i18n/fr.js')).default
};
const { ERROR_KEYS, errorKey } = await import('../js/i18n/index.js');
const engine = await import('../js/search/engine.js');
const { searchRecordOf, searchKey, SEARCH_KEY, parseQuery } = await import('../js/text/search.js');
const { derivedHash } = await import('../js/text/store.js');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const all = (store) => idb.dump('medreader', store);
const screenText = (rec) => flowParasOf(describePage(fromStored(rec))).map((p) => joinPieces(p.lines).text).join('\n');

/* ── 옛 판(버전 2) DB 를 손으로 — 그때의 스키마 = 지금 표에서 searchText 를 뺀 것 ── */
const V2_SCHEMA = db.SCHEMA_V1.filter((s) => s.name !== 'searchText');

function rawOpen(version, onUpgrade) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('medreader', version);
    req.onupgradeneeded = () => { if (onUpgrade) onUpgrade(req.result); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function rawPutAll(h, store, values) {
  return new Promise((resolve, reject) => {
    const tx = h.transaction([store], 'readwrite');
    const s = tx.objectStore(store);
    for (const v of values) s.put(v);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}

const SEED = {
  documents: [
    { id: 'A', title: 'Book A', fileHash: 'h-A', lastOpenedAt: 2, lastPage: 7, lastLineId: 'p7-l3', lang: 'en',
      outline: [{ t: 'Chapter 1', p: 3, d: 1 }], pageLabels: ['i', 'ii', '1'], extraction: { done: true, algoVersion: ALGO_VERSION } },
    { id: 'B', title: 'Book B', fileHash: 'h-B', lastOpenedAt: 3, lastPage: 1 }
  ],
  blobs: [{ docId: 'A', blob: 'pdf-bytes' }],
  pages: [1, 2, 3].map((n) => ({ docId: 'A', pageNo: n, algoVersion: ALGO_VERSION, lines: [] }))
    .concat([{ docId: 'B', pageNo: 1, algoVersion: ALGO_VERSION, lines: [] }]),
  progress: [{ docId: 'A', sectionId: 'sec-I', updatedAt: 1 }],
  aiCache: [{ key: 'k1', docId: 'A', createdAt: 1, kind: 'readalong', value: 'نص مترجم' }],
  settings: [{ key: 'ui.lang', value: 'ar' }, { key: 'onboarding.done', value: true }],
  cards: [{ id: 'c1', docId: 'A', dueAt: 1, term: 'zorvat' }]
};

/* ══ S4 DB 2 → 3 ══════════════════════════════════════ */

test('S4 ★ DB_VERSION ≥ 3 — 되돌릴 때도 내리지 않는다(내리면 이미 3 으로 연 기기가 VersionError)', () => {
  assert.ok(db.DB_VERSION >= 3, 'DB_VERSION=' + db.DB_VERSION);
  assert.equal(typeof db.MIGRATIONS[3], 'function');
  const st = db.SCHEMA_V1.find((s) => s.name === 'searchText');
  assert.ok(st, '스키마 표에 searchText');
  assert.deepEqual(st.keyPath, ['docId', 'pageNo']);
  assert.deepEqual(st.indexes.map((i) => [i.name, i.keyPath]), [['docId', 'docId'], ['docId_sk', ['docId', 'sk']]]);
  assert.ok(db.DERIVED_STORES.includes('searchText'), 'DERIVED_STORES');
  const src = read('../js/db.js');
  const cascade = src.slice(src.indexOf('const CASCADE_STORES'), src.indexOf(']);', src.indexOf('const CASCADE_STORES')));
  assert.match(cascade, /'searchText'/, 'CASCADE_STORES');
});

test('S4 ★ 데이터가 있는 버전 2 DB 를 3 으로 열면 searchText 만 생기고 다른 스토어 레코드는 그대로다 · 다시 열어도 같다', async () => {
  const h = await rawOpen(2, (hh) => {
    for (const s of V2_SCHEMA) {
      const st = hh.createObjectStore(s.name, { keyPath: s.keyPath });
      for (const ix of s.indexes) st.createIndex(ix.name, ix.keyPath, { unique: !!ix.unique });
    }
  });
  for (const [store, values] of Object.entries(SEED)) await rawPutAll(h, store, values);
  h.close();
  const d = idb.dbs.get('medreader');
  assert.equal(d.version, 2);
  assert.equal(d.stores.has('searchText'), false, '전제: v2 에는 없다');
  const before = {};
  for (const s of V2_SCHEMA) before[s.name] = all(s.name);
  const metaBefore = {};
  for (const s of V2_SCHEMA) metaBefore[s.name] = [...d.stores.get(s.name).meta.indexes.keys()].sort();

  await db.openDb();
  assert.equal(d.version, 3);
  assert.ok(d.stores.has('searchText'));
  const ix = d.stores.get('searchText').meta.indexes;
  assert.deepEqual([...ix.keys()].sort(), ['docId', 'docId_sk']);
  assert.deepEqual(ix.get('docId_sk').keyPath, ['docId', 'sk']);
  assert.deepEqual(d.stores.get('searchText').meta.keyPath, ['docId', 'pageNo']);
  for (const s of V2_SCHEMA) {
    assert.deepEqual(all(s.name), before[s.name], s.name + ' 레코드가 바뀌었다');
    assert.deepEqual([...d.stores.get(s.name).meta.indexes.keys()].sort(), metaBefore[s.name], s.name + ' 인덱스가 바뀌었다');
  }
  assert.equal(all('searchText').length, 0);

  // 두 번 열어도 같다(같은 버전 — 업그레이드 없음) · MIGRATIONS[3] 을 다시 불러도 아무것도 만들지 않는다
  db.closeDb();
  await db.openDb();
  assert.equal(d.version, 3);
  let creates = 0;
  const handle = { objectStoreNames: { contains: (n) => d.stores.has(n) }, createObjectStore: () => { creates++; } };
  const vtx = { objectStore: (n) => ({ indexNames: { contains: (x) => d.stores.get(n).meta.indexes.has(x) }, createIndex: () => { creates++; } }) };
  db.MIGRATIONS[3](handle, vtx);
  db.MIGRATIONS[3](handle, vtx);
  assert.equal(creates, 0, '멱등 — 이미 있으면 만들지 않는다');
  for (const s of V2_SCHEMA) assert.deepEqual(all(s.name), before[s.name], s.name);
});

test('S4 옛 판 모듈(버전 2)로 3 인 DB 를 열면 VersionError — 버전을 내리면 부팅이 막힌다', async () => {
  await assert.rejects(rawOpen(2), (e) => e && e.name === 'VersionError');
});

test('S4 ★ deleteDocument 뒤 그 문서의 searchText 0 · resetDerived 뒤 searchText 0 이고 outline·pageLabels 는 남는다', async () => {
  const st = (doc, n) => ({ docId: doc, pageNo: n, sk: '1|x', algoVersion: ALGO_VERSION, text: 'zorvat ' + n, table: '', heads: [] });
  await db.putAll('searchText', [st('A', 1), st('A', 2), st('A', 3), st('B', 1)]);
  const r = await db.resetDerived('A');
  assert.equal(r.reset, true);
  assert.equal(r.counts.searchText, 3);
  assert.deepEqual(all('searchText').map((x) => x.docId), ['B']);
  const a = idb.peek('medreader', 'documents', 'A');
  assert.deepEqual(a.outline, SEED.documents[0].outline, 'outline 은 PDF 에서 온 것 — 남는다');
  assert.deepEqual(a.pageLabels, SEED.documents[0].pageLabels, 'pageLabels 도 남는다');
  assert.equal(a.lastPage, 7, '진행 위치');
  assert.equal(all('aiCache').length, 1, '번역 캐시');

  await db.putAll('searchText', [st('A', 1), st('A', 2)]);
  const c = await db.deleteDocument('A');
  assert.equal(c.searchText, 2);
  assert.deepEqual(all('searchText').map((x) => x.docId), ['B']);
  assert.equal(idb.peek('medreader', 'documents', 'A'), undefined);
});

/* ══ S5 한 트랜잭션 ═══════════════════════════════════ */

const SYN = JSON.parse(read('./fixtures/synth-2col.json'));
function fakePdf() {
  const calls = { getPage: 0 };
  return {
    calls: calls,
    getPage: async (n) => {
      calls.getPage++;
      return {
        view: [0, 0, SYN.width, SYN.height],
        getViewport: () => ({ width: SYN.width, height: SYN.height }),
        getTextContent: async () => ({ items: structuredClone(SYN.items), styles: SYN.styles }),
        cleanup() {}
      };
    },
    cleanup: async () => {}
  };
}

/** TxStore.prototype 를 잡아 searchText 쓰기를 **요청 단계에서** 실패시킨다(직렬화·쿼터 실패와 같은 모양). */
async function txStoreProto() {
  const h = await db.openDb();
  return Object.getPrototypeOf(h.transaction(['pages'], 'readonly').objectStore('pages'));
}

test('S5 ★ 정상 — pages 와 searchText 가 함께 있고 sk = SEARCH.VERSION|DERIVED_HASH · text = 그 저장본의 화면 글자', async () => {
  const ex = new Extractor({ docId: 'X', pdfDoc: fakePdf(), pageCount: 3 });
  const { rec } = await ex._buildAndStore(2, 1);
  const p = idb.peek('medreader', 'pages', ['X', 2]);
  const s = idb.peek('medreader', 'searchText', ['X', 2]);
  assert.ok(p && s, '둘 다 있다');
  assert.equal(s.docId, 'X');
  assert.equal(s.pageNo, 2);
  assert.equal(s.sk, SEARCH.VERSION + '|' + DERIVED_HASH);
  assert.equal(s.algoVersion, ALGO_VERSION);
  assert.equal(s.text, screenText(p));
  assert.ok(s.text.length > 200, '2단 픽스처 글자');
  assert.deepEqual(Object.keys(s), ['docId', 'pageNo', 'sk', 'algoVersion', 'text', 'table', 'heads']);
  assert.deepEqual(p, rec, 'pages 레코드는 만든 그대로');
});

test('S5 ★ 실패 주입 — searchText 쓰기가 던지면 그 쪽 pages 도 없고 failed 에 든다(한 트랜잭션)', async () => {
  const proto = await txStoreProto();
  const orig = proto.put;
  proto.put = function (value, key) {
    if (this.name === 'searchText') return this.tx._request(() => { throw new Error('injected searchText failure'); });
    return orig.call(this, value, key);
  };
  try {
    const ex = new Extractor({ docId: 'Y', pdfDoc: fakePdf(), pageCount: 1 });
    ex.ex = normalizeExtraction({ status: 'paused', cursor: 1, algoVersion: ALGO_VERSION, derivedHash: DERIVED_HASH });
    const errs = [];
    ex.addEventListener('pageerror', (e) => errs.push(e.detail));
    const end = new Promise((r) => { ex.addEventListener('stalled', () => r('stalled')); ex.addEventListener('done', () => r('done')); });
    await ex.start();
    const how = await Promise.race([end, sleep(5000).then(() => 'timeout')]);
    assert.equal(how, 'stalled');
    assert.equal(idb.peek('medreader', 'pages', ['Y', 1]), undefined, '★ pages 도 쓰이지 않았다');
    assert.equal(idb.peek('medreader', 'searchText', ['Y', 1]), undefined);
    assert.deepEqual(ex.ex.failed, [1]);
    assert.ok(errs.length >= 1 && /injected/.test(errs[0].message));
    assert.equal(ex.stored.has(1), false);
  } finally {
    proto.put = orig;
  }
});

test('S5 ★ 역할 재계산(_recomputeRoles)도 pages 와 searchText 를 함께 다시 쓴다', async () => {
  const ex = new Extractor({ docId: 'Z', pdfDoc: fakePdf(), pageCount: 3 });
  await ex._buildAndStore(1, 1);
  ex.stored.add(1);
  // 검색 글자를 옛 것으로 바꿔 둔다
  await db.put('searchText', Object.assign(idb.peek('medreader', 'searchText', ['Z', 1]), { text: 'stale', sk: 'old' }));
  await ex._recomputeRoles(1);
  const p = idb.peek('medreader', 'pages', ['Z', 1]);
  const s = idb.peek('medreader', 'searchText', ['Z', 1]);
  assert.equal(p.roleVersion, 2);
  assert.equal(s.text, screenText(p));
  assert.equal(s.sk, SEARCH.VERSION + '|' + DERIVED_HASH);
});

test('S5 writePageAndSearch 는 두 스토어를 한 withTx 로 연다(소스) · SEARCH.ENABLED 스위치를 본다', () => {
  const src = read('../js/pdf/extract.js');
  const fn = src.slice(src.indexOf('export function writePageAndSearch('), src.indexOf('export class Extractor'));
  assert.match(fn, /db\.withTx\(\['pages', 'searchText'\], 'readwrite'/);
  assert.match(fn, /SEARCH\.ENABLED/);
  assert.doesNotMatch(fn, /db\.put\(/, '따로 쓰기(db.put)가 없다');
  const bs = src.slice(src.indexOf('async _buildAndStore('), src.indexOf('async _processPage('));
  assert.match(bs, /await writePageAndSearch\(this\.docId, pageNo, rec\)/);
  assert.doesNotMatch(bs, /db\.put\('pages'/);
  assert.equal(typeof writePageAndSearch, 'function');
});

/* ══ 8g-1 Review 보강 ① — SEARCH.ENABLED=false 갈래를 행동으로 ═══════ */

test('S5b ★ SEARCH.ENABLED=false — 추출은 검색 글자를 만들지 않고 그 쪽 옛 검색 글자를 같은 트랜잭션에서 지운다 · 엔진 백필도 쓰지 않는다 (8g-1 Review 보강 ①)', async () => {
  // config 가 얼어 있어(Object.freeze) 스위치를 바꿀 수 없다 → js/ 를 임시 폴더에 복사하고 그 사본의
  // SEARCH.ENABLED 만 false 로 바꿔 **사본 모듈**을 부른다. 앱 코드의 갈래를 그대로 돈다(변이가 사본에도 들어간다).
  const tmp = mkdtempSync(join(tmpdir(), 'mr-search-off-'));
  try {
    cpSync(fileURLToPath(new URL('../js/', import.meta.url)), join(tmp, 'js'), { recursive: true });
    const cfgPath = join(tmp, 'js', 'config.js');
    const cfg = readFileSync(cfgPath, 'utf8');
    const re = /(export const SEARCH = Object\.freeze\(\{[\s\S]*?)ENABLED: true,/;
    assert.match(cfg, re, '전제: SEARCH 블록의 ENABLED: true');
    writeFileSync(cfgPath, cfg.replace(re, '$1ENABLED: false,'));
    const url = (rel) => pathToFileURL(join(tmp, 'js', rel)).href;
    const offCfg = await import(url('config.js'));
    assert.equal(offCfg.SEARCH.ENABLED, false, '전제: 사본은 꺼져 있다');
    assert.equal(SEARCH.ENABLED, true, '전제: 앱은 켜져 있다');
    const off = await import(url('pdf/extract.js'));
    const offEngine = await import(url('search/engine.js'));

    // 켜진 판으로 한 쪽을 써 두면 둘 다 있다
    const ex = new Extractor({ docId: 'OFF', pdfDoc: fakePdf(), pageCount: 2 });
    const { rec } = await ex._buildAndStore(1, 1);
    assert.ok(idb.peek('medreader', 'searchText', ['OFF', 1]), '전제: 옛 검색 글자');
    const otherBefore = (await ex._buildAndStore(2, 1), idb.peek('medreader', 'searchText', ['OFF', 2]));

    // 꺼진 판의 쓰기 — pages 는 새 것, 그 쪽 검색 글자는 없다(지웠다), 다른 쪽은 그대로
    const next = Object.assign({}, rec, { roleVersion: 7 });
    await off.writePageAndSearch('OFF', 1, next);
    assert.equal(idb.peek('medreader', 'pages', ['OFF', 1]).roleVersion, 7, 'pages 는 썼다');
    assert.equal(idb.peek('medreader', 'searchText', ['OFF', 1]), undefined, '★ 그 쪽 옛 검색 글자를 지웠다');
    assert.deepEqual(idb.peek('medreader', 'searchText', ['OFF', 2]), otherBefore, '다른 쪽은 건드리지 않는다');

    // 꺼진 판의 엔진은 백필하지 않는다(쓰기 0) — 켜진 판은 그 쪽을 다시 만든다
    const r0 = await offEngine.backfill('OFF');
    assert.deepEqual(r0, { total: 0, done: 0, written: 0, failed: 0 });
    assert.equal(idb.peek('medreader', 'searchText', ['OFF', 1]), undefined);
    const r1 = await engine.backfill('OFF');
    assert.equal(r1.written, 1);
    assert.equal(idb.peek('medreader', 'searchText', ['OFF', 1]).text, screenText(next));
    offEngine.invalidate();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

/* ══ 8g-2 엔진 — 픽스처(지어낸 글) ═════════════════════════ */

let ELID = 0;
function eline(text, o) {
  const p = o || {};
  return {
    id: 'e' + (++ELID), text: text, bbox: [0, 0, 100, 10], baseline: 0, fontSize: p.fs == null ? 10 : p.fs,
    col: 0, role: p.role || 'body', hyphenJoin: false, paraId: p.para == null ? null : p.para,
    regionId: p.region == null ? null : p.region, runs: []
  };
}
/** 저장본 한 쪽. paras: [{kind?, text | lines:[...], fs?}], o.table: 4-8 표 영역 줄 글자, o.algo. */
function epage(docId, pageNo, paras, o) {
  const opt = o || {};
  const lines = [];
  const ps = [];
  paras.forEach((p, i) => {
    const pid = 'p' + pageNo + '-' + i;
    const ids = (p.lines || [p.text]).map((t) => { const l = eline(t, { para: pid, fs: p.fs }); lines.push(l); return l.id; });
    ps.push({ id: pid, lineIds: ids, kind: p.kind || 'body', bbox: [0, 0, 1, 1], continuesNext: false, continuesPrev: false });
  });
  const regions = [];
  if (opt.table && opt.table.length) {
    const ids = opt.table.map((t) => { const l = eline(t, { region: 'g' + pageNo, role: 'table' }); lines.push(l); return l.id; });
    regions.push({ id: 'g' + pageNo, kind: 'table', bbox: [0, 0, 1, 1], lineIds: ids, pageNo: pageNo });
  }
  return {
    docId: docId, pageNo: pageNo, width: 600, height: 800, algoVersion: opt.algo == null ? ALGO_VERSION : opt.algo,
    storeVersion: 1, derivedHash: derivedHash(), lines: lines, paragraphs: ps, regions: regions,
    columns: { count: 1, gutters: [] },
    stats: { medianFontSize: 10, medianLeading: 12, bodyLeft: [], warn: null, widthFixed: 0 }, roleVersion: 1
  };
}
/** 추출(`writePageAndSearch`)이 쓰는 검색 레코드와 같은 식. */
const stOf = (rec) => Object.assign({ docId: rec.docId }, searchRecordOf(fromStored(rec)));
async function seedDoc(id, pageCount, lastOpenedAt) {
  await db.put('documents', { id: id, title: 'Doc ' + id, fileHash: 'h-' + id, pageCount: pageCount, lastOpenedAt: lastOpenedAt || 1 });
}
async function seedPages(recs, withSearch) {
  await db.putAll('pages', recs);
  if (withSearch) await db.putAll('searchText', recs.map(stOf));
}
const pagesGetsSince = (from) => idb.log.slice(from).filter((x) => x.op === 'get' && x.store === 'pages').length;
const pagesOf = (r) => [...new Set(r.hits.map((h) => h.pageNo))];

/* ══ S8 (엔진 몫) — 규칙 표를 searchDoc 으로 ══════════════════ */

test('S8 ★ 엔진도 같은 규칙 — MI·mi·metform·beta blocker 세 꼴·pre-eclampsia 세 꼴·pseudohypo… 이름표·betablocker·길이 오류·메타 문자·경계값', async () => {
  const D = 'Q8';
  await seedDoc(D, 3);
  await seedPages([
    epage(D, 1, [{ text: 'Acute MI. After (MI) the mild mi and MIS, migraine.' }]),
    epage(D, 2, [{ text: 'Start metformin; β-blocker; beta blocker; Beta-Blockers. Severe preeclampsia. Mild pre-eclampsia. Late pre eclampsia.' },
      { text: 'x (a+b)*[ y. the there other. copd5 COPD5 COPD5X abcdefgh ABCDEF.' }]),
    epage(D, 3, [{ kind: 'rowhead', lines: ['Plonitis & Pseudo-', 'hypoplonitis'] }, { text: 'quilar beta-blocker basto' }])
  ], true);
  const n = async (q) => (await engine.searchDoc(D, q)).hits.length;
  assert.equal(await n('MI'), 2, 'MI — 대소문자·낱말 전체');
  assert.equal(await n('mi'), 3, 'mi — 낱말 전체(mild·migraine·MIS 아님)');
  assert.equal(await n('metform'), 1);
  for (const q of ['beta blocker', 'beta-blocker', 'β-blocker']) assert.equal(await n(q), 4, q);
  for (const q of ['pre-eclampsia', 'preeclampsia', 'pre eclampsia']) assert.equal(await n(q), 3, q);
  assert.deepEqual(pagesOf(await engine.searchDoc(D, 'pseudohypoplonitis')), [3], '이름표의 Pseudo-hypo…');
  assert.equal(await n('betablocker'), 0);
  assert.equal((await engine.searchDoc(D, 'a')).error, 'ERR_SEARCH_SHORT');
  assert.equal((await engine.searchDoc(D, 'x'.repeat(61))).error, 'ERR_SEARCH_LONG');
  assert.equal(await n('(a+b)*['), 1, '정규식 메타 문자는 글자 그대로');
  // 경계값(8g-1 Review 보강 ②) — 3자는 낱말 전체, 4자는 접두 · 대문자 약어 5자까지 대소문자 구분
  assert.equal(await n('the'), 2, 'the 는 1쪽·2쪽의 the 뿐 — there·other 를 안 찾는다');
  assert.equal(await n('ther'), 1, 'ther 는 there 를 찾는다(접두)');
  assert.equal(await n('COPD5'), 1, '5자 대문자 — 대소문자 구분 + 낱말 전체');
  assert.equal(await n('ABCDEF'), 2, '6자 대문자 — 약어 규칙 밖(대소문자 무시 + 접두)');
  // len 은 맞은 변형의 길이(β 1 · beta 4)
  const r = await engine.searchDoc(D, 'beta blocker');
  const p2 = r.hits.filter((h) => h.pageNo === 2).map((h) => h.len);
  assert.deepEqual(p2, ['β-blocker'.length, 'beta blocker'.length, 'Beta-Blocker'.length]);
});

/* ══ S9 백필 ═════════════════════════════════════════════ */

test('S9 ★ 백필 — 지금 algoVersion pages 10쪽 중 6쪽만 searchText 면 pages.get 정확히 4회 · 추출과 같은 레코드 · 옛 algoVersion 쪽은 만들지 않는다(pagesCovered 밖)', async () => {
  const D = 'E9';
  await seedDoc(D, 13);
  const cur = [];
  for (let n = 1; n <= 10; n++) cur.push(epage(D, n, [{ text: 'Zorvat backfill page ' + n + ' mekil.' }]));
  await db.putAll('pages', cur);
  await db.putAll('searchText', cur.filter((r) => [1, 2, 4, 6, 8, 10].includes(r.pageNo)).map(stOf));
  const old = [11, 12, 13].map((n) => epage(D, n, [{ text: 'Zorvat old algo page ' + n }], { algo: ALGO_VERSION - 1 }));
  await db.putAll('pages', old);

  const from = idb.log.length;
  const prog = [];
  const r = await engine.backfill(D, { onProgress: (p) => prog.push(p.done + '/' + p.total) });
  assert.equal(pagesGetsSince(from), 4, '★ pages.get 정확히 4회');
  assert.deepEqual(r, { total: 4, done: 4, written: 4, failed: 0 });
  assert.deepEqual(prog, ['0/4', '4/4']);
  for (const rec of cur) {
    const s = idb.peek('medreader', 'searchText', [D, rec.pageNo]);
    assert.ok(s, '쪽 ' + rec.pageNo);
    // 키 칸이 비지 않았다(fake-idb 는 [docId, undefined] 를 받아 준다 — 실제 IndexedDB 는 DataError)
    assert.equal(s.docId, D);
    assert.equal(s.pageNo, rec.pageNo);
    assert.equal(s.sk, SEARCH_KEY);
    assert.equal(JSON.stringify(s), JSON.stringify(stOf(rec)), '추출이 쓰는 레코드와 같다(필드 순서까지)');
  }
  for (const n of [11, 12, 13]) assert.equal(idb.peek('medreader', 'searchText', [D, n]), undefined, '옛 algoVersion ' + n);
  assert.equal(all('searchText').filter((s) => s.docId === D).length, 10);

  // 두 번째는 할 일이 없다(키만 본다 — pages.get 0)
  const from2 = idb.log.length;
  assert.deepEqual(await engine.backfill(D), { total: 0, done: 0, written: 0, failed: 0 });
  assert.equal(pagesGetsSince(from2), 0);

  const s = await engine.searchDoc(D, 'zorvat');
  assert.equal(s.pagesCovered, 10, '옛 algoVersion 쪽은 덮지 않는다');
  assert.equal(s.pageCount, 13);
  assert.deepEqual(pagesOf(s), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('S9 ★ 경첩 — SEARCH.VERSION 이 오르거나 DERIVED_HASH 가 바뀌면(sk 가 다르면) 10쪽 모두 다시 만든다 · 옛 글자는 찾지 않는다', async () => {
  for (const [D, staleSk] of [['V9', searchKey(SEARCH.VERSION + 1, derivedHash())], ['H9', searchKey(SEARCH.VERSION, 'd1:00000000')]]) {
    assert.notEqual(staleSk, SEARCH_KEY, '전제: 다른 경첩 ' + staleSk);
    await seedDoc(D, 10);
    const recs = [];
    for (let n = 1; n <= 10; n++) recs.push(epage(D, n, [{ text: 'Freshword hinge page ' + n }]));
    await db.putAll('pages', recs);
    await db.putAll('searchText', recs.map((rec) => Object.assign(stOf(rec), { sk: staleSk, text: 'Staleword ' + rec.pageNo })));
    const from = idb.log.length;
    const r = await engine.searchDoc(D, 'freshword');
    assert.equal(pagesGetsSince(from), 10, D + ' ★ 10쪽 다시');
    assert.equal(r.hits.length, 10, D);
    assert.equal((await engine.searchDoc(D, 'staleword')).hits.length, 0, D + ' 옛 글자');
    for (const rec of recs) assert.equal(idb.peek('medreader', 'searchText', [D, rec.pageNo]).sk, SEARCH_KEY);
  }
});

test('S9 백필은 BACKFILL_BATCH 쪽씩 · 진행 알림 · 백필 중에도 이미 있는 쪽을 먼저 보낸다(onPartial)', async () => {
  const D = 'B9';
  const N = SEARCH.BACKFILL_BATCH * 2 + 40;
  await seedDoc(D, N);
  const recs = [];
  for (let n = 1; n <= N; n++) recs.push(epage(D, n, [{ text: 'Zorvat batch page ' + n }]));
  await db.putAll('pages', recs);
  await db.putAll('searchText', recs.slice(0, 20).map(stOf));
  const prog = [];
  const parts = [];
  const r = await engine.searchDoc(D, 'zorvat', { onProgress: (p) => prog.push(p.done), onPartial: (x) => parts.push(x) });
  const M = N - 20;
  assert.deepEqual(prog, [0, SEARCH.BACKFILL_BATCH, SEARCH.BACKFILL_BATCH * 2, M]);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].partial, true);
  assert.equal(parts[0].pagesCovered, 20);
  assert.deepEqual(parts[0].preparing, { done: 0, total: M });
  assert.equal(parts[0].hits.length, 20);
  assert.equal(r.pagesCovered, N);
  assert.equal(r.hits.length, N);
  assert.equal(r.partial, undefined);
  assert.equal(engine.cacheInfo().backfilled, true);
});

/* ══ S10 부분 추출 ═══════════════════════════════════════ */

test('S10 ★ 부분 추출 — 1,000쪽 중 300쪽만 있으면 pagesCovered 300 · 결과는 그 쪽들에서만', async () => {
  const D = 'P10';
  await seedDoc(D, 1000);
  const have = [];
  for (let n = 1; n <= 1000 && have.length < 300; n += 3) have.push(n);
  await seedPages(have.map((n) => epage(D, n, [{ text: 'Plonitis partial ' + n }])), true);
  const r = await engine.searchDoc(D, 'plonitis');
  assert.equal(r.pagesCovered, 300);
  assert.equal(r.pageCount, 1000);
  assert.deepEqual(pagesOf(r), have);
  assert.equal(r.truncated, false);
});

/* ══ S11 상한·세대 취소 ══════════════════════════════════ */

test('S11 ★ 상한 1,000 — 쪽 순서로 채우고 넘으면 truncated · 정확히 1,000 이면 아니다 · 표 글자도 센다', async () => {
  const words = (k, w) => Array(k).fill(w).join(' ');
  await seedDoc('T11', 3);
  await seedPages([1, 2, 3].map((n) => epage('T11', n, [{ text: words(400, 'plon') }])), true);
  const r = await engine.searchDoc('T11', 'plon');
  assert.equal(r.hits.length, SEARCH.MAX_HITS_PER_DOC);
  assert.equal(r.truncated, true);
  assert.deepEqual([1, 2, 3].map((p) => r.hits.filter((h) => h.pageNo === p).length), [400, 400, 200], '쪽 순서로 채운다');

  await seedDoc('U11', 2);
  await seedPages([1, 2].map((n) => epage('U11', n, [{ text: words(500, 'plon') }])), true);
  const u = await engine.searchDoc('U11', 'plon');
  assert.equal(u.hits.length, 1000);
  assert.equal(u.truncated, false, '정확히 1,000 — 넘지 않았다');

  // 본문으로 1,000 을 채운 뒤 같은 쪽 표에 하나 더 → truncated
  await seedDoc('W11', 2);
  await seedPages([epage('W11', 1, [{ text: words(500, 'plon') }]), epage('W11', 2, [{ text: words(500, 'plon') }], { table: ['plon 5 mg'] })], true);
  const w = await engine.searchDoc('W11', 'plon');
  assert.equal(w.hits.length, 1000);
  assert.equal(w.truncated, true);
  assert.equal(w.hits.some((h) => h.kind === 'table'), false);
  // maxHits 를 풀면 끝까지
  const all1 = await engine.searchDoc('W11', 'plon', { maxHits: Infinity });
  assert.equal(all1.hits.length, 1001);
  assert.equal(all1.truncated, false);
});

test('S11 ★ 세대 취소 — 첫 검색이 끝나기 전에 둘째를 시작하면 첫 결과는 onPartial·반환 모두 버려진다', async () => {
  const mk = async (D) => {
    await seedDoc(D, 120);
    const recs = [];
    for (let n = 1; n <= 120; n++) recs.push(epage(D, n, [{ text: 'Zorvat gen page ' + n }]));
    await db.putAll('pages', recs);
    await db.putAll('searchText', recs.slice(0, 20).map(stOf));
  };
  await mk('G0');
  await mk('G1');
  // 대조군 — 혼자면 백필 전에 onPartial 이 한 번 나간다(이 경로가 살아 있다)
  const p0 = [];
  const r0 = await engine.searchDoc('G0', 'zorvat', { onPartial: (x) => p0.push(x) });
  assert.equal(p0.length, 1);
  assert.equal(r0.cancelled, undefined);
  assert.equal(r0.hits.length, 120);

  const p1 = [];
  const p2 = [];
  const a = engine.searchDoc('G1', 'zorvat', { onPartial: (x) => p1.push(x) });
  const b = engine.searchDoc('G1', 'gen page', { onPartial: (x) => p2.push(x) });
  const [r1, r2] = await Promise.all([a, b]);
  assert.equal(r1.cancelled, true, '★ 첫 결과는 버려진다');
  assert.deepEqual(r1.hits, []);
  assert.equal(p1.length, 0, '★ 첫 검색의 onPartial 은 불리지 않는다');
  assert.equal(r2.cancelled, undefined);
  assert.equal(r2.hits.length, 120);
  assert.ok(p2.every((x) => x.partial === true));

  // signal 로 취소
  const ac = new AbortController();
  const c = engine.searchDoc('G1', 'zorvat', { signal: ac.signal });
  ac.abort();
  assert.equal((await c).cancelled, true);
  // 서재 검색도 같은 세대 — 뒤에 온 책 검색이 이긴다
  const libParts = [];
  const L = engine.searchLibrary('zorvat', { onPartial: (x) => libParts.push(x) });
  const d = engine.searchDoc('G1', 'zorvat');
  assert.equal((await L).cancelled, true);
  assert.equal(libParts.length, 0);
  assert.equal((await d).hits.length, 120);
});

/* ══ S12 묶음 ═══════════════════════════════════════════ */

test('S12 ★ 엔진 묶음 — heading=head · 같은 글자 10번 이상인 heading=body · 표=table · rowhead·인용=body · 순서 head→body→table, 묶음 안은 쪽 순서 · 서재 범위(캐시 없음)도 같다', async () => {
  const D = 'K12';
  await seedDoc(D, 14, 1e12);
  const recs = [epage(D, 1, [{ kind: 'heading', text: 'Quilar Zorvatosis', fs: 16 }, { text: 'Body about zorvat here.' }])];
  for (let n = 2; n <= 11; n++) recs.push(epage(D, n, [{ kind: 'heading', text: 'Zorvat Treatment', fs: 13 }, { text: 'Plain text page ' + n }]));
  recs.push(epage(D, 12, [{ kind: 'rowhead', lines: ['Zorvat plonitis'] }, { text: 'Varga T et al. Zorvat Med J. [PMID: 31234560]' }]));
  recs.push(epage(D, 13, [{ text: 'Table follows.' }], { table: ['Zorvat    10 mg', 'Mekil   zorvat-x'] }));
  recs.push(epage(D, 14, [{ kind: 'heading', text: 'Zorvat in children', fs: 14 }]));
  await seedPages(recs, true);
  assert.equal(SEARCH.REPEAT_HEADING, 10, '전제: 반복 heading 10개 = 문턱');
  const r = await engine.searchDoc(D, 'zorvat');
  const seq = r.hits.map((h) => h.kind + '@' + h.pageNo);
  const want = ['head@1', 'head@14', 'body@1'];
  for (let n = 2; n <= 11; n++) want.push('body@' + n);
  want.push('body@12', 'body@12', 'table@13', 'table@13');
  assert.deepEqual(seq, want);
  for (let i = 1; i < r.hits.length; i++) {
    const a = r.hits[i - 1], b = r.hits[i];
    const ka = engine.KIND_ORDER[a.kind], kb = engine.KIND_ORDER[b.kind];
    assert.ok(ka < kb || (ka === kb && (a.pageNo < b.pageNo || (a.pageNo === b.pageNo && a.at < b.at))), '순서 ' + i);
  }
  // 표 적중의 at 은 table 글자 안 오프셋
  const t13 = idb.peek('medreader', 'searchText', [D, 13]).table;
  for (const h of r.hits.filter((x) => x.kind === 'table')) assert.equal(t13.slice(h.at, h.at + h.len).toLowerCase(), 'zorvat');

  // 서재 범위 — 이 책을 캐시하지 않은 채(읽고 버림) 같은 결과
  engine.invalidate(D);
  const parts = [];
  const L = await engine.searchLibrary('zorvat', { onPartial: (x) => parts.push(x.docId) });
  const d = L.docs.find((x) => x.docId === D);
  assert.ok(d);
  assert.deepEqual(d.hits, r.hits, '★ 서재 범위(빈도표를 다 모은 뒤 묶음)도 같다');
  assert.equal(d.pagesCovered, 14);
  assert.equal(L.docs[0].docId, D, '최근에 연 책 먼저');
  assert.deepEqual(parts, L.docs.map((x) => x.docId), '끝난 책부터 onPartial');
  assert.equal(engine.cacheInfo(), null, '서재 범위는 캐시하지 않는다');
  // 캐시된 책은 서재 범위에서 맨 앞
  await engine.searchDoc('G0', 'zorvat');
  const L2 = await engine.searchLibrary('zorvat');
  assert.equal(L2.docs[0].docId, 'G0', '열린 책 먼저');
});

/* ══ S13 캐시 — notePage · invalidate ══════════════════════ */

test('S13 ★ 추출기 page 이벤트(notePage) 뒤 다음 검색이 그 쪽 새 글자를 찾고 옛 글자를 안 찾는다', async () => {
  const D = 'C13';
  await seedDoc(D, 4);
  await seedPages([1, 2, 3].map((n) => epage(D, n, [{ text: 'Oldword trasse page ' + n }])), true);
  assert.deepEqual(pagesOf(await engine.searchDoc(D, 'oldword')), [1, 2, 3]);
  // 2쪽을 추출 경로로 다시 쓴다(pages + searchText 한 트랜잭션)
  await writePageAndSearch(D, 2, epage(D, 2, [{ text: 'Newword trasse page 2' }]));
  assert.equal((await engine.searchDoc(D, 'newword')).hits.length, 0, '전제: 캐시는 옛 글자를 들고 있다');
  engine.notePage(D, 2);
  assert.deepEqual(pagesOf(await engine.searchDoc(D, 'newword')), [2], '★ 새 글자');
  assert.deepEqual(pagesOf(await engine.searchDoc(D, 'oldword')), [1, 3], '★ 옛 글자는 없다');
  // 부분 추출이 자란다 — 새 쪽 · 다른 책의 notePage 는 무시
  await writePageAndSearch(D, 4, epage(D, 4, [{ text: 'Newword four' }]));
  engine.notePage('other-doc', 4);
  assert.deepEqual(pagesOf(await engine.searchDoc(D, 'newword')), [2]);
  engine.notePage(D, 4);
  const r = await engine.searchDoc(D, 'newword');
  assert.deepEqual(pagesOf(r), [2, 4]);
  assert.equal(r.pagesCovered, 4);
  // 없어진 쪽은 빠진다
  await db.del('searchText', [D, 4]);
  engine.notePage(D, 4);
  assert.equal((await engine.searchDoc(D, 'newword')).pagesCovered, 3);
});

test('S13 ★ invalidate(다시 추출) 뒤 캐시가 비고 다음 검색이 다시 채운다', async () => {
  const D = 'C13';
  assert.equal(engine.cacheInfo().docId, D, '전제: 이 책이 캐시돼 있다');
  // 다시 추출 — 파생 데이터를 지우고 새 글자로 다시 쓴다(이벤트 없이)
  await db.resetDerived(D);
  for (const n of [1, 2]) await writePageAndSearch(D, n, epage(D, n, [{ text: 'Freshword again ' + n }]));
  assert.deepEqual(pagesOf(await engine.searchDoc(D, 'oldword')), [1, 3], '전제: 무효화 전에는 캐시가 옛 글자');
  engine.invalidate(D);
  assert.equal(engine.cacheInfo(), null, '★ 캐시가 비었다');
  const r = await engine.searchDoc(D, 'freshword');
  assert.deepEqual(pagesOf(r), [1, 2]);
  assert.equal(r.pagesCovered, 2, '★ 다시 채웠다');
  assert.equal((await engine.searchDoc(D, 'oldword')).hits.length, 0);
  assert.equal(engine.cacheInfo().pages, 2);
});

test('S13 배선 — 실제 Extractor 의 page 이벤트로 캐시가 따라온다 · library.js: page → notePage, reextract·다시 추출·삭제 → invalidate', async () => {
  const D = 'X13';
  await seedDoc(D, 3);
  assert.equal((await engine.searchDoc(D, 'checklists')).pagesCovered, 0, '전제: 빈 책을 캐시');
  const ex = new Extractor({ docId: D, pdfDoc: fakePdf(), pageCount: 3 });
  ex.addEventListener('page', (e) => { engine.notePage(D, e.detail && e.detail.pageNo); });   // library.attach 와 같은 배선
  ex.ex = normalizeExtraction({ status: 'paused', cursor: 1, algoVersion: ALGO_VERSION, derivedHash: DERIVED_HASH });
  const end = new Promise((r) => { ex.addEventListener('done', () => r('done')); ex.addEventListener('stalled', () => r('stalled')); });
  await ex.start();
  assert.equal(await Promise.race([end, sleep(5000).then(() => 'timeout')]), 'done');
  const r = await engine.searchDoc(D, 'checklists');
  assert.equal(r.pagesCovered, 3, '★ 이벤트로 들어온 쪽');
  assert.deepEqual(pagesOf(r), [1, 2, 3]);

  // library.js 소스 — 주석을 빼고 본다
  const lib = read('../js/ui/library.js').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.match(lib, /import \{ notePage as searchNotePage, invalidate as searchInvalidate \} from '\.\.\/search\/engine\.js';/);
  const attach = lib.slice(lib.indexOf('async function attach('), lib.indexOf('function watchLangGuess('));
  assert.match(attach, /ex\.addEventListener\('page', \(e\) => \{ searchNotePage\(doc\.id, e && e\.detail && e\.detail\.pageNo\); \}\);/);
  assert.match(attach, /ex\.addEventListener\('reextract', \(\) => \{ searchInvalidate\(doc\.id\); \}\);/);
  const rx = lib.slice(lib.indexOf('export function reextractDoc'), lib.indexOf('function askReextract'));
  const at = (s) => { const i = rx.indexOf(s); assert.ok(i > 0, s); return i; };
  assert.ok(at('await db.resetDerived(docId)') < at('searchInvalidate(docId)'));
  assert.ok(at('searchInvalidate(docId)') < at('await attach(res.rec, pdfDoc)'));
  const del = lib.slice(lib.indexOf("=== 'delete'"));
  assert.ok(del.indexOf('await db.deleteDocument(docId)') < del.indexOf('searchInvalidate(docId)') && del.indexOf('searchInvalidate(docId)') > 0);
});

test('엔진 계층(3-2) — search/engine.js 는 DOM·window 를 모르고 config·db·text/* 만 import · import map 표에 있다', () => {
  const src = read('../js/search/engine.js').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.doesNotMatch(src, /\b(document|window|localStorage|sessionStorage|fetch|navigator|location)\b/);
  const imports = src.match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || [];
  assert.ok(imports.length >= 4);
  for (const im of imports) assert.match(im, /from\s*['"](\.\.\/config\.js|\.\.\/db\.js|\.\.\/text\/[a-z]+\.js)['"]/, im);
  const html = read('../index.html');
  assert.match(html, /"\.\/js\/search\/engine\.js": "\.\/js\/search\/engine\.js\?v=[0-9a-f]{10}"/);
});

/* ══ S6 (Node 몫) versionchange ═══════════════════════ */

test('S6 ★ 다른 탭이 버전을 올리면 db.js 가 versionchange 를 내고 연결을 닫는다 — 새 판은 막히지 않는다, 이 탭의 다음 열기는 실패', async () => {
  await db.openDb();
  const events = [];
  const off = db.onDbEvent((e) => events.push(e.type));
  let blocked = false;
  // `[8g-2 — 8g-1 Review 보강 ③]` 짧은 시간 상한. 이 탭이 versionchange 에서 연결을 닫지 않으면 새 판 열기가
  // blocked 로 영영 기다린다 — 예전에는 --test-timeout(60초) 취소로만 보였다. 2초 안에 열리지 않으면 바로 실패.
  const OPEN_LIMIT_MS = 2000;
  let limitTimer = null;
  const next = await Promise.race([
    new Promise((resolve, reject) => {
      const req = indexedDB.open('medreader', db.DB_VERSION + 1);   // "새 판 탭"
      req.onupgradeneeded = () => {};
      req.onblocked = () => { blocked = true; };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }),
    new Promise((resolve, reject) => {
      limitTimer = setTimeout(() => reject(new Error('새 판 열기가 ' + OPEN_LIMIT_MS + 'ms 안에 끝나지 않았다 — '
        + 'versionchange 에서 연결을 닫지 않았다(blocked=' + blocked + ')')), OPEN_LIMIT_MS);
    })
  ]).finally(() => clearTimeout(limitTimer));
  assert.equal(blocked, false, '새 판이 막히지 않았다');
  assert.ok(events.includes('versionchange'), 'versionchange 이벤트: ' + events.join(','));
  // 이 탭(옛 판)의 다음 DB 일 — 옛 버전으로 열다 실패한다 → 그래서 배너가 필요하다
  await assert.rejects(db.get('documents', 'B'), (e) => e && e.code === db.ERR.OPEN && e.cause && e.cause.name === 'VersionError');
  next.close();
  off();
});

test('S6 ★ main.js — versionchange 이벤트에 err.dbUpgraded 배너 + [다시 불러오기](location.reload) · 코드 → 키 · 네 언어', () => {
  const src = read('../js/main.js');
  assert.match(src, /e\.type === 'versionchange'\) showBanner\(dbUpgradedBanner\(db\.ERR\.UPGRADED\)\)/);
  const fn = src.slice(src.indexOf('function dbUpgradedBanner('), src.indexOf('\n}\n', src.indexOf('function dbUpgradedBanner(')));
  assert.match(fn, /actions: \[\{ reload: true, key: 'common\.reload' \}\]/);
  const sb = src.slice(src.indexOf('function showBanner('), src.indexOf('function relabelBanners('));
  assert.match(sb, /location\.reload\(\)/);
  assert.equal(db.ERR.UPGRADED, 'ERR_DB_UPGRADED');
  assert.equal(errorKey('ERR_DB_UPGRADED'), 'err.dbUpgraded');
  assert.equal(ERROR_KEYS.ERR_DB_UPGRADED, 'err.dbUpgraded');
  for (const lang of ['ar', 'en', 'fr', 'ko']) {
    for (const k of ['err.dbUpgraded', 'common.reload']) {
      assert.equal(typeof BUNDLES[lang][k], 'string', lang + ' ' + k);
      assert.ok(BUNDLES[lang][k].trim().length > 3, lang + ' ' + k);
    }
  }
  assert.match(BUNDLES.ko['err.dbUpgraded'], /[가-힣]/);
  assert.match(BUNDLES.ar['err.dbUpgraded'], /[؀-ۿ]/);
  assert.notEqual(BUNDLES.fr['err.dbUpgraded'], BUNDLES.en['err.dbUpgraded']);
});

/* ══ settings search.recent (U14) ══════════════════════ */

test('U14 settings — search.recent 기본 [] · search.aiQuery 는 없다', async () => {
  const { DEFAULTS, defaultFor } = await import('../js/settings.js');
  assert.deepEqual(DEFAULTS['search.recent'], []);
  assert.equal(Object.prototype.hasOwnProperty.call(DEFAULTS, 'search.aiQuery'), false);
  const a = defaultFor('search.recent');
  a.push('x');
  assert.deepEqual(DEFAULTS['search.recent'], [], '사본');
  assert.equal(SEARCH.RECENT_MAX, 5);
});
