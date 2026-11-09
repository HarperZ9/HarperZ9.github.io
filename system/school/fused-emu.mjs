// Lesson K23: an exact emulator of the WGSL kernels in fused-wgsl.mjs. It
// runs every workgroup in the grouping WGSL defines, in float32 (each
// operation rounded with Math.fround, exp included), and counts each global
// read and write, workgroup-memory read and write, barrier, exp and
// multiply-add. With compute: false it walks the same loops and counts
// without doing the arithmetic, so large sequence lengths stay cheap.
// Counts are requests the kernels issue; a GPU's caches may serve some of
// them without a trip to DRAM (HBM). Q, K, V, O, S and P are float32.

import { tileUpdate, M_INIT } from "./fused.mjs";
import { WG_SOFTMAX } from "./fused-wgsl.mjs";

export const WORD = 4, KINDS = Object.freeze(["unfused", "fused", "broken"]);
const fr = Math.fround;
const zero = () => ({ globalReads: 0, globalWrites: 0, sharedReads: 0, sharedWrites: 0, barriers: 0, exps: 0, fma: 0 });

// Cooperative tile load: invocation lid copies key row t B + lid of each
// source into workgroup memory.
function loadTile(S, t, srcs, dsts) {
  const { N, d, B, C, compute } = S;
  for (let lid = 0; lid < B; lid++) {
    const r = t * B + lid;
    if (r >= N) continue;
    srcs.forEach((src, k) => { if (compute) dsts[k].set(src.subarray(r * d, r * d + d), lid * d); });
    C.globalReads += d * srcs.length; C.sharedWrites += d * srcs.length;
  }
  C.barriers++;
}

function fusedGroup(S, g) {
  const { N, d, B, C, compute, q, k, v, o, broken, scale } = S, G = Math.ceil(N / B), rows = [];
  for (let i = g * B; i < Math.min(N, g * B + B); i++) { rows.push({ i, m: M_INIT, l: 0, acc: new Float64Array(d), changes: 0 }); C.globalReads += d; }
  const Ks = new Float32Array(B * d), Vs = new Float32Array(B * d), sc = new Float64Array(B);
  for (let t = 0; t < G; t++) {
    loadTile(S, t, [k, v], [Ks, Vs]);
    const cnt = Math.min(B, N - t * B);
    for (const st of rows) {
      if (compute) tileUpdate(st, q.subarray(st.i * d, st.i * d + d), Ks, Vs, cnt, d, scale, fr, broken, sc);
      C.sharedReads += 2 * cnt * d; C.fma += 2 * cnt * d; C.exps += cnt + 1;
    }
    C.barriers++;
  }
  for (const st of rows) { if (compute) for (let c = 0; c < d; c++) o[st.i * d + c] = fr(st.acc[c] / st.l); C.globalWrites += d; }
}

function scoresGroup(S, g) {
  const { N, d, B, C, compute, q, k, s, scale } = S, G = Math.ceil(N / B), Ks = new Float32Array(B * d), lo = g * B, hi = Math.min(N, lo + B);
  C.globalReads += (hi - lo) * d;
  for (let t = 0; t < G; t++) {
    loadTile(S, t, [k], [Ks]);
    const cnt = Math.min(B, N - t * B);
    for (let i = lo; i < hi; i++) {
      if (compute) for (let j = 0; j < cnt; j++) {
        let x = 0;
        for (let c = 0; c < d; c++) x = fr(x + fr(q[i * d + c] * Ks[j * d + c]));
        s[i * N + t * B + j] = fr(x * scale);
      }
      C.sharedReads += cnt * d; C.fma += cnt * d; C.globalWrites += cnt;
    }
    C.barriers++;
  }
}

// Tree reduction over 256 partial values in workgroup memory, as the kernel.
function reduce(red, op, C) {
  C.sharedWrites += WG_SOFTMAX; C.barriers++;
  for (let h = WG_SOFTMAX / 2; h > 0; h >>= 1) { for (let l = 0; l < h; l++) red[l] = op(red[l], red[l + h]); C.sharedReads += 2 * h; C.sharedWrites += h; C.barriers++; }
  C.sharedReads += WG_SOFTMAX;
  return red[0];
}

