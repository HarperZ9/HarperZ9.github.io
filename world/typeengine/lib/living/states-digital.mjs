// lib/living/states-digital.mjs: the digital, print, code and drawn states.
//   pixel         a bitmap: the word on a 7-rows-per-cap grid, each cell on or off (the 5 x 7 lineage)
//   crt           the beam: phosphor rows on a dark tube, each row lit where it crosses the letter, with glow
//   print         letterpress halftone: dots on a 45 degree screen, ink squeezed to a darker rim
//   print-live    the same print, awake: it breathes with motion (stills to motion is print to print-live)
//   engraved      lines that swell inside the stroke, the line spacing of an engraved plate
//   code          dense source text inside the letters (name-art textField, after the Divisumma sheet)
//   illustration  the word drawn: engraved letters over a hatched picture of the word's meaning (pictures.mjs)
import { textField } from '../../../name-art/lib/mosaic/textfield.mjs';
import { registerState, pigment } from './states.mjs';
import { clamp, blur, linear, lerp, noise } from './fields.mjs';
import { picture } from './pictures.mjs';

const fill = (C, rgb) => { const out = new Float32Array(C.w * C.h * 3); for (let i = 0; i < C.w * C.h; i++) out.set(rgb, i * 3); return out; };
export const cellOf = (C, rows = C.rows ?? 14) => Math.max(2, Math.round(C.size * 0.7 / rows));

registerState({
  // 14 cells per cap: OCR reads 0% error at 96 px (7 cells, the 5 x 7 lineage, read 84%); below 48 px no grid read
  // under 11% ("ck" merges), so the bitmap is display only
  id: 'pixel', title: 'Bitmap', kind: 'digital', breath: { amp: 0, rate: 0 }, minSize: 48,
  paint(C) {
    const { w, h } = C, k = cellOf(C), a = new Float32Array(w * h), gap = 0; // gaps cut every letter apart for a reader (OCR 100% at 96 px)
    const oy = Math.round(C.G.baseline) % k;
    for (let cy = -1; cy * k + oy < h; cy++) for (let cx = 0; cx * k < w; cx++) {
      let s = 0, n = 0; const y0 = cy * k + oy;
      for (let y = Math.max(0, y0); y < Math.min(h, y0 + k); y++) for (let x = cx * k; x < Math.min(w, cx * k + k); x++) { s += C.cov[y * w + x]; n++; }
      if (!n || s / n < (C.on ?? 0.42)) continue;
      for (let y = Math.max(0, y0); y < Math.min(h, y0 + k - gap); y++) for (let x = cx * k; x < Math.min(w, cx * k + k - gap); x++) a[y * w + x] = 1;
    }
    return pigment(fill(C, C.paper), a, '#16130f', 3.4);
  },
});

registerState({
  id: 'crt', title: 'Tube', kind: 'digital', breath: { amp: 0.4, rate: 0.12 }, night: 'positive',
  paint(C, { phosphor = '#ffb347' } = {}) {
    const { w, h } = C, pitch = Math.max(3, Math.round(C.size / 30)), beam = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const f = Math.abs(((y % pitch) + 0.5) / pitch - 0.5) * 2, prof = Math.exp(-((f / 0.8) ** 2)), row = Math.min(h - 1, Math.floor(y / pitch) * pitch + (pitch >> 1));
      for (let x = 0; x < w; x++) beam[y * w + x] = C.cov[row * w + x] * prof;
    }
    const glow = blur(beam, w, h, C.size * 0.035), P = linear(phosphor), img = fill(C, linear('#0d0d10'));
    for (let i = 0; i < w * h; i++) { const e = beam[i] * 1.6 + glow[i] * 0.9, mask = 0.8 + 0.2 * ((i % w) % 3 === 0 ? 1 : 0); for (let c = 0; c < 3; c++) img[i * 3 + c] += P[c] * e * mask; }
    return img;
  },
});

