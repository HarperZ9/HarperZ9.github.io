// The references the real-time image is measured against, accumulated while the camera holds still, and the
// passes that measure and show. All trace the engine's BVH with its own triangle test.
import { IDX } from "./rt-wgsl.mjs";

// Per pixel and frame, from a random point in the pixel through a pinhole: ray-traced AO within the same radius
// GTAO uses (cosine-weighted, as the engine's rtao pass and post.hpp's rayAo), and the traced mirror reflection,
// lit by the same model the real-time path uses. Sums: (ao, reflection rgb), and hits.
export const REF_PINHOLE = IDX + /* wgsl */ `
@group(1) @binding(0) var<storage, read_write> RA: array<vec4f>;
@group(1) @binding(1) var<storage, read_write> PA: array<vec4f>;   // w: how many samples hit a surface
fn litAt(s: Surf, d: vec3f, i: u32, fr: u32, dim: u32) -> vec3f {
  let m = matOf(s.m); let v = -d;
  let l = sunSample(rnd(i, fr, dim), rnd(i, fr, dim + 1u));
  let o = s.p + s.ng * 2e-3;
  let vis = select(1.0, 0.0, dot(s.n, l) <= 0.0 || bvhBlocked(o + s.n * 2e-3 + l * 6e-3, l, 1.0e30));
  var amb = (F.amb[0].rgb + F.amb[1].rgb + F.amb[2].rgb + F.amb[3].rgb + F.amb[4].rgb + F.amb[5].rgb) / 6.0;
  if (on(ON_SKY)) { amb = ambientCube(s.n); }
  let a = cosineDir(s.n, rnd(i, fr, dim + 2u), rnd(i, fr, dim + 3u));
  let ao = select(1.0, select(1.0, 0.0, bvhBlocked(o, a, F.lens.w)), on(ON_AO));
  return m.emit + sunLight(m, s.n, v, l, vis) + m.albedo * (1.0 - m.metal) / M_PI * amb * ao;
}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = pixelOf(gid); if (i >= npx()) { return; }
  if (F.size.w <= 1.5) { RA[i] = vec4f(0.0); }
  let w = u32(F.size.x); let fr = u32(F.size.z);
  let px = vec2f(f32(i % w) + rnd(i, fr, 100u), f32(i / w) + rnd(i, fr, 101u));
  let d = camRay(px);
  let h = closest(F.eye.xyz, d, 1.0e30);
  if (h.tri < 0) { return; }
  let s = surfAt(F.eye.xyz, d, h);
  let o = s.p + s.n * 1e-3;
  var open = 0.0;
  for (var k = 0u; k < 2u; k++) {
    let a = cosineDir(s.n, rnd(i, fr, 102u + 2u * k), rnd(i, fr, 103u + 2u * k));
    if (!bvhBlocked(o, a, F.lens.w)) { open += 0.5; }
  }
  var refl = vec3f(0.0);
  let m = matOf(s.m);
  if (lum(mirrorW(m, s.n, -d)) > 0.004) {
    let r = reflect(d, s.n); let ro = s.p + s.ng * 2e-3;
    let hr = closest(ro, r, 1.0e30);
    if (hr.tri < 0) { refl = skySeen(r, false); } else { refl = litAt(surfAt(ro, r, hr), r, i, fr, 110u); }
  }
  RA[i] += vec4f(open, refl); PA[i].w += 1.0;
}
`;

