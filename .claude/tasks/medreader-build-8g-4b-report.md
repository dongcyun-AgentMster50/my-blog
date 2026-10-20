# 8g-4b Build 보고 — 목차 탭과 검색 마무리 (8g 마지막 단계)

> 지침 `.claude/tasks/medreader-build-8g-4b.md` · carryover `medreader-8g4-carryover.md` 8–25 · spec 17-8-12 §4·§6·§7(S19)·§9·§11. 시작 HEAD `c36e8e4`(전체 1206/1206).
> **커밋하지 않았다.** review.md 는 고치지 않았다. `js/search/engine.js`·`js/db.js`·`js/pdf/*`·`js/search/outline.js` 는 고치지 않았다(시작 해시와 같음). `D:/OCR` 는 읽기만 했다.
> 스크래치: `b8g4b/`(스크립트·로그·JSON·프로필 `pa`·백업 `bak-orig/`·변이 백업 `bak/`·변이 TAP `mut/`), 캡처 `shots-8g4b/`.

## 1. 바뀐 파일 (git diff --numstat, 더함/뺌)

| 파일 | 줄 | 내용 |
|---|---|---|
| `js/ui/search.js` | +408 −15 | 목차 탭(5b절 — 탭 전환·`tocOf`·폴백 전 `prepareDoc`·줄 모형·지금 항목·접기·항목 → 그 쪽 맨 위), 순수 함수 `pendingDue`·`pageKeyOf`·`tocNoteKeys`·`tocCurrentIndex`·`tocRows`·`shouldRecue`, F2(뷰 전환 기준 줄 힌트·다시 cue) |
| `js/ui/reader.js` | +67 −12 | `createOutlineScheduler`·`outlineIdle`(개요 예약을 순수 공장으로), `leaveReaderNow`(F3), `setViewAnchorHint`·`hintedAnchor`(F2) |
| `js/ui/controls.js` | +13 −2 | `cueSpeakerAt`(③ — cue 뒤 진행 칸만 다시 그림) |
| `js/text/search.js` | +5 −2 | R2 약어 예외를 대소문자 있는 글자에만(`CASED_WORD`) |
| `dev/measure-toc-8g3b.mjs` | +4 −2 | 기준 정의의 같은 R2 규칙(글자 그대로) |
| `dev/measure-search-8g.mjs` | +5 | `--toc` 안내(머리 주석 + 출력 `note`) |
| `index.html` | +16 −15 | 탭·패널 aria(`aria-controls`·`role=tabpanel`), 주석, import map 도장 |
| `css/screens.css` | +119 | 탭·목차 목록(들여쓰기·지금 항목·`p:null` 흐리게·접기 단추·RTL) |
| `css/reader.css` | +18 | ① ≤ 400px + 퀴즈 버튼 보임일 때 상단바 압축([⧉] 글리프·간격·여백) |
| `js/i18n/{ar,en,fr,ko}.js` | +4 ×4 | `search.toc.*` 4개 |
| `spec.md` | +17 | 17-8-5·17-8-12 안 정정 12줄(7절) |
| `tests/search-toc-8g4b.test.mjs` (새) | 453 | 21 테스트(T1–T7) |
| `tests/search-toc-8g3b.test.mjs` | +27 | S33c R2 약어(앱 = 기준 정의) |
| `tests/search-outline-8g.test.mjs` | +8 −4 | 배선 테스트를 새 공장 구조로 |
| `tests/search-jump-8g4afix.test.mjs` | +5 −4 | `beginJump(JUMP_ENV` 3곳 · X1 은 `pendingDue` |
| `tests/search-ui-8g.test.mjs` | +6 −4 | `cueAt` 몸통 · 검색 키 34 → 38 |
| `tests/pageturn-8i3.test.mjs` | +5 −1 | PT9 의 "떠날 때" 단언을 `leaveReaderNow` 로 |

