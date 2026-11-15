# Review 지침 — 8e 가로 화면 읽기

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8e Review"** 절로 덧붙인다(앞 절은 고치지 않는다). **배포 판정**까지. 운영자 위임(2026-11-15): 권장안으로 끝까지 — 판정에 필요한 결정은 권장안을 적어라.

## 읽을 것
spec 12-8-1 전부(결정 8e-D1–D11)와 Build 가 더한 "9. Build 정정"(`[정정 2026-11-16 — 8e Build]` 9줄)·실기기 묶음. 지침 `.claude/tasks/medreader-build-8e-landscape.md`(5b 포함), Build 보고 `.claude/tasks/medreader-build-8e-landscape-report.md`. 변경: `git diff`(기준 `4c57246`) + 새 `js/ui/chrome.js`·`tests/landscape-8e.test.mjs`. **범위 밖 한 줄**: `js/config.js` `VOICE.BAR_TIGHT_MEDIA` 에 `(max-height: 520px)` — 지침 5b 의 "compact 조건을 판정에 더하는 식"에 맞는지 판정.

## 반드시 따질 것
1. **세로·폴드 펼침 무변**(Nour 의 지금 화면): 412×915·360×740·830×750 × ko·ar·en·fr 에서 HEAD 와 픽셀·좌표 비교 — Build 가 말한 의도한 차이 둘(ko·fr 쪽 이동 단추 문구, Aa 팝오버 +64px)만인지. 세로의 `.reader-dock { display: contents }` 가 접근성 트리·탭 순서를 바꾸지 않는지.
2. **가로 본문 높이**: 915×412·800×360·960×412·667×375 숨김/보임 × 띠 끔/켬 — Plan 목표(915×412 329·띠 켬 245)와 맞는지, 원본 보기.
3. **[≡] 토글·회전**: 토글 때 읽던 줄 윗변 변화 0, 회전 때 발화 끊김 없음·편안 영역, 숨김일 때 Tab 이 숨은 단추로 가지 않음, `aria-expanded`.
4. **9a·9b·8d 회귀**: 이어폰(Media Session) 동작, 마이크·좁은 바(`data-bar-tight` — compact 포함), 9b 고지 카드(915×412 바 안 덮음·낮은 가로에서 글 100%), 8d 블록 편안 영역, 띠, 8i-3 쪽 넘김, 검색 화면.
5. Build 정정 9곳 각각 타당한지, `reader.js` +10줄.

## 확인할 것
6. 너만의 변이 2개 이상(Build M1–M6 과 다른 것) → 복원 **읽어서 쓰기 + `cmp`**, 백업 `r8e/bak/`.
7. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1476), `stamp --check` 0, `git diff --check`, `.nojekyll`. **배포 판정.**

## 규칙
**명령은 한 호출에 한 가지 일만. 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지.** 시험 스크립트는 `try { … } finally { await browser.close() }`, 결과는 stdout 으로. 오래 걸리는 명령은 시간 상한을 넉넉히(백그라운드로 넘기지 말 것). 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 는 금지 — 지울 일이 있으면 새 폴더 이름을 써라). 이전에 쓴 포트·프로필 쓰지 마라 — 새 프로필 `r8e/p1`. 8000번 python 은 떠 있다 — 쓰고 끄지 마라. 8123·8124·8125 node 건드리지 마라. 같은 작업 트리에서 Plan 에이전트들이 초안 파일·스크래치패드에만 쓰고 있다 — 그 파일들은 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 앱·테스트·spec 은 고치지 않는다(변이는 되돌린다). 스크래치패드는 `r8e/` 만. 금지: 커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
