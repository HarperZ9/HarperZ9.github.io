#!/usr/bin/env node
// Build the surfaces: one page for each manifest in site-src/world/surfaces/. The Playground is the first.
//
//   node scripts/build-surfaces.mjs            write each surface's page
//   node scripts/build-surfaces.mjs --check    fail if a page's own part (its <main>) differs from a fresh build
//
// A surface page opens as words and a still, with no module loaded. The still is worked out here, by the same
// module code the page runs after a press, so it reads the same with scripts off. One press starts the modules
// (world/site/surfaces/surface-start.js, then surface-page.mjs), which hand values to each other through the bus.
// The page states what the press loads, in bytes measured here from the files themselves.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { page } from "./studies-shell.mjs";
import { labelFor } from "./demo-labels.mjs";
import registry from "../world/site/surfaces/registry.mjs";
import { indexElements } from "../world/site/surfaces/elements-data.mjs";
import { studioBlend } from "../world/site/surfaces/surface-blend.mjs";
import { motion } from "../world/studio/lib/lanes/motion.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TABLE = "world/ui/shell/organic/data/elements.json", BENCH_CSS = "world/site/surfaces/bench.css";
const list = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
const size = (bytes) => (bytes >= 1000 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

// Every file a module file reaches through its imports, static or not, followed to the end.
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+\.m?js)(?:\?[^"']*)?["']/g;
function reach(file, seen = new Set()) {
  if (seen.has(file) || !existsSync(path.join(site, file))) return seen;
  seen.add(file);
  for (const m of readFileSync(path.join(site, file), "utf8").matchAll(IMPORT)) {
    if (/^[a-z]+:/i.test(m[1])) continue;
    reach(m[1].startsWith("/") ? m[1].slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])), seen);
  }
  return seen;
}
const bytes = (files) => [...files].reduce((n, f) => n + readFileSync(path.join(site, f)).length, 0);
const adapter = (id) => path.posix.normalize(path.posix.join("world/site/surfaces", registry.SURFACES[id].file));

