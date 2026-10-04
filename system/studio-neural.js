// studio-neural.js: the seed's neural instruments, alive.
//
// The gallery renders the seed-authored neural field and neural solid as frozen
// plates (generative-field.js, one still instant per seed). Here the same
// networks animate under a live clock, and the Studio's perception loop measures
// the motion they make. Nothing new is trained: buildCppn / buildNeuralSdf come
// straight from neural.js, so the living instrument shares its DNA with the
// still plate.
//
// Deterministic per (seed, time): the same seed at the same clock value paints
// the same frame, so the motion is reproducible, not random. Honors
// prefers-reduced-motion by drawing one still frame and never starting a loop.
// Zero dependency; the render core is DOM-less-safe (falls back to fillRect when
// there is no offscreen canvas), so it unit-tests under node.

import { buildCppn, buildNeuralSdf, neuralSeed } from "./neural.js";

// The jewel-tone palette the gallery plates use, so the living and still forms
// read as the same material. Callers may pass their own via opts.palette.
const DEFAULT_TINT = [[80, 196, 185], [167, 115, 255], [239, 171, 48]];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ── the field: a drifting CPPN colour field ────────────────────────────────
// Mirrors the gallery field's colour mapping, but the sampling window drifts on
// a Lissajous path so the pattern flows. The drift is a closed loop, so the
// motion never runs away.
function renderField(ctx, W, H, net, time, tint) {
  const cell = Math.max(2, Math.round(Math.min(W, H) / 240));
  const cols = Math.ceil(W / cell);
  const rows = Math.ceil(H / cell);
  const ox = 0.16 * Math.sin(time * 0.6);
  const oy = 0.13 * Math.sin(time * 0.41);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(6,7,14,1)";
  ctx.fillRect(0, 0, W, H);
  for (let gy = 0; gy < rows; gy += 1) {
    const ny = (gy / (rows - 1)) * 2 - 1;
    for (let gx = 0; gx < cols; gx += 1) {
      const nx = (gx / (cols - 1)) * 2 - 1;
      const c = net.eval(nx + ox, ny + oy);
      const w0 = c[0], w1 = c[1], w2 = c[2];
      const sum = w0 + w1 + w2 + 1e-4;
      const r = (tint[0][0] * w0 + tint[1][0] * w1 + tint[2][0] * w2) / sum;
      const g = (tint[0][1] * w0 + tint[1][1] * w1 + tint[2][1] * w2) / sum;
      const b = (tint[0][2] * w0 + tint[1][2] * w1 + tint[2][2] * w2) / sum;
      const lift = 0.35 + 0.65 * Math.max(w0, w1, w2);
      ctx.fillStyle = `rgb(${Math.round(r * lift)},${Math.round(g * lift)},${Math.round(b * lift)})`;
      ctx.fillRect(gx * cell, gy * cell, cell + 1, cell + 1);
    }
  }
  ctx.restore();
}

