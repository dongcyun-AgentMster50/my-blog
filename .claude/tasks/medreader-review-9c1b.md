# Review 지침 — 9c-1b 재검증 (고친 곳만, 짧게)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "9c-1b 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r9c1b/`(`r9c1/`·`b9c1b/` 는 읽기만).

## 볼 것
review.md "9c-1 Review", 지침 `.claude/tasks/medreader-build-9c1b-fix.md`, 보고서 `.claude/tasks/medreader-build-9c1b-fix-report.md`(믿지 말고 다시 재라), spec 17-4-1·13절의 `[정정 2026-11-17 — 9c-1b]`, `git diff`(9c-1 + 9c-1b 함께 미커밋 — 9c-1b 몫은 `config.js` `BACKUP.KEY_PATTERNS`·`text/backup.js` 지우개·`hasKeyShape`·`mergeTerm` 동률).

## 확인할 것
1. **키는 여전히 0건**: 네가 새로 고른 가짜 키 꼴 — `sk-` 뒤 20자 안팎 경계(19·20·21자), `sk-proj-…`·`sk-ant-…` 꼴, 앞에 `-`·`_`·`=`·`"`·`(`·줄바꿈이 붙은 `sk-…`, URL 쿼리 안(`?key=AIza…`·`&token=sk-…`), `Bearer` 뒤 토큰 길이 11·12·13·숫자 없음/있음, JSON 문자열 안 이스케이프, 대소문자 `bearer`·`BEARER`, 아랍어·한글 문장 사이. 실제 키 꼴(Google·OpenAI·Anthropic 문서에 나오는 길이)이 백업에서 빠져나가는 틈이 있는가 — 있으면 중간.
2. **정상 글 보존**: 의학·일반 하이픈 합성어 수십 개(네가 지은 것), "Bearer of/bearer bonds", 약어 `sk-`(스칸디나비아 코드?) 등이 그대로인가. 보고서 남은 위험(`sk-learn-compatible-pipelines` 꼴 지워짐)의 실제 빈도 판단.
3. `mergeTerm` 동률 → 기기 유지가 멱등·다른 경우(파일이 더 새로움·기기가 더 새로움)에 9c-1 판과 같은가. `importPlan`(CSV) 무변.
4. `REDACT_PATTERNS`·`privacy/redact.js` 무변(바이트), 로그 쪽 시험 통과.
5. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
6. 변이 2개 이상 네가 고른 곳(Build M1–M4 와 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r9c1b/bak/`).
7. headless 하지 않는다.

## 판정 기준 (기준선 = 9c-1 Review 때의 동작)
- **중간 이상**(→ "고친 뒤 배포"): 실제 키 꼴이 백업 파일에 남는 틈(9c-1 판은 막던 것), 9c-1b 가 새로 만든 데이터 손실·병합 변화, `REDACT_PATTERNS`·로그 쪽 변화.
- 그 밖은 **낮음** → "배포 가능".
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지(꼴만 맞춘 가짜). 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r9c1b/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
