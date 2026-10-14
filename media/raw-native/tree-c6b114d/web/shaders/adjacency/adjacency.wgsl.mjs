// WGSL for development adjacency (adjacency.mjs), pass for pass.
// P: 0 w, 1 h, 2 s, 3 cw, 4 ch, 5 Dc, 6 Db, 7 dt, 8 k, 9 eta, 10 r, 11 beta, 12 etaB, 13 rB,
// 14 gamma, 15 H0, 16 exposure, 17 decay, 18 display gain.
export const ADJ_HEAD = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
fn pi(i: u32) -> i32 { return i32(round(P[i])); }
`;
export const ADJ_PREP_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> scene: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> A: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> D: array<vec4f>;
fn developable(H: f32) -> f32 { if (H <= 0.0) { return 0.0; } let q = pow(P[15] / H, P[14]); return 1.0 / (1.0 + q); }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = pi(0u); let h = pi(1u); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let i = y * w + x; let c = scene[i].xyz * P[16];
  A[i] = vec4f(developable(c.x), developable(c.y), developable(c.z), 0.0); D[i] = vec4f(0.0);
}
`;
export const ADJ_DEVELOP_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> A: array<vec4f>;
@group(0) @binding(2) var<storage, read> F: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> D: array<vec4f>;
fn coarse_at(x: i32, y: i32) -> vec2f {
  let s = P[2]; let cw = pi(3u); let ch = pi(4u);
  let u = (f32(x) + 0.5) / s - 0.5; let v = (f32(y) + 0.5) / s - 0.5;
  let x0 = clamp(i32(floor(u)), 0, cw - 1); let y0 = clamp(i32(floor(v)), 0, ch - 1);
  let x1 = min(cw - 1, x0 + 1); let y1 = min(ch - 1, y0 + 1);
  let fx = clamp(u - f32(x0), 0.0, 1.0); let fy = clamp(v - f32(y0), 0.0, 1.0);
  let a = F[y0 * cw + x0].xy; let b = F[y0 * cw + x1].xy; let c = F[y1 * cw + x0].xy; let d = F[y1 * cw + x1].xy;
  return (a * (1.0 - fx) + b * fx) * (1.0 - fy) + (c * (1.0 - fx) + d * fx) * fy;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = pi(0u); let h = pi(1u); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let i = y * w + x; let cb = coarse_at(x, y); let rate = (P[8] * cb.x) / (1.0 + P[11] * cb.y);
  var d = D[i]; let a = A[i]; let dt = P[7];
  let dr = rate * (a.x - d.x) * dt; d.x += dr;
  let dg = rate * (a.y - d.y) * dt; d.y += dg;
  let db = rate * (a.z - d.z) * dt; d.z += db;
  d.w = dr + dg + db; D[i] = d;
}
`;
export const ADJ_CHEM_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> D: array<vec4f>;
@group(0) @binding(2) var<storage, read> F: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> G: array<vec4f>;
fn at(i: i32, j: i32) -> vec2f { let cw = pi(3u); let ch = pi(4u); return F[clamp(j, 0, ch - 1) * cw + clamp(i, 0, cw - 1)].xy; }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let cw = pi(3u); let ch = pi(4u); let i = i32(id.x); let j = i32(id.y); if (i >= cw || j >= ch) { return; }
  let w = pi(0u); let h = pi(1u); let s = pi(2u);
  var used = 0.0; var cnt = 0.0;
  for (var yy = j * s; yy < min(h, j * s + s); yy++) { for (var xx = i * s; xx < min(w, i * s + s); xx++) { used += D[yy * w + xx].w; cnt += 1.0; } }
  used = used / cnt;
  let f0 = at(i, j); let dt = P[7];
  let l = at(i - 1, j) + at(i + 1, j) + at(i, j - 1) + at(i, j + 1) - 4.0 * f0;
  let c = f0.x + P[5] * l.x * dt - P[9] * used + P[10] * (1.0 - f0.x) * dt;
  let b = f0.y + P[6] * l.y * dt + P[12] * used - P[13] * f0.y * dt;
  G[j * cw + i] = vec4f(c, b, 0.0, 0.0);
}
`;
export const ADJ_OUT_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> scene: array<vec4f>;
@group(0) @binding(2) var<storage, read> A: array<vec4f>;
@group(0) @binding(3) var<storage, read> D: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> img: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> out8: array<u32>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = pi(0u); let h = pi(1u); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let i = y * w + x; let free = 1.0 - P[17]; let eps = 1e-6;
  let o = scene[i].xyz * ((D[i].xyz + vec3f(eps)) / (A[i].xyz * free + vec3f(eps)));
  img[i] = vec4f(o, 1.0); out8[i] = lab_pack(o, P[18]);
}
`;
