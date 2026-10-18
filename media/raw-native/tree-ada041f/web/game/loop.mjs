// The fixed-step main loop (runtime stage G1, ADR 0014). Pure: runs in Node.
//
// The simulation advances in steps of exactly 1 / hz seconds. Render frames arrive at any
// rate; each frame adds its duration to an accumulator and runs as many whole steps as fit.
// The remainder is the interpolation factor alpha in [0, 1): the renderer draws the state
// alpha of the way from the previous step to the current one, so motion is smooth at any
// display rate while the simulation itself never sees a variable dt.
//
// Time is counted in integer microseconds, and the accumulator holds microseconds times hz,
// so a step boundary is an exact integer comparison. Splitting the same total time into
// different frame lengths therefore gives the same number of steps and the same state.
// Each frame's length is rounded to a whole microsecond, so a frame of exactly 1/60 s counts
// 16667 us: the simulation runs 20 parts per million fast against such a clock, which no
// player can see, and the step count stays exact (600 frames of 1/60 s are 600 steps).
//
//   const loop = createFixedLoop({ hz: 60, maxSteps: 8 });
//   const { steps, alpha, dropped } = loop.advance(frameSeconds, (index, dt) => { ... one step ... });
//
// maxSteps bounds the work in one frame (a stalled tab must not trigger a burst of hundreds of
// steps); the time beyond it is dropped and reported, never silently.

const US = 1_000_000;

export function createFixedLoop({ hz = 60, maxSteps = 8 } = {}) {
  if (!Number.isInteger(hz) || hz < 1 || hz > 1000) throw new Error(`fixed loop: hz is a whole number in [1, 1000], got ${hz}`);
  if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new Error(`fixed loop: maxSteps is a whole number >= 1, got ${maxSteps}`);
  const dt = 1 / hz;
  let acc = 0;            // microseconds * hz, always in [0, US)
  let index = 0;          // steps taken so far
  let droppedUs = 0;      // total time dropped by the maxSteps bound
  return {
    hz, dt, maxSteps,
    get steps() { return index; },
    get droppedSeconds() { return droppedUs / US; },
    // Simulated time, in seconds, at the current step.
    get time() { return index / hz; },
    // Advance by frameSeconds; calls step(index, dt) once per whole step. Returns the steps run,
    // alpha for interpolation, and the seconds dropped by the bound in this call.
    advance(frameSeconds, step) {
      if (!(frameSeconds >= 0) || !Number.isFinite(frameSeconds)) throw new Error(`fixed loop: frame time must be finite and >= 0, got ${frameSeconds}`);
      acc += Math.round(frameSeconds * US) * hz;
      let n = 0;
      while (acc >= US) {
        if (n === maxSteps) {
          const drop = Math.floor(acc / US) * US;
          droppedUs += drop / hz; acc -= drop;
          return { steps: n, alpha: acc / US, dropped: drop / hz / US };
        }
        acc -= US;
        step(index, dt);
        index++; n++;
      }
      return { steps: n, alpha: acc / US, dropped: 0 };
    },
    // Run exactly n steps, leaving the accumulator alone (films and replays seek this way).
    stepN(n, step) { for (let k = 0; k < n; k++) { step(index, dt); index++; } },
    reset() { acc = 0; index = 0; droppedUs = 0; },
  };
}

// A simulation with a previous and a current state, for interpolated rendering.
//   game.init(seed, assets) -> state            (plain, cloneable data)
//   game.step(state, input, dt, assets) -> state (a new state; it must not keep references to the input)
//   game.lerp(prev, curr, alpha) -> view state  (optional; defaults to the current state)
// input(index) gives the action frame for step index (from live devices or a recorded track).
export function createSession(game, { seed = 1, assets = null, hz = game.hz || 60, maxSteps = 8 } = {}) {
  const loop = createFixedLoop({ hz, maxSteps });
  let curr = game.init(seed, assets), prev = curr, alpha = 0;
  const s = {
    loop,
    get state() { return curr; },
    get previous() { return prev; },
    get alpha() { return alpha; },
    advance(frameSeconds, input) {
      const r = loop.advance(frameSeconds, (index, dt) => { prev = curr; curr = game.step(curr, input(index), dt, assets); });
      alpha = r.alpha;
      return r;
    },
    stepN(n, input) { loop.stepN(n, (index, dt) => { prev = curr; curr = game.step(curr, input(index), dt, assets); }); },
    view() { return game.lerp ? game.lerp(prev, curr, alpha) : curr; },
    restore(state) { curr = prev = state; alpha = 0; },
  };
  return s;
}

// Shared interpolation helpers for game.lerp.
export const mix = (a, b, t) => a + (b - a) * t;
export const mixAngle = (a, b, t) => { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };
export const mixVec = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
