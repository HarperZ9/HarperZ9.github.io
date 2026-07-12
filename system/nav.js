// nav.js, one source of truth for the site navigation. Injected into #site-nav on every page;
// active state derived from the path. No framework; <noscript> fallback lives in the page markup.
const PRIMARY = [
  ["Engines", "overview.html", "flagships"],
  ["Demos", "demo-index.html", "demos"],
  ["Research", "research.html", "research"],
  ["Security", "security.html", "security"],
  ["Work with me", "test-run-request.html", "work"],
  ["GitHub ↗", "https://github.com/HarperZ9", "github", true],
];

export const MORE = [
  ["The Tour", "tour.html", "demos"],
  ["The Studio", "studio.html", "studio"],
  ["Guide", "guide.html", "guide"],
  ["Catalog", "catalog.html", "catalog"],
  ["Typeface", "typeface.html", "typeface"],
  ["Publications", "publications.html", "publications"],
  ["Writing", "writing.html", "writing"],
  ["About", "cv.html", "about"],
];

// Map any page to one of the sections. Flagship pages live under Flagships; everything
// heavier-than-a-brick down to the utilities lives under the catalog.
const FLAGSHIPS = new Set(["overview","index-graph","forum","gather","crucible","learn","flywheel"]);
const DEMOS = new Set(["demo-index","demo-emet","proof-index-sample","proof-surface-sample",
  "public-surface-sweeper-sample","emet-sample","demonstrations","tour"]);
const CATALOG = new Set(["catalog","emet","proof-surface","coherence-membrane","accountable-machines",
  "accountable-engine","buildlang","raw","build-color","build-products","toolkit",
  "provenance-sensorium","orca","aleph","warden","presentation","atelier","gallery",
  "quanta-color","quanta-products","quantalang"]);
CATALOG.add("field-guide");
const RESEARCH = new Set(["research","why"]);
const WRITING = new Set(["writing","the-summary-is-not-the-record"]);
const WORK = new Set(["test-run-request","resume","cover-letter"]);
const ABOUT = new Set(["cv","person"]);
const TYPEFACE = new Set(["typeface"]);

export function navActive(pathname) {
  let f = (pathname || "").split("/").pop() || "index.html";
  if (f === "") f = "index.html";
  const stem = f.replace(/\.html$/, "") || "index";
  if (stem === "index") return "home";
  if (stem === "studio") return "studio";
  if (stem === "guide") return "guide";
  if (stem === "publications") return "publications";
  if (stem === "security") return "security";
  if (FLAGSHIPS.has(stem)) return "flagships";
  if (DEMOS.has(stem)) return "demos";
  if (CATALOG.has(stem)) return "catalog";
  if (TYPEFACE.has(stem)) return "typeface";
  if (WRITING.has(stem)) return "writing";
  if (WORK.has(stem)) return "work";
  if (stem.startsWith("research-")) return "research";
  if (RESEARCH.has(stem)) return "research";
  if (ABOUT.has(stem)) return "about";
  return "";
}

function navLink([label, href, key, external], active) {
  const current = key === active;
  return `<a class="${current ? 'is-active' : ''}" href="${href}"${current ? ' aria-current="page"' : ''}${external ? ' rel="noopener"' : ''}>${label}</a>`;
}

function menuGroup(label, items, active, className) {
  return `<div class="sn-menu-group ${className}">`
    + `<p class="sn-menu-label">${label}</p>`
    + items.map((item) => navLink(item, active)).join("")
    + `</div>`;
}

// Arrow-key travel inside an open menu list: Down/Up cycle, Home/End jump.
// Shared by the static-page menu and the home menu (same list-of-links shape).
export function wireMenuArrowKeys(details, listSelector, opts) {
  details.addEventListener("keydown", (event) => {
    if (!details.open) return;
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const links = [...details.querySelectorAll(`${listSelector} a`)];
    if (!links.length) return;
    event.preventDefault();
    const i = links.indexOf(details.ownerDocument.activeElement);
    const next = event.key === "Home" ? 0
      : event.key === "End" ? links.length - 1
      : event.key === "ArrowDown" ? (i + 1) % links.length
      : (i - 1 + links.length) % links.length;
    links[next].focus();
  }, opts);
}

