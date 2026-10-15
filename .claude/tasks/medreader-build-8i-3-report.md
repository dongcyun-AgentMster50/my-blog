# Build 보고 — 8i-3 원본 보기 쪽 넘김 때 다음 쪽 첫 문장을 두 번 읽는 문제 (2026-10-15)

> 지침: `.claude/tasks/medreader-build-8i-3.md`(운영자 결정 (가)). 커밋하지 않았다. 진짜 API 키 없음. 원서 인용은 모두 40자 이하.
> 작업 폴더: 스크래치패드 `b8i3/` — 수정 전 원본 `orig/`(reader·controls·speaker), 고친 판 백업 `bak/`, 스크립트 `scripts/`, 변이 출력 `mut/`, 로그 `rv-*.log`, 캡처 `shots/`.
> 8000번 서버(PID 34392)는 그대로 쓰고 끄지 않았다.

## 1. 고친 방법 — `js/ui/reader.js` 만 (controls·speaker 는 `orig/` 와 바이트 단위로 같다)

- **렌더 끝 알림 `renderDone`** — 새 순수 팩토리 `createRenderDone(clock)`(export, 테스트가 고정)와 모듈 인스턴스 하나.
  `wait(check, ms)`: 알림마다 `check(info)` 를 부른다. true → 참, false → 거짓으로 풀고, undefined 면 계속 기다린다. 상한 `ms` 뒤 거짓(대기열에서 빠짐). `settled(info)`: 기다리는 것을 모두 한 번씩 판정.
- **`renderPage` 가 알린다** — 그리기(`await paintView`) → `notifyPage`(controls `reload()`) → `finally` 의 `refreshing` 내림 **뒤에**, 이 렌더가 마지막 렌더일 때만 `renderDone.settled({docId, page})`. 버려진 렌더는 알리지 않는다. 저장본 없음(자리표시자)·깨진 저장본·db 오류(마지막 렌더일 때) 갈래도 끝에서 알린다(폴링이 보던 상태 그대로 판정되게). `leaveReader` 도 상태를 비운 뒤 알린다.
- **`goToPageForSpeech`** — 200 ms 폴링을 없애고 `renderDone.wait` 로. 판정: 알린 렌더가 `target` 쪽(같은 문서)이고 `state.page === target && state.desc && pageFresh(state)` 이면 참. 상한 `TTS.PAGE_WAIT_MS`(5초) 그대로. 대기를 `go(readerHash(...))` **앞에서** 건다. 즉시 판정(이미 그 쪽이면 참)은 그대로.
- **`whenCurrentPageReady`**(8i-1c)도 같은 알림으로 — 다른 쪽·문서면 false, `pageFresh(state)` 면 true, 상한 `FRESH_WAIT_MS` 그대로. `refreshing` 판정은 손대지 않았다(다시 그리기의 `finally` 가 내린 뒤에 알림이 나가므로 `refreshed` 뒤에 풀린다).
- 결과 순서: 원본 보기 쪽 넘김 = canvas 다 그림 → `reload()`(speaker 는 `waiting-page` 라 큐만 갈고 재시작 안 함) → 알림 → speaker 가 새 큐 첫 발화. 끊길 발화가 없다. 8i1R-4 #8(새 쪽 db 읽기 사이 앞 쪽 `desc` 로 풀림)도 "그 쪽 렌더의 끝"만 보므로 함께 없어진다.
- 같은 결과 유지: 상한 → false(`TTS_PAGE_TIMEOUT`, paused) · 버려진 렌더 → 풀지 않음(마지막 렌더가 품) · 다른 쪽으로 감 → 그 렌더 끝은 무시 → 상한 뒤 false(폴링도 같은 값) · 리더 떠남 → 쪽 넘김은 `desc` 없음이라 상한 뒤 false, 새 판 대기는 떠난 순간 상태로 판정(폴링과 같은 값 — speaker 는 이미 멈춰 결과를 버린다).
- `spec.md` 4-13-9 맨 위(8i-1 줄 바로 위)에 지침의 8i-3 줄 그대로 한 줄 추가. `index.html` 은 stamp 로만(reader.js 해시 한 줄).
- `config.js` 의 `TTS.PAGE_POLL_MS` 는 이제 앱에서 쓰지 않는다(범위 밖이라 그대로 둠 — 새 테스트의 대조용 폴링 흉내가 읽는다).

