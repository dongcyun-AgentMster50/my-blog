/* ============================================================
   tests/search-cjk-8g6.test.mjs — 8g-6 검색: CJK·한국어 조사 (spec 19-1-3 §8 · 17-8-4)

   C1  한글로 끝나는 검색어는 뒤 경계를 연다(조사 허용) — `학교` → "학교에"·"학교는", "대학교" 는 아님(앞 경계)
   C2  한자·가나로 시작/끝나는 쪽은 경계 검사를 하지 않는다 — `学校` 가 `我们学校很大` 안에서
   C3  최소 길이 — 한자·가나 1자 허용(`学`), 한글 1자는 그대로 짧음(`학`)
   C4  전각 ASCII ↔ 반각 1:1(`ＡＢＣ` ↔ `abc`) · C5 `U+3000` ↔ 공백
   C6  무작위 유니코드 길이 보존(17-8-4 S1 그대로 + 전각·`U+3000`·NFKC 가 길이를 바꾸는 글자)
   C7  라틴·아랍 검색어 결과가 HEAD(8g-6 앞) 와 같다 — 고정 표(HEAD 판 search.js 로 뽑은 값) · 경첩 불변
   C8  엔진(`searchDoc`)·강조 경로(`findOn` → `rangesFor`)도 같은 규칙 — 한글·한자 문서
   C9  8g-7 진료과 사전은 검색 함수를 부르지 않는다(결과 불변의 전제)

   픽스처는 전부 **지어낸 글**이다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

const db = await import('../js/db.js');
const engine = await import('../js/search/engine.js');
const ui = await import('../js/ui/search.js');
const { ALGO_VERSION } = await import('../js/pdf/extract.js');
const { SEARCH } = await import('../js/config.js');
const { fromStored, derivedHash } = await import('../js/text/store.js');
const { describePage, flowParasOf, joinPieces } = await import('../js/text/screen.js');
const {
  foldText, parseQuery, findIn, hitLength, rangesFor, searchRecordOf, SEARCH_KEY, SEARCH_ERR
} = await import('../js/text/search.js');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const hits = (text, q) => { const pq = parseQuery(q); return findIn(pq.cs ? text : foldText(text), pq); };
const words = (text, q) => {
  const pq = parseQuery(q);
  const hay = pq.cs ? text : foldText(text);
  return findIn(hay, pq).map((at) => text.slice(at, at + hitLength(hay, pq, at)));
};

/* ══ C1 한글 — 뒤 경계 열림 · 앞 경계 그대로 ═══════════════════════ */

test('C1 ★ `학교` → "학교에"·"학교는"·"학교" 적중, "대학교" 는 아님 — 뒤 경계만 열린다', () => {
  const T = '학교에 갔다. 학교는 크다. 대학교 다닌다. 그 학교';
  const pq = parseQuery('학교');
  assert.equal(pq.error, undefined);
  assert.equal(pq.whole, false, '한글로 끝나면 뒤 경계를 연다');
  assert.equal(pq.open, undefined, '앞 경계는 그대로(한글 시작)');
  assert.deepEqual(hits(T, '학교'), [0, 8, 27]);
  assert.ok(!hits(T, '학교').includes(T.indexOf('대학교') + 1), '"대학교" 속 학교는 아님');
  // 3자 이하 한글도 길이와 무관하게 — 4자 이상(이미 접두)은 그대로
  assert.deepEqual(words('관절염이 있다. 류마티스관절염.', '관절염'), ['관절염'], '붙여 쓴 합성어 속은 못 찾는다(한계)');
  assert.deepEqual(words('류마티스관절염으로', '류마티스관절염'), ['류마티스관절염']);
  // 라틴 + 한글로 끝나는 섞인 검색어도 검색어 끝 글자로
  assert.equal(parseQuery('X선').whole, false);
  assert.deepEqual(words('X선을 찍고 X선은', 'X선'), ['X선', 'X선']);
  // 한글로 시작해 라틴으로 끝나면 라틴 규칙(3자 이하 낱말 전체)
  assert.equal(parseQuery('비타민c').whole, false, '4자 — 접두');
  assert.equal(parseQuery('혈a').whole, true, '라틴으로 끝나는 3자 이하는 낱말 전체 그대로');
});

/* ══ C2 한자·가나 — 그쪽 경계 검사 없음 ═════════════════════════ */

