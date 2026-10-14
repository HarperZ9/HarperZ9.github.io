// Segments 0 to 3: the title on the full-colour picture; the VGA budget (320 x 200, one byte a
// pixel, 256 of 262,144); the predict still; median cut in the picture's own colour cloud (one
// point per distinct colour, binned for drawing), the boxes splitting to 256 and collapsing into
// the palette strip; the picture in 256 colours beside the original; then 16 colours, where the
// sky breaks into stripes, outlined in drift (the film's hot mark: the error).
import { C, words, rect, contour, circle, span, window, ease, lerp, hex, COUNTED, DERIVED } from "./lib.mjs";
import { W, H } from "./picture.mjs";

export const PIC = { x: 240, y: 150, w: 960, h: 600 };   // the picture's place: 3 design units a pixel
export const STRIP = { x: 1300, y: 210, cell: 26 };      // the 256-cell palette strip, 16 x 16

// The picture as an image paint over a rectangle, revealed top to bottom (a redraw, not a fade).
export function picture(items, name, o, r = PIC, reveal = 1) {
  if (o <= 0.003) return;
  const h = r.h * Math.max(0, Math.min(1, reveal));
  if (h < 1) return;
  items.push({ shape: rect(r.x, r.y, r.w, h), fill: { image: name, rect: [r.x, r.y, r.w, r.h] }, opacity: o });
}

// Projection of a point in a cube [0, 255]^3 (RGB, or Oklab scaled into it) onto the screen.
export function project(p, yaw, { cx = 760, cy = 450, s = 1.9, pitch = 0.42 } = {}) {
  const x = p[0] - 127.5, y = p[1] - 127.5, z = p[2] - 127.5;
  const ca = Math.cos(yaw), sa = Math.sin(yaw), x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
  const cp = Math.cos(pitch), sp = Math.sin(pitch), y1 = y * cp - z1 * sp;
  return [cx + x1 * s, cy - y1 * s];
}
const EDGES = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
export function boxLines(lo, hi, yaw, opt) {
  const v = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => project([k & 1 ? hi[0] : lo[0], k & 2 ? hi[1] : lo[1], k & 4 ? hi[2] : lo[2]], yaw, opt));
  return EDGES.map(([a, b]) => contour(new Float32Array([...v[a], ...v[b]]), false));
}

