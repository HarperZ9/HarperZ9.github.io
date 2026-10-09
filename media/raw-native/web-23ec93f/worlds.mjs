// Worlds on the web host: the One Step worlds as raymarched dioramas you can
// walk around. The scenes are src/renderer/gpu/shaders/worlds.wgsl; the camera
// is web/camera.mjs.
//
//   const host = await createHost({ canvas });
//   const w = await createWorlds(host, { wgsl, world: "eye" });
//   w.resize(1280, 720); w.set({ quality: 0.75 });
//   requestAnimationFrame(function loop() { w.frame(1 / 60); requestAnimationFrame(loop); });
import { OrbitCamera } from "./camera.mjs";

// Each world: shader section, title, and where the camera starts.
export const WORLDS = Object.freeze([
  { id: "komorebi", title: "I. Komorebi", home: { target: [0, 0.8, 0], distance: 4.4, yaw: 0.5, pitch: 0.12 } },
  { id: "droste", title: "II. Droste", home: { target: [0, 1.2, -0.3], distance: 3.8, yaw: 0.35, pitch: 0.12 } },
  { id: "voices", title: "III. Two voices", home: { target: [0, 1.1, 0], distance: 3.4, yaw: 0.25, pitch: 0.15 } },
  { id: "morphogen", title: "IV. Morphogen", home: { target: [0, 0.8, 0], distance: 3.4, yaw: 0.6, pitch: 0.3 } },
  { id: "making", title: "V. The making", home: { target: [0, 0.8, 0], distance: 4.4, yaw: 0.4, pitch: 0.3 } },
  { id: "eye", title: "VI. The eye", home: { target: [0, 1.15, 0], distance: 4.6, yaw: 0.35, pitch: 0.12 } },
  { id: "strings", title: "VII. The strings", home: { target: [0, 1.0, 0], distance: 3.6, yaw: 0.3, pitch: 0.15 } },
  { id: "stream", title: "VIII. The stream", home: { target: [0, 1.0, 0], distance: 4.4, yaw: 0.5, pitch: 0.2 } },
  { id: "belly", title: "IX. The belly", home: { target: [0, 0.6, 0.3], distance: 3.0, yaw: 0.2, pitch: 0.15 } },
  { id: "draw", title: "X. The draw", home: { target: [0, 1.0, 0], distance: 4.0, yaw: 0.5, pitch: 0.25 } },
  { id: "elements", title: "XI. The elements", home: { target: [0, 0.7, 0], distance: 4.6, yaw: 0.3, pitch: 0.35 } },
  { id: "burden", title: "XII. The burden", home: { target: [0, 0.6, 0], distance: 4.6, yaw: 0.0, pitch: 0.18 } },
  { id: "swing", title: "XIII. The swing", home: { target: [0.3, 1.1, 0], distance: 5.4, yaw: 0.75, pitch: 0.22 } },
  { id: "forest", title: "XIV. The forest", home: { target: [0, 0.5, 0], distance: 3.3, yaw: 0.45, pitch: 0.28 } },
  { id: "many", title: "XV. The many", home: { target: [0, 1.2, 0], distance: 4.6, yaw: 0.6, pitch: 0.25 } },
]);

// Quality 0..1 sets the render scale, march steps, shadow steps and AO.
export function qualitySettings(q) {
  q = Math.min(1, Math.max(0, q));
  return { scale: 0.45 + 0.55 * q, steps: Math.round(64 + 96 * q), shadowSteps: Math.round(12 + 36 * q), ao: q > 0.2 };
}
export const DEFAULTS = Object.freeze({ world: "eye", quality: 0.6, light: 1, fog: 1, motion: 1, growth: 0, tour: true, playing: true,
  threads: false, threadCount: 65536, threadPersistence: 0.9, threadGain: 1 });

// Split worlds.wgsl into { prelude, worlds: { id: code }, main }.
export function worldSources(text) {
  const parts = text.replace(/\r\n/g, "\n").split(/^\/\/@(world \w+|threads|main)[^\S\n]*\n/m);
  const out = { prelude: parts[0], worlds: {}, main: "", threads: "" };
  for (let i = 1; i < parts.length; i += 2) {
    if (parts[i] === "main") out.main = parts[i + 1];
    else if (parts[i] === "threads") out.threads = parts[i + 1];
    else out.worlds[parts[i].slice(6)] = parts[i + 1];
  }
  return out;
}

export async function createWorlds(host, { wgsl, world = DEFAULTS.world }) {
  const w = new Worlds(host, worldSources(wgsl));
  await w.load(world);
  return w;
}

// Adds the light-thread glow (fixed point, 256 per unit) onto the frame.
const GLOW_WGSL = `
struct Uni { eye: vec4f, fwd: vec4f, right: vec4f, up: vec4f, res: vec4f, time: f32, steps: f32, shadowSteps: f32, aoOn: f32,
  pick: vec4f, params: vec4f, extra: vec4f, }
@group(0) @binding(0) var<uniform> U: Uni;
@group(0) @binding(1) var<storage, read> glow: array<u32>;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
@fragment fn fs(@builtin(position) q: vec4f) -> @location(0) vec4f {
  let k = (u32(q.y) * u32(U.res.x) + u32(q.x)) * 3u;
  let c = vec3f(f32(glow[k]), f32(glow[k + 1u]), f32(glow[k + 2u])) / 256.0 * U.extra.y * 0.35;
  return vec4f(1.0 - exp(-c), 0.0);
}`;