기존 테스트 4파일의 고침은 모두 **구조 이동**(같은 단언을 새 함수 이름에)이다 — 기대값을 바꾼 것은 검색 키 수 34 → 38 하나(목차 4키를 더했으니 의도).

## 2. carryover 8–25 반영

| # | 반영 | 어떻게 |
|---|---|---|
| 8 | ○ | spec 17-8-5 정정 줄 — versionchange 뒤 `searchDoc`·`searchLibrary` 는 reject 할 수 있다(P13), 화면은 일반 오류 한 줄, 배너가 이미 떠 있다(F5 실측 — 캐시로 결과가 나온 경우도 적음) |
| 9 | ○ | spec 17-8-5 정정 줄 — `onPartial` 은 invalidate 때 두 번 올 수 있고 화면은 바꿔 그린다 |
| 10 | ○ | spec 17-8-12 §2-2 정정 줄 — "서재 ≤ 3초"(17-8-2)·S15 "≤ 1초"는 백필 뒤 기준(17-8-2 는 고치지 않고 17-8-12 에 적음 — 지침의 "17-8-5·17-8-12 안에서만") |
| 11 | ○(해당 없음) | 브라우저 실측은 4a Review 가 끝냄 — 4b 는 S19 만(4절) |
| 12 | ○ | 목차 탭: `tocOf` 의 `source`·`outlineRead`·`outlineIgnored`·빈 목록 → `tocNoteKeys`(unavailable · empty · fallback). **폴백이면 `engine.prepareDoc` 을 기다린 뒤 다시 `tocOf`**(먼저 있는 heads 로 그려 두고 백필 진행 "검색 준비 중 n/N" 을 목차 위에). 쪽 표시 `pageKeyOf`(= `printedLabel`) "p. {인쇄} (PDF {쪽})". `p:null` 은 `disabled`(흐리게·못 누름) |
| 13 | ○ | `scheduleOutline` 의 몸통을 순수 공장 `createOutlineScheduler` + `outlineIdle` 로 꺼내 **가짜 `requestIdleCallback`** 으로 행동 테스트(T5 — 한가할 때만 · 실패 뒤 다시 · 다른 책 · 이미 읽음 · rIC 없으면 1.5초). `SEARCH.ENABLED=false` 의 `outline.ensure` → `off`·pdf 호출 0·DB 호출 0(js/ 사본, T5) — 8g-3 Review R4·R8·R9 변이가 이제 빨강(V4·V5) |
| 14 | ○ | 쓰레기 개요·폴백 품질은 8g-3b 결과 그대로(`tocOf` 를 그대로 부름 — outline.js 무변경) |
| 16 | ○ | R2 약어 예외 = 대소문자 있는 글자로만 된 낱말(`/^[\p{Lu}\p{Ll}]+$/u`), 앱·기준 정의 함께, S36 다시 돌림(5절), spec §11 정정 줄 |
| 17 | ○ | `search.toc.fallback` 한 문구 ×4 — 쓰레기 개요를 버린 책도 같은 문구(T1·T3, headless ess) |
| 18 | ○ | `measure-search-8g.mjs` 머리 주석 + `--toc` 출력에 `note`("옛 변형 C 와의 차 — S18·S36 은 measure-toc-8g3b.mjs 로") |
| 19 ① | ○ | 360px + 퀴즈 보임: 제목 폭 **en 0 → 54 · fr 0 → 54 · ar 5 → 52 · ko 15 → 55px**(4절) |
| 20 ③ | ○ | `cueSpeakerAt` — cue 가 시작점을 정하면 진행 칸만 다시 그린다(번역 커서·이벤트 없음). headless "47중 2번째 줄" → 결과 이동 직후 "50중 28번째 줄" = [▶] 뒤 값 |
| 21 F2 | ○ | 멈춘 채 원본 ↔ 리플로우: 적중 가운데 **+2.3%**(처음 상태) · **−6.9%**(낭독 멈춤) — 예전 +434%/−183%. 덤으로 막은 것: 멈춘 채 뷰를 오가면 [▶] 시작점이 한 칸씩 앞 문장으로 물러나던 것(4절) |
| 22 F3 | ○ | `leaveReaderNow` — 숨은 리더에서 다른 책이면 서재로 갈 때와 같은 정리. spec §4-5 정정 줄 |
| 23 | ○ | spec: Build 8g-4a 제안 1·3·4·5·6·7 그대로 + 2 는 "**뒤로 돌아올 때만**"(이동에는 아님) + ④ 띠 중간 번호는 의도 |
| 24 | ○ | 9절에 그대로 옮김 |
| 25 | ○ | `pendingDue`(순수) — T4 표 · FX3 는 `onReaderPage` 가 그것을 부르는지만 |

