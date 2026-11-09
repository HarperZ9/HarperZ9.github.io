// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 08 deco-sunburst: the name as an art deco marquee. Accession Display is stretched tall (1.7) and tracked
// wide; each letter is cast in gold with a dark inline cut along its own distance field. Behind it a sunburst
// of 64 rays rises from below the frame, framed by stepped ziggurat arches. Metal is shaded anisotropically:
// the sheen of each ray and step follows its direction, as brushed gold would. Gold on black, one jade field.
import { setName, NAME } from '../lib/name.mjs';
import { img, lin, clamp, smooth, mix, grain, TAU, bloom, fbm } from '../lib/img.mjs';

export const meta = {
  id: 'deco-sunburst', title: 'Art deco sunburst', loop: { seconds: 6, fps: 24, crossfade: 0 },
  marriage: 'deco sunburst and stepped ziggurat x anisotropic brushed-gold shading x inline cut from the letter distance field x Accession Display 300',
  refs: ['author visual identity: art deco geometry (sunbursts, stepped forms, metallic line)'],
};

const GOLD_D = lin('#3a2610'), GOLD = lin('#b8873b'), GOLD_L = lin('#f6dfa2');
const gold = s => (s < 0.5 ? GOLD_D.map((v, k) => mix(v, GOLD[k], s * 2)) : GOLD.map((v, k) => mix(v, GOLD_L[k], (s - 0.5) * 2)));

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, I = img(W, H), ink = lin('#09090a'), jade = lin('#1f4a43');
  const N = setName(text, W, H, { box: [0.14, 0.43, 0.86, 0.69], weight: 720, tracking: 90, sy: 1.65, sdf: true });
  const cx = 0.5 * W, cy = 1.08 * H, rays = 48, sweep = TAU * t;   // the light that crosses the metal over the loop
  const stroke = N.capPx * 0.034;    // half stroke of the letter, about
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    let c = ink;
    // the jade field: a rising half-disc behind the burst
    const disc = smooth(0.6 * H + u, 0.6 * H - u, r);
    c = c.map((v, k) => mix(v, jade[k] * (0.6 + 0.5 * (1 - r / (0.62 * H))), disc));
    // the risen sun's face: fine gold rings stepping inward, deco style
    const ringK = r / (0.6 * H) * 9, ringF = Math.abs(ringK - Math.round(ringK)) * (0.6 * H / 9);
    if (disc > 0 && ringK > 0.5) c = c.map((v, q) => mix(v, gold(0.62)[q] * 0.8, clamp(0.9 * u - ringF + 0.5) * disc));
    // the stepped ziggurat: a union of four rectangles rising to the centre, drawn as a double gold rule
    let sdz = Infinity;
    for (let k = 0; k < 4; k++) {
      const hw = (0.45 - 0.055 * k) * W, top = (0.27 - 0.065 * k) * H, ax = Math.abs(x + 0.5 - cx) - hw, ay = top - (y + 0.5);
      sdz = Math.min(sdz, Math.max(ax, ay));
    }
    // sunburst rays: alternating wide and fine wedges between r0 and r1
    const a = ((th / TAU) * rays % 1 + 1) % 1, k = Math.floor((th / TAU) * rays + rays) % 2;
    const half = k ? 0.13 : 0.045, edge = Math.abs(a - 0.5) * (TAU * r / rays);
    const rayCov = clamp((half * TAU * r / rays) - edge + 0.5) * smooth(0.62 * H, 0.64 * H, r) * smooth(1.25 * H, 1.1 * H, r) * smooth(-0.022 * H, -0.03 * H, sdz);
    if (rayCov > 0) { const s = 0.5 + 0.42 * Math.cos(th * 3 - sweep) * (k ? 1 : 0.6) + 0.1 * fbm(r / (3 * u), th * 40, 3, 2); c = c.map((v, q) => mix(v, gold(clamp(s))[q] * 0.75, rayCov)); }
    const rule = Math.max(clamp(1.1 * u - Math.abs(sdz) + 0.5), clamp(0.7 * u - Math.abs(sdz + 0.016 * H) + 0.5));
    if (rule > 0) { const sh = 0.55 + 0.4 * Math.cos((y + 0.5) / H * 6 - sweep); c = c.map((v, q) => mix(v, gold(sh)[q] * 0.95, rule)); }
    // the marquee plaque: rays stop at a black band that carries the name, ruled above and below
    const pt = N.spans[0].top - 0.09 * H, pb = N.spans[0].base + 0.11 * H;
    if (y > pt && y < pb && sdz < -0.03 * H) c = ink.map(v => v * 0.6);
    if ((Math.abs(y - pt) < 1.0 * u || Math.abs(y - pb) < 1.0 * u) && sdz < -0.03 * H) c = gold(0.7);
    // the name: gold, with an inline cut down the middle of each stroke and a fine black keyline outside
    const d = N.sdf[i];
    const fillA = clamp(0.5 - d), inline = clamp(1 - Math.abs(d + stroke) / (0.18 * stroke + 0.5)) * smooth(-0.4 * stroke, -0.7 * stroke, d);
    const halo = clamp(1 - Math.abs(d - 3.2 * u) / (1.1 * u));
    if (halo > 0) c = c.map(v => v * (1 - 0.9 * halo));
    if (fillA > 0) {
      const gy = N.sdf[Math.min(W * H - 1, i + W)] - N.sdf[Math.max(0, i - W)], gx = N.sdf[Math.min(W * H - 1, i + 1)] - N.sdf[Math.max(0, i - 1)];
      const s = clamp(0.55 + 0.35 * Math.cos((y / N.capPx) * 5 + sweep) + 0.25 * (gx - gy) * 0.5);
      const g = gold(s).map(v => v * (1 - 0.88 * inline) + 0.004);
      c = c.map((v, q) => mix(v, g[q], fillA));
    }
    I.px.set(c, i * 3);
  }
  bloom(I, { threshold: 0.55, radius: 10 * u, strength: 0.4, tint: [1, 0.85, 0.6] });
  return { image: grain(I, { amount: 1.8, seed: `deco/${t}`, radius: Math.max(1, Math.round(u)) }), text: N.text };
}
