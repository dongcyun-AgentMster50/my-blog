# Review 지침 — 8g-2b 검색 엔진 보강 (백필 실패 처리 · ③④ · 테스트 · spec 문안)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8g-2b Review"** 절로 덧붙인다(앞 절은 고치지 않는다).

## 읽을 것
지침 `.claude/tasks/medreader-build-8g-2b.md`(운영자 결정 (가) 포함), Build 보고 `.claude/tasks/medreader-build-8g-2b-report.md`, review.md "8g-2 Review"(8g2R 전부 — 탐침 P1·P2·P3·P8, 변이 M1–M21). 변경: `git diff`(engine.js · tests/search-db-8g.test.mjs · spec.md 17-8-5·17-8-12 · index.html stamp). 직전 커밋 `c35ebbf`.

## 확인할 것
1. **결정 (가)대로인가**: 백필 실패 시 reject 하지 않고 부분 결과 + `error`(ERR_DB_QUOTA / ERR_DB_OPEN), 범위(searchDoc·prepareDoc·서재 범위 열린/안 연 책), 다음 검색이 빠진 쪽만 다시 시도하는 Build 의 선택과 그 이유가 타당한지. 검색어 오류(`ERR_SEARCH_*`)와 DB 오류의 구분을 화면(8g-4)이 쓸 수 있게 결과 모양이 분명한지.
2. **③④ 수정**: `ready()` 뒤 무효화 → 다시 채움(최대 3회 → `cancelled`)의 경계, 무한 고리·세대 취소와의 상호작용. `preparing.done` 값의 뜻.
3. **Build 남은 문제 1**(캐시 채우기 읽기 실패 시 거절된 프라미스가 캐시에 남아 같은 책 검색이 계속 거절) — 재현하고 심각도·지금 고칠지(한 줄) 8g-4 몫으로 둘지 판정.
4. **테스트의 힘**: Review 변이 M7·M9·M1·M20 을 네 손으로 다시 걸어 빨강인지. M16·M17 이 "같은 동작"이라는 판단 확인. 너만의 변이 2개 이상(이번 수정 부분). 실패 주입(프로토타입 감싸기 + finally 복원)이 다른 테스트에 새지 않는지(병렬 실행·반복 실행). 복원 → `cmp`. 백업 스크래치패드 `r8g2b/bak/`.
5. 탐침 P1·P2·P3·P8 을 네가 다시 돌려 Build 보고와 같은지(스크래치패드 `r8g2/` 스크립트 재사용 가능).
6. spec 반영 8곳이 17-8-5·17-8-12 안에만 있고 Review 판정(8g2R)과 맞는지.
7. CMDT 2026 `--app` 차이 0(검색 결과 불변). pdf.js 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
8. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1126 기대), `stamp --check` 0.

## 규칙
모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 변이는 engine.js·테스트 파일에만. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8g2b/` 만. 운영자 PC 에서 OCR 일괄 작업이 돌고 있다(CPU 사용 — 시간 수치는 참고만, 레포와 무관). 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키, 원서 문장 40자 초과 인용.
