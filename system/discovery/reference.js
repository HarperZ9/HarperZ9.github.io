// reference.js: a deterministic least-variance solver, exposed to the model as the `fit` tool.
//
// Given candidate TERMS (the model's physical insight: WHICH features matter), it returns the
// linear combination of those terms that is most nearly conserved along the trajectory: the
// smallest-variance direction of the centered feature covariance, via a Jacobi eigensolver.
// The MODEL chooses the basis (the hard, creative part of discovery); this does the linear
// algebra (the arithmetic). The sound verifier still has the final say. Zero dependencies.
import { makeFn } from "./expr.js";

// Jacobi eigenvalue algorithm for a small symmetric matrix. Returns { values, vectors } with
// vectors[k] the eigenvector (as an array) for eigenvalue values[k].
export function jacobiEigen(A0, { sweeps = 100, eps = 1e-14 } = {}) {
  const n = A0.length;
  const A = A0.map((r) => r.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let s = 0; s < sweeps; s++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < eps) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < eps) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), sn = t * c;
        for (let i = 0; i < n; i++) { const aip = A[i][p], aiq = A[i][q]; A[i][p] = c * aip - sn * aiq; A[i][q] = sn * aip + c * aiq; }
        for (let i = 0; i < n; i++) { const api = A[p][i], aqi = A[q][i]; A[p][i] = c * api - sn * aqi; A[q][i] = sn * api + c * aqi; }
        for (let i = 0; i < n; i++) { const vip = V[i][p], viq = V[i][q]; V[i][p] = c * vip - sn * viq; V[i][q] = sn * vip + c * viq; }
      }
    }
  }
  const values = A.map((r, i) => r[i]);
  const vectors = values.map((_, k) => V.map((row) => row[k]));
  return { values, vectors };
}

const round = (x) => Math.round(x * 1e4) / 1e4;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const std0 = (a, m) => Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length);
const EPS = 1e-9;

// Find the most-conserved linear combination of `terms` (expr strings) over `states`.
//
// A term constant ALONG the trajectory is the signal we want when it is a conserved observable
// (e.g. <p^2> for a free particle), but noise when it is a LITERAL constant (e.g. "1", "x-x").
// We tell them apart with a second trajectory from a different initial condition: a literal
// constant is the SAME value on both; a conserved observable is constant on each but DIFFERS
// between them. Only literal constants are dropped; the verifier's cross-IC check is the final guard.
export function leastVarianceCombo(terms, vars, states, states2 = null) {
  const fns = terms.map((t) => makeFn(t, vars)); // throws on an invalid term (caught by the caller)
  const cols = [], keptTerms = [];
  for (let k = 0; k < terms.length; k++) {
    const col = states.map((s) => fns[k](s));
    const m = mean(col);
    let literal = false;
    if (std0(col, m) < EPS) {
      if (states2) {
        const col2 = states2.map((s) => fns[k](s)), m2 = mean(col2);
        literal = std0(col2, m2) < EPS && Math.abs(m - m2) < EPS; // same constant on a different IC
      } else {
        literal = true; // no second trajectory to disambiguate: treat a constant as literal
      }
    }
    if (!literal) { cols.push(col.map((v) => v - m)); keptTerms.push(terms[k]); }
  }
  if (cols.length === 0) return { ok: false, reason: "all terms are literal constants" };
  const K = cols.length, N = cols[0].length;
  const C = Array.from({ length: K }, () => new Array(K).fill(0));
  for (let a = 0; a < K; a++) for (let b = a; b < K; b++) {
    let s = 0; for (let i = 0; i < N; i++) s += cols[a][i] * cols[b][i];
    C[a][b] = C[b][a] = s / N;
  }
  const { values, vectors } = jacobiEigen(C);
  let mi = 0; for (let k = 1; k < K; k++) if (values[k] < values[mi]) mi = k;
  let vec = vectors[mi];
  let maxAbs = 0; for (const c of vec) if (Math.abs(c) > maxAbs) maxAbs = Math.abs(c);
  if (maxAbs > 0) vec = vec.map((c) => c / maxAbs); // largest coefficient = 1 (readable)
  const expr = keptTerms.map((t, k) => `${round(vec[k])}*(${t})`).join(" + ");
  return { ok: true, expr, terms: keptTerms, coeffs: vec.map(round) };
}

