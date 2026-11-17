# Review 지침 — 12-3 복습 화면 · 목록 · 서재 "오늘" 줄

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "12-3 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r12-3/`(Build 의 `b12-3/`·앞 Review 들의 `r12-*/` 는 읽기만 — 하네스 재사용). 쓸 폴더는 먼저 만들 것.

## 볼 것
spec 17-11(6·7 표 12-3 행·8 "12-3"·10, `[정정 2026-11-17 — 12-3 Build]` ①–⑧), 17-4-1 12-1c·12-1d 줄, 지침 `.claude/tasks/medreader-build-12-3-review-screen.md`, 보고서 `.claude/tasks/medreader-build-12-3-review-screen-report.md`(믿지 말고 다시 재라), `git diff` + 새 파일(`js/ui/cards.js`·`tests/cards-ui-12.test.mjs`). **Build 가 내린 결정 둘**(① "이 책" = docId + 지워진 문서의 fileHash 책 칸 카드, ② 자동 채움은 `updatedAt` 을 올리지 않음 — 12-1 시험 기대 다섯 줄 바꿈)을 따로 판단하라. `tests/router.test.mjs` NUL 바이트 스크립트 편집(바뀐 것이 한 곳뿐인지 바이트 비교).

## 확인할 것
1. **복습 흐름·데이터**: 복습·"다시" 재삽입·끝 화면·`dueAt` = `previewLabels`·하루 새 카드 상한(`cards.readLog()` — DB)·자정(가짜 시계)·거르기·`#/cards/:docId`(결정 ① — 살아 있는 다른 문서 카드를 섞지 않음, 지운 같은 PDF 카드는 묶음), [목록] 편집(`updatedAt` 오름)·멈춤(`suspendedAt`)·삭제(페이지 안 확인)·비우기. 결정 ② 가 9c 병합에서 손으로 쓴 뒷면을 지키는지(양방향·세 기기), 자동 채움 카드의 `updatedAt` 이 그대로라 "바뀐 항목"(8f `changedSince`)이 늘지 않는지.
2. **호출 0**: 복습·답 보기·뒷면 조회(캐시 `db.get`)·[쪽으로 가기]·목록 — POST 0, 요청 본문 바이트 HEAD 와 같음.
3. **회귀**: 12-2 띠 [☆]·선택 줄·음성 "기억", 선택 줄 `[⋯]` 메뉴(915×412 두 열 — 세로 두 크기 그대로, 18 [찾아보기] 보임), 8f-3 단어장 `[복습 (n)]`·CSV, 서재 "오늘" 줄·삭제 확인 한 줄(새 ko 문구), 11-3 요약 화면·라우터(뒤로 가기·새로고침으로 `#/cards`·`#/cards/:docId`·없는 id), 9c 백업.
4. **화면·접근성**: 3크기 × 4언어, 단추 넷 48px·간격 라벨·RTL(앞면 ltr·뒷면 rtl)·키보드만 한 세션(Tab·Space·1–4)·`aria-live`·포커스·`innerHTML` 0(카드 글자에 `<img onerror>`).
5. **성능**: 5,000장 합성(Build 하네스) — 1초 넘는 것.
6. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
7. 변이 3개 이상 네가 고른 곳(Build M1–M12 와 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r12-3/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
8. headless: Edge, pipe, 새 프로필 `r12-3/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, 가짜 시계, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기). 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): AI 호출이 생김, 복습 상태·내용·멈춤 손실·엉뚱한 카드 갱신, 새 카드 상한·자정 처리 틀림, 결정 ① 이 다른 책 카드를 섞음, 결정 ② 가 9c 에서 손으로 쓴 값을 잃게 함, 회귀, 키보드로 못 씀, XSS, 콘솔 오류, 테스트 파일 손상.
- **낮음**(→ "배포 가능"): 문안·배치·실기기 확인 거리·보고서 "남은 문제" 꼴.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r12-3/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
