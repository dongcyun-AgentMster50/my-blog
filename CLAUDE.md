# my-blog

마크다운(.md) 파일을 읽어 정적 블로그 웹사이트로 변환하는 프로젝트.

## 기술 스택 / 제약

- **프레임워크 없이 순수 HTML, CSS, JavaScript만 사용한다.** React/Vue 같은 프레임워크나 번들러(Webpack, Vite 등)를 도입하지 않는다. `package.json`도 두지 않는다.
- **빌드 단계가 없다.** 브라우저가 `fetch`로 `.md` 파일을 직접 읽어 런타임에 렌더링한다. 글을 추가할 때 실행할 명령이 있어서는 안 된다.
- 외부 라이브러리는 `vendor/`에 직접 내려받아 포함한다(CDN 링크 금지). 현재 marked 12.0.2, highlight.js 11.9.0. 새 의존성 추가는 신중하게 판단하고, 애매하면 사용자에게 확인한다.
- JS는 ES 모듈(`<script type="module">`)로 작성한다. 단, `marked`/`hljs`는 전역으로 로드되는 UMD 빌드라 `post.html`에서 모듈보다 먼저 `<script>`로 불러온다.

## 구조

- `index.html` — 글 목록. `js/home.js`가 `posts/manifest.json`을 읽고 각 `.md`를 `Promise.allSettled`로 병렬 fetch해 카드로 렌더링(날짜 내림차순).
- `post.html` — 개별 글. `?slug=파일명`으로 `posts/<slug>.md`를 fetch. **파일 이름이 곧 slug다.**
- `posts/manifest.json` — 정적 사이트는 폴더 목록을 읽을 수 없어 존재하는 글을 알려주는 색인이 필요하다. 새 글은 여기 등록해야 보인다.
- `css/tokens.css` — 색상/타이포 변수. 다크 모드 색은 **오직 여기에만** `:root[data-theme="dark"]`로 정의한다.

## 주의사항

- **테마 스크립트 위치는 order-critical이다.** 각 HTML `<head>` 최상단(스타일시트 링크보다 앞)의 인라인 스크립트가 `data-theme`을 설정한다. 외부 파일로 빼거나 `defer`를 붙이거나 아래로 옮기면 테마 깜빡임(FOUC)이 생긴다.
- 다크 모드 판정의 단일 소스는 JS다. `prefers-color-scheme` 미디어쿼리로 다크 색상을 CSS에 중복 정의하지 않는다.
- `file://`로는 fetch가 막혀 동작하지 않는다. 테스트는 항상 로컬 HTTP 서버(`python -m http.server 8000`)로 한다.
- **루트의 `.nojekyll`을 지우지 않는다.** GitHub Pages는 기본으로 Jekyll을 돌리는데, Jekyll이 `posts/*.md`를 변환 대상으로 삼켜 원본이 404가 된다. 이 블로그는 브라우저가 `.md` 원본을 fetch해야 하므로 Jekyll을 꺼야 한다.
- 하나의 글 fetch가 실패해도 목록 전체가 비면 안 된다(`Promise.all` 대신 `allSettled` 유지).
- 본문 렌더링 결과만 `innerHTML`로 삽입한다(저장소 안의 신뢰된 마크다운). 제목·요약 등 나머지는 `textContent`로 넣는다.
- 커밋/푸시는 요청받았을 때만 한다. 줄바꿈은 `.gitattributes`에서 LF로 정규화하므로 CRLF 경고는 무시해도 된다.

## 디자인 원칙

- 본문 가독성 우선: 본문 폭 제한(`--content-max-width: 42rem`), 넉넉한 줄 간격, 장식 최소화.
- 폰트는 `clamp()`로 유동 스케일. 브레이크포인트는 구조가 바뀌는 지점(`max-width: 640px`)에만 쓴다.
- 라이트/다크 양쪽 모두 대비를 확보한다. 코드 블록 테마도 사이트 테마와 함께 전환된다(`#hljs-theme` link의 href 교체).
