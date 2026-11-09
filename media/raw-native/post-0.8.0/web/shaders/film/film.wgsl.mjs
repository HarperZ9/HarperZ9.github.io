// WGSL for the film passes. Mirrors film.mjs, grain.mjs, stocks.mjs (negDensities, printPixel)
// and run.mjs line for line. The halo passes are the CRT's (crt/glass.wgsl.mjs).
export const FILM_HEAD = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
fn p3(i: u32) -> vec3f { return vec3f(P[i], P[i + 1u], P[i + 2u]); }
fn pow10(x: f32) -> f32 { return exp2(x * 3.321928094887362); }
fn log10_(x: f32) -> f32 { return log2(x) * 0.30102999566398120; }
fn curve(x: f32, dmin: f32, span: f32, k: f32, x0: f32) -> f32 { return dmin + span / (1.0 + exp(-k * (x - x0))); }
`;

export const EXPOSE_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> scene: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> H: array<vec4f>;
fn scene_at(x: f32, y: f32) -> vec3f {
  let W = i32(P[P_inW]); let Hh = i32(P[P_inH]);
  let fx = clamp(x, 0.0, f32(W - 1)); let fy = clamp(y, 0.0, f32(Hh - 1));
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy)); let x1 = min(W - 1, x0 + 1); let y1 = min(Hh - 1, y0 + 1);
  let tx = fx - f32(x0); let ty = fy - f32(y0);
  let a = scene[u32(y0 * W + x0)].xyz; let b = scene[u32(y0 * W + x1)].xyz; let c = scene[u32(y1 * W + x0)].xyz; let d = scene[u32(y1 * W + x1)].xyz;
  return (a * (1.0 - tx) + b * tx) * (1.0 - ty) + (c * (1.0 - tx) + d * tx) * ty;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let W = u32(P[P_outW]); let Ho = u32(P[P_outH]);
  if (id.x >= W || id.y >= Ho) { return; }
  let sx = P[P_inW] / P[P_outW]; let sy = P[P_inH] / P[P_outH];
  let c = scene_at((f32(id.x) + 0.5 - P[P_weave]) * sx - 0.5, (f32(id.y) + 0.5 - P[P_weave + 1u]) * sy - 0.5);
  let k = P[P_evK]; let e = P_E;
  H[id.y * W + id.x] = vec4f(k * (P[e] * c.x + P[e + 1u] * c.y + P[e + 2u] * c.z),
    k * (P[e + 3u] * c.x + P[e + 4u] * c.y + P[e + 5u] * c.z), k * (P[e + 6u] * c.x + P[e + 7u] * c.y + P[e + 8u] * c.z), 0.0);
}`;

export const DEVELOP_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> H: array<vec4f>;
@group(0) @binding(2) var<storage, read> hc: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> F: array<vec4f>;
fn halo_up(x: u32, y: u32) -> vec3f {
  let q = P[P_haloQ]; let gw = i32(P[P_gw]); let gh = i32(P[P_gh]);
  let fx = clamp((f32(x) + 0.5) / q - 0.5, 0.0, f32(gw - 1)); let fy = clamp((f32(y) + 0.5) / q - 0.5, 0.0, f32(gh - 1));
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy)); let x1 = min(gw - 1, x0 + 1); let y1 = min(gh - 1, y0 + 1);
  let tx = fx - f32(x0); let ty = fy - f32(y0);
  let a = hc[u32(y0 * gw + x0)].xyz; let b = hc[u32(y0 * gw + x1)].xyz; let c = hc[u32(y1 * gw + x0)].xyz; let d = hc[u32(y1 * gw + x1)].xyz;
  return (a * (1.0 - tx) + b * tx) * (1.0 - ty) + (c * (1.0 - tx) + d * tx) * ty;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let W = u32(P[P_outW]); let Ho = u32(P[P_outH]);
  if (id.x >= W || id.y >= Ho) { return; }
  let i = id.y * W + id.x; let hl = halo_up(id.x, id.y); var D = vec3f(0.0);
  for (var l = 0u; l < 3u; l++) {
    let h = max(1e-6, H[i][l] + P[P_haloS + l] * hl[l]);
    D[l] = curve(log10_(h), P[P_negDmin + l], P[P_negSpan + l], P[P_negK + l], P[P_negX0 + l]);
  }
  let d = D - p3(P_negDmin); let m = (d.x + d.y + d.z) / 3.0;
  let Di = p3(P_negDmin) + d + P[P_interimage] * (d - m);
  var o = vec4f(0.0);
  for (var l = 0u; l < 3u; l++) {
    let span = P[P_negSpan + l]; let dd = min(span, max(0.0, Di[l] - P[P_negDmin + l]));
    o[l] = (1.0 - pow10(-dd)) / (1.0 - pow10(-span));
  }
  F[i] = o;
}`;

// One separable pass of the emulsion-scatter blur (P_mtfDir 0 along x, 1 along y).
export const MTF_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> mw: array<f32>;
@group(0) @binding(2) var<storage, read> a: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> o: array<vec4f>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let W = i32(P[P_outW]); let Hh = i32(P[P_outH]); let x = i32(id.x); let y = i32(id.y);
  if (x >= W || y >= Hh) { return; }
  let r = (i32(arrayLength(&mw)) - 1) / 2; let alongY = P[P_mtfDir] > 0.5; var s = vec3f(0.0);
  for (var k = -r; k <= r; k++) {
    var xx = x; var yy = y;
    if (alongY) { yy = clamp(y + k, 0, Hh - 1); } else { xx = clamp(x + k, 0, W - 1); }
    s += mw[k + r] * a[yy * W + xx].xyz;
  }
  o[y * W + x] = vec4f(s, 0.0);
}`;
