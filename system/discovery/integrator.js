// integrator.js: symplectic velocity-Verlet for position-only accelerations.
//
// drag > 0 adds a velocity-proportional dissipation so energy is NOT conserved; that
// is the negative control that proves the verifier refuses a non-conserved quantity.
// Zero dependencies.

// Produce a trajectory (array of state objects) for a system from one initial condition.
// A classical system integrates via velocity-Verlet (simulate); a system that brings its own
// dynamics (e.g. the quantum TDSE) exposes `run(ic, opts)` and we defer to it. This is the one
// seam the discovery loop calls, so the SAME perceive/fit/verify machinery serves both.
export function trajectory(system, ic, opts = {}) {
  if (typeof system.run === "function") return system.run(ic, opts);
  return simulate(system, ic, opts);
}

// Integrate `system` from `state0` for `n` steps of `dt`. Returns the trajectory as an
// array of plain state objects (length n+1, including the initial state).
export function simulate(system, state0, { dt = 0.01, n = 2000, drag = 0, params } = {}) {
  const p = params || system.params;
  const coords = system.coords, vels = system.vels;
  const s = { ...state0 };
  const states = [{ ...s }];
  let a = system.accel(s, p);
  for (let step = 0; step < n; step++) {
    // x_{n+1} = x_n + v_n dt + 0.5 a_n dt^2
    for (let i = 0; i < coords.length; i++) {
      s[coords[i]] = s[coords[i]] + s[vels[i]] * dt + 0.5 * a[coords[i]] * dt * dt;
    }
    const aNext = system.accel(s, p); // acceleration is position-only, so this is exact post-move
    // v_{n+1} = v_n + 0.5 (a_n + a_{n+1}) dt   (+ optional dissipation)
    for (let i = 0; i < coords.length; i++) {
      s[vels[i]] = s[vels[i]] + 0.5 * (a[coords[i]] + aNext[coords[i]]) * dt;
      if (drag) s[vels[i]] *= (1 - drag * dt);
    }
    a = aNext;
    states.push({ ...s });
  }
  return states;
}