(15 는 4a 가 반영 — 이번 범위 밖.)

## 3. 목차 탭 — 만든 것

- **자리**: 검색 칸 아래 탭 [찾기] [목차](`role=tablist`·`aria-selected`·`aria-controls`, 패널 `role=tabpanel`). **이 책 범위에서만**(서재 범위·서재에서 들어옴 → 탭 숨김, 찾기로). 목차 탭에서 검색어를 치거나 [찾기]/Enter 하면 찾기 탭으로.
- **목록**: 개요 깊이대로 들여쓰기(깊이 1 → 0 · 2 → 16px · 3 이상 → 32px). **깊이 3 이상은 접는다**(17-8-6) — 그 위 깊이 2 항목 옆 48×48 접기 단추(이름 = 그 항목 제목, `aria-expanded`, 새 문구 없음), 지금 항목이 든 가지는 처음부터 펼침. 제목은 `dir=ltr lang={문서 언어}` · `textContent`. 쪽 표시·"지금 읽는 곳"은 UI 방향.
- **지금 항목**: 쪽 ≤ 지금 쪽 중 쪽이 가장 큰 항목(같은 쪽이면 뒤 항목), `aria-current="true"` + 테두리 + 글자 "지금 읽는 곳"(`search.toc.here`). 처음 열 때 그 항목을 가운데로 굴린다. 지금 쪽 = 리더가 이 책이면(숨어 있어도) 그 쪽, 아니면 `lastPage`.
- **누름**: 결과 이동과 같은 `beginJump(JUMP_ENV, …)` — 낭독 중·쪽 넘김 대기면 멈춤 → 숨은 리더에 "이동" 표시(F1 규칙) → **쌓는 이동**(뒤로 = 목차 탭·그 스크롤 그대로). 도착하면 `doTop`: 쪽 맨 위 + 멈춤·처음이면 다음 [▶] 를 그 쪽 첫 줄로 + 띠가 이 책이면 이 쪽 적중은 다시 칠함.
- **안내**: 개요를 못 읽음 → "목차를 아직 읽지 못했습니다" · 폴백 → E5 문구(늘) · 0 항목 → "만들지 못했습니다" · DB 실패 → 일반 오류 한 줄 · 백필 실패 → 저장소 안내 한 줄 + 있는 heads 로 만든 목록.
- 뒤로 돌아오면 탭·스크롤·펼침이 그대로(모듈 메모리 — URL 에 넣지 않음), "지금 항목" 만 새 쪽으로.

## 4. headless (Edge · 새 프로필 `b8g4b/pa` 1개 · 캐시 끔 · 흉내 음성 · 가짜 키 + 흉내 번역 응답)

준비(`setup.mjs`): 의학책 3 + OCR 교재 2(쓰레기 개요 `Essential Grammar In Use 2nd edition … Book [OCR].pdf` 299쪽 · 폴백 `스피쿠스 100003_unit1 [OCR].pdf` 6쪽) 가져와 추출 끝까지 114초. 결과 JSON `b8g4b/run-*.json`, 캡처 `shots-8g4b/`. 모든 실행의 콘솔 오류는 기존 `/favicon.ico` 404 하나(unavail 은 의도한 차단 `ERR_FAILED` 2개 더), 로컬 밖 요청은 pdf.js CDN 뿐.

