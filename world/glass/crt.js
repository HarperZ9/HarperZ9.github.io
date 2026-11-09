// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// crt.js: a television signal as a material. Two stages, the way the engine's physical CRT splits them
// (ENGINE-TECHNIQUES PRN12, "signal to glass"; written from that summary and public broadcast practice, no engine
// source read):
//   signal(): picture content per scan line in gamma-encoded R'G'B', encoded to YIQ, band-limited along the line
//             (luma wide, chroma narrow, so colour smears and edges ring softly), plus snow, line-sync jitter,
//             horizontal tear and vertical roll with its blanking bar;
//   display(): the beam draws each line as a Gaussian spot whose width grows with brightness (bloom), through an
//             aperture grille, with faceplate halation, phosphor persistence, screen curvature and vignette.
// Content: 'bars' (75% colour bars in the broadcast layout), 'bars7' (the seven bars alone), 'static' (snow), 'card' (our own test card: an
// aperture ring, grey steps and a bar row), or 'source' (any raster, so a canvas or a video frame becomes a signal).
import { raster, sample, clamp, mix, random, gauss, boxBlur, srgbToLinear } from './lib/raster.js';

export const SIGNAL = Object.freeze({
  lines: 240, samples: 640, content: 'card', t: 0, seed: 1,
  lumaCycles: 220, chromaCycles: 64,        // band limits in cycles per active line (about 4.2 and 1.3 MHz over 52.6 us)
  snow: 0, snowChroma: 0,                   // Gaussian noise sigma on Y (and on I, Q when the colour killer is off)
  jitter: 0.0015, tear: 0, tearDecay: 0.22, // line-sync jitter and top-of-picture flagging, as shares of the line
  roll: 0, vblank: 21 / 262,                // frames rolled per second; blanking bar height as a share of a field
  source: null,
});

// 75% bars, broadcast layout: seven bars over two thirds, a reverse castellation strip, then -I, white, +Q and the
// PLUGE steps (sub-black, black, above black). Levels in gamma-encoded R'G'B'.
const B75 = [[.75, .75, .75], [.75, .75, 0], [0, .75, .75], [0, .75, 0], [.75, 0, .75], [.75, 0, 0], [0, 0, .75]];
const CAST = [[0, 0, .75], [0, 0, 0], [.75, 0, .75], [0, 0, 0], [0, .75, .75], [0, 0, 0], [.75, .75, .75]];
export function bars(u, v) {
  const k = Math.min(6, Math.floor(u * 7));
  if (v < 0.67) return B75[k];
  if (v < 0.75) return CAST[k];
  const q = u * 7 * 4 / 5; // bottom row on a 5/4 bar grid
  if (q < 1.25) return [0, 0.13, 0.3];            // -I (approximate R'G'B')
  if (q < 2.5) return [1, 1, 1];                   // 100% white
  if (q < 3.75) return [0.2, 0, 0.42];             // +Q (approximate)
  const s = u * 7;
  if (s >= 5 && s < 5 + 1 / 3) return [0, 0, 0].map(() => -0.02); // sub-black
  if (s >= 5 + 2 / 3 && s < 6) return [0.04, 0.04, 0.04];          // above black
  return [0, 0, 0];
}

// Our card: grey steps on the left third, a ring (the house aperture) centred right, a bar row along the base.
export function card(u, v, t = 0) {
  const ar = 4 / 3, x = u * ar, cx = 0.62 * ar, cy = 0.46, d = Math.hypot(x - cx, v - cy);
  if (v > 0.86) return B75[Math.min(6, Math.floor(u * 7))].map(c => c * 0.9);
  if (u < 0.2) { const s = Math.floor(v / 0.86 * 8) / 7; return [s, s, s].map(c => 0.06 + 0.84 * c); }
  const ring = Math.abs(d - 0.27) < 0.035, inner = d < 0.13;
  if (ring) return [0.86, 0.84, 0.8];
  if (inner) { const s = 0.5 + 0.5 * Math.cos(40 * d - t * 2.4); return [s * 0.9, s * 0.88, s * 0.82]; }
  const grid = (Math.abs(((x * 12) % 1) - 0.5) > 0.47 || Math.abs(((v * 9) % 1) - 0.5) > 0.47) ? 0.42 : 0.16;
  return [grid, grid, grid * 1.05];
}