// The path-traced reference: every bounce, the sun by next-event estimation, the sky, emitted light, the mirror
// share of each surface, light in the air on the first segment, and the lens with its tilted plane of focus.
// Single paths brighter than 20 at the current exposure are clamped after the first bounce.
export const PATH = IDX + /* wgsl */ `
@group(1) @binding(0) var<storage, read_write> PA: array<vec4f>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = pixelOf(gid); if (i >= npx()) { return; }
  if (F.size.w <= 1.5) { PA[i] = vec4f(0.0); }
  let w = u32(F.size.x); let fr = u32(F.size.z);
  let px = vec2f(f32(i % w) + rnd(i, fr, 200u), f32(i / w) + rnd(i, fr, 201u));
  var d = camRay(px); var o = F.eye.xyz;
  if (F.tiltL.w > 0.5 && F.tiltL.x > 0.0) {
    let tf = -(dot(F.tiltN.xyz, o) + F.tiltN.w) / dot(F.tiltN.xyz, d);
    if (tf > 0.0 && tf < 1.0e6) {
      let pf = o + d * tf; let rr = F.tiltL.x * sqrt(rnd(i, fr, 202u)); let a = 2.0 * M_PI * rnd(i, fr, 203u);
      o = o + F.right.xyz * (rr * cos(a)) + F.up.xyz * (rr * sin(a)); d = normalize(pf - o);
    }
  }
  var thr = vec3f(1.0); var L = vec3f(0.0); let cap = 20.0 / max(F.sunE.w, 1e-12);
  for (var b = 0u; b < 5u; b++) {
    let h = closest(o, d, 1.0e30);
    if (b == 0u && F.fog.x > 0.0) {
      let tseg = select(airLength(o, d), min(h.t, 150.0), h.tri >= 0);
      let s = rnd(i, fr, 210u) * tseg; let q = o + d * s;
      let l = sunSample(rnd(i, fr, 211u), rnd(i, fr, 212u));
      let vis = select(1.0, 0.0, bvhBlocked(q, l, 1.0e30));
      L += thr * tseg * F.fog.x * exp(-F.fog.x * s) * (hg(dot(d, F.sunDir.xyz), F.fog.y) * F.sunE.rgb * vis + vec3f(F.fog.z));
      thr *= exp(-F.fog.x * tseg);
    }
    if (h.tri < 0) { L += thr * skySeen(d, b == 0u); break; }
    let s = surfAt(o, d, h); let m = matOf(s.m); let v = -d;
    var e = thr * m.emit;
    if (b > 0u) { e *= min(1.0, cap / max(lum(e), 1e-12)); }
    L += e;
    let so = s.p + s.ng * (2e-3 + 1e-4 * h.t);
    let l = sunSample(rnd(i, fr, 220u + 8u * b), rnd(i, fr, 221u + 8u * b));
    let vis = select(1.0, 0.0, dot(s.n, l) <= 0.0 || bvhBlocked(so + s.n * 2e-3 + l * 6e-3, l, 1.0e30));
    var sun = thr * sunLight(m, s.n, v, l, vis);
    if (b > 0u) { sun *= min(1.0, cap / max(lum(sun), 1e-12)); }
    L += sun;
    let wm = mirrorW(m, s.n, v); let wd = m.albedo * (1.0 - m.metal);
    let ps = clamp(lum(wm) / max(lum(wm) + lum(wd), 1e-6), 0.0, 1.0);
    if (rnd(i, fr, 222u + 8u * b) < ps) { d = reflect(d, s.n); thr *= wm / max(ps, 1e-6); }
    else { d = cosineDir(s.n, rnd(i, fr, 223u + 8u * b), rnd(i, fr, 224u + 8u * b)); thr *= wd / max(1.0 - ps, 1e-6); }
    o = so;
    if (b >= 2u) { let q = clamp(lum(thr), 0.05, 1.0); if (rnd(i, fr, 225u + 8u * b) > q) { break; } thr /= q; }
  }
  PA[i] += vec4f(L, 0.0);
}
`;

// Display values through the engine's colour pipeline (colour.wgsl's colour_apply), for showing and measuring.
const COLOUR_BIND = /* wgsl */ `
@group(2) @binding(0) var<uniform> cp: ColourParams;
@group(2) @binding(1) var<storage, read> cd: array<f32>;
`;

// Squared errors in display values, summed per workgroup: 0 GTAO vs traced AO, 1 no AO vs traced AO, 2 AO pixels,
// 3 SSR vs traced mirror, 4 sky probe vs traced mirror, 5 mirror pixels, 6 frame vs path reference, 7 pixels.
export const MEASURE = (colour) => IDX + COLOUR_BIND + colour + /* wgsl */ `
@group(1) @binding(0) var<storage, read> OUT: array<vec4f>;
@group(1) @binding(1) var<storage, read> PA: array<vec4f>;
@group(1) @binding(2) var<storage, read> RA: array<vec4f>;
@group(1) @binding(3) var<storage, read> ACC: array<vec4f>;
@group(1) @binding(4) var<storage, read> LR: array<vec4f>;
@group(1) @binding(5) var<storage, read> G: array<f32>;
@group(1) @binding(6) var<storage, read_write> PART: array<f32>;
var<workgroup> sh: array<array<f32, 8>, 64>;
fn disp(c: vec3f) -> vec3f { return colour_apply(max(c, vec3f(0.0))); }
fn e2(a: vec3f, b: vec3f) -> f32 { let d = a - b; return dot(d, d) / 3.0; }
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_index) li: u32, @builtin(workgroup_id) wg: vec3u, @builtin(num_workgroups) nw: vec3u) {
  let i = pixelOf(gid);
  var m: array<f32, 8>;
  for (var k = 0u; k < 8u; k++) { m[k] = 0.0; }
  if (i < npx()) {
    let nr = max(F.size.w, 1.0); let nt = max(F.jit.w, 1.0); let ex = F.sunE.w;
    let rf = disp(PA[i].rgb / nr * ex);
    m[6] = e2(disp(OUT[i].rgb), rf); m[7] = 1.0;
    if (G[i * 8u + 3u] >= 0.0 && PA[i].w >= nr - 0.5) {
      let aoRef = RA[i].x / nr; let aoRt = ACC[2u * i].x / nt;
      m[0] = (aoRt - aoRef) * (aoRt - aoRef); m[1] = (1.0 - aoRef) * (1.0 - aoRef); m[2] = 1.0;
      if (lum(LR[2u * i + 1u].rgb) > 0.02) {
        let rr = disp(RA[i].yzw / nr * ex);
        m[3] = e2(disp(ACC[2u * i].yzw / nt * ex), rr); m[4] = e2(disp(ACC[2u * i + 1u].xyz / nt * ex), rr); m[5] = 1.0;
      }
    }
  }
  for (var k = 0u; k < 8u; k++) { sh[li][k] = m[k]; }
  workgroupBarrier();
  for (var s = 32u; s > 0u; s >>= 1u) {
    if (li < s) { for (var k = 0u; k < 8u; k++) { sh[li][k] += sh[li + s][k]; } }
    workgroupBarrier();
  }
  if (li == 0u) { let o = (wg.x + wg.y * nw.x) * 8u; for (var k = 0u; k < 8u; k++) { PART[o + k] = sh[0][k]; } }
}
`;

