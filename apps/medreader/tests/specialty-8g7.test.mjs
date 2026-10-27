/* ============================================================
   tests/specialty-8g7.test.mjs — 8g-7 아랍어 진료과 이름으로 장 찾기 (spec 19-1-4 2-4 "8g-7 설계 뼈대"의 [N])

   P1  사전 무결성 — 표제어 54 · id 중복 없음 · 표제어마다 ar·en 별칭 ≥ 1 · 별칭이 일반 낱말뿐이 아님 ·
       접은 별칭이 다른 표제어로 가는 것은 의도된 공유 목록(`SHARED_ALIASES`)과 정확히 같다
   P2  아랍어 접기 — 타슈킬·타트윌·alef·ة·ى · 앞 ال 떼기(남는 글자 2자 이상) · 형용사꼴 어미
   P3  ★ 정규화 표 — Plan 합성 질의(표기 변형 포함) + 형용사꼴 → 기대 표제어 · 의도된 없음(الباطنة·الربو)
   P4  ★ 낱말 단위 · 가장 긴 별칭 우선("ارتفاع ضغط الدم" → 고혈압만, "دموية" 는 혈액이 아님)
   P5  제목 쪽 — 언어별 일반 어휘(en 어근 · fr · ko 별칭) · 4자 접두/3자 이하 낱말 전체 · 지어낸 제목
   P6  ★ "장" 묶음 — 합성 개요 픽스처(실물 제목 없음)로 · p:null 뺌 · 상한 · 폴백 목차도 같은 길
   P7  ★ 켜지는 조건 — 라틴 검색어 null · `domain:'general'` null · 모르는 책 언어 null · 짧은 검색어 null · 한글 검색어(영어 책)는 켜짐
   P8  ★ 라틴 검색어 결과 JSON = HEAD `c6352a4`(기준 `fixtures/latin-view-8g7.golden.json`) · 그 표본 모두 "장" 묶음 null
   P9  목차 탭 흐린 이름(UI 언어 ≠ 책 언어일 때만 · general 이면 없음)
   P10 i18n · 배선 소스 — 새 키 7 × 4 · 아랍어 scriptHint 의 언어 이름이 아랍어 · 순수 모듈(import 0) · 화면 배선
   ── `[8g-7b]` 8g-7 Review(review.md 8g7R-3·7·8) 손질 ──
   P11 ★ 중1 형용사꼴 접기 오탐 — 모호한 접은 꼴(사전에서 계산 = `معد`) · «الجهاز المعدي المعوي» → gi · «قرحة معدية»·«النزف المعدي» → 없음
   P12 ★ 중2 폴백 — 검색어 낱말이 별칭의 첫 낱말일 때만 · 넓이 상한 `FALLBACK_MAX`(R2) · «الأمراض الدموية» → heme · «الصحة»·«نقص» 없음
   P13 ★ R1 — "장" 묶음이 있으면 "찾지 못했습니다" 줄 없음(`emptyNotice`) · 배선
   P14 ★ 8g 조각 캐시 — 키에 정규화된 검색어 · 검색어를 바꾸면 앞 검색어의 조각(`<mark>`)을 쓰지 않음 · 배선
   P15 폴백 목차의 "장" 묶음 머리 — `fallback:true` · 목차 탭과 같은 키 `search.toc.fallback`
   P16 ★ 짧게 친 꼴 별칭 6개(뜻이 하나뿐인 것) · «الرجل»·«الجنسية» 는 더하지 않음 · 모호한 꼴·공유 키 늘지 않음
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

const sp = await import('../js/text/specialty.js');
const ui = await import('../js/ui/search.js');
const { BUNDLES } = await import('../js/i18n/index.js');
const { LATIN_QUERIES, latinViews, synthToc } = await import('./fixtures/latin-view-8g7.mjs');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ══ P1 사전 무결성 ══════════════════════════════════════════ */

test('P1 ★ 사전 무결성 — 54 표제어 · id 중복 없음 · ar·en 별칭 ≥ 1 · 공유는 의도된 목록뿐', () => {
  const S = sp.SPECIALTIES;
  assert.equal(S.length, 54, 'Plan 보고서 §3 표 54 표제어');
  assert.equal(new Set(S.map((c) => c.id)).size, S.length, 'id 중복 없음');
  for (const c of S) {
    assert.ok(c.ar.length >= 1, c.id + ' ar 별칭');
    assert.ok(c.en.length >= 1, c.id + ' en 일치 낱말');
    for (const a of [].concat(c.ar, c.ko, c.fr, c.en)) {
      assert.ok(a && a.trim() === a, c.id + ' 빈 별칭·앞뒤 공백: ' + a);
      assert.ok(sp.queryTokens(a).length >= 1, c.id + ' 별칭이 일반 낱말뿐: ' + a);
    }
  }
  // Plan 수(ar 151 · ko 114 · fr 106) — 표를 옮기며 빠지거나 더해진 것이 없다. `[8g-7b]` ar +2(gi «المعدي المعوي» · heme «الأمراض الدموية»)
  const n = (k) => S.reduce((a, c) => a + c[k].length, 0);
  assert.deepEqual([n('ar'), n('ko'), n('fr')], [159, 114, 106]);   // `[8g-7b]` +6 오케스트레이터 지시(P16)
  // 접은 별칭(검색어 쪽) → 둘 이상의 표제어는 의도된 공유만
  const multi = {};
  for (const e of sp.queryIndex()) if (e.ids.length > 1) multi[e.key] = e.ids.slice().sort();
  assert.deepEqual(multi, Object.fromEntries(Object.entries(sp.SHARED_ALIASES).map(([k, v]) => [k, v.slice()])));
  assert.ok(Object.isFrozen(sp.SPECIALTIES) && Object.isFrozen(sp.SPECIALTIES[0]) && Object.isFrozen(sp.SPECIALTIES[0].ar));
});

