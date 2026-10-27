# 보고 — 8g-7 Build: 아랍어 진료과 이름으로 장 찾기 (Nour R1)

지침: `.claude/tasks/medreader-build-8g7.md`. 설계: spec 19-1-4 2-4 + N-D1 (다) · N-D2 (가) · N-D3 (가). **커밋하지 않았다.**
비교 기준 HEAD 는 지침대로 `c6352a4`(그사이 오케스트레이터 커밋 `746eb56` 은 `.claude/tasks/` 두 파일만 — 앱 코드 차 0).

## 1. 바꾼 파일

| 파일 | 내용 |
|---|---|
| `js/text/specialty.js` (새) | 순수 모듈(import 0). Plan 보고서 §3 표 54 표제어(ar 151 · ko 114 · fr 106 — 표 수 그대로) + `foldArabic`·`arabicToken`·`tokensOf`·`queryMatches`/`conceptsOfQuery`·`titleMatches`/`conceptsOfTitle`·`nameOf`·`SHARED_ALIASES`(의도된 공유: 한국어 "중독" → addict·tox). 책 고유 값 없음. ar·fr·ko 별칭에 `[검토 — Nour·운영자]` 주석 |
| `js/ui/search.js` | 순수 `chapterGate`·`chapterGroup`·`tocDictName`·`CHAPTER_MAX`(30). 결과 맨 위 "장" 묶음(`section.search-chapters` — 머리 + "사전으로 찾음" 줄 + 줄마다 `button.search-chap` → `tocJump(p, true)`), 목차 탭 항목 아래 흐린 UI 언어 이름(`.toc-dict`), `scriptHint` 에 [«الفهرس» 로] 단추(`button.search-to-toc` → 목차 탭) + 언어 이름을 UI 언어로(`langName` → `search.langName.*`). "장" 묶음의 목차는 켜지는 검색어일 때만 `tocOf` 로 읽고(라틴 검색어는 읽기 0), 폴백 목차면 검색이 끝날 때 한 번 다시 읽는다 |
| `js/i18n/{ar,en,fr,ko}.js` | 새 키 7 × 4: `search.group.chapters`·`search.dictFrom`·`search.toToc`·`search.langName.{ar,en,fr,ko}`. 아랍어 `search.scriptHint` 틀을 «هذا الكتاب باللغة {lang} — جرّب البحث باللغة {lang}» 로(ar·fr 문구 `[검토 — Nour·운영자]`) |
| `css/screens.css` | `.search-chap`(≥ 48px — 결과 줄과 같은 꼴)·`.search-chap-title`·`.search-dict`·`.search-to-toc`(≥ 48px)·`.toc-dict`(흐림, 제목 아래 한 줄). 논리 속성만 |
| `index.html` | stamp 만(모듈 61개 — `text/specialty.js` 추가) |
| `tests/specialty-8g7.test.mjs` (새) · `tests/fixtures/latin-view-8g7.mjs`(새) · `tests/fixtures/latin-view-8g7.golden.json`(새 — HEAD `c6352a4` js 로 만든 기준) | 아래 3 |
| `tests/search-ui-8g.test.mjs` | U10 검색 키 수 40 → 47(새 키 7) 한 줄 |
| `spec.md` | 19-1-4 2-4 표 바로 아래 `[정정 2026-10-27 — 8g-7 Build]` 한 단락만 |

`js/text/search.js`·`js/search/*`·DB 버전·`algoVersion`·`SEARCH.VERSION`·`OUTLINE_V`·캐시 키·`PROMPT_VERSION` **무변**. review.md 무변. `.nojekyll` 그대로.

## 2. 테스트

- 전체 `node --test apps/medreader/tests/*.test.mjs` **2회: 1374 / 1374 통과**(1360 + 새 14), 각 약 8.8초.
- `stamp-importmap --check` 종료 0.
- 새 테스트 14개(P1–P10): 사전 무결성(54 · id 중복 0 · ar·en ≥ 1 · 별칭이 일반 낱말뿐 아님 · 공유는 `SHARED_ALIASES` 와 정확히 같음 · Plan 수 151/114/106) · 아랍어 접기 · **정규화 표**(Plan 합성 질의 32 + 형용사꼴 12 + 다른 언어 9) · 낱말 단위·가장 긴 별칭 우선 · 제목 쪽(지어낸 제목) · **합성 개요 픽스처로 "장" 묶음**(실물 제목 없음) · 켜지는 조건 · **라틴 검색어 결과 JSON = HEAD**(엔진 결과·묶음·띠·통로, 검색어 30개 · 적중 59 — `chapters` 키는 생길 때만 붙으므로 라틴에 묶음이 생기면 기준과 달라진다) · 목차 이름 · i18n·배선 소스.

