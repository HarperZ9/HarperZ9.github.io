#!/usr/bin/env node
// Build the surfaces: one page for each manifest in site-src/world/surfaces/. The Playground is the unified
// creative surface combining the shared property bus, Estuary, Type Forge, Shader/Retro, Sound, Field,
// all creative engines from CATALOG.md (#workbench), Native DX12/WebGPU renderer (#native), Low Water (#low-water),
// Superframe (#superframe), and Wave 23D-1 Round 2 media/audio cues (#studio-media).
//
//   node scripts/build-surfaces.mjs            write each surface's page
//   node scripts/build-surfaces.mjs --check    fail if a page's own part (its <main>) differs from a fresh build
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { page } from "./studies-shell.mjs";
import { labelFor } from "./demo-labels.mjs";
import registry from "../world/site/surfaces/registry.mjs";
import { indexElements } from "../world/site/surfaces/elements-data.mjs";
import { studioBlend } from "../world/site/surfaces/surface-blend.mjs";
import { FILES } from "../world/site/surfaces/take-files.mjs";
import { motion } from "../world/studio/lib/lanes/motion.mjs";
import { describeTiming } from "../system/chart-describe.mjs";
import { CHECKED, longDate } from "../site-src/world/platforms.mjs";
import * as RW from "../site-src/world/raw.mjs";
import * as LW from "../site-src/world/low-water.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const terms = (t) => esc(t).replace(/\[\[(.+?)\]\]/g, (m, w) => `<dfn class="term">${w}</dfn>`);
const TABLE = "world/ui/shell/organic/data/elements.json", BENCH_CSS = "world/site/surfaces/bench.css";
const list = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
const size = (bytes) => (bytes >= 1000 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

const R = JSON.parse(readFileSync(path.join(site, "site-src/world/releases.json"), "utf8"));
const PRS = new Map(Object.values(R.products).flatMap((p) => (p.prs || []).map((x) => [`${x.repo}#${x.number}`, x])));
const BLR = R.products.buildlang.github;

function prState(repo, n) {
  const x = PRS.get(`${repo}#${n}`);
  if (!x) return { x: { merged: true, url: `https://github.com/${repo}/pull/${n}` }, words: `${repo.split("/")[1]} #${n}` };
  const name = `${repo.split("/")[1]} #${n}`;
  if (!x.merged) return { x, words: `${name}, open and in review` };
  let when = `merged ${longDate(x.mergedAt)} (${x.commit})`;
  if (repo === "HarperZ9/buildlang") {
    const first = x.firstRelease;
    when += first ? `, first released in ${first.version}` : `, on main after ${BLR.version}`;
  }
  return { x, words: `${name}, ${when}` };
}

function figsHtml(items, repo) {
  if (!items?.length) return "";
  return `<ul class="figs">${items.map((f) => {
    const { x, words } = prState(repo || f.repo || "HarperZ9/buildlang", f.pr);
    return `<li class="fig"${x.merged ? "" : ' data-state="open"'}><details><summary><b class="fig-n d-fine">${esc(f.n)}</b> ${terms(f.text)}</summary><p class="fig-src">${terms(f.detail)} <a href="${x.url}">${esc(words)}</a>.</p></details></li>`;
  }).join("\n")}</ul>`;
}

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+\.m?js)(?:\?[^"']*)?["']/g;
const WORKER = /new URL\(\s*["']([^"']+\.m?js)["']\s*,\s*import\.meta\.url\s*\)/g;
function reach(file, seen = new Set(), workers = false) {
  if (seen.has(file) || !existsSync(path.join(site, file))) return seen;
  seen.add(file);
  const src = readFileSync(path.join(site, file), "utf8");
  for (const m of [...src.matchAll(IMPORT), ...(workers ? src.matchAll(WORKER) : [])]) {
    if (/^[a-z]+:/i.test(m[1])) continue;
    reach(m[1].startsWith("/") ? m[1].slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])), seen, workers);
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
  const sb = studioBlend(ix, x.elements, null), mo = motion(sb.material), pts = mo.samples(48), said = describeTiming(pts, mo.durationS).text, names = sb.parts.map((p) => p.name);
  const technique = sb.material.hints.type.technique;
  const TAKE = "world/site/surfaces/take-files.mjs", first = reach("world/site/surfaces/surface-page.mjs", new Set([TAKE])); first.delete(TAKE);
  for (const id of x.modules) reach(adapter(id), first);
  const startBytes = bytes(first) + readFileSync(path.join(site, TABLE)).length + readFileSync(path.join(site, BENCH_CSS)).length;
  const press = x.press.map((id) => { const more = [...reach(adapter(id))].filter((f) => !first.has(f)); return { id, name: registry.SURFACES[id].name, bytes: bytes(more) }; });
  const takeBytes = bytes([...reach(TAKE)].filter((f) => !first.has(f)));
  const takes = [["png", "Picture (.png)"], ...FILES.filter((f) => f.kind !== "palette-gpl").map((f) => [f.kind, `${f.label} (.${f.ext.split(".").pop()})`])];
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
<figure><svg class="sx-curve" viewBox="0 0 200 80" role="img" aria-label="Timing curve. ${esc(said)} Drawn as progress, up the side, against time, along the bottom."><path d="M4 76H196M4 76V4"/><polyline points="${pts.map(([u, v]) => `${(4 + u * 192).toFixed(1)},${(76 - v * 72).toFixed(1)}`).join(" ")}"/></svg><figcaption>${esc(registry.SURFACES.motion.name)}. ${esc(said)} Drawn as progress against time. One build takes ${mo.durationS.toFixed(1)} s at ${mo.fps} frames a second.</figcaption></figure>
</div>
<p class="sx-as">Shown as built, from the same code the page runs. With scripts off this is the whole reading; <a href="${esc(x.plain)}">Elements</a> has every module on one bench.</p>
<p class="sx-go"><button type="button" id="sx-start" hidden>Start the blend</button><span>Loads ${size(startBytes)}: the element table and ${x.modules.length} modules. Nothing loads before the press.</span></p>
</div>
<p class="sx-say" id="sx-say" role="status" aria-live="polite">When it runs, ${esc(registry.SURFACES[x.sends[0][0]].name.toLowerCase())} hands ${list(x.sends.map(([, medium]) => `${medium === "blend" ? "its blend" : `a ${medium}`} to ${takers(medium)}`))}, and this line says so each time.</p>
<details class="sx-rec" id="sx-rec" hidden><summary>This value's record</summary><dl></dl></details>
<div id="sx-hosts" data-surface="${x.modules.join(" ")}" data-elements="${x.elements.join(" ")}" tabindex="-1" role="group" aria-label="${esc(x.heading)}" hidden></div>
<div id="sx-more" hidden>${press.map((p) => `<p class="sx-go"><button type="button" data-sx-press="${p.id}">Add ${esc(p.name.toLowerCase())}</button><span>Loads ${size(p.bytes)} more. ${registry.SURFACES[p.id].takes.includes("image") ? "That is the most it costs; the loom, the plot map and the cubes share their files. It draws the last picture handed on." : "It stirs the same blend."}</span></p>`).join("")}</div>
<p class="sx-go" id="sx-take" hidden><span id="sx-take-of"></span>${takes.map(([kind, label]) => `<button type="button" data-sx-file="${kind}">${esc(label)}</button>`).join("")}<span data-take-bytes="${takeBytes}">The picture is saved as it stands. Pen lines, plotter moves and a relief load ${size(takeBytes)} the first time.</span></p>
<script type="application/json" id="sx-manifest">${JSON.stringify(manifest).replace(/</g, "\\u003c")}</script>
</section>`;
}

async function room(m, r) {
  const row = registry.SURFACES[r.id];
  if (!row?.load || row.room !== r.anchor) throw new Error(`build-surfaces: ${m.id} names the room "${r.id}" at #${r.anchor}; the registry has no such room`);
  if (row.weight !== "light" && !r.heavy) throw new Error(`build-surfaces: the room "${r.id}" is heavy; say so in the manifest`);
  for (const medium of [...(r.takes || []), ...(r.gives || [])]) if (![...row.takes, ...row.gives].includes(medium)) throw new Error(`build-surfaces: the room "${r.id}" does not take or give ${medium}`);
  const mod = await import(pathToFileURL(path.join(site, adapter(r.id))).href), still = mod.still();
  const TABLE_CODE = "world/site/surfaces/elements-data.mjs", files = reach("world/site/surfaces/rooms.mjs", new Set(row.table === false ? [TABLE_CODE] : []));
  reach(adapter(r.id), files); if (row.table === false) files.delete(TABLE_CODE);
  const css = r.css ? readFileSync(path.join(site, r.css)).length : 0;
  const started = new Set();
  if (r.later) for (const f of reach(adapter(r.id))) for (const w of readFileSync(path.join(site, f), "utf8").matchAll(WORKER)) reach(path.posix.normalize(path.posix.join(path.posix.dirname(f), w[1])), started, true);
  const more = bytes(started);
  if (r.later && !more) throw new Error(`build-surfaces: the room "${r.id}" says "${r.later}" and names no worker`);
  return `<section class="sx rm" id="${r.anchor}" data-room="${r.id}" data-home="${m.id}"${r.css ? ` data-css="/${r.css}"` : ""}${r.audio ? " data-audio" : ""} aria-labelledby="${r.anchor}-h">
<h2 id="${r.anchor}-h">${esc(r.heading)}</h2>
<p>${esc(r.say)}</p>
${labelFor(r.demo)}
<div class="rm-before">
<figure class="rm-still">${still.html || still.svg || ""}<figcaption>${esc(still.caption)}</figcaption></figure>
<p class="sx-go"><button type="button" data-room-open hidden>${esc(r.open)}</button><span>Loads ${size(bytes(files) + css)} at most.${more ? ` <span data-later="${more}">${esc(r.later.replace("{size}", size(more)))}</span>` : ""}</span></p>
</div>
<p class="sx-say rm-say" role="status" aria-live="polite">${esc(r.exchange)}</p>
<div class="rm-host" role="group" aria-label="${esc(r.heading)}" hidden></div>
</section>`;
}