/* ══ P2 아랍어 접기 ══════════════════════════════════════════ */

test('P2 foldArabic · arabicToken — 타슈킬·타트윌·alef·ة·ى · 앞 ال(남는 2자 이상) · 형용사꼴 어미', () => {
  assert.equal(sp.foldArabic('القَلْبُ'), 'القلب', '타슈킬');
  assert.equal(sp.foldArabic('القـــلب'), 'القلب', '타트윌');
  assert.equal(sp.foldArabic('أإآٱ'), 'اااا', 'alef 넷');
  assert.equal(sp.foldArabic('رئة'), 'رئه', 'ة→ه');
  assert.equal(sp.foldArabic('الكلى'), 'الكلي', 'ى→ي');
  assert.equal(sp.foldArabic('Heart'), 'Heart', '아랍 문자 밖은 그대로');
  assert.equal(sp.arabicToken('القلب'), 'قلب');
  assert.equal(sp.arabicToken('والتوليد'), 'توليد');
  assert.equal(sp.arabicToken('للقلب'), 'قلب');
  assert.equal(sp.arabicToken(sp.foldArabic('ألم')), 'الم', '"ألم"(통증) 이 "م" 이 되지 않는다');
  assert.equal(sp.arabicToken(sp.foldArabic('الألم')), 'الم', '정관사 붙은 꼴과 같다');
  assert.equal(sp.arabicToken(sp.foldArabic('تنفسية')), 'تنفس', '…ية → 어근');
  assert.equal(sp.arabicToken(sp.foldArabic('التنفسي')), 'تنفس', '…ي → 어근');
  assert.equal(sp.arabicToken(sp.foldArabic('الكلية')), 'كلي', '남는 글자 3자 미만이면 꼬리 ي 를 두다');
  assert.equal(sp.arabicToken(sp.foldArabic('دموية')), 'دمو');
  assert.notEqual(sp.arabicToken(sp.foldArabic('دموية')), sp.arabicToken(sp.foldArabic('الدم')), '"دموية" 는 "دم" 이 아니다');
});

/* ══ P3 정규화 표 ════════════════════════════════════════════ */

// Plan(19-1-4 2-3)의 합성 질의 — 표기 변형 포함. Plan 이 못 찾은 형용사꼴 "تنفسية"·"قلبية" 는 이제 찾는다.
const PLAN_QUERIES = [
  ['أمراض الجهاز التنفسي', ['pulm']], ['امراض الجهاز التنفسى', ['pulm']], ['الأمراض الصدرية', ['pulm']], ['أمراض صدرية', ['pulm']],
  ['الصدرية', ['pulm']], ['قسم الصدرية', ['pulm']], ['طب الرئة', ['pulm']], ['تنفسية', ['pulm']],
  ['أمراض القلب', ['cardio']], ['قلبية', ['cardio']], ['القلب والأوعية', ['cardio', 'vasc']],   /* `[8g-7b]` vasc «الأوعية» 별칭으로 혈관도 */ ['ارتفاع ضغط الدم', ['htn']],
  ['الأوعية الدموية', ['vasc']], ['أمراض الدم', ['heme']], ['الكلى', ['nephro']], ['الكلية', ['nephro']],
  ['المسالك البولية', ['uro']], ['الغدد الصماء', ['endo']], ['الغدة الدرقية', ['thyroid']], ['السكري', ['dm']],
  ['الأمراض المعدية', ['id']], ['الأمراض الإنتانية', ['id']], ['الجلدية', ['derm']], ['الأمراض العصبية', ['neuro']],
  ['العصبية', ['neuro']], ['الطب النفسي', ['psych']], ['الأورام', ['onc']], ['الهضمية', ['gi']], ['جهاز هضمي', ['gi']],
  ['أمراض النساء والتوليد', ['gyn', 'obs']],
  ['الباطنة', []],   // 내과 = 책 전체 — 의도된 없음
  ['الربو', []]      // 질환 이름 — 사전 범위 밖(17-8-9 (나)·(라)의 몫)
];
// Build 가 더한 형용사꼴·표기(일반 규칙 — 어미 접기)
const ADJ_QUERIES = [
  ['هضمية', ['gi']], ['عصبي', ['neuro']], ['الأمراض التنفسية', ['pulm']], ['أمراض قلبية', ['cardio']], ['بولية', ['uro']],
  ['جلدي', ['derm']], ['نفسية', ['psych']], ['الأمراض الهضمية', ['gi']], ['القَلْب', ['cardio']], ['القـلب', ['cardio']],
  ['الأمراض الصدرية والتنفسية', ['pulm']], ['داء السكري', ['dm']]
];
// 다른 언어 질의(영어·프랑스어 책이 아닐 때 — 한국어 책이면 라틴, 영어 책이면 한글이 켜진다)
const OTHER_QUERIES = [
  ['호흡기내과', ['pulm']], ['심장 질환', ['cardio']], ['내과', []], ['pneumologie', ['pulm']], ['maladies respiratoires', ['pulm']],
  ['Respiratory diseases', ['pulm']], ['diabète', ['dm']], ['diabetes', ['dm']], ['중독', ['addict', 'tox']]
];

