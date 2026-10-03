// t7v2-run.mjs: encode every packet pre-registration 3 measures on the "t7v2" corpus, with the shipped
// JavaScript. Reads the working directory made by py/prep_t7v2.py and writes <work>/out/packets.json:
//   base: L0, L1 and L2 (n = 32) of every t7v2 image, encoded twice, with the count of identical repeats;
//   t7:   the shipped colorGrid16 JSON text and L2 alone at N in {8, ..., 48} for every t7v2 image.
// Run: node tests/telos-track-a/t7v2-run.mjs <work dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { layerPacketLinear, linearQ24FromRgba } from "../../system/lib/sense-core/layers-int.mjs";
import { colorGridHex } from "../../system/lib/sense-core/features.mjs";
import { N_GRID } from "./lib/variants.mjs";

function main() {
  const work = process.argv[2];
  if (!work) throw new Error("usage: t7v2-run.mjs <work dir>");
  const index = JSON.parse(readFileSync(join(work, "index.json"), "utf8"));
  const out = { base: { t7v2: {} }, repeatIdentical: {}, t7: { colorGrid16: {}, l2ByN: {} } };
  let same = 0;
  for (const e of index.corpora.t7v2) {
    const px = new Uint8Array(readFileSync(join(work, "base", "t7v2", `${e.name}.rgba`)));
    const lin = linearQ24FromRgba(px, e.w, e.h, 4);
    const enc = () => { const p = layerPacketLinear(lin, e.w, e.h, 32); return { achromatic: p.achromatic, ...p.layers, w: e.w, h: e.h }; };
    const a = enc(), b = enc();
    if (JSON.stringify(a) === JSON.stringify(b)) same++;
    out.base.t7v2[e.name] = a;
    out.t7.colorGrid16[e.name] = JSON.stringify(colorGridHex(px, e.w, e.h, 4, 16));
    out.t7.l2ByN[e.name] = Object.fromEntries(N_GRID.map((n) => [n, layerPacketLinear(lin, e.w, e.h, n, { layers: ["L2"] }).layers.L2]));
  }
  out.repeatIdentical.t7v2 = { same, of: index.corpora.t7v2.length };
  mkdirSync(join(work, "out"), { recursive: true });
  writeFileSync(join(work, "out", "packets.json"), JSON.stringify(out));
  console.log(JSON.stringify(out.repeatIdentical));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
