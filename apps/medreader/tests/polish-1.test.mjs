/* ============================================================
   tests/polish-1.test.mjs — 다듬기 묶음 1 (8k·8l·8g-4b Review 의 작은 항목들, 2026-10-21)

   P  `[8k Review]` 퀴즈 첫 [읽기] 경쟁 상태(8kR-9) · 퀴즈 다시 고르기(R8) · 번역 언어 변경 알림(R4) — **동작**으로
   Q  `[8l Review 8lR-9]` UI 배선 넷 — 판정 시작 시점(R1) · [원본 보기] noticed(R2) · 검색 final(R3) · ▶ 큐 인용 거르기(R4)
      · 검색 화면이 판정 저장을 듣는다(남은 문제 2) · 띠 단추 한 줄 · 배너 닫기 문구
   R  `[8g-4b Review]` R2 목차 이동 뒤 뷰 전환 · R3 멈춤 안내 자리 · R4 접기 단추 이름 · R5 살아남은 변이 M3·M4·M9
      · `[8g-4b-R1 Review]` 탭 목록 이름 · 목차 탭 Tab/굴림

   픽스처 글자는 지어낸 것이다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

const settings = await import('../js/settings.js');
const { DEFAULTS } = settings;
const quiz = await import('../js/ui/quiz.js');
const { chooseTargetLang } = await import('../js/ui/settings.js');
const { applyTrSpeech, scanPlayBlocked } = await import('../js/ui/controls.js');
const { createSpeaker } = await import('../js/tts/speaker.js');
const { buildUnits } = await import('../js/tts/text.js');
const { scheduleScan } = await import('../js/ui/library.js');
const { SCAN } = await import('../js/config.js');
const searchUi = await import('../js/ui/search.js');
const { BUNDLES, LANGS } = await import('../js/i18n/index.js');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ══ P. 8k — 퀴즈 [읽기] · 번역 언어 알림 ═══════════════════════════ */

function V(lang) { return { name: 'voice ' + lang, lang: lang, voiceURI: 'urn:' + lang, localService: true, default: false }; }
const LIST = ['en_AU', 'en_GB', 'en_IN', 'en_US', 'fr_CA', 'fr_FR', 'ko_KR'].map(V);
const GB = LIST[1];
const SRC = 'The patient presented with fever.';

/** 가짜 `window.speechSynthesis` — 목록은 **처음부터 동기로** 있다(Android·데스크톱 대부분). */
function fakeWindowSynth(list) {
  const s = {
    speaking: false, pending: false, paused: false, utt: [], current: null,
    getVoices() { return list.slice(); },
    addEventListener() { }, removeEventListener() { },
    speak(u) { s.speaking = true; s.current = u; s.utt.push(u); },
    cancel() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    pause() { }, resume() { }
  };
  return s;
}

const getFrom = (o) => (k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : DEFAULTS[k]);

test('P1 ★ 퀴즈 화면에 들어와 **처음** 누른 [읽기] 도 고른 목소리 — 목록을 동기로 읽는다(8kR-9 경쟁 상태)', async () => {
  const synth = fakeWindowSynth(LIST);
  globalThis.window = { speechSynthesis: synth, SpeechSynthesisUtterance: function (text) { this.text = text; } };
  try {
    settings._setCacheForTest({ 'tts.voice.en': GB.voiceURI, 'tts.accent.en': 'en-GB' });
    quiz._toggleSpeakForTest(SRC, null);          // 첫 누름 — speaker 를 이때 만든다(loadVoices 의 then 은 아직)
    assert.ok(synth.utt.length >= 1, '발화가 나갔다');
    assert.equal(synth.utt[0].voice, GB, '★ 첫 누름부터 고른 음성(전에는 voice 없이 태그 en-GB)');
    assert.equal(synth.utt[0].lang, 'en-GB');
    quiz._toggleSpeakForTest(SRC, null);          // 읽는 중 누름 = 멈춤
    await sleep(0);

    // P2 — R8: 설정에서 "인도 억양만"으로 바꾸고 다시 누르면 그 태그로(누를 때마다 다시 고른다)
    settings._setCacheForTest({ 'tts.voice.en': '', 'tts.accent.en': 'en-IN' });
    const n = synth.utt.length;
    quiz._toggleSpeakForTest(SRC, null);
    const u = synth.utt[n];
    assert.ok(u, '다시 누름 — 발화');
    assert.equal(u.voice, undefined, '★ 억양만 — voice 를 지운다(앞에 고른 en_GB 를 들고 있지 않다)');
    assert.equal(u.lang, 'en-IN');
    quiz._toggleSpeakForTest(SRC, null);
    await sleep(0);

    // 휴대폰 설정 따름으로 돌아오면 태그만
    settings._setCacheForTest({});
    const m = synth.utt.length;
    quiz._toggleSpeakForTest(SRC, null);
    assert.deepEqual([synth.utt[m].voice, synth.utt[m].lang], [undefined, 'en-US']);
    quiz._toggleSpeakForTest(SRC, null);
    await sleep(0);
  } finally {
    delete globalThis.window;
    settings._setCacheForTest({});
  }
});

