# Build 지침 — 8d 문장 아래 번역(대역) (Nour 요청 1)

> 너는 **Build 서브에이전트**다. 운영자가 권장 순서대로 진행하기로 했다(2026-10-21). 승인된 설계: spec **7-7-1 "표시 방식 설정 — 띠 / 문장 아래(대역)"** 전부(권장 (b) 누적 · 삽입 계약 **I1~I7** · 캐시에서 다시 그리기 · 세로 예산 · 모듈 · 수용 기준 8d) + 6-5 의 `[신설 2026-10-12 — 7-7-1]` 줄(편안 영역 잣대 확장) + 9-3 `readalong.display` 행 + 2710행 근처 DOM 계약 줄 + 19-1 의 8d 행. 8p 는 배포됨(`ca2665a`).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8d-report.md`.

## 설계가 쓰인 뒤(10-12) 바뀐 것 — 맞춰 넣을 것
spec 7-7-1 은 8m·8o·8p·8i-2·8i-3·8g·8k 보다 먼저 쓰였다. 아래와 부딪치면 **기존 단계의 동작을 지키는 쪽**으로 하고 7-7-1 안에 `[정정 2026-10-21 — 8d Build]` 줄로 적는다(설계를 크게 바꿔야 하면 멈추고 보고).
1. **8m**: 대상 언어와 같은 언어의 단위는 번역을 생략한다 → 블록 없음(빈 블록·"번역 중…" 도 없음). `src`(19-1-2 2절 정정 줄)는 번역 요청·캐시 키가 실제로 쓰는 값 — `paintInline` 의 키는 **readalong 이 쓰는 바로 그 키 함수**로 만든다(따로 다시 계산하지 마라). 섞인 단위는 8m 규칙 그대로.
2. **8p**: `domain` 은 캐시 키에 없다 — 바꿔도 블록은 옛 번역 그대로.
3. **8i-2 표**(제목 한 번에 읽기·2열 이름표 표) · `table-notice` · 접힌 줄: 앵커가 되는지 I2 를 따라 정하고, 표 단위의 번역 블록이 어디에 붙는지 실물(의학책 표 쪽)로 확인해 보고서에 적는다.
4. **8i-3 쪽 넘김**: 낭독이 다음 쪽으로 넘어갈 때 새 쪽에서 I4 (i) 이 돌고, 현재 문장이 움직이지 않는지.
5. **8k**·**8o**: 낭독 사본만 바꾸므로 블록 글자와 무관해야 한다(블록은 번역문 — 화면 규칙).
6. 기기: Nour 는 **Realme GT 7(412×915)**. 수용 기준의 360×740 측정과 함께 412×915 에서도 잰다.

## 할 일
1. 설정 `readalong.display ∈ {'band','inline'}`, 기본 `band`. 속도 팝오버 "번역 따라가기" 줄 아래 한 줄 + 설정 AI 탭 같은 줄(같은 키·같은 그리기 함수). 네 언어 문구(아랍어·프랑스어 `[검토 — Nour·운영자]`). DB 버전 불변.
2. `ui/inlinetr.js`(새 파일): I1~I7, `paintInline`(호출 0 — `pipeline` 을 import 하지 않는다), 상태 블록(I5, `trband.js` 와 `noteKeyFor` 공유), 늦게 온 지나간 문장의 "눌러서 보기"(I4 iii), 지우기(I7). `bididom.appendBidiText`, `innerHTML` 0.
3. `reader.js` 는 spec 이 정한 최소 변경만(`sentenceExtent` 한 줄 등). `inline` 이면 리플로우에서 `body[data-tr-band]` 끔, 원본 뷰는 늘 띠. 탭 번역은 `inline` 에서도 띠.
4. 테스트: 수용 기준 `[N]` 전부(I1 Range 불변·I2 두 문장 한 줄·300자 분할) + 8m 같은 언어 단위 블록 없음 + 키 함수 공유 + `pipeline` import 없음(grep 테스트).
5. stamp 다시, `--check` 0.
6. 덤(문서만): spec 10-1 의 "캐시 **값**(`extra` — 키 아님)" 괄호는 틀렸다(8p Review L1 — 7-5 에서 `extra` 는 키의 일부). "캐시 **값**(키 아님)" 으로 고치고 같은 줄 끝에 `[정정 2026-10-21 — 8p Review L1]`.

## 검증
- **headless Edge**(412×915 와 360×740 · 글자 22 · ko·ar · 가짜 키·흉내 번역 응답 · 흉내 음성 · 새 프로필): 수용 기준 `[D]` 전부 — I4 20문장 연속 현재 문장 윗변 변화 ≤0.5px 위반 0, 편안 영역 위반 0, 쪽 넘겼다 돌아오기 `fetch` 0·`usage.calls` 증가 0, 아랍어 괄호 속 영어 한 묶음, `band↔inline` 새로고침 없이, 원본 뷰는 늘 띠. 해커스 견본(8m 보고서 경로, 읽기만)에서 한글 단위에 블록이 없는지. 회귀: 띠 모드 그대로(8b), 8m 전환, 8o 빈칸, 8i-3 쪽 넘김, 8g 결과 이동 뒤 [▶], 10a 하이라이트, 줄 탭. 콘솔 오류 0. 스크린숏 몇 장(ko·ar inline)을 스크래치패드 `b8d/` 에 두고 보고서에 경로.
- 8000번 python(PID 30352)은 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125번 node 는 건드리지 마라. 새 프로필은 3개까지, 프로필 복사 금지. puppeteer-core 가 필요하면 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**. 진짜 API 키 금지.
- 변이 3개 이상(블록을 줄 span 안에 넣기, 지나간 문장 늦은 번역을 바로 펼치기, `paintInline` 이 요청하기, 같은 언어 단위에 블록 등) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**). 백업 스크래치패드 `b8d/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1347 + 새).
- **모든 실행에 시간 상한**(하나에 10분 넘지 않게). 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 Edge·node 정리. C: 드라이브 남은 공간이 5GB 아래면 멈추고 보고.

## 수정 범위
`js/ui/inlinetr.js`(새), `js/ui/reader.js`(spec 이 정한 최소), `js/ui/controls.js`·설정 화면(표시 방식 줄), `js/ai/readalong.js`(상태·현재 문장 알림을 inlinetr 가 받는 데 필요한 만큼), `js/ui/trband.js`(`noteKeyFor` 공유만), `js/config.js`·설정 기본값, `js/i18n/*`, `css/*`, `index.html`(stamp·자리), `tests/`, `spec.md`(7-7-1 안 정정 줄 + 10-1 괄호 하나), 스크래치패드 `b8d/`, 보고서. DB 버전·algoVersion·캐시 키·`PROMPT_VERSION`·`SEARCH`/`SCAN` 버전 불변. review.md 금지.

## 금지
커밋, `git checkout/restore/stash`(옛 판 비교는 `git show 커밋:경로 > 스크래치패드`), `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. 해커스 경로는 `.claude/tasks/medreader-build-8m-report.md`(읽기만). pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
