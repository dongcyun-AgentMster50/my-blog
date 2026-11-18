# Review 지침 — 15-2b 재검토 (좁게: 근거 낱말 경계 · 묶음 카드·필기 셈)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "15-2b Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지 — 덧붙인 뒤 U+2028·U+2029·U+FEFF·U+00AD·NUL·CR 수 점검). 스크래치패드 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\r15-2b\`(먼저 만들 것). `r15-2/`·`r15-1/`·`b15-2b/` 는 읽기만.

## 볼 것
review.md "15-2 Review" 절, 지침 `.claude/tasks/medreader-build-15-2b.md`, 보고서 `.claude/tasks/medreader-build-15-2b-report.md`(믿지 말고 다시 재라), 바뀐 곳: `js/ai/grounding.js`(`locate` 경계)·`js/srs/cards.js`(`isNoTrTerm`)·`js/ui/review.js`(`cardsInRange`·`notesInRange`)·시험 셋·spec 정정 줄. **기준선 = 15-2 Review 때 작업 트리** — 15-2 Review 가 이미 본 것은 다시 다 하지 말고 바뀐 곳만.

## 오케스트레이터 결정(Build 남은 2)
수 사이 `.`·`,`·`٫`·`٬` 와 글자 사이 하이픈을 낱말 일부로 보는 확장은 **유지**(`7.5`→`5…`·`non-invasive`→`invasive…` 를 막는 의료 안전 쪽). 이 결정이 맞는지가 아니라 구현이 맞는지를 본다.

## 확인할 것
1. **경계 판정 — 새 꼴로**: Build Q12 와 다른 꼴 10개 이상 — 반대 뜻 접두(`un-`·`dis-`·`hypo`/`hyper` 잘림), 수 가운데(`0.25`→`25`·`1,000`→`000`), 하이픈 낱말 반쪽, 아랍어 낱말 가운데·하라카트, 엘리전(`l'`), 따옴표·괄호 바로 안쪽에서 시작(정당 — 통과해야), 문단 처음·끝, 한국어 조사. 가운데 → 폐기, 경계 → 통과. **틀린 근거 통과 1건이라도 = 중간.**
2. **정당한 인용 손실**: `r15-1/ground.mjs`·`r15-2/ground2.mjs` 정당 꼴 중 폐기로 바뀐 수(Build 6건) 확인, 경계 맞는 다른 자리를 찾아 교정하는 길이 엉뚱한 문단으로 옮기지 않는가(같은 글이 두 문단에 — 가운데 자리 하나·경계 자리 하나).
3. **카드·필기 셈**: `isNoTrTerm` 이 `queue` 동작을 바꾸지 않음(12-3 시험 전부·네 합성), 묶음 "복습할 n" = 12-3 범위 화면(번역 빈 단어·번역 있는 단어·문장 카드 섞임), 필기 n = 20-3 범위 줄 수(쪽을 넘는 묶음). Build 남은 1(`ui/cards.js` `ranged` 사본) 판단.
4. **바이트**: 번역·요약·설명·출제 요청 본문 HEAD(a3cad4c)와 같음(출제는 15-2 Review 때 판과 같음). 바뀐 파일 특수 글자 수(CR·NUL·U+2028·U+2029·U+FEFF·U+2066–2069·U+00AD) — Build 가 Edit 사고(소프트 하이픈)를 고쳤다고 한다.
5. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0. `aiquiz-15` 시험 자료 바뀐 곳 바이트 diff(자료만).
6. 변이 3개 이상 네가 고른 곳(Build M1–M5 와 다르게 — 다른 자리 교정 하나·`isNoTrTerm` 하나 포함) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r15-2b/bak/`).
7. headless 한 번(Edge, pipe, 새 프로필 `r15-2b/p1`, 가짜 키, 흉내 Gemini, 캐시 끔, 서버 금지): 묶음 카드·필기 수 = 각 범위 화면, AI 퀴즈 근거 블록, 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 지어낸·반대 뜻 근거 통과, 교정이 엉뚱한 문단으로, 12-3 `queue` 동작 바뀜, 묶음 수 ≠ 범위 화면, 요청 본문 바뀜, 파일 손상, 콘솔 오류, 테스트 손상.
- **낮음**(→ "배포 가능"): 정당 인용 폐기(실기기 폐기율 거리)·`ranged` 사본·문안.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 금지 — 시험도 절대 경로로 단독). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 금지. 서버 금지. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. **진짜 API 키·진짜 Gemini 요청 금지.** 모든 실행 10분 이내, 표준 입력 대기 금지. 끝나기 전에 띄운 백그라운드 작업은 모두 끝낼 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `r15-2b/` 만. 금지: 앱 코드·테스트·spec·`dev/` 수정, 커밋, `git checkout/restore/stash`, npm·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
