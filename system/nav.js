// nav.js, one source of truth for the site navigation. Injected into #site-nav on every page;
// active state derived from the path. No framework; <noscript> fallback lives in the page markup.
const PRIMARY = [
  ["Engines", "overview.html", "flagships"],
  ["Demos", "demo-index.html", "demos"],
  ["Research", "research.html", "research"],
  ["Work with me", "test-run-request.html", "work"],
  ["GitHub ↗", "https://github.com/HarperZ9", "github", true],
];

const MORE = [
  ["Guide", "guide.html", "guide"],
  ["Catalog", "catalog.html", "catalog"],
  ["Typeface", "typeface.html", "typeface"],
  ["Publications", "publications.html", "publications"],
  ["Writing", "writing.html", "writing"],
  ["About", "cv.html", "about"],
];

// Map any page to one of the sections. Flagship pages live under Flagships; everything
// heavier-than-a-brick down to the utilities lives under the catalog.
const FLAGSHIPS = new Set(["overview","index-graph","forum","studio","gather","crucible","learn"]);
const DEMOS = new Set(["demo-index","demo-emet","proof-index-sample","proof-surface-sample",
  "public-surface-sweeper-sample","emet-sample","demonstrations"]);
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
  if (stem === "guide") return "guide";
  if (stem === "publications") return "publications";
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

export function renderNav(doc = document) {
  const mount = doc.getElementById("site-nav");
  if (!mount) return;
  const active = navActive(doc.location ? doc.location.pathname : location.pathname);
  const moreActive = MORE.some(([, , key]) => key === active);
  mount.innerHTML =
    `<a class="sn-home" href="index.html" aria-label="Home, Project Telos"><span aria-hidden="true">◐</span><span>TELOS</span></a>`
    + `<nav class="sn-links" aria-label="Primary">`
    + PRIMARY.map((item) => navLink(item, active)).join("")
    + `<details class="sn-more"${moreActive ? ' data-current="true"' : ''}>`
    + `<summary${moreActive ? ' aria-current="page"' : ''}>More</summary>`
    + `<div class="sn-more-list">`
    + MORE.map((item) => navLink(item, active)).join("")
    + `</div></details>`
    + `</nav>`;
}

if (typeof document !== "undefined") {
  const boot = () => {
    renderNav();
    import("./generative-field.js").catch(() => {});
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
