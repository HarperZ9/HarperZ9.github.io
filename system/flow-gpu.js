// flow-gpu.js: the Music source's flow-field mode on raw-native's web GPU host (14 October 2026).
// The same curl-noise field as reactive-visuals.js (the same permutation, noise and curl, the same
// speed, steering, beat kick, life and respawn rules), with the same fade and beat flash. The
// Canvas2D mode moves 60 to 240 particles a frame and strokes one short segment for each. Here up
// to 1,024 particles (scaled with the stage's area as the Canvas2D count is) take their step in a
// WGSL compute pass, and each segment is splatted 8 times along its length and across its width
// into an ink buffer that fades as the Canvas2D trail fades. A particle lays down the ink of one
// Canvas2D stroke; coverage follows Canvas2D's own compositing, and colour runs along the mode's
// palette with coverage, as the attractor's runs with density (attractor-gpu.js).
//
// Fallback: without WebGPU, or if the host cannot start, reactive-visuals.js draws the Canvas2D mode
// exactly as before.

const RAW = new URL("../media/raw-native/web-4edf976/", import.meta.url).href;
const PARTICLES = 1024;
const SUB = 8;    // splats along each segment
const WG = 64;
const Q = 256;    // fixed-point weight of a bilinear splat corner (times the particle's alpha)
// Particle count and exposure were chosen on 14 October 2026 from a contact sheet of 1,024 to
// 65,536 particles and several exposures at desktop and phone sizes, by the attractor's criteria:
// 1,024 at 1 keeps each streak legible (more local contrast than Canvas2D), clips nothing, and
// uses the palette most like Canvas2D, at 1.4 (desktop) and 1.9 (phone) times its brightness.
// 65,536 particles turned the field into an even haze.
const EXPOSURE = 1;