**S19 (412×915, 최종 코드로 다시 돌림)** — `run-s19.json`

| 책 | 항목 | 안내 | 깊이·들여쓰기 | 지금 항목(리더 쪽) | 쪽 표시 | 누름 → | 뒤로 |
|---|---|---|---|---|---|---|---|
| Harrison | **37** | 없음 | 1·2 → 0·**16px** | ANSWERS p.117(120쪽) · 화면 안 | p. 117 | 5쪽 · scrollY 0 | 목차 탭 · 스크롤 같음 |
| CMDT 2026 | **61** | 없음 | 1 | 9. Pulmonary(300쪽) | **p. 240 (PDF 278)** · 앞부분 "p. i (PDF 4)" | 5쪽 · 0 | 같음 |
| CMDT 2021 | **50** | 없음 | 1 | 10. Heart Disease(900쪽) | p. 874 | 28쪽 · 0 | 같음 |
| Essential Grammar 2판(쓰레기 개요 299) | 폴백 **192** | **E5 문구** | 1 | p. 40 항목 | p. 40 | 9쪽 · 0 | 같음(58 = 58) |
| 스피쿠스 unit1(개요 없음) | 폴백 **20** | E5 문구 | 1 | p. 3 항목 | p. 3 | 1쪽 · 0 | 같음 |

- 다섯 권 모두 줄 높이 ≥ 48 · 가로 스크롤 0 · **파일 이름 0 줄** · 제목 `ltr/en` · 탭 열고 그리기까지 16–223ms(폴백은 `prepareDoc` 포함).
- **언어·폭**(`run-langs.json`): 360·412 × ar/en/fr/ko — CMDT 2026 61항목 · 최소 높이 48 · 가로 스크롤 0 · 지금 항목 화면 안 · ar 은 `dir=rtl`·"ص. 240 (PDF 278)"·탭 순서 뒤집힘(찾기 오른쪽) · 쓰레기 개요 책 ar 문구 · 파일 이름 0.
- **오프라인 첫 열기**(`run-unavail.json`): Harrison 의 저장된 개요를 지우고 pdf.js 두 CDN(jsdelivr·cdnjs — 앱에 대체 CDN 이 있어 둘 다 막아야 했다)을 막아 리더 → 7초 뒤에도 `outlineV` 없음 → 목차 = **"목차를 아직 읽지 못했습니다" + E5 문구 + 폴백 120항목**(S36 의 Harrison 120 과 같음). 막지 않고 다시 열어 개요 37 저장 → 안내 없음 · 37항목으로 되돌림.
- **낭독 중 목차 이동**(`run-tocplay.json`): Harrison 120쪽 낭독 → [🔍] → 목차 → 163쪽 항목: 멈춤 · scrollY 0 · 번역 요청 0 · [▶] 첫 발화 = 163쪽 첫 줄. 같은 쪽 항목(숨은 리더가 그린 그 쪽, 600px 내려 둠) → 다시 그리지 않고 맨 위.
- 캡처: `S19-{har,c26,c21,ess,spk}-toc-412.png`·`-landed.png`, `S19-c26-toc-{360,412}-{ar,en,fr,ko}.png`, `S19-ess-toc-{360,412}-ar.png`, `S19-har-unavailable.png`, `T-tocplay.png`.

**4a 작은 문제 고침 확인**

