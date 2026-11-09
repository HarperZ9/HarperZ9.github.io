// WGSL for the salience caricature warp (caricature.mjs), pass for pass.
// P: 0 w, 1 h, 2 R (blur half-width), 3 lambda (preset cap), 4 gain, 5 steps, 6..15 weights by material 0..9.
export const CARI_HEAD = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
fn pi(i: u32) -> i32 { return i32(round(P[i])); }
fn clampxy(x: i32, y: i32) -> i32 { return clamp(y, 0, pi(1u) - 1) * pi(0u) + clamp(x, 0, pi(0u) - 1); }
`;
export const CARI_SAL_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> mat: array<i32>;
@group(0) @binding(2) var<storage, read_write> s: array<f32>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = pi(0u); let h = pi(1u); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let m = mat[y * w + x]; var v = 0.0; if (m >= 0 && m <= 9) { v = P[6u + u32(m)]; } s[y * w + x] = v;
}
`;
// dir 0: horizontal, 1: vertical.
export const CARI_BLUR_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> taps: array<f32>;
@group(0) @binding(2) var<storage, read> a: array<f32>;
@group(0) @binding(3) var<storage, read_write> b: array<f32>;
@group(0) @binding(4) var<storage, read> dirb: array<f32>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = pi(0u); let h = pi(1u); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let R = pi(2u); var v = 0.0; let vert = dirb[0] > 0.5;
  for (var k = -R; k <= R; k++) { var j = clampxy(x + k, y); if (vert) { j = clampxy(x, y + k); } v += taps[k + R] * a[j]; }
  b[y * w + x] = v;
}
`;
export const CARI_GRAD_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> S: array<f32>;
@group(0) @binding(2) var<storage, read_write> g: array<vec2f>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = pi(0u); let h = pi(1u); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  g[y * w + x] = vec2f(0.5 * (S[clampxy(x + 1, y)] - S[clampxy(x - 1, y)]), 0.5 * (S[clampxy(x, y + 1)] - S[clampxy(x, y - 1)]));
}
`;
// One workgroup: the largest Frobenius norm of the gradient's derivative, then lambda.
export const CARI_LAMBDA_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> g: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> L: array<f32>;
var<workgroup> part: array<f32, 256>;
@compute @workgroup_size(256) fn main(@builtin(local_invocation_id) lid: vec3u) {
  let w = pi(0u); let h = pi(1u); var m = 0.0;
  for (var i = i32(lid.x); i < w * h; i += 256) {
    let x = i % w; let y = i / w;
    let dx = 0.5 * (g[clampxy(x + 1, y)] - g[clampxy(x - 1, y)]); let dy = 0.5 * (g[clampxy(x, y + 1)] - g[clampxy(x, y - 1)]);
    m = max(m, sqrt(dx.x * dx.x + dy.x * dy.x + dx.y * dx.y + dy.y * dy.y));
  }
  part[lid.x] = m; workgroupBarrier();
  for (var st = 128u; st > 0u; st = st >> 1u) { if (lid.x < st) { part[lid.x] = max(part[lid.x], part[lid.x + st]); } workgroupBarrier(); }
  if (lid.x == 0u) {
    let c = 1.0 - pow(0.04, 1.0 / (2.0 * P[5]));
    var lam = 0.0; if (part[0] > 0.0) { lam = min(P[3], (c * P[4]) / part[0]); } L[0] = lam;
  }
}
`;
export const CARI_WARP_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read> g: array<vec2f>;
@group(0) @binding(3) var<storage, read> L: array<f32>;
@group(0) @binding(4) var<storage, read_write> img: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> out8: array<u32>;
fn grad_at(fx: f32, fy: f32) -> vec2f {
  let w = pi(0u); let h = pi(1u); let u = fx - 0.5; let v = fy - 0.5;
  let x0 = clamp(i32(floor(u)), 0, w - 1); let y0 = clamp(i32(floor(v)), 0, h - 1); let x1 = min(w - 1, x0 + 1); let y1 = min(h - 1, y0 + 1);
  let tx = clamp(u - f32(x0), 0.0, 1.0); let ty = clamp(v - f32(y0), 0.0, 1.0);
  return (g[y0 * w + x0] * (1.0 - tx) + g[y0 * w + x1] * tx) * (1.0 - ty) + (g[y1 * w + x0] * (1.0 - tx) + g[y1 * w + x1] * tx) * ty;
}
fn sample_src(fx: f32, fy: f32) -> vec3f {
  let w = pi(0u); let h = pi(1u); let u = fx - 0.5; let v = fy - 0.5;
  let x0 = clamp(i32(floor(u)), 0, w - 1); let y0 = clamp(i32(floor(v)), 0, h - 1); let x1 = min(w - 1, x0 + 1); let y1 = min(h - 1, y0 + 1);
  let tx = clamp(u - f32(x0), 0.0, 1.0); let ty = clamp(v - f32(y0), 0.0, 1.0);
  return (src[y0 * w + x0].xyz * (1.0 - tx) + src[y0 * w + x1].xyz * tx) * (1.0 - ty) + (src[y1 * w + x0].xyz * (1.0 - tx) + src[y1 * w + x1].xyz * tx) * ty;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = pi(0u); let h = pi(1u); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let i = y * w + x; let lam = L[0];
  var f = vec2f(f32(x) + 0.5, f32(y) + 0.5) + lam * g[i];
  for (var k = 1; k < pi(5u); k++) { f += lam * grad_at(f.x, f.y); }
  let c = sample_src(f.x, f.y);
  img[i] = vec4f(c, 1.0); out8[i] = lab_pack(c, P[16]);
}
`;
