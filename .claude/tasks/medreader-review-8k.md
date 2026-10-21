# Review 지침 — 8k 낭독 목소리: 휴대폰 설정 따름 + 언어별 고르기 + 억양(O3)

> 너는 **Review 서브에이전트**다. Build 와 분리된 검증자다. Build 보고를 믿지 말고 **직접 확인**한다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 맨 끝에 **"8k Review"** 절로 덧붙인다(앞 절은 고치지 않는다). 통과하면 오케스트레이터가 배포한다 — **배포 판정**까지.

## 읽을 것
spec 19-1-1(E1·N2·8k 줄·수용 기준)·19-1-2 3절(O3 문안 1–6)과 이번 정정 줄 2개. `.claude/tasks/medreader-8k-carryover.md`(Nour 실기기 사실). 지침 `.claude/tasks/medreader-build-8k.md`, Build 보고 `.claude/tasks/medreader-build-8k-report.md`. 변경: `git diff` + 새 `tests/voice-8k.test.mjs`. 직전 커밋 `890059e`.

## 확인할 것
1. **`resolveSpeech` 다섯 갈래**를 줄 단위로 + 순수성. **기본 태그 판단**: 둘 다 없을 때 `en-US`·`fr-FR`·`ko-KR`·`ar-SA` 처럼 **지역 붙은 태그**를 넘긴다 — "휴대폰 설정 따름"의 뜻과 맞는지(지역 붙은 태그가 Android 엔진에서 그 지역 음성을 강제할 수 있는가, 지역 없는 `en` 이 더 "휴대폰 따름"에 가까운가). Build 가 `SPEECH_DEFAULT` 한 줄(`tag:'bare'`)로 바꿀 수 있게 했다 — 지금 값이 맞는지 근거와 함께 의견(실기기 결과 전이라 위험이 적은 쪽 권장). 원문 언어가 문서 속성으로 `en-GB` 등 지역을 가진 경우의 처리.
2. **꼬리표·억양 묶음**: `en_AU`·`zh_HK_#Hans`·`bs_BA_#Latn`·지역 없는 `en`·대소문자·빈 lang 등 정규화, 묶음이 목록 지역에서만, #Hans·#Hant 한 묶음 결정의 타당성.
3. **네 경로 통일**: 원문·번역문·표 안내·퀴즈·[들어 보기] 가 모두 같은 함수(grep 으로 옛 `pickVoice`·`utteranceLang`·`speechLang` 화면 호출 0). `speaker.setTrVoice` 세 번째 인자의 뜻.
4. **Build 가 함께 고친 결함 2개**: ① 사라진 상태에서 이미 체크된 "휴대폰 설정 따름" click ② **8b-1 부터 있던 결함 — 설정에서 번역 언어를 바꿔도 리더가 옛 언어 태그로 읽음** — 고침이 맞는지, 다른 경로에 영향 없는지.
5. **headless Edge**(412×915 · ko·ar · Nour 모양 흉내 음성 92개): 기본 `utt.voice` null·태그, 억양·목소리 고른 뒤 낭독·번역 띠·퀴즈(퀴즈 문항이 있는 책 — Harrison 은 퀴즈 1/149 가 있다(8g-4b Review) — 로 **퀴즈 [읽기]를 화면에서 직접**), 사라진 음성, 되돌리기, 설정 화면 412·360·RTL. 회귀: 8i-3 쪽 넘김 낭독, 8i-1 B, 8g 결과 이동 뒤 [▶], 8l 스캔본 ▶ 안내, 번역 띠. 콘솔 오류 0. 8000번 python(PID 30352)은 쓰고 끄지 마라. 8123·8124·8125번 node 는 건드리지 마라. 프로필은 새로 만든 것 2개까지. puppeteer-core 가 필요하면 Build 가 읽은 `C:/Users/YDC/product-builder-lesson/node_modules` 를 **읽기만**(그 폴더에 쓰지 마라). Edge 가 갱신 대기로 바로 끝나면 Build 처럼 직접 띄워 `connect`.
6. **dev/voices.html**: [앱이 고른 음성] 이 `resolveSpeech`, [이전 규칙] 이 옛 en_AU·fr_CA, 억양 단추, 앱 저장소 변화 0.
7. 테스트의 힘: 너만의 변이 3개 이상. 복원 **읽어서 쓰기 + `cmp`**. 백업 스크래치패드 `r8k/bak/`.
8. 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(1285 기대), `stamp --check` 0, `git diff --check`, `.nojekyll` 있음. **배포 판정**.

## 규칙
모든 실행에 시간 상한. 표준 입력을 기다리는 명령 금지. 앱 코드·테스트·spec 은 고치지 않는다(변이는 되돌린다). 진짜 API 키 금지. 명령이 훅·권한에 막히면 변형 명령을 찾지 말고 멈춰서 보고. 스크래치패드는 `r8k/` 만. 금지: 커밋, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제. 의학책 PDF: `C:/Users/YDC/Downloads/CURRENT Medical Diagnosis _ Treatment 2026.pdf`, `C:/Users/YDC/Downloads/ILMA_2021_20th_ed_Harrison.pdf`.
