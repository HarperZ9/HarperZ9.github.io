// WGSL for the explainer kit. COMMON holds the functions ref.mjs defines in double precision;
// the render passes and the parity kernel both include it, so the kernel tests the code the
// passes run. Original code, written for raw-native.

export const COMMON = /* wgsl */ `
const TAU: f32 = 6.283185307179586;
fn hash32(x0: u32) -> u32 {
  var x = x0;
  x = x ^ (x >> 16u); x = x * 0x7feb352du;
  x = x ^ (x >> 15u); x = x * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return x;
}
fn hash_unit(x: u32) -> f32 { return f32(hash32(x) >> 8u) / 16777216.0; }
fn lod_keep(id: u32, keep: f32) -> bool { return hash_unit(id) < keep; }
fn sstep(a: f32, b: f32, x: f32) -> f32 { let t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
// A four-stop ramp: positions in xs, colours in c0..c3.
fn ramp4(xs: vec4f, c0: vec3f, c1: vec3f, c2: vec3f, c3: vec3f, x: f32) -> vec3f {
  if (x <= xs.x) { return c0; }
  if (x <= xs.y) { return mix(c0, c1, (x - xs.x) / max(1e-6, xs.y - xs.x)); }
  if (x <= xs.z) { return mix(c1, c2, (x - xs.y) / max(1e-6, xs.z - xs.y)); }
  if (x <= xs.w) { return mix(c2, c3, (x - xs.z) / max(1e-6, xs.w - xs.z)); }
  return c3;
}
// cos on |x| <= pi / 3 by its Taylor series to x^14 (error below 1e-9 there). WGSL lets cos be
// off by 2^-11 absolute, which moves a thin iris ring visibly; this keeps the edge exact to f32.
fn cos_near(x: f32) -> f32 {
  let y = x * x;
  return 1.0 + y * (-0.5 + y * (4.16666667e-2 + y * (-1.38888889e-3 + y * (2.48015873e-5 + y * (-2.75573192e-7 + y * (2.08767570e-9 + y * -1.14707456e-11))))));
}
fn aperture_edge(theta: f32, blades: f32, open: f32, rot: f32) -> f32 {
  if (blades < 3.0) { return open; }
  let seg = TAU / blades;
  let x = theta - rot;
  let a = x - seg * floor(x / seg);
  let h = 3.141592653589793 / blades;
  return open * cos_near(h) / cos_near(a - h);
}
// sin on |x| <= pi / 4, Taylor to x^13.
fn sin_near(x: f32) -> f32 {
  let y = x * x;
  return x * (1.0 + y * (-1.66666667e-1 + y * (8.33333333e-3 + y * (-1.98412698e-4 + y * (2.75573192e-6 + y * (-2.50521084e-8 + y * 1.60590438e-10))))));
}
// cos(2 pi x) for any x: reduce to one turn, then to an octant, then a polynomial.
fn cos_turns(x: f32) -> f32 {
  let f = x - floor(x);                 // 0..1 turns
  let q = floor(f * 8.0);               // octant 0..7
  let a = (f - (q + 0.5) / 8.0) * TAU;   // |a| <= pi / 8 around the octant's centre
  // cos and sin at the octant centres (q + 0.5) * pi / 4, as constants (no builtin trig).
  let C = array<f32, 8>(0.9238795325, 0.3826834324, -0.3826834324, -0.9238795325, -0.9238795325, -0.3826834324, 0.3826834324, 0.9238795325);
  let S = array<f32, 8>(0.3826834324, 0.9238795325, 0.9238795325, 0.3826834324, -0.3826834324, -0.9238795325, -0.9238795325, -0.3826834324);
  let k = min(u32(q), 7u);
  return C[k] * cos_near(a) - S[k] * sin_near(a);
}
struct OrbSpec { core: vec4f, mid: vec4f, rim: vec4f, p1: vec4f, p2: vec4f, p3: vec4f, p4: vec4f, }
// p1: soft, coreGain, coreR, haloGain   p2: haloR, ring, ringW, blades   p3: open, rot, gain, unused
// p4: spokes, spokeGain, spokeSharp, prism
fn orb_at(r: f32, theta: f32, s: OrbSpec) -> vec3f {
  let edge = aperture_edge(theta, s.p2.w, s.p3.x, s.p3.y);
  let soft = s.p1.x;
  let m = 1.0 - sstep(edge - soft * 0.25, edge + soft * 0.25, r);
  let body = (1.0 - sstep(1.0 - soft, 1.0 + soft, r)) * m;
  var tint = mix(s.mid.rgb, s.rim.rgb, clamp((r - 0.5) / 0.5, 0.0, 1.0));
  if (r < 0.5) { tint = mix(s.core.rgb, s.mid.rgb, r / 0.5); }
  let rc = r / s.p1.z;
  let hot = s.p1.y * exp(-(rc * rc)) * m;
  let rh = r / s.p2.x;
  let halo = s.p1.w / (1.0 + rh * rh);
  var spoke = 0.0;
  if (s.p4.x > 0.0) {
    let c = 0.5 + 0.5 * cos_turns(s.p4.x * theta / TAU);
    let fr = (r - edge) / 0.35;
    spoke = s.p4.y * pow(c, s.p4.z) * sstep(edge * 0.9, edge * 1.05, r) / (1.0 + fr * fr);
  }
  let e = edge * (vec3f(1.0) + s.p4.w * vec3f(-1.0, 0.0, 1.0));
  let d = (vec3f(r) - e) / s.p2.z;
  let rl = s.p2.y * exp(-(d * d));
  return s.p3.z * (tint * body + s.core.rgb * hot + s.rim.rgb * halo + s.core.rgb * spoke + rl);
}
fn value_noise(x: f32, y: f32, seed: u32) -> f32 {
  let xi = floor(x); let yi = floor(y);
  let fx = x - xi; let fy = y - yi;
  let i = bitcast<u32>(i32(xi)); let j = bitcast<u32>(i32(yi));
  let a = hash_unit((i * 73856093u) ^ (j * 19349663u) ^ seed);
  let b = hash_unit(((i + 1u) * 73856093u) ^ (j * 19349663u) ^ seed);
  let c = hash_unit((i * 73856093u) ^ ((j + 1u) * 19349663u) ^ seed);
  let d = hash_unit(((i + 1u) * 73856093u) ^ ((j + 1u) * 19349663u) ^ seed);
  let ux = fx * fx * fx * (fx * (fx * 6.0 - 15.0) + 10.0);
  let uy = fy * fy * fy * (fy * (fy * 6.0 - 15.0) + 10.0);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
struct AtmosSpec { xs: vec4f, c0: vec4f, c1: vec4f, c2: vec4f, c3: vec4f, band: vec4f, look: vec4f, }
// band: v, width, unused, unused (colour in c*.w is not used; the band colour is bandC)
// look: aspect, drift, grain, seed
fn atmos_at(u: f32, v: f32, t: f32, s: AtmosSpec, bandC: vec3f) -> vec3f {
  let base = ramp4(s.xs, s.c0.rgb, s.c1.rgb, s.c2.rgb, s.c3.rgb, v);
  let bv = (v - s.band.x) / s.band.y;
  let band = exp(-(bv * bv));
  let seed = u32(s.look.w);
  let n1 = value_noise(u * 3.0 * s.look.x + t * s.look.y, v * 3.0, seed);
  let n2 = value_noise(u * 7.0 * s.look.x - t * s.look.y * 1.7, v * 7.0, seed + 1u);
  let n = (n1 * 0.65 + n2 * 0.35) * 2.0 - 1.0;
  return (base + bandC * band) * (1.0 + s.look.z * n);
}
fn bezier(c01: vec4f, c23: vec4f, u: f32) -> vec2f {
  let v = 1.0 - u;
  return v * v * v * c01.xy + 3.0 * v * v * u * c01.zw + 3.0 * v * u * u * c23.xy + u * u * u * c23.zw;
}
fn pulse_at(u: f32, phase: f32, width: f32) -> f32 { let d = (u - phase) / width; return exp(-(d * d)); }
`;

