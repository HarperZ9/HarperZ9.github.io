// Lesson K21, "Threads, workgroups and memory". Pure ES module, no DOM and
// no dependencies: the lab page, a worker and the Node fill script share it.
//
// The film cannot time a GPU, so every number it shows is a count from the
// exact model below or a limit published in a spec:
//   - WGSL kernels (strings, for the lab's WebGPU run): out[i] = a[j] + b[j],
//     with j = i (contiguous) or a transposed walk that steps `stride`
//     elements between neighbouring threads (strided); broken variants for
//     the checker to catch;
//   - an emulator that runs those kernels thread by thread in JavaScript, in
//     the grouping WGSL defines (global_invocation_id = workgroup_id *
//     workgroup_size + local_invocation_id), and counts global loads and
//     stores and, in a 32-lane coalescing model, memory transactions;
//   - a CPU reference and a checker the lab runs on the GPU's output.
// The 32-lane model is CUDA's (warps of 32 threads; CUDA Programming Guide
// 13.4, section 1 programming model and section 2.3.4.1 Coalesced Global
// Memory Access). WebGPU itself has no warps: a vendor may group invocations
// differently (WebGPU exposes subgroupMinSize and subgroupMaxSize on the
// adapter info). Counts here describe the model, not a measured GPU.

import { rng } from "./tinyformer-ops.mjs";

export const WARP = 32, WORD = 4;

// Published limits. WebGPU: W3C Candidate Recommendation Draft (dated 15
// September 2026), section 3.6.2 Limits, the defaults every device must
// support (compatibility-mode defaults in compat). WGSL: section 6.5.7
// Out-of-Bounds Access. CUDA: Programming Guide 13.4.2.
export const SPEC = Object.freeze({
  webgpu: { maxComputeWorkgroupSizeX: 256, maxComputeWorkgroupSizeY: 256, maxComputeWorkgroupSizeZ: 64, maxComputeInvocationsPerWorkgroup: 256, maxComputeWorkgroupsPerDimension: 65535, maxComputeWorkgroupStorageSize: 16384, maxStorageBufferBindingSize: 134217728, minStorageBufferOffsetAlignment: 256, compat: { maxComputeWorkgroupSizeX: 128, maxComputeWorkgroupSizeY: 128, maxComputeInvocationsPerWorkgroup: 128 } },
  cuda: { warpSize: 32, maxThreadsPerBlock: 1024, maxBlockDimX: 1024, maxBlockDimY: 1024, maxBlockDimZ: 64, transactionBytes: 32 },
});

// ---- kernels ----

const GUARD = { add: "i >= p.n", strided: "i >= p.n", offByOne: "i > p.n", short: "i + 1u >= p.n", noGuard: null };
export const KINDS = Object.freeze(Object.keys(GUARD));

export function wgsl(kind) {
  if (!(kind in GUARD)) throw new Error("unknown kernel " + kind);
  const j = kind === "strided" ? "(i % p.rows) * p.stride + i / p.rows" : "i";
  return `struct Params { n: u32, stride: u32, rows: u32, pad: u32 }
@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> out: array<f32>;
@group(0) @binding(3) var<uniform> p: Params;
override WG: u32 = 64;
@compute @workgroup_size(WG)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
${GUARD[kind] ? `  if (${GUARD[kind]}) { return; }\n` : ""}  let j = ${j};
  out[i] = a[j] + b[j];
}
`;
}

// The same kernels in JavaScript: does invocation i run, and which element j
// does it read. rows = n / stride (the strided walk needs n % stride == 0).
const RUNS = { add: (i, n) => i < n, strided: (i, n) => i < n, offByOne: (i, n) => i <= n, short: (i, n) => i + 1 < n, noGuard: () => true };
export function params(kind, n, stride = 1) {
  if (kind === "strided" && n % stride !== 0) throw new Error("the strided walk needs n to be a multiple of stride");
  return { n, stride: kind === "strided" ? stride : 1, rows: kind === "strided" ? n / stride : n };
}
export const readIndex = (kind, i, p) => (kind === "strided" ? (i % p.rows) * p.stride + Math.floor(i / p.rows) : i);

// ---- inputs, reference, checker ----

// Inputs whose sums are exact in float32 (quarters and eighths under 2^12),
// so a correct GPU must match the reference bit for bit.
export function makeInputs(n, seed = 1) {
  const r = rng(seed), a = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) { a[i] = (i % 4096) * 0.25; b[i] = Math.floor(r() * 4096) / 8; }
  return { a, b };
}

export function cpuReference(a, b, kind = "add", n = a.length, stride = 1) {
  const p = params(kind === "strided" ? "strided" : "add", n, stride), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const j = readIndex(kind === "strided" ? "strided" : "add", i, p); out[i] = Math.fround(a[j] + b[j]); }
  return out;
}

export const CANARY = -1234.5;

