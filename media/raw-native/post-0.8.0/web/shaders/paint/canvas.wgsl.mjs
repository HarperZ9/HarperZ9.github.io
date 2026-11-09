// WGSL for the advected canvas (canvas.mjs): the sampler the paint passes call, and the decide,
// advect and distortion passes. Layer state K: per layer [age, seedX, seedY, meanD, reset] at
// 5 k, then frame at 10. Stats S (atomic u32): sum0, sum1, n0, n1.
export const CANVAS_CONST = { tau: 0.35, rampFrames: 8, minAge: 12, depthTol: 0.02, quant: 4096 };
const c = CANVAS_CONST;

// Needs bindings named Cv (array<vec4f>, the coordinates) and Kv (array<f32>, the layer state),
// P_canvasMode, P_ox, P_oy, W(), H(), and the noise functions of common.wgsl.mjs.
export const CANVAS_SAMPLER_WGSL = /* wgsl */ `
fn noise_kind(kind: u32, x: f32, y: f32) -> f32 {
  switch (kind) {
    case 0u: { return bristle(x, y); } case 1u: { return stroke_id(x, y); } case 2u: { return canvas_height(x, y); }
    case 3u: { return paper_height(x, y); } case 4u: { return paper_height(x / 2.0, y / 2.0); }
    case 5u: { return 2.0 * vnoise(x / 23.0, y / 23.0, 71u) - 1.0; } default: { return 2.0 * vnoise(x / 23.0, y / 23.0, 73u) - 1.0; }
  }
}
fn layer_weight(k: u32) -> f32 {
  let age = Kv[5u * k]; if (age < 0.0) { return 0.0; }
  return min(1.0, (age + 1.0) / ${c.rampFrames.toFixed(1)}) * max(0.02, 1.0 - Kv[5u * k + 3u] / ${c.tau});
}
fn cv_at(x: f32, y: f32) -> vec4f {
  let fx = clamp(x, 0.0, f32(W() - 1)); let fy = clamp(y, 0.0, f32(H() - 1));
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy)); let x1 = min(W() - 1, x0 + 1); let y1 = min(H() - 1, y0 + 1); let tx = fx - f32(x0); let ty = fy - f32(y0);
  return (Cv[y0 * W() + x0] * (1.0 - tx) + Cv[y0 * W() + x1] * tx) * (1.0 - ty) + (Cv[y1 * W() + x0] * (1.0 - tx) + Cv[y1 * W() + x1] * tx) * ty;
}
// The canvas noise of kind at pixel position (x, y); m is the noise's mean.
fn cnoise(kind: u32, x: f32, y: f32, m: f32) -> f32 {
  if (P[P_canvasMode] < 0.5) { return noise_kind(kind, x + P[P_ox], y + P[P_oy]); }
  let q = cv_at(x, y); let w0 = layer_weight(0u); let w1 = layer_weight(1u);
  if (w1 == 0.0) { return noise_kind(kind, q.x, q.y); }
  if (w0 == 0.0) { return noise_kind(kind, q.z, q.w); }
  let n0 = noise_kind(kind, q.x, q.y) - m; let n1 = noise_kind(kind, q.z, q.w) - m;
  return m + (w0 * n0 + w1 * n1) / sqrt(w0 * w0 + w1 * w1);
}
`;

