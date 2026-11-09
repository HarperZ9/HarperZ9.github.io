// fractal-glsl-lyapunov.js: the Markus-Lyapunov fractal (Mario Markus, 1990).
//
// Each point (a, b) of the plane sets two growth rates for the logistic map x <- r x (1 - x). A
// sequence of letters (AB, AABAB, ...) says which rate each step uses. After a warm-up, the program
// averages ln|r (1 - 2x)|, the log of the map's slope along the orbit: the Lyapunov exponent. Below
// zero the orbit settles (order); above zero nearby orbits fly apart (chaos).
//
// Order takes the palette from its darkest stop to its lightest as the exponent falls, so the most
// stable regions read brightest; chaos stays dark, its own shade deepening with the exponent. The
// sequence arrives as a bit mask (A = 0, B = 1, first letter in bit 0), read with floor and mod
// because GLSL ES 1.00 has no integer bit operations.

import { RAMP_LIB, SHADE_LIB, ENCODE_LIB, MAX_ITERS } from "./fractal-glsl-lib.js";

export const MAX_SEQ = 16;

/** Parse a sequence like "AABAB" (A and B only, up to 16 letters). */
export function lyapunovSequence(text) {
  const s = String(text || "AB").toUpperCase().replace(/[^AB]/g, "").slice(0, MAX_SEQ) || "AB";
  let mask = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === "B") mask += 2 ** i;
  return { text: s, mask, length: s.length };
}

/** The exponent at one point, on the CPU: the twin of the shader loop below. */
export function lyapunovExponent(a, b, seq, iters = 200, warmup = 100, x0 = 0.5) {
  const { text } = typeof seq === "string" ? lyapunovSequence(seq) : seq;
  let x = x0, k = 0, sum = 0;
  for (let i = 0; i < warmup; i++) { const r = text[k] === "B" ? b : a; x = r * x * (1 - x); k = (k + 1) % text.length; }
  for (let i = 0; i < iters; i++) {
    const r = text[k] === "B" ? b : a;
    x = r * x * (1 - x);
    sum += Math.log(Math.max(Math.abs(r * (1 - 2 * x)), 1e-30));
    k = (k + 1) % text.length;
  }
  return sum / iters;
}

export function buildLyapunovFragment() {
  return `precision highp float;

uniform vec2  u_resolution;
uniform vec2  u_center;
uniform float u_scale;
uniform int   u_maxIter;
uniform float u_seq;        // bit mask of the sequence, B = 1
uniform int   u_seqLen;
uniform int   u_warmup;
uniform float u_x0;
uniform vec3  u_tint;
uniform int   u_aa;

const int MAX_ITERS = ${MAX_ITERS};

${RAMP_LIB}
${SHADE_LIB}
${ENCODE_LIB}

float letter(int k) { return mod(floor(u_seq / exp2(float(k))), 2.0); }

float exponent(vec2 ab) {
  float x = u_x0;
  int k = 0;
  for (int i = 0; i < 400; i++) {
    if (i >= u_warmup) break;
    float r = letter(k) > 0.5 ? ab.y : ab.x;
    x = r * x * (1.0 - x);
    k++; if (k >= u_seqLen) k = 0;
  }
  float sum = 0.0;
  for (int i = 0; i < MAX_ITERS; i++) {
    if (i >= u_maxIter) break;
    float r = letter(k) > 0.5 ? ab.y : ab.x;
    x = r * x * (1.0 - x);
    sum += log(max(abs(r * (1.0 - 2.0 * x)), 1e-30));
    k++; if (k >= u_seqLen) k = 0;
  }
  return sum / float(u_maxIter);
}

vec3 lyapColor(vec2 ab) {
  float l = exponent(ab);
  if (l < 0.0) {
    float t = 1.0 - exp(l * 1.6);           // 0 at the edge of chaos, toward 1 deep in order
    return holdGamut(ramp(t * float(u_palN - 1)) * (0.55 + 0.6 * t));
  }
  return ramp(0.15) * exp(-l * 2.5) * 0.7;
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
      acc += lyapColor(vec2(u_center.x + ndc.x * u_scale, u_center.y + ndc.y * u_scale * aspect));
    }
  }
  gl_FragColor = vec4(encodeOut(acc * (inv * inv), gl_FragCoord.xy), 1.0);
}`;
}
