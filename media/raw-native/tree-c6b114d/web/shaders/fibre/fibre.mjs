// Watercolour on a random fibre network.
//
// Watercolour paper is a mat of cellulose fibres. Water and pigment travel along the fibres faster
// than across them (capillary flow), and pigment particles flocculate and settle where fibres
// cross. Here the paper is a random line process (fibres with random centres, lengths along a
// machine direction with a spread, after the Kallmes-Corte model of paper; fixed count per cell,
// a stratified form of the Poisson process), rasterised per pixel into coverage, a local fibre
// orientation tensor and a crossing density. The wash then evolves for a set number of steps:
//   K = k0 I + k1 min(1, coverage) T_hat           capillary conductivity tensor per pixel
//   pigment flux between neighbours: G (p_j - p_i) times the water both sides hold (min)
//   G from K by a monotone stencil: axis links Kxx - |Kxy|, Kyy - |Kxy|; one diagonal pair |Kxy| / 2
//     (exact second moments for any tensor with Kxx, Kyy >= |Kxy|, which k1 <= 4.8 k0 keeps)
//   deposition: dd = rate (1 + floc chi) p dt;  water evaporates linearly
// Wetness: the wash starts wet in flat areas and dry across the image's strong edges,
//   water0 = clamp(1 - edgeDry |grad luminance|, 0.05, 1)  (central differences)
// so colour bleeds within regions and edges stay crisp (added after the first look review, where a
// fully wet sheet blurred the whole picture).
// Pigment (suspended plus deposited) is conserved exactly. The wash's pigment is the image's
// colour as absorbance against the paper, so a wash with no transport dries to the image itself;
// the look comes from colour bleeding along fibres at boundaries and granulation at crossings.
// Prior work: Curtis et al. 1997, Small 1991, Chu and Tai 2005, Sun et al. 2018 (fibre-modelled
// pigment diffusion); none found with this paper model, tensor and crossing flocculation together.
import { hash3 } from "../common.mjs";

export const FIBRE_PRESETS = {
  "cold-press": { edgeDry: 6, perCell: 6, len: 0.05, width: 1.2, md: 0.0, spread: 1.0, k0: 0.25, k1: 0.9, rate: 0.08, floc: 1.0, evap: 0.02, steps: 40, strength: 1, paper: [0.96, 0.94, 0.89] },
  "hot-press": { edgeDry: 8, perCell: 3, len: 0.06, width: 1.0, md: 0.0, spread: 1.0, k0: 0.3, k1: 0.5, rate: 0.12, floc: 0.3, evap: 0.02, steps: 32, strength: 1, paper: [0.97, 0.96, 0.93] },
  rough: { edgeDry: 4, perCell: 9, len: 0.08, width: 1.4, md: 0.15, spread: 0.6, k0: 0.2, k1: 0.95, rate: 0.06, floc: 1.5, evap: 0.015, steps: 56, strength: 1, paper: [0.95, 0.92, 0.86] },
};
export function resolveFibre(preset, overrides = {}, size) {
  const p = { ...FIBRE_PRESETS[preset], ...overrides }, L = Math.max(2, p.len * size.h), C = Math.max(2, Math.ceil(L));
  const gmax = 2 * (2 * p.k0 + p.k1), dt = 0.45 / gmax;
  return { p, w: size.w, h: size.h, L, C, dt };
}

