import { OPS2 as OPS_CHEM, OP_META2 as META_CHEM } from "./glitch-ops-wave2.js";
import { OPS2 as OPS_OPT, OP_META2 as META_OPT } from "./glitch-ops-wave2-optical.js";
import { OPS2 as OPS_TIME, OP_META2 as META_TIME } from "./glitch-ops-wave2-temporal.js";
/* glitch-ops.js — a stackable rack of manipulation + transformation effects.

   Each op takes a canvas and mutates it in place, so they compose in any order
   (the effects rack applies them in sequence). Anything random is driven by a
   seeded PRNG, so a given seed reproduces the same glitch exactly — chaos you
   can keep, in the site's reproducible-by-seed idiom. Zero dependencies. */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function rngFrom(seed) {
  if (typeof seed === "function") return seed;
  let h = 2166136261; const s = String(seed == null ? 1 : seed);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return mulberry32(h >>> 0);
}

const scratch = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const luma = (d, i) => (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;

// Pixel sort (Asendorf): sort contiguous runs whose luma sits in [low, high].
export function pixelSort(canvas, p = {}) {
  const low = p.low ?? 0.25, high = p.high ?? 0.8, vertical = p.axis === "col";
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const idx = vertical ? (k, line) => (k * w + line) * 4 : (k, line) => (line * w + k) * 4;
  const lines = vertical ? w : h, len = vertical ? h : w;
  for (let line = 0; line < lines; line++) {
    let start = -1;
    for (let k = 0; k <= len; k++) {
      const l = k < len ? luma(d, idx(k, line)) : -1;
      const inBand = k < len && l >= low && l <= high;
      if (inBand && start < 0) start = k;
      else if (!inBand && start >= 0) {
        const run = [];
        for (let j = start; j < k; j++) { const i = idx(j, line); run.push([d[i], d[i + 1], d[i + 2], d[i + 3], luma(d, i)]); }
        run.sort((a, b) => a[4] - b[4]);
        for (let j = start; j < k; j++) { const i = idx(j, line), c = run[j - start]; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3]; }
        start = -1;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

// RGB shift / chromatic aberration.
export function rgbShift(canvas, p = {}) {
  const dx = Math.round(p.dx ?? 6), dy = Math.round(p.dy ?? 0);
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  const s = ctx.getImageData(0, 0, w, h).data, out = ctx.createImageData(w, h), o = out.data;
  const cl = (v, m) => (v < 0 ? 0 : v > m ? m : v);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const ri = (cl(y + dy, h - 1) * w + cl(x + dx, w - 1)) * 4;
    const bi = (cl(y - dy, h - 1) * w + cl(x - dx, w - 1)) * 4;
    o[i] = s[ri]; o[i + 1] = s[i + 1]; o[i + 2] = s[bi + 2]; o[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

// Databend: shift the raw RGB byte stream (a non-multiple of 3 tears channels
// diagonally), with an optional XOR mask — the classic corrupt-the-bytes look.
export function databend(canvas, p = {}) {
  const shift = Math.max(1, Math.round(p.shift ?? 13)), xor = (p.xor | 0) & 255;
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height, n = w * h;
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const rgb = new Uint8Array(n * 3);
  for (let i = 0, j = 0; i < n; i++) { const k = i * 4; rgb[j++] = d[k]; rgb[j++] = d[k + 1]; rgb[j++] = d[k + 2]; }
  const len = rgb.length, out = new Uint8Array(len);
  for (let i = 0; i < len; i++) { let v = rgb[(i + shift) % len]; if (xor) v ^= xor; out[i] = v; }
  for (let i = 0, j = 0; i < n; i++) { const k = i * 4; d[k] = out[j++]; d[k + 1] = out[j++]; d[k + 2] = out[j++]; }
  ctx.putImageData(img, 0, 0);
}

// Slice glitch: displace random horizontal bands.
export function slice(canvas, p = {}) {
  const count = Math.max(1, Math.round(p.count ?? 9)), maxShift = p.maxShift ?? 0.14, rng = rngFrom(p.seed);
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  const tmp = scratch(w, h); tmp.getContext("2d").drawImage(canvas, 0, 0);
  ctx.clearRect(0, 0, w, h);
  let y = 0;
  for (let nb = 0; nb < count && y < h; nb++) {
    const bh = Math.max(2, Math.round((h / count) * (0.4 + rng() * 1.2)));
    const sx = Math.round((rng() * 2 - 1) * maxShift * w);
    ctx.drawImage(tmp, 0, y, w, bh, sx, y, w, bh);
    if (sx > 0) ctx.drawImage(tmp, w - sx, y, sx, bh, 0, y, sx, bh);
    else if (sx < 0) ctx.drawImage(tmp, 0, y, -sx, bh, w + sx, y, -sx, bh);
    y += bh;
  }
  if (y < h) ctx.drawImage(tmp, 0, y, w, h - y, 0, y, w, h - y);
}

// Wave / ripple displacement.
export function wave(canvas, p = {}) {
  const amp = p.amp ?? 0.03, freq = p.freq ?? 6, phase = p.phase ?? 0, vertical = p.axis === "col";
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  const tmp = scratch(w, h); tmp.getContext("2d").drawImage(canvas, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!vertical) for (let y = 0; y < h; y++) { const dx = Math.sin((y / h) * freq * 6.2832 + phase) * amp * w; ctx.drawImage(tmp, 0, y, w, 1, dx, y, w, 1); }
  else for (let x = 0; x < w; x++) { const dy = Math.sin((x / w) * freq * 6.2832 + phase) * amp * h; ctx.drawImage(tmp, x, 0, 1, h, x, dy, 1, h); }
}

// Mirror / kaleidoscope symmetry.
export function mirror(canvas, p = {}) {
  const mode = p.mode || "quad", ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  const tmp = scratch(w, h); tmp.getContext("2d").drawImage(canvas, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const q = (sx, sy) => { ctx.save(); ctx.translate(sx < 0 ? w : 0, sy < 0 ? h : 0); ctx.scale(sx, sy); ctx.drawImage(tmp, 0, 0, w / 2, h / 2, 0, 0, w / 2, h / 2); ctx.restore(); };
  if (mode === "x") { ctx.drawImage(tmp, 0, 0, w / 2, h, 0, 0, w / 2, h); ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(tmp, 0, 0, w / 2, h, 0, 0, w / 2, h); ctx.restore(); }
  else if (mode === "y") { ctx.drawImage(tmp, 0, 0, w, h / 2, 0, 0, w, h / 2); ctx.save(); ctx.translate(0, h); ctx.scale(1, -1); ctx.drawImage(tmp, 0, 0, w, h / 2, 0, 0, w, h / 2); ctx.restore(); }
  else { q(1, 1); q(-1, 1); q(1, -1); q(-1, -1); }
}

// Echo / ghost feedback.
export function echo(canvas, p = {}) {
  const dx = p.dx ?? 14, dy = p.dy ?? 8, alpha = p.alpha ?? 0.5;
  const ctx = canvas.getContext("2d");
  const tmp = scratch(canvas.width, canvas.height); tmp.getContext("2d").drawImage(canvas, 0, 0);
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, alpha)); ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(tmp, dx, dy); ctx.restore();
}

export function invert(canvas) {
  const ctx = canvas.getContext("2d"), img = ctx.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
  ctx.putImageData(img, 0, 0);
}

export function posterize(canvas, p = {}) {
  const levels = Math.max(2, Math.round(p.levels ?? 4)), step = 255 / (levels - 1);
  const ctx = canvas.getContext("2d"), img = ctx.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = Math.round(d[i] / step) * step; d[i + 1] = Math.round(d[i + 1] / step) * step; d[i + 2] = Math.round(d[i + 2] / step) * step; }
  ctx.putImageData(img, 0, 0);
}

// 4x4 ordered Bayer matrix (normalised thresholds), shared by dither.
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Ordered (Bayer) dither to N levels per channel — the classic 8-bit / PS1
// gradient break-up, applied AFTER the engine so it stacks with anything.
export function dither(canvas, p = {}) {
  const L = Math.max(2, Math.round(p.levels ?? 4));
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const m = (BAYER4[(x & 3) + (y & 3) * 4] + 0.5) / 16, i = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) {
      const scaled = (d[i + c] / 255) * (L - 1), lower = Math.floor(scaled);
      d[i + c] = ((scaled - lower > m ? lower + 1 : lower) / (L - 1)) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Halftone dot-screen: bright cells become bigger dots on ink — a print /
// op-art register (Zain's textile + plotter-density DNA).
export function halftone(canvas, p = {}) {
  const cell = Math.max(3, Math.round(p.cell ?? 6)), mono = p.color === "mono";
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  const tmp = scratch(w, h), tctx = tmp.getContext("2d"); tctx.drawImage(canvas, 0, 0);
  const s = tctx.getImageData(0, 0, w, h).data;
  ctx.fillStyle = "#07070c"; ctx.fillRect(0, 0, w, h);
  for (let cy = 0; cy < h; cy += cell) for (let cx = 0; cx < w; cx += cell) {
    const mx = Math.min(w - 1, cx + (cell >> 1)), my = Math.min(h - 1, cy + (cell >> 1)), i = (my * w + mx) * 4;
    const l = luma(s, i), r = l * (cell * 0.62);
    if (r < 0.35) continue;
    ctx.fillStyle = mono ? "#e9e6df" : `rgb(${s[i]},${s[i + 1]},${s[i + 2]})`;
    ctx.beginPath(); ctx.arc(cx + cell / 2, cy + cell / 2, r, 0, 6.2832); ctx.fill();
  }
}

// ASCII / text-mode: each cell becomes a glyph chosen by luminance. Colour
// modes cover terminal phosphor (green/amber), ink, or the source tint.
const ASCII_RAMP = " .:-=+*oz#%@";
export function ascii(canvas, p = {}) {
  const cell = Math.max(5, Math.round(p.cell ?? 10)), mode = p.color || "source";
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  const tmp = scratch(w, h), tctx = tmp.getContext("2d"); tctx.drawImage(canvas, 0, 0);
  const s = tctx.getImageData(0, 0, w, h).data;
  ctx.fillStyle = "#05050a"; ctx.fillRect(0, 0, w, h);
  ctx.font = "700 " + cell + "px " + "ui-monospace, monospace";
  ctx.textBaseline = "top";
  const tint = mode === "green" ? [120, 255, 150] : mode === "amber" ? [255, 176, 64] : mode === "ink" ? [233, 230, 223] : null;
  for (let cy = 0; cy < h; cy += cell) for (let cx = 0; cx < w; cx += cell) {
    let lr = 0, lg = 0, lb = 0, ll = 0, n = 0;
    for (let y = cy; y < cy + cell && y < h; y += 2) for (let x = cx; x < cx + cell && x < w; x += 2) {
      const i = (y * w + x) * 4; lr += s[i]; lg += s[i + 1]; lb += s[i + 2]; ll += luma(s, i); n++;
    }
    if (!n) continue;
    const l = ll / n, ch = ASCII_RAMP[Math.min(ASCII_RAMP.length - 1, Math.floor(l * ASCII_RAMP.length))];
    if (ch === " ") continue;
    if (tint) { const g = 0.5 + 0.5 * l; ctx.fillStyle = `rgb(${tint[0] * g | 0},${tint[1] * g | 0},${tint[2] * g | 0})`; }
    else ctx.fillStyle = `rgb(${(lr / n) | 0},${(lg / n) | 0},${(lb / n) | 0})`;
    ctx.fillText(ch, cx, cy);
  }
}

// CRT scanlines as a stackable pass (the engine has its own; this lets you
// stack a heavier line over any effect chain).
export function scanlines(canvas, p = {}) {
  const strength = Math.max(0, Math.min(0.9, p.strength ?? 0.4)), gap = Math.max(2, Math.round(p.gap ?? 2));
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const f = (y % gap === 0) ? (1 - strength) : (1 + strength * 0.12);
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; }
  }
  ctx.putImageData(img, 0, 0);
}

// NTSC / composite chroma bleed: smear R and B horizontally, keep luma sharp —
// the color-fringe of a VHS pause or a PS2 over composite.
export function bleed(canvas, p = {}) {
  const rad = Math.max(1, Math.round(p.radius ?? 6));
  const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h), d = img.data, win = rad * 2 + 1;
  for (let y = 0; y < h; y++) {
    let sr = 0, sb = 0; const base = y * w;
    for (let x = 0; x < Math.min(rad, w); x++) { const i = (base + x) * 4; sr += d[i]; sb += d[i + 2]; }
    for (let x = 0; x < w; x++) {
      const add = x + rad, sub = x - rad - 1;
      if (add < w) { const ia = (base + add) * 4; sr += d[ia]; sb += d[ia + 2]; }
      if (sub >= 0) { const is = (base + sub) * 4; sr -= d[is]; sb -= d[is + 2]; }
      const lo = Math.max(0, x - rad), hi = Math.min(w - 1, x + rad), cnt = hi - lo + 1, i = (base + x) * 4;
      d[i] = sr / cnt; d[i + 2] = sb / cnt;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// "Feel" modifiers — a soft/hard/angular/wavy/goopy/bubbly/sparkly/starry rack,
// each an original canvas-2D op built from a real, sourced technique (Rec.709
// bloom, unsharp mask, Voronoi crystallize, orthogonal multi-octave sine,
// iq domain warp, spherical refraction, golden-angle cross-glints, hashed star
// field) and scaled by a single `amount` in [0,1] so a whisper and a scream are
// the same control. Sources in project-docs; the transform into this idiom is ours.
// ---------------------------------------------------------------------------
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
function blurCanvas(src, px) {
  const c = scratch(src.width, src.height), x = c.getContext("2d");
  x.filter = "blur(" + px + "px)"; x.drawImage(src, 0, 0); x.filter = "none"; return c;
}
// cheap value-noise fBm for domain warping
function _h2(x, y) { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
function _vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = _h2(xi, yi), b = _h2(xi + 1, yi), c = _h2(xi, yi + 1), d = _h2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function _fbm(x, y, oct) { let s = 0, amp = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += amp * _vnoise(x * f, y * f); f *= 2; amp *= 0.5; } return s; }

// soft — Orton dreamy glow: screen-blend a gaussian-blurred copy over the base.
export function soften(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5); if (a <= 0.002) return;
  const b = blurCanvas(canvas, 2 + a * 20), ctx = canvas.getContext("2d");
  ctx.save(); ctx.globalAlpha = Math.min(1, 0.35 + a * 0.5); ctx.globalCompositeOperation = "screen";
  ctx.drawImage(b, 0, 0); ctx.restore();
}

// hard — unsharp mask: out = src + amount*(src - blur), per channel.
export function sharpen(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5); if (a <= 0.002) return;
  const strength = a * 2.4, w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
  const b = blurCanvas(canvas, 1.0 + a * 2.0).getContext("2d").getImageData(0, 0, w, h).data;
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) {
    const v = d[i + c] + strength * (d[i + c] - b[i + c]); d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  ctx.putImageData(img, 0, 0);
}

// angular — Voronoi crystallize: nearest jittered site (argmin sq-dist), flat-fill by region average.
export function crystallize(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5), rng = rngFrom(p.seed);
  const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
  const cell = Math.max(6, Math.round(8 + a * 46));
  const gx = Math.ceil(w / cell) + 1, gy = Math.ceil(h / cell) + 1, gn = gx * gy;
  const sx = new Float32Array(gn), sy = new Float32Array(gn);
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) { const k = j * gx + i; sx[k] = (i + rng()) * cell; sy[k] = (j + rng()) * cell; }
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const sr = new Float32Array(gn), sg = new Float32Array(gn), sb = new Float32Array(gn), cn = new Float32Array(gn), idx = new Int32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ci = Math.min(gx - 1, (x / cell) | 0), cj = Math.min(gy - 1, (y / cell) | 0);
    let best = -1, bd = 1e18;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ci + di, jj = cj + dj; if (ii < 0 || jj < 0 || ii >= gx || jj >= gy) continue;
      const k = jj * gx + ii, ddx = x - sx[k], ddy = y - sy[k], dd = ddx * ddx + ddy * ddy;
      if (dd < bd) { bd = dd; best = k; }
    }
    const pi = (y * w + x) * 4; idx[y * w + x] = best; sr[best] += d[pi]; sg[best] += d[pi + 1]; sb[best] += d[pi + 2]; cn[best]++;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = idx[y * w + x], c = cn[k] || 1, pi = (y * w + x) * 4; d[pi] = sr[k] / c; d[pi + 1] = sg[k] / c; d[pi + 2] = sb[k] / c; }
  ctx.putImageData(img, 0, 0);
}

