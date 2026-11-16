/* ============================================================
   tests/backup-9c.test.mjs — 9c-1 백업 내보내기 (spec 17-4-1 · "9c-1 수용 기준" + 순수 함수의 "9c-2 수용 기준" [N])

   K1  docForBackup — 사용자 몫 필드만(extraction·sectionIndex*·모르는 필드 없음)
   K2  ★ 설정 허용 목록 — DEFAULTS 의 **모든 키**가 담음/안 담음 중 **하나에만** · 동의·키 기억·목소리·인식 태그·dev 없음
   K3  줄 꼴 — 머리 → rec → 끝, 줄마다 JSON.parse, 날 줄바꿈 없음, 스토어 순서 고정, 파생·PDF 없음, 머리 counts = 끝 counts
   K4  ★ 키 0건 — 가짜 키를 가짜 세션/로컬 저장소·설정 값·필기·제목·캐시에 심고 내보낸 글자(gzip 풀어서)에 0 · REDACT_PATTERNS 0
   K4b 지우개는 키 꼴에만(9c-1b) — 하이픈 합성어·"Bearer of"·sk-learn·task-sk-… 그대로 · search.recent 행 남음 · 같은 기기 왕복 keep
       (9c-1c — %XX·글자 그대로 이스케이프 뒤 sk-·숫자 없는 20자+ Bearer 토큰·bearer/BEARER/%20/: 도 지움)
   K5  ★ 정적 — backup/*·text/backup.js 의 import 에 privacy/·ai/·ui/ 0, 웹 저장소 낱말 0
   K6  캐시 끄기 → aiCache 줄 0 · 머리 include.cache false
   K7  lineSplitter — 줄 가운데·UTF-8 다바이트 가운데(디코더 몫)·\r\n 경계, 마지막 줄 줄바꿈 없음, 아무 조각내기 = 같은 줄
   K8  readHead·parseLine — 판 2 거절(newer) · 다른 앱 · 반쪽 줄
   K9  remapRecord — aiCache 키 셋째 칸만(해시·w= 그대로) · 접두 {docId}: · 다른 문서 무변(같은 객체)
   K10 mergeRecord 표 — 스토어마다 있음/없음·새/옛 (+ crossstep: cards max(updatedAt, reviewedAt) · term id 다음 term+targetLang ·
       importPlan 충돌 → 기기 값 · usage capWarned OR · progress @read 구간 합집합)
   K11 ★ 멱등 — 같은 파일 두 번 = 한 번(전 스토어 깊은 비교, 이 파일 안 작은 적용기)
   K12 화면 순수 — lastLine(오늘·n일·30일 넘음)·backupFileName · pdfList/pdfBlob(blob 있는 책만)
   K13 화면 배선(소스) — 카드가 AI 카드 위 · data-ba · aria-live · innerHTML 0 · 서재 [백업] · settings init/show/leave
   K14 i18n — 새 키 4언어 · 쓰는 키가 있다
   지어낸 글자만. 실제 키·실제 호출 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => Array.from(m.keys())[i] || null, get length() { return m.size; } };
}
// 가짜 웹 저장소(키를 심는 곳). 이름은 문자열로 만든다 — 이 시험 파일도 정적 grep 대상 밖이지만 앱 쪽과 같은 습관.
const SS = 'session' + 'Storage';
const LS = 'local' + 'Storage';
globalThis[SS] = globalThis[SS] || memStorage();
globalThis[LS] = globalThis[LS] || memStorage();

const db = await import('../js/db.js');
const B = await import('../js/text/backup.js');
const { exportBackup, pdfList, pdfBlob, cacheSize } = await import('../js/backup/export.js');
const { BACKUP, REDACT_PATTERNS, KEY_SHAPES } = await import('../js/config.js');
const { DEFAULTS } = await import('../js/settings.js');
const { BUNDLES, LANGS } = await import('../js/i18n/index.js');
const UI = await import('../js/ui/backup.js');

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const ALL_STORES = db.STORE_NAMES;
async function reset() {
  for (const s of ALL_STORES) await db.clearStore(s);
}
async function textOf(r) {
  if (r.gz) return gunzipSync(Buffer.from(await r.blob.arrayBuffer())).toString('utf8');
  return r.blob.text();
}
function linesOf(text) {
  assert.ok(text.endsWith('\n'), '마지막 줄도 줄바꿈으로 끝난다');
  return text.slice(0, -1).split('\n');
}

const T0 = new Date(2026, 10, 17, 9, 30, 0).getTime();

/** 지어낸 서재 하나 — 스토어마다 몇 개씩. */
async function seedLibrary() {
  await db.put('documents', {
    id: 'docA', title: 'Book A', fileName: 'a.pdf', size: 1234, pageCount: 40, fileHash: 's256:p:1:aaa', addedAt: T0, lastOpenedAt: T0,
    lastPage: 3, lastLineId: '3:7', lang: 'en', langSource: 'auto', langGuess: 'en', domain: 'medical', readStats: { pages: 3, chars: 9000 },
    outline: [{ t: 'Ch 1', p: 1, d: 0 }], outlineV: 1, pageLabels: null, scan: { v: 1, verdict: 'text' }, columnsHint: null,
    extraction: { done: true, pagesDone: 40, cursor: 41, failed: [], algoVersion: 12 }, sectionIndex: [{ id: 'I' }],
    sectionIndexDone: true, sectionIndexVersion: 3, someFutureField: 'x'
  });
  await db.put('documents', { id: 'docB', title: 'Book B', fileName: 'b.pdf', size: 99, pageCount: 2, fileHash: 'fnv:p:1:bbb', addedAt: T0,
    lastOpenedAt: T0, lastPage: 1, lastLineId: null, lang: 'fr', langSource: 'user', langGuess: null,
    extraction: { done: false, pagesDone: 1, cursor: 2, failed: [], algoVersion: 12 } });
  await db.put('blobs', { docId: 'docA', blob: new Blob([new Uint8Array(32)]) });
  await db.put('pages', { docId: 'docA', pageNo: 1, algoVersion: 12, lines: ['p'] });
  await db.put('searchText', { docId: 'docA', pageNo: 1, sk: '1|x', algoVersion: 12, text: 'p', table: '', heads: [] });
  await db.put('sections', { docId: 'docA', sectionId: 'I' });
  await db.put('questions', { id: 'docA:I:q1', docId: 'docA', sectionId: 'I', source: 'book', stem: 's' });
  await db.put('questions', { id: 'docA:I:ai1', docId: 'docA', sectionId: 'I', source: 'ai', stem: 'ai stem' });
  await db.put('attempts', { id: 'att1', docId: 'docA', sectionId: 'I', items: [{ questionId: 'docA:I:q1', chosen: 'A', correct: false }], at: T0 });
  await db.put('mistakes', { id: 'mis1', questionId: 'docA:I:q1', attemptId: 'att1', docId: 'docA', resolvedAt: null });
  await db.put('progress', { docId: 'docA', sectionId: '@read', ranges: [[1, 3]], pages: 3, updatedAt: T0 });
  await db.put('cards', { id: 'vt:s256:t1', kind: 'term', term: 'dyspnea', surface: 'Dyspnea', srcLang: 'en', targetLang: 'ar',
    translation: 'ضيق النفس', context: 'Line one\nline two', docId: 'docA', docTitle: 'Book A', createdAt: T0, updatedAt: T0,
    sm2: { ease: 2.5, interval: 0, reps: 0, lapses: 0 }, dueAt: T0, reviewedAt: null, introducedAt: null, suspended: false, edited: false });
  await db.put('annotations', { id: 'an1', docId: 'docA', pageNo: 2, kind: 'note', text: 'my "note"\twith tab', updatedAt: T0 });
  await db.put('usage', { day: '2026-11-17', calls: 4, byKind: { translate: 0, readalong: 4 }, byProvider: { gemini: 4 }, tokensIn: 10, tokensOut: 20 });
  await db.put('settings', { key: 'ui.lang', value: 'ar' });
  await db.put('settings', { key: 'reader.fontSize', value: 24 });
  await db.put('settings', { key: 'privacy.consentedAt', value: '2026-11-01T00:00:00Z' });
  await db.put('settings', { key: 'tts.voice.ar', value: 'voice-uri-1' });
  await db.put('settings', { key: 'backup.lastExportAt', value: T0 });
  for (let i = 0; i < 3; i++) {
    await db.put('aiCache', { key: 'translate|ar|docA|s256:' + 'ab'.repeat(16) + i, docId: 'docA', kind: 'translate', targetLang: 'ar',
      result: 'ترجمة ' + i, createdAt: T0 + i, hits: i, sizeBytes: 100 });
  }
}

