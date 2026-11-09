// Lesson K23: the WGSL kernels the lab runs and fused-emu.mjs emulates.
// Unfused attention is three dispatches, as in FlashAttention's Algorithm 0:
//   scores   a workgroup of B invocations owns B query rows; each tile of B
//            key rows is copied to workgroup memory, and every score
//            s_ij = scale q_i . k_j is written to S in global memory;
//   softmax  one workgroup of 256 per row: the row is read once into
//            registers, max and sum are reduced through workgroup memory,
//            and P overwrites S in place (one read and one write per score);
//   pv       B query rows per workgroup; tiles of B value rows go to
//            workgroup memory, each invocation reads its own row of P from
//            global memory and accumulates o_i = sum_j p_ij v_j.
// Fused is one dispatch: B query rows per workgroup, tiles of K and V in
// workgroup memory, scores in registers, the running max and sum per row
// (tileUpdate in fused.mjs is the same arithmetic in the same order). The
// broken kernel drops the rescale of the running sum. Out-of-range rows keep
// running (every invocation must reach each barrier) and write nothing.
// WGSL needs fixed-size private arrays, so D, B and the softmax's values per
// invocation are compiled in.

export const KERNELS = Object.freeze(["scores", "softmax", "pv", "fused", "broken"]);
export const WG_SOFTMAX = 256;

const head = (bind) => `struct Params { n: u32, scale: f32, p1: u32, p2: u32 }
${bind}@group(0) @binding(9) var<uniform> p: Params;
`;
const QKVO = `@group(0) @binding(0) var<storage, read> q: array<f32>;
@group(0) @binding(1) var<storage, read> k: array<f32>;
@group(0) @binding(2) var<storage, read> v: array<f32>;
@group(0) @binding(3) var<storage, read_write> o: array<f32>;
`;
const S_RW = "@group(0) @binding(4) var<storage, read_write> s: array<f32>;\n";
const ENTRY = `@compute @workgroup_size(B)
fn main(@builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wid: vec3<u32>) {
  let i = wid.x * B + lid.x; let valid = i < p.n;
  let tiles = (p.n + B - 1u) / B;`;
const LOADQ = `  var qr: array<f32, D>;
  if (valid) { for (var c = 0u; c < D; c++) { qr[c] = q[i * D + c]; } }`;

function fusedBody(broken) {
  return `const D: u32 = DDu; const B: u32 = BBu;
var<workgroup> Ks: array<f32, BD>;
var<workgroup> Vs: array<f32, BD>;
${ENTRY}
${LOADQ}
  var acc: array<f32, D>; var sc: array<f32, B>;
  var m = -3.0e38; var l = 0.0;
  for (var t = 0u; t < tiles; t++) {
    let r = t * B + lid.x;
    if (r < p.n) { for (var c = 0u; c < D; c++) { Ks[lid.x * D + c] = k[r * D + c]; Vs[lid.x * D + c] = v[r * D + c]; } }
    workgroupBarrier();
    if (valid) {
      let cnt = min(B, p.n - t * B);
      var mt = m;
      for (var j = 0u; j < cnt; j++) {
        var x = 0.0;
        for (var c = 0u; c < D; c++) { x = x + qr[c] * Ks[j * D + c]; }
        x = x * p.scale; sc[j] = x; mt = max(mt, x);
      }
      let alpha = exp(m - mt);
      for (var c = 0u; c < D; c++) { acc[c] = acc[c] * alpha; }
      var ps = 0.0;
      for (var j = 0u; j < cnt; j++) {
        let e = exp(sc[j] - mt); ps = ps + e;
        for (var c = 0u; c < D; c++) { acc[c] = acc[c] + e * Vs[j * D + c]; }
      }
${broken ? "      l = l + ps; // broken: the running sum is not rescaled when the max rises\n" : "      l = l * alpha + ps;\n"}      m = mt;
    }
    workgroupBarrier();
  }
  if (valid) { for (var c = 0u; c < D; c++) { o[i * D + c] = acc[c] / l; } }
}
`;
}

