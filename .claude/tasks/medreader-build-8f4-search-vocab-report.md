# Build 보고 — 8f-4 아랍어 검색어 → 단어장 대응 (spec 17-8-9 (나) · 8cf-D13 (가))

> 2026-11-16 Build 서브에이전트. 직전 배포 8c-2 `939bdb6`. **커밋하지 않음.** (라) AI 로 바꿔 찾기는 넣지 않음(기본 끔·설정 없음 그대로).

## 1. 바꾼 파일

| 파일 | 내용 |
|---|---|
| `js/ui/search.js` (+158 −3) | 1절 순수 함수 넷 `vocabKeyOf`·`vocabDue`·`vocabSwap`·`vocabRedirect`(export) · 화면 배선 `settledChapters`·`kickVocab`·`vocabFromNode` · `paintModel` 첫 줄 `kickVocab()` · `paintModelStatus` 에 "단어장에서 바꿈" 한 줄과 "보는 동안 빈 결과 문구 미룸" 조건 · `loadChapToc` 의 읽기 약속을 `my.wait` 로 둠(한 토큰) · import 둘(`vocabStore`·`normalizeTerm`)과 `foldArabic` |
| `js/i18n/{ar,en,fr,ko}.js` | 새 키 1개 `search.vocabFrom`(`{q}`·`{to}`) — ar·fr `[검토 — Nour·운영자]` |
| `tests/search-vocab-8f4.test.mjs` (새) | W1–W9 11개 |
| `tests/search-ui-8g.test.mjs` | **범위 밖 1줄**: 검색 키 수 고정값 47 → 48(+주석). 승인된 "i18n 1키"가 이 고정 표를 반드시 바꾼다 — 다른 접두(`vocab.*`)로 피하는 것은 재고 표를 속이는 일이라 하지 않았다. 테스트 제목의 "47개"는 그대로 둠(Review 판단) |
| `index.html` | stamp(search.js·i18n 4개 판 번호) |
| `spec.md` | 17-8-9 표 아래 `[정정 2026-11-16 — 8f-4 Build]` 한 줄 |

`vocab/store.js` 는 바꾸지 않았다 — 읽기는 기존 `list()`(전체 훑기, 단어장은 수백 개 규모)로 충분. `text/search.js`·`text/specialty.js`·`pipeline.js`·review.md·`dev/`·추적 안 된 `dev/measure-table-8i4.mjs` 손대지 않음.

## 2. 넣은 규칙

- **켜지는 조건**(`vocabDue`): 이 책 범위 · 검색 끝남(`final`) · 적중 0 · 검색어 오류 없음 · 검색어에 아랍 문자 · 책 글자 체계와 다름(`scriptMismatch`) · 바꿔 찾은 모형이 아님(`via`) · 스캔본 "글자 없음" 대체 안내가 아님. 한 모형에 한 번(`m.vocab`).
- **사전이 먼저**: 지금 코드 순서는 빈 결과 갈래에서 `emptyNotice(currentChapters(), …)` — 8g-7 "장" 묶음이 있으면 결과가 있는 것으로 본다. 8f-4 는 그 **뒤**: `settledChapters` 가 목차 읽기(`loadChapToc` 의 `wait`)를 기다린 다음 묶음이 있으면 `{dict}` — 단어장을 읽지 않고 화면은 8g-7 그대로. "사전이 받음" = 묶음이 생김(사전 개념만 맞고 책에 그 장 제목이 없으면 단어장을 본다).
- **비교 한 규칙**(`vocabKeyOf`): `foldArabic`(NFKC·타슈킬·타트윌·أإآٱ→ا·ة→ه·ى→ي) → `normalizeTerm`(단어장 term 과 같은: 숨은 글자·소문자·공백 하나·앞뒤 구두점). `translation` 이 검색어와 **같을** 때만(부분 일치 아님).
- **후보**: `kind:'term'` · 원어가 검색 규칙에 맞고(`parseQuery` 오류 없음) 책 글자 체계와 같음 · 원어 ≠ 검색어.
- **여러 항목**(설계에 정함이 없어 지침 기본안): 먼저 "그 문서 대상 언어 단어장" = `srcLang` 이 책 언어(빈 것 포함)이고 `targetLang` 이 지금 `ai.translationLang` 인 항목, 없으면 후보 전체. 그 안에서 `updatedAt` 최근 하나(같으면 `createdAt`, 그다음 id). 이유: `updatedAt` 은 내용 수정만 올리므로 사용자가 마지막으로 손본 번역이 이긴다 — 같은 아랍어 번역을 여러 영어 원어에 붙였다면 가장 최근 의도를 따른다. 나머지는 고른 원어 밖의 서로 다른 원어 수로 "… 외 n개"(대상 언어만 다른 같은 원어는 하나).
- **바꾼 뒤**: 그 `term` 으로 **새 모형**(`via = {from, to: surface, others}`)을 만들어 같은 검색 길 `run.doc` — 결과 줄·조각·띠·리더 강조가 모두 원어를 쓴다. 상태 줄 맨 위(진행 줄 다음, 결과 위)에 `search.vocabFrom` — 검색어 `<bdi dir=auto>` · 원어 `<bdi dir=ltr lang=문서 언어>`(`isolatedParts`, textContent 만).
- **없으면**: `{none}` → 17-8-7 안내(찾지 못했습니다 + 글자 체계 안내 + [«الفهرس» 로]) 그대로. 단어장 읽기 실패도 `{none}`.
- 단어장을 보는 몇 ms 동안은 "찾지 못했습니다"를 미룬다(바뀌면 깜빡이지 않게). 끝나면 다시 그린다.

