const STORAGE_KEY = "theme";
const HLJS_LIGHT = "vendor/highlightjs/styles/github.min.css";
const HLJS_DARK = "vendor/highlightjs/styles/github-dark.min.css";

function getCurrentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const hljsLink = document.getElementById("hljs-theme");
  if (hljsLink) {
    hljsLink.href = theme === "dark" ? HLJS_DARK : HLJS_LIGHT;
  }
  const toggleBtn = document.getElementById("theme-toggle");
  if (toggleBtn) {
    toggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
    toggleBtn.setAttribute(
      "aria-label",
      theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"
    );
  }
}

function initThemeToggle() {
  applyTheme(getCurrentTheme());

  const toggleBtn = document.getElementById("theme-toggle");
  if (!toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    const next = getCurrentTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  });
}

export { initThemeToggle };
