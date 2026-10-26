// loop.js: seamless loops. The loop length is measured, not guessed: a self-similarity matrix over the frames,
// filtered along its diagonals (so a match must hold in motion as well as in pose, after Schodl and others'
// video textures, 2000), picks the start and end whose join is smallest against the clip's own typical step.
// Then the join is closed one of three ways:
//   crossfade   the last k frames dissolve into the k frames before the start;
//   flow        the last k frames are pushed along a block-matched flow toward the first frame while they dissolve,
//               so a moving edge slides into place instead of ghosting;
//   pingpong    play forward then back: always seamless, at the cost of a visible turn.
// A held-frame cadence (cadence.js clocks: twos, threes, the 3.6 Hz recut) maps display time to a frame index.
import { image, luma, sampleField, sample, field, blur, mad } from './lib/img.js';
import { clock } from './lib/clock.js';

export const SPEC = Object.freeze({
  params: {
    minLen: { range: [4, 600], unit: 'frames, shortest loop considered', default: 12 },
    blend: { range: [0, 60], unit: 'frames dissolved at the join', default: 6 },
    method: { options: ['crossfade', 'flow', 'pingpong', 'cut'], default: 'flow' },
    proxy: { range: [32, 256], unit: 'px, width of the luma proxy used for measuring', default: 96 },
  },
  determinism: 'measurement and closing are pure functions of the frames and params',
});

export const proxyOf = (im, w = 96) => { const h = Math.max(2, Math.round((im.h * w) / im.w)), L = luma(im), f = field(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) f.data[y * w + x] = sampleField(L, ((x + 0.5) * im.w) / w - 0.5, ((y + 0.5) * im.h) / h - 0.5); return f; };
const fmad = (a, b) => { let s = 0; for (let i = 0; i < a.data.length; i++) s += Math.abs(a.data[i] - b.data[i]); return s / a.data.length; };

// Distance matrix D[i][j] (mean absolute luma difference) over proxies.
export function selfSimilarity(proxies) {
  const n = proxies.length, D = [...Array(n)].map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) D[i][j] = D[j][i] = fmad(proxies[i], proxies[j]);
  return D;
}

// The clip's typical one-frame step: the median of D[i][i+1].
export const stepOf = (D) => { const s = []; for (let i = 0; i + 1 < D.length; i++) s.push(D[i][i + 1]); s.sort((a, b) => a - b); return s[s.length >> 1] || 1e-9; };

// Best loop: frames start..end-1 play, then start again. The join cost compares frame end with frame start
// (end is the frame that would naturally follow end-1), filtered over +-1 neighbours along the diagonal.
// Among joins within `slack` of the best cost, the shortest wins, so a clip that repeats every 24 frames loops at 24.
export function bestLoop(proxies, { minLen = 12, maxLen = Infinity, slack = 0.08 } = {}) {
  const D = selfSimilarity(proxies), n = proxies.length, step = stepOf(D), cands = [];
  for (let s = 1; s < n; s++) for (let e = s + minLen; e < n - 1 && e - s <= maxLen; e++) {
    const c = 0.25 * D[s - 1][e - 1] + 0.5 * D[s][e] + 0.25 * D[s + 1][e + 1];
    cands.push({ start: s, end: e, length: e - s, cost: c });
  }
  if (!cands.length) throw new Error(`loop: clip of ${n} frames is too short for minLen ${minLen}`);
  const best = Math.min(...cands.map((c) => c.cost));
  const pick = cands.filter((c) => c.cost <= best + slack * step).sort((a, b) => a.length - b.length || a.cost - b.cost)[0];
  return { ...pick, step, seamRatio: D[pick.start][pick.end] / step, D };
}

// Scalar signal period by autocorrelation (for a sway, a breath or a pendulum measured as one number per frame).
export function periodOf(sig, { min = 2 } = {}) {
  const n = sig.length, m = sig.reduce((a, b) => a + b, 0) / n, x = sig.map((v) => v - m), ac = [];
  for (let L = 0; L < n / 2; L++) { let s = 0; for (let i = 0; i + L < n; i++) s += x[i] * x[i + L]; ac.push(s / (n - L)); }
  for (let L = min; L < ac.length - 1; L++) if (ac[L] > ac[L - 1] && ac[L] >= ac[L + 1] && ac[L] > 0.3 * ac[0]) return L;
  return 0;
}

