/* glitch-ops-wave2.js — the chemical and print bench.

   Six more ops for the effects rack, in the same shape as glitch-ops.js: each
   takes (canvas, p) and mutates the canvas in place, so they compose in any
   order, and everything random comes from the seeded PRNG so a seed reproduces
   the picture exactly. Merge OPS2 into OPS and concat OP_META2 onto OP_META.

   These are darkroom and press processes rather than digital filters. A
   solarisation crosses over where the second exposure caught the paper and
   leaves the developer's Mackie fringe at the crossing. A dye transfer prints
   three matrix films that land a hair out of register, and the gelatin edge
   beads dye where it lifts. A bleach bypass keeps the silver on top of the
   dyes. A lith print is grossly overexposed into dilute developer, so the
   blacks snowball and the highlights fall off the paper. A duotone lays two
   real ink curves onto paper, subtractively. A wet plate is poured by hand, so
   the emulsion is uneven, the tide line is wavy, and the bromide runs.

   Every op is a single full-resolution pass (or a coarse grid sampled up),
   returns early on a zero-size canvas, and is an exact no-op at amount 0. */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rng2From(seed) {
  if (typeof seed === "function") return seed;
  let h = 2166136261; const s = String(seed == null ? 1 : seed);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return mulberry32(h >>> 0);
}

