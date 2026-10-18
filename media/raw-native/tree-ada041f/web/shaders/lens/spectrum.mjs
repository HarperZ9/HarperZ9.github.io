// Wavelength bins for the lens suite, and the glass the lens is made of.
//
// Light from a source is carried as RGB energy. Every lens term that depends on wavelength
// (diffraction size, refraction, coating reflectance, halation depth) is evaluated at BINS
// wavelengths and recombined with per-bin RGB weights. The weights are the linear Rec. 709
// response of each 40 nm bin of the CIE 1931 observer, negative lobes clipped, then scaled so
// the weights of each channel sum to 1 over the bins: a term that does not depend on
// wavelength gives back exactly the source's RGB, and a term that does spreads it.
import { cmf, XYZ_TO, apply3 } from "../spectral.mjs";

export const BINS = 8;
export const BIN_NM = Array.from({ length: BINS }, (_, l) => 420 + 40 * l); // 420 .. 700 nm
export const LAMBDA_D = 587.6; // the helium d line, where a glass's nominal index is quoted

// RGB weight per bin: weights[l] = [r, g, b]; each channel sums to 1 over l.
export const BIN_RGB = (() => {
  const raw = BIN_NM.map((c) => {
    const xyz = [0, 0, 0];
    for (let wl = c - 20; wl < c + 20; wl++) { const v = cmf(wl + 0.5); xyz[0] += v[0]; xyz[1] += v[1]; xyz[2] += v[2]; }
    return apply3(XYZ_TO.rec709, xyz).map((v) => Math.max(0, v));
  });
  const sum = [0, 1, 2].map((k) => raw.reduce((s, w) => s + w[k], 0));
  return raw.map((w) => w.map((v, k) => v / sum[k]));
})();

// Glass by the two-term Cauchy formula n = A + B / lambda^2 (lambda in micrometres). The
// coefficients are round values chosen to sit near a common crown and a dense flint; they are
// not a catalogue fit, and the lens suite only needs plausible dispersion (Abbe numbers near 64
// and 33).
export const GLASS = {
  crown: { A: 1.5046, B: 0.0042 },
  flint: { A: 1.6200, B: 0.0105 },
  air: { A: 1, B: 0 },
};
export const cauchy = (g, nm) => g.A + g.B / ((nm / 1000) * (nm / 1000));
export function abbe(g) { return (cauchy(g, LAMBDA_D) - 1) / (cauchy(g, 486.1) - cauchy(g, 656.3)); }

// Per-channel sum of w(l) * f(l): how a wavelength-dependent factor f weights each channel.
export function channelMean(f) { const o = [0, 0, 0]; for (let l = 0; l < BINS; l++) for (let k = 0; k < 3; k++) o[k] += BIN_RGB[l][k] * f(l); return o; }
