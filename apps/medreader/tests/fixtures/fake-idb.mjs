/* ============================================================
   tests/fixtures/fake-idb.mjs — Node 용 **최소** IndexedDB 흉내

   왜 있나: `documents` 갱신 경합(review.md 7c8-5)은 "읽기 트랜잭션과 쓰기
   트랜잭션이 갈라져 있다"는 **트랜잭션 의미론**의 결함이다. 스텁 `get`/`put`
   두 개로는 보이지 않는다. 그래서 `db.js` 를 **그대로** 돌릴 수 있을 만큼만
   IndexedDB 를 흉내 낸다 — 제품 코드는 바꾸지 않는다.

   흉내 내는 것(이 밖은 일부러 없다):
   · `indexedDB.open` + `onupgradeneeded`(createObjectStore·createIndex·indexNames)
   · `db.transaction(names, mode)` — **범위가 겹치는 readwrite 는 만든 순서대로 한 번에 하나**,
     readonly 는 앞선 readwrite 가 끝나야 시작(IndexedDB 의 순서 규칙)
   · 요청은 비동기로 하나씩 처리. 성공 콜백과 그 뒤 마이크로태스크 동안만 트랜잭션이
     살아 있고, 새 요청이 없으면 다음 매크로태스크에 **자동 커밋**한다.
     커밋 뒤의 요청은 `TransactionInactiveError` 로 던진다 — "한 트랜잭션 안에서
     읽고 쓴다"를 흉내가 공짜로 통과시키지 않게.
   · `abort()` 는 readwrite 변경을 되돌린다.
   · store: get · put · delete · count · getAllKeys · index(name).get
   · `[8g-1]` 키 순서(IndexedDB 정렬: 수 < 문자열 < 배열 — 이 앱이 쓰는 꼴만)와 **키 범위**
     (`IDBKeyRange.only·bound·lowerBound·upperBound` — 전역이 없을 때만 깐다), store·index 의
     `getAll(range, count)` · `getAllKeys(range, count)`(index 는 **기본 키**를 돌려준다) · `count(range)` ·
     `openCursor(range)`(value·key·primaryKey·delete·continue) · store `clear()`.
     열기: 낮은 버전으로 열면 `VersionError`, 버전을 올리면 열린 다른 연결에 `onversionchange` 를 쏘고
     그 연결이 닫힐 때까지 `onblocked` 로 기다린다(IndexedDB 순서 그대로).

   ★ 경합 재현 장치 — `delayReadonlyComplete(store, ms)`:
     review.md 7c8-5 의 방법 그대로다. 그 스토어를 범위에 둔 **읽기 전용**
     트랜잭션의 `oncomplete` 를 ms 만큼 늦게 부른다(잠금은 제때 풀린다).
     그러면 `db.get()` 이 늦게 끝나고, 그사이 다른 쓰기가 끼어든다.
   ============================================================ */

const keyStr = (k) => JSON.stringify(k);

