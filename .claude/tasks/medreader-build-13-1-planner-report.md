# 13-1 Build 보고 — 학습 계획: 낭독 기록 · 읽은 쪽 · 계획 계산 (화면 없음)

- 지침: `.claude/tasks/medreader-build-13-1-planner.md` · 설계 spec 17-12(1·2·3·4·6 13-1 행·7 "13-1"·8·9·10) · 운영자 위임 권장안(13-Q1 상한 올리기 권하지 않음 · 13-Q2 낭독 기록 기기 안·기본 켬).
- 직전 배포 12-3 `9da0fd0`. **커밋하지 않았다.** AI 호출 0. DB 3·`algoVersion`·판본 상수 무변. 화면 없음(13-2).

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/plan/planner.js` (새, 428줄) | 순수(`config` 만, `Date`·`document`·`window` 0). `dayNum`·`dayKey`·`weekdayOf`·`studyDays` · `rangesUnion/Has/Add/Remove/Count` · `remainingOf` · `todayRange` · `bucketFor`·`cleanLog`·`logAdd`·`logTrim` · `speedOf` · `callsRateOf` · `reviewMinutes` · `planFor` |
| `js/plan/readlog.js` (새, 298줄) | 서비스(`config`·`db`·`./planner` 만). `createReadLog` · 기본 `readLogStore` · `attach/detach/onHidden/flush/whenWritten/readLog/readRanges/markRead/isAttached/stats` · `dayKeyOf` |
| `js/tts/speaker.js` | `advancePage(depth, auto)` + `emit('pagedone', {page})`(auto·hop 0 일 때) · `speakAt` 쪽 끝만 `auto` · `pastEnd` 시작은 `advancePage(0)` 그대로(pagedone 없음) |
| `js/ui/controls.js` | `readLogStore` import · 쪽이 처음 그려질 때 `attach`(track = `settings.get('reading.track')`) · `leaveControls` 의 `speaker.stop()` 뒤 `detach` · 숨김 `onHidden` · `readBucket()`(유효 모드·speakSource, 번역문 음성 꺼짐이면 src) |
| `js/config.js` | `PLAN` 상수 · `BACKUP.SETTINGS_KEYS` 에 `reading.track`·`reading.log`·`planner.exams` |
| `js/settings.js` | DEFAULTS `reading.track: true` · `reading.log: Object.freeze({})` · `planner.exams: []` |
| `js/backup/import.js` | `unionSetting('reading.log')` → `unionReadingLog`(날짜 합집합·갈래·칸별 큰 값·60일) · `PLAN` import |
| `index.html` | stamp(모듈 92개) |
| `tests/planner-13.test.mjs` (새, N1–N8) · `tests/readlog-13.test.mjs` (새, L1–L9) | |
| `spec.md` | 17-12 4 끝 `[정정 2026-11-17 — 13-1 Build]` 한 줄 · 3-2 `plan/*` 한 줄 · 9-3 세 줄 끝에 정정 |

`ai/*`·다른 `ui/*`·`db.js`·review.md·`dev/` 무변. 추적 안 된 `dev/measure-table-8i4.mjs` 손대지 않음.

## 2. 수용 기준 "13-1"

| 기준 | 결과 | 근거 |
|---|---|---|
| `[N]` planner 시험 표 전부 · 예시 재현 · 순수 grep | 통과 | N1(윤년 2월·시험일 제외·금 빼기·reserve 2) · N2(겹침 합치기) · N3(글자 없는 쪽 평균) · N4(short·needMinPerDay null·past·done·overCap 0.8 경계·callsPer10k 0·예시) · N8(grep 0·import config 만) |
| `[N]` readlog: 60초·단위 넷 → both.ms 60000·chars 400 · paused 0 · 반복 0 · 사이 5분 → 120초 · 같은 index 글자 0 · 쓰기 횟수 | 통과 | L1 · L2 · L3(문장 열 개 50초 쓰기 0 → 60초 1 → 쪽 넘김 대기 0 → 멈춤 2 → 빈 숨김 0 → 숨김 3 → 떠남 4) |
| `[N]` pagedone: 자동 넘김 한 번(hop 0) · 빈 쪽 없음 · 마지막 쪽 한 번 · [다음]·stop 없음 | 통과 | L4(실제 `createSpeaker` — +멈춤/재개·문장 반복 2회와 겹쳐도 한 번, 인용 줄 탭으로 끝을 지난 시작은 없음) |
| `[N]` 읽은 쪽(fake-idb) — 만들기 · [[3,5]]+6 → [[3,6]] · 4 안 읽음 → [[3,3],[5,6]] · 퀴즈 progress 무변 · deleteDocument 뒤 없음 | 통과 | L5(+문서 없으면 안 씀·같으면 안 씀) |
| `[N]` `reading.track:false` → 기록 0, markRead 됨 | 통과 | L6 |
| `[N]` 속도: 29분 → 추정 · 31분 → 실측 · 평균 1.0·지금 1.25 → ×1.25 · 갈래 다르면 그 갈래 기본 | 통과 | N5(+14일 경계·두 날 합) |
| 변이 여섯 이상 | 9개 전부 빨강 → 복원 `cmp` 0 | 아래 6 |

## 3. 계획 계산 예시 재현 (17-12 2)

`planFor({today:'2026-11-17', exam:'2026-11-27', 매일, minutesPerDay:49, speed:370(both 기본), callsPer10k:1.7, cap:100, remaining:180000})`
→ `days 10` · `needMinPerDay 49`(180000÷370÷10 = 48.6 → 올림) · `calls 31`(30.6 → 올림) · 약 8.1시간 · `needDays 10` · `finishDay '2026-11-26'`(시험 전날) · `slackDays 0` → **`status 'tight'`** · `overCap false`.
하루 49분이면 `callsPerDay` = 18,130 × 1.7 ÷ 10000 = 3.08 → **4**(위로 잡음 — 설계 예시의 "하루 3회"는 반올림, spec 정정 ⑥).
부동소수: 100000 × 1.7 ÷ 10000 → 17(18 아님 — `up()`).

## 4. 낭독 기록 숫자 (headless — 흉내 음성 14자/초, 가짜 시계)

합성 PDF(4쪽) 1쪽부터 [▶] → 셋째 쪽 첫 문장 시작에서 멈춤:
- `reading.log.days['2026-11-17'].src` = `{ms 123,635, chars 1,753, rateMs 123,635}` · `pages 2` (show 모드 → `src` 갈래).
- 흉내 음성의 가짜 경과(1·2쪽 발화 글자 ÷ 14자/초) 123,571 ms → 차 **+64 ms**(±1분 안). 글자 1,753 = 발화 25개 글자 합(셋째 쪽 첫 문장 포함 — linechange 때 셈).
- `@read` `[[1,2]]`·`pages 2`·`updatedAt` 숫자 · `progress` 레코드는 `@read` 하나뿐 · `pagesDone 2` · reading.log 쓰기 1회(멈춤) · `markWrites 2`.

## 5. 9c 처리

- `progress @read` 병합: 9c-1 이 이미 설계 4 꼴(`ranges` 합집합·`pages` 다시 셈·`updatedAt` 큰 값 — `text/backup.js` `mergeProgress`)으로 넣어 **고치지 않음**(확인만).
- 허용 목록: `reading.track`·`reading.log`·`planner.exams` 담음(K2 "DEFAULTS 모든 키 분류" 통과).
- `reading.log` 는 `srs.log` 처럼 서비스가 DB 에 직접 쓰므로 가져오기에서 덮지 않고 `unionReadingLog`(날짜·갈래·칸별 큰 값, 60일). `reading.track`·`planner.exams` 는 파일 값으로 덮음.
- 종단(L8): 기기 A 백업 → 같은 PDF 다른 id 기기 B: `@read` `[[1,3]]`∪`[[7,9]]` = `[[1,3],[7,9]]`·pages 6 · reading.log 합침 · 세 키 · **같은 파일 두 번 = 한 번**.

## 6. 시험 · 변이

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1896/1896 통과 · 1896/1896 통과**(실패 0). 회귀 포함: speaker 시험 전부·쪽 넘김·반복·hidden 멈춤(6-4)·9a·9b·11-2/11-4 재개·12-2 띠·퀴즈 progress·9c 병합·멱등·11-1/12-1 삭제 연쇄.
- stamp 다시(단독) → `--check` "그대로다" · `git diff --check` 0 · 새 파일 끝 공백 0 · `grep -c "Date\|document\|window" js/plan/planner.js` = 0.

| 변이 | 결과 |
|---|---|
| M1 pagedone 를 빈 쪽 넘김에서도(`hop === 0` 지움) | 빨강 L4·L9 |
| M2 반복 쉼 지우기 | 빨강 L2 |
| M3 시험일 당일 포함 | 빨강 N1·N4 |
| M4 쉬는 요일 무시 | 빨강 N1·N4 |
| M5 `MAX_GAP_MS` 자르기 지우기 | 빨강 L2 |
| M6 callsPer10k 실측 문턱 무시(`CALLS_MIN_CHARS` 0) | 빨강 N6 |
| M7(더함) 사용자 [다음]·끝 지난 시작에서도 pagedone(`auto` 검사 지움) | 빨강 L4·L9 |
| M8(더함) `reading.track` 무시 | 빨강 L6 |
| M9(더함) 같은 index 재시작도 글자 셈 | 빨강 L2 |

복원: 변이 스크립트가 읽어 둔 바이트를 그대로 다시 씀 → `cmp` 네 파일(speaker·readlog·planner·config) 모두 `b13-1/bak/cur/` 와 같음.

## 7. headless (한 번 — Edge·pipe·새 프로필 `b13-1/p1`·가짜 키·흉내 Gemini·흉내 음성·캐시 끔·서버 없음·합성 PDF)

같은 브라우저에서 HEAD(127.0.0.2) → 작업 트리(127.0.0.1) 차례로 같은 흐름.
- 작업 트리: 위 4 숫자 · **POST 2개 모두 `translate`(낭독 동반 번역)** · **요청 본문 해시가 HEAD 와 같음**(`postBodiesSameAsHead: true`) · 외부 요청 0 · pageErrors 0 · 작업 트리 단계 콘솔 오류 0.
- 콘솔 오류 1건은 HEAD 단계의 내 점검 코드가 HEAD 에 없는 `js/plan/readlog.js` 를 동적 import 하다 낸 404(`head-check` 단계 — 앱 아님).
- 스크립트: `b13-1/mkcommon.mjs`(b12-3/common.mjs 읽기만 → 흉내 음성 끝마다 가짜 시계를 글자 ÷ 14자/초로) · `b13-1/run-h.mjs` · 결과 `b13-1/h1.json`.

## 8. 남은 문제 · 넘길 것

1. **표본 20쪽 "낭독 글자 ÷ 검색 글자" 비(17-12 2 → `PLAN.TEXT_TO_SPOKEN`) 를 재지 않았다** — 책 PDF·pdf.js 경로가 지침에 없어 찾지 않음. 계수 없음(남은 시간이 조금 크게 나옴 = 설계의 안전 쪽 그대로). 다음 Plan/측정 단계에서.
2. **`planner.exams` 의 `targets[].docId` 는 9c 가져오기에서 옮겨지지 않는다**(설정 값은 `remapRecord` 대상 아님) — 13-2 가 `fileHash` 를 함께 저장하거나 가져오기가 옮길 것.
3. `[안 읽음으로]` 는 9c `@read` 합집합 때문에 다른 기기 백업을 가져오면 되돌아온다(설계 결과 — 지움 표시가 필요하면 13-2·다듬기에서).
4. reading.log 같은 날 같은 갈래는 9c 에서 칸별 **큰 값**(합하지 않음 — 멱등 우선): 두 기기가 같은 날 따로 읽었으면 큰 쪽 하나만 남는다(속도 실측엔 영향 작음).
5. 문장 반복 'unit' 모드는 횟수를 다 채워도 모드가 남아 있어(speaker 그대로) 반복을 켠 동안 낭독 전체가 기록에서 빠진다(설계 "반복 켜짐 동안 0" 그대로).
6. 가짜 시계가 소수 ms 를 내면 기록 ms 도 소수(실기기 `Date.now` 는 정수 — 영향 없음).
7. 13-2 가 쓸 것: `readLogStore.readLog()`·`readRanges(docId)`·`markRead(docId,a,b,on)` · `speedOf(log, {today, bucket, rate})` · `callsRateOf(callsPer10k(rows, {minChars: PLAN.CALLS_MIN_CHARS}), bucket)` · `reviewMinutes(queue().counts…, cards.readLog(), today)` · `planFor` · `todayRange`. 서재 "오늘" 줄 자리 `#libraryTodayExtra` 확인만(무변). 설정 낭독 묶음의 `reading.track` 스위치(13-Q2)도 화면이라 13-2 몫 — 지금은 키·기본값만.
8. 실기기(끝 묶음): 화면 잠금 중 기록(9a) · 하루 뒤 실측 속도 체감 — 17-12 12 그대로.

## 9. 막힌 명령

없음. (첫 전체 시험을 폴더 경로로 줬다가 "모듈 없음"으로 실패 → 지침의 글로브 꼴로 다시 — 묶지 않은 단독 명령.)
