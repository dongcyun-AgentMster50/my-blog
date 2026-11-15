# Build 지침 — 9b 다듬기: 부정어 후보 규칙 Rb + 작은 것

> 너는 **Build 서브에이전트**다. 근거: `apps/medreader/review.md` 맨 끝 **"9b-2 Review"**(9b2R-1~10 — 중-1·중-2·낮음 1–5·정보). 운영자 결정(2026-11-15): **Rb 채택** + 작은 것 모두, 8e Build 전에. 9b 는 배포됨(`89755f0`). **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-9b3-polish-report.md`.

## 할 일 (이것만)
1. **Rb**: 대안을 순서대로 보다가 **맞은 대안보다 부정된 대안을 먼저 만나면 그 누름 전체 무효**(첫 대안이 맞으면 뒤 대안의 부정어는 무시). Review 의 가정 시험 `r9b2/whatif-neg.mjs`(스크래치패드 — 읽기만)와 같은 결과가 나와야 한다: 명령 놓침 16 그대로, 부정문 반대 동작 20 → 4. 테스트로 고정(["لا توقف","توقف"] → null, ["توقف","لا توقف"] → pause 등).
2. **반대 뜻 낱말**: "slow"·«بطيء» 를 `exact` 로("too slow"·«كتير بطيء»·"it's slow" → null). `NEGATORS` 에 «بلاش»(«بلاش توقف» → null). 쉬운 동의어 더하기: «أوقف»(pause), "stop the translation"·"turn off the translation"(trOff — 지금 "stop the translation" 이 pause 로 가는 혼동을 고침). 모두 `[검토 — Nour·운영자]`.
3. 가로 915×412 에서 고지 카드가 바를 5px·마이크를 2px 덮음 → 덮지 않게.
4. `no-match` 오류 문구의 빈 따옴표 “” — 들은 말이 없으면 따옴표 없이.
5. 테스트 빈틈: Review 변이 R5(D10 안내 중 다시 탭의 `was` 이어받기)·R6(진짜 `setReadalongMode` 가 끌 때 `lastOn` 을 남김)를 잡는 테스트.
6. `ui/voice.js` 의 쓰지 않는 `commandById` import 지우기.
7. spec: 17-1-2 끝 정정 묶음 아래에 `[정정 2026-11-15 — 9b 다듬기]` 한 단락(Rb·exact 추가·NEGATORS·D4 이유 문장 고침), 13절 "음성 명령" 행의 `[가정]` 갱신(Android 는 서버 인식 — 17-1-2 2절 출처). 지금 spec 을 쓰는 다른 에이전트는 없다.
8. 실기기 점검 묶음 `.claude/tasks/medreader-device-checklist.md` 3절에 Review 9b2R-8 의 5개 더하기(V-4 대안 목록 부정어·반대 뜻 낱말·«بلاش»·«أوقف», V-7 듣는 중 이어폰 ⏯/다음·이전, V-7 오디오 포커스로 듣기 저절로 취소, V-11 가로 고지 카드).
9. stamp 다시, `--check` 0.

## 검증
- 9b-1·9b-2 Review 말뭉치(`r9b1/corpus.mjs`·`neg.mjs`·`r9b2/corpus2.mjs` — 읽기만)로 전후 표(명령 맞음·혼동·놓침·오탐·부정문 반대). 혼동("too slow"·"stop the translation"·"start over")이 줄었는지.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1455 + 새), `git diff --check`.
- headless Edge(915×412·412×915 · ko·ar · 가짜 `SpeechRecognition` · 새 프로필 `b9b3/p1`·새 포트): 고지 카드 겹침 0, 빈 따옴표 없음, Rb 동작, 콘솔 오류 0.
- 변이 3개 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**), 백업 `b9b3/bak/`.
- **명령은 한 호출에 한 가지 일만. 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지.** 시험 스크립트는 `try { … } finally { await browser.close() }`, 결과는 stdout 으로. 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고. 이전에 쓴 포트·프로필 쓰지 마라. 8000번 python 은 떠 있다 — 쓰고 끄지 마라. 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤.

## 수정 범위
`js/voice/*`, `js/ui/voice.js`, `js/ui/settings.js`(테스트에 필요할 때만), `js/i18n/*`(4번 문구), `css/*`(3번), `index.html`(stamp), `tests/`, `spec.md`(7번), `.claude/tasks/medreader-device-checklist.md`(8번), 스크래치패드 `b9b3/`, 보고서. `tts/speaker.js`·9a·review.md·`dev/` 금지.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
