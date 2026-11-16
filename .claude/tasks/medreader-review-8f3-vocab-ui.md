# Review 지침 — 8f-3 단어장 화면 · CSV 내보내기/가져오기

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8f-3 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8f3/`(Build 의 `b8f3/`·앞 Review 의 `r8f2/` 는 읽기만 — 하네스 재사용 가능).

## 볼 것
spec 17-7-6(4-6·5 표 8f-3 행·6·7·8 "8f-3"·9·10, 17-7-6 안 모든 `[정정 2026-11-16 …]` 줄 — 특히 `8f-1 Build` 4-6·`8f-3 Build`), `.claude/tasks/medreader-crossstep-notes.md` "8f-1 Review 에서 넘긴 것", 지침 `.claude/tasks/medreader-build-8f3-vocab-ui.md`, 보고서 `.claude/tasks/medreader-build-8f3-vocab-ui-report.md`(믿지 말고 다시 재라), review.md "8f-1 Review"·"8f-2 Review", `git diff` + 새 파일(`js/ui/vocab.js`·`tests/vocab-ui-8f.test.mjs`).

## 확인할 것
1. **`tests/router.test.mjs` 무결성**: Build 가 NUL 바이트가 든 이 파일을 스크립트로 바이트 편집했다. `git diff --stat`·`git diff -a` 로 바뀐 것이 R1 의 한 줄뿐인지, 나머지 바이트(NUL 포함)가 HEAD 와 같은지(`git show HEAD:… ` 와 바이트 비교), 시험이 실제로 도는지.
2. **가져오기 = 데이터 안전(가장 중요)**: 네가 새로 만든 CSV 로 — 그대로 다시 가져오기(변화 0), 한 칸 고침(바뀜 1), `updated` 를 `dd/mm/yyyy`·`yyyy/mm/dd`·숫자(엑셀 일련번호)·빈칸·미래 시각으로(충돌 또는 설계 규칙대로 — 기기 값을 조용히 덮지 않음), 기기 쪽이 더 새로움(그대로·충돌), 열 순서 바뀜·머리 줄 번역됨·열 빠짐·여분 열, 같은 낱말 두 줄, 다른 대상 언어 줄, 지운 책의 `docId`, 2MB·5,000줄 경계, 깨진 따옴표, UTF-16·BOM 없음·ANSI(cp1256) 꼴. 적용 뒤 레코드의 복습 필드(`sm2`·`dueAt`·`reviewedAt`·`introducedAt`) 불변. 미리보기에서 고르지 않은 충돌은 적용되지 않음.
3. **내보내기**: BOM·CRLF·수식 접두·키 0·공유 주의, Anki 꼴, 대량(1,000+ 항목) 속도·메모리, 파일 이름.
4. **bulk 번역**: 누름당 1호출·20개, 남은 수, 어긋난 항목만 빈 채, capped·offline·키 없음 0, 사용자 글 요청 0.
5. **화면**: 360×740·412×915·915×412 × ko·ar(+en·fr 한 번) — 목록·편집 대화·삭제 확인·가져오기 미리보기·빈 단어장·1,000 항목 목록 스크롤 성능, 가로 넘침 0, 48px, RTL, 원어 `dir=ltr`, `innerHTML` 0(단어·메모에 `<img onerror>` 넣어 확인), Esc·포커스·`<dialog>`.
6. **8f-2 Review 넘김 처리(보고 3절)**가 실제로 맞는지 — 특히 포커스(②)·질문 낭독(③)·질문 중 재호출(④). Build 가 남긴 "가로 시트 43px 가림"의 실제 영향.
7. **회귀**: 8f-2 시트·8c-1 선택 줄/탭 띠·Esc 층·손가락 판정(앞 하네스), 서재 목록·삭제, 라우터(뒤로 가기·새로고침으로 `#/vocab/:docId` 직접 열기), 번역 요청 본문 바이트 HEAD 와 같음.
8. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
9. 변이 3개 이상 네가 고른 곳(Build M1–M8 과 다르게 — 예: 충돌 고르기 무시하고 적용, 지운 책 `docId` 를 새 문서로, `planToApply` 가 복습 필드 덮기, 내보내기 BOM 빼기) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8f3/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
10. headless: Edge, pipe, 새 프로필 `r8f3/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성, 캐시 끔, **한 번에 하나씩**. 내려받기는 `Browser.setDownloadBehavior` 로 스크래치 폴더에만(사용자 Downloads 금지). 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 가져오기·편집이 사용자 데이터를 조용히 덮음·잃음·중복, 복습 필드 덮음, 설계보다 많은 호출, 사용자 글이 요청에, XSS, 수식 주입, 키 노출, 8f-2·8c-1 대비 회귀, 화면 밖·닫을 수 없음, 테스트 파일 손상, 콘솔 오류.
- **낮음**(→ "배포 가능", 다듬기 후보로): 문안, 실기기 확인 거리, 보고 9절 남은 문제 꼴.
표(번호·심각도·내용·근거) + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프로 묶지 말 것, 긴 실행은 `timeout 560`). 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 큰 원서로 검색 화면에 들어가지 말 것. 의학책 읽기만(`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`), Downloads 목록 보지 말 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8f3/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
