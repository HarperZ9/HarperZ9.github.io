// post.js: the hero's other passes. The water is a wave equation on a 256 x 256 height field (leapfrog, Courant
// 0.5, light damping) that the pointer drops into; the light goes through a soft-knee bloom pyramid, red-first film
// halation (red spreads widest, as light reflected from the film base reaches the red layer first), the raw film
// chain's dye crosstalk, and the Colour Core log-stop curve per channel, then the sRGB encode with a triangular dither.
export const VS = /* glsl */ `#version 300 es
in vec2 p; out vec2 v; void main() { v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

export const SIM = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uPrev; uniform vec2 uTexel; uniform vec4 uDrop; // drop: uv, radius (uv), strength
in vec2 v; out vec4 o;
void main() {
  vec2 s = texture(uPrev, v).rg;  // r = h now, g = h before
  float lap = texture(uPrev, v + vec2(uTexel.x, 0.0)).r + texture(uPrev, v - vec2(uTexel.x, 0.0)).r
            + texture(uPrev, v + vec2(0.0, uTexel.y)).r + texture(uPrev, v - vec2(0.0, uTexel.y)).r - 4.0 * s.r;
  float h = (2.0 * s.r - s.g + 0.25 * lap) * 0.996;   // c^2 dt^2 / dx^2 = 0.25 (Courant 0.5)
  vec2 dd = v - uDrop.xy; dd -= floor(dd + 0.5);
  if (uDrop.w != 0.0) h += uDrop.w * exp(-dot(dd, dd) / (uDrop.z * uDrop.z));
  o = vec4(h, s.r, 0.0, 1.0);
}`;

export const BRIGHT = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uKnee, uThresh;
in vec2 v; out vec4 o;
void main() {
  vec3 c = vec3(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) c += texture(uSrc, v + vec2(x, y) * uTexel).rgb;
  c /= 9.0;
  float l = max(c.r, max(c.g, c.b)), s = clamp(l - uThresh + uKnee, 0.0, 2.0 * uKnee);
  float w = max(s * s / (4.0 * uKnee + 1e-5), l - uThresh) / max(l, 1e-5);
  o = vec4(c * w, 1.0);
}`;

export const BLUR = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uDir;
in vec2 v; out vec4 o;
void main() {
  float w[5] = float[5](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  vec3 c = texture(uSrc, v).rgb * w[0];
  for (int i = 1; i < 5; i++) c += (texture(uSrc, v + uDir * float(i)).rgb + texture(uSrc, v - uDir * float(i)).rgb) * w[i];
  o = vec4(c, 1.0);
}`;

export const COMPOSITE = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uHdr, uB1, uB2; uniform float uBloom, uHalation, uTime, uFade;
in vec2 v; out vec4 o;
// Colour Core log-stop curve (toe 0.22, shoulder 0.58, mid grey 0.18, white 11.2, local contrast 0.34)
float stops(float L) {
  float s = log2(max(L, 1e-6) / 0.18), sp = max(s, 0.0), sn = max(-s, 0.0);
  return (sp / (1.0 + 0.42 * 0.58 * sp) - sn / (1.0 + 0.55 * 0.22 * sn)) * (1.0 + 0.18 * 0.34);
}
float curve(float x) {
  float w = 0.18 * exp2(stops(11.2));
  return clamp(0.18 * exp2(stops(x)) / w, 0.0, 1.0);
}
float enc(float c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = texture(uHdr, v).rgb, b1 = texture(uB1, v).rgb, b2 = texture(uB2, v).rgb;
  c += (b1 * 0.6 + b2 * 0.4) * uBloom;
  // halation: red takes the widest spread, green half of it, blue almost none
  vec3 halo = vec3(b2.r, mix(b1.g, b2.g, 0.5) * 0.45, b1.b * 0.12);
  c += halo * uHalation;
  // dye crosstalk of the raw film chain (diagonal 0.93 to 0.94, small off-diagonal terms), rows normalised
  mat3 X = mat3(0.93, 0.03, 0.02, 0.05, 0.94, 0.04, 0.02, 0.03, 0.94);
  c = X * c;
  vec3 m = vec3(curve(c.r), curve(c.g), curve(c.b));
  vec3 e = vec3(enc(m.r), enc(m.g), enc(m.b));
  float n = hash(gl_FragCoord.xy + fract(uTime) * 61.0) - hash(gl_FragCoord.xy * 1.7 + 13.0);
  o = vec4(e + n / 255.0, uFade);
}`;
