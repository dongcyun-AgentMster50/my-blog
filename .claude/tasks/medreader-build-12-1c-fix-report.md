# Build 보고 — 12-1c: 합쳐진 문장 카드의 내용이 빈 값으로 덮임

> 지침 `.claude/tasks/medreader-build-12-1c-fix.md` · 근거 `apps/medreader/review.md` "12-1b 재검증" 12-1bR-2 V5 · 12-1bR-4 #1. 커밋 0. 스크래치 `b12-1c/`(`r12-1b/` 는 읽기·실행만).

## 1. 고친 것 — 중간-1 (`js/text/backup.js` `mergeSentence` 내용 묶음 한 곳, +25/−1)

**전**: 문장 카드 내용 묶음(복습·멈춤을 뺀 모든 필드)은 `updatedAt` 늦은 쪽이 **통째로** 이김. 새로 만든 카드의 만든 시각도 "내용 수정"으로 셈 → 12-1b 로 두 기기 카드가 한 장이 되면서, 나중에 **만들기만 한** 카드(빈 뒷면·메모)가 다른 기기의 **고친** 뒷면·메모를 지움(A←B), 반대(B←A)는 A 의 메모를 받지 못함.

**후** (`[12-1c — 12-1bR #1]` 주석):
- **② 이긴 쪽 정하기** — `sentenceEdited(c)`: 두 시각이 숫자로 있고 `updatedAt <= createdAt` 이면 "안 고침". 한쪽만 고쳤으면 **고친 쪽이 이김**(`updatedAt` 이 더 이르더라도). 둘 다 같은 꼴이면 지금 규칙(`updatedAt` 늦은 쪽, 같으면 기기). 시각을 모르는 레코드(`createdAt` 없음·숫자 아님·0 이하)는 **고친 것으로** 봄 → 옛·특이 레코드는 지금 규칙 그대로.
- **① 글자 필드별** (`back`·`note`·`explain`, 공백만도 빈 값): 빈 값이 비지 않은 값을 지우지 않음 — 파일이 이겨도 파일의 빈 칸은 건너뜀(기기 값 유지), 기기가 이겨도 기기의 빈 칸은 파일 값으로 **채움**. 채움은 `updatedAt` 을 올리지 않음.
- 복습(`reviewedAt`)·멈춤(`suspendedAt`) 묶음은 그대로 따로.
- 멱등: 이긴 쪽이 파일이면 두 시각이 파일 값으로 맞춰져 두 번째엔 같은 꼴·같은 시각 → 기기 이김 → 빈 칸 없음 → keep. 기기가 이기면 채운 뒤 빈 칸이 없음 → keep. 데이터 손실 없음(빈 값으로 지우는 길이 없어짐).
- 대가(spec·crossstep 기록): 일부러 비운 뒷면·메모는 다른 기기의 옛 값으로 다시 찬다(지움 표시가 없으므로). 지금은 비우는 화면이 없고(12-3 목록 편집), 12-3 에서 결정할 줄을 crossstep 에 남김.

### C10b 기대 바꿈 — `got.back === ''` → `'A-back'` (+ `docTitle === 'Book (B)'`)
C10b 는 A 가 **만들 때** 뒷면을 넣은 카드(안 고침), B 는 10ms 뒤 빈 뒷면으로 만든 카드(안 고침) — 둘 다 같은 꼴이라 내용 묶음은 여전히 늦게 만든 B 가 이김(그래서 `docTitle` 은 B 의 'Book (B)' — 새로 단정). 그러나 ① 로 B 의 빈 뒷면은 A 의 'A-back' 으로 채워진다. 전의 `''` 는 Review 가 지적한 "B 쪽도 A 의 내용을 받지 못함"을 설계대로라 고정하던 기대였다.

## 2. 시험 (`tests/cards-12.test.mjs` — C10b 한 줄 바꿈 + 두 줄 더함, C11·C11b 새로, 머리 주석)
- **C11 (순수 `mergeRecord`)**: V5 꼴 A←B keep · B←A 고친 A 내용(뒷면·메모·docTitle·두 시각) — `updatedAt` 이 더 일러도 · B←A 뒤 B 옛 파일 → keep · ② 는 빈 값만이 아님(B 가 만들 때 넣은 자동 뒷면도 A 의 고친 뒷면을 못 이김, 양방향) · 둘 다 고침 → 늦은 쪽(양방향) · 둘 다 안 고침 → 늦은 쪽 + 빈 칸만 채움(C10b 꼴, 양방향) · 한쪽만 빈 필드(파일 이김: 빈 메모·공백 설명이 기기 값 못 지움 / 기기 이김: 빈 메모만 채움) · `createdAt` 없는 옛 레코드 = 고침 · 복습 묶음은 여전히 따로 · 모든 경우 두 번 = 한 번.
- **C11b (종단 `exportBackup`/`importBackup`)**: A(만들 때 뒷면 → 1시간 뒤 메모 고침 → 복습) / B(같은 PDF 따로, 다음 날 만들기만) — B←A: 뒷면·메모 받음·docId 는 B 문서·복습 상태 A · 두 번 = 한 번 / A←B: 뒷면·메모·`updatedAt`·`createdAt`·복습 상태 그대로 · 두 번 = 한 번 · 카드 한 장 · fetch 0.
- **Review `r12-1b/rv2.test.mjs` 원본 그대로**(`b12-1c/rv2-orig.txt`): 8 통과 · **V5 만 빨강** — 발견을 단정하던 줄(`onB.note === ''`)에서. 로그: `on B after import A {"back":"A-back","note":"A note — user wrote this"}` · `on A after import B {"back":"A-back","note":"A note — user wrote this","updatedAt":3600000}` → 뒷면·메모 지켜짐(기대대로). 나머지 V1–V4·V6·V7 그대로 통과.
- `b12-1c/rv2-fixed.test.mjs`(rv2 사본, V5 끝 세 줄을 고친 뒤 기대로 뒤집고 A `updatedAt` 그대로 한 줄 더함): **9/9 통과**(`rv2-fixed.txt`).

