// seam-cores.mjs: the seams' pure cores, with no DOM, so the same numbers drive the page (seams.js), the
// superframe nodes (superframe/adapters/universe.mjs) and any film or export.
//
// A seam changes the medium on the way from one place to another. Twelve are defined. Three have their own
// cores here (data to brushstroke, code to image, sound to liquid). Nine run on the studio's material model
// (studio/lib/transition.mjs): a seam names its two materials and the payload it carries.
//
// Inputs that are pictures arrive as a tone grid: { w, h, L: Float32Array luminance 0..1, C: Uint8Array RGB }.
import { cascade, revealOut } from "../../techniques/lib/timing.js";

export { cascade, revealOut };
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
export const sineInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function hashSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---- which material each design region speaks, in the studio's model ----
export const REGION_MATERIAL = Object.freeze({
  grid: "code", deco: "art-deco", brut: "raked-concrete", surreal: "torn-paper",
  print: "spray", glitch: "crt-signal", archive: "engraving",
});
const SOUND = new Set(["signal", "skipping-groove", "longing"]);

// ---- the twelve seams ----
// kind "core" runs a core in this file; kind "studio" runs transition(from, to, payload, t) in the studio.
export const SEAMS = Object.freeze({
  "data-brush":        { n: 1,  kind: "core",   title: "Data to brushstroke", duration: 2.2 },
  "code-image":        { n: 2,  kind: "core",   title: "Code to image", duration: 2.0 },
  "sound-liquid":      { n: 3,  kind: "core",   title: "Sound to liquid", duration: 2.2 },
  "halftone-concrete": { n: 4,  kind: "studio", title: "Halftone to concrete", duration: 2.0, from: "spray", to: "raked-concrete" },
  "plate-riso":        { n: 5,  kind: "studio", title: "Plate to riso", duration: 2.0, from: "engraving", to: "spray" },
  "rope-pull":         { n: 6,  kind: "studio", title: "Rope pull", duration: 2.0, from: "rope", to: null, payload: "data" },
  "engraving-reveal":  { n: 7,  kind: "studio", title: "Engraving reveal", duration: 2.0, from: null, to: "engraving" },
  "chladni-sand":      { n: 8,  kind: "studio", title: "Chladni sand", duration: 2.2, from: "chladni", to: null, payload: "audio" },
  "signal-gather":     { n: 9,  kind: "studio", title: "Signal gather", duration: 2.0, from: null, to: "crt-signal", payload: "data" },
  "crt-glass":         { n: 10, kind: "studio", title: "CRT to glass", duration: 2.0, from: "crt-signal", to: "glass" },
  "code-type":         { n: 11, kind: "studio", title: "Code to type", duration: 2.0, from: "code", to: "spray", payload: "code" },
  "glyph-light":       { n: 12, kind: "studio", title: "Glyph to light", duration: 2.0, from: "light", to: "art-deco", payload: "text" },
});

// Which seam carries a visitor from one place to another. `link` is the featured link or edge between them.
export function seamFor(from, to, link = null) {
  if (!from || !to || from.id === to.id) return "fade";
  const R = to.region, F = from.region;
  if ((from.motifs || []).some((m) => SOUND.has(m))) return ["archive", "glitch", "surreal"].includes(R) ? "sound-liquid" : "chladni-sand";
  if ((F === "grid" || from.kind === "object") && ["brut", "surreal", "deco"].includes(R)) return "data-brush";
  if (F === "grid" && R === "print") return "code-type";
  if (from.code && to.plates && R === "archive") return "code-image";
  if (F === "print" && R === "brut") return "halftone-concrete";
  if (F === "archive" && R === "print") return "plate-riso";
  if (F === "glitch" && R === "surreal") return "crt-glass";
  if (R === "glitch") return "signal-gather";
  if (R === "deco") return "glyph-light";
  if (R === "archive") return "engraving-reveal";
  if (link && link.type === "motif") return "rope-pull";
  return "fade";
}

