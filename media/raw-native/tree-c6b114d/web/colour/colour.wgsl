// Colour: tone mappers and display encodings, the WGSL twin of the C++ reference in
// src/renderer/colour*.cpp and aces2*.cpp (raw/renderer/colour.hpp). Scene-linear
// Rec.709 in, encoded display values in [0,1] out. The ACES 2.0 tables are built by
// the C++ reference (raw_native_cli colour tables) and packed by colour.mjs; this
// file only evaluates them. The ACES 2.0 functions are ported from OpenColorIO v2.6.0
// (BSD-3-Clause, Copyright Contributors to the OpenColorIO Project).
//
// The including shader declares `cp: ColourParams` and `cd: array<f32>` (packed by
// colour.mjs, offsets below) and calls colour_apply(rgb).

struct ColourParams { tone: u32, output: u32, pad0: u32, pad1: u32 };
// tone: 0 clip, 1 pbr-neutral, 2 agx, 3 aces2. output: 0 srgb, 1 display-p3, 2 rec2020, 3 rec2100-pq,
// 4 srgb-extended (sign-extended sRGB curve, unclamped; for a canvas in extended tone-mapping mode).

const O_TO_AP0 = 0u; const O_AP0_TO_AP1 = 9u; const O_AP1_TO_AP0 = 18u; const O_AP1_UPPER = 27u;
const O_OUT_M = 28u; const O_PEAK = 37u; const O_CAM_IN = 38u; const O_CAM_OUT = 79u;
const O_TS = 120u; const O_LIMIT_J = 125u; const O_GAMMA_INV = 126u; const O_CHROMA = 127u;
const O_GAMUT = 131u; const O_AGX_IN = 136u; const O_AGX_OUTSET = 145u; const O_AGX_OUT = 154u;
const O_REACH = 163u; const O_HUE = 526u; const O_CUSP = 889u;
// A camera block: rgb_to_cam (0), cam_to_rgb (9), cone_to_aab (18), aab_to_cone (27),
// F_L_n (36), cz (37), inv_cz (38), A_w_J (39), inv_A_w_J (40).
const T_LOWER_WRAP = 0u; const T_UPPER_WRAP = 361u; const T_FIRST = 1u;
const PI = 3.14159265358979;

fn m3(o: u32, v: vec3f) -> vec3f {
  return vec3f(cd[o] * v.x + cd[o + 1u] * v.y + cd[o + 2u] * v.z,
               cd[o + 3u] * v.x + cd[o + 4u] * v.y + cd[o + 5u] * v.z,
               cd[o + 6u] * v.x + cd[o + 7u] * v.y + cd[o + 8u] * v.z);
}
fn powp(x: f32, y: f32) -> f32 { return select(pow(x, y), 0.0, x <= 0.0); }
fn lerpf(a: f32, b: f32, z: f32) -> f32 { return (b - a) * z + a; }

// ---- encodings ---------------------------------------------------------------
fn srgb_encode(x: f32) -> f32 {
  let v = clamp(x, 0.0, 1.0);
  return select(1.055 * powp(v, 1.0 / 2.4) - 0.055, 12.92 * v, v <= 0.0031308);
}
fn srgb_ext(x: f32) -> f32 {
  let a = abs(x);
  return sign(x) * select(1.055 * powp(a, 1.0 / 2.4) - 0.055, 12.92 * a, a <= 0.0031308);
}
fn pq_encode(linear100: f32) -> f32 {
  let p = powp(max(linear100, 0.0) / 100.0, 2610.0 / 16384.0);
  return powp((3424.0 / 4096.0 + 2413.0 / 128.0 * p) / (1.0 + 2392.0 / 128.0 * p), 2523.0 / 32.0);
}
fn encode(o: u32, v: vec3f) -> vec3f {
  if (o == 2u) { return vec3f(powp(min(v.x, 1.0), 1.0 / 2.4), powp(min(v.y, 1.0), 1.0 / 2.4), powp(min(v.z, 1.0), 1.0 / 2.4)); }
  if (o == 3u) { return vec3f(pq_encode(v.x), pq_encode(v.y), pq_encode(v.z)); }
  if (o == 4u) { return vec3f(srgb_ext(v.x), srgb_ext(v.y), srgb_ext(v.z)); }
  return vec3f(srgb_encode(v.x), srgb_encode(v.y), srgb_encode(v.z));
}

