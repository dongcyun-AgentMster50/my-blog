# Build 보고 — 8i-1 재추출 중 "지금 보고 있는 쪽"을 새 판으로 (spec 4-13-9)

> 커밋하지 않았다. 진짜 API 키를 쓰지 않았다(이 경로는 AI 를 부르지 않는다). 8000번 서버(PID 36964)는 쓰기만 하고 끄지 않았다.
> **중단 사유 — C: 드라이브가 가득 참(0 바이트).** 재현용 Edge 프로필 복사본(각 574 MB)을 스크래치패드에 여러 벌 만들다가 C: 가 찼다. `rm -rf` 는 훅이 막으므로 지우지 않았다(변형 명령도 시도하지 않음). 아래 "남은 일"을 보라.

## 1. 바꾼 것 (앱 파일 6개 + 테스트 1개 + import map)

| 파일 | 내용 |
|---|---|
| `js/ui/reader.js` | ① 순수 함수 3개 `isStaleRecord`(저장본 `algoVersion` < 지금) · `createRefreshGate`(다시 그리기 문지기) · `buildLineRemap`(옛 줄 id → 새 줄 id: 같은 id·같은 글자 → 같은 글자(여럿이면 쪽 위 자리가 가까운 것) → bbox 겹침 최대 → 같은 문단 순서 비례). ② `renderPage(opts)` — 읽은 저장본이 옛 판이면 `state.stale`, 문지기 `shown`. `opts.refresh`(다시 그리기)면 줄 대응을 만들고 탭한 줄을 옮기고, 그린 뒤 스크롤 기준 줄(화면 가운데 줄)을 같은 화면 높이로 되돌리고(원본 보기는 스크롤 상자 위치), 구독자에게 `{refreshed:true}`. ③ 추출 `page` 이벤트 → 자리표시자면 지금처럼 `renderPage`, 아니면 문지기 `saved`. 배선 직후·옛 판 렌더 직후 `catchUpStale`(이벤트를 놓친 경우). ④ 공개: `setSpeechState`·`currentPageReady`·`whenCurrentPageReady`(상한 `TTS.FRESH_WAIT_MS`)·`remapLineId`. ⑤ `goToPageForSpeech` — 옛 판으로 그려진 쪽은 아직 준비 안 된 쪽으로 본다(재추출 중에만 다르다). ⑥ `leaveReader` 가 문지기를 끊는다 |
| `js/tts/speaker.js` | `play()` 앞 문: `view.ready()` 가 거짓이면 옛 판을 읽지 않고 `'waiting-page'`(상태는 늘리지 않음 — `freshGen` 세대로 구분)로 `view.whenReady()` 를 기다렸다가 같은 `play()` 로 다시 들어와 큐를 새로 만든다(줄 탭이면 `remapLine`). 기다리는 중 재생 탭은 무시, `pause`/`stop` 은 세대로 기다림을 끊음, 상한 넘으면 `'paused'`(옛 판 안 읽음). `reload()` 는 기준 줄이 새 큐에 없으면 `view.remapLine` 으로 다시 찾는다. 새 `reshow()`(멈춘 상태에서만, 스크롤 없이 `view.highlight`) · `isWaitingFresh()`. view 계약 문서에 선택 항목 4개 |
| `js/ui/controls.js` | view 에 `ready`·`whenReady`·`remapLine`·`highlight`(= `setCurrentLines`, 스크롤 없음). `statechange` → `setSpeechState`. 둘째 `onPageRender` 구독자가 `refreshed` 일 때 `speaker.reshow()`(첫 구독자 `reload()` 뒤 — 기존 W2 테스트의 정규식 그대로 두려고 구독자를 나눴다). 대기 문구: 새 판 대기면 기존 키 `reader.preparing.unknown`(4개 언어에 이미 있음 — **새 i18n 키 없음**), 다음 쪽 대기는 그대로 `reader.tts.waitingPage` |
| `js/pdf/extract.js` | `Extractor.hasCurrent(n)` 한 줄(메모리 집합 조회) — 리더의 따라잡기용 |
| `js/config.js` | `TTS.FRESH_WAIT_MS: 20000` |
| `index.html` | `node apps/medreader/dev/stamp-importmap.mjs` 로 다시 찍음(모듈 53 · CSS 4), `--check` 0 |
| `tests/refresh-8i1.test.mjs` (새) | RF1–RF18 (아래) |

