// forge/family/glyph.mjs
// Turns a glyph definition into placed outlines: expand every stroke with the pen, measure the ink,
// apply sidebearings by side class, and keep the centre lines (the skeleton the lettering library reads)
// and the anchors (where accents attach) in the same coordinates as the outlines.

import { expand } from "./pen.mjs";

// Sidebearing classes, as fractions of the face's straight sidebearing. Tracy's method in short:
// straights get the full value, rounds about three quarters, open sides and diagonals much less.
export const SIDE = Object.freeze({ H: 1.0, O: 0.74, R: 1.10, o: 0.60, C: 0.74, T: 0.32, V: 0.14, Z: 0.0 });

function side(k, cls, upper) {
  if (typeof cls === "number") return cls;
  const base = upper ? k.sbCap : k.sb;
  if (!(cls in SIDE)) throw new Error(`glyph: unknown side class ${cls}`);
  return base * SIDE[cls];
}

const bounds = (rings) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [x, y] of r.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
};

const signed = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; s += x0 * y1 - x1 * y0; } return s; };

// Strokes go through the pen; fills (dots) are outlines already and only get clockwise winding.
function expandAll(strokes, k, fills = []) {
  const rings = [];
  for (const st of strokes) for (const r of expand(st, st.V ?? k.V, st.contrast ?? k.C, k.taperFloor ?? 0)) rings.push(r);
  for (const f of fills) {
    const r = { pts: f.pts.slice(), on: f.on.slice() };
    if (signed(r.pts) > 0) { r.pts.reverse(); r.on.reverse(); }
    rings.push(r);
  }
  return rings;
}

// Squeeze the centre lines horizontally about cx (mono cells); the pen width is unchanged. A fill keeps
// its shape and moves with its centre.
function squeeze(strokes, fills, cx, s) {
  const st = strokes.map((x) => ({ ...x, path: { ...x.path, meta: undefined, pts: x.path.pts.map(([px, py]) => [cx + (px - cx) * s, py]) } }));
  const fl = fills.map((f) => {
    const m = f.pts.reduce((a, [px]) => a + px, 0) / f.pts.length, d = (cx + (m - cx) * s) - m;
    return { pts: f.pts.map(([px, py]) => [px + d, py]), on: f.on };
  });
  return [st, fl];
}

const r2 = (v) => Math.round(v * 100) / 100;

// def: { strokes, sb: [left, right], upper, anchors: { top: x, ... }, advance (fixed), mono }
export function place(name, def, k) {
  let strokes = def.strokes || [], fills = def.fills || [];
  let rings = expandAll(strokes, k, fills);
  let b = rings.length ? bounds(rings) : { x0: 0, y0: 0, x1: 0, y1: 0 };
  // Italic spacing reads the ink inside the x-height (or cap-height) band, as a reader's eye does, so
  // an f's hook or a j's tail may overhang its neighbour instead of opening a hole in the word.
  if (k.italic && rings.length && !def.raw) {
    const top = def.upper || !/^[a-z]|^(dotless|germandbls|eth|thorn|ae|oe|oslash|eng|lslash|kgreen|longs|dcroat|hbar|tbar)/.test(name) ? k.cap : k.xh, band = rings.flatMap((r) => r.pts).filter(([, y]) => y >= 0 && y <= top);
    if (band.length > 2) b = { ...b, x0: Math.min(...band.map((p) => p[0])), x1: Math.max(...band.map((p) => p[0])) };
  }
  let lsb, adv;
  if (def.raw) {
    adv = def.advance ?? 0; lsb = b.x0;   // marks: drawn in place, never moved
  } else if (k.mono && !def.free) {
    const room = k.cell - 2 * k.monoSb, w = b.x1 - b.x0;
    if (w > room && strokes.length && !def.noSqueeze) {
      const s = Math.max(0.5, (room - k.V) / Math.max(1, w - k.V));
      [strokes, fills] = squeeze(strokes, fills, (b.x0 + b.x1) / 2, s);
      rings = expandAll(strokes, k, fills); b = bounds(rings);
    }
    adv = k.cell; lsb = (k.cell - (b.x1 - b.x0)) / 2;
  } else {
    lsb = side(k, def.sb?.[0] ?? "H", def.upper);
    const rsb = side(k, def.sb?.[1] ?? "H", def.upper);
    adv = def.advance ?? (rings.length ? (b.x1 - b.x0) + lsb + rsb : lsb + rsb);
    if (def.advance !== undefined && def.center) lsb = (def.advance - (b.x1 - b.x0)) / 2;
  }
  const dx = rings.length ? lsb - b.x0 : 0;
  const contours = rings.map((r) => ({ pts: r.pts.map(([x, y]) => [r2(x + dx), r2(y)]), on: r.on }));
  const skeleton = strokes.map((st) => st.path.pts.map(([x, y]) => [r2(x + dx), r2(y)]));
  // A dot has no centre line; it enters the skeleton as a short tick through its centre.
  for (const f of fills) {
    const xs = f.pts.map((p) => p[0]), ys = f.pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2 + dx, cy = (Math.min(...ys) + Math.max(...ys)) / 2, h = (Math.max(...ys) - Math.min(...ys)) * 0.2;
    skeleton.push([[r2(cx), r2(cy - h)], [r2(cx), r2(cy + h)]]);
  }
  const anchors = {};
  const mid = rings.length ? (b.x0 + b.x1) / 2 + dx : adv / 2;
  for (const [a, v] of Object.entries({ top: mid, bottom: mid, ...(def.anchors || {}) })) anchors[a] = typeof v === "number" ? r2(v + (a in (def.anchors || {}) ? dx : 0)) : v;
  return { name, contours, skeleton, advance: r2(adv), lsb: r2(lsb), anchors,
    ink: rings.length ? { x0: r2(b.x0 + dx), x1: r2(b.x1 + dx), y0: r2(b.y0), y1: r2(b.y1) } : null };
}