const SCORES = `const D: u32 = DDu; const B: u32 = BBu;
var<workgroup> Ks: array<f32, BD>;
${ENTRY}
${LOADQ}
  for (var t = 0u; t < tiles; t++) {
    let r = t * B + lid.x;
    if (r < p.n) { for (var c = 0u; c < D; c++) { Ks[lid.x * D + c] = k[r * D + c]; } }
    workgroupBarrier();
    if (valid) {
      let cnt = min(B, p.n - t * B);
      for (var j = 0u; j < cnt; j++) {
        var x = 0.0;
        for (var c = 0u; c < D; c++) { x = x + qr[c] * Ks[j * D + c]; }
        s[i * p.n + t * B + j] = x * p.scale;
      }
    }
    workgroupBarrier();
  }
}
`;

const PV = `const D: u32 = DDu; const B: u32 = BBu;
var<workgroup> Vs: array<f32, BD>;
${ENTRY}
  var acc: array<f32, D>;
  for (var t = 0u; t < tiles; t++) {
    let r = t * B + lid.x;
    if (r < p.n) { for (var c = 0u; c < D; c++) { Vs[lid.x * D + c] = v[r * D + c]; } }
    workgroupBarrier();
    if (valid) {
      let cnt = min(B, p.n - t * B);
      for (var j = 0u; j < cnt; j++) {
        let pj = s[i * p.n + t * B + j];
        for (var c = 0u; c < D; c++) { acc[c] = acc[c] + pj * Vs[j * D + c]; }
      }
    }
    workgroupBarrier();
  }
  if (valid) { for (var c = 0u; c < D; c++) { o[i * D + c] = acc[c]; } }
}
`;

const SOFTMAX = `const W: u32 = 256u; const PER: u32 = PPu;
var<workgroup> red: array<f32, 256>;
@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) lid: vec3<u32>, @builtin(workgroup_id) wid: vec3<u32>) {
  let base = wid.x * p.n;
  var x: array<f32, PER>; var mx = -3.0e38;
  for (var e = 0u; e < PER; e++) { let j = lid.x + e * W; if (j < p.n) { x[e] = s[base + j]; mx = max(mx, x[e]); } }
  red[lid.x] = mx; workgroupBarrier();
  for (var h = W / 2u; h > 0u; h = h / 2u) { if (lid.x < h) { red[lid.x] = max(red[lid.x], red[lid.x + h]); } workgroupBarrier(); }
  let m = red[0]; workgroupBarrier();
  var sum = 0.0;
  for (var e = 0u; e < PER; e++) { let j = lid.x + e * W; if (j < p.n) { x[e] = exp(x[e] - m); sum = sum + x[e]; } }
  red[lid.x] = sum; workgroupBarrier();
  for (var h = W / 2u; h > 0u; h = h / 2u) { if (lid.x < h) { red[lid.x] = red[lid.x] + red[lid.x + h]; } workgroupBarrier(); }
  let total = red[0];
  for (var e = 0u; e < PER; e++) { let j = lid.x + e * W; if (j < p.n) { s[base + j] = x[e] / total; } }
}
`;

// WGSL source for one kernel: d head width, B tile rows (= workgroup size),
// n sequence length (the softmax compiles its values per invocation from n).
export function wgsl(kind, { d = 64, B = 32, n = 1024 } = {}) {
  if (!KERNELS.includes(kind)) throw new Error("unknown kernel " + kind);
  if (B > 256) throw new Error("B must fit WebGPU's default 256 invocations per workgroup");
  const fill = (src) => src.replaceAll("DDu", `${d}u`).replaceAll("BBu", `${B}u`).replaceAll("BD", String(B * d)).replaceAll("PPu", `${Math.max(1, Math.ceil(n / WG_SOFTMAX))}u`);
  if (kind === "softmax") return head(S_RW) + fill(SOFTMAX);
  if (kind === "scores") return head(QKVO + S_RW) + fill(SCORES);
  if (kind === "pv") return head(QKVO + S_RW) + fill(PV);
  return head(QKVO) + fill(fusedBody(kind === "broken"));
}

// Workgroup memory in bytes for a kernel (WebGPU guarantees 16,384).
export function sharedBytes(kind, { d = 64, B = 32 } = {}) {
  if (kind === "softmax") return 4 * WG_SOFTMAX;
  return 4 * B * d * (kind === "fused" || kind === "broken" ? 2 : 1);
}

// The tile: the most rows of K and V that fit two B x d tiles in M bytes,
// capped at 128 rows and rounded down to a power of two.
export function tileFor(d, M = 16384) {
  const fit = Math.floor(M / (4 * 2 * d));
  return Math.min(128, 2 ** Math.floor(Math.log2(fit)));
}
