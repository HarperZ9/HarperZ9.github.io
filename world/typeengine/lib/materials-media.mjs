// lib/materials-media.mjs: materials whose light, paint, motion or sound only a live renderer can hold in full.
// Each calls its generator module as it is (glass, crt, the stamp brush, the cloud system, spectrographic synthesis)
// and says what part of it a font file can still carry.
import { defineMaterial, hex, clamp } from './material.mjs';
import { make } from './props.mjs';
import { fromMask, renderGlass } from '../../glass/glass.js';
import { signal, display } from '../../glass/crt.js';
import { Surface, paintStroke, preset, makeCloud, renderCloud } from '../../feed-23/build/brush/index.js';
import { synth } from '../../lettering/lib/techniques/sound.mjs';
import { rngFrom } from '../../superframe/lib/seed.mjs';

const colorParam = (d) => Object.freeze({ default: d, color: true });

// A calm ground with fine rules, so refraction has something to bend.
export function backdrop(w, h, { ground = '#ebe5d8', rule = '#b9b0a0', pitch = 9 } = {}) {
  const A = make.albedo(w, h), g = hex(ground), r = hex(rule);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, on = (y % pitch) < 1.2 ? 1 : 0, band = 0.5 + 0.5 * Math.cos((x / w) * Math.PI * 2);
    for (let c = 0; c < 3; c++) A.data[i + c] = g[c] * (1 - 0.06 * band) * (1 - on) + r[c] * on;
    A.data[i + 3] = 1;
  }
  return A;
}

// A rule colour a step away from the ground, darker on light grounds and lighter on dark ones.
function shade(h) { const g = hex(h), L = 0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2], k = L > 0.18 ? 0.62 : 2.4, c = g.map((v) => Math.min(1, v * k + (L > 0.18 ? 0 : 0.02))); return '#' + c.map((v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)).toString(16).padStart(2, '0')).join(''); }

// Premultiplied brush surface to straight albedo.
function fromSurface(S) {
  const A = make.albedo(S.w, S.h);
  for (let i = 0; i < S.w * S.h; i++) { const a = S.px[i * 4 + 3]; A.data[i * 4 + 3] = clamp(a); if (a > 1e-5) for (let c = 0; c < 3; c++) A.data[i * 4 + c] = S.px[i * 4 + c] / a; }
  return A;
}

// Points every `step` px along each stroke, with a pressure that swells mid-stroke.
function samplesOf(stroke, step) {
  const P = stroke.pts; let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  const out = [{ x: P[0][0], y: P[0][1], p: 0.55 }]; let acc = 0, since = 0;
  for (let i = 1; i < P.length; i++) {
    const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); acc += d; since += d;
    if (since < step && i < P.length - 1) continue;
    since = 0; out.push({ x: P[i][0], y: P[i][1], p: 0.55 + 0.45 * Math.sin(Math.PI * clamp(acc / Math.max(1, L))) });
  }
  return out;
}

