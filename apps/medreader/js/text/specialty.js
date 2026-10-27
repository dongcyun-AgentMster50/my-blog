/* ============================================================
   MedReader — 진료과·장기계 다국어 사전 (spec 19-1-4 2-4 "8g-7 설계 뼈대" · 결정 N-D1 (다))

   **순수 모듈이다.** DOM·저장소·pdf.js 를 모른다. 검색어(아무 언어) → 개념(표제어) → 그 책 개요 제목의
   일치 낱말로 "장"을 찾는다. 번역이 아니라 "개념 → 그 책 제목" 대응이다 — "respiratory diseases" 를 쳐도
   CMDT 의 장 제목은 "Pulmonary Disorders" 인 것처럼, 번역만으로는 넘지 못하는 동의어를 넘는다(2-1 의 5).

   ── 책 고유 값 없음 (메모리 원칙: 책·언어별 튜닝 금지) ─────────
   표제어 54개는 일반 의학 분류(진료과·장기계·감염 종류·흔한 큰 주제)로 썼다(Plan 보고서 §3 표 그대로).
   제목 쪽 일치 낱말도 **언어별 일반 의학 어휘**다 — en 책은 `en` 어근, fr 책은 `fr` 별칭, ko 책은 `ko` 별칭,
   (원서가 아랍어인 책이 오면) `ar` 별칭. 특정 책의 제목·장 번호·쪽은 어디에도 없다.

   ── 일치 규칙 ─────────────────────────────────────────────
   검색어 쪽(`conceptsOfQuery`): **낱말 단위**(부분 문자열 아님 — "دموية" 가 "دم" 에 걸리지 않게) ·
     **가장 긴 별칭 우선**(낱말이 많은 별칭이 먼저 낱말을 차지 — "ارتفاع ضغط الدم" → 고혈압, 혈액이 아님) ·
     일반 낱말(أمراض·طب·قسم·جهاز·علم … · 질환·내과 · maladies·médecine · disease·disorder …)은 무게 없음.
     완전히 든 별칭이 하나도 없을 때만, 검색어 낱말이 **별칭의 첫 낱말(들)**인 별칭의 표제어 — 짧게 친 경우.
     `[8g-7b]` 단 그 낱말을 (자리 상관없이) 품은 별칭이 가는 표제어가 `FALLBACK_MAX`(1)개 이하일 때만(«الصحة»·«نقص» 없음).
     `[8g-7b]` **모호한 접은 꼴**(어미 접기가 만든 동철이의 — 사전에서 계산, 지금 `معد`): 그 꼴만 든 별칭은 일반 낱말까지
     맞아야 하고(«الأمراض المعدية»), 별칭이 차지하지 못한 모호한 꼴이 검색어에 남으면 없음(«قرحة معدية»·«النزف المعدي»).
   제목 쪽(`conceptsOfTitle`): 앱 17-8-4 와 같은 꼴 — 라틴 낱말은 4자 이상이면 **낱말 시작 접두**, 3자 이하는
     낱말 전체. 한글은 2자 이상 접두·1자 낱말 전체. 아랍 문자는 접은 낱말 전체. 여러 낱말 어근은 이어진 낱말로.
   아랍어 접기(`foldArabic`): NFKC · 타슈킬·타트윌 제거 · أإآٱ→ا · ة→ه · ى→ي. 낱말마다(`arabicToken`) 앞의
     ال·وال·لل·بال 떼기(남는 글자 2자 이상일 때만 — "ألم" 이 "م" 이 되지 않게) + **형용사꼴 어미 접기**
     (…ية → …ي → 어근, 남는 글자 3자 이상일 때만 — "تنفسية"·"قلبية"·"صدرية" 가 "التنفسي"·"القلب"·"الصدر" 와 만난다).
   라틴 접기: 소문자 · 악센트 제거 · œ→oe · 하이픈·아포스트로피는 낱말 사이 · 5자 이상 낱말의 꼬리 s 하나
     (…ss·…us·…is 제외 — "diabetes"↔"diabète", "aids"·"virus" 는 그대로).

   이 모듈의 결과는 **화면에서만** 쓴다(그릴 때 계산 — `documents`·`searchText`·`OUTLINE_V` 무관, 19-1-4 2-4).
   ============================================================ */

