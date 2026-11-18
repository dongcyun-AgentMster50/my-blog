/* ============================================================
   tests/polish-5.test.mjs — 다듬기 5 (화면·문구·시험 틈 · 19 링크만)

   Z1  12-3 복습 키 — `gradeKeyIndex`: 서방·아랍-인도(١–٤)·페르시아(۱–۴) 숫자 · `ev.code`(Digit·Numpad) · onKey 가 이것을 쓴다
   Z2  13-2 시험일 당일 — 정렬(오늘 = 0, 가장 가까움) · `viewStatus` today · 서재 "오늘" 줄 today · 4언어 문구 · ar 요일 칩 narrow
   Z3  19 링크만 — `LINKS.SUGGESTED` Open-i 한 줄(확인 필요 · 새 탭 rel) · [찾아보기] 계획에 주소 · 앱 요청 0
   Z4  ui/cards.js `ranged` 의 번역 빈 단어 판정 = `srs/cards.js` `isNoTrTerm`(사본 0)
   Z5  fr `nav.back`·`common.cancel`·`library.card.delete` · ko 같은 셋 — 영어 값이 아니다
   Z6  시험 틈(앱 코드 무변 — 변이가 살아남았던 것):
       a reattach 한 트랜잭션(20-3R r1) · b 필기 내보내기 "보이는 줄만"(r3) · c D5 "묶음 조각 하나라도 찾으면 고아 아님"(r5 — 찾히는 조각 먼저) ·
       d 8q 3단 퍼즈 "줄 수·글자 보존"(8qbR #5 · V4) · e `leaveLinksSettings` 가 열린 링크 대화를 취소 길로(P4cR R7) ·
       f 서재로 돌아왔을 때 초점(P4bR 낮음-2 — `landingTarget`)
       (15 Q12 물결 대시 `〜`·`^+` 지수는 grounding-15 Q12 에 더함)
   Z7  20-3 서재 상태 줄 "필기·요약 n건" = 화면·칩 셈(묶음 1 + 요약 건) — `noteUnits`·`reattachShown`
   Z8  12-3 간격 단위 복수 — `Intl.PluralRules` 범주 키(ar few·many · fr other) · en·ko 그대로
   Z9  16 개념도 라벨 단위 토큰 — `[5b]` 9번(글자 체계 끊기) 되돌림: 끊지 않음 · 붙여 쓴 비교 낱말 뒤집힘(이상↔이하 · 미만↔초과 · 以上↔以下) 버림
   지어낸 글자만. 실제 키·실제 요청 없음.
   ============================================================ */

process.env.TZ = 'Asia/Seoul';

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();
function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
globalThis.sessionStorage = globalThis.sessionStorage || memStorage();
globalThis.localStorage = globalThis.localStorage || memStorage();

let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; throw new Error('호출 금지'); };

const db = await import('../js/db.js');
const CU = await import('../js/ui/cards.js');
const SC = await import('../js/srs/cards.js');
const PU = await import('../js/ui/planner.js');
const PP = await import('../js/plan/planner.js');
const LIB = await import('../js/ui/library.js');
const LK = await import('../js/ui/links.js');
const TL = await import('../js/text/links.js');
const A = await import('../js/notes/annotations.js');
const NU = await import('../js/ui/notes.js');
const NX = await import('../js/text/numexpr.js');
const PR = await import('../js/ai/prompts.js');
const { buildPageLayout } = await import('../js/text/layout.js');
const { joinHyphen } = await import('../js/text/hyphen.js');
const { indexOfDesc } = await import('../js/text/anchor.js');
const { LINKS, LAYOUT, SRS } = await import('../js/config.js');
const I18N = await import('../js/i18n/index.js');
const { BUNDLES, LANGS } = I18N;

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const SOH = String.fromCharCode(1);   // 필기 줄 열쇠 구분자(docId + SOH + group — ui/notes.js rowsOf)
async function reset() { for (const s of db.STORE_NAMES) await db.clearStore(s); }
async function all(s) { const out = []; await db.iterate(s || 'annotations', {}, (v) => { out.push(v); }); return out; }

/* ══ Z1 복습 키 ═══════════════════════════════════════════ */

test('Z1 ★ 복습 키 1–4 — 서방·아랍-인도(١–٤)·페르시아(۱–۴) 숫자 · ev.code(Digit·Numpad · AZERTY) · 다른 키는 -1 · onKey 가 이것을 쓴다', () => {
  const g = CU.gradeKeyIndex;
  assert.deepEqual(['1', '2', '3', '4'].map((k) => g({ key: k })), [0, 1, 2, 3]);
  assert.deepEqual(['١', '٢', '٣', '٤'].map((k) => g({ key: k })), [0, 1, 2, 3], '★ 아랍-인도 숫자 자판');
  assert.deepEqual(['۱', '۲', '۳', '۴'].map((k) => g({ key: k })), [0, 1, 2, 3], '페르시아(동방 아랍-인도) 숫자');
  assert.deepEqual(['Digit1', 'Digit2', 'Digit3', 'Digit4'].map((c) => g({ key: 'Unidentified', code: c })), [0, 1, 2, 3], '★ ev.code(자판 배치 무관)');
  assert.deepEqual(['Numpad1', 'Numpad4'].map((c) => g({ key: 'End', code: c })), [0, 3]);
  assert.equal(g({ key: '&', code: 'Digit1' }), 0, 'AZERTY 윗줄 — key 는 & 이지만 code Digit1');
  assert.equal(g({ key: '2', code: 'Digit1' }), 1, 'key 가 숫자면 key 가 먼저');
  for (const ev of [{ key: '5' }, { key: '٥' }, { key: '0' }, { key: 'a', code: 'KeyA' }, { key: ' ', code: 'Space' }, { code: 'Digit5' }, { code: 'Numpad0' }, {}, null]) {
    assert.equal(g(ev), -1, JSON.stringify(ev));
  }
  const src = strip(read('../js/ui/cards.js'));
  const on = src.slice(src.indexOf('function onKey(ev)'), src.indexOf('async function setTab('));
  assert.match(on, /const k = gradeKeyIndex\(ev\);/);
  // `[5b — P5R 낮음-2]` 입력 칸·편집 영역·대화가 열린 동안은 가로채지 않는다 — 가드가 키 판정보다 먼저
  const guard = "if (tag === 'input' || tag === 'textarea' || tag === 'select' || (tg && tg.isContentEditable)) return;";
  assert.ok(on.includes(guard), '입력 칸 가드');
  assert.ok(on.indexOf(guard) < on.indexOf('gradeKeyIndex(ev)'), '가드가 먼저');
  assert.match(on, /if \(\(els\.edit && els\.edit\.open\) \|\| \(els\.del && els\.del\.open\)\) return;/);
  assert.match(on, /ev\.defaultPrevented \|\| ev\.altKey \|\| ev\.ctrlKey \|\| ev\.metaKey\) return;/);
  assert.ok(!/\['1', '2', '3', '4'\]\.indexOf\(ev\.key\)/.test(src), '옛 판정(ev.key 만) 없음');
});

