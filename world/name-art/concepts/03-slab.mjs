// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 03 slab: the name as a supergraphic at architectural scale. Three lines of Accession Display 900 are cast
// into a board-formed concrete wall, cropped by the frame the way 1970s environmental graphics ran off a
// building's edge. A low sun rakes the relief: a height field from the letter's distance field, normals,
// Lambert, and a shadow march toward the sun. One painted band of signal orange runs behind the cast letters,
// and a lone figure at the foot of the wall sets the scale.
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { img, lin, clamp, smooth, fbm, vnoise, hash2, grain, vignette, mix } from '../lib/img.mjs';

export const meta = {
  id: 'slab', title: 'Supergraphic slab', loop: { seconds: 8, fps: 24, crossfade: 0 },
  marriage: 'raked relief (height field, shadow march) x board-form concrete x 1970s supergraphic band x Accession Display 900',
  refs: ['ui (Slab)', 'feed set 29 DehG'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, I = img(W, H);
  const N = setName(breakLines(text, 3), W, H, { box: [-0.018, 0.045, 0.9, 0.915], weight: 900, leading: 1.1, tracking: -12, align: 'left', fit: 'contain', sdf: true });
  const depth = 0.03 * H, bev = 0.006 * H;
  const hgt = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) hgt[i] = depth * smooth(0, 1, -N.sdf[i] / bev);
  // sun: low, from the upper left; its azimuth swings a few degrees over the loop, so the shadows breathe
  const az = 2.45 + 0.05 * Math.sin(t * Math.PI * 2), el = 0.42, dx = Math.cos(az), dy = -Math.sin(az), tanEl = Math.tan(el);
  const sun = [dx * Math.cos(el), -dy * Math.cos(el), Math.sin(el)];
  const wall = lin('#a29d93'), face = lin('#d6d1c6'), orange = lin('#e0531f'), skyAmb = lin('#93a6be'), sunC = lin('#ffe2c0');
  const plank = 0.034 * H, tie = 0.17 * H, step = 1.0 * u;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, h0 = hgt[i], onFace = h0 > depth * 0.5;
    const pk = Math.floor(x / plank), fx = (x % plank) / plank;
    const woodgrain = vnoise(x / (2.2 * u) + pk * 13, y / (70 * u) + pk * 7, 3) * 0.55 + fbm(x / (40 * u), y / (40 * u), 5, 4) * 0.45;
    const seam = onFace ? 0 : smooth(0.95, 1, fx);
    const tx = (x % tie) - tie / 2, ty = ((y + tie * 0.3) % tie) - tie / 2, hole = onFace ? 0 : smooth(4.5 * u, 3 * u, Math.hypot(tx, ty));
    let alb = onFace ? face.map(v => v * (0.94 + 0.08 * fbm(x / (9 * u), y / (9 * u), 8, 3))) : wall.map(v => v * (0.82 + 0.3 * woodgrain + 0.06 * hash2(pk, 0, 4)));
    // the painted band: a stepped run of signal orange on the wall face, behind the cast letters
    const by = 0.5 * H + Math.floor(Math.max(0, x - 0.3 * W) / (0.14 * W)) * -0.075 * H;
    if (!onFace && y > by && y < by + 0.09 * H && x > 0.3 * W) alb = orange.map(v => v * (0.92 + 0.12 * woodgrain));
    const hx = (hgt[Math.min(W * H - 1, i + 1)] - hgt[Math.max(0, i - 1)]) / 2, hy = (hgt[Math.min(W * H - 1, i + W)] - hgt[Math.max(0, i - W)]) / 2;
    let nx = -hx - (woodgrain - 0.5) * 0.08 + seam * 0.25, ny = hy, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const lam = Math.max(0, nx * sun[0] + ny * sun[1] + nz * sun[2]);
    // shadow march toward the sun over the height field, soft by the closest miss
    let vis = 1;
    for (let k = 1; k < 400; k++) {
      const d = k * step, px = x + dx * d, py = y + dy * d;
      if (px < 0 || px >= W - 1 || py < 0 || py >= H - 1) break;
      const ray = h0 + d * tanEl; if (ray > depth) break;
      const hh = hgt[(py | 0) * W + (px | 0)];
      vis = Math.min(vis, clamp((ray - hh) / (0.004 * d + 0.6)));
      if (vis <= 0) break;
    }
    const ao = (1 - 0.4 * (onFace ? 0 : clamp(1 - N.sdf[i] / (0.02 * H)))) * (1 - hole * 0.7);
    for (let c = 0; c < 3; c++) I.px[i * 3 + c] = alb[c] * (sunC[c] * 1.35 * lam * (0.08 + 0.92 * vis) + skyAmb[c] * 0.2 * ao) * (1 - 0.12 * seam);
  }
  // the figure at the foot of the wall (a person for scale), and the ground line
  const fx0 = 0.74 * W, fy0 = 0.955 * H, fh = 0.075 * H;
  for (let y = Math.floor(fy0 - fh); y < Math.min(H, fy0 + 2); y++) for (let x = Math.floor(fx0 - fh * 0.2); x < fx0 + fh * 0.2; x++) {
    const v = (fy0 - y) / fh, dx = Math.abs(x - fx0) / fh;
    const head = Math.hypot(dx, v - 0.92) < 0.075, bodyw = v < 0.82 ? (v > 0.45 ? 0.13 - 0.03 * (v - 0.45) : 0.06 + (v < 0.45 ? 0.02 : 0)) : 0;
    const legs = v < 0.47 && Math.abs(Math.abs(x - fx0) / fh - 0.04) < 0.03;
    if (head || (v >= 0.47 && dx < bodyw) || legs) { const i = (y * W + x) * 3; I.px[i] = 0.012; I.px[i + 1] = 0.012; I.px[i + 2] = 0.014; }
  }
  // cast shadow of the figure, long toward the right
  return { image: grain(vignette(I, 0.18), { amount: 3.2, seed: 'slab', radius: Math.max(1, Math.round(u * 1.2)) }), text: N.text };
}