function workbenchSection(m) {
  if (!m.workbench?.length) return "";
  const total = m.workbench.reduce((n, g) => n + g.engines.length, 0);
  const groups = m.workbench.map((g) => `<div class="wb-group" data-wb-group>
<h3>${esc(g.discipline)}</h3>
<ul class="wb-list">${g.engines.map((e) => {
    const btns = e.actions.map(([act, tgt, label]) => `<button type="button" data-wb-action="${esc(act)}" data-wb-target="${esc(tgt)}">${esc(label)}</button>`).join("");
    return `<li data-wb-row><span class="wb-name">${esc(e.name)}</span><span class="wb-desc">${esc(e.desc)}</span><span class="wb-actions">${btns}</span></li>`;
  }).join("")}</ul>
</div>`).join("\n");
  return `<section class="sx" id="workbench" aria-labelledby="workbench-h">
<span id="instruments"></span>
<h2 id="workbench-h">Instruments and study tools</h2>
<p>Every generator, instrument, textile loom, plotter, fractal kernel, lettering family, shader bank, synthesizer, and 3D world in this repository consolidated onto one hairline ledger. Filter by medium or mount any engine inline on this stage without leaving The Playground.</p>
<div class="wb-toolbar">
  <label for="wb-filter" class="sr-only">Filter creative engines</label>
  <input id="wb-filter" type="search" placeholder="Filter engines: loom, thread, poster, fractal, fourier, splat, sound..." autocomplete="off">
  <p id="wb-count" class="wb-count" aria-live="polite">${total} creative engines across ${m.workbench.length} disciplines</p>
</div>
<div id="wb-stage" class="wb-stage" hidden>
  <div class="wb-stage-bar">
    <strong id="wb-stage-title">Live stage</strong>
    <span><a id="wb-stage-open" href="/studio.html">Open full window</a> <button type="button" id="wb-stage-close">Close stage</button></span>
  </div>
  <div id="wb-stage-body"></div>
</div>
${groups}
</section>`;
}