test('C2 ★ `学校` 가 `我们学校很大` 안에서 적중 · 가나도 · 한글로 끝나면 앞 경계는 그대로', () => {
  assert.deepEqual(hits('我们学校很大', '学校'), [2]);
  const pq = parseQuery('学校');
  assert.equal(pq.open, true, '한자로 시작 — 앞 경계 없음');
  assert.equal(pq.whole, false, '한자로 끝남 — 뒤 경계 없음');
  assert.deepEqual(hits('学校。学校的老师', '学校'), [0, 3]);
  assert.deepEqual(hits('わたしはがくせいです', 'がくせい'), [4]);
  assert.deepEqual(hits('コーヒーを飲む', 'コーヒー'), [0]);
  assert.deepEqual(hits('アイスコーヒー', 'コーヒー'), [3], 'ー 로 끝나도 뒤 경계 없음');
  // 한자로 시작하고 한글로 끝나면 앞은 열리고 뒤도(조사) 열린다
  assert.deepEqual(hits('大學校에서', '學校에'), [1]);
  // 한글로 시작하고 한자로 끝나면 앞 경계는 검사한다
  assert.deepEqual(hits('대학校 학校', '학校'), [4]);
});

/* ══ C3 최소 길이 ══════════════════════════════════════ */

test('C3 ★ 한자·가나 1자 허용(`学`·`の`·`ア`) · 한글 1자(`학`)·라틴 1자·그리스 1자는 그대로 짧음', () => {
  for (const q of ['学', 'の', 'ア', ' 学 ', '𠀀']) {
    const pq = parseQuery(q);
    assert.equal(pq.error, undefined, q);
    assert.equal(pq.open, true, q);
    assert.equal(pq.whole, false, q);
  }
  assert.deepEqual(hits('我们学校很大', '学'), [2]);
  assert.deepEqual(hits('A𠀀B', '𠀀'), [1], '서로게이트 한자 1자');
  for (const q of ['학', 'a', 'β', 'ㄱ', 'Ａ', '１', '　']) assert.equal(parseQuery(q).error, SEARCH_ERR.SHORT, JSON.stringify(q));
  assert.equal(parseQuery('学'.repeat(SEARCH.MAX_CHARS + 1)).error, SEARCH_ERR.LONG);
  assert.equal(SEARCH.MIN_CHARS, 2, '설정 값은 그대로 — 1자 허용은 한자·가나 예외');
});

/* ══ C4 · C5 전각 ↔ 반각 ═══════════════════════════════════ */

test('C4 ★ 전각 ASCII ↔ 반각 1:1 — `ＡＢＣ` ↔ `abc`, 범위 끝(U+FF01·FF5E)과 밖(U+FF5F·FF61)', () => {
  assert.equal(foldText('ＡＢＣ'), 'abc');
  assert.equal(foldText('Ａｂｃ１２３'), 'abc123');
  assert.equal(foldText('！～'), '!~');
  assert.equal(foldText('－'), ' ', '전각 하이픈도 하이픈 접기를 지난다');
  assert.equal(foldText('｟｡'), '｟｡', '범위 밖은 그대로');
  assert.equal(foldText('㎎ ﬁ ½'), '㎎ ﬁ ½', 'NFKC 가 아니다 — 길이를 바꾸는 호환 글자는 그대로');
  assert.deepEqual(hits('xx ＡＢＣ yy abc zz ABC', 'abc'), [3, 10, 17]);
  assert.deepEqual(hits('xx ＡＢＣ yy abc zz', 'ＡＢＣ'), [3, 10]);
  assert.deepEqual(hits('ＣＯＶＩＤ－１９ 환자', 'covid-19'), [0]);
  assert.deepEqual(hits('ＣＯＶＩＤ－１９ 환자', 'ＣＯＶＩＤ－１９'), [0]);
  // 전각 대문자 검색어는 약어(대소문자 구분) 규칙에 들지 않는다 — 접은 글자로 찾는다
  assert.equal(parseQuery('ＡＢＣ').cs, false);
});

test('C5 ★ `U+3000`(전각 공백) ↔ 공백', () => {
  assert.equal(foldText('heart　failure'), 'heart failure');
  assert.deepEqual(hits('heart　failure', 'heart failure'), [0]);
  assert.deepEqual(hits('heart failure', 'heart　failure'), [0]);
  assert.deepEqual(hits('学校　学校', '学校'), [0, 3]);
  assert.deepEqual(hits('학교　가다', '학교 가다'), [0]);
});

