# Build 지침 — 8g-3b 폴백 목차 품질 · 쓰레기 개요 판정

> 너는 **Build 서브에이전트**다. 운영자가 spec **17-8-12 §11** 을 승인했다(2026-10-19 E1–E6: 문턱 0.8 · R1–R10 전부 · Harry Potter 류는 일부 · 폴백 머리 문구 하나 · 단독 Build). 8g-3 은 커밋됨(`7dda130`, 미푸시 — 8g-2~4 와 함께 배포).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8g-3b-report.md`.
> **화면 변화 없음**(목차 탭은 8g-4). **저장되는 것 없음** — DB·`OUTLINE_V`·algoVersion·`SEARCH.VERSION` 불변.

## 읽을 것
- spec **17-8-12 §11 전체**(§11-1 정정 ~ §11-10 결정: 쓰레기 개요 규칙, R1–R10 정의와 예외, 버린 후보와 이유, 변경 위치, 수용 기준 **S31–S37**, 변이 **T1–T15**)
- Plan 보고 `.claude/tasks/medreader-plan-8g-3b-report.md`
- **기준 정의**: `apps/medreader/dev/measure-toc-8g3b.mjs` 의 `protoJunk`·`protoToc`·`dropReason` — 앱 구현은 이것과 **94권에서 차이 0** 이어야 한다(S36). 시제품 원자료: 스크래치패드 `p8g3b/`(`lib.mjs` 등).
- 코드: `js/text/search.js`(`headingToc`), `js/search/outline.js`(`tocOf`), `js/config.js`(`SEARCH`), 테스트 `tests/search-text-8g.test.mjs`·`tests/search-outline-8g.test.mjs`
- review.md "8g-3 Review"(쓰레기 개요·폴백 품질 근거)

## 할 일
1. `config.js` `SEARCH` 에 spec 의 상수 4개(이름·값 spec 대로).
2. `text/search.js`: `headingToc(recs, {pages})` + 순수 함수 `tocDropReason`(R1–R10, 예외 포함). 층 고르기를 정렬 한 번으로(지금 시간 이하). **책별 튜닝 금지** — 규칙은 spec 정의 그대로.
3. `search/outline.js`: `isJunkOutline`(파일 이름 꼴 ≥ 0.8 — 모든 깊이, 빈 제목 포함), `tocOf` 가 쓰레기면 폴백으로 + 결과에 `outlineIgnored`. 저장본은 건드리지 않는다.
4. 테스트 S31–S35·S37(spec 대로). 기존 테스트 기대값이 바뀌는 곳은 **spec 이 말한 하나뿐**(S17 보강의 쪽 끝 숫자 '4' 가 R9 로 빠짐) — 그 밖에 바뀌면 멈추고 보고.
5. S36: `measure-toc-8g3b.mjs` 를 94권(의학책 3 + `D:/OCR` 의 ` [OCR].pdf` 91 — **읽기만**)에 돌려 앱과 기준 정의의 차이 **0**. 의학책 S18 회귀 0(CMDT 2021 제목 45/50 이상·항목 ≤ 200, Harrison 개요 쪽 27/37 이상).
6. `node apps/medreader/dev/stamp-importmap.mjs`, `--check` 0.

## 검증
- 변이 T1–T15(spec) → 빨강 → 복원 → `cmp`. 백업 스크래치패드 `b8g3b/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1143 + 새).
- pdf.js 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
- **모든 실행에 시간 상한**. 94권 측정은 길 수 있다 — 전체 상한을 두고 넘으면 보고. 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 node 정리.

## 수정 범위
`js/config.js`(SEARCH 상수만), `js/text/search.js`(`headingToc`·`tocDropReason`), `js/search/outline.js`(`isJunkOutline`·`tocOf`), `tests/`(새·보강), `dev/measure-toc-8g3b.mjs`(앱 비교 모드 보강만 — 기준 정의는 바꾸지 마라), `index.html`(stamp 로만), 스크래치패드 `b8g3b/`, 보고서. spec·review 는 건드리지 않는다. `js/search/engine.js`·`js/ui/*` 는 건드리지 않는다.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, `D:/OCR`·G: 수정, 원서 문장 40자 초과 인용.
