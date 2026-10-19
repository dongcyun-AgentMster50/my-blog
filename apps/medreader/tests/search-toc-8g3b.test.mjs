/* ============================================================
   tests/search-toc-8g3b.test.mjs — 8g-3b 폴백 목차 품질 · 쓰레기 개요 (spec 17-8-12 §11-6 S31–S35)

   S31  isJunkOutline — 파일 이름 꼴 표 · 비율 경계(10 중 8 → 버림, 7 → 개요) · [] → false · 의학책 꼴·Basic 2판 꼴
   S32  tocOf — 쓰레기 개요 → 폴백 + outlineIgnored:true(저장본 바이트 같음·쓰기 0) · 진짜 개요 → outline ·
        개요 [] → 폴백·outlineIgnored:false · 반복 문턱에 doc.pageCount(6쪽 vs 30쪽)
   S33  tocDropReason — 정의(R1–R8)마다 빼는 꼴·남기는 꼴 짝
   S34  headingToc — 뺀 항목은 200 상한을 차지하지 않음 · R9 · R10(opts.pages 없으면 10) · 쪽 순서·순수
   S35  계층·순수 — text/search.js 는 document·window·indexedDB 를 모른다 · isJunkOutline 은 DB 를 부르지 않는다

   픽스처 글자는 지어낸 것이거나 spec 표의 짧은 꼴(40자 이하)이다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
const idb = installFakeIdb();

const db = await import('../js/db.js');
const outline = await import('../js/search/outline.js');
const { headingToc, tocDropReason } = await import('../js/text/search.js');
const { SEARCH } = await import('../js/config.js');
const { ensure, tocOf, isJunkOutline, JUNK_OUTLINE_RATIO, OUTLINE_V } = outline;

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** 검색 레코드(쪽마다) — lines = [[글자, r]] · r 이 0/없으면 본문 줄. heads 오프셋은 text 안. */
function st(docId, pageNo, lines) {
  const parts = [];
  const heads = [];
  for (const [t, r] of lines) {
    const o = parts.length ? parts.join('\n').length + 1 : 0;
    if (r) heads.push({ i: parts.length, o, r });
    parts.push(t);
  }
  return { docId, pageNo, sk: 'x', algoVersion: 12, text: parts.join('\n'), table: '', heads };
}

let seq = 0;
async function seedDoc(extra) {
  const id = 'J' + (++seq);
  await db.put('documents', Object.assign({ id, title: 'Book ' + id, fileHash: 'h-' + id, pageCount: 50, lastPage: 1, lang: 'en' }, extra || {}));
  return id;
}

const outl = (titles) => titles.map((t, k) => ({ t, p: k + 1, d: 1 }));

/* ══ S31 isJunkOutline ════════════════════════════════════ */

test('S31 ★ 파일 이름 꼴 표 — 끝 확장자·Untitled-n·빈 제목은 파일 이름, 끝이 아니거나 낱말이면 아님', () => {
  assert.equal(JUNK_OUTLINE_RATIO, 0.8);
  for (const t of ['SAVE001.JPG', '001.bmp', '12.tif', 'V2T6F8.BMP', 'Covers.pdf', 'Untitled-3.jpg', 'Untitled-3', '  ', '', ' 0042.jpeg ', 'page.TIFF', 'x.jfif', 'y.png', 'z.gif', 'w.webp', 'Untitled', 'untitled_7', 'Untitled 12']) {
    assert.equal(isJunkOutline([{ t, p: 1, d: 1 }]), true, JSON.stringify(t));
  }
  for (const t of ['Untitled chapter', 'Unit 3 .jpg 파일 다루기', 'Present continuous', 'PDF basics', 'Using .png files well']) {
    assert.equal(isJunkOutline([{ t, p: 1, d: 1 }]), false, JSON.stringify(t));
  }
  // 깊이와 무관 — 모든 깊이를 센다 · t 가 없어도 빈 제목으로
  assert.equal(isJunkOutline([{ t: 'Real Title', p: 1, d: 1 }, { p: 2, d: 2 }, { t: 'a.jpg', p: 3, d: 3 }, { t: 'b.jpg', p: 4, d: 4 }, { t: 'c.jpg', p: 5, d: 2 }]), true);
});