export function prepare(A) {
  const B = A.B, t = (s, size, x, y, atlas = A.sans, anchor = "center") => words(s, atlas, size, x, y, anchor).shape;
  // The colour cloud: every distinct colour, binned 8 levels a channel for drawing; one item per bin.
  const bins = new Map();
  const seen = new Set();
  for (let p = 0; p < W * H; p++) {
    const r = B.src[p * 4], g = B.src[p * 4 + 1], b = B.src[p * 4 + 2], key = (r << 16) | (g << 8) | b;
    if (seen.has(key)) continue;
    seen.add(key);
    const bk = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    if (!bins.has(bk)) bins.set(bk, { pts: [], c: [(r >> 5) * 32 + 16, (g >> 5) * 32 + 16, (b >> 5) * 32 + 16] });
    bins.get(bk).pts.push([r, g, b]);
  }
  COUNTED.set(String(B.N), "distinct colours in the picture, counted when the scene loads");
  COUNTED.set(B.N.toLocaleString("en-US"), "the same count with a thousands separator");
  for (const n of [1, 2, 4, 8, 16, 32, 64, 128, 256]) COUNTED.set(String(n), "boxes after each round of cuts, counted from the median cut");
  COUNTED.set("16", "the EGA palette's entries, counted from raw-native's palette table");
  DERIVED.set("64", "2^6: 6 bits a channel (vga, abrash)");
  DERIVED.set("262,144", "64 x 64 x 64 = 2^18 (vga)");
  DERIVED.set("256", "2^8: the values in one byte (vga)");
  // Ticks for the 320 x 200 grid at the push-in: a 16 x 10 crop of pixels at the horizon.
  const crop = { x0: 226, y0: 49, w: 16, h: 10 };   // the lamp and its beam: the most colours in a small patch
  A.s1 = {
    bins: [...bins.values()], crop,
    title: t("Colour on a budget", 72, 960, 100, A.head),
    mode: t("320 x 200 . one byte a pixel", 40, 1240, 110, A.sans, "left"),
    at: t("256 at once, from 262,144", 40, 1300, 150, A.sans, "left"),
    cube: t("6 bits a channel: 64 x 64 x 64 = 262,144", 30, 1300, 740, A.mono, "left"),
    arith: t("arithmetic of 6 bits a channel", 28, 1300, 700, A.mono, "left"),
    nColours: t(`${B.N.toLocaleString("en-US")} distinct colours`, 40, 760, 110),
    counted: t("counted from this picture", 28, 760, 150, A.mono),
    boxes: [1, 2, 4, 8, 16, 32, 64, 128, 256].map((n) => t(`${n} ${n === 1 ? "box" : "boxes"}`, 40, 760, 760)),
    same: t("each colour stands for about the same number of pixels", 34, 960, 110),
    bits: t("8 bits a pixel", 40, 960, 110),
    eye: t("judged by eye, not measured", 28, 960, 150, A.mono),
    sixteen: t("16 colours", 44, 1250, 110, A.head, "left"),
    orig: t("original", 28, 530, 750, A.mono), mc: t("256 colours", 28, 1390, 750, A.mono),
  };
  // The stripes: where the 16-colour picture changes index between rows, in the sky.
  const segs = [];
  for (let y = 1; y < 132; y++) {
    let x0 = -1;
    for (let x = 0; x <= W; x++) {
      const edge = x < W && B.egaNone[y * W + x] !== B.egaNone[(y - 1) * W + x];
      if (edge && x0 < 0) x0 = x;
      if (!edge && x0 >= 0) { segs.push(contour(new Float32Array([PIC.x + x0 * 3, PIC.y + y * 3, PIC.x + x * 3, PIC.y + y * 3]), false)); x0 = -1; }
    }
  }
  A.s1.stripes = segs;
}