test('P3 ★ 정규화 표 — Plan 합성 질의 32(기대 표제어) + 형용사꼴 12 + 다른 언어 9', () => {
  assert.equal(PLAN_QUERIES.length, 32);
  for (const [q, want] of [].concat(PLAN_QUERIES, ADJ_QUERIES, OTHER_QUERIES)) {
    assert.deepEqual(sp.conceptsOfQuery(q), want, q);
  }
  // Plan 이 맞힌 27 + 형용사꼴 2 = 30 이 맞고, 의도된 없음 2 는 비어 있다
  const hit = PLAN_QUERIES.filter(([q, w]) => w.length && sp.conceptsOfQuery(q).length).length;
  assert.equal(hit, 30);
});

test('P3 알려진 한계 — 어근이 바뀌는 형용사꼴("كلوية")·질환 이름은 사전 밖(기록)', () => {
  assert.deepEqual(sp.conceptsOfQuery('كلوية'), []);
  assert.deepEqual(sp.conceptsOfQuery('الربو'), []);
  assert.deepEqual(sp.conceptsOfQuery('أمراض'), [], '일반 낱말만');
  assert.deepEqual(sp.conceptsOfQuery(''), []);
});

/* ══ P4 낱말 단위 · 가장 긴 별칭 우선 ══════════════════════════ */

test('P4 ★ 가장 긴 별칭 우선 — "ارتفاع ضغط الدم" → 고혈압만 · 끄면 혈액으로 샌다(변이 기준)', () => {
  assert.deepEqual(sp.conceptsOfQuery('ارتفاع ضغط الدم'), ['htn']);
  assert.deepEqual(sp.conceptsOfQuery('ارتفاع ضغط الدم', { longestFirst: false }), ['heme'], '짧은 별칭이 먼저 "دم" 을 차지하면 틀린 장');
  assert.deepEqual(sp.conceptsOfQuery('جارات الدرقية'), ['bone'], '부갑상선 — 갑상선(الدرقية)이 아님');
  assert.deepEqual(sp.conceptsOfQuery('هشاشة العظام'), ['bone'], '골다공증 — 정형(العظام)이 아님');
});

test('P4 ★ 낱말 단위 — 부분 문자열로 걸리지 않는다', () => {
  // `[8g-7b]` "دموية" 는 이제 heme 별칭 «الأمراض الدموية»(접은 꼴 `دمو`)로 혈액이다 — "دم"(부분 문자열)으로가 아니다
  assert.deepEqual(sp.queryMatches('دموية'), [{ id: 'heme', key: 'دمو' }], '"دموية" 는 `دم` 이 아니라 `دمو` 별칭으로');
  assert.ok(!sp.queryIndex().some((e) => e.key === 'دمو' && e.ids.length !== 1));
  assert.ok(!sp.conceptsOfQuery('الكالسيوم').includes('lytes'));
  assert.deepEqual(sp.conceptsOfQuery('الكالسيوم'), ['bone']);
  // 짧게 친 경우(별칭 일부) — 품은 별칭의 표제어, 넓으면(4개 이상) 없음
  assert.deepEqual(sp.conceptsOfQuery('ضغط'), ['htn']);
});

/* ══ P5 제목 쪽 ═════════════════════════════════════════════ */

test('P5 제목 쪽 — 언어별 일반 어휘 · 4자 이상 접두 / 3자 이하 낱말 전체 · 지어낸 제목', () => {
  const en = (t) => sp.conceptsOfTitle(t, 'en');
  assert.deepEqual(en('Diseases of the Lung'), ['pulm']);
  assert.deepEqual(en('Respiratory Medicine Basics'), ['pulm']);
  assert.deepEqual(en('Cardinal Signs'), [], '"cardinal" 은 cardio 어근이 아니다');
  assert.deepEqual(en('First Aid Basics'), [], '"aid" 는 "aids" 가 아니다');
  assert.deepEqual(en('Ear Care'), ['ent']);
  assert.deepEqual(en('Earache Notes'), [], '3자 어근은 낱말 전체');
  assert.deepEqual(en('Blood Pressure Control'), ['htn'], '"blood disorder" 는 이어진 두 낱말');
  assert.deepEqual(en('Blood Disorders Overview'), ['heme']);
  assert.deepEqual(en('Women’s Health'), ['gyn']);
  assert.deepEqual(en('Anti-infective Choices'), ['id'], '하이픈은 낱말 사이');
  assert.deepEqual(en('Liver & Pancreas'), ['liver', 'pancreas'], '여러 분야 제목은 여러 표제어');
  assert.deepEqual(sp.conceptsOfTitle('Pneumologie', 'fr'), ['pulm']);
  assert.deepEqual(sp.conceptsOfTitle('Appareil respiratoire', 'fr'), ['pulm'], '꼬리 s 접기');
  assert.deepEqual(sp.conceptsOfTitle('Maladies du cœur', 'fr'), ['cardio'], 'œ → oe');
  assert.deepEqual(sp.conceptsOfTitle('호흡기 질환', 'ko'), ['pulm']);
  assert.deepEqual(sp.conceptsOfTitle('간 질환', 'ko'), ['liver']);
  assert.deepEqual(sp.conceptsOfTitle('간호학 개론', 'ko'), [], '한 글자 별칭은 낱말 전체');
  assert.deepEqual(sp.conceptsOfTitle('Lung', 'und'), [], '모르는 언어는 없음');
  assert.deepEqual(sp.titleMatches('Topics in Cardiology: Heart', 'en'), [{ id: 'cardio', words: 'Cardiology', at: 2 }], '제목 안 가장 앞의 일치');
});

