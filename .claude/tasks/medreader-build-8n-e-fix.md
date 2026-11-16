# Build 지침 — 8n-e: 대문자 고유명사 거르기 (P3) + 숫자 바로잡기 (작음)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "8n-d 재검증" 절(8ndR-1–7) — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-8n-d-fix.md` 의 규칙·금지는 그대로다. 운영자 위임: 권장안으로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8n-e-fix-report.md`. 스크래치패드 `b8ne/`(`r8nd/` 는 읽기만 — `sim.mjs`·`paras.mjs`·`eval2-sets.mjs`·`fuzz-fr.mjs` 재사용 가능).

## 할 일
1. **P3(Review 권고 그대로)**: es 갈래에서만, 대문자로 시작하는 es 기능어(`Los`·`Las`·`El`·`Del`·`Con`·`Por`·`Para`·`Una`·`Lo`)는 **바로 다음 낱말이 소문자로 시작할 때만** es 로 센다(`Los pacientes` 셈, `Los Angeles`·`Del Rio C`·`Con A` 안 셈). 다음 낱말이 없으면(글 끝) 세지 않는다. 문장 첫머리 `El paciente` 는 셈. 모두 대문자(`LOS`·`DEL`)는 지금처럼(최소량 문턱으로 이미 처리) — 바꾸면 이유를 보고서에. en·fr 두 갈래 비교 불변.
2. **숫자 바로잡기(낮음-2)**: 테스트·측정의 `atLeast200` 꼴 패딩이 200–219자 글을 두 번 이어 붙여 es 낱말 수를 늘린다. 패딩이 기능어 수를 바꾸지 않게(예: 기능어 없는 중립 문장으로 채우기) 고치고, N16 ★ 등 그 숫자에 기댄 기대값과 spec 8n-d 줄의 숫자를 바른 값으로 고친다(spec 은 8n-d 줄을 고치지 말고 새 8n-e 줄에 "8n-d 숫자 정정: 39/45 → 37/45 …" 로).
3. 테스트: Review 의 고유명사 묶음(프랑스어 일정표·프랑스어·영어 참고문헌)과 `Los pacientes` 꼴 스페인어를 말뭉치 끝에 더하고(기존 묶음 글자 그대로), 경계(다음 낱말 소문자/대문자/없음/문장 첫머리)를 고정하는 테스트.
4. spec 19-1-3 §5 에 `[정정 2026-11-16 — 8n-e]` 한 줄 — Edit 로 그 자리만.

## 검증
- Review 의 스페인어 64개에서 잃는 것 0(또는 몇 개인지), 프랑스어·영어 고유명사 글 es 0(두 언어가 진짜 섞인 글은 따로 적기), Review 문장 틀 퍼징(고유명사 10%·20%) es 비율.
- golden sha1 불변, 서로 다른 무작위 글 5만에서 es 아닌 결과 HEAD 와 다른 것 0, en·fr·ko 분할 0, 의학책 3권 표본 HEAD 와 같음·es 0.
- 변이 2개 이상(P3 끄기 → 고유명사 테스트 빨강, "다음 낱말 소문자" 를 "대문자" 로 뒤집기 → 빨강) → 복원(읽어서 쓰기 + `cmp`, 백업 `b8ne/bak/`).
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회, stamp 다시·`--check` 0, `git diff --check` 0. headless 하지 않는다.

## 수정 범위
`js/text/lang.js`, `tests/srclang-es-8n.test.mjs`, `tests/fixtures/srclang-8n-corpus.mjs`(덧붙이기 + 패딩 도우미가 여기 있으면 그것만), `index.html`(stamp), `spec.md`(§5 한 줄), 스크래치패드 `b8ne/`, 보고서. 그 밖 금지.

## 규칙
명령은 한 호출에 한 가지 일만. 프로세스 조회·디버깅 포트 찌르기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 서버 건드리지 마라. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책은 읽기만, Downloads 목록 보지 말 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
