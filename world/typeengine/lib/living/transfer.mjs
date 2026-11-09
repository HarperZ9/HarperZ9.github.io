// lib/living/transfer.mjs: the surface a word moves across while it changes medium. A top-down sheet of liquid on
// the superframe's medium grid (lib/medium/grid.mjs, read-only: semi-Lagrangian advection, implicit diffusion,
// pressure projection, vorticity confinement). Three fields ride on it:
//   P   where the material now at each cell came from (a position map, advected by the flow): the word travels
//   W   the process: wetness, drying, the water's dye; where it reaches the moving material, the medium changes
//   R   how much of the top material remains (washed by W): only the reveal uses it
// Each transition brings its own law (LAWS below): how the liquid is driven, what W is, how long it takes in its own
// physics, and how the surface settles. No law is global; the edge picks one (graph.mjs).
//   simulate(law, { w, h, G, seed }) -> { nx, ny, frames: [{ px, py, W, R }], seconds }
import { advect, diffuse, project, confine } from '../../../superframe/lib/medium/grid.mjs';
import { clamp, hash, noise } from './fields.mjs';

export const LAWS = new Map();
export function registerLaw(id, law) { LAWS.set(id, { seconds: 3, keep: 0.6, settle: 0.45, turb: 0.6, visc: 0.02, ...law, id }); }
const DT = 1 / 30, FRAMES = 40;

/** Run a law and keep FRAMES keyframes of its fields. The fields are on a coarse grid (cells of `cell` px). */
export function simulate(lawId, { w, h, G, seed = 1, cell = 8 }) {
  const law = LAWS.get(lawId); if (!law) throw new Error(`living: unknown law "${lawId}" (one of ${[...LAWS.keys()].join(', ')})`);
  const nx = Math.max(8, Math.round(w / cell)), ny = Math.max(4, Math.round(h / cell)), n = nx * ny, sx = w / nx, sy = h / ny;
  const u = new Float32Array(n), v = new Float32Array(n), px = new Float32Array(n), py = new Float32Array(n), W = new Float32Array(n), R = new Float32Array(n).fill(1);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { px[j * nx + i] = i; py[j * nx + i] = j; }
  const t1 = new Float32Array(n), t2 = new Float32Array(n), p = new Float32Array(n), div = new Float32Array(n), curl = new Float32Array(n), phase = new Uint8Array(n), solid = new Uint8Array(n);
  const ink = cellsOf(G, nx, ny, sx, sy), env = { nx, ny, sx, sy, ink, seed, law, G, patch: noise(nx, ny, 5, seed + 41, 2) }; // patches, not per-cell speckle
  law.init?.(env, { u, v, W });
  let D0 = null, V0 = null; const lastX = Float32Array.from(px), lastY = Float32Array.from(py), settleSteps = Math.max(1, Math.round(law.settle * law.seconds / DT)), e0 = seed;
  const steps = Math.round(law.seconds / DT), every = Math.max(1, Math.floor(steps / FRAMES)), frames = [];
  for (let s = 0; s <= steps; s++) {
    const f = s / steps;
    law.drive(env, f, { u, v, W, px, py });
    diffuse(u, law.visc, nx, ny, 4, t1); diffuse(v, law.visc, nx, ny, 4, t1);
    confine(u, v, law.turb * (1 - f), nx, ny, DT, curl);
    if (law.incompressible !== false) project(u, v, phase, solid, nx, ny, 20, p, div); // a thin film on paper spreads; it is not a closed box
    advect(u, u, v, nx, ny, DT, t1); advect(v, u, v, nx, ny, DT, t2); u.set(t1); v.set(t2);
    advect(px, u, v, nx, ny, DT, t1); advect(py, u, v, nx, ny, DT, t2); px.set(t1); py.set(t2);
    if (law.carryW !== false) { advect(W, u, v, nx, ny, DT, t1); W.set(t1); }
    if (law.wash) for (let k = 0; k < n; k++) R[k] *= Math.exp(-law.wash * W[k] * DT);
    // settling: in the last part of the law's time the liquid stills and the carried material comes to rest where the
    // law says (back home for a medium change, wherever it lies for a wash)
    if (f > 1 - law.settle) {
      const k0 = (f - (1 - law.settle)) / law.settle, damp = 1 - 0.18 * k0;
      for (let k = 0; k < n; k++) { u[k] *= damp; v[k] *= damp; }
      // coming home: from where the material is and how it is moving when settling begins, a Hermite curve brings it
      // to its own place at rest (it carries on with its drift, turns, and arrives without a jolt or a snap)
      if (law.home !== false) {
        if (!D0) { D0 = new Float32Array(n * 2); V0 = new Float32Array(n * 2); for (let k = 0; k < n; k++) { D0[2 * k] = px[k] - (k % nx); D0[2 * k + 1] = py[k] - Math.floor(k / nx); V0[2 * k] = (px[k] - lastX[k]) * settleSteps; V0[2 * k + 1] = (py[k] - lastY[k]) * settleSteps; } }
        const u = k0, h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u;
        for (let k = 0; k < n; k++) { px[k] = (k % nx) + D0[2 * k] * h00 + V0[2 * k] * h10; py[k] = Math.floor(k / nx) + D0[2 * k + 1] * h00 + V0[2 * k + 1] * h10; }
      }
    }
    // every law finishes its own process: cells it has not reached turn in its last quarter, each at its own moment
    // (a staggered front, not a fade), so the last frame of a move is the stop's settled image
    if (f > 0.75 && law.finish !== false) for (let k = 0; k < n; k++) W[k] = Math.max(W[k], clamp((f - 0.75 - 0.15 * env.patch[k]) / 0.1));
    lastX.set(px); lastY.set(py);
    if (s % every === 0 || s === steps) frames.push({ px: Float32Array.from(px), py: Float32Array.from(py), W: Float32Array.from(W), R: Float32Array.from(R) });
  }
  if (law.home !== false) { const last = frames[frames.length - 1]; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { last.px[j * nx + i] = i; last.py[j * nx + i] = j; } }
  return { law: lawId, nx, ny, sx, sy, frames, seconds: law.seconds };
}