**다시 그리기 조건(문지기)** — 옛 판으로 그린 **지금 쪽(문서+쪽)** 의 저장만 따라간다. 낭독 중(`'speaking'`)이면 미루고, `paused`/`idle`/`error` 가 되면 한 번 한다. `'waiting-page'`(다음 쪽·새 판 대기)는 읽는 중이 아니므로 그때 온 저장은 바로 다시 그리되 미뤄 둔 것을 거기서 풀지는 않는다(쪽 끝 → 곧 다른 쪽이 그려져 버려진다). 쪽을 새로 그리면 미뤄 둔 것은 버린다. 한 번 옛 판이던 쪽은 그 쪽에 머무는 동안 뒤이은 역할 재계산(4-7, `roleVersion` 2) 저장도 따라간다 — 다른 쪽에 가면 끊긴다. **평소(옛 판이 아닌 쪽)는 지금과 같다** — 역할 재계산 저장에도 다시 그리지 않는다.

## 2. 테스트

- 새 `tests/refresh-8i1.test.mjs` 18개: 판정(RF1) · 문지기(RF2 바로 · RF3 낭독 중 미룸→멈춘 뒤 1회 · RF4 다른 쪽/다른 문서 무반응 · RF5 평소 쪽 무반응 · RF6 역할 재계산 따라감/다른 쪽에서 끊김 · RF7 쪽 바뀌면 미룸 버림 · RF8 대기 중 저장은 바로 · RF9 떠나면 끊김) · 줄 대응(RF10 갈라진 이름표 줄 → 이름표 줄, 쪽 번호 줄로 가지 않음 · RF11 같은 글자 여럿) · speaker 재생 대기(RF12 옛 판 재생 → 대기 → 새 판 첫 발화 = 이름표 한 덩어리, 쪽 번호 섞인 발화 0 · RF13 상한 → paused, 다시 누르면 다시 대기 · RF14 대기 중 멈춤 → 말하지 않음 · RF15 줄 탭 → 같은 글자의 새 줄부터 · RF16 새 판 쪽은 즉시 발화(6-4 (5) 불변)) · 통합(RF17 실제 speaker+문지기: 낭독 중 저장 → 미룸 → 멈춤 → 다시 그림·멈춘 자리 새 줄로·다시 칠함 · RF18 reshow 는 멈춤에서만). 원서 문장 없음(지어낸 글자).
- 전체 `node --test tests/*.test.mjs`: 기준 1008/1008 → **1026/1026 × 2회**(C: 가 차기 전). 기존 테스트는 하나도 고치지 않았다(W2 는 구독자 분리로 통과).
- `stamp-importmap.mjs` 실행 후 `--check` 0.

## 3. 변이 — **하지 못함**(C: 가득 참)

계획했던 것: V1 문지기 `saved` 의 낭독 중 미룸 제거 → RF3·RF17 빨강 예상 · V2 문지기의 쪽(키) 비교 제거 → RF4 빨강 예상 · V3 speaker `play()` 앞 문 제거 → RF12·RF15 · V4 `reload()` 의 remap 제거 → RF17. 스크래치패드(C:)에 백업을 쓸 수 없고 셸 출력까지 "No space left on device" 로 실패해 중단했다. 디스크를 비운 뒤 Review 또는 이어서 할 Build 가 해야 한다.

## 4. headless 재현 (Edge · 412px · 캐시 끔 · 흉내 음성) — 프로필 `shot-profile/` 원본은 건드리지 않고 복사본으로

스크립트 `b8i1/scripts/repro.mjs`(스크래치패드), 로그 `b8i1/repro-A.log`·`repro-B.log`.

