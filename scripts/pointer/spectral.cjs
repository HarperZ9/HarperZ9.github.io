// spectral.cjs: the colour of a measured material under a named light, for the pointer's build.
//
// Ports of the routines in The Playground's materials package (packages/materials/materials/optics.py and
// spectral.py at the commit named in site-src/pointer/records.json): Fresnel reflectance from complex N = n + ik,
// the GGX lobe with Smith masking, a dye layer over a white ground (absorption from k), CIE XYZ under a light with
// the light's own white (no chromatic adaptation, so a lamp looks warm), and the sRGB matrix and transfer
// (colour.srgb_transfer/1). Spectra are on the records' 380 to 780 nm grid at 5 nm.
'use strict';
const records = require('../../site-src/pointer/records.json');

const GRID = records.grid_nm, NW = GRID.length, CMF = records.cie.xyz_bar;
const byId = Object.fromEntries(records.records.map((r) => [r.id, r]));

// Lights. D65 is the CIE table. A is computed from its CIE 15:2018 definition (c2 fixed at 1.435e-2 m K, 2848 K,
// 100 at 560 nm), as spectral.py does. The sky is D65 scattered by small particles, weighted by lambda^-4
// (Rayleigh), which is what makes a clear sky bluer than the sun.
const LIGHTS = {
  D65: records.cie.d65.slice(),
  A: GRID.map((w) => 100 * (560 / w) ** 5 * (Math.exp(1.435e7 / (2848 * 560)) - 1) / (Math.exp(1.435e7 / (2848 * w)) - 1)),
  sky: records.cie.d65.map((v, i) => v * (560 / GRID[i]) ** 4),
};

// XYZ of a reflectance (or radiance factor) spectrum under a light, so a white reflector under that light has Y = 1
function xyz(spec, light) {
  let x = 0, y = 0, z = 0, norm = 0;
  for (let i = 0; i < NW; i++) {
    const l = light[i];
    x += spec[i] * l * CMF[i][0]; y += spec[i] * l * CMF[i][1]; z += spec[i] * l * CMF[i][2]; norm += l * CMF[i][1];
  }
  return [x / norm, y / norm, z / norm];
}

// unpolarised Fresnel reflectance at a smooth interface from air into N = n + ik, for incidence cosine c
function fresnel(n, k, c) {
  c = Math.min(Math.max(c, 0), 1);
  const s2 = 1 - c * c;
  // eta^2 = (n + ik)^2
  const e2r = n * n - k * k, e2i = 2 * n * k;
  // w = sqrt(eta^2 - s2), principal root
  const ar = e2r - s2, ai = e2i, mod = Math.hypot(ar, ai);
  let wr = Math.sqrt(Math.max(0, (mod + ar) / 2)), wi = Math.sqrt(Math.max(0, (mod - ar) / 2));
  if (ai < 0) wi = -wi;
  const div = (pr, pi, qr, qi) => { const d = qr * qr + qi * qi; return [(pr * qr + pi * qi) / d, (pi * qr - pr * qi) / d]; };
  const [rsr, rsi] = div(c - wr, -wi, c + wr, wi);
  const er = e2r * c, ei = e2i * c;
  const [rpr, rpi] = div(er - wr, ei - wi, er + wr, ei + wi);
  return 0.5 * (rsr * rsr + rsi * rsi + rpr * rpr + rpi * rpi);
}

const ggxD = (ch, a) => { const a2 = a * a, d = ch * ch * (a2 - 1) + 1; return a2 / (Math.PI * d * d); };
const smithG1 = (c, a) => { const a2 = a * a; return (2 * c) / (c + Math.sqrt(a2 + (1 - a2) * c * c)); };

function nk(id) {
  const r = byId[id];
  if (!r) throw new Error(`pointer: no material record ${id} in site-src/pointer/records.json`);
  return [r.n.value, r.k ? r.k.value : new Array(NW).fill(0)];
}

// a dye layer of thickness d metres over a white ground: exp(-2 alpha d), alpha = 4 pi k / lambda (optics.body_albedo)
function dyeLayer(id, d) {
  const [, k] = nk(id);
  return k.map((kk, i) => Math.exp(-2 * (4 * Math.PI * kk / (GRID[i] * 1e-9)) * d));
}

const BINS = 256;
// XYZ of Fresnel reflectance times a light, tabulated over the incidence cosine
function fresnelTable(id, light) {
  const [n, k] = nk(id), t = [];
  for (let b = 0; b <= BINS; b++) {
    const c = b / BINS;
    t.push(xyz(n.map((nn, i) => fresnel(nn, k[i], c)), light));
  }
  return t;
}
const look = (t, c) => t[Math.round(Math.min(Math.max(c, 0), 1) * BINS)];

// linear sRGB from XYZ (D65 white fixed), and the IEC 61966-2-1 transfer (colour.srgb_transfer/1, encode)
const toLinear = ([x, y, z]) => [3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.969266 * x + 1.8760108 * y + 0.041556 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z];
const fromLinear = ([r, g, b]) => [0.4124564 * r + 0.3575761 * g + 0.1804375 * b, 0.2126729 * r + 0.7151522 * g + 0.072175 * b, 0.0193339 * r + 0.119192 * g + 0.9503041 * b];
const encode = (v) => { v = Math.min(Math.max(v, 0), 1); return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (5 / 12) - 0.055; };
const decode = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

// OKLCH to linear sRGB (Ottosson's OKLab matrices), for the platform lacquers whose dye is the site's colour token
function oklch(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((v) => Math.min(Math.max(v, 0), 1));
}

module.exports = { GRID, LIGHTS, xyz, fresnel, ggxD, smithG1, nk, dyeLayer, fresnelTable, look, toLinear, fromLinear, encode, decode, oklch, byId };