const luma = (d, i) => (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// integer hash -> [0,1), for grain and for the emulsion field. Seeded, so the
// same seed lays the same grain down every frame.
function ihash(x, y, s) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0;
  n = n ^ (n >>> 13); n = Math.imul(n, 1274126177); n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967296;
}
// smooth value noise on the integer lattice
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = ihash(xi, yi, s), b = ihash(xi + 1, yi, s), c = ihash(xi, yi + 1, s), d = ihash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------------------------------------------------------------------------
// Sabattier — solarisation by a second exposure part-way through development.
// The silver already developed shields what is under it, so the reversal takes
// hold above a density threshold and rolls in over a shoulder rather than
// snapping. Where the reversed and unreversed tones meet, the developer is
// locally exhausted on one side and fresh on the other, which prints as the
// pale Mackie line along the crossover.
// ---------------------------------------------------------------------------
export function sabattier(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5); if (a <= 0.002) return;
  const w = canvas.width | 0, h = canvas.height | 0; if (w < 1 || h < 1) return;
  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, w, h), d = img.data;

  // the second exposure walks the crossover down the scale as it gets longer,
  // and hardens the shoulder as more of the paper is re-fogged
  const T = p.threshold == null ? 0.94 - a * 0.46 : clamp01(p.threshold);
  const sh = Math.max(0.05, 0.32 - a * 0.22);
  const mack = a * 0.62;

  const n = w * h, L = new Float32Array(n);
  for (let i = 0, j = 0; j < n; i += 4, j++) L[j] = luma(d, i);
  // the reversal is a transfer curve, so it lives in a table like one
  const WR = new Float32Array(256);
  for (let k = 0; k < 256; k++) WR[k] = smooth((k / 255 - T + sh) / (2 * sh)) * a;

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const q = y * w + x, i = q * 4, l = L[q];
    // reversal weight: 0 below the crossover, a at the top of the shoulder
    const wr = WR[(l * 255) | 0];
    if (wr > 0) {
      d[i] = clamp255(d[i] + wr * (255 - 2 * d[i]));
      d[i + 1] = clamp255(d[i + 1] + wr * (255 - 2 * d[i + 1]));
      d[i + 2] = clamp255(d[i + 2] + wr * (255 - 2 * d[i + 2]));
    }
    if (mack <= 0) continue;
    // Mackie fringe: only where a real edge sits near the crossover density
    const xm = x > 0 ? L[q - 1] : l, xp = x < w - 1 ? L[q + 1] : l;
    const ym = y > 0 ? L[q - w] : l, yp = y < h - 1 ? L[q + w] : l;
    const grad = Math.abs(xp - xm) + Math.abs(yp - ym);
    if (grad < 0.008) continue;
    const u = (l - T) / sh;
    const fringe = mack * Math.min(1, grad * 2.4) * Math.exp(-u * u * 2.0) * 200;
    d[i] = clamp255(d[i] + fringe);
    d[i + 1] = clamp255(d[i + 1] + fringe * 0.98);
    d[i + 2] = clamp255(d[i + 2] + fringe * 0.92);
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Dye transfer — three matrix films, one per subtractive ink, rolled onto the
// receiver in sequence. Each lands with its own small offset and a fraction of
// a degree of rotation, so the register breaks into coloured fringes. Where a
// plate runs off the paper its ink simply is not there, and at the edge of the
// gelatin the dye pools as it lifts, laying a heavier bead just inside the
// boundary. Ink is handled as density, subtractively, the way it prints.
// ---------------------------------------------------------------------------
export function dyeTransfer(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5); if (a <= 0.002) return;
  const w = canvas.width | 0, h = canvas.height | 0; if (w < 1 || h < 1) return;
  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, w, h), s = img.data;
  const out = ctx.createImageData(w, h), o = out.data;

  const rng = rng2From(p.seed == null ? "dye-transfer" : p.seed);
  const m = Math.min(w, h), cx = (w - 1) / 2, cy = (h - 1) / 2;
  const maxOff = a * m * 0.038;
  const ox = new Float64Array(3), oy = new Float64Array(3), ca = new Float64Array(3), sa = new Float64Array(3);
  for (let k = 0; k < 3; k++) {
    const ang = rng() * 6.2831853, r = (0.3 + 0.7 * rng()) * maxOff;
    ox[k] = Math.cos(ang) * r; oy[k] = Math.sin(ang) * r;
    const rot = (rng() - 0.5) * a * 0.014;      // the matrix lands a hair askew
    ca[k] = Math.cos(rot); sa[k] = Math.sin(rot);
  }
  const roll = Math.max(1, a * m * 0.022);      // width of the bead at the gelatin edge
  const bead = a * 130;                          // how much dye the lifting edge leaves
  const swell = a * 0.5;                         // and how much it thickens what is there

  // The plate transform is affine, so each row starts once and then steps: one
  // add per pixel per plate instead of a fresh rotation.
  const rx0 = -cx, sxr = new Float64Array(3), syr = new Float64Array(3);
  for (let y = 0; y < h; y++) {
    const ry = y - cy, row = y * w * 4;
    for (let k = 0; k < 3; k++) {
      sxr[k] = cx + rx0 * ca[k] - ry * sa[k] + ox[k];
      syr[k] = cy + rx0 * sa[k] + ry * ca[k] + oy[k];
    }
    for (let x = 0; x < w; x++) {
      const di = row + x * 4;
      for (let k = 0; k < 3; k++) {
        const sx = sxr[k], sy = syr[k];
        sxr[k] += ca[k]; syr[k] += sa[k];            // step one pixel along the row
        // distance from this plate's own boundary, in plate coordinates
        const edx = sx < w - 1 - sx ? sx : w - 1 - sx;
        const edy = sy < h - 1 - sy ? sy : h - 1 - sy;
        const ed = edx < edy ? edx : edy;
        if (ed < 0) { o[di + k] = 255; continue; }   // off the plate: no ink, bare paper
        let xi = (sx + 0.5) | 0, yi = (sy + 0.5) | 0;
        xi = xi > w - 1 ? w - 1 : xi; yi = yi > h - 1 ? h - 1 : yi;
        let dens = 255 - s[(yi * w + xi) * 4 + k];
        if (ed < roll) {
          const kb = 1 - ed / roll;                  // 0 at the roll line, 1 at the edge
          dens = dens * (1 + swell * kb) + bead * kb * kb;
        }
        o[di + k] = 255 - (dens > 255 ? 255 : dens);
      }
      o[di + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

// ---------------------------------------------------------------------------
// Bleach bypass — skip the bleach and the developed silver stays in the film
// on top of the colour dyes. A black and white image sits over the colour one:
// the colour reads muted, the luminance contrast climbs, blacks go dense and
// highlights stay hot. Built as a real silver layer composited over a
// desaturated base, not as a saturation slider.
// ---------------------------------------------------------------------------
export function bleachBypass(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5); if (a <= 0.002) return;
  const w = canvas.width | 0, h = canvas.height | 0; if (w < 1 || h < 1) return;
  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, w, h), d = img.data;

  const pull = a * 0.82;              // how much dye colour the silver buries
  const steep = 1 + a * 1.45;         // the retained silver's own contrast
  const dense = 1 + a * 0.16;         // and its overall density gain
  const n = w * h;
  // the silver layer is one curve on luminance: build it once
  const SIL = new Float32Array(256);
  for (let k = 0; k < 256; k++) {
    let sl = (k / 255 - 0.5) * steep + 0.5;
    sl = sl < 0 ? 0 : sl > 1 ? 1 : sl;
    SIL[k] = Math.pow(sl, dense) * 255;
  }

  for (let j = 0, i = 0; j < n; j++, i += 4) {
    const l = luma(d, i), gray = l * 255;
    const S = SIL[(l * 255) | 0];
    for (let c = 0; c < 3; c++) {
      const base = d[i + c] + (gray - d[i + c]) * pull;
      // overlay: the silver multiplies the shadows and screens the highlights
      const ov = S < 128 ? (2 * base * S) / 255 : 255 - (2 * (255 - base) * (255 - S)) / 255;
      d[i + c] = clamp255(base + (ov - base) * a);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Lith print — gross overexposure onto lith paper in heavily dilute developer.
// Development is infectious: once density starts anywhere it runs away, so the
// shadows snap shut into pitch black while the highlights, still barely
// developed, fall off the top of the scale onto bare paper. The grain is the
// developer clumping, so it coarsens and strengthens with exposure and is
// heaviest where development is only part-way. The tone splits, warm in the
// highlights, cold in the blacks; a little of the scene's own colour survives.
// ---------------------------------------------------------------------------
export function lith(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5); if (a <= 0.002) return;
  const w = canvas.width | 0, h = canvas.height | 0; if (w < 1 || h < 1) return;
  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, w, h), d = img.data;

  const rng = rng2From(p.seed == null ? "lith" : p.seed);
  const salt = (rng() * 2147483647) | 0;
  // Exposure is the squeeze on the curve, not a gain: the longer the paper sits
  // under the lamp the higher the toe climbs and the lower the shoulder drops,
  // until the whole picture lives in a narrow band of half-developed midtone.
  const toe = 0.02 + a * 0.30;                    // where the blacks snap shut
  const shoulder = 0.97 - a * 0.28;               // where the highlights leave the paper
  const span = Math.max(0.05, shoulder - toe);
  const inf = 1 + a * 1.9;                        // the snowball
  const blowAt = 0.86 - a * 0.14;
  const gAmp = a * 82;                            // grain grows with exposure
  const gClump = 1 + a * 1.7;                     // and clumps coarser
  const keepC = 1 - a * 0.74;                     // scene colour that survives the paper
  // split tone: cold black, warm paper
  const sr = 12, sg = 11, sb = 17, hr = 255, hg = 236, hb = 208;

  // the paper's characteristic curve: exposure, toe, infectious run-up, shoulder
  const CURVE = new Float32Array(256), GRAIN = new Float32Array(256);
  for (let k = 0; k < 256; k++) {
    let t = (k / 255 - toe) / span;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    let v = Math.pow(t, inf);                     // infectious: the low end collapses
    if (v > blowAt) v = v + (1 - v) * smooth((v - blowAt) / (1 - blowAt)) * (0.35 + a * 0.65);
    CURVE[k] = v;
    GRAIN[k] = Math.pow(4 * v * (1 - v), 0.7) * (1.12 - 0.4 * v);
  }

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const l0 = luma(d, i), k = (l0 * 255) | 0;
    const v = CURVE[k];
    // clumped developer grain, heaviest through the partly developed tones
    const gw = GRAIN[k];
    const g = gw > 0.002
      ? (vnoise(x / gClump * 0.9, y / gClump * 0.9, salt) * 0.65 + ihash(x, y, salt + 7) * 0.35 - 0.5) * gAmp * gw
      : 0;
    const tr = sr + (hr - sr) * v + g, tg = sg + (hg - sg) * v + g, tb = sb + (hb - sb) * v + g;
    // hold a little of the original chroma, scaled so the blacks stay black
    const ch = keepC * (0.45 + 0.55 * v), base = l0 * 255;
    const rr = tr + (d[i] - base) * ch, rg = tg + (d[i + 1] - base) * ch, rb = tb + (d[i + 2] - base) * ch;
    d[i] = clamp255(d[i] + (rr - d[i]) * a);
    d[i + 1] = clamp255(d[i + 1] + (rg - d[i + 1]) * a);
    d[i + 2] = clamp255(d[i + 2] + (rb - d[i + 2]) * a);
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Duotone — the picture separated onto two printing plates and run as two
// inks on paper. The black plate carries a shadow-weighted curve; the second
// ink carries a curve that peaks through the midtones and backs off in the
// deepest shadow, which is how a duotone keeps its blacks neutral and its mids
// coloured. The inks lay down subtractively (Beer-Lambert, one multiply per
// plate) over a warm paper white, so overprint darkens the way real ink does.
// The second ink is pulled from the frame's own dominant chroma unless asked
// otherwise, so it reads as this picture's separation rather than a preset.
// ---------------------------------------------------------------------------
const DUO_INKS = {
  warm: [206, 96, 40], cool: [46, 84, 176], sepia: [166, 118, 62],
  red: [198, 44, 58], green: [46, 140, 96], violet: [118, 66, 168],
};
export function duotone(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5); if (a <= 0.002) return;
  const w = canvas.width | 0, h = canvas.height | 0; if (w < 1 || h < 1) return;
  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, w, h), d = img.data;

  const rng = rng2From(p.seed == null ? "duotone" : p.seed);
  // find the frame's dominant chroma on a coarse sample
  let ar = 0, ag = 0, ab = 0, cnt = 0;
  for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
    const i = (y * w + x) * 4; ar += d[i]; ag += d[i + 1]; ab += d[i + 2]; cnt++;
  }
  if (!cnt) return;
  ar /= cnt; ag /= cnt; ab /= cnt;
  const al = ar * 0.299 + ag * 0.587 + ab * 0.114;
  let ir = ar - al, ig = ag - al, ib = ab - al;
  const chroma = Math.sqrt(ir * ir + ig * ig + ib * ib);
  let inkB;
  const named = DUO_INKS[p.ink];
  if (named) inkB = named;
  else if (chroma < 6) {
    // a single-colour or neutral frame has no hue to separate: take one
    const keys = Object.keys(DUO_INKS);
    inkB = DUO_INKS[keys[Math.floor(rng() * keys.length) % keys.length]];
  } else {
    // push the average chroma out to a printable ink strength
    const k = 118 / chroma;
    inkB = [clamp255(150 + ir * k), clamp255(140 + ig * k), clamp255(140 + ib * k)];
  }
  const inkA = p.black && p.black.length === 3 ? p.black : [22, 21, 28];
  const paper = p.paper && p.paper.length === 3 ? p.paper : [246, 242, 233];
  const ta = [1 - inkA[0] / 255, 1 - inkA[1] / 255, 1 - inkA[2] / 255];
  const tb = [1 - inkB[0] / 255, 1 - inkB[1] / 255, 1 - inkB[2] / 255];
  const n = w * h;
  // Both plates are curves on density, and the ink lays down the same way for
  // every pixel of a given tone: separate once into three 256-step tables.
  const PR = new Float32Array(256), PG = new Float32Array(256), PB = new Float32Array(256);
  for (let k = 0; k < 256; k++) {
    const dens = 1 - k / 255;
    const dA = Math.pow(dens, 1.7);                             // black plate: shadows
    const dB = Math.pow(dens, 0.55) * (1 - 0.62 * dens * dens); // colour plate: mids
    PR[k] = paper[0] * (1 - dA * ta[0]) * (1 - dB * tb[0]);
    PG[k] = paper[1] * (1 - dA * ta[1]) * (1 - dB * tb[1]);
    PB[k] = paper[2] * (1 - dA * ta[2]) * (1 - dB * tb[2]);
  }

  for (let j = 0, i = 0; j < n; j++, i += 4) {
    const k = (luma(d, i) * 255) | 0;
    d[i] = clamp255(d[i] + (PR[k] - d[i]) * a);
    d[i + 1] = clamp255(d[i + 1] + (PG[k] - d[i + 1]) * a);
    d[i + 2] = clamp255(d[i + 2] + (PB[k] - d[i + 2]) * a);
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Wet plate — collodion poured onto the plate by hand. The emulsion never
// lands evenly, so a low-frequency thickness field runs through the whole
// image; the pour stops short of the edges in a wavy tide line and thins
// hardest at the corners where it was tipped off; the sensitised collodion is
// blue-blind at the red end (ortho response), which is why skies blow and skin
// goes dark; and bromide runs down the plate in drips that stall and bead.
// Frame edge and drips are precomputed per row and per column, so the pixel
// pass stays a single flat loop.
// ---------------------------------------------------------------------------
export function wetPlate(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5); if (a <= 0.002) return;
  const w = canvas.width | 0, h = canvas.height | 0; if (w < 1 || h < 1) return;
  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, w, h), d = img.data;

  const rng = rng2From(p.seed == null ? "wet-plate" : p.seed);
  const salt = (rng() * 2147483647) | 0;
  const m = Math.min(w, h);

  // the wavy tide line: the pour reaches a different depth along each edge
  const base = a * m * 0.10 + 1;
  const thX = new Float32Array(h), thY = new Float32Array(w);
  for (let y = 0; y < h; y++) thX[y] = Math.max(0.75, base * (0.30 + 1.5 * vnoise(y * 0.018, 3.5, salt)));
  for (let x = 0; x < w; x++) thY[x] = Math.max(0.75, base * (0.30 + 1.5 * vnoise(x * 0.018, 91.25, salt + 5)));

  // bromide drips: each starts at the top edge, tapers, and beads where it stalls
  const nDrip = 2 + Math.round(a * 7);
  const dripLen = new Float32Array(w), dripStr = new Float32Array(w);
  for (let k = 0; k < nDrip; k++) {
    const x0 = rng() * w;
    const hw = Math.max(1.5, m * (0.006 + rng() * 0.032));
    const len = h * (0.12 + rng() * 0.62) * a;
    const str = (rng() < 0.55 ? -1 : 1) * (0.35 + rng() * 0.65) * a;
    const lo = Math.max(0, Math.floor(x0 - hw)), hi = Math.min(w - 1, Math.ceil(x0 + hw));
    for (let x = lo; x <= hi; x++) {
      const t = 1 - Math.abs(x - x0) / hw;
      if (t <= 0) continue;
      const prof = Math.pow(t, 0.55) * (0.8 + 0.4 * vnoise(x * 0.15, k * 13.7, salt + 3));
      const L = len * (0.45 + 0.55 * prof);
      if (L > dripLen[x]) { dripLen[x] = L; dripStr[x] = str * prof; }
    }
  }

  // uneven emulsion thickness: coarse field, bilinear up
  const step = 8, gw = Math.ceil(w / step) + 2, gh = Math.ceil(h / step) + 2;
  const F = new Float32Array(gw * gh), fAmp = a * 0.26;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const nx = i * step * 0.010, ny = j * step * 0.010;
    F[j * gw + i] = 1 + (vnoise(nx, ny, salt + 11) * 0.65 + vnoise(nx * 2.7, ny * 2.7, salt + 19) * 0.35 - 0.5) * 2 * fAmp;
  }

  const tint = a * 0.74;
  // silver highlight, warm collodion black
  const sr = 28, sg = 23, sb = 21, hr = 236, hg = 234, hb = 226;
  const bare = [11, 10, 13];                       // the plate outside the pour

  for (let y = 0; y < h; y++) {
    const edgeY = Math.min(y, h - 1 - y);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // ortho response: the collodion barely sees red, drinks blue
      const lo = (d[i] * 0.08 + d[i + 1] * 0.30 + d[i + 2] * 0.62) / 255;
      let r = d[i] + (sr + (hr - sr) * lo - d[i]) * tint;
      let g = d[i + 1] + (sg + (hg - sg) * lo - d[i + 1]) * tint;
      let b = d[i + 2] + (sb + (hb - sb) * lo - d[i + 2]) * tint;

      // uneven pour thickness
      if (fAmp > 0) {
        const gi = x / step, gj = y / step, i0 = gi | 0, j0 = gj | 0;
        const fx = gi - i0, fy = gj - j0, k0 = j0 * gw + i0;
        const f = F[k0] + (F[k0 + 1] - F[k0]) * fx + (F[k0 + gw] - F[k0]) * fy;
        r *= f; g *= f; b *= f;
      }

      // bromide drip: a retarded or over-cleared run down the plate, beading
      // where it stalled
      const dl = dripLen[x];
      if (dl > 1 && y < dl) {
        const t = y / dl;
        const bead = 1 + 1.9 * Math.pow(smooth(1 - Math.abs(t - 0.92) / 0.14), 2);
        const k = dripStr[x] * Math.pow(1 - t, 0.6) * bead * 90;
        r += k; g += k * 0.96; b += k * 0.88;
      }

      // the tide line, eroded hardest at the corners where the pour was tipped
      const dxn = Math.min(x, w - 1 - x) / thY[x], dyn = edgeY / thX[y];
      let e = dxn < dyn ? dxn : dyn;
      if (e < 1.6) {
        e *= clamp01((dxn + dyn) * 0.6);
        const k = smooth(e);
        // a ridge of collodion catches the light just inside the line
        const ridge = Math.pow(smooth(1 - Math.abs(e - 1) / 0.4), 2) * a * 85;
        r = bare[0] + (r - bare[0]) * k + ridge;
        g = bare[1] + (g - bare[1]) * k + ridge * 0.97;
        b = bare[2] + (b - bare[2]) * k + ridge * 0.9;
      }
      d[i] = clamp255(r); d[i + 1] = clamp255(g); d[i + 2] = clamp255(b);
    }
  }
  ctx.putImageData(img, 0, 0);
}

export const OPS2 = { sabattier, dyeTransfer, bleachBypass, lith, duotone, wetPlate };

// Same shape as OP_META: array order is the apply pipeline, `cat` picks the
// shelf. Chemistry first (it changes the tone the ink then prints), the two
// press processes next, the hand-poured plate last so its edge frames whatever
// the rest of the rack did.
export const OP_META2 = [
  { op: "sabattier", label: "Sabattier", cat: "tone" },
  { op: "bleachBypass", label: "Bleach bypass", cat: "tone" },
  { op: "lith", label: "Lith print", cat: "tone" },
  { op: "duotone", label: "Duotone", cat: "tone" },
  { op: "dyeTransfer", label: "Dye transfer", cat: "tone" },
  { op: "wetPlate", label: "Wet plate", cat: "feel" },
];
