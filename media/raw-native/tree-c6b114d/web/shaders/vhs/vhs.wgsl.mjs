// WGSL for VHS (vhs.mjs): the tape pass, the playback pass (dropouts, R'G'B') and a display pass.
// V: 0 N, 1 lines, 2 srcW, 3 srcH, 4 frame, 5 seed, 6 jitter, 7 headSwitchLines, 8 headSkew,
// 9 tracking, 10 lumaNoise, 11 chromaNoise, 12 peaking, 13 delay, 14 phaseNoise, 15 dropouts x g,
// 16..18 tap half-widths [luma, peak, chroma] (taps packed in that order), 19 outW, 20 outH,
// 21..29 YIQ, 30..38 YIQ inverse.
export const VHS_HEAD = /* wgsl */ `
@group(0) @binding(0) var<storage, read> V: array<f32>;
fn vi(i: u32) -> i32 { return i32(round(V[i])); }
fn gauss3(a: u32, b: u32, c: u32) -> f32 { let u1 = max(1e-7, hash3(a, b, c)); let u2 = hash3(a, b, c + 7919u); return sqrt(-2.0 * log(u1)) * cos(6.283185307179586 * u2); }
fn tracking_band(y: i32, f: f32) -> f32 {
  let lines = V[1]; let c = ((f * 3.7) % (lines + 40.0)) - 20.0; let d = abs(f32(y) - c) / 6.0;
  return V[9] * max(0.0, 1.0 - d * d);
}
fn line_shift(y: i32, f: u32) -> f32 {
  let s = u32(V[5]); var d = V[6] * (0.6 * sin(f32(y) * 0.031 + f32(f) * 0.7 + f32(s)) + 0.4 * gauss3(u32(y), f, 11u + s));
  let fromBottom = vi(1u) - 1 - y; let hs = V[7];
  if (f32(fromBottom) < hs) { let t = (hs - f32(fromBottom)) / hs; d += V[8] * t * t; }
  if (V[9] > 0.0) { d += tracking_band(y, f32(f)) * 12.0 * gauss3(u32(y), f, 23u + s); }
  return d;
}
`;
export const SAMPLE_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> sm: array<vec4f>;
fn held(y: i32, k: i32) -> vec3f {
  let N = vi(0u); let kk = clamp(k, 0, N - 1); let sw = vi(2u);
  let x = clamp(i32(floor((f32(kk) + 0.5) * f32(sw) / f32(N))), 0, sw - 1); let c = src[y * sw + x].xyz;
  return vec3f(V[21] * c.x + V[22] * c.y + V[23] * c.z, V[24] * c.x + V[25] * c.y + V[26] * c.z, V[27] * c.x + V[28] * c.y + V[29] * c.z);
}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
  let N = vi(0u); let k = i32(id.x); let y = i32(id.y); if (k >= N || y >= vi(1u)) { return; }
  let kf = f32(k) - line_shift(y, u32(V[4])); let k0 = floor(kf); let t = kf - k0;
  sm[y * N + k] = vec4f(held(y, i32(k0)) * (1.0 - t) + held(y, i32(k0) + 1) * t, 0.0);
}`;
export const TAPE_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> taps: array<f32>;
@group(0) @binding(2) var<storage, read> sm: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> tp: array<vec4f>;
fn at(y: i32, k: f32) -> vec3f {
  let N = vi(0u); let kf = clamp(k, 0.0, f32(N - 1)); let k0 = i32(floor(kf)); let t = kf - f32(k0); let k1 = min(N - 1, k0 + 1);
  return sm[y * N + k0].xyz * (1.0 - t) + sm[y * N + k1].xyz * t;
}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
  let N = vi(0u); let k = i32(id.x); let y = i32(id.y); if (k >= N || y >= vi(1u)) { return; }
  let f = u32(V[4]); let s = u32(V[5]);
  let rot = V[14] * gauss3(u32(y), f, 31u + s); let cr = cos(rot); let sr = sin(rot);
  let lh = vi(16u); let ph = vi(17u); let ch = vi(18u); let po = 2 * lh + 1; let co = po + 2 * ph + 1;
  var Y = 0.0; for (var j = -lh; j <= lh; j++) { Y += taps[j + lh] * at(y, f32(k + j)).x; }
  var Yl = 0.0; for (var j = -ph; j <= ph; j++) { Yl += taps[po + j + ph] * at(y, f32(k + j)).x; }
  let gk = u32(y) * 4096u + u32(k);
  let n = V[10] * (gauss3(gk, f, 41u + s) - 0.5 * (gauss3(gk - 1u, f, 41u + s) + gauss3(gk + 1u, f, 41u + s)));
  let Yo = Y + V[12] * (Y - Yl) + n;
  let kd = f32(k) - V[13]; var I = 0.0; var Q = 0.0;
  for (var j = -ch; j <= ch; j++) { let v = at(y, kd + f32(j)); I += taps[co + j + ch] * v.y; Q += taps[co + j + ch] * v.z; }
  let m = f32(k) / 24.0; let m0 = floor(m); let t = m - m0; let mu = u32(m0);
  let cn0 = V[11] * ((1.0 - t) * gauss3(u32(y), mu, 53u + s) + t * gauss3(u32(y), mu + 1u, 53u + s));
  let cn1 = V[11] * ((1.0 - t) * gauss3(u32(y), mu, 54u + s) + t * gauss3(u32(y), mu + 1u, 54u + s));
  var tn = 0.0; if (V[9] > 0.0) { tn = tracking_band(y, f32(f)) * 0.5 * gauss3(gk, f, 61u + s); }
  tp[y * N + k] = vec4f(Yo + tn, I * cr - Q * sr + cn0, I * sr + Q * cr + cn1, 0.0);
}`;
export const PLAY_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> tp: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> sig: array<vec4f>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
  let N = vi(0u); let k = i32(id.x); let y = i32(id.y); if (k >= N || y >= vi(1u)) { return; }
  let f = u32(V[4]); let seg = u32(k / 64);
  let hit = hash3(u32(y), seg, f * 131u + 71u) < V[15]; let run = hash3(u32(y), seg, f * 131u + 73u) * 64.0;
  let drop = hit && f32(k - i32(seg) * 64) < run && y > 0; var yy = y; if (drop) { yy = y - 1; }
  let c = tp[yy * N + k];
  sig[y * N + k] = vec4f(V[30] * c.x + V[31] * c.y + V[32] * c.z, V[33] * c.x + V[34] * c.y + V[35] * c.z, V[36] * c.x + V[37] * c.y + V[38] * c.z, select(0.0, 1.0, drop));
}`;
export const SHOW_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> sig: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> out8: array<u32>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = vi(19u); let h = vi(20u); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let N = vi(0u); let lines = vi(1u); let ly = min(lines - 1, (y * lines) / h);
  let kf = (f32(x) + 0.5) * f32(N) / f32(w) - 0.5; let k0 = clamp(i32(floor(kf)), 0, N - 1); let k1 = min(N - 1, k0 + 1); let t = clamp(kf - f32(k0), 0.0, 1.0);
  let v = clamp(sig[ly * N + k0].xyz * (1.0 - t) + sig[ly * N + k1].xyz * t, vec3f(0.0), vec3f(1.0));
  let q = vec3u(floor(v * 255.0 + 0.5));
  out8[y * w + x] = q.x | (q.y << 8u) | (q.z << 16u) | (255u << 24u);
}`;
