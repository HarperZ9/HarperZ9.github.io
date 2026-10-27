// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// crystal.mjs: glass lying on paper, seen from straight above, lit by a low sun. The glass is two height fields
// over the paper plane: `top` (its upper surface) and `bot` (its lower surface; 0 where it rests on the paper, above
// 0 where a cut or an air gap lifts it). Everything else follows from optics:
//   - the sun is traced through both surfaces (Snell, exact Fresnel, Beer tint) and splatted where it lands, so the
//     paper carries the glass's caustics and shadow: cut lines are thrown onto the paper as light;
//   - each view ray refracts at the top, crosses the glass, refracts (or totally reflects) at the bottom and lands on
//     the lit paper, so a V-cut's two walls show the paper twice (doubling), a rod magnifies what lies under it, and a
//     steep wall that traps the ray shows the room instead, as cut crystal sparkles;
//   - `rough` frosts the lower surface (an unpolished cut scatters light), sampled as a jittered disc;
//   - the top reflects a soft room and the sun (Fresnel), and a dark line marks where a curved side turns away.
// Units: heights in px. Pure; node or browser.
import { img, lin, clamp, hash2 } from './img.mjs';

const fres = (ci, ct, n1, n2) => { const rs = ((n1 * ci - n2 * ct) / (n1 * ci + n2 * ct)) ** 2, rp = ((n1 * ct - n2 * ci) / (n1 * ct + n2 * ci)) ** 2; return 0.5 * (rs + rp); };
// Refract unit d through unit normal N (facing the incoming ray), eta = n1/n2. Returns { t, R } or { tir: true }.
function refract(d, N, n1, n2) {
  let ci = -(d[0] * N[0] + d[1] * N[1] + d[2] * N[2]); let n = N;
  if (ci < 0) { n = [-N[0], -N[1], -N[2]]; ci = -ci; }
  const eta = n1 / n2, k = 1 - eta * eta * (1 - ci * ci);
  if (k < 0) return { tir: true, R: 1 };
  const ct = Math.sqrt(k), f = eta * ci - ct;
  return { t: [eta * d[0] + f * n[0], eta * d[1] + f * n[1], eta * d[2] + f * n[2]], R: fres(ci, ct, n1, n2) };
}
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

function grad(F, w, h, x, y) {
  const xi = Math.max(1, Math.min(w - 2, x | 0)), yi = Math.max(1, Math.min(h - 2, y | 0)), i = yi * w + xi;
  return [(F[i + 1] - F[i - 1]) / 2, (F[i + w] - F[i - w]) / 2];
}
function bilinear(I, x, y, c) {
  const { w, h, px } = I; x = Math.max(0, Math.min(w - 1.001, x - 0.5)); y = Math.max(0, Math.min(h - 1.001, y - 0.5));
  const x0 = x | 0, y0 = y | 0, u = x - x0, v = y - y0, i = (y0 * w + x0) * 3;
  return (px[i + c] * (1 - u) + px[i + 3 + c] * u) * (1 - v) + (px[i + w * 3 + c] * (1 - u) + px[i + w * 3 + 3 + c] * u) * v;
}

/**
 * render(paper, glass, opts) -> linear picture.
 *   paper   lib/img picture (the inked note, linear)
 *   glass   { top, bot, mask, rough } Float32Array(w*h); rough 0..1 frost of the lower surface
 *   opts    { ior: [r, g, b], tint '#hex' per 100 px, sun: { az deg: the direction the light travels across the page (0 = to the right, 90 = down; 45 = sun at upper left), el deg, power },
 *             ambient 0..1, room '#hex', latent: Float32Array (extra wall tilt only the sun's glint shows) }
 */