function nativeSection() {
  const L = RW.LIVE, M = RW.MEASURED;
  const img = (base, w, h, alt, sizes, lazy) => `<img src="${base}-${w}.webp" srcset="${base}-${w / 2}.webp ${w / 2}w, ${base}-${w}.webp ${w}w" sizes="${sizes}" width="${w}" height="${h}"${lazy ? ' loading="lazy"' : ""} decoding="async" alt="${esc(alt)}">`;
  const mb = (b) => (b ? ` (${(b / 1e6).toFixed(1)} MB)` : "");
  const doors = L.starts.filter((d) => d.alt).map((d, i) => `<li class="lw-door"><figure>${img(`/media/raw-native/live-stills/${d.id === "hall" ? "hall-nave" : d.id}`, 1600, 900, d.alt, i ? "(max-width: 860px) 92vw, 540px" : "(max-width: 860px) 92vw, 1100px", true)}
<figcaption>${esc(d.cap)}</figcaption></figure>
<p class="lw-go" hidden><button type="button" class="toy-btn" data-start="scene=${d.id}" data-bytes="${d.bytes}">${esc(d.go + mb(d.bytes))}</button></p></li>`).join("\n");
  const test = L.starts.find((d) => d.id === "test");
  const rows = M.rows.map(([n, on, off]) => `<tr><th scope="row">${esc(n)}</th><td class="num">${on}</td><td class="num">${off}</td></tr>`).join("");
  return `<section class="sx" id="native" aria-labelledby="native-h">
<h2 id="native-h">Native renderer (RAW DX12 / Vulkan / WebGPU)</h2>
${labelFor("raw-render")}
<p>${esc(RW.INTRO.lede)} Live DirectX 12 Skyrim SE graphics replacement passes 96 of 96 moving-camera checks across four scenes (384 1080p frames, 19 solvers in 1.57 ms, 0 D3D12 errors), with Fallout 4 and Starfield DX12 runtime bridges sharing the same certified shader architecture.</p>
<div class="lw-walk" data-toy="engine" data-live="/media/raw-native/live/index.html">
<ul class="lw-doors">${doors}</ul>
<p class="lw-go" hidden><button type="button" class="toy-btn" data-start="scene=test" data-bytes="0">${esc(test.go)}</button> <span class="rn-aside">${esc(test.cap)}</span></p>
<p class="lp-limit lw-walk-state" aria-live="polite">${esc(L.stateIdle)}</p>
<dialog class="lw-walk-frame" aria-label="The native renderer, live"></dialog>
</div>
<div class="rn-wrap"><table class="rn-table"><caption>Frame RMSE against the path-traced reference (display values 0 to 1, lower is closer).</caption>
<thead><tr><th scope="col">Pass</th><th scope="col" class="num">On</th><th scope="col" class="num">Off</th></tr></thead><tbody>${rows}</tbody></table></div>
<p id="rn-status" class="sx-as" aria-live="polite">Render: ok (CPU certificate verified against superframe commit cac34166; press any scene door above to run WebGPU live).</p>
</section>`;
}

