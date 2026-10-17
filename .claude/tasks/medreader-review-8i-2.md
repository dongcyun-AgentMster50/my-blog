# Review 지침 — 8i-2 본문 이름표 2열 표를 행 단위로 읽기

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다.
> **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` **맨 끝**에 "8i 행 표 Review" 절과 같은 꼴로 **"8i-2 Review"** 절을 덧붙인다. 앞 절은 고치지 않는다.

## 읽을 것
- spec **4-13-10**(승인 2026-10-17: D7 (가) 접음 · D8 (가) 대체 · D9 가드 없음 · D10 (가) R 없는 표에만), 4-13 전체
- Plan 보고 `.claude/tasks/medreader-plan-8i-2-report.md`, Build 지침 `-build-8i-2.md`, Build 보고 `-build-8i-2-report.md`
- 변경: `git diff`(rowtable.js · config.js · layout.js · index.html · spec.md · tests/rowtable-8i.test.mjs · tests/review6.test.mjs) + 새 `tests/rowtable-8i2.test.mjs`, `dev/measure-rowtable-8i2.mjs`·`proto-rowtable-8i2.mjs`·`rowtable-8i2-key.json`. 직전 커밋 `246e392`.

## 확인할 것
1. **spec 대로인가**: 새 규칙이 전부 R(쪽 번호 열) 없는 표 경로에만 걸리는지(D10) 코드로. 열 머리 접힘(D7), Harrison 75·542 일부 격자 → 행 읽기(D8). `REQUIRE_REF:false`·`algoVersion 12`·되돌림 주석.
2. **pdf.js 판 문제**: 스크래치패드 `pdfjs/` 가 없어져 Build 는 이 기계의 Codex 런타임 pdfjs-dist **5.6.205** 로 쟀다(앱은 CDN **5.4.149**). 너는 **브라우저(앱이 실제로 쓰는 5.4.149)** 로 판정한다 — 아래 3번. Node 측정은 Build 와 같은 5.6.205 로 다시 돌려도 되지만(Build 가 찾은 경로를 보고서에서 확인), 최종 판정은 브라우저 결과로 한다. npm 설치·다운로드는 하지 않는다.
3. **headless 브라우저** (Edge · 412px · 캐시 끔 · 흉내 음성, 8000번 서버 — `python -m http.server` 가 있으면 쓰고 끄지 마라, 없으면 레포 루트에서 같은 방식으로 띄우고 켜 둔다):
   - 새 프로필에 CMDT 2026 과 Harrison 을 열어 추출(진짜 키 금지 — 가짜 키·흉내 응답은 `shot-tool/step2.mjs` 참고). 저장본에서 **18쪽**(CMDT 45·365·484·587·810·1587–1589·1653·1658·1659·1661·1681–1683, Harrison 75·412·542)의 문단 구조를 꺼내, Node 측정(5.6.205) 결과와 같은지 비교. 21–38쪽 몇 쪽(30 포함)도 8i 와 같은지.
   - 대표 쪽(CMDT 1681 무릎 진찰표, Harrison 75 또는 542, 365)에서 **낭독 순서**: 이름표 한 덩어리 → 그 행 설명 → 다음 행, 열 머리 읽지 않음. 리플로우 화면(rowhead 굵게·행 구분선)과 원본 보기 하이라이트 상자가 맞는 칸을 덮는지. 스크린샷 몇 장(`shots-8i2/`, 스크래치패드).
   - **옛 판 → 새 판 재추출**: algoVersion 11 로 저장된 상태에서 새 앱(12)으로 열면 배너 + 재추출, 지금 쪽이 8i-1 경로로 새 판으로 바뀌는지 한 번(옛 판 프로필은 `shot-profile/` 이 10 이므로, 그 `Default/` 복사본 + `r8i1/scripts/restore-blob.mjs` 로 블롭을 되넣어 써도 된다 — 10 → 12 도 같은 경로).
4. **눈 검토**: `measure-rowtable-8i2.mjs --show`(또는 네가 쓴 출력)로 18쪽 "이름표 → 설명" 짝을 **전부** 보고, 정답표(`rowtable-8i2-key.json`)가 Plan 이 스스로 만든 것이라는 점을 감안해 **정답표 자체가 맞는지**도 판단한다. 틀린 짝이 있으면 쪽·행으로 적는다. 기준 98%.
5. **회귀**: 21–38쪽과 표 없는 쪽 바이트 동일(Build 주장) — 표본을 네 스크립트로. 글자 손실 0. 퀴즈 정답 연결 1,190.
6. **Build 남은 문제 2번(R6b 열 머리 위험)**: 머리 행 없는 2열 표에서 첫 행 이름표가 두 줄이고 첫 설명 줄이 문장 끝이 아니면 첫 행이 열 머리로 접혀 읽히지 않는다는 주장 — 합성 재현을 확인하고, 세 권 실물에 걸리는 곳이 정말 0인지, 심각도와 고칠 방향(지금 고칠지 / 다음 Plan)을 판정해 운영자 결정 사항에 올린다.
7. **테스트의 힘**: 너만의 변이 2개 이상(Build 가 안 한 곳) → 빨강 확인 → 복원 → `cmp`. 백업은 스크래치패드 `r8i2/bak/`.
8. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1063 기대), `node apps/medreader/dev/stamp-importmap.mjs --check` 0.

## 실행·디스크 규칙
- 모든 테스트·변이·측정 실행에 시간 상한(`timeout` · `--test-timeout`). 띄운 Edge·node 는 정리하고 끝에 `tasklist` 확인, 못 끄면 PID 보고.
- C: 는 지금 여유가 넉넉하다(약 158 GB). 그래도 프로필 복사본은 **모두 합쳐 3개까지**, `shot-profile/` 자체는 읽기만. 작업 폴더는 스크래치패드 `r8i2/`.
- 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고한다.

## 수정 범위
**앱 코드·테스트는 고치지 않는다**(변이는 되돌린다). 문제는 심각도·재현 절차·고칠 방향을 review.md 에 적는다. 쓰는 곳: review.md 끝 절, 스크래치패드 `r8i2/`·`shots-8i2/`.

## 금지
커밋, `git checkout/restore/stash`(HEAD 대조는 `git show HEAD:경로 > 스크래치패드`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
