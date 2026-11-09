// chladni.js: a square Kirchhoff plate solved for its real vibration modes, sand that settles on the
// nodal lines, and particles that carry letters.
//
// The physics. A thin plate obeys D ∇⁴w = ρh ω² w. We solve it by the Rayleigh-Ritz method on a product
// basis of orthonormal Legendre polynomials over [-1,1]², with free edges (the classic Chladni plate) or
// clamped edges. Strain energy with Poisson ratio ν:
//   U = ∫∫ w_xx² + w_yy² + 2ν w_xx w_yy + 2(1-ν) w_xy²   and kinetic   T = ∫∫ w².
// Eigenvalues come out as Leissa's nondimensional frequency λ = ω a² √(ρh/D), with a the side length, so
// the numbers can be checked against published tables (free square, ν = 0.3: 13.468, 19.596, 24.270, ...).
// The basis splits into four symmetry classes (even or odd in x, even or odd in y) that never couple,
// so each class is a small dense generalized eigenproblem, solved by Cholesky plus cyclic Jacobi.
//
// The sand. A grain on a vibrating plate is thrown a distance that grows with the local amplitude, so it
// random-walks with a diffusion that is large at antinodes and near zero on nodal lines. Grains pile up
// where they stop being thrown. No pull toward the lines is added; the accumulation comes from the walk.
//
// The type. Each grain carries one character. In "spell" mode a grain walks home to a point sampled from
// a letterform; in "sound" mode the plate scatters it onto the nodal lines. Read up close, the lines are
// made of the words they replaced.
//
// Dependency-free ES module. No DOM. Pure functions plus two small classes.

// ---------- numerics ----------

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export function gaussFrom(r) {
  return () => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
}

// Gauss-Legendre nodes and weights on [-1,1], Newton iteration on P_n.
export function gaussLegendre(n) {
  const x = new Float64Array(n), w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), dp = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = z;
      for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
      dp = n * (z * p1 - p0) / (z * z - 1);
      const dz = p1 / dp; z -= dz;
      if (Math.abs(dz) < 1e-15) break;
    }
    x[i] = z; w[i] = 2 / ((1 - z * z) * dp * dp);
  }
  return { x, w };
}

// Orthonormal Legendre values and first two derivatives at x, for degrees 0..N-1.
// Derivative recurrences P'_{k+1} = P'_{k-1} + (2k+1) P_k hold at the end points too.
export function legendre(N, x) {
  const P = new Float64Array(N + 1), D1 = new Float64Array(N + 1), D2 = new Float64Array(N + 1);
  P[0] = 1; if (N > 0) { P[1] = x; D1[1] = 1; }
  for (let k = 1; k < N; k++) {
    P[k + 1] = ((2 * k + 1) * x * P[k] - k * P[k - 1]) / (k + 1);
    D1[k + 1] = D1[k - 1] + (2 * k + 1) * P[k];
    D2[k + 1] = D2[k - 1] + (2 * k + 1) * D1[k];
  }
  const v = new Float64Array(N), d1 = new Float64Array(N), d2 = new Float64Array(N);
  for (let k = 0; k < N; k++) { const s = Math.sqrt((2 * k + 1) / 2); v[k] = P[k] * s; d1[k] = D1[k] * s; d2[k] = D2[k] * s; }
  return { v, d1, d2 };
}

// 1D basis with edge condition. 'free': plain Legendre. 'clamped': (1-x²)² P_k, so w = w' = 0 at ±1.
export function basis1d(N, x, edge = 'free') {
  const { v, d1, d2 } = legendre(N, x);
  if (edge === 'free') return { v, d1, d2 };
  const g = (1 - x * x) ** 2, g1 = -4 * x * (1 - x * x), g2 = -4 + 12 * x * x;
  const V = new Float64Array(N), A = new Float64Array(N), B = new Float64Array(N);
  for (let k = 0; k < N; k++) { V[k] = v[k] * g; A[k] = d1[k] * g + v[k] * g1; B[k] = d2[k] * g + 2 * d1[k] * g1 + v[k] * g2; }
  return { v: V, d1: A, d2: B };
}

