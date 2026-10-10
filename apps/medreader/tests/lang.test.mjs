/* ============================================================
   tests/lang.test.mjs — spec 16-D1 `[N]` · 9-2 원문 언어 추정 (7c)

   발췌는 전부 **직접 지은 문장**이다(언어당 2~3문장, 원서 문장 없음).
   200자 미만은 판단하지 않으므로(9-2), 짧은 문자 계통(한자·가나·아랍) 발췌는
   같은 문장을 되풀이해 200자를 넘긴다 — 문장 자체는 2~3개다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  guessLang, langFromGuess, applyGuess, applyUserLang, shouldGuess,
  docLangOf, langSourceOf, collectSample, readyToGuess,
  SUPPORTED_SRC, UNSUPPORTED_LANG, LOW_SCORE, GUESS,
  scriptCounts, functionWordRates
} from '../js/text/lang.js';

const EN = 'The patient presented with a persistent cough and mild fever for three weeks. ' +
  'Chest examination revealed crackles in both lower lobes, and the white cell count was raised. ' +
  'Treatment with oral antibiotics was started, and the symptoms improved within ten days.';

const FR = 'Le patient présentait une toux persistante et une fièvre modérée depuis trois semaines. ' +
  'L’examen du thorax a révélé des crépitants dans les bases, et la numération des leucocytes était élevée. ' +
  'Un traitement antibiotique par voie orale a été débuté pour une durée de dix jours.';

const KO = '환자는 3주 동안 이어진 기침과 가벼운 발열로 내원하였다. ' +
  '흉부 청진에서 양쪽 아래 폐에 수포음이 들렸고 백혈구 수가 증가해 있었다. ' +
  '경구 항생제 치료를 시작하였고 열흘 안에 증상이 좋아졌다. ';

const ZH = '患者咳嗽持续三周并伴有低热。胸部检查发现双下肺湿啰音，白细胞计数升高。开始口服抗生素治疗后，症状在十天内明显好转。';
const JA = '患者は三週間続く咳と微熱で来院した。胸部の聴診で両側の下肺に水泡音を認め、白血球数が上昇していた。経口抗菌薬を開始したところ、十日以内に症状は改善した。';
const AR = 'حضر المريض بسعال مستمر وحمى خفيفة منذ ثلاثة أسابيع. ' +
  'أظهر فحص الصدر خراخر في القاعدتين، وكان عدد الكريات البيض مرتفعًا. ' +
  'بدأ العلاج بالمضادات الحيوية الفموية وتحسنت الأعراض خلال عشرة أيام.';

/** 200자를 넘을 때까지 같은 발췌를 되풀이한다(문장을 새로 짓지 않는다). */
function atLeast200(s) {
  let out = s;
  while (out.length < 220) out += ' ' + s;
  return out;
}

test('G0 발췌가 판단 하한(200자)을 넘는다 — 테스트 자체의 전제', () => {
  for (const s of [EN, FR, atLeast200(KO), atLeast200(ZH), atLeast200(JA), atLeast200(AR)]) {
    assert.ok(s.length >= GUESS.MIN_CHARS, s.slice(0, 20) + '… ' + s.length);
  }
});

test('G1 ★ 영어 발췌 → en (확신 있음)', () => {
  const g = guessLang(EN);
  assert.equal(g.lang, 'en');
  assert.ok(g.score >= LOW_SCORE, 'score ' + g.score);
  assert.equal(g.script, 'latin');
});

test('G2 ★ 프랑스어 발췌 → fr', () => {
  const g = guessLang(FR);
  assert.equal(g.lang, 'fr');
  assert.ok(g.score >= LOW_SCORE, 'score ' + g.score);
});

test('G3 ★ 한국어 발췌 → ko', () => {
  const g = guessLang(atLeast200(KO));
  assert.equal(g.lang, 'ko');
  assert.equal(g.script, 'hangul');
});

test('G4 ★ 한자 위주 → zh (미지원 → 문서 lang 은 und)', () => {
  const g = guessLang(atLeast200(ZH));
  assert.equal(g.lang, 'zh');
  assert.equal(langFromGuess(g), UNSUPPORTED_LANG);
});

test('G5 ★ 가나 → ja (미지원)', () => {
  const g = guessLang(atLeast200(JA));
  assert.equal(g.lang, 'ja');
  assert.equal(langFromGuess(g), UNSUPPORTED_LANG);
});

test('G6 ★ 아랍 문자 → ar (원문으로는 미지원)', () => {
  const g = guessLang(atLeast200(AR));
  assert.equal(g.lang, 'ar');
  assert.equal(langFromGuess(g), UNSUPPORTED_LANG);
});

test('G7 ★ 200자 미만 → en + 낮은 score (판단하지 않는다)', () => {
  for (const s of ['', 'Le patient.', FR.slice(0, 150), KO, ZH]) {
    assert.ok(s.length < GUESS.MIN_CHARS);
    const g = guessLang(s);
    assert.equal(g.lang, 'en', JSON.stringify(s.slice(0, 20)));
    assert.ok(g.score < LOW_SCORE);
  }
});