export const MEDIA = [
  defineMaterial({
    id: 'glass', title: 'Pressed glass', lineage: 'glass/glass.js renderGlass (slab refraction, Cauchy dispersion, Fresnel, caustics)',
    consumes: ['coverage', 'surface.albedo?'], provides: ['surface.albedo'], ownsGround: true,
    params: { glass: { options: ['crown', 'flint', 'dense', 'silica'], default: 'flint' }, spread: { min: 0, max: 4, default: 1.8 }, bevel: { min: 0.01, max: 0.2, default: 0.06, unit: 'em' },
      thickness: { min: 0.05, max: 0.6, default: 0.22, unit: 'em' }, gap: { min: 4, max: 300, default: 26, unit: 'px' }, tint: colorParam('#eef4f1'), film: { min: 0, max: 1, default: 0 }, caustic: { min: 0, max: 1.2, default: 0.35 }, rules: { min: 0, max: 1, default: 1 }, paper: colorParam('#ebe5d8') },
    font: () => ({ kind: 'colr', how: 'a vertical environment gradient, an inner thinned highlight and a rim; refraction, dispersion and caustics stay live', live: ['refraction', 'dispersion', 'caustics'] }),
    render: ({ inputs, params: p, w, h, glyph }) => {
      const body = fromMask(inputs.coverage.data, w, h, { radius: Math.max(1, p.bevel * glyph.size), thickness: p.thickness * glyph.size });
      const bg = inputs['surface.albedo'] ?? backdrop(w, h, { ground: p.paper, rule: shade(p.paper), pitch: p.rules > 0 ? Math.max(4, Math.round(9 / p.rules)) : 1e9 });
      const R = renderGlass(bg, body, { glass: p.glass, spread: p.spread, gap: p.gap, tint: p.tint, film: p.film > 0 ? { minNm: 180, maxNm: 620, amount: p.film } : null, caustic: p.caustic > 0 ? { strength: p.caustic, light: [0.18, -0.25], blur: 1 } : null });
      return { 'surface.albedo': make.albedo(w, h, R.data) };
    },
  }),
  defineMaterial({
    id: 'crt', title: 'Tube signal', lineage: 'glass/crt.js signal and display (YIQ band limits, beam, aperture grille, halation)',
    consumes: ['coverage', 'motion.clock?'], provides: ['light.emission'], ownsGround: true,
    params: { lines: { min: 60, max: 480, default: 200 }, phosphor: colorParam('#9dffc8'), snow: { min: 0, max: 0.3, default: 0.03 }, jitter: { min: 0, max: 0.01, default: 0.0015 },
      roll: { min: 0, max: 0.5, default: 0 }, content: { options: ['source', 'card', 'bars'], default: 'source' }, mask: { min: 0, max: 0.6, default: 0.22 }, bloom: { min: 0, max: 1.5, default: 0.6 }, exposure: { min: 0.3, max: 3, default: 1.3 } },
    font: () => ({ kind: 'outline', how: 'the scanline cut (glyph AND phosphor rows) in the phosphor colour; the beam, bloom, snow and roll stay live', field: 'scanline', live: ['beam', 'bloom', 'snow', 'roll'] }),
    render: ({ inputs, params: p, w, h, seed, clock }) => {
      const src = make.albedo(w, h), c = hex(p.phosphor), cov = inputs.coverage.data;
      for (let i = 0; i < w * h; i++) { for (let k = 0; k < 3; k++) src.data[i * 4 + k] = 0.012 + c[k] * cov[i]; src.data[i * 4 + 3] = 1; }
      const t = inputs['motion.clock']?.t ?? clock?.t ?? 0;
      const sig = signal({ content: p.content, source: src, lines: Math.round(p.lines), samples: Math.min(960, w), snow: p.snow, jitter: p.jitter, roll: p.roll, t, seed: seed ?? 1 });
      const R = display(sig, w, h, { curve: 0, vignette: 0.18, mask: p.mask, bloom: p.bloom, exposure: p.exposure, pitch: 3, bezel: null });
      for (let i = 0; i < w * h; i++) R.data[i * 4 + 3] = 1;
      return { 'light.emission': make.emission(w, h, R.data) };
    },
  }),
  defineMaterial({
    id: 'brush', title: 'Stamp brush', lineage: 'feed-23/build/brush paintStroke (grain, wet mix, taper, pressure)',
    consumes: ['structure.strokes'], provides: ['surface.albedo'],
    params: { preset: { options: ['wisp', 'billow', 'sponge', 'rim', 'haze'], default: 'wisp' }, size: { min: 0.3, max: 3, default: 1.25, unit: 'stems' }, flow: { min: 0.05, max: 1, default: 0.55 },
      color: colorParam('#1d1a24'), seed: { min: 1, max: 9999, default: 7 } },
    font: () => ({ kind: 'live', how: 'painted dabs with grain and wet mixing; a font holds no paint. The skeleton under it is a real outline (the ink binding)' }),
    render: ({ inputs, params: p, w, h }) => {
      const S = new Surface(w, h), strokes = inputs['structure.strokes'].strokes;
      strokes.forEach((st, k) => { const b = preset(p.preset, { size: (st.width * p.size) / w, flow: p.flow }); paintStroke(S, b, samplesOf(st, Math.max(1, st.width * 0.25)), { unit: w, seed: p.seed + k, color: p.color }); });
      return { 'surface.albedo': fromSurface(S) };
    },
  }),
  defineMaterial({
    id: 'cloud', title: 'Cloud', lineage: 'feed-23/build/brush cloud.json/1 (lobe tree, Beer march, rim light)',
    consumes: ['structure.strokes'], provides: ['surface.albedo'],
    params: { style: { options: ['volume', 'wash', 'dither', 'halftone'], default: 'volume' }, puff: { min: 0.3, max: 2.5, default: 0.62, unit: 'stems' }, step: { min: 0.3, max: 3, default: 0.6, unit: 'stems' },
      depth: { min: 0, max: 2, default: 1 }, seed: { min: 1, max: 9999, default: 3 } },
    font: () => ({ kind: 'live', how: 'lit volumes; no font technology holds them' }),
    render: ({ inputs, params: p, w, h }) => {
      const trunks = [], r = rngFrom(`cloud/${p.seed}`);
      for (const st of inputs['structure.strokes'].strokes) {
        const step = st.width * p.step; let carry = 0;
        for (let i = 1; i < st.pts.length; i++) {
          const [x0, y0] = st.pts[i - 1], [x1, y1] = st.pts[i], d = Math.hypot(x1 - x0, y1 - y0);
          for (let s = carry; s < d; s += step) { const u = s / d, R = (st.width * p.puff * (0.75 + 0.5 * r())) / w; trunks.push({ c: [(x0 + (x1 - x0) * u) / w, (y0 + (y1 - y0) * u) / w, (r() - 0.5) * 0.01], r: [R, R * 0.85, R] }); }
          carry = Math.max(0, carry + step - d) % step;
        }
      }
      const S = new Surface(w, h);
      const cloud = makeCloud({ seed: p.seed, trunks, base: { y: 2, soft: 0.02 }, light: { pos: [0.2, -0.3, -0.4] }, style: p.style, erosion: [{ kind: 'billow', scale: 60, amount: 0.004 }] });
      if (p.depth < 1) for (const l of cloud.lobes) l.children = [];
      renderCloud(S, cloud, { unit: w });
      return { 'surface.albedo': fromSurface(S) };
    },
  }),
  defineMaterial({
    id: 'voice', title: 'The letter as sound', lineage: 'lettering/lib/techniques/sound.mjs synth (spectrographic synthesis)',
    consumes: ['sound.spectrum'], provides: ['sound.pcm'],
    params: { fLow: { min: 100, max: 2000, default: 420 }, fHigh: { min: 2000, max: 10000, default: 5200 }, colSec: { min: 0.004, max: 0.04, default: 0.012 }, seed: { min: 1, max: 100, default: 19 } },
    font: () => ({ kind: 'live', how: 'audio rides in the web bundle; a font has no sound table' }),
    render: ({ inputs, params: p }) => {
      const S = inputs['sound.spectrum'], bm = []; for (let i = 0; i < S.rows; i++) bm.push(S.data.subarray(i * S.cols, (i + 1) * S.cols));
      const sig = synth(bm, { fLow: p.fLow, fHigh: p.fHigh, colSec: p.colSec, seed: p.seed });
      return { 'sound.pcm': make.pcm(sig.sr, [sig.x]) };
    },
  }),
  defineMaterial({
    id: 'drift', title: 'Drift along the contour', lineage: 'flow along the distance iso lines (lib/adapters.mjs sdf to velocity), on one clock',
    consumes: ['field.sdf'], provides: ['motion.phase', 'motion.velocity'],
    params: { period: { min: 4, max: 80, default: 22, unit: 'px' }, speed: { min: 0, max: 60, default: 18, unit: 'px per s' } },
    font: () => ({ kind: 'live', how: 'motion needs a clock; a font is still' }),
    render: ({ inputs, params: p }) => {
      const D = inputs['field.sdf'], { w, h, data } = D, ph = make.phase(w, h), v = make.velocity(w, h);
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x, gx = (data[i + 1] - data[i - 1]) / 2, gy = (data[i + w] - data[i - w]) / 2, l = Math.hypot(gx, gy) || 1;
        ph.data[i] = ((data[i] / p.period) % 1 + 1) % 1; v.data[i * 2] = (-gy / l) * p.speed; v.data[i * 2 + 1] = (gx / l) * p.speed;
      }
      return { 'motion.phase': ph, 'motion.velocity': v };
    },
  }),
];