/* ════════════════════════════════════════════════════════
   1. 데이터 — Plan 보고서 `.claude/tasks/medreader-plan-nour-1026-report.md` §3 "사전 초안" 표(54 표제어)
   ════════════════════════════════════════════════════════ */

// `[검토 — Nour·운영자]` 아랍어·프랑스어 별칭(시리아에서 쓰는 진료과 이름 — 예: "الأمراض الصدرية"·"الهضمية") · `[검토 — 운영자]` 한국어 별칭.
// 칸: [표제어, en 제목 쪽 일치 어근, ar 별칭, ko 별칭, fr 별칭] — 칸 안은 '|' 로 나눈다. 표의 순서 그대로.
// `[8g-7b]` 더한 ar 별칭 2개(각 칸 끝) `[검토 — Nour·운영자]`: gi «المعدي المعوي»(위장관 — «الجهاز المعدي المعوي» 가 감염으로
//   가지 않게, 가장 긴 별칭 우선으로 이긴다) · heme «الأمراض الدموية»(혈액 질환 — 심장·혈관 별칭의 꾸밈말로 새지 않게).
// `[8g-7b]` 짧게 친 꼴 6개(각 칸 끝, 뜻이 하나뿐인 것만 — 폴백 "첫 낱말" 규칙으로 잃은 것) `[검토 — Nour·운영자]`:
//   bact «الجرثومية» · fungal «الفطرية» · ent «الأذن» · gyn «المرأة» · vasc «الأوعية» · viral «الفيروسية».
//   더하지 않음: «الرجل»(남자/다리) · «الجنسية»(성/국적) — 뜻이 둘. «فيروس» 단독도 별칭은 아님(접은 꼴이 같아 바이러스로 간다).
const RAW = [
  ['cardio', 'cardiology|cardiac|cardiovascular|heart|coronary|cardiomyopathy|arrhythmia|valvular', 'أمراض القلب|طب القلب|القلب|القلب والأوعية الدموية', '심장내과|순환기내과|심장|순환기', 'cardiologie|cœur|maladies cardiovasculaires'],
  ['pulm', 'pulmonary|pulmonology|respiratory|lung', 'أمراض الجهاز التنفسي|الجهاز التنفسي|الأمراض الصدرية|الصدرية|طب الرئة|الرئة|أمراض الرئة|الصدر', '호흡기내과|호흡기|폐', 'pneumologie|maladies respiratoires|poumon'],
  ['icu', 'critical care|intensive care', 'العناية المركزة|الرعاية الحرجة', '중환자의학|중환자실', 'réanimation|soins intensifs'],
  ['gi', 'gastrointestinal|gastroenterology|digestive|intestinal|bowel|esophagus|stomach', 'أمراض الجهاز الهضمي|الجهاز الهضمي|الهضمية|طب الجهاز الهضمي|المعدي المعوي', '소화기내과|소화기', 'gastro-entérologie|appareil digestif'],
  ['liver', 'liver|hepatic|hepatology|biliary|gallbladder', 'الكبد|أمراض الكبد|القنوات الصفراوية', '간|간담췌|담도', 'hépatologie|foie|voies biliaires'],
  ['pancreas', 'pancreas|pancreatic', 'البنكرياس', '췌장', 'pancréas'],
  ['nephro', 'kidney|renal|nephrology', 'أمراض الكلى|الكلى|الكلية|طب الكلى', '신장내과|신장|콩팥', 'néphrologie|rein'],
  ['uro', 'urology|urologic|urinary|prostate|bladder', 'المسالك البولية|الجهاز البولي|البروستات', '비뇨의학과|비뇨기과|비뇨기', 'urologie|voies urinaires'],
  ['lytes', 'electrolyte|acid base|fluid', 'الشوارد|الكهارل|التوازن الحمضي القاعدي|السوائل والكهارل', '전해질|산염기', 'électrolytes|équilibre acido-basique'],
  ['endo', 'endocrine|endocrinology|hormone|gland', 'الغدد الصماء|أمراض الغدد|الغدد|الهرمونات', '내분비내과|내분비', 'endocrinologie|glandes'],
  ['thyroid', 'thyroid', 'الغدة الدرقية|الدرقية', '갑상선|갑상샘', 'thyroïde'],
  ['pituitary', 'pituitary', 'الغدة النخامية|النخامية', '뇌하수체', 'hypophyse'],
  ['adrenal', 'adrenal', 'الغدة الكظرية|الكظرية', '부신', 'surrénale'],
  ['bone', 'parathyroid|bone metabolism|osteoporosis|calcium', 'جارات الدرقية|استقلاب العظام|هشاشة العظام|الكالسيوم', '부갑상선|골대사|골다공증', 'parathyroïde|ostéoporose|métabolisme osseux'],
  ['dm', 'diabetes|glucose|hypoglycemia', 'السكري|داء السكري|مرض السكر|نقص السكر', '당뇨병|당뇨|저혈당', 'diabète|hypoglycémie'],
  ['lipid', 'lipid|cholesterol|dyslipidemia', 'الدهون|اضطرابات الدهون|الكوليسترول', '지질|이상지질혈증|콜레스테롤', 'lipides|dyslipidémie|cholestérol'],
  ['nutr', 'nutrition|nutritional|obesity', 'التغذية|السمنة', '영양|비만', 'nutrition|obésité'],
  ['heme', 'hematology|blood disorder|blood disease|anemia|hemostasis|thrombosis|bleeding|coagulation', 'أمراض الدم|طب الدم|الدم|فقر الدم|التخثر|النزف|الأمراض الدموية', '혈액내과|혈액|빈혈|지혈|혈전', 'hématologie|sang|anémie|hémostase|thrombose'],
  ['onc', 'cancer|oncology|tumor|neoplasm|malignancy', 'الأورام|السرطان|طب الأورام', '종양내과|종양|암', 'oncologie|cancer|tumeur'],
  ['id', 'infectious|infection|antimicrobial|antibiotic|anti infective', 'الأمراض المعدية|العدوى|الأمراض الإنتانية|الإنتان|المضادات الحيوية', '감염내과|감염|항생제', 'maladies infectieuses|infection|antibiotiques'],
  ['hiv', 'hiv|aids', 'فيروس نقص المناعة البشرية|الإيدز', 'HIV|에이즈', 'VIH|sida'],
  ['viral', 'viral|virus', 'الفيروسات|العدوى الفيروسية|الفيروسية', '바이러스', 'virus|viral'],
  ['bact', 'bacterial|bacteria', 'البكتيريا|العدوى الجرثومية|الجراثيم|الجرثومية', '세균', 'bactérie|bactérien'],
  ['fungal', 'fungal|mycotic|mycosis', 'الفطريات|العدوى الفطرية|الفطرية', '진균|곰팡이', 'mycose|fongique'],
  ['parasite', 'parasitic|protozoal|helminthic|helminth', 'الطفيليات|الديدان', '기생충|원충', 'parasitose|parasites'],
  ['rheum', 'rheumatology|rheumatologic|rheumatic|arthritis|autoimmune', 'الروماتيزم|أمراض الروماتيزم|التهاب المفاصل|المناعة الذاتية', '류마티스내과|류마티스|관절염', 'rhumatologie|arthrite'],
  ['immuno', 'immunology|immunologic|allergy|allergic', 'المناعة|الحساسية', '알레르기|면역', 'immunologie|allergie'],
  ['neuro', 'neurology|neurologic|nervous system|brain|stroke', 'الأمراض العصبية|الجهاز العصبي|طب الأعصاب|الأعصاب|الدماغ', '신경과|신경|뇌', 'neurologie|système nerveux'],
  ['psych', 'psychiatry|psychiatric|mental', 'الطب النفسي|الأمراض النفسية|النفسية', '정신건강의학과|정신과', 'psychiatrie'],
  ['addict', 'substance use|addiction|alcohol', 'الإدمان|تعاطي المخدرات', '물질 사용|중독', 'addiction|toxicomanie'],
  ['derm', 'dermatology|dermatologic|skin', 'الأمراض الجلدية|الجلدية|الجلد', '피부과|피부', 'dermatologie|peau'],
  ['eye', 'ophthalmology|eye|eyes', 'طب العيون|العيون|العين', '안과|눈', 'ophtalmologie|yeux|œil'],
  ['ent', 'otolaryngology|ear|nose|throat|ent', 'الأنف والأذن والحنجرة|أنف وأذن وحنجرة|الأذن', '이비인후과', 'ORL|oto-rhino-laryngologie'],
  ['obs', 'obstetrics|obstetric|pregnancy', 'التوليد|الحمل', '산과|임신', 'obstétrique|grossesse'],
  ['gyn', 'gynecology|gynecologic|women', 'أمراض النساء|النسائية|صحة المرأة|المرأة', '부인과|산부인과', 'gynécologie|santé des femmes'],
  ['breast', 'breast', 'الثدي', '유방', 'sein'],
  ['andro', 'male|hypogonadism|andrology', 'الذكورة|أمراض الذكورة|صحة الرجل', '남성의학|남성', 'andrologie'],
  ['geri', 'geriatric|geriatrics|elderly|older adult', 'طب الشيخوخة|المسنين', '노인의학|노인', 'gériatrie'],
  ['pall', 'palliative|pain', 'الرعاية التلطيفية|الألم', '완화의료|통증', 'soins palliatifs|douleur'],
  ['prev', 'prevention|preventive|health promotion|screening', 'الطب الوقائي|الوقاية', '예방의학|예방', 'prévention|médecine préventive'],
  ['periop', 'preoperative|perioperative|surgery|surgical|anesthesia', 'ما قبل الجراحة|التخدير|الجراحة', '수술 전|마취|외과', 'préopératoire|anesthésie|chirurgie'],
  ['emerg', 'emergency|emergencies|environmental', 'الطوارئ|طب الطوارئ', '응급의학|응급', 'urgences'],
  ['tox', 'poisoning|toxicology|overdose', 'التسمم|السموم', '독성학|중독', 'toxicologie|intoxication'],
  ['genetic', 'genetic|genomic', 'الوراثة|الأمراض الوراثية|علم الوراثة', '유전|유전체', 'génétique'],
  ['ortho', 'orthopedic|orthopedics|sports|musculoskeletal', 'جراحة العظام|العظام|الطب الرياضي', '정형외과|스포츠의학', 'orthopédie|médecine du sport'],
  ['vasc', 'vascular|vessel|arterial|venous|lymphatic', 'الأوعية الدموية|الشرايين|الأوردة|الجهاز اللمفاوي|الأوعية', '혈관|림프', 'vasculaire|vaisseaux'],
  ['htn', 'hypertension|blood pressure', 'ارتفاع ضغط الدم|ضغط الدم', '고혈압', 'hypertension'],
  ['peds', 'pediatric|pediatrics|neonatal|child', 'طب الأطفال|الأطفال', '소아청소년과|소아과', 'pédiatrie'],
  ['pharm', 'pharmacology|drug|therapeutic|pharmacogenetic', 'الأدوية|علم الأدوية', '약물|약리', 'pharmacologie|médicaments'],
  ['sx', 'symptom|symptoms|manifestation|manifestations', 'الأعراض|الأعراض الشائعة', '증상', 'symptômes'],
  ['dx', 'diagnostic|diagnosis|laboratory', 'التشخيص|الفحوص المخبرية', '진단|검사', 'diagnostic|examens'],
  ['rad', 'radiology|imaging', 'الأشعة|التصوير الطبي', '영상의학과|영상', 'radiologie|imagerie'],
  ['sexual', 'sexual|gender', 'الصحة الجنسية', '성 건강', 'santé sexuelle'],
  ['foot', 'podiatric|podiatry|foot', 'القدم', '족부', 'podologie|pied']
];

