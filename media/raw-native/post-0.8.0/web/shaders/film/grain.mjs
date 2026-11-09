// Film grain from the Boolean model (Newson, Delon, Galerne, "A Stochastic Film Grain Model
// for Resolution-Independent Rendering", CGF 2017), written here from the model's equations.
//
// A layer's developed dye is a union of discs of radius r (dye clouds) whose centres form a
// Poisson process. For the covered fraction to be u the intensity must be
// lambda(u) = ln(1 / (1 - u)) / (pi r^2). Grain lives on the film plane in micrometres, so a
// pixel sees however many clouds its footprint holds: the same negative scanned finer shows
// larger, sharper grain, and coarser shows less of it (Selwyn's law, sigma * sqrt(A) constant).
//
// Two regimes, one model:
//  - clouds not much smaller than a pixel: Monte Carlo over the pixel, with the clouds
//    generated cell by cell from a hash, so the pattern is the same whichever pixel asks;
//  - clouds much smaller than a pixel: the pixel mean is u and its variance is the model's
//    exact covariance integral over the pixel area, so a gaussian of that variance is drawn.
// In between, the two are mixed with weights whose squares sum to 1, which keeps the variance.
import { hash3, pcg } from "../common.mjs";

// Lens area of two unit discs at centre distance s (0 <= s <= 2).
const lens = (s) => 2 * Math.acos(s / 2) - (s / 2) * Math.sqrt(4 - s * s);
// J1(u) = (1-u)^2 * integral_0^2 (exp(lambda r^2 lens(s)) - 1) 2 pi s ds, per unit r^2.
// The variance of a pixel of area A is J1(u) r^2 / A when r^2 << A.
export const J_TABLE_N = 33;
export function varianceTable() {
  const t = new Float32Array(J_TABLE_N);
  for (let i = 0; i < J_TABLE_N; i++) {
    const u = Math.min(0.995, i / (J_TABLE_N - 1)), lr = -Math.log(1 - u) / Math.PI;
    let acc = 0; const n = 400;
    for (let k = 0; k < n; k++) { const s = ((k + 0.5) * 2) / n; acc += (Math.exp(lr * lens(s)) - 1) * 2 * Math.PI * s * (2 / n); }
    t[i] = (1 - u) * (1 - u) * acc;
  }
  return t;
}
export function tableAt(t, u) {
  const f = Math.min(J_TABLE_N - 1, Math.max(0, u * (J_TABLE_N - 1))), i = Math.min(J_TABLE_N - 2, Math.floor(f));
  return t[i] + (t[i + 1] - t[i]) * (f - i);
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const REGIME = { mcFrom: 0.25, mcFull: 0.4 };

// The cloud count of a cell is Poisson(mu). It is drawn in integers so the CPU and the GPU
// cannot disagree: mu is quantised to MU_LEVELS steps over [0, MU_MAX], and the CDF of each
// level is stored as u32 thresholds; the count is how many thresholds the cell's u32 hash
// passes. (A float comparison of a uniform against the CDF flips when the two sit within an
// ulp, which happened on a real pixel in the first parity run.)
export const MU_LEVELS = 512, MU_MAX = -Math.log(0.001) / Math.PI, POIS_K = 16;
export function poissonTable() {
  const t = new Uint32Array(MU_LEVELS * POIS_K);
  for (let m = 0; m < MU_LEVELS; m++) {
    const mu = ((m + 0.5) * MU_MAX) / MU_LEVELS;
    let p = Math.exp(-mu), F = p;
    for (let k = 0; k < POIS_K; k++) { t[m * POIS_K + k] = Math.min(4294967295, Math.floor(F * 4294967296)); p *= mu / (k + 1); F += p; }
  }
  return t;
}
const POIS = poissonTable();
export function poissonCount(mu, h) {
  const m = Math.min(MU_LEVELS - 1, Math.max(0, Math.floor((mu / MU_MAX) * MU_LEVELS)));
  let k = 0;
  while (k < POIS_K && h >= POIS[m * POIS_K + k]) k++;
  return k;
}

// Monte Carlo coverage of pixel (px, py) for layer c. uAt(px, py) reads the layer's u.
export function grainMC(px, py, c, rUm, umPerPx, frame, uAt, W, H) {
  const rPx = rUm / umPerPx, ns = Math.min(64, Math.max(8, Math.ceil(12 / (Math.PI * rPx * rPx))));
  const d = rUm, seed = (frame * 3 + c) >>> 0;
  let hit = 0;
  for (let s = 0; s < ns; s++) {
    const x = (px + hash3(px, py, seed * 131 + 2 * s)) * umPerPx, y = (py + hash3(px, py, seed * 131 + 2 * s + 1)) * umPerPx;
    const cx0 = Math.floor(x / d), cy0 = Math.floor(y / d);
    // Cloud edges are soft over 5% of the radius and the union is a max, so coverage is a
    // continuous function of position and f32 and f64 agree on it.
    let cov = 0;
    for (let cy = cy0 - 1; cy <= cy0 + 1 && cov < 1; cy++) for (let cx = cx0 - 1; cx <= cx0 + 1 && cov < 1; cx++) {
      const qx = Math.min(W - 1, Math.max(0, Math.floor(((cx + 0.5) * d) / umPerPx))), qy = Math.min(H - 1, Math.max(0, Math.floor(((cy + 0.5) * d) / umPerPx)));
      const u = Math.min(0.999, uAt(qx, qy)), mu = -Math.log(1 - u) / Math.PI;
      const k = poissonCount(mu, pcg((cx >>> 0) ^ pcg((cy >>> 0) ^ pcg((seed * 977 + 1) >>> 0))));
      for (let gI = 0; gI < k; gI++) {
        const gx = (cx + hash3(cx >>> 0, cy >>> 0, seed * 977 + 2 + 2 * gI)) * d, gy = (cy + hash3(cx >>> 0, cy >>> 0, seed * 977 + 3 + 2 * gI)) * d;
        const e = Math.min(1, Math.max(0, 0.5 + (rUm - Math.hypot(x - gx, y - gy)) / (0.05 * rUm)));
        if (e > cov) cov = e;
      }
    }
    hit += cov;
  }
  return hit / ns;
}

// Gaussian with the model's pixel variance.
export function grainAnalytic(px, py, c, u, rUm, umPerPx, frame, table) {
  const seed = (frame * 3 + c) >>> 0, u1 = Math.max(1e-7, hash3(px, py, seed * 131 + 200)), u2 = hash3(px, py, seed * 131 + 201);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return u + Math.sqrt(tableAt(table, u) * (rUm * rUm) / (umPerPx * umPerPx)) * z;
}

// Emulsion depth. A layer is many partly transparent clouds through its thickness, not one
// sheet of full-density discs. Treat it as M independent Boolean layers averaged; to second
// order that keeps the mean and the covariance shape and divides the variance by M. M is set
// so the model's RMS granularity matches the data-sheet definition: sigma_D through a 48 um
// circular aperture at net density 1.0.
export function depthLayers(rUm, span, sigmaD48, table) {
  const A = Math.PI * 24 * 24, a = 1 - Math.pow(10, -span), f = (1 - 0.1) / a;
  const sigmaF = Math.sqrt(tableAt(table, f) * rUm * rUm / A), dDdf = a / (Math.LN10 * (1 - f * a));
  return Math.max(1, Math.pow((dDdf * sigmaF) / sigmaD48, 2));
}

// Grain on layer c at pixel (px, py): the developed fraction after grain, in [0, 1].
// cs = 1 / sqrt(M) scales the deviation for emulsion depth (see depthLayers).
export function grainAt(px, py, c, rUm, umPerPx, frame, uAt, W, H, table, cs = 1) {
  const u = uAt(px, py), rPx = rUm / umPerPx, w = smooth(REGIME.mcFrom, REGIME.mcFull, rPx);
  if (rUm <= 0) return u;
  let v;
  if (w >= 1) v = grainMC(px, py, c, rUm, umPerPx, frame, uAt, W, H);
  else if (w <= 0) v = grainAnalytic(px, py, c, u, rUm, umPerPx, frame, table);
  else {
    const a = grainMC(px, py, c, rUm, umPerPx, frame, uAt, W, H) - u, b = grainAnalytic(px, py, c, u, rUm, umPerPx, frame, table) - u;
    v = u + w * a + Math.sqrt(1 - w * w) * b;
  }
  return Math.min(1, Math.max(0, u + (v - u) * cs));
}
