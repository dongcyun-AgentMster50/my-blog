/* ============================================================
   MedReader — IndexedDB 접근 계층 (spec 9절)

   서비스 계층이다. `indexedDB`·`navigator` 를 안다.
   `document`·`window` DOM 조작과 `ui/` import 는 하지 않는다(3-2).
   사용자에게 보여줄 문자열을 만들지 않는다 — 코드만 돌려준다.

   ── 범위 ───────────────────────────────────────────────
   스토어·인덱스는 spec 9-2 표 전체다(9-1 결정: 버전 1에 전부 만든다).
   트랜잭션·커서·쿼터·`persist()`·문서 삭제 캐스케이드까지 들어 있다.
   아직 없는 것: `blocked` 가 났을 때 다른 탭에 닫기를 요청하는 UI 경로
   (여기서는 이벤트만 쏜다 — 문자열은 UI 가 만든다).
   ============================================================ */

export const DB_NAME = 'medreader';
// [2026-09-21] 1 → 2. v1 로 만들어진 DB 에는 pages.docId_algoVersion 인덱스가 없다.
// 인덱스 추가는 IndexedDB 에서 버전 증가가 필요하다(9-1). 배포 후에는 되돌릴 수
// 없으므로 배포 전인 지금 올린다. MIGRATIONS[2] 가 기존 스토어에 빠진 인덱스만
// 보충하며 데이터는 건드리지 않는다.
export const DB_VERSION = 2;

/* ────────────────────────────────────────────────────────
   spec 9-2 스토어 정의 — 선언으로 둔다.
   MIGRATIONS[1] 이 이 표를 읽어 만들기 때문에 "표대로인가"를
   코드를 읽지 않고 확인할 수 있고, 멱등 검사도 한 곳이다.
   ──────────────────────────────────────────────────────── */
export const SCHEMA_V1 = Object.freeze([
  { name: 'documents',   keyPath: 'id',
    indexes: [
      { name: 'lastOpenedAt', keyPath: 'lastOpenedAt' },
      { name: 'fileHash',     keyPath: 'fileHash', unique: true }
    ] },
  { name: 'blobs',       keyPath: 'docId', indexes: [] },
  { name: 'pages',       keyPath: ['docId', 'pageNo'],
    indexes: [
      { name: 'docId', keyPath: 'docId' },
      // spec 9-2 표에는 없다. 9-1 이 "인덱스는 지금 필요한 것 + 예상되는 것을
      // 함께 정의한다(인덱스 추가만 버전 증가가 필요하다)"고 했으므로 지금 넣는다.
      // 쓰임: 9-4 재개 때 "algoVersion 이 최신인 쪽" 집합을 **값을 읽지 않고**
      // 키만으로 구한다. 이게 없으면 7000쪽 × 9KB 를 전부 역직렬화해야 한다.
      { name: 'docId_algoVersion', keyPath: ['docId', 'algoVersion'] }
    ] },
  { name: 'progress',    keyPath: ['docId', 'sectionId'],
    indexes: [
      { name: 'docId',     keyPath: 'docId' },
      { name: 'updatedAt', keyPath: 'updatedAt' }
    ] },
  { name: 'questions',   keyPath: 'id',
    indexes: [
      { name: 'docId',           keyPath: 'docId' },
      { name: 'docId_sectionId', keyPath: ['docId', 'sectionId'] },
      { name: 'source',          keyPath: 'source' }
    ] },
  { name: 'attempts',    keyPath: 'id',
    indexes: [
      { name: 'docId',           keyPath: 'docId' },
      { name: 'docId_sectionId', keyPath: ['docId', 'sectionId'] },
      { name: 'at',              keyPath: 'at' }
    ] },
  { name: 'mistakes',    keyPath: 'id',
    indexes: [
      { name: 'questionId', keyPath: 'questionId' },
      { name: 'docId',      keyPath: 'docId' },
      { name: 'resolvedAt', keyPath: 'resolvedAt' }
    ] },
  { name: 'cards',       keyPath: 'id',
    indexes: [
      { name: 'docId', keyPath: 'docId' },
      { name: 'dueAt', keyPath: 'dueAt' },
      { name: 'term',  keyPath: 'term' }
    ] },
  { name: 'aiCache',     keyPath: 'key',
    indexes: [
      { name: 'docId',     keyPath: 'docId' },
      { name: 'createdAt', keyPath: 'createdAt' },
      { name: 'kind',      keyPath: 'kind' }
    ] },
  { name: 'usage',       keyPath: 'day',     indexes: [] },
  { name: 'settings',    keyPath: 'key',     indexes: [] },
  { name: 'annotations', keyPath: 'id',
    indexes: [
      { name: 'docId_pageNo', keyPath: ['docId', 'pageNo'] },
      { name: 'docId',        keyPath: 'docId' },
      { name: 'kind',         keyPath: 'kind' }
    ] },
  { name: 'sections',    keyPath: ['docId', 'sectionId'],
    indexes: [ { name: 'docId', keyPath: 'docId' } ] }
]);

