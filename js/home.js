import { initThemeToggle } from "./theme.js";
import { loadManifest } from "./manifest.js";
import { parseFrontMatter, formatDate, dateSortValue } from "./frontmatter.js";
import { toExcerpt } from "./markdown-render.js";

const app = document.getElementById("app");

function slugFromFilename(filename) {
  return filename.replace(/\.md$/i, "");
}

async function fetchPost(filename) {
  const response = await fetch(`posts/${filename}`);
  if (!response.ok) {
    throw new Error(`${filename} (${response.status})`);
  }
  const raw = await response.text();
  const slug = slugFromFilename(filename);
  const { meta, body } = parseFrontMatter(raw, slug);
  return { slug, ...meta, excerpt: toExcerpt(body) };
}

function createTagList(tags) {
  const ul = document.createElement("ul");
  ul.className = "tag-list";
  for (const tag of tags) {
    const li = document.createElement("li");
    li.className = "tag-pill";
    li.textContent = tag;
    ul.append(li);
  }
  return ul;
}

function createCard(post) {
  const li = document.createElement("li");
  li.className = "post-card";

  const link = document.createElement("a");
  link.className = "post-card-title-link";
  link.href = `post.html?slug=${encodeURIComponent(post.slug)}`;

  const title = document.createElement("h2");
  title.className = "post-card-title";
  title.textContent = post.title;
  link.append(title);
  li.append(link);

  if (post.date) {
    const meta = document.createElement("div");
    meta.className = "post-meta";
    const time = document.createElement("time");
    time.className = "post-date";
    time.dateTime = post.date;
    time.textContent = formatDate(post.date);
    meta.append(time);
    li.append(meta);
  }

  if (post.excerpt) {
    const excerpt = document.createElement("p");
    excerpt.className = "post-excerpt";
    excerpt.textContent = post.excerpt;
    li.append(excerpt);
  }

  if (post.tags.length) {
    li.append(createTagList(post.tags));
  }

  return li;
}

function showMessage(text) {
  app.replaceChildren();
  const p = document.createElement("p");
  p.className = "state-message";
  p.textContent = text;
  app.append(p);
}

async function renderHome() {
  let filenames;
  try {
    filenames = await loadManifest();
  } catch (error) {
    console.error(error);
    showMessage("글 목록을 불러오지 못했습니다. 로컬 HTTP 서버로 실행 중인지 확인해 주세요.");
    return;
  }

  if (!filenames.length) {
    showMessage("아직 작성된 글이 없습니다.");
    return;
  }

  const results = await Promise.allSettled(filenames.map(fetchPost));
  const posts = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      posts.push(result.value);
    } else {
      console.warn("글을 건너뜁니다:", result.reason);
    }
  }

  if (!posts.length) {
    showMessage("글을 불러오지 못했습니다.");
    return;
  }

  posts.sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date));

  const list = document.createElement("ul");
  list.className = "post-list";
  list.append(...posts.map(createCard));
  app.replaceChildren(list);
}

initThemeToggle();
renderHome();
