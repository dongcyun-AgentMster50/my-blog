# 보고 — Nour 요청(2026-10-26) 분류·배치 Plan

지침: `.claude/tasks/medreader-plan-nour-1026.md`. 결과 본문: `apps/medreader/spec.md` **19-1-4**(새 절, 19-1-3 뒤·`## 20.` 앞, 머리 `[신설 2026-10-27 — Plan, 운영자 결정 대기]`) + 19-1 로드맵 두 줄에 `[수정 2026-10-27 — 19-1-4]` 표시(19-1 표의 8g 행 · 19-1-3 §10 권장 순서 머리). 앱 코드·테스트·review.md·index.html 은 읽기만 했다. 커밋하지 않았다.

## 0. 앞부분 큰 묶음

10-18 요청과 같은 글 — 19-1-1 N1–N14 그대로(오케스트레이터 대조, 다른 곳 없음). 원문이 레포에 없어 이 Plan 은 글자 대조를 하지 않았다.

## 1. R1–R6 분류 요약

| # | 요청 | 분류 | 어디로 · 근거 한 줄 |
|---|---|---|---|
| R1 | 아랍어 진료과 이름으로 섹션 시작에 가기 | 장 이동 **됨**(목차 탭) · 아랍어로 찾기 **넣음** | **8g-7 새 단계**(내장 진료과 사전, 호출 0). 지금 아랍어로 치면 적중 0 + "이 책은 English — English 낱말로" 안내뿐(`ui/search.js` 1027·1042행), 목차 탭으로 이끌지 않음 |
| R2 | 언어 학습기 마이크가 음성 명령에 반응 안 함 | **넣지 않음**(시제품 · MedReader 범위 밖) | 언어 학습기는 E4 의 별도 앱 후보. MedReader 음성 명령은 9b(그대로) |
| R3 | 세 언어 원어민 같은 목소리 | 앱 쪽 **됨**(8k) + 기기 안내 **넣음**(앱 변경 0) | Android Chrome 은 voice 이름을 쓰지 않고 `lang` 태그로만 엔진 언어를 정한다 → 질은 기기 TTS 음성 데이터. 클라우드 TTS·Gemini TTS 는 넣지 않음(N-D4) |
| R4 | 원본 쪽에서 읽는 줄 하이라이트 | **됨** | `ui/original.js` `.hl-line` 줄마다 상자 + 스크롤. 안내 «الأصل» → «تشغيل» |
| R5 | 문장·낱말 글꼴 겹침 | **조건부**(스크린숏 먼저) | MedReader 원본 보기에는 글자 층이 없다(`textLayer` 0) — 시제품의 흔한 결함 꼴 `[가정]`. 점검표 8항목 |
| R6 | 단 구성 분석 → 단 우선 읽기 | 2단 **됨** · 3단 **조건부** | `text/columns.js` `orderLines`(띠마다 왼쪽 단 → 오른쪽 단). 3단은 8q-0 → 8q(L-D6), 8q-0 범위에 세 의학 책 다단 경고 쪽 전수 목록을 더함 |

Nour 에게 줄 안내(아랍어 UI 문구 그대로, `i18n/ar.js`): R1 «بحث»(400) → «الفهرس»(408) · R3 «الإعدادات»(17) → «صوت القراءة»(314) → «اتباع إعدادات الهاتف (افتراضي)»(315) · R4 «الأصل»(139) → «تشغيل»(168).

## 2. 결정 표

