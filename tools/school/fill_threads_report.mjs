// Report helpers for lesson K21: the published limits with their sources, and
// the lab's measurement plan (shared with tools/school/measure_threads.mjs).

export function specBlock(SPEC) {
  return {
    about: "Published limits and rules, with their sources. WebGPU: W3C Candidate Recommendation Draft, https://www.w3.org/TR/webgpu/, section 3.6.2 Limits (the version read was dated 15 September 2026); the values are the defaults every WebGPU device must support, an adapter may offer more, and compat holds the compatibility-mode defaults. WGSL: https://www.w3.org/TR/WGSL/, section 13.3.1.1.4 global_invocation_id (workgroup_id * workgroup_size + local_invocation_id) and section 6.5.7 Out-of-Bounds Access (an invalid store may write any location of the bound GPUBuffer or not be executed; an invalid load may return any value of the buffer or zero). CUDA: CUDA Programming Guide 13.4.2, https://docs.nvidia.com/cuda/cuda-programming-guide/: section 1 Programming Model (threads of a block are organized into groups of 32 threads called warps), section 2.3.4.1 Coalesced Global Memory Access (32-byte memory transactions; consecutive 4-byte words from a warp's 32 threads are 128 bytes fetched in four 32-byte transactions; the worst case is one transaction per thread), and the Compute Capabilities appendix (1,024 threads per block; block x and y up to 1,024, z up to 64; warp size 32). WebGPU has no warp: invocations are grouped into subgroups whose size the adapter reports (subgroupMinSize, subgroupMaxSize) when the subgroups feature is available.",
    webgpu: SPEC.webgpu, cuda: SPEC.cuda,
    wgsl: { globalInvocationId: "workgroup_id * workgroup_size + local_invocation_id", invalidStore: ["store to any memory location of the bound GPUBuffer", "not be executed"], invalidLoad: ["any memory location of the bound GPUBuffer", "the zero value"] },
  };
}

// What the lab measures on the reader's GPU. The film never shows these
// numbers; they belong to the reader's adapter.
export function plan() {
  return {
    about: "The lab's measurement, run only in a browser on the reader's own GPU through WebGPU (system/school/threads-gpu.mjs). For each kernel and workgroup size it first checks the output against the CPU reference (with 64 canary floats past the binding), then times reps dispatches after one warm-up and reports the median wall time from submit to onSubmittedWorkDone (submission overhead included) and the effective bandwidth 12 n bytes / time. Every result is labelled with the adapter's vendor, architecture and description and its subgroup sizes. It is not run by the fill or the tests.",
    n: 1 << 20, workgroupSizes: [32, 64, 128, 256], kernels: ["add", "strided"], strides: [2, 8, 32, 1024], reps: 9, warmup: 1, pad: 64,
    measures: ["medianMs per dispatch", "gbPerS = 12 n / medianMs", "strided over contiguous time ratio at each stride", "time across workgroup sizes", "checker result for every run"],
    predicts: "In the 32-lane, 32-byte model the strided kernel moves (32 + 32 + 4) / 12 = 5.67 times the bytes of the contiguous one at stride 8 and above (each thread's read of a and of b costs a whole 32-byte transaction, its contiguous write 4 bytes); traffic.rows holds the emulator's count. A measured time ratio far from that says caches, a different grouping or a different transaction size are at work. The model gives counts, not times.",
  };
}
