/* ============================================================
   MedReader — 음성 명령: 정규화 · 동의어 표 · 매칭 (spec 17-1-2 4절 · 9b-1)

   **순수 모듈이다.** DOM·저장소·브라우저 전역·speaker 를 모른다. 인식기가 준 대안 글자 몇 개를 받아
   "어느 명령인가"만 답한다. 실행(재생·속도·번역)은 `ui/voice.js`(9b-2) 몫이다.

   ── 정규화 `normalizeUtterance(s)` ─────────────────────────
   `foldArabic`(text/specialty.js — **한 벌**: NFKC · 타슈킬·타트윌 제거 · أإآٱ→ا · ة→ه · ى→ي) 다음에
   ؤ→و · ئ→ي · 아랍·페르시아 숫자 → ASCII · 라틴 소문자 · 문장부호 → 공백 · 공백 접기 · 앞뒤 자르기,
   그다음 **군말 떼기**(앞뒤의 «من فضلك»·«لو سمحت»·«رجاء»·«يا»·«طيب»·please·ok·okay·hey — 떼고 남는 낱말이 1개 이상일 때만).

   ── 매칭 `matchCommand(alternatives, lang)` ─────────────────
   대안을 순서대로(최대 `MAX_ALTS` = 5). 대안마다 숫자를 떼고(«التالي ٢» → 다음 한 번 — 숫자는 받지 않는다, 9b-D6):
     1. **전체 일치** — 정규화한 말 = 어떤 동의어의 정규화 꼴.
     2. **포함 일치** — 동의어가 말 안에 **낱말 경계로 이어진 구**로 들어 있으면 후보. 낱말 수가 가장 많은 구가 이긴다
        («وقف الترجمة» 가 «وقف» 를 이긴다). 가장 긴 것끼리 다른 명령이면 **모호 → 이 대안은 무효**.
        `exact` 낱말(짧거나 뜻이 둘 — «بس»·«يلا»·«الترجمة» …)은 포함 일치에 쓰지 않는다.
     낱말 일부(접두·어근) 일치는 하지 않는다 — «وقف» 를 و + «قف» 로 떼면 뜻이 바뀐다.
   첫 대안에서 맞으면 끝, 아니면 다음 대안(부정된 대안을 만나면 그 자리에서 끝 — 아래 Rb). **확신도 문턱 없음**(9b-D7 — Android 는 확신도를 1.0 으로 채울 수 있다, S8).
   표 순서: `ar` 모드 = 아랍어 표(아랍 문자 영어 차용어 포함) **먼저**, 거기서 후보가 하나도 없을 때만 영어 표(9b-D5 —
   아랍어 인식기가 라틴 글자 «next» 를 돌려준 경우). `en` 모드 = 영어 표만.

   ── 명령 언어 ────────────────────────────────────────────
   설정 `voice.cmdLang` = 'auto' | 'ar' | 'en'. auto = UI 언어 ar → 'ar', 그 밖(en·fr·ko) → 'en'(`resolveCmdLang`).

   ── `[9b-2 — 운영자 결정 2026-11-15]` 오탐 규칙 두 가지 (9b-1 Review 중-1·중-2) ──
     ① **한 낱말 동의어의 포함 일치는 말 전체가 `VOICE.PART_MAX_WORDS`(3) 낱말 이하일 때만.** 전체 일치는 그대로.
        «عندي شغل كتير بكرا»·"continue the antibiotics for a week" 같은 일상·의학 문장이 명령이 되지 않게.
     ② **부정어가 맞은 구 밖에 있으면 그 대안은 무효**(`NEGATORS` — don't·not·never · لا·ما·مش·مو·بلاش).
        «بلا ترجمة»·"no translation" 처럼 부정어가 동의어 **안**에 든 것은 그대로 그 명령이다.
     ~~무효가 된 대안은 모호와 같이 다음 대안으로 넘어간다~~ → `[Rb — 운영자 2026-11-15 · 9b2R-3]` 대안을 순서대로 보다가
     **맞은 대안보다 부정된 대안을 먼저 만나면 그 누름 전체 무효**(trace 의 마지막 result = 'negated', 뒤 대안은 보지 않는다).
     첫 대안이 맞으면 뒤 대안의 부정어는 보지 않는다. 모호·none 대안은 그대로 다음 대안으로 넘어간다.

   상수 `MAX_ALTS` 는 `config.js` 의 `VOICE.MAX_ALTS` 를 본다 — 인식기(`voice/listen.js`)와 한 값(9b1R-8 4).
   import 방향(3-2): 순수 계층 — `text/specialty.js`(접기) · `config.js`(속도 계단 · `VOICE`)만.
   ============================================================ */

