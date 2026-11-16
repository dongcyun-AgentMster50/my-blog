/* ══════════════════════════════════════════════════════════════════════
   backup/export.js — 백업 내보내기 서비스 (spec 17-4-1 3·5 메모리 — 9c-1)

   서비스 계층이다. `config`·`db`·`hash`·`text/*` 만 import 한다(17-4-1 7 import 방향 — `search/*`·`vocab/*` 행과 같다).
   ★ 키 저장소·AI·화면 모듈은 **import 하지 않는다**(정적 시험) — 이 파일에는 키를 볼 길이 없다. 읽는 것은 IndexedDB 뿐이고,
     키는 IndexedDB 에 없다(13절). 그래도 줄마다 키 모양 글자는 `text/backup.js` 가 `[KEY]` 로 지운다(두 겹).
   ★ 메모리(9c-D6): 스토어를 `BACKUP.BATCH`(1,000) 줄씩 **트랜잭션 하나에 한 묶음**으로 읽어(앞 묶음의 마지막 키 다음부터)
     줄 글자 하나로 잇고, 그 글자를 작은 `Blob` 으로 바꿔 목록에 둔다. 브라우저는 Blob 내용을 JS 힙 밖에 둔다
     `[가정 — Chrome Blob 저장소, 실기기 M]`. 힙에는 한 묶음(레코드 1,000개 + 그 글자)만 남는다. 끝에 목록을 Blob 하나로 묶고
     `CompressionStream('gzip')` 이 있으면 흘려 압축한다(없으면 평문 `.jsonl`).
   ★ 내려받기(`<a download>`)·진행 표시·`backup.lastExportAt` 쓰기는 화면(`ui/backup.js`) 몫 — 여기는 Blob 을 돌려준다.
   ══════════════════════════════════════════════════════════════════════ */

import * as realDb from '../db.js';
import { BACKUP } from '../config.js';
import { hasSubtle } from '../hash.js';
import { algoVersion } from '../text/layout.js';
import { docForBackup, settingsForBackup, headLine, recLine, endLine, backupFileName } from '../text/backup.js';

/** 압축 흐름을 쓸 수 있는가(존재 검사만). */
export function canGzip() {
  return typeof CompressionStream === 'function' && typeof Response === 'function' && typeof Blob === 'function';
}

/** 레코드 → 기본 키(이 앱의 스토어는 모두 in-line 키 — `db.SCHEMA_V1`). */
function keyOfRec(keyPath, v) {
  return Array.isArray(keyPath) ? keyPath.map((p) => v[p]) : v[keyPath];
}

/**
 * 스토어를 `size` 개씩, 묶음마다 새 트랜잭션의 **`getAll(범위, size)` 한 요청**으로 읽는다(앞 묶음 마지막 기본 키 **다음**부터).
 * 커서(`iterate`)로 1,000 걸음을 가면 묶음 객체가 1,000 개의 작업에 걸쳐 살아 있어 V8 이 늙은 영역으로 올리고, 그 쓰레기가
 * 힙 한도까지 쌓였다(같은 내보내기가 27–140MB 로 흔들림 — b9c1 diag4·6). 한 요청이면 묶음이 한 작업 안에서 생기고 버려져
 * 젊은 영역에서 걷힌다.
 * 트랜잭션 사이에 다른 일이 끼어들 수 있다(이 앱은 내보내는 동안 다른 쓰기를 막지 않는다) — 키 순서로 걷기 때문에
 * 그사이 생긴 레코드는 들어가거나 빠질 뿐, 같은 레코드가 두 번 나오지 않는다.
 */
async function eachBatch(d, KeyRange, store, size, fn) {
  const schema = (d.SCHEMA_V1 || realDb.SCHEMA_V1).find((x) => x.name === store);
  const keyPath = schema.keyPath;
  let last;
  let started = false;
  for (;;) {
    const query = started ? KeyRange.lowerBound(last, true) : null;
    const batch = await d.withTx(store, 'readonly', (tx, s) => new Promise((resolve, reject) => {
      const r = s[store].getAll(query, size);
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    }));
    started = true;
    const n = batch.length;          // fn 이 묶음을 비워도(일찍 놓아 주려고) 끝 판정은 읽은 수로
    if (n) {
      last = keyOfRec(keyPath, batch[n - 1]);
      await fn(batch);
    }
    if (n < size) return;
  }
}

