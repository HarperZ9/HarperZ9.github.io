// index.mjs — render-nd public API.
export * from "./core/polytopes.mjs";
export * from "./core/rotate.mjs";
export * from "./core/project.mjs";
export { depthCue } from "./core/depth.mjs";

import { polytope } from "./core/polytopes.mjs";
import { spinningPlanes, rotateND } from "./core/rotate.mjs";
import { project } from "./core/project.mjs";
import { depthCue } from "./core/depth.mjs";

// renderScene — turn a scene description into a backend-agnostic drawable in normalized [-1,1] space.
export function renderScene(scene = {}) {
  const kind = scene.kind || "cube";
  const n = kind === "24cell" ? 4 : (scene.n || 4);
  const t = scene.t || 0;
  const rotation = scene.rotation || "all";
  const projection = scene.projection || { mode: "perspective", dist: 3 };
  const scale = scene.scale == null ? 0.5 : scene.scale;

  const { verts, edges } = polytope(kind, n);
  const planes = n >= 2 ? spinningPlanes(n, t, rotation) : [];
  const rot = planes.length ? rotateND(verts, planes) : verts;
  const proj = rot.map((v) => project(v, projection));

  // Normalize depth across the scene for cueing.
  let dmin = Infinity, dmax = -Infinity;
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const p of proj) {
    if (p.depth < dmin) dmin = p.depth;
    if (p.depth > dmax) dmax = p.depth;
    if (p.x < xmin) xmin = p.x;
    if (p.x > xmax) xmax = p.x;
    if (p.y < ymin) ymin = p.y;
    if (p.y > ymax) ymax = p.y;
  }
  const span = dmax - dmin || 1;
  const cue = (d) => depthCue((d - dmin) / span);

  // Normalize xy to [-1,1] space
  const xmid = (xmin + xmax) / 2, ymid = (ymin + ymax) / 2;
  const xrad = (xmax - xmin) / 2 || 1;
  const rad = Math.max(xrad, (ymax - ymin) / 2 || 1) || 1;

  const points = proj.map((p) => {
    const c = cue(p.depth);
    const xn = (p.x - xmid) / rad * scale;
    const yn = (p.y - ymid) / rad * scale;
    return { x: xn, y: yn, size: c.size, opacity: c.opacity, color: c.color };
  });
  const segments = edges.map(([i, j]) => {
    const a = points[i], b = points[j];
    const opacity = Math.min(a.opacity, b.opacity);
    // segment colour = the nearer endpoint's colour
    const color = a.opacity >= b.opacity ? a.color : b.color;
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, opacity, color };
  });
  return { points, segments, meta: { kind, n, t, projection: projection.mode, vertices: points.length, edges: segments.length } };
}
