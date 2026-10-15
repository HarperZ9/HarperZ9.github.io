// Runs the post stack (post.mjs) for the Motion renderer: scene passes on the
// linear accumulation texture before bloom, display passes after the finish.
import { PASS_HEADER, getPass, passParams } from "./post.mjs";

const HDR = "rgba16float";
const USE = { COPY_SRC: 0x01, COPY_DST: 0x02, BIND: 0x04, RENDER: 0x10 };

const BLIT = PASS_HEADER + /* wgsl */ `
@fragment fn main(@builtin(position) q: vec4f) -> @location(0) vec4f { return texel(q); }`;
// Texture to buffer and back, for effects that work on buffers.
// An effect may take a smaller input (a CRT's source resolution): each input pixel is
// then the mean of the frame pixels it covers.
const TO_BUF = /* wgsl */ `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> dst: array<vec4f>;
@group(0) @binding(2) var<uniform> size: vec4f;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) g: vec3u) {
  let s = vec2u(textureDimensions(src));
  let d = vec2u(size.xy);
  if (g.x >= d.x || g.y >= d.y) { return; }
  let a = g.xy * s / d;
  let b = max(a + 1u, (g.xy + 1u) * s / d);
  var c = vec4f(0.0);
  for (var y = a.y; y < b.y; y = y + 1u) { for (var x = a.x; x < b.x; x = x + 1u) { c = c + textureLoad(src, vec2i(vec2u(x, y)), 0); } }
  dst[g.y * d.x + g.x] = c / f32((b.x - a.x) * (b.y - a.y));
}`;
const FROM_BUF = /* wgsl */ `
@group(0) @binding(0) var<uniform> size: vec4f;
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
@fragment fn main(@builtin(position) q: vec4f) -> @location(0) vec4f { return src[u32(q.y) * u32(size.x) + u32(q.x)]; }`;
const effectKey = (name, W, H, spec) => `${name}|${W}x${H}|${JSON.stringify(spec)}`;

