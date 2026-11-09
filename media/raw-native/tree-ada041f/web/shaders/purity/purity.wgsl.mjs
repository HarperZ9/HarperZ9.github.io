// WGSL for CRT purity and degauss (purity.mjs), one pass.
// P: 0 w, 1 h, 2 s, 3 w (beam), 4 mag, 5 magScale, 6 earth, 7 degauss, 8 tau, 9 mains, 10 field,
// 11 blank, 12 wobble, 13 t, 14 spread.
export const PURITY_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> img: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> out8: array<u32>;
const PI_P: f32 = 3.141592653589793;
fn centre(k: i32) -> f32 { return f32(k - 1) / 3.0; }
fn overlap(a0: f32, a1: f32, b0: f32, b1: f32) -> f32 { return max(0.0, min(a1, b1) - max(a0, b0)); }
fn fade5(t: f32) -> f32 { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
fn vnoise2(x: f32, y: f32, seed: u32) -> f32 {
  let xi = i32(floor(x)); let yi = i32(floor(y)); let u = fade5(x - f32(xi)); let v = fade5(y - f32(yi));
  let a = hash3(u32(xi + 4096), u32(yi + 4096), seed); let b = hash3(u32(xi + 4097), u32(yi + 4096), seed);
  let c = hash3(u32(xi + 4096), u32(yi + 4097), seed); let d = hash3(u32(xi + 4097), u32(yi + 4097), seed);
  return (a * (1.0 - u) + b * u) * (1.0 - v) + (c * (1.0 - u) + d * u) * v;
}
fn enc(v: f32) -> u32 { let c = clamp(v, 0.0, 1.0); var s = 1.055 * pow(c, 1.0 / 2.4) - 0.055; if (c <= 0.0031308) { s = c * 12.92; } return u32(floor(s * 255.0 + 0.5)); }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let W = i32(round(P[0])); let H = i32(round(P[1])); let x = i32(id.x); let y = i32(id.y); if (x >= W || y >= H) { return; }
  let wf = f32(W); let hf = f32(H);
  let u = ((f32(x) + 0.5) / wf) * 2.0 - 1.0; let v = ((f32(y) + 0.5) / hf) * 2.0 - 1.0; let a = wf / hf;
  let r2 = (u * u * a * a + v * v) / (a * a + 1.0) * 2.0;
  let sc = P[5] * wf;
  let m = P[4] * ((0.65 * vnoise2(f32(x) / sc, f32(y) / sc, 31u) + 0.35 * vnoise2(f32(x) / (0.4 * sc), f32(y) / (0.4 * sc), 37u)) - 0.5) * 2.0;
  let stat = m + P[6] * u * r2;
  let tl = P[13] + (f32(y) / hf) * (1.0 - P[11]) / P[10];
  let dg = P[7] * exp(-tl / P[8]) * sin(2.0 * PI_P * P[9] * tl) * (0.3 + r2);
  let e = stat + dg;
  let xs = f32(x) - P[12] * (dg / max(P[7], 1e-9)); let x0 = i32(floor(xs)); let fx = xs - f32(x0);
  let c0 = src[y * W + clamp(x0, 0, W - 1)].xyz; let c1 = src[y * W + clamp(x0 + 1, 0, W - 1)].xyz;
  let I = c0 * (1.0 - fx) + c1 * fx;
  var o = vec3f(0.0);
  for (var k = 0; k < 3; k++) {
    let ek = e * (1.0 + P[14] * f32(k - 1));
    let a0 = centre(k) + ek - P[3] / 2.0; let a1 = centre(k) + ek + P[3] / 2.0;
    for (var j = 0; j < 3; j++) {
      var f = 0.0;
      for (var mm = -1; mm <= 1; mm++) { f += overlap(a0, a1, centre(j) + f32(mm) - P[2] / 2.0, centre(j) + f32(mm) + P[2] / 2.0) / P[3]; }
      o[j] += f * I[k];
    }
  }
  img[y * W + x] = vec4f(o, 1.0);
  out8[y * W + x] = enc(o.x) | (enc(o.y) << 8u) | (enc(o.z) << 16u) | (255u << 24u);
}
`;