test('G8 ★ 기능어 동률 → en + 낮은 score', () => {
  // en·fr 기능어가 같은 수로 섞인 지어낸 낱말 줄
  const unit = 'the patient le malade and fever et fièvre with care pour soin ';
  let s = unit;
  while (s.length < 260) s += unit;
  const g = guessLang(s);
  assert.equal(g.lang, 'en');
  assert.ok(g.score < LOW_SCORE, 'score ' + g.score);
});

test('G9 기능어가 하나도 없는 라틴 글자 → en + score 0', () => {
  let s = 'Cardiomyopathy hypertrophic obstructive variant ';
  while (s.length < 260) s += s;
  const g = guessLang(s);
  assert.equal(g.lang, 'en');
  assert.equal(g.score, 0);
});

test('G10 영어 본문의 "et al." 인용은 프랑스어로 넘어가지 않는다', () => {
  const s = EN + ' Smith et al. reported the same course, and Jones et al. found it in the elderly.';
  assert.equal(guessLang(s).lang, 'en');
});

test('G11 `[가정]` 영어 본문에 가나 몇 글자가 섞여도 ja 로 돌리지 않는다', () => {
  const g = guessLang(EN + ' (カルテ)');
  assert.equal(g.lang, 'en');
});

test('G12 한국어 본문 속 영어 약어(CRP·mg/L)는 판정을 바꾸지 않는다', () => {
  const s = atLeast200('CRP 수치는 12 mg/L 이었고 ECG 는 정상이었다. ' + KO);
  assert.equal(guessLang(s).lang, 'ko');
});

/* `[7c Review]` 경계 고정 — 살아남던 변이 2개(계통 임계 30%→50%, 기능어 2배→1배)를 잡는다. */

test('G13 ★ 영어 용어가 많은 한국어(한글이 글자의 30% 이상 50% 미만) → ko — 계통 임계는 30%', () => {
  // 의학서 한국어 본문은 영어 병기가 많다. 한글 비율이 절반 아래여도 ko 다(9-2 의 30%).
  const unit = '고혈압(hypertension) 환자에게는 암로디핀 또는 losartan 을 먼저 투여하고 blood pressure 를 다시 잰다. ';
  let s = unit;
  while (s.length < 260) s += unit;
  const c = scriptCounts(s);
  const r = c.hangul / c.letters;
  assert.ok(r >= 0.3 && r < 0.5, '시험 전제: 한글 비율 ' + r.toFixed(3));
  assert.equal(guessLang(s).lang, 'ko');
});

test('G14 ★ 기능어가 2배에 못 미치면(1.5배) 많은 쪽이어도 en + 낮은 score — 2배 규칙', () => {
  // fr 기능어 3 : en 기능어 2 (지어낸 낱말 줄)
  const unit = 'le malade et la fièvre the patient and cough ';
  let s = unit;
  while (s.length < 260) s += unit;
  const r = functionWordRates(s);
  assert.ok(r.fr > r.en && r.fr < r.en * GUESS.WORD_FACTOR, '시험 전제: fr/en = ' + (r.fr / r.en).toFixed(2));
  const g = guessLang(s);
  assert.equal(g.lang, 'en');
  assert.ok(g.score < LOW_SCORE, 'score ' + g.score);
});

/* ── 문서 필드 (9-2) ─────────────────────────────────────── */

test('F1 옛 레코드 — lang 없으면 en, langSource 없으면 default', () => {
  assert.equal(docLangOf({}), 'en');
  assert.equal(docLangOf(null), 'en');
  assert.equal(langSourceOf({}), 'default');
  assert.equal(langSourceOf({ langSource: 'weird' }), 'default');
  assert.equal(langSourceOf({ langSource: 'user' }), 'user');
});

test('F2 ★ applyGuess — 기본값 문서는 추정이 덮고 langSource=auto, langGuess 기록', () => {
  const rec = { id: 'd1', lang: 'en', langSource: 'default', langGuess: null };
  const r = applyGuess(rec, { lang: 'fr', score: 0.9, script: 'latin' });
  assert.equal(r.changed, true);
  assert.equal(r.rec.lang, 'fr');
  assert.equal(r.rec.langSource, 'auto');
  assert.deepEqual(r.rec.langGuess, { lang: 'fr', score: 0.9, script: 'latin' });
  assert.equal(rec.lang, 'en', '원본을 바꾸지 않는다');
});

test('F3 ★★ applyGuess — langSource === "user" 면 덮어쓰지 않는다 (16-D1)', () => {
  const rec = { id: 'd1', lang: 'ko', langSource: 'user' };
  const r = applyGuess(rec, { lang: 'en', score: 1, script: 'latin' });
  assert.equal(r.changed, false);
  assert.equal(r.rec, rec, '같은 레코드를 그대로 돌려준다 — 저장하지 않는다');
  assert.equal(r.rec.lang, 'ko');
  assert.equal(r.rec.langSource, 'user');
});

