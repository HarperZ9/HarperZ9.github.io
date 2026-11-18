// The page's real-time passes around the engine's three (GTAO, SSR, TAA, which run as the engine wrote them).
// Each body is wrapped by pageWGSL (wgsl-lib.mjs); group 1 holds the pass's own buffers. Per-pixel passes use the
// engine's dispatch: 64-wide workgroups folded into rows, pixel i = gid.x + gid.y * 2097152.

export const IDX = /* wgsl */ `
fn pixelOf(gid: vec3u) -> u32 { return gid.x + gid.y * 2097152u; }
fn npx() -> u32 { return u32(F.size.x) * u32(F.size.y); }
`;

// The G-buffer: the browser's rasterizer draws the triangles (the engine's own raster is a compute pass that walks
// every triangle per pixel; at window size and 586,424 triangles that is too slow to move through). Two targets:
// view position and depth; world normal and material. A second draw keeps the nearest back face's depth for SSR.
export const RASTER = /* wgsl */ `
struct VO { @builtin(position) pos: vec4f, @location(0) vp: vec3f, @location(1) n: vec3f, @location(2) @interpolate(flat) m: u32 }
@vertex fn vs(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) m: u32) -> VO {
  var o: VO; let v = F.view * vec4f(p, 1.0); o.vp = v.xyz; o.pos = F.proj * v; o.n = n; o.m = m; return o;
}
struct FO { @location(0) a: vec4f, @location(1) b: vec4f }
@fragment fn fs(i: VO, @builtin(front_facing) ff: bool) -> FO {
  var n = normalize(i.n);
  let toEye = normalize(F.eye.xyz - (F.invView * vec4f(i.vp, 1.0)).xyz);
  if (dot(n, toEye) < 0.0) { n = -n; }
  var o: FO; o.a = vec4f(i.vp, -i.vp.z); o.b = vec4f(n, f32(i.m)); return o;
}
// the back layer: only surfaces whose normal faces away from the eye
@fragment fn fsBack(i: VO) -> @location(0) vec4f {
  let toEye = normalize(F.eye.xyz - (F.invView * vec4f(i.vp, 1.0)).xyz);
  if (dot(normalize(i.n), toEye) > 0.0) { discard; }
  return vec4f(-i.vp.z, 0.0, 0.0, 0.0);
}
`;

// Pack the targets into the engine's G-buffer (8 floats a pixel, post.wgsl), the material per pixel, this frame's
// depths for the next frame's TAA, and where each pixel was in the last frame (the TAA's R).
export const PACK = IDX + /* wgsl */ `
@group(1) @binding(0) var ta: texture_2d<f32>;
@group(1) @binding(1) var tb: texture_2d<f32>;
@group(1) @binding(2) var tk: texture_2d<f32>;
@group(1) @binding(3) var<storage, read_write> G: array<f32>;
@group(1) @binding(4) var<storage, read_write> M: array<u32>;
@group(1) @binding(5) var<storage, read_write> D: array<f32>;
@group(1) @binding(6) var<storage, read_write> R: array<f32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = pixelOf(gid); if (i >= npx()) { return; }
  let w = u32(F.size.x); let xy = vec2i(i32(i % w), i32(i / w));
  let a = textureLoad(ta, xy, 0); let b = textureLoad(tb, xy, 0); let k = textureLoad(tk, xy, 0).x;
  let g = i * 8u;
  var world: vec3f;
  if (a.w <= 0.0) {
    for (var j = 0u; j < 8u; j++) { G[g + j] = 0.0; }
    G[g + 3u] = -1.0; M[i] = 0xffffffffu; D[i] = -1.0;
    world = F.eye.xyz + camRay(vec2f(xy) + 0.5) * 1.0e4;
  } else {
    let nv = (F.view * vec4f(b.xyz, 0.0)).xyz;
    G[g] = a.x; G[g + 1u] = a.y; G[g + 2u] = a.z; G[g + 3u] = a.w;
    G[g + 4u] = nv.x; G[g + 5u] = nv.y; G[g + 6u] = nv.z; G[g + 7u] = select(1.0e30, k, k > a.w);
    M[i] = u32(b.w + 0.5); D[i] = a.w;
    world = (F.invView * vec4f(a.xyz, 1.0)).xyz;
  }
  let c = F.prevVP * vec4f(world, 1.0);
  R[i * 3u] = (c.x / c.w * 0.5 + 0.5) * F.size.x;
  R[i * 3u + 1u] = (0.5 - c.y / c.w * 0.5) * F.size.y;
  R[i * 3u + 2u] = select(c.w, -1.0, a.w <= 0.0);
}
`;