export const STORE_NAMES = Object.freeze(SCHEMA_V1.map((s) => s.name));

/* ────────────────────────────────────────────────────────
   마이그레이션 사다리 (spec 9-1)
   각 fn 은 멱등이어야 한다. `objectStoreNames.contains` /
   `indexNames.contains` 로만 판단하고, 이미 있으면 건드리지 않는다.
   ──────────────────────────────────────────────────────── */
/**
 * SCHEMA_V1 표대로 스토어와 인덱스를 맞춘다. 멱등이다 —
 * 이미 있는 스토어는 만들지 않고, 이미 있는 인덱스는 건드리지 않는다.
 * 데이터는 읽지도 쓰지도 않는다.
 */
function reconcileSchema(db, tx) {
  for (let i = 0; i < SCHEMA_V1.length; i++) {
    const s = SCHEMA_V1[i];
    let store;
    if (db.objectStoreNames.contains(s.name)) {
      store = tx ? tx.objectStore(s.name) : null;
      if (!store) continue;
    } else {
      store = db.createObjectStore(s.name, { keyPath: s.keyPath });
    }
    for (let k = 0; k < s.indexes.length; k++) {
      const ix = s.indexes[k];
      if (store.indexNames.contains(ix.name)) continue;
      store.createIndex(ix.name, ix.keyPath, { unique: !!ix.unique });
    }
  }
}

export const MIGRATIONS = {
  1(db, tx) {
    reconcileSchema(db, tx);
  },
  // [2026-09-21] v1 로 만들어진 DB 에 pages.docId_algoVersion 을 더한다.
  // 같은 조정 함수를 다시 부르면 된다 — 없는 인덱스만 만들고 데이터는
  // 건드리지 않는다. 새로 만드는 DB 에서는 1 이 이미 다 만들어 두었으므로
  // 2 는 아무 일도 하지 않는다(멱등).
  2(db, tx) {
    reconcileSchema(db, tx);
  }
};

/* ────────────────────────────────────────────────────────
   오류 코드 — UI 문자열이 아니라 코드를 돌려준다(3-2).
   ──────────────────────────────────────────────────────── */
export const ERR = Object.freeze({
  QUOTA: 'ERR_DB_QUOTA',
  BLOCKED: 'ERR_DB_BLOCKED',
  OPEN: 'ERR_DB_OPEN'
});

/** QuotaExceededError 인가. 브라우저마다 name/코드가 갈려 둘 다 본다. */
export function isQuotaError(err) {
  if (!err) return false;
  const name = err.name || '';
  return name === 'QuotaExceededError' ||
         name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
         err.code === 22;
}

export class DbError extends Error {
  constructor(code, cause) {
    super(code);
    this.name = 'DbError';
    this.code = code;
    this.cause = cause;
  }
}

