// Segment 6, first half: paint, tape, pixels, palette. Paint: the box through the engine's paint
// pass, with a blue and a yellow stroke crossing, their overlap coloured by the library's own
// Kubelka-Munk pigment model (kmDecode). Tape: Motion's post stack has no tape pass, so the tape
// is drawn (chroma lagging luma, the bottom lines skewed at the head switch) and tagged as a
// depiction. Pixels: the method's idea drawn (colour fixed per surface texel as the view turns)
// beside the naive way (render small, scale up), which shimmers. Palette: the box in Motion's
// pixel mode through the engine's dither pass, the EGA palette with noise, a pair the exhaustive
// check covered.
import { contour, rect, transform } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
import { kmDecode } from "../../../raw-native/tree-c6b114d/web/shaders/paint/pigments.mjs";
import { C, box, view, inFacet, put, T, tab, tag, fact, span, window, ease, FACET } from "./world.mjs";

const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const srgb = (rgb) => rgb.map((v) => Math.min(1, Math.max(0, enc(v))));

// A brush stroke: a thick wavy band from (x0, y0) to (x1, y1).
function stroke(x0, y0, x1, y1, w) {
  const top = [], bot = [], n = 24, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = x0 + dx * u, y = y0 + dy * u, h = w * (0.55 + 0.45 * Math.sin(u * Math.PI)) * (1 + 0.08 * Math.sin(u * 23));
    top.push(x + nx * h, y + ny * h); bot.unshift(x - nx * h, y - ny * h);
  }
  return [contour([...top, ...bot], true)];
}

// The box drawn as surface texels: each face is a grid of cells whose colour never changes,
// projected through the view; snap rounds the projected corners (render small, scale up).
function texelBox(v, cells = 6, snap = 0) {
  const P = (q) => { const s = v.proj(q); return snap ? s.map((c) => Math.floor(c / snap + 0.5) * snap) : s; };
  const out = [], faces = [[[0, 1, 0], (a, b) => [a, 2, b]], [[0, 0, 1], (a, b) => [a, b + 1, 1]], [[1, 0, 0], (a, b) => [1, b + 1, -a]], [[-1, 0, 0], (a, b) => [-1, b + 1, a]], [[0, 0, -1], (a, b) => [-a, b + 1, -1]]];
  for (const [n, at] of faces) {
    const c = [n[0], 1 + n[1], n[2]], e = v.eye.map((x, i) => x - c[i]);
    if (e[0] * n[0] + e[1] * n[1] + e[2] * n[2] <= 0) continue;
    for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
      const a0 = -1 + (2 * i) / cells, a1 = a0 + 2 / cells, b0 = -1 + (2 * j) / cells, b1 = b0 + 2 / cells;
      const k = ((i * 7 + j * 13 + n[0] * 3 + n[2] * 5) % 5) / 5, lum = 0.35 + 0.5 * Math.max(0, 0.6 * n[1] + 0.3 * n[0] + 0.2 * n[2] + 0.3) + 0.12 * k;
      out.push({ shape: [contour([...P(at(a0, b0)), ...P(at(a1, b0)), ...P(at(a1, b1)), ...P(at(a0, b1))], true)], fill: [lum * 0.95, lum * 0.7, lum * 0.5] });
    }
  }
  return out;
}