// Uniforms, 16-byte rows:
//  0 size.xy, scale, phase
//  1 speed, kick, lifeDecay, frame
//  2 decay, weight, sizeMul, reset
//  3 void.rgb, intensity
//  4 live (particles drawn this frame), pad
const WGSL = /* wgsl */ `
struct U {
  size: vec2f, scale: f32, phase: f32,
  speed: f32, kick: f32, lifeDecay: f32, frame: f32,
  decay: f32, weight: f32, sizeMul: f32, reset: f32,
  voidc: vec3f, intensity: f32,
  live: f32, p0: f32, p1: f32, p2: f32,
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> pos: array<vec4f>;    // x, y, vx, vy
@group(0) @binding(2) var<storage, read_write> acc: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> trail: array<f32>;
@group(0) @binding(4) var<storage, read> perm: array<u32, 512>;
@group(0) @binding(7) var<storage, read_write> life: array<vec4f>;  // life, maxLife, size, alive

fn fade(t: f32) -> f32 { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
fn grad2(h: u32, x: f32, y: f32) -> f32 {
  let k = h & 3u;
  if (k == 0u) { return x + y; } if (k == 1u) { return -x + y; } if (k == 2u) { return x - y; }
  return -x - y;
}
// The same Perlin-style noise as noise2() in reactive-visuals.js, with its permutation.
fn noise2(x: f32, y: f32) -> f32 {
  let X = u32(i32(floor(x)) & 255); let Y = u32(i32(floor(y)) & 255);
  let xf = x - floor(x); let yf = y - floor(y);
  let uu = fade(xf); let vv = fade(yf);
  let aa = perm[perm[X] + Y]; let ab = perm[perm[X] + Y + 1u];
  let ba = perm[perm[X + 1u] + Y]; let bb = perm[perm[X + 1u] + Y + 1u];
  let x1 = mix(grad2(aa, xf, yf), grad2(ba, xf - 1.0, yf), uu);
  let x2 = mix(grad2(ab, xf, yf - 1.0), grad2(bb, xf - 1.0, yf - 1.0), uu);
  return mix(x1, x2, vv);
}
fn curl(x: f32, y: f32) -> vec2f {
  let e = 0.1;
  return vec2f((noise2(x, y + e) - noise2(x, y - e)) / (2.0 * e), -(noise2(x + e, y) - noise2(x - e, y)) / (2.0 * e));
}
fn hash(n: u32) -> f32 {
  var x = n * 747796405u + 2891336453u;
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  return f32((x >> 22u) ^ x) / 4294967295.0;
}
fn splat(px: vec2f, w: f32) {
  let W = i32(u.size.x); let H = i32(u.size.y);
  let f = px - 0.5; let i0 = vec2i(floor(f)); let t = f - floor(f);
  let ws = array<f32, 4>((1.0 - t.x) * (1.0 - t.y), t.x * (1.0 - t.y), (1.0 - t.x) * t.y, t.x * t.y);
  for (var k = 0; k < 4; k++) {
    let q = i0 + vec2i(k & 1, k >> 1);
    if (q.x < 0 || q.y < 0 || q.x >= W || q.y >= H) { continue; }
    let wq = u32(round(ws[k] * w * ${Q}.0));
    if (wq != 0u) { atomicAdd(&acc[u32(q.y * W + q.x)], wq); }
  }
}

@compute @workgroup_size(${WG}) fn advance(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= min(${PARTICLES}u, u32(u.live))) { return; }
  let seed = i * 9u + u32(u.frame) * 2654435761u;
  var p = pos[i]; var l = life[i];
  if (u.reset > 0.5 || l.w == 0.0) {
    p = vec4f(hash(seed) * u.size.x, hash(seed + 1u) * u.size.y, 0.0, 0.0);
    l = vec4f(hash(seed + 2u), 0.6 + hash(seed + 3u) * 0.4, 1.2 + hash(seed + 4u) * 2.0, 1.0);
  }
  let fv = curl(p.x * u.scale, p.y * u.scale + u.phase) * u.speed;
  var v = mix(p.zw, fv, 0.3);
  if (u.kick > 0.0) { let a = hash(seed + 5u) * 6.2831853; v += vec2f(cos(a), sin(a)) * u.kick; }
  let prev = p.xy;
  let nxt = prev + v;
  l.x -= u.lifeDecay;
  if (l.x <= 0.0 || nxt.x < 0.0 || nxt.x > u.size.x || nxt.y < 0.0 || nxt.y > u.size.y) {
    pos[i] = vec4f(hash(seed + 6u) * u.size.x, hash(seed + 7u) * u.size.y, 0.0, 0.0);
    life[i] = vec4f(l.y, l.y, l.z, 1.0);
    return;
  }
  // The segment prev -> nxt, as wide as the Canvas2D stroke, at the stroke's alpha.
  let alpha = clamp(l.x * 0.55 + u.intensity * 0.15, 0.0, 1.0);
  let d = nxt - prev; let n = normalize(vec2f(-d.y, d.x) + vec2f(1e-6, 0.0));
  let width = l.z * u.sizeMul;
  for (var s = 0u; s < ${SUB}u; s++) {
    let along = (f32(s) + hash(seed + 16u + s)) / ${SUB}.0;
    let across = (hash(seed + 32u + s) - 0.5) * width;
    splat(prev + d * along + n * across, alpha);
  }
  pos[i] = vec4f(nxt, v);
  life[i] = l;
}

@compute @workgroup_size(${WG}) fn resolve(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= u32(u.size.x) * u32(u.size.y)) { return; }
  let add = f32(atomicLoad(&acc[i])) * (u.weight / ${Q}.0);
  atomicStore(&acc[i], 0u);
  var t = trail[i];
  if (u.reset > 0.5) { t = 0.0; }
  trail[i] = t * u.decay + add;
}

struct VO { @builtin(position) p: vec4f, }
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let xy = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  var o: VO; o.p = vec4f(xy.x, -xy.y, 0.0, 1.0); return o;
}
@group(0) @binding(5) var<storage, read> trailR: array<f32>;
@group(0) @binding(6) var<storage, read> lutR: array<vec4f, 64>;
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let q = vec2u(floor(i.p.xy));
  let n = trailR[q.y * u32(u.size.x) + q.x];
  // n is ink in units of one Canvas2D stroke at full alpha. Coverage follows Canvas2D's own
  // compositing, 1 - (1 - alpha)^k, which for small alphas is 1 - exp(-n); colour runs along the
  // mode's palette with coverage, so faint trails take its first hue and bright streaks its last.
  let cov = 1.0 - exp(-n);
  let col = lutR[u32(cov * 63.0)].rgb / 255.0;
  return vec4f(mix(u.voidc, col, cov), 1.0);
}`;

/** createFlowGPU(perm) -> a drawer, or null when this browser has no usable WebGPU.
    perm: the 512-entry permutation reactive-visuals.js's noise uses. */
