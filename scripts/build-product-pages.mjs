#!/usr/bin/env node
// Build the landmark pages that carry their own figures: buildlang.html and low-water.html. Words come from
// site-src/world/buildlang.mjs and low-water.mjs; versions and merge states come from site-src/world/releases.json
// (scripts/fetch-releases.mjs), so a figure says "in 1.11.0", "on main" or "open" as GitHub said on the day of the
// fetch. Every figure opens in place to its source: the pull request or file it was read from.
//
//   node scripts/build-product-pages.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "./studies-shell.mjs";
import { CHECKED, longDate } from "../site-src/world/platforms.mjs";
import * as BL from "../site-src/world/buildlang.mjs";
import * as LW from "../site-src/world/low-water.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const R = JSON.parse(readFileSync(path.join(site, "site-src/world/releases.json"), "utf8"));
// a defined term, written [[term]], becomes <dfn class="term"> in the page's platform colour (world/site/depth.css)
const terms = (t) => esc(t).replace(/\[\[(.+?)\]\]/g, (m, w) => `<dfn class="term">${w}</dfn>`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PRS = new Map(Object.values(R.products).flatMap((p) => (p.prs || []).map((x) => [`${x.repo}#${x.number}`, x])));
const BLR = R.products.buildlang.github;
// the plain-language purpose the site's registry holds for BuildLang (system/systems.json), used as written: the
// meta description and one line on the page, so every surface states the same purpose
const PURPOSE = JSON.parse(readFileSync(path.join(site, "system/systems.json"), "utf8")).systems.find((x) => x.id === "buildlang").purpose;

// a pull request's state in words, against the release it did or did not make
function prState(repo, n) {
  const x = PRS.get(`${repo}#${n}`);
  if (!x) throw new Error(`product pages: ${repo}#${n} is not in releases.json; add it to release-sources.mjs`);
  const name = `${repo.split("/")[1]} #${n}`;
  if (!x.merged) return { x, words: `${name}, open and in review` };
  let when = `merged ${longDate(x.mergedAt)} (${x.commit})`;
  if (repo === "HarperZ9/buildlang") when += x.mergedTime <= BLR.publishedAt ? `, in ${BLR.version}` : `, on main after ${BLR.version}`;
  return { x, words: `${name}, ${when}` };
}

function fig(f, repo) {
  const r = repo || f.repo || "HarperZ9/buildlang";
  const { x, words } = prState(r, f.pr);
  const open = x.merged ? "" : ' data-state="open"';
  return `<li class="fig"${open}><details><summary><b class="fig-n d-fine">${esc(f.n)}</b> ${terms(f.text)}</summary>
<p class="fig-src">${terms(f.detail)} <a href="${x.url}">${esc(words)}</a>.</p></details></li>`;
}
const figs = (list, repo) => (list?.length ? `<ul class="figs">${list.map((f) => fig(f, repo)).join("\n")}</ul>` : "");
// the state of a section's work, in one visible line, from the merge state of the pull requests behind its figures
function status(list) {
  const seen = new Map();
  for (const f of list || []) { const r = f.repo || "HarperZ9/buildlang", x = PRS.get(`${r}#${f.pr}`); if (x) seen.set(`${r}#${f.pr}`, x); }
  const groups = { in: [], after: [], open: [] };
  for (const x of seen.values()) {
    const tag = `#${x.number}`;
    if (!x.merged) groups.open.push(tag);
    else if (x.repo === "HarperZ9/buildlang" && x.mergedTime > BLR.publishedAt) groups.after.push(tag);
    else groups.in.push(tag);
  }
  const parts = [];
  if (groups.in.length) parts.push(`in ${BLR.version} (${groups.in.join(", ")})`);
  if (groups.after.length) parts.push(`on main after ${BLR.version} (${groups.after.join(", ")})`);
  if (groups.open.length) parts.push(`in review, not merged (${groups.open.join(", ")})`);
  return parts.length ? `<p class="lp-status">${esc(parts.join("; ").replace(/^./, (c) => c.toUpperCase()))}.</p>` : "";
}
const run = (cmd) => (cmd ? `<p class="lp-run"><code>${esc(cmd)}</code></p>` : "");
const src = (s) => (s?.file ? `<p class="lp-source">The whole account: <a href="${BL.file(s.file)}">${esc(s.file)}</a> on main.</p>` : "");
const limit = (t) => (t ? `<p class="lp-limit">${esc(t)}</p>` : "");

function sectionsNav(list) {
  return `<nav class="lp-ways" aria-label="On this page">${list.map((s) => `<a href="#${s.id}">${esc(s.title)}</a>`).join("")}</nav>`;
}

// the registry as a field of marks: shape and word both say where a package came from; pressing one shows its check
const SHAPE = {
  circle: '<circle cx="20" cy="20" r="13"/>', square: '<rect x="8" y="8" width="24" height="24"/>',
  triangle: '<path d="M20 6 L34 32 L6 32 Z"/>', diamond: '<path d="M20 5 L35 20 L20 35 L5 20 Z"/>',
  hexagon: '<path d="M12 7 L28 7 L36 20 L28 33 L12 33 L4 20 Z"/>',
};
function registryField(s) {
  const marks = s.list.map(([n, v, o, check], i) => `<li><button type="button" class="rgy-mark" aria-pressed="${i === 0}" data-check="${esc(check)}" data-origin="${esc(s.origins[o][1])}">
<svg viewBox="0 0 40 40" aria-hidden="true">${SHAPE[s.origins[o][0]]}</svg><span class="ident" translate="no">${esc(n)}</span> <span class="lp-v">${esc(v)}</span></button></li>`).join("");
  const key = Object.values(s.origins).map(([sh, w]) => `<li><svg viewBox="0 0 40 40" aria-hidden="true">${SHAPE[sh]}</svg> ${esc(w)}</li>`).join("");
  const [n0, , o0, c0] = s.list[0];
  return `<div class="rgy" data-toy="registry"><ul class="rgy-field" aria-label="Packages in the registry">${marks}</ul>
<p class="rgy-check" aria-live="polite"><b class="ident">${esc(n0)}</b>, ${esc(s.origins[o0][1])}: ${esc(c0)}</p>
<ul class="rgy-key" aria-label="What each shape means">${key}</ul></div>
<p class="lp-source">The index, with a SHA-256 for every version: <a href="${BL.file(s.listSource.file)}">${esc(s.listSource.file)}</a>.</p>`;
}

function buildlang() {
  const sections = BL.SECTIONS.map((s) => {
    const list = s.list ? registryField(s) : "";
    return `<section class="lp-sec" id="${s.id}" aria-labelledby="h-${s.id}">
<h2 id="h-${s.id}"><span class="d-3d">${esc(s.title)}</span></h2>
${status(s.statusPrs ? s.statusPrs.map((pr) => ({ pr })) : s.figs)}
<p class="lp-lede">${terms(s.lede)}</p>
${limit(s.limit)}${run(s.run)}${list}${figs(s.figs)}${src(s.source)}
</section>`;
  }).join("\n");
  const first = BL.FIRST_STEP;
  const body = `<article class="lp" data-landmark="buildlang" data-hue="bldlng">
<header class="lp-head">
<h1><span class="d-3d">${esc(BL.INTRO.title)}</span> <span class="pf-mark">BLDLNG</span></h1>
<p class="lp-lede lp-lede-1">${esc(BL.INTRO.lede)}</p>
<p class="lp-purpose" data-canonical-purpose="buildlang">${esc(PURPOSE)}</p>
<p class="lp-run"><code>cargo install buildlang --version ${esc(BLR.version)} --locked</code></p>
<p class="lp-rel">Release <a href="${BLR.url}">${esc(BLR.version)}</a>, ${esc(longDate(BLR.published))}. Each figure below opens to the pull request it was read from, and says whether that work is in the release, on main after it, or still in review.</p>
${sectionsNav([...BL.SECTIONS, { id: "first", title: first.title }])}
</header>
${sections}
<section class="lp-sec" id="first" aria-labelledby="h-first">
<h2 id="h-first"><span class="d-3d">${esc(first.title)}</span></h2>
<p class="lp-lede">${esc(first.lede)}</p>
<div class="toy" data-toy="effects"><p class="lp-limit">With scripts on, this is a function you can change: choose what it declares and see whether it builds.</p></div>
<p class="lp-limit">${esc(first.toyNote)} <a href="${BL.file("docs/EFFECTS_GUIDE.md")}">docs/EFFECTS_GUIDE.md</a>.</p>
<p class="lp-status">Captured from buildc check</p>
<pre class="lp-code"><code>${esc(first.code)}</code></pre>
<p class="lp-source">The language guide goes on from here: <a href="/buildlang/">the guide</a>, <a href="${BL.REPO}">the source</a>.</p>
</section>
<p class="lp-verified"><b>Verified</b> ${esc(CHECKED)}: the release and its date from GitHub, and crates.io lists ${esc(R.products.buildlang.registry.version)}; the merge state of every linked pull request from GitHub on the same day; each figure read from the body of the pull request it links.</p>
</article>`;
  return page({ path: "buildlang.html", title: "BuildLang", description: PURPOSE, body, bodyClass: "reading landmark",
    extraHead: HEAD("effects,registry"), live: true });
}

function lowWater() {
  const eras = `<ol class="lw-eras">${LW.ERAS.map(([n, m], i) => `<li><span class="lw-n">${i + 1}</span> <b>${esc(n)}</b> <span class="lp-v">${m} minutes</span></li>`).join("")}</ol>`;
  const total = LW.ERAS.reduce((a, [, m]) => a + m, 0);
  const sections = LW.SECTIONS.map((s) => `<section class="lp-sec" id="${s.id}" aria-labelledby="h-${s.id}">
<h2 id="h-${s.id}"><span class="d-3d">${esc(s.title)}</span></h2>
<p class="lp-lede">${terms(s.lede)}</p>
${figs(s.figs)}${s.next ? `<p class="lp-limit">${esc(s.next)}</p>` : ""}${s.toy ? `
<h3 class="lp-h3">${esc(s.toy.title)}</h3>
<p class="lp-lede">${esc(s.toy.lede)}</p>
<div class="toy" data-toy="${s.toy.id}"><p class="lp-limit">With scripts on, this is a strike you can parry.</p></div>
<p class="lp-limit">${esc(s.toy.note)}</p>` : ""}
</section>`).join("\n");
  const st = LW.STORY;
  const body = `<article class="lp" data-landmark="game" data-hue="game">
<header class="lp-head">
<h1><span class="d-3d">${esc(LW.INTRO.title)}</span></h1>
<p class="lp-lede lp-lede-1">${esc(LW.INTRO.lede)}</p>
<p class="lp-note">${esc(LW.INTRO.note)}</p>
${sectionsNav([{ id: "story", title: st.title }, ...LW.SECTIONS])}
</header>
<section class="lp-sec" id="story" aria-labelledby="h-story">
<h2 id="h-story"><span class="d-3d">${esc(st.title)}</span></h2>
<p class="lp-lede">${esc(st.lede)}</p>
${eras}
<p class="lp-limit">${Math.floor(total / 60)} hours ${total % 60} minutes across the five eras. ${esc(st.rule)}</p>
<p class="lp-limit">${esc(st.state)}</p>
<figure class="pair" data-toy="pair">
<div class="pair-buttons" role="group" aria-label="Light" hidden><button type="button" class="toy-btn" data-show="0" aria-pressed="true">One lantern</button> <button type="button" class="toy-btn" data-show="1" aria-pressed="false">Even light</button></div>
<div class="pair-frames"><img data-frame="0" src="/media/world/work/dark-field-one-light-1280.webp" srcset="/media/world/work/dark-field-one-light-640.webp 640w, /media/world/work/dark-field-one-light-1280.webp 1280w" sizes="(max-width: 860px) 92vw, 760px" width="1651" height="1032" loading="lazy" decoding="async" alt="Four spheres on grey stone in a near-black field, lit by one small warm lantern.">
<img data-frame="1" src="/media/world/work/dark-field-control-1280.webp" srcset="/media/world/work/dark-field-control-640.webp 640w, /media/world/work/dark-field-control-1280.webp 1280w" sizes="(max-width: 860px) 92vw, 760px" width="1651" height="1032" loading="lazy" decoding="async" alt="The same spheres under an even surround of the same mean light, with no shadow and no dark field."></div>
<figcaption>How the engine lights a world this dark. One lantern: 68.5% of the pixels fall below L* 25. Even light of the same mean: none do.</figcaption>
</figure>
</section>
${sections}
<p class="lp-limit">${esc(LW.FOOTAGE)}</p>
<p class="lp-ways-end"><a href="/raw.html">The engine</a> <a href="/buildlang.html">BuildLang</a> <a href="https://github.com/HarperZ9/raw-native">raw-native source</a></p>
<p class="lp-verified"><b>Verified</b> ${esc(CHECKED)}: ${esc(st.verified)} The merge state of every linked pull request from GitHub on the same day, and each figure from the body of the pull request it links.</p>
</article>`;
  return page({ path: "low-water.html", title: "Low Water", description: LW.INTRO.description, body, bodyClass: "reading landmark",
    extraHead: HEAD("tell,pair"), live: true });
}

// every landmark page: the field, the one sound layer, and the page's own toy
function HEAD(toy) {
  return ['<link rel="stylesheet" href="/world/site/landmark.css">', '<link rel="stylesheet" href="/world/site/depth.css">', '<script type="module" src="/world/site/home-field.js"></script>',
    '<script type="module" src="/world/site/sound.js"></script>', ...toy.split(",").map((t) => `<script type="module" src="/world/site/explore/${t}.js"></script>`)].join("\n");
}

for (const [file, html] of [["buildlang.html", buildlang()], ["low-water.html", lowWater()]]) {
  if (/[A-Za-z]:[\\/](?:dev|Users|Downloads)/.test(html) || html.includes("—")) throw new Error(`${file}: a local path or an em dash reached the page`);
  writeFileSync(path.join(site, file), html);
}
console.log("product pages: buildlang.html, low-water.html");
