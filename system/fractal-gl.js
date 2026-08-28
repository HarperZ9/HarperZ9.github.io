// fractal-gl.js: GPU 2D escape-time fractals for the Studio (the perf + interactivity win).
//
// A WebGL1 fragment-shader Mandelbrot / Julia / Burning Ship: per-pixel escape iteration on the
// GPU instead of the CPU loop in fractal.js, so a full frame is near-instant and pan/zoom stay
// real-time. The visual recipe MIRRORS fractal.js so the GPU image reads the same as the gated CPU
// reference: bailout R=256, smooth (normalized) iteration count (Quilez/van Nieuwpoort), the cross
// orbit-trap glow blended toward the palette's lightest stop at the same 30% opacity, and the same
// palette ramp cycled at mu/8.
//
// Built EXACTLY like fractal3d.js / shared-frame/render.js renderField: a full-screen-triangle
// vertex shader, compile()/linkProgram(), a single drawArrays of 3 vertices. No RAF here, since a 2D
// fractal is a still image; the Studio re-invokes renderFractalGL() per interaction frame (the
// program is rebuilt cheaply, or reused via the cached handle below).
//
// renderFractalGL(canvas, { type, cx, cy, scale, maxIter, palette, jx, jy }) draws one frame and
// returns true. Throws a clear Error if WebGL is unavailable or the program fails to compile/link,
// and the Studio catches that and falls back to the CPU renderFractal().

import { PALETTES } from "./fractal.js";

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";

// Compile-time ceiling on the GLSL escape loop (WebGL1 needs a constant loop bound). The actual
// iteration count is the u_maxIter uniform, clamped JS-side to [1, MAX_ITERS]. 2000 matches the
// deepest CPU preset (Seahorse Deep / Period-2 Minibrot) so GPU detail keeps up at depth.
const MAX_ITERS = 2000;

// Bailout R=256 (R^2=65536), same as fractal.js BAILOUT, required for the smooth-coloring formula.
const BAILOUT2 = 65536.0;

