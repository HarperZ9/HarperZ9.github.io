// Lesson K21: the lab's WebGPU run, browser only. It runs threads.mjs's WGSL
// kernels on the reader's own adapter, checks the output against the CPU
// reference (canary words past the binding catch writes past the end) and
// times dispatches. Times are the reader's device, labelled with its adapter
// info; the film never shows them. Nothing here runs in Node or in the fill:
// the fill and the tests use the emulator in threads.mjs.
//
// Timing is wall time from submit to queue.onSubmittedWorkDone(), so it
// includes submission overhead; the lab says so and reports the median of
// `reps` runs after one warm-up. The lab keeps n at most
// maxComputeWorkgroupsPerDimension * workgroup size so one 1-D dispatch
// covers the array.

import { wgsl, params, makeInputs, cpuReference, checkOutput, CANARY, SPEC } from "./threads.mjs";

export async function openDevice() {
  if (!globalThis.navigator?.gpu) return { ok: false, why: "this browser has no WebGPU (navigator.gpu is missing)" };
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { ok: false, why: "no WebGPU adapter was offered" };
  const device = await adapter.requestDevice();
  const info = adapter.info ?? {};
  return { ok: true, device, adapter: { vendor: info.vendor ?? "", architecture: info.architecture ?? "", description: info.description ?? "", subgroupMinSize: info.subgroupMinSize ?? null, subgroupMaxSize: info.subgroupMaxSize ?? null }, limits: { maxComputeWorkgroupSizeX: device.limits.maxComputeWorkgroupSizeX, maxComputeInvocationsPerWorkgroup: device.limits.maxComputeInvocationsPerWorkgroup, maxComputeWorkgroupsPerDimension: device.limits.maxComputeWorkgroupsPerDimension } };
}

function buffers(device, a, b, n, pad, p) {
  const U = GPUBufferUsage, mk = (data, usage) => { const buf = device.createBuffer({ size: data.byteLength, usage, mappedAtCreation: true }); new data.constructor(buf.getMappedRange()).set(data); buf.unmap(); return buf; };
  const outInit = new Float32Array(n + pad).fill(CANARY, n);
  return {
    a: mk(a, U.STORAGE), b: mk(b, U.STORAGE), out: mk(outInit, U.STORAGE | U.COPY_SRC),
    params: mk(new Uint32Array([p.n, p.stride, p.rows, 0]), U.UNIFORM),
    read: device.createBuffer({ size: (n + pad) * 4, usage: U.MAP_READ | U.COPY_DST }),
  };
}

// One kernel at one workgroup size: correctness first, then timing.
export async function runKernel(device, { kind = "add", n = 1 << 20, wg = 64, stride = 1, reps = 9, pad = 64, seed = 1 } = {}) {
  const groups = Math.ceil(n / wg);
  if (groups > SPEC.webgpu.maxComputeWorkgroupsPerDimension) throw new Error(`n ${n} needs ${groups} workgroups; one dispatch allows ${SPEC.webgpu.maxComputeWorkgroupsPerDimension}`);
  const p = params(kind, n, stride), { a, b } = makeInputs(n, seed), B = buffers(device, a, b, n, pad, p);
  const module = device.createShaderModule({ code: wgsl(kind) });
  const pipeline = await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main", constants: { WG: wg } } });
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
    { binding: 0, resource: { buffer: B.a } }, { binding: 1, resource: { buffer: B.b } },
    { binding: 2, resource: { buffer: B.out, offset: 0, size: n * 4 } }, { binding: 3, resource: { buffer: B.params } }] });
  const dispatch = async () => {
    const enc = device.createCommandEncoder(), pass = enc.beginComputePass();
    pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.dispatchWorkgroups(groups); pass.end();
    const t0 = performance.now();
    device.queue.submit([enc.finish()]);
    await device.queue.onSubmittedWorkDone();
    return performance.now() - t0;
  };
  await dispatch();
  const check = await readBack(device, B, n, pad, cpuReference(a, b, kind === "strided" ? "strided" : "add", n, stride));
  const ms = [];
  for (let r = 0; r < reps; r++) ms.push(await dispatch());
  for (const k of ["a", "b", "out", "params", "read"]) B[k].destroy();
  ms.sort((x, y) => x - y);
  const med = ms[ms.length >> 1];
  return { kind, n, wg, stride, groups, check, ms, medianMs: med, gbPerS: (12 * n) / (med * 1e6) };
}

async function readBack(device, B, n, pad, want) {
  const enc = device.createCommandEncoder();
  enc.copyBufferToBuffer(B.out, 0, B.read, 0, (n + pad) * 4);
  device.queue.submit([enc.finish()]);
  await B.read.mapAsync(GPUMapMode.READ);
  const got = new Float32Array(B.read.getMappedRange().slice(0));
  B.read.unmap();
  return checkOutput(got, want, { pad });
}
