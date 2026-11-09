// The explainer kit's parity check, run in a browser by tests/web/explainer_parity.py through
// web/test/explainer-parity.html. The WGSL functions run in a compute kernel on rows of inputs
// and are compared with ref.mjs; the point layer is drawn through Motion and its blobs are
// located; a 1,048,576-point cloud is drawn and timed. Bounds: evidence/explainer-parity-bounds.json.
import { PARITY_WGSL } from "./wgsl.mjs";
import { orbFloats, atmosFloats, NIGHT, PAPER } from "./pack.mjs";
import { orbAt, atmosphereAt, bezier, pulseAt, hashUnit, lodKeep } from "./ref.mjs";
import { createLayers } from "./layers.mjs";

export const ORB_SPECS = [
  {},
  { iris: { blades: 7, open: 0.85, rot: 0.3 }, ring: 0.6, ringW: 0.015, spokes: 96, spokeSharp: 24, prism: 0.03 },
  { haloGain: 0.5, haloR: 1.6, coreR: 0.35, soft: 0.05 },
];
export const ATMOS_SPECS = [NIGHT, PAPER];
export const CURVE = [120, 900, 400, 100, 1500, 1800, 1900, 300];
// Controls: each must fail its bound.
export const CONTROLS = {
  orb: (w) => w.replace("let rc = r / s.p1.z;", "let rc = r / (s.p1.z * 1.03);"),
  hash: (w) => w.replace("x = x * 0x846ca68bu;", "x = x * 0x846ca68du;"),
};

function uniform(orb, atmos) {
  const f = new Float32Array(72), a = atmosFloats(atmos);
  f.set(orbFloats(orb), 0); f.set(a.floats, 28); f.set(a.bandC, 56); f.set(CURVE, 60);
  return f;
}

export async function kernel(device, code) {
  const module = device.createShaderModule({ code, label: "explainer parity" });
  const pipe = await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main" } });
  return async (uni, mode, rows) => {
    uni[68] = mode;
    const n = rows.length / 4, mk = (size, usage) => device.createBuffer({ size, usage });
    const U = mk(uni.byteLength, 0x40 | 0x08), I = mk(rows.byteLength, 0x80 | 0x08), O = mk(rows.byteLength, 0x80 | 0x04), R = mk(rows.byteLength, 0x01 | 0x08);
    device.queue.writeBuffer(U, 0, uni); device.queue.writeBuffer(I, 0, rows);
    const bg = device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [U, I, O].map((b, i) => ({ binding: i, resource: { buffer: b } })) });
    const enc = device.createCommandEncoder(), cp = enc.beginComputePass();
    cp.setPipeline(pipe); cp.setBindGroup(0, bg); cp.dispatchWorkgroups(Math.ceil(n / 64)); cp.end();
    enc.copyBufferToBuffer(O, 0, R, 0, rows.byteLength);
    device.queue.submit([enc.finish()]);
    await R.mapAsync(1);
    const out = new Float32Array(R.getMappedRange().slice(0));
    for (const b of [U, I, O, R]) b.destroy();
    return out;
  };
}

const stats = (errs) => { const s = Float64Array.from(errs).sort(); return { max: s[s.length - 1] || 0, p99: s[Math.floor(0.99 * (s.length - 1))] || 0, n: s.length }; };