/* ══ P6 "장" 묶음 ═══════════════════════════════════════════ */

test('P6 ★ "장" 묶음 — 합성 개요: «الأمراض الصدرية» → 첫 줄이 호흡기 장 · 맞은 낱말 · 쪽', () => {
  const g = ui.chapterGroup('الأمراض الصدرية', synthToc(), { docLang: 'en' });
  assert.deepEqual(g, { ids: ['pulm'], words: ['Lung'], rows: [{ i: 1, t: '1. Lung and Respiratory Care', p: 2, d: 1, ids: ['pulm'] }] });
  const h = ui.chapterGroup('أمراض القلب', synthToc(), { docLang: 'en', domain: 'medical' });
  assert.equal(h.rows[0].t, '2. Heart Matters');
  assert.equal(h.rows[0].p, 5);
  const k = ui.chapterGroup('الكلى', synthToc(), { docLang: 'en' });
  assert.deepEqual(k.rows.map((r) => [r.i, r.d, r.p]), [[3, 2, 7]], '깊이 2 항목도');
  assert.equal(ui.chapterGroup('أمراض الدم', synthToc(), { docLang: 'en' }), null, '맞는 장이 없으면 묶음 없음');
  assert.equal(ui.chapterGroup('الباطنة', synthToc(), { docLang: 'en' }), null, '개념 없음');
  assert.equal(ui.chapterGroup('الأمراض الصدرية', null, { docLang: 'en' }), null, '목차 없음');
  assert.equal(ui.chapterGroup('الأمراض الصدرية', { items: [] }, { docLang: 'en' }), null);
});

test('P6 p:null 항목은 빼고 · 상한 CHAPTER_MAX · 폴백 목차(heading)도 같은 길 · 여러 개념 검색어', () => {
  const toc = { source: 'fallback', items: [{ t: 'Lung Basics', p: null, d: 1 }, { t: 'Lung Tests', p: 3, d: 1 }] };
  assert.deepEqual(ui.chapterGroup('الرئة', toc, { docLang: 'en' }).rows.map((r) => r.p), [3]);
  const many = { source: 'fallback', items: Array.from({ length: 45 }, (_, n) => ({ t: 'Lung part ' + (n + 1), p: n + 1, d: 1 })) };
  const g = ui.chapterGroup('الرئة', many, { docLang: 'en' });
  assert.equal(g.rows.length, ui.CHAPTER_MAX);
  assert.deepEqual(g.words, ['Lung'], '같은 낱말은 한 번(대소문자 무시)');
  const two = ui.chapterGroup('أمراض النساء والتوليد', { items: [{ t: 'Gynecologic Topics', p: 4, d: 1 }, { t: 'Obstetric Care', p: 9, d: 1 }] }, { docLang: 'en' });
  assert.deepEqual(two.rows.map((r) => r.p), [4, 9]);
  assert.deepEqual(two.ids, ['gyn', 'obs']);
  // 한국어 책 · 라틴 검색어(글자 체계가 다르다) — 같은 규칙
  const ko = ui.chapterGroup('pulmonology', { items: [{ t: '제3장 호흡기 질환', p: 30, d: 1 }] }, { docLang: 'ko' });
  assert.deepEqual(ko.rows.map((r) => r.p), [30]);
});

/* ══ P7 켜지는 조건 ═════════════════════════════════════════ */

test('P7 ★ 켜지는 조건 — 라틴(영어 책) 꺼짐 · general 꺼짐 · 모르는 언어 꺼짐 · 짧은 검색어 꺼짐 · 한글(영어 책) 켜짐', () => {
  assert.equal(ui.chapterGate('الأمراض الصدرية', 'en', undefined), true);
  assert.equal(ui.chapterGate('الأمراض الصدرية', 'en', 'medical'), true);
  assert.equal(ui.chapterGate('الأمراض الصدرية', 'en', 'general'), false, '어학 교재에 진료과 묶음이 뜨지 않게');
  assert.equal(ui.chapterGate('pulmonary', 'en', undefined), false);
  assert.equal(ui.chapterGate('pneumologie', 'fr', undefined), false);
  assert.equal(ui.chapterGate('الأمراض الصدرية', 'und', undefined), false);
  assert.equal(ui.chapterGate('ق', 'en', undefined), false, '검색어 규칙 밖(1자)');
  assert.equal(ui.chapterGate('호흡기', 'en', undefined), true);
  assert.equal(ui.chapterGate('الصدرية MI', 'en', undefined), false, '책 글자 체계가 섞이면 꺼짐(scriptMismatch 그대로)');
  assert.equal(ui.chapterGroup('الأمراض الصدرية', synthToc(), { docLang: 'en', domain: 'general' }), null);
  assert.equal(ui.chapterGroup('호흡기', synthToc(), { docLang: 'en' }).rows[0].p, 2);
});

