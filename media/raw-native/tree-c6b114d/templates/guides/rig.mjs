// A 2.5D paper-doll rig for the explainer guides. A character is a list of parts, each a
// flat shape drawn in front view (SVG path data, y down, feet at the origin) with a 3D
// pivot. Turning the character by a yaw angle moves each pivot on a circle about the
// vertical axis, narrows parts by their depth, hides parts that face away, and sorts the
// parts back to front. Pure: runs in Node, so a pose can be checked without a GPU.
//
//   part: { d | shape, pivot: [x, y, z], fill, stroke, width, opacity, blend,
//           rot (degrees, about the pivot), side (width seen side on, 0..1, default 1),
//           face (degrees the part faces; hidden when turned away), flat (0..1: how much a
//           facing part narrows as it turns), dz (depth bias), clip (part name),
//           off ([x, z]: a turning offset that leaves the rotation pivot in place),
//           hideSide (0..1: hidden when |sin yaw| passes it), tag (for deform) }
//   pose(parts, { x, y, s, yaw, shear }) -> Motion items, back to front.
import { parsePath, transform } from "../../web/motion/path.mjs";

const DEG = Math.PI / 180;
const cache = new Map();
export const P = (d) => {
  let s = cache.get(d);
  if (!s) { s = parsePath(d, { tolerance: 0.3 }); cache.set(d, s); }
  return s;
};

// The affine map of one part: rotate about the pivot, narrow, then place the pivot.
function partMatrix(p, { x, y, s, yaw, flip }) {
  const c = Math.cos(yaw * DEG), sn = Math.sin(yaw * DEG);
  const [px, py, pz = 0] = p.pivot || [0, 0, 0];
  const X = px * c + pz * sn;
  let sq = 1 - (1 - (p.side ?? 1)) * Math.abs(sn);
  if (p.flat) sq *= 1 - p.flat * (1 - Math.max(0.04, Math.cos((yaw + (p.face || 0)) * DEG)));
  const r = (p.rot || 0) * DEG, cr = Math.cos(r), sr = Math.sin(r), f = flip ? -1 : 1;
  // local = R (q - pivot); q' = (pivotX + sq * local.x, py + local.y) * s + (x, y)
  const a = f * s * sq * cr, b = s * sr, cc = -f * s * sq * sr, d = s * cr;
  const e = x + f * s * X - (a * px + cc * py), g = y + s * py - (b * px + d * py);
  return [a, b, cc, d, e, g];
}

const mapPoint = (m, px, py) => [m[0] * px + m[2] * py + m[4], m[1] * px + m[3] * py + m[5]];

// Paints given in the part's own coordinates move with it.
function mapPaint(paint, m, s) {
  if (!paint || typeof paint === "string" || Array.isArray(paint)) return paint;
  if (paint.linear) {
    const [x0, y0, x1, y1] = paint.linear, a = mapPoint(m, x0, y0), b = mapPoint(m, x1, y1);
    return { ...paint, linear: [...a, ...b] };
  }
  if (paint.radial) {
    const [cx, cy, r] = paint.radial;
    return { ...paint, radial: [...mapPoint(m, cx, cy), r * s] };
  }
  if (paint.image) {
    const [rx, ry, rw, rh] = paint.rect, a = mapPoint(m, rx, ry), b = mapPoint(m, rx + rw, ry + rh);
    return { ...paint, rect: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])] };
  }
  return paint;
}

// A shear that leans everything above the feet: x += shear * (-y) in character units.
const shearShape = (shape, shear, s, x0, y0) => (shear ? transform(shape, [1, 0, -shear, 1, shear * y0, 0]) : shape);

export function pose(parts, opt) {
  const o = { x: 960, y: 900, s: 1, yaw: 0, flip: false, shear: 0, ...opt };
  const c = Math.cos(o.yaw * DEG), sn = Math.sin(o.yaw * DEG);
  const named = {}, list = [];
  // Squash and stretch about the feet: q > 0 squashes (wider, shorter), q < 0 stretches; the
  // area stays near constant. Applied to every shape before clips resolve, so a clipped part
  // (a lid in its eye) stays inside its clip.
  const q = o.squash || 0, sqm = q ? [1 + q, 0, 0, 1 / (1 + q), -q * o.x, o.y - o.y / (1 + q)] : null;
  parts.forEach((p, i) => {
    if (!p || p.hide) return;
    if (p.face != null && Math.cos((o.yaw + p.face) * DEG) < (p.vis ?? 0.08)) return;
    // hideSide: a part drawn for the front and back views only, hidden near side on.
    if (p.hideSide != null && Math.abs(Math.sin(o.yaw * DEG)) > p.hideSide) return;
    const [px, , pz = 0] = p.pivot || [0, 0, 0];
    const [ox = 0, oz = 0] = p.off || [];
    const Z = -px * sn + pz * c + (p.dz || 0) + (-ox * sn + oz * c - oz);
    const m = partMatrix(p, o);
    // off: [x, z] moves a part on the turning circle without moving its rotation pivot.
    if (p.off) m[4] += (o.flip ? -1 : 1) * o.s * (ox * c + oz * sn - ox);
    let shape = shearShape(transform(p.shape || P(p.d), m), o.shear, o.s, o.x, o.y);
    if (sqm) shape = transform(shape, sqm);
    const item = { shape, fill: mapPaint(p.fill, m, o.s), stroke: mapPaint(p.stroke, m, o.s), width: (p.width || 0) * o.s,
      opacity: p.opacity ?? 1, blend: p.blend, blur: p.blur ? p.blur * o.s : undefined };
    if (p.name) named[p.name] = shape;
    list.push({ Z: Z + i * 1e-3, item, clipName: p.clip });
  });
  list.sort((a, b) => a.Z - b.Z);
  return list.map(({ item, clipName }) => (clipName && named[clipName] ? { ...item, clip: named[clipName] } : item));
}

