// neural-gpu.js: the Living neural instruments drawn by raw-native's web GPU host (10 October
// 2026). The same seed-built networks (neural.js) run per pixel in WGSL: the field's CPPN and the
// solid's neural SDF, with the same weights, activations, drift, camera and shading as the CPU path
// in studio-neural.js. What it adds is resolution. The CPU field paints one colour per 2 to 4 px
// cell; the CPU solid is sphere-marched at 150 px wide at most and stretched. Here the field is
// evaluated at every pixel and the solid is marched at every pixel with 2 x 2 samples per pixel.
//
// mode "full" is that. mode "grid" samples exactly where the CPU path samples (the field's cell
// grid, the solid's low-resolution buffer) so a test can compare the two paths value for value.
//
// Fallback: without WebGPU, or if the host cannot start, studio-neural.js keeps its worker and
// main-thread paths, unchanged.

const RAW = new URL("../media/raw-native/web-4edf976/", import.meta.url).href;

// Network shapes: buildCppn's default [6, 14, 14, 12, 3] and buildNeuralSdf's [4, 10, 8, 1].
const CPPN = [6, 14, 14, 12, 3];
const SDF = [4, 10, 8, 1];
const ACT = { tanh: 0, sin: 1, gauss: 2, fold: 3 };

// Uniforms (std140-like, 16-byte rows):
//  0 size.xy, grid.xy (columns and rows sampled; the field's cell grid or the solid's buffer)
//  1 time, mode (0 full, 1 grid), fx, fy        (field input frequencies)
//  2 eye.xyz, fov
//  3 fwd.xyz, aspect
//  4 right.xyz, freq                             (solid input frequency)
//  5 up.xyz, amp
//  6 tint0.rgb, R
//  7 tint1.rgb, pad
//  8 tint2.rgb, pad
//  9 acts (4 x u32 as f32)
const WGSL = /* wgsl */ `
struct U {
  size: vec2f, grid: vec2f,
  time: f32, mode: f32, fx: f32, fy: f32,
  eye: vec3f, fov: f32,
  fwd: vec3f, aspect: f32,
  rgt: vec3f, freq: f32,
  up: vec3f, amp: f32,
  t0: vec3f, R: f32,
  t1: vec3f, p1: f32,
  t2: vec3f, p2: f32,
  acts: vec4f,
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> w: array<f32>;

fn act(v: f32, a: f32) -> f32 {
  if (a < 0.5) { return tanh(clamp(v, -20.0, 20.0)); }
  if (a < 1.5) { return sin(v * 2.2); }
  if (a < 2.5) { return exp(-v * v * 1.6) * 2.0 - 1.0; }
  let m = v * 0.7 + 1.0;
  return abs((m - 2.0 * trunc(m / 2.0)) - 1.0) * 2.0 - 1.0;   // JS %: the remainder keeps m's sign
}
fn sq(v: f32) -> f32 { return (tanh(clamp(v, -20.0, 20.0)) + 1.0) * 0.5; }

// One dense layer: weights row-major (out x in) then biases, from offset 'off' in w.
// Private arrays of 16 hold any layer here (the widest is 14).
fn layer(inp: ptr<function, array<f32, 16>>, out: ptr<function, array<f32, 16>>, off: u32, nIn: u32, nOut: u32, a: f32, linear: bool) -> u32 {
  for (var o = 0u; o < nOut; o++) {
    var s = w[off + nOut * nIn + o];
    for (var i = 0u; i < nIn; i++) { s += w[off + o * nIn + i] * (*inp)[i]; }
    if (linear) { (*out)[o] = s; } else { (*out)[o] = act(s, a); }
  }
  return off + nOut * nIn + nOut;
}

fn cppn(nx: f32, ny: f32) -> vec3f {
  var a: array<f32, 16>; var b: array<f32, 16>;
  a[0] = nx; a[1] = ny; a[2] = sqrt(nx * nx + ny * ny); a[3] = sin(nx * u.fx); a[4] = sin(ny * u.fy); a[5] = 1.0;
  var off = 0u;
  off = layer(&a, &b, off, ${CPPN[0]}u, ${CPPN[1]}u, u.acts.x, false);
  off = layer(&b, &a, off, ${CPPN[1]}u, ${CPPN[2]}u, u.acts.y, false);
  off = layer(&a, &b, off, ${CPPN[2]}u, ${CPPN[3]}u, u.acts.z, false);
  off = layer(&b, &a, off, ${CPPN[3]}u, ${CPPN[4]}u, 0.0, true);
  return vec3f(sq(a[0]), sq(a[1]), sq(a[2]));
}

fn dist(p: vec3f) -> f32 {
  var a: array<f32, 16>; var b: array<f32, 16>;
  a[0] = p.x * u.freq; a[1] = p.y * u.freq; a[2] = p.z * u.freq; a[3] = 1.0;
  var off = 0u;
  off = layer(&a, &b, off, ${SDF[0]}u, ${SDF[1]}u, u.acts.x, false);
  off = layer(&b, &a, off, ${SDF[1]}u, ${SDF[2]}u, u.acts.y, false);
  off = layer(&a, &b, off, ${SDF[2]}u, ${SDF[3]}u, 0.0, true);
  return (length(p) - u.R) + tanh(clamp(b[0], -20.0, 20.0)) * u.amp;
}

struct VO { @builtin(position) p: vec4f, }
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  let xy = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  var o: VO; o.p = vec4f(xy, 0.0, 1.0); return o;
}

fn mixTint(w0: f32, w1: f32, w2: f32) -> vec3f {
  return (u.t0 * w0 + u.t1 * w1 + u.t2 * w2) / (w0 + w1 + w2 + 1e-4);
}

@fragment fn fsField(i: VO) -> @location(0) vec4f {
  // Full: every pixel. Grid: the target is the CPU's cell grid, one texel per cell.
  let n = select(u.size, u.grid, u.mode > 0.5);
  let g = floor(i.p.xy);
  let nx = (g.x / (n.x - 1.0)) * 2.0 - 1.0 + 0.16 * sin(u.time * 0.6);
  let ny = (g.y / (n.y - 1.0)) * 2.0 - 1.0 + 0.13 * sin(u.time * 0.41);
  let c = cppn(nx, ny);
  let lift = 0.35 + 0.65 * max(c.x, max(c.y, c.z));
  return vec4f(mixTint(c.x, c.y, c.z) * lift / 255.0, 1.0);
}

const BG = vec3f(4.0, 5.0, 12.0) / 255.0;

// One ray at (i, j) on an RW x RH image, exactly as renderSolid builds it. Returns rgb and coverage.
fn shade(fi: f32, fj: f32, n: vec2f) -> vec4f {
  let uu = (fi / n.x - 0.5) * 2.0 * u.fov * u.aspect;
  let vv = (0.5 - fj / n.y) * 2.0 * u.fov;
  let d = normalize(u.fwd + uu * u.rgt + vv * u.up);
  // Grid keeps the CPU's 40 steps; full takes 128, so thin ridges the CPU stopped short of resolve.
  let steps = select(128, 40, u.mode > 0.5);
  var t = 0.0; var hit = false;
  for (var s = 0; s < steps; s++) {
    let dd = dist(u.eye + d * t);
    if (dd < 0.01) { hit = true; break; }
    t += max(0.014, dd * 0.85);
    if (t > 6.0) { break; }
  }
  if (!hit) { return vec4f(BG, 0.0); }
  let p = u.eye + d * t;
  let e = 0.01;
  let gn = vec3f(dist(p + vec3f(e, 0, 0)) - dist(p - vec3f(e, 0, 0)),
                 dist(p + vec3f(0, e, 0)) - dist(p - vec3f(0, e, 0)),
                 dist(p + vec3f(0, 0, e)) - dist(p - vec3f(0, 0, e)));
  let nl = max(length(gn), 1e-9);
  let nn = gn / nl;
  let lam = max(0.1, dot(nn, normalize(vec3f(-0.5, 0.75, 0.55))));   // the CPU path's light
  let rim = pow(1.0 - max(0.0, -dot(d, gn) / nl), 2.5);
  let c = mixTint((nn.x + 1.0) * 0.5, (nn.y + 1.0) * 0.5, (nn.z + 1.0) * 0.5);
  let sh = 0.22 + lam * 0.78;
  return vec4f(min(vec3f(255.0), c * sh + rim * vec3f(72.0, 82.0, 98.0)) / 255.0, 1.0);
}

@fragment fn fsSolid(i: VO) -> @location(0) vec4f {
  if (u.mode > 0.5) {
    // Grid: one ray per texel of the CPU's RW x RH buffer, at the texel's corner as the CPU does.
    let r = shade(floor(i.p.x), floor(i.p.y), u.grid);
    return vec4f(mix(BG, r.rgb, r.a), 1.0);
  }
  // Full: 2 x 2 rays inside each pixel of the stage, on the CPU's projection rescaled to it.
  var acc = vec3f(0.0);
  for (var k = 0; k < 4; k++) {
    let o = vec2f(f32(k & 1), f32(k >> 1)) * 0.5 - 0.25;
    let r = shade(i.p.x - 0.5 + o.x, i.p.y - 0.5 + o.y, u.size);
    acc += mix(BG, r.rgb, r.a);
  }
  return vec4f(acc * 0.25, 1.0);
}`;

