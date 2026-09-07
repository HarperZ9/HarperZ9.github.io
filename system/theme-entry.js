import { mountThemeControl } from "./theme.js?v=20260907-theme-preferences";

if (!document.getElementById("site-theme-style")) {
  const sheet = document.createElement("link");
  sheet.id = "site-theme-style";
  sheet.rel = "stylesheet";
  sheet.href = new URL("./theme.css?v=20260907-theme-preferences", import.meta.url).href;
  document.head.append(sheet);
}

function mount() {
  let target = document.querySelector(".sn-more-list, .home-menu-list, .publication-static-nav, .theme-demo-nav");
  if (!target && document.body?.matches(".demo-editorial, .figure-document")) {
    target = document.createElement("nav");
    target.className = "theme-demo-nav";
    target.setAttribute("aria-label", "Appearance");
    document.body.prepend(target);
  }
  if (!target) return false;
  mountThemeControl(target);
  return true;
}

if (!mount()) {
  // The home navigation is rendered by React after the document arrives.
  const observer = new MutationObserver(() => { if (mount()) observer.disconnect(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
}
