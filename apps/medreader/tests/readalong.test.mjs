/* ============================================================
   tests/readalong.test.mjs — 8b-1 낭독 동반 번역 서비스 (spec 7-8 · 7-6 · 16-D3 RA1~RA6 · RA12~RA14)

   서비스(`ai/readalong.js`)를 **지어낸 문서**의 연속 낭독으로 몬다. 파이프라인은 둘 중 하나:
     · `fakePipeline` — 호출을 기록하고 손으로(또는 곧장) 응답하는 스텁(창·청크·상태 거르기를 본다)
     · 실제 `createPipeline` + fetch 스텁 + 메모리 캐시(RA13·[다시 시도] — 상태 기계를 그대로 지난다)
   문장은 지어낸 것이다(원서 문장 아님). 숫자는 결과가 아니라 **규칙**으로 확인한다 — 테스트가 커서·거리를
   따로 계산해 서비스의 기록과 견준다.
   ============================================================ */

// 캐시 키 해시의 끝나는 시점을 실제 시계에서 떼어 낸다(8b Review — 간헐 실패 원인, 픽스처 머리말 참고). 맨 먼저.
import './fixtures/sync-digest.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createReadalong, effectiveMode, windowOf, REASON, srcKey, isBlockingState
} from '../js/ai/readalong.js';
import { createPipeline, STATES } from '../js/ai/pipeline.js';
import { createCache, keyFor } from '../js/ai/cache.js';
import { buildUnits, sentencesOf } from '../js/tts/text.js';
import { READALONG } from '../js/config.js';
import { memDb, stubFetch, jsonRes, echoTranslate, settingsOf, manualTimers, FAKE_KEY } from './fixtures/ai-stubs-8a.mjs';

/* ── 지어낸 문서 ──────────────────────────────────────── */

const WORDS = ['the', 'patient', 'was', 'stable', 'and', 'resting', 'after', 'a', 'short', 'walk', 'with', 'family'];

/** 길이 약 `len` 자의 지어낸 문장. 대문자로 시작해 마침표로 끝난다(약어·숫자 없음). */
function sentence(tag, len) {
  let s = 'Note ' + tag;
  let i = 0;
  while (s.length < len - 1) s += ' ' + WORDS[i++ % WORDS.length];
  return s.slice(0, len - 1).replace(/\s+\S*$/, (m) => (m.length > 1 ? m : '')).trim() + '.';
}

/**
 * 쪽 → 문단 하나(줄 = 문장 하나). `spec` = 쪽마다 [문장 길이…]. `opts.headTail` 이면 1쪽 끝을 문장 중간에서
 * 끊고 2쪽이 소문자로 이어 시작한다(frag head/tail — RA14).
 */
function makeDoc(spec, opts) {
  const o = opts || {};
  const pages = {};
  for (let p = 1; p <= spec.length; p++) {
    const lines = spec[p - 1].map((len, i) => ({ id: p + ':' + i, text: sentence('p' + p + 's' + i, len), hyphen: 'none' }));
    pages[p] = [{ id: 'para' + p, kind: 'body', lines: lines }];
  }
  if (o.headTail && pages[1] && pages[2]) {
    pages[1][0].lines.push({ id: '1:ht', text: 'The final remark on this page continues', hyphen: 'none' });
    pages[2][0].lines.unshift({ id: '2:ht', text: 'onto the next page without a break.', hyphen: 'none' });
  }
  const sents = {};
  let total = 0;
  for (const p of Object.keys(pages)) {
    sents[p] = sentencesOf(buildUnits(pages[p], 'sentence')).map((s) => ({ seg: s.seg, src: s.src, chars: [...s.src].length, frag: s.frag }));
    total += sents[p].reduce((n, s) => n + s.chars, 0);
  }
  return { pages: pages, sents: sents, pageCount: spec.length, total: total };
}

const flush = async (n) => { for (let i = 0; i < (n || 30); i++) await new Promise((r) => setImmediate(r)); };

/* ── 손으로 응답하는 파이프라인 스텁 ─────────────────── */

