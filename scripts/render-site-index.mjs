// The full directory stays inspectable when scripts are unavailable.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ROUTE_REGISTRY } from '../system/routes.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const escape = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const pillars = [
  ['Systems', 'flywheel', 'Flywheel and tools', 'flywheel.html', 'Start with the central engine, then explore its workflows and independently useful tools.'],
  ['Security', 'security', 'Safety, verification and privacy', 'security.html', 'Inspect controls, evidence boundaries and security projects.'],
  ['Research', 'research', 'Research and writing', 'research.html', 'Read publications, source-backed essays and evaluation work.'],
  ['Studio', 'studio', 'Studio and graphics', 'studio.html', 'Explore rendering, restoration, generative work and media.'],
  ['Fonts', 'fonts', 'Fonts and typography', 'fonts.html', 'Browse type families, previews and specimens.'],
  ['Work', 'work', 'Work and collaboration', 'hire.html', 'Find background, experience and ways to work together.'],
];
const searchTextFor = route => [route.searchText, route.maturity].filter(Boolean).join(' ');
const summaryFor = route => {
  const parts = [];
  if (route.maturity) parts.push(`<span class="index-meta">${escape(route.maturity)}</span>`);
  if (route.summary) parts.push(escape(route.summary));
  return parts.length ? `<p>${parts.join(' ')}</p>` : '';
};
const sections = pillars.map(([family, id, title, href, summary]) => {
  const group = ROUTE_REGISTRY.families.find(f => f.label === family);
  if (!group) throw new Error(`Missing pillar ${family}`);
  const rows = group.routes.filter(r => r.href !== 'site-index.html').map(route =>
    `<li data-index-entry data-search-text="${escape(searchTextFor(route))}"><a href="${escape(route.href)}">${escape(route.label)}</a>${summaryFor(route)}</li>`).join('\n');
  return `<section id="${id}" data-index-section><header><h2><a href="${href}">${title}</a></h2><p>${summary}</p></header><ul>${rows}</ul></section>`;
}).join('\n');
const shortcuts = pillars.map(([, id, title]) => `<a href="#${id}">${title}</a>`).join('');
const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Site index · Zentropy Labs</title>
<meta name="description" content="Find Flywheel workflows, standalone tools, safety and verification work, publications, graphics, fonts and collaboration routes.">
<link rel="canonical" href="https://harperz9.github.io/site-index.html">
<meta property="og:title" content="Site index · Zentropy Labs"><meta property="og:type" content="website">
<meta property="og:image" content="https://harperz9.github.io/img/og/portfolio-home.png">
<meta property="og:description" content="A clear map of the workshop, with Flywheel as the main engine.">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="system/doc.css?v=20260907-reading-completion">
<link rel="stylesheet" href="system/site-index.css?v=20260909-pillar-navigation">
<script type="module" src="system/nav.js?v=20260909-pillar-navigation"></script>
<script type="module" src="system/site-index.js?v=20260909-pillar-navigation"></script>
</head><body><a class="skip-link" href="#main">Skip to index</a><div id="site-nav" class="site-nav"></div>
<main id="main" class="sheet site-directory"><header class="directory-head"><p class="directory-context">Zentropy Labs / Explore</p><h1>Find your way in.</h1>
<p class="lead">Start with <a href="flywheel.html">Flywheel</a> for the central engine and its integrated workflows. Explore individual tools when you need them, or enter through research, graphics, typography and collaboration.</p>
<p>Each project page explains its purpose, current status and evidence. A listing here does not imply that every capability is installed or operational in Flywheel.</p>
<p><a href="catalog.html">Browse the product catalog by capability</a> · <a href="site-index.html" aria-current="page">Site index</a></p></header>
<div class="directory-search" hidden data-search-controls><label for="index-query">Find a page or topic</label><div><input id="index-query" type="search" placeholder="Try memory, receipts, graphics…" autocomplete="off"><button type="button" data-clear>Clear</button></div><p data-search-status role="status" aria-live="polite"></p></div>
<nav class="directory-pillars" aria-label="Index sectors">${shortcuts}</nav>
<p data-no-results hidden>No matching pages. Try a broader term or clear the search.</p>
${sections}
<footer><p><a href="index.html">Home</a> · <a href="https://github.com/HarperZ9" rel="external noopener">Public source</a></p></footer></main></body></html>\n`;
await writeFile(root + 'site-index.html', page);
const sitemapPath = root + 'sitemap.xml';
const sitemap = await readFile(sitemapPath, 'utf8');
if (!sitemap.includes('https://harperz9.github.io/site-index.html')) {
  await writeFile(sitemapPath, sitemap.replace('</urlset>', '  <url><loc>https://harperz9.github.io/site-index.html</loc></url>\n</urlset>'));
}
console.log('rendered site-index.html from route registry');
