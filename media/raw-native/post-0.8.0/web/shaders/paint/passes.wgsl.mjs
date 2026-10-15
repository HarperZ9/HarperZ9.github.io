import { CANVAS_SAMPLER_WGSL } from "./canvas.wgsl.mjs";
// WGSL for the painterly abstraction passes. Mirrors abstract.mjs.
export const PREP_WGSL = /* wgsl */ `
@group(0) @binding(2) var<storage, read> scene: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> sb: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> lat: array<vec4f>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = i32(id.x); let y = i32(id.y); if (x >= W() || y >= H()) { return; }
  let i = y * W() + x; let k = P[P_exposure];
  let sc = max(scene[i].xyz, vec3f(0.0)); let m = max(sc.x, max(sc.y, sc.z)); let t = m * k;
  var gain = k * (1.0 - t / 2.0 + t * t / 6.0);
  if (t >= 1e-3) { gain = (1.0 - exp(-t)) / m; }
  let D = sc * gain;
  let e = vec3f(linear_to_srgb(D.x), linear_to_srgb(D.y), linear_to_srgb(D.z));
  let c = lut_conc(e); let dec = km_decode(c);
  sb[i] = vec4f(e, 0.2126 * D.x + 0.7152 * D.y + 0.0722 * D.z);
  lat[2 * i] = c; lat[2 * i + 1] = vec4f(D - dec, 0.0);
}`;

export const TENSOR_WGSL = /* wgsl */ `
@group(0) @binding(2) var<storage, read> sb: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> T: array<vec4f>;
fn at(x: i32, y: i32) -> vec3f { return sb[clamp(y, 0, H() - 1) * W() + clamp(x, 0, W() - 1)].xyz; }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  _ = pig[0];
  let x = i32(id.x); let y = i32(id.y); if (x >= W() || y >= H()) { return; }
  let gx = (at(x + 1, y - 1) + 2.0 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2.0 * at(x - 1, y) - at(x - 1, y + 1)) / 4.0;
  let gy = (at(x - 1, y + 1) + 2.0 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2.0 * at(x, y - 1) - at(x + 1, y - 1)) / 4.0;
  T[y * W() + x] = vec4f(dot(gx, gx), dot(gx, gy), dot(gy, gy), 0.0);
}`;

export const BLUR4_WGSL = /* wgsl */ `
@group(0) @binding(2) var<storage, read> wts: array<f32>;
@group(0) @binding(3) var<storage, read> a: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> o: array<vec4f>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  _ = pig[0];
  let x = i32(id.x); let y = i32(id.y); if (x >= W() || y >= H()) { return; }
  let r = (i32(arrayLength(&wts)) - 1) / 2; let alongY = P[P_dir] > 0.5; var s = vec4f(0.0);
  for (var k = -r; k <= r; k++) {
    var xx = x; var yy = y; if (alongY) { yy = clamp(y + k, 0, H() - 1); } else { xx = clamp(x + k, 0, W() - 1); }
    s += wts[k + r] * a[yy * W() + xx];
  }
  o[y * W() + x] = s;
}`;