| # | 쟁점 | 선택지 | 권장 · 이유 |
|---|---|---|---|
| N-D1 | R1 방법 | (가) 안내만 · (나) 단어장 대응(8f 뒤) · (다) **내장 진료과·장기계 사전 = 8g-7** · (라) AI 버튼 · (마) 책마다 개요 제목 AI 번역 1회 · (바) 기기 내 번역 | **(다)** — 호출 0·오프라인, 덮음 99.0%. 번역으로는 동의어(respiratory ↔ Pulmonary)를 못 넘는다. (나)는 질환 이름용으로 8f 뒤 그대로 |
| N-D2 | 8g-7 결과 자리 | (가) **«ابحث» "장" 묶음 + 목차 탭에 흐린 아랍어 이름** · (나) 묶음만 · (다) 목차 이름만 | **(가)** — Nour 는 이미 목차 탭을 쓴다. 같은 사전이라 추가 비용 작음 |
| N-D3 | 8g-7 자리 | (가) **지금 바로, 8e 앞(단독)** · (나) 9b 뒤 8g-6 과 묶음 · (다) 8g-6 을 끌어와 8e 앞 묶음(L-D8 변경) | **(가)** — Nour 직접 요청·작음. 8e 는 자동 회전 답 대기. L-D8 유지 |
| N-D4 | R3 | (가) **기기 안내 + 점검표** · (나) 클라우드 신경망 TTS · (다) Gemini TTS | **(가)** — (나)는 비용 0원·오프라인·13절, (다)는 무료 한도 원칙과 충돌 → 넣지 않음 |
| N-D5 | R6 3단 의심 쪽 | (가) **8q-0 에 세 의학 책 다단 경고 쪽 전수 목록·갈래 추가(앱 무변)** + Nour 가 보낸 쪽 먼저 · (나) Nour 가 쪽을 보낼 때만 | **(가)** — 표본상 CMDT 2026 약 70쪽·Harrison 약 9쪽이 경고. 3단 본문인지 표인지 모른다 |

## 3. R1 사전 측정 결과 `[실측 2026-10-27]`

- 개요(pdf.js 5.6.205 `getOutline`): CMDT 2026 61항목(깊이 1) · CMDT 2021 50(깊이 1) · Harrison 37(깊이 1 17 + 깊이 2 20, 깊이 2 는 전부 QUESTIONS/ANSWERS). 부속(표지·목차·서문·색인 등)과 문제/해답을 빼면 **내용 항목 105**.
- 사전 초안 **54 표제어**(별칭 ar 151 · ko 114 · fr 106). 일치 = 낱말 시작 접두(4자 이상)·3자 이하 낱말 전체(앱 17-8-4 꼴).
- **덮음: CMDT 2026 52/53(98.1%) · CMDT 2021 42/42(100%) · Harrison 10/10(100%) · 합 104/105 = 99.0%.** 못 덮음 1 = "Information Technology in Patient Care". 둘 이상 표제어 21(전부 제목이 실제로 여러 분야). 틀린 장 0(눈 검토).
- 아랍어 합성 질의 31: 27 맞음. 못 찾음 4 = 형용사꼴 "تنفسية"·"قلبية"(Build 에서 형용사 별칭 또는 어미 접기), "الباطنة"(책 전체 — 의도), "الربو"(질환 — 사전 범위 밖). 낱말 단위 + 가장 긴 별칭 우선으로 "ارتفاع ضغط الدم" → 고혈압(혈액 아님).
- 한계·주의: 개요가 장 단위뿐이라 덮음이 높다(내과책 장 = 진료과). 개요 목록을 본 뒤 사전을 써서 치우침 위험 — 측정 뒤 사전은 고치지 않았다. 새 책(외과·약리)에서 다시 잴 것.
- 결과 화면: «ابحث» 맨 위 "장" 묶음(누르면 `tocJump` — 장 첫 쪽 맨 위) + 목차 탭 아랍어 이름(N-D2) + `scriptHint` 에 [«الفهرس» 로] 단추·언어 이름 UI 언어로.
- 영향: **DB 버전·`algoVersion`·`SEARCH.VERSION`·`OUTLINE_V` 모두 무관**(`documents.outline` 은 이미 있음, 대응은 그릴 때 계산). 켜지는 조건 = 검색어 글자 체계 ≠ 책 언어 · `domain` 이 `general` 이면 끔. 라틴 검색 결과는 불변.
- 예상 시간: **2~2.5시간**(Plan 짧게 + Build 1.5 + Review 1), Nour 사전 검토 별도.