test('S31 ★ 비율 경계 — 10 항목 중 8 → 버림, 7 → 개요 · [] → false · 의학책 꼴 0 · Basic 2판 꼴(.pdf 4 + .jpg 6) 버림', () => {
  const mix = (junk, real) => outl([...Array.from({ length: junk }, (_, k) => String(k + 1).padStart(3, '0') + '.jpg'), ...Array.from({ length: real }, (_, k) => 'Zorvat Unit ' + (k + 1))]);
  assert.equal(isJunkOutline(mix(8, 2)), true, '★ 8/10 = 0.8 — 문턱 이상이면 버림');
  assert.equal(isJunkOutline(mix(7, 3)), false, '7/10 = 0.7 — 개요 그대로');
  assert.equal(isJunkOutline(mix(10, 0)), true);
  assert.equal(isJunkOutline([]), false, '빈 개요는 쓰레기가 아니라 없음');
  assert.equal(isJunkOutline(null), false);
  assert.equal(isJunkOutline(undefined), false);
  // 의학책 세 권 꼴(합성 — 제목 37·61·50개, 파일 이름 0)
  for (const n of [37, 61, 50]) {
    const o = outl(Array.from({ length: n }, (_, k) => (k % 5 === 0 ? 'Section ' + (k + 1) + ': Zorvat Disorders' : 'Zorvat Topic ' + (k + 1) + ' & Management')));
    assert.equal(isJunkOutline(o), false, n + '항목');
  }
  // Basic 2판 꼴 — 책 자기 파일 이름(.pdf, 깊이 1–4 사슬) 4 + 쪽 그림 6 = 100%
  const basic = [
    { t: 'Zorvat Grammar Basic 2nd Edition.pdf', p: 1, d: 1 }, { t: 'Zorvat Grammar Basic 2nd Edition.pdf', p: 1, d: 2 },
    { t: 'Zorvat Grammar Basic 2nd Edition.pdf', p: 1, d: 3 }, { t: 'Zorvat Grammar Basic 2nd Edition.pdf', p: 1, d: 4 },
    ...Array.from({ length: 6 }, (_, k) => ({ t: String(k + 1).padStart(3, '0') + '.jpg', p: k + 2, d: 4 }))
  ];
  assert.equal(isJunkOutline(basic), true, '★ .pdf 도 파일 이름 꼴(빼면 60% 로 개요가 된다)');
  // 입력을 바꾸지 않는다
  const snap = JSON.stringify(basic);
  isJunkOutline(basic);
  assert.equal(JSON.stringify(basic), snap);
});

/* ══ S32 tocOf ════════════════════════════════════════════ */

/** 가짜 pdf.js 문서 — 정수 대상(쪽 순번)만. */
function fakePdf(titles, numPages) {
  return {
    numPages: numPages || 50,
    async getOutline() { return titles ? titles.map((t, k) => ({ title: t, dest: [k, { name: 'XYZ' }], items: [] })) : null; },
    async getDestination() { return null; },
    async getPageIndex(r) { return r.num - 100; },
    async getPageLabels() { return null; }
  };
}

const writesTo = (store, from) => idb.log.slice(from).filter((x) => x.store === store && (x.op === 'put' || x.mode === 'readwrite')).length;

test('S32 ★ tocOf — 쓰레기 개요는 폴백 + outlineIgnored:true · 저장본은 바이트 같고 쓰기 0', async () => {
  const junkTitles = Array.from({ length: 12 }, (_, k) => 'SAVE' + String(k + 1).padStart(3, '0') + '.JPG');
  const id = await seedDoc();
  const res = await ensure(id, fakePdf(junkTitles));
  assert.equal(res.status, 'saved');
  const stored = await db.get('documents', id);
  assert.equal(stored.outlineV, OUTLINE_V);
  assert.deepEqual(stored.outline.map((e) => e.t), junkTitles, '★ 저장본은 PDF 개요 그대로(판정은 tocOf 에서만)');

  await db.putAll('searchText', [
    st(id, 2, [['Zorvat Present Simple', 1.6], ['body words', 0]]),
    st(id, 5, [['Zorvat Past Simple', 1.6]])
  ]);
  const before = JSON.stringify(await db.get('documents', id));
  const mark = idb.log.length;
  const toc = await tocOf(id);
  assert.equal(toc.source, 'fallback');
  assert.equal(toc.outlineIgnored, true);
  assert.equal(toc.outlineRead, true);
  assert.deepEqual(toc.items, [{ t: 'Zorvat Present Simple', p: 2, d: 1 }, { t: 'Zorvat Past Simple', p: 5, d: 1 }]);
  assert.equal(toc.items.some((e) => /\.jpg$/i.test(e.t)), false, '파일 이름 0 줄');
  assert.equal(writesTo('documents', mark), 0, '★ documents 쓰기 0(put·readwrite 트랜잭션 없음)');
  assert.equal(writesTo('searchText', mark), 0);
  assert.equal(JSON.stringify(await db.get('documents', id)), before, '★ documents 레코드가 읽기 전과 바이트 같다');
  // 두 번째 ensure 는 그대로 cached(저장본을 다시 쓰지 않는다)
  assert.equal((await ensure(id, fakePdf(junkTitles))).status, 'cached');
});

