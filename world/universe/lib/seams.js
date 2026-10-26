// seams.js: the seams on a canvas. The numbers come from seam-cores.mjs (shared with the superframe nodes);
// studio seams come from the studio's material model, rendered as held frames in seam-worker.js.
// Clock: fixed 1/120 s steps, dt clamped at 100 ms (QUALITY-SPEC M4). Under reduced motion or Plain view
// every seam is a 240 ms fade.
import { ROOT } from "./data.js";
import { SEAMS, brushPlan, strokeAt, bristles, halftonePlan, halftoneAt, shepardWave, WaveField, liquidPixels,
  clamp, easeOutQuad, toneGrid, richness, countsFor, studioCall, hashSeed } from "./seam-cores.mjs";

export { SEAMS };

function loadImg(src) { return new Promise((res) => { const i = new Image(); i.src = src; i.onload = () => res(i); i.onerror = () => { console.warn("seam: plate missing", src); res(null); }; }); }
function gridOf(img, w, h) {
  const c = new OffscreenCanvas(w, h), x = c.getContext("2d"), s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  x.drawImage(img, (w - img.naturalWidth * s) / 2, (h - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  return toneGrid(x.getImageData(0, 0, w, h).data, w, h);
}
// the richest of a room's first four plates, as a tone grid at w x h
async function plateGrid(paths, w, h) {
  let best = null, bv = -1;
  for (const p of (paths || []).slice(0, 4)) { const i = await loadImg(ROOT + p); if (!i) continue; const v = richness(gridOf(i, 24, 16)); if (v > bv) { bv = v; best = i; } }
  return best ? gridOf(best, w, h) : null;
}
const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

const CORE = {
  "data-brush": {
    async setup(st, { from, to, u, w, h }) {
      const grid = await plateGrid(to.plates, Math.ceil(w / 22), Math.ceil(h / 22));
      st.plan = brushPlan({ counts: countsFor(u.edges, from.id), grid, w, h, seed: hashSeed(from.id + to.id) });
      st.done = new OffscreenCanvas(Math.round(w * 2), Math.round(h * 2)); st.dctx = st.done.getContext("2d"); st.dctx.scale(2, 2);
      st.state = new Uint8Array(st.plan.strokes.length);
    },
    paint(x, s, k) {
      for (const b of bristles(s, k)) {
        x.globalAlpha = b.alpha; x.strokeStyle = `rgb(${b.rgb[0]},${b.rgb[1]},${b.rgb[2]})`; x.lineWidth = b.width; x.lineCap = "round";
        x.beginPath(); x.moveTo(...b.pts[0]); x.quadraticCurveTo(...b.pts[1], ...b.pts[2]); x.stroke();
      }
    },
    draw(st, x, t, { w, h, ink, wall }) {
      x.fillStyle = wall; x.fillRect(0, 0, w, h);
      st.plan.strokes.forEach((s, i) => { if (!st.state[i] && strokeAt(s, t).phase === "done") { this.paint(st.dctx, s, 1); st.state[i] = 1; } });
      x.globalAlpha = 1; x.drawImage(st.done, 0, 0, w, h);
      const chart = 1 - clamp((t - 0.45) / 0.35);
      if (chart > 0) { x.globalAlpha = chart; x.fillStyle = ink; for (const d of st.plan.dots) { x.beginPath(); x.arc(d.x, d.y, 3, 0, 6.283); x.fill(); } x.fillRect(w * 0.18, h * 0.7 + 4, w * 0.64, 1.5); }
      st.plan.strokes.forEach((s, i) => {
        if (st.state[i]) return; const p = strokeAt(s, t);
        if (p.phase === "fly") { x.globalAlpha = 0.8; x.fillStyle = ink; x.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
        else if (p.phase === "paint") this.paint(x, s, p.k);
      });
      x.globalAlpha = 1;
    },
  },
  "code-image": {
    async setup(st, { from, to, w, h }) {
      const cell = w < 600 ? 11 : 15;
      st.plan = halftonePlan({ text: from.code, grid: await plateGrid(to.plates, Math.ceil(w / cell), Math.ceil(h / cell)), w, h, cell });
    },
    draw(st, x, t, { w, h, ink, wall }) {
      x.fillStyle = wall; x.fillRect(0, 0, w, h);
      const f = halftoneAt(st.plan, t), face = getComputedStyle(document.documentElement).getPropertyValue("--face-utility") || "monospace";
      x.font = `400 ${st.plan.cell - 3}px ${face}`; x.textBaseline = "top"; x.fillStyle = ink;
      for (const g of f.glyphs) { x.globalAlpha = g.alpha; x.fillText(g.ch, g.x, g.y); }
      for (const d of f.dots) { x.globalAlpha = d.alpha; x.beginPath(); x.arc(d.x, d.y, d.r, 0, 6.283); x.fill(); }
      x.globalAlpha = 1;
    },
  },
  "sound-liquid": {
    async setup(st, { to }) {
      st.field = new WaveField(240, 150); st.wave = shepardWave(480); st.dropped = false;
      st.plate = (await plateGrid(to.plates, 240, 150))?.C || null;
      st.off = new OffscreenCanvas(240, 150); st.img = st.off.getContext("2d").createImageData(240, 150);
    },
    step(st) { if (st.dropped) st.field.step(); },
    draw(st, x, t, { w, h, ink, wall }) {
      x.fillStyle = wall; x.fillRect(0, 0, w, h);
      if (t < 0.45) {  // the tone, drawn as its waveform, falling toward the surface
        const y0 = h * (0.25 + 0.25 * easeOutQuad(t / 0.45)); x.strokeStyle = ink; x.lineWidth = 1.6; x.beginPath();
        st.wave.forEach((v, i) => { const X = (i / 479) * w, Y = y0 + v * h * 0.16; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke(); return;
      }
      if (!st.dropped) { st.dropped = true; st.field.drop(st.wave); }
      liquidPixels(st.field, st.plate, rgbOf(wall), clamp((t - 0.55) / 1.2), st.img.data);
      st.off.getContext("2d").putImageData(st.img, 0, 0);
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(st.off, 1, 1, 238, 148, 0, 0, w, h);
    },
  },
};

// ---- studio seams: held frames from the worker, cached by key, prepared ahead when a place comes into focus ----
const FRAMES = 8, FW = 240, FH = 150, cache = new Map();
let worker = null;
function studioWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL("./seam-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => { const { key, i, bitmap, done, error } = e.data, c = cache.get(key); if (!c) return; if (bitmap) c.frames[i] = bitmap; if (error) console.warn("seam: studio frame failed", key, i, error); if (done) { c.ready = true; c.wait.forEach((f) => f()); c.wait = []; } };
    worker.onerror = (e) => { console.warn("seam: studio worker failed; studio seams fall back to a fade", e.message); worker = false; };
  } catch (e) { console.warn("seam: no worker; studio seams fall back to a fade", e); worker = false; }
  return worker;
}
const keyOf = (id, from, to) => `${id}:${from.id}:${to.id}`;
// Start rendering a seam's frames before the visitor asks for it (called when a place comes into focus).
export function prepareSeam(id, from, to, u) {
  const s = SEAMS[id]; if (!s || s.kind !== "studio" || !from || !to) return null;
  const key = keyOf(id, from, to); if (cache.has(key)) return cache.get(key);
  const w = studioWorker(); if (!w) return null;
  const call = studioCall(id, from, to, countsFor(u.edges, from.id)), entry = { frames: [], ready: false, wait: [] };
  cache.set(key, entry);
  w.postMessage({ key, ...call, frames: FRAMES, w: FW, h: FH, seed: hashSeed(key) });
  return entry;
}

// Run a seam over `canvas`, then fade the canvas away. Resolves when the place underneath is showing.
export async function play(canvas, id, ctx) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("plain");
  const seam = SEAMS[id];
  const dpr = Math.min(devicePixelRatio || 1, 2.5), w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const x = canvas.getContext("2d", { colorSpace: "display-p3" }); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const env = { w, h, ink: css("--ink") || "#16130f", wall: css("--wall") || "#e8e3d9" };
  canvas.dataset.seam = reduce || !seam ? "fade" : id;
  if (reduce || !seam) { x.fillStyle = env.wall; x.fillRect(0, 0, w, h); return fade(canvas, 240); }
  const T = seam.duration, DT = 1 / 120;
  let draw, step = null;
  if (seam.kind === "core") { const C = CORE[id], st = {}; await C.setup(st, { ...ctx, w, h }); draw = (t) => C.draw(st, x, t, env); step = C.step ? () => C.step(st) : null; }
  else {
    const entry = prepareSeam(id, ctx.from, ctx.to, ctx.u);
    if (!entry) { x.fillStyle = env.wall; x.fillRect(0, 0, w, h); return fade(canvas, 240); }
    draw = (t) => {  // held frames on the material's cadence; a frame not yet painted holds the last one
      const i = Math.min(FRAMES - 1, Math.floor((t / T) * FRAMES)); let f = null;
      for (let k = i; k >= 0 && !f; k--) f = entry.frames[k];
      x.fillStyle = env.wall; x.fillRect(0, 0, w, h);
      if (f) { x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(f, 0, 0, w, h); }
    };
  }
  if (ctx.hold != null) {  // review aid: render one fixed moment and stay there (?hold=0.8)
    if (seam.kind === "studio") await new Promise((r) => { const e = cache.get(keyOf(id, ctx.from, ctx.to)); if (!e || e.ready) r(); else e.wait.push(r); });
    for (let t = 0; t < ctx.hold; t += DT) { if (step && t > 0.45) { draw(t); step(); } }
    draw(ctx.hold); return;
  }
  return new Promise((done) => {
    let t = 0, acc = 0, last = performance.now();
    const tick = (now) => {
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      while (acc >= DT) { if (step && t > 0.45) step(); t += DT; acc -= DT; }
      draw(Math.min(t, T));
      if (t < T) requestAnimationFrame(tick); else fade(canvas, 420).then(done);
    };
    requestAnimationFrame(tick);
  });
}

function fade(canvas, ms) {
  canvas.style.transition = `opacity ${ms}ms cubic-bezier(0.4,0,1,1)`;
  requestAnimationFrame(() => { canvas.style.opacity = "0"; });
  return new Promise((r) => setTimeout(() => { canvas.hidden = true; r(); }, ms + 40));
}
