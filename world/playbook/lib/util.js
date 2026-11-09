// lib/util.js: small shared helpers for the playbook builds. Dependency-free; node and browser.
// Seeded randomness, colour conversion (sRGB and OKLab), and the measured easing curves of QUALITY-SPEC M6.

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// mulberry32: a 32-bit seeded generator. rng(seed)() returns [0, 1).
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stateless integer hash to [0, 1): the same (seed, k) always gives the same number.
export function hash01(seed, k = 0) {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(k | 0, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Colour. Hex strings in, linear or sRGB floats out.
export const hexToRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255); };
export const rgbToHex = (c) => '#' + c.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');
export const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const toSrgb = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

// OKLab (Ottosson 2020) for perceptual mixing of inks.
export function rgbToOklab([r, g, b]) {
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [R, G, B].map((v) => clamp(toSrgb(clamp(v))));
}
export const mixOk = (h1, h2, t) => { const A = rgbToOklab(hexToRgb(h1)), B = rgbToOklab(hexToRgb(h2)); return rgbToHex(oklabToRgb(A.map((v, i) => lerp(v, B[i], t)))); };
// Relative luminance (WCAG) of a hex colour.
export const luminance = (hex) => { const [r, g, b] = hexToRgb(hex).map(toLinear); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// Measured easing (QUALITY-SPEC M6): reveals ease out (quad to expo), drifts linear, long moves sine in-out.
export const EASE = Object.freeze({
  linear: (t) => clamp(t),
  outQuad: (t) => { t = clamp(t); return 1 - (1 - t) * (1 - t); },
  outCubic: (t) => { t = clamp(t); return 1 - (1 - t) ** 3; },
  outExpo: (t) => { t = clamp(t); return t >= 1 ? 1 : (1 - Math.exp(-6 * t)) / (1 - Math.exp(-6)); },
  sineInOut: (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t)),
});

// Reduced-motion query that is safe in node.
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
