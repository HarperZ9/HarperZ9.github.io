// system/media-engine/plugins/raw.mjs
// RAW, the reference renderer, live in the browser: raw-native 0.4.0 fills the engine's "raw" slot
// and its "wasm-raw" reference backend.
//
// The backend has a fast path and a fallback. Where the browser has WebGPU and JSPI, the WebGPU
// build draws the frame on the GPU and checks it against a CPU render of the same camera, writing a
// GPU certificate. Elsewhere the single-threaded CPU build draws it. Both run in a Worker
// (plugins/raw-worker.mjs), so a one-second render never blocks the page. The release files are
// pinned below by SHA-256 and checked before any of their code runs; they are byte copies of the
// v0.4.0 GitHub release assets, and raw.test.mjs re-hashes them.
//
// Params: { view, size, channel, tolerance, backend } or explicit raw-native camera fields (eye,
// target, up, fovy, width, height). view picks one of the five published camera presets; channel
// picks the shaded frame, the ray-traced AO, the screen-space AO or the error map; backend "cpu"
// skips the GPU path.

export const RAW_VERSION = "0.4.0";
const base = (name) => new URL(`../../../media/raw-native/wasm-${RAW_VERSION}/${name}`, import.meta.url).href;

export const RAW_FILES = Object.freeze({
  module: { name: "raw-native.mjs", sha256: "c02ede3e72d1e6691d6ac190319053b8a982cd9de44c64f95a00edb6f95d33c5" },
  wasm: { name: "raw-native.wasm", sha256: "45e25940368d664e21088708ba1c515b0e5d9ef60a2bea4b8b93f8f31113a470" },
  gpuModule: { name: "raw-native-gpu.mjs", sha256: "ff6565d00ae528e0509a5ec76f0f5bdaef9a0c4daed48246f660d6d03f5fe615" },
  gpuWasm: { name: "raw-native-gpu.wasm", sha256: "2299b9d34191147c6afe5f638dc27220061ad7564126e27b63cfc3f89952d2f3" },
  loader: { name: "raw-loader.mjs", sha256: "8a762c65c04ed52ddf76bcf4a58105d10b6062a4db80a8923e8f85f1eb7fcdee" },
});

// The five views in raw-native's README and on raw.html, with raw-native's own field names.
export const RAW_VIEWS = Object.freeze({
  default: { eye: [4, 4, 6], target: [0, 1, 0], fovy: 0.9 },
  high: { eye: [0, 9, 3], target: [0, 0.5, 0], fovy: 0.9 },
  low: { eye: [6, 1.5, 2], target: [0, 1, 0], fovy: 0.9 },
  close: { eye: [2, 2.5, 3], target: [0, 0.8, 0], fovy: 0.7 },
  wide: { eye: [5, 5, 8], target: [0, 0.5, 0], fovy: 1.2 },
});
export const RAW_SIZES = Object.freeze([256, 384, 512]);
export const RAW_CHANNELS = Object.freeze(["frame", "ao_rt", "ao_ss", "ao_error"]);

// Plugin params to the flat params raw-native's CLI reads. Explicit camera fields win over the view.
export function rawParams(p = {}) {
  const view = RAW_VIEWS[p.view] || RAW_VIEWS.default;
  const size = RAW_SIZES.includes(+p.size) ? +p.size : 384;
  const out = { width: +p.width || size, height: +p.height || size, eye: p.eye || view.eye, target: p.target || view.target,
    up: p.up || [0, 1, 0], fovy: p.fovy !== undefined ? +p.fovy : view.fovy };
  for (const k of ["prev_eye", "prev_target", "prev_up"]) if (p[k]) out[k] = p[k];
  if (p.tolerance !== undefined) out.tolerance = +p.tolerance;
  return out;
}

