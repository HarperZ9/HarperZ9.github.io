// Segment 5: pictures on surfaces. A checkerboard plane drawn twice as it turns: affine (the
// texture coordinates interpolated in screen space, no divide) and perspective-correct (u/z and
// 1/z interpolated, one divide per pixel). Then shot 5.4, the palette lookup, with the real
// texel and the real palette from the period files (frames/rosewood.json).
import { C, put, putL, stroke, box, contour, rect, text, tex, span, window, ease, lerp, clamp01 } from "./lib.mjs";
import { frameBox, rungY } from "./world.mjs";

const N = 8;   // checker cells per side

// The plane's corners in 3D (a square on the floor, turned by yaw) projected into a panel.
function corners(yaw, px, py, pw, ph) {
  const q = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]].map(([x, , z]) => {
    const x1 = x * Math.cos(yaw) - z * Math.sin(yaw), z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
    const y1 = -0.75, zc = z1 + 2.05, f = 1.6;
    return { sx: px + pw / 2 + (x1 * f / zc) * pw * 0.5, sy: py + ph * 0.05 - (y1 * f / zc) * ph * 0.95, w: 1 / zc };
  });
  return q;   // order: (u,v) = (0,0), (1,0), (1,1), (0,1)
}
// Screen point for texture (u, v): perspective-correct, or affine over the quad's two triangles.
function mapPoint(q, u, v, correct) {
  if (correct) {
    const w = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
    let X = 0, Y = 0, W = 0;
    q.forEach((c, k) => { X += w[k] * c.sx * c.w; Y += w[k] * c.sy * c.w; W += w[k] * c.w; });
    return [X / W, Y / W];
  }
  // Affine: split along (0,0)-(1,1); barycentric in texture space, applied to screen corners.
  if (u >= v) { const a = 1 - u, b = u - v, c = v; return [a * q[0].sx + b * q[1].sx + c * q[2].sx, a * q[0].sy + b * q[1].sy + c * q[2].sy]; }
  const a = 1 - v, b = v - u, c = u; return [a * q[0].sx + b * q[3].sx + c * q[2].sx, a * q[0].sy + b * q[3].sy + c * q[2].sy];
}
function board(q, correct) {
  const dark = [], light = [], k = 4;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const pts = [], edge = (u0, v0, u1, v1) => { for (let s = 0; s < k; s++) pts.push(...mapPoint(q, u0 + (u1 - u0) * s / k, v0 + (v1 - v0) * s / k, correct)); };
    const u0 = i / N, v0 = j / N, u1 = (i + 1) / N, v1 = (j + 1) / N;
    edge(u0, v0, u1, v0); edge(u1, v0, u1, v1); edge(u1, v1, u0, v1); edge(u0, v1, u0, v0);
    ((i + j) % 2 ? dark : light).push(contour(pts, true));
  }
  return { dark, light };
}

