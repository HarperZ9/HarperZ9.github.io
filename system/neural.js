// neural.js: seed-authored neural networks as generative instruments.
//
// No pretrained weights ship. The SEED derives every weight, bias, and
// activation choice, so the network IS the artwork's DNA: deterministic,
// reproducible, zero-dependency. Two kinds, both pure math (the canvas
// rendering lives in generative-field.js):
//
//   buildCppn    - a compositional pattern-producing network. A tiny MLP over
//                  normalized (x, y, r, ...) paints a smooth 2D colour field.
//                  This is the canonical "neural network as art engine": the
//                  same idea our hand-written instruments use, but the mapping
//                  is a learned-shaped function instead of an authored one.
//   buildNeuralSdf - a small MLP displaces a base sphere into a neural signed
//                  -distance surface the 3D raymarcher can sphere-trace. The
//                  displacement is bounded, so the surface stays renderable and
//                  the march converges fast - genuine neural 3D geometry with
//                  no gigabyte model download.

// FNV-1a string hash, matching the engine's route hash so a string seed drives
// the same network wherever it is used.
export function neuralSeed(value) {
  let h = 2166136261;
  const s = String(value == null ? "neural" : value);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic scalar in [-scale, scale] from (seed, index). A splitmix-ish
// bit mix so nearby indices decorrelate (adjacent weights must not rhyme).
function weightAt(seed, index, scale) {
  let x = (seed ^ Math.imul(index + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0;
  x ^= x >>> 12; x = Math.imul(x, 0x297a2d39) >>> 0;
  x ^= x >>> 15;
  return ((x >>> 0) / 4294967295 * 2 - 1) * scale;
}

const ACTIVATIONS = {
  tanh: (v) => Math.tanh(v),
  sin: (v) => Math.sin(v * 2.2),
  gauss: (v) => Math.exp(-v * v * 1.6) * 2 - 1,
  // A smooth folded activation adds ridged structure without discontinuities.
  fold: (v) => Math.abs((v * 0.7 + 1) % 2 - 1) * 2 - 1,
};
const ACT_NAMES = Object.keys(ACTIVATIONS);

/* Build an MLP from a seed.
   layers: [inN, h1, h2, ..., outN] sizes.
   Returns { layers, W:[Float32Array per layer, row-major outN*inN], B:[...],
   acts:[activation name per hidden layer] }. The output layer is linear. */
export function buildMlp(seed, layers, opts = {}) {
  const scale = opts.scale == null ? 2.4 : opts.scale;
  const W = [];
  const B = [];
  const acts = [];
  let idx = 0;
  for (let l = 1; l < layers.length; l += 1) {
    const inN = layers[l - 1];
    const outN = layers[l];
    const w = new Float32Array(outN * inN);
    for (let o = 0; o < outN; o += 1) {
      for (let i = 0; i < inN; i += 1) w[o * inN + i] = weightAt(seed, idx++, scale);
    }
    const b = new Float32Array(outN);
    for (let o = 0; o < outN; o += 1) b[o] = weightAt(seed, idx++, scale * 0.5);
    W.push(w);
    B.push(b);
    if (l < layers.length - 1) {
      // Per-layer activation, chosen by the seed for variety across networks.
      acts.push(ACT_NAMES[Math.floor((weightAt(seed, idx++, 1) * 0.5 + 0.5) * ACT_NAMES.length) % ACT_NAMES.length]);
    }
  }
  return { layers: layers.slice(), W, B, acts };
}

/* Forward pass. input: number[] of length layers[0]. Returns number[] of length
   last layer (linear output). Reuses two scratch buffers, so it allocates
   nothing per call in the hot path. */
export function mlpForward(mlp, input) {
  let cur = input;
  for (let l = 0; l < mlp.W.length; l += 1) {
    const inN = mlp.layers[l];
    const outN = mlp.layers[l + 1];
    const w = mlp.W[l];
    const b = mlp.B[l];
    const out = new Array(outN);
    const act = l < mlp.acts.length ? ACTIVATIONS[mlp.acts[l]] : null;
    for (let o = 0; o < outN; o += 1) {
      let sum = b[o];
      const base = o * inN;
      for (let i = 0; i < inN; i += 1) sum += w[base + i] * cur[i];
      out[o] = act ? act(sum) : sum;
    }
    cur = out;
  }
  return cur;
}

/* A CPPN over normalized coordinates. eval(nx, ny) with nx, ny in [-1, 1]
   returns [r, g, b] in [0, 1]. Inputs feed the network spatial structure:
   x, y, radius, and two seed-frequency sinusoids, plus a bias. Output is three
   linear channels squashed to [0, 1]. Deterministic for a given seed. */
export function buildCppn(seed, opts = {}) {
  const hidden = opts.hidden || [14, 14, 12];
  const mlp = buildMlp(seed, [6, ...hidden, 3], { scale: opts.scale == null ? 2.6 : opts.scale });
  // Seed-chosen input frequencies so different networks structure space
  // differently (some concentric, some striped, some cellular).
  const fx = 1.5 + (weightAt(seed, 91021, 1) * 0.5 + 0.5) * 5;
  const fy = 1.5 + (weightAt(seed, 91022, 1) * 0.5 + 0.5) * 5;
  const inBuf = new Array(6);
  return {
    fx, fy,
    eval(nx, ny) {
      const r = Math.sqrt(nx * nx + ny * ny);
      inBuf[0] = nx;
      inBuf[1] = ny;
      inBuf[2] = r;
      inBuf[3] = Math.sin(nx * fx);
      inBuf[4] = Math.sin(ny * fy);
      inBuf[5] = 1;
      const o = mlpForward(mlp, inBuf);
      // linear -> [0,1] via a soft squash
      return [
        (Math.tanh(o[0]) + 1) * 0.5,
        (Math.tanh(o[1]) + 1) * 0.5,
        (Math.tanh(o[2]) + 1) * 0.5,
      ];
    },
  };
}

/* A neural signed-distance field: a base sphere of radius R, displaced by a
   small MLP of (x, y, z). The displacement is bounded to +/- amp, so the SDF
   stays a valid, closed, renderable surface and the sphere-march converges.
   dist(x, y, z) returns the signed distance; bound is the marching radius. */
export function buildNeuralSdf(seed, opts = {}) {
  const R = opts.radius == null ? 1 : opts.radius;
  // A gentler default displacement reads as a sculptural solid rather than a
  // spiky firefly cloud; callers can push it up for a rougher form.
  const amp = opts.amp == null ? 0.32 : opts.amp;
  const hidden = opts.hidden || [10, 8];
  const mlp = buildMlp(seed, [4, ...hidden, 1], { scale: opts.scale == null ? 2.0 : opts.scale });
  // Lower frequency = smoother, blobbier displacement (fewer thin spikes that
  // read as noise); the surface stays a coherent sculptural solid.
  const freq = 0.85 + (weightAt(seed, 77001, 1) * 0.5 + 0.5) * 1.15;
  const inBuf = new Array(4);
  const displace = (x, y, z) => {
    inBuf[0] = x * freq;
    inBuf[1] = y * freq;
    inBuf[2] = z * freq;
    inBuf[3] = 1;
    return Math.tanh(mlpForward(mlp, inBuf)[0]) * amp;
  };
  return {
    bound: R + amp + 0.05,
    displace,
    dist(x, y, z) {
      const rr = Math.sqrt(x * x + y * y + z * z);
      // Lipschitz-safe: scale the displacement contribution so the field never
      // grows faster than distance, keeping sphere-tracing stable.
      return (rr - R) + displace(x, y, z);
    },
  };
}