R6 표본(`dev/profile.mjs`, algoVersion 12): CMDT 2026 197쪽 중 2단 166(84.3%)·다단 경고 7 · Harrison 243쪽 중 2단 80(32.9%)·경고 3 · CMDT 2021 506쪽 전부 1단.

### 사전 초안 (54 표제어 — ar·fr 는 `[검토 — Nour·운영자]`, ko 는 `[검토 — 운영자]`)

| # | 표제어 | en(제목 쪽 일치 낱말) | ar 별칭 | ko 별칭 | fr 별칭 |
|---|---|---|---|---|---|
| 1 | cardio 심장 | cardiology, cardiac, cardiovascular, heart, coronary, cardiomyopathy, arrhythmia, valvular | أمراض القلب، طب القلب، القلب، القلب والأوعية الدموية | 심장내과, 순환기내과, 심장, 순환기 | cardiologie, cœur, maladies cardiovasculaires |
| 2 | pulm 호흡기 | pulmonary, pulmonology, respiratory, lung | أمراض الجهاز التنفسي، الجهاز التنفسي، الأمراض الصدرية، الصدرية، طب الرئة، الرئة، أمراض الرئة، الصدر | 호흡기내과, 호흡기, 폐 | pneumologie, maladies respiratoires, poumon |
| 3 | icu 중환자 | critical care, intensive care | العناية المركزة، الرعاية الحرجة | 중환자의학, 중환자실 | réanimation, soins intensifs |
| 4 | gi 소화기 | gastrointestinal, gastroenterology, digestive, intestinal, bowel, esophagus, stomach | أمراض الجهاز الهضمي، الجهاز الهضمي، الهضمية، طب الجهاز الهضمي | 소화기내과, 소화기 | gastro-entérologie, appareil digestif |
| 5 | liver 간·담도 | liver, hepatic, hepatology, biliary, gallbladder | الكبد، أمراض الكبد، القنوات الصفراوية | 간, 간담췌, 담도 | hépatologie, foie, voies biliaires |
| 6 | pancreas 췌장 | pancreas, pancreatic | البنكرياس | 췌장 | pancréas |
| 7 | nephro 신장 | kidney, renal, nephrology | أمراض الكلى، الكلى، الكلية، طب الكلى | 신장내과, 신장, 콩팥 | néphrologie, rein |
| 8 | uro 비뇨기 | urology, urologic, urinary, prostate, bladder | المسالك البولية، الجهاز البولي، البروستات | 비뇨의학과, 비뇨기과, 비뇨기 | urologie, voies urinaires |
| 9 | lytes 전해질·산염기 | electrolyte, acid base, fluid | الشوارد، الكهارل، التوازن الحمضي القاعدي، السوائل والكهارل | 전해질, 산염기 | électrolytes, équilibre acido-basique |
| 10 | endo 내분비 | endocrine, endocrinology, hormone, gland | الغدد الصماء، أمراض الغدد، الغدد، الهرمونات | 내분비내과, 내분비 | endocrinologie, glandes |
| 11 | thyroid 갑상선 | thyroid | الغدة الدرقية، الدرقية | 갑상선, 갑상샘 | thyroïde |
| 12 | pituitary 뇌하수체 | pituitary | الغدة النخامية، النخامية | 뇌하수체 | hypophyse |
| 13 | adrenal 부신 | adrenal | الغدة الكظرية، الكظرية | 부신 | surrénale |
| 14 | bone 부갑상선·골대사 | parathyroid, bone metabolism, osteoporosis, calcium | جارات الدرقية، استقلاب العظام، هشاشة العظام، الكالسيوم | 부갑상선, 골대사, 골다공증 | parathyroïde, ostéoporose, métabolisme osseux |
| 15 | dm 당뇨 | diabetes, glucose, hypoglycemia | السكري، داء السكري، مرض السكر، نقص السكر | 당뇨병, 당뇨, 저혈당 | diabète, hypoglycémie |
| 16 | lipid 지질 | lipid, cholesterol, dyslipidemia | الدهون، اضطرابات الدهون، الكوليسترول | 지질, 이상지질혈증, 콜레스테롤 | lipides, dyslipidémie, cholestérol |
| 17 | nutr 영양·비만 | nutrition, nutritional, obesity | التغذية، السمنة | 영양, 비만 | nutrition, obésité |
| 18 | heme 혈액 | hematology, blood disorder, blood disease, anemia, hemostasis, thrombosis, bleeding, coagulation | أمراض الدم، طب الدم، الدم، فقر الدم، التخثر، النزف | 혈액내과, 혈액, 빈혈, 지혈, 혈전 | hématologie, sang, anémie, hémostase, thrombose |
| 19 | onc 종양 | cancer, oncology, tumor, neoplasm, malignancy | الأورام، السرطان، طب الأورام | 종양내과, 종양, 암 | oncologie, cancer, tumeur |
| 20 | id 감염 | infectious, infection, antimicrobial, antibiotic, anti infective | الأمراض المعدية، العدوى، الأمراض الإنتانية، الإنتان، المضادات الحيوية | 감염내과, 감염, 항생제 | maladies infectieuses, infection, antibiotiques |
| 21 | hiv HIV | hiv, aids | فيروس نقص المناعة البشرية، الإيدز | HIV, 에이즈 | VIH, sida |
| 22 | viral 바이러스 | viral, virus | الفيروسات، العدوى الفيروسية | 바이러스 | virus, viral |
| 23 | bact 세균 | bacterial, bacteria | البكتيريا، العدوى الجرثومية، الجراثيم | 세균 | bactérie, bactérien |
| 24 | fungal 진균 | fungal, mycotic, mycosis | الفطريات، العدوى الفطرية | 진균, 곰팡이 | mycose, fongique |
| 25 | parasite 기생충 | parasitic, protozoal, helminthic, helminth | الطفيليات، الديدان | 기생충, 원충 | parasitose, parasites |
| 26 | rheum 류마티스 | rheumatology, rheumatologic, rheumatic, arthritis, autoimmune | الروماتيزم، أمراض الروماتيزم، التهاب المفاصل، المناعة الذاتية | 류마티스내과, 류마티스, 관절염 | rhumatologie, arthrite |
| 27 | immuno 면역·알레르기 | immunology, immunologic, allergy, allergic | المناعة، الحساسية | 알레르기, 면역 | immunologie, allergie |
| 28 | neuro 신경 | neurology, neurologic, nervous system, brain, stroke | الأمراض العصبية، الجهاز العصبي، طب الأعصاب، الأعصاب، الدماغ | 신경과, 신경, 뇌 | neurologie, système nerveux |
| 29 | psych 정신 | psychiatry, psychiatric, mental | الطب النفسي، الأمراض النفسية، النفسية | 정신건강의학과, 정신과 | psychiatrie |
| 30 | addict 물질 사용 | substance use, addiction, alcohol | الإدمان، تعاطي المخدرات | 물질 사용, 중독 | addiction, toxicomanie |
| 31 | derm 피부 | dermatology, dermatologic, skin | الأمراض الجلدية، الجلدية، الجلد | 피부과, 피부 | dermatologie, peau |
| 32 | eye 안과 | ophthalmology, eye, eyes | طب العيون، العيون، العين | 안과, 눈 | ophtalmologie, yeux, œil |
| 33 | ent 이비인후 | otolaryngology, ear, nose, throat, ent | الأنف والأذن والحنجرة، أنف وأذن وحنجرة | 이비인후과 | ORL, oto-rhino-laryngologie |
| 34 | obs 산과 | obstetrics, obstetric, pregnancy | التوليد، الحمل | 산과, 임신 | obstétrique, grossesse |
| 35 | gyn 부인과 | gynecology, gynecologic, women | أمراض النساء، النسائية، صحة المرأة | 부인과, 산부인과 | gynécologie, santé des femmes |
| 36 | breast 유방 | breast | الثدي | 유방 | sein |
| 37 | andro 남성 | male, hypogonadism, andrology | الذكورة، أمراض الذكورة، صحة الرجل | 남성의학, 남성 | andrologie |
| 38 | geri 노인 | geriatric, geriatrics, elderly, older adult | طب الشيخوخة، المسنين | 노인의학, 노인 | gériatrie |
| 39 | pall 완화·통증 | palliative, pain | الرعاية التلطيفية، الألم | 완화의료, 통증 | soins palliatifs, douleur |
| 40 | prev 예방 | prevention, preventive, health promotion, screening | الطب الوقائي، الوقاية | 예방의학, 예방 | prévention, médecine préventive |
| 41 | periop 수술 전후·마취 | preoperative, perioperative, surgery, surgical, anesthesia | ما قبل الجراحة، التخدير، الجراحة | 수술 전, 마취, 외과 | préopératoire, anesthésie, chirurgie |
| 42 | emerg 응급·환경 | emergency, emergencies, environmental | الطوارئ، طب الطوارئ | 응급의학, 응급 | urgences |
| 43 | tox 중독(독성) | poisoning, toxicology, overdose | التسمم، السموم | 독성학, 중독 | toxicologie, intoxication |
| 44 | genetic 유전 | genetic, genomic | الوراثة، الأمراض الوراثية، علم الوراثة | 유전, 유전체 | génétique |
| 45 | ortho 정형·스포츠 | orthopedic, orthopedics, sports, musculoskeletal | جراحة العظام، العظام، الطب الرياضي | 정형외과, 스포츠의학 | orthopédie, médecine du sport |
| 46 | vasc 혈관·림프 | vascular, vessel, arterial, venous, lymphatic | الأوعية الدموية، الشرايين، الأوردة، الجهاز اللمفاوي | 혈관, 림프 | vasculaire, vaisseaux |
| 47 | htn 고혈압 | hypertension, blood pressure | ارتفاع ضغط الدم، ضغط الدم | 고혈압 | hypertension |
| 48 | peds 소아 | pediatric, pediatrics, neonatal, child | طب الأطفال، الأطفال | 소아청소년과, 소아과 | pédiatrie |
| 49 | pharm 약물 | pharmacology, drug, therapeutic, pharmacogenetic | الأدوية، علم الأدوية | 약물, 약리 | pharmacologie, médicaments |
| 50 | sx 증상 | symptom, symptoms, manifestation, manifestations | الأعراض، الأعراض الشائعة | 증상 | symptômes |
| 51 | dx 진단·검사 | diagnostic, diagnosis, laboratory | التشخيص، الفحوص المخبرية | 진단, 검사 | diagnostic, examens |
| 52 | rad 영상 | radiology, imaging | الأشعة، التصوير الطبي | 영상의학과, 영상 | radiologie, imagerie |
| 53 | sexual 성 건강 | sexual, gender | الصحة الجنسية | 성 건강 | santé sexuelle |
| 54 | foot 족부 | podiatric, podiatry, foot | القدم | 족부 | podologie, pied |

