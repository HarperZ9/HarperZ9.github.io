// f310.worker.js: runs the F310 re-run off the main thread. One message in ({ rows, seed }), progress messages out
// between draws, then one result message with the numbers and the time the run took. No network access.
import { run } from "./f310-kernel.js";

self.onmessage = (ev) => {
  const { rows, seed } = ev.data;
  try {
    const t0 = performance.now();
    const res = run(rows, BigInt(seed), (key, done, total) => self.postMessage({ type: "progress", key, done, total }));
    self.postMessage({ type: "result", seed, analysis: res.analysis, controls: res.controls, ms: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ type: "error", message: String((err && err.message) || err) });
  }
};