async function orbCase(run, spec) {
  const rows = [], ref = [];
  for (let i = 0; i < 256; i++) for (let j = 0; j < 64; j++) {
    const r = (i + 0.5) / 128, th = -Math.PI + (j + 0.5) * (2 * Math.PI / 64);
    rows.push(r, th, 0, 0); ref.push(orbAt(r, th, spec));
  }
  const g = await run(uniform(spec, {}), 0, new Float32Array(rows)), errs = [];
  ref.forEach((c, k) => { for (let ch = 0; ch < 3; ch++) errs.push(Math.abs(g[4 * k + ch] - c[ch])); });
  return stats(errs);
}
async function atmosCase(run, spec) {
  const rows = [], ref = [];
  for (const t of [0, 37.5]) for (let y = 0; y < 72; y++) for (let x = 0; x < 128; x++) {
    const u = (x + 0.5) / 128, v = (y + 0.5) / 72;
    rows.push(u, v, t, 0); ref.push(atmosphereAt(u, v, t, spec));
  }
  const g = await run(uniform({}, spec), 1, new Float32Array(rows)), errs = [];
  ref.forEach((c, k) => { for (let ch = 0; ch < 3; ch++) errs.push(Math.abs(g[4 * k + ch] - c[ch])); });
  return stats(errs);
}
async function curveCase(run) {
  const rows = [], pts = [], pul = [];
  for (let i = 0; i <= 1000; i++) { const u = i / 1000, ph = (i * 0.37) % 1; rows.push(u, ph, 0.06, 0); pts.push(bezier(CURVE, u)); pul.push(pulseAt(u, ph, 0.06)); }
  const g = await run(uniform({}, {}), 2, new Float32Array(rows));
  const be = [], pe = [];
  pts.forEach((p, k) => { be.push(Math.hypot(g[4 * k] - p[0], g[4 * k + 1] - p[1])); pe.push(Math.abs(g[4 * k + 2] - pul[k])); });
  return { bezier: stats(be), pulse: stats(pe) };
}
async function lodCase(run, n = 65536, keeps = [0.01, 0.1, 0.25, 0.5, 0.9]) {
  let mismatches = 0;
  for (const keep of keeps) {
    const rows = new Float32Array(4 * n), u32 = new Uint32Array(rows.buffer);
    for (let i = 0; i < n; i++) { u32[4 * i] = i; rows[4 * i + 1] = keep; }
    const g = await run(uniform({}, {}), 3, rows);
    for (let i = 0; i < n; i++) if (g[4 * i] !== hashUnit(i) || (g[4 * i + 1] === 1) !== lodKeep(i, keep)) mismatches++;
  }
  return { ids: n, keeps, mismatches };
}

export async function runKernelChecks(device) {
  const run = await kernel(device, PARITY_WGSL), out = { orb: [], atmosphere: [] };
  for (const s of ORB_SPECS) out.orb.push(await orbCase(run, s));
  for (const s of ATMOS_SPECS) out.atmosphere.push(await atmosCase(run, s));
  Object.assign(out, await curveCase(run));
  out.lod = await lodCase(run);
  const orbCtl = await kernel(device, CONTROLS.orb(PARITY_WGSL)), hashCtl = await kernel(device, CONTROLS.hash(PARITY_WGSL));
  out.controls = { orb: await orbCase(orbCtl, ORB_SPECS[0]), hash: await lodCase(hashCtl, 4096, [0.25]) };
  return out;
}

// 64 isolated points, drawn and located. W x H = 512 x 288, the design is 1920 x 1080.
export async function placementCheck(motion, kit, shift = 1) {
  const W = 512, H = 288, n = 64, data = new Float32Array(4 * n), expect = [];
  for (let i = 0; i < n; i++) {
    const x = 160 + (i % 16) * 106.3 + (i * 7.31) % 10, y = 180 + Math.floor(i / 16) * 210 + (i * 3.7) % 10;
    data.set([x, y, 1, 0], 4 * i); expect.push([x * W / 1920, y * H / 1080]);
  }
  motion.resize(W, H);
  const cloud = kit.points(data);
  const list = { background: [0, 0, 0], items: [{ kind: "layer", layer: cloud, keep: 1, radius: 6, range: [0, 1], ramp: [[0, [1, 1, 1]], [1, [1, 1, 1]]] }], post: { bloom: 0, vignette: 0, grain: 0 } };
  const img = await motion.capture(list, { frame: 0 });
  const off = (sh) => expect.map(([ex, ey]) => {
    let sx = 0, sy = 0, sw = 0;
    for (let y = Math.floor(ey) - 7; y <= Math.floor(ey) + 7; y++) for (let x = Math.floor(ex) - 7; x <= Math.floor(ex) + 7; x++) {
      const w = img.data[4 * (y * W + x)] / 255; sx += w * (x + 0.5); sy += w * (y + 0.5); sw += w;
    }
    return sw ? [sx / sw - ex - sh, sy / sw - ey] : [Infinity, Infinity];
  });
  cloud.destroy();
  const e0 = off(0), e1 = off(shift), mean = (a, i) => a.reduce((s, v) => s + v[i], 0) / a.length;
  return { points: n, max: Math.max(...e0.map((v) => Math.hypot(...v))), meanDx: mean(e0, 0), meanDy: mean(e0, 1),
    controlShiftedMax: Math.max(...e1.map((v) => Math.hypot(...v))), offsets: e0.map((v) => v.map((x) => +x.toFixed(3))) };
}