// ---- PBR Neutral and AgX -----------------------------------------------------
fn pbr_neutral(c0: vec3f) -> vec3f {
  let start = 0.8 - 0.04;
  let x = min(c0.x, min(c0.y, c0.z));
  let offset = select(0.04, x - 6.25 * x * x, x < 0.08);
  let c = c0 - offset;
  let peak = max(c.x, max(c.y, c.z));
  if (peak < start) { return c; }
  let d = 1.0 - start;
  let newPeak = 1.0 - d * d / (peak + d - start);
  let g = 1.0 - 1.0 / (0.15 * (peak - newPeak) + 1.0);
  return mix(c * (newPeak / peak), vec3f(newPeak), g);
}
fn agx(c: vec3f) -> vec3f {
  var v = m3(O_AGX_IN, c);
  v = clamp((log2(max(v, vec3f(1e-10))) + 12.47393) / (4.026069 + 12.47393), vec3f(0.0), vec3f(1.0));
  let x2 = v * v;
  let x4 = x2 * x2;
  v = 15.5 * x4 * x2 - 40.14 * x4 * v + 31.96 * x4 - 6.868 * x2 * v + 0.4298 * x2 + 0.1191 * v - 0.00232;
  let o = m3(O_AGX_OUTSET, v);
  return clamp(m3(O_AGX_OUT, vec3f(powp(o.x, 2.2), powp(o.y, 2.2), powp(o.z, 2.2))), vec3f(0.0), vec3f(1.0));
}

// ---- ACES 2.0: CAM ---------------------------------------------------------------
fn cone_fwd(v: f32) -> f32 {
  let f = powp(abs(v), 0.42);
  return sign(v) * f / (27.13 + f);
}
fn cone_inv(v: f32) -> f32 {
  let ra = min(abs(v), 0.99);
  return sign(v) * powp((27.13 * ra) / (1.0 - ra), 1.0 / 0.42);
}
fn rgb_to_aab(rgb: vec3f, b: u32) -> vec3f {
  let m = m3(b, rgb);
  return m3(b + 18u, vec3f(cone_fwd(m.x), cone_fwd(m.y), cone_fwd(m.z)));
}
fn aab_to_rgb(aab: vec3f, b: u32) -> vec3f {
  let a = m3(b + 27u, aab);
  return m3(b + 9u, vec3f(cone_inv(a.x), cone_inv(a.y), cone_inv(a.z)));
}
// atan2 from arithmetic alone: the same sequence as hue_atan2 in src/renderer/aces2.hpp.
// Built-in atan2 may be off by 4096 ulp, and the hue tables index by truncated degree
// (M1 criterion 3, 2026-10-10). Within 3 ulp of atan2.
fn hue_atan2(y: f32, x: f32) -> f32 {
  let ax = abs(x);
  let ay = abs(y);
  if (ax == 0.0 && ay == 0.0) { return 0.0; }
  let swap = ay > ax;
  var t = select(ay / ax, ax / ay, swap);
  let big = t > 0.2679491924;
  if (big) { t = (t * 1.7320508076 - 1.0) / (1.7320508076 + t); }
  let t2 = t * t;
  var a = t * (1.0 + t2 * (-1.0 / 3.0 + t2 * (1.0 / 5.0 + t2 * (-1.0 / 7.0 + t2 * (1.0 / 9.0 + t2 * (-1.0 / 11.0))))));
  if (big) { a = a + 0.5235987756; }
  if (swap) { a = 1.5707963268 - a; }
  if (x < 0.0) { a = PI - a; }
  return select(a, -a, y < 0.0);
}
fn aab_to_jmh(aab: vec3f, b: u32) -> vec3f {
  if (aab.x <= 0.0) { return vec3f(0.0); }
  var h = 180.0 * hue_atan2(aab.z, aab.y) / PI;
  if (h < 0.0) { h = h + 360.0; }
  return vec3f(100.0 * powp(aab.x, cd[b + 37u]), length(aab.yz), h);
}
fn a_to_y(a: f32, b: u32) -> f32 { return cone_inv(cd[b + 39u] * a) / cd[b + 36u]; }
fn y_to_j(y: f32, b: u32) -> f32 {
  return 100.0 * powp(cone_fwd(abs(y) * cd[b + 36u]) * cd[b + 40u], cd[b + 37u]);
}

