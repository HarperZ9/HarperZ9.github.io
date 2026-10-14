// Colour-managed output for Motion: with post.colour set (a pipeline name from
// web/colour/colour.mjs, such as "aces2-sdr/srgb"), the frame is treated as
// scene-linear Rec.709. The finish keeps it linear, and this step tone-maps and
// encodes it with the same WGSL the colour tests hold to the C++ reference.
// Without post.colour nothing changes: colours stay display values, as before.
import { PIPELINES, pack, colourWGSL } from "../colour/colour.mjs";

const HEADER = /* wgsl */ `
@group(0) @binding(0) var<uniform> cp: ColourParams;
@group(0) @binding(1) var<storage, read> cd: array<f32>;
@group(0) @binding(2) var src: texture_2d<f32>;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
`;
const MAIN = /* wgsl */ `
@fragment fn main(@builtin(position) q: vec4f) -> @location(0) vec4f {
  let c = textureLoad(src, vec2i(q.xy), 0);
  return vec4f(colour_apply(max(c.rgb, vec3f(0.0))), 1.0);
}`;

export class ColourFinish {
  constructor(device) { this.device = device; this.pipes = new Map(); this.data = new Map(); this.tables = {}; this.code = null; }
  // Fetch the WGSL and the ACES 2.0 tables once (web/colour/tables/).
  async load() {
    this.code = HEADER + (await colourWGSL()) + MAIN;
    const aces = PIPELINES.filter((n) => n.startsWith("aces2"));
    await Promise.all(aces.map(async (n) => {
      const r = await fetch(new URL(`../colour/tables/${n.replace("/", "_")}.json`, import.meta.url));
      if (r.ok) this.tables[n] = await r.json();
    }));
  }
  #pipe(format) {
    let p = this.pipes.get(format);
    if (!p) {
      const module = this.device.createShaderModule({ label: "motion colour", code: this.code });
      p = this.device.createRenderPipeline({ label: "motion colour", layout: "auto", primitive: { topology: "triangle-list" },
        vertex: { module, entryPoint: "vs" }, fragment: { module, entryPoint: "main", targets: [{ format }] } });
      this.pipes.set(format, p);
    }
    return p;
  }
  #buffers(name) {
    let b = this.data.get(name);
    if (!b) {
      if (name.startsWith("aces2") && !this.tables[name]) throw new Error(`post.colour ${name}: its ACES 2.0 tables did not load`);
      const { params, data } = pack(name, this.tables[name] || null);
      const mk = (arr, usage) => { const g = this.device.createBuffer({ size: arr.byteLength, usage: usage | GPUBufferUsage.COPY_DST }); this.device.queue.writeBuffer(g, 0, arr); return g; };
      b = { u: mk(params, GPUBufferUsage.UNIFORM), d: mk(data, GPUBufferUsage.STORAGE) };
      this.data.set(name, b);
    }
    return b;
  }
  run(enc, name, srcTex, dstView, format) {
    if (!this.code) throw new Error("post.colour needs ColourFinish.load() first");
    const pipe = this.#pipe(format), b = this.#buffers(name);
    const bind = this.device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: b.u } }, { binding: 1, resource: { buffer: b.d } }, { binding: 2, resource: srcTex.createView() }] });
    const rp = enc.beginRenderPass({ label: "colour " + name, colorAttachments: [{ view: dstView, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
    rp.setPipeline(pipe); rp.setBindGroup(0, bind); rp.draw(3); rp.end();
  }
  destroy() { for (const b of this.data.values()) { b.u.destroy(); b.d.destroy(); } }
}
