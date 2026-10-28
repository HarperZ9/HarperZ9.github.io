// brush/cloud.js: render a cloud.json (cloud2d.js) onto a Surface in one of its 2D styles.
// volume: the lit field. Normals from the thickness gradient give every lobe a lit and a shaded side (the nesting
//   reads); light is Beer transmittance through the summed chords, with Beer-powder darkening; the silver lining is
//   thin cloud with the light behind, weighted by a dual Henyey-Greenstein phase; a dark under-shadow band sits on
//   the flat base; edges are found (hard) toward the light and lost (soft) in shadow; a fine billow term at full
//   resolution curls every edge.
// wash: the July metaball cumulus (cream metaballs at lobe centres, a dark under-shadow band at the base).
// dither: the light field quantised to N tones through an 8 x 8 Bayer matrix, two inks.
// halftone: a dot screen at an angle, dot area from darkness.
import { linear, gradNoise, smoothstep, clamp, lerp } from './core.js';
import { shade, field, flatLobes } from './cloud2d.js';

const hg = (cos, g) => (1 - g * g) / (4 * Math.PI * (1 + g * g - 2 * g * cos) ** 1.5);
const BAYER8 = (() => {
  const m = [[0, 2], [3, 1]]; let b = m;
  for (let n = 2; n < 8; n *= 2) { const nb = []; for (let y = 0; y < n * 2; y++) { nb.push([]); for (let x = 0; x < n * 2; x++) nb[y].push(4 * b[y % n][x % n] + m[(y / n) | 0][(x / n) | 0]); } b = nb; }
  return b.map((r) => r.map((v) => (v + 0.5) / 64));
})();

function over(px, i, col, a) { const k = 1 - a; px[i] = col[0] * a + px[i] * k; px[i + 1] = col[1] * a + px[i + 1] * k; px[i + 2] = col[2] * a + px[i + 2] * k; px[i + 3] = a + px[i + 3] * k; }

function volume(surface, cloud, F, unit, o) {
  const { w: W, h: H, px } = surface, M = cloud.medium, Lt = cloud.light, seed = cloud.seed;
  const C = { shadow: linear(o.shadow ?? M.bounce), mid: linear(o.mid ?? '#4a4b6d'), lit: linear(o.lit ?? '#c3c2ea'), rim: linear(Lt.color), sky: linear(M.ambient) };
  const lp = Lt.pos ? [Lt.pos[0] * unit, Lt.pos[1] * unit] : null, glowR = (o.glowR ?? 0.22) * unit, glowK = o.glowK ?? 0.5;
  const cosB = Lt.pos ? clamp(-Lt.pos[2] * 4, -1, 1) : -Lt.dir[2], phase = (M.hg.mix * hg(cosB, M.hg.g1) + (1 - M.hg.mix) * hg(cosB, M.hg.g2)) * 4 * Math.PI;
  const [found, lost] = o.soft ?? [0.002, 0.016], fw = 2.2 / unit, fe = 55 / unit, curl = o.curl ?? 0.006, ext = M.extinction;
  const e = F.q * 1.5, bandY = cloud.base.y * unit;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let t = field(F, F.thickness, x, y);
    if (t <= -0.004) continue;
    // fine billow curls at full resolution: each edge breaks into small rounded lobes
    const b1 = Math.abs(gradNoise(x * fe, y * fe, seed + 8) - 0.5) * 2, b2 = Math.abs(gradNoise(x * fe * 2.3, y * fe * 2.3, seed + 9) - 0.5) * 2;
    t -= curl * (0.65 * b1 + 0.35 * b2);
    const L = field(F, F.light, x, y), rim = field(F, F.rim, x, y);
    const s = lerp(found, lost, clamp(1 - L * 1.5 + (gradNoise(x * fw * 0.5, y * fw * 0.5, seed + 6) - 0.5) * 0.6));
    const a = smoothstep(-s * 0.35, s, t); // centred a little below zero so the antialiased edge spans both sides
    if (a <= 0.002) continue;
    // normal from the thickness gradient, toward 'up' where the field is flat
    const gx = field(F, F.smooth, x + e, y) - field(F, F.smooth, x - e, y), gy = field(F, F.smooth, x, y + e) - field(F, F.smooth, x, y - e), gm = Math.hypot(gx, gy);
    const wgt = smoothstep(0, 0.002, gm), nx = gm > 1e-9 ? (-gx / gm) * wgt : 0, ny = gm > 1e-9 ? (-gy / gm) * wgt - (1 - wgt) : -1;
    let ldx = 0, ldy = -1;
    if (lp) { ldx = lp[0] - x; ldy = lp[1] - y; const m = Math.hypot(ldx, ldy) || 1; ldx /= m; ldy /= m; } else { const m = Math.hypot(Lt.dir[0], Lt.dir[1]) || 1; ldx = Lt.dir[0] / m; ldy = Lt.dir[1] / m; }
    const NL = 0.5 + 0.5 * (nx * ldx + ny * ldy), up = clamp(-ny);
    const powder = 1 - M.powder * Math.exp(-2 * ext * t);
    // bump: the same billow noise that curls the edge modulates the light across the surface (cauliflower)
    const bump = 1 + (o.bump ?? 0.35) * (0.65 * b1 + 0.35 * b2 - 0.45) * (0.3 + NL);
    const direct = L * (0.25 + 0.75 * NL * NL) * powder * bump, amb = (o.ambient ?? 0.3) * (0.35 + 0.65 * up);
    const glow = lp ? glowK * Math.exp(-((x - lp[0]) ** 2 + (y - lp[1]) ** 2) / (glowR * glowR)) : 0;
    const under = (1 - smoothstep(0, 0.035 * unit, bandY - y)) * (o.under ?? 0.55);
    const col = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      let v = lerp(C.shadow[c], C.lit[c], Math.min(1, direct));
      v += C.mid[c] * amb * (1 - direct);
      v += C.rim[c] * (o.rimK ?? 0.7) * rim * Math.min(3, phase) * (0.5 + glow);
      v += C.lit[c] * glow * L * 0.6;
      v *= 1 - under * (1 - direct * 0.5);
      col[c] = v > 0.72 ? 0.72 + 0.28 * (1 - Math.exp(-(v - 0.72) / 0.28)) : v; // highlight shoulder: whites roll off, never flatten

    }
    over(px, (y * W + x) * 4, col, a);
  }
}

