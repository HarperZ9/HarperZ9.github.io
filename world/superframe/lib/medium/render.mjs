// lib/medium/render.mjs: the medium as light, at any resolution (the grid is coarse; every field is sampled
// bilinearly, and the fine detail is drawn at the output scale). Back to front:
//   air      a warm paper ground lit from above, mist scattering it lighter, smoke as soft volumes (wisps.mjs)
//   wall     the tank's back wall, stained by what the water carried past it, seen through the water's refraction
//   water    pigment absorbs per channel (Beer-Lambert, so inks mix subtractively), then the water itself: warm and
//            clear under the surface, green-blue with depth, with light shafts in it (optics.mjs)
//   ink      words as blooming ink: a dense core, feathered fibrous edges and a lighter halo (inkbloom.mjs)
//   bed      sediment laid by settling, lit by the caustic network (bed.mjs)
//   glass    a glass sphere: an inverted image of what is behind it, a dark rim, highlights, a focused pool of light
//   surface  the underside mirror with Snell's window, the meniscus, the oil film, foam and bubbles
// Returns a superframe raster (linear RGBA).
import { bilerp, clamp } from './grid.mjs';
import { filmLinear } from '../../../substrate/lib/thinfilm.mjs';
import { grainField } from '../../../substrate/lib/raster.mjs';
import { make } from '../types.mjs';
import { drawTesserae } from './tesserae.mjs';
import { drawWisps } from './wisps.mjs';
import { drawMotes } from './motes.mjs';
import { drawItems } from './ticks.mjs';
import { viewport, hexLin, caustics, waterLight, fog, mirrorBand, lensOver, lensCaustic } from './optics.mjs';
import { filmSpectral, meniscusSpectral, lensOverSpectral } from './specoptics.mjs';
import { sediment, bedTopLight } from './bed.mjs';
import { inkAt } from './inkbloom.mjs';
import { spectralSplats } from './finebuf.mjs';
import { filterRGB, rgbToSpectrum, rgbCoefficientBands, spectrumRGB, spectrumOf } from './spectral.mjs';

export const LOOK = Object.freeze({
  air: '#e3d8c4', airLow: '#f4ecdd', wall: '#f3ead6', sand: '#e2cfa6', grout: '#4a463f', smoke: '#8a8279', sun: '#fff2d6', warm: '#e9d9a8',
  // the water: per-channel extinction per tank depth (red first, then green, blue last, in the order of pure water),
  // the deep colour that replaces lost light, the view's own path through the tank, shaft strength, mirror band
  sigma: [2.4, 0.85, 0.6], deep: '#236770', thickness: 0.05, shafts: 0.55, mirror: 0.03,
  absorb: [2.4, 0.85, 0.6],
});