/** 압축 결과 조각을 이만큼 모이면 Blob 하나로 바꿔 놓아 준다. */
const GZ_PIECE_BYTES = 1024 * 1024;

/**
 * 평문 Blob → gzip Blob. 압축된 조각(Uint8Array)을 `GZ_PIECE_BYTES` 마다 작은 Blob 으로 바꿔 힙에서 놓아 준다.
 * `new Response(흐름).blob()` 은 압축 결과 전체(150MB 캐시면 약 22MB)를 조각째 쥐고 있다가 끝에 묶어 —
 * 힙 측정에서 압축 단계가 +35MB 를 더했다(b9c1 diag3).
 */
async function gzipBlob(plain) {
  const reader = plain.stream().pipeThrough(new CompressionStream('gzip')).getReader();
  const out = [];
  let pend = [];
  let pendBytes = 0;
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    pend.push(r.value);
    pendBytes += r.value.byteLength;
    if (pendBytes >= GZ_PIECE_BYTES) { out.push(new Blob(pend)); pend = []; pendBytes = 0; }
  }
  if (pend.length) out.push(new Blob(pend));
  return new Blob(out, { type: 'application/gzip' });
}

/** 스토어 하나의 내보낼 레코드 수(머리 줄 `counts`). settings·questions 는 걸러야 해서 훑는다(작다). */
async function countFor(d, store) {
  if (store === 'settings') {
    const rows = [];
    await d.iterate('settings', {}, (r) => { rows.push(r); });
    return settingsForBackup(rows).length;
  }
  if (store === 'questions') {
    let n = 0;
    await d.iterate('questions', {}, (q) => { if (q && q.source === 'ai') n++; });
    return n;
  }
  return Number(await d.count(store)) || 0;
}

/** 레코드 → 파일에 쓸 값(null = 쓰지 않음). */
function shape(store, v) {
  if (store === 'documents') return docForBackup(v);
  if (store === 'questions') return v && v.source === 'ai' ? v : null;
  return v || null;
}

/**
 * 백업 파일 하나를 만든다(호출 0 · 오프라인 ○).
 *
 * @param {{includeCache?:boolean, now?:number, onProgress?:(p:{store:string, done:number, total:number, phase:string})=>void,
 *          db?:Object, KeyRange?:Object, gzip?:boolean}} [opts]
 *   `includeCache` 기본 true(9c-Q2 — 번역 캐시 기본 담음). `gzip:false` 면 압축하지 않는다(시험용).
 * @returns {Promise<{blob:Blob, name:string, gz:boolean, rawBytes:number, bytes:number, counts:Object<string,number>, lines:number}>}
 */
