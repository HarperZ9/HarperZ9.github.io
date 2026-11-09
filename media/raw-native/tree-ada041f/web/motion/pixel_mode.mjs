// Pixel mode (ROADMAP M2 criterion 7): a display list with
//   pixel: { width, height, mode: "integer" | "sharp" }
// renders at that low resolution, then a scale pass draws it at the output size.
// - "integer": nearest neighbour by the integer factor (the output must be a multiple).
// - "sharp": the camera snaps to the low-resolution texel grid, and the residual becomes
//   a sub-texel offset of the shader library's sharp-bilinear filter, so a slow pan moves
//   edges smoothly without the texels themselves crawling.
// Post passes in the list run in the low-resolution render, before the scale.
// The CPU references are integerUpscale and sharpBilinear in web/shaders/pixel/scale.mjs;
// the fragment below is that library's SCALE_WGSL as a render pass.

const SCALE_WGSL = /* wgsl */ `
@group(0) @binding(0) var<uniform> S: vec4f;      // source w, h; output w, h
@group(0) @binding(1) var<uniform> O: vec4f;      // offset x, y in source texels; mode (0 integer, 1 sharp)
@group(0) @binding(2) var src: texture_2d<f32>;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
fn tex(x: i32, y: i32) -> vec4f { return textureLoad(src, vec2i(clamp(x, 0, i32(S.x) - 1), clamp(y, 0, i32(S.y) - 1)), 0) * 255.0; }
fn sharp_coord(i: f32, scale: f32, off: f32) -> f32 {
  let u = (i + 0.5) / scale + off;
  let seam = floor(u + 0.5) - 0.5;
  let d = clamp((u - (seam + 0.5)) * scale, -0.5, 0.5);
  return seam + 0.5 + d - 0.5;
}
@fragment fn fs(@builtin(position) q: vec4f) -> @location(0) vec4f {
  let p = floor(q.xy);
  if (O.z < 0.5) {
    let k = vec2u(u32(S.z) / u32(S.x), u32(S.w) / u32(S.y));
    return tex(i32(u32(p.x) / k.x), i32(u32(p.y) / k.y)) / 255.0;
  }
  let u = sharp_coord(p.x, S.z / S.x, O.x);
  let v = sharp_coord(p.y, S.w / S.y, O.y);
  let x0 = floor(u); let y0 = floor(v); let tx = u - x0; let ty = v - y0;
  let a = tex(i32(x0), i32(y0)) * (1.0 - tx) + tex(i32(x0) + 1, i32(y0)) * tx;
  let b = tex(i32(x0), i32(y0) + 1) * (1.0 - tx) + tex(i32(x0) + 1, i32(y0) + 1) * tx;
  return floor(a * (1.0 - ty) + b * ty + 0.5) / 255.0;
}`;

