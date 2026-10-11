/* ============================================================
   tests/reextract.test.mjs — [텍스트 다시 추출] (spec 9-4) + 작은 결함 둘

   왜 있나: 배포 직후 옛·새 모듈이 섞이면 섞인 규칙으로 재추출한 결과가 **새 algoVersion 으로
   굳는다**(review.md PR-6). 판 번호가 같으니 다음 판 올림 전까지 저절로 고쳐지지 않는다.
   복구 길이 [⋯] → [텍스트 다시 추출]이다. 여기서 고정하는 것:
     · 파생 데이터(쪽·문항·섹션·extraction·퀴즈 색인)만 지우고 **사용자 데이터는 남긴다**
     · 한 트랜잭션 — 다른 문서는 건드리지 않는다, 없는 문서는 되살리지 않는다
     · 옛 추출기를 멈출 때 **도는 중인 쪽과 마지막 저장까지 기다린다**(기다리지 않으면 지운 뒤에 쓴다)
     · 순서: PDF 확보 → 멈추고 기다림 → 지움 → 새 추출기. 확인은 페이지 안 대화상자(`confirm()` 0)

   `fixtures/fake-idb.mjs` 에는 커서·키 범위가 없다. 공용 흉내는 바꾸지 않고, 이 파일 안에서만
   `index().openCursor` · `index().getAllKeys` · `IDBKeyRange` 를 덧붙인다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
const idb = installFakeIdb();

/* ── 흉내 보강: 키 범위 · 인덱스 커서 · 인덱스 getAllKeys(기본 키를 돌려준다) ── */
function cmp(a, b) {
  const rank = (x) => (Array.isArray(x) ? 3 : typeof x === 'string' ? 2 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (Array.isArray(a)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = cmp(a[i], b[i]); if (c) return c; }
    return a.length - b.length;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}
globalThis.IDBKeyRange = {
  only: (v) => ({ _inc: (k) => cmp(k, v) === 0 }),
  bound: (lo, hi) => ({ _inc: (k) => cmp(k, lo) >= 0 && cmp(k, hi) <= 0 })
};

const db = await import('../js/db.js');
const { Extractor, normalizeExtraction, planResume, ALGO_VERSION } = await import('../js/pdf/extract.js');

{
  const h = await db.openDb();
  const proto = Object.getPrototypeOf(h.transaction(['pages'], 'readonly').objectStore('pages'));
  proto.clear = function () { return this.tx._request(() => { this._s.data.clear(); return undefined; }); };
  const origIndex = proto.index;
  proto.index = function (name) {
    const ix = origIndex.call(this, name);
    const store = this;
    const meta = store._s.meta.indexes.get(name);
    const ixKey = (v) => (Array.isArray(meta.keyPath) ? meta.keyPath.map((p) => v[p]) : v[meta.keyPath]);
    const pk = (v) => { const kp = store._s.meta.keyPath; return Array.isArray(kp) ? kp.map((p) => v[p]) : v[kp]; };
    const pick = (range) => [...store._s.data.values()].filter((v) => !range || range._inc(ixKey(v)));
    ix.getAllKeys = (range) => store.tx._request(() => pick(range).map(pk));
    ix.openCursor = (range) => {
      const outer = { result: null, error: null, onsuccess: null, onerror: null };
      let list = null;
      let i = -1;
      const step = () => {
        const inner = store.tx._request(() => {
          if (!list) list = pick(range).map((v) => structuredClone(v));
          i++;
          return i < list.length ? list[i] : null;
        });
        inner.onsuccess = () => {
          const v = inner.result;
          outer.result = v ? { value: v, key: ixKey(v), primaryKey: pk(v), delete: () => store.delete(pk(v)), continue: step } : null;
          if (outer.onsuccess) outer.onsuccess({ target: outer });
        };
        inner.onerror = () => { outer.error = inner.error; if (outer.onerror) outer.onerror({ target: outer }); };
      };
      step();
      return outer;
    };
    return ix;
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const all = (store) => idb.dump('medreader', store);

function doc(id, extra) {
  return Object.assign({
    id: id, title: 'Book ' + id, fileName: id + '.pdf', size: 10, fileHash: 'h-' + id,
    pageCount: 3, addedAt: 1, lastOpenedAt: 2,
    lastPage: 7, lastLineId: 'p7-l3',
    lang: 'fr', langSource: 'user', langGuess: { lang: 'en', score: 0.9, script: 'Latn' },
    readStats: { pages: 4, chars: 16000 },
    extraction: { done: true, pagesDone: 3, cursor: 4, failed: [2], algoVersion: ALGO_VERSION, derivedHash: 'x', roleDirty: [], status: 'done' },
    sectionIndex: [{ sectionId: 'sec-I', questions: 5, verified: 5 }], sectionIndexDone: true, sectionIndexVersion: 3
  }, extra || {});
}

async function seed() {
  for (const s of ['documents', 'pages', 'questions', 'sections', 'aiCache', 'attempts', 'cards', 'progress', 'mistakes', 'annotations', 'blobs']) {
    await db.clearStore(s);
  }
  await db.putAll('documents', [doc('A'), doc('B')]);
  await db.put('blobs', { docId: 'A', blob: 'pdf-bytes' });
  const pages = [];
  for (const d of ['A', 'B']) for (let n = 1; n <= 3; n++) pages.push({ docId: d, pageNo: n, algoVersion: 9, lines: [] });
  await db.putAll('pages', pages);
  await db.putAll('questions', [
    { id: 'A:sec-I:q1', docId: 'A', sectionId: 'sec-I', number: 1, source: 'parser' },
    { id: 'A:sec-I:q2', docId: 'A', sectionId: 'sec-I', number: 2, source: 'parser' },
    { id: 'B:sec-I:q1', docId: 'B', sectionId: 'sec-I', number: 1, source: 'parser' }
  ]);
  await db.putAll('sections', [{ docId: 'A', sectionId: 'sec-I' }, { docId: 'B', sectionId: 'sec-I' }]);
  await db.put('aiCache', { key: 'k1', docId: 'A', createdAt: 1, kind: 'translate', value: 'نص' });
  await db.put('attempts', { id: 't1', docId: 'A', sectionId: 'sec-I', at: 1 });
  await db.put('progress', { docId: 'A', sectionId: 'sec-I', updatedAt: 1 });
  await db.put('mistakes', { id: 'm1', docId: 'A', questionId: 'A:sec-I:q1', resolvedAt: 0 });
  await db.put('cards', { id: 'c1', docId: 'A', dueAt: 1, term: 'aorta', kind: 'term' });
  await db.put('annotations', { id: 'n1', docId: 'A', pageNo: 7, kind: 'note' });
}

/* ── 1. db.resetDerived ───────────────────────────────── */

test('RX1 ★ resetDerived — 그 문서의 쪽·문항·섹션·extraction·퀴즈 색인만 지우고 사용자 데이터는 남긴다', async () => {
  await seed();
  const before = idb.peek('medreader', 'documents', 'A');
  const res = await db.resetDerived('A');
  assert.equal(res.reset, true);
  assert.deepEqual(res.counts, { pages: 3, questions: 2, sections: 1 });

  // 지운 것
  assert.deepEqual(all('pages').filter((p) => p.docId === 'A'), []);
  assert.deepEqual(all('questions').filter((q) => q.docId === 'A'), []);
  assert.deepEqual(all('sections').filter((q) => q.docId === 'A'), []);
  const a = idb.peek('medreader', 'documents', 'A');
  assert.deepEqual(a.extraction, { done: false, pagesDone: 0, cursor: 1, failed: [], algoVersion: 0 });
  assert.deepEqual(a.sectionIndex, []);
  assert.equal(a.sectionIndexDone, false);
  assert.equal(a.sectionIndexVersion, 0);

  // 남긴 것 — documents 의 사용자 필드는 한 글자도 안 바뀐다
  for (const f of Object.keys(before)) {
    if (['extraction', 'sectionIndex', 'sectionIndexDone', 'sectionIndexVersion'].indexOf(f) >= 0) continue;
    assert.deepEqual(a[f], before[f], '사용자 필드 ' + f + ' 가 바뀌었다');
  }
  assert.equal(a.lang, 'fr');
  assert.equal(a.langSource, 'user');
  assert.equal(a.lastPage, 7);
  // 다른 스토어의 사용자 데이터
  assert.equal(all('aiCache').length, 1, '번역 캐시');
  assert.equal(all('attempts').length, 1, '퀴즈 기록');
  assert.equal(all('progress').length, 1);
  assert.equal(all('mistakes').length, 1);
  assert.equal(all('cards').length, 1, '카드(단어장 예정)');
  assert.equal(all('annotations').length, 1);
  assert.equal(all('blobs').length, 1, 'PDF 원본');
  // 다른 문서는 그대로
  assert.equal(all('pages').filter((p) => p.docId === 'B').length, 3);
  assert.equal(all('questions').filter((q) => q.docId === 'B').length, 1);
  assert.deepEqual(idb.peek('medreader', 'documents', 'B'), doc('B'));
});

test('RX2 resetDerived — 없는 문서는 되살리지 않고 아무것도 지우지 않는다', async () => {
  await seed();
  await db.put('pages', { docId: 'ghost', pageNo: 1, algoVersion: 9, lines: [] });
  const res = await db.resetDerived('ghost');
  assert.equal(res.reset, false);
  assert.equal(idb.peek('medreader', 'documents', 'ghost'), undefined);
  assert.equal(all('pages').filter((p) => p.docId === 'ghost').length, 1);
});

test('RX3 ★ 지운 뒤의 extraction 은 새 문서와 같다 — 처음부터 지금 algoVersion 으로 다시 뽑고, "엔진 갱신" 배너는 뜨지 않는다', () => {
  const p = planResume(db.derivedDocReset().extraction);
  assert.equal(p.reextract, true);
  assert.equal(p.cursor, 1);
  assert.deepEqual(p.failed, []);
  assert.equal(p.done, false);
  assert.equal(p.algoVersion, ALGO_VERSION);
  // library.attach 는 "이미 뽑아 둔 쪽이 있을 때만" 배너를 낸다 — pagesDone 0
  assert.equal(db.derivedDocReset().extraction.pagesDone, 0);
  assert.deepEqual(db.DERIVED_STORES, ['pages', 'questions', 'sections']);
});

/* ── 2. Extractor.stopAndSettle ──────────────────────── */

function slowExtractor(docId, ms) {
  const ex = new Extractor({ docId: docId, pdfDoc: null, pageCount: 3 });
  // `[Review]` 쪽 처리가 **실제로 시작된 뒤**에 멈추게 한다. `sleep(20)` 으로 기다리면 부하가 큰
  // 동시 실행에서 첫 `_tick` 이 아직 안 돌아 (가)의 재현이 빗나갔다(4개 동시 실행 1/4 빨강).
  ex.entered = new Promise((r) => { ex._enter = r; });
  ex._buildAndStore = async (pageNo) => {
    ex._enter();
    await sleep(ms);
    const rec = { docId: docId, pageNo: pageNo, algoVersion: ALGO_VERSION, lines: [], extractedAt: Date.now() };
    await db.put('pages', rec);
    return { rec: rec, mask: { prev: true, next: true, complete: true } };
  };
  ex.ex = normalizeExtraction({ status: 'paused', cursor: 1 });   // prepare 를 건너뛴다
  return ex;
}

function writesAfter(t) {
  return idb.log.filter((e) => e.op === 'put' && e.at > t && (e.store === 'pages' || e.store === 'documents'));
}

test('RX4 ★ stop() 만으로는 도는 중인 쪽이 **나중에** 쓰인다 — stopAndSettle 은 그것까지 기다린다', async () => {
  await seed();
  await db.resetDerived('A');

  // (가) stop() — 돌아온 뒤에도 쪽 쓰기가 온다(다시 추출이 이것을 기다리지 않으면 지운 뒤에 쓴다)
  const a = slowExtractor('A', 80);
  await a.start();
  await a.entered;
  a.stop();
  const t1 = Date.now() - idb.t0;
  await a._tickPromise;          // 도는 쪽이 끝날 때까지 — 시간이 아니라 그 약속을 기다린다
  await sleep(20);
  assert.ok(writesAfter(t1).some((e) => e.store === 'pages'), 'stop() 뒤에 쪽 쓰기가 온다(재현)');

  // (나) stopAndSettle — 돌아온 뒤에는 어떤 쓰기도 없다
  await db.resetDerived('A');
  const b = slowExtractor('A', 80);
  await b.start();
  await b.entered;               // 쪽 처리가 도는 중에 멈춘다 — 안 돈 채 멈추면 이 검사는 거저 통과한다
  await b.stopAndSettle();
  const t2 = Date.now() - idb.t0;
  await sleep(200);
  assert.deepEqual(writesAfter(t2), [], 'stopAndSettle 뒤에 쓰기가 왔다');
  assert.equal(b.running, false);
});

/* ── 3. 배선 (소스) ───────────────────────────────────── */

function code(rel) {
  return readFileSync(new URL('../' + rel, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

test('RX5 ★ library.reextractDoc 순서 — PDF 확보 → 멈추고 기다림 → 한 트랜잭션 지움 → 새 추출기', () => {
  const lib = code('js/ui/library.js');
  const fn = lib.slice(lib.indexOf('export function reextractDoc'), lib.indexOf('function askReextract'));
  const at = (s) => { const i = fn.indexOf(s); assert.ok(i > 0, s + ' 가 없다'); return i; };
  assert.ok(at('openDocument(blob.blob)') < at('await old.stopAndSettle()'));
  assert.ok(at('await old.stopAndSettle()') < at('await db.resetDerived(docId)'));
  assert.ok(at('await db.resetDerived(docId)') < at('await attach(res.rec, pdfDoc)'));
  assert.match(fn, /if \(!res\.reset\) return null;/);
  // 원본이 없으면 지우기 전에 멈춘다
  assert.ok(at("bannerKey('library.reextract.noFile')") < at('db.resetDerived'));
  // 그사이 열면 기다린다 — openDoc 첫 줄
  assert.match(lib, /export async function openDoc\(docId\) \{\s*if \(reextracting\.has\(docId\)\) return reextracting\.get\(docId\);/);
});

test('RX6 ★ 확인은 페이지 안 대화상자 — confirm() 을 쓰지 않는다 · [⋯] 패널에 버튼 · 대화상자 문구는 네 언어에 있다', async () => {
  const lib = code('js/ui/library.js');
  const branch = lib.slice(lib.indexOf("=== 'reextract'"), lib.indexOf("=== 'set-lang'"));
  assert.match(branch, /await askReextract\(name\)/);
  assert.ok(!/confirm\(/.test(branch));
  const ask = lib.slice(lib.indexOf('function askReextract'), lib.indexOf('async function onListClick'));
  assert.ok(!/\bconfirm\(/.test(ask));
  assert.match(ask, /showModal\(\)/);
  assert.match(lib, /rb\.setAttribute\('data-action', 'reextract'\)/);

  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dlg = html.slice(html.indexOf('<dialog class="confirm-dialog" id="reextractDialog"'), html.indexOf('</dialog>'));
  assert.ok(dlg.length > 100);
  const keys = [...dlg.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys.sort(), ['library.reextract.body', 'library.reextract.cancel', 'library.reextract.keeps', 'library.reextract.ok']);
  const { BUNDLES, LANGS } = await import('../js/i18n/index.js');
  const used = keys.concat(['library.reextract.title', 'library.reextract.hint', 'library.reextract.button',
    'library.reextract.confirmTitle', 'library.reextract.started', 'library.reextract.noFile']);
  for (const lang of LANGS) for (const k of used) assert.ok(BUNDLES[lang][k], lang + '.' + k);
  // ko·fr 도 실제로 번역했다(영어 복사가 아니다)
  for (const lang of ['ar', 'fr', 'ko']) for (const k of used) {
    if (k === 'library.reextract.cancel' && lang === 'fr') continue;   // 다르지만 혹시 같아도 문제 아님
    assert.notEqual(BUNDLES[lang][k], BUNDLES.en[k], lang + '.' + k + ' 가 영어 그대로');
  }
});

test('RX7 err.reextract — ko·fr 이 영어 문장이 아니다 (키는 네 언어 그대로)', async () => {
  const { BUNDLES, LANGS } = await import('../js/i18n/index.js');
  for (const lang of LANGS) assert.ok(BUNDLES[lang]['err.reextract'], lang);
  assert.notEqual(BUNDLES.ko['err.reextract'], BUNDLES.en['err.reextract']);
  assert.notEqual(BUNDLES.fr['err.reextract'], BUNDLES.en['err.reextract']);
  assert.match(BUNDLES.ko['err.reextract'], /[가-힣]/);
  assert.match(BUNDLES.fr['err.reextract'], /moteur de texte/);
});

test('RX8 reader.goPage — 문서가 정해지기 전에는 이동하지 않는다 (#/reader/null/N 금지)', () => {
  const rd = code('js/ui/reader.js');
  const fn = rd.slice(rd.indexOf('function goPage(v)'), rd.indexOf('function paintPager'));
  assert.match(fn, /^function goPage\(v\) \{\s*if \(!state\.docId\) return;/);
});