/* ══ K1 docForBackup ═════════════════════════════════════ */
test('K1 docForBackup — 사용자 몫만, 파생·모르는 필드 없음, 없는 필드는 만들지 않는다', () => {
  const full = { id: 'x', title: 't', extraction: { done: true }, sectionIndex: [1], sectionIndexDone: true, sectionIndexVersion: 2,
    lastPage: 9, outline: [], outlineV: 1, unknownThing: 1, scan: { v: 1 } };
  const d = B.docForBackup(full);
  assert.deepEqual(Object.keys(d).sort(), ['id', 'lastPage', 'outline', 'outlineV', 'scan', 'title']);
  for (const k of Object.keys(d)) assert.ok(BACKUP.DOC_FIELDS.includes(k), k);
  assert.equal(d.extraction, undefined);
  assert.equal(B.docForBackup(null), null);
  assert.equal(B.docForBackup({ title: 'no id' }), null);
  // 원본을 고치지 않는다
  assert.ok(full.extraction && full.unknownThing === 1);
  for (const bad of ['extraction', 'sectionIndex', 'sectionIndexDone', 'sectionIndexVersion']) assert.ok(!BACKUP.DOC_FIELDS.includes(bad), bad);
});

/* ══ K2 설정 허용 목록 ════════════════════════════════════ */
test('K2 ★ 설정 — DEFAULTS 의 모든 키가 담음/안 담음 둘 중 하나에만 · 목록에 DEFAULTS 밖 이름 없음', () => {
  const inc = new Set(BACKUP.SETTINGS_KEYS);
  const exc = new Set(BACKUP.SETTINGS_SKIP);
  const keys = Object.keys(DEFAULTS);
  const missing = keys.filter((k) => !inc.has(k) && !exc.has(k));
  const both = keys.filter((k) => inc.has(k) && exc.has(k));
  assert.deepEqual(missing, [], '목록에 없는 새 설정 키: ' + missing.join(', '));
  assert.deepEqual(both, [], '두 목록에 다 있음: ' + both.join(', '));
  const stray = [...inc, ...exc].filter((k) => !Object.prototype.hasOwnProperty.call(DEFAULTS, k));
  assert.deepEqual(stray, [], 'DEFAULTS 에 없는 이름: ' + stray.join(', '));
  assert.equal(inc.size, BACKUP.SETTINGS_KEYS.length, '담음 목록 겹침 없음');
  assert.equal(exc.size, BACKUP.SETTINGS_SKIP.length, '안 담음 목록 겹침 없음');
});

test('K2b 설정 — 동의·키 기억·목소리·억양·인식 태그·마이크 고지·온보딩·dev·프록시·backup.* 없음 · reader.* 전부 · 18 links 담음', () => {
  for (const k of ['privacy.consentedAt', 'privacy.rememberKey', 'voice.tag', 'voice.noticeAt', 'dev.debug', 'onboarding.done', 'ai.proxyUrl', 'backup.lastExportAt']) {
    assert.ok(!B.settingAllowed(k), k);
  }
  for (const k of Object.keys(DEFAULTS)) {
    if (/^tts\.(voice|accent)\./.test(k)) assert.ok(!B.settingAllowed(k), k);
    if (/^(reader|readalong)\./.test(k)) assert.ok(B.settingAllowed(k), k);
  }
  for (const k of ['links.medical', 'vocab.lastExportAt', 'ai.dailyCap', 'ai.cacheLimitMB', 'search.recent', 'ui.lang', 'privacy.piiCheck']) assert.ok(B.settingAllowed(k), k);
  assert.equal(DEFAULTS['backup.lastExportAt'], null);
  const rows = Object.keys(DEFAULTS).map((k) => ({ key: k, value: DEFAULTS[k] === null ? 'v' : DEFAULTS[k] }));
  rows.push({ key: 'medreader.key.gemini', value: 'x' }, { key: 'unknown.thing', value: 1 });
  const out = B.settingsForBackup(rows).map((r) => r.key).sort();
  assert.deepEqual(out, BACKUP.SETTINGS_KEYS.slice().sort());
  // 키 모양 값은 허용 키라도 뺀다
  const fake = 'AIza' + 'Q'.repeat(35);
  assert.deepEqual(B.settingsForBackup([{ key: 'ai.model', value: fake }, { key: 'ai.model', value: 'gemini-3.5-flash-lite' }]),
    [{ key: 'ai.model', value: 'gemini-3.5-flash-lite' }]);
});

/* ══ K3 줄 꼴 ════════════════════════════════════════════ */
test('K3 ★ 줄 꼴 — 머리 → rec → 끝 · 줄마다 JSON · 날 줄바꿈 없음 · 순서 고정 · 파생·PDF 없음 · counts', async () => {
  await reset();
  await seedLibrary();
  const r = await exportBackup({ gzip: false, now: T0 });
  assert.equal(r.gz, false);
  assert.match(r.name, /^medreader-backup-20261117-0930\.jsonl$/);
  const text = await textOf(r);
  assert.ok(!text.includes('\r'), 'CR 없음');
  const ls = linesOf(text);
  assert.equal(ls.length, r.lines);
  const objs = ls.map((l) => JSON.parse(l));
  assert.equal(objs[0].t, 'head');
  assert.equal(objs[objs.length - 1].t, 'end');
  for (let i = 1; i < objs.length - 1; i++) assert.equal(objs[i].t, 'rec', '가운데는 rec 줄 ' + i);
  const head = objs[0];
  assert.equal(head.format, 1);
  assert.equal(head.app, 'medreader');
  assert.equal(head.db, db.DB_VERSION);
  assert.ok(Number.isInteger(head.algo) && head.algo > 0);
  assert.ok(['s256', 'fnv'].includes(head.hash));
  assert.deepEqual(head.include, { cache: true, settings: true });
  assert.equal(head.createdAt, new Date(T0).toISOString());
  assert.deepEqual(head.docs.map((d) => d.id).sort(), ['docA', 'docB']);
  // 스토어 순서 — BACKUP.STORES 의 번호가 줄어들지 않는다
  const order = objs.slice(1, -1).map((o) => BACKUP.STORES.indexOf(o.s));
  assert.ok(order.every((x) => x >= 0), '모르는 스토어 없음');
  for (let i = 1; i < order.length; i++) assert.ok(order[i] >= order[i - 1], '순서 ' + i);
  const by = {};
  for (const o of objs.slice(1, -1)) (by[o.s] = by[o.s] || []).push(o.v);
  for (const s of ['blobs', 'pages', 'searchText', 'sections']) assert.equal(by[s], undefined, s + ' 는 담지 않는다');
  assert.deepEqual(by.questions.map((q) => q.id), ['docA:I:ai1'], '원서 문항(book)은 빼고 AI 문항만');
  for (const d of by.documents) {
    for (const k of Object.keys(d)) assert.ok(BACKUP.DOC_FIELDS.includes(k), 'documents 필드 ' + k);
  }
  assert.deepEqual(by.settings.map((s) => s.key).sort(), ['reader.fontSize', 'ui.lang']);
  // 값 속 줄바꿈·탭·따옴표는 이스케이프된 채 그대로 돌아온다
  assert.equal(by.cards[0].context, 'Line one\nline two');
  assert.equal(by.annotations[0].text, 'my "note"\twith tab');
  // 머리 counts = 끝 counts = 실제 줄 수
  const end = objs[objs.length - 1];
  for (const s of BACKUP.STORES) {
    assert.equal(head.counts[s], (by[s] || []).length, 'head ' + s);
    assert.equal(end.counts[s], (by[s] || []).length, 'end ' + s);
  }
  assert.equal(by.aiCache.length, 3);
});

