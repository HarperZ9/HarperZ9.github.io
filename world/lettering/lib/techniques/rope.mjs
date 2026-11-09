// Rope: a laid three-strand rope pulled hand over hand along each letter's centre line. The pull is the stepwise
// easing from techniques/lib/rope.js: each pull lands, the grip changes, the rope slips back a little, the last pull
// is tied off. Strokes go in reading order; a stroke already laid is cached, so a frame draws one live stroke.
import { ropeEase, drawRope } from '../../../techniques/lib/rope.js';
import { canvas, mix, svgDoc, polyD } from '../paint.mjs';

export const meta = {
  id: 'rope', title: 'Rope', renderer: '2d', ground: 'page', weight: 600,
  lineage: 'Muybridge\'s intermittent frames (1878); the projector\'s claw; ease-in and ease-out in hand animation.',
  does: 'A three-strand rope is hauled along the stroke path in measured pulls, slipping back at each change of grip.',
  params: { pulls: 'hand-over-hand pulls, 5 to 14 (default total length / 9 half strokes)', duration: 'seconds, 1.6 to 7 (default 1.6 + 0.42 per pull)', radius: 'rope radius, 0.62 x half stroke' },
};

const pairs = pts => { const o = []; for (let i = 0; i < pts.length; i += 2) o.push([pts[i], pts[i + 1]]); return o; };
// Cut a polyline at arc length L.
function cut(pts, L) {
  const out = [pts[0], pts[1]]; let acc = 0;
  for (let i = 2; i < pts.length; i += 2) {
    const l = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    if (acc + l >= L) { const t = (L - acc) / (l || 1); out.push(pts[i - 2] + (pts[i] - pts[i - 2]) * t, pts[i - 1] + (pts[i + 1] - pts[i - 1]) * t); return out; }
    acc += l; out.push(pts[i], pts[i + 1]);
  }
  return out;
}
// A dot (the tittle of an i) becomes a small coil of rope.
const coil = (s, r) => { const cx = (s.pts[0] + s.pts[2]) / 2, cy = (s.pts[1] + s.pts[3]) / 2, o = []; for (let a = 0; a <= Math.PI * 2.05; a += 0.25) o.push(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5); return o; };

export async function create(g, env) {
  const r = Math.max(1.6, g.half * 0.62), ink = env.theme.ink, hi = mix(env.theme.ink, env.theme.dark ? '#000' : '#fff', 0.72);
  const list = g.strokes.map(s => (s.dot ? coil(s, r * 2) : s.pts));
  const lens = list.map(p => { let L = 0; for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return L; });
  const total = lens.reduce((a, b) => a + b, 0) || 1, starts = []; lens.reduce((a, l, i) => (starts[i] = a, a + l), 0);
  const pulls = env.opts.pulls ?? Math.max(5, Math.min(14, Math.round(total / (g.half * 9)))), dur = env.opts.duration ?? Math.min(7, 1.6 + pulls * 0.42);
  const ease = t => ropeEase(t, { pulls, slip: 0.2, reach: 0.34 });
  const k = env.k, lay = canvas(g.w * k, g.h * k), lx = lay.getContext('2d'); lx.setTransform(k, 0, 0, k, 0, 0);
  const guide = canvas(g.w * k, g.h * k), gx = guide.getContext('2d'); gx.setTransform(k, 0, 0, k, 0, 0);
  gx.strokeStyle = ink; gx.globalAlpha = 0.22; gx.lineWidth = Math.max(0.8, r * 0.18); gx.setLineDash([r * 0.35, r * 0.9]); gx.lineCap = 'round';
  for (const p of list) { gx.beginPath(); gx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) gx.lineTo(p[i], p[i + 1]); gx.stroke(); }
  const opt = { radius: r, lay: r * 2.4, ink, highlight: hi };
  let laid = 0, done = false;
  const layTo = n => { for (; laid < n; laid++) drawRope(lx, pairs(list[laid]), opt); };
  return {
    pulls, duration: dur,
    draw(ctx, t) {
      const p = done ? 1 : ease(Math.min(1, t / dur)), L = p * total;
      let cur = 0; while (cur < list.length && starts[cur] + lens[cur] <= L + 1e-6) cur++;
      layTo(cur);
      ctx.clearRect(0, 0, g.w, g.h);
      if (cur < list.length) ctx.drawImage(guide, 0, 0, g.w, g.h);
      ctx.drawImage(lay, 0, 0, g.w, g.h);
      if (cur < list.length) {
        const part = cut(list[cur], L - starts[cur]);
        if (part.length >= 4) { drawRope(ctx, pairs(part), opt); ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(part[part.length - 2], part[part.length - 1], r * 1.25, 0, Math.PI * 2); ctx.fill(); }
      }
      return !done && t < dur + 0.05;
    },
    finish() { done = true; layTo(list.length); },
    replay() { done = false; laid = 0; lx.clearRect(0, 0, g.w, g.h); },
    svg() {
      const body = list.map(p => `<path d="${polyD(p)}"/>`).join('');
      const strands = list.map(p => `<path d="${polyD(p)}" stroke-dasharray="${(r * 1.1).toFixed(1)} ${(r * 1.3).toFixed(1)}"/>`).join('');
      return svgDoc(g, `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="${ink}" stroke-width="${(r * 2.2).toFixed(2)}">${body}</g><g stroke="${hi}" stroke-width="${(r * 0.7).toFixed(2)}" opacity=".6">${strands}</g></g>`);
    },
  };
}
