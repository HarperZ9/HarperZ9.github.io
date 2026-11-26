// The full directory stays inspectable when scripts are unavailable.
import { readFile, writeFile as writeToDisk } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ROUTE_REGISTRY } from '../system/routes.js';
import { existsSync, readFileSync } from 'node:fs';

// This script is copied alone into test sandboxes, so it reads the link-card
// manifest itself (see scripts/analytics-cards.mjs for the shared version).
// Without a manifest, as in a sandbox, the page renders without card tags.
const CARD_MANIFEST = new URL('../img/og/p/cards.json', import.meta.url);
const attr = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
function cardTags(href) {
  if (!existsSync(CARD_MANIFEST)) return [];
  const card = JSON.parse(readFileSync(CARD_MANIFEST, 'utf8'))[href];
  if (!card) throw new Error(`${href}: no card in img/og/p/cards.json`);
  const alt = attr(card.alt);
  return [
    `<meta property="og:image" content="${card.image}">`,
    '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${alt}">`, '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:image" content="${card.image}">`, `<meta name="twitter:image:alt" content="${alt}">`,
  ];
}
import { identPattern, markIdents, packageNames } from './ident-tokens.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const escape = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const pillars = [
  ['World', 'world', 'The world', 'index.html', 'Walk the road through ink and water, then the places for light, type, mosaic, sound, data, film and the tools.'],
  ['Systems', 'flywheel', 'Flywheel and tools', 'flywheel.html', 'Flywheel and the tools that work with it or on their own.'],
  ['Security', 'security', 'Safety, verification and privacy', 'security.html', 'Inspect controls, evidence boundaries and security projects.'],
  ['Research', 'research', 'Research', 'research.html', 'Read research notes, papers and evaluation work.'],
  ['Writing', 'writing', 'Writing', 'publications.html', 'Read every essay, investigation, briefing and paper, sorted into five sections.'],
  ['Who Knew First', 'who-knew-first', 'Who Knew First', 'who-knew-first.html', 'Read the investigation of nine 2026 AI agent incidents: who held the facts, and who told the public first.'],
  ['Studio', 'studio', 'Studio and graphics', 'studio.html', 'The Playground and its parts, then restoration, generative work and media.'],
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
<title>Site index · Zain Dana Harper</title>
<meta name="description" content="Find Flywheel workflows, standalone tools, safety and verification work, publications, graphics, fonts and collaboration routes.">
<link rel="canonical" href="https://harperz9.github.io/site-index.html">
<meta property="og:title" content="Site index · Zain Dana Harper"><meta property="og:type" content="website">
${cardTags("site-index.html").join(String.fromCharCode(10))}
<meta property="og:description" content="A clear map of the workshop, with Flywheel as the main engine.">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="system/doc.css?v=20260907-reading-completion">
<link rel="stylesheet" href="system/site-index.css?v=20260925-void-plates">
<script type="module" src="system/nav.js?v=20260909-pillar-navigation"></script>
<script type="module" src="system/site-index.js?v=20260925-void-plates"></script>
</head><body><a class="skip-link" href="#main">Skip to index</a><div id="site-nav" class="site-nav"></div>
<main id="main" class="sheet site-directory"><header class="directory-head"><p class="directory-context masthead-path">Zain Dana Harper / Explore</p><h1>Find your way in.</h1>
<p class="lead">Every page on the site, organized around five clear pillars and nine full sectors. Press <strong>Ctrl+K</strong> (or <strong>/</strong>) from any page to jump anywhere.</p>
<p>Each project page states its purpose, current status, observed checks, and open gaps. A listing here does not imply every tool is installed or enabled by default.</p>
<p><button type="button" class="directory-jump-btn" data-qj-open>Quick-Jump Search (Ctrl+K)</button> · <a href="architecture.html">Five-Platform Architecture</a> · <a href="catalog.html">Product catalog</a> · <a href="floor.html">Everything floor</a> · <a href="site-index.html" aria-current="page">Site index</a></p></header>
<nav class="directory-wayfinding" aria-label="Five ways in">
  <a class="way-card" href="index.html"><span class="way-num">01</span><strong>Start</strong><span>Front door, unified platform map, and everything inventory.</span></a>
  <a class="way-card" href="architecture.html"><span class="way-num">02</span><strong>Platforms &amp; Tools</strong><span>The Playground, BuildLang, Flywheel, Commons, and 45 tools.</span></a>
  <a class="way-card" href="playground/"><span class="way-num">03</span><strong>Interactive Demos</strong><span>WebGPU studios, Estuary Lantern, Low Water, receipts, and fonts.</span></a>
  <a class="way-card" href="research.html"><span class="way-num">04</span><strong>Research &amp; Writing</strong><span>16 papers and DOIs, Who Knew First, 14 frontier lanes, and datasets.</span></a>
  <a class="way-card" href="hire.html"><span class="way-num">05</span><strong>Work With Me / CV</strong><span>41 merged upstream PRs, full CV, role resumes, and pilot offer.</span></a>