test('K3b 묶음 경계 — BATCH 넘는 스토어도 빠짐·겹침 없이 키 순서로', async () => {
  await reset();
  const n = BACKUP.BATCH * 2 + 7;
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ key: 'translate|ar|d|fnv:' + String(i).padStart(6, '0'), docId: 'd', result: 'r' + i, sizeBytes: 1 });
  await db.putAll('aiCache', rows);
  const seen = [];
  const r = await exportBackup({ gzip: false, onProgress: (p) => seen.push(p) });
  const objs = linesOf(await textOf(r)).map((l) => JSON.parse(l)).filter((o) => o.s === 'aiCache');
  assert.equal(objs.length, n);
  assert.equal(new Set(objs.map((o) => o.v.key)).size, n, '겹침 없음');
  const keys = objs.map((o) => o.v.key);
  assert.deepEqual(keys, keys.slice().sort(), '키 순서');
  const cacheSteps = seen.filter((p) => p.store === 'aiCache' && p.done > 0);
  assert.equal(cacheSteps.length, 3, '묶음 셋(1000·1000·7)');
  assert.equal(cacheSteps[cacheSteps.length - 1].done, n);
  assert.ok(seen.every((p) => typeof p.total === 'number'));
});

/* ══ K4 키 0건 ═══════════════════════════════════════════ */
test('K4 ★ 키 0건 — 저장소·설정·필기·제목·캐시에 가짜 키를 심어도 내보낸 글자(gzip 풀어서)에 0 · REDACT_PATTERNS 0', async () => {
  await reset();
  await seedLibrary();
  const AQ = 'AQ.' + 'Ab_FAKE_not_a_real_key_9c1_xyz';
  const AIZA = 'AIza' + 'SyFAKEFAKEFAKEFAKEFAKEFAKEFAKE12345';
  const SK = 'sk-' + 'fakefakefakefake1234';
  const BEARER = 'Bearer ' + 'fake.token.9c1';
  for (const k of [AQ, AIZA, SK]) {
    for (const s of [SS, LS]) {
      globalThis[s].setItem('medreader.key.gemini', k);
      globalThis[s].setItem('medreader.key.openai', k);
    }
  }
  // 설정 — 허용 키(ai.model)·허용 밖(ai.proxyUrl·privacy.rememberKey)·모르는 키에
  await db.put('settings', { key: 'ai.model', value: AQ });
  await db.put('settings', { key: 'ai.proxyUrl', value: 'https://x.example/?k=' + AIZA });
  await db.put('settings', { key: 'privacy.rememberKey', value: SK });
  await db.put('settings', { key: 'medreader.key.gemini', value: AQ });
  await db.put('settings', { key: 'links.medical', value: [{ id: 'a', name: 'n ' + AIZA, url: 'https://e.example/?q={q}&key=' + AQ }] });
  // 사용자 글자·제목·캐시 결과에
  await db.patch('documents', 'docA', { title: 'Book ' + SK });
  await db.patch('cards', 'vt:s256:t1', { note: 'pasted ' + AQ + ' by mistake' });
  await db.put('annotations', { id: 'an2', docId: 'docA', pageNo: 1, text: BEARER + ' and ' + AIZA, updatedAt: T0 });
  await db.put('aiCache', { key: 'translate|ar|docA|s256:zz', docId: 'docA', kind: 'translate', result: { t: 'x ' + AQ }, sizeBytes: 1 });

  for (const gzip of [true, false]) {
    const r = await exportBackup({ gzip: gzip });
    if (gzip) assert.equal(r.gz, typeof CompressionStream === 'function');
    const text = await textOf(r);
    for (const k of [AQ, AIZA, SK, BEARER, 'fake.token.9c1']) assert.ok(!text.includes(k), 'gzip=' + gzip + ' 에 키: ' + k.slice(0, 6));
    for (const p of REDACT_PATTERNS) assert.ok(!new RegExp(p).test(text), 'REDACT 일치: ' + p);
    for (const p of Object.values(KEY_SHAPES)) assert.ok(!new RegExp(p).test(text), '키 모양: ' + p);
    assert.ok(!text.includes('medreader.key.'), '키 저장소 이름도 없다');
    // 지운 자리는 [KEY] 로 — 나머지 글자는 그대로
    assert.ok(text.includes('pasted [KEY] by mistake'));
    const ls = linesOf(text).map((l) => JSON.parse(l));
    const set = ls.filter((o) => o.s === 'settings').map((o) => o.v.key);
    assert.ok(!set.includes('ai.model'), '키 모양 값의 허용 키는 행째 빠진다');
    assert.ok(!set.includes('links.medical'), '주소에 키 모양이 든 목록도 행째 빠진다');
    assert.ok(set.includes('ui.lang') && set.includes('reader.fontSize'), '다른 허용 키는 그대로');
  }
});

