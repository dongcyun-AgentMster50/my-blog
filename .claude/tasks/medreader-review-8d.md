# Review 지침 — 8d 문장 아래 번역(대역) (Nour 요청 1)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8d Review"** 절로 덧붙인다(앞 절은 고치지 않는다). 통과하면 오케스트레이터가 배포한다 — **배포 판정**까지.

## 읽을 것
spec 7-7-1 전부(계약 I1~I7·수용 기준 8d)와 이번 `[정정 2026-10-21 — 8d Build]` 줄(①~⑩), 6-5 의 7-7-1 줄, 9-3 `readalong.display`, 10-1 의 `[정정 2026-10-21 — 8p Review L1]`. 지침 `.claude/tasks/medreader-build-8d.md`, Build 보고 `.claude/tasks/medreader-build-8d-report.md`(남은 문제 1–5). 변경: `git diff` + 새 `js/ui/inlinetr.js`·`tests/inlinetr-8d.test.mjs`. 직전 커밋 `ca2665a`. Build 의 하네스·측정은 스크래치패드 `b8d/`(읽기만 — 네 하네스는 `r8d/` 에 따로).

## 반드시 따질 것
1. **호출 0**: `inlinetr.js` 와 readalong 의 새 공개 함수(`translatable`·`readyNow`·`cachedFor`)가 요청을 만들 길이 없는지(코드 + 실측 — 쪽 넘김·전환·되돌아오기에서 `fetch` 0, `usage.calls` 0). `cacheKeyOf` 로 모은 뒤에도 **띠 모드의 요청 본문·캐시 키·청크 경계가 `ca2665a` 와 같은지**(의학책 3권 × ar·ko — 네 스크립트로, 재요청 0).
2. **띠 모드(기본) 무변**: `display` 가 `band` 이면 화면·DOM·`--reader-chrome-bottom`·낭독 큐가 HEAD 와 같은지. Nour 는 지금 띠로 쓰고 있다.
3. **I1·I4**: 줄 span 내부 불변(Range 비교), 현재 문장 윗변 불변(412×915·360×740, 20문장 이상, 쪽 넘김 포함) — Build 측정 재현.
4. **Build 가 설계에서 바꾼 것** ①~⑩ 이 각각 타당한지 — 특히 `willShow` 를 `showSpoken` **앞**에 부르는 배선, 다른 쪽을 그리면 지난 쪽 "지금 문장"을 잊기, `span.rt-ref` 건너뛰기, `data-tr-inline` 으로 띠 자리 0.
5. **남은 문제 1–3 의견**(운영자 결정 재료): (1) 긴 문장+블록이 본문보다 클 때 편안 영역 — (가) 기준을 "들어갈 수 있는 크기에서 위반 0" 으로 · (나) speak 모드 번역 낭독 시작 때 한 번 굴리기 · (다) show 모드 원문 끝날 무렵 굴리기 — 각각 I4(현재 문장 안 움직임)와 부딪치는지. (2) 속도 팝오버 새 줄이 sticky 닫기 줄에 가려지는 것. (3) 아랍어 괄호 묶음 줄 끝 접힘.

## 확인할 것
6. 화면: ko·ar(RTL — 테두리 `inline-start`), 상태 줄 넷 48px, "눌러서 보기" 누르면 펼침(사용자 동작만), I7 지우기(표시 방식·대상 언어·모드 off), 원본 뷰 늘 띠, 설정 AI 탭과 팝오버 같은 줄, `innerHTML` 0, 해커스 견본(8m 보고서 경로, 읽기만) 한글 단위 블록 0, CMDT 표 쪽(25·45쪽) 블록 자리.
7. headless Edge(412×915 · 360×740 · 글자 22 · ko·ar · 가짜 키·흉내 응답·흉내 음성 · 새 프로필 3개까지, 프로필 복사 금지). 회귀: 띠(8b), 8m 전환, 8o 빈칸, 8i-3 쪽 넘김, 8g 결과 이동 뒤 [▶], 10a 하이라이트, 줄 탭, 8k 목소리, 8p 문체. 콘솔 오류 0. 8000번 python(PID 30352)은 쓰고 끄지 마라. 8123·8124·8125번 node 는 건드리지 마라. puppeteer-core 가 필요하면 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**. 진짜 API 키 금지.
8. 너만의 변이 2개 이상(Build 의 8개와 다른 것). 복원 **읽어서 쓰기 + `cmp`**. 백업 스크래치패드 `r8d/bak/`.
9. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1360 기대), `stamp --check` 0, `git diff --check`, `.nojekyll` 있음. **배포 판정**.

## 규칙
모든 실행에 시간 상한(하나에 10분 넘지 않게). 표준 입력을 기다리는 명령 금지. C: 남은 공간이 5GB 아래면 멈추고 보고. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8d/` 만. 띄운 Edge·node 정리. 금지: 커밋, `git checkout/restore/stash`(옛 판 비교는 `git show 커밋:경로 > 스크래치패드`), `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
