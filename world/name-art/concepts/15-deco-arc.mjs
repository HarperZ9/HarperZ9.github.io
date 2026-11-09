// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 15 deco-arc (v2 of 08): the letters are drawn on the sunburst's own geometry. The name is set flat, then mapped
// into polar space around the sun: a letter's verticals become rays of the burst and its horizontals become arcs
// concentric with the sun, so every stem points at the sun. Inside the letters the gold is reeded along the same
// rays (the burst continues through the type as fine flutes), and outside the name the burst opens into the wide
// rays and the stepped ziggurat terraces that frame the sun. Gold on black, one jade field.
import { setName, NAME, signedDistance } from '../lib/name.mjs';
import { img, lin, clamp, smooth, mix, grain, TAU, bloom, fbm } from '../lib/img.mjs';

export const meta = {
  id: 'deco-arc', title: 'Name on the sunburst', loop: { seconds: 6, fps: 24, crossfade: 0 },
  marriage: 'polar mapping onto the sunburst (stems become rays, bars become arcs) x reeded brushed gold x stepped ziggurat terraces',
  refs: ['author visual identity: art deco geometry (sunbursts, stepped forms, metallic line)'],
  v1: 'deco-sunburst',
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
      const fl = 0.5 + 0.5 * Math.cos(th * flutes), groove = smooth(0.78, 0.98, fl);
      const bevel = clamp(-d / half), s = clamp(0.5 + 0.38 * Math.cos(th * 2.2 - sweep) + 0.2 * (1 - bevel) * Math.sign(dx + 1e-6) * 0.5 + 0.18 * (1 - fl));
      const g = gold(s).map(v => v * (1 - 0.6 * groove * bevel) + 0.003);
      c = c.map((v, q) => mix(v, g[q], fill));
    }
    I.px.set(c, i * 3);
  }
  bloom(I, { threshold: 0.55, radius: 10 * u, strength: 0.35, tint: [1, 0.85, 0.6] });
  return { image: grain(I, { amount: 1.8, seed: `decoarc/${t}`, radius: Math.max(1, Math.round(u)) }), text: T.text };
}