// One shared worker per page; requests queue in order.
let worker = null, nextId = 1;
const waiting = new Map();
function rawWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./raw-worker.mjs", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }) => {
    const w = waiting.get(data.id);
    if (!w) return;
    waiting.delete(data.id);
    if (data.ok) w.resolve(data); else w.reject(new Error(data.error));
  };
  worker.onerror = (e) => {
    console.error("[raw] worker failed:", e.message || e);
    for (const w of waiting.values()) w.reject(new Error("raw-native worker failed: " + (e.message || "load error")));
    waiting.clear();
    worker = null;
  };
  return worker;
}

const files = () => ({
  loader: base(RAW_FILES.loader.name),
  cpu: { module: base(RAW_FILES.module.name), moduleSha256: RAW_FILES.module.sha256, wasm: base(RAW_FILES.wasm.name), wasmSha256: RAW_FILES.wasm.sha256 },
  gpu: { module: base(RAW_FILES.gpuModule.name), moduleSha256: RAW_FILES.gpuModule.sha256, wasm: base(RAW_FILES.gpuWasm.name), wasmSha256: RAW_FILES.gpuWasm.sha256 },
});

// Render one frame. Resolves to { backend, fallback, version, ms, certificate, gpuCertificate, frame, ao }.
export function renderRaw(params, { preferGpu = true } = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    rawWorker().postMessage({ id, files: files(), params, preferGpu });
  });
}

// The RGBA image for one channel of a result: the frame, or a grey AO map expanded to RGBA.
export function channelRGBA(result, channel = "frame") {
  if (!result || !result.frame) return null;
  const { width, height } = result.frame;
  if (channel === "frame" || !RAW_CHANNELS.includes(channel)) return result.frame.rgba;
  const grey = result.ao[channel.slice(3)];
  if (!grey) return null;
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) { rgba[4 * i] = rgba[4 * i + 1] = rgba[4 * i + 2] = grey[i]; rgba[4 * i + 3] = 255; }
  return rgba;
}

const WORD = { verified: "MATCH", refuted: "DRIFT" };

// The GPU line: the GPU certificate's verdict, its worst channel and the adapter.
function gpuLine(result) {
  if (result.backend !== "webgpu") {
    return { label: "GPU path", verdict: "UNVERIFIABLE", detail: `not used, so the CPU build drew this frame: ${result.fallback || "no reason given"}` };
  }
  const g = result.gpuCertificate || {};
  const worst = (g.channels || []).reduce((m, c) => (c.rmse > m.rmse ? c : m), { name: "none", rmse: 0, bound: 0 });
  const a = g.adapter || {};
  const t = g.timing_ms || {};
  return { label: "GPU frame", verdict: WORD[g.verdict] || "UNVERIFIABLE",
    detail: `checked against the CPU reference: ${g.verdict}; largest channel RMSE ${worst.rmse.toExponential(1)} (${worst.name}, bound ${worst.bound}) on ${[a.vendor, a.architecture].filter(Boolean).join(" ") || "an unnamed adapter"}; GPU ${Math.round(t.gpu)} ms, CPU reference ${Math.round(t.cpu)} ms` };
}

// What a reader should be told about one result, as status lines { label, verdict, detail }.
// raw-native's own three words are kept in the detail; the verdict uses the site's vocabulary.
export function rawStatus(result, error, busy = false) {
  if (error) return [{ label: "raw-native " + RAW_VERSION, verdict: "ERROR", detail: String(error.message || error) }];
  if (!result) return [{ label: "raw-native " + RAW_VERSION, verdict: "PENDING", detail: "loading and rendering in a Worker" }];
  const c = result.certificate || {};
  const x = c.exact || {};
  const gpu = result.backend === "webgpu";
  const pin = gpu ? RAW_FILES.gpuWasm : RAW_FILES.wasm;
  return [
    { label: "Module", verdict: "MATCH", detail: `${result.version}, ${gpu ? "WebGPU" : "CPU"} build; ${pin.name} sha-256 ${pin.sha256.slice(0, 12)} checked before it ran` },
    gpuLine(result),
    { label: "AO certificate", verdict: WORD[c.verdict] || "UNVERIFIABLE", detail: x.rmse != null
      ? `raw-native says ${c.verdict}: RMSE ${x.rmse.toFixed(4)} against ${x.tolerance.toFixed(2)} on ${x.pixels.toLocaleString("en-US")} covered pixels; worst pixel ${x.maxError.toFixed(3)}`
      : `raw-native says ${c.verdict || "nothing"}` },
    busy ? { label: "Render", verdict: "PENDING", detail: "rendering the new camera; the lines above describe the previous frame" } :
    { label: "Render", verdict: "OK", detail: `${result.frame.width} x ${result.frame.height} in ${Math.round(result.ms)} ms in this browser${gpu ? ", GPU frame and CPU reference together" : ", one thread"}` },
  ];
}

