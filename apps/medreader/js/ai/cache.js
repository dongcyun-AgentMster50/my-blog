/* ============================================================
   MedReader — AI 결과 캐시 (spec 7-5 · 9-2 `aiCache` · 15절)

   ── 서비스 계층이다(3-1) ────────────────────────────────
   `config`·`hash`·`db` 만 import 한다. DOM 을 모르고 문구를 만들지 않는다.
   `db` 는 주입받을 수 있다 — 테스트가 IndexedDB 없이 전수 검증한다.

   ── 키 (7-5) ────────────────────────────────────────────
     `${kind}|${target}|${docId}|${hash(normalize(text))}${extra ? '|' + extra : ''}`
   - 번역의 `text` 는 **`Unit.src`**(7-8-2). 낭독 동반 번역과 줄 탭 번역이 같은 `src` 를
     쓰므로 같은 키다. **두 경로 모두 `kind = 'translate'`** 로 키를 만든다 —
     `'readalong'` 은 사용량(`usage.byKind`)의 구분일 뿐 캐시의 구분이 아니다.
   - 원문 언어·청크 경계·`provider`·`model`·`promptVersion` 은 **키에 넣지 않는다.**
     모델을 바꿔도 받은 번역은 유효하다(재호출 = 비용). 값에만 적는다.

   ── 상한 (7-5) ──────────────────────────────────────────
   `ai.cacheLimitMB`(기본 200) 를 넘으면 `createdAt` 오래된 순으로 지운다(상한의 90% 까지).
   전체 크기는 처음 한 번 훑어 세고 그 뒤로는 넣고 뺄 때마다 고친다. 상한을 넘었다고
   보일 때는 **다시 훑어 정확히 센 뒤** 지운다 — 서재가 `db.deleteDocument` 로 문서를
   지우면(캐시를 거치지 않는다) 이 수가 실제보다 크게 남기 때문이다.
   ============================================================ */

import { PIPELINE } from '../config.js';
import { cacheKey } from '../hash.js';
import * as realDb from '../db.js';

export const STORE = 'aiCache';

/** 7-5 — 번역 캐시의 `kind`. 탭·낭독 두 경로가 같은 값을 쓴다. */
export const TRANSLATE_KIND = 'translate';

/** 사용량의 종류(`translate`·`readalong`) → 캐시의 종류. 번역 계열은 하나로 모은다. */
export function cacheKindOf(kind) {
  return kind === 'readalong' || kind === 'translate' || !kind ? TRANSLATE_KIND : String(kind);
}

/** 7-5 키. `kind` 가 `readalong` 이어도 `translate` 키가 나온다. */
export function keyFor(docId, text, targetLang, kind, extra) {
  return cacheKey(String(docId), String(text == null ? '' : text), String(targetLang), cacheKindOf(kind), extra || '');
}

/** 대략의 저장 크기(바이트) — JSON 글자 수 × 2(UTF-16). 정확도보다 일관성이 중요하다. */
export function sizeOf(record) {
  let n = 0;
  try { n = JSON.stringify(record).length; } catch (e) { n = 0; }
  return n * 2;
}

/**
 * 캐시 하나. 앱은 기본 인스턴스(`defaultCache`)를 쓰고, 테스트는 `db` 를 주입한다.
 *
 * @param {{db?:Object, now?:()=>number, limitBytes?:()=>number}} [deps]
 *   `db` 는 `get`·`putAll`·`del`·`iterate`·`keysOf` 를 가진 객체(`js/db.js` 와 같은 모양).
 *   `limitBytes` 는 호출마다 읽는다 — 설정에서 상한을 바꾸면 다음 쓰기부터 따른다.
 */
