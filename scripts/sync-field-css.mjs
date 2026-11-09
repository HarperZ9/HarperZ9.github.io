#!/usr/bin/env node
// Copy world/site/field.css into the end of studies/studies.css, so reading pages get the field's styles without a
// separate stylesheet before the first paint. field.css is the source; run this after editing it (build-world runs it).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MARK = "/* ---- the field (copied from world/site/field.css by scripts/sync-field-css.mjs; edit field.css) ---- */";
const field = readFileSync(path.join(site, "world/site/field.css"), "utf8"), p = path.join(site, "studies/studies.css");
let st = readFileSync(p, "utf8"); if (st.includes(MARK)) st = st.slice(0, st.indexOf(MARK));
writeFileSync(p, st.trimEnd() + "\n\n" + MARK + "\n" + field);
console.log("studies.css: field styles in step with field.css");
