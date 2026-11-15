# Build 지침 — 9a 이어폰·잠금 화면 버튼 (Nour 필수 — 핸즈프리 1)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-1-1 "9a Build 설계"** 전부(1·3·4·5·6·8·9·10절) + 결정 **9-D1–9-D9 권장안**(운영자 승인 2026-10-31). **운영자 방침(2026-11-15): 실기기 확인을 기다리지 않는다** — 9a-0(Fold 7) 결과 없이 아래 기본값으로 만들고, 실기기에서만 답이 나오는 것은 보고서의 "마지막 실기기 점검 묶음"으로 모은다. 직전 커밋 `63b62c2`.
> **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-9a-report.md`.

## 기본값 (실기기 결과 대신)
- `HANDSFREE.SESSION = 'audio'`(무음 오디오로 세션 잡기 — 9-D1 (나)). 실기기에서 "오디오 없이도 온다"가 확인되면 값만 `'none'` 으로 바꾸는 구조 그대로.
- 9-D7 알림 위치 막대: **`setPositionState` 를 쓰지 않는다**(`null` 갈래 — 10초 반복 막대가 보일 위험을 피함). 나중에 켤 수 있게 한 곳에 모아 둔다.
- 9-D3 이어폰·알림으로 멈추면 화면 5분 유지, 9-D4 토글, 9-D5 멈춤 중 쪽 끝 ⏭ 무시, 9-D6 제목 + "쪽 n / m", 9-D8 `tts.mediaKeys`(기본 켬).
- 무음 진폭: 128 고정(9a-0 의 "거의 안 들리는 소리"는 넣지 않되, 바꿀 수 있게 상수 하나로).

## 할 일
설계 8절 표 그대로 — 새 `js/ui/handsfree.js`(`createHandsfree(deps)`·`silentWav`·`actionFor`·`playbackStateOf`), `ui/controls.js`(`pressPlay()` 빼기·배선·`leaveControls` 에서 `disarm`·디버그 훅), `ui/reader.js` `docTitle()`, `config.js` `HANDSFREE`, `settings.js` `tts.mediaKeys`, 설정 낭독 탭 한 줄(+ 잠금 화면에 책 제목이 보인다는 설명), i18n ×4(아랍어·프랑스어 `[검토 — Nour·운영자]` — 단, fr·ko 는 값을 실제로 번역해 넣어라, 영어 그대로 두지 마라). **`tts/speaker.js` 0줄, 6-4 hidden 핸들러 0줄.** 버튼 핸들러에 숨김 검사 필수(1절 빈틈). stamp 다시, `--check` 0.

## spec
**이번 Build 동안 `spec.md` 를 고치지 마라** — 같은 작업 트리에서 9b Plan 이 spec 을 쓰고 있다. 설계에서 바꾼 것·정정할 문장은 보고서의 "spec 정정 줄 초안" 절에 그대로 붙여 넣을 수 있는 꼴로 적어라(오케스트레이터가 나중에 넣는다).

## 검증
- 수용 기준 9절 `[N]` H1–H10 전부, 기존 테스트 전부(특히 `tts-speaker`·`speaker-tr`·`search-ui-8g`·`pageturn-8i3`). 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1391 + 새).
- headless Edge(412×915 · ko·ar · 가짜 키 · 흉내 음성 · 새 프로필 `b9a/p1`): `navigator.mediaSession` 이 있는 브라우저에서 [▶] 뒤 핸들러 등록·메타데이터·`playbackState`, 핸들러를 직접 불러 재생·멈춤·다음·이전, 숨김 흉내 중 무시, 서재로 나가면 해제, 띠·8d 블록·8i-3 쪽 넘김 회귀, 콘솔 오류 0.
- 변이 3개 이상(설계 10절 (a)–(f) 중) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**), 백업 `b9a/bak/`.
- **명령은 한 호출에 한 가지 일만. 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지.** 시험 스크립트는 `try { … } finally { await browser.close() }`, 결과는 stdout 으로 바로. 흉내 Gemini 는 OPTIONS(CORS) 처리. 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고. 이전에 쓴 포트(9411·9431·9451 등)·프로필(`bp*`·`rp*`)은 쓰지 마라.
- 8000번 python 은 떠 있다 — 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125 node 건드리지 마라. 프로필 복사 금지. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 진짜 API 키 금지. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤.

## 수정 범위
`js/ui/handsfree.js`(새), `js/ui/controls.js`, `js/ui/reader.js`(`docTitle` 하나), `js/config.js`, `js/settings.js`, `js/ui/settings.js`(낭독 탭 한 줄), `js/i18n/*`, `css/*`(필요할 때만), `index.html`(stamp), `tests/`, 스크래치패드 `b9a/`, 보고서. **`spec.md`·`review.md`·`dev/`·`tts/speaker.js` 금지.** DB·algoVersion·캐시 키·`PROMPT_VERSION` 불변.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