</nav>
<div class="directory-search" hidden data-search-controls><label for="index-query">Filter the full directory</label><div><input id="index-query" type="search" placeholder="Try memory, receipts, graphics, BDB, Elder ENB..." autocomplete="off"><button type="button" data-clear>Clear</button></div><p data-search-status role="status" aria-live="polite"></p></div>
<nav class="directory-pillars" aria-label="Index sectors">${shortcuts}</nav>
<p data-no-results hidden>No matching pages. Try a broader term or clear the search.</p>
${sections}
<footer><p><a href="index.html">Home</a> · <a href="https://github.com/HarperZ9" rel="external noopener">Public source</a></p></footer></main></body></html>\n`;
// node scripts/render-site-index.mjs --check writes nothing and exits 1 when site-index.html or sitemap.xml would
// change. It reads system/routes.js from disk, so run the route registry's check first (its --check runs this one).
const CHECK = process.argv.includes('--check');
async function writeFile(file, text) {
  if (!CHECK) return writeToDisk(file, text);
  const onDisk = existsSync(file) ? (await readFile(file, 'utf8')).replace(/\r\n/g, '\n') : null;
  if (onDisk !== text.replace(/\r\n/g, '\n')) {
    console.error(`${file} differs from what scripts/render-site-index.mjs writes; run node scripts/render-route-registry.mjs and commit the result`);
    process.exitCode = 1;
  }
}
// Advisory IDs and package names in the summaries stay whole on narrow screens.
const systems = JSON.parse(await readFile(root + 'system/systems.json', 'utf8'));
// The standing flag beside each link to a finding (scripts/finding-flags.mjs) is part of this page's bytes. Before
// 15 November 2026 a rerun of this script wrote the page without its flags and a second tool had to put them back.
// A test sandbox that copies this script alone has no findings and no flags tool, and renders without them.
async function withFindingFlags(html) {
  const tool = new URL('./finding-flags.mjs', import.meta.url);
  const pagesFile = new URL('../findings/pages.json', import.meta.url), ledgerFile = new URL('../findings/data/ledger.json', import.meta.url);
  if (![tool, pagesFile, ledgerFile].every((u) => existsSync(u))) return html;
  const { standings, flagLinks } = await import(tool.href);
  const pages = JSON.parse(readFileSync(pagesFile, 'utf8')).pages.filter((p) => p.id && !p.redirect);
  const ledger = JSON.parse(readFileSync(ledgerFile, 'utf8'));
  return flagLinks(html, standings(pages.map((p) => ({ id: p.id, href: `/${p.path}` })), ledger.relations));
}
await writeFile(root + 'site-index.html', await withFindingFlags(markIdents(page, identPattern(packageNames(systems)))));
const sitemapPath = root + 'sitemap.xml';
const sitemap = await readFile(sitemapPath, 'utf8');
if (!sitemap.includes('https://harperz9.github.io/site-index.html')) {
  await writeFile(sitemapPath, sitemap.replace('</urlset>', '  <url><loc>https://harperz9.github.io/site-index.html</loc></url>\n</urlset>'));
}
console.log(`${CHECK ? 'checked' : 'rendered'} site-index.html from route registry`);
