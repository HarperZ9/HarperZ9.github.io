// plot-bridge.test.mjs — the medium crossings: voxel builds as hidden-line drawings, and the
// blend that puts two mediums on one sheet.
// Run: node --test system/plot-bridge.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { projectScene, depthRaster, clipHidden, voxelSheet, mergeSheets } from "./plot-bridge.js";
import { buildVoxelScene } from "./voxel-forge.js";
import { composeSheet } from "./plot-compose.js";

// A hand-built scene: a 2x2x2 solid block. Every face's visibility is knowable by hand.
function block(n = 2) {
  const nx = n, ny = n, nz = n;
  const occ = new Uint8Array(nx * ny * nz).fill(1);
  const mat = new Uint8Array(nx * ny * nz).fill(2);
  return {
    vox: { nx, ny, nz, occ },
    mat,
    palette: { 2: [200, 200, 200] },
    meta: { seed: "block", study: "test", voxels: n * n * n, edits: 0 },
  };
}

test("projectScene exposes only open faces, with the painter's own shading", () => {
  const { faces, bbox } = projectScene(block(2));
  // A 2^3 block: 4 top faces on the upper layer, 4 right on the +x wall, 4 left on the +y wall.
  const byName = { top: 0, right: 0, left: 0 };
  for (const f of faces) byName[f.name] += 1;
  assert.deepEqual(byName, { top: 4, right: 4, left: 4 });
  for (const f of faces) assert.ok(f.tone > 0 && f.tone <= 1, "tone in range");
  // Walls are darker than tops (0.62 / 0.42 vs 1.0 face base).
  const topTone = Math.max(...faces.filter((f) => f.name === "top").map((f) => f.tone));
  const leftTone = Math.max(...faces.filter((f) => f.name === "left").map((f) => f.tone));
  assert.ok(topTone > leftTone, "light comes from above");
  assert.ok(bbox.maxX > bbox.minX && bbox.maxY > bbox.minY, "a real projected extent");
});

test("the depth raster hides what stands behind: a far face clipped by a near column", () => {
  const { faces, bbox } = projectScene(block(2));
  const raster = depthRaster(faces, bbox);
  // The nearest cell (1,1,1) has depth 3; the farthest (0,0,0) has depth 0 and its cube glyph
  // projects to the same spot — so a stroke on the far cell's face must vanish there.
  const farTop = faces.find((f) => f.depth === 0);
  if (farTop) {
    const mid = [
      (farTop.quad[0][0] + farTop.quad[2][0]) / 2,
      (farTop.quad[0][1] + farTop.quad[2][1]) / 2,
    ];
    assert.ok(raster.depthAt(mid[0], mid[1]) > farTop.depth + 1.5, "a nearer face owns that ground");
  }
  // clipHidden splits: a line whose middle crosses the occupied centre while its ends are outside
  // everything comes back shorter or split, never whole.
  const y = (bbox.minY + bbox.maxY) / 2;
  const line = [[bbox.minX - 1, y], [bbox.maxX + 1, y]];
  const kept = clipHidden(line, -10, raster);   // depth -10: everything the raster holds beats it
  const totalLen = kept.reduce((a, run) => a + Math.hypot(run[run.length - 1][0] - run[0][0], run[run.length - 1][1] - run[0][1]), 0);
  assert.ok(totalLen < (bbox.maxX - bbox.minX + 2) - 0.5, "the covered middle is gone");
});

test("voxelSheet: coplanar edges fuse, silhouette survives, everything lands on the sheet", () => {
  const sheet = voxelSheet(block(2), { density: 1 });
  assert.ok(sheet.layers.some((l) => l.name === "silhouette"), "outline layer exists");
  const sil = sheet.layers.find((l) => l.name === "silhouette");
  // A solid 2-block: internal same-orientation edges fuse, so far fewer strokes than 12 faces * 4.
  assert.ok(sil.polylines.length < 24, `coplanar fusion collapsed the grid (got ${sil.polylines.length} strokes)`);
  for (const layer of sheet.layers) {
    for (const line of layer.polylines) {
      for (const [x, y] of line) {
        assert.ok(x >= -1e-9 && x <= 1 + 1e-9 && y >= -1e-9 && y <= 1 + 1e-9, "inside the sheet");
      }
    }
  }
  assert.ok(sheet.meta.aspect > 0.2 && sheet.meta.aspect < 3, "the sheet takes the drawing's aspect");
  assert.equal(sheet.meta.kind, "voxel");
  assert.ok(sheet.meta.measure && typeof sheet.meta.measure.score === "number", "measured like any sheet");
});

test("a real forge scene crosses over deterministically", () => {
  const scene = buildVoxelScene("bridge-test", { study: "relic", res: 24 });
  const a = voxelSheet(scene, { density: 1 });
  const b = voxelSheet(buildVoxelScene("bridge-test", { study: "relic", res: 24 }), { density: 1 });
  assert.equal(a.meta.strokes, b.meta.strokes, "same scene, same drawing");
  assert.ok(a.meta.strokes > 20, `a relic is a real drawing (${a.meta.strokes} strokes)`);
  assert.ok(a.meta.faces > 50, "visible faces counted");
  // Density raises hatch ink.
  const dense = voxelSheet(scene, { density: 2 });
  const shade = (s) => { const l = s.layers.find((x) => x.name === "shade"); return l ? l.polylines.length : 0; };
  assert.ok(shade(dense) > shade(a), "density buys more hatching");
});

test("mergeSheets: one frame, both provenances, re-measured whole", () => {
  const scene = buildVoxelScene("blend-test", { study: "monument", res: 24 });
  const vox = voxelSheet(scene, { density: 1 });
  const field = composeSheet("blend-test", { candidates: 2 });
  const merged = mergeSheets(vox, field, "under");
  const frames = merged.layers.filter((l) => l.name === "frame");
  assert.equal(frames.length, 1, "exactly one frame survives");
  assert.equal(merged.meta.kind, "blend");
  assert.equal(merged.meta.parts.length, 2);
  assert.equal(merged.meta.strokes,
    merged.layers.reduce((a, l) => a + l.polylines.length, 0), "stroke count is recounted, not summed from parts");
  // Layer order carries the mode: "under" puts the blend layers before the base's own.
  const names = merged.layers.map((l) => l.name);
  const firstBlend = names.findIndex((n) => n.startsWith("blend-"));
  const firstOwn = names.findIndex((n) => !n.startsWith("blend-") && n !== "frame");
  assert.ok(firstBlend < firstOwn, "under: the field is drawn first");
  const over = mergeSheets(vox, field, "over");
  const oNames = over.layers.map((l) => l.name);
  assert.ok(oNames.findIndex((n) => n.startsWith("blend-")) > oNames.findIndex((n) => !n.startsWith("blend-") && n !== "frame"),
    "over: the field is drawn last before the frame");
  assert.ok(merged.meta.measure.score > 0, "the blend is measured as one composition");
});