/* ══ Z2 시험일 당일 ═══════════════════════════════════════ */

test('Z2 ★ 시험일 당일 — 정렬 오늘 = 0 · viewStatus today · 서재 줄 today(지난 것 아님) · 4언어 문구 · ar 요일 칩 narrow', () => {
  const TODAY = '2026-11-18';
  const list = PU.examsOf([{ id: 'far', date: '2026-12-01' }, { id: 'past', date: '2026-11-10' }, { id: 'today', date: TODAY }, { id: 'near', date: '2026-11-19' }]);
  assert.deepEqual(PU.sortExams(list, TODAY).map((e) => e.id), ['today', 'near', 'far', 'past'], '★ 오늘 시험이 가장 가까움');
  assert.equal(PU.nearestExam(list, TODAY).id, 'today');
  // planFor 는 그대로(당일 = past · 공부할 날 0) — 화면만 갈라 본다
  const p = PP.planFor({ today: TODAY, exam: TODAY, remaining: 1 });
  assert.deepEqual([p.status, p.calendarDays], ['past', 0]);
  assert.equal(PU.viewStatus(p), 'today');
  assert.equal(PU.viewStatus(PP.planFor({ today: TODAY, exam: '2026-11-10', remaining: 1 })), 'past', '지난 날은 그대로 past');
  assert.equal(PU.viewStatus(PP.planFor({ today: TODAY, exam: '2026-11-28', remaining: 1000 })) !== 'today', true);
  const l = PU.libraryExamLine([{ id: 't', name: 'Cardio', date: TODAY }, { id: 'n', name: 'Next', date: '2026-11-30' }], TODAY);
  assert.deepEqual([l.exam.id, l.days, l.today, l.past], ['t', 0, true, false], '★ 서재 줄 — 당일은 today');
  const old = PU.libraryExamLine([{ id: 'o', name: 'Old', date: '2026-11-01' }], TODAY);
  assert.deepEqual([old.today, old.past], [false, true]);
  // 화면 배선 — 상태 칸 · 서재 줄 문구
  const pl = strip(read('../js/ui/planner.js'));
  assert.match(pl, /today: 'planner\.status\.today'/);
  assert.match(pl, /box\.setAttribute\('data-status', plan \? viewStatus\(plan\) : ''\);/);
  assert.match(pl, /status: viewStatus\(plan\),/);
  const lib = strip(read('../js/ui/library.js'));
  assert.match(lib, /p\.textContent = ex\.today \? t\('library\.todayExam\.today', \{ name: name \}\)/);
  for (const lang of LANGS) {
    for (const k of ['planner.status.today', 'library.todayExam.today']) assert.ok(typeof BUNDLES[lang][k] === 'string' && BUNDLES[lang][k], lang + ' ' + k);
    assert.ok(BUNDLES[lang]['library.todayExam.today'].includes('{name}'), lang);
    assert.notEqual(BUNDLES[lang]['planner.status.today'], BUNDLES[lang]['planner.status.past'], lang + ' 당일 문구는 "지났습니다"가 아니다');
  }
  assert.equal(BUNDLES.ko['planner.status.today'], '오늘 시험입니다.');
  // 요일 칩 — ar 는 short 가 칩보다 길어 narrow(일곱 모두 다름 · 한 글자) · 나머지 short · 온전한 이름은 aria-label(long)
  const ar = PU.dayChipLabels('ar');
  assert.equal(ar.style, 'narrow');
  assert.equal(new Set(ar.labels).size, 7, 'ar narrow 일곱이 서로 다르다');
  assert.ok(ar.labels.every((s) => Array.from(s).length <= PU.WD_CHIP_MAX), JSON.stringify(ar.labels));
  for (const lang of ['ko', 'en', 'fr']) {
    const x = PU.dayChipLabels(lang);
    assert.equal(x.style, 'short', lang);
    assert.ok(x.labels.every((s) => Array.from(s).length <= PU.WD_CHIP_MAX), lang + ' ' + JSON.stringify(x.labels));
  }
  assert.match(pl, /const chips = dayChipLabels\(\);/);
  assert.match(pl, /b\.setAttribute\('aria-label', wdName\(w, 'long'\)\);/);
});

/* ══ Z3 19 링크만 ═════════════════════════════════════════ */

test('Z3 ★ 19 링크만 — 추천에 Open-i 한 줄([확인 필요]) · 검사 통과 · [찾아보기] 주소 · 새 탭 rel · 앱 요청 0', () => {
  const o = LINKS.SUGGESTED.find((s) => s.id === 'openi');
  assert.deepEqual(Object.assign({}, o), { id: 'openi', name: 'Open-i (NLM)', url: 'https://openi.nlm.nih.gov/gridquery?q={q}&it=x', check: 'unverified' });
  assert.equal(TL.checkLink(o).ok, true);
  assert.equal(TL.hasQuery(o.url), true);
  assert.ok(!LINKS.DEFAULTS.some((d) => d.url === o.url), '기본 목록에는 없다(설정 [추천 링크 추가]에서만)');
  const plan = TL.lookupPlan(TL.effectiveLinks([{ id: 'openi', name: o.name, url: o.url }]), 'pleural effusion');
  assert.deepEqual(plan.targets.map((x) => x.href), ['https://openi.nlm.nih.gov/gridquery?q=pleural%20effusion&it=x']);
  assert.equal(LK.LINK_REL, 'noopener noreferrer');
  const lk = strip(read('../js/ui/links.js'));
  assert.match(lk, /a\.target = '_blank';/);
  assert.equal(fetchCalls, 0);
  // 앱 코드에 Open-i 로 가는 요청 길 없음(주소는 config 한 줄뿐)
  for (const f of ['../js/ui/links.js', '../js/text/links.js', '../js/ui/selbar.js']) assert.ok(!read(f).includes('openi.nlm'), f);
});

