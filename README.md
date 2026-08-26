# my blog

마크다운 파일을 읽어 블로그로 보여주는 정적 사이트. 프레임워크도, 빌드 과정도 없습니다.

## 실행하기

`fetch`로 로컬 파일을 읽기 때문에 `index.html`을 더블클릭해서 여는 방식(`file://`)으로는 동작하지 않습니다. 반드시 로컬 HTTP 서버로 실행하세요.

```bash
python -m http.server 8000
```

그 다음 브라우저에서 http://localhost:8000 접속.

## 새 글 쓰기

1. `posts/` 폴더에 마크다운 파일을 만듭니다. **파일 이름이 곧 글의 주소(slug)** 입니다. 예: `posts/my-new-post.md` → `post.html?slug=my-new-post`

2. 파일 맨 위에 Front Matter를 적습니다.

   ```markdown
   ---
   title: 새 글 제목
   date: 2026-08-26
   tags: [태그1, 태그2]
   ---

   여기부터 본문입니다.
   ```

   - `title` — 글 제목. 없으면 파일 이름이 대신 쓰입니다.
   - `date` — `YYYY-MM-DD` 형식 권장. 목록 정렬 기준이며, 없으면 맨 뒤로 밀립니다.
   - `tags` — `[a, b]` 또는 `a, b` 둘 다 됩니다. 생략 가능합니다.

3. `posts/manifest.json`의 목록에 파일 이름을 추가합니다.

   ```json
   { "posts": ["welcome-to-my-blog.md", "my-new-post.md"] }
   ```

   정적 사이트에는 폴더 목록을 읽는 방법이 없어서, 어떤 글이 있는지 알려주는 이 파일이 필요합니다.

끝입니다. 새로고침하면 목록에 나타납니다.

## 구조

```
index.html          글 목록
post.html           개별 글 (?slug=...)
css/tokens.css      색상·타이포 변수 (라이트/다크)
css/base.css        리셋, 레이아웃, 헤더/푸터
css/components.css  글 카드, 태그
css/post.css        본문 스타일
js/theme.js         다크 모드 토글
js/frontmatter.js   Front Matter 파서
js/home.js          목록 페이지 로직
js/post.js          글 페이지 로직
posts/              마크다운 원고 + manifest.json
vendor/             marked.js, highlight.js (직접 포함)
```

## 알아둘 점

- **다크 모드**는 처음에는 시스템 설정을 따르고, 헤더 오른쪽 버튼으로 바꾸면 그 선택이 브라우저에 저장됩니다. 테마를 정하는 스크립트는 각 HTML `<head>` 맨 위에 인라인으로 들어 있습니다. 화면 깜빡임을 막으려면 이 위치를 옮기면 안 됩니다.

- **검색엔진 노출**: 본문이 브라우저에서 렌더링되므로 JavaScript를 실행하지 않는 크롤러에는 내용이 보이지 않습니다. 빌드 과정을 두지 않기로 한 데 따른 의도된 선택입니다.

- **본문은 신뢰된 콘텐츠로 취급**합니다. 렌더링 결과를 `innerHTML`로 삽입하므로, 외부에서 받은 마크다운을 그대로 올리면 안 됩니다.

## 포함된 라이브러리

패키지 매니저 없이 직접 내려받아 `vendor/`에 넣었습니다. 업데이트하려면 아래 주소에서 다시 받으면 됩니다.

- marked 12.0.2 — https://cdn.jsdelivr.net/npm/marked@12/lib/marked.umd.min.js
- highlight.js 11.9.0 — https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js
  - 테마: `styles/github.min.css`, `styles/github-dark.min.css`
