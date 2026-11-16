# Review 지침 — 18 의료 사이트 북마크 + 검색어 바로가기

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "18 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r18/`(Build 의 `b18/` 는 읽기만 — 하네스·`b18/head` 재사용 가능). 쓸 폴더(`shots/` 등)는 먼저 만들 것.

## 볼 것
spec 17-9 전부(+ `[정정 2026-11-16 — 18 Build]` 넷)·13절(외부 자료·유료 DB)·3-2(`URL` 예외), 지침 `.claude/tasks/medreader-build-18-links.md`, 보고서 `.claude/tasks/medreader-build-18-links-report.md`(믿지 말고 다시 재라), `git diff` + 새 파일(`js/text/links.js`·`js/ui/links.js`·`tests/links-18.test.mjs`).

## 확인할 것
1. **보안·개인정보(가장 중요)**: `checkLink` 를 네가 새로 만든 공격 꼴로 — `javascript:`·`data:`·`vbscript:`·`blob:`·`file:`·대소문자 섞인 `HtTpS:`·앞뒤 공백·탭·줄바꿈·제어 문자·`https:\\evil`·`https:/evil`·`//evil`·IDN·IPv6·`@` 가 경로·쿼리에만 있는 정상 주소·`{q}` 가 호스트·포트·userinfo 에. `fillQuery` 결과가 다시 검증을 통과하는가, 검색어에 `{q}`·`%`·`#`·`&`·아랍어·한글·이모지. 새 탭 속성(`noopener noreferrer`·`referrerPolicy`)이 **모든** 여는 길(서재 카드·`[찾아보기]` 바로·목록·`{q}` 없는 링크)에서. 앱 탭 요청 0, 외부 사이트 접속 0.
2. **데이터**: 설정 `links.medical` — `null`↔배열, 30개 상한, 추가·수정·순서·삭제 후 새로고침, [기본 목록으로 되돌리기]가 **확인 없이** 사용자 목록을 지우는 것(보고서 남은 문제 3)이 데이터 손실인가 — 설계 17-9 2 "화면" 이 확인을 요구하는지 보고 판단. 삭제는 페이지 안 확인(`confirm()` 0).
3. **선택 줄**: `[찾아보기]` 넷째 단추 — 링크 0개 숨김·1개 바로·2개+ 목록·흐림(7낱말·61자), 낭독 중 끊김 0, 목록 Esc 층, 360px 단추 넷 줄 높이(보고서 남은 1), 목록이 고른 글자를 가림(남은 2). 8c-1·8f-2 단추·시트 회귀.
4. **화면**: 360×740·412×915·915×412 × ko·ar(+en·fr), 서재 카드(기본 접힘)·설정 카드·목록, 가로 넘침 0, 48px, 주소 칸 `dir=ltr`·`inputmode=url`, RTL, `innerHTML` 0(링크 이름에 `<img onerror>`).
5. 회귀: 번역 요청 본문 바이트 HEAD 와 같음, 8c-1 탭 띠·Esc 층·손가락, 8f-2 시트, 8f-3 단어장, 8c-2 설정·사용량, 서재.
6. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
7. 변이 3개 이상 네가 고른 곳(Build M1–M7 과 다르게 — 예: `protocol` 비교를 대소문자 무시 없이, 30개 상한 빼기, 목록 항목 열기에서 `armAnchor` 우회) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r18/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
8. headless: Edge, pipe, 새 프로필 `r18/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(8000 쓰기만 또는 가로채기), 외부 요청은 abort·기록. 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 위험한 주소가 저장·열림, 새 탭이 `opener`·referrer 를 넘김, 앱이 외부로 요청, 사용자 목록이 확인 없이 지워짐(설계가 확인을 요구하는 경우), 8c-1·8f 대비 회귀, XSS, 콘솔 오류.
- **낮음**(→ "배포 가능", 다듬기 후보로): 배치·문안·실기기 확인 거리.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. **외부 사이트 접속 금지**. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 수정 범위: `review.md` 끝 절, 스크래치패드 `r18/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
