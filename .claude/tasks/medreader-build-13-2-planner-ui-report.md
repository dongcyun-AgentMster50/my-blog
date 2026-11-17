# 13-2 Build 보고 — 학습 계획 화면 `#/planner` · 서재 "오늘" 줄 시험 줄 (+ 13-1R 고침)

- 지침: `.claude/tasks/medreader-build-13-2-planner-ui.md` · spec 17-12(2·5·6·7 "13-2"·8·9·12 · `[정정 — 13-1 Build]` ①–⑧) · review.md "13-1 Review" · 13-1 보고서 · crossstep-notes.
- 운영자 위임 권장안: 13-Q1(상한 올리기 권하지 않음 — `overCap` 은 사실 한 줄, 설정 무변) · 13-Q2(낭독 기록 기본 켬, 설정에서 끔).
- **커밋하지 않았다.** AI 호출 0. DB 3·`algoVersion`·판본 상수 무변. 13-1(미커밋) 위에서 이어 일함 — 되돌린 것 없음.

## 1. 먼저 고친 것 — 13-1 Review

| # | 전 | 후 | 근거 |
|---|---|---|---|
| 중간-1 300자 넘는 문장 조각마다 다시 셈 | 실제 `createSpeaker`, 710자 3조각 → 기록 2,146 / 실제 726(×2.96) | **726 / 726(×1.00)** — `readlog` 열쇠를 `docId\|page\|index` → 문서·쪽·첫 줄(`lineId`)·`src`(`unitKey`; lineId 없는 옛 꼴은 index). 조각들은 같은 첫 줄·같은 `src`. 둘째 조각에서 멈춘 뒤 재개해도 한 번. **speaker 무변**(이벤트 칸 안 더함 → 낭독 동작 시험 필요 없음, `cmp` 로 시작 때와 같음) | Review `r13-1/chk.mjs` 다시 돌림(읽기만) A · 새 시험 L10(실제 speaker, 3조각, 끝까지 + 멈춤/재개) |
| 낮음-2 속도 바꿈 앞 구간을 새 속도로 | B3 rateMs 40,000 / 맞는 값 30,000 | **30,000** — 구간 속도 `segRate`, `statechange{rate}` 에서 옛 속도로 먼저 settle | chk B3 · L11 |
| 낮음-3 자정 걸친 구간이 끝 날로 | B5 17일 20,000 · 18일 40,000 | **30,000 · 30,000** — settle 이 지역 자정(`nextMidnight`)에서 나눔 | chk B5 · L12 |
| 낮음-4 쪽 넘김 실패 뒤 같은 쪽 `pagedone` 두 번 → pages +2 | pages 2 | **1**(그날 `day\|docId\|page` 집합) — `@read` 는 원래 같음 | L13 |
| 낮음-5 controls 배선 정적 시험만 | L9 정규식 | **headless 동작**: 리더 들어오면 `isAttached` 참 · 낭독 중 숨김 → 쓰기 1→2(6-4 멈춤 `paused`) · 서재로 떠나면 거짓 · 계획 화면으로 떠나도 거짓 | h1 `wire` |
| 낮음-6 `planner.exams` docId 9c | (13-2 몫) | 범위에 `fileHash` 저장, 화면이 docId 로 못 찾으면 fileHash 로(9c 무변) | P5(실제 백업 내보내기→다른 id 기기로 가져오기) |
| 낮음-7 `[안 읽음으로]` 9c 합집합으로 되살아남 | (13-2 몫) | 읽은 쪽 고치기 칸에 고지 한 줄(`planner.fix.note`) | 화면 |