// wavy — orthogonal multi-octave sine displacement (dx from y, dy from x).
export function wavy(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5); if (a <= 0.002) return;
  const t = p.phase ?? 0, w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
  const A0 = a * h * 0.06, f0 = p.freq ?? 3, TAU = 6.2831853;
  const dxY = new Float32Array(h), dyX = new Float32Array(w);
  for (let y = 0; y < h; y++) { let s = 0, A = A0, f = f0; for (let i = 0; i < 3; i++) { s += A * Math.sin(TAU * f * (y / h) + t * (0.6 + 0.2 * i)); A *= 0.5; f *= 2; } dxY[y] = s; }
  for (let x = 0; x < w; x++) { let s = 0, A = A0, f = f0; for (let i = 0; i < 3; i++) { s += A * Math.sin(TAU * f * (x / w) + t * (0.7 + 0.2 * i)); A *= 0.5; f *= 2; } dyX[x] = s; }
  const tmp = scratch(w, h); tmp.getContext("2d").drawImage(canvas, 0, 0);
  const src = tmp.getContext("2d").getImageData(0, 0, w, h).data, out = ctx.createImageData(w, h), o = out.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sxp = (x + dxY[y]) | 0, syp = (y + dyX[x]) | 0;
    sxp = sxp < 0 ? 0 : sxp >= w ? w - 1 : sxp; syp = syp < 0 ? 0 : syp >= h ? h - 1 : syp;
    const si = (syp * w + sxp) * 4, di = (y * w + x) * 4;
    o[di] = src[si]; o[di + 1] = src[si + 1]; o[di + 2] = src[si + 2]; o[di + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

// goopy — iq domain warp: sample src at uv + fbm-driven offset (coarse field, bilinear up).
export function goop(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5); if (a <= 0.002) return;
  const t = p.phase ?? 0, w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
  const amp = a * Math.min(w, h) * 0.16, scale = p.scale ?? 0.006, step = 4;
  const gw = Math.ceil(w / step) + 2, gh = Math.ceil(h / step) + 2;
  const DX = new Float32Array(gw * gh), DY = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = i * step * scale, y = j * step * scale, k = j * gw + i;
    DX[k] = amp * (_fbm(x + 1.7, y + 9.2 + t * 0.08, 4) - 0.5);
    DY[k] = amp * (_fbm(x + 8.3, y + 2.8 - t * 0.08, 4) - 0.5);
  }
  const tmp = scratch(w, h); tmp.getContext("2d").drawImage(canvas, 0, 0);
  const src = tmp.getContext("2d").getImageData(0, 0, w, h).data, out = ctx.createImageData(w, h), o = out.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gi = x / step, gj = y / step, i0 = gi | 0, j0 = gj | 0, fx = gi - i0, fy = gj - j0, k = j0 * gw + i0;
    const dx = DX[k] + (DX[k + 1] - DX[k]) * fx + (DX[k + gw] - DX[k]) * fy;
    const dy = DY[k] + (DY[k + 1] - DY[k]) * fx + (DY[k + gw] - DY[k]) * fy;
    let sxp = (x + dx) | 0, syp = (y + dy) | 0;
    sxp = sxp < 0 ? 0 : sxp >= w ? w - 1 : sxp; syp = syp < 0 ? 0 : syp >= h ? h - 1 : syp;
    const si = (syp * w + sxp) * 4, di = (y * w + x) * 4;
    o[di] = src[si]; o[di + 1] = src[si + 1]; o[di + 2] = src[si + 2]; o[di + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

// bubbly — drifting metaball bubbles, each a spherical refraction lens with a Fresnel rim.
export function bubbly(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5), rng = rngFrom(p.seed), t = p.phase ?? 0;
  const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d"), m = Math.min(w, h), N = 4 + Math.round(a * 9), ior = 1.33;
  const bx = [], by = [], br = [];
  for (let i = 0; i < N; i++) {
    const ph = rng() * 6.283, sp = 0.2 + rng() * 0.5, ax = 0.2 + rng() * 0.6, ay = 0.2 + rng() * 0.6;
    bx.push((0.5 + 0.4 * Math.sin(t * sp + ph)) * w * 0.0 + ax * w);
    by.push(ay * h + Math.sin(t * sp * 0.8 + ph) * 0.05 * h);
    bx[i] = ax * w + Math.cos(t * sp + ph) * 0.06 * w;
    br.push((0.07 + 0.13 * rng()) * m * (0.7 + a));
  }
  const tmp = scratch(w, h); tmp.getContext("2d").drawImage(canvas, 0, 0);
  const src = tmp.getContext("2d").getImageData(0, 0, w, h).data, img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = -1, bnd = 2;
    for (let i = 0; i < N; i++) { const nd = Math.hypot(x - bx[i], y - by[i]) / br[i]; if (nd < 1 && nd < bnd) { bnd = nd; best = i; } }
    const di = (y * w + x) * 4;
    if (best < 0) continue;
    const dx = x - bx[best], dy = y - by[best], nd = bnd, z = Math.sqrt(1 - nd * nd);
    const mag = 1 + (1 / ior - 1) * z;
    let sxp = (bx[best] + dx * mag) | 0, syp = (by[best] + dy * mag) | 0;
    sxp = sxp < 0 ? 0 : sxp >= w ? w - 1 : sxp; syp = syp < 0 ? 0 : syp >= h ? h - 1 : syp;
    const si = (syp * w + sxp) * 4, rim = Math.pow(nd, 3.5) * 200 * (0.4 + a);
    d[di] = Math.min(255, src[si] + rim * 0.7); d[di + 1] = Math.min(255, src[si + 1] + rim * 0.9); d[di + 2] = Math.min(255, src[si + 2] + rim);
  }
  ctx.putImageData(img, 0, 0);
}

