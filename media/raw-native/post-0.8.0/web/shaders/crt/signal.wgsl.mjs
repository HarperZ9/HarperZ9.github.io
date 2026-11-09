// WGSL for the signal passes (encode, separate, demod). Mirrors signal.mjs line for line.
export const SIGNAL_PRELUDE = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> taps: array<f32>;
fn pi(i: u32) -> i32 { return i32(round(P[i])); }
fn frac1(x: f32) -> f32 { return x - floor(x); }
fn phase(k: i32, y: i32) -> f32 {
  return 6.283185307179586 * (f32(k & 3) / 4.0 + frac1(f32(y) * P[P_lineCyc]) + frac1(P[P_frame] * P[P_frameCyc]));
}
fn pal_sign(y: i32) -> f32 { return select(-1.0, 1.0, (y & 1) == 0); }
fn tap(which: u32, j: i32) -> f32 { return taps[u32(pi(which) + j + pi(which + 1u))]; }
`;

export const ENCODE_WGSL = /* wgsl */ `
@group(0) @binding(2) var<storage, read> src: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> enc: array<vec4f>;
fn held(y: i32, k: i32, c: u32) -> f32 {
  let N = pi(P_N); let kk = clamp(k, 0, N - 1); let sw = pi(P_srcW);
  let x = min(sw - 1, ((2 * kk + 1) * sw) / (2 * N));
  return src[u32(y * sw + x)][c];
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let N = pi(P_N); let k = i32(id.x); let y = i32(id.y);
  if (k >= N || y >= pi(P_lines)) { return; }
  let i = u32(y * N + k);
  if (pi(P_mode) == 0) {
    let h = pi(P_tapRgb + 1u); var s = vec3f(0.0);
    for (var j = -h; j <= h; j++) { let t = tap(P_tapRgb, j); s += t * vec3f(held(y, k + j, 0u), held(y, k + j, 1u), held(y, k + j, 2u)); }
    enc[i] = vec4f(s, 0.0); return;
  }
  let r = held(y, k, 0u); let g = held(y, k, 1u); let b = held(y, k, 2u);
  let h = pi(P_tapEnc + 1u); var a = 0.0; var q = 0.0;
  for (var j = -h; j <= h; j++) {
    let rr = held(y, k + j, 0u); let gg = held(y, k + j, 1u); let bb = held(y, k + j, 2u);
    let ca = P[P_fwd + 3u] * rr + P[P_fwd + 4u] * gg + P[P_fwd + 5u] * bb;
    let cq = P[P_fwd + 6u] * rr + P[P_fwd + 7u] * gg + P[P_fwd + 8u] * bb;
    let t = tap(P_tapEnc, j); a += t * ca; q += t * cq;
  }
  let ph = phase(k, y); var c: f32;
  if (pi(P_pal) == 1) { c = a * sin(ph) + pal_sign(y) * q * cos(ph); } else { c = a * cos(ph) + q * sin(ph); }
  enc[i] = vec4f(0.299 * r + 0.587 * g + 0.114 * b, c, 0.0, 0.0);
}`;

export const SEPARATE_WGSL = /* wgsl */ `
@group(0) @binding(2) var<storage, read> enc: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> sep: array<vec4f>;
fn comp(y: i32, k: i32) -> f32 { let N = pi(P_N); let e = enc[u32(y * N + clamp(k, 0, N - 1))]; return e.x + e.y; }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let N = pi(P_N); let lines = pi(P_lines); let k = i32(id.x); let y = i32(id.y);
  if (k >= N || y >= lines) { return; }
  let i = u32(y * N + k);
  if (pi(P_mode) == 1) { sep[i] = vec4f(enc[i].x, enc[i].y, 0.0, 0.0); return; }
  var yl = 0.0;
  if (pi(P_comb) == 1) {
    let y2 = select(min(1, lines - 1), y - 1, y > 0);
    yl = 0.5 * (comp(y, k) + comp(y2, k));
  } else {
    let h = pi(P_tapSep + 1u);
    for (var j = -h; j <= h; j++) { yl += tap(P_tapSep, j) * comp(y, k + j); }
  }
  sep[i] = vec4f(yl, comp(y, k) - yl, 0.0, 0.0);
}`;

export const DEMOD_WGSL = /* wgsl */ `
@group(0) @binding(2) var<storage, read> sep: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> sig: array<vec4f>;
fn chroma(y: i32, k: i32) -> f32 { let N = pi(P_N); return sep[u32(y * N + clamp(k, 0, N - 1))].y; }
fn demod_line(y: i32, k: i32) -> vec2f {
  let pal = pi(P_pal) == 1; var a = 0.0; var b = 0.0;
  let hi = pi(P_tapI + 1u);
  for (var j = -hi; j <= hi; j++) { let ph = phase(k + j, y); a += tap(P_tapI, j) * 2.0 * chroma(y, k + j) * select(cos(ph), sin(ph), pal); }
  let hq = pi(P_tapQ + 1u);
  for (var j = -hq; j <= hq; j++) { let ph = phase(k + j, y); b += tap(P_tapQ, j) * 2.0 * chroma(y, k + j) * select(sin(ph), pal_sign(y) * cos(ph), pal); }
  return vec2f(a, b);
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let N = pi(P_N); let k = i32(id.x); let y = i32(id.y);
  if (k >= N || y >= pi(P_lines)) { return; }
  let h = pi(P_tapLum + 1u); var Y = 0.0;
  for (var j = -h; j <= h; j++) { Y += tap(P_tapLum, j) * sep[u32(y * N + clamp(k + j, 0, N - 1))].x; }
  var ab = demod_line(y, k);
  if (pi(P_pal) == 1 && y > 0) { ab = 0.5 * (ab + demod_line(y - 1, k)); }
  let m = P_inv;
  sig[u32(y * N + k)] = vec4f(P[m] * Y + P[m + 1u] * ab.x + P[m + 2u] * ab.y,
    P[m + 3u] * Y + P[m + 4u] * ab.x + P[m + 5u] * ab.y, P[m + 6u] * Y + P[m + 7u] * ab.x + P[m + 8u] * ab.y, 0.0);
}`;
