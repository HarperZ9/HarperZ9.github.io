// Lesson K21: the real-GPU measurement, for the lead to run later as a GPU
// job. It does not touch a GPU itself and it does not start a browser: it
// prints the plan and the steps to run the lab's measurement in a browser on
// the machine's GPU, then exits. Node has no WebGPU, and the film's numbers
// come from the emulator (tools/school/fill_threads.mjs), not from here.
//
//   node tools/school/measure_threads.mjs [--json]
//
// What the lab measures (system/school/threads-gpu.mjs, runKernel):
//   - for kernels add (contiguous) and strided (strides 2, 8, 32, 1024) at
//     workgroup sizes 32, 64, 128 and 256 on n = 2^20 floats: the output
//     checked against the CPU reference with 64 canary floats past the
//     binding, then the median of 9 dispatch times after one warm-up (wall
//     time submit to onSubmittedWorkDone, submission overhead included) and
//     the effective bandwidth 12 n bytes / time;
//   - every row labelled with the adapter's vendor, architecture,
//     description and subgroup sizes, and the device's compute limits.
// The emulator predicts byte counts, not times; the lab's time ratios are
// compared against those counts and the gap is reported, not hidden.
import { setPriority } from "node:os";
import { plan } from "./fill_threads_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const p = plan();
if (process.argv.includes("--json")) { console.log(JSON.stringify(p, null, 1)); process.exit(0); }
const steps = [
  "This script measures nothing by itself. To measure on a real GPU:",
  "1. Make sure the GPU is free (no training job running on it).",
  "2. Serve the site locally: python -m http.server 8000 from the repository root.",
  "3. Open the K21 lab page (night-school-threads.html, once the lead has built it) at http://localhost:8000/ in a browser with WebGPU (Chrome or Edge 113+), on the machine with the GPU.",
  "4. In the lab, press Measure. It calls runKernel from system/school/threads-gpu.mjs for every kernel, stride and workgroup size below, checks each output, and times the dispatches.",
  "5. Save the lab's JSON (adapter info, limits, every row) next to the film's facts, for example media/school/threads/measured-<adapter>.json, and say which device it came from.",
  "",
  `Plan: n = ${p.n}; workgroup sizes ${p.workgroupSizes.join(", ")}; kernels ${p.kernels.join(", ")}; strides ${p.strides.join(", ")}; ${p.reps} timed reps after ${p.warmup} warm-up; ${p.pad} canary floats.`,
  `Measures: ${p.measures.join("; ")}.`,
  `Model to compare with: ${p.predicts}`,
];
console.log(steps.join("\n"));
