/* ============================================================
   MedReader — 낭독 동반 번역 서비스 (spec 7-8 · 7-6 · 15절)

   ── 서비스 계층이다(3-1 · 3-2) ──────────────────────────
   `config`·`hash`·`db`·`ai/cache`·`ai/pipeline`(상태 이름)·`tts/text`(순수 부분 —
   `buildUnits`·`sentencesOf`)만 import 한다. **화면 계층을 import 하지 않고 문구를 만들지 않는다** —
   상태 이름·사유 코드·이벤트만 낸다. 다음 쪽의 문단은 직접 만들지 않고 화면이 주입한
   `loadParas(pageNo)` 로 받는다(3-2). 언어는 값으로만 다룬다(특정 언어 코드를 적지 않는다 — 16-D2).

   ── 한 문서에 하나 ──────────────────────────────────────
     mem      문장 원문 키(`normalizeForHash(src)`) → {state, text?, code?}
              state: 'pending'(보냄·대기) · 'ready' · 'failed'(보냈다 실패 — 다시 보내지 않는다) ·
                     'blocked'(원격 상태가 ready 가 아니어서 보내지 않았다 — 돌아오면 보낸다)
              없으면 'none'. ★ 조회는 **번호가 아니라 문장 원문**으로 한다(7-8-2 원칙 3) —
              최악이 "그 문장만 번역 없음"이지, 엉뚱한 문장의 번역이 아니다.
     stream   쪽 번호 → 그 쪽의 문장 목록(`sentencesOf(buildUnits(paras,'sentence'))`) 또는
              'unextracted'(아직 추출 안 됨 — 그 경계에서 수집을 끊는다. 다음 refill 에 다시 묻는다)
     cursor   지금 발화 중인 문장 {page, seg}

   ── refill (7-8-3 그대로) ────────────────────────────────
     창      = 커서부터 `dist(s) < READ_AHEAD_CHARS`(= maxReqChars × READ_AHEAD_FACTOR, 기본 9,000)
     covered = 커서부터 연속으로 ready·pending·failed 인 문장의 글자 합(첫 빈 문장에서 멈춤)
     1. 원격 상태가 ready 가 아니면 창 안 빈 문장을 blocked 로 — **요청 0건**(RA4)
     2. 냉시작이 아니면: 떠 있는 요청이 있으면 끝(최대 1), covered > 창 − maxReqChars 면 끝(아직 이르다)
     3. 창 안을 걸으며 빈 문장을 모은다 — 캐시 적중은 ready 로 올리고 건너뛴다,
        failed·pending 은 건너뛴다, 미추출 쪽을 만나면 **기다리지 않고** 거기서 끊는다
     4. 냉시작이면 head(HEAD_CHARS) 를 먼저 떼어 보낸다 — 이때만 떠 있는 요청이 2개
     5. 남은 것에서 누적 maxReqChars 이하(문장 경계)를 한 청크로 보낸다
   **창 밖은 요청하지 않는다**(자동 전체 번역 없음 — RA3). 자동 재시도는 파이프라인의 상한뿐.

   ── 원격 상태 이벤트 거르기 (8a Review 주의) ───────────
   파이프라인은 성공 호출마다 `inflight → ready` 를 낸다. 그것을 "돌아왔다"로 읽으면
   매 호출마다 회복 처리(알림 거두기·blocked 재전송)가 돈다. **이전 상태(`prev`)가 막힌
   상태였을 때만** 회복으로 본다.
   ============================================================ */

import { READALONG, PIPELINE } from '../config.js';
import { buildUnits, sentencesOf } from '../tts/text.js';
import { normalizeForHash } from '../hash.js';
import { keyFor as realKeyFor, defaultCache } from './cache.js';
import { STATES, SEG } from './pipeline.js';
import * as realDb from '../db.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분
   ──────────────────────────────────────────────────────── */

/** 9-3 `readalong.mode`. */
export const MODES = Object.freeze(['off', 'show', 'speak']);

