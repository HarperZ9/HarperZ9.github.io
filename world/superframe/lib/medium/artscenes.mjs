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
  // bloom3 (art round 7, 2026-10-26): bloom's set-up (it scored 6), with spectral pigments, the inks part particulate
  // so they settle into coloured strata on the bed (the lower third), and the frame fitted around every form
  bloom3: {
    // a thick bed (the lower quarter of the tank) so what settles is laid in visible strata, a halocline just above
    // it, the inks centred and the wind low so every form stays inside a frame that excludes the surface line
    medium: { waterLevel: 0.04, bedLevel: 0.97, bedRelief: 0.1, spectral: true },
    look: { wall: '#ead9b8', sigma: [0.6, 0.26, 0.2], warm: '#e2cc94', shafts: 0, deep: '#8fa596', sand: '#dccaa4' },
    t: 5, view: [0.3, 0.06, 0.7, 0.95],
    additives: words => [
      ['layer', { x: 0.5, y: 0.71, w: 0.5, h: 0.03 }, 1, { salt: 1.6, at: 0 }],
      ['text', { x: 0.5, y: 0.24, w: 0.22, h: 0.09 }, 1.3, { text: words, color: '#4c294d', halo: '#9a72a6', at: 0.4, for: 0.3, hold: 8, grain: 0.12 }],
      ['ink', { x: 0.56, y: 0.12, r: 0.026 }, 4, { color: '#1c7d7e', halo: '#6fb3b0', at: 1.1, for: 1.0, spread: 18, fine: 1.1, grain: 0.08 }],
      ['ink', { x: 0.42, y: 0.13, r: 0.02 }, 2.6, { color: '#a93b29', halo: '#d27a52', at: 1.8, for: 0.8, spread: 12, fine: 1, grain: 0.08 }],
      // the lower third: strata from earlier settling, in the pieces' own measured inks and the ochre (Frankenthaler)
      ['strata', {}, 1, { at: 0, layers: [{ color: '#cdb98f', t: 4 }, { color: '#b49a72', t: 1.2 }, { color: '#d6c49c', t: 2.2 }, { color: '#9aa79a', t: 0.6 }, { color: '#d2bf95', t: 1.8 }, { color: '#a88468', t: 0.8 }, { color: '#dac8a2', t: 2.4 }, { color: '#8f7a8c', t: 0.5 }, { color: '#d4c29a', t: 1.6 }, { color: '#b98f6a', t: 0.7 }, { color: '#dccaa4', t: 2 }, { color: '#a2aea0', t: 0.5 }, { color: '#dccaa4', t: 1.5 }] }],
      ['heat', { x: 0.5, y: 0.7, w: 0.06, h: 0.015 }, 1.6, { at: 0, for: 60 }],
      ['wind', {}, 0.25, { at: 0.5, for: 60, gust: true }],
    ],
  },
  // aperture (art round 9): a field of fine ink stripes laid in stable salt layers (stratified, so they stay apart)
  // and combed by one event, the words falling through them over a warm plume; seen through an oval in a dark ground
  // (after Adolf Fleischmann's oval of stripes, 1951-52, and the canon's aperture). Blues measured from the
  // Fleischmann save and Frankenthaler's; the red and straw rods are Elettrosumma's. Spectral pigments; a finer grid
  aperture: {
    grid: [576, 324],
    medium: { waterLevel: 0.02, bedLevel: 0.99, spectral: true },
    look: { wall: '#e8e2d4', sigma: [0.25, 0.12, 0.1], warm: '#e6dcc4', shafts: 0, deep: '#c9d2d0', thickness: 0.01, aperture: { cx: 0.5, cy: 0.5, rx: 0.43, ry: 0.44, ground: '#121212' } },
    t: 4.5, view: [0.2875, 0.035, 0.7125, 0.98],
    additives: words => {
      const blues = ['#1f3a8f', '#2bb3d9', '#c9d6e6', '#4f6fb0', '#0b3d6b', '#7fb8d6', '#263760', '#a9c7dd'], out = [];
      for (let i = 0; i < 34; i++) {
        const y = 0.12 + i * 0.023;
        out.push(['layer', { x: 0.5, y, w: 0.5, h: 0.0115 }, 1, { salt: 0.25 + i * 0.06, at: 0 }]);
        out.push(['ink', { x: 0.5, y, w: 0.5, h: 0.006 }, 1.0, { color: blues[(i * 3) % blues.length], at: 0, spread: 0 }]);
      }
      out.push(['text', { x: 0.5, y: 0.2, w: 0.16, h: 0.07 }, 1.4, { text: words, color: '#121a3a', halo: '#4f6fb0', at: 0.6, for: 0.3, hold: 9 }]);
      out.push(['ink', { x: 0.42, y: 0.18, r: 0.012 }, 2, { color: '#a93b29', at: 1.2, for: 0.5, fine: 1, spread: 4 }]);
      out.push(['ink', { x: 0.58, y: 0.17, r: 0.012 }, 2, { color: '#ddd286', at: 1.6, for: 0.5, fine: 1, spread: 4 }]);
      // round 10: no heat plume (review 9 read it as mush); three more fine drops comb the lower stripes instead
      out.push(['ink', { x: 0.385, y: 0.42, r: 0.016 }, 5, { color: '#121a3a', at: 1.0, for: 0.6, fine: 1.2, spread: 2 }]);
      out.push(['ink', { x: 0.615, y: 0.5, r: 0.016 }, 5, { color: '#a93b29', at: 1.4, for: 0.6, fine: 1.2, spread: 2 }]);
      out.push(['ink', { x: 0.5, y: 0.6, r: 0.018 }, 6, { color: '#121a3a', at: 1.8, for: 0.6, fine: 1.2, spread: 2 }]);
      return out;
    },
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

export function artTank(name, words = 'flow', { seed = 'art', nx, ny } = {}) {
  const P = ART[name]; if (!P) throw new Error(`artscenes: no piece "${name}" (one of ${Object.keys(ART).join(', ')})`);
  const m = new Medium({ nx: nx ?? P.grid?.[0] ?? 192, ny: ny ?? P.grid?.[1] ?? 108, seed: `${seed}/${name}/${words}`, ...P.medium });
  for (const a of P.additives(words)) m.add(...a);
  return m;
}

// a view that holds every form: the bounding box of the pigment, carried and suspended (and the bed, when asked),
// widened by a margin and grown to the aspect (width / height in pixels); so no form is cut by the frame edge
export function fitView(m, { aspect = 0.8, margin = 0.05, bed = false, thresh = 0.12 } = {}) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0, mx = 0;
  const P = Float32Array.from({ length: m.n }, (_, k) => m.pig[0][k] + m.pig[1][k] + m.pig[2][k] + m.pigT[0][k] + m.pigT[1][k] + m.pigT[2][k]);
  for (const v of P) mx = Math.max(mx, v);
  // a form is where the carried pigment reaches thresh of its peak (faint haze is ground, not form)
  for (let j = 0; j < m.ny; j++) for (let i = 0; i < m.nx; i++) {
    const p = P[j * m.nx + i];
    if (p > thresh * mx) { x0 = Math.min(x0, i / m.nx); x1 = Math.max(x1, (i + 1) / m.nx); y0 = Math.min(y0, j / m.ny); y1 = Math.max(y1, (j + 1) / m.ny); }
  }
  if (bed) y1 = 1;
  x0 -= margin; x1 += margin; y0 -= margin; y1 += bed ? 0 : margin;
  // grow to the aspect: pixels per cell equal both ways, so (x1 - x0) * nx / ((y1 - y0) * ny) = aspect
  let w = x1 - x0, h = y1 - y0; const want = aspect * m.ny / m.nx;
  if (w / h < want) { const nw = h * want; x0 -= (nw - w) / 2; x1 += (nw - w) / 2; w = nw; } else { const nh = w / want; if (bed) y0 -= nh - h; else { y0 -= (nh - h) / 2; y1 += (nh - h) / 2; } h = nh; }
  return [x0, y0, x1, y1];
}
