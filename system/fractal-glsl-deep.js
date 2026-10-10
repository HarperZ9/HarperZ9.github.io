// fractal-glsl-deep.js: the deep-zoom fragment program (GLSL ES 3.00, WebGL2).
//
// Each pixel iterates its difference dz from a reference orbit that fractal-perturb.js computed in
// BigInt fixed point (perturbation; see that file for the maths and its sources). The program:
//
// - reads the reference Z_m and Z_m - Z_0 from an RGBA32F texture (texelFetch, no filtering);
// - holds dz as w * 2^e, a float32 pair with its own exponent, renormalised every step, so a delta
//   of 1e-200 is as precise as one of 1e-2 (rescaled perturbation). Terms that fall below float32's
//   range relative to the others flush to zero, which is exactly when they stop mattering;
// - takes bilinear-approximation steps from a second texture where they are valid, skipping up to
//   thousands of iterations in one step;
// - rebases (Zhuoran) when the pixel's orbit passes nearer the start of the reference than the
//   reference itself, which is the correction for the precision glitches of plain perturbation;
// - carries the derivative dz/dpixel the same way, for the relief shading the shallow programs use.
//
// The colour recipe after the loop is the shallow programs' own (RAMP_LIB, SHADE_LIB, ENCODE_LIB),
// so a view crossing from the float32 program into this one keeps its palette, relief and glow.

import { RAMP_LIB, SHADE_LIB, ENCODE_LIB, BAILOUT2 } from "./fractal-glsl-lib.js";
import { ORBIT_GLSL, COLOURIZE_GLSL, DECODE_GLSL } from "./fractal-colouring.js";

export const DEEP_TEX_W = 2048;      // texels per row in the reference and BLA textures
export const DEEP_MAX_LEVELS = 32;

export const DEEP_VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

// GLSL ES 3.00 drops gl_FragColor; the shared libraries are ES 1.00 source and only need these.
const ES3_SHIM = `
out vec4 fragColor;
`;

/**
 * kind: "mandelbrot" | "julia" | "burningship" | "tricorn". bla: whether this program walks the
 * BLA table (holomorphic kinds only).
 */
