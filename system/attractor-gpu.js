// attractor-gpu.js: the Music source's attractor mode on raw-native's web GPU host (10 October
// 2026). The same audio-driven maps as reactive-visuals.js (Clifford, de Jong, Lorenz projected to
// XY), with the same parameters, colours, fade and beat flash. The Canvas2D mode plots 800 to 2,600
// points a frame, one fillRect each, so the figure builds up as speckle. Here 16,384 orbits each take
// 64 steps a frame in a WGSL compute pass, about a million points, splatted bilinearly into a
// density buffer. Each point carries the weight that keeps the expected brightness of the Canvas2D
// mode, so the picture is the same figure at the same exposure, drawn without the speckle.
//
// Fallback: without WebGPU, or if the host cannot start, reactive-visuals.js draws the Canvas2D mode
// exactly as before.

const RAW = new URL("../media/raw-native/web-4edf976/", import.meta.url).href;
const ORBITS = 16384;
const STEPS = 64;
const WG = 64;
const Q = 16;   // fixed-point weight of a bilinear splat corner
// Exposure over the Canvas2D mode's expected brightness. A million points spread the same exposure
// evenly over the whole figure, where the Canvas2D mode piles it on the few rings it drew lately;
// at 1 the lobes fall below the void. 6 was chosen by eye on the contact sheet (slices/c3).
const EXPOSURE = 6;