// ---- ACES 2.0: tone scale and chroma compression ----------------------------------
fn tonescale_a_to_j(a: f32) -> f32 {
  let y = a_to_y(a, O_CAM_IN);
  let f = cd[O_TS + 4u] * powp(y / (y + cd[O_TS + 3u]), cd[O_TS + 1u]);
  let yts = max(0.0, f * f / (f + cd[O_TS + 2u])) * cd[O_TS];
  return y_to_j(yts, O_CAM_IN);
}
fn chroma_norm(c1: f32, s1: f32) -> f32 {
  let c2 = 2.0 * c1 * c1 - 1.0;
  let s2 = 2.0 * c1 * s1;
  let c3 = 4.0 * c1 * c1 * c1 - 3.0 * c1;
  let s3 = 3.0 * s1 - 4.0 * s1 * s1 * s1;
  return (11.34072 * c1 + 16.46899 * c2 + 7.88380 * c3 + 14.66441 * s1 - 6.37224 * s2 + 9.19364 * s3 + 77.12896) * cd[O_CHROMA + 3u];
}
fn toe_fwd(x: f32, limit: f32, k1_in: f32, k2_in: f32) -> f32 {
  if (x > limit) { return x; }
  let k2 = max(k2_in, 0.001);
  let k1 = sqrt(k1_in * k1_in + k2 * k2);
  let k3 = (limit + k1) / (limit + k2);
  let mb = k3 * x - k1;
  return 0.5 * (mb + sqrt(mb * mb + 4.0 * k2 * k3 * x));
}
fn reach_m(h: f32) -> f32 {
  let base = u32(h);
  let i = base + T_FIRST;
  return lerpf(cd[O_REACH + i], cd[O_REACH + i + 1u], h - f32(base));
}
fn chroma_compress(jmh: vec3f, jts: f32, mnorm: f32, reach: f32) -> f32 {
  if (jmh.y == 0.0) { return 0.0; }
  let ljm = cd[O_LIMIT_J];
  let gi = cd[O_GAMMA_INV];
  let nj = jts / ljm;
  let snj = max(0.0, 1.0 - nj);
  let limit = powp(nj, gi) * reach / mnorm;
  var m = jmh.y * powp(jts / jmh.x, gi) / mnorm;
  m = limit - toe_fwd(limit - m, limit - 0.001, snj * cd[O_CHROMA], sqrt(nj * nj + cd[O_CHROMA + 1u]));
  m = toe_fwd(m, limit, nj * cd[O_CHROMA + 2u], snj);
  return m * mnorm;
}

