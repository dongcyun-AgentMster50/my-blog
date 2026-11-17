/* ============================================================
   tests/sumsheet-11b.test.mjs — 11-2 요약 시트 · 글 트리 · 선택 줄 [⋯]·[요약] · 음성 "요약" · 서재 삭제 확인
   (spec 17-2-1 3 · 4-3 · 4-4 · 4-5 · 6 · 8 "11-2" 수용 기준 · 10 결정 11-D3·D11–D13·D17·D18)

   K1  ★ 대상 — `summaryPlan`: 단추(선택 시작 줄·오프셋의 문장 문단) · 음성(문단 첫 문장 → 앞 문단, 가운데 → 지금, 쪽 첫 문장 → 지금) ·
       `pageParasOf` 줄 id · `sentenceIndexOf`(줄 모드)
   K2  ★ 흐름(진짜 파이프라인 + 흉내 Gemini): 문단 [요약] → 요청 1 · 요지·원문 언어 요지·요점 2단·용어 · 단추 · 다시 열면 0
   K3  대상 아님(짧음·제목) → 요청 0 · 한 줄 · 단추 없음
   K4  ★ 문지기·막힘 — 키 없음(문지기) → 요청 0 · 배너 즉시 · [다시 시도]가 문지기를 다시 봄 · 같은 언어 키 없음 → 파이프라인 no-key(배너) ·
       429 → 막힘 한 줄·자동 재시도 0·[다시 시도] = retry 먼저 · 오프라인 → 0 · 잘린 JSON → 실패 + [다시 시도]·캐시 0
   K5  ★ [저장] → annotations 1건(kind summary·docId·pageNo·anchor.textHash·lineIds) · 요청 0 · [저장됨 ✓] → 페이지 안 확인 → 지움
   K6  ★ [이 쪽 전체 요약 (문단 n · 호출 k)] — k = 실제 요청 수(12문단 → 1 + 2) · 결과 n · [모두 저장] n건 · 그 뒤 아무 문단 → 0
   K7  [다시 요약] — 먼저 묻는다 · 예 → force 1호출 · [저장]으로 돌아감
   K8  순수 — `itemNote`·`sumButtons`·`sumEsc` 표
   K9  ★ 글 트리(`ui/tree.js`) — `<details open>` 중첩 · 하위 없으면 `<li>` · 깊이 3 · RTL 라틴 `<bdi>` · 모두 접기/펼치기
   K10 ★ 선택 줄 — 보이는 칸 [단어 번역][문장 번역] + [⋯] · [⋯] 안 [요약]·[여기서부터 읽기]·[찾아보기] · [요약] 흐림 판정 · 마크업
   K11 ★ 음성 "요약"(진짜 speaker·voice·ask·sayer, 가짜 인식기·엔진): 낭독 중 문단 둘째 문장 → 지금 문단 · 요지를 대상 언어로 말한 뒤 **읽기 재개** ·
       문단 첫 문장 → 앞 문단(확인 줄 "앞 문단 요약") · 멈춤 → 말한 뒤 멈춘 채 · 말하는 중 [▶] → 멈춤·되돌림 없음 · 기다리는 중 손 → 말하지 않음 ·
       막힘 → 상태 줄 + 한 마디 → 되돌림
   K12 음성 명령 표 — `summarize`(ar·en) · 부정 · 일상 문장 오탐 0
   K13 서재 삭제 확인 — "저장한 요약 n개는 남습니다"(n>0) · 머리 문장이 "everything" 이 아니다 · 지운 뒤 annotations 남음(fake-idb)
   K14 배선·계층·마크업·CSS·i18n — innerHTML 0 · Esc 층 · 같은 높이 식 · 4언어 같은 키 · 자리표시자
   지어낸 문장만. 실제 키·실제 호출 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

const db = await import('../js/db.js');
const { createPipeline } = await import('../js/ai/pipeline.js');
const { createCache } = await import('../js/ai/cache.js');
const { buildUnits, trSpeechText } = await import('../js/tts/text.js');
const { createSpeaker } = await import('../js/tts/speaker.js');
const { createSayer } = await import('../js/tts/say.js');
const { createSummaryStore, textHashOf } = await import('../js/notes/summaries.js');
const SS = await import('../js/ui/sumsheet.js');
const { createAsk, summaryPlan, pageParasOf, sentenceIndexOf } = await import('../js/ui/ask.js');
const { renderTree, treeShape, setAllOpen, anyOpen, TREE_MAX_DEPTH } = await import('../js/ui/tree.js');
const { SEL_ACTIONS, selBarModel, withSummary, moreVisible, showAction } = await import('../js/ui/selbar.js');
const { createVoice } = await import('../js/ui/voice.js');
const { matchCommand, commandById } = await import('../js/voice/commands.js');
const { deleteKeepLines, deleteKeepCounts, deleteConfirmText } = await import('../js/ui/library.js');
const { BUNDLES } = await import('../js/i18n/index.js');
const { DEFAULTS } = await import('../js/settings.js');
const { memDb, stubFetch, jsonRes, geminiOk, settingsOf, manualTimers, FAKE_KEY } = await import('./fixtures/ai-stubs-8a.mjs');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const flush = async (n) => { for (let i = 0; i < (n || 6); i++) await new Promise((r) => setTimeout(r, 0)); };
const LANGS = ['ar', 'en', 'fr', 'ko'];
const T0 = new Date(2026, 10, 17, 10, 0, 0).getTime();

/* ── 문단 · 단위 ─────────────────────────────────────── */

function para(id, kind, lines) {
  return { id: id, kind: kind, lines: lines.map((t, k) => ({ id: id + '.' + k, text: t, hyphen: 'none' })) };
}

/** 쪽 하나: 제목 · 본문 둘(각 두 문장) · 짧은 본문(한 문장). */
function pageUnits() {
  return buildUnits([
    para('5:p0', 'heading', ['Anemia in adults']),
    para('5:p1', 'body', ['Fever was noted in 3 of 10 patients during the', 'first week. The rash resolved within two weeks of treatment.']),
    para('5:p2', 'body', ['Chronic cough has many causes in adults. Most cases improve without specific therapy over time.']),
    para('5:p3', 'body', ['Short line.'])
  ], 'sentence');
}

/* ── 흉내 Gemini(요약 갈래) ─────────────────────────── */

function docOf(init) {
  const user = JSON.parse(init.body).contents[0].parts[0].text;
  return JSON.parse(user.slice(user.indexOf('<<<DOC\n') + 7, user.lastIndexOf('\n>>>')));
}
function echoSummary(o) {
  const x = o || {};
  return (url, init) => {
    if (x.status) return jsonRes(x.status, { error: { code: x.status, status: x.status === 429 ? 'RESOURCE_EXHAUSTED' : 'X', message: 'mock' } });
    const items = docOf(init).map((it) => {
      const nums = (String(it.text).match(/\d+/g) || []).slice(0, 2).join(' ');
      return { i: it.i, gist: 'ملخص الفقرة (summary) ' + nums, gistSrc: 'Short gist ' + nums,
        points: [{ t: 'نقطة أولى (point)', sub: ['فرعية'] }, { t: 'نقطة ثانية', sub: [] }], terms: [{ src: 'fever', tr: 'حمى' }] };
    });
    const text = JSON.stringify({ items: items, notes: '' });
    if (x.cut) {
      return jsonRes(200, { candidates: [{ content: { parts: [{ text: text.slice(0, Math.floor(text.length * 0.6)) }] }, finishReason: 'MAX_TOKENS' }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 120 } });
    }
    return jsonRes(200, geminiOk(text));
  };
}

function rig(over) {
  const o = over || {};
  const mdb = memDb();
  const timers = manualTimers();
  const net = { online: true };
  const cache = createCache({ db: mdb, now: () => T0 });
  const fetch = stubFetch(o.handler || echoSummary(o.mock));
  const p = createPipeline({
    fetch: fetch, db: mdb, cache: cache, getKey: () => (o.key === undefined ? FAKE_KEY : o.key),
    getSetting: settingsOf(o.settings), now: () => T0, isOnline: () => net.online,
    setTimer: timers.set, clearTimer: timers.clear, listen: false
  });
  return { p, fetch, net, mdb };
}