// Cyclic Jacobi for a symmetric matrix (array of Float64Array rows). Returns { values, vectors } with
// vectors[k] the k-th eigenvector, unsorted.
export function jacobiEigen(Ain, { sweeps = 60, tol = 1e-12 } = {}) {
  const n = Ain.length, A = Ain.map((r) => Float64Array.from(r)), V = Array.from({ length: n }, (_, i) => { const r = new Float64Array(n); r[i] = 1; return r; });
  for (let s = 0; s < sweeps; s++) {
    let off = 0, diag = 0;
    for (let p = 0; p < n; p++) { diag += A[p][p] * A[p][p]; for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q]; }
    if (off <= tol * tol * (diag || 1)) break;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      const apq = A[p][q]; if (Math.abs(apq) < 1e-300) continue;
      const th = (A[q][q] - A[p][p]) / (2 * apq), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), sn = t * c;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - sn * akq; A[k][q] = sn * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - sn * aqk; A[q][k] = sn * apk + c * aqk; }
      for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - sn * vkq; V[k][q] = sn * vkp + c * vkq; }
    }
  }
  const values = A.map((r, i) => r[i]);
  const vectors = values.map((_, j) => Float64Array.from(V, (r) => r[j]));
  return { values, vectors };
}

export function cholesky(M) {
  const n = M.length, L = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = M[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (s <= 0) throw new Error(`cholesky: matrix not positive definite at ${i} (pivot ${s})`); L[i][i] = Math.sqrt(s); }
    else L[i][j] = s / L[j][j];
  }
  return L;
}

// ---------- the plate ----------

// solvePlate({ N, nu, edge }) returns { N, edge, nu, modes: [{ lambda, coef: Float64Array(N*N), cls }] } sorted
// by lambda, coefficient index i*N + j for P_i(x) P_j(y). Rigid-body modes (free plate, lambda ≈ 0) are dropped
// unless keepRigid. Coefficients are mass-normalized (∫∫ w² = 1 over [-1,1]²).
export function solvePlate({ N = 14, nu = 0.3, edge = 'free', keepRigid = false } = {}) {
  if (edge !== 'free' && edge !== 'clamped') throw new Error(`solvePlate: edge must be 'free' or 'clamped', got ${edge}`);
  const { x: xq, w: wq } = gaussLegendre(N + 10);
  const B = Array.from(xq, (x) => basis1d(N, x, edge));
  const mat = (fa, fb) => { const A = Array.from({ length: N }, () => new Float64Array(N)); for (let i = 0; i < N; i++) for (let k = 0; k < N; k++) { let s = 0; for (let q = 0; q < xq.length; q++) s += wq[q] * B[q][fa][i] * B[q][fb][k]; A[i][k] = s; } return A; };
  const A00 = mat('v', 'v'), A11 = mat('d1', 'd1'), A22 = mat('d2', 'd2'), A02 = mat('v', 'd2'), A20 = mat('d2', 'v');
  const modes = [];
  for (const [px, py] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    const idx = [];
    for (let i = px; i < N; i += 2) for (let j = py; j < N; j += 2) idx.push([i, j]);
    const n = idx.length, K = Array.from({ length: n }, () => new Float64Array(n)), M = Array.from({ length: n }, () => new Float64Array(n));
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const [i, j] = idx[a], [k, l] = idx[b];
      K[a][b] = A22[i][k] * A00[j][l] + A00[i][k] * A22[j][l] + nu * (A20[i][k] * A02[j][l] + A02[i][k] * A20[j][l]) + 2 * (1 - nu) * A11[i][k] * A11[j][l];
      M[a][b] = A00[i][k] * A00[j][l];
    }
    const L = cholesky(M);
    // C = L^-1 K L^-T
    const Linv = Array.from({ length: n }, () => new Float64Array(n));
    for (let c = 0; c < n; c++) for (let i = 0; i < n; i++) { let s = i === c ? 1 : 0; for (let k = 0; k < i; k++) s -= L[i][k] * Linv[k][c]; Linv[i][c] = s / L[i][i]; }
    const T = Array.from({ length: n }, () => new Float64Array(n)), C = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { let s = 0; for (let k = 0; k <= i; k++) s += Linv[i][k] * K[k][j]; T[i][j] = s; }
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let s = 0; for (let k = 0; k <= j; k++) s += T[i][k] * Linv[j][k]; C[i][j] = s; C[j][i] = s; }
    const { values, vectors } = jacobiEigen(C);
    for (let e = 0; e < n; e++) {
      const y = vectors[e], xv = new Float64Array(n);
      for (let i = n - 1; i >= 0; i--) { let s = 0; for (let k = i; k < n; k++) s += Linv[k][i] * y[k]; xv[i] = s; } // x = L^-T y
      const coef = new Float64Array(N * N); idx.forEach(([i, j], a) => { coef[i * N + j] = xv[a]; });
      const lambda = 4 * Math.sqrt(Math.max(0, values[e]));
      modes.push({ lambda, coef, cls: `${px ? 'odd' : 'even'}-x ${py ? 'odd' : 'even'}-y` });
    }
  }
  modes.sort((a, b) => a.lambda - b.lambda);
  const out = keepRigid ? modes : modes.filter((m) => m.lambda > 1e-3);
  out.forEach((m, k) => { m.index = k + 1; });
  return { N, edge, nu, modes: out };
}

