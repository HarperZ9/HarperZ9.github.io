// Development adjacency: the Eberhard effect, Mackie lines and the small-area effect from the
// chemistry of development, as one coupled diffusion system rather than an unsharp mask.
//
// While a negative develops, developer diffuses through the emulsion and is used up where the
// exposure is high; development releases bromide, which diffuses too and holds development back.
// So a dense area next to a thin one draws fresh developer across the border and develops more
// at its edge (overshoot), while the thin side receives bromide and spent developer and develops
// less (undershoot); a small dense spot, fed from all sides, ends denser than a large one.
// Model (physics as in Rajkowski and Nowak, Optica Applicata 31(2), 2001; Nelson's chemical spread
// functions; written here independently as an explicit grid integration):
//   dD_k/dt = k c / (1 + beta b) (a_k - D_k)                       development of layer k
//   dc/dt   = Dc lap(c) - eta sum_k dD_k/dt + r (1 - c)            developer, replenished by the bath
//   db/dt   = Db lap(b) + etaB sum_k dD_k/dt - rB b                bromide, lost to the bath
// a_k is the developable fraction from the exposure (a logistic in log exposure). The three layers
// share one developer and one bromide field, so adjacency also couples colour layers in space.
// c and b live on a grid s times coarser than the picture (the chemistry is smooth); D lives at
// full resolution and reads c and b bilinearly. Boundaries are reflecting, so with r = rB = 0
// the totals c + eta D and b - etaB D are conserved exactly in exact arithmetic.
// Output: scene-linear colour times (D + eps) / (Dfree + eps), where Dfree is the development the
// same steps give with fresh developer and no bromide, so a flat field passes unchanged in shape.
// Lengths are film-plane micrometres. The literature check found no measured diffusion length;
// the Eberhard effect is reported within about 1 mm (secondary source, moderate), so the presets sit
// at 0.3 to 0.8 mm. Rates are in units of the development time T. Low confidence: chosen for the look.
export const ADJ_PRESETS = {
  eberhard: { devUm: 450, bromUm: 300, k: 3, eta: 0.6, r: 1.5, beta: 2, etaB: 0.5, rB: 1, gamma: 1.6, H0: 0.18, exposure: 1 },
  mackie: { devUm: 450, bromUm: 700, k: 3, eta: 0.6, r: 1.5, beta: 6, etaB: 0.8, rB: 0.6, gamma: 1.6, H0: 0.18, exposure: 1 },
  exhausted: { devUm: 800, bromUm: 350, k: 3, eta: 0.7, r: 0.3, beta: 2, etaB: 0.4, rB: 1, gamma: 1.4, H0: 0.18, exposure: 1 },
};
export const EPS = 1e-6;

// Resolve a preset for a picture of w x h. pitchUm: film-plane micrometres per pixel (Super 35,
// 24.9 mm across the width, unless given). scale: the chemistry grid's coarsening factor.
export function resolveAdjacency(preset, overrides = {}, size) {
  const p = { ...ADJ_PRESETS[preset], pitchUm: 24900 / size.w, scale: "auto", T: 1, ...overrides };
  // "auto": coarsen the chemistry grid so the longer diffusion length spans about 2.5 cells, which
  // keeps the step count near 30 at any resolution (the chemistry is smooth on that scale).
  const s = p.scale === "auto" ? Math.max(1, Math.floor(Math.max(p.devUm, p.bromUm) / (p.pitchUm * 2.5))) : p.scale, cw = Math.ceil(size.w / s), ch = Math.ceil(size.h / s);
  const px = p.pitchUm * s, Dc = (p.devUm / px) ** 2 / p.T, Db = (p.bromUm / px) ** 2 / p.T;   // coarse cells^2 per unit time
  const steps = p.steps || Math.max(16, Math.ceil((p.T * Math.max(Dc, Db, p.k)) / 0.2));
  const dt = p.T / steps;
  return { p: { ...p, scale: s }, w: size.w, h: size.h, s, cw, ch, Dc, Db, steps, dt, decay: Math.pow(1 - p.k * dt, steps) };
}