// ── Deep zoom: emulated double precision ──────────────────────────────────────────────────────
// A float32 mantissa is 24 bits, so near |c| ≈ 1 the smallest representable step is 2^-24 ≈ 6e-8.
// The "Seahorse Deep" preset frames 6.25e-6 of the complex plane across ~1600 pixels — a step of
// 3.9e-9 per pixel, roughly 15x FINER than float32 can represent. Every 15 neighbouring pixels
// therefore collapse onto the same coordinate and the image goes blocky (measured before this fix:
// 105 distinct x-coordinates across a 512px view). The iteration has the same problem: z reaches
// magnitude ~1, so per-pixel differences below 6e-8 vanish inside the loop too.
//
// The fix is "double-single" (df64) arithmetic: carry each real number as an UNEVALUATED SUM of two
// float32s (hi + lo), giving ~48 mantissa bits ≈ 14 decimal digits. The primitives are Knuth's
// two-sum and Dekker's two-product, in the GPU form given by Thall, "Extended-Precision
// Floating-Point Numbers for GPU Computation" (2006).
//
// THE CATCH, measured on this hardware rather than assumed: compensated arithmetic works by keeping
// the rounding error that a plain add throws away, and every step of it is an algebraic no-op that
// an optimizer is delighted to delete. ANGLE/D3D11 on an RTX 4090 folds `t1 = a + b; e = t1 - a`
// straight back to `e = b` — confirmed by a shader where the increment was small enough to be
// swallowed entirely (`t1 == a`) and yet `e == b` still came back true, which is only possible if
// the subtraction never happened. Written naively, df64 compiles down to exactly the float32 program
// it was meant to replace, silently.
//
// So every foldable identity here is routed through dsBar(), a multiply by a uniform that always
// holds 1.0. Multiplying by exactly 1.0 is exact in IEEE754, so the numbers are untouched; the
// compiler simply cannot prove the identity any more and has to emit the subtraction. The check that
// this still holds on a given GPU is fractal-precision-probe.js, and the receipts are in
// project-docs/2026-08-03-fractal-precision.md.
const DS_LIB = `
const float DS_SPLIT = 8193.0;          // 2^13 + 1, Dekker's split constant for a 24-bit mantissa

uniform float u_one;                    // always exactly 1.0; opaque to the shader compiler

// Optimizer barrier. Numerically the identity function; algebraically a wall, because the compiler
// cannot know u_one is 1.0 and so cannot simplify across it. Wrap the operand whose repetition makes
// a compensation step foldable — never the result, or the compensation is lost anyway.
float dsBar(float x) { return x * u_one; }

// Exact sum of two df numbers (Knuth two-sum + the low-order terms).
// dsBar(t1) stops the (t1 - a.x) step collapsing to b.x, which would discard the whole correction.
vec2 dsAdd(vec2 a, vec2 b) {
  float t1 = a.x + b.x;
  float e  = dsBar(t1) - a.x;
  float t2 = ((b.x - e) + (a.x - (dsBar(t1) - e))) + (a.y + b.y);
  float hi = t1 + t2;
  return vec2(hi, t2 - (dsBar(hi) - t1));
}

// Product of two df numbers. Dekker split each hi into two 12-bit halves so the partial products
// are exact in float32, then reassemble with the cross terms. The splits are the most fragile step:
// the split is an identity in exact arithmetic and only survives because of the rounding inside it,
// so the inner occurrence of cona goes through the barrier.
vec2 dsMul(vec2 a, vec2 b) {
  float cona = a.x * DS_SPLIT;
  float conb = b.x * DS_SPLIT;
  float a1   = cona - (dsBar(cona) - a.x);
  float b1   = conb - (dsBar(conb) - b.x);
  float a2   = a.x - a1;
  float b2   = b.x - b1;
  float c11  = a.x * b.x;
  float c21  = a2 * b2 + (a2 * b1 + (a1 * b2 + (a1 * b1 - c11)));
  float c2   = a.x * b.y + a.y * b.x;
  float t1   = c11 + c2;
  float e    = dsBar(t1) - c11;
  float t2   = a.y * b.y + ((c2 - e) + (c11 - (dsBar(t1) - e))) + c21;
  float hi   = t1 + t2;
  return vec2(hi, t2 - (dsBar(hi) - t1));
}

// |a| for a df number: negating both limbs negates the represented sum exactly.
vec2 dsAbs(vec2 a) { return a.x < 0.0 ? -a : a; }
`;

// Cyclic palette ramp over the 6 stops, matching fractal.js ramp(): linear interp between adjacent
// stops, wrapping. t is in "stop units" (already divided by the cycle density by the caller).
// Shared verbatim by both precision variants so the two programs colour identically.
const RAMP_LIB = `
vec3 ramp(float t) {
  t = mod(t, 6.0);
  if (t < 0.0) t += 6.0;
  int i = int(floor(t));
  float f = t - floor(t);
  // index the const-size array with a branch ladder (WebGL1 forbids dynamic indexing of uniforms).
  vec3 a, b;
  if (i == 0)      { a = u_pal[0]; b = u_pal[1]; }
  else if (i == 1) { a = u_pal[1]; b = u_pal[2]; }
  else if (i == 2) { a = u_pal[2]; b = u_pal[3]; }
  else if (i == 3) { a = u_pal[3]; b = u_pal[4]; }
  else if (i == 4) { a = u_pal[4]; b = u_pal[5]; }
  else             { a = u_pal[5]; b = u_pal[0]; }
  return mix(a, b, f);
}`;