function fakePipeline(o) {
  const opts = o || {};
  let st = opts.state || STATES.READY;
  const fns = new Set();
  const calls = [];
  const open = [];
  let inflight = 0;
  let maxInflight = 0;
  const p = {
    calls: calls,
    open: open,
    maxInflight: () => maxInflight,
    state: () => (st === STATES.READY && inflight > 0 ? STATES.INFLIGHT : st),
    onState: (fn) => { fns.add(fn); return () => fns.delete(fn); },
    set: (next) => { const prev = p.state(); st = next; fns.forEach((fn) => fn({ state: p.state(), prev: prev })); },
    retry: async () => { const prev = p.state(); st = STATES.READY; fns.forEach((fn) => fn({ state: p.state(), prev: prev })); return p.state(); },
    translate: (segs, ctx) => {
      const prev = p.state();
      inflight++;
      if (inflight > maxInflight) maxInflight = inflight;
      if (prev !== p.state()) fns.forEach((fn) => fn({ state: p.state(), prev: prev }));   // ready → inflight
      const rec = { segs: segs.map((s) => ({ text: s.text, frag: s.frag })), ctx: ctx };
      calls.push(rec);
      return new Promise((resolve) => {
        const answer = (fn) => {
          inflight--;
          const before = inflight === 0 ? STATES.INFLIGHT : null;
          resolve({ status: p.state(), calls: 1, results: rec.segs.map((s) => (fn ? fn(s) : { state: 'ready', text: 'TR(' + s.text + ')' })) });
          // 8a 파이프라인처럼 성공 호출마다 inflight → ready 를 낸다(8a Review 주의 — prev 로 거를 것).
          if (before && st === STATES.READY) fns.forEach((f) => f({ state: STATES.READY, prev: STATES.INFLIGHT }));
        };
        if (opts.answer) { Promise.resolve().then(() => answer(opts.answer)); return; }
        if (opts.auto !== false) { Promise.resolve().then(() => answer(null)); return; }
        open.push({ rec: rec, answer: answer });
      });
    },
    /** 떠 있는 요청 하나에 답한다(먼저 온 것부터). */
    answerNext: (fn) => { const x = open.shift(); if (x) x.answer(fn); return !!x; }
  };
  return p;
}

/** 메모리 캐시 스텁 — 실제 키(7-5)로 찾는다. */
function memCache(entries) {
  const m = new Map(entries || []);
  return { map: m, getMany: async (keys) => { const out = new Map(); for (const k of keys) if (m.has(k)) out.set(k, { result: m.get(k) }); return out; } };
}

const CTX = { mode: 'show', consented: true, srcLang: 'en', supportedSrc: ['en', 'fr', 'ko'], targetLang: 'xx', unit: 'sentence', hasKey: true };

function rig(doc, o) {
  const opts = o || {};
  const pipeline = opts.pipeline || fakePipeline(opts.pipe);
  const cache = opts.cache || memCache();
  const loads = [];
  const ra = createReadalong({
    pipeline: pipeline,
    cache: cache,
    headChars: opts.headChars,
    getSetting: (k) => (k === 'ai.maxReqChars' ? (opts.maxReq || 6000) : undefined),
    saveReadStats: opts.saveReadStats || (async () => { }),
    loadParas: async (n) => {
      loads.push({ page: n, cursor: cursorNow ? Object.assign({}, cursorNow) : null });
      if (opts.loadParas) return opts.loadParas(n);
      return doc.pages[n] ? doc.pages[n] : null;
    }
  });
  let cursorNow = null;
  const remote = [];
  ra.addEventListener('remote', (ev) => remote.push(ev.detail));
  ra.setDoc({ docId: opts.docId || 'doc1', lang: 'en', target: CTX.targetLang, pageCount: doc.pageCount });
  ra.setContext(Object.assign({}, CTX, opts.ctx || {}));
  ra.setActive(true);
  /** 연속 낭독 — 쪽마다 큐를 넣고 문장마다 진행. `onArrive(page, seg)` 가 도착 직전 상태를 본다. */
  async function readThrough(fromPage, toPage, onArrive, between) {
    for (let p = fromPage; p <= toPage; p++) {
      const units = buildUnits(doc.pages[p], 'sentence');
      const segs = doc.sents[p];
      cursorNow = { page: p, seg: segs.length ? segs[0].seg : 0 };
      ra.onQueue(p, units, segs.length ? segs[0].seg : null);
      await flush();
      for (let i = 0; i < segs.length; i++) {
        cursorNow = { page: p, seg: segs[i].seg };
        if (onArrive) onArrive(p, segs[i]);
        ra.onProgress(p, segs[i].seg);
        await flush();
        if (between) await between(p, segs[i]);
      }
    }
  }
  return { ra, pipeline, cache, loads, remote, readThrough };
}

/** 테스트가 따로 세는 거리 — 커서 문장부터 (page, seg) 직전까지의 글자 합. */
function distTo(doc, cursor, page, seg) {
  let d = 0;
  for (let p = cursor.page; p <= page; p++) {
    for (const s of doc.sents[p] || []) {
      if (p === cursor.page && s.seg < cursor.seg) continue;
      if (p === page && s.seg >= seg) return d;
      d += s.chars;
    }
  }
  return d;
}

/* ══ RA1 유효 모드 ══════════════════════════════════════ */

