// ndim-gpu.js: Dimensions drawn by raw-native's web GPU host (10 October 2026), the first Studio
// tool moved onto raw-native. It draws the same volumetric scene render-nd builds (translucent
// faces, edges, vertices, each in NDC with a depth) and keeps the WebGL backend's look: the --void
// ground, faces blended over with depth writes off, edges and vertices added on with the depth
// test on. What it adds: 4x multisampling, and edges drawn as true anti-aliased lines at their
// stated width (WebGL lines are one pixel wide on most systems, whatever width is asked for).
//
// Fallbacks, so no browser loses the tool: without WebGPU, or if the host cannot start, the
// Studio keeps drawing with the WebGL backend, and without WebGL with the 2D canvas.

const RAW = new URL("../media/raw-native/web-4edf976/", import.meta.url).href;
const SAMPLES = 4;
const VOID = [0.051, 0.106, 0.110, 1];   // --void (#0d1b1c), as the WebGL backend clears

const WGSL = /* wgsl */ `
struct U { size: vec2f, lineW: f32, pad: f32, }
@group(0) @binding(0) var<uniform> u: U;

struct FO { @builtin(position) p: vec4f, @location(0) c: vec4f, }
@vertex fn vsFace(@location(0) xy: vec2f, @location(1) d: f32, @location(2) c: vec4f) -> FO {
  var o: FO; o.p = vec4f(xy, d, 1.0); o.c = c; return o;
}
@fragment fn fsFace(i: FO) -> @location(0) vec4f { return i.c; }

// One quad per edge, from x1y1 to x2y2, widened by the line width in pixels. v.x runs along the
// edge, v.y across it in pixels, so the fragment can fade the last pixel for a clean edge.
struct LO { @builtin(position) p: vec4f, @location(0) c: vec4f, @location(1) across: f32, }
@vertex fn vsLine(@builtin(vertex_index) vi: u32, @location(0) a: vec2f, @location(1) b: vec2f,
                  @location(2) d: f32, @location(3) c: vec4f) -> LO {
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u) * 2.0 - 1.0);
  let pa = (a * 0.5 + 0.5) * u.size; let pb = (b * 0.5 + 0.5) * u.size;
  var dir = pb - pa; let len = length(dir);
  if (len < 1e-4) { dir = vec2f(1.0, 0.0); } else { dir = dir / len; }
  let n = vec2f(-dir.y, dir.x);
  let half = u.lineW * 0.5 + 1.0;
  let px = mix(pa - dir * 0.5, pb + dir * 0.5, corner.x) + n * corner.y * half;
  var o: LO;
  o.p = vec4f(px / u.size * 2.0 - 1.0, d, 1.0);
  o.c = c; o.across = corner.y * half;
  return o;
}
@fragment fn fsLine(i: LO) -> @location(0) vec4f {
  let edge = clamp(u.lineW * 0.5 + 0.5 - abs(i.across), 0.0, 1.0);
  return vec4f(i.c.rgb * edge, i.c.a * edge);
}

// One quad per vertex, size in pixels, with the WebGL backend's soft round falloff.
struct PO { @builtin(position) p: vec4f, @location(0) c: vec4f, @location(1) uv: vec2f, }
@vertex fn vsPoint(@builtin(vertex_index) vi: u32, @location(0) xy: vec2f, @location(1) d: f32,
                   @location(2) c: vec4f, @location(3) size: f32) -> PO {
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) - 0.5;
  let px = (xy * 0.5 + 0.5) * u.size + corner * size;
  var o: PO; o.p = vec4f(px / u.size * 2.0 - 1.0, d, 1.0); o.c = c; o.uv = corner; return o;
}
@fragment fn fsPoint(i: PO) -> @location(0) vec4f {
  let dd = length(i.uv);
  if (dd > 0.5) { discard; }
  let a = i.c.a * (1.0 - smoothstep(0.25, 0.5, dd));
  return vec4f(i.c.rgb, a);
}`;