// sparkly — cross-glints seeded on the brightest pixel of each grid cell (golden rays, additive).
export function sparkle(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5), t = p.phase ?? 0, w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
  const grid = Math.max(10, Math.round(30 - a * 16)), T = 0.6, pts = a < 0.5 ? 4 : 6;
  const data = ctx.getImageData(0, 0, w, h).data;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  for (let cy = 0; cy < h; cy += grid) for (let cx = 0; cx < w; cx += grid) {
    let bl = 0, bx = -1, by = -1;
    for (let y = cy; y < cy + grid && y < h; y += 2) for (let x = cx; x < cx + grid && x < w; x += 2) {
      const i = (y * w + x) * 4, l = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
      if (l > bl) { bl = l; bx = x; by = y; }
    }
    if (bl < T || bx < 0) continue;
    const tw = 0.55 + 0.45 * Math.sin(t * 3 + (bx + by) * 0.05), len = grid * (0.7 + a) * (0.5 + bl - T) * (0.6 + 0.4 * tw);
    if (len < 2) continue;
    for (let k = 0; k < pts; k++) {
      const ang = t * 0.3 + 6.2831853 * k / pts, ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
      const g = ctx.createLinearGradient(bx, by, ex, ey);
      g.addColorStop(0, "rgba(255,250,235," + (0.5 * tw).toFixed(3) + ")"); g.addColorStop(1, "rgba(255,250,235,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    }
  }
  ctx.restore();
}

// starry — additive procedural star field (hashed grid + radial falloff + twinkle) over the canvas.
export function starry(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5), t = p.phase ?? 0, w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
  const density = 8 + Math.round(a * 30), th = 1 - (0.28 + a * 0.5), cw = w / density, ch = h / density;
  const img = ctx.getImageData(0, 0, w, h), d = img.data, rad = Math.max(cw, ch) * 0.42;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ci = (x / cw) | 0, cj = (y / ch) | 0, b = _h2(ci, cj + 19.1);
    if (b < th) continue;
    const spx = (ci + _h2(ci, cj)) * cw, spy = (cj + _h2(ci + 7.3, cj)) * ch;
    const dist = Math.hypot(x - spx, y - spy), g = Math.max(0, 1 - dist / rad);
    if (g <= 0) continue;
    const tw = 0.55 + 0.45 * Math.sin(t * 2 + b * 25), add = Math.pow(g, 4) * (b - th) / (1 - th) * tw * 255;
    const i = (y * w + x) * 4, warm = 0.85 + 0.15 * _h2(ci + 3.1, cj + 5.7);
    d[i] = Math.min(255, d[i] + add); d[i + 1] = Math.min(255, d[i + 1] + add * warm); d[i + 2] = Math.min(255, d[i + 2] + add * (1.1 - 0.2 * warm));
  }
  ctx.putImageData(img, 0, 0);
}