test('P1b quizVoicesNow — 읽어 둔 목록이 있으면 그것 · 비면 getVoices() 동기 · 실패·빈 목록·synth 없음은 []', () => {
  const cached = [V('en_US')];
  let calls = 0;
  const synth = { getVoices() { calls++; return LIST; } };
  assert.equal(quiz.quizVoicesNow(cached, synth), cached);
  assert.equal(calls, 0, '읽어 둔 것이 있으면 부르지 않는다');
  assert.deepEqual(quiz.quizVoicesNow([], synth), LIST);
  assert.deepEqual(quiz.quizVoicesNow(null, { getVoices() { throw new Error('x'); } }), []);
  assert.deepEqual(quiz.quizVoicesNow([], { getVoices() { return []; } }), []);
  assert.deepEqual(quiz.quizVoicesNow([], null), []);
});

test('P3 ★ 번역 언어를 바꾸면 medreader:voicepref 를 알린다 → 번역문 경로가 새 언어 태그로 (R4 — 8k 결함 ② 되살림 방지)', async () => {
  settings._setCacheForTest({ 'ai.translationLang': 'ar' });
  const target = new EventTarget();
  const got = [];
  // 리더(`controls.onVoicePref`)가 하는 일 — 대상 언어로 번역문 음성·태그를 다시 고른다
  const speakerTr = { tag: null, voice: 'old', setTrVoice(tag, voice) { this.tag = tag; this.voice = voice; } };
  target.addEventListener('medreader:voicepref', (ev) => {
    got.push(ev.detail && ev.detail.lang);
    applyTrSpeech(speakerTr, settings.get('ai.translationLang'), LIST, settings.get);
  });
  assert.equal(chooseTargetLang('ko', target), true);
  assert.deepEqual(got, ['ko'], '★ 알림 한 번(대상 언어 실어서)');
  assert.equal(settings.get('ai.translationLang'), 'ko', '저장값(캐시)이 먼저 바뀐다 — 리더가 읽을 때 새 값');
  assert.deepEqual([speakerTr.tag, speakerTr.voice], ['ko-KR', null], '번역문 = ko 태그 · 휴대폰 설정 따름(voice 없음)');
  assert.equal(chooseTargetLang('ko', target), false, '같은 값 — 아무것도 안 함');
  assert.deepEqual(got, ['ko']);
  assert.equal(chooseTargetLang('xx', target), true, '모르는 값은 기본 언어로 정규화');
  assert.equal(got.length, 2);
  await sleep(0);
  settings._setCacheForTest({});
});

/* ══ Q. 8l — UI 배선 넷 · 검색이 판정 저장을 듣는다 · 띠 · 배너 문구 ═══════════════ */

function fakeLater() {
  const jobs = [];
  return {
    jobs,
    setTimeout: (fn, ms) => { jobs.push({ fn, ms, live: true }); return jobs.length; },
    clearTimeout: (k) => { if (jobs[k - 1]) jobs[k - 1].live = false; },
    fire() { for (const j of jobs) if (j.live) { j.live = false; j.fn(); } }
  };
}