function drawText(ctx, w, h, line) {
  ctx.fillStyle = "#9d978a";
  ctx.font = `400 ${Math.round(Math.max(11, Math.min(w, h) / 32))}px "Conso", ui-monospace, monospace`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(line, w / 2, h / 2, w - 32);
}

export const raw = {
  id: "raw",
  version: RAW_VERSION,
  backends: ["wasm-raw"],
  create({ canvas, params = {}, requestRedraw = () => {} }) {
    let p = { ...params }, result = null, error = null, busy = false, gen = 0, image = null, imageKey = "";
    const listeners = new Set();
    const notify = () => { for (const fn of listeners) { try { fn(result, error); } catch (e) { console.error("[raw] listener failed:", e); } } };
    let settle;
    const inst = {
      backend: "wasm-raw",
      static: true,
      ready: new Promise((r) => { settle = r; }),
      get result() { return result; },
      get error() { return error; },
      get params() { return { ...p }; },
      status() { return rawStatus(result, error, busy && !!result); },
      // Called with (result, error) after every render; returns an unsubscribe function.
      onResult(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      render() {
        const mine = ++gen;
        error = null;
        busy = true;
        notify();
        return renderRaw(rawParams(p), { preferGpu: p.backend !== "cpu" }).then((r) => { if (mine === gen) { result = r; imageKey = ""; } },
          (e) => { if (mine === gen) { error = e; console.error("[raw] render failed:", e); } })
          .finally(() => { if (mine === gen) { busy = false; notify(); settle(); requestRedraw(); } });
      },
      setParams(next) {
        const key = () => JSON.stringify([rawParams(p), p.backend === "cpu"]);
        const before = key();
        p = { ...p, ...next };
        if (key() !== before) inst.render(); else imageKey = "";
      },
      frame() {
        const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
        if (!result) { drawText(ctx, w, h, error ? "raw-native could not run here: " + error.message : "rendering"); return; }
        const key = gen + ":" + (p.channel || "frame");
        if (key !== imageKey) {
          const { width, height } = result.frame;
          image = document.createElement("canvas");
          image.width = width; image.height = height;
          image.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(channelRGBA(result, p.channel)), width, height), 0, 0);
          imageKey = key;
        }
        const s = Math.min(w / image.width, h / image.height);
        const dw = Math.round(image.width * s), dh = Math.round(image.height * s);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, (w - dw) >> 1, (h - dh) >> 1, dw, dh);
      },
      // The raw-native frame itself, top-down RGBA at the render size (not the scaled canvas).
      readPixels() { return result ? channelRGBA(result, p.channel) : null; },
      resize() {},
      dispose() { gen++; listeners.clear(); },
    };
    inst.render();
    return inst;
  },
};

// The engine's reference backend: an exact raw-native render of a request's camera. It always runs
// the CPU build, the exact path, so a GPU frame is never checked against another GPU frame. It
// returns the channel the request names, so an AO map is compared with an AO map.
export const rawReference = {
  async render(request) {
    const params = (request && request.params) || {};
    const r = await renderRaw(rawParams(params), { preferGpu: false });
    return channelRGBA(r, params.channel);
  },
};