## 3. 검증
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **2회: 1,852/1,852 · 1,852/1,852**(12.8초 · 12.9초 — `b12-1c/full1.txt`·`full2.txt`, 둘 다 변이 복원 뒤). 1,850 + C11·C11b. 12-1·12-1b 전부(C1–C10b·N·S) · 9c 병합 K10h·I6 · 멱등 K11·I5 · 8f 단어장 · 11-1 삭제 연쇄 포함 실패 0.
- 변이(`b12-1c/mut.mjs` — 언제나 `bak/backup.fixed.js` 를 **읽어서** 한 곳 바꿔 씀, 매치 1개 확인) → `cards-12`·`backup-9c`·`backup-import-9c`·`rv2-fixed` 실행:

| # | 변이 | 빨강 |
|---|---|---|
| M1 | ① 되돌림(파일이 이길 때 빈 글자 건너뜀 줄 지움) | C11 |
| M1b | ① 되돌림(기기가 이길 때 빈 칸 채움 줄 지움) | C10b · C11 |
| M2 | ② 되돌림(이긴 쪽 = `updatedAt` 늦은 쪽만) | C11 · C11b · rv2-fixed V5(A `updatedAt` 이 B 값으로 바뀜) |
| M3 | 시각 모르는 레코드를 "안 고침"으로 | C11 |

  복원: `mut.mjs restore`(백업을 읽어서 씀) → `cmp 앱 backup.js bak/backup.fixed.js` 차이 0. 원본(고치기 전)은 `bak/backup.orig.js`·`bak/cards-12.orig.test.mjs`.
- stamp 다시(단독 명령): "index.html 을 다시 썼다 (모듈 88개 · CSS 4개)" → `--check` "그대로다(모듈 88개 · CSS 4개)" · `git diff --check` 출력 0.
- headless 하지 않음(지침).
- spec 17-4-1 `[정정 2026-11-17 — 12-1b]` 줄 바로 뒤에 `[정정 2026-11-17 — 12-1c]` 한 줄(Edit, 그 자리만).
- crossstep 덧붙이기 두 줄: 12-2·12-3 정보-3(옛 docId 카드가 "이 책 복습"·`keptCount` 에 안 잡힘 — 12-3 에서 fileHash 로 묶을지) + 낮음-2 기록 · 12-3 "일부러 비운 뒷면·메모가 다시 참" 결정 후보.

## 4. 수정한 파일
- `apps/medreader/js/text/backup.js`(`mergeSentence` 와 그 위 도우미 `SENTENCE_TEXT_FIELDS`·`blankText`·`sentenceEdited`·주석)
- `apps/medreader/tests/cards-12.test.mjs`(머리 주석 · C10b 기대 · C11 · C11b)
- `apps/medreader/index.html`(stamp — backup.js 해시)
- `apps/medreader/spec.md`(한 줄)
- `.claude/tasks/medreader-crossstep-notes.md`(두 줄 덧붙임)
- 이 보고서. 12-2 지침 파일·`backup-*.test.mjs` 무변.

## 5. 실행 · 정리
명령은 한 호출에 한 가지(`cd … &&`·파이프·`; echo` 0 — 결과는 리다이렉트). **막힌(거절된) 명령 0.** 서버 0 · headless 0 · 프로세스 조회·디버깅 포트 0 · 진짜 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · `.nojekyll` 그대로 · `G:`·`D:/OCR` 무관.
스크래치 `b12-1c/`: `bak/`(backup.orig·backup.fixed·cards-12.orig) · `mut.mjs` · `m-M1.txt`·`m-M1b.txt`·`m-M2.txt`·`m-M3.txt` · `cards1.txt` · `rv2-orig.txt`·`rv2-fixed.test.mjs`·`rv2-fixed.txt` · `full1.txt`·`full2.txt`.
