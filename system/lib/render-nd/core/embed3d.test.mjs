// embed3d.test.mjs - node:test for the nD->3D embedding + orbit camera + perspective projection.
// Run: node --test system/lib/render-nd/core/embed3d.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  embedTo3D, orbitCamera, projectPerspective,
  cross, dot3, normalize, faceNormal,
} from "./embed3d.mjs";

// ── embedTo3D ────────────────────────────────────────────────────────────────
test("embedTo3D: always returns a length-3 array", () => {
  for (const n of [1, 2, 3, 4, 6, 10]) {
    const v = new Float64Array(n).fill(0.3);
    const e = embedTo3D(v, 3);
    assert.equal(e.length, 3);
    for (const c of e) assert.ok(Number.isFinite(c), `coord finite for n=${n}`);
  }
});

test("embedTo3D: n<=3 keeps the first three coords (identity, missing axes = 0)", () => {
  assert.deepEqual(embedTo3D([0.5], 3), [0.5, 0, 0]);
  assert.deepEqual(embedTo3D([0.5, -0.25], 3), [0.5, -0.25, 0]);
  assert.deepEqual(embedTo3D([0.5, -0.25, 0.1], 3), [0.5, -0.25, 0.1]);
});

test("embedTo3D: a 4D point collapses the 4th axis with perspective (keeps a real z)", () => {
  // w (index 3) = 0 -> factor dist/(dist-0)=1 -> identity on xyz.
  assert.deepEqual(embedTo3D([1, 2, 3, 0], 3), [1, 2, 3]);
  // w > 0 -> the kept axes scale up (nearer in the 4th dimension projects larger).
  const e = embedTo3D([1, 0, 0, 1], 3);   // factor = 3/(3-1) = 1.5
  assert.ok(Math.abs(e[0] - 1.5) < 1e-12, `x scaled by 1.5, got ${e[0]}`);
});

test("embedTo3D: empty vector returns origin", () => {
  assert.deepEqual(embedTo3D([], 3), [0, 0, 0]);
});

// ── vector helpers ───────────────────────────────────────────────────────────
test("cross / dot3 / normalize: basic identities", () => {
  assert.deepEqual(cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  assert.equal(dot3([1, 2, 3], [4, 5, 6]), 32);
  const u = normalize([3, 0, 0]);
  assert.deepEqual(u, [1, 0, 0]);
  assert.deepEqual(normalize([0, 0, 0]), [0, 0, 0]);   // degenerate guard
});

test("faceNormal: triangle in the z=0 plane has a +/-z normal", () => {
  const n = faceNormal([0, 0, 0], [1, 0, 0], [0, 1, 0]);
  assert.ok(Math.abs(Math.abs(n[2]) - 1) < 1e-12, `|nz| ~ 1, got ${n[2]}`);
  assert.ok(Math.abs(n[0]) < 1e-12 && Math.abs(n[1]) < 1e-12);
});

// ── orbitCamera ──────────────────────────────────────────────────────────────
test("orbitCamera: eye sits at radius dist from the origin", () => {
  for (const dist of [1, 3.2, 7]) {
    for (const yaw of [0, 1, -2]) {
      for (const pitch of [0, 0.5, -0.5]) {
        const cam = orbitCamera({ yaw, pitch, dist });
        const r = Math.hypot(cam.eye[0], cam.eye[1], cam.eye[2]);
        assert.ok(Math.abs(r - dist) < 1e-9, `radius ${r} != dist ${dist}`);
      }
    }
  }
});

test("orbitCamera: basis {right, up, fwd} is orthonormal", () => {
  const cam = orbitCamera({ yaw: 0.7, pitch: 0.4, dist: 3.2 });
  for (const v of [cam.right, cam.up, cam.fwd]) {
    assert.ok(Math.abs(Math.hypot(v[0], v[1], v[2]) - 1) < 1e-9, "unit length");
  }
  assert.ok(Math.abs(dot3(cam.right, cam.up)) < 1e-9, "right . up = 0");
  assert.ok(Math.abs(dot3(cam.right, cam.fwd)) < 1e-9, "right . fwd = 0");
  assert.ok(Math.abs(dot3(cam.up, cam.fwd)) < 1e-9, "up . fwd = 0");
});

test("orbitCamera: fwd points from the eye toward the origin", () => {
  const cam = orbitCamera({ yaw: 0.3, pitch: 0.2, dist: 4 });
  // origin - eye, normalized, should equal fwd.
  const toOrigin = normalize([-cam.eye[0], -cam.eye[1], -cam.eye[2]]);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(toOrigin[i] - cam.fwd[i]) < 1e-9);
});

