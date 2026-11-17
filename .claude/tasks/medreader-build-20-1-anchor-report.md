# 보고 — 20-1 Build: 필기 앵커 · 저장 · 칠하기 (2026-11-17)

지침: `.claude/tasks/medreader-build-20-1-anchor.md` · 설계: spec 17-16(1·2·3·4·8 표 20-1 행·9 "20-1"·10 권장안·12 적기만).
**커밋하지 않았다.** 호출 0 · DB 버전 3 · `PROMPT_VERSION` 등 판본 상수 불변 · 본문 DOM 에 아무것도 끼우지 않음 · `CASCADE_STORES` 무변.
스크래치: `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b20-1\`.

## 1. 바꾼 것

| 파일 | 무엇 |
|---|---|
| 새 `js/text/anchor.js` (순수) | `anchorOf`·`resolve`(1 exact → 2 para → 3 page → 4 fuzzy → null)·`foldText`(검색 접기 + 공백·하이픈 뺌, 원래 오프셋 표)·`findQuote`·`indexOfDesc`·`partAt` |
| 새 `js/notes/annotations.js` (서비스) | `create`(문단마다·400자마다 레코드, 같은 `group`)·`update`·`remove`(group 함께)·`forPage`(`docId_pageNo`)·`list`·`count`·`reattach(fileHash,newId)` + `placeOnPage`(다시 찾기 + 20-D6 한 번 고쳐 쓰기)·`pageIndex`·`splitSelection`. import 는 `config`·`db`·`hash`·`text/*` 만 |
| 새 `js/ui/annotate.js` | 리플로우 이름 다섯 `anno-yellow/green/blue/pink/note`(메모 있는 하이라이트도 note 에), 우선순위 `prioritize()` 한 함수, 미지원 → `.anno-line-*`, `onPageRender`·`onPageRepaint` 구독, `onReaderLeave` 에서 걷음, 원본 보기면 `original.setAnnotations` |
| `js/text/screen.js` | `screenIndex`·`rangesOnScreen` **줄 그대로 옮김**(+ `./search.js` 의 `rangesFor` import — 순환이지만 둘 다 함수 선언만 주고받음) |
| `js/ui/search.js` | 옛 정의 삭제 · `text/screen.js` 에서 import 해 **같은 함수 객체 다시 export** · 칠하기 뒤 `prioritize(HL_HIT/HL_CUR, SEARCH)` 두 줄(아래 6-④) |
| `js/ui/original.js` | 필기 층 `.anno-layer`(낭독 `hl-layer` **앞**에 붙임 = 아래) · 순수 `annoBoxes`(줄 bbox + `narrowBox`, 회전 줄 제외, 200 초과 시 줄 통째로 합침) · `setAnnotations` · `paint`(확대·쪽)·`refitOriginal`(회전) 때 다시 · 쪽·떠날 때 비움 |
| `js/ui/reader.js` | `initAnnotate()`(검색 뒤) · 낭독 `paintCharHighlight` 뒤 `prioritize(HL_NAME, SPEAKER)` |
| `js/config.js` | `ANNO`(색 넷·QUOTE_MAX 400·CONTEXT 32·NOTE_MAX 2000·FUZZY_MIN_CHARS 12·FUZZY_MIN_CONTEXT 8·MAX_BOXES_PAGE 200·PRIORITY {0,1,2}) |
| `css/tokens.css` · `css/reader.css` | `--anno-*` 다섯 × (:root · 시스템 어두움 · dark · sepia · contrast) · `::highlight(anno-*)` · 줄 클래스(`.is-current` 규칙 **앞** — 낭독 줄 배경이 이김) · `.anno-layer/.anno-box` |
| 새 시험 | `tests/anchor-20.test.mjs`(15) · `tests/annotations-20.test.mjs`(10) |
| `index.html` | stamp 만 |
| `spec.md` | 17-16 §3 끝에 `[정정 2026-11-17 — 20-1 Build]` 한 줄(아래 6) |

`charhl.js`·`db.js`·`ai/*`·`backup/*`·`text/backup.js`·`columns.js`·`layout.js`·`speaker.js`·`selbar.js`·`voice/*`·review.md·`dev/` 무변.

## 2. 수용 기준 "20-1"

| 기준 | 결과 |
|---|---|
| `[N]` 같은 판 → exact | A1 ✔ |
| `[N]` 줄 id 모두 바뀐 판(문단 순서 뒤섞기) → para 로 같은 글자 | A2 ✔ — 같은 인용·같은 앞뒤 문맥의 **미끼 문단**을 앞에 두어도 해시 문단이 이김 |
| `[N]` 문단 해시도 다른 판 → page | A3 ✔ |
| `[N]` 같은 낱말 셋 → prefix·suffix 로 맞는 것 | A4 ✔(둘째·셋째) · A4b(같은 글·같은 문맥 둘 → 저장한 첫 줄에 가까운 것) |
| `[N]` 하이픈 줄바꿈 바뀜 → 같은 글자 | A5 ✔(두 줄 구간 ↔ 한 줄 구간, 양방향) · A5b(지킨 하이픈 ↔ 붙은 낱말 → fuzzy) · A5c(문단 둘로 갈림 → 경계 넘는 fuzzy) |
| `[N]` 인용 사라짐 → null | A6 ✔ · A7(짧은 인용 낱말 안 오탐 막기) · A8(같은 판이어도 줄 글자가 다르면 exact 아님) |
| `[N]` 실물 회귀 ≥ 99% · 다른 자리 0 | **사전에 정한 표본(시드 2026): 찾음 198/200 = 99.0% · 다른 자리 0** ✔ — 아래 3. 덧붙여 본 시드 둘은 98.0%·99.5% (3 참조, 남은 문제 1) |
| `[N]` fake-idb 서비스 | N1–N6 ✔ — 쪽 인덱스 읽기 · algo 다른 레코드 **처음 그릴 때 한 번만**(patch 1회, 두 번째 exact, `updatedAt` 그대로) · 같은 판 how≠exact 쓰지 않음 · 고아 남김 · `reattach` 같은 fileHash 고아만(살아 있는 문서·다른 fileHash 그대로, 요약 레코드도) |
| `[D]` 3색 → `CSS.highlights` 이름 셋, 낭독이 위 | ✔ h1: 이름 `anno-yellow/green/blue` + `anno-pink`(문단 넘는 선택 2레코드 같은 group) + `anno-note`, 모두 priority 0 · 낭독 `medreader-current` 2 · h3 **화소**: 겹친 자리 가장 흔한 색 `#ffef9e`(=--hl-bg, 73%) · 필기만 자리 `#ffe066`(=--anno-yellow, 67%) |
| `[D]` 미지원 흉내 → 줄 클래스 | ✔ h2(`Highlight`·`CSS.highlights` 지움): `.anno-line-yellow/green/blue/note` 각 1 · 낭독 중 두 클래스를 가진 줄의 계산된 바탕 = --hl-bg(전환 120ms 뒤) |
| `[D]` 원본 `.anno-layer` 상자가 줄 bbox 안 · 확대 뒤 맞음 | ✔ h1: 63%→79% 확대 전후 상자 6 · 안 6 · 밖 0 · 최대 벗어남 0px · DOM 순서 canvas → anno-layer → hl-layer · 낭독 상자 풀 1개 그대로(낭독 중 보임 1) |
| `[D]` 검색 강조·검색 시험 그대로 | ✔ 검색 시험 전부 통과(옮김 회귀 0) · A9: `ui/search.js` 가 **같은 함수 객체** 재export, 옛 정의 0 |
| 변이 | 아래 4 — 다섯 모두 빨강 → 복원 `cmp` 같음 |

## 3. 실물 회귀 (CMDT 2026 — 읽기만, Downloads 목록 안 봄, 결과에 원서 글 0)

측정 `b20-1/measure.mjs`(앱 모듈을 Node 에서 import · pdf.js = 지침의 codex 경로). **행 표를 끈 판**은 앱의 `buildPageLayout(items, info, LAYOUT, {...ROWTABLE, ENABLED:false})` — 스크립트 안에서만(앱 코드 무변; 사본 `b20-1/norow/` 도 만들었으나 이 인자로 충분해 쓰지 않음).

**표본 고르기(측정 전에 정함)**: 전 쪽(1–1967) 훑기 → "행 표 쪽" = 지금 판 `rowTableProbe` 가 표 ≥1 이고 화면 글자 ≥300(33쪽) · "보통 쪽" = 그 밖 흐름 문단(≥30자) ≥3·글자 ≥800(1,770쪽). 시드 2026(mulberry32) 으로 **행 표 쪽 10 + 보통 쪽 10**. 쪽마다 필기 10: 문단을 글자 수 비례로 고르고 낱말 경계 무작위 시작·1–15 낱말(인용 3–163자, 가운데 39). 만들 때 판 13(행 표 켬) → 행 표 끈 판에서 `resolve`(판을 14 로 줘 1단계를 건너뜀 — 8i 이전 판처럼 다른 판). **같은 자리** 정답 = 두 판의 줄을 (bbox×10 반올림, 줄 글자) 열쇠로 이어 옮긴 줄 구간과 찾은 구간이 같음(끝 ±1 — 하이픈). **글자 비교** = 찾은 자리 화면 글자 == 인용(fuzzy 는 접은 글자).

| 시드 | 표본 쪽 | 찾음 | 다른 자리 | 글자 다름 | 정답 미상¹ | how |
|---|---|---|---|---|---|---|
| **2026(사전 지정)** | 8 22 25 28 30 31 36 151 237 355 484 634 737 771 810 1051 1150 1588 1658 1712 | **198/200 = 99.0%** | **0** | 0 | 3 | para 163 · page 34 · fuzzy 1 |
| 7(덧붙임) | 21 23 29 34 36 38 310 365 390 500 564 570 701 810 968 998 1423 1589 1683 1820 | 196/200 = 98.0% | 1 | 0 | 5 | para 164 · page 31 · fuzzy 1 |
| 99(덧붙임) | 21 22 25 29 34 38 147 372 491 527 647 697 810 863 922 1357 1428 1587 1653 1658 | 199/200 = 99.5% | 0 | 0 | 0 | para 167 · page 28 · fuzzy 4 |

¹ 행 표가 줄 글자 자체를 바꾼 경우(열쇠가 안 이어짐) — 이 경우도 글자 비교는 같음.
resolve 한 번 0.014–0.023 ms. 전 쪽 훑기 27 s.

**측정이 바꾼 코드(정직하게)**: 시드 2026 첫 실행은 98.5%(고아 3)였다. 고아를 분류(숫자만)하니 1건은 **판이 문단을 다르게 나눠 인용이 문단 경계를 넘음** → 4단계 끝에 문단 경계를 넘는 접은 글자 찾기를 더했다(설계 "접은 글자로 2–3" 의 쪽 전체 몫으로 읽음 — spec 정정 ②). 시드 7 에서 **다른 자리 3**(p310 — 같은 글·같은 앞뒤 32자가 쪽에 두 번, 점수 64 동점 → 앞의 것)이 나와 **동점이면 저장한 첫 줄 번호에 가까운 후보**를 더했다(정정 ③). 그 뒤 세 시드를 다시 돌린 값이 위 표다. 남은 고아는 모두 "gone" — 행 표가 읽기 순서를 바꿔 인용이 **이어진 글로 존재하지 않는** 경우(행 표 쪽 23·31·34·38·810)로, 한 덩어리로 칠할 자리가 없다(설계대로 고아 — 레코드·인용은 남는다). 시드 7 의 다른 자리 1 = 5자 인용이 쪽에 9번, 앞뒤 문맥 점수 47 동점(줄 번호가 다시 매겨진 쪽).

**덤 — HEAD~1(algoVersion 12) 사본으로 만들고 지금(13)으로 찾기** (`git archive HEAD~1` → `b20-1/prev/`):
- CMDT 2026 보통 쪽 20(시드 2026): **200/200 = 100% · 다른 자리 0**(8q 는 의학책을 바꾸지 않는다 — 전부 para).
- SciAm 1999-01(14 Plan 보고서 경로 — G: 읽기만) 지금 판 3단 쪽 24 중 10쪽: **70/100 = 70% · 다른 자리 0**. 고아 30 은 전부 "gone" — 옛 판(12)은 두 단을 한 줄로 붙여 읽었으므로 그 판에서 만든 인용 자체가 지금 판에 없는 섞인 글이다(예상된 결과, 수용 기준 밖).

## 4. 변이 (빨강 → 복원: 백업 `b20-1/bak/` 를 **읽어서 쓰기** `restore.mjs` + `cmp` 같음)

| # | 변이 | 빨강 |
|---|---|---|
| 1 (설계) | `resolve` 2단계(문단 해시) 지움 | A2(미끼 문단 → page)·A4·N3 |
| 2 (설계) | prefix/suffix 고르기 지움(`contextScore` → 0) | A4(둘째 자리 대신 첫 자리) |
| 3 (설계) | 칠하기 우선순위 뒤집기(`ANNO.PRIORITY` ANNO 2·SPEAKER 0) | N8 |
| 4 (고름) | 1단계의 글자 비교 지움(같은 판이면 줄 구간을 믿음) | A8(다른 글 자리를 exact 로) |
| 5 (고름) | 원본 상자 200 상한 합치기 지움 | N7 |

## 5. 회귀 · 검사

- **전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회: 1956/1956 · 1956/1956 통과.**
- stamp 다시(단독) → `--check` "그대로다"(모듈 96·CSS 4) · `git diff --check` 0 · 새 파일 끝 공백 0 · `innerHTML`/`insertAdjacentHTML` 새 사용 0(새 파일·바뀐 줄 검사 + N8 시험).
- headless(Edge · pipe · 새 프로필 `b20-1/p1·p2·p2b·p3` · 가짜 키 · 흉내 Gemini OPTIONS 204+CORS · 캐시 끔 · **서버 없음**(가로채기) · 합성 PDF `b11-2/syn.pdf` · 한 번에 하나씩):
  - **요청 본문 바이트 HEAD 와 같음**: 같은 낭독 흐름 번역 POST 2건 해시 `ebebc395…`·`bfa9c1da…` 양쪽 동일.
  - 필기 단계(심기·칠하기·원본·화면 전환) **Gemini 요청 0** · 가로챈 외부 요청 0 · 콘솔 오류 0 · 페이지 오류 0(네 실행 모두). pdf.js CDN 은 지금처럼 원본 보기·추출에서 받는다(20 과 무관).
  - 11-3 `#/summaries`·12-3 `#/cards` 화면 뜸(요소 40·97).
  - 스크린샷 `b20-1/shots/`: `theme-light/sepia/dark/contrast.png` · `speak-light.png` · `original-zoom.png`.

**색 토큰 측정** (`b20-1/contrast.mjs` — WCAG 글자 대비 · CIE76 ΔE)

| 테마 | 노랑 | 초록 | 파랑 | 분홍 | 메모 밑줄(바탕 대비) |
|---|---|---|---|---|---|
| 밝음 (글자 #1a1a1a) | #ffe066 13.4:1 · 바탕 ΔE 62 · 낭독 ΔE 22 | #c3ebb5 13.2 · 33 · 26 | #bcd8f5 11.8 · 23 · 59 | #f9c6dc 11.7 · 26 · 54 | #8a5a00 5.8:1 |
| 어두움 (#eceff3) | #5e4b0a 7.3 · 48 · 65 | #1f4d2b 8.5 · 37 · 50 | #16505a 7.8 · 28 · 23 | #5e2342 10.1 · 35 · 35 | #e0b94a 9.5:1 |
| **세피아** (#3a2f1e) | **#f2c933 8.2 · 바탕 ΔE 64 · 낭독(#e5cf94) ΔE 42** | #c5dfa4 9.0 · 25 · 19 | #b9d3e6 8.4 · 26 · 45 | #eebcc8 7.9 · 26 · 38 | #7a4310 6.8:1 |
| 고대비 (#fff, 기준 7:1) | #5a5000 8.1 · 54 · 75 | #005c2a 8.2 · 54 · 93 | #00468c 9.3 · 54 · 148 | #7a0049 10.9 · 57 · 131 | #ffe600 16.6:1 |

색끼리 가장 가까운 짝 ΔE ≥ 27.8(고대비 37.8). 세피아 노랑은 종이색과 ΔE 64 — 묻히지 않는다(스크린샷).

## 6. 설계와 다른 점 (spec 17-16 §3 `[정정 2026-11-17 — 20-1 Build]` 한 줄에 적음)

① 판 `algoVersion = 13` — 코드에서 읽는다(상수 안 박음, N1 이 고정). ② 4단계 끝 문단 경계를 넘는 접은 글자 찾기(결과 `ranges` 가 두 문단에 걸칠 수 있음). ③ 동점은 저장한 첫 줄 번호에 가까운 후보(스키마 무변). ④ 짧은 인용(접은 < 12자)은 문맥 ≥ 8자 맞을 때만 fuzzy. ⑤ 400자 넘는 선택도 group 레코드 여럿. ⑥ 서비스에 `placeOnPage`·`pageIndex`·`splitSelection` 더함, 다시 붙여 쓸 때 `updatedAt` 그대로(9c 병합에서 사용자 손을 이기지 않게). ⑦ 우선순위는 `ANNO.PRIORITY` + `prioritize()` 한 벌 — **`ui/search.js` 는 import 만이 아니라 칠하기 뒤 두 줄도 고쳤다**(검색 1 을 두려면 그 자리뿐; `charhl.js` 는 범위 밖이라 무변).

## 7. 남은 문제 · Review 에 넘길 것

1. **덧붙인 시드 7 은 98.0%·다른 자리 1** — 세 시드 600 개 합 찾음 593(98.8%)·다른 자리 1. 고아 7 은 모두 행 표 쪽에서 읽기 순서가 바뀌어 인용이 이어진 글이 아니게 된 경우, 다른 자리 1 은 5자 인용 9회 동점. 더 올리려면 (가) 줄 조각별로 나눠 찾는 "부분 다시 찾기"(설계 밖 — 다른 자리 위험), (나) 짧은 인용에 쪽 안 순번을 저장(스키마 더함) 중 하나 — 운영자/Plan 판단. 사전 지정 표본 기준은 충족.
2. 표본의 행 표 쪽 비율을 절반으로 정했다(책 전체 33/1967 쪽) — 실제 책보다 어려운 쪽 쪽으로 기울어 있다.
3. 줄 글자에 연속 공백이 있으면 DOM 글자(`trim` 만)와 `joinPieces`(공백 접음)의 오프셋이 어긋난다 — 검색·낭독 하이라이트와 같은 기존 성질(이번에 바꾸지 않음).
4. 원본 보기 메모(`anno-note`)는 상자 아래 점선(밑줄 근사).
5. 만들기 UI·쪽 칩·음성 "표시"는 20-2, 필기 화면·내보내기·`reattach` 배선·`CASCADE_STORES` 는 20-3.
6. 실기기(spec 17-16 12 — 적기만): GT 7 색 줄·시스템 메뉴 겹침, 세피아·어두운 테마 네 색, «علّم», 아랍어 메모 키보드·방향, 판 올림 뒤 필기 제자리, PDF 지움→다시 가져오기.

## 8. 규칙 준수

명령 한 호출에 한 가지(`cd &&`·파이프·`;` 0) · 서버 0 · 프로세스 조회·디버깅 포트 0 · 커밋·`git checkout/restore/stash` 0(옛 판은 `git archive`) · npm·다운로드 0 · `rm` 0 · `.nojekyll` 그대로 · G:(SciAm 1권)·Downloads(CMDT) 읽기만 · 진짜 키 0 · 프로필 복사 0 · 원서 글 출력 0(40자 넘는 인용 0). 거절된 명령 0. 한 번: GNU tar 가 `C:` 를 원격 호스트로 읽어 실패 → 표준 옵션 `--force-local` 로 풀었다(권한 거절 아님).