export function buildDeepFragment(kind, bla) {
  const julia = kind === "julia";
  const useBLA = bla && (kind === "mandelbrot" || julia);
  // One exact perturbed step, in units of 2^e. s = 2^e scales the quadratic term; dcw is dc in the
  // same units. z0 is the full z before the step, for the derivative.
  let step, dstep;
  if (kind === "burningship") {
    step = `
      vec2 Z = R.xy;
      float c = Z.x * Z.y;
      float dd = Z.x * w.y + Z.y * w.x + s * w.x * w.y;   // (X dy + Y dx + dx dy) / 2^e
      float nx = 2.0 * Z.x * w.x - 2.0 * Z.y * w.y + s * (w.x * w.x - w.y * w.y) + dcw.x;
      float ny = 2.0 * diffabsW(c, dd, e) + dcw.y;
      w = vec2(nx, ny);`;
    // The whole Jacobian, as in the shallow Burning Ship program: u = dz/dcx, v = dz/dcy (both per
    // pixel, each with its own exponent).
    dstep = `
      vec2 sg = vec2(z0.x < 0.0 ? -1.0 : 1.0, z0.y < 0.0 ? -1.0 : 1.0);
      vec2 az = abs(z0);
      u = 2.0 * cmul(az, sg * u) + seedU;
      v = 2.0 * cmul(az, sg * v) + vec2(0.0, u_m0 * exp2(u_e0 - fv));`;
  } else if (kind === "tricorn") {
    step = `
      vec2 Z = R.xy;
      vec2 t = 2.0 * cmul(Z, w) + s * cmul(w, w);
      w = vec2(t.x, -t.y) + dcw;`;
    dstep = `
      vec2 tu = 2.0 * cmul(z0, u);
      u = vec2(tu.x, -tu.y) + seedU;`;
  } else {
    step = `
      vec2 Z = R.xy;
      w = 2.0 * cmul(Z, w) + s * cmul(w, w) + dcw;`;
    dstep = `
      u = 2.0 * cmul(z0, u) + seedU;`;
  }

  return `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
${ES3_SHIM}
uniform sampler2D u_ref;        // RGBA32F: (Z.x, Z.y, (Z - Z0).x, (Z - Z0).y) per iteration
uniform sampler2D u_bla;        // RGBA32F: 3 texels per BLA entry (see fractal-perturb.packBLA)
uniform int   u_refLen;         // index of the reference's last entry
uniform int   u_maxIter;
uniform int   u_blaLevels;
uniform int   u_blaOffset[${DEEP_MAX_LEVELS}];
uniform int   u_blaCount[${DEEP_MAX_LEVELS}];
uniform vec2  u_resolution;
uniform vec2  u_refOffset;      // (view centre - reference) in pixels, plane orientation
uniform float u_m0;             // one pixel = u_m0 * 2^u_e0 plane units
uniform float u_e0;
uniform float u_flipY;
uniform int   u_aa;
uniform int   u_glitchView;     // 1: no rebasing, paint Pauldelbrot-flagged pixels in the mark colour
uniform vec4  u_band;           // x0, y0, x1, y1 of the band this draw covers (for long frames)
uniform vec3  u_tint;
uniform vec3  u_mark;           // the glitch mark, linear light
uniform vec2  u_cApprox;        // c to float precision, for the triangle inequality average

const float BAILOUT2 = ${BAILOUT2.toFixed(1)};
const float LOG2 = 0.69314718056;
const int   TEXW = ${DEEP_TEX_W};

${RAMP_LIB}
${SHADE_LIB}
${ENCODE_LIB}
#define texture2D texture
${DECODE_GLSL}${ORBIT_GLSL}${COLOURIZE_GLSL}
float g_mu;
bool  g_in;

vec4 refAt(int m) { return texelFetch(u_ref, ivec2(m % TEXW, m / TEXW), 0); }
vec4 blaAt(int i) { return texelFetch(u_bla, ivec2(i % TEXW, i / TEXW), 0); }
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }

// Keep the mantissa pair inside [1/16, 16] by moving powers of two into the exponent.
void renorm(inout vec2 w, inout float e) {
  float m = max(abs(w.x), abs(w.y));
  if (m == 0.0 || m > 1e30) return;
  if (m > 16.0 || m < 0.0625) {
    float k = floor(log2(m));
    w *= exp2(-k);
    e += k;
  }
}

// |c + d| - |c| with d given in units of 2^e and the answer returned in those units.
float diffabsW(float c, float dw, float e) {
  float d = dw * exp2(e);
  float cw = c == 0.0 ? 0.0 : c * exp2(clamp(-e, -126.0, 126.0));
  if (c >= 0.0) return c + d >= 0.0 ? dw : -(2.0 * cw + dw);
  return c + d > 0.0 ? 2.0 * cw + dw : -dw;
}

// a * 2^ea + b * 2^eb, returned with the larger exponent.
void addExp(inout vec2 a, inout float ea, vec2 b, float eb) {
  if (b == vec2(0.0)) return;
  if (a == vec2(0.0) || eb > ea + 60.0) { a = b; ea = eb; return; }
  if (ea >= eb) a += b * exp2(eb - ea);
  else { a = a * exp2(ea - eb) + b; ea = eb; }
}

vec3 deepColor(vec2 pix) {
  vec2 d0 = (pix + u_refOffset) * u_m0;          // the pixel's offset from the reference, x 2^-e0
  vec2 w; float e; vec2 u; float f;
  ${julia
    ? "w = d0; e = u_e0; u = vec2(u_m0, 0.0); f = u_e0;"
    : "w = vec2(0.0); e = u_e0; u = vec2(0.0); f = u_e0;"}
  renorm(w, e); renorm(u, f);
  vec2 v = vec2(0.0); float fv = u_e0;     // dz/dcy, used by the Burning Ship only
  int m = 0;
  int n = 0;
  vec4 R0 = refAt(0);
  vec4 R = R0;                                 // always Z_m, fetched once per step
  vec2 z = R.xy + w * exp2(e);
  float trap = 1e20;
  bool glitch = false;
  orbitInit();
  g_in = false;
  bool rebase = u_glitchView == 0;
  while (n < u_maxIter) {
    vec2 zq = z;
    bool took = false;
    ${useBLA ? `
    if (m > 0) {
      // A merged step's radius is never larger than that of the first single step inside it, so
      // the search climbs from level 0 and stops at the first level that fails: a pixel the table
      // cannot help costs one fetch, not one per level.
      float ldz = w == vec2(0.0) ? -1e30 : log2(length(w)) + e;
      int j0 = m - 1;
      int base = -1;
      vec4 t0, t1;
      for (int k = 0; k < ${DEEP_MAX_LEVELS}; k++) {
        if (k >= u_blaLevels) break;
        if (k > 0 && (j0 & ((1 << k) - 1)) != 0) break;
        int idx = j0 >> k;
        if (idx >= u_blaCount[k]) break;
        int b = (u_blaOffset[k] + idx) * 3;
        vec4 c0 = blaAt(b);
        if (!(ldz < c0.w)) break;
        vec4 c1 = blaAt(b + 1);
        // A step of length zero would never end the loop; a table that reads as zeros is no table.
        if (int(c1.w + 0.5) < 1 || n + int(c1.w + 0.5) > u_maxIter) break;
        base = b; t0 = c0; t1 = c1;
      }
      if (base >= 0) {
        int l = int(t1.w + 0.5);
        // dz <- A dz + B dc ; D <- A D + B * (one pixel)
        vec2 nw = cmul(t0.xy, w); float ne = e + t0.z;
        vec2 nu = cmul(t0.xy, u); float nf = f + t0.z;
        ${julia ? "" : `
        addExp(nw, ne, cmul(t1.xy, d0), u_e0 + t1.z);
        addExp(nu, nf, t1.xy * u_m0, u_e0 + t1.z);`}
        w = nw; e = ne; u = nu; f = nf;
        trap = min(trap, blaAt(base + 2).x);
        m += l; n += l;
        took = true;
      }
    }` : ""}
    if (!took) {
      float s = exp2(e);
      vec2 dcw = ${julia ? "vec2(0.0)" : "d0 * exp2(u_e0 - e)"};
      vec2 seedU = ${julia ? "vec2(0.0)" : "vec2(u_m0 * exp2(u_e0 - f), 0.0)"};
      vec2 z0 = z;
      ${step}
      ${dstep}
      m++; n++;
    }
    renorm(w, e); renorm(u, f);${kind === "burningship" ? " renorm(v, fv);" : ""}
    R = refAt(m);
    vec2 dz = w * exp2(e);
    z = R.xy + dz;
    float r2 = dot(z, z);
    if (r2 > BAILOUT2) break;
    if (!took) { trap = min(trap, min(abs(z.x), abs(z.y))); orbitStep(z, zq, u_cApprox); }
    if (r2 < 1e-6 * dot(R.xy, R.xy)) glitch = true;     // Pauldelbrot's criterion
    vec2 zr = R.zw + dz;
    if (rebase && (dot(zr, zr) < dot(dz, dz) || m >= u_refLen)) {
      w = zr; e = 0.0; renorm(w, e);
      m = 0;
      R = R0;
    } else if (!rebase && m >= u_refLen) {
      break;
    }
  }
  if (u_glitchView == 1 && glitch) return u_mark;
  if (n >= u_maxIter) { g_in = true; return vec3(0.0); }
  float log_r = 0.5 * log(dot(z, z));
  float mu = float(n) - log(log_r / LOG2) / LOG2;
  g_mu = mu; g_z = z;
  float glow = exp(-trap * 4.0) * 0.30;
  ${kind === "burningship"
    ? "float shade = reliefDir(vec2(dot(z, u), dot(z, v) * exp2(clamp(fv - f, -100.0, 100.0))));"
    : "float shade = relief(z, u);"}
  // u is dz per pixel already, so the distance comes out in pixels with no view scale.
  float dePx = exp2(log2(0.5 * sqrt(dot(z, z)) * log_r) - (log2(max(length(u), 1e-30)) + f));
  return holdGamut(colourize(mu, shade, dePx, u_tint * trapWeight(glow)));
}

void main() {
  if (gl_FragCoord.x < u_band.x || gl_FragCoord.y < u_band.y || gl_FragCoord.x >= u_band.z || gl_FragCoord.y >= u_band.w) discard;
  if (u_colourMode == 8) {
    vec2 pix0 = gl_FragCoord.xy - 0.5 * u_resolution;
    pix0.y *= u_flipY;
    deepColor(pix0);
    fragColor = g_in ? vec4(0.0) : packMu(g_mu);
    return;
  }
  int aa = u_aa < 1 ? 1 : (u_aa > 4 ? 4 : u_aa);
  float inv = 1.0 / float(aa);
  vec3 acc = vec3(0.0);
  for (int sy = 0; sy < 4; sy++) {
    if (sy >= aa) break;
    for (int sx = 0; sx < 4; sx++) {
      if (sx >= aa) break;
      vec2 sub = (vec2(float(sx), float(sy)) + 0.5) * inv - 0.5;
      vec2 pix = gl_FragCoord.xy + sub - 0.5 * u_resolution;
      pix.y *= u_flipY;
      acc += deepColor(pix);
    }
  }
  fragColor = vec4(encodeOut(acc * (inv * inv), gl_FragCoord.xy), 1.0);
}`;
}