test('RA1 ★ effectiveMode — 7-8-1 표의 모든 줄을 그 순서대로(위 줄이 이긴다)', () => {
  const base = { mode: 'speak', consented: true, srcLang: 'en', supportedSrc: ['en', 'fr', 'ko'], targetLang: 'ar', unit: 'sentence', hasKey: true, trVoice: null };
  const em = (over) => effectiveMode(Object.assign({}, base, over));
  // 그 밖 — 모드 그대로
  assert.deepEqual(em({}), { mode: 'speak', reason: null });
  assert.deepEqual(em({ mode: 'show' }), { mode: 'show', reason: null });
  // 각 줄
  assert.deepEqual(em({ mode: 'off' }), { mode: 'off', reason: REASON.OFF });
  assert.deepEqual(em({ consented: false }), { mode: 'off', reason: REASON.CONSENT });
  assert.deepEqual(em({ srcLang: 'und' }), { mode: 'off', reason: REASON.UNSUPPORTED_LANG });
  assert.deepEqual(em({ targetLang: 'en' }), { mode: 'off', reason: REASON.SAME_LANG });
  assert.deepEqual(em({ unit: 'line' }), { mode: 'off', reason: REASON.LINE_MODE });
  assert.deepEqual(em({ hasKey: false }), { mode: 'off', reason: REASON.NO_KEY });
  assert.deepEqual(em({ trVoice: false }), { mode: 'show', reason: REASON.NO_VOICE });
  // 순서 — 위 줄이 이긴다(조건을 겹쳐 놓고 차례로 하나씩 푼다)
  const all = { mode: 'off', consented: false, srcLang: 'und', targetLang: 'ar', unit: 'line', hasKey: false, trVoice: false };
  const order = [['mode', 'speak', REASON.CONSENT], ['consented', true, REASON.UNSUPPORTED_LANG],
    ['srcLang', 'ar', REASON.SAME_LANG], ['targetLang', 'ko', REASON.LINE_MODE], ['unit', 'sentence', REASON.NO_KEY],
    ['hasKey', true, REASON.NO_VOICE], ['trVoice', true, null]];
  assert.equal(em(all).reason, REASON.OFF);
  const cur = Object.assign({}, all);
  for (const [k, v, want] of order) {
    cur[k] = v;
    // 'ar' 원문은 미지원이므로 SAME_LANG 줄을 보려면 지원 목록에 넣는다.
    const r = effectiveMode(Object.assign({}, base, cur, { supportedSrc: ['en', 'fr', 'ko', 'ar'] }));
    assert.equal(r.reason, want, k + ' 를 푼 뒤');
  }
  // show 모드에서 번역문 음성 없음은 상관없다
  assert.deepEqual(em({ mode: 'show', trVoice: false }), { mode: 'show', reason: null });
  // `[8b-1 결정]` 목록에 없다는 것만으로는 false 가 아니다 — null(모름)은 speak 를 지킨다
  assert.deepEqual(em({ trVoice: null }), { mode: 'speak', reason: null });
});

test('RA1b 창과 문턱은 maxReqChars 하나에서 나온다 (7-8-6)', () => {
  assert.deepEqual(windowOf(6000), { maxReqChars: 6000, readAhead: 9000, lead: 3000 });
  assert.deepEqual(windowOf(2000), { maxReqChars: 2000, readAhead: 3000, lead: 1000 });
  assert.deepEqual(windowOf(undefined), { maxReqChars: 6000, readAhead: 9000, lead: 3000 });
  assert.equal(READALONG.READ_AHEAD_FACTOR, 1.5);
});

/* ══ RA2 선행 요청 ══════════════════════════════════════ */

test('RA2 ★ 덮인 거리 > 3,000 동안 요청 0건 · 이하로 떨어진 첫 진행에서 정확히 1건 · 응답 전 진행이 더 와도 1건', async () => {
  const doc = makeDoc(Array.from({ length: 6 }, () => Array(20).fill(100)));   // 6쪽 × 20문장 × 100자
  const pipe = fakePipeline({ auto: false });
  const { ra, readThrough } = rig(doc, { pipeline: pipe });
  let firstLowSeen = false;
  let firstLowCalls = null;
  let afterLowChecks = 0;
  let done = false;
  let coveredBefore = 0;
  let callsBefore = 0;
  let highChecks = 0;
  let coldAnswered = false;
  // 진행 직전(커서는 새 문장, 상태는 진행 전)에 테스트가 따로 센 덮인 거리
  const onArrive = (p, s) => {
    callsBefore = pipe.calls.length;
    let covered = 0;
    outer: for (let q = p; q <= 6; q++) {
      for (const x of doc.sents[q]) {
        if (q === p && x.seg < s.seg) continue;
        const st = ra.get(x.src).state;
        if (st !== 'ready' && st !== 'pending') break outer;
        covered += x.chars;
      }
    }
    coveredBefore = covered;
  };
  await readThrough(1, 6, onArrive, async () => {
    if (done) return;
    // 냉시작(head + 첫 청크)에는 곧장 답한다
    if (!coldAnswered) { coldAnswered = true; assert.equal(pipe.calls.length, 2); while (pipe.open.length) pipe.answerNext(); await flush(); return; }
    if (!firstLowSeen) {
      if (coveredBefore > 3000) { highChecks++; assert.equal(pipe.calls.length, callsBefore, '덮인 거리 ' + coveredBefore + ' 인데 요청이 나갔다'); return; }
      firstLowSeen = true;
      firstLowCalls = pipe.calls.length;
      assert.equal(pipe.calls.length, callsBefore + 1, '문턱 아래로 떨어진 첫 진행에서 정확히 1건(덮인 거리 ' + coveredBefore + ')');
      return;
    }
    afterLowChecks++;
    assert.equal(pipe.calls.length, firstLowCalls, '응답 전 진행이 더 와도 1건');
    if (afterLowChecks >= 5) done = true;
  });
  assert.ok(highChecks >= 10, '문턱 위에서 여러 번 확인했다: ' + highChecks);
  assert.ok(firstLowSeen && afterLowChecks >= 5, '시험이 실제로 문턱을 지났다');
  assert.equal(pipe.calls[0].segs.length > 0 && ra.stats().requests[0].head, true, '첫 호출은 head');
});