let storeSeq = 0;
function flowRig(over) {
  const o = over || {};
  const r = rig(o);
  const store = createSummaryStore({ now: () => T0 + (++storeSeq) });
  const views = [];
  const gate = { v: o.gate || { ok: true, reason: null } };
  const flow = SS.createSumFlow({
    summarize: (paras, x) => r.p.summarize(paras, x),
    planSummary: (paras, x) => r.p.planSummary(paras, x),
    unblock: () => { r.unblocks = (r.unblocks || 0) + 1; return r.p.retry(); },
    gate: () => gate.v,
    store: store,
    onChange: (v) => views.push(v)
  });
  return Object.assign(r, { flow, store, views, gate });
}

const CTX = { docId: 'docK', page: 5, src: 'en', target: 'ar', domain: 'medical', docTitle: 'Book K', provider: 'gemini', model: '' };

function openArgs(paraId, over) {
  const units = pageUnits();
  const paras = pageParasOf(units);
  return Object.assign({ para: paras.find((p) => p.paraId === paraId) || null, pageParas: paras, ctx: CTX }, over || {});
}

/* ══ K1 대상 ═════════════════════════════════════════ */

test('K1 ★ 대상 — 단추는 선택 문장의 문단 · 음성은 문단 첫 문장이면 앞 문단(11-D12) · 쪽 첫 문장은 지금 · 줄 id · 줄 모드 번호', () => {
  const u = pageUnits();
  const paras = pageParasOf(u);
  assert.deepEqual(paras.map((p) => p.paraId), ['5:p0', '5:p1', '5:p2', '5:p3']);
  assert.deepEqual(paras[1].lineIds, ['5:p1.0', '5:p1.1'], '문단 줄 id(읽기 순서·중복 없음)');
  assert.equal(paras[1].n, 2);
  // 단추 — 둘째 줄 안 오프셋 → 그 문장의 문단
  assert.equal(summaryPlan(u, { snap: { lineId: '5:p1.1', start: 20 } }).para.paraId, '5:p1');
  assert.equal(summaryPlan(u, { snap: { lineId: '5:p2.0', start: 3 } }).para.paraId, '5:p2');
  assert.equal(summaryPlan(u, { snap: { lineId: '5:p1.1', start: 20 } }).prev, false);
  // 음성 — 단위 번호
  const idx = (pid, nth) => u.findIndex((x) => x.paraId === pid && u.filter((y, k) => k < u.indexOf(x) && y.paraId === pid).length === nth);
  const p2first = idx('5:p2', 0);
  const p2second = idx('5:p2', 1);
  assert.ok(p2first > 0 && p2second > p2first);
  const a = summaryPlan(u, { index: p2first });
  assert.equal(a.para.paraId, '5:p1', '★ 문단 첫 문장(앞 문장 있음) → 바로 앞 문단');
  assert.equal(a.prev, true, '확인 줄 "앞 문단 요약"');
  const b = summaryPlan(u, { index: p2second });
  assert.equal(b.para.paraId, '5:p2', '문단 가운데 → 지금 문단');
  assert.equal(b.prev, false);
  assert.equal(summaryPlan(u, { index: 0 }).para.paraId, '5:p0', '쪽 첫 문장(앞 문장 없음) → 지금 문단');
  // 줄 모드 — 지금 줄을 담은 첫 문장
  assert.equal(sentenceIndexOf(u, { lineIds: ['5:p2.0'] }, 0, 'line'), p2first);
  assert.equal(sentenceIndexOf(u, null, 3, 'sentence'), 3);
  assert.equal(sentenceIndexOf(u, null, 99, 'sentence'), 0);
  // 문지기 — 8c-1 tapGate 순서 그대로, 단 요약은 같은 언어도 한다(같은 언어면 키 확인은 파이프라인 gate 가 — 보내지 않음)
  const g = (reason) => createAsk({ readalong: { tapGate: () => (reason ? { ok: false, reason: reason } : { ok: true, reason: null }) } }).gate();
  assert.deepEqual(g(null), { ok: true, reason: null });
  assert.deepEqual(g('same-lang'), { ok: true, reason: null }, '★ 같은 언어 — 요약은 한다');
  for (const r of ['consent', 'unsupported-lang', 'no-key']) assert.deepEqual(g(r), { ok: false, reason: r }, r);
  // [요약] 흐림 판정(호출 0)
  const ask = createAsk({ units: () => u });
  assert.equal(ask.canSummarize({ lineId: '5:p1.1', start: 3 }), true);
  assert.equal(ask.canSummarize({ lineId: '5:p3.0', start: 1 }), false, '한 문장');
  assert.equal(ask.canSummarize({ lineId: '5:p0.0', start: 1 }), false, '제목');
});

/* ══ K2 흐름 — 요청 1 · 다시 0 ═══════════════════════ */

test('K2 ★ 문단 [요약] → 요청 1 · 요지·원문 언어 요지·요점·용어 · 단추 · 닫고 다시 → 0', async () => {
  const r = flowRig();
  const v = await r.flow.open(openArgs('5:p1'));
  assert.equal(r.fetch.calls.length, 1, '★ 요청 1');
  const body = JSON.parse(r.fetch.calls[0].init.body);
  assert.ok(Object.keys(body.generationConfig.responseSchema.properties.items.items.properties).includes('gist'), '요약 갈래(responseSchema)');
  assert.equal(docOf(r.fetch.calls[0].init).length, 1, '그 문단 하나만');
  const it = v.items[0];
  assert.equal(it.state, 'ready');
  assert.match(it.value.gist, /ملخص/);
  assert.equal(it.value.gistSrc.startsWith('Short gist'), true);
  assert.equal(it.value.points.length, 2);
  assert.equal(it.value.terms.length, 1);
  assert.equal(it.saved, null);
  assert.deepEqual(v.plan, { n: 2, calls: 1 }, '쪽의 요약 가능 문단 2(p1·p2) · 지금 문단은 캐시 → k = 1');
  assert.deepEqual(v.buttons, ['save', 'listen', 'pageAll', 'redo', 'fold']);
  assert.equal(v.calls, 1);
  assert.ok(r.views.some((x) => x.items[0] && x.items[0].state === 'pending'), '요약 중… 을 먼저 그린다');
  r.flow.close();
  const v2 = await r.flow.open(openArgs('5:p1'));
  assert.equal(r.fetch.calls.length, 1, '★ 같은 문단 다시 → 요청 0(캐시)');
  assert.equal(v2.items[0].cached, true);
  assert.equal(v2.calls, 0);
});

test('K3 대상 아님(한 문장·제목) → 요청 0 · 한 줄 · 단추 없음', async () => {
  for (const pid of ['5:p3', '5:p0']) {
    const r = flowRig();
    const v = await r.flow.open(openArgs(pid));
    assert.equal(r.fetch.calls.length, 0, pid);
    assert.equal(v.note.key, 'sum.notEligible');
    assert.deepEqual(v.items, []);
    assert.deepEqual(v.buttons, []);
  }
});

/* ══ K4 문지기·막힘 ═════════════════════════════════ */