| | 결과 |
|---|---|
| **B — 연 즉시(옛 판 화면) 재생**, 다른 쪽에 가지 않음 | 연 뒤 22 ms 화면 = 옛 판("Pseudo- 1130" 줄 1, 이름표 0) → 재생 누름 → `waiting-page`, 바 문구 "Preparing text…", 발화 0 → 497 ms 새 판 저장·화면 다시 그림(이름표 6 · `rt-ref` 6 · "Pseudo- 1130" 0) → **504 ms 첫 발화 "Thyroid Nodules & Multinodular Goiter"(한 덩어리, 기대와 정확히 같음)**. 30쪽 발화 26 · "& Pseudo- 1130" 든 발화 **0** · "1130" 든 발화 0 · 정수만 발화 0 · "Hypoparathyroidism & Pseudo-hypoparathy…" 한 발화 |
| **A — 재추출 뒤 재생**, 다른 쪽에 가지 않음 | 화면 기록: 16 ms 옛 판 → 647 ms 새 판(`roleVersion` 1) → 716 ms 다시(`roleVersion` 2, 역할 재계산 따라감). 첫 발화 "Thyroid Nodules & Multinodular Goiter" 같음 · "& Pseudo- 1130" 0 · 정수만 0. **스크롤 기준 유지**: 옛 판에서 `scrollY` 900 일 때 화면 y≈450 의 줄 "Rickets &"(top 420) → 다시 그린 뒤 같은 줄 "Rickets &" top 420(행 순서가 바뀌어 `scrollY` 2814 로 따라감) |
| **C — 원본 보기** | **미완.** 첫 시도는 `reader.view` 를 부팅 뒤에 바꿔 리플로우로 돌았다(판정 불가 — 결과는 A 와 같음). 부팅 전에 바꾸는 둘째 시도는 프로필 복사 중 C: 가 차서 못 했다. 코드상 원본 보기는 다시 그리기 때 `renderPage` → `showOriginal({layout: 새 layout})` 이므로 상자는 새 줄 좌표를 쓰고, 멈춘 자리는 `reshow` → `setCurrentLines` → `setCurrentOriginal`(새 layout)로 다시 칠한다 — 브라우저 확인은 남았다 |

콘솔 오류: 매 실행 `/favicon.ico` 404 하나(앱 무관). 띄운 Edge 는 스크립트 `finally` 에서 닫았다(마지막 확인은 셸 출력 실패로 못 함).

## 5. 남은 일 · 위험

1. **[긴급] C: 드라이브 0 바이트.** 내가 만든 스크래치패드 프로필 복사본(각 약 574 MB)을 지워야 한다 — `b8i1/profile`·`profileA`·`profileA2`·`profileA3`·`profileB`·`profileC`·`profileC2`(복사 중 실패한 반쪽) — 경로는 스크래치패드 `C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/b8i1/`. `shot-profile/` 원본은 그대로 둔다(algoVersion 10 보존). `b8i1/orig/`(수정 전 원본 6개, 268 KB)는 남겨도 된다.
2. 변이 V1–V4, headless C(원본 보기 상자), 전체 테스트 재확인.
3. 판단 기록: (a) 재생 대기 후 `speak()` 는 탭 이벤트 밖에서 나간다 — 기존 8h-1 "인용만 있는 쪽" 경로와 같은 모양이다. 안드로이드에서 제스처 밖 첫 발화가 막히면 `TTS_NOT_ALLOWED` 배너로 간다(실기기 확인 필요). (b) 추출이 멈춰 있으면(용량 초과 등) 옛 판 쪽은 재생이 20초 기다린 뒤 멈춤으로 돌아간다 — 옛 읽기는 끝내 내지 않는다(spec 대로). (c) 다음 쪽이 옛 판이면 쪽 넘김이 기존 5초 상한(`PAGE_WAIT_MS`) 안에 새 판을 기다린다 — 재추출 중에만 달라진다.

## 6. 이어서 (8i-1b)

> 지침 `.claude/tasks/medreader-build-8i-1b.md`. 커밋하지 않았다. 앱 코드는 변이(되돌림)만 건드렸고 지금은 시작 때와 바이트 단위로 같다(`cmp`). 진짜 키 없음.
> 작업 폴더: 스크래치패드 `b8i1b/`(백업 `bak/`, 스크립트 `scripts/`, 변이 출력 `mut/`, 로그 `repro-C.log`·`repro-B.log`·`repro-C2.log`).
> 시작 때 C: 남은 공간 3.4 GB. 앞 Build 의 `b8i1/profile*` 복사본은 이미 없었다(`b8i1/` 에는 `orig/`·`scripts/`·로그만).

### 6-1. 변이 V1–V4 — 넷 다 기대대로 빨강

각 변이: `bak/` 에 `reader.js`·`speaker.js` 복사 → 문자열 하나를 바꿈(`scripts/mutate.mjs`, 정확히 1회 일치만) → `grep MUT-Vn` 으로 적용 확인 → 전체 테스트 → `bak/` 로 복원 → `cmp` 같음(넷 다).
`IM2`·`IM6`·`IM7b`(import map 해시)는 파일이 바뀌면 늘 빨강이므로 표에서 뺐다.

