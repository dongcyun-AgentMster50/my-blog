# Review 지침 — 15-2c 재검토 (아주 좁게: 근거 인용 숫자 기호 경계)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "15-2c Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지 — 덧붙인 뒤 특수 글자 수 점검). 스크래치패드 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\r15-2c\`(먼저 만들 것). `b15-2c/`·`r15-2b/`·`r15-2/`·`r15-1/` 는 읽기만.

## 볼 것
review.md "15-2b Review" 절, 지침 `.claude/tasks/medreader-build-15-2c.md`, 보고서 `.claude/tasks/medreader-build-15-2c-report.md`("15-2c 덧붙임" 절 포함 — 믿지 말고 다시 재라). 바뀐 곳: `js/ai/grounding.js` 경계 판정·`tests/grounding-15.test.mjs` Q12·spec 정정 줄·`index.html` stamp 한 줄. 그 밖 파일은 15-2b Review 때와 같아야 한다(`cmp`/해시로 확인).

## 확인할 것
1. **값이 바뀌는 잘림 — 흔한 의학 표기**: 부호(`−`·`-`·en 대시 빼기)·비교(`<`·`>`·`≤`·`≥`, 공백 한 칸 포함)·범위(`3–5`·`5 – 10`·`3-5`)·비율(`1:1000`)·단위(`mg/kg`·`%`·`٪`·`‰`·`°`, 공백 한 칸 포함)·거듭제곱(`10^9`·`10⁹`)·소수(`0.25`)·천 단위(`1,000`) 각 꼴을 **네가 새로 지은 문단**으로(Build 하네스와 다른 글자), 시작 쪽·끝 쪽 모두 — 잘리면 폐기, 기호까지 넣은 인용은 통과.
2. **정당 손실**: `r15-1/ground.mjs`·`r15-2/ground2.mjs`·`r15-2b/bound.mjs` 판정이 Build 보고와 같은가, 대가(대시 뒤 수로 시작하는 정당 인용 폐기)가 얼마나 흔할지 — CMDT 2026 장 하나(읽기만 — `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, Downloads 목록 보지 말 것, pdf.js(Node) `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`)의 문단에서 무작위 문장 시작·끝 인용 300개를 낱말 경계로 잘라 만들어 **정당 인용이 폐기되는 비율**(숫자만, 글 옮기지 말 것).
3. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0, `grounding.js` 특수 글자 0.
4. 변이 둘 이상 네가 고른 곳(Build M1–M4·A1–A5 와 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r15-2c/bak/`).

## 판정 기준 (반복을 끝내기 위한 문턱)
- **중간 이상**(→ "고친 뒤 배포"): 1번 표의 흔한 표기 꼴 중 하나라도 잘린 채 통과(값이 바뀜) · 2번에서 정당 인용 폐기 비율 **> 10%** · 그 밖 파일이 바뀜 · 테스트 손상.
- **낮음**(→ "배포 가능"): 1번 표 밖의 드문 표기(공백 두 칸 이상·글자 바로 뒤 기호 `pH<7`·`can't` 류), 정당 폐기 ≤ 10%, 문안. 드문 꼴은 목록으로만 남겨라.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 금지 — 시험도 절대 경로로 단독). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 금지. 서버 금지. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). **진짜 API 키·진짜 Gemini 요청 금지.** 모든 실행 10분 이내, 표준 입력 대기 금지. 끝나기 전에 띄운 백그라운드 작업은 모두 끝낼 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `r15-2c/` 만. 금지: 앱 코드·테스트·spec·`dev/` 수정, 커밋, `git checkout/restore/stash`, npm·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
