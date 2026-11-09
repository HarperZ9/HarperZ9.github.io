// WGSL for dither-quantised lighting (ditherlight.mjs): one pass, one thread per pixel.
// P (f32): 0 w, 1 h, 2 levels, 3 source (0 bayer8, 1 blue64), 4 anchor (0 screen, 1 world-fixed,
// 2 world-octave), 5 cell, 6 px, 7 pa, 8 gamma, 9 dark, 10 hemi, 11 fogDist, 12 fogMax,
// 13 light count, 14..16 ink (linear), 17..19 paper (linear).
// gb: six vec4f per pixel: (albedo, kind, depth, haze), wpos, nrm, apos, anrm, vis.
// lights: six vec4f per light: (kind 0 radial / 1 beam, intensity, radius or range, core or
// cos outer), (pos, wrap), (dir, cos inner), (tan, slats), (bit, duty), (phase, 0, 0, 0).
// bn: blue-noise ranks, 64 x 64. lvl: output level per pixel. out8: RGBA8 per pixel.
export const DITHERLIGHT_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> gb: array<vec4f>;
@group(0) @binding(2) var<storage, read> lights: array<vec4f>;
@group(0) @binding(3) var<storage, read> bn: array<u32>;
@group(0) @binding(4) var<storage, read_write> lvl: array<u32>;
@group(0) @binding(5) var<storage, read_write> out8: array<u32>;

fn sat1(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }
fn smooth1(a: f32, b: f32, x: f32) -> f32 { let t = sat1((x - a) / (b - a)); return t * t * (3.0 - 2.0 * t); }

fn mask_at(i: u32, Pw: vec3f) -> f32 {
  let b = i * 6u; let l0 = lights[b]; let l1 = lights[b + 1u];
  let v = Pw - l1.xyz; let r2 = dot(v, v);
  if (l0.x < 0.5) {
    let q = r2 / (l0.z * l0.z);
    if (q >= 1.0) { return 0.0; }
    return (l0.y * (1.0 - q) * (1.0 - q)) / (1.0 + r2 / (l0.w * l0.w));
  }
  let r = sqrt(r2);
  if (r < 1e-4 || r >= l0.z) { return 0.0; }
  let l2 = lights[b + 2u]; let l3 = lights[b + 3u]; let l4 = lights[b + 4u]; let l5 = lights[b + 5u];
  let c = dot(v, l2.xyz) / r; let cone = smooth1(l0.w, l2.w, c);
  if (cone <= 0.0) { return 0.0; }
  var blade = 1.0;
  if (l3.w > 0.0) {
    let phi = atan2(dot(v, l4.xyz), dot(v, l3.xyz)); let c0 = cos(3.141592653589793 * l4.w);
    blade = smooth1(c0 - 0.06, c0 + 0.06, cos(l3.w * phi + l5.x));
  }
  return l0.y * cone * blade * (1.0 - r / l0.z);
}
fn surface_term(i: u32, Pw: vec3f, N: vec3f) -> f32 {
  let l1 = lights[i * 6u + 1u]; let v = l1.xyz - Pw; let l = length(v);
  if (l < 1e-6) { return 1.0; }
  return sat1((dot(N, v) / l + l1.w) / (1.0 + l1.w));
}

fn bayer8(x0: i32, y0: i32) -> u32 {
  let x = u32(x0 & 7); let y = u32(y0 & 7); let v = x ^ y;
  return ((v & 1u) << 5u) | ((y & 1u) << 4u) | (((v >> 1u) & 1u) << 3u) | (((y >> 1u) & 1u) << 2u) | (((v >> 2u) & 1u) << 1u) | ((y >> 2u) & 1u);
}
fn threshold_at(src: u32, cx: i32, cy: i32) -> f32 {
  if (src == 0u) { return (f32(bayer8(cx, cy)) + 0.5) / 64.0; }
  return (f32(bn[u32(((cy & 63) << 6) | (cx & 63))]) + 0.5) / 4096.0;
}
fn octave_of(cell: f32, px: f32, pa: f32, depth: f32) -> f32 {
  let r = (px * pa * max(depth, 1e-6)) / cell;
  if (r <= 1.0) { return 0.0; }
  return ceil(log2(r));
}
fn level_lin(k: f32, n: f32, gamma: f32) -> f32 { return pow(k / (n - 1.0), gamma); }

@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = u32(P[0]); let h = u32(P[1]);
  if (id.x >= w || id.y >= h) { return; }
  let i = id.y * w + id.x; let b = i * 6u;
  let g0 = gb[b]; let Pw = gb[b + 1u].xyz; let N = gb[b + 2u].xyz; let A = gb[b + 3u].xyz; let AN = gb[b + 4u].xyz; let vis = gb[b + 5u];
  let n = P[2]; let gamma = P[8];
  var Y = g0.x;
  if (g0.y > 1.5) {
    var E = P[9] * (1.0 - P[10] + P[10] * (0.5 + 0.5 * N.y));
    let nl = u32(P[13]);
    for (var k = 0u; k < nl; k++) {
      var v = vis.x; if (k == 1u) { v = vis.y; } else if (k == 2u) { v = vis.z; } else if (k == 3u) { v = vis.w; }
      if (!(v > 0.0)) { continue; }
      let m = mask_at(k, Pw);
      if (m > 0.0) { E += v * m * surface_term(k, Pw, N); }
    }
    let lit = min(1.0, max(0.0, g0.x * E)); let r = g0.z / P[11]; let tf = P[12] * (1.0 - exp(-r * r));
    Y = lit * (1.0 - tf) + tf;
  }
  let hz = min(1.0, max(0.0, g0.w)); if (hz > 0.0) { Y = 1.0 - (1.0 - Y) * (1.0 - hz); }
  // anchor cell
  var cx = i32(id.x); var cy = i32(id.y);
  if (P[4] > 0.5) {
    let ax = abs(AN.x); let ay = abs(AN.y); let az = abs(AN.z);
    var u = A.x; var vv = A.y;
    if (ax >= ay && ax >= az) { u = A.z; vv = A.y; } else if (ay >= az) { u = A.x; vv = A.z; }
    var size = P[5];
    if (P[4] > 1.5) { size = size * exp2(octave_of(P[5], P[6], P[7], g0.z)); }
    cx = i32(floor(u / size)); cy = i32(floor(vv / size));
  }
  let t = threshold_at(u32(P[3]), cx, cy);
  let y = min(1.0, max(0.0, Y));
  var k = floor(pow(y, 1.0 / gamma) * (n - 1.0));
  if (k > n - 2.0) { k = n - 2.0; }
  let lo = level_lin(k, n, gamma); let hi = level_lin(k + 1.0, n, gamma); let f = (y - lo) / (hi - lo);
  if (f > t) { k = k + 1.0; }
  lvl[i] = u32(k);
  let l = level_lin(k, n, gamma);
  let ink = vec3f(P[14], P[15], P[16]); let paper = vec3f(P[17], P[18], P[19]); let c = ink + (paper - ink) * l;
  let r8 = u32(floor(linear_to_srgb(c.x) * 255.0 + 0.5)); let g8 = u32(floor(linear_to_srgb(c.y) * 255.0 + 0.5)); let b8 = u32(floor(linear_to_srgb(c.z) * 255.0 + 0.5));
  out8[i] = r8 | (g8 << 8u) | (b8 << 16u) | (255u << 24u);
}
`;