// The fragment shader. The fractal `type` is a compile-time branch (#define) so each program is a
// single tight loop with no per-pixel `if (type==…)`. Smooth coloring + orbit trap transcribed from
// fractal.js's renderer (the same primary sources: Quilez smooth iteration, aesthetics-digest cross
// trap). Palette is a uniform array of 6 vec3 stops (0..1), cycled with the same ramp() logic.
//
// `precision` selects the coordinate/iteration arithmetic: "single" is the original float32 program
// (unchanged, and what every non-deep view still compiles to); "double" swaps in df64 for the
// centre, the per-pixel coordinate and the whole escape loop.
function buildFragment(type, precision) {
  if (precision === "double") return buildFragmentDouble(type);
  // Per-type iteration body. z update + cross orbit trap, identical algebra to fractal.js kernels.
  // Mandelbrot also seeds z=0,c=uv; Julia seeds z=uv,c=(jx,jy); Burning Ship folds |z| each step.
  let header, zInit, cExpr, stepBody;
  if (type === "julia") {
    zInit = "vec2 z = uv;";
    cExpr = "vec2 c = u_julia;";
    stepBody = "z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;";
  } else if (type === "burningship") {
    zInit = "vec2 z = vec2(0.0);";
    cExpr = "vec2 c = uv;";
    // Burning Ship: take abs of components before squaring (Wikipedia formula).
    stepBody = "z = abs(z); z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;";
  } else { // mandelbrot
    zInit = "vec2 z = vec2(0.0);";
    cExpr = "vec2 c = uv;";
    stepBody = "z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;";
  }

  return `precision highp float;

uniform vec2  u_resolution;
uniform vec2  u_center;     // cx, cy in the complex plane
uniform float u_scale;      // width of the view in complex units
uniform int   u_maxIter;
uniform vec2  u_julia;      // jx, jy (Julia only)
uniform float u_flipY;      // +1, or -1 for Burning Ship (matches fractal.js vertical reflection)
uniform vec3  u_pal[6];     // palette stops, 0..1
uniform int   u_aa;         // supersampling samples per axis (1..4); SSAA for maximum-fidelity signal

const int   MAX_ITERS = ${MAX_ITERS};
const float BAILOUT2  = ${BAILOUT2.toFixed(1)};
const float LOG2      = 0.69314718056;

${RAMP_LIB}

// Per-sample fractal color at one complex coordinate. Extracted so main() can average several
// sub-pixel samples for supersampled anti-aliasing (the cleanest signal for the eye to perceive).
vec3 fractalColor(vec2 uv) {
  ${zInit}
  ${cExpr}
  int n = 0;
  float trap = 1e20;          // cross orbit trap: min(|re|,|im|)
  for (int i = 0; i < MAX_ITERS; i++) {
    if (i >= u_maxIter) break;
    if (dot(z, z) > BAILOUT2) break;
    ${stepBody}
    trap = min(trap, min(abs(z.x), abs(z.y)));
    n++;
  }
  if (n >= u_maxIter) return vec3(0.0);   // interior: black (matches fractal.js)
  // Smooth coloring: mu = n - log( log|z| / ln2 ) / ln2  (fractal.js uses the same form).
  float r2 = dot(z, z);
  float log_r = 0.5 * log(r2);
  float mu = float(n) - log(log_r / LOG2) / LOG2;
  vec3 base = ramp(mu / 8.0);              // same cycle density as the CPU path
  // Orbit-trap cross glow, exp(-trap*4) at 30% toward the lightest stop (u_pal[5]).
  float glow = exp(-trap * 4.0) * 0.30;
  return mix(base, u_pal[5], glow);
}

void main() {
  float aspect = u_resolution.y / u_resolution.x;
  int aa = u_aa < 1 ? 1 : (u_aa > 4 ? 4 : u_aa);
  float inv = 1.0 / float(aa);
  vec3 acc = vec3(0.0);
  // Average aa x aa evenly-spaced sub-pixel samples (ordered grid SSAA). Constant loop bounds for
  // WebGL1; the inner break trims to the actual aa. aa=1 reproduces the original single sample.
  for (int sy = 0; sy < 4; sy++) {
    if (sy >= aa) break;
    for (int sx = 0; sx < 4; sx++) {
      if (sx >= aa) break;
      vec2 sub = (vec2(float(sx), float(sy)) + 0.5) * inv - 0.5;   // sub-pixel offset in [-0.5, 0.5)
      vec2 ndc = (gl_FragCoord.xy + sub) / u_resolution - 0.5;
      vec2 uv = vec2(
        u_center.x + ndc.x * u_scale,
        u_center.y + u_flipY * ndc.y * u_scale * aspect
      );
      acc += fractalColor(uv);
    }
  }
  gl_FragColor = vec4(acc * (inv * inv), 1.0);
}`;
}

