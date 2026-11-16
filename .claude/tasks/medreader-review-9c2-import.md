# Review 지침 — 9c-2 백업 가져오기

> 너는 **Review 서브에이전트**다(Build 와 분리). 앱 코드·테스트·spec 을 고치지 않는다. **커밋하지 않는다.** 한국어로 쓴다. 결과는 `apps/medreader/review.md` 끝에 "9c-2 Review" 절로 덧붙인다(Write 로 스크래치 파일 → Node 로 append, heredoc 금지). 스크래치패드 `r9c2/`(Build 의 `b9c2/`·`b9c1/`·`r9c1*/` 는 읽기만 — 합성 파일·하네스 재사용, 새 150MB 합성은 만들지 말 것). 쓸 폴더는 먼저 만들 것.

## 볼 것
spec 17-4-1 전부(+ `[정정 2026-11-17 — 9c-1 Build·9c-1b·9c-1c·9c-2 Build]`), 지침 `.claude/tasks/medreader-build-9c2-import.md`, 보고서 `.claude/tasks/medreader-build-9c2-import-report.md`(믿지 말고 다시 재라), review.md 의 9c-1 계열 절, `git diff` + 새 파일(`js/backup/import.js`·`tests/backup-import-9c.test.mjs`).

## 확인할 것
1. **데이터 안전(가장 중요)**: 네가 새로 짠 기기·파일 쌍 — 기기 쪽이 더 새로운 진도·단어(복습 필드·`suspended`·`edited`)·카드·필기·오답·문서 언어(`langSource:'user'`)·캐시(`hits`·`createdAt`)·설정(설정 끔 체크)·사용량(같은 날 큰 값·`capWarned` OR)·`links.medical`. 파일 쪽이 더 새로운 쪽은 들어오는가. 멱등(두 번·세 번 = 한 번, 전 스토어 깊은 비교). **끊긴 가져오기**(트랜잭션 중간·묶음 경계) 뒤 같은 파일 다시 → 같은 결과. 다른 기기의 같은 책(다른 id·같은 `fileHash`·`해시:n쪽수` 변형) → 문서 1개·캐시 키 셋째 칸 바뀜·`w=` 칸 그대로·`progress`·`questions`·`attempts.items[].questionId`·`mistakes` 앞 `{docId}:` 바뀜.
2. **입력 견고성**: 잘린 gzip·평문, 반쪽 줄, 깨진 UTF-8(그 자리에서 멈춤 — 앞까지만 들어감이 설계와 맞는지·사용자에게 알리는지), `format: 2`, 머리 줄 없음, 끝 줄 `counts` 와 실제 다름, 알 수 없는 스토어 이름(`"s":"blobs"`·`"s":"pages"` — 쓰면 안 됨), 레코드 꼴이 틀림(필수 키 없음·타입 다름·아주 큰 값), 키 꼴 속성 이름, `__proto__`·`constructor` 속성(프로토타입 오염), `links.medical` 의 위험 주소(`javascript:` — 가져온 뒤 18 `checkLink` 를 거치는가), 줄 길이 상한(8M).
3. **다시 불러오기·화면**: 가져온 뒤 다시 불러오기 전/후 상태, 떠나기 확인(`window.confirm` — 남은 10, 다른 곳은 페이지 안 `<dialog>` 인데 여기만 `confirm` 인 것이 설계와 맞는가), 진행 막대 `aria-live`, 360·412 × 4언어 넘침 0·48px·RTL, `innerHTML` 0.
4. **회귀**: 9c-1 내보내기, 설정·서재·단어장·사용량·18 링크, `KEY_PATTERNS` 변경(sk- lookbehind 5·Bearer 왼쪽 경계)이 정상 글 61·CMDT 걸림 0 유지, `REDACT_PATTERNS` 무변, 번역 요청 본문 바이트 HEAD 와 같음.
5. **남은 1(HEAD)**: 이웃 쪽 추출 전에 연 쪽에서 리더가 `lastLineId` 를 null 로 덮는다 — 9c 와 무관하게 사용자 진도를 잃는 결함인지 재현하고 심각도만 매겨라(고칠 단계는 오케스트레이터가 정함).
6. 전체 `node --test --test-timeout=60000 apps/medreader/tests/*.test.mjs` 2회, stamp `--check` 0, `git diff --check` 0.
7. 변이 3개 이상 네가 고른 곳(Build V1–V14 와 다르게) → 빨강 → 복원(읽어서 쓰기 + `cmp`, 백업 `r9c2/bak/`). headless 변이 땐 `setCacheEnabled(false)`.
8. headless: Edge `--enable-precise-memory-info`, pipe, 새 프로필 `r9c2/p*`(둘 이상), 가짜 키, 흉내 Gemini OPTIONS 204 + CORS, 캐시 끔, **한 번에 하나씩**, **서버 띄우기 금지**(가로채기). 콘솔 오류 0.

## 판정 기준
- **중간 이상**(→ "고친 뒤 배포"): 기기 데이터를 조용히 덮음·잃음·중복, 멱등 깨짐, 끊긴 뒤 다시 가져오기 결과 다름, 파생 스토어·blobs 에 씀, 프로토타입 오염·XSS·위험 링크가 살아남음, 키가 들어옴, 회귀, 콘솔 오류, 폰 OOM 이 거의 확실한 메모리.
- **낮음**(→ "배포 가능"): 안내 문구·미리보기 정보량·실기기 확인 거리.
표 + 마지막 줄 판정.

## 규칙
명령은 한 호출에 한 가지 일만(`cd … &&`·파이프·`; echo` 로 묶지 말 것). 긴 실행은 `timeout 560`. 프로세스 조회·디버깅 포트 찌르기 금지. 서버 띄우기 금지. 막히면 변형을 찾지 말고 멈춰 보고(`rm -rf` 금지). puppeteer-core 는 `C:/Users/YDC/product-builder-lesson/node_modules` 읽기만. 프로필 복사 금지. 진짜 API 키 금지. 모든 실행 10분 이내, 표준 입력 대기 금지. C: 남은 공간 5GB 아래면 멈춤. 수정 범위: `review.md` 끝 절, 스크래치패드 `r9c2/` 만. 금지: 앱 코드·테스트·spec 수정, 커밋, `git checkout/restore/stash`, npm 설치·다운로드, `.nojekyll` 삭제, `G:`·`D:/OCR` 수정, 원서 문장 40자 초과 인용.
