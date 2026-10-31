# Review 지침 — 9a-0 실기기 진단 페이지 `dev/handsfree.html`

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"9a-0 Review"** 절로 덧붙인다(앞 절은 고치지 않는다). 통과하면 오케스트레이터가 배포한다 — **배포 판정**까지.

## 왜 이번 Review 가 평소보다 무거운가
Build 의 검증이 끝나지 않았다. 재실행 명령이 권한 규칙에 막혔고(`[Auto-Mode Bypass]` — 스크립트 수정·재실행·PowerShell 프로세스 조회를 한 호출에 묶었는데 어느 동작 때문인지 모른다), 그 뒤 진폭 선택을 더한 판은 **한 번도 실행되지 않았다.** Build 숫자(1384·111 중 101 등)는 전부 진폭 추가 전 파일 기준이다. 판정 분기 11개는 사실상 미검증이다. 운영자가 2026-10-31 "Review 가 자기 시험으로 확인"을 골랐다.

**프로세스 조회(`Get-CimInstance`·`Get-Process`·`tasklist` 등 어떤 형태든)를 하지 마라.** 브라우저는 `browser.close()` 로 닫고 디버깅 포트가 닫혔는지로 확인한다. 명령은 한 호출에 하나의 일만 담아라. **어떤 명령이든 막히면 변형을 찾지 말고 그 자리에서 멈춰 보고한다.**

## 읽을 것
spec 17-1-1 전부(특히 2절·6절·7절 표·판정 규칙·`[정정 2026-10-31 — 9a-0 Build]` 줄). 지침 `.claude/tasks/medreader-build-9a0.md`, Build 보고 `.claude/tasks/medreader-build-9a0-report.md`. 변경: 새 파일 `apps/medreader/dev/handsfree.html`, spec 한 줄. 선례 `dev/voices.html`. 직전 커밋 `691c1bc`. Build 의 `b9a0/check.cjs`·`out.txt` 는 읽기만(믿지 말고 — 네 시험은 `r9a0/` 에 따로, 시험마다 **빈 저장소에서 시작**하게. Build 는 기록이 섞이고 `pagehide` 저장이 시험 데이터를 덮어 실패 10·우연 통과 3 이 났다).

## 반드시 따질 것
1. **판정 분기 11개 전부**: 판정 규칙(spec 7절)마다 참/거짓 기록을 넣어 요약 줄이 맞는지. 경계값 포함. Build 가 정한 수치 정의(숨김 중 발화 ≥ 1 + 최대 공백 ≤ 10초 = "3분 내내", 숨김 ≥ 170초 = "3분 채움")가 spec "최대 간격 ≤ 3초"와 어긋나지 않는지 — 어긋나면 지적.
2. **`run.cut`** 고친 한 줄이 spec 대로 도는지. **새로고침·화면 복귀 뒤 기록 유지**(Build 미확인 2건).
3. **진폭 선택**: 기본 완전 무음(128 고정 — 바이트 확인), "거의 안 들리는 소리"가 128±1 안, 길이 80,044바이트·`duration` 10초, 고른 값이 다음 시작부터, 기록·[결과 복사]에 남음, A2·A3·B2·C·D 적용·A1·B1 해당 없음, 두 진폭이 섞이면 경고.
4. **앱 무변**: 앱 코드·DB·설정·앱 `localStorage` 키를 읽거나 쓰지 않음(코드 + 실측), 외부 URL·네트워크 0, `index.html`·`stamp --check` 0.

## 확인할 것
5. Media Session 코드가 실제 API 를 바르게 쓰는지(핸들러 등록·해제, `MediaMetadata`, `setPositionState` 값, `playbackState`) — 흉내만으로 맞은 것이 아닌지 코드로. Android 에서 실패할 만한 곳(사용자 동작 없는 `audio.play()`, Blob URL, `onend` 안 오는 경우).
6. 묶음 B·C 가 화면이 꺼져도 기록을 잃지 않는지(`visibilitychange`·`pagehide` 저장), 기록 상한.
7. headless Edge(412×915·360×740 · 새 프로필 2개까지): 콘솔 오류 0, 가로 스크롤 0, 단추 ≥ 48px, 모드 전환, 액션 8종·keydown 기록, [결과 복사]와 글상자 대체. 데스크톱 툴바 미디어 컨트롤은 headless 라 안 되면 "못 봄"으로 적어라.
8. 비전문가가 혼자 따라갈 수 있는지(문구·다음 할 일), 582→약 610줄 크기가 과하지 않은지, Fold 7·Nour 점검 순서(보고서 5·6절)가 실제 페이지 단추 이름과 맞는지.
9. 전체 `node --test apps/medreader/tests/*.test.mjs` 1회(1384), `git diff --check`, `.nojekyll` 있음. **배포 판정.**

## 규칙
8000번 python 은 **PID 32256** — 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125 node 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행에 시간 상한(하나에 10분 넘지 않게). 표준 입력을 기다리는 명령 금지. C: 남은 공간 5GB 아래면 멈추고 보고. 앱·dev 페이지·spec 은 고치지 않는다 — 문제는 적기만 한다. 스크래치패드는 `r9a0/` 만. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정.
