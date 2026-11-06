#!/usr/bin/env node
// Place the drawn marks into hand-written pages, between <!-- mark:NAME --> and <!-- /mark --> comments, from the
// same code that draws them (scripts/marks/). Generated pages (floor.html, experiments/) draw their marks in their
// own build scripts.
//
//   node scripts/place-marks.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { platformMark } from "./marks/platform-marks.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGES = ["phantom.html"];
for (const p of PAGES) {
  const f = path.join(site, p), s = readFileSync(f, "utf8");
  let n = 0;
  const out = s.replace(/<!-- mark:([A-Z0-9]+) -->[\s\S]*?<!-- \/mark -->/g, (_, name) => { n++; return `<!-- mark:${name} -->${platformMark(name, { cls: "xo-svg xo-hero" })}<!-- /mark -->`; });
  if (!n) throw new Error(`place-marks: ${p} has no mark comment`);
  writeFileSync(f, out);
  console.log(`place-marks: ${p}, ${n} mark${n > 1 ? "s" : ""}`);
}