/** 유효 모드의 사유 코드(7-8-1 표의 "안내" 칸). 문구는 화면이 고른다. */
export const REASON = Object.freeze({
  OFF: 'off',
  CONSENT: 'consent',
  UNSUPPORTED_LANG: 'unsupported-lang',
  SAME_LANG: 'same-lang',
  LINE_MODE: 'line-mode',
  NO_KEY: 'no-key',
  NO_VOICE: 'no-voice'
});

/** 안내를 한 번 내는 사유(7-8-1 "안내 (한 번)" 칸이 비어 있지 않은 줄). `off` 는 사용자가 고른 것이라 없다. */
const NOTICE_REASONS = Object.freeze([
  REASON.CONSENT, REASON.UNSUPPORTED_LANG, REASON.SAME_LANG, REASON.LINE_MODE, REASON.NO_KEY, REASON.NO_VOICE
]);

/**
 * ★ 7-8-1 유효 모드. **위에서부터 처음 걸리는 줄이 이긴다**(RA1). 순수 함수.
 *
 * @param {{mode?:string, consented?:boolean, srcLang?:string, supportedSrc?:string[],
 *          targetLang?:string, unit?:string, hasKey?:boolean, trVoice?:boolean|null}} ctx
 *   `trVoice` — 번역문 음성: `false` 는 **실제 발화 오류**(첫 `tr` 발화 실패)뿐이다 ·
 *   `true`/`null`/생략은 시도한다. `[8b-1 — 오케스트레이터 결정 2026-10-10]` 음성 **목록에 없다는 것만으로
 *   `false` 로 두지 않는다** — 운영자 폰은 목록에 아랍어 0개였는데 `utterance.lang` 만으로 아랍어가 소리 났다.
 * @returns {{mode:'off'|'show'|'speak', reason:string|null}}
 */
export function effectiveMode(ctx) {
  const c = ctx || {};
  const mode = MODES.indexOf(c.mode) >= 0 ? c.mode : 'speak';     // 9-3 기본값
  const off = (reason) => ({ mode: 'off', reason: reason });
  if (mode === 'off') return off(REASON.OFF);
  if (!c.consented) return off(REASON.CONSENT);
  const supported = Array.isArray(c.supportedSrc) ? c.supportedSrc : [];
  if (!c.srcLang || supported.indexOf(c.srcLang) < 0) return off(REASON.UNSUPPORTED_LANG);
  if (c.srcLang === c.targetLang) return off(REASON.SAME_LANG);
  if (c.unit === 'line') return off(REASON.LINE_MODE);
  if (!c.hasKey) return off(REASON.NO_KEY);
  if (mode === 'speak' && c.trVoice === false) return { mode: 'show', reason: REASON.NO_VOICE };
  return { mode: mode, reason: null };
}

/** 창 크기와 선행 요청 문턱(7-8-6). `maxReqChars` 한 숫자에서 둘 다 나온다. */
export function windowOf(maxReqChars) {
  const v = Math.floor(Number(maxReqChars));
  const max = Number.isFinite(v) && v > 0 ? v : PIPELINE.MAX_REQ_CHARS;
  const ahead = Math.floor(max * READALONG.READ_AHEAD_FACTOR);
  return { maxReqChars: max, readAhead: ahead, lead: ahead - max };
}

/** 문장 원문 → 조회 키. 7-5 의 `normalize` 와 같다(캐시 키도 이것을 해시한다). */
export function srcKey(src) {
  return normalizeForHash(src == null ? '' : src);
}

function charCount(s) {
  let n = 0;
  for (const ch of String(s)) { if (ch) n++; }
  return n;
}

/** 원격 상태 중 "보내지 않는다"인 것들(7-8-4 · RA4). `inflight` 는 막힌 것이 아니다. */
const BLOCKING = new Set([
  STATES.COOLDOWN, STATES.EXHAUSTED, STATES.NO_KEY, STATES.OFFLINE, STATES.CAPPED, STATES.REGION, STATES.MODEL
]);
export function isBlockingState(name) { return BLOCKING.has(name); }

