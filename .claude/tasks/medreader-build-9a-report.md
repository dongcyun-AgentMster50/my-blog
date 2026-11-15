# Build 보고서 — 9a 이어폰·잠금 화면 버튼 (spec 17-1-1)

> Build 서브에이전트, 2026-11-15. 직전 커밋 `63b62c2`. **커밋하지 않았다.** `spec.md`·`review.md`·`dev/`·`tts/speaker.js` 는 건드리지 않았다(아래 git diff 확인).
> 운영자 방침대로 9a-0 실기기 결과 없이 기본값(`SESSION='audio'`, 위치 막대 끔, 진폭 128)으로 만들었다. 실기기에서만 답이 나오는 것은 끝의 "마지막 실기기 점검 묶음"에 모았다.

## 1. 바꾼 파일

| 파일 | 내용 |
|---|---|
| `js/ui/handsfree.js` (새, 392줄) | `createHandsfree(deps)` → `arm()`·`disarm()`·`refreshMeta()`·`onHidden()`·`debug()`. 순수 도우미 `actionFor`·`playbackStateOf`·`silentWav`·`positionOf`·`isReading`, 상수 `ACTIONS`(5)·`UNBOUND`(seek 3)·`ARTWORK`·`ALBUM`. import 는 `config`·`i18n` 만. 브라우저 전역·`await` 0 |
| `js/ui/controls.js` | [▶] 본문을 모듈 함수 `pressPlay()` 로 빼서 버튼(`els.play.addEventListener('click', pressPlay)`)과 handsfree 가 같이 부름 · `createHandsfree` 배선(기능 감지 `'mediaSession' in navigator` 여기 한 번) · `onPageRender → arm()` · `onLangChange → refreshMeta()` · 숨겨지면 `onHidden()`(6-4 핸들러와 **별개의 새 줄** — 6-4 블록 0줄 변경) · `leaveControls` 에서 `speaker.stop()` 뒤 `disarm()` · 디버그 훅 `__medreader.tts.handsfree()` · 무음 오디오 `makeSilentAudio(bytes)`(blob URL 탭당 하나) |
| `js/ui/reader.js` | `export function docTitle()` 하나(리더 머리와 같은 `title || fileName`) |
| `js/config.js` | `HANDSFREE = { SESSION:'audio', SILENT_SECONDS:10, SILENT_RATE:8000, SILENT_LEVEL:128, PAUSE_HOLD_MS:300000, POSITION:'off' }` |
| `js/settings.js` | `'tts.mediaKeys': true` |
| `js/ui/settings.js` | `buildMediaKeysRow(card)` — 낭독 목소리 카드(`#settingsVoices`)의 글자 체계 줄 설명 바로 뒤에 체크 줄 + 설명 한 줄(잠금 화면에 책 제목이 보인다). 저장·표시 배선 |
| `js/i18n/{ar,en,fr,ko}.js` | `settings.tts.mediaKeys` · `settings.tts.mediaKeysHint` · `handsfree.pageOf` × 4. ar·fr 머리 주석에 `[검토 — Nour·운영자]`. **fr·ko 는 실제 번역**(영어 그대로 아님 — 테스트로 고정) |
| `index.html` | 도장만(`?v=` 줄 + `handsfree.js` 한 줄). 정적 HTML 무변 |
| `tests/handsfree-9a.test.mjs` (새, 19개) | H1–H10 + 위치 막대 + 배선 소스 |
| `tests/scan-8l.test.mjs` (SC15) | [▶] 본문이 `pressPlay()` 로 옮겨져 그 본문을 보게 고침. 같은 정규식 그대로 + "버튼이 `pressPlay` 를 건다" 단언을 **더함**(약해지지 않음) |

