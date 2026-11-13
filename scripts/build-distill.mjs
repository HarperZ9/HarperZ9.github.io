#!/usr/bin/env node
// Build the Playground's front page and Distill (world/site/distill/): a page that takes any file, archive or
// folder apart in the reader's browser and shows what it is made of.
//
//   node scripts/build-distill.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "./studies-shell.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const KEY = [["header", "Header or signature"], ["chunk", "Named block"], ["table", "Index or table"], ["data", "Packed or raw data"], ["file", "File inside"], ["section", "Section of text"], ["gap", "Not accounted for"]];
const READS = "PNG, JPEG, GIF, WebP, WAV, AVI, MP4, MOV, HEIC, AVIF, FLAC, MP3 tags, TrueType and OpenType fonts, ZIP (and the Word, Excel, PowerPoint, EPUB and Java files built on it), gzip, tar, PDF, WebAssembly, SQLite, Windows and ELF programs, JSON, HTML, SVG, XML, Markdown, tables in text, and plain text";

const distill = `<article class="ds" data-distill>
<h1>Distill</h1>
<p class="ds-lede">Distill is one of the study tools in <a href="/playground/">The Playground</a>. Give it a file, an archive or a whole folder. Distill takes it apart and shows what it is made of: every part, where it sits, how large it is, and how much of the file the parts account for.</p>
<div class="ds-drop">
<p>Drop files or a folder here, or choose them. Everything is read in this tab. Nothing is uploaded, and nothing in a file is run.</p>
<div class="ds-pick">
<label>Choose files<input id="ds-files" type="file" multiple></label>
<label>Choose a folder<input id="ds-folder" type="file" webkitdirectory></label>
</div>
</div>
<p class="ds-status" role="status" aria-live="polite"></p>
<div class="ds-out"></div>
<section class="ds-how" aria-labelledby="ds-how-h">
<h2 id="ds-how-h">How to read a report</h2>
<p>The strip is the file from its first byte to its last. Each part is drawn at its place and width, with a colour and a mark for its kind. The grey bars under it show how dense the bytes are along the file: low for text and tables, full height for packed data.</p>
<ul class="ds-key">${KEY.map(([k, label]) => `<li><canvas data-kind="${k}" aria-hidden="true"></canvas>${label}</li>`).join("")}</ul>
<p>The format is read from the bytes, so a renamed file is still named for what it is. An archive is opened, and each file inside gets its own report, archives inside archives included. A folder gets one root hash for its bytes and names together, and files that repeat byte for byte are listed.</p>
<p>The same bytes always give the same report. Save it as JSON to keep it or to compare two files later.</p>
<h2>What it reads today</h2>
<p>${READS}. Anything else still gets its size, hash and density, and is named as not recognised.</p>
<p>Not yet: WebM and Matroska film, Ogg sound, RAR and 7z archives, and the pixels or samples inside media files. Encrypted archive entries are listed and left closed.</p>
</section>
</article>
<script type="module" src="/world/site/distill/page.js"></script>`;

const PARTS = [
  ["/raw.html", "The native renderer", "Renders frames in C++ on Direct3D 12, Vulkan and WebGPU, and checks each one against a reference. Released as raw-native."],
  ["/superframe.html", "Superframe, the core", "One seeded recipe rendered as picture, line, surface, type and sound."],
  ["/low-water.html", "Low Water", "The game made with The Playground."],
];
const PLACES = [
  ["/playground/distill.html", "Distill", "Take any file, archive or folder apart and read what it is made of."],
  ["/studio.html", "The Studio", "A live media instrument for picture and sound."],
  ["/elements.html", "Elements", "Pigment, water, glass and paper on one bench, with state changes."],
  ["/glass-water.html", "Glass and water", "Glass lettering over a live sea in four spaces."],
  ["/world/sound/sound.html", "Sound", "Instruments and scores made in the browser."],
  ["/swatches.html", "Swatches", "Colour as measured material."],
  ["/accession.html", "Accession", "The type family and its living forms."],
];
const hub = `<article class="ds">
<h1>The Playground</h1>
<p class="ds-lede">The Playground is a rendering engine that turns one description into picture, type and sound. It has four parts: the <a href="/raw.html">native renderer</a>, <a href="/superframe.html">Superframe</a> at the core, the <a href="#instruments">instruments and study tools</a>, and <a href="/low-water.html">Low Water</a>, the game made with it.</p>
<ul class="pg-list">${PARTS.map(([href, name, say]) => `<li><a href="${href}">${name}</a><p>${say}</p></li>`).join("")}</ul>
<h2 id="instruments">Instruments and study tools</h2>
<ul class="pg-list">${PLACES.map(([href, name, say]) => `<li><a href="${href}">${name}</a><p>${say}</p></li>`).join("")}</ul>
</article>`;

mkdirSync(path.join(site, "playground"), { recursive: true });
const head = '<link rel="stylesheet" href="/world/site/distill/distill.css">';
writeFileSync(path.join(site, "playground/distill.html"), page({ path: "playground/distill.html", title: "Distill", description: "Take any file, archive or folder apart in your browser: every part, where it sits, and how much of the file the parts account for. Nothing is uploaded.", body: distill, bodyClass: "reading ds-body", extraHead: head }));
writeFileSync(path.join(site, "playground/index.html"), page({ path: "playground/index.html", title: "The Playground", description: "The Playground is a rendering engine that turns one description into picture, type and sound: the native renderer, Superframe, the instruments and study tools, and Low Water.", body: hub, bodyClass: "reading ds-body", extraHead: head }));
console.log(`playground: 2 pages, ${PARTS.length + PLACES.length} places`);
