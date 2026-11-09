// orbital-render.js: project and splat orbital points into a raster.js surface. Each point is one
// small Gaussian in linear light; its colour mixes two inks by the share of density carried by
// term group 1 at that point (w = |psi_B|^2 / (|psi_A|^2 + |psi_B|^2)), so the colour key is a
// measured quantity, readable at every point. Depth shades far points down. Pure.
import { psi } from './orbital.js';
import { hexLin } from './raster.js';

export const VIEW = { yaw: 0.6, pitch: 0.42, zoom: 1, inkA: '#bfe3e8', inkB: '#f0a35c', sigma: 0.75, energy: 0.11, depth: 0.55 };

// Rotation: yaw about z, then pitch about the screen x axis. Returns [sx, sy, depth].
export function project(x, y, z, v, W, H, extent) {
  const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
  const x1 = cy * x - sy * y, y1 = sy * x + cy * y;
  const up = cp * z - sp * y1, dep = sp * z + cp * y1;
  const s = Math.min(W, H) * 0.46 * v.zoom / extent;
  return [W / 2 + x1 * s, H / 2 - up * s, dep / extent];
}

// Per-point colour weights at time t (Float32Array, one per point).
export function weights(S, pts, t) { return frameData(S, pts, t, 1).w; }

// Colour weights plus a visibility mask: keep < 1 shows only points inside the density level that encloses
// that share of the ensemble at time t (an enclosure surface, the usual way orbitals are drawn).
export function frameData(S, pts, t, keep = 0.82) {
  const n = pts.length / 3, w = new Float32Array(n), d = new Float32Array(n), g = [0, 0];
  for (let i = 0, k = 0; i < pts.length; i += 3, k++) {
    const [a, b] = psi(S, pts[i], pts[i + 1], pts[i + 2], t, g);
    w[k] = g[1] / (g[0] + g[1] + 1e-30); d[k] = a * a + b * b;
  }
  const vis = new Uint8Array(n).fill(1);
  if (keep < 1) { const s = Float32Array.from(d).sort(), cut = s[Math.floor((1 - keep) * (n - 1))]; for (let k = 0; k < n; k++) vis[k] = d[k] >= cut ? 1 : 0; }
  return { w, vis, d };
}


