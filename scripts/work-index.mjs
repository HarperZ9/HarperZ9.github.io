// work-index.mjs: the index of all the work, rendered into floor.html from site-src/world/work-index.json (written
// from the work inventory by its own tool; public fields only). Platform order, then newest first; past work stays
// in, labelled with its years. Lead media (the raw-native showcase renders and the One Step films, from their 4K
// masters) sit in their own rows; every other row is plain text, because a blurry card says less than a line.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./studies-markdown.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PLATFORMS = [
  ["THEFLYWHEEL", "THE FLYWHEEL"], ["THECMMNS", "THE COMMONS"], ["THEPLYGRND", "THE PLAYGROUND"], ["ARTIQL8", "ARTICULATE"],
  ["BLDLNG", "BUILDLANG"], ["RSRCH", "RESEARCH"], ["unassigned", "Other work"], ["past", "Before the platforms"],
];
const STATE = { released: "released", "release candidate": "release candidate", "source only": "source only", "in progress": "in progress", paused: "paused", archived: "archived", retired: "retired", "controlled private": "private practice" };
// the lead media: stills from the raw-native engine and films from their 4K masters, web encodes in media/work/
const MEDIA = {
  "engine-showcase": [
    { still: "raw-hall-nave-v2", alt: "A long hall of fluted columns and arches under hanging lamps, path-traced in raw-native." },
    { still: "material-gallery", alt: "Seven rows of spheres, each row one material from gold to frosted glass, under one sky." },
    { still: "retro-room-pathtraced", alt: "A brick room with tiled floor, square pillars and a figure under a ceiling light, path-traced." },
    { film: "retro-room-dolly", alt: "The camera dollies through the brick room." },
    { still: "threads-dome", alt: "Copper threads arcing into a dome on black." },
    { film: "threads-bloom", alt: "A field of threads blooming into a cellular flower." },
  ],
  "one-step-films": [
    { film: "one-step", alt: "One Step: a sphere of points where each new position draws lines to all that came before it.", sound: true },
    { film: "cathedral", alt: "A study flying down a Menger-sponge nave." },
    { film: "droste", alt: "A study spiralling into a Droste tiling." },
  ],
};
const LENS_NOTE = { "lens-room": "No still yet." };

function media(id) {
  const m = MEDIA[id]; if (!m) return "";
  return `<ul class="wi-media">${m.map((x) => x.still
    ? `<li><picture><source type="image/avif" srcset="media/work/${x.still}-960.avif 960w, media/work/${x.still}-1920.avif 1920w" sizes="(max-width: 860px) 92vw, 30vw"><img src="media/work/${x.still}-960.webp" srcset="media/work/${x.still}-960.webp 960w, media/work/${x.still}-1920.webp 1920w" sizes="(max-width: 860px) 92vw, 30vw" width="960" height="540" alt="${esc(x.alt)}" loading="lazy" decoding="async"></picture></li>`
    : `<li><video controls${x.sound ? "" : " muted"} playsinline preload="none" data-poster="media/work/${x.film}-poster-960.webp" width="1920" height="1080" aria-label="${esc(x.alt)}"><source src="media/work/${x.film}-1080.mp4" type="video/mp4"></video></li>`).join("")}</ul>`;
}
function row(r) {
  const when = r.date ? new Date(r.date + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : r.years || "";
  const status = [STATE[r.state] || r.state, r.version, when].filter(Boolean).join(", ");
  const links = [...(r.pages || []).filter((p) => existsSync(path.join(site, p.replace(/^\//, "")))).slice(0, 2).map((p) => [`/${p.replace(/^\//, "")}`, /(^|\/)demo-/.test(p) ? "Demo" : "Page"]), r.repo ? [r.repo, "Source"] : null, r.release ? [r.release, "Release"] : null,
    ...(r.packages || []).slice(0, 1).map((p) => [p.url, p.registry])].filter(Boolean);
  return `<li class="wi-row" id="w-${esc(r.id)}" data-state="${esc(r.state || "")}">
  <p class="wi-head"><b>${esc(r.name)}</b> <span class="wi-status">${esc(status)}</span></p>
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
  const sections = PLATFORMS.map(([k, name]) => {
    const rows = by.get(k).sort((a, b) => {
      const ea = ["archived", "retired"].includes(a.state), eb = ["archived", "retired"].includes(b.state);
      return ea !== eb ? (ea ? 1 : -1) : (MEDIA[b.id] ? 1 : 0) - (MEDIA[a.id] ? 1 : 0) || key(b).localeCompare(key(a));
    });
    if (!rows.length) return "";
    const mark = k === k.toUpperCase() && !["unassigned", "past"].includes(k) ? ` <span class="wi-mark">${esc(k)}</span>` : "";
    return `<section class="wi-plat" id="${esc(k.toLowerCase())}" aria-labelledby="h-${esc(k.toLowerCase())}"><h2 id="h-${esc(k.toLowerCase())}">${esc(name)}${mark}</h2><ol class="wi-list">${rows.map(row).join("\n")}</ol></section>`;
  }).join("\n");
  // a film's poster loads only as its row nears the screen
  const lazy = `<script type="module">const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.poster = e.target.dataset.poster; io.unobserve(e.target); } }, { rootMargin: "60% 0px" });
for (const v of document.querySelectorAll("video[data-poster]")) io.observe(v);</script>`;
  return { html: lazy + `<nav class="wi-jump" aria-label="Platforms">${PLATFORMS.map(([k, n]) => `<a href="#${k.toLowerCase()}">${esc(n)}</a>`).join("")}</nav>\n${sections}`, count: data.entries.filter((r) => by.has(r.platform)).length };
}
