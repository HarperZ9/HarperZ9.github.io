// The world of "One box, many eyes": one box on one floor, seen through a faceted lens. The
// lens is the aperture of the inspiration corpus and the guide Rerun's glass shell; each facet
// shows the same box through one of raw-native's passes, and each chapter is a camera move into
// one facet. This file holds the palette, the cue clock, the lens, the box and the source tab.
// The scene adds no claim: every number comes from evidence.json's facts block by key.
import { contour, rect, transform } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { text } from "../../../raw-native/tree-c6b114d/web/motion/text.mjs";
import { span, window, ease, lerp } from "../../../raw-native/tree-c6b114d/web/motion/timeline.mjs";

// Storyboard colour script: void ground, bone ink, one hot mark (drift ember) on "refuted".
export const C = Object.freeze({
  void: [0.012, 0.012, 0.016], ink: "#ece5d6", ink2: "#b8b0a0", dim: "#8e877b", faint: "#3b3833",
  hot: "#e29472", ok: "#63d4ce", glass: "#bfe6ea",
});

// Cue times from timing.json: at(seg, line, sentence) is a sentence start, word() a phrase in it.
export function cues(timing) {
  const rows = new Map(timing.filter((r) => r.predict == null).map((r) => [`${r.segment}.${r.line}.${r.sentence ?? 0}`, r]));
  const row = (s, l, k = 0) => { const r = rows.get(`${s}.${l}.${k}`); if (!r) throw new Error(`no sentence ${s}.${l}.${k}`); return r; };
  return {
    at: (s, l, k = 0) => row(s, l, k).start,
    end: (s, l, k = 0) => row(s, l, k).end,
    word: (s, l, k, phrase) => {
      const r = row(s, l, k), i = r.text.indexOf(phrase);
      if (i < 0) throw new Error(`"${phrase}" not in "${r.text}"`);
      return r.start + (r.end - r.start) * (i / r.text.length);
    },
    // A spoken predict question: segment s, its n-th pause (timing rows keyed by "predict").
    ask: (s, n = 0) => { const r = timing.find((x) => x.segment === s && x.predict === n); if (!r) throw new Error(`no question ${s}.${n}`); return r; },
    last: timing[timing.length - 1].end,
  };
}

// A number from evidence.json's facts block, as the scene shows it.
export const fact = (ev, key) => {
  const f = ev.facts.values[key];
  if (!f) throw new Error(`no fact ${key}`);
  return f.show ?? String(f.value);
};

// The lens: FACETS facets in a ring around a void core. Order is the film's order.
export const FACETS = ["check", "bytes", "lines", "colour", "tube", "film", "paint", "tape", "pixel", "dither", "models", "retro", "lit"];
export const LENS = { x: 960, y: 540, r0: 190, r1: 470, gap: 0.026 };
// A facet's content is the 1920 x 1080 design frame scaled by CS and centred in the facet.
export const CS = 0.055, ZF = 1 / CS, ZL = 1.0;
const N = FACETS.length;

export function facet(k) {
  const a0 = -Math.PI / 2 + (k / N) * Math.PI * 2 + LENS.gap, a1 = -Math.PI / 2 + ((k + 1) / N) * Math.PI * 2 - LENS.gap, am = (a0 + a1) / 2;
  const p = (a, r) => [LENS.x + Math.cos(a) * r, LENS.y + Math.sin(a) * r];
  const poly = [...p(a0, LENS.r0), ...p(a0, LENS.r1), ...p(am, LENS.r1 + 22), ...p(a1, LENS.r1), ...p(a1, LENS.r0), ...p(am, LENS.r0 - 10)];
  const rm = (LENS.r0 + LENS.r1) / 2, [cx, cy] = p(am, rm);
  // Fresnel ridges: fine arcs across the facet, the lighthouse lens's line-work.
  const ridges = [];
  for (let r = LENS.r0 + 16; r < LENS.r1; r += 15) ridges.push(contour([...p(a0 + 0.01, r), ...p(am, r + 4), ...p(a1 - 0.01, r)], false));
  return { k, key: FACETS[k], a0, a1, am, cx, cy, shape: [contour(poly, true)], ridges };
}
export const FACET = Object.fromEntries(FACETS.map((key, k) => [key, facet(k)]));

// Content drawn in the design frame, placed into a facet: shapes scaled by CS about the facet
// centre and clipped to the facet's glass.
export function inFacet(items, key) {
  const f = FACET[key], m = [CS, 0, 0, CS, f.cx - 960 * CS, f.cy - 540 * CS];
  return items.map((it) => ({ ...it, shape: transform(it.shape, m), width: it.width ? it.width * CS : it.width, clip: f.shape }));
}
export const cameraOn = (key) => ({ x: FACET[key].cx, y: FACET[key].cy, zoom: ZF });
export const LENS_CAM = { x: LENS.x, y: LENS.y, zoom: ZL };

// A move from camera a to camera b over [t0, t1]: out to the lens and back in, zoom in log space.
export function move(t, a, b, t0, t1) {
  const u = span(t, t0, t1, ease.linear);
  if (u <= 0) return a;
  if (u >= 1) return b;
  const via = { x: LENS.x, y: LENS.y, zoom: Math.min(1.35, a.zoom, b.zoom) };
  const [p, q, v] = u < 0.5 ? [a, via, ease.smooth(u * 2)] : [via, b, ease.smooth(u * 2 - 1)];
  return { x: lerp(p.x, q.x, v), y: lerp(p.y, q.y, v), zoom: Math.exp(lerp(Math.log(p.zoom), Math.log(q.zoom), v)) };
}

