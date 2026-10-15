// studio-finish.js: the Finish layer (14 October 2026). raw-native's post stack runs over the
// stage as a Studio layer: the source draws its frame on #studio-canvas as it always has, and the
// layer draws that frame again through one of the engine's looks on a WebGPU canvas laid over it.
// This is the Studio half of raw-native's roadmap M1 criterion 9 (the display chain): the CRT
// passes, the film print with its grain and halation, and the classic tube's chromatic aberration,
// each with the engine's CPU reference.
//
// The engine files are a byte copy of raw-native 0.8.0 (media/raw-native/post-0.8.0/, every file
// pinned by SHA256SUMS and re-hashed by studio-finish.test.mjs), loaded only when a finish is on.
// Without WebGPU the layer stays off and the source draws as it is; the rail says why.
//
// check(name) runs the committed frame set of the engine's own pass check (960 x 600, fixed
// seeds) through this layer's own path (a 2D canvas, the upload, the post stack, a WebGPU canvas,
// read back) and compares every channel with the engine's CPU reference at 8 bits.

export const ENGINE_VERSION = "0.8.0";
const RAW = `../media/raw-native/post-${ENGINE_VERSION}/`;

// The looks. Each spec list is what the engine's post stack runs; the settings are the engine's
// own test settings, so the layer and the engine's check run the same passes.
export const FINISHES = Object.freeze({
  off: { label: "Off", specs: [] },
  classic: { label: "Classic tube", note: "scanlines, aperture grille, bloom, halation, curvature, chromatic aberration, vignette",
    specs: [{ pass: "crt-classic", cell: 4, scanlines: true, scanStrength: 0.35, beam: 0.5, mask: "grille", maskStrength: 0.3,
      bloom: 0.18, halation: 0.2, curvature: 0.12, aberration: 0.1, vignette: 0.25 }] },
  tube: { label: "PVM-20 tube", note: "the beam, phosphors and glass of a broadcast monitor at 320 x 240",
    specs: [{ pass: "crt", preset: "pvm-20", source: [320, 240] }] },
  film: { label: "500T print", note: "negative and print stock with grain and halation",
    specs: [{ pass: "film", preset: "500t-print" }] },
  dither: { label: "PICO-8 dither", note: "16 colours, ordered Bayer 4 x 4 in OKLab",
    specs: [{ pass: "dither", palette: "pico8", mode: "bayer4" }] },
});

// Sources that put their own surface on the stage instead of #studio-canvas.
const OWN_SURFACE = new Set(["viewer", "retro", "gallery", "loom", "films", "fractal3d", "spatial", "splats", "ndim"]);

let eng = null, engLoad = null, state = "off", reason = "", chosen = "off", raf = 0, frameNo = 0;
let host = null, runner = null, overlay = null, ctx = null, srcTex = null, size = [0, 0], format = null;

function loadEngine() {
  if (!engLoad) {
    engLoad = Promise.all([
      import(`${RAW}web/raw-gpu.mjs`),
      import(`${RAW}web/motion/post.mjs`),
      import(`${RAW}web/motion/post_run.mjs`),
      import(`${RAW}web/shaders/post.mjs`),        // registers crt, film, crt-classic, dither, paint
      import(`${RAW}tests/web/post_frames.mjs`),   // toHalf, for the upload fallback
    ]).then(([gpu, post, run, , frames]) => (eng = { gpu, post, run, frames }));
  }
  return engLoad;
}

async function ensureHost() {
  if (host) return host;
  await loadEngine();
  host = await eng.gpu.createHost({ timing: false });
  runner = new eng.run.PostRunner(host, host.sampler({ filter: "linear", address: "clamp" }));
  format = navigator.gpu.getPreferredCanvasFormat();
  return host;
}

// The list one finish runs, and its stage: a display list, or scene passes with the sRGB decode
// the engine inserts in front of a pass that reads linear light (the film).
function plan(name) {
  const specs = (FINISHES[name] || FINISHES.off).specs;
  if (!specs.length) return { specs, stage: null };
  const stage = eng.post.getPass(specs[0].pass).stage;
  return stage === "scene" ? { specs: eng.post.planScenePasses(specs, false), stage } : { specs, stage };
}