test('Q1 ★ 판정 시작 — 첫 쪽(page 이벤트) 또는 1.5초 뒤, 둘 중 먼저 한 번만 · 그 전엔 0 (R1 — 첫 화면을 늦추지 않는다)', () => {
  assert.equal(SCAN.START_AFTER_MS, 1500);
  // 첫 쪽이 먼저
  const ex = new EventTarget();
  const runs = [];
  const t1 = fakeLater();
  scheduleScan('d1', { numPages: 3 }, ex, { run: (id) => runs.push(id), setTimeout: t1.setTimeout, clearTimeout: t1.clearTimeout });
  assert.deepEqual(runs, [], '★ 곧바로 시작하지 않는다');
  assert.equal(t1.jobs.length, 1);
  assert.equal(t1.jobs[0].ms, SCAN.START_AFTER_MS);
  ex.dispatchEvent(new Event('page'));
  assert.deepEqual(runs, ['d1'], '첫 쪽이 나오면 시작');
  assert.equal(t1.jobs[0].live, false, '타이머를 거둔다');
  ex.dispatchEvent(new Event('page'));
  t1.fire();
  assert.deepEqual(runs, ['d1'], '한 번만');
  // 이미 다 뽑힌 문서 — page 가 안 온다 → 타이머
  const ex2 = new EventTarget();
  const runs2 = [];
  const t2 = fakeLater();
  scheduleScan('d2', {}, ex2, { run: (id) => runs2.push(id), setTimeout: t2.setTimeout, clearTimeout: t2.clearTimeout });
  assert.deepEqual(runs2, []);
  t2.fire();
  assert.deepEqual(runs2, ['d2']);
  ex2.dispatchEvent(new Event('page'));
  assert.deepEqual(runs2, ['d2'], '타이머 뒤 page 는 무시(듣기를 뗐다)');
});