| # | 결과 | 캡처 |
|---|---|---|
| ① `run-narrow.json` | 360 × 퀴즈 보임: 제목 **ar 52 · en 54 · fr 54 · ko 55px**(예전 5·0·0·15). 버튼 전부 ≥ 48×48 · 한 줄 · 화면 안 · 가로 스크롤 0. [⧉] 는 48px 글리프(이름 "Original" 등 그대로). 360 퀴즈 없음·412 는 예전 그대로(412 퀴즈 보임 제목 45–67 — 규칙은 ≤ 400px 만) | `N1-reader-360-{ar,en,fr,ko}-quiz.png` |
| ③ `run-cue.json` | 낭독 중(47중 2번째) → 검색 → 본문 결과: 이동 직후 진행 칸 **"50중 28번째 줄"**, [▶] 뒤 같은 값, 멈춤 · `search.paused` | `C3-cue-progress.png` |
| F2 `run-f2.json` | 처음 상태: 원본 → 리플로우 뒤 적중 **+2.3%**. 낭독 멈춤: **−6.9%**, [▶] 첫 발화 = 적중 문장 | `F2-original.png`·`F2-back-reflow.png`·`F2-paused-back-reflow.png` |
| F3 `run-f3.json` | CMDT 2026 낭독 → 서재 범위 → Harrison 결과: 번역 요청 0 · 발화 0 · 상태 "처음"(정리됨) · 적중 +5.4% · [▶] 첫 발화 "E. Sarcoidosis". 번역 띠는 **서재에서 그 책을 바로 연 것과 같은 모습**(낭독 동반 번역 `speak` 모드 — 빈 띠 보임, 대조 측정) | `F3-other-doc.png` |
| 8i-3 회귀 `run-turn.json` | 리플로우 30→36 낭독: 발화 168 · 쪽별 30:26 · 31:34 · 32:24 · 33:27 · 34:23 · 35:32 · **같은 문장 연달아 0** · 끊김은 끝의 내 멈춤 1개 — 8g-4a Review·4a-fix Review 와 같은 수 | — |

F2 원인(디버그 `dbg-f2.mjs`·`dbg-f2p.mjs`): 원본 보기는 412px 에서 쪽 전체가 한 화면이라(스크롤 높이 = 보이는 높이) 기준 줄 규칙(`pickAnchorLine` ② 가운데 줄)이 적중 줄이 아니라 쪽 가운데 줄을 골랐다. 고침: 리더가 뷰를 바꾸기 직전 **검색이 칠해 둔 고른 적중 줄이 지금 보이면** 그 줄을 기준으로(`setViewAnchorHint` → `hintedAnchor`, 평소 규칙보다 먼저 — 굴려서 안 보이면 평소 규칙). 또 멈춘 채 뷰를 바꾸면 `speaker.reload` 가 "단위 첫 줄" 기준으로 되살려 적중 문장 앞 문장(같은 줄을 나눠 쓰는)으로 물러났다(46 → 45 → 44) — 시작점이 아직 검색이 정한 것일 때만 같은 쪽 다른 뷰 그리기 뒤 다시 cue(`shouldRecue`, ▶ 하면 풀림).

## 5. R2 약어 규칙 + S36 재실행

- 규칙: "3자 이하 낱말 + 마침표는 문장 끝 아님" 예외를 **대소문자가 있는 글자로만 된 낱말**에만. 앱 `js/text/search.js` 와 기준 정의 `dev/measure-toc-8g3b.mjs` 의 정규식 `CASED_WORD = /^[\p{Lu}\p{Ll}]+$/u` 와 조건이 글자 그대로(S33c 가 두 파일을 맞댄다).
- **S36**(`b8g4b/run-s36.mjs` — 책마다 상한 의학 400초·OCR 120초, 전체 2,400초; 94/94 종료 0, 193초; 판정 `judge-s36.mjs` → `s36-judge.txt`):
  - 모든 책 `symDiffAppVsProto` **0**(합 0) · `isJunkOutline` = `protoJunk` 94/94(쓰레기 6 · 진짜 개요 5 · 폴백 89권) · 폴백 0항목 책 0(최소 **8** — 예전 9).
  - **의학책 S18 회귀 0**: CMDT 2021 98항목 · 제목 45/50 · 쪽 47/50 / Harrison 120 · 쪽 30/37 / CMDT 2026 97 · 51/61 · 5/61 — 8g-3b 와 같음. Supplementary 쪽 56 · 제목 14, Harry Potter 33(그대로).
  - **빠진 항목 = 150, 모두 한글 문장 끝**(58권), 새로 들어온 항목 0. **스피쿠스 unit 60권 중 57권에서 127항목**(1,038 → 911), EnglishCafePlus 23(106 → 83). OCR 91권 폴백 합 4,905 → 4,755, 문장꼴 항목(진단값) 715 → 565(폴백 89권). 8g-3b Review 가 센 "150항목·58권"과 정확히 같다(`r2diff.mjs` — r8g3b 덤프 94권으로 앞뒤 `headingToc` 비교 → `r2diff.json`).
  - 시간 열은 한 번 실행 값(첫 호출)이라 기록만(§11 S36 정정 — 반복 값 판정).

