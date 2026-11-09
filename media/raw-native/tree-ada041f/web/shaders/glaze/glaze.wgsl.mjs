// WGSL for interference glazes (glaze.mjs), one pass.
// P: 0 w, 1 h, 2 d0, 3 dVar, 4 noiseScale, 5 coverage, 6 n0, 7 n2, 8 A, 9 B, 10 dispersion,
// 11 filmN, 12..14 camera fwd, 15..17 right, 18..20 up, 21 aspect, 22 tan, 23..25 fog, 26 gain,
// 27..29 camera eye.
import { KM_WGSL } from "../lightpaint/lightpaint.wgsl.mjs";

export const GLAZE_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> pig: array<f32>;
@group(0) @binding(2) var<storage, read> alb: array<vec4f>;
@group(0) @binding(3) var<storage, read> light: array<vec4f>;
@group(0) @binding(4) var<storage, read> aux: array<vec4f>;
@group(0) @binding(5) var<storage, read> nrm: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> img: array<vec4f>;
@group(0) @binding(7) var<storage, read_write> out8: array<u32>;
` + KM_WGSL + /* wgsl */ `
const PI_G: f32 = 3.141592653589793;
fn film_index(lam: f32) -> f32 { if (P[10] > 0.5) { let l = lam / 1000.0; return P[8] + P[9] / (l * l); } return P[11]; }
fn airy(r01: f32, r12: f32, cd: f32) -> f32 { return (r01 * r01 + r12 * r12 + 2.0 * r01 * r12 * cd) / (1.0 + r01 * r01 * r12 * r12 + 2.0 * r01 * r12 * cd); }
fn film_reflectance(lam: f32, cos_air: f32, d: f32) -> f32 {
  let n0 = P[6]; let n1 = film_index(lam); let n2 = P[7]; let sa = sqrt(max(0.0, 1.0 - cos_air * cos_air));
  let s0 = sa / n0; let c0 = sqrt(1.0 - s0 * s0); let s1 = sa / n1; let c1 = sqrt(1.0 - s1 * s1); let s2 = sa / n2; let c2 = sqrt(1.0 - s2 * s2);
  let cd = cos((4.0 * PI_G * n1 * d * c1) / lam);
  let rs = airy((n0 * c0 - n1 * c1) / (n0 * c0 + n1 * c1), (n1 * c1 - n2 * c2) / (n1 * c1 + n2 * c2), cd);
  let rp = airy((n1 * c0 - n0 * c1) / (n1 * c0 + n0 * c1), (n2 * c1 - n1 * c2) / (n2 * c1 + n1 * c2), cd);
  return 0.5 * (rs + rp);
}
fn fade5(t: f32) -> f32 { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
fn vnoise3(x: f32, y: f32, z: f32, seed: u32) -> f32 {
  let xi = i32(floor(x)); let yi = i32(floor(y)); let zi = i32(floor(z)); let u = fade5(x - f32(xi)); let v = fade5(y - f32(yi)); let w = fade5(z - f32(zi));
  var acc = array<f32, 2>(0.0, 0.0);
  for (var dk = 0; dk < 2; dk++) {
    let kz = u32(zi + dk + 4096) * 131u + seed;
    let a = hash3(u32(xi + 4096), u32(yi + 4096), kz); let b = hash3(u32(xi + 4097), u32(yi + 4096), kz);
    let c = hash3(u32(xi + 4096), u32(yi + 4097), kz); let d = hash3(u32(xi + 4097), u32(yi + 4097), kz);
    acc[dk] = (a * (1.0 - u) + b * u) * (1.0 - v) + (c * (1.0 - u) + d * u) * v;
  }
  return acc[0] * (1.0 - w) + acc[1] * w;
}
fn thickness_at(q: vec3f) -> f32 {
  let s1 = q / P[4]; let s2 = q / (0.37 * P[4]);
  return P[2] + P[3] * ((0.65 * vnoise3(s1.x, s1.y, s1.z, 17u) + 0.35 * vnoise3(s2.x, s2.y, s2.z, 29u)) - 0.5) * 2.0;
}
fn glaze_colour(a: vec3f, cos_air: f32, d: f32) -> vec3f {
  let c = lut_conc(srgb3(a)); var out = a;
  for (var w = 0u; w < NL; w++) {
    let K = dot(c, vec4f(pig[T_K + 4u * w], pig[T_K + 4u * w + 1u], pig[T_K + 4u * w + 2u], pig[T_K + 4u * w + 3u]));
    let S = dot(c, vec4f(pig[T_S + 4u * w], pig[T_S + 4u * w + 1u], pig[T_S + 4u * w + 2u], pig[T_S + 4u * w + 3u]));
    let q = K / max(S, 1e-9); let Rb = 1.0 + q - sqrt(q * q + 2.0 * q);
    let Rf = P[5] * film_reflectance(400.0 + 10.0 * f32(w), cos_air, d);
    let Rt = Rf + ((1.0 - Rf) * (1.0 - Rf) * Rb) / (1.0 - Rf * Rb);
    out += vec3f(pig[T_W + 3u * w], pig[T_W + 3u * w + 1u], pig[T_W + 3u * w + 2u]) * (Rt - Rb);
  }
  return out;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = i32(round(P[0])); let h = i32(round(P[1])); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let i = y * w + x; let E = light[i].xyz; let k = aux[i]; var c = E;
  if (k.y > 1.5) {
    let sx = ((f32(x) + 0.5) / f32(w) - 0.5) * 2.0 * P[21] * P[22]; let sy = (0.5 - (f32(y) + 0.5) / f32(h)) * 2.0 * P[22];
    let r = vec3f(P[12], P[13], P[14]) + vec3f(P[15], P[16], P[17]) * sx + vec3f(P[18], P[19], P[20]) * sy;
    let cos_air = min(1.0, abs(dot(nrm[i].xyz, r)) / length(r));
    let rl = length(r); let q = vec3f(P[27], P[28], P[29]) + r * (k.z / rl);
    let d = thickness_at(q);
    c = glaze_colour(alb[i].xyz, cos_air, d) * E;
  }
  let o = c * (1.0 - k.x) + vec3f(P[23], P[24], P[25]) * k.x;
  img[i] = vec4f(o, 1.0); out8[i] = lab_pack(o, P[26]);
}
`;
