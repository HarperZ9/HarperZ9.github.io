// brush/grain.js: tileable grain textures with a stated feature period, in canvas pixels.
// The reference (image 18, 2000 px tall) carries a mottled sponge grain whose residual spectrum centres on a
// 5.9 to 7.8 px period, about 0.0035 of the frame height. A painting states its grain as a fraction of the
// canvas, so a 4K export carries the same grain, not a finer one.
import { gradNoise as noise, smoothstep } from './core.js';

const LATTICE = 32; // lattice cells per tile; the tile wraps exactly because the lattice wraps

export class Grain {
  // kind: 'paper' (two octaves, soft), 'sponge' (blobs and holes), 'speckle' (fine, sharp)
  constructor({ period = 7, kind = 'sponge', seed = 11 } = {}) {
    if (!(period >= 1)) throw new RangeError('grain: period must be at least 1 px');
    this.period = period; this.kind = kind;
    const size = Math.max(8, Math.round(LATTICE * period));
    this.size = size;
    const d = new Float32Array(size * size), k = LATTICE / size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x * k, v = y * k;
      let g;
      if (kind === 'paper') g = 0.65 * noise(u, v, seed, LATTICE) + 0.35 * noise(u * 2, v * 2, seed + 1, LATTICE * 2);
      else if (kind === 'speckle') g = smoothstep(0.28, 0.72, noise(u * 2, v * 2, seed, LATTICE * 2));
      else g = smoothstep(0.32, 0.68, 0.7 * noise(u, v, seed, LATTICE) + 0.3 * noise(u * 2, v * 2, seed + 1, LATTICE * 2));
      d[y * size + x] = g;
    }
    // normalise to mean 0.5, range clamped to 0..1, so depth means the same thing for every kind
    let m = 0; for (const v of d) m += v; m /= d.length;
    for (let i = 0; i < d.length; i++) d[i] = Math.min(1, Math.max(0, d[i] - m + 0.5));
    this.data = d;
  }
  // Sample with wrap; grain is a texture of the paper, so it stays put under every dab. Pixel centres land on
  // texel centres (the texture is built at canvas resolution), so nearest is exact here.
  at(x, y) {
    const s = this.size; let i = Math.floor(x) % s, j = Math.floor(y) % s;
    if (i < 0) i += s; if (j < 0) j += s;
    return this.data[j * s + i];
  }
}

// A cache keyed by rounded period, so a stroke list replays with one texture per grain setting.
const cache = new Map();
// Below 1 px a grain cannot be drawn finer than the pixel grid, so small renders (thumbnails) clamp to 1 px.
export function grainFor(period, kind = 'sponge', seed = 11) {
  const p = Math.max(1, Math.round(period * 4) / 4), key = `${kind}:${seed}:${p}`;
  if (!cache.has(key)) cache.set(key, new Grain({ period: p, kind, seed }));
  return cache.get(key);
}