- `tts/speaker.js` 0줄 · 6-4 hidden 핸들러 0줄(W1 이 그 블록 글자를 정규식으로 고정) · 퀴즈 speaker·readalong·trband·inlinetr 무변.
- DB·`algoVersion`·캐시 키·`PROMPT_VERSION` 불변. 호출 0. `--check` 0(“그대로다 — 모듈 62개 · CSS 4개”).
- git diff: `speaker.js`·`dev/`·`review.md` 변경 없음. `spec.md` 의 변경은 9b Plan 에이전트 몫(내가 쓰지 않음).

## 2. 동작 요약

- 판정은 speaker 상태. 읽는 중(`speaking`·`waiting-page`): play·pause → 멈춤, stop → 멈춤, ⏭/⏮ → `next()`/`prev()`. 멈춤·idle·error: play·pause → `pressPlay()`(토글 9-D4), ⏭/⏮ → 하이라이트만(쪽 끝 ⏭ 는 아무 일 없음 9-D5), stop → 없음. **숨김 중엔 전부 무시**(`ignored` +1) — 1절의 빈틈.
- `play` 핸들러는 동기로 `pressPlay()` → `speaker.play()` → `setState('speaking')` → handsfree `statechange` → `audio.play()` 까지 한 호출 안.
- 무음 오디오: 첫 읽기에서 만들고(`silentWav(10, 8000, 128)` → blob → `new Audio`, loop·volume 1·preload auto), 읽는 중 play / 그 밖 pause, `disarm` 에서 `removeAttribute('src')` + `load()`. 거부는 `audioRejects` 로만 센다.
- 재동기화: 우리가 안 부른 `pause` 가 읽는 중에 오면 한 번 `play()`(`resyncs`), 같은 문장(쪽:인덱스)에서 두 번째면 포기(`focusFights`).
- 멈춤 유지(9-D3): 액션 멈춤(pause·stop)만 `holdWakeLock(300000)` — controls 의 `requestWakeLock()` 을 그대로 부르는 **자기 sentinel**. 재생(statechange 읽는 중)·만료·숨김·떠남에서 푼다. `tts.wakeLock=false`·숨김이면 잡지 않는다. 늦게 온 잠금은 곧장 푼다.
- 메타데이터: 제목 · `handsfree.pageOf`("쪽 150 / 1,967" — `formatNumber`) · `MedReader` · 아이콘 2개. 쪽이 그려질 때·UI 언어가 바뀔 때만, 같은 값이면 다시 만들지 않는다. `linechange` 는 메타데이터를 읽지도 않는다.
- 9-D7: `POSITION:'off'` = `setPositionState` 를 **한 번도 부르지 않는다**. `'sentence'` 갈래(`positionOf` — 쪽 문장 수·인덱스)는 값만 바꾸면 켜지게 만들어 두고 테스트했다.
- `tts.mediaKeys=false` → `arm()` 이 아무것도 걸지 않는다(걸려 있었으면 거둔다). 리더에 들어올 때 읽는다.

## 3. 수용 기준 (spec 17-1-1 9절)

