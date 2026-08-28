// fractal.js: zero-dep escape-time fractals for the Studio.
// Mandelbrot (smooth + orbit-trap glow), Julia, Burning Ship.
// Renders into a canvas via a typed-array + putImageData (single call).
// Deep-zoom presets from project-docs/research/fractal-studio/fractal-math.md
// Palettes from project-docs/research/fractal-studio/aesthetics-digest.md

const LOG2 = Math.log(2);
// Bailout R=256 (R^2=65536), needed for the smooth-coloring formula to be accurate.
const BAILOUT = 256;
const BAILOUT2 = BAILOUT * BAILOUT;

// ── Core math ──────────────────────────────────────────────────────────────

// Standard Mandelbrot escape-time. bailout param kept for test compat; internal
// renders use BAILOUT=256 for smooth coloring.
export function escapeTime(cre, cim, maxIter, bailout = 4) {
  let zr = 0, zi = 0, n = 0;
  const b2 = bailout * bailout;
  while (n < maxIter && zr * zr + zi * zi <= b2) {
    const t = zr * zr - zi * zi + cre;
    zi = 2 * zr * zi + cim;
    zr = t;
    n++;
  }
  return { n, zr, zi };
}

// Smooth (normalized) iteration count, which eliminates integer banding.
// Formula: n + 1 - log(log|z|) / log2  (Quilez / van Nieuwpoort).
// Returns n unchanged if |z| <= 1 or non-finite (interior / edge cases).
export function smoothMu(n, zr, zi) {
  const m = Math.sqrt(zr * zr + zi * zi);
  if (m <= 1 || !Number.isFinite(m)) return n;
  return n + 1 - Math.log(Math.log(m)) / LOG2;
}

// ── Iteration kernels ──────────────────────────────────────────────────────

function iterMandelbrot(cre, cim, maxIter) {
  let zr = 0, zi = 0, n = 0;
  // Also track derivative dz for DE glow (Cheritat / Robert Munafo).
  let dre = 1, dim = 0;
  let trap = Infinity;                       // cross orbit trap: min(|re|,|im|)
  while (n < maxIter && zr * zr + zi * zi <= BAILOUT2) {
    // Update derivative: dz_{n+1} = 2*z_n*dz_n + 1
    const dre2 = 2 * (zr * dre - zi * dim) + 1;
    const dim2 = 2 * (zr * dim + zi * dre);
    dre = dre2; dim = dim2;
    // Update z: z_{n+1} = z_n^2 + c
    const t = zr * zr - zi * zi + cre;
    zi = 2 * zr * zi + cim;
    zr = t;
    // Cross orbit trap (aesthetics-digest §4, "single highest-leverage technique")
    const t2 = Math.min(Math.abs(zr), Math.abs(zi));
    if (t2 < trap) trap = t2;
    n++;
  }
  return { n, zr, zi, dre, dim, trap };
}

function iterJulia(x, y, jx, jy, maxIter) {
  let zr = x, zi = y, n = 0;
  let trap = Infinity;
  while (n < maxIter && zr * zr + zi * zi <= BAILOUT2) {
    const t = zr * zr - zi * zi + jx;
    zi = 2 * zr * zi + jy;
    zr = t;
    const t2 = Math.min(Math.abs(zr), Math.abs(zi));
    if (t2 < trap) trap = t2;
    n++;
  }
  return { n, zr, zi, dre: 1, dim: 0, trap };
}

function iterBurningShip(cre, cim, maxIter) {
  let zr = 0, zi = 0, n = 0;
  let trap = Infinity;
  while (n < maxIter && zr * zr + zi * zi <= BAILOUT2) {
    const ar = Math.abs(zr), ai = Math.abs(zi);
    const t = ar * ar - ai * ai + cre;
    zi = 2 * ar * ai + cim;
    zr = t;
    const t2 = Math.min(Math.abs(zr), Math.abs(zi));
    if (t2 < trap) trap = t2;
    n++;
  }
  return { n, zr, zi, dre: 1, dim: 0, trap };
}

// ── Palettes ────────────────────────────────────────────────────────────────
// From aesthetics-digest.md, all 4+ ramps as [r,g,b] stop arrays.

// Ramp 1, Ember (deep zoom fractals, high contrast)
const PAL_EMBER = [
  [0x0d,0x02,0x08], [0x3b,0x0a,0x1f], [0x8b,0x1a,0x2e],
  [0xe0,0x5a,0x1a], [0xf7,0xc5,0x50], [0xff,0xfb,0xe8],
];