test('K4 ★ 키 없음(문지기) → 요청 0·배너·[다시 시도]가 문지기를 다시 봄 · 같은 언어 키 없음 → no-key · 429 → 막힘·자동 0·retry 먼저 · 오프라인 · 잘린 JSON', async () => {
  // 문지기 no-key
  const g = flowRig({ gate: { ok: false, reason: 'no-key' } });
  const v = await g.flow.open(openArgs('5:p1'));
  assert.equal(g.fetch.calls.length, 0, '★ 요청 0');
  assert.equal(v.items[0].state, 'blocked');
  assert.equal(v.items[0].note.key, 'readalong.blocked.noKey');
  assert.ok(g.views.some((x) => x.banner === 'no-key'), '배너 [키 설정] 즉시(8c-1 과 같음)');
  assert.deepEqual(v.buttons, ['retry', 'pageAll']);
  let w = await g.flow.retry(0);
  assert.equal(g.fetch.calls.length, 0, '아직 키 없음 — 다시 시도해도 0');
  g.gate.v = { ok: true, reason: null };
  w = await g.flow.retry(0);
  assert.equal(g.fetch.calls.length, 1);
  assert.equal(w.items[0].state, 'ready');
  // 같은 언어 + 키 없음 → 문지기는 통과(요약은 같은 언어도) · 파이프라인이 no-key(보내지 않음)
  const s = flowRig({ key: '' });
  const vs = await s.flow.open(Object.assign(openArgs('5:p1'), { ctx: Object.assign({}, CTX, { src: 'ar' }) }));
  assert.equal(s.fetch.calls.length, 0);
  assert.equal(vs.items[0].state, 'blocked');
  assert.equal(vs.items[0].code, 'no-key');
  assert.ok(s.views.some((x) => x.banner === 'no-key'));
  // 429 → exhausted · 자동 재시도 0 · [다시 시도] = pipeline.retry() 먼저
  const e = flowRig({ mock: { status: 429 } });
  const ve = await e.flow.open(openArgs('5:p1'));
  assert.equal(e.fetch.calls.length, 1);
  assert.equal(ve.items[0].state, 'blocked');
  assert.equal(ve.items[0].note.key, 'readalong.blocked.exhausted');
  await flush();
  assert.equal(e.fetch.calls.length, 1, '★ 자동 재시도 0');
  assert.deepEqual(ve.buttons, ['retry', 'pageAll']);
  await e.flow.retry(0);
  assert.equal(e.unblocks, 1, '[다시 시도] = 막힌 원격 상태 먼저 풀기(사용자 동작만)');
  assert.equal(e.fetch.calls.length, 2);
  // 오프라인 → 보내지 않음 · [다시 시도] 없음(연결되면 그때)
  const off = flowRig();
  off.net.online = false;
  const vo = await off.flow.open(openArgs('5:p1'));
  assert.equal(off.fetch.calls.length, 0);
  assert.equal(vo.items[0].note.key, 'readalong.blocked.offline');
  assert.deepEqual(vo.buttons.indexOf('retry'), -1);
  // 잘린 JSON → 실패 + [다시 시도] · 캐시 0(다시 열어도 실패 기억 — 0 · [다시 시도] → 1)
  const c = flowRig({ mock: { cut: true } });
  const vc = await c.flow.open(openArgs('5:p1'));
  assert.equal(vc.items[0].state, 'failed');
  assert.equal(vc.items[0].note.key, 'sum.failed');
  assert.deepEqual(vc.buttons, ['retry', 'pageAll']);
  c.flow.close();
  const vc2 = await c.flow.open(openArgs('5:p1'));
  assert.equal(c.fetch.calls.length, 1, '실패 기억 — 그냥 다시 열면 0');
  assert.equal(vc2.items[0].state, 'failed', '★ 반쪽 요약이 캐시에서 나오지 않는다');
  await c.flow.retry(0);
  assert.equal(c.fetch.calls.length, 2, '[다시 시도] → retry:true 로 1');
});

/* ══ K5 저장 ═══════════════════════════════════════ */

test('K5 ★ [저장] → annotations 1건(kind·docId·pageNo·anchor) · 요청 0 · [저장됨 ✓] → 페이지 안 확인 → 지움', async () => {
  const r = flowRig();
  await r.flow.open(openArgs('5:p1', { ctx: Object.assign({}, CTX, { docId: 'docSave' }) }));
  const calls = r.fetch.calls.length;
  let v = await r.flow.save(0);
  assert.equal(r.fetch.calls.length, calls, '★ 저장해도 요청 0');
  assert.equal(v.note.key, 'sum.savedNote');
  assert.ok(v.items[0].saved);
  assert.deepEqual(v.buttons.slice(0, 2), ['unsave', 'listen']);
  const list = await r.store.list({ docId: 'docSave' });
  assert.equal(list.length, 1);
  const rec = list[0];
  assert.equal(rec.kind, 'summary');
  assert.equal(rec.docId, 'docSave');
  assert.equal(rec.pageNo, 5);
  assert.equal(rec.anchor.textHash, await textHashOf(openArgs('5:p1').para.text));
  assert.deepEqual(rec.anchor.lineIds, ['5:p1.0', '5:p1.1']);
  assert.equal(rec.anchor.paraId, '5:p1');
  assert.equal(rec.target, 'ar');
  assert.deepEqual(rec.langs, ['ar', 'en']);
  assert.ok(!JSON.stringify(rec).includes('Fever was noted'), '원문 문단 글은 저장하지 않는다');
  const viaIdx = await db.get('annotations', rec.id);
  assert.ok(viaIdx, '실제 annotations 스토어(fake-idb)');
  // 같은 문단 다시 열면 [저장됨 ✓]
  r.flow.close();
  v = await r.flow.open(openArgs('5:p1', { ctx: Object.assign({}, CTX, { docId: 'docSave' }) }));
  assert.equal(v.items[0].saved.id, rec.id);
  // [저장됨 ✓] → 묻기 → 그대로 두기 → 남음 · 다시 → 지우기 → 지움
  v = r.flow.unsave(0);
  assert.equal(v.ask.kind, 'unsave');
  assert.deepEqual(v.buttons, [], '질문 중에는 단추 줄 대신 질문 줄');
  v = r.flow.cancelAsk();
  assert.equal(v.ask, null);
  assert.equal((await r.store.list({ docId: 'docSave' })).length, 1);
  r.flow.unsave(0);
  v = await r.flow.confirmAsk();
  assert.equal(v.items[0].saved, null);
  assert.equal(v.note.key, 'sum.removed');
  assert.equal((await r.store.list({ docId: 'docSave' })).length, 0);
  assert.equal(r.fetch.calls.length, calls, '지워도 요청 0');
});

/* ══ K6 이 쪽 전체 요약 ════════════════════════════ */

function longParas(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s1 = 'Patients in group ' + (i + 1) + ' were followed for 12 weeks and the clinical response was recorded in detail by the team.';
    let s2 = ' The second observation describes how symptoms changed over time and which findings were most consistent across visits';
    while ((s1 + s2).length < 390) s2 += ' and visits';
    out.push(para('9:p' + i, 'body', [s1 + s2 + '.']));
  }
  return buildUnits(out, 'sentence');
}

test('K6 ★ [이 쪽 전체 요약 (문단 n · 호출 k)] — k = 실제 요청 수 · 결과 n · [모두 저장] n건 · 그 뒤 아무 문단 → 0', async () => {
  const r = flowRig();
  const units = longParas(12);
  const paras = pageParasOf(units);
  assert.equal(paras.length, 12);
  const ctx = Object.assign({}, CTX, { docId: 'docPage', page: 9 });
  let v = await r.flow.open({ para: paras[0], pageParas: paras, ctx: ctx });
  assert.equal(r.fetch.calls.length, 1);
  assert.equal(v.plan.n, 12);
  const k = v.plan.calls;
  assert.equal(k, 2, '남은 11문단(각 약 400자) → 묶음 2(출력 예산 — 11-1 S10 과 같은 자르기)');
  v = await r.flow.pageAll();
  assert.equal(r.fetch.calls.length - 1, k, '★ 가로챈 요청 수 = 누르기 전에 보인 k');
  assert.equal(v.mode, 'page');
  assert.equal(v.items.length, 12, '결과 n문단');
  assert.ok(v.items.every((it) => it.state === 'ready'));
  const sent = r.fetch.calls.slice(1).reduce((a, c) => a + docOf(c.init).length, 0);
  assert.equal(sent, 11, '이미 준비된 지금 문단은 다시 보내지 않는다');
  assert.deepEqual(v.buttons, ['saveAll', 'fold']);
  v = await r.flow.saveAll();
  assert.equal(v.note.key, 'sum.savedAll');
  assert.equal((await r.store.list({ docId: 'docPage' })).length, 12, '★ [모두 저장] → n건');
  assert.deepEqual(v.buttons, ['fold'], '모두 저장됨');
  const before = r.fetch.calls.length;
  r.flow.close();
  for (const i of [3, 7, 11]) {
    const w = await r.flow.open({ para: paras[i], pageParas: paras, ctx: ctx });
    assert.equal(w.items[0].cached, true);
    assert.ok(w.items[0].saved, '저장됨 ✓');
  }
  assert.equal(r.fetch.calls.length, before, '★ 그 뒤 아무 문단 [요약] → 0');
});

