// work-index.mjs: the index of all the work, rendered into floor.html from site-src/world/work-index.json (written
// from the work inventory by its own tool; public fields only). Platform order, then newest first; past work stays
// in, labelled with its years. Lead media (the raw-native showcase renders and the One Step films, from their 4K
// masters) sit in their own rows; every other row is plain text, because a blurry card says less than a line.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./studies-markdown.mjs";
import { markImg } from "./crossover-marks.mjs";
import { TOOLS } from "../world/site/crossover/tool-marks.js";

// each tool's drawn mark, a cell of one sprite (media/world/marks/tools.*, from tools/crossover/encode_tools.py, ten
// cells to a row in TOOLS order); decoration beside a row whose words already say what the tool does
const TOOL_IDS = Object.keys(TOOLS), TM_COLS = 10, TM_ROWS = Math.ceil(TOOL_IDS.length / TM_COLS);
// held from the page after pass 13's blind pairwise (won Commons 7-6, lost or tied elsewhere); the joint review decides
const SHOW_TOOL_MARKS = false;
function toolMark(id) {
  if (!SHOW_TOOL_MARKS) return "";
  const n = TOOL_IDS.indexOf(id); if (n < 0) return "";
  const x = (n % TM_COLS) / (TM_COLS - 1) * 100, y = Math.floor(n / TM_COLS) / Math.max(TM_ROWS - 1, 1) * 100;
  return `<span class="wi-tm" aria-hidden="true" style="--tx:${+x.toFixed(3)}%;--ty:${+y.toFixed(3)}%"></span>`;
}

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PLATFORMS = [
  ["THEFLYWHEEL", "THE FLYWHEEL"], ["THECMMNS", "THE COMMONS"], ["THEPLYGRND", "THE PLAYGROUND"], ["ARTIQL8", "ARTICULATE"],
  ["BLDLNG", "BUILDLANG"], ["RSRCH", "RESEARCH"], ["unassigned", "Other work"], ["past", "Before the platforms"],
];
const STATE = { released: "released", "release candidate": "release candidate", "source only": "source only", "in progress": "in progress", paused: "paused", archived: "archived", retired: "retired", "controlled private": "private practice" };
// the lead media: stills from the raw-native engine and films from their 4K masters, web encodes in media/work/
const MEDIA = {
  "engine-showcase": [
    { still: "raw-hall-nave-v2", cap: "Colonnade, path-traced", alt: "A long hall of fluted columns and arches under hanging lamps, path-traced in raw-native." },
    { still: "material-gallery", cap: "Material gallery", alt: "Seven rows of spheres, each row one material from gold to frosted glass, under one sky." },
    { still: "retro-room-pathtraced", cap: "Retro room, path-traced", alt: "A brick room with tiled floor, square pillars and a figure under a ceiling light, path-traced." },
    { film: "retro-room-dolly", cap: "Retro room, a dolly (film)", alt: "The camera dollies through the brick room." },
    { still: "threads-dome", cap: "Threads dome", alt: "Copper threads arcing into a dome on black." },
    { film: "threads-bloom", cap: "Threads bloom (film)", alt: "A field of threads blooming into a cellular flower." },
  ],
  "one-step-films": [
    { film: "one-step", cap: "One Step (film, with sound)", alt: "One Step: a sphere of points where each new position draws lines to all that came before it.", sound: true },
    { film: "cathedral", cap: "Cathedral study (film)", alt: "A study flying down a Menger-sponge nave." },
    { film: "droste", cap: "Droste study (film)", alt: "A study spiralling into a Droste tiling." },
  ],
};
// the author approved this purpose for RESEARCH on 2026-11-02 ("yes, all of these concepts")
const PURPOSE = { RSRCH: "The study of mechanisms, interactions, relationships and patterns across nature, technology, humanity and the hypothetical, in physical and digital space, in every state." };
const LENS_NOTE = { "lens-room": "No still yet." };

