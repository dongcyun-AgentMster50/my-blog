# Review 지침 — 8n-d 재검증 (짧게, 마지막)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8n-d 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8nd/`(앞 `r8n*`·`b8n*` 은 읽기만).

## 볼 것
review.md "8n-c 재검증"(8ncR-1–7), 지침 `.claude/tasks/medreader-build-8n-d-fix.md`, 보고서 `.claude/tasks/medreader-build-8n-d-fix-report.md`(믿지 말고 다시 재라 — 특히 Build 가 결정에 쓴 "어려운 꼴" 묶음이 A 쪽에 유리하게 지어졌을 수 있다), spec 19-1-3 §5 `[정정 2026-11-16 — 8n-d]`, `git diff` 의 `js/text/lang.js`·8n 테스트·말뭉치.

## 확인할 것
1. **프랑스어 → es 오판 0**: 네가 새로 지은 짧은 프랑스어 10개 이상 — `être` 꼴(`tu es`·`es-tu`·`n'es`·`t'en es`·`qui es`), 그리고 **스페인어 고유명사가 든 프랑스어·영어 글**(`Los Angeles`·`El Niño`·`del Rio`·`Las Vegas`·`Por favor` 인용, 저자명 `Del Rio C`·`Con A` 꼴 참고문헌) — 이 묶음이 HEAD 값과 같은가. 보고서 한계 2(무작위 섞음에서 fr/en → es 958건)가 실제 글 꼴에서도 나오는지.
2. **스페인어 적중**: 네가 새로 지은 짧은 스페인어 10개 이상(`la` 많은 글, 대명사 `le` 많은 글 포함)에서 몇 개가 es 인가 — 놓친 것이 HEAD 값으로 떨어지는지(새 오판이 아닌지).
3. 회귀: golden sha1 불변, 서로 다른 무작위 글 5만에서 es 아닌 결과 HEAD 와 다른 것 0, en·fr·ko 분할 0, 의학책 3권 표본 HEAD 와 같음.
4. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
5. 변이 2개 이상 네가 고른 곳 → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8nd/bak/`).
6. headless 하지 않는다.

## 판정 기준 (이번이 마지막 재검증)
- **높음·중간**: 프랑스어·영어(지원 언어) 실제 글 꼴이 HEAD 와 달리 es 로 가는 것, 또는 회귀. → "고친 뒤 배포".
- 스페인어를 놓쳐 HEAD 값으로 떨어지는 것, 지원 밖 언어의 오판, 무작위 낱말 섞음에서만 나오는 것은 **낮음**(한계로 기록) → "배포 가능".
표(번호·심각도·내용·근거) + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만. 프로세스 조회·디버깅 포트 찌르기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 서버 건드리지 마라. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책은 읽기만, Downloads 목록 보지 말 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8nd/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
