// A small kit for building the painted isometric world out of vector items: points from cell
// coordinates (web/world/iso.mjs), boxes with their two visible walls, quads laid on a wall,
// ground ellipses and depth-sorted drawing. Everything here is geometry; the art (where things
// stand, their colours and light) is in harbour.mjs.
import { isoCamera } from "../../../web/world/iso.mjs";
import { P, INK } from "../rig.mjs";

export const ISO = isoCamera({ tileW: 128, tileH: 64, origin: [960, 60] });
export const S = (i, j, z = 0) => ISO.toScreen(i, j, z);
const f1 = (v) => v.toFixed(1);
export const poly = (pts) => P("M " + pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(" L ") + " Z");
export const line = (pts) => P("M " + pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(" L "));
export const quad = (pts, fill, extra = {}) => ({ shape: poly(pts.map((p) => S(...p))), fill, ...extra });
// A point on the wall facing +i (at i = I) or +j (at j = J): u runs along the wall, z up.
export const wallI = (I) => (u, z) => S(I, u, z);
export const wallJ = (J) => (u, z) => S(u, J, z);

// A box from cells [i0, i1] x [j0, j1], z0 to z1: the +j wall, the +i wall, then the top.
export function box(i0, j0, i1, j1, z0, z1, { top, faceI, faceJ, stroke = INK, width = 3 } = {}) {
  const out = [];
  if (faceJ) out.push(quad([[i0, j1, z0], [i1, j1, z0], [i1, j1, z1], [i0, j1, z1]], faceJ, { stroke, width }));
  if (faceI) out.push(quad([[i1, j0, z0], [i1, j1, z0], [i1, j1, z1], [i1, j0, z1]], faceI, { stroke, width }));
  if (top) out.push(quad([[i0, j0, z1], [i1, j0, z1], [i1, j1, z1], [i0, j1, z1]], top, { stroke, width }));
  return out;
}
// A rectangle on a wall between u0..u1 and z0..z1.
export const onWall = (w, u0, u1, z0, z1, fill, extra = {}) => ({ shape: poly([w(u0, z0), w(u1, z0), w(u1, z1), w(u0, z1)]), fill, ...extra });

// An ellipse lying on the ground at cell (ci, cj), radii in cells, as a polygon.
export function groundEllipse(ci, cj, ri, rj, z = 0, n = 40) {
  const pts = [];
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; pts.push(S(ci + Math.cos(a) * ri, cj + Math.sin(a) * rj, z)); }
  return poly(pts);
}
// Motion's radial gradients are circles, and the ground is squashed 2:1, so a soft spot on the
// ground is a stack of flat ellipses, each adding a share of the strength: a stepped falloff
// that the paint pass blends.
function softSpot(ci, cj, ri, rj, c, a, steps, extra = {}) {
  const out = [];
  for (let k = steps; k >= 1; k--) out.push({ shape: groundEllipse(ci, cj, (ri * k) / steps, (rj * k) / steps), fill: [...c, a / steps], ...extra });
  return out;
}
// A soft ground shadow with a dark core where the thing meets the ground.
export const groundShadow = (ci, cj, r, k = 0.7) => [...softSpot(ci, cj, r * 1.4, r * 1.4, [0.01, 0.01, 0.025], 0.55 * k, 6), ...softSpot(ci, cj, r * 0.6, r * 0.6, [0.005, 0.005, 0.01], 0.6 * k, 3)];
// A cast shadow from a point light at ground cell L, for something standing at cell (ci, cj)
// with height h (cells): a long wedge on the ground pointing away from the light, in steps.
export function castShadow(ci, cj, L, h, k = 0.5) {
  const dx = ci - L[0], dy = cj - L[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, len = Math.min(3.4, (h * 1.4) / Math.max(0.5, d * 0.3));
  const out = [];
  for (let s = 4; s >= 1; s--) {
    const L1 = (len * s) / 4, w = 0.3 + 0.25 * (s / 4);
    const pts = [S(ci - uy * 0.3, cj + ux * 0.3), S(ci + ux * L1 - uy * w, cj + uy * L1 + ux * w), S(ci + ux * (L1 + 0.25), cj + uy * (L1 + 0.25)), S(ci + ux * L1 + uy * w, cj + uy * L1 - ux * w), S(ci + uy * 0.3, cj - ux * 0.3)];
    out.push({ shape: poly(pts), fill: [0.01, 0.01, 0.03, k / 4] });
  }
  return out;
}
// A light pool on the ground: additive, squashed to the ground plane.
export const lightPool = (ci, cj, r, c, a) => softSpot(ci, cj, r, r, c, a, 7, { blend: "add" });
// Sort drawables by depth (iso.depth of their front ground point) and flatten.
export const sorted = (things) => things.slice().sort((a, b) => a.d - b.d).flatMap((t) => t.items);
export const depth = (ci, cj, z = 0) => ISO.depth(ci, cj, z);