## 2. 새 테스트 — `apps/medreader/tests/pageturn-8i3.test.mjs` (12개, 기존 테스트는 고치지 않음)

리더 `renderPage` 는 DOM·db 에 묶여 node 에서 돌릴 수 없어, 실제 `createRenderDone`·실제 speaker 와 **같은 순서의 리더 흉내**(비동기 canvas 는 테스트가 끝냄)로 동작을 묶고, 실제 소스가 그 순서인지는 PT9 가 소스로 묶는다(RF23 방식).

| | 내용 |
|---|---|
| PT1 | `createRenderDone` — true/false/undefined 판정, 던지면 거짓, 상한 뒤 거짓·대기열 비움, 풀린 뒤 알림 무시 |
| PT2 | 대조 — 같은 흉내를 **옛 폴링 판**으로 돌리면 다음 쪽 첫 문장이 끊기고 연달아 두 번(버그 재현) |
| PT3 ★ | 원본 보기 쪽 넘김 — 그리는 동안(폴링 틱 5번 넘겨도) 발화 0·`waiting-page` → 그리기 끝 → 다음 쪽 첫 문장 1번, **끊긴 발화 0**, 같은 문장 연속 0 |
| PT4 ★ | 리플로우 쪽 넘김 — 가짜 시계를 한 틱도 돌리지 않고 다음 쪽 첫 문장(지연 없음). 대조: 폴링 판은 200 ms 틱 전엔 풀리지 않음 |
| PT5 | 상한 — 5초 안에 그리기가 안 끝나면 paused + `TTS_PAGE_TIMEOUT`, 뒤늦은 그리기는 낭독을 시작하지 않음 |
| PT6 | 버려진 렌더 — 앞 렌더 끝에선 안 풀리고 마지막 렌더 끝에 1번, 끊긴 발화 0 |
| PT7 | 다른 쪽으로 감 → 그 렌더 끝 무시 → 상한 뒤 paused · 리더 떠남 → 쪽 넘김은 상한 뒤 false |
| PT8 | 8i-1 — 다음 쪽이 옛 판이면 평소 렌더 끝에 안 풀림 → 새 판 다시 그리기 도중에도 안 풀림 → `refreshing` 내린 뒤 1번, 옛 읽기 0 |
| PT8b | `whenCurrentPageReady` 흉내 — 다시 그리기 끝에 true, 다른 쪽 렌더 끝에 false, 떠나면 그때 상태(true, 폴링과 같은 값) |
| PT9 ★ | 리더 소스 — `goToPageForSpeech`·`whenCurrentPageReady` 에 `setInterval`/`PAGE_POLL_MS` 없음, `renderDone.wait`, 대기가 `go(` 앞, `r.page !== target`. `renderPage`: `desc` < `paintView` < `notifyPage` < `finally` < `refreshing` 내림 < 토큰 검사 붙은 알림, 알림 4곳, 버려진 렌더 return 줄엔 알림 없음. `leaveReader` 는 비운 뒤 알림 |
| PT10 ★ | **배선 R3** — `wireExtractor` 의 `onPage` 가 `refreshGate.saved(docId, Number(e.detail.pageNo))`(자리표시자 갈래 뒤), `ex.addEventListener('page', onPage)`, `catchUpStale()` |
| PT11 ★ | **배선 R4** — controls `statechange` 구독자가 `setSpeechState(speaker.getState())`, reader 에서 import, `setSpeechState` → `refreshGate.speech(st)`; `goToPage: goToPageForSpeech`·`whenReady → whenCurrentPageReady` |

원서 문장 없음(지어낸 글자).

## 3. 변이 — 7개 모두 빨강 → 복원 `cmp` 같음