## 2. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/ui/planner.js` (새, 840줄) | 계획 화면. 순수 `normExam`·`examsOf`·`sortExams`·`nearestExam`·`resolveTargets`·`chapterRanges`·`planInputOf`·`examView`·`examFromForm`·`libraryExamLine` + 화면(목록·결과 카드·폼·삭제 확인·[정확히 세기]·[여기서 읽기]·[읽음으로]/[안 읽음으로]) · 진단 훅 `__medreader.planner` |
| `js/plan/readlog.js` | 13-1R #1–#4 (`unitKey`·`nextMidnight`·`segRate`·`donePages`) |
| `js/plan/planner.js` | `planFor` 에 `textToSpoken` 입력 · `calendarDays` · `progress.readPct`·`needCount` · 순수 `dayRead` (그 밖 무변 — 1 이면 전과 같음) |
| `js/config.js` | `PLAN.TEXT_TO_SPOKEN: 1`(실측 근거 주석) |
| `js/router.js` | `SCREENS` 에 `planner` · `#/planner` · `plannerHash()` |
| `js/main.js` | +4(import·init·leave·show) |
| `js/ui/library.js` | "오늘" 줄 시험 줄·입구(`renderTodayExam`) — 줄은 늘 보임, 복습 글·단추는 카드 있을 때만 |
| `js/ui/settings.js` | 낭독 묶음 끝 `reading.track` 스위치 한 줄 + 설명 |
| `index.html` | 계획 섹션 · "오늘" 줄 주석 · stamp(모듈 93 · CSS 4) |
| `css/screens.css` | 13-2 절(논리 속성만) |
| `js/i18n/{ar,en,fr,ko}.js` | 80키(ar·fr `[검토 — Nour·운영자]`) |
| `tests/planner-ui-13.test.mjs` (새, P1–P8) · `tests/readlog-13.test.mjs`(L10–L13 더함) · `tests/router.test.mjs`(planner 도달 줄 — NUL 바이트가 든 파일이라 바이트 그대로 한 곳만 바꾸는 스크립트로) | |
| `spec.md` | 17-12 5 끝 `[정정 2026-11-17 — 13-2 Build]` 한 줄 |

`speaker.js`·`controls.js`·`backup/*`·`ai/*`·`db.js`·`text/backup.js`·review.md·`dev/` 무변(`cmp`). `dev/measure-table-8i4.mjs` 손대지 않음.

## 3. 수용 기준 "13-2"

| 기준 | 결과 | 근거 |
|---|---|---|
| [D] 시험 하나(오늘+10일, 매일, 60분) · 범위 = 장 하나(`tocOf`) → 카드 숫자 = 같은 입력의 `planFor`(화면 글자에서 읽어 비교) | 통과 | h1 — 폼으로 만듦(칩 7개 기본·60분 기본·장 고르기). 화면 글자의 숫자: 날 10/10 · 필요 1분 · 하루 60분 · 진도 0%·0/3·2,650자 · 목표 60 = `recompute` 와 모두 같음(`data-v` 도). 합성 PDF 폴백 목차는 쪽마다 제목 하나라 개요 두 장(1–3·4)을 심음 |
| [D] 첫 두 쪽 끝까지 낭독 → 진도 두 쪽 · "오늘 낭독 n분" = 가짜 경과 ±1분 · 오늘 읽을 곳 셋째 쪽부터 | 통과 | 읽은 쪽 2(화면 2) · 오늘 낭독 화면 2분 / 가짜 경과 2.06분 · 기록 123,637ms · 오늘 읽을 곳 3–3 |
| [D] [여기서 읽기] → 그 쪽 · [읽음으로]/[안 읽음으로] → 진도 · [정확히 세기] → 센 쪽 늘어남, 원격 0 | 통과 | `#/reader/…/3` · 3쪽 읽음 → 3(`@read [[1,3]]`) → 안 읽음 → 2 · 검색 글자 지운 뒤 센 쪽 0 → 단추 보임 → 3/3, 단추 사라짐 · 그동안 POST 0 · 외부 0 |
| [D] 상한 3 · 1만 자당 1.7 · 하루 300분 → `overCap` 줄, `ai.dailyCap`·`readalong.mode` 무변 | 통과 | overCap 참·줄 보임 · 전후 DB·메모리 값 같음(3·speak) · P4 · 변이 M3 → P7 빨강 |
| [D] 시험일 어제 → past 한 줄 · 범위 다 읽음 → done · 사용량 행(34회·200,000자) → "1만 자당 1.7(실측)" | 통과 | past(필요 줄 없음) · done · 화면 "1만 자당 1.7회(실측)" · P3·P4 |
| [D] 서재 "오늘" 줄: 시험 둘 → 가까운 것 · 시험·카드 없음 → 링크만 | 통과 | near(3일) · [계획] 48px · 없음 → 단추 1개(링크)·시험 줄 없음·복습 글/단추 숨김 · 링크 → `#/planner` · P6 |
| [D] 360×740·412×915·915×412 × 4언어: 가로 넘침 0 · 단추 48px · 날짜 칸·요일 칩 RTL · 고지 · "점수"·"합격 가능성" 문구 0 | 통과 | h2 12칸: 넘침 0 · 48px 미만 0(button·input·select·summary) · ar 칩 `direction:rtl`·첫 칩이 오른쪽(거울), 다른 언어 ltr · 고지 12/12 · i18n grep(P7: 점수·합격·score·\bpass\b·réussite·نجاح·درجة·احتمال) 0. 날짜 칸 글자 방향은 브라우저 기본 ltr(배치는 UI 방향) — 실기기 줄로 |
| 변이(설계 셋 이상) | 11개 전부 빨강 → 복원 `cmp` 0 | 아래 6 |

