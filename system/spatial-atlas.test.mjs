// spatial-atlas.test.mjs: coverage for the NGSF parser and the importance
// tiering. Both are pure and both gate what reaches the GPU, and neither had
// a test: every refusal path below was previously unexercised.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNGSF, orderByImportance } from "./spatial-atlas.js";

const STRIDE = 32;

function buildModel(count, { magic = "NGS5", version = 5, stride = STRIDE, truncate = 0 } = {}) {
  const bytes = new Uint8Array(16 + count * stride - truncate);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < 4; i += 1) view.setUint8(i, magic.charCodeAt(i));
  view.setUint16(4, version, true);
  view.setUint16(6, stride, true);
  view.setUint32(8, count, true);
  for (let i = 0; i < count; i += 1) {
    const o = 16 + i * stride;
    if (o + stride > bytes.length) break;
    view.setInt16(o, 32767, true);            // x = +2.5
    view.setInt16(o + 2, -32767, true);       // y = -2.5
    view.setInt16(o + 4, 0, true);            // z = 0
    view.setUint16(o + 6, 32768, true);       // scales
    view.setUint16(o + 8, 32768, true);
    view.setUint16(o + 10, 32768, true);
    view.setInt16(o + 12, 32767, true);       // quaternion w = 1
    view.setUint8(o + 20, 255);               // r
    view.setUint8(o + 21, 128);               // g
    view.setUint8(o + 22, 0);                 // b
    view.setUint8(o + 23, 200);               // opacity
    view.setUint8(o + 24, 21);                // angular support -> 1.0
    view.setUint8(o + 25, 2);                 // semantic layer
    view.setUint8(o + 26, i % 256);           // importance
    view.setInt8(o + 28, 127);                // view response
  }
  return bytes.buffer;
}

test("a well-formed model parses into the expected channels", () => {
  const scene = parseNGSF(buildModel(3));
  assert.equal(scene.count, 3);
  assert.ok(Math.abs(scene.means[0] - 2.5) < 1e-3, "x dequantizes to +2.5");
  assert.ok(Math.abs(scene.means[1] + 2.5) < 1e-3, "y dequantizes to -2.5");
  assert.ok(Math.abs(scene.colors[0] - 1) < 1e-6, "red channel is full");
  assert.ok(Math.abs(scene.opacity[0] - 200 / 255) < 1e-6);
  assert.ok(Math.abs(scene.meta[0] - 1) < 1e-6, "angular support scales to 1.0");
  assert.equal(scene.meta[1], 2, "semantic layer is carried through unscaled");
  assert.ok(Math.abs(scene.viewCoeff[0] - 1) < 1e-2, "view response scales to about 1");
  // The quaternion is normalized on the way in.
  const q = [scene.quats[0], scene.quats[1], scene.quats[2], scene.quats[3]];
  assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-6, "quaternion is unit length");
});

test("every malformation is refused loudly", () => {
  assert.throws(() => parseNGSF(new ArrayBuffer(8)), /shorter than its header/);
  assert.throws(() => parseNGSF(buildModel(2, { magic: "NGS4" })), /Unsupported model magic/);
  assert.throws(() => parseNGSF(buildModel(2, { version: 4 })), /Unsupported NGSF layout/);
  assert.throws(() => parseNGSF(buildModel(2, { stride: 40 })), /Unsupported NGSF layout/);
  // A header that promises more records than the body carries.
  assert.throws(() => parseNGSF(buildModel(4, { truncate: STRIDE })), /byte count does not match/);
});

test("importance ordering keeps the most important splats under a budget", () => {
  const scene = parseNGSF(buildModel(1000));
  const { indices, dropped } = orderByImportance(scene, 300);
  assert.equal(indices.length, 300);
  assert.equal(dropped, 700);
  // Importance is written as i % 256, so records 255, 511, 767 ... rank top.
  const kept = new Set(indices);
  assert.ok(kept.has(255), "a maximum-importance record survives the clamp");
  // Descending importance order.
  for (let i = 1; i < indices.length; i += 1) {
    assert.ok(scene.meta[indices[i - 1] * 4 + 2] >= scene.meta[indices[i] * 4 + 2],
      "ordering is not descending by importance");
  }
  // The kept set must hold no record less important than the worst kept one.
  const worstKept = Math.min(...indices.map((i) => scene.meta[i * 4 + 2]));
  for (let i = 0; i < scene.count; i += 1) {
    if (!kept.has(i)) {
      assert.ok(scene.meta[i * 4 + 2] <= worstKept + 1e-9,
        `dropped record ${i} was more important than a kept one`);
    }
  }
});

test("a budget below the drawable floor is raised, not honoured literally", () => {
  // orderByImportance keeps a 200-splat floor so a hostile budget cannot
  // reduce a scene to nothing. Documented here because it is deliberate.
  const scene = parseNGSF(buildModel(400));
  const { indices, dropped } = orderByImportance(scene, 5);
  assert.equal(indices.length, 200, "the floor should hold at 200");
  assert.equal(dropped, 200);
});

