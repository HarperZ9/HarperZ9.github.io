// plot-bridge.js: the crossings between mediums — where a build becomes a drawing and two
// sheets become one.
//
// The Studio's mediums each speak one of two languages. Everything raster (a fractal frame, a
// neural still, an atlas view, a photograph, whatever the shared canvas last showed) is a TONE
// FIELD, and plot-image.js already turns tone fields into strokes eight different ways. Everything
// constructed (a voxel build, a generative study) is GEOMETRY, and geometry can go to the pen
// directly — no rasterize-then-trace round trip that would smear exact edges into gradient soup.
//
// This module is the geometry crossing and the blend:
//
//   voxelSheet(scene)      a voxel build as an axonometric pen drawing: hidden-line removal
//                          against a depth raster, silhouette and crease edges chained into
//                          long strokes, faces hatched by their lit tone along their own axes.
//                          The same scene the painter shades and the .vox export serializes,
//                          drawn the way a draughtsman would ink it.
//   mergeSheets(a, b)      two sheets (any origin: generative, image, voxel) composed onto one
//                          sheet with one frame, one aspect, and provenance per part kept in the
//                          meta. This is what "blending mediums" means concretely: layers from
//                          different worlds sharing paper, pens, and the same measurement.
//
// Everything here is pure and deterministic: same scene, same sheet. The DOM-touching capture of
// the live canvas lives in studio.js; this module never sees a canvas.

import { isoOrder } from "./voxel.js";
import { faceAO } from "./voxel-forge.js";
import { chainSegments } from "./plotter.js";
import { measureSheet } from "./plot-compose.js";
import { jitter } from "./plot-marks.js";

function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Painter-identical projection, in units of one voxel edge (s = 1):
//   X = (x - y),  Y = (x + y) / 2 - z,  depth = x + y + z (larger = nearer the eye).
// The three visible faces of a cell, as corner offsets around (X, Y) — the exact parallelograms
// renderVoxelScene fills, so the drawing and the painting are the same object seen by two hands.
const TOP = [[0, -1], [1, -0.5], [0, 0], [-1, -0.5]];
const RIGHT = [[1, -0.5], [1, 0.5], [0, 1], [0, 0]];
const LEFT = [[-1, -0.5], [-1, 0.5], [0, 1], [0, 0]];
const FACE_BASE = { top: 1.0, right: 0.62, left: 0.42 };
const CORNERS = { top: TOP, right: RIGHT, left: LEFT };

const lumaOf = (rgb) => rgb ? (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255 : 0.5;

// ── faces ───────────────────────────────────────────────────────────────────
// Every exposed face of the scene, projected, with its lit tone — the painter's shading math
// (face base × baked AO × depth cue × material luminance) reused verbatim, because the drawing
// must agree with the painting about where the light is.
export function projectScene(scene) {
  const { vox, mat, palette } = scene;
  const list = isoOrder(vox);
  const depthMax = vox.nx + vox.ny + vox.nz;
  const faces = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of list) {
    const idx = (v.z * vox.ny + v.y) * vox.nx + v.x;
    const base = lumaOf(palette[mat[idx]] || palette[2]);
    const cue = 0.82 + 0.18 * (v.depth / depthMax);
    const X = v.x - v.y, Y = (v.x + v.y) / 2 - v.z;
    for (const name of ["top", "right", "left"]) {
      if (!v[name]) continue;
      const quad = CORNERS[name].map(([dx, dy]) => [X + dx, Y + dy]);
      for (const [qx, qy] of quad) {
        if (qx < minX) minX = qx; if (qx > maxX) maxX = qx;
        if (qy < minY) minY = qy; if (qy > maxY) maxY = qy;
      }
      faces.push({
        quad, name, depth: v.depth,
        tone: Math.max(0, Math.min(1, base * FACE_BASE[name] * faceAO(vox, v.x, v.y, v.z, name) * cue)),
      });
    }
  }
  return { faces, bbox: faces.length ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 1, maxY: 1 } };
}

// ── hidden-line removal ─────────────────────────────────────────────────────
// A depth raster at K samples per voxel edge: every face writes its depth into the cells its
// parallelogram covers, keeping the max (nearer wins). A stroke point on a face of depth d is
// visible where the raster holds ≤ d + 1.5 — faces that merely ABUT differ by 1 in depth (their
// cells are grid neighbours), while a face that genuinely covers another sits a full viewing ray
// away, which in this projection is exactly +3 per step. The 1.5 tolerance splits those regimes
// with room on both sides, so neighbours never eat each other's edges and true occluders always
// win. This is the classic depth-raster hidden-line method, and it handles PARTIAL occlusion —
// a ridge hiding half a wall — which no per-face yes/no test can.
const K = 6;