## 3. 수용 기준 결과

| 기준 | 결과 |
|---|---|
| `[N]` 사전 무결성 · 의도된 공유 목록 | 통과(공유 = "중독" 하나) |
| `[N]` 정규화 표(합성 질의 + 형용사꼴) | 통과 — Plan 목록은 실제로 **32개**(31 이 아님): 30 맞음 + 의도된 없음 2(الباطنة·الربو). Plan 이 못 찾은 "تنفسية"·"قلبية" 는 일반 규칙(…ية→…ي→어근)으로 찾는다 |
| `[N]` 합성 개요 픽스처 "장" 묶음 | 통과 |
| `[N]` 라틴 검색어 결과 JSON = 8g · 변이 빨강 | 통과(변이 M1 빨강) |
| `[N]` `general` 이면 묶음 없음 | 통과(변이 M3 빨강) |
| `[D]` 아랍어 UI 360/412: 줄 ≥ 48 · 가로 스크롤 0 · 제목 `dir=ltr` | 통과 — "장" 줄 67px, [«الفهرس» 로] 48px, 412/412 · 360/360, 제목 `dir=ltr lang=en`(계산 방향 ltr) |
| `[M]` «الأمراض الصدرية» → 첫 줄 Pulmonary → 그 장 첫 쪽 | headless 통과(CMDT 2026: 첫 줄 "9. Pulmonary Disorders" p.278 → 누르면 리더 278쪽, scrollY 0). 실기기 Nour 확인은 Review/운영자 몫 |
| 세 권 덮음 ≥ 95% | **104/105 = 99.0%**(Plan 과 같음) |

## 4. 실측값

- **덮음**(앱 `titleMatches` · Plan 과 같은 부속 제외): CMDT 2026 52/53(98.1%) · CMDT 2021 42/42 · Harrison 10/10 · 합 **104/105 = 99.0%** · 둘 이상 표제어 21 · 못 덮음 1 = "Information Technology in Patient Care". 105 항목 대응을 눈으로 다시 봄 — **틀린 장 0**.
- **아랍어 질의 44개(Plan 32 + 내 형용사꼴·표기 12)를 실물 개요에**: 틀린 장 0. 예 — «الأمراض الصدرية»·«تنفسية»·«طب الرئة» → CMDT 2026 "9. Pulmonary Disorders"(p.278) · CMDT 2021 같은 장(p.675) · Harrison "SECTION V … Respiratory …"(p.417) / «ارتفاع ضغط الدم» → "Systemic Hypertension" 만 / «أمراض النساء والتوليد» → 부인과·산과 장(CMDT 2026 은 "Women’s Health Issues" 도) / «الأمراض المعدية» → 감염 장 전부(CMDT 2026 8개). 없음: CMDT 2026 3(الباطنة·الربو·كلوية) · CMDT 2021 4(+ «الغدة الدرقية» — 그 판은 "Endocrine Disorders" 뿐이라 맞음) · Harrison 13(섹션 10개뿐 — 해당 장이 없음).
- **라틴 검색어 = HEAD(실물)**: 세 권 각각 고르게 30자리 × 연속 4쪽 = 120쪽을 앱 경로(레이아웃·저장본·엔진 백필)로 만들고 라틴 검색어 **35개**(진료과 낱말 포함)의 결과 모형 JSON 을 HEAD js / 지금 js 로 → **세 권 모두 `cmp` 같음**(적중 CMDT 2026 2,350 · CMDT 2021 991 · Harrison 2,160), 라틴 검색어에 "장" 묶음 0.
- **headless Edge**(새 프로필 `b8g7/p1` 하나 · 가짜 키 · 아랍어 UI): 위 3 + 뒤로 → 검색어·묶음 그대로 · [«الفهرس» 로] → 목차 탭(61항목 중 52항목에 흐린 이름, Pulmonary 옆 «أمراض الجهاز التنفسي», `lang=ar`, 흐린 색) · 영어 UI 목차 탭 흐린 이름 0 · 영어 UI 아랍어 검색어도 "Chapters 1" · `domain:'general'` → 묶음 0·흐린 이름 0. **회귀**: 영어 "pulmonary" → 묶음 head·body·table, "장" 묶음 없음 · 제목 줄 누름 → 리더 22쪽 + 검색 띠 · [▶] 첫 발화가 적중 문장(`en-US`) · 8d 블록 2개 · 띠 모드 아래 띠 보임(120px). **콘솔 오류 0**. 바깥 요청은 기존 pdf.js CDN 과 가로챈 가짜 Gemini 뿐.
- 스크린숏 3장: `C:\Users\YDC\AppData\Local\Temp\claude\D--01-claude-my-blog\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b8g7\shots\ar-chapters-412.png` · `…\b8g7\shots\ar-chapters-360.png` · `…\b8g7\shots\ar-toc-412.png`. 결과 JSON `…\b8g7\hl1.json`.