function cellsOf(G, nx, ny, sx, sy) {
  const out = new Float32Array(nx * ny), c = G.coverage.data, w = G.w;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let s = 0, m = 0; for (let y = Math.floor(j * sy); y < Math.floor((j + 1) * sy); y++) for (let x = Math.floor(i * sx); x < Math.floor((i + 1) * sx); x++) { s += c[y * w + x]; m++; } out[j * nx + i] = m ? s / m : 0; }
  return out;
}
const gauss = (d, r) => Math.exp(-(d * d) / (r * r));

// ---- the laws each medium brings ----
// bleed: ink spreading and drying. A slow sideways creep with small curls; W is dryness, reaching thin parts first
// and moving outward from the ink as it dries (diffusion time, so the front slows: radius ~ sqrt(t)).
registerLaw('bleed', { seconds: 3.2, turb: 0.8, visc: 0.05, carryW: true,
  init(e, { W }) { for (let k = 0; k < W.length; k++) W[k] = 0; },
  drive(e, f, { u, v, W }) {
    const { nx, ny } = e, push = 1.4 * Math.sin(Math.PI * Math.min(1, f * 1.4));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; u[k] += (push + 0.25 * (hash(i >> 2, j >> 2, e.seed) - 0.5)) * DT * 4; v[k] += 0.2 * Math.sin(i * 0.4 + e.seed) * DT * 4; }
    const front = Math.sqrt(f) * 1.25; for (let k = 0; k < W.length; k++) { const thin = 1 - e.ink[k]; W[k] = Math.max(W[k], clamp((front - 0.4 * (1 - thin) - 0.8 * (e.patch[k] - 0.2)) * 3)); }
  } });
// wet: sap running along the strokes. The flow follows the stroke direction; W, the wetness, spreads from each
// stroke's start along its length.
registerLaw('wet', { seconds: 2.8, turb: 0.8, visc: 0.03,
  drive(e, f, { u, v, W }) {
    const { nx, ny, sx, sy, G } = e, T = (e.tan ??= tanCells(G, nx, ny, sx, sy)), sp = 1.3 * Math.sin(Math.PI * Math.min(1, f * 1.3));
    for (let k = 0; k < u.length; k++) { if (!T.on[k]) continue; u[k] += T.tx[k] * sp * DT * 6; v[k] += T.ty[k] * sp * DT * 6; W[k] = Math.max(W[k], clamp((f * 1.5 - T.arc[k]) * 3)); }
    diffuse(W, 0.2, nx, ny, 2, new Float32Array(W.length));
  } });