export function render(m, W, H, { look: look0 = LOOK, grain = 2.4, seed = 7, view = [0, 0, 1, 1], illuminant = 'D65' } = {}) {
  const look = { ...look0, warmLin: hexLin(look0.warm ?? LOOK.warm) };
  const { nx, ny } = m, R = make.raster(W, H), d = R.data, vp = viewport(m, W, H, view), C = caustics(m);
  const air = hexLin(look.air), airLow = hexLin(look.airLow), wall = hexLin(look.wall), sand = hexLin(look.sand), deep = hexLin(look.deep), sun = hexLin(look.sun), soot = hexLin(look.smoke);
  const grainPx = Math.max(1, vp.cx * nx / 1400);
  // the index the wall is seen through: water only (the lens and the surface draw their own refraction)
  const IOR = Float32Array.from(m.ior, (v, k) => m.phase[k] && !m.solid[k] ? v : 1.333);
  const surfAt = gx => { const ci = clamp(Math.floor(gx), 0, nx - 2), t = clamp(gx - ci, 0, 1); return m.surfaceY(ci) * (1 - t) + m.surfaceY(ci + 1) * t - 0.5; };
  const bedAt = gx => { const ci = clamp(Math.floor(gx), 0, nx - 2), t = clamp(gx - ci, 0, 1); return ny - (m.bed[ci] * (1 - t) + m.bed[ci + 1] * t) - 0.5; };

  // the scene at a grid point without the lens: used by the main pass and, displaced, by the lens itself
  const scene = (gx, gy, withInk = true) => {
    const ci = clamp(Math.round(gx), 0, nx - 1), surf = surfAt(gx), bedTop = bedAt(gx), px = (gx + 0.5) * vp.cx;
    if (gy < surf) {
      const t = clamp(gy / Math.max(1, surf), 0, 1), mist = clamp(bilerp(m.mist, nx, ny, gx, gy), 0, 3), smoke = clamp(bilerp(m.smoke, nx, ny, gx, gy), 0, 4);
      let c = air.map((v, k) => v + (airLow[k] - v) * t * t);
      c = c.map(v => v + (1 - v) * (1 - Math.exp(-0.6 * mist)) * 0.8);
      c = c.map((v, k) => v * Math.exp(-0.25 * smoke) + soot[k] * (1 - Math.exp(-0.25 * smoke)) * 0.4);
      // a spectral tank sees the air and its smoke through the same projection as the water, so the light change shows there too
      return m.pigS ? spectrumRGB(rgbToSpectrum(c), illuminant) : c;
    }
    const Wt = waterLight(m, C, look, gx, gy, surf);
    let c;
    if (gy >= bedTop) {
      const hpx = (ny - 0.5 - gy) * vp.cy;
      bedOut.layer = null; c = sediment(m, px, hpx, ci, sand, ny * vp.cy, grainPx, m.pigS ? bedOut : null).map(v => v * bedTopLight((gy - bedTop) * vp.cy, grainPx));
      // the floor catches the caustic network sharpest, and the pool of light the lens focuses
      const net = 1 + (0.7 * Wt.c * Wt.c * (0.35 + 0.65 * Wt.fade) - 0.2) * Math.min(1, look.shafts / 0.55) + lensCaustic(m, gx, gy);   // no shafts, no network
      c = c.map(v => v * Math.max(0.2, net) / Math.max(0.3, Wt.shaft));
    } else {
      const k0 = 1.6, ix = (bilerp(IOR, nx, ny, gx + 1, gy) - bilerp(IOR, nx, ny, gx - 1, gy)) * 900 * k0, iy = (bilerp(IOR, nx, ny, gx, gy + 1) - bilerp(IOR, nx, ny, gx, gy - 1)) * 900 * k0;
      c = wall.map((v, k) => v * (1 - 0.35 * clamp(bilerp(m.stain[k], nx, ny, gx + ix, gy + iy), 0, 1)));
    }
    if (m.pigS) return sceneSpectral(c, gx, gy, Wt, withInk, gy >= bedTop ? bedOut.layer : null);
    // pigment sits in the water column: part of it behind the water the eye looks through (it takes the depth's
    // tint), part in front (it keeps its own colour), so ink reads as ink and still sinks into the blue
    if (!withInk) return fog(look, deep, sun, c, Wt);
    return pigmentThrough(m, fog(look, deep, sun, pigmentThrough(m, c, gx, gy, 0.35, illuminant), Wt), gx, gy, 0.65, illuminant);
  };

  // the spectral medium: the background light becomes a spectrum (rgbToSpectrum), the water's extinction and in-scatter
  // act band by band, the pigments' transmittance multiplies band by band on both sides of the water, and the result
  // is projected to RGB once, so two inks that match as spectra keep matching through the fog (one projection, not two)
  m.extraS = m.pigS ? spectralSplats(m) : null;
  const SPEC = m.pigS ? { sun: rgbToSpectrum(sun), warm: rgbToSpectrum(look.warmLin), deep: rgbToSpectrum(deep), sigma: rgbCoefficientBands(look.sigma) } : null;
  const bg = new Array(16), L = new Array(16), bedOut = { layer: null }, tileSpec = new Map();
  function sceneSpectral(c, gx, gy, Wt, withInk, bedLayer = null) {
    rgbToSpectrum(c, bg);
    // a settled layer's own spectrum tints the bed band by band (the same strength as the RGB bed, 0.75)
    if (bedLayer) for (let b = 0; b < 16; b++) bg[b] *= Math.exp(-bedLayer.spec[b] * 0.75);
    const ink = withInk ? inkAt(m, gx, gy) : null, f = Wt.fade ** 1.5, sc = 0.6 + 0.4 * Wt.fade * (0.55 + 0.45 * Wt.c), dep = Wt.depth + look.thickness;
    for (let b = 0; b < 16; b++) {
      let A = 0;
      if (withInk) { A = bilerp(m.pigS[b], nx, ny, gx, gy) + ink.coarse * bilerp(m.pigTS[b], nx, ny, gx, gy) + ink.aS[b]; if (m.sedS) A += 0.8 * bilerp(m.sedS[b], nx, ny, gx, gy); if (m.extraS) A += m.extraS(b, gx, gy); A = Math.max(0, A); }
      const Tw = Math.exp(-SPEC.sigma[b] * dep), T1 = Math.exp(-3 * 0.35 * A), T2 = Math.exp(-3 * 0.65 * A);
      L[b] = (bg[b] * T1 * Wt.shaft * SPEC.sun[b] * Tw + (SPEC.warm[b] * f + SPEC.deep[b] * (1 - f)) * (1 - Tw) * sc) * T2;
    }
    let out = spectrumRGB(L, illuminant);
    if (withInk) {
      if (!m.sedS) out = out.map((v, k) => v * Math.exp(-3 * 0.8 * Math.max(0, bilerp(m.sed[k], nx, ny, gx, gy))));
      const oil = bilerp(m.oil, nx, ny, gx, gy);
      if (oil > 0.02) { const fl = filmSpectral(260 + 500 * clamp(oil, 0, 1), illuminant), a = clamp(oil * 1.5, 0, 0.6); out = out.map((v, k) => v * (1 - a) + fl[k] * a * 0.9); }
    }
    return out;
  }

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [gx, gy] = vp.g(x, y), o = 4 * (y * W + x);
    let c = scene(gx, gy);
    const lens = SPEC ? lensOverSpectral(m, c, gx, gy, vp, (X, Y) => scene(X, Y, false), look, illuminant, hexLin) : lensOver(m, c, gx, gy, vp, (X, Y) => scene(X, Y, false), look);
    if (lens) c = lens;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 1;
  }
  m.extraS = null;
  drawMotes(m, R, vp);
  drawItems(m, R, vp, illuminant);
  // tiles are lit and fogged where they are, like anything else in the water
  drawTesserae(m, R, hexLin(look.grout), (albedo, gx, gy, hexColour) => {
    const Wt = waterLight(m, C, look, gx, gy, surfAt(gx));
    if (!SPEC) return fog(look, deep, sun, albedo, Wt);
    // a tile body in a spectral tank: its ink's reflectance spectrum, lit and fogged band by band, projected once
    const Rf = hexColour ? (tileSpec.get(hexColour) ?? tileSpec.set(hexColour, spectrumOf(hexColour)).get(hexColour)) : rgbToSpectrum(albedo), f = Wt.fade ** 1.5, sc = 0.6 + 0.4 * Wt.fade * (0.55 + 0.45 * Wt.c), dep = Wt.depth + look.thickness, Lb = new Array(16);
    for (let b = 0; b < 16; b++) { const Tw = Math.exp(-SPEC.sigma[b] * dep); Lb[b] = Rf[b] * Wt.shaft * SPEC.sun[b] * Tw + (SPEC.warm[b] * f + SPEC.deep[b] * (1 - f)) * (1 - Tw) * sc; }
    return spectrumRGB(Lb, illuminant);
  }, vp);
  drawWisps(m, R, soot, vp);
  mirrorBand(m, R, look, vp);
  surfaceMarks(m, R, vp, m.pigS ? illuminant : null);
  // an aperture (look.aperture): the medium seen through an oval in a dark ground (after Fleischmann's oval and the
  // canon's aperture motif); the rim is antialiased, and the ground carries a faint vertical brushed texture
  if (look.aperture) {
    const A = look.aperture, G = hexLin(A.ground ?? '#141414'), px = 1.2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - A.cx * W) / (A.rx * W), dy = (y + 0.5 - A.cy * H) / (A.ry * H), r = Math.hypot(dx, dy), edge = (r - 1) * Math.min(A.rx * W, A.ry * H) / px;
      const out = clamp(edge + 0.5, 0, 1); if (out <= 0) continue;
      const o = 4 * (y * W + x), tex = 1 + 0.06 * Math.sin(x * 0.9 + Math.sin(y * 0.013) * 3) * Math.sin(y * 0.05);
      for (let k = 0; k < 3; k++) d[o + k] = d[o + k] * (1 - out) + G[k] * tex * out;
    }
  }
  if (grain > 0) { const g = grainField(W, H, { sd: grain, clump: 2.3, dither: 0, seed }); for (let i = 0; i < W * H; i++) for (let k = 0; k < 3; k++) { const s = d[4 * i + k] <= 0.0031308 ? 12.92 * d[4 * i + k] : 1.055 * d[4 * i + k] ** (1 / 2.4) - 0.055, t = clamp(s + g[i] / 255, 0, 1); d[4 * i + k] = t <= 0.04045 ? t / 12.92 : ((t + 0.055) / 1.055) ** 2.4; } }
  return R;
}

