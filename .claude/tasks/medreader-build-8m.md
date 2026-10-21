# Build 지침 — 8m 영한 혼합: 문장별 글자 체계로 목소리 전환 (O2)

> 너는 **Build 서브에이전트**다. 운영자가 권장 순서대로 8m 을 진행하기로 했다(2026-10-21). 승인된 설계: spec **19-1-2 2절(O2 — 2-1~2-6, 특히 2-6 수용 기준·테스트 꼴 T-L1–T-L7)** + 결정 **O-D4 (가)**(목소리 전환 + 같은 언어 문장 번역 생략 + `src` 항목, `SAME_LANG` 유지) · **O-D5 (가)**(`tts.scriptSwitch` 기본 켬) · **O-D6/L-D7**(해커스 견본으로 시작 조건 충족) + **19-1-3 §4**(8m 갱신 — 견본 4개 실제 경로, **Build 첫 단계에서 M1–M7 측정, 섞인 단위가 10% `[가정]` 를 넘으면 멈춤**). 8k(`resolveSpeech`)·다듬기 1 은 배포됨(`e9e2336`).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8m-report.md`.

## 반드시 읽을 것
1. spec 19-1-2 2절 전체, 19-1-3 §4 전체, 결정 표 O-D4–O-D6·L-D7. 18절의 관련 행.
2. `.claude/tasks/medreader-8k-carryover.md` — Nour Realme: 아랍어 음성 목록 없음(voice 없이 `ar-SA`), Android Chrome 은 목소리 이름을 쓰지 않고 `lang` 태그만 쓴다(8k Review). **언어 전환 간격(M7)** 은 Nour 결과 대기 — 지금은 단위마다 전환으로 만들고, 결과가 1초를 넘으면 문단 묶음으로 바꿀 수 있게 한 곳에 둔다.
3. `.claude/tasks/medreader-8l-carryover.md` 끝 — 한국어 OCR(`kor` tessdata_fast)은 "패 턴 이 사 용 된" 처럼 **글자 사이를 띄우는** 경우가 있다(스피쿠스 OCR 판 `D:/OCR/01_English/스피쿠스 전화영어/…`). 판별(한글 덩어리 세기)이 이 꼴에서 깨지지 않는지 본다(고치는 것은 범위 밖 — 기록).
4. 코드: `js/tts/voices.js`(`resolveSpeech` — 8k, 이것을 쓴다), `js/tts/text.js`(`buildUnits`·`Unit`), `js/text/screen.js`, `js/tts/speaker.js`, `js/ui/controls.js`(`applySourceSpeech` 등), `js/translate/*`(번역 요청·`SAME_LANG`·캐시 키), `js/settings.js`, `js/ui/settings.js`, `js/i18n/*`, `dev/measure-mixlang-o2.mjs`(O1–O3 Plan 시제품 — 판별 규칙의 기준).

## 할 일
1. **첫 단계 — 측정(spec 19-1-3 §4 M1–M7)**: 해커스 견본 4개(spec 에 적힌 실제 경로, `G:/01_Language/01_English/…` **읽기만**)와 세 의학책·OCR 교재 몇 권에서 판별 규칙을 돌려 섞인 단위 비율 등. **섞인 단위 > 10% 면 고치지 말고 멈춰서 보고**(spec 조건).
2. 판별(순수): 문장(단위)마다 글자 체계 덩어리 다수결 — 한글 → ko, 아랍 문자 → ar, 라틴 → 문서 언어(ko 문서 안이면 en), 그리스·한자 등은 세지 않음, 2글자 미만은 같은 문단 앞 단위 물려받기, 60% 미만·동률은 문서 언어. 예외인 단위에만 `Unit.lang`(단일 언어 문서는 큐가 지금과 같아야 함 — 바이트 비교).
3. speaker: 단위의 `lang` 이 있으면 그 언어로 `resolveSpeech`(8k 의 사용자 고르기·억양 그대로 적용), 기호 읽기 표도 그 언어. 전환한 언어 음성이 없으면 "음성 없음" 대신 문서 언어로 다시 읽고 그 세션 동안 전환 끔(spec). 설정 `tts.scriptSwitch`(기본 켬) + 설정 화면 한 줄(네 언어).
4. 번역: 번역 대상 언어와 같은 언어의 단위는 번역하지 않음(호출 감소), 문서·대상 언어 모두와 다른 단위는 요청 항목에 `src`. **캐시 키 불변**, `SAME_LANG` 유지(O-D4).
5. 원본 보기·하이라이트·검색·8g·8i 경로는 그대로.
6. 테스트: T-L1–T-L7(spec) + 단일 언어 문서 큐 바이트 동일(세 의학책 몇 쪽) + 번역 요청에서 같은 언어 단위 빠짐·`src` + 전환 실패 시 되돌리기 + 띄어진 한글 꼴 기록 테스트.
7. stamp 다시, `--check` 0.

## 검증
- 변이 4개 이상(다수결 문턱, 물려받기 빼기, 단일 언어에도 `lang` 붙이기, 같은 언어 번역 생략 빼기 등) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**). 백업 스크래치패드 `b8m/bak/`.
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1301 + 새).
- **headless Edge**(412×915 · ko·ar · 흉내 음성 — Nour 모양 목록, 가짜 키·흉내 번역 응답): 해커스 견본 하나를 넣어 한국어 문장은 `ko-KR`·영어 문장은 `en-US`(또는 고른 억양)로 바뀌는지, 번역 요청에서 한국어 단위가 빠지는지(대상 ko), 설정 끄면 전부 문서 언어. 회귀: 의학책 낭독·번역 띠(태그 그대로), 8i-3 쪽 넘김, 8g 결과 이동 뒤 [▶], 8k 목소리 고르기, 8l 스캔본 ▶. 8000번 python(PID 30352)은 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123번 `npx http-server` 와 8124·8125번 node 는 건드리지 마라. 프로필은 새로 만든 것 2개까지. puppeteer-core 가 필요하면 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**. 진짜 API 키 금지.
- **모든 실행에 시간 상한**. 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 Edge·node 정리.

## 수정 범위
`js/tts/*`, `js/text/*`(판별 순수 모듈 — 새 파일 가능), `js/ui/controls.js`·`js/ui/settings.js`, `js/translate/*`(같은 언어 생략·`src` 만), `js/settings.js`, `js/i18n/*`, `index.html`(stamp·설정 자리), `css/*`, `tests/`, `spec.md`(19-1-2 2절·19-1-3 §4 안 정정 줄만), 스크래치패드 `b8m/`, 보고서. DB 버전·algoVersion·캐시 키·`SEARCH`/`SCAN` 버전 불변. review 금지.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용. 의학책: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/Telegram Desktop/Current medical diagnosis and treatment 2021.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`. pdf.js(Node) 5.6.205: `C:/Users/YDC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs`.
