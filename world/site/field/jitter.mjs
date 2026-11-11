// jitter.mjs: the reference for the field's sample-jitter kernel (mask and jit in scene.glsl.js).
//
// Contract
//   blueMask(n, seed)    -> Float32Array of n * n values, each rank / (n * n), so every value in [0, 1) appears once.
//                        A void-and-cluster ordering (Ulichney 1993, "The void-and-cluster method for dither array
//                        generation") on a torus: each next rank goes to the emptiest place left, measured by a
//                        Gaussian of sigma 1.9 texels. Neighbours differ, the tile wraps with no seam, and the
//                        mask has little energy at low spatial frequency, so one sample per pixel shows as fine
//                        even grain with no direction. Deterministic for a seed.
//   jit(m, x, y, seq, dim) -> a value in [0, 1). m is the mask (64 by 64 in the shader, the uBlue texture), seq the
//                        frame or sample index, dim the use inside a frame. One pixel walks seq by the golden
//                        ratio, so n samples of one dim are spread evenly in [0, 1) with a largest gap under 3 / n,
//                        and dims are offset by the plastic number.
//   ign(x, y)            interleaved gradient noise (Jimenez 2014), the kernel before this one. Kept as the
//                        comparison in the test: its diagonal structure showed as a hatch at one sample per pixel.
//   Tolerance            float32 arithmetic, the same operation order as the shader. The test holds this file to
//                        fixed vectors and to the constants in the shader source. Equality with a GPU is not
//                        tested here: drivers may fuse or reorder float operations.
const f = Math.fround;
const fract = (v) => f(v - Math.floor(v));
export const IGN = { scale: 52.9829189, kx: 0.06711056, ky: 0.00583715 }, GOLDEN = 0.61803399, PLASTIC = 0.75487767;
export function ign(x, y) {
  const px = f(x + 0.5), py = f(y + 0.5), d = f(f(px * f(IGN.kx)) + f(py * f(IGN.ky)));
  return fract(f(f(IGN.scale) * fract(d)));
}
export const MASK_N = 64;
export function blueMask(n = MASK_N, seed = 1) {
  const N = n * n, e = new Float64Array(N), out = new Float32Array(N), used = new Uint8Array(N), k = new Float64Array(N);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = Math.min(x, n - x), dy = Math.min(y, n - y); k[y * n + x] = Math.exp(-(dx * dx + dy * dy) / (2 * 1.9 * 1.9));
  }
  // a tiny seeded ripple breaks the ties of the empty tile
  let h = seed >>> 0; for (let i = 0; i < N; i++) { h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; e[i] = (h / 4294967296) * 1e-6; }
  for (let r = 0; r < N; r++) {
    let best = -1, bv = Infinity; for (let i = 0; i < N; i++) if (!used[i] && e[i] < bv) { bv = e[i]; best = i; }
    used[best] = 1; out[best] = r / N; const bx = best % n, by = (best / n) | 0;
    for (let y = 0; y < n; y++) { const ky = ((y - by + n) % n) * n, row = y * n; for (let x = 0; x < n; x++) e[row + x] += k[ky + ((x - bx + n) % n)]; }
  }
  return out;
}
export function jit(m, x, y, seq, dim) {
  return fract(f(f(m[(y & 63) * 64 + (x & 63)] + f(f(GOLDEN) * f(seq))) + f(f(PLASTIC) * f(dim))));
}