// Ramp 2, Ocean Trench (deep zoom, calm + structural; best for minibrots)
const PAL_OCEAN = [
  [0x00,0x08,0x10], [0x00,0x22,0x44], [0x00,0x44,0x88],
  [0x00,0x77,0xb6], [0x00,0xb4,0xd8], [0xca,0xf0,0xf8],
];

// Ramp 4, Dusk Plasma (versatile; fractal boundary sings in violet-magenta zone)
const PAL_DUSK = [
  [0x0b,0x00,0x26], [0x2d,0x00,0x4e], [0x7b,0x00,0x80],
  [0xc7,0x32,0x80], [0xf7,0x8c,0x40], [0xff,0xfa,0xaa],
];

// Ramp 6, Bone & Rust (poster, vintage; good for Burning Ship)
const PAL_BONE = [
  [0x1a,0x10,0x08], [0x3d,0x20,0x10], [0x8b,0x45,0x20],
  [0xc0,0x70,0x40], [0xe8,0xc0,0x90], [0xf5,0xea,0xd8],
];

// Ramp 7, Terminal Green (retro; strong for Julia dendrites)
const PAL_TERMINAL = [
  [0x00,0x00,0x00], [0x00,0x18,0x00], [0x00,0x38,0x00],
  [0x00,0x60,0x00], [0x00,0xaa,0x00], [0x88,0xff,0x88],
];

export const PALETTES = {
  ember:    PAL_EMBER,
  ocean:    PAL_OCEAN,
  dusk:     PAL_DUSK,
  bone:     PAL_BONE,
  terminal: PAL_TERMINAL,
};

// Linear-interpolate between stops (cyclic).
function ramp(pal, t) {
  t = ((t % pal.length) + pal.length) % pal.length;
  const i = Math.floor(t) % pal.length;
  const j = (i + 1) % pal.length;
  const f = t - Math.floor(t);
  const a = pal[i], b = pal[j];
  return [
    a[0] + (b[0] - a[0]) * f | 0,
    a[1] + (b[1] - a[1]) * f | 0,
    a[2] + (b[2] - a[2]) * f | 0,
  ];
}

// ── Presets ─────────────────────────────────────────────────────────────────
// Coordinates from fractal-math.md §4 (Mandelbrot deep-zoom targets) and §5/§6
// (Julia constants, Burning Ship). Exact values preserved; confidence labels in
// the source file.

export const PRESETS = [
  // Mandelbrot
  {
    name: "Full Overview",
    type: "mandelbrot",
    cx: -0.75, cy: 0.0,
    scale: 3.5,
    maxIter: 500,
    palette: "ocean",
  },
  {
    name: "Seahorse Valley",
    type: "mandelbrot",
    cx: -0.745067, cy: 0.118346,
    scale: 0.0007,
    maxIter: 800,
    palette: "dusk",
  },
  {
    name: "Seahorse Deep (minibrot)",
    type: "mandelbrot",
    cx: -0.744539761, cy: 0.121724001,
    scale: 6.25e-6,
    maxIter: 2000,
    palette: "ember",
  },
  {
    name: "Elephant Valley",
    type: "mandelbrot",
    cx: 0.2765, cy: -0.0065,
    scale: 0.0003,
    maxIter: 1000,
    palette: "ocean",
  },
  {
    name: "Misiurewicz Hub",
    type: "mandelbrot",
    cx: -0.7436438870371587, cy: 0.1318259042053119,
    scale: 1e-4,
    maxIter: 1500,
    palette: "dusk",
  },
  {
    name: "Feigenbaum Point",
    type: "mandelbrot",
    cx: -1.401155189, cy: 0.0,
    scale: 1e-6,
    maxIter: 2000,
    palette: "ember",
  },
  {
    name: "Period-3 Bulb",
    type: "mandelbrot",
    cx: -0.1226, cy: 0.7449,
    scale: 0.005,
    maxIter: 500,
    palette: "dusk",
  },
  {
    name: "Triple Spiral",
    type: "mandelbrot",
    cx: -0.088, cy: 0.654,
    scale: 0.004,
    maxIter: 1000,
    palette: "ember",
  },
  {
    name: "Period-2 Minibrot",
    type: "mandelbrot",
    cx: -1.7499892, cy: 0.0,
    scale: 0.0001,
    maxIter: 2000,
    palette: "ocean",
  },
  {
    name: "Double Spiral",
    type: "mandelbrot",
    cx: -0.74543, cy: 0.11301,
    scale: 5e-5,
    maxIter: 1500,
    palette: "dusk",
  },
  // Julia sets: c values from fractal-math.md §5 (MathWorld + Wikibooks)
  {
    name: "Julia: Douady Rabbit",
    type: "julia",
    cx: 0, cy: 0,
    scale: 4.0,
    maxIter: 300,
    jx: -0.122561166876654, jy: 0.744861766619744,
    palette: "dusk",
  },
  {
    name: "Julia: San Marco",
    type: "julia",
    cx: 0, cy: 0,
    scale: 4.0,
    maxIter: 300,
    jx: -0.75, jy: 0.0,
    palette: "ocean",
  },
  {
    name: "Julia: Basilica",
    type: "julia",
    cx: 0, cy: 0,
    scale: 4.0,
    maxIter: 300,
    jx: -1.0, jy: 0.0,
    palette: "ember",
  },
  {
    name: "Julia: Airplane",
    type: "julia",
    cx: 0, cy: 0,
    scale: 4.0,
    maxIter: 300,
    jx: -1.75487766624669276, jy: 0.0,
    palette: "ocean",
  },
  {
    name: "Julia: Siegel Disk",
    type: "julia",
    cx: 0, cy: 0,
    scale: 4.0,
    maxIter: 500,
    jx: -0.3905407802, jy: -0.5867879073,
    palette: "dusk",
  },
  {
    name: "Julia: Dendrite",
    type: "julia",
    cx: 0, cy: 0,
    scale: 4.0,
    maxIter: 300,
    jx: 0.0, jy: 1.0,
    palette: "terminal",
  },
  // Burning Ship: fractal-math.md §6
  {
    name: "Burning Ship: Hull",
    type: "burningship",
    cx: -0.5, cy: -0.5,
    scale: 0.5,
    maxIter: 500,
    palette: "bone",
  },
  {
    name: "Burning Ship: Sails",
    type: "burningship",
    cx: -1.762, cy: -0.028,
    scale: 0.002,
    maxIter: 1000,
    palette: "ember",
  },
];