test('K7 [다시 요약] — 먼저 묻는다 · 예 → force 1호출 · [저장] 으로 돌아감', async () => {
  const r = flowRig();
  await r.flow.open(openArgs('5:p1', { ctx: Object.assign({}, CTX, { docId: 'docRedo' }) }));
  await r.flow.save(0);
  let v = r.flow.redo();
  assert.equal(v.ask.kind, 'redo');
  assert.equal(r.fetch.calls.length, 1, '묻는 동안 0');
  v = await r.flow.confirmAsk();
  assert.equal(r.fetch.calls.length, 2, '★ 다시 요약 = 1');
  assert.equal(v.items[0].state, 'ready');
  assert.equal(v.items[0].saved, null, '저장 레코드는 옛 글 — [저장] 이 보이고 누르면 대체(11-D10)');
  v = await r.flow.save(0);
  assert.equal((await r.store.list({ docId: 'docRedo' })).length, 1, '대체 — 한 레코드');
});

/* ══ K8 순수 ═══════════════════════════════════════ */

test('K8 순수 — itemNote · sumButtons · sumEsc', () => {
  const N = SS.itemNote;
  assert.equal(N({ state: 'ready' }), null);
  assert.deepEqual(N({ state: 'pending' }), { key: 'sum.pending', retry: false });
  assert.deepEqual(N({ state: 'failed', code: 'MISSING' }), { key: 'sum.failed', retry: true });
  assert.deepEqual(N({ state: 'blocked', code: 'exhausted' }), { key: 'readalong.blocked.exhausted', retry: true });
  assert.deepEqual(N({ state: 'blocked', code: 'capped' }), { key: 'readalong.blocked.capped', retry: false });
  assert.deepEqual(N({ state: 'blocked', code: 'offline' }), { key: 'readalong.blocked.offline', retry: false });
  assert.deepEqual(N({ state: 'blocked', code: 'consent', gate: true }), { key: 'readalong.consent', retry: true });
  assert.deepEqual(N({ state: 'skipped', code: 'unsupported-lang' }), { key: 'readalong.unsupportedLang', retry: false });
  const it = (s, saved) => ({ state: s, saved: saved || null });
  assert.deepEqual(SS.sumButtons({ open: true, mode: 'para', items: [it('ready')], plan: { n: 3, calls: 1 }, foldable: true }), ['save', 'listen', 'pageAll', 'redo', 'fold']);
  assert.deepEqual(SS.sumButtons({ open: true, mode: 'para', items: [it('ready', { id: 'x' })], plan: { n: 1, calls: 0 } }), ['unsave', 'listen', 'redo']);
  assert.deepEqual(SS.sumButtons({ open: true, mode: 'para', items: [it('pending')], plan: { n: 3, calls: 1 } }), []);
  assert.deepEqual(SS.sumButtons({ open: true, mode: 'para', items: [it('ready')], ask: { kind: 'redo' } }), []);
  assert.deepEqual(SS.sumButtons({ open: true, mode: 'page', items: [it('ready'), it('failed')], foldable: false }), ['saveAll']);
  assert.deepEqual(SS.sumButtons({ open: false }), []);
  assert.deepEqual(SS.SUM_ACTIONS.slice().sort(), ['fold', 'listen', 'pageAll', 'redo', 'retry', 'save', 'saveAll', 'unsave']);
  assert.equal(SS.sumEsc({ open: true }), true);
  assert.equal(SS.sumEsc({ open: true, shown: false }), false);
  assert.equal(SS.sumEsc({ open: true, prevented: true }), false);
  assert.equal(SS.sumEsc({ open: true, composing: true }), false);
});

/* ══ K9 글 트리 ════════════════════════════════════ */

function fakeDoc() {
  const doc = {};
  function el(tag) {
    const n = {
      tagName: String(tag).toUpperCase(), children: [], attrs: {}, _t: '', open: false, dir: '', className: '', ownerDocument: doc,
      appendChild(c) { n.children.push(c); c.parentNode = n; return c; },
      setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return Object.prototype.hasOwnProperty.call(n.attrs, k) ? n.attrs[k] : null; },
      get firstChild() { return n.children[0] || null; },
      set textContent(v) { n.children = []; n._t = String(v); },
      get textContent() { return n._t + n.children.map((c) => c.textContent).join(''); },
      querySelectorAll(sel) {
        const out = [];
        (function walk(x) { for (const c of x.children || []) { if (c.tagName && c.tagName.toLowerCase() === sel) out.push(c); walk(c); } })(n);
        return out;
      }
    };
    return n;
  }
  doc.createElement = el;
  doc.createTextNode = (t) => ({ textContent: String(t), nodeType: 3 });
  return doc;
}

test('K9 ★ 글 트리 — details open 중첩 · 하위 없으면 li · 깊이 3 · RTL 라틴 bdi · 모두 접기/펼치기 · 빈 트리 null', () => {
  const doc = fakeDoc();
  const pts = [{ t: 'نقطة أولى (point one)', sub: ['فرعية ١', 'فرعية ٢'] }, { t: 'نقطة ثانية', sub: [] }, { t: '   ', sub: ['x'] }];
  const ul = renderTree(pts, { dir: 'rtl', lang: 'ar', doc: doc });
  assert.equal(ul.className, 'sum-tree');
  assert.equal(ul.getAttribute('dir'), 'rtl');
  assert.equal(ul.getAttribute('lang'), 'ar');
  assert.equal(ul.children.length, 2, '빈 줄은 버린다');
  const li0 = ul.children[0];
  const det = li0.children[0];
  assert.equal(det.tagName, 'DETAILS', '★ 하위가 있으면 <details>(JS 없이 접힘 — 11-D17)');
  assert.equal(det.open, true, '처음엔 펼침');
  assert.equal(det.children[0].tagName, 'SUMMARY');
  assert.equal(det.children[0].children.filter((c) => c.tagName === 'BDI').length, 1, 'RTL 의 라틴 괄호는 <bdi dir=ltr>');
  assert.equal(det.children[1].children.length, 2);
  assert.ok(ul.children[1].children.every((c) => c.tagName !== 'DETAILS' && c.tagName !== 'UL'), '하위 없으면 <li> 글만');
  assert.equal(ul.children[1].textContent, 'نقطة ثانية');
  // 접힌 채(쪽 요약)
  const closed = renderTree(pts, { dir: 'rtl', doc: doc, open: false });
  assert.equal(closed.querySelectorAll('details')[0].open, false);
  // 모두 접기/펼치기
  assert.equal(anyOpen(ul), true);
  assert.equal(setAllOpen(ul, false), 1);
  assert.equal(anyOpen(ul), false);
  setAllOpen(ul, true);
  assert.equal(anyOpen(ul), true);
  // 깊이 3(범위 개요) · 넷째 깊이는 그리지 않는다
  const deep = [{ t: 'a', sub: [{ t: 'b', sub: [{ t: 'c', sub: ['d'] }] }] }];
  const d3 = renderTree(deep, { dir: 'ltr', doc: doc });
  assert.equal(d3.querySelectorAll('details').length, 2, 'a·b 만 접힌다 — c 는 깊이 3 의 끝');
  assert.equal(TREE_MAX_DEPTH, 3);
  assert.deepEqual(treeShape(deep), { lines: 3, foldable: 2 });
  assert.deepEqual(treeShape(pts), { lines: 4, foldable: 1 });
  assert.equal(renderTree([], { doc: doc }), null);
  assert.equal(renderTree(null, { doc: doc }), null);
  // 소스 — innerHTML 0 · appendBidiText 한 길
  const s = strip(read('../js/ui/tree.js'));
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(s));
  assert.match(s, /appendBidiText\(el, text, dir\)/);
});

