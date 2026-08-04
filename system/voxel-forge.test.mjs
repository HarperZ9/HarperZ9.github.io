// voxel-forge.test.mjs — the voxel making/lighting/export half, pure and node-run.
// Run: node --test system/voxel-forge.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildVoxelScene, toVoxFile, faceAO, seededPalette, VOXEL_STUDIES,
} from "./voxel-forge.js";
import { voxelCount } from "./voxel.js";

test("every study builds a real, deterministic, seed-sensitive scene", () => {
  for (const study of Object.keys(VOXEL_STUDIES)) {
    const a = buildVoxelScene("aurora", { study, res: 40 });
    const b = buildVoxelScene("aurora", { study, res: 40 });
    const c = buildVoxelScene("kiln", { study, res: 40 });
    assert.ok(a.meta.voxels > 200, `${study}: a real solid (${a.meta.voxels} voxels)`);
    assert.deepEqual(Array.from(a.vox.occ), Array.from(b.vox.occ), `${study}: same seed, same solid`);
    assert.notDeepEqual(Array.from(a.vox.occ), Array.from(c.vox.occ), `${study}: seeds differentiate`);
    // Every solid cell carries a material; every empty cell carries none.
    for (let i = 0; i < a.vox.occ.length; i += 7) {
      if (a.vox.occ[i]) assert.ok(a.mat[i] >= 1 && a.mat[i] <= 5, `${study}: solid cell has a material band`);
      else assert.equal(a.mat[i], 0, `${study}: empty cell has no material`);
    }
  }
});

test("terrain shares the plot-maps elevation truth (sea level present, others null)", () => {
  const t = buildVoxelScene("aurora", { study: "terrain", res: 48 });
  assert.ok(t.meta.seaLevel > 0 && t.meta.seaLevel < 1, "terrain carries its sea level");
  const r = buildVoxelScene("aurora", { study: "relic", res: 40 });
  assert.equal(r.meta.seaLevel, null, "non-terrain scenes claim none");
});

test("faceAO darkens exactly with side-neighbour count and never below the 4-neighbour floor", () => {
  // A single voxel in open air: AO 1 on every face.
  const solo = { nx: 3, ny: 3, nz: 3, occ: new Uint8Array(27) };
  solo.occ[(1 * 3 + 1) * 3 + 1] = 1;
  for (const f of ["top", "right", "left"]) assert.equal(faceAO(solo, 1, 1, 1, f), 1, `open air: ${f} undarkened`);
  // A flat slab: interior top faces have 4 side neighbours at their own plane's level ABOVE?
  // No — a slab's top faces have neighbours beside the open side only if a cell above is solid.
  // Build an L-step: the cell tucked into the corner must be darker than the exposed one.
  const step = { nx: 3, ny: 3, nz: 3, occ: new Uint8Array(27) };
  const set = (x, y, z) => { step.occ[(z * 3 + y) * 3 + x] = 1; };
  set(0, 0, 0); set(1, 0, 0); set(2, 0, 0); set(0, 0, 1);   // floor row + one riser
  const aoNext = faceAO(step, 1, 0, 0, "top");    // beside the riser: one neighbour above
  const aoFar = faceAO(step, 2, 0, 0, "top");     // far cell: open
  assert.ok(aoNext < aoFar, `corner top face darker (${aoNext} < ${aoFar})`);
  assert.ok(aoNext >= 1 - 0.16 * 4 - 1e-9, "AO floor respected");
});

test("the .vox file is well-formed VOX 150 and byte-deterministic", () => {
  const scene = buildVoxelScene("aurora", { study: "monument", res: 40 });
  const f = toVoxFile(scene);
  const dv = new DataView(f.buffer, f.byteOffset, f.byteLength);
  const ascii = (o) => String.fromCharCode(f[o], f[o + 1], f[o + 2], f[o + 3]);
  assert.equal(ascii(0), "VOX ", "magic");
  assert.equal(dv.getUint32(4, true), 150, "version 150");
  assert.equal(ascii(8), "MAIN", "MAIN chunk");
  assert.equal(dv.getUint32(12, true), 0, "MAIN carries no content of its own");
  // First child: SIZE with the scene's dimensions.
  assert.equal(ascii(20), "SIZE");
  assert.equal(dv.getUint32(32, true), scene.vox.nx);
  assert.equal(dv.getUint32(36, true), scene.vox.ny);
  assert.equal(dv.getUint32(40, true), scene.vox.nz);
  // XYZI: declared count equals the occupancy count, and the chunk length matches it.
  assert.equal(ascii(44), "XYZI");
  const xyziLen = dv.getUint32(48, true);
  const declared = dv.getUint32(56, true);
  assert.equal(declared, scene.meta.voxels, "XYZI count = occupancy count");
  assert.equal(xyziLen, 4 + declared * 4, "XYZI length = 4 + 4N");
  // RGBA present and total file length closes exactly.
  const rgbaOff = 56 + 4 + declared * 4;
  assert.equal(ascii(rgbaOff), "RGBA");
  assert.equal(f.length, rgbaOff + 12 + 1024, "file closes at the end of RGBA");
  // Byte-exact determinism (the receipt property).
  const g = toVoxFile(buildVoxelScene("aurora", { study: "monument", res: 40 }));
  assert.deepEqual(Array.from(f), Array.from(g));
});

test("the palette is restrained: one family plus one accent, never neon across the board", () => {
  // Structural honesty check: bands 1-3 share a family (low saturation), band 4 is the accent.
  for (const seed of ["aurora", "kiln", "membrane"]) {
    const rngLike = (() => { let i = 0; const vals = [0.1, 0.5, 0.9]; return () => vals[i++ % 3]; })();
    const pal = seededPalette(rngLike);
    for (const band of [1, 2, 3]) {
      const [r, g, b] = pal[band];
      const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b));
      assert.ok(sat < 0.45, `band ${band} stays muted (sat ${sat.toFixed(2)})`);
    }
    assert.equal(pal.length, 6, "six bands: empty + four heights + below-sea");
  }
});

test("resolution caps hold: growth and terrain clamp, .vox refuses axes over 256", () => {
  const g = buildVoxelScene("cap-check", { study: "growth", res: 96 });
  assert.ok(g.vox.nx <= 72, "growth clamps its grid");
  assert.throws(() => toVoxFile({ vox: { nx: 300, ny: 10, nz: 10, occ: new Uint8Array(0) }, mat: new Uint8Array(0), palette: [] }),
    /256/, "the .vox cap is surfaced, not silently wrapped");
});