// ── Renderer ─────────────────────────────────────────────────────────────────

export function renderFractal(canvas, opts) {
  const {
    type = "mandelbrot",
    cx = -0.5, cy = 0,
    scale = 3.5,
    maxIter = 300,
    palette = "ocean",
    jx = -0.8, jy = 0.156,
  } = opts || {};

  const pal = PALETTES[palette] || PAL_OCEAN;
  const W = canvas.width, H = canvas.height;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  const aspect = H / W;

  // Use Uint32Array for single 4-byte write per pixel (ABGR little-endian).
  const buf = new Uint8ClampedArray(W * H * 4);
  const buf32 = new Uint32Array(buf.buffer);

  // Orbit-trap glow: cross trap (aesthetics-digest "make it special" move #3)
  // at 30% opacity blended over smooth-coloring base.
  const TRAP_OPACITY = 0.30;

  for (let py = 0; py < H; py++) {
    // Burning Ship: negate im (Wikipedia: "virtually all images reflected vertically")
    const flipY = type === "burningship" ? -1 : 1;
    const y0 = cy + flipY * (py / H - 0.5) * scale * aspect;

    for (let px = 0; px < W; px++) {
      const x0 = cx + (px / W - 0.5) * scale;

      let r;
      if (type === "julia")        r = iterJulia(x0, y0, jx, jy, maxIter);
      else if (type === "burningship") r = iterBurningShip(x0, y0, maxIter);
      else                          r = iterMandelbrot(x0, y0, maxIter);

      const idx = py * W + px;

      if (r.n >= maxIter) {
        // Interior: black
        buf32[idx] = 0xff000000;
      } else {
        // Smooth coloring (R=256 bailout used in iter kernels)
        const r2 = r.zr * r.zr + r.zi * r.zi;
        const log_r = Math.log(r2) * 0.5;            // log|z|
        const mu = r.n - Math.log(log_r / Math.LN2) / Math.LN2;

        // Base color from smooth mu (cycle over palette length * 8 for visual density)
        const c = ramp(pal, mu / 8);

        // Orbit-trap cross glow (TRAP_OPACITY over base)
        const glowStrength = Math.exp(-r.trap * 4) * TRAP_OPACITY;
        // Glow tint: lightest stop of the palette
        const g2 = pal[pal.length - 1];
        const cr = (c[0] * (1 - glowStrength) + g2[0] * glowStrength) | 0;
        const cg = (c[1] * (1 - glowStrength) + g2[1] * glowStrength) | 0;
        const cb = (c[2] * (1 - glowStrength) + g2[2] * glowStrength) | 0;

        // ABGR on little-endian
        buf32[idx] = (0xff << 24) | (cb << 16) | (cg << 8) | cr;
      }
    }
  }

  const imgData = new ImageData(buf, W, H);
  g.putImageData(imgData, 0, 0);
}
