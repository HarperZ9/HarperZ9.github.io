// nav.js, one source of truth for the site navigation. Injected into #site-nav on every page;
// active state derived from the path. No framework; <noscript> fallback lives in the page markup.
const DEST = [
  ["Atlas", "index.html", "home"],
  ["The Studio", "studio.html", "studio"],
  ["Flagships", "overview.html", "work"],
  ["Research", "research.html", "research"],
  ["About", "cv.html", "about"],
];

// Map any page to one of the five sections.
const WORK = new Set(["overview","index-graph","forum","emet","proof-surface","coherence-membrane","accountable-machines",
  "accountable-engine","quantalang","raw","quanta-color","quanta-products","toolkit",
  "provenance-sensorium","orca","aleph","warden","presentation"]);
const STUDIO = new Set(["studio","atelier","gallery","demonstrations"]);
const RESEARCH = new Set(["research","writing","why"]);
const ABOUT = new Set(["cv","resume","person"]);

export function navActive(pathname) {
  let f = (pathname || "").split("/").pop() || "index.html";
  if (f === "" ) f = "index.html";
  const stem = f.replace(/\.html$/, "") || "index";
  if (stem === "index" || stem === "") return "home";
  if (STUDIO.has(stem)) return "studio";
  if (RESEARCH.has(stem)) return "research";
  if (ABOUT.has(stem)) return "about";
  if (WORK.has(stem)) return "work";
  return "";
}

export function renderNav(doc = document) {
  const mount = doc.getElementById("site-nav");
  if (!mount) return;
  const active = navActive(doc.location ? doc.location.pathname : location.pathname);
  mount.innerHTML =
    `<a class="sn-home" href="index.html" aria-label="Home, Zain Dana Harper">Zain Dana Harper</a>`
    + `<nav class="sn-links" aria-label="Primary">`
    + DEST.map(([label, href, key]) =>
        `<a href="${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`).join("")
    + `</nav>`;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => renderNav());
  else renderNav();
}
