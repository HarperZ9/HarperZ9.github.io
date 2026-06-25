// reactive-visuals.js
// The visual rendering engine for the music-reactive experience.
// Zero external dependencies. Pure Canvas2D + a small OKLab helper inline.
//
// MODES (window.ReactiveVisuals.setMode(name)):
//   "particles"    Spring/flocking particle system (beat kicks, bass drives force)
//   "attractor"    Strange attractor tracer (Clifford / de Jong / Lorenz 2D projection)
//   "harmonograph" Lissajous / harmonograph parametric curves (chroma modulates freq ratios)
//   "flowfield"    Curl noise flow field with particles (centroid steers noise phase)
//   "spectrum"     Frequency spectrum bars with perceptual color mapping
//
// All modes react to live audio features. When audio is quiescent (level ~ 0) the
// visuals settle to a calm idle state; nothing fakes motion.
//
// COLOR SCIENCE: perceptual palettes via OKLab/OKLCH (Ottosson 2020).
// Smooth hue interpolation in OKLab space avoids the sRGB hue-shift problem.
// Color harmony: chroma-driven analogous / triadic schemes.
//
// REFERENCES:
//   Clifford attractor: Pickover, C.A. "Computers, Pattern, Chaos and Beauty" (1990)
//   De Jong attractor: de Jong, P. "Playing with Chaos" (1991 Scientific American demo)
//   Lorenz 1963 system: Lorenz, E.N. J. Atmos. Sci. 20(2), 130-141 (1963)
//   Lissajous / harmonograph: Jules Lissajous 1857; bit-101 Coding Curves series
//   Flow field / curl noise: Bridson, R. (2007); Perlin noise flow: Shiffman (The Coding Train)
//   OKLab color space: Ottosson, B. (2020) https://bottosson.github.io/posts/oklab/
//   Superformula: Gielis, J. Am. J. Bot. 90(3), 333-338 (2003)

// ---------------------------------------------------------------------------
// Tiny OKLab / OKLCH helpers (self-contained; no import of colour-perceptual.mjs
// needed since reactive-visuals.js runs in the browser context).
// ---------------------------------------------------------------------------

// sRGB byte [0..255] -> linear [0..1]
function _srgbToLinear(c) {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

// Linear sRGB -> OKLab [L, a, b]
const M1 = [[0.4122214708,0.5363325363,0.0514459929],[0.2119034982,0.6806995451,0.1073969566],[0.0883024619,0.2817188376,0.6299787005]];
const M2 = [[0.2104542553,0.793617785,-0.0040720468],[1.9779984951,-2.428592205,0.4505937099],[0.0259040371,0.7827717662,-0.808675766]];
function _linRgbToOklab(r, g, b) {
  const l = M1[0][0]*r+M1[0][1]*g+M1[0][2]*b, m = M1[1][0]*r+M1[1][1]*g+M1[1][2]*b, s = M1[2][0]*r+M1[2][1]*g+M1[2][2]*b;
  const l_=Math.cbrt(l), m_=Math.cbrt(m), s_=Math.cbrt(s);
  return [M2[0][0]*l_+M2[0][1]*m_+M2[0][2]*s_, M2[1][0]*l_+M2[1][1]*m_+M2[1][2]*s_, M2[2][0]*l_+M2[2][1]*m_+M2[2][2]*s_];
}

// OKLab [L, a, b] -> sRGB hex string (clamped)
const IM2 = [[1.0,0.3963377774,0.2158037573],[1.0,-0.1055613458,-0.0638541728],[1.0,-0.0894841775,-1.291485548]];
const IM1 = [[4.0767416621,-3.3077115913,0.2309699292],[-1.2684380046,2.6097574011,-0.3413193965],[-0.0041960863,-0.7034186147,1.707614701]];
function _oklabToLinRgb(L, a, b) {
  const l_=IM2[0][0]*L+IM2[0][1]*a+IM2[0][2]*b, m_=IM2[1][0]*L+IM2[1][1]*a+IM2[1][2]*b, s_=IM2[2][0]*L+IM2[2][1]*a+IM2[2][2]*b;
  const l=l_*l_*l_, m=m_*m_*m_, s=s_*s_*s_;
  return [IM1[0][0]*l+IM1[0][1]*m+IM1[0][2]*s, IM1[1][0]*l+IM1[1][1]*m+IM1[1][2]*s, IM1[2][0]*l+IM1[2][1]*m+IM1[2][2]*s];
}
function _linearToSrgb(c) { return c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055; }
function _byteClamp(v) { return Math.max(0, Math.min(255, Math.round(v*255))); }

// Convert OKLCH (L in [0,1], C in [0,0.4], H in degrees) -> CSS rgba string.
export function oklchToRgba(L, C, H, alpha) {
  const hRad = H * Math.PI / 180;
  const a = C * Math.cos(hRad), b = C * Math.sin(hRad);
  const [lr, lg, lb] = _oklabToLinRgb(L, a, b);
  const r = _byteClamp(_linearToSrgb(lr)), g = _byteClamp(_linearToSrgb(lg)), bb = _byteClamp(_linearToSrgb(lb));
  return `rgba(${r},${g},${bb},${(alpha === undefined ? 1 : alpha).toFixed(3)})`;
}

// Interpolate two OKLCH values in OKLab space (perceptually uniform).
export function lerpOklch(L1, C1, H1, L2, C2, H2, t) {
  const h1r = H1 * Math.PI / 180, h2r = H2 * Math.PI / 180;
  const a1 = C1*Math.cos(h1r), b1 = C1*Math.sin(h1r);
  const a2 = C2*Math.cos(h2r), b2 = C2*Math.sin(h2r);
  const L = L1 + (L2-L1)*t, a = a1 + (a2-a1)*t, bv = b1 + (b2-b1)*t;
  const C = Math.hypot(a, bv);
  const H = ((Math.atan2(bv, a) * 180 / Math.PI) + 360) % 360;
  return [L, C, H];
}

// Build an analogous palette around a base hue in OKLCH space.
// Returns an array of { L, C, H } entries.
export function analogousPalette(baseH, n, spread, L, C) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? (i / (n-1) - 0.5) : 0;
    out.push({ L: L || 0.65, C: C || 0.18, H: ((baseH + t * spread) + 360) % 360 });
  }
  return out;
}

