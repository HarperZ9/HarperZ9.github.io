// nav.js, one source of truth for the site navigation. Injected into #site-nav on every page;
// active state derived from the path. No framework; <noscript> fallback lives in the page markup.
const PRIMARY = [
  ["The Studio", "studio.html", "studio"],
  ["Gallery", "gallery.html", "gallery"],
  ["Retro Engine", "retro.html", "retro"],
  ["Engines", "overview.html", "flagships"],
  ["Research", "research.html", "research"],
  ["Work with me", "test-run-request.html", "work"],
  ["GitHub ↗", "https://github.com/HarperZ9", "github", true],
];

// Platforms: standalone products and practices, each with its own complete page and
// identity, held apart from the fourteen engines. Phantom is public and shipped; the
// offensive-security line is private and shared only under lawful authorization.
export const PLATFORMS = [
  ["Phantom", "phantom.html", "phantom"],
  ["behavior-transform.io", "behavior-transform.html", "behavior-transform"],
  ["Authorized offensive security", "security.html", "security"],
];

export const MORE = [
  ["The Tour", "tour.html", "demos"],
  ["Demos", "demonstrations.html", "demos"],
  ["Poster", "studio.html?source=poster", "studio"],
  ["The Loom", "loom.html", "loom"],
  // The archive is one of the Studio's materials, not only a page of pictures. The Studio,
  // Gallery, and Retro Engine now lead the primary nav; the archive stays one click away.
  ["Session archive", "session-archive.html", "archive"],
  ["Guide", "guide.html", "guide"],
  ["Catalog", "catalog.html", "catalog"],
  ["Typeface", "typeface.html", "typeface"],
  ["Publications", "publications.html", "publications"],
  ["Writing", "writing.html", "writing"],
  ["Dossier", "dossier.html", "dossier"],
  ["Resume and CV", "resume.html", "work"],
  ["Portfolio", "portfolio.html", "work"],
  ["About", "cv.html", "about"],
];

export const RECORDED_DEMOS = [
  ["All recorded workflows", "demonstrations.html", "demos"],
  ["Index · workspace atlas", "demo-index.html", "demo-route"],
  ["Gather · research intake", "demo-gather.html", "demo-route"],
  ["Forum · orchestration", "demo-forum.html", "demo-route"],
  ["Crucible · measured refinement", "demo-crucible.html", "demo-route"],
];

const BRAND_LABEL = "zentropyLabs";
const BRAND_MARK_SRC = "brand/zentropy-avatar.png";

const DESKTOP_GPU_ART_QUERIES = [
  "(prefers-reduced-motion: reduce)",
  "(pointer: fine)",
  "(min-width: 900px)",
];

function shouldUseDesktopGpuArt(win = typeof window !== "undefined" ? window : undefined) {
  if (!win || typeof win.matchMedia !== "function") return false;
  const [reducedMotion, finePointer, desktopWidth] = DESKTOP_GPU_ART_QUERIES.map((query) => win.matchMedia(query));
  return !reducedMotion.matches && finePointer.matches && desktopWidth.matches;
}

function shouldMountAmbientField(doc = document) {
  if (!shouldUseDesktopGpuArt(window)) return false;
  const body = doc && doc.body;
  if (!body) return false;
  // The Studio is its own live instrument: a full-page ambient field animating
  // behind it competes with the renderer for the same main thread (profiled at
  // roughly a tenth of the frame budget) and buys nothing, because the canvas
  // is already the subject. Ambient art stays on the reading surfaces.
  if (body.classList.contains("studio-page") || body.classList.contains("studio-app")) return false;
  return body.classList.contains("gallery");
}

// Plates are not the ambient field, and gating them together was a mistake that
// blanked every plate outside the gallery. The ambient field is a full-page
// canvas that animates, so it is fair to hold it back from a slow machine, a
// touch device, or a reader who asked for less motion. A plate is a figure in
// the document: drawn once, static, aria-hidden, and captioned as the subject
// of the paragraph beside it. Withholding it leaves an empty framed box where
// an illustration should be, which is worse on every one of those devices than
// simply drawing it. So plates mount wherever they appear, on their own path.
function mountPlates(doc = document) {
  if (!doc || typeof doc.querySelector !== "function") return;
  if (!doc.querySelector("canvas[data-specimen]")) return;
  import("./generative-field.js")
    .then((mod) => {
      if (typeof mod.mountSpecimens === "function") mod.mountSpecimens(doc);
    })
    .catch(() => {});
}

