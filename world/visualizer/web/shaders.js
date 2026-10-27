// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// shaders.js: the live twin of render/seabed.mjs, in WebGL2. Same model and constants: the wave-equation surface
// (from the glass module's Water, stepped in a worker) plus a 32-wave random-phase sea (the same spectrum() as the
// offline renderer, passed as uniforms); caustics as the inverse area change of the refracted bundle; the floor's
// four-stop ramp mixed in sRGB with light from the top. Two passes: CAUSTIC_FS at half size into a float target
// (irradiance and slope), FLOOR_FS at full size. The glass pass is the glass module's own GLASS_FS.
import { COMMON } from '../../glass/lib/gl.js';

const HEAD = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform vec2 u_res;
${COMMON}
vec2 pix() { return vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y); }
`;

// Height at a point in caustic-map pixels: the simulation (cubic B-spline of the grid) plus the fine sea.
export const CAUSTIC_FS = HEAD + `
uniform sampler2D u_water; uniform vec2 u_waterRes;
uniform float u_t, u_lam, u_speed, u_fine, u_simGain, u_focus, u_floor, u_has;
uniform vec4 u_wave[32];      // kx, ky, L, phase
uniform float u_amp[32];
vec4 bs(float t) { float t2 = t * t, t3 = t2 * t; return vec4(1.0 - 3.0 * t + 3.0 * t2 - t3, 4.0 - 6.0 * t2 + 3.0 * t3, 1.0 + 3.0 * t + 3.0 * t2 - 3.0 * t3, t3) / 6.0; }
float sim(vec2 g) {
  vec2 f = floor(g); vec4 wx = bs(g.x - f.x), wy = bs(g.y - f.y); float v = 0.0;
  for (int j = 0; j < 4; j++) { float r = 0.0; for (int i = 0; i < 4; i++) { ivec2 q = ivec2(clamp(f + vec2(float(i) - 1.0, float(j) - 1.0), vec2(0.0), u_waterRes - 1.0)); r += wx[i] * texelFetch(u_water, q, 0).r; } v += wy[j] * r; }
  return v;
}
float H(vec2 p) {
  float v = u_has > 0.5 ? u_simGain * 2.2 * (u_waterRes.x / u_res.x) * sim(p / u_res * u_waterRes - 0.5) : 0.0, s = 0.0;
  for (int k = 0; k < 32; k++) { vec4 q = u_wave[k]; s += u_amp[k] * sin(6.2831853 * ((q.x * p.x + q.y * p.y) / (q.z * u_lam) - u_speed * u_t / sqrt(q.z)) + q.w); }
  return v + u_fine * 0.1 * u_lam * s / 5.6;
}
void main() {
  vec2 p = pix(); float c = H(p), a = H(p + vec2(1, 0)), b = H(p - vec2(1, 0)), d = H(p + vec2(0, 1)), e = H(p - vec2(0, 1));
  float hxx = a - 2.0 * c + b, hyy = d - 2.0 * c + e, hxy = 0.25 * (H(p + vec2(1, 1)) - H(p + vec2(-1, 1)) - H(p + vec2(1, -1)) + H(p + vec2(-1, -1)));
  float det = (1.0 + u_focus * hxx) * (1.0 + u_focus * hyy) - u_focus * u_focus * hxy * hxy;
  o = vec4(min(1.0 / u_floor, 1.0 / max(u_floor, abs(det))), 0.5 * (a - b), 0.5 * (d - e), 1.0);
}`;

// The floor: hash-noise sand under a raking light, defocused by construction (smooth noise), coloured by four
// stops in sRGB, lit from the top; then lensed by the slope and lit by the caustic map.
export const FLOOR_FS = HEAD + `
uniform sampler2D u_caus, u_water; uniform vec2 u_causRes, u_waterRes;
uniform float u_crest, u_crestLevel, u_hasW; uniform vec3 u_crestC;
vec4 bs(float t) { float t2 = t * t, t3 = t2 * t; return vec4(1.0 - 3.0 * t + 3.0 * t2 - t3, 4.0 - 6.0 * t2 + 3.0 * t3, 1.0 + 3.0 * t + 3.0 * t2 - 3.0 * t3, t3) / 6.0; }
float sim(vec2 g) {
  vec2 f = floor(g); vec4 wx = bs(g.x - f.x), wy = bs(g.y - f.y); float v = 0.0;
  for (int j = 0; j < 4; j++) { float r = 0.0; for (int i = 0; i < 4; i++) { ivec2 q = ivec2(clamp(f + vec2(float(i) - 1.0, float(j) - 1.0), vec2(0.0), u_waterRes - 1.0)); r += wx[i] * texelFetch(u_water, q, 0).r; } v += wy[j] * r; }
  return v;
}
uniform vec3 u_s0, u_s1, u_s2, u_s3;     // sRGB stops
uniform float u_gain, u_light, u_relief, u_caustic, u_exposure, u_depth, u_contrast;
float vn(vec2 q) { vec2 i = floor(q), f = fract(q); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float sand(vec2 p) { float s = 0.0, a = 0.5; vec2 q = p; for (int k = 0; k < 4; k++) { s += a * vn(q); q = q * 2.03 + 17.1; a *= 0.5; } return s; }
vec3 ramp(float q) { q = clamp(q, 0.0, 1.0) * 3.0; vec3 c = q < 1.0 ? mix(u_s0, u_s1, q) : q < 2.0 ? mix(u_s1, u_s2, q - 1.0) : mix(u_s2, u_s3, q - 2.0); return toLin(c); }
void main() {
  vec2 p = pix(), u = p / u_res; vec4 C = texture(u_caus, vec2(u.x, 1.0 - u.y));
  vec2 sp = p - u_depth * u_res.y * C.gb * 0.08;   // same offset as seabed.mjs: depth in px times the slope
  vec2 su = sp / u_res.y * 34.0;
  float rel = 0.5 + u_relief * (sand(su) - 0.5 + 0.6 * (sand(su + vec2(0.07, 0.05)) - sand(su)));
  float pool = exp(-(pow((u.x - 0.62) / 0.5, 2.0) + pow((u.y - 0.2) / 0.55, 2.0)));
  float top = (1.0 - u_light * pow(u.y, 0.9)) * (0.55 + 0.45 * pool);
  vec3 floorC = ramp(u_gain * 1.45 * rel * top);
  float mean = textureLod(u_caus, vec2(0.5), 16.0).r;   // the 1 x 1 mip: the map's mean, so open floor averages 1
  float L = pow(C.r / max(1e-3, mean), u_contrast), k = u_exposure * (1.0 + u_caustic * (1.0 - 0.55 * pow(u.y, 1.3)) * (L - 1.0));
  // the same soft shoulder as finish.mjs (knee 0.82): caustic peaks roll off instead of clipping (R6)
  vec3 v = floorC * k;
  if (u_hasW > 0.5 && u_crest > 0.0) {   // the drop wavefronts, as seabed.mjs draws them: a contour of the surface
    vec2 g = u * u_waterRes - 0.5; float cell = u_res.x / u_waterRes.x;
    float u0 = sim(g), dx = (sim(g + vec2(0.25, 0.0)) - sim(g - vec2(0.25, 0.0))) * 2.0 / cell, dy = (sim(g + vec2(0.0, 0.25)) - sim(g - vec2(0.0, 0.25))) * 2.0 / cell;
    float gm = length(vec2(dx, dy)), d = abs(u0 - u_crestLevel) / max(1e-6, gm);
    v += u_crest * max(0.0, 1.0 - d / 0.9) * min(1.0, gm * cell * 4.0) * u_crestC;
  }
  v = mix(v, 0.82 + 0.18 * (1.0 - exp(-(v - 0.82) / 0.18)), step(0.82, v));
  o = vec4(v, 1.0);
}`;

// Bilinear upsampling of the ribbon body (height, coverage) to the canvas size, so the glass pass can fetch it
// per pixel; a 3-tap tent along each axis takes the corners off the half-size texels.
export const BODYUP_FS = HEAD + `
uniform sampler2D u_src; uniform vec2 u_srcRes;
// rows are written so that GLASS_FS's top-down texelFetch reads source row r at target row r
void main() { vec2 q = gl_FragCoord.xy / u_res; vec2 d = 0.5 / u_srcRes;
  vec4 s = 0.25 * (texture(u_src, q + vec2(d.x, d.y)) + texture(u_src, q + vec2(-d.x, d.y)) + texture(u_src, q + vec2(d.x, -d.y)) + texture(u_src, q - d));
  o = vec4(s.rg, 0.0, 1.0); }`;

// The meter figure, drawn on a 2D canvas, added as light to the floor before the glass pass, so the glass refracts it
// as it does offline (vis.phosphor sits under vis.ribbons in the scene graph). Blend ONE, ONE in linear light.
export const ADD_FS = HEAD + `
uniform sampler2D u_fig; uniform float u_gain; uniform vec4 u_box;   // the figure canvas covers x, y, w, h in pixels
void main() { vec2 q = (pix() - u_box.xy) / u_box.zw; if (any(lessThan(q, vec2(0.0))) || any(greaterThan(q, vec2(1.0)))) { o = vec4(0.0); return; }
  vec4 f = texture(u_fig, q); o = vec4(f.rgb * f.a * u_gain, 1.0); }`;