// pigment in the water column: carried pigment, sediment in suspension, and the words as blooming ink
function pigmentThrough(m, c, gx, gy, share = 1, illum = 'D65') {
  const { nx, ny } = m, ink = inkAt(m, gx, gy);
  let out;
  if (m.pigS) {
    // spectral: the inks' absorbance summed band by band, then the transmittance seen under the light as an RGB filter
    const T = new Array(16); let any = false;
    for (let b = 0; b < 16; b++) { const A = bilerp(m.pigS[b], nx, ny, gx, gy) + ink.coarse * bilerp(m.pigTS[b], nx, ny, gx, gy) + ink.aS[b]; if (A > 1e-5) any = true; T[b] = Math.exp(-3 * share * Math.max(0, A)); }
    const F = any ? filterRGB(T, illum) : [1, 1, 1];
    out = c.map((v, k) => v * Math.max(0, F[k]) * Math.exp(-3 * share * 0.8 * Math.max(0, bilerp(m.sed[k], nx, ny, gx, gy))));
  } else out = c.map((v, k) => v * Math.exp(-3 * share * Math.max(0, bilerp(m.pig[k], nx, ny, gx, gy) + 0.8 * bilerp(m.sed[k], nx, ny, gx, gy) + ink.coarse * bilerp(m.pigT[k], nx, ny, gx, gy) + ink.a[k])));
  const oil = bilerp(m.oil, nx, ny, gx, gy);
  if (oil > 0.02) { const f = m.pigS ? filmSpectral(260 + 500 * clamp(oil, 0, 1), illum) : filmLinear(260 + 500 * clamp(oil, 0, 1)); const a = clamp(oil * 1.5, 0, 0.6) * share; out = out.map((v, k) => v * (1 - a) + f[k] * a * 0.9); }
  return out;
}

