// raw-native's web GPU host: WebGPU device, buffers, WGSL compute and render
// pipelines, the frame graph, per-pass GPU timing and canvas presentation, as
// one small ES module with no dependency. It is the RHI's object model
// (raw/rhi/rhi.hpp) on navigator.gpu; docs/architecture/adr/0010-web-host.md
// says why it is JavaScript and not the wasm build.
//
//   const host = await createHost({ canvas });      // throws HostUnavailable without WebGPU
//   const pipe = await host.compute("decay", wgsl);  // one pass of a //@pass file
//   const g = host.graph();                          // a FrameGraph on this device
//   g.addPass("decay", [[acc, Access.StorageWrite]], (c) => c.dispatch(pipe, [params, acc], x, y));
//   host.frame(g);                                   // one encoder, one submit
//   host.timings()                                   // { pass: ms } when the adapter has timestamps
//   const tex = host.texture({ width, height });     // a sampled, renderable RGBA8 texture
//   host.upload(tex, canvasOrImageOrBitmap);         // or a typed array of RGBA8 rows
//   const other = host.share({ canvas: c2 });        // a second consumer on the same device
import { FrameGraph, Access } from "./frame-graph.mjs";

export { FrameGraph, Access };
export const VERSION = "0.6.0";

export class HostUnavailable extends Error {}

// Split a WGSL file into its passes: the code before the first "//@pass name"
// marker is shared and goes in front of every pass, as scripts/wgsl_to_hlsl.py
// and src/renderer/gpu/shaders_wgsl.cpp do.
export function wgslPasses(text) {
  const parts = text.replace(/\r\n/g, "\n").split(/^\/\/@pass (\w+)[^\S\n]*\n/m);
  const common = parts[0];
  const out = {};
  for (let i = 1; i < parts.length; i += 2) out[parts[i]] = common + "\n" + parts[i + 1];
  return out;
}

const PRESENT_WGSL = `
struct Size { w: u32, h: u32, }
@group(0) @binding(0) var<uniform> S: Size;
@group(0) @binding(1) var<storage, read> frame: array<u32>;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
@fragment fn fs(@builtin(position) q: vec4f) -> @location(0) vec4f {
  let x = min(u32(q.x), S.w - 1u);
  let y = min(u32(q.y), S.h - 1u);
  return unpack4x8unorm(frame[y * S.w + x]);
}`;

// One count for the whole page, so a test can show two consumers share one device.
export const hostStats = { requestDevice: 0 };
const TEXTURE_USAGE = { "copy-src": 0x01, "copy-dst": 0x02, sampled: 0x04, storage: 0x08, render: 0x10 };

const USAGE = { storage: 0x80, uniform: 0x40, "copy-src": 0x04, "copy-dst": 0x08, "map-read": 0x01, vertex: 0x20, index: 0x10 };

export async function createHost({ canvas = null, powerPreference = "high-performance", timing = true } = {}) {
  const gpu = typeof navigator !== "undefined" && navigator.gpu;
  if (!gpu) throw new HostUnavailable("WebGPU is not available in this browser");
  // A software adapter (SwiftShader in headless Chrome on a CI runner) can answer null for
  // a moment after the browser starts; ask a few times before giving up.
  let adapter = null;
  for (let i = 0; i < 6 && !adapter; i++) {
    adapter = await gpu.requestAdapter({ powerPreference });
    if (!adapter && i < 5) await new Promise((r) => setTimeout(r, 250 * 2 ** i));
  }
  if (!adapter) throw new HostUnavailable("no WebGPU adapter");
  const canTime = timing && adapter.features.has("timestamp-query");
  hostStats.requestDevice++;
  const device = await adapter.requestDevice({
    requiredFeatures: canTime ? ["timestamp-query"] : [],
    requiredLimits: { maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      maxBufferSize: adapter.limits.maxBufferSize },
  });
  return new Host(adapter, device, canvas, canTime);
}

