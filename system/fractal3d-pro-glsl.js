// fractal3d-pro-glsl.js: the progressive 3D fractal renderer's programs (GLSL ES 3.00).
//
// One frame adds one sample per pixel to a float accumulation target: a sub-pixel jitter for
// anti-aliasing and a jittered point on a thin lens for depth of field, so a still view converges
// to a clean, defocused image over a few dozen frames. Each sample is a sphere-traced ray with
//   - a pixel-cone hit threshold (the hit tightens up close and relaxes far away);
//   - physically based shading: GGX microfacet specular with Smith-Schlick visibility and Schlick's
//     Fresnel, Lambert diffuse weighted by 1 - F and 1 - metalness (Walter et al. 2007; Karis 2013);
//   - a sun with a soft shadow (Quilez's k h / t penumbra), a sky dome, and a ground bounce;
//   - ambient occlusion from five distance-field taps along the normal (Quilez);
//   - an orbit-trap albedo on the Studio's palette ramp (RAMP_LIB, OKLab stops, linear light);
//   - glow from the march's near misses, and exponential height fog.
// The display program divides by the sample count, tone-maps (Narkowicz's ACES fit) and encodes
// to sRGB with the shared dither (ENCODE_LIB). Everything before the encode is linear light.

import { RAMP_LIB, ENCODE_LIB } from "./fractal-glsl-lib.js";
import { DE_GLSL, buildDE } from "./fractal3d-de.js";

export const VERT3 = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

