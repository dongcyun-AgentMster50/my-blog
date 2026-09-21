/* ============================================================
   db.js — spec 9-1 · 9-2

   IndexedDB 자체는 Node 에 없다. 하지만 **스키마 선언과 마이그레이션
   사다리**는 순수한 자료·함수이므로 스텁으로 검증할 수 있다.
   9-1 의 "각 fn 은 멱등이어야 한다(objectStoreNames.contains 검사)"를
   여기서 고정한다 — 멱등이 깨지면 실기기에서 upgrade 가 예외로 죽는다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SCHEMA_V1, STORE_NAMES, MIGRATIONS, DB_NAME, DB_VERSION, isQuotaError, ERR } from '../js/db.js';

/* ── IDBDatabase / IDBObjectStore 스텁 ─────────────────── */
class StubStore {
  constructor(name, keyPath) {
    this.name = name;
    this.keyPath = keyPath;
    this._indexes = new Map();
    this.created = 0;
  }
  get indexNames() {
    const m = this._indexes;
    return { contains: (n) => m.has(n) };
  }
  createIndex(name, keyPath, opts) {
    if (this._indexes.has(name)) throw new Error('ConstraintError: 인덱스 중복 생성 ' + name);
    this._indexes.set(name, { keyPath, unique: !!(opts && opts.unique) });
    this.created++;
  }
}

class StubDb {
  constructor() {
    this.stores = new Map();
    this.createCalls = 0;
  }
  get objectStoreNames() {
    const m = this.stores;
    return { contains: (n) => m.has(n) };
  }
  createObjectStore(name, opts) {
    if (this.stores.has(name)) throw new Error('ConstraintError: 스토어 중복 생성 ' + name);
    const s = new StubStore(name, opts && opts.keyPath);
    this.stores.set(name, s);
    this.createCalls++;
    return s;
  }
}

const stubTx = (db) => ({ objectStore: (n) => db.stores.get(n) });

test('D1 DB 이름·버전은 spec 9-1 그대로', () => {
  assert.equal(DB_NAME, 'medreader');
  // [2026-09-21] spec 9-1 이 1 → 2 로 수정되었다. pages.docId_algoVersion 인덱스를
  // 더했고 IndexedDB 는 인덱스 추가에 버전 증가를 요구한다. 이 단언은 "spec 과
  // 코드가 같은 값을 말하는가"를 고정하는 것이므로 spec 이 바뀌면 함께 바뀐다.
  assert.equal(DB_VERSION, 2);
});

test('D2 spec 9-2 의 스토어가 전부 있다 (Phase 2·3 포함 — 9-1 결정)', () => {
  const want = [
    'documents', 'blobs', 'pages', 'progress', 'questions', 'attempts',
    'mistakes', 'cards', 'aiCache', 'usage', 'settings', 'annotations', 'sections'
  ];
  assert.deepEqual([...STORE_NAMES].sort(), want.slice().sort());
});

test('D3 키와 인덱스가 9-2 표대로 — fileHash 는 unique', () => {
  const byName = {};
  for (const s of SCHEMA_V1) byName[s.name] = s;

  assert.equal(byName.documents.keyPath, 'id');
  assert.deepEqual(byName.pages.keyPath, ['docId', 'pageNo']);
  assert.equal(byName.blobs.keyPath, 'docId');
  assert.deepEqual(byName.progress.keyPath, ['docId', 'sectionId']);
  assert.deepEqual(byName.sections.keyPath, ['docId', 'sectionId']);
  assert.equal(byName.aiCache.keyPath, 'key');
  assert.equal(byName.usage.keyPath, 'day');
  assert.equal(byName.settings.keyPath, 'key');

  const fh = byName.documents.indexes.find((i) => i.name === 'fileHash');
  assert.ok(fh, 'fileHash 인덱스가 있다');
  assert.equal(fh.unique, true, '같은 파일을 두 번 가져와도 중복 생성되지 않는다(16-B)');

  // 나머지 인덱스는 unique 가 아니어야 한다 — 하나라도 unique 면 저장이 막힌다
  for (const s of SCHEMA_V1) {
    for (const ix of s.indexes) {
      if (s.name === 'documents' && ix.name === 'fileHash') continue;
      assert.notEqual(ix.unique, true, s.name + '.' + ix.name);
    }
  }
});