function exchange(m) {
  const x = m.exchange, ix = indexElements(JSON.parse(readFileSync(path.join(site, TABLE), "utf8")));
  for (const id of [...x.modules, ...x.press]) if (!registry.SURFACES[id]?.load) throw new Error(`build-surfaces: ${m.id} names "${id}", which is not a module with an adapter`);
  for (const id of x.modules) if (registry.SURFACES[id].weight !== "light") throw new Error(`build-surfaces: "${id}" is heavy; a heavy module goes under press`);
  for (const [from, medium] of x.sends) {
    if (!registry.SURFACES[from].gives.includes(medium)) throw new Error(`build-surfaces: "${from}" does not give ${medium}`);
    if (!x.modules.some((id) => id !== from && registry.SURFACES[id].takes.includes(medium))) throw new Error(`build-surfaces: no module on ${m.id} takes ${medium}`);
  }
  // the still: the same blend the page starts with, worked out by the modules' own code
  const sb = studioBlend(ix, x.elements, null), mo = motion(sb.material), pts = mo.samples(48), names = sb.parts.map((p) => p.name);
  const technique = sb.material.hints.type.technique;
  // what the press loads: the page controller, the modules' files, the element table and the modules' stylesheet
  const first = reach("world/site/surfaces/surface-page.mjs"); for (const id of x.modules) reach(adapter(id), first);
  const startBytes = bytes(first) + readFileSync(path.join(site, TABLE)).length + readFileSync(path.join(site, BENCH_CSS)).length;
  const press = x.press.map((id) => { const more = [...reach(adapter(id))].filter((f) => !first.has(f)); return { id, name: registry.SURFACES[id].name, bytes: bytes(more) }; });
  const manifest = { surface: m.id, elements: x.elements, modules: x.modules, sends: x.sends, css: `/${BENCH_CSS}` };
  const takers = (medium) => list(x.modules.filter((id) => id !== x.sends[0][0] && registry.SURFACES[id].takes.includes(medium)).map((id) => registry.SURFACES[id].name));
  return `<section class="sx" id="${x.anchor}" aria-labelledby="${x.anchor}-h">
<h2 id="${x.anchor}-h">${esc(x.heading)}</h2>
<p>${esc(x.say)}</p>
${labelFor(x.demo)}
<div id="sx-before">
<div class="sx-still">
<figure><ul class="sx-pal">${sb.parts.map((p) => `<li><i style="background:${esc(p.hex)}"></i>${esc(p.name)} <code>${esc(p.hex)}</code></li>`).join("")}<li><i style="background:${esc(sb.palette.mix)}"></i>The mix <code>${esc(sb.palette.mix)}</code></li></ul><figcaption>${esc(registry.SURFACES.blend.name)}: ${esc(list(names))} in equal shares, and the colour of the mix.</figcaption></figure>
<figure><p class="sx-word">${esc(names.join(" + "))}</p><figcaption>${esc(registry.SURFACES.lettering.name)}: the blend's name, to be lettered as ${esc(technique)}.</figcaption></figure>
<figure><svg class="sx-curve" viewBox="0 0 200 80" role="img" aria-label="Timing curve: progress against time"><path d="M4 76H196M4 76V4"/><polyline points="${pts.map(([u, v]) => `${(4 + u * 192).toFixed(1)},${(76 - v * 72).toFixed(1)}`).join(" ")}"/></svg><figcaption>${esc(registry.SURFACES.motion.name)}: progress against time. One build takes ${mo.durationS.toFixed(1)} s at ${mo.fps} frames a second.</figcaption></figure>
</div>
<p class="sx-as">Shown as built, from the same code the page runs. With scripts off this is the whole reading; <a href="${esc(x.plain)}">Elements</a> has every module on one bench.</p>
<p class="sx-go"><button type="button" id="sx-start" hidden>Start the blend</button><span>Loads ${size(startBytes)}: the element table and ${x.modules.length} modules. Nothing loads before the press.</span></p>
</div>
<p class="sx-say" id="sx-say" role="status" aria-live="polite">When it runs, ${esc(registry.SURFACES[x.sends[0][0]].name.toLowerCase())} hands ${list(x.sends.map(([, medium]) => `${medium === "blend" ? "its blend" : `a ${medium}`} to ${takers(medium)}`))}, and this line says so each time.</p>
<div id="sx-hosts" data-surface="${x.modules.join(" ")}" data-elements="${x.elements.join(" ")}" tabindex="-1" role="group" aria-label="${esc(x.heading)}" hidden></div>
<div id="sx-more" hidden>${press.map((p) => `<p class="sx-go"><button type="button" data-sx-press="${p.id}">Add ${esc(p.name.toLowerCase())}</button><span>Loads ${size(p.bytes)} more. It stirs the same blend.</span></p>`).join("")}</div>
<script type="application/json" id="sx-manifest">${JSON.stringify(manifest).replace(/</g, "\\u003c")}</script>
</section>`;
}

function build(m) {
  const row = ([href, name, say]) => `<li><a href="${href}">${name}</a><p>${say}</p></li>`;
  const body = `<article class="ds">
<h1>${esc(m.title)}</h1>
<p class="ds-lede">${m.lede}</p>
<ul class="pg-list">${m.parts.map(row).join("")}</ul>
${exchange(m)}
<h2 id="instruments">${esc(m.placesHeading)}</h2>
<ul class="pg-list">${m.places.map(row).join("")}</ul>
</article>
<script type="module" src="/world/site/surfaces/surface-start.js"></script>`;
  return page({ path: m.file, title: m.title, description: m.description, body, bodyClass: "reading ds-body sx-body",
    extraHead: '<link rel="stylesheet" href="/world/site/distill/distill.css">\n<link rel="stylesheet" href="/world/site/surfaces/surface-page.css">' });
}

const main = (html) => html.slice(html.indexOf('<main id="main"'), html.indexOf("</main>")).replace(/\?v=world-[0-9a-f]+/g, "");
const dir = path.join(site, "site-src/world/surfaces"), check = process.argv.includes("--check"), stale = [];
for (const f of readdirSync(dir).filter((n) => n.endsWith(".mjs")).sort()) {
  const m = (await import(pathToFileURL(path.join(dir, f)).href)).default, html = build(m), out = path.join(site, m.file);
  if (check) { if (!existsSync(out) || main(readFileSync(out, "utf8")) !== main(html)) stale.push(m.file); }
  else writeFileSync(out, html);
  console.log(`surface ${m.id}: ${m.file}, ${m.exchange.modules.length} modules on the press, ${m.exchange.press.length} heavy`);
}
if (stale.length) { console.error(`stale: ${stale.join(", ")}; run node scripts/build-surfaces.mjs, then the revision stamp`); process.exit(1); }