const toYIQ = ([r, g, b]) => [0.299 * r + 0.587 * g + 0.114 * b, 0.596 * r - 0.274 * g - 0.322 * b, 0.211 * r - 0.523 * g + 0.312 * b];
const fromYIQ = (y, i, q) => [y + 0.956 * i + 0.621 * q, y - 0.272 * i - 0.647 * q, y - 1.106 * i + 1.703 * q];

// zero-phase one-pole low-pass along a line: forward then backward, cutoff in cycles per line over n samples
function lowpass(a, n, cycles) {
  const k = Math.exp(-2 * Math.PI * cycles / n);
  for (let i = 1; i < n; i++) a[i] = a[i] * (1 - k) + a[i - 1] * k;
  for (let i = n - 2; i >= 0; i--) a[i] = a[i] * (1 - k) + a[i + 1] * k;
}

// The signal: { lines, samples, data: Float32Array(lines * samples * 3) } in gamma-encoded R'G'B' (may exceed 0..1).
export function signal(o = {}) {
  const p = { ...SIGNAL, ...o }, { lines: L, samples: S } = p, out = new Float32Array(L * S * 3), r = random(`crt/${p.seed}/${Math.round(p.t * 1000)}`);
  const Y = new Float32Array(S), I = new Float32Array(S), Q = new Float32Array(S);
  const total = L / (1 - p.vblank), roll = ((p.t * p.roll * total) % total + total) % total;
  for (let l = 0; l < L; l++) {
    const src = (l + roll) % total; // the line of the transmitted frame this display line shows
    if (src >= L) continue;         // vertical blanking: black
    const v = (src + 0.5) / L, flag = p.tear * Math.exp(-src / (p.tearDecay * L)) * Math.sin(6.283 * (src / L * 2.5 + p.t * 0.9));
    const shift = flag + p.jitter * gauss(r);
    for (let s = 0; s < S; s++) {
      const u = (s + 0.5) / S - shift;
      let c;
      if (u < 0 || u >= 1) c = [0, 0, 0];
      else if (p.content === 'bars') c = bars(u, v);
      else if (p.content === 'bars7') c = B75[Math.min(6, Math.floor(u * 7))]; // the seven bars alone, full height
      else if (p.content === 'static') c = [0.4, 0.4, 0.4]; // no carrier: the AGC lifts the noise to mid grey
      else if (p.content === 'source' && p.source) c = [0, 1, 2].map(k => encode(sample(p.source, u * p.source.w, v * p.source.h, k)));
      else c = card(u, v, p.t);
      const [y, i, q] = toYIQ(c);
      Y[s] = y + p.snow * gauss(r); I[s] = i + p.snowChroma * gauss(r); Q[s] = q + p.snowChroma * gauss(r);
    }
    lowpass(Y, S, p.lumaCycles); lowpass(I, S, p.chromaCycles); lowpass(Q, S, p.chromaCycles);
    for (let s = 0; s < S; s++) { const c = fromYIQ(Y[s], I[s], Q[s]), j = (l * S + s) * 3; out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2]; }
  }
  return { lines: L, samples: S, data: out, roll };
}
const encode = lin => (lin <= 0.0031308 ? 12.92 * lin : 1.055 * Math.max(0, lin) ** (1 / 2.4) - 0.055);

export const DISPLAY = Object.freeze({
  gamma: 2.4, spot: 0.32, bloom: 0.55, mask: 0.22, pitch: 3, halation: 0.12, halationR: 0.02,
  curve: 0.06, vignette: 0.35, persistence: 0, exposure: 1, bezel: '#060607',
});