## 5. 변이 (5개 — 모두 빨강 → 백업을 읽어서 쓰기로 복원 → `cmp` 0)

백업 `…\scratchpad\b8g7\bak\`, 결과 `…\b8g7\mutate.json`.

| 변이 | 빨강 |
|---|---|
| M1 `chapterGate` 의 `scriptMismatch` 조건 지움 | P7 · **P8(라틴 결과 JSON ≠ HEAD)** |
| M2 가장 긴 별칭 우선 끔 | P3 · P4 |
| M3 `general` 조건 지움 | P7 |
| M4 목차 이름의 UI ≠ 책 언어 조건 지움 | P9 |
| M5 형용사꼴 어미 접기 지움 | P2 · P3 |

## 6. 남은 문제 · 운영자 결정이 필요한 것

1. **사전 검토**(Nour·운영자): ar·fr·ko 별칭과 새 아랍어·프랑스어 문구(«الفصول {n}» · «من القاموس المدمج: {q} ← {to}» · «افتح «الفهرس»» · 언어 이름 · 고친 `scriptHint` 틀). 별칭은 Plan 표 그대로 옮겼다(측정 뒤 이 책들에 맞춰 고치지 않음).
2. **어근이 바뀌는 형용사꼴은 못 찾음** — 예 "كلوية"(신장의). 일반 규칙으로는 안 잡힌다. 검토 때 별칭 "الكلوية" 같은 형용사꼴을 사전에 더할지 결정.
3. **짧게 친 검색어의 넓은 대응**: 완전한 별칭이 없을 때만 검색어를 품은 별칭으로(3 표제어 이하) — 예 "فيروس" → 바이러스·HIV, "دموية" → 심장·혈관. 그대로 둘지.
4. **`general` 문서에서도 [«الفهرس» 로] 단추는 남는다** — 그것은 사전이 아니라 글자 체계 안내(`scriptHint`)의 다듬기라서. 끄려면 한 줄.
5. **`scriptHint` 언어 이름은 네 UI 언어 모두 바뀜**(한국어 "English 원서" → "영어 원서", 프랑스어 "en English" → "en anglais"). 라틴 검색어 + 한국어 책처럼 글자 체계가 다를 때만 보이는 줄이다 — "라틴 검색어 결과 바이트 같음"은 라틴 책(en·fr)에 대한 것.
6. 개요 없는 책(폴백 목록)은 단위 테스트(`source:'fallback'`)로만 봤고 headless 에선 개요 있는 CMDT 2026 만 썼다 — Review 에서 폴백 책 하나로 확인 권함.
7. 8000번 python(PID 30352)이 없어서 지침대로 **레포 루트에서 새로 띄웠다(PID 45964, 끄지 않음)**. 띄운 Edge 는 닫혔고 남은 node 없음. C: 남은 공간 149GB.
8. spec 2절 목차에 19-1-4 줄을 더하는 일(Plan 보고서 §6 권고)은 범위 밖이라 하지 않았다.