/* ────────────────────────────────────────────────────────
   열기 — 모듈 레벨 프라미스 캐시
   ──────────────────────────────────────────────────────── */
let dbPromise = null;
let dbHandle = null;
const listeners = new Set();   // (event) => void  — 'blocked' | 'versionchange' | 'close'

export function onDbEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(type, detail) {
  for (const fn of listeners) {
    try { fn({ type: type, detail: detail }); } catch (e) { /* 리스너 예외가 DB 를 막지 않는다 */ }
  }
}

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(new DbError(ERR.OPEN, e));
      return;
    }
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const tx = req.transaction;
      const from = ev.oldVersion || 0;
      for (let v = from + 1; v <= DB_VERSION; v++) {
        const fn = MIGRATIONS[v];
        if (fn) fn(db, tx);
      }
    };
    req.onblocked = () => { emit('blocked', null); };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        // 다른 탭이 버전을 올리려 한다. 우리가 잡고 있으면 그 탭이 멈춘다.
        emit('versionchange', null);
        try { db.close(); } catch (e) { /* 이미 닫힘 */ }
        dbPromise = null;
        dbHandle = null;
      };
      db.onclose = () => {
        emit('close', null);
        dbPromise = null;
        dbHandle = null;
      };
      dbHandle = db;
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(new DbError(ERR.OPEN, req.error));
    };
  });
  return dbPromise;
}

export function closeDb() {
  if (dbHandle) { try { dbHandle.close(); } catch (e) { /* 무시 */ } }
  dbHandle = null;
  dbPromise = null;
}

/** 개발용 — DB 를 통째로 지운다. */
export function deleteDatabase() {
  closeDb();
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve(true);
    req.onblocked = () => { emit('blocked', null); };
    req.onerror = () => reject(new DbError(ERR.OPEN, req.error));
  });
}

/* ────────────────────────────────────────────────────────
   트랜잭션 헬퍼
   `fn(tx, stores)` 안에서 요청을 걸고, 트랜잭션 완료를 기다린다.
   QuotaExceededError 는 DbError(ERR.QUOTA) 로 바꿔 던진다 —
   호출자(extract.js)가 "저장소가 찼다"를 다른 실패와 구분해야 한다.
   ──────────────────────────────────────────────────────── */
export async function withTx(storeNames, mode, fn) {
  const db = await openDb();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(names, mode);
    } catch (e) {
      reject(isQuotaError(e) ? new DbError(ERR.QUOTA, e) : e);
      return;
    }
    let result;
    let failed = null;
    const stores = {};
    for (let i = 0; i < names.length; i++) stores[names[i]] = tx.objectStore(names[i]);

    tx.oncomplete = () => resolve(result);
    tx.onabort = () => {
      const err = failed || tx.error;
      reject(isQuotaError(err) ? new DbError(ERR.QUOTA, err) : (err || new DbError(ERR.OPEN, null)));
    };
    tx.onerror = (ev) => {
      // onabort 에서 처리한다. 여기서는 원인만 잡아 둔다.
      if (!failed) failed = ev.target && ev.target.error;
    };

    let ret;
    try {
      ret = fn(tx, stores);
    } catch (e) {
      failed = e;
      try { tx.abort(); } catch (e2) { /* 이미 끝남 */ }
      return;
    }
    Promise.resolve(ret).then((v) => { result = v; }, (e) => {
      failed = e;
      try { tx.abort(); } catch (e2) { /* 이미 끝남 */ }
    });
  });
}

function reqPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function get(storeName, key) {
  return withTx(storeName, 'readonly', (tx, s) => reqPromise(s[storeName].get(key)));
}

export function put(storeName, value, key) {
  return withTx(storeName, 'readwrite', (tx, s) =>
    reqPromise(key === undefined ? s[storeName].put(value) : s[storeName].put(value, key)));
}

