# Build 지침 — 8o 빈칸 낭독 (F5a)

> 너는 **Build 서브에이전트**다. 운영자가 권장 순서대로 진행하기로 했다(2026-10-21). 승인된 설계: spec **19-1-3 §6 "8o — 빈칸 낭독"** + 결정 **L-D11 (가)**(언어별 낱말 — "blank"·"빈칸"·"blanc", 아랍어는 spec 문안) · 배치 L-D8 (나). 8m 은 배포됨(`48bf203`). **8o-2(보기 `(A)` 인식)는 이번 범위가 아니다**(조건부·algoVersion — 건드리지 마라).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8o-report.md`.

## 읽을 것
spec 19-1-3 §6 전체, F5a 행(4508행 근처), M6(하이픈 빈칸 개수), 6-6(8h `speechMarks`·`normalizeSpeech` — 같은 자리), 6-6-4 C(각주 기호 발화 사본만 정리 — `src`·캐시 키 불변 원칙). 코드: `js/tts/text.js`(`normalizeSpeech`), `js/config.js`(`TTS_SYMBOLS` 등), `js/text/lang.js`(8m — 단위 언어), `js/tts/speaker.js`. 8m 측정 원자료(해커스 빈칸 수): 스크래치패드 `b8m/` 와 `.claude/tasks/medreader-build-8m-report.md`(M6: 견본 셋 `-{4,}` 14·`_{3,}` 2, 87개 전체 289·23).

## 할 일
1. **낭독 사본에서만**(화면 글자·`src`·번역 요청·캐시 키·검색 글자 **불변**) 빈칸 꼴(`-{4,}`·`_{3,}` 등 spec 정의 — 하이픈 줄이 줄 끝 하이픈 결합·대시·구분선과 헷갈리지 않게)을 **그 단위의 언어**(8m `Unit.lang` 이 있으면 그것, 없으면 문서 언어)의 낱말로 바꾼다. 낱말 표는 `config.js` 에 언어별로(en·ko·fr·ar — 아랍어·프랑스어 문안 `[검토 — Nour·운영자]`).
2. 구분선(한 줄 전체가 `-----` 뿐), 표 괘선, 범위 표시(`10-20`), 줄 끝 하이픈 결합, 대시(`—`·`--` 2개)는 바꾸지 않는다 — 실물에서 오탐 0 을 측정으로 확인.
3. 테스트(spec 수용 기준 + 오탐 꼴 표 + 언어별 낱말 + 화면 글자·번역 요청·캐시 키 불변 + 단일 언어 의학책 큐 바이트 동일).
4. 실물 측정: 해커스 87개(`G:/01_Language/01_English/` — 읽기만, 8m 보고서의 경로) 빈칸 바뀐 수·오탐 표본 눈 검토(40자 이하), 의학책 3권 바뀐 수(기대 0 에 가깝게 — 0 이 아니면 표본으로 오탐인지 확인).
5. stamp 다시, `--check` 0.

## 검증
- 변이 3개 이상(구분선도 바꾸기, 언어 대신 문서 언어만, 화면 글자까지 바꾸기 등) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**). 백업 스크래치패드 `b8o/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1322 + 새).
- headless Edge(412×915 · ko · 흉내 음성): 해커스 견본 하나에서 빈칸이 "빈칸"/"blank"로 발화, 화면 글자는 그대로. 회귀: 의학책 낭독·번역 띠, 8m 전환, 8i-3 쪽 넘김. 8000번 python(PID 30352)은 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125번 node 는 건드리지 마라. 새 프로필 1–2개. puppeteer-core 가 필요하면 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**. 진짜 API 키 금지.
- **모든 실행에 시간 상한**. 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 Edge·node 정리.

## 수정 범위
`js/tts/text.js`(낭독 사본), `js/config.js`(낱말 표), `tests/`, `index.html`(stamp 로만), `spec.md`(19-1-3 §6 안 정정 줄만), 스크래치패드 `b8o/`, 보고서. DB 버전·algoVersion·캐시 키·`SEARCH`/`SCAN` 버전·`PROMPT_VERSION` 불변. review 금지.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