// Secondary motion on tagged parts: a shear about a line (cloth that trails below a fixed
// edge) or a rotation about a point (whiskers, stalks), applied to the part's own front-view
// shape before posing. tag is the part's `tag`; affine is [a, b, c, d, e, f].
export function deform(parts, tag, m) {
  if (!m) return parts;
  return parts.map((p) => (p && p.tag === tag ? { ...p, shape: transform(p.shape || P(p.d), m), d: undefined } : p));
}
// x += k (y - y0): everything below y0 slides sideways by k per unit of drop.
export const shearBelow = (k, y0) => (k ? [1, 0, k, 1, -k * y0, 0] : null);
// A rotation by deg about (cx, cy).
export function rotAbout(deg, cx, cy) {
  if (!deg) return null;
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
}

// Helpers for authoring.
export const lin = (x0, y0, x1, y1, ...stops) => ({ linear: [x0, y0, x1, y1], stops });
export const rad = (cx, cy, r, ...stops) => ({ radial: [cx, cy, r], stops });
export const ellipse = (cx, cy, rx, ry) =>
  `M ${cx - rx} ${cy} C ${cx - rx} ${cy - ry * 0.552} ${cx - rx * 0.552} ${cy - ry} ${cx} ${cy - ry} C ${cx + rx * 0.552} ${cy - ry} ${cx + rx} ${cy - ry * 0.552} ${cx + rx} ${cy} C ${cx + rx} ${cy + ry * 0.552} ${cx + rx * 0.552} ${cy + ry} ${cx} ${cy + ry} C ${cx - rx * 0.552} ${cy + ry} ${cx - rx} ${cy + ry * 0.552} ${cx - rx} ${cy} Z`;
// A tapered limb from (x0, y0) to (x1, y1), w0 wide at the start and w1 at the end, as a closed path.
export function limb(x0, y0, x1, y1, w0, w1, bend = 0) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const mx = (x0 + x1) / 2 + nx * bend, my = (y0 + y1) / 2 + ny * bend, wm = (w0 + w1) / 4;
  const pt = (x, y, w) => `${(x).toFixed(2)} ${(y).toFixed(2)}`;
  return `M ${pt(x0 + nx * w0 / 2, y0 + ny * w0 / 2)} Q ${pt(mx + nx * wm * 2, my + ny * wm * 2)} ${pt(x1 + nx * w1 / 2, y1 + ny * w1 / 2)} ` +
    `L ${pt(x1 - nx * w1 / 2, y1 - ny * w1 / 2)} Q ${pt(mx - nx * wm * 2, my - ny * wm * 2)} ${pt(x0 - nx * w0 / 2, y0 - ny * w0 / 2)} Z`;
}
// A seeded generator for texture and placement (mulberry32), so frames repeat exactly.
export function seeded(seed) {
  let a = typeof seed === "number" ? seed >>> 0 : [...String(seed)].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0, 2166136261);
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const INK = "#0b0a0c";

// Plotter hatching: parallel lines across a box at an angle, bent by a smooth seeded field,
// as SVG path data. Drawn as a thin stroke and clipped to a part, it gives a surface the
// pen line-work of the author's inspiration corpus.
export function hatch(x0, y0, x1, y1, { gap = 9, angle = 60, wobble = 4, seed = "hatch", step = 12 } = {}) {
  const r = seeded(seed), ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const a = (angle * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2;
  let d = "";
  for (let k = -R; k <= R; k += gap) {
    let seg = "";
    for (let t = -R; t <= R; t += step) {
      const w = wobble * (Math.sin(t * 0.021 + k * 0.013 + ph[0]) + 0.6 * Math.sin(t * 0.047 - k * 0.031 + ph[1]) + 0.3 * Math.sin(k * 0.09 + ph[2]));
      const px = cx + ux * t + nx * (k + w), py = cy + uy * t + ny * (k + w);
      seg += `${seg ? " L" : "M"} ${px.toFixed(1)} ${py.toFixed(1)}`;
    }
    d += seg + " ";
  }
  return d;
}
