// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 10 metaballs: the name as liquid metal. The letters are a potential (a soft falloff of their distance field)
// and 46 droplets orbit them as metaballs; where a droplet nears a stroke the two fields add and the surface
// bridges, so beads pull away from the letters and fall back in. The surface takes its height from the summed
// field, its normals from the height, and its colour from a studio environment (two softboxes and a floor)
// reflected through Fresnel, with a thin oil film at grazing angles (the substrate's interference model).
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { filmLinear } from '../../substrate/lib/thinfilm.mjs';
import { img, lin, clamp, smooth, mix, grain, TAU, random, boxBlur } from '../lib/img.mjs';

export const meta = {
  id: 'metaballs', title: 'Liquid metal metaballs', loop: { seconds: 6, fps: 24, crossfade: 0 },
  marriage: 'metaball field summed with the letter distance potential x studio reflection (Fresnel) x thin-film oil rim x Accession Display 800',
  refs: ['glass liquid notes', 'feed set 20 thin-film light material'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, I = img(W, H);
  const N = setName(breakLines(text, 2), W, H, { box: [0.08, 0.14, 0.92, 0.84], weight: 800, tracking: 40, leading: 1.2, sdf: true });
  const k = N.capPx * 0.05, R = random('drops');
  const drops = Array.from({ length: 46 }, () => {
    const s = N.spans[Math.floor(R() * N.spans.length)];
    return { cx: (s.x0 + s.x1) / 2 + (R() - 0.5) * (s.x1 - s.x0), cy: s.top + R() * (s.base - s.top), ax: (0.04 + 0.08 * R()) * N.capPx, ay: (0.05 + 0.1 * R()) * N.capPx,
      f: 1 + Math.floor(R() * 2), ph: R() * TAU, r: (0.035 + 0.05 * R()) * N.capPx };
  });
  const F = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let f = 1.25 * Math.exp(Math.min(3, -(N.sdf[i] + k * 0.6) / k));
    for (const d of drops) {
      const px = d.cx + d.ax * Math.cos(TAU * t * d.f + d.ph), py = d.cy + d.ay * Math.sin(TAU * t * d.f + d.ph * 1.3);
      const dx = x - px, dy = y - py, r2 = dx * dx + dy * dy; if (r2 < 36 * d.r * d.r) f += (d.r * d.r) / (r2 + 1);
    }
    F[i] = f;
  }
  // height from the field above threshold: a rounded blob profile, smoothed a little
  const Hgt = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) Hgt[i] = F[i] > 1 ? Math.sqrt(1 - Math.exp(-(F[i] - 1) * 0.9)) : 0;
  const Hs = boxBlur(Hgt, W, H, Math.max(1, Math.round(1.5 * u)), { passes: 2 });
  const ground = lin('#121316'), floor = lin('#2a2c31'), box = lin('#f4f1ea'), warm = lin('#d9a679'), steel = lin('#8d939c');
  const film = d => filmLinear(d, { n: 1.45 });
  const hs = N.capPx * 0.09;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, v = y / H;
    let c = ground.map((q, j) => mix(q, floor[j], smooth(0.5, 1, v)));
    const cov = clamp((F[i] - 1) / (Math.abs(F[i + 1] - F[i - 1]) * 0.5 + Math.abs(F[i + W] - F[i - W]) * 0.5 + 1e-4) + 0.5);
    if (cov > 0) {
      const gx = (Hs[i + 1] - Hs[i - 1]) * hs, gy = (Hs[i + W] - Hs[i - W]) * hs;
      let nx = -gx, ny = -gy, nz = 1 / u; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      // view along -z; reflection vector r = v - 2 (v.n) n with v = (0, 0, -1)
      const rx = 2 * nz * nx, ry = 2 * nz * ny, rz = -1 + 2 * nz * nz;
      // environment: a long softbox overhead, a warm strip from the left, a dark floor below the horizon
      const top = smooth(-0.25, -0.75, ry), left = smooth(-0.35, -0.8, rx) * smooth(0.5, 0.1, Math.abs(ry)), below = smooth(0.1, 0.5, ry);
      const front = smooth(0.7, 1, rz) * 0.35;
      let env = steel.map((q, j) => q * (0.18 + front) + box[j] * 1.5 * top + warm[j] * 1.1 * left);
      env = env.map((q, j) => mix(q, floor[j] * 0.6, below));
      const cosT = clamp(nz), Fr = 0.62 + 0.38 * Math.pow(1 - cosT, 5);
      const fl = film(260 + 520 * (1 - cosT)), oil = smooth(0.75, 0.35, cosT) * 0.55;
      const metal = env.map((q, j) => q * Fr * (1 - oil + oil * fl[j] * 1.6));
      c = c.map((q, j) => mix(q, metal[j], cov));
    } else {
      // the floor catches a soft reflection of the metal above it
      const yy = Math.round(2 * (0.9 * H) - y); if (yy > 0 && yy < H && y > 0.9 * H) c = c.map((q, j) => q + 0.05 * (F[yy * W + x] > 1 ? 1 : 0));
    }
    I.px.set(c, i * 3);
  }
  return { image: grain(I, { amount: 1.6, seed: `meta/${t}`, radius: Math.max(1, Math.round(u)) }), text: N.text };
}
