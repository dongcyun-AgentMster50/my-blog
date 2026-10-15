# Build 지침 — 8i-3 원본 보기 쪽 넘김 때 다음 쪽 첫 문장을 두 번 읽는 문제

> 너는 **Build 서브에이전트**다. 운영자가 (가) 방식으로 고치기로 결정했다(2026-10-15). 8i-1 은 커밋됨(`51815bc`, 미푸시).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8i-3-report.md`.
> (번호: 8i-2 는 spec 4-13-9 에서 "본문 이름표 2열 표"로 이미 잡혀 있어 이것은 8i-3 이다.)

## 문제 (8i-1 Review 가 headless 로 재현 — `apps/medreader/review.md` 끝 "8i-1 Review" 절)
원본 보기에서 쪽 끝까지 낭독해 다음 쪽으로 넘어가면, 다음 쪽 첫 문장이 시작 직후 끊기고 처음부터 한 번 더 나온다. 지금 코드에서 32쪽 2회 모두, CPU 4배 감속에선 53쪽 "Common Symptoms" 에서 재현. **8i 이전(Build 5 `c60fb04`·6b `f3f6f8c`)부터 있던 문제**다.

원인: 평소 렌더(첫 렌더·쪽 넘김)도 `renderPage` 가 `state.desc` 를 `await paintView` **앞에서** 세운다. `js/ui/reader.js` 의 `goToPageForSpeech` 는 200 ms 폴링으로 `state.page === target && state.desc && pageFresh(state)` 를 보므로, 원본 캔버스를 그리는 사이에 풀려 낭독이 시작된다. 그 뒤 `notifyPage` → controls 의 `reload()` 가 말하던 문장을 처음부터 다시 시작한다. 리플로우는 그리기가 동기라 틈이 없다.

## 할 일 (운영자 결정 (가))
1. `goToPageForSpeech` 가 **200 ms 폴링 대신 그 쪽 렌더의 `notifyPage` 알림**(그리기 완료 뒤)으로 풀리게 한다. 상한(`PAGE_WAIT_MS` 5초)·버려진 렌더·다른 쪽으로 간 경우·리더를 떠난 경우의 처리는 지금과 같은 결과여야 한다.
   - 가능하면 `whenCurrentPageReady`(8i-1c, 지금은 폴링)도 같은 알림 방식으로 맞춘다. 8i-1c 의 `refreshing` 판정은 유지한다.
   - 대가: 원본 보기 쪽 넘김 낭독이 캔버스 그리는 시간만큼 늦게 시작한다. 이는 운영자가 받아들였다. 리플로우는 늦어지지 않아야 한다(알림이 동기 그리기 직후 나간다).
2. **배선 테스트 보강** (8i-1 Review 1번, 변이 R3·R4 가 살아남음): 추출기 `page` 이벤트 → 문지기 연결, speaker 상태 → 문지기(`setSpeechState`) 연결을 묶는 테스트. RF23 처럼 소스를 읽는 방식이면 충분하다.
3. spec 4-13-9 맨 위 8i-1 줄 바로 위에 한 줄 추가: `**8i-3 (운영자 결정 2026-10-15)**: 원본 보기 쪽 넘김 낭독은 다음 쪽 그리기 완료 알림을 받고 시작한다(200 ms 폴링 → 알림). 다음 쪽 첫 문장 중복(6b 부터)을 없앤다. 대가로 원본 보기 쪽 넘김 시작이 그리기 시간만큼 늦다.`
4. 불변: 리플로우 쪽 넘김 낭독, 8i-1/8i-1c 동작(RF1–RF23), 8h 인용, 8i 행 표, 멈춤 → 재생은 그 문장 처음부터, 뷰 전환·원문 언어 변경 때 `reload()`.

## 읽을 것
review.md 끝 "8i-1 Review"(8i1R 절들, 재현 로그 경로), `.claude/tasks/medreader-build-8i-1-report.md` 7절, `js/ui/reader.js`(`goToPageForSpeech`·`whenCurrentPageReady`·`renderPage`·`notifyPage`·`onPageRender`), `js/ui/controls.js`, `js/tts/speaker.js`, `js/config.js`. 재현 스크립트는 스크래치패드 `r8i1/scripts/`(Review 의 쪽 넘김 재현 `rv-TURN` 계열)와 `r8i1/scripts/restore-blob.mjs`(서재 목록 대기 들어간 판)를 참고.

## 검증
- 테스트(새 파일 `tests/pageturn-8i3.test.mjs` 또는 `refresh-8i1.test.mjs` 에 이어서): 비동기 paintView 흉내로 쪽 넘김 → 다음 쪽 첫 문장 발화 1번, 끊긴 발화 0 · 상한 · 버려진 렌더 · 리플로우는 지연 없음. 기존 테스트는 고치지 않는다.
- 변이 2개 이상(폴링으로 되돌림 → 빨강 등) → 복원 → `cmp`. 백업은 스크래치패드 `b8i3/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회. `node apps/medreader/dev/stamp-importmap.mjs` 다시 찍고 `--check` 0.
- headless (Edge · 412px · 캐시 끔 · 흉내 음성): **원본 보기 쪽 넘김**(Review 가 재현한 32쪽 → 다음 쪽, 가능하면 CPU 4배 감속으로 한 번 더) — 다음 쪽 첫 문장 연속 0. 리플로우 쪽 넘김 한 번(지연 없음). 8i-1 B 또는 C2 하나로 회귀 확인.
  - 원본 `shot-profile/` 에는 PDF 블롭이 없다. 복사본에 `r8i1/scripts/restore-blob.mjs` 로 되넣는다. `shot-profile/` 자체는 읽기만 한다.
  - 8000번 서버(`python -m http.server`, PID 34392)가 있으면 쓰고 끄지 마라. 없으면 레포 루트에서 같은 방식으로 띄우고 켜 둔다.

## ⚠️ 디스크 규칙
C: 남은 공간 **약 2.9 GB**. 복사 전마다 `df -h /c`, **2 GB 아래면 복사하지 말고 멈춰서 보고**. 프로필은 `shot-profile/Default/` 만 복사(스크래치패드 `b8i3/pN/Default/`), 새 복사본은 **모두 합쳐 2개까지**. 쪽 넘김 재현은 재추출이 끝난 복사본으로도 할 수 있으니 같은 복사본을 다시 써라. `rm -rf` 가 막히면 변형 명령을 찾지 말고 지울 경로를 보고서에 적는다. "No space left on device" 면 즉시 멈춘다.

## 수정 범위
`apps/medreader/js/ui/reader.js`, `js/ui/controls.js`·`js/tts/speaker.js`(필요할 때만), `apps/medreader/tests/`(새 테스트), `index.html`(stamp 로만), `spec.md`(위 한 줄만), 스크래치패드 `b8i3/`, 보고서. 그 밖은 건드리지 않는다.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치(`shot-tool/node_modules` 사용은 됨), `.nojekyll` 삭제, 진짜 API 키, 다운로드 폴더 나열(PDF 는 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` 하나만), 원서 문장 40자 초과. 띄운 Edge 는 정리.
