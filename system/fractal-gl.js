// fractal-gl.js: GPU 2D escape-time fractals for the Studio (the perf + interactivity win).
//
// A WebGL1 fragment-shader Mandelbrot / Julia / Burning Ship: per-pixel escape iteration on the
// GPU instead of the CPU loop in fractal.js, so a full frame is near-instant and pan/zoom stay
// real-time. The visual recipe MIRRORS fractal.js so the GPU image reads the same as the gated CPU
// reference: bailout R=256, smooth (normalized) iteration count (Quilez/van Nieuwpoort), the cross
// orbit-trap glow blended toward the palette's lightest stop at the same 30% opacity, the same
// palette ramp cycled at mu/8, the same relief shading, and the same encode to display values.
//
// This file is the RUNTIME half: contexts, program compilation and caching, uniform upload, the draw
// call, and the precision decision. The shader SOURCE lives in fractal-glsl.js. The split is what
// keeps either half readable; before it, one file carried 550 lines of GLSL-in-template-literals and
// the WebGL plumbing that feeds it. The two handles other modules already imported from here
// (_buildFragment for the shader-source tests, _DS_LIB for fractal-precision-probe.js) are
// re-exported unchanged at the bottom, so nothing downstream had to move.
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
import { preparePalette } from "./fractal-color.js";
import { VERT, MAX_ITERS, DS_LIB, buildFragment } from "./fractal-glsl.js";

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

// sRGB electro-optical transfer function: display code value -> linear radiance (IEC 61966-2-1).
// The inverse of srgbEncode() in the shader's ENCODE_LIB.
// Convert a fractal.js palette (arrays of [0..255,0..255,0..255]) to a flat Float32Array of 6 vec3.
// Pads/truncates to exactly 6 stops (all bundled palettes have 6).
//
// The stops go up in OKLab, not as the sRGB numbers they are written as, because the shader's ramp
// interpolates between them and a palette gradient is read rather than integrated. preparePalette()
// in fractal-color.js does the conversion, and is the same call the CPU renderer makes, which is
// what keeps the two images the same colour. It caches per palette, so this costs one map per frame.
function palToFloats(palName) {
  const pal = PALETTES[palName] || PALETTES.ocean;
  const { lab } = preparePalette(pal);
  const out = new Float32Array(18);
  for (let i = 0; i < 6; i++) {
    const s = lab[Math.min(i, lab.length - 1)];
    out[i * 3 + 0] = s[0];
    out[i * 3 + 1] = s[1];
    out[i * 3 + 2] = s[2];
  }
  return out;
}

// The trap glow ADDS the lightest stop as light, so that one stop is also needed in linear light.
function tintToFloats(palName) {
  const { tint } = preparePalette(PALETTES[palName] || PALETTES.ocean);
  return new Float32Array(tint);
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
      maxIter: U("u_maxIter"), julia: U("u_julia"), flipY: U("u_flipY"), pal: U("u_pal[0]"), tint: U("u_tint"), aa: U("u_aa"),
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
  gl.uniform3fv(P.u.tint, tintToFloats(palette));
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

// Palette conversion, exported so tests can assert the stops arrive in linear light.
export const _palToFloats = palToFloats;
