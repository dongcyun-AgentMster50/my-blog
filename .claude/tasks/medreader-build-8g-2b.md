# Build 지침 — 8g-2b 검색 엔진 보강 (백필 실패 처리 · 작은 문제 2 · 테스트 공백 · spec 문안)

> 너는 **Build 서브에이전트**다. 8g-2 Review(review.md 끝 "8g-2 Review", 8g2R-1–9)가 조건부 통과했고 운영자가 결정했다(2026-10-19). 8g-2 는 커밋됨(`757b46f`, 미푸시 — 8g-4 와 함께 배포).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8g-2b-report.md`.

## 운영자 결정
- **백필 실패 처리 = (가)**: 엔진이 백필 실패(예: `ERR_DB_QUOTA`, versionchange 로 닫힌 연결)를 잡아, **이미 있는 쪽으로 찾은 결과에 오류 코드를 붙여** 돌려준다(reject 하지 않는다). spec "백필 중에도 이미 있는 쪽은 찾는다"와 맞춘다. 다음 검색에서 다시 백필을 시도할지(같은 오류면 바로 건너뛸지)는 네 판단 — 이유를 적어라.
- Review 의 작은 문제도 함께 고친다: ③ 검색 중 `invalidate`·삭제가 오면 옛 캐시로 결과를 내는 것(`ready()` 뒤 `stale` 확인), ④ 부분 결과의 `preparing.done` 이 늘 0 인 것.
- 테스트 공백: Review 변이 **M7**(캐시 채우는 중 `notePage` 를 버림 — 실제 동작이 달라짐, 꼭), **M9**, **M1**, **M20**(서재 범위가 안 연 책도 백필한다는 결정을 테스트로 고정). M6·M13·M16·M17 은 Review 가 "거의 같은 동작"인지 판단한 것을 보고 필요하면.
- Build 8g-2 의 **spec 문안 제안 4건 반영 승인**(Review 판정: 넷 다 맞음, 2·3 은 보강 필요): ① §6 표의 library 배선을 8g-2 행으로 ② 17-8-5 에 추가 API·결과 필드 + `preparing.done` 의 뜻 + 오류 때 동작(이번 (가)) ③ 서재 범위가 안 연 책도 백필 — S15 에 "백필이 끝난 뒤" 조건, 화면은 책별 진행을 보여야 함(8g-4 몫으로 메모) ④ S11 `truncated` = "1,000 을 넘으면".

## 읽을 것
review.md "8g-2 Review"(8g2R 전부, 특히 탐침 P1·P2·P3·P8 과 변이 표), Build 보고 `.claude/tasks/medreader-build-8g-2-report.md`(8절 문안), spec 17-8-5·17-8-12(6·7절), `js/search/engine.js`, `js/ui/library.js`, 테스트 `tests/search-*.test.mjs`. Review 탐침·변이 스크립트: 스크래치패드 `r8g2/`(`probe.mjs`·`mut.mjs`·`m7probe.mjs`).

## 할 일
1. engine.js 수정(위 결정·문제 ③④). 오류 코드는 기존 `db.ERR` 를 쓰고 새 코드가 필요하면 최소로.
2. 테스트: 백필 실패(할당량·닫힌 연결 흉내 — fake-idb 에 실패 주입 장치가 없으면 테스트 안에서 감싸서) → 부분 결과 + 오류 코드, 다음 검색 동작 · ③ · ④ · M7·M9·M1·M20.
3. spec.md **17-8-5·17-8-12 안에서만** 위 문안 4건 반영(다른 절 금지). 각 줄에 `[정정 2026-10-19 — 8g-2 Review]` 표시.
4. stamp 다시, `--check` 0.

## 검증
- 새 테스트에 대응하는 변이(고친 부분을 되돌림) + Review 의 M7·M9·M1·M20 → 빨강 → 복원 → `cmp`. 백업 스크래치패드 `b8g2b/bak/`.
- Review 탐침 P1·P2·P3·P8 을 다시 돌려 기대대로 바뀌었는지.
- `measure-search-8g.mjs --app` 으로 CMDT 2026 한 권 차이 0 유지(검색 결과 불변). pdf.js 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1117 + 새).
- **모든 실행에 시간 상한**. 표준 입력을 기다리는 명령(`python -` 등) 금지. 띄운 node 정리, 못 끄면 PID 보고.

## 수정 범위
`js/search/engine.js`, 필요하면 `js/ui/library.js`(최소), `tests/search-*.test.mjs`(또는 새 테스트 파일), `spec.md`(17-8-5·17-8-12 안), `index.html`(stamp 로만), 스크래치패드 `b8g2b/`, 보고서. `js/text/*`·`js/pdf/*`·`js/db.js` 는 꼭 필요할 때만 최소로 — 그 이유를 보고서에.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용. 다운로드 폴더 나열 금지 — PDF 는 세 경로만:
`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