// Direct light and the sky: the sun through the engine's BVH walk (one ray a frame inside the sun's disk; TAA
// averages them), the sky's ambient cube times GTAO, emitted light. Writes the lit colour and the mirror weight.
export const SHADE = IDX + /* wgsl */ `
@group(1) @binding(0) var<storage, read> G: array<f32>;
@group(1) @binding(1) var<storage, read> M: array<u32>;
@group(1) @binding(2) var<storage, read> AO: array<f32>;
@group(1) @binding(3) var<storage, read_write> LR: array<vec4f>;   // 2 a pixel: lit, mirror weight
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = pixelOf(gid); if (i >= npx()) { return; }
  let w = u32(F.size.x); let px = vec2f(f32(i % w), f32(i / w)) + 0.5 + F.jit.xy;
  if (M[i] == 0xffffffffu) { LR[2u * i] = vec4f(skySeen(camRay(px), true), 0.0); LR[2u * i + 1u] = vec4f(0.0); return; }
  let g = i * 8u;
  let p = (F.invView * vec4f(G[g], G[g + 1u], G[g + 2u], 1.0)).xyz;
  let n = normalize((F.invView * vec4f(G[g + 4u], G[g + 5u], G[g + 6u], 0.0)).xyz);
  let v = normalize(F.eye.xyz - p); let m = matOf(M[i]);
  let fr = u32(F.size.z);
  let l = sunSample(rnd(i, fr, 0u), rnd(i, fr, 1u));
  let o = p + n * (4e-3 + 2e-4 * G[g + 3u]) + l * 6e-3;
  let vis = select(1.0, 0.0, dot(n, l) <= 0.0 || bvhBlocked(o, l, 1.0e30));
  var amb = (F.amb[0].rgb + F.amb[1].rgb + F.amb[2].rgb + F.amb[3].rgb + F.amb[4].rgb + F.amb[5].rgb) / 6.0;
  if (on(ON_SKY)) { amb = ambientCube(n); }
  let ao = select(1.0, AO[i], on(ON_AO));
  let c = m.emit + sunLight(m, n, v, l, vis) + m.albedo * (1.0 - m.metal) / M_PI * amb * ao;
  LR[2u * i] = vec4f(c, 0.0); LR[2u * i + 1u] = vec4f(mirrorW(m, n, v), 0.0);
}
`;

// Light in the air at half size: a march toward the surface with a shadow ray to the sun at every step, jittered
// a frame at a time. Writes the in-scattered light and the transmittance.
export const FOG = IDX + /* wgsl */ `
@group(1) @binding(0) var<storage, read> G: array<f32>;
@group(1) @binding(1) var<storage, read_write> FG: array<vec4f>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let hw = (u32(F.size.x) + 1u) / 2u; let hh = (u32(F.size.y) + 1u) / 2u;
  let i = pixelOf(gid); if (i >= hw * hh) { return; }
  let x = min(2u * (i % hw), u32(F.size.x) - 1u); let y = min(2u * (i / hw), u32(F.size.y) - 1u);
  let j = y * u32(F.size.x) + x;
  let d = camRay(vec2f(f32(x) + 1.0, f32(y) + 1.0));
  var tmax = airLength(F.eye.xyz, d);
  if (G[j * 8u + 3u] >= 0.0) { tmax = min(150.0, length(vec3f(G[j * 8u], G[j * 8u + 1u], G[j * 8u + 2u]))); }
  let s = F.fog.x; let steps = max(1u, u32(F.fog.w)); let dt = tmax / f32(steps);
  let ph = hg(dot(d, F.sunDir.xyz), F.fog.y); let fr = u32(F.size.z);
  let jit = rnd(i, fr, 7u); var Lin = vec3f(0.0);
  for (var k = 0u; k < steps; k++) {
    let t = (f32(k) + jit) * dt; let q = F.eye.xyz + d * t;
    let l = sunSample(rnd(i, fr, 8u + k), rnd(i, fr, 40u + k));
    let vis = select(1.0, 0.0, bvhBlocked(q, l, 1.0e30));
    Lin += s * exp(-s * t) * (ph * F.sunE.rgb * vis + vec3f(F.fog.z)) * dt;
  }
  FG[i] = vec4f(Lin, exp(-s * tmax));
}
`;