## 4. 로드맵 배치안

인계 2026-10-21 순서: 8e → 9a → 9b → 8n → 8g-6 → 8c+8f → 18 → 9c → 10 → 11b+11c → 11a → 12 → 13 → 14 → 15 → 16 → 19 → 20.

**권장: 8g-7(+ scriptHint 다듬기) → 8e(Nour 회전 답이 오면, 아니면 9a 먼저) → 9a → 9b → 8n → 8g-6 → 8c+8f → … 그대로.**
- 앱 변경 없이 지금: Nour 답장(아래 5) — R3 기기 안내·R4/R6 쓰는 법·R5 점검표·세 언어/자동 회전 질문.
- 8q-0 범위 +30분(세 의학 책 다단 경고 쪽 목록·갈래).
- R2 는 E4 별도 앱 후보에 "마이크 음성 명령" 기록만. R5 는 스크린숏 뒤 분류.
- 늘어나는 호출 0.

## 5. Nour 답장 초안

`[N-D1 승인 뒤에만 1번의 "다음 판에 넣으려고" 문장을 보낸다]` · 아랍어 `[검토 — 운영자]` · TTS 메뉴 이름 "Google 음성 서비스"·"음성 데이터 설치"는 `[확인 필요 — Realme UI]`(앱의 기존 안내 문구 «خدمات الكلام من Google» 에 맞춤).