// Silhouette coverage for the flat styles: a 1.2 px ramp across the zero crossing of the signed thickness, so
// outlines are antialiased instead of cut from the grid (quality spec R3).
const edgeAlpha = (F, x, y) => {
  const t = field(F, F.thickness, x, y), gx = field(F, F.thickness, x + 1, y) - field(F, F.thickness, x - 1, y), gy = field(F, F.thickness, x, y + 1) - field(F, F.thickness, x, y - 1);
  const perPx = Math.max(1e-7, Math.hypot(gx, gy) / 2); // thickness change per pixel near the edge
  return smoothstep(-0.8, 0.8, t / perPx);              // t / perPx is the signed distance to the outline, in px
};

function wash(surface, cloud, F, unit, o) {
  const { w: W, h: H, px } = surface, cream = linear(o.cream ?? '#efe6d2'), shadowC = linear(o.shadow ?? '#3a3036'), bandY = cloud.base.y * unit;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = edgeAlpha(F, x, y); if (a <= 0.002) continue;
    const L = field(F, F.light, x, y), band = 1 - smoothstep(0, 0.03 * unit, bandY - y), k = clamp(0.35 + 0.65 * L) * (1 - 0.75 * band);
    over(px, (y * W + x) * 4, cream.map((c, j) => lerp(shadowC[j], c, k)), a);
  }
}

function dither(surface, cloud, F, unit, o) {
  const { w: W, h: H, px } = surface, ink = linear(o.ink ?? '#14121a'), paper = linear(o.paper ?? '#e9e4d8'), N = o.tones ?? 4, cell = Math.max(2, Math.round((o.cell ?? 0.0035) * unit));
  // quantise once per cell (at its centre), then read the cell values bilinearly through a steep ramp: the dither
  // keeps its cells, and the step between two cells spans one pixel instead of a hard jump
  const cw = Math.ceil(W / cell) + 1, ch = Math.ceil(H / cell) + 1, Q = new Float32Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    const x = (cx + 0.5) * cell, y = (cy + 0.5) * cell, v = clamp(field(F, F.light, x, y) + 0.5 * field(F, F.rim, x, y));
    Q[cy * cw + cx] = Math.min(1, Math.floor(v * (N - 1) + BAYER8[cy % 8][cx % 8]) / (N - 1));
  }
  const ramp = (f) => smoothstep(0.5 - 0.5 / cell, 0.5 + 0.5 / cell, f);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = edgeAlpha(F, x, y); if (a <= 0.002) continue;
    const fx = x / cell - 0.5, fy = y / cell - 0.5, ix = Math.max(0, Math.floor(fx)), iy = Math.max(0, Math.floor(fy)), tx = ramp(fx - ix), ty = ramp(fy - iy);
    const g = (i, j) => Q[Math.min(ch - 1, j) * cw + Math.min(cw - 1, i)];
    const q = lerp(lerp(g(ix, iy), g(ix + 1, iy), tx), lerp(g(ix, iy + 1), g(ix + 1, iy + 1), tx), ty);
    over(px, (y * W + x) * 4, ink.map((c, j) => lerp(c, paper[j], q)), a);
  }
}

function halftone(surface, cloud, F, unit, o) {
  const { w: W, h: H, px } = surface, ink = linear(o.ink ?? '#14121a'), paper = linear(o.paper ?? '#e9e4d8'), P = (o.pitch ?? 0.008) * unit, ang = ((o.angle ?? 45) * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = edgeAlpha(F, x, y); if (a <= 0.002) continue;
    const u = (x * ca + y * sa) / P, v = (-x * sa + y * ca) / P, fu = u - Math.round(u), fv = v - Math.round(v);
    const dark = 1 - clamp(field(F, F.light, x, y) + 0.5 * field(F, F.rim, x, y)), r = Math.sqrt(dark / Math.PI), d = Math.hypot(fu, fv);
    const cov = clamp((r - d) * P + 0.5); // antialiased dot edge, one pixel wide
    over(px, (y * W + x) * 4, ink.map((c, j) => lerp(paper[j], c, cov)), a);
  }
}

const STYLES = { volume, wash, dither, halftone };
export const CLOUD_STYLES = Object.keys(STYLES);

// Render cloud (a cloud.json object) at the surface's resolution. Returns the fields for reuse (paint style, tests).
export function renderCloud(surface, cloud, { unit = surface.w } = {}) {
  const F = shade(cloud, { W: surface.w, H: surface.h, unit });
  const style = STYLES[cloud.style];
  if (!style) throw new Error(`cloud: unknown style "${cloud.style}"`);
  style(surface, cloud, F, unit, cloud.styleOpts ?? {});
  surface.dirty = { x0: 0, y0: 0, x1: surface.w - 1, y1: surface.h - 1 };
  return { fields: F, lobes: flatLobes(cloud.lobes).length };
}
