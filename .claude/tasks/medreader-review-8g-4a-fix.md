# Review 지침 — 8g-4a-fix: 숨은 리더 쪽 넘김 뒤 "떠난 쪽 결과"로 이동(F1)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 짧은 **"8g-4a-fix Review"** 절로 덧붙인다(앞 절은 고치지 않는다).

## 읽을 것
지침 `.claude/tasks/medreader-build-8g-4a-fix.md`, Build 보고 `.claude/tasks/medreader-build-8g-4a-fix-report.md`, review.md "8g-4a Review"(F1 재현·X1·X8·X9). 변경: `git diff`(reader.js · search.js · index.html stamp · tests/search-ui-8g.test.mjs) + 새 `tests/search-jump-8g4afix.test.mjs`. 직전 커밋 `2a8da10`.

## 확인할 것
1. **변경 범위·무결성**: `git diff --stat` 이 지침 범위뿐인지. Build 가 변이 R2 복원 중 Windows `copyFile` 실패로 search.js 를 **Edit 로 손으로 되돌렸다** — search.js 의 차이가 보고서가 말한 것(import · `env.mark()` 한 줄 · `JUMP_ENV.mark` · 주석)**뿐**인지 줄 단위로 확인(변이 흔적 0).
2. **F1 고침**: `softEntry = 'jump'` 표시가 생기고 지워지는 모든 길 — 숨은 리더에서만 서는지, `leaveReader`·판정 직후 `'back'` 으로 돌아가는지, 표시가 남아 다음 "뒤로"를 이동으로 착각하는 경로가 없는지(예: mark 뒤 go 가 실패·취소되는 경우, 같은 쪽 결과, 다른 책 결과 F3 경로, 검색 화면의 앱 안 [뒤로] `goBack`).
3. `softReturnPlan` 표 17줄이 의미 있는지(뒤로/이동 × 같은 쪽/다른 쪽 × hiddenTurn × hasDom × stalePaint), 순수성.
4. **headless 로 직접**: F1 재현 절차(고친 뒤 61쪽·강조·띠), 뒤로 돌아옴(낭독이 간 쪽), 8i-3 쪽 넘김 낭독 한 번, 8i-1 B(옛 판 쪽 재생 대기) 한 번.
5. **테스트의 힘**: 네 변이 2개 이상(예: `'back'` 되돌림 빼기, mark 를 go 뒤로) + X1·X8·X9 다시. 변이는 reader.js·search.js·테스트에만. 복원은 **읽어서 쓰기**로 하고 매번 `cmp`(Windows copyFile 실패 주의). 백업 스크래치패드 `r8g4af/bak/`.
6. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1206 기대), `stamp --check` 0.

## 규칙
모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 8000번 python(PID 15088)은 쓰고 끄지 마라. 8123·8124·8125번 node 는 건드리지 마라. 브라우저 프로필은 새로 만든 것 1개. 진짜 API 키 금지. PDF 는 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` 만. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8g4af/` 만. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제.