// Thread counts by type for one place, from the graph's edge list: the data a seam carries.
export function countsFor(edges, id) {
  const c = {}; for (const e of edges) if (e.a === id || e.b === id) c[e.type] = (c[e.type] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}

// The studio call for a studio seam: { from, to, payload } with the materials resolved from the regions.
export function studioCall(id, from, to, counts = []) {
  const s = SEAMS[id]; if (!s || s.kind !== "studio") return null;
  const mFrom = s.from || REGION_MATERIAL[from.region] || "torn-paper", mTo = s.to || REGION_MATERIAL[to.region] || "torn-paper";
  const values = counts.map(([, n]) => n);
  let payload = null;
  if (s.payload === "data") payload = { kind: "data", value: values.length >= 2 ? values : [1, 1] };
  else if (s.payload === "code") payload = { kind: "code", value: from.code || from.title };
  else if (s.payload === "text") payload = { kind: "text", value: from.title };
  else if (s.payload === "audio") {  // onsets at the place's own thread counts, cumulative, across one second
    const tot = values.reduce((a, b) => a + b, 0) || 1; let acc = 0;
    payload = { kind: "audio", value: { onsets: values.map((v) => (acc += v) / tot).slice(0, 8), seconds: 1 } };
  }
  return { from: mFrom, to: mTo, payload };
}

// ---- tone grids ----
export function toneGrid(rgba, w, h) {
  const L = new Float32Array(w * h), C = new Uint8Array(w * h * 3);
  for (let k = 0; k < w * h; k++) { const r = rgba[4 * k], g = rgba[4 * k + 1], b = rgba[4 * k + 2]; C[3 * k] = r; C[3 * k + 1] = g; C[3 * k + 2] = b; L[k] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
  return { w, h, L, C };
}
export function stretch(grid) {  // a plate's tones to the full range, so a picture carries at low contrast
  let lo = 1, hi = 0; for (const v of grid.L) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const L = Float32Array.from(grid.L, (v) => (v - lo) / Math.max(0.05, hi - lo)); return { ...grid, L };
}
// how much a plate carries: colourfulness plus edge energy (picks the richest of a room's plates)
export function richness(grid) {
  let v = 0; for (let k = 0; k < grid.w * grid.h; k++) { const r = grid.C[3 * k], g = grid.C[3 * k + 1], b = grid.C[3 * k + 2]; v += Math.max(r, g, b) - Math.min(r, g, b); }
  for (let k = 1; k < grid.L.length; k++) v += Math.abs(grid.L[k] - grid.L[k - 1]) * 120;
  return v;
}

// ---- 1. data to brushstroke ----
// Each thread the place holds is one dot in its column. Every dot flies to a patch of the next room and breaks
// into strokes coloured from the room's plate and laid across its gradient (along the grain).
export function brushPlan({ counts, grid, w, h, seed = 1, cell = 22 }) {
  const r = rng(seed), dots = [], gx = w * 0.2, gw = w * 0.6, base = h * 0.7, col = gw / Math.max(1, counts.length);
  counts.forEach(([, n], i) => { for (let k = 0; k < n; k++) dots.push({ x: gx + col * (i + 0.5) + ((k % 4) - 1.5) * 8, y: base - Math.floor(k / 4) * 8 - 6 }); });
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell), strokes = [];
  const at = (i, j) => (grid ? grid.L[Math.min(grid.h - 1, Math.floor((j / rows) * grid.h)) * grid.w + Math.min(grid.w - 1, Math.floor((i / cols) * grid.w))] : 0.5);
  const rgbAt = (i, j) => { if (!grid) return [60, 50, 40]; const k = Math.min(grid.h - 1, Math.floor((j / rows) * grid.h)) * grid.w + Math.min(grid.w - 1, Math.floor((i / cols) * grid.w)); return [grid.C[3 * k], grid.C[3 * k + 1], grid.C[3 * k + 2]]; };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const gx2 = at(Math.min(cols - 1, i + 1), j) - at(Math.max(0, i - 1), j), gy2 = at(i, Math.min(rows - 1, j + 1)) - at(i, Math.max(0, j - 1));
    const a = Math.atan2(gy2, gx2) + Math.PI / 2 + (r() - 0.5) * 0.5;
    const src = dots.length ? dots[Math.floor(r() * dots.length)] : { x: w / 2, y: h / 2 };
    const tx = (i + r()) * cell, ty = (j + r()) * cell, dist = Math.hypot(tx - w / 2, ty - h / 2) / Math.hypot(w / 2, h / 2);
    strokes.push({ src, tx, ty, a, L: 26 + r() * 44, wid: 7 + r() * 13, rgb: rgbAt(i, j), seed: (r() * 1e9) | 0, start: 0.55 + dist * 0.7 + r() * 0.25 });
  }
  return { dots, strokes, duration: SEAMS["data-brush"].duration };
}
// Where one stroke is at time t: waiting, a dot in flight, painting (k of its length), or done.
export function strokeAt(s, t) {
  const f = (t - s.start) / 0.5;
  if (f <= -0.6) return { phase: "wait" };
  if (f < 0) { const e = easeOutQuad(1 + f / 0.6); return { phase: "fly", x: s.src.x + (s.tx - s.src.x) * e, y: s.src.y + (s.ty - s.src.y) * e }; }
  return f >= 1 ? { phase: "done", k: 1 } : { phase: "paint", k: sineInOut(f) };
}
// The nine bristles of one stroke at k of its length: quadratic curves [start, control, end], width, alpha, colour.
export function bristles(s, k = 1) {
  const ca = Math.cos(s.a), sa = Math.sin(s.a), r = rng(s.seed), L = s.L * k, out = [];
  for (let b = 0; b < 9; b++) {
    const off = (b / 8 - 0.5) * s.wid, load = 0.5 + r() * 0.5, tone = 0.85 + r() * 0.3, width = 1.2 + r() * 2.4, bend = (r() - 0.5) * 6;
    out.push({
      pts: [[s.tx - (L / 2) * ca - sa * off, s.ty - (L / 2) * sa + ca * off], [s.tx - sa * (off + bend), s.ty + ca * (off + bend)], [s.tx + (L / 2) * ca * load - sa * off, s.ty + (L / 2) * sa * load + ca * off]],
      width, alpha: 0.35 + 0.6 * load, rgb: s.rgb.map((c) => Math.min(255, c * tone) | 0),
    });
  }
  return out;
}