export const AKF_WGSL = /* wgsl */ `
@group(0) @binding(2) var<storage, read> sb: array<vec4f>;
@group(0) @binding(3) var<storage, read> lat: array<vec4f>;
@group(0) @binding(4) var<storage, read> T: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> olat: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> os: array<vec4f>;
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  _ = pig[0];
  let x = i32(id.x); let y = i32(id.y); if (x >= W() || y >= H()) { return; }
  let p = y * W() + x; let f = flow(T[p]); let tx = f.x; let ty = f.y; let A = f.z;
  let r = P[P_radius]; let zeta = P[P_zeta]; let eta = P[P_eta];
  let a = r * (1.0 + A); let b = r / (1.0 + A);
  let ex = i32(ceil(sqrt(a * a * tx * tx + b * b * ty * ty))); let ey = i32(ceil(sqrt(a * a * ty * ty + b * b * tx * tx)));
  var acc: array<f32, 112>;
  for (var k = 0; k < 112; k++) { acc[k] = 0.0; }
  for (var dy = -ey; dy <= ey; dy++) { for (var dx = -ex; dx <= ex; dx++) {
    let u = (tx * f32(dx) + ty * f32(dy)) / a; let v = (-ty * f32(dx) + tx * f32(dy)) / b; let rr = u * u + v * v;
    if (rr > 1.0) { continue; }
    let qi = clamp(y + dy, 0, H() - 1) * W() + clamp(x + dx, 0, W() - 1); let g = exp(-2.0 * rr);
    let l0 = lat[2 * qi]; let l1 = lat[2 * qi + 1]; let sv = sb[qi].xyz;
    for (var k = 0; k < 8; k++) {
      let ang = -2.0 * PI * f32(k) / 8.0; let xk = u * cos(ang) - v * sin(ang); let yk = u * sin(ang) + v * cos(ang);
      let z = xk + zeta - eta * yk * yk; if (z <= 0.0) { continue; }
      let wk = z * z * g; let o = k * 14;
      acc[o] += wk;
      acc[o + 1] += wk * l0.x; acc[o + 2] += wk * l0.y; acc[o + 3] += wk * l0.z; acc[o + 4] += wk * l0.w;
      acc[o + 5] += wk * l1.x; acc[o + 6] += wk * l1.y; acc[o + 7] += wk * l1.z;
      acc[o + 8] += wk * sv.x; acc[o + 9] += wk * sv.y; acc[o + 10] += wk * sv.z;
      acc[o + 11] += wk * sv.x * sv.x; acc[o + 12] += wk * sv.y * sv.y; acc[o + 13] += wk * sv.z * sv.z;
    }
  } }
  var wsum = 0.0; var L0 = vec4f(0.0); var L1 = vec3f(0.0); var S3 = vec3f(0.0);
  for (var k = 0; k < 8; k++) {
    let o = k * 14; let Wk = acc[o]; if (Wk <= 0.0) { continue; }
    let m = vec3f(acc[o + 8], acc[o + 9], acc[o + 10]) / Wk; let m2 = vec3f(acc[o + 11], acc[o + 12], acc[o + 13]) / Wk;
    let v2 = max(m2.x - m.x * m.x, 0.0) + max(m2.y - m.y * m.y, 0.0) + max(m2.z - m.z * m.z, 0.0);
    let sd = sqrt(v2) * 255.0; var pw = 0.0; if (sd > 1e-6) { pw = pow(sd, P[P_q]); }
    let alpha = 1.0 / (1.0 + pw);
    wsum += alpha;
    L0 += alpha * vec4f(acc[o + 1], acc[o + 2], acc[o + 3], acc[o + 4]) / Wk;
    L1 += alpha * vec3f(acc[o + 5], acc[o + 6], acc[o + 7]) / Wk; S3 += alpha * m;
  }
  olat[2 * p] = L0 / wsum; olat[2 * p + 1] = vec4f(L1 / wsum, 0.0); os[p] = vec4f(S3 / wsum, A);
}`;

export const STROKE_WGSL = /* wgsl */ `
@group(0) @binding(2) var<storage, read> T: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> Hs: array<vec2f>;
@group(0) @binding(4) var<storage, read> Cv: array<vec4f>;
@group(0) @binding(5) var<storage, read> Kv: array<f32>;
` + CANVAS_SAMPLER_WGSL + `
fn dir_at(px: f32, py: f32) -> vec3f {
  let fx = clamp(px, 0.0, f32(W() - 1)); let fy = clamp(py, 0.0, f32(H() - 1));
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy)); let x1 = min(W() - 1, x0 + 1); let y1 = min(H() - 1, y0 + 1); let tx = fx - f32(x0); let ty = fy - f32(y0);
  return flow((T[y0 * W() + x0] * (1.0 - tx) + T[y0 * W() + x1] * tx) * (1.0 - ty) + (T[y1 * W() + x0] * (1.0 - tx) + T[y1 * W() + x1] * tx) * ty);
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  _ = pig[0];
  let x = i32(id.x); let y = i32(id.y); if (x >= W() || y >= H()) { return; }
  let L = i32(P[P_strokeLen]); let ox = P[P_ox]; let oy = P[P_oy];
  _ = ox; _ = oy;
  var acc = cnoise(0u, f32(x), f32(y), 0.5) * f32(L + 1); var ids = cnoise(1u, f32(x), f32(y), 0.5) * f32(L + 1); var ws = f32(L + 1);
  for (var sg = 0; sg < 2; sg++) {
    let sgn = select(-1.0, 1.0, sg == 0); var px = f32(x); var py = f32(y);
    let d0 = dir_at(px, py); var tx = d0.x * sgn; var ty = d0.y * sgn; var cont = 1.0;
    for (var k = 1; k <= L; k++) {
      px += tx; py += ty;
      let nd = dir_at(px, py); let d = nd.x * tx + nd.y * ty;
      tx = select(nd.x, -nd.x, d < 0.0); ty = select(nd.y, -nd.y, d < 0.0);
      let a = clamp((abs(d) - 0.05) / 0.25, 0.0, 1.0); cont *= a * a * (3.0 - 2.0 * a);
      let wk = f32(L + 1 - k) * cont; acc += wk * cnoise(0u, px, py, 0.5); ids += wk * cnoise(1u, px, py, 0.5); ws += wk;
    }
  }
  Hs[y * W() + x] = vec2f(acc / ws, ids / ws);
}`;
