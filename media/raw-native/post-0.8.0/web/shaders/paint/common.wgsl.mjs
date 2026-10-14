// WGSL shared by the painterly passes: the parameter block, value noise, paper, canvas,
// bristles, warp, the pigment lookup and Kubelka-Munk decode. Mirrors noise.mjs and pigments.mjs.
export const PAINT_FIELDS = ["w", "h", "exposure", "radius", "q", "zeta", "eta", "strokeLen", "ox", "oy", "medium", "impasto", "gloss", "push",
  "broken", "valueBands", "lines", "lineSigma", "lineSharp", "warp", "granulation", "edge", "dilution", "dir", "canvasMode"];
export const PAINT_INDEX = Object.fromEntries(PAINT_FIELDS.map((k, i) => [k, i]));
const layout = PAINT_FIELDS.map((k, i) => `const P_${k}: u32 = ${i}u;`).join("\n");
// Table offsets in the pigment buffer: K (31 x 4), S (31 x 4), W (31 x 3), then the 17^3 x 4 lookup.
export const NL = 31, T_K = 0, T_S = NL * 4, T_W = NL * 8, T_LUT = NL * 11;

export const PAINT_COMMON_WGSL = layout + /* wgsl */ `
const NL: u32 = ${NL}u; const T_K: u32 = ${T_K}u; const T_S: u32 = ${T_S}u; const T_W: u32 = ${T_W}u; const T_LUT: u32 = ${T_LUT}u;
const PI: f32 = 3.141592653589793;
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> pig: array<f32>;   // every pass binds it (read with _ = pig[0] where unused)
fn W() -> i32 { return i32(P[P_w]); } fn H() -> i32 { return i32(P[P_h]); }
fn fade(t: f32) -> f32 { return t * t * (3.0 - 2.0 * t); }
fn vnoise(x: f32, y: f32, seed: u32) -> f32 {
  let xi = floor(x); let yi = floor(y); let tx = fade(x - xi); let ty = fade(y - yi);
  let ix = bitcast<u32>(i32(xi)); let iy = bitcast<u32>(i32(yi));
  let a = hash3(ix, iy, seed); let b = hash3(ix + 1u, iy, seed); let c = hash3(ix, iy + 1u, seed); let d = hash3(ix + 1u, iy + 1u, seed);
  return (a + (b - a) * tx) * (1.0 - ty) + (c + (d - c) * tx) * ty;
}
fn paper_height(x: f32, y: f32) -> f32 {
  let c1 = 0.9397; let s1 = 0.342; let c2 = -0.342; let s2 = 0.9397;
  let f1 = vnoise((x * c1 + y * s1) / 0.9, (-x * s1 + y * c1) / 7.0, 31u); let f2 = vnoise((x * c2 + y * s2) / 0.9, (-x * s2 + y * c2) / 7.0, 37u);
  return 0.45 * vnoise(x / 2.2, y / 2.2, 11u) + 0.25 * vnoise(x / 9.0, y / 9.0, 13u) + 0.15 * f1 + 0.15 * f2;
}
fn bristle(x: f32, y: f32) -> f32 { return 0.7 * vnoise(x / 1.3, y / 1.3, 53u) + 0.3 * vnoise(x / 5.0, y / 5.0, 59u); }
fn stroke_id(x: f32, y: f32) -> f32 { return vnoise(x / 6.0, y / 6.0, 67u); }
fn canvas_height(x: f32, y: f32) -> f32 { return 0.5 + 0.25 * sin(2.0 * PI * x / 3.2) * cos(2.0 * PI * y / 3.2) + 0.25 * (vnoise(x / 1.5, y / 1.5, 61u) - 0.5); }
fn warp_field(x: f32, y: f32) -> vec2f { return vec2f(2.0 * vnoise(x / 23.0, y / 23.0, 71u) - 1.0, 2.0 * vnoise(x / 23.0, y / 23.0, 73u) - 1.0); }
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
fn smooth_(a: f32, b: f32, x: f32) -> f32 { let t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
fn major_vec(e: f32, f: f32, g: f32) -> vec3f {
  let tr = e + g; let l1 = (tr + sqrt((e - g) * (e - g) + 4.0 * f * f)) / 2.0;
  let a = vec2f(f, l1 - e); let b = vec2f(l1 - g, f); let na = length(a); let nb = length(b);
  if (na >= nb) { return vec3f(a, na); } return vec3f(b, nb);
}
fn flow(T: vec4f) -> vec3f {
  let E = T.x; let F = T.y; let G = T.z; let tr = E + G; let dsc = sqrt((E - G) * (E - G) + 4.0 * F * F);
  let l1 = (tr + dsc) / 2.0; let l2 = (tr - dsc) / 2.0;
  let sh = clamp((tr - 1e-7) / 9e-7, 0.0, 1.0); var A = 0.0; if (tr > 1e-12) { A = (l1 - l2) / (l1 + l2) * sh * sh * (3.0 - 2.0 * sh); }
  let s = clamp((A - 0.02) / 0.08, 0.0, 1.0); let k = s * s * (3.0 - 2.0 * s); var inv = 0.0; if (tr > 1e-12) { inv = 1.0 / tr; }
  let m = major_vec(k * E * inv + (1.0 - k) * 0.5, k * F * inv - (1.0 - k) * 0.5, k * G * inv + (1.0 - k) * 0.5);
  if (m.z <= 1e-12) { return vec3f(0.7071067811865476, 0.7071067811865476, A); }
  return vec3f(-m.y / m.z, m.x / m.z, A);
}
`;