test('S32 ★ tocOf — 진짜 개요 → outline(outlineIgnored 없음) · 개요 [] → 폴백·outlineIgnored:false · 못 읽음 → false', async () => {
  const real = await seedDoc();
  await ensure(real, fakePdf(['Zorvat Unit 1', 'Zorvat Unit 2', 'Zorvat Unit 3']));
  const a = await tocOf(real);
  assert.equal(a.source, 'outline');
  assert.ok(!a.outlineIgnored);
  assert.deepEqual(a.items.map((e) => e.t), ['Zorvat Unit 1', 'Zorvat Unit 2', 'Zorvat Unit 3']);

  // 문턱 아래(7/10)는 개요 그대로(파일 이름 항목도 그대로 — E2)
  const mixed = await seedDoc();
  await ensure(mixed, fakePdf([...Array.from({ length: 7 }, (_, k) => k + '.bmp'), 'Zorvat A', 'Zorvat B', 'Zorvat C']));
  const m = await tocOf(mixed);
  assert.equal(m.source, 'outline');
  assert.equal(m.items.length, 10);

  const none = await seedDoc();
  await ensure(none, fakePdf(null));
  await db.put('searchText', st(none, 3, [['Zorvat Lone Title', 1.6]]));
  const b = await tocOf(none);
  assert.equal(b.source, 'fallback');
  assert.equal(b.outlineIgnored, false);
  assert.equal(b.outlineRead, true);

  const unread = await seedDoc();
  const c = await tocOf(unread);
  assert.equal(c.source, 'fallback');
  assert.equal(c.outlineRead, false);
  assert.equal(c.outlineIgnored, false, '못 읽은 개요는 버린 것이 아니다');
});

test('S32 ★ tocOf — 반복 문턱에 doc.pageCount 가 넘어간다(6쪽: 3번 반복 제목 빠짐 · 30쪽: 남음)', async () => {
  const lines = (p) => [['My Zorvat Answer', 1.6], ['Zorvat Topic ' + p, 1.6]];
  const short = await seedDoc({ pageCount: 6 });
  const long = await seedDoc({ pageCount: 30 });
  const recs = [];
  for (const id of [short, long]) for (let p = 1; p <= 3; p++) recs.push(st(id, p, lines(p)));
  await db.putAll('searchText', recs);
  const s = await tocOf(short);
  assert.equal(s.source, 'fallback');
  assert.deepEqual(s.items.map((e) => e.t), ['Zorvat Topic 1', 'Zorvat Topic 2', 'Zorvat Topic 3'], '★ 6쪽 → 문턱 3');
  const l = await tocOf(long);
  assert.equal(l.items.filter((e) => e.t === 'My Zorvat Answer').length, 3, '30쪽 → 문턱 10');
});

/* ══ S33 tocDropReason ════════════════════════════════════ */

const why = (t, r) => tocDropReason({ t, r: r == null ? 1.3 : r });

test('S33 ★ R2 문장 끝 — 뺌 / 말줄임·닫는 괄호·3자 이하 약어 뒤 부호는 남김', () => {
  assert.equal(why('They have gone home.'), 'sentence');
  assert.equal(why('home.'), 'sentence');
  assert.equal(why('Is it zorvat?'), 'sentence');
  assert.equal(why('Zorvat said “stop!”'), 'sentence');
  for (const t of ['Can / Could / Would you...?', '(remember/regret etc.)', 'Myself /yourself/themselves etc.', 'When ... ? and How long ... ?', 'Zorvat waits…']) {
    assert.equal(why(t), null, t);
  }
  assert.equal(why('Pass the pan.'), null, '약어 예외의 대가 — 알려진 한계(spec S33)');
});

test('S33 ★ R3 한 문단에 두 문장 · R4 대화 줄 · R5 긴 줄', () => {
  assert.equal(why('He left. She stayed'), 'multi');
  assert.equal(why('Had better'), null);
  assert.equal(why('"But I -"'), 'dialog');
  assert.equal(why('— Yes, sir'), 'dialog');
  assert.equal(why('– Zorvat, sir'), 'dialog');
  assert.equal(why('Zorvat replied ”'), 'dialog');
  assert.equal(why('-ing clauses'), null, '★ 붙임표는 대화 줄표가 아니다');
  const len = (n) => ('Zorvat abcdefg '.repeat(10)).slice(0, n).replace(/\s$/, 'x');
  assert.equal(len(81).length, 81);
  assert.equal(len(80).length, 80);
  assert.equal(why(len(81)), 'long');
  assert.equal(why(len(80)), null);
});