// ---- 2. code to image ----
// The run-it-now line fills the frame as text cells; the characters take the plate's tones, then each square
// cell collapses into one halftone dot, outward from the middle on the measured glyph cascade.
export function halftonePlan({ text, grid, w, h, cell = 15 }) {
  const cw = cell * 0.6, cols = Math.ceil(w / cw), rows = Math.ceil(h / cell), dc = Math.ceil(w / cell);
  const line = (text || "") + "  ", repeated = line.repeat(Math.ceil((cols * rows) / line.length) + 1);
  return { cell, cw, cols, rows, dc, dr: rows, text: repeated, grid: grid ? stretch(grid) : null, duration: SEAMS["code-image"].duration };
}
export function halftoneDark(P, i, j) { const g = P.grid; if (!g) return 0.5; return 1 - g.L[Math.min(g.h - 1, Math.floor((j / P.dr) * g.h)) * g.w + Math.min(g.w - 1, Math.floor((i / P.dc) * g.w))]; }
export function halftoneProgress(P, i, j, t) { const rank = Math.hypot(i - P.dc / 2, (j - P.dr / 2) * 1.3) / Math.hypot(P.dc / 2, P.dr / 2); return clamp(cascade(Math.max(0, t * 1.5 - rank * 0.7))); }
// The frame at time t: glyphs { x, y, ch, alpha } and dots { x, y, r, alpha }.
export function halftoneAt(P, t) {
  const glyphs = [], dots = [], tone = clamp(t / 0.5);
  for (let j = 0, k = 0; j < P.rows; j++) for (let i = 0; i < P.cols; i++, k++) {
    const di = Math.floor((i * P.cw) / P.cell), p = halftoneProgress(P, di, j, t);
    if (p < 0.6) glyphs.push({ x: i * P.cw, y: j * P.cell, ch: P.text[k], alpha: (0.3 + 0.7 * (1 - tone + tone * halftoneDark(P, di, j))) * (1 - p / 0.6) });
  }
  for (let j = 0; j < P.dr; j++) for (let i = 0; i < P.dc; i++) {
    const p = halftoneProgress(P, i, j, t); if (p <= 0.05) continue;
    const r = Math.sqrt(halftoneDark(P, i, j)) * P.cell * 0.62 * Math.min(1, p);
    if (r > 0.3) dots.push({ x: (i + 0.5) * P.cell, y: (j + 0.5) * P.cell, r, alpha: Math.min(1, p * 1.4) });
  }
  return { glyphs, dots };
}

