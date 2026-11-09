// Lesson K22: the lab's WebGPU run, browser only. It runs tiling.mjs's WGSL
// kernels on the reader's own adapter, checks C against the float64 CPU
// reference within the stated tolerance (tiling.mjs, checkMatmul), and times
// dispatches. Times belong to the reader's device and are labelled with its
// adapter info; the film never shows them. Nothing here runs in Node or in
// the fill: the fill and the tests use the emulator in tiling.mjs.
//
// Timing is wall time from submit to queue.onSubmittedWorkDone(), so it
// includes submission overhead; the lab reports the median of `reps` runs
// after one warm-up. The CPU reference at n = 1024 costs about a billion
// multiply-adds in JavaScript, so the lab checks the largest sizes in a
// worker, or checks a sample of rows (rowsChecked) and says so.

import { wgsl, makeMatrices, cpuReference, checkMatmul } from "./tiling.mjs";

export async function openDevice() {
  if (!globalThis.navigator?.gpu) return { ok: false, why: "this browser has no WebGPU (navigator.gpu is missing)" };
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { ok: false, why: "no WebGPU adapter was offered" };
  const device = await adapter.requestDevice();
  const info = adapter.info ?? {};
  return { ok: true, device, adapter: { vendor: info.vendor ?? "", architecture: info.architecture ?? "", description: info.description ?? "" }, limits: { maxComputeWorkgroupStorageSize: device.limits.maxComputeWorkgroupStorageSize, maxComputeInvocationsPerWorkgroup: device.limits.maxComputeInvocationsPerWorkgroup } };
}

function buffers(device, a, b, n) {
  const U = GPUBufferUsage, mk = (data, usage) => { const buf = device.createBuffer({ size: data.byteLength, usage, mappedAtCreation: true }); new data.constructor(buf.getMappedRange()).set(data); buf.unmap(); return buf; };
  return {
    a: mk(a, U.STORAGE), b: mk(b, U.STORAGE), c: device.createBuffer({ size: n * n * 4, usage: U.STORAGE | U.COPY_SRC }),
    params: mk(new Uint32Array([n, 0, 0, 0]), U.UNIFORM),
    read: device.createBuffer({ size: n * n * 4, usage: U.MAP_READ | U.COPY_DST }),
  };
}

// One kernel at one size and tile: correctness first, then timing.
export async function runKernel(device, { kind = "tiled", n = 512, T = 16, reps = 9, seed = 1, rowsChecked = n } = {}) {
  const groups = Math.ceil(n / T), { a, b } = makeMatrices(n, seed), B = buffers(device, a, b, n);
  const module = device.createShaderModule({ code: wgsl(kind, T) });
  const pipeline = await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main" } });
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
    { binding: 0, resource: { buffer: B.a } }, { binding: 1, resource: { buffer: B.b } },
    { binding: 2, resource: { buffer: B.c } }, { binding: 3, resource: { buffer: B.params } }] });
  const dispatch = async () => {
    const enc = device.createCommandEncoder(), pass = enc.beginComputePass();
    pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.dispatchWorkgroups(groups, groups); pass.end();
    const t0 = performance.now();
    device.queue.submit([enc.finish()]);
    await device.queue.onSubmittedWorkDone();
    return performance.now() - t0;
  };
  await dispatch();
  const got = await readBack(device, B, n), rows = Math.min(n, rowsChecked);
  const check = { ...checkMatmul(got, cpuReference(a, b, n, rows), n), rowsChecked: rows };
  const ms = [];
  for (let r = 0; r < reps; r++) ms.push(await dispatch());
  for (const k of ["a", "b", "c", "params", "read"]) B[k].destroy();
  ms.sort((x, y) => x - y);
  const med = ms[ms.length >> 1];
  return { kind, n, T, groups: groups * groups, check, ms, medianMs: med, gflops: (2 * n ** 3) / (med * 1e6) };
}

async function readBack(device, B, n) {
  const enc = device.createCommandEncoder();
  enc.copyBufferToBuffer(B.c, 0, B.read, 0, n * n * 4);
  device.queue.submit([enc.finish()]);
  await B.read.mapAsync(GPUMapMode.READ);
  const got = new Float32Array(B.read.getMappedRange().slice(0));
  B.read.unmap();
  return got;
}
