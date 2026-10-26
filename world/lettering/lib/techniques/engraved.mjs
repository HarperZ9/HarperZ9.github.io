// Engraved: the burin follows the letter. The tone of each letter rises toward its edges, so the burin's streamlines
// (techniques/lib/burin.js, Jobard and Lefer spacing over a structure tensor) run parallel to the outline, the way an
// engraver cuts an inline capital. Line width swells with darkness, so the edges read heavy and the centre light.
// A cast shadow below and right of each letter is cross-hatched (the second layer appears only past the shadow
// threshold), and a fine keyline traces the outline so the letter holds at small sizes.
import { engrave, fillStroke } from '../../../techniques/lib/burin.js';
import { smoothstep, canvas, ribbonD, polyD, svgDoc } from '../paint.mjs';
import { bilinear } from '../fields.mjs';
import { revealOut } from '../../../techniques/lib/timing.js';

export const meta = {
  id: 'engraved', title: 'Engraved', renderer: '2d', ground: 'page', weight: 800,
  lineage: 'Copperplate line engraving; banknote lettering; evenly spaced streamlines (Jobard and Lefer, 1997).',
  does: 'Burin hatching runs along the letter\'s own contour field. The shadow is cross-hatched.',
  params: { dsep: 'line spacing, work px, 2 to 8 (default 0.34 x half stroke, at least 2.1)', duration: 'plot time, seconds, 0.8 to 6 (default 2.6, eased on the measured reveal curve)' },
};

// Darkness field: the letter body darkens toward its edge, the cast shadow is flat and dark, the ground is empty.
// part: 'letter' keeps only the body, 'shadow' only the cast shadow (each is engraved in its own pass, so the
// contour hatch never crosses inside a letter and the cross-hatch stays in the shadow).
export function toneField(g, o = {}, part = 'both') {
  const { w, h, sdf } = g, half = g.half, off = o.shadow ?? Math.max(2, half * 0.55), luma = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, d = sdf[i];
    let dark = 0;
    if (d > 0) { if (part !== 'shadow') dark = 0.62 + 0.34 * (1 - smoothstep(0, half * 1.1, d)); }
    else if (part !== 'letter') { const s = bilinear(sdf, w, h, x - off, y - off); if (s > 0.5) dark = 0.8 * smoothstep(0.5, 2, s) * smoothstep(-0.2, -2.2, d); }
    luma[i] = 1 - dark;
  }
  return luma;
}

export async function create(g, env) {
  const dsep = env.opts.dsep ?? Math.max(2.1, g.half * 0.34);
  const body = engrave(toneField(g, {}, 'letter'), g.w, g.h, { dsep, seed: env.seed % 97, baseAngle: -0.62, light: 0.12, shadow: 1.01, maxW: 0.92, gamma: 0.85 }).strokes;
  const shade = engrave(toneField(g, {}, 'shadow'), g.w, g.h, { dsep: dsep * 0.9, seed: (env.seed % 89) + 3, baseAngle: -0.62, light: 0.12, shadow: 0.5, maxW: 0.7, gain: 0 }).strokes;
  const strokes = body.concat(shade);
  // plot order: left to right by each stroke's first point, so the burin crosses the word as a reader does
  strokes.sort((a, b) => a[0] - b[0]);
  const keys = g.loops.map(l => l.pts);
  const ink = env.theme.ink, dur = env.opts.duration ?? 2.6, k = env.k;
  const lay = canvas(g.w * k, g.h * k), lx = lay.getContext('2d'); lx.fillStyle = ink; lx.strokeStyle = ink;
  let drawn = 0, keyed = false, forceDone = false;
  const plotTo = n => { for (; drawn < n; drawn++) { lx.beginPath(); fillStroke(lx, strokes[drawn], k); lx.fill(); } };
  // the keyline is drawn once at setup into its own layer, so the frame that reveals it costs one blit
  const keyLay = canvas(g.w * k, g.h * k), kx = keyLay.getContext('2d'); kx.strokeStyle = ink; kx.lineJoin = 'round';
  kx.lineWidth = Math.max(0.6, g.half * 0.07) * k; kx.beginPath(); for (const p of keys) { kx.moveTo(p[0] * k, p[1] * k); for (let i = 2; i < p.length; i += 2) kx.lineTo(p[i] * k, p[i + 1] * k); kx.closePath(); } kx.stroke();
  const keyline = () => { lx.drawImage(keyLay, 0, 0); keyed = true; };
  return {
    strokes: strokes.length,
    draw(ctx, t) {
      const p = forceDone ? 1 : revealOut(t, 0.1, dur);
      plotTo(Math.round(p * strokes.length));
      if (p >= 1 && !keyed) keyline();
      ctx.clearRect(0, 0, g.w, g.h); ctx.drawImage(lay, 0, 0, g.w, g.h);
      return p < 1 || !keyed;
    },
    finish() { forceDone = true; },
    replay() { forceDone = false; drawn = 0; keyed = false; lx.clearRect(0, 0, lay.width, lay.height); },
    svg() {
      const body = strokes.map(s => { const pts = [], hw = []; for (let i = 0; i < s.length; i += 3) { pts.push(s[i], s[i + 1]); hw.push(s[i + 2] / 2); } return `<path d="${ribbonD(pts, hw)}"/>`; }).join('');
      const key = keys.map(p => polyD(p, true)).join('');
      return svgDoc(g, `<g fill="${ink}">${body}</g><path d="${key}" fill="none" stroke="${ink}" stroke-width="${Math.max(0.6, g.half * 0.07).toFixed(2)}"/>`);
    },
  };
}
