// Lesson K22, "Matmul tiling". Pure ES module, no DOM and no dependencies:
// the lab page, a worker and the Node fill script share it.
//
// C = A x B for square n x n float32 matrices, row-major. Three kernels:
//   naive   one invocation per output element; every operand of its dot
//           product is read from global memory (2n reads per output);
//   tiled   a workgroup of T x T invocations owns a T x T block of C; for
//           each of ceil(n / T) phases it copies a T x T tile of A and of B
//           into workgroup (shared) memory, waits at a barrier, does T
//           multiply-adds per invocation from shared memory, and waits again
//           before the next copy. This is the CUDA C++ Programming Guide's
//           shared-memory matrix multiply (section 3.2.4 of the 12.x guides,
//           BLOCK_SIZE 16), written in WGSL;
//   stale   the tiled kernel without its first barrier. The emulator runs
//           the worst schedule that missing barrier allows: every read of
//           phase t sees the tile left by phase t - 1 (zeros in phase 0, as
//           WGSL zero-initialises workgroup memory).
// The emulator below runs these kernels invocation by invocation in the
// grouping WGSL defines and counts global loads and stores, shared loads and
// stores, barriers and multiply-adds. Counts are requests the kernel issues.
// A real GPU's caches can serve some of the naive kernel's repeated reads
// without a trip to DRAM; the counts say what the program asks for, not what
// the memory system does with it.

import { rng } from "./tinyformer-ops.mjs";

export const WORD = 4, U32 = 2 ** -24;
export const KINDS = Object.freeze(["naive", "tiled", "stale"]);

const HEAD = `struct Params { n: u32, p0: u32, p1: u32, p2: u32 }
@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> c: array<f32>;
@group(0) @binding(3) var<uniform> p: Params;
`;

// WGSL source for one kernel. T is the tile (and workgroup) edge; the naive
// kernel uses a T x T workgroup too, so both dispatch ceil(n / T)^2 groups.
export function wgsl(kind, T = 16) {
  if (!KINDS.includes(kind)) throw new Error("unknown kernel " + kind);
  if (T * T > 256) throw new Error("T * T must fit WebGPU's default 256 invocations per workgroup");
  if (kind === "naive") return HEAD + `@compute @workgroup_size(${T}, ${T})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let row = gid.y; let col = gid.x;
  if (row >= p.n || col >= p.n) { return; }
  var acc = 0.0;
  for (var k = 0u; k < p.n; k++) { acc = acc + a[row * p.n + k] * b[k * p.n + col]; }
  c[row * p.n + col] = acc;
}
`;
  const first = kind === "stale" ? "    // first barrier missing: reads may see the previous tile\n" : "    workgroupBarrier();\n";
  return HEAD + `const T: u32 = ${T}u;
var<workgroup> As: array<f32, ${T * T}>;
var<workgroup> Bs: array<f32, ${T * T}>;
@compute @workgroup_size(${T}, ${T})
fn main(@builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wid: vec3<u32>) {
  let tx = lid.x; let ty = lid.y;
  let row = wid.y * T + ty; let col = wid.x * T + tx;
  var acc = 0.0;
  let phases = (p.n + T - 1u) / T;
  for (var t = 0u; t < phases; t++) {
    let ak = t * T + tx; let bk = t * T + ty;
    var av = 0.0; if (row < p.n && ak < p.n) { av = a[row * p.n + ak]; }
    var bv = 0.0; if (bk < p.n && col < p.n) { bv = b[bk * p.n + col]; }
    As[ty * T + tx] = av;
    Bs[ty * T + tx] = bv;
${first}    for (var k = 0u; k < T; k++) { acc = acc + As[ty * T + k] * Bs[k * T + tx]; }
    workgroupBarrier();
  }
  if (row < p.n && col < p.n) { c[row * p.n + col] = acc; }
}
`;
}

// ---- inputs, reference, checker ----