function softmaxRow(S, row) {
  const { N, C, compute, s } = S, W = WG_SOFTMAX, base = row * N, red = new Float64Array(W), per = Math.ceil(N / W);
  C.globalReads += N; C.globalWrites += N; C.exps += N;
  if (!compute) { C.sharedWrites += 2 * W + 2 * (W - 1); C.sharedReads += 4 * (W - 1) + 2 * W; C.barriers += 2 * (1 + Math.log2(W)) + 1; return; }
  const x = new Float64Array(W * per);
  for (let l = 0; l < W; l++) { let mx = M_INIT; for (let e = 0; e < per; e++) { const j = l + e * W; if (j < N) { x[j] = s[base + j]; mx = Math.max(mx, x[j]); } } red[l] = mx; }
  const m = reduce(red, Math.max, C);
  C.barriers++;
  for (let l = 0; l < W; l++) { let sum = 0; for (let e = 0; e < per; e++) { const j = l + e * W; if (j < N) { x[j] = fr(Math.exp(fr(x[j] - m))); sum = fr(sum + x[j]); } } red[l] = sum; }
  const total = reduce(red, (a, b) => fr(a + b), C);
  for (let j = 0; j < N; j++) s[base + j] = fr(x[j] / total);
}

function pvGroup(S, g) {
  const { N, d, B, C, compute, v, s, o } = S, G = Math.ceil(N / B), Vs = new Float32Array(B * d), lo = g * B, hi = Math.min(N, lo + B), acc = new Float64Array((hi - lo) * d);
  for (let t = 0; t < G; t++) {
    loadTile(S, t, [v], [Vs]);
    const cnt = Math.min(B, N - t * B);
    for (let i = lo; i < hi; i++) {
      if (compute) for (let j = 0; j < cnt; j++) { const pj = s[i * N + t * B + j]; for (let c = 0; c < d; c++) acc[(i - lo) * d + c] = fr(acc[(i - lo) * d + c] + fr(pj * Vs[j * d + c])); }
      C.globalReads += cnt; C.sharedReads += cnt * d; C.fma += cnt * d;
    }
    C.barriers++;
  }
  for (let i = lo; i < hi; i++) { if (compute) for (let c = 0; c < d; c++) o[i * d + c] = acc[(i - lo) * d + c]; C.globalWrites += d; }
}

// The work list: (kernel, index) items run one at a time, so a page can
// step it in 40 ms slices.
export function createEmulation({ kind = "fused", N, d, B, q = null, k = null, v = null, compute = true }) {
  if (!KINDS.includes(kind)) throw new Error("unknown kind " + kind);
  const G = Math.ceil(N / B), S = { N, d, B, q, k, v, compute, broken: kind === "broken", scale: fr(1 / Math.sqrt(d)), C: zero(), o: compute ? new Float32Array(N * d) : null, s: compute && kind === "unfused" ? new Float32Array(N * N) : null };
  const items = kind === "unfused"
    ? [...Array.from({ length: G }, (_, g) => [scoresGroup, g]), ...Array.from({ length: N }, (_, r) => [softmaxRow, r]), ...Array.from({ length: G }, (_, g) => [pvGroup, g])]
    : Array.from({ length: G }, (_, g) => [fusedGroup, g]);
  let at = 0;
  return {
    get done() { return at >= items.length; },
    get items() { return items.length; },
    step(n = items.length) { const z = Math.min(items.length, at + n); while (at < z) { const [f, i] = items[at++]; f(S, i); } return at; },
    result() { return summary(kind, S, G); },
  };
}

function summary(kind, S, G) {
  const { N, d, B, C } = S, globalBytes = WORD * (C.globalReads + C.globalWrites);
  return { kind, N, d, B, workgroups: kind === "unfused" ? 2 * G + N : G, ...C, globalBytes, sharedBytes: WORD * (C.sharedReads + C.sharedWrites), extraMemoryBytes: kind === "unfused" ? WORD * N * N : 0, o: S.o };
}

export function emulate(opts) { const e = createEmulation(opts); e.step(); return e.result(); }

// Closed forms (elements), exact for any N, with G = ceil(N / B) tiles.
export function closedForm(kind, N, d, B) {
  const G = Math.ceil(N / B), N2 = N * N;
  if (kind === "unfused") return { globalReads: N * d + 2 * G * N * d + 2 * N2, globalWrites: 2 * N2 + N * d, fma: 2 * N2 * d, exps: N2, barriers: 4 * G * G + (2 * (1 + Math.log2(WG_SOFTMAX)) + 1) * N };
  return { globalReads: N * d + 2 * G * N * d, globalWrites: N * d, fma: 2 * N2 * d, exps: N2 + N * G, barriers: 2 * G * G };
}

// FlashAttention's Theorem 2 orders: standard Theta(N d + N^2), fused
// Theta(N^2 d^2 / M), M the on-chip memory in elements (here workgroup
// memory: two B x d tiles, so M = 2 B d and N^2 d^2 / M = N^2 d / (2 B)).
export const theta = (N, d, M) => ({ standard: N * d + N * N, flash: (N * N * d * d) / M });
