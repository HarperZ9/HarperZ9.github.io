// What the traversal owns on the GPU: the world's maps, the frame and lamp blocks, the one
// bind-group layout every pass shares, the float targets, and the passes that run after the
// world is drawn (fog and lamp light in the air, bloom, the film curve).
import { NEAR } from "./near.mjs";

export const HDR = "rgba16float", DEPTH = "depth32float";
// where each field of the frame block starts, in floats (common.wgsl struct Frame)
export const OFF = { viewProj: 0, invViewProj: 16, cam: 32, key: 36, sun: 40, moon: 44, zenith: 48, horizon: 52, fog: 56, fogp: 60, wx: 64, ev: 68, misc: 72, keyCol: 76, amb: 80, lamp: 84, world: 88, glow: 92, near: 96, snowp: 100, gfog: 104, view: 108, walk: 112, trail: 116, shadowVP: 148, shp: 164, clip: 168 };
export const FRAME_FLOATS = 172;

// a float as the 16 bits of a half
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
function toHalf(v) {
  f32[0] = v; const x = u32[0], s = (x >> 16) & 0x8000, e = ((x >> 23) & 0xff) - 112, m = x & 0x7fffff;
  if (e <= 0) return s; if (e >= 31) return s | 0x7c00;
  return s | (e << 10) | (m >> 13);
}

