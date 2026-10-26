// lib/medium/artscenes.mjs: composed pieces, each one idea, made with the same medium and the same physics as the
// demonstration tank (scenes.mjs). The tank shows every additive at once and reads as a diagram; a piece keeps one
// subject and lets everything else serve it. Inks are measured palettes from the reference library (palettes.json):
//   Frankenthaler, Water Shadows: purple #4c294d, teal #3e7d7f, ochre #906e46 (the purple's halo is a lighter violet,
//   #9a72a6, so where it meets the teal the two do not mix to mud: blind review 4)
//   Olivetti Elettrosumma 22: red #a93b29, straw #ddd286, navy #263760
//   bloom    words dropped as purple ink into a stratified tank; they fall, meet the salt, and spread along it into
//            a wash; a teal drop falls through them and a red one into their plume. Framed close (view), no surface or floor
//   ribbon   Bayer's numbered ribbon alone in a deep field, carried and folded by one warm plume
import { Medium } from './medium.mjs';

export const ART = {
  bloom: {
    medium: { waterLevel: 0.045, bedRelief: 0.5 },
    look: { wall: '#ead9b8', sigma: [1.6, 0.6, 0.45], warm: '#e2cc94', shafts: 0, deep: '#2f6f72' },
    t: 7, view: [0.15, 0.2, 0.71, 0.76], portrait: { view: [0.26, 0.06, 0.557, 0.72], W: 864, H: 1080 },
    additives: words => [
      ['layer', { x: 0.5, y: 0.8, w: 0.5, h: 0.1 }, 1, { salt: 1.6, at: 0 }],
      ['text', { x: 0.46, y: 0.26, w: 0.28, h: 0.11 }, 1.3, { text: words, color: '#4c294d', halo: '#9a72a6', at: 0.4, for: 0.3, hold: 8 }],
      // a teal drop falls through the words, and a red one into the plume they make
      ['ink', { x: 0.52, y: 0.1, r: 0.03 }, 4, { color: '#1c7d7e', halo: '#6fb3b0', at: 1.1, for: 1.0, spread: 25, fine: 1.1 }],
      ['ink', { x: 0.36, y: 0.12, r: 0.022 }, 2.6, { color: '#a93b29', halo: '#d27a52', at: 1.8, for: 0.8, spread: 16, fine: 1 }],
      ['heat', { x: 0.5, y: 0.9, w: 0.08, h: 0.02 }, 2.2, { at: 0, for: 60 }],
      ['wind', {}, 0.7, { at: 0.5, for: 60, gust: true }],
    ],
  },
  // bloom2 (after blind review 5): the ink event alone, on a near-flat ground (no light shafts, almost no depth
  // gradient), every pour inside the frame, a halocline in the lower third so the inks spread into it and fill it;
  // spectral pigments (spectral.mjs), so the purple, teal and red mix as spectra where they cross
  bloom2: {
    medium: { waterLevel: 0.04, bedRelief: 0.3, spectral: true },
    look: { wall: '#ecdcbb', sigma: [0.35, 0.16, 0.12], warm: '#e8d4a6', shafts: 0, deep: '#9fb39c', thickness: 0.02 },
    t: 7.5, view: [0.12, 0.2, 0.84, 0.92],
    additives: words => [
      ['layer', { x: 0.5, y: 0.72, w: 0.5, h: 0.12 }, 1, { salt: 1.6, at: 0 }],
      ['text', { x: 0.5, y: 0.33, w: 0.24, h: 0.1 }, 1.3, { text: words, color: '#4c294d', halo: '#9a72a6', at: 0.4, for: 0.3, hold: 8 }],
      ['ink', { x: 0.56, y: 0.2, r: 0.028 }, 4, { color: '#1c7d7e', halo: '#6fb3b0', at: 1.1, for: 1.0, spread: 25, fine: 1.1 }],
      ['ink', { x: 0.43, y: 0.22, r: 0.022 }, 2.6, { color: '#a93b29', halo: '#d27a52', at: 1.8, for: 0.8, spread: 16, fine: 1 }],
      ['heat', { x: 0.5, y: 0.9, w: 0.08, h: 0.02 }, 2.2, { at: 0, for: 60 }],
      ['wind', {}, 0.4, { at: 0.5, for: 60, gust: true }],
    ],
  },
  // transfer: tiles are carried in by a current and loosen into drops of their own ink, which bloom, fall out of the
  // current and settle as coloured sediment: a tessera becomes a drop becomes a deposit, on the medium's own physics
  transfer: {
    medium: { waterLevel: 0.045, bedRelief: 0.45 },
    look: { wall: '#e9dcc0', sigma: [2.8, 1.0, 0.72], warm: '#dcc996' },
    t: 14, view: [0.15, 0.06, 0.85, 0.76], period: 3,
    additives: () => [
      // one tile at a time is set on the water near the top; it sinks, and as it sinks it loosens into its own ink
      ['tesserae', { x: 0.5, y: 0.1, w: 0.05, h: 0.03 }, 1, { cols: 3, rows: 1, at: 0.3, for: 600, every: 3, wander: 0.45, loosen: { after: 0.5, over: 4, tear: 3, ink: 4, motes: 1200, settle: 1.6, sink: 7 } }],
      ['heat', { x: 0.62, y: 0.92, w: 0.05, h: 0.02 }, 1.2, { at: 0, for: 600 }],
      ['current', { x: 0.5, y: 0.5, w: 0.5, h: 0.08 }, 0.12, { angle: 0, at: 0, for: 600 }],
      ['wind', {}, 0.5, { at: 0.5, for: 600, gust: true }],
    ],
  },
  ribbon: {
    medium: { waterLevel: 0.1, bedRelief: 0.4 },
    t: 9,
    additives: () => [
      ['heat', { x: 0.58, y: 0.9, w: 0.05, h: 0.02 }, 7, { at: 0, for: 60 }],
      ['cold', { x: 0.25, y: 0.2, w: 0.06, h: 0.03 }, 4, { at: 0, for: 60 }],
      ['wind', {}, 0.6, { at: 0.5, for: 60, gust: true }],
      ['tesserae', { x: 0.45, y: 0.72, w: 0.3, h: 0.03 }, 1, { cols: 16, rows: 2, at: 0.3 }],
    ],
  },
};

export function artTank(name, words = 'flow', { seed = 'art', nx = 192, ny = 108 } = {}) {
  const P = ART[name]; if (!P) throw new Error(`artscenes: no piece "${name}" (one of ${Object.keys(ART).join(', ')})`);
  const m = new Medium({ nx, ny, seed: `${seed}/${name}/${words}`, ...P.medium });
  for (const a of P.additives(words)) m.add(...a);
  return m;
}