test('D4 pages 에 docId 와 docId_algoVersion 인덱스가 있다 (9-4 재개용)', () => {
  const pages = SCHEMA_V1.find((s) => s.name === 'pages');
  const names = pages.indexes.map((i) => i.name);
  assert.ok(names.includes('docId'));
  assert.ok(names.includes('docId_algoVersion'), '재개 때 값을 읽지 않고 키만으로 최신 쪽을 고른다');
  const ix = pages.indexes.find((i) => i.name === 'docId_algoVersion');
  assert.deepEqual(ix.keyPath, ['docId', 'algoVersion']);
});

test('D5 ★ MIGRATIONS[1] 은 멱등하다 — 두 번 돌려도 던지지 않는다 (9-1)', () => {
  const db = new StubDb();
  MIGRATIONS[1](db, stubTx(db));
  const firstCalls = db.createCalls;
  const firstIndexes = [...db.stores.values()].reduce((a, s) => a + s.created, 0);

  // 같은 db 에 다시 — 스텁은 중복 생성 시 던진다
  assert.doesNotThrow(() => MIGRATIONS[1](db, stubTx(db)));
  assert.equal(db.createCalls, firstCalls, '스토어를 다시 만들지 않았다');
  assert.equal([...db.stores.values()].reduce((a, s) => a + s.created, 0), firstIndexes,
    '인덱스를 다시 만들지 않았다');
});

test('D6 MIGRATIONS[1] 이 만든 것이 SCHEMA_V1 과 정확히 같다', () => {
  const db = new StubDb();
  MIGRATIONS[1](db, stubTx(db));
  assert.equal(db.stores.size, SCHEMA_V1.length);
  for (const s of SCHEMA_V1) {
    const made = db.stores.get(s.name);
    assert.ok(made, s.name);
    assert.deepEqual(made.keyPath, s.keyPath);
    for (const ix of s.indexes) {
      assert.ok(made._indexes.has(ix.name), s.name + '.' + ix.name);
      assert.equal(made._indexes.get(ix.name).unique, !!ix.unique);
    }
    assert.equal(made._indexes.size, s.indexes.length, s.name + ' 인덱스 개수');
  }
});

test('D7 부분적으로 만들어진 DB 도 이어서 채운다 (중단된 upgrade 복구)', () => {
  const db = new StubDb();
  // documents 만 있고 인덱스는 하나만 있는 상태를 흉내낸다
  const partial = db.createObjectStore('documents', { keyPath: 'id' });
  partial.createIndex('lastOpenedAt', 'lastOpenedAt', {});

  assert.doesNotThrow(() => MIGRATIONS[1](db, stubTx(db)));
  assert.equal(db.stores.size, SCHEMA_V1.length);
  assert.ok(db.stores.get('documents')._indexes.has('fileHash'), '빠진 인덱스를 채웠다');
});

test('D8 마이그레이션 사다리는 1..DB_VERSION 이 빠짐없이 있다 (9-1)', () => {
  for (let v = 1; v <= DB_VERSION; v++) {
    assert.equal(typeof MIGRATIONS[v], 'function', 'MIGRATIONS[' + v + ']');
  }
});

test('D9 isQuotaError — 브라우저별 이름·코드를 모두 잡는다', () => {
  assert.equal(isQuotaError({ name: 'QuotaExceededError' }), true);
  assert.equal(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }), true);
  assert.equal(isQuotaError({ code: 22 }), true);
  assert.equal(isQuotaError({ name: 'AbortError' }), false);
  assert.equal(isQuotaError(null), false);
  assert.equal(isQuotaError(undefined), false);
});

test('D10 오류 코드는 문자열 상수다 — UI 문자열이 아니다 (3-2)', () => {
  assert.equal(ERR.QUOTA, 'ERR_DB_QUOTA');
  for (const k of Object.keys(ERR)) assert.match(ERR[k], /^ERR_[A-Z_]+$/);
});
