// t5t7-run.mjs: encode every packet Track A steps T5 to T7 measure, with the shipped JavaScript.
// Reads the working directory made by py/prep_t5t7.py and writes <work>/out/packets.json:
//   base:     packets (L0, L1, L2 at n = 32) of the 36 audit frames and the 300 slice 0 images, encoded
//             twice (the T5 noise floor) with the count of byte-identical repeats;
//   variants: T6 packets of the 24 art frames and the slice 0 images under JPEG 75/85/95, the C2 probe,
//             a 1-pixel shift and resampling by 1/2, 3/4, 3/2 and 2 with resample-int/v1;
//   overlays: T6 overlay checks through the Telos measurement contract (TELOS_MCP_ROOT);
//   t7:       the shipped colorGrid16 JSON text and L2 alone at N in {8, ..., 48} for the slice 0 images.
// Run: node tests/telos-track-a/t5t7-run.mjs <work dir>   (TELOS_MCP_ROOT=<Telos repo> for the overlays)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { layerPacketLinear, linearQ24FromRgba } from "../../system/lib/sense-core/layers-int.mjs";
import { resampleAreaLinear, scaledSize } from "../../system/lib/sense-core/resample-int.mjs";
import { colorGridHex } from "../../system/lib/sense-core/features.mjs";
import { N_GRID, outlineMask, SCALES, shiftRight } from "./lib/variants.mjs";

let WORK, index;
const rgba = (corpus, name, v) => new Uint8Array(readFileSync(join(WORK, v ? "var" : "base", corpus, v ? `${name}.${v}.rgba` : `${name}.rgba`)));
const packetLin = (lin, w, h, n = 32) => { const p = layerPacketLinear(lin, w, h, n); return { achromatic: p.achromatic, ...p.layers, w, h }; };
const packet = (px, w, h) => packetLin(linearQ24FromRgba(px, w, h, 4), w, h);
async function overlayChecks(out) {
  const root = process.env.TELOS_MCP_ROOT;
  if (!root) { out.overlays = { skipped: "TELOS_MCP_ROOT not set" }; return; }
  const { measureRequest } = await import(pathToFileURL(join(root, "demo", "measurement-image.mjs")).href);
  const rows = [];
  for (const [corpus, list] of [["audit", index.corpora.audit], ["s0", index.corpora.s0.filter((e) => e.source === "BBBC010")]]) {
    for (const e of list) {
      const px = rgba(corpus, e.name), clean = out.base[corpus][e.name];
      if (corpus === "audit" && clean.achromatic !== 1) continue;
      for (const fraction of [0.02, 0.1]) {
        const { mask, t, count, bbox } = outlineMask(e.w, e.h, fraction);
        const comp = Uint8Array.from(px);
        for (let i = 0; i < e.w * e.h; i++) if (mask[i]) { comp[i * 4] = 255; comp[i * 4 + 1] = 0; comp[i * 4 + 2] = 0; }
        const b64 = (a) => Buffer.from(a).toString("base64");
        const ov = [{ id: "outline", mask: b64(mask) }];
        const drawn = measureRequest({ image: { rgba: b64(comp), width: e.w, height: e.h }, overlays: ov, overlays_drawn: true });
        const besideClean = measureRequest({ image: { rgba: b64(px), width: e.w, height: e.h }, overlays: ov, overlays_drawn: false });
        const flagOf = (r) => Number(/achromatic:(\d)/.exec(r.layers.find((l) => l.id === "L0").text)[1]);
        const noMask = packet(comp, e.w, e.h).achromatic;
        const l3 = besideClean.layers.find((l) => l.id === "L3").text.split("\n")[1];
        const wantL3 = `region id:outline bbox:${bbox.join(",")} area:${Math.floor((2000 * count + e.w * e.h) / (2 * e.w * e.h))} overlay:true`;
        rows.push({ corpus, name: e.name, fraction, thickness: t, count, share: count / (e.w * e.h),
          cleanFlag: clean.achromatic, drawnFlagOutsideMask: flagOf(drawn), flagNoMask: noMask,
          cleanTextEqual: ["L0", "L1", "L2"].every((id) => besideClean.layers.find((l) => l.id === id)?.text === clean[id]),
          l3Equal: l3 === wantL3, drawnStatus: drawn.status });
      }
    }
  }
  out.overlays = { rows };
}

async function main() {
  WORK = process.argv[2] || process.env.TELOS_TRACKA_WORK;
  if (!WORK) throw new Error("usage: t5t7-run.mjs <work dir>");
  index = JSON.parse(readFileSync(join(WORK, "index.json"), "utf8"));
  const out = { base: {}, repeatIdentical: {}, variants: { art: {}, s0: {} }, t7: { colorGrid16: {}, l2ByN: {} } };
  for (const corpus of ["audit", "s0"]) {
    out.base[corpus] = {}; let same = 0;
    for (const e of index.corpora[corpus]) {
      const px = rgba(corpus, e.name);
      const a = packet(px, e.w, e.h), b = packet(px, e.w, e.h);
      if (JSON.stringify(a) === JSON.stringify(b)) same++;
      out.base[corpus][e.name] = a;
    }
    out.repeatIdentical[corpus] = { same, of: index.corpora[corpus].length };
  }
  for (const corpus of ["art", "s0"]) {
    for (const e of index.corpora[corpus]) {
      const px = rgba(corpus === "art" ? "art" : "s0", e.name), v = {};
      for (const name of ["jpeg75", "jpeg85", "jpeg95", "c2"]) v[name] = packet(rgba(corpus, e.name, name), e.w, e.h);
      v.shift1 = packet(shiftRight(px, e.w, e.h), e.w, e.h);
      const lin = linearQ24FromRgba(px, e.w, e.h, 4);
      for (const [k, [num, den]] of Object.entries(SCALES)) {
        const [w2, h2] = scaledSize(e.w, e.h, num, den);
        v[k] = packetLin(resampleAreaLinear(lin, e.w, e.h, w2, h2), w2, h2);
      }
      out.variants[corpus][e.name] = v;
    }
  }
  for (const e of index.corpora.s0) {
    const px = rgba("s0", e.name), lin = linearQ24FromRgba(px, e.w, e.h, 4);
    out.t7.colorGrid16[e.name] = JSON.stringify(colorGridHex(px, e.w, e.h, 4, 16));
    out.t7.l2ByN[e.name] = Object.fromEntries(N_GRID.map((n) => [n, layerPacketLinear(lin, e.w, e.h, n, { layers: ["L2"] }).layers.L2]));
  }
  await overlayChecks(out);
  mkdirSync(join(WORK, "out"), { recursive: true });
  writeFileSync(join(WORK, "out", "packets.json"), JSON.stringify(out));
  console.log(JSON.stringify({ repeatIdentical: out.repeatIdentical, overlays: out.overlays.rows ? out.overlays.rows.length : out.overlays }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