/* ══ C6 길이 보존 ══════════════════════════════════════ */

test('C6 ★ foldText 는 무작위 유니코드 1만 개(전각·U+3000·NFKC 가 길이를 바꾸는 글자·서로게이트 포함)에서 길이를 보존한다', () => {
  let seed = 8606;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  const pools = [
    () => String.fromCharCode(Math.floor(rnd() * 0xD800)),
    () => String.fromCharCode(0xE000 + Math.floor(rnd() * 0x2000)),                 // 전각·반각 블록 포함
    () => String.fromCharCode(0xFF00 + Math.floor(rnd() * 0xF0)),
    () => String.fromCodePoint(0x10000 + Math.floor(rnd() * 0xFFFFF)),
    () => String.fromCharCode(0xD800 + Math.floor(rnd() * 0x800)),                  // 외톨이 서로게이트
    () => '　', () => '㎎', () => 'ﬁ', () => '½', () => '㈜', () => '①', () => 'ｶﾞ', () => '℡',
    () => 'İ', () => 'ẞ', () => '学校', () => '학교에', () => 'コーヒー', () => 'ＡＢＣ－１'
  ];
  for (let n = 0; n < 10000; n++) {
    let s = '';
    const k = 1 + Math.floor(rnd() * 12);
    for (let i = 0; i < k; i++) s += pools[Math.floor(rnd() * pools.length)]();
    assert.equal(foldText(s).length, s.length, 'n=' + n + ' ' + JSON.stringify(s));
  }
  for (let k = 0xFF01; k <= 0xFF5E; k++) assert.equal(foldText(String.fromCharCode(k)).length, 1, k.toString(16));
});

/* ══ C7 라틴·아랍 — HEAD 와 같다 ══════════════════════════════ */

/* 고정 표: 8g-6 앞(HEAD 0e2b1e4) 의 `js/text/search.js` 로 뽑은 parseQuery 결과와 합성 글의 [오프셋, 길이]
   (스크래치패드 b8g6/gen-latin-table.mjs). 라틴 규칙(3자 이하 낱말 전체 · 4자 접두 · 약어 대소문자 · 구 · 그리스 · 합성어) ·
   아랍어 · 스페인어(8n — 라틴 규칙 그대로) · 오류 코드. */