test('K4b 지우개는 키 꼴에만(9c-1b — 9c1R #1) — 합성어·"Bearer of"·sk-learn·task-sk-… 정상 글은 그대로 · 가짜 키 넷은 여전히 [KEY]', () => {
  // 지어낸 글자만
  const keep = (s) => assert.equal(B.scrubText(s), s, '그대로: ' + s);
  keep('low-risk-to-moderate-risk-group patients');
  keep('a risk-benefit-assessment-and-follow-up plan');
  keep('the Bearer of the results');
  keep('Bearer responsibilities apply');
  keep('pip install sk-learn');
  keep('see task-sk-1234567890abcdef in the log');
  keep('mask-1234567890abcdefghij');
  // 줄로 만들어 읽어도 그대로(단어 문맥·필기)
  const ctx = 'Patients at low-risk-to-moderate-risk; the Bearer of the news';
  assert.equal(B.parseLine(B.recLine('cards', { id: 'c', context: ctx })).v.context, ctx);
  // 가짜 키 넷 — 문장 안·따옴표 옆·줄 끝에서 여전히 지운다
  const AQ = 'AQ.' + 'Ab_FAKE_not_a_real_key_9c1_xyz';
  const AIZA = 'AIza' + 'SyFAKEFAKEFAKEFAKEFAKEFAKEFAKE12345';
  const SK = 'sk-' + 'fakefakefakefake1234';
  const SKP = 'sk-proj-' + 'FAKE_fake-0123456789abcdefFAKE';
  const BEARER = 'Bearer ' + 'fake.token.9c1';
  for (const k of [AQ, AIZA, SK, SKP]) {
    assert.equal(B.scrubText('x ' + k + ' y'), 'x [KEY] y', k.slice(0, 6));
    assert.equal(B.scrubText('"' + k + '"'), '"[KEY]"', k.slice(0, 6));
    assert.equal(B.scrubText('key=' + k), 'key=[KEY]', k.slice(0, 6));
  }
  assert.equal(B.scrubText(BEARER + ' and more'), '[KEY] and more');
  assert.equal(B.scrubText('Authorization: Bearer\t' + 'eyJhbGciOi.FAKE.sig0123'), 'Authorization: [KEY]');
  // 9c-1c(9c1bR #1) — URL 인코딩 %XX·글자 그대로 적힌 이스케이프 바로 뒤의 sk- 도 지운다
  assert.equal(B.scrubText('https://e.example/?q=a%20' + SKP), 'https://e.example/?q=a%20[KEY]');
  assert.equal(B.scrubText('{"k":"x\\n' + SKP + '"}'), '{"k":"x\\n[KEY]"}');
  assert.equal(B.scrubText('\\u0022' + SKP + '\\u0022'), '\\u0022[KEY]\\u0022');
  assert.deepEqual(B.settingsForBackup([{ key: 'search.recent', value: ['dyspnea', 'x\n' + SKP] }]), [], '항목 안 줄바꿈 뒤 키도 행째(9c1bR #3)');
  // 9c-1c(9c1bR #2) — Bearer 뒤 숫자 없는 긴 토큰(20자 이상)도 지운다
  assert.equal(B.scrubText('Bearer ' + 'FAKEfakeFAKEfakeFAKEfakeFAKEfake' + ' y'), '[KEY] y');
  // 9c-1c(9c1bR #4) — 대소문자 무시·%20·: 뒤 토큰. 낱말 bearer 는 그대로
  for (const pre of ['bearer ', 'BEARER ', 'Bearer%20', 'Bearer:']) assert.equal(B.scrubText(pre + 'fake.token.9c1c'), '[KEY]', pre);
  keep('bearer bonds and other instruments');
  keep('BEARER of the mutation');
  keep('the stretcher-bearer-team-of-four');
  // search.recent — 정상 검색어 목록은 행째 남고, 키가 하나 끼면 행째 빠진다
  const recent = ['low-risk-to-moderate-risk', 'Bearer of', 'sk-learn', 'dyspnea'];
  assert.deepEqual(B.settingsForBackup([{ key: 'search.recent', value: recent }]), [{ key: 'search.recent', value: recent }]);
  assert.deepEqual(B.settingsForBackup([{ key: 'search.recent', value: recent.concat([SK]) }]), []);
  // 같은 기기 왕복 — 자기 백업 줄을 그대로 가져와도 term 문맥이 바뀌지 않는다(review 9c1R-3 표본)
  const mine = term({ context: 'Patients at low-risk-to-moderate-risk' });
  const back = B.parseLine(B.recLine('cards', mine)).v;
  assert.deepEqual(B.mergeRecord('cards', mine, back, { nowMs: T0 }), { op: 'keep' });
  // 백업 패턴은 로그용 REDACT_PATTERNS 와 따로 — 로그 지우개는 넓은 그대로
  assert.ok(REDACT_PATTERNS.includes('Bearer\\s+\\S+') && REDACT_PATTERNS.includes('sk-[A-Za-z0-9_\\-]{16,}'));
  for (const s of Object.values(KEY_SHAPES)) assert.ok(BACKUP.KEY_PATTERNS.includes(s), 'Google 꼴은 그대로');
});

/* ══ K5 정적 ═════════════════════════════════════════════ */
test('K5 ★ 정적 — backup/*·text/backup.js 는 privacy/·ai/·ui/ 를 import 하지 않고 웹 저장소 낱말이 없다', () => {
  const dir = new URL('../js/backup/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => '../js/backup/' + f);
  files.push('../js/text/backup.js');
  assert.ok(files.length >= 2);
  for (const f of files) {
    const s = src(f);
    const specs = [...s.matchAll(/\bimport\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g), ...s.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
    assert.ok(specs.length > 0, f);
    for (const sp of specs) {
      assert.ok(!/(^|\/)(privacy|ai|ui)\//.test(sp), f + ' → ' + sp);
      assert.ok(!/keys\.js|redact\.js/.test(sp), f + ' → ' + sp);
    }
    assert.ok(!/localStorage|sessionStorage/.test(s), f + ' 에 웹 저장소 낱말');
    assert.ok(!/innerHTML/.test(s), f + ' innerHTML');
  }
  // 서비스는 config·db·hash·text/* 만
  for (const sp of [...src('../js/backup/export.js').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])) {
    assert.ok(/^\.\.\/(config|db|hash)\.js$|^\.\.\/text\/[a-z]+\.js$/.test(sp), 'export.js import ' + sp);
  }
  for (const sp of [...src('../js/text/backup.js').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])) {
    assert.ok(/^\.\.\/config\.js$|^\.\/[a-z]+\.js$/.test(sp), 'text/backup.js import ' + sp);
  }
});

/* ══ K6 캐시 끄기 ════════════════════════════════════════ */
test('K6 캐시 끄기 → aiCache 줄 0 · include.cache false · 끝 counts 에도 없음', async () => {
  await reset();
  await seedLibrary();
  const r = await exportBackup({ gzip: false, includeCache: false });
  const objs = linesOf(await textOf(r)).map((l) => JSON.parse(l));
  assert.equal(objs.filter((o) => o.s === 'aiCache').length, 0);
  assert.equal(objs[0].include.cache, false);
  assert.equal(objs[0].counts.aiCache, undefined);
  assert.equal(objs[objs.length - 1].counts.aiCache, undefined);
  assert.ok(objs.filter((o) => o.s === 'cards').length === 1, '나머지는 그대로');
});

/* ══ K7 lineSplitter ═════════════════════════════════════ */
test('K7 lineSplitter — 조각 경계가 줄 가운데·\\r\\n 사이·UTF-8 다바이트 가운데(디코더)여도 같은 줄, 끝 줄바꿈 없어도 나온다', () => {
  const lines = ['{"a":"ضيق النفس"}', '{"b":"한글 낱말 😀"}', '{"c":"plain"}', '{"d":"é"}'];
  const crlf = lines.join('\r\n');           // 끝 줄바꿈 없음
  const bytes = new TextEncoder().encode(crlf);
  // 모든 바이트 위치에서 두 조각으로 — 디코더(stream:true)가 다바이트 글자를 잇는다
  for (let cut = 0; cut <= bytes.length; cut++) {
    const dec = new TextDecoder('utf-8');
    const sp = B.lineSplitter();
    const got = [];
    got.push(...sp.push(dec.decode(bytes.subarray(0, cut), { stream: true })));
    got.push(...sp.push(dec.decode(bytes.subarray(cut), { stream: true })));
    got.push(...sp.push(dec.decode()));
    got.push(...sp.end());
    assert.deepEqual(got, lines, 'cut ' + cut);
  }
  // 한 글자씩
  const sp = B.lineSplitter();
  const got = [];
  for (const ch of lines.join('\n') + '\n\n\n') got.push(...sp.push(ch));
  got.push(...sp.end());
  assert.deepEqual(got, lines, '빈 줄은 내지 않는다');
  assert.deepEqual(B.lineSplitter().end(), []);
});

test('K7b lineSplitter — 실제 내보낸 파일을 아무렇게나 잘라도 같은 줄', async () => {
  await reset();
  await seedLibrary();
  const text = await textOf(await exportBackup({ gzip: false }));
  const want = linesOf(text);
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let round = 0; round < 20; round++) {
    const sp = B.lineSplitter();
    const got = [];
    let i = 0;
    while (i < text.length) { const n = 1 + Math.floor(rnd() * 300); got.push(...sp.push(text.slice(i, i + n))); i += n; }
    got.push(...sp.end());
    assert.deepEqual(got, want, 'round ' + round);
  }
});

