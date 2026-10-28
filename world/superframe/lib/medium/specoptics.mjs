// lib/medium/specoptics.mjs: the surface and lens effects of a spectral tank, band by band (FLOW.md section 13).
//   film      thin-film interference integrated over each 20 nm band (three samples a band), projected once under
//             the tank's illuminant. The RGB path reads reflectance at three wavelengths as R, G and B, which walks
//             the Newton colours but washes out too slowly above the third order; the bands fix both.
//   meniscus  the surface's reflectance at grazing incidence, from water's dispersion (Cauchy fit), as a spectrum.
//   lens      the ball lens with dispersion per band group (crown glass, Cauchy fit): four displaced samples of the
//             scene behind, each lifted to a spectrum, a per-band Fresnel edge, and highlights that reflect the light
//             itself, all projected once.
// Constants: water n(l) = 1.3199 + 6878 / l^2 and crown glass n(l) = 1.5046 + 4200 / l^2, l in nm (Cauchy fits;
// from memory, moderate confidence). The scene behind the lens is already projected RGB, so it is lifted back with
// rgbToSpectrum, exact under D65 only; under another light that lift is an approximation.
import { BANDS, LAMBDA, spectrumRGB, rgbToSpectrum } from './spectral.mjs';
import { reflectance } from '../../../substrate/lib/thinfilm.mjs';
import { clamp } from './grid.mjs';

const nWater = l => 1.3199 + 6878 / (l * l), nGlass = l => 1.5046 + 4200 / (l * l);
const schlick = (n, cosI) => { const r0 = ((n - 1) / (n + 1)) ** 2; return r0 + (1 - r0) * (1 - cosI) ** 5; };

// thin film: a lookup of 1 nm steps from 0 to 1000 nm per illuminant
const FILM = new Map();
export function filmSpectral(dNm, illum = 'D65') {
  let lut = FILM.get(illum);
  if (!lut) {
    lut = new Float32Array(1001 * 3);
    for (let d = 0; d <= 1000; d++) {
      const R = LAMBDA.map(l => (reflectance(d, l - 6.67, { n: nWater(l) }) + reflectance(d, l, { n: nWater(l) }) + reflectance(d, l + 6.67, { n: nWater(l) })) / 3);
      lut.set(spectrumRGB(R, illum).map(v => Math.max(0, v)), d * 3);
    }
    FILM.set(illum, lut);
  }
  const i = clamp(Math.round(dNm), 0, 1000) * 3;
  return [lut[i], lut[i + 1], lut[i + 2]];
}

// the meniscus: grazing reflection (cos 0.15), normalised so the brightest band is the RGB path's 0.97
const MEN = new Map();
export function meniscusSpectral(illum = 'D65') {
  if (!MEN.has(illum)) {
    const R = LAMBDA.map(l => schlick(nWater(l), 0.15)), top = Math.max(...R);
    MEN.set(illum, spectrumRGB(R.map(r => 0.97 * r / top), illum));
  }
  return MEN.get(illum);
}

// band groups for the lens: four samples (430, 510, 590, 670 nm), each serving four bands
const GROUP_L = [430, 510, 590, 670], N550 = nGlass(550), DN = nGlass(450) - N550;
export function lensOverSpectral(m, c, gx, gy, vp, behind, look, illum, hexLin) {
  for (const g of m.glass) {
    const ex = ((gx + 0.5) / m.nx - g.x) / g.rx, ey = ((gy + 0.5) / m.ny - g.y) / g.ry, r = Math.hypot(ex, ey);
    const pr = 0.75 / Math.min(vp.cx * m.nx * g.rx, vp.cy * m.ny * g.ry), cov = clamp((1 - r) / pr + 0.5, 0, 1);
    if (cov <= 0) continue;
    const rr = Math.min(1, r), z = Math.sqrt(Math.max(0, 1 - rr * rr)), k = -1.05 - 0.6 * (1 - z);
    // the RGB path bends blue 1.2% more than green at the rim; the same step here follows the glass's own dispersion
    const L = new Array(BANDS);
    GROUP_L.forEach((l, q) => {
      const disp = 1 + 0.012 * rr * rr * (nGlass(l) - N550) / DN;
      const S = rgbToSpectrum(behind((g.x + ex * g.rx * k * disp) * m.nx - 0.5, (g.y + ey * g.ry * k * disp) * m.ny - 0.5));
      for (let b = 4 * q; b < 4 * q + 4; b++) L[b] = S[b];
    });
    const dark = clamp((rr - 0.78) / 0.2, 0, 1) * (1 - clamp((rr - 0.97) / 0.03, 0, 1));
    const sky = rgbToSpectrum(hexLin(look.airLow)), tint = rgbToSpectrum([0.94, 0.99, 0.96]);
    const spot = Math.exp(-(((ex + 0.38) / 0.16) ** 2 + ((ey + 0.5) / 0.1) ** 2)), arc = clamp(1 - Math.abs(rr - 0.9) / 0.06, 0, 1) * clamp(-ey, 0, 1);
    for (let b = 0; b < BANDS; b++) {
      // Fresnel per band: the RGB path's 0.04 + 0.96 (1 - z)^5 is Schlick at n 1.5; here n follows the band
      const fres = schlick(nGlass(LAMBDA[b]), z);
      L[b] = L[b] * tint[b] * (1 - 0.65 * dark) * (1 - fres) + sky[b] * fres * 1.1 + 0.9 * spot + 0.35 * arc * sky[b];
    }
    const glass = spectrumRGB(L, illum);
    return c.map((v, ch) => v * (1 - cov) + glass[ch] * cov);
  }
  return null;
}
