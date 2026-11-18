// The device, the scene on the GPU, the pipelines and the per-pixel buffers. frame.mjs records a frame with them.
import { createHost } from "/media/raw-native/web-sf-cac3416/raw-gpu.mjs";
import { FRAME_FLOATS, pageWGSL } from "./wgsl-lib.mjs";
import { RASTER, PACK, SHADE, FOG, COMPOSE, TILT } from "./rt-wgsl.mjs";
import { REF_PINHOLE, PATH, MEASURE, REDUCE, PRESENT } from "./ref-wgsl.mjs";

const U = () => GPUBufferUsage, S = () => GPUShaderStage;
export const groups64 = (n) => { const g = Math.ceil(n / 64); return [Math.min(g, 32768), Math.ceil(g / 32768)]; };

// a bind group layout from letters: u uniform, r read-only storage, w storage, t float texture
function layout(device, spec, visibility) {
  return device.createBindGroupLayout({ entries: [...spec].map((c, binding) => ({ binding, visibility,
    ...(c === "u" ? { buffer: { type: "uniform" } } : c === "r" ? { buffer: { type: "read-only-storage" } } : c === "w" ? { buffer: { type: "storage" } } : { texture: { sampleType: "unfilterable-float" } }) })) });
}

export async function createGpu(canvas, engine) {
  const host = await createHost({ canvas, timing: true });
  const device = host.device, all = S().COMPUTE | S().FRAGMENT | S().VERTEX;
  device.addEventListener?.("uncapturederror", (e) => console.error("[raw live] GPU error:", e.error && e.error.message));
  const g0 = layout(device, "urrrr", all), g0s = layout(device, "u", all), gC = layout(device, "ur", S().COMPUTE | S().FRAGMENT);
  const mod = async (label, code) => {
    const m = device.createShaderModule({ label, code });
    const info = await m.getCompilationInfo();
    const errs = info.messages.filter((x) => x.type === "error");
    if (errs.length) throw new Error(`${label}: ${errs.map((x) => `${x.lineNum}:${x.linePos} ${x.message}`).join("; ")}`);
    return m;
  };
  // traced passes see the scene (group 0 with the tree); the rest see only the frame, which keeps every pass
  // within the 8 storage buffers a stage WebGPU promises on any adapter
  const page = async (label, body, g1spec, { colour = false, traced = false } = {}) => {
    const module = await mod(label, pageWGSL(engine, body));
    const g1 = layout(device, g1spec, S().COMPUTE);
    const first = traced ? g0 : g0s;
    const pipe = await device.createComputePipelineAsync({ label, layout: device.createPipelineLayout({ bindGroupLayouts: colour ? [first, g1, gC] : [first, g1] }), compute: { module, entryPoint: "main" } });
    return { pipe, g1, traced };
  };
  const colour = engine.colourWGSL;
  const P = {
    pack: await page("pack", PACK, "tttwwww"),
    shade: await page("shade", SHADE, "rrrw", { traced: true }),
    fog: await page("fog", FOG, "rw", { traced: true }),
    compose: await page("compose", COMPOSE, "rrrrrwww"),
    tilt: await page("tilt", TILT, "rrw"),
    refPinhole: await page("reference: pinhole", REF_PINHOLE, "ww", { traced: true }),
    path: await page("reference: path", PATH, "w", { traced: true }),
    measure: await page("measure", MEASURE(colour), "rrrrrrw", { colour: true }),
    gtao: await host.compute("engine post_gtao", engine.gtao),
    ssr: await host.compute("engine post_ssr", engine.ssr),
    taa: await host.compute("engine post_taa", engine.taa),
    reduce: await host.compute("reduce", REDUCE),
  };
  // raster and present: render pipelines on the same layouts
  const rmod = await mod("raster", pageWGSL(engine, RASTER));
  const vbuf = [{ arrayStride: 28, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }, { shaderLocation: 1, offset: 12, format: "float32x3" }, { shaderLocation: 2, offset: 24, format: "uint32" }] }];
  const rl = device.createPipelineLayout({ bindGroupLayouts: [g0s] });
  const prim = { topology: "triangle-list", cullMode: "none" };
  P.raster = await device.createRenderPipelineAsync({ label: "raster", layout: rl, primitive: prim, vertex: { module: rmod, entryPoint: "vs", buffers: vbuf },
    fragment: { module: rmod, entryPoint: "fs", targets: [{ format: "rgba32float" }, { format: "rgba32float" }] }, depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less" } });
  P.back = await device.createRenderPipelineAsync({ label: "raster back", layout: rl, primitive: prim, vertex: { module: rmod, entryPoint: "vs", buffers: vbuf },
    fragment: { module: rmod, entryPoint: "fsBack", targets: [{ format: "r32float" }] }, depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less" } });
  const pmod = await mod("present", pageWGSL(engine, PRESENT(colour)));
  const pg1 = layout(device, "rrrrrr", S().FRAGMENT);
  P.present = await device.createRenderPipelineAsync({ label: "present", layout: device.createPipelineLayout({ bindGroupLayouts: [g0s, pg1, gC] }), primitive: { topology: "triangle-list" },
    vertex: { module: pmod, entryPoint: "vs" }, fragment: { module: pmod, entryPoint: "fs", targets: [{ format: host.format }] } });
  P.present.g1 = pg1;

  const buf = (size, usage, label, data) => {
    const b = device.createBuffer({ label, size: Math.max(16, Math.ceil(size / 4) * 4), usage });
    if (data) device.queue.writeBuffer(b, 0, data);
    return b;
  };
  const frameU = buf(FRAME_FLOATS * 4, U().UNIFORM | U().COPY_DST, "frame");
  const postU = buf(80, U().UNIFORM | U().COPY_DST, "post params"), taaU = buf(80, U().UNIFORM | U().COPY_DST, "taa params");
  const cpack = engine.colourPack("aces2-sdr/srgb", engine.aces);
  const colourU = buf(16, U().UNIFORM | U().COPY_DST, "colour params", cpack.params), colourD = buf(cpack.data.byteLength, U().STORAGE | U().COPY_DST, "colour data", cpack.data);
  const frameG = device.createBindGroup({ layout: g0s, entries: [{ binding: 0, resource: { buffer: frameU } }] });
  const colourG = device.createBindGroup({ layout: gC, entries: [{ binding: 0, resource: { buffer: colourU } }, { binding: 1, resource: { buffer: colourD } }] });
  return { host, device, P, g0, frameG, buf, frameU, postU, taaU, colourU, colourD, colourG, setColour(name) {
    const c = engine.colourPack(name, name.startsWith("aces2") ? engine.aces : null);
    device.queue.writeBuffer(colourU, 0, c.params); device.queue.writeBuffer(colourD, 0, c.data);
  } };
}

// the scene on the GPU: vertices for the rasterizer, the tree and its triangles for the tracers, the materials
export function uploadScene(gpu, scene, tree) {
  const { device, buf, g0, frameU } = gpu, nt = scene.triMat.length;
  const vb = new ArrayBuffer(nt * 3 * 28), vf = new Float32Array(vb), vu = new Uint32Array(vb);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const o = (3 * t + k) * 7, p = 9 * t + 3 * k;
    vf[o] = scene.positions[p]; vf[o + 1] = scene.positions[p + 1]; vf[o + 2] = scene.positions[p + 2];
    vf[o + 3] = scene.normals[p]; vf[o + 4] = scene.normals[p + 1]; vf[o + 5] = scene.normals[p + 2]; vu[o + 6] = scene.triMat[t];
  }
  const attr = new Float32Array(nt * 10);
  for (let i = 0; i < nt; i++) { const t = tree.order[i]; attr.set(scene.normals.subarray(9 * t, 9 * t + 9), 10 * i); attr[10 * i + 9] = scene.triMat[t]; }
  const mats = new Float32Array(scene.materials.length * 8);
  scene.materials.forEach((m, i) => mats.set([...m.albedo, m.rough, ...m.emit, m.metal], 8 * i));
  const st = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
  const s = { nt, vertices: buf(vb.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, "vertices", vb),
    nodes: buf(tree.nodes.byteLength, st, "bvh nodes", tree.nodes), btris: buf(tree.btris.byteLength, st, "bvh triangles", tree.btris),
    attr: buf(attr.byteLength, st, "triangle attributes", attr), mats: buf(mats.byteLength, st, "materials", mats) };
  s.group = device.createBindGroup({ layout: g0, entries: [frameU, s.nodes, s.btris, s.attr, s.mats].map((b, binding) => ({ binding, resource: { buffer: b } })) });
  s.destroy = () => { for (const k of ["vertices", "nodes", "btris", "attr", "mats"]) s[k].destroy(); };
  return s;
}

// every per-pixel buffer and target at one size; bytes says what they cost
export function allocate(gpu, w, h) {
  const { device, buf } = gpu, n = w * h, st = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, cs = GPUBufferUsage.COPY_SRC;
  const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2), wg = groups64(n);
  const B = {
    G: 32, M: 4, D0: 4, D1: 4, R: 12, AO: 4, LR: 32, HIT: 4, C: 16, H0: 12, H1: 12, OUT: 16, ACC: 32, RA: 16, PA: 16,
  };
  const r = { w, h, n, wg, bytes: 0 };
  for (const [k, per] of Object.entries(B)) { r[k] = buf(per * n, st | cs, k); r.bytes += per * n; }
  r.FG = buf(16 * hw * hh, st, "fog"); r.bytes += 16 * hw * hh;
  r.PART = buf(32 * wg[0] * wg[1], st, "partial sums"); r.SUM = buf(32, st | cs, "sums");
  r.read = [0, 1].map(() => device.createBuffer({ size: 32, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }));
  const tex = (format, label) => device.createTexture({ label, size: [w, h], format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
  r.ta = tex("rgba32float", "ta"); r.tb = tex("rgba32float", "tb"); r.tk = tex("r32float", "tk"); r.z0 = tex("depth32float", "z0"); r.z1 = tex("depth32float", "z1");
  r.bytes += n * (16 + 16 + 4 + 8);
  r.destroy = () => { for (const v of Object.values(r)) if (v && v.destroy) v.destroy(); for (const b of r.read) b.destroy(); };
  return r;
}

export const usages = { U, S };