// pour: water poured across the sheet from the left. It carries the top word downstream and washes it (R), and the
// water itself (W) is the dye that shows where it has passed. The reveal (reveal.mjs) is built on this law.
registerLaw('pour', { seconds: 4.2, turb: 2.2, visc: 0.01, wash: 6, home: false, settle: 0.25, incompressible: false,
  drive(e, f, { u, v, W }) {
    const { nx, ny } = e, H = (j) => f * 1.6 * nx + nx * 0.09 * (Math.sin(j * 0.9 + e.seed) + 0.6 * Math.sin(j * 2.3 + e.seed * 3)), head = f * 1.6 * nx;
    for (let j = 0; j < ny; j++) for (let i = 0; i < Math.min(nx, H(j)); i++) {
      const k = j * nx + i, lip = gauss(i - H(j), nx * 0.12) + 0.35; u[k] += 9 * lip * DT * (1 - f * 0.6); v[k] += 1.4 * Math.sin(j * 0.7 + i * 0.13 + e.seed) * DT;
      if (i < 3) W[k] = 1;
    }
    for (let k = 0; k < W.length; k++) { const hj = H((k / nx) | 0); if ((k % nx) < hj) W[k] = Math.max(W[k], 0.85 * clamp(1 - ((k % nx) - hj + 6) / 6)); }
    diffuse(W, 0.3, nx, ny, 2, new Float32Array(W.length));
  } });
// settle: digital to analog. Each cell lets go and falls a little under gravity, spreading as it lands; W reaches
// the cells one at a time, the ground first and the letters last, so the word stays whole while its ground changes.
registerLaw('settle', { seconds: 2.4, turb: 0.4, visc: 0.05,
  drive(e, f, { u, v, W }) {
    const { nx, ny } = e; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, go = clamp((f * 1.4 - (0.55 * clamp(e.ink[k] * 2) + 0.3 * e.patch[k] + 0.15 * hash(i, j, e.seed + 9))) * 14); W[k] = Math.max(W[k], go); v[k] += 4 * go * (1 - f) * DT * 3; }
  } });
// scan: analog to digital. A scanner bar moves along the line in the reading direction, so each letter is read whole
// (a bar sweeping down split every word top from bottom: OCR read nothing mid-move); the bar jostles the material
// slightly as it passes.
registerLaw('scan', { seconds: 1.8, turb: 0, visc: 0.2, carryW: false,
  drive(e, f, { v, W }) { const { nx, ny } = e, col = f * 1.15 * nx; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, d = col - i; W[k] = clamp(d / 1.5 + 0.5); v[k] += (d > -1 && d < 1 ? 2 : 0) * Math.sin(j * 1.7 + e.seed) * DT; } } });
// stream: code to drawing. The characters run along the strokes as text runs along a line, and resolve into lines
// in the order the strokes are drawn.
registerLaw('stream', { seconds: 3.0, turb: 0.3, visc: 0.02,
  drive(e, f, { u, v, W }) { const { nx, ny, sx, sy, G } = e, T = (e.tan ??= tanCells(G, nx, ny, sx, sy)), sp = 4 * Math.sin(Math.PI * f); for (let k = 0; k < u.length; k++) { if (!T.on[k]) continue; u[k] += T.tx[k] * sp * DT * 5; v[k] += T.ty[k] * sp * DT * 5; W[k] = Math.max(W[k], clamp((f * 1.3 - T.arc[k] * 0.8) * 4)); } } });
// wake: a still print starts to move. The liquid under it comes alive from the centre outward (the visitor arriving).
registerLaw('wake', { seconds: 2.6, turb: 1.0, visc: 0.03, settle: 0.2,
  drive(e, f, { u, v, W }) { const { nx, ny } = e; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, r = Math.hypot((i - nx / 2) / nx, (j - ny / 2) / ny) * 2, on = clamp((f * 1.5 - r) * 3); W[k] = Math.max(W[k], on); const a = hash(i >> 1, j >> 1, e.seed) * 6.28; u[k] += Math.cos(a) * on * DT * 1.6; v[k] += Math.sin(a) * on * DT * 1.6; } } });

function tanCells(G, nx, ny, sx, sy) {
  const tx = new Float32Array(nx * ny), ty = new Float32Array(nx * ny), arc = new Float32Array(nx * ny).fill(1), on = new Uint8Array(nx * ny);
  for (const s of G.strokes.strokes) {
    let tot = 0; const L = [0]; for (let i = 1; i < s.pts.length; i++) { tot += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]); L.push(tot); }
    for (let i = 1; i < s.pts.length; i++) {
      const [ax, ay] = s.pts[i - 1], [bx, by] = s.pts[i], l = Math.hypot(bx - ax, by - ay) || 1, steps = Math.ceil(l / Math.min(sx, sy)) + 1;
      for (let q = 0; q <= steps; q++) { const t = q / steps, ci = Math.floor((ax + (bx - ax) * t) / sx), cj = Math.floor((ay + (by - ay) * t) / sy); if (ci < 0 || cj < 0 || ci >= nx || cj >= ny) continue; const k = cj * nx + ci; tx[k] = (bx - ax) / l; ty[k] = (by - ay) / l; arc[k] = tot ? (L[i - 1] + t * l) / tot : 0; on[k] = 1; }
    }
  }
  return { tx, ty, arc, on };
}