/** IndexedDB 키 비교 — 이 앱이 쓰는 꼴만(수 < 문자열 < 배열). `Infinity` 는 수다. */
export function cmpKey(a, b) {
  const rank = (x) => (Array.isArray(x) ? 3 : typeof x === 'string' ? 2 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (Array.isArray(a)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = cmpKey(a[i], b[i]); if (c) return c; }
    return a.length - b.length;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 흉내 키 범위 — `_inc(k)` 하나만 본다(tests/reextract.test.mjs 의 범위와 같은 꼴이라 섞여도 맞다). */
export const FakeKeyRange = Object.freeze({
  only: (v) => ({ _inc: (k) => cmpKey(k, v) === 0 }),
  bound: (lo, hi, loOpen, hiOpen) => ({
    _inc: (k) => {
      const a = cmpKey(k, lo), b = cmpKey(k, hi);
      return (loOpen ? a > 0 : a >= 0) && (hiOpen ? b < 0 : b <= 0);
    }
  }),
  lowerBound: (lo, open) => ({ _inc: (k) => (open ? cmpKey(k, lo) > 0 : cmpKey(k, lo) >= 0) }),
  upperBound: (hi, open) => ({ _inc: (k) => (open ? cmpKey(k, hi) < 0 : cmpKey(k, hi) <= 0) })
});

/** 질의(null·범위·키 하나) → 키 판정 함수. */
function matcher(q) {
  if (q === undefined || q === null) return () => true;
  if (q && typeof q._inc === 'function') return (k) => q._inc(k);
  return (k) => cmpKey(k, q) === 0;
}

function inactiveError() {
  const e = new Error('TransactionInactiveError: 트랜잭션이 이미 끝났다');
  e.name = 'TransactionInactiveError';
  return e;
}

function keyOf(meta, value, explicitKey) {
  if (explicitKey !== undefined) return explicitKey;
  const kp = meta.keyPath;
  if (Array.isArray(kp)) return kp.map((p) => value[p]);
  return value[kp];
}

class FakeIdb {
  constructor() {
    this.dbs = new Map();          // name → {version, stores: Map(name → {meta, data: Map}), handles: Set, waiters}
    this.txQueue = [];             // 만든 순서. 끝난 것은 빠진다
    this.delays = new Map();       // store → ms (readonly oncomplete 지연)
    this.log = [];                 // {op, store, value?, at}
    this.t0 = Date.now();
  }

  /* ── 외부 조작 ─────────────────────────────────────── */
  delayReadonlyComplete(store, ms) {
    if (ms > 0) this.delays.set(store, ms); else this.delays.delete(store);
  }
  dump(dbName, store) {
    const d = this.dbs.get(dbName);
    if (!d || !d.stores.has(store)) return [];
    return [...d.stores.get(store).data.values()].map((v) => structuredClone(v));
  }
  peek(dbName, store, key) {
    const d = this.dbs.get(dbName);
    if (!d || !d.stores.has(store)) return undefined;
    const v = d.stores.get(store).data.get(keyStr(key));
    return v === undefined ? undefined : structuredClone(v);
  }

  /* ── indexedDB API ─────────────────────────────────── */
  open(name, version) {
    const req = { result: null, error: null, transaction: null,
      onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
    setImmediate(() => {
      let d = this.dbs.get(name);
      const oldVersion = d ? d.version : 0;
      if (!d) { d = { version: 0, stores: new Map(), handles: new Set() }; this.dbs.set(name, d); }
      if (!d.handles) d.handles = new Set();
      if (version !== undefined && version < d.version) {
        // [8g-1] 옛 판 모듈이 낮은 버전으로 열면 — IndexedDB 는 VersionError 로 거절한다.
        const e = new Error('VersionError: 요청 ' + version + ' < 저장 ' + d.version);
        e.name = 'VersionError';
        req.error = e;
        if (req.onerror) req.onerror({ target: req });
        return;
      }
      const finish = () => {
        const handle = new FakeDbHandle(this, name, d);
        req.result = handle;
        if (version > d.version) {
          const vtx = {
            objectStore: (n) => new UpgradeStore(d.stores.get(n))
          };
          req.transaction = vtx;
          handle._upgrading = true;
          if (req.onupgradeneeded) req.onupgradeneeded({ oldVersion: oldVersion, newVersion: version });
          handle._upgrading = false;
          d.version = version;
        }
        d.handles.add(handle);
        if (req.onsuccess) req.onsuccess({ target: req });
      };
      if (version > d.version && d.handles.size) {
        // [8g-1] 버전을 올리기 전에 열린 연결마다 versionchange — 닫지 않은 연결이 남으면 blocked 로 기다린다.
        for (const h of [...d.handles]) {
          if (typeof h.onversionchange === 'function') h.onversionchange({ oldVersion: d.version, newVersion: version });
        }
        if (d.handles.size) {
          if (req.onblocked) req.onblocked({ oldVersion: d.version, newVersion: version });
          d.waiters = (d.waiters || []).concat([finish]);
          return;
        }
      }
      finish();
    });
    return req;
  }
  deleteDatabase(name) {
    const req = { onsuccess: null, onerror: null, onblocked: null };
    setImmediate(() => { this.dbs.delete(name); if (req.onsuccess) req.onsuccess({ target: req }); });
    return req;
  }

  /* ── 트랜잭션 순서 ─────────────────────────────────── */
  _enqueue(tx) { this.txQueue.push(tx); this._schedule(); }
  _finish(tx) {
    const i = this.txQueue.indexOf(tx);
    if (i >= 0) this.txQueue.splice(i, 1);
    this._schedule();
  }
  _schedule() {
    for (let i = 0; i < this.txQueue.length; i++) {
      const tx = this.txQueue[i];
      if (tx.state !== 'pending') continue;
      let blocked = false;
      for (let j = 0; j < i; j++) {
        const o = this.txQueue[j];
        if (o.db !== tx.db) continue;
        if (o.mode === 'readonly' && tx.mode === 'readonly') continue;
        if (o.names.some((n) => tx.names.indexOf(n) >= 0)) { blocked = true; break; }
      }
      if (!blocked) tx._start();
    }
  }
}

class UpgradeStore {
  constructor(s) { this.s = s; }
  get indexNames() { const ix = this.s.meta.indexes; return { contains: (n) => ix.has(n) }; }
  createIndex(name, keyPath, opts) {
    if (this.s.meta.indexes.has(name)) throw new Error('ConstraintError: index ' + name);
    this.s.meta.indexes.set(name, { keyPath, unique: !!(opts && opts.unique) });
    return {};
  }
}

class FakeDbHandle {
  constructor(idb, name, d) {
    this.idb = idb; this.name = name; this.d = d;
    this.onversionchange = null; this.onclose = null;
  }
  get objectStoreNames() { const m = this.d.stores; return { contains: (n) => m.has(n) }; }
  createObjectStore(name, opts) {
    if (this.d.stores.has(name)) throw new Error('ConstraintError: store ' + name);
    const s = { meta: { keyPath: opts && opts.keyPath, indexes: new Map() }, data: new Map() };
    this.d.stores.set(name, s);
    return new UpgradeStore(s);
  }
  transaction(names, mode) {
    const list = Array.isArray(names) ? names.slice() : [names];
    for (const n of list) if (!this.d.stores.has(n)) throw new Error('NotFoundError: ' + n);
    return new FakeTx(this.idb, this, list, mode || 'readonly');
  }
  close() {
    // [8g-1] 닫힌 연결은 다음 버전 올림을 막지 않는다. 기다리던 열기가 있으면 다 닫혔을 때 잇는다.
    const d = this.d;
    if (!d.handles || !d.handles.has(this)) return;
    d.handles.delete(this);
    if (!d.handles.size && d.waiters && d.waiters.length) {
      const w = d.waiters; d.waiters = [];
      setImmediate(() => { for (const f of w) f(); });
    }
  }
}

class FakeTx {
  constructor(idb, db, names, mode) {
    this.idb = idb; this.db = db; this.names = names; this.mode = mode;
    this.state = 'pending';        // pending → running → done
    this.queue = [];
    this.busy = false;
    this.tickDone = false;
    this.error = null;
    this.oncomplete = null; this.onabort = null; this.onerror = null;
    this.snapshot = null;
    idb._enqueue(this);
    setImmediate(() => { this.tickDone = true; this._settle(); });
  }
  objectStore(n) {
    if (this.names.indexOf(n) < 0) throw new Error('NotFoundError: ' + n);
    return new TxStore(this, n);
  }
  _start() {
    this.state = 'running';
    if (this.mode === 'readwrite') {
      this.snapshot = new Map();
      for (const n of this.names) this.snapshot.set(n, new Map(this.db.d.stores.get(n).data));
    }
    this._pump();
  }
  _request(fn) {
    if (this.state === 'done') throw inactiveError();
    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
    this.queue.push({ req, fn });
    this._pump();
    return req;
  }
  _pump() {
    if (this.state !== 'running' || this.busy || this.queue.length === 0) return;
    const item = this.queue.shift();
    this.busy = true;
    setImmediate(() => {
      if (this.state === 'done') return;
      try {
        item.req.result = item.fn();
      } catch (e) {
        item.req.error = e;
        this.busy = false;
        if (item.req.onerror) item.req.onerror({ target: item.req });
        if (this.onerror) this.onerror({ target: item.req });
        this.abort(e);
        return;
      }
      if (item.req.onsuccess) item.req.onsuccess({ target: item.req });
      this.busy = false;
      // 성공 콜백 뒤 마이크로태스크(await 이어 붙임)가 새 요청을 걸 기회를 준다.
      setImmediate(() => this._settle());
    });
  }
  _settle() {
    if (this.state !== 'running' || !this.tickDone || this.busy) return;
    if (this.queue.length) { this._pump(); return; }
    this._commit();
  }
  _commit() {
    this.state = 'done';
    this.idb._finish(this);
    const fire = () => { if (this.oncomplete) this.oncomplete({ target: this }); };
    let delay = 0;
    if (this.mode === 'readonly') {
      for (const n of this.names) delay = Math.max(delay, this.idb.delays.get(n) || 0);
    }
    if (delay > 0) setTimeout(fire, delay); else fire();
  }
  abort(err) {
    if (this.state === 'done') return;
    const wasRunning = this.state === 'running';
    this.state = 'done';
    this.error = err || this.error || null;
    if (wasRunning && this.snapshot) {
      for (const [n, data] of this.snapshot) this.db.d.stores.get(n).data = data;
    }
    this.idb._finish(this);
    setImmediate(() => { if (this.onabort) this.onabort({ target: this }); });
  }
}

class TxStore {
  constructor(tx, name) { this.tx = tx; this.name = name; }
  get _s() { return this.tx.db.d.stores.get(this.name); }
  get indexNames() { const ix = this._s.meta.indexes; return { contains: (n) => ix.has(n) }; }
  get(key) {
    return this.tx._request(() => {
      const v = this._s.data.get(keyStr(key));
      this.tx.idb.log.push({ op: 'get', store: this.name, mode: this.tx.mode, at: Date.now() - this.tx.idb.t0 });
      return v === undefined ? undefined : structuredClone(v);
    });
  }
  put(value, key) {
    if (this.tx.mode !== 'readwrite') throw new Error('ReadOnlyError');
    return this.tx._request(() => {
      const s = this._s;
      const k = keyOf(s.meta, value, key);
      if (k === undefined || k === null) throw new Error('DataError: 키 없음');
      s.data.set(keyStr(k), structuredClone(value));
      this.tx.idb.log.push({ op: 'put', store: this.name, value: structuredClone(value), at: Date.now() - this.tx.idb.t0 });
      return k;
    });
  }
  delete(key) {
    if (this.tx.mode !== 'readwrite') throw new Error('ReadOnlyError');
    return this.tx._request(() => { this._s.data.delete(keyStr(key)); return undefined; });
  }
  /** [8g-1] 기본 키 순서의 [{k, v}] — 질의에 맞는 것만. */
  _rows(q) {
    const m = matcher(q);
    const out = [];
    for (const [ks, v] of this._s.data) { const k = JSON.parse(ks); if (m(k)) out.push({ k: k, v: v }); }
    out.sort((a, b) => cmpKey(a.k, b.k));
    return out;
  }
  count(q) {
    return this.tx._request(() => (q === undefined || q === null ? this._s.data.size : this._rows(q).length));
  }
  getAllKeys(q, n) {
    return this.tx._request(() => this._rows(q).slice(0, n > 0 ? n : undefined).map((r) => r.k));
  }
  getAll(q, n) {
    return this.tx._request(() => {
      this.tx.idb.log.push({ op: 'getAll', store: this.name, mode: this.tx.mode, at: Date.now() - this.tx.idb.t0 });
      return this._rows(q).slice(0, n > 0 ? n : undefined).map((r) => structuredClone(r.v));
    });
  }
  clear() {
    if (this.tx.mode !== 'readwrite') throw new Error('ReadOnlyError');
    return this.tx._request(() => { this._s.data.clear(); return undefined; });
  }
  openCursor(q) {
    return cursorOver(this, () => this._rows(q).map((r) => ({ key: r.k, primaryKey: r.k, v: r.v })));
  }
  index(name) {
    const meta = this._s.meta.indexes.get(name);
    if (!meta) throw new Error('NotFoundError: index ' + name);
    const store = this;
    const ixKey = (v) => (Array.isArray(meta.keyPath) ? meta.keyPath.map((p) => v[p]) : v[meta.keyPath]);
    // 인덱스 순서(인덱스 키 → 기본 키). 인덱스 키 경로의 값이 없는 레코드는 인덱스에 없다(IndexedDB 와 같다).
    const rows = (q) => {
      const m = matcher(q);
      const out = [];
      for (const [ks, v] of store._s.data) {
        const ik = ixKey(v);
        if (ik === undefined || (Array.isArray(ik) && ik.some((x) => x === undefined))) continue;
        if (m(ik)) out.push({ key: ik, primaryKey: JSON.parse(ks), v: v });
      }
      out.sort((a, b) => cmpKey(a.key, b.key) || cmpKey(a.primaryKey, b.primaryKey));
      return out;
    };
    return {
      get: (q) => this.tx._request(() => {
        for (const v of this._s.data.values()) {
          const kv = ixKey(v);
          if (keyStr(kv) === keyStr(q)) return structuredClone(v);
        }
        return undefined;
      }),
      getAll: (q, n) => this.tx._request(() => rows(q).slice(0, n > 0 ? n : undefined).map((r) => structuredClone(r.v))),
      getAllKeys: (q, n) => this.tx._request(() => rows(q).slice(0, n > 0 ? n : undefined).map((r) => r.primaryKey)),
      count: (q) => this.tx._request(() => rows(q).length),
      openCursor: (q) => cursorOver(store, () => rows(q))
    };
  }
}

/** [8g-1] 커서 — `continue()` 마다 요청 하나를 다시 쏜다. 목록은 첫 걸음에 한 번 잡는다. */
function cursorOver(store, list) {
  const outer = { result: null, error: null, onsuccess: null, onerror: null };
  let rows = null;
  let i = -1;
  const step = () => {
    const inner = store.tx._request(() => {
      if (!rows) rows = list();
      i++;
      return i < rows.length ? rows[i] : null;
    });
    inner.onsuccess = () => {
      const r = inner.result;
      outer.result = r ? {
        value: structuredClone(r.v), key: r.key, primaryKey: r.primaryKey,
        delete: () => store.delete(r.primaryKey), continue: step
      } : null;
      if (outer.onsuccess) outer.onsuccess({ target: outer });
    };
    inner.onerror = () => { outer.error = inner.error; if (outer.onerror) outer.onerror({ target: outer }); };
  };
  step();
  return outer;
}

/**
 * 전역 `indexedDB` 를 흉내로 바꾼다. 테스트 파일 하나에 하나.
 * @returns {FakeIdb}
 */
export function installFakeIdb() {
  const idb = new FakeIdb();
  globalThis.indexedDB = idb;
  // [8g-1] Node 에는 IDBKeyRange 가 없다. 이미 있으면(다른 테스트가 깐 흉내) 그대로 둔다.
  if (typeof globalThis.IDBKeyRange === 'undefined') globalThis.IDBKeyRange = FakeKeyRange;
  return idb;
}