// Full-frame fields: the atmosphere and the orb, drawn into Motion's linear HDR target.
export const FIELD_WGSL = COMMON + /* wgsl */ `
struct View { size: vec2f, inv: vec2f, time: f32, frame: f32, pad: vec2f, }
struct Field { orb: OrbSpec, atmos: AtmosSpec, bandC: vec4f, place: vec4f, misc: vec4f, }   // 68 floats
// place: orb centre x, y (px), orb radius (px), opacity     misc: time, unused...
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<uniform> F: Field;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
@fragment fn fs_orb(@builtin(position) q: vec4f) -> @location(0) vec4f {
  _ = V.inv;   // both entry points share one bind group layout
  let d = (q.xy - F.place.xy) / F.place.z;
  let c = orb_at(length(d), atan2(d.y, d.x), F.orb) * F.place.w;
  return vec4f(c, 0.0);
}
@fragment fn fs_atmos(@builtin(position) q: vec4f) -> @location(0) vec4f {
  let uv = q.xy * V.inv;
  let c = atmos_at(uv.x, uv.y, F.misc.x, F.atmos, F.bandC.rgb);
  return vec4f(c * F.place.w, F.place.w);
}`;

// Point clouds: one instanced quad per point, LOD by the integer hash, colour by a ramp.
export const POINTS_WGSL = COMMON + /* wgsl */ `
struct View { size: vec2f, inv: vec2f, time: f32, frame: f32, pad: vec2f, }
struct PU { cam: vec4f, lod: vec4f, val: vec4f, xs: vec4f, c0: vec4f, c1: vec4f, c2: vec4f, c3: vec4f, }
// cam: k, ox, oy, radius px   lod: keep, gain, count, sel   val: vmin, vmax, opacity, selGain
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<uniform> U: PU;
@group(0) @binding(2) var<storage, read> pts: array<vec4f>;
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f, @location(2) r: f32, }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> VO {
  var o: VO;
  // lod.w < 0 means no selection (a negative float converts to u32 0, which would select point 0).
  let q = pts[i];
  let id = u32(q.w);   // points are stored sorted by hash_unit(id); the id rides in w
  let sel = U.lod.w >= 0.0 && id == u32(U.lod.w);
  if (!lod_keep(id, U.lod.x) && !sel) { o.p = vec4f(2.0, 2.0, 0.0, 1.0); return o; }
  var r = U.cam.w;
  if (sel) { r = max(6.0, r * 4.0); }
  let rr = max(r, 0.75);
  let c = vec2f(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  let px = q.xy * U.cam.x + U.cam.yz + c * (rr + 1.0);
  o.p = vec4f(px.x * V.inv.x * 2.0 - 1.0, 1.0 - px.y * V.inv.y * 2.0, 0.0, 1.0);
  o.uv = c * (rr + 1.0);
  let x = clamp((q.z - U.val.x) / max(1e-6, U.val.y - U.val.x), 0.0, 1.0);
  var col = ramp4(U.xs, U.c0.rgb, U.c1.rgb, U.c2.rgb, U.c3.rgb, x) * U.lod.y * U.val.z * min(1.0, (r * r) / (rr * rr));
  if (sel) { col = vec3f(U.val.w); }
  o.col = vec4f(col, 1.0);
  o.r = rr;
  return o;
}
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let k = clamp(0.5 + (o.r - length(o.uv)), 0.0, 1.0);
  if (k <= 0.0) { discard; }
  return vec4f(o.col.rgb * k, 0.0);
}`;

