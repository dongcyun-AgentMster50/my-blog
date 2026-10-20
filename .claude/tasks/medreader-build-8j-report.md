# Build 보고 — 8j 홈 화면 설치 + 8k-0 목소리 진단 페이지 (2026-10-20)

커밋하지 않았다. 앱 JS(`apps/medreader/js/`)는 한 줄도 바꾸지 않았다. `git diff --stat -- apps/medreader/js` 결과는 비어 있다.

## 1. 만든 파일과 바꾼 파일

| 파일 | 내용 |
|---|---|
| `apps/medreader/manifest.webmanifest` (새) | `name`·`short_name` "MedReader", `start_url "./"`, `scope "./"`, `display "standalone"`, `background_color #fdfcfa`(tokens.css 라이트 `--c-bg`), `theme_color #ffffff`(라이트 `--c-surface` = 상단 바 색), `icons` 5개. **`orientation` 없음**, 서비스 워커 없음 |
| `apps/medreader/icons/` (새) | `icon.svg`(882B, any) · `icon-192.png`(2,234B) · `icon-512.png`(6,439B) (any, 둥근 사각 바탕, 모서리 투명) · `icon-maskable-192.png`(1,494B) · `icon-maskable-512.png`(4,699B) (바탕을 칸 끝까지 채움, 그림 0.8배 → 가운데에서 가장 먼 점 약 146px/512, 안전 영역 반지름 204.8px 안) |
| `apps/medreader/dev/make-icons.mjs` (새) | Node 내장 `zlib`만 사용(npm 0). 도안 `DESIGN` 한 벌에서 SVG 글자와 PNG 픽셀(4×4 표본, RGBA 8bit, 줄 필터 0)을 **둘 다** 만든다. `--check` 지원 |
| `apps/medreader/index.html` | `<head>` 에 `<link rel="manifest">`, `theme-color` 두 개(라이트 #ffffff · 다크 #1e2227 — 다크 `--c-surface`), `rel="icon"`(SVG + PNG 192), `apple-touch-icon`(maskable 192 — 바탕이 꽉 차 iOS 가 모서리를 자른다) 를 넣었다. 주석 포함 12줄이고 모두 **stamp-importmap 구간 밖**에 있다 |
| `apps/medreader/dev/voices.html` | 8k-0 로 보강(아래 4) |
| `apps/medreader/tests/manifest-8j.test.mjs` (새) | MF1–MF10, 10건 |

**아이콘 도안**: 파란 바탕(`--c-accent` #0b5c8a) 위에 흰 **펼친 책**을 두고, 그 위에서 양옆으로 퍼지는 노란 **소리 물결 "(( ))"**(`--hl-bg` #ffef9e)를 그렸다. 뜻은 "읽어 주는 책"이다. 처음에는 위로 퍼지는 부채꼴 물결에 점을 찍었는데 Wi-Fi(인터넷이 필요하다는 뜻)로 읽혀서 바꿨다. 의료 십자는 쓰지 않았다.

## 2. 도장(stamp-importmap)과 캐시
- 도장은 `js/**/*.js`와 `css/*.css`만 다루고, 구간 밖은 한 글자도 건드리지 않는다. 그래서 manifest와 아이콘 링크를 구간 밖에 둬도 안전하다. MF8이 링크가 구간 **밖**에 있는지 잰다. `stamp --check` 결과는 0이다.
- **`?v=`는 붙이지 않았다.** manifest와 아이콘은 코드가 아니라서, 옛 판과 새 판이 섞여도 앱이 깨지지 않는다(PR-6 위험 없음). Pages 의 10분 캐시가 걸려도 최악의 경우 아이콘이나 색이 10분 늦게 바뀔 뿐이다. 오히려 manifest 주소를 판마다 바꾸면 설치된 앱의 갱신 확인이 흔들릴 수 있다 `[가정]`. 이 판단은 index.html 주석에 적어 두었다.

## 3. start_url·scope 와 서재 공유 (점검표 7)
- `start_url`·`scope`가 `"./"`이고 manifest 주소 기준으로 풀린다. 배포에서는 `/my-blog/apps/medreader/`(앱 폴더, `index.html`이 나오는 곳)가 된다. MF3이 GitHub Pages 꼴 주소로 풀어 확인한다. headless 에서도 `http://localhost:8000/apps/medreader/` 로 풀렸다.
- IndexedDB 와 localStorage 는 **출처(origin)마다** 하나이고 경로와 무관하다. 앱 코드에도 `location.pathname`을 쓰는 곳이 없다(grep 0건). 그래서 홈 화면에서 연 앱도 같은 출처(`*.github.io`)를 쓰므로, 같은 Chrome 프로필이면 서재를 공유한다 `[실기기 확인 몫]`.
- **주의 — API 키**: 키 기본 저장소는 `sessionStorage` 다(13절, `privacy.rememberKey` 끔). sessionStorage 는 창(탭)마다 따로라, 브라우저 탭에서 넣은 키가 **설치된 앱 창에는 없다**. 키를 다시 넣거나 "기억하기"를 켜야 한다. 버그는 아니지만 점검표 7 에 한 줄 더하기를 권한다.

## 4. 8k-0 진단 페이지 (`dev/voices.html`)
- 언어(ar·en·fr·ko)마다 [앱이 고른 음성 · App] · [voice 없이 `xx`] · [voice 없이 `xx-YY`](ar-SA·en-US·fr-FR·ko-KR) 단추가 있다. 영어에는 **[voice 없이 en-GB]** 가 더 있다.
- [앱이 고른 음성]은 규칙을 베끼지 않는다. `import('../js/tts/voices.js')`로 앱 모듈의 `pickVoice`(선호 URI 없음)를 **그대로 부르고**, 태그는 `speechLang`(ar = 번역문 경로)과 `utteranceLang`(en·fr·ko = 원문 경로)으로 정한다. 모듈을 못 받으면 이 단추만 안 되고 나머지 단추는 된다.
- **[en → ko → en 이어 말하기]**: voice 없이 en-US → ko-KR → en-US 로 읽는다. 앱처럼 앞 발화의 `onend` 안에서 다음 발화를 `speak` 하고, `onend` → 다음 `onstart` 간격(ms)을 화면과 기록에 남긴다. 기준선으로 **[en → en → en 기준]** 단추도 더했다(같은 간격을 언어 전환 없이 잰다 — 두 값의 차이가 전환 비용이다. M7 판정용). 지침에 없던 추가다.
- 음성 표에 `#·name·lang·localService·default·voiceURI` 를 보인다. 요약 표에는 언어별로 목록 수, 앱이 고를 음성, 앱이 쓸 lang 이 나온다. 기록은 1분 동안 남긴다(타이머 0.5~60초, 바뀔 때만).
- [결과 복사 · Copy results]: 요약, 마지막 간격, 기록 전체를 복사한다. 클립보드가 막히면 기록을 선택 상태로 만든다. 안내 문장은 한국어와 영어를 함께 적었다.
- 외부 자원 0, 저장소 API 0. `<link>` 는 앱 아이콘 하나뿐이다(루트 `favicon.ico` 404 막기).

## 5. 테스트 · 변이
- 새 테스트 MF1–MF10:
  - MF1·MF2·MF3: manifest 필드, JSON 유효성, `orientation` 없음(앱 JS 에 SW 등록도 없음), start·scope 가 앱 폴더 안이고 상대 경로
  - MF4: 색이 tokens.css 값과 같은지
  - MF5: 아이콘 파일이 있고 IHDR 크기가 `sizes`와 같은지, SVG + 192·512 any + maskable 이 모두 있는지
  - MF6: SVG 글자와 PNG **픽셀**이 생성기 결과와 같은지
  - MF7: maskable 안전 영역과 모서리 불투명
  - MF8: index.html 링크
  - MF9·MF10: voices.html 단추, 앱 모듈을 읽기만 하는지, 외부 자원과 저장소 0
- 전체 `node --test apps/medreader/tests/*.test.mjs`: 처음 1234 에서 **1244/1244**. 끝에 다시 2회 돌려 모두 통과했다(파일을 다 고친 뒤에도 2회 통과).
- **앱 JS diff 0**은 테스트로 넣지 않고 `git diff --stat -- apps/medreader/js`(비어 있음)로 확인했다. git diff 를 보는 테스트는 8k 처럼 JS 를 고치는 다음 단계가 진행 중일 때마다 빨개지기 때문이다. 대신 MF10 이 "진단 페이지는 `voices.js`를 import 만 한다"를 고정한다.
- `stamp-importmap --check` 0, `make-icons --check` 0.
- 변이 6개 → 모두 빨강 → 복원(백업 `b8j/bak/`를 읽어서 쓰기) → `cmp` 결과 같음:
  - X1 `orientation` 넣기 → MF2
  - X2 icon-192.png 를 180px 로 → MF5·MF6
  - X3 manifest 링크 빼기 → MF8
  - X4 maskable 배율 1.2 → MF6·MF7
  - X5 진단 페이지가 외부 모듈 import → MF10
  - X6 start_url `../` → MF1·MF3

## 6. headless Edge (새 프로필 `b8j/p1` 하나, 8000번 python PID 15088 사용 — 끄지 않음)
- 앱(`/apps/medreader/` = start_url):
  - 부팅 OK, 콘솔 오류 0, 4xx 0, boot-fail 없음.
  - CDP `Page.getAppManifest` errors `[]`, `Page.getInstallabilityErrors` `[]`, `Page.getManifestIcons` primaryIcon 있음.
  - fetch 결과: manifest 200 `application/manifest+json`, 아이콘 5개 200(PNG `createImageBitmap` 결과 192×192·512×512).
  - favicon 요청이 `icons/icon.svg`로 가고 **루트 `favicon.ico` 요청은 0**이다. 아이콘 링크가 없는 페이지(진단 페이지 첫 판)에서는 `/favicon.ico` 404 가 실제로 났다. 즉 앱의 기존 favicon 404 가 사라진 것으로 본다.
  - 기존 동작: 합성 PDF(zorvat6, 6쪽) 가져오기 → 리더 2쪽 표시 → 이 책 검색 "plonitis" 12항목.
- 진단 페이지(360px, 흉내 음성: 목록 en_US(기기·default)·en-GB(네트워크)·ko-KR·fr-FR, 아랍어 0개, 언어가 바뀌면 시작 400ms 지연):
  - 단추 16개가 뜨고, 앱 모듈을 읽었다.
  - 요약: ar "없음 → voice 없이 ar-SA (번역문 경로)", en "English United States · en_US / en-US".
  - [앱이 고른 음성 en]은 voice 를 지정했다. [voice 없이 en-GB]는 voice 없이 `lang=en-GB` 였다.
  - 간격: en-ko-en "en-US→ko-KR 404ms · ko-KR→en-US 408ms", 기준 "31ms · 31ms".
  - 복사됨, 가로 스크롤 0(360/360), 콘솔 오류 0, 바깥 요청 0.
- **설치 가능성**: CDP 기준으로는 오류 0 이다. 하지만 실제 "앱 설치" 메뉴와 standalone 열림은 headless 에서 판정하지 않았다 → 실기기 몫.
- 바깥 요청은 앱의 pdf.js CDN 2건뿐이다(기존 동작).

## 7. 실기기에서 볼 것
- `[D]` 데스크톱 Chrome DevTools > Application > Manifest: 경고 0, 설치 버튼. Chrome 이 "id 가 없어 start_url 을 쓴다"는 **안내(note)**를 띄울 수 있다. 경고로 칠지는 Review 가 정한다. 필요하면 `"id": "./"`(기본값과 같은 결과) 한 줄을 더하면 되는데, spec 8j 줄에 없어서 넣지 않았다.
- `[M]` Galaxy Z Fold 7·Realme(점검표 7): 홈 화면에 추가 / 앱 설치 → 주소창 없이 열리는가, **서재의 책과 진도가 그대로인가**, 아이콘이 잘리지 않는가(maskable), 상태 바 색(라이트 흰색 / 시스템 다크 #1e2227), 가로로 돌리면 따라 도는가(`orientation` 없음).
- `[M]` 점검표 2: 진단 페이지에서 1분 기다린 뒤 아래를 눌러 결과를 복사한다.
  - ar·en 의 세 단추를 누르고, 어느 단추가 휴대폰 설정 목소리와 같은지 적는다.
  - [voice 없이 en-GB]가 실제로 영국 억양인지 확인한다.
  - [en → ko → en] 간격과 [기준] 간격을 비교한다(M7: 전환 간격이 1초를 넘는가).

## 8. 남은 프로세스
- 8000번 python(PID 15088)은 그대로 두었다. 8123·8124·8125번 node 는 건드리지 않았다.
- 내가 띄운 headless Edge 는 두 번 모두 `browser.close()`로 닫았다(실행 전후 msedge 프로세스 수 15 → 15, 이 15개는 원래 있던 것).
- 중간에 실수로 띄운 `python -`(PID 15620, 표준 입력 대기 — 셸 명령에 남은 군더더기 한 줄)를 명령줄을 확인한 뒤 강제 종료했다. 다른 프로세스는 건드리지 않았다.

## 9. 남은 문제 · 제안
1. **사용자가 고른 테마와 상태 바 색**: `theme-color` 는 OS 의 라이트·다크만 따른다. 앱에서 직접 다크·세피아·고대비를 골랐는데 OS 와 다르면 상태 바 색이 상단 바와 어긋난다. 고치려면 JS 가 필요해서 8j 의 "JS 0줄" 밖이다 → 4단계 테마 쪽이나 8k 이후 작은 항목 후보로 둔다.
2. **spec 2-1 트리 문안**: "icon.svg (SVG 하나. PNG 변환은 하지 않는다)"가 E3 (가)와 어긋난다. Plan 이 고칠 문안을 제안한다: "`icons/` — icon.svg + PNG 192·512(any·maskable 각 2), `dev/make-icons.mjs` 가 같은 도안으로 만든다(npm 0)". 같은 트리의 `dev/`에도 `make-icons.mjs` 를 더한다.
3. 점검표 7 에 API 키(sessionStorage) 한 줄을 더하자는 제안(위 3).
4. 진단 페이지의 [앱이 고른 음성]은 지금 규칙(`pickVoice`)이다. 8k 가 `resolveSpeech`로 바꾸면 그때 이 단추를 새 규칙으로 맞출지 8k Plan 에서 정한다.
5. 진단 페이지는 앱 `voices.js`를 판 번호 없는 주소로 읽는다. 배포 직후 최대 10분 동안 옛 `voices.js`를 받을 수 있다(개발 페이지라 영향은 작다).