// Guaranteed anchor arrival. Smooth scrolling rides the compositor; when the
// page cannot produce frames (occluded window, saturated main thread on a
// slow machine), a smooth fragment navigation moves ZERO pixels while the
// hash still changes - the nav feels dead. This handler prefers smooth but
// force-lands instantly if nothing moved shortly after the click.
export function wireAnchorArrival(doc = document) {
  if (doc.__anchorArrivalWired) return;
  doc.__anchorArrivalWired = true;
  doc.addEventListener("click", (event) => {
    const anchor = event.target && event.target.closest && event.target.closest('a[href^="#"]');
    if (!anchor || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const id = decodeURIComponent(anchor.getAttribute("href").slice(1));
    if (!id) return;
    const target = doc.getElementById(id);
    if (!target) return;
    event.preventDefault();
    if (typeof history !== "undefined" && history.pushState) {
      history.pushState(null, "", "#" + id);
    }
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    if (!reduce) {
      const before = window.scrollY;
      window.setTimeout(() => {
        if (Math.abs(window.scrollY - before) < 4) target.scrollIntoView({ behavior: "auto", block: "start" });
      }, 320);
    }
  });
}

function enhanceMenu(doc, mount) {
  const details = mount.querySelector(".sn-more");
  const summary = details && details.querySelector("summary");
  if (!details || !summary || details.dataset.enhanced === "true") return;

  details.dataset.enhanced = "true";
  summary.setAttribute("aria-expanded", String(details.open));

  if (mount.__snMenuAbort) mount.__snMenuAbort.abort();
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const opts = controller ? { signal: controller.signal } : undefined;
  if (controller) mount.__snMenuAbort = controller;

  const close = (returnFocus = false) => {
    if (!details.open) return;
    details.open = false;
    summary.setAttribute("aria-expanded", "false");
    if (returnFocus && typeof summary.focus === "function") summary.focus();
  };

  details.addEventListener("toggle", () => {
    summary.setAttribute("aria-expanded", String(details.open));
  }, opts);

  details.querySelectorAll(".sn-more-list a").forEach((link) => {
    link.addEventListener("click", () => close(false), opts);
  });
  wireMenuArrowKeys(details, ".sn-more-list", opts);

  if (typeof doc.addEventListener === "function") {
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
}

export function renderNav(doc = document) {
  const mount = doc.getElementById("site-nav");
  if (!mount) return;
  const active = navActive(doc.location ? doc.location.pathname : location.pathname);
  const moreActive = MORE.some(([, , key]) => key === active);
  mount.innerHTML =
    `<a class="sn-home" href="index.html" aria-label="Home, Project Telos"><span class="sn-home-field"><canvas class="sn-logo-canvas" aria-hidden="true"></canvas><img class="sn-logo-fallback" src="favicon.svg" alt="" width="30" height="30" style="display:none"></span><span>TELOS</span></a>`
    + `<nav class="sn-links" aria-label="Primary">`
    + PRIMARY.map((item) => navLink(item, active)).join("")
    + `<details class="sn-more"${moreActive ? ' data-current="true"' : ''}>`
    + `<summary${moreActive ? ' aria-current="page"' : ''}>Menu</summary>`
    + `<div class="sn-more-list" aria-label="Site menu">`
    + menuGroup("Primary", PRIMARY, active, "sn-menu-primary")
    + menuGroup("More pages", MORE, active, "sn-menu-secondary")
    + `</div></details>`
    + `</nav>`;
  enhanceMenu(doc, mount);
  mountHomeLogo(doc);
}

// Mount the shared WebGL brand field into the nav home mark, so the static pages carry
// the same live, layered logo as the React home. Falls back to the static SVG mark if
// WebGL is unavailable or the module fails to load.
let __logoHandle = null;
function mountHomeLogo(doc) {
  // Progressive enhancement only: no-op where there is no live DOM (tests, SSR).
  if (!doc || typeof doc.querySelector !== "function") return;
  const canvas = doc.querySelector(".sn-logo-canvas");
  if (!canvas) return;
  if (__logoHandle) { __logoHandle.destroy(); __logoHandle = null; }
  const showFallback = () => {
    const fb = doc.querySelector(".sn-logo-fallback");
    if (fb) fb.style.display = "block";
    canvas.style.display = "none";
  };
  import("./logo-field.js")
    .then((mod) => {
      if (!mod.isLogoFieldAvailable()) { showFallback(); return; }
      const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      __logoHandle = mod.mountLogoField(canvas, { seed: 58, reduced });
    })
    .catch(() => showFallback());
}

if (typeof document !== "undefined") {
  const boot = () => {
    renderNav();
    wireAnchorArrival(document);
    import("./generative-field.js").catch(() => {});
    import("./cursor-field.js").then((m) => m.mountCursorField()).catch(() => {});
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
