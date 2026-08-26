const MANIFEST_URL = "posts/manifest.json";

async function loadManifest() {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error(`manifest.json을 불러오지 못했습니다 (${response.status})`);
  }
  const data = await response.json();
  const posts = Array.isArray(data) ? data : data.posts;
  return Array.isArray(posts) ? posts : [];
}

export { loadManifest };
