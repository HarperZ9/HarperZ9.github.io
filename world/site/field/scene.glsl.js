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
uniform float uPitch, uYaw, uFocal, uT, uMoon, uMoonPhaseAngle, uExpo, uStars; uniform vec2 uSid;
uniform float uGX, uGZ, uGH, uGW, uGT, uGR, uGBase, uGCap, uHasGlyph, uFoam;
uniform float uCloud, uStorm, uRain, uRainbow, uHalo, uFlash, uHaze; uniform int uCloudSteps;
uniform vec4 uSwell[8]; uniform float uSwellQ, uHmax, uSpray, uBreakH, uSig; uniform vec2 uWindDir; uniform int uMarch;
in vec2 v; out vec4 o;
const float SUN_R = 0.004654;  // rad: the Sun's mean angular radius, 0.2666 deg
const float MOON_R = 0.004521; // rad: the Moon's mean angular radius, 0.2590 deg
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
float hgp(float c, float g) { return (1.0 - g * g) / (12.566370614 * pow(1.0 + g * g - 2.0 * g * c, 1.5)); }
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
  // with a real sky the star grid is fixed to the celestial sphere: the view ray (x east, y up, z north) becomes hour
  // angle and declination at latitude uSid.x, then right ascension by local sidereal time uSid.y
  vec3 e = rd;
  if (uSid.x < 9.0) {
    float sl = sin(uSid.x), cl = cos(uSid.x), sd = rd.y * sl + rd.z * cl, ch = rd.y * cl - rd.z * sl, ra = uSid.y - atan(-rd.x, ch);
    e = vec3(cos(ra) * length(vec2(-rd.x, ch)), sd, sin(ra) * length(vec2(-rd.x, ch)));
  }
  vec2 g = vec2(atan(e.z, e.x), asin(clamp(e.y, -1.0, 1.0))) * 260.0, cell = floor(g), f = fract(g) - 0.5;
  float h = hash(cell); vec2 off = (vec2(hash(cell + 7.1), hash(cell + 3.3)) - 0.5) * 0.6;
  float st = step(0.997, h) * exp(-dot(f - off, f - off) * 90.0) * pow(fract(h * 37.0), 3.0);
  return vec3(0.9, 0.93, 1.0) * st * uStars * texture(uTrans, transUV(0.002, rd.y)).rgb;
}
// clouds: a layer from 1.2 km up, 2 km deep (5 km in a storm), ray-marched. Density is value-noise fbm cut by the
// cover; extinction 40 per km at full density (cumulus, about 0.04 per m). Light from the Sun or Moon is marched in four
// steps toward it (Beer-Lambert), scattered by a two-lobe Henyey-Greenstein phase (g 0.8 forward for the silver
// lining, -0.3 back), with multiple scattering by Wrenninge's octaves (Wrenninge, Kulla and Lundqvist 2013,
// "Oz: The Great and Volumetric", SIGGRAPH talks): each octave halves extinction and phase eccentricity. A storm adds
// density at the base, so its underside goes dark.
float n3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash(i.xy + i.z * 17.0), b = hash(i.xy + vec2(1, 0) + i.z * 17.0), c = hash(i.xy + vec2(0, 1) + i.z * 17.0), d = hash(i.xy + vec2(1, 1) + i.z * 17.0);
  float e = hash(i.xy + (i.z + 1.0) * 17.0), g = hash(i.xy + vec2(1, 0) + (i.z + 1.0) * 17.0), h = hash(i.xy + vec2(0, 1) + (i.z + 1.0) * 17.0), k = hash(i.xy + vec2(1, 1) + (i.z + 1.0) * 17.0);
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}
float cloudTop() { return 3.2 + 3.0 * uStorm; }
float cloudD(vec3 p) {
  vec3 q = p * vec3(0.32, 0.6, 0.32) + vec3(uT * 0.004, 0.0, uT * 0.002);
  float f = 0.55 * n3(q) + 0.28 * n3(q * 2.03) + 0.12 * n3(q * 4.1) + 0.05 * n3(q * 8.3);
  float h = (p.y - 1.2) / (cloudTop() - 1.2), prof = smoothstep(0.0, 0.12, h) * smoothstep(1.0, 0.55, h);
  return clamp((f - (1.0 - uCloud) * 0.85) * 2.4, 0.0, 1.0) * prof * (1.0 + 1.5 * uStorm * (1.0 - h));
}
float hg(float c, float g) { return (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * c, 1.5)); }
vec4 clouds(vec3 rd) {
  if (uCloudSteps <= 0 || rd.y <= 0.004) return vec4(0.0, 0.0, 0.0, 1.0);
  float camKm = uCam.y * 0.001, t0 = (1.2 - camKm) / rd.y, t1 = min((cloudTop() - camKm) / rd.y, t0 + 40.0);
  float dt = (t1 - t0) / float(uCloudSteps), T = 1.0, c = dot(rd, uL);
  vec3 S = vec3(0.0), sunC = uLightCol * texture(uTrans, transUV(2.0, max(uL.y, 0.02))).rgb, amb = skyL(vec3(0.0, 1.0, 0.0)) * uLightCol * PI * (1.0 - 0.6 * uStorm);
  for (int i = 0; i < 48; i++) {
    if (i >= uCloudSteps || T < 0.01) break;
    vec3 p = vec3(0.0, camKm, 0.0) + rd * (t0 + (float(i) + hash(gl_FragCoord.xy + float(i))) * dt);
    float d = cloudD(p);
    if (d <= 0.0) continue;
    float tau = 0.0;
    for (int j = 1; j <= 4; j++) tau += cloudD(p + uL * 0.25 * float(j)) * 0.25 * 40.0;
    float sig = d * 40.0, ms = 0.0, a = 1.0, b = 1.0, e = 1.0;
    for (int o = 0; o < 3; o++) { ms += a * mix(hg(c, 0.8 * e), hg(c, -0.3 * e), 0.3) * exp(-b * tau); a *= 0.5; b *= 0.5; e *= 0.5; }
    vec3 Li = sunC * ms * 4.0 * PI * (1.0 - exp(-2.0 * sig * dt)) + amb * 0.08 + vec3(0.7, 0.75, 1.0) * uFlash * 0.25;
    float st = exp(-sig * dt);
    S += T * (1.0 - st) * Li; T *= st;
  }
  // the far layer fades into the haze toward the horizon
  float fade = smoothstep(0.004, 0.08, rd.y);
  return vec4(S * fade, mix(1.0, T, fade));
}
// a rainbow from the spectrum: for 12 wavelengths from 400 to 700 nm, water's index (a Cauchy fit, n = 1.3245 +
// 3046 / lambda^2 with lambda in nm, within 0.0005 of the measured index of water across the visible) gives Descartes'
// minimum-deviation radius round the antisolar point, primary 4r - 2i with cos i = sqrt((n^2 - 1) / 3), secondary
// 180 + 2i - 6r with cos i = sqrt((n^2 - 1) / 8). Each bow is bright at its edge and fades inward (outward for the
// secondary), widened by the Sun's 0.53 degree disk; colour by Wyman, Sloan and Shirley's analytic fit to the CIE
// 1931 observer (JCGT 2013), then XYZ to linear sRGB. Alexander's dark band lies between the bows.
float wg(float x, float m, float s1, float s2) { float t = (x - m) / (x < m ? s1 : s2); return exp(-0.5 * t * t); }
vec3 cieXYZ(float l) {
  return vec3(1.056 * wg(l, 599.8, 37.9, 31.0) + 0.362 * wg(l, 442.0, 16.0, 26.7) - 0.065 * wg(l, 501.1, 20.4, 26.2),
              0.821 * wg(l, 568.8, 46.9, 40.5) + 0.286 * wg(l, 530.9, 16.3, 31.1),
              1.217 * wg(l, 437.0, 11.8, 36.0) + 0.681 * wg(l, 459.0, 26.0, 13.8));
}
vec3 rainbow(vec3 rd) {
  if (uRainbow <= 0.0 || uL.y <= 0.0) return vec3(0.0);
  float a = degrees(acos(clamp(dot(rd, -uL), -1.0, 1.0)));
  if (a < 36.0 || a > 58.0) return vec3(0.0);
  vec3 xyz = vec3(0.0), norm = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float l = 400.0 + 300.0 * (float(i) + 0.5) / 12.0, n = 1.3245 + 3046.0 / (l * l);
    float i1 = acos(sqrt((n * n - 1.0) / 3.0)), r1 = asin(sin(i1) / n), th1 = degrees(4.0 * r1 - 2.0 * i1);
    float i2 = acos(sqrt((n * n - 1.0) / 8.0)), r2 = asin(sin(i2) / n), th2 = 180.0 + degrees(2.0 * i2 - 6.0 * r2);
    float p = a < th1 ? exp(-pow((th1 - a) / 0.75, 2.0)) : exp(-pow((a - th1) / 0.3, 2.0));
    float q = a > th2 ? exp(-pow((a - th2) / 1.0, 2.0)) * 0.43 : exp(-pow((th2 - a) / 0.35, 2.0)) * 0.43;
    vec3 c = cieXYZ(l); xyz += c * (p + q); norm += c;
  }
  xyz /= norm.y;
  vec3 rgb = max(mat3(3.2406, -0.9689, 0.0557, -1.5372, 1.8758, -0.2040, -0.4986, 0.0415, 1.0570) * xyz, 0.0);
  float alex = smoothstep(42.6, 43.4, a) * smoothstep(50.4, 49.6, a);
  return rgb * uRainbow * 0.6 * lightT() * uLightCol * (1.0 - 0.35 * alex);
}
// the 22 degree halo: ice crystals in thin cirrus, red on the inner edge (minimum deviation of hexagonal ice prisms)
vec3 halo(vec3 rd) {
  if (uHalo <= 0.0) return vec3(0.0);
  float a = degrees(acos(clamp(dot(rd, uL), -1.0, 1.0)));
  vec3 r = exp(-pow((a - vec3(21.8, 22.3, 22.8)) / 0.5, vec3(2.0))) * smoothstep(21.0, 22.0, a) + 0.25 * exp(-pow((a - 23.5) / 2.0, 2.0));
  return r * uHalo * 0.03 * lightT() * uLightCol;
}
vec3 sky(vec3 rd) {
  vec3 col = skyL(rd) * uLightCol + lightDisk(rd) + stars(rd);
  // mirrored rays (the sea, the glass) take the cloud cover as a grey veil; the eye's own rays march the clouds
  return mix(col, skyL(vec3(0.0, 1.0, 0.0)) * uLightCol * (0.6 - 0.4 * uStorm) + vec3(0.7, 0.75, 1.0) * uFlash * 0.04, uCloud * 0.75);
}
vec3 skyEye(vec3 rd) {
  vec3 col = skyL(rd) * uLightCol + lightDisk(rd) + stars(rd);
  vec4 c = clouds(rd);
  // the bow forms in the rain below the cloud base, so it stands in front of the clouds; the halo is in the cloud
  col = col * c.a + c.rgb + rainbow(rd) + halo(rd) * c.a;
  // rain and fog veil the sky too, most toward the horizon where the path through them is longest
  float veil = 1.0 - exp(-uHaze * 0.25 / max(rd.y, 0.05));
  return mix(col, skyL(vec3(rd.x, 0.05, rd.z)) * uLightCol * (0.7 - 0.3 * uStorm), clamp(veil, 0.0, 0.95));
}
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
// the swell as raised geometry (field/ocean.js swellWaves): Gerstner waves, height a cos(theta) at the undisplaced
// point p, which two fixed-point steps recover from the world point x (p = x - d(p))
vec2 swellP(vec2 x) {
  vec2 p = x;
  for (int it = 0; it < 2; it++) {
    vec2 d = vec2(0.0);
    for (int i = 0; i < 8; i++) { vec4 w = uSwell[i]; float k = length(w.xy); if (k < 1e-6) continue;
      d -= uSwellQ / (k * 8.0) * (w.xy / k) * sin(dot(w.xy, p) - sqrt(9.81 * k) * uT + w.w); }
    p = x - d;
  }
  return p;
}
float swellH(vec2 x) {
  vec2 p = swellP(x); float h = 0.0;
  for (int i = 0; i < 8; i++) { vec4 w = uSwell[i]; float k = length(w.xy); if (k < 1e-6) continue; h += w.z * cos(dot(w.xy, p) - sqrt(9.81 * k) * uT + w.w); }
  return h;
}
// the surface Jacobian of the horizontal displacement: 1 on still water, 1 - Q where every crest lines up; below about
// 0.3 the crest is folding over, which is where the wave breaks
float swellJ(vec2 x) {
  vec2 p = swellP(x); float jxx = 1.0, jzz = 1.0, jxz = 0.0;
  for (int i = 0; i < 8; i++) { vec4 w = uSwell[i]; float k = length(w.xy); if (k < 1e-6) continue; vec2 D = w.xy / k;
    float c = uSwellQ / 8.0 * cos(dot(w.xy, p) - sqrt(9.81 * k) * uT + w.w); jxx -= c * D.x * D.x; jzz -= c * D.y * D.y; jxz -= c * D.x * D.y; }
  return jxx * jzz - jxz * jxz;
}
// march the eye's ray into the swell: step by the ray's height above the surface, then bisect the crossing. Rays
// that pass close over a breaking crest without hitting it return the crest point, for its spray
bool seaMarch(vec3 ro, vec3 rd, out float tHit, out vec2 nearXZ, out float nearF) {
  nearF = 1e9; nearXZ = vec2(0.0); tHit = -1.0;
  if (uHmax <= 0.01) { if (rd.y >= 0.0) return false; tHit = -ro.y / rd.y; return true; }
  float tA = rd.y < 0.0 ? max(0.0, (ro.y - uHmax) / -rd.y) : 0.0;
  float tB = rd.y < 0.0 ? (ro.y + uHmax) / -rd.y : (uHmax - ro.y) / max(rd.y, 1e-4);
  tB = min(tB, 3000.0);
  // samples spaced quadratically from tA to tB: fine near the eye, coarse far off where a pixel spans metres
  float t = tA, tp = tA;
  for (int i = 1; i <= 96; i++) {
    if (i > uMarch) break;
    vec3 q = ro + rd * t; float f = q.y - swellH(q.xz);
    if (f < nearF && f > 0.0) { nearF = f; nearXZ = q.xz; }
    if (f < 0.0) {
      float a = tp, b = t;
      for (int j = 0; j < 5; j++) { float m = 0.5 * (a + b); vec3 qm = ro + rd * m; if (qm.y - swellH(qm.xz) < 0.0) b = m; else a = m; }
      tHit = b; return true;
    }
    tp = t; float u = float(i) / float(uMarch); t = tA + (tB - tA) * u * u;
  }
  if (rd.y < 0.0) { tHit = -ro.y / rd.y; return true; }
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
  // rain and fog add their own extinction (uHaze per km, from visibility by Koschmieder's law; sky/weather.mjs)
  vec3 T = exp(-(extinctionAt(0.0) + vec3(uHaze)) * distM * 0.001);
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
  // the swell's own slope, by central differences over a footprint that widens with distance
  float Js = 1.0;
  if (uHmax > 0.01) {
    float e = max(0.08, t * 0.0025);
    s += vec2(swellH(p.xz + vec2(e, 0.0)) - swellH(p.xz - vec2(e, 0.0)), swellH(p.xz + vec2(0.0, e)) - swellH(p.xz - vec2(0.0, e))) / (2.0 * e);
    Js = swellJ(p.xz);
  }
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
vec3 sea1(vec3 ro, vec3 rd, float t) {
  vec3 p = ro + rd * t;
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
  // the swell's own slope, by central differences over a footprint that widens with distance
  float Js = 1.0;
  if (uHmax > 0.01) {
    float e = max(0.08, t * 0.0025);
    s += vec2(swellH(p.xz + vec2(e, 0.0)) - swellH(p.xz - vec2(e, 0.0)), swellH(p.xz + vec2(0.0, e)) - swellH(p.xz - vec2(0.0, e))) / (2.0 * e);
    Js = swellJ(p.xz);
  }
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
  // whitecaps where small crests fold (J < 0) at the coverage the wind allows (uFoam, Monahan 1971); where the swell
  // itself folds (Js < 0.3) the crest breaks: solid foam on it and a streaked trail behind
  // the crests that break are the highest ones: as much of the sea as the wind's whitecap coverage (Monahan and
  // O'Muircheartaigh 1980, W = 3.84e-6 U^3.41) stands above uBreakH, set from the swell's own height distribution
  // (field.js); a folding crest (Js) breaks too. Foam then streaks downwind, as it does from force 7 up (Beaufort scale)
  // foam is a lace, not a sheet: two octaves of noise drifting with the water give its holes and threads
  float lace = smoothstep(0.42, 0.72, 0.6 * n3(vec3(p.xz * 0.35, uT * 0.3)) + 0.4 * n3(vec3(p.xz * 1.7, uT * 0.8)));
  float brk = max(smoothstep(uBreakH + 0.2 * uSig, uBreakH + 0.8 * uSig, p.y), smoothstep(0.32, 0.05, Js)) * step(0.05, uSpray) * lace;
  vec2 wq = vec2(dot(p.xz, uWindDir), dot(p.xz, vec2(-uWindDir.y, uWindDir.x)));
  float streak = smoothstep(0.68, 0.9, n3(vec3(wq * vec2(0.035, 0.7), 0.5)) * (0.7 + 0.3 * n3(vec3(wq * vec2(0.15, 2.3), 4.5))));
  float trail = (smoothstep(uBreakH - uSig, uBreakH, p.y) * 0.35 * lace + streak * 0.6) * uSpray;
  float foam = max(smoothstep(0.0, -0.4, J) * uFoam, max(brk, trail * 0.6));
  col = mix(col, 0.75 * Ed / PI, clamp(foam, 0.0, 1.0));
  // spray thrown off the breaking crest: a bright, flickering mist in front of it (fast clock: it changes every frame)
  float sp = brk * uSpray * (0.55 + 0.45 * hash(floor(gl_FragCoord.xy * 0.5) + floor(uT * 24.0)));
  col = mix(col, 0.9 * Ed / PI + uLightCol * lightT() * hgp(dot(rd, uL), 0.7) * 2.0, sp * 0.7);
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
  else {
    float tHit, nearF; vec2 nearXZ;
    if (seaMarch(ro, rd, tHit, nearXZ, nearF)) col = sea1(ro, rd, tHit);
    else {
      col = skyEye(rd);
      // a ray that grazes a breaking crest passes through its spray
      if (uSpray > 0.0 && nearF < 2.5) { float b = smoothstep(uBreakH, uBreakH + 0.5 * uSig, swellH(nearXZ)) * uSpray * exp(-nearF);
        vec3 Ed = uLightCol * (lightT() * max(uL.y, 0.0) + skyL(vec3(0.0, 1.0, 0.0)) * PI); col = mix(col, 0.9 * Ed / PI, b * 0.6); }
    }
  }
  // half floats end at 65504; the sun's disk is brighter than that before exposure, and the display clips it anyway
  o = vec4(min(col * uExpo, vec3(6.0e4)), 1.0);
}`;

// display: ACES filmic fit (Narkowicz 2015), the sRGB transfer function (IEC 61966-2-1), triangular dither
export const POST_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uImg; uniform float uFrame, uNight, uLensRain, uT; uniform vec2 uRes;
uniform vec2 uSunUV; uniform float uSunOn, uRays, uGhost, uBloom, uHalation, uQuality;
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 hdrAt(vec2 p) { return texture(uImg, clamp(p, vec2(0.001), vec2(0.999))).rgb; }
in vec2 v; out vec4 o;
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  // rain on the lens: drops are small water lenses that show the scene flipped and shrunk inside them; they land,
  // hold a few seconds and are replaced, more of them in harder rain
  vec2 uv = v; float rim = 0.0;
  if (uLensRain > 0.0) {
    vec2 g = v * vec2(uRes.x / uRes.y, 1.0) * 9.0, c = floor(g), f = fract(g) - 0.5;
    float h = hash(c), life = fract(uT * 0.15 + h * 7.0), r = 0.08 + 0.18 * hash(c + 4.2);
    vec2 o = (vec2(hash(c + 1.3), hash(c + 2.7)) - 0.5) * 0.5, d = f - o;
    float on = step(1.0 - uLensRain * 0.55, h) * step(life, 0.85);
    float k = 1.0 - dot(d, d) / (r * r);
    if (on > 0.0 && k > 0.0) { uv = v - d / 9.0 * 1.2 * sqrt(k); rim = smoothstep(0.25, 0.0, k) * 0.25; }
  }
  vec3 hdr = texture(uImg, uv).rgb * (1.0 - rim);
  vec2 asp = vec2(uRes.y / uRes.x, 1.0);
  // bloom and halation: light scattered in the lens, and at night in the film's base, which glows red round bright
  // points; mist and rain scatter it wider. A golden-angle disk of 16 taps (8 on a phone) over what exceeds white
  if (uBloom + uHalation > 0.0) {
    int N = uQuality > 0.5 ? 16 : 12; vec3 acc = vec3(0.0);
    for (int i = 0; i < 16; i++) { if (i >= N) break;
      float r = sqrt((float(i) + hash(gl_FragCoord.xy + float(i))) / float(N)) * (0.02 + 0.03 * uBloom), an = float(i) * 2.39996 + 6.2832 * hash(gl_FragCoord.yx);
      vec3 c = hdrAt(uv + vec2(cos(an), sin(an)) * r * asp); float l = lum(c); acc += c * max(l - 1.0, 0.0) / max(l, 1e-4); }
    acc /= float(N);
    hdr += acc * uBloom * 0.8 + lum(acc) * vec3(1.0, 0.32, 0.16) * uHalation * 0.9;
  }
  // crepuscular rays: light along the line to the Sun, gathered past the clouds that interrupt it (a screen-space
  // radial march, Mitchell, "Volumetric Light Scattering as a Post-Process", GPU Gems 3, 2007)
  if (uSunOn > 0.0 && uRays > 0.0) {
    int N = uQuality > 0.5 ? 32 : 12; vec2 d = (uSunUV - uv) / float(N) * 0.9, p = uv; float decay = 1.0; vec3 acc = vec3(0.0);
    for (int i = 0; i < 32; i++) { if (i >= N) break; p += d; vec3 c = hdrAt(p); acc += c * smoothstep(1.2, 5.0, lum(c)) * decay; decay *= 0.95; }
    hdr += acc / float(N) * uRays * 0.6;
  }
  // flare ghosts: the bright source reflected between the lens's surfaces, images strung along the line through the
  // centre, each tinted by its coatings; only when the source itself is in frame and not behind cloud
  if (uSunOn > 0.0 && uGhost > 0.0) {
    float src = clamp(lum(hdrAt(uSunUV)) / 400.0, 0.0, 1.0);
    for (int k = 0; k < 4; k++) {
      float f = k == 0 ? -0.35 : k == 1 ? -0.75 : k == 2 ? 0.45 : -1.15, r = k == 0 ? 0.025 : k == 1 ? 0.05 : k == 2 ? 0.014 : 0.08;
      vec3 tint = k == 0 ? vec3(0.55, 0.8, 1.0) : k == 1 ? vec3(1.0, 0.72, 0.42) : k == 2 ? vec3(0.55, 1.0, 0.65) : vec3(0.8, 0.6, 1.0);
      vec2 g = 0.5 + (uSunUV - 0.5) * f; float dd = length((uv - g) * vec2(uRes.x / uRes.y, 1.0));
      hdr += tint * src * uGhost * 0.12 * (smoothstep(r, r * 0.8, dd) * 0.6 + smoothstep(r * 1.05, r, dd) * smoothstep(r * 0.9, r, dd) * 0.4);
    }
  }
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