// The deep-zoom program. Identical image recipe to buildFragment (same bailout, same smooth
// coloring, same cross trap, same ramp) with every coordinate and every z carried as a df64 pair.
// The centre arrives split into hi/lo limbs (u_centerX/u_centerY); the sub-pixel OFFSET stays plain
// float32 because it is a small number whose own relative error (1e-7 of an already-tiny offset)
// lands far below one pixel step at any zoom this program can reach.
function buildFragmentDouble(type) {
  let zInit, cInit, absStep = "";
  if (type === "julia") {
    zInit = "vec2 zx = ux;        vec2 zy = uy;";
    cInit = "vec2 cx = u_juliaX;  vec2 cy = u_juliaY;";
  } else if (type === "burningship") {
    zInit = "vec2 zx = vec2(0.0); vec2 zy = vec2(0.0);";
    cInit = "vec2 cx = ux;        vec2 cy = uy;";
    // Burning Ship folds |z| at the top of each step. |z| has the same modulus, so the bailout test
    // below is unaffected by where the fold sits — it matches the single-precision program exactly.
    absStep = "zx = dsAbs(zx); zy = dsAbs(zy);";
  } else { // mandelbrot
    zInit = "vec2 zx = vec2(0.0); vec2 zy = vec2(0.0);";
    cInit = "vec2 cx = ux;        vec2 cy = uy;";
  }

  return `precision highp float;

uniform vec2  u_resolution;
uniform vec2  u_centerX;    // cx as a df64 pair (hi, lo)
uniform vec2  u_centerY;    // cy as a df64 pair (hi, lo)
uniform float u_scale;      // width of the view in complex units
uniform int   u_maxIter;
uniform vec2  u_juliaX;     // jx as a df64 pair (Julia only)
uniform vec2  u_juliaY;     // jy as a df64 pair (Julia only)
uniform float u_flipY;      // +1, or -1 for Burning Ship (matches fractal.js vertical reflection)
uniform vec3  u_pal[6];     // palette stops, 0..1
uniform int   u_aa;         // supersampling samples per axis (1..4)

const int   MAX_ITERS = ${MAX_ITERS};
const float BAILOUT2  = ${BAILOUT2.toFixed(1)};
const float LOG2      = 0.69314718056;
${DS_LIB}
${RAMP_LIB}

// Per-sample fractal color at one df64 complex coordinate (ux + i·uy).
vec3 fractalColor(vec2 ux, vec2 uy) {
  ${zInit}
  ${cInit}
  int n = 0;
  float trap = 1e20;          // cross orbit trap: min(|re|,|im|), read off the hi limbs
  for (int i = 0; i < MAX_ITERS; i++) {
    if (i >= u_maxIter) break;
    ${absStep}
    vec2 xx = dsMul(zx, zx);
    vec2 yy = dsMul(zy, zy);
    if (xx.x + yy.x > BAILOUT2) break;
    vec2 nx = dsAdd(dsAdd(xx, -yy), cx);            // x² - y² + cx
    vec2 ny = dsAdd(dsMul(dsAdd(zx, zx), zy), cy);  // 2xy + cy
    zx = nx; zy = ny;
    trap = min(trap, min(abs(zx.x), abs(zy.x)));
    n++;
  }
  if (n >= u_maxIter) return vec3(0.0);   // interior: black (matches fractal.js)
  // Smooth coloring reads the hi limbs: |z| is O(bailout) here, so float32 is ample for a log.
  float r2 = zx.x * zx.x + zy.x * zy.x;
  float log_r = 0.5 * log(r2);
  float mu = float(n) - log(log_r / LOG2) / LOG2;
  vec3 base = ramp(mu / 8.0);
  float glow = exp(-trap * 4.0) * 0.30;
  return mix(base, u_pal[5], glow);
}

void main() {
  float aspect = u_resolution.y / u_resolution.x;
  int aa = u_aa < 1 ? 1 : (u_aa > 4 ? 4 : u_aa);
  float inv = 1.0 / float(aa);
  vec3 acc = vec3(0.0);
  for (int sy = 0; sy < 4; sy++) {
    if (sy >= aa) break;
    for (int sx = 0; sx < 4; sx++) {
      if (sx >= aa) break;
      vec2 sub = (vec2(float(sx), float(sy)) + 0.5) * inv - 0.5;
      vec2 ndc = (gl_FragCoord.xy + sub) / u_resolution - 0.5;
      vec2 ux = dsAdd(u_centerX, vec2(ndc.x * u_scale, 0.0));
      vec2 uy = dsAdd(u_centerY, vec2(u_flipY * ndc.y * u_scale * aspect, 0.0));
      acc += fractalColor(ux, uy);
    }
  }
  gl_FragColor = vec4(acc * (inv * inv), 1.0);
}`;
}