// A 1,048,576-point cloud at 1280 x 720: the LOD the layer picks, the exact kept count on the GPU
// (the kernel) against the reference, and the time of a captured frame.
export async function millionCheck(motion, kit, device) {
  const n = 1 << 20, data = new Float32Array(4 * n);
  for (let i = 0; i < n; i++) { const a = (i * 2.399963) % (2 * Math.PI), r = Math.sqrt(i / n) * 420; data.set([960 + Math.cos(a) * r, 540 + Math.sin(a) * r, (i % 97) / 96, 0], 4 * i); }
  motion.resize(1280, 720);
  const cloud = kit.points(data), area = Math.PI * 420 * 420;
  const list = { background: [0, 0, 0], items: [{ kind: "layer", layer: cloud, area, radius: 1.5, range: [0, 1] }], post: { bloom: 0.4 } };
  await motion.capture(list, { frame: 0 });
  const t0 = performance.now();
  for (let f = 1; f <= 3; f++) await motion.capture(list, { frame: f });
  const ms = (performance.now() - t0) / 3, keep = cloud.last.keep, drawn = cloud.last.drawn;
  const run = await kernel(device, PARITY_WGSL), rows = new Float32Array(4 * n), u32 = new Uint32Array(rows.buffer);
  for (let i = 0; i < n; i++) { u32[4 * i] = i; rows[4 * i + 1] = keep; }
  const g = await run(uniform({}, {}), 3, rows);
  let gpuKept = 0, refKept = 0;
  for (let i = 0; i < n; i++) { if (g[4 * i + 1] === 1) gpuKept++; if (lodKeep(i, keep)) refKept++; }
  const t2 = performance.now();
  await motion.capture({ ...list, items: [] }, { frame: 8 });
  const msEmpty = performance.now() - t2;
  const full = { ...list, items: [{ ...list.items[0], keep: 1 }] };
  const t1 = performance.now();
  await motion.capture(full, { frame: 9 });
  const msFull = performance.now() - t1;
  cloud.destroy();
  return { points: n, keep, gpuKept, refKept, drawnInstances: drawn, countError: Math.max(Math.abs(gpuKept - refKept), Math.abs(drawn - refKept)), msPerFrameLod: ms, msFrameAllPoints: msFull, msFrameNoPoints: msEmpty, size: [1280, 720] };
}

export async function runAll() {
  const { createHost } = await import("../raw-gpu.mjs");
  const { createMotion } = await import("../motion/renderer.mjs");
  const canvas = document.createElement("canvas");
  const host = await createHost({ canvas, timing: false });
  const motion = await createMotion(host), kit = await createLayers(motion);
  const res = { kernel: await runKernelChecks(host.device) };
  res.placement = await placementCheck(motion, kit);
  res.million = await millionCheck(motion, kit, host.device);
  const ad = host.adapter;
  res.adapter = ad && ad.info ? `${ad.info.vendor} ${ad.info.architecture} ${ad.info.description || ""}`.trim() : "";
  return res;
}
