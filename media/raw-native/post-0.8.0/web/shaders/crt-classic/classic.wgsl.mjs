// WGSL port of the Studio's tube stage (reference/retro-crt.mjs, the author's retro-crt.js).
// Same passes, same 8.8 fixed point in the integer paths, same tables (uploaded from the
// reference's own beamTable, maskTable and transfer tables). Frames are RGBA8 as u32.
const HEAD = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
fn W() -> i32 { return i32(P[0]); } fn H() -> i32 { return i32(P[1]); }
fn ch(v: u32, c: u32) -> i32 { return i32((v >> (8u * c)) & 255u); }
fn pack(r: i32, g: i32, b: i32) -> u32 { return u32(clamp(r, 0, 255)) | (u32(clamp(g, 0, 255)) << 8u) | (u32(clamp(b, 0, 255)) << 16u) | (255u << 24u); }
`;
// P: 0 w, 1 h, 2 cell, 3 phosphor on, 4 flatCell, 5 flatEven, 6 flatOdd, 7 q, 8 lw, 9 lh,
// 10 rBloom, 11 rHal, 12 bloom, 13 halation, 14 curvature, 15 aberration, 16 vignette.

export const PHOSPHOR_WGSL = HEAD + /* wgsl */ `
@group(0) @binding(1) var<storage, read> beam: array<i32>;
@group(0) @binding(2) var<storage, read> mt: array<i32>;
@group(0) @binding(3) var<storage, read> src: array<u32>;
@group(0) @binding(4) var<storage, read_write> dst: array<u32>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= W() || y >= H()) { return; }
  let i = y * W() + x; let v = src[i];
  if (P[3] < 0.5) { dst[i] = v; return; }
  let cell = i32(P[2]); let row = y % cell; let ry = (y % 6) * 3;
  var flat = 0; if (P[4] > 0.5) { flat = select(i32(P[6]), i32(P[5]), (y & 1) == 0); }
  let r = ch(v, 0u); let g = ch(v, 1u); let b = ch(v, 2u); let p = (ry + x % 3) * 3;
  let k = max(max(r, g), b) >> 4u;
  var f = beam[k * cell + row]; if (flat > 0) { f = flat; }
  dst[i] = pack((r * f * mt[p] + 32768) >> 16u, (g * f * mt[p + 1] + 32768) >> 16u, (b * f * mt[p + 2] + 32768) >> 16u);
}`;

// Box-downsample into linear light (f32 accumulation in the reference's order), then the
// thresholded bright field.
export const GLOW_DOWN_WGSL = HEAD + /* wgsl */ `
@group(0) @binding(1) var<storage, read> toLin: array<f32>;
@group(0) @binding(2) var<storage, read> src: array<u32>;
@group(0) @binding(3) var<storage, read_write> lin: array<f32>;
@group(0) @binding(4) var<storage, read_write> bright: array<f32>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let q = i32(P[7]); let lw = i32(P[8]); let lh = i32(P[9]); let lx = i32(id.x); let ly = i32(id.y);
  if (lx >= lw || ly >= lh) { return; }
  var s = vec3f(0.0);
  for (var y = ly * q; y < min(H(), ly * q + q); y++) { for (var x = lx * q; x < min(W(), lx * q + q); x++) {
    let v = src[y * W() + x]; s += vec3f(toLin[ch(v, 0u)], toLin[ch(v, 1u)], toLin[ch(v, 2u)]);
  } }
  let n = 1.0 / f32(min(q, H() - ly * q) * min(q, W() - lx * q)); let c = s * n;
  let t = clamp((0.2126 * c.x + 0.7152 * c.y + 0.0722 * c.z - 0.18) / 0.3, 0.0, 1.0); let kk = t * t * (3.0 - 2.0 * t);
  let o = (ly * lw + lx) * 3;
  lin[o] = c.x; lin[o + 1] = c.y; lin[o + 2] = c.z; bright[o] = c.x * kk; bright[o + 1] = c.y * kk; bright[o + 2] = c.z * kk;
}`;

// One box pass along x (P[17] = 0) or y (1) with radius P[18] and clamped ends, as boxLine.
export const BOX_WGSL = HEAD + /* wgsl */ `
@group(0) @binding(1) var<storage, read> a: array<f32>;
@group(0) @binding(2) var<storage, read_write> o: array<f32>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let lw = i32(P[8]); let lh = i32(P[9]); let x = i32(id.x); let y = i32(id.y);
  if (x >= lw || y >= lh) { return; }
  let r = i32(P[18]); let alongY = P[17] > 0.5; let inv = 1.0 / f32(2 * r + 1);
  for (var c = 0; c < 3; c++) {
    var s = 0.0;
    for (var k = -r; k <= r; k++) {
      var xx = x; var yy = y;
      if (alongY) { yy = clamp(y + k, 0, lh - 1); } else { xx = clamp(x + k, 0, lw - 1); }
      s += a[(yy * lw + xx) * 3 + c];
    }
    o[(y * lw + x) * 3 + c] = s * inv;
  }
}`;

// glow = bright * bloom * 0.9 + lin * halation * 0.3, added back through a bilinear upsample.
export const GLOW_ADD_WGSL = HEAD + /* wgsl */ `
@group(0) @binding(1) var<storage, read> toLin: array<f32>;
@group(0) @binding(2) var<storage, read> toSrgb: array<u32>;
@group(0) @binding(3) var<storage, read> bl: array<f32>;
@group(0) @binding(4) var<storage, read> ha: array<f32>;
@group(0) @binding(5) var<storage, read> src: array<u32>;
@group(0) @binding(6) var<storage, read_write> dst: array<u32>;
fn glow(i: i32) -> vec3f {
  let o = i * 3; var g = vec3f(0.0);
  if (P[12] > 0.0) { g += vec3f(bl[o], bl[o + 1], bl[o + 2]) * P[12] * 0.9; }
  if (P[13] > 0.0) { g += vec3f(ha[o], ha[o + 1], ha[o + 2]) * P[13] * 0.3; }
  return g;
}
fn to_srgb(l: f32) -> i32 { if (l >= 1.0) { return i32(toSrgb[4096]); } if (l <= 0.0) { return i32(toSrgb[0]); } return i32(toSrgb[u32(l * 4096.0 + 0.5)]); }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= W() || y >= H()) { return; }
  let i = y * W() + x; let v = src[i];
  if (P[12] <= 0.0 && P[13] <= 0.0) { dst[i] = v; return; }
  let q = f32(P[7]); let lw = i32(P[8]); let lh = i32(P[9]);
  let fx = clamp((f32(x) + 0.5) / q - 0.5, 0.0, f32(lw - 1)); let x0 = i32(fx); let x1 = min(lw - 1, x0 + 1); let tx = fx - f32(x0);
  let fy = clamp((f32(y) + 0.5) / q - 0.5, 0.0, f32(lh - 1)); let y0 = i32(fy); let y1 = min(lh - 1, y0 + 1); let ty = fy - f32(y0);
  let g = glow(y0 * lw + x0) * (1.0 - tx) * (1.0 - ty) + glow(y0 * lw + x1) * tx * (1.0 - ty) + glow(y1 * lw + x0) * (1.0 - tx) * ty + glow(y1 * lw + x1) * tx * ty;
  if (g.x + g.y + g.z < 0.0015) { dst[i] = v; return; }
  dst[i] = pack(to_srgb(toLin[ch(v, 0u)] + g.x), to_srgb(toLin[ch(v, 1u)] + g.y), to_srgb(toLin[ch(v, 2u)] + g.z));
}`;

// Barrel warp with bilinear 8.8 taps, feathered rounded bezel, radial colour separation, vignette.
export const TUBE_WGSL = HEAD + /* wgsl */ `
@group(0) @binding(1) var<storage, read> src: array<u32>;
@group(0) @binding(2) var<storage, read_write> dst: array<u32>;
fn tap(su: f32, sv: f32, c: u32) -> i32 {
  let w = W(); let h = H();
  let sx = clamp((su + 1.0) * f32(w - 1) * 0.5, 0.0, f32(w - 1)); let sy = clamp((sv + 1.0) * f32(h - 1) * 0.5, 0.0, f32(h - 1));
  let x0 = i32(sx); let y0 = i32(sy); let tx = i32((sx - f32(x0)) * 256.0); let ty = i32((sy - f32(y0)) * 256.0);
  let dx = select(0, 1, x0 + 1 < w); let dy = select(0, w, y0 + 1 < h); let p = y0 * w + x0;
  let top = ch(src[p], c) * (256 - tx) + ch(src[p + dx], c) * tx; let bot = ch(src[p + dy], c) * (256 - tx) + ch(src[p + dy + dx], c) * tx;
  return (top * (256 - ty) + bot * ty) >> 16u;
}
fn bezel_alpha(asu: f32, asv: f32, rc: f32, feather: f32) -> f32 {
  if (rc <= 0.0) { return select(0.0, 1.0, asu <= 1.0 && asv <= 1.0); }
  let qx = asu - (1.0 - rc); let qy = asv - (1.0 - rc);
  let d = length(vec2f(max(qx, 0.0), max(qy, 0.0))) + min(max(qx, qy), 0.0) - rc;
  return clamp(-d / feather, 0.0, 1.0);
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); let w = W(); let h = H(); if (x >= w || y >= h) { return; }
  let i = y * w + x; let curv = P[14]; let ab = P[15]; let vig = P[16];
  let W2 = f32((w - 1) * (w - 1)); let H2 = f32((h - 1) * (h - 1)); let nv = 1.0 / (W2 + H2);
  let u = (f32(x) / f32(w - 1)) * 2.0 - 1.0; let v = (f32(y) / f32(h - 1)) * 2.0 - 1.0;
  let VX = u * u * W2 * nv; let vy = v * v * H2 * nv; let vg = vig * 256.0;
  if (curv <= 0.0 && ab <= 0.0) {
    if (vig <= 0.0) { dst[i] = src[i]; return; }
    let f = i32(256.0 - vg * (VX + vy)); let s = src[i];
    dst[i] = pack((ch(s, 0u) * f) >> 8u, (ch(s, 1u) * f) >> 8u, (ch(s, 2u) * f) >> 8u); return;
  }
  let k = curv * 0.35; let dab = ab * 0.012; var rc = 0.0; if (curv > 0.0) { rc = 0.02 + 0.08 * min(1.0, curv); }
  let feather = 1.5 / (f32(w + h) / 4.0); let safe = 1.0 - rc - feather * 2.0; let fr = 1.0 - dab; let fb = 1.0 + dab;
  let ff = 1.0 + k * (u * u + v * v); let su = u * ff; let sv = v * ff;
  var alpha = 1.0; if (!(abs(su) <= safe && abs(sv) <= safe)) { alpha = bezel_alpha(abs(su), abs(sv), rc, feather); }
  if (alpha <= 0.0) { dst[i] = pack(0, 0, 0); return; }
  let vf = i32(alpha * (256.0 - vg * (VX + vy)));
  dst[i] = pack((tap(su * fr, sv * fr, 0u) * vf) >> 8u, (tap(su, sv, 1u) * vf) >> 8u, (tap(su * fb, sv * fb, 2u) * vf) >> 8u);
}`;