// Fibres of one cell: centre, unit direction, half-length.
export function cellFibres(plan, cx, cy) {
  const p = plan.p, out = [];
  for (let k = 0; k < p.perCell; k++) {
    const a = (cx + 8192) >>> 0, b = (cy + 8192) >>> 0, s = (k * 97 + 13) >>> 0;
    const fx = (cx + hash3(a, b, s)) * plan.C, fy = (cy + hash3(a, b, s + 1)) * plan.C, th = Math.PI * (p.md + p.spread * (hash3(a, b, s + 2) - 0.5));
    const lf = plan.L * (0.6 + 0.8 * hash3(a, b, s + 3));
    out.push([fx, fy, Math.cos(th), Math.sin(th), lf / 2]);
  }
  return out;
}
// Per pixel: coverage, Txx, Txy, Tyy (coverage-weighted), crossing density chi.
export function paperField(plan) {
  const { w, h, C, p } = plan, F = new Float64Array(w * h * 5);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const qx = x + 0.5, qy = y + 0.5, cx = Math.floor(qx / C), cy = Math.floor(qy / C);
    let cov = 0, cov2 = 0, txx = 0, txy = 0, tyy = 0;
    for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) for (const [fx, fy, dx, dy, hl] of cellFibres(plan, i, j)) {
      const rx = qx - fx, ry = qy - fy, t = Math.max(-hl, Math.min(hl, rx * dx + ry * dy)), ex = rx - t * dx, ey = ry - t * dy;
      const c = Math.max(0, Math.min(1, 0.5 * p.width + 0.5 - Math.sqrt(ex * ex + ey * ey)));
      if (c > 0) { cov += c; cov2 += c * c; txx += c * dx * dx; txy += c * dx * dy; tyy += c * dy * dy; }
    }
    F.set([cov, txx, txy, tyy, 0.5 * (cov * cov - cov2)], (y * w + x) * 5);
  }
  return F;
}
// Conductivity tensor per pixel from the field smoothed over a 7 x 7 box: [Kxx, Kxy, Kyy].
export function tensors(plan, F) {
  const { w, h, p } = plan, K = new Float64Array(w * h * 3), R = 3;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = 0, a = 0, b = 0, d = 0, n = 0;
    for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R); yy++) for (let xx = Math.max(0, x - R); xx <= Math.min(w - 1, x + R); xx++) { const o = (yy * w + xx) * 5; c += F[o]; a += F[o + 1]; b += F[o + 2]; d += F[o + 3]; n++; }
    const cm = c / n, s = c > 1e-12 ? 1 / c : 0, g = p.k1 * Math.min(1, cm);
    K.set([p.k0 + g * a * s, g * b * s, p.k0 + g * d * s], (y * w + x) * 3);
  }
  return K;
}
// The eight links and their conductances at a pixel: [dx, dy, G].
export function links(Kxx, Kxy, Kyy) {
  const ax = Math.max(0, Kxx - Math.abs(Kxy)), ay = Math.max(0, Kyy - Math.abs(Kxy)), dg = Math.abs(Kxy) / 2, pos = Kxy >= 0;
  return [[1, 0, ax], [-1, 0, ax], [0, 1, ay], [0, -1, ay], [1, 1, pos ? dg : 0], [-1, -1, pos ? dg : 0], [1, -1, pos ? 0 : dg], [-1, 1, pos ? 0 : dg]];
}

// The wash: colour -> absorbance; then the steps. src: display-linear RGBA.
export function runFibre(plan, src, { field = null, K: Kin = null, keep = false } = {}) {
  const { w, h, p, dt } = plan, n = w * h, F = field || paperField(plan), K = Kin || tensors(plan, F);
  let P = new Float64Array(n * 3), Pn = new Float64Array(n * 3), D = new Float64Array(n * 3), Wt = new Float64Array(n), Wn = new Float64Array(n);
  const lum = (x, y) => { const o = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4; return 0.2126 * src.data[o] + 0.7152 * src.data[o + 1] + 0.0722 * src.data[o + 2]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const gx = 0.5 * (lum(x + 1, y) - lum(x - 1, y)), gy = 0.5 * (lum(x, y + 1) - lum(x, y - 1)); Wt[y * w + x] = Math.min(1, Math.max(0.05, 1 - (p.edgeDry || 0) * Math.sqrt(gx * gx + gy * gy))); }
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) P[i * 3 + c] = p.strength * -Math.log(Math.max(0.02, Math.min(1, src.data[i * 4 + c] / p.paper[c])));
  const G = (i, l) => { const L = links(K[i * 3], K[i * 3 + 1], K[i * 3 + 2]); return L[l]; };
  for (let it = 0; it < p.steps; it++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, Li = links(K[i * 3], K[i * 3 + 1], K[i * 3 + 2]), dep = p.rate * (1 + p.floc * F[i * 5 + 4]) * dt;
      const flux = [0, 0, 0];
      for (let l = 0; l < 8; l++) {
        const [dx, dy, gi] = Li[l], xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx, gj = G(j, l ^ 1)[2], g = 0.5 * (gi + gj) * Math.min(Wt[i], Wt[j]) * dt;
        for (let c = 0; c < 3; c++) flux[c] += g * (P[j * 3 + c] - P[i * 3 + c]);
      }
      for (let c = 0; c < 3; c++) { const pc = P[i * 3 + c] + flux[c], dd = Math.min(pc, dep * pc); Pn[i * 3 + c] = pc - dd; D[i * 3 + c] += dd; }
      Wn[i] = Math.max(0, Wt[i] - p.evap);
    }
    [P, Pn] = [Pn, P]; [Wt, Wn] = [Wn, Wt];
  }
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { for (let c = 0; c < 3; c++) out[i * 4 + c] = p.paper[c] * Math.exp(-(P[i * 3 + c] + D[i * 3 + c])); out[i * 4 + 3] = 1; }
  return keep ? { out: { width: w, height: h, data: out }, P, D, F, K } : { out: { width: w, height: h, data: out } };
}