## 4. `TEXT_TO_SPOKEN` 측정

스크래치 `b13-2/measure-t2s.mjs`(앱 추출 경로 그대로: `buildPageLayout`+이웃 → `toStored`→`fromStored`→`describePage` → `searchRecordOf().text` / `flowParasOf`→`buildUnits(sentence)` 첫 조각 `src`, 인용 뺌). CMDT 2026(1,967쪽) 앞뒤 5% 뺀 고른 간격 20쪽. 숫자만 기록(글 0):
- 낭독 83,841 ÷ 검색 86,759 = **0.966** · 인용 포함 0.989 · 쪽 중앙 0.988 · 범위 0.819–0.995(그림만 있는 쪽 하나 0/0).
- 차 3.4% < 설계 문턱 5% → **`PLAN.TEXT_TO_SPOKEN = 1`**(남은 시간 약 3% 크게 = 안전 쪽). `planFor({textToSpoken})` 로 받게 해 두었다(P8 이 0.9 로 시험).

## 5. 호출 0 근거

- `ui/planner.js` import 에 `ai/*` 0, `fetch`/XHR 0(P7 정적), 쓰는 설정 키는 `planner.exams` 하나, DB 직접 쓰기 0.
- node 시험 fetch 0. headless: 계획 화면 동작 내내 POST 0·외부 0. 낭독 흐름 POST 2개(`translate` — show 모드 동반 번역) **본문 해시가 HEAD 와 같음**(`ebebc395…`·`bfa9c1da…` — 13-1 Review 값과도 같음).

## 6. 시험 · 변이

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1,908/1,908 · 1,908/1,908**(13.1초 · 13.2초 — `b13-2/full1.tap`·`full2.tap`). stamp 다시(단독) → `--check` "그대로다(모듈 93개 · CSS 4개)" · `git diff --check` 0 · 새 파일 끝 공백 0.

| 변이 | 빨강 |
|---|---|
| M1 화면이 planFor 대신 자체 계산(하루 필요 분) | P3 |
| M2 복습 분을 빼지 않음 | P3 |
| M3 overCap 이 설정을 바꿈(`readalong.mode` off) | P7 |
| M4 범위 책 찾기 fileHash 갈래 지움 | P2 · P5 |
| M5 서재 시험 줄 — 가까운 것 대신 목록 첫 것 | P2 · P6 |
| M6 장 끝 — 깊이 무시 | P2 |
| M7 13-1R#1 열쇠를 index 로 | L10 |
| M8 13-1R#2 구간 속도 대신 지금 속도 | L11 |
| M9 13-1R#3 자정 나누기 지움 | L12 |
| M10 13-1R#4 같은 쪽 pages 다시 셈 | L13 |
| M11 planFor textToSpoken 무시 | P3 · P8 |

복원: 읽어 둔 바이트를 다시 씀 → `cmp` 세 파일(`ui/planner.js`·`plan/readlog.js`·`plan/planner.js`) 0(`b13-2/bak/cur/`).

## 7. headless (Edge · pipe · 새 프로필 · 가짜 키 · 흉내 Gemini OPTIONS 204+CORS · 흉내 음성 14자/초 + 가짜 시계 · 캐시 끔 · 서버 없음 · 합성 PDF `b11-2/syn.pdf` 읽기만 · 한 번에 하나)

- h1(`run-h1.mjs`, 프로필 p5): 위 3 의 [D] 1–6 + 13-1R #5 + 설정 스위치(켬 → 끔 false → 다시 켬). 콘솔 오류 0 · pageerror 0 · 외부 0. (p1–p3 은 스크립트 고치는 중 실행, p4 는 HEAD 쪽 `setup` 의 PDF 올리기 대기 60초에서 멈춤 — 13-1 Review 가 본 같은 하네스 문제, 앱 오류 0 — p5 로 다시 돌려 통과.)
- h2(`run-h2.mjs`, 프로필 pL1): 3 크기 × 4언어 12칸 위 표. 콘솔 0.
- 스크린샷 6장 `b13-2/shots/`: `ar-360-card.png`·`ar-360-form.png`·`ar-360-lib.png`·`ko-412-card.png`·`en-915-card.png`·`fr-412-form.png`.

## 8. 회귀