/* ══ K8 readHead·parseLine ═══════════════════════════════ */
test('K8 readHead — 지금 판 ok · 판 2 → newer · 다른 앱·JSON 아님 → not-backup · parseLine 반쪽 줄 → bad', () => {
  const h = B.headLine({ createdAt: 'x', db: 3, algo: 12, hash: 's256', counts: { documents: 1 }, docs: [] });
  const ok = B.readHead(h);
  assert.equal(ok.ok, true);
  assert.equal(ok.head.counts.documents, 1);
  const newer = B.readHead(JSON.stringify(Object.assign(JSON.parse(h), { format: 2 })));
  assert.deepEqual([newer.ok, newer.code], [false, 'newer']);
  assert.equal(B.readHead(JSON.stringify(Object.assign(JSON.parse(h), { app: 'other' }))).code, 'not-backup');
  assert.equal(B.readHead('not json').code, 'not-backup');
  assert.equal(B.readHead(B.recLine('documents', { id: 1 })).code, 'not-backup');
  assert.equal(B.readHead(JSON.stringify(Object.assign(JSON.parse(h), { format: 0 }))).code, 'not-backup');
  const full = B.recLine('cards', { id: 'c1', note: 'a\nb' });
  assert.equal(full.indexOf('\n'), -1, '날 줄바꿈 없음');
  assert.deepEqual(B.parseLine(full), { kind: 'rec', store: 'cards', v: { id: 'c1', note: 'a\nb' } });
  assert.deepEqual(B.parseLine(full.slice(0, 20)), { kind: 'bad' });
  assert.deepEqual(B.parseLine(B.endLine({ cards: 1 })), { kind: 'end', counts: { cards: 1 } });
  assert.equal(B.parseLine('{"t":"rec","s":"x"}').kind, 'bad');
});

/* ══ K9 remapRecord ══════════════════════════════════════ */
test('K9 remapRecord — 캐시 키 셋째 칸만 · 접두 {docId}: 만 · 다른 문서 레코드는 같은 객체', () => {
  const m = { old: 'NEW' };
  const k = 'term|ar|old|s256:' + 'f'.repeat(64) + '|w=old:thing';
  const c = B.remapRecord('aiCache', { key: k, docId: 'old', result: 'r' }, m);
  assert.equal(c.key, 'term|ar|NEW|s256:' + 'f'.repeat(64) + '|w=old:thing', '해시·extra(w=…) 그대로');
  assert.equal(c.docId, 'NEW');
  const fnvKey = 'translate|ar|old|fnv:0123456789abcdef:42';
  assert.equal(B.remapRecord('aiCache', { key: fnvKey, docId: 'old' }, m).key, 'translate|ar|NEW|fnv:0123456789abcdef:42');
  assert.deepEqual(B.remapRecord('progress', { docId: 'old', sectionId: '@read', ranges: [[1, 2]] }, m), { docId: 'NEW', sectionId: '@read', ranges: [[1, 2]] });
  assert.deepEqual(B.remapRecord('questions', { id: 'old:I:q1', docId: 'old', source: 'ai' }, m), { id: 'NEW:I:q1', docId: 'NEW', source: 'ai' });
  const at = B.remapRecord('attempts', { id: 'u1', docId: 'old', items: [{ questionId: 'old:I:q1' }, { questionId: 'other:I:q2' }] }, m);
  assert.deepEqual(at.items.map((x) => x.questionId), ['NEW:I:q1', 'other:I:q2']);
  assert.equal(at.id, 'u1', 'uuid id 는 그대로');
  assert.deepEqual(B.remapRecord('mistakes', { id: 'm1', questionId: 'old:I:q1', docId: 'old', attemptId: 'u1' }, m),
    { id: 'm1', questionId: 'NEW:I:q1', docId: 'NEW', attemptId: 'u1' });
  assert.equal(B.remapRecord('cards', { id: 'vt:x', docId: 'old' }, m).docId, 'NEW');
  assert.equal(B.remapRecord('cards', { id: 'vt:x', docId: 'old' }, m).id, 'vt:x');
  assert.equal(B.remapRecord('annotations', { id: 'a', docId: 'old' }, m).docId, 'NEW');
  assert.equal(B.remapRecord('documents', { id: 'old', title: 't' }, new Map([['old', 'NEW']])).id, 'NEW');
  // 다른 문서·비슷한 접두는 무변(같은 객체)
  for (const [s, r] of [['aiCache', { key: 'translate|ar|older|fnv:1:1', docId: 'older' }], ['questions', { id: 'older:I:q1', docId: 'older' }],
    ['mistakes', { questionId: 'oldX:I:q1', docId: 'x' }], ['cards', { docId: null }], ['usage', { day: 'old' }], ['settings', { key: 'old', value: 'old' }]]) {
    assert.equal(B.remapRecord(s, r, m), r, s);
  }
  const keep = { key: k, docId: 'old' };
  assert.equal(B.remapRecord('aiCache', keep, {}), keep, '빈 표');
  assert.equal(keep.key, k, '원본을 고치지 않는다');
});

/* ══ K10 mergeRecord 표 ══════════════════════════════════ */
const R = (store, mine, theirs, o) => B.mergeRecord(store, mine, theirs, Object.assign({ nowMs: T0 + 86400000 }, o || {}));

test('K10a 없음 → 추가 · documents 는 파생 처음 값으로 · 원서 문항·허용 밖 설정·키 모양 → 넣지 않음', () => {
  const reset = db.derivedDocReset();
  const a = R('documents', null, { id: 'd', title: 't', extraction: { done: true }, junk: 1 }, { docReset: reset });
  assert.equal(a.op, 'add');
  assert.deepEqual(a.value.extraction, reset.extraction);
  assert.equal(a.value.sectionIndexDone, false);
  assert.equal(a.value.junk, undefined);
  for (const s of ['usage', 'progress', 'attempts', 'mistakes', 'cards', 'annotations', 'aiCache']) assert.equal(R(s, null, { id: 1 }).op, 'add', s);
  assert.equal(R('questions', null, { id: 'q', source: 'ai' }).op, 'add');
  assert.deepEqual(R('questions', null, { id: 'q', source: 'book' }), { op: 'skip', reason: 'derived' });
  assert.deepEqual(R('settings', null, { key: 'privacy.consentedAt', value: 'x' }), { op: 'skip', reason: 'not-allowed' });
  assert.deepEqual(R('settings', null, { key: 'ai.model', value: 'AQ.' + 'x'.repeat(24) }), { op: 'skip', reason: 'key-shape' });
  assert.deepEqual(R('settings', null, { key: 'ui.lang', value: 'fr' }), { op: 'add', value: { key: 'ui.lang', value: 'fr' } });
  assert.deepEqual(R('blobs', null, { docId: 'd' }), { op: 'skip', reason: 'store' });
  assert.deepEqual(R('cards', null, null), { op: 'skip', reason: 'shape' });
});

