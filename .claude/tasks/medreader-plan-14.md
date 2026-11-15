# Plan 지침 — 14 묶음: 8i-4 일반 다열 텍스트 표 · 8q 3단 본문 · 8o-2 보기 `(A)` 인식 (algoVersion 묶음)

> 너는 **Plan 서브에이전트**다. 구현하지 않는다. 앱 코드·테스트·**spec.md** 를 고치지 않는다(다른 에이전트가 spec 을 쓸 수 있다). 결과는 **초안 파일** `.claude/tasks/medreader-plan-14-spec-draft.md`(spec 에 붙여 넣을 꼴 — 새 소절, 19-1 행에 `[수정 …]` 한 줄)와 보고서 `.claude/tasks/medreader-plan-14-report.md`. **커밋하지 않는다.** 한국어로 쓴다.
> **운영자 위임(2026-11-15): 권장안으로 끝까지 진행** — 결정 표는 권장안을 분명히. 단 **무료 한도 원칙·비용·외부 전송·개인정보** 를 바꾸는 선택은 "운영자에게 물을 것"으로 따로. **실기기 확인을 기다리지 않는다.** 메모리 규칙: **책별·언어별 튜닝 금지** — 규칙은 일반이어야 한다.

## 읽을 것
19-1 표의 14 행, 19-1-1 E6(일반 다열 텍스트 표 — "14 단계 때 측정 Plan 부터, algoVersion ↑ 감수 여부는 측정 뒤"), 19-1-3 §6(8o-2 보기 `(A)` 조건부)·§9, 19-1-4 R6(3단 의심 쪽 — 8q-0 측정 계획: 세 의학책 전 쪽 `multi-gutter` 목록·갈래, CMDT 2026 약 70쪽 추정), 4절(추출 — 4-8 표 영역, 4-13 행 표, 다단 순서 `text/columns.js`), algoVersion 12 와 재추출 비용(전 책 자동 재추출 — 5,051쪽 책 시간), 8i·8i-2 Review 결과(review.md). `.claude/tasks/medreader-handoff.md`.

## 따질 것 (측정이 핵심)
1. **측정**(앱 수정 없이 — `dev/profile.mjs`·`dev/measure-*.mjs` 를 읽기 전용으로 돌리거나 스크래치패드에 측정 스크립트): 세 의학책 전 쪽에서 (a) `multi-gutter` 쪽 목록과 갈래(3단 본문 / 표 / 그림 캡션 / 기타 — 사람 판정이 필요한 것은 표본 PNG 를 스크래치패드에 렌더해 네가 보고 갈래), (b) 4-8 이 잡았지만 낭독에서 건너뛰는 일반 다열 표의 양(CMDT 2026 검색 글자의 7.8% — 재확인)과 "행 머리 → 칸 머리" 읽기 시제품의 정답률(표본 표 몇 개를 네가 직접 판정), (c) 해커스 문제집(8m 보고서 경로, 읽기만)의 보기 `(A)`~`(D)` 꼴 수와 지금 낭독이 어떻게 읽는지. 원서 문장 40자 초과 인용 금지.
2. 측정 결과로 세 갈래 각각: 할 가치(사용자 이득) 대 위험(algoVersion ↑ → 전 책 재추출, 기존 표·순서 회귀) — **넣음 / 조건부 / 넣지 않음** 권장. 넣는다면 Build 뼈대(파일·규칙·수용 기준·회귀 측정 — 세 책 전 쪽 전후 비교·변이), 세 갈래를 algoVersion 한 번에 묶을지.
3. 나누기(한 Build 2–3시간 이내 — 큰 것은 측정 Build + 규칙 Build 로), 순서(13 뒤가 원래 자리 — 파일 겹침은 `text/*`·`pdf/*` 쪽이라 앞 단계와 적을 수 있음, 확인), 크기·시간.
4. 결정 표(14-D…) — 권장안, "운영자에게 물을 것" 따로.
5. 실기기 점검 묶음.

## 규칙
읽기·측정만. 측정 스크립트는 스크래치패드 `p14/` 에서, 시간 상한(하나 10분 이내 — 5,051쪽 책은 표본 또는 나눠서), 결과는 stdout·파일. headless 가 필요하면 `try { … } finally { await browser.close() }`, 새 프로필·새 포트. **명령은 한 호출에 한 가지 일만. 프로세스 조회·디버깅 포트 찌르기 금지.** 막히면 변형을 찾지 말고 멈춰 보고. 앱 코드·테스트·spec·review.md 수정 금지. 서버 건드리지 마라(8000 은 쓰기만 — 끄지 마라). 진짜 API 키 금지. 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
