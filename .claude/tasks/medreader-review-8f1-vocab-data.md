# Review 지침 — 8f-1 단어장 데이터 · 단어 요청 (화면 없음)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8f-1 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8f1/`(Build 의 `b8f1/` 는 읽기만).

## 볼 것
spec 17-7-6(1·2·4-3·4-4·4-6·5 표 8f-1 행·6·8 "8f-1"·9·10, 그리고 `[정정 2026-11-16 — 8f-1 Build]` 세 줄), 17-7-2, 7-5(캐시), `.claude/tasks/medreader-crossstep-notes.md` 의 "8f-1"·"9c"·"12" 관련 줄, 지침 `.claude/tasks/medreader-build-8f1-vocab-data.md`, 보고서 `.claude/tasks/medreader-build-8f1-vocab-data-report.md`(믿지 말고 다시 재라), `git diff` + 새 파일(`js/text/vocab.js`·`js/vocab/store.js`·`tests/vocab-8f.test.mjs`·`tests/term-8f.test.mjs`).

## 확인할 것
1. **번역 경로 불변(가장 중요)**: HEAD 판(`git archive` → `r8f1/head/`)과 작업 트리에 **네가 새로 짠** 시나리오(Build 의 10개와 다르게 — 혼합 언어 문단·긴 문단 쪼개기·domain 바뀜·키 없음·capped·offline 중간 끊김·동시 요청 상한·캐시 히트 섞임·재시도 뒤 성공)를 같은 흉내 fetch 로 돌려 요청 본문·URL·사용량 행·캐시 레코드·결과·이벤트 순서 대조. `runJob` 일반화가 오류 처리·재시도 횟수·동시 수·`onWarn` 류 콜백 순서를 바꾸지 않았는가.
2. **term 요청**: 지시문·스키마·`checkTerms` 가 설계 4-3 과 맞는가, 사용자 메모·고친 번역이 요청에 0건, 한 누름 최대 1호출·`MORE`, 다른 언어 검사의 한계(라틴끼리)가 실제로 문제가 되는 경우. `TERM_PROMPT_VERSION` 과 캐시 키의 관계(지시문이 바뀌면 term 캐시가 갈리는가).
3. **데이터**: `save` 의 찾기+쓰기 한 트랜잭션(동시 두 번 저장 → 한 항목), id `'vt:'+hashHex(target+U+0001+term)` 의 충돌·정규화(대소문자·악센트·NFC), 시각 숫자 ms, `applyImport` 가 `sm2`·`dueAt`·`reviewedAt`·`introducedAt` 을 덮지 않음, `keepsOnDocDelete`(문서 삭제 → term 남음, 다른 카드 연쇄 삭제는 HEAD 와 같음), 9c 병합(`max(updatedAt, reviewedAt)`)과 맞는 꼴.
4. **CSV**: 수식 주입 방어(`=`·`+`·`-`·`@`·탭·CR 로 시작 — `'tis` 같은 정상 글은 그대로), BOM·CRLF·따옴표·줄바꿈 든 칸 왕복, 2MB·5,000줄 상한, 내보낸 파일에 키·문서 원문 과다(40자 초과 문맥?) 여부 — 설계가 정한 범위. spec 4-6 정정("같은 `updated` 에 내용이 다르면 바뀜")이 8f-3 수용 기준과 맞고 다른 경우(기기 쪽이 더 새로움)에 엉뚱한 덮어쓰기를 만들지 않는가.
5. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
6. 변이 3개 이상 네가 고른 곳(Build V1–V7 과 다르게 — 예: `runJob` 의 재시도·동시 상한·캐시 저장 조건, `save` 트랜잭션 분리, id 정규화 빼기, CSV `-` 접두 방어 빼기) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8f1/bak/`). 생존은 테스트 구멍.
7. headless 한 번(Edge 412×915, 새 프로필 `r8f1/p1`, pipe, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성, 캐시 끔): 낭독 동반 번역·탭 번역 요청 본문이 HEAD 와 같음, 콘솔 오류 0, 서재 문서 삭제가 그대로 동작(IndexedDB 에 term 카드를 직접 넣어 두고 문서 삭제 → term 남음).

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 번역 요청·캐시·사용량 행·오류 처리의 HEAD 대비 변화, 데이터 손실(덮어쓰기·연쇄 삭제·중복), CSV 수식 주입, 키 노출, term 캐시 키 충돌.
- **낮음**(→ "배포 가능", 8f-2 지침 또는 다듬기 후보로): 문안·후보 품질·실키로만 확인될 것·설계가 한계로 적은 것.
표(번호·심각도·내용·근거) + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프로 묶지 말 것, 긴 실행은 `timeout 560`). 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8f1/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