/* ══ RA3 창 경계 ═══════════════════════════════════════ */

test('RA3 ★ 창 경계 — 20,000자 넘게 낭독하는 동안 요청된 모든 문장의 dist < 9,000 · 창 밖 쪽은 불러오지도 않는다 · 떠 있는 요청 ≤ 2(2는 냉시작 직후뿐)', async () => {
  const spec = [];
  for (let p = 0; p < 14; p++) spec.push(Array(p % 3 === 0 ? 30 : 15).fill(p % 2 ? 120 : 90));   // 쪽 크기를 섞는다
  const doc = makeDoc(spec);
  assert.ok(doc.total > 20000, '문서가 20,000자를 넘는다: ' + doc.total);
  const pipe = fakePipeline({ auto: false });
  const { ra, loads, readThrough } = rig(doc, { pipeline: pipe });
  let read = 0;
  await readThrough(1, 14, (p, s) => { read += s.chars; }, async () => {
    // 응답은 한 박자 늦게(떠 있는 동안 진행이 더 온다)
    if (pipe.open.length) { await flush(2); pipe.answerNext(); }
  });
  while (pipe.answerNext()) await flush();
  assert.ok(read > 20000);
  const reqs = ra.stats().requests;
  assert.ok(reqs.length >= 3, '요청이 여러 번 나갔다');
  for (const r of reqs) for (const s of r.sentences) assert.ok(s.dist < 9000, '창 밖 문장이 요청됐다: dist ' + s.dist);
  // loadParas 스파이 — 그 쪽 첫 문장의 거리(테스트가 따로 셈)가 9,000 이상인 쪽이 없다.
  for (const l of loads) {
    if (!l.cursor || !doc.sents[l.page]) continue;
    const first = doc.sents[l.page][0];
    const d = distTo(doc, l.cursor, l.page, first.seg);
    assert.ok(d < 9000, l.page + '쪽을 거리 ' + d + ' 에서 불러왔다');
  }
  assert.ok(ra.stats().maxInflight <= 2);
  assert.ok(pipe.maxInflight() <= 2);
  for (const r of reqs) if (r.inflight === 2) assert.ok(r.head || reqs[reqs.indexOf(r) - 1].head, '2개가 뜬 것은 냉시작(head) 직후뿐');
});

/* ══ RA4 막힌 원격 상태 ════════════════════════════════ */

for (const st of [STATES.EXHAUSTED, STATES.CAPPED, STATES.OFFLINE, STATES.REGION, STATES.MODEL, STATES.NO_KEY]) {
  test('RA4 ★ 원격 ' + st + ' — 쪽 10개를 지나도 translate 0건, 상태 알림 1건', async () => {
    const doc = makeDoc(Array.from({ length: 10 }, () => Array(12).fill(110)));
    const pipe = fakePipeline({ state: st });
    const { ra, remote, readThrough } = rig(doc, { pipeline: pipe });
    await readThrough(1, 10);
    assert.equal(pipe.calls.length, 0);
    assert.equal(remote.length, 1);
    assert.equal(remote[0].state, st);
    // 창 안 문장은 blocked 로 보인다(띠가 상태 한 줄을 그린다)
    assert.equal(ra.get(doc.sents[10][11].src).state, 'blocked');
  });
}

test('RA4b ★ prev 거르기 — 성공 호출마다 오는 inflight → ready 는 회복이 아니다(알림 0건)', async () => {
  const doc = makeDoc(Array.from({ length: 6 }, () => Array(20).fill(100)));
  const pipe = fakePipeline();
  const { remote, readThrough } = rig(doc, { pipeline: pipe });
  await readThrough(1, 6);
  assert.ok(pipe.calls.length >= 3, '호출이 여러 번 성공했다');
  assert.equal(remote.length, 0, '원격 상태 이벤트가 나지 않는다');
});

/* ══ RA5 offline → online ═════════════════════════════ */