export function createCache(deps) {
  const d = deps || {};
  const db = d.db || realDb;
  const now = typeof d.now === 'function' ? d.now : () => Date.now();
  const limitBytes = typeof d.limitBytes === 'function'
    ? d.limitBytes
    : () => PIPELINE.CACHE_LIMIT_MB * 1024 * 1024;

  let total = null;   // 알려진 전체 크기. null = 아직 안 셌다.
  let chain = Promise.resolve();

  /** 쓰기·지우기를 한 줄로 세운다 — 크기 셈이 엇갈리지 않게. */
  function serial(fn) {
    const run = () => fn();
    const p = chain.then(run, run);
    chain = p.then(() => {}, () => {});
    return p;
  }

  async function recount() {
    let n = 0;
    await db.iterate(STORE, {}, (v) => { n += (v && Number(v.sizeBytes)) || 0; });
    total = n;
    return n;
  }

  /**
   * 여러 키를 한 번에 찾는다. **없는 키는 결과에 없다.**
   * @param {string[]} keys
   * @returns {Promise<Map<string, Object>>} 키 → 레코드
   */
  async function getMany(keys) {
    const list = Array.isArray(keys) ? keys : [];
    const out = new Map();
    const uniq = Array.from(new Set(list));
    const rows = await Promise.all(uniq.map((k) => Promise.resolve(db.get(STORE, k)).catch(() => undefined)));
    for (let i = 0; i < uniq.length; i++) if (rows[i]) out.set(uniq[i], rows[i]);
    return out;
  }

  /**
   * 여러 결과를 한 트랜잭션으로 넣고, 상한을 넘으면 오래된 것부터 지운다.
   * @param {{key:string, docId:string, kind:string, targetLang:string, result:*,
   *          provider?:string, model?:string, promptVersion?:number, repaired?:boolean}[]} entries
   * @returns {Promise<{put:number, evicted:number}>}
   */
  function putMany(entries) {
    return serial(async () => {
      const list = Array.isArray(entries) ? entries : [];
      if (!list.length) return { put: 0, evicted: 0 };
      if (total === null) await recount();
      const at = now();
      const rows = [];
      const seen = new Set();
      for (let i = 0; i < list.length; i++) {
        const e = list[i] || {};
        if (!e.key || seen.has(e.key)) continue;
        seen.add(e.key);
        const rec = {
          key: String(e.key),
          kind: cacheKindOf(e.kind),
          docId: String(e.docId),
          targetLang: String(e.targetLang || ''),
          result: e.result,
          provider: e.provider || null,
          model: e.model || null,
          promptVersion: Number.isFinite(e.promptVersion) ? e.promptVersion : null,
          repaired: !!e.repaired,
          createdAt: at,
          hits: 0,
          sizeBytes: 0
        };
        rec.sizeBytes = sizeOf(rec);
        rows.push(rec);
      }
      // 같은 키를 덮어쓰면 옛 크기가 빠진다. 옛 레코드를 읽어 셈을 맞춘다.
      const prev = await getMany(rows.map((r) => r.key));
      await db.putAll(STORE, rows);
      for (let i = 0; i < rows.length; i++) {
        const old = prev.get(rows[i].key);
        total += rows[i].sizeBytes - ((old && Number(old.sizeBytes)) || 0);
      }
      const evicted = await enforceLimitNow();
      return { put: rows.length, evicted: evicted };
    });
  }

  /** 상한을 넘었으면 `createdAt` 오래된 순으로 상한의 90% 까지 지운다. 지운 수를 돌려준다. */
  async function enforceLimitNow() {
    const limit = Number(limitBytes());
    if (!Number.isFinite(limit) || limit <= 0) return 0;
    if (total === null) await recount();
    if (total <= limit) return 0;
    await recount();                       // 바깥에서 지운 것이 있을 수 있다 — 정확히 센다
    if (total <= limit) return 0;
    const target = Math.floor(limit * PIPELINE.CACHE_TRIM_NUM / PIPELINE.CACHE_TRIM_DEN);
    const victims = [];
    let left = total;
    await db.iterate(STORE, { index: 'createdAt' }, (v, k) => {
      if (left <= target) return false;
      victims.push({ key: v && v.key !== undefined ? v.key : k, size: (v && Number(v.sizeBytes)) || 0 });
      left -= (v && Number(v.sizeBytes)) || 0;
      return true;
    });
    for (let i = 0; i < victims.length; i++) {
      await db.del(STORE, victims[i].key);
      total -= victims[i].size;
    }
    return victims.length;
  }

  /**
   * 문서 하나의 캐시를 전부 지운다(`docId` 인덱스). 문서 삭제 경로(`db.deleteDocument`)도
   * `aiCache` 를 함께 쓸어 낸다 — 이 함수는 캐시만 지울 때 쓴다.
   * @returns {Promise<number>} 지운 수
   */
  function deleteDoc(docId) {
    return serial(async () => {
      const keys = await db.keysOf(STORE, 'docId', String(docId));
      let freed = 0;
      for (let i = 0; i < keys.length; i++) {
        const old = await db.get(STORE, keys[i]);
        freed += (old && Number(old.sizeBytes)) || 0;
        await db.del(STORE, keys[i]);
      }
      if (total !== null) total = Math.max(0, total - freed);
      return keys.length;
    });
  }

  /** 15절 화면용 — 항목 수와 크기. */
  function stats() {
    return serial(async () => {
      let count = 0;
      let bytes = 0;
      await db.iterate(STORE, {}, (v) => { count++; bytes += (v && Number(v.sizeBytes)) || 0; });
      total = bytes;
      return { count: count, bytes: bytes };
    });
  }

  return {
    getMany: getMany,
    putMany: putMany,
    deleteDoc: deleteDoc,
    stats: stats,
    enforceLimit: () => serial(enforceLimitNow),
    /** 바깥에서 스토어를 비웠을 때 — 다음 쓰기에서 다시 센다. */
    invalidate: () => { total = null; },
    _total: () => total
  };
}

let shared = null;

/** 앱 기본 인스턴스. 상한은 `ai.cacheLimitMB` 를 호출마다 읽게 `limitBytes` 를 넘긴다. */
export function defaultCache(limitBytes) {
  if (!shared) shared = createCache({ limitBytes: limitBytes });
  return shared;
}
