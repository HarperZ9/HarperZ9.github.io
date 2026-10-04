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
  { id: "eye", title: "VI. The eye", home: { target: [0, 1.15, 0], distance: 4.6, yaw: 0.35, pitch: 0.12 } },
  { id: "swing", title: "XIII. The swing", home: { target: [0.3, 1.1, 0], distance: 5.4, yaw: 0.75, pitch: 0.22 } },
  { id: "forest", title: "XIV. The forest", home: { target: [0, 0.5, 0], distance: 3.3, yaw: 0.45, pitch: 0.28 } },
]);
// Quality 0..1 sets the render scale, march steps, shadow steps and AO.
export function qualitySettings(q) {
  q = Math.min(1, Math.max(0, q));
  return { scale: 0.45 + 0.55 * q, steps: Math.round(64 + 96 * q), shadowSteps: Math.round(12 + 36 * q), ao: q > 0.2 };
}
export const DEFAULTS = Object.freeze({ world: "eye", quality: 0.6, light: 1, fog: 1, motion: 1, growth: 0, tour: true, playing: true });

// Split worlds.wgsl into { prelude, worlds: { id: code }, main }.
export function worldSources(text) {
  const parts = text.replace(/\r\n/g, "\n").split(/^\/\/@(world \w+|main)[^\S\n]*\n/m);
  const out = { prelude: parts[0], worlds: {}, main: "" };
  for (let i = 1; i < parts.length; i += 2) {
    if (parts[i] === "main") out.main = parts[i + 1];
    else out.worlds[parts[i].slice(6)] = parts[i + 1];
  }
  return out;
}

export async function createWorlds(host, { wgsl, world = DEFAULTS.world }) {
  const w = new Worlds(host, worldSources(wgsl));
  await w.load(world);
  return w;
}

class Worlds {
  constructor(host, src) {
    this.host = host; this.src = src;
    this.opts = { ...DEFAULTS };
    this.cam = new OrbitCamera();
    this.uni = new Float32Array(36);
    this.ubuf = host.buffer({ size: 144, usage: ["uniform", "copy-dst"], label: "worlds uniforms" });
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
  // Compile a world (kept), then switch to it and move the camera home.
  async load(id) {
    if (!this.src.worlds[id]) throw new Error("worlds.wgsl has no world " + id);
    const p = await this.pipeline(id);
    this.opts.world = id; this.current = id; this.pipe = p;
    this.cam.setHome(this.info(id).home);
    this.time = 0;
    return p;
  }
  set(o) {
    this.opts = { ...this.opts, ...o };
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
  frame(dt, { tour = false } = {}) {
    if (!this.pipe) return;
    const o = this.opts;
    if (o.playing) this.time += Math.min(dt, 0.1);
    this.cam.step(dt, { tour });
    const [rw, rh] = this.renderSize();
    const canvas = this.host.canvas;
    if (canvas.width !== rw || canvas.height !== rh) { canvas.width = rw; canvas.height = rh; }
    const q = qualitySettings(o.quality), u = this.uni;
    this.cam.uniforms(u);
    u.set([rw, rh, 1 / rw, 1 / rh, this.time, q.steps, q.shadowSteps, q.ao ? 1 : 0], 16);
    const pk = this.pick && !this.picking ? this.pick : null;
    u.set(pk ? [(pk[0] * 0.5 + 0.5) * rw, (0.5 - pk[1] * 0.5) * rh, 1, 0] : [0, 0, 0, 0], 24);
    u.set([o.light, o.fog, o.motion, o.growth], 28);
    this.host.write(this.ubuf, u);
    const dev = this.host.device, enc = dev.createCommandEncoder();
    const view = this.host.context.getCurrentTexture().createView();
    const ts = this.host.timer && this.host.timer.capacity ? this.#ts() : undefined;
    const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }], timestampWrites: ts });
    rp.setPipeline(this.pipe);
    rp.setBindGroup(0, this.host.bind(this.pipe, [this.ubuf, this.pickBuf]));
    rp.draw(3);
    rp.end();
    if (pk) enc.copyBufferToBuffer(this.pickBuf, 0, this.pickRead, 0, 16);
    if (ts) this.host.timer.resolve(enc, ["world"]);
    dev.queue.submit([enc.finish()]);
    if (ts) this.host.timer.collect();
    if (pk) this.#readPick(pk, rw / rh);
  }
  #ts() { return { querySet: this.host.timer.set, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 }; }
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