test('Q2 ★ 띠 [원본 보기]도 [닫기]처럼 noticed 를 남긴다 — 저장은 toOriginal 과 무관(R2, 배선)', () => {
  const r = noComments(read('../js/ui/reader.js'));
  assert.match(r, /els\.scanNoticeClose\.addEventListener\('click', \(\) => dismissScanNotice\(false\)\)/);
  assert.match(r, /els\.scanNoticeOriginal\.addEventListener\('click', \(\) => dismissScanNotice\(true\)\)/);
  const body = r.slice(r.indexOf('function dismissScanNotice('), r.indexOf('function onDocLang('));
  // 저장 줄은 docId 만 본다(원본으로 가는지와 상관없이)
  assert.match(body, /\n\s*if \(docId != null\) markScanNoticed\(docId\)\.catch\(/);
  assert.doesNotMatch(body, /toOriginal[^\n]*markScanNoticed|markScanNoticed[^\n]*toOriginal/, '★ 저장이 toOriginal 에 걸리지 않는다');
  const save = body.indexOf('markScanNoticed(docId)');
  const view = body.indexOf("setView('original'");
  assert.ok(save > 0 && view > save, '저장이 뷰 전환보다 먼저(뷰 전환이 던져도 남는다)');
  assert.equal((body.match(/markScanNoticed\(/g) || []).length, 1);
  assert.match(body, /noticed: true/, '열린 문서 상태도 noticed — 다시 그려도 띠가 안 뜬다');
});

test('Q3 ★ 검색 안내는 판정 final 을 쓴다 — 찾는 중(결과 0)엔 스캔본 안내 없음, 끝나야 "찾지 못했습니다" 대신 한 줄(R3)', () => {
  const scan = { scan: { verdict: 'scan' } };
  const busy = { final: false, result: { hits: [] } };
  const done = { final: true, result: { hits: [] } };
  assert.equal(searchUi.scanNoticeFor(busy, scan), null, '★ 찾는 중에는 내지 않는다');
  assert.deepEqual(searchUi.scanNoticeFor(done, scan), { key: 'reader.scan.noSearch', replace: true });
  assert.equal(searchUi.scanNoticeFor({ final: true, result: { hits: [{}] } }, scan), null, '결과가 있으면 그대로');
  assert.deepEqual(searchUi.scanNoticeFor(busy, { scan: { verdict: 'garbled' } }), { key: 'reader.scan.garbledSearch', replace: false }, '깨짐 — 결과와 상관없이 위에 한 줄');
  assert.equal(searchUi.scanNoticeFor(done, { scan: { verdict: 'text' } }), null);
  assert.equal(searchUi.scanNoticeFor(done, null), null, '판정 없음');
  assert.equal(searchUi.scanNoticeFor({ final: true, result: null }, scan), null, '결과 없음');
  const s = noComments(read('../js/ui/search.js'));
  const st = s.slice(s.indexOf('function paintModelStatus('), s.indexOf('function paintModel('));
  assert.match(st, /const sn = scanNoticeFor\(m, S\.docRecs\.get\(S\.docId\) \|\| S\.doc\);/);
});

test('Q4 ★ ▶ 큐 인용 거르기 — 인용만 있는 쪽은 스캔본 문서에서 빈 쪽(막음 → noRead), 인용 읽기를 켜면 막지 않는다(R4)', async () => {
  const cite = [{ id: 'c1', kind: 'body', lines: [{ id: '5:0', text: 'doi:10.1000/xyz123', hyphen: 'none' }] }];
  const units = buildUnits(cite, 'sentence', { lang: 'en' });
  assert.ok(units.length > 0 && units.every((u) => u.cite === true), '픽스처 — 그 쪽 단위가 모두 인용');
  const make = (on) => {
    const spoken = [];
    const synth = { speaking: false, pending: false, speak(u) { spoken.push(u.text); }, cancel() { }, pause() { }, resume() { } };
    const view = { paras: () => cite, page: () => ({ page: 5, pageCount: 9 }), goToPage: () => Promise.resolve(false), show: () => true, markDone: () => { } };
    const sp = createSpeaker({ synth, timers: { setTimeout: () => 1, clearTimeout: () => { }, now: () => 0 }, makeUtterance: (text) => ({ text }), view,
      translation: null, requestWakeLock: () => Promise.resolve(null), readCitations: () => on });
    return { sp, spoken };
  };
  const off = make(false);
  assert.equal(off.sp.isQueueEmptyHere(), true, '★ play() 가 만들 큐(인용 거름)와 같은 규칙 — 비었다');
  assert.equal(scanPlayBlocked(off.sp, 'scan'), true, '스캔본 — 막는다(쪽을 넘기지 않음)');
  assert.equal(scanPlayBlocked(off.sp, 'garbled'), false, '깨짐은 막지 않는다');
  assert.equal(off.sp.getTotal(), 0, '읽기만 — 큐를 바꾸지 않는다');
  assert.equal(off.sp.getState(), 'idle');
  const on = make(true);
  assert.equal(on.sp.isQueueEmptyHere(), false, '인용 읽기 켬 — 읽을 것이 있다');
  assert.equal(scanPlayBlocked(on.sp, 'scan'), false);
  on.sp.play();
  assert.ok(on.spoken.length >= 1, '켜면 인용을 읽는다');
});

test('Q5 ★ 검색 화면이 판정 저장(medreader:docscan)을 듣는다 — 연 뒤에 판정이 와도 안내 줄(남은 문제 2)', () => {
  const st = { docId: 'D', doc: { id: 'D', title: 't', scan: null }, docRecs: new Map() };
  st.docRecs.set('D', st.doc);
  const before = st.doc;
  assert.equal(searchUi.noteDocScan(st, 'D', { v: 1, verdict: 'scan' }), true, '★ 이 책 범위 — 다시 그릴 일');
  assert.equal(st.doc.scan.verdict, 'scan');
  assert.equal(st.docRecs.get('D').scan.verdict, 'scan');
  assert.equal(before.scan, null, '레코드는 새 객체로(받은 것을 바꾸지 않는다)');
  assert.equal(st.doc.title, 't', '다른 필드는 그대로');
  assert.deepEqual(searchUi.scanNoticeFor({ final: true, result: { hits: [] } }, st.docRecs.get('D') || st.doc),
    { key: 'reader.scan.noSearch', replace: true }, '그래서 다음 그리기에 안내 줄');
  assert.equal(searchUi.noteDocScan(st, 'X', { verdict: 'scan' }), false, '다른 책 — 그리지 않음');
  const lib = { docId: null, doc: null, docRecs: new Map([['E', { id: 'E' }]]) };
  assert.equal(searchUi.noteDocScan(lib, 'E', { verdict: 'garbled' }), false, '서재 범위 — 레코드만 고치고 그리지 않음');
  assert.equal(lib.docRecs.get('E').scan.verdict, 'garbled');
  assert.equal(searchUi.noteDocScan(st, null, {}), false);
  const s = noComments(read('../js/ui/search.js'));
  const init = s.slice(s.indexOf('export function initSearch('), s.indexOf('function watchRoute('));
  assert.match(init, /document\.addEventListener\('medreader:docscan', \(ev\) => onDocScan\(ev\.detail \|\| \{\}\)\);/);
  assert.match(init, /function onDocScan\(d\) \{\s*if \(!noteDocScan\(S, d\.docId, d\.scan\)\) return;\s*if \(S\.shown && S\.scope === 'doc'\) paintModelStatus\(\);\s*\}/);
});

test('Q6 띠 단추 한 줄 — 폰 폭(≤ 599px)에서 글은 한 줄을 다 쓰고 [원본]·[닫기]가 함께 아래 줄(끝 정렬) · 단추 48 규칙 그대로', () => {
  const css = read('../css/reader.css');
  const m = css.match(/@media \(max-width: 599px\) \{([\s\S]*?)\n\}/);
  assert.ok(m, '미디어 규칙');
  assert.match(m[1], /\.scan-notice \.banner-text \{ flex-basis: 100%; \}/);
  assert.match(m[1], /\.scan-notice \.banner-action \{ margin-inline-start: auto; \}/);
  assert.doesNotMatch(m[1], /min-block-size|min-inline-size|font-size/, '48px·글자 크기를 건드리지 않는다');
  const html = read('../index.html');
  const band = html.slice(html.indexOf('id="scanNotice"'), html.indexOf('id="scanNoticeClose"') + 80);
  assert.ok(band.indexOf('id="scanNoticeOriginal"') < band.indexOf('id="scanNoticeClose"'), '[원본] → [닫기] 순서');
  assert.match(band, /class="banner-action" id="scanNoticeOriginal"/);
});

test('Q7 배너 닫기(common.dismiss) — ko 는 한국어("닫기" — 띠와 같은 말) · 네 언어 모두 영어 복사가 아니다(en 제외)', () => {
  assert.equal(BUNDLES.ko['common.dismiss'], '닫기');
  assert.equal(BUNDLES.ko['common.dismiss'], BUNDLES.ko['common.close']);
  for (const lang of LANGS) {
    assert.equal(typeof BUNDLES[lang]['common.dismiss'], 'string');
    assert.ok(BUNDLES[lang]['common.dismiss'].trim(), lang + ' 비어 있지 않다');
    if (lang !== 'en') assert.notEqual(BUNDLES[lang]['common.dismiss'], BUNDLES.en['common.dismiss'], lang + ' 영어 그대로');
  }
  const fr = read('../js/i18n/fr.js').split('\n').find((l) => l.indexOf("'common.dismiss'") >= 0);
  assert.match(fr, /\[검토 — Nour·운영자\]/, 'fr 새 문안은 검토 표시');
});

/* ══ R. 8g-4b·8g-4b-R1 — 목차 이동 뒤 뷰 전환 · 멈춤 안내 · 접기 이름 · 살아남은 변이 · 탭 ═══════ */

const srch = () => noComments(read('../js/ui/search.js'));
const between = (s, a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a) + a.length));