## 3. 수용 기준

| 기준 | 결과 |
|---|---|
| 아랍어 검색어 → 단어장 일치 → 원어로 적중 | W5(흉내 IDB·앱 엔진·앱 저장소) · headless «الرَّبو» → asthma 2줄 |
| 정규화(하라카트·타마르부타·알리프 꼴·앞뒤 공백) | W1·W2 · headless «  فَقْر الدّم » → Anemia |
| 여러 항목 | W3(대상 언어·원문 언어 우선, updatedAt, others) · W5(«الربو»·«الرَّبو» 두 항목 → 최근 Bronchial asthma, 외 1) |
| 일치 없음 → 지금 안내 | W7 · headless «السكري» → «لم يُعثر» + 글자 체계 안내, 바꿈 줄 없음 |
| 라틴·한글 검색어 경로 HEAD 와 같음 | W4·W7(라틴·한글·짧은 검색어는 `null`, 단어장 읽기 0) · 8g-6 C7 고정 표·8g-7 P8 HEAD JSON 그대로 통과 · headless `asthma` 상태 줄 0 |
| 8g-7 사전이 받는 진료과 이름은 결과·안내 HEAD 와 같음 | W6(«الأمراض الصدرية» — 단어장에 같은 번역이 있어도 `{dict}`, 단어장 읽기 0, 안내 `['hint']`) |
| 호출 0 | 아래 4절 |
| 저장 레코드·SEARCH.VERSION·DB·algoVersion 불변 | W8(cards·documents·searchText 스냅숏 같음, `SEARCH.VERSION` 1) · 코드는 `vocabStore.list()` 읽기뿐 |

## 4. 호출 0 근거

- 코드: 새 길은 `vocabStore.list()`(IndexedDB 읽기)와 `searchDoc` 뿐. `search.js` 에 `fetch`·XHR·`sendBeacon` 없음, `ai/pipeline|provider|readalong` import 없음(W9 소스 검사). 검색어는 메모리·IDB 안에서만.
- node: 흉내 `fetch`(모든 import 전에 걸어 둠)로 W5–W8 전 과정 요청 0(W8).
- headless: 흉내 Gemini 가 받은 요청 **0**(단어 3개 시트 저장 · 아랍어 검색 둘 · 결과 → 리더 강조 · 뒤로 · 일치 없음 · 라틴 전 과정).

## 5. 테스트

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1664/1664 · 1664/1664**(새 11 포함).
- `stamp-importmap.mjs` 다시 → `--check` "그대로다" · `git diff --check` 0.

## 6. 변이(빨강 → 복원: 백업 `b8f4/bak/search.js` 를 `cp` 로 되써서 `cmp` 같음 확인, 매번)

