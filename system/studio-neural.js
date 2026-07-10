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
let _raf = 0;
let _running = false;
let _start = 0;

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* Start the living instrument on a canvas. Returns { animating } so the Studio
   knows whether to treat the source as animated (and keep the perception loop
   awake) or as a single still frame (reduced motion). */
export function startNeural(canvas, opts = {}) {
  stopNeural();
  if (!canvas || typeof canvas.getContext !== "function") return { animating: false };
  const ctx = canvas.getContext("2d");
  if (!ctx) return { animating: false };
  const seed = String(opts.seed == null ? "living" : opts.seed);
  const instrument = opts.instrument === "solid" ? "solid" : "field";
  const palette = opts.palette || DEFAULT_TINT;
  const seedNum = neuralSeed(seed);
  // Build the network once; the loop reuses it every frame.
  const net = instrument === "field" ? buildCppn(seedNum) : null;
  const sdf = instrument === "solid" ? buildNeuralSdf(seedNum) : null;
  const drawAt = (time) => renderNeuralFrame(ctx, canvas.width, canvas.height, { seed, instrument, time, palette, net, sdf });

  if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
    drawAt(0);   // one honest still frame; no motion for reduced-motion users
    return { animating: false };
  }
  _running = true;
  _start = 0;
  drawAt(0);   // paint one frame synchronously so the canvas is never blank, even
               // before the first rAF fires (or if rAF is throttled while hidden)
  const loop = (ts) => {
    if (!_running) return;
    if (!_start) _start = ts;
    drawAt((ts - _start) / 1000);
    _raf = requestAnimationFrame(loop);
  };
  _raf = requestAnimationFrame(loop);
  return { animating: true };
}

export function stopNeural() {
  _running = false;
  if (_raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(_raf);
  _raf = 0;
  _start = 0;
}

export function neuralIsRunning() {
  return _running;
}
