// Film stocks for the spectral film shader: layer sensitivities, characteristic curves,
// dye spectral densities, lamps and grain, and build(), which turns a stock pair into the
// tables the passes read. Channel index 0 is the red-sensitive layer (cyan dye), 1 green
// (magenta), 2 blue (yellow), in RGB order. Curves and spectra are parametric
// approximations of published data-sheet shapes, not digitised measurements; their sources
// and confidence are in docs/shaders/CONSTANTS.md.
import { cmf, blackbody, rgbToXYZ, inv3, apply3, PRIMARIES, WHITE, XYZ_TO, mul3, xyToXYZ } from "../spectral.mjs";

export const LAMBDA = Array.from({ length: 41 }, (_, i) => 380 + 10 * i);
const g = (c, fwhm) => { const s = fwhm / 2.3548; return (l) => Math.exp(-0.5 * ((l - c) / s) ** 2); };

export const NEGATIVES = {
  // A tungsten-balanced 500-speed colour negative (Vision3 500T class).
  "neg-500t": { sens: [g(645, 55), g(545, 55), g(445, 60)], gamma: [0.62, 0.62, 0.62], span: [2.6, 2.6, 2.6], dmin: [0.05, 0.05, 0.05],
    dyes: { prim: [g(670, 100), g(550, 85), g(450, 90)], sec: [(l) => 0.3 * g(550, 80)(l) + 0.08 * g(440, 60)(l), (l) => 0.15 * g(435, 60)(l), () => 0] },
    base: 0.1, grainUm: [3.2, 3.4, 4.2], interimage: 0.3, sigmaD48: 0.008 },
  // A daylight 250-speed negative: finer grain.
  "neg-250d": { sens: [g(645, 55), g(545, 55), g(445, 60)], gamma: [0.62, 0.62, 0.62], span: [2.6, 2.6, 2.6], dmin: [0.05, 0.05, 0.05],
    dyes: { prim: [g(670, 100), g(550, 85), g(450, 90)], sec: [(l) => 0.3 * g(550, 80)(l) + 0.08 * g(440, 60)(l), (l) => 0.15 * g(435, 60)(l), () => 0] },
    base: 0.1, grainUm: [2.4, 2.5, 3.0], interimage: 0.3, sigmaD48: 0.006 },
};
export const PRINTS = {
  // A colour print film (2383 class): high contrast, no masking, unwanted absorptions kept.
  // Dye peaks and the red sensitivity were chosen by a grid search (cyan 645-660 / 100-140,
  // magenta 545-555 / 80-110, yellow 445-450, red sensitivity 670-690) for a grey scale that
  // tracks: RMS chroma deviation from -5 to +5 stops fell from 18.7% to 2.8%. Real stocks are
  // engineered the same way; the exact data-sheet curves remain to be digitised.
  "print-2383": { sens: [g(690, 40), g(545, 45), g(445, 50)], gamma: [2.8, 2.8, 2.8], span: [3.9, 3.9, 3.9], dmin: [0.06, 0.06, 0.06],
    dyes: [(l) => g(655, 100)(l) + 0.22 * g(560, 80)(l) + 0.06 * g(440, 60)(l), (l) => g(555, 80)(l) + 0.1 * g(435, 60)(l), g(445, 90)], base: 0.05 },
};
export const PROCESSES = { normal: { bleach: 0 }, "bleach-bypass": { bleach: 0.7 } };

const sigmoidCurve = (gamma, span) => ({ k: (4 * gamma) / span });
export const curve = (x, dmin, span, k, x0) => dmin + span / (1 + Math.exp(-k * (x - x0)));
export const curveInv = (D, dmin, span, k, x0) => x0 - Math.log(span / (D - dmin) - 1) / k;

