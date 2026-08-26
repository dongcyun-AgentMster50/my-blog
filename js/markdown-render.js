// 코드 하이라이팅은 highlight.js가 DOM 삽입 후 처리하므로 marked는 관여하지 않는다.
// 목록 페이지는 marked를 로드하지 않으므로 설정은 호출 시점에 적용한다.
function renderMarkdown(body) {
  return marked.parse(body, { gfm: true, breaks: false });
}

function toExcerpt(body, maxLength = 160) {
  const firstBlock = body.trim().split(/\r?\n\s*\r?\n/)[0] || "";
  const plain = firstBlock
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain;
}

export { renderMarkdown, toExcerpt };