export async function exportBackup(opts) {
  const o = opts || {};
  const d = o.db || realDb;
  const KeyRange = o.KeyRange || globalThis.IDBKeyRange;
  const includeCache = o.includeCache !== false;
  const nowMs = Number(o.now) || Date.now();
  const progress = typeof o.onProgress === 'function' ? o.onProgress : () => {};
  const stores = BACKUP.STORES.filter((s) => includeCache || s !== BACKUP.CACHE_STORE);

  // 1. 머리 줄 — 개수와 책 목록(가져오기 미리보기가 본문을 훑지 않고 이것만 읽는다)
  const counts = {};
  for (const s of stores) counts[s] = await countFor(d, s);
  const docs = [];
  await d.iterate('documents', {}, (doc) => {
    if (doc && doc.id != null) docs.push({ id: doc.id, title: doc.title, fileHash: doc.fileHash, pageCount: doc.pageCount });
  });

  const parts = [];
  let rawBytes = 0;
  let lines = 0;
  // 글자 목록을 그대로 Blob 으로 — `join` 으로 묶음 크기의 큰 글자를 한 번 더 만들지 않는다(힙 측정: 묶음 쓰레기 45 → 30MB, b9c1 diag2)
  const flush = (pieces) => {
    if (!pieces.length) return;
    const b = new Blob(pieces);
    rawBytes += b.size;
    parts.push(b);
  };
  flush([headLine({
    createdAt: new Date(nowMs).toISOString(), db: realDb.DB_VERSION, algo: algoVersion, hash: hasSubtle() ? 's256' : 'fnv',
    include: { cache: includeCache, settings: true }, counts: counts, docs: docs
  }), '\n']);
  lines++;

  // 2. 스토어마다 1,000줄씩
  const wrote = {};
  for (const s of stores) {
    wrote[s] = 0;
    progress({ store: s, done: 0, total: counts[s], phase: 'read' });
    if (s === 'settings') {
      const rows = [];
      await d.iterate('settings', {}, (r) => { rows.push(r); });
      const pieces = [];
      for (const r of settingsForBackup(rows)) { pieces.push(recLine(s, r), '\n'); wrote[s]++; }
      flush(pieces);
      lines += wrote[s];
      progress({ store: s, done: wrote[s], total: counts[s], phase: 'read' });
      continue;
    }
    await eachBatch(d, KeyRange, s, BACKUP.BATCH, async (batch) => {
      const pieces = [];
      let n = 0;
      for (let i = 0; i < batch.length; i++) {
        const v = shape(s, batch[i]);
        if (v) { pieces.push(recLine(s, v), '\n'); n++; }
      }
      batch.length = 0;
      flush(pieces);
      wrote[s] += n;
      lines += n;
      progress({ store: s, done: wrote[s], total: Math.max(counts[s], wrote[s]), phase: 'read' });
    });
  }

  // 3. 끝 줄 — 실제로 쓴 개수(머리 줄과 다르면 가져오기가 끝에 한 줄로 알린다)
  flush([endLine(wrote), '\n']);
  lines++;

  const plain = new Blob(parts, { type: 'application/x-ndjson' });
  parts.length = 0;
  const gz = o.gzip !== false && canGzip();
  let blob = plain;
  if (gz) {
    progress({ store: '', done: 0, total: 0, phase: 'compress' });
    blob = await gzipBlob(plain);
  }
  return { blob: blob, name: backupFileName(nowMs, gz), gz: gz, rawBytes: rawBytes, bytes: blob.size, counts: wrote, lines: lines };
}

/**
 * 번역 캐시 크기(바이트) — 카드의 `☑ 저장된 번역 포함(약 n MB)`. 8c-2 `cache.stats()` 와 **같은 셈**(`sizeBytes` 합)이다.
 * `ai/cache.js` 를 부르지 않는 까닭: 설정 화면 모듈이 이 카드를 import 하므로, 거기서 `ai/cache.js` 를 끌어오면
 * 8d 의 "inlinetr 의 import 고리에 캐시가 없다" 약속(tests/inlinetr-8d D8)이 깨진다. 백업 서비스는 원래 `aiCache` 를 읽는다.
 * @returns {Promise<{count:number, bytes:number}>}
 */
export async function cacheSize(opts) {
  const d = (opts && opts.db) || realDb;
  let count = 0;
  let bytes = 0;
  await d.iterate(BACKUP.CACHE_STORE, {}, (v) => { count++; bytes += (v && Number(v.sizeBytes)) || 0; });
  return { count: count, bytes: bytes };
}

/**
 * 책별 PDF 원본 목록(17-4-1 2 — 파일 안에는 없다). blob 이 있는 문서만, Blob 은 읽지 않는다(키만).
 * @returns {Promise<{id:string, title:string, fileName:string, size:number}[]>}
 */
export async function pdfList(opts) {
  const d = (opts && opts.db) || realDb;
  const have = new Set((await d.keysOf('blobs')).map(String));
  const out = [];
  await d.iterate('documents', {}, (doc) => {
    if (doc && have.has(String(doc.id))) {
      out.push({ id: String(doc.id), title: String(doc.title || ''), fileName: String(doc.fileName || ''), size: Number(doc.size) || 0 });
    }
  });
  return out;
}

/**
 * 책 하나의 PDF 원본 Blob(없으면 null). 화면이 `<a download>` 로 내려받는다.
 * @param {string} docId
 * @returns {Promise<{blob:Blob, name:string}|null>}
 */
export async function pdfBlob(docId, opts) {
  const d = (opts && opts.db) || realDb;
  const [rec, doc] = await Promise.all([d.get('blobs', docId), d.get('documents', docId)]);
  const blob = rec && rec.blob;
  if (!blob || typeof blob.size !== 'number') return null;
  let name = String((doc && (doc.fileName || doc.title)) || 'medreader');
  if (!/\.pdf$/i.test(name)) name += '.pdf';
  return { blob: blob, name: name };
}
