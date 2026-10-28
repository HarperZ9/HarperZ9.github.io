// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 37 deco-motif (v3 of 08): deco-arc's composition, with every letter built from the deco motif grammar instead of
// one reeded fill (the reviewer's "stock grotesk bent on an arc"). The forge's centre lines, carried into the
// same polar space, sort each stroke into a motif by its shape:
//   - stems (straight, along a ray): AIRCRAFT FIN. Reeded along the stroke, and where the stem's outer end is free
//     it steps back in three setbacks, the Chrysler crown's terraced fins.
//   - bowls and curves: FAN and SCALLOP. Ribs radiate from the curve's own centre, so each bowl is an open fan.
//   - bars (straight, across the rays): CHEVRON. V-shaped grooves running along the bar.
//   - dots: a SUNBURST disc, rays from its own centre.
// Around it the burst, the jade sun and the ziggurat terraces of 15. Gold on black, one jade field.
// Sources: the art deco motif sets in @gietzschean's threads (fan, sunburst, scallop, chevron, aircraft fin;
// studies st-gietzschean-2114319571024781545 and -2114412957287202832), the Chrysler crown, 15 deco-arc.
import { setName, NAME, signedDistance } from '../lib/name.mjs';
import { strokesOf } from '../lib/strokes.mjs';
import { nearestFrame, shapeOf, arcCentre } from '../lib/frame.mjs';
import { img, lin, clamp, smooth, mix, grain, TAU, bloom, fbm } from '../lib/img.mjs';

export const meta = {
  id: 'deco-motif', title: 'Name built from deco motifs', loop: { seconds: 6, fps: 24, crossfade: 0 },
  marriage: 'polar mapping onto the sunburst x strokes sorted into deco motifs (fin, fan, chevron, sunburst) x stepped fin terminals',
  refs: ['library studies st-gietzschean (art deco motif sets)', 'author visual identity: art deco geometry'],
  v1: 'deco-arc',
};

const GOLD_D = lin('#3a2610'), GOLD = lin('#b8873b'), GOLD_L = lin('#f6dfa2');
const gold = s => (s < 0.5 ? GOLD_D.map((v, k) => mix(v, GOLD[k], s * 2)) : GOLD.map((v, k) => mix(v, GOLD_L[k], (s - 0.5) * 2)));