export async function createFlowGPU(perm) {
  if (typeof navigator === "undefined" || !navigator.gpu) return null;
  let gpu;
  try { gpu = await import(RAW + "raw-gpu.mjs"); }
  catch (e) { console.error("[flow-gpu] the raw-native host failed to load:", e); return null; }
  const canvas = document.createElement("canvas");
  canvas.width = 2; canvas.height = 2;
  let host;
  try { host = await gpu.createHost({ canvas, timing: true }); }
  catch (e) { if (!(e instanceof gpu.HostUnavailable)) console.error("[flow-gpu] no WebGPU host:", e); return null; }
  const device = host.device, format = host.format;
  const module = device.createShaderModule({ label: "flow", code: WGSL });
  const info = await module.getCompilationInfo();
  const bad = info.messages.filter((m) => m.type === "error");
  if (bad.length) { console.error("[flow-gpu] the shader did not compile:", bad.map((m) => m.message).join("; ")); return null; }
  const C = GPUShaderStage.COMPUTE, F = GPUShaderStage.FRAGMENT;
  const bgl = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: C | F, buffer: {} },
    { binding: 1, visibility: C, buffer: { type: "storage" } },
    { binding: 2, visibility: C, buffer: { type: "storage" } },
    { binding: 3, visibility: C, buffer: { type: "storage" } },
    { binding: 4, visibility: C, buffer: { type: "read-only-storage" } },
    { binding: 7, visibility: C, buffer: { type: "storage" } },
  ] });
  const bglR = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: C | F, buffer: {} },
    { binding: 5, visibility: F, buffer: { type: "read-only-storage" } },
    { binding: 6, visibility: F, buffer: { type: "read-only-storage" } },
  ] });
  const cLayout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const advance = device.createComputePipeline({ label: "flow advance", layout: cLayout, compute: { module, entryPoint: "advance" } });
  const resolve = device.createComputePipeline({ label: "flow resolve", layout: cLayout, compute: { module, entryPoint: "resolve" } });
  const show = device.createRenderPipeline({ label: "flow show", layout: device.createPipelineLayout({ bindGroupLayouts: [bglR] }),
    vertex: { module, entryPoint: "vs" }, fragment: { module, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });
  const S = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
  const ubuf = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const pos = device.createBuffer({ size: PARTICLES * 16, usage: S });
  const life = device.createBuffer({ size: PARTICLES * 16, usage: S });
  const lut = device.createBuffer({ size: 64 * 16, usage: S });
  const permBuf = device.createBuffer({ size: 512 * 4, usage: S });
  device.queue.writeBuffer(permBuf, 0, Uint32Array.from(perm));
  let acc = null, trail = null, bind = null, bindR = null, w = 0, h = 0, frame = 0, lastMs = 0, reset = true;

  function size(W, H) {
    if (W === w && H === h) return;
    w = W; h = H; canvas.width = W; canvas.height = H;
    if (acc) acc.destroy(); if (trail) trail.destroy();
    acc = device.createBuffer({ size: W * H * 4, usage: S });
    trail = device.createBuffer({ size: W * H * 4, usage: S });
    bind = device.createBindGroup({ layout: bgl, entries: [
      { binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: pos } },
      { binding: 2, resource: { buffer: acc } }, { binding: 3, resource: { buffer: trail } },
      { binding: 4, resource: { buffer: permBuf } }, { binding: 7, resource: { buffer: life } },
    ] });
    bindR = device.createBindGroup({ layout: bglR, entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 5, resource: { buffer: trail } }, { binding: 6, resource: { buffer: lut } }] });
    reset = true;
  }

  return {
    canvas, host, backend: "raw-native webgpu", particles: PARTICLES,
    /** Start again on the next frame (a resize, a re-entry). */
    reset() { reset = true; },
    /** Draw one frame at width x height. f = { scale, phase, speed, kick, lifeDecay, sizeMul,
        fade (the Canvas2D void overlay's alpha), cpuInk (the ink the Canvas2D mode lays down a frame,
        in px before alpha: particles x segment length x stroke width), cpuN (its particles), cpuMax
        (its most particles), intensity, colour(s) -> [r, g, b] 0..255 for s in [0, 1), voidRgb }. */
    draw(f, width, height) {
      const t0 = performance.now();
      size(width, height);
      const L = new Float32Array(64 * 4);
      for (let s = 0; s < 64; s += 1) { const c = f.colour(s / 64); L[s * 4] = c[0]; L[s * 4 + 1] = c[1]; L[s * 4 + 2] = c[2]; }
      device.queue.writeBuffer(lut, 0, L);
      // Each splat is 1 px at the particle's alpha. A particle lays down the ink of one Canvas2D
      // stroke (segment length x width) over its SUB splats, times the exposure.
      const weight = (f.cpuInk / f.cpuN / SUB) * EXPOSURE;
      // The Canvas2D mode scales its particles with the stage's area (up to cpuMax); so does this.
      const active = Math.max(WG, Math.round(PARTICLES * Math.min(1, f.cpuN / f.cpuMax)));
      frame = (frame + 1) % 16777216;
      device.queue.writeBuffer(ubuf, 0, new Float32Array([
        width, height, f.scale, f.phase,
        f.speed, f.kick, f.lifeDecay, frame,
        1 - f.fade, weight, f.sizeMul, reset ? 1 : 0,
        f.voidRgb[0], f.voidRgb[1], f.voidRgb[2], f.intensity,
        active, 0, 0, 0,
      ]));
      reset = false;
      const enc = device.createCommandEncoder({ label: "flow frame" });
      const cp = enc.beginComputePass({ label: "flow" });
      cp.setBindGroup(0, bind);
      cp.setPipeline(advance); cp.dispatchWorkgroups(Math.ceil(PARTICLES / WG));
      cp.setPipeline(resolve); cp.dispatchWorkgroups(Math.ceil((width * height) / WG));
      cp.end();
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: host.context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      rp.setPipeline(show); rp.setBindGroup(0, bindR); rp.draw(3); rp.end();
      device.queue.submit([enc.finish()]);
      lastMs = performance.now() - t0;
    },
    stats: () => ({ cpuMs: lastMs }),
  };
}