// ---- ACES 2.0: gamut compression ----------------------------------------------
fn hue_interval(h: f32) -> u32 {
  var i = T_FIRST + u32(h);
  var lo = u32(max(0, i32(i) + i32(cd[O_GAMUT + 3u])));
  var hi = u32(min(i32(T_UPPER_WRAP), i32(i) + i32(cd[O_GAMUT + 4u])));
  loop {
    if (lo + 1u >= hi) { break; }
    if (h > cd[O_HUE + i]) { lo = i; } else { hi = i; }
    i = (lo + hi) / 2u;
  }
  return max(1u, hi);
}
fn focus_gain(j: f32, thr: f32, ljm: f32) -> f32 {
  var gain = ljm * cd[O_GAMUT + 1u];
  if (j > thr) {
    let adj = log2((ljm - thr) / max(0.0001, ljm - j)) / log2(10.0);
    gain = gain * (adj * adj + 1.0);
  }
  return gain;
}
fn solve_j(j: f32, m: f32, focus: f32, maxj: f32, gain: f32) -> f32 {
  let ms = m / gain;
  let a = ms / focus;
  if (j < focus) {
    let b = 1.0 - ms;
    let c = -j;
    return -2.0 * c / (b + sqrt(b * b - 4.0 * a * c));
  }
  let b = -(1.0 + ms + maxj * a);
  let c = maxj * ms + j;
  return -2.0 * c / (b - sqrt(b * b - 4.0 * a * c));
}
fn line_boundary_m(jx: f32, slope: f32, inv_gamma: f32, jmax: f32, mmax: f32, jref: f32) -> f32 {
  return jref * powp(jx / jref, inv_gamma) * mmax / (jmax - slope * mmax);
}
fn gamut_compress(jmh: vec3f, reach: f32) -> vec3f {
  let j = jmh.x; let m = jmh.y; let h = jmh.z;
  let ljm = cd[O_LIMIT_J];
  if (j <= 0.0) { return vec3f(0.0, 0.0, h); }
  if (m <= 0.0 || j > ljm) { return vec3f(j, 0.0, h); }
  let hi = hue_interval(h);
  let t = (h - cd[O_HUE + hi - 1u]) / (cd[O_HUE + hi] - cd[O_HUE + hi - 1u]);
  let c0 = O_CUSP + 3u * (hi - 1u);
  let c1 = O_CUSP + 3u * hi;
  let cj = lerpf(cd[c0], cd[c1], t);
  let cm = lerpf(cd[c0 + 1u], cd[c1 + 1u], t);
  let top_inv = lerpf(cd[c0 + 2u], cd[c1 + 2u], t);
  let focus = lerpf(cj, cd[O_GAMUT], min(1.0, 1.3 - cj / ljm));
  let thr = lerpf(cj, ljm, 0.3);
  let gain = focus_gain(j, thr, ljm);
  let jis = solve_j(j, m, focus, ljm, gain);
  let dir = select(ljm - jis, jis, jis < focus);
  let slope = dir * (jis - focus) / (focus * gain);
  let jic = solve_j(cj, cm, focus, ljm, gain);
  let lower = line_boundary_m(jis, slope, cd[O_GAMUT + 2u], cj, cm, jic);
  let upper = line_boundary_m(ljm - jis, -slope, top_inv, ljm - cj, cm, ljm - jic);
  let s = 0.12 * cm;
  let hh = max(s - abs(lower - upper), 0.0) / s;
  let boundary = min(lower, upper) - hh * hh * hh * s * (1.0 / 6.0);
  if (boundary <= 0.0) { return vec3f(j, 0.0, h); }
  let reach_b = line_boundary_m(jis, slope, cd[O_GAMMA_INV], ljm, reach, ljm);
  let prop = max(boundary / reach_b, 0.75);
  let threshold = prop * boundary;
  var mr = m;
  if (!(m <= threshold || prop >= 1.0)) {
    let go = boundary - threshold;
    let ro = reach_b - threshold;
    let scale = ro / ((ro / go) - 1.0);
    let nd = (m - threshold) / scale;
    mr = threshold + scale * nd / (1.0 + nd);
  }
  return vec3f(jis + mr * slope, mr, h);
}

fn aces2(rgb709: vec3f) -> vec3f {
  let ap1 = clamp(m3(O_AP0_TO_AP1, m3(O_TO_AP0, rgb709)), vec3f(0.0), vec3f(cd[O_AP1_UPPER]));
  let ap0 = m3(O_AP1_TO_AP0, ap1);
  let aab = rgb_to_aab(ap0, O_CAM_IN);
  let jmh = aab_to_jmh(aab, O_CAM_IN);
  let reach = reach_m(jmh.z);
  // cos and sin of the hue straight from the opponent coordinates (aces2_gamut.cpp forward):
  // no round trip through the angle.
  let ch = select(1.0, aab.y / jmh.y, jmh.y > 0.0);
  let sh = select(0.0, aab.z / jmh.y, jmh.y > 0.0);
  let jts = tonescale_a_to_j(aab.x);
  let mcp = chroma_compress(jmh, jts, chroma_norm(ch, sh), reach);
  let g = gamut_compress(vec3f(jts, mcp, jmh.z), reach);
  let a = powp(g.x / 100.0, cd[O_CAM_OUT + 38u]);
  let out = aab_to_rgb(vec3f(a, g.y * ch, g.y * sh), O_CAM_OUT);
  return clamp(out, vec3f(0.0), vec3f(cd[O_PEAK] / 100.0));
}

fn colour_apply(rgb: vec3f) -> vec3f {
  var lin = rgb;
  if (cp.tone == 1u) { lin = pbr_neutral(rgb); }
  else if (cp.tone == 2u) { lin = agx(rgb); }
  else if (cp.tone == 3u) { lin = aces2(rgb); }
  return encode(cp.output, m3(O_OUT_M, lin));
}
