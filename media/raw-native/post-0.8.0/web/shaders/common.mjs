// Shared arithmetic for the shader library, on the CPU and (as COMMON_WGSL) on the GPU.
// Every function here exists twice, once in JavaScript and once in WGSL, and the two
// are written to do the same operations in the same order, so a CPU reference and its
// GPU pass agree to within f32 rounding.

export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

// sRGB transfer (IEC 61966-2-1), both directions.
export function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
export function linearToSrgb(l) { l = clamp(l, 0, 1); return l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; }

// erf by Abramowitz and Stegun 7.1.26 (absolute error under 1.5e-7). The GPU uses the
// same polynomial, so the two agree on every gaussian integral the library takes.
export function erf(x) {
  const s = x < 0 ? -1 : 1, a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
// The mass of a normal distribution N(mu, sigma) that falls in [a, b].
export function gaussMass(a, b, mu, sigma) {
  const k = 1 / (sigma * Math.SQRT2);
  return 0.5 * (erf((b - mu) * k) - erf((a - mu) * k));
}

// PCG hash (O'Neill's output function on a 32-bit LCG step), as u32.
export function pcg(v) {
  const state = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0;
  const word = Math.imul(((state >>> (((state >>> 28) + 4) >>> 0)) ^ state) >>> 0, 277803737) >>> 0;
  return ((word >>> 22) ^ word) >>> 0;
}
// A uniform in [0, 1) from three integer coordinates.
export function hash3(x, y, z) { return pcg((x >>> 0) ^ pcg((y >>> 0) ^ pcg(z >>> 0))) / 4294967296; }

// A linear-phase low-pass FIR by the windowed-sinc method with a Blackman window.
// cutoff is in cycles per sample (0 to 0.5); the taps sum to 1. half is the number of
// taps on each side of the centre.
export function lowpassTaps(cutoff, half) {
  const n = 2 * half + 1, h = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const m = i - half, x = 2 * cutoff * m;
    const sinc = m === 0 ? 2 * cutoff : Math.sin(Math.PI * x) / (Math.PI * m);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (n - 1));
    h[i] = sinc * w; sum += h[i];
  }
  for (let i = 0; i < n; i++) h[i] /= sum;
  return h;
}
// A band-stop (notch) FIR: a unit impulse minus a band-pass made of two low-passes.
export function notchTaps(centre, halfWidth, half) {
  const hi = lowpassTaps(Math.min(0.499, centre + halfWidth), half), lo = lowpassTaps(Math.max(0.001, centre - halfWidth), half);
  const h = new Float64Array(2 * half + 1);
  for (let i = 0; i < h.length; i++) h[i] = (i === half ? 1 : 0) - (hi[i] - lo[i]);
  return h;
}
// A gaussian low-pass whose response is down 3 dB at `cutoff` cycles per sample (smooth, no
// ringing: the shape of an analogue chain rather than a brick wall); taps sum to 1.
export function gaussTaps(cutoff, half = 0) {
  const sigma = 0.13251 / cutoff, r = half || Math.ceil(4 * sigma), h = new Float64Array(2 * r + 1);
  let s = 0; for (let i = -r; i <= r; i++) { h[i + r] = Math.exp(-0.5 * (i / sigma) ** 2); s += h[i + r]; }
  for (let i = 0; i < h.length; i++) h[i] /= s;
  return h;
}
// Taps that pass everything: used when a stage's bandwidth is set to 0 (off).
export const identityTaps = () => new Float64Array([1]);

// A frame of linear light: width, height and RGBA f32 rows, row 0 at the top.
export function frame(w, h, data = null) { return { width: w, height: h, data: data || new Float32Array(w * h * 4) }; }
// RGBA8 sRGB bytes to a linear frame, and back (with clamping).
export function frameFromSrgb8(img) {
  const f = frame(img.width, img.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    f.data[i] = srgbToLinear(d[i] / 255); f.data[i + 1] = srgbToLinear(d[i + 1] / 255); f.data[i + 2] = srgbToLinear(d[i + 2] / 255); f.data[i + 3] = 1;
  }
  return f;
}
// Encoded (gamma) values as they arrive from a video source: R'G'B' in [0, 1], not linearised.
export function signalFromSrgb8(img) {
  const f = frame(img.width, img.height), d = img.data;
  for (let i = 0; i < d.length; i++) f.data[i] = (i & 3) === 3 ? 1 : d[i] / 255;
  return f;
}
export function srgb8FromFrame(f, exposure = 1) {
  const o = new Uint8ClampedArray(f.width * f.height * 4), d = f.data;
  for (let i = 0; i < o.length; i += 4) {
    o[i] = Math.round(linearToSrgb(d[i] * exposure) * 255); o[i + 1] = Math.round(linearToSrgb(d[i + 1] * exposure) * 255);
    o[i + 2] = Math.round(linearToSrgb(d[i + 2] * exposure) * 255); o[i + 3] = 255;
  }
  return { width: f.width, height: f.height, data: o };
}

// The same functions in WGSL, prepended to every pass of the library.
export const COMMON_WGSL = /* wgsl */ `
fn srgb_to_linear(c: f32) -> f32 { if (c <= 0.04045) { return c / 12.92; } return pow((c + 0.055) / 1.055, 2.4); }
fn linear_to_srgb(l0: f32) -> f32 { let l = clamp(l0, 0.0, 1.0); if (l <= 0.0031308) { return l * 12.92; } return 1.055 * pow(l, 1.0 / 2.4) - 0.055; }
fn erf_as(x: f32) -> f32 {
  let s = select(1.0, -1.0, x < 0.0); let a = abs(x); let t = 1.0 / (1.0 + 0.3275911 * a);
  let y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-a * a);
  return s * y;
}
fn gauss_mass(a: f32, b: f32, mu: f32, sigma: f32) -> f32 {
  let k = 1.0 / (sigma * 1.4142135623730951);
  return 0.5 * (erf_as((b - mu) * k) - erf_as((a - mu) * k));
}
fn pcg(v: u32) -> u32 {
  let state = v * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
fn hash3(x: u32, y: u32, z: u32) -> f32 { return f32(pcg(x ^ pcg(y ^ pcg(z)))) / 4294967296.0; }
`;
