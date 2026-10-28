// orbital.js: hydrogen orbital superpositions with flow (family V, feed set 24). Exact bound-state
// wavefunctions psi_nlm in atomic units (hbar = m_e = a0 = 1, E_n = -1/(2n^2)); a state is a list
// of terms { n, l, m, c }; its density sloshes at the beat frequencies. Points are drawn from
// |psi(0)|^2 and carried by the probability current, v = Im(grad psi / psi) (the de Broglie-Bohm
// guidance law), which keeps an ensemble distributed as |psi(t)|^2 at every t. Pure.

const fact = n => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
export const energy = n => -0.5 / (n * n);
export const LETTERS = 'spdfghik';

// Generalised Laguerre L_k^a(x) by the three-term recurrence.
export function laguerre(k, a, x) {
  if (k === 0) return 1;
  let p0 = 1, p1 = 1 + a - x;
  for (let j = 1; j < k; j++) { const p2 = ((2 * j + 1 + a - x) * p1 - (j + a) * p0) / (j + 1); p0 = p1; p1 = p2; }
  return p1;
}

// Associated Legendre P_l^m(x), m >= 0, with the Condon-Shortley phase.
export function legendre(l, m, x) {
  let pmm = 1; const s = Math.sqrt(Math.max(0, 1 - x * x));
  for (let i = 1; i <= m; i++) pmm *= -(2 * i - 1) * s;
  if (l === m) return pmm;
  let p1 = x * (2 * m + 1) * pmm; if (l === m + 1) return p1;
  let p0 = pmm;
  for (let ll = m + 2; ll <= l; ll++) { const p2 = ((2 * ll - 1) * x * p1 - (ll + m - 1) * p0) / (ll - m); p0 = p1; p1 = p2; }
  return p1;
}

export function radialNorm(n, l) { return Math.sqrt((2 / n) ** 3 * fact(n - l - 1) / (2 * n * fact(n + l))); }
export function radial(n, l, r) { const rho = 2 * r / n; return radialNorm(n, l) * Math.exp(-r / n) * rho ** l * laguerre(n - l - 1, 2 * l + 1, rho); }

// Complex Y_lm: returns [re, im]. Negative m via Y_l,-m = (-1)^m conj(Y_lm).
export function ylm(l, m, ct, phi) {
  const am = Math.abs(m), N = Math.sqrt((2 * l + 1) / (4 * Math.PI) * fact(l - am) / fact(l + am)), P = N * legendre(l, am, ct);
  const re = P * Math.cos(am * phi), im = P * Math.sin(am * phi);
  if (m >= 0) return [re, im];
  const sg = am % 2 ? -1 : 1; return [sg * re, -sg * im];
}

// Prepare a state: normalise coefficients, cache the per-term constants.
export function makeState(terms) {
  const n2 = terms.reduce((s, t) => s + (t.c?.[0] ?? t.c) ** 2 + (t.c?.[1] ?? 0) ** 2, 0);
  const T = terms.map(t => {
    if (!(t.n >= 1 && t.l >= 0 && t.l < t.n && Math.abs(t.m) <= t.l)) throw new Error(`orbital: bad quantum numbers ${t.n},${t.l},${t.m}`);
    const c = Array.isArray(t.c) ? t.c : [t.c ?? 1, 0];
    const am = Math.abs(t.m);
    return { ...t, cr: c[0] / Math.sqrt(n2), ci: c[1] / Math.sqrt(n2), E: energy(t.n), rn: radialNorm(t.n, t.l),
      yn: Math.sqrt((2 * t.l + 1) / (4 * Math.PI) * fact(t.l - am) / fact(t.l + am)), group: t.group ?? 0 };
  });
  const Es = [...new Set(T.map(t => t.E))].sort((a, b) => a - b), gaps = [];
  for (let i = 1; i < Es.length; i++) gaps.push(Es[i] - Es[0]);
  const beat = gaps.length ? Math.min(...gaps) : 0;
  return { terms: T, beat, period: beat ? 2 * Math.PI / beat : Infinity };
}

// One term's value at a point, without the time phase: [re, im].
function termAt(t, x, y, z) {
  const r = Math.hypot(x, y, z), ct = r > 0 ? z / r : 1, phi = Math.atan2(y, x), rho = 2 * r / t.n;
  const R = t.rn * Math.exp(-r / t.n) * rho ** t.l * laguerre(t.n - t.l - 1, 2 * t.l + 1, rho);
  const am = Math.abs(t.m), P = t.yn * legendre(t.l, am, ct) * R;
  let re = P * Math.cos(am * phi), im = P * Math.sin(am * phi);
  if (t.m < 0) { const sg = am % 2 ? -1 : 1; re *= sg; im *= -sg; }
  return [re, im];
}

