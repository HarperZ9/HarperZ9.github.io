// WGSL for the tube geometry, the mask and the beam pass. Mirrors geometry.mjs and beam.mjs.
export const GEOMETRY_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
fn pi(i: u32) -> i32 { return i32(round(P[i])); }
fn face_at(px: f32, py: f32) -> vec2f {
  let X = (px - P[P_outW] / 2.0) * (P[P_viewW] / P[P_outW]) + P[P_cx];
  let Y = (py - P[P_outH] / 2.0) * (P[P_viewH] / P[P_outH]) + P[P_cy];
  let D = P[P_dist]; let A = X * X / (2.0 * P[P_rx]) + Y * Y / (2.0 * P[P_ry]);
  let t = 2.0 * D / (D + sqrt(max(0.0, D * D - 4.0 * A * D)));
  return vec2f(t * X, t * Y);
}
fn footprint(px: f32, py: f32) -> vec4f {
  let c = face_at(px + 0.5, py + 0.5); let xp = face_at(px + 1.0, py + 0.5); let xm = face_at(px, py + 0.5);
  let yp = face_at(px + 0.5, py + 1.0); let ym = face_at(px + 0.5, py);
  let hx = 0.5 * (abs(xp.x - xm.x) + abs(yp.x - ym.x)); let hy = 0.5 * (abs(xp.y - xm.y) + abs(yp.y - ym.y));
  return vec4f(c, max(hx, 1e-4), max(hy, 1e-4));
}
fn face_alpha(sx: f32, sy: f32, hx: f32, hy: f32) -> f32 {
  let r = P[P_corner]; let qx = abs(sx) - (P[P_faceW] / 2.0 - r); let qy = abs(sy) - (P[P_faceH] / 2.0 - r);
  let d = length(vec2f(max(qx, 0.0), max(qy, 0.0))) + min(max(qx, qy), 0.0) - r;
  return clamp(0.5 - d / (2.0 * max(hx, hy)), 0.0, 1.0);
}
fn tent_cdf(u: f32, a: f32) -> f32 {
  let v = u / a;
  if (v <= -1.0) { return 0.0; } if (v <= 0.0) { return 0.5 * (1.0 + v) * (1.0 + v); }
  if (v < 1.0) { return 1.0 - 0.5 * (1.0 - v) * (1.0 - v); } return 1.0;
}
fn pulse_F(x: f32, Pp: f32, w: f32) -> f32 { let n = floor(x / Pp); return n * w + min(max(x - n * Pp, 0.0), w); }
fn pulse_box(y0: f32, y1: f32, Pp: f32, w: f32, s: f32) -> f32 {
  let n0 = floor((y0 - s) / Pp); let a = y0 - s - n0 * Pp; let b = y1 - s - n0 * Pp;
  return (pulse_F(b, Pp, w) - pulse_F(a, Pp, w)) / (y1 - y0);
}
fn stripe_mask(sx: f32, sy: f32, hx: f32, hy: f32, c: u32) -> f32 {
  let Pp = P[P_pitch]; let fill = P[P_fill]; let w = fill * Pp / 3.0;
  let s = f32(c) * Pp / 3.0 + (1.0 - fill) * Pp / 6.0; let a = 2.0 * hx;
  let m0 = i32(floor((sx - a - s - w) / Pp)); let m1 = i32(floor((sx + a - s) / Pp));
  if (m1 - m0 > 32) { return P[P_maskMean]; }
  var cov = 0.0;
  for (var k = m0; k <= m1; k++) {
    let x0 = f32(k) * Pp + s - sx; let xw = tent_cdf(x0 + w, a) - tent_cdf(x0, a);
    if (xw <= 0.0) { continue; }
    var yw = 1.0;
    if (pi(P_maskType) == 2) { let Py = P[P_slotH] + P[P_slotGap]; yw = pulse_box(sy - hy, sy + hy, Py, P[P_slotH], f32(k & 1) * Py * 0.5); }
    cov += xw * yw;
  }
  if (pi(P_maskType) == 1) {
    for (var i = 0; i < pi(P_nDampers); i++) {
      let dc = (P[P_dampers + u32(i)] - 0.5) * P[P_faceH];
      let lo = max(sy - hy, dc - P[P_damperW] / 2.0); let hi = min(sy + hy, dc + P[P_damperW] / 2.0);
      if (hi > lo) { cov *= 1.0 - (hi - lo) / (2.0 * hy); }
    }
  }
  return cov;
}
fn delta_mask(sx: f32, sy: f32, hx: f32, hy: f32) -> vec3f {
  let d = P[P_pitch] / sqrt(3.0); let r = P[P_fill] * d / 2.0; let rowH = d * sqrt(3.0) / 2.0; var o = vec3f(0.0); let aa = min(0.75 * (hx + hy), r);
  for (var j = 0; j < 4; j++) { for (var i = 0; i < 4; i++) {
    let x = sx + ((f32(i) + 0.5) / 4.0 - 0.5) * 3.0 * hx; let y = sy + ((f32(j) + 0.5) / 4.0 - 0.5) * 3.0 * hy;
    let lj = i32(floor(y / rowH));
    for (var dj = 0; dj <= 1; dj++) {
      let jj = lj + dj; let li = i32(floor(x / d - f32(jj) / 2.0));
      for (var di = 0; di <= 1; di++) {
        let ii = li + di; let cx = (f32(ii) + f32(jj) / 2.0) * d; let cy = f32(jj) * rowH;
        let e = clamp(0.5 + (r - length(vec2f(x - cx, y - cy))) / aa, 0.0, 1.0);
        if (e > 0.0) { let col = (((ii - jj) % 3) + 3) % 3; o[col] += e / 16.0; }
      }
    }
  } }
  let t = clamp((hx / P[P_pitch] - 0.7) / 0.3, 0.0, 1.0); let bl = t * t * (3.0 - 2.0 * t);
  return o + (P[P_maskMean] - o) * bl;
}
fn mask_cover(sx: f32, sy: f32, hx: f32, hy: f32) -> vec3f {
  let t = pi(P_maskType);
  if (t == 0) { return vec3f(1.0); }
  var cov: vec3f;
  if (t == 3) { cov = delta_mask(sx, sy, hx, hy); }
  else { cov = vec3f(stripe_mask(sx, sy, hx, hy, 0u), stripe_mask(sx, sy, hx, hy, 1u), stripe_mask(sx, sy, hx, hy, 2u)); }
  let mix_ = P[P_maskMix];
  return 1.0 - mix_ + mix_ * cov / P[P_maskMean];
}
`;

export const BEAM_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> sig: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> hist: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> em: array<vec4f>;
fn gun_current(v: f32) -> f32 { return pow(max(P[P_contrast] * v + P[P_brightness], 0.0), P[P_gamma]); }
fn spot_sigma(I: f32) -> f32 { return P[P_lineMm] * (P[P_spotLo] + (P[P_spotHi] - P[P_spotLo]) * pow(min(I, 1.5), P[P_spotExp])); }
fn convergence(c: u32, sx: f32, sy: f32) -> vec2f {
  let k = P[P_conv + 4u] / (P[P_faceW] / 2.0);
  if (c == 0u) { return vec2f(P[P_conv] + k * sx, P[P_conv + 1u] + k * sy); }
  if (c == 2u) { return vec2f(P[P_conv + 2u] - k * sx, P[P_conv + 3u] - k * sy); }
  return vec2f(0.0);
}
fn drive(c: u32, j: i32, k: i32) -> f32 {
  let s = sig[u32(j * pi(P_N) + k)];
  if (pi(P_mono) == 1) { return 0.299 * s.x + 0.587 * s.y + 0.114 * s.z; }
  return s[c];
}
fn deposit(c: u32, rx: f32, ry: f32, hx: f32, hy: f32) -> f32 {
  let N = pi(P_N); let lines = pi(P_lines); let lineMm = P[P_lineMm]; let rW = P[P_rasterW]; let rH = P[P_rasterH];
  let dx = rW / f32(N); let smax = spot_sigma(1.5); let reachY = 3.0 * smax + hy; let reachX = 3.0 * smax + hx;
  let yl = (ry + rH / 2.0) / lineMm - 0.5;
  let j0 = max(0, i32(floor(yl - reachY / lineMm))); let j1 = min(lines - 1, i32(ceil(yl + reachY / lineMm)));
  let kc = (rx + rW / 2.0) / dx - 0.5;
  let k0 = max(0, i32(floor(kc - reachX / dx))); let k1 = min(N - 1, i32(ceil(kc + reachX / dx)));
  let field = pi(P_frame); var e = 0.0;
  for (var j = j0; j <= j1; j++) {
    if (pi(P_interlace) == 1 && (j & 1) != (field & 1)) { continue; }
    let yj = -rH / 2.0 + (f32(j) + 0.5) * lineMm;
    for (var k = k0; k <= k1; k++) {
      let I = gun_current(drive(c, j, k));
      if (I <= 0.0) { continue; }
      let s = spot_sigma(I); let xk = -rW / 2.0 + (f32(k) + 0.5) * dx;
      e += I * gauss_mass(rx - hx, rx + hx, xk, s) * gauss_mass(ry - hy, ry + hy, yj, s);
    }
  }
  return e * dx * lineMm / (4.0 * hx * hy);
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let W = u32(P[P_outW]); let H = u32(P[P_outH]);
  if (id.x >= W || id.y >= H) { return; }
  let fp = footprint(f32(id.x), f32(id.y)); let sx = fp.x; let sy = fp.y; let hx = fp.z; let hy = fp.w;
  let pix = id.y * W + id.x; let alpha = face_alpha(sx, sy, hx, hy);
  let cover = mask_cover(sx, sy, hx, hy); let T = P[P_fieldT];
  let t0 = clamp((sy + P[P_rasterH] / 2.0) / P[P_rasterH], 0.0, 1.0) * T;
  let lit = alpha > 0.0 && abs(sx) < P[P_rasterW] / 2.0 + 3.0 * hx && abs(sy) < P[P_rasterH] / 2.0 + 3.0 * hy;
  let mono = pi(P_mono) == 1;
  var monoE = 0.0;
  if (lit && mono) { monoE = deposit(0u, sx, sy, hx, hy); }
  var R1 = hist[2u * pix]; var R2 = hist[2u * pix + 1u]; var out = vec4f(0.0, 0.0, 0.0, alpha);
  for (var c = 0u; c < 3u; c++) {
    var E = 0.0;
    if (lit && mono) { E = monoE * cover[c]; }
    else if (lit) { let o = convergence(c, sx, sy); E = deposit(c, sx - o.x, sy - o.y, hx, hy) * cover[c]; }
    let b = P_decay + 5u * c; let w = P[b]; let e1 = P[b + 1u]; let e2 = P[b + 2u];
    let n1 = exp(-(T - t0) / P[b + 3u]); let n2 = exp(-(T - t0) / P[b + 4u]);
    out[c] = R1[c] * (1.0 - e1) + R2[c] * (1.0 - e2) + E * (w * (1.0 - n1) + (1.0 - w) * (1.0 - n2));
    R1[c] = R1[c] * e1 + E * w * n1; R2[c] = R2[c] * e2 + E * (1.0 - w) * n2;
  }
  hist[2u * pix] = R1; hist[2u * pix + 1u] = R2; em[pix] = out;
}`;