export function buildSampleProgram(kind, seq) {
  return `#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
uniform vec2  u_resolution;
uniform vec3  u_eye, u_fwd, u_right, u_up;
uniform float u_tanHalf;
uniform float u_aperture;      // lens radius, scene units
uniform float u_focus;         // focus distance, scene units
uniform vec2  u_jitter;        // sub-pixel offset this frame, pixels
uniform vec2  u_lens;          // point on the unit disk this frame
uniform int   u_iterations;
uniform int   u_maxSteps;
uniform float u_maxDist;
uniform float u_fudge;         // step multiplier, below 1 for formulas whose estimate overshoots
uniform vec3  u_sunDir;
uniform vec3  u_sunColor;
uniform vec3  u_skyColor;
uniform vec3  u_groundColor;
uniform float u_shadowK;       // penumbra sharpness
uniform float u_aoStrength;
uniform float u_roughness;
uniform float u_metalness;
uniform float u_trapScale;     // palette cycles per unit of the orbit trap
uniform float u_trapOffset;
uniform float u_glow;
uniform vec3  u_glowColor;
uniform float u_fog;           // fog density per scene unit
uniform vec3  u_fogColor;
uniform int   u_bgMode;        // 0 sky gradient, 1 palette, 2 black
uniform int   u_depthOut;      // 1: write the hit distance instead of a colour (double-click focus)
${RAMP_LIB}
${DE_GLSL}
${buildDE(kind, seq)}

vec3 calcNormal(vec3 p, float h) {
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * de(p + k.xyy * h) + k.yyx * de(p + k.yyx * h) + k.yxy * de(p + k.yxy * h) + k.xxx * de(p + k.xxx * h));
}
float softShadow(vec3 ro, vec3 rd, float mint, float maxt) {
  float res = 1.0, t = mint;
  for (int i = 0; i < 64; i++) {
    float h = de(ro + rd * t);
    if (h < 1e-4) return 0.0;
    res = min(res, u_shadowK * h / t);
    t += clamp(h, 0.005, 0.3);
    if (t > maxt) break;
  }
  return clamp(res, 0.0, 1.0);
}
float ambientOcclusion(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.01 + 0.12 * float(i) / 5.0;
    occ += (h - de(p + n * h)) * sca;
    sca *= 0.9;
  }
  return clamp(1.0 - u_aoStrength * 3.0 * occ, 0.0, 1.0);
}
vec3 background(vec3 rd) {
  if (u_bgMode == 2) return vec3(0.0);
  if (u_bgMode == 1) return ramp(0.0) * 0.6 + ramp(rd.y * 3.0 + 1.0) * 0.15;
  // A calm dark ground with a faint lift toward the zenith; the sky light still comes from u_skyColor.
  return mix(vec3(0.010, 0.010, 0.013), vec3(0.085, 0.095, 0.125), smoothstep(-0.3, 0.9, rd.y));
}
// GGX normal distribution, Smith-Schlick visibility, Schlick Fresnel.
vec3 brdf(vec3 n, vec3 v, vec3 l, vec3 albedo) {
  vec3 h = normalize(v + l);
  float nl = max(dot(n, l), 0.0), nv = max(dot(n, v), 1e-4), nh = max(dot(n, h), 0.0), vh = max(dot(v, h), 0.0);
  float a = max(u_roughness * u_roughness, 1e-3), a2 = a * a;
  float dd = nh * nh * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159265 * dd * dd);
  float k = (u_roughness + 1.0) * (u_roughness + 1.0) / 8.0;
  float G = (nl / (nl * (1.0 - k) + k)) * (nv / (nv * (1.0 - k) + k));
  vec3 F0 = mix(vec3(0.04), albedo, u_metalness);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - vh, 5.0);
  vec3 spec = D * G * F / max(4.0 * nl * nv, 1e-4);
  vec3 diff = (1.0 - F) * (1.0 - u_metalness) * albedo / 3.14159265;
  return (diff + spec) * nl;
}

void main() {
  vec2 frag = gl_FragCoord.xy + u_jitter - 0.5 * u_resolution;
  vec2 uv = frag / (0.5 * u_resolution.y);
  vec3 dir = normalize(u_fwd + u_right * uv.x * u_tanHalf + u_up * uv.y * u_tanHalf);
  // Thin lens: start the ray on the aperture and aim it through the in-focus point.
  vec3 ro = u_eye, rd = dir;
  if (u_aperture > 0.0) {
    vec3 focal = u_eye + dir * (u_focus / max(dot(dir, u_fwd), 1e-3));
    ro = u_eye + (u_right * u_lens.x + u_up * u_lens.y) * u_aperture;
    rd = normalize(focal - ro);
  }
  float pixelAngle = 2.0 * u_tanHalf / u_resolution.y;
  float t = 1e-3, glow = 0.0;
  bool hit = false;
  for (int i = 0; i < 1024; i++) {
    if (i >= u_maxSteps) break;
    float d = de(ro + rd * t);
    glow += exp(-60.0 * d);
    if (d < max(1e-5, pixelAngle * t * 0.5)) { hit = true; break; }
    t += d * u_fudge;
    if (t > u_maxDist) break;
  }
  if (u_depthOut == 1) { fragColor = vec4(hit ? t : -1.0, 0.0, 0.0, 1.0); return; }
  vec3 col;
  if (!hit) {
    col = background(rd);
  } else {
    vec3 p = ro + rd * t;
    float trap = g_trap;
    vec3 n = calcNormal(p, max(1e-5, pixelAngle * t * 0.5));
    vec3 v = -rd;
    vec3 albedo = ramp(sqrt(trap) * u_trapScale + u_trapOffset);
    float sh = softShadow(p + n * 2e-3, u_sunDir, 0.01, u_maxDist);
    float ao = ambientOcclusion(p, n);
    col = brdf(n, v, u_sunDir, albedo) * u_sunColor * sh;
    col += albedo * u_skyColor * (0.5 + 0.5 * n.y) * ao * 0.35 * (1.0 - u_metalness * 0.6);
    col += albedo * u_groundColor * clamp(-n.y, 0.0, 1.0) * ao * 0.15;
    // A metal reflects the sky it faces, dimmed where the surface hides it.
    vec3 r = reflect(rd, n);
    col += mix(vec3(0.04), albedo, u_metalness) * background(r) * ao * (1.0 - u_roughness) * 0.5;
    col *= mix(1.0, ao, 0.5);
  }
  col += u_glowColor * u_glow * min(glow, 30.0) * 0.01;
  // Exponential fog over the ray length, thicker low down.
  float fog = 1.0 - exp(-u_fog * (hit ? t : u_maxDist) * exp(-max(0.0, (ro + rd * min(t, u_maxDist)).y) * 0.5));
  col = mix(col, u_fogColor, clamp(fog, 0.0, 1.0));
  fragColor = vec4(max(col, 0.0), 1.0);
}`;
}

export function buildDisplayProgram() {
  return `#version 300 es
precision highp float;
out vec4 fragColor;
uniform highp sampler2D u_acc;
uniform float u_exposure;
${ENCODE_LIB}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec4 a = texelFetch(u_acc, ivec2(gl_FragCoord.xy), 0);
  vec3 c = a.a > 0.0 ? a.rgb / a.a : vec3(0.0);
  fragColor = vec4(encodeOut(aces(c * u_exposure), gl_FragCoord.xy), 1.0);
}`;
}
