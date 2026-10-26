// brush/tips.js: brush tips as alpha textures over tip space u, v in [-1, 1].
// A dab maps every canvas pixel into tip space (scale, aspect from tilt, rotation), then samples bilinearly,
// so one tip serves every size and angle without re-rasterising. Shapes are procedural: we build the tips the
// reference brush pack implies (soft round, smeared bristle, lobed cloud, star) rather than copying any.
import { fbm, gradNoise, rng, smoothstep, clamp } from './core.js';

const N = 128;
const cache = new Map();

class Tip {
  constructor(name, size, data) {
    this.name = name; this.size = size; this.data = data;
    // integral of alpha over tip space (u, v in [-1, 1], area 4): small dabs are normalised to it
    let s = 0; for (const v of data) s += v; this.integral = (s / data.length) * 4;
  }
  // u, v in [-1, 1]; returns alpha 0..1; zero outside the square.
  sample(u, v) {
    const n = this.size, x = (u * 0.5 + 0.5) * (n - 1), y = (v * 0.5 + 0.5) * (n - 1);
    if (x < 0 || y < 0 || x > n - 1 || y > n - 1) return 0;
    const x0 = x | 0, y0 = y | 0, x1 = x0 + 1 < n ? x0 + 1 : x0, y1 = y0 + 1 < n ? y0 + 1 : y0, fx = x - x0, fy = y - y0, d = this.data;
    const a = d[y0 * n + x0], b = d[y0 * n + x1], c = d[y1 * n + x0], e = d[y1 * n + x1];
    return (a + (b - a) * fx) + ((c + (e - c) * fx) - (a + (b - a) * fx)) * fy;
  }
}

function build(name, fn) {
  const d = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i / (N - 1)) * 2 - 1, v = (j / (N - 1)) * 2 - 1;
    d[j * N + i] = clamp(fn(u, v));
  }
  return new Tip(name, N, d);
}

const shapes = {
  // hardness 0: a gaussian that reaches exactly zero at the rim (no hard ring at the dab's edge).
  round: ({ hardness = 0.5 }) => (u, v) => {
    const r = Math.hypot(u, v);
    if (r >= 1) return 0;
    if (hardness <= 0) return Math.exp(-4.5 * r * r) * (1 - r * r);
    return 1 - smoothstep(hardness, 1, r);
  },
  square: ({ hardness = 0.7 }) => (u, v) => {
    const r = Math.max(Math.abs(u), Math.abs(v));
    return 1 - smoothstep(hardness, 1, r);
  },
  // A billow: a lobed silhouette (radius modulated by angle noise) with mottled density inside,
  // the way a cloud brush leaves a cauliflower edge and a broken interior.
  cloud: ({ seed = 3, lobes = 0.22, mottle = 0.22 }) => (u, v) => {
    const r = Math.hypot(u, v), a = Math.atan2(v, u);
    const edge = 0.7 + lobes * (fbm(Math.cos(a) * 1.4 + 5, Math.sin(a) * 1.4 + 5, seed, 2) - 0.5) * 2;
    const body = 1 - smoothstep(edge - 0.22, edge, r);
    return body * (1 - mottle + mottle * (0.6 * gradNoise(u * 2 + 9, v * 2 + 9, seed + 7) + 0.4 * gradNoise(u * 4 + 3, v * 4 + 3, seed + 8)));
  },
  // Hairs along v. Each hair has its own offset, weight and length, so a drag leaves streaks (the smeared,
  // combed strokes across the water in image 18).
  bristle: ({ seed = 5, hairs = 26, width = 0.035 }) => {
    const R = rng(seed), list = Array.from({ length: hairs }, () => ({ u: R() * 1.7 - 0.85, w: width * (0.5 + R()), len: 0.55 + 0.45 * R(), k: 0.4 + 0.6 * R() }));
    return (u, v) => {
      let s = 0;
      for (const h of list) {
        const du = (u - h.u) / h.w;
        if (du * du > 9) continue;
        s += h.k * Math.exp(-du * du) * (1 - smoothstep(h.len * 0.6, h.len, Math.abs(v)));
      }
      return s * 0.7;
    };
  },
  // An astroid, |u|^(2/3) + |v|^(2/3) <= 1: the concave four-cusp star of images 19 and 24. The big stars there
  // are this shape (wide at the centre, sides curving in to needle cusps), not a flare with thin arms.
  astroid: ({ soft = 0.12, exp = 2 / 3 }) => (u, v) => {
    const q = Math.abs(u) ** exp + Math.abs(v) ** exp;
    return 1 - smoothstep(1 - soft, 1, q);
  },
  // A four-point star: arms fall off as about 1 / r (the reference flares measure a power of 0.8 to 1.0 along
  // the spikes), thin secondary arms on the diagonals, and a soft round core.
  flare: ({ arms = 4, secondary = 0.12, thin = 0.014, core = 0.12, power = 0.9 }) => (u, v) => {
    const r = Math.hypot(u, v);
    if (r >= 1) return 0;
    const a = Math.atan2(v, u), taper = 1 - smoothstep(0.55, 1, r);
    let s = Math.exp(-(r * r) / (core * core));
    for (let k = 0; k < arms * 2; k++) {
      const main = k % 2 === 0, ang = (k * Math.PI) / arms, d = Math.abs(Math.sin(a - ang)) * r, along = Math.cos(a - ang) * r;
      if (along <= 0) continue;
      const w = thin * (main ? 1 : 0.6) * (1 + 2.5 * (1 - r)), fall = (0.05 / (0.05 + along)) ** (main ? power : power * 1.8);
      s += (main ? 1 : secondary) * Math.exp(-(d * d) / (w * w)) * fall * taper;
    }
    return s;
  },
};

// tip('round', { hardness: 0 }) -> Tip. Cached by name and options.
export function tip(name, opts = {}) {
  const key = name + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  if (!shapes[name]) throw new Error(`brush: unknown tip "${name}"`);
  const t = build(name, shapes[name](opts));
  cache.set(key, t);
  return t;
}

export const TIP_NAMES = Object.keys(shapes);