/**
 * `[공개 전 묶음 P1 — documents 갱신 경합]` **한 트랜잭션 안에서 읽고 → 자기 필드만 합쳐 → 쓴다.**
 *
 * 왜: `get()` 과 `put()` 은 서로 다른 트랜잭션이다. 그 사이에 다른 곳이 같은 레코드의
 * **다른 필드**를 쓰면, 미리 읽어 둔 옛 레코드를 통째로 `put` 하는 쪽이 그것을 지운다
 * (review.md 7c8-5 — 읽기 트랜잭션을 3초 늦추자 사용자가 고른 원문 언어가 옛 값으로 덮였다).
 * 여기서는 읽기와 쓰기가 **같은 readwrite 트랜잭션**이라, 같은 레코드에 대한 다른 쓰기는
 * 앞이나 뒤에 줄을 서고 사이에 끼어들 수 없다.
 *
 * - `change` 가 객체면 그 필드만 덮는다(얕은 합치기). 함수면 **트랜잭션 안에서 읽은 현재
 *   레코드**를 받아 덮을 필드 객체를 돌려준다. `null`·`undefined`·`false`·빈 객체면 쓰지 않는다.
 * - 레코드가 없으면 **쓰지 않는다**(지워진 문서를 되살리지 않는다).
 * - `change` 함수는 동기여야 한다 — `await` 하면 그사이 트랜잭션이 끝난다.
 *
 * @param {string} storeName
 * @param {*} key
 * @param {Object|function(Object):(Object|null)} change
 * @returns {Promise<{wrote:boolean, rec:Object|null}>} `rec` 는 쓴 뒤(또는 그대로인) 레코드
 */
export function patch(storeName, key, change) {
  return withTx(storeName, 'readwrite', (tx, s) => new Promise((resolve, reject) => {
    const store = s[storeName];
    const req = store.get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cur = req.result;
      if (cur === undefined || cur === null) { resolve({ wrote: false, rec: null }); return; }
      let part;
      try {
        part = typeof change === 'function' ? change(cur) : change;
      } catch (e) { reject(e); return; }
      if (!part || typeof part !== 'object' || Object.keys(part).length === 0) {
        resolve({ wrote: false, rec: cur });
        return;
      }
      const next = Object.assign({}, cur, part);
      const w = store.put(next);
      w.onerror = () => reject(w.error);
      w.onsuccess = () => resolve({ wrote: true, rec: next });
    };
  }));
}

/** 여러 레코드를 **한 트랜잭션**으로. 7000쪽에서 쪽마다 트랜잭션을 여는 비용을 피한다. */
export function putAll(storeName, values) {
  return withTx(storeName, 'readwrite', (tx, s) => {
    const store = s[storeName];
    for (let i = 0; i < values.length; i++) store.put(values[i]);
    return values.length;
  });
}

export function del(storeName, key) {
  return withTx(storeName, 'readwrite', (tx, s) => reqPromise(s[storeName].delete(key)));
}

export function clearStore(storeName) {
  return withTx(storeName, 'readwrite', (tx, s) => reqPromise(s[storeName].clear()));
}

export function count(storeName, query) {
  return withTx(storeName, 'readonly', (tx, s) =>
    reqPromise(query === undefined ? s[storeName].count() : s[storeName].count(query)));
}

/**
 * 커서 순회. `onRecord(value, key)` 가 `false` 를 돌려주면 멈춘다.
 * 전체를 배열로 모으지 않는다 — 7000쪽에서 메모리가 터진다.
 */
export function iterate(storeName, opts, onRecord) {
  const o = opts || {};
  return withTx(storeName, o.mode || 'readonly', (tx, s) => new Promise((resolve, reject) => {
    const store = s[storeName];
    const src = o.index ? store.index(o.index) : store;
    const req = src.openCursor(o.query === undefined ? null : o.query, o.direction || 'next');
    let n = 0;
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) { resolve(n); return; }
      n++;
      let go;
      try { go = onRecord(cur.value, cur.key); } catch (e) { reject(e); return; }
      if (go === false) { resolve(n); return; }
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  }));
}