// ── the solid: an orbiting neural SDF ──────────────────────────────────────
// A leaner sphere-march than the gallery plate (lower resolution, lambert + a
// soft rim, no ambient occlusion) so it holds a live frame rate. The camera
// orbits the origin, always looking at it, so the solid turns in place.
function renderSolid(ctx, W, H, sdf, time, tint, seedNum) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(4,5,12,1)";
  ctx.fillRect(0, 0, W, H);

  const RW = Math.min(150, Math.max(48, Math.round(W / 6)));
  const RH = Math.max(32, Math.round(RW * (H / Math.max(1, W))));
  const aspect = RW / RH;
  const px = W / RW, py = H / RH;
  const useBuffer = typeof document !== "undefined" && typeof document.createElement === "function";
  let offscreen = null, octx = null, imgData = null, buf = null;
  if (useBuffer) {
    offscreen = document.createElement("canvas");
    offscreen.width = RW; offscreen.height = RH;
    octx = offscreen.getContext("2d");
    imgData = octx.createImageData(RW, RH);
    buf = imgData.data;
  }

  // Base view varies per seed; the live clock turns it. Look-at basis so the ray
  // field stays centred at any yaw.
  const yaw = -0.55 + ((seedNum % 1000) / 1000) * 1.1 + time * 0.25;
  const dist = 3.0;
  const eye = [Math.sin(yaw) * dist, 0.85, Math.cos(yaw) * dist];
  let fx = -eye[0], fy = -eye[1], fz = -eye[2];
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  let rgx = fy * 0 - fz * 1, rgy = fz * 0 - fx * 0, rgz = fx * 1 - fy * 0;
  const rl = Math.hypot(rgx, rgy, rgz) || 1; rgx /= rl; rgy /= rl; rgz /= rl;
  const upx = rgy * fz - rgz * fy, upy = rgz * fx - rgx * fz, upz = rgx * fy - rgy * fx;
  const fov = 0.72;
  const light = [-0.5, 0.75, 0.55];
  const ll = Math.hypot(light[0], light[1], light[2]);
  light[0] /= ll; light[1] /= ll; light[2] /= ll;
  const eps = 0.01;
  const maxSteps = 40;

  for (let j = 0; j < RH; j += 1) {
    const v = (0.5 - j / RH) * 2 * fov;
    for (let i = 0; i < RW; i += 1) {
      const u = (i / RW - 0.5) * 2 * fov * aspect;
      let dx = fx + u * rgx + v * upx;
      let dy = fy + u * rgy + v * upy;
      let dz = fz + u * rgz + v * upz;
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl; dy /= dl; dz /= dl;
      let t = 0, hit = false;
      for (let s = 0; s < maxSteps; s += 1) {
        const x = eye[0] + dx * t, y = eye[1] + dy * t, z = eye[2] + dz * t;
        const d = sdf.dist(x, y, z);
        if (d < eps) { hit = true; break; }
        t += Math.max(0.014, d * 0.85);
        if (t > 6) break;
      }
      if (!hit) continue;
      const x = eye[0] + dx * t, y = eye[1] + dy * t, z = eye[2] + dz * t;
      const gnx = sdf.dist(x + eps, y, z) - sdf.dist(x - eps, y, z);
      const gny = sdf.dist(x, y + eps, z) - sdf.dist(x, y - eps, z);
      const gnz = sdf.dist(x, y, z + eps) - sdf.dist(x, y, z - eps);
      const nl = Math.hypot(gnx, gny, gnz) || 1;
      const nX = gnx / nl, nY = gny / nl, nZ = gnz / nl;
      const lam = Math.max(0.1, nX * light[0] + nY * light[1] + nZ * light[2]);
      const rim = Math.pow(1 - Math.max(0, -(dx * gnx + dy * gny + dz * gnz) / nl), 2.5);
      const w0 = (nX + 1) * 0.5, w1 = (nY + 1) * 0.5, w2 = (nZ + 1) * 0.5;
      const sum = w0 + w1 + w2 + 1e-4;
      const cr = (tint[0][0] * w0 + tint[1][0] * w1 + tint[2][0] * w2) / sum;
      const cg = (tint[0][1] * w0 + tint[1][1] * w1 + tint[2][1] * w2) / sum;
      const cb = (tint[0][2] * w0 + tint[1][2] * w1 + tint[2][2] * w2) / sum;
      const shade = 0.22 + lam * 0.78;
      const R = Math.min(255, cr * shade + rim * 72);
      const G = Math.min(255, cg * shade + rim * 82);
      const B = Math.min(255, cb * shade + rim * 98);
      if (buf) {
        const o = (j * RW + i) * 4;
        buf[o] = R; buf[o + 1] = G; buf[o + 2] = B; buf[o + 3] = 255;
      } else {
        ctx.fillStyle = `rgb(${Math.round(R)},${Math.round(G)},${Math.round(B)})`;
        ctx.fillRect(i * px, j * py, px + 1, py + 1);
      }
    }
  }
  if (buf) {
    octx.putImageData(imgData, 0, 0);
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offscreen, 0, 0, W, H);
    ctx.imageSmoothingEnabled = prevSmooth;
  }
  ctx.restore();
}

/* Draw one frame of a living neural instrument. Pure and deterministic for a
   given (seed, instrument, time): opts = { seed, instrument: "field"|"solid",
   time (seconds), palette, net, sdf }. net/sdf may be supplied to avoid
   rebuilding the network every frame in a loop. */
export function renderNeuralFrame(ctx, W, H, opts = {}) {
  if (!ctx) return;
  const seedNum = neuralSeed(String(opts.seed == null ? "living" : opts.seed));
  const time = opts.time || 0;
  const tint = opts.palette || DEFAULT_TINT;
  if (opts.instrument === "solid") {
    const sdf = opts.sdf || buildNeuralSdf(seedNum);
    renderSolid(ctx, W, H, sdf, time, tint, seedNum);
  } else {
    const net = opts.net || buildCppn(seedNum);
    renderField(ctx, W, H, net, time, tint);
  }
}

