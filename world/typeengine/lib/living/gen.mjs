// lib/living/gen.mjs: living type's moves as creation-engine generators (creation, BLEED section 16),
// built with that engine's own defineGen and makeLayer (read-only imports), so its bookkeeping, timing warp and settle
// test apply unchanged:
//   living.reveal   one surface carried away to show what lies beneath (the shared reveal: a translation under a word,
//                   what lies under a claim). params: { top, under (linear RGB w*h*3), w, h, law: 'pour', mask, seed }
//   living.medium   a word changing medium as it moves. params: { text, from, to, w, h, fromParams, toParams, law, seed }
// The layer is the flow grid: fields.amount is the progress tick at each cell (the share revealed or converted),
// fields.vel the flow (cells per step, so other layers can ride it). layer.state.frame() renders the pixels now.
// Time is the law's own: a move takes law.seconds of its physics; step(dt) advances it, optionally warped by a
// timing layer (the Hum v4 grid is one such layer a place may choose).
import { defineGen } from '../../../creation/lib/core/gen.mjs';
import { makeLayer } from '../../../creation/lib/core/layer.mjs';
import { createReveal } from './reveal.mjs';
import { createLiving } from './index.mjs';
import { fieldsAt } from './compose.mjs';

function load(L, sim, seconds, frame) {
  L.state.sim = sim; L.state.seconds = seconds; L.state.frame = () => frame(Math.min(1, L.t / seconds)); refresh(L);
}
function refresh(L) {
  const s = L.state, p = Math.min(1, L.t / s.seconds), F = fieldsAt(s.sim, p), n = L.n, a = L.fields.amount, v = L.fields.vel;
  // a medium change counts as done where the medium has turned and the material has come home to rest
  for (let k = 0; k < n; k++) {
    const home = Math.exp(-Math.hypot(F.px[k] - (k % s.sim.nx), F.py[k] - Math.floor(k / s.sim.nx)) / 0.5);
    a[k] = s.kind === 'reveal' ? 1 - F.R[k] : Math.min(1, Math.max(0, F.W[k])) * home; v[2 * k] = F.vx[k]; v[2 * k + 1] = F.vy[k];
  }
}
const shell = (id, sim, extra) => makeLayer(id, { w: sim.nx, h: sim.ny, law: { shape: extra.kind, params: { law: sim.law } }, weights: extra.weights ?? {}, timing: extra.timing ?? null, fields: { vel: new Float32Array(sim.nx * sim.ny * 2) }, state: { kind: extra.kind } });

export const reveal = defineGen({
  id: 'living.reveal', law: 'a surface carried off by its medium (pour: water across paint) uncovers the layer beneath', weights: { wash: 'law', seed: 1 },
  inputs: { top: 'linear RGB image', under: 'linear RGB image' }, mechanism: 'stable fluids on the medium grid; position map and wash fields; lib/living/reveal.mjs',
  credits: ['superframe lib/medium/grid.mjs'], progress: 'amount',
  create(p) { const r = createReveal(p), L = shell('living.reveal', r.sim, { kind: 'reveal', timing: p.timing }); load(L, r.sim, r.seconds, r.frame); return L; },
  step(L) { refresh(L); },
});

export const medium = defineGen({
  id: 'living.medium', law: 'a word changes medium where the medium\'s own process (drying, wetting, settling, a scan) reaches the moving material', weights: { from: 'state', to: 'state' },
  inputs: {}, mechanism: 'lib/living: states painted from the glyph, a law (transfer.mjs) carrying them; compose.mjs', credits: ['superframe lib/medium/grid.mjs'], progress: 'amount',
  create(p) {
    const Lv = createLiving({ w: p.w, h: p.h, seed: p.seed ?? 1, stops: [{ state: p.from, text: p.text, params: p.fromParams }, { state: p.to, params: p.toParams, via: p.law }] }), m = Lv.move(0);
    const L = shell('living.medium', m.sim, { kind: 'change', timing: p.timing }); load(L, m.sim, m.seconds, m.frame); return L;
  },
  step(L) { refresh(L); },
});
export const GENERATORS = [reveal, medium];
