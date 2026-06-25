// system/engine/sim/particles-cpu.js
// Stage 1 of the Telos scalable engine: the CPU / worker particle backend (rung 3, the universal
// floor). Zero external dependencies. Pure JS over a flat Float32Array state, drawn with Canvas2D.
// ASCII only (no em-dashes).
//
// This is the GUARANTEED fallback: when no WebGPU and no WebGL2 (or no worker / no OffscreenCanvas)
// is available, the music "particles" mode runs here and behaves exactly as today's
// reactive-visuals.js drawParticles loop. The spring/flocking/cohesion/bass-kick/treble-jitter math
// and the OKLab fill are transcribed from reactive-visuals.js verbatim so the low-tier output is
// indistinguishable from the shipped behavior.
//
// THE COMMON BACKEND INTERFACE (shared by particles-webgpu.js / particles-webgl2.js / particles-cpu.js):
//   const backend = createCpuParticles();
//   await backend.init({ count, width, height, rng });      // allocate state for `count` particles
//   backend.step(dt, forces);                               // advance the sim one frame
//   backend.render(ctx2dOrGl, width, height, params);       // draw the current state
//   backend.resize(width, height);                          // canvas backing changed
//   backend.setCount(n);                                    // governor rescaled the particle budget
//   backend.perceive();                                     // -> small readout for the measurimeter
//   backend.dispose();                                      // release everything (the leave3D discipline)
//   backend.name; // "cpu"
//
// `forces` is the per-frame audio-driven force/spawn descriptor (built by gpu-particles.js from the
// reactive.js audio features + applyMapping params). Shape:
//   { bass, intensity, highMod, pulse, hue, hueShift, level, treble, centroid }
// These are exactly the fields reactive-visuals.js drawParticles reads, so the mapping is identity.

