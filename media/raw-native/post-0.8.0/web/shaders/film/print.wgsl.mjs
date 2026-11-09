// WGSL for the film's last pass: grain (grain.mjs), print and projection (stocks.mjs
// printPixel), and the display encode (run.mjs encodeFilm8).
export const PRINT_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> tab: array<f32>;
@group(0) @binding(2) var<storage, read> F: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> img: array<vec4f>;
@group(0) @binding(4) var<storage, read> pois: array<u32>;
fn u_at(x: i32, y: i32, l: u32) -> f32 { return F[u32(y) * u32(P[P_outW]) + u32(x)][l]; }
fn table_at(u: f32) -> f32 {
  let f = clamp(u * f32(JN - 1u), 0.0, f32(JN - 1u)); let i = min(JN - 2u, u32(floor(f)));
  return tab[T_J + i] + (tab[T_J + i + 1u] - tab[T_J + i]) * (f - f32(i));
}
fn grain_mc(px: u32, py: u32, l: u32, r: f32) -> f32 {
  let um = P[P_umPerPx]; let rPx = r / um; let W = i32(P[P_outW]); let H = i32(P[P_outH]);
  let ns = u32(min(64.0, max(8.0, ceil(12.0 / (3.141592653589793 * rPx * rPx)))));
  let seed = u32(P[P_frame]) * 3u + l; var hit = 0.0;
  for (var s = 0u; s < ns; s++) {
    let x = (f32(px) + hash3(px, py, seed * 131u + 2u * s)) * um; let y = (f32(py) + hash3(px, py, seed * 131u + 2u * s + 1u)) * um;
    let cx0 = i32(floor(x / r)); let cy0 = i32(floor(y / r)); var cov = 0.0;
    for (var cy = cy0 - 1; cy <= cy0 + 1 && cov < 1.0; cy++) { for (var cx = cx0 - 1; cx <= cx0 + 1 && cov < 1.0; cx++) {
      let qx = clamp(i32(floor((f32(cx) + 0.5) * r / um)), 0, W - 1); let qy = clamp(i32(floor((f32(cy) + 0.5) * r / um)), 0, H - 1);
      let u = min(0.999, u_at(qx, qy, l)); let mu = -log(1.0 - u) / 3.141592653589793;
      let ucx = bitcast<u32>(cx); let ucy = bitcast<u32>(cy);
      let hU = pcg(ucx ^ pcg(ucy ^ pcg(seed * 977u + 1u)));
      let mq = u32(clamp(floor(mu / MU_MAX * f32(MU_LEVELS)), 0.0, f32(MU_LEVELS - 1u)));
      var k = 0u;
      while (k < POIS_K && hU >= pois[mq * POIS_K + k]) { k++; }
      for (var g = 0u; g < k; g++) {
        let gx = (f32(cx) + hash3(ucx, ucy, seed * 977u + 2u + 2u * g)) * r; let gy = (f32(cy) + hash3(ucx, ucy, seed * 977u + 3u + 2u * g)) * r;
        let e = clamp(0.5 + (r - length(vec2f(x - gx, y - gy))) / (0.05 * r), 0.0, 1.0);
        cov = max(cov, e);
      }
    } }
    hit += cov;
  }
  return hit / f32(ns);
}
fn grain_analytic(px: u32, py: u32, l: u32, u: f32, r: f32) -> f32 {
  let seed = u32(P[P_frame]) * 3u + l;
  let u1 = max(1e-7, hash3(px, py, seed * 131u + 200u)); let u2 = hash3(px, py, seed * 131u + 201u);
  let z = sqrt(-2.0 * log(u1)) * cos(6.283185307179586 * u2); let um = P[P_umPerPx];
  return u + sqrt(table_at(u) * r * r / (um * um)) * z;
}
fn grain_at(px: u32, py: u32, l: u32) -> f32 {
  let u = u_at(i32(px), i32(py), l); let r = P[P_grainR + l];
  if (r <= 0.0) { return u; }
  let t = clamp((r / P[P_umPerPx] - 0.25) / 0.15, 0.0, 1.0); let w = t * t * (3.0 - 2.0 * t);
  var v: f32;
  if (w >= 1.0) { v = grain_mc(px, py, l, r); }
  else if (w <= 0.0) { v = grain_analytic(px, py, l, u, r); }
  else { let a = grain_mc(px, py, l, r) - u; let b = grain_analytic(px, py, l, u, r) - u; v = u + w * a + sqrt(1.0 - w * w) * b; }
  return clamp(u + (v - u) * P[P_grainCs + l], 0.0, 1.0);
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let W = u32(P[P_outW]); let Ho = u32(P[P_outH]);
  if (id.x >= W || id.y >= Ho) { return; }
  var D = vec3f(0.0);
  for (var l = 0u; l < 3u; l++) {
    let g = grain_at(id.x, id.y, l); let span = P[P_negSpan + l];
    D[l] = P[P_negDmin + l] - log10_(max(1e-6, 1.0 - g * (1.0 - pow10(-span))));
  }
  var Hp = vec3f(0.0);
  for (var w = 0u; w < NL; w++) {
    let p = vec3f(tab[T_negPrim + 3u * w], tab[T_negPrim + 3u * w + 1u], tab[T_negPrim + 3u * w + 2u]);
    let T = pow10(-(dot(D, p) + tab[T_negConst + w]));
    Hp += T * vec3f(tab[T_printW + 3u * w], tab[T_printW + 3u * w + 1u], tab[T_printW + 3u * w + 2u]);
  }
  var Dp = vec3f(0.0);
  for (var j = 0u; j < 3u; j++) { Dp[j] = curve(log10_(max(Hp[j], 1e-12)) + P[P_logGain + j], P[P_prtDmin + j], P[P_prtSpan + j], P[P_prtK + j], 0.0); }
  let dm = p3(P_prtDmin); let silver = P[P_bleach] * (Dp.x + Dp.y + Dp.z - dm.x - dm.y - dm.z) / 3.0;
  var xyz = vec3f(0.0);
  for (var w = 0u; w < NL; w++) {
    let p = vec3f(tab[T_printPrim + 3u * w], tab[T_printPrim + 3u * w + 1u], tab[T_printPrim + 3u * w + 2u]);
    let T = pow10(-(dot(Dp, p) + P[P_printBase] + silver));
    xyz += T * vec3f(tab[T_projV + 3u * w], tab[T_projV + 3u * w + 1u], tab[T_projV + 3u * w + 2u]);
  }
  let m = P_outM;
  img[id.y * W + id.x] = vec4f(P[m] * xyz.x + P[m + 1u] * xyz.y + P[m + 2u] * xyz.z,
    P[m + 3u] * xyz.x + P[m + 4u] * xyz.y + P[m + 5u] * xyz.z, P[m + 6u] * xyz.x + P[m + 7u] * xyz.y + P[m + 8u] * xyz.z, 1.0);
}`;

export const ENCODE_FILM8_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> img: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> out8: array<u32>;
fn enc(v: f32) -> u32 {
  let l = clamp(v, 0.0, 1.0); var s: f32;
  if (l <= 0.0031308) { s = l * 12.92; } else { s = 1.055 * pow(l, 1.0 / 2.4) - 0.055; }
  return u32(floor(s * 255.0 + 0.5));
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let W = u32(P[P_outW]); let Ho = u32(P[P_outH]);
  if (id.x >= W || id.y >= Ho) { return; }
  let c = img[id.y * W + id.x];
  out8[id.y * W + id.x] = enc(c.x) | (enc(c.y) << 8u) | (enc(c.z) << 16u) | (255u << 24u);
}`;