export function prepare(A, facts, c) {
  const ev = A.ev, yellow = srgb(kmDecode([0, 1, 0, 0])), blue = srgb(kmDecode([0, 0, 0, 1])), green = srgb(kmDecode([0, 0.5, 0, 0.5]));
  A.s6 = {
    paintBox: box(view({ yaw: 34, pitch: 22, dist: 9.5 }), { faceColour: (n, l) => (n[1] ? [0.85 * l, 0.7 * l, 0.45 * l] : [0.55 * l, 0.4 * l, 0.3 * l]) }),
    yellow, blue, green, sY: stroke(560, 820, 1360, 980, 44), sB: stroke(560, 980, 1360, 820, 44),
    tapeBox: box(view({ yaw: 34, pitch: 22, dist: 9.5 }), { faceColour: (n, l) => (n[1] ? [0.9 * l, 0.3, 0.35] : n[0] ? [0.2, 0.6 * l, 0.9 * l] : [0.95 * l, 0.85 * l, 0.3]) }),
    labels: {
      paint: T(A, "four pigments, mixed as paint", { size: 38, x: 960, y: 196 }),
      tape: T(A, "chroma lags luma . head switch", { size: 38, x: 960, y: 196 }),
      pixel: T(A, `${fact(ev, "pixel_splat")} changed . naive ${fact(ev, "pixel_naive_lo")} to ${fact(ev, "pixel_naive_hi")}`, { size: 34, x: 960, y: 262, atlas: "mono" }),
      naive: T(A, "naive: render small, scale up", { size: 30, x: 1500, y: 300, atlas: "mono" }),
      dither: T(A, `${fact(ev, "dither_colours")} colours . ${fact(ev, "dither_mismatched")} mismatches`, { size: 38, x: 960, y: 262, atlas: "mono" }),
    },
    tags: { tape: tag(A, "a depiction: no tape pass in the post stack"), pixel: tag(A, "a depiction of the method; the measurement is the library's"), dither: tag(A, "local run, not in CI"),
      paint: tag(A, `GPU within ${fact(ev, "paint_code")} step in 255 of the CPU, ${fact(ev, "paint_cases")} cases`), tapeN: tag(A, `GPU within ${fact(ev, "vhs_code")} step, ${fact(ev, "vhs_cases")} cases`, 150) },
    tabs: { paint: tab(A, ev, "rn-paint-parity"), tape: tab(A, ev, "rn-vhs-parity"), pixel: tab(A, ev, "rn-pixel"), dither: tab(A, ev, "rn-dither") },
  };
  A.T6 = { paint: c.at(6, 0, 0), green: c.word(6, 0, 1, "green"), tape: c.at(6, 1, 0), head: c.word(6, 1, 0, "heads switch"), pixel: c.at(6, 2, 0),
    test: c.at(6, 2, 1), dither: c.at(6, 3, 0), count: c.word(6, 3, 0, "16,777,216"), exit: c.at(6, 4, 0) };
}
export const stops = (c) => [["paint", c.at(6, 0, 0)], ["tape", c.at(6, 1, 0)], ["pixel", c.at(6, 2, 0)], ["dither", c.at(6, 3, 0)]];

export function look(t, A, cam) {
  const T6 = A.T6, at = (k) => Math.hypot(cam.x - FACET[k].cx, cam.y - FACET[k].cy) < 1;
  if (at("paint") && t > T6.paint - 2 && t < T6.green - 0.2) return { post: { passes: [{ pass: "paint", preset: "oil-grotesque" }], bloom: 0.05 }, since: T6.paint + 1.8 };
  if (at("dither") && t > T6.dither - 2 && t < T6.count - 0.2) return { post: { passes: [{ pass: "dither", palette: "ega", mode: "noise" }], bloom: 0, vignette: 0, grain: 0 }, pixel: { width: 320, height: 180, mode: "integer" }, since: T6.dither + 1.8 };
  return null;
}

// The part of polygon a inside convex polygon b (Sutherland-Hodgman), both flat [x, y, ...].
function clipPoly(a, b) {
  let out = a;
  const n = b.length / 2, area = b.reduce((s, _, i) => (i % 2 ? s : s + b[i] * b[(i + 3) % b.length] - b[(i + 2) % b.length] * b[i + 1]), 0), sg = Math.sign(area);
  for (let i = 0; i < n; i++) {
    const ax = b[2 * i], ay = b[2 * i + 1], bx = b[(2 * i + 2) % b.length], by = b[(2 * i + 3) % b.length];
    const side = (x, y) => sg * ((bx - ax) * (y - ay) - (by - ay) * (x - ax));
    const src = out; out = [];
    for (let k = 0; k < src.length; k += 2) {
      const px = src[k], py = src[k + 1], qx = src[(k + 2) % src.length], qy = src[(k + 3) % src.length], sp = side(px, py), sq = side(qx, qy);
      if (sp >= 0) out.push(px, py);
      if (sp >= 0 !== sq >= 0) { const u = sp / (sp - sq); out.push(px + (qx - px) * u, py + (qy - py) * u); }
    }
    if (!out.length) break;
  }
  return out;
}
const hullOf = (p) => {
  const q = []; for (let i = 0; i < p.length; i += 2) q.push([p[i], p[i + 1]]);
  q.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
  for (const r of q) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], r) <= 0) lo.pop(); lo.push(r); }
  for (const r of q.reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], r) <= 0) hi.pop(); hi.push(r); }
  return lo.slice(0, -1).concat(hi.slice(0, -1)).flat();
};

