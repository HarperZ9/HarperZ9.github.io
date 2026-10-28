// lib/living/states.mjs: the states of living type, as plugins. A state paints the word in one medium:
//   defineState({ id, title, kind: 'analog' | 'digital' | 'print', breath: { amp px, rate Hz }, paint(C) -> rgb })
// paint returns a full opaque image in linear light (w * h * 3), ground included, from the context C (context()).
// The registry is open: registerState() adds a state, and the transition graph (graph.mjs) connects it to every other
// by its kind. This file holds the analog mediums; digital and print states are in states-digital.mjs.
import { prepareBloom } from '../../../superframe/lib/medium/inkbloom.mjs';
import { absorb } from '../../../superframe/lib/medium/additives.mjs';
import { clamp, noise, blur, smear, tangents, linear, rng, lerp, PAPER } from './fields.mjs';

export const STATES = new Map();
export function registerState(s) {
  for (const k of ['id', 'title', 'kind', 'paint']) if (!s[k]) throw new Error(`living: state needs ${k}`);
  STATES.set(s.id, { breath: { amp: 0.6, rate: 0.07 }, ...s }); return s;
}
export function state(id) { const s = STATES.get(id); if (!s) throw new Error(`living: unknown state "${id}" (one of ${[...STATES.keys()].join(', ')})`); return s; }

/** Everything a state may read, computed once per word and shared (lazily) by every state painted from it. */
export function context(G, { seed = 1, paper = PAPER } = {}) {
  const C = { G, w: G.w, h: G.h, cov: G.coverage.data, seed, paper: linear(paper ?? PAPER), size: G.size };
  const lazy = (k, f) => Object.defineProperty(C, k, { get() { const v = f(); Object.defineProperty(C, k, { value: v }); return v; }, configurable: true });
  lazy('sdf', () => G.sdf.data);
  lazy('tan', () => tangents(G));
  lazy('stroke', () => { let s = 0, n = 0; for (const t of G.strokes.strokes) { s += t.width; n++; } return n ? s / n : G.size * 0.12; });
  return C;
}
const ground = (C, rgb = C.paper) => { const out = new Float32Array(C.w * C.h * 3); for (let i = 0; i < C.w * C.h; i++) out.set(rgb, i * 3); return out; };
/** Paint one pigment by transmission (Beer-Lambert): amount a per pixel, colour hex, over the image in place. */
export function pigment(img, a, hex, k = 3.2) { const A = absorb(hex); for (let i = 0; i < a.length; i++) { if (a[i] <= 0) continue; for (let c = 0; c < 3; c++) img[i * 3 + c] *= Math.exp(-A[c] * k * a[i]); } return img; }

registerState({
  id: 'ink', title: 'Ink', kind: 'analog', breath: { amp: 0.5, rate: 0.05 },
  // the medium's ink bloom (lib/medium/inkbloom.mjs): dense core, fibrous feathered edge, pale halo; settled age
  paint(C, { age = 0.7 * Math.min(1, C.size / 90), color = '#1d2a3a' } = {}) { // the bloom is a share of the letter, so small type blooms less
    const d = { mask: C.cov, gw: C.w, gh: C.h, S: Math.max(1, C.stroke / 10) / Math.max(1, C.stroke / 10) };
    prepareBloom(d, absorb('#5b7896'), C.seed);
    const a = new Float32Array(C.w * C.h), halo = new Float32Array(C.w * C.h);
    for (let i = 0; i < a.length; i++) {
      const core = C.cov[i], soft = d.B1[i], wide = d.B2[i] * (1 - age) + d.B3[i] * age, fib = d.N[i];
      a[i] = 1.25 * (core * (1 - 0.3 * age) + soft * 0.3 * age) + 0.5 * clamp(soft - core) * (0.4 + 1.4 * fib) * age;
      halo[i] = 0.18 * wide * (0.3 + 1.3 * fib) * age * (1 - 0.8 * core);
    }
    return pigment(pigment(ground(C), halo, '#5b7896'), a, color);
  },
});