const UNEXTRACTED = 'unextracted';

/* ────────────────────────────────────────────────────────
   2. 서비스
   ──────────────────────────────────────────────────────── */

/**
 * @param {Object} deps
 * @param {{translate:Function, state:Function, onState:Function, retry:Function}} deps.pipeline  8a `createPipeline()`
 * @param {{getMany:Function}} [deps.cache]          기본 `defaultCache()`
 * @param {Function} [deps.keyFor]                   기본 `ai/cache.js` 의 `keyFor`(7-5)
 * @param {(pageNo:number)=>Promise<Array|null>} [deps.loadParas]  화면이 주입 — 그 쪽의 `flowParasOf(...)`, 미추출이면 null
 * @param {(key:string)=>*} [deps.getSetting]       `ai.maxReqChars` 읽기
 * @param {(docId:string, delta:{pages:number, chars:number})=>Promise} [deps.saveReadStats] 기본 db 한 트랜잭션
 */
export function createReadalong(deps) {
  const d = deps || {};
  const pipeline = d.pipeline;
  const cache = d.cache || defaultCache();
  const keyFor = typeof d.keyFor === 'function' ? d.keyFor : realKeyFor;
  const loadParas = typeof d.loadParas === 'function' ? d.loadParas : () => Promise.resolve(null);
  const getSetting = typeof d.getSetting === 'function' ? d.getSetting : () => undefined;
  const saveReadStats = typeof d.saveReadStats === 'function' ? d.saveReadStats : defaultSaveReadStats;
  const headChars = () => (Number.isFinite(d.headChars) ? d.headChars : READALONG.HEAD_CHARS);
  const bus = new EventTarget();

  /* ── 문서 ─────────────────────────────────────────── */
  let doc = { id: null, lang: '', target: '', pageCount: 0 };
  let docGen = 0;                       // 문서가 바뀌면 늦게 온 응답을 버린다
  let mem = new Map();                  // srcKey → {state, text?, code?}
  let stream = new Map();               // page → sentence[] | 'unextracted'
  let missed = new Set();               // 캐시에서 찾아봤는데 없던 키(같은 문장을 매번 다시 찾지 않는다)
  let counted = new Set();              // readStats 에 이미 센 쪽
  let readStats = { pages: 0, chars: 0 };
  let cursor = null;                    // {page, seg}

  /* ── 요청 ─────────────────────────────────────────── */
  let regularInflight = 0;
  let headInflight = 0;
  let active = false;                   // 낭독 중일 때만 요청한다(7-8-3 onQueue)
  let mode = { mode: 'off', reason: REASON.OFF };
  const noticed = new Set();            // 사유별 안내 한 번
  let lastAnnounced = null;             // 원격 상태 안내 — 전이 때 한 번(RA4)
  let running = null;                   // refill 직렬화
  let again = false;
  const log = { calls: 0, chars: 0, requests: [], maxInflight: 0 };
  const changeFns = new Map();          // srcKey → Set<fn>

  function emit(type, detail) { bus.dispatchEvent(new CustomEvent(type, { detail: detail })); }

  function settingMaxReq() { return windowOf(getSetting('ai.maxReqChars')); }

  function setMem(key, rec, s) {
    mem.set(key, rec);
    const detail = { key: key, src: s ? s.src : null, page: s ? s.page : null, seg: s ? s.seg : null,
      state: rec.state, text: rec.text, code: rec.code || null };
    const fns = changeFns.get(key);
    if (fns) Array.from(fns).forEach((fn) => { try { fn(detail); } catch (e) { /* 구독자 오류 */ } });
    emit('change', detail);
  }

  /* ── 쪽 → 문장 ─────────────────────────────────────── */

  function sentencesFromUnits(page, units) {
    const list = sentencesOf(units);
    return list.map((s) => ({
      page: page, seg: s.seg, src: s.src, frag: s.frag, key: srcKey(s.src), chars: charCount(s.src), cacheKey: null
    }));
  }

  function countPage(page, list) {
    if (counted.has(page) || mode.mode === 'off') return;
    counted.add(page);
    const chars = list.reduce((n, s) => n + s.chars, 0);
    readStats = { pages: readStats.pages + 1, chars: readStats.chars + chars };
    emit('readstats', { docId: doc.id, page: page, pages: readStats.pages, chars: readStats.chars });
    const id = doc.id;
    Promise.resolve().then(() => saveReadStats(id, { pages: 1, chars: chars })).catch(() => { /* 지표 저장 실패가 낭독을 막지 않는다 */ });
  }

  function putPage(page, list) {
    stream.set(page, list);
    countPage(page, list);
  }

  /** 그 쪽 문장. 미추출·범위 밖이면 null(그 경계에서 끊는다 — 기다리지 않는다). */
  async function pageSentences(page) {
    const have = stream.get(page);
    if (Array.isArray(have)) return have;
    if (doc.pageCount > 0 && page > doc.pageCount) return null;
    if (page < 1) return null;
    const g = docGen;
    let paras = null;
    try { paras = await loadParas(page); } catch (e) { paras = null; }
    if (g !== docGen) return null;
    if (!Array.isArray(paras)) { stream.set(page, UNEXTRACTED); return null; }
    // 다른 refill 이 그 사이에 넣었으면 그것을 쓴다(같은 쪽을 두 번 세지 않게).
    const again2 = stream.get(page);
    if (Array.isArray(again2)) return again2;
    const list = sentencesFromUnits(page, buildUnits(paras, 'sentence', { lang: doc.lang || undefined }));
    putPage(page, list);
    return list;
  }

  /** 커서 문장의 자리. 없으면 그 쪽에서 seg 가 커서 이상인 첫 문장. */
  function cursorIndex(list) {
    if (!cursor) return 0;
    for (let i = 0; i < list.length; i++) if (list[i].seg >= cursor.seg) return i;
    return list.length;
  }

  function stateOf(key) { const r = mem.get(key); return r ? r.state : 'none'; }
  function isEmpty(key) { const s = stateOf(key); return s === 'none' || s === SEG.BLOCKED; }

  /** 덮인 거리 — **알고 있는** 흐름만 걷는다(동기). 첫 빈 문장에서 멈춘다. */
  function coveredChars() {
    if (!cursor) return 0;
    let sum = 0;
    for (let page = cursor.page; ; page++) {
      const list = stream.get(page);
      if (!Array.isArray(list)) return sum;
      for (let i = page === cursor.page ? cursorIndex(list) : 0; i < list.length; i++) {
        if (isEmpty(list[i].key)) return sum;
        sum += list[i].chars;
      }
    }
  }

  /**
   * 커서 문장 — 커서 쪽에 문장이 없으면(표뿐인 쪽 등) **알고 있는 흐름에서 그다음 문장**.
   * 냉시작 판정은 이것이 비었는가로 한다(빈 쪽에 섰다고 냉시작으로 보지 않는다 — 실측에서 head 가 더 나갔다).
   */
  function cursorSentence() {
    if (!cursor) return null;
    for (let page = cursor.page; ; page++) {
      const list = stream.get(page);
      if (!Array.isArray(list)) return null;
      const i = page === cursor.page ? cursorIndex(list) : 0;
      if (i < list.length) return list[i];
    }
  }

  /**
   * 창 안을 커서부터 걸으며 빈 문장을 모은다(읽기 순서). `dist` 를 적어 둔다(RA3 기록).
   * ★ 다음 쪽을 부르기 **전에** 거리를 본다 — 창 밖 쪽은 불러오지도 않는다.
   */
  async function collectWindow(readAhead) {
    const out = [];
    const seen = new Set();
    if (!cursor) return out;
    let dist = 0;
    let empties = 0;
    for (let page = cursor.page; ; page++) {
      if (dist >= readAhead) break;
      const list = await pageSentences(page);
      if (!list) break;                                  // 미추출·끝 — 기다리지 않고 끊는다
      if (!list.length) { if (++empties > READALONG.MAX_EMPTY_PAGES) break; continue; }
      empties = 0;
      for (let i = page === cursor.page ? cursorIndex(list) : 0; i < list.length; i++) {
        if (dist >= readAhead) break;
        const s = list[i];
        s.dist = dist;
        if (isEmpty(s.key) && !seen.has(s.key)) { seen.add(s.key); out.push(s); }
        dist += s.chars;
      }
    }
    return out;
  }

  /** 캐시 적중은 ready 로 올리고, 남은 빈 문장만 돌려준다. */
  async function dropCached(list) {
    const need = list.filter((s) => !missed.has(s.key) && stateOf(s.key) === 'none');
    if (!need.length) return list;
    const g = docGen;
    const keys = await Promise.all(need.map(async (s) => {
      if (!s.cacheKey) s.cacheKey = await keyFor(doc.id, s.src, doc.target, 'readalong');
      return s.cacheKey;
    }));
    let hits = new Map();
    try { hits = await cache.getMany(keys); } catch (e) { hits = new Map(); }
    if (g !== docGen) return [];
    for (let i = 0; i < need.length; i++) {
      const rec = hits.get(keys[i]);
      if (rec && typeof rec.result === 'string') setMem(need[i].key, { state: SEG.READY, text: rec.result, cached: true }, need[i]);
      else missed.add(need[i].key);
    }
    return list.filter((s) => isEmpty(s.key));
  }

  /** 앞에서부터 누적 `limit` 이하(문장 경계). 한 문장이 상한보다 길면 그것 하나. */
  function take(list, limit) {
    const out = [];
    let sum = 0;
    while (list.length && (out.length === 0 || sum + list[0].chars <= limit)) {
      sum += list[0].chars;
      out.push(list.shift());
    }
    return out;
  }

  function announceRemote(state, prev, code, until) {
    if (state === lastAnnounced) return;
    lastAnnounced = state;
    emit('remote', { state: state, prev: prev || null, code: code || null, until: until || 0 });
  }

  /* ── 보내기 ───────────────────────────────────────── */

  async function send(list, opts) {
    const o = opts || {};
    if (!list.length) return;
    const g = docGen;
    for (const s of list) setMem(s.key, { state: 'pending' }, s);
    if (o.head) headInflight++; else regularInflight++;
    const inflightNow = headInflight + regularInflight;
    if (inflightNow > log.maxInflight) log.maxInflight = inflightNow;
    const chars = list.reduce((n, s) => n + s.chars, 0);
    log.requests.push({
      head: !!o.head, retry: !!o.retry, chars: chars, inflight: inflightNow,
      sentences: list.map((s) => ({ page: s.page, seg: s.seg, dist: s.dist, chars: s.chars, frag: s.frag }))
    });
    log.calls++;
    log.chars += chars;
    emit('request', { head: !!o.head, chars: chars, sentences: list.length, inflight: inflightNow });

    let r = null;
    try {
      r = await pipeline.translate(list.map((s) => ({ text: s.src, frag: s.frag })), {
        src: doc.lang, target: doc.target, kind: 'readalong', docId: doc.id, retry: !!o.retry
      });
    } catch (e) {
      r = null;
    } finally {
      if (o.head) headInflight--; else regularInflight--;
    }
    if (g !== docGen) return;
    const results = (r && Array.isArray(r.results)) ? r.results : [];
    for (let i = 0; i < list.length; i++) {
      const x = results[i] || { state: SEG.FAILED, code: 'UNKNOWN' };
      let rec;
      if (x.state === SEG.READY) rec = { state: SEG.READY, text: String(x.text == null ? '' : x.text) };
      // 막혀서 못 보냈다는 답인데 원격 상태가 막힌 상태가 아니면(예: 호출자 abort) 다시 보내면 같은 일이
      // 되풀이된다 — 무한 요청을 막으려고 그때는 failed 로 둔다(사용자 [다시 시도]만 다시 보낸다).
      else if (x.state === SEG.BLOCKED) rec = BLOCKING.has(pipeline.state())
        ? { state: SEG.BLOCKED, code: x.code || null } : { state: SEG.FAILED, code: x.code || null };
      else rec = { state: SEG.FAILED, code: x.code || null };          // failed · skipped
      setMem(list[i].key, rec, list[i]);
      if (rec.state === SEG.READY) missed.delete(list[i].key);
    }
    kick();                                                              // 끝나면 다음을 볼 기회
  }

  /* ── refill ───────────────────────────────────────── */

  function kick() {
    if (running) { again = true; return running; }
    running = (async () => {
      try {
        do { again = false; await refillOnce(); } while (again);
      } finally {
        running = null;
      }
    })();
    return running;
  }

  async function refillOnce() {
    if (!active || mode.mode === 'off' || !cursor || !doc.id) return;
    const win = settingMaxReq();
    const remote = pipeline.state();
    const blocking = BLOCKING.has(remote);
    const cur = cursorSentence();
    const cold = !cur || isEmpty(cur.key);

    if (blocking) {
      announceRemote(remote, null, null, 0);
      // 보내지 않은 것(7-6). 요청 0건 — 캐시에 있는 것은 그래도 보인다(14-1 오프라인 캐시 ○).
      const cand = await dropCached(await collectWindow(win.readAhead));
      for (const s of cand) if (stateOf(s.key) !== SEG.BLOCKED) setMem(s.key, { state: SEG.BLOCKED, code: remote }, s);
      return;
    }
    if (!cold && regularInflight > 0) return;                          // 한 번에 하나
    if (!cold && coveredChars() > win.lead) return;                    // 아직 이르다

    const cand = await dropCached(await collectWindow(win.readAhead));
    if (!active || mode.mode === 'off') return;
    if (BLOCKING.has(pipeline.state())) { again = true; return; }       // 그 사이 막혔다 — 위 분기가 표시한다
    if (!cand.length) return;
    const hc = headChars();
    const sends = [];
    if (cold && hc > 0 && headInflight === 0) sends.push(send(take(cand, hc), { head: true }));
    if (regularInflight === 0 && cand.length) sends.push(send(take(cand, win.maxReqChars)));
    // 기다리지 않는다 — 응답이 오면 send 가 다시 kick 한다. (refill 직렬화가 응답을 붙잡지 않게)
    sends.forEach((p) => p.catch(() => { }));
  }

  /* ── 원격 상태 (7-6) — prev 로 거른다 ─────────────── */
  let offState = null;
  if (pipeline && typeof pipeline.onState === 'function') {
    offState = pipeline.onState((ev) => {
      const e = ev || {};
      if (BLOCKING.has(e.state)) { announceRemote(e.state, e.prev, e.code, e.until); kick(); return; }
      // ★ 성공 호출마다 오는 inflight → ready 는 회복이 아니다. 막힌 상태에서 돌아왔을 때만.
      if (e.state === STATES.READY && BLOCKING.has(e.prev)) {
        lastAnnounced = null;
        emit('remote', { state: STATES.READY, prev: e.prev, code: null, until: 0 });
        kick();
      }
    });
  }

  /* ── 공개 API ─────────────────────────────────────── */

  /**
   * 문서·언어를 정한다. 문서나 대상 언어가 바뀌면 메모리를 비운다(늦게 온 응답은 버린다).
   * @param {{docId:string, lang:string, target:string, pageCount?:number, readStats?:{pages:number, chars:number}}} o
   */
  function setDoc(o) {
    const x = o || {};
    const next = { id: x.docId == null ? null : String(x.docId), lang: String(x.lang || ''), target: String(x.target || ''),
      pageCount: Number(x.pageCount) || 0 };
    const same = next.id === doc.id && next.lang === doc.lang && next.target === doc.target;
    doc = next;
    if (same) return;
    docGen++;
    mem = new Map();
    stream = new Map();
    missed = new Set();
    counted = new Set();
    cursor = null;
    const rs = x.readStats || {};
    readStats = { pages: Number(rs.pages) || 0, chars: Number(rs.chars) || 0 };
  }

  /**
   * 유효 모드 문맥(7-8-1). 바뀌면 `'mode'` 이벤트, 안내 사유에 처음 들어가면 `'notice'` 한 번,
   * 그 사유에서 벗어나면 `'notice-clear'`(음성이 생겼다 등 — 화면이 알림을 거둔다).
   * @returns {{mode:string, reason:string|null}}
   */
  function setContext(ctx) {
    const next = effectiveMode(ctx);
    const prev = mode;
    mode = next;
    if (prev.reason && prev.reason !== next.reason && noticed.has(prev.reason)) {
      noticed.delete(prev.reason);
      emit('notice-clear', { code: prev.reason });
    }
    if (next.reason && NOTICE_REASONS.indexOf(next.reason) >= 0 && !noticed.has(next.reason)) {
      noticed.add(next.reason);
      emit('notice', { code: next.reason, lang: next.reason === REASON.NO_VOICE ? (ctx && ctx.targetLang) || null
        : next.reason === REASON.UNSUPPORTED_LANG ? (ctx && ctx.srcLang) || null : null });
    }
    if (prev.mode !== next.mode || prev.reason !== next.reason) {
      emit('mode', { mode: next.mode, prev: prev.mode, reason: next.reason });
      if (next.mode !== 'off') kick();
    }
    return next;
  }

  /** 낭독 중인가(speaking). 멈춰 있으면 새 요청을 내지 않는다. */
  function setActive(on) {
    const was = active;
    active = !!on;
    if (active && !was) kick();
  }

  /**
   * speaker 가 쪽 큐를 새로 만들었다(play·쪽 넘김·reload). 그 쪽 문장을 흐름에 넣고 커서를 둔다.
   * 지나간 쪽(커서 앞)은 버린다.
   */
  function onQueue(page, units, seg) {
    const p = Math.floor(Number(page));
    if (!Number.isFinite(p)) return;
    const list = sentencesFromUnits(p, Array.isArray(units) ? units : []);
    putPage(p, list);
    for (const k of Array.from(stream.keys())) if (k < p) stream.delete(k);
    // mem 도 흐름에 남은 문장만(보내는 중인 것은 응답이 채운다).
    const live = new Set();
    stream.forEach((v) => { if (Array.isArray(v)) v.forEach((s) => live.add(s.key)); });
    for (const k of Array.from(mem.keys())) if (!live.has(k) && mem.get(k).state !== 'pending') mem.delete(k);
    cursor = { page: p, seg: Number.isInteger(seg) ? seg : (list.length ? list[0].seg : 0) };
    return kick();
  }

  /** linechange 마다 — 커서만 옮기고 refill. `seg` 가 없으면(표 안내) 커서를 두고 refill 만. */
  function onProgress(page, seg) {
    const p = Math.floor(Number(page));
    if (Number.isFinite(p) && Number.isInteger(seg)) cursor = { page: p, seg: seg };
    return kick();
  }

  /** ★ 동기 조회(6-2 — onend 안에서 await 하지 않는다). 키는 문장 원문. */
  function get(unitOrSrc) {
    const src = typeof unitOrSrc === 'string' ? unitOrSrc : (unitOrSrc && unitOrSrc.src);
    if (src == null) return { state: 'none' };
    const r = mem.get(srcKey(src));
    return r ? Object.assign({}, r) : { state: 'none' };
  }

  /** 그 문장의 상태가 바뀌면 `fn({state, text, code, …})`. 되돌림 함수를 준다. */
  function onChange(unitOrSrc, fn) {
    const src = typeof unitOrSrc === 'string' ? unitOrSrc : (unitOrSrc && unitOrSrc.src);
    const k = srcKey(src);
    if (!changeFns.has(k)) changeFns.set(k, new Set());
    changeFns.get(k).add(fn);
    return () => { const s = changeFns.get(k); if (s) { s.delete(fn); if (!s.size) changeFns.delete(k); } };
  }

  /**
   * ★ 사용자 [다시 시도](7-6 · 14-2). 원격 상태 `exhausted`·`cooldown`·`region`·`model` 을 즉시 ready 로
   * 돌리고(파이프라인 `retry()`), 창 안의 **보냈다 실패한** 문장을 `retry:true` 로 다시 보낸다.
   * 자동으로는 부르지 않는다 — 화면의 버튼(8b-2)만 부른다.
   * @returns {Promise<{state:string, resent:number}>}
   */
  async function retry() {
    let st = null;
    try { st = pipeline && typeof pipeline.retry === 'function' ? await pipeline.retry() : pipeline.state(); } catch (e) { st = pipeline.state(); }
    lastAnnounced = BLOCKING.has(st) ? lastAnnounced : null;
    let resent = 0;
    if (!BLOCKING.has(st) && cursor && mode.mode !== 'off') {
      const win = settingMaxReq();
      const failed = [];
      if (cursor) {
        let dist = 0;
        for (let page = cursor.page; dist < win.readAhead; page++) {
          const list = stream.get(page);
          if (!Array.isArray(list)) break;
          for (let i = page === cursor.page ? cursorIndex(list) : 0; i < list.length && dist < win.readAhead; i++) {
            if (stateOf(list[i].key) === SEG.FAILED) { list[i].dist = dist; failed.push(list[i]); }
            dist += list[i].chars;
          }
        }
      }
      // 한 청크씩 차례로 — 사용자가 누른 것이라도 한꺼번에 몰아 보내지 않는다.
      while (failed.length) {
        const chunk = take(failed, win.maxReqChars);
        resent += chunk.length;
        await send(chunk, { retry: true });
      }
    }
    await kick();
    return { state: st, resent: resent };
  }

  function dispose() {
    active = false;
    docGen++;
    if (offState) { try { offState(); } catch (e) { /* 이미 풀림 */ } }
    changeFns.clear();
  }

  return {
    addEventListener: bus.addEventListener.bind(bus),
    removeEventListener: bus.removeEventListener.bind(bus),
    setDoc: setDoc,
    setContext: setContext,
    setActive: setActive,
    onQueue: onQueue,
    onProgress: onProgress,
    get: get,
    onChange: onChange,
    retry: retry,
    dispose: dispose,
    /** 지금 유효 모드 `{mode, reason}`. */
    mode: () => Object.assign({}, mode),
    /** 지금 원격 상태 이름(파이프라인 그대로). */
    remoteState: () => pipeline.state(),
    /** 이 세션에 센 readStats(문서 레코드 값 + 이 세션 증분). */
    readStats: () => Object.assign({}, readStats),
    /** refill 이 끝날 때까지(테스트·측정). */
    idle: () => running || Promise.resolve(),
    /** 요청 기록(테스트·측정용 — 문장 원문은 담지 않는다). */
    stats: () => ({ calls: log.calls, chars: log.chars, maxInflight: log.maxInflight,
      inflight: headInflight + regularInflight, requests: log.requests.slice() })
  };
}

/**
 * readStats 를 문서 레코드에 더한다 — **한 트랜잭션** 안에서 읽고 쓴다(다른 필드를 옛 값으로 덮지 않게).
 * 요청 콜백 안에서 곧장 put 한다(트랜잭션이 await 사이에 닫히지 않도록).
 */
function defaultSaveReadStats(docId, delta) {
  if (docId == null) return Promise.resolve();
  return realDb.withTx('documents', 'readwrite', (tx, stores) => new Promise((resolve, reject) => {
    const st = stores.documents;
    const req = st.get(docId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const rec = req.result;
      if (!rec) { resolve(false); return; }
      const rs = rec.readStats || {};
      rec.readStats = {
        pages: (Number(rs.pages) || 0) + (Number(delta && delta.pages) || 0),
        chars: (Number(rs.chars) || 0) + (Number(delta && delta.chars) || 0)
      };
      const put = st.put(rec);
      put.onerror = () => reject(put.error);
      put.onsuccess = () => resolve(true);
    };
  }));
}