export function depthRaster(faces, bbox) {
  const w = Math.max(2, Math.ceil((bbox.maxX - bbox.minX) * K) + 2);
  const h = Math.max(2, Math.ceil((bbox.maxY - bbox.minY) * K) + 2);
  const buf = new Float32Array(w * h).fill(-Infinity);
  const toGX = (x) => (x - bbox.minX) * K + 1;
  const toGY = (y) => (y - bbox.minY) * K + 1;
  for (const f of faces) {
    const [p0, p1, , p3] = f.quad;
    // Parallelogram: p0 + u·(p1-p0) + v·(p3-p0), u,v ∈ [0,1]. Sample slightly inside the unit
    // square so abutting faces do not write over each other's boundary cells.
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1];
    const vx = p3[0] - p0[0], vy = p3[1] - p0[1];
    const n = 2 * K;
    for (let i = 0; i < n; i += 1) {
      const u = (i + 0.5) / n;
      for (let j = 0; j < n; j += 1) {
        const v = (j + 0.5) / n;
        const gx = Math.round(toGX(p0[0] + u * ux + v * vx));
        const gy = Math.round(toGY(p0[1] + u * uy + v * vy));
        if (gx < 0 || gy < 0 || gx >= w || gy >= h) continue;
        const at = gy * w + gx;
        if (f.depth > buf[at]) buf[at] = f.depth;
      }
    }
  }
  const depthAt = (x, y) => {
    const gx = Math.round(toGX(x)), gy = Math.round(toGY(y));
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return -Infinity;
    return buf[gy * w + gx];
  };
  return { depthAt };
}

// Walk a stroke in short steps and keep the runs the raster says are frontmost. Splitting is the
// point: a line that dips behind a ridge comes back as two strokes, which is what hidden-line
// removal IS.
export function clipHidden(line, depth, raster, tol = 1.5) {
  const out = [];
  let run = null;
  const step = 0.5 / K;
  for (let i = 1; i < line.length; i += 1) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i];
    const L = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(L / step));
    for (let s = 0; s <= n; s += 1) {
      const t = s / n;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (raster.depthAt(x, y) <= depth + tol) {
        if (!run) run = [];
        if (!run.length || Math.hypot(x - run[run.length - 1][0], y - run[run.length - 1][1]) > 1e-9) run.push([x, y]);
      } else if (run) {
        if (run.length > 1) out.push(run);
        run = null;
      }
    }
  }
  if (run && run.length > 1) out.push(run);
  return out;
}

// ── the drawing ─────────────────────────────────────────────────────────────
const ekey = (p, q) => {
  const a = `${Math.round(p[0] * 16)},${Math.round(p[1] * 16)}`;
  const b = `${Math.round(q[0] * 16)},${Math.round(q[1] * 16)}`;
  return a < b ? a + "|" + b : b + "|" + a;
};

/**
 * voxelSheet(scene, opts) → { layers, meta } in the plot pipeline's own shape.
 * opts: { density }. Edge logic: an edge drawn ONCE in the projection is silhouette; an edge
 * shared by faces of different orientation is a crease (the corner of a cube); an edge shared by
 * two same-orientation faces of similar tone is a coplanar continuation and vanishes, which is
 * what fuses ten adjacent cube tops into one clean plateau outline. Same orientation but a real
 * tone jump keeps a light value edge, so material bands still read.
 */
