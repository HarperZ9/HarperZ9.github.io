/* retro-crt.js: the tube stage of the Retro engine.

   Runs on the upscaled frame, in this order: beam scanlines whose row means
   keep the retro.py law together with a phosphor mask (aperture grille, slot
   mask, or dot triads), then bloom and halation blurred in linear light at
   quarter resolution, then one tube pass that barrel-warps the frame with
   bilinear sampling, a feathered rounded bezel, radial colour separation,
   and the vignette. Plain ImageData arithmetic throughout, so the browser
   and an offline run agree and every table can be checked in a node test.
   The hot loops run in 8.8 fixed point so a 960x600 frame stays under a
   tenth of a second on a laptop. */

function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

// sRGB transfer, both directions, as lookup tables.
const TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  TO_LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const LIN_STEPS = 4096;
const TO_SRGB = new Uint8ClampedArray(LIN_STEPS + 1);
for (let i = 0; i <= LIN_STEPS; i++) {
  const l = i / LIN_STEPS;
  TO_SRGB[i] = Math.round((l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055) * 255);
}
const toSrgb = (l) => TO_SRGB[l >= 1 ? LIN_STEPS : l <= 0 ? 0 : (l * LIN_STEPS + 0.5) | 0];
const fixed = (t) => { const o = new Int32Array(t.length); for (let i = 0; i < t.length; i++) o[i] = (t[i] * 256 + 0.5) | 0; return o; };

export const MASK_MODES = ["none", "grille", "slot", "dot"];

/* beamTable(cell, strength, beam) -> Float32Array(16 * cell)
   Row factors for one scanline cell, indexed [lum bucket * cell + sub-row].
   Every bucket averages to 1.05 - strength / 2, the row mean of the retro.py
   law (even rows at 1 - strength, odd rows at 1.1), so a browser render and
   an offline render keep the same tone. The beam is a gaussian centred on
   the cell whose width grows with the brightness of the cell, the way the
   spot of a gun swells as it drives harder: whites fill in, darks show
   lines. */
export function beamTable(cell, strength, beam = 0.5) {
  const s = clamp(+strength || 0, 0, 1), mean = 1.05 - s / 2, up = Math.max(1, cell | 0);
  const out = new Float32Array(16 * up), g = new Float32Array(up), centre = Math.floor(up / 2);
  for (let k = 0; k < 16; k++) {
    const sigma = 0.17 + clamp(+beam || 0, 0, 1) * 0.2 * (k / 15);
    let sum = 0;
    for (let r = 0; r < up; r++) { const v = (r - centre) / up; g[r] = Math.exp(-0.5 * (v / sigma) * (v / sigma)); sum += g[r]; }
    for (let r = 0; r < up; r++) out[k * up + r] = Math.min(1.4, mean * (1 - s + s * (g[r] * up / sum)));
  }
  return out;
}

/* maskTable(mode, strength) -> Float32Array(6 * 3 * 3)
   Per-channel weights of a phosphor mask over its 3 x 6 pixel period, indexed
   [((y % 6) * 3 + x % 3) * 3 + channel]. The lit channel carries a small gain
   so a mask at moderate strength keeps its tone instead of going grey. */
export function maskTable(mode, strength) {
  const m = clamp(+strength || 0, 0, 1), out = new Float32Array(6 * 3 * 3);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 3; x++) {
    let chan = x % 3, rowDark = 1;
    if (mode === "slot") { if (((y + ((x / 3) | 0) * 3) % 6) === 5) rowDark = 1 - m * 0.75; }
    else if (mode === "dot") { chan = (x + (((y / 3) | 0) & 1) * 2) % 3; if (y % 3 === 2) rowDark = 1 - m * 0.5; }
    else if (mode !== "grille") { chan = -1; }
    const gain = chan < 0 ? 1 : (1 + m * 0.45) * rowDark, off = chan < 0 ? 1 : (1 - m) * gain;
    const p = (y * 3 + x) * 3;
    out[p] = chan === 0 ? gain : off; out[p + 1] = chan === 1 ? gain : off; out[p + 2] = chan === 2 ? gain : off;
  }
  return out;
}

