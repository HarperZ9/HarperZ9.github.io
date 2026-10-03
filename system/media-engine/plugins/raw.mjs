// system/media-engine/plugins/raw.mjs
// RAW, the reference renderer, live in the browser: raw-native 0.3.0 compiled to WebAssembly fills
// the engine's "raw" slot and its "wasm-raw" reference backend.
//
// The plugin renders in a Worker (plugins/raw-worker.mjs), so a one-second ray-traced frame never
// blocks the page. The release files are pinned below by SHA-256 and checked before any of their code
// runs; they are byte copies of the v0.3.0 GitHub release assets, and raw.test.mjs re-hashes them.
//
// Params: { view, size, channel, tolerance } or explicit raw-native camera fields (eye, target, up,
// fovy, width, height). view picks one of the five published camera presets; channel picks which
// image the canvas shows: the shaded frame, the ray-traced AO, the screen-space AO or the error map.

export const RAW_VERSION = "0.3.0";
const base = (name) => new URL(`../../../media/raw-native/wasm-${RAW_VERSION}/${name}`, import.meta.url).href;

export const RAW_FILES = Object.freeze({
  module: { name: "raw-native.mjs", sha256: "c02ede3e72d1e6691d6ac190319053b8a982cd9de44c64f95a00edb6f95d33c5" },
  wasm: { name: "raw-native.wasm", sha256: "72c1a9fef0feae4e9412693407886129480b67afe97dc3c29ea729fc03203504" },
  loader: { name: "raw-loader.mjs", sha256: "26fec5e9eff49108e8f0c2619d96e883a1c4178735d8a0caece77a019c9bdaaa" },
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

const files = () => ({ loader: base(RAW_FILES.loader.name), module: base(RAW_FILES.module.name), moduleSha256: RAW_FILES.module.sha256,
  wasm: base(RAW_FILES.wasm.name), wasmSha256: RAW_FILES.wasm.sha256 });

// Render one frame. Resolves to { version, ms, certificate, arenaCertificate, frame, ao }.
export function renderRaw(params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    rawWorker().postMessage({ id, files: files(), params });
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

// What a reader should be told about one result, as status lines { label, verdict, detail }.
// raw-native's own three words are kept in the detail; the verdict uses the site's vocabulary.
export function rawStatus(result, error, busy = false) {
  if (error) return [{ label: "raw-native " + RAW_VERSION, verdict: "ERROR", detail: String(error.message || error) }];
  if (!result) return [{ label: "raw-native " + RAW_VERSION, verdict: "PENDING", detail: "loading and rendering in a Worker" }];
  const c = result.certificate || {};
  const x = c.exact || {};
  const word = { verified: "MATCH", refuted: "DRIFT" }[c.verdict] || "UNVERIFIABLE";
  return [
    { label: "Module", verdict: "MATCH", detail: `${result.version}; raw-native.wasm sha-256 ${RAW_FILES.wasm.sha256.slice(0, 12)} checked before it ran` },
    { label: "AO certificate", verdict: word, detail: x.rmse != null
      ? `raw-native says ${c.verdict}: RMSE ${x.rmse.toFixed(4)} against ${x.tolerance.toFixed(2)} on ${x.pixels.toLocaleString("en-US")} covered pixels; worst pixel ${x.maxError.toFixed(3)}`
      : `raw-native says ${c.verdict || "nothing"}` },
    busy ? { label: "Render", verdict: "PENDING", detail: "rendering the new camera; the lines above describe the previous frame" } :
    { label: "Render", verdict: "OK", detail: `${result.frame.width} x ${result.frame.height} in ${Math.round(result.ms)} ms, one thread, in this browser` },
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
        return renderRaw(rawParams(p)).then((r) => { if (mine === gen) { result = r; imageKey = ""; } },
          (e) => { if (mine === gen) { error = e; console.error("[raw] render failed:", e); } })
          .finally(() => { if (mine === gen) { busy = false; notify(); settle(); requestRedraw(); } });
      },
      setParams(next) {
        const before = JSON.stringify(rawParams(p));
        p = { ...p, ...next };
        if (JSON.stringify(rawParams(p)) !== before) inst.render(); else imageKey = "";
      },
      frame() {
        const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
        if (!result) { drawText(ctx, w, h, error ? "raw-native could not run here: " + error.message : "rendering in WebAssembly"); return; }
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

// The engine's reference backend: an exact raw-native render of a request's camera.
export const rawReference = {
  async render(request) {
    const r = await renderRaw(rawParams((request && request.params) || {}));
    return r.frame.rgba;
  },
};