// ---------------------------------------------------------------------------
// Conserved-subspace discovery: how MANY independent conservation laws a system has.
//
// A quantity Q = sum c_k phi_k is a law iff it is flat ALONG each trajectory (small "within"
// variance) yet DIFFERS between initial conditions (non-zero "between" variance). So solve the
// generalized eigenproblem W c = lambda B c, where W is the average within-trajectory covariance
// of the features and B is the covariance of the per-trajectory means. The eigenvectors with the
// smallest lambda (within/between ratio below a tolerance) span the conserved subspace; their
// count is the number of independent laws. Solved by whitening with B^{-1/2} (B PSD, regularized).
// ---------------------------------------------------------------------------

function matMul(A, B) {
  const n = A.length, m = B[0].length, k = B.length;
  const C = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { let s = 0; for (let t = 0; t < k; t++) s += A[i][t] * B[t][j]; C[i][j] = s; }
  return C;
}

function invSqrt(B, reg = 1e-9) {
  const n = B.length;
  const Br = B.map((row, i) => row.map((v, j) => v + (i === j ? reg : 0)));
  const { values, vectors } = jacobiEigen(Br);
  const U = Array.from({ length: n }, (_, i) => vectors.map((vec) => vec[i])); // U[i][k] = eigenvector k, component i
  const dinv = values.map((v) => 1 / Math.sqrt(Math.max(v, reg)));
  const R = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { let s = 0; for (let k = 0; k < n; k++) s += U[i][k] * dinv[k] * U[j][k]; R[i][j] = s; }
  return R;
}

export function conservedSubspace(terms, vars, trajs, { ratioTol = 1e-3 } = {}) {
  const fns = terms.map((t) => makeFn(t, vars));
  const K = terms.length;
  const means = [], withinCovs = [];
  for (const traj of trajs) {
    const cols = fns.map((fn) => traj.map((s) => fn(s)));
    const m = cols.map((c) => mean(c));
    means.push(m);
    const N = traj.length, Wt = Array.from({ length: K }, () => new Array(K).fill(0));
    for (let a = 0; a < K; a++) for (let b = a; b < K; b++) {
      let s = 0; for (let i = 0; i < N; i++) s += (cols[a][i] - m[a]) * (cols[b][i] - m[b]);
      Wt[a][b] = Wt[b][a] = s / N;
    }
    withinCovs.push(Wt);
  }
  const W = Array.from({ length: K }, () => new Array(K).fill(0));
  for (const Wt of withinCovs) for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) W[a][b] += Wt[a][b] / withinCovs.length;
  const mbar = new Array(K).fill(0);
  for (const m of means) for (let k = 0; k < K; k++) mbar[k] += m[k] / means.length;
  const B = Array.from({ length: K }, () => new Array(K).fill(0));
  for (const m of means) for (let a = 0; a < K; a++) for (let b = a; b < K; b++) B[a][b] = B[b][a] = B[a][b] + (m[a] - mbar[a]) * (m[b] - mbar[b]) / means.length;
  const Bis = invSqrt(B);
  const M = matMul(matMul(Bis, W), Bis);
  const { values, vectors } = jacobiEigen(M);
  const order = values.map((_, i) => i).sort((i, j) => values[i] - values[j]);
  const laws = [];
  for (const i of order) {
    if (values[i] > ratioTol) break;
    const y = vectors[i], c = new Array(K).fill(0);
    for (let a = 0; a < K; a++) { let s = 0; for (let b = 0; b < K; b++) s += Bis[a][b] * y[b]; c[a] = s; }
    let mx = 0; for (const v of c) if (Math.abs(v) > mx) mx = Math.abs(v);
    const cn = mx > 0 ? c.map((v) => v / mx) : c;
    laws.push({ expr: terms.map((t, k) => `${round(cn[k])}*(${t})`).join(" + "), ratio: values[i] });
  }
  return { dimension: laws.length, laws };
}