const HEAD_TEXT = 'Patients with MI or mild CKD; the theory of HbA1c. Beta-Blockers and β-blocker use, beta blocker dose.\nPre-eclampsia vs preeclampsia vs pre eclampsia. Metformin; IL-6 and non-Hodgkin lymphoma. Café x-ray ab abc 12 123.\nالمريض مصاب بالساركويد و ساركويدوز في القلب والدم دم قلب.\nNiño ¿Qué tal? (a+b)*[ heart failure, heart-failure, COPD5 ABCDEF Mi mi MIS (MI).';
const HEAD_ROWS = [["patients",{"q":"patients","cs":false,"whole":false,"variants":["patients"]},[[0,8]]],["the",{"q":"the","cs":false,"whole":true,"variants":["the"]},[[30,3]]],["mi",{"q":"mi","cs":false,"whole":true,"variants":["mi"]},[[14,2],[343,2],[346,2],[354,2]]],["MI",{"q":"MI","cs":true,"whole":true,"variants":["MI"]},[[14,2],[354,2]]],["CKD",{"q":"CKD","cs":true,"whole":true,"variants":["CKD"]},[[25,3]]],["HbA1c",{"q":"HbA1c","cs":false,"whole":false,"variants":["hba1c"]},[[44,5]]],["beta blocker",{"q":"beta blocker","cs":false,"whole":false,"variants":["beta blocker","β blocker"]},[[51,12],[69,9],[84,12]]],["β-blocker",{"q":"β-blocker","cs":false,"whole":false,"variants":["β blocker","beta blocker"]},[[51,12],[69,9],[84,12]]],["Beta",{"q":"Beta","cs":false,"whole":false,"variants":["beta","β"]},[[51,4],[69,1],[84,4]]],["pre-eclampsia",{"q":"pre-eclampsia","cs":false,"whole":false,"variants":["pre eclampsia","preeclampsia"]},[[103,13],[120,12],[136,13]]],["preeclampsia",{"q":"preeclampsia","cs":false,"whole":false,"variants":["preeclampsia","pre eclampsia"]},[[103,13],[120,12],[136,13]]],["metform",{"q":"metform","cs":false,"whole":false,"variants":["metform"]},[[151,7]]],["IL-6",{"q":"IL-6","cs":false,"whole":false,"variants":["il 6"]},[[162,4]]],["non-Hodgkin",{"q":"non-Hodgkin","cs":false,"whole":false,"variants":["non hodgkin","nonhodgkin"]},[[171,11]]],["ساركويد",{"q":"ساركويد","cs":false,"whole":false,"variants":["ساركويد"]},[[244,7]]],["دم",{"q":"دم","cs":false,"whole":true,"variants":["دم"]},[[269,2]]],["قلب",{"q":"قلب","cs":false,"whole":true,"variants":["قلب"]},[[272,3]]],["café",{"q":"café","cs":false,"whole":false,"variants":["cafe"]},[[193,4]]],["x-ray",{"q":"x-ray","cs":false,"whole":false,"variants":["x ray"]},[[198,5]]],["ab",{"q":"ab","cs":false,"whole":true,"variants":["ab"]},[[204,2]]],["abc",{"q":"abc","cs":false,"whole":true,"variants":["abc"]},[[207,3]]],["12",{"q":"12","cs":false,"whole":true,"variants":["12"]},[[211,2]]],["(a+b)*[",{"q":"(a+b)*[","cs":false,"whole":false,"variants":["(a+b)*["]},[[292,7]]],["heart failure",{"q":"heart failure","cs":false,"whole":false,"variants":["heart failure"]},[[300,13],[315,13]]],["COPD5",{"q":"COPD5","cs":true,"whole":true,"variants":["COPD5"]},[[330,5]]],["ABCDEF",{"q":"ABCDEF","cs":false,"whole":false,"variants":["abcdef"]},[[336,6]]],["niño",{"q":"niño","cs":false,"whole":false,"variants":["nino"]},[[277,4]]],["¿qué",{"q":"¿qué","cs":false,"whole":false,"variants":["¿que"]},[[282,4]]],["a",{"error":"ERR_SEARCH_SHORT","q":"a"},[]],["--",{"error":"ERR_SEARCH_SHORT","q":"--"},[]],["xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",{"error":"ERR_SEARCH_LONG","q":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"},[]],["β",{"error":"ERR_SEARCH_SHORT","q":"β"},[]]];

test('C7 ★ 라틴·아랍·스페인어 검색어 — parseQuery 결과 모양과 적중 [오프셋, 길이] 가 HEAD 와 하나도 다르지 않다', () => {
  assert.equal(HEAD_ROWS.length, 32);
  for (const [q, want, wantHits] of HEAD_ROWS) {
    const pq = parseQuery(q);
    assert.deepEqual(pq, want, 'parseQuery ' + q);
    const hay = pq.cs ? HEAD_TEXT : foldText(HEAD_TEXT);
    assert.deepEqual(findIn(hay, pq).map((at) => [at, hitLength(hay, pq, at)]), wantHits, 'findIn ' + q);
  }
  // 라틴 규칙 이름표로 다시 — 3자 이하 낱말 전체 · 4자 접두 · 약어 대소문자
  assert.deepEqual(words('the theory other', 'the'), ['the']);
  assert.deepEqual(words('metformin metform', 'metform'), ['metform', 'metform']);
  assert.deepEqual(words('MI mild mi MIS (MI)', 'MI'), ['MI', 'MI']);
  assert.equal(foldText(HEAD_TEXT).length, HEAD_TEXT.length);
});

test('C7b ★ 경첩·판 불변 — SEARCH.VERSION 1 · SEARCH_KEY 가 HEAD 값 · 저장 레코드는 원문 그대로(전각을 접지 않는다)', () => {
  assert.equal(SEARCH.VERSION, 1);
  assert.equal(SEARCH_KEY, '1|d1:9e94752b');
  const rec = epage('K0', 1, [{ text: 'ＡＢＣ　학교에 学校' }]);
  const st = searchRecordOf(fromStored(rec));
  // 화면 글자(joinPieces)는 8g 부터 `\s+` 를 공백 하나로 잇는다 — U+3000 은 저장 전에 이미 공백이다(8g-6 과 무관).
  // 전각 글자는 그대로 저장된다(접기는 읽을 때 메모리).
  assert.equal(st.text, 'ＡＢＣ 학교에 学校', '접기는 읽을 때 메모리 — 저장 글자는 화면 글자 그대로');
  assert.equal(st.sk, SEARCH_KEY);
});

/* ══ C8 엔진·강조 경로 ═══════════════════════════════════ */

let ELID = 0;
function eline(text, para) {
  return {
    id: 'k' + (++ELID), text: text, bbox: [0, 0, 100, 10], baseline: 0, fontSize: 10,
    col: 0, role: 'body', hyphenJoin: false, paraId: para, regionId: null, runs: []
  };
}
function epage(docId, pageNo, paras) {
  const lines = [];
  const ps = [];
  paras.forEach((p, i) => {
    const pid = 'p' + pageNo + '-' + i;
    const ids = (p.lines || [p.text]).map((t) => { const l = eline(t, pid); lines.push(l); return l.id; });
    ps.push({ id: pid, lineIds: ids, kind: 'body', bbox: [0, 0, 1, 1], continuesNext: false, continuesPrev: false });
  });
  return {
    docId: docId, pageNo: pageNo, width: 600, height: 800, algoVersion: ALGO_VERSION,
    storeVersion: 1, derivedHash: derivedHash(), lines: lines, paragraphs: ps, regions: [],
    columns: { count: 1, gutters: [] },
    stats: { medianFontSize: 10, medianLeading: 12, bodyLeft: [], warn: null, widthFixed: 0 }, roleVersion: 1
  };
}

test('C8 ★ 엔진 searchDoc — 한글 조사·한자 부분 일치·1자·전각 · 강조 구간이 그 글자 위', async () => {
  const D = 'CJK8';
  const recs = [
    epage(D, 1, [{ lines: ['학교에 갔다. 학교는 크다.', '대학교 다닌다.'] }]),
    epage(D, 2, [{ text: '我们学校很大。ＡＢＣ　abc' }])
  ];
  await db.put('documents', { id: D, title: 'cjk', fileHash: 'h-' + D, pageCount: 2, lastOpenedAt: 1 });
  await db.putAll('pages', recs);
  const n = async (q) => (await engine.searchDoc(D, q)).hits.map((h) => h.pageNo + ':' + h.at + ':' + h.len);
  assert.deepEqual(await n('학교'), ['1:0:2', '1:8:2']);
  assert.deepEqual(await n('学校'), ['2:2:2']);
  assert.deepEqual(await n('学'), ['2:2:1']);
  assert.deepEqual(await n('abc'), ['2:7:3', '2:11:3']);
  assert.equal((await engine.searchDoc(D, '학')).error, SEARCH_ERR.SHORT);

  // 강조 경로(리더 `findOn` → `rangesFor`) — 줄을 넘은 글에서도 구간이 '학교' 위에
  const paras = flowParasOf(describePage(fromStored(recs[0])));
  const j = joinPieces(paras[0].lines);
  const pq = parseQuery('학교');
  const hs = ui.findOn(j.text, pq);
  assert.deepEqual(hs.map((h) => j.text.slice(h.at, h.at + h.len)), ['학교', '학교']);
  const rs = rangesFor(j, hs);
  const byId = new Map(recs[0].lines.map((l) => [l.id, l.text]));
  for (const r of rs) {
    assert.equal(r.length, 1);
    assert.equal(byId.get(r[0].id).slice(r[0].start, r[0].end), '학교');
  }
  // 조각 캐시 키 — 검색어 규칙이 같으면 같은 키(한글은 이제 'p')
  assert.equal(ui.snipQueryKey('학교'), 'fp\n학교');
  assert.equal(ui.snipQueryKey('MI'), 'cw\nMI');
});

/* ══ C9 8g-7 진료과 사전 ═════════════════════════════════ */

test('C9 8g-7 진료과 사전(text/specialty.js)은 검색 접기·일치 함수를 부르지 않는다 — 8g-6 이 그 결과를 바꿀 길이 없다', () => {
  const src = read('../js/text/specialty.js');
  assert.doesNotMatch(src, /from\s+['"][^'"]*search\.js['"]/);
  assert.doesNotMatch(src, /\b(foldText|parseQuery|findIn)\s*\(/);
});
