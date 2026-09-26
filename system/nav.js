// nav.js, one source of truth for the site navigation. Injected into #site-nav on every page;
// active state derived from the path. No framework; <noscript> fallback lives in the page markup.
import { EXTERNAL_ACTIONS, PRIMARY_ROUTES, SECONDARY_GROUPS, routeFamily } from "./routes.js?v=20260909-pillar-navigation";

const BRAND_LABEL = "Zentropy Labs";
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

function localRoute(value, includeHash = false) {
  try {
    const url = new URL(value, "https://harperz9.github.io/");
    let pathname = url.pathname.replace(/^\//, "");
    if (!pathname || pathname.endsWith("/")) {
      pathname += "index.html";
    } else {
      const leaf = pathname.split("/").pop() || "";
      if (leaf && !leaf.includes(".")) pathname += ".html";
    }
    return pathname + url.search + (includeHash ? url.hash : "");
  } catch {
    return "";
  }
}

export function navActive(pathname) {
  return routeFamily(localRoute(pathname, true));
}

function localHrefForPage(value, locationPath) {
  const page = localRoute(locationPath).split("?")[0];
  return page.includes("/") ? `/${value}` : value;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function locationPath(doc) {
  const loc = (doc && doc.location) || (typeof location !== "undefined" ? location : null);
  if (!loc) return "/";
  return (loc.pathname || "/") + (loc.search || "") + (loc.hash || "");
}

function isHomeDocument(doc) {
  if (!doc || !doc.documentElement) return false;
  if (doc.documentElement.dataset && doc.documentElement.dataset.homeShell === "react") return true;
  const path = localRoute(locationPath(doc)).split("?")[0].split("#")[0];
  return path === "" || path === "index.html";
}

function allLocalRoutes() {
  return [
    ...PRIMARY_ROUTES,
    ...SECONDARY_GROUPS.flatMap((group) => group.routes),
  ];
}

function currentRouteRecord(doc) {
  const current = localRoute(locationPath(doc), true);
  const currentBase = current.split("#")[0].split("?")[0];
  const routes = allLocalRoutes();
  return routes.find((route) => localRoute(route.href, true) === current)
    || routes.find((route) => localRoute(route.href, true).split("#")[0].split("?")[0] === currentBase)
    || null;
}

function firstElement(container, selectors) {
  if (!container || typeof container.querySelector !== "function") return null;
  for (const selector of selectors) {
    const found = container.querySelector(selector);
    if (found) return found;
  }
  return null;
}

function routeHeaderTarget(doc) {
  const frame = doc.querySelector(".frame");
  const h1 = (frame && frame.querySelector("h1")) || doc.querySelector("h1");
  if (!h1) return null;
  const container = h1.closest(".frame,.hire-mast,.mast,header,article");
  if (container) return { container, h1 };
  const parent = h1.parentElement;
  if (!parent) return null;
  if ((parent.tagName || "").toLowerCase() !== "main") return { container: parent, h1 };
  const compact = doc.createElement("header");
  parent.insertBefore(compact, h1);
  compact.appendChild(h1);
  const adjacent = compact.nextElementSibling;
  if (adjacent && [".lede", ".lead", ".opening", ".role"].some((selector) => adjacent.matches(selector))) {
    compact.appendChild(adjacent);
  }
  return { container: compact, h1 };
}

function buildRoutePath(doc, family, route) {
  const path = doc.createElement("nav");
  path.className = "route-header__path";
  path.setAttribute("aria-label", "Breadcrumb");

  const home = doc.createElement("a");
  home.href = localHrefForPage("index.html", locationPath(doc));
  home.textContent = "Zain Dana Harper";
  path.appendChild(home);

  const category = doc.createElement("span");
  const categoryLabel = family || "Public work";
  category.textContent = categoryLabel;
  const exactNavigation = [...PRIMARY_ROUTES, { href: "site-index.html" }].some(
    route => localRoute(route.href, true) === localRoute(locationPath(doc), true));
  path.appendChild(category);
  const routeLabel = route && route.label && route.label !== categoryLabel ? route.label : "";
  if (!exactNavigation && route) {
    const current = routeLabel ? doc.createElement("span") : category;
    if (routeLabel) {
      current.textContent = routeLabel;
      path.appendChild(current);
    }
    current.setAttribute("aria-current", "page");
  }
  return path;
}

export function buildRouteHeader(doc = document) {
  if (!doc || !doc.body || isHomeDocument(doc)) return null;
  // A page that carries its own masthead or breadcrumb already shows its path.
  // One path per page, so the route header stays out of its way.
  if (doc.querySelector(".masthead, .masthead-path")) return null;
  const existing = doc.querySelector("[data-route-header='mounted']");
  if (existing) return existing;
  const target = routeHeaderTarget(doc);
  if (!target) return null;

  const { container, h1 } = target;
  const route = currentRouteRecord(doc);
  const family = (route && (route.breadcrumbLabel || route.family)) || navActive(locationPath(doc));
  const copyParent = h1.parentElement || container;
  const summary = firstElement(copyParent, [".lede", ".lead", ".opening", ".role"])
    || firstElement(container, [".lede", ".lead", ".opening", ".role"]);

  container.classList.add("route-header");
  container.dataset.routeHeader = "mounted";
  h1.classList.add("route-header__title");
  if (summary) summary.classList.add("route-header__summary");
  if (!copyParent.querySelector(".route-header__path")) {
    copyParent.insertBefore(buildRoutePath(doc, family, route), h1);
  }
  return container;
}

function mountRouteHeader(doc = document) {
  buildRouteHeader(doc);
}

function navLink({ label, href, family, external = false, lightsFamily = true }, active, locationPath, retainSectionState = false, allowExact = true) {
  const exact = allowExact && !external && localRoute(href, true) === localRoute(locationPath, true);
  // A pillar lights for its whole family only when it heads that family. Flywheel
  // sits in the Systems family without heading it, so it lights on its own page.
  const sectionActive = retainSectionState && lightsFamily !== false && family === active;
  const className = exact || sectionActive ? "is-active" : "";
  const renderedHref = external ? href : localHrefForPage(href, locationPath);
  // Hanken Grotesk has no arrow glyph, so an external link's arrow is drawn.
  const text = external ? String(label).replace(/\s*↗\s*$/, "") : label;
  const arrow = external ? '<svg class="sn-ext" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false"><path d="M2 8 8 2M3.5 2H8v4.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>' : "";
  return `<a class="${className}" href="${escapeHtml(renderedHref)}"${exact ? ' aria-current="page"' : ''}${external ? ' rel="noopener"' : ''}>${escapeHtml(text)}${arrow}</a>`;
}

function menuGroup(label, items, active, locationPath, className) {
  return `<div class="sn-menu-group ${className}">`
    + `<p class="sn-menu-label">${escapeHtml(label)}</p>`
    + items.map((item) => navLink(
      item,
      active,
      locationPath,
      className === "sn-menu-primary",
      className !== "sn-menu-primary",
    )).join("")
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
      if (event.key === "Escape" && details.open) {
        event.preventDefault();
        close(true);
      }
    }, opts);
  }
}