export class PostRunner {
  constructor(host, sampler) {
    this.host = host; this.device = host.device; this.sampler = sampler;
    this.pipes = new Map(); this.tex = new Map(); this.ubufs = []; this.effects = new Map(); this.pending = new Map();
  }
  // Create the effects a list of specs needs at this size. Resolves when they are ready.
  prepare(specs, W, H) {
    const jobs = [];
    for (const spec of specs || []) {
      const pass = getPass(spec.pass);
      if (!pass.effect) continue;
      const key = effectKey(pass.name, W, H, spec);
      if (this.effects.has(key)) continue;
      if (!this.pending.has(key)) this.pending.set(key, Promise.resolve(pass.effect(this.host, { width: W, height: H, spec })).then((e) => { this.effects.set(key, e); this.pending.delete(key); }));
      jobs.push(this.pending.get(key));
    }
    return Promise.all(jobs);
  }
  #effect(enc, pass, spec, srcTex, dstView, dstFormat, W, H, frame, i) {
    const e = this.effects.get(effectKey(pass.name, W, H, spec));
    if (!e) return false;
    if (!this.toBuf) {
      const m = this.device.createShaderModule({ label: "post to buffer", code: TO_BUF });
      this.toBuf = this.device.createComputePipeline({ label: "post to buffer", layout: "auto", compute: { module: m, entryPoint: "main" } });
    }
    const [iw, ih] = e.inputSize || [W, H];
    const ui = this.#uniform(64 + i);
    this.host.write(ui, new Float32Array([iw, ih, 0, 0]));
    const cp = enc.beginComputePass({ label: "post " + pass.name + " in" });
    cp.setPipeline(this.toBuf);
    cp.setBindGroup(0, this.device.createBindGroup({ layout: this.toBuf.getBindGroupLayout(0), entries: [
      { binding: 0, resource: srcTex.createView() }, { binding: 1, resource: { buffer: e.input } }, { binding: 2, resource: { buffer: ui } }] }));
    cp.dispatchWorkgroups(Math.ceil(iw / 8), Math.ceil(ih / 8)); cp.end();
    e.record(enc, frame);
    const key = "from|" + dstFormat;
    let p = this.pipes.get(key);
    if (!p) {
      const module = this.device.createShaderModule({ label: "post from buffer", code: FROM_BUF });
      p = this.device.createRenderPipeline({ label: "post from buffer", layout: "auto", vertex: { module, entryPoint: "vs" },
        fragment: { module, entryPoint: "main", targets: [{ format: dstFormat }] }, primitive: { topology: "triangle-list" } });
      this.pipes.set(key, p);
    }
    const u = this.#uniform(i);
    this.host.write(u, new Float32Array([W, H, 0, 0]));
    const rp = enc.beginRenderPass({ label: "post " + pass.name + " out", colorAttachments: [{ view: dstView, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
    rp.setPipeline(p);
    rp.setBindGroup(0, this.device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: u } }, { binding: 1, resource: { buffer: e.output } }] }));
    rp.draw(3); rp.end();
    return true;
  }
  #pipe(name, code, format) {
    const key = name + "|" + format;
    let p = this.pipes.get(key);
    if (!p) {
      const module = this.device.createShaderModule({ label: "post " + name, code });
      p = this.device.createRenderPipeline({ label: "post " + name, layout: this.#layout(),
        vertex: { module, entryPoint: "vs" }, fragment: { module, entryPoint: "main", targets: [{ format }] }, primitive: { topology: "triangle-list" } });
      this.pipes.set(key, p);
    }
    return p;
  }
  // One explicit layout for every pass, so a pass need not use every binding.
  #layout() {
    if (!this.pl) {
      const F = 2; // GPUShaderStage.FRAGMENT
      this.bgl = this.device.createBindGroupLayout({ label: "post pass", entries: [
        { binding: 0, visibility: F, buffer: { type: "uniform" } },
        { binding: 1, visibility: F, texture: { sampleType: "float" } },
        { binding: 2, visibility: F, sampler: { type: "filtering" } },
        { binding: 3, visibility: F, texture: { sampleType: "float" } }] });
      this.pl = this.device.createPipelineLayout({ label: "post pass", bindGroupLayouts: [this.bgl] });
    }
    return this.pl;
  }
  #texture(key, w, h, format = HDR) {
    let t = this.tex.get(key);
    if (!t || t.width !== w || t.height !== h || t.format !== format) {
      if (t) t.destroy();
      t = this.device.createTexture({ label: "post " + key, size: [w, h], format, usage: USE.RENDER | USE.BIND | USE.COPY_SRC | USE.COPY_DST });
      this.tex.set(key, t);
    }
    return t;
  }
  #uniform(i) {
    while (this.ubufs.length <= i) this.ubufs.push(this.host.buffer({ size: 80, usage: ["uniform", "copy-dst"], label: "post pass " + this.ubufs.length }));
    return this.ubufs[i];
  }
  #draw(enc, pipe, ubuf, srcView, prevView, dstView, label) {
    const bind = this.device.createBindGroup({ layout: this.bgl, entries: [
      { binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: srcView }, { binding: 2, resource: this.sampler }, { binding: 3, resource: prevView }] });
    const rp = enc.beginRenderPass({ label, colorAttachments: [{ view: dstView, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
    rp.setPipeline(pipe); rp.setBindGroup(0, bind); rp.draw(3); rp.end();
  }
  // Run specs of one stage. input: a texture; out: { view, format } for the last pass, or
  // null to leave the result in a texture, which is returned. History passes render into
  // their own history texture (read back next frame as prev), then a blit forwards it.
  run(enc, specs, input, W, H, frame, time, out, stage, ubase = 0) {
    let cur = input, n = 0;
    specs.forEach((spec, i) => {
      const pass = getPass(spec.pass);
      if (pass.stage !== stage) throw new Error(`post pass ${pass.name} is a ${pass.stage} pass, listed among ${stage} passes`);
      const u = this.#uniform(ubase + i);
      const v = new Float32Array(20);
      v.set([W, H, frame, time]); v.set(passParams(pass, spec), 4);
      this.host.write(u, v);
      const last = i === specs.length - 1;
      if (pass.effect) {
        // An effect not ready yet (a live draw) is skipped: the frame goes through unchanged.
        const dst = last && out ? null : this.#texture(`${stage}:ping:${n++ % 2}`, W, H);
        if (this.#effect(enc, pass, spec, cur, dst ? dst.createView() : out.view, dst ? HDR : out.format, W, H, frame, ubase + i)) { if (dst) cur = dst; }
        else { this.prepare([spec], W, H); if (last && out) this.#draw(enc, this.#pipe("blit", BLIT, out.format), this.#uniform(ubase + i), cur.createView(), cur.createView(), out.view, "post blit"); }
        return;
      }
      const code = PASS_HEADER + pass.wgsl;
      if (pass.history) {
        const hist = this.#texture(`${stage}:hist:${i}:${pass.name}`, W, H), next = this.#texture(`${stage}:histnext:${i}`, W, H);
        this.#draw(enc, this.#pipe(pass.name, code, HDR), u, cur.createView(), hist.createView(), next.createView(), "post " + pass.name);
        enc.copyTextureToTexture({ texture: next }, { texture: hist }, [W, H]);
        cur = hist;
        if (last && out) this.#draw(enc, this.#pipe("blit", BLIT, out.format), u, hist.createView(), hist.createView(), out.view, "post blit");
      } else if (last && out) {
        this.#draw(enc, this.#pipe(pass.name, code, out.format), u, cur.createView(), cur.createView(), out.view, "post " + pass.name);
      } else {
        const dst = this.#texture(`${stage}:ping:${n++ % 2}`, W, H);
        this.#draw(enc, this.#pipe(pass.name, code, HDR), u, cur.createView(), cur.createView(), dst.createView(), "post " + pass.name);
        cur = dst;
      }
    });
    return cur;
  }
  destroy() {
    for (const t of this.tex.values()) t.destroy();
    for (const b of this.ubufs) b.destroy();
    for (const e of this.effects.values()) e.destroy && e.destroy();
  }
}
