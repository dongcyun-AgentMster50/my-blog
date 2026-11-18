# Review 지침 — 15-1 AI 출제 서비스 (화면 없음)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "15-1 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\r15-1\`(먼저 만들 것). `b15-1/` 는 읽기만 — 하네스 재사용 가능.

## 볼 것
spec 17-13 전부(+ `[정정 2026-11-17 — 15-1 Build]`), 10-4(AI 출제 원래 규칙), 지침 `.claude/tasks/medreader-build-15-1-aiquiz.md`, 보고서 `.claude/tasks/medreader-build-15-1-aiquiz-report.md`(믿지 말고 다시 재라), `git diff`(기준선 HEAD a3cad4c) + 새 파일(`js/text/review.js`·`js/ai/grounding.js`·`js/review/aiquiz.js`·시험 둘).

## 확인할 것
1. **한도 낭비(가장 중요 — 보고서 남은 3)**: 한 번에 19문단을 보내고 5문항이 최대 5문단만 쓰니, 나머지 14문단이 다음 누름에 또 실린다 — 같은 글을 되풀이 보내 무료 한도를 쓰는가. 장 하나(CMDT 30쪽)를 다 쓰는 데 몇 번·몇 글자를 보내는지, 설계 15-D4·6("비용 감각: 3번 = 15문항")과 견줘라. 고칠 방향 권장안(예: 보낸 문단을 `usedParaIds` 에 넣기 / 5문항에 맞는 입력 크기 / 문단마다 1문항 요구)과 그 대가(출제 품질·grounding)를 판단.
2. **grounding 정밀도·관대함**: 합성 응답을 새로 짜서(Build 표와 다른 꼴 — 인용 앞뒤 잘림·대소문자 바뀜·리가처·하이픈 줄바꿈 결합 글자·아랍어 해설 안 숫자 `٣`·`3 of 10`→`30%`) 통과/폐기. 지어낸 인용이 2차 검사로 통과하는 꼴이 있는가(**틀린 근거로 통과 = 중간**). 20자 미만 인용 폐기·대소문자 접지 않음이 진짜 인용을 얼마나 버리는가.
3. **요청 크기**: CMDT 2026 다른 장 둘(읽기만 — `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, Downloads 목록 보지 말 것, pdf.js(Node) `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`)에서 입력+출력 토큰 ≤ `MAX_REQ_TOKENS` 8,000, 아랍어 대상일 때 프롬프트 크기. 숫자만, 글 옮기지 말 것.
4. **프롬프트**: `commonSystem(true, domain)` 규칙 1–6 글자 그대로, 언어 줄("Explanation in {Target} AND {Src}" — 설계 정정 판단), DOC 탈출(문단 글에 `"`·`\`·지시문 꼴), 보내는 것이 문단 글·paraId·pageNo 뿐(문서 제목·키·기기 정보 0).
5. **파이프라인**: `QUIZ_JOB` 이 상태 기계·gate·429·cooldown·상한·사용량을 다른 job 과 같게, 캐시 키 `extra` 에 언어, 같은 입력 0호출, 자동 호출 0(grep — `makeQuiz` 를 부르는 곳). **번역·요약·설명 요청 본문 바이트 HEAD 와 같음**(네 하네스로 다시).
6. **저장·다시 추출**: id 줄기 해시 중복 0, `sec-` 원서와 갈림, `keepsOnReset` 이 `source:'ai'` 만 남김(원서 문항은 지움), 문서 삭제 때 함께 지움, 9c 내보내기/가져오기에 AI 문항 멱등.
7. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0, 순수 grep(`ai/grounding.js`·`text/review.js`).
8. 변이 3개 이상 네가 고른 곳(Build 다섯과 다르게 — 캐시 키 하나·keepsOnReset 하나 포함) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r15-1/bak/`). 변이 적용 확인은 `cmp`·Read 로.
9. headless 한 번: Edge, pipe, 새 프로필 `r15-1/p1`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **서버 띄우기 금지**(가로채기), 합성 PDF — `makeQuiz` 요청 1건·본문 문단이 읽은 쪽만, 429 흉내 → 막힘·재시도 0. 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 같은 글을 되풀이 보내 한도를 설계 어림의 2배 넘게 씀, 지어낸·틀린 근거가 통과, 요청이 `MAX_REQ_TOKENS` 를 넘을 수 있음, 자동 호출이 생김, 번역 등 요청 본문 바뀜, 읽지 않은 쪽 글이 보내짐, 다시 추출로 AI 문항 잃음·원서 문항 남음, 9c 멱등 깨짐, 콘솔 오류, 테스트 손상.
- **낮음**(→ "배포 가능"): 실기기 폐기율·출력 예산 확인 거리, 문안, 15-2 몫.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 금지 — 시험도 절대 경로로 단독). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 금지. 서버 금지. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. **진짜 API 키·진짜 Gemini 요청 금지.** 모든 실행 10분 이내, 표준 입력 대기 금지. 끝나기 전에 띄운 백그라운드 작업은 모두 끝낼 것. Write 도구가 `\u2028`·`\uFEFF` 이스케이프를 실제 글자로 바꿔 넣는 일이 있었다 — review.md 에 덧붙인 뒤 그 글자 수 점검. 원서 글은 옮기지 말 것(숫자만). 수정 범위: `review.md` 끝 절, 스크래치패드 `r15-1/` 만. 금지: 앱 코드·테스트·spec·`dev/` 수정, 커밋, `git checkout/restore/stash`, npm·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
