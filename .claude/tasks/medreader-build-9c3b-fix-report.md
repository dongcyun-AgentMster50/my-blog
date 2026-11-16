# Build 보고 — 9c-3b: 9c-3 Review 지적 고치기 (2026-11-17)

> Build 서브에이전트. 지침 `.claude/tasks/medreader-build-9c3b-fix.md`, 근거 `apps/medreader/review.md` "9c-3 Review" 절(9c3R-0~10), 앞 지침 `medreader-build-9c3-needpdf.md` 의 규칙·금지 그대로. **커밋 0.** 스크래치 `b9c3b/`(Review 의 `r9c3/` 는 읽기만 — `fix9c2.mjs`·`future-cmp.mjs`·`common.mjs` 를 읽어 실행/복사).

## 1. 고친 것 — 전/후

| # | 지적 | 전 | 후 |
|---|---|---|---|
| 1 | **중간-1** 미래 시각 자르기가 멱등을 깸 (9c3R #1) | `cleanRecord` 가 모든 파일 문서의 미래 `lastOpenedAt`·`addedAt` 을 그때의 `nowMs` 로 자름 → 기존 문서와 비교하면 늘 "파일이 더 새로움" → 다른 `now` 로 다시 가져올 때마다 patch, 그사이 이 기기에서 더 읽은 진도가 파일 쪽으로 되돌아감 | `cleanRecord` 는 꼴만(`lastPage`/`pageCount`). 새 순수 함수 `docTimesFor(v, nowMs, isNew)`(export): **새 문서**만 지금으로 자르고, **기존 문서**(같은 id·같은 `fileHash` 두 갈래)는 파일 `lastOpenedAt` 이 미래면 `lastOpenedAt`·`lastPage`·`lastLineId` 를 빼고 병합 → 읽던 자리는 **기기 값 유지**(단어장 8f-3b "미래 시각 = 충돌 → 기기"와 같은 결). 언어·`domain`·`readStats`·`outline` 등 나머지 병합은 그대로. `text/backup.js`(`mergeDoc`) 무변 |
| 2 | 낮음-2 리더·퀴즈 입구가 `from` 을 `await db.get` 뒤에 잡음 (9c3R #2) | `const from = location.hash` 가 `db.get` 뒤 → 그 사이 다른 화면으로 가면 서재로 끌려가고 `replace` 가 그 화면 히스토리 항목을 덮음 | `reader.js` `showReader`·`quiz.js` `showQuiz` 모두 함수 첫 `await` **앞**에서 잡음(검색과 같게). 라우터가 `hashchange` 에서 동기로 부르므로 잡은 값 = 들어온 주소. `quiz.js` 는 작업본 CRLF 그대로(node 스크립트로 바꿈, 1068줄 모두 CRLF·섞임 0) |
| 3 | 낮음-3 시험 틈 — 변이 R3 가 repo 시험에서 살아남음 (9c3R #3) | N5 가 `goNeedPdf` 의 `replace` 를 보지 않음 | N5 에 `goNeedPdf` 본문 `else replace(libraryHash());` 단정 한 줄 + (2 를 지키게) 리더·퀴즈 입구에서 `const from = location.hash;` 가 첫 `await ` 앞인지 단정 |

시험(`tests/backup-import-9c.test.mjs` I18): `cleanRecord` 는 시각을 그대로 둠 · `docTimesFor` 새 문서 → 지금 · 기존 문서 → 읽던 자리 세 필드 빠짐(`lang` 은 남음) · 맞는 레코드는 같은 객체 · 실제 가져오기에서 **다른 now(+5000) 로 두 번 = 한 번**(전 스토어 스냅숏 같음, 문서 `keep 2 · patch 0`) · **그사이 기기에서 p.10 까지 읽은 뒤 다시 가져와도 p.10**.

## 2. Review 스크립트 다시 (`r9c3/` 읽기만 실행, 출력은 `b9c3b/before-*`·`after-*`)

| 항목 | 전 | 후 |
|---|---|---|
| `fix9c2` i1 빈 기기에 미래 시각 파일 | 1000(지금) | 1000(지금) — 새 문서 자르기 유지 |
| i2 같은 파일·같은 now 두 번 | keep 1 | keep 1 |
| **i3 같은 파일·다른 now** | same **false** · patch 1 | same **true** · keep 1 · `lastOpenedAt` 1000 그대로 |
| **i4 그사이 기기 p.10 → 다시 가져오기** | **p.3** | **p.10** |
| `fix9c2` 나머지(u1–u6·s1–s3·d2·c1·i5–i8) | 초록 | 초록(fails 0) |
| `fix9c2` d1 `lastOpenedAt === now` | true | false — **의도된 변화**(자르기가 `cleanRecord` 에서 `docTimesFor` 새 문서 갈래로 옮김; i1 이 그 자리를 확인) |
| `future-cmp` cur (head 는 둘 다 `2592000000·p3·patch·keep`) | `afterFirst 1000 · page 3 · docOps2 patch · docOps3 patch` | `afterFirst 1000 · page 10 · docOps2 keep · docOps3 keep` |

→ 미래 시각 파일 두 번 = 한 번, 진도 되돌아감 0(HEAD 보다도 나음 — HEAD 는 첫 다시 가져오기에서 p.3).
경계(기록): 파일 시각이 "첫 가져오기 지금 < 파일 시각 < 둘째 가져오기 지금"처럼 아주 조금만 미래였으면, 둘째에는 이미 과거라 보통 비교(늦은 쪽)로 한 번 patch 되고 셋째부터 keep — HEAD 와 같은 수렴, 문제 아님.

## 3. 변이 (`b9c3b/mut.mjs` — 고친 뒤 바이트를 실행 때 읽어 `b9c3b/bak/cur-*` 에 씀 → 정확히 1곳 바꿈 → `backup-import-9c`·`needpdf-9c3` → finally 그 바이트로 되씀 → 바이트 비교, 끝에 `cmp` 따로)

| # | 변이 | 결과 | 걸린 단정 |
|---|---|---|---|
| M1 | **1 되돌림** — 기존 문서도 `docTimesFor` 안 거침(`const old = v`) | **빨강** | I18 "다른 now 로 두 번 = 한 번" |
| M2 | 1 새 문서 자르기 지움 | **빨강** | I18 "새 문서 — 미래 시각은 지금으로" |
| M3 | **2 `reader.js` `from` 을 await 뒤로** | **빨강** | N5 "reader.js — from 이 첫 await 앞" |
| M4 | 2 `quiz.js` `from` 을 await 뒤로(CRLF) | **빨강** | N5 "quiz.js — from 이 첫 await 앞" |
| R3 | `goNeedPdf` 가 `replace` 대신 `go`(Review R3) — `library.js` 는 수정 범위 밖이라 **파일 무변**, N5 와 같은 slice·정규식을 바뀐 글자에 대 봄(원본 1곳·원본 통과) | **빨강**(단정 불일치) | N5 `else replace(libraryHash());` |

복원: 4개 모두 `restored: true` · `cmp` import.js·reader.js·quiz.js ↔ `bak/cur-*` 0 · M1/M2 백업끼리 `cmp` 0.
(고치기 전 원본은 `b9c3b/bak/` 에 `js__backup__import.js` 등 7개 — `backup.mjs`.)

## 4. 검사

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs`: **1회차 1727/1727(10.4초) · 2회차 1727/1727(10.4초)** (`b9c3b/full1.txt`·`full2.txt`; 단정은 기존 시험 안에 더해 개수 그대로).
- `dev/stamp-importmap.mjs` 다시 → `index.html` 3줄만(`backup/import.js`·`ui/quiz.js`·`ui/reader.js` 의 `?v=`) · `--check` "그대로다 (모듈 79개 · CSS 4개)".
- `git diff --check` 오류 0(경고 하나 — `quiz.js` 작업본 CRLF, 앞 단계와 같음).
- 줄 끝(`b9c3b/eol.mjs`): `quiz.js` 1068줄 모두 CRLF·LF만 0·CR만 0(섞임 0) · 나머지 6파일 LF만.
- `git status` 파일 목록이 시작 때와 같음(+ 이 보고서). 11-1 지침 파일·`library.js`·`text/backup.js`·`db.js` 무변.

## 5. headless (`b9c3b/run-race.mjs`, 하네스 `b9c3b/common.mjs` = `r9c3/common.mjs` 사본 — 프로필 폴더·가짜 키 꼬리표만 바꿈)

Edge · pipe · 새 프로필 `b9c3b/p1` · 가짜 키(세션·로컬) · 흉내 Gemini(OPTIONS 204 + CORS) · 흉내 음성 · 캐시 끔 · **서버 띄움 0**(앱 요청은 가로채 작업 트리에서) · 한 번. 책 A = 합성 PDF(`b9c2/syn.pdf` 읽기만)를 가져온 뒤 `resetDerived` + 원본 지움 + `lastPage 3`.

| 경우 | 결과 |
|---|---|
| 리더 주소 → **다음 틱 `#/usage`** (3번) | 3번 모두 `#/usage`·화면 usage — **서재로 끌리지 않음** (Review 때 `#/library`) |
| 퀴즈 주소 → 다음 틱 `#/usage` (3번) | 3번 모두 `#/usage` (Review 때 `#/library`) |
| 검색 주소 → 다음 틱 `#/usage` (3번) | 3번 모두 `#/usage` (그대로) |
| 각 경합 히스토리 | +2(주소 둘 다 쌓임 — `replace` 가 사용량 항목을 덮지 않음) |
| 대조 — 경합 없이 리더·퀴즈 주소 | `#/library`·초점 `[PDF 가져오기]`(9c-3 동작 그대로) |
| 대조 — 설정 → 리더 주소 → 뒤로 | 서재 그 카드 → 뒤로 = `#/settings` |
| 콘솔 오류 · pageerror · 새 탭 · 외부 요청 · missing · 4xx · Gemini POST | 0 · 0 · 0 · 0(pdf.js CDN 만) · 0 · 0 · 0 |

stderr 0바이트, 44.5초.

## 6. spec

17-4-1 `[정정 2026-11-17 — 9c-3 Build]` 줄 바로 뒤에 `[정정 2026-11-17 — 9c-3b]` 한 줄(Edit 로 그 자리만, 줄 수 +1): 미래 시각 자르기는 새 문서만·기존 문서는 기기 유지(`docTimesFor`)·리더·퀴즈 입구 주소는 첫 `await` 앞·시험 보강.

## 7. 남은 것 · 막힌 것

- 남은 문제 없음. Review #5(ko "다른 판" 알림의 맨 위 단추 이름이 영어)·#8(클라우드 파일 읽기 실패 문구)은 이 지침 범위 밖 — 그대로.
- **막힌 명령 0.** 명령은 한 호출에 한 가지(`cd … &&`·파이프·`; echo` 0). 서버 띄움 0 · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · 프로필 복사 0 · `.nojekyll` 그대로 · `G:`·`D:/OCR` 무관 · `r9c3/` 쓰기 0.

## 8. 스크래치 `b9c3b/`

`backup.mjs`·`bak/`(고치기 전 7개 + 변이 전 `cur-*` 4개) · `fix-quiz.mjs` · `before-future.txt`·`after-future.txt`·`before-fix9c2.txt`·`after-fix9c2.txt` · `two.txt` · `mut.mjs`·`mut.log`·`m-M1`–`m-M4.txt` · `full1.txt`·`full2.txt` · `eol.mjs` · `mkcommon.mjs`·`common.mjs`·`run-race.mjs`·`race1.json`·`race1.err` · 프로필 `p1/`.