// the meniscus line, oil film colour on the surface, foam and bubbles, drawn at output resolution
// illum: a spectral tank's light, so the meniscus and the film are seen as spectra (specoptics.mjs); null keeps RGB
function surfaceMarks(m, R, vp, illum = null) {
  const { nx } = m, d = R.data, W = R.w, H = R.h, cell = vp.cy, men = illum ? meniscusSpectral(illum) : [0.97, 0.97, 0.97], film_ = t => (illum ? filmSpectral(t, illum) : filmLinear(t));
  for (let x = 0; x < W; x++) {
    const gx = vp.g(x, 0)[0], ci = clamp(Math.floor(gx), 0, nx - 2), t = clamp(gx - ci, 0, 1), ys = vp.p(0, m.surfaceY(ci) * (1 - t) + m.surfaceY(ci + 1) * t - 0.5)[1];
    const film = m.film[ci] * (1 - t) + m.film[ci + 1] * t;
    // the oil film: a band under the meniscus whose depth follows the film, coloured by thin-film interference and
    // broken into cells where the film is thin (oil on water parts into islands)
    const band = film > 0.02 ? Math.min(cell * 1.8, cell * 0.6 * Math.sqrt(film)) : 0, lw = Math.max(1.5, vp.cx * nx / 1600);
    for (let dy = -2 * lw; dy <= Math.max(2, band); dy++) {
      const y = Math.round(ys + dy); if (y < 0 || y >= H) continue;
      const o = 4 * (y * W + x);
      if (dy < 1.5 * lw) { const w = dy < 0 ? 0.35 : 0.7; for (let k = 0; k < 3; k++) d[o + k] = d[o + k] * (1 - w) + men[k] * w; continue; }
      const cellv = Math.sin(x * 0.11 + Math.sin(y * 0.23 + x * 0.013) * 3) * Math.sin(y * 0.19 - x * 0.05);
      const thick = 200 + 600 * clamp(film / 3 + 0.25 * cellv, 0, 1), fc = film_(thick), w = 0.55 * clamp(1 - (dy - 1.5) / Math.max(1, band), 0, 1) * (cellv > -0.6 ? 1 : 0.2);
      for (let k = 0; k < 3; k++) d[o + k] = d[o + k] * (1 - w) + fc[k] * w;
    }
  }
  const disc = (cx, cy, r, rim, fill) => { for (let y = Math.max(0, Math.floor(cy - r - 1)); y <= Math.min(H - 1, Math.ceil(cy + r + 1)); y++) for (let x = Math.max(0, Math.floor(cx - r - 1)); x <= Math.min(W - 1, Math.ceil(cx + r + 1)); x++) { const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r, a = clamp(0.5 - dd, 0, 1); if (!a) continue; const o = 4 * (y * W + x), edge = clamp(1 - Math.abs(dd + 1) / 1.5, 0, 1); for (let k = 0; k < 3; k++) d[o + k] = d[o + k] * (1 - a) + (fill * d[o + k] + rim * edge) * a; } };
  for (const b of m.bubbles) { const [px, py] = vp.p(b.x, b.y); disc(px, py, b.r * cell * 0.9, 0.9, 0.92); }
  for (const f of m.foam) { const [px, py] = vp.p(f.x, m.surfaceY(clamp(Math.floor(f.x), 0, nx - 1)) - 0.5); disc(px, py + 1, f.r * cell * 0.5 * f.life + 0.6, 0.6, 1.04); }
}
