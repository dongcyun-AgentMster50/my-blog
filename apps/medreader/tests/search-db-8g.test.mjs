/* ============================================================
   tests/search-db-8g.test.mjs — 8g-1 데이터 (spec 17-8-12 §7 · §8) — fixtures/fake-idb 로 db.js 를 그대로 돌린다

   S4  DB 2 → 3: searchText(인덱스 docId·docId_sk)만 생기고 다른 스토어 레코드 불변 · 멱등 ·
       deleteDocument·resetDerived 가 searchText 를 지우고 documents.outline·pageLabels 는 남긴다 · DB_VERSION ≥ 3
   S5  한 트랜잭션: searchText 쓰기가 던지면 그 쪽 pages 도 없고 failed 에 든다 · 정상이면 둘 다 · sk ·
       역할 재계산도 둘을 함께
   S6  (Node 몫) versionchange — db.js 가 이벤트를 내고 연결을 닫아 새 판이 막히지 않는다 · main.js 배너 배선 ·
       err.dbUpgraded 네 언어. 실제 두 탭은 headless 브라우저로 따로 본다(보고서).

   픽스처 글자는 지어낸 것이다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

/* ══ S6 (Node 몫) versionchange ═══════════════════════ */

test('S6 ★ 다른 탭이 버전을 올리면 db.js 가 versionchange 를 내고 연결을 닫는다 — 새 판은 막히지 않는다, 이 탭의 다음 열기는 실패', async () => {
  await db.openDb();
  const events = [];
  const off = db.onDbEvent((e) => events.push(e.type));
  let blocked = false;
  const next = await new Promise((resolve, reject) => {
    const req = indexedDB.open('medreader', db.DB_VERSION + 1);   // "새 판 탭"
    req.onupgradeneeded = () => {};
    req.onblocked = () => { blocked = true; };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
