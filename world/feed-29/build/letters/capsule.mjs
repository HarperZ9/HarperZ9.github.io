// letters/capsule.mjs: a lettering technique from feed set 29's gradient-field posters. Each centre-line stroke of
// the word is cut into pills (capsules) of about 3.6 stroke-halves, with small gaps; each pill carries a short stretch
// of a spectral or thin-film ramp along its own axis, and the word as a whole walks the ramp in reading order. A soft
// drop shadow and clumped grain finish it, as on the posters. The reveal grows each pill from its start along the
// stroke on the measured ease-out, one after another in reading order.
//
// Registered from outside the lettering folder (registerTechnique), so the library is not edited:
//   import { registerTechnique, letter } from '../../../lettering/lib/letter.mjs';
//   registerTechnique('capsule', () => import('./capsule.mjs'));
//   await letter('Spectra', 'capsule', { seed: 3 }).mount(h1);
import { makeRamp } from '../gradfield.mjs';
import { rampLUT, lutAt, toSrgb } from '../lib/color.mjs';
import { rng, grain, clamp, cover } from '../lib/field.mjs';

export const meta = {
  id: 'capsule', title: 'Capsule', renderer: '2d', ground: 'page', weight: 800,
  lineage: 'Feed set 29 gradient-field posters (capsule columns); thin-film and spectral ramps from feed-29/build/lib/color.mjs.',
  does: 'The word is laid as a chain of glossy pills along its centre lines, each a short stretch of a spectral ramp; the word walks the ramp in reading order.',
  params: { palette: 'spectral, film or ink (default spectral)', pill: 'pill length in stroke halves, 1.6 to 6 (default 3.6)', gap: 'gap in stroke halves, 0 to 1 (default 0.3)', grain: 'code values of mono grain, 0 to 10 (default 4)' },
};

// Cut each stroke into pills: { ax, ay, bx, by, r, u } with u the reading-order position (0..1) of the pill's start.
export function pills(g, { pill = 3.6, gap = 0.3 } = {}) {
  const out = [], r = g.half * 0.95, L = pill * g.half, G = gap * g.half, total = g.total || 1;
  for (const s of g.strokes) {
    const P = s.pts;
    if (s.dot || P.length < 4) { const x = P[0], y = P[1]; out.push({ ax: x, ay: y, bx: x, by: y, r: r * 1.05, u: s.start / total }); continue; }
    // arc-length table of the polyline
    const acc = [0]; for (let i = 2; i < P.length; i += 2) acc.push(acc[acc.length - 1] + Math.hypot(P[i] - P[i - 2], P[i + 1] - P[i - 1]));
    const len = acc[acc.length - 1], n = Math.max(1, Math.round((len + G) / (L + G))), step = (len + G) / n, seg = step - G;
    const at = d => { let i = 1; while (i < acc.length - 1 && acc[i] < d) i++; const t = (d - acc[i - 1]) / ((acc[i] - acc[i - 1]) || 1); return [P[2 * i - 2] + (P[2 * i] - P[2 * i - 2]) * t, P[2 * i - 1] + (P[2 * i + 1] - P[2 * i - 1]) * t]; };
    for (let k = 0; k < n; k++) {
      const d0 = k * step + Math.min(r, seg / 2), d1 = k * step + Math.max(seg - r, seg / 2), A = at(Math.min(len, d0)), B = at(Math.min(len, d1));
      out.push({ ax: A[0], ay: A[1], bx: B[0], by: B[1], r, u: (s.start + k * step) / total });
    }
  }
  return out;
}

const easeOutQuad = x => 1 - (1 - x) * (1 - x);
const segDist = (x, y, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? clamp(((x - ax) * dx + (y - ay) * dy) / L) : 0; return [Math.hypot(x - ax - t * dx, y - ay - t * dy), t]; };

