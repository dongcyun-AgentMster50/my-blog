# Review 지침 — 8i-3b (쪽 넘김 판정식 순수 함수로 꺼내기 · 테스트 보강 · PAGE_POLL_MS 삭제)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다.
> **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` **맨 끝**에 "8i-3 Review" 절과 같은 꼴로 **"8i-3b Review"** 절을 덧붙인다(짧게). 앞 절은 고치지 않는다.

## 읽을 것
지침 `.claude/tasks/medreader-build-8i-3b.md`, Build 보고 `.claude/tasks/medreader-build-8i-3b-report.md`, review.md 끝 "8i-3 Review"(X2·X4 가 살아남은 근거). 변경: `git diff`(reader.js · config.js · index.html · tests/pageturn-8i3.test.mjs). 직전 커밋 `6594f48`.

## 확인할 것
1. **동작 불변**: `git diff js/ui/reader.js` 를 줄 단위로 읽고, `goToPageForSpeech` · `whenCurrentPageReady` 의 판정 결과(참·거짓·미정, 예외 갈래 포함)가 커밋 `6594f48` 과 모든 경우에 같은지. 가능하면 `git show 6594f48:apps/medreader/js/ui/reader.js` 를 스크래치패드에 꺼내 옛 판정식과 새 함수를 같은 입력 표로 돌려 비교하는 작은 스크립트를 직접 쓴다.
2. **테스트의 힘**: X2·X4 를 네 손으로 다시 걸어 빨강인지. 너만의 변이 2개 이상(Build 가 안 한 곳) → 빨강 확인 → 복원 → `cmp`. 백업은 스크래치패드 `r8i3b/bak/`.
3. **기대값을 바꾸지 않았는가**: `git diff tests/pageturn-8i3.test.mjs` 에서 기존 PT 의 assert 기대값이 약해지거나 바뀐 곳이 없는지. PT9 검사를 옮긴 것이 더 약해지지 않았는지.
4. `PAGE_POLL_MS`: 앱·테스트에 남은 참조(`review.md` 기록 제외)가 없는지, 지운 것이 다른 곳(dev 도구 등)을 깨지 않는지 grep.
5. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1048 기대), `node apps/medreader/dev/stamp-importmap.mjs --check` 0.
6. headless 재현은 하지 않는다(동작 불변 리팩터). 1번에서 판정이 다르게 나오면 그때만 원본 보기 쪽 넘김 한 번을 돌리고, 프로필은 `shot-profile/Default/` 만 1개 복사한다(`df -h /c` 2 GB 아래면 하지 않음).

## 실행 상한
모든 테스트·변이 실행에 시간 상한(`timeout` · `--test-timeout`)을 둔다. 띄운 프로세스는 정리하고, 못 끄면 PID 를 보고한다.

## 수정 범위
**앱 코드·테스트는 고치지 않는다**(변이는 되돌린다). 쓰는 곳: review.md 끝 절, 스크래치패드 `r8i3b/`.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과.