/* ══ K10 선택 줄 ═══════════════════════════════════ */

test('K10 ★ 선택 줄 — 보이는 칸 [단어 번역][문장 번역] + [⋯] · [⋯] 안 [요약]·[여기서부터 읽기]·[찾아보기] · [요약] 흐림 · 마크업', () => {
  // `[11-4 — 11-D3]` 보이는 칸 = [단어 번역][문장 번역][설명] + [⋯](셋째 칸 [설명]은 11-4 가 끼웠다).
  assert.deepEqual(SEL_ACTIONS.filter((a) => !a.more).map((a) => a.id), ['word', 'sentence', 'explain'], '★ 보이는 칸 고정(11-D3 — 폭을 재지 않는다)');
  // `[12-2 — spec 17-11 5]` [⋯] 안에 [기억 카드](`remember`) — [여기서부터 읽기] 다음.
  assert.deepEqual(SEL_ACTIONS.filter((a) => a.more).map((a) => a.id), ['summary', 'readFrom', 'remember', 'lookup']);
  const on = showAction(SEL_ACTIONS, 'word');
  const m = selBarModel(on, { text: 'arthritis' }, { links: 0 });
  assert.deepEqual(m.map((x) => [x.id, x.more, x.hidden]), [['word', false, false], ['sentence', false, false], ['explain', false, false], ['summary', true, false], ['readFrom', true, false], ['remember', true, false], ['lookup', true, true]]);
  assert.equal(moreVisible(m), true);
  assert.equal(moreVisible(m.filter((x) => !x.more)), false);
  // [요약] 흐림 — 모름이면 그대로, false 면 흐림 + sum.notEligible
  assert.deepEqual(withSummary(m, undefined), m);
  const w = withSummary(m, false);
  const s = w.find((x) => x.id === 'summary');
  assert.equal(s.disabled, true);
  assert.equal(s.note, 'sum.notEligible');
  assert.equal(withSummary(m, true).find((x) => x.id === 'summary').disabled, false);
  assert.ok(BUNDLES.en['sum.notEligible']);
  // 마크업 — [⋯](aria-haspopup·expanded·controls) · 메뉴 role=menu · 줄 안
  const html = read('../index.html');
  const bar = html.slice(html.indexOf('id="selBar"'), html.indexOf('id="sumSheet"'));
  assert.match(bar, /<button type="button" class="sel-btn sel-more" id="selMoreBtn" aria-haspopup="menu" aria-expanded="false"\s+aria-controls="selMore" data-i18n-aria="sel\.more" hidden>/);
  assert.match(bar, /<div class="sel-more-menu" id="selMore" role="menu" data-i18n-aria="sel\.more" hidden><\/div>/);
  assert.ok(bar.indexOf('id="selActions"') < bar.indexOf('id="selMoreBtn"'), '[⋯] 는 보이는 칸 뒤(논리 순서 — 아랍어에서 저절로 왼쪽 끝)');
  // selbar — 메뉴 Esc 는 창 붙잡기(18 목록과 같은 층) · 메뉴 칸 role=menuitem · 찾아보기는 [⋯] 로 포커스 되돌림 · innerHTML 0
  const sb = strip(read('../js/ui/selbar.js'));
  assert.match(sb, /window\.addEventListener\('keydown', keyFn, true\);/);
  assert.match(sb, /if \(item\) \{ b\.setAttribute\('role', 'menuitem'\); b\.tabIndex = -1; \}/);
  assert.match(sb, /back: inMenu && els\.moreBtn \? els\.moreBtn : b/);
  assert.match(sb, /if \(lookupMenuOpen\(\) \|\| more\) \{/, '메뉴가 떠 있는 동안 선택이 풀려도 줄을 거두지 않는다');
  assert.ok(!/innerHTML/.test(sb));
  // CSS — [⋯] 48 정사각 · 메뉴 칸 48 · 시트가 열리면 선택 줄 숨김
  const css = read('../css/reader.css');
  assert.match(css, /\.sel-bar \.sel-btn\.sel-more \{[^}]*inline-size: var\(--tap\);/);
  assert.match(css, /\.sel-bar \.sel-more-menu \.sel-btn\.sel-more-item \{[^}]*min-block-size: var\(--tap\);/);
  assert.match(css, /\.sel-bar \.sel-actions \{[^}]*flex: 1 1 0;/);
});

/* ══ K11 음성 "요약" ════════════════════════════════ */

function fakeTimers() {
  let now = 0; let seq = 1;
  const jobs = new Map();
  return {
    setTimeout: (fn, ms) => { const k = seq++; jobs.set(k, { fn: fn, at: now + (Number(ms) || 0) }); return k; },
    clearTimeout: (k) => { jobs.delete(k); },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let pick = null; let key = null;
        for (const [k, j] of jobs) if (j.at <= target && (pick === null || j.at < pick.at)) { pick = j; key = k; }
        if (!pick) break;
        jobs.delete(key); now = pick.at; pick.fn();
      }
      now = target;
    },
    now: () => now
  };
}
function fakeSynth() {
  const s = { utt: [], current: null,
    speak(u) { s.speaking = true; s.current = u; s.utt.push(u); },
    pause() { }, resume() { },
    cancel() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    finish() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onend) u.onend(); } };
  return s;
}
function fakeRecClass() {
  const instances = [];
  class FakeRec {
    constructor() { this.lang = ''; this.onstart = this.onaudiostart = this.onresult = this.onnomatch = this.onerror = this.onend = null; instances.push(this); }
    start() { } stop() { } abort() { }
    fire(type, payload) {
      const h = this['on' + type];
      if (typeof h !== 'function') return;
      if (type === 'result') { const r = payload.map((t) => ({ transcript: t, confidence: 1 })); r.isFinal = true; h.call(this, { resultIndex: 0, results: [r] }); }
      else h.call(this, {});
    }
  }
  return { Rec: FakeRec, instances: instances };
}
const GIST = 'التهاب المفاصل (rheumatoid arthritis) مزمن.';

/**
 * 진짜 speaker + 진짜 sayer(같은 엔진) + 진짜 ask(가짜 시트 — 요지를 돌려준다) + 진짜 voice(가짜 인식기).
 * `pressPlay` 는 controls 의 [▶] 모양(첫 줄 `cancelVoice` = voice.cancel + sayer.stop).
 */