// melt — columns drip downward by luminance, the wet-paint slide.
export function melt(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5); if (a <= 0.002) return;
  const rng = rngFrom(p.seed), t = p.phase ?? 0;
  const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
  const tmp = scratch(w, h); tmp.getContext("2d").drawImage(canvas, 0, 0);
  const src = tmp.getContext("2d").getImageData(0, 0, w, h).data;
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const maxDrip = a * h * 0.42;
  for (let x = 0; x < w; x++) {
    // each column drips by its own brightness plus a seeded wobble
    let acc = 0, n = 0;
    for (let y = 0; y < h; y += 6) { acc += luma(src, (y * w + x) * 4); n++; }
    const bright = acc / (n || 1);
    const drip = Math.round(maxDrip * (0.25 + bright * 0.75) * (0.55 + 0.45 * Math.sin(x * 0.07 + rng() * 6.28 + t * 0.6)));
    if (drip <= 0) continue;
    for (let y = h - 1; y >= 0; y--) {
      const sy = y - drip < 0 ? 0 : y - drip, si = (sy * w + x) * 4, di = (y * w + x) * 4;
      d[di] = src[si]; d[di + 1] = src[si + 1]; d[di + 2] = src[si + 2];
    }
  }
  ctx.putImageData(img, 0, 0);
}