// ---------------------------------------------------------------------------
// OKLab helpers (transcribed verbatim from reactive-visuals.js so colors match today exactly)
// ---------------------------------------------------------------------------
const IM2 = [[1.0,0.3963377774,0.2158037573],[1.0,-0.1055613458,-0.0638541728],[1.0,-0.0894841775,-1.291485548]];
const IM1 = [[4.0767416621,-3.3077115913,0.2309699292],[-1.2684380046,2.6097574011,-0.3413193965],[-0.0041960863,-0.7034186147,1.707614701]];
function _oklabToLinRgb(L, a, b) {
  const l_=IM2[0][0]*L+IM2[0][1]*a+IM2[0][2]*b, m_=IM2[1][0]*L+IM2[1][1]*a+IM2[1][2]*b, s_=IM2[2][0]*L+IM2[2][1]*a+IM2[2][2]*b;
  const l=l_*l_*l_, m=m_*m_*m_, s=s_*s_*s_;
  return [IM1[0][0]*l+IM1[0][1]*m+IM1[0][2]*s, IM1[1][0]*l+IM1[1][1]*m+IM1[1][2]*s, IM1[2][0]*l+IM1[2][1]*m+IM1[2][2]*s];
}
function _linearToSrgb(c) { return c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055; }
function _byteClamp(v) { return Math.max(0, Math.min(255, Math.round(v*255))); }
function oklchToRgba(L, C, H, alpha) {
  const hRad = H * Math.PI / 180;
  const a = C * Math.cos(hRad), b = C * Math.sin(hRad);
  const [lr, lg, lb] = _oklabToLinRgb(L, a, b);
  const r = _byteClamp(_linearToSrgb(lr)), g = _byteClamp(_linearToSrgb(lg)), bb = _byteClamp(_linearToSrgb(lb));
  return `rgba(${r},${g},${bb},${(alpha === undefined ? 1 : alpha).toFixed(3)})`;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// A small deterministic PRNG so the sim can be seeded (no bare Math.random in the cook path when a
// seed is supplied). Mulberry32. When no rng is passed, we fall back to Math.random to preserve the
// exact "feel" of today's drawParticles (which used Math.random throughout).
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Per-particle SoA layout in a single Float32Array (FLOATS_PER_PARTICLE fields each). Flat typed
// arrays are what transfer zero-copy to a worker, so the CPU backend uses the SAME memory layout the
// GPU rungs ping-pong, keeping the interface honest across backends.
const F = {
  X: 0, Y: 1, VX: 2, VY: 3, HX: 4, HY: 5, HUE: 6, L: 7, C: 8, SIZE: 9,
};
const FLOATS_PER_PARTICLE = 10;

export function createCpuParticles() {
  let state = null;       // Float32Array, SoA interleaved
  let count = 0;
  let capacity = 0;
  let w = 1, h = 1;
  let rnd = Math.random;

  function alloc(n) {
    capacity = Math.max(1, n);
    state = new Float32Array(capacity * FLOATS_PER_PARTICLE);
  }

  function seedParticle(i) {
    const o = i * FLOATS_PER_PARTICLE;
    state[o + F.X] = rnd() * w;
    state[o + F.Y] = rnd() * h;
    state[o + F.VX] = (rnd() - 0.5) * 0.5;
    state[o + F.VY] = (rnd() - 0.5) * 0.5;
    state[o + F.HX] = rnd() * w;
    state[o + F.HY] = rnd() * h;
    state[o + F.HUE] = rnd() * 360;
    state[o + F.L] = 0.6;
    state[o + F.C] = 0.18;
    state[o + F.SIZE] = 1.5 + rnd() * 2.5;
  }

  function reseedAll() {
    for (let i = 0; i < count; i++) seedParticle(i);
  }

  return {
    name: "cpu",
    // The flat layout is part of the interface contract; expose for the transferable transport.
    FLOATS_PER_PARTICLE,

    async init(cfg) {
      const c = cfg || {};
      w = Math.max(1, c.width || 1);
      h = Math.max(1, c.height || 1);
      rnd = (typeof c.rng === "function") ? c.rng
          : (Number.isFinite(c.seed) ? mulberry32(c.seed | 0) : Math.random);
      count = Math.max(0, Math.floor(c.count || 0));
      alloc(count || 1);
      reseedAll();
      return true;
    },

    // Advance the simulation one frame. dt is in seconds (kept for interface parity; the transcribed
    // math is the per-frame fixed step from drawParticles, which did not scale by dt, so we keep that
    // behavior at the low tier to match today exactly).
    step(dt, forces) {
      if (!state || count === 0) return;
      const fr = forces || {};
      const bass = fr.bass || 0;
      const intensity = fr.intensity || 0;
      const highMod = fr.highMod || 0;
      const pulse = fr.pulse || 0;
      const hue = fr.hue || 0;

      // Global center of mass (cheap cohesion target), exactly as drawParticles.
      let cx = 0, cy = 0;
      for (let i = 0; i < count; i++) { const o = i * FLOATS_PER_PARTICLE; cx += state[o + F.X]; cy += state[o + F.Y]; }
      cx /= count; cy /= count;

      const kSpring = 0.004 + intensity * 0.006;
      const damping = 0.96 - bass * 0.02;

      for (let i = 0; i < count; i++) {
        const o = i * FLOATS_PER_PARTICLE;
        let x = state[o + F.X], y = state[o + F.Y];
        let vx = state[o + F.VX], vy = state[o + F.VY];
        const hx = state[o + F.HX], hy = state[o + F.HY];

        // Spring toward home (damped harmonic oscillator).
        vx += (hx - x) * kSpring;
        vy += (hy - y) * kSpring;
        // Cohesion: gentle pull toward center of mass.
        vx += (cx - x) * 0.0003 * (1 - bass);
        vy += (cy - y) * 0.0003 * (1 - bass);
        // Bass drives a radial kick.
        vy -= bass * 0.8 * (rnd() - 0.5);
        vx += bass * 0.8 * (rnd() - 0.5);
        // Treble jitter.
        if (highMod > 0.3) {
          vx += (rnd() - 0.5) * highMod * 0.5;
          vy += (rnd() - 0.5) * highMod * 0.5;
        }
        vx *= damping; vy *= damping;
        x += vx; y += vy;

        // Wrap; re-home on wrap (matches drawParticles).
        if (x < 0) { x += w; state[o + F.HX] = rnd() * w; }
        if (x > w) { x -= w; state[o + F.HX] = rnd() * w; }
        if (y < 0) { y += h; state[o + F.HY] = rnd() * h; }
        if (y > h) { y -= h; state[o + F.HY] = rnd() * h; }

        // Hue drift toward the audio hue (index-spread), exactly as drawParticles.
        state[o + F.HUE] = lerp(state[o + F.HUE], hue + (i / count) * 80, 0.01);

        state[o + F.X] = x; state[o + F.Y] = y;
        state[o + F.VX] = vx; state[o + F.VY] = vy;
      }
    },

    // Render the current state with Canvas2D, identical fill recipe to drawParticles.
    render(ctx, width, height, params) {
      if (!ctx || !ctx.arc) return;       // a 2D context (the CPU backend only draws to Canvas2D)
      if (!state || count === 0) return;
      const p = params || {};
      const intensity = p.intensity || 0;
      const hueShift = p.hueShift || 0;
      for (let i = 0; i < count; i++) {
        const o = i * FLOATS_PER_PARTICLE;
        const L = state[o + F.L] + hueShift * 0.1;
        const C = state[o + F.C] + intensity * 0.06;
        ctx.beginPath();
        ctx.arc(state[o + F.X], state[o + F.Y], state[o + F.SIZE] * (1 + intensity * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = oklchToRgba(clamp(L, 0.3, 0.9), clamp(C, 0, 0.3), state[o + F.HUE] % 360, 0.7);
        ctx.fill();
      }
    },

    resize(width, height) {
      w = Math.max(1, width || w);
      h = Math.max(1, height || h);
    },

    setCount(n) {
      const next = Math.max(0, Math.floor(n || 0));
      if (next === count) return count;
      if (next > capacity) {
        // Grow: keep existing particles, seed the new ones.
        const old = state, oldCount = count;
        alloc(next);
        if (old) state.set(old.subarray(0, oldCount * FLOATS_PER_PARTICLE));
        for (let i = oldCount; i < next; i++) seedParticle(i);
      }
      count = next;
      return count;
    },

    // The small readout the spine / measurimeter consumes. Honest: a count and the live centroid.
    perceive() {
      if (!state || count === 0) return { backend: "cpu", count: 0, cx: 0, cy: 0 };
      let cx = 0, cy = 0;
      for (let i = 0; i < count; i++) { const o = i * FLOATS_PER_PARTICLE; cx += state[o + F.X]; cy += state[o + F.Y]; }
      return { backend: "cpu", count, cx: cx / count, cy: cy / count };
    },

    // Expose the raw state buffer (for transferable transport / inspection). Not copied.
    getState() { return state ? state.subarray(0, count * FLOATS_PER_PARTICLE) : new Float32Array(0); },
    getCount() { return count; },

    dispose() {
      state = null; count = 0; capacity = 0;
    },
  };
}

export const _FLOATS_PER_PARTICLE = FLOATS_PER_PARTICLE;   // exported for tests
export const _F = F;
export default { createCpuParticles };
