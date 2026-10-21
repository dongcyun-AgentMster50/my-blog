# Build 지침 — 다듬기 묶음 1 (8g·8l·8k Review 의 작은 항목들)

> 너는 **Build 서브에이전트**다. 운영자가 "다음 묶음 작은 것들 권장대로 진행"을 승인했다(2026-10-21). 8k 까지 배포됨(`68dc331`). 이번 묶음은 **새 기능 없이** Review 들이 남긴 작은 결함·테스트 공백·문구를 정리한다.
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-polish-1-report.md`.
> 각 항목의 근거는 `apps/medreader/review.md` 의 해당 Review 절에 있다 — 먼저 읽어라. 항목 하나가 생각보다 크거나 설계 결정이 필요하면 **고치지 말고 보고서에 "결정 필요"로** 남긴다.

## 항목

### A. 8k Review(review.md "8k Review")
1. **퀴즈 첫 [읽기] 경쟁 상태**: 퀴즈 화면에 들어와 처음 누른 [읽기]만 `quizVoices` 가 `[]` 라 고른 목소리 대신 태그로 읽음 → `toggleSpeak` 에서 목록이 비면 `speechSynthesis.getVoices()` 를 동기로 읽어 `resolveSpeech` 에 넘김(Review 권고). 이 경로를 재는 동작 테스트.
2. 소스 정규식(K16)으로만 잡히던 변이 2개를 **동작 테스트**로: 번역 언어 변경 알림(`medreader:voicepref` 류) 빼기, 퀴즈 다시 고르기 빼기.
3. 낡은 주석 2곳: `js/config.js:427`(근처), `js/ui/reader.js:686`(근처)의 `pickVoice` 언급을 `resolveSpeech` 기준으로.

### B. 8l Review(review.md "8l Review")
4. UI 배선 변이 4개를 잡는 테스트: R1 판정 즉시 시작(첫 쪽 뒤·1.5초 규칙), R2 [원본 보기]가 `noticed` 를 남김, R3 검색이 판정 `final` 을 씀, R4 ▶ 큐의 인용 거르기(`isQueueEmptyHere` 가 인용만 있는 쪽을 빈 쪽으로 보는지 — 실제 의도대로).
5. 412px 에서 스캔 안내 띠의 [닫기]가 둘째 줄로 내려가는 것 — 띠 단추를 한 줄에(48px·가로 스크롤 0 유지, 360px 도).
6. 검색 화면을 연 뒤에 판정이 끝나면 그 검색엔 안내 줄이 없음 → 검색 화면이 판정 저장 이벤트를 듣고 안내 줄을 갱신.
7. ko 배너의 영어 "Dismiss"(`common.dismiss` 의 ko 값이 영어) → 한국어로. 다른 언어도 비어 있거나 영어면 같이(아랍어·프랑스어 문안은 `[검토 — Nour·운영자]` 표시).

### C. 8g-4b·8g-4b-R1 Review(review.md "8g-4b Review"·"8g-4b-R1 Review") — 인계 문서 10-19~20 절 목록
8. **R2**: 결과로 간 쪽과 같은 쪽의 목차 항목으로 간 뒤 원본↔리플로우를 오가면 스크롤과 [▶] 시작점이 옛 적중으로 되돌아감 — `doTop` 이 `S.lastJump` 를 지우지 않음.
9. 목차 이동 멈춤 안내(`search.paused`)가 띠가 없으면 안 보임 — 띠 없을 때 보일 자리(기존 배너 등)로.
10. 목차 접기 단추 이름 중복("ANSWERS" 되풀이) — 접근성 이름에 깊이·쪽 등을 붙여 구별.
11. 살아남은 변이 M3(목차 탭에서 타이핑해도 찾기 탭으로 안 감)·M4(목차 이동 뒤 멈춤 사실 안 넘김)·M9(검색 화면 떠날 때 목차 읽기 세대 안 올림)를 잡는 테스트.
12. 목차 탭으로 옮길 때 "지금 항목으로 굴림" 때문에 초점 간 탭이 화면 위로 벗어남 + 목차 탭에서 Tab 누르면 맨 위로 굴러 "지금 항목" 맞춤이 사라짐 — 탭 목록이 보이게(예: 탭 목록 sticky 또는 굴림을 목차 목록 상자 안에서만).
13. 탭 목록 `aria-label` 없음·찾기 탭 이름이 [찾기] 단추와 같음 — 구별되는 이름.
14. **흔들리는 테스트** `tests/pipeline-8a.test.mjs` M7(고정 5ms 대기) → 조건을 기다리게. 50회 반복 녹색 확인.
15. spec 정리(17-8-12 안에서만, `[정정 2026-10-21 — 다듬기 1]`): §4-6 표 두 줄(`search.toc.here` 설명, fallback 옛 문안), Build 8g-4b 보고 7절 제안 (a)(b)(c) 반영(Review 가 넣기를 권함 — 보고서 `.claude/tasks/medreader-build-8g-4b-report.md` 7절).

## 이번에 하지 않는 것 (결정 필요 — 건드리지 마라)
- 부분 OCR 문서에서 글자 있는 쪽 끝 → 빈 쪽 20쪽 넘김(8l Review (a)), speaker `reload` 시작점 밀림(8g-4b 남은 문제 ①), 412px 퀴즈 버튼 보일 때 제목 좁음(문턱 420?), Android 억양 묶음 이름 줄 숨김(8k (b)(c)), 기본 태그(8k (a)) — Nour 결과·운영자 결정 대기.

## 검증
- 항목마다 테스트(새·보강) + 고친 곳마다 되돌리는 변이 → 빨강 → 복원(**읽어서 쓰기 + `cmp`**). 백업 스크래치패드 `bp1/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1285 + 새). `stamp` 다시, `--check` 0.
- **headless Edge**(412×915·360 · ko·ar): 5·6·7·8·9·12·13 화면 확인 + 회귀(8i-3 쪽 넘김 낭독, 8i-1 B, 8g 결과 이동 뒤 [▶], 8g-4a F1, 8l 스캔본 ▶, 8k 기본 목소리 태그). 8000번 python(PID 30352)은 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125번 node 는 건드리지 마라. 프로필은 새로 만든 것 2개까지. puppeteer-core 가 필요하면 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**(Edge 가 갱신 대기로 바로 끝나면 직접 띄워 `connect`). 진짜 API 키 금지.
- **모든 실행에 시간 상한**. 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 Edge·node 정리.

## 수정 범위
위 항목에 필요한 `apps/medreader/js/*`·`css/*`·`index.html`(stamp)·`js/i18n/*`·`tests/*`, `spec.md`(17-8-12 안 정정 줄만), 스크래치패드 `bp1/`, 보고서. DB 버전·algoVersion·검색 `SEARCH.VERSION`·`SCAN.VERSION` 불변. review 금지.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, 원서 문장 40자 초과 인용. PDF 는 `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`·`C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`(퀴즈), 스캔본 확인이 필요하면 `G:/01_Language/01_English/` 원본 1개(읽기만).
