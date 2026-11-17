# Review 지침 — 20-1 필기: 앵커 · 저장 · 칠하기

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "20-1 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\r20-1\`(먼저 만들 것). Build 의 `b20-1/` 는 읽기만 — 도구 재사용 가능.

## 볼 것
spec 17-16 전부(+ `[정정 2026-11-17 — 20-1 Build]`), 지침 `.claude/tasks/medreader-build-20-1-anchor.md`, 보고서 `.claude/tasks/medreader-build-20-1-anchor-report.md`(믿지 말고 다시 재라), `git diff` + 새 파일(`js/text/anchor.js`·`js/notes/annotations.js`·`js/ui/annotate.js`·시험 둘). 기준선 = HEAD(f6cebaa).

## 확인할 것
1. **앵커 정확도 — 새 표본으로(가장 중요)**: Build 는 시드 2026·7·99 를 보며 코드를 두 번 고쳤다(문단 경계 넘는 접은 글자 찾기·동점이면 첫 줄 번호에 가까운 후보). **그 시드들이 아닌 새 시드 두 개 이상**과 **다른 책**(CMDT 2021 또는 Harrison — 읽기만)에서 200개씩: 행 표 켬 → 끔, 그리고 HEAD~1(algoVersion 12) → 13. **다른 자리(엉뚱한 곳에 칠함)를 가장 무겁게** — 고아는 설계상 허용. 짧은 인용(≤ 10자)이 쪽에 여럿인 경우를 따로 세라. 표본은 행 표 쪽 비율을 책 실제 비율로도 한 번(남은 2).
   - 책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`(읽기만, Downloads 목록 보지 말 것). pdf.js(Node) `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`. 결과에 원서 글 0(숫자만).
2. **"가까운 첫 줄 번호" 동점 규칙**이 다른 자리를 만들 수 있는 꼴(판이 바뀌어 줄 번호가 크게 움직인 쪽 — 3단·행 표)을 합성으로. 남은 1 (가)/(나) 중 권장(데이터 손실·스키마 변경 여부로).
3. **검색 회귀**: `screenIndex`·`rangesOnScreen` 옮김(같은 함수 객체 다시 내보냄) + `ui/search.js` 우선순위 두 줄 — 검색 강조·지금 결과 강조·검색 시험 전부 HEAD 와 같은가, 검색 하이라이트와 필기·낭독 겹침 우선순위(낭독 2 > 검색 1 > 필기 0)를 화소로.
4. **낭독·원본 보기 회귀**: 낭독 하이라이트·자동 굴림·원본 보기 낭독 상자 풀(`HL_MAX_BOXES`) 무변, `.anno-layer` 가 낭독 층 아래, 회전 줄 제외, 200 상한 합치기. 필기가 없는 문서에서 쪽 그리기 시간 차(필기 0 일 때 DB 읽기 한 번 — 쪽 넘김 지연).
5. **서비스**: `forPage` 인덱스 읽기, `algo` 다르고 `how ≠ exact` 일 때만 한 번 `db.patch`(두 번째 그리기에서 쓰기 0), 고아 레코드 지우지 않음, `reattach` 같은 `fileHash` 고아만, `group` 함께 지움, 문서 삭제 연쇄는 아직 지금 규칙(20-3 몫 — `CASCADE_STORES` 무변).
6. 색 토큰 네 테마 + 고대비 — 세피아·어두운 테마에서 필기 색 위 글자 대비(보고서 숫자 다시).
7. 요청 본문 바이트 HEAD 와 같음, 필기 쪽 네트워크 요청 0, 콘솔 오류 0, `innerHTML` 새 사용 0.
8. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
9. 변이 3개 이상 네가 고른 곳(Build 다섯과 다르게 — `annotations` 서비스 하나·검색 우선순위 하나 포함) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r20-1/bak/`). 변이 적용 확인은 `cmp`·Read 로.
10. headless: Edge, pipe, 새 프로필 `r20-1/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF. 3크기(360×740·412×915·915×412).

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 새 표본에서 **다른 자리 ≥ 1%** 또는 찾음 < 97%(행 표 켬→끔, 실제 비율 표본), 검색·낭독·원본 보기 회귀, 쓰기가 그리기마다 생김, 레코드 잃음, 콘솔 오류, XSS, 요청이 생김, 테스트 손상.
- **낮음**(→ "배포 가능"): 고아율 소폭·짧은 인용 동점 드묾·문안·실기기 확인 거리.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 금지 — 시험도 절대 경로로 단독). 긴 실행은 `timeout 560`, 측정은 단독으로. 프로세스 조회·디버깅 포트 금지. 서버 금지. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 원서 글은 옮기지 말 것(숫자만). 수정 범위: `review.md` 끝 절, 스크래치패드 `r20-1/` 만. 금지: 앱 코드·테스트·spec·`dev/` 수정, 커밋, `git checkout/restore/stash`(옛 판은 `git show`·`git archive`), npm·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
