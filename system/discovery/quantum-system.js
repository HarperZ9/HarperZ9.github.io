// quantum-system.js: adapt the 1D TDSE into the discovery loop's `system` interface, so the
// SAME perceive/fit/verify machinery that rediscovers classical conservation laws also works on
// a quantum system. The model perceives ONLY the measurable moments {x, x2, p, p2} of the state
// over time; it never sees the Hamiltonian, the potential, or the energy. For the harmonic well
// the conserved energy is 1/2(<x^2> + <p^2>), i.e. the combination x2 + p2 in these moments,
// structurally the same shape the model already finds for the classical oscillator. Zero deps.
import { makeGrid, evolve } from "./quantum.js";

const uniform = (r, lo, hi) => lo + (hi - lo) * r();

export function quantumSystem(name, Vfn, opts = {}) {
  const { N = 256, L = 20, dt = 0.01, n = 400 } = opts;
  const grid = makeGrid(N, L);
  return {
    name,
    vars: ["x", "x2", "p", "p2"], // perceived moments only; H / V / norm are NOT exposed
    quantum: true,
    Vfn, gridN: N, gridL: L, // exposed so the renderer can evolve + draw the wavefunction
    sampleState(r) {
      return { x0: uniform(r, -2, 2), sigma: uniform(r, 0.8, 1.2), p0: uniform(r, -1.2, 1.2) };
    },
    run(ic, runOpts = {}) {
      return evolve(grid, Vfn, { ...ic, dt: runOpts.dt || dt, n: runOpts.n || n });
    },
  };
}

// The quantum harmonic oscillator (V = 1/2 x^2). Energy = 1/2(<x^2> + <p^2>) -> the combination x2 + p2.
export const qho = quantumSystem("qho", (x) => 0.5 * x * x, { dt: 0.01, n: 400 });

// The free quantum particle (V = 0): no force, so MOMENTUM is conserved (<p>, <p2>) while the packet
// drifts and spreads (<x> moves, <x2> grows). A DIFFERENT conservation law than the oscillator's energy,
// from the same loop: translation invariance -> momentum (Noether). Short evolution + wide grid so the
// packet does not wrap the periodic boundary (which would corrupt the position moments).
export const free = (() => {
  const s = quantumSystem("free", () => 0, { N: 256, L: 40, dt: 0.02, n: 200 });
  // start in the left half, drift rightward, short time + wide grid: the packet never wraps.
  s.sampleState = (r) => ({ x0: -10 + 8 * r(), sigma: 1.3 + 0.5 * r(), p0: 0.3 + 0.7 * r() });
  return s;
})();

export const QSYSTEMS = { qho, free };
