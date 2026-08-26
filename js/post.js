import { initThemeToggle } from "./theme.js";
import { parseFrontMatter, formatDate } from "./frontmatter.js";
import { renderMarkdown } from "./markdown-render.js";

const app = document.getElementById("app");
const SITE_NAME = "my blog";

function showNotFound(message) {
  app.replaceChildren();

  const p = document.createElement("p");
  p.className = "state-message";
  p.textContent = message;

  const back = document.createElement("p");
  back.className = "state-message";
  const link = document.createElement("a");
  link.href = "index.html";
  link.textContent = "← 글 목록으로 돌아가기";
  back.append(link);

  app.append(p, back);
}

function createHeader(meta) {
  const header = document.createElement("header");
  header.className = "post-article-header";

  const back = document.createElement("a");
  back.className = "back-link";
  back.href = "index.html";
  back.textContent = "← 목록";
  header.append(back);

  const title = document.createElement("h1");
  title.className = "post-article-title";
  title.textContent = meta.title;
  header.append(title);

  const metaRow = document.createElement("div");
  metaRow.className = "post-meta";

  if (meta.date) {
    const time = document.createElement("time");
    time.className = "post-date";
    time.dateTime = meta.date;
    time.textContent = formatDate(meta.date);
    metaRow.append(time);
  }

  for (const tag of meta.tags) {
    const span = document.createElement("span");
    span.className = "tag-pill";
    span.textContent = tag;
    metaRow.append(span);
  }

  if (metaRow.childElementCount) {
    header.append(metaRow);
  }

  return header;
}

async function renderPost() {
  const slug = new URLSearchParams(window.location.search).get("slug");
  if (!slug) {
    showNotFound("글 주소가 올바르지 않습니다.");
    return;
  }

  let raw;
  try {
    const response = await fetch(`posts/${encodeURIComponent(slug)}.md`);
    if (!response.ok) {
      throw new Error(`${response.status}`);
    }
    raw = await response.text();
  } catch (error) {
    console.error(error);
    showNotFound("글을 찾을 수 없습니다.");
    return;
  }

  const { meta, body } = parseFrontMatter(raw, slug);
  document.title = `${meta.title} — ${SITE_NAME}`;

  const article = document.createElement("article");
  article.append(createHeader(meta));

  const bodyEl = document.createElement("div");
  bodyEl.className = "post-body";
  try {
    // 본문은 저장소 안의 신뢰된 마크다운이므로 innerHTML 삽입을 허용한다.
    bodyEl.innerHTML = renderMarkdown(body);
  } catch (error) {
    console.error(error);
    showNotFound("글을 표시하는 중 문제가 발생했습니다.");
    return;
  }
  article.append(bodyEl);

  app.replaceChildren(article);

  bodyEl.querySelectorAll("pre code").forEach((block) => hljs.highlightElement(block));
}

initThemeToggle();
renderPost();