/* ══ Z4 isNoTrTerm 한 벌 ══════════════════════════════════ */

test('Z4 ui/cards.js 범위 거름 — 번역 빈 단어 판정은 srs/cards.js isNoTrTerm 하나(사본 0)', () => {
  const src = strip(read('../js/ui/cards.js'));
  const r = src.slice(src.indexOf('async function ranged('), src.indexOf('async function load('));
  assert.match(r, /isNew\(c\) && inPages\(c\) &&\s*!isNoTrTerm\(c\)\)/);
  assert.ok(!/kind === 'term'/.test(r), '규칙 사본 없음');
  assert.match(src, /import \{[^}]*\bisNoTrTerm\b[^}]*\} from '\.\.\/srs\/cards\.js';/);
  assert.equal(typeof SC.isNoTrTerm, 'function');
});

/* ══ Z5 영어로 남은 값 ════════════════════════════════════ */

test('Z5 fr·ko — 뒤로·취소·삭제가 영어 값이 아니다(fr Retour·Annuler·Supprimer · ko 뒤로·취소·삭제)', () => {
  const want = { fr: ['Retour', 'Annuler', 'Supprimer'], ko: ['뒤로', '취소', '삭제'] };
  for (const lang of ['fr', 'ko']) {
    assert.deepEqual(['nav.back', 'common.cancel', 'library.card.delete'].map((k) => BUNDLES[lang][k]), want[lang], lang);
    for (const k of ['nav.back', 'common.cancel', 'library.card.delete']) assert.notEqual(BUNDLES[lang][k], BUNDLES.en[k], lang + ' ' + k);
  }
});

/* ══ Z6a reattach 한 트랜잭션 ════════════════════════════ */

test('Z6a ★ [20-3R r1] reattach — 셋째 쓰기가 실패하면 하나도 옮기지 않는다(한 트랜잭션) · 정상이면 같은 PDF 고아만', async () => {
  let writes = 0;
  let failAt = 0;
  const wrap = (s) => {
    const o = Object.assign({}, s);
    if (s.annotations) {
      const real = s.annotations;
      o.annotations = new Proxy(real, { get(t, k) {
        if (k === 'put') return (v, key) => { writes++; if (failAt && writes === failAt) return t.put(Object.assign({}, v, { id: undefined })); return key === undefined ? t.put(v) : t.put(v, key); };
        const val = t[k]; return typeof val === 'function' ? val.bind(t) : val;
      } });
    }
    return o;
  };
  const dbx = Object.assign({}, db, {
    withTx: (names, mode, fn) => db.withTx(names, mode, (tx, s) => fn(tx, wrap(s))),
    put: (store, v, key) => { if (store === 'annotations') { writes++; if (failAt && writes === failAt) return db.put(store, Object.assign({}, v, { id: undefined })); } return db.put(store, v, key); }
  });
  const store = A.createAnnotationStore({ db: dbx, now: () => 1000, newId: (() => { let i = 0; return () => 'ann:z' + (++i); })() });
  async function seed() {
    await reset();
    await db.put('documents', { id: 'live', title: 'Live', fileHash: 'H1' });
    for (let i = 0; i < 6; i++) await db.put('annotations', { id: 'o' + i, kind: i === 5 ? 'summary' : 'highlight', docId: 'gone1', pageNo: 3, fileHash: 'H1', group: 'o' + i, note: '' });
    await db.put('annotations', { id: 'l1', kind: 'highlight', docId: 'live', pageNo: 3, fileHash: 'H1', group: 'l1', note: '' });
    await db.put('annotations', { id: 'x1', kind: 'highlight', docId: 'gone2', pageNo: 3, fileHash: 'H2', group: 'x1', note: '' });
    await db.put('documents', { id: 'new', title: 'Book', fileHash: 'H1' });
  }
  const snap = async () => (await all()).map((r) => r.id + '=' + r.docId).sort().join(',');
  await seed();
  const before = await snap();
  writes = 0; failAt = 3;
  let threw = false;
  try { await store.reattach('H1', 'new'); } catch (e) { threw = true; }
  assert.equal(threw, true, '실패를 알린다');
  assert.equal(await snap(), before, '★ 반쪽 상태 없음 — 셋째 쓰기 실패면 모두 그대로');
  assert.equal((await all()).filter((r) => r.docId === 'new').length, 0);
  failAt = 0; writes = 0;
  await seed();
  assert.equal(await store.reattach('H1', 'new'), 6);
  const by = new Map((await all()).map((r) => [r.id, r.docId]));
  assert.deepEqual([by.get('o0'), by.get('o5'), by.get('l1'), by.get('x1')], ['new', 'new', 'live', 'gone2'], '살아 있는 문서·다른 PDF 는 그대로');
});

/* ══ Z6b 내보내기 = 보이는 줄만 ══════════════════════════ */