function lowWaterSection() {
  const I = LW.ISLAND, st = LW.STORY;
  const img = (base, w, h, alt, sizes, lazy) => `<img src="${base}-${w}.webp" srcset="${base}-${w / 2}.webp ${w / 2}w, ${base}-${w}.webp ${w}w" sizes="${sizes}" width="${w}" height="${h}"${lazy ? ' loading="lazy"' : ""} decoding="async" alt="${esc(alt)}">`;
  const doors = I.starts.map((d, i) => `<li class="lw-door"><figure>${img(`/media/low-water/walk-${d.id}`, 1600, 900, d.alt, i ? "(max-width: 860px) 92vw, 540px" : "(max-width: 860px) 92vw, 1100px", false)}
<figcaption>${esc(d.cap)}</figcaption></figure>
<p class="lw-go" hidden><button type="button" class="toy-btn" data-start="${esc(d.q)}">${esc(d.go)}</button></p></li>`).join("\n");
  const stills = I.stills.map(([f, place, verdict]) => `<li><figure><img src="/media/low-water/stills/${f}-640.webp" width="640" height="360" loading="lazy" decoding="async" alt="${esc(place)}"><figcaption><b>${esc(place)}</b> <span class="lw-verdict">${esc(verdict)}</span></figcaption></figure></li>`).join("");
  const eras = `<ol class="lw-eras">${LW.ERAS.map(([n, m], i) => `<li><span class="lw-n">${i + 1}</span> <b>${esc(n)}</b> <span class="lp-v">${m} minutes</span></li>`).join("")}</ol>`;
  const keyFigs = LW.SECTIONS.flatMap((s) => s.figs || []).filter((f) => [136, 158].includes(f.pr));
  const subSecs = `<h3>Verified engine milestones</h3><p>${esc(LW.SECTIONS.map((s) => s.title).join(", "))} share the same BuildLang and Superframe core.</p>${figsHtml(keyFigs)}`;
  return `<section class="sx" id="low-water" aria-labelledby="low-water-h">
<div id="island">
<h2 id="low-water-h"><span class="d-3d" data-hue="game">Low Water: walkable island and five-era world</span></h2>
<p>${esc(LW.INTRO.lede)} ${esc(I.lede)}</p>
<div class="lw-walk" data-toy="walk" data-walk="/media/low-water/walk.html" data-world="../media/low-water/world-cac3416/out/20261118" data-bytes="${LW.WALK_BYTES}">
<ul class="lw-doors">${doors}</ul>
<p class="lp-limit lw-walk-state" aria-live="polite">With scripts and WebGPU on, each picture opens onto the island, drawn live. The walk downloads ${(LW.WALK_BYTES / 1e6).toFixed(1)} MB when you press, and nothing before.</p>
<dialog class="lw-walk-frame" aria-label="Walking the island of Low Water"></dialog>
</div>
<figure class="lw-plate"><a href="/media/low-water/plate-20261118-1500.webp">${img("/media/low-water/plate-20261118", 1500, 1183, "The island of Low Water as a hand-lettered, hachured map: a long range down the middle, rivers to the sea, towns joined by roads, every name in an engraver's hand.", "(max-width: 860px) 92vw, 900px", true)}</a>
<figcaption>${esc(I.plateCap)}</figcaption></figure>
<details class="sx-rec"><summary>Fifteen engine stills, read plainly</summary><ul class="lw-stills">${stills}</ul></details>
</div>
<h3 id="story">${esc(st.title)}</h3>
<p>${esc(st.lede)}</p>
${eras}
<figure class="pair" data-toy="pair">
<div class="pair-buttons" role="group" aria-label="Light comparison" hidden><button type="button" class="toy-btn" data-show="0" aria-pressed="true">One lantern</button> <button type="button" class="toy-btn" data-show="1" aria-pressed="false">Even light</button></div>
<div class="pair-frames"><img data-frame="0" src="/media/world/work/dark-field-one-light-1280.webp" srcset="/media/world/work/dark-field-one-light-640.webp 640w, /media/world/work/dark-field-one-light-1280.webp 1280w" sizes="(max-width: 860px) 92vw, 760px" width="1651" height="1032" loading="lazy" decoding="async" alt="Four spheres on grey stone in a near-black field, lit by one small warm lantern.">
<img data-frame="1" src="/media/world/work/dark-field-control-1280.webp" srcset="/media/world/work/dark-field-control-640.webp 640w, /media/world/work/dark-field-control-1280.webp 1280w" sizes="(max-width: 860px) 92vw, 760px" width="1651" height="1032" loading="lazy" decoding="async" alt="The same spheres under an even surround of the same mean light, with no shadow and no dark field."></div>
<figcaption>How the engine lights a world this dark. One lantern: 68.5% of pixels fall below L* 25. Even light of the same mean: none do.</figcaption>
</figure>
${subSecs}
</section>`;
}

