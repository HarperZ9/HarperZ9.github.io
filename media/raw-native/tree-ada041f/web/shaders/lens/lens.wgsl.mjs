// WGSL for the lens suite (lens.mjs), one thread per pixel, two passes.
// P (f32): 0 W, 1 H, 2 cx, 3 cy, 4 squeeze, 5 blades, 6 roundness, 7 cos and 8 sin of the streak
// angle, 9 streak length, 10 streak thickness, 11 star cell px, 12 star gain, 13 sources,
// 14 ghosts, 15 star table size M, 16 threshold, 17 tile, 18 tiles per row, 19 encode gain,
// 20..43 bin RGB weights (8 x 3), 44..51 dispersion scale per bin, 52..67 halation (gain,
// radius) per bin, 68..70 phi per channel.
// srcs: 24 floats per source: x, y, E (3), ghost factor per bin (8), streak factor per bin (8).
// ghosts: per ghost and bin (m, radius, rotation, 1 / area). star: M x M x 3.
export const LENS_P = 72, LENS_SRC = 24;

export const LENS_CORE_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> img: array<vec4f>;
@group(0) @binding(2) var<storage, read> keep: array<u32>;
@group(0) @binding(3) var<storage, read_write> core: array<vec4f>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = u32(P[0]); let h = u32(P[1]);
  if (id.x >= w || id.y >= h) { return; }
  let i = id.y * w + id.x; let c = img[i]; let T = u32(P[17]);
  var k = 0.0;
  if (keep[(id.y / T) * u32(P[18]) + id.x / T] != 0u) {
    let Y = 0.2126 * c.x + 0.7152 * c.y + 0.0722 * c.z;
    if (Y > P[16]) { k = (Y - P[16]) / Y; }
  }
  core[i] = vec4f(c.x * (1.0 - P[68] * k), c.y * (1.0 - P[69] * k), c.z * (1.0 - P[70] * k), 1.0);
}
`;

export const LENS_GATHER_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> core: array<vec4f>;
@group(0) @binding(2) var<storage, read> ghosts: array<f32>;
@group(0) @binding(3) var<storage, read> srcs: array<f32>;
@group(0) @binding(4) var<storage, read> star: array<f32>;
@group(0) @binding(5) var<storage, read_write> outF: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> out8: array<u32>;
const TAU = 6.283185307179586;
fn rgbw(l: u32) -> vec3f { return vec3f(P[20u + l * 3u], P[21u + l * 3u], P[22u + l * 3u]); }
fn samp(px: f32, py: f32, w: u32, h: u32) -> vec3f {
  let x = min(f32(w - 1u), max(0.0, px - 0.5)); let y = min(f32(h - 1u), max(0.0, py - 0.5));
  let x0 = min(w - 2u, u32(floor(x))); let y0 = min(h - 2u, u32(floor(y))); let fx = x - f32(x0); let fy = y - f32(y0); let i = y0 * w + x0;
  return (core[i].xyz * (1.0 - fx) + core[i + 1u].xyz * fx) * (1.0 - fy) + (core[i + w].xyz * (1.0 - fx) + core[i + w + 1u].xyz * fx) * fy;
}
fn starAt(u: f32, v: f32) -> vec3f {
  let M = u32(P[15]); let Mf = f32(M - 1u);
  if (u < 0.0 || v < 0.0 || u > Mf || v > Mf) { return vec3f(0.0); }
  let x0 = min(M - 2u, u32(floor(u))); let y0 = min(M - 2u, u32(floor(v))); let fx = u - f32(x0); let fy = v - f32(y0);
  let i = (y0 * M + x0) * 3u; let j = i + M * 3u;
  let a = vec3f(star[i], star[i + 1u], star[i + 2u]); let b = vec3f(star[i + 3u], star[i + 4u], star[i + 5u]);
  let c = vec3f(star[j], star[j + 1u], star[j + 2u]); let d = vec3f(star[j + 3u], star[j + 4u], star[j + 5u]);
  return (a * (1.0 - fx) + b * fx) * (1.0 - fy) + (c * (1.0 - fx) + d * fx) * fy;
}
fn edgeRot(phi: f32, N: f32, rnd: f32, rot: f32) -> f32 {
  let seg = TAU / N; let x = phi - rot; let a = x - floor(x / seg) * seg;
  let poly = cos(3.141592653589793 / N) / cos(a - 3.141592653589793 / N);
  return poly + (1.0 - poly) * rnd;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = u32(P[0]); let h = u32(P[1]);
  if (id.x >= w || id.y >= h) { return; }
  let qx = f32(id.x) + 0.5; let qy = f32(id.y) + 0.5; let cx = P[2]; let cy = P[3];
  var o = vec3f(0.0);
  for (var l = 0u; l < 8u; l++) {
    let s = P[44u + l]; o += rgbw(l) * samp(cx + (qx - cx) / s, cy + (qy - cy) / s, w, h);
  }
  let N = P[5]; let rnd = P[6]; let ca = P[7]; let sa = P[8]; let L = P[9]; let sg = P[10]; let cell = P[11];
  let hM = (P[15] - 1.0) * 0.5; let sInv = 1.0 / (cell * cell); let nS = u32(P[13]); let nG = u32(P[14]);
  for (var si = 0u; si < nS; si++) {
    let b = si * ${LENS_SRC}u; let sx = srcs[b]; let sy = srcs[b + 1u]; let E = vec3f(srcs[b + 2u], srcs[b + 3u], srcs[b + 4u]);
    let dx = qx - sx; let dy = qy - sy;
    o += E * P[12] * starAt(dx / cell + hM, dy / cell + hM) * sInv;
    let a = ca * dx + sa * dy; let bb = -sa * dx + ca * dy;
    let k = (exp(-abs(a) / L) / (2.0 * L)) * (exp(-bb * bb / (2.0 * sg * sg)) / (sg * 2.5066282746310002));
    let r = sqrt(dx * dx + dy * dy);
    for (var l = 0u; l < 8u; l++) {
      let ha = P[52u + l * 2u]; let hr = P[53u + l * 2u];
      let f = srcs[b + 13u + l] * k + ha * exp(-r / hr) / (TAU * hr * hr);
      o += E * rgbw(l) * f;
    }
    for (var g = 0u; g < nG; g++) {
      for (var l = 0u; l < 8u; l++) {
        let gb = (g * 8u + l) * 4u; let m = ghosts[gb]; let rad = ghosts[gb + 1u];
        let gx = cx + m * (sx - cx); let gy = cy + m * (sy - cy);
        let vx = (qx - gx) * P[4]; let vy = qy - gy; let rr = sqrt(vx * vx + vy * vy);
        if (rr > rad + 1.0) { continue; }
        let cov = clamp(rad * edgeRot(atan2(vy, vx), N, rnd, ghosts[gb + 2u]) - rr + 0.5, 0.0, 1.0);
        if (cov <= 0.0) { continue; }
        o += E * rgbw(l) * (srcs[b + 5u + l] * cov * ghosts[gb + 3u]);
      }
    }
  }
  let i = id.y * w + id.x;
  outF[i] = vec4f(o, 1.0); out8[i] = lab_pack(o, P[19]);
}
`;