// Three smooth basis spectra, corrected so a linear Rec.709 triple reconstructs a spectrum
// whose CIE XYZ is exactly that triple's (scene light upsampled to a spectrum, linearly).
function rgbBasis() {
  const B = [(l) => 1 / (1 + Math.exp(-(l - 595) / 14)), g(540, 90), g(450, 70)];
  const P = new Array(9).fill(0), ynorm = LAMBDA.reduce((a, l) => a + cmf(l)[1], 0);
  for (const l of LAMBDA) { const c = cmf(l); for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) P[r * 3 + k] += (c[r] * B[k](l)) / ynorm; }
  const A = mul3(inv3(P), rgbToXYZ(PRIMARIES.rec709, WHITE.D65));
  return LAMBDA.map((l) => [0, 1, 2].map((c) => B[0](l) * A[c] + B[1](l) * A[3 + c] + B[2](l) * A[6 + c]));
}

// build(options) -> the tables (all at LAMBDA) and constants of a negative/print pair.
export function build({ negative = "neg-500t", print = "print-2383", process = "normal", printerPoints = [0, 0, 0] } = {}) {
  const N = NEGATIVES[negative], Pr = PRINTS[print], basis = rgbBasis();
  // Exposure matrix: layer i from scene channel c, rows scaled so white exposes 1 (filtered to balance).
  const E = new Array(9).fill(0);
  LAMBDA.forEach((l, w) => { for (let i = 0; i < 3; i++) for (let c = 0; c < 3; c++) E[i * 3 + c] += N.sens[i](l) * basis[w][c]; });
  for (let i = 0; i < 3; i++) { const s = E[i * 3] + E[i * 3 + 1] + E[i * 3 + 2]; for (let c = 0; c < 3; c++) E[i * 3 + c] /= s; }
  const negPrim = LAMBDA.map((l) => N.dyes.prim.map((f) => f(l)));
  // Integral masking: secondary absorption times D plus a coloured coupler times (Dmax - D) is constant.
  const negConst = LAMBDA.map((l) => N.base + [0, 1, 2].reduce((a, i) => a + (N.dmin[i] + N.span[i]) * N.dyes.sec[i](l), 0));
  const lamp = blackbody(3200), xenon = blackbody(5800);
  const printW = LAMBDA.map((l) => Pr.sens.map((f) => lamp(l) * f(l)));
  const wsum = [0, 1, 2].map((j) => printW.reduce((a, r) => a + r[j], 0));
  printW.forEach((r) => { for (let j = 0; j < 3; j++) r[j] /= wsum[j]; });
  const printPrim = LAMBDA.map((l) => Pr.dyes.map((f) => f(l)));
  let projV = LAMBDA.map((l) => cmf(l).map((v) => v * xenon(l)));
  const openY = projV.reduce((a, r) => a + r[1] * Math.pow(10, -(Pr.base + Pr.dmin.reduce((s, d) => s + d, 0) / 3)), 0);
  projV = projV.map((r) => r.map((v) => v / openY));
  const negK = N.gamma.map((gm, i) => sigmoidCurve(gm, N.span[i]).k), printK = Pr.gamma.map((gm, i) => sigmoidCurve(gm, Pr.span[i]).k);
  const negX0 = [0, 1, 2].map(() => Math.log10(0.18) + 0.6);
  const t = {
    negative, print, process, E, negPrim, negConst, printW, printPrim, projV, printBase: Pr.base,
    neg: { dmin: N.dmin, span: N.span, k: negK, x0: negX0 }, prt: { dmin: Pr.dmin, span: Pr.span, k: printK, x0: [0, 0, 0] },
    bleach: PROCESSES[process].bleach, interimage: N.interimage, grainUm: N.grainUm, sigmaD48: N.sigmaD48, logGain: [0, 0, 0], out: null,
  };
  t.out = adaptToD65(t);
  timePrint(t);
  t.logGain = t.logGain.map((v, j) => v + 0.025 * printerPoints[j]);
  return t;
}