// The bar is sticky, so anything that pins itself under it (an instrument's
// preview, a section's scroll margin) needs its measured height. Published as
// one custom property on the root and kept live by a ResizeObserver: the bar
// wraps to two rows on a narrow screen and grows again when a font lands late.
export function trackNavHeight(doc = document) {
  const nav = doc && typeof doc.getElementById === "function" ? doc.getElementById("site-nav") : null;
  if (!nav || !doc.documentElement || typeof nav.getBoundingClientRect !== "function") return;
  const publish = () => {
    const h = Math.round(nav.getBoundingClientRect().height);
    doc.documentElement.style.setProperty("--nav-h", h + "px");
  };
  publish();
  if (typeof ResizeObserver === "function") new ResizeObserver(publish).observe(nav);
  else if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", publish, { passive: true });
}

export function renderNav(doc = document) {
  const mount = doc.getElementById("site-nav");
  if (!mount) return;
  const routePath = locationPath(doc);
  const active = navActive(routePath);
  const moreActive = SECONDARY_GROUPS.some((group) => group.routes.some((route) => route.family === active));
  const homeHref = localHrefForPage("index.html", routePath);
  const brandMarkSrc = localHrefForPage(BRAND_MARK_SRC, routePath);
  mount.innerHTML =
    `<a class="sn-home" href="${homeHref}" aria-label="Zain Dana Harper and ${BRAND_LABEL} home"><span class="sn-home-field"><canvas class="sn-logo-canvas" aria-hidden="true"></canvas><img class="sn-logo-fallback" src="${brandMarkSrc}" alt="" width="30" height="30" style="display:none"></span><span class="sn-brand-word">${BRAND_LABEL}</span></a>`
    + `<nav class="sn-links" aria-label="Primary">`
    + PRIMARY_ROUTES.map((item) => navLink(item, active, routePath, true)).join("")
    + EXTERNAL_ACTIONS.map((item) => navLink(item, active, routePath)).join("")
    + `</nav>`
    + `<details class="sn-more"${moreActive ? ' data-current="true"' : ''}>`
    + `<summary>Menu</summary>`
    + `<div class="sn-more-list" aria-label="Site menu">`
    + menuGroup("Primary", PRIMARY_ROUTES, active, routePath, "sn-menu-primary")
    + menuGroup("Explore", [{ label: "Site index", href: "site-index.html", family: "Systems" }], active, routePath, "sn-menu-secondary")
    + menuGroup("Actions", EXTERNAL_ACTIONS, active, routePath, "sn-menu-secondary")
    + `</div></details>`
    ;
  enhanceMenu(doc, mount);
  mountHomeLogo(doc);
}