test('S33 ★ R6 글자가 거의 없음 · R7 OCR 잡음 기호(세로 막대는 아님)', () => {
  assert.equal(why('A g#'), 'noise');
  assert.equal(why('e1-01'), 'noise');
  assert.equal(why('abc 12345'), 'noise', '문자 3개지만 비율 < 0.5');
  assert.notEqual(why('12'), 'noise', '숫자만은 R6 아님');
  assert.equal(why('12'), null);
  assert.equal(why('12', 1.0), null, '대소문자 없는 숫자는 R8 도 아님');
  assert.equal(why('Our neighbour, Mr French £44'), 'symbol');
  assert.equal(why('Seal found \\ hard'), 'symbol');
  for (const c of ['{', '}', '®', '¢', '§', '©', '_', '~', '^', '=', '<', '>', '@', '¤', '°']) assert.equal(why('Zorvat ' + c + ' Topic'), 'symbol', c);
  assert.equal(why('| think so / | hope so etc.'), null, '★ 세로 막대는 OCR 이 읽은 대문자 I');
});

test('S33 ★ R8 본문 크기 제목은 대문자만(대소문자 없는 글 제외) · R1 작은 글자', () => {
  assert.equal(why('The Burrow', 0.98), 'weak');
  assert.equal(why('her', 0.98), 'weak');
  assert.equal(why('VSD', 0.98), 'weak', '대문자 4자 미만');
  assert.equal(why('THE BURROW', 0.98), null, '★ 소설 장 제목 꼴');
  assert.equal(why('THE ZORVAT BURROw', 0.98), null, '대문자 90% 이상(14/15)');
  assert.equal(why('THE BURROw', 0.98), 'weak', '8/9 < 0.9');
  assert.equal(why('학습목표', 1.0), null, '★ 대소문자 없는 글은 R8 을 받지 않는다');
  assert.equal(why('The Burrow', 1.2), null);
  assert.equal(why('The Burrow', 1.15), null, 'r = TOC_WEAK_R 는 본문 크기가 아니다');
  assert.equal(why('The Burrow', 1.14), 'weak');
  assert.equal(why('THE BURROW', 0.89), 'small');
  assert.equal(why('THE BURROW', 0.9), null, '★ r = TOC_MIN_R 은 남긴다');
  assert.equal(why('7', 0.5), 'small');
  assert.equal(SEARCH.TOC_MIN_R, 0.9);
  assert.equal(SEARCH.TOC_WEAK_R, 1.15);
  assert.equal(SEARCH.TOC_MAX_LEN, 80);
  assert.equal(SEARCH.TOC_REPEAT_MIN, 3);
});

/* ══ S34 headingToc ═══════════════════════════════════════ */