export function voxelSheet(scene, opts = {}) {
  const density = Math.max(0.3, Math.min(2.5, opts.density == null ? 1 : opts.density));
  const { faces, bbox } = projectScene(scene);
  const raster = depthRaster(faces, bbox);

  // Edges, deduplicated across the whole projection.
  const edges = new Map();
  for (const f of faces) {
    for (let i = 0; i < 4; i += 1) {
      const p = f.quad[i], q = f.quad[(i + 1) % 4];
      const k = ekey(p, q);
      const rec = edges.get(k);
      if (!rec) edges.set(k, { p, q, faces: [f] });
      else rec.faces.push(f);
    }
  }
  const outline = [], value = [];
  for (const rec of edges.values()) {
    const depth = Math.max(...rec.faces.map((f) => f.depth));
    if (rec.faces.length === 1) { outline.push({ seg: [rec.p, rec.q], depth }); continue; }
    const orientations = new Set(rec.faces.map((f) => f.name));
    if (orientations.size > 1) { outline.push({ seg: [rec.p, rec.q], depth }); continue; }
    const tones = rec.faces.map((f) => f.tone);
    if (Math.max(...tones) - Math.min(...tones) > 0.14) value.push({ seg: [rec.p, rec.q], depth });
  }

  // Chain first (long strokes travel well), then clip each chain against the raster at the depth
  // of its own segments. Chaining mixes depths, so clip pre-chain per edge, then chain survivors.
  const clipSet = (set) => {
    const segs = [];
    for (const e of set) {
      for (const run of clipHidden(e.seg, e.depth, raster)) {
        for (let i = 1; i < run.length; i += 1) segs.push([run[i - 1], run[i]]);
      }
    }
    return chainSegments(segs);
  };
  const outlineLines = clipSet(outline);
  const valueLines = clipSet(value);

  // Hatching: each face shaded along its own axes, line count from darkness. Tops stay airy
  // (light from above), walls carry the tone — and every hatch is clipped by the raster, so a
  // half-hidden wall is hatched exactly where it shows.
  const hatch = [];
  for (const f of faces) {
    const dark = 1 - f.tone;
    const maxN = f.name === "top" ? 3 : 6;
    const n = Math.round(dark * maxN * density);
    if (n <= 0) continue;
    const [p0, p1, p2, p3] = f.quad;
    for (let i = 1; i <= n; i += 1) {
      const t = i / (n + 1);
      const a = [p0[0] + (p3[0] - p0[0]) * t, p0[1] + (p3[1] - p0[1]) * t];
      const b = [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t];
      for (const run of clipHidden([a, b], f.depth, raster)) hatch.push(run);
    }
  }

  // Into sheet space: the drawing's own aspect, margins equal on both axes, isotropic scale —
  // the same identity sheetPlacement keeps for pictures.
  const margin = 0.045;
  const bw = Math.max(1e-6, bbox.maxX - bbox.minX), bh = Math.max(1e-6, bbox.maxY - bbox.minY);
  const aspect = bh / bw;
  const side = 1 - 2 * margin;
  const place = ([x, y]) => [
    margin + ((x - bbox.minX) / bw) * side,
    margin + ((y - bbox.minY) / bh) * side,
  ];
  const N = (lines) => lines.map((l) => l.map(place));

  const layers = [];
  if (hatch.length) layers.push({ name: "shade", polylines: N(hatch), weight: 0.6, tone: "ink" });
  if (valueLines.length) layers.push({ name: "value-edges", polylines: N(valueLines), weight: 0.7, tone: "ink" });
  if (outlineLines.length) layers.push({ name: "silhouette", polylines: N(outlineLines), weight: 1.2, tone: "ink" });
  // The plate mark every sheet in the pipeline carries — and the frame mergeSheets keeps.
  const rng = mulberry(hash32(String(scene.meta.seed) + "#plate"));
  const fb = [[margin, margin], [1 - margin, margin], [1 - margin, 1 - margin], [margin, 1 - margin], [margin, margin]];
  layers.push({ name: "frame", polylines: [jitter(fb, rng, { wander: 0.0005 })], weight: 1.5, tone: "ink" });

  let strokes = 0, points = 0;
  for (const l of layers) { strokes += l.polylines.length; for (const p of l.polylines) points += p.length; }
  return {
    layers,
    meta: {
      kind: "voxel",
      seed: scene.meta.seed,
      study: "voxel-" + scene.meta.study,
      label: "Voxel " + scene.meta.study,
      aspect, density,
      voxels: scene.meta.voxels,
      edits: scene.meta.edits || 0,
      faces: faces.length,
      strokes, points,
      measure: measureSheet(layers),
    },
  };
}

// ── the blend ───────────────────────────────────────────────────────────────
/**
 * mergeSheets(base, overlay, mode) → one sheet. mode: "under" draws the overlay's layers before
 * the base (a generative field as the ground the subject sits on), "over" draws them after (the
 * field breaking across the subject). One frame survives — the base's, since the base owns the
 * paper — and the merged sheet is re-measured whole, because a blend is a new composition, not
 * two receipts stapled together. Both parts keep their provenance in meta.parts.
 */
export function mergeSheets(base, overlay, mode = "under") {
  const strip = (sheet) => sheet.layers.filter((l) => l.name !== "frame");
  const frame = base.layers.filter((l) => l.name === "frame");
  const over = strip(overlay).map((l) => ({ ...l, name: "blend-" + l.name }));
  const own = strip(base);
  const layers = (mode === "over" ? [...own, ...over] : [...over, ...own]).concat(frame);
  let strokes = 0, points = 0;
  for (const l of layers) { strokes += l.polylines.length; for (const p of l.polylines) points += p.length; }
  return {
    layers,
    meta: {
      kind: "blend",
      seed: base.meta.seed,
      study: base.meta.study,
      label: (base.meta.label || base.meta.study) + " × " + (overlay.meta.label || overlay.meta.study),
      register: base.meta.register || overlay.meta.register || null,
      aspect: base.meta.aspect || 1,
      mode,
      strokes, points,
      parts: [
        { kind: base.meta.kind || "field", study: base.meta.study, strokes: base.meta.strokes },
        { kind: overlay.meta.kind || "field", study: overlay.meta.study, strokes: overlay.meta.strokes },
      ],
      measure: measureSheet(layers),
    },
  };
}