`b8i3/scripts/mutate.mjs`(정확히 1회 일치만 → `MUT-Mn` 표식 1건 확인 → 전체 테스트 → `bak/` 에서 복원 → `cmp`). 출력 `b8i3/mut/M1.txt`–`M7.txt`. 해시 테스트 IM2·IM6·IM7b 는 파일이 바뀌면 늘 빨강이라 표에서 뺐다.

| 변이 | 바꾼 것 | 빨간 테스트(해시 제외) | 통과 |
|---|---|---|---|
| M1 | `goToPageForSpeech` 를 200 ms 폴링으로 되돌림 | PT9 | 1039/1043 |
| M2 | `renderPage` 끝 알림의 토큰 검사 뺌(버려진 렌더도 알림) | PT9 | 1039/1043 |
| M3 | 알림을 `notifyPage` 앞으로(그리기 직후, reload 전) | PT9 | 1039/1043 |
| M4 | `createRenderDone` 이 undefined 도 참으로 풀어 버림 | PT1 · PT7 · PT8 | 1037/1043 |
| M5 | (R3) 추출기 `page` → `refreshGate.saved` 배선 제거 | PT10 | 1039/1043 |
| M6 | (R4) controls `statechange` → `setSpeechState` 배선 제거 | PT11 | 1039/1043 |
| M7 | `whenCurrentPageReady` 를 폴링으로 되돌림 | PT9 · RF23 | 1038/1043 |

## 4. 전체 테스트 · import map

`node apps/medreader/dev/stamp-importmap.mjs` 다시 찍음(모듈 53 · CSS 4) → `--check` "그대로다", 종료 0.
`node --test apps/medreader/tests/*.test.mjs` **1043/1043 × 3회**(변이 전 2회 + 변이·복원 뒤 1회; 기존 1031 + 새 12).

## 5. headless 재현 (Edge · 412px · 캐시 끔 · 흉내 음성) — 복사본 1개

스크립트 `b8i3/scripts/rv3.mjs`(Review 의 `r8i1/scripts/rv.mjs` 를 복사해 경로를 `b8i3` 로, `head` 는 HEAD(51815bc) 판 `reader.js` 하나만 가로채게, 리플로우 쪽 넘김 모드 `TURNR`·발화 끝 기록·지연 집계를 더함). 블롭은 `b8i3/scripts/restore-blob.mjs`(r8i1 판, 경로만 b8i3)로 되넣음: 106,843,404 B · `%PDF-` · 30쪽 algoVersion 10 확인. 순서: C2(30쪽이 옛 판일 때) → 같은 복사본으로 TURN·TURN-x4·TURNR.