const mix = (a, b, t) => { const o = image(a.w, a.h); for (let i = 0; i < a.data.length; i++) o.data[i] = a.data[i] * (1 - t) + b.data[i] * t; return o; };

// Close the loop. frames: RGBA images; start, end from bestLoop. Returns the frames to play, in order.
export function closeLoop(frames, start, end, { method = 'flow', blend = 6 } = {}) {
  const body = frames.slice(start, end), L = body.length;
  if (method === 'cut' || blend < 1) return body;
  if (method === 'pingpong') return [...body, ...body.slice(1, -1).reverse()];
  const k = Math.min(blend, L - 1, start);
  const flowF = method === 'flow' ? flow(frames[end], frames[start]) : null;
  return body.map((f, m) => {
    if (m < L - k) return f;
    const a = (m - (L - k) + 1) / (k + 1), pre = frames[start - (L - m)];
    if (!flowF) return mix(f, pre, a);
    // carry the frame along the end->start flow by a, and the pre-start frame back by 1 - a, then dissolve
    return mix(advect(f, flowF, a), advect(pre, flowF, -(1 - a)), a);
  });
}

// Block-matched flow from a to b: u(x) such that a(x) ~ b(x + u). A four-level pyramid searches +-2 radius at the
// coarsest level and +-radius at each finer one around the estimate below it, so long moves are found cheaply.
export function flow(a, b, { block = 8, radius = 4, w = 128, levels = 4 } = {}) {
  let U = null, V = null, gw = 0, gh = 0;
  for (let lv = levels - 1; lv >= 0; lv--) {
    const pw = Math.max(16, Math.round(w / 2 ** lv)), A = proxyOf(a, pw), B = proxyOf(b, pw), bl = Math.max(4, Math.round(block / 2 ** lv));
    const nw = Math.ceil(A.w / bl), nh = Math.ceil(A.h / bl), U2 = field(nw, nh), V2 = field(nw, nh);
    for (let gy = 0; gy < nh; gy++) for (let gx = 0; gx < nw; gx++) {
      const u0 = U ? 2 * sampleField(U, ((gx + 0.5) * gw) / nw - 0.5, ((gy + 0.5) * gh) / nh - 0.5) : 0, v0 = V ? 2 * sampleField(V, ((gx + 0.5) * gw) / nw - 0.5, ((gy + 0.5) * gh) / nh - 0.5) : 0;
      let best = Infinity, bu = u0, bv = v0; const R = lv === levels - 1 ? 2 * radius : radius;
      for (let dv = -R; dv <= R; dv++) for (let du = -R; du <= R; du++) {
        const cu = Math.round(u0) + du, cv = Math.round(v0) + dv; let s = 0;
        for (let y = gy * bl; y < Math.min(A.h, (gy + 1) * bl); y++) for (let x = gx * bl; x < Math.min(A.w, (gx + 1) * bl); x++) s += Math.abs(A.data[y * A.w + x] - sampleField(B, x + cu, y + cv));
        s += 1e-4 * (cu * cu + cv * cv); // prefer the shortest move on flat ground
        if (s < best) { best = s; bu = cu; bv = cv; }
      }
      U2.data[gy * nw + gx] = bu; V2.data[gy * nw + gx] = bv;
    }
    U = blur(U2, 1, 1); V = blur(V2, 1, 1); gw = nw; gh = nh;
    if (lv === 0) return { U, V, scale: a.w / A.w, block: bl };
  }
}

// Resample image f along the flow by fraction s (positive moves content toward b).
export function advect(f, fl, s) {
  const o = image(f.w, f.h), px = [0, 0, 0, 0], k = 1 / (fl.scale * fl.block);
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const gx = x * k - 0.5, gy = y * k - 0.5, u = sampleField(fl.U, gx, gy) * fl.scale, v = sampleField(fl.V, gx, gy) * fl.scale;
    sample(f, x - s * u, y - s * v, px); o.data.set(px, (y * f.w + x) * 4);
  }
  return o;
}