// kaleido — true polar fold: N mirrored wedges around the centre.
export function kaleido(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5);
  const seg = Math.max(2, Math.round(2 + a * 10)), t = p.phase ?? 0;
  const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
  const tmp = scratch(w, h); tmp.getContext("2d").drawImage(canvas, 0, 0);
  const src = tmp.getContext("2d").getImageData(0, 0, w, h).data;
  const out = ctx.createImageData(w, h), o = out.data;
  const cx = w / 2, cy = h / 2, wedge = Math.PI * 2 / seg, spin = t * 0.15;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
    let ang = Math.atan2(dy, dx) + spin;
    ang = ((ang % wedge) + wedge) % wedge;          // fold into one wedge
    if (ang > wedge / 2) ang = wedge - ang;          // mirror it
    let sx = Math.round(cx + Math.cos(ang) * r), sy = Math.round(cy + Math.sin(ang) * r);
    sx = sx < 0 ? 0 : sx >= w ? w - 1 : sx; sy = sy < 0 ? 0 : sy >= h ? h - 1 : sy;
    const si = (sy * w + sx) * 4, di = (y * w + x) * 4;
    o[di] = src[si]; o[di + 1] = src[si + 1]; o[di + 2] = src[si + 2]; o[di + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

// prism — radial chromatic dispersion: channels split along the radius.
export function prism(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5); if (a <= 0.002) return;
  const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, w, h), s = img.data, out = ctx.createImageData(w, h), o = out.data;
  const cx = w / 2, cy = h / 2, k = a * 0.09;
  const px = (x, y, c) => { const xi = x < 0 ? 0 : x >= w ? w - 1 : x | 0, yi = y < 0 ? 0 : y >= h ? h - 1 : y | 0; return s[(yi * w + xi) * 4 + c]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - cx, dy = y - cy, di = (y * w + x) * 4;
    o[di] = px(cx + dx * (1 + k), cy + dy * (1 + k), 0);
    o[di + 1] = s[di + 1];
    o[di + 2] = px(cx + dx * (1 - k), cy + dy * (1 - k), 2);
    o[di + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
}

// neon — Sobel edges, colourised and added back as glowing wire.
export function neon(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5); if (a <= 0.002) return;
  const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const L = new Float32Array(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) L[j] = luma(d, i);
  const edge = new Float32Array(w * h);
  let peak = 0.0001;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = -L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1] + L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1];
    const gy = -L[i - w - 1] - 2 * L[i - w] - L[i - w + 1] + L[i + w - 1] + 2 * L[i + w] + L[i + w + 1];
    const g = Math.sqrt(gx * gx + gy * gy); edge[i] = g; if (g > peak) peak = g;
  }
  const gain = a * 2.1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, e = Math.pow(edge[i] / peak, 0.75) * gain, k = i * 4;
    if (e <= 0.002) continue;
    d[k] = Math.min(255, d[k] * (1 - a * 0.35) + e * 255 * 1.0);
    d[k + 1] = Math.min(255, d[k + 1] * (1 - a * 0.35) + e * 255 * 0.35);
    d[k + 2] = Math.min(255, d[k + 2] * (1 - a * 0.35) + e * 255 * 0.9);
  }
  ctx.putImageData(img, 0, 0);
}