function media(id) {
  const m = MEDIA[id]; if (!m) return "";
  // no tiles: each piece floats in the field with feathered edges, at its own size and height, so the row reads as
  // things seen through water rather than a grid of boxes. A film shows its poster and one quiet form that plays it.
  return `<ul class="wi-media" role="list">${m.map((x) => x.still
    ? `<li class="wi-drift"><picture><source type="image/avif" srcset="media/work/${x.still}-960.avif 960w, media/work/${x.still}-1920.avif 1920w" sizes="(max-width: 860px) 92vw, 60vw"><img src="media/work/${x.still}-960.webp" srcset="media/work/${x.still}-960.webp 960w, media/work/${x.still}-1920.webp 1920w" sizes="(max-width: 860px) 92vw, 60vw" width="960" height="540" alt="${esc(x.alt)}" loading="lazy" decoding="async"></picture><span class="wi-cap">${esc(x.cap)}</span></li>`
    : `<li class="wi-drift wi-film"><video${x.sound ? "" : " muted"} playsinline preload="none" data-poster="media/work/${x.film}-poster-960.webp" width="1920" height="1080" aria-label="${esc(x.alt)}"><source src="media/work/${x.film}-1080.mp4" type="video/mp4"></video><button type="button" class="wi-play" aria-label="Play the film: ${esc(x.alt)}${x.sound ? " With sound." : ""}" data-alt="${esc(x.alt)}"><span class="wi-play-form" aria-hidden="true"></span><span class="wi-play-word" aria-hidden="true">Play</span></button><span class="wi-play-time" aria-hidden="true"></span><span class="wi-cap">${esc(x.cap)}</span></li>`).join("")}</ul>`;
}
// a page's destination, following a redirect stub to its target; null when the file is not in the site
function resolve(p) {
  for (let hop = 0; hop < 4; hop++) {
    const f = path.join(site, p); if (!existsSync(f)) return null;
    const m = readFileSync(f, "utf8").match(/http-equiv="refresh" content="0; url=([^"]+)"/);
    if (!m) return p === "floor.html" ? null : p;  // a link back to this index is no link
    p = m[1].replace(/^\//, "").split("#")[0] || "index.html";
  }
  return null;
}
function pageLabel(p, i, many = false, first = null) {
  if (p.startsWith("repo-explainers/")) return "Explainer";
  if (/(^|\/)demo-/.test(p)) { const n = p.replace(/^.*demo-|\.html$/g, ""); return i === 0 && !many ? "Demo" : `${n.charAt(0).toUpperCase() + n.slice(1)} demo`; }
  if (i === 0) return "Page";
  const t = (readFileSync(path.join(site, p), "utf8").match(/<title>([^<]*)<\/title>/) || [, ""])[1]
    .replace(/&middot;|&#x27;|&amp;/g, (e) => ({ "&middot;": "·", "&#x27;": "'", "&amp;": "&" }[e]))
    .split(/\s[·|]\s|:\s/)[0].trim();
  const file = p.replace(/(\/index)?\.html$/, "").split("/").pop().replace(/-/g, " ");
  const short = (q) => (readFileSync(path.join(site, q), "utf8").match(/<title>([^<]*)<\/title>/) || [, ""])[1].split(/\s[·|&]|:\s/)[0].trim();
  const clash = first && short(first).toLowerCase().startsWith(t.toLowerCase());
  if (clash) { const full = (readFileSync(path.join(site, p), "utf8").match(/<title>([^<]*)<\/title>/) || [, ""])[1].split(/\s·\s/)[0], rest = full.split(/:\s/)[1]; if (rest && rest.length <= 40) return rest.trim(); }
  return t && t.length <= 40 && !clash ? t : file.charAt(0).toUpperCase() + file.slice(1);
}
function row(r) {
  const when = r.date ? new Date(r.date + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : r.years || "";
  const status = [STATE[r.state] || r.state, r.version, when].filter(Boolean).join(", ");
  // each link is named by where it goes: the product page, its animated explainer, its demo, or the target's own
  // short title; a redirect stub resolves to its target, and a link already listed is dropped
  const seen = new Set(), targets = [];
  for (const p0 of r.pages || []) {
    const p = resolve(p0.replace(/^\//, "")); if (!p || seen.has(p)) continue; seen.add(p); targets.push(p);
    if (targets.length === 2) break;
  }
  const many = targets.filter((p) => /(^|\/)demo-/.test(p)).length > 1;
  const pages = targets.map((p, i) => [`/${p}`, pageLabel(p, i, many, i ? targets[0] : null)]);
  const links = [...pages, r.repo ? [r.repo, "Source"] : null, r.release ? [r.release, "Release"] : null,
    ...(r.packages || []).slice(0, 1).map((p) => [p.url, p.registry])].filter(Boolean);
  return `<li class="wi-row" id="w-${esc(r.id)}" data-state="${esc(r.state || "")}">
  <p class="wi-head">${toolMark(r.id)}<b>${esc(r.name)}</b> <span class="wi-status">${esc(status)}</span></p>
  ${r.summary ? `<p class="wi-sum">${esc(r.summary)}${r.note ? ` <em>${esc(r.note)}</em>` : ""}${LENS_NOTE[r.id] ? ` ${esc(LENS_NOTE[r.id])}` : ""}</p>` : ""}
  ${media(r.id)}
  ${links.length ? `<p class="wi-links">${links.map(([h, t]) => `<a href="${esc(h)}">${esc(t)}</a>`).join("")}</p>` : ""}
</li>`;
}
export function workIndex() {
  const data = JSON.parse(readFileSync(path.join(site, "site-src/world/work-index.json"), "utf8"));
  const by = new Map(PLATFORMS.map(([k]) => [k, []]));
  for (const r of data.entries) if (by.has(r.platform)) by.get(r.platform).push(r);
  const key = (r) => r.date || (r.years ? String(r.years).slice(-4) + "-00-00" : "0000");
  const FIRST = 3;  // rows in the first screen's HTML; the rest arrive from a template once the page is idle
  let firstDone = false, head = "", more = "";
  for (const [k, name] of PLATFORMS) {
    const rows = by.get(k).sort((a, b) => {
      const ea = ["archived", "retired"].includes(a.state), eb = ["archived", "retired"].includes(b.state);
      return ea !== eb ? (ea ? 1 : -1) : (MEDIA[b.id] ? 1 : 0) - (MEDIA[a.id] ? 1 : 0) || key(b).localeCompare(key(a));
    });
    if (!rows.length) continue;
    const id = k.toLowerCase();
    const mark = k === k.toUpperCase() && !["unassigned", "past"].includes(k) ? ` <span class="wi-mark">${esc(k)}</span>` : "";
    const purpose = PURPOSE[k] ? `<p class="wi-purpose">${esc(PURPOSE[k])}</p>` : "";
    const open = `<section class="wi-plat" id="${esc(id)}" aria-labelledby="h-${esc(id)}">${markImg(k)}<h2 id="h-${esc(id)}">${esc(name)}${mark}</h2>${purpose}<ol class="wi-list"`;
    if (!firstDone) {
      firstDone = true;
      head = `${open} id="wi-first">${rows.slice(0, FIRST).map(row).join("\n")}</ol></section>`;
      more += `<ol id="wi-first-more">${rows.slice(FIRST).map(row).join("\n")}</ol>\n`;
    } else more += `${open}>${rows.map(row).join("\n")}</ol></section>\n`;
  }
  // the rest of the index lives in its own fragment file, fetched once the page is idle, on the first scroll, or at
  // once when a link or the address points into it; with scripts off, a link opens the fragment itself
  const REST = "/world/site/floor-rows.htm";
  const hydrate = `<div id="wi-rest"></div>
<noscript><p class="wi-lead">With scripts off, this index shows its first rows. <a href="${REST}">The full index</a> opens as plain text.</p></noscript>
<script>(function () {
  var p = null;
  function go(then) {
    p = p || fetch("${REST}").then(function (r) { if (!r.ok) throw new Error("index rows: HTTP " + r.status); return r.text(); }).then(function (t) {
      var d = document.createElement("template"); d.innerHTML = t;
      var a = d.content.getElementById("wi-first-more"), b = document.getElementById("wi-rest");
      document.getElementById("wi-first").append.apply(document.getElementById("wi-first"), [].slice.call(a.children)); a.remove();
      b.replaceWith(d.content);
      document.dispatchEvent(new Event("wi:ready"));
    }).catch(function (e) { console.error("work index: the rest of the rows did not load", e); });
    if (typeof then === "function") p.then(then);
  }
  function jump() { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  if (location.hash && !document.getElementById(location.hash.slice(1))) go(jump);
  document.addEventListener("click", function (e) { var l = e.target.closest && e.target.closest('a[href^="#"]'); if (l && !document.getElementById(l.getAttribute("href").slice(1))) { e.preventDefault(); history.pushState(null, "", l.getAttribute("href")); go(jump); } }, true);
  addEventListener("scroll", go, { once: true, passive: true });
  // a second after load, so the fetch never sits in front of the first screen's paint; a scroll starts it sooner
  addEventListener("load", function () { setTimeout(function () { if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 1500 }); else go(); }, 1000); });
})();</script>`;
  // a film's poster loads only as its row nears the screen; the play form starts and pauses it, and names what it does
  const lazy = `<script type="module">const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.poster = e.target.dataset.poster; io.unobserve(e.target); } }, { rootMargin: "60% 0px" });
const say = (v) => { const li = v.closest(".wi-film"), b = li.querySelector(".wi-play"), on = !v.paused && !v.ended;
  li.toggleAttribute("data-on", on); b.setAttribute("aria-label", (on ? "Pause the film: " : "Play the film: ") + b.dataset.alt);
  b.querySelector(".wi-play-word").textContent = on ? "Pause" : v.ended ? "Again" : "Play"; };
const tick = (v) => { const t = v.closest(".wi-film").querySelector(".wi-play-time"); if (v.duration) t.style.setProperty("--t", (v.currentTime / v.duration).toFixed(4)); };
const wire = (v) => { if (v.dataset.wired) return; v.dataset.wired = "1";
  for (const ev of ["play", "pause", "ended"]) v.addEventListener(ev, () => say(v));
  v.addEventListener("timeupdate", () => tick(v));
  v.addEventListener("error", () => console.error("work index: a film did not load", v.currentSrc || v.dataset.poster));
  const go = () => { if (v.paused || v.ended) v.play().catch((e) => console.error("work index: the film did not play", e)); else v.pause(); };
  v.closest(".wi-film").querySelector(".wi-play").addEventListener("click", go); v.addEventListener("click", go); };
const watch = () => { for (const v of document.querySelectorAll("video[data-poster]:not([poster])")) io.observe(v); for (const v of document.querySelectorAll(".wi-film video")) wire(v); };
watch(); document.addEventListener("wi:ready", watch);</script>`;
  return { html: lazy + `<nav class="wi-jump" aria-label="Platforms">${PLATFORMS.map(([k, n]) => `<a href="#${k.toLowerCase()}">${esc(n)}</a>`).join("")}</nav>
${head}
${hydrate}`, rest: `<!-- the rows of the index of the work below its first screen; floor.html loads this file -->\n${more}`, restPath: REST.slice(1), count:data.entries.filter((r) => by.has(r.platform)).length };
}