test('R1 ★ 목차 이동은 검색 시작점이 아니다 — doTop 이 lastJump 를 지워 뷰 전환 뒤 옛 적중으로 되돌아가지 않는다(8g-4b R2)', () => {
  const scr = (view) => ({ docId: 'D', page: 203, view });
  const lj = { docId: 'D', pageNo: 203, i: 26 };
  // 결과로 간 뒤에는 그 쪽 적중이 기준 줄·다시 cue(F2 그대로)
  assert.equal(searchUi.jumpOwnsPage(lj, scr('reflow')), true);
  assert.equal(searchUi.shouldRecue(null, scr('reflow'), lj, { docId: 'D', page: 203, view: 'original' }, true), true);
  // 같은 쪽 목차 항목으로 간 뒤(lastJump 지움) — 뷰를 오가도 다시 cue 없음 · 기준 줄 힌트 없음
  assert.equal(searchUi.jumpOwnsPage(null, scr('reflow')), false);
  assert.equal(searchUi.shouldRecue(null, scr('reflow'), null, { docId: 'D', page: 203, view: 'original' }, true), false);
  assert.equal(searchUi.jumpOwnsPage({ docId: 'D', pageNo: 9 }, scr('reflow')), false, '다른 쪽 적중');
  assert.equal(searchUi.jumpOwnsPage(lj, { docId: 'E', page: 203 }), false, '다른 책');
  const s = srch();
  const dt = between(s, 'function doTop(', 'function pausedBanner(');
  assert.match(dt, /^function doTop\(scr, pend\) \{\s*S\.lastJump = null;\s*repaint\(scr, false\);/, '★ 다시 칠하기 **전에** 지운다(칠하기가 기준 줄을 다시 잡지 않게)');
  const pt = between(s, 'function paint(loc)', 'function clearPaint(');
  assert.match(pt, /if \(scr && jumpOwnsPage\(S\.lastJump, scr\)\) S\.curLine = /, '기준 줄 힌트는 마지막 적중의 쪽에서만');
  const dh = between(s, 'function doHit(', 'function doSpot(');
  assert.ok(dh.indexOf('S.lastJump = { docId: scr.docId, pageNo: scr.page, i: pend.i };') < dh.indexOf('paint(loc)'), '결과 이동은 칠하기 전에 lastJump — 힌트가 그대로 잡힌다');
  const rp = between(s, 'function repaint(', 'function paint(loc)');
  assert.match(rp, /S\.lastJump && S\.lastJump\.pageNo === scr\.page\) revealLine/, '원본 보기 적중 굴림도 lastJump 가 있을 때만');
});

