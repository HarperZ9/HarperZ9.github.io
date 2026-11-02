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
<script type="module" src="/world/site/glass-water.js"></script>`;
const description = "Glass lettering over live water in four spaces, rendered in the browser: close to the glass, a low sun, noon from above, and night.";
writeFileSync(path.join(site, "glass-water.html"), page({ path: "glass-water.html", title: "Glass and water", description, body, bodyClass: "gw-body", backdrop: false, extraHead: '<link rel="stylesheet" href="/world/site/glass-water.css">' }));
console.log("glass-water.html: 4 spaces");