// psi(x, y, z, t) as [re, im]; with byGroup, also the density of each group (for the colour key).
export function psi(S, x, y, z, t, byGroup = null) {
  let re = 0, im = 0;
  const g = byGroup ? [[0, 0], [0, 0]] : null;
  for (const k of S.terms) {
    const [a, b] = termAt(k, x, y, z), ph = -k.E * t, cp = Math.cos(ph), sp = Math.sin(ph);
    const cr = k.cr * cp - k.ci * sp, ci = k.cr * sp + k.ci * cp;      // c_k e^{-i E t}
    const vr = cr * a - ci * b, vi = cr * b + ci * a;
    re += vr; im += vi;
    if (g) { g[k.group][0] += vr; g[k.group][1] += vi; }
  }
  if (g) { byGroup[0] = g[0][0] ** 2 + g[0][1] ** 2; byGroup[1] = g[1][0] ** 2 + g[1][1] ** 2; }
  return [re, im];
}

export const density = (S, x, y, z, t) => { const [a, b] = psi(S, x, y, z, t); return a * a + b * b; };

// Guidance velocity Im(conj(psi) grad psi) / |psi|^2 by central differences, capped at vmax.
export function velocity(S, x, y, z, t, h = 1e-3, vmax = 4) {
  const [a, b] = psi(S, x, y, z, t), d = a * a + b * b;
  if (d < 1e-14) return [0, 0, 0];
  const v = [0, 0, 0], P = [x, y, z];
  for (let i = 0; i < 3; i++) {
    P[i] += h; const [ap, bp] = psi(S, P[0], P[1], P[2], t); P[i] -= 2 * h; const [am, bm] = psi(S, P[0], P[1], P[2], t); P[i] += h;
    const gr = (ap - am) / (2 * h), gi = (bp - bm) / (2 * h);
    v[i] = (a * gi - b * gr) / d;
  }
  const s = Math.hypot(v[0], v[1], v[2]); if (s > vmax) for (let i = 0; i < 3; i++) v[i] *= vmax / s;
  return v;
}

// Carry points (Float64Array of x, y, z triples) from t to t + dt with midpoint steps.
export function advect(S, pts, t, dt, steps = 2, h = 1e-3) {
  const k = dt / steps;
  for (let s = 0; s < steps; s++) {
    const tt = t + s * k;
    for (let i = 0; i < pts.length; i += 3) {
      const x = pts[i], y = pts[i + 1], z = pts[i + 2], v1 = velocity(S, x, y, z, tt, h);
      const v2 = velocity(S, x + 0.5 * k * v1[0], y + 0.5 * k * v1[1], z + 0.5 * k * v1[2], tt + 0.5 * k, h);
      pts[i] = x + k * v2[0]; pts[i + 1] = y + k * v2[1]; pts[i + 2] = z + k * v2[2];
    }
  }
  return pts;
}

// Independent draws from |psi(t)|^2: tabulate the density on a g^3 voxel grid over a box of half-width R,
// pick voxels by inverse CDF, place each point uniformly in its voxel, then give every point `polish`
// Metropolis steps of one voxel's width on its own (so no two points share a chain).
export function sampleGrid(S, count, rand, { t = 0, g = 56, R = null, polish = 6 } = {}) {
  const nmax = Math.max(...S.terms.map(k => k.n)), H = R ?? 2.6 * nmax * nmax + 3, vx = 2 * H / g;
  const cdf = new Float64Array(g * g * g); let acc = 0;
  for (let k = 0; k < g; k++) for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
    acc += density(S, -H + (i + 0.5) * vx, -H + (j + 0.5) * vx, -H + (k + 0.5) * vx, t); cdf[(k * g + j) * g + i] = acc;
  }
  const out = new Float64Array(count * 3);
  for (let n = 0; n < count; n++) {
    const u = rand() * acc; let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid + 1; else hi = mid; }
    const i = lo % g, j = ((lo / g) | 0) % g, k = (lo / (g * g)) | 0;
    let p = [-H + (i + rand()) * vx, -H + (j + rand()) * vx, -H + (k + rand()) * vx], d = density(S, ...p, t);
    for (let s = 0; s < polish; s++) {
      const q = [p[0] + (rand() - 0.5) * vx, p[1] + (rand() - 0.5) * vx, p[2] + (rand() - 0.5) * vx], dq = density(S, ...q, t);
      if (dq >= d || rand() * d < dq) { p = q; d = dq; }
    }
    out[3 * n] = p[0]; out[3 * n + 1] = p[1]; out[3 * n + 2] = p[2];
  }
  return out;
}

