---
title: 오늘 배운 것
date: 2026-08-26
tags: [기록, 웹, 기초]
---

클로드 코드와 함께 이 블로그를 만들면서, 웹페이지가 HTML과 CSS와 JavaScript 세 가지로 이루어진다는 걸 몸으로 알게 됐습니다. 셋이 각각 무슨 일을 하는지 오늘 이해한 만큼만 정리해 둡니다.

## HTML — 무엇이 있는가

HTML은 페이지에 **무엇이 있는지**를 적는 언어입니다. 제목, 문단, 목록, 링크, 버튼 같은 것들이요.

이 블로그의 `index.html`을 열어보면 놀랍도록 짧습니다. 글 목록이 통째로 들어 있을 줄 알았는데, 실제로는 이런 뼈대뿐이었습니다.

```html
<header class="site-header">
  <a class="site-title" href="index.html">my blog</a>
  <button id="theme-toggle" class="theme-toggle"></button>
</header>

<main id="app">
  <p class="state-message">글을 불러오는 중…</p>
</main>
```

`<main id="app">`은 그냥 **빈 상자**입니다. 글 목록은 나중에 JavaScript가 여기에 채워 넣습니다. HTML은 "여기에 뭔가 들어올 자리가 있다"고 선언만 해두는 것이죠.

`class`와 `id`도 오늘 구분이 됐습니다. `class`는 CSS에게 "이건 이런 종류야"라고 알려주는 이름표고, `id`는 JavaScript가 특정 요소 하나를 콕 집어 찾을 때 쓰는 고유한 이름입니다.

## CSS — 어떻게 보이는가

CSS는 HTML이 만든 것들이 **어떻게 보일지**를 정합니다. 색, 크기, 간격, 배치 같은 것들이요.

오늘 가장 크게 배운 건 **CSS 변수**였습니다. 색을 여기저기 흩어놓지 않고 한곳에 이름 붙여 모아두는 방식입니다.

```css
:root {
  --color-bg: #ffffff;
  --color-text: #1a1d21;
}

:root[data-theme="dark"] {
  --color-bg: #14171a;
  --color-text: #e8eaed;
}
```

그리고 실제로 쓸 때는 색을 직접 적지 않고 변수를 부릅니다.

```css
body {
  background: var(--color-bg);
  color: var(--color-text);
}
```

이렇게 해두면 다크 모드가 거의 공짜로 해결됩니다. `data-theme="dark"` 하나만 바뀌면 그 변수를 쓰는 모든 곳의 색이 한꺼번에 따라 바뀌니까요. 다크 모드를 만들려면 화면 전체를 두 벌 만들어야 하는 줄 알았는데, **바뀌는 건 값 몇 개뿐**이었습니다.

`clamp()`도 인상적이었습니다.

```css
--font-size-h1: clamp(1.75rem, 1.4rem + 2vw, 2.5rem);
```

"최소 이만큼, 화면 크기에 따라 유동적으로, 최대 이만큼"이라는 뜻입니다. 화면 폭마다 글자 크기를 일일이 정해주지 않아도 알아서 자연스럽게 커지고 작아집니다.

## JavaScript — 무슨 일이 일어나는가

JavaScript는 **동작**을 담당합니다. 무언가를 가져오고, 계산하고, 바꾸는 일이요.

이 블로그에서 JavaScript가 하는 일을 순서대로 적으면 이렇습니다.

1. `manifest.json`을 읽어 어떤 글이 있는지 확인하고
2. 각 마크다운 파일을 `fetch`로 가져와서
3. 맨 위 Front Matter에서 제목과 날짜를 뽑아내고
4. 날짜순으로 정렬한 다음
5. 아까 그 빈 `<main>` 상자에 카드를 만들어 넣습니다

```js
const response = await fetch(`posts/${slug}.md`);
if (!response.ok) {
  throw new Error("글을 찾을 수 없습니다");
}
const raw = await response.text();
```

`await`이라는 단어가 계속 나오는데, "이건 시간이 걸리는 일이니 끝날 때까지 기다려"라는 뜻이라고 합니다. 파일을 가져오는 데는 시간이 걸리고, 도착하기 전에 다음 줄로 넘어가면 안 되니까요.

다크 모드 버튼도 결국 세 줄짜리였습니다.

```js
const next = getCurrentTheme() === "dark" ? "light" : "dark";
localStorage.setItem("theme", next);
applyTheme(next);
```

테마를 뒤집고, 브라우저에 기억시키고, 화면에 반영합니다. 실제로 색을 바꾸는 건 CSS고 JavaScript는 **스위치만 누르는** 역할이라는 게 재미있었습니다.

## 셋의 관계

정리하면 이렇습니다.

| | 역할 | 이 블로그에서 |
| --- | --- | --- |
| HTML | 무엇이 있는가 | 빈 뼈대와 들어갈 자리 |
| CSS | 어떻게 보이는가 | 색·간격·글자 크기, 다크 모드 |
| JavaScript | 무슨 일이 일어나는가 | 마크다운을 읽어 화면에 채우기 |

> 각자 자기 일만 하고 남의 일에 끼어들지 않는다 — 이게 오늘 배운 것 중 제일 중요한 것 같습니다.

색을 바꾸고 싶으면 CSS만 열면 되고, 글을 어떻게 정렬할지 바꾸고 싶으면 JavaScript만 열면 됩니다. 처음엔 파일이 여러 개로 나뉘어 있는 게 복잡해 보였는데, 오히려 **어디를 고쳐야 할지 분명해서** 편하다는 걸 알게 됐습니다.

## 다음에 해볼 것

- 태그를 눌러 같은 태그의 글만 모아보기
- 글이 많아졌을 때 검색 기능 붙이기

아직 모르는 게 훨씬 많지만, 적어도 화면에 보이는 것이 어디서 오는지는 알게 된 하루였습니다.