## 6. 새 i18n 키 (4개 × 4언어, ar 먼저)

| 키 | ko | en |
|---|---|---|
| `search.toc.fallback` | PDF 에 쓸 만한 목차가 없어 큰 제목으로 만든 목록입니다 — 빠지거나 틀린 항목이 있을 수 있습니다 | This PDF has no usable table of contents, so this list was built from large headings — some entries may be missing or wrong |
| `search.toc.unavailable` | 목차를 아직 읽지 못했습니다 | The book’s table of contents has not been read yet |
| `search.toc.empty` | 이 책에서 목차를 만들지 못했습니다 | Could not build a table of contents for this book |
| `search.toc.here` | 지금 읽는 곳 | Where you are reading |

ar·fr 도 같은 뜻(자리표시자 없음). `search.*` 는 이제 38개(4a 34 + 4).

## 7. spec 정정 줄 (모두 `[정정 2026-10-20 — 8g-4b …]`, 17-8-5·17-8-12 안에서만 — 12줄)

- 17-8-5: ① versionchange 뒤 reject 할 수 있음(carryover 8) ② `onPartial` 두 번 가능·바꿔 그림(9) ③ 조각 말줄임은 잘린 쪽에만(4a 제안 7)
- 17-8-12 §2-2: ④ "서재 ≤ 3초"·S15 서재는 백필 뒤 기준(10)
- §4-1: ⑤ 띠 순서 = 쪽 순서, 제목 묶음 첫 줄이면 "19/82" 처럼 중간 번호로 시작 — 의도(4a 제안 4 · ④)
- §4-3: ⑥ 띠 ‹ ›·[읽던 곳으로] replace · 읽던 자리는 띠가 없을 때만 기억(4a 제안 3)
- §4-5: ⑦ 리더 → 검색은 숨기기만 · 떠났던 쪽 해시 replace 는 **뒤로 돌아올 때만**, 결과·목차·[읽던 곳으로] 이동엔 아님(4a 제안 2 고쳐서 · F1) ⑧ `cue` 는 idle 에서도 · 인용 쪽 끝이면 다음 쪽부터(제안 5) ⑨ 원본 보기 표 적중 `scrollToRegion`(제안 6) ⑩ 숨은 리더에서 다른 책 → `leaveReaderNow` 정리, 상태는 "처음", 빈 번역 띠는 그 모드의 평소 모습(F3 · 22)
- §4-6: ⑪ 실제 키 `search.*` 38 + `err.dbUpgraded` + `common.reload`, 4a 34 · 4b 4(제안 1)
- §11-3: ⑫ R2 약어 예외 정정 + S36 재실행 수치(16)