const OVER = { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" } };
const ADD = { color: { srcFactor: "src-alpha", dstFactor: "one", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one", operation: "add" } };
const f4 = (n) => n * 4;

/** createNDimGPU() -> a drawer, or null when this browser has no usable WebGPU. */
export async function createNDimGPU() {
  if (typeof navigator === "undefined" || !navigator.gpu) return null;
  let gpu;
  try {
    gpu = await import(RAW + "raw-gpu.mjs");
  } catch (e) { console.error("[ndim-gpu] the raw-native host failed to load:", e); return null; }
  const canvas = document.createElement("canvas");
  canvas.width = 2; canvas.height = 2;
  let host;
  try { host = await gpu.createHost({ canvas, timing: true }); }
  catch (e) { if (!(e instanceof gpu.HostUnavailable)) console.error("[ndim-gpu] no WebGPU host:", e); return null; }
  const device = host.device, format = host.format;
  const module = device.createShaderModule({ label: "ndim", code: WGSL });
  const depthStencil = (write) => ({ format: "depth24plus", depthWriteEnabled: write, depthCompare: "less-equal" });
  const ms = { count: SAMPLES };
  const bgl = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} }] });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const pipe = (vs, fs, buffers, blend, write, topology) => device.createRenderPipeline({
    label: "ndim " + vs, layout, multisample: ms, depthStencil: depthStencil(write), primitive: { topology },
    vertex: { module, entryPoint: vs, buffers }, fragment: { module, entryPoint: fs, targets: [{ format, blend }] },
  });
  const attr = (loc, off, n) => ({ shaderLocation: loc, offset: f4(off), format: n === 1 ? "float32" : `float32x${n}` });
  const faces = pipe("vsFace", "fsFace", [{ arrayStride: f4(7), attributes: [attr(0, 0, 2), attr(1, 2, 1), attr(2, 3, 4)] }], OVER, false, "triangle-list");
  const lines = pipe("vsLine", "fsLine", [{ arrayStride: f4(9), stepMode: "instance", attributes: [attr(0, 0, 2), attr(1, 2, 2), attr(2, 4, 1), attr(3, 5, 4)] }], ADD, true, "triangle-strip");
  const points = pipe("vsPoint", "fsPoint", [{ arrayStride: f4(8), stepMode: "instance", attributes: [attr(0, 0, 2), attr(1, 2, 1), attr(2, 3, 4), attr(3, 7, 1)] }], ADD, true, "triangle-strip");
  const ubuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({ layout: bgl, entries: [{ binding: 0, resource: { buffer: ubuf } }] });
  let msaa = null, depth = null, w = 0, h = 0;
  const bufs = {};
  const upload = (key, data) => {
    if (!data.length) return null;
    let b = bufs[key];
    if (!b || b.size < data.byteLength) { if (b) b.destroy(); b = bufs[key] = device.createBuffer({ size: Math.max(256, data.byteLength * 2), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }); }
    device.queue.writeBuffer(b, 0, data);
    return b;
  };
  const toDepth = (d) => Math.min(1, Math.max(0, d));
  let lastMs = 0;

  return {
    canvas, host, backend: "raw-native webgpu",
    /** Draw one volumetric scene at width x height; then copy `canvas` onto the stage in this task. */
    draw(scene, width, height, lineW) {
      const t0 = performance.now();
      if (width !== w || height !== h) {
        w = width; h = height; canvas.width = w; canvas.height = h;
        if (msaa) msaa.destroy(); if (depth) depth.destroy();
        msaa = device.createTexture({ size: [w, h], format, sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
        depth = device.createTexture({ size: [w, h], format: "depth24plus", sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
      }
      device.queue.writeBuffer(ubuf, 0, new Float32Array([w, h, lineW, 0]));
      const fd = new Float32Array((scene.faces || []).length * 21);
      let i = 0;
      for (const f of scene.faces || []) {
        const r = f.color[0] / 255, g = f.color[1] / 255, b = f.color[2] / 255, a = f.opacity, d = toDepth(f.depth);
        for (const [x, y] of [[f.x1, f.y1], [f.x2, f.y2], [f.x3, f.y3]]) { fd[i++] = x; fd[i++] = y; fd[i++] = d; fd[i++] = r; fd[i++] = g; fd[i++] = b; fd[i++] = a; }
      }
      const ld = new Float32Array((scene.segments || []).length * 9);
      i = 0;
      for (const s of scene.segments || []) {
        const o = s.opacity;
        ld[i++] = s.x1; ld[i++] = s.y1; ld[i++] = s.x2; ld[i++] = s.y2; ld[i++] = toDepth(s.depth);
        ld[i++] = s.color[0] / 255 * o; ld[i++] = s.color[1] / 255 * o; ld[i++] = s.color[2] / 255 * o; ld[i++] = o;
      }
      const pd = new Float32Array((scene.points || []).length * 8);
      i = 0;
      for (const p of scene.points || []) {
        const o = p.opacity;
        pd[i++] = p.x; pd[i++] = p.y; pd[i++] = toDepth(p.depth);
        pd[i++] = p.color[0] / 255 * o; pd[i++] = p.color[1] / 255 * o; pd[i++] = p.color[2] / 255 * o; pd[i++] = o; pd[i++] = p.size;
      }
      const fb = upload("f", fd), lb = upload("l", ld), pb = upload("p", pd);
      const enc = device.createCommandEncoder({ label: "ndim frame" });
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: msaa.createView(), resolveTarget: host.context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "discard", clearValue: { r: VOID[0], g: VOID[1], b: VOID[2], a: 1 } }],
        depthStencilAttachment: { view: depth.createView(), depthLoadOp: "clear", depthClearValue: 1, depthStoreOp: "discard" },
      });
      pass.setBindGroup(0, bind);
      if (fb) { pass.setPipeline(faces); pass.setVertexBuffer(0, fb); pass.draw(fd.length / 7); }
      if (lb) { pass.setPipeline(lines); pass.setVertexBuffer(0, lb); pass.draw(4, ld.length / 9); }
      if (pb) { pass.setPipeline(points); pass.setVertexBuffer(0, pb); pass.draw(4, pd.length / 8); }
      pass.end();
      device.queue.submit([enc.finish()]);
      lastMs = performance.now() - t0;
      return { cpuMs: lastMs };
    },
    stats: () => ({ cpuMs: lastMs }),
  };
}
