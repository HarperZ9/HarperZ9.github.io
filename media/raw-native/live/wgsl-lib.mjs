// WGSL shared by the page's own passes: the frame's uniform, the scene's buffers, the sky, the material model,
// random numbers and a closest-hit walk of the engine's BVH layout. The engine's own functions (its watertight
// triangle test and any-hit walk, its hash) are spliced in from engine.mjs, unchanged.

// Float offsets in the frame uniform; gpu.mjs writes it, every pass reads it as `F`.
export const FRAME_FLOATS = 160;
export const FRAME_WGSL = /* wgsl */ `
struct Frame {
  view: mat4x4f, proj: mat4x4f, invView: mat4x4f, prevVP: mat4x4f,
  eye: vec4f,      // xyz camera position
  sunDir: vec4f,   // xyz unit vector towards the sun, w cos of the disk's radius
  sunE: vec4f,     // rgb the sun's illuminance (lux), w exposure
  size: vec4f,     // w, h, frame number, reference samples so far
  lens: vec4f,     // tan(fovy / 2), aspect, near, AO radius (m)
  jit: vec4f,      // TAA jitter x, y (pixels), random seed, real-time samples so far
  fog: vec4f,      // extinction (1/m), phase g, ambient in-scatter (nits), march steps
  tiltN: vec4f,    // the plane of focus: unit normal xyz, offset w (n.x + w = 0)
  tiltL: vec4f,    // lens radius (m), pixels per unit tan, largest blur radius (px), lens on
  sky: array<vec4f, 5>,   // Preetham: Perez Y, x, y coefficients, ground albedo, the scaled zenith Y, x, y
  amb: array<vec4f, 6>,   // ambient cube: sky irradiance (lux) on +x -x +y -y +z -z
  flags: vec4u,    // x passes on (bits), y view, z split position (0..10000), w scene bits
  right: vec4f, up: vec4f, fwd: vec4f,
}
const ON_AO: u32 = 1u; const ON_SSR: u32 = 2u; const ON_TAA: u32 = 4u; const ON_SKY: u32 = 8u; const ON_FOG: u32 = 16u; const ON_TILT: u32 = 32u;
const M_PI: f32 = 3.14159265358979;
fn on(bit: u32) -> bool { return (F.flags.x & bit) != 0u; }
fn lum(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
`;

// group 0 of every page pass: the frame and the scene
export const SCENE_BINDINGS = /* wgsl */ `
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var<storage, read> nodes: array<f32>;
@group(0) @binding(2) var<storage, read> btris: array<f32>;
@group(0) @binding(3) var<storage, read> attr: array<f32>;   // per tree triangle: 3 normals, material
@group(0) @binding(4) var<storage, read> mats: array<f32>;   // per material: albedo, roughness, emitted, metallic
`;