// Uniforms, 16-byte rows:
//  0 size.xy, scale.xy
//  1 off.xy, dt, type (0 clifford, 1 de Jong, 2 Lorenz)
//  2 a, b, c, d
//  3 decay, alpha, weight (points' share), reset
//  4 void.rgb, pad
const WGSL = /* wgsl */ `
struct U {
  size: vec2f, scale: vec2f,
  off: vec2f, dt: f32, kind: f32,
  abcd: vec4f,
  decay: f32, alpha: f32, weight: f32, reset: f32,
  voidc: vec3f, pad: f32,
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> state: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> acc: array<atomic<u32>>;   // 4 per pixel: r, g, b sums and hits
@group(0) @binding(3) var<storage, read_write> trail: array<vec4f>;       // per pixel: rgb sums and hits, decayed
@group(0) @binding(4) var<storage, read> lut: array<vec4f, 64>;           // colour by step index (sRGB, 0..255)

fn step(p: vec3f) -> vec3f {
  let a = u.abcd.x; let b = u.abcd.y; let c = u.abcd.z; let d = u.abcd.w;
  if (u.kind < 0.5) { return vec3f(sin(a * p.y) + c * cos(a * p.x), sin(b * p.x) + d * cos(b * p.y), 0.0); }
  if (u.kind < 1.5) { return vec3f(sin(a * p.y) - cos(b * p.x), sin(c * p.x) - cos(d * p.y), 0.0); }
  let dp = vec3f(10.0 * (p.y - p.x), p.x * (28.0 - p.z) - p.y, p.x * p.y - (8.0 / 3.0) * p.z);
  return p + dp * u.dt;
}

fn splat(px: vec2f, col: vec3f) {
  let W = i32(u.size.x); let H = i32(u.size.y);
  let f = px - 0.5;
  let i0 = vec2i(floor(f));
  let t = f - floor(f);
  let ws = array<f32, 4>((1.0 - t.x) * (1.0 - t.y), t.x * (1.0 - t.y), (1.0 - t.x) * t.y, t.x * t.y);
  for (var k = 0; k < 4; k++) {
    let q = i0 + vec2i(k & 1, k >> 1);
    if (q.x < 0 || q.y < 0 || q.x >= W || q.y >= H) { continue; }
    let wq = u32(round(ws[k] * ${Q}.0));
    if (wq == 0u) { continue; }
    let o = u32(q.y * W + q.x) * 4u;
    atomicAdd(&acc[o], u32(col.r) * wq);
    atomicAdd(&acc[o + 1u], u32(col.g) * wq);
    atomicAdd(&acc[o + 2u], u32(col.b) * wq);
    atomicAdd(&acc[o + 3u], wq);
  }
}

fn hash(n: u32) -> f32 {
  var x = n * 747796405u + 2891336453u;
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  return f32((x >> 22u) ^ x) / 4294967295.0;
}

@compute @workgroup_size(${WG}) fn orbit(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= ${ORBITS}u) { return; }
  var p = state[i].xyz;
  if (u.reset > 0.5 || state[i].w == 0.0) {
    p = vec3f(hash(i * 3u) * 2.0 - 1.0, hash(i * 3u + 1u) * 2.0 - 1.0, hash(i * 3u + 2u) * 2.0 - 1.0);
    if (u.kind > 1.5) { p = p * 10.0 + vec3f(0.0, 0.0, 25.0); }
    for (var w = 0; w < 24; w++) { p = step(p); }   // settle onto the attractor before plotting
  }
  for (var s = 0; s < ${STEPS}; s++) {
    p = step(p);
    if (any(p != p) || any(abs(p) > vec3f(1e4))) { p = vec3f(0.1, 0.1, 0.1); }
    splat(vec2f(p.x * u.scale.x + u.off.x, p.y * u.scale.y + u.off.y), lut[s].rgb);
  }
  state[i] = vec4f(p, 1.0);
}

// Fold this frame's points into the trail: the old trail fades as the Canvas2D void overlay fades
// it, and the new points join with the weight that keeps the Canvas2D mode's expected exposure.
@compute @workgroup_size(${WG}) fn resolve(@builtin(global_invocation_id) id: vec3u) {
  let n = u32(u.size.x) * u32(u.size.y);
  let i = id.x;
  if (i >= n) { return; }
  let o = i * 4u;
  let add = vec4f(f32(atomicLoad(&acc[o])), f32(atomicLoad(&acc[o + 1u])), f32(atomicLoad(&acc[o + 2u])), f32(atomicLoad(&acc[o + 3u]))) * (u.weight / ${Q}.0);
  atomicStore(&acc[o], 0u); atomicStore(&acc[o + 1u], 0u); atomicStore(&acc[o + 2u], 0u); atomicStore(&acc[o + 3u], 0u);
  var t = trail[i];
  if (u.reset > 0.5) { t = vec4f(0.0); }
  trail[i] = t * u.decay + add;
}

struct VO { @builtin(position) p: vec4f, }
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let xy = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  var o: VO; o.p = vec4f(xy.x, -xy.y, 0.0, 1.0); return o;
}
@group(0) @binding(5) var<storage, read> trailR: array<vec4f>;
@group(0) @binding(6) var<storage, read> lutR: array<vec4f, 64>;
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let q = vec2u(floor(i.p.xy));
  let t = trailR[q.y * u32(u.size.x) + q.x];
  // Coverage of n points at the Canvas2D mode's alpha each: 1 - (1 - alpha)^n.
  let cov = 1.0 - pow(1.0 - u.alpha, t.w);
  // Colour by density along the mode's own palette: thin regions take its first hue, dense ones its
  // last. Averaging each point's hue instead would grey the figure out, since the hues cancel.
  let s = clamp(log2(1.0 + t.w) / 6.0, 0.0, 1.0);
  let col = lutR[u32(s * 63.0)].rgb / 255.0;
  return vec4f(mix(u.voidc, col, cov), 1.0);
}`;