// mosaic — set the picture in tesserae. Built the way a mosaicist works rather
// than as a pixel grid: tiles are irregular and jittered, separated by real
// grout, each tile carries one averaged colour with its own tone variation, and
// each is bedded at its own slight angle so a raking light glints across the
// field tile by tile (the Byzantine gold-ground trick). Modes: stone (matte
// smalti), gold (gold-leaf ground with travelling glint), glass (translucent,
// brighter grout), trencadis (Gaudi: bigger irregular shards, wide grout).
export function mosaic(canvas, p = {}) {
  const a = clamp01(p.amount ?? 0.5);
  const mode = p.mode || "stone";
  const rng = rngFrom(p.seed), t = p.phase ?? 0;
  const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
  const shard = mode === "trencadis";
  // tile pitch: bigger amount = bigger, bolder tesserae
  const cell = Math.max(5, Math.round((shard ? 14 : 7) + a * (shard ? 54 : 34)));
  const jit = shard ? 0.46 : 0.24;                 // how far a seed strays from its grid slot
  const grout = (p.grout ?? (shard ? 0.34 : 0.20)) * (0.6 + a * 0.7);

  const gx = Math.ceil(w / cell) + 2, gy = Math.ceil(h / cell) + 2, gn = gx * gy;
  const sx = new Float32Array(gn), sy = new Float32Array(gn), ang = new Float32Array(gn), ton = new Float32Array(gn);
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    const k = j * gx + i;
    sx[k] = (i - 0.5 + 0.5 + (rng() - 0.5) * 2 * jit) * cell;
    sy[k] = (j - 0.5 + 0.5 + (rng() - 0.5) * 2 * jit) * cell;
    ang[k] = rng() * 6.2831853;                    // the angle this tile is bedded at
    ton[k] = 0.82 + rng() * 0.36;                  // tile-to-tile tone variation
  }

  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const sr = new Float32Array(gn), sg = new Float32Array(gn), sb = new Float32Array(gn), cn = new Float32Array(gn);
  const idx = new Int32Array(w * h), edge = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ci = Math.min(gx - 1, ((x / cell) | 0) + 1), cj = Math.min(gy - 1, ((y / cell) | 0) + 1);
    let b1 = -1, d1 = 1e18, d2 = 1e18;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ci + di, jj = cj + dj; if (ii < 0 || jj < 0 || ii >= gx || jj >= gy) continue;
      const k = jj * gx + ii, ddx = x - sx[k], ddy = y - sy[k], dd = ddx * ddx + ddy * ddy;
      if (dd < d1) { d2 = d1; d1 = dd; b1 = k; } else if (dd < d2) { d2 = dd; }
    }
    if (b1 < 0) continue;
    const q = y * w + x, pi = q * 4;
    idx[q] = b1;
    // distance to the tile boundary: the classic (d2 - d1) Voronoi edge measure
    edge[q] = (Math.sqrt(d2) - Math.sqrt(d1)) * 0.5;
    sr[b1] += d[pi]; sg[b1] += d[pi + 1]; sb[b1] += d[pi + 2]; cn[b1]++;
  }

  const lx = p.lightX == null ? 0.5 : p.lightX, ly = p.lightY == null ? 0.35 : p.lightY;
  const lightAng = Math.atan2(ly - 0.5, lx - 0.5) + t * 0.25;
  const sharp = 2.0 + (p.glint ?? 0.5) * 10;
  const groutPx = Math.max(0.6, grout * cell * 0.5);
  const gr = shard ? 22 : 12, gg = shard ? 20 : 11, gb = shard ? 24 : 13;   // grout colour

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const q = y * w + x, k = idx[q], c = cn[k] || 1, pi = q * 4;
    let r = sr[k] / c, g = sg[k] / c, b = sb[k] / c;
    r *= ton[k]; g *= ton[k]; b *= ton[k];
    if (mode === "gold") {
      // gold leaf: push the tile toward gold, then let its bedding angle catch the light
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      r = 255 * (0.20 + lum * 0.86); g = 255 * (0.13 + lum * 0.66); b = 255 * (0.03 + lum * 0.22);
      const glint = Math.pow(Math.max(0, 0.5 + 0.5 * Math.cos(ang[k] - lightAng)), sharp);
      r = Math.min(255, r + glint * 205); g = Math.min(255, g + glint * 180); b = Math.min(255, b + glint * 110);
    } else if (mode === "glass") {
      const glint = Math.pow(Math.max(0, 0.5 + 0.5 * Math.cos(ang[k] - lightAng)), sharp * 1.4);
      r = Math.min(255, r * 1.06 + glint * 120); g = Math.min(255, g * 1.06 + glint * 130); b = Math.min(255, b * 1.06 + glint * 150);
    }
    // grout: fade the tile out toward its boundary onto the bedding mortar
    const e = edge[q] < groutPx ? edge[q] / groutPx : 1;
    const m = e * e * (3 - 2 * e);                    // smoothstep
    d[pi] = gr + (r - gr) * m; d[pi + 1] = gg + (g - gg) * m; d[pi + 2] = gb + (b - gb) * m;
  }
  ctx.putImageData(img, 0, 0);
}