test('Z6b ★ [20-3R r3] 필기 내보내기는 보이는 줄만 — doExport 가 visibleRows(거르기·범위) · 거른 줄만 Markdown 에', () => {
  const src = strip(read('../js/ui/notes.js'));
  const ex = src.slice(src.indexOf('function doExport()'), src.indexOf('function banner('));
  assert.match(ex, /const rows = visibleRows\(\);\s*const text = exportMarkdown\(viewBooks\(rows, S\.docs\), exportLabels\(\)\);/, '★ 내보낼 줄 = 화면에 보이는 줄');
  assert.match(ex, /rows: rows\.length/);
  assert.match(src, /function visibleRows\(\) \{\s*return filterRows\(scopedRows\(\), Object\.assign\(\{\}, S\.filter, \{ range: S\.range \}\), S\.lost, S\.live\);\s*\}/);
  // 같은 길(거르기 → 책 → Markdown)로 — 노랑만 · 위치 못 찾은 것만 · 쪽 범위
  const rec = (id, o) => Object.assign({ id: id, kind: 'highlight', docId: 'docA', pageNo: 12, fileHash: 'H1', docTitle: 'Book A', color: 'yellow', note: '',
    group: id, anchor: { start: { lineId: '12:1', off: 0 }, quote: { exact: 'quote ' + id } }, createdAt: 1, updatedAt: 1 }, o || {});
  const rows = NU.rowsOf([rec('y1'), rec('g1', { color: 'green' }), rec('y2', { pageNo: 30 }), rec('p1', { color: 'pink', pageNo: 5 })]);
  const md = (f, lost, live) => NU.exportMarkdown(NU.viewBooks(NU.filterRows(rows, f, lost, live), [{ id: 'docA', title: 'Book A' }]), {});
  const quotes = (s) => s.split('\r\n').filter((l) => l.startsWith('> ')).sort();
  assert.deepEqual(quotes(md({ colors: ['yellow'] })), ['> quote y1', '> quote y2']);
  assert.deepEqual(quotes(md({ lost: true }, new Set(['docA' + SOH + 'g1']), new Set(['docA']))), ['> quote g1']);
  assert.deepEqual(quotes(md({ range: { from: 10, to: 20 } })), ['> quote g1', '> quote y1']);
  assert.equal(quotes(md({})).length, 4);
});

/* ══ Z6c D5 묶음 — 찾히는 조각이 먼저 ═══════════════════ */

function descOf(paras, pageNo) {
  return {
    pageNo: pageNo || 12,
    blocks: paras.map((p) => {
      const lines = p.lines.map(([id, text]) => ({ id: id, text: text, hyphen: 'none' }));
      for (let i = 0; i < lines.length - 1; i++) {
        const r = joinHyphen(lines[i].text, lines[i + 1].text);
        lines[i].hyphen = r.hyphenJoin ? 'hidden' : (r.keptHyphen ? 'kept' : 'none');
      }
      return { type: 'para', id: p.id, kind: 'body', lines: lines };
    })
  };
}
const PA = { id: '12:p0', lines: [['12:1', 'Iron studies guide the workup of anemia in adults.'], ['12:2', 'Low ferritin confirms deficiency in most cases.']] };
const PB = { id: '12:p1', lines: [['12:3', 'Oral iron is first-line for most patients.'], ['12:4', 'Intravenous iron suits malabsorption.']] };

test('Z6c ★ [20-3R r5] 위치 못 찾은 줄 — 묶음의 찾히는 조각이 먼저·사라진 조각이 뒤여도 고아 아님(조각 순서 무관)', async () => {
  await reset();
  const D = descOf([PA, PB]);
  const at = (s) => indexOfDesc(D).idx.text.indexOf(s);
  let n = 0;
  const store = A.createAnnotationStore({ now: () => 1000, newId: () => 'ann:c' + (++n) });
  const two = await store.create({ docId: 'docA', pageNo: 12, desc: D, from: at('most cases'), to: at('Oral iron is') + 12, fileHash: 'H1' });
  assert.equal(two.length, 2, '문단 둘에 걸친 묶음 — 조각 둘');
  const recs = await store.list();
  assert.deepEqual(recs.map((r) => r.id), two.map((r) => r.id), '목록 순서 = 앞 조각(찾힘) → 뒤 조각(사라짐)');
  // 둘째 문단(PB)이 사라진 판 — 앞 조각만 찾힌다
  const lost = await NU.findLost(recs, new Set(['docA']), { load: async () => ({ desc: descOf([PA]) }) });
  assert.equal(lost.size, 0, '★ 찾히는 조각 하나면 그 줄은 고아가 아니다(마지막 조각만 보지 않는다)');
  // 둘 다 사라지면 고아
  const lost2 = await NU.findLost(recs, new Set(['docA']), { load: async () => ({ desc: descOf([{ id: '12:p9', lines: [['12:9', 'Nothing of the old text is here at all.']] }]) }) });
  assert.deepEqual([...lost2], ['docA' + SOH + two[0].group]);
});

/* ══ Z6d 3단 퍼즈 ═════════════════════════════════════════ */