| # | 결과 | 근거 |
|---|---|---|
| H1 actionFor 표 전수 | ✅ | 5상태×5액션×hidden 2 = 50칸 + seek 3 → `null` + `playbackStateOf` |
| H2 동기 | ✅ | 핸들러가 돌아온 직후 `speaking`·`pressPlay` 1·`speak` 1·`audio.play` 1 |
| H3 nexttrack | ✅ | `tr` 단계 → 다음 인덱스·`src` · 쪽 끝+읽는 중 → `waiting-page`·`goToPage` 1회 → 다음 쪽 첫 문장 · 쪽 끝+멈춤 → 그대로 |
| H4 hidden 무시 | ✅ | speaker 호출 0 · `ignored` 3 → 5 · 유지 잠금 새로 안 잡음 |
| H5 상태·오디오·disarm | ✅ | idle `none` → `playing`·play 1 → waiting-page 중 play 다시 안 함 → `paused`·pause → disarm: 핸들러 5개 null·metadata null·`none`·src 없음·load 1 |
| H6 재동기화 | ✅ | 1회 다시, 같은 문장 두 번째 `focusFights` 1, 다음 문장에서 다시 1회, 우리가 부른 pause 는 안 셈 |
| H7 멈춤 유지 | ✅ | 액션 멈춤 `[300000]` 1회 · 5분에 풀림 · 화면 [⏸] 0회 · `tts.wakeLock=false` 0회 · 1분 뒤 재생 → 풀림·타이머 취소(5분 더 감아도 두 번 안 풂) · 숨김·떠남에서 풀림 |
| H8 silentWav | ✅ | 80,044 · RIFF/WAVE/`fmt `/data 위치 · 8000 · 8비트 · 모노 · 데이터 전부 128 · 진폭 상수로 바뀜 |
| H9 메타데이터 | ✅ | 제목·"Page 1 / 1967"·MedReader·아트워크 2 · linechange 두 번에 생성 0·`meta()` 호출 0 · 쪽 바뀜·ar·ko 언어 바뀜에만 새로 · 4개 언어 키 |
| H10 꺼짐 갈래 | ✅ | mediaSession 없음 → 예외 0·오디오 0 · `tts.mediaKeys=false` → setActionHandler 0 · 걸린 뒤 끄면 거둠 · `SESSION='none'` → 핸들러 5·오디오 0 · MediaMetadata 없음 → 메타데이터만 생략 |
| [N] 기존 테스트 | ✅ | 전부 통과(`tts-speaker`·`speaker-tr`·`search-ui-8g`·`pageturn-8i3` 포함) — speaker 0줄 |
| [D] 데스크톱 | ◐ | headless Edge 로 대신(아래 4) — **툴바의 글로벌 미디어 컨트롤 모양은 headless 로 볼 수 없다** → Review/운영자 데스크톱 Chrome 몫 |
| [D] 콘솔 오류 0 · 디버그 훅 | ✅ | 콘솔 오류 0 · 페이지 오류 0 · `__medreader.tts.handsfree()` 가 상태·무시 수·focusFights 를 보인다(제목은 길이도 안 냄) |
| [M] Fold 7 · Nour | — | 실기기 점검 묶음(7) |

## 4. 테스트 · headless

**node --test**: `node --test apps/medreader/tests/*.test.mjs` 2회 — **1410/1410 통과 ×2**(이전 1391 + 새 19). 실패·취소 0.

**headless Edge**(`b9a/hf.mjs` · 412×915 · ko → ar UI · ar 대상 · 가짜 키 · 흉내 음성 · 흉내 Gemini(OPTIONS 204+CORS) · 새 프로필 `b9a/p1` · 포트 9473 · CMDT 2026 150–151쪽). `navigator.mediaSession.setActionHandler` 를 감싸 핸들러를 잡고 **직접** 불렀다.

| 단계 | 결과 |
|---|---|
| 환경 | `mediaSession` ○ · `MediaMetadata` ○ |
| 리더 들어옴([▶] 전) | 핸들러 5개(play·pause·previoustrack·nexttrack·stop) · seek 0 · metadata "쪽 150 / 1,967"·MedReader·아이콘 2 · `playbackState none` · 오디오 none |
| [▶] 탭 | speaking · `playing` · 무음 오디오 **playing**(거부 0) |
| pause 핸들러 | paused · `paused` · 오디오 paused · 유지 잠금 holding |
| play 핸들러 | speaking · holding 풀림 |
| ⏭ / ⏮ | 인덱스 1 → 2 → 1 |
| 숨김 흉내 | 6-4 가 멈춤(`paused`) · 숨김 중 play·⏭·⏮·pause 4번 → 상태·인덱스 그대로, `ignored` 4, 유지 잠금 풀림 |
| 쪽 끝 ⏭ (8i-3) | 58/59 에서 ⏭ → 151쪽 · 인덱스 0 · speaking · **쪽 넘김 뒤 발화 1개**(첫 문장을 두 번 읽지 않음) · 메타데이터 "쪽 151 / 1,967" |
| 띠(8b-2) | `data-tr-band=on` · 띠 글자 181자 · 흉내 Gemini 호출 있음 |
| 8d 블록 | inline 전환 뒤 재생 → 블록 45 · 현재 블록 1 |
| UI ar | artist "صفحة 151 / 1,967" |
| 서재로 나감 | 핸들러 5개 모두 null · metadata null · `none` · 오디오 none · armed false |
| 설정 | `#settingsVoices` 안 체크 줄(켜짐) + `settings.tts.mediaKeysHint` 설명 · 가로 넘침 없음(캡처 `b9a/shots/settings-mediakeys-412-ko.png`) · 끄고 리더에 들어가면 `setActionHandler(…, fn)` 0회 · 다시 켜면 걸림 |
| ar UI [▶] | speaking · `playing` · "صفحة 150 / 1,967"(캡처 `b9a/shots/reader-ar-playing-412.png`) |
| setPositionState | 0회(9-D7 기본) |
| 콘솔·페이지 오류 | 0 · 0 |
| 바깥 요청 | pdf.js CDN(기존) · 가로챈 Gemini 뿐 |

