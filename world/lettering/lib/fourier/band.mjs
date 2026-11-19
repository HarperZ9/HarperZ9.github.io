// lib/fourier/band.mjs: beyond outlines. Any image is a 2D Fourier series; this rebuilds one band of spatial
// frequency at a time, from the broad shapes (the lowest frequencies, near the centre of the spectrum) out to the
// edges and the fine detail. The ringing beside a hard edge while bands are missing is the Gibbs effect, kept
// visible on purpose. Pure: node and page alike. Sizes must be powers of two.
//   const S = spectrum2d(img, W, H); bandImage(S, radius) -> Float64Array, the image with every frequency whose
//   radius (in cycles across the image) is at most radius
import { fft } from './fft.mjs';

export function spectrum2d(img, W, H) {
  const re = Float64Array.from(img), im = new Float64Array(W * H), rr = new Float64Array(W), ri = new Float64Array(W), cr = new Float64Array(H), ci = new Float64Array(H);
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) { rr[x] = re[y * W + x]; ri[x] = im[y * W + x]; } fft(rr, ri); for (let x = 0; x < W; x++) { re[y * W + x] = rr[x]; im[y * W + x] = ri[x]; } }
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) { cr[y] = re[y * W + x]; ci[y] = im[y * W + x]; } fft(cr, ci); for (let y = 0; y < H; y++) { re[y * W + x] = cr[y]; im[y * W + x] = ci[y]; } }
  const rad = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const fx = x < W / 2 ? x : x - W, fy = y < H / 2 ? y : y - H; rad[y * W + x] = Math.hypot(fx, fy); }
  return { W, H, re, im, rad, maxRadius: Math.hypot(W / 2, H / 2) };
}

export function bandImage(S, radius) {
  const { W, H } = S, re = new Float64Array(W * H), im = new Float64Array(W * H), rr = new Float64Array(W), ri = new Float64Array(W), cr = new Float64Array(H), ci = new Float64Array(H);
  for (let i = 0; i < W * H; i++) if (S.rad[i] <= radius) { re[i] = S.re[i]; im[i] = S.im[i]; }
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) { cr[y] = re[y * W + x]; ci[y] = im[y * W + x]; } fft(cr, ci, 1); for (let y = 0; y < H; y++) { re[y * W + x] = cr[y]; im[y * W + x] = ci[y]; } }
  const out = new Float64Array(W * H);
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) { rr[x] = re[y * W + x]; ri[x] = im[y * W + x]; } fft(rr, ri, 1); for (let x = 0; x < W; x++) out[y * W + x] = rr[x] / (W * H); }
  return out;
}

// A mask (w x h, coverage 0..1) onto a power-of-two grid no wider than maxW, by box averaging. Returns { img, W, H, s }.
export function gridOf(mask, w, h, maxW = 256) {
  let W = 1; while (W * 2 <= Math.min(w, maxW)) W <<= 1; // never finer than the mask, so no cell is empty
  const s = w / W; let H = 1; while (H < h / s) H <<= 1;
  const img = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let sum = 0, n = 0;
    for (let yy = Math.floor(y * s); yy < Math.min(h, Math.floor((y + 1) * s)); yy++) for (let xx = Math.floor(x * s); xx < Math.min(w, Math.floor((x + 1) * s)); xx++) { sum += mask[yy * w + xx]; n++; }
    img[y * W + x] = n ? sum / n : 0;
  }
  return { img, W, H, s };
}