export const DECIDE_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> K: array<f32>;
@group(0) @binding(1) var<storage, read_write> S: array<atomic<u32>>;
fn wake(k: u32, frame: f32) {
  K[5u * k] = 0.0; K[5u * k + 3u] = 0.0; K[5u * k + 4u] = 1.0;
  K[5u * k + 1u] = hash3(u32(frame), k, 101u) * 997.0; K[5u * k + 2u] = hash3(u32(frame), k, 103u) * 997.0;
}
@compute @workgroup_size(1) fn main() {
  let frame = K[10];
  for (var k = 0u; k < 2u; k++) {
    let n = atomicLoad(&S[2u + k]);
    var md = 0.0; if (n > 0u) { md = f32(atomicLoad(&S[k])) / ${c.quant.toFixed(1)} / f32(n); }
    K[5u * k + 3u] = md; if (K[5u * k] >= 0.0) { K[5u * k] = min(1e6, K[5u * k] + 1.0); } K[5u * k + 4u] = 0.0;
  }
  if (frame == 0.0) { wake(0u, frame); K[0] = ${c.rampFrames.toFixed(1)}; }
  else {
    for (var k = 0u; k < 2u; k++) {
      let o = 1u - k;
      if (K[5u * k] >= 0.0 && K[5u * k + 3u] > ${c.tau} && (K[5u * o] < 0.0 || (K[5u * o] >= ${c.minAge.toFixed(1)} && K[5u * o + 3u] > ${(c.tau * 0.5).toFixed(3)}))) { wake(o, frame); break; }
    }
  }
  for (var i = 0u; i < 4u; i++) { atomicStore(&S[i], 0u); }
  K[10] = frame + 1.0;   // frames advected so far, as canvas.mjs counts them
}`;

export const ADVECT_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> Pa: array<f32>;            // w, h
@group(0) @binding(1) var<storage, read_write> K: array<f32>;
@group(0) @binding(2) var<storage, read> Cprev: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> Cnew: array<vec4f>;
@group(0) @binding(4) var<storage, read> mv: array<vec2f>;
@group(0) @binding(5) var<storage, read> dd: array<vec2f>;              // dist, distPrev
@group(0) @binding(6) var<storage, read> prevDistIn: array<f32>;
@group(0) @binding(7) var<storage, read_write> prevDistOut: array<f32>;
fn cprev(x: f32, y: f32) -> vec4f {
  let w = i32(Pa[0]); let h = i32(Pa[1]);
  let fx = clamp(x, 0.0, f32(w - 1)); let fy = clamp(y, 0.0, f32(h - 1));
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy)); let x1 = min(w - 1, x0 + 1); let y1 = min(h - 1, y0 + 1); let tx = fx - f32(x0); let ty = fy - f32(y0);
  return (Cprev[y0 * w + x0] * (1.0 - tx) + Cprev[y0 * w + x1] * tx) * (1.0 - ty) + (Cprev[y1 * w + x0] * (1.0 - tx) + Cprev[y1 * w + x1] * tx) * ty;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = i32(Pa[0]); let h = i32(Pa[1]); let x = i32(id.x); let y = i32(id.y); if (x >= w || y >= h) { return; }
  let p = y * w + x; let px = f32(x) - mv[p].x; let py = f32(y) - mv[p].y;
  let q = clamp(i32(floor(py + 0.5)), 0, h - 1) * w + clamp(i32(floor(px + 0.5)), 0, w - 1);
  let inside = px >= 0.0 && py >= 0.0 && px <= f32(w - 1) && py <= f32(h - 1);
  let valid = inside && prevDistIn[q] > 0.0 && abs(prevDistIn[q] - dd[p].y) <= ${c.depthTol} * dd[p].y;
  let old = cprev(px, py); var o = vec4f(0.0);
  for (var k = 0u; k < 2u; k++) {
    let fresh = K[5u * k + 4u] > 0.5 || !valid;
    var cc = vec2f(f32(x) + K[5u * k + 1u], f32(y) + K[5u * k + 2u]);
    if (!fresh) { if (k == 0u) { cc = old.xy; } else { cc = old.zw; } }
    if (k == 0u) { o.x = cc.x; o.y = cc.y; } else { o.z = cc.x; o.w = cc.y; }
  }
  Cnew[p] = o; prevDistOut[p] = dd[p].x;
}`;

export const DISTORT_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> Pa: array<f32>;
@group(0) @binding(1) var<storage, read> Cn: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> S: array<atomic<u32>>;
fn departure(a: f32, b: f32, c: f32, d: f32) -> f32 {
  let E = a * a + b * b + c * c + d * d; let det = abs(a * d - b * c); let disc = sqrt(max(0.0, E * E - 4.0 * det * det));
  let s1 = sqrt(max(1e-12, (E + disc) / 2.0)); let s2 = sqrt(max(1e-12, (E - disc) / 2.0));
  return abs(log(s1)) + abs(log(s2));
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = i32(Pa[0]); let h = i32(Pa[1]); let x = i32(id.x); let y = i32(id.y);
  if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) { return; }
  let p = y * w + x; let r = Cn[p + 1]; let l = Cn[p - 1]; let dn = Cn[p + w]; let up = Cn[p - w];
  for (var k = 0u; k < 2u; k++) {
    let o = 2u * k;
    let D = departure((r[o] - l[o]) / 2.0, (dn[o] - up[o]) / 2.0, (r[o + 1u] - l[o + 1u]) / 2.0, (dn[o + 1u] - up[o + 1u]) / 2.0);
    if (D <= 1.0) { atomicAdd(&S[k], u32(floor(D * ${c.quant.toFixed(1)}))); atomicAdd(&S[2u + k], 1u); }
  }
}`;
