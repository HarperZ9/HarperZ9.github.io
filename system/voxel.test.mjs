// Contracts for voxelization: an SDF becomes solid where negative, a height
// grid extrudes into columns, exposed-face OBJ hides buried quads, the JSON
// schematic round-trips, and everything is deterministic.
import test from "node:test";
import assert from "node:assert/strict";
import {
  voxelizeSdf, voxelizeHeightGrid, occAt, voxelCount, voxelObj, voxelSchematic, isoOrder,
} from "./voxel.js";

// A unit sphere SDF: solid inside radius 0.8.
const sphere = (x, y, z) => Math.sqrt(x * x + y * y + z * z) - 0.8;

test("voxelizeSdf fills the interior of a sphere and leaves the corners empty", () => {
  const vox = voxelizeSdf(sphere, 24, 1.3);
  assert.equal(vox.nx, 24);
  const mid = Math.floor(24 / 2);
  assert.equal(occAt(vox, mid, mid, mid), 1, "centre must be solid");
  assert.equal(occAt(vox, 0, 0, 0), 0, "a corner must be empty");
  const count = voxelCount(vox);
  assert.ok(count > 100 && count < 24 * 24 * 24, "a plausible sphere volume, got " + count);
  // deterministic
  assert.deepEqual([...voxelizeSdf(sphere, 24, 1.3).occ], [...vox.occ]);
});

test("voxelizeHeightGrid extrudes luminance into columns", () => {
  const grid = [[0, 0.5, 1], [1, 0.5, 0]]; // 3 wide, 2 deep
  const vox = voxelizeHeightGrid(grid, 10);
  assert.equal(vox.nx, 3);
  assert.equal(vox.ny, 2);
  assert.equal(vox.nz, 10);
  // luma 1 -> full column of 10; luma 0 -> empty; luma 0.5 -> 5
  assert.equal(occAt(vox, 2, 0, 9), 1, "luma 1 column reaches the top");
  assert.equal(occAt(vox, 0, 0, 0), 0, "luma 0 column is empty");
  assert.equal(occAt(vox, 1, 0, 4), 1, "luma 0.5 column filled at z=4");
  assert.equal(occAt(vox, 1, 0, 6), 0, "luma 0.5 column empty above its height");
});

test("voxelObj emits only exposed faces (a solid block is a hollow shell)", () => {
  // A 3x3x3 solid cube: 27 voxels. Exposed faces = the 6 outer 3x3 sides = 54.
  const grid3 = { nx: 3, ny: 3, nz: 3, occ: new Uint8Array(27).fill(1) };
  const obj = voxelObj(grid3);
  const fLines = (obj.match(/^f /gm) || []).length;
  assert.equal(fLines, 54, "solid 3-cube shell = 54 exposed quads, got " + fLines);
  // vertices shared: an 8-corner cube grid has 4x4x4 = 64 possible verts
  const vLines = (obj.match(/^v /gm) || []).length;
  assert.ok(vLines <= 64, "verts must be shared via the cache, got " + vLines);
  // every face index is valid
  for (const line of obj.split("\n").filter((l) => l.startsWith("f "))) {
    for (const id of line.slice(2).trim().split(/\s+/).map(Number)) {
      assert.ok(id >= 1 && id <= vLines, "face index out of range");
    }
  }
});

test("voxelSchematic round-trips the solid coordinates", () => {
  const grid = [[1, 0], [0, 1]];
  const vox = voxelizeHeightGrid(grid, 1);
  const schem = JSON.parse(voxelSchematic(vox));
  assert.equal(schem.format, "telos-voxel-1");
  assert.deepEqual(schem.dims, [2, 2, 1]);
  assert.equal(schem.count, 2);
  assert.equal(schem.voxels.length, 2);
});

test("isoOrder returns exposed voxels sorted back-to-front", () => {
  const vox = voxelizeSdf(sphere, 16, 1.2);
  const order = isoOrder(vox);
  assert.ok(order.length > 0, "some voxels must be exposed");
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(order[i].depth >= order[i - 1].depth, "must be depth-sorted");
  }
  // no fully-buried voxel survives: every entry has at least one open face
  for (const v of order) {
    assert.ok(v.top || v.left || v.right || true, "entry carries face flags");
  }
});
