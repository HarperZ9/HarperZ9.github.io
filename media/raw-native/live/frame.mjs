// One frame: the G-buffer, the engine's GTAO, the sun and sky, the engine's SSR, the air, the engine's TAA, the
// lens, and, while the camera holds still, one more sample of each reference. Then the canvas.
import { FRAME_FLOATS } from "./wgsl-lib.mjs";
import { groups64, allocate } from "./gpu.mjs";
import { mul4 } from "./camera.mjs";

export const PASSES = { AO: 1, SSR: 2, TAA: 4, SKY: 8, FOG: 16, TILT: 32 };
const HALTON = (i, b) => { let f = 1, r = 0; for (; i > 0; i = Math.floor(i / b)) { f /= b; r += f * (i % b); } return r; };

export class Frame {
  constructor(gpu, scene, camera) {
    this.gpu = gpu; this.scene = scene; this.camera = camera;
    this.on = PASSES.AO | PASSES.SSR | PASSES.TAA | PASSES.SKY;
    this.view = 0; this.split = 0.5; this.frameNo = 0; this.rt = 0; this.ref = 0; this.fresh = true;
    this.prevVP = null; this.moved = true; this.stillFor = 0; this.r = null; this.flip = 0;
    this.gtao = { slices: 4, steps: 8 }; this.fogSteps = 8;
    this.timer = new Timer(gpu.device);
  }
  resize(w, h) {
    if (this.r && this.r.w === w && this.r.h === h) return;
    if (this.r) this.r.destroy();
    this.r = allocate(this.gpu, w, h); this.groups = new Map(); this.reset(true);
  }
  // anything that changes the picture starts the references again; history too when asked
  reset(history = false) { this.rt = 0; this.ref = 0; if (history) this.fresh = true; }
  bg(pipe, layoutOrIndex, entries) {   // bind groups, cached per pipeline and buffers
    const key = (pipe.label || "") + ":" + entries.map((e) => e.label || "?").join(",") + ":" + this.flip;
    let g = this.groups.get(key);
    if (!g) {
      const layout = typeof layoutOrIndex === "number" ? pipe.getBindGroupLayout(layoutOrIndex) : layoutOrIndex;
      g = this.gpu.device.createBindGroup({ layout, entries: entries.map((r, binding) => ({ binding, resource: r instanceof GPUBuffer ? { buffer: r } : r.createView() })) });
      this.groups.set(key, g);
    }
    return g;
  }
  uniforms(still, rtN, refN) {
    const { r, camera: cam, gpu } = this, s = this.settings;
    const j = this.on & PASSES.TAA ? [HALTON((this.frameNo % 8) + 1, 2) - 0.5, HALTON((this.frameNo % 8) + 1, 3) - 0.5] : [0, 0];
    const m = cam.matrices(r.w, r.h, j[0], j[1]);
    const vp = mul4(m.projNoJit, m.view);
    const f = new Float32Array(FRAME_FLOATS), u = new Uint32Array(f.buffer);
    f.set(m.view, 0); f.set(m.proj, 16); f.set(m.inv, 32); f.set(this.prevVP || vp, 48);
    f.set([...cam.eye, 0], 64); f.set([...s.sun, Math.cos(0.00465)], 68); f.set([...s.sky.sunE, s.exposure], 72);
    f.set([r.w, r.h, this.frameNo, refN], 76); f.set([m.tanHalf, m.aspect, m.near, s.aoRadius], 80);
    f.set([j[0], j[1], Math.random() * 1e6, rtN], 84); f.set([s.fog, 0.55, s.fogAmbient, this.fogSteps], 88);
    f.set(s.tiltPlane, 92); f.set([s.lensRadius, (r.h / 2) / m.tanHalf, Math.max(4, r.h / 40), s.lensOn ? 1 : 0], 96);
    f.set(s.sky.floats, 100); s.sky.amb.forEach((a, k) => f.set([...a, 0], 120 + 4 * k));
    u.set([this.on, this.view, Math.round(this.split * 10000), still ? 1 : 0], 144);
    f.set([...m.r, 0], 148); f.set([...m.u, 0], 152); f.set([...m.f, 0], 156);
    gpu.device.queue.writeBuffer(gpu.frameU, 0, f);
    const pp = new ArrayBuffer(80), pu = new Uint32Array(pp), pf = new Float32Array(pp);
    pu.set([r.w, r.h, this.gtao.slices, this.gtao.steps, 8, 0, 64, 0]); pf.set([m.tanHalf, m.aspect, m.near, s.aoRadius, 1e4, 0.2, 0, 0, 0.1, 1.25, 0, 0], 8);
    gpu.device.queue.writeBuffer(gpu.postU, 0, pp);
    const tf = this.fresh ? 4 : 0;
    pu.set([r.w, r.h, this.gtao.slices, this.gtao.steps, 8, 1 | 2 | 8 | tf, 64, 0]);
    gpu.device.queue.writeBuffer(gpu.taaU, 0, pp);
    this.prevVP = vp;
  }
  // record and submit one frame; still says whether the camera held still since the last one
  draw(still, { reference = true, measure = false, present = true, keep = true } = {}) {
    const { gpu, r, scene } = this, dev = gpu.device, P = gpu.P, n = r.n, [gx, gy] = groups64(n);
    if (!still) this.reset(false);
    const acc = keep && still && !this.fresh, refRun = acc && reference;
    this.uniforms(acc, acc ? this.rt + 1 : this.rt, refRun ? this.ref + 1 : this.ref);
    const enc = dev.createCommandEncoder(), T = this.timer;
    const D = this.flip ? [r.D1, r.D0] : [r.D0, r.D1], H = this.flip ? [r.H1, r.H0] : [r.H0, r.H1];   // [current, previous]
    // G-buffer
    const att = (t) => ({ view: t.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] });
    const zatt = (t) => ({ view: t.createView(), depthLoadOp: "clear", depthStoreOp: "store", depthClearValue: 1 });
    let rp = enc.beginRenderPass({ colorAttachments: [att(r.ta), att(r.tb)], depthStencilAttachment: zatt(r.z0), timestampWrites: T.slot("G-buffer") });
    rp.setPipeline(P.raster); rp.setBindGroup(0, gpu.frameG); rp.setVertexBuffer(0, scene.vertices); rp.draw(scene.nt * 3); rp.end();
    rp = enc.beginRenderPass({ colorAttachments: [att(r.tk)], depthStencilAttachment: zatt(r.z1), timestampWrites: T.slot("back layer") });
    rp.setPipeline(P.back); rp.setBindGroup(0, gpu.frameG); rp.setVertexBuffer(0, scene.vertices); rp.draw(scene.nt * 3); rp.end();
    const page = (name, p, entries, x = gx, y = gy, colour = false) => {
      const cp = enc.beginComputePass({ timestampWrites: T.slot(name) });
      cp.setPipeline(p.pipe); cp.setBindGroup(0, p.traced ? scene.group : gpu.frameG); cp.setBindGroup(1, this.bg(p.pipe, p.g1, entries));
      if (colour) cp.setBindGroup(2, gpu.colourG);
      cp.dispatchWorkgroups(x, y); cp.end();
    };
    const engine = (name, pipe, entries) => {
      const cp = enc.beginComputePass({ timestampWrites: T.slot(name) });
      cp.setPipeline(pipe); cp.setBindGroup(0, this.bg(pipe, 0, entries)); cp.dispatchWorkgroups(gx, gy); cp.end();
    };
    page("pack", P.pack, [r.ta, r.tb, r.tk, r.G, r.M, D[0], r.R]);
    if (this.on & PASSES.AO) engine("GTAO (engine)", P.gtao, [gpu.postU, r.G, r.AO]);
    page("sun and sky", P.shade, [r.G, r.M, r.AO, r.LR]);
    if (this.on & PASSES.SSR) engine("SSR (engine)", P.ssr, [gpu.postU, r.G, r.HIT]);
    else enc.clearBuffer(r.HIT);
    if ((this.on & PASSES.FOG) && this.settings.fog > 0) { const [fx, fy] = groups64(Math.ceil(r.w / 2) * Math.ceil(r.h / 2)); page("air", P.fog, [r.G, r.FG], fx, fy); }
    page("compose", P.compose, [r.G, r.LR, r.HIT, r.FG, r.AO, r.C, H[0], r.ACC]);
    if (this.on & PASSES.TAA) engine("TAA (engine)", P.taa, [gpu.taaU, r.C, r.R, D[1], H[1], H[0]]);
    page("lens", P.tilt, [r.G, H[0], r.OUT]);
    if (acc) this.rt++;
    if (refRun) {
      page("reference: path", P.path, [r.PA]);
      page("reference: AO and mirror", P.refPinhole, [r.RA, r.PA]);
      this.ref++;
    }
    let reading = null;
    if (measure && this.ref > 0) {
      page("measure", P.measure, [r.OUT, r.PA, r.RA, r.ACC, r.LR, r.G, r.PART], gx, gy, true);
      const cp = enc.beginComputePass(); cp.setPipeline(P.reduce); cp.setBindGroup(0, this.bg(P.reduce, 0, [r.PART, r.SUM])); cp.dispatchWorkgroups(1); cp.end();
      reading = r.read.find((b) => b.mapState === "unmapped");
      if (reading) enc.copyBufferToBuffer(r.SUM, 0, reading, 0, 32);
    }
    if (present) {
      const ctx = gpu.host.context;
      rp = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }], timestampWrites: T.slot("present") });
      rp.setPipeline(P.present); rp.setBindGroup(0, gpu.frameG); rp.setBindGroup(1, this.bg(P.present, P.present.g1, [r.OUT, r.PA, r.RA, r.ACC, r.AO, r.LR]));
      rp.setBindGroup(2, gpu.colourG); rp.draw(3); rp.end();
    }
    T.resolve(enc);
    dev.queue.submit([enc.finish()]);
    T.collect();
    this.fresh = false; this.frameNo++; this.flip ^= 1;
    if (!reading) return null;
    const fr = { rt: this.rt, ref: this.ref };
    return reading.mapAsync(GPUMapMode.READ).then(() => { const v = Array.from(new Float32Array(reading.getMappedRange())); reading.unmap(); return { ...fr, v }; });
  }
}