// The flat name, sampled bilinearly.
function sampler(T) {
  const { w, h, mask } = T;
  return (x, y) => {
    if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) return 0;
    const x0 = x | 0, y0 = y | 0, u = x - x0, v = y - y0, i = y0 * w + x0;
    return (mask[i] * (1 - u) + mask[i + 1] * u) * (1 - v) + (mask[i + w] * (1 - u) + mask[i + w + 1] * u) * v;
  };
}

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, I = img(W, H), ink = lin('#08080a'), jade = lin('#1f4a43');
  // flat type, high resolution, tall (the sunburst wants a condensed deco proportion)
  const TW = Math.round(5 * W), TH = Math.round(0.34 * W);
  const T = setName(text, TW, TH, { box: [0, 0.12, 1, 0.92], weight: 820, tracking: 80, sy: 1.45 });
  const sp = T.spans, base = sp[0].base, capT = T.capPx, f = sampler(T);
  const x0 = sp[0].x0, x1 = sp[sp.length - 1].x1, mid = (x0 + x1) / 2, A = (x1 - x0) / capT;
  // fit: the name spans +-SPAN of arc at its mid radius, and its outer edge stays inside the frame
  const SPAN = 1.1, cx = 0.5 * W, cy = 1.2 * H, R0 = 0.74 * H;
  const capO = Math.min(0.3 * H, (2 * SPAN * R0) / (A - 0.9 * SPAN)), Rm = R0 + capO * 0.45, k = capT / capO;
  // polar warp: theta from vertical maps to text x along the mid radius, radius maps to text y
  const mask = new Float32Array(W * H), rays = 48, flutes = 420, sweep = TAU * t;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy), th = Math.atan2(dx, -dy);
    mask[y * W + x] = f(mid + th * Rm * k, base - (r - R0) * k);
  }
  // the centre lines in the same polar space, each sorted into a motif by its shape
  const toOut = ([xf, yf]) => { const th = (xf - mid) / (Rm * k), r = R0 + (base - yf) / k; return [cx + r * Math.sin(th), cy - r * Math.cos(th)]; };
  const S = strokesOf(T, Math.max(1, capT / 120)).map(s => ({ ...s, pts: s.pts.map(toOut) }));
  const hw = 0.12 * capO, band = 0.075 * capO;
  for (const st of S) {
    const { length, curvature } = shapeOf(st.pts), P = st.pts, a = P[0], b = P[P.length - 1];
    const dir = [b[0] - a[0], b[1] - a[1]], dl = Math.hypot(...dir) || 1, m = P[P.length >> 1], rad = [m[0] - cx, m[1] - cy], rl = Math.hypot(...rad) || 1;
    const radial = Math.abs((dir[0] * rad[0] + dir[1] * rad[1]) / (dl * rl));
    st.motif = length < 0.3 * capO ? 'dot' : curvature * capO > 1.6 ? 'fan' : radial > 0.7 ? 'fin' : 'chevron';
    st.centre = st.motif === 'fan' ? arcCentre(P) : st.motif === 'dot' ? m : null;
    st.length = length;
    // a fin steps back only at a free outer end: the end farther from the sun, touching no other stroke of its letter
    if (st.motif === 'fin') {
      const ra = Math.hypot(a[0] - cx, a[1] - cy), rb = Math.hypot(b[0] - cx, b[1] - cy), outer = rb > ra ? 1 : 0, E = outer ? b : a;
      const free = !S.some(o => o !== st && o.glyph === st.glyph && o.pts.some(p => Math.hypot(p[0] - E[0], p[1] - E[1]) < 1.6 * hw));
      st.step = free ? outer : -1;
    }
  }
  const FR = nearestFrame(W, H, S, 0.4 * capO);
  // the stepped setbacks: near a fin's free outer end, the allowed half width shrinks in three steps
  for (let i = 0; i < W * H; i++) {
    const kk = FR.id[i]; if (kk < 0 || mask[i] <= 0) continue; const st = S[kk]; if (st.motif !== 'fin' || st.step < 0) continue;
    const e = st.step ? st.length - FR.s[i] : FR.s[i]; if (e > 2 * band) continue;
    const allow = hw * (e < band ? 0.42 : 0.7) + 0.5;
    mask[i] *= Math.max(0, Math.min(1, allow - Math.abs(FR.t[i])));
  }
  const sdf = signedDistance(mask, W, H), half = 0.065 * capO;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy), th = Math.atan2(dx, -dy);
    let c = ink.map(v => v * (0.9 + 0.2 * fbm(x / (200 * u), y / (200 * u), 5, 3)));
    // the sun: a jade disc with fine gold rings stepping inward
    const sunR = R0 - 0.12 * H, disc = smooth(sunR + u, sunR - u, r);
    c = c.map((v, q) => mix(v, jade[q] * (0.55 + 0.6 * (1 - r / sunR)), disc));
    const ringK = r / sunR * 7, ringF = Math.abs(ringK - Math.round(ringK)) * (sunR / 7);
    if (disc > 0 && ringK > 0.5) c = c.map((v, q) => mix(v, gold(0.6)[q] * 0.8, clamp(0.9 * u - ringF + 0.5) * disc));
    // the band that carries the name: a gold rule on each side of it, concentric with the sun
    for (const rr of [R0 - 0.03 * H, R0 + capO + 0.03 * H]) { const a = clamp(1.1 * u - Math.abs(r - rr) + 0.5); if (a > 0) c = c.map((v, q) => mix(v, gold(0.72)[q], a)); }
    // stepped ziggurat terraces: concentric stepped outlines beyond the name band
    let sdz = Infinity;
    for (let s = 0; s < 4; s++) { const hw = (0.48 - 0.06 * s) * W, top = (0.2 - 0.048 * s) * H; sdz = Math.min(sdz, Math.max(Math.abs(dx) - hw, top - (y + 0.5))); }
    const rule = Math.max(clamp(1.1 * u - Math.abs(sdz) + 0.5), clamp(0.7 * u - Math.abs(sdz + 0.014 * H) + 0.5));
    if (rule > 0) { const sh = 0.55 + 0.4 * Math.cos((y + 0.5) / H * 6 - sweep); c = c.map((v, q) => mix(v, gold(sh)[q] * 0.95, rule)); }
    // the burst beyond the band: alternating wide and fine rays inside the terraces
    const a = ((th / TAU) * rays % 1 + 1) % 1, kk = Math.floor((th / TAU) * rays + rays) % 2, wr = kk ? 0.12 : 0.04;
    const ray = clamp(wr * TAU * r / rays - Math.abs(a - 0.5) * (TAU * r / rays) + 0.5) * smooth(R0 + capO + 0.04 * H, R0 + capO + 0.07 * H, r) * smooth(-0.02 * H, -0.03 * H, sdz);
    if (ray > 0) { const s = 0.45 + 0.4 * Math.cos(th * 3 - sweep) * (kk ? 1 : 0.6); c = c.map((v, q) => mix(v, gold(clamp(s))[q] * 0.7, ray)); }
    // the name: gold reeded along the sun's rays; flutes are grooves on the burst's own angles
    const d = sdf[i], fill = mask[i];
    const halo = clamp(1 - Math.abs(d - 2.6 * u) / (1.1 * u)); if (halo > 0) c = c.map(v => v * (1 - 0.9 * halo));
    if (fill > 0) {
      // the motif decides the grooves: fin flutes along the stroke, fan ribs from the bowl's centre, chevrons along a
      // bar, a sunburst on a dot; pixels no stroke claims keep the burst's own flutes
      const kk = FR.id[i], st = kk >= 0 ? S[kk] : null; let fl;
      if (!st) fl = 0.5 + 0.5 * Math.cos(th * flutes);
      else if (st.motif === 'fin') fl = 0.5 + 0.5 * Math.cos(FR.t[i] / (0.034 * capO) * TAU);
      else if (st.motif === 'chevron') fl = 0.5 + 0.5 * Math.cos((FR.s[i] + 0.9 * Math.abs(FR.t[i])) / (0.07 * capO) * TAU);
      else if (st.centre) { const an = Math.atan2(y + 0.5 - st.centre[1], x + 0.5 - st.centre[0]); fl = 0.5 + 0.5 * Math.cos(an * (st.motif === 'dot' ? 16 : 22)); }
      else fl = 0.5 + 0.5 * Math.cos(th * flutes);
      const groove = smooth(0.8, 0.98, fl);
      const bevel = clamp(-d / half), s = clamp(0.5 + 0.38 * Math.cos(th * 2.2 - sweep) + 0.2 * (1 - bevel) * Math.sign(dx + 1e-6) * 0.5 + 0.18 * (1 - fl));
      const g = gold(s).map(v => v * (1 - 0.6 * groove * bevel) + 0.003);
      c = c.map((v, q) => mix(v, g[q], fill));
    }
    I.px.set(c, i * 3);
  }
  bloom(I, { threshold: 0.55, radius: 10 * u, strength: 0.35, tint: [1, 0.85, 0.6] });
  return { image: grain(I, { amount: 1.8, seed: `decomotif/${t}`, radius: Math.max(1, Math.round(u)) }), text: T.text };
}
