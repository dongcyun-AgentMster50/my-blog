# Build 보고서 — 9c-1b: 백업 키 지우개 과잉 일치 고치기 (2026-11-17)

> Build 서브에이전트. 근거 review.md "9c-1 Review" 9c1R-0~10, 지침 `.claude/tasks/medreader-build-9c1b-fix.md`(+ 앞 지침 `medreader-build-9c1-export.md` 규칙 그대로). **커밋 0.** 스크래치 `b9c1b/`(`r9c1/`·`b9c1/` 는 열지 않음). headless 0(순수 함수만).

## 1. 고친 것 — 전/후

| # | 전 | 후 |
|---|---|---|
| 1 지우개(9c1R #1) | 백업 줄 바꾸개·`hasKeyShape`(설정 행 빼기·`settings` `skip`)가 `REDACT_PATTERNS` 를 그대로 씀 → `sk-[A-Za-z0-9_-]{16,}` 가 합성어 안(`low-risk-to-moderate-risk` → `low-ri[KEY]`)·`Bearer\s+\S+` 가 낱말("Bearer of …" → `[KEY] …`)을 지움. 검색어 하나가 걸리면 `search.recent` 행째 빠짐 | 백업 전용 `BACKUP.KEY_PATTERNS`(`js/config.js`): Google 꼴 `KEY_SHAPES.GOOGLE_AIZA`·`GOOGLE_AQ` **그대로** · `(?<![A-Za-z0-9\-])sk-[A-Za-z0-9_\-]{20,}`(왼쪽 경계 + 몸통 20자) · `Bearer\s+(?=[A-Za-z0-9._~+/=\-]*[0-9])[A-Za-z0-9._~+/=\-]{12,}`(토큰 글자 집합 RFC 6750 b64token · 12자 이상 · 숫자 하나 이상 = 낱말 아님). `text/backup.js` 의 `KEY_RE`·`KEY_TEST` 가 이것으로 만들어짐(import 에서 `REDACT_PATTERNS` 뺌) |
| 1 후반 term 병합 | `mergeTerm` 이 `importPlan`(CSV) 규칙 "시각 같음 = 파일" 그대로 → 같은 기기 왕복에서 내용이 다르면(옛 지우개 `[KEY]`) 기기 글자를 덮고 `updatedAt` 을 지금으로 | 파일 `updatedAt` = 기기 `updatedAt`(ms 로 읽히는 값)이면 `importPlan` 을 부르지 않고 내용은 **기기 유지**(복습 필드 갈래는 그대로). `importPlan` 자체·CSV 가져오기는 무변 |
| 2 spec ⑦ | "압축 단계 전체 최댓값 = 데이터 크기와 무관한 V8 문턱 몫" | 17-4-1 9c-1 Build 정정 묶음 바로 아래 `[정정 2026-11-17 — 9c-1b]` 한 줄: Review 실측(¼ +41 · ½ +59 · 전체 +124MB, gc 뒤 0) → **평문(캐시) 크기에 비례**, (가)(나) 기준 그대로, 실기기 `[M]` 에 "상한을 올린 사용자". 같은 줄에 지우개·term 동률 바뀐 규칙도 |
| 6 13절 | 백업 파일 행 "`privacy.*`·`dev.*` 없음" | 같은 자리 괄호 안에 `[정정 2026-11-17 — 9c-1b]` 예외 하나 `privacy.piiCheck`(사용자 선호)는 담음 |

나머지(#3·#4·#5·#7·#8·#9)는 crossstep "다음 다듬기 묶음 후보"에 9c-1 줄 하나로, #10(+#3 의 가져오기 쪽 속성 이름 검사)은 **9c-2** 줄로 덧붙임.

## 2. `REDACT_PATTERNS` — 건드리지 않음 (이유·영향)

쓰는 곳 전부: `js/privacy/redact.js`(`buildPatterns` — 모든 `console.*`·오류 토스트·오류 리포트·`ProviderError` 를 지움, 13절) · `tests/key-shape-p1.test.mjs`(Google 꼴이 들어 있는지) · (전에는) `js/text/backup.js`. `dev/tashkeel-make.mjs` 는 `KEY_SHAPES` 만. `redact.js` 는 오류 객체·헤더 글자처럼 **짧은 토큰**(`Bearer abc`)이나 경계 없는 꼴까지 지워야 하고, 넓을수록 안전하며 사용자 글자를 영구히 바꾸지 않는다 → 좁히면 **로그 쪽 동작이 바뀐다**. 그래서 지침대로 백업 전용 패턴을 따로 두었다. `REDACT_PATTERNS` 무변 → 그것을 쓰는 시험 전부 그대로 초록(전체 1703).

## 3. 시험 (`tests/backup-9c.test.mjs`)

- **K4b 새로**(한 줄씩): 그대로 남는 글 — `low-risk-to-moderate-risk-group patients` · `risk-benefit-assessment-and-follow-up` · `the Bearer of the results` · `Bearer responsibilities apply` · `pip install sk-learn` · `task-sk-1234567890abcdef` · `mask-1234567890abcdefghij` · `recLine`→`parseLine` 왕복 문맥 그대로 · `search.recent`(합성어·"Bearer of"·sk-learn) 행 남음 / 키 하나 끼면 행째 빠짐 · 같은 기기 왕복 term → `keep`(9c1R-3 표본). 지우는 쪽 — 가짜 키 넷(`AQ.`·`AIza`·`sk-`·`sk-proj-`)이 문장 안·따옴표 옆·`key=` 뒤에서 `[KEY]`, `Bearer fake.token.9c1`·`Bearer⇥eyJ…` → `[KEY]`. 로그 `REDACT_PATTERNS` 는 넓은 그대로·Google 꼴은 백업 목록에 그대로.
- **K10f 한 줄**: 시각 같고 내용 다름(`context: 'c [KEY]'`) → `keep`.
- **K4(키 0건)·K5(정적 import) 무변·초록** — K4 의 `REDACT_PATTERNS` 0 · `KEY_SHAPES` 0 검사도 그대로.

## 4. 변이 (`b9c1b/mut.mjs` — 원본을 읽어 `b9c1b/bak/` 에 쓰고, 정확히 1곳일 때만 바꿔 backup-9c 시험 → finally 원본 바이트로 되씀 → bak 과 바이트 비교. 끝에 `cmp` 두 파일 0)

| # | 변이 | 빨강 | 복원 |
|---|---|---|---|
| M1 | `sk-` 왼쪽 경계 빼기 | K4b | 같음 |
| M2 | term 시각 같음 → 파일(`sameTime = false`) | K10f | 같음 |
| M3 | `Bearer` 토큰 숫자 조건 빼기 | K4b | 같음 |
| M4 | 백업 패턴에서 Google `AQ.` 꼴 빼기 | K4 (+K4b·K10a) | 같음 |

4/4 빨강. `cmp js/config.js bak/M1-js_config.js` 0 · `cmp js/text/backup.js bak/M2-js_text_backup.js` 0.

## 5. 검증

- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` **1회차 1703/1703(10.1초) · 2회차 1703/1703(10.0초)**(`b9c1b/full1.txt`·`full2.txt` — 9c-1 의 1702 + K4b 1).
- `stamp-importmap` 다시 찍음(config.js·backup.js 해시) → `--check` "그대로다 (모듈 78개 · CSS 4개)" · `git diff --check` 0 · 새 파일(`text/backup.js`·시험) 끝 공백 0.

## 6. 남은 것 · 판단

- `sk-` 는 지침대로 경계·글자 집합·길이만 — 낱말 **처음**에서 시작하는 20자 넘는 `sk-` 합성어(예: 지어낸 `sk-learn-compatible-pipelines`)는 여전히 지운다(의학 글에서 드묾). 숫자 조건을 `sk-` 에도 걸면 막을 수 있으나 숫자 없는 진짜 키(확률 무시할 만)와 맞바꿈 — 하지 않음, 기록만.
- `Bearer` 토큰이 숫자 없는 12자 이상 글자면 지우지 않는다(진짜 토큰이 숫자가 없을 확률은 무시할 만, 로그 지우개는 넓은 그대로).
- 정규식 뒤돌아보기(`(?<!…)`)는 `text/cite.js` 가 이미 씀 — 같은 브라우저 범위.
- 이미 9c-1 판으로 만든 백업 파일 속 `[KEY]` 글자는 되돌릴 수 없지만, 같은 기기에 다시 가져오면 term 은 시각 같음 = 기기라 덮지 않는다.

## 7. 실행 · 정리

명령은 한 호출에 한 가지(`cd … &&`·파이프·`; echo` 0). **막힌 명령 0.** 서버 0 · headless 0 · 프로세스 조회 0 · 진짜 키 0 · npm·다운로드 0 · 커밋 0 · `git checkout/restore/stash` 0 · `rm` 0 · `.nojekyll` 그대로 · `G:`·`D:/OCR` 무관.

바꾼 파일: `apps/medreader/js/config.js`(`BACKUP.KEY_PATTERNS`) · `apps/medreader/js/text/backup.js` · `apps/medreader/tests/backup-9c.test.mjs` · `apps/medreader/index.html`(stamp) · `apps/medreader/spec.md`(두 곳) · `.claude/tasks/medreader-crossstep-notes.md`(줄 둘 덧붙임). 스크래치 `b9c1b/`: `mut.mjs`·`mut.json`·`m-M1`–`m-M4.txt`·`bak/`·`t-backup.txt`·`full1.txt`·`full2.txt`.