export function render(paper, glass, o = {}) {
  const { w, h } = paper, { top, bot, mask, rough } = glass;
  const ior = o.ior ?? [1.5175, 1.519, 1.5215], tint = lin(o.tint ?? '#e9f2ee'), ambient = o.ambient ?? 0.42, room = lin(o.room ?? '#e6e7ea'), frost = lin(o.frost ?? '#f4f3ee');
  const az = (o.sun?.az ?? 45) * Math.PI / 180, el = (o.sun?.el ?? 24) * Math.PI / 180, power = o.sun?.power ?? 0.75;
  const S = norm([Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), -Math.sin(el)]);   // direction the light travels
  const sig = tint.map(v => -Math.log(Math.max(1e-4, v)) / 100);
  // 1. light on the paper: direct sun where nothing shadows it, plus every ray that crossed the glass
  const Lit = new Float32Array(w * h * 3), reach = (o.maxThick ?? 0) || maxOf(top);
  const throwXY = [S[0] / -S[2], S[1] / -S[2]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    // direct: walk up toward the sun; blocked if the sun ray passes inside the glass on its way here
    // Paper under the glass is lit by the splats below (rays leaving through the bottom face). Paper beside it is lit
    // directly, and where the sun ray to it crossed the glass, it left through a side wall: two Fresnel losses and
    // the tint dim it, but it is not a shadow (clear glass casts a pale one).
    if (mask[i] >= 0.5) continue;
    let through = 0;
    if (reach > 0) for (let z = 0.5; z <= reach + 1; z += Math.max(0.5, reach / 24)) {
      const xi = (x - throwXY[0] * z) | 0, yi = (y - throwXY[1] * z) | 0;
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) break; const j = yi * w + xi;
      if (mask[j] > 0.5 && top[j] >= z && bot[j] <= z) through += Math.max(0.5, reach / 24);
    }
    for (let c = 0; c < 3; c++) Lit[i * 3 + c] += through > 0 ? 0.84 * Math.exp(-sig[c] * through * 2) : 1;
  }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (mask[i] <= 0) continue;
    const gt = grad(top, w, h, x, y), Nt = norm([-gt[0], -gt[1], 1]);
    for (let c = 0; c < 3; c++) {
      const a = refract(S, Nt, 1, ior[c]); if (a.tir) continue;
      const dz = top[i] - bot[i], k1 = dz / Math.max(1e-3, -a.t[2]), bx = x + a.t[0] * k1, by = y + a.t[1] * k1;
      // irradiance: a face turned toward the sun catches more light per pixel of plan than the paper does
      const catchK = Math.max(0, -(Nt[0] * S[0] + Nt[1] * S[1] + Nt[2] * S[2])) / -S[2];
      const bz0 = bot[Math.max(0, Math.min(h - 1, by | 0)) * w + Math.max(0, Math.min(w - 1, bx | 0))];
      if (bz0 < 0.5) { splat(Lit, w, h, bx, by, c, mask[i] * catchK * (1 - a.R) * Math.exp(-sig[c] * dz)); continue; }   // in contact: straight into the paper
      const gb = grad(bot, w, h, bx, by), Nb = norm([gb[0], gb[1], -1]);
      const b = refract(a.t, Nb, ior[c], 1); if (b.tir) continue;
      const k2 = bz0 / Math.max(1e-3, -b.t[2]);
      const lx = bx + b.t[0] * k2, ly = by + b.t[1] * k2, e = mask[i] * catchK * (1 - a.R) * (1 - b.R) * Math.exp(-sig[c] * dz);
      splat(Lit, w, h, lx, ly, c, e);
    }
  }
  const lit = img(w, h);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) lit.px[i * 3 + c] = paper.px[i * 3 + c] * (ambient + power * Lit[i * 3 + c]);
  // 2. the view: straight down through the glass to the lit paper
  const O = img(w, h); O.px.set(lit.px);
  const sunRefl = [-S[0], -S[1], -S[2]], sxy = Math.hypot(S[0], S[1]) || 1, toSun = [-S[0] / sxy, -S[1] / sxy];
  // the room the glass reflects: a dim ceiling, and a bright window low on the sun's side, so flat faces stay
  // dark and only faces turned toward the window carry a highlight (how clear glass reads on a dark ground)
  const ceil = lin(o.ceiling ?? '#14161a');
  const env = (r, c) => { const side = Math.hypot(r[0], r[1]) || 1e-6, al = (r[0] * toSun[0] + r[1] * toSun[1]) / side;
    const win = clamp((al - 0.2) / 0.5) * clamp((side - 0.25) / 0.35) * (r[2] > 0 ? 1 : 0); return ceil[c] + (room[c] - ceil[c]) * win; };
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, m = mask[i]; if (m <= 0) continue;
    const gt = grad(top, w, h, x, y), Nt = norm([-gt[0], -gt[1], 1]), d = [0, 0, -1];
    const rv = [d[0] - 2 * (d[2] * Nt[2]) * Nt[0], d[1] - 2 * (d[2] * Nt[2]) * Nt[1], d[2] - 2 * (d[2] * Nt[2]) * Nt[2]];
    const glintT = Math.pow(Math.max(0, rv[0] * sunRefl[0] + rv[1] * sunRefl[1] + rv[2] * sunRefl[2]), 400);
    const turn = Math.hypot(gt[0], gt[1]), edge = clamp((turn - 1.6) / 2.5) * clamp((6 - turn) / 2);   // side turning away
    let trapped = false;
    for (let c = 0; c < 3; c++) {
      const a = refract(d, Nt, 1, ior[c]); let col;
      if (a.tir) col = bilinear(lit, x, y, c);
      else {
        const dz = top[i] - bot[i], k1 = dz / Math.max(1e-3, -a.t[2]), bx = x + 0.5 + a.t[0] * k1, by = y + 0.5 + a.t[1] * k1;
        let gb = grad(bot, w, h, bx, by); if (o.latent) { const j = Math.max(0, Math.min(h - 1, by | 0)) * w + Math.max(0, Math.min(w - 1, bx | 0)); gb = [gb[0] + o.latent[j] * 0.7, gb[1] + o.latent[j] * 0.7]; }
        const Nb = norm([gb[0], gb[1], -1]);
        let b = refract(a.t, Nb, ior[c], 1);
        // one decision per pixel: whether a wall traps the ray is taken on green, so channels cannot split into
        // rainbow speckle at a groove wall; dispersion still offsets where each channel lands
        if (c === 0) trapped = refract(refract(d, Nt, 1, ior[1]).t ?? a.t, Nb, ior[1], 1).tir;
        if (trapped && !b.tir) b = { tir: true, R: 1 }; else if (!trapped && b.tir) b = refract(a.t, Nb, ior[1], 1);
        if (b.tir) {
          // trapped by a steep cut wall: the ray goes back up and sees the room, and the sun if it lines up
          const up = [a.t[0] - 2 * (a.t[0] * Nb[0] + a.t[1] * Nb[1] + a.t[2] * Nb[2]) * Nb[0], a.t[1] - 2 * (a.t[0] * Nb[0] + a.t[1] * Nb[1] + a.t[2] * Nb[2]) * Nb[1]];
          const g = Math.pow(Math.max(0, -(up[0] * S[0] + up[1] * S[1]) / (Math.hypot(up[0], up[1]) || 1)), 6);
          col = 0.9 * bilinear(lit, bx - up[0] * 2 * dz, by - up[1] * 2 * dz, c) + 1.6 * power * g;   // the paper, seen mirrored in the wall
          // a matte wall cannot trap light coherently: it scatters, and glows with the light it catches
          const jr = Math.max(0, Math.min(h - 1, by | 0)) * w + Math.max(0, Math.min(w - 1, bx | 0)), fr = rough ? rough[jr] : 0;
          if (fr > 0.02) col += (frost[c] * (ambient + 0.8 * power) * 0.75 - col) * fr;
        } else {
          const j = Math.max(0, Math.min(h - 1, by | 0)) * w + Math.max(0, Math.min(w - 1, bx | 0)), bz = bot[j], k2 = bz / Math.max(1e-3, -b.t[2]);
          const lx = bx + b.t[0] * k2, ly = by + b.t[1] * k2, fr = rough ? rough[j] : 0;
          let s = 0;
          if (fr > 0.02) { const R = 0.5 + fr * 5; for (let q = 0; q < 8; q++) { const an = (q + hash2(x, y, q)) * 0.785, rr = R * Math.sqrt((q + 0.5) / 8); s += bilinear(lit, lx + Math.cos(an) * rr, ly + Math.sin(an) * rr, c); } s /= 8; s = s * (1 - 0.6 * fr) + 0.6 * fr * frost[c] * (ambient + 0.8 * power); }   // a matte cut scatters the room and the sun
          else s = bilinear(lit, lx, ly, c);
          const contact = bz < 0.5;   // glass resting on the paper: no air, no reflection at that face
          col = s * (1 - a.R) * (contact ? 1 : 1 - b.R) * Math.exp(-sig[c] * dz) + (contact ? 0 : b.R * env([-a.t[0], -a.t[1], -a.t[2]], c) * 0.5);
        }
      }
      col = col + a.R * env(rv, c) + glintT * 2.2 * power;
      col *= 1 - 0.7 * edge;
      O.px[i * 3 + c] += (col - O.px[i * 3 + c]) * m;
    }
  }
  return O;
}

