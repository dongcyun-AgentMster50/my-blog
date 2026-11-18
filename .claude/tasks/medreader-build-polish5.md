# Build 지침 — 다듬기 5 (화면·문구·시험 틈 · 19 링크만)

> 너는 **Build 서브에이전트**다. 배포된 단계들의 Review "낮음" 중 화면·문구·시험 틈을 모아 고치고, 19(사례 이미지)를 **링크만**으로 넣는다(19-Q1 운영자 결정 전 — 앱이 Open-i 에 직접 요청하지 않음). 출처는 `.claude/tasks/medreader-crossstep-notes.md` "다음 다듬기 묶음 후보"·review.md 각 절. 운영자 위임: 권장안으로. AI 호출 0 변경. DB 3 · 판본 상수 불변. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-polish5-report.md`. 스크래치패드 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\bp5\`(먼저 만들 것). 다듬기 4 는 배포됨 — 그 보고서(`.claude/tasks/medreader-build-polish4-report.md`)·review.md "다듬기 4 Review" 절에서 넘긴 것이 있으면 함께.

## 고칠 것 (각각 작게 — 하나가 커지면 멈추고 "못 함 + 이유")
1. **12-3 복습 키 1–4 가 아랍-인도 숫자(`١`–`٤`) 자판에서 안 됨**: `ev.key` 에 더해 `ev.code`(`Digit1`–`Digit4`·`Numpad1`–`4`)와 `١٢٣٤`·`۱۲۳۴` 받기.
2. **13-2 시험일 당일에 "시험일이 지났습니다"**·서재 줄 정렬에서 밀림: 당일 갈래 문구("오늘 시험입니다") + 정렬은 가까운 날 순(오늘 = 0). ar 요일 칩이 낱말 가운데 꺾임 → `Intl` `weekday:'narrow'` 또는 칩 최소 폭(ar 에서 두 글자 이상이면 `short`, 넘치면 `narrow`).
3. **19 링크만**(spec 17-15 2-4): `config.js` `LINKS.SUGGESTED` 에 `{id:'openi', name:'Open-i (NLM)', url:'https://openi.nlm.nih.gov/gridquery?q={q}&it=x', check:'unverified'}` 한 줄. 18 [찾아보기] 추천에 나타남(새 탭·`rel="noopener noreferrer"`). 의료 안전 고지는 18 의 고지 그대로. 앱 요청 0.
4. `ui/cards.js` `ranged` 의 번역 빈 단어 규칙 사본 → `srs/cards.js` `isNoTrTerm` 하나로(15-2bR #5).
5. fr `nav.back`·`common.cancel` 이 영어 → 프랑스어(`Retour`·`Annuler`) `[검토 — Nour·운영자]`. ko `common.cancel`·`library.card.delete` 도 영어("Cancel"·"Delete" — 다듬기 4 남은 6) → 한국어. 다듬기 4 의 분 한도 문구가 아직 안 들어간 화면(단어장·단어 시트·저장한 요약·복습 묶음·개념도 — 다듬기 4 남은 2)도 같은 키로. 4언어 사전에서 en 과 글자가 같은 값을 grep 해 표로(고칠 것만 — 고유명·약어는 그대로).
6. **시험 틈 채우기**(변이가 살아남았던 것): `grounding-15` Q12 에 물결 대시 `〜`·`^+` 지수 꼴(15-2eR W2·W4) · 20-3 `reattach` 한 트랜잭션 동작 시험(20-3R r1) · 필기 내보내기 "보이는 줄만" node 시험(r3) · 20-3 D5 "묶음 조각 하나라도 찾으면 고아 아님"(r5) · 8q 3단 퍼즈 "줄 수·글자 보존" 불변 시험 하나(8qbR #5). 각 시험은 그 변이를 다시 넣어 빨강 확인.
6b. 다듬기 4 에서 넘긴 시험 틈: `leaveLinksSettings` 가 열린 대화를 cancel 길로 닫는다는 node 단언(P4cR R7) · 서재로 돌아왔을 때 초점이 BODY(P4bR 낮음-2) — 서재 첫 카드 또는 [PDF 가져오기]로.
7. 서재 상태 줄 "필기·요약 n건"(레코드 수) 대 화면·칩 묶음 수 — 같은 셈(20-3R #4).
9. 16 개념도 라벨 단위 토큰을 **글자 체계가 바뀌는 곳에서 끊기**(`mg을`→`mg`, `mEq/L로`→`mEq/L`) — `js/text/numexpr.js` `numberChunkUnits` 몇 줄(이 항목만 수정 허용). 값이 바뀐 라벨은 여전히 버림(`r16-2/labels.mjs`·`labels2b.mjs` 읽기만 — 사본으로, "값이 바뀐 채 통과" 0 유지), 15 하네스 7벌(`r16-2/h15.mjs` 사본) 바이트 같음.
8. 12-3 간격 단위 복수(ar «10 دقيقة»·«4 يوم», fr «2 an») — `Intl.PluralRules` 로.

## 검증
- 항목마다 시험과 변이 하나 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**, 백업 `bp5/bak/`).
- 회귀: 12-3 복습·13-2 계획·서재 "오늘" 줄·18 링크 설정·12-3 범위 화면·20-3 필기 화면·내보내기. 요청 본문 바이트 HEAD 와 같음, 요청 0(19 는 새 탭만).
- 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회. stamp 다시(단독), `--check` 0, `git diff --check` 0. 바뀐 파일 특수 글자 수 HEAD 와 같음.
- headless: Edge, pipe, 새 프로필 `bp5/p*`, 가짜 키, 흉내 Gemini, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**, 합성 PDF. 360×740·412×915 × 4언어(바뀐 화면만). 콘솔 오류 0. 스크린샷 2–4장.
- spec 해당 절에 `[정정 2026-11-18 — 다듬기 5]` 줄, 17-15 머리에 "19 = 링크만 배포(19-Q1 결정 전)" 한 줄.

## 수정 범위
`js/ui/cards.js`·`js/ui/planner.js`·`js/ui/library.js`·`js/config.js`(LINKS 한 줄)·`js/srs/cards.js`(export 만)·i18n 4개·`index.html`(stamp)·`tests/`·`spec.md`·스크래치패드·보고서. 시험 틈 6번은 `tests/` 만(앱 코드 무변). `ai/*`·`db.js`·`backup/*`·`speaker.js`·`text/columns.js`·review.md·`dev/` 금지.

## 규칙
**명령은 한 호출에 한 가지 일만 — `cd … &&`·파이프·`; echo` 로 묶지 말 것**. 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 읽기만. 프로필 복사 금지. **진짜 API 키·진짜 요청 금지.** 모든 실행 10분 이내. 끝나기 전에 띄운 백그라운드 작업은 모두 끝낼 것. Write/Edit 이스케이프 사고 주의(쓴 뒤 특수 글자 점검). 금지: 커밋, `git checkout/restore/stash`, npm·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