/* ══ P8 라틴 검색어 결과 = HEAD ═════════════════════════════ */

test('P8 ★ 라틴 검색어 결과 JSON = HEAD c6352a4(엔진 결과·묶음·띠·통로) · 그 표본 모두 "장" 묶음 null', async () => {
  const golden = JSON.parse(read('./fixtures/latin-view-8g7.golden.json'));
  const now = await latinViews(new URL('../js/', import.meta.url));
  assert.equal(JSON.stringify(now), JSON.stringify(golden), '라틴 검색어의 결과 모형이 HEAD 와 바이트까지 같다');
  assert.ok(LATIN_QUERIES.length >= 20);
  assert.ok(now.reduce((a, x) => a + x.hits.length, 0) > 30, '표본이 적중을 낸다(빈 비교가 아님)');
  for (const q of LATIN_QUERIES) {
    assert.equal(ui.chapterGate(q, 'en', undefined), false, q);
    assert.equal(ui.chapterGroup(q, synthToc(), { docLang: 'en' }), null, q);
  }
  // 켜짐 조건만이 라틴 결과를 지킨다 — 사전은 이 낱말들을 안다(조건을 지우면 묶음이 생긴다: 변이 기준)
  assert.deepEqual(sp.conceptsOfQuery('pulmonary'), ['pulm']);
  assert.deepEqual(sp.conceptsOfQuery('heart'), ['cardio']);
});

/* ══ P9 목차 탭 흐린 이름 ═══════════════════════════════════ */

test('P9 목차 탭 흐린 이름 — UI 언어 ≠ 책 언어일 때만 · UI 언어 이름 · general 이면 없음', () => {
  assert.equal(ui.tocDictName('1. Lung and Respiratory Care', 'en', 'ar', undefined), 'أمراض الجهاز التنفسي');
  assert.equal(ui.tocDictName('1. Lung and Respiratory Care', 'en', 'ko', 'medical'), '호흡기내과');
  assert.equal(ui.tocDictName('1. Lung and Respiratory Care', 'en', 'en', undefined), '', 'UI 언어 = 책 언어');
  assert.equal(ui.tocDictName('1. Lung and Respiratory Care', 'en', 'ar', 'general'), '');
  assert.equal(ui.tocDictName('Liver & Pancreas', 'en', 'ar', undefined), 'الكبد · البنكرياس');
  assert.equal(ui.tocDictName('Front Matter', 'en', 'ar', undefined), '');
  assert.equal(sp.nameOf('pulm', 'fr'), 'pneumologie');
  assert.equal(sp.nameOf('nope', 'ar'), '');
});

/* ══ P10 i18n · 배선 ════════════════════════════════════════ */

test('P10 i18n — 새 키 7 × 4 · 아랍어 scriptHint 의 언어 이름이 아랍어(«بلغة English» 아님) · 자리표시자', () => {
  const NEW = ['search.group.chapters', 'search.dictFrom', 'search.toToc', 'search.langName.ar', 'search.langName.en', 'search.langName.fr', 'search.langName.ko'];
  for (const l of ['ar', 'en', 'fr', 'ko']) for (const k of NEW) assert.ok(BUNDLES[l][k], l + ' ' + k);
  assert.match(BUNDLES.ar['search.group.chapters'], /\{n\}/);
  for (const l of ['ar', 'en', 'fr', 'ko']) assert.match(BUNDLES[l]['search.dictFrom'], /\{q\}[\s\S]*\{to\}/, l);
  assert.equal(BUNDLES.ar['search.langName.en'], 'الإنجليزية');
  assert.ok(!/English/.test(BUNDLES.ar['search.scriptHint'].replace('{lang}', BUNDLES.ar['search.langName.en'])));
  assert.match(BUNDLES.ar['search.toToc'], /«الفهرس»/, '목차 탭 이름 그대로');
  assert.ok(BUNDLES.ar['search.toToc'].includes(BUNDLES.ar['search.tab.toc']));
  assert.ok(BUNDLES.ko['search.toToc'].includes(BUNDLES.ko['search.tab.toc']));
});

test('P10 배선 소스 — specialty.js 는 순수(import 0 · DOM·db 없음) · 화면은 켜짐 조건을 먼저 보고 목차를 읽는다 · innerHTML 없음', () => {
  const s = noComments(read('../js/text/specialty.js'));
  assert.ok(!/^\s*import\s/m.test(s) && !/\bimport\(/.test(s), 'import 0');
  assert.ok(!/\b(document|window|indexedDB|localStorage)\b/.test(s));
  const u = noComments(read('../js/ui/search.js'));
  assert.match(u, /from '\.\.\/text\/specialty\.js'/);
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(u));
  const fn = u.slice(u.indexOf('function currentChapters'), u.indexOf('function currentChapters') + 700);
  assert.ok(fn.indexOf('chapterGate') >= 0 && fn.indexOf('chapterGate') < fn.indexOf('loadChapToc'), '켜짐 조건 → 목차 읽기(라틴 검색어는 읽기 0)');
  assert.match(u, /ev\.target\.closest\('button\.search-chap'\)[\s\S]{0,300}tocJump\(p, true\)/, '"장" 줄 → tocJump');
  assert.match(u, /tt\.setAttribute\('dir', 'ltr'\);\s*tt\.setAttribute\('lang', lang\);\s*tt\.textContent = row\.t;/, '장 제목 dir=ltr · lang = 문서 언어');
  assert.match(read('../index.html'), /"\.\/js\/text\/specialty\.js": "\.\/js\/text\/specialty\.js\?v=[0-9a-f]{10}"/);
  // 버전은 그대로(19-1-4 2-4 DB·버전 무관)
  assert.match(read('../js/search/outline.js'), /export const OUTLINE_V = 1;/);
  assert.match(read('../js/ai/prompts.js'), /export const PROMPT_VERSION = 3;/);
});

