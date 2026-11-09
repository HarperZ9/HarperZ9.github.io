// WGSL for curvature hatching (hatch.mjs), one pass: ray march, Hessian, principal directions, lines.
// P: 0 w, 1 h, 2 freq, 3 width, 4 layers, 5 umb, 6 contour, 7..9 ink, 10..12 paper.
import { STILL_SDF_WGSL, STILL } from "../fixtures/stilllife.mjs";

const v3 = (a) => `vec3f(${a.join(", ")})`;
export const HATCH_WGSL = STILL_SDF_WGSL + /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read_write> img: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> out8: array<u32>;
const E: f32 = 0.01;
const EYE: vec3f = ${v3(STILL.camera.eye)};
const TARGET: vec3f = ${v3(STILL.camera.target)};
const TANF: f32 = ${STILL.camera.tan};
const LIGHT: vec3f = ${v3(STILL.light)};
fn ax(i: i32) -> vec3f { if (i == 0) { return vec3f(1.0, 0.0, 0.0); } if (i == 1) { return vec3f(0.0, 1.0, 0.0); } return vec3f(0.0, 0.0, 1.0); }
struct Curv { n: vec3f, dir: vec3f, other: vec3f, umbilic: bool }
fn curvature(p: vec3f) -> Curv {
  let f0 = still_sdf(p);
  var g = vec3f(0.0);
  for (var i = 0; i < 3; i++) { g[i] = (still_sdf(p + ax(i) * E) - still_sdf(p - ax(i) * E)) / (2.0 * E); }
  let gl = length(g); let n = g / gl;
  var H: mat3x3f;
  for (var i = 0; i < 3; i++) { H[i][i] = (still_sdf(p + ax(i) * E) - 2.0 * f0 + still_sdf(p - ax(i) * E)) / (E * E); }
  for (var i = 0; i < 3; i++) { for (var j = i + 1; j < 3; j++) {
    let ei = ax(i) * E; let ej = ax(j) * E;
    let hij = (still_sdf(p + ei + ej) - still_sdf(p + ei - ej) - still_sdf(p - ei + ej) + still_sdf(p - ei - ej)) / (4.0 * E * E);
    H[i][j] = hij; H[j][i] = hij;
  } }
  var aux = vec3f(1.0, 0.0, 0.0); if (abs(n.y) < 0.9) { aux = vec3f(0.0, 1.0, 0.0); }
  let t1 = normalize(cross(n, aux)); let t2 = cross(n, t1);
  let a = dot(t1, H * t1) / gl; let b = dot(t1, H * t2) / gl; let d = dot(t2, H * t2) / gl;
  let m = 0.5 * (a + d); let r = sqrt(0.25 * (a - d) * (a - d) + b * b); let k1 = m + r; let k2 = m - r;
  var kmax = k2; if (abs(k1) >= abs(k2)) { kmax = k1; }
  var ex = b; var ey = kmax - a; if (abs(kmax - d) > abs(kmax - a)) { ex = kmax - d; ey = b; }
  let el = sqrt(ex * ex + ey * ey);
  let umb = r < P[5] * max(max(abs(k1), abs(k2)), 0.05) || el < 1e-12;
  var dir = t1; if (el > 0.0) { dir = normalize(t1 * (ex / el) + t2 * (ey / el)); }
  if (umb) { let up = vec3f(0.0, 1.0, 0.0) - n * n.y; if (length(up) > 1e-6) { dir = normalize(up); } else { dir = t1; } }
  return Curv(n, dir, cross(n, dir), umb);
}
fn line_cov(s: f32, freq: f32, half_w: f32, px: f32) -> f32 { let u = s * freq; let fr = u - floor(u); let dist = min(fr, 1.0 - fr) / freq; return clamp((half_w - dist) / px + 0.5, 0.0, 1.0) * min(1.0, (2.0 * half_w) / px); }
fn hatch_lines(s: f32, freq: f32, px: f32, half_w: f32) -> f32 {
  let lev = max(0.0, log2((px * freq) / 0.25)); let l0 = floor(lev); let t = lev - l0; let f0 = freq / exp2(l0);
  return line_cov(s, f0, half_w, px) * (1.0 - t) + line_cov(s, f0 / 2.0, half_w, px) * t;
}
fn coords(q: vec3f, cv: Curv) -> vec2f {
  let second = dot(q, vec3f(0.6246950475544243, 0.4685212856658182, -0.6246950475544243));
  if (!cv.umbilic) { return vec2f(dot(q, cv.other), second); }
  if (abs(cv.n.y) > 0.95) { return vec2f(dot(q, vec3f(0.9578262852211514, 0.0, 0.28734788556634544)), dot(q, vec3f(-0.28734788556634544, 0.0, 0.9578262852211514))); }
  return vec2f(q.y, second);
}
fn enc(v: f32) -> u32 { let c = clamp(v, 0.0, 1.0); var s = 1.055 * pow(c, 1.0 / 2.4) - 0.055; if (c <= 0.0031308) { s = c * 12.92; } return u32(floor(s * 255.0 + 0.5)); }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = i32(round(P[0])); let h = i32(round(P[1])); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let fwd = normalize(TARGET - EYE); let right = normalize(vec3f(-fwd.z, 0.0, fwd.x)); let up = cross(right, fwd);
  let sx = ((f32(x) + 0.5) / f32(w) - 0.5) * 2.0 * (f32(w) / f32(h)) * TANF; let sy = (0.5 - (f32(y) + 0.5) / f32(h)) * 2.0 * TANF;
  let rd = normalize(fwd + right * sx + up * sy);
  var t = 0.0; var hit = -1.0;
  for (var i = 0; i < 160; i++) { let d = still_sdf(EYE + rd * t); if (d < 1e-4 * (1.0 + t)) { hit = t; break; } t += d; if (t > 30.0) { break; } }
  let paper = vec3f(P[10], P[11], P[12]); var col = paper;
  if (hit > 0.0) {
    let q = EYE + rd * hit; let cv = curvature(q); let tone = 0.12 + 0.88 * max(0.0, dot(cv.n, normalize(LIGHT)));
    let px = (hit * 2.0 * TANF) / f32(h); let half_w = 0.5 * P[3] * px; let dark = 1.0 - tone;
    let st = coords(q, cv);
    var ink = hatch_lines(st.x, P[2], px, half_w * (0.4 + 1.6 * dark));
    if (P[4] > 1.5 && tone < 0.5) { ink = 1.0 - (1.0 - ink) * (1.0 - hatch_lines(st.y, P[2], px, half_w * (0.4 + 2.0 * (0.5 - tone)))); }
    if (P[6] > 0.0) { let nv = abs(dot(cv.n, rd)); if (nv < P[6]) { ink = max(ink, min(1.0, (P[6] - nv) / (0.5 * P[6]))); } }
    col = paper * (1.0 - ink) + vec3f(P[7], P[8], P[9]) * ink;
  }
  img[y * w + x] = vec4f(col, 1.0);
  out8[y * w + x] = enc(col.x) | (enc(col.y) << 8u) | (enc(col.z) << 16u) | (255u << 24u);
}
`;
