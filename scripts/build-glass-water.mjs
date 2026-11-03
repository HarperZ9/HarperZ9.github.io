#!/usr/bin/env node
// Build glass-water.html: glass lettering over live water, a place of its own in the world (world/site/glass-water.js).
// The page is the field; its words and its four spaces sit inside it with no panels or frames.
//
//   node scripts/build-glass-water.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "./studies-shell.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// two stills from the crossover renderer (world/site/crossover/, masters by tools/crossover/render.mjs), shown
// below the live field; the numbers in the captions come from tools/crossover/overprint_model.py
const PLATES = [
  ["overprint-day", "Five inks of an Olivetti print laid down as sheets of tinted glass: a red quarter disc, a cyan wedge, a yellow disc, a green bar and a black bar crossing on warm paper, with a clear lens carrying a soap film over the black.",
    "Overprint glass. The five inks of an Olivetti print, each recovered as a spectrum and laid down as a thin sheet of tinted glass. Where two sheets cross, light passes through both, so the mixed colour is computed wavelength by wavelength. Against five overlaps measured on the print the computed colours miss by 13 CIEDE2000 on average, against 15 for a plain multiply; green over red misses most, by 29. The sheets bend what lies beneath at their rims and cast coloured shadows, and the clear lens carries a soap film draining under gravity, its bands in Newton's order."],
  ["mie-night", "Rows of glowing shapes on black, each the scattering pattern of a water droplet: round on the left, pushing forward and splitting into petals on the right.",
    "Scattering lobes. Water droplets lit from the left, each drawn as the pattern of light it scatters by angle, from Lorenz-Mie theory, on a log scale over four decades. Small drops scatter almost evenly and draw a circle; as they grow the light pushes forward and the pattern splits into petals. Each wavelength draws its own outline, so the colour at an edge is one drop seen across the spectrum."],
];
// the plates load only as the reader nears them (a narrow margin, so a phone's first screen never fetches them);
// without scripts, the noscript copy loads as usual
const pic = (n, alt, lazy) => {
  const set = (ext) => [1280, 1920, 3840].map((w) => `/media/world/crossover/${n}-${w}.${ext} ${w}w`).join(", ");
  const a = lazy ? "data-srcset" : "srcset";
  return `<picture><source type="image/avif" ${a}="${set("avif")}" sizes="100vw"><img ${lazy ? "data-src" : "src"}="/media/world/crossover/${n}-1920.webp" ${a}="${set("webp")}" sizes="100vw" width="3840" height="2160" alt="${alt}" decoding="async"${lazy ? "" : ' loading="lazy"'}></picture>`;
};
const plates = () => `<div class="gw-plates">${PLATES.map(([n, alt, cap]) => `<figure class="gw-plate">${pic(n, alt, true)}<noscript>${pic(n, alt, false)}</noscript><figcaption>${cap}</figcaption></figure>`).join("")}</div>
<script>(function () {
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (!e.isIntersecting) return; io.unobserve(e.target);
    e.target.querySelectorAll("[data-srcset]").forEach(function (s) { s.srcset = s.dataset.srcset; });
    var i = e.target.querySelector("img[data-src]"); if (i) i.src = i.dataset.src; }); }, { rootMargin: "300px 0px" });
  document.querySelectorAll(".gw-plate").forEach(function (f) { io.observe(f); });
})();</script>`;
const SPACES = [["close", "Close to the glass"], ["low-sun", "Low sun"], ["noon", "Noon, from above"], ["night", "Night"]];
const body = `<section class="gw" data-glass-water aria-labelledby="gw-h">
<canvas class="gw-field" role="img" aria-label="Glass letters over moving water"></canvas>
<div class="gw-words">
<h1 id="gw-h">Glass and water</h1>
<p class="gw-say" aria-live="polite"></p>
<nav class="gw-spaces" aria-label="Spaces">${SPACES.map(([id, label]) => `<button type="button" data-space="${id}" aria-pressed="false">${label}</button>`).join("")}</nav>
<p class="gw-how">Rendered live in your browser from measured physics: a sky that scatters sunlight through air, haze and ozone, a sea built from a measured wave spectrum, and letters of optical glass that bend blue light more than red. With reduced motion each space is one still.</p>
</div>
</section>
${plates()}
<script type="module" src="/world/site/glass-water.js"></script>`;
const description = "Glass lettering over live water in four spaces, rendered in the browser: close to the glass, a low sun, noon from above, and night.";
writeFileSync(path.join(site, "glass-water.html"), page({ path: "glass-water.html", title: "Glass and water", description, body, bodyClass: "gw-body", backdrop: false, extraHead: '<link rel="stylesheet" href="/world/site/glass-water.css">' }));
console.log("glass-water.html: 4 spaces");
