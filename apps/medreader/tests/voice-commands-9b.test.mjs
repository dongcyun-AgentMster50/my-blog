/* ============================================================
   tests/voice-commands-9b.test.mjs — 9b-1 음성 명령: 정규화 · 동의어 표 · 매칭 (spec 17-1-2 4·9·10절)

   C1  ★ V1 정규화 표 — 타슈킬·타트윌·أإآٱ/ى/ة/ؤ/ئ·아랍·페르시아 숫자·문장부호·라틴 소문자·군말(남는 낱말 ≥ 1)
   C2  ★ V1 한 벌 — `text/specialty.js` 의 `foldArabic` 를 import 해서 쓴다(드문 타슈킬·ٱ 까지 같은 결과 + 소스)
   C3  ★ V2 표 무결성 — id 11 · 꺼진 명령 0(`[11-4]` explain 켬) · 정규화 꼴이 두 명령에 겹치는 것 = `SHARED_FORMS`(지금 없음) ·
       exact 낱말은 표 안에 · 동의어 끝에 군말·숫자 없음
   C4  ★ V2 전수 — 모든 동의어가 자기 명령으로 전체 일치(ar·차용어 = ar 모드, en = en 모드 + ar 모드 두 번째 표)
   C5  ★ V2 exact 낱말은 문장 속에서 무시(«بس هيك»·«يلا يا جماعة»·«go now»)
   C6  ★ V3 포함 일치 — 가장 긴 구 · 같은 길이 다른 명령 = 모호 · 낱말 일부 일치 없음 · 숫자 떼기
   C7  ★ V4 대안 — 셋째에서 맞음(altIndex 2) · 다섯 모두 실패 = nomatch(첫 대안 글자) · 여섯째는 안 봄 · 확신도 무관
   C8  명령 언어 — auto/ar/en · ar 모드는 라틴 영어도(두 번째 표) · en 모드는 아랍 문자 차용어를 받지 않음
   C9  explain — 9b: 꺼진 명령은 nomatch 가 아니라 `{id:'explain', enabled:false}` → `[11-4]` 켰다: 같은 id · `enabled:true`
   C10 속도 계단 `stepRate` — 한 칸 · 끝에서 edge · 계단 밖 값은 가까운 계단으로
   C11 import 방향(3-2) — commands.js 는 text/specialty.js · config.js 만
   ── `[9b-2]` 오탐 규칙(운영자 결정 2026-11-15) · 9b-1 Review 말뭉치(`r9b1/corpus.mjs`·`neg.mjs` — 짧은 발화라 원문 그대로)
   C12 ★ 말뭉치 — 명령 → 맞는 명령(놓침 0 · 혼동 0)
   C13 ★ 말뭉치 — 명령 아님 → null(남은 오탐 = 목록과 정확히 같다 — 3낱말 이하 한 낱말 동의어, `[검토 — Nour]`)
   C14 ★ 부정문 → null(결정 ②) · 부정어가 동의어 안이면 그 명령 · `[9b-3]` Rb — 부정된 대안을 맞은 대안보다 먼저 만나면 누름 전체 무효
   C15 ★ 결정 ① — 한 낱말 동의어 포함 일치는 말 전체 ≤ PART_MAX_WORDS · 두 낱말 이상 동의어는 길이 무관 · 두 명령 문장
   ── `[9b-3]` 다듬기(9b-2 Review 9b2R-3·9b2R-9 중-1·중-2 · 운영자 결정 2026-11-15 Rb 채택)
   C16 ★ Rb 표 — 대안 순서별 결과(["لا توقف","توقف"] → null · ["توقف","لا توقف"] → pause · 모호·none 뒤 부정 → null …)
   C17 ★ 반대 뜻 낱말 exact("slow"·«بطيء») · «بلاش» 부정어 · 쉬운 동의어(«أوقف» · "stop/turn off the translation")
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  normalizeUtterance, normalizeBase, matchCommand, VOICE_COMMANDS, COMMAND_IDS, SHARED_FORMS, FILLERS,
  MAX_ALTS, resolveCmdLang, stepRate, commandById, tablesFor, NEGATORS, PART_MAX_WORDS
} from '../js/voice/commands.js';
import { foldArabic } from '../js/text/specialty.js';
import { TTS, VOICE } from '../js/config.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ══ C1 정규화 표 ══════════════════════════════════════════ */

const NORM = [
  // [입력, 기대]
  ['تَشْغِيل', 'تشغيل'],
  ['شغّل', 'شغل'],
  ['التاليـــة', 'التاليه'],                 // 타트윌 · ة→ه
  ['أعِدْ', 'اعد'],                           // أ→ا · 타슈킬
  ['إيقاف مؤقت', 'ايقاف موقت'],              // إ→ا · ؤ→و
  ['آ أ إ ٱ', 'ا ا ا ا'],
  ['استنى', 'استني'],                         // ى→ي
  ['أبطئ', 'ابطي'],                           // ئ→ي
  ['التالي ٣', 'التالي 3'],                   // 아랍·인도 숫자
  ['۰۱۲۳۴۵۶۷۸۹', '0123456789'],               // 페르시아 숫자
  ['٠١٢٣٤٥٦٧٨٩', '0123456789'],
  ['NEXT!', 'next'],
  ['«التالي»؟', 'التالي'],
  ['التالي، السابق.', 'التالي السابق'],
  ['قف؛ الآن…', 'قف الان'],
  ['"stop" - \'now\'', 'stop now'],
  ['  وقف    الترجمة  ', 'وقف الترجمه'],
  ['ﻻ', 'لا'],                                 // NFKC — 라무알리프 합자
  // 군말 — 앞뒤만, 떼고 남는 낱말 ≥ 1
  ['من فضلك التالي', 'التالي'],
  ['التالي لو سمحت', 'التالي'],
  ['يا طيب التالي رجاء', 'التالي'],
  ['please next ok', 'next'],
  ['Hey, okay, faster please!', 'faster'],
  ['من فضلك', 'من فضلك'],                     // 군말뿐 — 남겨 둔다
  ['ok', 'ok'],
  ['التالي يا التالي', 'التالي يا التالي'],    // 가운데 군말은 떼지 않는다
  ['', ''],
  ['  ', '']
];

