// morphcloud.js: a point cloud that steps between shapes. 5,000 to 60,000 points re-form, one target after another.
//
// Synthesis, not one source: the step clock of the reasoning-view cloud (shridhar: the cloud re-forms in steps at
// about 7 Hz), the physical honesty of our Chladni build (a real equation decides where the sand lies), the halo of
// the July dendrite family (a share of points never settles and hangs as dust), and Powers-of-Ten style travel
// where every point keeps its identity. Targets come from equations (plate modes, phyllotaxis at a printed angle,
// hydrogen orbitals), from glyph masks (lettering lib), from SDFs, mesh edges or a data series.
//
// Two clocks (cadence.js): the shape clock picks the target; the step clock quantises time, so the cloud moves in
// held steps (default 'step-7') instead of a smooth tween. Assignment between shapes sorts both point sets by
// Morton order and pairs them rank for rank, so neighbours stay neighbours and paths stay short. Positions are a
// pure function of t: positionsAt(t) gives the same floats at any display rate.
import { clock } from './cadence.js';
import { defineNode } from './lib/node.js';
import { image, fill, disc, rect } from './lib/raster.js';
import { hash01, EASE, hexToRgb } from './lib/util.js';

export * as TARGETS from './lib/morphcloud-targets.js';

// Morton code of a point quantised to 16 bits per axis over the frame.
const spread = (v) => { v &= 0xffff; v = (v | (v << 8)) & 0x00ff00ff; v = (v | (v << 4)) & 0x0f0f0f0f; v = (v | (v << 2)) & 0x33333333; return (v | (v << 1)) & 0x55555555; };
export const morton = (x, y, w, h) => ((spread(Math.max(0, Math.min(65535, Math.floor((x / w) * 65535)))) | (spread(Math.max(0, Math.min(65535, Math.floor((y / h) * 65535)))) << 1)) >>> 0);
const order = (pts, w, h) => { const n = pts.length / 2, code = new Uint32Array(n), idx = Array.from({ length: n }, (_, i) => i); for (let i = 0; i < n; i++) code[i] = morton(pts[2 * i], pts[2 * i + 1], w, h); return idx.sort((a, b) => code[a] - code[b] || a - b); };

// Reorder `to` so that out[i] is the target of the point now at from[i]: both sets ranked by Morton order.
export function assign(from, to, w, h) {
  const a = order(from, w, h), b = order(to, w, h), out = new Float32Array(to.length);
  for (let r = 0; r < a.length; r++) { out[2 * a[r]] = to[2 * b[r]]; out[2 * a[r] + 1] = to[2 * b[r] + 1]; }
  return out;
}

