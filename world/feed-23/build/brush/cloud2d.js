// brush/cloud2d.js: the 2D side of the shared cloud system (feed-archive PLAYBOOK.md section 5).
// One cloud.json describes a cloud: a lobe tree of ellipsoids, a flat base, surface erosion, a medium, a light, a
// style and a seed. shade(cloud, view) projects it onto a grid and returns four fields: mask, thickness (summed
// chord length), light (a two-tap Beer march toward the light through the summed chords) and rim (thin cloud with
// the light behind). Styles render those fields: volume (lit field), wash (metaball cumulus), dither, halftone; the
// paint style lives in cloudpaint.js. Units: canvas-width (x right, y down, z toward the viewer).
import { rng, gradNoise, smoothstep, clamp, hash2 } from './core.js';

export const CLOUD_SCHEMA = 'cloud.json/1';

// A lobe tree grown from trunk lobes: each lobe gets 3 to 8 sub-lobes at 0.35 to 0.6 of its radius, set on its
// upper and lit side (cumulus builds upward and toward the light), to `depth` levels.
export function growLobes(trunks, { seed = 1, depth = 2, light = { pos: [0.5, 0.3, -0.2] }, flatten = 0.85 } = {}) {
  const R = rng(seed);
  const grow = (lobe, level) => {
    if (level >= depth) return lobe;
    const n = 3 + Math.floor(R() * 6), [cx, cy, cz] = lobe.c, [rx, ry, rz] = lobe.r;
    const toL = light.pos ? Math.atan2(light.pos[1] - cy, light.pos[0] - cx) : Math.atan2(light.dir[1], light.dir[0]);
    lobe.children = [];
    for (let i = 0; i < n; i++) {
      const a = i % 2 ? toL + (R() - 0.5) * 2.4 : -Math.PI / 2 + (R() - 0.5) * 3.0, k = 0.35 + R() * 0.25, d = 0.7 + R() * 0.3; // sub-lobes sit on the surface and break the parent's outline
      const c = [cx + Math.cos(a) * rx * d, cy + Math.min(Math.sin(a) * ry * d, ry * 0.2), cz + (R() - 0.5) * rz * 0.8];
      lobe.children.push(grow({ c, r: [rx * k, ry * k * flatten, rz * k], children: [] }, level + 1));
    }
    return lobe;
  };
  return trunks.map((t) => grow({ c: t.c, r: t.r, children: [] }, 0));
}

export function makeCloud(o = {}) {
  return {
    schema: CLOUD_SCHEMA, seed: o.seed ?? 1,
    lobes: o.lobes ?? growLobes(o.trunks ?? [{ c: [0.5, 0.5, 0], r: [0.2, 0.14, 0.18] }], { seed: o.seed, light: o.light }),
    base: { y: 0.65, soft: 0.02, ...o.base },
    erosion: o.erosion ?? [{ kind: 'billow', scale: 18, amount: 0.02 }, { kind: 'worley', scale: 44, amount: 0.012 }],
    erosionHeight: o.erosionHeight ?? 0.6, // more erosion toward the top of the cloud, 0..1
    medium: { extinction: 45, albedo: 0.9, hg: { g1: 0.6, g2: -0.3, mix: 0.7 }, powder: 0.5, ambient: '#5d66a0', bounce: '#1a1620', ...o.medium },
    light: { pos: [0.5, 0.3, -0.2], color: '#f4f2ff', ...o.light },
    style: o.style ?? 'volume', styleOpts: o.styleOpts ?? {},
  };
}

export const flatLobes = (lobes, out = []) => { for (const l of lobes) { out.push(l); if (l.children?.length) flatLobes(l.children, out); } return out; };

// Cellular (Worley F1) noise, about 0..1, for the erosion octaves.
function worley(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y); let best = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const px = xi + i + hash2(xi + i, yi + j, seed), py = yi + j + hash2(xi + i, yi + j, seed + 1), d = (px - x) ** 2 + (py - y) ** 2;
    if (d < best) best = d;
  }
  return Math.min(1, Math.sqrt(best));
}

