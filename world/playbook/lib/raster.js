// lib/raster.js: a small software rasteriser on Float32 premultiplied RGBA, for deterministic CPU renders.
// Every build has a CPU reference path through this file, so node tests can render, hash and SSIM-compare
// the real picture (QUALITY-SPEC S3, S5). Edges are anti-aliased by exact coverage (discs, capsules) or
// 4 x 4 supersampling (polygons), so a 1 px edge ramps over about 1 px (R3). Output adds TPDF dither (R2).
import { clamp, hexToRgb, rng } from './util.js';

export function image(w, h) { return { w: w | 0, h: h | 0, data: new Float32Array((w | 0) * (h | 0) * 4) }; }

const rgbOf = (c) => (typeof c === 'string' ? hexToRgb(c) : c);

function put(im, i, rgb, a, mode) {
  const d = im.data, k = i * 4;
  if (mode === 'add') { d[k] += rgb[0] * a; d[k + 1] += rgb[1] * a; d[k + 2] += rgb[2] * a; d[k + 3] = Math.min(1, d[k + 3] + a); return; }
  if (mode === 'multiply') { const m = 1 - a; d[k] *= m + a * rgb[0]; d[k + 1] *= m + a * rgb[1]; d[k + 2] *= m + a * rgb[2]; return; }
  const m = 1 - a; d[k] = d[k] * m + rgb[0] * a; d[k + 1] = d[k + 1] * m + rgb[1] * a; d[k + 2] = d[k + 2] * m + rgb[2] * a; d[k + 3] = d[k + 3] * m + a;
}

export function fill(im, color, a = 1) { const c = rgbOf(color); for (let i = 0; i < im.w * im.h; i++) put(im, i, c, a, 'over'); return im; }

export function rect(im, x0, y0, x1, y1, color, a = 1, mode = 'over') {
  const c = rgbOf(color), X0 = Math.max(0, Math.floor(x0)), Y0 = Math.max(0, Math.floor(y0)), X1 = Math.min(im.w, Math.ceil(x1)), Y1 = Math.min(im.h, Math.ceil(y1));
  for (let y = Y0; y < Y1; y++) {
    const cy = clamp(Math.min(y + 1, y1) - Math.max(y, y0));
    for (let x = X0; x < X1; x++) { const cov = cy * clamp(Math.min(x + 1, x1) - Math.max(x, x0)); if (cov > 0) put(im, y * im.w + x, c, a * cov, mode); }
  }
  return im;
}

// Anti-aliased disc: coverage from the signed distance at the pixel centre, ramped over 1 px.
export function disc(im, cx, cy, r, color, a = 1, mode = 'over') {
  const c = rgbOf(color), R = r + 1, X0 = Math.max(0, Math.floor(cx - R)), Y0 = Math.max(0, Math.floor(cy - R)), X1 = Math.min(im.w - 1, Math.ceil(cx + R)), Y1 = Math.min(im.h - 1, Math.ceil(cy + R));
  if (r < 0.5) { // a sub-pixel dot keeps 1 px of footprint with alpha scaled by area (R3b)
    const ix = Math.round(cx - 0.5), iy = Math.round(cy - 0.5);
    if (ix >= 0 && iy >= 0 && ix < im.w && iy < im.h) put(im, iy * im.w + ix, c, a * Math.min(1, Math.PI * r * r), mode);
    return im;
  }
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    const cov = clamp(r + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
    if (cov > 0) put(im, y * im.w + x, c, a * cov, mode);
  }
  return im;
}

// Anti-aliased capsule (a line with round caps) of half width hw. Hairlines under 0.5 px keep 1 px at reduced alpha.
export function line(im, x0, y0, x1, y1, hw, color, a = 1, mode = 'over') {
  const c = rgbOf(color), eff = Math.max(0.5, hw), alpha = a * Math.min(1, hw / 0.5), R = eff + 1;
  const X0 = Math.max(0, Math.floor(Math.min(x0, x1) - R)), Y0 = Math.max(0, Math.floor(Math.min(y0, y1) - R)), X1 = Math.min(im.w - 1, Math.ceil(Math.max(x0, x1) + R)), Y1 = Math.min(im.h - 1, Math.ceil(Math.max(y0, y1) + R));
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    const px = x + 0.5 - x0, py = y + 0.5 - y0, t = clamp((px * dx + py * dy) / L2), d = Math.hypot(px - dx * t, py - dy * t);
    const cov = clamp(eff + 0.5 - d);
    if (cov > 0) put(im, y * im.w + x, c, alpha * cov, mode);
  }
  return im;
}

