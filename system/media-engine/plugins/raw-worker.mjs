// system/media-engine/plugins/raw-worker.mjs
// Runs raw-native off the main thread. The loader fetches each module and its wasm, checks both
// against the SHA-256 the page pinned, and only then runs them.
//
// The fast path is the WebGPU build: it renders the frame on the GPU, renders the CPU reference for
// the same camera, and writes gpu_certificate.json comparing the two. It needs navigator.gpu and
// JSPI. When either is missing, or the GPU run fails, the CPU build renders instead and the reply
// says why.
//
// In:  { id, files: { loader, cpu: { module, moduleSha256, wasm, wasmSha256 }, gpu: {...} }, params, preferGpu }
// Out: { id, ok: true, backend, fallback, version, ms, certificate, gpuCertificate, frame, ao }
//      { id, ok: false, error }
// Every buffer in the reply is transferred, not copied.

const loaded = {};
function load(files, which) {
  if (!loaded[which]) {
    const f = files[which];
    loaded[which] = import(files.loader).then(({ loadRawNative }) => loadRawNative({
      moduleUrl: f.module, moduleSha256: f.moduleSha256, wasmUrl: f.wasm, wasmSha256: f.wasmSha256,
    }));
    loaded[which].catch(() => { delete loaded[which]; });
  }
  return loaded[which];
}

// Why the GPU path cannot run here, or null when it can be tried.
function gpuBlocker() {
  if (!self.navigator || !self.navigator.gpu) return "this browser has no WebGPU (navigator.gpu is absent)";
  if (typeof WebAssembly.Suspending !== "function") return "this browser has no JSPI, which the GPU build needs";
  return null;
}

// Binary PGM (P5, maxval 255) to its grey bytes.
function pgm(bytes) {
  if (!bytes) return null;
  let pos = 0;
  const fields = [];
  while (fields.length < 4) {
    while (bytes[pos] === 0x20 || bytes[pos] === 0x0a || bytes[pos] === 0x0d || bytes[pos] === 0x09) pos++;
    let s = "";
    while (pos < bytes.length && bytes[pos] > 0x20) s += String.fromCharCode(bytes[pos++]);
    fields.push(s);
  }
  if (fields[0] !== "P5" || fields[3] !== "255") return null;
  return bytes.slice(pos + 1, pos + 1 + (+fields[1]) * (+fields[2]));
}

async function renderOn(files, which, params) {
  const raw = await load(files, which);
  const r = await raw.renderAsync(which === "gpu" ? { ...params, gpu: true } : params);
  if (which === "gpu" && (!r.gpuCertificate || r.exitCode !== 0 || !r.frame)) {
    throw new Error((r.gpuCertificate && r.gpuCertificate.reason) || `GPU run exited ${r.exitCode}`);
  }
  return { raw, r };
}

self.onmessage = async ({ data }) => {
  const { id, files, params, preferGpu = true } = data;
  try {
    let backend = "cpu", fallback = null, run;
    const blocker = preferGpu ? gpuBlocker() : "the CPU path was asked for";
    if (!blocker) {
      try { run = await renderOn(files, "gpu", params); backend = "webgpu"; }
      catch (e) { fallback = "the GPU run failed: " + String((e && e.message) || e); }
    } else fallback = blocker;
    if (!run) run = await renderOn(files, "cpu", params);
    const { raw, r } = run;
    const ao = { rt: pgm(r.files["ao_rt.pgm"]), ss: pgm(r.files["ao_ss.pgm"]), error: pgm(r.files["ao_error.pgm"]) };
    const frame = r.frame ? { width: r.frame.width, height: r.frame.height, rgba: new Uint8Array(r.frame.rgba.buffer) } : null;
    const transfer = [frame && frame.rgba.buffer, ao.rt && ao.rt.buffer, ao.ss && ao.ss.buffer, ao.error && ao.error.buffer].filter(Boolean);
    self.postMessage({ id, ok: true, backend, fallback, version: raw.version, ms: r.ms, exitCode: r.exitCode,
      certificate: r.certificate, gpuCertificate: r.gpuCertificate || null, frame, ao }, transfer);
  } catch (e) {
    self.postMessage({ id, ok: false, error: String((e && e.message) || e) });
  }
};