test('RA5 ★ offline → online: 보내지 않은 것은 한 번 보내고, 보냈다 실패한 것은 [다시 시도] 전까지 다시 보내지 않는다', async () => {
  const doc = makeDoc(Array.from({ length: 4 }, () => Array(20).fill(100)));
  const FAILING = new Set([doc.sents[1][3].src, doc.sents[1][4].src]);
  const pipe = fakePipeline({ answer: (s) => (FAILING.has(s.text) ? { state: 'failed', code: 'RATIO' } : { state: 'ready', text: 'T' }) });
  const { ra, remote, readThrough } = rig(doc, { pipeline: pipe });
  // 1쪽 첫 문장에서 냉시작 → head + 청크. 실패 두 문장.
  const units1 = buildUnits(doc.pages[1], 'sentence');
  ra.onQueue(1, units1, 0);
  await flush();
  assert.equal(ra.get([...FAILING][0]).state, 'failed');
  const before = pipe.calls.length;
  // 오프라인 — 2쪽 이후는 보내지 않은 것(blocked)
  pipe.set(STATES.OFFLINE);
  await flush();
  await readThrough(1, 2);
  assert.equal(pipe.calls.length, before, '오프라인 동안 0건');
  const blockedSrc = doc.sents[4][15].src;
  assert.equal(ra.get(blockedSrc).state, 'blocked');
  // 온라인 — 막힌 상태에서 ready 로(prev = offline) → 창 안의 보내지 않은 것을 보낸다
  pipe.set(STATES.READY);
  await flush();
  const sentAfter = pipe.calls.slice(before).flatMap((c) => c.segs.map((s) => s.text));
  assert.ok(sentAfter.indexOf(blockedSrc) >= 0, '보내지 않은 것이 보내졌다');
  assert.equal(new Set(sentAfter).size, sentAfter.length, '한 번씩만');
  for (const f of FAILING) assert.ok(sentAfter.indexOf(f) < 0, '실패한 것은 다시 보내지 않는다');
  assert.equal(remote.map((r) => r.state).join(','), 'offline,ready', '상태 알림은 전이 때 한 번씩');
  // 사용자 [다시 시도] — 그제야 실패한 것을 retry:true 로
  const mark = pipe.calls.length;
  // 커서를 1쪽으로 되돌려(사용자가 앞으로 간 상황) 창에 실패 문장을 넣는다
  ra.onQueue(1, units1, 0);
  await flush();
  const r = await ra.retry();
  await flush();
  const retried = pipe.calls.slice(mark).filter((c) => c.ctx.retry);
  assert.equal(r.resent, 2);
  assert.deepEqual(retried.flatMap((c) => c.segs.map((s) => s.text)).sort(), [...FAILING].sort());
});

/* ══ RA6 냉시작 ═══════════════════════════════════════ */

test('RA6 ★ 냉시작 — head 는 커서 문장부터·합 ≤ HEAD_CHARS, 둘째 호출은 head 바로 다음부터, 겹치지 않는다', async () => {
  const doc = makeDoc([Array(30).fill(130), Array(30).fill(130)]);
  const pipe = fakePipeline({ auto: false });
  const { ra } = rig(doc, { pipeline: pipe });
  const units = buildUnits(doc.pages[1], 'sentence');
  const startSeg = doc.sents[1][7].seg;                 // 쪽 중간에서 재생(냉시작)
  ra.onQueue(1, units, startSeg);
  await flush();
  assert.equal(pipe.calls.length, 2, 'head + 첫 청크');
  const [head, chunk] = pipe.calls;
  const segOf = (txt) => doc.sents[1].find((s) => s.src === txt);
  assert.equal(segOf(head.segs[0].text).seg, startSeg, 'head 는 커서 문장부터');
  const headChars = head.segs.reduce((n, s) => n + [...s.text].length, 0);
  assert.ok(headChars <= READALONG.HEAD_CHARS, 'head 합 ' + headChars);
  const lastHead = segOf(head.segs[head.segs.length - 1].text).seg;
  assert.equal(segOf(chunk.segs[0].text).seg, lastHead + 1, '둘째 호출은 head 바로 다음');
  const a = new Set(head.segs.map((s) => s.text));
  assert.ok(chunk.segs.every((s) => !a.has(s.text)), '겹치지 않는다');
  assert.equal(ra.stats().requests[1].inflight, 2, '이때만 2개');
});

/* ══ RA12 청크 병합 ════════════════════════════════════ */

test('RA12a ★ 작은 쪽 — 1,900자 × 3쪽(문서 끝) → translate 1회, 그 호출이 세 쪽에 걸친다', async () => {
  const doc = makeDoc([Array(19).fill(100), Array(19).fill(100), Array(19).fill(100)]);
  const pipe = fakePipeline();
  const { ra, readThrough } = rig(doc, { pipeline: pipe, headChars: 0 });
  await readThrough(1, 3);
  assert.equal(pipe.calls.length, 1);
  const pages = new Set(ra.stats().requests[0].sentences.map((s) => s.page));
  assert.deepEqual([...pages].sort(), [1, 2, 3]);
});

test('RA12b ★ 큰 쪽 — 6,800자 1쪽 → 2회(6,000자 이하 + 나머지)', async () => {
  const doc = makeDoc([Array(68).fill(100)]);
  const pipe = fakePipeline();
  const { ra, readThrough } = rig(doc, { pipeline: pipe, headChars: 0 });
  await readThrough(1, 1);
  assert.equal(pipe.calls.length, 2);
  const reqs = ra.stats().requests;
  assert.ok(reqs[0].chars <= 6000 && reqs[0].chars > 5000, '첫 청크 ' + reqs[0].chars);
  assert.equal(reqs[0].chars + reqs[1].chars, doc.total);
});