### 한국어

Nour, 메시지와 시제품 이야기 고마워요. 시제품에서 바란 것 가운데 MedReader 에 이미 있는 것과 쓰는 법을 먼저 적을게요.

1. **장 첫머리로 가기** — 책을 연 뒤 위쪽 «بحث» → «الفهرس» 탭 → 장 이름(예: 9. Pulmonary Disorders)을 누르면 그 장 첫 쪽으로 가요. 지금은 진료과 이름을 아랍어로 치면 찾지 못해요. 아랍어 진료과 이름(예: الأمراض الصدرية)으로 장을 찾는 기능을 다음 판에 넣으려고 해요 — 그때 아랍어 이름 목록을 보내면 맞는지 봐 줄래요?
2. **원본 쪽에서 읽는 줄 하이라이트** — 위쪽 «الأصل» 을 누른 뒤 «تشغيل». 읽는 줄을 색 상자가 따라가고, 번역은 아래 띠에 나와요.
3. **단 순서** — 2단 쪽은 왼쪽 단을 위에서 아래로 다 읽은 뒤 오른쪽 단으로 가요(가운데를 가로지르는 제목·표가 있으면 그 위와 아래를 나눠서). 순서가 이상한 쪽이 있으면 책 이름·쪽 번호와 «الأصل» 화면 캡처를 보내 주세요.
4. **자연스러운 목소리** — MedReader 는 휴대폰의 텍스트 음성 변환 목소리를 그대로 써요. 휴대폰 설정 검색에서 "تحويل النص إلى كلام" → 기본 엔진을 Google 음성 서비스로 → ⚙ → 음성 데이터 설치에서 쓰는 언어마다 고음질 목소리를 내려받아 골라 보세요(Wi-Fi 에서). 그다음 MedReader «الإعدادات» → «صوت القراءة» 의 «استمع» 로 들어 보면 돼요. 앱은 인터넷 목소리를 쓰지 않아요(비용·오프라인·개인 정보 때문에).
5. **마이크·언어 학습기** — MedReader 범위가 아니라 따로 만들 앱 후보로 적어 두었어요. MedReader 의 음성 명령(재생·멈춤 같은 짧은 말)은 계획에 있어요.