function voiceRig(o) {
  const x = o || {};
  const synth = fakeSynth();
  const timers = fakeTimers();
  const pages = { 1: [para('1:p1', 'body', ['Alpha one starts the topic of this page. Alpha two adds a useful detail here.']),
    para('1:p2', 'body', ['Bravo one opens the next idea on the page. Bravo two closes the page with a note.'])] };
  const sp = createSpeaker({
    synth: synth, timers: timers, makeUtterance: (text) => ({ text: text }),
    view: { paras: () => pages[1], page: () => ({ page: 1, pageCount: 1 }), goToPage: () => Promise.resolve(false), show: () => true, markDone: () => { } },
    requestWakeLock: () => Promise.resolve({ release() { } })
  });
  const sayer = createSayer({ synth: synth, timers: timers, makeUtterance: (text) => ({ text: text }),
    speechOf: (lang) => ({ tag: lang === 'ar' ? 'ar-SA' : 'en-US', voice: null }) });
  const env = { opened: [], presses: 0, statuses: [], sheetResult: x.sheetResult || null, hold: null };
  const sheet = {
    open: (a) => {
      env.opened.push(a.para ? a.para.paraId : null);
      const v = { ctx: a.ctx, items: [env.sheetResult || { state: 'ready', value: { gist: GIST }, note: null }] };
      if (x.holdSheet) return new Promise((resolve) => { env.hold = () => resolve(v); });
      return Promise.resolve(v);
    }
  };
  let voice = null;
  const pressPlay = () => { env.presses++; if (voice) voice.cancel(); sayer.stop(); if (sp.getState() === 'speaking') sp.pause(); else sp.play(); };
  const ask = createAsk({ speaker: sp, readalong: { tapGate: () => ({ ok: true, reason: null }) }, sheet: sheet, sayer: sayer,
    units: () => sp.sentenceUnits(), ctx: () => ({ docId: 'd', page: 1, src: 'en', target: 'ar' }), pressPlay: pressPlay });
  const t = (k, p) => { let s = BUNDLES.en[k]; if (typeof s !== 'string') return k; for (const [n, v] of Object.entries(p || {})) s = s.split('{' + n + '}').join(String(v)); return s; };
  const fk = fakeRecClass();
  const settings = { 'voice.noticeAt': 1, 'voice.cmdLang': 'ar' };
  voice = createVoice({
    Recognition: fk.Rec, speaker: sp, pressPlay: pressPlay, syncReadalong: () => { }, paintRate: () => { },
    getSetting: (k) => (Object.prototype.hasOwnProperty.call(settings, k) ? settings[k] : DEFAULTS[k]), setSetting: () => Promise.resolve(),
    uiLang: () => 'ar', t: t, onLine: () => true, synth: synth, makeUtterance: (text) => ({ text: text }),
    sayVoice: () => ({ tag: 'ar-SA', voice: null }), timers: timers, now: timers.now,
    view: { paint: () => { }, status: (m) => env.statuses.push(m), notice: () => { } },
    onSummarize: (a) => ask.summarize(a), sayer: sayer
  });
  const rec = () => fk.instances[fk.instances.length - 1];
  return { sp, synth, timers, sayer, ask, voice, env, rec, pressPlay };
}

/** 낭독을 시작해 i 번째 문장까지. */
function startAt(h, i) {
  h.sp.play();
  for (let k = 0; k < i; k++) h.synth.finish();
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.sp.getIndex(), i);
}
const lastStatus = (h) => h.env.statuses[h.env.statuses.length - 1];

test('K11 ★ 음성 «لخص» — 낭독 중 문단 둘째 문장 → 지금 문단 · 대상 언어로 말한 뒤 읽기 재개 · 문단 첫 문장 → 앞 문단', async () => {
  const h = voiceRig();
  startAt(h, 1);                                              // Alpha two — 1:p1 의 둘째 문장
  h.voice.press();
  assert.equal(h.sp.getState(), 'paused', '듣는 동안 멈춤(9b)');
  h.rec().fire('result', ['لخص']);
  h.rec().fire('end');
  await flush();
  assert.deepEqual(h.env.opened, ['1:p1'], '★ 지금 문단');
  const said = h.synth.utt[h.synth.utt.length - 1];
  assert.equal(said.text, trSpeechText(GIST), '요지 — 괄호 원어는 소리에서 뺀다');
  assert.equal(said.lang, 'ar-SA', '★ 대상 언어 음성(utterance lang)');
  assert.equal(h.sp.getState(), 'paused', '말하는 동안 낭독은 멈춘 채');
  assert.equal(lastStatus(h).kind, 'confirm');
  assert.match(lastStatus(h).text, /Summarize paragraph/);
  h.synth.finish();                                           // 요지 끝
  await flush();
  assert.equal(h.sp.getState(), 'speaking', '★ 읽던 중이었으면 이어 읽기(restore)');
  assert.equal(h.sp.getIndex(), 1, '그 문장부터');
  assert.equal(h.voice.isListening(), false);

  // 문단 첫 문장(Bravo one) → 앞 문단
  const g = voiceRig();
  startAt(g, 2);
  g.voice.press();
  g.rec().fire('result', ['لخص الفقرة']);
  g.rec().fire('end');
  await flush();
  assert.deepEqual(g.env.opened, ['1:p1'], '★ 방금 다 읽은 앞 문단(11-D12)');
  assert.match(lastStatus(g).text, /Summarize previous paragraph/, '확인 줄 "앞 문단 요약"');
  g.synth.finish();
  await flush();
  assert.equal(g.sp.getState(), 'speaking');
  assert.equal(g.sp.getIndex(), 2);
});

test('K11b 멈춤 → 말한 뒤 멈춘 채 · 말하는 중 [▶] → 말하기 멈춤·되돌림 없음 · 기다리는 중 손 → 말하지 않음 · 막힘 → 한 마디 → 되돌림', async () => {
  // 멈춤 상태에서
  const a = voiceRig();
  startAt(a, 1);
  a.sp.pause();
  a.voice.press();
  a.rec().fire('result', ['summarize']);
  a.rec().fire('end');
  await flush();
  assert.equal(a.env.opened.length, 1);
  a.synth.finish();
  await flush();
  assert.equal(a.sp.getState(), 'paused', '★ 말한 뒤 멈춘 채');
  assert.equal(a.voice.debug().stats.restores, 0);

  // 말하는 중 [▶] — 손이 이긴다
  const b = voiceRig();
  startAt(b, 1);
  b.voice.press();
  b.rec().fire('result', ['لخص']);
  b.rec().fire('end');
  await flush();
  assert.equal(b.sayer.busy(), true, '요지를 말하는 중');
  assert.equal(b.voice.isListening(), true, '9a·화면 단추가 먼저 cancel 하도록 "바쁨"');
  const restores = b.voice.debug().stats.restores;
  b.pressPlay();                                              // [▶]
  await flush();
  assert.equal(b.sayer.busy(), false, '★ 말하기 멈춤');
  assert.equal(b.voice.debug().stats.restores, restores, '★ 되돌림 없음(음성 흐름이 다시 재생하지 않는다)');
  assert.equal(b.env.presses, 1, '[▶] 는 평소대로 한 번');
  assert.equal(b.sp.getState(), 'speaking', '[▶] 자신의 동작(멈춤 → 재생)');

  // 요약을 기다리는 사이 손(줄 탭 → cancelVoice) → 말하지 않음
  const c = voiceRig({ holdSheet: true });
  startAt(c, 1);
  c.voice.press();
  c.rec().fire('result', ['لخص']);
  c.rec().fire('end');
  await flush();
  const n = c.synth.utt.length;
  c.voice.cancel();
  c.env.hold();
  await flush();
  assert.equal(c.synth.utt.length, n, '★ 말하지 않는다');
  assert.equal(c.sp.getState(), 'paused', '되돌림 없음');

  // 막힘(429) → 상태 줄 + 한 마디 → 되돌림
  const d = voiceRig({ sheetResult: { state: 'blocked', code: 'exhausted', note: { key: 'readalong.blocked.exhausted', retry: true } } });
  startAt(d, 1);
  d.voice.press();
  d.rec().fire('result', ['لخص']);
  d.rec().fire('end');
  await flush();
  assert.equal(lastStatus(d).kind, 'error');
  assert.equal(lastStatus(d).text, BUNDLES.en['readalong.blocked.exhausted']);
  assert.equal(d.synth.utt[d.synth.utt.length - 1].text, BUNDLES.en['readalong.blocked.exhausted'], '한 마디(UI 언어)');
  d.synth.finish();
  await flush();
  assert.equal(d.sp.getState(), 'speaking', '한 마디 뒤 되돌림');
});

/* ══ K12 명령 표 ═══════════════════════════════════ */

