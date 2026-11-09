// blend.mjs: genre and material blends. Shared quantities interpolate; categorical choices layer.
//
//   blend([a, b], [0.6, 0.4])            -> one material
//
// Core numbers: weighted mean, except pitch (mean in MIDI, so in log frequency already), resonance (geometric
// mean, log frequency) and the cadence (fps snaps to the nearest declared rate, on rounds). Palette: OKLab mean, the others at half weight.
// Hints: the heaviest material leads the type lane and names its technique; the others go under it
// (type.under). Image plates stack: the lead's as they are, the others layered (screen or multiply) at their weight. Motion curves mix point by point. Voices stack, gain
// scaled by weight. Weights below 0.02 drop a material.
import { normalize, CORE } from './schema.mjs';

const RATES = [8, 12, 24, 30, 60];

export function blend(materials, weights) {
  if (!materials.length) throw new Error('blend: needs at least one material');
  const M = materials.map(normalize);
  let W = (weights ?? M.map(() => 1)).map(w => Math.max(0, +w || 0));
  const pairs = M.map((m, i) => [m, W[i]]).filter(([, w]) => w >= 0.02).sort((a, b) => b[1] - a[1]);
  if (!pairs.length) throw new Error('blend: every weight is zero');
  const sum = pairs.reduce((s, [, w]) => s + w, 0), P = pairs.map(([m, w]) => [m, w / sum]);
  if (P.length === 1) return P[0][0];
  const core = {};
  for (const k of Object.keys(CORE)) {
    if (k === 'resonanceHz') core[k] = Math.exp(P.reduce((s, [m, w]) => s + w * Math.log(m.core[k]), 0));
    else core[k] = P.reduce((s, [m, w]) => s + w * m.core[k], 0);
  }
  core.fps = RATES.reduce((a, b) => (Math.abs(b - core.fps) < Math.abs(a - core.fps) ? b : a));
  core.on = Math.round(core.on);
  const lead = P[0][0];
  const plates = [];
  // The lead's plates keep their modes. A later material's 'normal' plates layer instead of cross-fading:
  // screen when its ground is darker than the lead's (its marks are light), multiply when lighter (its marks are dark).
  const leadL = hexToOk(P[0][0].palette.ground)[0];
  P.forEach(([m, w], i) => m.hints.image.plates.forEach((p, j) => {
    const layered = i > 0 && p.mode === 'normal', mode = layered ? (hexToOk(m.palette.ground)[0] < leadL ? 'screen' : 'multiply') : p.mode;
    const op = i === 0 ? (j === 0 ? 1 : p.opacity) : Math.min(1, p.opacity * w * (layered ? 1.7 : 1));
    plates.push({ ...p, mode, opacity: +op.toFixed(4), from: m.id, palette: p.palette ?? m.palette });
  }));
  const mixCurve = { parts: P.map(([m, w]) => ({ curve: m.hints.motion.curve, w })) };
  return normalize({
    id: P.map(([m]) => m.id).join('-x-'), name: P.map(([m]) => m.name).join(' x '),
    genre: [...new Set(P.flatMap(([m]) => m.genre))],
    // palette: OKLab mean leaning to the lead (others count half), so a blend keeps a readable ground and ink
    palette: legible(Object.fromEntries(['ground', 'ink', 'accent'].map(k => [k, mixHex(P.map(([m, w], i) => [m.palette[k], i ? w * 0.5 : w]))]))),
    noiseColour: lead.noiseColour, core,
    hints: {
      type: { ...lead.hints.type, under: P.slice(1).map(([m, w]) => ({ technique: m.hints.type.technique, id: m.id, w: +w.toFixed(4) })) },
      image: { plates },
      motion: { curve: lead.hints.motion.curve, mix: mixCurve },
      sound: { voices: P.flatMap(([m, w]) => m.hints.sound.voices.map(v => ({ ...v, gain: +(v.gain * (0.35 + 0.65 * w)).toFixed(4), from: m.id }))), motif: lead.hints.sound.motif },
    },
    from: { blend: P.map(([m, w]) => ({ id: m.id, w: +w.toFixed(4) })) },
  });
}

// Two-way lerp with a single amount, the usual control: 0 is all a, 1 is all b.
export const lerpMaterial = (a, b, t) => blend([a, b], [1 - t, t]);

// --- colour: OKLab mean of sRGB hex values
const s2l = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const l2s = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function hexToOk(h) {
  const n = parseInt(h.slice(1), 16), [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => s2l(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function okToHex([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, l2s(Math.min(1, Math.max(0, v))))) * 255).toString(16).padStart(2, '0')).join('');
}
export function mixHex(pairs) {
  const acc = [0, 0, 0]; let t = 0;
  for (const [h, w] of pairs) { const o = hexToOk(h); acc[0] += w * o[0]; acc[1] += w * o[1]; acc[2] += w * o[2]; t += w; }
  return okToHex(acc.map(v => v / t));
}
export { hexToOk, okToHex };

// WCAG contrast of two sRGB hex colours.
export function contrast(a, b) {
  const L = h => { const n = parseInt(h.slice(1), 16); const [r, g, bl] = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => s2l(v / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
// Two grounds of opposite lightness can average their inks into their ground. Move the ink's OKLab lightness
// away from the ground's until the pair reads at 4.5:1 (WCAG AA), keeping its hue.
export function legible(p, min = 4.5) {
  if (contrast(p.ink, p.ground) >= min) return p;
  const o = hexToOk(p.ink), dark = contrast('#000000', p.ground) >= contrast('#ffffff', p.ground), dir = dark ? -1 : 1;
  for (let k = 1; k <= 40; k++) {
    const ink = okToHex([Math.min(1, Math.max(0, o[0] + dir * 0.025 * k)), o[1] * (1 - k / 40), o[2] * (1 - k / 40)]);
    if (contrast(ink, p.ground) >= min) return { ...p, ink };
  }
  return { ...p, ink: dark ? '#000000' : '#ffffff' };
}
