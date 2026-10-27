// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// shaders.js: the WebGL2 forms of glass.js renderGlass, liquid.js renderShore and crt.js display. Same formulas and
// parameter names as the CPU references; every texture is sampled top-down (row 0 at v = 0), matching rasters.
import { COMMON } from './gl.js';

const HEAD = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform vec2 u_res;
${COMMON}
uniform float u_linearOut; // 1 when drawing into an sRGB render target, which encodes on write
vec2 pix() { return vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y); }
// output: linear into render targets; to the screen, sRGB plus clumped mono film grain (value noise on 2 px cells,
// u_grain in 8-bit code values, strongest in the mid-tones) and a TPDF dither of one code (no banding in skies)
uniform float u_grain, u_grainSeed;
float vnoise(vec2 q) { vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
vec3 enc(vec3 c) {
  if (u_linearOut > 0.5) return max(c, 0.0);
  vec2 q = gl_FragCoord.xy; float d = hash(q) - hash(q + vec2(17.31, 41.7));
  vec3 s = toSrgb(c); float y = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float g = (vnoise(q * 0.5 + u_grainSeed * 37.0) + vnoise(q * 0.5 + 91.3 - u_grainSeed * 11.0) - 1.0) * 2.45;
  return s + (d + g * u_grain * (0.35 + 2.6 * y * (1.0 - y))) / 255.0;
}
`;

// Glass: u_bg (linear, sRGB texture), u_body (R height px, G coverage), u_caustic (RGB irradiance / open ground).
export const GLASS_FS = HEAD + `
uniform sampler2D u_bg, u_body, u_caustic;
uniform vec3 u_n, u_sigma, u_zen, u_hor, u_gnd, u_key;
uniform float u_gap, u_thick, u_rim, u_keyPow, u_keyShine, u_ck, u_hasC, u_soft, u_flip; // u_flip: background is a render target (rows bottom-up)
uniform vec2 u_light, u_bodyRes;
vec3 env(vec3 R) {
  float up = -R.y; vec3 b = up >= 0.0 ? mix(u_hor, u_zen, clamp(up * 1.6, 0.0, 1.0)) : mix(u_hor, u_gnd, clamp(-up * 3.0, 0.0, 1.0));
  return b + u_keyPow * pow(max(0.0, dot(R, normalize(u_key))), u_keyShine);
}
vec3 lit(vec2 p, float lod) {
  vec2 bu = p / u_res; if (u_flip > 0.5) bu.y = 1.0 - bu.y;
  vec3 c = textureLod(u_bg, bu, lod).rgb;
  if (u_hasC > 0.5) {
    vec2 q = (p - u_light * u_gap) / u_res;
    vec3 L = (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) ? vec3(1.0) : texture(u_caustic, q).rgb;
    c *= 1.0 + u_ck * (L - 1.0);
  }
  return c;
}
vec3 slab(vec3 N, float n, float t, out float path, out bool ok) {
  vec3 t1 = refract(vec3(0.0, 0.0, -1.0), N, 1.0 / n); ok = dot(t1, t1) > 0.0;
  float s1 = t / max(1e-4, -t1.z); path = s1;
  vec3 t2 = refract(t1, vec3(0.0, 0.0, 1.0), n); ok = ok && dot(t2, t2) > 0.0;
  float s2 = u_gap / max(1e-4, -t2.z);
  return vec3(t1.xy * s1 + t2.xy * s2, 0.0);
}
void main() {
  vec2 p = pix(), bq = p / u_res * u_bodyRes; ivec2 bi = ivec2(clamp(bq, vec2(1.0), u_bodyRes - 2.0));
  vec2 bd = texelFetch(u_body, bi, 0).rg; vec3 base = lit(p, 0.0);
  if (bd.g <= 0.0) { o = vec4(enc(base), 1.0); return; }
  float k = u_bodyRes.x / u_res.x;
  float hx = texelFetch(u_body, bi + ivec2(1, 0), 0).r - texelFetch(u_body, bi - ivec2(1, 0), 0).r;
  float hy = texelFetch(u_body, bi + ivec2(0, 1), 0).r - texelFetch(u_body, bi - ivec2(0, 1), 0).r;
  vec3 N = normalize(vec3(-0.5 * hx, -0.5 * hy, 1.0));
  float t = bd.r * u_thick / k, path; bool ok; vec3 g;
  vec3 dr = slab(N, u_n.r, t, path, ok), dg = slab(N, u_n.g, t, path, ok), db = slab(N, u_n.b, t, path, ok);
  vec3 tr = ok ? vec3(lit(p + dr.xy, u_soft).r, lit(p + dg.xy, u_soft).g, lit(p + db.xy, u_soft).b) * exp(-u_sigma * path) : vec3(0.0);
  float F = fresnel(N.z, 1.0, u_n.g), rim = 1.0 - u_rim * pow(1.0 - N.z, 1.5);
  vec3 R = reflect(vec3(0.0, 0.0, -1.0), N);
  g = ok ? (1.0 - F) * tr * rim + F * env(R) : env(R) * rim; // trapped ray: the room, reflected
  o = vec4(enc(mix(base, g, bd.g)), 1.0);
}`;

// Water: u_above (scene, linear), u_obj (standing object, straight alpha), u_s0..u_s3 (slope mips, RG, repeat).
export const WATER_FS = HEAD + `
uniform sampler2D u_above, u_obj, u_s0, u_s1, u_s2, u_s3;
uniform float u_hor, u_cam, u_tile, u_ripple, u_absorb, u_depthSlope, u_shore, u_swash, u_wet, u_contact, u_hasObj, u_drawObj, u_sunPow, u_sunShine, u_t;
uniform vec3 u_deep, u_shallow, u_sand, u_wetSand, u_sunC, u_sunDir;
uniform vec2 u_grid;
uniform vec4 u_wob[8];
vec2 slopeAt(vec2 g, float foot) {
  vec2 q = g / u_grid; float k = clamp(log2(max(1.0, foot)) / 1.6, 0.0, 3.0);
  vec2 a = texture(u_s0, q).rg, b = texture(u_s1, q).rg, c = texture(u_s2, q).rg, d = texture(u_s3, q).rg;
  vec2 s = k < 1.0 ? mix(a, b, k) : k < 2.0 ? mix(b, c, k - 1.0) : mix(c, d, k - 2.0);
  return s * clamp(1.0 - (foot - 3.0) / 24.0, 0.0, 1.0);
}
void main() {
  vec2 p = pix(); float yh = u_hor * u_res.y, f = u_res.y, cx = u_res.x * 0.5;
  if (p.y <= yh) { o = vec4(enc(texture(u_above, p / u_res).rgb), 1.0); return; }
  float dy = p.y - yh, z = u_cam * f / dy, wx = (p.x - cx) * z / f, foot = z / f / u_tile;
  vec2 s = slopeAt(vec2(wx, z) / u_tile, foot);
  vec3 n = normalize(vec3(-s.x * u_ripple, 1.0, -s.y * u_ripple)), v = normalize(vec3(wx, -u_cam, z));
  vec3 r = reflect(v, n); float ry = max(1e-3, r.y), rz = max(1e-3, r.z);
  vec2 q = vec2(cx + f * r.x / rz, yh - f * ry / rz), off = q - vec2(p.x, 2.0 * yh - p.y);
  float F = fresnel(-dot(v, n), 1.0, 1.333);
  float edge = u_shore * u_res.y;
  for (int i = 0; i < 8; i++) edge += u_swash * u_res.y * sin(u_wob[i].x + u_wob[i].y * p.x / u_res.x * 6.283 + u_t * u_wob[i].z) / 4.0;
  float sandMix = clamp((p.y - edge) / 3.0, 0.0, 1.0);
  vec3 rc = textureLod(u_above, q / u_res, sandMix * 2.5).rgb;
  if (u_hasObj > 0.5) {
    vec2 m = vec2(p.x + off.x, 2.0 * u_contact - p.y + off.y);
    if (m.y <= u_contact && m.y >= 0.0) { vec4 ob = texture(u_obj, m / u_res); rc = mix(rc, ob.rgb * 0.92, ob.a); }
  }
  float spec = u_sunPow * pow(max(0.0, dot(r, normalize(u_sunDir))), u_sunShine);
  float depth = max(0.0, u_depthSlope * (u_res.y * u_shore - p.y) * (z / u_cam) * 0.05 + 0.02), T = exp(-u_absorb * depth / max(0.2, -v.y));
  vec3 body = T * u_sand * 0.8 + (1.0 - T) * mix(u_deep, u_shallow, clamp(1.0 - depth * 2.0, 0.0, 1.0));
  vec3 water = F * (rc + spec * u_sunC) + (1.0 - F) * body;
  vec3 film = mix(0.02, 0.35, u_wet) * (rc + spec * u_sunC * 0.4) + u_wetSand * (1.0 - 0.35 * u_wet);
  vec3 col = mix(water, film, sandMix);
  if (u_drawObj > 0.5) { vec4 ob = texture(u_obj, p / u_res); col = mix(col, ob.rgb, ob.a); }
  o = vec4(enc(col), 1.0);
}`;

// CRT display: u_sig (gamma-encoded R'G'B', samples x lines), u_halo (the same, blurred), as in crt.js display.
export const CRT_FS = HEAD + `
uniform sampler2D u_sig, u_halo;
uniform vec2 u_sigRes;
uniform float u_gamma, u_spot, u_bloom, u_mask, u_pitch, u_halation, u_curve, u_vignette, u_exposure, u_snow, u_frame;
uniform vec3 u_bezel;
// snow on luma, per sample and frame: three hashes summed (near-Gaussian), low-passed over neighbouring samples
float snowAt(float s, float l) {
  float a = 0.0;
  for (int k = -1; k <= 1; k++) { vec2 q = vec2(floor(s) + float(k), l + u_frame * 263.0); a += (hash(q) + hash(q + 91.7) + hash(q + 37.3) - 1.5) * (k == 0 ? 0.5 : 0.25); }
  return a * 2.0;
}
vec3 line(float l, float su) { return texture(u_sig, vec2(su / u_sigRes.x, (l + 0.5) / u_sigRes.y)).rgb + u_snow * snowAt(su, l); }
void main() {
  vec2 p = pix(), nn = p / u_res * 2.0 - 1.0; float r2 = dot(nn, nn);
  nn *= vec2(1.0 + u_curve * r2 * 0.25, 1.0 + u_curve * r2 * 0.3);
  if (abs(nn.x) > 1.0 || abs(nn.y) > 1.0) { o = vec4(enc(u_bezel), 1.0); return; }
  float su = (nn.x + 1.0) * 0.5 * u_sigRes.x, sl = (nn.y + 1.0) * 0.5 * u_sigRes.y, l0 = floor(sl - 0.5);
  vec3 acc = vec3(0.0);
  for (int k = -1; k <= 2; k++) {
    float l = l0 + float(k); if (l < 0.0 || l >= u_sigRes.y) continue;
    vec3 e = pow(max(line(l, su), 0.0), vec3(u_gamma)) * u_exposure;
    vec3 sg = u_spot * (1.0 + u_bloom * sqrt(e)); float d = sl - (l + 0.5);
    acc += e * exp(-0.5 * (d / sg) * (d / sg)) / (sg * 2.5066);
  }
  float vig = 1.0 - u_vignette * pow(dot(nn, nn) * 0.5, 1.5);
  float tri = floor(mod(p.x, u_pitch) * 3.0 / u_pitch);
  vec3 m = 1.0 - u_mask + u_mask * 3.0 * vec3(tri == 0.0, tri == 1.0, tri == 2.0);
  vec3 halo = pow(max(texture(u_halo, (nn + 1.0) * 0.5).rgb, 0.0), vec3(u_gamma)) * u_exposure;
  o = vec4(enc(acc * vig * m + u_halation * halo), 1.0);
}`;

// Band: a dark ground with soft falloff, plus one strip of tube face (u_tube, rendered by CRT_FS into a target of
// u_tubeRes) faded at both ends and soft at top and bottom, with convergence error growing toward the sides.
export const BAND_FS = HEAD + `
uniform sampler2D u_tube;
uniform vec2 u_tubeRes;
uniform vec3 u_g0, u_g1;
uniform float u_y, u_h, u_conv;
void main() {
  vec2 p = pix(), q = p / u_res; float d = length(vec2((q.x - 0.5) * u_res.x / u_res.y, q.y - 0.5)) / 0.8;
  vec3 c = mix(u_g0, u_g1, smoothstep(0.0, 1.0, d));
  float side = abs(q.x - 0.5) * 2.0, fx = smoothstep(1.0, 0.55, side), bh = u_h * u_res.y, y0 = u_y * u_res.y - bh * 0.5;
  for (int k = 0; k < 3; k++) {
    float ty = p.y - y0 + float(k - 1) * u_conv * u_res.y * (0.3 + side);
    float fy = smoothstep(0.0, 0.12 * bh, ty) * smoothstep(bh, 0.88 * bh, ty);
    if (ty >= 0.0 && ty < bh) c[k] += texture(u_tube, vec2(q.x, 1.0 - ty / bh)).rgb[k] * fx * fy;
  }
  o = vec4(enc(c), 1.0);
}`;
