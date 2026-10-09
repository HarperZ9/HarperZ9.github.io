// The Motion renderer on the raw-native web host: vector paths, GPU particles,
// the Threads and Worlds layers, bloom and the finish, one command buffer per
// frame. It draws a display list (scene.mjs) at any size; capture() returns the
// frame's pixels for offline video.
//
//   const host = await createHost({ canvas });
//   const mo = await createMotion(host);
//   mo.resize(1920, 1080);
//   mo.draw(list, { frame: 0 });                 // to the canvas
//   const rgba = await mo.capture(list, { frame: 0 });   // to memory, RGBA8 rows
import { compile, DEFAULT_CAMERA } from "./vector.mjs";
import { VECTOR_WGSL, PARTICLE_WGSL, SPRITE_WGSL, LAYER_BUFFER_WGSL, LAYER_TEXTURE_WGSL, POST_WGSL } from "./shaders.mjs";
import { ParticleSystem } from "./particles.mjs";

const HDR = "rgba16float";
const OVER = { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" } };
const ADD = { color: { srcFactor: "one", dstFactor: "one", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one", operation: "add" } };
const TEX = { RENDER: 0x10, BIND: 0x04, COPY_SRC: 0x01 };

export async function createMotion(host, { design = [1920, 1080] } = {}) {
  const m = new Motion(host, design);
  await m.init();
  return m;
}

class Motion {
  constructor(host, design) {
    this.host = host; this.device = host.device; this.design = design;
    this.w = 0; this.h = 0; this.cpuOut = null; this.gpu = {};
    this.stats = null; this.threads = null; this.worlds = null;
  }
  async init() {
    const d = this.device, mod = (code, label) => d.createShaderModule({ code, label });
    const rp = (label, code, fs, format, blend, topology = "triangle-strip") => {
      const module = mod(code, label);
      return d.createRenderPipelineAsync({ label, layout: "auto", primitive: { topology },
        vertex: { module, entryPoint: "vs" }, fragment: { module, entryPoint: fs, targets: [{ format, blend }] } });
    };
    const post = (fs, format) => rp("motion " + fs, POST_WGSL, fs, format, undefined, "triangle-list");
    const outFormat = this.host.format || "rgba8unorm";
    [this.vecOver, this.vecAdd, this.spriteAdd, this.spriteOver, this.layerBuf, this.layerTex, this.bright, this.blurx, this.blury,
      this.finishCanvas, this.finishCapture, this.partPipe] = await Promise.all([
      rp("motion vector over", VECTOR_WGSL, "fs", HDR, OVER), rp("motion vector add", VECTOR_WGSL, "fs", HDR, ADD),
      rp("motion sprite add", SPRITE_WGSL, "fs", HDR, ADD), rp("motion sprite over", SPRITE_WGSL, "fs", HDR, OVER),
      rp("motion layer buffer", LAYER_BUFFER_WGSL, "fs", HDR, OVER, "triangle-list"),
      rp("motion layer texture", LAYER_TEXTURE_WGSL, "fs", HDR, OVER, "triangle-list"),
      post("bright", HDR), post("blurx", HDR), post("blury", HDR), post("finish", outFormat), post("finish", "rgba8unorm"),
      d.createComputePipelineAsync({ label: "motion particles", layout: "auto", compute: { module: mod(PARTICLE_WGSL, "particles"), entryPoint: "main" } }),
    ]);
    this.outFormat = outFormat;
    this.view = this.host.buffer({ size: 32, usage: ["uniform", "copy-dst"], label: "motion view" });
    this.postU = [0, 1, 2, 3].map((i) => this.host.buffer({ size: 32, usage: ["uniform", "copy-dst"], label: "motion post " + i }));
    this.layerU = [0, 1, 2, 3].map((i) => this.host.buffer({ size: 48, usage: ["uniform", "copy-dst"], label: "motion layer " + i }));
    this.sampler = d.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
  }
  // Make a particle system from formations (particles.mjs).
  particles(spec) { return new ParticleSystem(this, spec); }
  // Optional layers: a Threads instance made with { present: false }, a Worlds instance.
  useThreads(th) { this.threads = th; }
  useWorlds(w) { this.worlds = w; }
  resize(w, h) {
    w = Math.max(16, w | 0); h = Math.max(16, h | 0);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    const d = this.device, tex = (label, W, H, format, usage) => d.createTexture({ label, size: [W, H], format, usage });
    for (const t of [this.accum, this.glowA, this.glowB, this.capTex, this.worldTex]) if (t) t.destroy();
    this.accum = tex("motion accum", w, h, HDR, TEX.RENDER | TEX.BIND);
    const qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    this.glowA = tex("motion glow a", qw, qh, HDR, TEX.RENDER | TEX.BIND);
    this.glowB = tex("motion glow b", qw, qh, HDR, TEX.RENDER | TEX.BIND);
    this.capTex = null; this.worldTex = null; this.postBind = null;
    if (this.host.canvas) { this.host.canvas.width = w; this.host.canvas.height = h; }
  }
  #ensure(name, bytes, usage = ["storage", "copy-dst"]) {
    const g = this.gpu[name];
    if (g && g.size >= bytes) return g;
    if (g) g.destroy();
    return (this.gpu[name] = this.host.buffer({ size: Math.max(1024, Math.ceil(bytes * 1.5)), usage, label: "motion " + name }));
  }
  #postBinds() {
    if (this.postBind) return this.postBind;
    const d = this.device, b = (pipe, u, src, glow) => d.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: u } }, { binding: 1, resource: src.createView() }, { binding: 2, resource: this.sampler },
      ...(glow ? [{ binding: 3, resource: glow.createView() }] : [])] });
    this.postBind = {
      bright: b(this.bright, this.postU[0], this.accum), blurx: b(this.blurx, this.postU[1], this.glowA), blury: b(this.blury, this.postU[2], this.glowB),
      finishCanvas: b(this.finishCanvas, this.postU[3], this.accum, this.glowA), finishCapture: b(this.finishCapture, this.postU[3], this.accum, this.glowA),
    };
    return this.postBind;
  }
  #worldTexture() {
    if (!this.worldTex) {
      this.worldTex = this.device.createTexture({ label: "motion world", size: [this.w, this.h], format: this.host.format || "bgra8unorm", usage: TEX.RENDER | TEX.BIND });
      this.worldBind = null;
    }
    return this.worldTex;
  }
  // Record and submit one frame; target is a texture view in the finish format.
  #frame(list, { frame = 0, time = 0 }, target, capture) {
    const d = this.device, W = this.w, H = this.h, host = this.host;
    const cam = { ...DEFAULT_CAMERA, ...(list.camera || {}) };
    const t0 = performance.now();
    const c = compile(list.items || [], cam, W, H, this.design, this.cpuOut);
    this.cpuOut = c.out;
    const vw = new Float32Array([W, H, 1 / W, 1 / H, time, frame, 0, 0]);
    host.write(this.view, vw);
    const inst = this.#ensure("inst", c.inst.byteLength), segs = this.#ensure("segs", c.segs.byteLength), idx = this.#ensure("idx", c.idx.byteLength);
    if (c.inst.byteLength) host.write(inst, c.inst);
    if (c.segs.byteLength) host.write(segs, c.segs);
    if (c.idx.byteLength) host.write(idx, c.idx);
    // Layers that render with their own submits go first.
    let li = 0;
    for (const r of c.runs) {
      if (r.kind === "threads" && this.threads) this.threads.frame(r.item.dt ?? 1 / 30);
      if (r.kind === "world" && this.worlds) this.#drawWorld(r.item, W, H);
    }
    const enc = d.createCommandEncoder({ label: "motion frame" });
    const timed = [], tw = (name) => {
      const t = host.timer;
      if (!t || timed.length >= t.capacity) return undefined;
      timed.push(name);
      return { querySet: t.set, beginningOfPassWriteIndex: 2 * timed.length - 2, endOfPassWriteIndex: 2 * timed.length - 1 };
    };
    const systems = c.runs.filter((r) => r.kind === "particles");
    if (systems.length) {
      const cp = enc.beginComputePass({ label: "particles", timestampWrites: tw("particles") });
      for (const r of systems) r.item.system.dispatch(cp, r.item, cam, W, H);
      cp.end();
    }
    const bg = list.background || [0.024, 0.024, 0.031];
    const rp = enc.beginRenderPass({ label: "motion draw", timestampWrites: tw("draw"),
      colorAttachments: [{ view: this.accum.createView(), loadOp: "clear", storeOp: "store", clearValue: [bg[0], bg[1], bg[2], 1] }] });
    for (const r of c.runs) {
      if (r.kind === "vector") {
        const pipe = r.blend === "add" ? this.vecAdd : this.vecOver;
        rp.setPipeline(pipe);
        rp.setBindGroup(0, host.bind(pipe, [this.view, inst, segs, idx]));
        rp.draw(4, r.count, 0, r.first);
      } else if (r.kind === "particles") {
        r.item.system.draw(rp, r.item.blend === "over" ? this.spriteOver : this.spriteAdd, this.view);
      } else if (r.kind === "threads" && this.threads && this.threads.frameBuf) {
        const u = this.layerU[li++ % 4], th = this.threads;
        host.write(u, new Float32Array([W, H, 0, 0, th.w, th.h, 0, 0, r.item.opacity ?? 1, 0, 0, 0]));
        rp.setPipeline(this.layerBuf);
        rp.setBindGroup(0, host.bind(this.layerBuf, [u, th.frameBuf]));
        rp.draw(3);
      } else if (r.kind === "world" && this.worldTex) {
        const u = this.layerU[li++ % 4];
        host.write(u, new Float32Array([W, H, 0, 0, W, H, 0, 0, r.item.opacity ?? 1, (r.item.blur || 0) * W / this.design[0], 0, 0]));
        if (!this.worldBind || this.worldBind.u !== u) this.worldBind = { u, g: d.createBindGroup({ layout: this.layerTex.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: u } }, { binding: 1, resource: this.worldTex.createView() }, { binding: 2, resource: this.sampler }] }) };
        rp.setPipeline(this.layerTex);
        rp.setBindGroup(0, this.worldBind.g);
        rp.draw(3);
      }
    }
    rp.end();
    // Bloom at quarter size, then the finish.
    const post = { bloom: 0.45, threshold: 0.8, vignette: 0.35, grain: 0.01, ...(list.post || {}) };
    const qw = Math.max(1, W >> 2), qh = Math.max(1, H >> 2);
    host.write(this.postU[0], new Float32Array([qw, qh, W, H, post.threshold, 0, 0, 0]));
    host.write(this.postU[1], new Float32Array([qw, qh, qw, qh, 0, 0, 0, 0]));
    host.write(this.postU[2], new Float32Array([qw, qh, qw, qh, 0, 0, 0, 0]));
    host.write(this.postU[3], new Float32Array([W, H, W, H, post.bloom, post.vignette, post.grain, frame % 4096]));
    const pb = this.#postBinds();
    const full = (view, pipe, bind, name, load = "clear") => {
      const p = enc.beginRenderPass({ label: name, timestampWrites: name ? tw(name) : undefined, colorAttachments: [{ view, loadOp: load, storeOp: "store", clearValue: [0, 0, 0, 1] }] });
      p.setPipeline(pipe); p.setBindGroup(0, bind); p.draw(3); p.end();
    };
    full(this.glowA.createView(), this.bright, pb.bright, "bloom");
    full(this.glowB.createView(), this.blurx, pb.blurx, null);
    full(this.glowA.createView(), this.blury, pb.blury, null);
    full(target, capture ? this.finishCapture : this.finishCanvas, capture ? pb.finishCapture : pb.finishCanvas, "finish");
    let read = null;
    if (capture) {
      const bpr = Math.ceil((W * 4) / 256) * 256;
      read = this.#ensure("readback", bpr * H, ["map-read", "copy-dst"]);
      enc.copyTextureToBuffer({ texture: this.capTex }, { buffer: read, bytesPerRow: bpr }, [W, H]);
      read = { buf: read, bpr };
    }
    if (host.timer) host.timer.resolve(enc, timed);
    d.queue.submit([enc.finish()]);
    if (host.timer) host.timer.collect();
    this.stats = { ...c.stats, cpuMs: performance.now() - t0 };
    return read;
  }
  #drawWorld(item, W, H) {
    const wo = this.worlds;
    if (!wo.pipe) return;
    if (item.id && item.id !== wo.current) { wo.set({ world: item.id }); return; }
    const cm = item.camera || {};
    for (const k of ["distance", "yaw", "pitch"]) if (cm[k] !== undefined) wo.cam[k] = cm[k];
    if (cm.target) wo.cam.target = [...cm.target];
    if (item.time !== undefined) wo.time = item.time;
    if (item.quality !== undefined) wo.opts.quality = item.quality;
    wo.resize(W, H);
    wo.frame(0, { target: { view: this.#worldTexture().createView(), width: W, height: H } });
  }
  // Draw to the attached canvas.
  draw(list, opts = {}) {
    this.#frame(list, opts, this.host.context.getCurrentTexture().createView(), false);
  }
  // Draw off screen and return { width, height, data: Uint8Array RGBA rows }.
  async capture(list, opts = {}) {
    if (!this.capTex) this.capTex = this.device.createTexture({ label: "motion capture", size: [this.w, this.h], format: "rgba8unorm", usage: TEX.RENDER | TEX.COPY_SRC });
    const r = this.#frame(list, opts, this.capTex.createView(), true);
    await r.buf.mapAsync(1);
    const src = new Uint8Array(r.buf.getMappedRange()), W = this.w, H = this.h, row = W * 4;
    const data = new Uint8Array(row * H);
    if (r.bpr === row) data.set(src.subarray(0, row * H));
    else for (let y = 0; y < H; y++) data.set(src.subarray(y * r.bpr, y * r.bpr + row), y * row);
    r.buf.unmap();
    return { width: W, height: H, data };
  }
  timings() { return this.host.timings(); }
  destroy() {
    for (const b of Object.values(this.gpu)) b.destroy();
    for (const t of [this.accum, this.glowA, this.glowB, this.capTex, this.worldTex]) if (t) t.destroy();
  }
}
