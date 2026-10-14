// fractal-glsl-formula.js: a fragment program for any formula spec (fractal-formulas.js).
//
// The iteration body is generated from the formula's syntax tree by fractal-formula.js, with two
// tangent columns per value, so the shading reads the gradient of log|z| for any formula, folds and
// conjugates included. Everything around the body is the shallow Mandelbrot program's own recipe
// (RAMP_LIB, SHADE_LIB, ENCODE_LIB): the same bailout, palette ramp, relief, trap glow and encode,
// so a Multibrot sits beside the Mandelbrot in the same light.
//
// Escape mode colours by smooth iteration, normalised for the formula's degree d:
// mu = n - log(log|z| / ln 2) / ln d, which is the Mandelbrot program's own expression at d = 2.
// Converge mode (Newton, Nova) colours by the root: the hue comes from the angle of the point the
// orbit settled on, so each root gets its own part of the palette, and the brightness from how fast
// it got there, smoothed by the quadratic convergence of Newton's method:
// nu = n - log2(log|dz_n| / log eps).

import { RAMP_LIB, SHADE_LIB, ENCODE_LIB, MAX_ITERS } from "./fractal-glsl-lib.js";
import { compileGLSL, COMPLEX_GLSL } from "./fractal-formula.js";
import { ORBIT_GLSL, COLOURIZE_GLSL, DECODE_GLSL } from "./fractal-colouring.js";

const g = (x) => { const s = String(+x); return /[.eE]/.test(s) ? (s.includes("e") && !s.includes(".") ? s.replace("e", ".0e") : s) : s + ".0"; };

/**
 * Root colouring needs roots that are the same for every pixel: Julia mode, or a formula without c.
 * Shared with the CPU twin so both choose the same recipe.
 */
export function rootColour(spec) {
  return spec.julia || !spec.uses.has("c");
}

