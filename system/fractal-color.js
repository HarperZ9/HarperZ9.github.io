// fractal-color.js: the colour recipe shared by the Studio's two fractal renderers.
//
// fractal.js (CPU, the gated reference) calls these directly. fractal-gl.js compiles the same
// formulas as GLSL, from fractal-glsl-lib.js. Keeping the recipe in one place per language is the
// only reason the two paths still agree: every constant below has a named twin in RAMP_LIB,
// SHADE_LIB or ENCODE_LIB, and a change here without the matching change there shows up as a
// GPU/CPU mismatch in the next frame.
//
// Everything between decode and encode happens in LINEAR light. That is the substantive change from
// the first version of this renderer, which interpolated the palette in sRGB code values: the
// encoding is roughly a 2.2 power curve, so the midpoint of two encoded numbers is darker than the
// encoding of their true midpoint, and every gradient in the image sagged in the middle. It showed
// worst where two stops sit far apart, which on the ocean palette is the long dark run the eye
// spends the most time reading.

// sRGB transfer functions, IEC 61966-2-1. srgbToLinear is display code value -> radiance;
// srgbEncode is the inverse, and is the last thing that happens to a pixel.
export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function srgbEncode(c) {
  if (c <= 0) return 0;
  if (c >= 1) return 1;
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// -- OKLab -------------------------------------------------------------------------------------
// Ottosson (2020). A perceptual space: equal steps in L look like equal steps in lightness, and a
// straight line between two colours holds its hue instead of bending through a third one.
//
// The ramp interpolates HERE rather than in linear light, and the distinction is the whole reason
// these two functions exist. Linear light is correct for anything that behaves like light, which is
// why relief and the trap glow act there. A palette is not light: it is six colours a person chose
// by eye, and the gradient between them is meant to be read, not integrated. Interpolating those in
// radiance spends most of the distance near the bright end, so the segment that wraps from the
// lightest stop back to the darkest one, a full sixth of every cycle, came out as a pale neutral
// band: ember's read #bcbdb3 against the #867e78 the authored palette implies.
export function linearToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

// Writes linear sRGB into `out`. Negative components are clipped: a spline through OKLab can leave
// the sRGB gamut, and negative radiance has no meaning downstream.
export function oklabToLinear(L, a, b, out) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  out[0] = r > 0 ? r : 0;
  out[1] = g > 0 ? g : 0;
  out[2] = bb > 0 ? bb : 0;
  return out;
}

// Palettes are authored as sRGB bytes, so each one is prepared once and cached. Keyed by the stop
// array itself, so a caller that swaps palettes pays the conversion once per palette, not per frame.
// `lab` feeds the ramp; `tint` is the lightest stop kept in LINEAR light, because the trap glow adds
// it as light rather than interpolating toward it.
const PALETTE_CACHE = new WeakMap();

export function preparePalette(pal) {
  let prep = PALETTE_CACHE.get(pal);
  if (prep) return prep;
  const linear = pal.map(s => [srgbToLinear(s[0] / 255), srgbToLinear(s[1] / 255), srgbToLinear(s[2] / 255)]);
  prep = {
    lab: linear.map(c => linearToOklab(c[0], c[1], c[2])),
    tint: linear[linear.length - 1],
  };
  PALETTE_CACHE.set(pal, prep);
  return prep;
}

/**
 * Cyclic Catmull-Rom through the palette stops in OKLab, returning LINEAR light. `t` is in stops
 * (t=1.0 is exactly the second stop); it wraps, so the ramp is endless and seamless. Writes into
 * `out` to keep the per-pixel path allocation-free.
 *
 * The spline replaces straight lines between stops. Piecewise-linear is C0: it leaves a slope
 * discontinuity AT each stop, and since the smooth-iteration field sweeps the whole ramp many times
 * across one frame, those six kinks print as six visible facets per cycle. Catmull-Rom (Catmull and
 * Rom, 1974) is C1 through every stop and passes through all of them unchanged, so the facets go
 * without the palette being redesigned. Overshoot past a stop is left alone in the two chroma axes,
 * where it reads as a small saturation lift, and clipped at zero in L, where it would mean a
 * lightness below black.
 */
export function rampLinear(lab, t, out) {
  const n = lab.length;
  t = t - Math.floor(t / n) * n;
  const i = Math.min(n - 1, Math.floor(t));
  const f = t - Math.floor(t);
  const p0 = lab[(i - 1 + n) % n], p1 = lab[i], p2 = lab[(i + 1) % n], p3 = lab[(i + 2) % n];
  const f2 = f * f, f3 = f2 * f;
  const c = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    c[k] = 0.5 * (2 * p1[k]
      + (p2[k] - p0[k]) * f
      + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2
      + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * f3);
  }
  return oklabToLinear(c[0] > 0 ? c[0] : 0, c[1], c[2], out);
}

// -- Relief ------------------------------------------------------------------------------------
// Light from the upper left. LIGHT_H is how far above the plane it sits: larger reads flatter.
const LIGHT_X = -0.6246950, LIGHT_Y = 0.7808688;
const LIGHT_H = 1.35;
const RELIEF = 0.42;

