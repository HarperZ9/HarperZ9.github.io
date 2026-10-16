// Lesson K22: the real-GPU measurement, for the lead to run later as a GPU
// job. It does not touch a GPU and it does not start a browser: it prints the
// plan and the steps to run the lab's measurement in a browser on the
// machine's GPU, then exits. Node has no WebGPU, and the film's numbers come
// from the emulator (tools/school/fill_tiling.mjs), not from here.
//
//   node tools/school/measure_tiling.mjs [--json]
//
// What the lab measures (system/school/tiling-gpu.mjs, runKernel): for the
// naive kernel and the tiled kernel at T = 8 and 16, on n = 64 to 1024, the
// output checked against the float64 reference, then the median of 9
// dispatch times after one warm-up and 2 n^3 / time in Gflop/s, each row
// labelled with the adapter. The emulator predicts load counts, not times;
// the lab's speed ratios are compared against those counts and the gap is
// reported, not hidden.
import { setPriority } from "node:os";
import { plan } from "./fill_tiling_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const p = plan();
if (process.argv.includes("--json")) { console.log(JSON.stringify(p, null, 1)); process.exit(0); }
console.log([
  "This script measures nothing by itself. To measure on a real GPU:",
  "1. Make sure the GPU is free (no training job running on it).",
  "2. Serve the site locally: python -m http.server 8000 from the repository root.",
  "3. Open the K22 lab page (night-school-tiling.html, once the lead has built it) at http://localhost:8000/ in a browser with WebGPU (Chrome or Edge 113+), on the machine with the GPU.",
  "4. In the lab, press Measure. It calls runKernel from system/school/tiling-gpu.mjs for every kernel, tile and size below, checks each output, and times the dispatches.",
  "5. Save the lab's JSON (adapter info, limits, every row) next to the film's facts, for example media/school/tiling/measured-<adapter>.json, and say which device it came from.",
  "",
  `Plan: sizes ${p.sizes.join(", ")}; kernels ${p.kernels.map(([k, T]) => `${k} T ${T}`).join(", ")}; ${p.reps} timed reps after ${p.warmup} warm-up; above n = 512 the first ${p.rowsCheckedAbove512} rows are checked.`,
  `Measures: ${p.measures.join("; ")}.`,
  `Model to compare with: ${p.predicts}`,
].join("\n"));