**spec 문안 제안(고치지 않음 — 지침의 정정 범위 밖이라)**: (a) §4-2/17-8-6 목차 탭 — 이 책 범위에서만 · 타이핑하면 찾기 탭 · 깊이 3 이상 접기는 "깊이 2 조상 단위, 지금 항목 가지만 펼침" · 지금 항목 = "쪽 ≤ 지금 쪽 중 가장 큰 쪽(같으면 뒤 항목)" · 항목 누름 = 결과 이동과 같은 길(멈춤 → 쌓는 이동 → 쪽 맨 위 + 첫 줄 cue) · 폴백은 `prepareDoc` 뒤 다시 만듦. (b) §4-5 뷰 전환 행에 "검색이 칠해 둔 고른 적중이 보이면 그 줄이 뷰 전환 기준 줄 · 멈춘 채 같은 쪽 다른 뷰면 시작점이 검색 것일 때 다시 cue"(F2). (c) S20 에 "≤ 400px + 퀴즈 버튼 보임이면 [⧉] 글리프·간격 4px·글자 버튼 여백 8px"(①).

## 8. 변이 (`b8g4b/mut.mjs` — 정확히 1회 일치 → 전체 테스트(상한 300초) → `bak/` 에서 **읽어서 쓰기**로 복원 → 바이트 비교, `mut.json`·`mut/*.tap`)

| # | 변이 | 빨강(IM2·IM6·IM7b 해시 제외) |
|---|---|---|
| V1 | R2 약어 예외를 대소문자 확인 없이(옛 규칙) | S33c |
| V2 | 쓰레기 개요를 버린 책은 폴백 문구 없음 | T1 · T3 |
| V3 | X1 — pending 의 쪽 번호 확인 빼기 | T4 |
| V4 | R8 — 개요 예약 표시를 풀지 않음 | T5 ×2 |
| V5 | R9 — 한가할 때가 아니라 즉시 | T5 ×2 |
| V6 | ③ cue 뒤 진행 칸 그리기 빼기 | T6 |
| V7 | F3 — 다른 책이면 정말로 떠나기 빼기 | T7 F3 |
| V8 | F2 — 힌트 줄 보임 확인 빼기 | T7 hintedAnchor |
| V9 | F2 — 다시 cue 가 ▶ 뒤에도 | T7 shouldRecue |
| V10 | `p:null` 항목도 누를 수 있게 | T2 |
| V11 | 접기 단위를 깊이 1 에도 | T2 접기 |
| V12 | 기준 정의만 옛 R2(앱과 어긋남) | S33c |

→ **12/12 빨강**(지침의 네 변이 = V1·V2·V3·V4 포함), 복원 12/12 바이트 같음, 끝에 5파일 `sha256sum -c` OK.

## 9. 운영자에게 넘길 실기기 확인 목록 (carryover 24 그대로 + 4b)

1. 할당량 실패 화면(저장소 가득 참 — headless 에서 할당량을 못 줄였다, 8g-4a Review F5).
2. Gboard 음성 입력으로 검색 칸 채우기.
3. 쪽 넘김 대기(`waiting-page`) 중 결과 누름 한 번.
4. (4b) Nour 기기 412px: 목차 탭만으로 장 이동(타이핑 0) — CMDT 2026 "p. 인쇄 (PDF)" 표시, 낭독 중 목차 항목 → 멈춤 → [▶] 그 쪽 첫 줄부터.
5. (4b · §11-6 `[M]`) 운영자 기기에서 Essential Grammar in Use 2판·Harry Potter 2 목차 탭 첫 화면 15줄.
6. (4b) 360px 폰이 있으면 퀴즈 버튼이 보이는 쪽에서 상단바 제목이 몇 글자 보이는지·[⧉] 글리프가 알아볼 만한지.

## 10. 검증 수치

- 전체 `node --test apps/medreader/tests/*.test.mjs` **1228/1228 × 2회**(1206 + 22: 새 파일 21 + S33c 1), fail 0 · cancelled 0, 각 약 8.4초(`b8g4b/full-1.tap`·`full-2.tap`). 중간 확인 `full-0.tap`(F2 테스트를 더하기 전 — 그때 1226/1226).
- `stamp-importmap --check` "그대로다 (모듈 58개 · CSS 4개)", 종료 0. `git diff --check` 깨끗. 바뀐 파일은 모두 LF(HEAD 와 같음 — 도중에 내 Python 편집이 `search.js` 를 CRLF 로 쓴 것을 LF 로 되돌림, 도장은 그대로였다).
- 앱 파일 해시(`sha-before.txt` ↔ `sha-after.txt`): 바뀐 것은 1절 표의 파일뿐. `.nojekyll` 있음.