/** 키만 모은다(값을 올리지 않는다). 이미 저장된 페이지 집합을 구할 때 쓴다. */
export function keysOf(storeName, indexName, query) {
  return withTx(storeName, 'readonly', (tx, s) => {
    const store = s[storeName];
    const src = indexName ? store.index(indexName) : store;
    return reqPromise(src.getAllKeys(query === undefined ? null : query));
  });
}

/* ────────────────────────────────────────────────────────
   저장소 용량 (spec 9-2)
   ──────────────────────────────────────────────────────── */
export async function estimate() {
  if (!(navigator.storage && navigator.storage.estimate)) {
    return { usage: null, quota: null, supported: false };
  }
  const e = await navigator.storage.estimate();
  return { usage: e.usage, quota: e.quota, supported: true, detail: e.usageDetails || null };
}

/** 온보딩 후 1회 호출(16-B). 이미 허용됐으면 다시 묻지 않는다. */
export async function requestPersist() {
  if (!(navigator.storage && navigator.storage.persist)) return { supported: false, persisted: false };
  const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  if (already) return { supported: true, persisted: true, asked: false };
  const ok = await navigator.storage.persist();
  return { supported: true, persisted: !!ok, asked: true };
}

/* ────────────────────────────────────────────────────────
   문서 단위 헬퍼 (spec 16-B)
   ──────────────────────────────────────────────────────── */

/** `fileHash` unique 인덱스로 이미 가져온 문서를 찾는다. */
export function findByFileHash(fileHash) {
  return withTx('documents', 'readonly', (tx, s) =>
    reqPromise(s.documents.index('fileHash').get(fileHash)));
}

/** docId 인덱스를 가진 스토어들 — 문서 삭제 시 함께 지운다(16-B). */
const CASCADE_STORES = Object.freeze([
  'pages', 'progress', 'questions', 'attempts', 'mistakes',
  'cards', 'aiCache', 'annotations', 'sections'
]);

/* ────────────────────────────────────────────────────────
   `[배포 안전장치 — 텍스트 다시 추출]` (spec 9-4 "설정 > 고급 [텍스트 다시 추출]")
   한 문서의 **쪽 텍스트에서 파생된 것**만 지운다. 무엇이 파생인가는 코드에서 찾은 목록이다:

   지운다(쪽 텍스트가 바뀌면 함께 틀려진다)
   · `pages`                  — 추출 결과 그 자체(`extract.js` `_buildAndStore`)
   · `questions`              — 5절 파서가 `pages` 에서 만든 문항(`quiz/engine.js` `buildSectionIndex`)
   · `sections`               — 같은 파서 몫의 스토어(P2, 지금은 쓰는 곳 없음 — 비어 있다)
   · documents.`extraction`   — 커서·실패 목록·algoVersion. 새 문서의 값으로 되돌린다
   · documents.`sectionIndex`·`sectionIndexDone`·`sectionIndexVersion` — 퀴즈 색인(`ui/quiz.js`)

   남긴다(사용자 데이터이거나, 텍스트가 바뀌어도 맞다)
   · documents 의 나머지 — 원문 언어(`lang`·`langSource`·`langGuess`), 마지막 쪽(`lastPage`·
     `lastLineId`), `readStats`(비용 추정용 실측 — 쪽 글자 수는 다시 추출해도 거의 같다), 제목 등
   · `aiCache`(번역 캐시 — 같은 문장이면 키가 같아 그대로 맞는다), `cards`(단어장 예정·문장 카드),
     `progress`·`attempts`·`mistakes`(퀴즈 기록 — 문항 id 는 `docId:섹션:번호` 로 다시 같게 만들어진다),
     `annotations`, `blobs`(PDF 원본 — 다시 추출의 재료)
   ──────────────────────────────────────────────────────── */