// The projected open gate is the viewer's white: adapt it to D65 (Bradford) and go to Rec.709.
function adaptToD65(t) {
  const white = [0, 0, 0];
  t.projV.forEach((r, w) => { const T = Math.pow(10, -(t.printBase + t.prt.dmin.reduce((a, d, j) => a + d * t.printPrim[w][j], 0))); for (let c = 0; c < 3; c++) white[c] += r[c] * T; });
  const BR = [0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296];
  const s = apply3(BR, white), d = apply3(BR, xyToXYZ(WHITE.D65, white[1]));
  const cat = mul3(inv3(BR), mul3([d[0] / s[0], 0, 0, 0, d[1] / s[1], 0, 0, 0, d[2] / s[2]], BR));
  return mul3(XYZ_TO.rec709, cat).map((v) => v / white[1]);
}

// Colour timing: printer gains (log10) so a scene 18% grey prints to a neutral of the target
// luminance, solved by Newton's method on the full spectral path.
export const GREY_TARGET = 0.18;
function timePrint(t) {
  const grey = [GREY_TARGET, GREY_TARGET, GREY_TARGET];
  const f = (lg) => { const s = { ...t, logGain: lg }; return printPixel(s, negDensities(s, grey)); };
  const resid = (lg) => { const o = f(lg); return [o[0] - GREY_TARGET, o[1] - GREY_TARGET, o[2] - GREY_TARGET]; };
  let lg = [0, 0, 0];
  for (let j = 0; j < 3; j++) { const D = negDensities(t, grey); const H = printExposure(t, D)[j]; lg[j] = curveInv(t.prt.dmin[j] + 0.8, t.prt.dmin[j], t.prt.span[j], t.prt.k[j], 0) - Math.log10(H); }
  for (let it = 0; it < 30; it++) {
    const r = resid(lg); if (Math.hypot(...r) < 1e-7) break;
    const J = new Array(9);
    for (let c = 0; c < 3; c++) { const d = lg.slice(); d[c] += 1e-4; const rd = resid(d); for (let r2 = 0; r2 < 3; r2++) J[r2 * 3 + c] = (rd[r2] - r[r2]) / 1e-4; }
    const step = apply3(inv3(J), r); lg = lg.map((v, c) => v - step[c]);
  }
  t.logGain = lg;
}

// The CPU path for one pixel, used by the timing solve and by film.mjs.
export function negDensities(t, rgb, ev = 0) {
  const H = apply3(t.E, rgb).map((v) => Math.max(v * Math.pow(2, ev), 1e-6));
  const D = H.map((h, i) => curve(Math.log10(h), t.neg.dmin[i], t.neg.span[i], t.neg.k[i], t.neg.x0[i]));
  return interimage(t, D);
}
// Interimage (DIR couplers): each layer's development is held back by its neighbours', which
// widens the differences between layers. Modelled as a gain on each layer's departure from
// the mean developed density; a neutral is untouched.
export function interimage(t, D) {
  const d = D.map((v, i) => v - t.neg.dmin[i]), m = (d[0] + d[1] + d[2]) / 3;
  return d.map((v, i) => t.neg.dmin[i] + v + t.interimage * (v - m));
}
export function printExposure(t, D) {
  const out = [0, 0, 0];
  t.negPrim.forEach((p, w) => { const T = Math.pow(10, -(D[0] * p[0] + D[1] * p[1] + D[2] * p[2] + t.negConst[w])); for (let j = 0; j < 3; j++) out[j] += t.printW[w][j] * T; });
  return out;
}
export function printPixel(t, D) {
  const H = printExposure(t, D), Dp = H.map((h, j) => curve(Math.log10(Math.max(h, 1e-12)) + t.logGain[j], t.prt.dmin[j], t.prt.span[j], t.prt.k[j], 0));
  const silver = t.bleach * (Dp[0] + Dp[1] + Dp[2] - t.prt.dmin[0] - t.prt.dmin[1] - t.prt.dmin[2]) / 3, xyz = [0, 0, 0];
  t.projV.forEach((r, w) => { const p = t.printPrim[w], T = Math.pow(10, -(Dp[0] * p[0] + Dp[1] * p[1] + Dp[2] * p[2] + t.printBase + silver)); for (let c = 0; c < 3; c++) xyz[c] += r[c] * T; });
  return apply3(t.out, xyz);
}