// The header mark is the static aperture on every device. At 34px the WebGL brand field read as
// pixel noise on desktops while phones showed the aperture, so one site showed two marks.
// 2026-09-25 human-first notebook: the live field stays for surfaces with room to read as an
// aperture; the header shows the same static mark phones and the favicon use.
function mountHomeLogo(doc) {
  // Progressive enhancement only: no-op where there is no live DOM (tests, SSR).
  if (!doc || typeof doc.querySelector !== "function") return;
  const canvas = doc.querySelector(".sn-logo-canvas");
  if (!canvas) return;
  const fb = doc.querySelector(".sn-logo-fallback");
  if (fb) fb.style.display = "block";
  canvas.style.display = "none";
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
const ASSET_V = "20260909-pillar-navigation";

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
  // The notebook sheet and its reader components (masthead, tables, "How we
  // know"). A page that links it in its head keeps its own link and order.
  if (!doc.querySelector('link[href*="notebook-sheet.css"]')) addSheet(doc, "notebook-sheet.css", "notebook-style", "last");
  // The site's surface (void and bone grounds, registration field, grain, crop marks,
  // poster type). It comes after the page's own sheets so it refines them.
  if (!doc.querySelector('link[href*="plate.css"]')) addSheet(doc, "plate.css", "plate-style", "last");
  // print.css and export.css go last because they have to beat screen rules
  // that sit further down the page's own cascade. A media query adds no
  // specificity, so a print rule loaded early loses to a plain screen rule
  // loaded late, and the page prints black-on-black.
  addSheet(doc, "export.css", "export-style", "last");
  addSheet(doc, "print.css", "print-style", "last");
}

// Print shows every "How we know" body. Each closed disclosure opens for the
// print and closes again after it, so the reader's page stays as they left it.
export function wirePrintDisclosures(win = typeof window !== "undefined" ? window : undefined, doc = typeof document !== "undefined" ? document : undefined) {
  if (!win || !doc || typeof win.addEventListener !== "function" || win.__printDisclosuresWired) return;
  win.__printDisclosuresWired = true;
  let opened = [];
  win.addEventListener("beforeprint", () => {
    opened = [...doc.querySelectorAll("details:not([open])")];
    for (const details of opened) details.open = true;
  });
  win.addEventListener("afterprint", () => {
    for (const details of opened) details.open = false;
    opened = [];
  });
}

// A table wrapper is a keyboard scroll region only while its table overflows. When a table
// stacks into records or fits its column, the wrapper leaves the tab order, so a phone reader
// does not tab through a region taller than the screen that never scrolls.
export function syncScrollRegion(wrap) {
  if (!wrap) return;
  if (!wrap.hasAttribute("data-scroll-region")) {
    if (wrap.getAttribute("tabindex") !== "0") return;
    wrap.setAttribute("data-scroll-region", wrap.getAttribute("role") || "");
  }
  const scrolls = wrap.scrollWidth > wrap.clientWidth + 1;
  if (scrolls) {
    wrap.setAttribute("tabindex", "0");
    wrap.setAttribute("role", wrap.getAttribute("data-scroll-region") || "region");
  } else {
    wrap.removeAttribute("tabindex");
    wrap.removeAttribute("role");
  }
}

export function wireScrollRegions(doc = document, win = typeof window !== "undefined" ? window : undefined) {
  if (!doc || typeof doc.querySelectorAll !== "function") return 0;
  const wraps = [...doc.querySelectorAll(".table-wrap[tabindex=\"0\"]")];
  const sync = () => wraps.forEach(syncScrollRegion);
  sync();
  if (win && typeof win.ResizeObserver === "function") {
    const observer = new win.ResizeObserver(sync);
    wraps.forEach((wrap) => observer.observe(wrap));
  } else if (win && typeof win.addEventListener === "function") {
    win.addEventListener("resize", sync);
  }
  return wraps.length;
}

// A copy button copies the command or digest it sits beside: the element named
// by data-copy-target, or else the code element in the same block.
export function wireCopyButtons(doc = document) {
  if (!doc || typeof doc.addEventListener !== "function" || doc.__copyButtonsWired) return;
  doc.__copyButtonsWired = true;
  doc.addEventListener("click", (event) => {
    const button = event.target && event.target.closest && event.target.closest("button.copy-button");
    if (!button) return;
    const selector = button.getAttribute("data-copy-target");
    const target = selector ? doc.querySelector(selector) : button.parentElement && button.parentElement.querySelector("code");
    const text = target ? target.textContent.trim() : "";
    if (!text || !navigator.clipboard) return;
    const label = button.textContent;
    navigator.clipboard.writeText(text).then(() => {
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = label; }, 2000);
    }).catch(() => {});
  });
}

if (typeof document !== "undefined") {
  const boot = () => {
    ensureNavStylesheet(document);
    renderNav();
    import("./theme-entry.js?v=20260907-theme-preferences").catch(() => {});
    trackNavHeight(document);
    wireAnchorArrival(document);
    wirePrintDisclosures(window, document);
    wireCopyButtons(document);
    wireScrollRegions(document, window);
    mountRouteHeader(document);
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