const split = (s) => String(s).split('|').map((x) => x.trim()).filter(Boolean);

/** 표제어 목록 — `{id, en, ar, ko, fr}`(배열은 얼어 있다). 순서 = Plan 표. */
export const SPECIALTIES = Object.freeze(RAW.map((r) => Object.freeze({
  id: r[0], en: Object.freeze(split(r[1])), ar: Object.freeze(split(r[2])), ko: Object.freeze(split(r[3])), fr: Object.freeze(split(r[4]))
})));

/**
 * **의도된 공유** — 접은 별칭(검색어 쪽 낱말 열)이 둘 이상의 표제어로 가는 것. 이 목록 밖의 공유는 사전 무결성 위반이다
 * (tests/specialty-8g7.test.mjs). 값 = 그 별칭이 가는 표제어(정렬).
 *   중독 — 한국어 한 낱말이 "물질 중독(addiction)"과 "독성 중독(poisoning)"을 다 뜻한다.
 */
export const SHARED_ALIASES = Object.freeze({ '중독': Object.freeze(['addict', 'tox']) });

/* ════════════════════════════════════════════════════════
   2. 접기
   ════════════════════════════════════════════════════════ */

const TASHKEEL_RE = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const AR_LETTER_RE = /\p{Script=Arabic}/u;
const HANGUL_RE = /\p{Script=Hangul}/u;