// Split a JS double into the two float32 limbs the df64 shader expects. `hi` is the nearest float32;
// `v - hi` is then exact in double arithmetic and itself representable as a float32, so hi + lo
// reproduces about 48 mantissa bits of the original.
export function splitDouble(v) {
  const hi = Math.fround(v);
  return [hi, Math.fround(v - hi)];
}

// float32 mantissa step (2^-23) and the df64 equivalent (2^-48, the two 24-bit limbs end to end).
// The df64 figure is measured, not assumed: on an RTX 4090 the probe still separates all 512 columns
// of a 1e-12-wide view centred at -0.744539761 and collapses to 52 columns at 1e-13, which puts the
// real resolution at ~2.6e-15 relative — a hair better than 2^-48.
const F32_EPS = 1.1920928955078125e-7;
const DF64_EPS = 3.552713678800501e-15;

/**
 * Which arithmetic this view needs. The test is whether ONE PIXEL of separation survives the
 * format: a pixel spans `scale / width` of the plane, and the format resolves `mag * eps` near the
 * working magnitude. `mag` floors at 1 because the escape loop drives z up to order 1 regardless of
 * how near the origin c sits, so the iteration is what sets the floor, not the centre.
 *
 *   "single"    → float32 separates neighbouring pixels with room to spare.
 *   "double"    → float32 has run out; the df64 program is required and is used.
 *   "exhausted" → df64 is at its floor too. The df64 program is still the best available and is
 *                 still used, but pixels are beginning to collapse onto the same point.
 *
 * The two boundaries carry deliberately different headroom. Switching from float32 to df64 early
 * costs only speed, so that one takes a 4x margin. Declaring exhaustion early costs the truth — it
 * would print "no new detail" over a frame that is still resolving — so that one takes none.
 */
export function fractalPrecisionMode(cx, cy, scale, width) {
  const mag = Math.max(Math.abs(cx) || 0, Math.abs(cy) || 0, 1);
  const step = Math.abs(scale) / Math.max(1, width || 1);
  if (!isFinite(step) || step <= 0) return "exhausted";
  if (step >= mag * F32_EPS * 4) return "single";
  if (step >= mag * DF64_EPS) return "double";
  return "exhausted";
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("fractal-gl shader compile failed: " + log);
  }
  return sh;
}

// Convert a fractal.js palette (arrays of [0..255,0..255,0..255]) to a flat Float32Array of 6 vec3
// in 0..1. Pads/truncates to exactly 6 stops (all bundled palettes have 6).
function palToFloats(palName) {
  const pal = PALETTES[palName] || PALETTES.ocean;
  const out = new Float32Array(18);
  for (let i = 0; i < 6; i++) {
    const s = pal[Math.min(i, pal.length - 1)];
    out[i * 3 + 0] = s[0] / 255;
    out[i * 3 + 1] = s[1] / 255;
    out[i * 3 + 2] = s[2] / 255;
  }
  return out;
}

// A per-canvas cache of the compiled program, keyed by fractal type. Recompiling a fragment for the
// SAME type every interaction frame is wasteful; we rebuild only when the type changes. Stored on
// the canvas element via a non-enumerable symbol so it travels with the node (and is dropped when
// the canvas is replaced, as the 3D source does on mount/unmount).
const GLCACHE = Symbol("fractalGLCache");

