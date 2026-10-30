// scene.js: the hero's spectral scene shader. One pass shades sky, water and the glass name in N wavelength bins
// (8 on desktop, 3 on weak devices) and integrates them to CIE XYZ with each bin's colour-matching weights, then to
// linear sRGB through the light's adaptation matrix. Geometry is computed once per pixel; only the optics that
// depend on wavelength run inside the bin loop, except under the glass, where each bin sees the scene behind at its
// own refracted offset (that is the dispersion).
import { OPTICS } from "./optics.js";

export const sceneFS = (N) => /* glsl */ `#version 300 es
precision highp float;
#define N ${N}
uniform vec2 uRes; uniform float uTime, uAspect, uExposure, uNight;
uniform sampler2D uGlyph, uSim;
uniform vec2 uGlyphTexel; uniform float uRod;  // rod radius in glyph texels
uniform vec4 uCam;      // camera height (m), glass plane distance (m), focal length, horizon height on screen
uniform vec3 uLampDir;  // unit vector toward the lamp
uniform vec3 uShore[4]; // far shore lamps (same SPD), weaker and smaller, so the whole sea carries glints
uniform vec4 uLampSize; // angular radius, disc power, glow power, haze g
uniform vec4 uFill;     // direction toward the fill light (moon or high sky, behind the viewer), power
uniform float uLam[N], uNg[N], uNw[N], uAw[N], uAg[N], uSL[N], uSZ[N], uSH[N];
uniform vec3 uW[N];
uniform mat3 uToRGB;
uniform vec4 uWave;     // sim patch size (m), sim strength, gerstner amplitude, floor albedo
out vec4 o;
${OPTICS}
const float SIM_NORMAL = 1.0;
vec3 rayOf(vec2 uv) { return normalize(vec3((uv.x - 0.5) * uAspect, uv.y - uCam.w, uCam.z)); }
vec2 uvOf(vec3 q) { return vec2(q.x * uCam.z / q.z / uAspect + 0.5, (q.y - uCam.x) * uCam.z / q.z + uCam.w); }
float simH(vec2 xz) { return texture(uSim, vec2(xz.x / uWave.x + 0.5, xz.y / uWave.x)).r; }
// Gerstner swell slopes, deep-water dispersion omega^2 = g k
vec2 swell(vec2 xz, float t) {
  vec2 s = vec2(0.0);
  vec3 W[3] = vec3[3](vec3(0.8, 0.6, 0.9), vec3(-0.5, 0.86, 1.7), vec3(0.2, 0.98, 3.1));
  for (int k = 0; k < 3; k++) { vec2 dir = W[k].xy; float kk = W[k].z, w = sqrt(9.81 * kk), a = uWave.z / kk;
    s += dir * kk * a * cos(kk * dot(dir, xz) - w * t); }
  return s;
}
vec4 glyph(vec2 uv) { return texture(uGlyph, uv); }   // r height (0..1), g coverage
vec3 glyphNormal(vec2 uv) {
  float hx = glyph(uv + vec2(uGlyphTexel.x, 0.0)).r - glyph(uv - vec2(uGlyphTexel.x, 0.0)).r;
  float hy = glyph(uv + vec2(0.0, uGlyphTexel.y)).r - glyph(uv - vec2(0.0, uGlyphTexel.y)).r;
  return normalize(vec3(-hx * uRod * 0.5, -hy * uRod * 0.5, 1.0));
}
float lampTerm(vec3 d) {
  float c = dot(d, uLampDir), ang = acos(clamp(c, -1.0, 1.0));
  float disc = smoothstep(uLampSize.x * 1.2, uLampSize.x * 0.8, ang) * uLampSize.y;
  float g = uLampSize.w, hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5);
  float shore = 0.0;
  for (int k = 0; k < 4; k++) shore += smoothstep(uLampSize.x * 0.7, uLampSize.x * 0.35, acos(clamp(dot(d, uShore[k]), -1.0, 1.0)));
  return disc + uLampSize.z * hg * 0.0005 + shore * uLampSize.y * 0.12;
}
float sky(vec3 d, int i) {
  float e = max(d.y, 0.0);
  return uSH[i] * exp(-e / 0.12) * 0.55 + uSZ[i] * (0.18 + 0.82 * (1.0 - exp(-e / 0.3))) * 0.35 + uSL[i] * lampTerm(d);
}
struct Geo { float water; vec3 d; vec3 r; float cosi; float depth; float caus; float gcaus; float glyphRefl; float glint; float rim; };
Geo geo(vec2 uv, bool front) {
  Geo g; g.d = rayOf(uv); g.water = 0.0; g.glyphRefl = 0.0; g.caus = 1.0; g.gcaus = 1.0; g.glint = 0.0; g.rim = 0.0;
  g.r = g.d; g.cosi = 1.0; g.depth = 0.0;
  if (g.d.y >= -1e-4) return g;
  float t = uCam.x / -g.d.y; vec3 P = vec3(0.0, uCam.x, 0.0) + g.d * t; vec2 xz = P.xz;
  float fade = 1.0 / (1.0 + 0.06 * P.z), e = uWave.x / 256.0;
  float h0 = simH(xz), hx = simH(xz + vec2(e, 0.0)), hz = simH(xz + vec2(0.0, e)), hxm = simH(xz - vec2(e, 0.0)), hzm = simH(xz - vec2(0.0, e));
  vec2 grad = vec2(hx - hxm, hz - hzm) / (2.0 * e) * uWave.y + swell(xz, uTime);
  vec3 nrm = normalize(vec3(-grad.x * fade, 1.0, -grad.y * fade));
  g.water = 1.0; g.r = reflect(g.d, nrm); g.r.y = abs(g.r.y); g.cosi = max(dot(-g.d, nrm), 0.0);
  g.depth = 0.35 + 0.045 * P.z;
  float lap = (hx + hxm + hz + hzm - 4.0 * h0) / (e * e) * uWave.y;
  g.caus = clamp(1.0 / max(0.25, 1.0 + g.depth * 0.25 * lap * fade), 0.25, 4.0);
  vec3 hv = normalize(uLampDir - g.d);
  float rough = 0.06 + 0.02 * P.z / 20.0;
  g.glint = ggx(max(dot(nrm, hv), 0.0), rough);
  for (int k = 0; k < 4; k++) g.glint += 0.12 * ggx(max(dot(nrm, normalize(uShore[k] - g.d)), 0.0), rough);
  if (front && P.z < uCam.y) {
    if (g.r.z > 1e-3) { vec3 Q = P + g.r * (uCam.y - P.z) / g.r.z; if (Q.y > 0.0) { vec2 q = uvOf(Q); vec4 gl = glyph(q);
      g.glyphRefl = gl.g; g.rim = 1.0 - glyphNormal(q).z; } }
    if (uLampDir.z > 1e-3) { vec3 G = P + uLampDir * (uCam.y - P.z) / uLampDir.z; vec2 q = uvOf(G); vec2 tx = uGlyphTexel * 3.0;
      float l = glyph(q + vec2(tx.x, 0.0)).r + glyph(q - vec2(tx.x, 0.0)).r + glyph(q + vec2(0.0, tx.y)).r + glyph(q - vec2(0.0, tx.y)).r - 4.0 * glyph(q).r;
      g.gcaus = clamp(1.0 - l * 6.0, 0.4, 5.0); }
  }
  return g;
}
float radiance(Geo g, int i) {
  if (g.water < 0.5) return sky(g.d, i);
  float F = fresnelDielectric(g.cosi, uNw[i]);
  float refl = sky(g.r, i);
  if (g.glyphRefl > 0.0) refl = mix(refl, refl * 0.7 + (uSZ[i] * 0.3 + uSH[i] * 0.5) * g.rim * uFill.w * 0.6, g.glyphRefl);
  float ct = sqrt(max(0.0, 1.0 - (1.0 - g.cosi * g.cosi) / (uNw[i] * uNw[i])));
  float path = g.depth + g.depth / max(ct, 0.05);
  float E = uSL[i] * 0.06 * g.caus * g.gcaus + (uSZ[i] * 0.35 + uSH[i] * 0.2) * 0.5;
  float floorL = uWave.w / 3.14159265 * E * exp(-uAw[i] * path);
  return F * refl + (1.0 - F) * floorL + uSL[i] * g.glint * F * 1.5;
}
float glass(vec2 uv, int i, vec3 nrm, float h, float edge) {
  vec3 d = rayOf(uv), nw = vec3(nrm.xy, -nrm.z);
  float film = 260.0 * edge * edge;                       // MgF2 film, thickest where it pools at the rims
  float F = filmReflect(nrm.z, 1.38, uNg[i], film, uLam[i]);
  vec3 off = slabOffset(nrm, uNg[i], 0.05 * h, 0.32);
  vec3 r = reflect(d, nw);
  float env = r.y > 0.0 ? sky(r, i) : sky(vec3(r.x, -r.y, r.z), i) * 0.25;
  float spec = uSL[i] * ggx(max(dot(nw, normalize(uLampDir - d)), 0.0), 0.03) * 0.004 * uLampSize.y
             + uSZ[i] * ggx(max(dot(nw, normalize(uFill.xyz - d)), 0.0), 0.12) * 0.02 * uFill.w;
  float behind = off.z > 0.5 ? env * 0.5 : radiance(geo(uv + vec2(off.x / uAspect, off.y), false), i);
  return F * (env + spec) + (1.0 - F) * exp(-uAg[i] * 0.3 * h) * behind;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 gl = glyph(uv); float a = gl.g, h = gl.r;
  Geo g = geo(uv, true);
  vec3 nrm = glyphNormal(uv); float edge = clamp(1.0 - nrm.z, 0.0, 1.0) * 3.0;
  vec3 xyz = vec3(0.0);
  for (int i = 0; i < N; i++) {
    float L = radiance(g, i);
    if (a > 0.003) {
      float Lg = glass(uv, i, nrm, h, min(edge, 1.0));
      if (g.water > 0.5 && uv.y < uvOf(vec3(0.0, 0.0, uCam.y)).y) Lg *= exp(-uAw[i] * 1.5) * (1.0 - fresnelDielectric(g.cosi, uNw[i]));
      L = mix(L, Lg, a);
    }
    xyz += L * uW[i];
  }
  o = vec4(max(uToRGB * xyz * uExposure, 0.0), 1.0);
}
`;