function maxOf(F) { let m = 0; for (let i = 0; i < F.length; i++) if (F[i] > m) m = F[i]; return Math.ceil(m); }
function splat(C, w, h, x, y, c, e) {
  x -= 0.5; y -= 0.5; const x0 = Math.floor(x), y0 = Math.floor(y), u = x - x0, v = y - y0;
  const put = (xx, yy, k) => { if (xx >= 0 && yy >= 0 && xx < w && yy < h) C[(yy * w + xx) * 3 + c] += k; };
  put(x0, y0, e * (1 - u) * (1 - v)); put(x0 + 1, y0, e * u * (1 - v)); put(x0, y0 + 1, e * (1 - u) * v); put(x0 + 1, y0 + 1, e * u * v);
}

/** Intaglio cut depth along letter centre lines: V-grooves at even distances from the line (pitch px), width by a
 * raking light on the stroke's round section. dist: distance to centre lines; half: stroke half width. Returns
 * { depth (px), cov (0..1 groove share) } for the given maximum depth. */
export function intaglioCuts(dist, mask, w, h, { half, pitch, depth, light = [-0.7, -0.71], wMin = 0.1, wSpan = 0.45 }) {
  const D = new Float32Array(w * h), cov = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, m = mask[i]; if (m <= 0) continue;
    const d = dist[i], gx = (dist[i + 1] - dist[i - 1]) / 2, gy = (dist[i + w] - dist[i - w]) / 2, g = Math.hypot(gx, gy) || 1;
    const tilt = Math.min(1, d / half), shade = clamp(0.55 + 0.75 * tilt * (gx / g * light[0] + gy / g * light[1]) - 0.15 * tilt * tilt);
    const ph = d / pitch, frac = Math.abs((ph % 1 + 1) % 1 - 0.5) * pitch, wd = pitch * (wMin + wSpan * (1 - shade));
    const v = clamp(1 - frac / (wd / 2)); cov[i] = v > 0 ? m : 0; D[i] = depth * (0.4 + 0.6 * (1 - shade)) * v * m;
  }
  return { depth: D, cov };
}