class Worlds {
  constructor(host, src) {
    this.host = host; this.src = src;
    this.opts = { ...DEFAULTS };
    this.cam = new OrbitCamera();
    this.uni = new Float32Array(40);
    this.ubuf = host.buffer({ size: 160, usage: ["uniform", "copy-dst"], label: "worlds uniforms" });
    this.tpipes = new Map();      // world -> { advance, decay } for the light-thread layer
    this.depth = null; this.glow = null; this.parts = null; this.sized = [0, 0];
    this.pickBuf = host.buffer({ size: 16, usage: ["storage", "copy-src", "copy-dst"], label: "worlds pick" });
    this.pickRead = host.buffer({ size: 16, usage: ["map-read", "copy-dst"], label: "worlds pick read" });
    this.pipes = new Map();
    this.time = 0; this.w = 0; this.h = 0;
    this.pick = null; this.picking = false;
  }
  info(id) { return WORLDS.find((x) => x.id === id) || WORLDS[0]; }
  async pipeline(id) {
    if (!this.pipes.has(id)) {
      const code = this.src.prelude + "\n" + this.src.worlds[id] + "\n" + this.src.main;
      this.pipes.set(id, this.host.render("world " + id, code));
    }
    return this.pipes.get(id);
  }
  // The light-thread layer's compute pipelines for a world (compiled on demand, kept).
  threadPipes(id) {
    if (!this.tpipes.has(id)) {
      const dev = this.host.device;
      const module = dev.createShaderModule({ label: "threads " + id, code: this.src.prelude + "\n" + this.src.worlds[id] + "\n" + this.src.threads });
      this.tpipes.set(id, Promise.all([
        dev.createComputePipelineAsync({ label: "threads advance " + id, layout: "auto", compute: { module, entryPoint: "advance" } }),
        dev.createComputePipelineAsync({ label: "threads decay " + id, layout: "auto", compute: { module, entryPoint: "decay" } }),
      ]).then(([advance, decay]) => ({ advance, decay })));
      this.tpipes.get(id).then((p) => { if (this.opts.world === id) { this.tp = p; this.tbind = null; } }).catch((e) => { this.error = String(e); });
    } else {
      this.tpipes.get(id).then((p) => { if (this.opts.world === id) { this.tp = p; this.tbind = null; } }).catch(() => {});
    }
    return this.tpipes.get(id);
  }
  #sizeBuffers(rw, rh) {
    if (this.sized[0] === rw && this.sized[1] === rh) return;
    for (const b of [this.depth, this.glow]) if (b) b.destroy();
    this.depth = this.host.buffer({ size: rw * rh * 4, label: "worlds depth" });
    this.glow = this.host.buffer({ size: rw * rh * 12, usage: ["storage", "copy-dst"], label: "worlds threads glow" });
    this.sized = [rw, rh]; this.tbind = null;
  }
  #particles() {
    const n = Math.max(1024, Math.min(this.opts.threadCount | 0, 1 << 20));
    if (this.parts && this.partCount === n) return;
    if (this.parts) this.parts.destroy();
    const data = new Float32Array(n * 8);
    for (let i = 0; i < n; i++) data[i * 8 + 7] = Math.random();
    this.parts = this.host.buffer({ size: data.byteLength, usage: ["storage", "copy-dst"], label: "worlds threads particles", data });
    this.partCount = n; this.tbind = null;
  }
  #glowPipe() {
    if (!this.glowPipe) {
      const add = { srcFactor: "one", dstFactor: "one", operation: "add" };
      this.glowPipe = this.host.render("worlds threads glow", GLOW_WGSL, { blend: { color: add, alpha: add } });
      this.glowPipe.then((p) => { this.glowP = p; this.tbind = null; }).catch((e) => { this.error = String(e); });
    }
  }
  // Compile a world (kept), then switch to it and move the camera home.
  async load(id) {
    if (!this.src.worlds[id]) throw new Error("worlds.wgsl has no world " + id);
    const p = await this.pipeline(id);
    this.opts.world = id; this.current = id; this.pipe = p;
    this.tp = null; this.tbind = null;
    if (this.opts.threads) this.threadPipes(id);
    this.cam.setHome(this.info(id).home);
    this.time = 0;
    return p;
  }
  set(o) {
    this.opts = { ...this.opts, ...o };
    if (this.opts.threads) { this.threadPipes(this.opts.world); this.#glowPipe(); }
    if (o.world && o.world !== this.current) { this.current = o.world; return this.load(o.world); }
    return Promise.resolve();
  }
  resize(w, h) { this.w = Math.max(16, w | 0); this.h = Math.max(16, h | 0); }
  // The render size the quality setting gives for the current size.
  renderSize() {
    const s = qualitySettings(this.opts.quality).scale;
    return [Math.max(16, Math.round(this.w * s)), Math.max(16, Math.round(this.h * s))];
  }
  // Ask for the depth under a point in device coordinates; the camera then
  // eases to it. The answer arrives a frame or two later.
  focusAt(x, y) { this.pick = [x, y]; }
  // target: { view, width, height } draws into that texture view (in the
  // host's canvas format) at that size instead of the canvas (web/motion).
  frame(dt, { tour = false, target = null } = {}) {
    if (!this.pipe) return;
    const o = this.opts;
    if (o.playing) this.time += Math.min(dt, 0.1);
    this.cam.step(dt, { tour });
    const [rw, rh] = target ? [target.width, target.height] : this.renderSize();
    const canvas = this.host.canvas;
    if (!target && (canvas.width !== rw || canvas.height !== rh)) { canvas.width = rw; canvas.height = rh; }
    const q = qualitySettings(o.quality), u = this.uni;
    this.cam.uniforms(u);
    u.set([rw, rh, 1 / rw, 1 / rh, this.time, q.steps, q.shadowSteps, q.ao ? 1 : 0], 16);
    const pk = this.pick && !this.picking ? this.pick : null;
    u.set(pk ? [(pk[0] * 0.5 + 0.5) * rw, (0.5 - pk[1] * 0.5) * rh, 1, 0] : [0, 0, 0, 0], 24);
    u.set([o.light, o.fog, o.motion, o.growth], 28);
    u.set([o.threadPersistence, o.threadGain, 0, 0], 32);
    this.#sizeBuffers(rw, rh);
    const threads = o.threads && this.tp && this.glowP;
    if (threads) this.#particles();
    this.host.write(this.ubuf, u);
    const dev = this.host.device, enc = dev.createCommandEncoder();
    const view = target ? target.view : this.host.context.getCurrentTexture().createView();
    const ts = this.host.timer ? (i) => this.#ts(i) : () => undefined;
    const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }], timestampWrites: ts(0) });
    rp.setPipeline(this.pipe);
    rp.setBindGroup(0, this.host.bind(this.pipe, [this.ubuf, this.pickBuf, this.depth]));
    rp.draw(3);
    rp.end();
    if (threads) {
      if (!this.tbind) this.tbind = this.#threadBinds();
      const cp = enc.beginComputePass({ timestampWrites: ts(1) });
      cp.setPipeline(this.tp.decay); cp.setBindGroup(0, this.tbind.decay);
      cp.dispatchWorkgroups(Math.ceil(rw * rh / 256));
      cp.setPipeline(this.tp.advance); cp.setBindGroup(0, this.tbind.advance);
      cp.dispatchWorkgroups(Math.ceil(this.partCount / 256));
      cp.end();
      const gp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "load", storeOp: "store" }], timestampWrites: ts(2) });
      gp.setPipeline(this.glowP); gp.setBindGroup(0, this.tbind.glow); gp.draw(3); gp.end();
    }
    if (pk) enc.copyBufferToBuffer(this.pickBuf, 0, this.pickRead, 0, 16);
    if (this.host.timer) this.host.timer.resolve(enc, threads ? ["world", "threads", "glow"] : ["world"]);
    dev.queue.submit([enc.finish()]);
    if (this.host.timer) this.host.timer.collect();
    if (pk) this.#readPick(pk, rw / rh);
  }
  #ts(i) { return { querySet: this.host.timer.set, beginningOfPassWriteIndex: 2 * i, endOfPassWriteIndex: 2 * i + 1 }; }
  #threadBinds() {
    const dev = this.host.device, b = (buffer) => ({ buffer });
    return {
      advance: dev.createBindGroup({ layout: this.tp.advance.getBindGroupLayout(0), entries: [
        { binding: 0, resource: b(this.ubuf) }, { binding: 2, resource: b(this.parts) },
        { binding: 3, resource: b(this.glow) }, { binding: 4, resource: b(this.depth) }] }),
      decay: dev.createBindGroup({ layout: this.tp.decay.getBindGroupLayout(0), entries: [
        { binding: 0, resource: b(this.ubuf) }, { binding: 3, resource: b(this.glow) }] }),
      glow: dev.createBindGroup({ layout: this.glowP.getBindGroupLayout(0), entries: [
        { binding: 0, resource: b(this.ubuf) }, { binding: 1, resource: b(this.glow) }] }),
    };
  }
  #readPick(pk, aspect) {
    this.picking = true; this.pick = null;
    this.pickRead.mapAsync(1).then(() => {
      const t = new Float32Array(this.pickRead.getMappedRange(0, 4))[0];
      this.pickRead.unmap();
      if (t > 0) {
        const r = this.cam.ray(pk[0], pk[1], aspect);
        this.cam.focus(r.origin.map((v, i) => v + r.dir[i] * t), Math.max(0.8, Math.min(this.cam.distance, t * 0.7)));
      }
    }).catch(() => {}).finally(() => { this.picking = false; });
  }
  timings() { return this.host.timings(); }
}