test('K10b documents — 자리는 lastOpenedAt 늦은 쪽 · 사용자 언어 · domain/개요/라벨/scan 은 없을 때만 · readStats 큰 쪽 · extraction 무변', () => {
  const mine = { id: 'd', lastOpenedAt: 100, lastPage: 5, lastLineId: '5:1', lang: 'en', langSource: 'auto', langGuess: 'en',
    readStats: { pages: 4 }, outline: [], pageLabels: null, extraction: { done: true } };
  const theirs = { id: 'd', lastOpenedAt: 200, lastPage: 9, lastLineId: '9:3', lang: 'fr', langSource: 'user', langGuess: null,
    domain: 'general', readStats: { pages: 7 }, outline: [{ t: 'a' }], outlineV: 1, pageLabels: ['i'], scan: { v: 1 }, extraction: { done: false } };
  const r = R('documents', mine, theirs);
  assert.equal(r.op, 'patch');
  assert.deepEqual(r.patch, { lastPage: 9, lastLineId: '9:3', lastOpenedAt: 200, lang: 'fr', langSource: 'user', langGuess: null,
    domain: 'general', readStats: { pages: 7 }, outline: [{ t: 'a' }], outlineV: 1, pageLabels: ['i'], scan: { v: 1 } });
  // 옛 파일 — 기기 자리·사용자 언어·있는 값은 그대로
  const mine2 = Object.assign({}, theirs, { lastOpenedAt: 300, lastPage: 2, readStats: { pages: 10 } });
  const old = Object.assign({}, mine, { lastOpenedAt: 250, langSource: 'auto', domain: 'medical', outline: [{ t: 'z' }] });
  assert.deepEqual(R('documents', mine2, old), { op: 'keep' });
  // 기기가 사용자 언어면 파일 사용자 언어도 이기지 못한다
  assert.equal(R('documents', { id: 'd', lang: 'ko', langSource: 'user' }, { id: 'd', lang: 'fr', langSource: 'user' }).op, 'keep');
});

test('K10c usage — 같은 날 필드별 큰 값 · capWarned OR · 같은 값이면 keep', () => {
  const mine = { day: 'D', calls: 5, byKind: { translate: 1, readalong: 4 }, byProvider: { gemini: 5 }, tokensIn: 50, capWarned: true };
  const theirs = { day: 'D', calls: 3, byKind: { translate: 3, term: 2 }, byProvider: { gemini: 3, other: 1 }, tokensIn: 70, charsTranslated: 9 };
  const r = R('usage', mine, theirs);
  assert.equal(r.op, 'put');
  assert.deepEqual(r.value, { day: 'D', calls: 5, byKind: { translate: 3, readalong: 4, term: 2 }, byProvider: { gemini: 5, other: 1 },
    tokensIn: 70, capWarned: true, charsTranslated: 9 });
  assert.equal(R('usage', { day: 'D', calls: 1 }, { day: 'D', calls: 1, capWarned: true }).value.capWarned, true, 'OR — 파일만 참');
  assert.equal(R('usage', { day: 'D', calls: 1, capWarned: false }, { day: 'D', calls: 1, capWarned: true }).value.capWarned, true, 'OR — 기기 거짓·파일 참');
  assert.deepEqual(R('usage', { day: 'D', calls: 1, capWarned: true }, { day: 'D', calls: 1, capWarned: false }), { op: 'keep' }, 'OR — 기기 참·파일 거짓');
  assert.deepEqual(R('usage', r.value, theirs), { op: 'keep' }, '한 번 더 = 그대로');
  assert.deepEqual(R('usage', r.value, mine), { op: 'keep' });
});

test('K10d progress — updatedAt 늦은 쪽 · @read 는 구간 합집합(붙은 구간 하나로)', () => {
  assert.equal(R('progress', { docId: 'd', sectionId: 'I', updatedAt: 1 }, { docId: 'd', sectionId: 'I', updatedAt: 2 }).op, 'put');
  assert.equal(R('progress', { docId: 'd', sectionId: 'I', updatedAt: 3 }, { docId: 'd', sectionId: 'I', updatedAt: 2 }).op, 'keep');
  const r = R('progress', { docId: 'd', sectionId: '@read', ranges: [[3, 5], [10, 12]], pages: 6, updatedAt: 9 },
    { docId: 'd', sectionId: '@read', ranges: [[6, 6], [1, 1], [11, 20]], pages: 12, updatedAt: 4 });
  assert.equal(r.op, 'put');
  assert.deepEqual(r.value.ranges, [[1, 1], [3, 6], [10, 20]]);
  assert.equal(r.value.pages, 1 + 4 + 11);
  assert.equal(r.value.updatedAt, 9);
  assert.deepEqual(R('progress', r.value, { docId: 'd', sectionId: '@read', ranges: [[4, 5]], updatedAt: 1 }), { op: 'keep' });
  assert.deepEqual(B.unionRanges([[5, 3], ['x', 1], [7]], [[2, 2]]), [[2, 5]]);
});

test('K10e attempts·questions·aiCache 있으면 기기 것 · mistakes 는 resolvedAt 있는 쪽 · annotations updatedAt', () => {
  assert.deepEqual(R('attempts', { id: 'a', score: 1 }, { id: 'a', score: 9 }), { op: 'keep' });
  assert.deepEqual(R('questions', { id: 'q', source: 'ai' }, { id: 'q', source: 'ai', stem: 'new' }), { op: 'keep' });
  // aiCache — 기기 hits·createdAt 을 지킨다
  assert.deepEqual(R('aiCache', { key: 'k', hits: 7, createdAt: 1 }, { key: 'k', hits: 0, createdAt: 99, result: 'other' }), { op: 'keep' });
  assert.equal(R('mistakes', { id: 'm', resolvedAt: null }, { id: 'm', resolvedAt: 5 }).op, 'put');
  assert.equal(R('mistakes', { id: 'm', resolvedAt: 3 }, { id: 'm', resolvedAt: null }).op, 'keep');
  assert.equal(R('mistakes', { id: 'm', resolvedAt: 3 }, { id: 'm', resolvedAt: 9 }).op, 'keep');
  assert.equal(R('annotations', { id: 'n', updatedAt: 1 }, { id: 'n', updatedAt: 2 }).op, 'put');
  assert.equal(R('annotations', { id: 'n', updatedAt: 2 }, { id: 'n', updatedAt: 2 }).op, 'keep');
  // 요약(11)은 문서가 없어도 — 기기에 없으면 넣는다
  assert.equal(R('annotations', null, { id: 'sum1', kind: 'summary', docId: 'gone' }).op, 'add');
  assert.equal(R('settings', { key: 'ui.lang', value: 'ar' }, { key: 'ui.lang', value: 'ar' }).op, 'keep');
  assert.equal(R('settings', { key: 'ui.lang', value: 'ar' }, { key: 'ui.lang', value: 'fr' }).op, 'put');
  assert.equal(R('settings', { key: 'links.medical', value: [{ id: 'a' }] }, { key: 'links.medical', value: [{ id: 'a' }] }).op, 'keep', '깊은 같음');
});

