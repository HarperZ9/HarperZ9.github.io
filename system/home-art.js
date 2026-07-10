import { mountGenerativeField } from "./generative-field.js";
import { MORE, wireAnchorArrival, wireMenuArrowKeys } from "./nav.js";

// The home app (built from home/) renders its final copy natively, so this
// module no longer rewrites hero text. It adds the two enhancements the
// bundle does not own: the shared-site menu (from the same source of truth
// as the static-page nav) and the ambient generative field.

function wireDetailsMenu(doc, details, summary, listSelector, abortKey) {
  if (!details || !summary || details.dataset.enhanced === "true") return;

  details.dataset.enhanced = "true";
  summary.setAttribute("aria-expanded", String(details.open));

  if (doc[abortKey]) doc[abortKey].abort();
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const opts = controller ? { signal: controller.signal } : undefined;
  if (controller) doc[abortKey] = controller;

  const close = (returnFocus = false) => {
    if (!details.open) return;
    details.open = false;
    summary.setAttribute("aria-expanded", "false");
    if (returnFocus && typeof summary.focus === "function") summary.focus();
  };

  details.addEventListener("toggle", () => {
    summary.setAttribute("aria-expanded", String(details.open));
  }, opts);

  details.querySelectorAll(`${listSelector} a`).forEach((link) => {
    link.addEventListener("click", () => close(false), opts);
  });

  doc.addEventListener("click", (event) => {
    if (details.open && !details.contains(event.target)) close(false);
  }, opts);
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  }, opts);
}

function upgradeHomeMenu(doc) {
  const nav = doc.querySelector(".topnav");
  if (!nav || nav.querySelector(".home-menu")) return false;

  const sourceLinks = [...nav.querySelectorAll(".topnav-links a")];
  if (!sourceLinks.length) return false;

  const details = doc.createElement("details");
  details.className = "home-menu";

  const summary = doc.createElement("summary");
  summary.textContent = "Menu";
  summary.setAttribute("aria-label", "Open site menu");
  details.appendChild(summary);

  const list = doc.createElement("div");
  list.className = "home-menu-list";
  list.setAttribute("aria-label", "Site sections");
  sourceLinks.forEach((link) => {
    const clone = link.cloneNode(true);
    clone.removeAttribute("class");
    list.appendChild(clone);
  });
  // The rest of the site taxonomy, from the same source of truth as the
  // static-page nav, so home and static menus agree on what exists.
  const moreLabel = doc.createElement("p");
  moreLabel.className = "home-menu-label";
  moreLabel.textContent = "More pages";
  list.appendChild(moreLabel);
  MORE.forEach(([label, href]) => {
    const link = doc.createElement("a");
    link.href = href;
    link.textContent = label;
    list.appendChild(link);
  });
  details.appendChild(list);
  nav.appendChild(details);

  wireDetailsMenu(doc, details, summary, ".home-menu-list", "__homeMenuAbort");
  wireMenuArrowKeys(details, ".home-menu-list");
  return true;
}

function normalizeHomeFormFields(doc) {
  doc.querySelectorAll("input, select, textarea").forEach((field, index) => {
    if (field.dataset.homeFieldNormalized === "true") return;
    const base = `home-field-${index + 1}`;
    const label = field.closest("label");
    const labelText = label ? label.textContent.trim().replace(/\s+/g, " ") : "";
    const fallback = field.getAttribute("aria-label") || field.getAttribute("placeholder") || labelText || base;
    if (!field.id) field.id = base;
    if (!field.name) field.name = base;
    if (!field.getAttribute("aria-label")) field.setAttribute("aria-label", fallback.slice(0, 96));
    field.dataset.homeFieldNormalized = "true";
  });
}

// React commits on its own schedule; retry the enhancements briefly until the
// nav exists, then stop. No MutationObserver, no copy rewriting.
function enhanceWhenReady(doc) {
  let tries = 0;
  const tick = () => {
    const menuDone = upgradeHomeMenu(doc);
    normalizeHomeFormFields(doc);
    tries += 1;
    if (!menuDone && tries < 40) window.setTimeout(tick, 75);
  };
  tick();
}

function bootHomeArt() {
  if (!document.body) return;
  document.body.classList.add("home-generative-field");
  document.documentElement.classList.add("home-generative-field-ready");
  wireAnchorArrival(document);
  enhanceWhenReady(document);
  mountGenerativeField(document).catch(() => {
    document.documentElement.classList.add("generative-field-failed");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootHomeArt, { once: true });
} else {
  bootHomeArt();
}
