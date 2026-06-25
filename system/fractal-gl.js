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

// The fragment shader. The fractal `type` is a compile-time branch (#define) so each program is a
// single tight loop with no per-pixel `if (type==…)`. Smooth coloring + orbit trap transcribed from
// fractal.js's renderer (the same primary sources: Quilez smooth iteration, aesthetics-digest cross
// trap). Palette is a uniform array of 6 vec3 stops (0..1), cycled with the same ramp() logic.
function buildFragment(type) {
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

// Cyclic palette ramp over the 6 stops, matching fractal.js ramp(): linear interp between adjacent
// stops, wrapping. t is in "stop units" (already divided by the cycle density by the caller).
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
}

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

function getProgram(gl, canvas, type) {
  let cache = canvas[GLCACHE];
  if (!cache || cache.gl !== gl) {
    cache = canvas[GLCACHE] = { gl, byType: {} };
  }
  if (cache.byType[type]) return cache.byType[type];

  const prog = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, buildFragment(type));
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
  const entry = {
    prog, buf, loc,
    u: {
      resolution: U("u_resolution"), center: U("u_center"), scale: U("u_scale"),
      maxIter: U("u_maxIter"), julia: U("u_julia"), flipY: U("u_flipY"), pal: U("u_pal[0]"), aa: U("u_aa"),
    },
  };
  cache.byType[type] = entry;
  return entry;
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
  } = opts || {};
  const ftype = (type === "julia" || type === "burningship") ? type : "mandelbrot";

  const gl = getGL(canvas);
  const P = getProgram(gl, canvas, ftype);
  const w = canvas.width, h = canvas.height;

  gl.viewport(0, 0, w, h);
  gl.useProgram(P.prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, P.buf);
  gl.enableVertexAttribArray(P.loc);
  gl.vertexAttribPointer(P.loc, 2, gl.FLOAT, false, 0, 0);

  gl.uniform2f(P.u.resolution, w, h);
  gl.uniform2f(P.u.center, cx, cy);
  gl.uniform1f(P.u.scale, scale);
  gl.uniform1i(P.u.maxIter, Math.max(1, Math.min(MAX_ITERS, Math.round(maxIter))));
  gl.uniform2f(P.u.julia, jx, jy);
  gl.uniform1f(P.u.flipY, ftype === "burningship" ? -1 : 1);
  gl.uniform3fv(P.u.pal, palToFloats(palette));
  gl.uniform1i(P.u.aa, Math.max(1, Math.min(4, Math.round(aa))));

  gl.drawArrays(gl.TRIANGLES, 0, 3);
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

export const _MAX_ITERS = MAX_ITERS;   // exported for tests