class Host {
  constructor(adapter, device, canvas, canTime) {
    this.adapter = adapter;
    this.device = device;
    this.info = adapter.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture,
      device: adapter.info.device, description: adapter.info.description } : {};
    this.limits = device.limits;
    this.lost = null;
    device.lost.then((e) => { this.lost = e.message || e.reason || "lost"; });
    this.canvas = canvas;
    this.context = null;
    this.format = null;
    if (canvas) this.attach(canvas);
    this.bindCache = new WeakMap();
    this.ids = new WeakMap();
    this.nextId = 1;
    this.timer = canTime ? new PassTimer(device) : null;
    this.cpuFrame = 0;
    this.present = null;
  }
  attach(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("webgpu");
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device: this.device, format: this.format, alphaMode: "opaque" });
    this.present = null;
  }
  // A buffer: usage is a list of names ("storage", "uniform", "copy-src", ...).
  buffer({ size, usage = ["storage"], label = "", data = null }) {
    let u = 0;
    for (const n of usage) u |= USAGE[n];
    const b = this.device.createBuffer({ size: Math.max(16, Math.ceil(size / 4) * 4), usage: u, label });
    if (data) this.device.queue.writeBuffer(b, 0, data);
    return b;
  }
  write(buffer, data, offset = 0) { this.device.queue.writeBuffer(buffer, offset, data); }
  // A texture: usage is a list of names ("sampled", "render", "copy-src", "copy-dst", "storage").
  texture({ width, height, format = "rgba8unorm", usage = ["sampled", "render", "copy-dst", "copy-src"], label = "" }) {
    let u = 0;
    for (const n of usage) u |= TEXTURE_USAGE[n];
    return this.device.createTexture({ label, size: [Math.max(1, width | 0), Math.max(1, height | 0)], format, usage: u });
  }
  // A sampler, cached by its settings: filter "linear" or "nearest", address "clamp" or "repeat".
  sampler({ filter = "linear", address = "clamp" } = {}) {
    const key = filter + "/" + address;
    this.samplers = this.samplers || new Map();
    if (!this.samplers.has(key)) {
      const a = address === "repeat" ? "repeat" : "clamp-to-edge";
      this.samplers.set(key, this.device.createSampler({ magFilter: filter, minFilter: filter, addressModeU: a, addressModeV: a }));
    }
    return this.samplers.get(key);
  }
  // Copy pixels into a texture: a canvas, image, ImageBitmap or VideoFrame (top-left origin),
  // or { data, width, height } with RGBA8 rows.
  upload(texture, src) {
    if (src && src.data && src.width) {
      this.device.queue.writeTexture({ texture }, src.data, { bytesPerRow: src.width * 4 }, [src.width, src.height]);
    } else {
      this.device.queue.copyExternalImageToTexture({ source: src }, { texture }, [texture.width, texture.height]);
    }
    return texture;
  }
  // A second consumer on this device: its own canvas, the same adapter and device, so
  // resources made by either can be used by both (one requestDevice for the page).
  share({ canvas = null } = {}) {
    const h = new Host(this.adapter, this.device, canvas, !!this.timer);
    h.parent = this;
    return h;
  }
  async compute(label, code) {
    const module = this.device.createShaderModule({ label, code });
    return this.device.createComputePipelineAsync({ label, layout: "auto", compute: { module, entryPoint: "main" } });
  }
  async render(label, code, { format = this.format, blend = null, topology = "triangle-list" } = {}) {
    const module = this.device.createShaderModule({ label, code });
    return this.device.createRenderPipelineAsync({ label, layout: "auto", primitive: { topology },
      vertex: { module, entryPoint: "vs" }, fragment: { module, entryPoint: "fs", targets: [{ format, blend: blend || undefined }] } });
  }
  #id(o) { let i = this.ids.get(o); if (!i) { i = this.nextId++; this.ids.set(o, i); } return i; }
  // Bind groups are cached per pipeline and buffer list, so a steady frame
  // creates none.
  bind(pipeline, buffers) {
    let m = this.bindCache.get(pipeline);
    if (!m) { m = new Map(); this.bindCache.set(pipeline, m); }
    const key = buffers.map((b) => this.#id(b)).join(",");
    let g = m.get(key);
    if (!g) {
      g = this.device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
        entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
      m.set(key, g);
    }
    return g;
  }
  graph() { return new FrameGraph({ createBuffer: (d) => this.buffer(d), destroyBuffer: (b) => b.destroy() }); }
  // Present a packed RGBA8 buffer (one u32 per pixel, row 0 at the top) on the canvas.
  async presenter() {
    if (!this.present) {
      const pipe = await this.render("present", PRESENT_WGSL);
      this.present = { pipe, size: this.buffer({ size: 16, usage: ["uniform", "copy-dst"], label: "present size" }), w: 0, h: 0 };
    }
    return this.present;
  }
  // Run one frame of a compiled graph: one command encoder, one submit.
  frame(g) {
    const enc = this.device.createCommandEncoder();
    const ctx = new PassContext(this, enc);
    for (const s of (g.compiled ? g.plan : g.compile())) {
      ctx.name = g.passes[s.pass].name;
      g.passes[s.pass].fn(ctx, g);
      if (this.timer) ctx.endPass();
    }
    ctx.endPass();
    if (this.timer) this.timer.resolve(enc, ctx.timed);
    this.device.queue.submit([enc.finish()]);
    if (this.timer) this.timer.collect();
    this.cpuFrame++;
  }
  timings() { return this.timer ? this.timer.read() : null; }
  // Resolves when every submitted frame has finished on the GPU.
  done() { return this.device.queue.onSubmittedWorkDone(); }
  // A shared consumer lets go of its canvas only; the device belongs to the host that made it.
  destroy() { try { this.context && this.context.unconfigure(); } catch (_) {} if (!this.parent) this.device.destroy(); }
}