test('R2 ★ 멈춤 안내 자리 — 띠가 이 책이면 띠, 띠가 없으면(목차 이동) 14절 배너 · [▶]·리더 떠남이면 배너를 거둔다(8g-4b R3)', () => {
  assert.equal(searchUi.pausedNoteAt(true, true), 'band');
  assert.equal(searchUi.pausedNoteAt(true, false), 'banner', '★ 전에는 숨은 띠 줄에 들어가 안 보였다');
  assert.equal(searchUi.pausedNoteAt(false, true), null);
  assert.equal(searchUi.pausedNoteAt(false, false), null);
  const s = srch();
  const dt = between(s, 'function doTop(', 'function pausedBanner(');
  assert.match(dt, /const where = pausedNoteAt\(pend\.paused, !!S\.band && S\.band\.docId === scr\.docId\);/);
  assert.match(dt, /bandNote\(where === 'band' \? \['search\.paused'\] : \[\]\);/);
  assert.match(dt, /if \(where === 'banner'\) pausedBanner\(true\);/);
  const pb = between(s, 'function pausedBanner(', 'function cueHere(');
  assert.match(pb, /'medreader:banner'/);
  assert.match(pb, /'medreader:banner-hide'/);
  assert.match(pb, /key: 'search\.paused', tone: 'warn'/);
  const init = between(s, 'export function initSearch(', 'function watchRoute(');
  assert.match(init, /onSpeechChange\(\(st\) => \{ if \(st === 'speaking'\) pausedBanner\(false\); \}\);/);
  assert.match(init, /onReaderLeave\(\(\) => \{ pausedBanner\(false\); \}\);/);
  const main = noComments(read('../js/main.js'));
  assert.match(main, /document\.addEventListener\('medreader:banner-hide', \(ev\) => hideBanner\(\(ev\.detail \|\| \{\}\)\.key\)\);/);
  const hb = between(main, 'function hideBanner(', 'function dbUpgradedBanner(');
  assert.match(hb, /bar\.remove\(\);\s*shownBanners\.delete\(key\);/, '[닫기]와 같은 정리 — 다음에 다시 뜰 수 있다');
});