// Flow along connections: S sprites per curve, a base glow scaled by the curve's weight and a
// pulse that travels from start to end. Draw-on: samples past U.look.y are not drawn.
export const FLOW_WGSL = COMMON + /* wgsl */ `
struct View { size: vec2f, inv: vec2f, time: f32, frame: f32, pad: vec2f, }
struct FU { cam: vec4f, look: vec4f, cold: vec4f, hot: vec4f, }
// cam: k, ox, oy, width px   look: samples, reveal, phase, pulse width   cold.w: base   hot.w: opacity
struct Curve { c01: vec4f, c23: vec4f, w: vec4f, }   // w: weight, phase offset, unused, unused
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<uniform> U: FU;
@group(0) @binding(2) var<storage, read> curves: array<Curve>;
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f, @location(2) r: f32, }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> VO {
  var o: VO;
  let S = u32(U.look.x);
  let cv = curves[i / S];
  let u = f32(i % S) / f32(S - 1u);
  if (u > U.look.y || cv.w.x <= 0.0) { o.p = vec4f(2.0, 2.0, 0.0, 1.0); return o; }
  let pos = bezier(cv.c01, cv.c23, u) * U.cam.x + U.cam.yz;
  let ph = fract(U.look.z + cv.w.y);
  let pl = pulse_at(u, ph, U.look.w);
  let r = max(0.75, U.cam.w * (0.55 + 0.45 * cv.w.x));
  let c = vec2f(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  let px = pos + c * (r + 1.0);
  o.p = vec4f(px.x * V.inv.x * 2.0 - 1.0, 1.0 - px.y * V.inv.y * 2.0, 0.0, 1.0);
  o.uv = c * (r + 1.0);
  let b = cv.w.x * (U.cold.w + pl);
  o.col = vec4f(mix(U.cold.rgb, U.hot.rgb, pl) * b * U.hot.w, 1.0);
  o.r = r;
  return o;
}
@fragment fn fs(o: VO) -> @location(0) vec4f {
  let d = length(o.uv) / o.r;
  let k = exp(-3.0 * d * d) * clamp(1.5 - d, 0.0, 1.0);
  if (k <= 0.001) { discard; }
  return vec4f(o.col.rgb * k, 0.0);
}`;

// The parity kernel: evaluates the COMMON functions on rows of inputs, f32, for comparison with
// ref.mjs. mode 0: orb(r, theta); 1: atmosphere(u, v, t); 2: bezier(u) and pulse(u, phase, w);
// 3: hash_unit(id) and lod_keep(id, keep).
export const PARITY_WGSL = COMMON + /* wgsl */ `
struct PK { orb: OrbSpec, atmos: AtmosSpec, bandC: vec4f, c01: vec4f, c23: vec4f, mode: vec4f, }
@group(0) @binding(0) var<uniform> K: PK;
@group(0) @binding(1) var<storage, read> inp: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> outp: array<vec4f>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= arrayLength(&inp)) { return; }
  let a = inp[g.x];
  let m = u32(K.mode.x);
  var o = vec4f(0.0);
  if (m == 0u) { o = vec4f(orb_at(a.x, a.y, K.orb), 0.0); }
  else if (m == 1u) { o = vec4f(atmos_at(a.x, a.y, a.z, K.atmos, K.bandC.rgb), 0.0); }
  else if (m == 2u) { o = vec4f(bezier(K.c01, K.c23, a.x), pulse_at(a.x, a.y, a.z), 0.0); }
  else { let id = bitcast<u32>(a.x); var keep = 0.0; if (lod_keep(id, a.y)) { keep = 1.0; } o = vec4f(hash_unit(id), keep, 0.0, 0.0); }
  outp[g.x] = o;
}`;