test('Z6d ★ [8qbR #5] 3단 합성 퍼즈 400쪽 — 줄 수 = 아이템 수 · 아이템 글자(다중 집합) 보존 · 줄 id 겹침 0(섞인 밴드·상자·인용구·제목)', () => {
  const W = 612, H = 792, FS = 9;
  const WORDS = ['zorvat', 'mekil', 'plon', 'trasse', 'vendo', 'quilar', 'basto', 'renu', 'fimal', 'oskat', 'dreva', 'lumin', 'sarto', 'pekal', 'nivo', 'tarma', 'gessel', 'orvin'];
  let s = 20261118 >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const words = (k) => { const o = []; for (let i = 0; i < k; i++) o.push(WORDS[ri(0, WORDS.length - 1)]); return o.join(' '); };
  const item = (str, x, y, w, fs = FS) => ({ str, dir: 'ltr', transform: [fs, 0, 0, fs, x, y], width: w, height: fs, fontName: 'g_d0_f1', hasEOL: false });
  const COLS = [[40, 200], [222, 382], [404, 564]];
  let uid = 0;
  const three = (rows, y0, skip) => {
    const out = [];
    for (let c = 0; c < 3; c++) for (let i = 0; i < rows[c]; i++) {
      if (skip && skip(c, i)) continue;
      const [x0, x1] = COLS[c];
      const full = (i % 6) !== 5;
      out.push(item('c' + c + 'r' + String(i).padStart(2, '0') + 'u' + (++uid) + ' ' + words(5) + (full ? '' : '.'), x0, y0 - 12 * i, full ? x1 - x0 : (x1 - x0) * 0.45));
    }
    return out;
  };
  const page = () => {
    const k = ri(0, 3);
    const y0 = 690;
    if (k === 0) {                                     // 세 단 + 쪽 제목(반)
      const items = three([ri(18, 40), ri(18, 40), ri(18, 40)], y0);
      if (rnd() < 0.5) items.push(item('TITLE ' + words(5), 40, 715, 520, 16));
      return { k, items };
    }
    if (k === 1) {                                     // ★ 섞인 밴드: 단 1–2 소제목 + 단 0–1 상자(C3-15 꼴 — V4 가 줄을 잃는 곳)
      const r = ri(14, 22), m = ri(4, 10), b = ri(3, 10);
      const items = three([r, r, r + m + ri(0, 6)], y0, (c, i) => c > 0 && i === b);
      items.push(item('Bridge' + (++uid) + ' ' + words(4), 230, y0 - 12 * b, 330));
      for (let i = 0; i < m; i++) items.push(item('box' + i + 'u' + (++uid) + ' ' + words(7), 44, y0 - 12 * (r + 1 + i), 320));
      return { k, items };
    }
    if (k === 2) {                                     // 쪽 아래 단 0–1 상자
      const r = ri(14, 22), m = ri(4, 10);
      const items = three([r, r, r + m + ri(2, 8)], y0);
      for (let i = 0; i < m; i++) items.push(item('box' + i + 'u' + (++uid) + ' ' + words(7), 44, y0 - 12 * (r + 1 + i), 320));
      return { k, items };
    }
    const a = ri(8, 16);                               // 단 0–1 인용구(끼움)
    const items = three([30, 30, 30], y0, (c, i) => c < 2 && i >= a && i <= a + 2);
    for (let i = a; i <= a + 2; i++) { items.push(item('c0r' + i + 'u' + (++uid) + ' ' + words(2), 40, y0 - 12 * i, 70)); items.push(item('Pull' + i + 'u' + (++uid) + ' ' + words(4), 130, y0 - 12 * i, 240, 12)); }
    return { k, items };
  };
  const seen = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let tri = 0;
  for (let i = 0; i < 400; i++) {
    const p = page();
    const want = p.items.map((x) => x.str).sort();
    const L = buildPageLayout(JSON.parse(JSON.stringify(p.items)), { pageNo: 3, width: W, height: H, styles: {} }, LAYOUT);
    seen[p.k]++;
    if (L.columns.count === 3) tri++;
    const got = L.lines.flatMap((l) => l.items.map((x) => x.str)).sort();
    assert.equal(L.lines.length, p.items.length, '★ 줄 수 = 아이템 수(쪽 ' + i + ' 꼴 ' + p.k + ')');
    assert.deepEqual(got, want, '★ 아이템 글자 보존(쪽 ' + i + ' 꼴 ' + p.k + ')');
    assert.equal(new Set(L.lines.map((l) => l.id)).size, L.lines.length, '줄 id 겹침 0');
    assert.ok(L.lines.every((l) => l.items.length > 0), '빈 줄 0');
  }
  assert.ok(seen[1] >= 60, '섞인 밴드 꼴이 충분히 나온다: ' + seen[1]);
  assert.ok(tri >= 380, '대부분 3단 경로를 탄다: ' + tri);
});

/* ══ Z6e 링크 설정을 떠날 때 ═════════════════════════════ */

