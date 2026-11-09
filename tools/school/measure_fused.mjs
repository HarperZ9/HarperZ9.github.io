// Lesson K23: the real-GPU measurement, for the lead to run later as a GPU
// job. It does not touch a GPU and it does not start a browser: it prints the
// plan and the steps to run the lab's measurement in a browser on the
// machine's GPU, then exits. Node has no WebGPU, and the film's numbers come
// from the emulator (tools/school/fill_fused.mjs), not from here.
//
//   node tools/school/measure_fused.mjs [--json]
//
// What the lab measures (system/school/fused-gpu.mjs, runAttention): for the
// unfused kernels (scores, softmax, P V), the fused kernel and the broken
// one, at d 16 and 64 and N 256 to 4096, O checked against the float64
// reference, then the median of 9 run times after one warm-up, each row
// labelled with the adapter. The emulator predicts traffic, not times; the
// lab's speed ratios are compared against the traffic ratios and the gap is
// reported, not hidden.
import { setPriority } from "node:os";
import { plan } from "./fill_fused_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const p = plan();
if (process.argv.includes("--json")) { console.log(JSON.stringify(p, null, 1)); process.exit(0); }
console.log([
  "This script measures nothing by itself. To measure on a real GPU:",
  "1. Make sure the GPU is free (no training job running on it).",
  "2. Serve the site locally: python -m http.server 8000 from the repository root.",
  "3. Open the K23 lab page (once the lead has built it) at http://localhost:8000/ in a browser with WebGPU (Chrome or Edge 113+), on the machine with the GPU.",
  "4. In the lab, press Measure. It calls runAttention from system/school/fused-gpu.mjs for every variant, head width and size below, checks each output, and times the runs.",
  "5. Save the lab's JSON (adapter info, limits, every row) next to the film's facts, for example media/school/fused/measured-<adapter>.json, and say which device it came from.",
  "",
  `Plan: N ${p.sizes.join(", ")}; d ${p.heads.join(", ")}; kinds ${p.kinds.join(", ")}; ${p.reps} timed reps after ${p.warmup} warm-up; above N = 1024 the first ${p.rowsCheckedAbove1024} rows are checked.`,
  `Measures: ${p.measures.join("; ")}.`,
  `Model to compare with: ${p.predicts}`,
].join("\n"));