test('R3 ★ 접기 단추 이름 — 제목 + 쪽 표시 + 위 항목 제목(되풀이되는 "ANSWERS" 를 구별) · 새 문구 없음(8g-4b R4)', () => {
  const items = [
    { t: 'SECTION I', p: 5, d: 1 }, { t: 'ANSWERS', p: 10, d: 2 }, { t: 'Q1', p: 11, d: 3 },
    { t: 'SECTION II', p: 20, d: 1 }, { t: 'ANSWERS', p: 30, d: 2 }, { t: 'Q2', p: 31, d: 3 }, { t: 'Q3', p: null, d: 4 },
    { t: 'Orphan', p: 40, d: 2 }
  ];
  const rows = searchUi.tocRows(items, 11);
  assert.deepEqual(rows.map((r) => r.up), [-1, 0, 1, -1, 3, 4, 5, 3], '바로 위 조상 줄');
  const folds = rows.filter((r) => r.kids > 0);
  assert.deepEqual(folds.map((r) => r.i), [1, 4], '접기 단추는 깊이 2 단위 둘');
  const a = searchUi.foldLabelIds(folds[0]);
  const b = searchUi.foldLabelIds(folds[1]);
  assert.deepEqual(a, ['tocT1', 'tocP1', 'tocT0']);
  assert.deepEqual(b, ['tocT4', 'tocP4', 'tocT3']);
  const name = (ids) => ids.map((id) => { const i = Number(id.slice(4)); return id.startsWith('tocP') ? 'p.' + items[i].p : items[i].t; }).join(' ');
  assert.notEqual(name(a), name(b), '★ 같은 제목이어도 이름이 다르다');
  assert.deepEqual(searchUi.foldLabelIds({ i: 2, p: null, up: -1 }), ['tocT2'], '쪽 없음·위 항목 없음');
  const s = srch();
  const re = between(s, 'function tocRowEl(', 'function currentTocRow(');
  assert.match(re, /pg\.id = 'tocP' \+ r\.i;/);
  assert.match(re, /f\.setAttribute\('aria-labelledby', foldLabelIds\(r\)\.join\(' '\)\);/);
  assert.match(re, /tt\.id = 'tocT' \+ r\.i;/);
});

