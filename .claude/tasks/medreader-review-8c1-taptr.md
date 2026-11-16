# Review 지침 — 8c-1 탭 번역 · 선택 동작 줄

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8c-1 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8c1/`(Build 의 `b8c1/` 는 읽기만).

## 볼 것
spec 17-7-6(8c-1 몫 — 3 손짓 표·4-1·4-2·6·8 "8c-1"·9·10, 그리고 `[정정 2026-11-16 — 8c-1 Build]` 세 줄), `.claude/tasks/medreader-crossstep-notes.md` "8c-1" 절, 지침 `.claude/tasks/medreader-build-8c1-taptr.md`, 보고서 `.claude/tasks/medreader-build-8c1-taptr-report.md`(믿지 말고 다시 재라), `git diff` + 새 파일(`js/text/select.js`·`js/ui/selbar.js`·`tests/taptr-8c.test.mjs`).

## 확인할 것
1. **회귀(가장 중요)**: 낭독 동반 번역 띠(7-7)·8d 문장 아래 표시·8e 가로 dock·`[≡]`·9a 잠금 화면/이어폰·9b 음성 명령·원본 보기·검색 결과로 이동이 HEAD 처럼 동작하는가. 번역 요청 본문 바이트·캐시 키 불변(흉내 Gemini 로 HEAD 판 `git archive` 와 대조). Build 가 "테스트가 아니라 코드를 맞춰 푼" 빨강 3개(8h-1 buildUnits 검사·8b-2 WB1·WB2 소스 모양)가 **테스트의 뜻을 지킨 것인지**, 소스 모양만 맞춘 것인지.
2. **손짓 경계**: 탭 / 길게 누르기 / 끌기 / 선택 풀기 탭 / 스크롤 끝 탭 / 두 손가락 — `isTap` 과 pointer 이벤트 순서(touch 흉내: `Input.dispatchTouchEvent` 또는 puppeteer touchscreen)로. 낭독 중·멈춤·idle 에서 줄 탭이 설계 3절 표대로인가(paused → 그 줄로 이동 — 정정 줄의 해석이 설계 8cf-D3 와 맞는가).
3. **띠 상태**: 탭 모드 ↔ 낭독 모드 전환, 닫기 조건 다섯(`[×]`·다른 줄 탭·[▶]·쪽 넘김·리더 떠남), 번역 끔에서 열고 닫을 때 자리 복원, `data-tr-inline` 떼고 붙이기, 실패·차단(키 없음·상한·offline·429) 표시와 [다시 시도].
4. **선택 줄**: 48px·넘침 0·RTL 거울(ar)·띠와 겹침·`[단어 번역]` hidden·선택이 `.ra-tr`·띠 글자 안이면 안 뜸·`SEL_ACTIONS` 목록 데이터 구조가 11·8f-2 가 얹기 쉬운가(crossstep ①), 띠 머리 단추 칸 둘(crossstep ②).
5. **접근성**: 키보드만으로 탭 번역 열기/닫기 가능한가(줄에 포커스·Enter?) — 설계가 정한 범위 안에서, `aria-pressed`·`aria-label`·region 이름·포커스 이동·Esc. 낭독기 순서.
6. **호출 수**: 같은 문단 다른 줄 0, 새로고침 뒤 0, 낭독 동반 번역이 받은 쪽 0, 연타(같은 줄 빠르게 5번)·여러 줄 빠르게 탭할 때 요청 수와 동시 요청 상한.
7. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
8. 변이 3개 이상 네가 고른 곳(Build 의 M1–M6 과 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8c1/bak/`). 생존은 테스트 구멍. headless 변이 땐 HTTP 캐시 끄기(`setCacheEnabled(false)`).
9. headless(Edge, 412×915 세로·915×412 가로, ko·ar UI, 새 프로필 `r8c1/p*`, pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성, CMDT 2026 또는 네가 만든 합성 PDF): 위 2–6 을 화면에서. 콘솔 오류 0(일부러 낸 4xx 흉내 제외), 가로 넘침 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 기존 동작 회귀, 요청 바이트·캐시 변화, 탭이 아닌 손짓이 번역·이동을 부름, 띠가 닫히지 않거나 엉뚱한 문장, 선택 줄이 본문·바를 가림, 키보드로 닫을 수 없음, 콘솔 오류.
- **낮음**(→ "배포 가능", 다듬기 후보로): 보고서가 밝힌 남은 문제 1–6 꼴, 실기기에서만 확인될 것, 문구.
표(번호·심각도·내용·근거) + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(백업·복사·확인도 각각). 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책 읽기만(`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`), Downloads 목록 보지 말 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8c1/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
