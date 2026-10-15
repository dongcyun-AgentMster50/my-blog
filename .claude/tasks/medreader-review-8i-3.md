# Review 지침 — 8i-3 (원본 보기 쪽 넘김 첫 문장 중복: 폴링 → 그리기 완료 알림)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다.
> **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` **맨 끝**에 "8i-1 Review" 절과 같은 꼴로 **"8i-3 Review"** 절을 덧붙인다. 앞 절은 고치지 않는다.

## 읽을 것
- 지침 `.claude/tasks/medreader-build-8i-3.md`, Build 보고 `.claude/tasks/medreader-build-8i-3-report.md`
- review.md 끝 "8i-1 Review"(이 문제를 처음 재현한 절차·로그)
- 변경: `git diff`(reader.js · index.html · spec.md) + 새 `tests/pageturn-8i3.test.mjs`. 8i-1 은 커밋 `51815bc`.

## 확인할 것
1. **고쳐졌는가**: 원본 보기에서 쪽 끝까지 낭독 → 다음 쪽 첫 문장이 1번만, 끊긴 발화 0. 8i-1 Review 가 재현한 32쪽과 CPU 4배 감속(53쪽 "Common Symptoms" 근처)을 **네 스크립트로** 다시. 가능하면 대조로 HEAD 의 `reader.js` 에서 재현되는 것도 한 번.
2. **불변·회귀**: 리플로우 쪽 넘김 낭독이 늦어지지 않음(앞 쪽 끝 → 다음 쪽 첫 발화 시간) · 8i-1 B 또는 C2(옛 판 쪽 재생 → 새 판 첫 발화 한 덩어리, "& Pseudo- 1130" 0) · 멈춤 → 재생은 그 문장 처음부터 · 뷰 전환·원문 언어 변경 때 `reload()` · 8h 인용 · 8i 행 표.
3. **코드 문제**: `createRenderDone` 의 대기열이 새는 경우(버려진 렌더·상한·`leaveReader`·연속 쪽 넘김), 알림이 안 와서 5초 상한까지 멈추는 갈래(저장본 없음·깨짐·db 오류·같은 쪽 재렌더), `go` 전에 대기를 거는 순서, 8i-1c `refreshing` 과의 순서, 빠른 연속 쪽 넘김·쪽 이동 버튼과 겹칠 때. Build 보고 "남은 문제" 2·3번 판정. `TTS.PAGE_POLL_MS` 가 정말 안 쓰이는지.
4. **테스트의 힘**: PT1–PT11 이 실제 동작을 묶는가. PT9 가 소스 순서만 보는 점의 한계. 너만의 변이 2개 이상(Build 가 안 한 곳) → 빨강 확인 → 복원 → `cmp`.
5. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1043 기대), `node apps/medreader/dev/stamp-importmap.mjs --check` 0.
6. 스크린샷 한두 장(원본 보기 쪽 넘김 직후 다음 쪽 낭독 중) — 8i-1 Review 와 같은 자리 규칙(`shots-8i3/`).

## 재현 환경
Edge · 412px · 캐시 끔 · 흉내 음성. 원본 `shot-profile/` 에는 PDF 블롭이 없다 — 복사본에 `r8i1/scripts/restore-blob.mjs` 로 되넣는다. `shot-profile/` 자체는 읽기만 한다. 쪽 넘김 재현은 재추출이 끝난 복사본으로도 되니 **같은 복사본을 다시 써라.** 8000번 서버(`python -m http.server`, PID 34392)가 있으면 쓰고 끄지 마라. 없으면 레포 루트에서 같은 방식으로 띄우고 켜 둔다. Build 스크립트(`b8i3/scripts/`)는 참고만 하고 판정 코드는 직접 쓴다.

## ⚠️ 디스크 규칙
C: 남은 공간 **약 2.8 GB**. 복사 전마다 `df -h /c`, **2 GB 아래면 복사하지 말고 멈춰서 보고**. 프로필은 `shot-profile/Default/` 만 복사(스크래치패드 `r8i3/pN/Default/`), 새 복사본은 **모두 합쳐 2개까지**. `rm -rf` 가 막히면 변형 명령을 찾지 말고 지울 경로를 기록한다. "No space left on device" 면 즉시 멈춘다.

## 수정 범위
- **앱 코드는 고치지 않는다**(변이는 되돌린다). 문제는 심각도·재현 절차·고칠 방향을 review.md 에 적는다.
- 쓰는 곳: `apps/medreader/review.md` 끝 절, 스크린샷 폴더, 스크래치패드 `r8i3/`.

## 금지
커밋, `git checkout/restore/stash`(HEAD 대조는 `git show HEAD:경로 > 스크래치패드` 로), `rm -rf`, npm 설치(`shot-tool/node_modules` 사용은 됨), `.nojekyll` 삭제, 진짜 API 키, 다운로드 폴더 나열(PDF 는 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` 하나만), 원서 문장 40자 초과. 띄운 Edge 는 정리하고 끝에 `tasklist` 로 headless `msedge.exe` 가 없는지 확인.