export function buildFormulaFragment(spec) {
  const julia = spec.julia;
  const env = {
    z: ["z", "za", "zb"],
    zp: ["zp", "zpa", "zpb"],
    c: julia ? ["c", "vec2(0.0)", "vec2(0.0)"] : ["c", "vec2(ts, 0.0)", "vec2(0.0, ts)"],
    p: ["u_p", "vec2(0.0)", "vec2(0.0)"],
    q: ["u_q", "vec2(0.0)", "vec2(0.0)"],
  };
  const body = compileGLSL(spec.tree, env);
  const converge = spec.mode === "converge";
  // Julia mode starts at the pixel; otherwise z starts at the formula's critical point, or at c
  // itself when the formula asks (c sin z, for one, is stuck at 0 forever if started there).
  const init = julia
    ? "vec2 z = uv; vec2 za = vec2(1.0, 0.0); vec2 zb = vec2(0.0, 1.0); vec2 c = u_julia;"
    : spec.z0 === "c"
      ? "vec2 z = uv; vec2 za = vec2(1.0, 0.0); vec2 zb = vec2(0.0, 1.0); vec2 c = uv;"
      : `vec2 z = vec2(${g(spec.z0[0])}, ${g(spec.z0[1])}); vec2 za = vec2(0.0); vec2 zb = vec2(0.0); vec2 c = uv;`;

  return `precision highp float;

uniform vec2  u_resolution;
uniform vec2  u_center;
uniform float u_scale;
uniform int   u_maxIter;
uniform vec2  u_julia;      // c in Julia mode
uniform vec2  u_p;          // the formula's constants p and q
uniform vec2  u_q;
uniform float u_bailout2;
uniform float u_degree;
uniform vec3  u_tint;
uniform int   u_aa;

const int   MAX_ITERS = ${MAX_ITERS};
const float LOG2 = 0.69314718056;

${RAMP_LIB}
${SHADE_LIB}
${ENCODE_LIB}
${COMPLEX_GLSL}
${DECODE_GLSL}${ORBIT_GLSL}${COLOURIZE_GLSL}
float g_mu;
bool  g_in;

// A smooth count for a converging orbit: the step that crossed the threshold, interpolated in log
// size between the last step above it and the first below. Continuous in n whether the orbit
// converges quadratically (Newton at a simple root) or linearly (Nova's fixed points); the first
// version assumed quadratic and printed stepped contours across Nova's smooth regions.
float convergedCount(int n, float s2, float p2) {
  float a = log(max(p2, 1e-30)), b = log(max(s2, 1e-30)), e = log(1e-9);
  float f = (a - b) > 1e-6 ? clamp((a - e) / (a - b), 0.0, 1.0) : 1.0;
  return float(n) - 1.0 + f;
}

vec3 fractalColor(vec2 uv) {
  ${init}
  float ts = 1.0;             // the scale the tangents of c carry, rescaled with them
  vec2 zp = vec2(0.0), zpa = vec2(0.0), zpb = vec2(0.0);
  int n = 0;
  bool done = false;
  float trap = 1e20;
  float step2 = 1.0, prev2 = 1.0;
  float dk = 0.0;             // rescales of the tangents, for the distance estimate
  orbitInit();
  o_deg = u_degree;
  g_in = false;
  for (int i = 0; i < MAX_ITERS; i++) {
    if (i >= u_maxIter) break;
    ${converge ? "" : "if (dot(z, z) > u_bailout2) { done = true; break; }"}
    ${body.code}
    zp = z; zpa = za; zpb = zb;
    z = ${body.out[0]}; za = ${body.out[1]}; zb = ${body.out[2]};
    n++;
    if (!(abs(z.x) < 1e30 && abs(z.y) < 1e30)) { ${converge ? "" : "done = true;"} break; }
    ${converge
      ? "prev2 = step2; step2 = dot(z - zp, z - zp); if (step2 < 1e-9) { done = true; break; }"
      : "trap = min(trap, min(abs(z.x), abs(z.y))); orbitStep(z, zp, c);"}
    if (max(dot(za, za), dot(zb, zb)) > 1e18) { za *= 1e-9; zb *= 1e-9; zpa *= 1e-9; zpb *= 1e-9; ts *= 1e-9; dk += 1.0; }
  }
  if (!done) { g_in = true; return vec3(0.0); }
  ${converge && rootColour(spec) ? `
  float nu = convergedCount(n, step2, prev2);
  float hue = atan(z.y, z.x) / 6.28318530718 + 0.5;
  vec3 base = ramp(hue * float(u_palN) + 0.5);
  // Newton converges in a handful of steps inside a basin and slowly near its boundary, so the
  // brightness falls with the smoothed count and the boundary draws itself in shade.
  // Rings at each whole step of the smoothed count show how the basins nest toward their edges.
  float bright = (1.6 * exp(-0.2 * max(nu, 0.0)) + 0.05) * (0.78 + 0.22 * cos(6.28318530718 * nu));
  return holdGamut(base * bright);` : converge ? `
  // Where c is in the formula (Nova), each pixel settles on its own point, so there is no root to
  // name; the speed of settling is the picture, cycled through the palette as escape counts are.
  float nu = convergedCount(n, step2, prev2);
  return ramp(nu / 6.0);` : `
  float log_r = 0.5 * log(dot(z, z));
  float mu = float(n) - log(max(log_r / LOG2, 1e-6)) / log(u_degree);
  g_mu = mu; g_z = z;
  float glow = exp(-trap * 4.0) * 0.30;
  float shade = reliefDir(vec2(dot(z, za), dot(z, zb)));
  // Distance in pixels from the larger Jacobian column, with the rescales put back.
  float dePx = exp2(log2(0.5 * sqrt(dot(z, z)) * log_r) - log2(max(max(length(za), length(zb)), 1e-30))
                    - dk * 29.8973529 - log2(u_scale / u_resolution.x));
  return holdGamut(colourize(mu, shade, dePx, u_tint * trapWeight(glow)));`}
}

void main() {
  float aspect = u_resolution.y / u_resolution.x;
  // The histogram's first pass (mode 8) takes one sample at the pixel centre and writes mu, packed
  // in 24 bits. It shares this loop: a second call site cost a software rasteriser a second
  // iteration of every pixel in every mode.
  bool muOut = u_colourMode == 8;
  int aa = muOut ? 1 : (u_aa < 1 ? 1 : (u_aa > 4 ? 4 : u_aa));
  g_mu = 0.0;
  float inv = 1.0 / float(aa);
  vec3 acc = vec3(0.0);
  for (int sy = 0; sy < 4; sy++) {
    if (sy >= aa) break;
    for (int sx = 0; sx < 4; sx++) {
      if (sx >= aa) break;
      vec2 sub = (vec2(float(sx), float(sy)) + 0.5) * inv - 0.5;
      vec2 ndc = (gl_FragCoord.xy + sub) / u_resolution - 0.5;
      vec2 uv = vec2(u_center.x + ndc.x * u_scale, u_center.y + ndc.y * u_scale * aspect);
      acc += fractalColor(uv);
    }
  }
  if (muOut) { gl_FragColor = g_in ? vec4(0.0) : packMu(g_mu); return; }
  gl_FragColor = vec4(encodeOut(acc * (inv * inv), gl_FragCoord.xy), 1.0);
}`;
}
