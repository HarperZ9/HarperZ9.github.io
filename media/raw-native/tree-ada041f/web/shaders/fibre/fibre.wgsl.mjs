// WGSL for fibre-network watercolour (fibre.mjs), pass for pass.
// P: 0 w, 1 h, 2 C (cell px), 3 L (fibre length px), 4 perCell, 5 width, 6 md, 7 spread, 8 k0,
// 9 k1, 10 rate, 11 floc, 12 evap, 13 dt, 14 strength, 15..17 paper, 18 edgeDry.
export const FIBRE_HEAD = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
fn pi(i: u32) -> i32 { return i32(round(P[i])); }
`;
export const FIBRE_FIELD_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read_write> F: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> X: array<f32>;
const PI_F: f32 = 3.141592653589793;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = pi(0u); let h = pi(1u); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let C = P[2]; let qx = f32(x) + 0.5; let qy = f32(y) + 0.5; let cx = i32(floor(qx / C)); let cy = i32(floor(qy / C));
  var cov = 0.0; var cov2 = 0.0; var t = vec3f(0.0);
  for (var j = cy - 1; j <= cy + 1; j++) { for (var i = cx - 1; i <= cx + 1; i++) { for (var k = 0; k < pi(4u); k++) {
    let a = u32(i + 8192); let b = u32(j + 8192); let s = u32(k * 97 + 13);
    let fx = (f32(i) + hash3(a, b, s)) * C; let fy = (f32(j) + hash3(a, b, s + 1u)) * C;
    let th = PI_F * (P[6] + P[7] * (hash3(a, b, s + 2u) - 0.5)); let dx = cos(th); let dy = sin(th);
    let hl = P[3] * (0.6 + 0.8 * hash3(a, b, s + 3u)) / 2.0;
    let rx = qx - fx; let ry = qy - fy; let tt = clamp(rx * dx + ry * dy, -hl, hl); let ex = rx - tt * dx; let ey = ry - tt * dy;
    let c = clamp(0.5 * P[5] + 0.5 - sqrt(ex * ex + ey * ey), 0.0, 1.0);
    if (c > 0.0) { cov += c; cov2 += c * c; t += c * vec3f(dx * dx, dx * dy, dy * dy); }
  } } }
  F[y * w + x] = vec4f(cov, t); X[y * w + x] = 0.5 * (cov * cov - cov2);
}
`;
export const FIBRE_TENSOR_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> F: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> K: array<vec4f>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = pi(0u); let h = pi(1u); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  var acc = vec4f(0.0); var n = 0.0;
  for (var yy = max(0, y - 3); yy <= min(h - 1, y + 3); yy++) { for (var xx = max(0, x - 3); xx <= min(w - 1, x + 3); xx++) { acc += F[yy * w + xx]; n += 1.0; } }
  let cm = acc.x / n; var s = 0.0; if (acc.x > 1e-12) { s = 1.0 / acc.x; } let g = P[9] * min(1.0, cm);
  K[y * w + x] = vec4f(P[8] + g * acc.y * s, g * acc.z * s, P[8] + g * acc.w * s, 0.0);
}
`;
export const FIBRE_INIT_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> S: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> D: array<vec4f>;
fn lum_at(x: i32, y: i32) -> f32 { let c = src[clamp(y, 0, pi(1u) - 1) * pi(0u) + clamp(x, 0, pi(0u) - 1)].xyz; return 0.2126 * c.x + 0.7152 * c.y + 0.0722 * c.z; }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = pi(0u); let h = pi(1u); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let i = y * w + x; let c = src[i].xyz; let paper = vec3f(P[15], P[16], P[17]);
  let a = -log(max(vec3f(0.02), min(vec3f(1.0), c / paper))) * P[14];
  let gx = 0.5 * (lum_at(x + 1, y) - lum_at(x - 1, y)); let gy = 0.5 * (lum_at(x, y + 1) - lum_at(x, y - 1));
  S[i] = vec4f(a, clamp(1.0 - P[18] * sqrt(gx * gx + gy * gy), 0.05, 1.0)); D[i] = vec4f(0.0);
}
`;
export const FIBRE_STEP_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> K: array<vec4f>;
@group(0) @binding(2) var<storage, read> X: array<f32>;
@group(0) @binding(3) var<storage, read> S: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> Sn: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> D: array<vec4f>;
fn link_g(k: vec4f, l: i32) -> f32 {
  let ax = max(0.0, k.x - abs(k.y)); let ay = max(0.0, k.z - abs(k.y)); let dg = abs(k.y) / 2.0; let pos = k.y >= 0.0;
  if (l < 2) { return ax; } if (l < 4) { return ay; }
  if (l < 6) { return select(0.0, dg, pos); } return select(dg, 0.0, pos);
}
fn link_d(l: i32) -> vec2i {
  switch (l) { case 0: { return vec2i(1, 0); } case 1: { return vec2i(-1, 0); } case 2: { return vec2i(0, 1); } case 3: { return vec2i(0, -1); }
    case 4: { return vec2i(1, 1); } case 5: { return vec2i(-1, -1); } case 6: { return vec2i(1, -1); } default: { return vec2i(-1, 1); } }
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = pi(0u); let h = pi(1u); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let i = y * w + x; let si = S[i]; let ki = K[i]; let dt = P[13];
  var flux = vec3f(0.0);
  for (var l = 0; l < 8; l++) {
    let d = link_d(l); let xx = x + d.x; let yy = y + d.y; if (xx < 0 || yy < 0 || xx >= w || yy >= h) { continue; }
    let j = yy * w + xx; let sj = S[j]; let g = 0.5 * (link_g(ki, l) + link_g(K[j], l ^ 1)) * min(si.w, sj.w) * dt;
    flux += g * (sj.xyz - si.xyz);
  }
  let dep = P[10] * (1.0 + P[11] * X[i]) * dt; let pc = si.xyz + flux; let dd = min(pc, dep * pc);
  Sn[i] = vec4f(pc - dd, max(0.0, si.w - P[12])); D[i] = vec4f(D[i].xyz + dd, 0.0);
}
`;
export const FIBRE_OUT_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> S: array<vec4f>;
@group(0) @binding(2) var<storage, read> D: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> img: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> out8: array<u32>;
fn enc(v: f32) -> u32 { let c = clamp(v, 0.0, 1.0); var s = 1.055 * pow(c, 1.0 / 2.4) - 0.055; if (c <= 0.0031308) { s = c * 12.92; } return u32(floor(s * 255.0 + 0.5)); }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = pi(0u); let h = pi(1u); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let i = y * w + x; let o = vec3f(P[15], P[16], P[17]) * exp(-(S[i].xyz + D[i].xyz));
  img[i] = vec4f(o, 1.0); out8[i] = enc(o.x) | (enc(o.y) << 8u) | (enc(o.z) << 16u) | (255u << 24u);
}
`;
