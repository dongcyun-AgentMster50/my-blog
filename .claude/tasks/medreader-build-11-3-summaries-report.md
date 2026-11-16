# Build 보고서 — 11-3 저장한 요약 모아 보기 · 범위 개요(11c) · 내보내기

> 지침: `.claude/tasks/medreader-build-11-3-summaries.md` · 설계: spec **17-2-1**(11-3 몫 — 4-6 · 5 표 11-3 행 · 6 · 7 · 8 "11-3" · 10 · 13) · 11-1·11-2 보고서 · review.md "11-1 Review"·"11-1b 재검증"·"11-2 Review" · crossstep 11-1R #5. 직전 배포 11-2 `b7bc352`.
> 커밋하지 않았다. 스크래치: `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b11-3\`.

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/ui/summaries.js` **새**(985줄 — 설계 약 420 보다 큼: 순수·흐름·화면·측정 훅이 한 파일) | 순수 `exportName`·`exportFile`·`collectExport`(저장소의 요약·개요만)·`langKey`·`hashParasOf`·`relocateLine`·`chaptersOf`·`chapterAt`·`startPage`·`scopeOptions`·`viewGroups`·`inRange`·`defaultPages`·`rangeOptions`·`iso`·`shortLabel` · DOM 없는 흐름 `createOutlineFlow`(make·retry·save·reset — 늦은 결과 버림) · 화면 `initSummaries`·`showSummaries`·`leaveSummaries`(목록 `<details>` · 범위 개요 칸 · 내보내기 · [원문으로] · 페이지 안 삭제 확인) |
| `js/router.js` | `SCREENS` 에 `summaries` · `#/summaries`·`#/summaries/:docId` · `summariesHash()` |
| `js/main.js`(+4) | import · `initSummaries()` · `leaveSummaries()` · `case 'summaries'` |
| `js/ui/library.js` | 카드 [⋯] "이 책의 저장한 요약"(`data-action="summaries"` → `go(summariesHash(docId))`) |
| `js/ui/sumsheet.js` | 링크 "이 책의 저장한 요약 (n)" 켬(`paintLink` — 문서가 있을 때, n = 요약 + 개요, 저장·지우기 뒤 다시 셈) · `sumServices()`(모아 보기가 같은 파이프라인을 씀) · **11-2R ①** Esc 도 `cancelVoiceNow()` · **11-2R ⑥** [… 전체 요약] 이름에 연 쪽 라벨(`paintPageAll`) |
| `js/ai/prompts.js`(개요 빌더만) | **범위 이름을 요청에서 뺌**(`outlineInstruction(target, domain)` — TASK `from one part of one book`, `buildOutlineRequest` 는 `label` 을 읽지 않음) · 쓰지 않게 된 `labelText`·`cutText` import 정리 |
| `js/text/summary.js`(`exportText` 만) | `labels.notice`(BOM 뒤 첫 줄 고지 + 빈 줄) · `labels.title`(지금 문서 제목) · 라벨·용어 머리도 `clean`(줄 안 CR·LF·U+2028/9 접음) · BOM 을 `'\uFEFF'` 이스케이프로 |
| `index.html` | `data-screen="summaries"` 섹션 · 시트 링크 주석 · stamp(모듈 85 → 86) |
| `css/screens.css` | `.sums-*`(논리 속성만 · 48px) · **`.sum-sheet .sum-link[hidden] { display:none }`**(아래 남은 문제 1) |
| i18n 4개 | 35키(`summaries.*` 34 + `library.card.summaries`) + `sum.pageAll` 4언어에 `{page}` · ar `summaries.scope.doc` 은 `vocab.scope.doc` 처럼 RLM 머리(I14) · ar·fr `[검토 — Nour·운영자]` |
| `tests/summaries-ui-11c.test.mjs` **새**(11) | N1–N9(아래) |
| `tests/sumsheet-11b.test.mjs` | **K15**(11-2R #3 · X2) · **K16**(11-2R #2 · X6) 더함 · K14 Esc 정규식에 `cancelVoiceNow()` 한 줄 |
| `tests/summary-11b.test.mjs` | O1·O3 — 범위 이름이 TASK 에 있다는 기대 → **없다**로 |
| `tests/router.test.mjs` | R1 에 `#/summaries` 도달 한 줄(파일에 NUL 글자가 있어 Edit 가 거절 — 노드로 그 한 곳만 바꾸고 NUL 바이트 1 → 1 확인) |
| `spec.md` | `[정정 2026-11-17 — 11-3 Build]` 3줄(4-3 · 4-6 · 7) |

손대지 않음: `pipeline.js`·`db.js`·`notes/*`·`backup/*`·`selbar.js`·`voice/*`·`ui/voice.js`·`controls.js`·`reader.css`·review.md·`dev/`(추적 안 된 `measure-table-8i4.mjs` 포함). DB 3·`algoVersion`·번역 `PROMPT_VERSION` 3·`OUTLINE_PROMPT_VERSION` 1 무변.

## 2. 수용 기준 "11-3" + 공통

| 기준 | 결과 | 근거 |
|---|---|---|
| `#/summaries/:docId`: 쪽 순서·장 머리(개요 맨 위 깊이) · 펼침 · [원문으로] → 그 쪽·그 문단 첫 줄이 편안 영역 안 | ○ | headless B `list`(8줄 · 장 머리 2) · `expand`(요지 rtl/ar · bdi · 원문 언어 요지 ltr/en · 트리 4 · 용어 2 · 단추 48) · `goto`(3쪽 마지막 문단 `3:p5` — 굴려서 top 392 / bottom 487 · 화면 915 안 · paraId 일치) · N3·N6 |
| 문단 위치가 바뀐 레코드(해시 불일치 심음) → 쪽 처음 + 한 줄 | ○ | B `moved`(found false · scrollY 0 · 배너 `summaries.moved`) · N6 |
| 문서를 지운 요약은 `docTitle` 묶음 · [원문으로] 없음 | ○ | B `gone`(서재에서 문서 삭제 → 8줄 남음 · 책 1 · goto 0) · N3 |
| 범위 개요: 장 하나 → "저장한 요약 n개 · 개요 만들기 (호출 1)" → 요청 **1** · 본문에 원문 문단 글 0 · 결과 3단 트리 · [저장] → `kind:'outline'` 1건 · 같은 범위 다시 → **0** | ○ | B `outline`(rangeN 4 · 요청 1 · 원문 조각 8개 0 · 장 이름 0 · details 2 · 3단 li 1 · 고지 · 저장 1 · 목록 머리가 개요 · 다시 누름 요청 0) · N5 |
| 입력이 너무 큰 범위(합성 요약 60개) → 요지만 1건, 그래도 크면 **0건** + "범위를 줄이세요" | ○ | B `big`(60 · 1건 · DOC 60항목 전부 `points` 없음) · `huge`(0건 · too-big · 문구에 60) · N5b |
| `exportText`: BOM·CRLF·들여쓰기·RTL 글 그대로·키 문자열 0(가짜 키를 저장소에 둔 상태) | ○ | N2(가짜 키 저장 + aiCache 에 키 꼴·캐시 글 심음 → 파일에 0 · 방향 표시 문자 0 · 줄 안 줄바꿈 접음) |
| `[D]` 내보내기 → `createObjectURL` 가로채 Blob 읽기 — 파일 이름·줄 수 | ○ | B `export`(`medreader-summaries-20261117.txt` · text/plain;utf-8 · BOM · CRLF 만 · 99줄 · 키 0 · 원문 0 · 첫 줄 고지 · 사용자 Downloads 0 — `<a>.click` 가로채기) |
| 360×740·915×412 × 4언어: 가로 스크롤 0 · 줄 48px 이상 · 아랍어 UI 에서 원문 언어 요지 `dir=ltr` | ○ | headless L 8조합 `allOk:true`(scrollWidth = innerWidth · 48 미만 0 · 화면 밖 0 · 줄 최소 66/48 · 원문 언어 요지 ltr · 이 동안 요청 0) |
| 변이: 범위 개요가 입력 초과에서도 보냄 · `outlineInput` 이 원문 문단 글을 넣음 · 내보내기가 `aiCache` 를 읽음 | ○ 빨강 | 7절 M1–M3 |
| 호출(6절): 목록·펼침·[원문으로]·[삭제]·내보내기 0 · [개요 만들기] 최대 1 | ○ | B `del`(요청 0) · `export` · L(요청 0) · `outline.again` 0 |
| 공통: 전체 시험 · stamp `--check` 0 · splitSentences 3파일 그대로 · `innerHTML` 새 사용 0 · 콘솔 오류 0 · 무료 티어 숫자 0 · 규칙 1–6 대조 · 진짜 키 0 | ○ | 6절 · N9 · N7(`system` = `commonSystem(true, domain)`) · 콘솔은 의도한 429 네트워크 줄만 |

## 3. 11-2R 처리

| # | 무엇 | 처리 |
|---|---|---|
| ① | 음성 "요약" 요지를 말하는 중 Esc → 말하기·재개가 이어짐 | **고침** — `onKey` 가 [×] 와 같은 `cancelVoiceNow()`(controls `cancelVoice` = voice.cancel + sayer.stop). headless B `escVoice`: Esc 뒤 sayer 멈춤 · restores 0 → 0 · 낭독 paused. 변이 M6 빨강(K14) |
| ③ | 시트 `run()` 의 `my !== gen` 시험 없음(X2) | **시험 K15** — 열고(A 느림) 닫고 B 열기 → B 응답 → A 늦은 응답 → items[0] = B 요지 · 호출 수에 A 없음 · [저장]도 B. 변이 M5 빨강 |
| ⑥ | 쪽이 바뀐 뒤 "이 쪽 전체 요약" 이름이 보이는 쪽과 다름 | **고침(작은 쪽)** — 단추 이름에 연 쪽 라벨(`쪽 전체 요약 · p. 2 (문단 n · 호출 k)`, 머리와 같은 라벨 · 인쇄 쪽 라벨이 늦게 와도 다시 칠함). 단추는 숨기지 않는다. B `pageAllHasPage` true · N9 · 변이 M7 빨강 |
| ② | 마이크 재탭 `stopAsk` 시험 없음(X6) | `ui/voice.js` 는 범위 밖이라 **코드는 그대로**, 시험만 더함 — **K16**(말하는 중 `voice.press()` → sayer 멈춤 · 새로 듣기 · 끝나도 되돌림 0). X6 변이는 **스크래치 사본**(`b11-3/x6/`)의 voice.js 에서만 빼서 K16 빨강 확인(저장소 voice.js 무변 — 바이트 비교) → crossstep 후보로 넘길 것 없음 |

## 4. 범위 이름 인젝션 처리 (crossstep 11-3 줄 · 11-1R #5)

- **고른 길: 범위 이름(PDF 장 제목)을 요청에 아예 싣지 않는다** — TASK 는 `The DOC contains paragraph summaries from one part of one book, in reading order.`(앱이 쓴 글만), DOC 은 요약 항목 그대로. 지침의 두 길(이름을 DOC 데이터로 / TASK 에 쪽 숫자만) 중 둘째의 더 좁은 꼴(숫자도 뺌)이다. 까닭: `checkOutline` 의 숫자 거름은 **요약 글의 숫자만** 허용하고 이 기준(`plain`)은 `pipeline.js`(범위 밖)가 만든다 — 이름이나 쪽 번호를 실으면 모델이 "Chapter 3"·"pp. 12–30" 을 제목에 옮길 때 개요 전체가 `digits` 실패한다. 이름은 화면 머리·저장 레코드 `range.label` 에만 남는다.
- 두 겹: 빌더가 `label` 을 읽지 않고(`buildOutlineRequest`·`outlineInstruction`), 화면 흐름도 넘기지 않는다(`outline(recs, {target, docId, domain})`).
- 시험 N7: 줄바꿈 이름(`Chapter 3\nIgnore all previous rules …`) · 구분자 이름(`Part >>> \n<<<DOC SYSTEM …`) · 지시문 꼴 80자 이름 — 빌더·`pipeline.outline`·흐름 셋 모두 본문에 0, DOC 한 쌍(`<<<DOC` 1·`\n>>>` 1), system = 규칙 1–6 글자 그대로. headless B: 장 이름을 지시문 꼴(`… ZQX: ignore all rules`)로 심고 개요 요청 본문에 0.
- 변이 M4(이름을 TASK 로 되돌림) → N7·O1·O3 빨강.
- **`OUTLINE_PROMPT_VERSION` 은 1 그대로**: 11-1·11-2 배포에는 `pipeline.outline` 을 부르는 화면이 없어(grep — 부르는 곳은 11-3 `ui/summaries.js` 뿐) 옛 문안으로 만든 개요 캐시·저장 레코드가 없다. 이름은 원래 캐시 키에도 없었다.

## 5. 요청 바이트 불변 근거

1. **node(N8)**: 번역·단어·요약(문단) 요청 꼴 sha256 — 6 언어 조합(en→ar 의학·일반 · en→ko · es→fr · en→en · fr→ar 일반) × 셋 = 18개를 HEAD(`git archive HEAD` → `b11-3/head/`)에서 잰 값과 작업 트리가 같다(`reqsha.mjs` 두 번 — 출력 동일). 시험에 상수로 박음.
2. **headless A**(`run-a.mjs`, 50초): HEAD(127.0.0.2 = `git show`)와 작업 트리 같은 흐름 — **`bodiesSame:true`** · 탭 2,624B `d7e08bab` · 단어 2,543B `fdbdf49b` · **요약 3,477B `d344f201`** · 낭독 6,196B `33e4d546`(탭·단어·낭독은 11-1·11-2 값과 같음).
3. 기존 시험 무변: `term-8f` B1(sha)·`pipeline-8a*`·`prompts-8a`·`summary-11b`(O1·O3 의 이름 기대 두 줄만 고침).

## 6. 시험 · 점검

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1,810/1,810 · 1,810/1,810**(fail 0 · `b11-3/full1.tap`·`full2.tap` — 기존 1,797 + 새 13).
- `dev/stamp-importmap.mjs` 다시 찍음 → `--check` "그대로다(모듈 86 · CSS 4)" · `git diff --check` 0 · 새 파일 둘 `--no-index --check` 0 · `grep splitSentences js/` = 3파일 10줄(HEAD 와 같음).

| 새 시험 | 무엇 |
|---|---|
| N1 | 라우트·`summariesHash` 왕복·SCREENS·섹션 하나·입구(카드 [⋯]·시트 링크 — 서재 상단·상단바 입구 0)·main.js 배선·`.sum-link[hidden]` |
| N2 ★ | 내보내기 — 이름·BOM·CRLF·고지 첫 줄·줄 꼴(개요가 범위 머리)·RTL·키 0·캐시 글 0·원문 0·책 범위·Blob/revoke/download |
| N3 | 장(맨 위 깊이·쓰레기 개요 → [])·목록 모양(개요가 범위 머리)·지운 책·책 고르기·방향 격리·40자 |
| N4 | 범위 — 대상 언어 거름·장 기본값·쪽 범위 기본값·`OUTLINE_MIN` |
| N5·N5b·N5c ★ | 개요 흐름(진짜 파이프라인 + 흉내 Gemini + fake-idb) — 1호출·원문 0·3단·저장·대체·같은 범위 0·요약 1개 0 · 60개 요지만 1 · 그래도 크면 0 + 문구 · 동의 없음·키 없음 0 + 배너 · 429 → [다시 시도] = retry 먼저 · 늦은 결과 버림 |
| N6 | [원문으로] 해시 문단 = 시트의 길(인용 단위 빠짐 대조) · 같은 해시 → 첫 줄 · 문단 번호 바뀜에도 찾음 · 불일치 → moved |
| N7 ★ | 범위 이름 인젝션 3꼴 — 빌더·파이프라인·흐름 |
| N8 ★ | 번역·단어·요약(문단) 요청 꼴 = HEAD(18 sha) · `PROMPT_VERSION` 3 · `OUTLINE_PROMPT_VERSION` 1 |
| N9 | innerHTML·onclick·confirm() 0 · 요청 꼴 직접 안 만듦 · import 방향 · 마크업 id · 도장 · CSS 논리 속성·48px · i18n 4언어 같은 키·자리표시자 · 11-2R #6 |
| K15·K16 | 11-2R #3·#2 시험 틈 |

## 7. 변이 (원본 바이트를 `b11-3/bak/` 에 쓰고 한 곳만 바꿈 → 시험 → `bak/` 를 **읽어서 쓰기** → 바이트 비교 · 끝에 `cmp` 4파일 0) — `mut.mjs`

| # | 변이 | 빨강 | 복원 |
|---|---|---|---|
| M1 | 범위 개요가 입력 초과에서도 보냄(`outlinePayload` 크기 0) | N5b · O2 | 같음 |
| M2 | `outlineInput` 이 원문 문단 글을 넣음 | N5 · O1 · X1 | 같음 |
| M3 | 내보내기가 `aiCache` 를 읽음(`collectExport`) | N2 | 같음 |
| M4 | 범위 이름을 TASK 로 되돌림(인젝션) | N7 · O1 · O3 | 같음 |
| M5 | [11-2R #3 · X2] 시트 `run()` 늦은 결과 버림 빼기 | K15 | 같음 |
| M6 | [11-2R #1] Esc 의 `cancelVoiceNow()` 빼기 | K14 | 같음 |
| M7 | [11-2R #6] [… 전체 요약] 쪽 라벨 빼기 | N9 | 같음 |
| M8(더) | [원문으로] 해시 문단을 줄 단위로(시트와 다른 길) | N6 | 같음 |
| M9(더) | 개요 흐름이 범위를 바꾼 뒤 늦은 결과를 버리지 않음 | N5c | 같음 |
| X6(사본) | [11-2R #2] 마이크 재탭 `stopAsk` 빼기 — **스크래치 사본** voice.js | K16 | 저장소 voice.js 무변(바이트 비교) |

변이 전후 대상 시험 68/68 → 68/68. `cmp` prompts·summary·summaries·sumsheet ↔ `bak/` 차이 0.

## 8. headless (Edge · pipe · 새 프로필 `b11-3/p*` · 가짜 키 · 흉내 Gemini OPTIONS 204 + CORS · `responseSchema` 갈래 · 캐시 끔 · 서버 없음 — 가로채기 · 합성 PDF `b11-2/syn.pdf`·`b9c2/syn.pdf` 읽기만 · 한 번에 하나)

| 실행 | 프로필 | 시간 | 결과 · 콘솔 오류 · pageerror · 외부 · 없는 파일 · 흉내 오류 |
|---|---|---|---|
| `run-b.mjs`(수용 기준 전부) | pB4 | 28초 | 2절 · 1(의도한 429 네트워크 줄) · 0 · 0 · 0 · 0 |
| `run-a.mjs`(HEAD 대조) | pA1 | 50초 | `bodiesSame:true` · 0 · 0 · 0 · 0 · 0 |
| `run-l.mjs`(8조합) | pL3 | 15초 | `allOk:true` · 요청 0 · 0 |
| `run-r.mjs`(11-2 회귀 하네스 사본 — 8c-1·8f-2·18·9a·9b·8e·Esc 층) | pR1 | 28초 | 11-2 보고와 같은 값 · 0 |
| `run-u.mjs`(8f-3 단어장·`#/vocab`·8c-2 사용량·카드 [⋯]·알 수 없는 해시·뒤로) | pU1 | 10초 | 카드 동작 순서 `…vocab, summaries, reextract` · 단어장·사용량 화면 그대로 · 요청 0 · 0 |
| `run-h.mjs`(HEAD 시트 링크 — 남은 문제 1 확인) | pH1 | 20초 | HEAD: `hidden` 인데 `display:flex`·보임 · 작업 트리: 문서가 있어 켜짐(`#/summaries/…`) · 0 |
| (앞 실행) pB1·pL1·pL2 | — | — | 하네스 고침(앵커 `.click` 가로채기라 시트 링크는 MouseEvent 로 · BOM 디코드 · 독 높이 0 · no-key 단계 순서)·**앱 고침 하나**(이 화면으로 바로 부팅하면 측정 훅이 main.js 전역 교체에 덮임 → 읽기 뒤 한 번 더 달기). pB2 는 PDF 올린 뒤 리더 해시를 60초 안에 못 봄(한 번 — 같은 스크립트 pB3·pB4 정상, 앱 무관 추정) |

스크린샷 5장 `b11-3/shots/`: `1-summaries-ko-412.png` · `2-goto-reader-ko-412.png` · `3-outline-ko-412.png` · `4-summaries-ar-360x740.png` · `5-summaries-fr-915x412.png`.

## 9. spec 정정 (`[정정 2026-11-17 — 11-3 Build]`, 그 자리만)

1. **4-3**(11-2 정정 줄 뒤): 11-2R ① Esc 도 [×] 처럼 말하기 취소 · ⑥ [… 전체 요약] 이름에 연 쪽 라벨 · 링크 켬.
2. **4-6**(내보내기 줄 뒤): 범위 이름을 요청에 싣지 않음(쪽 숫자도 — 숫자 거름 까닭) · `OUTLINE_PROMPT_VERSION` 1 그대로의 이유 · 장 = 맨 위 깊이(8g `d` 1부터) · 범위 칸·처음 고름·지금 대상 언어·`OUTLINE_MIN` 2 · 문지기 · `sumServices()` · "전체 보기" = 책 고르기 첫 줄 · [원문으로] 해시 길 · 내보내기 고지 첫 줄·제목·줄 접기·수집 범위 · 방향 격리는 화면만.
3. **7**: 실제 35키 · `sum.pageAll` `{page}`.

## 10. 마지막 실기기 점검 묶음에 더할 것 (적기만)

- [ ] `[M]` 실제 Gemini: 범위 이름 없이 만든 개요 제목이 쓸 만한가(장 이름을 싣지 않은 결정의 영향) · 큰 장(요약 20–40개)에서 요지만 갈래가 얼마나 잦은가.
- [ ] `[M]` 360 ar: 범위 칸(`<select>`)이 긴 장 이름의 앞부분을 잘라 보인다(40자로 줄였어도 "(ص. a–b) · n" 까지 한 줄) — 펼친 목록에서 읽히는가.
- [ ] `[M]` 실제 CMDT 쪽에서 [원문으로] → 그 문단 첫 줄이 편안 영역 안인가(긴 쪽 · 원본 보기 모드 · 다시 추출 뒤 "위치 바뀜" 한 줄).
- [ ] `[M]` Android Chrome 내보내기: `blob:` 내려받기가 파일로 남는가(30초 뒤 revoke) · 파일·메모 앱에서 아랍어·한국어·첫 줄 고지(13 "요약 내보내기 .txt" 줄과 함께).
- [ ] `[M]` 요약 시트 [쪽 전체 요약 · p. N] 단추가 360 fr·en 에서 두 줄이 되는가(이름이 길어졌다).

## 11. 남은 문제 · 넘길 것

1. **11-2 결함 하나를 고쳤다(알림)**: `css/reader.css` `.sum-sheet .sum-link { display:flex }` 가 `[hidden]` 을 이겨 11-2 배포에서는 시트 맨 아래 "이 책의 저장한 요약 (0)" 링크가 **늘 보였고** `#/summaries` 는 서재로 떨어졌다(11-2 headless·Review 가 보지 않음 — `run-h.mjs` 로 HEAD 에서 `hidden:true`·`display:flex`·보임 확인. 같은 특이성의 `.sum-sheet [hidden]`(898행)보다 뒤에 있어 이긴다). `reader.css` 는 범위 밖이라 `screens.css` 에 `.sum-sheet .sum-link[hidden] { display:none }` 로 막았다 — 다듬기 때 `reader.css` 한 곳으로 옮겨도 된다.
2. `summaries.js` 985줄(설계 약 420) — 순수·흐름·화면·측정 훅을 한 파일에(`vocab.js` 1,058줄과 같은 꼴).
3. `hashParasOf` 는 speaker `langKey`·`unitOpts` 규칙을 한 벌 더 갖는다(문장 분할 언어만 — `scriptSwitch`·인용 거름은 `src`·문단 글에 영향 없음). N6 이 시트 길과 대조하지만 speaker 가 문단 글에 영향을 주는 옵션을 더하면 둘을 함께 고쳐야 한다(controls·speaker 는 범위 밖이라 공유 함수로 빼지 않았다).
4. 범위 칸 `<select>` 는 좁은 RTL 화면에서 긴 이름 앞을 자른다(네이티브 칸 — 40자 줄임 + 방향 격리까지만).
5. 개요 [저장] 뒤 같은 범위를 다시 누르면 캐시로 0호출이지만 단추 이름은 늘 "(호출 1)"(최대값 — 설계 문구 그대로).
6. 개요 입력은 지금 대상 언어의 요약만 — 대상 언어를 바꾼 사용자는 옛 언어 요약으로 개요를 못 만든다(목록에는 그대로 보임).
7. 문서가 없는 책(`#/summaries/:지운 책`)에서도 쪽 범위 개요는 만들 수 있다(장은 없음 — 키는 docId 그대로).
8. 16 그림 개념도가 저장한 개요를 입력으로 받을 때 `range.label`(PDF 장 제목)을 지시문 자리에 넣지 않도록 — 16 Plan 에 한 줄.

## 12. 막힌 명령 · 규칙

- 막힌(거절된) 명령 없음.
- Edit 도구가 `tests/router.test.mjs`(R8 의 NUL 글자)를 거절 → 노드 스크립트(`b11-3/router-test.mjs`)로 그 한 곳만 바꾸고 NUL 바이트 수 1 → 1 확인(거절이 아니라 도구 안내대로).
- 명령은 한 호출에 한 가지(`cd … &&`·파이프·`; echo` 0) · 서버 띄우기 0 · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · 프로필 복사 0 · `.nojekyll` 그대로 · `G:`·`D:/OCR` 무관 · 원서 열지 않음(합성 PDF·지어낸 글만 — 결과에 글 0) · headless 한 번에 하나 · 사용자 Downloads 0(앵커 클릭 가로채기) · 앱 파일은 변이 뒤 `cmp` 로 원본과 같음.
- 스크래치 `b11-3/`: `common.mjs`(← `mkcommon.mjs` 가 b11-2 것에서 만듦) · `run-a/b/l/r/u.mjs` · `mut.mjs`·`bak/` · `x6.mjs`·`x6/`(앱 사본) · `reqsha.mjs`·`head.tar`·`head/` · `i18n-add*.mjs`·`i18n-ar-rlm.mjs`·`router-test.mjs`·`fixbom.mjs`·`probe-cite.mjs` · `full1.tap`·`full2.tap` · `shots/` · 프로필 `pA1`·`pB1`–`pB4`·`pL1`–`pL3`·`pR1`·`pU1`.
