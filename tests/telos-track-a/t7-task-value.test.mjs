// t7-task-value.test.mjs: Telos Track A step T7, task value on the slice 0 images (in-source only).
// Rules: PREREGISTRATION.md, pre-registration 2 section T7 and amendment 4. The probe runs in
// py/t7_analyze.py (results/t7-task-value.json); a post hoc exploration is kept apart in
// results/t7-explore-posthoc.json. Here: the layer parser round-trips, and every recorded gate and
// verdict re-derives from the recorded numbers.
// Run: node --test tests/telos-track-a/t7-task-value.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { layerPacketLinear, linearQ24FromRgba } from "../../system/lib/sense-core/layers-int.mjs";
import { randomImages } from "./lib/images.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const R = JSON.parse(readFileSync(join(HERE, "results", "t7-task-value.json"), "utf8"));

test("T7.parse eq: parsed layer features re-encode to the identical text on 200 seeded and 4 dark grey images (both branches)", () => {
  const texts = [];
  // Dark grey frames put achromatic L8 bins below 16, where a hex re-encoder can drop a leading zero
  // (added after mutation M47 survived the seeded set alone).
  const dark = [0, 3, 7, 12].map((v) => { const px = new Uint8Array(40 * 30 * 4); for (let i = 0; i < 1200; i++) { const g = v + (i % 5); px.set([g, g, g, 255], i * 4); } return { px, w: 40, h: 30 }; });
  for (const img of [...randomImages(200), ...dark]) {
    const p = layerPacketLinear(linearQ24FromRgba(img.px, img.w, img.h, 4), img.w, img.h, 32);
    texts.push(p.layers.L0, p.layers.L1, p.layers.L2);
  }
  const out = execFileSync("python", ["-c", "import json,sys;from track_common import parse_layer as p,encode_layer as e;t=json.load(sys.stdin);"
    + "print(sum(1 for x in t if e(p(x))!=x), sum(1 for x in t if x.startswith('L2') and 'achromatic' in x))"],
  { cwd: join(HERE, "py"), input: JSON.stringify(texts), encoding: "utf8", maxBuffer: 1 << 28 }).trim().split(" ");
  assert.equal(out[0], "0");
  assert.ok(Number(out[1]) > 0, "the seeded set must include achromatic L2 layers");
  assert.deepEqual(R.parser_roundtrip, { same: 900, of: 900 });
});

test("T7 record: controls, positive controls and value verdicts re-derive from the recorded numbers", () => {
  assert.equal(R.tasks.length, 4);
  for (const t of R.tasks) {
    assert.equal(t.scope, "in-source only");
    for (const [name, c] of Object.entries(t.controls)) {
      const m = c.draws.reduce((a, b) => a + b, 0) / c.draws.length;
      const sd = Math.sqrt(c.draws.reduce((a, b) => a + (b - m) ** 2, 0) / (c.draws.length - 1));
      assert.equal(c.draws.length, 20);
      assert.ok(Math.abs(c.upper - (m + 1.96 * sd / Math.sqrt(20))) < 1e-9);
      assert.equal(c.pass, c.upper <= t.majority_rate + 0.02, `${t.source} ${t.task} ${name}`);
      assert.equal(R.gates[`${t.source} ${t.task} ${name}`], c.pass);
    }
    assert.equal(t.positive_control.pass, t.positive_control.lo > 0);
    assert.equal(R.gates[`${t.source} ${t.task} positive`], t.positive_control.pass);
    for (const v of Object.values(t.conditional_value)) assert.equal(v.carries_value, v.lo > 0);
  }
});
