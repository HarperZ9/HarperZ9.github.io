// lib/living/night.mjs: a state by night (option B for dark mode; the author chooses by eye). The UI ground's rule
// (ui-direction flow/medium.js LAYERS): absorbing layers print as a negative by night, light layers stay positive.
//   negative  the state's darkening of the paper becomes the same lightening of a dark ground, measured in L*, in the hue
//             of its own pigment: ink, charcoal, plant, paint, print, engraving, code
//   positive  the state already makes light on dark (the tube, the code mosaic): unchanged
import { linear, clamp } from './fields.mjs';

export const NIGHT_GROUND = '#111114';
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// lightness: CIE L* from relative luminance, and back
const Lstar = (Y) => (Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y);
const Yof = (L) => (L > 8 ? ((L + 16) / 116) ** 3 : L / 903.3);

/** By night, in perceived lightness: a state's drop in L* below the paper becomes the same rise above the dark ground,
 * so every Weber step keeps its size (a negative taken in linear light made a 10% halo glow like a stroke; ink,
 * charcoal and plant failed OCR at 32 px). The hue is the pigment's own, lifted to that lightness. */
export function toNight(img, { paper, ground = linear(NIGHT_GROUND), law = 'negative' } = {}) {
  if (law === 'positive') return img;
  const out = new Float32Array(img.length), Lp = Lstar(lum(paper[0], paper[1], paper[2])), Lg = Lstar(lum(ground[0], ground[1], ground[2]));
  for (let i = 0; i < img.length; i += 3) {
    const r = img[i], g = img[i + 1], b = img[i + 2], drop = Math.max(0, Lp - Lstar(lum(r, g, b))), Y = Yof(Math.min(100, Lg + drop));
    // the pigment's hue: its colour against the paper, its strongest channel set to 1 (a black ink becomes neutral)
    const tr = r / paper[0], tg = g / paper[1], tb = b / paper[2], m = Math.max(tr, tg, tb, 1e-4);
    let hr = tr / m, hg = tg / m, hb = tb / m; const sat = Math.min(1, drop / 40); // faint marks stay near neutral
    hr = 1 + (hr - 1) * sat; hg = 1 + (hg - 1) * sat; hb = 1 + (hb - 1) * sat;
    const k = Y / Math.max(1e-4, lum(hr, hg, hb));
    out[i] = clamp(hr * k); out[i + 1] = clamp(hg * k); out[i + 2] = clamp(hb * k);
  }
  return out;
}