function superframeSection() {
  return `<section class="sx" id="superframe" aria-labelledby="superframe-h">
<h2 id="superframe-h"><span class="d-3d" data-hue="theplygrnd">Superframe: one seeded recipe across every medium</span></h2>
<p>Superframe is the deterministic core of The Playground. Describe a piece in plain words and receive it back simultaneously as paint, living type, line drawing, carved relief, sound, and touch pattern from one seed. Fail-closed <code>SHA256SUMS</code> installer (Superframe PR #151): <code>irm https://raw.githubusercontent.com/HarperZ9/superframe/main/install.ps1 | iex</code> (Windows) or <code>curl -fsSL https://raw.githubusercontent.com/HarperZ9/superframe/main/install.sh | sh</code> (macOS/Linux).</p>
<div class="sf-stack" data-stack aria-roledescription="layered readouts">
  <img class="layer base" loading="lazy" src="/media/world/superframe/paint-1920.webp" srcset="/media/world/superframe/paint-960.webp 960w, /media/world/superframe/paint-1280.webp 1280w, /media/world/superframe/paint-1920.webp 1920w" sizes="(max-width: 960px) 100vw, 960px" width="1920" height="1080" decoding="async" alt="Paint: rust coral, indigo ink stain, teal frost star, contour lens, ochre network, and vermilion spray on bone paper.">
  <img class="layer" loading="lazy" data-layer="lines" src="/media/world/superframe/lines-1920.webp" srcset="/media/world/superframe/lines-960.webp 960w, /media/world/superframe/lines-1280.webp 1280w, /media/world/superframe/lines-1920.webp 1920w" sizes="(max-width: 960px) 100vw, 960px" width="1920" height="1080" decoding="async" alt="Lines: the same recipe drawn as contour lines on bone paper." data-x="22" data-y="30">
  <img class="layer" loading="lazy" data-layer="type" src="/media/world/superframe/type-1920.webp" srcset="/media/world/superframe/type-960.webp 960w, /media/world/superframe/type-1280.webp 1280w, /media/world/superframe/type-1920.webp 1920w" sizes="(max-width: 960px) 100vw, 960px" width="1920" height="1080" decoding="async" alt="Type: living letters bent where each material element sits." data-x="75" data-y="28">
  <img class="layer" loading="lazy" data-layer="material" src="/media/world/superframe/material-lit-1920.webp" srcset="/media/world/superframe/material-lit-960.webp 960w, /media/world/superframe/material-lit-1280.webp 1280w, /media/world/superframe/material-lit-1920.webp 1920w" sizes="(max-width: 960px) 100vw, 960px" width="1920" height="1080" decoding="async" alt="Material: the same piece carved as lit grey clay relief." data-x="40" data-y="45">
  <div class="sf-readouts" role="group" aria-label="Superframe readout layer">
    <button type="button" data-show="paint" aria-pressed="true">Paint</button>
    <button type="button" data-show="lines" aria-pressed="false">Lines</button>
    <button type="button" data-show="type" aria-pressed="false">Type</button>
    <button type="button" data-show="material" aria-pressed="false">Material</button>
  </div>
</div>
<p class="sx-as">Open the <a href="/world/superframe/room/index.html">Superframe assistive room</a> or read the source at <a href="https://github.com/HarperZ9/superframe">HarperZ9/superframe</a>.</p>
</section>`;
}