export async function makeStage(dev, canvasFormat, world, maps) {
  const { W, H } = world, VIS = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, FR = GPUShaderStage.FRAGMENT, TB = GPUTextureUsage.TEXTURE_BINDING, CD = GPUTextureUsage.COPY_DST, RA = GPUTextureUsage.RENDER_ATTACHMENT;
  const tex2 = (format, w, h, data, bytes, mips = 1) => {
    const t = dev.createTexture({ size: [w, h], format, usage: TB | CD | RA, mipLevelCount: mips });
    if (data) dev.queue.writeTexture({ texture: t }, data, { bytesPerRow: w * bytes }, [w, h]);
    return t;
  };
  const heightTex = tex2("r32float", W, H, world.height, 4), waterTex = tex2("r32float", W, H, world.water, 4), albTex = tex2("rgba8unorm", W, H, maps.alb, 4, 3), auxTex = tex2("rgba8unorm", W, H, maps.aux, 4, 3);
  // two coarser levels of the colour and aux maps, by box average
  function refreshMips() {
    for (const t of [albTex, auxTex]) {
      let src = t === albTex ? maps.alb : maps.aux, w = W, h = H;
      for (let l = 1; l < 3; l++) {
        const nw = w >> 1, nh = h >> 1, dst = new Uint8Array(nw * nh * 4);
        for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) for (let c = 0; c < 4; c++) dst[(y * nw + x) * 4 + c] = (src[(2 * y * w + 2 * x) * 4 + c] + src[(2 * y * w + 2 * x + 1) * 4 + c] + src[((2 * y + 1) * w + 2 * x) * 4 + c] + src[((2 * y + 1) * w + 2 * x + 1) * 4 + c]) >> 2;
        dev.queue.writeTexture({ texture: t, mipLevel: l }, dst, { bytesPerRow: nw * 4 }, [nw, nh]);
        src = dst; w = nw; h = nh;
      }
    }
  }
  refreshMips();
  // a box of cells has changed (a tile landed): send those rows of the four maps again
  function updateRect(x0, y0, w, h) {
    const f = new Float32Array(w * h), b = new Uint8Array(w * h * 4);
    for (const [t, src] of [[heightTex, world.height], [waterTex, world.water]]) { for (let y = 0; y < h; y++) f.set(src.subarray((y0 + y) * W + x0, (y0 + y) * W + x0 + w), y * w); dev.queue.writeTexture({ texture: t, origin: [x0, y0] }, f, { bytesPerRow: w * 4 }, [w, h]); }
    for (const [t, src] of [[albTex, maps.alb], [auxTex, maps.aux]]) { for (let y = 0; y < h; y++) b.set(src.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x0 + w) * 4), y * w * 4); dev.queue.writeTexture({ texture: t, origin: [x0, y0] }, b, { bytesPerRow: w * 4 }, [w, h]); }
  }
  // the ground averaged over half a kilometre and more: where it lies below this, fog pools
  const cw = W >> 3, ch = H >> 3, mean = new Float32Array(cw * ch), coarse = new Uint16Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { let s = 0; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) s += Math.max(0, world.height[(y * 8 + j) * W + x * 8 + i]); mean[y * cw + x] = s / 64; }
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    let s = 0, n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < cw && yy < ch) { s += mean[yy * cw + xx]; n++; } }
    coarse[y * cw + x] = toHalf(s / n);
  }
  const coarseTex = tex2("r16float", cw, ch, coarse, 2);
  const nearA = tex2("rgba8unorm", NEAR, NEAR), nearB = tex2("rgba8unorm", NEAR, NEAR);
  const blank = tex2("rgba8unorm", 1, 1, new Uint8Array([0, 0, 0, 0]), 4), blankHdr = tex2(HDR, 1, 1);
  const blankDepth = dev.createTexture({ size: [1, 1], format: DEPTH, usage: TB | RA });
  const samp = dev.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
  const rsamp = dev.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", addressModeU: "repeat", addressModeV: "repeat", maxAnisotropy: 8 });
  const shadowSamp = dev.createSampler({ compare: "greater-equal", magFilter: "linear", minFilter: "linear" });

  const frameBuf = (label) => dev.createBuffer({ size: FRAME_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, label });
  const frames = { main: frameBuf("frame"), mirror: frameBuf("frame mirror"), bake: frameBuf("frame bake"), shadow: frameBuf("frame shadow") };
  const lightBuf = dev.createBuffer({ size: 16 + 64 * 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }), noLightBuf = dev.createBuffer({ size: 16 + 64 * 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const flt = (v, t = "float") => ({ visibility: v, texture: { sampleType: t } });
  const layout = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: VIS, buffer: {} }, { binding: 1, visibility: VIS, buffer: {} },
    { binding: 2, ...flt(VIS, "unfilterable-float") }, { binding: 3, ...flt(VIS, "unfilterable-float") }, { binding: 4, ...flt(FR) }, { binding: 5, ...flt(VIS) },
    { binding: 6, visibility: VIS, sampler: {} }, { binding: 7, ...flt(VIS) }, { binding: 8, ...flt(VIS) }, { binding: 9, visibility: FR, sampler: {} },
    { binding: 10, ...flt(FR) }, { binding: 11, ...flt(FR) }, { binding: 12, ...flt(FR) }, { binding: 13, ...flt(FR, "depth") }, { binding: 14, visibility: FR, sampler: { type: "comparison" } }] });
  const postLayout = dev.createBindGroupLayout({ entries: [{ binding: 0, ...flt(FR) }, { binding: 1, ...flt(FR, "depth") }, { binding: 2, ...flt(FR) }, { binding: 3, ...flt(FR) }] });

  const st = { atlas: blank, far: blank, shadow: blankDepth, mirror: null, w: 0, h: 0, binds: {}, targets: null };
  function rebind() {
    const make = (buf, mirrorView, lights = lightBuf, shadow = st.shadow) => dev.createBindGroup({ layout, entries: [
      { binding: 0, resource: { buffer: buf } }, { binding: 1, resource: { buffer: lights } }, { binding: 2, resource: heightTex.createView() }, { binding: 3, resource: waterTex.createView() },
      { binding: 4, resource: albTex.createView() }, { binding: 5, resource: auxTex.createView() }, { binding: 6, resource: samp }, { binding: 7, resource: nearA.createView() }, { binding: 8, resource: nearB.createView() },
      { binding: 9, resource: rsamp }, { binding: 10, resource: st.atlas.createView() }, { binding: 11, resource: st.far.createView() }, { binding: 12, resource: mirrorView }, { binding: 13, resource: shadow.createView() }, { binding: 14, resource: shadowSamp }] });
    const mv = st.targets ? st.targets.mirror.createView() : blankHdr.createView();
    st.binds = { main: make(frames.main, mv), mirror: make(frames.mirror, blankHdr.createView()), bake: make(frames.bake, blankHdr.createView(), noLightBuf, blankDepth), shadow: make(frames.shadow, blankHdr.createView(), noLightBuf, blankDepth) };
  }

  // ---------------------------------------------------------------- shaders and pipelines
  const text = async (f) => (await fetch(new URL(f, import.meta.url))).text(), common = await text("common.wgsl");
  async function module(...files) {
    const code = common + "\n" + (await Promise.all(files.map(text))).join("\n"), m = dev.createShaderModule({ code, label: files.join("+") });
    const bad = (await m.getCompilationInfo()).messages.filter((x) => x.type === "error");
    if (bad.length) throw new Error(`${files.join("+")}: ${bad.slice(0, 4).map((x) => `line ${x.lineNum - common.split("\n").length}: ${x.message}`).join("; ")}`);
    return m;
  }
  const BLEND = {
    alpha: { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } },
    add: { color: { srcFactor: "one", dstFactor: "one" }, alpha: { srcFactor: "zero", dstFactor: "one" } },
    premul: { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } },
  };
  // depth: "write" tests and writes, "test" tests only, "none" draws over everything; format null draws depth alone
  function pipe(mod, vs, fs, buffers, { depth = "write", blend = null, topology = "triangle-list", format = HDR, post = false, bias = 0 } = {}) {
    return dev.createRenderPipeline({
      layout: dev.createPipelineLayout({ bindGroupLayouts: post ? [layout, postLayout] : [layout] }), vertex: { module: mod, entryPoint: vs, buffers },
      fragment: fs ? { module: mod, entryPoint: fs, targets: format ? [{ format, blend: blend ? BLEND[blend] : undefined }] : [] } : undefined,
      primitive: { topology, cullMode: "none" },
      depthStencil: post ? undefined : { format: DEPTH, depthWriteEnabled: depth === "write", depthCompare: depth === "none" ? "always" : "greater", depthBias: bias, depthBiasSlopeScale: bias ? -2 : 0 },
    });
  }
  const postM = await module("post.wgsl");
  const P = { fog: pipe(postM, "vsFull", "fsFog", [], { post: true }), down0: pipe(postM, "vsFull", "fsDown0", [], { post: true }), down: pipe(postM, "vsFull", "fsDown", [], { post: true }),
    up: pipe(postM, "vsFull", "fsUp", [], { post: true, blend: "add" }), final: pipe(postM, "vsFull", "fsFinal", [], { post: true, format: canvasFormat }) };

  // ---------------------------------------------------------------- targets
  function resize(w, h) {
    if (st.w === w && st.h === h) return;
    if (st.targets) for (const t of Object.values(st.targets).flat()) t.destroy();
    const t = (ww, hh, format = HDR) => dev.createTexture({ size: [Math.max(1, ww), Math.max(1, hh)], format, usage: TB | RA });
    const bloom = []; for (let i = 1; i <= 6; i++) bloom.push(t(w >> i, h >> i));
    st.targets = { scene: t(w, h), fogged: t(w, h), depth: t(w, h, DEPTH), mirror: t(w >> 1, h >> 1), mirrorDepth: t(w >> 1, h >> 1, DEPTH), bloom };
    st.w = w; st.h = h;
    const pg = (src, depth, bloomT) => dev.createBindGroup({ layout: postLayout, entries: [{ binding: 0, resource: src.createView() }, { binding: 1, resource: depth.createView() }, { binding: 2, resource: bloomT.createView() }, { binding: 3, resource: coarseTex.createView() }] });
    const T = st.targets;
    st.post = { fog: pg(T.scene, T.depth, blankHdr), down: [pg(T.fogged, blankDepth, blankHdr), ...bloom.slice(0, -1).map((b) => pg(b, blankDepth, blankHdr))], up: bloom.map((b) => pg(b, blankDepth, blankHdr)), final: pg(T.fogged, blankDepth, bloom[0]) };
    rebind();
  }
  function post(enc, canvasView) {
    const T = st.targets, run = (view, pipeline, group, load = "clear") => {
      const p = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: load, storeOp: "store", clearValue: [0, 0, 0, 1] }] });
      p.setPipeline(pipeline); p.setBindGroup(0, st.binds.main); p.setBindGroup(1, group); p.draw(3); p.end();
    };
    run(T.fogged.createView(), P.fog, st.post.fog);
    T.bloom.forEach((b, i) => run(b.createView(), i ? P.down : P.down0, st.post.down[i]));
    for (let i = T.bloom.length - 1; i > 0; i--) run(T.bloom[i - 1].createView(), P.up, st.post.up[i], "load");
    run(canvasView, P.final, st.post.final);
  }
  function uploadNear(near) {
    dev.queue.writeTexture({ texture: nearA }, near.state.A, { bytesPerRow: NEAR * 4 }, [NEAR, NEAR]);
    dev.queue.writeTexture({ texture: nearB }, near.state.B, { bytesPerRow: NEAR * 4 }, [NEAR, NEAR]);
  }
  rebind();
  return { st, frames, lightBuf, layout, module, pipe, resize, post, uploadNear, rebind, tex2, updateRect, refreshMips,
    set(name, texture) { st[name] = texture; rebind(); },
    writeFrame(which, data) { dev.queue.writeBuffer(frames[which], 0, data); },
    writeLights(block) { dev.queue.writeBuffer(lightBuf, 0, block); } };
}