/** 아랍어 글자 접기(낱말 경계는 그대로) — NFKC · 타슈킬·타트윌 제거 · أإآٱ→ا · ة→ه · ى→ي. 아랍 문자 밖은 건드리지 않는다. */
export function foldArabic(s) {
  return String(s == null ? '' : s).normalize('NFKC').replace(TASHKEEL_RE, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
}

/**
 * 접은 아랍어 낱말 하나 → 비교 꼴. 앞의 정관사·접속사(ال·وال·لل·بال)를 떼고(남는 글자 2자 이상일 때만),
 * 형용사꼴 어미를 접는다: …يه → …ي(남는 글자 2자 이상) → …(꼬리 ي, 남는 글자 3자 이상).
 */
export function arabicToken(w) {
  let s = arabicBase(w);
  if (s.endsWith('يه') && s.length - 1 >= 3) s = s.slice(0, -1);
  if (s.endsWith('ي') && s.length - 1 >= 3) s = s.slice(0, -1);
  return s;
}

/** 접은 아랍어 낱말의 **겉꼴** — 앞의 ال·وال·لل·بال 만 떼고(남는 글자 2자 이상일 때만) 어미는 그대로. 모호한 접은 꼴을 가리는 데 쓴다. */
function arabicBase(w) {
  const s = String(w || '');
  const m = /^(?:وال|بال|لل|ال)/.exec(s);
  return m && s.length - m[0].length >= 2 ? s.slice(m[0].length) : s;
}

/** 라틴 낱말 하나 → 비교 꼴(이미 소문자·악센트 없음). 5자 이상이면 꼬리 s 하나를 뗀다(…ss·…us·…is 제외). */
function latinToken(w) {
  return w.length >= 5 && w.endsWith('s') && !/(?:ss|us|is)$/.test(w) ? w.slice(0, -1) : w;
}

/** 라틴·한글 접기 — 소문자 · 악센트 제거 · œ→oe · æ→ae. */
function foldLatin(s) {
  return String(s).toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}

/**
 * 글자 → 낱말 `[{f, o, s}]`(f = 비교 꼴, o = 원래 글자, s = 겉꼴 — 어미·꼬리 s 접기 전). 낱말 = 글자·숫자의 이어짐(하이픈·아포스트로피·부호는 사이).
 * 아랍 문자 낱말은 `foldArabic`+`arabicToken`, 한글은 그대로, 라틴은 `foldLatin`+`latinToken`.
 */
export function tokensOf(s) {
  const out = [];
  const src = String(s == null ? '' : s).normalize('NFKC');
  const re = /[\p{L}\p{N}\p{M}]+/gu;
  let m;
  while ((m = re.exec(src))) {
    const o = m[0];
    let f, s;
    if (AR_LETTER_RE.test(o)) { s = arabicBase(foldArabic(o)); f = arabicToken(foldArabic(o)); }
    else if (HANGUL_RE.test(o)) { s = o; f = o; }
    else { s = foldLatin(o); f = latinToken(s); }
    if (f) out.push({ f: f, o: o, s: s });
  }
  return out;
}

/**
 * 일반 낱말 — 검색어·별칭 쪽에서 무게가 없다(접은 꼴). 진료과 이름 앞뒤에 흔히 붙는 말과 관사·전치사.
 * "الباطنة"(내과 = 책 전체)·"내과" 혼자는 아무 장도 가리키지 않는다(의도 — 19-1-4 2-3).
 */
export const GENERAL_WORDS = Object.freeze(new Set([
  // ar (접은 꼴)
  'امراض', 'مرض', 'داء', 'طب', 'قسم', 'جهاز', 'علم', 'اضطرابات', 'شعبه', 'عياده', 'باطنه',
  // ko
  '질환', '질병', '내과',
  // fr · en (접은 꼴 — 꼬리 s 를 뗀 뒤)
  'maladie', 'medecine', 'trouble', 'service', 'appareil', 'de', 'des', 'du', 'la', 'le', 'les', 'et', 'en', 'd', 'l',
  'disease', 'disorder', 'medicine', 'department', 'of', 'the', 'and'
]));

const keyOf = (toks) => toks.join(' ');

/* ════════════════════════════════════════════════════════
   3. 색인 — 모듈을 읽을 때 한 번
   ════════════════════════════════════════════════════════ */

/**
 * `[8g-7b]` **모호한 접은 꼴** — 어미 접기(아랍어 …ي·…ية, 라틴 꼬리 s)로 **바뀐** 별칭 낱말들이 서로 다른 겉꼴에서 같은
 * 접은 꼴이 되고, 그 겉꼴들이 가는 표제어가 다른 것(접기가 만든 동철이의). 겉꼴이 곧 접은 꼴인 낱말이 있으면(명사 «فيروس»)
 * 그것은 세지 않는다. 사전에서 계산한다(낱말 목록을 손으로 두지 않는다). 지금 사전에선 «المعدي»(위의 — gi «المعدي المعوي»)와
 * «المعدية»(감염성 — id «الأمراض المعدية»)가 둘 다 `معد` 가 된다. 타슈킬 없이는 철자로 가를 수 없다.
 */
function buildAmbiguous() {
  const by = new Map();   // f → Map(겉꼴 → Set(id))
  for (const c of SPECIALTIES) {
    for (const a of [].concat(c.ar, c.ko, c.fr, c.en)) {
      for (const t of tokensOf(a)) {
        if (GENERAL_WORDS.has(t.f) || t.s === t.f) continue;   // 접기가 바꾼 낱말만 — 겉꼴이 곧 어근인 낱말(«فيروس»)은 뜻을 붙든다
        if (!by.has(t.f)) by.set(t.f, new Map());
        const m = by.get(t.f);
        if (!m.has(t.s)) m.set(t.s, new Set());
        m.get(t.s).add(c.id);
      }
    }
  }
  const out = new Set();
  for (const [f, m] of by) {
    const sets = [...m.values()].map((x) => [...x].sort().join(','));
    if (m.size >= 2 && new Set(sets).size >= 2) out.add(f);
  }
  return out;
}

const AMBIGUOUS = buildAmbiguous();

/** 모호한 접은 꼴(진단·테스트용, 정렬). */
export const AMBIGUOUS_STEMS = Object.freeze([...AMBIGUOUS].sort());

/**
 * 검색어 쪽 — 접은 낱말 열(일반 낱말 뺌) → 표제어들. 별칭 네 언어(ar·ko·fr·en 어근) 전부.
 * `[8g-7b]` 별칭의 낱말이 **모두 모호한 꼴**이면 그 별칭의 일반 낱말을 `need` 로 남긴다 — 검색어에도 그 일반 낱말이 있어야
 * 맞는다(«الأمراض المعدية» → 감염 · «النزف المعدي»·«قرحة معدية» 는 아님). 항목 `{toks, need, ids}`.
 */
function buildQueryIndex() {
  const map = new Map();
  for (const c of SPECIALTIES) {
    for (const a of [].concat(c.ar, c.ko, c.fr, c.en)) {
      const all = tokensOf(a).map((x) => x.f);
      const toks = all.filter((f) => !GENERAL_WORDS.has(f));
      if (!toks.length) continue;
      const need = toks.every((f) => AMBIGUOUS.has(f)) ? all.filter((f) => GENERAL_WORDS.has(f)) : [];
      const k = keyOf(need.length ? all : toks);
      let e = map.get(k);
      if (!e) { e = { toks: toks, need: need, key: k, ids: [] }; map.set(k, e); }
      if (e.ids.indexOf(c.id) < 0) e.ids.push(c.id);
    }
  }
  // 가장 긴 별칭 우선 — (일반 낱말 뺀) 낱말 수, 그다음 요구하는 일반 낱말 수, 그다음 접은 글자 길이(내림차순). 같으면 먼저 쓴 것.
  return [...map.values()].sort((a, b) => (b.toks.length - a.toks.length) || (b.need.length - a.need.length) ||
    (keyOf(b.toks).length - keyOf(a.toks).length));
}

const QUERY_INDEX = buildQueryIndex();

/** 제목 쪽 — 책 언어별 일치 어근. en 은 `en` 어근을 **그대로**(일반 낱말을 빼지 않는다 — "blood disorder" 가 "blood" 가 되지 않게). */
function buildTitleIndex(lang) {
  const out = [];
  for (const c of SPECIALTIES) {
    const list = lang === 'en' ? c.en : (lang === 'fr' ? c.fr : (lang === 'ko' ? c.ko : (lang === 'ar' ? c.ar : [])));
    for (const a of list) {
      let toks = tokensOf(a).map((x) => x.f);
      if (lang !== 'en') toks = toks.filter((f) => !GENERAL_WORDS.has(f));
      if (toks.length) out.push({ id: c.id, toks: toks });
    }
  }
  return out;
}

const TITLE_INDEX = Object.freeze({ en: buildTitleIndex('en'), fr: buildTitleIndex('fr'), ko: buildTitleIndex('ko'), ar: buildTitleIndex('ar') });

/** 검색어 쪽 색인(진단·테스트용) — `[{key, ids}]`. */
export function queryIndex() {
  return QUERY_INDEX.map((e) => ({ key: e.key, ids: e.ids.slice() }));
}

/* ════════════════════════════════════════════════════════
   4. 검색어 → 표제어
   ════════════════════════════════════════════════════════ */

/** 검색어 → 접은 낱말(일반 낱말 뺌). */
export function queryTokens(q) {
  return tokensOf(q).map((x) => x.f).filter((f) => !GENERAL_WORDS.has(f));
}

/**
 * `[8g-7b]` 짧게 친 경우(완전히 든 별칭이 없을 때)의 넓이 상한 — 검색어 낱말을 품은 별칭(자리 상관없이)이 가는 표제어가
 * 이 수를 넘으면 없음. 1 = 한 표제어의 별칭에만 든 낱말일 때만(«الصحة»·«نقص» 처럼 여러 분야 이름에 든 낱말은 없음).
 */
export const FALLBACK_MAX = 1;

/**
 * 검색어 → 대응 `[{id, key}]`(검색어 안 자리 순). 낱말 단위 · 가장 긴 별칭이 먼저 낱말을 차지한다.
 * `[8g-7b]` 별칭이 차지하지 못한 낱말 중 **모호한 접은 꼴**이 있으면 없음(무엇을 뜻하는지 모른다 — 틀린 장보다 없음).
 * 완전히 든 별칭이 없으면(짧게 친 경우) 검색어 낱말이 **별칭의 첫 낱말(들)**인 별칭의 표제어 — 단, 그 낱말을 품은 별칭이
 * 가는 표제어가 `FALLBACK_MAX` 개 이하일 때만(꾸밈말 «الدموية»·«الطبي» 나 여러 분야에 든 «الصحة» 로 퍼지지 않게).
 * @param {string} q
 * @param {{longestFirst?:boolean}} [opts] longestFirst:false = 별칭 길이 순서를 무시(측정·변이 비교용)
 */
export function queryMatches(q, opts) {
  const T = tokensOf(q).map((x) => x.f);
  const gen = T.map((f) => GENERAL_WORDS.has(f));
  const Q = T.filter((f, j) => !gen[j]);
  if (!Q.length) return [];
  const G = new Set(T.filter((f, j) => gen[j]));
  const longest = !(opts && opts.longestFirst === false);
  const index = longest ? QUERY_INDEX : QUERY_INDEX.slice().sort((a, b) => a.toks.length - b.toks.length);
  const used = new Array(Q.length).fill(false);
  const found = [];
  for (const e of index) {
    if (!e.need.every((w) => G.has(w))) continue;
    const pos = [];
    for (const tok of e.toks) {
      let k = -1;
      for (let j = 0; j < Q.length; j++) if (!used[j] && pos.indexOf(j) < 0 && Q[j] === tok) { k = j; break; }
      if (k < 0) break;
      pos.push(k);
    }
    if (pos.length !== e.toks.length) continue;
    for (const k of pos) used[k] = true;
    for (const id of e.ids) found.push({ id: id, key: e.key, at: Math.min.apply(null, pos) });
  }
  // 차지되지 않은 모호한 꼴 — 그 낱말이 위(gi)인지 감염(id)인지 모른다
  for (let j = 0; j < Q.length; j++) if (!used[j] && AMBIGUOUS.has(Q[j])) return [];
  if (found.length) {
    found.sort((a, b) => a.at - b.at);
    const seen = new Set();
    return found.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))).map((x) => ({ id: x.id, key: x.key }));
  }
  // 짧게 친 경우 — 검색어 낱말이 별칭의 첫 낱말(들)인 별칭. 넓이는 그 낱말을 (자리 상관없이) 품은 별칭 전부로 잰다.
  const ids = [];
  const keys = new Map();
  const spread = new Set();
  for (const e of QUERY_INDEX) {
    if (!Q.every((w) => e.toks.indexOf(w) >= 0)) continue;
    for (const id of e.ids) spread.add(id);
    if (!Q.every((w, j) => e.toks[j] === w)) continue;
    for (const id of e.ids) if (ids.indexOf(id) < 0) { ids.push(id); keys.set(id, e.key); }
  }
  if (!ids.length || spread.size > FALLBACK_MAX) return [];
  return ids.map((id) => ({ id: id, key: keys.get(id) }));
}

