// WGSL for pigment-space lighting (lightpaint.mjs), one pass.
// P: 0 w, 1 h, 2 Emid, 3 t0, 4 strength, 5 shape, 6 complement, 7..10 shadow, 11..14 light,
// 15..17 fog colour, 18 display gain. pig: the paint's packed tables (paint/gpu.mjs packPigments).
import { NL, T_K, T_S, T_W, T_LUT } from "../paint/common.wgsl.mjs";

// Kubelka-Munk decode and the latent lookup, the same arithmetic as paint/common.wgsl.mjs.
export const KM_WGSL = /* wgsl */ `
const NL: u32 = ${NL}u; const T_K: u32 = ${T_K}u; const T_S: u32 = ${T_S}u; const T_W: u32 = ${T_W}u; const T_LUT: u32 = ${T_LUT}u;
fn km_decode(c: vec4f) -> vec3f {
  var o = vec3f(0.0);
  for (var w = 0u; w < NL; w++) {
    let K = dot(c, vec4f(pig[T_K + 4u * w], pig[T_K + 4u * w + 1u], pig[T_K + 4u * w + 2u], pig[T_K + 4u * w + 3u]));
    let S = dot(c, vec4f(pig[T_S + 4u * w], pig[T_S + 4u * w + 1u], pig[T_S + 4u * w + 2u], pig[T_S + 4u * w + 3u]));
    let q = K / max(S, 1e-9); let R = 1.0 + q - sqrt(q * q + 2.0 * q);
    o += R * vec3f(pig[T_W + 3u * w], pig[T_W + 3u * w + 1u], pig[T_W + 3u * w + 2u]);
  }
  return o;
}
fn lut_conc(s: vec3f) -> vec4f {
  let N = 17; let f = clamp(s, vec3f(0.0), vec3f(1.0)) * f32(N - 1);
  let i0 = vec3i(min(vec3f(f32(N - 2)), floor(f))); let t = f - vec3f(i0); var c = vec4f(0.0);
  for (var dz = 0; dz < 2; dz++) { for (var dy = 0; dy < 2; dy++) { for (var dx = 0; dx < 2; dx++) {
    let w = select(1.0 - t.x, t.x, dx == 1) * select(1.0 - t.y, t.y, dy == 1) * select(1.0 - t.z, t.z, dz == 1);
    let o = T_LUT + u32((((i0.z + dz) * N + i0.y + dy) * N + i0.x + dx) * 4);
    c += w * vec4f(pig[o], pig[o + 1u], pig[o + 2u], pig[o + 3u]);
  } } }
  return c;
}
fn srgb3(c: vec3f) -> vec3f { let q = clamp(c, vec3f(0.0), vec3f(1.0)); return vec3f(linear_to_srgb(q.x), linear_to_srgb(q.y), linear_to_srgb(q.z)); }
fn lum(c: vec3f) -> f32 { return 0.2126 * c.x + 0.7152 * c.y + 0.0722 * c.z; }
`;

export const LP_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> pig: array<f32>;
@group(0) @binding(2) var<storage, read> alb: array<vec4f>;
@group(0) @binding(3) var<storage, read> light: array<vec4f>;
@group(0) @binding(4) var<storage, read> aux: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> img: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> out8: array<u32>;
` + KM_WGSL + /* wgsl */ `
fn complement_of(lc: vec3f) -> vec3f {
  let mx = max(lc.x, max(lc.y, lc.z)); let mn = min(lc.x, min(lc.y, lc.z)); let q = vec3f(mx + mn) - lc;
  let m = max(max(q.x, max(q.y, q.z)), 1e-9); return 0.3 * q / m;
}
fn shade(a: vec3f, E: vec3f) -> vec3f {
  let e = lum(E); if (!(e > 1e-12)) { return vec3f(0.0); }
  let lc = E / e; let t = e / (e + P[2]); let t0 = P[3];
  var ws = 0.0; var wl = 0.0;
  if (t < t0) { ws = P[4] * pow((t0 - t) / t0, P[5]); }
  if (t > t0) { wl = P[4] * pow((t - t0) / (1.0 - t0), P[5]); }
  let ca = lut_conc(srgb3(a)); let ra = a - km_decode(ca);
  var cs = vec4f(P[7], P[8], P[9], P[10]);
  if (P[6] > 0.5) { cs = lut_conc(srgb3(complement_of(lc))); }
  let cl = vec4f(P[11], P[12], P[13], P[14]); let wa = 1.0 - ws - wl;
  let c = wa * ca + ws * cs + wl * cl;
  let paint = clamp(km_decode(c) + wa * ra, vec3f(0.0), vec3f(1.0));
  let tint = paint * lc; let yt = lum(tint); let tgt = lum(a * E);
  if (!(yt > 1e-9)) { return a * E; }
  return tint * (tgt / yt);
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = i32(round(P[0])); let h = i32(round(P[1])); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let i = y * w + x; let E = light[i].xyz; let k = aux[i];
  var c = E; if (k.y > 1.5) { c = shade(alb[i].xyz, E); }
  let o = c * (1.0 - k.x) + vec3f(P[15], P[16], P[17]) * k.x;
  img[i] = vec4f(o, 1.0); out8[i] = lab_pack(o, P[18]);
}
`;
