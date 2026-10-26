// web/shaders.mjs: the material shaders. Field functions mirror lib/fields.mjs at(); glass and the tube are
// shader approximations of glass (slab refraction with per-channel index, Fresnel, rim; scan rows, an
// aperture grille, bloom and snow). The CPU modules stay the reference.
export const VERT = `#version 300 es
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

export const FRAG = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uField; uniform sampler2D uCpu;
uniform vec2 uSize; uniform float uT; uniform float uEm;
uniform int uMode; uniform int uOffsetFill;
uniform vec3 uGround; uniform vec3 uInk; uniform vec4 uP0; uniform vec4 uP1; uniform vec3 uTint; uniform vec3 uPaper;
uniform int uEdge; uniform vec3 uEdgeCol; uniform vec2 uEdgeP; uniform float uEdgeW;
uniform int uShadow; uniform vec3 uShadowCol; uniform vec3 uShadowP;
uniform int uDrift; uniform vec2 uDriftP;
uniform float uDpr; uniform int uFeed; uniform vec4 uP2; uniform vec3 uPhos; uniform float uExp;
uniform vec4 uGlyphs[64]; uniform int uN; uniform float uSeries[64];
out vec4 outColor;
const float LO = -300.0, HI = 1000.0;

vec2 F(vec2 px) { return texture(uField, (px) / uSize).rg; }
float cov(vec2 px) { return F(px).r; }
float sdf(vec2 px) { return F(px).g; }
float tAt(float y) { return clamp((y - LO) / (HI - LO), 0.0, 1.0); }
float ser(float u) { float f = clamp(u, 0.0, 1.0) * 63.0; int i = int(floor(f)); return mix(uSeries[i], uSeries[min(63, i + 1)], f - float(i)); }
float hash(int i, int j, int s) {
  uint h = uint(i) * 374761393u + uint(j) * 668265263u + uint(s) * 2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u; return float(h ^ (h >> 16u)) / 4294967296.0;
}

float field(int mode, vec2 q, float aa, float adv) {
  if (mode == 1) {
    float P = uP0.x, rh = P * 0.866, row = floor((q.y - LO) / rh + 0.5), best = 0.0;
    for (int k = -1; k <= 1; k++) { float r = row + float(k), cy = LO + r * rh, off = mod(r, 2.0) > 0.5 ? P * 0.5 : 0.0;
      float cx = floor((q.x - off) / P + 0.5) * P + off, rr = P * (uP0.y - (uP0.y - uP0.z) * tAt(cy));
      best = max(best, clamp((rr - length(q - vec2(cx, cy))) / aa + 0.5, 0.0, 1.0)); }
    return best;
  }
  if (mode == 2) { float k = floor((q.y - LO) / uP0.x), y0 = LO + k * uP0.x, th = uP0.x * (uP0.y - (uP0.y - uP0.z) * tAt(y0)), d = q.y - y0; return clamp(min(d, th - d) / aa + 0.5, 0.0, 1.0); }
  if (mode == 3) { float d = mod(q.y - LO, uP0.x), th = uP0.x * uP0.y; return clamp(min(d, th - d) / aa + 0.5, 0.0, 1.0); }
  if (mode == 4) {
    int i0 = int(floor(q.x / uP0.x)), j0 = int(floor(q.y / uP0.x)), sd = int(uP0.w); float best = 0.0;
    for (int j = j0 - 1; j <= j0 + 1; j++) for (int i = i0 - 1; i <= i0 + 1; i++) {
      vec2 c = vec2((float(i) + 0.15 + 0.7 * hash(i, j, sd)) * uP0.x, (float(j) + 0.15 + 0.7 * hash(j, i, sd + 7)) * uP0.x);
      best = max(best, clamp((uP0.z - length(q - c)) / aa + 0.5, 0.0, 1.0)); }
    return best;
  }
  if (mode == 5) {
    float n = max(2.0, floor(adv / uP0.x + 0.5)), i = floor(q.x / uP0.x); if (i < 0.0 || i >= n) return 0.0;
    float x0 = i * uP0.x, top = uP0.z + ser((i + 0.5) / n) * (uP0.w - uP0.z), dx = min(q.x - (x0 + uP0.x * uP0.y * 0.5), x0 + uP0.x * (1.0 - uP0.y * 0.5) - q.x);
    return clamp(min(dx, top - q.y) / aa + 0.5, 0.0, 1.0);
  }
  if (mode == 6) {
    float k = floor((q.y - LO) / uP0.x + 0.5), best = 0.0;
    for (int r = -2; r <= 1; r++) { float yr = LO + (k + float(r)) * uP0.x; if (yr <= LO || yr >= HI) continue;
      float u = q.x / max(1.0, adv), wob = sin(q.x * 0.021 + yr * 0.13) * 0.5 + 0.5, c = yr + uP0.y * ser(u) * (0.55 + 0.45 * wob);
      best = max(best, clamp((uP0.z * 0.5 - abs(q.y - c)) / aa + 0.5, 0.0, 1.0)); }
    return best;
  }
  return 1.0;
}

// The glyph-local coverage of a field, max over the glyphs that reach this pixel (lib/materials-core fieldCoverage).
float fieldCov(vec2 px, float c) {
  if (c <= 0.0) return 0.0;
  float best = 0.0;
  for (int k = 0; k < 64; k++) { if (k >= uN) break; vec4 g = uGlyphs[k];
    if (px.x < g.x - 0.2 * g.w * g.y || px.x > g.x + 1.2 * g.w * g.y) continue;
    vec2 q = vec2((px.x - g.x) / g.y, (g.z - px.y) / g.y);
    best = max(best, c * field(uMode, q, 1.0 / g.y, g.w)); }
  return best;
}

vec3 env(vec3 N) { float up = clamp(-N.y * 1.6, 0.0, 1.0); return mix(vec3(0.82, 0.78, 0.68), vec3(0.34, 0.45, 0.55), up) + 2.2 * pow(max(0.0, dot(reflect(vec3(0, 0, -1), N), normalize(vec3(-0.45, -0.55, 0.7)))), 90.0); }
vec3 paper(vec2 px) { float pitch = uP1.z > 0.0 ? max(4.0, floor(9.0 / uP1.z + 0.5)) : 1e9; float on = mod(px.y, pitch) < 1.2 ? 1.0 : 0.0; float L = dot(uPaper, vec3(0.2126, 0.7152, 0.0722));
  vec3 rule = L > 0.18 ? uPaper * 0.62 : min(vec3(1), uPaper * 2.4 + 0.02); return mix(uPaper * (1.0 - 0.06 * (0.5 + 0.5 * cos(px.x / uSize.x * 6.2832))), rule, on); }

vec3 tubeAt(vec2 px, vec4 P, vec3 phos, float expo) {
  // Whole-pixel row pitch and a grille in CSS pixels, so the rows never beat against the device grid (moire).
  float pitch = max(2.0, floor(uSize.y / P.x + 0.5)), row = px.y / pitch, f = fract(row) - 0.5, c = 0.0;
  for (int k = -1; k <= 1; k++) c += cov(vec2(px.x, (floor(row) + 0.5 + float(k)) * pitch)) * exp(-0.5 * pow((f - float(k)) / 0.32, 2.0)) / 0.8;
  float glow = P.y * 0.35 * exp(-max(0.0, sdf(px)) / (0.05 * uEm));
  float mask = 1.0 - P.z + P.z * 3.0 * (int(mod(floor(px.x / max(1.0, uDpr)), 3.0)) == 0 ? 1.0 : 0.0);
  float snow = P.w * (hash(int(px.x), int(px.y), int(uT * 24.0)) - 0.5) * 2.0;
  vec3 ph = phos * (c * 1.3 + glow) * expo; return vec3(0.012) + ph * (0.6 + 0.4 * mask) + snow;
}
vec3 tube(vec2 px) { return tubeAt(px, uP0, uInk, uP1.x); }
vec3 behind(vec2 px) { return uFeed == 1 ? tubeAt(px, uP2, uPhos, uExp) : paper(px); }

vec3 glass(vec2 px) {
  float s = sdf(px), c = cov(px), bev = max(1.0, uP0.z * uEm), th = uP0.w * uEm;
  vec3 bg = behind(px); if (c <= 0.0) return bg;
  float h0 = th * sqrt(1.0 - pow(1.0 - clamp(-s / bev, 0.0, 1.0), 2.0));
  float hx = th * sqrt(1.0 - pow(1.0 - clamp(-sdf(px + vec2(1, 0)) / bev, 0.0, 1.0), 2.0)) - th * sqrt(1.0 - pow(1.0 - clamp(-sdf(px - vec2(1, 0)) / bev, 0.0, 1.0), 2.0));
  float hy = th * sqrt(1.0 - pow(1.0 - clamp(-sdf(px + vec2(0, 1)) / bev, 0.0, 1.0), 2.0)) - th * sqrt(1.0 - pow(1.0 - clamp(-sdf(px - vec2(0, 1)) / bev, 0.0, 1.0), 2.0));
  vec3 N = normalize(vec3(-0.5 * hx, -0.5 * hy, 1.0)); vec3 col;
  for (int k = 0; k < 3; k++) { float n = uP0.x + uP0.y * 0.008 * float(k - 1); vec2 off = -N.xy * uP1.x * (1.0 - 1.0 / n) * 2.0; col[k] = behind(px + off)[k]; }
  float F = 0.04 + 0.96 * pow(1.0 - N.z, 5.0), rim = 1.0 - 0.35 * pow(1.0 - N.z, 1.5);
  vec3 T = pow(uTint, vec3(0.18 * h0 / 100.0));
  return mix(bg, (1.0 - F) * col * T * rim + F * env(N), c);
}

vec3 enc(vec3 v) { v = clamp(v, 0.0, 1.0); return mix(12.92 * v, 1.055 * pow(v, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, v)); }

void main() {
  vec2 px = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  if (uDrift == 1) { vec2 g = vec2(sdf(px + vec2(1, 0)) - sdf(px - vec2(1, 0)), sdf(px + vec2(0, 1)) - sdf(px - vec2(0, 1))); vec2 v = normalize(vec2(-g.y, g.x) + 1e-6) * uDriftP.y;
    float ph = fract(sdf(px) / uDriftP.x); px -= v * 0.12 * sin(6.2832 * (ph + uT * 0.5)); }
  if (uMode < 0) { outColor = vec4(enc(texture(uCpu, gl_FragCoord.xy / uSize * vec2(1, -1) + vec2(0, 1)).rgb), 1); return; }
  vec3 col = uGround;
  if (uMode == 7) col = glass(px); else if (uMode == 8) col = tube(px);
  if (uShadow == 1 || uOffsetFill == 1) { vec2 o = uShadow == 1 ? uShadowP.xy : uShadowP.xy; float a = cov(px - floor(o * uEm + 0.5)) * uShadowP.z; col = mix(col, uShadow == 1 ? uShadowCol : uInk, a); }
  if (uMode <= 6 && uOffsetFill == 0) { float c = cov(px); float a = uMode == 0 ? c : fieldCov(px, c); col = mix(col, uInk, a); }
  if (uEdge == 1) { float d = sdf(px), R = uEdgeP.x * uEm, k = d > 0.0 ? uEdgeP.y * exp(-d / max(0.5, R)) : 0.0; col += uEdgeCol * k; }
  if (uEdge == 2) { float a = clamp(uEdgeW * uEm * 0.5 - abs(sdf(px)) + 0.5, 0.0, 1.0) * uEdgeP.y; col = mix(col, uEdgeCol, a); }
  outColor = vec4(enc(col), 1);
}`;
