/* retro-engine.js — a live, in-browser retro / pixel-art renderer, upgraded.

   A faithful, extended port of coherence-membrane's retro.py vintage-CGI
   pipeline, run live on a canvas:

     source -> OKLab field -> box-downscale (pixelate) -> palette
     (named hardware, ZentropyLabs custom, or auto-extracted from the image)
     -> ordered Bayer dither (2/4/8) -> optional SDF depth-shade
     -> nearest-neighbor upscale -> CRT stage (curvature, scanlines, bloom,
     vignette).

   Every material composes: `src` can be an <img>, an upload, a Studio source
   canvas, or a generative plate, and `applyChain` layers the engine with any
   Studio effect in either order. Palettes and the OKLab/dither/scanline math
   come from retro.py, so a browser render and an offline retro.py render read
   as one instrument. Zero dependencies. */

import {
  srgbToOklab, oklabToSrgb, labPalette, nearestIndex, medianCut, RETRO_PALETTES,
} from "./retro-palettes.js";

export { RETRO_PALETTES, paletteNames } from "./retro-palettes.js";

const BAYER = {
  2: [[0, 2], [3, 1]],
  4: [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]],
  8: [[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]],
};
const BAYER_MAX = { 2: 4, 4: 16, 8: 64 };

function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
function srcDims(s) {
  return [s.naturalWidth || s.videoWidth || s.width, s.naturalHeight || s.videoHeight || s.height];
}

// Two-pass chamfer distance from the occupancy boundary, signed inside(+)/outside(-),
// normalized to [-1, 1]. Drives retro.py's relative-depth "early 3D" shade.
function signedDistance(occ, w, h) {
  const BIG = 1e9;
  const din = new Float64Array(w * h).fill(BIG); // distance to nearest OFF, for ON cells
  const dout = new Float64Array(w * h).fill(BIG); // distance to nearest ON, for OFF cells
  const seed = (field, isSeed) => {
    for (let i = 0; i < w * h; i++) if (isSeed(i)) field[i] = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x > 0) field[i] = Math.min(field[i], field[i - 1] + 1);
      if (y > 0) field[i] = Math.min(field[i], field[i - w] + 1);
      if (x > 0 && y > 0) field[i] = Math.min(field[i], field[i - w - 1] + 1.4142);
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (x < w - 1) field[i] = Math.min(field[i], field[i + 1] + 1);
      if (y < h - 1) field[i] = Math.min(field[i], field[i + w] + 1);
      if (x < w - 1 && y < h - 1) field[i] = Math.min(field[i], field[i + w + 1] + 1.4142);
    }
  };
  seed(din, (i) => !occ[i]);
  seed(dout, (i) => occ[i]);
  const out = new Float64Array(w * h);
  let mx = 1e-6;
  for (let i = 0; i < w * h; i++) { out[i] = occ[i] ? din[i] : -dout[i]; mx = Math.max(mx, Math.abs(out[i])); }
  for (let i = 0; i < w * h; i++) out[i] /= mx;
  return out;
}