// Render at scale k (device px per glyph px) at reveal time t (s; Infinity = finished). Returns straight-alpha RGBA 8-bit.
export function render(g, { k = 1, t = Infinity, seed = 1, palette = 'spectral', pill = 3.6, gap = 0.3, grainSd = 4, duration = 1.4 } = {}) {
  const W = Math.max(1, Math.round(g.w * k)), H = Math.max(1, Math.round(g.h * k)), P = pills(g, { pill, gap }), lut = rampLUT(makeRamp(palette, rng(`capsule:${seed}`)));
  const col = new Float32Array(W * H * 3), alpha = new Float32Array(W * H), shade = new Float32Array(W * H), c3 = [0, 0, 0], n = P.length;
  const order = P.map((p, i) => [p.u, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i), rank = new Int32Array(n); order.forEach((i, j) => { rank[i] = j; });
  const grow = i => (t === Infinity ? 1 : easeOutQuad(clamp((t - 0.05 - rank[i] / Math.max(1, n) * duration * 0.75) / 0.32)));
  // shadows first (offset down and right, soft), then the pills in reading order so later pills sit on earlier ones
  for (const pass of [0, 1]) for (const i of order) {
    const p = P[i], gr = grow(i); if (gr <= 0) continue;
    const ax = p.ax * k, ay = p.ay * k, bx = (p.ax + (p.bx - p.ax) * gr) * k, by = (p.ay + (p.by - p.ay) * gr) * k, r = p.r * k * (0.7 + 0.3 * gr);
    const off = pass ? 0 : r * 0.28, soft = pass ? 0 : r * 0.7, pad = r + soft + off + 2;
    for (let y = Math.max(0, Math.floor(Math.min(ay, by) - pad)); y < Math.min(H, Math.ceil(Math.max(ay, by) + pad)); y++) for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - pad)); x < Math.min(W, Math.ceil(Math.max(ax, bx) + pad)); x++) {
      const [d, along] = segDist(x + 0.5 - off * 0.4, y + 0.5 - off, ax, ay, bx, by), a = cover(d - r, soft); if (a <= 0) continue; const q = y * W + x;
      if (!pass) { shade[q] = Math.max(shade[q], a * 0.28); continue; }
      const across = clamp(d / r), lit = 0.8 + 0.12 * Math.sqrt(1 - across * across) + 0.08 * Math.exp(-(((across - 0.45) / 0.15) ** 2)) * (y + 0.5 < ay + (by - ay) * along ? 1 : 0.3);
      lutAt(lut, clamp(p.u * 0.72 + along * 0.26), c3);
      for (let c = 0; c < 3; c++) col[3 * q + c] += (c3[c] * lit - col[3 * q + c]) * a;
      alpha[q] += (1 - alpha[q]) * a;
    }
  }
  const G = grainSd > 0 ? grain(W, H, { seed: `capsule:${seed}:grain` }) : null, out = new Uint8ClampedArray(W * H * 4);
  for (let q = 0; q < W * H; q++) {
    const a = alpha[q], sh = shade[q] * (1 - a), A = a + sh; if (A <= 0) continue;
    const gn = G ? G[q] * grainSd / 255 : 0;
    for (let c = 0; c < 3; c++) out[4 * q + c] = Math.round(clamp(toSrgb(Math.max(0, col[3 * q + c] / Math.max(a, 1e-6))) + gn, 0, 0.985) * 255 * (a / A)); // shadow is black; highlights stop one step short of 255 (R6)
    out[4 * q + 3] = Math.round(A * 255);
  }
  return { w: W, h: H, rgba: out, pills: P, alpha };
}

// In the page: the finished word is rendered once; the reveal clips it to the grown pills (round-capped lines on the
// canvas, a GPU path), so no frame re-renders pixels (QUALITY-SPEC M1).
export async function create(g, env) {
  const o = env.opts, dur = o.duration ?? 1.4, R = render(g, { k: env.k, seed: env.seed, palette: o.palette ?? 'spectral', pill: o.pill, gap: o.gap, grainSd: o.grain ?? 4, duration: dur });
  const off = new OffscreenCanvas(R.w, R.h); off.getContext('2d').putImageData(new ImageData(R.rgba, R.w, R.h), 0, 0);
  const P = R.pills, n = P.length, order = P.map((p, i) => [p.u, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  let done = false;
  const draw = (ctx, t) => {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!done) {
      const k = env.k; ctx.beginPath(); ctx.lineCap = 'round';
      order.forEach((i, j) => { const gr = easeOutQuad(clamp((t - 0.05 - j / Math.max(1, n) * dur * 0.75) / 0.32)); if (gr <= 0) return; const p = P[i]; ctx.moveTo(p.ax * k, p.ay * k); ctx.lineTo((p.ax + (p.bx - p.ax) * gr) * k + 0.01, (p.ay + (p.by - p.ay) * gr) * k); });
      ctx.lineWidth = (P[0]?.r ?? 1) * k * 2.9; ctx.strokeStyle = '#000'; ctx.globalCompositeOperation = 'source-over'; ctx.stroke(); ctx.globalCompositeOperation = 'source-in';
    }
    ctx.drawImage(off, 0, 0); ctx.restore();
    return !done && t < dur + 0.5;
  };
  return { draw, finish() { done = true; }, replay() { done = false; } };
}