| # | 변이 | 빨강 |
|---|---|---|
| M1 | 정규화 빼기(`vocabKeyOf` = 원 글자) | W1·W2·W3·W5 (4) |
| M2 | 사전보다 먼저 단어장(`vocabRedirect` 에서 단어장 → 사전 순) | W6 (`{swap: quilar}` ≠ `{dict}`) |
| M3 | 호출 0 깨기 — `vocabRedirect` 에 Gemini 주소 `fetch` 한 줄 | W8(흉내 fetch 7건) · W9(소스) |
| M4 | 대상 언어·원문 언어 우선 빼기(`pool = all`) | W3 |

## 7. headless (Edge 412×915, UI ar, 새 프로필 `b8f4/p1`, pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, 한 번)

- 합성 PDF `b8f4/synth.pdf`(스크래치 `mkpdf.mjs` 로 만든 2쪽 지어낸 영어 글, 1.6KB) — 문서 lang `en`.
- 시트로 3개 저장(번역은 손으로 입력): asthma→«الربو», Anemia→«فقر الدم», Pneumonia→«ذات الرئة» — 저장 3, 요청 0.
- [🔍] → «الرَّبو»: 상태 줄 «بُحث عنها من قائمة الكلمات: الرَّبو ← asthma»(bdi auto / ltr·en) · 상태 줄이 결과 위 · 결과 2줄(p.1·p.2, `<mark>asthma`, 조각 ltr·en) · 가로 넘침 없음.
- 첫 결과 → 리더: `search-cur` = "asthma", `search-hit` = "asthma"·"Asthma", 띠 "asthma 1 من 3", 가로 넘침 없음.
- 뒤로 → 검색어·결과·바꿈 줄 그대로. «السكري» → 찾지 못함 + 글자 체계 안내(바꿈 줄 없음). `asthma` → 상태 줄 0, 2줄. «  فَقْر الدّم » → Anemia 2줄.
- 요청 0 · 콘솔 오류 0 · pageerror 0 · 4xx/5xx 0. 외부 요청은 앱 기존 pdf.js CDN 2건뿐.
- 스크린샷: `b8f4/shots/412x915-ar-vocab-swap.png` · `b8f4/shots/412x915-ar-reader-hit.png`.

## 8. spec 정정

17-8-9 표 아래 `[정정 2026-11-16 — 8f-4 Build]` 한 줄(넣은 규칙·여러 항목 처리·사전과의 순서·서재 범위 제외).

## 9. 남은 문제·기록

1. **범위 밖 수정 1줄** — `tests/search-ui-8g.test.mjs` 검색 키 수 47 → 48(위 1절). 제목 문구 "47개"는 그대로.
2. "… 외 n개"는 새 키 없이 `vocab.import.changesMore`(단어장 가져오기 화면 키)를 재사용 — "i18n 1키" 안에 두려고. 그 키를 가져오기 맥락으로 고치면 여기도 바뀐다.
3. **같음만** 본다: 관사 차이(«ربو» ↔ «الربو»)·번역 칸에 여러 뜻(«الربو، ضيق التنفس»)은 맞지 않는다. 쉼표(،/,/؛)로 나눠 보기·`arabicBase` 로 ال 떼기는 다음 다듬기 후보(기록만).
4. **서재 전체 범위**는 넣지 않음("그 문서" 기준) — 지금 안내 그대로.
5. 사전 개념은 맞지만 책에 그 장 제목이 없으면 단어장을 본다(묶음 = "받음"). 반대로 사전이 장을 찾은 낱말은 단어장에 저장해 두어도 바뀌지 않는다(«القلب» → 심장 장이면 heart 로 안 바꿈).
6. 바꾼 뒤 결과를 누르면 최근 검색어 칩에 원어(asthma)가 남는다(입력할 때의 아랍어도 [찾기]/Enter 때 남음) · 띠는 원어를 보인다. 설계가 정하지 않음 — 그대로.
7. 바꿈 줄의 검색어는 입력 그대로(앞뒤·겹공백 포함 — 화면에선 접혀 보임).
8. 단어장 읽기가 끝나지 않고 매달리면(IDB 막힘) 그동안 "찾지 못했습니다"가 미뤄진다 — 실패(reject)는 `{none}` 으로 안내가 나온다.
9. ar·fr 문구 `[검토 — Nour·운영자]`: ar «بُحث عنها من قائمة الكلمات: {q} ← {to}», fr «Recherché via le lexique : {q} → {to}».

## 10. 막힌 명령

없음.