test('RA12c ★ 캐시가 절반 찬 창 — 8,000자 중 앞 3,000자가 캐시 → 나머지만 1회, 캐시된 문장은 요청에 없다', async () => {
  const doc = makeDoc([Array(20).fill(100), Array(20).fill(100), Array(20).fill(100), Array(20).fill(100)]);
  const cachedSrc = [];
  for (const p of [1, 2]) for (const s of doc.sents[p]) if (cachedSrc.length < 30) cachedSrc.push(s.src);
  const entries = await Promise.all(cachedSrc.map(async (src) => [await keyFor('doc1', src, 'xx', 'readalong'), 'C']));
  const pipe = fakePipeline();
  const { ra, readThrough } = rig(doc, { pipeline: pipe, headChars: 0, cache: memCache(entries) });
  const cachedSet = new Set(cachedSrc);
  let arrivedCached = 0;
  await readThrough(1, 4, (p, s) => {
    if (cachedSet.has(s.src)) { arrivedCached++; assert.equal(ra.get(s.src).state, 'ready', '캐시 문장은 도착 때 ready'); }
  });
  assert.equal(arrivedCached, 30);
  assert.equal(pipe.calls.length, 1);
  const sent = pipe.calls[0].segs.map((s) => s.text);
  assert.ok(cachedSrc.every((s) => sent.indexOf(s) < 0), '캐시된 문장이 요청에 없다');
  assert.equal(sent.length, 80 - 30);
});

test('RA12d ★ 미추출 쪽에서 끊김 — loadParas(p+1) 이 null 이면 기다리지 않고 p 만, 나중에 데이터가 오면 다음 진행에서 p+1', async () => {
  const doc = makeDoc([Array(19).fill(100), Array(19).fill(100)]);
  let ready2 = false;
  let waited = false;
  const pipe = fakePipeline();
  const { ra } = rig(doc, {
    pipeline: pipe, headChars: 0,
    loadParas: (n) => {
      if (n === 2 && !ready2) return null;
      if (n === 2) { waited = true; }
      return doc.pages[n] || null;
    }
  });
  ra.onQueue(1, buildUnits(doc.pages[1], 'sentence'), 0);
  await flush();
  assert.equal(pipe.calls.length, 1);
  assert.ok(ra.stats().requests[0].sentences.every((s) => s.page === 1), '첫 호출은 전부 p');
  ready2 = true;                               // 추출이 끝났다
  ra.onProgress(1, doc.sents[1][1].seg);
  await flush();
  assert.ok(waited);
  assert.equal(pipe.calls.length, 2);
  assert.ok(ra.stats().requests[1].sentences.every((s) => s.page === 2), '다음 진행에서 p+1');
});

/* ══ RA13 청크 경계와 캐시 독립 (실제 파이프라인 + 캐시) ═══ */

function realRig(o) {
  const opts = o || {};
  const db = opts.db || memDb();
  const timers = manualTimers();
  const fetch = opts.fetch || stubFetch(echoTranslate());
  const cache = opts.cache || createCache({ db: db, now: () => 0 });
  const pipeline = createPipeline({
    fetch: fetch, db: db, cache: cache, getKey: () => FAKE_KEY,
    getSetting: settingsOf({ 'ai.maxReqChars': opts.maxReq || 6000 }),
    now: () => new Date(2026, 9, 10, 14).getTime(), isOnline: () => true,
    setTimer: timers.set, clearTimer: timers.clear, listen: false
  });
  return { db, fetch, cache, pipeline, timers };
}

test('RA13 ★ 청크 경계와 캐시 독립 — maxReqChars 6,000 으로 한 번, 2,000 으로 한 번 → 두 번째는 요청 0, 캐시 키 목록이 같다', async () => {
  const doc = makeDoc([Array(22).fill(100), Array(22).fill(100), Array(22).fill(100)]);
  const r1 = realRig({ maxReq: 6000 });
  const a = rig(doc, { pipeline: r1.pipeline, cache: r1.cache, maxReq: 6000, ctx: { targetLang: 'ar' } });
  a.ra.setDoc({ docId: 'doc1', lang: 'en', target: 'ar', pageCount: 3 });
  await a.readThrough(1, 3);
  const calls1 = r1.fetch.calls.length;
  assert.ok(calls1 >= 1);
  const keys1 = Array.from(r1.db.stores.get('aiCache').keys()).sort();
  assert.equal(keys1.length, 66, '모든 문장이 캐시에 들어갔다');
  const r2 = realRig({ maxReq: 2000, db: r1.db, cache: r1.cache, fetch: r1.fetch });
  const b = rig(doc, { pipeline: r2.pipeline, cache: r1.cache, maxReq: 2000, ctx: { targetLang: 'ar' } });
  b.ra.setDoc({ docId: 'doc1', lang: 'en', target: 'ar', pageCount: 3 });
  await b.readThrough(1, 3);
  assert.equal(r1.fetch.calls.length, calls1, '두 번째 실행은 네트워크 요청 0');
  assert.equal(b.ra.stats().calls, 0, 'translate 도 0');
  assert.deepEqual(Array.from(r1.db.stores.get('aiCache').keys()).sort(), keys1);
  assert.equal(b.ra.get(doc.sents[3][21].src).state, 'ready');
});

