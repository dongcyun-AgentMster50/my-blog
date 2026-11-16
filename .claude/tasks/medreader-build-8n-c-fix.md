# Build 지침 — 8n-c: 8n-b 재검증 지적 고치기 (작음)

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 끝 "8n-b 재검증" 절(8nbR-1–10) — 먼저 읽어라. 앞 지침 `.claude/tasks/medreader-build-8n-b-fix.md` 의 규칙·금지·수정 범위는 그대로다. 운영자 위임: 권장안으로. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8n-c-fix-report.md`. 스크래치패드 `b8nc/`(Review 의 `r8nb/` 는 읽기만 — `fr-tues.mjs`·`tues-options.mjs`·`split-es.mjs` 재사용 가능).

## 고칠 것
1. **중간 — `tu es` 프랑스어가 es 로**: Review 권고대로 es 갈래 비교에서 `tu` 바로 뒤의 `es` 는 es 쪽이 아니라 fr 쪽에 센다(**es 갈래 비교에만** — en·fr 두 갈래 비교 불변). Review 의 5문단 + 네가 새로 지은 `tu es`·`t'es` 꼴 프랑스어 4개 이상이 fr·HEAD 와 같은 score, 스페인어 묶음(Build·Review 의 `ES_NATURAL`·r8nb 8문단)은 모두 es 그대로. 테스트에 이 꼴 문단 묶음을 더한다.
2. **낮음 — 문장 끝 약어 뒤 `¿대문자`를 못 끊음**: `p. ej.`(문장 중간)와 `i. v.`·`a. m.` 등(문장 끝)은 글자만으로는 가를 수 없다. 두 안을 **같은 지은 표본(각 꼴 10개 이상)으로 재서** 틀린 수가 적은 쪽을 고른다 — (가) 겹약어 규칙을 지금처럼 둠, (나) 겹약어 규칙을 빼고 8n 판처럼 끊음(낭독에서 문장 중간에 끊기는 것은 짧은 쉼일 뿐이고, 안 끊기는 것은 긴 단위가 된다는 비용 차이도 적어라). 동률이면 (나)(규칙이 적은 쪽). 약어 목록은 늘리지 않는다. 고른 쪽의 경계를 고정하는 테스트(Review 변이 M4 가 살아남은 구멍)를 더한다.
3. **spec**: 19-1-3 §5 에 `[정정 2026-11-16 — 8n-c]` 한 줄(고친 것·숫자·고른 안·남은 한계 — `ES_MIN_WORDS=2` 의 영어 참고문헌·약물 표 꼴 es 오판(실물 0)과 대화 줄표 `—¿` 앞 안 끊김을 한계에 더함). **Edit 도구로 그 자리만.**

## 검증
- golden 픽스처 불변(sha1 — 추적 안 된 파일이니 `git diff` 가 아니라 HEAD 모듈로 다시 만들어 대조), 무작위 대조에서 es 아닌 결과 바뀐 것 0, en·fr·ko 분할 무작위 대조 0, 의학책 표본 HEAD 와 같음(Review 스크립트 재사용).
- 변이 2개 이상(1번 되돌림 → 새 `tu es` 테스트 빨강 등) → 복원(읽어서 쓰기 + `cmp`, 백업 `b8nc/bak/`).
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회, stamp 다시·`--check` 0, `git diff --check` 0.
- headless 는 하지 않아도 된다(판정 함수·분할 함수만 바뀜 — 앞 두 번의 headless 가 연결을 확인했다). 바뀐 곳이 화면·낭독 연결에 닿으면 한 번(새 프로필 `b8nc/p1`, pipe).

## 수정 범위
`js/text/lang.js`, `js/text/segment.js`, `tests/srclang-es-8n.test.mjs`, `tests/fixtures/srclang-8n-corpus.mjs`(새 묶음 추가만 — 기존 묶음·golden 은 바꾸지 마라), `index.html`(stamp), `spec.md`(§5 정정 한 줄), 스크래치패드 `b8nc/`, 보고서. 그 밖은 금지(review.md·`dev/` 포함).

## 규칙
명령은 한 호출에 한 가지 일만. 프로세스 조회·디버깅 포트 찌르기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 금지: 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
