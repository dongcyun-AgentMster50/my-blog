# Review 지침 — 8j 홈 화면 설치 + 8k-0 목소리 진단 페이지

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8j Review"** 절로 덧붙인다(앞 절은 고치지 않는다). 통과하면 오케스트레이터가 배포한다 — **배포 판정**까지.

## 읽을 것
spec 19-1-1(8j·8k-0 줄, 8j 수용 기준, 점검표 2·7, E2·E3), 19-1-2(3절 6·M7). 지침 `.claude/tasks/medreader-build-8j.md`, Build 보고 `.claude/tasks/medreader-build-8j-report.md`(9절 spec 문안·남은 문제 1–4). 변경: `git status`·`git diff`(index.html) + 새 `manifest.webmanifest`·`icons/*`·`dev/make-icons.mjs`·`dev/voices.html`·`tests/manifest-8j.test.mjs`. 직전 커밋 `d2cf748`.

## 확인할 것
1. **범위**: `apps/medreader/js/` diff 0, 블로그 본체 diff 0, `.nojekyll` 있음.
2. **manifest**: 필드가 spec 대로인지, `orientation` 없음, 아이콘 5개 경로·크기·`purpose`, maskable 안전 영역(80% 원)을 **네가 PNG 를 디코드해서** 확인(그림 픽셀이 반지름 0.4×크기 안), any 아이콘이 투명 모서리 등으로 런처에서 이상하지 않은지. `id` 를 넣을지(Build 메모 — Chrome 이 `id` 없으면 `start_url` 을 씀) 의견. theme-color 두 개와 앱 테마(다크·세피아·고대비) 어긋남(Build 남은 문제 1) 심각도.
3. **서재 공유**: `start_url`·`scope` "./" 가 Pages 경로 `/my-blog/apps/medreader/` 로 풀리는지, 앱 코드가 경로에 의존하는 곳이 없는지(grep `location.pathname`·`location.href` 쓰임). **API 키가 sessionStorage 라 설치 앱 창에는 없다**(Build 메모) — 사실인지 코드로 확인하고, 사용자에게 어떤 영향인지(설치 앱에서 키를 다시 넣어야 함?) 판정 + 점검표 7 에 넣을 문구.
4. **headless Edge**(새 프로필 1개): CDP `Page.getAppManifest`·`getInstallabilityErrors` 를 **네가 다시**, manifest·아이콘 200, 콘솔 오류 0, favicon 404 사라짐, 앱 기본 동작(서재·리더·검색) 한 번.
5. **8k-0 페이지**: 앱 `voices.js` 를 **읽기만** 하는지(앱 상태·설정·IndexedDB 를 바꾸지 않는지 — 진단 페이지를 연 뒤 앱 저장소 변화 0), 단추·간격 측정이 뜻대로인지(흉내 음성), 외부 요청 0, 복사 결과에 개인 정보가 없는지(음성 목록·간격만).
6. **아이콘 생성기**: `make-icons.mjs --check` 0, npm 의존 0, SVG 와 PNG 도안 일치.
7. 네 변이 1개 이상 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**). 백업 스크래치패드 `r8j/bak/`.
8. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1244 기대), `stamp --check` 0, `git diff --check`.
9. Build 남은 문제 1–4 판정 + spec 문안(2-1 트리 아이콘 줄) 의견. **배포 판정**.

## 규칙
모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 8000번 python(PID 15088)은 쓰고 끄지 마라. 8123·8124·8125번 node 는 건드리지 마라. 진짜 API 키 금지. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8j/` 만. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제.