// Metropolis sampling of |psi(t)|^2: `chains` walkers, burn-in, thinning. rand: () => [0, 1).
// Chains are correlated; prefer sampleGrid when the sample mean matters.
export function sample(S, count, rand, { t = 0, chains = 48, burn = 400, thin = 6, step = null } = {}) {
  const nmax = Math.max(...S.terms.map(k => k.n)), st = step ?? 0.55 * nmax, out = new Float64Array(count * 3);
  const W = []; for (let c = 0; c < chains; c++) { const p = [(rand() - 0.5) * nmax * 2, (rand() - 0.5) * nmax * 2, (rand() - 0.5) * nmax * 2]; W.push({ p, d: density(S, ...p, t) }); }
  const move = w => {
    const q = [w.p[0] + (rand() - 0.5) * 2 * st, w.p[1] + (rand() - 0.5) * 2 * st, w.p[2] + (rand() - 0.5) * 2 * st], dq = density(S, ...q, t);
    if (dq >= w.d || rand() * w.d < dq) { w.p = q; w.d = dq; }
  };
  for (let b = 0; b < burn; b++) for (const w of W) move(w);
  let n = 0;
  while (n < count) for (const w of W) { for (let k = 0; k < thin; k++) move(w); if (n < count) { out.set(w.p, 3 * n); n++; } }
  return out;
}

// Everything a frame needs at time t: positions (float32), the colour share per point, the density
// per point (it sets the splat size), and the enclosure mask keeping the `keep` share of points with
// the highest density.
export function snapshot(S, P, t, keep = 0.82) {
  const n = P.length / 3, pos = new Float32Array(P), w = new Float32Array(n), d = new Float32Array(n), g = [0, 0];
  for (let i = 0; i < n; i++) {
    const [a, b] = psi(S, P[3 * i], P[3 * i + 1], P[3 * i + 2], t, g);
    w[i] = g[1] / (g[0] + g[1] + 1e-30); d[i] = a * a + b * b;
  }
  const s = Float32Array.from(d).sort(), cut = s[Math.floor((1 - keep) * (n - 1))], vis = new Uint8Array(n);
  for (let i = 0; i < n; i++) vis[i] = d[i] >= cut ? 1 : 0;
  return { pos, w, d, vis };
}


// Names and notation from the quantum numbers: "2s + 3d", and the ket sum as plain text parts.
export const termName = k => `${k.n}${LETTERS[k.l]}`;
export function stateName(S) { return [...new Set(S.terms.map(termName))].join(' + '); }
export function ketParts(S) { return S.terms.map(k => ({ n: k.n, l: k.l, m: k.m, c: Math.hypot(k.cr, k.ci), sign: k.cr < 0 ? -1 : 1 })); }

// Expectation of z by quadrature on a spherical grid (for tests and the readout): sum |psi|^2 z dV.
export function expectZ(S, t, { rmax = null, nr = 160, nt = 48, np = 24 } = {}) {
  const nmax = Math.max(...S.terms.map(k => k.n)), R = rmax ?? 6 * nmax * nmax + 10;
  let s = 0, norm = 0;
  for (let i = 0; i < nr; i++) {
    const r = (i + 0.5) * R / nr, dr = R / nr;
    for (let j = 0; j < nt; j++) {
      const th = (j + 0.5) * Math.PI / nt, dth = Math.PI / nt, st = Math.sin(th), ct = Math.cos(th);
      for (let k = 0; k < np; k++) {
        const ph = (k + 0.5) * 2 * Math.PI / np, dV = r * r * st * dr * dth * 2 * Math.PI / np;
        const d = density(S, r * st * Math.cos(ph), r * st * Math.sin(ph), r * ct, t) * dV;
        s += d * r * ct; norm += d;
      }
    }
  }
  return { z: s, norm };
}

// QUALITY-SPEC S1, S2, S4 for the physics.
export const SPEC = Object.freeze({
  inputs: { terms: '[{ n: int 1 to 8, l: 0 to n-1, m: -l to l, c: real or [re, im], group: 0 | 1 }]' },
  params: { count: 'points, 1,000 to 200,000', grid: 'voxels per side for sampling, 24 to 96 (56)', polish: 'Metropolis steps per point, 0 to 20 (6)',
    h: 'finite-difference step in bohr, 1e-4 to 1e-2 (1e-3)', vmax: 'speed cap in bohr per a.u. time (4)', beat: 'display seconds per beat (7.2, measured)' },
  determinism: 'seeded sampling; same seed and terms give identical points (orbital.test.mjs)',
  budget: { sample: '42,000 points under 1.5 s (node)', step: '42,000 points, one 0.2 s display step under 400 ms in a worker' },
});
