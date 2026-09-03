// fractal-glsl.js: assembles the Studio's GPU fractal fragment shaders.
//
// One entry point, buildFragment(type, precision), which pastes the shared blocks from
// fractal-glsl-lib.js around a per-type iteration body and returns a complete GLSL ES 1.0 fragment
// program. Nothing here touches a GL context; fractal-gl.js compiles and runs what this returns.
//
// The image recipe MIRRORS fractal.js so the GPU frame reads the same as the gated CPU reference:
// bailout R=256, smooth (normalized) iteration count (Quilez/van Nieuwpoort), a cross orbit trap
// blended toward the palette's lightest stop at 30%, the palette cycled at mu/8 with Catmull-Rom
// interpolation in LINEAR light, Lambert relief from the escape-orbit derivative, and a triangular
// dither on the way to 8 bits.

import { VERT, MAX_ITERS, BAILOUT2, DS_LIB, RAMP_LIB, SHADE_LIB, ENCODE_LIB } from "./fractal-glsl-lib.js";

// Re-exported so a consumer needs one import for the whole shader layer.
export { VERT, MAX_ITERS, BAILOUT2, DS_LIB, RAMP_LIB, SHADE_LIB, ENCODE_LIB };

// The fragment shader. The fractal `type` is a compile-time branch so each program is a single tight
// loop with no per-pixel `if (type==...)`. Smooth coloring and orbit trap are transcribed from
// fractal.js's renderer (the same primary sources: Quilez smooth iteration, aesthetics-digest cross
// trap). Palette is a uniform array of 6 vec3 stops in linear light, cycled with the same ramp.
//
// `precision` selects the coordinate/iteration arithmetic: "single" is the plain float32 program
// (what every non-deep view compiles to); "double" swaps in df64 for the centre, the per-pixel
// coordinate and the whole escape loop.
export function buildFragment(type, precision) {
  if (precision === "double") return buildFragmentDouble(type);
  // Per-type iteration body: z update, orbit derivative, cross orbit trap, identical algebra to the
  // fractal.js kernels. Mandelbrot seeds z=0,c=uv; Julia seeds z=uv,c=(jx,jy); Burning Ship folds
  // |z| each step and folds the derivative's signs to match.
  let zInit, cExpr, stepBody;
  const dmul = "dz = 2.0 * vec2(z.x*dz.x - z.y*dz.y, z.x*dz.y + z.y*dz.x)";
  if (type === "julia") {
    // dz/dz0 for a Julia set: the seed is the pixel, so the derivative starts at 1 and has no
    // additive term, because c is constant and dc/dz0 is zero.
    zInit = "vec2 z = uv; vec2 dz = vec2(1.0, 0.0); float dseed = 0.0;";
    cExpr = "vec2 c = u_julia;";
    stepBody = `${dmul};
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;`;
  } else if (type === "burningship") {
    zInit = "vec2 z = vec2(0.0); vec2 dz = vec2(0.0); float dseed = 1.0;";
    cExpr = "vec2 c = uv;";
    // Burning Ship: take abs of components before squaring (Wikipedia formula). The map is not
    // holomorphic, so this derivative is the sign-folded chain rule rather than a true complex
    // derivative. It is used only to pick a shading direction, never to estimate a distance.
    stepBody = `dz = vec2(z.x < 0.0 ? -dz.x : dz.x, z.y < 0.0 ? -dz.y : dz.y);
    z = abs(z);
    ${dmul} + vec2(dseed, 0.0);
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;`;
  } else { // mandelbrot
    zInit = "vec2 z = vec2(0.0); vec2 dz = vec2(0.0); float dseed = 1.0;";
    cExpr = "vec2 c = uv;";
    stepBody = `${dmul} + vec2(dseed, 0.0);
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;`;
  }

  return `precision highp float;

uniform vec2  u_resolution;
uniform vec2  u_center;     // cx, cy in the complex plane
uniform float u_scale;      // width of the view in complex units
uniform int   u_maxIter;
uniform vec2  u_julia;      // jx, jy (Julia only)
uniform float u_flipY;      // +1, or -1 for Burning Ship (matches fractal.js vertical reflection)
uniform vec3  u_pal[6];     // palette stops in OKLab; ramp() converts back to linear light
uniform vec3  u_tint;       // the lightest stop, kept in LINEAR light for the additive trap glow
uniform int   u_aa;         // supersampling samples per axis (1..4); SSAA for the cleanest signal

const int   MAX_ITERS = ${MAX_ITERS};
const float BAILOUT2  = ${BAILOUT2.toFixed(1)};
const float LOG2      = 0.69314718056;

${RAMP_LIB}
${SHADE_LIB}
${ENCODE_LIB}

// Per-sample fractal color at one complex coordinate, in LINEAR light. Extracted so main() can
// average several sub-pixel samples for supersampled anti-aliasing, and averaging in linear light is
// the only way that average is the physically right one.
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
    // The derivative grows like 2^n and would reach float32's ceiling well before 2000 iterations.
    // Rescaling dz and its additive seed by the SAME factor leaves the represented derivative's
    // DIRECTION exact, and direction is all the shading reads.
    if (dot(dz, dz) > 1e18) { dz *= 1e-9; dseed *= 1e-9; }
    n++;
  }
  if (n >= u_maxIter) return vec3(0.0);   // interior: black (matches fractal.js)
  // Smooth coloring: mu = n - log( log|z| / ln2 ) / ln2  (fractal.js uses the same form).
  float r2 = dot(z, z);
  float log_r = 0.5 * log(r2);
  float mu = float(n) - log(log_r / LOG2) / LOG2;
  vec3 base = ramp(mu / 8.0);              // same cycle density as the CPU path
  // Orbit-trap cross glow, exp(-trap*4) at 30% of the lightest stop (u_tint).
  float glow = exp(-trap * 4.0) * 0.30;
  // Added as emission rather than blended over the base. A blend pulls every lit pixel toward the
  // lightest stop, which drains the palette wherever the trap is weak, and the trap is weak across
  // most of a frame. Adding light leaves the base hue alone where the glow is faint and still prints
  // the filament where it is strong.
  return holdGamut(base * relief(z, dz) + u_tint * trapWeight(glow));
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
  gl_FragColor = vec4(encodeOut(acc * (inv * inv), gl_FragCoord.xy), 1.0);
}`;
}

