// Report helpers for lesson K22: the sources with what they claim, and the
// lab's measurement plan (shared with tools/school/measure_tiling.mjs).

export function sourcesBlock() {
  return {
    about: "What the sources claim, read for this lesson. cudaGuide: the CUDA C++ Programming Guide 12.6 (https://docs.nvidia.com/cuda/archive/12.6.0/cuda-c-programming-guide/), section 3.2.4 Shared Memory, which gives a matrix multiply without and with shared memory, BLOCK_SIZE 16, matrix dimensions assumed to be multiples of BLOCK_SIZE, and two __syncthreads() calls (one so the sub-matrices are loaded before the computation starts, one so the computation is done before the next sub-matrices are loaded). The current guide (13.4.2) teaches shared memory with a matrix transpose instead (section 2.3.4.2.1), so the matmul example is cited from 12.6. volkovDemmel: Volkov and Demmel, Benchmarking GPUs to tune dense linear algebra, SC 2008 (UC Berkeley tech report EECS-2008-49), section 4.1 and table 2. The kernels here are the guide's scheme (T x T tiles in shared memory, one output per invocation); Volkov and Demmel's fast kernel holds a 64 x 16 block of C in registers and only B in shared memory, which this lesson does not implement.",
    cudaGuide: {
      version: "12.6 (archived), section 3.2.4",
      withoutShared: "A is read B.width times from global memory and B is read A.height times",
      withShared: "A is only read (B.width / block_size) times from global memory and B is read (A.height / block_size) times",
      blockSize: 16, assumesMultiples: true, barriers: 2,
    },
    volkovDemmel: {
      report: "UC Berkeley EECS-2008-49 (SC08)",
      bandwidthWords: "m n k (1/bn + 1/bm) words for bm x bn blocks of C, 2 / (1/bn + 1/bm) times less than with no blocking; independent of bk",
      flopToWord: "18 for a GeForce 8800 GTX aiming at 346 Gflop/s under a 75 GB/s cap (12 for 230 Gflop/s), so the smallest useful block is 18 x 18 (12 x 12)",
      blocking: "64 x 16 blocks of C in registers, B in shared (local) memory, bk = 4",
      measured8800GTX: { peakGflops: 230, cublas11Gflops: 128, estimatedGflops: 202, observedGflops: 206, note: "C := C + AB, square matrices up to 4096, table 2; peak is for multiply-add with one operand in shared memory, per their benchmarks" },
      abstract: "GEMM runs 60% faster than CUBLAS 1.1 and approaches the peak of hardware capabilities",
    },
  };
}

// What the lab measures on the reader's GPU. The film never shows these.
export function plan() {
  return {
    about: "The lab's measurement, run only in a browser on the reader's own GPU through WebGPU (system/school/tiling-gpu.mjs, runKernel). For each kernel, tile and size it first checks C against the float64 CPU reference within gamma_n sum |a||b| (the whole matrix up to n = 512, the first 64 rows above that, and it says which), then times reps dispatches after one warm-up and reports the median wall time from submit to onSubmittedWorkDone (submission overhead included) and 2 n^3 / time in Gflop/s. Every result is labelled with the adapter's vendor, architecture and description. It is not run by the fill or the tests.",
    sizes: [64, 128, 256, 512, 1024], kernels: [["naive", 16], ["tiled", 8], ["tiled", 16]], reps: 9, warmup: 1, rowsCheckedAbove512: 64,
    measures: ["medianMs per dispatch", "gflops = 2 n^3 / medianMs", "tiled over naive speed ratio at each n", "checker result for every run, including the stale kernel"],
    predicts: "The emulator counts global loads: the tiled kernel issues 1/T of the naive kernel's (1/8 and 1/16). A measured speed ratio well below 8 or 16 says the naive kernel's repeated reads are served by caches, that the kernels are bound by something other than global loads, or both. The model gives counts, not times.",
  };
}
