// scene.glsl.js: the sea cascades, the scene (sky, sun or moon, sea, glass letters) and the display pass.
import { ATMOS } from "./atmosphere.glsl.js";

// one cascade of the sea: the summed waves' slope, slope squared (so mip levels keep the unresolved roughness),
// and the Jacobian of the choppy horizontal displacement (below 1 where crests fold, which is where foam forms)
export const WAVE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uWaves; uniform int uN; uniform float uTile, uT, uChop;
in vec2 v; out vec4 o;
void main() {
  vec2 x = v * uTile; vec2 s = vec2(0.0); float dxx = 0.0, dzz = 0.0, dxz = 0.0;
  for (int i = 0; i < 96; i++) {
    if (i >= uN) break;
    vec4 w = texelFetch(uWaves, ivec2(i, 0), 0);
    float k = length(w.xy), om = sqrt(9.81 * k), th = dot(w.xy, x) - om * uT + w.w, c = cos(th), sn = sin(th);
    s += -w.z * sn * w.xy;
    vec2 kh = w.xy / max(k, 1e-5);
    dxx += -uChop * kh.x * w.x * w.z * c; dzz += -uChop * kh.y * w.y * w.z * c; dxz += -uChop * kh.x * w.y * w.z * c;
  }
  float J = (1.0 + dxx) * (1.0 + dzz) - dxz * dxz;
  o = vec4(s, dot(s, s), J);
}`;

export const SCENE_FRAG = `#version 300 es
precision highp float;
${ATMOS}
uniform sampler2D uTrans, uSky, uW0, uW1, uW2, uGlyph;
uniform vec2 uRes, uJitter; uniform vec3 uL, uCam, uIor, uAbs, uLightCol, uTiles;
uniform float uPitch, uYaw, uFocal, uT, uMoon, uMoonPhaseAngle, uExpo, uStars;
uniform float uGX, uGZ, uGH, uGW, uGT, uGR, uGBase, uGCap, uHasGlyph, uFoam;
in vec2 v; out vec4 o;
const float SUN_R = 0.004654;  // rad: the Sun's mean angular radius, 0.2666 deg
const float MOON_R = 0.004521; // rad: the Moon's mean angular radius, 0.2590 deg
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
vec3 skyL(vec3 rd) {
  vec2 lh = normalize(uL.xz + 1e-6), rh = normalize(rd.xz + 1e-6);
  float az = acos(clamp(dot(lh, rh), -1.0, 1.0)), el = asin(clamp(rd.y, -1.0, 1.0));
  float vv = sqrt(clamp((el + 0.2) / (PI * 0.5 + 0.2), 0.0, 1.0));
  return texture(uSky, vec2(az / PI, vv)).rgb;
}
vec3 lightT() { return texture(uTrans, transUV(0.002, uL.y)).rgb; }
// the Moon: Lommel-Seeliger reflectance (lunar regolith), lit at its phase angle; maria and highlands from a
// procedural albedo between 0.07 and 0.16, the range measured for lunar maria and highlands
float moonAlbedo(vec2 q) {
  float m = 0.0, a = 0.5; vec2 p = q * 2.3 + 1.7;
  for (int i = 0; i < 5; i++) { m += a * (sin(p.x * 1.9 + sin(p.y * 1.3)) * cos(p.y * 1.7 - sin(p.x * 0.8))); p = p * 2.07 + 3.1; a *= 0.5; }
  float maria = smoothstep(0.05, 0.35, m);
  float crater = 0.0; vec2 c = floor(q * 9.0); vec2 f = fract(q * 9.0) - 0.5 - (vec2(hash(c), hash(c + 3.7)) - 0.5) * 0.5;
  float r = 0.18 + 0.2 * hash(c + 9.1), d = length(f); crater = smoothstep(r, r * 0.8, d) * 0.03 - smoothstep(r * 1.15, r, d) * smoothstep(r * 0.8, r, d) * 0.02;
  return mix(0.16, 0.07, maria);
}
vec3 lightDisk(vec3 rd) {
  float c = dot(rd, uL), ang = acos(clamp(c, -1.0, 1.0));
  vec3 T = lightT(); vec3 col = vec3(0.0);
  if (uMoon < 0.5) {
    if (ang < SUN_R) {
      float mu = sqrt(1.0 - (ang / SUN_R) * (ang / SUN_R));
      // limb darkening, I(mu) = mu^alpha per channel: a power-law fit to the Neckel and Labs (1994) solar limb
      // profile at the red, green and blue samples
      vec3 limb = pow(vec3(mu), vec3(0.397, 0.503, 0.652));
      col += uLightCol * T * limb / (PI * SUN_R * SUN_R);
    }
  } else if (ang < MOON_R) {
    vec3 side = normalize(cross(uL, vec3(0.0, 1.0, 0.0))), up2 = normalize(cross(side, uL));
    vec2 q = vec2(dot(rd - uL * c, side), dot(rd - uL * c, up2)) / MOON_R;
    vec3 n = vec3(q, sqrt(max(0.0, 1.0 - dot(q, q))));
    vec3 s = vec3(sin(uMoonPhaseAngle), 0.0, cos(uMoonPhaseAngle));
    float mu0 = max(dot(n, s), 0.0), mu = n.z, ls = mu0 / (mu0 + mu + 1e-4);
    // normalised so the disk's mean radiance times its solid angle is the moonlight the scene is lit by
    // the disk is compressed 6000 times here, standing in for the eye's local adaptation: at one exposure the Moon is about 1e5 times
    // brighter than the moonlit sky and would clip to a white disk, hiding the maria and the terminator
    col += uLightCol * T * (moonAlbedo(q) * ls / 0.06) / (PI * MOON_R * MOON_R) / 6000.0;
  }
  // glare around the source: the 1/theta^2 core of a human-eye point spread function (Spencer et al. 1995,
  // "Physically-based glare effects for digital images", SIGGRAPH)
  float th = max(ang, uMoon > 0.5 ? MOON_R : SUN_R);
  col += uLightCol * T * (uMoon > 0.5 ? 2.0e-6 : 6.0e-6) / (th * th);
  return col;
}
vec3 stars(vec3 rd) {
  if (uStars <= 0.0 || rd.y < 0.0) return vec3(0.0);
  vec2 g = vec2(atan(rd.z, rd.x), asin(rd.y)) * 260.0, cell = floor(g), f = fract(g) - 0.5;
  float h = hash(cell); vec2 off = (vec2(hash(cell + 7.1), hash(cell + 3.3)) - 0.5) * 0.6;
  float st = step(0.997, h) * exp(-dot(f - off, f - off) * 90.0) * pow(fract(h * 37.0), 3.0);
  return vec3(0.9, 0.93, 1.0) * st * uStars * texture(uTrans, transUV(0.002, rd.y)).rgb;
}
vec3 sky(vec3 rd) { return skyL(rd) * uLightCol + lightDisk(rd) + stars(rd); }
// Fresnel reflectance of an unpolarised ray at a dielectric interface, exact (Born and Wolf)
float fresnel(float ci, float n) {
  float st2 = (1.0 - ci * ci) / (n * n); if (st2 >= 1.0) return 1.0;
  float ct = sqrt(1.0 - st2), rs = (ci - n * ct) / (ci + n * ct), rp = (n * ci - ct) / (n * ci + ct);
  return 0.5 * (rs * rs + rp * rp);
}
// the letters: a 2D signed distance field extruded to a slab of thickness uGT with rounded edges of radius uGR,
// standing on the water at distance uGZ, cap height from the glyph's own measure
float glyph2(vec2 xy) {
  float hBox = uGH / max(uGBase - uGCap, 1e-3);
  vec2 uv = vec2(0.5 + xy.x / (hBox * 4.0), uGBase - xy.y / hBox);
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 4.0;
  return texture(uGlyph, uv).r * hBox / 256.0;
}
float glyph3(vec3 p) {
  vec3 q = p - vec3(uGX, 0.0, uGZ);
  vec2 w = vec2(glyph2(q.xy) + uGR, abs(q.z) - uGT * 0.5 + uGR);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - uGR;
}
vec3 glyphN(vec3 p) {
  vec2 e = vec2(0.04, 0.0);
  return normalize(vec3(glyph3(p + e.xyy) - glyph3(p - e.xyy), glyph3(p + e.yxy) - glyph3(p - e.yxy), glyph3(p + e.yyx) - glyph3(p - e.yyx)));
}
bool glyphBox(vec3 ro, vec3 rd, out float t0, out float t1) {
  float hBox = uGH / max(uGBase - uGCap, 1e-3);
  vec3 lo = vec3(uGX - hBox * 2.0, -uGH * 0.4, uGZ - uGT * 0.5), hi = vec3(uGX + hBox * 2.0, uGH * 1.25, uGZ + uGT * 0.5);
  vec3 ia = 1.0 / rd, ta = (lo - ro) * ia, tb = (hi - ro) * ia, mn = min(ta, tb), mx = max(ta, tb);
  t0 = max(max(mn.x, mn.y), max(mn.z, 0.0)); t1 = min(min(mx.x, mx.y), mx.z);
  return uHasGlyph > 0.5 && t1 > t0;
}
bool marchGlyph(vec3 ro, vec3 rd, float t0, float t1, out vec3 hit) {
  float t = t0;
  for (int i = 0; i < 72; i++) { vec3 p = ro + rd * t; float d = glyph3(p); if (d < 0.002 * t) { hit = p; return true; } t += max(d, 0.01); if (t > t1) break; }
  return false;
}
vec3 sea0(vec3 ro, vec3 rd);
// light leaving the glass toward the eye: Fresnel reflection plus refraction through the slab, exit refraction per
// channel at the Sellmeier indices, Beer-Lambert absorption over the path inside
vec3 glass(vec3 p, vec3 rd) {
  vec3 n = glyphN(p); float ci = clamp(dot(-rd, n), 0.0, 1.0), Fr = fresnel(ci, uIor.g);
  vec3 rr = reflect(rd, n); vec3 refl = rr.y < 0.0 ? sea0(p, rr) : sky(rr);
  vec3 rIn = refract(rd, n, 1.0 / uIor.g); if (dot(rIn, rIn) < 0.5) return refl;
  float t = 0.05; vec3 q = p;
  for (int i = 0; i < 48; i++) { q = p + rIn * t; float d = -glyph3(q); if (d < 0.003) break; t += max(d, 0.01); }
  vec3 ne = -glyphN(q), outc = vec3(0.0);
  for (int c = 0; c < 3; c++) {
    vec3 rOut = refract(rIn, ne, uIor[c]);
    if (dot(rOut, rOut) < 0.5) rOut = reflect(rIn, ne);  // total internal reflection: the ray turns back inside
    vec3 e = rOut.y < 0.0 ? sea0(q, rOut) : sky(rOut);
    outc[c] = e[c];
  }
  vec3 Tg = exp(-uAbs * t);
  return refl * Fr + (1.0 - Fr) * outc * Tg;
}
// the glass as the sea mirrors it: the broken reflection is too fine for one ray per pixel to resolve the slab's
// inside, so it takes the slab's mean appearance (Fresnel reflection of the sky, the rest straight through)
vec3 glassSeen(vec3 p, vec3 rd) {
  vec3 n = glyphN(p); float Fr = fresnel(clamp(dot(-rd, n), 0.0, 1.0), uIor.g);
  return sky(reflect(rd, n)) * Fr + (1.0 - Fr) * sky(rd) * exp(-uAbs * uGT);
}
vec3 aerial(vec3 col, float distM, vec3 rd) {
  vec3 T = exp(-extinctionAt(0.0) * distM * 0.001);
  return col * T + skyL(normalize(vec3(rd.x, 0.02, rd.z))) * uLightCol * (1.0 - T);
}
// GLSL has no recursion, so the sea comes twice: sea0 mirrors the sky only (used from inside the glass), sea1
// also mirrors the glass letters (used for the eye's own rays)
// the sea, lit; env is what its mirror sees (the sky, or the glass letters for the eye's own ray)
vec3 sea0(vec3 ro, vec3 rd) {
  float t = -ro.y / rd.y; vec3 p = ro + rd * t;
  // texture footprint of one pixel on the water, stretched along the view (anisotropic filtering does the rest)
  float pa = 1.0 / (uFocal * uRes.y); vec2 side = normalize(vec2(-rd.z, rd.x) + 1e-6), fwd = normalize(rd.xz + 1e-6);
  vec2 gx = side * t * pa, gy = fwd * t * pa / max(-rd.y, 0.02);
  // each cascade is turned by its own angle so the three tiling lattices never line up into a visible grid; its
  // slopes are turned back into world axes
  mat2 r1 = mat2(0.857, 0.515, -0.515, 0.857), r2 = mat2(0.391, 0.921, -0.921, 0.391);
  vec4 a = textureGrad(uW0, p.xz / uTiles.x, gx / uTiles.x, gy / uTiles.x);
  vec4 b = textureGrad(uW1, r1 * p.xz / uTiles.y, r1 * gx / uTiles.y, r1 * gy / uTiles.y);
  vec4 c = textureGrad(uW2, r2 * p.xz / uTiles.z, r2 * gx / uTiles.z, r2 * gy / uTiles.z);
  vec2 s = a.xy + transpose(r1) * b.xy + transpose(r2) * c.xy; float varU = max(0.0, a.z - dot(a.xy, a.xy)) + max(0.0, b.z - dot(b.xy, b.xy)) + max(0.0, c.z - dot(c.xy, c.xy));
  float J = min(a.w, min(b.w, c.w));
  vec3 n = normalize(vec3(-s.x, 1.0, -s.y));
  float ci = clamp(dot(-rd, n), 0.0, 1.0), F = fresnel(ci, 1.333);
  // a reflected ray that points into the sea (a wave facing away) is lifted to just above the horizon; abs() would
  // fold it onto the sky-view table's horizon seam and draw a contour line
  vec3 r = reflect(rd, n); r.y = max(r.y, 0.03); r = normalize(r);
  vec3 env = sky(r);
  // the light's own specular: GGX with roughness widened by the slope variance the mip levels averaged away
  float al = sqrt(0.0009 + 2.0 * varU), al2 = al * al; vec3 hv = normalize(uL - rd); float nh = max(dot(n, hv), 0.0), nl = max(dot(n, uL), 0.0), nv = max(ci, 1e-3);
  float D = al2 / (PI * pow(nh * nh * (al2 - 1.0) + 1.0, 2.0)), Gk = al * 0.5, G = nl / (nl * (1.0 - Gk) + Gk) * nv / (nv * (1.0 - Gk) + Gk);
  vec3 spec = uLightCol * lightT() * D * G * fresnel(max(dot(hv, -rd), 0.0), 1.333) / (4.0 * nv);
  // water leaving radiance: R = 0.33 b_b / a (Morel and Gentili 1991) for open ocean with 0.2 mg m^-3 chlorophyll:
  // a = pure water (0.448, 0.0565, 0.0068) per m at 680, 550 and 440 nm (Pope and Fry 1997) plus phytoplankton and
  // dissolved matter (about 0.012, 0.008, 0.043, after Bricaud et al. 1995 and Morel and Maritorena 2001); b_b =
  // seawater (0.00025, 0.00093, 0.0024; half of Morel's 1974 b_w) plus particles (0.0006, 0.0007, 0.0009)
  vec3 Ed = uLightCol * (lightT() * max(uL.y, 0.0) + skyL(vec3(0.0, 1.0, 0.0)) * PI);
  vec3 Rw = 0.33 * vec3(0.00085, 0.00163, 0.0033) / vec3(0.460, 0.0645, 0.0498);
  vec3 col = (1.0 - F) * Rw * Ed / PI + F * env + spec;
  // whitecaps only where crests fold (J < 0) and only in wind that breaks waves (uFoam from U10, Monahan 1971)
  float foam = smoothstep(0.0, -0.4, J) * uFoam;
  col = mix(col, 0.7 * Ed / PI, foam);
  return aerial(col, t, rd);
}
// the sea, lit; env is what its mirror sees (the sky, or the glass letters for the eye's own ray)
vec3 sea1(vec3 ro, vec3 rd) {
  float t = -ro.y / rd.y; vec3 p = ro + rd * t;
  // texture footprint of one pixel on the water, stretched along the view (anisotropic filtering does the rest)
  float pa = 1.0 / (uFocal * uRes.y); vec2 side = normalize(vec2(-rd.z, rd.x) + 1e-6), fwd = normalize(rd.xz + 1e-6);
  vec2 gx = side * t * pa, gy = fwd * t * pa / max(-rd.y, 0.02);
  // each cascade is turned by its own angle so the three tiling lattices never line up into a visible grid; its
  // slopes are turned back into world axes
  mat2 r1 = mat2(0.857, 0.515, -0.515, 0.857), r2 = mat2(0.391, 0.921, -0.921, 0.391);
  vec4 a = textureGrad(uW0, p.xz / uTiles.x, gx / uTiles.x, gy / uTiles.x);
  vec4 b = textureGrad(uW1, r1 * p.xz / uTiles.y, r1 * gx / uTiles.y, r1 * gy / uTiles.y);
  vec4 c = textureGrad(uW2, r2 * p.xz / uTiles.z, r2 * gx / uTiles.z, r2 * gy / uTiles.z);
  vec2 s = a.xy + transpose(r1) * b.xy + transpose(r2) * c.xy; float varU = max(0.0, a.z - dot(a.xy, a.xy)) + max(0.0, b.z - dot(b.xy, b.xy)) + max(0.0, c.z - dot(c.xy, c.xy));
  float J = min(a.w, min(b.w, c.w));
  vec3 n = normalize(vec3(-s.x, 1.0, -s.y));
  float ci = clamp(dot(-rd, n), 0.0, 1.0), F = fresnel(ci, 1.333);
  // a reflected ray that points into the sea (a wave facing away) is lifted to just above the horizon; abs() would
  // fold it onto the sky-view table's horizon seam and draw a contour line
  vec3 r = reflect(rd, n); r.y = max(r.y, 0.03); r = normalize(r);
  vec3 env = sky(r);
  { float g0, g1; vec3 h; if (glyphBox(p, r, g0, g1) && marchGlyph(p, r, g0, g1, h) && h.y > 0.02) env = glassSeen(h, r); }
  // the light's own specular: GGX with roughness widened by the slope variance the mip levels averaged away
  float al = sqrt(0.0009 + 2.0 * varU), al2 = al * al; vec3 hv = normalize(uL - rd); float nh = max(dot(n, hv), 0.0), nl = max(dot(n, uL), 0.0), nv = max(ci, 1e-3);
  float D = al2 / (PI * pow(nh * nh * (al2 - 1.0) + 1.0, 2.0)), Gk = al * 0.5, G = nl / (nl * (1.0 - Gk) + Gk) * nv / (nv * (1.0 - Gk) + Gk);
  vec3 spec = uLightCol * lightT() * D * G * fresnel(max(dot(hv, -rd), 0.0), 1.333) / (4.0 * nv);
  // water leaving radiance: R = 0.33 b_b / a (Morel and Gentili 1991) for open ocean with 0.2 mg m^-3 chlorophyll:
  // a = pure water (0.448, 0.0565, 0.0068) per m at 680, 550 and 440 nm (Pope and Fry 1997) plus phytoplankton and
  // dissolved matter (about 0.012, 0.008, 0.043, after Bricaud et al. 1995 and Morel and Maritorena 2001); b_b =
  // seawater (0.00025, 0.00093, 0.0024; half of Morel's 1974 b_w) plus particles (0.0006, 0.0007, 0.0009)
  vec3 Ed = uLightCol * (lightT() * max(uL.y, 0.0) + skyL(vec3(0.0, 1.0, 0.0)) * PI);
  vec3 Rw = 0.33 * vec3(0.00085, 0.00163, 0.0033) / vec3(0.460, 0.0645, 0.0498);
  vec3 col = (1.0 - F) * Rw * Ed / PI + F * env + spec;
  // whitecaps only where crests fold (J < 0) and only in wind that breaks waves (uFoam from U10, Monahan 1971)
  float foam = smoothstep(0.0, -0.4, J) * uFoam;
  col = mix(col, 0.7 * Ed / PI, foam);
  return aerial(col, t, rd);
}
vec3 ray(vec2 uv) {
  float asp = uRes.x / uRes.y;
  vec2 q = (uv - 0.5) * vec2(asp, 1.0) * max(1.0, 1.25 / asp) / uFocal;
  float cp = cos(uPitch), sp = sin(uPitch), cy = cos(uYaw), sy = sin(uYaw);
  vec3 f = vec3(sy * cp, sp, cy * cp), rt = vec3(cy, 0.0, -sy), up = vec3(-sy * sp, cp, -cy * sp);
  return normalize(f + rt * q.x + up * q.y);
}
void main() {
  vec2 uv = v + uJitter / uRes;
  vec3 rd = ray(uv), ro = uCam, col;
  float g0, g1; vec3 h;
  if (glyphBox(ro, rd, g0, g1) && marchGlyph(ro, rd, g0, g1, h) && h.y > -0.05) col = glass(h, rd);
  else col = rd.y < 0.0 ? sea1(ro, rd) : sky(rd);
  // half floats end at 65504; the sun's disk is brighter than that before exposure, and the display clips it anyway
  o = vec4(min(col * uExpo, vec3(6.0e4)), 1.0);
}`;

// display: ACES filmic fit (Narkowicz 2015), the sRGB transfer function (IEC 61966-2-1), triangular dither
export const POST_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uImg; uniform float uFrame, uNight;
in vec2 v; out vec4 o;
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec3 hdr = texture(uImg, v).rgb;
  // at night the eye shifts to rods: colour drains and what is left leans blue (Jensen et al. 2000, "A
  // Physically-Based Night Sky Model", SIGGRAPH, after Khan and Pattanaik's scotopic blue shift)
  float Y = dot(hdr, vec3(0.2126, 0.7152, 0.0722));
  hdr = mix(hdr, Y * vec3(0.55, 0.72, 1.12), 0.75 * uNight);
  vec3 c = srgb(aces(hdr));
  vec2 p = gl_FragCoord.xy + uFrame;
  c += (hash(p) + hash(p + 17.3) - 1.0) / 255.0;
  o = vec4(c, 1.0);
}`;

export const VERT = `#version 300 es
in vec2 a; out vec2 v; void main() { v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;