// The deep-zoom program. Identical image recipe to buildFragment (same bailout, same smooth
// coloring, same cross trap, same ramp, same relief, same encode) with every coordinate and every z
// carried as a df64 pair. The centre arrives split into hi/lo limbs (u_centerX/u_centerY); the
// sub-pixel OFFSET stays plain float32 because it is a small number whose own relative error (1e-7
// of an already-tiny offset) lands far below one pixel step at any zoom this program can reach. The
// orbit derivative also stays float32: it feeds a shading direction, not a coordinate.
function buildFragmentDouble(type) {
  let zInit, cInit, absStep = "", dFold = "";
  const dmul = "dz = 2.0 * vec2(zh.x*dz.x - zh.y*dz.y, zh.x*dz.y + zh.y*dz.x)";
  let dStep = `${dmul} + vec2(dseed, 0.0);`;
  if (type === "julia") {
    zInit = "vec2 zx = ux;        vec2 zy = uy;        vec2 dz = vec2(1.0, 0.0); float dseed = 0.0;";
    cInit = "vec2 cx = u_juliaX;  vec2 cy = u_juliaY;";
    dStep = `${dmul};`;
  } else if (type === "burningship") {
    zInit = "vec2 zx = vec2(0.0); vec2 zy = vec2(0.0); vec2 dz = vec2(0.0);     float dseed = 1.0;";
    cInit = "vec2 cx = ux;        vec2 cy = uy;";
    // Burning Ship folds |z| at the top of each step. |z| has the same modulus, so the bailout test
    // below is unaffected by where the fold sits: it matches the single-precision program exactly.
    absStep = "zx = dsAbs(zx); zy = dsAbs(zy);";
    dFold = "dz = vec2(zx.x < 0.0 ? -dz.x : dz.x, zy.x < 0.0 ? -dz.y : dz.y);";
  } else { // mandelbrot
    zInit = "vec2 zx = vec2(0.0); vec2 zy = vec2(0.0); vec2 dz = vec2(0.0);     float dseed = 1.0;";
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
uniform vec3  u_pal[6];     // palette stops in OKLab; ramp() converts back to linear light
uniform vec3  u_tint;       // the lightest stop, kept in LINEAR light for the additive trap glow
uniform int   u_aa;         // supersampling samples per axis (1..4)

const int   MAX_ITERS = ${MAX_ITERS};
const float BAILOUT2  = ${BAILOUT2.toFixed(1)};
const float LOG2      = 0.69314718056;
${DS_LIB}
${RAMP_LIB}
${SHADE_LIB}
${ENCODE_LIB}

// Per-sample fractal color at one df64 complex coordinate (ux + i*uy), in LINEAR light.
vec3 fractalColor(vec2 ux, vec2 uy) {
  ${zInit}
  ${cInit}
  int n = 0;
  float trap = 1e20;          // cross orbit trap: min(|re|,|im|), read off the hi limbs
  for (int i = 0; i < MAX_ITERS; i++) {
    if (i >= u_maxIter) break;
    ${dFold}
    ${absStep}
    vec2 xx = dsMul(zx, zx);
    vec2 yy = dsMul(zy, zy);
    if (xx.x + yy.x > BAILOUT2) break;
    vec2 zh = vec2(zx.x, zy.x);                     // the derivative only needs the hi limbs
    ${dStep}
    vec2 nx = dsAdd(dsAdd(xx, -yy), cx);            // x^2 - y^2 + cx
    vec2 ny = dsAdd(dsMul(dsAdd(zx, zx), zy), cy);  // 2xy + cy
    zx = nx; zy = ny;
    trap = min(trap, min(abs(zx.x), abs(zy.x)));
    if (dot(dz, dz) > 1e18) { dz *= 1e-9; dseed *= 1e-9; }
    n++;
  }
  if (n >= u_maxIter) return vec3(0.0);   // interior: black (matches fractal.js)
  // Smooth coloring reads the hi limbs: |z| is O(bailout) here, so float32 is ample for a log.
  float r2 = zx.x * zx.x + zy.x * zy.x;
  float log_r = 0.5 * log(r2);
  float mu = float(n) - log(log_r / LOG2) / LOG2;
  vec3 base = ramp(mu / 8.0);
  float glow = exp(-trap * 4.0) * 0.30;
  // Added as emission rather than blended over the base. A blend pulls every lit pixel toward the
  // lightest stop, which drains the palette wherever the trap is weak, and the trap is weak across
  // most of a frame. Adding light leaves the base hue alone where the glow is faint and still prints
  // the filament where it is strong.
  return holdGamut(base * relief(vec2(zx.x, zy.x), dz) + u_tint * trapWeight(glow));
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
  gl_FragColor = vec4(encodeOut(acc * (inv * inv), gl_FragCoord.xy), 1.0);
}`;
}