// Basis values on an R-point grid over [-1,1] (cached per plate and R).
function gridBasis(plate, R) {
  plate._grid ??= new Map();
  if (!plate._grid.has(R)) { const G = []; for (let r = 0; r < R; r++) G.push(basis1d(plate.N, -1 + (2 * r) / (R - 1), plate.edge).v); plate._grid.set(R, G); }
  return plate._grid.get(R);
}

// Evaluate one mode (or any coefficient vector) on an R×R grid. Row-major [iy*R + ix], y down the rows.
export function modeGrid(plate, coef, R = 128) {
  const N = plate.N, G = gridBasis(plate, R), T = new Float64Array(N * R), out = new Float32Array(R * R);
  for (let i = 0; i < N; i++) for (let r = 0; r < R; r++) { let s = 0; for (let j = 0; j < N; j++) s += coef[i * N + j] * G[r][j]; T[i * R + r] = s; } // T[i][y]
  for (let iy = 0; iy < R; iy++) for (let ix = 0; ix < R; ix++) { let s = 0; for (let i = 0; i < N; i++) s += G[ix][i] * T[i * R + iy]; out[iy * R + ix] = s; }
  return out;
}

// Value of a mode at one point (x, y in [-1,1]).
export function modeAt(plate, coef, x, y) {
  const N = plate.N, bx = basis1d(N, x, plate.edge).v, by = basis1d(N, y, plate.edge).v; let s = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) s += coef[i * N + j] * bx[i] * by[j];
  return s;
}

// Steady response to a harmonic point force at `drive` with nondimensional frequency Lambda.
// a_k = φ_k(drive) / (λ_k² − Λ² + i·2ζ·λ_k·Λ); returns the amplitude |Σ a_k φ_k| on the grid, normalized to max 1,
// plus the modal weights so a reader can see which modes the drive excited.
export function drivenAmplitude(plate, Lambda, { R = 128, drive = [0.83, 0.37], zeta = 0.003, modes = 40 } = {}) {
  const use = plate.modes.slice(0, modes), re = new Float64Array(R * R), im = new Float64Array(R * R), weights = [];
  for (const m of use) {
    const f = modeAt(plate, m.coef, drive[0], drive[1]), dr = m.lambda * m.lambda - Lambda * Lambda, di = 2 * zeta * m.lambda * Lambda, den = dr * dr + di * di;
    const ar = (f * dr) / den, ai = (-f * di) / den; weights.push(Math.hypot(ar, ai));
    if (Math.hypot(ar, ai) < 1e-9) continue;
    m._g ??= new Map(); if (!m._g.has(R)) m._g.set(R, modeGrid(plate, m.coef, R)); const g = m._g.get(R);
    for (let p = 0; p < R * R; p++) { re[p] += ar * g[p]; im[p] += ai * g[p]; }
  }
  const amp = new Float32Array(R * R); let mx = 0;
  for (let p = 0; p < R * R; p++) { amp[p] = Math.hypot(re[p], im[p]); if (amp[p] > mx) mx = amp[p]; }
  if (mx > 0) for (let p = 0; p < R * R; p++) amp[p] /= mx;
  const tot = weights.reduce((a, b) => a + b, 0) || 1;
  return { amp, R, weights: weights.map((w) => w / tot) };
}

// Normalized |mode| as an amplitude grid (resonant drive of a single mode).
export function modeAmplitude(plate, k, R = 128) {
  const g = modeGrid(plate, plate.modes[k].coef, R), amp = new Float32Array(R * R); let mx = 0;
  for (let p = 0; p < g.length; p++) { amp[p] = Math.abs(g[p]); if (amp[p] > mx) mx = amp[p]; }
  for (let p = 0; p < g.length; p++) amp[p] /= mx || 1;
  return { amp, R };
}