| 변이 | 바꾼 것 | 빨간 테스트(해시 3개 제외) | 판정 |
|---|---|---|---|
| V1 | `createRefreshGate.saved` 의 낭독 중 미룸 줄 제거(낭독 중에도 다시 그림) | RF3 · RF7 · RF17 (1020/1026) | 기대(RF3·RF17) + RF7 |
| V2 | `saved` 의 쪽 키 비교 제거(지금 쪽이 아닌 쪽 저장에도 다시 그림) | RF4 (1022/1026) | 기대 |
| V3 | speaker `play()` 앞 문(`!viewReady()` → `waitFresh`) 제거 | RF12 · RF13 · RF14 · RF15 (1019/1026) | 기대(RF12·RF15) + RF13·RF14 |
| V4 | speaker `reload()` 의 `remapLine` 다시 찾기 제거 | RF17 (1022/1026) | 기대 |

### 6-2. 전체 테스트 · import map

복원 뒤 `node --test apps/medreader/tests/*.test.mjs` **1026/1026 × 2회**. `node apps/medreader/dev/stamp-importmap.mjs --check` → "그대로다 (모듈 53개 · CSS 4개)", 종료 0.

### 6-3. 재현 준비에서 막힌 것 두 가지(둘 다 우회 — 앱 코드 무관)

1. **8000번 서버가 꺼져 있었다**(연결 거부). 앞 로그의 404 문구("File not found")가 파이썬 `http.server` 의 것이라 같은 것을 레포 루트에서 `python -m http.server 8000 --bind 127.0.0.1` 로 띄웠다(PID 34392). 끄지 않고 두었다.
2. **원본 `shot-profile/` 에 PDF 원본이 없다.** `Default/IndexedDB/http_localhost_8000.indexeddb.blob/` 가 **비어 있다**(0 바이트) — 574 → 302 MB 로 준 것이 바로 이것(약 107 MB 블롭 + 부속). leveldb(22 MB, `pages` 30쪽 algoVersion 10)는 그대로라 첫 시도(p1)는 옛 판을 그렸지만 `blobs` 행을 읽으면 `NotFoundError` → 재추출이 돌지 않고("Could not load the PDF engine…" 배너) 원본 보기는 리플로우로 물러났다. **앞 Build 의 C 첫 시도가 리플로우로 돈 것도 이것일 가능성이 크다.** 프로필 전체를 복사해도 원본에 블롭이 없으니 소용없어 전체 복사는 하지 않았다.
   → 우회: 각 **복사본**에서만, 서재 화면(읽기 화면에 들어가지 않음 — 재추출이 시작되지 않게)에 따로 만든 `<input type=file>` 로 지정된 PDF 하나(`CURRENT Medical Diagnosis _ Treatment 2026.pdf`)를 받아 `db.put('blobs', {docId, blob})` 했다(`scripts/restore-blob.mjs`). 크기 106,843,404 바이트로 문서 기록의 블롭 크기와 같고 머리 `%PDF-`. 넣은 뒤에도 30쪽은 algoVersion 10 그대로였다. `shot-profile/` 은 읽기만 했다(Edge 의 `userDataDir` 로 쓰지 않음).

### 6-4. headless 재현 (Edge · 412px · 캐시 끔 · 흉내 음성 · 복사본 = `shot-profile/Default/` 만)

스크립트 `b8i1b/scripts/repro.mjs`(앞 `repro.mjs` 를 고침). 원본 보기 설정은 **부팅 전**에 넣었다 — 설정은 localStorage 가 아니라 IndexedDB `settings` 스토어라서, 행을 저장해 두고 `evaluateOnNewDocument` 에서 `IDBCursorWithValue.value` 를 덮어 `reader.view` 행이 `original` 로 읽히게 한 뒤 다시 부팅했다(부팅 뒤 `settings.get('reader.view')` = `original`, `body[data-reader-view=original]`, `.original canvas` 있음 확인).
원본 보기 화면 기록은 canvas 를 다 그릴 때마다 다시 쓰는 `aria-label` 을 지켜봤다(같은 쪽 다시 그리기는 mount 자식이 안 바뀌어 앞 스크립트의 기록에 안 잡힌다).

