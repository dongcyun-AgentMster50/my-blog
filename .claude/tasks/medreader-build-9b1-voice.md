# Build 지침 — 9b-1 음성 명령: 순수 매칭 + 인식 서비스 (화면 변화 0)

> 너는 **Build 서브에이전트**다. 승인된 설계: spec **17-1-2 "9b Build 설계 — 음성 명령"** 전부, 특히 1·2·4·5·7·9·10절 + 결정 **9b-D1–9b-D14 권장안**(운영자 승인 2026-11-15). 이번은 **9b-1 만**(7절·11절 표): `js/voice/commands.js`(순수 — 정규화·동의어 표·매칭) · `js/voice/listen.js`(`SpeechRecognition` 서비스 래퍼 — 언어 사다리 `ar-SY → ar-JO → ar`, 된 언어 기억, 오류 분류, 대안 5개) · 테스트 2개. **운영자 방침: 실기기 확인을 기다리지 않는다** — 실기기에서만 답이 나오는 것은 보고서의 "마지막 실기기 점검 묶음"(17-1-2 9절 V-1~V-10 과 맞춰)에 적는다.
> **커밋하지 않는다.** 한국어로 쓴다. 보고서 `.claude/tasks/medreader-build-9b1-voice-report.md`.

## 동시 작업 주의 (가장 중요)
같은 작업 트리에서 **9a Build 가 지금 돌고 있다**(`js/ui/handsfree.js`·`controls.js`·`reader.js`·`config.js`·`settings.js`·`ui/settings.js`·`i18n/*`·`css/*`·`index.html`·`tests/handsfree-9a.test.mjs` 등). 너는 **새 파일만** 만든다: `js/voice/commands.js`, `js/voice/listen.js`, `tests/voice-commands-9b.test.mjs`, `tests/voice-listen-9b.test.mjs`(이름은 설계에 있으면 그대로). **기존 파일은 한 글자도 고치지 마라** — `index.html`(import map·stamp)·`config.js`·`spec.md`·`i18n/*` 포함. 상수는 설계대로 파일 안 기본값으로 두고(9b-2 에서 `VOICE` 로 옮김), 문구는 키 이름만 정해 보고서에 표로(9b-2 가 i18n 에 넣는다). **stamp 를 다시 찍지 마라.** `stamp --check` 나 기존 테스트가 9a 의 진행 중 변경 때문에 흔들리면 네 탓인지만 가려 보고하라(9a 파일을 고치지 마라). spec 정정할 것이 있으면 보고서의 "spec 정정 줄 초안" 절에.

## 할 일
1. `commands.js`: 설계 4절의 명령 9개(+ explain 자리만, 꺼짐) × 아랍어(표준·레반트 구어·화면 단추 낱말·아랍 문자 영어 차용어)·영어 동의어 표(아랍어 `[검토 — Nour·운영자]` 주석), 정규화(`text/specialty.js` 의 `foldArabic` 을 **import 해서** 다시 씀 — 고치지 말 것 + ؤ/ئ·숫자·문장부호·군말 떼기), 매칭(전체 일치 먼저 → 부분은 가장 긴 구, 같은 길이 다른 명령은 모호 → 무시, 짧고 뜻이 둘인 낱말은 전체 일치만, 숫자·낱말 일부 일치 받지 않음), 대안 5개 순서대로, 확신도 문턱 없음, "명령 언어" auto/ar/en.
2. `listen.js`: 주입 가능한 `SpeechRecognition` 생성자로 감싼 서비스 — 한 번 듣기, 언어 사다리·기억(저장은 주입된 저장 함수로 — 앱 설정 모듈을 import 하지 마라), 오류 분류(권한·바쁨(`not-allowed` 의 두 뜻)·네트워크·무음·언어 미지원·중단), 취소, 시간 상한. 오프라인이어도 막지 않고 시도(9b-D9).
3. 3-2 import 방향 지키기(`voice/*` → `text/specialty.js`·`config` 정도만, UI·speaker import 없음).
4. 테스트: 설계 9절 `[N]` 중 9b-1 몫 전부 + 명령 표 무결성(같은 동의어가 두 명령에 있으면 실패 — 의도된 공유는 목록으로) + 정규화 표 + 언어 사다리·오류 분류(가짜 생성자).

## 검증
- `node --test` 로 **네 테스트 두 파일**을 2회. 전체 `node --test apps/medreader/tests/*.test.mjs` 도 1회 돌리되, 실패가 9a 진행 중 파일 탓이면 그렇다고만 적어라.
- 변이 3개 이상(가장 긴 구 우선 끄기, 짧은 낱말 전체 일치 조건 지우기, 언어 사다리 기억 끄기 등) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**), 백업 `b9b1/bak/` — **네 새 파일만** 변이.
- 브라우저는 쓰지 않는다(화면 변화 0). 명령은 한 호출에 한 가지 일만, 프로세스 조회·디버깅 포트 찌르기 금지. 어떤 명령이든 막히면 변형을 찾지 말고 멈춰 보고. 모든 실행에 시간 상한(10분 이내). 표준 입력 대기 금지.

## 금지
커밋, 기존 파일 수정, `git checkout/restore/stash`, `rm -rf`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 8000·8123·8124·8125번 서버 건드리기, 진짜 API 키. 스크래치패드는 `b9b1/` 만.