// ---- 3. sound to liquid ----
// A Shepard stack (octave partials under a Gaussian in log frequency), drawn, never played.
export function shepardWave(n = 480) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let v = 0; for (let o = 0; o < 6; o++) { const g = Math.exp(-0.5 * ((o - 2.5) / 1.2) ** 2); v += g * Math.sin((i / n) * 6.283 * 2 ** o * 2); } out[i] = v / 2.6; }
  return out;
}
// A damped wave equation on a grid; step() is one fixed 1/120 s step.
export class WaveField {
  constructor(W = 240, H = 150, { c2 = 0.45, damping = 0.992 } = {}) { Object.assign(this, { W, H, c2, damping }); this.a = new Float32Array(W * H); this.b = new Float32Array(W * H); }
  drop(wave, amp = 0.09) {  // splat a waveform along a line with a soft Gaussian footprint
    const { W, H, a } = this, n = wave.length;
    for (let i = 0; i < n; i++) {
      const cx = 4 + (i / (n - 1)) * (W - 8), cy = H / 2 + wave[i] * H * 0.16;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const X = Math.round(cx + dx), Y = Math.round(cy + dy); if (X < 1 || Y < 1 || X >= W - 1 || Y >= H - 1) continue;
        a[Y * W + X] += amp * Math.exp(-(dx * dx + dy * dy) / 4);
      }
    }
  }
  step() {
    const { W, H, a, b, c2, damping } = this;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; b[i] = (2 * a[i] - b[i] + c2 * (a[i - 1] + a[i + 1] + a[i - W] + a[i + W] - 4 * a[i])) * damping; }
    this.a = b; this.b = a;
  }
}
// The water as sRGB8 RGBA: the plate seen through it, bent by its slope, lit from the upper left.
export function liquidPixels(field, plateC, wall, show, out = null) {
  const { W, H, a: A } = field, d = out || new Uint8ClampedArray(W * H * 4), [WR, WG, WB] = wall;
  for (let y = 1; y < H - 1; y++) for (let X = 1; X < W - 1; X++) {
    const i = y * W + X, nx = A[i + 1] - A[i - 1], ny = A[i + W] - A[i - W], k = 4 * i;
    const sx = Math.min(W - 1, Math.max(0, Math.round(X + nx * 9))), sy = Math.min(H - 1, Math.max(0, Math.round(y + ny * 9))), s3 = 3 * (sy * W + sx);
    const c = plateC ? [plateC[s3], plateC[s3 + 1], plateC[s3 + 2]] : wall, spec = Math.min(1, Math.max(0, (nx - ny) * 4)) ** 2 * 110, shade = 1 - Math.max(0, ny - nx) * 3;
    d[k] = (WR + (c[0] - WR) * show) * shade + spec; d[k + 1] = (WG + (c[1] - WG) * show) * shade + spec; d[k + 2] = (WB + (c[2] - WB) * show) * shade + spec; d[k + 3] = 255;
  }
  return d;
}
// The liquid seam's state at time t from a fresh field (deterministic; used by exports and the superframe node).
export function liquidAt(t, { W = 240, H = 150 } = {}) {
  const f = new WaveField(W, H), wave = shepardWave(480);
  if (t >= 0.45) { f.drop(wave); for (let s = 0, n = Math.round((t - 0.45) * 120); s < n; s++) f.step(); }
  return { field: f, wave, show: clamp((t - 0.55) / 1.2) };
}