function getProgram(gl, canvas, type, precision) {
  let cache = canvas[GLCACHE];
  if (!cache || cache.gl !== gl) {
    cache = canvas[GLCACHE] = { gl, byType: {} };
  }
  const key = precision === "double" ? type + ":df" : type;
  if (cache.byType[key]) return cache.byType[key];

  const prog = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, buildFragment(type, precision));
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("fractal-gl program link failed: " + gl.getProgramInfoLog(prog));
  }
  // Full-screen triangle (same buffer layout as render.js / fractal3d.js).
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  const U = n => gl.getUniformLocation(prog, n);
  // The two variants declare different coordinate uniforms; the ones a variant does not declare
  // resolve to null, and gl.uniform*(null, …) is a defined no-op, so the caller sets both sets.
  const entry = {
    prog, buf, loc, precision: precision === "double" ? "double" : "single",
    u: {
      resolution: U("u_resolution"), center: U("u_center"), scale: U("u_scale"),
      maxIter: U("u_maxIter"), julia: U("u_julia"), flipY: U("u_flipY"), pal: U("u_pal[0]"), aa: U("u_aa"),
      centerX: U("u_centerX"), centerY: U("u_centerY"), juliaX: U("u_juliaX"), juliaY: U("u_juliaY"),
      one: U("u_one"),
    },
  };
  cache.byType[key] = entry;
  return entry;
}

// Does this context give a fragment shader a real 24-bit-mantissa float? highp is OPTIONAL in
// fragment shaders under GLSL ES 1.0, and a driver that silently demotes to mediump (10 bits) would
// make the df64 split meaningless — worse than the single-precision program, not better. Probe once
// per context and refuse the deep path if the hardware can't carry it.
const HIGHP_OK = Symbol("fractalHighpOK");
function hasUsableHighp(gl) {
  if (gl[HIGHP_OK] !== undefined) return gl[HIGHP_OK];
  let ok = true;
  try {
    const fmt = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    ok = !!fmt && fmt.precision >= 23;
  } catch (_) {
    ok = false;
  }
  gl[HIGHP_OK] = ok;
  return ok;
}

// Acquire (or reuse) a WebGL context on `canvas`. Caches it so repeated interaction frames don't
// re-getContext. preserveDrawingBuffer:true so perceive()/the meter loop can read the pixels back.
function getGL(canvas) {
  if (canvas.__fractalGLContext) return canvas.__fractalGLContext;
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: false })
    || canvas.getContext("experimental-webgl", { preserveDrawingBuffer: true, antialias: false });
  if (!gl) throw new Error("2D GPU fractals need WebGL. This browser/context has none.");
  canvas.__fractalGLContext = gl;
  return gl;
}

/**
 * renderFractalGL(canvas, opts): draw one Mandelbrot/Julia/Burning Ship frame into `canvas` on the
 * GPU. opts: { type, cx, cy, scale, maxIter, palette, jx, jy }. Returns true on success; throws a
 * clear Error if WebGL is unavailable or the shader fails (the Studio catches and falls back to CPU).
 */