// got: the output buffer read back (n elements, then `pad` canary elements
// that sit past the binding). ok needs every element equal and every canary
// untouched; a write past the end shows as a changed canary.
export function checkOutput(got, want, { pad = 0 } = {}) {
  const n = want.length;
  let mismatches = 0, first = -1, canaryHit = 0;
  for (let i = 0; i < n; i++) if (!Object.is(got[i], want[i])) { mismatches++; if (first < 0) first = i; }
  for (let i = n; i < n + pad; i++) if (got[i] !== CANARY) canaryHit++;
  return { ok: mismatches === 0 && canaryHit === 0, mismatches, first, canaryHit };
}

// ---- the emulator ----

// oob: what a store past the binding does. WGSL 6.5.7 lets it store to any
// location of the bound GPUBuffer or not run. "discard" drops it; "clamp"
// stores to the last bound element; "buffer" stores at its own index when the
// GPUBuffer is that long (the canary region). Out-of-range loads read 0.
export function createEmulation({ kind = "add", n, wg = 64, stride = 1, oob = "discard", pad = 0, a, b, segments = [32, 128] }) {
  const p = params(kind, n, stride), groups = Math.ceil(n / wg), out = new Float32Array(n + pad).fill(CANARY, n);
  const T = { loads: 0, stores: 0, oobLoads: 0, oobStores: 0, idle: 0, warps: 0, partialWarps: 0, emptyLanes: 0 };
  const tx = Object.fromEntries(segments.map((s) => [s, { a: 0, b: 0, out: 0 }]));
  let done = 0;
  const load = (arr, j) => { T.loads++; if (j >= n) { T.oobLoads++; return 0; } return arr[j]; };
  function store(i, v) {
    T.stores++;
    if (i < n) { out[i] = v; return; }
    T.oobStores++;
    if (oob === "clamp") out[n - 1] = v;
    else if (oob === "buffer" && i < n + pad) out[i] = v;
  }
  function warp(w0, lanes) {
    const reads = [], writes = [];
    for (let l = 0; l < lanes; l++) {
      const i = w0 + l;
      if (!RUNS[kind](i, n)) { T.idle++; continue; }
      const j = readIndex(kind, i, p);
      reads.push(j); writes.push(i);
      store(i, Math.fround(load(a, j) + load(b, j)));
    }
    for (const s of segments) { const k = countSegments(reads, s); tx[s].a += k; tx[s].b += k; tx[s].out += countSegments(writes, s); }
  }
  function group(g) {
    for (let l0 = 0; l0 < wg; l0 += WARP) {
      const lanes = Math.min(WARP, wg - l0);
      T.warps++;
      if (lanes < WARP) { T.partialWarps++; T.emptyLanes += WARP - lanes; }
      warp(g * wg + l0, lanes);
    }
  }
  return {
    get done() { return done >= groups; },
    step(k = groups) { const z = Math.min(groups, done + k); while (done < z) group(done++); return done; },
    result() { return summary(kind, n, wg, groups, T, tx, out, segments); },
  };
}

// Distinct `seg`-byte segments touched by a list of element indices.
export function countSegments(idx, seg) {
  const s = new Set();
  for (const j of idx) s.add(Math.floor((j * WORD) / seg));
  return s.size;
}

function summary(kind, n, wg, groups, T, tx, out, segments) {
  const useful = 3 * WORD * n, byS = {};
  for (const s of segments) { const t = tx[s].a + tx[s].b + tx[s].out; byS[s] = { ...tx[s], total: t, bytes: t * s, efficiency: useful / (t * s) }; }
  const perDim = SPEC.webgpu.maxComputeWorkgroupsPerDimension;
  return { kind, n, wg, workgroups: groups, invocations: groups * wg, idleThreads: T.idle, ...T, transactions: byS, usefulBytes: useful, dispatchesNeeded: Math.ceil(groups / perDim), out };
}

export function emulate(opts) {
  const e = createEmulation(opts);
  e.step();
  return e.result();
}

// Which element each invocation of a small dispatch touches, for the film.
export function threadMap({ kind = "add", n, wg, stride = 1 }) {
  const p = params(kind, n, stride), groups = Math.ceil(n / wg), rows = [];
  for (let g = 0; g < groups; g++) for (let l = 0; l < wg; l++) {
    const i = g * wg + l, run = RUNS[kind](i, n);
    rows.push({ workgroup: g, local: l, global: i, warp: Math.floor(l / WARP), runs: run, reads: run ? readIndex(kind, i, p) : null, writes: run ? i : null, outOfBounds: run && i >= n });
  }
  return rows;
}

// Closed forms the tests hold the emulator to.
export const idleClosedForm = (n, wg) => Math.ceil(n / wg) * wg - n;
export const contiguousClosedForm = (n, seg) => Math.ceil((n * WORD) / seg);