// GPU time per pass from timestamp queries; readbacks rotate so reading never stalls a frame
class Timer {
  constructor(device) {
    this.device = device; this.ok = device.features.has("timestamp-query"); this.cap = 24; this.names = []; this.ms = {};
    if (!this.ok) return;
    this.set = device.createQuerySet({ type: "timestamp", count: this.cap * 2 });
    this.res = device.createBuffer({ size: this.cap * 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
    this.reads = [0, 1, 2].map(() => ({ b: device.createBuffer({ size: this.cap * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }), names: null }));
  }
  slot(name) {
    if (!this.ok || this.names.length >= this.cap) return undefined;
    const i = this.names.length; this.names.push(name);
    return { querySet: this.set, beginningOfPassWriteIndex: 2 * i, endOfPassWriteIndex: 2 * i + 1 };
  }
  resolve(enc) {
    if (!this.ok || !this.names.length) return;
    this.pending = this.reads.find((r) => !r.names && r.b.mapState === "unmapped");
    if (this.pending) { enc.resolveQuerySet(this.set, 0, this.names.length * 2, this.res, 0); enc.copyBufferToBuffer(this.res, 0, this.pending.b, 0, this.names.length * 16); this.pending.names = this.names; }
    this.names = [];
  }
  collect() {
    const p = this.pending; this.pending = null;
    if (!p) return;
    p.b.mapAsync(GPUMapMode.READ).then(() => {
      const t = new BigUint64Array(p.b.getMappedRange()), ms = {};
      p.names.forEach((nm, i) => { const d = Number(t[2 * i + 1] - t[2 * i]) / 1e6; if (d >= 0 && d < 1e4) ms[nm] = (ms[nm] || 0) + d; });
      p.b.unmap(); p.names = null;
      for (const [k, v] of Object.entries(ms)) this.ms[k] = this.ms[k] === undefined ? v : this.ms[k] * 0.9 + v * 0.1;
    }).catch(() => { p.names = null; });
  }
}
