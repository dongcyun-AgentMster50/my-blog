# Review 지침 — 8q-b 재검토 (좁게: 과적합 고침 + 8q 변이 채우기)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8q-b Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\r8q-b\`(먼저 만들 것). `r8q/`·`b8q/`·`b8q-b/` 는 읽기만 — 도구 재사용 가능.

## 볼 것
review.md "8q Review" 절(8qR-1–10), 지침 `.claude/tasks/medreader-build-8q-b.md`, 보고서 `.claude/tasks/medreader-build-8q-b-report.md`(믿지 말고 다시 재라), `b8q-b/test-sample.txt`·`test-result.txt`, `git diff`(8q + 8q-b 함께 미커밋 — 바뀐 곳은 `js/text/columns.js` 3단 경로·시험·spec). **기준선 = 8q Build 판(ii)** — 8q Review 가 이미 본 것(의학책 0·되돌림·재추출·8i-4-0)은 다시 다 하지 말고 바뀐 곳만.

## 확인할 것
1. **일반화 — 아무도 안 본 표본으로**: Build 개발용 42쪽·시험 20쪽(1999-04·2000-07·2000-10)과 겹치지 않는, **또 다른 SciAm 권 2–3권**(경로는 14 Plan 보고서·spec 4-14-1·`b8q-b/` 기록에서 보이는 범위 — 폴더를 넓게 훑지 말 것, 읽기만)의 3단 쪽에서 시드 고정 무작위 15쪽. (ii)·(iii) 두 판을 원본 PNG 와 대조(단 순서·제목 자리·줄 끼임 — 글 옮기지 말고 단 번호·줄 수만). 쪽 구성 한계(2단 상자·괘선 기사 경계 등)는 따로 셈.
2. **바뀐 규칙이 판형 원리인가**: 끼움(꽉 찬 본문 줄·아래로 이어짐·감싸 도는 옆 줄)·섞인 밴드 처리 — 쪽·권·낱말 맞춤이 없는가(코드 읽기). 남은 4("꽉 찬 줄" 0.85 문턱 오판 가능)를 합성 쪽으로 재현해 손해 크기.
3. **수용 기준 1 다시(짧게)**: 세 의학책·해커스 HEAD(41d00eb) 대 바뀐 쪽 0 — 바뀐 코드가 3단 경로뿐이라도 한 번은 너의 실행으로(단독·순차). 되돌림 사본 = HEAD(의학책 한 권으로 충분).
4. 수용 기준 2: 115±10·표 ≤10%·잃은 글자 0.
5. **변이 3개 이상 네가 고른 곳**(8q Build M1–M11·8q-b M1–M6 과 다르게 — **C0 우선 경로·되돌림 스위치 각각 하나 포함**) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8q-b/bak/`). 변이 적용 확인은 `cmp` 또는 Read 로(별도 `grep -c` 호출이 막히면 변형 찾지 말고 Read 로 확인 — 그래도 막히면 멈춰 보고).
6. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0. `review6` 바뀐 곳 바이트 diff(제목만).

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 의학책·해커스 바뀐 쪽 ≥1, 되돌림 ≠ HEAD, 새 15쪽에서 (iii) 틀린 쪽(쪽 구성 한계 뺌) **≥ 3** 이거나 (ii) 보다 많음, 글자 잃음, 쪽·권 맞춤 코드, 테스트 손상.
- **낮음**(→ "배포 가능"): 쪽 구성 한계·문턱 오판 가능성(표본에서 안 보임)·문안.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 금지). 긴 실행은 `timeout 560`, **측정은 단독으로**(병렬 금지). 프로세스 조회·디버깅 포트 금지. 서버 금지. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). pdf.js(Node) `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`. 의학책 경로는 8q 지침(`.claude/tasks/medreader-build-8q-cols3.md`) 그대로 — 읽기만, Downloads 목록 보지 말 것. 모든 실행 10분 이내, 표준 입력 대기 금지. C: 5GB 아래면 멈춤. 원서 글은 옮기지 말 것(숫자만). 수정 범위: `review.md` 끝 절, 스크래치패드 `r8q-b/` 만. 금지: 앱 코드·테스트·spec·`dev/` 수정, 커밋, `git checkout/restore/stash`, npm·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
