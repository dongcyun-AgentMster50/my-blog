# Build 지침 — 9a-0 실기기 진단 페이지 `dev/handsfree.html`

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-1-1 7절 "9a-0 — 실기기 진단 페이지"** 표 전부(묶음 A·B·C·D·E · 판정 규칙 · 점검표) + 6절(무음 오디오 — 10초 WAV 를 JS 로, 파일 추가 없음) · 2절(W2·W5·W6·W7) . 운영자 승인 2026-10-31(9-D1–9-D9 권장안). 직전 커밋 `691c1bc`.
> **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-9a0-report.md`.

## 읽을 것
spec 17-1-1 전부. 같은 꼴의 선례 `apps/medreader/dev/voices.html`(8k-0 — 머리·[결과 복사]·문구 방식). `.claude/tasks/medreader-8k-carryover.md`(Nour 기기). `medreader-plan-9a-report.md`(Fold 7 확인 순서·Nour 점검표 초안).

## 할 일
1. `apps/medreader/dev/handsfree.html` 하나(약 350–400줄, 자체 완결 — 스크립트·스타일 안에). **앱 무변**: 앱 DB·설정을 읽지도 쓰지도 않고, 앱 모듈을 import 하지 않으며, 외부 자원·네트워크 0, `index.html` import map 무관.
2. 묶음 A~E 를 spec 표대로. 모드 1·2·3, 모든 액션 기록 핸들러(`play`·`pause`·`nexttrack`·`previoustrack`·`stop`·`seekforward`·`seekbackward`·`seekto`), `keydown`, 오디오 요소 이벤트, `visibilitychange`, 발화 start·end·error 를 시각(ms)과 함께. 낭독은 액션을 받아도 계속(기록만). 시작은 사용자 누름으로만.
3. 기록은 이 페이지 전용 `localStorage` 키 하나(앱 키와 겹치지 않는 이름, 예 `medreader.dev.handsfree.v1`)에 — 화면을 끄고 돌아와도 남게, 상한을 둬서 넘치지 않게. [기록 지우기]·[결과 복사](`navigator.clipboard` 실패 시 선택 가능한 글상자로 — HTTP·권한 거부 대비). 결과 안에 **판정 규칙을 적용한 한 줄 요약**(예: "모드 1 버튼 받음/못 받음 · 숨김 중 발화 n · 최대 간격 s")을 넣되 결정은 사람이 함.
4. 412×915·360×740 에서 쓸 수 있게(단추 ≥ 48px, 가로 스크롤 0), ko/en 문구 + 아랍어 한 줄 안내(`[검토 — 운영자]`). 지금 어느 모드가 도는지·다음에 할 일이 큰 글자로 보이게 — 비전문가가 혼자 따라갈 수 있어야 한다.
5. 무음 WAV: 10초, JS 로 생성(Blob URL), `<audio loop>`. 5초 넘는 미디어여야 알림이 생긴다(2절). 진폭 0 이 알림을 막는지 몰라 — 진폭 0 을 기본으로 하되 spec 6절대로 따른다.
6. spec 은 17-1-1 7절 안에 `[정정 2026-10-31 — 9a-0 Build]` 줄만(바꾼 것이 있을 때). 수동 점검 순서 **Fold 7 용·Nour 용**을 보고서에(Nour 것은 운영자가 아랍어로 옮길 초안).

## 검증
- 앱 무변: `git status` 에 `dev/handsfree.html`·spec·보고서만. `stamp --check` 0(dev 는 대상 밖이어야 — 확인). 전체 `node --test apps/medreader/tests/*.test.mjs` 1회(1384). `grep` 으로 외부 URL 0, 앱 import 0.
- headless Edge(412×915 · 360×740): 페이지 열기, 콘솔 오류 0, 가로 스크롤 0, 모드 전환, `navigator.mediaSession` 흉내로 액션을 발화시켜 기록이 쌓이는지, 새로고침 뒤 기록 유지, [결과 복사] 글 내용, 무음 WAV 길이 10초(오디오 요소 `duration`). 데스크톱에서 모드 2 의 툴바 미디어 컨트롤이 보이는지는 가능하면(headless 라 안 되면 보고서에 적고 Review 로).
- 8000번 python 은 **PID 45964** 였다 — 있으면 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125번 node 건드리지 마라. 새 프로필 1개, 프로필 복사 금지. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` **읽기만**. Edge 는 `browser.close()` 로 닫고 포트 확인.
- **모든 실행에 시간 상한**(하나에 10분 넘지 않게). 표준 입력을 기다리는 명령 금지. C: 남은 공간 5GB 아래면 멈추고 보고.

## 수정 범위
`apps/medreader/dev/handsfree.html`(새), `spec.md`(정정 줄만), 스크래치패드 `b9a0/`, 보고서. 앱 코드·테스트·review.md·`index.html`·`.nojekyll` 금지.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `G:`·`D:/OCR` 수정, 진짜 API 키.