function normalizeRouteArtSrc(raw, doc) {
  if (!raw) return "";
  const base = doc && doc.location ? doc.location.href : (typeof window !== "undefined" ? window.location.href : "https://harperz9.github.io/");
  try {
    const url = new URL(raw, base);
    const sameRuntimeOrigin = typeof window !== "undefined" && url.origin === window.location.origin;
    if (url.hostname === "harperz9.github.io" || sameRuntimeOrigin) return url.pathname;
    return raw;
  } catch {
    return raw;
  }
}

function getRouteArtMetadata(doc = document) {
  const image = doc.querySelector('meta[property="og:image"],meta[name="twitter:image"]');
  const alt = doc.querySelector('meta[property="og:image:alt"]');
  const src = normalizeRouteArtSrc(image && image.getAttribute("content"), doc);
  if (!src || src.includes("/brand/zentropy-logo.png")) return null;
  return { src, alt: (alt && alt.getAttribute("content")) || "" };
}

function mountRouteArt(doc = document) {
  if (!doc || !doc.body || doc.documentElement.dataset.homeShell === "react") return;
  if (doc.querySelector("[data-route-art='mounted']")) return;
  // A page that carries its own opening figure opts out, so a reader does not
  // scroll past two banner images stacked on each other before the first
  // sentence. The og:image stays set either way, because that one is for the
  // link preview and has nothing to do with the page body.
  if (doc.body.dataset.routeArt === "off") return;
  const main = doc.getElementById("main");
  if (!main) return;
  const art = getRouteArtMetadata(doc);
  if (!art) return;

  const figure = doc.createElement("figure");
  figure.className = "route-art";
  figure.dataset.routeArt = "mounted";
  const img = doc.createElement("img");
  img.src = art.src;
  img.alt = art.alt;
  img.loading = "lazy";
  img.decoding = "async";
  figure.appendChild(img);
  const caption = doc.createElement("figcaption");
  caption.textContent = "zentropyLabs / route artifact";
  figure.appendChild(caption);
  const frame = doc.querySelector(".frame");
  const anchor = frame || main;
  anchor.insertAdjacentElement("beforebegin", figure);
}

// Map any page to one of the sections. Flagship pages live under Flagships; everything
// heavier-than-a-brick down to the utilities lives under the catalog.
const FLAGSHIPS = new Set(["overview","index-graph","forum","gather","crucible","learn","flywheel"]);
const DEMOS = new Set(["demo-index","demo-gather","demo-forum","demo-crucible","demo-emet","proof-index-sample","proof-surface-sample",
  "public-surface-sweeper-sample","emet-sample","demonstrations","tour"]);
const CATALOG = new Set(["catalog","emet","proof-surface","coherence-membrane","accountable-machines",
  "accountable-engine","buildlang","raw","build-color","build-products","toolkit",
  "provenance-sensorium","orca","aleph","warden","presentation","atelier",
  "quanta-color","quanta-products","quantalang"]);
CATALOG.add("field-guide");
const RESEARCH = new Set(["research","why"]);
const WRITING = new Set(["writing","the-summary-is-not-the-record"]);
const WORK = new Set(["test-run-request","resume","cover-letter","portfolio"]);
const ABOUT = new Set(["cv","person"]);
const TYPEFACE = new Set(["typeface"]);