// Reflection and air, in exposure units: lit + mirror weight x (the SSR hit's lit colour, or the sky probe), then
// the fog. Writes the TAA's input (colour, view depth), or the output straight when TAA is off, and, while the
// camera holds still, adds this frame's AO and reflections to the running sums the measures read.
export const COMPOSE = IDX + /* wgsl */ `
@group(1) @binding(0) var<storage, read> G: array<f32>;
@group(1) @binding(1) var<storage, read> LR: array<vec4f>;
@group(1) @binding(2) var<storage, read> HIT: array<f32>;
@group(1) @binding(3) var<storage, read> FG: array<vec4f>;
@group(1) @binding(4) var<storage, read> AO: array<f32>;
@group(1) @binding(5) var<storage, read_write> C: array<f32>;
@group(1) @binding(6) var<storage, read_write> O: array<f32>;
@group(1) @binding(7) var<storage, read_write> ACC: array<vec4f>;   // 2 a pixel: (ao, ssr rgb), (probe rgb, -)
fn fogAt(x: f32, y: f32) -> vec4f {
  let hw = (u32(F.size.x) + 1u) / 2u; let hh = (u32(F.size.y) + 1u) / 2u;
  let fx = clamp(x * 0.5 - 0.5, 0.0, f32(hw - 1u)); let fy = clamp(y * 0.5 - 0.5, 0.0, f32(hh - 1u));
  let x0 = u32(fx); let y0 = u32(fy); let x1 = min(x0 + 1u, hw - 1u); let y1 = min(y0 + 1u, hh - 1u);
  let ax = fx - f32(x0); let ay = fy - f32(y0);
  return mix(mix(FG[y0 * hw + x0], FG[y0 * hw + x1], ax), mix(FG[y1 * hw + x0], FG[y1 * hw + x1], ax), ay);
}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = pixelOf(gid); if (i >= npx()) { return; }
  let w = u32(F.size.x); let x = f32(i % w) + 0.5; let y = f32(i / w) + 0.5;
  let g = i * 8u; let depth = G[g + 3u];
  var col = LR[2u * i].rgb; var ssrL = vec3f(0.0); var probe = vec3f(0.0);
  if (depth >= 0.0) {
    let p = (F.invView * vec4f(G[g], G[g + 1u], G[g + 2u], 1.0)).xyz;
    let n = normalize((F.invView * vec4f(G[g + 4u], G[g + 5u], G[g + 6u], 0.0)).xyz);
    let r = reflect(normalize(p - F.eye.xyz), n);
    probe = skySeen(r, false);
    let h = i32(HIT[i]);
    ssrL = select(probe, LR[2u * u32(max(h, 0))].rgb, h >= 0);
    col += LR[2u * i + 1u].rgb * select(probe, ssrL, on(ON_SSR));
  }
  if (on(ON_FOG) && F.fog.x > 0.0) { let f = fogAt(x, y); col = col * f.w + f.rgb; }
  col *= F.sunE.w;
  C[i * 4u] = col.x; C[i * 4u + 1u] = col.y; C[i * 4u + 2u] = col.z; C[i * 4u + 3u] = depth;
  if (!on(ON_TAA)) { O[i * 3u] = col.x; O[i * 3u + 1u] = col.y; O[i * 3u + 2u] = col.z; }
  if (F.flags.w == 1u) {   // still: keep the sums
    if (F.jit.w <= 1.5) { ACC[2u * i] = vec4f(0.0); ACC[2u * i + 1u] = vec4f(0.0); }
    ACC[2u * i] += vec4f(select(1.0, AO[i], depth >= 0.0), ssrL);
    ACC[2u * i + 1u] += vec4f(probe, 0.0);
  }
}
`;

// The tilted lens, in real time: each pixel's blur from its distance to the tilted plane of focus, gathered from
// neighbours whose own blur reaches it (48 taps on a golden-angle spiral). Off, or with no lens, it copies.
export const TILT = IDX + /* wgsl */ `
@group(1) @binding(0) var<storage, read> G: array<f32>;
@group(1) @binding(1) var<storage, read> O: array<f32>;
@group(1) @binding(2) var<storage, read_write> OUT: array<vec4f>;
fn cocAt(x: u32, y: u32) -> f32 {
  let w = u32(F.size.x); let j = y * w + x;
  let d = camRay(vec2f(f32(x), f32(y)) + 0.5);
  let tf = -(dot(F.tiltN.xyz, F.eye.xyz) + F.tiltN.w) / dot(F.tiltN.xyz, d);
  if (!(tf > 0.0)) { return F.tiltL.z; }
  var tx = 1.0e6;
  if (G[j * 8u + 3u] >= 0.0) { tx = length(vec3f(G[j * 8u], G[j * 8u + 1u], G[j * 8u + 2u])); }
  return min(F.tiltL.x * abs(tx - tf) / (tf * tx) * F.tiltL.y, F.tiltL.z);
}
fn colAt(j: u32) -> vec3f { return vec3f(O[j * 3u], O[j * 3u + 1u], O[j * 3u + 2u]); }
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = pixelOf(gid); if (i >= npx()) { return; }
  let w = u32(F.size.x); let h = u32(F.size.y); let x = i % w; let y = i / w;
  if (!on(ON_TILT) || F.tiltL.w < 0.5) { OUT[i] = vec4f(colAt(i), 1.0); return; }
  let r = cocAt(x, y);
  var sum = colAt(i); var wsum = 1.0;
  if (r > 0.75) {
    for (var k = 1u; k < 48u; k++) {
      let rr = r * sqrt(f32(k) / 48.0); let a = f32(k) * 2.39996323;
      let qx = i32(round(f32(x) + rr * cos(a))); let qy = i32(round(f32(y) + rr * sin(a)));
      if (qx < 0 || qy < 0 || qx >= i32(w) || qy >= i32(h)) { continue; }
      let rq = cocAt(u32(qx), u32(qy));
      let wq = clamp(rq - rr + 1.0, 0.0, 1.0);
      sum += colAt(u32(qy) * w + u32(qx)) * wq; wsum += wq;
    }
  }
  OUT[i] = vec4f(sum / wsum, 1.0);
}
`;