// Seam quality of a frame list played as a loop: join difference over the median step, both on proxies.
export function seamRatio(frames, w = 96) {
  const P = frames.map((f) => proxyOf(f, w)), steps = [];
  for (let i = 0; i + 1 < P.length; i++) steps.push(fmad(P[i], P[i + 1]));
  steps.sort((a, b) => a - b);
  return fmad(P[P.length - 1], P[0]) / (steps[steps.length >> 1] || 1e-9);
}

export const pingpong = (n) => [...Array(n).keys(), ...[...Array(Math.max(0, n - 2)).keys()].map((i) => n - 2 - i)];

// Display time to a frame index of a loop of n frames, played through a cadence clock (a preset name or a def).
// The clock's state index advances once per held state, so 'twos-24' shows each loop frame for two 24 fps frames.
export function frameAt(t, n, clk = 'twos-24', { seed = 1 } = {}) {
  const c = typeof clk === 'object' && clk.at ? clk : clock(clk, { seed });
  return c.at(t).index % n;
}

// Loop length snapped to the shared bar: the nearest bar / 2^k within tol, else the native length.
export function snapToBar(lengthS, bar = 6.4, tol = 0.12) {
  let best = lengthS, err = Infinity;
  for (let k = -6; k <= 3; k++) { const L = bar / 2 ** k, e = Math.abs(L - lengthS) / lengthS; if (e < err) { err = e; best = L; } }
  return err <= tol ? best : lengthS;
}

// A sequence sheet (Muybridge's plates, a contact sheet, a sprite sheet) cut into its cells. The gutters are found,
// not assumed: a grid (origin, pitch) is fitted to the column and row profiles so the gutter lines sit where the
// profile is darkest (or lightest, gutter: 'light'). Returns [{ x, y, w, h }] in reading order.
export function sliceGrid(im, cols, rows, { gutter = 'dark', inset = 0.04 } = {}) {
  const L = luma(im), colP = new Float32Array(im.w), rowP = new Float32Array(im.h), sgn = gutter === 'dark' ? 1 : -1;
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const v = L.data[y * im.w + x]; colP[x] += v / im.h; rowP[y] += v / im.w; }
  const fit = (P, n) => {
    let best = { cost: Infinity };
    for (let pitch = P.length / (n + 0.6); pitch <= P.length / n; pitch += 0.5) for (let o = 0; o + n * pitch < P.length; o += 0.5) {
      let c = 0; for (let k = 0; k <= n; k++) { const i = Math.min(P.length - 1, Math.round(o + k * pitch)); c += sgn * (P[Math.max(0, i - 1)] + P[i] + P[Math.min(P.length - 1, i + 1)]); }
      if (c < best.cost) best = { cost: c, o, pitch };
    }
    return best;
  };
  const cx = fit(colP, cols), cy = fit(rowP, rows), cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ix = cx.pitch * inset, iy = cy.pitch * inset;
    cells.push({ x: Math.round(cx.o + c * cx.pitch + ix), y: Math.round(cy.o + r * cy.pitch + iy), w: Math.round(cx.pitch - 2 * ix), h: Math.round(cy.pitch - 2 * iy) });
  }
  return cells;
}

export function crop(im, { x, y, w, h }) { const o = image(w, h); for (let j = 0; j < h; j++) o.data.set(im.data.subarray(((y + j) * im.w + x) * 4, ((y + j) * im.w + x + w) * 4), j * w * 4); return o; }

// A sheet as playable frames: slice, crop, and keep every cell when the sheet's own last-to-first join is within
// 1.5 steps, else the measured loop. Pure, so it can run in a worker. row picks one row of cells (or all).
export function sheetFrames(im, cols, rows, { row = null, gutter = 'dark', measure = true } = {}) {
  const cells = sliceGrid(im, cols, rows, { gutter }), pick = row === null ? cells : cells.slice(row * cols, (row + 1) * cols);
  const frames = pick.map((c) => crop(im, c));
  if (!measure || frames.length <= 6 || seamRatio(frames, 40) <= 1.5) return frames;
  const b = bestLoop(frames.map((f) => proxyOf(f, 40)), { minLen: Math.max(3, Math.floor(frames.length / 2)) });
  return frames.slice(b.start, b.end);
}

export { mad };