function configure(context) {
  context.configure({ device: host.device, format, alphaMode: "opaque",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
}

function sourceTexture(W, H, old) {
  if (old && old.width === W && old.height === H) return old;
  if (old) old.destroy();
  return host.device.createTexture({ label: "finish source", size: [W, H], format: "rgba16float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
}

// One frame of the layer: canvas in, the finish's passes, the WebGPU canvas out. The same function
// draws the stage and the check, so the check measures the path the stage uses.
// The upload: the canvas straight into the texture. Chrome on a Linux runner's SwiftShader refused
// that copy for a 2D canvas after a few frames ("Failed to copy content from external image"), so a
// refused copy falls back to reading the canvas's bytes and writing the same half floats the copy
// would give (f16 of b / 255). Both paths hand the post stack the same texels.
let scratch = null, uploads = { direct: 0, bytes: 0 }, forceBytes = false;
function upload(source, tex, W, H) {
  try {
    if (forceBytes) throw new Error("bytes path chosen");
    host.device.queue.copyExternalImageToTexture({ source }, { texture: tex }, [W, H]);
    uploads.direct++;
    return;
  } catch (e) {
    if (!scratch) scratch = document.createElement("canvas");
    if (scratch.width !== W || scratch.height !== H) { scratch.width = W; scratch.height = H; }
    const c = scratch.getContext("2d", { willReadFrequently: true });
    c.clearRect(0, 0, W, H); c.drawImage(source, 0, 0, W, H);
    const bytes = c.getImageData(0, 0, W, H).data, f = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) f[i] = bytes[i] / 255;
    host.device.queue.writeTexture({ texture: tex }, eng.frames.toHalf(f), { bytesPerRow: W * 8 }, [W, H]);
    uploads.bytes++;
  }
}

function finishFrame(source, tex, context, p, W, H, f) {
  upload(source, tex, W, H);
  const enc = host.device.createCommandEncoder({ label: "finish" });
  const target = context.getCurrentTexture();
  runner.run(enc, p.specs, tex, W, H, f, f / 60, { view: target.createView(), format }, p.stage);
  return { enc, target };
}

function stageCanvas() { return document.getElementById("studio-canvas"); }
// Why the layer is or is not drawing over the stage, kept for the rail and the tests.
let stageWhy = "";
function onStage(c) {
  if (!c || !c.width || !c.height || !c.isConnected) { stageWhy = "no source canvas"; return false; }
  if (OWN_SURFACE.has(window.__studioActiveSource)) { stageWhy = `${window.__studioActiveSource} has its own surface`; return false; }
  const cs = getComputedStyle(c);
  if (cs.display === "none" || cs.visibility === "hidden" || c.offsetWidth <= 0) { stageWhy = "the source canvas is not shown"; return false; }
  stageWhy = "";
  return true;
}

// Lay the overlay on the source canvas. Absolute offsets start inside the stage's border.
function place(src) {
  const par = overlay.offsetParent || src.parentElement, box = par.getBoundingClientRect(), r = src.getBoundingClientRect();
  const left = r.left - box.left - par.clientLeft, top = r.top - box.top - par.clientTop;
  Object.assign(overlay.style, { left: `${left}px`, top: `${top}px`, width: `${r.width}px`, height: `${r.height}px` });
}

function tick() {
  raf = 0;
  if (chosen === "off" || state !== "on") return;
  const src = stageCanvas();
  if (!onStage(src)) { overlay.hidden = true; raf = requestAnimationFrame(tick); return; }
  const W = src.width, H = src.height, p = plan(chosen);
  if (W !== size[0] || H !== size[1]) {
    size = [W, H]; overlay.width = W; overlay.height = H;
    srcTex = sourceTexture(W, H, srcTex);
    runner.prepare(p.specs, W, H);
  }
  place(src);
  try {
    const { enc } = finishFrame(src, srcTex, ctx, p, W, H, frameNo++);
    host.device.queue.submit([enc.finish()]);
    overlay.hidden = false;
  } catch (e) {
    console.error("[studio-finish] frame failed:", e);
    fail("the finish failed on this frame: " + (e && e.message || e));
    return;
  }
  raf = requestAnimationFrame(tick);
}

function fail(why) {
  state = "unavailable"; reason = why;
  if (overlay) overlay.hidden = true;
  report();
}

let statusEl = null;
function report() {
  if (!statusEl) return;
  const f = FINISHES[chosen] || FINISHES.off;
  if (chosen === "off") statusEl.textContent = "Off: the source draws as it is.";
  else if (state === "unavailable") statusEl.textContent = `Off: ${reason}. The source draws as it is.`;
  else if (state === "starting") statusEl.textContent = `Starting raw-native ${ENGINE_VERSION}...`;
  else statusEl.textContent = `${f.label} on raw-native ${ENGINE_VERSION} (WebGPU): ${f.note}.`;
}

/** Choose a finish by name ("off", "classic", "tube", "film", "dither"). Resolves when it draws. */
export async function setFinish(name, { stage = null, status = null } = {}) {
  if (!FINISHES[name]) name = "off";
  if (status) statusEl = status;
  chosen = name;
  if (name === "off") {
    state = "off";
    if (overlay) overlay.hidden = true;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    report();
    return state;
  }
  if (!navigator.gpu) { fail("this browser has no WebGPU"); return state; }
  state = state === "on" ? "on" : "starting"; report();
  try {
    await ensureHost();
    if (!overlay) {
      overlay = document.createElement("canvas");
      overlay.id = "finish-canvas";
      overlay.setAttribute("aria-hidden", "true");
      overlay.hidden = true;
      (stage || stageCanvas().parentElement).append(overlay);
      ctx = overlay.getContext("webgpu");
      configure(ctx);
    }
    const src = stageCanvas();
    if (src && src.width) await runner.prepare(plan(name).specs, src.width, src.height);
    size = src ? [src.width, src.height] : [0, 0];
    if (src && src.width) { overlay.width = src.width; overlay.height = src.height; srcTex = sourceTexture(src.width, src.height, srcTex); }
  } catch (e) {
    console.warn("[studio-finish] raw-native did not start:", e);
    fail(eng && e instanceof eng.gpu.HostUnavailable ? String(e.message) : "raw-native could not start here");
    return state;
  }
  if (chosen !== name) return state;            // another choice arrived while starting
  state = "on"; report();
  if (!raf) raf = requestAnimationFrame(tick);
  return state;
}

/** The layer's own record, for the rail, the shell and the tests. */
export function finishState() {
  return { chosen, state, reason, engine: ENGINE_VERSION, size: [...size], frames: frameNo,
    adapter: host && host.info ? host.info.description || host.info.architecture || "" : null,
    overlay: !!(overlay && !overlay.hidden), stage: stageWhy || "on stage", uploads: { ...uploads } };
}

// The committed frame set through the layer's own path, against the engine's CPU references at 8 bits.
// The plate is 8-bit (a canvas), so the reference reads b / 255 as the upload gives it to the GPU.
async function check(name, { frames: only = null, control = false, upload: via = "direct" } = {}) {
  const f = FINISHES[name];
  if (!f || !f.specs.length) throw new Error("no finish " + name);
  await ensureHost();
  const fr = await import(`${RAW}tests/web/post_frames.mjs`);
  const set = fr.frameSet(), W = set.width, H = set.height, p = plan(name);
  const toCode = (v) => Math.round(255 * Math.min(1, Math.max(0, v)));
  const plate = document.createElement("canvas"), out = document.createElement("canvas");
  plate.width = out.width = W; plate.height = out.height = H;
  const pctx = plate.getContext("2d", { willReadFrequently: true }), octx = out.getContext("webgpu");
  configure(octx);
  const r = new eng.run.PostRunner(host, host.sampler({ filter: "linear", address: "clamp" }));
  await r.prepare(p.specs, W, H);
  const keep = runner; runner = r; forceBytes = via === "bytes";
  const tex = sourceTexture(W, H, null), bgra = /bgra/.test(format);
  const cpuSpecs = p.specs.map((s) => ({ ...s }));   // one object per pass: the references keep state per spec
  const res = { finish: name, control, upload: via, passes: p.specs.map((s) => s.pass), size: [W, H], frames: [], maxCode: 0, over: 0, worst: null };
  let n = 0;                                          // the frame clock both sides see
  try {
    for (let i = 0; i < set.data.length; i++) {
      if (only && !only.includes(set.names[i])) continue;
      const bytes = new Uint8ClampedArray(W * H * 4), src = set.data[i];
      for (let k = 0; k < bytes.length; k++) bytes[k] = (k & 3) === 3 ? 255 : toCode(src[k]);
      pctx.putImageData(new ImageData(bytes, W, H), 0, 0);
      const { enc, target } = finishFrame(plate, tex, octx, p, W, H, n++);
      const bpr = Math.ceil((W * 4) / 256) * 256;
      const buf = host.device.createBuffer({ size: bpr * H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      enc.copyTextureToBuffer({ texture: target }, { buffer: buf, bytesPerRow: bpr }, [W, H]);
      host.device.queue.submit([enc.finish()]);
      await buf.mapAsync(GPUMapMode.READ);
      const gpu = new Uint8Array(buf.getMappedRange().slice(0));
      buf.unmap(); buf.destroy();
      // The CPU reference sees what the GPU sees: the 8-bit plate as half floats, and half floats
      // between passes (the stack's rgba16float textures).
      // control: the reference is given a plate 16 codes brighter, so the check must fail.
      const ref = control ? Uint8ClampedArray.from(bytes, (b, k) => ((k & 3) === 3 ? b : b + 16)) : bytes;
      let cur = fr.fromHalf(fr.toHalf(Float32Array.from(ref, (b) => b / 255)));
      cpuSpecs.forEach((s, j) => {
        cur = eng.post.getPass(s.pass).cpu(cur, W, H, s, null);
        if (j < cpuSpecs.length - 1) cur = fr.fromHalf(fr.toHalf(cur));
      });
      let maxCode = 0, over = 0, worst = null;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
        const g = gpu[y * bpr + 4 * x + (bgra ? 2 - c : c)], want = toCode(cur[4 * (y * W + x) + c]), d = Math.abs(g - want);
        if (d > 1) over++;
        if (d > maxCode) { maxCode = d; worst = { frame: set.names[i], pixel: [x, y], channel: c, gpu: g, cpu: want }; }
      }
      res.frames.push({ name: set.names[i], maxCode, over });
      res.over += over;
      if (maxCode > res.maxCode) { res.maxCode = maxCode; res.worst = worst; }
    }
  } finally {
    runner = keep; forceBytes = false; r.destroy(); tex.destroy();
  }
  res.adapter = host.info.description || host.info.architecture || "";
  res.pass = res.over === 0 && res.maxCode <= 1;
  return res;
}

if (typeof window !== "undefined") window.__studioFinish = { state: finishState, check, finishes: () => Object.keys(FINISHES) };
