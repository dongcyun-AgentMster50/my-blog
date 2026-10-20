# Build 지침 — 8j 홈 화면 설치 + 8k-0 목소리 진단 페이지 (한 배포)

> 너는 **Build 서브에이전트**다. 운영자가 spec **19-1-1** 의 8j 를 지금 진행하기로 했다(2026-10-20). 승인: E2 (가) 8j 는 **8k-0 과 한 배포**, E3 (가) 아이콘 **SVG + PNG 192·512(maskable 포함)**. 19-1-2 O-D7·3절 6 에 따라 8k-0 에 **[voice 없이 en-US] [voice 없이 en-GB]** 와 **[en → ko → en 이어 말하기]**(전환 간격 표시) 단추를 더한다. 8g 검색은 배포됨(`e9e21ec`).
> **커밋하지 않는다.** 한국어로 쓴다. 보고서는 `.claude/tasks/medreader-build-8j-report.md`.

## 읽을 것
- spec **19-1-1 전체**(특히 N14·N2 분류, 3절 배치 표의 **8j 줄**과 **8k-0 줄**, 8j 수용 기준(뼈대), 점검표 2·7, E2·E3 승인), **19-1-2**(3절 6 — 8k-0 억양·전환 간격 단추, M7), 2-1 파일 구조(manifest·icons 계획), 16절 `[M]` 홈 화면 추가 항목, 6-3(목소리 — `getVoices` 빈 배열 1.5초).
- 코드(읽기): `index.html`, `css/tokens.css`(테마 색 — `theme_color`·`background_color` 근거), `js/tts/voices.js`(`pickVoice` — 8k-0 의 [앱이 고른 음성] 이 같은 규칙을 써야 함), `js/settings.js`, `dev/stamp-importmap.mjs`, `tests/importmap.test.mjs`, 기존 `dev/voices.html`(있다면).

## 할 일
**8j — 앱 JS 0줄**(19-1-1 원칙)
1. `apps/medreader/manifest.webmanifest`(새): spec 8j 줄 그대로(`name`·`short_name` "MedReader", `start_url "./"`, `scope "./"`, `display "standalone"`, `background_color`·`theme_color` = tokens.css 기본 테마, `icons` SVG + PNG 192·512 + maskable). **`orientation` 없음**(8e 가로 읽기를 막지 않게). 서비스 워커 **없음**([P2]).
2. 아이콘: `apps/medreader/icons/`(새) — SVG 하나 + PNG 192·512(`purpose: "any"` 와 `"maskable"` — maskable 은 안전 영역 80% 원 안에 그림). PNG 는 **`apps/medreader/dev/make-icons.mjs`(새, Node 내장 `zlib` 만 — npm 금지)** 로 SVG 와 같은 도안을 픽셀로 그려 만든다(복잡한 SVG 래스터화 대신 단순 도형 도안이면 충분 — 도안은 네 판단, 의료 십자 같은 오해 소지 표식은 피하고 "책 + 소리" 류).
3. `index.html` `<head>`: `<link rel="manifest">`, `<meta name="theme-color">`(필요하면 라이트·다크 둘), `<link rel="icon">`·`<link rel="apple-touch-icon">`. **블로그 본체 규칙 — CDN 금지는 앱엔 해당 없음, 그래도 이번엔 외부 자원 0.** import map 도장(`stamp-importmap`)이 manifest·아이콘을 어떻게 다루는지 확인 — 캐시 문제(`?v=`)가 있으면 spec 범위 안에서 처리하고 보고.
4. **서재가 그대로인가**(점검표 7): 홈 화면에서 연 앱이 같은 출처·같은 경로라 IndexedDB 를 공유해야 한다 — `start_url`·`scope` 가 지금 앱 경로(`/my-blog/apps/medreader/`)와 맞는지.

**8k-0 — 개발 페이지만, 앱 동작 불변**
5. `apps/medreader/dev/voices.html`(있으면 보강, 없으면 새): 언어(ar·en·fr·ko)마다 [앱이 고른 음성](`pickVoice` 와 같은 규칙) · [voice 없이 `xx`] · [voice 없이 `xx-YY`](ar-SA·en-US·fr-FR·ko-KR) + en 은 [voice 없이 en-US]·[voice 없이 en-GB], 그리고 [en → ko → en 이어 말하기](각 발화 `onend` → 다음 `onstart` 간격 ms 표시). 목록의 각 음성 `name`·`lang`·`localService`·`default` 표시, 결과를 [복사] 할 수 있게(점검표 2 — Nour 가 복사해 보냄). 외부 자원 0, 진짜 키·네트워크 0.
6. 테스트: manifest 필드·JSON 유효·`orientation` 없음·아이콘 파일 존재와 PNG 크기(헤더 IHDR 로 192·512 확인)·`index.html` 링크, `dev/voices.html` 이 앱 모듈을 바꾸지 않는지(앱 코드 diff 0).
7. stamp 다시, `--check` 0.

## 검증
- 전체 `node --test apps/medreader/tests/*.test.mjs` 2회(지금 1234 + 새). **앱 JS 파일 diff 0** 확인(`git diff --stat -- apps/medreader/js` 가 비어야 함).
- 변이 2개 이상(예: `orientation` 넣기, 아이콘 크기 틀리기) → 빨강 → 복원(**읽어서 쓰기 + `cmp`**). 백업 스크래치패드 `b8j/bak/`.
- **headless Edge**: 앱을 열어 manifest 가 읽히는지(`navigator`·DevTools 프로토콜 또는 `fetch` 로 JSON·아이콘 200), 콘솔 오류 0(기존 favicon 404 가 사라지면 기록), 기존 리더·검색 동작 그대로(한 번 열어 보기). 설치 가능성(installability)은 headless 에서 판정이 어려우면 "실기기 몫"으로. `dev/voices.html` 을 열어 단추가 뜨고 흉내 음성으로 간격 숫자가 나오는지. 8000번 python(PID 15088)은 쓰고 끄지 마라(없으면 레포 루트에서 띄움). 8123·8124·8125번 node 는 건드리지 마라. 프로필은 새로 만든 것 1개.
- **모든 실행에 시간 상한**. 표준 입력을 기다리는 명령 금지(편집은 Edit 도구). 띄운 Edge·node 정리.

## 수정 범위
`apps/medreader/manifest.webmanifest`(새), `apps/medreader/icons/*`(새), `apps/medreader/index.html`(`<head>` 링크·meta·도장), `apps/medreader/dev/make-icons.mjs`(새), `apps/medreader/dev/voices.html`, `apps/medreader/tests/`(새), 스크래치패드 `b8j/`, 보고서. **`apps/medreader/js/` 는 건드리지 않는다.** spec·review 금지(고칠 문안은 보고서에). 블로그 본체(`/index.html`, `post.html`, `css/`, `js/`)는 건드리지 않는다.

## 금지
커밋, `git checkout/restore/stash`, `rm -rf`(막히면 변형 명령을 찾지 말고 보고), npm 설치·다운로드, `.nojekyll` 삭제, 진짜 API 키.
