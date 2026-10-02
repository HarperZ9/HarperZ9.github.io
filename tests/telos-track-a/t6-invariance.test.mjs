// t6-invariance.test.mjs: Telos Track A step T6, nuisance invariance, the Telos resampling filter and
// overlays. Rules: PREREGISTRATION.md, pre-registration 2 section T6 and amendment 2. The corpus
// measurement is in results/t6-invariance.json (t5t7-run.mjs, py/t6_analyze.py); the overlay rows there ran
// through the Telos measurement contract. Here: resample-int against its Python twin, the masked L0 and L3
// on synthetic greyscale frames (Node and Python), and re-derivation of every recorded gate.
// Run: node --test tests/telos-track-a/t6-invariance.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resampleAreaLinear, scaledSize } from "../../system/lib/sense-core/resample-int.mjs";
import { layerL0Linear, layerL3Overlays, layerPacketLinear, linearQ24FromRgba } from "../../system/lib/sense-core/layers-int.mjs";
import { outlineMask, SCALES } from "./lib/variants.mjs";
import { randomImages } from "./lib/images.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const R = JSON.parse(readFileSync(join(HERE, "results", "t6-invariance.json"), "utf8"));
const py = (code, input) => execFileSync("python", ["-c", code], { cwd: join(HERE, "py"), input, encoding: "utf8", maxBuffer: 1 << 28 });

function seeded() { return [...randomImages(50)].map((i) => ({ ...i, lin: linearQ24FromRgba(i.px, i.w, i.h, 4) })); }

test("T6.resample eq: resample-int Node and Python outputs are identical on 50 seeded images at the four scales", () => {
  const cases = [];
  for (const img of seeded()) for (const [, [num, den]] of Object.entries(SCALES)) {
    const [w2, h2] = scaledSize(img.w, img.h, num, den);
    cases.push({ w: img.w, h: img.h, w2, h2, lin: [...img.lin], out: [...resampleAreaLinear(img.lin, img.w, img.h, w2, h2)] });
  }
  const dir = mkdtempSync(join(tmpdir(), "telos-t6-"));
  try {
    writeFileSync(join(dir, "c.json"), JSON.stringify(cases));
    const bad = py("import json,sys;from resample_int import resample_area_linear as r;c=json.load(open(sys.argv[1]) if len(sys.argv)>1 else sys.stdin);"
      + "print(sum(1 for x in c if r(x['lin'],x['w'],x['h'],x['w2'],x['h2'])!=x['out']))", JSON.stringify(cases)).trim();
    assert.equal(bad, "0");
  } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.equal(cases.length, 200);
});

test("T6.resample eq: scale 1 returns the input linear values unchanged", () => {
  for (const img of seeded()) assert.deepEqual([...resampleAreaLinear(img.lin, img.w, img.h, img.w, img.h)], [...img.lin]);
});

test("T6.overlay eq: on greyscale frames the flag outside a drawn outline equals the clean flag, in Node and Python", () => {
  const frames = [];
  for (const [w, h, seed] of [[96, 64, 3], [150, 120, 9], [64, 64, 21]]) {
    const px = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { const v = (i * seed + (i % w) * 7) % 256; px[i * 4] = v; px[i * 4 + 1] = v; px[i * 4 + 2] = v; px[i * 4 + 3] = 255; }
    for (const fraction of [0.02, 0.1]) {
      const { mask, bbox, count } = outlineMask(w, h, fraction);
      const comp = Uint8Array.from(px);
      for (let i = 0; i < w * h; i++) if (mask[i]) { comp[i * 4] = 255; comp[i * 4 + 1] = 0; comp[i * 4 + 2] = 0; }
      const clean = layerPacketLinear(linearQ24FromRgba(px, w, h, 4), w, h, 32).achromatic;
      const lin = linearQ24FromRgba(comp, w, h, 4);
      const drawn = layerL0Linear(lin, w, h, (i) => !mask[i]);
      assert.equal(clean, 1);
      assert.equal(drawn.achromatic, clean, `${w}x${h} at ${fraction}`);
      const l3 = layerL3Overlays([{ id: "o", mask }], w, h).split("\n")[1];
      assert.equal(l3, `region id:o bbox:${bbox.join(",")} area:${Math.floor((2000 * count + w * h) / (2 * w * h))} overlay:true`);
      frames.push({ w, h, lin: [...lin], mask: [...mask], text: drawn.text, l3 });
    }
  }
  const bad = py("import json,sys;from layers_int import layer_l0_linear,layer_l3_overlays as l3;c=json.load(sys.stdin);"
    + "print(sum(1 for f in c if layer_l0_linear(f['lin'],f['w'],f['h'],lambda i,m=f['mask']:not m[i])[1]!=f['text'] or l3([('o',f['mask'])],f['w'],f['h']).split(chr(10))[1]!=f['l3']))",
  JSON.stringify(frames)).trim();
  assert.equal(bad, "0");
});

test("T6 record: every recorded gate re-derives from the recorded numbers", () => {
  for (const [c, res] of Object.entries(R.corpora)) for (const [layer, per] of Object.entries(res.layers)) {
    for (const [nz, v] of Object.entries(per)) assert.equal(R.gates[`${c} ${layer} ${nz}`], v.median_ratio <= 0.25, `${c} ${layer} ${nz}`);
  }
  const rows = R.overlays.rows;
  assert.equal(rows.length, 218);
  for (const f of [0.02, 0.1]) {
    const rr = rows.filter((r) => r.fraction === f);
    assert.equal(R.gates[`overlay ${f} flag_kept_outside_mask`], rr.every((r) => r.drawnFlagOutsideMask === r.cleanFlag));
    assert.equal(R.gates[`overlay ${f} clean_text_equal`], rr.every((r) => r.cleanTextEqual));
    assert.equal(R.gates[`overlay ${f} l3_exact`], rr.every((r) => r.l3Equal));
    assert.ok(rr.every((r) => r.share >= f));
  }
});