/**
 * Lambert shading from the escape-orbit derivative, returned as a MULTIPLIER centred on 1.
 *
 * The escape-time field is a height field, and dz/dc gives its gradient for free: u = z/dz points
 * along the steepest ascent of the potential at the escape point, which is the analytic normal of
 * the level surface (Cheritat's normal map, Munafo's distance estimator). Shading against it turns a
 * flat wash of colour into something with a lit side and a shaded side, which is what makes the
 * filaments read as structure rather than as pattern.
 *
 * Centred on 1 rather than applied as a lightness offset so mean exposure across the frame does not
 * move. That matters here: the palette is the subject, and a shading term that also dimmed the image
 * would quietly re-grade all eighteen presets.
 *
 * Out-of-range and non-finite derivatives degrade to flat (1), never to a black pixel. The negated
 * comparisons are how the NaN case gets there: any comparison against NaN is false.
 */
export function relief(zr, zi, dre, dim) {
  const dd = dre * dre + dim * dim;
  if (!(dd > 1e-20 && dd < 1e20)) return 1;
  const ur = (zr * dre + zi * dim) / dd;      // u = z / dz, complex division
  const ui = (zi * dre - zr * dim) / dd;
  const ul = Math.sqrt(ur * ur + ui * ui);
  if (!(ul > 1e-20)) return 1;
  const dot = (ur / ul) * LIGHT_X + (ui / ul) * LIGHT_Y;
  const t = Math.min(1, Math.max(0, (dot + LIGHT_H) / (1 + LIGHT_H)));
  return (1 - RELIEF) + t * (2 * RELIEF);
}

/**
 * Convert a trap opacity authored in DISPLAY code values into the radiance fraction that encodes
 * back to it. Twin of TRAP_GAMMA / trapWeight() in SHADE_LIB, and the reason the glow survived the
 * move to linear light: 0.30 of the radiance is 0.58 of the code value, so compositing the authored
 * number directly doubled the veil and pulled all five palettes toward their lightest stop.
 */
export const TRAP_GAMMA = 2.2;

export function trapWeight(a) {
  return Math.pow(a, TRAP_GAMMA);
}

/**
 * Hue-preserving highlight hold, writing back into `c`. relief() multiplies by up to 1 + RELIEF,
 * which on the bright end of a palette pushes a channel past 1, and letting each channel clip on its
 * own drains the colour: ocean's lightest stop under a full highlight clips green and blue first and
 * prints white, so the filaments the shading was added to light up were the ones losing their hue.
 * Dividing the whole triple by its own maximum walks the colour back to the gamut boundary along its
 * own hue instead, spending highlight headroom rather than saturation. Twin of holdGamut() in
 * SHADE_LIB.
 */
export function holdGamut(c) {
  const m = c[0] > c[1] ? (c[0] > c[2] ? c[0] : c[2]) : (c[1] > c[2] ? c[1] : c[2]);
  if (m > 1) { c[0] /= m; c[1] /= m; c[2] /= m; }
  return c;
}

// The derivative grows like 2^n and reaches float32's ceiling well before 2000 iterations, so the
// GPU path rescales it. The CPU path runs the SAME rescale at the SAME threshold, even though a JS
// double would not overflow until much later, because the two images have to match. Rescaling the
// derivative and its additive seed by one factor leaves the represented derivative's DIRECTION
// exact, and direction is all relief() reads.
export const DERIV_RESCALE_AT = 1e18;
export const DERIV_RESCALE_BY = 1e-9;

// -- Output encode -----------------------------------------------------------------------------
// Interleaved gradient noise (Jimenez, SIGGRAPH 2014): cheap, and far better behaved spectrally than
// a hash of the pixel coordinate.
function ign(x, y) {
  const a = x * 0.06711056 + y * 0.00583715;
  const b = 52.9829189 * (a - Math.floor(a));
  return b - Math.floor(b);
}

/**
 * Dither offset in CODE VALUES, in (-1, 1). Two independent samples subtracted give a TRIANGULAR
 * distribution rather than a uniform one, which decorrelates the residual quantisation error from
 * the signal; uniform dither leaves it correlated, visible as band edges that breathe.
 *
 * Not decoration. An 8-bit output spans very few code values across the dark end of these palettes
 * (the ocean stops run 0x000810 to 0x002244 over a whole sixth of the cycle), so a smooth gradient
 * there quantises into a handful of visible contours. A sub-LSB perturbation before quantisation
 * turns each contour into noise the eye integrates back to the smooth original.
 */
export function ditherOffset(px, py) {
  return ign(px, py) + ign(px + 23, py + 41) - 1;
}

// Encode one linear channel to a 0..255 integer, dithered. Pure zero skips the dither: clamping a
// symmetric offset at zero would make it one-sided, printing faint speckle across the solid black
// interior, which is the largest flat region in most frames and the one most likely to show it.
export function encodeChannel(linear, dither) {
  if (linear <= 0) return 0;
  const v = srgbEncode(linear) * 255 + dither;
  return v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v);
}