// The fixed-edge membrane, for comparison with the reference clip: sin(nπu)sin(mπv) mixed with its transpose,
// u, v in [0,1]. Frequency ∝ √(n² + m²). This is a drum, not a plate.
export function membraneAmplitude(n, m, mixDeg = 45, R = 128) {
  const a = (mixDeg * Math.PI) / 180, amp = new Float32Array(R * R); let mx = 0;
  for (let iy = 0; iy < R; iy++) for (let ix = 0; ix < R; ix++) {
    const u = ix / (R - 1), v = iy / (R - 1);
    const f = Math.cos(a) * Math.sin(n * Math.PI * u) * Math.sin(m * Math.PI * v) + Math.sin(a) * Math.sin(m * Math.PI * u) * Math.sin(n * Math.PI * v);
    amp[iy * R + ix] = Math.abs(f); if (amp[iy * R + ix] > mx) mx = amp[iy * R + ix];
  }
  for (let p = 0; p < amp.length; p++) amp[p] /= mx || 1;
  return { amp, R, ratio: Math.hypot(n, m) / Math.SQRT2 };
}

export function sampleAmp({ amp, R }, x, y) {
  const fx = Math.min(R - 1.0001, Math.max(0, ((x + 1) / 2) * (R - 1))), fy = Math.min(R - 1.0001, Math.max(0, ((y + 1) / 2) * (R - 1)));
  const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, o = iy * R + ix;
  return (amp[o] * (1 - tx) + amp[o + 1] * tx) * (1 - ty) + (amp[o + R] * (1 - tx) + amp[o + R + 1] * tx) * ty;
}

// ---------- data to mode and back ----------

// A value in [lo, hi] picks a mode index (1-based) in [kMin, kMax]; valueForMode inverts it to the bin centre.
export function modeForValue(v, { lo, hi, kMin = 1, kMax = 24 }) {
  const t = (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1);
  return kMin + Math.round(t * (kMax - kMin));
}
export function valueForMode(k, { lo, hi, kMin = 1, kMax = 24 }) { return lo + ((k - kMin) / (kMax - kMin || 1)) * (hi - lo); }
// Pitch ratio of mode k to mode 1 on the same plate: plate frequency is proportional to lambda.
export const pitchRatio = (plate, k) => plate.modes[k - 1].lambda / plate.modes[0].lambda;

// ---------- grains that carry letters ----------

// Sand: n grains on [-1,1]². Each grain has a glyph (one character of `text`, in reading order), an optional
// home point for spelling, and a size and tone so the renderer can draw real sand (variation, not clones).
// step(field) runs the vibrating-plate walk; spell() walks grains home.
//
// Settle physics (revised 2026-10-23 by the quality pass; before and after numbers in
// 2026-10-23-quality/fixes/feed22/). A grain only leaves the plate where the plate's acceleration beats
// gravity, so below a rest amplitude it does not move at all: it stays put until the field changes. Above
// it, the throw grows with a² - rest², and a small drift rolls grains down the gradient of a², which is
// the time-averaged bias a bouncing grain feels on a sloped amplitude field. Resting grains are skipped, so
// the cost falls toward zero as the figure forms. Gaussian throws come from a seeded table (no log or cos
// per grain per tick).
const GTAB = (() => { const r = rng(91), t = new Float32Array(8192); for (let i = 0; i < t.length; i += 2) { let u = 0; while (u === 0) u = r(); const m = Math.sqrt(-2 * Math.log(u)), th = 2 * Math.PI * r(); t[i] = m * Math.cos(th); t[i + 1] = m * Math.sin(th); } return t; })();

// Gradient of a² on the field grid, cached on the field object.
function gradA2(field) {
  if (field._ga2) return field._ga2;
  const { amp, R } = field, gx = new Float32Array(R * R), gy = new Float32Array(R * R), h = 2 / (R - 1);
  for (let iy = 0; iy < R; iy++) for (let ix = 0; ix < R; ix++) {
    const p = iy * R + ix, a2 = (q) => amp[q] * amp[q];
    const xl = ix > 0 ? p - 1 : p, xr = ix < R - 1 ? p + 1 : p, yu = iy > 0 ? p - R : p, yd = iy < R - 1 ? p + R : p;
    gx[p] = (a2(xr) - a2(xl)) / (h * (xr - xl === 2 ? 2 : 1)); gy[p] = (a2(yd) - a2(yu)) / (h * ((yd - yu) === 2 * R ? 2 : 1));
  }
  field._ga2 = { gx, gy };
  return field._ga2;
}