| | 결과 |
|---|---|
| **C — 원본 보기**(p1) | 열기 전 30쪽 저장본 10(“Pseudo- 1130” 줄 1). canvas 기록: **493 ms 옛 layout** → 521 ms 새 판 저장(roleVersion 1)에 다시 그리기 시작 → **550 ms 새 layout** 으로 다시 그림. 재생 → "Hypoparathyroidism & Pseudo…" 발화 중 상자 3개(줄 id `30:9·30:10·30:11` = 새 판의 "Hypoparathyroidism" / "& Pseudo-" / "hypoparathyroidism", **셋 다 새 저장본에 있음**). 그 발화 중 **멈춤(5966 ms) → 5993 ms 에 canvas 다시 그림(tts `paused`)** = 낭독 중 들어온 역할 재계산 저장을 미뤘다가 멈춘 뒤 한 번 함. 다시 그린 뒤 **멈춘 자리 상자 그대로 3개, 오른끝 109.2 px < 쪽 번호 칸 "1130" 왼끝** — 같은 좌표계로 맞추면(상자는 새 줄 bbox 에서 일정하게 27.1 px 옮겨져 있다 = 쪽 원점 보정) 줄 bbox 오른끝 135 px vs "1130" 왼끝 155.8 px, **약 20 px 떨어져 닿지 않음**. 첫 발화 "Thyroid Nodules & Multinodular Goiter" 한 덩어리 · **"& Pseudo- 1130" 든 발화 0** · "1130" 0 · 정수만 0 |
| **C2 — 원본 보기, 연 즉시(옛 판) 재생**(p3, 8i-1 대기 길) | 17 ms 에 재생 누름(저장본 10) → 바 "Preparing text…", 발화 0 → canvas 501 ms 옛 layout → 548 ms 새 layout(tts `waiting-page`) → 608 ms 역할 재계산 다시 그림(`waiting-page`) → **632 ms 첫 발화 "Thyroid Nodules & Multinodular Goiter"** 한 덩어리. "& Pseudo- 1130" 0 · "1130" 0 · 정수만 0. 멈춘 자리 상자 판정 C 와 같음(닿지 않음, 줄 id 모두 새 판) |
| **B — 리플로우, 연 즉시 재생**(p2) | 15 ms 화면 = 옛 판(이름표 0 · "Pseudo- 1130" 줄 1) → 재생 → `waiting-page`, "Preparing text…", 발화 0 → 468 ms 새 판(이름표 6 · "Pseudo- 1130" 0) → 528 ms 역할 재계산 → **657 ms 첫 발화 "Thyroid Nodules & Multinodular Goiter"**. 30쪽 발화 26 · "& Pseudo- 1130" 0 · "1130" 0 · 정수만 0 — 앞 B 와 같음 |

콘솔 오류: 매 실행 `/favicon.ico` 404 하나뿐. 띄운 Edge 는 스크립트 `finally` 에서 닫았고, 매 실행 뒤 `tasklist` 에 `msedge.exe` 없음.
30쪽 발화 수가 C 28 · C2 27 인 것: 멈춤 → 다시 재생은 그 문장을 처음부터 다시 읽는다(6-4 (1), 기존 동작) — "Hypoparathyroidism…" 이 두 번. C 의 나머지 한 번은 아래 6-5 ①.

### 6-5. 남은 문제 · 판단할 것 (고치지 않음)

1. **[작음 · 원본 보기만] 다시 그리는 동안 시작한 낭독은 첫 문장을 한 번 더 읽는다.** C 에서 재생을 누른 때(≈522 ms)가 다시 그리기 한가운데였다 — `renderPage` 가 `state.stale = false`·새 `desc` 를 **`await paintView` 앞**(reader.js 790행 부근)에서 세우고, `notifyPage({refreshed:true})` 는 **canvas 를 다 그린 뒤**(550 ms)에 낸다. 그 사이 `view.ready()` 가 참이라 재생이 곧장(새 판 큐로) 시작했고, 그 뒤 온 `refreshed` 알림의 `reload()` 가 낭독 중이라 `restart(index)` → "Thyroid Nodules & Multinodular Goiter" 가 두 번(첫 번째는 시작 직후 끊김). 옛 읽기는 나오지 않는다. 리플로우는 그리기가 동기라 창이 없고(B 26 발화, 중복 0), C2 처럼 `waitFresh` 로 기다린 경우는 이번에 겹치지 않았지만 `whenCurrentPageReady` 가 `stale` 만 보므로(폴링) **같은 창에 걸리면 같은 중복이 날 수 있다**. 같은 모양의 경합이 8i-1 전부터 원본 보기 첫 렌더에도 있어 보인다(재생이 `paintView` 중에 시작되면 `notifyPage` 의 `reload()` 가 다시 시작 — 코드로만 봄, 재현 안 함). 고치려면 예: "새 판 준비됨"을 `notifyPage` 뒤에 세우거나, `refreshed` 의 `reload()` 가 같은 문장·같은 단계면 다시 시작하지 않게. Review·운영자 판단.
2. **`shot-profile/` 원본에 PDF 블롭이 없다**(6-3 ②). 다음 재현도 복사본마다 `restore-blob.mjs` 가 필요하다(복사본당 +107 MB). Edge 가 그 프로필을 열 때 블롭을 고아로 보고 지운 것으로 보인다.
3. **지워야 할 것(훅이 `rm -rf` 를 막아 지우지 않음)** — 스크래치패드 `C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/b8i1b/` 아래 `p1`(147 MB) · `p2`(169 MB) · `p3`(147 MB) — 모두 합쳐 약 463 MB, 셋 다 재추출이 끝나 새 판이라 재현에 다시 못 쓴다. `b8i1b/bak/`(130 KB)·`scripts/`·로그는 작다.
4. 마지막 `df -h /c`: **남은 공간 2.9 GB**(시작 3.4 GB).

