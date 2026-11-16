# Review 지침 — 11-3 저장한 요약 모아 보기 · 범위 개요 · 내보내기

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "11-3 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r11-3/`(Build 의 `b11-3/`·`r11-2/`·`r11-1*/`·`r8f3b/` 는 읽기만 — 하네스 재사용). 쓸 폴더는 먼저 만들 것.

## 볼 것
spec 17-2-1(4-3·4-6·5 표 11-3 행·6·7·8 "11-3"·10, `[정정 2026-11-17 — 11-3 Build]` 세 줄), 지침 `.claude/tasks/medreader-build-11-3-summaries.md`, 보고서 `.claude/tasks/medreader-build-11-3-summaries-report.md`(믿지 말고 다시 재라), review.md "11-2 Review", `git diff` + 새 파일(`js/ui/summaries.js`·`tests/summaries-ui-11c.test.mjs`).

## 확인할 것
1. **요청 바이트·인젝션**: 번역·단어·요약 요청 본문 HEAD 와 같음(네가 새로 짠 조합). 개요 요청에 범위 이름·원문 문단 글·메모·책 제목 0 — 네가 새로 만든 인젝션 꼴 이름(유니코드 방향 제어 문자·제로폭·`</DOC>`·JSON 꼴·아주 긴 이름). 개요 지시문이 규칙 1–6 글자 그대로. 입력 초과 → 요지만 → 그래도 크면 0건.
2. **호출 수**: [개요 만들기] 1, 같은 범위·같은 요약 0, 범위·요약이 바뀌면 1, 연타 5번 → 1, 키 없음·capped·offline 0, 화면 열기·접기·내보내기·[원문으로] 0.
3. **데이터**: outline 저장 1건(대체 규칙), 문서를 지운 요약 묶음, 해시 어긋난 레코드, `router.test.mjs` NUL 바이트 편집(바뀐 것이 R1 한 줄뿐인지 바이트 비교).
4. **내보내기**: BOM·CRLF·들여쓰기·RTL·키 0(가짜 키를 저장소·요약 글·메모에 심고)·aiCache 글 0, 파일 이름, 사용자 Downloads 0.
5. **11-2R 처리**: Esc 닫기 = [×] 와 같은 취소, 늦은 결과 버림, "쪽 전체 요약 · p. N" 라벨. 그리고 Build 가 고친 11-2 결함(`.sum-link` 숨김 — `screens.css` 한 줄)이 다른 `[hidden]` 요소에 영향을 주지 않는가.
6. **회귀**: 11-2 시트·[⋯]·음성, 8f-3 단어장·`#/vocab`, 서재 카드 메뉴, 8c-2 사용량, 9c 백업 내보내기(annotations 포함), 라우터(뒤로 가기·새로고침으로 `#/summaries/:docId` 직접 열기·문서 없는 id).
7. **화면**: 360×740·412×915·915×412 × 4언어, 가로 넘침 0·48px·RTL·`<select>` 긴 이름·`aria-live`·`innerHTML` 0(요약 글·이름에 `<img onerror>`).
8. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
9. 변이 3개 이상 네가 고른 곳(Build M1–M9 와 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r11-3/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
10. headless: Edge, pipe, 새 프로필 `r11-3/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기). 콘솔 오류 0(의도한 4xx 제외).

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 요청 바이트 변화, 개요 요청에 이름·원문·메모가 들어감, 설계보다 많은 호출, 데이터 손실·중복, 내보내기에 키·캐시 글, 회귀, XSS, 콘솔 오류, 테스트 파일 손상.
- **낮음**(→ "배포 가능"): 배치·문안·실기기 확인 거리·파일 크기.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 실물 PDF 문장·요약 글은 결과에 넣지 않는다. 수정 범위: `review.md` 끝 절, 스크래치패드 `r11-3/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