test('K12 음성 명령 summarize — ar·en · 정규화 · 부정 · 일상 문장 오탐 0', () => {
  const c = commandById('summarize');
  assert.equal(c.enabled, true);
  for (const s of ['لخص', 'لخّص', 'ملخص', 'تلخيص', 'لخص الفقرة', 'من فضلك لخص']) {
    assert.equal(matchCommand([s], 'ar').id, 'summarize', s);
  }
  for (const s of ['summarize', 'summary', 'sum up', 'please summarize']) assert.equal(matchCommand([s], 'en').id, 'summarize', s);
  assert.equal(matchCommand(['summarize'], 'ar').id, 'summarize', 'ar 모드에서 라틴 글자 — 영어 표');
  assert.equal(matchCommand(["don't summarize"], 'en').id, null, '부정어 → 무효');
  assert.equal(matchCommand(['لا تلخيص'], 'ar').id, null);
  for (const s of ['the summary of the case was long', 'ملخص الحالة طويل جدا اليوم', 'I need a summary of this chapter later']) {
    assert.equal(matchCommand([s], s.match(/[a-z]/) ? 'en' : 'ar').id, null, '긴 일상 문장 — 한 낱말 포함 일치 없음(9b ①): ' + s);
  }
  assert.equal(matchCommand(['التالي'], 'ar').id, 'next', '기존 명령 그대로');
  // `[11-4]` explain 을 켰다 — 같은 말이 같은 id(맞춤 결과 불변) · 이제 enabled.
  assert.equal(matchCommand(['اشرح'], 'ar').id, 'explain');
  assert.equal(matchCommand(['اشرح'], 'ar').enabled, true, 'explain 은 11-4 가 켰다');
});

/* ══ K13 서재 삭제 확인 ════════════════════════════ */

test('K13 서재 삭제 확인 — "저장한 요약 n개는 남습니다" · 머리 문장 · 한 함수 · 지운 뒤 남음(fake-idb)', async () => {
  assert.deepEqual(deleteKeepLines({ vocab: 2, summaries: 3 }), [
    { key: 'library.card.deleteConfirmVocab', params: { n: 2 } }, { key: 'library.card.deleteConfirmSummaries', params: { n: 3 } }]);
  assert.deepEqual(deleteKeepLines({ vocab: 0, summaries: 0 }), []);
  assert.deepEqual(await deleteKeepCounts('d', { vocab: { countByDoc: async () => 1 }, summaries: { count: async () => 4 } }), { vocab: 1, summaries: 4 });
  assert.deepEqual(await deleteKeepCounts('d', { vocab: { countByDoc: async () => 1 }, summaries: { count: async () => 0 } }), { vocab: 1 }, '0 이면 줄도 키도 없다(8f-2 꼴)');
  assert.deepEqual(await deleteKeepCounts('d', { vocab: { countByDoc: async () => 0 }, summaries: { count: async () => { throw new Error('x'); } } }), { vocab: 0 }, '못 읽어도 확인은 뜬다');
  const tr = (k, p) => k + JSON.stringify(p || {});
  // `[12-2 — spec 17-11 4]` 남는 것은 한 줄(`library.card.deleteKeeps` 의 {list} 안에 조각).
  assert.equal(deleteConfirmText('T', deleteKeepLines({ summaries: 2 }), tr), 'library.card.deleteConfirm{"title":"T"}\nlibrary.card.deleteKeeps{"list":"library.card.deleteConfirmSummaries{\\"n\\":\\"2\\"}"}');
  for (const l of LANGS) {
    assert.match(BUNDLES[l]['library.card.deleteConfirmSummaries'], /\{n\}/);
    assert.match(BUNDLES[l]['library.card.deleteConfirm'], /\{title\}/);
    assert.ok(!/everything/i.test(BUNDLES[l]['library.card.deleteConfirm']), l + ' — annotations 가 남으므로 "everything" 이 아니다');
  }
  assert.match(BUNDLES.ko['library.card.deleteConfirm'], /[가-힣]/, 'ko 머리 문장이 한국어(11-1R #8)');
  // 실제 저장소 — 요약 1 + 개요 1 → 셈 2 → 문서 삭제 → 남음
  const store = createSummaryStore({ now: () => T0 });
  await db.put('documents', { id: 'docDel2', title: 'x', fileName: 'x.pdf' });
  await store.save({ docId: 'docDel2', pageNo: 3, para: { paraId: '3:p1', text: 'Some paragraph text here. And more.' }, target: 'ar', value: { gist: 'g' } });
  await store.saveOutline({ docId: 'docDel2', range: { from: 1, to: 4 }, target: 'ar', value: { title: 't', points: [] } });
  assert.equal((await deleteKeepCounts('docDel2')).summaries, 2, '요약 + 개요');
  await db.deleteDocument('docDel2');
  assert.equal(await store.count('docDel2'), 2, '★ 지운 뒤 annotations 에 남는다');
  const lib = strip(read('../js/ui/library.js'));
  assert.match(lib, /if \(!confirm\(deleteConfirmText\(name, deleteKeepLines\(await deleteKeepCounts\(docId\)\)\)\)\) return;/, '한 함수(crossstep 8f-2·11-2)');
});

/* ══ K14 배선·계층·마크업·CSS·i18n ═════════════════ */

