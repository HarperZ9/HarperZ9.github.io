// Swarm: chains crawl in from the edges of the frame and lie down along the letters. Each chain is a run of
// particles held at fixed spacing (position-based dynamics, Muller and others, 2007); its head seeks the start of a
// piece of a stroke, then travels along it, and the body follows by its constraints until it lies on the letter.
// Heads keep apart by a boids separation term (Reynolds, 1987). A dot becomes a coiled chain. The pointer scatters
// the chains near it; they crawl back. A fixed 60 Hz step keeps it deterministic under a seed.
import { rng, svgDoc, ribbonD, mix } from '../paint.mjs';
import { resample } from '../skeleton.mjs';

export const meta = {
  id: 'swarm', title: 'Swarm', renderer: '2d', ground: 'page', weight: 700,
  lineage: 'Reynolds\'s boids (1987); position-based dynamics (Muller and others, 2007); the chain swarm in feed set 20.',
  does: 'Chains crawl in from outside and coil into the word along its strokes.',
  params: { link: 'link length, work px, 1.6 and up (default 0.55 x half stroke)', links: 'particles per chain, 8 to 40 (default 16)', step: 'fixed simulation step, 1/60 s' },
};

// Split the word's strokes into chain-length pieces of evenly spaced target points.
export function pieces(g, link, links) {
  const out = [];
  for (const s of g.strokes) {
    if (s.dot) { const cx = (s.pts[0] + s.pts[2]) / 2, cy = (s.pts[1] + s.pts[3]) / 2, p = []; for (let i = 0; i < links; i++) { const a = i * 0.9, r = g.half * 0.95 * (1 - i / links); p.push(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55); } out.push(p); continue; }
    const P = resample(s.pts, link), n = P.length / 2;
    for (let a = 0; a < n - 1; a += links - 1) { const b = Math.min(n, a + links); if (b - a >= 3) out.push(P.slice(a * 2, b * 2)); }
  }
  return out;
}