// Summed chord length of the lobe tree at canvas point (x, y), in width units, and the mean lobe depth z there.
function chords(list, x, y) {
  let t = 0, zs = 0;
  for (const l of list) {
    const u = (x - l.c[0]) / l.r[0], v = (y - l.c[1]) / l.r[1], s = 1 - u * u - v * v;
    if (s > 0) { const ch = 2 * l.r[2] * Math.sqrt(s); t += ch; zs += ch * l.c[2]; }
  }
  return [t, t > 0 ? zs / t : 0];
}

// Lobes bucketed on a coarse grid (width units), so a chord lookup reads only the lobes that can cover the point.
function bucketLobes(list, cell = 0.04) {
  const map = new Map(), key = (i, j) => i * 100003 + j;
  for (const l of list) {
    for (let j = Math.floor((l.c[1] - l.r[1]) / cell); j <= Math.floor((l.c[1] + l.r[1]) / cell); j++)
      for (let i = Math.floor((l.c[0] - l.r[0]) / cell); i <= Math.floor((l.c[0] + l.r[0]) / cell); i++) {
        const k = key(i, j); if (!map.has(k)) map.set(k, []); map.get(k).push(l);
      }
  }
  return (x, y) => map.get(key(Math.floor(x / cell), Math.floor(y / cell))) ?? [];
}