export function polyline(im, pts, hw, color, a = 1, closed = false) {
  for (let i = 2; i < pts.length; i += 2) line(im, pts[i - 2], pts[i - 1], pts[i], pts[i + 1], hw, color, a);
  if (closed && pts.length > 4) line(im, pts[pts.length - 2], pts[pts.length - 1], pts[0], pts[1], hw, color, a);
  return im;
}

const inside = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) { const yi = pts[i + 1], yj = pts[j + 1]; if ((yi > y) !== (yj > y) && x < ((pts[j] - pts[i]) * (y - yi)) / (yj - yi) + pts[i]) c = !c; } return c; };

// Filled polygon (even-odd), 4 x 4 supersampled coverage.
export function polygon(im, pts, color, a = 1, mode = 'over') {
  const c = rgbOf(color); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
  const X0 = Math.max(0, Math.floor(x0)), Y0 = Math.max(0, Math.floor(y0)), X1 = Math.min(im.w - 1, Math.ceil(x1)), Y1 = Math.min(im.h - 1, Math.ceil(y1));
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    let n = 0; for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside(pts, x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) n++;
    if (n) put(im, y * im.w + x, c, (a * n) / 16, mode);
  }
  return im;
}

// Draw another image (same size or smaller) at an integer offset with an alpha.
export function blit(dst, src, ox = 0, oy = 0, a = 1) {
  for (let y = 0; y < src.h; y++) { const Y = y + oy; if (Y < 0 || Y >= dst.h) continue;
    for (let x = 0; x < src.w; x++) { const X = x + ox; if (X < 0 || X >= dst.w) continue;
      const s = (y * src.w + x) * 4, d = (Y * dst.w + X) * 4, sa = src.data[s + 3] * a; if (sa <= 0) continue;
      for (let k = 0; k < 3; k++) dst.data[d + k] = dst.data[d + k] * (1 - sa) + src.data[s + k] * a; dst.data[d + 3] = dst.data[d + 3] * (1 - sa) + sa; } }
  return dst;
}

// Clumped monochrome grain (R4): white noise box-blurred to a correlation width near 2.3 px, then scaled to sd code values.
export function grain(im, { sd = 1.6, seed = 7, clump = 1 } = {}) {
  const { w, h } = im, r = rng(seed), n = new Float32Array(w * h), t = new Float32Array(w * h);
  for (let i = 0; i < n.length; i++) n[i] = r() + r() - 1;
  const box = (src, dst, dx, dy) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, c = 0; for (let k = -clump; k <= clump; k++) { const X = x + dx * k, Y = y + dy * k; if (X >= 0 && Y >= 0 && X < w && Y < h) { s += src[Y * w + X]; c++; } } dst[y * w + x] = s / c; } };
  box(n, t, 1, 0); box(t, n, 0, 1);
  let v = 0; for (let i = 0; i < n.length; i++) v += n[i] * n[i]; const k = (sd / 255) / Math.sqrt(v / n.length || 1);
  for (let i = 0; i < n.length; i++) for (let c = 0; c < 3; c++) im.data[i * 4 + c] += n[i] * k;
  return im;
}

// 8-bit RGBA with TPDF dither of 1 code value peak (R2). Opaque output: alpha forced to 255 unless keepAlpha.
export function toRGBA8(im, { seed = 3, dither = true, keepAlpha = false } = {}) {
  const out = new Uint8ClampedArray(im.w * im.h * 4), r = rng(seed);
  for (let i = 0; i < im.w * im.h; i++) for (let c = 0; c < 4; c++) {
    const v = im.data[i * 4 + c];
    if (c === 3) { out[i * 4 + 3] = keepAlpha ? Math.round(clamp(v) * 255) : 255; continue; }
    out[i * 4 + c] = Math.round(clamp(v) * 255 + (dither ? r() - r() : 0));
  }
  return out;
}

// Put a Float32 image on a 2D canvas (browser).
export function toCanvas(im, canvas, opts) {
  const x = canvas.getContext('2d'); canvas.width = im.w; canvas.height = im.h;
  x.putImageData(new ImageData(toRGBA8(im, opts), im.w, im.h), 0, 0); return canvas;
}
