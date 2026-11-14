# Build 지침 — 다듬기 3: 팝오버 가림 + 다듬기 2 Review 남은 항목

> 너는 **Build 서브에이전트**다. 운영자 결정(2026-11-15): "번역 위치" 줄이 가리면 위 여백 0 · **속도 단추 최소 폭 64 → 52px 로 줄여 한 줄에** · 다듬기 2 Review 작은 항목. 근거: `apps/medreader/review.md` 맨 끝 **"다듬기 2 Review"**(p2R-1~11 — 팝오버 실측 표·중1·하1~하4). 직전 커밋 `6786cee`. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-polish3-report.md`.

## 할 일 (이것만)
1. **팝오버 가림(중1)**: (가) "번역 위치" 줄 위 여백 0 · (나) 속도 단추 최소 폭 52px — 412px 폭에서 0.5×–1.8× 여섯 개가 한 줄. **단추 높이 48px 이상 그대로**(터치 크기), 글자가 잘리지 않게(ar·fr·en·ko). 목표: 412×915 band 에서 처음 열었을 때 "번역 위치" 단추 가림 0(ko·ar·en·fr). 360×740 은 목표 아님 — 숫자만 보고.
2. `settings.js` 주석("가려지지 않는다")을 실측에 맞게, CSS 주석 "48 유지"와 en·fr 50.5px 어긋남(하3)을 사실대로.
3. **하1 M1 사유 구분**: "이 쪽에 막힘 줄이 이미 있는지"를 볼 때 **같은 사유**인지도 본다 — 지난 오프라인 줄이 있어도 한도(`exhausted`) 등 다른 사유면 새 사유 줄 하나. 현재 문장 위에서 빼지 않음(I4) 그대로.
4. **하4** D13 에 한 줄 — `willShow` 가 문장이 바뀔 때 구독을 거두는지(Review R4 변이를 잡게).
5. **하2 spec**: 7-7-1 I5 에 M1 예외 한 줄, 정정 ⑩ 의 "52px 스크롤"을 지금 숫자로 — `[정정 2026-11-15 — 다듬기 3]`.

## 검증
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1389 + 새), `stamp --check` 0, `git diff --check`.
- headless Edge(412×915 · 360×740 · band·inline · ko·ar·en·fr · 새 프로필 `bp3/p1`): 팝오버 처음 열기 — 가림 px·스크롤 px 표(Review 표와 같은 방식으로), 속도 단추 한 줄·높이·글자 잘림 없음, 설정 AI 탭 같은 줄. M1 사유 바뀜 시나리오(오프라인 → 연결 → 한도). 띠 모드 본문 DOM 무변. 콘솔 오류 0. 스크린숏 `bp3/shots/` 2–3장.
- **시험 스크립트는 `try { … } finally { await browser.close() }`, 결과는 stdout 으로 바로.** 흉내 Gemini 는 OPTIONS 사전 요청(CORS)을 처리해야 한다(다듬기 2 Build 가 여기서 예외로 끝났다 — Review 의 `rp2/` 스크립트를 참고, 읽기만).
- 변이 3개 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**), 백업 `bp3/bak/`.
- **명령은 한 호출에 한 가지 일만. 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지.** 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고. 포트 9411·9431 과 프로필 `bp2/p1`·`rp2/p1` 은 쓰지 마라.
- 8000번 python 은 떠 있다 — 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125 node 건드리지 마라. 프로필 복사 금지. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 진짜 API 키 금지. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤.

## 수정 범위
`css/*`, `js/ui/settings.js`, `js/ui/controls.js`(속도 줄이 거기 있으면), `js/ui/inlinetr.js`(하1), `index.html`(stamp), `tests/`, `spec.md`(7-7-1 정정 줄), 스크래치패드 `bp3/`, 보고서. DB·algoVersion·캐시 키·`PROMPT_VERSION` 불변. review.md·`dev/` 금지.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