// Opaque dots with a depth buffer: the front-most points form the visible skin of the cloud, so a dense
// ensemble reads as a lit solid with a speckled surface. Splat size follows the mean spacing between
// points, (cut / d)^(1/3), so the sparse skin near the enclosure level closes up. Normals come from the
// smoothed depth map; one key light from the upper left, a soft rim, depth fog. Writes sRGB bytes into
// rgba (W x H) through a table, with a 4 x 4 ordered dither on every channel so no gradient bands.
const FAR = 1e9, BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);
const SRGB = Float32Array.from({ length: 4096 }, (_, i) => { const v = i / 4095; return (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255; });
export function splatOpaque(rgba, W, H, pts, w, v = VIEW, extent = 10, dpr = 1, { radius = 1.15, light = [-0.45, -0.6, 0.66], vis = null, dens = null, smooth = 2, relief = 0.32, bg = [0, 0, 0] } = {}) {
  const N = W * H, Z = new Float32Array(N).fill(FAR), T = new Float32Array(N);
  new Uint32Array(rgba.buffer, rgba.byteOffset, N).fill((255 << 24 | bg[2] << 16 | bg[1] << 8 | bg[0]) >>> 0);   // ground (little-endian RGBA)
  let cut = Infinity; if (dens) for (let k = 0; k < dens.length; k++) if ((!vis || vis[k]) && dens[k] < cut) cut = dens[k];
  const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch), s = Math.min(W, H) * 0.46 * v.zoom / extent;
  let bx0 = W, bx1 = -1, by0 = H, by1 = -1;   // every later pass works inside the drawn box only
  for (let i = 0, k = 0; i < pts.length; i += 3, k++) {
    if (vis && !vis[k]) continue;
    const X = pts[i], Y = pts[i + 1], Zp = pts[i + 2], x1 = cy * X - sy * Y, y1 = sy * X + cy * Y;
    const x = W / 2 + x1 * s, y = H / 2 - (cp * Zp - sp * y1) * s, d = (sp * Zp + cp * y1) / extent;
    const R = radius * dpr * (dens ? Math.min(1.35, Math.max(1, Math.cbrt(cut / dens[k]) * 1.5)) : 1), r2 = R * R;
    const xa = Math.max(0, Math.floor(x - R)), xb = Math.min(W - 1, Math.ceil(x + R)), ya = Math.max(0, Math.floor(y - R)), yb = Math.min(H - 1, Math.ceil(y + R));
    if (xa > xb || ya > yb) continue;
    if (xa < bx0) bx0 = xa; if (xb > bx1) bx1 = xb; if (ya < by0) by0 = ya; if (yb > by1) by1 = yb;
    for (let py = ya; py <= yb; py++) { const dy = py + 0.5 - y; for (let px = xa; px <= xb; px++) {
      const dx = px + 0.5 - x; if (dx * dx + dy * dy > r2) continue;
      const j = py * W + px; if (d < Z[j]) { Z[j] = d; T[j] = w[k]; }
    } }
  }
  if (bx1 < 0) return rgba;
  const X0 = Math.max(1, bx0), X1 = Math.min(W - 2, bx1), Y0 = Math.max(1, by0), Y1 = Math.min(H - 2, by1);
  // close pinholes: an empty pixel with at least 5 of 8 filled neighbours takes the nearest one's depth and colour
  const NB = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1];
  for (let pass = 0; pass < 2; pass++) for (let y = Y0; y <= Y1; y++) for (let x = X0, j = y * W + X0; x <= X1; x++, j++) {
    if (Z[j] < FAR || (Z[j - 1] >= FAR && Z[j + 1] >= FAR)) continue;     // a pinhole has filled neighbours left or right
    let n = 0, best = FAR, bt = 0;
    for (let q = 0; q < 8; q++) { const z = Z[j + NB[q]]; if (z < FAR) { n++; if (z < best) { best = z; bt = T[j + NB[q]]; } } }
    if (n >= 5) { Z[j] = best; T[j] = bt; }
  }
  const S = new Float32Array(N).fill(FAR), sc = Math.min(W, H) * 0.46 * v.zoom * relief, rr = Math.max(1, Math.round(smooth * dpr));
  const hs = new Float32Array(N), hn = new Uint16Array(N), xa = Math.max(0, bx0 - rr), xb = Math.min(W - 1, bx1 + rr), ya = Math.max(0, by0 - rr), yb = Math.min(H - 1, by1 + rr);
  for (let y = by0; y <= by1; y++) { let a = 0, n = 0; const o = y * W; for (let x = xa - rr; x <= xb + rr; x++) {
    const p = x + rr, q = x - rr - 1;
    if (p >= 0 && p < W && Z[o + p] < FAR) { a += Z[o + p]; n++; }
    if (q >= 0 && q < W && Z[o + q] < FAR) { a -= Z[o + q]; n--; }
    if (x >= xa && x <= xb) { hs[o + x] = a; hn[o + x] = n; } } }
  for (let x = xa; x <= xb; x++) { let a = 0, n = 0; for (let y = ya - rr; y <= yb + rr; y++) {
    const p = y + rr, q = y - rr - 1;
    if (p >= 0 && p < H) { a += hs[p * W + x]; n += hn[p * W + x]; }
    if (q >= 0 && q < H) { a -= hs[q * W + x]; n -= hn[q * W + x]; }
    if (y >= ya && y <= yb && Z[y * W + x] < FAR && n > 0) S[y * W + x] = a / n; } }
  const A = hexLin(v.inkA), B = hexLin(v.inkB), L = Math.hypot(...light), lx = light[0] / L, ly = light[1] / L, lz = light[2] / L, k2 = sc * extent * 0.5;
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    const j = y * W + x, z = S[j]; if (z >= FAR) continue;
    const o = 4 * j, dth = BAYER[(y & 3) * 4 + (x & 3)];
    const zl = S[j - 1] < FAR ? S[j - 1] : z, zr = S[j + 1] < FAR ? S[j + 1] : z, zu = S[j - W] < FAR ? S[j - W] : z, zd = S[j + W] < FAR ? S[j + W] : z;
    const nx = (zr - zl) * k2, ny = (zd - zu) * k2, inv = 1 / Math.sqrt(nx * nx + ny * ny + 1), nz = inv;
    // depth grows away from the viewer, so the normal toward the light is (-dz/dx, -dz/dy, 1)
    const lam = Math.max(0, (-nx * lx - ny * ly) * inv + nz * lz), rim = (1 - nz) * (1 - nz), fog = Math.max(0.2, 1 - v.depth * 0.5 * (Z[j] + 1));
    const sh = (0.16 + 0.84 * lam) * fog + 0.25 * rim, t = T[j];
    // silhouette pixels (fewer than 4 filled neighbours) cover the ground only partly: antialiased dot edges
    const n4 = (S[j - 1] < FAR) + (S[j + 1] < FAR) + (S[j - W] < FAR) + (S[j + W] < FAR), al = n4 === 4 ? 1 : 0.3 + 0.7 * n4 / 4;
    for (let c = 0; c < 3; c++) { const lin = Math.min(1, (A[c] + (B[c] - A[c]) * t) * sh); rgba[o + c] = bg[c] + (SRGB[(lin * 4095) | 0] - bg[c]) * al + dth; }
  }
  return rgba;
}

// Extent: the radius that holds 99% of the points, so every state fills the frame the same way.
export function extentOf(pts) {
  const r = []; for (let i = 0; i < pts.length; i += 3) r.push(Math.hypot(pts[i], pts[i + 1], pts[i + 2]));
  r.sort((a, b) => a - b); return r[Math.floor(0.99 * (r.length - 1))] || 1;
}

// QUALITY-SPEC S1, S2, S4, S6 for the renderer.
export const SPEC = Object.freeze({
  inputs: { rgba: 'Uint8ClampedArray W*H*4', pts: 'Float32Array or Float64Array of x, y, z in bohr', w: 'Float32Array in [0,1], one per point' },
  params: { yaw: 'rad', pitch: 'rad', zoom: '0.5 to 2', inkA: 'sRGB hex', inkB: 'sRGB hex', depth: 'fog 0 to 1', radius: 'dot radius in px per 600 px of frame, 0.8 to 3',
    smooth: 'depth smoothing radius in px, 1 to 4', relief: 'normal strength, 0 to 1', keep: 'enclosure share, 0.5 to 1 (snapshot)' },
  determinism: 'same points give byte-identical pixels (orbital.test.mjs)',
  budget: { paint: '1442 x 1442, 42,000 points, 77 to 102 ms in node, so 10 to 12 frames a second (test bound 250 ms); painted in a worker at 12 frames a second (24 on twos)' },
  export: '3840 x 3840 PNG of the current moment, painted in the worker at that size',
  grain: 'declared heavy (QUALITY-SPEC R4): the speckled skin of opaque dots measures surface_sd about 6.2 to 6.3 at 1442 px',
  cadence: 'declared 12 (24 on twos); physics on a fixed 0.2 s display step, independent of the display rate',
});