function term(over) {
  return Object.assign({ id: 'vt:s256:1', kind: 'term', term: 'dyspnea', surface: 'Dyspnea', srcLang: 'en', targetLang: 'ar',
    translation: 'ضيق', pos: 'noun', gloss: '', lemma: '', context: 'c', contextTr: '', note: '', docId: 'd', docTitle: 'B', pageNo: 1,
    origin: 'user', edited: false, createdAt: 1000, updatedAt: 2000, sm2: { ease: 2.5, interval: 0, reps: 0, lapses: 0 }, dueAt: 1000,
    reviewedAt: null, introducedAt: null, suspended: false }, over || {});
}

test('K10f cards term — 8f importPlan 그대로: 내용이 다르면 updatedAt 늦은 쪽 · 옛 파일 keep · term+targetLang 으로도 맞춤', () => {
  const mine = term();
  const r = R('cards', mine, term({ translation: 'ضيق النفس', updatedAt: 3000, edited: true }));
  assert.equal(r.op, 'patch');
  assert.equal(r.patch.translation, 'ضيق النفس');
  assert.equal(r.patch.edited, true);
  assert.ok(r.patch.updatedAt >= 3000);
  assert.equal(r.patch.sm2, undefined, '복습 필드는 내용과 따로');
  assert.deepEqual(R('cards', mine, term({ translation: 'قديم', updatedAt: 1500 })), { op: 'keep' }, '기기가 더 늦게 고침');
  assert.deepEqual(R('cards', mine, term({ updatedAt: 9000 })), { op: 'keep' }, '내용이 같으면 시각만 늦어도 그대로');
  assert.deepEqual(R('cards', mine, term({ context: 'c [KEY]', translation: 'X' })), { op: 'keep' }, '9c-1b: 시각이 같으면 기기(CSV 와 달리 — 같은 기기 왕복)');
  // 다른 기기에서 새로 저장한 같은 낱말(id 가 다름 — fnv 꼴) → term+targetLang 으로 맞춰 내용만
  const other = term({ id: 'vt:fnv:abc:7', translation: 'زلة تنفسية', updatedAt: 5000, edited: false });
  const r2 = R('cards', mine, other);
  assert.equal(r2.op, 'patch');
  assert.equal(r2.patch.translation, 'زلة تنفسية');
  assert.equal(r2.patch.edited, false, 'AI 번역이 이기면 "고침" 표시를 붙이지 않는다(파일 값)');
  // 같은 id 인데 대상 언어가 다르면(손댄 파일) 기기 것
  assert.deepEqual(R('cards', mine, term({ targetLang: 'ko', translation: '호흡곤란', updatedAt: 9000 })), { op: 'keep' });
});

test('K10g cards term — importPlan 의 충돌(시각 못 읽음·미래)·거절은 기기 값 유지(백업은 고르기 없음)', () => {
  const mine = term();
  assert.deepEqual(R('cards', mine, term({ translation: 'X', updatedAt: null })), { op: 'keep' }, '시각 못 읽음 → 충돌 → 기기');
  assert.deepEqual(R('cards', mine, term({ translation: 'X', updatedAt: T0 + 10 * 86400000 })), { op: 'keep' }, '미래 시각 → 충돌 → 기기');
  assert.deepEqual(R('cards', mine, term({ surface: '', term: '', translation: 'X', updatedAt: 9000 })), { op: 'keep' }, '원어 빔 → 거절 → 기기');
});

test('K10h cards — 복습 필드는 reviewedAt 늦은 쪽 · 문장 카드는 max(updatedAt, reviewedAt) 늦은 쪽(같으면 기기)', () => {
  const mine = term({ reviewedAt: 100 });
  const r = R('cards', mine, term({ reviewedAt: 500, dueAt: 9999, sm2: { ease: 2.6, interval: 3, reps: 2, lapses: 0 }, introducedAt: 50 }));
  assert.deepEqual(r, { op: 'patch', patch: { sm2: { ease: 2.6, interval: 3, reps: 2, lapses: 0 }, dueAt: 9999, reviewedAt: 500, introducedAt: 50 } });
  assert.deepEqual(R('cards', term({ reviewedAt: 600 }), term({ reviewedAt: 500, dueAt: 1 })), { op: 'keep' });
  const sc = (o) => Object.assign({ id: 'sc:1', kind: 'sentence', front: 'f', back: 'b', updatedAt: 10, reviewedAt: null }, o);
  assert.equal(R('cards', sc(), sc({ back: 'new', updatedAt: 20 })).op, 'put');
  assert.equal(R('cards', sc({ reviewedAt: 30 }), sc({ back: 'new', updatedAt: 20 })).op, 'keep', '기기 복습이 더 늦다');
  assert.equal(R('cards', sc({ updatedAt: 20 }), sc({ back: 'new', updatedAt: 10, reviewedAt: 40 })).op, 'put', '파일 복습이 더 늦다');
  assert.equal(R('cards', sc({ updatedAt: 20 }), sc({ back: 'new', updatedAt: 20 })).op, 'keep', '같으면 기기');
});