// Draw a signal on a w x h tube face. prev (a raster) and dt give phosphor persistence. Returns a linear raster.
export function display(sig, w, h, o = {}, prev = null) {
  const p = { ...DISPLAY, ...o }, O = raster(w, h), { lines: L, samples: S, data } = sig;
  const lin = v => (v <= 0 ? 0 : v ** p.gamma);
  const bez = p.bezel ? [1, 3, 5].map(k => srgbToLinear(parseInt(p.bezel.slice(k, k + 2), 16) / 255)) : [0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = (y * w + x) * 4; O.data[j + 3] = 1;
    // barrel curvature: map the face pixel to raster coordinates
    let nx = (x + 0.5) / w * 2 - 1, ny = (y + 0.5) / h * 2 - 1; const r2 = nx * nx + ny * ny;
    nx *= 1 + p.curve * r2 * 0.25; ny *= 1 + p.curve * r2 * 0.25 * 1.2;
    if (Math.abs(nx) > 1 || Math.abs(ny) > 1) { O.data[j] = bez[0]; O.data[j + 1] = bez[1]; O.data[j + 2] = bez[2]; continue; }
    const su = (nx + 1) / 2 * S, sl = (ny + 1) / 2 * L, l0 = Math.floor(sl - 0.5);
    const vig = 1 - p.vignette * (nx * nx * 0.5 + ny * ny * 0.5) ** 1.5;
    const acc = [0, 0, 0];
    for (let l = l0 - 1; l <= l0 + 2; l++) {
      if (l < 0 || l >= L) continue;
      const s0 = clamp(su - 0.5, 0, S - 1.001), i0 = s0 | 0, f = s0 - i0, k = (l * S + i0) * 3;
      for (let c = 0; c < 3; c++) {
        const e = lin(data[k + c] * (1 - f) + data[k + c + 3] * f) * p.exposure;
        const sigma = p.spot * (1 + p.bloom * Math.sqrt(Math.max(0, e))), d = sl - (l + 0.5);
        acc[c] += e * Math.exp(-0.5 * (d / sigma) ** 2) / (sigma * 2.5066);
      }
    }
    const tri = Math.floor(((x % p.pitch) + p.pitch) % p.pitch * 3 / p.pitch);
    for (let c = 0; c < 3; c++) O.data[j + c] = acc[c] * vig * (1 - p.mask + p.mask * 3 * (tri === c ? 1 : 0));
  }
  if (p.halation > 0) {
    const R = Math.max(1, Math.round(p.halationR * w)), B = boxBlur(O.data, w, h, R, { stride: 4, passes: 3 });
    for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) O.data[i * 4 + c] += p.halation * B[i * 4 + c];
  }
  if (prev && p.persistence > 0) for (let i = 0; i < w * h * 4; i++) if ((i & 3) !== 3) O.data[i] = Math.max(O.data[i], prev.data[i] * p.persistence);
  return O;
}

// One call: signal plus display.
export function crt(w, h, so = {}, dO = {}, prev = null) { return display(signal(so), w, h, dO, prev); }

// Measured statistics of a signal's luma, for tests and for matching a reference: mean, sd, kurtosis, lag-1
// correlation along the line and across lines.
export function stats(sig) {
  const { lines: L, samples: S, data } = sig, Yv = new Float64Array(L * S);
  for (let i = 0; i < L * S; i++) Yv[i] = 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2];
  let m = 0; for (const v of Yv) m += v; m /= Yv.length;
  let v2 = 0, v4 = 0, ch = 0, cv = 0;
  for (let l = 0; l < L; l++) for (let s = 0; s < S; s++) {
    const d = Yv[l * S + s] - m; v2 += d * d; v4 += d ** 4;
    if (s + 1 < S) ch += d * (Yv[l * S + s + 1] - m);
    if (l + 1 < L) cv += d * (Yv[(l + 1) * S + s] - m);
  }
  const n = Yv.length, varr = v2 / n;
  return { mean: m, sd: Math.sqrt(varr), kurtosis: v4 / n / (varr * varr), lagLine: ch / (L * (S - 1)) / varr, lagAcross: cv / ((L - 1) * S) / varr };
}
export { mix };
