// Painted: the word laid down with a loaded brush, stroke by stroke in writing order, using the brush engine from
// feed set 23 (build/brush: a float, linear-light surface; bristle tip turned along the stroke; paper grain; wet
// pickup; dithered export, so glazes never band). Pressure swells through each stroke and lifts at its end, the way a
// sign painter's stroke loads and releases. The ground is the engine's own paper.
import { Surface, liveStroke, linear } from '../../../feed-23/build/brush/index.js';
import { canvas, parseColor } from '../paint.mjs';
import { resample } from '../skeleton.mjs';

export const meta = {
  id: 'painted', title: 'Painted', renderer: '2d', ground: 'own', weight: 700,
  lineage: 'Sign painting with a lettering quill; the brush engine built from the feed set 23 favourites.',
  does: 'A bristle brush lays each stroke in writing order, loading and lifting, into paper grain.',
  params: {
    size: 'brush width as a share of the stroke width, 0.6 to 1.6 (default 1.15)',
    flow: 'paint per dab, 0.1 to 1 (default 0.55)',
    speed: 'brush travel in stroke widths per second, 4 to 40 (default 16)',
  },
};

const hex = c => '#' + parseColor(c).map(v => v.toString(16).padStart(2, '0')).join('');

export async function create(g, env) {
  const o = env.opts, k = Math.max(1, env.k), W = Math.round(g.w * k), H = Math.round(g.h * k);
  const S = new Surface(W, H).fill(linear(o.paper ?? '#ece4d2'), linear(o.paper2 ?? '#e4dac4'));
  const size = (g.half * 2 * (o.size ?? 1.15) * k) / W, ink = hex(o.paint ?? (env.theme.dark ? '#1a1612' : env.theme.ink));
  const brush = {
    tip: ['bristle', { seed: env.seed % 31 }], size, spacing: 0.05, flow: o.flow ?? 0.55, aspect: 1.25, angle: 'stroke',
    taper: { start: 0.08, end: 0.22 }, pressure: { size: [0.62, 1], flow: [0.55, 1], gamma: 1.2 },
    grain: { kind: 'paper', period: 0.0047, depth: 0.28 }, wet: { mix: 0.18, pickup: 0.12 },
  };
  // samples per stroke, in device px, with a pressure that loads in, holds, and lifts at the end
  const strokes = g.strokes.map(s => { const P = resample(s.pts, Math.max(1, g.half * 0.35)), n = P.length / 2, out = []; for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) : 0.5; out.push({ x: P[2 * i] * k, y: P[2 * i + 1] * k, p: Math.min(1, 0.55 + u * 3) * (1 - 0.45 * Math.max(0, (u - 0.8) / 0.2)) }); } return out; });
  const view = canvas(W, H), vx = view.getContext('2d');
  const blit = rect => { const r = rect ?? { x0: 0, y0: 0, x1: W - 1, y1: H - 1 }, data = S.toRGBA8({ rect: r, seed: env.seed % 97 }); vx.putImageData(new ImageData(data, r.x1 - r.x0 + 1, r.y1 - r.y0 + 1), r.x0, r.y0); };
  blit();
  const perSec = (o.speed ?? 16) * g.half * 2 / Math.max(1, g.half * 0.35); // samples per second
  let si = 0, pi = 0, live = null, done = false, last = null, acc = 0;
  function paintSome(n) {
    while (n > 0 && si < strokes.length) {
      if (!live) { live = liveStroke(S, brush, { unit: W, seed: env.seed + si, color: ink }); pi = 0; }
      live.add(strokes[si][pi++]); n--;
      if (pi >= strokes[si].length) { live = null; si++; }
    }
    const d = S.takeDirty(); if (d) blit(d);
  }
  return {
    draw(ctx, t) {
      if (!done) {
        const dt = last === null ? 1 / 60 : Math.min(0.1, Math.max(0, t - last)); last = t; acc += dt * perSec;
        const n = Math.floor(acc); acc -= n; paintSome(Math.min(n, 40));
        if (si >= strokes.length) done = true;
      }
      ctx.drawImage(view, 0, 0, g.w, g.h);
      return !done;
    },
    finish() { if (!done) { paintSome(Infinity); done = true; } },
    replay() { S.fill(linear(o.paper ?? '#ece4d2'), linear(o.paper2 ?? '#e4dac4')); blit(); si = 0; pi = 0; live = null; done = false; last = null; acc = 0; },
  };
}