| 실행 | 결과 |
|---|---|
| **TURN — 원본 보기 31→41쪽**(로그 `rv-TURN-1.log`) | **10쪽 넘김 모두: 첫 문장 연달아 두 번 0 · 끊긴 발화 0 · 같은 문장 연속 0 · 그리기 전에 말한 쪽 0**. 첫 발화 − canvas 다 그림 2–7 ms(평균 4). **32쪽**(Review 재현 쪽): canvas 가 951 ms 걸렸고 첫 발화는 그 4 ms 뒤 "CHAPTER 36: HIV INFECTION & A…" 한 번 — 그리기 시간만큼 늦게 시작(운영자 결정의 대가). 나머지 쪽은 앞 쪽 끝 → 첫 발화 18–91 ms |
| 대조 — 같은 복사본·같은 쪽, **HEAD(폴링) reader.js**(`rv-TURN-head.log`) | **32쪽 재현**: 첫 발화가 canvas 보다 886 ms 앞섬 → canvas 완료 2 ms 뒤 "• As of 2025, the use of HIV …" 끊김 → 같은 문장 다시(끊긴 발화 1 · 같은 문장 연속 1). 다른 쪽은 늘 약 200 ms(폴링 틱) 뒤 시작 |
| **TURN-x4 — CPU 4배 감속, 46→56쪽**(`rv-TURN-x4.log`) | 10쪽 넘김: 첫 문장 두 번 0 · 끊긴 발화 0 · 그리기 전에 말한 쪽 0. 첫 발화 − canvas 11–28 ms. **53쪽 "Common Symptoms"**(Review 가 두 번 들은 쪽) 1번. 같은 문장 연속 1건은 51쪽 중간 "(3) Weekly (4) Daily or almost" — 저장본에 같은 글자 줄이 6개(설문 선택지, `51:69`·`51:70` 이 이웃)라 내용 반복이고 끊김 아님(`scripts/p51.mjs` 로 확인) |
| **TURNR — 리플로우 33→38쪽**(`rv-TURNR.log`) | **지연 없음**: 첫 발화 − 본문 교체 5–10 ms(평균 7), 앞 쪽 마지막 발화 끝 → 첫 발화 8–14 ms(평균 11). 대조 HEAD(`rv-TURNR-head.log`): 198–201 ms / 203–206 ms(폴링 틱). 연속·끊김 0 |
| **C2 회귀(8i-1)** — 원본 보기, 연 즉시(옛 판 30쪽) 재생(`rv-C2.log`) | 16 ms 재생 → "Preparing text…", 발화 0 → 571 ms 첫 발화 "Thyroid Nodules & Multinodular Goiter" 한 덩어리(1번). 30쪽 발화 27 · "& Pseudo- 1130" 0 · "1130" 0 · 정수만 0. 같은 문장 연속은 멈춤 → 재생 1건뿐(기존 동작). 멈춘 자리 상자 3개(`30:9·30:10·30:11`, 새 판) — 쪽 번호 칸과 교차 0, 간격 24.7 pt. 낭독 중 다시 그림 0. 끊긴 발화 2 = 멈춤 1 + 스크립트가 끝에 누른 멈춤 1(31쪽) |

콘솔 오류: 매 실행 `/favicon.ico` 404 하나(앱 무관). 띄운 Edge 는 스크립트 `finally` 에서 닫았고 매 실행 뒤 `tasklist` 에 `msedge.exe` 0.

## 6. 디스크 · 복사본

- 복사 전 `df -h /c`: 2.9 GB. 복사본 **1개**: `b8i3/p1`(`shot-profile/Default/` 만 복사 40 MB → 블롭 되넣은 뒤 146 MB → 끝 **148 MB**). `shot-profile/` 은 읽기만 했다.
- 마지막 `df -h /c`: **남은 공간 2.8 GB**.
- 지울 경로(`rm -rf` 금지라 지우지 않음): `C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/b8i3/p1`(148 MB, 재추출이 진행돼 다시 못 씀). 그 밖 `b8i3/` 는 2 MB 미만.

## 7. 남은 문제 · 판단할 것

1. **원본 보기 무거운 쪽은 그리기 시간만큼 늦게 시작**(32쪽 데스크톱 약 0.95초) — 운영자가 받아들인 대가. 폰에서는 더 길 수 있다. 가벼운 쪽은 오히려 폴링 틱(최대 200 ms)이 없어져 빨라졌다(18–91 ms).
2. (기록, 폴링 시절과 같은 값) db 오류로 새 쪽 저장본을 못 읽으면 `state.desc` 가 앞 쪽 것이라 쪽 넘김이 참으로 풀린다 — 앞 쪽 큐를 새 쪽에서 다시 읽을 수 있다. 폴링 판도 같았고 IndexedDB 오류 배너가 함께 뜬다. 바꾸지 않았다.
3. `whenCurrentPageReady` 가 다른 쪽으로 간 것을 알아채는 때가 "폴링 틱"에서 "그 쪽 렌더의 끝"으로 바뀌었다(결과 false 는 같다).
4. `TTS.PAGE_POLL_MS` 는 앱에서 더는 쓰지 않는다(config 는 범위 밖) — 다음 정리 때 지워도 된다(새 테스트의 대조 흉내가 읽으므로 그때 함께).
5. 실기기(안드로이드) 원본 보기 쪽 넘김 한 번 확인 권장 — 늦게 시작하는 길이를 체감으로.
