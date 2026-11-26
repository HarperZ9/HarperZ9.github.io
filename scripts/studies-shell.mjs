// studies-shell.mjs: one page in the world's shell, for the generated reading pages (studies, boards, tools).
// The head carries the discoverability set (title, description, canonical, social tags); the body carries the
// shell's hand (the universe's navigation, with every link root-absolute) and the page's own <main>.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./studies-markdown.mjs";

import { backdrop as fieldBackdrop } from "./field-backdrop.mjs";
import { labelHand } from "./hand-labels.mjs";
import { menuDialog } from "./hand-menu.mjs";
export const ORIGIN = "https://harperz9.github.io";
const SITE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CARD = `${ORIGIN}/img/og/p/home.jpg`;
const TEXT_FACE = "/world/ui/shell/fonts/hanken-grotesk.woff2";  // the still face; Accession and its families are materials a page adds

function existingCardTags(rel) {
  const norm = rel.endsWith("/") ? `${rel}index.html` : rel;
  const extract = (src) => {
    const ogImg = src.match(/<meta property="og:image" content="[^"]+\?v=[0-9a-f]+">/)?.[0];
    const ogAlt = src.match(/<meta property="og:image:alt" content="[^"]+">/)?.[0];
    const twImg = src.match(/<meta name="twitter:image" content="[^"]+\?v=[0-9a-f]+">/)?.[0];
    const twAlt = src.match(/<meta name="twitter:image:alt" content="[^"]+">/)?.[0];
    return ogImg && twImg && ogAlt && twAlt ? { ogImg, ogAlt, twImg, twAlt } : null;
  };
  const disk = path.join(SITE_ROOT, norm);
  if (existsSync(disk) && statSync(disk).isFile()) {
    const hit = extract(readFileSync(disk, "utf8"));
    if (hit) return hit;
  }
  try {
    const head = execFileSync("git", ["show", `HEAD:${norm}`], { cwd: SITE_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 8 * 1024 * 1024 });
    return extract(head);
  } catch {
    return null;
  }
}

function hand(here = "") {
  return labelHand(`<header class="o-hand" aria-label="Site">
  <a class="skip" href="#main">Skip to the page</a>
  <a class="o-home" href="/">Zain Dana Harper</a>
  <a data-o="band" href="/world/universe/proto/index.html" aria-label="The map"></a>
  <button type="button" data-o="fold" aria-controls="o-menu" aria-expanded="false" hidden><span class="o-name">Menu (M)</span><i></i><i></i><i></i></button>
  <button type="button" data-o="lamp" data-theme-toggle aria-pressed="true"><span class="o-name">Lamp</span></button>
  <button type="button" data-o="peel" data-plain-toggle aria-pressed="false"><span class="o-name">Plain view</span></button>
</header>`) + "\n" + menuDialog({ here });
}

// page({ path, title, description, body, robots, extraHead, jsonld }) -> the whole document
export function page({ path, title, description, body, robots = "", extraHead = "", jsonld = null, css = "/studies/studies.css", htmlAttrs = "", bodyClass = "reading", backdrop = true, live = false }) {
  const url = `${ORIGIN}/${path.replace(/index\.html$/, "")}`, full = `${title} | Zain Dana Harper`;
  const card = existingCardTags(path);
  const ogCardBlock = card
    ? `${card.ogImg}\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n${card.ogAlt}`
    : `<meta property="og:image" content="${CARD}">`;
  const twCardBlock = card
    ? `<meta name="twitter:card" content="summary_large_image">\n${card.twImg}\n${card.twAlt}`
    : `<meta name="twitter:card" content="summary_large_image">`;
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
${ogCardBlock}
${twCardBlock}
<meta name="twitter:title" content="${esc(full)}">
<meta name="twitter:description" content="${esc(description)}">
<link rel="preload" href="${TEXT_FACE}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/world/ui/shell/shell.css">
<link rel="stylesheet" href="${css}">
<link rel="stylesheet" href="/world/site/depth.css">
<script type="module" src="/world/ui/shell/shell.js"></script>
<script type="module" src="/world/site/hand-scroll.js"></script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ""}${extraHead}</head>
<body class="${bodyClass}">
${backdrop ? fieldBackdrop({ live }) : ""}
${hand("/" + path.replace(/index\.html$/, ""))}
<main id="main" tabindex="-1">
${body}
</main>
</body>
</html>
`;
}