test('F4 applyGuess — 미지원 계통은 lang=und, langGuess 에는 본 그대로', () => {
  const r = applyGuess({ id: 'd', lang: 'en' }, { lang: 'zh', score: 0.8, script: 'han' });
  assert.equal(r.rec.lang, 'und');
  assert.equal(r.rec.langGuess.lang, 'zh');
});

test('F5 applyGuess — 같은 언어면 changed=false (리더가 큐를 갈지 않는다), 그래도 기록은 남긴다', () => {
  const r = applyGuess({ id: 'd', lang: 'en', langSource: 'default' }, { lang: 'en', score: 0.7, script: 'latin' });
  assert.equal(r.changed, false);
  assert.equal(r.rec.langSource, 'auto');
  assert.ok(r.rec.langGuess);
});

test('F6 ★ applyUserLang — langSource=user, 지원 밖 값은 거절', () => {
  const r = applyUserLang({ id: 'd', lang: 'en', langSource: 'auto' }, 'fr');
  assert.equal(r.rec.lang, 'fr');
  assert.equal(r.rec.langSource, 'user');
  assert.equal(r.changed, true);
  assert.equal(applyUserLang({ id: 'd' }, 'ar'), null);
  assert.equal(applyUserLang({ id: 'd' }, 'und'), null);
  // 사용자가 지금과 같은 언어를 골라도 'user' 로 굳힌다 — 이후 추정이 덮지 못하게.
  const same = applyUserLang({ id: 'd', lang: 'en', langSource: 'auto' }, 'en');
  assert.equal(same.changed, false);
  assert.equal(same.rec.langSource, 'user');
});

test('F7 ★ shouldGuess — 한 번만. user·이미 추정한 문서는 다시 돌지 않는다', () => {
  assert.equal(shouldGuess({ lang: 'en' }), true);                       // 옛 레코드
  assert.equal(shouldGuess({ lang: 'en', langSource: 'default', langGuess: null }), true);
  assert.equal(shouldGuess({ lang: 'fr', langSource: 'auto', langGuess: { lang: 'fr' } }), false);
  assert.equal(shouldGuess({ lang: 'ko', langSource: 'user' }), false);
  assert.equal(shouldGuess(null), false);
});

test('F8 사용자 선택 뒤의 추정은 순서와 상관없이 지지 않는다 (user → guess → guess)', () => {
  let rec = { id: 'd', lang: 'en', langSource: 'default' };
  rec = applyUserLang(rec, 'ko').rec;
  rec = applyGuess(rec, { lang: 'en', score: 1, script: 'latin' }).rec;
  rec = applyGuess(rec, { lang: 'fr', score: 1, script: 'latin' }).rec;
  assert.equal(rec.lang, 'ko');
  assert.equal(rec.langSource, 'user');
});

test('F9 SUPPORTED_SRC = en, fr, ko (en 필수, 순서가 [⋯] 의 순서)', () => {
  assert.deepEqual([...SUPPORTED_SRC], ['en', 'fr', 'ko']);
});

/* ── 표본 (9-2 "앞 30쪽 · 본문 5쪽 · 최대 8,000자") ─────────── */

function page(n, texts, kind) {
  return { pageNo: n, paragraphs: texts.map((t) => ({ kind: kind || 'body', text: t })) };
}

test('S1 제목 문단은 표본에서 뺀다, 쪽 순서대로 잇는다', () => {
  const s = collectSample([
    page(2, ['second page body']),
    { pageNo: 1, paragraphs: [{ kind: 'heading', text: 'CHAPTER ONE' }, { kind: 'body', text: 'first page body' }] }
  ]);
  assert.equal(s.text, 'first page body second page body');
});

test('S2 본문 쪽 = 제목이 아닌 글자가 200자 이상인 쪽', () => {
  const long = EN;          // 200자 이상
  const s = collectSample([page(1, ['Contents']), page(2, [long]), page(3, [long])]);
  assert.equal(s.bodyPages, 2);
});

test('S3 30쪽 밖은 보지 않는다, 8,000자에서 자른다', () => {
  const pages = [];
  for (let n = 1; n <= 40; n++) pages.push(page(n, [EN]));
  const s = collectSample(pages);
  assert.ok(s.text.length <= GUESS.MAX_CHARS);
  assert.equal(s.bodyPages, GUESS.MAX_PAGE);
});

test('S4 readyToGuess — 본문 5쪽이면 돈다, 짧은 문서는 다 모이면 돈다', () => {
  assert.equal(readyToGuess(4, 10, 500), false);
  assert.equal(readyToGuess(5, 5, 500), true);
  assert.equal(readyToGuess(0, 3, 3), true);        // 3쪽짜리 문서 — 다 모였다
  assert.equal(readyToGuess(1, 29, 500), false);
  assert.equal(readyToGuess(1, 30, 500), true);     // 앞 30쪽이 다 모였다
  assert.equal(readyToGuess(0, 0, 0), false);
});