// Datamosh, after entro_play's WebGL datamoshing and FFglitch practice: the
// previous frame smeared along a procedural block motion field, refreshed in
// periodic bands like sparse I-frames. The caller maintains step.prev as a
// snapshot of the LAST composed frame, so the smear feeds on its own output.
function datamosh(canvas, step) {
  const prev = step.prev;
  if (!prev || !prev.width) return;
  const g = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const amt = step.amount === undefined ? 0.6 : step.amount;
  const rng = rngFrom((step.seed || "mosh") + "|field");
  const bs = Math.max(12, Math.round(Math.min(W, H) / 22));
  const t = step.phase || 0;
  // refresh band: a strip of honest current frame sweeps through, everything
  // else re-projects the stale frame with per-block drift
  const bandY = ((t * 0.13) % 1) * H;
  const bandH = H * (0.10 + 0.25 * (1 - amt));
  for (let y = 0; y < H; y += bs) {
    const inBand = y + bs > bandY && y < bandY + bandH;
    if (inBand) continue;
    for (let x = 0; x < W; x += bs) {
      const n1 = rng(), n2 = rng();
      const swirl = Math.sin((x / W) * 5.1 + t * 0.7 + n1 * 6.28) + Math.cos((y / H) * 4.3 - t * 0.5 + n2 * 6.28);
      const mag = amt * (4 + 22 * Math.abs(swirl) * 0.5);
      const vx = Math.round(Math.cos(n1 * 6.28 + swirl) * mag);
      const vy = Math.round(Math.sin(n2 * 6.28 - swirl) * mag);
      const sx = Math.max(0, Math.min(prev.width - bs, x + vx));
      const sy = Math.max(0, Math.min(prev.height - bs, y + vy));
      g.drawImage(prev, sx, sy, bs, bs, x, y, bs, bs);
    }
  }
}

