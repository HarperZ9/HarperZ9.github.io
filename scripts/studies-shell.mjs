// studies-shell.mjs: one page in the world's shell, for the generated reading pages (studies, boards, tools).
// The head carries the discoverability set (title, description, canonical, social tags); the body carries the
// shell's hand (the universe's navigation, with every link root-absolute) and the page's own <main>.
import { esc } from "./studies-markdown.mjs";

export const ORIGIN = "https://harperz9.github.io";
const CARD = `${ORIGIN}/img/og/p/home.jpg`;
const TEXT_FACE = "/world/ui/shell/fonts/hanken-grotesk.woff2";  // the still face; Accession and its families are materials a page adds

const PLACES = [
  ["/world/ui/directions/cs-max/flywheel.html", "light", "Flywheel"],
  ["/articulate.html", "engraved", "Articulate"],
  ["/cmmns.html", "glyphcell", "CMMNS"],
  ["/buildlang.html", "glyphcell", "BuildLang"],
  ["/raw.html", "nightlights", "raw-native"],
  ["/explainers.html", "sound", "Films"],
  ["/publications.html", "swarm", "Writing"],
  ["/studies/", "rope", "Studies"],
  ["/hire.html", "rope", "Work"],
];

function hand() {
  return `<header class="o-hand" aria-label="Site">
  <a class="skip" href="#main">Skip to the page</a>
  <a class="o-home" href="/">Zain Dana Harper</a>
  <a data-o="band" href="/world/universe/proto/index.html" aria-label="The map"></a>
  <button type="button" data-o="fold" aria-controls="o-menu" aria-expanded="false" hidden><span class="o-name">Menu (M)</span><i></i><i></i><i></i></button>
  <button type="button" data-o="lamp" data-theme-toggle aria-pressed="true"><span class="o-name">Lamp</span></button>
  <button type="button" data-o="peel" data-plain-toggle aria-pressed="false"><span class="o-name">Plain view</span></button>
</header>
<dialog id="o-menu" data-o="menu" data-material="chladni" aria-label="Places">
  <nav aria-label="Places">
    <ul class="o-places">
${PLACES.map(([href, tech, name]) => `      <li><a href="${href}"><span class="o-word" data-display-on-open="${tech}">${esc(name)}</span></a></li>`).join("\n")}
    </ul>
  </nav>
  <p class="o-menu-foot"><a href="/floor.html">Plain index</a> <a href="/world/universe/proto/index.html">The map</a> <button type="button" class="o-close" onclick="this.closest('dialog').close()">Close (Esc)</button></p>
</dialog>`;
}

// page({ path, title, description, body, robots, extraHead, jsonld }) -> the whole document
export function page({ path, title, description, body, robots = "", extraHead = "", jsonld = null, css = "/studies/studies.css", htmlAttrs = "", bodyClass = "reading" }) {
  const url = `${ORIGIN}/${path.replace(/index\.html$/, "")}`, full = `${title} | Zain Dana Harper`;
  return `<!doctype html>
<html lang="en" data-type="stock"${htmlAttrs ? " " + htmlAttrs : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
${robots ? `<meta name="robots" content="${esc(robots)}">\n` : ""}<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zain Dana Harper">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${CARD}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(full)}">
<meta name="twitter:description" content="${esc(description)}">
<link rel="preload" href="${TEXT_FACE}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/world/ui/shell/shell.css">
<link rel="stylesheet" href="${css}">
<script type="module" src="/world/ui/shell/shell.js"></script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ""}${extraHead}</head>
<body class="${bodyClass}">
${hand()}
<main id="main" tabindex="-1">
${body}
</main>
</body>
</html>
`;
}
