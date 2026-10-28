// lib/medium/ports.mjs: every superframe port type as an additive, so every existing node can pour into the medium
// through its output. This is how all the techniques register: by what they make, not one by one.
//   text, glyphs   words, as ink that sinks and dissolves (the real text is kept)
//   raster         a picture with form, carried by the flow (rigid, stretch or dissolve)
//   field          a tone field, as ink of that shape (or heat or salt with as: 'heat' | 'salt')
//   vector         drawn lines, rasterised, then as raster
//   particles      grains poured as sediment where they lie
//   audio          a vibration: the strongest pitch picks the standing mode (after Kac: a spectrum suggests a shape,
//                  and isospectral drums show the choice is not unique, so this picks one shape among several)
//   series         a data series driving the previous additive's amount over its pour
//   events         drops of ink at their times, placed left to right, coloured by pitch
//   material       a studio material's core numbers as the medium's properties (flow as sugar, tension as turbulence,
//                  sheen as oil, particles as sediment)
//   motion         its poster frame, as raster
//   distribution   its spread as turbulence where it is poured (a wide distribution stirs, a narrow one is calm)
//   score          a goal: inside its target the water stays calm; outside, turbulence in proportion to the miss
//   time           not an additive: it is the medium's own clock (medium.tank reads the tank at time.t)
// The last three are readings by analogy (inferred), not physics; the others put real matter into the water.
import { make } from '../types.mjs';
import { rasterizeVector, colormap } from '../pix.mjs';
import { stft } from '../../../sound/sound/dsp.js';

export function additivesFromPort(type, value, { where = { x: 0.5, y: 0.42, w: 0.24, h: 0.09 }, at = 0.5, mode = 'stretch', as = 'ink', ink = '#1d2a3a' } = {}) {
  switch (type) {
    case 'text': return [['text', where, 1, { text: String(value.text ?? '').slice(0, 40), color: ink, at, for: 0.3 }]];
    case 'glyphs': return [['text', where, 1, { text: String(value.text ?? '').slice(0, 40), color: ink, at, for: 0.3 }]];
    case 'raster': return [['form', where, 1, { raster: value, mode, at }]];
    case 'motion': return [['form', where, 1, { raster: make.raster(value.w, value.h, value.frames[Math.floor(value.frames.length / 2)]), mode, at }]];
    case 'vector': return additivesFromPort('raster', colormap(rasterizeVector(value, { w: Math.min(512, value.w), h: Math.min(512, value.h) }), ['#ffffff', ink]), { where, at, mode });
    case 'field': {
      if (as === 'heat' || as === 'salt') return [[as, where, 2, { at, for: 4 }]];
      const F = value.channels === 2 ? make.field(value.w, value.h, value.data.filter((_, i) => i % 2 === 0)) : value;
      return additivesFromPort('raster', colormap(F, ['#ffffff', ink]), { where, at, mode });
    }
    case 'particles': return [['tiles', where, Math.min(2, value.n / 2000), { color: '#b0603a', at, for: 2 }]];
    case 'audio': {
      const x = value.channels[0], S = stft(x, value.rate, { n: 2048, hop: Math.max(512, Math.floor(x.length / 32)) });
      let best = 0, bin = 1; const mean = new Float32Array(S.bins); for (const f of S.frames) for (let b = 1; b < S.bins; b++) mean[b] += f[b];
      for (let b = 1; b < S.bins; b++) if (mean[b] > best) { best = mean[b]; bin = b; }
      const hz = bin * S.binHz;
      return [['sound', {}, 0.6, { hz: Math.min(6, hz / 110), modes: Math.max(2, Math.min(16, Math.round(Math.log2(hz / 55) * 3))), at, for: x.length / value.rate }]];
    }
    case 'series': return [['data', {}, 1, { series: Array.from(value.y), at, for: 6, target: -1 }]];
    case 'events': return value.events.slice(0, 24).map(e => ['ink', { x: 0.08 + 0.84 * (e.t / Math.max(0.1, value.duration)), y: 0.36, r: 0.015 }, 0.5 * (e.args?.vel ?? 0.5), { color: (e.args?.note ?? 60) % 2 ? '#a3241c' : '#1d2a3a', at: at + e.t, for: 0.2 }]);
    case 'material': {
      const c = value.core ?? {};
      return [['sugar', 'bottom', 0.6 * (1 - (c.flow ?? 0.5)), { at, for: 2 }], ['turbulence', { x: 0.5, y: 0.6, w: 0.5, h: 0.3 }, 3 * (c.tension ?? 0.5), { at }], ['oil', { x: 0.5, y: 0.5, r: 0.06 }, 0.8 * (c.sheen ?? 0), { at, for: 1 }], ['tiles', { x: 0.5, y: 0.36, w: 0.3, h: 0.02 }, 0.4 * (c.particles ?? 0), { color: value.palette?.accent ?? '#b0603a', at: at + 1, for: 2 }]].filter(a => a[2] > 0.01);
    }
    case 'distribution': { const sd = value.sd ?? (value.max != null && value.min != null ? (value.max - value.min) / 3.46 : 0.5); return [['turbulence', where, Math.min(4, 3 * Math.abs(sd)), { at }]]; }
    case 'score': { const [lo, hi] = value.target ?? [value.value, value.value], miss = value.value < lo ? lo - value.value : value.value > hi ? value.value - hi : 0, span = Math.max(1e-6, Math.abs(hi - lo) || Math.abs(value.value) || 1); return miss > 0 ? [['turbulence', { x: 0.5, y: 0.6, w: 0.45, h: 0.3 }, Math.min(4, 3 * miss / span), { at }]] : []; }
    case 'time': return [];
    default: return [];
  }
}