// Uniform values in [-1, 1), rounded to float32.
export function makeMatrices(n, seed = 1) {
  const r = rng(seed), a = new Float32Array(n * n), b = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) a[i] = 2 * r() - 1;
  for (let i = 0; i < n * n; i++) b[i] = 2 * r() - 1;
  return { a, b };
}

// Float64 reference and, per output, sum_k |a_ik b_kj| for the error bound.
// rows < n computes only the first rows (a quick check of a large n).
export function cpuReference(a, b, n, rows = n) {
  const c = new Float64Array(rows * n), mag = new Float64Array(rows * n);
  for (let i = 0; i < rows; i++) for (let k = 0; k < n; k++) {
    const x = a[i * n + k], ax = Math.abs(x), o = i * n, q = k * n;
    for (let j = 0; j < n; j++) { const y = b[q + j]; c[o + j] += x * y; mag[o + j] += ax * Math.abs(y); }
  }
  return { c, mag };
}

// Tolerance: gamma_n * sum_k |a_ik b_kj| with gamma_n = n u / (1 - n u),
// u = 2^-24 (Higham, Accuracy and Stability of Numerical Algorithms, 2nd
// ed., equation 3.5: the error of a float inner product of length n in any
// summation order, with or without fused multiply-add).
export const gamma = (n) => (n * U32) / (1 - n * U32);

export function checkMatmul(got, ref, n) {
  const g = gamma(n);
  let bad = 0, first = -1, maxErr = 0, maxRatio = 0;
  for (let i = 0; i < ref.c.length; i++) {
    const e = Math.abs(got[i] - ref.c[i]), bound = g * ref.mag[i] + 1e-30;
    if (!(e <= bound)) { bad++; if (first < 0) first = i; }
    if (e > maxErr) maxErr = e;
    if (e / bound > maxRatio) maxRatio = e / bound;
  }
  return { ok: bad === 0, mismatches: bad, first, maxErr, maxRatio, gamma: g };
}

// ---- the emulator ----

const zero = () => ({ globalLoads: 0, globalStores: 0, sharedLoads: 0, sharedStores: 0, barriers: 0, barrierArrivals: 0, fma: 0, idle: 0 });

// trace (optional): Int32Array(2 n n) counting reads of each A then B element.
function naiveGroup(S, gx, gy) {
  const { a, b, c, n, T, C, trace } = S;
  for (let ly = 0; ly < T; ly++) for (let lx = 0; lx < T; lx++) {
    const row = gy * T + ly, col = gx * T + lx;
    if (row >= n || col >= n) { C.idle++; continue; }
    let acc = 0;
    for (let k = 0; k < n; k++) acc = Math.fround(acc + Math.fround(a[row * n + k] * b[k * n + col]));
    if (trace) for (let k = 0; k < n; k++) { trace[row * n + k]++; trace[n * n + k * n + col]++; }
    C.globalLoads += 2 * n; C.fma += n;
    c[row * n + col] = acc; C.globalStores++;
  }
}

// One phase's copy into shared memory: each invocation loads one element of
// A and one of B (or 0 outside the matrix) and stores both to shared memory.
function copyTile(S, gx, gy, t, As, Bs) {
  const { a, b, n, T, C, trace } = S;
  for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
    const row = gy * T + ty, col = gx * T + tx, ak = t * T + tx, bk = t * T + ty;
    let av = 0, bv = 0;
    if (row < n && ak < n) { av = a[row * n + ak]; C.globalLoads++; if (trace) trace[row * n + ak]++; }
    if (bk < n && col < n) { bv = b[bk * n + col]; C.globalLoads++; if (trace) trace[n * n + bk * n + col]++; }
    As[ty * T + tx] = av; Bs[ty * T + tx] = bv; C.sharedStores += 2;
  }
}