export function neuralInstruments() {
  return ["field", "solid"];
}

// ── live driver ─────────────────────────────────────────────────────────────
// The instrument rests on one frame until the visitor presses play, and stops
// again on pause or when the Studio leaves the source. Until 3 October 2026 the
// loop ran from entry at the display's frame rate and drew on the main thread,
// about 1.1 s of script per second with nothing happening. Frames now come from
// a worker (studio-neural-worker.mjs), one request in flight at a time, and the
// page only copies each finished frame onto the canvas. Without a worker the
// frames are drawn here, by renderNeuralFrame, as before.
let _raf = 0;
let _playing = false;
let _start = 0;
let _gen = 0;          // bumps on every start and stop; stale worker frames are dropped
let _live = null;      // { canvas, ctx, seed, instrument, palette, net, sdf, time, onFrame }
let _worker = null;
let _workerBroken = false;
let _inFlight = 0;     // id of the live request in flight, 0 when none
let _nextId = 1;
const _waiters = new Map();   // id -> { resolve, gen, time, canvas }
let _verified = null;
let _scratch = null;   // the solid's low-resolution canvas, reused

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getWorker() {
  if (_worker || _workerBroken) return _worker;
  if (typeof Worker !== "function" || typeof ImageData !== "function") return null;
  try {
    _worker = new Worker(new URL("./studio-neural-worker.mjs?v=20261003-neural-rest", import.meta.url), { type: "module" });
    _worker.onmessage = onWorkerFrame;
    _worker.onerror = (e) => {
      console.error("[studio-neural] frame worker failed; drawing on the main thread:", (e && (e.message || e.type)) || "unknown error");
      _workerBroken = true; _worker = null;
      for (const w of _waiters.values()) w.resolve(false);
      _waiters.clear(); _inFlight = 0;
      // Redraw the resting frame without the worker, so the canvas is never left behind.
      if (_live) drawLive(_live.time);
    };
  } catch (err) {
    console.error("[studio-neural] frame worker unavailable; drawing on the main thread:", err);
    _workerBroken = true; _worker = null;
  }
  return _worker;
}

// Copy a finished frame onto a canvas, as renderField / renderSolid would have drawn it.
function blit(ctx, m) {
  if (m.instrument === "solid") {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(4,5,12,1)";
    ctx.fillRect(0, 0, m.W, m.H);
    if (!_scratch) _scratch = document.createElement("canvas");
    if (_scratch.width !== m.RW || _scratch.height !== m.RH) { _scratch.width = m.RW; _scratch.height = m.RH; }
    _scratch.getContext("2d").putImageData(new ImageData(m.buf, m.RW, m.RH), 0, 0);
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(_scratch, 0, 0, m.W, m.H);
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.restore();
  } else {
    ctx.putImageData(new ImageData(m.buf, m.W, m.H), 0, 0);
  }
}

function onWorkerFrame(e) {
  const m = e.data || {};
  const w = _waiters.get(m.id);
  if (!w) return;
  _waiters.delete(m.id);
  if (_inFlight === m.id) _inFlight = 0;
  if (m.error) {
    // Retire the worker and draw here instead, so a failing worker never leaves the canvas behind.
    console.error("[studio-neural] frame worker failed; drawing on the main thread:", m.error);
    _workerBroken = true;
    try { if (_worker) _worker.terminate(); } catch (_) { /* already gone */ }
    _worker = null;
    for (const other of _waiters.values()) other.resolve(false);
    _waiters.clear(); _inFlight = 0;
    w.resolve(false);
    if (w.canvas) renderNeuralFrame(w.canvas.getContext("2d"), w.canvas.width, w.canvas.height, { ...w.opts, time: w.time });
    else if (w.gen === _gen && _live) drawLive(w.time);
    return;
  }
  _verified = !!m.verified;
  if (w.canvas) {
    // A check or test draw onto a given canvas.
    const fits = w.canvas.width === m.W && w.canvas.height === m.H;
    if (fits) blit(w.canvas.getContext("2d"), m);
    w.resolve(fits);
    return;
  }
  const L = _live;
  if (w.gen !== _gen || !L) { w.resolve(false); return; }
  if (L.canvas.width !== m.W || L.canvas.height !== m.H) {
    // The canvas was resized while the frame was drawn: draw the same time again at the new size.
    w.resolve(false);
    if (!_inFlight) drawLive(w.time);
    return;
  }
  blit(L.ctx, m);
  L.time = w.time;
  w.resolve(true);
  if (L.onFrame) { try { L.onFrame({ time: w.time, playing: _playing }); } catch (_) { /* a listener never stops the instrument */ } }
}

