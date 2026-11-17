# Review 지침 — 13-1 학습 계획: 낭독 기록 · 읽은 쪽 · 계획 계산 (화면 없음)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "13-1 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r13-1/`(Build 의 `b13-1/`·앞 Review 들의 `r12-*/`·`r11-*/` 는 읽기만 — 하네스 재사용). 쓸 폴더는 먼저 만들 것.

## 볼 것
spec 17-12(2·3·4·6·7 "13-1"·8·9, `[정정 2026-11-17 — 13-1 Build]` ①–⑧), 3-2·9-3 정정 줄, 17-4-1(9c `@read`·설정), 지침 `.claude/tasks/medreader-build-13-1-planner.md`, 보고서 `.claude/tasks/medreader-build-13-1-planner-report.md`(믿지 말고 다시 재라), `git diff` + 새 파일(`js/plan/planner.js`·`js/plan/readlog.js`·시험 둘).

## 확인할 것
1. **낭독 회귀(가장 중요)**: `speaker.js` `advancePage(depth, auto)`·`pagedone` 과 `controls.js` attach/detach/onHidden 이 낭독 자체를 바꾸지 않는가 — 쪽 끝 자동 넘김·빈 쪽 넘김·마지막 쪽·[다음]·[이전]·stop·hidden 멈춤(6-4)·반복(문장·줄·unit)·9a 이어폰·9b 음성 재개·11-2/11-4 말하기 뒤 재개·12-2 [☆]·검색 결과로 이동·원본 보기. speaker 시험 전부, 앞 Review 회귀 하네스(`r11-4c/`·`r12-2/` 사본 — 읽기만)로 HEAD 와 같은 값.
2. **기록 정확성**: 네가 새로 짠 가짜 speaker·가짜 시계 흐름 — 멈춤·재개 반복, 문장 건너뛰기(줄 탭), 속도 바꿈, 쪽 넘김 대기 중, 자정 걸침(날 키), `MAX_GAP_MS`, 같은 index 재시작, track 끔, 숨김·다시 보임 — `ms`·`chars`·`pages` 가 실제와 맞는가, 쓰기 횟수(60초·멈춤·hidden 에서만). `@read` 구간(겹침·이웃·안 읽음 표시·`markRead` 문서 검사), 퀴즈 `progress` 와 섞이지 않음, 문서 삭제 연쇄.
3. **계획 계산**: `planFor` 등 순수 함수를 네가 손 계산한 입력으로(시험일 오늘·내일·과거, 쉬는 요일 모두, 남은 0, 속도 실측 문턱 29/31분, 1만 자당 실측 문턱, 복습 분 빼기, 올림 찌꺼기), `tight`·`past`·`done` 상태, 순수 grep.
4. **9c**: `reading.log` 날짜·갈래·칸별 큰 값(멱등), `reading.track`·`planner.exams` 덮기, `@read` 합집합 — 보고서 남은 2(`planner.exams` 의 `docId` 가 9c 에서 안 옮겨짐)·3(안 읽음 표시가 합집합에 다시 읽음) 판단.
5. 요청 본문 바이트 HEAD 와 같음, AI 요청 0(기록 쪽).
6. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
7. 변이 3개 이상 네가 고른 곳(Build M1–M9 와 다르게 — speaker·controls 배선 하나 포함) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r13-1/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
8. headless: Edge, pipe, 새 프로필 `r13-1/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성(`onend` 를 글자 수 ÷ 14자/초 — 가짜 시계와 함께), 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF. 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 낭독 동작 회귀(쪽 넘김·재개·멈춤), 기록이 실제와 크게 어긋남·두 번 셈·자정 날 틀림, 계획 숫자 틀림, 9c 에서 기록·진도 잃음·멱등 깨짐, AI 요청이 생김, 콘솔 오류.
- **낮음**(→ "배포 가능"): 설계 한계·13-2 몫·문안·측정 대기(`TEXT_TO_SPOKEN`).
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r13-1/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