export class PixelMode {
  constructor(motion, createMotion) { this.m = motion; this.create = createMotion; this.child = null; this.size = null; this.pending = null; this.pipes = new Map(); }
  #key(list) { return `${list.pixel.width}x${list.pixel.height}`; }
  ready(list) { return !!this.child && this.size === this.#key(list); }
  async prepare(list) {
    const key = this.#key(list);
    if (this.ready(list)) return;
    if (this.pending && this.pending.key === key) return this.pending.p;
    const p = (async () => {
      const child = await this.create(this.m.host, { design: this.m.design });
      child.resize(list.pixel.width, list.pixel.height);
      for (const [name, im] of Object.entries(this.m.images)) child.image(name, im.src);
      child.lowTex = this.m.device.createTexture({ label: "motion pixel", size: [child.w, child.h], format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC });
      if (this.child) { this.child.lowTex.destroy(); this.child.destroy(); }
      this.child = child; this.size = key; this.pending = null;
    })();
    this.pending = { key, p };
    return p;
  }
  // The camera snapped to the texel grid, and the residual in texels.
  snap(list) {
    const cam = { x: 960, y: 540, zoom: 1, ...(list.camera || {}) }, k = (list.pixel.width / this.m.design[0]) * cam.zoom;
    if (list.pixel.mode !== "sharp") return { cam, off: [0, 0] };
    const sx = Math.round(cam.x * k) / k, sy = Math.round(cam.y * k) / k;
    return { cam: { ...cam, x: sx, y: sy }, off: [(cam.x - sx) * k, (cam.y - sy) * k] };
  }
  render(list, opts, targetView, format) {
    const c = this.child, d = this.m.device, { cam, off } = this.snap(list);
    // Images added to the parent after the child was made reach it too.
    for (const [name, im] of Object.entries(this.m.images)) if (!c.images[name]) c.image(name, im.src);
    c.renderTo({ ...list, pixel: undefined, camera: cam }, opts, c.lowTex.createView(), "rgba8unorm");
    let pipe = this.pipes.get(format);
    if (!pipe) {
      const module = d.createShaderModule({ label: "motion pixel scale", code: SCALE_WGSL });
      pipe = d.createRenderPipeline({ label: "motion pixel scale", layout: "auto", primitive: { topology: "triangle-list" },
        vertex: { module, entryPoint: "vs" }, fragment: { module, entryPoint: "fs", targets: [{ format }] } });
      this.pipes.set(format, pipe);
    }
    if (!this.ub) {
      const u = () => d.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      this.ub = u(); this.uo = u();
    }
    d.queue.writeBuffer(this.ub, 0, new Float32Array([c.w, c.h, this.m.w, this.m.h]));
    d.queue.writeBuffer(this.uo, 0, new Float32Array([off[0], off[1], list.pixel.mode === "sharp" ? 1 : 0, 0]));
    const enc = d.createCommandEncoder({ label: "motion pixel scale" });
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: targetView, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
    rp.setPipeline(pipe);
    rp.setBindGroup(0, d.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: this.ub } }, { binding: 1, resource: { buffer: this.uo } }, { binding: 2, resource: c.lowTex.createView() }] }));
    rp.draw(3); rp.end();
    d.queue.submit([enc.finish()]);
  }
  // The low-resolution frame as RGBA8 rows, for the checks against the CPU references.
  readLow() {
    const c = this.child, bpr = Math.ceil((c.w * 4) / 256) * 256;
    const buf = this.m.device.createBuffer({ size: bpr * c.h, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const enc = this.m.device.createCommandEncoder({ label: "motion pixel read" });
    enc.copyTextureToBuffer({ texture: c.lowTex }, { buffer: buf, bytesPerRow: bpr }, [c.w, c.h]);
    this.m.device.queue.submit([enc.finish()]);
    return readRGBA8({ buf, bpr }, c.w, c.h).finally(() => buf.destroy());
  }
  destroy() {
    if (this.child) { this.child.lowTex.destroy(); this.child.destroy(); this.child = null; }
    for (const b of [this.ub, this.uo]) if (b) b.destroy();
  }
}

// Map a readback { buf, bpr } into tight rows: RGBA8, or rgba16float decoded to Float32.
export async function readRGBA8(r, W, H) {
  await r.buf.mapAsync(1);
  const src = new Uint8Array(r.buf.getMappedRange()), row = W * 4, data = new Uint8Array(row * H);
  if (r.bpr === row) data.set(src.subarray(0, row * H));
  else for (let y = 0; y < H; y++) data.set(src.subarray(y * r.bpr, y * r.bpr + row), y * row);
  r.buf.unmap();
  return { width: W, height: H, data };
}
export async function readHalf(r, W, H) {
  await r.buf.mapAsync(1);
  const src = new Uint16Array(r.buf.getMappedRange()), data = new Float32Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W * 4; x++) {
    const h = src[(y * r.bpr) / 2 + x], e = (h >> 10) & 31, f = h & 1023, s = h & 0x8000 ? -1 : 1;
    data[y * W * 4 + x] = e === 0 ? s * f * 2 ** -24 : e === 31 ? s * Infinity : s * (1 + f / 1024) * 2 ** (e - 15);
  }
  r.buf.unmap();
  return { width: W, height: H, data };
}