/** 검색어 → 표제어 id 들(검색어 안 자리 순, 중복 없음). 아무 언어(ar·ko·fr·en). */
export function conceptsOfQuery(q, opts) {
  return queryMatches(q, opts).map((x) => x.id);
}

/* ════════════════════════════════════════════════════════
   5. 개요 제목 → 표제어
   ════════════════════════════════════════════════════════ */

/** 제목 낱말 하나가 어근 낱말 하나와 맞는가 — 라틴 4자 이상·한글 2자 이상은 낱말 시작 접두, 그 밖은 낱말 전체. */
function tokHit(word, stem) {
  if (HANGUL_RE.test(stem)) return stem.length >= 2 ? word.startsWith(stem) : word === stem;
  if (AR_LETTER_RE.test(stem)) return word === stem;
  return stem.length >= 4 ? word.startsWith(stem) : word === stem;
}

/**
 * 제목 → 대응 `[{id, words}]`(words = 맞은 원래 낱말들 — "사전으로 찾음" 줄이 보인다). 책 언어의 일치 어근만 쓴다.
 * 여러 낱말 어근은 제목 안에서 이어진 낱말이어야 한다. 표제어마다 제목 안 가장 앞의 일치 하나(순서 = 사전 순).
 * @param {string} title
 * @param {string} lang 책(원문) 언어 — 'en'·'fr'·'ko'·'ar'(그 밖은 빈 결과)
 */
