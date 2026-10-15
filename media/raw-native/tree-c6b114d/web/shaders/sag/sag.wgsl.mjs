// WGSL for the scan-causal EHT sag (sag.mjs), pass for pass.
// P: 0 w, 1 h, 2 S, 3 alpha, 4 focus, 5 sigma0, 6 bright, 7 gamma, 8 blank lines, 9 settle,
// 10 initial sag, 11 spot radius R (taps each side).
export const SAG_HEAD = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
fn pi(i: u32) -> i32 { return i32(round(P[i])); }
`;
// Per-line beam current: one workgroup per line.
export const SAG_CURRENT_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> I: array<f32>;
var<workgroup> part: array<f32, 64>;
@compute @workgroup_size(64) fn main(@builtin(local_invocation_id) lid: vec3u, @builtin(workgroup_id) wid: vec3u) {
  let w = pi(0u); let y = i32(wid.x); let g = P[7]; var s = 0.0;
  for (var x = i32(lid.x); x < w; x += 64) { let c = max(src[y * w + x].xyz, vec3f(0.0)); s += (pow(c.x, g) + pow(c.y, g) + pow(c.z, g)) / 3.0; }
  part[lid.x] = s; workgroupBarrier();
  for (var st = 32u; st > 0u; st = st >> 1u) { if (lid.x < st) { part[lid.x] += part[lid.x + st]; } workgroupBarrier(); }
  if (lid.x == 0u) { I[y] = part[0] / f32(w); }
}
`;
// The scan: one invocation walks the lines in order.
export const SAG_SCAN_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> I: array<f32>;
@group(0) @binding(2) var<storage, read_write> L: array<vec4f>;
@compute @workgroup_size(1) fn main() {
  let h = pi(1u); let a = P[3]; let S = P[2]; var s = P[10]; let cy = f32(h) / 2.0;
  for (var y = 0; y < h; y++) { s = s + a * (S * I[y] - s); L[y].x = s; }
  if (P[9] > 0.5) {
    s = s * pow(1.0 - a, P[8]);
    for (var y = 0; y < h; y++) { s = s + a * (S * I[y] - s); L[y].x = s; }
  }
  for (var y = 0; y < h; y++) {
    let v = L[y].x; let k = 1.0 / sqrt(1.0 - v);
    L[y] = vec4f(v, k, cy + (f32(y) + 0.5 - cy) * k, P[5] + P[4] * v);
  }
}
`;
export const SAG_RESAMPLE_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read> L: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> out: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> out8: array<u32>;
fn sample_line(y: i32, xs: f32, sigma: f32) -> vec3f {
  let w = pi(0u); let R = pi(11u); let g = P[7]; let x0 = i32(floor(xs)); var ws = 0.0; var acc = vec3f(0.0);
  for (var j = x0 - R; j <= x0 + R; j++) {
    if (j < 0 || j >= w) { continue; }
    let d = (f32(j) + 0.5 - xs) / sigma; let wt = exp(-0.5 * d * d); let c = max(src[y * w + j].xyz, vec3f(0.0));
    ws += wt; acc += wt * vec3f(pow(c.x, g), pow(c.y, g), pow(c.z, g));
  }
  if (ws > 0.0) { acc = acc / ws; }
  return acc;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = pi(0u); let h = pi(1u); let x = i32(id.x); let yo = i32(id.y); if (x >= w || yo >= h) { return; }
  let i = yo * w + x; let yc = f32(yo) + 0.5; let cx = f32(w) / 2.0;
  if (yc < L[0].z || yc > L[h - 1].z) { out[i] = vec4f(0.0, 0.0, 0.0, 1.0); out8[i] = 255u << 24u; return; }
  var lo = 0; var hi = h - 1;
  loop { if (hi - lo <= 1) { break; } let m = (lo + hi) / 2; if (L[m].z <= yc) { lo = m; } else { hi = m; } }
  let y1 = min(h - 1, lo + 1); let A = L[lo]; let Bq = L[y1];
  var f = 0.0; if (y1 != lo) { f = (yc - A.z) / (Bq.z - A.z); }
  let xc = f32(x) + 0.5;
  let a = sample_line(lo, cx + (xc - cx) / A.y, A.w) * pow(1.0 - A.x, P[6]);
  let b = sample_line(y1, cx + (xc - cx) / Bq.y, Bq.w) * pow(1.0 - Bq.x, P[6]);
  let m = a * (1.0 - f) + b * f; let ig = 1.0 / P[7];
  let o = vec3f(pow(m.x, ig), pow(m.y, ig), pow(m.z, ig));
  out[i] = vec4f(o, 1.0);
  let q = clamp(o, vec3f(0.0), vec3f(1.0));
  out8[i] = u32(floor(q.x * 255.0 + 0.5)) | (u32(floor(q.y * 255.0 + 0.5)) << 8u) | (u32(floor(q.z * 255.0 + 0.5)) << 16u) | (255u << 24u);
}
`;
