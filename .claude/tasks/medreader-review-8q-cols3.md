# Review 지침 — 14 = 8q 3단 본문 (algoVersion 13) + 8i-4-0 측정 재확인

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8q Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\r8q\`(Build 의 `b8q/`·Plan 의 `p14/` 는 읽기만 — 도구 재사용 가능). 쓸 폴더는 먼저 만들 것.

## 볼 것
spec 4-14 전부(+ `[정정 2026-11-17 — 8q Build]`)·4-5, 지침 `.claude/tasks/medreader-build-8q-cols3.md`, 보고서 `.claude/tasks/medreader-build-8q-cols3-report.md`(믿지 말고 다시 재라), 14 Plan 보고서 `.claude/tasks/medreader-plan-14-report.md`(SciAm 경로), `git diff` + 새 파일(`tests/cols3-8q.test.mjs`·`dev/measure-cols3-8q.mjs`). 8i-4-0: `.claude/tasks/medreader-build-8i4-0-report.md`·`apps/medreader/dev/measure-table-8i4.mjs`(추적 안 됨).

## 확인할 것
1. **수용 기준 1(가장 중요) 다시**: 세 의학책 전 쪽 HEAD(41d00eb) 대 작업 트리 PageLayout JSON(`algoVersion` 뺌) 바뀐 쪽 0 — 너의 실행으로(Build 도구를 써도 되나 HEAD 사본은 새로 풀 것). 책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`(읽기만, Downloads 목록 보지 말 것). 해커스 견본도.
2. **과적합 점검(정정 규칙)**: Build 는 설계 규칙이 무작위 15쪽 중 8쪽에서 틀려 **같은 15쪽을 보며** 규칙 여럿·상수 둘을 더했다. 그 15쪽이 아닌 **새 무작위 15쪽**(같은 7권의 다른 3단 쪽 — 시드를 바꿔)과, 가능하면 **7권 밖 SciAm 2–3권**(14 Plan 보고서·spec 4-14-1 에서 경로가 보이는 범위 — 폴더 목록을 넓게 훑지 말 것, 읽기만)에서 단 순서 틀림 수를 원본 PNG 와 대조(글 옮기지 말고 단 번호·줄 수만). 정정 규칙 각각이 일반 원리(판형)인지 특정 쪽 맞춤인지 판단. 운영자 원칙: **책·언어별 튜닝 금지**.
3. **안전성**: C0 우선 — 3단 판정이 나지 않는 쪽은 바이트 같음(코드 읽기 + 합성 2단·1단 픽스처). `COL3_ENABLED=false` 로 바꾸면 전 쪽 HEAD 와 같은가(되돌림 경로 실제로 — 사본에서). 내부 표시(span 덮는 단)가 저장본·출력에 새지 않음. 끼움 판정이 `endsSentence` 에 기대는 문제(남은 1) — 비라틴(아랍어 3단 합성 쪽)에서 어떤 손해인지.
4. **수용 기준 2·3 다시**: 3단 판정 쪽 수 115±10, 표 글자 비율 ≤10%, 잃은 글자 0, 원본 보기 하이라이트 단 안.
5. **재추출(algoVersion 13)**: headless 로 12 저장본 → 13 쪽 우선·재개, 의학책 낭독 단위·번역 요청 본문 바이트 HEAD 와 같음, 콘솔 오류 0. 저장된 번역·요약·카드(쪽·줄 id 로 걸린 것)가 의학책에서 그대로 붙는가(줄 id 불변).
6. **성능**: 의학책 쪽당 +0.1ms 미만, SciAm 3단 쪽 처리 시간(단독 실행으로 — 병렬 잡음 없이).
7. **8i-4-0 측정 재확인**: `measure-table-8i4.mjs` 를 다시 돌려(또는 코드를 읽어) 보고서 숫자(행 74.2%·칸 73.9%·머리 74.1%, 정밀도 100%)와 "문턱 못 넘음 → 8i-4 넣지 않음" 결론이 맞는가, 이 파일을 레포에 넣어도 되는가(원서 글·정답표 JSON 이 안에 없음 — grep, 경로 하드코딩 개인 정보).
8. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0. 고정값 12→13 만 바꾼 기존 시험 셋이 정말 그것만 바뀌었나(바이트 diff).
9. 변이 3개 이상 네가 고른 곳(Build M1–M11 과 다르게 — C0 우선 경로 하나 포함) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8q/bak/`).

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 의학책·해커스에서 바뀐 쪽 ≥1, 되돌림 경로가 HEAD 와 다름, 새 표본에서 단 순서 틀림이 Build 15쪽보다 뚜렷이 많음(과적합 — 15쪽 중 3쪽 이상 단 순서 틀림), 글자 잃음, 재추출 멈춤·저장물 떨어짐, 콘솔 오류, 원서 글이 레포 파일에 들어감, 테스트 파일 손상.
- **낮음**(→ "배포 가능"): 쪽 구성 한계(기사 경계 괘선 등)·비라틴 끼움 기록·실기기 확인 거리·문안.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`(큰 책은 쪽 범위를 나눔), **측정은 단독으로**(병렬 금지). 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지(가로채기). 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만, pdf.js(Node) `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 원서 글은 옮기지 말 것(숫자만). 수정 범위: `review.md` 끝 절, 스크래치패드 `r8q/` 만. 금지: 앱 코드·테스트·spec·`dev/` 수정, 커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