export class MorphCloud {
  constructor({ targets, n = 20000, w = 1440, h = 900, seed = 1, cell = 3, stray = 0.03, halo = 0.035, travel = 0.5, stagger = 0.35, boil = 0.3, shape = { fps: 10, holds: [28] }, step = 'step-7' } = {}) {
    if (!(n >= 1 && n <= 200000)) throw new RangeError('morphcloud: n out of range');
    Object.assign(this, { n, w, h, seed, cell, stray, halo, travel, stagger, boil });
    this.shapeClock = clock(shape, { seed }); this.stepClock = step ? clock(step, { seed }) : null;
    this.targets = targets.map((make, k) => make(n, { w, h, seed: seed * 7919 + k, cell }));
    // Each shape is stored in Morton order. Point r travels from rank r of one shape to rank r of the next, so the
    // pairing is the assign() pairing and the cycle closes on itself with no jump.
    this.rest = this.targets.map((T, k) => {
      const pts = T.pts.slice(), sig = halo * Math.min(w, h);
      for (let j = 0; j < n; j++) if (hash01(seed + 31 * k, j) < stray) { // dust: this point hangs off its slot
        const u = Math.max(1e-6, hash01(seed ^ 0xa5, j * 3 + k)), v = hash01(seed ^ 0x5a, j * 3 + k), g = Math.sqrt(-2 * Math.log(u)) * sig;
        pts[2 * j] += g * Math.cos(6.2832 * v); pts[2 * j + 1] += g * Math.sin(6.2832 * v);
      }
      const o = order(pts, w, h), out = new Float32Array(2 * n);
      o.forEach((i, r) => { out[2 * r] = pts[2 * i]; out[2 * r + 1] = pts[2 * i + 1]; });
      return out;
    });
  }
  // Which shape is current at t, and the quantised time the cloud is drawn at.
  shapeAt(t) { const ts = this.stepClock ? this.stepClock.at(t).start : t, st = this.shapeClock.at(ts); return { k: st.index % this.targets.length, index: st.index, local: st.local, ts, label: this.targets[st.index % this.targets.length].label }; }
  positionsAt(t, out = new Float32Array(2 * this.n)) {
    const { k, index, local } = this.shapeAt(t), K = this.targets.length, to = this.rest[k];
    const from = index === 0 ? to : this.rest[(k + K - 1) % K], dest = to;
    const travel = this.travel, st = this.stagger, cyc = this.stepClock ? this.stepClock.indexAt(t) : 0, bj = this.boil * this.cell;
    for (let i = 0; i < this.n; i++) {
      const d = (i / this.n) * st, u = EASE.outCubic((local / travel - d) / (1 - st));
      const jx = bj ? (hash01(cyc, i) - 0.5) * bj : 0, jy = bj ? (hash01(cyc ^ 0x9e37, i) - 0.5) * bj : 0;
      out[2 * i] = from[2 * i] + (dest[2 * i] - from[2 * i]) * u + jx; out[2 * i + 1] = from[2 * i + 1] + (dest[2 * i + 1] - from[2 * i + 1]) * u + jy;
    }
    return out;
  }
  // Share of points within tol px of shape k's surface, measured at rest.
  restShare(k, tol = this.cell) { const T = this.targets[k], P = this.rest[k]; let c = 0; for (let i = 0; i < this.n; i++) if (T.near(P[2 * i], P[2 * i + 1], tol)) c++; return c / this.n; }
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// CPU reference render. 'additive': each point a small anti-aliased disc summed in light on a dark ground.
// 'dither': point density counted per cell and thresholded through a 4 x 4 Bayer matrix into square ink sprites
// on a light ground (the single-ink look of a printed reasoning view).
export function renderCPU(pos, { w, h, mode = 'additive', ground = mode === 'dither' ? '#efe8d8' : '#0f0f0e', ink = mode === 'dither' ? '#15130f' : '#eee9df', r = 0.7, alpha = 0.55, cell = 3, gain = 1.6, scale = 1 } = {}) {
  const im = fill(image(Math.round(w * scale), Math.round(h * scale)), ground), n = pos.length / 2;
  if (mode === 'additive') { const c = hexToRgb(ink); for (let i = 0; i < n; i++) disc(im, pos[2 * i] * scale, pos[2 * i + 1] * scale, r * scale, c, alpha, 'add'); return im; }
  const cw = Math.ceil(w / cell), ch = Math.ceil(h / cell), cnt = new Float32Array(cw * ch);
  for (let i = 0; i < n; i++) { const x = Math.floor(pos[2 * i] / cell), y = Math.floor(pos[2 * i + 1] / cell); if (x >= 0 && y >= 0 && x < cw && y < ch) cnt[y * cw + x]++; }
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const v = Math.min(1, (cnt[y * cw + x] / gain) * 0.5), th = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    if (v > th) rect(im, x * cell * scale + 0.5 * scale, y * cell * scale + 0.5 * scale, (x + 1) * cell * scale - 0.5 * scale, (y + 1) * cell * scale - 0.5 * scale, ink);
  }
  return im;
}

export const SPEC = Object.freeze({
  inputs: { targets: 'array of target makers from TARGETS (plate, phyllotaxis, orbital, mask, sdf, polylines, series)', seed: 'uint32' },
  params: {
    n: { range: [5000, 60000], unit: 'points', default: 20000 },
    cell: { range: [1, 12], unit: 'CSS px, dither cell and rest tolerance', default: 3 },
    stray: { range: [0, 0.2], unit: 'share of points that hang as dust per shape', default: 0.03 },
    halo: { range: [0, 0.15], unit: 'share of the short frame side, dust spread (1 sigma)', default: 0.035 },
    travel: { range: [0.1, 1], unit: 'share of a shape hold spent travelling', default: 0.5 },
    stagger: { range: [0, 0.9], unit: 'share of travel spread over Morton rank (a cascade)', default: 0.35 },
    boil: { range: [0, 1], unit: 'cells of jitter re-seeded on each step', default: 0.3 },
  },
  determinism: 'positionsAt(t) is a pure function of (targets, n, seed, t); targets sample with seeded generators',
  budget: '20,000 points: positionsAt under 2 ms in node; drawn only on step changes (about 7 a second)',
});

export const node = defineNode({
  id: 'morphcloud', ports: { in: { targets: 'data' }, out: { points: 'points', image: 'image' } }, params: SPEC.params, seed: 1,
  render: ({ seed, params, inputs = {}, w = 640, h = 400, t = 0 }) => {
    const cloud = new MorphCloud({ targets: inputs.targets, n: params.n, w, h, seed, cell: params.cell, stray: params.stray, halo: params.halo, travel: params.travel, stagger: params.stagger, boil: params.boil });
    const pos = cloud.positionsAt(t); return { points: pos, image: renderCPU(pos, { w, h }) };
  },
});