## 5. 변이 (설계 10절 (a)–(f) 전부 · `b9a/mutate.mjs` · 백업 `b9a/bak/handsfree.js`)

| 변이 | 결과 | 빨간 테스트 |
|---|---|---|
| (a) hidden 검사 삭제(`isHidden()` → `false`) | 빨강 | H4 |
| (b) next/prev 맞바꿈 | 빨강 | H3 ×2 |
| (c) `pressPlay` 앞 `await` | 빨강 | H2(+ 비동기라 H3·H4·H6·H7·H9·H10·P·W2 도) |
| (d) 재동기화 횟수 상한 삭제 | 빨강 | H6 |
| (e) `linechange` 에서 메타데이터 갱신 | 빨강 | H9 |
| (f) `disarm` 에서 stop 의 `setActionHandler(…, null)` 빼기 | 빨강 | H5 · H10 |

(스크립트 출력의 "실패 n" 은 요약 머리줄 1개를 포함해 센 값이다 — 위 표가 실제 테스트 이름.) 복원: 읽어 둔 원본 바이트를 그대로 써서 되돌림 → 스크립트 안 `Buffer.compare` 같음 + 따로 `cmp` 0.

## 6. spec 정정 줄 초안 (오케스트레이터가 17-1-1 끝 · 9-3 표에 붙여 넣을 꼴)

17-1-1 끝(11절 표 뒤 또는 9절 아래):

