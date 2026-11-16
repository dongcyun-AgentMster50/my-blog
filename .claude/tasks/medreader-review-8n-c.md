# Review 지침 — 8n-c 재검증 (고친 곳만, 짧게)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8n-c 재검증" 절로 덧붙인다(앞 절 불변 — 덧붙이기는 Write 로 스크래치 파일을 만든 뒤 Node 로 append, heredoc 쓰지 말 것). 스크래치패드 `r8nc/`(`r8n/`·`r8nb/` 는 읽기만 — 스크립트 재사용 가능).

## 볼 것
review.md "8n-b 재검증"(8nbR-1–10), 지침 `.claude/tasks/medreader-build-8n-c-fix.md`, 보고서 `.claude/tasks/medreader-build-8n-c-fix-report.md`(믿지 말고 다시 재라), spec 19-1-3 §5 `[정정 2026-11-16 — 8n-c]`, `git diff` 중 `js/text/lang.js`·`segment.js`·8n 테스트·말뭉치.

## 확인할 것
1. `RE_FR_TU_ES`: 네가 **새로** 지은 `tu es`·`t'es`·`t’es` 프랑스어 6개 이상이 fr·HEAD 값, 네가 새로 지은 스페인어 6개 이상(특히 `tú es`·`tu` 소유 형용사 + `es`, 예: "tu casa es…" 처럼 `tu` 와 `es` 가 붙지 않는 꼴, 그리고 `tu es` 가 우연히 붙는 스페인어 — 있으면)이 es. 대소문자(`Tu es`·`TU ES`)·줄바꿈 사이 처리.
2. 겹약어 규칙 제거(안 (나)): Build 의 측정이 맞는지 표본 일부를 다시 재고, en·fr·ko 분할 무작위 대조 0.
3. 회귀: golden sha1 불변(HEAD 모듈로 다시 만들어 대조), 무작위 대조 es 아닌 결과 바뀐 것 0(서로 다른 글로 — 같은 글을 되풀이 내는 난수 생성기 주의), 의학책 표본 HEAD 와 같음.
4. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
5. 변이 2개 이상 네가 고른 곳 → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8nc/bak/`).
6. headless 는 하지 않는다(판정·분할 함수만 바뀜).

## 판정
표(번호·심각도·내용·근거) + 마지막 줄 **배포 가능 / 고친 뒤 배포**. 낮음·정보만 남으면 "배포 가능"(남은 것은 한계로).

## 규칙
명령은 한 호출에 한 가지 일만. 프로세스 조회·디버깅 포트 찌르기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 서버 건드리지 마라. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책은 읽기만, Downloads 폴더 목록 보지 말 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8nc/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
