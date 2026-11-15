# Review 지침 — 9a 이어폰·잠금 화면 버튼

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"9a Review"** 절로 덧붙인다(앞 절은 고치지 않는다). **배포 판정**까지.

## 동시 작업 주의
같은 작업 트리에서 **9b-1 Build 가 돌고 있다** — 새 파일만 만든다(`js/voice/commands.js`·`js/voice/listen.js`·`tests/voice-*-9b.test.mjs`). 이 파일들은 9a 범위가 아니다 — 보지도 고치지도 말고, 전체 테스트에서 이 파일 탓 실패가 나오면 그렇다고만 적어라(9a 판정에 넣지 마라). 변이는 9a 파일에만.

## 읽을 것
spec 17-1-1 전부(1·3·4·5·6·8·9·10절, 결정 9-D1–9-D9)와 오케스트레이터가 넣은 `[정정 2026-11-15 — 9a Build]` 문단·9-3 `tts.mediaKeys` 줄. 지침 `.claude/tasks/medreader-build-9a-handsfree.md`(같은 내용이 원래 `medreader-build-9a.md` 에 쓰였다 — 그 파일은 9월 다른 단계 것으로 되돌렸다), Build 보고 `.claude/tasks/medreader-build-9a-report.md`(7절 실기기 점검 묶음). 변경: `git diff`(기준 `63b62c2`) 중 9a 파일 + 새 `js/ui/handsfree.js`·`tests/handsfree-9a.test.mjs`. 운영자 방침(2026-11-15): 실기기 확인을 기다리지 않는다 — 9a-0 결과 없이 기본값(`SESSION='audio'`, `POSITION:'off'`, 진폭 128).

## 반드시 따질 것
1. **기존 동작 무변**: `tts/speaker.js` 0줄, 6-4 hidden 핸들러 0줄, [▶] 동작이 `pressPlay()` 로 옮겨진 뒤에도 같은지(Build 전후 화면 [▶]·[⏸]·[이전]·[다음]·쪽 끝 8i-3·번역 단계·8m 전환). `tts.mediaKeys=false` 면 9a 전과 같음(핸들러·메타데이터·오디오 0).
2. **숨김 검사**(설계 1절 빈틈): 숨겨진 뒤 오는 play·next·prev 가 낭독을 시작하지 않는지. 새로 넣은 별개의 `visibilitychange` 한 줄이 6-4 순서와 다투지 않는지.
3. **무음 오디오**: 첫 읽기에서만 만들고, `disarm` 에서 `removeAttribute('src')`+`load()`, blob 한 개 재사용, 오류 요청 0, 재동기화 상한(`resyncs`·`focusFights`).
4. **H1–H10** 를 테스트 이름이 아니라 내용으로 — 수용 기준과 맞는지, 약한 단언 없는지. `scan-8l` SC15 수정이 약해지지 않았는지.
5. i18n 3키 × 4언어 — fr·ko 가 실제 번역인지, ar·fr `[검토]`.

## 확인할 것
6. headless Edge(412×915 · ko·ar · 가짜 키·흉내 음성·흉내 Gemini(OPTIONS 처리) · 새 프로필 `r9a/p1`): [▶] 뒤 핸들러 5개·seek 0·메타데이터·`playing`, 핸들러 직접 호출, 숨김 흉내, 서재로 나가면 해제, 설정 줄 켬/끔, 띠·8d·8i-3 회귀, 콘솔 오류 0. **데스크톱 툴바 미디어 컨트롤은 headless 라 못 보면 "못 봄"**.
7. 너만의 변이 2개 이상(Build (a)–(f) 와 다른 것) → 복원 **읽어서 쓰기 + `cmp`**, 백업 `r9a/bak/`.
8. 실기기 점검 묶음(보고서 7절)이 빠진 것 없는지 — 9a-0 페이지로 먼저 볼 두 값(W2·9-D7) 포함.
9. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1410 + 9b-1 새 테스트가 있으면 그 수), `stamp --check` 0(9b-1 새 모듈이 import map 밖이라 영향 없는지 함께), `git diff --check`, `.nojekyll`. **배포 판정** — 배포 범위는 9a 파일만(9b-1 새 파일 제외)이라고 가정하고 판정하라.

## 규칙
**명령은 한 호출에 한 가지 일만. 프로세스 조회 금지, 디버깅 포트를 curl·fetch 로 찌르기 금지.** 시험 스크립트는 `try { … } finally { await browser.close() }`, 결과는 stdout 으로 바로. 이전에 쓴 포트·프로필(`b*`·`r*` 폴더) 쓰지 마라. 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고. 8000번 python 은 Build 가 다시 띄웠다 — 쓰고 끄지 마라. 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 앱·테스트·spec 은 고치지 않는다(변이는 되돌린다). 스크래치패드는 `r9a/` 만. 금지: 커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