export async function create(g, env) {
  const link = env.opts.link ?? Math.max(1.6, g.half * 0.55), links = env.opts.links ?? 16;
  const T = pieces(g, link, links), C = T.length, wHead = g.half * 0.98, wTail = g.half * 0.62;
  const spawn = () => { const R = rng(env.seed); return T.map((tp, ci) => {
    const n = tp.length / 2, side = R(), sx = side < 0.4 ? -g.half * 4 : side < 0.8 ? g.w + g.half * 4 : R() * g.w, sy = side < 0.8 ? R() * g.h : g.h + g.half * 4;
    const ang = Math.atan2(sy - tp[1], sx - tp[0]), x = new Float32Array(n), y = new Float32Array(n);
    for (let i = 0; i < n; i++) { x[i] = sx + Math.cos(ang) * i * link; y[i] = sy + Math.sin(ang) * i * link; }
    // targets are stored head first: the head lands on the far end of the piece, the tail on the near end
    const tx = new Float32Array(n), ty = new Float32Array(n); for (let i = 0; i < n; i++) { tx[i] = tp[2 * (n - 1 - i)]; ty[i] = tp[2 * (n - 1 - i) + 1]; }
    return { n, x, y, px: x.slice(), py: y.slice(), tx, ty, s: -1, delay: (ci / Math.max(1, C)) * 1.1 + R() * 0.5, wander: R() * 6.28 };
  }); };
  let chains = spawn();
  const step = 1 / 60, speed = link * 9, ptr = { x: 0, y: 0, on: false };
  let simT = 0, settledFor = 0, forced = false;
  function sim() {
    simT += step; let maxErr = 0;
    for (const c of chains) {
      const { x, y, px, py, n } = c;
      for (let i = 0; i < n; i++) { const vx = (x[i] - px[i]) * 0.9, vy = (y[i] - py[i]) * 0.9; px[i] = x[i]; py[i] = y[i]; x[i] += vx; y[i] += vy; }
      // head: crawl to the path's tail-end target, then run along the targets toward the head target
      if (simT > c.delay) {
        if (c.s < 0) { const ex = c.tx[n - 1] - x[0], ey = c.ty[n - 1] - y[0], d = Math.hypot(ex, ey); c.wander += 0.09; const wx = Math.cos(c.wander) * 0.35, wy = Math.sin(c.wander) * 0.35; const v = Math.min(d, speed * step * 1.6); x[0] += (ex / (d || 1) + wx) * v; y[0] += (ey / (d || 1) + wy) * v; if (d < link) c.s = 0; }
        else c.s = Math.min(n - 1, c.s + speed * step / link);
      }
      if (c.s >= 0) {
        // along the path: the head sits at target index n-1-s; settled particles are pulled onto their targets
        const hs = Math.max(0, n - 1 - c.s), i0 = Math.floor(hs), f = hs - i0, i1 = Math.min(n - 1, i0 + 1);
        const hx = c.tx[i0] + (c.tx[i1] - c.tx[i0]) * f, hy = c.ty[i0] + (c.ty[i1] - c.ty[i0]) * f;
        x[0] += (hx - x[0]) * 0.5; y[0] += (hy - y[0]) * 0.5;
        if (c.s >= n - 1) for (let i = 1; i < n; i++) { x[i] += (c.tx[i] - x[i]) * 0.12; y[i] += (c.ty[i] - y[i]) * 0.12; maxErr = Math.max(maxErr, Math.abs(c.tx[i] - x[i]) + Math.abs(c.ty[i] - y[i])); }
        else maxErr = Infinity;
      } else maxErr = Infinity;
      if (ptr.on) for (let i = 0; i < n; i++) { const dx = x[i] - ptr.x, dy = y[i] - ptr.y, d = Math.hypot(dx, dy), r = g.half * 5; if (d < r && d > 0.01) { const push = (1 - d / r) * g.half * 0.5; x[i] += (dx / d) * push; y[i] += (dy / d) * push; maxErr = Infinity; } }
      // distance constraints; the head is driven, so the first link moves only its second particle
      for (let it = 0; it < 3; it++) for (let i = 1; i < n; i++) {
        const dx = x[i] - x[i - 1], dy = y[i] - y[i - 1], d = Math.hypot(dx, dy) || 1e-6, e = (d - link) / d;
        if (i === 1) { x[i] -= dx * e; y[i] -= dy * e; } else { x[i - 1] += dx * e * 0.5; y[i - 1] += dy * e * 0.5; x[i] -= dx * e * 0.5; y[i] -= dy * e * 0.5; }
      }
    }
    // separation between heads still crawling
    for (let a = 0; a < C; a++) { const A = chains[a]; if (A.s >= 0) continue; for (let b = a + 1; b < C; b++) { const B = chains[b]; if (B.s >= 0) continue; const dx = A.x[0] - B.x[0], dy = A.y[0] - B.y[0], d = Math.hypot(dx, dy), r = g.half * 2.2; if (d < r && d > 0.01) { const m = (r - d) / d * 0.25; A.x[0] += dx * m; A.y[0] += dy * m; B.x[0] -= dx * m; B.y[0] -= dy * m; } } }
    return maxErr;
  }
  const hw = new Float32Array(links); for (let i = 0; i < links; i++) hw[i] = wHead + (wTail - wHead) * (i / (links - 1));
  const ink = env.theme.ink, rim = mix(ink, env.theme.dark ? '#000000' : '#ffffff', 0.3);
  function paint(ctx) {
    ctx.clearRect(0, 0, g.w, g.h);
    // one fill per chain: chains run in different directions, and a shared path would cancel where they overlap
    ctx.fillStyle = ink;
    for (const c of chains) { const p = []; for (let i = 0; i < c.n; i++) p.push(c.x[i], c.y[i]); ctx.beginPath(); ribbonPath(ctx, p, hw); ctx.fill(); ctx.beginPath(); ctx.arc(p[0], p[1], hw[0], 0, Math.PI * 2); ctx.fill(); }  // the head cap is its own fill: a shared path with opposite winding would punch a hole
    ctx.strokeStyle = rim; ctx.lineWidth = Math.max(0.6, g.half * 0.14); ctx.lineCap = 'round'; ctx.globalAlpha = 0.5; ctx.beginPath();
    for (const c of chains) { const o = -g.half * 0.32; for (let i = 0; i < c.n - 2; i++) { const dx = c.x[i + 1] - c.x[i], dy = c.y[i + 1] - c.y[i], l = Math.hypot(dx, dy) || 1, X = c.x[i] + (dy / l) * o, Y = c.y[i] - (dx / l) * o; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  function snap() { for (const c of chains) { c.s = c.n - 1; for (let i = 0; i < c.n; i++) { c.x[i] = c.px[i] = c.tx[i]; c.y[i] = c.py[i] = c.ty[i]; } } }
  let last = null, acc = 0;
  return {
    chains: C,
    draw(ctx, t) {
      if (forced) { paint(ctx); return ptr.on; }
      const dt = last === null ? step : Math.min(0.1, Math.max(0, t - last)); last = t; acc += dt;
      let err = 0, steps = 0; while (acc >= step && steps < 4) { err = sim(); acc -= step; steps++; }
      if (err < 0.15 * chains.length) settledFor += dt; else settledFor = 0;
      if (settledFor > 0.4 && !ptr.on) { snap(); forced = true; }
      paint(ctx);
      return !forced;
    },
    pointer(x, y, on) { ptr.x = x; ptr.y = y; ptr.on = on; if (on && forced) { forced = false; settledFor = 0; } },
    finish() { snap(); forced = true; },
    replay() { chains = spawn(); forced = false; simT = 0; settledFor = 0; last = null; acc = 0; },
    svg() { snap(); return svgDoc(g, `<g fill="${ink}">${chains.map(c => { const p = []; for (let i = 0; i < c.n; i++) p.push(c.x[i], c.y[i]); return `<path d="${ribbonD(p, Array.from(hw.slice(0, c.n)))}"/>`; }).join('')}</g>`); },
  };
}

// The ribbon of one chain added to the current path, head wide, tail narrow.
function ribbonPath(ctx, p, hw) {
  const n = p.length / 2; if (n < 2) return; const L = [], R = [];
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = p[2 * b] - p[2 * a], dy = p[2 * b + 1] - p[2 * a + 1], l = Math.hypot(dx, dy) || 1, w = hw[Math.min(hw.length - 1, i)]; L.push(p[2 * i] - (dy / l) * w, p[2 * i + 1] + (dx / l) * w); R.push(p[2 * i] + (dy / l) * w, p[2 * i + 1] - (dx / l) * w); }
  ctx.moveTo(L[0], L[1]); for (let i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1]); for (let i = R.length - 2; i >= 0; i -= 2) ctx.lineTo(R[i], R[i + 1]); ctx.closePath();
}
