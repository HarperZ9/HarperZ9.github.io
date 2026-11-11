// km.mjs: paint optics for the well and the glaze swatches. Pure: no page, runs in node and the browser.
//
// The model is Kubelka-Munk two-flux theory, the standard model for paint layers. A pigment has, per colour
// channel, an absorption K (light taken away) and a scattering S (light turned back). A layer of thickness d has a
// reflectance R and a transmittance T; layers composite by the Kubelka-Munk layering formulas, which depend on
// order whenever S is above zero.
//
//   pigment(lin, opacity)        K and S from a colour (linear light, as it looks at unit thickness over white)
//                                and an opacity (how much of that colour it keeps over black)
//   layer(p, d)                  { R, T } of one layer
//   over(top, under)             two layers as one
//   onGround(layers, ground)     reflectance of layers (first is lowest) on a ground
//   glazeHex(top, under, paper)  the overlap of two unit washes on paper, as a hex colour
//
// Everything this file returns is computed. The inputs are the element's measured colour and measured ink coverage.
export const FLOOR = 1e-4;                                  // K and S never go below this, here and in the shader
export const PAPER = Object.freeze([0.80, 0.765, 0.67]);    // the paper ground in linear light (a warm off-white)
export const OPACITY_DEFAULT = 0.39;                        // the table's median ink coverage, used when none is measured
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export const linToHex = (lin) => '#' + lin.map((c) => Math.round(clamp(linToSrgb(clamp(c, 0, 1)), 0, 1) * 255).toString(16).padStart(2, '0')).join('');
// OKLab to linear sRGB, with the chroma scaled first: how the saturation drive reaches the pigment.
export function okToLinear([L, A, B], chroma = 1) {
  A *= chroma; B *= chroma;
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((x) => clamp(x, 0, 1));
}

// K and S from two appearances of a unit layer: Rw over white (the colour itself) and Rb over black (opacity times
// the colour). The inversion is the one Curtis and others gave for watercolour (1997). With no opacity the pigment
// is a pure absorber: S is zero and K comes from Beer's law, so a wash is a filter and order cannot matter.
export function pigment(lin, opacity = OPACITY_DEFAULT) {
  const o = clamp(opacity, 0, 0.92), K = [], S = [];
  for (let c = 0; c < 3; c++) {
    const Rw = clamp(lin[c], 0.02, 0.97);
    if (o < 0.005) { K.push(-Math.log(Rw) / 2); S.push(0); continue; }
    const Rb = o * Rw, a = 0.5 * (Rw + (Rb - Rw + 1) / Rb), b = Math.sqrt(a * a - 1);
    const x = (b * b - (a - Rw) * (a - 1)) / (b * (1 - Rw)), s = Math.log((x + 1) / (x - 1)) / (2 * b);   // arcoth(x) / b
    S.push(s); K.push(s * (a - 1));
  }
  return { K, S, opacity: o };
}

export function layer(p, d = 1) {
  const R = [], T = [];
  for (let c = 0; c < 3; c++) {
    const k = Math.max(p.K[c], FLOOR), s = Math.max(p.S[c], FLOOR), a = 1 + k / s, b = Math.sqrt(a * a - 1), x = b * s * d, e = Math.exp(-2 * x), den = a * (1 - e) + b * (1 + e);
    R.push((1 - e) / den); T.push(2 * b * Math.exp(-x) / den);
  }
  return { R, T };
}
export const over = (top, under) => ({ R: top.R.map((r, c) => r + top.T[c] ** 2 * under.R[c] / (1 - r * under.R[c])), T: top.T.map((t, c) => t * under.T[c] / (1 - top.R[c] * under.R[c])) });
export function onGround(layers, ground = PAPER) {
  let R = [...ground];
  for (const L of layers) R = L.R.map((r, c) => r + L.T[c] ** 2 * R[c] / (1 - r * R[c]));
  return R;
}
export const glaze = (top, under, ground = PAPER, dTop = 1, dUnder = 1) => onGround([layer(under, dUnder), layer(top, dTop)], ground);
export const glazeHex = (top, under, ground = PAPER) => linToHex(glaze(top, under, ground));
// How far apart two colours in linear light are, as the largest channel difference on the screen's 0 to 255 scale.
export const apart = (a, b) => Math.max(...a.map((x, c) => Math.abs(linToSrgb(clamp(x, 0, 1)) - linToSrgb(clamp(b[c], 0, 1))))) * 255;

// The reaction's product is a pigment of its own. Its colour is computed: the midpoint of the two elements in
// OKLab, a little lighter, with the stronger element's chroma, and its hue turned by up to TURN degrees as the
// link grows. It is opaque, as a precipitate is.
export const TURN = 70, PRODUCT_OPACITY = 0.4;
export function productOk(a, b, link = 1) {
  const L = Math.min(0.86, (a[0] + b[0]) / 2 + 0.07), ma = (a[1] + b[1]) / 2, mb = (a[2] + b[2]) / 2;
  const C = Math.max(Math.hypot(a[1], a[2]), Math.hypot(b[1], b[2]), 0.05), h = Math.atan2(mb, ma) + TURN * clamp(link, 0, 1) * Math.PI / 180;
  return [L, C * Math.cos(h), C * Math.sin(h)];
}