/* ══ RA14 쪽 경계 조각 ═════════════════════════════════ */

test('RA14 ★ 쪽 경계의 frag head·tail 두 조각이 한 청크 안에서 각각 하나의 segment 로 나란히 간다', async () => {
  const doc = makeDoc([Array(10).fill(100), Array(10).fill(100)], { headTail: true });
  const last1 = doc.sents[1][doc.sents[1].length - 1];
  const first2 = doc.sents[2][0];
  assert.equal(last1.frag, 'head');
  assert.equal(first2.frag, 'tail');
  const pipe = fakePipeline();
  const { readThrough } = rig(doc, { pipeline: pipe, headChars: 0 });
  await readThrough(1, 2);
  const segs = pipe.calls.flatMap((c) => c.segs);
  const i = segs.findIndex((s) => s.text === last1.src);
  assert.ok(i >= 0);
  assert.equal(segs[i].frag, 'head');
  assert.equal(segs[i + 1].text, first2.src, '바로 다음 segment');
  assert.equal(segs[i + 1].frag, 'tail');
  assert.ok(!segs.some((s) => s.text.indexOf(last1.src + ' ' + first2.src) >= 0), '합쳐지지 않는다');
});

/* ══ [다시 시도] — 실제 파이프라인의 막힌 상태를 즉시 ready 로 (7-6 · 지침 3) ═ */

const err = (status, error, headers) => () => jsonRes(status, { error: error || {} }, headers);

for (const [name, handler, want] of [
  ['429 → exhausted(Retry-After 없음 = 다음 날 00:00)', err(429, { status: 'RESOURCE_EXHAUSTED', message: 'quota' }), STATES.EXHAUSTED],
  ['5xx 두 번 → cooldown', err(503, { status: 'UNAVAILABLE', message: 'busy' }), STATES.COOLDOWN],
  ['404 → model', err(404, { status: 'NOT_FOUND', message: 'models/x is not found' }), STATES.MODEL]
]) {
  test('RT ★ [다시 시도] — ' + name + ' 를 사용자 재시도가 즉시 ready 로 돌리고 막혔던 문장을 보낸다', async () => {
    const doc = makeDoc([Array(10).fill(100)]);
    let mode = 'bad';
    const echo = echoTranslate();
    const fetch = stubFetch((url, init, i) => (mode === 'bad' ? handler(url, init, i) : echo(url, init, i)));
    const r = realRig({ fetch: fetch });
    const { ra, remote } = rig(doc, { pipeline: r.pipeline, cache: r.cache, headChars: 0, ctx: { targetLang: 'ar' } });
    ra.setDoc({ docId: 'doc1', lang: 'en', target: 'ar', pageCount: 1 });
    ra.onQueue(1, buildUnits(doc.pages[1], 'sentence'), 0);
    await flush();
    assert.equal(r.pipeline.state(), want);
    assert.equal(remote[remote.length - 1].state, want);
    const s0 = doc.sents[1][0].src;
    assert.notEqual(ra.get(s0).state, 'ready');
    // 시간이 지나지 않았다 — 자동으로는 안 풀린다
    ra.onProgress(1, doc.sents[1][1].seg);
    await flush();
    const n = fetch.calls.length;
    mode = 'good';
    const out = await ra.retry();
    await flush();
    assert.equal(out.state === STATES.READY || out.state === STATES.INFLIGHT, true, '즉시 ready: ' + out.state);
    assert.ok(fetch.calls.length > n, '다시 보냈다');
    assert.equal(ra.get(doc.sents[1][5].src).state, 'ready');
    assert.equal(remote[remote.length - 1].state, STATES.READY, '회복 알림(prev = ' + want + ')');
  });
}

/* ══ readStats · 조회 키 · 계층 ════════════════════════ */

test('RS readStats — 문장 목록을 처음 만든 쪽마다 한 번씩 글자를 더한다(같은 쪽 두 번 세지 않음)', async () => {
  const doc = makeDoc([Array(10).fill(100), Array(12).fill(90), Array(8).fill(110)]);
  const saved = [];
  const { ra, readThrough } = rig(doc, { saveReadStats: async (id, d) => { saved.push(d); } });
  await readThrough(1, 3);
  await readThrough(1, 1);                       // 되돌아가 다시 읽어도
  await flush();
  const want = doc.total;
  assert.deepEqual(ra.readStats(), { pages: 3, chars: want });
  assert.equal(saved.length, 3);
  assert.equal(saved.reduce((n, d) => n + d.chars, 0), want);
});

