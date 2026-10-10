// 2D compositing on the web host: layers of textures and canvases, drawn in order
// with "over" (premultiplied source-over) or "add" blending, with opacity and an
// optional rectangle, onto the host's canvas or any RGBA texture. A layer can be a
// 2D canvas: it is uploaded to a texture each frame, so a tool that draws with the
// canvas API composites with GPU layers on one device. composite2d() does the same
// with the canvas API alone, the fallback when the browser has no WebGPU.
//
//   const comp = await createCompositor(host);
//   comp.draw([{ source: canvas2d }, { source: texture, opacity: 0.6, blend: "add" }]);   // to the canvas
//   comp.draw(layers, { target: someTexture });                                          // off screen
//   composite2d(ctx2d, [{ source: canvas2d }, { source: img, opacity: 0.6 }]);           // no WebGPU

const WGSL = /* wgsl */ `
struct L { rect: vec4f, look: vec4f, }      // rect: x, y, w, h in target pixels; look: opacity, premultiplied input
@group(0) @binding(0) var<uniform> U: L;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f, }
@group(0) @binding(3) var<uniform> T: vec4f;  // target width, height
@vertex fn vs(@builtin(vertex_index) v: u32) -> VO {
  let c = vec2f(f32(v & 1u), f32((v >> 1u) & 1u));
  let px = U.rect.xy + c * U.rect.zw;
  var o: VO;
  o.p = vec4f(px.x / T.x * 2.0 - 1.0, 1.0 - px.y / T.y * 2.0, 0.0, 1.0);
  o.uv = c;
  return o;
}
@fragment fn fs(o: VO) -> @location(0) vec4f {
  var c = textureSampleLevel(tex, smp, o.uv, 0.0);
  if (U.look.y < 0.5) { c = vec4f(c.rgb * c.a, c.a); }     // straight alpha in, premultiplied out
  return c * U.look.x;
}`;

const OVER = { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" } };
const ADD = { color: { srcFactor: "one", dstFactor: "one", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one", operation: "add" } };

export async function createCompositor(host, { format = null } = {}) {
  const fmt = format || host.format || "rgba8unorm";
  const module = host.device.createShaderModule({ label: "compositor", code: WGSL });
  const make = (blend, f) => host.device.createRenderPipelineAsync({ label: "compositor " + f, layout: "auto", primitive: { topology: "triangle-strip" },
    vertex: { module, entryPoint: "vs" }, fragment: { module, entryPoint: "fs", targets: [{ format: f, blend }] } });
  const pipes = new Map();
  const pipe = async (blend, f) => { const k = blend + f; if (!pipes.has(k)) pipes.set(k, await make(blend === "add" ? ADD : OVER, f)); return pipes.get(k); };
  await pipe("over", fmt);
  return new Compositor(host, fmt, pipe);
}

class Compositor {
  constructor(host, format, pipe) {
    this.host = host; this.format = format; this.pipe = pipe;
    this.uploads = new WeakMap();      // canvas -> texture it is uploaded to
    this.ubufs = []; this.tbuf = host.buffer({ size: 16, usage: ["uniform", "copy-dst"], label: "compositor target" });
  }
  #textureFor(src) {
    if (src instanceof GPUTexture) return src;
    let t = this.uploads.get(src);
    const w = src.width, h = src.height;
    if (!t || t.width !== w || t.height !== h) { t = this.host.texture({ width: w, height: h, label: "compositor upload" }); this.uploads.set(src, t); }
    this.host.upload(t, src);
    return t;
  }
  // Draw layers in order. Each: { source, opacity = 1, blend = "over", rect = full target, premultiplied }.
  // A texture source is taken as premultiplied unless premultiplied: false; an uploaded canvas is straight.
  async draw(layers, { target = null, clear = [0, 0, 0, 0] } = {}) {
    const h = this.host, d = h.device;
    const tex = target || h.context.getCurrentTexture();
    const f = target ? target.format : this.format;
    const W = tex.width, H = tex.height;
    h.write(this.tbuf, new Float32Array([W, H, 0, 0]));
    const prepared = [];
    for (let i = 0; i < layers.length; i++) {
      const L = layers[i];
      const isTex = L.source instanceof GPUTexture;
      const t = this.#textureFor(L.source);
      const r = L.rect || [0, 0, W, H];
      if (!this.ubufs[i]) this.ubufs[i] = h.buffer({ size: 32, usage: ["uniform", "copy-dst"], label: "compositor layer " + i });
      h.write(this.ubufs[i], new Float32Array([r[0], r[1], r[2], r[3], L.opacity ?? 1, (L.premultiplied ?? isTex) ? 1 : 0, 0, 0]));
      const p = await this.pipe(L.blend === "add" ? "add" : "over", f);
      const bind = d.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: this.ubufs[i] } }, { binding: 1, resource: t.createView() },
        { binding: 2, resource: h.sampler({ filter: L.filter || "nearest" }) }, { binding: 3, resource: { buffer: this.tbuf } }] });
      prepared.push({ p, bind });
    }
    const enc = d.createCommandEncoder({ label: "compositor" });
    const ts = h.timer && h.timer.capacity ? { querySet: h.timer.set, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } : undefined;
    const rp = enc.beginRenderPass({ label: "composite", timestampWrites: ts,
      colorAttachments: [{ view: tex.createView(), loadOp: "clear", storeOp: "store", clearValue: clear }] });
    for (const { p, bind } of prepared) { rp.setPipeline(p); rp.setBindGroup(0, bind); rp.draw(4); }
    rp.end();
    if (ts) h.timer.resolve(enc, ["composite"]);
    d.queue.submit([enc.finish()]);
    if (ts) h.timer.collect();
  }
}

// The same layers with the canvas API alone (no WebGPU): "over" is source-over, "add" is lighter.
export function composite2d(ctx, layers, { clear = true } = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  if (clear) ctx.clearRect(0, 0, W, H);
  for (const L of layers) {
    const r = L.rect || [0, 0, W, H];
    ctx.save();
    ctx.globalAlpha = L.opacity ?? 1;
    ctx.globalCompositeOperation = L.blend === "add" ? "lighter" : "source-over";
    ctx.imageSmoothingEnabled = L.filter === "linear";
    ctx.drawImage(L.source, r[0], r[1], r[2], r[3]);
    ctx.restore();
  }
}