// Triadic palette (three hues, 120 degrees apart).
export function triadicPalette(baseH, L, C) {
  return [0, 120, 240].map(d => ({ L: L||0.65, C: C||0.18, H: (baseH+d)%360 }));
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function mod(v, m) { return ((v % m) + m) % m; }

// Fade the canvas with a semi-transparent overlay (creates trail effect).
function fadeCanvas(ctx, w, h, alpha) {
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

// Fill canvas with the Studio void color with a given opacity (for clean clear or overlay).
function fillVoid(ctx, w, h, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha !== undefined ? alpha : 1;
  ctx.fillStyle = "#0d1b1c";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Noise: a simple gradient-permutation noise (Perlin-style, zero-dependency).
// Based on the classical Perlin noise construction (Ken Perlin 1983 / improved 2002).
// ---------------------------------------------------------------------------
const _perm = new Uint8Array(512);
(function initNoise() {
  const p = new Uint8Array(256);
  // Deterministic permutation (no Math.random, matches the "pure" requirement for tests).
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates with an LCG for reproducibility (seed: 0xDEAD)
  let state = 0xDEAD;
  for (let i = 255; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
})();
function _fade(t) { return t*t*t*(t*(t*6-15)+10); }
function _grad2(hash, x, y) {
  switch (hash & 3) {
    case 0: return  x + y;
    case 1: return -x + y;
    case 2: return  x - y;
    case 3: return -x - y;
    default: return 0;
  }
}
export function noise2(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = _fade(xf), v = _fade(yf);
  const aa = _perm[_perm[X]+Y], ab = _perm[_perm[X]+Y+1];
  const ba = _perm[_perm[X+1]+Y], bb = _perm[_perm[X+1]+Y+1];
  const x1 = lerp(_grad2(aa,xf,yf), _grad2(ba,xf-1,yf), u);
  const x2 = lerp(_grad2(ab,xf,yf-1), _grad2(bb,xf-1,yf-1), u);
  return lerp(x1, x2, v);  // [-1, 1]
}

// Curl of a 2D noise field (Bridson 2007). Returns [dx, dy] force direction.
// curl(N) = [dN/dy, -dN/dx] (the perpendicular gradient).
export function curlNoise2(x, y, eps) {
  const e = eps || 0.01;
  const nx = (noise2(x, y+e) - noise2(x, y-e)) / (2*e);
  const ny = -(noise2(x+e, y) - noise2(x-e, y)) / (2*e);
  return [nx, ny];
}

// ---------------------------------------------------------------------------
// MODE: Spectrum bars
// ---------------------------------------------------------------------------
let _specBars = null;
function initSpectrum() { _specBars = null; }

function drawSpectrum(ctx, w, h, features, params, opts) {
  const palette = opts.palette || { L: 0.65, C: 0.2 };
  const nBands = 64;
  // Build a simple magnitude spectrum from the features bands (interpolated)
  // We don't have raw FFT here but we can create a visually compelling spectrum
  // from the three bands + level by distributing energy.
  const barW = w / nBands;
  const intensity = params.intensity;
  const pulse = params.pulse;

  fillVoid(ctx, w, h, 0.18 + pulse * 0.3);

  for (let i = 0; i < nBands; i++) {
    const t = i / (nBands - 1);
    // Approximate band energy: low bins from bass, mid from mid, high from treble
    let energy;
    if (t < 0.25) energy = features.bass * (1 - t/0.25) + features.mid * (t/0.25);
    else if (t < 0.6) energy = features.mid * (1 - (t-0.25)/0.35) + features.treble * ((t-0.25)/0.35);
    else energy = features.treble * (1 - (t-0.6)/0.4);
    energy = clamp(energy * (1 + intensity * 0.5), 0, 1);

    // Beat flash
    if (pulse > 0.4) energy = clamp(energy + pulse * 0.3, 0, 1);

    const barH = energy * h * 0.85;
    const hue = (params.hue + t * 120 * (1 + params.hueShift)) % 360;
    const L = 0.55 + energy * 0.2;
    const C = palette.C + energy * 0.12;

    // Reflected bars (top and bottom mirror) for visual symmetry
    const color = oklchToRgba(L, C, hue, 0.85);
    ctx.fillStyle = color;
    // Bottom-up bar
    ctx.fillRect(i * barW, h - barH, barW - 1, barH);
    // Mirror top bar (softer)
    ctx.fillStyle = oklchToRgba(L - 0.1, C * 0.6, hue, 0.4);
    ctx.fillRect(i * barW, 0, barW - 1, barH * 0.4);
  }

  // Beat flash overlay
  if (pulse > 0.6) {
    const flashAlpha = (pulse - 0.6) * 0.18;
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = oklchToRgba(0.9, 0.08, params.hue, 1);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// MODE: Particle spring system
// ---------------------------------------------------------------------------
const MAX_PARTICLES = 280;
const _particles = [];
let _particlesInited = false;

function initParticles(w, h) {
  _particles.length = 0;
  const n = Math.min(MAX_PARTICLES, Math.floor(w * h / 4000) + 80);
  for (let i = 0; i < n; i++) {
    _particles.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      hue: Math.random() * 360, L: 0.6, C: 0.18,
      size: 1.5 + Math.random() * 2.5, life: 1, maxLife: 1,
      // Spring home position
      hx: Math.random() * w, hy: Math.random() * h,
    });
  }
  _particlesInited = true;
}

// Spawn a burst of particles at a random point on onset.
function spawnBurst(w, h, params, n) {
  const cx = w * (0.2 + Math.random() * 0.6);
  const cy = h * (0.2 + Math.random() * 0.6);
  const count = Math.min(n || 20, MAX_PARTICLES - _particles.length + 30);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6 * params.pulse;
    _particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      hue: params.hue + (Math.random() - 0.5) * 60,
      L: 0.7 + Math.random() * 0.15, C: 0.2 + params.intensity * 0.1,
      size: 2 + Math.random() * 3,
      life: 1, maxLife: 1,
      hx: cx + (Math.random()-0.5)*w*0.3, hy: cy + (Math.random()-0.5)*h*0.3,
    });
  }
  // Trim to max
  while (_particles.length > MAX_PARTICLES) _particles.shift();
}

function drawParticles(ctx, w, h, features, params, opts, t) {
  if (!_particlesInited || _particles.length === 0) {
    initParticles(w, h);
  }

  // Fade trail
  fillVoid(ctx, w, h, 0.05 + params.pulse * 0.08);

  const bass = features.bass;
  const intensity = params.intensity;
  const highMod = params.highMod;

  // Beat spawns a burst
  if (params.pulse > 0.5) {
    spawnBurst(w, h, params, Math.floor(12 * params.pulse));
  }

  // Flocking / spring update
  // Separation, cohesion (very cheap: only nearest neighbor via grid is expensive,
  // so we use a simplified global center of mass + per-particle spring).
  let cx = 0, cy = 0;
  for (let i = 0; i < _particles.length; i++) { cx += _particles[i].x; cy += _particles[i].y; }
  cx /= _particles.length; cy /= _particles.length;

  for (let i = 0; i < _particles.length; i++) {
    const p = _particles[i];

    // Spring toward home position (damped harmonic oscillator)
    const kSpring = 0.004 + intensity * 0.006;
    const damping = 0.96 - bass * 0.02;
    p.vx += (p.hx - p.x) * kSpring;
    p.vy += (p.hy - p.y) * kSpring;

    // Cohesion: gentle pull toward center of mass
    p.vx += (cx - p.x) * 0.0003 * (1 - bass);
    p.vy += (cy - p.y) * 0.0003 * (1 - bass);

    // Bass drives an upward/radial kick
    p.vy -= bass * 0.8 * (Math.random() - 0.5);
    p.vx += bass * 0.8 * (Math.random() - 0.5);

    // High-freq treble adds jitter
    if (highMod > 0.3) {
      p.vx += (Math.random() - 0.5) * highMod * 0.5;
      p.vy += (Math.random() - 0.5) * highMod * 0.5;
    }

    p.vx *= damping;
    p.vy *= damping;
    p.x += p.vx;
    p.y += p.vy;

    // Wrap around edges
    if (p.x < 0) { p.x += w; p.hx = Math.random() * w; }
    if (p.x > w) { p.x -= w; p.hx = Math.random() * w; }
    if (p.y < 0) { p.y += h; p.hy = Math.random() * h; }
    if (p.y > h) { p.y -= h; p.hy = Math.random() * h; }

    // Hue drifts slowly with chroma
    p.hue = lerp(p.hue, params.hue + (i / _particles.length) * 80, 0.01);
    const L = p.L + params.hueShift * 0.1;
    const C = p.C + intensity * 0.06;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1 + intensity * 0.4), 0, Math.PI * 2);
    ctx.fillStyle = oklchToRgba(clamp(L, 0.3, 0.9), clamp(C, 0, 0.3), p.hue % 360, 0.7);
    ctx.fill();
  }

  // Beat flash
  if (params.pulse > 0.65) {
    ctx.save();
    ctx.globalAlpha = (params.pulse - 0.65) * 0.2;
    ctx.fillStyle = oklchToRgba(0.85, 0.12, params.hue, 1);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// MODE: Strange attractor
// ---------------------------------------------------------------------------
// Three attractor types: clifford, dejong, lorenz2d.
// Ref: Clifford Pickover "Computers, Pattern, Chaos and Beauty" (1990);
//      de Jong 1991; Lorenz J.Atmos.Sci. 20, 130-141 (1963).

let _attrState = null;

function initAttractor(type) {
  const base = { type: type || "clifford", x: 0.1, y: 0.1, z: 0.1, count: 0 };
  if (type === "lorenz2d") Object.assign(base, { x: 1, y: 1, z: 1 });
  _attrState = base;
}

// Clifford: x' = sin(a*y)+c*cos(a*x), y' = sin(b*x)+d*cos(b*y)
// Parameters driven by audio features.
function cliffordStep(state, a, b, c, d) {
  const nx = Math.sin(a * state.y) + c * Math.cos(a * state.x);
  const ny = Math.sin(b * state.x) + d * Math.cos(b * state.y);
  state.x = nx; state.y = ny;
}

// de Jong: x' = sin(a*y)-cos(b*x), y' = sin(c*x)-cos(d*y)
function dejongStep(state, a, b, c, d) {
  const nx = Math.sin(a * state.y) - Math.cos(b * state.x);
  const ny = Math.sin(c * state.x) - Math.cos(d * state.y);
  state.x = nx; state.y = ny;
}

// Lorenz projected to XY (the famous butterfly). Euler integration with small dt.
// sigma=10, rho=28, beta=8/3 are the classic parameters for chaos.
function lorenzStep(state, dt, sigma, rho, beta) {
  const dx = sigma * (state.y - state.x);
  const dy = state.x * (rho - state.z) - state.y;
  const dz = state.x * state.y - beta * state.z;
  state.x += dx * dt; state.y += dy * dt; state.z += dz * dt;
}

function drawAttractor(ctx, w, h, features, params, opts, t) {
  const type = opts.attractorType || "clifford";
  if (!_attrState || _attrState.type !== type) initAttractor(type);

  // Semi-transparent overlay for trailing effect
  fillVoid(ctx, w, h, 0.02 + params.pulse * 0.06);

  const intensity = params.intensity;
  const centroid = features.centroid;
  const hue = params.hue;

  // Modulate attractor parameters with audio
  // Clifford params: a,b in [-2,2], c,d in [-1,1]
  const a = 1.7 + features.bass * 0.5 - 0.3 * Math.sin(t * 0.07);
  const b = 1.7 + features.treble * 0.4 - 0.2 * Math.cos(t * 0.05);
  const c = -0.5 + features.mid * 0.4 + 0.3 * Math.sin(t * 0.11);
  const d = 0.7 + features.level * 0.3 - 0.2 * Math.cos(t * 0.09);

  // Iterations per frame: scale with intensity for richer lines when loud
  const iters = Math.floor(800 + intensity * 1200 + params.pulse * 600);

  // Scale + center
  let scaleX = w * 0.38, scaleY = h * 0.38;
  let offX = w * 0.5, offY = h * 0.5;
  if (type === "lorenz2d") { scaleX = w * 0.04; scaleY = h * 0.035; offX = w*0.5; offY = h*0.5; }

  const dt = 0.006 + intensity * 0.003;

  for (let i = 0; i < iters; i++) {
    if (type === "clifford") cliffordStep(_attrState, a, b, c, d);
    else if (type === "dejong") dejongStep(_attrState, a, b, c, d);
    else if (type === "lorenz2d") lorenzStep(_attrState, dt, 10, 28, 8/3);

    const px = _attrState.x * scaleX + offX;
    const py = _attrState.y * scaleY + offY;

    // Perceptual hue: index along the attractor path + audio hue shift
    const colorT = (i / iters);
    const H = (hue + colorT * 180 * (1 + params.hueShift * 2)) % 360;
    const L = 0.55 + colorT * 0.2 + intensity * 0.1;
    const C = 0.12 + centroid * 0.1 + params.highMod * 0.08;

    ctx.fillStyle = oklchToRgba(clamp(L, 0.35, 0.9), clamp(C, 0, 0.3), H, 0.25 + intensity * 0.2);
    ctx.fillRect(px, py, 1.2, 1.2);
  }

  // Beat flash: momentarily brighten
  if (params.pulse > 0.55) {
    ctx.save();
    ctx.globalAlpha = (params.pulse - 0.55) * 0.22;
    ctx.fillStyle = oklchToRgba(0.9, 0.08, hue, 1);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// MODE: Harmonograph / Lissajous
// ---------------------------------------------------------------------------
// The harmonograph is a mechanical device that draws Lissajous-like curves using
// two pendulums. Its parametric equations:
//   x(t) = A1*sin(f1*t+p1)*exp(-d1*t) + A2*sin(f2*t+p2)*exp(-d2*t)
//   y(t) = A3*sin(f3*t+p3)*exp(-d3*t) + A4*sin(f4*t+p4)*exp(-d4*t)
// Ref: bit-101 "Coding Curves 05: Harmonographs" 2022
// Audio modulates frequency ratios and phase, chroma selects the ratio family.

let _harmAngle = 0;

function drawHarmonograph(ctx, w, h, features, params, opts, t) {
  // Fade gently for trailing effect
  fillVoid(ctx, w, h, 0.012 + params.pulse * 0.05);

  const intensity = params.intensity;
  const hue = params.hue;
  const chromaClass = features.chroma ? features.chroma : new Array(12).fill(0);

  // Select frequency ratio family based on dominant chroma class (musical interval)
  // 12 pitch classes -> 6 simple harmonic ratios (octave/fifth/fourth/third/...)
  const RATIOS = [
    [1, 1],   // C  unison
    [9, 8],   // C# major second
    [6, 5],   // D  minor third
    [5, 4],   // D# major third
    [4, 3],   // E  perfect fourth
    [3, 2],   // F  perfect fifth
    [5, 3],   // F# major sixth
    [7, 4],   // G  harmonic seventh
    [2, 1],   // G# octave
    [9, 5],   // A  major ninth
    [5, 2],   // A# compound third
    [3, 1],   // B  twelfth
  ];
  let pc = 0, pcMax = -1;
  for (let i = 0; i < 12; i++) if (chromaClass[i] > pcMax) { pcMax = chromaClass[i]; pc = i; }
  const [rn, rd] = RATIOS[pc % RATIOS.length];
  const ratio = rn / rd;

  // Pendulum frequencies: audio-modulated slight detuning creates Lissajous beating
  const f1 = 1 + features.bass * 0.05;
  const f2 = ratio + features.treble * 0.03;
  const f3 = 1 + features.mid * 0.04;
  const f4 = ratio + features.centroid * 0.06;

  // Damping: audible energy keeps curves alive, silence lets them decay
  const damp = 0.00005 + (1 - params.intensity) * 0.0001;

  // Steps: more when louder
  const steps = Math.floor(6000 + intensity * 8000 + params.pulse * 3000);
  const scale = Math.min(w, h) * 0.44;

  // Phase offset drifts with time + bass
  const phase1 = _harmAngle + features.bass * 0.8;
  const phase2 = _harmAngle * 0.71 + features.treble * 0.5;
  _harmAngle += 0.003 + features.level * 0.008;

  // Perceptual color gradient along the curve using OKLab interpolation
  const pal1 = { L: 0.65, C: 0.2, H: hue };
  const pal2 = { L: 0.55, C: 0.15, H: (hue + 120 + params.hueShift * 60) % 360 };

  ctx.beginPath();
  let firstPt = true;
  for (let i = 0; i < steps; i++) {
    const s = i / steps;
    const tt = s * 120;  // parametric time (long enough for multiple cycles)
    const decay = Math.exp(-damp * tt);
    if (decay < 0.001) break;

    const x = (Math.sin(f1*tt + phase1) + Math.sin(f2*tt + phase2)) * scale * decay * 0.5 + w*0.5;
    const y = (Math.sin(f3*tt + phase1*1.3) + Math.sin(f4*tt + phase2*0.7)) * scale * decay * 0.5 + h*0.5;

    if (firstPt) { ctx.moveTo(x, y); firstPt = false; }
    else ctx.lineTo(x, y);

    // Color update every N steps (avoid per-point color calls)
    if (i % 120 === 0) {
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      const [Lv, Cv, Hv] = lerpOklch(pal1.L, pal1.C, pal1.H, pal2.L, pal2.C, pal2.H, s);
      const alpha = 0.3 + decay * 0.4 + intensity * 0.2;
      ctx.strokeStyle = oklchToRgba(Lv, Cv, Hv, alpha);
      ctx.lineWidth = 0.8 + intensity * 1.2 + params.pulse * 1.0;
    }
  }
  ctx.stroke();

  // Beat flash
  if (params.pulse > 0.6) {
    ctx.save();
    ctx.globalAlpha = (params.pulse - 0.6) * 0.15;
    ctx.fillStyle = oklchToRgba(0.9, 0.06, hue, 1);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// MODE: Flow field with curl noise
// ---------------------------------------------------------------------------
// A grid of flow vectors (curl of a noise field, Bridson 2007) steers particles.
// Audio drives the noise phase offset, creating synchronized pulsing motion.
// Ref: Bridson R., "Fast Poisson Disk Sampling in Arbitrary Dimensions" (2007);
//      Perlin flow field: Shiffman "The Nature of Code" coding challenge #24.

const MAX_FLOW_PARTICLES = 240;
const _flowParticles = [];
let _flowInited = false;
let _flowPhase = 0;

function initFlow(w, h) {
  _flowParticles.length = 0;
  const n = Math.min(MAX_FLOW_PARTICLES, Math.floor(w * h / 5000) + 60);
  for (let i = 0; i < n; i++) {
    _flowParticles.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: 0, vy: 0,
      hue: Math.random() * 360,
      life: Math.random(),
      maxLife: 0.6 + Math.random() * 0.4,
      size: 1.2 + Math.random() * 2,
    });
  }
  _flowInited = true;
}

function drawFlowField(ctx, w, h, features, params, opts, t) {
  if (!_flowInited) initFlow(w, h);

  fillVoid(ctx, w, h, 0.06 + params.pulse * 0.06);

  const intensity = params.intensity;
  const centroid = features.centroid;
  const hue = params.hue;

  // Noise phase: centroid steers the noise landscape, time drifts it
  _flowPhase += 0.003 + features.level * 0.015 + params.pulse * 0.05;
  const scale = 0.003 + centroid * 0.002;

  for (let i = 0; i < _flowParticles.length; i++) {
    const p = _flowParticles[i];

    // Curl noise at particle position drives velocity
    const [fx, fy] = curlNoise2(p.x * scale, p.y * scale + _flowPhase, 0.1);
    const speed = 1.2 + intensity * 2 + features.bass * 1.5;
    p.vx = lerp(p.vx, fx * speed, 0.3);
    p.vy = lerp(p.vy, fy * speed, 0.3);

    // Beat kicks the particle
    if (params.pulse > 0.4) {
      const angle = Math.random() * Math.PI * 2;
      p.vx += Math.cos(angle) * params.pulse * 3;
      p.vy += Math.sin(angle) * params.pulse * 3;
    }

    const prevX = p.x, prevY = p.y;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.004 + (1 - intensity) * 0.003;

    // Respawn when dead or out of bounds
    const dead = p.life <= 0 || p.x < 0 || p.x > w || p.y < 0 || p.y > h;
    if (dead) {
      p.x = Math.random() * w; p.y = Math.random() * h;
      p.vx = 0; p.vy = 0;
      p.life = p.maxLife;
      p.hue = hue + (Math.random() - 0.5) * 80;
      continue;
    }

    // Draw line segment
    const H = (p.hue + params.hueShift * 60) % 360;
    const L = 0.55 + p.life * 0.25 + intensity * 0.1;
    const C = 0.14 + features.treble * 0.08 + intensity * 0.06;
    const alpha = p.life * 0.55 + intensity * 0.15;

    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = oklchToRgba(clamp(L,0.3,0.9), clamp(C,0,0.3), H, clamp(alpha,0,1));
    ctx.lineWidth = p.size * (1 + features.bass * 0.5);
    ctx.stroke();
  }

  // Beat flash
  if (params.pulse > 0.6) {
    ctx.save();
    ctx.globalAlpha = (params.pulse - 0.6) * 0.18;
    ctx.fillStyle = oklchToRgba(0.88, 0.09, hue, 1);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Scalable GPU-particles backend (Stage 1 of the Telos scalable engine).
// The "particles" mode delegates body simulation+rendering to the tiered GPU engine
// (system/engine/gpu-particles.js) when the device can run a WebGPU/WebGL2 rung, off the main
// thread when OffscreenCanvas + workers are available. When the engine cannot run a GPU rung it
// falls all the way down to the EXISTING drawParticles() Canvas2D loop below, byte-for-byte today's
// behavior. The fade-trail and beat-flash overlays stay here (the art layer); only the particle
// bodies move to the engine on capable devices. The engine is loaded lazily and asynchronously so a
// no-engine / engine-load-failure path simply keeps using drawParticles (graceful degradation).
// ---------------------------------------------------------------------------
let _gpuParticles = null;        // the operator handle once initialized
let _gpuStatus = null;           // last status() from the engine ({ tier, backend, mode, count, ... })
let _gpuInitState = "idle";      // "idle" | "loading" | "active" | "cpu" | "disabled"
let _gpuCapability = null;       // probed capability record (set by ReactiveVisuals.setCapability)
let _gpuOverride = "auto";       // tier override from the toolbar
let _gpuLastW = 0, _gpuLastH = 0; // last size synced to the engine (resize only on change)

// Kick off (once) the async load + init of the GPU engine for the particles mode. Non-blocking:
// returns immediately; the first frames run on drawParticles until the engine reports ready, then
// the particles case switches to it. Any failure pins _gpuInitState to "cpu" so we never retry-thrash.
function ensureGpuParticles(canvas, w, h) {
  if (_gpuInitState !== "idle") return;
  if (typeof window === "undefined") { _gpuInitState = "disabled"; return; }
  _gpuInitState = "loading";
  import("./engine/gpu-particles.js")
    .then(async (mod) => {
      const op = mod.createGpuParticles();
      const res = await op.init({
        capability: _gpuCapability,
        canvas,
        width: w,
        height: h,
        override: _gpuOverride,
      });
      _gpuParticles = op;
      _gpuStatus = op.status();
      // If the engine fell to the CPU floor, drop the engine and use the existing drawParticles path
      // (identical to today). The engine only adds value on a GPU rung.
      if (res && (res.mode === "worker" || res.mode === "main-gpu")) {
        _gpuInitState = "active";
      } else {
        try { op.dispose(); } catch (_) {}
        _gpuParticles = null;
        _gpuInitState = "cpu";
      }
      if (typeof window !== "undefined") {
        window.__gpuParticlesStatus = _gpuStatus;
        try { window.dispatchEvent(new CustomEvent("gpu-particles-ready", { detail: _gpuStatus })); } catch (_) {}
      }
    })
    .catch(() => { _gpuInitState = "cpu"; _gpuParticles = null; });
}

// Draw the particles mode through the GPU engine: keep the fade-trail + beat-flash art here, drive
// the bodies via the engine (which composites onto the same canvas). Beats spawn FORCES (pulse) that
// the engine reads; the CPU-mode burst-spawn is replaced by the engine's continuous force model on
// the GPU rungs (the visual reads equivalently: a beat kicks all particles, see the backends).
function drawParticlesGpu(ctx, w, h, features, params, t) {
  // Fade trail (same recipe as drawParticles).
  fillVoid(ctx, w, h, 0.05 + params.pulse * 0.08);
  // Engine steps + renders the bodies and composites onto this canvas.
  if (_gpuParticles) {
    // Resize only on an actual dimension change (avoid posting a resize to the worker every frame).
    if (_gpuParticles.resize && (w !== _gpuLastW || h !== _gpuLastH)) {
      _gpuParticles.resize(w, h);
      _gpuLastW = w; _gpuLastH = h;
    }
    _gpuParticles.drawFrame(features, params, t);
    _gpuStatus = _gpuParticles.status();
    if (typeof window !== "undefined") window.__gpuParticlesStatus = _gpuStatus;
  }
  // Beat flash (same recipe as drawParticles).
  if (params.pulse > 0.65) {
    ctx.save();
    ctx.globalAlpha = (params.pulse - 0.65) * 0.2;
    ctx.fillStyle = oklchToRgba(0.85, 0.12, params.hue, 1);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Public API: ReactiveVisuals
// ---------------------------------------------------------------------------

let _activeMode = "particles";
let _lastW = 0, _lastH = 0;
let _needsReinit = true;

// Palette configuration (can be changed by the user)
let _palette = { L: 0.65, C: 0.2 };

// Attractor sub-type (for attractor mode)
let _attractorType = "clifford";

const MODES = ["particles", "attractor", "harmonograph", "flowfield", "spectrum"];

const ReactiveVisuals = {
  MODES,

  setMode(name) {
    if (!MODES.includes(name)) return;
    if (name !== _activeMode) {
      // Leaving particles: release the GPU engine (the leave3D/dispose discipline) so workers and
      // GPU resources are freed and a later re-entry re-probes cleanly.
      if (_activeMode === "particles" && _gpuParticles) {
        try { _gpuParticles.dispose(); } catch (_) {}
        _gpuParticles = null;
        _gpuInitState = "idle";
        _gpuLastW = 0; _gpuLastH = 0;
      }
      _activeMode = name;
      _needsReinit = true;
    }
  },

  // Stage 1 hooks: studio.js passes the probed capability record and the tier override so the
  // particles mode can pick the right backend. Setting these before particles activates lets the
  // first init use them; changing the override after re-inits the engine on the next mode entry.
  setCapability(cap) { _gpuCapability = cap || null; },
  setTierOverride(override) {
    const next = override || "auto";
    if (next === _gpuOverride) return;
    _gpuOverride = next;
    // Force a clean re-init so the new tier takes effect (dispose any live engine).
    if (_gpuParticles) { try { _gpuParticles.dispose(); } catch (_) {} _gpuParticles = null; }
    _gpuInitState = "idle";
    _gpuLastW = 0; _gpuLastH = 0;
  },
  // Honest status for the toolbar / model readout: which backend, tier, and live count are running,
  // or null when the particles engine is not active (CPU fallback path).
  getGpuStatus() { return _gpuStatus; },

  setAttractorType(type) {
    _attractorType = type;
    _attrState = null;  // force re-init of attractor state
  },

  setPalette(L, C) {
    _palette = { L: clamp(L, 0.3, 0.95), C: clamp(C, 0, 0.4) };
  },

  // Draw one frame. Called from the reactive rAF loop.
  // canvas: the #studio-canvas element
  // features: audio feature frame from reactive.js
  // params: visual params from applyMapping
  // t: elapsed seconds
  draw(canvas, features, params, t) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;

    // Reinit on canvas resize or mode change
    if (w !== _lastW || h !== _lastH || _needsReinit) {
      _lastW = w; _lastH = h;
      _needsReinit = false;
      _particlesInited = false;
      _flowInited = false;
      _attrState = null;
      // Fill void on reinit so the canvas isn't transparent black
      fillVoid(ctx, w, h, 1);
    }

    const opts = { palette: _palette, attractorType: _attractorType };

    switch (_activeMode) {
      case "particles":
        // Stage 1: route the bodies through the tiered GPU engine when it is active; otherwise the
        // existing Canvas2D drawParticles loop (byte-identical to today) is the guaranteed fallback.
        ensureGpuParticles(canvas, w, h);
        if (_gpuInitState === "active" && _gpuParticles) {
          drawParticlesGpu(ctx, w, h, features, params, t);
        } else {
          drawParticles(ctx, w, h, features, params, opts, t);
        }
        break;
      case "attractor":
        drawAttractor(ctx, w, h, features, params, opts, t);
        break;
      case "harmonograph":
        drawHarmonograph(ctx, w, h, features, params, opts, t);
        break;
      case "flowfield":
        drawFlowField(ctx, w, h, features, params, opts, t);
        break;
      case "spectrum":
        drawSpectrum(ctx, w, h, features, params, opts);
        break;
      default:
        drawParticles(ctx, w, h, features, params, opts, t);
    }
  },

  // Quiescent idle: draw a subtle breathing animation when audio is stopped.
  // Called by the Studio when the mode is active but no audio is playing.
  drawIdle(canvas, t) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;
    fillVoid(ctx, w, h, 0.04);
    // Soft pulsing dot
    const r = 8 + 4 * Math.sin(t * 0.8);
    ctx.beginPath();
    ctx.arc(w/2, h/2, r, 0, Math.PI*2);
    ctx.fillStyle = oklchToRgba(0.5, 0.05, 200, 0.3);
    ctx.fill();
  },
};

if (typeof window !== "undefined") window.ReactiveVisuals = ReactiveVisuals;
export default ReactiveVisuals;