test('RK 조회는 문장 원문 키 — 공백·NFKC 가 달라도 같은 문장, 번호로 찾지 않는다', async () => {
  const doc = makeDoc([Array(5).fill(100)]);
  const { ra, readThrough } = rig(doc, {});
  await readThrough(1, 1);
  const src = doc.sents[1][2].src;
  assert.equal(ra.get(src).state, 'ready');
  assert.equal(ra.get('  ' + src.replace(/ /g, '  ') + ' ').state, 'ready');
  assert.equal(ra.get({ src: src, seg: 999 }).state, 'ready', 'seg 가 틀려도 원문으로 찾는다');
  assert.equal(ra.get('An unrelated sentence.').state, 'none');
  assert.equal(srcKey(' a  b '), 'a b');
  assert.ok(isBlockingState(STATES.COOLDOWN) && !isBlockingState(STATES.INFLIGHT));
});

test('RM 유효 모드 off 면 요청 0 · 안내는 사유마다 한 번 · 사유에서 벗어나면 notice-clear', async () => {
  const doc = makeDoc([Array(10).fill(100)]);
  const pipe = fakePipeline();
  const { ra, readThrough } = rig(doc, { pipeline: pipe, ctx: { hasKey: false } });
  const notes = [];
  ra.addEventListener('notice', (e) => notes.push('n:' + e.detail.code));
  ra.addEventListener('notice-clear', (e) => notes.push('c:' + e.detail.code));
  await readThrough(1, 1);
  assert.equal(pipe.calls.length, 0);
  ra.setContext(Object.assign({}, CTX, { hasKey: false }));
  ra.setContext(Object.assign({}, CTX, { mode: 'speak', trVoice: false }));
  ra.setContext(Object.assign({}, CTX, { mode: 'speak', trVoice: false }));
  ra.setContext(Object.assign({}, CTX, { mode: 'speak', trVoice: null }));
  // no-key 안내는 rig 가 만들 때 이미 한 번(같은 사유로 다시 불러도 반복 없음). 사유가 바뀌면 거둔다.
  assert.deepEqual(notes, ['c:no-key', 'n:no-voice', 'c:no-voice']);
});

test('RL ★ 서비스 위생 — 화면 계층·i18n import 0, console 0, 특정 언어 코드·무료 한도 숫자 0 (16-D2 grep · 3-2, 주석 포함)', () => {
  const src = readFileSync(new URL('../js/ai/readalong.js', import.meta.url), 'utf8');
  const imports = src.match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || [];
  for (const im of imports) {
    assert.ok(!/\/(ui|i18n)\//.test(im), im);
    assert.ok(!/text\/segment/.test(im), im);
  }
  assert.ok(!/console\s*\./.test(src));
  assert.ok(!/Arabic|'ar'/.test(src), '16-D2 grep — Arabic·\'ar\' 0건(주석 포함)');
  assert.ok(!/free.?tier/i.test(src) && !/\b(RPD|RPM)\b/.test(src));
  assert.ok(!/splitSentences/.test(src), '분할은 tts/text.js 한 곳(R6)');
  assert.ok(!/setInterval/.test(src), '주기적으로 다시 보내는 장치가 없다');
});

test('RE ★ 실측 회귀 — 문장 없는 쪽(표뿐인 쪽)에 커서가 서도 냉시작으로 보지 않는다(head 는 처음 한 번)', async () => {
  // CMDT 2021 1000~1049쪽 실측에서 head 가 3번 나갔다(빈 쪽마다 냉시작) → 1번으로 고쳤다.
  const doc = makeDoc([Array(30).fill(200), [], Array(30).fill(200), [], Array(30).fill(200), [], Array(30).fill(200)]);
  doc.pages[2] = [];
  doc.pages[4] = [];
  doc.sents[2] = [];
  doc.sents[4] = [];
  doc.pages[6] = [];
  doc.sents[6] = [];
  const pipe = fakePipeline();
  const { ra, readThrough } = rig(doc, { pipeline: pipe });
  let late = 0;
  await readThrough(1, 7, (p, s) => { if (!(p === 1 && s.seg === 0) && ra.get(s.src).state !== 'ready') late++; });
  assert.equal(ra.stats().requests.filter((r) => r.head).length, 1);
  assert.equal(late, 0);
});

test('RA3b ★ 커서가 떠 있는 요청 너머로 건너뛰어도(냉시작) 떠 있는 요청은 정규 1 + head 1 을 넘지 않는다', async () => {
  const doc = makeDoc(Array.from({ length: 8 }, () => Array(20).fill(150)));
  const pipe = fakePipeline({ auto: false });
  const { ra } = rig(doc, { pipeline: pipe });
  ra.onQueue(1, buildUnits(doc.pages[1], 'sentence'), 0);
  await flush();
  assert.equal(pipe.open.length, 2, 'head + 청크(답하지 않음)');
  pipe.answerNext();                                 // head 만 답한다 — 정규 청크는 떠 있다
  await flush();
  // 사용자가 멀리 건너뛰었다(5쪽) — 냉시작
  ra.onQueue(5, buildUnits(doc.pages[5], 'sentence'), 0);
  await flush();
  assert.ok(pipe.open.length <= 2, '떠 있는 요청 ' + pipe.open.length);
  assert.equal(pipe.open.length, 2, '정규 1 + 새 head 1');
  assert.ok(pipe.maxInflight() <= 2);
});
