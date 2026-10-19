# Build 지침 — 8g-2c 검색 엔진: 읽기 실패가 캐시에 붙는 문제 (두 줄 + 테스트)

> 너는 **Build 서브에이전트**다. 8g-2b Review(review.md 끝 "8g-2b Review", 8g2bR-1–9)의 권장을 운영자가 승인했다(2026-10-19). 8g-2b 는 커밋됨(`f42f72e`, 미푸시 — 8g-4 와 함께 배포).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8g-2c-report.md`.

## 고칠 것 (Review 판정 그대로)
1. **`ensureLoaded` 의 캐시 채우기 읽기가 한 번 실패하면** 거절된 프라미스가 캐시에 남아, 같은 책 `searchDoc`·`prepareDoc` 과 **서재 전체 검색까지** 계속 reject 한다(`invalidate` 나 다른 책 검색 전까지). 오류도 코드가 아니라 날것(`UnknownError`)으로 나온다. → 실패하면 **캐시를 비운다**(다음 검색이 다시 읽도록). 밖으로 나가는 오류는 가능하면 `db.ERR` 코드로.
2. **`rereadDirty` 다시 읽기가 실패하면** `notePage` 의 "다시 읽어야 함" 표시가 사라져 그 쪽이 옛 글자로 남는다(Review 탐침 P10). → 실패하면 **표시를 되돌린다**.
3. 테스트 1–2개 이상(8g-2b 의 S9b 처럼 테스트 안에서 프로토타입을 감싸 실패를 주입하고 `finally` 로 복원): 읽기 한 번 실패 → 다음 검색은 정상 · 서재 전체 검색도 정상 · `rereadDirty` 실패 뒤 다음 검색이 새 글자를 찾음.

**고치지 않는 것**(8g-4 몫으로 Review 가 정리함 — 건드리지 마라): reject 를 화면이 잡는 일, `error` 접두어 구분, `onPartial` 두 번, versionchange 뒤 reject(P13), spec 문구 셋.

## 읽을 것
review.md "8g-2b Review"(특히 남은 문제 1 재현 · P10 · P13), Build 보고 `.claude/tasks/medreader-build-8g-2b-report.md`, `js/search/engine.js`, `tests/search-db-8g.test.mjs`. Review 탐침: 스크래치패드 `r8g2b/probe.mjs`.

## 검증
- 고친 두 곳을 되돌리는 변이 → 새 테스트 빨강 → 복원 → `cmp`. 백업 스크래치패드 `b8g2c/bak/`.
- Review 탐침(남은 문제 1 재현, P10)을 다시 돌려 고쳐졌는지.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1126 + 새). `stamp` 다시, `--check` 0.
- **모든 실행에 시간 상한**. 표준 입력을 기다리는 명령 금지. 띄운 node 정리.

## 수정 범위
`js/search/engine.js`, `tests/search-db-8g.test.mjs`(또는 새 테스트 파일), `index.html`(stamp 로만), 스크래치패드 `b8g2c/`, 보고서. spec·review 는 건드리지 않는다.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키. 운영자 PC 에서 OCR 일괄 작업이 돌고 있다(CPU 사용 — 레포와 무관).
