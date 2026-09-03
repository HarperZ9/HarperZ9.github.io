/* retro-engine.js: a live, in-browser retro / pixel-art renderer.

   A port of the coherence-membrane retro.py vintage-CGI pipeline, run live
   on a canvas and extended at the two stages a tube would add:

     source -> OKLab field -> box-downscale (pixelate) -> palette
     (named hardware, ZentropyLabs custom, or auto-extracted from the image)
     -> palette-aware dither (ordered 2/4/8, blue-ish noise, or error
     diffusion; retro-dither.js) -> optional SDF depth-shade
     -> nearest-neighbor upscale -> tube stage (beam scanlines, phosphor
     mask, bloom + halation, curvature, colour separation, bezel, vignette;
     retro-crt.js).

   Every material composes: src can be an img, an upload, a Studio source
   canvas, or a generative plate, and applyChain layers the engine with any
   Studio effect in either order. Palettes and the OKLab math come from
   retro.py; the dither picks between the two nearest palette entries so a
   hardware palette with coarse steps still dithers; the scanline rows keep
   the retro.py row mean by construction. Zero dependencies. */

import {
  srgbToOklab, oklabToSrgb, labPalette, medianCut, RETRO_PALETTES,
} from "./retro-palettes.js";

export { RETRO_PALETTES, paletteNames } from "./retro-palettes.js";
import { ditherPlate } from "./retro-dither.js";
import { crtStage, crtActive } from "./retro-crt.js";


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

/* renderRetro(src, dst, opts) -> { w, h, palette, cells, colors, entries }
   opts: palette ('gameboy'|...|'auto'), autoK, targetWidth, dither
   ('none'|'bayer2'|'bayer4'|'bayer8'|'noise'|'diffusion'), ditherStrength,
   gamma, brightness, sdfShade, scanlines, scanStrength, beam, mask
   ('none'|'grille'|'slot'|'dot'), maskStrength, bloom, halation, curvature,
   aberration, vignette, upscale. */
export function renderRetro(src, dst, opts = {}) {
  const o = {
    palette: "gameboy", autoK: 8, targetWidth: 128, dither: "bayer4", ditherStrength: 0.8,
    gamma: 1, brightness: 0, sdfShade: false, scanlines: true, scanStrength: 0.35, beam: 0.5,
    mask: "none", maskStrength: 0.35, bloom: 0, halation: 0, curvature: 0, aberration: 0,
    vignette: 0, upscale: 4, ...opts,
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
  const idx = ditherPlate(lab, tw, th, pal, o.dither, o.ditherStrength);
  const outLab = new Array(tw * th);
  for (let p = 0; p < tw * th; p++) outLab[p] = pal[idx[p]].lab;

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
  if (crtActive(o)) crtStage(dctx, dw, dh, { ...o, cell: up });

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