export const REDUCE = /* wgsl */ `
@group(0) @binding(0) var<storage, read> PART: array<f32>;
@group(0) @binding(1) var<storage, read_write> SUM: array<f32>;
var<workgroup> sh: array<array<f32, 8>, 256>;
@compute @workgroup_size(256) fn main(@builtin(local_invocation_index) li: u32) {
  let n = arrayLength(&PART) / 8u;
  var m: array<f32, 8>;
  for (var k = 0u; k < 8u; k++) { m[k] = 0.0; }
  for (var j = li; j < n; j += 256u) { for (var k = 0u; k < 8u; k++) { m[k] += PART[j * 8u + k]; } }
  for (var k = 0u; k < 8u; k++) { sh[li][k] = m[k]; }
  workgroupBarrier();
  for (var s = 128u; s > 0u; s >>= 1u) {
    if (li < s) { for (var k = 0u; k < 8u; k++) { sh[li][k] += sh[li + s][k]; } }
    workgroupBarrier();
  }
  if (li == 0u) { for (var k = 0u; k < 8u; k++) { SUM[k] = sh[0][k]; } }
}
`;

// What goes on the canvas: 0 real time, 1 real time beside the reference, 2 the reference, 3 the error,
// 4 GTAO beside traced AO, 5 SSR beside the traced mirror.
export const PRESENT = (colour) => COLOUR_BIND + colour + /* wgsl */ `
@group(1) @binding(0) var<storage, read> OUT: array<vec4f>;
@group(1) @binding(1) var<storage, read> PA: array<vec4f>;
@group(1) @binding(2) var<storage, read> RA: array<vec4f>;
@group(1) @binding(3) var<storage, read> ACC: array<vec4f>;
@group(1) @binding(4) var<storage, read> AO: array<f32>;
@group(1) @binding(5) var<storage, read> LR: array<vec4f>;
@vertex fn vs(@builtin(vertex_index) k: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((k << 1u) & 2u), f32(k & 2u)); return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
fn disp(c: vec3f) -> vec3f { return colour_apply(max(c, vec3f(0.0))); }
fn heat(e: f32) -> vec3f {
  let t = clamp(e / 0.25, 0.0, 1.0);
  return mix(mix(vec3f(0.02, 0.02, 0.06), vec3f(0.55, 0.12, 0.45), clamp(t * 2.0, 0.0, 1.0)), vec3f(1.0, 0.86, 0.45), clamp(t * 2.0 - 1.0, 0.0, 1.0));
}
@fragment fn fs(@builtin(position) q: vec4f) -> @location(0) vec4f {
  let w = u32(F.size.x); let x = min(u32(q.x), w - 1u); let y = min(u32(q.y), u32(F.size.y) - 1u); let i = y * w + x;
  let nr = max(F.size.w, 1.0); let nt = max(F.jit.w, 1.0); let ex = F.sunE.w;
  let right = q.x >= F.size.x * f32(F.flags.z) / 10000.0;
  let mode = F.flags.y;
  let rt = disp(OUT[i].rgb);
  var rf = disp(PA[i].rgb / nr * ex);
  if (F.size.w < 0.5) { rf = rt * 0.3; }
  var c = rt;
  if (mode == 1u) { c = select(rt, rf, right); }
  else if (mode == 2u) { c = rf; }
  else if (mode == 3u) { let d = abs(rt - rf); c = heat((d.x + d.y + d.z) / 3.0); }
  else if (mode == 4u) { let a = select(AO[i], RA[i].x / nr, right); c = vec3f(a); }
  else if (mode == 5u) {
    let wgt = select(0.0, 1.0, lum(LR[2u * i + 1u].rgb) > 0.02);
    let s = select(ACC[2u * i].yzw / nt, RA[i].yzw / nr, right);
    c = select(rt * 0.25, disp(s * ex), wgt > 0.5);
  }
  if (mode == 1u || mode == 4u || mode == 5u) {
    if (abs(q.x - F.size.x * f32(F.flags.z) / 10000.0) < 1.0) { c = vec3f(0.92, 0.89, 0.82); }
  }
  return vec4f(c, 1.0);
}
`;