// The box: a 10 x 10 floor, a box two units tall, one directional light (the ao-check scene).
export const LIGHT = norm([-0.62, 0.72, 0.31]);
function norm(v) { const l = Math.hypot(...v); return v.map((x) => x / l); }
export const BOX = { h: 2, w: 2, floor: 5 };
const FACES = [
  { n: [0, 1, 0], v: [[-1, 2, -1], [1, 2, -1], [1, 2, 1], [-1, 2, 1]] },
  { n: [0, 0, 1], v: [[-1, 0, 1], [1, 0, 1], [1, 2, 1], [-1, 2, 1]] },
  { n: [0, 0, -1], v: [[1, 0, -1], [-1, 0, -1], [-1, 2, -1], [1, 2, -1]] },
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, -1], [1, 2, -1], [1, 2, 1]] },
  { n: [-1, 0, 0], v: [[-1, 0, -1], [-1, 0, 1], [-1, 2, 1], [-1, 2, -1]] },
];

// A camera orbiting the box: yaw and pitch in degrees, distance in units, the frame centre.
export function view({ yaw = 32, pitch = 24, dist = 13, f = 1250, cx = 960, cy = 600 } = {}) {
  const y = (yaw * Math.PI) / 180, p = (pitch * Math.PI) / 180;
  const eye = [dist * Math.sin(y) * Math.cos(p), 1 + dist * Math.sin(p), dist * Math.cos(y) * Math.cos(p)];
  const fw = norm([-eye[0], 1 - eye[1], -eye[2]]), rt = norm([-fw[2], 0, fw[0]]);
  const up = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
  const proj = ([X, Y, Z]) => {
    const d = [X - eye[0], Y - eye[1], Z - eye[2]], z = d[0] * fw[0] + d[1] * fw[1] + d[2] * fw[2];
    return [cx + (f * (d[0] * rt[0] + d[1] * rt[1] + d[2] * rt[2])) / z, cy - (f * (d[0] * up[0] + d[1] * up[1] + d[2] * up[2])) / z];
  };
  return { eye, proj };
}

const shade = (n, light = LIGHT) => Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
const grey = (v, tint = [1, 0.97, 0.9]) => tint.map((c) => Math.min(1, Math.max(0, v * c)));

// The box as vector items in the design frame. opts: v (a view), exposure, tint, edges, floorGrid,
// faceColour(n, lambert) to recolour a face, snap (round projected points to a grid of snap units).
export function box(v, opts = {}) {
  const { exposure = 1, tint, edges = C.ink, edgeWidth = 2.2, floorGrid = true, faceColour = null, snap = 0, shadow = true } = opts;
  const P = (q) => { const s = v.proj(q); return snap ? s.map((c) => Math.floor(c / snap + 0.5) * snap) : s; };
  const items = [], F = BOX.floor;
  const fl = [[-F, 0, -F], [F, 0, -F], [F, 0, F], [-F, 0, F]].flatMap(P);
  items.push({ shape: [contour(fl, true)], fill: grey(0.2 * exposure, tint) });
  if (floorGrid) for (let i = -F; i <= F; i++) {
    items.push({ shape: [contour([...P([i, 0, -F]), ...P([i, 0, F])], false)], stroke: C.ink, width: 0.8, opacity: 0.16 });
    items.push({ shape: [contour([...P([-F, 0, i]), ...P([F, 0, i])], false)], stroke: C.ink, width: 0.8, opacity: 0.16 });
  }
  if (shadow) {
    // The box's shadow on the floor, along the light.
    const k = BOX.h / LIGHT[1], top = [[-1, 2, -1], [1, 2, -1], [1, 2, 1], [-1, 2, 1]].map(([x, , z]) => [x - LIGHT[0] * k, 0, z - LIGHT[2] * k]);
    const pts = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], ...top].map(P);
    items.push({ shape: [contour(hull(pts).flat(), true)], fill: [0, 0, 0], opacity: 0.45 });
  }
  for (const face of FACES) {
    const c = face.v.reduce((a, q) => a.map((x, i) => x + q[i] / 4), [0, 0, 0]), toEye = v.eye.map((e, i) => e - c[i]);
    if (toEye[0] * face.n[0] + toEye[1] * face.n[1] + toEye[2] * face.n[2] <= 0) continue;
    const lam = 0.18 + 0.82 * shade(face.n);
    const fill = faceColour ? faceColour(face.n, lam) : grey(lam * 0.92 * exposure, tint);
    items.push({ shape: [contour(face.v.flatMap(P), true)], fill, stroke: edges, width: edgeWidth, join: "round" });
  }
  return items;
}

// Convex hull (monotone chain) of 2D points.
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

// Type: labels are screen-space fills. The source tab sits top left (the films' caption rule).
export const T = (A, s, { size = 34, x = 960, y = 540, anchor = "center", atlas = "sans" } = {}) => text(s, { atlas: A[atlas], size, x, y, anchor }).shape;
export const put = (items, shape, color, o, extra = {}) => { if (o > 0.004) items.push({ shape, fill: color, opacity: Math.min(1, o), screen: true, ...extra }); };
export function tab(A, ev, id, extra = "") {
  const e = ev.sources[id];
  return text(`${e.short}${extra ? " . " + extra : ""}`, { atlas: A.mono, size: 28, x: 96, y: 66 }).shape;
}
// A claim tag: one short phrase in the drift ink, under the tab.
export const tag = (A, s, y = 108) => text(s, { atlas: A.mono, size: 28, x: 96, y }).shape;
// A soft plate behind type that sits over art.
export const plate = (x, y, w, h, o = 0.7) => ({ shape: rect(x, y, w, h, 14), fill: [0.01, 0.01, 0.014], opacity: o, blur: 12, screen: true });

export { span, window, ease, lerp, contour, rect };