test("orbitCamera: pitch is clamped away from the poles", () => {
  const cam = orbitCamera({ yaw: 0, pitch: 10, dist: 3 });   // absurd pitch
  // eye.y must be < dist (not exactly at the pole) since pitch clamps to < pi/2.
  assert.ok(cam.eye[1] < 3, "pitch clamp keeps eye below the pole");
  assert.ok(Number.isFinite(cam.right[0]), "basis stays finite at clamp");
});

// ── projectPerspective ───────────────────────────────────────────────────────
test("projectPerspective: a point in front projects to finite NDC with depth in [0,1]", () => {
  const cam = orbitCamera({ yaw: 0, pitch: 0, dist: 3 });
  const p = projectPerspective([0, 0, 0], cam, { aspect: 1 });   // the origin (camera looks at it)
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.ok(p.depth >= 0 && p.depth <= 1, `depth in [0,1], got ${p.depth}`);
  assert.equal(p.behind, false);
  // The origin is dead-center of the view -> NDC ~ (0,0).
  assert.ok(Math.abs(p.x) < 1e-6 && Math.abs(p.y) < 1e-6, "origin centers");
});

test("projectPerspective: nearer point (smaller view depth) has smaller normalized depth", () => {
  const cam = orbitCamera({ yaw: 0, pitch: 0, dist: 5 });   // eye at +z=5 looking at origin
  // A point at z=+1 is nearer the eye than one at z=-1 (eye is on +z).
  const near = projectPerspective([0, 0, 1], cam, { aspect: 1 });
  const far = projectPerspective([0, 0, -1], cam, { aspect: 1 });
  assert.ok(near.depth < far.depth, `near.depth ${near.depth} < far.depth ${far.depth}`);
});

test("projectPerspective: a point behind the camera is flagged behind", () => {
  const cam = orbitCamera({ yaw: 0, pitch: 0, dist: 3 });   // eye at +z=3
  // A point far on +z (behind the eye, away from origin) is behind the camera plane.
  const p = projectPerspective([0, 0, 10], cam, { aspect: 1 });
  assert.equal(p.behind, true);
});

test("projectPerspective: aspect scales x but not y", () => {
  const cam = orbitCamera({ yaw: 0, pitch: 0, dist: 4 });
  const wide = projectPerspective([0.5, 0.5, 0], cam, { aspect: 2 });
  const square = projectPerspective([0.5, 0.5, 0], cam, { aspect: 1 });
  // wider aspect (width>height) compresses x in NDC (divide by aspect), y unchanged.
  assert.ok(Math.abs(wide.x) < Math.abs(square.x) + 1e-12, "x compresses with aspect");
  assert.ok(Math.abs(wide.y - square.y) < 1e-9, "y independent of aspect");
});

test("projectPerspective: dollying the camera closer enlarges the projected extent", () => {
  // A fixed off-center point projects FARTHER from center as the camera dollies in (dist down).
  const p = [0.6, 0, 0];
  const far = projectPerspective(p, orbitCamera({ yaw: 0, pitch: 0, dist: 6 }), { aspect: 1 });
  const close = projectPerspective(p, orbitCamera({ yaw: 0, pitch: 0, dist: 2 }), { aspect: 1 });
  assert.ok(Math.abs(close.x) > Math.abs(far.x), `closer enlarges: ${close.x} vs ${far.x}`);
});
