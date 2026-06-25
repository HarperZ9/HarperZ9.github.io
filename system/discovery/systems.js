// systems.js: governed classical systems with KNOWN invariants.
//
// The known invariants are GROUND TRUTH for tests and scoring ONLY. They are never
// handed to the solving model; the model must find them from perceived data alone.
// Each system exposes a POSITION-ONLY acceleration so a symplectic velocity-Verlet
// integrator conserves energy to high accuracy (a drifting integrator would defeat
// honest rediscovery). Zero dependencies. ASCII only.

// A tiny deterministic PRNG (mulberry32) so trajectories and initial conditions are
// reproducible across runs (re-checkability of the whole experiment).
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const uniform = (r, lo, hi) => lo + (hi - lo) * r();

// Simple harmonic oscillator: x'' = -omega^2 x. Invariant E = 0.5 v^2 + 0.5 omega^2 x^2.
export const sho = {
  name: "sho",
  coords: ["x"],
  vels: ["v"],
  vars: ["x", "v"],
  params: { omega: 1.3 },
  sampleState(r) {
    return { x: uniform(r, -1.5, 1.5), v: uniform(r, -1.5, 1.5) };
  },
  accel(s, p = this.params) {
    return { x: -p.omega * p.omega * s.x };
  },
  knownInvariant(s, p = this.params) {
    return 0.5 * s.v * s.v + 0.5 * p.omega * p.omega * s.x * s.x;
  },
};

// Undamped pendulum: theta'' = -(g/l) sin theta. Invariant E = 0.5 w^2 - (g/l) cos theta.
export const pendulum = {
  name: "pendulum",
  coords: ["theta"],
  vels: ["w"],
  vars: ["theta", "w"],
  params: { g: 9.81, l: 1.0 },
  sampleState(r) {
    // bounded below the separatrix so it swings (does not go over the top)
    return { theta: uniform(r, -1.0, 1.0), w: uniform(r, -1.0, 1.0) };
  },
  accel(s, p = this.params) {
    return { theta: -(p.g / p.l) * Math.sin(s.theta) };
  },
  knownInvariant(s, p = this.params) {
    return 0.5 * s.w * s.w - (p.g / p.l) * Math.cos(s.theta);
  },
};

// Kepler (2D): r'' = -mu r / |r|^3. Invariants: energy and angular momentum.
export const kepler = {
  name: "kepler",
  coords: ["x", "y"],
  vels: ["vx", "vy"],
  vars: ["x", "y", "vx", "vy"],
  params: { mu: 1.0 },
  sampleState(r, p = this.params) {
    // a bound elliptical orbit: radius ~1, sub-circular tangential speed
    const radius = uniform(r, 0.9, 1.3);
    const ang = uniform(r, 0, Math.PI * 2);
    const x = radius * Math.cos(ang), y = radius * Math.sin(ang);
    const vCirc = Math.sqrt(p.mu / radius);
    const speed = vCirc * uniform(r, 0.7, 0.95);
    return { x, y, vx: -speed * Math.sin(ang), vy: speed * Math.cos(ang) };
  },
  accel(s, p = this.params) {
    const r3 = Math.pow(s.x * s.x + s.y * s.y, 1.5) + 1e-12;
    return { x: -p.mu * s.x / r3, y: -p.mu * s.y / r3 };
  },
  knownInvariant(s, p = this.params) {
    const r = Math.sqrt(s.x * s.x + s.y * s.y) + 1e-12;
    return 0.5 * (s.vx * s.vx + s.vy * s.vy) - p.mu / r;
  },
  knownAngularMomentum(s) {
    return s.x * s.vy - s.y * s.vx;
  },
};

// 2D isotropic harmonic oscillator: x'' = -omega^2 x, y'' = -omega^2 y. A superintegrable system with
// SEVERAL independent conserved quantities: total energy, the per-axis energies, and angular momentum.
// Used to show the engine finds more than one law on a single system.
export const oscillator2d = {
  name: "oscillator2d",
  coords: ["x", "y"],
  vels: ["vx", "vy"],
  vars: ["x", "y", "vx", "vy"],
  params: { omega: 1.1 },
  sampleState(r) {
    return { x: uniform(r, -1.3, 1.3), y: uniform(r, -1.3, 1.3), vx: uniform(r, -1.3, 1.3), vy: uniform(r, -1.3, 1.3) };
  },
  accel(s, p = this.params) {
    return { x: -p.omega * p.omega * s.x, y: -p.omega * p.omega * s.y };
  },
  knownInvariant(s, p = this.params) {
    return 0.5 * (s.vx * s.vx + s.vy * s.vy) + 0.5 * p.omega * p.omega * (s.x * s.x + s.y * s.y);
  },
  knownAngularMomentum(s) {
    return s.x * s.vy - s.y * s.vx;
  },
};

// Two bodies on a line coupled by a spring whose force depends only on the SEPARATION (x1 - x2).
// The dynamics are invariant under translating BOTH bodies, so by Noether the TOTAL momentum
// v1 + v2 is conserved (the forces are equal and opposite), while each body's velocity oscillates.
// Energy is also conserved (time-translation). A clean translation-symmetry -> momentum example.
export const twoBody = {
  name: "twoBody",
  coords: ["x1", "x2"],
  vels: ["v1", "v2"],
  vars: ["x1", "x2", "v1", "v2"],
  params: { k: 1.4 },
  sampleState(r) {
    return { x1: uniform(r, -1.6, -0.3), x2: uniform(r, 0.3, 1.6), v1: uniform(r, -1, 1), v2: uniform(r, -1, 1) };
  },
  accel(s, p = this.params) {
    const f = -p.k * (s.x1 - s.x2); // spring force depends only on the separation
    return { x1: f, x2: -f };
  },
  knownInvariant(s, p = this.params) {
    return 0.5 * (s.v1 * s.v1 + s.v2 * s.v2) + 0.5 * p.k * (s.x1 - s.x2) * (s.x1 - s.x2);
  },
  knownMomentum(s) { return s.v1 + s.v2; },
};

export const SYSTEMS = { sho, pendulum, kepler, oscillator2d, twoBody };