부탁 세 가지:
- (가) 글자가 겹쳐 보인 화면이 MedReader 였다면 스크린숏(위 알림 줄은 가려 주세요)과 함께 — 보기(«النص»/«الأصل»), 책·쪽 번호, «أا» 의 글자 크기·줄 간격·글꼴, «موضع الترجمة»(아래 띠/문장 아래). 시제품 화면이었다면 그렇다고만 알려 주세요.
- (나) "세 언어"는 어떤 언어들인가요?
- (다) 휴대폰 자동 회전을 켠 채 가로로 돌리면 MedReader 도 가로로 바뀌나요?

### العربية `[검토 — 운영자]`

نور، شكرًا على رسالتك وعلى تجربة تطبيقك. هذه أولًا الأشياء الموجودة في MedReader وطريقة استخدامها:

١. **الانتقال إلى بداية فصل:** بعد فتح الكتاب اضغطي «بحث» في الأعلى، ثم تبويب «الفهرس»، ثم اسم الفصل (مثل 9. Pulmonary Disorders)، فتنتقلين إلى أول صفحة فيه. حاليًا لا يجد البحث اسم التخصص إذا كُتب بالعربية. نخطط لإضافة البحث عن الفصل باسم التخصص بالعربية (مثل «الأمراض الصدرية») في النسخة القادمة — هل يمكنك مراجعة قائمة الأسماء العربية عندما نرسلها إليك؟

٢. **تمييز السطر الذي يُقرأ في الصفحة الأصلية:** اضغطي «الأصل» في الأعلى ثم «تشغيل». يتحرك مربع ملوّن مع السطر الذي يُقرأ، وتظهر الترجمة في الشريط السفلي.

