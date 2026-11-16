# Review 지침 — 8f-2 단어 시트

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "8f-2 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r8f2/`(Build 의 `b8f2/`·앞 Review 의 `r8c1c/` 는 읽기만 — 하네스 재사용 가능).

## 볼 것
spec 17-7-6(3·4-2·4-3·4-5·5 표 8f-2 행·6·7·8 "8f-2"·9·10, 그리고 17-7-6 안의 모든 `[정정 2026-11-16 …]` 줄 — 특히 `8f-2 Build`), `.claude/tasks/medreader-crossstep-notes.md` 의 "8f-1 Review 에서 넘긴 것"·"8f-2·11-2", 지침 `.claude/tasks/medreader-build-8f2-wordsheet.md`, 보고서 `.claude/tasks/medreader-build-8f2-wordsheet-report.md`(믿지 말고 다시 재라), `git diff` + 새 파일(`js/ui/wordsheet.js`·`tests/wordsheet-8f.test.mjs`).

## 확인할 것
1. **호출 수**(무료 한도): 시트 열기·저장·번역 없이 저장·문맥 바꾸기 → 0, [AI 로 번역] → 1(같은 낱말·문맥 → 0), 실패 뒤 다시 누름 → `retry:true` 1, 덮어쓰기 질문 중 0, capped·offline·키 없음 0. 연타(빠르게 5번) → 1. 사용자가 친 글(번역 칸·메모)이 요청 본문에 0건.
2. **데이터**: 저장 결과(`origin`·`edited`·`contextTr`·시각 ms·id), 이미 있는 낱말 → 새 항목 0, 하이픈 결합, 대소문자·악센트 다른 같은 낱말, 대상 언어를 바꾼 뒤 같은 낱말(다른 항목이어야), 저장 중 시트 닫기·쪽 넘김·리더 떠남(반쯤 쓰인 레코드 없음). 서재 삭제 확인 "남습니다" 한 함수(`deleteKeepLines` 등)가 11·12 가 줄을 더하기 쉬운 꼴인가(crossstep "8f-2·11-2"), 숫자가 맞는가.
3. **회귀**: 8c-1 탭 번역·선택 줄·Esc 층 순서·포커스·손가락 판정(앞 하네스), 번역 요청 본문 바이트 HEAD 와 같음, 7-7 띠·8d·8e 가로·9a·9b 기본, 원본 보기에서 선택 → [단어 번역](설계가 정한 대로).
4. **화면**: 360×740·412×915·915×412 × ko·ar·en·fr — 시트 자리·[닫기] 보임·가로 넘침 0·48px·번역 칸 `dir`·`lang`, 긴 낱말·긴 문맥 번역(넘침·줄바꿈), RTL 거울. `innerHTML` 0(XSS — 원서 글·AI 응답에 `<img onerror>` 꼴을 넣어 흉내 응답으로 확인).
5. **접근성**: Tab 가둠·Esc·포커스 되돌림·`role=dialog`·`aria-labelledby`·`aria-live` 상태 한 줄, 낭독기 순서.
6. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
7. 변이 3개 이상 네가 고른 곳(Build M1–M5 와 다르게 — 예: [AI 로 번역] 연타 막기 지움, 저장 시 `contextTr` 빼기, `innerHTML` 로 바꾸기, 리더 떠날 때 시트 거두기 지움) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r8f2/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
8. headless: Edge, pipe, 새 프로필 `r8f2/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 흉내 음성, 캐시 끔, **한 번에 하나씩**. 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 설계보다 많은 호출, 사용자 글이 요청에 들어감, 데이터 손실·중복·엉뚱한 덮어쓰기, 8c-1 대비 회귀, 시트가 화면 밖·닫을 수 없음·키보드로 못 빠져나옴, XSS, 콘솔 오류.
- **낮음**(→ "배포 가능", 8f-3 지침이나 다듬기 후보로): 문안, 실기기 확인 거리, 보고서가 밝힌 남은 문제 1–8 꼴.
표(번호·심각도·내용·근거) + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프로 묶지 말 것, 긴 실행은 `timeout 560`). 프로세스 조회·디버깅 포트 찌르기 금지. `try { … } finally { await browser.close() }`, pipe, 결과는 stdout. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). 8000 python 쓰기만, 8123–8125 건드리지 마라. puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. 큰 원서로 검색 화면에 들어가지 말 것. 의학책 읽기만(`C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`), Downloads 목록 보지 말 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `r8f2/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