> `[정정 2026-11-15 — 9a Build]` 설계와 달라진 것·더한 것: (1) **운영자 방침(2026-11-15)으로 9a-0 결과 없이 기본값**: `SESSION='audio'`(9-D1 (나)) · 9-D7 은 `setPositionState` 를 부르지 않는 갈래(아래 (2)) · 무음 진폭 128 고정. 실기기에서만 답이 나오는 것은 Build 보고서 "마지막 실기기 점검 묶음". (2) `HANDSFREE` 에 두 값을 더했다 — `SILENT_LEVEL:128`(진폭 한 곳), `POSITION:'off'|'sentence'`(9-D7 한 곳: 'off' = 부르지 않음, 'sentence' = `{duration: 쪽 문장 수, position: index, playbackRate:1}` — `queue`·`linechange` 때, `disarm` 에서 `null`). (3) `createHandsfree` 주입에 `getSetting`(`tts.mediaKeys`·`tts.wakeLock`)·`formatNumber`·`config`(테스트 덮어쓰기)를 더했고, 반환에 `onHidden()` 을 더했다 — 숨겨지면 유지 잠금만 푼다. 6-4 핸들러를 고치지 않으려고 controls 에 **별개의** `visibilitychange` 한 줄로 부른다. (4) `arm()` 은 `onPageRender` 마다 부른다(처음 한 번만 걸고, 그 뒤는 메타데이터만) — 같은 제목·"쪽 n / m"·언어면 `MediaMetadata` 를 다시 만들지 않는다. UI 언어는 `onLangChange → refreshMeta()`. 쪽 수를 모르면 "쪽 n / …". (5) 재동기화의 수는 둘로 센다 — 한 번 다시 튼 것 `resyncs`, 같은 문장에서 포기한 것 `focusFights`. 오디오 `play()` 거부는 `audioRejects`. (6) `stop` 액션의 멈춤도 "액션 멈춤"이라 유지 잠금을 쥔다. (7) 무음 오디오 blob 주소는 탭 동안 하나를 같이 쓴다(80 KB, 해제하지 않음). `disarm` 은 `removeAttribute('src')` + `load()`(`src=''` 는 문서 주소로 풀려 오류 요청이 난다). 첫 오디오는 리더 진입이 아니라 첫 읽기(`statechange`)에서 만든다. (8) 설정 줄은 정적 HTML 이 아니라 `ui/settings.js` 의 `buildMediaKeysRow` 가 낭독 목소리 카드(`#settingsVoices`)의 글자 체계 줄 설명 뒤에 만든다(8h 인용 줄과 같은 방식 — index.html 은 도장만). (9) `tests/scan-8l` SC15 는 [▶] 클릭 본문 대신 `pressPlay()` 본문을 본다. (10) 크기: `ui/handsfree.js` 392줄(추정 200–250 초과 — 주석·`positionOf` 갈래·`debug`), 테스트 19개(1391 → 1410).

9-3 설정 표(낭독 묶음, `tts.scriptSwitch` 뒤):

> | `tts.mediaKeys` | `true` | `[9a — 17-1-1 6 · 9-D8]` 이어폰·잠금 화면 버튼(Media Session). 끄면 핸들러·알림 메타데이터·무음 오디오 전부 없음 = 9a 전 동작. 리더에 들어올 때 읽는다. DB 무관 |

17-1-1 9절 수용 기준: `[N]` H1–H10·기존 테스트 → `[x]`(2026-11-15 Build, 1410/1410 ×2). `[D]` 콘솔 0·디버그 훅 → headless Edge 로 `[x]`, 툴바 글로벌 미디어 컨트롤 모양은 미확인.

## 7. 마지막 실기기 점검 묶음 (운영자 Fold 7 → Nour Realme GT 7 · 9a 배포본)

먼저 `dev/handsfree.html`(9a-0)로 답할 것 — 값만 바꾸면 되는 둘:
1. **W2 · `SESSION`** — 9a-0 A1(오디오 없이 낭독만)에서 이어폰·알림 단추가 오고 음악 앱이 안 켜지는가. **두 기기 모두** 그렇다면 `HANDSFREE.SESSION='none'` 후보.
2. **9-D7 · 위치 막대** — 9a 배포본에서 알림창을 내려 캡처: "0:00–0:10 되풀이 막대"가 보이면 `HANDSFREE.POSITION='sentence'` 로(값만), 안 보이거나 무해하면 그대로 `'off'`.

