# Build 지침 — 8n-d: 프랑스어 `es` 겹침을 뿌리에서 (작음)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "8n-c 재검증" 절(8ncR-1–7) — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-8n-c-fix.md` 의 규칙·금지·수정 범위는 그대로다. 운영자 위임: 권장안으로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8n-d-fix-report.md`. 스크래치패드 `b8nd/`(`r8n/`·`r8nb/`·`r8nc/`·`b8nb/`·`b8nc/` 는 읽기만 — 말뭉치·스크립트 재사용 가능).

## 배경
8n-b·8n-c 재검증이 같은 원인을 두 번 짚었다: es 기능어 `es` 가 프랑스어 동사 `es`(`tu es`·`es-tu`·`tu n'es`·`tu en es`…)와 겹친다. 꼴을 하나씩 더하는 고침(8n-c 의 `RE_FR_TU_ES`)은 다음 꼴에서 또 샌다.

## 할 일
1. 두 안을 **같은 말뭉치 전부**(모든 앞 Review·Build 의 스페인어·프랑스어 문단 + `ES_NATURAL`·`FR_NATURAL`·`FR_TUES`·`ES_TU`·`ES` + r8nc 의 `es-tu`·`n'es`·`en/y es` 5문단 + 네가 새로 지은 짧은 스페인어 6·프랑스어 6)으로 재서 고른다:
   - **(A) 뿌리**: es 기능어 묶음에서 `es` 를 빼고(`el·los·las·del·por·para·con·una·lo` 9개) `RE_FR_TU_ES` 규칙을 지운다. `ES_MIN_WORDS` 는 다시 맞춘다(2 그대로가 맞는지 실측).
   - **(B) 꼴 넓히기**: Review 권고대로 `RE_FR_TU_ES` 에 `es-tu`·`n'es`·`tu en/y es` 를 더한다.
   - 기준: 프랑스어 오판 0 이 먼저, 그다음 스페인어 적중 수, 동률이면 규칙이 적은 (A). 표로 보고.
2. 고른 안을 넣고 테스트: r8nc 의 프랑스어 꼴 묶음을 말뭉치 끝에 더한다(기존 묶음 글자 그대로). (B)를 고르면 Review 정보-2 의 경계(왼쪽·오른쪽) 테스트를 더하고, (A)를 고르면 N15 등 `RE_FR_TU_ES` 에 묶인 테스트를 새 규칙에 맞게 바꾸되 **프랑스어 `tu es` 묶음 기대(fr)는 그대로 지킨다**. N13 score 고정값은 새 묶음에 맞게 다시 고정(바꾼 이유를 보고서에).
3. spec 19-1-3 §5 에 `[정정 2026-11-16 — 8n-d]` 한 줄(고른 안·숫자·한계) — Edit 로 그 자리만.

## 검증
golden sha1 불변(HEAD 모듈로 다시 만들어 대조), 서로 다른 무작위 글 5만에서 es 아닌 결과 바뀐 것 0, en·fr·ko 분할 대조 0(분할은 바꾸지 않는다), 의학책 3권 표본 HEAD 와 같음·es 0. 변이 2개 이상 → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `b8nd/bak/`). 전체 `node --test apps/medreader/tests/*.test.mjs` 2회, stamp 다시·`--check` 0, `git diff --check` 0. headless 는 하지 않는다.

## 수정 범위
`js/text/lang.js`, `tests/srclang-es-8n.test.mjs`, `tests/fixtures/srclang-8n-corpus.mjs`(덧붙이기만 — 기존 묶음·golden 불변), `index.html`(stamp), `spec.md`(§5 한 줄), 스크래치패드 `b8nd/`, 보고서. `segment.js` 포함 그 밖은 금지.

## 규칙
명령은 한 호출에 한 가지 일만. 프로세스 조회·디버깅 포트 찌르기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 서버 건드리지 마라. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책은 읽기만, Downloads 목록 보지 말 것. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