// Beam scanlines and the phosphor mask, one pass over the frame. A 1x frame
// has no cell to shape, so it keeps the retro.py row law verbatim.
function phosphorPass(d, w, h, o, cell) {
  const scan = !!o.scanlines, s = clamp(+o.scanStrength || 0, 0, 1);
  const maskOn = !!(o.mask && o.mask !== "none" && o.maskStrength > 0);
  if (!scan && !maskOn) return;
  const beam = fixed(scan && cell >= 2 ? beamTable(cell, s, o.beam) : new Float32Array(16).fill(1));
  const mt = fixed(maskOn ? maskTable(o.mask, o.maskStrength) : new Float32Array(54).fill(1));
  const flatCell = scan && cell < 2;
  for (let y = 0; y < h; y++) {
    const row = y % cell, ry = (y % 6) * 3, flat = flatCell ? (((y & 1) === 0 ? 1 - s : 1.1) * 256) | 0 : 0;
    let i = y * w * 4;
    for (let x = 0; x < w; x++, i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], p = (ry + x % 3) * 3;
      const k = (r > g ? (r > b ? r : b) : (g > b ? g : b)) >> 4;
      const f = flat > 0 ? flat : beam[k * cell + row];
      d[i] = (r * f * mt[p] + 32768) >> 16; d[i + 1] = (g * f * mt[p + 1] + 32768) >> 16; d[i + 2] = (b * f * mt[p + 2] + 32768) >> 16;
    }
  }
}

// One box-blur line with a running sum and clamped ends: src -> dst along
// stride, len elements from base.
function boxLine(src, dst, base, stride, len, r) {
  const inv = 1 / (2 * r + 1), first = src[base], last = src[base + (len - 1) * stride];
  let sum = first * (r + 1);
  for (let i = 1; i <= r; i++) sum += i < len ? src[base + i * stride] : last;
  for (let i = 0; i < len; i++) {
    dst[base + i * stride] = sum * inv;
    const a = i + r + 1, b = i - r;
    sum += (a < len ? src[base + a * stride] : last) - (b >= 0 ? src[base + b * stride] : first);
  }
}

// Three box passes approximate a gaussian of the given sigma at a cost that
// does not grow with the radius. In place over an lw x lh x 3 float buffer.
function blur3(buf, lw, lh, sigma) {
  const r = Math.max(1, Math.round(Math.sqrt(sigma * sigma * 4 + 1) / 2 - 0.5));
  const tmp = new Float32Array(buf.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < lh; y++) for (let c = 0; c < 3; c++) boxLine(buf, tmp, y * lw * 3 + c, 3, lw, r);
    for (let x = 0; x < lw; x++) for (let c = 0; c < 3; c++) boxLine(tmp, buf, x * 3 + c, lw * 3, lh, r);
  }
}

// Box-downsample the frame into linear light at 1/q, then return the glow
// field: thresholded bloom with a soft knee plus wide halation of the whole
// frame, each blurred and scaled by its amount.
function glowField(d, w, h, q, lw, lh, bloom, halation) {
  const lin = new Float32Array(lw * lh * 3);
  for (let y = 0; y < h; y++) {
    const lrow = ((y / q) | 0) * lw;
    let i = y * w * 4;
    for (let x = 0; x < w; x++, i += 4) {
      const p = (lrow + ((x / q) | 0)) * 3;
      lin[p] += TO_LIN[d[i]]; lin[p + 1] += TO_LIN[d[i + 1]]; lin[p + 2] += TO_LIN[d[i + 2]];
    }
  }
  const bright = new Float32Array(lw * lh * 3);
  for (let ly = 0; ly < lh; ly++) {
    const cy = Math.min(q, h - ly * q);
    for (let lx = 0; lx < lw; lx++) {
      const p = (ly * lw + lx) * 3, n = 1 / (cy * Math.min(q, w - lx * q));
      const r = lin[p] * n, g = lin[p + 1] * n, b = lin[p + 2] * n;
      lin[p] = r; lin[p + 1] = g; lin[p + 2] = b;
      const t = clamp((0.2126 * r + 0.7152 * g + 0.0722 * b - 0.18) / 0.3, 0, 1), k = t * t * (3 - 2 * t);
      bright[p] = r * k; bright[p + 1] = g * k; bright[p + 2] = b * k;
    }
  }
  const glow = new Float32Array(lw * lh * 3);
  if (bloom > 0) { blur3(bright, lw, lh, 8 / q); for (let i = 0; i < glow.length; i++) glow[i] += bright[i] * bloom * 0.9; }
  if (halation > 0) { blur3(lin, lw, lh, 28 / q); for (let i = 0; i < glow.length; i++) glow[i] += lin[i] * halation * 0.3; }
  return glow;
}