function studioMediaSection() {
  return `<section class="sx" id="studio-media" aria-labelledby="studio-media-h">
<h2 id="studio-media-h">Ecosystem 1080p explainer &amp; Round 2 studio sound</h2>
<p>Opt-in media authored directly from the unified toolchain. Nothing autoplays; every stream starts only on press.</p>
<div class="pg-media-grid">
  <figure style="margin:0">
    <video controls preload="none" poster="/media/overhaul/ecosystem-super-accelerator-solver-1080p-poster.webp" width="1920" height="1080" aria-label="Ecosystem Super-Accelerator Solver 1080p explainer">
      <source src="/media/overhaul/ecosystem-super-accelerator-solver-1080p.mp4" type="video/mp4">
    </video>
    <figcaption class="sx-as">Ecosystem Super-Accelerator Solver (38 s, 1080p, scored over Estuary Rain fusion bed).</figcaption>
  </figure>
  <ul class="pg-audio-list">
    <li>
      <strong>Pacific Horizon (166 BPM Atmospheric DnB + Japanese Jazz-Fusion)</strong>
      <span class="sx-as">44 s, 48 kHz stereo, -16.5 LUFS, -1.87 dBFS true peak, 0 clipped samples.</span>
      <audio controls preload="none" src="/media/overhaul/round2-pacific-horizon-dnb-jazz.mp3"></audio>
    </li>
    <li>
      <strong>Estuary Rain (162 BPM Liquid DnB + Jazz-Fusion Explainer Bed)</strong>
      <span class="sx-as">46 s, 48 kHz stereo, -16.7 LUFS, -2.07 dBFS true peak, 0 clipped samples.</span>
      <audio controls preload="none" src="/media/overhaul/round2-estuary-rain-fusion-bed.mp3"></audio>
    </li>
  </ul>
</div>
<p class="verified"><b>Verified</b> ${esc(CHECKED)}: every engine row mapped from the repository code catalogue; Estuary homology and metamers tested in <code>tests/estuary-*.test.mjs</code>; Round 2 audio verified at 0 clipped samples with Parseval relative error 0.0; Native RAW and Low Water files verified by SHA-256 against superframe commit cac34166.</p>
</section>`;
}

