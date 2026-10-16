# Build 지침 — 8i-3b 쪽 넘김 판정식을 순수 함수로 꺼내 테스트가 실제 코드를 쓰게

> 너는 **Build 서브에이전트**다. 8i-3 Review 권장 사항을 운영자가 승인했다(2026-10-16). 8i-3 은 커밋됨(`6594f48`, 미푸시).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8i-3b-report.md`.
> **앱 동작은 바꾸지 않는다** — 리팩터와 테스트 보강만이다.

## 배경 (`apps/medreader/review.md` 끝 "8i-3 Review" 절)
`tests/pageturn-8i3.test.mjs` 의 PT3–PT8 은 실제 `goToPageForSpeech`(`js/ui/reader.js`)가 아니라 테스트 안의 **복사본**을 돌린다. 실제 소스와 잇는 것은 문자열만 보는 PT9 뿐이다. 그래서 Review 변이 **X2**(대기 판정에서 `state.desc` 뺌 — 앱에서는 아직 추출 안 된 다음 쪽을 건너뛰는 회귀)와 **X4**(`docId` 비교 뺌)가 살아남았다.

## 할 일
1. `goToPageForSpeech` 와 `whenCurrentPageReady` 가 알림을 받을 때 쓰는 **판정식**(같은 문서·같은 쪽·`desc` 있음·`pageFresh` 등)을 `reader.js` 의 **export 순수 함수**로 꺼낸다(예: `pageReadyFor(st, docId, pageNo)` — 이름·꼴은 네 판단). 실제 코드는 이 함수를 쓴다. 판정 결과는 지금과 **완전히 같아야** 한다.
2. 테스트의 흉내(PT3–PT8 등)가 같은 함수를 **import 해서** 쓰게 바꾼다. 흉내 자체를 실제 코드로 대체할 수 있으면 더 좋다. 기존 테스트의 **기대값은 바꾸지 않는다**(판정 함수를 쓰도록 배선만 바꾼다).
3. 새 테스트: 판정식 표(자리표시자 쪽 = `desc` 없음 → 안 풀림 · 다른 문서 → 안 풀림 · 다른 쪽 → 안 풀림 · `stale`/`refreshing` → 안 풀림 · 정상 → 풀림), 그리고 쪽 넘김 흉내에서 "다음 쪽이 자리표시자면 풀리지 않고 상한까지 기다림".
4. `config.js` 의 `TTS.PAGE_POLL_MS` 삭제. 앱에서 쓰는 곳이 없음을 grep 으로 확인한 뒤 지운다. 테스트(PT2 대조용 옛 폴링 등)가 쓰는 곳은 테스트 파일 안의 지역 상수(200)로 옮긴다. PT9 의 "폴링 안 함" 검사는 그대로 의미가 있게 둔다.
5. `node apps/medreader/dev/stamp-importmap.mjs` 다시 찍고 `--check` 0.

## 검증
- **Review 변이 X2·X4 를 다시 걸어 빨강이 되는지** 확인(지금은 살아남는다) + 네 변이 1개 이상 → 복원 → `cmp`. 백업은 스크래치패드 `b8i3b/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회 — 개수는 1043 + 새 테스트. 테스트 실행은 **상한을 둬라**(`timeout` 명령 또는 `--test-timeout`) — 8i-3 Review 에서 상한 없이 돌린 변이 실행이 멈춘 채 남았다.
- headless 재현은 하지 않아도 된다(동작 불변 리팩터). 대신 `git diff js/ui/reader.js` 에서 판정 결과가 같음을 보고서에 설명한다.

## 수정 범위
`apps/medreader/js/ui/reader.js`(판정식 꺼내기만), `js/config.js`(`PAGE_POLL_MS` 한 줄), `tests/pageturn-8i3.test.mjs`·새 테스트 파일, `index.html`(stamp 로만), 스크래치패드 `b8i3b/`, 보고서. 그 밖은 건드리지 않는다.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과. 띄운 프로세스는 정리한다(못 끄면 PID 를 보고).