// Add the glow field back through a bilinear upsample, in linear light.
// Linear light is what makes a glow read as light and not as chalk.
function glowPass(d, w, h, bloom, halation) {
  const q = Math.min(w, h) < 320 ? 2 : 4, lw = Math.ceil(w / q), lh = Math.ceil(h / q);
  const glow = glowField(d, w, h, q, lw, lh, bloom, halation);
  const X0 = new Int32Array(w), X1 = new Int32Array(w), TX = new Float32Array(w);
  for (let x = 0; x < w; x++) { const fx = clamp((x + 0.5) / q - 0.5, 0, lw - 1); X0[x] = fx | 0; X1[x] = Math.min(lw - 1, X0[x] + 1); TX[x] = fx - X0[x]; }
  for (let y = 0; y < h; y++) {
    const fy = clamp((y + 0.5) / q - 0.5, 0, lh - 1), y0 = fy | 0, ty = fy - y0, y1 = Math.min(lh - 1, y0 + 1);
    const ra = y0 * lw, rc = y1 * lw;
    let i = y * w * 4;
    for (let x = 0; x < w; x++, i += 4) {
      const tx = TX[x], a = (ra + X0[x]) * 3, b = (ra + X1[x]) * 3, c = (rc + X0[x]) * 3, e = (rc + X1[x]) * 3;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const gr = glow[a] * w00 + glow[b] * w10 + glow[c] * w01 + glow[e] * w11;
      const gg = glow[a + 1] * w00 + glow[b + 1] * w10 + glow[c + 1] * w01 + glow[e + 1] * w11;
      const gb = glow[a + 2] * w00 + glow[b + 2] * w10 + glow[c + 2] * w01 + glow[e + 2] * w11;
      if (gr + gg + gb < 0.0015) continue;
      d[i] = toSrgb(TO_LIN[d[i]] + gr); d[i + 1] = toSrgb(TO_LIN[d[i + 1]] + gg); d[i + 2] = toSrgb(TO_LIN[d[i + 2]] + gb);
    }
  }
}

// One channel of the source, sampled bilinearly at tube coordinates in
// [-1, 1], in 8.8 fixed point.
function tap(src, w, h, su, sv, c) {
  let sx = (su + 1) * (w - 1) * 0.5, sy = (sv + 1) * (h - 1) * 0.5;
  if (sx < 0) sx = 0; else if (sx > w - 1) sx = w - 1;
  if (sy < 0) sy = 0; else if (sy > h - 1) sy = h - 1;
  const x0 = sx | 0, y0 = sy | 0, tx = ((sx - x0) * 256) | 0, ty = ((sy - y0) * 256) | 0;
  const p = (y0 * w + x0) * 4 + c, dx = x0 + 1 < w ? 4 : 0, dy = y0 + 1 < h ? w * 4 : 0;
  const top = src[p] * (256 - tx) + src[p + dx] * tx, bot = src[p + dy] * (256 - tx) + src[p + dy + dx] * tx;
  return (top * (256 - ty) + bot * ty) >> 16;
}

// Coverage of the tube face at warped coordinates: a rounded-rectangle
// distance field with a feathered edge, or a hard edge when there is no
// curvature to round.
function bezelAlpha(asu, asv, rc, feather) {
  if (rc <= 0) return asu <= 1 && asv <= 1 ? 1 : 0;
  const qx = asu - (1 - rc), qy = asv - (1 - rc), mx = qx > 0 ? qx : 0, my = qy > 0 ? qy : 0;
  const inner = qx > qy ? qx : qy;
  const dist = Math.sqrt(mx * mx + my * my) + (inner < 0 ? inner : 0) - rc;
  return clamp(-dist / feather, 0, 1);
}