// Slit scan, after the Kinect slit-scan lineage: each horizontal strip of the
// output samples a different moment from a short ring of past frames, so
// motion shears into time. The caller maintains the ring at half resolution.
function slitscan(canvas, step) {
  const ring = step.ring, len = step.len || 0, head = step.head || 0;
  if (!ring || !len) return;
  const g = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const amt = step.amount === undefined ? 0.6 : step.amount;
  const strips = 48;
  const sh = Math.ceil(H / strips);
  const col = step.axis === "col";
  const n = col ? Math.ceil(W / sh) : strips;
  for (let i = 0; i < n; i++) {
    const frac = i / n;
    const wobble = 0.5 + 0.5 * Math.sin(frac * 6.28 * 2 + (step.phase || 0) * 0.6);
    const age = Math.min(len - 1, Math.floor(frac * wobble * amt * (len - 1)));
    const src = ring[(head - age + len * 4) % len];
    if (!src || !src.width) continue;
    if (col) {
      const x = i * sh, sxs = Math.floor((x / W) * src.width), sws = Math.max(1, Math.floor((sh / W) * src.width));
      g.drawImage(src, sxs, 0, sws, src.height, x, 0, sh, H);
    } else {
      const y = i * sh, sys = Math.floor((y / H) * src.height), shs = Math.max(1, Math.floor((sh / H) * src.height));
      g.drawImage(src, 0, sys, src.width, shs, 0, y, W, sh);
    }
  }
}

export const OPS = {
  ...OPS_CHEM, ...OPS_OPT, ...OPS_TIME,
  soften, sharpen, crystallize, wavy, goop, bubbly, sparkle, starry, melt, kaleido, prism, neon, mosaic,
  dither, halftone, posterize, pixelSort, databend, rgbShift, slice, wave, echo, mirror, ascii, bleed, scanlines, invert,
  datamosh, slitscan,
};

// Metadata for the effects rack UI. Array order IS the apply pipeline
// (restructure -> warp -> tone -> glitch -> screen -> light overlays); the UI
// groups the chips into shelves by `cat`, independent of this order.
export const OP_META = [
  { op: "mosaic", label: "Mosaic", cat: "feel" },
  { op: "crystallize", label: "Angular", cat: "feel" },
  { op: "kaleido", label: "Kaleido", cat: "feel" },
  { op: "wavy", label: "Wavy", cat: "feel" },
  { op: "goop", label: "Goopy", cat: "feel" },
  { op: "melt", label: "Melty", cat: "feel" },
  { op: "bubbly", label: "Bubbly", cat: "feel" },
  { op: "soften", label: "Soft", cat: "feel" },
  { op: "sharpen", label: "Hard", cat: "feel" },
  { op: "neon", label: "Neon", cat: "feel" },
  { op: "prism", label: "Prism", cat: "feel" },
  { op: "dither", label: "Dither", cat: "tone" },
  { op: "halftone", label: "Halftone", cat: "tone" },
  { op: "posterize", label: "Posterize", cat: "tone" },
  { op: "invert", label: "Invert", cat: "tone" },
  { op: "pixelSort", label: "Pixel sort", cat: "glitch" },
  { op: "databend", label: "Databend", cat: "glitch" },
  { op: "rgbShift", label: "RGB shift", cat: "glitch" },
  { op: "slice", label: "Slice", cat: "glitch" },
  { op: "wave", label: "Wave", cat: "glitch" },
  { op: "datamosh", label: "Datamosh", cat: "glitch" },
  { op: "slitscan", label: "Slit scan", cat: "glitch" },
  { op: "echo", label: "Echo", cat: "glitch" },
  { op: "mirror", label: "Mirror", cat: "glitch" },
  { op: "bleed", label: "Bleed", cat: "tone" },
  { op: "scanlines", label: "Scanlines", cat: "tone" },
  { op: "sparkle", label: "Sparkly", cat: "feel" },
  { op: "starry", label: "Starry", cat: "feel" },
  ...META_CHEM, ...META_OPT, ...META_TIME,
];

// Apply an ordered list of { op, ...params } steps to a canvas, in place.
export function applyOps(canvas, list) {
  for (const step of list || []) { const fn = OPS[step.op]; if (fn) { try { fn(canvas, step); } catch (_) {} } }
}