// What a pass records with. Consecutive dispatches share one compute pass
// unless the host times passes, when each graph pass gets its own.
class PassContext {
  constructor(host, enc) { this.host = host; this.enc = enc; this.cpass = null; this.timed = []; this.name = ""; }
  #writes() {
    const t = this.host.timer;
    if (!t || this.timed.length >= t.capacity) return undefined;
    const i = this.timed.length;
    this.timed.push(this.name);
    return { querySet: t.set, beginningOfPassWriteIndex: 2 * i, endOfPassWriteIndex: 2 * i + 1 };
  }
  dispatch(pipeline, buffers, x, y = 1, z = 1) {
    if (!this.cpass) this.cpass = this.enc.beginComputePass({ label: this.name, timestampWrites: this.#writes() });
    this.cpass.setPipeline(pipeline);
    this.cpass.setBindGroup(0, this.host.bind(pipeline, buffers));
    this.cpass.dispatchWorkgroups(x, y, z);
  }
  endPass() { if (this.cpass) { this.cpass.end(); this.cpass = null; } }
  clear(buffer) { this.endPass(); this.enc.clearBuffer(buffer); }
  copy(src, dst, size, srcOffset = 0, dstOffset = 0) { this.endPass(); this.enc.copyBufferToBuffer(src, srcOffset, dst, dstOffset, size); }
  // Draw the packed frame buffer onto the attached canvas.
  presentFrame(frameBuffer, w, h) {
    this.endPass();
    const host = this.host, p = host.present;
    if (!p) throw new Error("raw-gpu: await host.presenter() before presenting");
    if (p.w !== w || p.h !== h) { host.write(p.size, new Uint32Array([w, h, 0, 0])); p.w = w; p.h = h; }
    const rp = this.enc.beginRenderPass({ label: "present", timestampWrites: this.#writes(),
      colorAttachments: [{ view: host.context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
    rp.setPipeline(p.pipe);
    rp.setBindGroup(0, host.bind(p.pipe, [p.size, frameBuffer]));
    rp.draw(3);
    rp.end();
  }
}

// GPU time per pass from timestamp queries, averaged over the last frames.
// Readback buffers rotate, so reading never stalls a frame.
class PassTimer {
  constructor(device) {
    this.device = device;
    this.capacity = 32;
    this.set = device.createQuerySet({ type: "timestamp", count: 2 * this.capacity });
    this.resolveBuf = device.createBuffer({ size: 16 * this.capacity, usage: 0x200 | 0x04 });   // QUERY_RESOLVE | COPY_SRC
    this.ring = [0, 1, 2].map(() => ({ buf: device.createBuffer({ size: 16 * this.capacity, usage: 0x01 | 0x08 }), busy: false, names: null }));
    this.pending = null;
    this.avg = {};
  }
  resolve(enc, names) {
    if (!names.length) return;
    const slot = this.ring.find((r) => !r.busy);
    if (!slot) return;
    enc.resolveQuerySet(this.set, 0, 2 * names.length, this.resolveBuf, 0);
    enc.copyBufferToBuffer(this.resolveBuf, 0, slot.buf, 0, 16 * names.length);
    slot.busy = true; slot.names = names.slice();
    this.pending = slot;
  }
  collect() {
    const slot = this.pending;
    if (!slot) return;
    this.pending = null;
    slot.buf.mapAsync(1).then(() => {
      const t = new BigUint64Array(slot.buf.getMappedRange(0, 16 * slot.names.length));
      const sum = {};
      slot.names.forEach((n, i) => { const ms = Number(t[2 * i + 1] - t[2 * i]) / 1e6; if (ms >= 0 && ms < 1e3) sum[n] = (sum[n] || 0) + ms; });
      for (const [n, ms] of Object.entries(sum)) this.avg[n] = this.avg[n] === undefined ? ms : this.avg[n] * 0.9 + ms * 0.1;
      slot.buf.unmap(); slot.busy = false;
    }).catch(() => { slot.busy = false; });
  }
  read() {
    const out = { ...this.avg };
    out.total = Object.values(this.avg).reduce((a, b) => a + b, 0);
    return out;
  }
}