// Vignette only: no resample needed when the tube is flat and converged.
function vignettePass(d, w, h, vignette, VX, H2, nv) {
  const vg = vignette * 256;
  for (let y = 0; y < h; y++) {
    const v = (y / (h - 1)) * 2 - 1, vy = v * v * H2 * nv;
    let i = y * w * 4;
    for (let x = 0; x < w; x++, i += 4) { const f = (256 - vg * (VX[x] + vy)) | 0; d[i] = (d[i] * f) >> 8; d[i + 1] = (d[i + 1] * f) >> 8; d[i + 2] = (d[i + 2] * f) >> 8; }
  }
}

// Barrel curvature with bilinear sampling, a feathered rounded bezel, radial
// colour separation (the misconvergence of a tube, one scale per channel),
// and the vignette, in a single resample.
function tubePass(d, w, h, curvature, aberration, vignette) {
  const W2 = (w - 1) * (w - 1), H2 = (h - 1) * (h - 1), nv = 1 / (W2 + H2);
  const U = new Float32Array(w), VX = new Float32Array(w);
  for (let x = 0; x < w; x++) { const u = (x / (w - 1)) * 2 - 1; U[x] = u; VX[x] = u * u * W2 * nv; }
  if (curvature <= 0 && aberration <= 0) { if (vignette > 0) vignettePass(d, w, h, vignette, VX, H2, nv); return; }
  const src = new Uint8ClampedArray(d), k = curvature * 0.35, dab = aberration * 0.012, vg = vignette * 256;
  const rc = curvature > 0 ? 0.02 + 0.08 * Math.min(1, curvature) : 0, feather = 1.5 / ((w + h) / 4);
  const safe = 1 - rc - feather * 2, fr = 1 - dab, fb = 1 + dab;
  for (let y = 0; y < h; y++) {
    const v = (y / (h - 1)) * 2 - 1, vy = v * v * H2 * nv;
    let i = y * w * 4;
    for (let x = 0; x < w; x++, i += 4) {
      const u = U[x], f = 1 + k * (u * u + v * v), su = u * f, sv = v * f;
      const asu = su < 0 ? -su : su, asv = sv < 0 ? -sv : sv;
      const alpha = asu <= safe && asv <= safe ? 1 : bezelAlpha(asu, asv, rc, feather);
      if (alpha <= 0) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; continue; }
      const vf = (alpha * (256 - vg * (VX[x] + vy))) | 0;
      d[i] = (tap(src, w, h, su * fr, sv * fr, 0) * vf) >> 8;
      d[i + 1] = (tap(src, w, h, su, sv, 1) * vf) >> 8;
      d[i + 2] = (tap(src, w, h, su * fb, sv * fb, 2) * vf) >> 8;
    }
  }
}

/* crtStage(ctx, w, h, o): apply the tube stage in place on a 2d context.
   o: cell (device pixels per source pixel), scanlines, scanStrength, beam,
   mask (none, grille, slot, or dot), maskStrength, bloom, halation,
   curvature, aberration, vignette. */
export function crtStage(ctx, w, h, o) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  phosphorPass(d, w, h, o, Math.max(1, o.cell | 0));
  const bloom = Math.max(0, +o.bloom || 0), halation = Math.max(0, +o.halation || 0);
  if (bloom > 0 || halation > 0) glowPass(d, w, h, bloom, halation);
  tubePass(d, w, h, Math.max(0, +o.curvature || 0), Math.max(0, +o.aberration || 0), Math.max(0, +o.vignette || 0));
  ctx.putImageData(img, 0, 0);
}

export function crtActive(o) {
  return !!(o.scanlines || o.bloom > 0 || o.halation > 0 || o.curvature > 0 || o.aberration > 0 || o.vignette > 0
    || (o.mask && o.mask !== "none" && o.maskStrength > 0));
}
