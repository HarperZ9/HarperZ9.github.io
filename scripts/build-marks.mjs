#!/usr/bin/env node
// Write the drawn marks and the colour studies as standalone SVG files, from code (scripts/marks/).
//
//   node scripts/build-marks.mjs [--sheet OUT.html]
//
// media/world/icons/<mark>.svg   one file per platform mark, key ink black (for paper grounds)
// media/world/icons/<mark>-on-dark.svg, lane-<lane>.svg   key ink light, for the water field
// media/world/plates/<plate>.svg the colour studies and the motion study, for dark grounds
// --sheet writes a review sheet showing every mark on paper and on the dark field, for checking at full size.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLATFORM_MARKS, platformMark } from "./marks/platform-marks.mjs";
import { LANE_MARKS, LANE_PLATFORM, laneMark } from "./marks/lane-marks.mjs";
import { platInk } from "./marks/overprint.mjs";
import { PLATES } from "./marks/plates.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const icons = path.join(site, "media/world/icons"), plates = path.join(site, "media/world/plates");
mkdirSync(icons, { recursive: true }); mkdirSync(plates, { recursive: true });
const standalone = (s, k = "#1a1b22") => s.replace("<svg ", `<svg style="--xo-k:${k}" `);
const LIGHT = "#f4efe6";
let n = 0;
for (const k of Object.keys(PLATFORM_MARKS)) {
  writeFileSync(path.join(icons, `${k.toLowerCase()}.svg`), standalone(platformMark(k)) + "\n");
  writeFileSync(path.join(icons, `${k.toLowerCase()}-on-dark.svg`), standalone(platformMark(k, { dark: true }), LIGHT) + "\n"); n += 2;
}
for (const k of Object.keys(LANE_MARKS)) { writeFileSync(path.join(icons, `lane-${k}.svg`), standalone(laneMark(k), LIGHT) + "\n"); n++; }
// every lane in one sprite with an SVG view per lane, so a page shows any lane as lanes.svg#<lane> in one request
{
  const names = Object.keys(LANE_MARKS), defs = [], cells = [];
  names.forEach((k, i) => {
    const x = i * 56, m = LANE_MARKS[k](`sp-${k}`, platInk(LANE_PLATFORM, true));
    defs.push(m.defs); cells.push(`<view id="${k}" viewBox="${x} 0 48 48"/><svg x="${x}" y="0" width="48" height="48" viewBox="0 0 48 48" overflow="hidden">${m.body}</svg>`);
  });
  writeFileSync(path.join(icons, "lanes.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${names.length * 56} 48" style="--xo-k:${LIGHT}" aria-hidden="true"><defs>${defs.join("")}</defs>${cells.join("")}</svg>
`); n++;
}
for (const [k, p] of Object.entries(PLATES)) { writeFileSync(path.join(plates, `${k}.svg`), p.svg() + "\n"); n++; }
console.log(`build-marks: ${n} files`);

const i = process.argv.indexOf("--sheet");
if (i > 0) {
  const cell = (s, cap) => `<figure>${s}<figcaption>${cap}</figcaption></figure>`;
  const row = (dark) => `<section class="${dark ? "dark" : "paper"}">${Object.keys(PLATFORM_MARKS).map((k) => cell(platformMark(k, { title: false, dark }).replace(/pm-/g, `pm${dark ? "d" : "p"}-`), k)).join("")}</section>
<section class="${dark ? "dark" : "paper"} lanes">${Object.keys(LANE_MARKS).map((k) => cell(laneMark(k, { title: false, dark }).replace(/lm-/g, `lm${dark ? "d" : "p"}-`), k)).join("")}</section>`;
  writeFileSync(process.argv[i + 1], `<!doctype html><meta charset="utf-8"><style>
body{margin:0;font:14px system-ui} section{display:flex;flex-wrap:wrap;gap:28px;padding:32px}
.paper{background:#fcf7eb;--xo-k:#1a1b22;color:#222}.dark{background:#16202b;--xo-k:#f4efe6;color:#eee}
figure{margin:0;text-align:center} svg{width:180px;height:180px;display:block} .lanes svg{width:96px;height:96px}
img{display:block;width:100%}</style>${row(false)}${row(true)}
${Object.keys(PLATES).map((k) => `<img src="file:///${plates.replace(/\\/g, "/")}/${k}.svg">`).join("")}`);
  console.log("sheet:", process.argv[i + 1]);
}