function paint(t, A, T6, content) {
  const S = A.s6, u = span(t, T6.paint + 2.2, T6.paint + 4.6, ease.inOut);
  content.push(...S.paintBox);
  if (u <= 0) return;
  const grow = (x0, y0, x1, y1) => stroke(x0, y0, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 44);
  const sy = grow(560, 820, 1360, 980), sb = grow(560, 980, 1360, 820);
  content.push({ shape: sy, fill: S.yellow }, { shape: sb, fill: S.blue });
  const g = span(t, T6.green, T6.green + 0.6);
  if (g > 0) {
    const ov = clipPoly(Array.from(S.sY[0].pts), hullOf(Array.from(S.sB[0].pts)));
    if (ov.length >= 6) content.push({ shape: [contour(ov, true)], fill: S.green, opacity: g });
  }
}

function tape(t, A, T6, content) {
  const S = A.s6, lag = 22, skew = span(t, T6.head - 0.2, T6.head + 0.4) * 46;
  for (const it of S.tapeBox) {
    const f = Array.isArray(it.fill) ? it.fill : null, y = f ? 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2] : 0;
    content.push({ ...it, fill: f ? [y, y, y] : it.fill });
  }
  // Chroma: the colour, soft and late, over the luma.
  for (const it of S.tapeBox) if (Array.isArray(it.fill)) content.push({ shape: transform(it.shape, [1, 0, 0, 1, lag, 0]), fill: it.fill, opacity: 0.5, blur: 10 });
  // The head switch: the last lines of the field slide sideways.
  content.push({ shape: rect(skew - 40, 1012, 2000, 68), fill: [0.16, 0.15, 0.15] }, { shape: rect(skew + 300, 1030, 900, 6), fill: [0.8, 0.78, 0.72], opacity: 0.6 });
}

function pixels(t, A, T6, content) {
  const yaw = 20 + (t - T6.pixel) * 9;
  content.push(...texelBox(view({ yaw, pitch: 24, dist: 9.5, cx: 760, cy: 560 }), 6));
  const k = 0.42, m = [k, 0, 0, k, 1500 - 960 * k, 560 - 560 * k];
  for (const it of texelBox(view({ yaw, pitch: 24, dist: 9.5 }), 6, 64)) content.push({ ...it, shape: transform(it.shape, m) });
  content.push({ shape: rect(1500 - 960 * k, 560 - 540 * k, 1920 * k, 1080 * k), stroke: C.ink2, width: 3 });
}

export function draw(t, A, items) {
  const S = A.s6, T6 = A.T6;
  if (t < T6.paint - 2 || t > T6.exit + 1) return;
  const P = [], Tp = [], Px = [], D = [];
  paint(t, A, T6, P);
  tape(t, A, T6, Tp);
  if (t > T6.pixel - 2.5) pixels(t, A, T6, Px); else pixels(T6.pixel, A, T6, Px);
  D.push(...box(view({ yaw: 34, pitch: 22, dist: 9.5 }), { faceColour: (n, l) => [l * 0.95, l * 0.75, l * 0.55] }));
  items.push(...inFacet(P, "paint"), ...inFacet(Tp, "tape"), ...inFacet(Px, "pixel"), ...inFacet(D, "dither"));
  const L = S.labels, G = S.tags, B = S.tabs, w = (a, b) => window(t, a, b, 0.5, 0.5);
  put(items, L.paint, C.ink, w(T6.green - 0.2, T6.tape - 0.6));
  put(items, B.paint, C.ink2, 0.85 * w(T6.green - 0.2, T6.tape - 0.6));
  put(items, G.paint, C.ink2, w(T6.green, T6.tape - 0.6));
  put(items, L.tape, C.ink, w(T6.tape + 1.6, T6.pixel - 0.6));
  put(items, B.tape, C.ink2, 0.85 * w(T6.tape + 1.6, T6.pixel - 0.6));
  put(items, G.tape, C.hot, w(T6.tape + 1.6, T6.pixel - 0.6));
  put(items, G.tapeN, C.ink2, w(T6.head, T6.pixel - 0.6), {});
  put(items, L.naive, C.ink2, w(T6.pixel + 1.6, T6.dither - 0.6));
  put(items, L.pixel, C.ink, w(T6.test, T6.dither - 0.6));
  put(items, B.pixel, C.ink2, 0.85 * w(T6.pixel + 1.6, T6.dither - 0.6));
  put(items, G.pixel, C.hot, w(T6.pixel + 1.6, T6.dither - 0.6));
  put(items, L.dither, C.ink, w(T6.count, T6.exit));
  put(items, B.dither, C.ink2, 0.85 * w(T6.count - 0.2, T6.exit));
  put(items, G.dither, C.hot, w(T6.count, T6.exit));
}
