---
title: 마크다운 문법 정리
date: 2026-08-24
tags: [마크다운, 참고]
---

이 글은 블로그가 지원하는 마크다운 문법을 한눈에 확인하기 위한 예시입니다.

## 제목

`#` 개수로 단계를 정합니다. 본문에서는 `##`부터 쓰는 편이 자연스럽습니다.

### 세 번째 단계 제목

## 강조와 링크

**굵게**, *기울임*, `인라인 코드`를 쓸 수 있고 [링크](https://example.com)도 넣을 수 있습니다.

## 목록

- 순서 없는 목록
- 두 번째 항목
  - 들여쓴 항목

1. 순서 있는 목록
2. 두 번째
3. 세 번째

## 인용

> 인용문은 이렇게 표시됩니다.
> 여러 줄로 이어 쓸 수도 있습니다.

## 코드 블록

언어 이름을 적으면 문법 강조가 적용됩니다.

```js
async function loadPost(slug) {
  const response = await fetch(`posts/${slug}.md`);
  if (!response.ok) {
    throw new Error("글을 찾을 수 없습니다");
  }
  return response.text();
}
```

```css
:root[data-theme="dark"] {
  --color-bg: #14171a;
  --color-text: #e8eaed;
}
```

## 표

| 항목 | 설명 |
| --- | --- |
| title | 글 제목 |
| date | 작성일 (YYYY-MM-DD) |
| tags | 태그 목록 |

---

가로줄은 `---`로 넣습니다.