전체 시험에 12-3(서재 "오늘" 줄 `todayLine`·복습 화면 K1–K13) · 11-3 요약 화면·라우터 · 8c-2 사용량·설정 · 9c 백업(`planner.exams` 포함 L8·P5) · 낭독(13-1 기록 배선 L1–L13, speaker 시험 전부) 통과. headless 낭독 기록 숫자(123,637ms)·POST 본문이 13-1 Build/Review 값과 같음. 12-3 줄 동작 변경: 카드가 없어도 "오늘" 줄이 보인다(링크만) — 13-D14 그대로.

## 9. spec 정정

17-12 5 끝 `[정정 2026-11-17 — 13-2 Build]` ①–⑩: 13-1R 고침(speaker 무변) · 표본 비 0.966 → 1 · `planFor` 더한 것 · 장 범위 규칙(위 두 깊이, 같거나 얕은 다음 항목 − 1) · 범위 `fileHash` · 고지 문구에서 "점수"·"합격" 낱말 뺌("읽기 시간만 계획합니다 — 시험 결과를 예측하지 않습니다", 7 의 grep 과 맞춤) · "약 n만 자" → "약 n자" · 9c 고지 · "오늘" 줄 늘 보임 · 갈래 = 설정 전역 모드 · i18n 80키(요일은 `Intl`) · 날짜 칸 글자 방향.

## 10. 실기기 목록(끝 묶음 — 17-12 12 그대로 + 더함)

- 하루 낭독 뒤 "실측" 속도가 실제 느낌과 맞는가(`both`·`src`).
- 화면 잠금(9a) 중 낭독 시간·읽은 쪽이 쌓이는가.
- **Android 날짜 고르개가 아랍어 UI 에서 쓸 만한가**, 시험일이 시리아 날짜로 맞게 저장되는가(날짜 칸 글자는 ltr).
- CMDT 목차에서 장 고르기(412 세로) — 장·절 두 깊이 목록이 길 수 있음(절은 "— " 들여씀).
- 일주일 뒤 "하루 필요 분"과 실제 차이, 상한 줄이 쓸데없이 뜨지 않는가.
- (더함) 300자 넘는 문장이 많은 장을 낭독한 날의 실측 속도가 그럴듯한가(13-1R #1 고친 뒤).

## 11. 남은 문제

1. 갈래는 설정 전역 `readalong.mode` — 문서별 유효 모드(번역 대상 언어 = 원문 언어인 책 등)는 보지 않음(호출 어림이 위로 잡힘 = 안전 쪽).
2. `[정확히 세기]` 는 추출이 끝난(`pages` 있는) 쪽만 센다 — 추출 전 쪽은 평균·`readStats`·기본으로 남음.
3. 계획 화면을 열 때 범위 책들의 `searchText` 를 책 전체 훑음(CMDT 1,967쪽 약 10MB 읽기 — 실기기 체감 확인 필요, 느리면 키 범위로 좁히기).
4. 같은 첫 줄에서 시작하는 **글자까지 같은** 두 문장이 잇달아 오면 뒤 것을 세지 않음(`unitKey` — 드묾, 글자 적게 = 안전 쪽).
5. 그날 같은 쪽 `pagedone` 집합은 기록기 메모리(앱 다시 열면 비움) — 같은 날 다시 연 뒤 같은 쪽을 다시 끝까지 읽으면 pages +1(속도엔 무관).
6. 서재 "오늘" 줄 aria 이름(`aria-labelledby=libraryTodayText`)은 카드가 없으면 빈 글 — 다듬기 후보.
7. ar·fr 문구 `[검토 — Nour·운영자]`. ar 복수형(«10 يومًا» 꼴)은 8c-2 와 같은 숙제.

## 12. 막힌 명령

없음(거절된 명령 0). `rm` 0 · 커밋 0 · `git checkout/restore/stash` 0 · npm·다운로드 0 · 서버 0 · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · 원서 글 옮김 0(숫자만) · Downloads 목록 보지 않음.

스크래치 `b13-2/`: `measure-t2s.mjs`·`t2s.json` · `chk-after.json`(Review chk 다시 돌림) · `patch-router-test.mjs` · `i18n-keys.mjs` · `mkcommon.mjs`·`common.mjs` · `run-h1.mjs`·`h1.json` · `run-h2.mjs`·`h2.json` · `mut.mjs`·`mut.json` · `full0.tap`·`full1.tap`·`full2.tap` · `bak/orig`(시작 때 사본)·`bak/cur` · `shots/` · 프로필 `p2`–`p5`·`pL1`.
