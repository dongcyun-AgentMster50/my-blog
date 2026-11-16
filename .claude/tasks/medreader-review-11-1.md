# Review 지침 — 11-1 요약 서비스 · 저장 (화면 없음)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "11-1 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r11-1/`(Build 의 `b11-1/`·앞 Review 의 `r8f1/`·`r8c2/` 는 읽기만 — 대조 하네스 재사용). 쓸 폴더는 먼저 만들 것.

## 볼 것
spec 17-2-1(3·4-1·4-2·4-4·5·6·8 "11-1"·10, 그리고 `[정정 2026-11-17 — 11-1 Build]` 일곱 곳), 10-1 지시문 규칙 1–6, 13·18절 의료 안전, `.claude/tasks/medreader-crossstep-notes.md`, 지침 `.claude/tasks/medreader-build-11-1-summary-service.md`, 보고서 `.claude/tasks/medreader-build-11-1-summary-service-report.md`(믿지 말고 다시 재라), `git diff` + 새 파일(`js/text/summary.js`·`js/notes/summaries.js`·시험 둘).

## 확인할 것
1. **번역·단어 경로 불변(가장 중요)**: HEAD 판과 **네가 새로 짠** 시나리오(요약을 사이사이 부른 뒤의 번역·단어·탭, 429 를 요약이 먼저 받은 뒤 번역, capped 를 요약이 채운 뒤 번역, 같은 문단의 번역 캐시와 요약 캐시 공존)로 요청 본문·사용량 행·캐시·상태 이벤트 대조. `runJob` 기본값 `{}` 가 기존 호출 꼴을 바꾸지 않는가.
2. **지시문 안전**: 요약·개요 지시문이 규칙 1–6(DOC 밖 사실·치료 지시 금지 등)을 글자 그대로 담는가, Build 가 더한 TARGET_STYLE 한 문장(보고 남은 3)이 규칙과 부딪치지 않는가, 대상 `ko`·`fr`·`en`·`es` 원문에서 아랍어 박힘 0, DOC 구분자 탈출, **개요 범위 이름(PDF 글)이 TASK 에 들어가는 경로**(남은 4)의 인젝션 위험 — 범위 이름에 `>>>`·지시문 꼴 글을 넣어 요청 본문이 어떻게 되는지.
3. **검증·숫자 거름**: `checkSummary` 를 네가 지은 응답으로 — 지어낸 용량("500 mg"·"٥٠٠"·"0.5"·"1/2"·"10^3"·백분율·단위 붙음), 입력에 있는 숫자의 다른 꼴, 요지·요점·하위 요점 어느 쪽에 있느냐에 따른 처리, 개수·길이 자르기, `i` 어긋남·중복·누락.
4. **저장·삭제**: `notes/summaries` 대체(문단 해시·대상 언어 하나에 하나), `relocate`, `docId_pageNo` 인덱스, **`db.js` `keepsOnDocDelete` — `annotations` 스토어 전체가 남고 term 은 남고 term 캐시(aiCache)는 지워지는가, 다른 스토어 연쇄 삭제는 HEAD 와 같은가**(문서 삭제 전후 전 스토어 개수 대조). 9c 가져오기에서 문서 없는 summary·outline.
5. **출력 토큰 700/문단**: Build 실측(근사 741–1,524)을 다시 재고, 넘칠 때 실패 모양(잘린 JSON → 뒤 문단 MISSING → 캐시 저장 0·[다시 시도]만)이 안전한지(엉뚱한 문단에 요약이 붙거나 반쪽 요약이 캐시에 남지 않는지).
6. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0, `grep -rn "splitSentences" js/` HEAD 와 같음.
7. 변이 3개 이상 네가 고른 곳(Build M1–M7 과 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r11-1/bak/`).
8. headless 한 번: Edge, pipe, 새 프로필 `r11-1/p1`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS(`responseSchema` 로 갈래), 캐시 끔, **서버 띄우기 금지**(가로채기). 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 번역·단어 요청·사용량·캐시의 HEAD 대비 변화, 지시문 안전 규칙 누락·약화, 지어낸 숫자가 거름을 통과, 인젝션으로 지시문이 바뀜, 문서 삭제 연쇄 회귀(지워야 할 것이 남거나 남길 것이 지워짐), 잘린 응답이 엉뚱한 캐시를 남김, 콘솔 오류.
- **낮음**(→ "배포 가능"): 문안·실기기 확인 거리·출력 토큰 값(실측 대기)·11-2·11-3 몫.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책 읽기만, 글은 옮기지 말 것(수만). 수정 범위: `review.md` 끝 절, 스크래치패드 `r11-1/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
