# Review 지침 — 16-2 개념도 그리기·화면 (+ 16-1 · 16-1R 고침, 함께 배포 전)

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "16-2 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지 — 덧붙인 뒤 특수 글자 수 점검. Write 가 `\u…` 이스케이프를 실제 글자로 넣는 사고가 잦다). 스크래치패드 `C:\Users\YDC\AppData\Local\Temp\claude\9d924f3f16e52d8a\cd66bacf-63a7-488f-8a9f-567162cf7e33\scratchpad\r16-2\`(먼저 만들 것). `b16-2/`·`r16-1/`·`b16-1/`·`r15-*/`·`b15-2c/` 는 읽기만.

## 볼 것
spec 17-14 전부(+ 정정 줄 16-1·16-2), review.md "16-1 Review" 절, 지침 `.claude/tasks/medreader-build-16-2-diagram-ui.md`(앞 "먼저 고칠 것" 포함), 보고서 `.claude/tasks/medreader-build-16-2-diagram-ui-report.md`(믿지 말고 다시 재라), `git diff`(16-1 + 16-2 함께 미커밋, 기준선 HEAD 8f329c4) + 새 파일(`js/text/numexpr.js`·`js/text/diagram.js`·`js/ui/diagram.js`·시험).

## 확인할 것
1. **numexpr 옮김 회귀(가장 중요 — 15 근거 검사)**: 15 하네스 7벌(`r15-1/ground.mjs`·`r15-2/ground2.mjs`·`r15-2b/bound.mjs`·`b15-2c/bound2.mjs`·`r15-2c/forms.mjs`·`forms2.mjs`·`forms3.mjs`)을 **HEAD 사본(`git archive`)과 작업 트리**에서 각각 돌려 출력 바이트 같음 — 너의 실행으로. `grounding-15` Q9 허용 목록 한 줄 외 시험 무변(바이트 diff).
2. **16-1R 중간-1 닫힘**: `r16-1/safety.mjs` 42꼴 + **네가 새로 짓는 라벨 꼴 15개 이상**(개요에 `3–5 mg` 가 있을 때 라벨 `3–5 mg`(정당)·`5 mg`·`3 mg`·`≥3 mg`·`3-5mg`(공백 차이 — 정당이어야)·`٣–٥ ملغ`(아랍 숫자 — 정당)·`10⁹/L` 대 `10^9/L`·`7.0` 대 `7` 등) — 값이 바뀐 라벨 통과 = 중간, 정당 라벨이 버려지는 비율도 적기. `wide` 갈래(글자 바로 뒤 비교 기호)가 15 의 근거 판정에 새지 않음.
3. **'치료' 관계·지어낸 것**: 16-1R 18꼴 다시(막힘 유지), `few-relations` 흐름(Build 가 `'few-relations'`↔`'FEW_RELATIONS'` 버그를 고쳤다 — 시험 G5) 저장 0·[다시 시도].
4. **화면**: 그림·글로 보기 항목 수 = 엣지 수, `svg role=img` 이름, 키보드, 12px 문턱(좁힌 그릇에서 [크게] 저절로), 쪽 가로 넘침 0, RTL 거울·원어 줄 ltr, 네 테마+고대비 대비, "개요가 바뀌었습니다", SVG 저장(`var(` 0·DOMParser 로 열림), `innerHTML` 새 사용 0(라벨·개요 제목 `<img onerror>`·`<script>`·SVG 특유 `<foreignObject>`·`javascript:` 꼴 — SVG 안 XSS).
5. **호출**: 그리기 1·적중 0·다시 그리기 묻기 0/확인 1·열기/크게/글로 보기/저장 0, 자동 0, `target` 은 개요 레코드 것. 번역·요약·설명·출제 요청 본문 바이트 HEAD 와 같음.
6. 회귀: 11-3 모아 보기·개요·요약 시트, 15 묶음 화면(개요 칸 작은 그림), 사용량 화면, 9c `diagram` 필드 멱등.
7. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0, 바뀐 파일 특수 글자 수 HEAD 와 같음(Build 가 `numexpr.js` NBSP 사고를 고쳤다고 함). 고친 기존 시험 넷 바이트 diff(의도된 변화만).
8. 변이 3개 이상 네가 고른 곳(Build R1·R2·U1–U6 과 다르게 — numexpr 하나·SVG 저장 하나 포함) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r16-2/bak/`).
9. headless: Edge, pipe, 새 프로필 `r16-2/p*`, 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기), 합성 PDF + 저장 개요. 3크기 × 4언어(대상 ko·ar). 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 15 하네스 출력이 하나라도 바뀜, 값이 바뀐 라벨 통과·비교 기호 뒤집힘 통과, '치료' 통과, 자동 호출·요청 늘어남, 다른 요청 본문 바뀜, SVG XSS, 쪽 가로 넘침, 9c 멱등 깨짐, 파일 손상, 콘솔 오류, 테스트 손상.
- **낮음**(→ "배포 가능"): 정당 라벨 일부 버림(안전 쪽)·교차·라벨 겹침·포커스 고리·실기기 거리·문안.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 금지 — 시험도 절대 경로로 단독). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 금지. 서버 금지. 막히면(권한 거절 포함) 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. **진짜 API 키·진짜 Gemini 요청 금지.** 모든 실행 10분 이내, 표준 입력 대기 금지. 끝나기 전에 띄운 백그라운드 작업은 모두 끝낼 것. 수정 범위: `review.md` 끝 절, 스크래치패드 `r16-2/` 만. 금지: 앱 코드·테스트·spec·`dev/` 수정, 커밋, `git checkout/restore/stash`, npm·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
