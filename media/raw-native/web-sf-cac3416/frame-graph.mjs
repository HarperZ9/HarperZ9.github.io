// The frame graph for the web host: the same rules as raw/graph/frame_graph.hpp
// and src/graph/frame_graph.cpp, in JavaScript, so a pass list compiles to the
// same plan on every backend. frame-graph.test.mjs checks it against the
// golden text and event logs of tests/test_frame_graph.cpp.
//
//   setup    createBuffer / importBuffer / createHost, addPass, markOutput
//   compile  validate (no read before a write), cull every pass whose results
//            nothing kept reads, place a barrier wherever an access changes or
//            a write must be ordered
//   execute  create the buffers kept passes use, run each kept pass after its
//            barriers, in declaration order
//
// Additions over the C++ graph, for the web host: an imported resource may be
// a function, resolved on every execute (ping-pong and history buffers), and
// "attachment" is a write access for a render target such as the canvas.
// Pure: no WebGPU objects are touched here; the device is passed in.

export const Access = Object.freeze({
  Undefined: "undefined", Uniform: "uniform", StorageRead: "storage-read",
  StorageWrite: "storage-write", CopySrc: "copy-src", CopyDst: "copy-dst", Attachment: "attachment",
});
const PURE_READ = new Set([Access.Uniform, Access.StorageRead, Access.CopySrc]);
export const isWrite = (a) => a === Access.StorageWrite || a === Access.CopyDst || a === Access.Attachment;

export class FrameGraph {
  // device: { createBuffer(desc) -> handle, destroyBuffer(handle) } or null for a host graph.
  constructor(device = null) {
    this.device = device;
    this.resources = [];
    this.passes = [];
    this.plan = [];
    this.compiled = false;
  }
  createBuffer(name, desc) { return this.#add({ name, kind: "transient", desc, value: null }); }
  importBuffer(name, value) { return this.#add({ name, kind: "imported", value }); }
  createHost(name) { return this.#add({ name, kind: "host", value: null }); }
  markOutput(r) { if (this.resources[r]) this.resources[r].output = true; this.compiled = false; }
  addPass(name, uses, fn) {
    this.passes.push({ name, uses: uses.map(([resource, access]) => ({ resource, access })), fn, kept: false });
    this.compiled = false;
  }
  #add(r) {
    this.resources.push({ output: false, firstUse: -1, lastUse: -1, ...r });
    this.compiled = false;
    return this.resources.length - 1;
  }
  // The live value of a resource: a transient's buffer, an import (calling it
  // when it is a function), or undefined for host data.
  buffer(r) {
    const res = this.resources[r];
    if (!res) return undefined;
    return typeof res.value === "function" ? res.value() : res.value;
  }
  culled(i) { return i < this.passes.length && !this.passes[i].kept; }

  compile() {
    this.#validate();
    this.#cull();
    this.#planBarriers();
    this.compiled = true;
    return this.plan;
  }
  #validate() {
    const R = this.resources;
    for (const r of R) {
      if (r.kind === "transient" && !this.device) throw new Error(`frame graph: buffer ${r.name} in a graph with no device`);
    }
    const written = R.map((r) => r.kind === "imported");
    for (const p of this.passes) {
      p.uses.forEach((u, a) => {
        if (!(u.resource >= 0 && u.resource < R.length)) throw new Error(`frame graph: pass ${p.name} uses an unknown resource`);
        for (let b = 0; b < a; b++) {
          if (p.uses[b].resource === u.resource) throw new Error(`frame graph: pass ${p.name} uses ${R[u.resource].name} twice`);
        }
        if (PURE_READ.has(u.access) && !written[u.resource]) {
          throw new Error(`frame graph: pass ${p.name} reads ${R[u.resource].name} before any pass writes it`);
        }
      });
      for (const u of p.uses) if (!PURE_READ.has(u.access)) written[u.resource] = true;
    }
  }
  // Walk back from the outputs: a pass is kept when it writes something an
  // output or a later kept pass needs; then everything it uses is needed.
  #cull() {
    const needed = this.resources.map((r) => r.output);
    for (let i = this.passes.length - 1; i >= 0; i--) {
      const p = this.passes[i];
      p.kept = p.uses.some((u) => !PURE_READ.has(u.access) && needed[u.resource]);
      if (p.kept) for (const u of p.uses) needed[u.resource] = true;
    }
  }
  #planBarriers() {
    this.plan = [];
    const state = this.resources.map(() => Access.Undefined);
    for (const r of this.resources) { r.firstUse = -1; r.lastUse = -1; }
    this.passes.forEach((p, i) => {
      if (!p.kept) return;
      const step = { pass: i, barriers: [] };
      for (const u of p.uses) {
        const r = this.resources[u.resource];
        if (r.firstUse < 0) r.firstUse = i;
        r.lastUse = i;
        if (r.kind === "host") continue;
        const before = state[u.resource];
        if (before !== u.access || isWrite(u.access)) step.barriers.push({ resource: u.resource, before, after: u.access });
        state[u.resource] = u.access;
      }
      this.plan.push(step);
    });
  }
  // ctx is handed to every pass; ctx.barrier(list) is called before a pass
  // that has barriers (WebGPU orders passes itself, so the host ignores them).
  execute(ctx = {}) {
    if (!this.compiled) this.compile();
    if (this.device) {
      for (const r of this.resources) {
        if (r.kind === "transient" && r.firstUse >= 0 && !r.value) r.value = this.device.createBuffer(r.desc);
      }
    }
    for (const s of this.plan) {
      if (s.barriers.length && ctx.barrier) ctx.barrier(s.barriers.map((b) => ({ buffer: this.buffer(b.resource), before: b.before, after: b.after })));
      this.passes[s.pass].fn(ctx, this);
    }
  }
  destroy() {
    if (!this.device) return;
    for (const r of this.resources) if (r.kind === "transient" && r.value) { this.device.destroyBuffer(r.value); r.value = null; }
  }
  // One line per pass: kept or culled, every use and every barrier. Matches
  // FrameGraph::describe() character for character.
  describe() {
    let o = "", step = 0;
    this.passes.forEach((p, i) => {
      o += `pass ${p.name}${p.kept ? " kept" : " culled"}:`;
      for (const u of p.uses) o += ` ${this.resources[u.resource].name}=${u.access}`;
      if (p.kept && step < this.plan.length && this.plan[step].pass === i) {
        for (const b of this.plan[step].barriers) o += ` | ${this.resources[b.resource].name} ${b.before}->${b.after}`;
        step++;
      }
      o += "\n";
    });
    return o;
  }
}
