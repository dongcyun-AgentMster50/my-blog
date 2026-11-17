# Build 지침 — 20-3 필기 화면 `#/notes` · 내보내기 · 다시 붙이기

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-16** 중 20-3 몫 — 6(필기 화면·내보내기·다시 붙이기)·7(12·11 과의 관계)·8 표 20-3 행·9 "20-3" 수용 기준·10 결정 표(권장안 — 20-D11·D12·D13)·12(실기기 — 적기만)·13(11-1 `fileHash` 사본, 9c), 17-16 안 `[정정 2026-11-17 — 20-1 Build]`·`20-2 Build` 줄. 운영자 위임: 권장안으로. 호출 0 · DB 3 · 판본 상수 불변. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-20-3-notes-screen-report.md`.

## 먼저 고칠 것 — 20-2 Review(20-2R) (20-2 는 배포됨)
review.md 끝 "20-2 Review" 절을 먼저 읽어라. 아래 항목에 한해 `js/ui/controls.js`·`js/ui/voice.js`·`js/voice/commands.js`·`js/ui/selbar.js`·`js/ui/notesheet.js`·`js/notes/annotations.js`·`js/ui/reader.js` 수정 허용.
1. **#1 음성 "표시"가 옛 설명 상태로 재개**: controls 의 `explainHeld` 에 띠 번호를 함께 담고 `inheritWas` 는 `isNoteOpen(id)` 로 그 띠가 열려 있을 때만 이어받기(ask `inherit` 와 같은 꼴). 시험 V2 에 Review 재현 장면(읽기 중 단추 [설명] → 재개 → 손으로 멈춤 → 음성 «اشرح» → «علّم» → 끝나면 paused) 추가.
2. **#2 문단 넘는 선택의 메모**: spec `[정정 20-2]` 대로 묶음의 **대표 레코드 하나에만** 메모 저장(다른 조각은 빈 메모) — 필기 화면에서 메모가 두 번 보이지 않게. 옛 중복(같은 group 에 같은 메모 둘)은 화면에서 하나로 보이기.
3. **#3 쪽 칩 셈**: 칩 숫자 = 쪽 시트 줄 수(묶음은 1, 고아 셈 여부는 시트와 같게).
4. **#7 «علم» 오탐**: 표를 `exact: ['علم']` 꼴로(Review 권장 — 의학 용어 «علم الأمراض» 등 null, «علّم»·«علم» 혼자·«علّم الجملة»·«ظلل»·«تظليل» 은 mark). 9b 표 무결성 시험·"question mark" 처리도 같이 — `[검토 — Nour·운영자]`.
5. #4(되돌리기 한 단계)·#5(선택 줄 기존 칸 node 시험 — 변이 r1 이 빨강이 되게): 작으면 함께, 아니면 보고서에.

## 설계 뒤 바뀐 것 — 맞춰라
- **20-1R #6**: 지금 HEAD 에서 이미 문서를 지워도 `annotations` 가 남는다(`keepsOnDocDelete` 가 스토어 전체를 남김 — 실측). 설계 6 "`CASCADE_STORES` 에서 뺌 −1" 은 옛 사실일 수 있다 — `db.js` 를 읽고 **지금 규칙이 이미 남김이면 db.js 는 고치지 않고** 시험으로 고정만. 고쳐야 하면 이유를 보고서에.
- 12-3: 서재 삭제 확인 "남습니다" 줄(`keptLine`)에 이미 단어장·요약·카드 수가 있다 — "필기 n" 하나 더. 12 카드의 `fileHash` 묶음과 같은 꼴로 고아 책 묶음.
- 11 요약·개요 레코드에 `fileHash` 사본이 있는지 코드에서 확인 — 없으면 `reattach` 는 필기만 옮기고 요약·개요는 보고서 "남은 문제"에(11 레코드 고치기는 이 단계 밖).
- 13-2 `#/planner`·12-3 `#/cards`·11-3 요약 화면의 라우터 꼴(`…Hash` 함수, 새로고침·뒤로)을 따른다. 서재 카드 `[⋯]` 메뉴 항목 자리.
- 20-2 의 쪽 필기 시트에 "이 책 필기 모두" 입구.
- 11-3 `exportText`(BOM·CRLF·Blob 내려받기) 재사용. 내보내기 화면 한 줄 "교과서 문장 인용이 들어 있습니다 — 공유에 주의하세요".

## 할 일
설계 8 표 20-3 행 그대로: 새 `js/ui/notes.js` · `tests/notes-ui-20.test.mjs`, 고칠 `js/router.js`(`notes` + `notesHash`) · `js/main.js` · (위 판단에 따라) `js/db.js` · `js/ui/library.js`(카드 `[⋯]` "필기" · 삭제 확인 수 · 같은 PDF 다시 가져올 때 `reattach` — 한 트랜잭션) · `index.html` · `css/screens.css` · i18n 4개(ar·fr `[검토 — Nour·운영자]`). 목록: 책 → 장(개요 깊이 0) → 쪽 순, 줄 48px+(색 점·인용 `dir=ltr`·메모 `dir=auto`·쪽 라벨·`[원문으로]`·`[메모]`·`[삭제]`), 거르기 칩(색·메모 있는 것·위치 못 찾은 것), 고아 → 쪽 처음 + "위치를 찾지 못했습니다", 고아 책 `docTitle` 묶음 + "PDF 를 다시 가져오면 다시 붙습니다". 9c: `annotations` 문서 없이도 넣기(11 과 같은 규칙) 확인.

## 검증
- 수용 기준 "20-3" 전부 + 변이(설계 둘 + 네가 고른 둘) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `b20-3/bak/`).
- 회귀: 서재 삭제·가져오기(같은 PDF 다시·다른 PDF), 12-3 `keptLine`·카드 묶음, 11-3·13-2·12-3 라우트, 9c 내보내기/가져오기 `annotations` 멱등, 20-2 만들기·쪽 시트. 요청 0.
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독), `--check` 0, `git diff --check` 0. `innerHTML` 새 사용 0(메모·책 제목에 `<img onerror>`).
- headless: Edge, pipe, 새 프로필 `b20-3/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF. 360×740·412×915·915×412 × 4언어, 48px, 넘침 0, 내보내기 Blob 가로채 줄 수·BOM·CRLF. 콘솔 오류 0. 스크린샷 4–6장 `b20-3/shots/`.
- spec 17-16 안 `[정정 2026-11-17 — 20-3 Build]` 줄(Edit 로 그 자리만) — 20-1R #6 사실 포함, 11-D8 문구가 20-D11 로 바뀐 것.

## 수정 범위
설계 8 표 20-3 행의 파일 + `index.html`(stamp) + `tests/` + `spec.md` + 스크래치패드 `b20-3/` + 보고서. 위 "먼저 고칠 것" 의 파일(그 항목만). `ai/*`·`backup/*`·`text/backup.js`·`text/*`·`speaker.js`·review.md·`dev/` 금지.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**(작업 폴더는 이미 저장소 뿌리 — 첫 시험·stamp 도 단독, 시험은 글로브 꼴). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 쓸 스크래치 폴더는 먼저 만들 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