test("a budget at or above the scene keeps everything", () => {
  const scene = parseNGSF(buildModel(12));
  for (const budget of [12, 500, Infinity]) {
    const { indices, dropped } = orderByImportance(scene, budget);
    assert.equal(indices.length, 12, `budget ${budget} changed the count`);
    assert.equal(dropped, 0);
  }
});

test("a tiny budget still returns a drawable floor", () => {
  const scene = parseNGSF(buildModel(1000));
  const { indices } = orderByImportance(scene, 1);
  assert.ok(indices.length >= 1 && indices.length <= 1000);
  assert.ok(new Set(indices).size === indices.length, "indices must be unique");
});

// ── The quantization envelope of the shipped corpus ───────────────────────────
// S8 of the visual-engine audit filed the dequantization constants as scene
// independent: positions ride a hard-coded 2.5 with no per-scene AABB, and
// scales ride a fixed exponential. That is true of the FORMAT. It was measured
// against the 27 shipped scenes on 2026-08-03 and found to cost nothing worth
// paying for: no record touches either limit, and the position quantum works
// out to 0.059px at the Studio's largest backing, seventeen times finer than
// the pixel grid. Re-encoding to recover it would break the byte-exact receipts
// the atlas is served under, for a gain nobody can see.
//
// The measurement is the reason not to act, so it has to keep holding. These
// tests fail if a future scene clips the range (silent geometry loss) or sits
// so far inside it that the quantum becomes visible — either one turns the
// dismissal back into a defect. Receipts: project-docs/2026-08-03-fractal-precision.md
// records the same discipline for the fractal path.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ATLAS_DIR = join(import.meta.dirname, "..", "art", "spatial", "atlas");
const POSITION_RANGE = 2.5;      // must match the constant in parseNGSF
const INT16_MAX = 32767;

function scanScene(file) {
  const b = readFileSync(join(ATLAS_DIR, file));
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const count = v.getUint32(8, true);
  let maxAbsCode = 0, minScaleCode = 65535, maxScaleCode = 0;
  for (let i = 0; i < count; i += 1) {
    const o = 16 + i * 32;
    for (let k = 0; k < 3; k += 1) {
      const c = Math.abs(v.getInt16(o + k * 2, true));
      if (c > maxAbsCode) maxAbsCode = c;
      const s = v.getUint16(o + 6 + k * 2, true);
      if (s < minScaleCode) minScaleCode = s;
      if (s > maxScaleCode) maxScaleCode = s;
    }
  }
  return { file, count, maxAbsCode, minScaleCode, maxScaleCode };
}

const atlasScenes = existsSync(ATLAS_DIR)
  ? readdirSync(ATLAS_DIR).filter((f) => f.endsWith(".ngsf")).sort()
  : [];

test("every shipped atlas scene fits inside the fixed position range", { skip: !atlasScenes.length && "atlas assets not present" }, () => {
  assert.ok(atlasScenes.length >= 27, `expected the full 27-scene corpus, found ${atlasScenes.length}`);
  for (const file of atlasScenes) {
    const s = scanScene(file);
    // A code pinned at the int16 rail means the encoder ran out of range and
    // the geometry beyond it was flattened onto the boundary, silently.
    assert.ok(s.maxAbsCode < INT16_MAX - 8,
      `${file}: position code ${s.maxAbsCode} is at the int16 rail — geometry is being clipped`);
  }
});

test("the fixed position range stays fine enough to be invisible", { skip: !atlasScenes.length && "atlas assets not present" }, () => {
  // The quantum is constant; what varies is how much of the range a scene uses,
  // which sets how many quanta span the object actually on screen. Below ~15%
  // utilisation the step would exceed a sixth of a pixel at a 1550px backing
  // and a per-scene AABB would start to be worth its provenance cost.
  const quantum = POSITION_RANGE / INT16_MAX;
  for (const file of atlasScenes) {
    const s = scanScene(file);
    const utilisation = s.maxAbsCode / INT16_MAX;
    const sceneSpan = 2 * POSITION_RANGE * utilisation;          // widest extent, world units
    const pxPerQuantum = (quantum / sceneSpan) * 1550;           // Studio backing at DPR 2
    assert.ok(pxPerQuantum < 0.1,
      `${file}: position quantum is ${pxPerQuantum.toFixed(3)}px — no longer below the pixel grid`);
  }
});

test("every shipped scale code sits inside the encodable band", { skip: !atlasScenes.length && "atlas assets not present" }, () => {
  // parseNGSF maps scales through exp(u/65535*8 - 9), so code 65535 is the
  // ceiling at 0.368 scene units and code 0 is the floor. A scene pressed
  // against either end has had its Gaussian footprints silently resized.
  for (const file of atlasScenes) {
    const s = scanScene(file);
    assert.ok(s.maxScaleCode < 65530, `${file}: scale code ${s.maxScaleCode} is at the exponential ceiling`);
    assert.ok(s.minScaleCode > 5, `${file}: scale code ${s.minScaleCode} is at the exponential floor`);
  }
});
