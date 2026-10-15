// Phosphor screens for the physical CRT. Each screen has three components. A component
// has an emission spectrum, the gun that drives it ("r", "g", "b", or "y" for the luma
// of a monochrome tube), a share of that gun's light, and a decay law fitted as a sum of
// two exponentials: [weight1, tau1 seconds, tau2 seconds] (weight2 = 1 - weight1).
// Spectra and decay constants carry their sources and confidence in docs/shaders/CONSTANTS.md;
// most decay constants are low confidence and are inputs, not claims.
import { energyBand, lineSpectrum, sumSpd, spdToXYZ, xyOf, xyToXYZ, apply3, inv3, XYZ_TO, WHITE } from "../spectral.mjs";

const eu611 = lineSpectrum([[611, 1], [588, 0.1], [595, 0.1], [630, 0.15], [707, 0.05]]);

export const SCREENS = {
  // Colour P22: Y2O3:Eu red, ZnS:Cu,Al green, ZnS:Ag blue.
  p22: { colour: true, parts: [
    { gun: "r", spd: eu611, decay: [1.0, 0.35e-3, 1e-3] },
    { gun: "g", spd: energyBand(535, 80), decay: [0.9, 20e-6, 0.5e-3] },
    { gun: "b", spd: energyBand(450, 60), decay: [0.95, 5e-6, 0.2e-3] }] },
  // P4 white (black-and-white television): a blue and a yellow component.
  p4: { colour: false, parts: [
    { gun: "y", share: 0.45, spd: energyBand(450, 55), decay: [1.0, 5e-6, 5e-6] },
    { gun: "y", share: 0.55, spd: energyBand(565, 110), decay: [0.9, 20e-6, 0.5e-3] },
    { gun: "y", share: 0, spd: energyBand(565, 110), decay: [1, 1e-6, 1e-6] }] },
  // P7 (radar): a blue flash and a long yellow-green afterglow.
  p7: { colour: false, parts: [
    { gun: "y", share: 0.6, spd: energyBand(440, 50), decay: [1.0, 10e-6, 10e-6] },
    { gun: "y", share: 0.4, spd: energyBand(558, 90), decay: [0.5, 30e-3, 0.4] },
    { gun: "y", share: 0, spd: energyBand(558, 90), decay: [1, 1e-6, 1e-6] }] },
  // P31 (oscilloscope green), P39 (long green), P1 (green, medium).
  p31: { colour: false, parts: [{ gun: "y", share: 1, spd: energyBand(531, 70), decay: [0.9, 15e-6, 1e-3] }] },
  p39: { colour: false, parts: [{ gun: "y", share: 1, spd: energyBand(525, 40), decay: [0.8, 40e-3, 150e-3] }] },
  p1: { colour: false, parts: [{ gun: "y", share: 1, spd: energyBand(525, 40), decay: [0.8, 10e-3, 40e-3] }] },
};

// The gun-to-output matrix of a screen. Columns are the three components' contributions
// to linear output RGB (Rec.709 or Rec.2020), scaled so that full drive on every gun
// gives the white point at Y = 1 for a colour screen, or the phosphor's own colour at
// Y = 1 for a monochrome one. primaries, when given, replaces the spectral chromaticities
// of a colour screen (for example the SMPTE C or EBU standard set).
function energyOf(spd) { let e = 0; for (let wl = 380; wl <= 780; wl++) e += spd(wl); return e; }

export function screenMatrix(name, { white = "D65", output = "rec709", primaries = null } = {}) {
  const sc = SCREENS[name];
  if (!sc) throw new Error(`unknown phosphor screen ${name}`);
  const parts = sc.parts.concat([]);
  while (parts.length < 3) parts.push({ gun: "y", share: 0, spd: () => 0, decay: [1, 1e-6, 1e-6] });
  // Colour: unit-luminance primaries balanced to the white. Monochrome: each component's
  // share is of radiant energy, and the sum is scaled to unit luminance.
  const xyz = parts.map((p, k) => {
    if (sc.colour && primaries) return xyToXYZ(primaries[k]);
    const v = spdToXYZ(p.spd);
    if (!sc.colour) { const e = energyOf(p.spd); return e > 0 ? v.map((c) => c / e) : [0, 0, 0]; }
    return v[1] > 0 ? [v[0] / v[1], 1, v[2] / v[1]] : [0, 0, 0];
  });
  let gain;
  if (sc.colour) {
    const M = [xyz[0][0], xyz[1][0], xyz[2][0], xyz[0][1], xyz[1][1], xyz[2][1], xyz[0][2], xyz[1][2], xyz[2][2]];
    gain = apply3(inv3(M), xyToXYZ(WHITE[white] || white));
  } else {
    const Y = parts.reduce((a, p, k) => a + p.share * xyz[k][1], 0);
    gain = parts.map((p) => p.share / Y);
  }
  const toOut = XYZ_TO[output];
  const cols = xyz.map((v, k) => apply3(toOut, v.map((c) => c * gain[k])));
  // Row-major 3 x 3: out = M * gunLight.
  const m = [cols[0][0], cols[1][0], cols[2][0], cols[0][1], cols[1][1], cols[2][1], cols[0][2], cols[1][2], cols[2][2]];
  return { matrix: m, chromaticities: xyz.map((v) => (v[1] > 0 ? xyOf(v) : [0, 0])), mono: !sc.colour, parts };
}

// Decay constants per component for a field period T (seconds), as the persistence
// pass reads them: [w1, e1, e2, tau1, tau2] with e = exp(-T / tau).
export function decayTable(parts, T) {
  return parts.map((p) => {
    const [w, t1, t2] = p.decay;
    return [w, Math.exp(-T / t1), Math.exp(-T / t2), t1, t2];
  });
}