/** createAttractorGPU() -> a drawer, or null when this browser has no usable WebGPU. */
export async function createAttractorGPU() {
  if (typeof navigator === "undefined" || !navigator.gpu) return null;
  let gpu;
  try { gpu = await import(RAW + "raw-gpu.mjs"); }
  catch (e) { console.error("[attractor-gpu] the raw-native host failed to load:", e); return null; }
  const canvas = document.createElement("canvas");
  canvas.width = 2; canvas.height = 2;
  let host;
  try { host = await gpu.createHost({ canvas, timing: true }); }
  catch (e) { if (!(e instanceof gpu.HostUnavailable)) console.error("[attractor-gpu] no WebGPU host:", e); return null; }
  const device = host.device, format = host.format;
  const module = device.createShaderModule({ label: "attractor", code: WGSL });
  const C = GPUShaderStage.COMPUTE, F = GPUShaderStage.FRAGMENT;
  const bgl = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: C | F, buffer: {} },
    { binding: 1, visibility: C, buffer: { type: "storage" } },
    { binding: 2, visibility: C, buffer: { type: "storage" } },
    { binding: 3, visibility: C, buffer: { type: "storage" } },
    { binding: 4, visibility: C, buffer: { type: "read-only-storage" } },
  ] });
  const bglR = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: C | F, buffer: {} },
    { binding: 5, visibility: F, buffer: { type: "read-only-storage" } },
    { binding: 6, visibility: F, buffer: { type: "read-only-storage" } },
  ] });
  const cLayout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const orbit = device.createComputePipeline({ label: "attractor orbit", layout: cLayout, compute: { module, entryPoint: "orbit" } });
  const resolve = device.createComputePipeline({ label: "attractor resolve", layout: cLayout, compute: { module, entryPoint: "resolve" } });
  const show = device.createRenderPipeline({ label: "attractor show", layout: device.createPipelineLayout({ bindGroupLayouts: [bglR] }),
    vertex: { module, entryPoint: "vs" }, fragment: { module, entryPoint: "fs", targets: [{ format }] }, primitive: { topology: "triangle-list" } });
  const S = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
  const ubuf = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const state = device.createBuffer({ size: ORBITS * 16, usage: S });
  const lut = device.createBuffer({ size: 64 * 16, usage: S });
  let acc = null, trail = null, bind = null, bindR = null, w = 0, h = 0, kind = -1, lastMs = 0, reset = true;

  function size(W, H) {
    if (W === w && H === h) return;
    w = W; h = H; canvas.width = W; canvas.height = H;
    if (acc) acc.destroy(); if (trail) trail.destroy();
    acc = device.createBuffer({ size: W * H * 16, usage: S });
    trail = device.createBuffer({ size: W * H * 16, usage: S });
    bind = device.createBindGroup({ layout: bgl, entries: [
      { binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: state } },
      { binding: 2, resource: { buffer: acc } }, { binding: 3, resource: { buffer: trail } }, { binding: 4, resource: { buffer: lut } },
    ] });
    bindR = device.createBindGroup({ layout: bglR, entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 5, resource: { buffer: trail } }, { binding: 6, resource: { buffer: lut } }] });
    reset = true;
  }

  return {
    canvas, host, backend: "raw-native webgpu", orbits: ORBITS, steps: STEPS,
    /** Start the figure again on the next frame (a new type, a resize, a re-entry). */
    reset() { reset = true; },
    /** Draw one frame at width x height. f = { type, a, b, c, d, dt, scale: [x, y], off: [x, y],
        fade (the Canvas2D void overlay's alpha this frame), alpha (one point's alpha),
        cpuPoints (the points the Canvas2D mode would plot this frame), colour(s) -> [r, g, b] 0..255
        for step fraction s in [0, 1), voidRgb [r, g, b] 0..1 }. */
    draw(f, width, height) {
      const t0 = performance.now();
      size(width, height);
      const k = f.type === "dejong" ? 1 : f.type === "lorenz2d" ? 2 : 0;
      if (k !== kind) { kind = k; reset = true; }
      const L = new Float32Array(64 * 4);
      for (let s = 0; s < 64; s += 1) { const c = f.colour(s / STEPS); L[s * 4] = c[0]; L[s * 4 + 1] = c[1]; L[s * 4 + 2] = c[2]; }
      device.queue.writeBuffer(lut, 0, L);
      const weight = (f.cpuPoints / (ORBITS * STEPS)) * EXPOSURE;
      device.queue.writeBuffer(ubuf, 0, new Float32Array([
        width, height, f.scale[0], f.scale[1],
        f.off[0], f.off[1], f.dt, k,
        f.a, f.b, f.c, f.d,
        1 - f.fade, f.alpha, weight, reset ? 1 : 0,
        f.voidRgb[0], f.voidRgb[1], f.voidRgb[2], 0,
      ]));
      reset = false;
      const enc = device.createCommandEncoder({ label: "attractor frame" });
      const cp = enc.beginComputePass({ label: "attractor" });
      cp.setBindGroup(0, bind);
      cp.setPipeline(orbit); cp.dispatchWorkgroups(Math.ceil(ORBITS / WG));
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
