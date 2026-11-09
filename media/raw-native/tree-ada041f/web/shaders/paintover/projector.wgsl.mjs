// WGSL for the paint-over projection material (projector.mjs, shadePoint over a G-buffer): one
// thread per view pixel. Mirrors covered() and the keyframe-weighted blend.
// P (f32): 0 w, 1 h, 2 projector count, 3 facingPow, 4 fMin, 5 floor, 6 tolBase, 7 tolGrazing,
// 8..22 the view camera, then one 24-float block per projector at 24 + 24 k:
// camera (15), w, h, reach (radians), image offset (words), depth offset, 4 spare.
// A camera is: 0 ortho, 1..3 pos, 4..6 fwd, 7..9 right, 10..12 up, 13 scale, 14 fovY.
// gb: two vec4f per pixel: (P, hit), (N, 0). img: packed RGBA8 words of every painting in turn.
// dep: the depth maps in turn. out8: RGBA8 with alpha 255 where some projector covers, else 0.
export const PAINTOVER_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> gb: array<vec4f>;
@group(0) @binding(2) var<storage, read> img: array<u32>;
@group(0) @binding(3) var<storage, read> dep: array<f32>;
@group(0) @binding(4) var<storage, read_write> out8: array<u32>;

fn cv(b: u32, i: u32) -> vec3f { return vec3f(P[b + i], P[b + i + 1u], P[b + i + 2u]); }
fn project_c(b: u32, w: f32, h: f32, p: vec3f) -> vec3f {
  let r = p - cv(b, 1u); let z = dot(r, cv(b, 4u)); let asp = w / h; let a = dot(r, cv(b, 7u)); let bb = dot(r, cv(b, 10u));
  var u: f32; var v: f32;
  if (P[b] > 0.5) { u = a / (P[b + 13u] * asp); v = bb / P[b + 13u]; } else { let t = tan(P[b + 14u] / 2.0); u = a / (z * t * asp); v = bb / (z * t); }
  return vec3f(((u + 1.0) / 2.0) * w - 0.5, ((1.0 - v) / 2.0) * h - 0.5, z);
}
fn to_camera(b: u32, p: vec3f) -> vec3f {
  if (P[b] > 0.5) { return -cv(b, 4u); }
  return normalize(cv(b, 1u) - p);
}
fn texel(off: u32, w: u32, x: u32, y: u32) -> vec3f {
  let word = img[off + y * w + x];
  return vec3f(f32(word & 255u), f32((word >> 8u) & 255u), f32((word >> 16u) & 255u));
}
fn sample_rgb(off: u32, w: u32, h: u32, x: f32, y: f32) -> vec3f {
  let xc = clamp(x, 0.0, f32(w - 1u)); let yc = clamp(y, 0.0, f32(h - 1u));
  let x0f = floor(xc); let y0f = floor(yc); let x0 = u32(x0f); let y0 = u32(y0f);
  let x1 = min(w - 1u, x0 + 1u); let y1 = min(h - 1u, y0 + 1u); let fx = xc - x0f; let fy = yc - y0f;
  let a = texel(off, w, x0, y0); let b = texel(off, w, x1, y0); let d = texel(off, w, x0, y1); let e = texel(off, w, x1, y1);
  return ((a * (1.0 - fx) + b * fx) * (1.0 - fy) + (d * (1.0 - fx) + e * fx) * fy) / 255.0;
}

@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = u32(P[0]); let h = u32(P[1]);
  if (id.x >= w || id.y >= h) { return; }
  let i = id.y * w + id.x; let g0 = gb[i * 2u]; let g1 = gb[i * 2u + 1u];
  if (g0.w < 0.5) { out8[i] = 0u; return; }
  let Pw = g0.xyz; let N = g1.xyz; let vdir = to_camera(8u, Pw);
  var wsum = 0.0; var col = vec3f(0.0);
  for (var k = 0u; k < u32(P[2]); k++) {
    let b = 24u + 24u * k; let pw = P[b + 15u]; let ph = P[b + 16u];
    let p = project_c(b, pw, ph, Pw);
    if (!(p.x >= -0.5 && p.x <= pw - 0.5 && p.y >= -0.5 && p.y <= ph - 0.5)) { continue; }
    let to = to_camera(b, Pw); let f = dot(N, to);
    if (f < P[4]) { continue; }
    let ix = u32(min(pw - 1.0, max(0.0, floor(p.x + 0.5)))); let iy = u32(min(ph - 1.0, max(0.0, floor(p.y + 0.5))));
    let dm = dep[u32(P[b + 19u]) + iy * u32(pw) + ix];
    var pxw = 2.0 * P[b + 13u] / ph; if (P[b] < 0.5) { pxw = 2.0 * tan(P[b + 14u] / 2.0) * p.z / ph; }
    let tol = pxw * (P[6] + P[7] * (1.0 - f));
    if (p.z - dm > tol) { continue; }
    let ang = acos(clamp(dot(to, vdir), -1.0, 1.0)); let a = ang / P[b + 17u]; let t = max(0.0, 1.0 - a * a);
    let wk = pow(f, P[3]) * max(t * t, P[5]);
    col += wk * sample_rgb(u32(P[b + 18u]), u32(pw), u32(ph), p.x, p.y); wsum += wk;
  }
  if (wsum > 0.0) {
    let c = col / wsum;
    out8[i] = u32(floor(clamp(c.x, 0.0, 1.0) * 255.0 + 0.5)) | (u32(floor(clamp(c.y, 0.0, 1.0) * 255.0 + 0.5)) << 8u) | (u32(floor(clamp(c.z, 0.0, 1.0) * 255.0 + 0.5)) << 16u) | (255u << 24u);
  } else { out8[i] = 0u; }
}
`;