async function build(m) {
  const row = ([href, name]) => `<a href="${href}">${name}</a>`;
  const jumpNav = (m.jump || []).length ? `<nav class="pg-jump" aria-label="Jump across The Playground">${m.jump.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join("")}</nav>` : "";
  const marbledBar = (m.rooms || []).length ? `<section class="sx mx-panel" id="m-marbled" aria-label="Unified marbled surface">
<p class="sx-go"><button type="button" id="sx-marble-all" hidden>Open unified marbled surface</button><span>Marbles blend, type, shaders, sound, field, and estuary together on one shared bus with live temperature, operator, and bio-transducer weights.</span></p>
<div id="mx-host" hidden></div>
</section>` : "";
  const isPlayground = m.id === "playground";
  const body = `<article class="ds lp" data-landmark="playground" data-hue="theplygrnd">
<header class="lp-head">
<h1><span class="d-3d">${esc(m.title)}</span> <span class="pf-mark">THEPLAYGRND</span></h1>
<p class="ds-lede">${m.lede}</p>${m.make ? `\n<p>${m.make}</p>` : ""}
${jumpNav}
</header>
${marbledBar}
${exchange(m)}
${(await Promise.all((m.rooms || []).map((r) => room(m, r)))).join("\n")}
${workbenchSection(m)}
${isPlayground ? nativeSection() : ""}
${isPlayground ? lowWaterSection() : ""}
${isPlayground ? superframeSection() : ""}
${isPlayground ? studioMediaSection() : ""}
<nav class="pg-jump" id="direct-routes" aria-label="${esc(m.placesHeading)}">${m.places.map(row).join("")}</nav>
</article>
<script type="module" src="/world/site/surfaces/surface-start.js"></script>`;
  const extraHead = [
    '<link rel="stylesheet" href="/world/site/distill/distill.css">',
    '<link rel="stylesheet" href="/world/site/surfaces/surface-page.css">',
    ...(isPlayground ? [
      '<script type="module" src="/world/site/explore/engine.js"></script>',
      '<script type="module" src="/world/site/explore/walk.js"></script>',
      '<script type="module" src="/world/site/explore/pair.js"></script>',
    ] : []),
  ].join("\n");
  const jsonld = isPlayground ? {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "VideoObject",
      "name": "Ecosystem Super-Accelerator Solver (1080p)",
      "description": "38-second 1080p explainer covering the unified creative and verification stack, scored over Estuary Rain.",
      "thumbnailUrl": "https://harperz9.github.io/media/overhaul/ecosystem-super-accelerator-solver-1080p-poster.webp",
      "contentUrl": "https://harperz9.github.io/media/overhaul/ecosystem-super-accelerator-solver-1080p.mp4",
      "uploadDate": "2026-11-26",
      "duration": "PT38S",
      "url": "https://harperz9.github.io/playground/",
    }],
  } : null;
  return page({ path: m.file, title: m.title, description: m.description, body, bodyClass: "reading ds-body sx-body", extraHead, jsonld, live: false });
}

const main = (html) => html.slice(html.indexOf('<main id="main"'), html.indexOf("</main>")).replace(/\?v=world-[0-9a-f]+/g, "");
const dir = path.join(site, "site-src/world/surfaces"), check = process.argv.includes("--check"), stale = [];
for (const f of readdirSync(dir).filter((n) => n.endsWith(".mjs")).sort()) {
  const m = (await import(pathToFileURL(path.join(dir, f)).href)).default, html = await build(m), out = path.join(site, m.file);
  if (check) { if (!existsSync(out) || main(readFileSync(out, "utf8")) !== main(html)) stale.push(m.file); }
  else writeFileSync(out, html);
  console.log(`surface ${m.id}: ${m.file}, ${m.exchange.modules.length} modules on the press, ${m.exchange.press.length} heavy, ${(m.rooms || []).length} rooms`);
}
if (stale.length) { console.error(`stale: ${stale.join(", ")}; run node scripts/build-surfaces.mjs, then the revision stamp`); process.exit(1); }
