// WGSL for the faceplate passes: halo down, halo convolution, compose and the 8-bit
// display encode. Mirrors glass.mjs. Compose also needs GEOMETRY_WGSL for footprint().
export const HALO_DOWN_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> em: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> hd: array<vec4f>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let gw = u32(P[P_gw]); let gh = u32(P[P_gh]); let q = u32(P[P_haloQ]); let W = u32(P[P_outW]); let H = u32(P[P_outH]);
  if (id.x >= gw || id.y >= gh) { return; }
  var s = vec3f(0.0); var n = 0.0;
  for (var y = id.y * q; y < min(H, id.y * q + q); y++) { for (var x = id.x * q; x < min(W, id.x * q + q); x++) { s += em[y * W + x].xyz; n += 1.0; } }
  hd[id.y * gw + id.x] = vec4f(s / n, 0.0);
}`;

export const HALO_CONV_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> kern: array<f32>;
@group(0) @binding(2) var<storage, read> hd: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> hc: array<vec4f>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let gw = i32(P[P_gw]); let gh = i32(P[P_gh]); let R = i32(P[P_haloR]); let S = 2 * R + 1;
  let x = i32(id.x); let y = i32(id.y);
  if (x >= gw || y >= gh) { return; }
  var s = vec3f(0.0);
  for (var dy = -R; dy <= R; dy++) {
    let yy = y + dy; if (yy < 0 || yy >= gh) { continue; }
    for (var dx = -R; dx <= R; dx++) {
      let xx = x + dx; if (xx < 0 || xx >= gw) { continue; }
      s += kern[u32((dy + R) * S + dx + R)] * hd[u32(yy * gw + xx)].xyz;
    }
  }
  hc[u32(y * gw + x)] = vec4f(s, 0.0);
}`;

export const COMPOSE_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> em: array<vec4f>;
@group(0) @binding(2) var<storage, read> hc: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> img: array<vec4f>;
fn halo_at(px: f32, py: f32) -> vec3f {
  let q = P[P_haloQ]; let gw = i32(P[P_gw]); let gh = i32(P[P_gh]);
  let fx = clamp((px + 0.5) / q - 0.5, 0.0, f32(gw - 1)); let fy = clamp((py + 0.5) / q - 0.5, 0.0, f32(gh - 1));
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy)); let x1 = min(gw - 1, x0 + 1); let y1 = min(gh - 1, y0 + 1);
  let tx = fx - f32(x0); let ty = fy - f32(y0);
  let a = hc[u32(y0 * gw + x0)].xyz; let b = hc[u32(y0 * gw + x1)].xyz; let c = hc[u32(y1 * gw + x0)].xyz; let d = hc[u32(y1 * gw + x1)].xyz;
  return (a * (1.0 - tx) + b * tx) * (1.0 - ty) + (c * (1.0 - tx) + d * tx) * ty;
}
fn fresnel_air(n: f32, theta: f32) -> f32 {
  let s = sin(theta) / n; let ci = cos(theta); let ct = sqrt(1.0 - s * s);
  let rs = (ci - n * ct) / (ci + n * ct); let rp = (ct - n * ci) / (ct + n * ci);
  return 0.5 * (rs * rs + rp * rp);
}
fn room_env(d: vec3f) -> f32 {
  let c = dot(d, vec3f(-0.38, -0.33, -0.864)); let t = clamp((c - 0.975) / 0.02, 0.0, 1.0);
  return 0.04 + t * t * (3.0 - 2.0 * t);
}
fn glass_reflection(sx: f32, sy: f32) -> f32 {
  let rx = P[P_rx]; let ry = P[P_ry]; let D = P[P_dist];
  let sz = sx * sx / (2.0 * rx) + sy * sy / (2.0 * ry);
  let i = normalize(vec3f(sx, sy, sz + D)); let n = normalize(vec3f(sx / rx, sy / ry, -1.0));
  let d = dot(i, n);
  return fresnel_air(P[P_glassN], acos(min(1.0, abs(d)))) * room_env(i - 2.0 * d * n);
}
fn gamut_fit(rgb: vec3f) -> vec3f {
  let L = vec3f(P[P_luma], P[P_luma + 1u], P[P_luma + 2u]); let Y = max(0.0, dot(L, rgb));
  let m = min(rgb.x, min(rgb.y, rgb.z));
  if (m >= 0.0) { return rgb; }
  return Y + (Y / (Y - m)) * (rgb - Y);
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let W = u32(P[P_outW]); let H = u32(P[P_outH]);
  if (id.x >= W || id.y >= H) { return; }
  let pix = id.y * W + id.x; let e = em[pix]; let a = e.w;
  let fp = footprint(f32(id.x), f32(id.y));
  let gun = P[P_haloDirect] * e.xyz + halo_at(f32(id.x), f32(id.y));
  let m = P_M;
  let rgb = gamut_fit(vec3f(P[m] * gun.x + P[m + 1u] * gun.y + P[m + 2u] * gun.z,
    P[m + 3u] * gun.x + P[m + 4u] * gun.y + P[m + 5u] * gun.z, P[m + 6u] * gun.x + P[m + 7u] * gun.y + P[m + 8u] * gun.z));
  let black = P[P_ambient] * P[P_transmission]; let spec = P[P_reflection] * glass_reflection(fp.x, fp.y);
  let bezel = vec3f(P[P_bezel], P[P_bezel + 1u], P[P_bezel + 2u]);
  img[pix] = vec4f(a * (rgb + black + spec) + (1.0 - a) * bezel, 1.0);
}`;

export const ENCODE8_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> img: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> out8: array<u32>;
fn shoulder(x: f32) -> f32 { let k = 0.8; if (x <= k) { return x; } return k + (1.0 - k) * tanh((x - k) / (1.0 - k)); }
fn enc(v: f32) -> u32 {
  let l = shoulder(max(0.0, v * P[P_exposure]));
  var s: f32; if (l <= 0.0031308) { s = l * 12.92; } else { s = 1.055 * pow(l, 1.0 / 2.4) - 0.055; }
  return u32(clamp(floor(s * 255.0 + 0.5), 0.0, 255.0));
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let W = u32(P[P_outW]); let H = u32(P[P_outH]);
  if (id.x >= W || id.y >= H) { return; }
  let c = img[id.y * W + id.x];
  out8[id.y * W + id.x] = enc(c.x) | (enc(c.y) << 8u) | (enc(c.z) << 16u) | (255u << 24u);
}`;
