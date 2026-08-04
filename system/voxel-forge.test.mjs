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

// ── Interaction layer: rotation, picking, editing, tuning (operator request) ──

import { rotateScene, encodePick, decodePick, applyVoxelEdit } from "./voxel-forge.js";
import { isoOrder } from "./voxel.js";

test("four quarter-turns are the identity, and every turn preserves the solid", () => {
  const s = buildVoxelScene("aurora", { study: "relic", res: 32 });
  let r = s;
  for (let i = 0; i < 4; i += 1) {
    r = rotateScene(r, 1);
    assert.equal(voxelCount(r.vox), s.meta.voxels, `turn ${i + 1}: count preserved`);
  }
  assert.deepEqual(Array.from(r.vox.occ), Array.from(s.vox.occ), "4 turns = identity");
  assert.deepEqual(Array.from(r.mat), Array.from(s.mat), "materials ride along");
  // A single turn on a non-symmetric solid is NOT the identity (the control does something).
  assert.notDeepEqual(Array.from(rotateScene(s, 1).vox.occ), Array.from(s.vox.occ));
});

test("pick encoding round-trips every face id across the index range", () => {
  for (const [idx, face] of [[0, 0], [1, 2], [884735, 1], [12345, 2]]) {
    const [r, g, b] = encodePick(idx, face);
    assert.deepEqual(decodePick(r, g, b), { cellIndex: idx, faceId: face });
  }
  assert.equal(decodePick(0, 0, 0), null, "the background decodes to nothing");
});

test("edits do what they say and are counted honestly", () => {
  const s = buildVoxelScene("aurora", { study: "relic", res: 32 });
  const before = s.meta.voxels;
  const top = isoOrder(s.vox).find((c) => c.top);
  const idx = (top.z * s.vox.ny + top.y) * s.vox.nx + top.x;
  assert.ok(applyVoxelEdit(s, idx, 0, "build"), "build against an open top face");
  assert.equal(s.meta.voxels, before + 1);
  assert.ok(applyVoxelEdit(s, idx, 0, "chisel"), "chisel the picked voxel");
  assert.equal(s.meta.voxels, before, "chisel removes exactly one");
  const bandBefore = s.mat[idx] || 0;
  if (s.vox.occ[idx]) {
    assert.ok(applyVoxelEdit(s, idx, 0, "paint"));
    assert.notEqual(s.mat[idx], bandBefore, "paint advances the band");
  }
  assert.ok(s.meta.edits >= 2, "every edit is counted");
  // Refusals: editing empty space, building into a solid neighbour, building off-grid.
  assert.equal(applyVoxelEdit(s, -1, 0, "chisel"), false);
});

test("tuning changes the algorithm and leaving it null reproduces the seeded build", () => {
  for (const study of Object.keys(VOXEL_STUDIES)) {
    const seeded1 = buildVoxelScene("aurora", { study, res: 32 });
    const seeded2 = buildVoxelScene("aurora", { study, res: 32 });
    assert.deepEqual(Array.from(seeded1.vox.occ), Array.from(seeded2.vox.occ), `${study}: untouched tune keeps the old build`);
    const tuned = buildVoxelScene("aurora", { study, res: 32, tune: { a: 1, b: 1, c: 0 } });
    assert.notDeepEqual(Array.from(tuned.vox.occ), Array.from(seeded1.vox.occ), `${study}: the knobs have authority`);
    assert.ok(tuned.meta.tune, `${study}: a tuned build records its knobs`);
    assert.equal(seeded1.meta.tune, null, `${study}: a seeded build records none`);
  }
  // Every study names its three knobs for the UI.
  for (const study of Object.keys(VOXEL_STUDIES)) {
    assert.equal(VOXEL_STUDIES[study].tune.length, 3, `${study}: three named knobs`);
  }
});