// Post a frame request to the worker. Returns null when there is no worker.
function request(time, canvas, o) {
  const wk = getWorker();
  if (!wk) return null;
  const target = canvas || _live.canvas;
  const opts = o || _live;
  const id = _nextId++;
  return new Promise((resolve) => {
    _waiters.set(id, { resolve, gen: _gen, time, canvas: canvas || null, opts: canvas ? opts : null });
    if (!canvas) _inFlight = id;
    wk.postMessage({ id, seed: opts.seed, instrument: opts.instrument, W: target.width, H: target.height, time, palette: opts.palette });
  });
}

// Draw the frame at `time` onto the live canvas: through the worker when there is one,
// else synchronously here.
function drawLive(time) {
  const L = _live; if (!L) return;
  if (request(time)) return;
  renderNeuralFrame(L.ctx, L.canvas.width, L.canvas.height, { seed: L.seed, instrument: L.instrument, time, palette: L.palette, net: L.net, sdf: L.sdf });
  L.time = time;
  if (L.onFrame) { try { L.onFrame({ time, playing: _playing }); } catch (_) { /* never fatal */ } }
}

/* Start the instrument on a canvas: draw its frame at time 0 and rest there.
   opts.onFrame({ time, playing }) runs after each frame lands on the canvas.
   Returns { animating: false }: the source holds a still frame until playNeural(). */
export function startNeural(canvas, opts = {}) {
  stopNeural();
  if (!canvas || typeof canvas.getContext !== "function") return { animating: false };
  const ctx = canvas.getContext("2d");
  if (!ctx) return { animating: false };
  const seed = String(opts.seed == null ? "living" : opts.seed);
  const instrument = opts.instrument === "solid" ? "solid" : "field";
  const palette = opts.palette || DEFAULT_TINT;
  const seedNum = neuralSeed(seed);
  // The main-thread fallback builds the network once and reuses it every frame.
  const net = instrument === "field" ? buildCppn(seedNum) : null;
  const sdf = instrument === "solid" ? buildNeuralSdf(seedNum) : null;
  _live = { canvas, ctx, seed, instrument, palette, net, sdf, time: 0, onFrame: opts.onFrame || null };
  drawLive(0);
  return { animating: false };
}

/* Set the instrument moving from the time it rests at. Refused (returns false) under
   reduced motion, without an animation clock, or before startNeural. */
export function playNeural() {
  if (!_live) return false;
  if (_playing) return true;
  if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") return false;
  _playing = true;
  _start = 0;
  const gen = _gen;
  const loop = (ts) => {
    if (!_playing || gen !== _gen || !_live) return;
    if (!_start) _start = ts - _live.time * 1000;
    if (!_inFlight) drawLive((ts - _start) / 1000);
    _raf = requestAnimationFrame(loop);
  };
  _raf = requestAnimationFrame(loop);
  return true;
}

/* Draw the resting frame again, at the canvas's current size (after a resize cleared it). */
export function redrawNeural() {
  if (_live && !_playing && !_inFlight) drawLive(_live.time);
}

/* Hold the frame on the canvas; playNeural() resumes from it. */
export function pauseNeural() {
  _playing = false;
  if (_raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(_raf);
  _raf = 0;
  _start = 0;
}

export function stopNeural() {
  pauseNeural();
  _gen += 1;
  _inFlight = 0;
  _live = null;
}

export function neuralIsRunning() {
  return _playing;
}

/* The clock time of the frame on the canvas, in seconds. */
export function neuralTime() {
  return _live ? _live.time : 0;
}

/* Whether the worker's fast kernels matched the networks' own eval on its check
   (null before the first worker frame). */
export function neuralWorkerVerified() {
  return _verified;
}

/* Draw the frame at opts.time onto any canvas through the worker (through renderNeuralFrame
   when there is no worker). Resolves true once the frame is on the canvas. For checks. */
export function drawNeuralAt(canvas, opts = {}) {
  const o = {
    seed: String(opts.seed == null ? "living" : opts.seed),
    instrument: opts.instrument === "solid" ? "solid" : "field",
    palette: opts.palette || DEFAULT_TINT,
  };
  const time = opts.time || 0;
  const p = request(time, canvas, o);
  if (p) return p;
  renderNeuralFrame(canvas.getContext("2d"), canvas.width, canvas.height, { ...o, time });
  return Promise.resolve(true);
}
