# Review 지침 — 8f-3b 재검증 (고친 곳만)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8f-3b 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8f3b/`(`r8f3/`·`b8f3b/` 는 읽기만 — 하네스 재사용 가능).

## 볼 것
review.md "8f-3 Review"(8f3R-1~11), 지침 `.claude/tasks/medreader-build-8f3b-fix.md`, 보고서 `.claude/tasks/medreader-build-8f3b-fix-report.md`(믿지 말고 다시 재라), spec 17-7-6 `[정정 2026-11-16 — 8f-3b]`, `git diff`(8f-3 + 8f-3b 함께 미커밋) + 새 `tests/vocab-8f3b.test.mjs`.

## 확인할 것
1. **중간 3건 닫힘**(Review 순서 그대로 + 네가 새로 짠 순서): 삭제 대화 열고 화면 떠남(뒤로 가기·서재·리더·설정) → 돌아와 다른 항목 삭제·같은 항목 삭제·취소; 편집 대화도 같은 꼴. 미리보기 뒤 편집·삭제·새 항목 저장(시트로) → [가져오기] → 건너뜀 n·`updatedAt` 뒤로 감 0·지운 항목이 되살아나지 않는가(설계대로인가). UTF-8 아닌 파일: cp1256·cp949·UTF-16 LE/BE·Latin-1 프랑스어(é)·BOM 없는 UTF-8·잘린 UTF-8 꼬리 바이트.
2. **새 고침의 부작용**: `updatedAt = max(기기, 파일)` 이 9c 병합(`max(updatedAt, reviewedAt)`)과 어긋나지 않는가. 미래 시각 충돌의 "파일 것으로" 고름 뒤 `updatedAt ≤ 지금`. 깨진 따옴표 되감기(20번 상한)가 정상 파일에서 성능·결과를 바꾸지 않는가(5,000줄·2MB 경계). 다른 대상 언어 → 새 항목이 중복을 만들지 않는가(같은 파일 두 번 가져오기). 가로 시트 2열 격자가 ko·ar·en·fr × 360/412/915 에서 단추 48px·[닫기]와 겹침 0·세로 화면 그대로.
3. **소스 위생**: Build 가 `'\uFFFD'` 실제 글자를 이스케이프로 바꿨다 — 소스·시험 파일에 보이지 않는 글자(U+FFFD·NUL·BOM·제로폭) 새로 들어간 것 없는지(`git diff` 바이트로).
4. 회귀: 그대로 가져오기 0·0·n, 한 칸 고침 바뀜 1, 못 읽는 `updated` 충돌, 복습 필드 불변, 내보내기 바이트, 8f-2 시트·8c-1·Esc 층(앞 하네스), 번역 요청 본문 바이트 HEAD 와 같음.
5. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
6. 변이 3개 이상 네가 고른 곳(Build M1–M8 과 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8f3b/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
7. headless: Edge, pipe, 새 프로필 `r8f3b/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**, 내려받기는 스크래치로만. 콘솔 오류 0.

## 판정 기준 (기준선 = 8f-3 Review 때의 동작)
- **중간 이상**(→ "고친 뒤 배포"): 8f-3 Review 중간 3건 중 하나라도 남음, 8f-3b 가 **새로** 만든 데이터 손실·덮어쓰기·중복·회귀, 소스에 보이지 않는 글자, 콘솔 오류.
- 그 밖(실기기 확인 거리·문안·보고서가 밝힌 "고치지 않은 것")은 **낮음** → "배포 가능", 다듬기 후보로.
표(번호·심각도·내용·근거) + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프로 묶지 말 것 — 바이트 보기도 Node 스크립트로). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8f3b/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