## 11. 실행 · 정리

- 모든 명령에 시간 상한(`timeout`·`spawnSync timeout`). 표준 입력을 기다리는 명령 없음(`< /dev/null`). 권한·훅에 막힌 명령 없음.
- 브라우저 프로필은 새로 만든 `b8g4b/pa` **하나**(약 414 MB — `rm -rf` 금지라 남김, 지울 경로). 실험 중 이 프로필의 Harrison `outline`·`outlineV` 를 지웠다가 앱이 다시 읽어 되돌렸다(37항목 확인).
- 띄운 Edge·node 는 모두 닫혔다 — 프로세스 목록이 시작과 같다(node 47456·40228·48404·19520·48492·9980·40176·21516, msedge 46716 은 원래 있던 것). **8000번 python(PID 15088) 켜 둠**, 8123·8124·8125번 node 는 건드리지 않음.
- 스크래치 `b8g4b/oldtree` 는 스크립트가 만들고 지웠다(`fs.rmSync` — 내 임시 사본).

## 12. 남은 문제 · 관찰

1. **[관찰 — 범위 밖, speaker.js]** 검색과 무관하게, 멈춘 채 원본 ↔ 리플로우를 오가면 `speaker.reload` 의 "단위 첫 줄" 기준 때문에 다음 [▶] 시작점이 한 문장씩 앞으로 물러날 수 있다(앞 문장과 첫 줄을 나눠 쓰는 문장일 때 — 실측 46 → 45 → 44). 검색이 정한 시작점은 이번에 지켰지만(F2 `shouldRecue`), 일반 낭독 멈춤에서는 남는다. 고치려면 `reload` 가 지금 단위의 `ranges` 첫 글자로 찾게 하는 작은 수정(speaker.js — 다음 단계 Plan 거리).
2. 목차 항목으로 갈 때 낭독이 멈췄다는 안내(`search.paused`)는 **띠 안**에 있어서, 띠가 없는(검색 결과로 가지 않은) 목차 이동에서는 보이지 않는다. ▶ 단추 모양으로만 알 수 있다 — 필요하면 운영자 결정.
3. 한 쪽에 항목이 여럿이면 "지금 항목"은 그 쪽의 **마지막** 항목이다(쪽 맨 위에 있을 때도). 폴백(쪽당 여러 heading)에서 눈에 띈다.
4. CMDT 2026 앞부분 라벨이 숫자가 아니면 "p. Cover (PDF 1)"·"p. i (PDF 4)" 처럼 그대로 보인다(§3 "라벨 글자는 그대로" — 규칙대로지만 "p. Cover" 가 어색할 수 있다).
5. ① 은 ≤ 400px 만 — 412px(Nour 기기) 퀴즈 보임에서 제목은 예전처럼 45–67px. 넓히려면 문턱을 420 으로(같은 규칙).
6. F3 뒤 빈 번역 띠는 낭독 동반 번역 모드가 켜진 평소 모습이다(서재에서 그 책을 바로 열어도 같다 — 대조 측정). 8g-4a Review 가 본 "빈 띠"는 정리 생략 여부와 무관하게 보이는 것이었다.
7. 스피쿠스(한글+영어 교재)의 문서 언어가 `en` 이라 한글 목차 제목도 `lang=en` 으로 붙는다 — 문서 언어 속성(서재 [⋯])을 따르는 기존 규칙 그대로.
8. 폴백 목록 첫 줄에 OCR 잡음(": Essential"·"Grammar")이 남는 것은 §11-9 "이번엔 못 함" 그대로.
