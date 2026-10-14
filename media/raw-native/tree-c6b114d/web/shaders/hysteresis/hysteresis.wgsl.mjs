// WGSL for hysteresis quantisation (hysteresis.mjs), one pass per frame.
// P: 0 w, 1 h, 2 mode (0 bands, 1 palette), 3 N, 4 margin, 5 gain, 6 depthTol, 7 K, 8 palette size,
// 9 has previous state, 10 has motion, 11 hysteresis on.
// motion per pixel: (mx, my, expected previous distance, this frame's distance).
// state per pixel: (decision, persistence count, distance, 0).
export const HYST_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> pal: array<vec4f>;
@group(0) @binding(2) var<storage, read> img: array<vec4f>;
@group(0) @binding(3) var<storage, read> motion: array<vec4f>;
@group(0) @binding(4) var<storage, read> prev: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> next: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> out8: array<u32>;
fn cbrt_(x: f32) -> f32 { return select(0.0, pow(x, 1.0 / 3.0), x > 0.0); }
fn shoulder(v: f32) -> f32 { return 1.0 - exp(-max(0.0, v) * P[5]); }
fn to_oklab(c: vec3f) -> vec3f {
  let l = cbrt_(0.4122214708 * c.x + 0.5363325363 * c.y + 0.0514459929 * c.z);
  let m = cbrt_(0.2119034982 * c.x + 0.6806995451 * c.y + 0.1073969566 * c.z);
  let s = cbrt_(0.0883024619 * c.x + 0.2817188376 * c.y + 0.6299787005 * c.z);
  return vec3f(0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s);
}
fn from_oklab(q: vec3f) -> vec3f {
  let l = pow3(q.x + 0.3963377774 * q.y + 0.2158037573 * q.z); let m = pow3(q.x - 0.1055613458 * q.y - 0.0638541728 * q.z); let s = pow3(q.x - 0.0894841775 * q.y - 1.291485548 * q.z);
  return vec3f(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}
fn pow3(x: f32) -> f32 { return x * x * x; }
fn enc8(v: f32) -> u32 { let c = clamp(v, 0.0, 1.0); var s = 1.055 * pow(c, 1.0 / 2.4) - 0.055; if (c <= 0.0031308) { s = c * 12.92; } return u32(floor(s * 255.0 + 0.5)); }
fn plain_decision(lab: vec3f) -> i32 {
  if (P[2] < 0.5) { let N = P[3]; return i32(clamp(floor(lab.x * N + 0.5), 0.0, N)); }
  var best = 0; var bd = 1e30;
  for (var k = 0; k < i32(round(P[8])); k++) { let d = length(lab - pal[k].xyz); if (d < bd) { bd = d; best = k; } }
  return best;
}
fn keep(lab: vec3f, p: i32, plain: i32) -> bool {
  if (P[2] < 0.5) { let x = lab.x * P[3]; return x >= f32(p) - 0.5 - P[4] && x <= f32(p) + 0.5 + P[4]; }
  return length(lab - pal[p].xyz) <= length(lab - pal[plain].xyz) + P[4];
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = i32(round(P[0])); let h = i32(round(P[1])); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let i = y * w + x; let c = img[i].xyz; let lab = to_oklab(vec3f(shoulder(c.x), shoulder(c.y), shoulder(c.z)));
  let plain = plain_decision(lab); var d = plain; var cnt = 0.0; let mo = motion[i];
  if (P[11] > 0.5 && P[9] > 0.5) {
    var mx = 0.0; var my = 0.0; if (P[10] > 0.5) { mx = mo.x; my = mo.y; }
    let px = i32(floor(f32(x) + 0.5 - mx)); let py = i32(floor(f32(y) + 0.5 - my));
    if (px >= 0 && py >= 0 && px < w && py < h) {
      let s = prev[py * w + px]; let expect = mo.z;
      if (abs(s.z - expect) <= P[6] * expect) {
        let pv = i32(round(s.x));
        if (pv != plain && keep(lab, pv, plain)) { let cc = s.y + 1.0; if (cc < P[7]) { d = pv; cnt = cc; } }
      }
    }
  }
  next[i] = vec4f(f32(d), cnt, mo.w, 0.0);
  var rgb: vec3f;
  if (P[2] < 0.5) { let Lq = f32(d) / P[3]; var s = 0.0; if (lab.x > 1e-9) { s = Lq / lab.x; } rgb = from_oklab(vec3f(Lq, lab.y * s, lab.z * s)); }
  else { rgb = from_oklab(pal[d].xyz); }
  out8[i] = enc8(rgb.x) | (enc8(rgb.y) << 8u) | (enc8(rgb.z) << 16u) | (255u << 24u);
}
`;
