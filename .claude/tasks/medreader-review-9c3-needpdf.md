# Review 지침 — 9c-3 "PDF 필요" 상태 · 재사용 경로 (+ 9c2R 고침)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "9c-3 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r9c3/`(Build 의 `b9c3/`·`b9c2/`·`r9c2/` 는 읽기만 — 하네스·합성 PDF·백업 파일 재사용). 쓸 폴더는 먼저 만들 것.

## 볼 것
spec 17-4-1(6 "PDF 필요"·"재사용 경로"·7 표 9c-3 행·"9c-3 수용 기준"·`[정정 2026-11-17 — 9c-3 Build]`·9c-2 기준 정정), 지침 `.claude/tasks/medreader-build-9c3-needpdf.md`, 보고서 `.claude/tasks/medreader-build-9c3-needpdf-report.md`(믿지 말고 다시 재라), review.md "9c-2 Review", `git diff` + 새 `tests/needpdf-9c3.test.mjs`.

## 확인할 것
1. **서재 가져오기 회귀(가장 중요)**: `library.js` +266 — 새 PDF·같은 PDF(원본 있음/없음)·같은 해시 다른 쪽수(변형 키)·다른 판·같은 파일 두 번 연달아·가져오는 중 다른 PDF·아주 큰 PDF(CMDT 2026 하나 — 읽기만, 시간 상한 안에서)에서 HEAD 와 같은 결과(문서 수·id·추출 시작·진도). `ensureBlob`·`attachBlobFor` 트랜잭션이 기존 문서 필드(진도·언어·`domain`·`readStats`)를 덮지 않는가. 원본이 생긴 뒤 "PDF 필요"가 다시 뜨지 않음(새로 불러온 뒤).
2. **입구 다섯**: 리더·검색·퀴즈 주소, 첫 부팅 리더 주소, 서재 검색 [이어서 준비] → 서재 카드 단추 초점, 빈 리더 0, 뒤로 가기가 리더로 다시 튕기지 않음. 원본 **있는** 문서는 HEAD 처럼 바로 열림. `#/vocab/<id>`·`#/usage` 등은 영향 없음.
3. **9c2R 고침**: `links.medical`·`search.recent` 합집합(겹침·상한·`null`↔배열·`[]`), 설정 꼴 검사(`defaults` 를 넘기지 않는 경로가 있는가 — 있으면 검사가 꺼지는 것), 미래 시각 자르기, `term` 없는 카드 거절, 다시 불러오기 전 [내보내기] 꺼짐, 문구 생략 두 곳. 멱등(같은 파일 두 번)이 여전한가.
4. **두 프로필 종단**(PDF 필요 경로): B 가져오기 → 다시 불러오기 → 배지 → 다른 PDF(무변) → 같은 PDF → 3쪽 번역 요청 0.
5. **화면**: 360·412 × ko·ar(+en·fr 한 번) 카드·배지·알림, 넘침 0·48px·RTL·초점 테두리·`aria-live`, `innerHTML` 0.
6. 회귀: 9c-1·9c-2, 8f-3·8c-2·18, 리더·검색·퀴즈 보통 열기, 번역 요청 본문 바이트 HEAD 와 같음. `quiz.js` CRLF 줄 끝이 섞이지 않았는가(`git diff` 바이트).
7. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
8. 변이 3개 이상 네가 고른 곳(Build M1–M8 과 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r9c3/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
9. headless: Edge, pipe, 새 프로필 `r9c3/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기). 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 서재 가져오기 회귀(문서 중복·id 바뀜·진도 잃음·원본 없음이 남음), 다른 PDF 가 붙음, 빈 리더가 남는 입구, 원본 있는 문서가 서재로 튕김, 9c2R 고침이 데이터를 잃거나 멱등을 깸, 콘솔 오류, XSS.
- **낮음**(→ "배포 가능"): 문구·실기기 확인 거리·보고서 "남은 문제" 꼴.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 의학책 읽기만(`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`), Downloads 목록 보지 말 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `r9c3/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
