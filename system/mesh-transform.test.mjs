import { test } from "node:test";
import assert from "node:assert/strict";

import {cloneMesh, meshBounds, meshStats, normalizeMesh, transformMesh, drawMeshPreview } from "./mesh-transform.js";

const TRI = {
  vertices: [[0, 0, 0], [2, 0, 0], [0, 4, 0]],
  faces: [[0, 1, 2]],
};

test("cloneMesh preserves topology without aliasing source arrays", () => {
  const c = cloneMesh(TRI);
  assert.deepEqual(c.faces, TRI.faces);
  c.vertices[0][0] = 99;
  assert.equal(TRI.vertices[0][0], 0);
});

test("meshBounds reports center, size, and radius", () => {
  const b = meshBounds(TRI);
  assert.deepEqual(b.center, [1, 2, 0]);
  assert.deepEqual(b.size, [2, 4, 0]);
  assert.equal(Number(b.radius.toFixed(6)), Number(Math.sqrt(5).toFixed(6)));
});

test("normalizeMesh centers mesh and scales it into a unit radius", () => {
  const n = normalizeMesh(TRI);
  const b = meshBounds(n);
  assert.ok(Math.abs(b.center[0]) < 1e-12);
  assert.ok(Math.abs(b.center[1]) < 1e-12);
  assert.ok(Math.abs(b.radius - 1) < 1e-12);
});

test("transformMesh applies scale, rotation, and translation while preserving faces", () => {
  const out = transformMesh(TRI, { scale: 2, rotateZ: 90, translateX: 1, translateY: -1 });
  assert.deepEqual(out.faces, TRI.faces);
  assert.ok(Math.abs(out.vertices[1][0] - 1) < 1e-9);
  assert.ok(Math.abs(out.vertices[1][1] - 3) < 1e-9);
  const stats = meshStats(out);
  assert.equal(stats.vertices, 3);
  assert.equal(stats.faces, 1);
});


/* ── viewport preview: shading modes over a stub 2d context ─────────────── */
function stubCanvas(width = 640, height = 480) {
  const log = [];
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy({}, {
    get(t, prop) {
      if (prop === "createRadialGradient" || prop === "createLinearGradient") return () => gradient;
      if (prop in t) return t[prop];
      if (typeof prop === "symbol") return undefined;
      return (...args) => { log.push([prop, ...args.map((a) => (typeof a === "number" ? Number(a.toFixed(4)) : String(a)))]); };
    },
    set(t, prop, value) { t[prop] = value; log.push(["set:" + String(prop), String(value)]); return true; },
  });
  return {
    log,
    canvas: {
      width: 0, height: 0,
      getBoundingClientRect: () => ({ width, height }),
      getContext: () => ctx,
    },
  };
}

const CUBE = {
  vertices: [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
  faces: [[0,1,2],[0,2,3],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[2,3,7],[2,7,6]],
};

test("drawMeshPreview renders each shading mode and honors the camera", () => {
  for (const shading of ["wire", "solid", "points"]) {
    const { canvas, log } = stubCanvas();
    const ok = drawMeshPreview(canvas, CUBE, { shading, cameraYaw: 50, cameraPitch: -10, cameraDist: 4 });
    assert.equal(ok, true, shading + " should render");
    assert.ok(log.length > 20, shading + " drew only " + log.length + " ops");
  }
  // A different camera produces a different draw log for the same mesh.
  const a = stubCanvas(); drawMeshPreview(a.canvas, CUBE, { shading: "wire", cameraYaw: 10 });
  const b = stubCanvas(); drawMeshPreview(b.canvas, CUBE, { shading: "wire", cameraYaw: 80 });
  assert.notDeepEqual(a.log, b.log, "camera yaw should change the projection");
});