export function prepare(A) {
  const f6 = frameBox(6), x = f6.x + f6.w + 200, y = rungY(6) - 170;
  A.surface = {
    panels: [{ x, y, w: 420, h: 340, correct: false }, { x: x + 470, y, w: 420, h: 340, correct: true }],
    names: [text("affine, no divide", { atlas: A.sans, size: 26, x: x + 210, y: y - 4, anchor: "center" }).shape,
      text("perspective-correct", { atlas: A.sans, size: 26, x: x + 680, y: y - 4, anchor: "center" }).shape],
    term: tex("u = \\frac{u/z}{1/z}", { atlas: A.mono, size: 40, x: x + 445, y: y - 90, anchor: "center" }),
  };
  // Shot 5.4: the patch, the palette and the swatch, left of the tower beside rungs 7 to 9.
  const R = A.rosewood, cell = 20, px = -880, py = rungY(8) - 160, gx = -360, gy = py;
  const col = (i) => R.palette[i].map((v) => v / 255).concat(1);
  const patch = [], pal = [];
  R.patch.forEach((row, j) => row.forEach((ix, i) => patch.push({ shape: rect(px + i * cell, py + j * cell, cell - 1, cell - 1), fill: col(ix) })));
  for (let k = 0; k < 256; k++) pal.push({ shape: rect(gx + (k % 16) * cell, gy + Math.floor(k / 16) * cell, cell - 1, cell - 1), fill: col(k) });
  const [tx, ty] = [R.texel[0] - R.patch_origin[0], R.texel[1] - R.patch_origin[1]], ix = R.index;
  A.palette = {
    patch, pal, index: ix, colour: col(ix), rgb: R.palette[ix],
    texel: box(px + tx * cell - 2, py + ty * cell - 2, cell + 3, cell + 3), from: [px + tx * cell + cell / 2, py + ty * cell + cell / 2],
    entry: box(gx + (ix % 16) * cell - 2, gy + Math.floor(ix / 16) * cell - 2, cell + 3, cell + 3), to: [gx + (ix % 16) * cell + cell / 2, gy + Math.floor(ix / 16) * cell + cell / 2],
    swatch: { x: 120, y: py + 110, w: 100, h: 100 },
    number: text(String(ix), { atlas: A.mono, size: 30, x: 0, y: 0, anchor: "center" }),
    names: [text("rosewood.pix . 8-bit indices", { atlas: A.sans, size: 24, x: px + 160, y: py - 20, anchor: "center" }).shape,
      text("std.pal . 256 colours", { atlas: A.sans, size: 24, x: gx + 160, y: gy - 20, anchor: "center" }).shape,
      text(`RGB ${R.palette[ix].join(", ")}`, { atlas: A.mono, size: 24, x: 170, y: py + 250, anchor: "center" }).shape],
    centre: [(px + 220) / 2, py + 160],
  };
}

export function draw(t, A, T, items) {
  const S = A.surface;
  const v = window(t, T.split, T.models + 0.8, 0.8, 1.0);
  if (v > 0) {
    // The plane turns; the affine copy bends along its diagonal and swims as it turns.
    const yaw = 0.35 + 0.5 * Math.sin((t - T.split) * 0.9) * span(t, T.wobble, T.wobble + 1.5);
    S.panels.forEach((p, k) => {
      const q = corners(yaw, p.x, p.y, p.w, p.h), b = board(q, p.correct), dim = k === 0 ? 1 : 1 - 0.35 * window(t, T.wobble, T.models, 0.6, 0.6);
      items.push({ shape: b.light, fill: [0.86, 0.83, 0.76, 1], opacity: v * dim }, { shape: b.dark, fill: [0.12, 0.12, 0.14, 1], opacity: v * dim });
      putL(items, S.names[k], C.ink2, v);
    });
    putL(items, S.term.shape, C.ink, v * span(t, T.divide, T.divide + 1.0));
  }
  const P = A.palette, w = window(t, T.palette, T.paletteEnd, 0.8, 0.8);
  if (w > 0) {
    P.patch.forEach((c) => items.push({ ...c, opacity: w }));
    P.pal.forEach((c) => items.push({ ...c, opacity: w * span(t, T.palette + 0.3, T.palette + 0.9) }));
    P.names.slice(0, 2).forEach((s) => putL(items, s, C.ink2, w));
    stroke(items, P.texel, C.ink, 2.5, w * span(t, T.palette + 0.4, T.palette + 0.8));
    // The index leaves the texel, travels to its entry, and the colour comes out.
    const u = span(t, T.palette + 0.9, T.palette + 1.9, ease.smooth), x = lerp(P.from[0], P.to[0], u), y = lerp(P.from[1] - 34, P.to[1] - 34, u);
    putL(items, P.number.shape.map((c) => ({ ...c, pts: c.pts.map((q, i) => (i % 2 ? q + y + 10 : q + x)) })), C.ink, w * span(t, T.palette + 0.8, T.palette + 1.0));
    stroke(items, P.entry, C.ink, 2.5, w * span(t, T.palette + 1.8, T.palette + 2.0));
    const out = span(t, T.palette + 2.0, T.palette + 2.6);
    items.push({ shape: rect(P.swatch.x, P.swatch.y, P.swatch.w, P.swatch.h), fill: P.colour, opacity: w * out });
    stroke(items, [contour([P.to[0] + 14, P.to[1], P.swatch.x - 8, P.swatch.y + 50], false)], C.dim, 2, w * out);
    putL(items, P.names[2], C.ink, w * out);
  }
}
