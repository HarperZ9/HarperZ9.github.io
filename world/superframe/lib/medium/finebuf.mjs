// lib/medium/finebuf.mjs: the spectral medium's fine pigment buffer. Ink particles (motes.mjs) and ink ticks
// (ticks.mjs) are finer than the grid, so in a spectral tank their absorbance is splatted into a 16-band buffer at four
// texels per grid cell, and the render adds it to the water's own pigment band by band before the single projection
// to RGB (render.mjs). In an RGB tank the same splats are drawn after the scene as before.
import { rgbCoefficientBands } from './spectral.mjs';
import { progress as timed } from './timing.mjs';

const R = 4;
export function spectralSplats(m) {
  const motes = m.motes ?? [], items = m.items ?? [];
  if (!motes.length && !items.length) return null;
  const FW = m.nx * R, FH = m.ny * R, plane = FW * FH, buf = new Float32Array(16 * plane);
  let any = false;
  const splat = (x, y, rc, k, A) => {
    const cx = (x + 0.5) * R - 0.5, cy = (y + 0.5) * R - 0.5, E = rc * 2.1;
    for (let j = Math.max(0, Math.floor(cy - E)); j <= Math.min(FH - 1, Math.ceil(cy + E)); j++) for (let i = Math.max(0, Math.floor(cx - E)); i <= Math.min(FW - 1, Math.ceil(cx + E)); i++) {
      const q = ((i - cx) ** 2 + (j - cy) ** 2) / (rc * rc); if (q > 4.4) continue;
      const w = k * Math.exp(-q), o = j * FW + i; for (let b = 0; b < 16; b++) buf[b * plane + o] += A[b] * w;
    }
    any = true;
  };
  for (const p of motes) { if (!p.aS) continue; const rc = R * (0.35 + 0.75 * Math.sqrt(p.age)); splat(p.x, p.y, rc, p.mass / ((rc / R) ** 2) * 1.4, p.aS); }
  for (const it of items) {
    const rc = it.spacing * 1.7 * R, norm = it.spacing ** 2 / (Math.PI * (rc / R) ** 2);
    for (const t of it.ticks) it.elements.forEach((E, e) => {
      if (t.w[e] <= 0.002) return;
      const L = E.look(t, E.timing ? timed(E.timing, t.clock[e]) : 1, m); const A = L.absorbS ?? (L.absorb ? rgbCoefficientBands(L.absorb) : null);
      if (A) splat(t.x, t.y, rc, norm * t.h * t.w[e], A);
    });
  }
  if (!any) return null;
  return (b, gx, gy) => {
    const x = Math.min(FW - 1.001, Math.max(0, (gx + 0.5) * R - 0.5)), y = Math.min(FH - 1.001, Math.max(0, (gy + 0.5) * R - 0.5)), i = x | 0, j = y | 0, u = x - i, v = y - j, o = b * plane + j * FW + i;
    return (buf[o] * (1 - u) + buf[o + 1] * u) * (1 - v) + (buf[o + FW] * (1 - u) + buf[o + FW + 1] * u) * v;
  };
}