## 7. 첫 문장 두 번 읽기 (8i-1c)

> 지침 `.claude/tasks/medreader-build-8i-1c.md`. 커밋하지 않았다. 진짜 키 없음. 8000번 서버(PID 34392)는 그대로 쓰고 끄지 않았다.
> 작업 폴더: 스크래치패드 `b8i1c/`(수정 전 원본 `orig/` · 고친 판 백업 `bak/` · 스크립트 `scripts/` · 변이 출력 `mut/` · 로그 `repro-C.log`·`repro-C2.log`).
> 시작 때 C: 남은 공간 3.3 GB(앞 `b8i1b/p1·p2·p3` 는 이미 없었다).

### 7-1. 고친 방법 — 권장 방향("다시 그리기가 끝나야 준비됨")

`js/ui/reader.js` 만 고쳤다(`speaker.js`·`controls.js` 는 `orig/` 와 바이트 단위로 같다).

- 새 상태 `state.refreshing`(다시 그리는 렌더의 token, 0 = 아님)과 순수 함수 `pageFresh(st)` = `!stale && !refreshing`(export).
- `renderPage({refresh})`: **시작하자마자**(저장본 읽기 전) `refreshing = token` → 저장본을 읽은 동기 구간에서 `refreshing = cap ? token : 0`(평소 렌더는 앞 다시 그리기가 버려졌어도 내린다) → `await paintView` → `restoreView` → `notifyPage({refreshed:true})` → **`finally` 에서** 이 렌더가 마지막 렌더일 때만 0. 저장본 없음·깨짐·db 오류 갈래도 0. `leaveReader` 도 0.
- 준비 판정 세 곳을 `pageFresh(state)` 로: `currentPageReady`, `whenCurrentPageReady`(즉시 판정·폴링 둘 다), `goToPageForSpeech`(즉시 판정·폴링 둘 다 — 다음 쪽이 옛 판이라 쪽 넘김 대기 중 그 쪽을 다시 그리는 경우도 같은 틈이라 함께).
- 결과: 다시 그리는 동안 재생을 누르면 `play()` 앞 문(8i-1)이 `'waiting-page'` 로 기다리고, `refreshed` 알림의 `reload()` 는 낭독 중이 아니라 큐만 갈고, 그 **뒤** 폴링이 풀려 새 큐로 한 번 시작한다.

**왜 이 방법인가(대안: speaker `reload()` 가 같은 쪽·같은 문장이면 다시 시작하지 않음).** `reload()` 는 다시 그리기 말고도 뷰 전환(6b)·원문 언어 변경(7c — 음성이 바뀌어 다시 시작해야 한다)에서 똑같이 불려, "같은 문장이면 그대로"를 넣으면 그 둘의 동작이 바뀌거나 `refreshed` 를 speaker 까지 끌고 가야 한다. 또 끊지 않으면 옛 DOM 에 칠한 하이라이트를 따로 다시 칠해야 한다. 준비 판정을 고치는 쪽은 리더 안에서 끝나고, 평소(옛 판이 아닌) 쪽은 `refreshing` 이 서지 않아 판정이 전과 같으며, 대기 경로(C2)·역할 재계산 다시 그리기가 겹치는 경우·쪽 넘김 대기까지 같은 한 줄로 막힌다.

**겹침 처리**: 대기 중 역할 재계산 저장(roleVersion 2)이 오면 문지기가 둘째 다시 그리기를 바로 시작한다 — 첫 렌더는 token 이 밀려 `finally` 에서 내리지 않고, 둘째가 시작 때 세운 `refreshing` 이 끝까지 간다(RF22). 둘째 렌더가 db 를 읽는 사이에도 준비 안 됨(시작 때 세우는 이유).

### 7-2. 새 테스트 (`tests/refresh-8i1.test.mjs` 끝에 RF19–RF23, 기존 RF1–RF18 은 고치지 않음)

