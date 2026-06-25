// index.mjs - render-nd public API.
export * from "./core/polytopes.mjs";
export * from "./core/rotate.mjs";
export * from "./core/project.mjs";
export * from "./core/faces.mjs";
export * from "./core/embed3d.mjs";
export * from "./core/pick.mjs";
export * from "./core/paint-state.mjs";
export { depthCue } from "./core/depth.mjs";

import { polytope } from "./core/polytopes.mjs";
import { spinningPlanes, rotateND } from "./core/rotate.mjs";
import { project } from "./core/project.mjs";
import { depthCue } from "./core/depth.mjs";
import { polytopeFaces } from "./core/faces.mjs";
import { embedTo3D, orbitCamera, projectPerspective, faceNormal } from "./core/embed3d.mjs";
import { faceColor as paintFaceColor, vertexColor as paintVertexColor, edgeColor as paintEdgeColor } from "./core/paint-state.mjs";

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

// ============================================================================
// renderSceneVolumetric - the TRUE 3D path (volume, not a flat plane).
// ============================================================================
// nD rotation (same Givens math) -> 3D embedding -> orbit camera -> PERSPECTIVE projection with a
// real depth axis. Returns NDC-projected faces (triangles), edges, and points, each carrying a
// normalized depth (0 = near) for depth-cued shading + painter-order sorting + a GPU depth test.
// Paint overrides (per face/vertex/edge colour) from a paint-state are applied on top of the
// depth-cue shading. Also returns the world-space vertices + the camera so the caller can build a
// pick ray. Pure: no DOM. ASCII only.
//
// scene: { kind, n, t, rotation }            (geometry + animation, same as renderScene)
// camera: { yaw, pitch, dist }               (orbit camera state)
// opts: { aspect, focal, near, far, embedDist, scale, paint }
//   paint: a paint-state (createPaintState); when present, its colour maps + toggles are honoured.
export function renderSceneVolumetric(scene = {}, camera = {}, opts = {}) {
  const kind = scene.kind || "cube";
  const n = kind === "24cell" ? 4 : (scene.n || 4);
  const t = scene.t || 0;
  const rotation = scene.rotation || "all";
  const embedDist = opts.embedDist == null ? 3.0 : opts.embedDist;
  const scale = opts.scale == null ? 1.0 : opts.scale;
  const aspect = opts.aspect == null ? 1.0 : opts.aspect;
  const focal = opts.focal == null ? 2.0 : opts.focal;
  const near = opts.near == null ? 0.05 : opts.near;
  const far = opts.far == null ? 100.0 : opts.far;
  const paint = opts.paint || null;

  const { verts, edges } = polytope(kind, n);
  const faces = polytopeFaces(kind, n, verts);

  // 1) nD rotation (parity with the flat path).
  const planes = n >= 2 ? spinningPlanes(n, t, rotation) : [];
  const rot = planes.length ? rotateND(verts, planes) : verts;

  // 2) embed to 3D, then normalize the embedded cloud into a unit-ish ball so framing is stable
  //    across kinds/dimensions (the camera distance then controls zoom).
  const e3 = rot.map((v) => embedTo3D(v, embedDist));
  let maxR = 0;
  for (const p of e3) { const r = Math.hypot(p[0], p[1], p[2]); if (r > maxR) maxR = r; }
  const norm = (maxR > 1e-6 ? 1 / maxR : 1) * scale;
  const world = e3.map((p) => [p[0] * norm, p[1] * norm, p[2] * norm]);

  // 3) camera + perspective projection of every vertex.
  const cam = orbitCamera(camera);
  const projOpts = { aspect, focal, near, far };
  const proj = world.map((p) => projectPerspective(p, cam, projOpts));

  // 3b) scene-relative depth normalization. The raw linear depth across [near, far] compresses a
  // small object into a sliver near 0, so the depth cue (and the GPU clip-z) would be nearly flat.
  // Remap each vertex's view-space distance (vz) across the SCENE's own [vzMin, vzMax] to [0,1]
  // (0 = nearest vertex, 1 = farthest), exactly like the flat path normalizes dmin/dmax. This makes
  // the volume read with a full near->far cue and a well-spread depth buffer. behind vertices keep 1.
  let vzMin = Infinity, vzMax = -Infinity;
  for (const p of proj) { if (p.behind) continue; if (p.vz < vzMin) vzMin = p.vz; if (p.vz > vzMax) vzMax = p.vz; }
  const vzSpan = vzMax - vzMin;
  const normDepth = (p) => {
    if (p.behind || !Number.isFinite(vzMin) || vzSpan < 1e-9) return p.behind ? 1 : 0.5;
    const d = (p.vz - vzMin) / vzSpan;
    return d < 0 ? 0 : d > 1 ? 1 : d;
  };
  // Overwrite each projected vertex's depth with the scene-normalized value so every consumer
  // (cue shading, painter sort, GPU clip-z) uses the same spread depth.
  for (const p of proj) p.depth = normDepth(p);

  // depth-cue: nearer (smaller depth) = brighter/amber, farther = dim/teal. Reuse depthCue with the
  // convention t=1 near, t=0 far, so invert the normalized depth.
  const cueAt = (depth) => depthCue(1 - Math.max(0, Math.min(1, depth)));

  // 4) build draw lists.
  const showFaces = paint ? paint.showFaces && !paint.wireframe : true;
  const showEdges = paint ? paint.showEdges : true;
  const showVertices = paint ? paint.showVertices : true;

  // points (vertices)
  const points = [];
  if (showVertices) {
    for (let i = 0; i < proj.length; i++) {
      const p = proj[i];
      if (p.behind) continue;
      const c = cueAt(p.depth);
      const override = paint ? paintVertexColor(paint, i) : null;
      points.push({
        x: p.x, y: p.y, depth: p.depth,
        size: c.size, opacity: override ? 1.0 : c.opacity,
        color: override || c.color,
        vertexIndex: i,
      });
    }
  }

  // segments (edges)
  const segments = [];
  if (showEdges) {
    for (let e = 0; e < edges.length; e++) {
      const [i, j] = edges[e];
      const a = proj[i], b = proj[j];
      if (a.behind || b.behind) continue;
      const depth = (a.depth + b.depth) / 2;
      const c = cueAt(depth);
      const override = paint ? paintEdgeColor(paint, e) : null;
      segments.push({
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        depth, opacity: override ? 1.0 : c.opacity,
        color: override || c.color,
        edgeIndex: e,
      });
    }
  }

  // faces (triangles) with a Lambert-ish shade from the world-space normal + depth cue.
  const L = [0.4, 0.75, 0.55];   // a fixed key-light direction (normalized below)
  const Ln = Math.hypot(L[0], L[1], L[2]); L[0] /= Ln; L[1] /= Ln; L[2] /= Ln;
  const tris = [];
  if (showFaces) {
    for (let fi = 0; fi < faces.length; fi++) {
      const f = faces[fi];
      const a = proj[f[0]], b = proj[f[1]], c = proj[f[2]];
      if (a.behind || b.behind || c.behind) continue;
      const wn = faceNormal(world[f[0]], world[f[1]], world[f[2]]);
      // double-sided Lambert (abs) so inner faces of the closed hull still read.
      const lambert = Math.abs(wn[0] * L[0] + wn[1] * L[1] + wn[2] * L[2]);
      const shade = 0.32 + 0.68 * lambert;          // ambient floor + diffuse
      const depth = (a.depth + b.depth + c.depth) / 3;
      const cue = cueAt(depth);
      const override = paint ? paintFaceColor(paint, fi) : null;
      const base = override || cue.color;
      const color = [
        Math.round(base[0] * shade),
        Math.round(base[1] * shade),
        Math.round(base[2] * shade),
      ];
      // translucent faces so overlapping hull surfaces compose (volume reads), painted faces denser.
      const opacity = override ? 0.85 : 0.42;
      tris.push({
        x1: a.x, y1: a.y, x2: b.x, y2: b.y, x3: c.x, y3: c.y,
        depth, opacity, color, faceIndex: fi,
      });
    }
  }

  // painter's order: far -> near for translucent faces (so nearer faces draw over farther ones).
  tris.sort((p, q) => q.depth - p.depth);

  return {
    points, segments, faces: tris,
    world, cam, proj, edges, faceIndices: faces,
    meta: {
      kind, n, t, projection: "perspective3d",
      vertices: proj.length, edges: edges.length, faceCount: faces.length,
    },
  };
}