const alpha = (n) => { let s = ''; n += 26; while (n > 0) { s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; };

test('S34 ★ 뺀 항목은 200 상한을 차지하지 않는다 — 상위 층 문장 줄 150 + 아래 층 제목 100 → 제목 100', () => {
  const recs = [];
  for (let p = 1; p <= 150; p++) {
    const lines = [['Zorvat went home with ' + alpha(p) + 'friend.', 2.0]];
    if (p <= 100) lines.push(['Zorvat Unit ' + alpha(p), 1.5]);
    recs.push(st('D', p, lines));
  }
  const toc = headingToc(recs);
  assert.equal(toc.length, 100, '★ 거르기가 층 고르기 앞이다');
  assert.ok(toc.every((e) => e.r === 1.5 && /^Zorvat Unit /.test(e.t)));
});

test('S34 ★ R9 쪽 끝 숫자만 항목은 빠지고, 같은 쪽 다음 heading 붙임은 그대로', () => {
  const recs = [
    st('D', 2, [['1', 2.5], ['Zorvat Chapter 2', 1.5]]),
    st('D', 3, [['Zorvat Lead', 1.5], ['7', 2.5]]),            // 쪽 끝
    st('D', 4, [['8', 2.5], ['9', 2.5]])                        // 붙여도 숫자만
  ];
  const toc = headingToc(recs);
  assert.deepEqual(toc.map((e) => [e.t, e.p]), [
    ['1 Zorvat Chapter 2', 2], ['Zorvat Chapter 2', 2], ['Zorvat Lead', 3]
  ]);
});

test('S34 ★ R10 반복 문턱 — opts.pages 없으면 10 · 6쪽 3 · 30쪽 10 · 4쪽 3(하한)', () => {
  const recs = [];
  for (let p = 1; p <= 3; p++) recs.push(st('D', p, [['My Zorvat Answer', 1.6], ['Zorvat Topic ' + p, 1.6]]));
  const n = (o) => headingToc(recs, o).filter((e) => e.t === 'My Zorvat Answer').length;
  assert.equal(n(), 3, '★ pages 없음 → 문턱 10(8g-3 그대로)');
  assert.equal(n({ pages: 6 }), 0);
  assert.equal(n({ pages: 4 }), 0);
  assert.equal(n({ pages: 7 }), 3, '⌈7/2⌉ = 4');
  assert.equal(n({ pages: 30 }), 3);
  assert.equal(n({ pages: 0 }), 3, '0·NaN 은 없음과 같다');
  assert.equal(n({ pages: NaN }), 3);
  assert.equal(headingToc(recs).length, 6);
  // 10번 반복은 pages 와 무관하게 빠진다
  const ten = [];
  for (let p = 1; p <= 10; p++) ten.push(st('D', p, [['Zorvat Generic', 1.6], ['Zorvat Unique ' + alpha(p), 1.6]]));
  assert.equal(headingToc(ten, { pages: 500 }).some((e) => e.t === 'Zorvat Generic'), false);
  assert.equal(headingToc(ten).some((e) => e.t === 'Zorvat Generic'), false);
});

test('S34 ★ 결과는 쪽 순서 · 순수(입력을 바꾸지 않음) · 층 고르기 = 층마다 거르기와 같은 결과', () => {
  const recs = [];
  for (let p = 1; p <= 60; p++) {
    const lines = [];
    for (let k = 0; k < 4; k++) lines.push(['Zorvat Head ' + alpha(p * 4 + k), 1.2 + ((p * 7 + k * 13) % 23) / 10]);
    recs.push(st('D', p, lines));
  }
  const shuffled = recs.slice().reverse();
  const snap = JSON.stringify(shuffled);
  const toc = headingToc(shuffled, { max: 50 });
  assert.equal(JSON.stringify(shuffled), snap, '입력을 바꾸지 않는다');
  for (let k = 1; k < toc.length; k++) assert.ok(toc[k - 1].p <= toc[k].p, '쪽 순서');
  // 층마다 거르기(8g-3 방식)로 다시 셈
  const all = [];
  for (const r of recs) r.heads.forEach((h) => { const e = r.text.indexOf('\n', h.o); all.push({ p: r.pageNo, r: h.r, t: r.text.slice(h.o, e < 0 ? undefined : e) }); });
  const tiers = [...new Set(all.map((h) => h.r))].sort((a, b) => b - a);
  let take = [];
  for (const r of tiers) { const nx = all.filter((h) => h.r >= r); if (nx.length > 50) break; take = nx; }
  assert.ok(take.length > 0 && take.length < all.length);
  assert.deepEqual(toc.map((e) => [e.p, e.t, e.r]), take.map((e) => [e.p, e.t, e.r]));
  // 첫 층부터 상한을 넘으면 빈 목록
  assert.deepEqual(headingToc(recs, { max: 1 }).length <= 1, true);
  assert.deepEqual(headingToc([]), []);
  assert.deepEqual(headingToc(null), []);
});

/* ══ S35 계층·순수 ════════════════════════════════════════ */

test('S35 ★ text/search.js 는 document·window·indexedDB 를 쓰지 않는다 · isJunkOutline 은 DB 를 부르지 않는다', () => {
  const src = read('../js/text/search.js');
  const banned = /\b(document|window|indexedDB|fetch)\b/;
  assert.deepEqual(src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => banned.test(l)), []);
  const osrc = noComments(read('../js/search/outline.js'));
  const body = osrc.slice(osrc.indexOf('export function isJunkOutline('), osrc.indexOf('export function isOutlineCurrent('));
  assert.ok(body.length > 50);
  assert.doesNotMatch(body, /\bdb\.|await|async/);
  const mark = idb.log.length;
  isJunkOutline(outl(['a.jpg', 'b.jpg']));
  assert.equal(idb.log.length, mark, 'DB 호출 0');
  assert.equal(typeof tocDropReason, 'function');
});

test('정리 — 흉내 DB 에 이 파일 밖 스토어 쓰기 없음', () => {
  const touched = new Set(idb.log.filter((x) => x.op === 'put').map((x) => x.store));
  for (const s of touched) assert.ok(['documents', 'searchText'].includes(s), s);
});
