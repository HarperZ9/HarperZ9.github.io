// orbital-worker.js: runs the physics off the main thread. On 'state' it draws an ensemble from
// |psi(0)|^2, then keeps a short queue of snapshots ahead of the display clock: positions after
// the flow, the colour share per point, the density (it sets the splat size) and the
// enclosure mask. Display time maps to physical time so one beat lasts BEAT seconds on screen.
import { makeState, sampleGrid, advect, snapshot as snapAt } from './orbital.js';
import { rng } from './raster.js';

const BEAT = 7.2, STEP = 0.2, AHEAD = 6;     // seconds per beat (measured from the reference), snapshot spacing, queue
let job = 0, S = null, P = null, k = 0, acked = -1, keep = 0.82, still = false;

function extent(P) { const r = []; for (let i = 0; i < P.length; i += 3) r.push(Math.hypot(P[i], P[i + 1], P[i + 2])); r.sort((a, b) => a - b); return r[Math.floor(0.97 * (r.length - 1))] || 1; }

async function run(my) {
  while (my === job && !still) {
    if (k - acked > AHEAD) { await new Promise(r => setTimeout(r, 30)); continue; }
    const t = k * STEP * S.period / BEAT;
    if (k > 0) {   // substeps keep each midpoint step under 8% of the orbit's natural time n^3
      const dt = STEP * S.period / BEAT, nmax = Math.max(...S.terms.map(q => q.n)), steps = Math.max(1, Math.ceil(dt / (0.08 * nmax ** 3)));
      advect(S, P, (k - 1) * dt, dt, steps, 1e-3);
    }
    const snap = snapAt(S, P, t, keep);
    if (my !== job) return;
    postMessage({ type: 'snap', job: my, k, tau: k * STEP, ...snap }, [snap.pos.buffer, snap.w.buffer, snap.d.buffer, snap.vis.buffer]);
    k++;
    await new Promise(r => setTimeout(r, 0));
  }
}

onmessage = e => {
  const m = e.data;
  if (m.type === 'ack') { if (m.job === job) acked = Math.max(acked, m.k); return; }
  if (m.type !== 'state') return;
  const my = ++job; S = makeState(m.terms); keep = m.keep ?? 0.82; still = !!m.still; k = 0; acked = -1;
  const r = rng(m.seed ?? 24), tau = m.tau ?? 0, t = tau * S.period / BEAT;
  // a fresh draw at t is distributed as the flowed ensemble would be (equivariance), so stills skip the flow
  P = sampleGrid(S, m.count, r, { t });
  const half = sampleGrid(S, 3000, rng(7), { t: t + S.period / 2 });
  postMessage({ type: 'init', job: my, period: S.period, beat: BEAT, step: STEP, extent: Math.max(extent(P), extent(half)) });
  if (still) { const snap = snapAt(S, P, t, keep); postMessage({ type: 'snap', job: my, k: 0, tau, ...snap }, [snap.pos.buffer, snap.w.buffer, snap.d.buffer, snap.vis.buffer]); return; }
  run(my);
};