٣. **ترتيب الأعمدة:** يقرأ MedReader الصفحة ذات العمودين عمودًا بعد عمود: العمود الأيسر من الأعلى إلى الأسفل، ثم العمود الأيمن. وإذا قطع عنوانٌ أو جدولٌ الصفحةَ بالعرض، يُقرأ ما فوقه أولًا ثم ما تحته. إذا وجدتِ صفحة ترتيبها خاطئ، أرسلي اسم الكتاب ورقم الصفحة ولقطة شاشة من «الأصل».

٤. **صوت طبيعي:** يستخدم MedReader صوت «تحويل النص إلى كلام» في الهاتف نفسه. اكتبي «تحويل النص إلى كلام» في بحث الإعدادات، واختاري «خدمات الكلام من Google» محركًا مفضّلًا، ثم من الإعدادات (⚙) «تثبيت البيانات الصوتية» نزّلي صوتًا عالي الجودة لكل لغة تستخدمينها (عبر Wi‑Fi) واختاريه. بعد ذلك جرّبي «استمع» في MedReader من «الإعدادات» > «صوت القراءة». لا يستخدم التطبيق أصواتًا عبر الإنترنت، بسبب التكلفة والعمل دون اتصال والخصوصية.

٥. **الميكروفون ومتعلّم اللغات:** هذا خارج نطاق MedReader، وقد سجّلناه فكرةً لتطبيق منفصل. أما الأوامر الصوتية القصيرة في MedReader (مثل التشغيل والإيقاف) فهي في الخطة.

ونرجو منك ثلاثة أشياء:
- (أ) إذا كانت الشاشة التي تتداخل فيها الحروف من MedReader، أرسلي لقطة شاشة (مع إخفاء شريط الإشعارات) ومعها: طريقة العرض («النص» أو «الأصل»)، واسم الكتاب ورقم الصفحة، وإعدادات «أا» (حجم النص وتباعد الأسطر ونوع الخط)، و«موضع الترجمة» («شريط سفلي» أو «تحت كل جملة»). وإذا كانت من تطبيقك التجريبي فأخبرينا بذلك فقط.
- (ب) ما هي اللغات الثلاث التي تقصدينها؟
- (ج) إذا فعّلتِ التدوير التلقائي في الهاتف وأدرتِه أفقيًا، هل يدور MedReader أيضًا؟

## 6. 오케스트레이터에게 (spec 에는 적지 않음)

- 지침 3 의 "Android Chrome 은 음성 이름을 무시하고 `lang` 태그만"의 근거는 `medreader-8k-carryover.md` 가 아니라 **`apps/medreader/review.md` 8kR-3**(6293행~, Chromium 소스 기준 `[가정 — Chrome 143 같음]`)이다. carryover 는 Nour 화면(en_AU·fr_CA·아랍어 목록 없음)만 담는다. spec 19-1-4 는 8kR-3 을 인용했다.
- spec 2절 목차(40행)의 19절 줄에 19-1-4 를 더하지 않았다 — 지침이 "19-1-4 와 19-1 로드맵 줄 표시만" 허락. 승인 때 한 줄 더할 것을 권함.
- 측정 파일(스크래치 `pn26/`): `outline-dump.mjs`·`outlines.json`(개요 제목) · `dict.json`(사전 초안) · `dict-cover.mjs`(덮음) · `ar-match.mjs`(아랍어 질의) · `prof-*.txt`(profile 출력). 경로: `C:\Users\YDC\AppData\Local\Temp\claude\D--01-claude-my-blog\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\pn26\`. 임시 폴더라 8g-7 Build 가 사전을 쓰려면 이 보고서의 표를 원본으로 쓸 것.
- `dev/profile.mjs` 를 읽기 전용으로 세 번 돌렸다(각 9분 상한, 출력은 스크래치로만). 앱·dev 파일 변경 0. 서버 접속 없음.
- 작은 발견(8g-7 에 싣자고 적음): 아랍어 UI 의 `search.scriptHint` 가 언어 이름을 `onboarding.lang.en`("English")으로 넣어 «هذا الكتاب بلغة English» 가 된다.
