# Build 지침 — 8e 가로 화면 읽기 (Nour 요청 3)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **12-8-1 "8e Build 설계 (2026-11-15 다시 맞춤)"** 전부 + 결정 **8e-D1–8e-D11 권장안**(운영자 승인 2026-11-15). 12-8 원안과 다른 곳은 12-8-1 이 이긴다(특히 8e-D4: 스크롤 자동 숨김 대신 [≡] 토글). **운영자 방침: 실기기 확인을 기다리지 않는다** — 실기기에서만 답이 나오는 것은 12-8-1 8절 "마지막 실기기 점검 묶음"과 맞춰 보고서에. 9a·9b 는 배포됨(직전 커밋은 9b 배포 커밋 — 시작할 때 `git log -1` 로 확인).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-8e-landscape-report.md`.

## 할 일 (12-8-1 의 "고칠 파일" 그대로)
1. compact 판정 `max-height: 520px`(8e-D1), 공통 상자 `.reader-dock` 으로 두 바 감싸기(8e-D2), 합친 바 구성·760px 미만 축소(8e-D3) — **9b-2 가 만든 "좁을 때 진행 표시 숨김" 클래스·속성을 다시 써라**(새로 만들지 말 것).
2. 상단바 [≡] 토글·compact 기본 숨김·세션 메모리만(8e-D4), compact 에서만 상단바 fixed + 리플로우 위 여백 고정(본문이 튀지 않게), 숨김 표식은 `html` 에(12-8-1 달라진 점 7).
3. 원본 보기: 줌 막대·추출 진행 띠도 함께 숨김, 위 여백 0(8e-D5). 번역 띠 `--tr-lines` 2(8e-D6). 팝오버 2단·폭 880·상단바 덮음(8e-D7). 전체 화면 한 줄(Aa 팝오버, 사용자 동작만, 저장 안 함 — 8e-D8). [🔍] 는 [≡] 뒤(8e-D9).
4. ko·fr 쪽 이동 문구(`reader.page.prev/next/of`) 실제 번역(8e-D10), 새 키 ×4(ar·fr `[검토 — Nour·운영자]`).
5. 세로 화면·폴드 펼침(높이 > 520)은 **픽셀 그대로** — 바뀌면 안 된다.
5b. 9b 음성 명령의 가로 고지 카드(`css/reader.css` `max-height: 500px` 규칙)는 높이 상한을 `calc(100dvh - var(--bar-top) - var(--sp-4))` 로 잡는다(테스트 W5). 두 바를 합치면 `--bar-top` 이 뜻하는 자리가 바뀌니, 합친 바 기준으로 카드가 915×412 에서 바를 덮지 않고 낮은 가로(740×360·780×330)에서 고지 글이 100% 보이는지 다시 재라. 마이크 단추(56px)와 9b 좁은 바 속성 `.tts-bar[data-bar-tight="on"]`(판정 `barTight()`·`VOICE.BAR_TIGHT_MEDIA`)은 합친 바에서도 그대로 쓰고, compact 조건을 판정에 더하는 식으로.
6. stamp 다시, `--check` 0. 설계에서 바꾼 것은 spec 12-8-1 안 `[정정 YYYY-MM-DD — 8e Build]` 줄로(그 시점에 spec 을 쓰는 다른 에이전트가 없으면 — 있으면 보고서에 초안).

## 검증
- 12-8-1 수용 기준 전부. 새 `tests/landscape-8e.test.mjs`. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회.
- headless Edge — 크기 915×412 · 800×360 · 960×412 · 830×750 · 412×915 · 360×740, ko·ar(RTL)·fr, 띠 켬/끔, 리플로우·원본 보기, 8d 문장 아래 번역: 본문 높이 표(Plan 측정과 같은 방식 — 915×412 목표 329px·띠 켬 245px), [≡] 토글 때 읽던 줄 윗변 변화 0, 단추 ≥ 48px, 가로 스크롤 0, 팝오버가 화면 안, 마이크 단추·9a 동작, **세로·펼침 픽셀 무변(전후 비교)**, 콘솔 오류 0. 스크린숏 `b8e/shots/` 4–6장.
- 변이 3개 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**), 백업 `b8e/bak/`.
- **명령은 한 호출에 한 가지 일만. 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지.** 시험 스크립트는 `try { … } finally { await browser.close() }`, 결과는 stdout 으로. 흉내 Gemini 는 OPTIONS(CORS) 처리. 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고. 이전에 쓴 포트·프로필(`b*`·`r*`·`p*` 폴더) 쓰지 마라 — 새 프로필 `b8e/p1`·새 포트.
- 8000번 python 은 떠 있다 — 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125 node 건드리지 마라. 프로필 복사 금지. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 진짜 API 키 금지. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤.

## 수정 범위
`css/tokens.css`·`css/reader.css`(필요하면 `screens.css` 최소), `index.html`(dock 마크업·stamp), `js/ui/chrome.js`(새), `js/ui/reader.js`(+5줄 내외), `js/ui/typeset.js`, `js/ui/controls.js`(필요할 때만 최소), `js/i18n/*`, `tests/`, `spec.md`(12-8-1 정정 줄), 스크래치패드 `b8e/`, 보고서. DB·algoVersion·캐시 키·`PROMPT_VERSION` 불변. review.md·`dev/` 금지.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
