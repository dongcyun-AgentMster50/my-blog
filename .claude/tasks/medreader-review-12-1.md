# Review 지침 — 12-1 SM-2 · 기억 카드 서비스 (화면 없음)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "12-1 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r12-1/`(Build 의 `b12-1/`·앞 9c Review 들의 `r9c*/` 는 읽기만). 쓸 폴더는 먼저 만들 것.

## 볼 것
spec 17-11(3 SM-2 표·4 카드·7·8 "12-1"·10, `[정정 2026-11-17 — 12-1 Build]` ①–⑦), 17-4-1(9c 병합 정정 — 12-1 이 고친 카드 갈래), 3-2·9-3 정정 줄, 지침 `.claude/tasks/medreader-build-12-1-srs-service.md`, 보고서 `.claude/tasks/medreader-build-12-1-srs-service-report.md`(믿지 말고 다시 재라), `git diff` + 새 파일(`js/srs/sm2.js`·`js/srs/cards.js`·시험 둘). **Build 가 기존 시험 다섯의 기대값을 바꿨다**(문장 카드가 문서 삭제 뒤 남음 — 12-D8, 9c 문장 카드 병합) — 그 바꿈이 설계 결정에서 나온 것인지 따로 보라.

## 확인할 것
1. **SM-2 정확성**: S1–S10 을 SM-2 규칙(설계 3)으로 손 계산해 대조, 경계(ease 바닥 1.3·상한 interval 365·reps 0 hard/easy·again 뒤 다시 good·소수 반올림 누적), `previewLabels` = `next()`, `dueAt` = 그날 0시 + interval×DAY(기기 시간대 — 시리아 Asia/Damascus·서머타임 있는 시간대 둘), 순수 grep(`Date`·`document`·`window` 0).
2. **카드 서비스**: `saveSentence` id 경계·중복·대상 언어별, `review` 가 `updatedAt` 을 안 올림·`introducedAt` 처음만, `queue` 순서·새 카드 상한(`srs.log` — **DB 에서** 읽는가)·`suspended`·noTr·noBack·ISO `dueAt`, `fillBack` 주입 조회만(호출 0), `removeIfFresh`·`keptCount`.
3. **데이터·병합(가장 중요)**: 9c 병합 문장 카드 세 묶음(내용 `updatedAt`·복습 `reviewedAt`·멈춤 `suspendedAt` — 같으면 기기) — 네가 새로 짠 기기·파일 쌍으로 기기 데이터가 덮이지 않음, 멱등(두 번·세 번), 내보내기→가져오기 종단. `srs.log` 날짜 합집합·같은 날 큰 값·60일. term 멈춤 묶음. 8f-3 CSV 가져오기 뒤 `sm2`·`dueAt` 불변, 복습 뒤 `changedSince` 불변. 문서 삭제 뒤 term·sentence·annotations 남음, 다른 스토어 연쇄는 HEAD 와 같음.
4. **`suspendedAt` 새 필드**(설계는 `updatedAt` 올림이었음 — Build 가 바꿈): 단어장 화면(8f-3)·9c·12-3 이 이 필드를 알아야 하는 곳이 빠지지 않았는가, 옛 레코드(필드 없음)에서 병합이 안전한가.
5. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
6. 변이 3개 이상 네가 고른 곳(Build M1–M10 과 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r12-1/bak/`).
7. headless 한 번(Edge, pipe, 새 프로필, 가짜 키, 흉내 Gemini, 캐시 끔, 서버 띄우기 금지): 단어장·서재 삭제·9c 내보내기/가져오기가 그대로, 페이지 안에서 카드 서비스 한 바퀴(실제 IndexedDB), 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): SM-2 값 틀림, 복습 상태·내용·멈춤이 병합에서 조용히 덮임·멱등 깨짐, 새 카드 상한이 틀림(옛 `srs.log` 를 읽음), 호출이 생김, 기존 시험 기대 변경이 설계에 없는 것, 회귀, 콘솔 오류.
- **낮음**(→ "배포 가능"): 서머타임 ±1시간·문안·성능 측정 대기.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r12-1/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
