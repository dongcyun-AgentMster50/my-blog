# Review 지침 — 12-1b 재검증 (고친 곳만, 짧게)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "12-1b 재검증" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r12-1b/`(`r12-1/`·`b12-1b/` 는 읽기만 — `rv.test.mjs`·`tz.mjs` 재사용). 쓸 폴더는 먼저 만들 것.

## 볼 것
review.md "12-1 Review", 지침 `.claude/tasks/medreader-build-12-1b-fix.md`, 보고서 `.claude/tasks/medreader-build-12-1b-fix-report.md`(믿지 말고 다시 재라), spec 17-11·17-4-1 `[정정 2026-11-17 — 12-1b]`, `git diff` 중 12-1b 몫(`sm2.next` 두 번째 easy 바닥, `sentenceDocKey`·`idFor`·`saveSentence` 옮김, `clampNewPerDay`, C6·C10·C10b·N5).

## 확인할 것
1. 중간 2건 닫힘: 단조성(네가 새로 짠 상태 — `next()` 로 닿는 상태만 세어 hard ≤ good ≤ easy, 닿지 않는 상태의 이상은 정보로), 카드 한 장(두 기기 같은 PDF·변형 키 `:n쪽수`·지우고 다시·세 기기·9c 두 번 가져오기).
2. 새 부작용: `saveSentence` 가 옛 카드의 docId 를 옮길 때 다른 문서의 같은 문장(다른 PDF)을 잘못 합치지 않는가(fileHash 다르면 다른 카드), `keptCount`·`list({docId})`·서재 삭제(문서 지움 뒤 남은 카드 docId) 정합, 9c `remapRecord` 그대로가 맞는가, fileHash 없는 문서 물러섬.
3. 회귀: 12-1 시험 전부·9c 병합·멱등·8f·11-1 삭제 연쇄, AI 요청 0.
4. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
5. 변이 2개 이상 네가 고른 곳(Build M1–M3·X2 와 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r12-1b/bak/`).
6. headless 하지 않아도 된다(서비스만) — 하려면 한 번(서버 띄우기 금지).

## 판정 기준 (기준선 = 12-1 Review 때의 동작)
- **중간 이상**(→ "고친 뒤 배포"): 중간 2건 남음, 다른 PDF 문장을 합침, 카드·복습 상태 잃음, 12-1b 가 새로 만든 회귀.
- 그 밖은 **낮음** → "배포 가능".
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r12-1b/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