export const LIB_WGSL = /* wgsl */ `
// The engine's walk falls back to a scan when its stack would overflow; this is that scan over the tree's copy.
fn scanBlocked(o: vec3f, d: vec3f, maxDist: f32) -> bool {
  let n: u32 = arrayLength(&btris) / 9u;
  for (var t: u32 = 0u; t < n; t++) { if (bhit(o, d, t, maxDist)) { return true; } }
  return false;
}
// PCG hash: a random number in [0, 1) for a pixel, a frame and a dimension
fn pcg(v: u32) -> u32 { let s = v * 747796405u + 2891336453u; let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
fn rnd(i: u32, frame: u32, dim: u32) -> f32 { return f32(pcg(pcg(i ^ pcg(frame + 0x9e3779b9u)) + dim * 0x85ebca6bu) >> 8u) / 16777216.0; }

struct Hit { t: f32, u: f32, v: f32, tri: i32 }
// closest hit through the tree, nearer child first; the triangle test is the engine's wt_hit
fn closest(o: vec3f, d: vec3f, tmax: f32) -> Hit {
  var h: Hit; h.t = tmax; h.u = 0.0; h.v = 0.0; h.tri = -1;
  let iv = vec3f(invDir(d.x), invDir(d.y), invDir(d.z));
  var stack: array<u32, 64>; var sp: u32 = 1u; stack[0] = 0u;
  loop {
    if (sp == 0u) { break; }
    sp -= 1u;
    let n = stack[sp] * 8u;
    let a = (vec3f(nodes[n], nodes[n + 1u], nodes[n + 2u]) - o) * iv;
    let b = (vec3f(nodes[n + 4u], nodes[n + 5u], nodes[n + 6u]) - o) * iv;
    let t0 = max(max(max(0.0, min(a.x, b.x)), min(a.y, b.y)), min(a.z, b.z));
    let t1 = min(min(min(h.t, max(a.x, b.x)), max(a.y, b.y)), max(a.z, b.z));
    if (!(t0 <= t1)) { continue; }
    let first = u32(nodes[n + 3u]); let count = u32(nodes[n + 7u]);
    if (count > 0u) {
      for (var k: u32 = 0u; k < count; k++) {
        let r = wt_hit(o, d, bvert(first + k, 0u), bvert(first + k, 1u), bvert(first + k, 2u));
        if (r.w > 0.0 && r.x < h.t) { h.t = r.x; h.u = r.y; h.v = r.z; h.tri = i32(first + k); }
      }
      continue;
    }
    if (sp + 2u > 64u) { continue; }
    // visit the nearer child first: push it last
    let c0 = first * 8u; let c1 = (first + 1u) * 8u;
    let m0 = (vec3f(nodes[c0], nodes[c0 + 1u], nodes[c0 + 2u]) + vec3f(nodes[c0 + 4u], nodes[c0 + 5u], nodes[c0 + 6u])) * 0.5;
    let m1 = (vec3f(nodes[c1], nodes[c1 + 1u], nodes[c1 + 2u]) + vec3f(nodes[c1 + 4u], nodes[c1 + 5u], nodes[c1 + 6u])) * 0.5;
    if (dot(m0 - o, d) < dot(m1 - o, d)) { stack[sp] = first + 1u; stack[sp + 1u] = first; }
    else { stack[sp] = first; stack[sp + 1u] = first + 1u; }
    sp += 2u;
  }
  return h;
}
// how far a ray stays inside the scene's bounds (the tree's root box), at most 150 m: the air ends there
fn airLength(o: vec3f, d: vec3f) -> f32 {
  let iv = vec3f(invDir(d.x), invDir(d.y), invDir(d.z));
  let a = (vec3f(nodes[0], nodes[1], nodes[2]) - o) * iv; let b = (vec3f(nodes[4], nodes[5], nodes[6]) - o) * iv;
  let t1 = min(min(max(a.x, b.x), max(a.y, b.y)), max(a.z, b.z));
  return clamp(t1, 0.0, 150.0);
}
struct Surf { p: vec3f, n: vec3f, ng: vec3f, m: u32 }
fn surfAt(o: vec3f, d: vec3f, h: Hit) -> Surf {
  var s: Surf;
  let t = u32(h.tri);
  let a = bvert(t, 0u); let b = bvert(t, 1u); let c = bvert(t, 2u);
  s.p = o + d * h.t;
  var ng = normalize(cross(b - a, c - a));
  let k = t * 10u; let w = 1.0 - h.u - h.v;
  var n = w * vec3f(attr[k], attr[k + 1u], attr[k + 2u]) + h.u * vec3f(attr[k + 3u], attr[k + 4u], attr[k + 5u]) + h.v * vec3f(attr[k + 6u], attr[k + 7u], attr[k + 8u]);
  n = normalize(n);
  if (dot(ng, d) > 0.0) { ng = -ng; }
  if (dot(n, ng) < 0.0) { n = -n; }
  s.n = n; s.ng = ng; s.m = u32(attr[k + 9u]);
  return s;
}

struct Mat { albedo: vec3f, rough: f32, emit: vec3f, metal: f32 }
fn matOf(m: u32) -> Mat {
  let k = m * 8u; var r: Mat;
  r.albedo = vec3f(mats[k], mats[k + 1u], mats[k + 2u]); r.rough = mats[k + 3u];
  r.emit = vec3f(mats[k + 4u], mats[k + 5u], mats[k + 6u]); r.metal = mats[k + 7u];
  return r;
}
fn f0Of(m: Mat) -> vec3f { return mix(vec3f(0.04), m.albedo, m.metal); }
fn schlick(f0: vec3f, c: f32) -> vec3f { let k = pow(1.0 - clamp(c, 0.0, 1.0), 5.0); return f0 + (vec3f(1.0) - f0) * k; }
// the mirror share of a surface's reflection: Fresnel times gloss, (1 - roughness)^2
fn mirrorW(m: Mat, n: vec3f, v: vec3f) -> vec3f { let g = (1.0 - m.rough) * (1.0 - m.rough); return schlick(f0Of(m), dot(n, v)) * g; }
// the sun on a surface: Lambert plus a GGX highlight, by the illuminance; vis is 1 when the sun is seen
fn sunLight(m: Mat, n: vec3f, v: vec3f, l: vec3f, vis: f32) -> vec3f {
  let ndl = dot(n, l);
  if (ndl <= 0.0 || vis <= 0.0) { return vec3f(0.0); }
  let hh = normalize(l + v); let ndh = max(dot(n, hh), 0.0); let ndv = max(dot(n, v), 1e-4);
  let a = max(m.rough * m.rough, 0.0025); let a2 = a * a;
  let dd = ndh * ndh * (a2 - 1.0) + 1.0; let D = a2 / (M_PI * dd * dd);
  let k = a * 0.5; let G = ndl / (ndl * (1.0 - k) + k) * ndv / (ndv * (1.0 - k) + k);
  let Fs = schlick(f0Of(m), dot(hh, v));
  let spec = D * G * Fs / (4.0 * ndl * ndv) * (1.0 - (1.0 - m.rough) * (1.0 - m.rough));
  let diff = m.albedo * (1.0 - m.metal) / M_PI;
  return (diff + spec) * F.sunE.rgb * ndl * vis;
}
// the ambient cube: the sky's irradiance on a surface facing n
fn ambientCube(n: vec3f) -> vec3f {
  let q = n * n;
  let x = select(F.amb[1].rgb, F.amb[0].rgb, n.x >= 0.0);
  let y = select(F.amb[3].rgb, F.amb[2].rgb, n.y >= 0.0);
  let z = select(F.amb[5].rgb, F.amb[4].rgb, n.z >= 0.0);
  return q.x * x + q.y * y + q.z * z;
}

// Preetham, Shirley and Smits 1999, as the engine's sky.cpp writes it (coefficients from the host)
fn perez(a: f32, b: f32, c: f32, d: f32, e: f32, ct: f32, g: f32) -> f32 {
  let cg = cos(g);
  return (1.0 + a * exp(b / max(ct, 0.01))) * (1.0 + c * exp(d * g) + e * cg * cg);
}
fn skyClear(d0: vec3f) -> vec3f {
  var d = normalize(d0); var ground = 1.0;
  if (d.y < 0.0) { let h = vec2f(d.x, d.z); let l = length(h); d = select(vec3f(1.0, 0.01, 0.0), normalize(vec3f(h.x / max(l, 1e-9), 0.01, h.y / max(l, 1e-9))), l > 1e-9); ground = F.sky[3].w; }
  let g = acos(clamp(dot(d, F.sunDir.xyz), -1.0, 1.0));
  let s0 = F.sky[0]; let s1 = F.sky[1]; let s2 = F.sky[2]; let s3 = F.sky[3]; let z = F.sky[4];
  let Y = z.x * perez(s0.x, s0.y, s0.z, s0.w, s1.x, d.y, g);
  let x = z.y * perez(s1.y, s1.z, s1.w, s2.x, s2.y, d.y, g);
  let y = z.z * perez(s2.z, s2.w, s3.x, s3.y, s3.z, d.y, g);
  let X = x / y * Y; let Z = (1.0 - x - y) / y * Y;
  let rgb = vec3f(3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z);
  return max(rgb, vec3f(0.0)) * ground;
}
// what a ray sees when it leaves the scene; withSun adds the disk (camera and mirror rays only)
fn skySeen(d: vec3f, withSun: bool) -> vec3f {
  var c = skyClear(d);
  if (withSun && dot(normalize(d), F.sunDir.xyz) > F.sunDir.w) { c += F.sunE.rgb / (2.0 * M_PI * (1.0 - F.sunDir.w)); }
  return c;
}
// a direction in the sun's disk
fn sunSample(u1: f32, u2: f32) -> vec3f {
  let ct = 1.0 - u1 * (1.0 - F.sunDir.w); let st = sqrt(max(0.0, 1.0 - ct * ct)); let ph = 2.0 * M_PI * u2;
  let w = F.sunDir.xyz; let a = select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), abs(w.x) > 0.9);
  let t = normalize(cross(a, w)); let b = cross(w, t);
  return normalize(t * (st * cos(ph)) + b * (st * sin(ph)) + w * ct);
}
fn cosineDir(n: vec3f, u1: f32, u2: f32) -> vec3f {
  let r = sqrt(u1); let ph = 2.0 * M_PI * u2;
  let a = select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), abs(n.x) > 0.9);
  let t = normalize(cross(a, n)); let b = cross(n, t);
  return normalize(t * (r * cos(ph)) + b * (r * sin(ph)) + n * sqrt(max(0.0, 1.0 - u1)));
}
fn hg(c: f32, g: f32) -> f32 { let d = 1.0 + g * g - 2.0 * g * c; return (1.0 - g * g) / (4.0 * M_PI * d * sqrt(d)); }
// the camera ray through a point on the screen (pixels, y down), world space, no jitter added here
fn camRay(px: vec2f) -> vec3f {
  let ndc = vec2f(px.x / F.size.x * 2.0 - 1.0, 1.0 - px.y / F.size.y * 2.0);
  return normalize(F.fwd.xyz + F.right.xyz * (ndc.x * F.lens.x * F.lens.y) + F.up.xyz * (ndc.y * F.lens.x));
}
`;

// a pass of the page: the frame, the scene bindings, the engine's tracing, the library, then the body
export function pageWGSL(engine, body) {
  return FRAME_WGSL + SCENE_BINDINGS + engine.helpers + "\n" + engine.trace + "\n" + LIB_WGSL + "\n" + body;
}