function packMlp(mlp) {
  let n = 0;
  for (let l = 0; l < mlp.W.length; l += 1) n += mlp.W[l].length + mlp.B[l].length;
  const out = new Float32Array(Math.max(4, n));
  let o = 0;
  for (let l = 0; l < mlp.W.length; l += 1) { out.set(mlp.W[l], o); o += mlp.W[l].length; out.set(mlp.B[l], o); o += mlp.B[l].length; }
  return out;
}
const sameShape = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** createNeuralGPU() -> a drawer, or null when this browser has no usable WebGPU. */
export async function createNeuralGPU() {
  if (typeof navigator === "undefined" || !navigator.gpu) return null;
  let gpu;
  try { gpu = await import(RAW + "raw-gpu.mjs"); }
  catch (e) { console.error("[neural-gpu] the raw-native host failed to load:", e); return null; }
  const canvas = document.createElement("canvas");
  canvas.width = 2; canvas.height = 2;
  let host;
  try { host = await gpu.createHost({ canvas, timing: true }); }
  catch (e) { if (!(e instanceof gpu.HostUnavailable)) console.error("[neural-gpu] no WebGPU host:", e); return null; }
  const device = host.device, format = host.format;
  const module = device.createShaderModule({ label: "neural", code: WGSL });
  const bgl = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
  ] });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const pipe = (fs) => device.createRenderPipeline({ label: "neural " + fs, layout, vertex: { module, entryPoint: "vs" }, fragment: { module, entryPoint: fs, targets: [{ format }] }, primitive: { topology: "triangle-list" } });
  const pipes = { field: pipe("fsField"), solid: pipe("fsSolid") };
  const ubuf = device.createBuffer({ size: 160, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  let wbuf = null, wKey = null, bind = null;
  let lastMs = 0;

  function weights(net) {
    if (wKey === net) return;
    const data = packMlp(net.mlp);
    if (!wbuf || wbuf.size < data.byteLength) {
      if (wbuf) wbuf.destroy();
      wbuf = device.createBuffer({ size: Math.max(256, data.byteLength), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      bind = device.createBindGroup({ layout: bgl, entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: wbuf } }] });
    }
    device.queue.writeBuffer(wbuf, 0, data);
    wKey = net;
  }

  return {
    canvas, host, backend: "raw-native webgpu",
    /** Whether this drawer can run the given network (the default shapes only). */
    fits(instrument, net) {
      const shape = net && net.mlp && net.mlp.layers;
      return !!shape && sameShape(shape, instrument === "solid" ? SDF : CPPN);
    },
    /** Draw one frame into `canvas` at width x height. f = { instrument, net (the cppn or the sdf),
        time, tint, seedNum, mode: "full" | "grid" }. Returns the size of the image drawn. */
    draw(f, width, height) {
      const t0 = performance.now();
      const solid = f.instrument === "solid";
      const grid = f.mode === "grid";
      // The CPU path's own sampling, used for the grid mode and the solid's projection.
      const cell = Math.max(2, Math.round(Math.min(width, height) / 240));
      const RW = Math.min(150, Math.max(48, Math.round(width / 6)));
      const RH = Math.max(32, Math.round(RW * (height / Math.max(1, width))));
      const gx = solid ? RW : Math.ceil(width / cell), gy = solid ? RH : Math.ceil(height / cell);
      const W = grid ? gx : width, H = grid ? gy : height;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      weights(f.net);
      const U = new Float32Array(40);
      U.set([width, height, gx, gy, f.time, grid ? 1 : 0, f.net.fx || 0, f.net.fy || 0], 0);
      if (solid) {
        const yaw = -0.55 + ((f.seedNum % 1000) / 1000) * 1.1 + f.time * 0.25;
        const eye = [Math.sin(yaw) * 3, 0.85, Math.cos(yaw) * 3];
        let fx = -eye[0], fy = -eye[1], fz = -eye[2];
        const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
        let rx = -fz, ry = 0, rz = fx;
        const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
        const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
        const aspect = grid ? RW / RH : width / height;
        U.set([...eye, 0.72, fx, fy, fz, aspect, rx, ry, rz, f.net.freq, ux, uy, uz, f.net.amp], 8);
      }
      U.set([...f.tint[0], solid ? f.net.R : 0, ...f.tint[1], 0, ...f.tint[2], 0], 24);
      const acts = f.net.mlp.acts.map((a) => ACT[a]);
      U.set([acts[0] || 0, acts[1] || 0, acts[2] || 0, 0], 36);
      device.queue.writeBuffer(ubuf, 0, U);
      const enc = device.createCommandEncoder({ label: "neural frame" });
      const pass = enc.beginRenderPass({ colorAttachments: [{ view: host.context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      pass.setPipeline(solid ? pipes.solid : pipes.field);
      pass.setBindGroup(0, bind);
      pass.draw(3);
      pass.end();
      device.queue.submit([enc.finish()]);
      lastMs = performance.now() - t0;
      return { W, H, cell, RW, RH };
    },
    stats: () => ({ cpuMs: lastMs }),
  };
}
