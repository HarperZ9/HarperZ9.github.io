// studio-perception-client.js: the main-thread side of studio-perception-worker.mjs.
// One job in flight at a time (the live loop skips a tick while the worker is busy, so jobs never
// stack). The first job is also computed on the main thread and the two results must be identical,
// or the worker is retired and the Studio measures on the main thread as before. Every failure is
// logged with context; none is swallowed.
export function createPerceptionWorker(compute) {
  let worker = null, failed = false, inFlight = null, nextId = 1, verified = false, ms = 0;
  const retire = (why) => {
    console.error("[studio] perception worker retired, measuring on the main thread:", why);
    failed = true; if (worker) worker.terminate(); worker = null;
    if (inFlight) { const job = inFlight; inFlight = null; job.reject(new Error(String(why))); }
  };
  const ready = () => {
    if (failed) return false;
    if (worker) return true;
    if (typeof Worker !== "function") { failed = true; return false; }
    try {
      worker = new Worker(new URL("./studio-perception-worker.mjs", import.meta.url), { type: "module" });
    } catch (e) { retire(e && e.message || e); return false; }
    worker.onerror = (e) => retire((e && e.message) || "worker error");
    worker.onmessage = ({ data }) => {
      const job = inFlight;
      if (!job || job.id !== data.id) return;
      inFlight = null;
      if (data.error) { retire(data.error); return; }
      const out = { phash: data.phash, f: data.f, rich: data.rich, mosaic: data.mosaic };
      if (job.reference) {
        if (JSON.stringify(out) !== JSON.stringify(job.reference)) { retire("worker result differs from the main-thread result on the same bytes"); job.resolve(job.reference); return; }
        verified = true;
      }
      ms = ms ? ms * 0.9 + data.ms * 0.1 : data.ms;
      job.resolve(out);
    };
    return true;
  };
  return {
    ready,
    get busy() { return !!inFlight; },
    get verified() { return verified; },
    get ms() { return ms; },
    // px is transferred (detached on return). Resolves with {phash, f, rich, mosaic}.
    measure(px, w, h, n) {
      return new Promise((resolve, reject) => {
        if (!ready() || inFlight) { reject(new Error("perception worker unavailable or busy")); return; }
        const id = nextId++;
        const reference = verified ? null : compute(px, w, h, n);
        inFlight = { id, resolve, reject, reference };
        worker.postMessage({ id, buffer: px.buffer, w, h, n }, [px.buffer]);
      });
    },
  };
}
