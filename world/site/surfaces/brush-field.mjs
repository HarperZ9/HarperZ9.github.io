// brush-field.mjs: the site's own brush engine (world/feed-23/build/brush) painting into the well. The engine is used
// as it is: its presets, tips, dynamics, spacing, jitter, grain and tapers place the dabs. Only the thing it paints on
// is ours: where the engine expects a surface of pixels, it is handed the well's pigment field.
//
//   fieldSurface(sim, slot)    what the engine's Stroker needs of a surface: w, dab(), pick(), smear()
//       dab     lays pigment of one slot into the field through the tip (and lifts it, for an erasing brush)
//       pick    says how much pigment is under the brush (a wet brush thins itself by it; colour is not picked up,
//               because in the well a pigment's colour belongs to its slot)
//       smear   a smudging brush has no pigment of its own: it pushes the water along the stroke
//   beginStroke(sim, slot, brush, seed)   a live stroke: add(x, y, pressure or null, seconds); done() gives its record
//   replay(sim, strokes, slots)           paints recorded strokes again, the same way, dab for dab
//   cleanStrokes(list)                    a recipe's strokes, checked
//
// Coordinates are fractions of the well. What is laid is pigment in the solver's field, so it is carried, spread,
// kept, glazed and changed by state like any other pigment there. LIMIT: the field is 96 by 72 cells, so a brush's
// fine structure (single bristles, paper grain) is coarser here than on the engine's own canvas.
import { liveStroke } from '../../feed-23/build/brush/stroke.js';
import { PRESETS, PRESET_NAMES, preset } from '../../feed-23/build/brush/presets.js';
import { NX, NY } from './well-sim.mjs';

export const BRUSHES = PRESET_NAMES, LOAD = 3, FULL = 1.1, MAX_STROKES = 80, MAX_POINTS = 400;
// LOAD is how much pigment the brush carries against the engine's own alpha, and FULL the amount a cell fills toward, as
// paint builds toward opaque on the engine's canvas. Both are ours, set so the engine's lightest presets still read in the well.
export const brushName = (id) => id.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/[-_]/g, ' ').toLowerCase();
const r4 = (x) => Math.round(x * 1e4) / 1e4;

export function fieldSurface(sim, slot) {
  return { w: NX, h: NY, dabs: 0, laid: 0,
    dab(tip, x, y, p) {
      const r = Math.max(0.6, p.radius), asp = p.aspect || 1, c = Math.cos(p.angle || 0), s = Math.sin(p.angle || 0), R = Math.ceil(r * Math.max(1, asp) * 1.42), A = p.alpha ?? 1, gr = p.grain, gd = p.grainDepth ?? 0;
      for (let yy = Math.max(0, Math.floor(y - R)); yy <= Math.min(NY - 1, Math.ceil(y + R)); yy++) for (let xx = Math.max(0, Math.floor(x - R)); xx <= Math.min(NX - 1, Math.ceil(x + R)); xx++) {
        const dx = xx + 0.5 - x, dy = yy + 0.5 - y, u = (dx * c + dy * s) / (r * asp), v = (-dx * s + dy * c) / r;
        if (u * u + v * v > 2) continue;
        let a = tip.sample(u, v) * A; if (gr && gd) a *= 1 - gd + gd * 2 * gr.at(xx, yy);
        if (a > 1e-5) { const i = yy * NX + xx; this.laid += sim.lay(slot, i, p.mode === 'erase' ? -Math.min(1, a) : Math.min(1, a * LOAD) * Math.max(0, FULL - sim.dye[slot][i])); }
      }
      this.dabs++;
    },
    pick(x, y) { const i = Math.min(NY - 1, Math.max(0, y | 0)) * NX + Math.min(NX - 1, Math.max(0, x | 0)); let a = 0; for (const F of sim.dye) a += F[i]; return { rgb: [0, 0, 0], a: Math.min(1, a) }; },
    smear(tip, x, y, p) { const k = 1.6 * (p.strength ?? 0.3); sim.stir(x / NX, y / NY, Math.cos(p.angle || 0) * k, Math.sin(p.angle || 0) * k); this.dabs++; },
  };
}

export function beginStroke(sim, slot, brush, seed = 1) {
  if (!PRESETS[brush]) return null;
  const surface = fieldSurface(sim, slot), st = liveStroke(surface, preset(brush), { unit: NX, seed }), pts = [];
  return { surface,
    // the sample is rounded first and painted from the rounded numbers, so a replay lays exactly the same dabs
    add(x, y, p = null, t = 0) { if (pts.length >= MAX_POINTS) return; const q = [r4(x), r4(y), p == null ? null : r4(p), r4(t)]; pts.push(q);
      const s = { x: q[0] * NX, y: q[1] * NY, t: q[3] }; if (q[2] !== null) s.p = q[2]; st.add(s); },
    done: () => ({ brush, slot, seed, pts }) };
}
export function replay(sim, strokes, slots = 4) {
  let dabs = 0;
  for (const s of strokes) { if (s.slot >= slots) continue; const b = beginStroke(sim, s.slot, s.brush, s.seed); if (!b) continue; for (const [x, y, p, t] of s.pts) b.add(x, y, p, t); dabs += b.surface.dabs; }
  return dabs;
}
const num = (x) => typeof x === 'number' && Number.isFinite(x);
export function cleanStrokes(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((s) => s && PRESETS[s.brush] && Number.isInteger(s.slot) && s.slot >= 0 && s.slot < 4 && Array.isArray(s.pts) && s.pts.length).slice(0, MAX_STROKES).map((s) => ({ brush: s.brush, slot: s.slot, seed: Number.isInteger(s.seed) ? s.seed : 1,
    pts: s.pts.filter((q) => Array.isArray(q) && num(q[0]) && num(q[1])).slice(0, MAX_POINTS).map((q) => [r4(Math.min(1, Math.max(0, q[0]))), r4(Math.min(1, Math.max(0, q[1]))), num(q[2]) ? r4(Math.min(1, Math.max(0, q[2]))) : null, num(q[3]) ? r4(q[3]) : 0]) })).filter((s) => s.pts.length);
}