import { foldArabic } from '../text/specialty.js';
import { TTS, VOICE } from '../config.js';

/** 대안을 몇 개까지 보나 — `VOICE.MAX_ALTS` 한 곳(인식기의 `maxAlternatives` 와 같은 값). */
export const MAX_ALTS = VOICE.MAX_ALTS;

/** `[결정 ①]` 한 낱말 동의어의 포함 일치를 허락하는 말 전체의 낱말 수 상한. */
export const PART_MAX_WORDS = VOICE.PART_MAX_WORDS;

/** 명령 언어 설정값. */
export const CMD_LANGS = Object.freeze(['auto', 'ar', 'en']);

/* ════════════════════════════════════════════════════════
   1. 동의어 표 — 한 곳(`VOICE_COMMANDS`)에만 둔다
   ════════════════════════════════════════════════════════ */

// `[검토 — Nour·운영자]` 아랍어 칸 전부(표준 + 시리아·레반트 구어 + 화면 단추 낱말 + 아랍 문자로 적은 영어 차용어).
//   화면 단추 낱말(i18n/ar.js): «تشغيل»(play) · «إيقاف مؤقت»(pause) · «للخلف»(prev) · «للأمام»(next) · «إيقاف»(readalong off).
//   표기 변형(شغّل/شغل, أعد/اعد …)은 정규화가 같은 꼴로 접는다 — 표에 둘 다 두는 것은 읽는 사람을 위해서다.
// 칸: ar(아랍어) · arLoan(아랍 문자 영어 차용어 — ar 모드에서만) · en(영어) · exact(전체 일치에서만 쓰는 낱말 — 위 칸에도 있어야 한다).
// `[9b-2]` 표 손질(9b-1 Review 9b1R-2 · `r9b1/alt` 시험 — 놓침 13 → 4): 관사 없는 구(«وقف ترجمة» …)·자연스러운 구("read it again" …)를
//   더하고, 뜻이 둘인 낱말(«شغل» "일" · «بعده» "아직" · «قدام»·«ورا» 장소 · «تابع» "따라가다" · «ترجمة»·«ترجم»)은 `exact` 로 —
//   혼자 말할 때만 명령이다. `[검토 — Nour·운영자]` 더한 낱말 전부.
// `enabled:false` = 표에 자리만(explain — 11a 결정 뒤 켠다, 9b-D14). 꺼진 동안 이 말은 nomatch 가 아니라 `enabled:false` 로 돌아온다.
const RAW = [
  {
    id: 'play', enabled: true,
    ar: ['تشغيل', 'شغل', 'شغّل', 'ابدأ', 'ابدا', 'اقرأ', 'اقرا', 'استمر', 'تابع', 'كمل', 'كمّل', 'كفي', 'كفّي', 'يلا'],
    arLoan: ['بلاي'],
    en: ['play', 'start', 'read', 'resume', 'continue', 'go'],
    exact: ['يلا', 'go', 'شغل', 'شغّل', 'تابع']
  },
  {
    id: 'pause', enabled: true,
    // `[9b-3]` «أوقف»(표준 명령형 "멈춰" — 9b2R-2 놓침). `[검토 — Nour·운영자]`
    ar: ['قف', 'توقف', 'وقف', 'وقّف', 'إيقاف', 'إيقاف مؤقت', 'اسكت', 'خلص', 'بس', 'استنى', 'لحظة', 'استنى شوي', 'أوقف'],
    arLoan: ['ستوب'],
    en: ['stop', 'pause', 'wait', 'hold on', 'quiet', 'wait a second', 'wait a minute'],
    exact: ['بس', 'خلص', 'لحظة', 'استنى', 'wait']
  },
  {
    id: 'next', enabled: true,
    ar: ['التالي', 'التالية', 'للأمام', 'بعده', 'بعدها', 'اللي بعده', 'قدام', 'تخطى', 'الجملة التالية'],
    arLoan: ['نكست'],
    en: ['next', 'forward', 'skip'],
    exact: ['بعده', 'بعدها', 'قدام']
  },
  {
    id: 'prev', enabled: true,
    ar: ['السابق', 'السابقة', 'للخلف', 'قبله', 'قبلها', 'اللي قبله', 'ورا', 'ارجع', 'رجوع', 'الجملة السابقة',
      'رجعني'],
    arLoan: ['باك'],
    en: ['previous', 'back', 'go back'],
    exact: ['ورا']
  },
  {
    id: 'again', enabled: true,
    ar: ['أعد', 'اعد', 'عيد', 'إعادة', 'كرر', 'كرّر', 'مرة ثانية', 'مرة تانية', 'كمان مرة', 'من جديد', 'عيدها'],
    arLoan: ['ريبيت'],
    // `[9b-1 더함]` 'read again' — 없으면 read(play)·again 같은 길이로 모호해진다. `[9b-2]` 'read it again' 도 같은 까닭.
    en: ['again', 'repeat', 'replay', 'once more', 'read again', 'read it again', 'one more time', 'say again'],
    exact: []
  },
  {
    id: 'trOn', enabled: true,
    ar: ['ترجم', 'ترجمة', 'شغل الترجمة', 'افتح الترجمة', 'مع الترجمة', 'الترجمة', 'شغل ترجمة', 'افتح ترجمة'],
    arLoan: [],
    en: ['translate', 'translation on', 'with translation', 'turn on translation'],
    exact: ['الترجمة', 'ترجمة', 'ترجم']
  },
  {
    id: 'trOff', enabled: true,
    ar: ['بلا ترجمة', 'بدون ترجمة', 'وقف الترجمة', 'سكر الترجمة', 'سكّر الترجمة', 'طفي الترجمة', 'اطفي الترجمة',
      'إيقاف الترجمة', 'إلغاء الترجمة', 'وقف ترجمة', 'سكر ترجمة', 'طفي ترجمة', 'شيل الترجمة',
      // `[9b 다듬기 Review 낮음-1]` «أوقف»(pause)를 더하며 «أوقف الترجمة» 가 pause 로 가던 새 혼동을 고친다. `[검토 — Nour·운영자]`
      'أوقف الترجمة', 'أوقف ترجمة'],
    arLoan: [],
    // `[9b-3]` 관사 든 꼴 — "stop the translation" 이 pause("stop")로 가던 혼동을 고친다(9b2R-2). `[검토 — Nour·운영자]`
    // `[9b 다듬기 Review 낮음-1]` "stop translating"·"pause the translation"(pause 로 가던 혼동). `[검토 — Nour·운영자]`
    en: ['no translation', 'translation off', 'stop translation', 'turn off translation', 'stop the translation',
      'turn off the translation', 'stop translating', 'pause the translation'],
    exact: []
  },
  {
    id: 'slower', enabled: true,
    ar: ['أبطأ', 'ابطأ', 'أبطئ', 'ببطء', 'بشويش', 'على مهل', 'شوي شوي', 'خفف', 'بطيء', 'نزل السرعة'],
    arLoan: [],
    en: ['slower', 'slow down', 'slow'],
    // `[9b-3]` 형용사 "slow"·«بطيء» 는 혼자 말할 때만 — "too slow"·«كتير بطيء»·"it's slow"(빠르게를 원함)가
    //   slower 가 되던 반대 동작을 막는다(9b2R-9 중-2). `[검토 — Nour·운영자]`
    exact: ['slow', 'بطيء']
  },
  {
    id: 'faster', enabled: true,
    ar: ['أسرع', 'اسرع', 'بسرعة', 'سرع', 'سرّع', 'أسرع شوي', 'زيد السرعة'],
    arLoan: [],
    en: ['faster', 'speed up', 'quicker', 'speed it up'],
    exact: ['بسرعة']   // "빨리" — «تعال لهون بسرعة» 같은 일상 문장(9b1R-2)
  },
  {
    id: 'explain', enabled: false,
    ar: ['اشرح', 'شرح', 'فسر', 'وضح', 'اشرح هنا'],
    arLoan: [],
    en: ['explain', 'explain this'],
    exact: []
  }
];

