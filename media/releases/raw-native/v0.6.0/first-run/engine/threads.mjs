// Threads on the web host: particles that flow along the zero set of a form
// field, fifteen worlds, crossfading through an aperture. The passes are
// src/renderer/gpu/shaders/threads.wgsl, the same source the D3D12 build runs.
//
//   const host = await createHost({ canvas });
//   const th = await createThreads(host, { wgsl });   // wgsl: the text of threads.wgsl
//   th.resize(960, 540);
//   th.set({ world: 5, particles: 1 << 18, persistence: 0.82, exposure: 1, spacing: 0.011, levels: 5 });
//   requestAnimationFrame(function loop(now) { th.frame(1 / 60); requestAnimationFrame(loop); });
import { Access, wgslPasses } from "./raw-gpu.mjs";

export const WORLDS = Object.freeze(["Komorebi", "Droste", "Two voices", "Morphogen", "The making", "The eye",
  "The strings", "The stream", "The belly", "The draw", "The elements", "The burden", "The swing",
  "The forest", "The many"]);
// Per-world exposure of the original film, at 3840 x 2160 with 2^21 particles.
const EXPO = [0.6, 0.5, 0.45, 0.5, 0.55, 0.5, 0.6, 0.5, 0.55, 0.5, 0.5, 0.55, 0.6, 0.55, 0.45];
// The Draw world's six probabilities: a seeded Dirichlet draw, sorted (seed 20261004).
const PROBS = [0.429524, 0.192914, 0.155632, 0.097257, 0.075574, 0.038923];
const SPAN = 20, XF = 3, MORPH = 3, SIM_W = 1024, SIM_H = 576, SIM_STEPS = 10;
const BASE_PARTICLES = 1 << 21, BASE_PIXELS = 3840 * 2160, FIXED = 4096;
export const DEFAULTS = Object.freeze({ world: 0, tour: false, particles: 1 << 18, persistence: 0.82,
  exposure: 1, spacing: 0.011, levels: 5, substeps: 3, playing: true });

const FORMS = ["fKomorebi", "fDroste", "fVoices", "fMorph", "fMaking", "fEye", "fStrings", "fStream", "fBelly",
  "fDraw", "fElements", "fBurden", "fSwing", "fForest", "fMany"];
// The advance pass for one world, or for the two worlds of a crossfade. A shader
// that can reach all fifteen fields took 24 s to compile on D3D12 through Chrome;
// one that reaches one or two compiles in a fraction of that, so the module builds
// these on demand and keeps them.
export function advanceFor(source, a, b = a) {
  const call = (w) => (w === 9 ? "fDraw(p, t, P.ch, P.pr0, P.pr1)" : `${FORMS[w]}(p, t)`);
  const body = a === b ? `return ${call(a)};` : `if (w == ${a}) { return ${call(a)}; } return ${call(b)};`;
  const out = source.replace(/fn form\(w: i32, p: vec2f, t: f32\) -> f32 \{[\s\S]*?\n\}\n/, `fn form(w: i32, p: vec2f, t: f32) -> f32 { ${body} }\n`);
  if (out === source) throw new Error("threads.wgsl: the advance pass has no form() to specialize");
  return out;
}

// present: false draws into th.frameBuf (packed RGBA8, th.w x th.h) and leaves
// the canvas alone, for a caller that composites the frame (web/motion).
export async function createThreads(host, { wgsl, world = DEFAULTS.world, present = true }) {
  const src = wgslPasses(wgsl.replace(/\r\n/g, "\n"));
  const names = ["threads_init", "threads_rd_seed", "threads_rd", "threads_decay",
    "threads_pyr_first", "threads_pyr_next", "threads_finish"];
  const pipes = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await host.compute(n, src[n])])));
  if (present) await host.presenter();
  const th = new Threads(host, pipes, src.threads_advance);
  th.present = present;
  th.opts.world = world;
  await th.compileAdvance(world, world);
  return th;
}

