# Review 지침 — 8n-e 재검증 (P3 만, 범위 좁게)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8n-e 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8ne/`(앞 `r8n*`·`b8n*` 은 읽기만).

## 볼 것
review.md "8n-d 재검증", 지침 `.claude/tasks/medreader-build-8n-e-fix.md`, 보고서 `.claude/tasks/medreader-build-8n-e-fix-report.md`(믿지 말고 다시 재라), `git diff` 의 `js/text/lang.js`(`countEsWords`)·8n 테스트·말뭉치, spec 19-1-3 §5 `[정정 2026-11-16 — 8n-e]`.

## 확인할 것
1. **단조성**: P3 는 es 낱말 수를 줄이기만 해야 한다. `countEsWords` 결과가 8n-d 판 셈보다 큰 입력이 있는가(무작위 서로 다른 글 5만 + 경계: 숫자·기호·구두점·줄바꿈·악센트 대문자 `Él`·`Á` 뒤, 하이픈 낱말, 아포스트로피). 하나라도 있으면 중간.
2. P3 가 놓치는 스페인어 꼴(`El` + 대문자 시작 낱말, 문장 첫머리 `Por Dios` 등)이 실제로 판정을 바꾸는지 — 바꾸더라도 HEAD 값으로 떨어지면 낮음.
3. 네가 새로 지은 고유명사 든 짧은 프랑스어·영어 6개 이상(앞 Review 글과 다르게 — 지명·인명·기관명·참고문헌) → es 0 인가.
4. 회귀: golden sha1 불변, 무작위 서로 다른 글 5만에서 es 아닌 결과 HEAD 와 다른 것 0, en·fr·ko 분할 0, 의학책 3권 표본 HEAD 와 같음.
5. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
6. 변이 2개 이상 네가 고른 곳(`countEsWords` 안) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8ne/bak/`).
7. headless 하지 않는다.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 단조성 위반, 회귀, 지원 언어(en·fr·ko) 실제 글 꼴이 8n-d 대비 **새로** es 로 가는 것.
- 그 밖(스페인어를 놓쳐 HEAD 값, 지원 밖 언어, 두 언어가 진짜 섞인 글, 무작위 섞음에서만)은 **낮음** → "배포 가능", 한계로 기록.
표(번호·심각도·내용·근거) + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만. 프로세스 조회·디버깅 포트 찌르기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 서버 건드리지 마라. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책은 읽기만, Downloads 목록 보지 말 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8ne/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