/* ══ `[8g-7b]` P11 중1 — 형용사꼴 접기 오탐 ═════════════════════ */

test('P11 ★ 모호한 접은 꼴은 사전에서 계산된다 — 지금은 `معد` 하나(«المعدي» 위의 · «المعدية» 감염성) · 명사 겉꼴 «فيروس» 은 아님', () => {
  assert.deepEqual(sp.AMBIGUOUS_STEMS, ['معد']);
  assert.ok(Object.isFrozen(sp.AMBIGUOUS_STEMS));
  // 그 꼴만 든 별칭은 일반 낱말을 함께 요구한다(«الأمراض المعدية» → 키 "امراض معد")
  assert.deepEqual(sp.queryIndex().filter((e) => /معد/.test(e.key)).map((e) => [e.key, e.ids]).sort(),
    [['امراض معد', ['id']], ['معد معو', ['gi']]]);
});

test('P11 ★ «الجهاز المعدي المعوي» → gi(가장 긴 별칭) · «قرحة معدية»·«النزف المعدي»·«معدية» → 없음 · «الأمراض المعدية» → 감염 그대로', () => {
  const T = [
    ['الجهاز المعدي المعوي', ['gi']], ['أمراض معدية معوية', ['gi']], ['الجِهاز المَعِدي المِعَوي', ['gi']],
    ['قرحة معدية', []], ['النزف المعدي', []], ['معدية', []], ['المعدية', []], ['المعدي', []],
    ['الأمراض المعدية', ['id']], ['الامراض المعديه', ['id']], ['أمراض معدية', ['id']],
    ['الأمراض المعدية والطفيليات', ['id', 'parasite']]
  ];
  for (const [q, want] of T) assert.deepEqual(sp.conceptsOfQuery(q), want, q);
  // 모호하지 않은 형용사꼴은 명사 뒤에서도 그대로(일반 규칙 — 꾸밈말을 버리지 않는다)
  assert.deepEqual(sp.conceptsOfQuery('الفشل القلبي'), ['cardio']);
  assert.deepEqual(sp.conceptsOfQuery('النزف الهضمي'), ['heme', 'gi']);
  assert.deepEqual(sp.conceptsOfQuery('التهاب الكبد الفيروسي'), ['liver', 'viral'], 'viral «الفيروسية» 별칭(P16)');
  // "장" 묶음 — 위장관 장으로, 감염 장 아님
  const toc = { source: 'outline', items: [{ t: '17. Gastrointestinal Disorders', p: 600, d: 1 }, { t: '35. Common Problems in Infectious Diseases', p: 1268, d: 1 }] };
  assert.deepEqual(ui.chapterGroup('الجهاز المعدي المعوي', toc, { docLang: 'en' }).rows.map((r) => r.p), [600]);
  assert.equal(ui.chapterGroup('قرحة معدية', toc, { docLang: 'en' }), null);
  assert.deepEqual(ui.chapterGroup('الأمراض المعدية', toc, { docLang: 'en' }).rows.map((r) => r.p), [1268]);
});

/* ══ `[8g-7b]` P12 중2 — 짧게 친 경우(폴백) ═════════════════════ */

test('P12 ★ 폴백은 검색어 낱말이 별칭의 첫 낱말일 때만 — 꾸밈말(«الطبي»·«البشرية»·«الحيوية»)로 퍼지지 않음 · «ضغط»·«العناية» 는 남음', () => {
  for (const q of ['الطبي', 'البشرية', 'الحيوية']) assert.deepEqual(sp.conceptsOfQuery(q), [], q);
  assert.deepEqual(sp.queryMatches('ضغط'), [{ id: 'htn', key: 'ضغط دم' }], '«ضغط الدم» 의 첫 낱말');
  assert.deepEqual(sp.conceptsOfQuery('العناية'), ['icu'], '«العناية المركزة» 의 첫 낱말');
  // 여러 낱말 검색어는 별칭의 앞 낱말들(순서대로)이어야 한다
  assert.deepEqual(sp.conceptsOfQuery('ارتفاع ضغط'), ['htn'], '«ارتفاع ضغط الدم» 의 앞 두 낱말');
  assert.deepEqual(sp.conceptsOfQuery('ضغط ارتفاع'), [], '순서가 다르면 첫 낱말이 아니다');
});