export function renderFractalGL(canvas, opts) {
  const {
    type = "mandelbrot",
    cx = -0.5, cy = 0,
    scale = 3.5,
    maxIter = 300,
    palette = "ocean",
    jx = -0.8, jy = 0.156,
    aa = 1,
    precision = "auto",
  } = opts || {};
  const ftype = (type === "julia" || type === "burningship") ? type : "mandelbrot";

  const gl = getGL(canvas);
  const w = canvas.width, h = canvas.height;

  // Pick the arithmetic from the view itself: float32 while it still separates neighbouring pixels,
  // df64 once it doesn't. Automatic, so panning and zooming cross the boundary without a control.
  // opts.precision forces a variant ("single" | "double") instead; the visual-QA harness uses it to
  // render one view both ways and measure the difference, and nothing in the Studio sets it.
  const want = precision === "single" || precision === "double"
    ? precision
    : fractalPrecisionMode(cx, cy, scale, w);
  const deep = want !== "single" && hasUsableHighp(gl);
  const P = getProgram(gl, canvas, ftype, deep ? "double" : "single");

  // df64 costs roughly an order of magnitude more ALU per iteration, so trim supersampling when it
  // is on: full-rate SSAA over a 3200-wide backing at 2000 iterations would stall the tab.
  let effAA = Math.max(1, Math.min(4, Math.round(aa)));
  if (deep) effAA = (w * h <= 1600 * 1000) ? Math.min(effAA, 2) : 1;

  gl.viewport(0, 0, w, h);
  gl.useProgram(P.prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, P.buf);
  gl.enableVertexAttribArray(P.loc);
  gl.vertexAttribPointer(P.loc, 2, gl.FLOAT, false, 0, 0);

  gl.uniform2f(P.u.resolution, w, h);
  gl.uniform1f(P.u.scale, scale);
  gl.uniform1i(P.u.maxIter, Math.max(1, Math.min(MAX_ITERS, Math.round(maxIter))));
  gl.uniform1f(P.u.flipY, ftype === "burningship" ? -1 : 1);
  gl.uniform3fv(P.u.pal, palToFloats(palette));
  gl.uniform1i(P.u.aa, effAA);
  // Coordinates in both forms; the variant that isn't compiled has null locations and ignores its set.
  gl.uniform2f(P.u.center, cx, cy);
  gl.uniform2f(P.u.julia, jx, jy);
  const [cxHi, cxLo] = splitDouble(cx), [cyHi, cyLo] = splitDouble(cy);
  const [jxHi, jxLo] = splitDouble(jx), [jyHi, jyLo] = splitDouble(jy);
  gl.uniform2f(P.u.centerX, cxHi, cxLo);
  gl.uniform2f(P.u.centerY, cyHi, cyLo);
  gl.uniform2f(P.u.juliaX, jxHi, jxLo);
  gl.uniform2f(P.u.juliaY, jyHi, jyLo);
  gl.uniform1f(P.u.one, 1.0);   // the df64 optimizer barrier; null (and ignored) in the single program

  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // Record what actually ran, not what was wanted. On a device whose fragment shaders demote highp
  // the deep program is refused and this stays "single", which is the difference between the Studio
  // telling the truth about the frame and making a claim the hardware did not honour.
  canvas.__fractalPrecisionUsed = deep ? "double" : "single";
  return true;
}

// Cheap capability probe: true if a throwaway canvas yields a WebGL context. The Studio calls this
// once to decide whether the 2D-fractal source routes through the GL path or the CPU fallback.
export function isFractalGLAvailable() {
  try {
    const c = (typeof document !== "undefined") ? document.createElement("canvas") : null;
    if (!c) return false;
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    return !!gl;
  } catch (_) {
    return false;
  }
}

// One DPR clamp for the GL fractal backing store (engine-showcase spec 1.4). Tier-gated and
// fail-safe: on tier mid and above, size the backing to CSS layout * min(devicePixelRatio, 2)
// so hi-DPI displays get a crisp full-resolution fragment pass without tripling the pixel load
// on 3x devices. Below tier mid (or with no tier / any error) it is a no-op and the caller's
// sizeCanvas() result stands. antialias stays false: MSAA does nothing for full-screen
// fragment content. Returns true only if it changed the backing store.
export function clampGLBackingToDPR(canvas, tier) {
  try {
    if (tier !== "mid" && tier !== "high" && tier !== "max") return false;
    if (typeof window === "undefined" || !canvas) return false;
    const parent = canvas.parentElement;
    const ref = parent ? parent.getBoundingClientRect() : canvas.getBoundingClientRect();
    const cssW = Math.max(1, ref.width || 1);
    const cssH = Math.max(1, ref.height || ref.width || 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.min(4096, Math.round(cssW * dpr)));
    const h = Math.max(1, Math.min(4096, Math.round(cssH * dpr)));
    if (w === canvas.width && h === canvas.height) return false;
    canvas.width = w;
    canvas.height = h;
    return true;
  } catch (_) {
    return false;   // fail-safe: never let a sizing probe break the render path
  }
}

export const _MAX_ITERS = MAX_ITERS;   // exported for tests
export const _buildFragment = buildFragment;   // exported for tests (shader-source assertions)
// The df64 primitives, exported so fractal-precision-probe.js measures the SHIPPED source text on
// real hardware rather than a copy that could drift from it.
export const _DS_LIB = DS_LIB;