registerState({
  id: 'charcoal', title: 'Charcoal', kind: 'analog', breath: { amp: 0.3, rate: 0.04 },
  // grain caught on the paper's tooth, dragged along the stroke, a side smudge, and dust fallen below the letters
  paint(C) {
    const { w, h } = C, tooth = noise(w, h, 1.3, C.seed + 11, 2), fib = noise(w, h, 6, C.seed + 12, 2), dep = new Float32Array(w * h);
    for (let i = 0; i < dep.length; i++) dep[i] = C.cov[i] * clamp((tooth[i] - 0.28 + 0.35 * fib[i]) * 2.2);
    const drag = smear(dep, w, h, C.tan.tx, C.tan.ty, C.stroke * 0.35, 6), smudge = blur(dep, w, h, C.stroke * 0.18), a = new Float32Array(w * h);
    for (let i = 0; i < a.length; i++) a[i] = 0.95 * Math.max(dep[i], drag[i] * 0.8) + 0.22 * smudge[i];
    const r = rng(C.seed + 3), fall = C.size * 0.5;
    for (let n = 0; n < w * h * 0.004; n++) {
      const x = (r() * w) | 0, y = (r() * h) | 0; if (C.cov[y * w + x] < 0.5) continue;
      const yy = Math.min(h - 1, y + Math.round(r() ** 2 * fall)); if (C.cov[yy * w + x] > 0.2) continue;
      a[yy * w + x] += 0.35 + 0.4 * r();
    }
    return pigment(ground(C), a, '#262422', 2.6);
  },
});

registerState({
  id: 'plant', title: 'Plant smear', kind: 'analog', breath: { amp: 0.7, rate: 0.05 },
  // crushed leaf dragged along each stroke: fibrous streaks that follow the stroke, chlorophyll green turning brown
  // along it, and crushed-petal pigment caught in the fibres
  paint(C) {
    const { w, h } = C, n = noise(w, h, 1.1, C.seed + 21, 2), streak = smear(n, w, h, C.tan.tx, C.tan.ty, C.stroke * 1.4, 10), petal = noise(w, h, C.stroke * 0.5, C.seed + 22, 2);
    const img = ground(C), green = linear('#3d6a26'), brown = linear('#6a4a26'), rose = linear('#8e2f5c');
    const edge = blur(C.cov, w, h, 0.6);
    for (let i = 0; i < w * h; i++) {
      const body = clamp(edge[i] * 1.35 - 0.12 * (1 - streak[i] * 1.6)); if (body <= 0) continue;
      const s = clamp((streak[i] - 0.3) * 2.4), col = [0, 1, 2].map((c) => lerp(green[c], brown[c], clamp(C.tan.arc[i] * 0.9 + 0.2 * (1 - s))));
      const p = clamp((petal[i] - 0.66) * 6) * body; for (let c = 0; c < 3; c++) col[c] = lerp(col[c], rose[c], p * 0.8);
      const op = body * (0.8 + 0.2 * s);
      for (let c = 0; c < 3; c++) img[i * 3 + c] = lerp(img[i * 3 + c], col[c] * (0.55 + 0.6 * s), op);
    }
    return img;
  },
});

registerState({
  id: 'paint', title: 'Paint', kind: 'analog', breath: { amp: 0.25, rate: 0.03 },
  // impasto: a body of paint whose height rises inside the stroke, bristle ridges along it, lit from the upper left,
  // and a drying edge where the thin rim has darkened
  paint(C, { color = '#27408f' } = {}) {
    const { w, h } = C, bristle = smear(noise(w, h, 1.2, C.seed + 31, 2), w, h, C.tan.tx, C.tan.ty, C.stroke * 0.9, 8), H = new Float32Array(w * h);
    for (let i = 0; i < H.length; i++) H[i] = C.cov[i] * clamp(-C.sdf[i] / (C.stroke * 0.45) + 0.15) * (0.7 + 0.6 * bristle[i]);
    const S = blur(H, w, h, 1), img = ground(C), base = linear(color);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; if (C.cov[i] <= 0.02) continue;
      const nx = (S[i - 1] - S[i + 1]) * 6, ny = (S[i - w] - S[i + w]) * 6, shade = clamp(0.78 + (nx * -0.6 + ny * -0.6) / Math.hypot(nx, ny, 1), 0.35, 1.5);
      const rim = C.sdf[i] > -2.2 && C.sdf[i] < 0 ? 0.6 : 1;
      for (let c = 0; c < 3; c++) img[i * 3 + c] = lerp(img[i * 3 + c], base[c] * shade * rim, C.cov[i]);
    }
    return img;
  },
});
