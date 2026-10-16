// Lesson K23: the lab's WebGPU run, browser only. It runs fused-wgsl.mjs's
// kernels on the reader's own adapter (unfused: three dispatches, scores,
// softmax and P V; fused: one), checks O against the float64 reference within
// the bound in fused.mjs, and times the work. Times belong to the reader's
// device and are labelled with its adapter; the film never shows them.
// Nothing here runs in Node or in the fill: the fill and the tests use the
// emulator in fused-emu.mjs.
//
// Timing is wall time from submit to queue.onSubmittedWorkDone(), so it
// includes submission overhead; the lab reports the median of `reps` runs
// after one warm-up. The CPU reference costs N^2 d multiply-adds, so above
// N = 1024 only the first rowsChecked rows are checked, and the lab says so.

import { wgsl, tileFor } from "./fused-wgsl.mjs";
import { makeQKV, reference, checkAttention } from "./fused.mjs";
export { openDevice } from "./tiling-gpu.mjs";

function buffers(device, { q, k, v }, N, d, withS) {
  const U = GPUBufferUsage, mk = (data, usage) => { const b = device.createBuffer({ size: data.byteLength, usage, mappedAtCreation: true }); new Uint8Array(b.getMappedRange()).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)); b.unmap(); return b; };
  const params = new ArrayBuffer(16);
  new Uint32Array(params)[0] = N;
  new Float32Array(params)[1] = Math.fround(1 / Math.sqrt(d));
  return {
    q: mk(q, U.STORAGE), k: mk(k, U.STORAGE), v: mk(v, U.STORAGE), o: device.createBuffer({ size: N * d * 4, usage: U.STORAGE | U.COPY_SRC }),
    s: withS ? device.createBuffer({ size: N * N * 4, usage: U.STORAGE }) : null, params: mk(new Uint8Array(params), U.UNIFORM),
    read: device.createBuffer({ size: N * d * 4, usage: U.MAP_READ | U.COPY_DST }),
  };
}

// Bindings name exactly the buffers the kernel uses: a "layout: auto" pipeline
// drops unused declarations, and a bind group may not name them.
async function pipeline(device, B, kind, opts, bindings) {
  const module = device.createShaderModule({ code: wgsl(kind, opts) });
  const pipe = await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main" } });
  const entries = Object.entries(bindings).map(([binding, name]) => ({ binding: Number(binding), resource: { buffer: B[name] } }));
  return { pipe, bind: device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries }) };
}

// One variant at one size: correctness first, then timing.
export async function runAttention(device, { kind = "fused", N = 1024, d = 64, B = tileFor(d), reps = 9, seed = 1, rowsChecked = N <= 1024 ? N : 64 } = {}) {
  const inputs = makeQKV(N, d, seed), unfused = kind === "unfused", Bf = buffers(device, inputs, N, d, unfused), opts = { d, B, n: N }, G = Math.ceil(N / B);
  const steps = unfused
    ? [[await pipeline(device, Bf, "scores", opts, { 0: "q", 1: "k", 4: "s", 9: "params" }), G], [await pipeline(device, Bf, "softmax", opts, { 4: "s", 9: "params" }), N], [await pipeline(device, Bf, "pv", opts, { 2: "v", 3: "o", 4: "s", 9: "params" }), G]]
    : [[await pipeline(device, Bf, kind, opts, { 0: "q", 1: "k", 2: "v", 3: "o", 9: "params" }), G]];
  const dispatch = async () => {
    const enc = device.createCommandEncoder();
    for (const [{ pipe, bind }, groups] of steps) { const pass = enc.beginComputePass(); pass.setPipeline(pipe); pass.setBindGroup(0, bind); pass.dispatchWorkgroups(groups); pass.end(); }
    const t0 = performance.now();
    device.queue.submit([enc.finish()]);
    await device.queue.onSubmittedWorkDone();
    return performance.now() - t0;
  };
  await dispatch();
  const got = await readBack(device, Bf, N, d), rows = Math.min(N, rowsChecked), { q, k, v } = inputs;
  const check = { ...checkAttention(got.subarray(0, rows * d), reference(q, k, v, N, d, { Bc: B, rows })), rowsChecked: rows };
  const ms = [];
  for (let r = 0; r < reps; r++) ms.push(await dispatch());
  for (const b of Object.values(Bf)) b?.destroy();
  ms.sort((x, y) => x - y);
  return { kind, N, d, B, check, ms, medianMs: ms[ms.length >> 1] };
}

async function readBack(device, Bf, N, d) {
  const enc = device.createCommandEncoder();
  enc.copyBufferToBuffer(Bf.o, 0, Bf.read, 0, N * d * 4);
  device.queue.submit([enc.finish()]);
  await Bf.read.mapAsync(GPUMapMode.READ);
  const got = new Float32Array(Bf.read.getMappedRange().slice(0));
  Bf.read.unmap();
  return got;
}
