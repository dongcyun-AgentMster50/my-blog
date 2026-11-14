# Build 지침 — 다듬기 2: 8d·8p Review 남은 항목

> 너는 **Build 서브에이전트**다. 운영자 결정(2026-10-27 "8d 남은 것도 권장대로", 2026-11-14 "다듬기 시작"). 근거는 `apps/medreader/review.md` 의 **"8d Review"(8dR-8·8dR-9·8dR-11)** 와 **"8p Review"(8pR-8·8pR-9·8pR-11)**. 직전 커밋 `fc79473`. **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-polish2-report.md`.

## 할 일 (이것만 — 각 항목 근거 절을 먼저 읽어라)
**8d (문장 아래 번역)**
1. **M1 막힘 상태 줄이 문장마다 쌓임** — 안 (가): 막힘(`offline`·`exhausted`·`no-key`·`capped`·`cooldown`·`region`)일 때 **새 문장에 상태 블록을 만들지 않는다**. 현재 문장의 것만 두고, 지나간 한 줄은 남긴다(I4 — 현재 문장 위에서 빼지 않음). `ensureCurrentBlock`·`fill` 근처 몇 줄 + 테스트.
2. **팝오버 "번역 위치" 줄 높이** — 8dR-9 (2) ②: 머리글과 두 단추를 한 줄로 합쳐(≈48px) 412×915 band 에서 처음 열었을 때 단추가 sticky 닫기 줄에 가려지지 않게. 설정 AI 탭과 같은 그리기 함수 그대로(12-3). 360×740 에서도 재고 보고.
3. **L1 상태 줄 테두리 쪽** — 상태 줄(번역문이 아닌 "번역 중…"·막힘·실패·"눌러서 보기")일 때만 블록 방향을 UI 언어로(번역문 블록은 대상 언어 그대로).
4. **L3** `view.show` 의 `inlinetr.willShow(u)` 를 try 로 감싼다 — 보조 화면 오류가 하이라이트·스크롤(`showSpoken`)을 막지 않게.
5. **L4** `trband.js` 주석 공백 되돌리기("— `(경과`").
6. **L2 테스트 빈틈** — D1 오름차순 넣기, D11 에 세 줄("현재 seg 보다 작은 캐시 적중을 넣지 않음" · "다른 쪽 큐로 다시 그리면 현재 표시 없음" · "band 에서 willShow 뒤 inline 으로 바꾸면 그 문장 블록").
7. **spec 7-7-1 수용 기준 문구** — 편안 영역 기준을 "문장 + 블록이 본문 영역에 **들어갈 수 있는 크기일 때** 위반 0"으로(8dR-9 (1) (가) 채택) + `[정정 2026-11-14 — 다듬기 2]`. 넘치는 경우는 6-5 기존 원칙("읽기 시작점이 먼저")이라는 한 줄.

**8p (번역 문체)**
8. **남은 문제 1 — 캐시 값에 `domain` 기록(진단용)**: 캐시 **값**에만, **키 불변**(7-5). 옛 캐시 값(필드 없음)도 그대로 읽힘.
9. **L2** `setDocDomain` 이 정규화한 값으로 비교(`normalizeDomain(cur.domain) === domain`) — 필드 없는 문서에서 [의학]을 눌러도 쓰지 않고 알림도 없음.
10. **L3 / R4** 리더 `onDocDomain` 의 효과(`state.doc` 갱신 → 다음 요청 문체)를 보는 테스트 한 줄.

## 검증
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1384 + 새). `stamp --check` 0, `git diff --check`.
- **번역 요청 무변**: 의학책 한 권 × ar 로 요청 본문·캐시 **키**·청크 경계가 `fc79473` 과 같은지(8p Review 방식 — 값에 `domain` 이 더해지는 것만 다름). 띠 모드(기본) DOM·`--reader-chrome-bottom` 무변.
- headless Edge(412×915·360×740 · ko·ar · 가짜 키 · 흉내 번역 · 새 프로필 1개): 1(오프라인으로 20문장 — 상태 줄 1개만 새로 생김), 2(팝오버 처음 열기 — 단추 보임), 3(ar 대상·ko UI 상태 줄 테두리), 8·9·10. 콘솔 오류 0. 스크린숏 2–3장 `bp2/shots/`.
- 변이 3개 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**), 백업 `bp2/bak/`.
- **명령은 한 호출에 한 가지 일만. 프로세스 조회(`Get-CimInstance`·`Get-Process`·`tasklist` 어떤 형태든) 금지.** 브라우저는 `browser.close()` + 디버깅 포트 닫힘 확인. 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고.
- 8000번 python 은 PID 32256 이었다 — 있으면 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125 node 건드리지 마라. 프로필 복사 금지. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 진짜 API 키 금지. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤.

## 수정 범위
`js/ui/inlinetr.js`·`js/ui/controls.js`·`js/ui/settings.js`(번역 위치 줄)·`js/ui/trband.js`(주석 한 곳)·`js/ai/readalong.js`·`js/ai/pipeline.js`(캐시 값 domain)·`js/ui/library.js`(`setDocDomain` 비교)·`js/ui/reader.js`(필요할 때만)·`css/*`·`index.html`(stamp)·`tests/`·`spec.md`(7-7-1 수용 기준 + 19-1-3 §7 정정 줄)·스크래치패드 `bp2/`·보고서. DB 버전·algoVersion·캐시 **키**·`PROMPT_VERSION`·`SEARCH`/`SCAN` 버전 불변. review.md 금지. `dev/handsfree.html` 금지.

## 금지
커밋, `git checkout/restore/stash`(옛 판은 `git show`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
