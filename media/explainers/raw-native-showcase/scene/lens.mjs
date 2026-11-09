// The lens and the title. The lens gathers from its own line-work (facet edges and fresnel
// ridges drawn on), the title sits in the void at its core, and each facet carries a small
// preview of the box in that facet's look. A facet lights when the film first enters it and
// stays lit, so the close shows every facet lit. The spectrum lives only inside the glass.
import { trim, transform } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { C, FACETS, FACET, LENS, box, view, inFacet, put, T, span, window, ease } from "./world.mjs";

// Each facet's preview: the same box, recoloured toward its look (art layer only).
const LOOK = {
  check: (n, l) => [l * 0.8, l * 0.8, l * 0.8],
  bytes: (n, l) => [l * 0.9, l * 0.88, l * 0.82],
  lines: () => [0.02, 0.02, 0.03],
  colour: (n, l) => [Math.min(1, l * 1.6), Math.min(1, l * 1.25), l * 0.8],
  tube: (n, l) => [l * 0.35, l * 0.95, l * 0.55],
  film: (n, l) => [l * 1.0, l * 0.62, l * 0.36],
  paint: (n, l) => (n[1] ? [0.86 * l, 0.66 * l, 0.22 * l] : n[0] ? [0.18, 0.3 * l, 0.62 * l] : [0.55 * l, 0.32 * l, 0.2 * l]),
  tape: (n, l) => [l * 0.85, l * 0.45, l * 0.75],
  pixel: (n, l) => [l * 0.75, l * 0.55, l * 0.4],
  dither: (n, l) => (l > 0.7 ? [0.33, 1, 1] : l > 0.4 ? [1, 0.33, 1] : [0, 0, 0.67]),
  models: (n, l) => [l * 0.7, l * 0.75, l * 0.8],
  retro: (n, l) => [l * 0.6, l * 0.5, l * 0.9],
  lit: (n, l) => (n[0] ? [1, 0.55 * l, 0.25] : n[2] ? [0.25, 0.5 * l, 1] : [l, l, l * 0.9]),
};
const SNAP = { pixel: 40, dither: 40, retro: 26 };

export function prepare(A) {
  A.lens = {
    previews: Object.fromEntries(FACETS.map((key) => [key, inFacet(box(view({ yaw: 34, pitch: 22, dist: 9.5 }), {
      faceColour: LOOK[key], snap: SNAP[key] || 0, edges: key === "lines" ? C.ink : C.ink, edgeWidth: key === "lines" ? 6 : 2.4 }), key)])),
    title: [T(A, "One box,", { size: 56, x: LENS.x, y: LENS.y - 10, atlas: "head" }), T(A, "many eyes.", { size: 56, x: LENS.x, y: LENS.y + 60, atlas: "head" })],
  };
}

// Draw the lens. draw: 0..1 of the line-work drawn on; lit(key): 0..1 how lit each facet is;
// spin: radians the whole lens has turned (the close turns it once).
export function draw(t, A, { draw = 1, lit = () => 1, spin = 0, alpha = 1, cam = null }, items) {
  if (alpha <= 0) return;
  const rot = spin ? [Math.cos(spin), Math.sin(spin), -Math.sin(spin), Math.cos(spin), LENS.x - LENS.x * Math.cos(spin) + LENS.y * Math.sin(spin), LENS.y - LENS.x * Math.sin(spin) - LENS.y * Math.cos(spin)] : null;
  const R = (shape) => (rot ? transform(shape, rot) : shape);
  FACETS.forEach((key, k) => {
    const f = FACET[key], d = span(draw, k / FACETS.length * 0.5, 0.5 + k / FACETS.length * 0.5, ease.linear), L = lit(key);
    if (d <= 0) return;
    // Inside a facet the chapter draws the box itself; the facet's own preview and ridges give way.
    const inside = cam && Math.hypot(cam.x - f.cx, cam.y - f.cy) < 40 ? span(cam.zoom, 3, 10, ease.linear) : 0;
    if (inside >= 1) return;
    const fa = alpha * (1 - inside);
    // The glass: a faint fill, the box preview inside, then the edges and ridges on top.
    items.push({ shape: R(f.shape), fill: [0.05, 0.06, 0.07], opacity: 0.6 * d * fa });
    const pv = A.lens.previews[key], o = (0.3 + 0.7 * L) * span(d, 0.6, 1) * fa;
    if (o > 0) for (const it of pv) items.push({ ...it, shape: R(it.shape), clip: R(it.clip), opacity: (it.opacity ?? 1) * o });
    // While it draws on, the edge burns bright like light along glass, then settles to ink.
    items.push({ shape: R(d < 1 ? trim(f.shape, 0, d) : f.shape), stroke: d < 1 ? C.glass : C.ink, width: d < 1 ? 2.2 : 1.4, opacity: (d < 1 ? 0.95 : 0.45 + 0.4 * L) * fa });
    items.push({ shape: R(d < 1 ? trim(f.ridges, 0, d) : f.ridges), stroke: C.glass, width: 0.7, opacity: (0.12 + 0.1 * L) * fa });
  });
}

export function title(t, A, at, until, items) {
  const o = window(t, at - 0.2, until, 0.8, 0.8);
  for (const sh of A.lens.title) put(items, sh, C.ink, o, { screen: false });
}