test('K14 배선·계층 — innerHTML 0 · Esc 층 · 같은 높이 식 · 시트가 열리면 선택 줄 숨김 · import 방향 · 4언어 키', () => {
  for (const f of ['../js/ui/sumsheet.js', '../js/ui/ask.js', '../js/ui/tree.js', '../js/tts/say.js']) {
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(strip(read(f))), f + ' innerHTML 0');
    assert.ok(!/onclick/.test(strip(read(f))), f);
  }
  const s = strip(read('../js/ui/sumsheet.js'));
  assert.match(s, /document\.addEventListener\('keydown', onKey, true\);/);
  const k = s.slice(s.indexOf('function onKey('), s.indexOf('function trapTab('));
  assert.match(k, /if \(!sumEsc\(\{ open: true, shown: shown\(\), prevented: ev\.defaultPrevented, composing: !!ev\.isComposing \}\)\) return;\s*ev\.preventDefault\(\);\s*ev\.stopPropagation\(\);\s*cancelVoiceNow\(\);\s*closeSheet\(true\);/, '★ 시트가 가장 위 층 — 시트만 닫고 퍼지지 않음 · `[11-3 — 11-2R #1]` [×] 와 같게 말하기 취소');
  const flow = s.slice(s.indexOf('export function createSumFlow('), s.indexOf('let els = null;'));
  assert.ok(!/\b(document|window)\b/.test(flow), '흐름은 DOM 을 모른다');
  assert.ok(!/\bfetch\(|buildSummaryRequest|SUMMARY_SCHEMA/.test(s), '요청 꼴을 직접 만들지 않는다(pipeline.summarize 하나)');
  const a = strip(read('../js/ui/ask.js'));
  const imp = [...a.matchAll(/^import [^;]* from '([^']+)';/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imp, ['../text/select.js', '../text/summary.js', '../tts/text.js'], 'ask 는 순수·tts/text 만 — speaker·시트·sayer 는 주입');
  const v = strip(read('../js/ui/voice.js'));
  assert.ok(!/ask\.js|sumsheet|pipeline/.test(v), 'voice.js 는 ask 를 import 하지 않고 주입받는다');
  assert.match(v, /case 'summarize':\s*summarize\(was, heard\);/);
  // controls 배선
  const c = strip(read('../js/ui/controls.js'));
  assert.match(c, /onSummarize: function \(o\) \{ return ask \? ask\.summarize\(o\) : Promise\.resolve\(null\); \},\s*sayer: sayer/);
  assert.match(c, /\} else if \(id === 'summary'\) \{\s*if \(ask\) ask\.summarize\(\{ via: 'button', snap: snap \}\)/);
  assert.match(c, /if \(sumsheet\) sumsheet\.close\(false\);/, '리더를 떠나면 거둔다');
  assert.match(c, /units: function \(\) \{ syncReadalong\(\); return speaker\.sentenceUnits\(\); \},\s*ctx:/, '탭 번역·단어 시트와 같은 문장 단위');
  assert.ok(c.indexOf('trband = initTrBand(') < c.indexOf('sumsheet = initSumSheet('), 'Esc — 띠가 먼저 등록(시트를 위층으로 보고 물러남)');
  const tb = strip(read('../js/ui/trband.js'));
  assert.match(tb, /dialog\[open\], \[role="dialog"\]:not\(\[hidden\]\)/);
  // 마크업
  const html = read('../index.html');
  assert.match(html, /<div class="sum-sheet" id="sumSheet" role="dialog" aria-modal="false" aria-labelledby="sumTitle" hidden>/);
  const sheet = html.slice(html.indexOf('id="sumSheet"'), html.indexOf('id="wordSheet"'));
  for (const id of SS.SUM_ACTIONS.concat(['close', 'askYes', 'askNo'])) assert.ok(sheet.includes('data-sum-action="' + id + '"'), id);
  assert.match(sheet, /<p class="sum-disclaimer" data-i18n="sum\.disclaimer"><\/p>/, '고지 한 줄(11-D18)');
  assert.match(sheet, /<a class="sum-link" id="sumLink" href="#\/summaries" data-i18n="sum\.savedLink" data-i18n-n="0" hidden><\/a>/, '11-3 이 켠다');
  assert.ok(!/onclick|style=/.test(sheet));
  for (const m of ['ui/sumsheet.js', 'ui/ask.js', 'ui/tree.js', 'tts/say.js']) {
    assert.match(html, new RegExp('"\\./js/' + m.replace('/', '\\/').replace('.', '\\.') + '": "\\./js/' + m.replace('/', '\\/').replace('.', '\\.') + '\\?v=[0-9a-f]{10}"'), m + ' 도장');
  }
  // CSS — 단어 시트와 같은 식 · z 36 · 머리 sticky · 48px · 논리 속성만
  const css = read('../css/reader.css');
  const ss = css.slice(css.indexOf('.sum-sheet {'), css.indexOf('/* ── 하단 컨트롤 바'));
  assert.match(ss, /inset-block-end: calc\(var\(--reader-chrome-bottom\) \+ var\(--sp-2\) \+ env\(safe-area-inset-bottom, 0px\)\);/);
  assert.match(ss, /max-block-size: max\(calc\(var\(--tap\) \* 3\), calc\(100dvh - var\(--banners-h, 0px\) - var\(--bar-top\) - var\(--reader-chrome-bottom\) - var\(--sp-6\)\)\);/);
  assert.match(ss, /z-index: 36;/);
  assert.match(ss, /:root\[data-sum-sheet="on"\] \.sel-bar,\s*:root\[data-sum-sheet="on"\] \.back-to-line \{ display: none; \}/);
  assert.match(ss, /\.sum-sheet \.sum-head \{\s*position: sticky;\s*inset-block-start: 0;/);
  assert.match(ss, /\.sum-sheet \.sum-btn \{[\s\S]*?min-block-size: var\(--tap\);/);
  assert.match(ss, /\.sum-sheet \.sum-tree summary \{[\s\S]*?min-block-size: var\(--tap\);/);
  assert.ok(!/\b(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/.test(ss), '논리 속성만(16-H)');
  // i18n — 4언어 같은 키 · 자리표시자
  const keys = Object.keys(BUNDLES.en).filter((x) => x.startsWith('sum.')).concat(['sel.more', 'sel.summary', 'voice.cmd.summarize', 'voice.cmd.summarizePrev', 'library.card.deleteConfirmSummaries']);
  assert.ok(keys.length >= 28, String(keys.length));
  for (const l of LANGS) for (const x of keys) assert.ok(typeof BUNDLES[l][x] === 'string' && BUNDLES[l][x].length > 0, l + ' ' + x);
  for (const l of LANGS) {
    assert.match(BUNDLES[l]['sum.pageAll'], /\{n\}[\s\S]*\{k\}/, l + ' 문단 n · 호출 k');
    assert.match(BUNDLES[l]['sum.title'], /\{page\}/);
    assert.match(BUNDLES[l]['sum.disclaimer'], /AI|IA|الذكاء/, l + ' AI 고지');
  }
  // 흐름·시트가 내는 문구 키가 번들에 있다
  for (const m of read('../js/ui/sumsheet.js').matchAll(/'(sum\.[a-zA-Z.]+)'/g)) assert.ok(BUNDLES.en[m[1]], 'sumsheet 키 ' + m[1]);
  for (const m of read('../js/ui/voice.js').matchAll(/'(sum\.[a-zA-Z.]+)'/g)) assert.ok(BUNDLES.en[m[1]], 'voice 키 ' + m[1]);
  for (const m of read('../js/ui/selbar.js').matchAll(/'(sum\.[a-zA-Z.]+)'/g)) assert.ok(BUNDLES.en[m[1]], 'selbar 키 ' + m[1]);
});

/* ══ K15·K16 `[11-3]` 11-2 Review 낮음 — 시험 틈 두 줄(11-2R #3 · #2) ═══════════════ */

test('K15 ★ [11-2R #3] 닫은 뒤 늦게 온 옛 문단 결과는 새 시트 문단을 덮지 않는다(run 의 gen) — 그대로 [저장]해도 새 문단 요지', async () => {
  const pend = [];
  const store = createSummaryStore({ now: () => T0 + (++storeSeq) });
  const flow = SS.createSumFlow({
    summarize: (paras) => new Promise((resolve) => pend.push({ paras: paras, resolve: resolve })),
    planSummary: async () => ({ calls: 1 }),
    gate: () => ({ ok: true, reason: null }),
    store: store
  });
  const pA = flow.open(openArgs('5:p1'));
  await flush();
  assert.equal(pend.length, 1);
  flow.close();
  const pB = flow.open(openArgs('5:p2'));
  await flush();
  assert.equal(pend.length, 2);
  const ready = (g) => ({ calls: 1, langs: ['ar', 'en'], results: [{ state: 'ready', value: { gist: g, points: [], terms: [] } }] });
  pend[1].resolve(ready('GIST_B'));                // 새 문단이 먼저 오고
  await pB;
  pend[0].resolve(ready('GIST_A'));                // 옛 문단 응답이 늦게 온다
  await pA;
  await flush();
  const v = flow.view();
  assert.equal(v.items[0].para.paraId, '5:p2');
  assert.equal(v.items[0].value.gist, 'GIST_B', '★ 옛 결과가 새 문단을 덮지 않는다');
  assert.equal(v.calls, 1, '옛 응답의 호출 수도 세지 않는다(닫힌 시트의 것)');
  const s = await flow.save(0);
  assert.equal(s.items[0].saved.gist, 'GIST_B', '저장도 새 문단 요지');
  assert.equal(s.items[0].saved.anchor.paraId, '5:p2');
});

test('K16 ★ [11-2R #2] 요지를 말하는 중 마이크를 다시 탭 → 말하기 멈춤 · 되돌림 없음 · 다시 듣기 시작', async () => {
  const h = voiceRig();
  startAt(h, 1);
  h.voice.press();
  h.rec().fire('result', ['لخص']);
  h.rec().fire('end');
  await flush();
  assert.equal(h.sayer.busy(), true, '요지를 말하는 중');
  const restores = h.voice.debug().stats.restores;
  const recs = h.rec();
  h.voice.press();                                            // 마이크 다시 탭
  await flush();
  assert.equal(h.sayer.busy(), false, '★ 말하기 멈춤(stopAsk)');
  assert.notEqual(h.rec(), recs, '새로 듣기 시작');
  h.synth.finish();
  await flush();
  assert.equal(h.voice.debug().stats.restores, restores, '★ 되돌림 없음 — 말하기 끝을 기다리던 restore(was) 가 돌지 않는다');
  assert.equal(h.sp.getState(), 'paused', '낭독은 듣는 동안 멈춘 채(9b)');
});
