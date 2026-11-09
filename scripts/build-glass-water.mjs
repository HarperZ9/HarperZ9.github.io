#!/usr/bin/env node
// Build glass-water.html: glass lettering over live water, a place of its own in the world (world/site/glass-water.js).
// The page is the field; its words and its four spaces sit inside it with no panels or frames.
//
//   node scripts/build-glass-water.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "./studies-shell.mjs";
import { PLATES as PLATE_SVG } from "./marks/plates.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// two stills from the crossover renderer (world/site/crossover/, masters by tools/crossover/render.mjs), shown
// below the live field; the numbers in the captions come from tools/crossover/overprint_model.py
const PLATES = [
  ["overprint-day", "Five inks of an Olivetti print laid down as sheets of tinted glass: a red quarter disc, a cyan wedge, a yellow disc, a green bar and a black bar crossing on warm paper, with a clear lens carrying a soap film over the black.",
    "Overprint glass. The five inks of an Olivetti print, each recovered as a spectrum and laid down as a thin sheet of tinted glass. Where two sheets cross, light passes through both, so the mixed colour is computed wavelength by wavelength. Against five overlaps measured on the print the computed colours miss by 13 CIEDE2000 on average, against 15 for a plain multiply; green over red misses most, by 29. The sheets bend what lies beneath at their rims and cast coloured shadows, and the clear lens carries a soap film draining under gravity, its bands in Newton's order."],
  ["mie-night", "Rows of glowing shapes on black, each the scattering pattern of a water droplet: round on the left, pushing forward and splitting into petals on the right.",
    "Scattering lobes. Water droplets lit from the left, each drawn as the pattern of light it scatters by angle, from Lorenz-Mie theory, on a log scale over four decades. Small drops scatter almost evenly and draw a circle; as they grow the light pushes forward and the pattern splits into petals. Each wavelength draws its own outline, so the colour at an edge is one drop seen across the spectrum."],
];
// three colour studies drawn as SVG from the computed palette (scripts/marks/plates.mjs, written by
// scripts/build-marks.mjs); small files, so they need no sizes, and the film plays once when it loads
const STUDIES = [
  ["overprint-race", "Where two inks cross. Five overlaps measured on an Olivetti print, each shown between two predictions: per-channel multiply above the print's own colour, the Clapper-Yule model below it. Both models were fitted on single inks only. Against the print, the median CIEDE2000 is 9.8 for multiply, 9.3 for Beer-Lambert and 7.8 for Clapper-Yule, which clears the 1.0 margin set before the race, so Clapper-Yule now colours every overlap in the site's drawn marks. Five overlaps is a small sample, the inks are recovered from a scan rather than measured with a spectrophotometer, and green over red stays far off for every model."],
  ["colour-keyboard", "The colour keyboard, woven. Seven keys after Le Corbusier's Polychromie, grouped by what they do in space: sky and mist recede, sand and straw hold, land and leaf advance, velvet encloses. Each key mixes the five measured inks; each crossing is the colour the two films pass together, computed per wavelength. These are the inks of the marks on the index."],
  ["film-drainage", "A soap film draining (motion study). A vertical film thins from the top as it drains, h = sqrt(mu x / (rho g t)), and Newton's interference colours slide down it. Left, seen head-on; right, the same film at 45 degrees, where each band moves toward the colours of a thinner film. The colour is the Airy reflectance of a film of index 1.38 under daylight. It plays once, from a quarter hour to eight hours of drainage; with reduced motion it shows the last frame."],
];
// the plates load only as the reader scrolls toward them;
// without scripts, the noscript copy loads as usual
const pic = (n, alt, lazy) => {
  const set = (ext) => [1280, 1920, 3840].map((w) => `/media/world/crossover/${n}-${w}.${ext} ${w}w`).join(", ");
  const a = lazy ? "data-srcset" : "srcset";
  return `<picture><source type="image/avif" ${a}="${set("avif")}" sizes="100vw"><img ${lazy ? "data-src" : "src"}="/media/world/crossover/${n}-1920.webp" ${a}="${set("webp")}" sizes="100vw" width="3840" height="2160" alt="${alt}" decoding="async"${lazy ? "" : ' loading="lazy"'}></picture>`;
};
const plates = () => `<div class="gw-plates">${PLATES.map(([n, alt, cap]) => `<figure class="gw-plate">${pic(n, alt, true)}<noscript>${pic(n, alt, false)}</noscript><figcaption>${cap}</figcaption></figure>`).join("")}${STUDIES.map(([n, cap]) => `<figure class="gw-plate gw-study"><img data-src="/media/world/plates/${n}.svg" width="1600" height="900" alt="${PLATE_SVG[n].alt}" decoding="async"><noscript><img src="/media/world/plates/${n}.svg" width="1600" height="900" alt="${PLATE_SVG[n].alt}" loading="lazy"></noscript><figcaption>${cap}</figcaption></figure>`).join("")}</div>
<script>(function () {
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (!e.isIntersecting) return; io.unobserve(e.target);
    e.target.querySelectorAll("[data-srcset]").forEach(function (s) { s.srcset = s.dataset.srcset; });
    var i = e.target.querySelector("img[data-src]"); if (i) i.src = i.dataset.src; }); }, { rootMargin: "300px 0px" });
  // watching starts at the reader's first scroll, so a first screen never pays for the plates below it
  addEventListener("scroll", function () { document.querySelectorAll(".gw-plate").forEach(function (f) { io.observe(f); }); }, { once: true, passive: true });
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