// The CRT stage: barrel curvature, then scanlines + bloom + vignette on tone.
function crtStage(ctx, w, h, o) {
  let img = ctx.getImageData(0, 0, w, h);
  let d = img.data;

  if (o.curvature > 0) {
    const src = new Uint8ClampedArray(d);
    const k = o.curvature * 0.35;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = (x / (w - 1)) * 2 - 1, v = (y / (h - 1)) * 2 - 1;
      const r2 = u * u + v * v, f = 1 + k * r2;
      const su = u * f, sv = v * f, i = (y * w + x) * 4;
      if (su < -1 || su > 1 || sv < -1 || sv > 1) { d[i] = d[i + 1] = d[i + 2] = 0; continue; }
      const sx = Math.round(((su + 1) / 2) * (w - 1)), sy = Math.round(((sv + 1) / 2) * (h - 1));
      const j = (sy * w + sx) * 4;
      d[i] = src[j]; d[i + 1] = src[j + 1]; d[i + 2] = src[j + 2];
    }
  }

  if (o.bloom > 0) {
    const th = 150, bl = new Float64Array(w * h * 3), tmp = new Float64Array(w * h * 3), R = 2;
    for (let p = 0; p < w * h; p++) {
      const i = p * 4, lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
      const g = lum > th ? (lum - th) / (255 - th) : 0;
      bl[p * 3] = d[i] * g; bl[p * 3 + 1] = d[i + 1] * g; bl[p * 3 + 2] = d[i + 2] * g;
    }
    const blur = (a, b, horiz) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let s0 = 0, s1 = 0, s2 = 0, n = 0;
        for (let t = -R; t <= R; t++) {
          const xx = horiz ? x + t : x, yy = horiz ? y : y + t;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const q = (yy * w + xx) * 3; s0 += a[q]; s1 += a[q + 1]; s2 += a[q + 2]; n++;
        }
        const p = (y * w + x) * 3; b[p] = s0 / n; b[p + 1] = s1 / n; b[p + 2] = s2 / n;
      }
    };
    blur(bl, tmp, true); blur(tmp, bl, false);
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      d[i] = Math.min(255, d[i] + bl[p * 3] * o.bloom);
      d[i + 1] = Math.min(255, d[i + 1] + bl[p * 3 + 1] * o.bloom);
      d[i + 2] = Math.min(255, d[i + 2] + bl[p * 3 + 2] * o.bloom);
    }
  }

  if (o.scanlines || o.vignette > 0) {
    const dark = 1 - clamp(o.scanStrength, 0, 1);   // even-row factor, retro.py law at strength 0.35 -> 0.65
    const cx = (w - 1) / 2, cy = (h - 1) / 2, maxr = Math.hypot(cx, cy);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let f = 1;
      if (o.scanlines) f *= (y & 1) === 0 ? dark : 1.1;
      if (o.vignette > 0) { const r = Math.hypot(x - cx, y - cy) / maxr; f *= 1 - o.vignette * r * r; }
      d[i] = Math.min(255, d[i] * f); d[i + 1] = Math.min(255, d[i + 1] * f); d[i + 2] = Math.min(255, d[i + 2] * f);
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* renderRetro(src, dst, opts) -> { w, h, palette, cells, colors }
   opts: palette ('gameboy'|...|'auto'), autoK, targetWidth, dither
   ('none'|'bayer2'|'bayer4'|'bayer8'), ditherAmp, gamma, brightness, sdfShade,
   scanlines, scanStrength, bloom, curvature, vignette, upscale. */
export function renderRetro(src, dst, opts = {}) {
  const o = {
    palette: "gameboy", autoK: 8, targetWidth: 128, dither: "bayer4", ditherAmp: 0.09,
    gamma: 1, brightness: 0, sdfShade: false, scanlines: true, scanStrength: 0.35,
    bloom: 0, curvature: 0, vignette: 0, upscale: 4, ...opts,
  };
  const [sw, sh] = srcDims(src);
  if (!sw || !sh) return { w: 0, h: 0, palette: o.palette, cells: 0, colors: 0 };
  const tw = Math.max(2, Math.min(o.targetWidth, sw));
  const th = Math.max(2, Math.round(tw * sh / sw));

  const small = document.createElement("canvas");
  small.width = tw; small.height = th;
  const sctx = small.getContext("2d");
  sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = "high";
  sctx.drawImage(src, 0, 0, tw, th);
  const img = sctx.getImageData(0, 0, tw, th), d = img.data;

  // sRGB -> OKLab, with gamma + brightness pre-adjust on L.
  const lab = new Array(tw * th);
  for (let p = 0; p < tw * th; p++) {
    const i = p * 4;
    let [L, a, b] = srgbToOklab(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
    if (o.gamma !== 1) L = Math.pow(clamp(L, 0, 1), 1 / o.gamma);
    L = clamp(L + o.brightness, 0, 1);
    lab[p] = [L, a, b];
  }

  const pal = o.palette === "auto" ? medianCut(lab, o.autoK) : labPalette(o.palette);
  const N = o.dither === "none" ? 0 : o.dither === "bayer2" ? 2 : o.dither === "bayer8" ? 8 : 4;
  const outLab = new Array(tw * th);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const p = y * tw + x; let [L, a, b] = lab[p];
    if (N) { const t = (BAYER[N][y % N][x % N] + 0.5) / BAYER_MAX[N] - 0.5; L += t * o.ditherAmp; }
    outLab[p] = pal[nearestIndex(L, a, b, pal)].lab;
  }

  if (o.sdfShade) {
    const occ = new Uint8Array(tw * th);
    for (let p = 0; p < tw * th; p++) occ[p] = lab[p][0] > 0.5 ? 1 : 0;
    const sdf = signedDistance(occ, tw, th);
    for (let p = 0; p < tw * th; p++) {
      const f = clamp(1 + 0.3 * sdf[p], 0.5, 1.3), L = outLab[p];
      outLab[p] = [clamp(L[0] * f, 0, 1), L[1], L[2]];
    }
  }

  for (let p = 0; p < tw * th; p++) {
    const i = p * 4, [r, g, b] = oklabToSrgb(outLab[p][0], outLab[p][1], outLab[p][2]);
    d[i] = Math.round(r * 255); d[i + 1] = Math.round(g * 255); d[i + 2] = Math.round(b * 255); d[i + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);

  const up = Math.max(1, Math.floor(o.upscale)), dw = tw * up, dh = th * up;
  dst.width = dw; dst.height = dh;
  const dctx = dst.getContext("2d");
  dctx.imageSmoothingEnabled = false;
  dctx.drawImage(small, 0, 0, dw, dh);
  if (o.scanlines || o.bloom > 0 || o.curvature > 0 || o.vignette > 0) crtStage(dctx, dw, dh, o);

  // The resolved palette itself, not just its name and count. "Auto (from
  // image)" median-cuts a palette out of the picture and the caller could never
  // see which colours it chose, let alone keep them.
  const entries = pal.map((e) => {
    const [r, g, b] = oklabToSrgb(e.lab[0], e.lab[1], e.lab[2]);
    const hx = (v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, "0");
    return "#" + hx(r) + hx(g) + hx(b);
  });
  return { w: dw, h: dh, palette: o.palette, cells: tw * th, colors: pal.length, entries };
}

/* applyChain(source, dst, steps) -> dst
   Layer the engine with any Studio effect, in either order. Each step is a
   function (inCanvas, outCanvas) => void, or { op:'retro', opts }. The output
   of one step feeds the next, so engine -> studio-effect -> engine composes. */
export function applyChain(source, dst, steps) {
  let cur = source;
  const scratch = () => document.createElement("canvas");
  for (let s = 0; s < steps.length; s++) {
    const step = steps[s];
    const out = s === steps.length - 1 ? dst : scratch();
    if (step && step.op === "retro") {
      renderRetro(cur, out, step.opts || {});
    } else if (typeof step === "function") {
      step(cur, out);
    }
    cur = out;
  }
  return dst;
}