test('P12 ★ R2 넓이 상한 — FALLBACK_MAX = 1 · 여러 분야 이름에 든 «الصحة»·«نقص»·«الغدة» 는 없음(상한을 풀면 퍼진다: 변이 기준)', () => {
  assert.equal(sp.FALLBACK_MAX, 1);
  for (const q of ['الصحة', 'نقص', 'الغدة']) assert.deepEqual(sp.conceptsOfQuery(q), [], q);
  // 넓이는 그 낱말을 품은 별칭 전부로 잰다 — «الصحة» 는 gyn·andro·sexual 세 분야의 첫 낱말
  const heads = sp.queryIndex().filter((e) => e.key.split(' ')[0] === 'صحه').map((e) => e.ids[0]).sort();
  assert.deepEqual(heads, ['andro', 'gyn', 'sexual']);
  const toc = { source: 'outline', items: [{ t: '20. Women’s Health Issues', p: 780, d: 1 }, { t: '47. Sexual & Gender Minority Health', p: 1693, d: 1 }] };
  assert.equal(ui.chapterGroup('الصحة', toc, { docLang: 'en' }), null);
});

test('P12 ★ heme «الأمراض الدموية» — 혈액 장 · 심장·혈관 장으로 새지 않음 · «الأوعية الدموية» 는 혈관 그대로', () => {
  for (const q of ['الأمراض الدموية', 'أمراض دموية', 'دموية']) assert.deepEqual(sp.conceptsOfQuery(q), ['heme'], q);
  assert.deepEqual(sp.conceptsOfQuery('الأوعية الدموية'), ['vasc']);
  assert.deepEqual(sp.conceptsOfQuery('القلب والأوعية الدموية'), ['cardio']);
  const toc = { source: 'outline', items: [{ t: '10. Coronary Artery Disease', p: 351, d: 1 }, { t: '14. Blood Vessel & Lymphatic Disorders', p: 493, d: 1 }, { t: '15. Blood Disorders', p: 521, d: 1 }] };
  assert.deepEqual(ui.chapterGroup('الأمراض الدموية', toc, { docLang: 'en' }).rows.map((r) => r.p), [521]);
});

/* ══ `[8g-7b]` P13 R1 — "찾지 못했습니다" 줄 ═════════════════════ */

test('P13 ★ R1 — "장" 묶음이 있으면 "찾지 못했습니다" 줄 없음 · 안내 줄은 글자 체계가 다를 때 · 화면이 그 함수를 쓴다', () => {
  assert.deepEqual(ui.emptyNotice(true, true), ['hint'], '아랍어 검색어 + "장" 묶음 → 안내만');
  assert.deepEqual(ui.emptyNotice(false, true), ['empty', 'hint']);
  assert.deepEqual(ui.emptyNotice(false, false), ['empty']);
  assert.deepEqual(ui.emptyNotice(true, false), []);
  const u = noComments(read('../js/ui/search.js'));
  assert.match(u, /emptyNotice\(!!currentChapters\(\), scriptMismatch\(m\.query, docLang\(S\.docId\)\)\)/, '빈 결과 줄 = emptyNotice(장 묶음 있음, 글자 체계 다름)');
  assert.equal((u.match(/isolated\('search\.empty', m\.query\)/g) || []).length, 2, '이 책 범위 1 + 서재 범위 1 — 이 책 범위는 emptyNotice 를 거친다');
});

/* ══ `[8g-7b]` P14 8g 조각 캐시 ═════════════════════════════════ */

test('P14 ★ 조각 캐시 키에 정규화된 검색어 — 검색어를 바꾸면 앞 검색어의 조각·<mark> 를 쓰지 않는다', () => {
  const text = 'Pulmonary Disorders and lung care';
  const cache = new Map();
  // 검색어 A 로 그 쪽·묶음의 조각을 둔다
  const kA = ui.snipQueryKey('Pulmonary');
  cache.set(ui.snipKey(kA, 'd1', 22, 'head'), ui.snipOf(text, 0, 9));
  assert.equal(cache.get(ui.snipKey(kA, 'd1', 22, 'head')).hit, 'Pulmonary');
  // 같은 책·쪽·묶음, 검색어 B → 캐시에 없다(옛 키 `d1|22|head` 였으면 A 의 <mark>Pulmonary</mark> 가 나왔다)
  const kB = ui.snipQueryKey('Disorders');
  assert.notEqual(kA, kB);
  assert.equal(cache.get(ui.snipKey(kB, 'd1', 22, 'head')), undefined);
  assert.equal(ui.snipOf(text, 10, 9).hit, 'Disorders', 'B 의 조각은 B 의 적중을 칠한다');
  // 정규화 — 공백·대소문자가 달라도 같은 적중이면 같은 키(다시 읽지 않는다) · 대문자 약어는 낱말 전체·대소문자 구분이라 다르다
  assert.equal(ui.snipQueryKey('  pulmonary '), kA);
  assert.equal(ui.snipQueryKey('beta blocker'), ui.snipQueryKey('Beta  Blocker'));
  assert.notEqual(ui.snipQueryKey('MI'), ui.snipQueryKey('mi'));
  assert.equal(ui.snipQueryKey('x'), '', '규칙 밖 검색어');
  assert.notEqual(ui.snipKey(kA, 'd1', 22, 'head'), ui.snipKey(kA, 'd1', 22, 'body'));
  assert.notEqual(ui.snipKey(kA, 'd1', 22, 'head'), ui.snipKey(kA, 'd2', 22, 'head'));
});