// shade(cloud, { W, H, unit, q }) -> { mask, thickness, smooth, light, rim, gw, gh, q }. Grid step q px: fine
// enough (about 1100 cells across) that the silhouette, where the chord rises like a square root, stays smooth.
export function shade(cloud, view) {
  const { W, H, unit } = view, q = view.q ?? Math.max(1, Math.round(W / 1100)), gw = Math.ceil(W / q) + 1, gh = Math.ceil(H / q) + 1;
  const list = flatLobes(cloud.lobes), near = bucketLobes(list), N = gw * gh, thick = new Float32Array(N), mask = new Float32Array(N), light = new Float32Array(N), beer = new Float32Array(N), rim = new Float32Array(N);
  let top = Infinity, bottom = -Infinity; for (const l of list) { top = Math.min(top, l.c[1] - l.r[1]); bottom = Math.max(bottom, l.c[1] + l.r[1]); }
  const { base, seed } = cloud, ext = cloud.medium.extinction;
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const x = (gx * q) / unit, y = (gy * q) / unit, i = gy * gw + gx;
    let [t] = chords(near(x, y), x, y);
    if (t <= 0) { thick[i] = -0.01; continue; } // signed: empty cells sit below zero so the edge interpolates smoothly
    // surface erosion: strongest where the cloud is thin (the surface), and toward the top
    const hgt = clamp((bottom - y) / Math.max(1e-6, bottom - top)), surf = 1 - smoothstep(0, 0.05, t), wt = surf * (1 - cloud.erosionHeight + cloud.erosionHeight * hgt);
    for (const e of cloud.erosion) {
      const n = e.kind === 'worley' ? worley(x * e.scale, y * e.scale, seed + 11) : Math.abs(gradNoise(x * e.scale, y * e.scale, seed + 7) - 0.5) * 2;
      t -= e.amount * n * (0.4 + wt);
    }
    t *= smoothstep(base.y + base.soft, base.y - base.soft, y); // the flat base
    thick[i] = t; // may be negative after erosion: the silhouette is the zero crossing
  }
  // Light. The playbook's draft (5.3) asks for a two-tap Beer march through the summed chords. Measured against the
  // volumetric reference that ranks at Spearman 0.22: chords measure depth through the cloud, but light reaches the
  // visible front surface from the side. So this marches 12 taps (0.3 of the width) toward the light and sums the
  // in-mask path length, shortened by the slant when the light stands in front, plus half the chord when it stands
  // behind. Against the reference: 0.96 side light, 0.93 back light, 0.88 front-top, 0.77 front-side (a known gap).
  const L = cloud.light, taps = 12, span = 0.3, ds = span / taps;
  const m0 = new Float32Array(N); for (let i = 0; i < N; i++) m0[i] = smoothstep(0, 0.006, Math.max(0, thick[i]));
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = gy * gw + gx, t = Math.max(0, thick[i]);
    mask[i] = m0[i];
    if (mask[i] <= 0) continue;
    const x = (gx * q) / unit, y = (gy * q) / unit;
    let dx, dy, behind, front, dist;
    if (L.pos) { dx = L.pos[0] - x; dy = L.pos[1] - y; dist = Math.hypot(dx, dy) || 1e-6; dx /= dist; dy /= dist; behind = Math.max(0, -L.pos[2]); front = Math.max(0, L.pos[2]); }
    else { dist = Math.hypot(L.dir[0], L.dir[1]) || 1e-6; dx = L.dir[0] / dist; dy = L.dir[1] / dist; behind = Math.max(0, -L.dir[2]); front = Math.max(0, L.dir[2]); dist = 1; }
    // bilinear taps with a per-cell jitter: nearest taps on a hard mask quantise the path into facets
    let path = 0; const jit = hash2(gx, gy, 31);
    for (let k = 0; k < taps; k++) {
      const fx = gx + (dx * ds * (k + jit) * unit) / q, fy = gy + (dy * ds * (k + jit) * unit) / q;
      if (fx < 0 || fy < 0 || fx > gw - 1.001 || fy > gh - 1.001) continue;
      const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, o = iy * gw + ix;
      path += (m0[o] * (1 - tx) * (1 - ty) + m0[o + 1] * tx * (1 - ty) + m0[o + gw] * (1 - tx) * ty + m0[o + gw + 1] * tx * ty) * ds;
    }
    const slant = dist / Math.hypot(dist, front * 3), tau = path * slant + 0.5 * behind * t;
    beer[i] = Math.exp(-ext * tau);
    // multiple scattering by octaves (Wrenninge): each octave sees less extinction and carries half the energy,
    // so the deep cloud keeps a soft glow instead of going black; a point light also falls off with distance
    let ms = 0; for (let k = 0, a = 1, b2 = 1; k < 4; k++, a *= 0.5, b2 *= 0.45) ms += a * Math.exp(-ext * b2 * tau);
    const fall = L.pos ? 1 / (1 + (Math.hypot(L.pos[0] - x, L.pos[1] - y) / (L.falloff ?? 0.35)) ** 2) : 1;
    light[i] = Math.min(1, (ms / 1.875) * fall * (L.intensity ?? 1));
    rim[i] = (1 - smoothstep(0, 0.03, t)) * Math.max(clamp(behind * 4), 0.3) * beer[i];
  }
  // the march jitter trades facets for noise; one small blur of the light fields trades the noise for smoothness
  const blur3 = (A) => { const B = A.slice(); for (let gy = 1; gy < gh - 1; gy++) for (let gx = 1; gx < gw - 1; gx++) { const i = gy * gw + gx; if (!m0[i]) continue; let s2 = 0, n = 0; for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const o = i + j * gw + k; if (m0[o]) { s2 += A[o]; n++; } } B[i] = s2 / n; } return B; };
  const lightS = blur3(blur3(light)), beerS = blur3(blur3(beer)), rimS = blur3(rim);
  light.set(lightS); beer.set(beerS); rim.set(rimS);
  // a smoothed thickness for normals: the physical chord has an infinite slope at each lobe's rim, and normals
  // taken from it terrace into ledges; three box passes round them into lobes
  const smooth = thick.slice(), tmp = new Float32Array(N), r = Math.max(2, Math.round((0.008 * unit) / q)); // about 0.8% of the width, whatever the grid
  for (let pass = 0; pass < 3; pass++) for (const horiz of [true, false]) {
    const src = horiz ? smooth : tmp, dst = horiz ? tmp : smooth;
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      let s2 = 0, n = 0;
      for (let k = -r; k <= r; k++) { const xx = horiz ? gx + k : gx, yy = horiz ? gy : gy + k; if (xx >= 0 && yy >= 0 && xx < gw && yy < gh) { s2 += src[yy * gw + xx]; n++; } }
      dst[gy * gw + gx] = s2 / n;
    }
  }
  return { mask, thickness: thick, smooth, light, beer, rim, gw, gh, q };
}

// Bilinear read of a field at canvas pixel (x, y).
export function field(F, A, x, y) {
  const fx = clamp(x / F.q, 0, F.gw - 1.001), fy = clamp(y / F.q, 0, F.gh - 1.001), ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, w = F.gw;
  const a = A[iy * w + ix], b = A[iy * w + ix + 1], c = A[(iy + 1) * w + ix], d = A[(iy + 1) * w + ix + 1];
  return a + (b - a) * tx + (c - a + (d - c - b + a) * tx) * ty;
}