const freezeList = (a) => Object.freeze((a || []).slice());

/** 명령 표 — `{id, enabled, ar, arLoan, en, exact}`(배열은 얼어 있다). 순서 = spec 17-1-2 4절 표. */
export const VOICE_COMMANDS = Object.freeze(RAW.map((r) => Object.freeze({
  id: r.id, enabled: r.enabled !== false,
  ar: freezeList(r.ar), arLoan: freezeList(r.arLoan), en: freezeList(r.en), exact: freezeList(r.exact)
})));

/** 명령 id 목록(표 순서). */
export const COMMAND_IDS = Object.freeze(VOICE_COMMANDS.map((c) => c.id));

/**
 * **의도된 공유** — 같은 정규화 꼴이 두 명령에 들어가는 것. 이 목록 밖의 공유는 표 무결성 위반이다
 * (tests/voice-commands-9b.test.mjs C3). 값 = 그 꼴이 가는 명령(정렬). 지금은 없다.
 * 공유된 꼴이 전체 일치하면 모호(무효)로 다룬다.
 */
export const SHARED_FORMS = Object.freeze({});

/* ════════════════════════════════════════════════════════
   2. 정규화
   ════════════════════════════════════════════════════════ */

const AR_DIGIT_RE = /[٠-٩]/g;     // U+0660–0669 아랍·인도 숫자
const FA_DIGIT_RE = /[۰-۹]/g;     // U+06F0–06F9 페르시아 숫자
// spec 의 목록(.,!?؟،؛…"'«»-) + 유니코드 문장부호 전부(\p{P}) — 인식기가 어떤 부호를 붙일지 모른다.
const PUNCT_RE = /[\p{P}.,!?؟،؛…"'«»\-]/gu;

/** 앞뒤에서 떼는 군말 — 정규화한 꼴로 비교한다. `[검토 — Nour·운영자]` 아랍어. */
export const FILLERS = Object.freeze(['من فضلك', 'لو سمحت', 'رجاء', 'يا', 'طيب', 'please', 'ok', 'okay', 'hey']);

/** 정규화 — 군말 떼기 **전**까지. 동의어 표의 꼴도 이것으로 만든다. */
export function normalizeBase(s) {
  return foldArabic(s)
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(AR_DIGIT_RE, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(FA_DIGIT_RE, (c) => String(c.charCodeAt(0) - 0x06F0))
    .toLowerCase()
    .replace(PUNCT_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const FILLER_TOKENS = FILLERS.map((f) => normalizeBase(f).split(' '))
  .sort((a, b) => b.length - a.length);   // 긴 군말 먼저

function startsWith(tokens, sub) {
  if (sub.length > tokens.length) return false;
  for (let i = 0; i < sub.length; i++) if (tokens[i] !== sub[i]) return false;
  return true;
}
function endsWith(tokens, sub) {
  const off = tokens.length - sub.length;
  if (off < 0) return false;
  for (let i = 0; i < sub.length; i++) if (tokens[off + i] !== sub[i]) return false;
  return true;
}

/** 앞뒤 군말 떼기 — 떼고 남는 낱말이 1개 이상일 때만. 낱말 배열을 받아 새 배열을 돌려준다. */
function stripFillers(tokens) {
  let t = tokens.slice();
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of FILLER_TOKENS) {
      if (t.length > f.length && startsWith(t, f)) { t = t.slice(f.length); changed = true; }
      if (t.length > f.length && endsWith(t, f)) { t = t.slice(0, t.length - f.length); changed = true; }
    }
  }
  return t;
}

/** 인식된 말 하나 → 비교 꼴(spec 17-1-2 4절 "정규화"). 빈 입력 → ''. */
export function normalizeUtterance(s) {
  const base = normalizeBase(s);
  if (!base) return '';
  return stripFillers(base.split(' ')).join(' ');
}

/* ════════════════════════════════════════════════════════
   3. 색인 — 표에서 한 번 만든다
   ════════════════════════════════════════════════════════ */

/**
 * 표 하나(`'ar'` = ar+arLoan, `'en'` = en) → `{full: Map(form → Set(id)), parts: [{form, tokens, id}]}`.
 * `parts` 는 포함 일치에 쓰는 것 — `exact` 낱말은 빠진다.
 */
function buildIndex(which) {
  const full = new Map();
  const parts = [];
  const seen = new Set();
  for (const c of VOICE_COMMANDS) {
    const list = which === 'ar' ? c.ar.concat(c.arLoan) : c.en;
    const exact = new Set(c.exact.map(normalizeBase));
    for (const syn of list) {
      const form = normalizeBase(syn);
      if (!form) continue;
      if (!full.has(form)) full.set(form, new Set());
      full.get(form).add(c.id);
      const key = c.id + '\u0000' + form;
      if (exact.has(form) || seen.has(key)) continue;
      seen.add(key);
      parts.push({ form: form, tokens: form.split(' '), id: c.id });
    }
  }
  return { full: full, parts: parts };
}

let INDEX = null;
function index(which) {
  if (!INDEX) INDEX = { ar: buildIndex('ar'), en: buildIndex('en') };
  return INDEX[which];
}

/** 명령 언어별로 볼 표 순서. */
export function tablesFor(lang) {
  return lang === 'ar' ? ['ar', 'en'] : ['en'];
}

/* ════════════════════════════════════════════════════════
   4. 매칭
   ════════════════════════════════════════════════════════ */

/** `sub` 가 `tokens` 안에 낱말 경계로 이어져 나오는 시작 위치들. */
function runsOf(tokens, sub) {
  const n = sub.length;
  const at = [];
  for (let i = 0; i + n <= tokens.length; i++) {
    let ok = true;
    for (let k = 0; k < n; k++) if (tokens[i + k] !== sub[k]) { ok = false; break; }
    if (ok) at.push(i);
  }
  return at;
}

function containsRun(tokens, sub) { return runsOf(tokens, sub).length > 0; }

/**
 * `[결정 ② — 운영자 2026-11-15]` 부정어 — 맞은 구 **밖**에 있으면 그 대안은 무효. 정규화한 꼴로 비교한다
 * (영어 축약 "don't" 는 정규화에서 "don t" 두 낱말이 된다 — 그 꼴 그대로 둔다). 언어를 가리지 않고 한 목록
 * (ar 모드가 라틴 "don't stop" 을 영어 표로 볼 때도 같은 규칙). `[검토 — Nour·운영자]` 아랍어 칸.
 * «لا»(표준 "말라")·«ما»(레반트 부정 "안")·«مش»·«مو»(레반트 "아니다")·«بلاش»(레반트 "…하지 마" — 9b-3). «بلا»(…없이)는 낱말이 달라 여기 들지 않는다 —
 * «بلا ترجمة» 는 동의어 그대로 trOff.
 */
export const NEGATORS = Object.freeze({
  en: Object.freeze(['not', 'never', 'dont', "don't", 'do not', "doesn't", "didn't", "won't", "can't", 'cannot']),
  // `[9b-3]` «بلاش»("…하지 마" — «بلاش توقف» 가 pause 가 되던 반대 동작, 9b2R-9 중-2). `[검토 — Nour·운영자]`
  ar: Object.freeze(['لا', 'ما', 'مش', 'مو', 'بلاش'])
});

const NEG_TOKENS = NEGATORS.en.concat(NEGATORS.ar).map((s) => normalizeBase(s).split(' '));

/**
 * 부정어가 `covered`(맞은 구가 차지한 낱말 자리) 밖에 있나.
 * @param {string[]} tokens
 * @param {boolean[]} covered
 */
function negatedOutside(tokens, covered) {
  for (const neg of NEG_TOKENS) {
    for (const i of runsOf(tokens, neg)) {
      for (let k = 0; k < neg.length; k++) if (!covered[i + k]) return true;
    }
  }
  return false;
}

/**
 * 정규화한 말(숫자 뗀 것) 하나를 표 하나에서 찾는다.
 * @returns {{kind:'match', id, how:'full'|'part', form} | {kind:'ambiguous', ids} | {kind:'negated', id, form} | {kind:'none'}}
 */
function matchInTable(text, which) {
  const ix = index(which);
  const hit = ix.full.get(text);
  if (hit) {
    // 전체 일치 — 말 전체가 동의어다. 부정어가 있다면 동의어 **안**이다(«بلا ترجمة»·"no translation").
    if (hit.size === 1) return { kind: 'match', id: hit.values().next().value, how: 'full', form: text };
    return { kind: 'ambiguous', ids: Array.from(hit).sort() };
  }
  const tokens = text.split(' ');
  let best = 0;
  let bestIds = new Set();
  let bestParts = [];
  for (const p of ix.parts) {
    if (p.tokens.length < best) continue;
    // `[결정 ①]` 한 낱말 동의어는 말 전체가 PART_MAX_WORDS 낱말 이하일 때만 포함 일치 후보.
    if (p.tokens.length === 1 && tokens.length > PART_MAX_WORDS) continue;
    if (!containsRun(tokens, p.tokens)) continue;
    if (p.tokens.length > best) { best = p.tokens.length; bestIds = new Set(); bestParts = []; }
    bestIds.add(p.id);
    bestParts.push(p);
  }
  if (best === 0) return { kind: 'none' };
  if (bestIds.size > 1) return { kind: 'ambiguous', ids: Array.from(bestIds).sort() };
  const id = bestIds.values().next().value;
  // `[결정 ②]` 맞은 구(같은 길이의 그 명령 꼴 전부)가 덮은 자리 밖에 부정어가 있으면 무효.
  const covered = new Array(tokens.length).fill(false);
  for (const p of bestParts) {
    for (const i of runsOf(tokens, p.tokens)) for (let k = 0; k < p.tokens.length; k++) covered[i + k] = true;
  }
  if (negatedOutside(tokens, covered)) return { kind: 'negated', id: id, form: bestParts[0].form };
  return { kind: 'match', id: id, how: 'part', form: bestParts[0].form };
}

/** 대안 하나의 글자 — 문자열이든 `{transcript}` 이든. */
function transcriptOf(a) {
  if (a == null) return '';
  if (typeof a === 'string') return a;
  return a.transcript == null ? '' : String(a.transcript);
}

/** 숫자 떼기(9b-D6) — 숫자는 받지 않는다. 붙어 있으면 떼고 명령만 본다. */
function dropNumbers(text) {
  return text.replace(/[0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 명령 id → 표의 항목. */
export function commandById(id) {
  for (const c of VOICE_COMMANDS) if (c.id === id) return c;
  return null;
}

/**
 * 대안 목록 → 명령. **순수.** 확신도는 보지 않는다(9b-D7).
 * @param {Array<string|{transcript:string, confidence?:number}>} alternatives  인식기 순서 그대로
 * @param {'ar'|'en'} lang  명령 언어(`resolveCmdLang` 의 결과)
 * @returns {{
 *   id: string|null,          // 맞은 명령, 없으면 null(= nomatch)
 *   enabled: boolean,         // 표의 enabled(explain 은 false — "아직 없는 기능" 안내)
 *   altIndex: number,         // 몇 번째 대안에서 맞았나(0부터). 못 맞추면 -1
 *   how: 'full'|'part'|null,  // 전체 일치 / 포함 일치
 *   table: 'ar'|'en'|null,    // 어느 표에서 맞았나
 *   heard: string,            // 맞은 대안의 원래 글자 — 못 맞추면 **첫 대안** 글자
 *   trace: Array<{alt:string, norm:string, result:'match'|'ambiguous'|'negated'|'none'|'empty', ids?:string[]}>  // 디버그 기록
 * }}
 */
export function matchCommand(alternatives, lang) {
  const alts = Array.isArray(alternatives) ? alternatives.slice(0, MAX_ALTS) : [];
  const tables = tablesFor(lang);
  const trace = [];
  for (let i = 0; i < alts.length; i++) {
    const raw = transcriptOf(alts[i]);
    const norm = dropNumbers(normalizeUtterance(raw));
    if (!norm) { trace.push({ alt: raw, norm: norm, result: 'empty' }); continue; }
    let res = { kind: 'none' };
    let table = null;
    for (const t of tables) {
      res = matchInTable(norm, t);
      table = t;
      if (res.kind !== 'none') break;     // 앞 표에서 후보가 있으면(모호 포함) 뒤 표를 보지 않는다
    }
    if (res.kind === 'match') {
      trace.push({ alt: raw, norm: norm, result: 'match', ids: [res.id] });
      const c = commandById(res.id);
      return { id: res.id, enabled: !!(c && c.enabled), altIndex: i, how: res.how, table: table, heard: raw, trace: trace };
    }
    if (res.kind === 'negated') {
      // `[Rb — 운영자 2026-11-15]` 맞은 대안보다 부정된 대안을 먼저 만났다 → **그 누름 전체 무효**(뒤 대안은 보지 않는다).
      // 인식기가 아래 대안에서 부정어를 떨어뜨린 꼴(["لا توقف", "توقف"])이 반대 동작이 되지 않게(9b2R-3).
      trace.push({ alt: raw, norm: norm, result: 'negated', ids: [res.id] });
      break;
    }
    if (res.kind === 'ambiguous') trace.push({ alt: raw, norm: norm, result: 'ambiguous', ids: res.ids });
    else trace.push({ alt: raw, norm: norm, result: 'none' });
  }
  return { id: null, enabled: false, altIndex: -1, how: null, table: null, heard: alts.length ? transcriptOf(alts[0]) : '', trace: trace };
}

/* ════════════════════════════════════════════════════════
   5. 명령 언어 · 속도 계단
   ════════════════════════════════════════════════════════ */

/**
 * 설정 `voice.cmdLang` + UI 언어 → 인식·매칭 언어. auto(또는 모르는 값) = UI 가 ar 면 'ar', 그 밖은 'en'.
 * @returns {'ar'|'en'}
 */
export function resolveCmdLang(setting, uiLang) {
  if (setting === 'ar' || setting === 'en') return setting;
  return String(uiLang || '').toLowerCase().split('-')[0] === 'ar' ? 'ar' : 'en';
}

/**
 * 속도 한 칸 위·아래(`TTS.RATE_STEPS`). 지금 값은 가장 가까운 계단으로 맞춘 뒤 움직인다(같은 거리면 느린 쪽 — `snapRate` 와 같다).
 * @param {number} current  지금 속도
 * @param {1|-1} dir        +1 = 빠르게, -1 = 느리게
 * @returns {{rate:number, edge:'min'|'max'|null}}  끝에 있어 못 움직이면 `rate` 그대로 + edge
 */
export function stepRate(current, dir, steps) {
  const st = steps || TTS.RATE_STEPS;
  const v = Number(current);
  let i = st.indexOf(1) >= 0 ? st.indexOf(1) : 0;
  if (current !== null && current !== undefined && current !== '' && Number.isFinite(v)) {
    i = 0;
    for (let k = 1; k < st.length; k++) if (Math.abs(v - st[k]) < Math.abs(v - st[i])) i = k;
  }
  const j = i + (dir > 0 ? 1 : -1);
  if (j < 0) return { rate: st[i], edge: 'min' };
  if (j >= st.length) return { rate: st[i], edge: 'max' };
  return { rate: st[j], edge: null };
}