function halftone(C) {
  const { w, h } = C, pitch = Math.max(2, C.size / 16), soft = blur(C.cov, w, h, pitch * 0.18), a = new Float32Array(w * h), c45 = Math.SQRT1_2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x * c45 + y * c45) / pitch, v = (-x * c45 + y * c45) / pitch, du = u - Math.round(u), dv = v - Math.round(v), d = Math.hypot(du, dv);
    const i = y * w + x, r = Math.sqrt(clamp(soft[i])) * 0.7; // near full tone the dots touch, as solid ink does
    a[i] = clamp((r - d) * pitch * 0.9 + 0.5) * (soft[i] > 0.3 ? 1 : 0);
  }
  const rim = blur(a, w, h, 0.8); for (let i = 0; i < a.length; i++) a[i] = a[i] * (1 + 0.35 * clamp(a[i] - rim[i] + 0.3));
  return a;
}
// a halftone screen under 48 px reads 42% OCR error (the screen is coarser than the strokes): display only
registerState({ id: 'print', title: 'Print', kind: 'print', breath: { amp: 0, rate: 0 }, minSize: 48, paint: (C) => pigment(fill(C, C.paper), halftone(C), '#1a1714', 3.0) });
registerState({ id: 'print-live', title: 'Print, awake', kind: 'print', breath: { amp: 1.6, rate: 0.11 }, minSize: 48, paint: (C) => pigment(fill(C, C.paper), halftone(C), '#1a1714', 3.0) });

function engraving(C, angle = -0.12, pitchK = 20) {
  const { w, h } = C, pitch = Math.max(3, C.size / pitchK), ca = Math.cos(angle), sa = Math.sin(angle), a = new Float32Array(w * h), deep = C.stroke * 0.5;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (C.cov[i] <= 0) continue;
    const v = (x * sa + y * ca) / pitch, f = Math.abs(v - Math.round(v)) * pitch, half = pitch * (0.3 + 0.36 * clamp(-C.sdf[i] / deep));
    a[i] = clamp(half - f + 0.5) * C.cov[i];
  }
  return a;
}
registerState({ id: 'engraved', title: 'Engraving', kind: 'print', breath: { amp: 0, rate: 0 }, paint: (C) => pigment(fill(C, C.paper), engraving(C), '#1a1714', 3.2) });

export const CODE = 'const word = living(text); for (const stop of path) word.at(stop.s, clock.t); // ink to charcoal to plant ';
registerState({
  id: 'code', title: 'Source', kind: 'digital', breath: { amp: 0, rate: 0 },
  paint(C, { source = CODE } = {}) {
    const { w, h } = C, pitch = Math.max(5, Math.round(C.size * 0.085)), t = textField(w, h, { text: source, pitch, weight: 650, mask: C.cov, seed: C.seed });
    const a = new Float32Array(w * h); for (let i = 0; i < a.length; i++) a[i] = Math.max(t[i] * C.cov[i] * 1.25, 0.5 * C.cov[i]); // the letter body carries the reading; the code is its texture
    return pigment(fill(C, C.paper), a, '#1b2a20', 3.0);
  },
});

registerState({
  id: 'illustration', title: 'Drawing', kind: 'print', breath: { amp: 0.3, rate: 0.04 },
  paint(C) {
    const img = fill(C, C.paper), pic = picture(C);
    if (pic) pigment(img, pic, '#7a6a52', 1.1);
    // the letters stay on top, engraved, with a knocked-out halo so the drawing never runs through them
    const halo = blur(C.cov, C.w, C.h, C.stroke * 0.35); for (let i = 0; i < halo.length; i++) if (halo[i] > 0.04) for (let c = 0; c < 3; c++) img[i * 3 + c] = lerp(img[i * 3 + c], C.paper[c], clamp(halo[i] * 3));
    return pigment(img, engraving(C, -0.2, 18), '#1a1714', 3.4);
  },
});
export { noise };