test('P14 배선 — 결과 줄은 지금 검색어 키로 찾고 · 읽은 조각은 그 줄을 그린 검색어 키가 지금 것일 때만 둔다 · 검색어가 바뀌면 비운다', () => {
  const u = noComments(read('../js/ui/search.js'));
  assert.match(u, /const qk = curSnipQ\(\);\s*rowQ\.set\(b, qk\);\s*const cached = S\.snips\.get\(snipKey\(qk, docId, row\.pageNo, row\.kind\)\);/);
  assert.match(u, /if \(rowQ\.get\(row\) === S\.snipQ\) S\.snips\.set\(snipKey\(S\.snipQ, keys\[i\]\[0\], keys\[i\]\[1\], kind\), sn\);/);
  assert.match(u, /if \(qk !== S\.snipQ\) \{ S\.snips\.clear\(\); S\.snipQ = qk; \}/);
  assert.equal((u.match(/S\.snips\.(get|set)\(/g) || []).length, 2, '캐시를 쓰는 곳은 두 곳뿐');
});

/* ══ `[8g-7b]` P15 폴백 목차의 "장" 묶음 머리 ═══════════════════ */

test('P15 폴백 목차(개요 없는 책)에서 나온 "장" 묶음 — fallback:true · 개요에서 나온 묶음엔 그 키 없음 · 머리에 search.toc.fallback', () => {
  const fb = ui.chapterGroup('الرئة', { source: 'fallback', items: [{ t: 'Lung Tests', p: 3, d: 1 }] }, { docLang: 'en' });
  assert.equal(fb.fallback, true);
  const ol = ui.chapterGroup('الرئة', synthToc(), { docLang: 'en' });
  assert.ok(!('fallback' in ol), '개요 묶음 모형은 8g-7 그대로');
  const u = noComments(read('../js/ui/search.js'));
  const fn = u.slice(u.indexOf('function chapterSection'), u.indexOf('function pageText('));
  assert.match(fn, /if \(ch\.fallback\) appendNote\(sec, t\('search\.toc\.fallback'\)\);/, '목차 탭 머리와 같은 키');
  assert.ok(fn.indexOf("t('search.toc.fallback')") < fn.indexOf('search-dict'), '머리 바로 아래(사전 줄 위)');
  for (const l of ['ar', 'en', 'fr', 'ko']) assert.ok(BUNDLES[l]['search.toc.fallback'], l);
});

/* ══ `[8g-7b]` P16 오케스트레이터 지시 — 뜻이 하나뿐인 짧은 꼴 별칭 6개 ═══════ */

test('P16 ★ 별칭 6개 `[검토 — Nour·운영자]` — 짧게 친 꼴이 그 분야로 · 뜻이 둘인 «الرجل»·«الجنسية» 는 더하지 않음(없음 그대로)', () => {
  const T = [['الجرثومية', ['bact']], ['الفطرية', ['fungal']], ['الأذن', ['ent']], ['المرأة', ['gyn']], ['الأوعية', ['vasc']], ['الفيروسية', ['viral']]];
  for (const [q, want] of T) assert.deepEqual(sp.conceptsOfQuery(q), want, q);
  for (const [q, [id]] of T) assert.ok(sp.SPECIALTIES.find((c) => c.id === id).ar.includes(q), id + ' 별칭 ' + q);
  // 더하지 않은 것 — 뜻이 둘(남자/다리 · 성/국적)
  assert.deepEqual(sp.conceptsOfQuery('الرجل'), []);
  assert.deepEqual(sp.conceptsOfQuery('الجنسية'), []);
  assert.ok(!sp.SPECIALTIES.some((c) => c.ar.includes('الرجل') || c.ar.includes('الجنسية') || c.ar.includes('فيروس')));
  // «فيروس» 는 별칭으로 더하지 않았지만 «الفيروسية» 와 접은 꼴(`فيروس`)이 같아 바이러스로 간다 — 틀린 장 아님(기록)
  assert.deepEqual(sp.conceptsOfQuery('فيروس'), ['viral']);
  // 새 별칭이 모호한 꼴을 만들지 않고, 여러 표제어로 가는 키도 늘지 않는다(P1 과 같은 기준)
  assert.deepEqual(sp.AMBIGUOUS_STEMS, ['معد']);
  for (const k of ['جرثوم', 'فطر', 'اذن', 'مراه', 'اوع', 'فيروس']) {
    assert.deepEqual(sp.queryIndex().filter((e) => e.key === k).map((e) => e.ids), [[{ جرثوم: 'bact', فطر: 'fungal', اذن: 'ent', مراه: 'gyn', اوع: 'vasc', فيروس: 'viral' }[k]]], k);
  }
  // 긴 별칭은 그대로 이긴다
  assert.deepEqual(sp.conceptsOfQuery('الأوعية الدموية'), ['vasc']);
  assert.deepEqual(sp.conceptsOfQuery('القلب والأوعية الدموية'), ['cardio']);
  assert.deepEqual(sp.conceptsOfQuery('الأنف والأذن والحنجرة'), ['ent']);
  assert.deepEqual(sp.conceptsOfQuery('فيروس نقص المناعة البشرية'), ['hiv']);
});