/* ══ K11 멱등 ════════════════════════════════════════════ */
/** 이 시험 안의 작은 적용기 — 스토어 맵에 mergeRecord 결과를 그대로 적용(9c-2 가 DB 로 할 일의 순수 모형). */
function keyOfRec(store, v) {
  const s = db.SCHEMA_V1.find((x) => x.name === store);
  return JSON.stringify(Array.isArray(s.keyPath) ? s.keyPath.map((p) => v[p]) : v[s.keyPath]);
}
function applyFile(state, recs, nowMs) {
  for (const { s, v } of recs) {
    const m = state[s] || (state[s] = new Map());
    let mine = m.get(keyOfRec(s, v)) || null;
    if (!mine && s === 'cards' && v.kind === 'term') {
      for (const c of m.values()) if (c.kind === 'term' && c.term === v.term && c.targetLang === v.targetLang) { mine = c; break; }
    }
    const r = B.mergeRecord(s, mine, v, { nowMs: nowMs, docReset: db.derivedDocReset() });
    if (r.op === 'add') m.set(keyOfRec(s, r.value), structuredClone(r.value));
    else if (r.op === 'put') m.set(keyOfRec(s, r.value), structuredClone(r.value));
    else if (r.op === 'patch') m.set(keyOfRec(s, mine), Object.assign({}, mine, structuredClone(r.patch)));
  }
}
function snapshot(state) {
  const o = {};
  for (const s of Object.keys(state).sort()) o[s] = [...state[s].entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return JSON.stringify(o);
}

test('K11 ★ 멱등 — 같은 파일을 빈 기기·이미 있는 기기에 두 번 넣어도 한 번과 같다(전 스토어 깊은 비교)', async () => {
  await reset();
  await seedLibrary();
  await db.put('usage', { day: '2026-11-16', calls: 2, capWarned: true, byKind: { term: 2 }, byProvider: {} });
  await db.put('cards', { id: 'sc:9', kind: 'sentence', front: 'f', back: 'b', updatedAt: 5, reviewedAt: 7, docId: 'docA' });
  const recs = linesOf(await textOf(await exportBackup({ gzip: false }))).map((l) => JSON.parse(l)).filter((o) => o.t === 'rec');
  const N = T0 + 3600000;
  // 빈 기기
  const once = {};
  applyFile(once, recs, N);
  const a = snapshot(once);
  applyFile(once, recs, N);
  assert.equal(snapshot(once), a, '빈 기기: 두 번 = 한 번');
  assert.equal(once.documents.get('"docA"').extraction.done, false, '추출본 없음 → 처음 값');
  // 이미 다른 값이 있는 기기(옛 자리·적은 사용량·다른 번역)
  const busy = {};
  applyFile(busy, recs.map((r) => {
    const v = structuredClone(r.v);
    if (r.s === 'documents') { v.lastOpenedAt = 1; v.lastPage = 1; }
    if (r.s === 'usage') { v.calls = 1; delete v.capWarned; }
    if (r.s === 'cards' && v.kind === 'term') { v.translation = 'old'; v.updatedAt = 1; }
    return { s: r.s, v: v };
  }), N);
  applyFile(busy, recs, N);
  const b = snapshot(busy);
  applyFile(busy, recs, N);
  assert.equal(snapshot(busy), b, '있는 기기: 두 번 = 한 번');
  assert.equal(busy.documents.get('"docA"').lastPage, 3, '파일 자리가 늦다');
  assert.equal(busy.usage.get('"2026-11-16"').capWarned, true);
  assert.equal(busy.cards.get('"vt:s256:t1"').translation, 'ضيق النفس');
});

/* ══ K12 화면 순수 · PDF 목록 ════════════════════════════ */
test('K12 lastLine — 아직·오늘·n일 전(달력 날)·30일 넘으면 주의 · 파일 이름', () => {
  const now = new Date(2026, 10, 17, 8, 0).getTime();
  assert.deepEqual(UI.lastLine(null, now), { key: 'backup.never', stale: false });
  assert.deepEqual(UI.lastLine(new Date(2026, 10, 17, 0, 5).getTime(), now), { key: 'backup.last.today', stale: false });
  assert.deepEqual(UI.lastLine(new Date(2026, 10, 16, 23, 50).getTime(), now), { key: 'backup.last.days', params: { n: 1 }, stale: false });
  assert.deepEqual(UI.lastLine(new Date(2026, 9, 18, 12, 0).getTime(), now), { key: 'backup.last.days', params: { n: 30 }, stale: false });
  assert.deepEqual(UI.lastLine(new Date(2026, 9, 17, 12, 0).getTime(), now), { key: 'backup.last.days', params: { n: 31 }, stale: true });
  assert.deepEqual(UI.lastLine(new Date(2026, 10, 10).toISOString(), now).params, { n: 7 }, 'ISO 도 읽는다');
  assert.equal(B.backupFileName(new Date(2026, 0, 5, 7, 3).getTime(), true), 'medreader-backup-20260105-0703.jsonl.gz');
  assert.equal(B.backupFileName(new Date(2026, 0, 5, 7, 3).getTime(), false), 'medreader-backup-20260105-0703.jsonl');
  assert.equal(BACKUP.STALE_DAYS, 30);
  for (const s of BACKUP.STORES) assert.ok(UI.PART_OF[s], '진행 이름 ' + s);
});

test('K12b pdfList — blob 있는 책만(Blob 은 읽지 않음) · pdfBlob 이름 .pdf', async () => {
  await reset();
  await seedLibrary();
  const list = await pdfList();
  assert.deepEqual(list, [{ id: 'docA', title: 'Book A', fileName: 'a.pdf', size: 1234 }]);
  const got = await pdfBlob('docA');
  assert.equal(got.name, 'a.pdf');
  assert.equal(got.blob.size, 32);
  assert.equal(await pdfBlob('docB'), null);
  await db.patch('documents', 'docA', { fileName: '' });
  assert.equal((await pdfBlob('docA')).name, 'Book A.pdf');
  // 카드의 "약 n MB" — 8c-2 cache.stats() 와 같은 셈(sizeBytes 합)
  const { createCache } = await import('../js/ai/cache.js');
  const st = await createCache().stats();
  const mine = await cacheSize();
  assert.deepEqual([mine.count, mine.bytes], [st.count, st.bytes]);
  assert.equal(mine.bytes, 300);
});

/* ══ K13 화면 배선(소스) ═════════════════════════════════ */
test('K13 화면 — 카드가 AI 카드 위 · data-ba · 진행 aria-live · innerHTML 0 · 서재 [백업] · settings 배선', () => {
  const html = src('../index.html');
  const card = html.indexOf('id="settingsBackup"');
  assert.ok(card > 0 && card < html.indexOf('id="settingsAi"'), 'AI 카드 위');
  assert.ok(card > html.indexOf('id="aiConsentCard"'));
  const block = html.slice(card, html.indexOf('id="settingsAi"'));
  assert.match(block, /data-ba="export"/);
  assert.match(block, /id="backupProgressText"[^>]*aria-live="polite"/);
  assert.match(block, /role="progressbar"/);
  assert.match(block, /id="backupMsg"[^>]*aria-live="polite"/);
  assert.match(block, /<input type="checkbox" id="backupCache" checked>/, '저장된 번역 기본 켬(9c-Q2)');
  assert.match(html, /<button type="button" class="link backup-link" data-nav="#\/settings\/backup" data-i18n="backup\.link"><\/button>/);
  const ui = src('../js/ui/backup.js');
  assert.ok(!/innerHTML/.test(ui));
  // 설정 화면이 이 파일을 import 한다 — ai/* 를 끌어오면 inlinetr 의 import 고리에 캐시가 들어간다(8d D8)
  for (const m of ui.matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.ok(!/\/ai\//.test(m[1]), 'ui/backup.js import ' + m[1]);
  assert.match(ui, /await settings\.set\('backup\.lastExportAt', Date\.now\(\)\);/);
  assert.match(ui, /a\.download = name;/);
  const st = src('../js/ui/settings.js');
  for (const f of ['initBackupCard();', 'showBackupCard(params && params.tab);', 'leaveBackupCard();']) assert.ok(st.includes(f), f);
  // 서비스·순수 계층은 화면을 모른다
  assert.ok(!/document\.|createElement/.test(src('../js/backup/export.js')));
});

/* ══ K14 i18n ════════════════════════════════════════════ */
test('K14 i18n — 화면·HTML 이 쓰는 backup.* 키가 4언어에 있다 · 진행 묶음 이름', () => {
  const used = new Set();
  for (const s of [src('../js/ui/backup.js'), src('../index.html')]) {
    for (const m of s.matchAll(/['"](backup\.[a-zA-Z.]+)['"]/g)) if (!m[1].endsWith('.')) used.add(m[1]);
  }
  used.delete('backup.lastExportAt');
  for (const p of new Set(Object.values(UI.PART_OF))) used.add('backup.part.' + p);
  used.add('backup.last.days.one');
  used.add('backup.last.days.other');
  used.delete('backup.last.days');
  assert.ok(used.size >= 20, '쓰는 키 ' + used.size);
  for (const lang of LANGS) {
    for (const k of used) assert.equal(typeof BUNDLES[lang][k], 'string', lang + ' ' + k);
  }
});