/** 문서별 파생 스토어 — 모두 `docId` 인덱스를 가진다. */
export const DERIVED_STORES = Object.freeze(['pages', 'questions', 'sections']);

/** documents 의 파생 필드를 되돌릴 값(새 문서의 값과 같다 — `ui/library.js` `newDocument`). */
export function derivedDocReset() {
  return {
    extraction: { done: false, pagesDone: 0, cursor: 1, failed: [], algoVersion: 0 },
    sectionIndex: [],
    sectionIndexDone: false,
    sectionIndexVersion: 0
  };
}

/**
 * 파생 데이터를 **한 트랜잭션**으로 지운다 — 쪽만 지워지고 `extraction.done` 이 남는 반쪽 상태가 없다.
 * documents 는 `patch` 와 같은 방식(트랜잭션 안에서 읽고 → 파생 필드만 덮어)으로 써서 사용자 필드를 지킨다.
 * 문서가 없으면 아무것도 지우지 않는다(지워진 문서를 되살리지 않는다).
 *
 * @param {string} docId
 * @returns {Promise<{reset:boolean, rec:Object|null, counts:Object}>}
 */
export function resetDerived(docId) {
  const names = ['documents'].concat(DERIVED_STORES);
  return withTx(names, 'readwrite', (tx, s) => new Promise((resolve, reject) => {
    const counts = {};
    const r = s.documents.get(docId);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const cur = r.result;
      if (cur === undefined || cur === null) { resolve({ reset: false, rec: null, counts: counts }); return; }
      const next = Object.assign({}, cur, derivedDocReset());
      let pending = 1 + DERIVED_STORES.length;
      let failed = null;
      const done = () => { if (--pending === 0) { failed ? reject(failed) : resolve({ reset: true, rec: next, counts: counts }); } };

      const w = s.documents.put(next);
      w.onsuccess = done;
      w.onerror = () => { failed = w.error; done(); };

      for (const name of DERIVED_STORES) {
        counts[name] = 0;
        const req = s[name].index('docId').openCursor(IDBKeyRange.only(docId));
        req.onsuccess = () => {
          const c = req.result;
          if (!c) { done(); return; }
          c.delete();
          counts[name]++;
          c.continue();
        };
        req.onerror = () => { failed = req.error; done(); };
      }
    };
  }));
}

/**
 * 문서와 딸린 모든 것을 지운다. **한 트랜잭션**으로 묶어 중간에 끊겨도
 * 반쯤 지워진 상태가 남지 않게 한다.
 * @param {string} docId
 * @returns {Promise<Object>} 스토어별 삭제 건수
 */
export function deleteDocument(docId) {
  const names = ['documents', 'blobs'].concat(CASCADE_STORES);
  return withTx(names, 'readwrite', (tx, s) => new Promise((resolve, reject) => {
    const counts = {};
    let pending = 0;
    let failed = null;

    const done = () => { if (pending === 0) { failed ? reject(failed) : resolve(counts); } };

    const sweep = (name) => {
      pending++;
      counts[name] = 0;
      const store = s[name];
      const src = store.indexNames.contains('docId') ? store.index('docId') : store;
      const req = src.openCursor(IDBKeyRange.only(docId));
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) { pending--; done(); return; }
        cur.delete();
        counts[name]++;
        cur.continue();
      };
      req.onerror = () => { failed = req.error; pending--; done(); };
    };

    pending++;
    const d1 = s.documents.delete(docId);
    d1.onsuccess = () => { counts.documents = 1; pending--; done(); };
    d1.onerror = () => { failed = d1.error; pending--; done(); };

    pending++;
    const d2 = s.blobs.delete(docId);
    d2.onsuccess = () => { counts.blobs = 1; pending--; done(); };
    d2.onerror = () => { failed = d2.error; pending--; done(); };

    for (const n of CASCADE_STORES) sweep(n);
  }));
}