export class Sand {
  constructor(n = 3000, { seed = 7, text = 'sound made visible ', homes = null } = {}) {
    this.n = n; this.r = rng(seed); this.g = gaussFrom(this.r); this.gi = (seed * 2654435761) >>> 0;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.hx = new Float32Array(n); this.hy = new Float32Array(n);
    this.size = new Float32Array(n); this.tone = new Float32Array(n); this.still = new Uint8Array(n); this.field = null;
    this.glyph = new Array(n);
    const chars = [...text].filter((c) => c.trim() !== '' || c === ' ');
    for (let i = 0; i < n; i++) {
      this.x[i] = this.r() * 2 - 1; this.y[i] = this.r() * 2 - 1; this.glyph[i] = chars[i % chars.length] ?? '·';
      // sand is not uniform: log-normal size (sigma 0.22) and a tone spread across the warm range
      this.size[i] = Math.exp(0.22 * this.g()); this.tone[i] = this.r();
    }
    if (homes) this.setHomes(homes);
  }
  // homes: array of [x, y] in [-1,1]², ordered in reading order; grains take them in turn (wrapping).
  setHomes(homes) {
    if (!homes.length) throw new Error('Sand.setHomes: no home points (did the letterform rasterize?)');
    for (let i = 0; i < this.n; i++) { const h = homes[i % homes.length]; this.hx[i] = h[0]; this.hy[i] = h[1]; }
    this.still.fill(0);
  }
  // One plate tick. hop: throw distance at amplitude 1 (plate half-widths). rest: amplitude under which the
  // plate cannot lift a grain. drift: roll down the a² gradient per tick. floor: optional residual hop (0 keeps
  // resting grains at rest; kept for callers of the first version).
  // Below rest a grain is not thrown but still rolls down the slope (roll) until it sits in the trough of the
  // line (amplitude under settle), where it stops.
  step(field, { hop = 0.16, rest = 0.045, settle = 0.012, drift = 0.0006, roll = 0.004, floor = 0 } = {}) {
    if (this.field !== field) { this.field = field; this.still.fill(0); }
    const { gx, gy } = gradA2(field), R = field.R, r2 = rest * rest, T = GTAB, M = T.length - 1;
    let gi = this.gi, moving = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.still[i] && floor === 0) continue;
      const a = sampleAmp(field, this.x[i], this.y[i]);
      if (a < settle && floor === 0) { this.still[i] = 1; continue; }
      moving++;
      const lifted = a >= rest, s = lifted ? hop * (a * a - r2) + floor : floor, k = lifted ? drift : roll;
      gi = (gi * 1664525 + 1013904223) >>> 0;
      const q = gi & M & ~1;
      const cx = Math.min(R - 1, Math.max(0, Math.round(((this.x[i] + 1) / 2) * (R - 1)))), cy = Math.min(R - 1, Math.max(0, Math.round(((this.y[i] + 1) / 2) * (R - 1))));
      const p = cy * R + cx;
      if (!lifted && k * Math.abs(gx[p]) + k * Math.abs(gy[p]) < 2e-5) { this.still[i] = 1; continue; } // flat trough: stop
      let x = this.x[i] + s * T[q] - k * gx[p], y = this.y[i] + s * T[q + 1] - k * gy[p];
      if (x < -1) x = -2 - x; if (x > 1) x = 2 - x; if (y < -1) y = -2 - y; if (y > 1) y = 2 - y; // reflect at the rim
      this.x[i] = Math.max(-1, Math.min(1, x)); this.y[i] = Math.max(-1, Math.min(1, y));
    }
    this.gi = gi;
    return moving;
  }
  // One spelling tick: each grain moves a fraction k of the way home, plus a jitter that fades as it lands.
  spell({ k = 0.08, jitter = 0.004 } = {}) {
    this.field = null;
    let far = 0;
    for (let i = 0; i < this.n; i++) {
      const dx = this.hx[i] - this.x[i], dy = this.hy[i] - this.y[i], d = Math.hypot(dx, dy);
      if (d < 1e-4) continue;
      far++;
      this.x[i] += dx * k + jitter * Math.min(1, d * 8) * this.g(); this.y[i] += dy * k + jitter * Math.min(1, d * 8) * this.g();
    }
    return far;
  }
  meanHomeDistance() { let s = 0; for (let i = 0; i < this.n; i++) s += Math.hypot(this.hx[i] - this.x[i], this.hy[i] - this.y[i]); return s / this.n; }
}

// Fraction of grains standing where the field is below `thr`, against the area fraction of such ground.
// A ratio well above 1 means the sand found the nodal lines.
export function nodalConcentration(sand, field, thr = 0.08) {
  let on = 0; for (let i = 0; i < sand.n; i++) if (sampleAmp(field, sand.x[i], sand.y[i]) < thr) on++;
  let area = 0; for (let p = 0; p < field.amp.length; p++) if (field.amp[p] < thr) area++;
  const fa = area / field.amp.length, fs = on / sand.n;
  return { grainFraction: fs, areaFraction: fa, ratio: fs / (fa || 1e-9) };
}