test('R4 ★ 살아남은 변이 M3·M4·M9 — 목차 탭에서 타이핑하면 찾기 탭 · 목차 이동이 멈춤 사실을 넘김 · 검색 화면을 떠나면 목차 읽기 세대를 올림', () => {
  const s = srch();
  const oi = between(s, 'function onInput(', 'function submitNow(');
  assert.match(oi, /if \(S\.tab === 'toc' && q\.trim\(\)\) setTab\('find'\);/, 'M3');
  assert.ok(oi.indexOf("setTab('find')") < oi.indexOf('paintRecent()'), 'M3 — 결과 그리기 전에 탭부터');
  const tj = between(s, 'function tocJump(', 'function relabel(');
  assert.match(tj, /const r = beginJump\(JUMP_ENV, \{ docId: S\.docId, pageNo: p \}, false\);\s*pend\.paused = r\.paused;/, 'M4 — 멈춤 사실을 기다리는 이동에 싣는다');
  assert.match(between(s, 'function doTop(', 'function pausedBanner('), /pausedNoteAt\(pend\.paused,/, 'M4 — 도착 처리가 그것을 읽는다');
  const ls = between(s, 'function leaveSearch(', 'function restoreScroll(');
  assert.match(ls, /S\.tocToken\+\+;/, 'M9');
  const lt = between(s, 'async function loadToc(', 'function tocKey(');
  assert.match(lt, /const my = \+\+S\.tocToken;\s*const alive = \(\) => my === S\.tocToken && S\.shown && S\.docId === docId;/, 'M9 — 늦게 끝난 읽기는 세대로 버린다');
});

test('R5 ★ 목차 탭 — 탭 목록이 상단바 아래에 붙고(굴림에도 초점 탭이 보임) · Tab 은 지금 항목으로(맞춤 유지) · Shift+Tab·수식 키는 그대로', () => {
  assert.equal(searchUi.tocTabSkips({ key: 'Tab' }), true);
  for (const ev of [{ key: 'Tab', shiftKey: true }, { key: 'Tab', altKey: true }, { key: 'Tab', ctrlKey: true }, { key: 'Tab', metaKey: true },
    { key: 'ArrowRight' }, { key: 'Enter' }, null]) assert.equal(searchUi.tocTabSkips(ev), false, JSON.stringify(ev));
  const s = srch();
  const ok = between(s, 'function onTabsKey(', 'function onInput(');
  assert.match(ok, /if \(i < 0\) return;\s*if \(tabToCurrentRow\(ev\)\) return;/);
  assert.ok(ok.indexOf('tabToCurrentRow(ev)') < ok.indexOf('tabKeyTarget('), '화살표 처리 앞에서 갈라진다');
  const br = between(s, 'function tabToCurrentRow(', 'function onTabsKey(');
  assert.match(br, /if \(ev\.target !== els\.tabToc \|\| S\.tab !== 'toc' \|\| !tocTabSkips\(ev\)\) return false;/);
  assert.ok(br.indexOf('if (!cur) return false;') < br.indexOf('ev.preventDefault();'), '지금 항목이 없으면 기본 Tab(preventDefault 없음)');
  assert.match(br, /cur\.focus\(\{ preventScroll: true \}\)/);
  assert.match(br, /cur\.scrollIntoView\(\{ block: 'nearest'/);
  const cr = between(s, 'function currentTocRow(', 'function scrollTocToCurrent(');
  assert.match(cr, /!cur\.disabled && !cur\.closest\('\[hidden\]'\)/, '접힌 가지·못 누르는 항목이면 없음');
  const css = read('../css/screens.css');
  const tabs = css.match(/\n\.search-tabs \{([\s\S]*?)\n\}/);
  assert.ok(tabs);
  assert.match(tabs[1], /position: sticky;/);
  assert.match(tabs[1], /inset-block-start: var\(--search-bar-h, var\(--bar-top\)\);/, '상단바(sticky 0) 바로 아래 — 이 화면 상단바의 실제 높이');
  assert.match(tabs[1], /background: var\(--c-bg\);/, '밑으로 지나가는 목록이 비치지 않게');
  assert.match(css, /html:has\(\.search-screen:not\(\[hidden\]\) \.search-tabs:not\(\[hidden\]\)\) \{\s*scroll-padding-block-start: calc\(var\(--search-bar-h, var\(--bar-top\)\) \+ var\(--tap\) \+ 1px\);/);
  assert.match(read('../index.html'), /<section class="screen search-screen" data-screen="search"/);
  // 상단바 높이를 재는 곳(범위 분절 테두리·아랍어 줄바꿈으로 49 보다 크다)
  const init = between(s, 'export function initSearch(', 'function watchRoute(');
  assert.match(init, /\n\s*watchSearchBar\(\);/);
  const wb = between(s, 'function watchSearchBar(', 'function onDocScan(');
  assert.match(wb, /root\.querySelector\('\.topbar'\)/);
  assert.match(wb, /if \(h > 0\) document\.documentElement\.style\.setProperty\('--search-bar-h', h \+ 'px'\);/, '숨은 동안(0)은 값을 두고');
  assert.match(wb, /new ResizeObserver\(apply\)\.observe\(bar\)/);
});

test('R6 ★ 탭 목록 이름(aria-label) · 찾기 탭 이름이 [찾기] 단추와 다르다 — 보이는 글자로 시작(이름 안의 라벨) · 네 언어(8g-4b-R1 Review)', () => {
  const html = read('../index.html');
  assert.match(html, /id="searchTabs" role="tablist" data-i18n-aria="search\.tabs\.label"/);
  assert.match(html, /id="searchTabFind"[^>]*data-i18n="search\.tab\.find" data-i18n-aria="search\.tab\.findLabel"/);
  assert.match(html, /id="searchGo" data-i18n="search\.tab\.find"/, '[찾기] 단추는 그대로');
  for (const l of LANGS) {
    const b = BUNDLES[l];
    for (const k of ['search.tabs.label', 'search.tab.findLabel']) assert.ok(typeof b[k] === 'string' && b[k].trim(), l + ' ' + k);
    assert.notEqual(b['search.tab.findLabel'], b['search.tab.find'], l + ' — 단추와 다른 이름');
    assert.ok(b['search.tab.findLabel'].startsWith(b['search.tab.find']), l + ' — 보이는 글자로 시작(음성 명령 "찾기 누르기")');
  }
  for (const k of ['search.tabs.label', 'search.tab.findLabel']) assert.notEqual(BUNDLES.ar[k], BUNDLES.en[k], 'ar 은 영어 복사가 아님 ' + k);
  for (const l of ['ar', 'fr']) {
    const src = read('../js/i18n/' + l + '.js');
    const at = src.indexOf("'search.tabs.label'");
    assert.match(src.slice(Math.max(0, at - 200), at), /\[검토 — Nour·운영자\]/, l + ' 새 문안 검토 표시');
  }
});