// T: { title, mode, colours, held, mc, cut, collapse, bits, stripes, exit }
export function draw(t, A, T, items) {
  const S = A.s1, B = A.B;
  const put = (shape, fill, a, screen = true) => { if (a > 0.003) items.push({ shape, fill, opacity: a, screen }); };
  // The picture: full colour until median cut, the 256 version while it is compared, EGA after.
  const picO = window(t, T.title - 1.6, T.mc + 0.4, 0.8, 0.8);
  picture(items, "src", picO);
  put(S.title, C.ink, window(t, T.title, T.vga, 0.6, 0.6));
  // The VGA budget: the pixel grid over a crop, then the palette strip and the cube arithmetic.
  const grid = window(t, T.mode, T.colours, 0.6, 0.6);
  if (grid > 0) {
    const { x0, y0, w, h } = S.crop, g = [];
    for (let i = 0; i <= w; i++) g.push(contour(new Float32Array([PIC.x + (x0 + i) * 3, PIC.y + y0 * 3, PIC.x + (x0 + i) * 3, PIC.y + (y0 + h) * 3]), false));
    for (let j = 0; j <= h; j++) g.push(contour(new Float32Array([PIC.x + x0 * 3, PIC.y + (y0 + j) * 3, PIC.x + (x0 + w) * 3, PIC.y + (y0 + j) * 3]), false));
    // The crop's pixels as exact squares, so the push-in shows hard pixels, not a blurred image.
    const px = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const p = ((y0 + j) * W + x0 + i) * 4;
      px.push({ shape: rect(PIC.x + (x0 + i) * 3, PIC.y + (y0 + j) * 3, 3, 3), fill: hex([B.src[p], B.src[p + 1], B.src[p + 2]]), opacity: grid });
    }
    items.push(...px);
    items.push({ shape: g, stroke: C.ink, width: 0.12, opacity: 0.8 * grid });
    put(S.mode, C.ink, grid, true);
  }
  const strip = window(t, T.colours, T.mc, 0.6, 0.6);
  if (strip > 0) {
    const cells = [];
    for (let k = 0; k < 256; k++) cells.push(...rect(STRIP.x + (k % 16) * STRIP.cell, STRIP.y + Math.floor(k / 16) * STRIP.cell, STRIP.cell - 4, STRIP.cell - 4, 2));
    items.push({ shape: cells, stroke: C.ink2, width: 1.2, opacity: 0.9 * strip, screen: true });
    put(S.at, C.ink, strip); put(S.cube, C.ink2, strip * span(t, T.colours + 1.2, T.colours + 2)); put(S.arith, C.ink2, strip * span(t, T.colours + 1.6, T.colours + 2.4));
  }
  // Median cut: the picture's colours as a cloud in the RGB cube, turning slowly.
  const cloud = window(t, T.mc - 0.4, T.bits, 1.0, 0.8), yaw = 0.5 + 0.06 * (t - T.mc);
  if (cloud > 0) {
    const fold = span(t, T.collapse, T.collapse + 2.0, ease.inOut);
    for (const b of S.bins) {
      const sh = [];
      for (const p of b.pts) { const [x, y] = project(p, yaw); sh.push(...rect(x - 1.6, y - 1.6, 3.2, 3.2)); }
      items.push({ shape: sh, fill: hex(b.c), opacity: cloud * (1 - fold) * 0.9, screen: true });
    }
    items.push({ shape: boxLines([0, 0, 0], [255, 255, 255], yaw), stroke: C.faint, width: 1, opacity: cloud, screen: true });
    put(S.nColours, C.ink, window(t, T.mc + 0.4, T.cut, 0.6, 0.4)); put(S.counted, C.dim, window(t, T.mc + 0.4, T.cut, 0.6, 0.4));
    // The cuts: one round per 0.9 s, 1 box to 256.
    const k = Math.max(0, Math.min(8, Math.floor((t - T.cut) / 0.9)));
    if (t >= T.cut - 0.3) {
      const lines = B.mc.steps[k].flatMap(([lo, hi]) => boxLines(lo, hi, yaw));
      items.push({ shape: lines, stroke: C.ink, width: 0.8, opacity: cloud * (1 - fold) * 0.7, screen: true });
      put(S.boxes[k], C.ink, cloud * (1 - fold) * span(t, T.cut - 0.3, T.cut + 0.3));
    }
    // Each box collapses to its mean colour and lands in the strip.
    if (fold > 0) B.mc.palette.forEach((c, j) => {
      const [x0, y0] = project(c, yaw), x1 = STRIP.x + (j % 16) * STRIP.cell + 13, y1 = STRIP.y + Math.floor(j / 16) * STRIP.cell + 13;
      const u = span(t, T.collapse + 0.4 + (j / 256) * 0.5, T.collapse + 1.8 + (j / 256) * 0.5, ease.inOut);
      items.push({ shape: rect(lerp(x0, x1, u) - 11, lerp(y0, y1, u) - 11, 22, 22, 2), fill: hex(c), opacity: cloud * Math.min(1, fold * 2), screen: true });
    });
    put(S.same, C.ink, window(t, T.collapse + 0.6, T.bits, 0.6, 0.6));
  }
  // The picture in 256 colours beside the original.
  const side = window(t, T.bits - 0.2, T.stripes + 0.2, 0.8, 0.4);
  if (side > 0) {
    picture(items, "src", side, { x: 120, y: 200, w: 820, h: 512.5 }, 1);
    picture(items, "mc", side, { x: 980, y: 200, w: 820, h: 512.5 }, 1);
    put(S.bits, C.ink, side); put(S.eye, C.ink2, side * span(t, T.bits + 0.8, T.bits + 1.4));
    put(S.orig, C.dim, side); put(S.mc, C.dim, side);
  }
  // 16 colours: the sky breaks into stripes, outlined in drift.
  const ega = window(t, T.stripes - 0.2, T.exit, 0.6, 0.6);
  if (ega > 0) {
    picture(items, "egaNone", ega, PIC, span(t, T.stripes - 0.2, T.stripes + 0.8, ease.linear));
    put(S.sixteen, C.ink, ega);
    const st = window(t, T.stripeWord, T.exit, 0.6, 0.6);
    if (st > 0) items.push({ shape: S.stripes, stroke: C.hot, width: 10, blur: 6, opacity: 0.35 * st });
      items.push({ shape: S.stripes, stroke: C.hot, width: 3.2, opacity: 0.95 * st });
  }
}