| | 내용 |
|---|---|
| RF19 | `pageFresh` 진리표(옛 판·다시 그리는 중이면 거짓) |
| RF20 ★ | 비동기 paintView 흉내 리더(시작 → 저장본 읽기 → stale 내림 → **테스트가 끝내는 그리기** → reload·reshow → finally) + 실제 speaker·문지기. 그리는 도중 재생 → `waiting-page`, 발화 0 → 그리기 끝 → 발화 정확히 `['Zeta Topic & Omega-omegaphoria']`, **끊긴 발화 0**, 다음 발화 뒤에도 같은 문장 연속 없음, 옛 읽기 0 |
| RF21 ★ | 대기 경로(C2): 옛 판에서 재생 → 대기 → 저장 → 다시 그리는 도중(이미 stale 거짓)엔 풀리지 않음 → 끝난 뒤 1번, 끊긴 발화 0 |
| RF22 | 대기 중 역할 재계산 다시 그리기가 겹침 → 버려진 첫 렌더는 준비됨을 세우지 않고, 둘째 끝난 뒤 1번 |
| RF23 | 리더 소스 순서: `if (cap) state.refreshing = token` < `await db.get` < `refreshing = cap ? token : 0` < `await paintView` < `notifyPage(refreshed)` < `finally` < 내림. `currentPageReady`·`whenCurrentPageReady`(2곳)·`goToPageForSpeech`(2곳, `!state.stale` 없음) 가 `pageFresh(state)` |

리더의 `renderPage` 는 DOM·db 에 묶여 node 에서 직접 돌릴 수 없어, 동작은 같은 순서의 흉내(RF20–22)로, 실제 소스가 그 순서인지는 RF23 으로 묶었다. 원서 문장 없음(지어낸 글자).

### 7-3. 변이 — 셋 다 빨강 → 복원 `cmp` 같음

`scripts/mutate-c.mjs`(정확히 1회 일치만), `grep MUT-Mn` 1건 확인 → 전체 테스트 → `bak/reader.js` 로 복원 → `cmp` 같음(셋 다). 출력 `mut/M1.txt`–`M3.txt`. 해시 테스트 `IM2`·`IM6`·`IM7b` 는 파일이 바뀌면 늘 빨강이라 뺐다.

| 변이 | 바꾼 것 | 빨간 테스트(해시 제외) |
|---|---|---|
| M1 | `pageFresh` 가 `refreshing` 을 안 봄(= 고치기 전 판정 `!stale`) | RF19 · RF20 · RF21 · RF22 (1024/1031) |
| M2 | 저장본 읽은 뒤 다시 그리기에서도 `refreshing = 0`(그리기 전에 준비됨) | RF23 (1027/1031) |
| M3 | 시작 때 `refreshing` 을 세우지 않음 | RF23 (1027/1031) |

### 7-4. 전체 테스트 · import map

`node apps/medreader/dev/stamp-importmap.mjs` 다시 찍음(모듈 53 · CSS 4) → `--check` "그대로다", 종료 0. `node --test apps/medreader/tests/*.test.mjs` **1031/1031 × 2회**(기존 1026 + 새 5).

### 7-5. headless 재현 (Edge · 412px · 캐시 끔 · 흉내 음성) — 복사본 2개(`shot-profile/Default/` 만), 각각 `restore-blob.mjs` 로 블롭 되넣음(106,843,404 B, `%PDF-`, 30쪽 algoVersion 10 확인)

스크립트 `b8i1c/scripts/repro.mjs`(b8i1b 것을 복사해 고침): **C 는 다시 그리기가 mount 를 갈아 끼운 바로 그 순간**(저장본은 새 판으로 읽었고 canvas 는 아직) 페이지 안 `MutationObserver` 콜백에서 재생을 누른다 — 8i-1b 가 우연히 걸린 틈을 일부러 노린다. 발화 흉내에 `cancel` 때 말하던 발화(끊긴 발화) 기록과 "같은 문장 연속" 판정을 더했다.

