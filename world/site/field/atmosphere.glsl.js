// atmosphere.glsl.js: a physically based sky after Hillaire, "A Scalable and Production Ready Sky and Atmosphere
// Rendering Technique" (EGSR 2020): a transmittance table, a multiple-scattering table, and a sky-view table each
// frame. Constants are Earth's from that paper, which takes them from Bruneton and Neyret (2008) and Bruneton's
// reference implementation (2017): Rayleigh scattering (5.802, 13.558, 33.1) per Mm at 680, 550 and 440 nm with an
// 8 km scale height; Mie scattering 3.996 and absorption 4.40 per Mm, 1.2 km scale height, Cornette-Shanks phase
// with g = 0.8; ozone absorption (0.650, 1.881, 0.085) per Mm in a tent from 10 to 40 km; ground radius 6360 km,
// top 6460 km. Units here are kilometres.
export const ATMOS = `
const float PI = 3.14159265359;
const float RG = 6360.0, RT = 6460.0;
const vec3 RAY_S = vec3(5.802, 13.558, 33.1) * 1e-3;
const float RAY_H = 8.0;
const float MIE_S = 3.996e-3, MIE_A = 4.40e-3, MIE_H = 1.2, MIE_G = 0.8;
const vec3 OZO_A = vec3(0.650, 1.881, 0.085) * 1e-3;
vec3 extinctionAt(float h) {
  return RAY_S * exp(-h / RAY_H) + vec3(MIE_S + MIE_A) * exp(-h / MIE_H) + OZO_A * max(0.0, 1.0 - abs(h - 25.0) / 15.0);
}
float raySphere(vec3 ro, vec3 rd, float R) {
  float b = dot(ro, rd), c = dot(ro, ro) - R * R, d = b * b - c;
  if (d < 0.0) return -1.0;
  float s = sqrt(d), t0 = -b - s, t1 = -b + s;
  return t0 > 0.0 ? t0 : (t1 > 0.0 ? t1 : -1.0);
}
float phaseRay(float c) { return 3.0 / (16.0 * PI) * (1.0 + c * c); }
float phaseMie(float c) { float g = MIE_G, k = 3.0 / (8.0 * PI) * (1.0 - g * g) / (2.0 + g * g); return k * (1.0 + c * c) / pow(1.0 + g * g - 2.0 * g * c, 1.5); }
vec2 transUV(float h, float mu) { return vec2(mu * 0.5 + 0.5, sqrt(clamp(h / (RT - RG), 0.0, 1.0))); }
`;

export const TRANS_FRAG = `#version 300 es
precision highp float;
${ATMOS}
in vec2 v; out vec4 o;
void main() {
  float mu = v.x * 2.0 - 1.0, h = v.y * v.y * (RT - RG);
  vec3 ro = vec3(0.0, RG + h, 0.0), rd = vec3(sqrt(max(0.0, 1.0 - mu * mu)), mu, 0.0);
  if (raySphere(ro, rd, RG) > 0.0) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float t = raySphere(ro, rd, RT), dt = t / 40.0; vec3 od = vec3(0.0);
  for (int i = 0; i < 40; i++) { vec3 p = ro + rd * (float(i) + 0.5) * dt; od += extinctionAt(length(p) - RG) * dt; }
  o = vec4(exp(-od), 1.0);
}`;

// multiple scattering: Hillaire's isotropic second-order integral over 64 directions, psi = L2 / (1 - f_ms)
export const MS_FRAG = `#version 300 es
precision highp float;
${ATMOS}
uniform sampler2D uTrans;
in vec2 v; out vec4 o;
void main() {
  float muS = v.x * 2.0 - 1.0, h = max(0.01, v.y * (RT - RG));
  vec3 ro = vec3(0.0, RG + h, 0.0), sun = vec3(sqrt(max(0.0, 1.0 - muS * muS)), muS, 0.0);
  vec3 L2 = vec3(0.0), fms = vec3(0.0);
  for (int i = 0; i < 64; i++) {
    float fi = float(i) + 0.5, cz = 1.0 - 2.0 * fi / 64.0, ph = PI * (1.0 + sqrt(5.0)) * fi;
    vec3 rd = vec3(sqrt(1.0 - cz * cz) * cos(ph), cz, sqrt(1.0 - cz * cz) * sin(ph));
    float tg = raySphere(ro, rd, RG), tt = raySphere(ro, rd, RT), tmax = tg > 0.0 ? tg : tt, dt = tmax / 20.0;
    vec3 T = vec3(1.0);
    for (int j = 0; j < 20; j++) {
      vec3 p = ro + rd * (float(j) + 0.5) * dt; float r = length(p), hh = r - RG;
      vec3 up = p / r, ext = extinctionAt(hh), Ts = exp(-ext * dt);
      vec3 scat = RAY_S * exp(-hh / RAY_H) + vec3(MIE_S * exp(-hh / MIE_H));
      vec3 sunT = texture(uTrans, transUV(hh, dot(up, sun))).rgb;
      vec3 S = scat * sunT / (4.0 * PI), F = scat;
      L2 += T * (S - S * Ts) / ext; fms += T * (F - F * Ts) / ext;
      T *= Ts;
    }
    if (tg > 0.0) { vec3 p = ro + rd * tg, up = normalize(p); L2 += T * texture(uTrans, transUV(0.0, dot(up, sun))).rgb * max(dot(up, sun), 0.0) * 0.3 / PI; }
  }
  L2 /= 64.0; fms /= 64.0;
  o = vec4(L2 / (1.0 - fms), 1.0);
}`;

// sky view: radiance for a light of unit illuminance, by azimuth from the light and elevation (dense near the
// horizon); the viewer stands at uViewH km
export const SKY_FRAG = `#version 300 es
precision highp float;
${ATMOS}
uniform sampler2D uTrans, uMS; uniform vec3 uL; uniform float uViewH;
in vec2 v; out vec4 o;
void main() {
  float az = v.x * PI, el = -0.2 + (PI * 0.5 + 0.2) * v.y * v.y;
  vec3 ro = vec3(0.0, RG + uViewH, 0.0);
  vec3 Lh = normalize(vec3(length(uL.xz), uL.y, 0.0));
  vec3 rd = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
  float tg = raySphere(ro, rd, RG), tt = raySphere(ro, rd, RT), tmax = tg > 0.0 ? tg : tt, dt = tmax / 32.0, c = dot(rd, Lh);
  vec3 T = vec3(1.0), L = vec3(0.0);
  for (int j = 0; j < 32; j++) {
    float tj = (float(j) + 0.5) * dt; vec3 p = ro + rd * tj; float r = length(p), hh = r - RG;
    vec3 up = p / r, ext = extinctionAt(hh), Ts = exp(-ext * dt); float muS = dot(up, Lh);
    vec3 rs = RAY_S * exp(-hh / RAY_H); float ms = MIE_S * exp(-hh / MIE_H);
    vec3 sunT = texture(uTrans, transUV(hh, muS)).rgb, psi = texture(uMS, vec2(muS * 0.5 + 0.5, hh / (RT - RG))).rgb;
    vec3 S = sunT * (rs * phaseRay(c) + ms * phaseMie(c)) + psi * (rs + ms);
    L += T * (S - S * Ts) / ext; T *= Ts;
  }
  o = vec4(L, 1.0);
}`;