export const developable = (plan, H) => { if (H <= 0) return 0; const q = Math.pow(plan.p.H0 / H, plan.p.gamma); return 1 / (1 + q); };

// Bilinear read of a coarse field at the centre of fine pixel (x, y).
export function coarseAt(plan, F, comp, x, y) {
  const { s, cw, ch } = plan, u = (x + 0.5) / s - 0.5, v = (y + 0.5) / s - 0.5;
  const x0 = Math.max(0, Math.min(cw - 1, Math.floor(u))), y0 = Math.max(0, Math.min(ch - 1, Math.floor(v)));
  const x1 = Math.min(cw - 1, x0 + 1), y1 = Math.min(ch - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, u - x0)), fy = Math.max(0, Math.min(1, v - y0));
  const g = (i, j) => F[(j * cw + i) * 2 + comp];
  return (g(x0, y0) * (1 - fx) + g(x1, y0) * fx) * (1 - fy) + (g(x0, y1) * (1 - fx) + g(x1, y1) * fx) * fy;
}

// Run the development. scene: { width, height, data: RGBA scene-linear }. Returns D, the chemistry
// fields, the developable fractions and the output frame (scene-linear).
export function develop(plan, scene, { keepHistory = false } = {}) {
  const { w, h, s, cw, ch, Dc, Db, dt, steps, p } = plan, n = w * h;
  const A = new Float64Array(n * 3), D = new Float64Array(n * 3), dsum = new Float64Array(n);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) A[i * 3 + k] = developable(plan, p.exposure * scene.data[i * 4 + k]);
  let F = new Float64Array(cw * ch * 2), G = new Float64Array(cw * ch * 2);
  for (let i = 0; i < cw * ch; i++) F[i * 2] = 1;
  for (let it = 0; it < steps; it++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {                    // pass A: develop
      const i = y * w + x, c = coarseAt(plan, F, 0, x, y), b = coarseAt(plan, F, 1, x, y), rate = (p.k * c) / (1 + p.beta * b);
      let sum = 0;
      for (let k = 0; k < 3; k++) { const d = rate * (A[i * 3 + k] - D[i * 3 + k]) * dt; D[i * 3 + k] += d; sum += d; }
      dsum[i] = sum;
    }
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {                  // pass B: chemistry
      let used = 0, cnt = 0;
      for (let yy = j * s; yy < Math.min(h, j * s + s); yy++) for (let xx = i * s; xx < Math.min(w, i * s + s); xx++) { used += dsum[yy * w + xx]; cnt++; }
      used /= cnt;
      const at = (ii, jj, c) => F[((Math.max(0, Math.min(ch - 1, jj)) * cw) + Math.max(0, Math.min(cw - 1, ii))) * 2 + c];
      const o = (j * cw + i) * 2, c0 = F[o], b0 = F[o + 1];
      const lc = at(i - 1, j, 0) + at(i + 1, j, 0) + at(i, j - 1, 0) + at(i, j + 1, 0) - 4 * c0;
      const lb = at(i - 1, j, 1) + at(i + 1, j, 1) + at(i, j - 1, 1) + at(i, j + 1, 1) - 4 * b0;
      G[o] = c0 + Dc * lc * dt - p.eta * used + p.r * (1 - c0) * dt;
      G[o + 1] = b0 + Db * lb * dt + p.etaB * used - p.rB * b0 * dt;
    }
    [F, G] = [G, F];
  }
  const out = new Float32Array(n * 4), free = 1 - plan.decay;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) out[i * 4 + k] = scene.data[i * 4 + k] * ((D[i * 3 + k] + EPS) / (A[i * 3 + k] * free + EPS));
    out[i * 4 + 3] = 1;
  }
  return { D, A, F, out: { width: w, height: h, data: out } };
}