/** 아주 작은 가짜 DOM — links.js 가 쓰는 것만(polish-4 Q10 과 같은 꼴). */
function miniDoc() {
  const doc = { activeElement: null };
  class N {
    constructor(tag) { this.tagName = String(tag).toUpperCase(); this.nodeType = 1; this.childNodes = []; this.parentNode = null; this.attrs = new Map(); this.ls = {}; this._t = ''; this.hidden = false; this.disabled = false; this.type = ''; this.value = ''; this.style = {}; this.ownerDocument = doc; }
    get firstChild() { return this.childNodes[0] || null; }
    get children() { return this.childNodes; }
    appendChild(n) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.push(n); return n; }
    removeChild(n) { this.childNodes.splice(this.childNodes.indexOf(n), 1); n.parentNode = null; return n; }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
    setAttribute(k, v) { this.attrs.set(k, String(v)); }
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
    hasAttribute(k) { return this.attrs.has(k); }
    removeAttribute(k) { this.attrs.delete(k); }
    get id() { return this.getAttribute('id') || ''; }
    set id(v) { this.setAttribute('id', v); }
    get className() { return this.getAttribute('class') || ''; }
    set className(v) { this.setAttribute('class', v); }
    get classList() { const el = this; const l = () => el.className.split(/\s+/).filter(Boolean); return { add: (c) => { if (l().indexOf(c) < 0) el.className = l().concat(c).join(' '); }, contains: (c) => l().indexOf(c) >= 0 }; }
    get textContent() { return this._t + this.childNodes.map((c) => c.textContent).join(''); }
    set textContent(v) { this.childNodes = []; this._t = v == null ? '' : String(v); }
    set dir(v) { this.setAttribute('dir', v); }
    set tabIndex(v) { this.setAttribute('tabindex', v); }
    addEventListener(t, fn) { (this.ls[t] || (this.ls[t] = [])).push(fn); }
    removeEventListener(t, fn) { const a = this.ls[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
    dispatchEvent(ev) { for (const fn of (this.ls[ev.type] || []).slice()) fn(ev); return true; }
    focus() { doc.activeElement = this; }
    scrollIntoView() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
    matches(sel) { return match(this, sel); }
    closest(sel) { for (let x = this; x && x.nodeType === 1; x = x.parentNode) if (match(x, sel)) return x; return null; }
    querySelectorAll(sel) { const out = []; const w = (n) => { for (const c of n.childNodes) { if (match(c, sel)) out.push(c); w(c); } }; w(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  }
  const one = (el, s) => {
    const re = /^([a-z][a-z0-9]*)|#([A-Za-z0-9_-]+)|\.([A-Za-z0-9_-]+)|\[([a-z0-9_-]+)(?:="([^"]*)")?\]/gi;
    let x;
    while ((x = re.exec(s)) !== null) {
      if (x[1] && el.tagName !== x[1].toUpperCase()) return false;
      if (x[2] && el.getAttribute('id') !== x[2]) return false;
      if (x[3] && !el.classList.contains(x[3])) return false;
      if (x[4] && (!el.hasAttribute(x[4]) || (x[5] !== undefined && el.getAttribute(x[4]) !== x[5]))) return false;
    }
    return true;
  };
  function match(el, sel) {
    if (!el || el.nodeType !== 1) return false;
    if (sel.indexOf(',') >= 0) return sel.split(',').some((s) => match(el, s.trim()));
    const parts = sel.trim().split(/\s+/);
    if (!one(el, parts[parts.length - 1])) return false;
    let x = el.parentNode;
    for (let i = parts.length - 2; i >= 0; i--) { while (x && !(x.nodeType === 1 && one(x, parts[i]))) x = x.parentNode; if (!x) return false; x = x.parentNode; }
    return true;
  }
  doc.createElement = (t) => new N(t);
  doc.body = new N('body');
  doc.documentElement = doc.body;
  doc.getElementById = (id) => doc.body.querySelector('#' + id);
  doc.addEventListener = () => {};
  doc.removeEventListener = () => {};
  const mk = (tag, id, parent, attrs) => { const e = new N(tag); if (id) e.setAttribute('id', id); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); parent.appendChild(e); return e; };
  return { doc, mk };
}

test('Z6e ★ [P4cR R7] 설정 화면을 떠나면(leaveLinksSettings) 열린 링크 삭제 대화는 취소 길로 닫힌다 — 지움 0 · 리스너 0 · 돌아와 B 확인 → B 만', async () => {
  const S = await import('../js/settings.js');
  const savedDoc = globalThis.document;
  const { doc, mk } = miniDoc();
  const card = mk('div', 'settingsLinks', doc.body);
  mk('h2', null, card);
  mk('ul', 'linksEditList', card);
  mk('p', 'linksEditEmpty', card);
  const form = mk('div', 'linksForm', card); form.hidden = true;
  mk('input', 'linksName', form); mk('input', 'linksUrl', form); mk('p', 'linksErr', form);
  const sug = mk('div', 'linksSuggest', card); sug.hidden = true;
  mk('div', 'linksSuggestList', sug);
  const acts = mk('div', null, card, { class: 'row links-actions' });
  for (const a of ['add', 'suggest', 'reset']) mk('button', null, acts, { 'data-la': a });
  mk('p', 'linksMsg', card);
  const dlg = mk('dialog', 'linksDelDialog', card);
  mk('h2', 'linksDelTitle', dlg);
  mk('button', null, dlg, { 'data-dialog': 'cancel' });
  mk('button', null, dlg, { 'data-dialog': 'ok' });
  globalThis.document = doc;
  const tick = () => new Promise((r) => setTimeout(r, 15));
  try {
    S._setCacheForTest({ 'links.medical': [{ id: 'la', name: 'Site A', url: 'https://example.org/' }, { id: 'lb', name: 'Site B', url: 'https://example.net/' }, { id: 'lc', name: 'Site C', url: 'https://example.com/' }] });
    LK.initLinksSettings();
    LK.showLinksSettings('links');
    const press = (target) => { for (const fn of (card.ls.click || []).slice()) fn({ target: target, stopPropagation() {} }); };
    const rowBtn = (id) => card.querySelector('.links-row[data-id="' + id + '"] button[data-la="delete"]');
    press(rowBtn('la'));
    await tick();
    assert.equal(dlg.open, true, 'A 삭제 확인이 열렸다');
    let cancels = 0;
    dlg.addEventListener('cancel', () => { cancels++; });
    LK.leaveLinksSettings();           // 설정 화면 밖으로(서재 등)
    await tick();
    assert.equal(dlg.open, false, '★ 떠나면 대화가 닫힌다(숨은 :modal 0)');
    assert.equal(cancels, 1, '★ 취소 길(cancel 이벤트) — 그냥 close() 가 아니다');
    assert.deepEqual(S.get('links.medical').map((l) => l.id), ['la', 'lb', 'lc'], '취소 — 아무것도 안 지움');
    assert.equal((dlg.ls.click || []).length, 0, '기다리던 물음의 리스너가 남지 않는다');
    LK.showLinksSettings('links');
    press(rowBtn('lb'));
    await tick();
    const ok = dlg.querySelector('button[data-dialog="ok"]');
    for (const fn of (dlg.ls.click || []).slice()) fn({ target: ok, stopPropagation() {} });
    for (let i = 0; i < 5; i++) await tick();
    assert.deepEqual(S.get('links.medical').map((l) => l.id), ['la', 'lc'], '★ B 만 지워짐');
  } finally {
    globalThis.document = savedDoc;
  }
});

/* ══ Z6f 서재로 돌아왔을 때 초점 ═════════════════════════ */

test('Z6f ★ [P4bR 낮음-2] 서재로 돌아왔을 때 초점 — BODY·숨은 화면 안이면 첫 카드 첫 단추, 카드 없으면 [PDF 가져오기] · 보이는 곳이면 그대로', () => {
  const { doc, mk } = miniDoc();
  const lib = mk('section', null, doc.body, { 'data-screen': 'library' });
  const imp = mk('button', 'libraryImport', lib);
  const list = mk('div', 'docList', lib);
  const other = mk('section', null, doc.body, { 'data-screen': 'settings', hidden: '' });
  const hiddenBtn = mk('button', null, other);
  // 카드 없음 → [PDF 가져오기]
  assert.equal(LIB.landingTarget(doc.body, list, imp), imp);
  assert.equal(LIB.landingTarget(null, list, imp), imp);
  // 카드 둘 → 첫 카드의 첫 단추([계속])
  const c1 = mk('div', null, list, { class: 'card doc-card' });
  mk('h2', null, c1, { class: 'doc-title' });
  const a1 = mk('div', null, c1, { class: 'doc-actions' });
  const cont = mk('button', null, a1, { class: 'primary', 'data-action': 'continue' });
  mk('button', null, a1, { 'data-action': 'delete' });
  const c2 = mk('div', null, list, { class: 'card doc-card' });
  mk('button', null, mk('div', null, c2, { class: 'doc-actions' }), { 'data-action': 'continue' });
  assert.equal(LIB.landingTarget(doc.body, list, imp), cont, '★ BODY → 첫 카드 [계속]');
  assert.equal(LIB.landingTarget(hiddenBtn, list, imp), cont, '★ 숨은 화면 안에 남은 초점 → 첫 카드');
  assert.equal(LIB.landingTarget(imp, list, imp), null, '보이는 곳에 있으면 건드리지 않는다');
  assert.equal(LIB.landingTarget(cont, list, imp), null);
  const src = strip(read('../js/ui/library.js'));
  const show = src.slice(src.indexOf('export async function showLibrary()'), src.indexOf('export function landingTarget('));
  assert.match(show, /focusPending\(\);\s*focusLanding\(\);/, 'PDF 필요 카드 초점(focusPending)이 먼저');
  assert.match(src, /window\.addEventListener\('hashchange', \(\) => \{ navigated = true; \}\);/, '부팅 첫 화면이면 옮기지 않는다');
  // `[5b — P5R 낮음-3]` focusLanding 이 실제로 navigated 를 본다(리스너만 있고 검사가 빠지면 부팅 때도 옮긴다)
  const fl = src.slice(src.indexOf('function focusLanding()'), src.indexOf('function focusLanding()') + 400);
  assert.match(fl, /^function focusLanding\(\) \{\s*if \(!navigated \|\| !els \|\| !root \|\| root\.hidden \|\| typeof document === 'undefined'\) return;/);
  assert.match(src, /let navigated = false;/, '처음 값은 거짓(부팅)');
});

/* ══ Z7 다시 붙인 수 = 화면 셈 ═══════════════════════════ */

test('Z7 ★ [20-3R #4] 다시 붙인 뒤 "필기·요약 n건" = 묶음 수 + 요약 건(레코드 수 아님) · 셈 실패면 레코드 수 · 서재 배선', async () => {
  await reset();
  const store = A.createAnnotationStore({ now: () => 1000 });
  // 지운 문서(gone)의 같은 PDF(H1) 고아: 조각 둘짜리 묶음 g1 + 하나짜리 g2 + 조각 셋짜리 g3 + 요약 1 + 개요 1 = 레코드 8 · 건 5
  const hl = (id, group) => ({ id: id, kind: 'highlight', docId: 'gone', pageNo: 3, fileHash: 'H1', group: group, note: '', color: 'yellow' });
  for (const r of [hl('a1', 'a1'), hl('a2', 'a1'), hl('b1', 'b1'), hl('c1', 'c1'), hl('c2', 'c1'), hl('c3', 'c1')]) await db.put('annotations', r);
  await db.put('annotations', { id: 'sum:1', kind: 'summary', docId: 'gone', pageNo: 3, fileHash: 'H1' });
  await db.put('annotations', { id: 'out:1', kind: 'outline', docId: 'gone', pageNo: 3, fileHash: 'H1' });
  await db.put('documents', { id: 'new', title: 'Book', fileHash: 'H1' });
  const before = await LIB.noteUnits('new');
  assert.equal(before, 0);
  const moved = await store.reattach('H1', 'new');
  assert.equal(moved, 8, '레코드 8');
  const after = await LIB.noteUnits('new');
  assert.equal(after, 5, '건 = 필기 묶음 3 + 요약·개요 2');
  assert.equal(await store.count('new'), 3, '칩·필기 화면 셈(묶음)');
  assert.equal(LIB.reattachShown(moved, before, after), 5, '★ 상태 줄 수 = 5(레코드 8 아님)');
  assert.equal(LIB.reattachShown(4, 2, 2), 4, '셈을 못 읽음(차이 0) → 레코드 수(알림이 사라지지 않게)');
  assert.equal(LIB.reattachShown(0, 0, 3), 0, '옮긴 것 없음 → 0');
  assert.equal(LIB.reattachShown(2, 0, 9), 2, '차이가 옮긴 수보다 크면 옮긴 수(다른 쓰기가 끼어든 경우)');
  const lib = strip(read('../js/ui/library.js'));
  const imp = lib.slice(lib.indexOf('async function importFile('), lib.indexOf('function newDocument('));
  assert.match(imp, /const unitsBefore = await noteUnits\(doc\.id\);\s*try \{ moved = await annotationStore\(\)\.reattach\(doc\.fileHash, doc\.id\); \} catch \(e\) \{ moved = 0; \}\s*const shown = moved > 0 \? reattachShown\(moved, unitsBefore, await noteUnits\(doc\.id\)\) : 0;/);
  assert.match(imp, /t\('library\.import\.reattached', \{ n: formatNumber\(shown\) \}\)/);
});

/* ══ Z8 간격 단위 복수 ═══════════════════════════════════ */

test('Z8 ★ [12-3R] 간격 단위 — Intl.PluralRules 범주 키(ar 3–10 few · 11–99 many · fr 2 이상 other) · en·ko 그대로 · 4언어 키', () => {
  const tr = (k, p) => k + ':' + (p ? p.n : '');
  const key = (n, unit, lang) => CU.spanText({ n: n, unit: unit }, tr, lang).split(':')[0];
  assert.equal(key(10, 'min', 'ar'), 'cards.span.min.few', '★ ar «10 دقائق»');
  assert.equal(key(4, 'day', 'ar'), 'cards.span.day.few', '★ ar «4 أيام»');
  assert.equal(key(11, 'day', 'ar'), 'cards.span.day.many');
  assert.equal(key(1, 'day', 'ar'), 'cards.span.day', 'one → 기본 키');
  assert.equal(key(2, 'year', 'fr'), 'cards.span.year.other', '★ fr «2 ans»');
  assert.equal(key(1, 'year', 'fr'), 'cards.span.year', 'fr 1 → 기본 «an»');
  assert.equal(key(10, 'min', 'en'), 'cards.span.min');
  assert.equal(key(4, 'day', 'ko'), 'cards.span.day');
  const saved = I18N.getLang();
  try {
    I18N.setLang('ar');
    assert.ok(CU.spanText({ n: 10, unit: 'min' }).includes('دقائق'), CU.spanText({ n: 10, unit: 'min' }));
    assert.ok(CU.spanText({ n: 4, unit: 'day' }).includes('أيام'));
    assert.ok(CU.spanText({ n: 1, unit: 'day' }).includes('يوم'));
    I18N.setLang('fr');
    assert.ok(CU.spanText({ n: 2, unit: 'year' }).endsWith(' ans'), CU.spanText({ n: 2, unit: 'year' }));
    assert.ok(CU.spanText({ n: 1, unit: 'year' }).endsWith(' an'));
    I18N.setLang('ko');
    assert.equal(CU.spanText({ n: 4, unit: 'day' }), '4일');
  } finally { I18N.setLang(saved); }
  for (const lang of LANGS) {
    for (const u of ['min', 'hour', 'day', 'month', 'year']) for (const c of ['few', 'many']) assert.ok(BUNDLES[lang]['cards.span.' + u + '.' + c].includes('{n}'), lang + ' ' + u + '.' + c);
    assert.ok(BUNDLES[lang]['cards.span.year.other'].includes('{n}'));
  }
});

/* ══ Z9 개념도 라벨 단위 토큰 ════════════════════════════ */

test('Z9 ★ [다듬기 5b — P5R 중간-1] 단위 토큰은 끊지 않는다(9번 되돌림) — 붙여 쓴 비교 낱말이 뒤집힌 라벨(이상↔이하 · 미만↔초과 · 以上↔以下)은 버림', () => {
  // 9번(글자 체계가 바뀌는 곳에서 끊기)은 `mm이상` 을 `mm` 로 잘라 방향이 뒤집힌 라벨을 통과시켰다 → 되돌림(HEAD 12c245b 판 그대로).
  const u = (t) => NX.numberChunkUnits(t).map((x) => x.u);
  assert.deepEqual(u('프레드니손 40 mg을 투여'), ['mg을'], '★ 끊지 않음(조사째 — 보수 쪽)');
  assert.deepEqual(u('나트륨 135 mEq/L로 낮음'), ['meq/l로']);
  assert.deepEqual(u('종양 크기 5 mm이상'), ['mm이상'], '★ 비교 낱말이 단위 토큰에 남는다');
  assert.deepEqual(u('用量 5 mg以上'), ['mg以上']);
  assert.deepEqual(u('용량 2 mg/kg/일'), ['mg/kg/일']);
  assert.deepEqual(u('40 ملغ'), ['ملغ']);
  assert.deepEqual(u('40 mg/kg/day'), ['mg/kg/day']);
  assert.deepEqual(u('CD4 수치'), [null], '이름 속 숫자는 그대로');
  assert.ok(!/scriptOf|SCRIPTS/.test(read('../js/text/numexpr.js')), '끊기 코드 없음(HEAD 판)');
  // 개념도 라벨 판정(합성 응답 — 호출 0)
  const keptOf = (line, label) => {
    const pay = PR.diagramPayload({ points: [{ t: '질환 X 개요', sub: [{ t: line, sub: [] }, { t: '증상: 두통', sub: [] }] }, { t: '검사: 혈액 검사', sub: [] }] });
    const v = { title: '질환 X', nodes: [{ id: 'a', t: '질환 X', p: '1' }, { id: 'b', t: '두통', p: '1.2' }, { id: 'c', t: '혈액 검사', p: '2' }, { id: 'd', t: label, p: '1.1' }],
      edges: [{ a: 'a', b: 'b', r: 'sign', p: '1.2' }, { a: 'a', b: 'c', r: 'test', p: '2' }, { a: 'a', b: 'd', r: 'assoc', p: '1.1' }] };
    const r = PR.checkDiagramReply(pay, v, { withSrc: false });
    return r.state === 'ok' && r.value.nodes.some((n) => n.id === 'd');
  };
  // ★ P5R 중간-1 의 세 꼴 — 방향이 뒤집힌 라벨은 버린다(같은 꼴은 통과 — 버림이 방향 때문임을 보인다)
  assert.equal(keptOf('종양 크기 5 mm이상', '종양 크기 5 mm이하'), false, '★ 이상 → 이하 버림');
  assert.equal(keptOf('혈당 70 mg/dL미만', '혈당 70 mg/dL초과'), false, '★ 미만 → 초과 버림');
  assert.equal(keptOf('用量 5 mg以上', '用量 5 mg以下'), false, '★ 以上 → 以下 버림');
  assert.equal(keptOf('종양 크기 5 mm이상', '종양 크기 5 mm이상'), true, '같은 꼴은 통과');
  assert.equal(keptOf('用量 5 mg以上', '用量 5 mg以上'), true);
  // 조사 붙은 단위는 다시 정당 버림(보수 쪽 — 16-2bR 그대로)
  assert.equal(keptOf('프레드니손 40 mg을 투여', '프레드니손 40 mg'), false, '조사째 비교 — 버림(되돌림)');
  assert.equal(keptOf('나트륨 135 mEq/L로 낮음', '나트륨 135 mEq/L'), false);
  assert.equal(keptOf('프레드니손 40 mg을 투여', '프레드니손 40 g'), false, '단위 바뀜 — 버림');
  assert.equal(keptOf('나트륨 135 mEq/L로 낮음', '나트륨 135 mmol/L'), false, '단위 바뀜 — 버림');
  assert.equal(keptOf('용량 2 mg/kg/일 투여', '용량 2 mg/kg'), false, '★ 하루 몫 빠짐 — 버림');
  assert.equal(keptOf('프레드니손 40 mg을 투여', '프레드니손 400 mg'), false, '값 바뀜 — 버림');
});
