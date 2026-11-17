# Build 보고서 — 12-1 SM-2 · 기억 카드 서비스 (화면 없음)

> 지침: `.claude/tasks/medreader-build-12-1-srs-service.md` · 설계: spec **17-11**(12-1 몫) · 17-4-1 · crossstep-notes "12"·"9c" 줄. 직전 배포 11-4 `32616d0`.
> 커밋하지 않았다. 스크래치: `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\b12-1\`.

## 1. 바꾼 파일

| 파일 | 무엇 |
|---|---|
| `js/srs/sm2.js` **새**(110줄, 순수 — import `config` 만) | `next`·`previewLabels`·`spanOf`·`isDue`·`isNew`·`normalizeSm2`·`startSm2` |
| `js/srs/cards.js` **새**(354줄, 서비스 — `config`·`db`·`hash`·`./sm2` 만) | `createCardStore({db, now})` → `saveSentence`·`get`·`remove`·`removeIfFresh`·`update`·`list`·`queue`·`review`·`fillBack`·`keptCount`·`readLog` · `sentenceIdOf`·`dueMsOf`·`timeMs`·`dayKeyOf`·`dayStartOf`·`trimLog`·`clampNewPerDay` · 기본 `cardStore` |
| `js/config.js` | `SRS` 상수(추가만) · `BACKUP.SETTINGS_KEYS` 에 `srs.newPerDay`·`srs.log` |
| `js/settings.js` | `DEFAULTS` `srs.newPerDay: 20` · `srs.log: Object.freeze({})` |
| `js/db.js` | `keepsOnDocDelete` — `kind === 'term' \|\| kind === 'sentence'`(1줄) + 주석 |
| `js/text/backup.js` | `mergeRecord` 카드 갈래만 — 문장 카드 `mergeSentence`(세 묶음 따로) · term 에 멈춤 묶음 · `cardTime` 없앰 |
| `js/backup/import.js` | `unionSetting` 에 `srs.log` → `unionLog`(날짜 합집합·칸별 큰 값·60날) · `SRS` import |
| `js/vocab/store.js` | `update` 가 `suspended` 를 바꾸면 `suspendedAt`(+1줄 + 주석) |
| `index.html` | stamp(판 번호 구간만 — 모듈 6줄 바뀜 + 새 모듈 2줄) |
| `tests/sm2-12.test.mjs` **새**(14) · `tests/cards-12.test.mjs` **새**(10) | 아래 2절 |
| `tests/vocab-8f` D1 · `summary-store-11b` D1 · `wordsheet-8f` W13 · `backup-9c` K10h · `backup-import-9c` I6 | 기대만 12-D8(문장 카드 남음)·병합 정정에 맞춤 — 7절 |
| `spec.md` | `[정정 2026-11-17 — 12-1 Build]` 4곳(3-2 · 9-3 두 줄 · 17-4-1 · 17-11 4) |

`ai/*`·`ui/*`·`review.md`·`dev/`·i18n 무변. 추적 안 된 `dev/measure-table-8i4.mjs` 손대지 않음. DB 3·`algoVersion`·모든 `*_PROMPT_VERSION` 무변. 화면 0.

## 2. 수용 기준 "12-1"

| 기준 | 결과 | 근거 |
|---|---|---|
| `sm2.next` 표 S1–S10 · dueAt = 0시 + interval×하루, again = now + 10분 · 순수 grep | ○ | S1–S10 · N1 · N4(주석까지 `Date`·`document`·`window` 0, import `config` 만) |
| `previewLabels` 네 칸 = `next()` · 분·일·개월 단위 | ○ | N2(시간·년 포함) |
| `saveSentence` 두 번 → 한 장 · 대상 언어 다르면 둘 · 앞면만 → back 채움·updatedAt 오름 · id 경계 "a b"+"c" ≠ "a"+"b c" | ○ | C1(동시 두 번도 한 장) |
| `review`: 복습 필드만, `updatedAt` 그대로, 번역·메모 그대로 · `srs.log[오늘]` n·ms·new | ○ | C2(단어 카드도 · 60날 · ms 상한) |
| `queue`: due 순 → 새 카드 순 · 오늘 18 이면 20 중 2 · 멈춤·번역 빈 term(noTr) 빠짐 · noBack · ISO dueAt | ○ | C3(다음 날 셈 0 · kinds·docId · 상한 0–100) |
| `fillBack`: 주입 조회로 채움·저장 / 없으면 그대로 · 조회 밖 호출 0 | ○ | C4(가짜 `fetch` 호출 0 — 전 시험 파일에서) |
| `deleteDocument` 뒤 term·sentence 남음, kind 없음 지워짐 · `keptCount` | ○ | C5 |
| 9c 병합: 기기 reviewedAt 늦으면 기기 · 파일이 내용만 늦으면 내용은 파일·복습은 늦은 쪽 · CSV 가져오기로 번역 고쳐도 sm2·dueAt 그대로 | ○ | C6(순수)·C6b(종단 내보내기→가져오기 두 번 = 한 번)·C7 · K10h · I6 |
| 8f `changedSince` 가 복습 뒤 늘지 않음 | ○ | C7(복습 두 번 + 멈춤/다시 켬 뒤 0, 번역 고침 뒤 1) |
| 공통: 전체 시험 · `--check` 0 · splitSentences 3파일(HEAD 와 같음) · `innerHTML` 새 0 · 콘솔 오류 0 · 무료 티어 숫자 0 · 새 원격 요청 0 · 진짜 키 0 | ○ | 5절 · headless |

## 3. SM-2 표 S1–S10 (규칙으로 다시 계산 — 설계 표와 모두 같음)

| # | 입력 {ease, interval, reps} | 단추 | interval · reps · ease | dueAt |
|---|---|---|---|---|
| S1 | 2.5, 0, 0 | good | 1 · 1 · 2.50 | 내일 0시 |
| S2 | 2.5, 1, 1 | good | 6 · 2 · 2.50 | 0시 + 6일 |
| S3 | 2.5, 6, 2 | good | 15 · 3 · 2.50 | 0시 + 15일 |
| S4 | 2.5, 6, 2 | hard | 7 · 3 · 2.35 | 0시 + 7일 |
| S5 | 2.5, 6, 2 | easy | 21 · 3 · 2.65 (round(6×2.65×1.3=20.67)) | 0시 + 21일 |
| S6 | 2.5, 15, 3 | again | 0 · 0 · 2.30, lapses+1 | now + 10분 |
| S7 | 1.3, 15, 3 | again | 0 · 0 · 1.30(바닥) | now + 10분 |
| S8 | 2.5, 300, 6 | good | 365(750→상한) · 7 · 2.50 | 0시 + 365일 |
| S9 | 2.5, 0, 0 | easy | 4 · 1 · 2.65 | 0시 + 4일 |
| S10 | 2.5, 0, 0 | hard | 1 · 1 · 2.35 | 내일 0시 |

ease 는 소수 둘째 자리로 맞춘 수(시험이 `=== 2.35` 까지 본다).

## 4. 9c 병합 고침 (9c1R #8 · 8f1R)

- **문장 카드**: 레코드 통째(`max(updatedAt, reviewedAt)`) → **세 묶음 따로** 늦은 쪽(같으면 기기, 결과 `patch`): 내용 ← `updatedAt` · 복습 상태(`sm2`·`dueAt`·`reviewedAt`·`introducedAt`) ← `reviewedAt` · 멈춤(`suspended`·`suspendedAt`) ← `suspendedAt`.
- **멈춤 시각**: `suspended` 토글은 `updatedAt` 을 올리지 않고 **`suspendedAt`** 을 쓴다(카드 서비스 `update` · 8f `vocab/store.js` `update` 둘 다). `reviewedAt` 을 쓰지 않은 까닭 — 새 카드를 멈췄다 켜면 "새 카드"가 아니게 된다. term 도 멈춤 묶음을 `suspendedAt` 늦은 쪽(없으면 기기 — 9c-1 그대로).
- **설정**: `srs.newPerDay`·`srs.log` 담음. `srs.log` 는 파일 값으로 덮지 않고 **날짜 합집합·같은 날 칸마다 큰 값·최근 60날**(`unionSetting`) — 이 기기에만 있던 날의 기록이 사라지지 않게. 멱등.
- 8f `applyImport` 는 이미 복습 필드 보존(8f-1·8f-3b) → 설계 "+3줄" 불필요(C7 확인).
- 멱등 시험 K11(9c-1)·I5(9c-2) 그대로 통과.

## 5. 시험·점검

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1,847/1,847 통과 · 1,847/1,847 통과**(`b12-1/full1.txt`·`full2.txt`). 새 24개(sm2 14 · cards 10).
- `dev/stamp-importmap.mjs` 다시 → `--check` "그대로다(모듈 88 · CSS 4)" · `git diff --check` 0 · 새 파일 4개 `--no-index --check` 0.
- 16-A: `grep -E "\b(document|window|fetch|indexedDB|pdfjsLib|Date)\b" js/srs/sm2.js` 0줄.
- `grep -rln splitSentences js/` = `text/cite.js`·`text/segment.js`·`tts/text.js`(HEAD 와 같음).
- 회귀: 8f-1·8f-3 단어장(vocab-8f·vocab-8f3b·vocab-ui-8f·wordsheet-8f) · 9c-1·9c-2·9c-3 백업(backup-9c·backup-import-9c·needpdf-9c3) · 11-1 연쇄 삭제(summary-store-11b D1 — annotations·term 남음, term 캐시 지움) 전부 통과. **`ai/*` 무변**(git diff 에 없음) → 번역·단어·요약·설명 요청 본문 바이트 HEAD 와 같음(term-8f B1 sha·pipeline·prompts·summary·explain 시험 그대로 통과).

## 6. 변이 (전부 빨강 → 복원: `b12-1/bak/` 사본을 읽어 쓰기 + `cmp` 0)

| # | 변이 | 빨강 | 복원 cmp |
|---|---|---|---|
| M1 | easy 보너스 지우기(×1.3 · ease +0.15) | S5 · S9 · N2 · C2 | 같음 |
| M2 | ease 바닥 지우기 | S7 · N1 | 같음 |
| M3 | `review` 가 `updatedAt` 을 올림 | C2 · C6 · C6b · **C7(changedSince 1 ≠ 0)** | 같음 |
| M4 | id 를 uuid 꼴로 | C1(중복) · C6b | 같음 |
| M5 | 연쇄 삭제 예외에서 `sentence` 빼기 | C5 · vocab-8f D1 · summary-store D1 · wordsheet W13 | 같음 |
| M6 | 새 카드 상한이 `srs.log` 를 안 봄 | C3 | 같음 |
| M7(더) | 문장 카드 병합을 9c-1 꼴(통째)로 | K10h · I6 · C6 · C6b | 같음 |
| M8(더) | `fillBack` 이 저장하지 않음 | C4 | 같음 |
| M9(더) | 멈춤이 `suspendedAt` 을 안 남김 | C6 | 같음 |
| M10(더) | `srs.log` 를 파일 값으로 덮음 | C6b · C9 | 같음 |

## 7. 기존 시험 기대를 바꾼 곳(의도 — 설계 결정 반영)

- `vocab-8f` D1 · `summary-store-11b` D1 · `wordsheet-8f` W13: "문장 카드는 지워진다" → **남는다**(12-D8). kind 없는 옛 꼴은 여전히 지움을 단정.
- `backup-9c` K10h: 문장 카드 `put`/`keep` → 묶음별 `patch`(기기 복습이 늦을 때 내용만 파일·복습은 기기 / 파일 복습이 늦을 때 복습만 파일).
- `backup-import-9c` I6: 문장 카드 "기기 복습이 더 늦다 → back 기기" → 내용(updatedAt 늦은 파일 `b`)·복습(reviewedAt 늦은 기기) 따로 — 바로 9c1R #8 이 지적한 동작.

## 8. headless 한 번 (`b12-1/run-h.mjs` → `h1.json`, 18초)

Edge 412×915 · 새 프로필 `b12-1/p1` · pipe · 가짜 키 · 흉내 Gemini · 캐시 끔 · **서버 없음**(11-1 하네스처럼 가로채 내줌: `127.0.0.1:8000` = 작업 트리, `127.0.0.2:8000` = HEAD `git show`).

- 두 출처 같은 흐름(합성 PDF `b9c2/syn.pdf`): 앱 뜸 · 리더 열림 · 단어장 화면에 심은 단어 보임(둘 다 1) · 9c 설정 카드 [내보내기] → gzip 파일(키 글자 0) · 서재 삭제(확인 대화 2줄 — 머리 + "단어장 1" 줄, 둘 같음) → **term 남음(둘 다) · kind 없는 카드 지워짐(둘 다) · 문장 카드: HEAD 지워짐 / 작업 트리 남음**(12-D8 — 의도한 차이만).
- 작업 트리 카드 서비스(모듈 import, 실제 IndexedDB): `saveSentence` 새로 → 다시 = 같은 id(`sc:s256…`) · `fillBack`(주입 조회) 채움 · `queue` 새 3(심은 문장·새 카드·단어) noBack 1 → `review(good, 3000ms)` reps 1·interval 1·`updatedAt` 그대로·내일 · `srs.log` 오늘 `{n:1, ms:3000, new:1}` DB 에 있음 · 단어 `review(easy)` interval 4·번역·`updatedAt` 그대로 · `settings.get('srs.newPerDay')` 20 · 내보내기에 문장 카드 2·`srs.log` 줄.
- 콘솔 오류 0 · 페이지 오류 0 · **AI POST 0** · 외부 요청 0 · 없는 파일 0.

## 9. spec 정정 (`[정정 2026-11-17 — 12-1 Build]`, 그 자리만 Edit)

1. **3-2**: 실제 import — `srs/sm2` → `config` 만 · `srs/cards` → `config`·`db`·`hash`·`./sm2`(`settings.js` 없이 `srs.log` 직접).
2. **9-3** 두 줄: `srs.newPerDay` 기본 20·9c 담음 · `srs.log` 기본 얼린 `{}`·`cards.review` 가 DB 에 직접·읽기는 `cards.readLog`·가져오면 날짜별 큰 값.
3. **17-4-1**: 문장 카드 병합 세 묶음 · term 멈춤 묶음 · 허용 목록 · `srs.log` 합치기.
4. **17-11 4**: ① S 표 확정·ease 둘째 자리·`previewLabels` 꼴·`isDue` 숫자 아님 = 오늘·서머타임 틈 ② 멈춤 = `suspendedAt`(updatedAt 아님)·단어는 멈춤만 ③ `srs.log` 쓰기·읽기·날 키·60날·ms 상한·`queue` 기본값 ④ 그 밖 공개 함수 ⑤ `applyImport` 이미 보존(+3 불필요) ⑥ 병합 위치(`text/backup.js`) ⑦ 기존 시험 다섯 기대 변경.

## 10. 남은 문제 · 넘길 것

1. **`settings.js` 메모리 맵의 `srs.log` 는 옛값**이다(카드 서비스가 DB 에 직접 쓴다 — 설계 "한 트랜잭션" 그대로). 12-3·13-2 는 `cards.readLog()` 를 써야 한다(spec 9-3·17-11 정정에 적음). 설정 화면이 `srs.log` 를 쓰는 길은 없다.
2. 12-2 몫: 서재 삭제 확인에 "기억 카드 m" 줄(`deleteKeepCounts`·`deleteKeepLines` — `cardStore.keptCount`). 지금은 문장 카드가 조용히 남는다(만드는 화면이 아직 없어 실제로는 0장).
3. `dueAt = dayStartMs + interval × 24h` 는 서머타임이 바뀌는 날을 끼면 ±1시간(그날 23시/1시) — 시리아는 서머타임 없음. 바꾸려면 화면이 "n일 뒤 0시"를 주입해야 한다(순수 쪽은 시계를 모름). 기록만.
4. `srs.log` 기본값을 얼린 `{}` 로 둠 — `settings.get('srs.log')` 를 받아 고치는 코드는 예외가 난다(지금 그런 코드 없음, 쓰는 쪽은 `cards.js` 가 사본을 만든다).
5. `isDue` 는 `dueAt` 을 못 읽으면 오늘 복습으로 본다(잃지 않게) — 손댄 백업의 이상한 값이면 매일 뜰 수 있다(한 번 매기면 숫자가 된다).
6. term 의 `kind` 인덱스가 없어 `queue`·`list` 는 전체 훑기(12-D10 그대로) — 수천 장 실측은 12-3 headless 에서.

## 11. 막힌 명령 · 규칙

- 막힌(거절된) 명령 없음.
- 명령은 한 호출에 한 가지(묶음 0) · 서버 띄우기 0 · 프로세스 조회 0 · 진짜 키 0 · 설치·다운로드 0 · 커밋 0 · 원서 문장 인용 0(합성 PDF·지어낸 문장만).