function tiledGroup(S, gx, gy) {
  const { n, T, C, kind } = S, phases = Math.ceil(n / T), acc = new Float64Array(T * T);
  const As = new Float32Array(T * T), Bs = new Float32Array(T * T);
  for (let t = 0; t < phases; t++) {
    if (kind === "stale") multiply(S, As, Bs, acc);
    copyTile(S, gx, gy, t, As, Bs);
    if (kind !== "stale") { C.barriers++; C.barrierArrivals += T * T; multiply(S, As, Bs, acc); }
    C.barriers++; C.barrierArrivals += T * T;
  }
  for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
    const row = gy * T + ty, col = gx * T + tx;
    if (row < n && col < n) { S.c[row * n + col] = acc[ty * T + tx]; C.globalStores++; }
  }
}

function multiply(S, As, Bs, acc) {
  const { T, C } = S;
  for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
    let v = acc[ty * T + tx];
    for (let k = 0; k < T; k++) v = Math.fround(v + Math.fround(As[ty * T + k] * Bs[k * T + tx]));
    acc[ty * T + tx] = v;
  }
  C.sharedLoads += 2 * T * T * T; C.fma += T * T * T;
}

// Step-at-a-time emulation: step(k) runs k more workgroups (row-major over
// the ceil(n / T)^2 grid). result() returns the counts and C.
export function createEmulation({ kind = "tiled", n, T = 16, a, b, trace = false }) {
  if (!KINDS.includes(kind)) throw new Error("unknown kernel " + kind);
  const G = Math.ceil(n / T), S = { kind, n, T, a, b, c: new Float32Array(n * n), C: zero(), trace: trace ? new Int32Array(2 * n * n) : null };
  const run = kind === "naive" ? naiveGroup : tiledGroup;
  let done = 0;
  return {
    get done() { return done >= G * G; },
    get workgroups() { return G * G; },
    step(k = G * G) { const z = Math.min(G * G, done + k); while (done < z) { run(S, done % G, Math.floor(done / G)); done++; } return done; },
    result() { return summary(S, G); },
  };
}

function summary(S, G) {
  const { kind, n, T, C } = S, globalBytes = WORD * (C.globalLoads + C.globalStores), flops = 2 * C.fma;
  return { kind, n, T, workgroups: G * G, invocations: G * G * T * T, ...C, flops, usefulFlops: 2 * n ** 3, globalBytes, sharedBytes: WORD * (C.sharedLoads + C.sharedStores), intensity: flops / globalBytes, sharedPerWorkgroupBytes: kind === "naive" ? 0 : 2 * T * T * WORD, c: S.c, trace: S.trace };
}

export function emulate(opts) {
  const e = createEmulation(opts);
  e.step();
  return e.result();
}

// Closed forms for n a multiple of T, which the tests hold the emulator to.
export function closedForm(kind, n, T) {
  const n3 = n ** 3, n2 = n * n, flops = 2 * n3;
  if (kind === "naive") return { globalLoads: 2 * n3, globalStores: n2, sharedLoads: 0, sharedStores: 0, barriers: 0, fma: n3, intensity: flops / (WORD * (2 * n3 + n2)) };
  const g = n / T;
  return { globalLoads: (2 * n3) / T, globalStores: n2, sharedLoads: 2 * n3, sharedStores: (2 * n3) / T, barriers: 2 * g ** 3, fma: n3, intensity: flops / (WORD * ((2 * n3) / T + n2)) };
}

// Volkov and Demmel 2008, section 4.1: with bm x bn blocks of C held in fast
// memory, the A and B fetches cost m n k (1/bn + 1/bm) words; for square n
// and bm = bn = T that is 2 n^3 / T, the tiled closed form above.
export const volkovWords = (m, n, k, bm, bn) => m * n * k * (1 / bn + 1 / bm);

// The tiles one workgroup visits, phase by phase, for the film.
export function schedule(n, T, gx, gy) {
  return Array.from({ length: Math.ceil(n / T) }, (_, t) => ({ phase: t, aTile: { rows: [gy * T, gy * T + T - 1], cols: [t * T, t * T + T - 1] }, bTile: { rows: [t * T, t * T + T - 1], cols: [gx * T, gx * T + T - 1] }, globalLoads: 2 * T * T, sharedStores: 2 * T * T, sharedLoads: 2 * T ** 3, fma: T ** 3, barriers: 2 }));
}