class Threads {
  constructor(host, pipes, advanceSource) {
    this.host = host;
    this.pipes = pipes;
    this.advanceSource = advanceSource;
    this.advance = new Map();   // "a,b" -> pipeline, or null while it compiles
    this.pending = null;        // a world asked for, waiting on its pipeline
    this.opts = { ...DEFAULTS };
    this.raw = new ArrayBuffer(144);
    this.f32 = new Float32Array(this.raw); this.u32 = new Uint32Array(this.raw); this.i32 = new Int32Array(this.raw);
    this.params = host.buffer({ size: 144, usage: ["uniform", "copy-dst"], label: "threads params" });
    this.sim = [0, 1].map((i) => host.buffer({ size: SIM_W * SIM_H * 8, label: "threads sim " + i }));
    this.w = 0; this.h = 0; this.np = 0;
    this.time = 0; this.frameIndex = 0; this.seedbase = 0;
    this.wa = 0; this.wb = 0; this.u = 0; this.ta = 0; this.tb = 0; this.xf = -1;
    this.simT = 0;
    this.graphs = null;
  }
  set(o) {
    const prev = this.opts;
    this.opts = { ...prev, ...o };
    if (o.particles !== undefined && o.particles !== prev.particles && this.w) this.#particles();
    if (o.world !== undefined && o.world !== prev.world) this.pending = this.opts.world;
    return this.opts;
  }
  resize(w, h) {
    w = Math.max(16, w | 0); h = Math.max(16, h | 0);
    const lim = this.host.limits.maxStorageBufferBindingSize;
    const s = Math.min(1, Math.sqrt(lim / (w * h * 16)));
    if (s < 1) { w = Math.floor(w * s); h = Math.floor(h * s); }
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    const hb = this.host;
    for (const b of [this.acc, this.pyrA, this.pyrB, this.frameBuf]) if (b) b.destroy();
    this.acc = hb.buffer({ size: w * h * 16, usage: ["storage", "copy-dst"], label: "threads accumulator" });
    const lv = (n, l) => Math.max(1, n >> l);
    let a = 0, b = 0;
    for (let l = 1; l < 8; l++) { const n = lv(w, l) * lv(h, l) * 16; if (l % 2) a += n; else b += n; }
    this.pyrA = hb.buffer({ size: a, label: "threads bloom odd" });
    this.pyrB = hb.buffer({ size: b, label: "threads bloom even" });
    this.frameBuf = hb.buffer({ size: w * h * 4, label: "threads frame" });
    this.levels = this.levels || [1, 2, 3, 4, 5, 6, 7].map((l) => hb.buffer({ size: 16, usage: ["uniform", "copy-dst"], label: "threads level " + l }));
    this.levels.forEach((buf, i) => {
      const d = new ArrayBuffer(16);
      new Uint32Array(d).set([w, h, i + 1]); new Float32Array(d)[3] = 1 / FIXED;
      hb.write(buf, d);
    });
    if (hb.canvas && this.present) { hb.canvas.width = w; hb.canvas.height = h; }
    this.graphs = { plain: this.#graph(false), morph: this.#graph(true) };
    if (!this.pos || this.np !== this.opts.particles) this.#particles();
  }
  #particles() {
    if (this.pos) this.pos.destroy();
    this.np = Math.max(1024, Math.min(this.opts.particles | 0, 1 << 23));
    this.pos = this.host.buffer({ size: this.np * 16, label: "threads particles" });
    this.seedbase = (this.seedbase + 0x9e3779b9) >>> 0;
    this.#writeParams(0, 0);
    const g = this.host.graph();
    const pos = g.importBuffer("pos", this.pos), par = g.importBuffer("params", this.params);
    g.addPass("init", [[par, Access.Uniform], [pos, Access.StorageWrite]], (c) => c.dispatch(this.pipes.threads_init, [this.params, this.pos], Math.ceil(this.np / 256)));
    g.markOutput(pos);
    this.host.frame(g);
  }
  // The frame graph: optional reaction-diffusion steps, decay, the particle
  // advance, seven bloom levels, the finish and presentation.
  #graph(morph) {
    const g = this.host.graph(), P = this.pipes;
    const par = g.importBuffer("params", () => this.params);
    const pos = g.importBuffer("pos", () => this.pos);
    const acc = g.importBuffer("acc", this.acc);
    const sims = [g.importBuffer("simA", this.sim[0]), g.importBuffer("simB", this.sim[1])];
    const pa = g.importBuffer("bloomOdd", this.pyrA), pb = g.importBuffer("bloomEven", this.pyrB);
    const frame = g.importBuffer("frame", this.frameBuf);
    const canvas = this.present ? g.createHost("canvas") : null;
    const lv = this.levels.map((b, i) => g.importBuffer("level" + (i + 1), b));
    const W = this.w, H = this.h, gx = Math.ceil(W / 16), gy = Math.ceil(H / 16);
    if (morph) {
      for (let k = 0; k < SIM_STEPS; k++) {
        const s = k % 2, d = 1 - s;
        g.addPass("rd", [[par, Access.Uniform], [sims[s], Access.StorageRead], [sims[d], Access.StorageWrite]],
          (c) => c.dispatch(P.threads_rd, [this.params, this.sim[s], this.sim[d]], Math.ceil(SIM_W / 16), Math.ceil(SIM_H / 16)));
      }
    }
    g.addPass("decay", [[par, Access.Uniform], [acc, Access.StorageWrite]], (c) => c.dispatch(P.threads_decay, [this.params, this.acc], gx, gy));
    g.addPass("advance", [[par, Access.Uniform], [pos, Access.StorageWrite], [acc, Access.StorageWrite], [sims[0], Access.StorageRead]],
      (c) => c.dispatch(this.advPipe, [this.params, this.pos, this.acc, this.sim[0]], Math.ceil(this.np / 256)));
    for (let l = 1; l < 8; l++) {
      const dst = l % 2 ? pa : pb, srcR = l === 1 ? acc : (l % 2 ? pb : pa);
      const dstB = l % 2 ? this.pyrA : this.pyrB, srcB = l === 1 ? this.acc : (l % 2 ? this.pyrB : this.pyrA);
      const pipe = l === 1 ? P.threads_pyr_first : P.threads_pyr_next;
      const dx = Math.ceil(Math.max(1, W >> l) / 16), dy = Math.ceil(Math.max(1, H >> l) / 16);
      g.addPass("bloom", [[lv[l - 1], Access.Uniform], [srcR, Access.StorageRead], [dst, Access.StorageWrite]],
        (c) => c.dispatch(pipe, [this.levels[l - 1], srcB, dstB], dx, dy));
    }
    g.addPass("finish", [[par, Access.Uniform], [acc, Access.StorageRead], [pa, Access.StorageRead], [pb, Access.StorageRead], [frame, Access.StorageWrite]],
      (c) => c.dispatch(P.threads_finish, [this.params, this.acc, this.pyrA, this.pyrB, this.frameBuf], gx, gy));
    if (canvas) {
      g.addPass("present", [[frame, Access.StorageRead], [canvas, Access.Attachment]], (c) => c.presentFrame(this.frameBuf, W, H));
      g.markOutput(canvas);
    } else g.markOutput(frame);
    g.compile();
    return g;
  }
  #key(a, b) { return a === b ? `${a}` : `${Math.min(a, b)},${Math.max(a, b)}`; }
  // Compile the advance pass for worlds a and b; resolves when it is ready.
  compileAdvance(a, b) {
    const k = this.#key(a, b);
    if (this.advance.get(k)) return Promise.resolve(this.advance.get(k));
    if (!this.advance.has(k)) {
      this.advance.set(k, null);
      this.compiling = (this.compiling || Promise.resolve()).then(() =>
        this.host.compute("threads_advance " + k, advanceFor(this.advanceSource, a, b))).then((p) => { this.advance.set(k, p); return p; });
      this.waits = this.waits || {};
      this.waits[k] = this.compiling;
    }
    return this.waits[k];
  }
  #ready(a, b) {
    const p = this.advance.get(this.#key(a, b));
    if (p) return p;
    this.compileAdvance(a, b).catch((e) => { this.error = String(e && e.message || e); });
    return null;
  }
  #goTo(w) {
    if (this.xf >= 0) { this.wa = this.wb; this.ta = this.tb; }
    this.wb = w; this.tb = 0; this.xf = 0;
    if (w === MORPH) this.#seedSim();
  }
  #seedSim() { this.simT = 0; this.needSeed = true; }
  // The reaction-diffusion field starts from its spots and runs 1,200 steps, so
  // the Morphogen world has a pattern to follow from its first frame.
  #warmSim() {
    const hb = this.host, P = this.pipes;
    this.#writeParams(0, 0, 8);
    const g = hb.graph();
    const par = g.importBuffer("params", this.params);
    const sims = [g.importBuffer("simA", this.sim[0]), g.importBuffer("simB", this.sim[1])];
    const sx = Math.ceil(SIM_W / 16), sy = Math.ceil(SIM_H / 16);
    g.addPass("rd seed", [[par, Access.Uniform], [sims[0], Access.StorageWrite]], (c) => c.dispatch(P.threads_rd_seed, [this.params, this.sim[0]], sx, sy));
    for (let k = 0; k < 40; k++) {
      const s = k % 2;
      g.addPass("rd", [[par, Access.Uniform], [sims[s], Access.StorageRead], [sims[1 - s], Access.StorageWrite]],
        (c) => c.dispatch(P.threads_rd, [this.params, this.sim[s], this.sim[1 - s]], sx, sy));
    }
    g.markOutput(sims[0]);
    g.compile();
    hb.frame(g);
    const h = hb.graph();
    const hp = h.importBuffer("params", this.params);
    const hs = [h.importBuffer("simA", this.sim[0]), h.importBuffer("simB", this.sim[1])];
    for (let k = 0; k < 40; k++) {
      const s = k % 2;
      h.addPass("rd", [[hp, Access.Uniform], [hs[s], Access.StorageRead], [hs[1 - s], Access.StorageWrite]],
        (c) => c.dispatch(P.threads_rd, [this.params, this.sim[s], this.sim[1 - s]], sx, sy));
    }
    h.markOutput(hs[0]);
    h.compile();
    for (let i = 0; i < 29; i++) hb.frame(h);
  }
  #writeParams(dt, keep, simt) {
    const o = this.opts, f = this.f32, n = this.i32, u = this.u32;
    const sub = Math.max(1, o.substeps | 0);
    const ec = this.u < 0.5 ? this.wa : this.wb;
    const frameScale = Math.max(dt * 30, 1e-3);
    const gain = (BASE_PARTICLES / this.np) * (this.w * this.h / BASE_PIXELS) * frameScale / sub;
    f.set([this.time, dt / sub, this.frameIndex * sub, this.w / Math.max(1, this.h),
      this.u, this.ta, this.tb, o.spacing,
      o.levels, gain, 1, keep,
      EXPO[ec] * o.exposure, this.u > 0 ? Math.sin(Math.PI * this.u) : 0, 1e9, FIXED,
      PROBS[0], PROBS[1], PROBS[2], PROBS[3], PROBS[4], PROBS[5], 0, 0]);
    u[24] = this.np; n[25] = this.wa; n[26] = this.wb; n[27] = 1;
    u[28] = this.w; u[29] = this.h; u[30] = sub; u[31] = SIM_W;
    u[32] = SIM_H; u[33] = this.seedbase; f[34] = simt === undefined ? this.simT : simt; u[35] = 0;
    this.host.write(this.params, this.raw);
  }
  // Advance the clocks by dt seconds and draw one frame.
  // Paused, nothing is drawn and the canvas keeps its last frame.
  frame(dt) {
    if (!this.graphs) return;
    const o = this.opts;
    if (!o.playing) return;
    dt = Math.min(Math.max(dt, 1e-4), 1 / 20);
    this.time += dt;
    this.ta += dt; this.tb += dt;
    if (this.xf >= 0) {
      this.xf += dt;
      this.u = Math.min(1, this.xf / XF);
      if (this.u >= 1) { this.wa = this.wb; this.ta = this.tb; this.u = 0; this.xf = -1; }
    }
    // A new world starts its crossfade only once the pass for both worlds is
    // ready; until then the current world keeps running.
    if (this.xf < 0 && this.ta >= SPAN + XF && this.pending === null) {
      this.pending = o.tour ? (this.wa + 1) % WORLDS.length : this.wa;
      if (o.tour) this.opts.world = this.pending;
    }
    if (this.xf < 0 && this.pending !== null && this.#ready(this.wa, this.pending)) {
      this.#ready(this.pending, this.pending);
      this.#goTo(this.pending);
      this.pending = null;
    }
    if (o.tour && this.xf < 0 && this.ta > 5) this.#ready(this.wa, (this.wa + 1) % WORLDS.length);
    this.advPipe = (this.u > 0 ? null : this.#ready(this.wa, this.wa)) || this.#ready(this.wa, this.wb);
    if (!this.advPipe) return;
    if (this.needSeed) { this.needSeed = false; this.#warmSim(); }
    const morphOn = this.wa === MORPH || (this.u > 0 && this.wb === MORPH);
    if (morphOn) {
      const clock = this.wa === MORPH ? this.ta : this.tb;
      this.simT = 4 + (clock + 12) * 0.8;
    }
    this.#writeParams(dt, Math.pow(o.persistence, dt * 30));
    this.host.frame(morphOn ? this.graphs.morph : this.graphs.plain);
    this.frameIndex++;
  }
  // Clear the trails and start the current world's clock again.
  restart() {
    if (!this.#ready(this.opts.world, this.opts.world)) { this.pending = this.opts.world; return; }
    this.pending = null;
    this.wa = this.wb = this.opts.world; this.ta = this.tb = 0; this.u = 0; this.xf = -1; this.time = 0;
    const enc = this.host.device.createCommandEncoder();
    enc.clearBuffer(this.acc);
    this.host.device.queue.submit([enc.finish()]);
    if (this.opts.world === MORPH) this.#seedSim();
  }
  state() { return { worldA: this.wa, worldB: this.wb, u: this.u, clock: this.ta, width: this.w, height: this.h, particles: this.np }; }
  destroy() {
    for (const b of [this.acc, this.pyrA, this.pyrB, this.frameBuf, this.pos, this.params, ...this.sim, ...(this.levels || [])]) if (b) b.destroy();
    this.graphs = null;
  }
}
