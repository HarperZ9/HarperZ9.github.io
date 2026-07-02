// Features -- the measurable shape of an artifact, the input the criteria judge.
// Two readers (ported from studio-engine _features): a point cloud, and a field expr sampled on a
// grid. featuresOf() dispatches on the artifact an organ produced, so every organ is judged the same.
import { sampleField } from "./expr.js";

const G = 20;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function entropy(counts) {
  let tot = 0; for (const c of counts) tot += c;
  if (tot <= 0) return 0;
  let h = 0, k = 0;
  for (const c of counts) { if (c > 0) { const p = c / tot; h -= p * Math.log(p); k++; } }
  if (k <= 1) return 0;
  return clamp(h / Math.log(counts.length), 0, 1);
}

export function pointFeatures(pts) {
  if (!pts.length) return { coverage: 0, centroid_offset: 1, contrast: 0, entropy: 0 };
  let maxr = 1e-9; for (const p of pts) { const r = Math.hypot(p[0], p[1]); if (r > maxr) maxr = r; }
  const cells = new Float64Array(G * G); let sx = 0, sy = 0;
  for (const p of pts) {
    const nx = p[0] / maxr, ny = p[1] / maxr; sx += nx; sy += ny;
    const gx = clamp(Math.floor((nx + 1) / 2 * G), 0, G - 1), gy = clamp(Math.floor((ny + 1) / 2 * G), 0, G - 1);
    cells[gy * G + gx]++;
  }
  const n = pts.length, mean = n / (G * G);
  let touched = 0, varAcc = 0;
  for (const cc of cells) { if (cc > 0) touched++; const d = cc - mean; varAcc += d * d; }
  return {
    coverage: touched / (G * G),
    centroid_offset: clamp(Math.hypot(sx / n, sy / n), 0, 1),
    contrast: clamp((Math.sqrt(varAcc / cells.length) / (mean + 1e-9)) / 3, 0, 1),
    entropy: entropy([...cells]),
  };
}

export function fieldFeatures(expr, t = 0) {
  const vals = sampleField(expr, G, t);
  let vmin = Infinity, vmax = -Infinity; for (const v of vals) { if (v < vmin) vmin = v; if (v > vmax) vmax = v; }
  const rng = (vmax - vmin) || 1e-9, norm = vals.map((v) => (v - vmin) / rng);
  let cov = 0; for (const v of norm) if (v > 0.5) cov++;
  let left = 0, right = 0, top = 0, bot = 0, tot = 0;
  for (let j = 0; j < G; j++) for (let k = 0; k < G; k++) {
    const val = norm[j * G + k]; tot += val;
    if (k < G / 2) left += val; else right += val;
    if (j < G / 2) top += val; else bot += val;
  }
  tot = tot || 1e-9;
  const hist = new Array(10).fill(0); for (const v of norm) hist[clamp(Math.floor(v * 10), 0, 9)]++;
  return {
    coverage: cov / norm.length,
    centroid_offset: clamp((Math.abs(left - right) + Math.abs(top - bot)) / tot, 0, 1),
    contrast: clamp((vmax - vmin) / 4, 0, 1),
    entropy: entropy(hist),
  };
}

export function featuresOf(artifact) {
  return artifact.kind === "field"
    ? fieldFeatures(artifact.expr, artifact.t0 ?? 0)
    : pointFeatures(artifact.points || []);
}