9a 배포본에서(17-1-1 9절 `[M]` 그대로 + Build 가 덧붙인 것):
3. 유선·블루투스 이어폰 각각 한 번 = 멈춤↔재생, 두 번 = 다음 문장, 세 번·길게(무엇이 오는지 기록 — 9b 의 "듣기" 단추 근거).
4. 알림창 ⏮⏯⏭ · 잠금 화면 단추 · 알림에 책 제목 · "쪽 n / m"(Nour 는 아랍어 "صفحة n / m") · 아이콘이 보이는가.
5. **다른 음악 앱이 켜지지 않는다**(이어폰 단추가 이 탭으로 온다). 낭독을 시작하면 다른 앱 음악이 멈추는 것은 기대 동작.
6. 10분 낭독 중 끊김 0 — 무음 오디오와 TTS 의 오디오 포커스 다툼(9a-0 C 와 같은 질문). 가능하면 원격 디버깅으로 `__medreader.tts.handsfree()` 의 `resyncs`·`focusFights`·`audioRejects` 를 적는다.
7. 번역 낭독(speak 모드) 중 ⏭ 가 번역을 건너뛴다 · 원본 보기 쪽 끝 ⏭ 가 다음 쪽 첫 문장을 한 번만 읽는다(8i-3).
8. 이어폰으로 멈춘 뒤 **4분** 지나 이어폰으로 재생된다(유지 잠금) · 6분 뒤에는 화면이 기기 시간 제한대로 꺼진다 · 화면 [⏸] 로 멈추면 곧바로 평소 시간 제한.
9. 전원 단추로 화면을 끄면 멈춤으로 남고(6-4), 알림도 "멈춤"으로 맞춰지는가(무음 오디오를 멈추므로 Chrome 이 맞춘다는 것은 `[가정]`). 화면이 꺼진 동안 이어폰 [재생]은 무시되는 것이 9a 동작(9-D1 (나)).
10. 진폭 128 무음이 블루투스 이어폰에서 "치—" 소리·딸깍 없이 정말 무음인가(9a-0 의 "거의 안 들리는 소리"는 넣지 않았다 — 필요하면 `SILENT_LEVEL`/생성기만).
11. 설정 > 낭독 목소리 > "이어폰·잠금 화면 버튼으로 조작"을 끄고 리더에 들어가면 알림이 안 생기고 다른 앱 음악도 안 멈춘다.
12. 유지 잠금 중·화면 켜짐에서 Wake Lock 배너가 엉뚱하게 뜨지 않는가.
13. Nour: 화면 넘김·띠·문장 아래 번역이 화면 버튼과 똑같이 움직인다.

## 8. 남은 문제 · 알릴 것

- **8000번 서버가 떠 있지 않았다**(첫 headless 실행이 `ERR_CONNECTION_REFUSED`). 지침("없으면 레포 루트에서 띄움")대로 레포 루트에서 `python -m http.server 8000 --bind 127.0.0.1` 을 백그라운드로 띄웠고 **끄지 않고 두었다.**
- `[D]` 데스크톱 Chrome 툴바의 글로벌 미디어 컨트롤(제목·"쪽 n / m"·아이콘 모양, 키보드 미디어 키)은 headless 로 볼 수 없어 확인하지 못했다 — Review 또는 운영자 몫.
- 리더에 들어올 때 메타데이터가 2번 만들어졌다(`metaBuilds` 2) — 첫 쪽 그리기가 두 번 알려지며 값(쪽 수 또는 제목)이 한 번 바뀐 것으로 보인다. 같은 값은 다시 만들지 않으므로 문장마다·같은 쪽 다시 그리기로는 늘지 않는다(H9·headless 둘 다 확인). 해롭지 않다고 판단해 손대지 않았다.
- headless 의 Wake Lock: 유지 잠금 상태(`holding`)는 맞게 바뀌었지만 실제 화면 잠금 유지는 실기기에서만 확인된다(점검 8).
- 프로필 `b9a/p1`(CMDT 를 새로 올려 IndexedDB 에 들어 있음)은 `rm -rf` 금지라 남겼다. 포트 9473 사용, 모든 실행이 `try … finally { await browser.close() }` 를 지나 결과를 찍었다(실행마다 `timeout 590` + 스크립트 안 9분 상한). 프로세스 조회·디버깅 포트 찌르기는 하지 않았다.
- 막힌 명령 없음. 한 번 `stamp` 와 `--check` 를 한 호출에 같이 돌렸다(둘 다 성공) — 그 뒤로는 한 호출에 한 가지로 지켰다.
- 스크래치: `b9a/common.mjs`(bp3 를 본뜸)·`b9a/hf.mjs`·`b9a/mutate.mjs`·`b9a/bak/handsfree.js`·`b9a/shots/`·`b9a-full1.txt`·`b9a-full2.txt`.
