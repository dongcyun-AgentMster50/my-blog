// Front matter 형식은 정식 YAML이 아니라, "key: value" 줄 기반의 단순 포맷이다.
const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseTags(rawValue) {
  let value = rawValue.trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1);
  }
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseFrontMatter(raw, fallbackTitle) {
  const match = FRONT_MATTER_RE.exec(raw);
  const meta = { title: fallbackTitle, date: null, tags: [] };

  if (!match) {
    return { meta, body: raw };
  }

  const block = match[1];
  const body = raw.slice(match[0].length);

  for (const line of block.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === "title" && value) {
      meta.title = value;
    } else if (key === "date" && value) {
      meta.date = value;
    } else if (key === "tags" && value) {
      meta.tags = parseTags(value);
    }
  }

  return { meta, body };
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function dateSortValue(dateStr) {
  if (!dateStr) return -Infinity;
  const time = new Date(dateStr).getTime();
  return Number.isNaN(time) ? -Infinity : time;
}

export { parseFrontMatter, formatDate, dateSortValue };