test('C1 ★ V1 정규화 표', () => {
  for (const [inp, want] of NORM) assert.equal(normalizeUtterance(inp), want, JSON.stringify(inp));
  assert.equal(normalizeUtterance(null), '');
  assert.equal(normalizeUtterance(undefined), '');
});

/* ══ C2 foldArabic 한 벌 ═══════════════════════════════════ */

test('C2 ★ V1 한 벌 — foldArabic(text/specialty.js) 와 같은 접기, import 해서 쓴다', () => {
  // 드문 표시(U+0610 ؐ · U+06D6 ۖ · U+0670 ٰ)와 ٱ 까지 — 따로 만든 접기는 여기서 갈린다.
  const samples = ['قؐفٰۖ', 'ٱلتالي', 'الجُمْلَةُ التَّالِيَةُ', 'إعادة', 'على مهل', 'ﻻ', 'تـــابـــع'];
  for (const s of samples) {
    assert.equal(normalizeBase(s), foldArabic(s).replace(/\s+/g, ' ').trim(), s);
  }
  assert.equal(normalizeUtterance('قؐفٰۖ'), 'قف');
  const src = noComments(read('../js/voice/commands.js'));
  assert.match(src, /import\s*\{\s*foldArabic\s*\}\s*from\s*'\.\.\/text\/specialty\.js'/);
  assert.ok(/foldArabic\(/.test(src), 'foldArabic 를 부른다');
  assert.ok(!/normalize\(\s*'NFKC'\s*\)/.test(src), '접기를 따로 만들지 않는다(NFKC 는 foldArabic 안에)');
});

/* ══ C3 표 무결성 ══════════════════════════════════════════ */

function allSynonyms(c) { return c.ar.concat(c.arLoan, c.en); }

test('C3 ★ V2 표 무결성 — id · 켜짐 · 겹침 = SHARED_FORMS · exact 는 표 안 · 군말·숫자 없음', () => {
  // `[11-2 — spec 17-2-1 4-5 · 11-D11]` `summarize` 를 explain 앞에 더했다(표 무결성 규칙은 그대로 — 아래 겹침·exact·군말·숫자).
  assert.deepEqual(COMMAND_IDS, ['play', 'pause', 'next', 'prev', 'again', 'trOn', 'trOff', 'slower', 'faster', 'summarize', 'explain']);
  assert.equal(new Set(COMMAND_IDS).size, COMMAND_IDS.length, 'id 중복');
  // `[11-4 — spec 17-2-1 4-5 · 9b-D14]` explain 을 켰다 — 꺼진 명령 0(id 목록·낱말·겹침 규칙은 그대로).
  assert.deepEqual(VOICE_COMMANDS.filter((c) => !c.enabled).map((c) => c.id), []);
  assert.equal(MAX_ALTS, 5);

  // 같은 정규화 꼴 → 명령 집합
  const owners = new Map();
  for (const c of VOICE_COMMANDS) {
    assert.ok(c.ar.length >= 1 && c.en.length >= 1, c.id + ': ar·en 동의어 ≥ 1');
    for (const s of allSynonyms(c)) {
      const f = normalizeBase(s);
      assert.ok(f, c.id + ': 빈 동의어');
      if (!owners.has(f)) owners.set(f, new Set());
      owners.get(f).add(c.id);
    }
    for (const e of c.exact) {
      assert.ok(allSynonyms(c).indexOf(e) >= 0, c.id + ': exact «' + e + '» 가 표에 없다');
    }
  }
  const shared = {};
  for (const [f, ids] of owners) if (ids.size > 1) shared[f] = Array.from(ids).sort();
  assert.deepEqual(shared, SHARED_FORMS, '의도하지 않은 겹침(같은 동의어가 두 명령에)');

  for (const c of VOICE_COMMANDS) {
    for (const s of allSynonyms(c)) {
      assert.equal(normalizeUtterance(s), normalizeBase(s), c.id + ': «' + s + '» 끝에 군말 — 정규화가 떼어 버린다');
      assert.ok(!/[0-9٠-٩۰-۹]/.test(s), c.id + ': 동의어에 숫자');
    }
    // 차용어는 아랍 문자, 영어는 라틴 문자
    for (const s of c.arLoan) assert.ok(/\p{Script=Arabic}/u.test(s) && !/[a-z]/i.test(s), s);
    for (const s of c.en) assert.ok(/^[a-z ]+$/.test(s), s);
    for (const s of c.ar) assert.ok(/\p{Script=Arabic}/u.test(s) && !/[a-z]/i.test(s), s);
  }
  // 군말은 동의어가 아니다
  for (const f of FILLERS) assert.ok(!owners.has(normalizeBase(f)), '군말 «' + f + '» 가 동의어');
});

test('C3b 표는 얼어 있다', () => {
  assert.ok(Object.isFrozen(VOICE_COMMANDS) && Object.isFrozen(VOICE_COMMANDS[0]) && Object.isFrozen(VOICE_COMMANDS[0].ar));
});

/* ══ C4 전수 ═══════════════════════════════════════════════ */

test('C4 ★ V2 전수 — 모든 동의어가 자기 명령으로 전체 일치', () => {
  let n = 0;
  for (const c of VOICE_COMMANDS) {
    for (const s of c.ar.concat(c.arLoan)) {
      const r = matchCommand([s], 'ar');
      assert.equal(r.id, c.id, 'ar «' + s + '»');
      assert.equal(r.how, 'full', s);
      assert.equal(r.table, 'ar', s);
      assert.equal(r.altIndex, 0);
      n++;
    }
    for (const s of c.en) {
      const r = matchCommand([s], 'en');
      assert.equal(r.id, c.id, 'en «' + s + '»');
      assert.equal(r.how, 'full', s);
      const r2 = matchCommand([s], 'ar');        // 아랍어 인식기가 라틴 글자로 돌려준 경우(9b-D5)
      assert.equal(r2.id, c.id, 'ar 모드 라틴 «' + s + '»');
      assert.equal(r2.table, 'en', s);
      n++;
    }
    // 대문자·문장부호·군말이 붙어도
    const s0 = c.en[0];
    assert.equal(matchCommand(['Please, ' + s0.toUpperCase() + '!'], 'en').id, c.id);
  }
  assert.ok(n >= 100, '동의어 수가 이상하게 적다: ' + n);
});

/* ══ C5 exact ══════════════════════════════════════════════ */

test('C5 ★ V2 exact 낱말 — 혼자면 그 명령, 문장 속에서는 무시', () => {
  const neutral = { ar: 'هيك', en: 'now' };
  for (const c of VOICE_COMMANDS) {
    for (const e of c.exact) {
      const lang = /[a-z]/i.test(e) ? 'en' : 'ar';
      assert.equal(matchCommand([e], lang).id, c.id, '혼자 «' + e + '»');
      const r = matchCommand([e + ' ' + neutral[lang]], lang);
      assert.equal(r.id, null, '문장 속 «' + e + '» 가 ' + r.id + ' 로 갔다');
      const r2 = matchCommand([neutral[lang] + ' ' + e], lang);
      assert.equal(r2.id, null, '문장 속(뒤) «' + e + '»');
    }
  }
  // 대표 사례(spec 4절)
  assert.equal(matchCommand(['بس هيك'], 'ar').id, null);          // «بس» = "그러나"
  assert.equal(matchCommand(['يلا يا جماعة'], 'ar').id, null);
  assert.equal(matchCommand(['بس'], 'ar').id, 'pause');
  assert.equal(matchCommand(['يلا'], 'ar').id, 'play');
  assert.equal(matchCommand(['الترجمة'], 'ar').id, 'trOn');
  assert.equal(matchCommand(['الترجمة هون'], 'ar').id, null);
  // exact 낱말 + 다른 명령 = 그 다른 명령(exact 는 후보가 아니다)
  assert.equal(matchCommand(['خلص التالي'], 'ar').id, 'next');
  assert.equal(matchCommand(['wait go back'], 'en').id, 'prev');
});

/* ══ C6 포함 일치 ══════════════════════════════════════════ */

test('C6 ★ V3 가장 긴 구 · 모호 · 낱말 일부 없음 · 숫자 떼기', () => {
  const cases = [
    // [말, lang, 기대 id, how]
    ['وقف الترجمة', 'ar', 'trOff', 'full'],
    ['شغل الترجمة', 'ar', 'trOn', 'full'],
    ['لو سمحت وقف الترجمة هلأ', 'ar', 'trOff', 'part'],     // «وقف»(pause) 를 이긴다
    ['شغل الترجمة هلأ', 'ar', 'trOn', 'part'],              // «شغل»(play) 를 이긴다
    ['ممكن إيقاف الترجمة', 'ar', 'trOff', 'part'],          // «إيقاف»(pause) 를 이긴다
    ['اسرع شوي كمان', 'ar', 'faster', 'part'],
    ['شوي شوي', 'ar', 'slower', 'full'],
    ['ارجع هلأ', 'ar', 'prev', 'part'],
    ['please stop translation now', 'en', 'trOff', 'part'],  // stop(pause) 를 이긴다
    ['can you go back', 'en', 'prev', 'part'],
    ['read again', 'en', 'again', 'full'],
    ['slow down a bit', 'en', 'slower', 'part'],
    // 숫자 — 떼고 한 번(9b-D6)
    ['التالي ٣', 'ar', 'next', 'full'],
    ['التالي٢', 'ar', 'next', 'full'],
    ['ارجع ۲ مرات', 'ar', 'prev', 'part'],
    ['next 2', 'en', 'next', 'full'],
    ['3 back', 'en', 'prev', 'full']
  ];
  for (const [s, lang, id, how] of cases) {
    const r = matchCommand([s], lang);
    assert.equal(r.id, id, '«' + s + '» → ' + r.id);
    assert.equal(r.how, how, '«' + s + '» how');
  }
  // 같은 길이 다른 명령 → 모호(무효)
  for (const [s, lang] of [['التالي السابق', 'ar'], ['التالي و السابق', 'ar'], ['next previous', 'en'],
    ['faster slower', 'en'], ['stop play', 'en'], ['شغل الترجمة وقف الترجمة', 'ar']]) {
    const r = matchCommand([s], lang);
    assert.equal(r.id, null, '모호 «' + s + '» → ' + r.id);
    assert.equal(r.trace[0].result, 'ambiguous', s);
    assert.ok(r.trace[0].ids.length >= 2, s);
  }
  // 낱말 일부(접두·어근·접속사) 일치 없음
  for (const [s, lang] of [['والتالي', 'ar'], ['توقفت', 'ar'], ['قفل', 'ar'], ['بالتالي', 'ar'], ['nextdoor', 'en'],
    ['playing', 'en'], ['backward', 'en'], ['stopped', 'en'], ['٣', 'ar'], ['42', 'en']]) {
    assert.equal(matchCommand([s], lang).id, null, '일부 일치 «' + s + '»');
  }
  // spec 4절의 예 «التالي والسابق» — و 가 붙은 «والسابق» 은 낱말 일부라 후보가 아니다 → next(보고서 spec 정정 줄)
  assert.equal(matchCommand(['التالي والسابق'], 'ar').id, 'next');
});

/* ══ C7 대안 ═══════════════════════════════════════════════ */

test('C7 ★ V4 대안 — 순서대로 · 셋째에서 맞음 · 다섯 모두 실패 · 여섯째 안 봄 · 확신도 무관', () => {
  const r = matchCommand(['التالية الجميلة جدا', 'ما فهمت', 'السابق', 'التالي', 'blah'].map((t, i) => ({ transcript: t, confidence: 0.9 - i * 0.1 })), 'ar');
  // 첫 대안은 «التالية» 를 품는다 → 첫 대안에서 맞는다(그것이 순서다)
  assert.equal(r.id, 'next'); assert.equal(r.altIndex, 0);

  const r2 = matchCommand(['كلام فاضي', 'ما فهمت', 'السابق', 'التالي', 'blah'], 'ar');
  assert.equal(r2.id, 'prev');
  assert.equal(r2.altIndex, 2);
  assert.equal(r2.heard, 'السابق');
  assert.deepEqual(r2.trace.map((t) => t.result), ['none', 'none', 'match']);

  const r3 = matchCommand(['كلام فاضي', 'a', 'b', 'c', 'd'], 'ar');
  assert.equal(r3.id, null); assert.equal(r3.altIndex, -1); assert.equal(r3.heard, 'كلام فاضي');
  assert.equal(r3.trace.length, 5);

  const r4 = matchCommand(['a', 'b', 'c', 'd', 'e', 'التالي'], 'ar');   // 여섯째는 MAX_ALTS 밖
  assert.equal(r4.id, null); assert.equal(r4.trace.length, MAX_ALTS);

  // 확신도 무관 — 첫 대안 확신도가 낮아도, 전부 1.0 이어도 순서만
  const low = matchCommand([{ transcript: 'التالي', confidence: 0.01 }, { transcript: 'السابق', confidence: 0.99 }], 'ar');
  assert.equal(low.id, 'next');
  const ones = matchCommand([{ transcript: 'zzz', confidence: 1 }, { transcript: 'السابق', confidence: 1 }], 'ar');
  assert.equal(ones.id, 'prev'); assert.equal(ones.altIndex, 1);

  // 모호한 대안은 무효 → 다음 대안
  const amb = matchCommand(['التالي السابق', 'التالي'], 'ar');
  assert.equal(amb.id, 'next'); assert.equal(amb.altIndex, 1);
  assert.equal(amb.trace[0].result, 'ambiguous');

  // 빈 것·이상한 입력
  assert.equal(matchCommand([], 'ar').id, null);
  assert.equal(matchCommand([], 'ar').heard, '');
  assert.equal(matchCommand(null, 'ar').id, null);
  assert.equal(matchCommand(['', '  ', null, { transcript: 'التالي' }], 'ar').altIndex, 3);
});

/* ══ C8 명령 언어 ══════════════════════════════════════════ */

test('C8 명령 언어 auto/ar/en · 표 순서', () => {
  assert.equal(resolveCmdLang('auto', 'ar'), 'ar');
  for (const ui of ['en', 'fr', 'ko', '', undefined]) assert.equal(resolveCmdLang('auto', ui), 'en', String(ui));
  assert.equal(resolveCmdLang('ar', 'ko'), 'ar');
  assert.equal(resolveCmdLang('en', 'ar'), 'en');
  assert.equal(resolveCmdLang('xx', 'ar'), 'ar');      // 모르는 값 = auto
  assert.equal(resolveCmdLang(undefined, 'ar-SY'), 'ar');
  assert.deepEqual(tablesFor('ar'), ['ar', 'en']);
  assert.deepEqual(tablesFor('en'), ['en']);
  // en 모드: 아랍어·차용어 받지 않음
  assert.equal(matchCommand(['نكست'], 'en').id, null);
  assert.equal(matchCommand(['التالي'], 'en').id, null);
  // ar 모드: 차용어 · 라틴
  assert.equal(matchCommand(['نكست'], 'ar').id, 'next');
  assert.equal(matchCommand(['ستوب'], 'ar').id, 'pause');
  assert.equal(matchCommand(['بلاي'], 'ar').id, 'play');
  assert.equal(matchCommand(['باك'], 'ar').id, 'prev');
  assert.equal(matchCommand(['ريبيت'], 'ar').id, 'again');
  assert.equal(matchCommand(['Next'], 'ar').id, 'next');
  // 아랍어 표에 후보가 있으면(모호 포함) 영어 표를 보지 않는다
  assert.equal(matchCommand(['التالي السابق next'], 'ar').id, null);
});

/* ══ C9 explain ════════════════════════════════════════════ */

test('C9 explain — `[11-4]` 켰다: 같은 말이 같은 id 로 · enabled:true(9b 의 "꺼진 자리" 기대를 11-4 가 뒤집음)', () => {
  // 9b 는 "꺼진 명령은 nomatch 가 아니라 enabled:false" 를 지켰다. 11-4(spec 17-2-1 4-5)가 explain 을 켰으므로 맞춤 결과(id)는 그대로,
  // enabled 만 true 다 — 흐름은 "아직 없는 기능" 이 아니라 설명(voice-ui-9b U9 · explain-11a X9).
  for (const [s, lang] of [['اشرح', 'ar'], ['اشرح هنا', 'ar'], ['شرح', 'ar'], ['فسر', 'ar'], ['وضح', 'ar'], ['explain this', 'en'], ['explain', 'en']]) {
    const r = matchCommand([s], lang);
    assert.equal(r.id, 'explain', s);
    assert.equal(r.enabled, true, s);
  }
  assert.equal(matchCommand(['التالي'], 'ar').enabled, true);
  assert.equal(commandById('explain').enabled, true);
  assert.equal(commandById('nope'), null);
});

/* ══ C10 속도 계단 ═════════════════════════════════════════ */

test('C10 stepRate — 한 칸 · 끝 · 계단 밖 값', () => {
  assert.deepEqual(TTS.RATE_STEPS, [0.5, 0.75, 1.0, 1.25, 1.5, 1.8]);
  assert.deepEqual(stepRate(1, 1), { rate: 1.25, edge: null });
  assert.deepEqual(stepRate(1, -1), { rate: 0.75, edge: null });
  assert.deepEqual(stepRate(1.5, 1), { rate: 1.8, edge: null });
  assert.deepEqual(stepRate(1.8, 1), { rate: 1.8, edge: 'max' });
  assert.deepEqual(stepRate(0.5, -1), { rate: 0.5, edge: 'min' });
  assert.deepEqual(stepRate(0.7, 1), { rate: 1.0, edge: null });     // 0.7 → 0.75 → 한 칸 위
  assert.deepEqual(stepRate(0.625, -1), { rate: 0.5, edge: 'min' }); // 같은 거리 → 느린 쪽(0.5)
  assert.deepEqual(stepRate(null, 1), { rate: 1.25, edge: null });   // 모름 → 1.0 에서
  assert.deepEqual(stepRate('abc', -1), { rate: 0.75, edge: null });
});

/* ══ C11 import 방향 ═══════════════════════════════════════ */

test('C11 import 방향(3-2) — commands.js 는 text/specialty.js · config.js 만, 전역 없음', () => {
  const src = noComments(read('../js/voice/commands.js'));
  const imports = Array.from(src.matchAll(/^\s*import\b[^;]*?from\s*'([^']+)'/gm)).map((m) => m[1]).sort();
  assert.deepEqual(imports, ['../config.js', '../text/specialty.js']);
  assert.ok(!/\bimport\s*\(/.test(src), '동적 import 없음');
  assert.ok(!/\b(window|document|navigator|localStorage|speechSynthesis)\b/.test(src), '브라우저 전역 없음');
});

/* ══ C12–C15 `[9b-2]` 오탐 규칙 · 말뭉치 ════════════════════════
   9b-1 Review 의 발화 말뭉치 114개(`r9b1/corpus.mjs` — [발화, lang, 기대 id | null | 'TWO', 갈래]) 그대로. */

const CORPUS = Object.freeze([
  // ── 아랍어 표준·레반트 구어 명령 ──
  ['التالي من فضلك', 'ar', 'next', 'cmd'],
  ['الجملة التالية', 'ar', 'next', 'cmd'],
  ['ارجع للجملة السابقة', 'ar', 'prev', 'cmd'],
  ['وقف شوي', 'ar', 'pause', 'cmd'],
  ['كفي القراءة', 'ar', 'play', 'cmd'],
  ['أعد الجملة', 'ar', 'again', 'cmd'],
  ['عيدها', 'ar', 'again', 'cmd'],
  ['رجعني لورا', 'ar', 'prev', 'cmd'],
  ['ارجع لورا', 'ar', 'prev', 'cmd'],
  ['شغل الترجمة', 'ar', 'trOn', 'cmd'],
  ['بدون ترجمة لو سمحت', 'ar', 'trOff', 'cmd'],
  ['طفي الترجمة', 'ar', 'trOff', 'cmd'],
  ['وقف ترجمة', 'ar', 'trOff', 'cmd'],
  ['شيل الترجمة', 'ar', 'trOff', 'cmd'],
  ['خفف السرعة', 'ar', 'slower', 'cmd'],
  ['أبطأ شوي', 'ar', 'slower', 'cmd'],
  ['أسرع شوي', 'ar', 'faster', 'cmd'],
  ['زيد السرعة', 'ar', 'faster', 'cmd'],
  ['نزل السرعة', 'ar', 'slower', 'cmd'],
  ['بسرعة', 'ar', 'faster', 'cmd'],
  ['كمل القراءة', 'ar', 'play', 'cmd'],
  ['تابع', 'ar', 'play', 'cmd'],
  ['كمان مرة', 'ar', 'again', 'cmd'],
  ['مرة ثانية', 'ar', 'again', 'cmd'],
  ['طيب وقف', 'ar', 'pause', 'cmd'],
  ['لحظة', 'ar', 'pause', 'cmd'],
  ['استنى شوي', 'ar', 'pause', 'cmd'],
  // ── 차용어·라틴 ──
  ['نكست', 'ar', 'next', 'cmd'],
  ['نكست بليز', 'ar', 'next', 'cmd'],
  ['ستوب', 'ar', 'pause', 'cmd'],
  ['باك', 'ar', 'prev', 'cmd'],
  ['ريبيت', 'ar', 'again', 'cmd'],
  ['Next', 'ar', 'next', 'cmd'],
  ['stop', 'ar', 'pause', 'cmd'],
  ['نكست please', 'ar', 'next', 'cmd'],
  // ── 숫자 ──
  ['التالي ٢', 'ar', 'next', 'cmd'],
  ['ارجع ٣ جمل', 'ar', 'prev', 'cmd'],
  ['٢', 'ar', null, 'non'],
  // ── 짧은 낱말 혼자 ──
  ['بس', 'ar', 'pause', 'cmd'],
  ['ورا', 'ar', 'prev', 'cmd'],
  ['قف', 'ar', 'pause', 'cmd'],
  ['يا', 'ar', null, 'non'],
  ['و', 'ar', null, 'non'],
  ['شو', 'ar', null, 'non'],
  // ── 명령 아닌 일상 문장(아랍어) ──
  ['شو صار معك اليوم', 'ar', null, 'non'],
  ['عندي شغل كتير بكرا', 'ar', null, 'non'],
  ['بعده ما خلص الدوام', 'ar', null, 'non'],
  ['المريض بعده بالعناية', 'ar', null, 'non'],
  ['تعال لهون بسرعة', 'ar', null, 'non'],
  ['ماما بدي اكل', 'ar', null, 'non'],
  ['قديش الساعة هلأ', 'ar', null, 'non'],
  ['رح ارجع عالبيت', 'ar', null, 'non'],
  ['الدكتور قدام الباب', 'ar', null, 'non'],
  ['خليه ورا الكرسي', 'ar', null, 'non'],
  ['مرحبا كيفك', 'ar', null, 'non'],
  ['يلا نروح', 'ar', null, 'non'],
  ['بس ما عندي وقت', 'ar', null, 'non'],
  ['شكرا', 'ar', null, 'non'],
  ['تابع الأخبار', 'ar', null, 'non'],
  ['مين عم يحكي', 'ar', null, 'non'],
  // ── 의학 낱말이 섞인 문장(아랍어) ──
  ['توقف القلب المفاجئ', 'ar', null, 'non'],
  ['إعادة التأهيل بعد الجلطة', 'ar', null, 'non'],
  ['الجرعة التالية بعد ست ساعات', 'ar', null, 'non'],
  ['القصة المرضية السابقة', 'ar', null, 'non'],
  ['ضغط الدم مرتفع', 'ar', null, 'non'],
  ['تسرع القلب الجيبي', 'ar', null, 'non'],
  ['ترجمة المصطلح الطبي', 'ar', null, 'non'],
  ['نقص التروية', 'ar', null, 'non'],
  ['السكري من النوع الثاني', 'ar', null, 'non'],
  ['خفف الجرعة', 'ar', null, 'non'],
  ['شو يعني احتشاء', 'ar', null, 'non'],
  // ── 두 명령(아랍어) ──
  ['وقف وارجع', 'ar', 'TWO', 'two'],
  ['ارجع ووقف', 'ar', 'TWO', 'two'],
  ['التالي ثم أسرع', 'ar', 'TWO', 'two'],
  ['شغل وأسرع', 'ar', 'TWO', 'two'],
  ['وقف الترجمة وكمل', 'ar', 'TWO', 'two'],
  ['التالي والسابق', 'ar', 'TWO', 'two'],
  // ── 영어 명령 ──
  ['next please', 'en', 'next', 'cmd'],
  ['go back', 'en', 'prev', 'cmd'],
  ['go back one sentence', 'en', 'prev', 'cmd'],
  ['previous sentence', 'en', 'prev', 'cmd'],
  ['Stop.', 'en', 'pause', 'cmd'],
  ['hold on', 'en', 'pause', 'cmd'],
  ['continue reading', 'en', 'play', 'cmd'],
  ['read it again', 'en', 'again', 'cmd'],
  ['say that again', 'en', 'again', 'cmd'],
  ['repeat that', 'en', 'again', 'cmd'],
  ['one more time', 'en', 'again', 'cmd'],
  ['turn off translation', 'en', 'trOff', 'cmd'],
  ['turn on translation', 'en', 'trOn', 'cmd'],
  ['translation off', 'en', 'trOff', 'cmd'],
  ['slow down please', 'en', 'slower', 'cmd'],
  ['a bit faster', 'en', 'faster', 'cmd'],
  ['can you speed it up', 'en', 'faster', 'cmd'],
  ['skip this', 'en', 'next', 'cmd'],
  ['wait a second', 'en', 'pause', 'cmd'],
  ['go', 'en', 'play', 'cmd'],
  ['next 3 times', 'en', 'next', 'cmd'],
  ['go back 2', 'en', 'prev', 'cmd'],
  ['2', 'en', null, 'non'],
  // ── 영어 일상·의학 ──
  ["I can't read this word", 'en', null, 'non'],
  ['where did I stop yesterday', 'en', null, 'non'],
  ["I'll be back in 5 minutes", 'en', null, 'non'],
  ["let's go to the cafeteria", 'en', null, 'non'],
  ['stop the bleeding first', 'en', null, 'non'],
  ['back pain radiating to the leg', 'en', null, 'non'],
  ['skip the next dose', 'en', null, 'non'],
  ['heart rate is slow', 'en', null, 'non'],
  ['hello how are you', 'en', null, 'non'],
  ['what time is it', 'en', null, 'non'],
  ['continue the antibiotics for a week', 'en', null, 'non'],
  // ── 두 명령(영어) ──
  ['stop and go back', 'en', 'TWO', 'two'],
  ['pause then next', 'en', 'TWO', 'two'],
  ['next and faster', 'en', 'TWO', 'two']
]);

/** 결정 ①·② 뒤에도 남는 오탐 — 3낱말 이하 문장 속 한 낱말 동의어(뜻이 둘). 표 손질은 `[검토 — Nour]`(V-4 자료). */
const RESIDUAL_FP = Object.freeze({
  'رح ارجع عالبيت': 'prev',            // "집에 돌아갈게" — «ارجع»
  'توقف القلب المفاجئ': 'pause',       // 의학 "심정지" — «توقف»
  'القصة المرضية السابقة': 'prev',     // 의학 "과거 병력" — «السابقة»
  'خفف الجرعة': 'slower'               // "용량을 줄여" — «خفف»
});

test('C12 ★ 말뭉치 — 명령 의도 62개 → 맞는 명령(놓침 0 · 혼동 0)', () => {
  const rows = CORPUS.filter((c) => c[3] === 'cmd');
  assert.equal(rows.length, 62);
  const bad = [];
  for (const [s, lang, want] of rows) {
    const got = matchCommand([s], lang).id;
    if (got !== want) bad.push(s + ' → ' + got + ' (기대 ' + want + ')');
  }
  assert.deepEqual(bad, []);
});

test('C13 ★ 말뭉치 — 명령 아님 43개 → null · 남은 오탐은 목록과 정확히 같다', () => {
  const rows = CORPUS.filter((c) => c[3] === 'non');
  assert.equal(rows.length, 43);
  const fp = {};
  for (const [s, lang] of rows) {
    const got = matchCommand([s], lang).id;
    if (got !== null) fp[s] = got;
  }
  assert.deepEqual(fp, RESIDUAL_FP, '오탐 22 → 4 — 바뀌면 이 목록과 보고서를 함께 고친다');
  // 대표 사례(9b1R-2) — 결정 ①·표 손질로 null
  for (const [s, lang] of [['عندي شغل كتير بكرا', 'ar'], ['المريض بعده بالعناية', 'ar'], ['تعال لهون بسرعة', 'ar'],
    ['الجرعة التالية بعد ست ساعات', 'ar'], ['ترجمة المصطلح الطبي', 'ar'], ["I can't read this word", 'en'],
    ["I'll be back in 5 minutes", 'en'], ['stop the bleeding first', 'en'], ['back pain radiating to the leg', 'en'],
    ['skip the next dose', 'en'], ['heart rate is slow', 'en'], ['continue the antibiotics for a week', 'en']]) {
    assert.equal(matchCommand([s], lang).id, null, s);
  }
});

const NEG = Object.freeze([
  ["don't stop", 'en'], ['do not stop', 'en'], ["don't go back", 'en'], ['not so fast', 'en'], ['no not faster', 'en'],
  ['لا توقف', 'ar'], ['لا تسكت', 'ar'], ['ما توقف', 'ar'], ['لا ترجع', 'ar'], ['لا تشغل الترجمة', 'ar'], ['ما بدي ترجمة', 'ar'],
  ['بدي ترجمة', 'ar'], ['بلا ما توقف', 'ar'], ['لا تكمل', 'ar'], ['ما تكمل', 'ar'],
  // 더한 것 — 결정 ② 의 갈래(두 낱말 동의어 밖의 부정어 · 레반트 مش·مو)
  ['never stop', 'en'], ["don't skip", 'en'], ['مش التالي', 'ar'], ['مو هيك وقف', 'ar'], ['لا وقف الترجمة', 'ar'], ["don't turn off translation", 'en']
]);

test('C14 ★ 부정문 → null(결정 ②) · 부정어가 동의어 안이면 그 명령 · 대안 단위', () => {
  for (const [s, lang] of NEG) {
    const r = matchCommand([s], lang);
    assert.equal(r.id, null, '부정문 «' + s + '» → ' + r.id);
  }
  // trace 에 negated 로 남는다(무엇을 막았는지)
  const r = matchCommand(["don't stop"], 'en');
  assert.deepEqual(r.trace.map((x) => x.result), ['negated']);
  assert.deepEqual(r.trace[0].ids, ['pause']);
  assert.equal(matchCommand(['لا وقف الترجمة'], 'ar').trace[0].result, 'negated');
  // 부정어가 동의어 **안** — 그대로 그 명령(전체 일치·포함 일치 모두)
  for (const [s, lang, id] of [['بلا ترجمة', 'ar', 'trOff'], ['no translation', 'en', 'trOff'], ['بدون ترجمة', 'ar', 'trOff'],
    ['بلا ترجمة لو سمحت', 'ar', 'trOff'], ['no translation please', 'en', 'trOff'], ['بلا ترجمة هلأ', 'ar', 'trOff']]) {
    assert.equal(matchCommand([s], lang).id, id, s);
  }
  // 부정어 낱말이 표의 동의어 낱말과 겹치지 않는다(동의어 안의 낱말을 부정어로 오인하지 않게). "don't" 의 't' 는 홀로 쓰이는 동의어 낱말이 없다.
  const words = new Set();
  for (const c of VOICE_COMMANDS) for (const s of c.ar.concat(c.arLoan, c.en)) for (const w of normalizeBase(s).split(' ')) words.add(w);
  for (const n of NEGATORS.en.concat(NEGATORS.ar)) {
    for (const w of normalizeBase(n).split(' ')) assert.ok(!words.has(w), '부정어 «' + w + '» 가 동의어 낱말');
  }
  // `[9b-3 — Rb]` 부정된 대안 다음 대안이 맞아도 **누름 전체 무효**(9b-2 까지는 다음 대안이 맞으면 그 명령이었다 — 9b2R-3).
  const alt = matchCommand(["don't stop", 'stop'], 'en');
  assert.equal(alt.id, null);
  assert.equal(alt.altIndex, -1);
  assert.deepEqual(alt.trace.map((x) => x.result), ['negated'], '뒤 대안은 보지 않는다');
  assert.equal(alt.heard, "don't stop");
});

test('C15 ★ 결정 ① — 한 낱말 포함 일치는 말 전체 ≤ PART_MAX_WORDS · 긴 동의어는 길이 무관 · 표 손질 · 두 명령 문장', () => {
  assert.equal(PART_MAX_WORDS, VOICE.PART_MAX_WORDS);
  assert.equal(PART_MAX_WORDS, 3);
  // 경계: 3낱말 = 포함 일치, 4낱말 = 아님(한 낱말 동의어)
  assert.equal(matchCommand(['ارجع شوي هلأ'], 'ar').id, 'prev');
  assert.equal(matchCommand(['ارجع شوي هلأ كمان'], 'ar').id, null);
  assert.equal(matchCommand(['next one please'], 'en').id, 'next');            // please 는 군말 — 2낱말
  assert.equal(matchCommand(['the next one now'], 'en').id, null);
  // 숫자·군말을 뗀 뒤 센다
  assert.equal(matchCommand(['من فضلك ارجع ٣ جمل'], 'ar').id, 'prev');
  // 두 낱말 이상 동의어는 말이 길어도 포함 일치(결정 ① 은 한 낱말만)
  assert.equal(matchCommand(['ممكن لو سمحت وقف الترجمة هلأ يا حبيبي'], 'ar').id, 'trOff');
  assert.equal(matchCommand(['could you please stop translation now'], 'en').id, 'trOff');
  assert.equal(matchCommand(['can you read it again for me'], 'en').id, 'again');
  // 전체 일치는 그대로
  assert.equal(matchCommand(['الجملة التالية'], 'ar').id, 'next');
  // 표 손질(9b1R-2) — 관사 없는 구 · 자연스러운 구 · 두 뜻 낱말 exact
  for (const [s, lang, id] of [['وقف ترجمة', 'ar', 'trOff'], ['شيل الترجمة', 'ar', 'trOff'], ['شغل ترجمة', 'ar', 'trOn'],
    ['استنى شوي', 'ar', 'pause'], ['wait a second', 'en', 'pause'], ['عيدها', 'ar', 'again'], ['read it again', 'en', 'again'],
    ['one more time', 'en', 'again'], ['turn off translation', 'en', 'trOff'], ['turn on translation', 'en', 'trOn'],
    ['زيد السرعة', 'ar', 'faster'], ['نزل السرعة', 'ar', 'slower'], ['can you speed it up', 'en', 'faster'], ['رجعني لورا', 'ar', 'prev'],
    ['شغل', 'ar', 'play'], ['بعده', 'ar', 'next'], ['ورا', 'ar', 'prev'], ['ترجمة', 'ar', 'trOn'], ['بسرعة', 'ar', 'faster']]) {
    assert.equal(matchCommand([s], lang).id, id, s);
  }
  for (const s of ['شغل هون', 'بعده هون', 'ورا هون', 'ترجمة هون', 'تابع هون', 'بسرعة هون', 'قدام هون']) {
    assert.equal(matchCommand([s], 'ar').id, null, 'exact «' + s + '»');
  }
  // 두 명령이 한 문장 — 같은 길이면 모호(무효), 둘째 동사에 و 가 붙으면 처음 것(낱말 일부 일치 없음 — 9b1R-2)
  const two = CORPUS.filter((c) => c[3] === 'two').map(([s, lang]) => [s, matchCommand([s], lang).id]);
  assert.deepEqual(Object.fromEntries(two), {
    'وقف وارجع': 'pause', 'ارجع ووقف': 'prev', 'التالي ثم أسرع': null, 'شغل وأسرع': null,
    'وقف الترجمة وكمل': 'trOff', 'التالي والسابق': 'next',
    'stop and go back': 'prev', 'pause then next': null, 'next and faster': null
  });
});

/* ══ C16·C17 9b-3 다듬기 ═══════════════════════════════ */

test('C16 ★ Rb — 맞은 대안보다 부정된 대안을 먼저 만나면 누름 전체 무효 · 첫 대안이 맞으면 뒤 부정어는 보지 않는다', () => {
  const ROWS = [
    // [대안 목록, lang, 기대 id, 기대 altIndex, 기대 trace]
    [['لا توقف', 'توقف'], 'ar', null, -1, ['negated']],                         // ★ 9b2R-3 화면 재현 꼴 — 아래 대안이 부정어를 잃음
    [['توقف', 'لا توقف'], 'ar', 'pause', 0, ['match']],                          // 첫 대안이 맞음 — 뒤 부정은 안 본다
    [["don't stop", 'stop'], 'en', null, -1, ['negated']],
    [['stop', "don't stop"], 'en', 'pause', 0, ['match']],
    [['uh', "don't stop", 'stop'], 'en', null, -1, ['none', 'negated']],         // none 뒤 부정 → 무효(S2 꼴)
    [['uh', 'stop', "don't stop"], 'en', 'pause', 1, ['none', 'match']],         // none 뒤 맞음 → 그 명령(S2b 꼴)
    [['pause then next', "don't stop", 'stop'], 'en', null, -1, ['ambiguous', 'negated']],   // 모호 뒤 부정 → 무효
    [['', "don't stop", 'stop'], 'en', null, -1, ['empty', 'negated']],          // 빈 대안은 건너뛴 뒤 부정 → 무효
    [['لا ارجع', 'هه', 'ارجع'], 'ar', null, -1, ['negated']],                    // 뒤에 잡음·맞는 대안이 있어도
    [['nex', 'next', "don't skip"], 'en', 'next', 1, ['none', 'match']],
    [['بلا ترجمة', 'ترجمة'], 'ar', 'trOff', 0, ['match']]                        // 부정어가 동의어 안 — 부정이 아니다
  ];
  for (const [alts, lang, id, idx, trace] of ROWS) {
    const r = matchCommand(alts, lang);
    const k = JSON.stringify(alts);
    assert.equal(r.id, id, k);
    assert.equal(r.altIndex, idx, k);
    assert.deepEqual(r.trace.map((x) => x.result), trace, k);
    if (id === null) assert.equal(r.heard, String(alts[0]), k + ' — 못 맞추면 첫 대안 글자');
  }
  // 부정된 대안 뒤로는 보지 않는다 — trace 길이로
  const r = matchCommand(["don't stop", 'stop', 'pause', 'wait', 'next'], 'en');
  assert.equal(r.trace.length, 1);
  // 소스 — matchCommand 루프에서 negated 를 만나면 곧장 끝(continue 아님)
  const src = noComments(read('../js/voice/commands.js'));
  const body = src.slice(src.indexOf('export function matchCommand('), src.indexOf('export function resolveCmdLang('));
  assert.match(body, /if \(res\.kind === 'negated'\) \{\s*trace\.push\(\{[^}]*\}\);\s*break;\s*\}/);
});

test('C17 ★ 반대 뜻 낱말 exact · «بلاش» 부정어 · 쉬운 동의어 — 9b2R-9 중-2 · 낮음-1', () => {
  // "slow"·«بطيء» — 혼자 말할 때만 slower, 문장 속(too slow = 빠르게 원함)에서는 null
  for (const [s, lang, id] of [
    ['slow', 'en', 'slower'], ['slow please', 'en', 'slower'], ['بطيء', 'ar', 'slower'], ['بطيء من فضلك', 'ar', 'slower'],
    ['too slow', 'en', null], ["it's slow", 'en', null], ['so slow', 'en', null], ['كتير بطيء', 'ar', null],
    ['النبض بطيء', 'ar', null], ['slow heart rate', 'en', null],
    // 두 낱말 이상 slower 동의어는 그대로
    ['slow down', 'en', 'slower'], ['slow down a bit', 'en', 'slower'], ['ببطء', 'ar', 'slower']
  ]) assert.equal(matchCommand([s], lang).id, id, s);
  const slower = VOICE_COMMANDS.find((c) => c.id === 'slower');
  assert.ok(slower.exact.includes('slow') && slower.exact.includes('بطيء'));
  // «بلاش» — 부정어("…하지 마")
  assert.ok(NEGATORS.ar.includes('بلاش'));
  for (const s of ['بلاش توقف', 'بلاش ترجع', 'بلاش تكمل', 'بلاش ترجمة', 'بلاش الترجمة']) assert.equal(matchCommand([s], 'ar').id, null, s);
  assert.equal(matchCommand(['بلاش توقف'], 'ar').trace[0].result, 'negated');
  assert.equal(matchCommand(['بلا ترجمة'], 'ar').id, 'trOff', '«بلا»(…없이)는 부정어가 아니다 — 동의어 그대로');
  // Rb + «بلاش» — 아래 대안이 부정어를 잃어도
  assert.equal(matchCommand(['بلاش توقف', 'توقف'], 'ar').id, null);
  // 쉬운 동의어
  for (const [s, lang, id] of [
    ['أوقف', 'ar', 'pause'], ['اوقف', 'ar', 'pause'], ['أوقف من فضلك', 'ar', 'pause'],
    ['stop the translation', 'en', 'trOff'], ['turn off the translation', 'en', 'trOff'], ['please stop the translation', 'en', 'trOff'],
    ['stop the translation', 'ar', 'trOff'],                 // ar 모드 — 라틴은 두 번째 표
    ['stop', 'en', 'pause'], ['stop translation', 'en', 'trOff'],
    ["don't stop the translation", 'en', null], ['لا أوقف', 'ar', null],
    // `[9b 다듬기 Review 낮음-1]` «أوقف» 를 더하며 생긴 혼동(→ pause)과 영어 두 꼴
    ['أوقف الترجمة', 'ar', 'trOff'],
    ['أوقف ترجمة', 'ar', 'trOff'],
    ['stop translating', 'en', 'trOff'],
    ['pause the translation', 'en', 'trOff'],
    ['أوقف القراءة', 'ar', 'pause']                         // 번역이 아닌 «أوقف …» 는 그대로 pause
  ]) assert.equal(matchCommand([s], lang).id, id, s + ' (' + lang + ')');
  // 표 자리 — `[검토 — Nour·운영자]` 표시가 바로 앞 주석에 남는다
  const raw = read('../js/voice/commands.js');
  for (const w of ["'أوقف']", "'stop the translation'", "'turn off the translation'", "exact: ['slow', 'بطيء']", "'بلاش']",
    "'أوقف الترجمة'", "'stop translating'"]) {
    const i = raw.indexOf(w);
    assert.ok(i > 0, w);
    assert.ok(raw.slice(Math.max(0, i - 500), i).indexOf('[검토 — Nour·운영자]') >= 0, w + ' — 검토 표시');
  }
});