export function titleMatches(title, lang) {
  const idx = TITLE_INDEX[String(lang || '')];
  if (!idx) return [];
  const T = tokensOf(title);
  if (!T.length) return [];
  const out = [];
  const byId = new Map();
  for (const e of idx) {
    const n = e.toks.length;
    for (let i = 0; i + n <= T.length; i++) {
      let ok = true;
      for (let k = 0; k < n; k++) if (!tokHit(T[i + k].f, e.toks[k])) { ok = false; break; }
      if (!ok) continue;
      // 표제어마다 제목 안 가장 앞의 일치(같은 자리면 먼저 쓴 어근)
      const prev = byId.get(e.id);
      const m = { id: e.id, words: T.slice(i, i + n).map((x) => x.o).join(' '), at: i };
      if (!prev) { byId.set(e.id, m); out.push(m); } else if (i < prev.at) Object.assign(prev, m);
      break;
    }
  }
  return out;
}

/** 제목 → 표제어 id 들(사전 순). */
export function conceptsOfTitle(title, lang) {
  return titleMatches(title, lang).map((x) => x.id);
}

/**
 * 표제어의 그 언어 이름(목차 탭의 흐린 이름) — 그 언어 별칭의 첫째. 없으면 ''.
 * @param {string} id
 * @param {string} lang 'ar'·'ko'·'fr'·'en'
 */
export function nameOf(id, lang) {
  const c = SPECIALTIES.find((x) => x.id === id);
  const list = c && (lang === 'ar' || lang === 'ko' || lang === 'fr' || lang === 'en') ? c[lang] : null;
  return list && list.length ? list[0] : '';
}
