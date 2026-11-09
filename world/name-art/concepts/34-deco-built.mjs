// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 34 deco-built (v3 of 08): the letters are built from deco's own vocabulary, not cut from a font. The forge's
// centre lines are mapped into polar space around the sun (stems become rays, bars become arcs, curves stay compass
// arcs), and every stroke is raised from them as a stepped setback: three terraces, the ziggurat in section, each
// step edge lit on the side toward the light and shadowed on the other, with an inline groove down the top terrace.
// Behind each letter a black shadow cut, outlined in a gold keyline, is offset away from the sun (the deco shadow
// letter). Around it the burst, the jade sun and the ziggurat terraces of 15. Gold on black, one jade field.
// Sources: deco display lettering (stepped setbacks, inline and shadow cuts, compass-drawn curves), the ziggurat
// as building section, the sunburst (15), the forge skeletons (typeface).
import { setName, NAME } from '../lib/name.mjs';
import { strokesOf, snapJoins, fusedDistance, gradientOf } from '../lib/strokes.mjs';
import { img, lin, clamp, smooth, mix, grain, TAU, bloom, fbm } from '../lib/img.mjs';

export const meta = {
  id: 'deco-built', title: 'Name built in stepped gold', loop: { seconds: 6, fps: 24, crossfade: 0 },
  marriage: 'centre lines mapped onto the sunburst x stepped-setback strokes (the ziggurat in section) x inline groove x shadow cut',
  refs: ['author visual identity: art deco geometry (sunbursts, stepped forms, metallic line)'],
  v1: 'deco-arc',
};

const GOLD_D = lin('#3a2610'), GOLD = lin('#b8873b'), GOLD_L = lin('#f6dfa2');
const gold = s => (s < 0.5 ? GOLD_D.map((v, k) => mix(v, GOLD[k], s * 2)) : GOLD.map((v, k) => mix(v, GOLD_L[k], (s - 0.5) * 2)));

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, I = img(W, H), ink = lin('#08080a'), jade = lin('#1f4a43');
  // flat type, high resolution, tall (the sunburst wants a condensed deco proportion)
  const TW = Math.round(2.5 * W), TH = Math.round(0.17 * W);   // only the centre lines are read, so a modest flat size is enough
  const T = setName(text, TW, TH, { box: [0, 0.12, 1, 0.92], weight: 820, tracking: 80, sy: 1.45 });
  const sp = T.spans, base = sp[0].base, capT = T.capPx;
  const x0 = sp[0].x0, x1 = sp[sp.length - 1].x1, mid = (x0 + x1) / 2, A = (x1 - x0) / capT;
  // fit: the name spans +-SPAN of arc at its mid radius, and its outer edge stays inside the frame
  const SPAN = 1.1, cx = 0.5 * W, cy = 1.2 * H, R0 = 0.74 * H;
  const capO = Math.min(0.3 * H, (2 * SPAN * R0) / (A - 0.9 * SPAN)), Rm = R0 + capO * 0.45, k = capT / capO;
  // the centre lines, carried into polar space: flat x runs along the mid radius, flat y becomes the radius
  const toOut = ([xf, yf]) => { const th = (xf - mid) / (Rm * k), r = R0 + (base - yf) / k; return [cx + r * Math.sin(th), cy - r * Math.cos(th)]; };
  const S = snapJoins(strokesOf(T, Math.max(1, capT / 90)).map(s => ({ ...s, pts: s.pts.map(toOut) })), 0.16 * capO);
  // the dot of an i sits close to its stem in the forge; at this stroke width it would fuse, so lift it along its ray
  for (const st of S) { let L = 0; for (let j = 1; j < st.pts.length; j++) L += Math.hypot(st.pts[j][0] - st.pts[j - 1][0], st.pts[j][1] - st.pts[j - 1][1]);
    if ((st.ch === 'i' || st.ch === 'j') && L < 0.3 * capO) st.pts = st.pts.map(([x, y]) => { const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy); return [x + dx / r * 0.1 * capO, y + dy / r * 0.1 * capO]; }); }
  const half = 0.115 * capO, D = fusedDistance(W, H, S, half * 1.1 + 2, half * 0.12, { caps: 'square' }), { gx, gy } = gradientOf(D, W, H);
  const so = [0.05 * capO, 0.05 * capO], rays = 48, sweep = TAU * t, L = [-0.62, -0.78];
  const Dat = (x, y) => { const xi = Math.round(x), yi = Math.round(y); return xi < 0 || yi < 0 || xi >= W || yi >= H ? Infinity : D[yi * W + xi]; };
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
    // the shadow cut: the letter's own body, offset away from the light, black with a gold keyline
    const dS = Dat(x - so[0], y - so[1]);
    if (dS < half + 1.2 * u) { const key = clamp(1.1 * u - Math.abs(dS - half) + 0.5); c = c.map((v, q) => mix(v * 0.15, gold(0.55)[q] * 0.8, key)); }
    // the letter: three terraces stepping up toward its centre line (the ziggurat in section)
    const d = D[i];
    if (d < half + 1) {
      const cov = clamp(half - d + 0.5), tier = d / half, g = Math.hypot(gx[i], gy[i]) || 1, lit = (gx[i] / g) * L[0] + (gy[i] / g) * L[1];
      const level = tier > 0.66 ? 0 : tier > 0.33 ? 1 : 2;
      let s0 = [0.32, 0.55, 0.8][level] + 0.12 * Math.cos(th * 2.2 - sweep);
      // each step edge catches the light on the side that faces it and falls into shadow on the other
      for (const e of [0.66, 0.33]) { const ed = Math.abs(tier - e) * half; if (ed < 1.4 * u) s0 += (lit > 0 ? 0.35 : -0.4) * clamp(1.4 * u - ed); }
      // the outer wall of the base terrace turns away from the light: a darker band at the very edge
      s0 -= 0.25 * clamp((tier - 0.9) / 0.1) * (lit > 0 ? 0.3 : 1);
      const inline = clamp(0.06 * half + 0.6 * u - d);            // the inline groove down the top terrace
      const gcol = gold(clamp(s0)).map(v => v * (1 - 0.85 * inline) + 0.003);
      c = c.map((v, q) => mix(v, gcol[q], cov));
    }
    I.px.set(c, i * 3);
  }
  bloom(I, { threshold: 0.55, radius: 10 * u, strength: 0.35, tint: [1, 0.85, 0.6] });
  return { image: grain(I, { amount: 1.8, seed: `decobuilt/${t}`, radius: Math.max(1, Math.round(u)) }), text: T.text };
}
