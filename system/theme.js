// One preference for the site's reading and product surfaces. No account needed.
const storageKey = "site-theme";
const modes = new Set(["system", "light", "dark"]);
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
const root = document.documentElement;
const controls = new Set();
let preference = "system";

function normalize(value) {
  return modes.has(value) ? value : "system";
}

function notifyFrames() {
  for (const frame of document.querySelectorAll("iframe")) {
    try {
      if (new URL(frame.src || location.href, location.href).origin !== location.origin) continue;
      frame.contentWindow?.postMessage({ type: "zentropy-theme-v1", preference }, location.origin);
    } catch { /* Cross-origin and unavailable frames keep their own appearance. */ }
  }
}

function apply(value, persist = false) {
  preference = normalize(value);
  const resolved = preference === "system" ? (systemDark.matches ? "dark" : "light") : preference;
  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  for (const control of controls) control.value = preference;
  if (persist) {
    try { localStorage.setItem(storageKey, preference); } catch { /* Manual choice still works this visit. */ }
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: { preference, resolved } }));
  notifyFrames();
}

export function getThemePreference() {
  return preference;
}

export function setThemePreference(value) {
  apply(value, true);
}

export function mountThemeControl(container) {
  if (!container) return null;
  const existing = container.querySelector("[data-theme-control]");
  if (existing) return existing;
  const label = document.createElement("label");
  label.className = "theme-control";
  const caption = document.createElement("span");
  caption.textContent = "Theme";
  const select = document.createElement("select");
  select.dataset.themeControl = "";
  select.setAttribute("aria-label", "Color theme");
  for (const [value, name] of [["system", "System"], ["light", "Light"], ["dark", "Dark"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = name;
    select.append(option);
  }
  select.value = preference;
  select.addEventListener("change", () => setThemePreference(select.value));
  controls.add(select);
  label.append(caption, select);
  if (container.matches(".sn-more-list,.home-menu-list")) container.prepend(label);
  else container.append(label);
  return select;
}

try { preference = normalize(localStorage.getItem(storageKey)); } catch { /* System is the safe default. */ }
apply(preference);
systemDark.addEventListener("change", () => {
  if (preference === "system") apply(preference);
});
window.addEventListener("storage", event => {
  if (event.key === storageKey || event.key === null) apply(event.newValue);
});
window.addEventListener("message", event => {
  if (window.parent === window || event.source !== window.parent || event.origin !== location.origin) return;
  if (event.data?.type === "zentropy-theme-v1") apply(event.data.preference);
});
document.addEventListener("load", event => {
  if (event.target instanceof HTMLIFrameElement) notifyFrames();
}, true);
document.addEventListener("DOMContentLoaded", notifyFrames, { once: true });