| | 결과 |
|---|---|
| **C — 원본 보기, 다시 그리는 도중 재생**(p1) | canvas: 489 ms 옛 layout → 511 ms mount 교체·526 ms 새 판(roleVersion 1) → **570 ms 역할 재계산 다시 그리기의 mount 교체 순간 재생 누름**(그때 canvas 2번째까지, 저장본 11·roleVersion 2) → 누른 직후 tts **`waiting-page`**, 발화 0, 바 "Preparing text…" → 596 ms canvas 다시 그림(`waiting-page`) → **778 ms 첫 발화 "Thyroid Nodules & Multinodular Goiter" 한 덩어리**. 고치기 전 판정이면 이 순간 이미 stale 거짓이라 곧장 말하고 596 ms `refreshed` 에서 다시 시작했을 자리다. **"Thyroid Nodules…" 발화 1번 · 끊긴 발화는 멈춤 때 1건뿐 · 같은 문장 연속은 멈춤 → 다시 재생의 "Hypoparathyroidism…" 1건뿐(기존 동작), 그 밖 0**. "& Pseudo- 1130" 0 · "1130" 0 · 정수만 0. 30쪽 발화 27. 멈춘 자리 상자 3개(줄 id `30:9·30:10·30:11` 모두 새 판), 오른끝 109.2 px < "1130" 왼끝 155.8 px — **닿지 않음** |
| **C2 — 원본 보기, 연 즉시(옛 판) 재생**(p2) | 22 ms 화면 옛 판(저장본 10) → 재생 → "Preparing text…", 발화 0 → canvas 459 ms 옛 → 477/500 ms 새 판 다시 그리기(`waiting-page`) → 546/566 ms 역할 재계산 다시 그리기(`waiting-page`) → **633 ms 첫 발화 "Thyroid Nodules & Multinodular Goiter"** 한 덩어리. 첫 문장 1번 · 끊긴 발화 멈춤 1건뿐 · 같은 문장 연속은 멈춤 → 다시 재생 1건뿐. "& Pseudo- 1130" 0 · "1130" 0 · 정수만 0 · 30쪽 발화 27. 상자 판정 C 와 같음(닿지 않음) |

30쪽 발화 27 = 26 + 멈춤 → 다시 재생으로 "Hypoparathyroidism…" 한 번 더(6-4 (1), 바꾸지 않음). 8i-1b C 의 28 에서 하나 준 것이 이번에 없앤 중복이다.
콘솔 오류: 매 실행 `/favicon.ico` 404 하나뿐. 띄운 Edge 는 스크립트 `finally` 에서 닫았고 매 실행 뒤 `tasklist` 에 `msedge.exe` 없음.

### 7-6. 남은 문제 · 판단할 것

1. **[원본 보기 · 8i-1 전부터 · 고치지 않음 — 범위 밖]** 다시 그리기가 아닌 **평소 렌더**(첫 렌더·쪽 넘김)도 원본 보기에서는 `state.desc` 를 `await paintView` 앞에서 세운다. 그래서 `goToPageForSpeech` 의 폴링(200 ms)이 canvas 를 그리는 사이에 풀리면 다음 쪽 첫 발화를 시작하고, 뒤이은 `notifyPage` 의 `reload()` 가 그 문장을 처음부터 다시 읽을 수 있다(같은 모양의 경합 — 코드로만 봄, 재현 안 함). 평소 쪽 넘김 동작 불변이 조건이라 손대지 않았다. 고치려면 평소 렌더에도 "그리는 중"을 세우면 되지만(같은 `pageFresh`), 쪽 넘김 낭독 시작이 canvas 그리기만큼 늦어진다 — Review·운영자 판단.
2. **기다림이 풀리는 데 최대 `PAGE_POLL_MS`(200 ms)** — C 에서 다시 그리기 끝(596 ms) → 첫 발화(778 ms). 폴링 방식은 8i-1 그대로다.
3. 번역문 단계(`tr`)에서 멈춘 뒤 **다시 그리는 도중** 재생을 누르면 기다렸다가 원문 단계로 시작한다(대기 뒤 `play()` 는 `paused` 가 아니라 `resumeTr` 가 거짓) — 8i-1 대기 경로와 같은 성질, 좁은 틈이라 그대로 둠.
4. **지워야 할 것(`rm -rf` 금지라 지우지 않음)** — 스크래치패드 `C:/Users/YDC/AppData/Local/Temp/claude/D--01-claude-my-blog/cd66bacf-63a7-488f-8a9f-567162cf7e33/scratchpad/b8i1c/p1`(148 MB) · `b8i1c/p2`(147 MB), 합 약 295 MB. 둘 다 재추출이 끝나 새 판이라 재현에 다시 못 쓴다. `orig/`·`bak/`·`mut/`·`scripts/`·로그는 작다(1 MB 미만).
5. 마지막 `df -h /c`: **남은 공간 3.4 GB**(시작 3.3 GB — 그 사이 다른 곳에서 비워진 듯).