export function navActive(pathname) {
  let f = (pathname || "").split("/").pop() || "index.html";
  if (f === "") f = "index.html";
  const stem = f.replace(/\.html$/, "") || "index";
  if (stem === "index") return "home";
  if (stem === "studio") return "studio";
  if (stem === "gallery") return "gallery";
  if (stem === "retro") return "retro";
  if (stem === "loom") return "loom";
  if (stem === "session-archive") return "archive";
  if (stem === "guide") return "guide";
  if (stem === "publications") return "publications";
  if (stem === "dossier") return "dossier";
  if (stem === "security") return "security";
  if (stem === "phantom") return "phantom";
  if (stem === "behavior-transform") return "behavior-transform";
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
  const moreActive = MORE.some(([, , key]) => key === active) || PLATFORMS.some(([, , key]) => key === active);
  const activeLabel = active ? active.replace(/-/g, " ") : "site";
  mount.innerHTML =
    `<a class="sn-home" href="index.html" aria-label="${BRAND_LABEL} / Project Telos home"><span class="sn-home-field"><canvas class="sn-logo-canvas" aria-hidden="true"></canvas><img class="sn-logo-fallback" src="${BRAND_MARK_SRC}" alt="" width="30" height="30" style="display:none"></span><span class="sn-brand-word">${BRAND_LABEL}</span></a>`
    + `<span class="sn-section" aria-label="Current section">${activeLabel}</span>`
    + `<nav class="sn-links" aria-label="Primary">`
    + PRIMARY.map((item) => navLink(item, active)).join("")
    + `</nav>`
    + `<details class="sn-more"${moreActive ? ' data-current="true"' : ''}>`
    + `<summary${moreActive ? ' aria-current="page"' : ''}>Menu</summary>`
    + `<div class="sn-more-list" aria-label="Site menu">`
    + menuGroup("Primary", PRIMARY, active, "sn-menu-primary")
    + menuGroup("Platforms", PLATFORMS, active, "sn-menu-platforms")
    + menuGroup("Recorded demos", RECORDED_DEMOS, active, "sn-menu-demos")
    + menuGroup("More pages", MORE, active, "sn-menu-secondary")
    + `</div></details>`
    ;
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
  if (!shouldUseDesktopGpuArt(window)) {
    showFallback();
    return;
  }
  import("./logo-field.js")
    .then((mod) => {
      if (!mod.isLogoFieldAvailable()) { showFallback(); return; }
      const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      __logoHandle = mod.mountLogoField(canvas, { seed: 58, reduced });
    })
    .catch(() => showFallback());
}

// nav.js puts the same bar on every page, including pages that carry only
// their own inline styles and never wrote a rule for it. Those rendered the
// bar as browser defaults: underlined #0000EE links at 1.9:1 on a black
// ground. This prepends the shared nav stylesheet to the head, so it sits
// first in the cascade and any page that does style the nav still wins on
// every property it sets.
// One stamp for every asset this module pulls in. The pages cache nav.js by
// its own ?v= in the markup, so a new nav.js is what asks for new versions of
// these; without a stamp here a reader with a warm cache keeps the old
// stylesheet and the old exporter forever. Bump this with the nav.js stamp.
const ASSET_V = "20260813-export2";

function sheetHref(name) {
  const here = import.meta && import.meta.url ? import.meta.url : "";
  const rel = name + "?v=" + ASSET_V;
  return here ? new URL("./" + rel, here).href : "system/" + rel;
}

function addSheet(doc, name, key, where) {
  if (doc.querySelector("link[data-" + key + "]")) return;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = sheetHref(name);
  link.setAttribute("data-" + key, "");
  if (where === "first") doc.head.insertBefore(link, doc.head.firstChild);
  else doc.head.appendChild(link);
}

function ensureNavStylesheet(doc = document) {
  if (!doc || !doc.head) return;
  // nav.css goes first so any page that styles its own nav still wins.
  addSheet(doc, "nav.css", "nav-style", "first");
  // print.css and export.css go last because they have to beat screen rules
  // that sit further down the page's own cascade. A media query adds no
  // specificity, so a print rule loaded early loses to a plain screen rule
  // loaded late, and the page prints black-on-black.
  addSheet(doc, "export.css", "export-style", "last");
  addSheet(doc, "print.css", "print-style", "last");
}

if (typeof document !== "undefined") {
  const boot = () => {
    ensureNavStylesheet(document);
    renderNav();
    wireAnchorArrival(document);
    mountRouteArt(document);
    // The React home owns its own restrained desktop field and its static
    // Zentropy mobile treatment. Static pages retain the shared enhancement.
    if (document.documentElement.dataset.homeShell !== "react" && shouldMountAmbientField(document)) {
      import("./generative-field.js").catch(() => {});
      import("./cursor-field.js").then((m) => m.mountCursorField()).catch(() => {});
    }
    mountPlates(document);
    // Every page offers its own text as Markdown, plain text, Word, or print.
    // The module reads the live page, so a page added later needs nothing.
    import("./export.js?v=" + ASSET_V).catch(() => {});
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
