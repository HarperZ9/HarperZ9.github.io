// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// substrate/raster: the raster floor every canvas piece stands on (QUALITY-SPEC.md R1, R2, R4, R5).
//
//   grainField(w, h, opts)         Float32Array of clumped grain plus TPDF dither, in code values. Pure.
//   grainTile(opts)                a canvas tile of that field lifted by a bias, for 'lighter' compositing.
//   applyGrain(ctx, w, h, tile)    add the tile over a region and take the bias back out ('difference').
//   context2d(canvas, opts)        a 2D context in Display P3 where the browser supports the option, else sRGB.
//   fitCanvas(canvas, opts)        size the backing store to CSS size x devicePixelRatio (capped), report change.
//
// Parameters and units:
//   sd      grain SD in 8-bit code values, 0 to 6 (references: 0.3 to 0.9 after compression; 6 is heavy)
//   clump   grain cell in px, 1 to 4 (2 gives the measured 2 to 3 px correlation width)
//   dither  TPDF peak in code values, 0 to 2 (1 removes banding on 8-bit ramps)
//   seed    integer; the same seed gives the same field, byte for byte
//   size    tile side in px, 64 to 512
//   maxDpr  1 to 3; maxPx  backing-store cap per side in device px
// Performance: grainTile(256) costs about 3 ms once; applyGrain is two fills, under 1 ms at 2880 x 1800.

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export function grainField(w, h, { sd = 1.2, clump = 2, dither = 1, seed = 11 } = {}) {
  if (!(w > 0 && h > 0)) throw new RangeError("raster: grainField needs a positive size");
  if (!(sd >= 0 && sd <= 12)) throw new RangeError("raster: sd must be 0 to 12 code values");
  if (!(clump >= 1 && clump <= 8)) throw new RangeError("raster: clump must be 1 to 8 px");
  const r = rng(seed), gw = Math.ceil(w / clump) + 2, gh = Math.ceil(h / clump) + 2, g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) { const u = r() || 1e-9, v = r(); g[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v); }
  // bilinear smoothing lowers the SD; measure it and rescale so sd is what comes out
  const out = new Float32Array(w * h);
  let s = 0, s2 = 0;
  for (let y = 0; y < h; y++) {
    const fy = y / clump, iy = fy | 0, ty = fy - iy;
    for (let x = 0; x < w; x++) {
      const fx = x / clump, ix = fx | 0, tx = fx - ix, o = iy * gw + ix;
      const n = (g[o] * (1 - tx) + g[o + 1] * tx) * (1 - ty) + (g[o + gw] * (1 - tx) + g[o + gw + 1] * tx) * ty;
      out[y * w + x] = n; s += n; s2 += n * n;
    }
  }
  const N = w * h, mean = s / N, scale = sd / Math.sqrt(Math.max(1e-12, s2 / N - mean * mean));
  for (let i = 0; i < N; i++) out[i] = (out[i] - mean) * scale + (r() - r()) * dither;
  return out;
}

export function grainTile({ size = 256, bias, ...opts } = {}) {
  const f = grainField(size, size, opts), b = bias ?? Math.ceil(3 * (opts.sd ?? 1.2) + (opts.dither ?? 1));
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size, size) : Object.assign(document.createElement("canvas"), { width: size, height: size });
  const x = c.getContext("2d"), img = x.createImageData(size, size), d = img.data;
  for (let i = 0; i < f.length; i++) { const v = Math.max(0, Math.min(255, Math.round(b + f[i]))); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  c.bias = b;
  return c;
}

export function applyGrain(ctx, w, h, tile) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = ctx.createPattern(tile, "repeat");
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "difference";  // |c - bias|: takes the lift back out wherever c >= bias
  ctx.fillStyle = `rgb(${tile.bias},${tile.bias},${tile.bias})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function context2d(canvas, opts = {}) {
  try {
    const c = canvas.getContext("2d", { colorSpace: "display-p3", ...opts });
    if (c) return c;
  } catch (e) {
    console.warn("raster: display-p3 2D context unavailable, using sRGB", e);
  }
  return canvas.getContext("2d", opts);
}

export function fitCanvas(canvas, { maxDpr = 2.5, maxPx = 2600, cssWidth, cssHeight } = {}) {
  const dpr = Math.min(globalThis.devicePixelRatio || 1, maxDpr);
  const cw = cssWidth ?? canvas.clientWidth, ch = cssHeight ?? canvas.clientHeight;
  const w = Math.max(1, Math.min(maxPx, Math.round(cw * dpr))), h = Math.max(1, Math.min(maxPx, Math.round(ch * dpr)));
  if (canvas.width === w && canvas.height === h) return { changed: false, dpr: w / Math.max(1, cw) };
  canvas.width = w; canvas.height = h;
  return { changed: true, dpr: w / Math.max(1, cw) };
}
