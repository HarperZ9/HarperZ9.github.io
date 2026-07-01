// nav.js, one source of truth for the site navigation. Injected into #site-nav on every page;
// active state derived from the path. No framework; <noscript> fallback lives in the page markup.
const DEST = [
  ["Home", "index.html", "home"],
  ["Guide", "guide.html", "guide"],
  ["Flagships", "overview.html", "flagships"],
  ["Catalog", "catalog.html", "catalog"],
  ["Research", "research.html", "research"],
  ["Writing", "writing.html", "writing"],
  ["About", "cv.html", "about"],
];

// Map any page to one of the sections. Flagship pages live under Flagships; everything
// heavier-than-a-brick down to the utilities lives under the catalog.
const FLAGSHIPS = new Set(["overview","index-graph","forum","studio","gather","crucible"]);
const CATALOG = new Set(["catalog","emet","proof-surface","coherence-membrane","accountable-machines",
  "accountable-engine","buildlang","raw","build-color","build-products","toolkit",
  "provenance-sensorium","orca","aleph","warden","presentation","atelier","gallery","demonstrations"]);
CATALOG.add("field-guide");
const RESEARCH = new Set(["research","why"]);
const WRITING = new Set(["writing"]);
const ABOUT = new Set(["cv","resume","person"]);

export function navActive(pathname) {
  let f = (pathname || "").split("/").pop() || "index.html";
  if (f === "") f = "index.html";
  const stem = f.replace(/\.html$/, "") || "index";
  if (stem === "index") return "home";
  if (stem === "guide") return "guide";
  if (FLAGSHIPS.has(stem)) return "flagships";
  if (CATALOG.has(stem)) return "catalog";
  if (WRITING.has(stem)) return "writing";
  if (RESEARCH.has(stem)) return "research";
  if (ABOUT.has(stem)) return "about";
  return "";
}

export function renderNav(doc = document) {
  const mount = doc.getElementById("site-nav");
  if (!mount) return;
  const active = navActive(doc.location ? doc.location.pathname : location.pathname);
  mount.innerHTML =
    `<a class="sn-home" href="index.html" aria-label="Home, Project Telos">Project Telos</a>`
    + `<nav class="sn-links" aria-label="Primary">`
    + DEST.map(([label, href, key]) =>
        `<a href="${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`).join("")
    + `</nav>`;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => renderNav());
  else renderNav();
}
