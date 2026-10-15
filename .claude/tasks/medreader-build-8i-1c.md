# Build 지침 — 8i-1c 원본 보기에서 "다시 그리는 도중 재생" 시 첫 문장을 두 번 읽는 문제

> 너는 **Build 서브에이전트**다. 운영자가 "지금 고치고 Review" 로 결정했다(2026-10-15).
> **커밋하지 않는다.** 한국어로 쓴다. 먼저 `.claude/tasks/medreader-build-8i-1.md`(원래 지침)와 `.claude/tasks/medreader-build-8i-1-report.md`(특히 "## 6. 이어서 (8i-1b)" 의 "남은 문제")를 읽어라.
> 보고는 그 보고서 끝에 **"## 7. 첫 문장 두 번 읽기 (8i-1c)"** 절로 덧붙인다. 앞 절은 고치지 않는다.

## 문제 (8i-1b 가 headless 원본 보기에서 재현)
원본 보기에서 옛 판 쪽이 새 판으로 **다시 그려지는 도중**에 재생이 시작되면, 첫 문장("Thyroid Nodules & Multinodular Goiter")이 시작 직후 끊기고 처음부터 한 번 더 나온다. 옛 읽기는 나오지 않는다.

원인(보고서 기준, 운영자 측에서 줄 위치 확인함): `js/ui/reader.js` 의 `renderPage` 가 `state.stale = isStaleRecord(rec)`(현재 790행)를 **`await paintView(token)`(834행) 앞에서** 세운다. 원본 보기는 canvas 그리기가 비동기라, 그 사이 `currentPageReady()` 가 참이 되어 speaker 가 새 `desc` 로 말을 시작한다. 그 뒤 `notifyPage({refreshed:true})`(837행) → controls 의 `reload()` 가 이미 읽던 문장을 처음부터 다시 시작한다. 리플로우는 그리기가 동기라 이 틈이 없다.

## 할 일
1. 다시 그리기(`opts.refresh`)가 **끝나기 전**(`paintView` 와 `notifyPage` 까지)에는 지금 쪽을 "준비됨"으로 보지 않게 한다. 즉 `currentPageReady()` 는 거짓, `whenCurrentPageReady()` 는 `refreshed` 알림 **뒤**에 풀린다. 이것이 권장 방향이다.
   - 같은 효과의 더 단순한 방법이 있으면 써도 된다(예: speaker `reload()` 가 같은 쪽·같은 문장이면 다시 시작하지 않음). 고른 이유를 보고서에 적어라.
2. 대기 경로(C2: 옛 판에서 바로 재생 → 대기 → 새 판)도 같은 틈에 걸리지 않음을 확인한다.
3. 불변: 리플로우 동작, 평소(옛 판 아닌) 쪽 넘김·낭독, 8h 인용·8i 행 표, 멈춤 → 다시 재생은 그 문장 처음부터(기존 동작, 바꾸지 마라), `catchUpStale`, 줄 대응·스크롤 유지.

## 검증
- 테스트 추가(`tests/refresh-8i1.test.mjs` 에 RF19~): **비동기 paintView 를 흉내 낸** 다시 그리기 도중 재생 → 첫 문장 발화 1번만, 끊긴 발화 0. 대기 경로도 하나. 기존 테스트는 고치지 않는다.
- 변이 1개 이상: 고친 부분을 되돌리면 새 테스트가 빨강 → 복원 → `cmp`. 백업은 스크래치패드 `b8i1c/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회. `node apps/medreader/dev/stamp-importmap.mjs` 다시 찍고 `--check` 0.
- headless 원본 보기 재현 C(와 가능하면 C2) — `b8i1b/scripts/` 를 `b8i1c/scripts/` 로 복사해 쓴다. 첫 발화가 한 덩어리이고 **같은 문장이 연달아 두 번 나오지 않는지**(시작 직후 끊긴 발화 포함), "& Pseudo- 1130" 든 발화 0, 상자가 쪽 번호 칸에 닿지 않는지.
  - 원본 `shot-profile/` 에는 PDF 블롭이 없다. 8i-1b 처럼 복사본에서 `scripts/restore-blob.mjs` 로 되넣어라. `shot-profile/` 자체는 읽기만 한다.
  - 8000번 서버: 8i-1b 가 띄운 `python -m http.server 8000`(PID 34392) 이 있으면 그대로 쓰고 끄지 마라. 없으면 같은 방식으로 띄우고 켜 둔다.

## ⚠️ 디스크 규칙
C: 남은 공간 **약 2.9 GB**. 복사 전마다 `df -h /c`, **2 GB 아래면 복사하지 말고 멈춰서 보고**. 프로필은 `shot-profile/Default/` 만 복사, 새 복사본은 **모두 합쳐 2개까지**. `rm -rf` 가 막히면 변형 명령을 찾지 말고 지울 경로를 보고서에 적는다. "No space left on device" 면 즉시 멈춘다.

## 수정 범위
`apps/medreader/js/ui/reader.js`, `js/tts/speaker.js`, `js/ui/controls.js`(필요할 때만), `tests/refresh-8i1.test.mjs`, `index.html`(stamp 로만), 스크래치패드 `b8i1c/`, 보고서 끝 절. 그 밖은 건드리지 않는다.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치(`shot-tool/node_modules` 사용은 됨), `.nojekyll` 삭제, 진짜 API 키, 다운로드 폴더 나열(PDF 는 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf` 하나만), 원서 문장 40자 초과. 띄운 Edge 는 정리.
