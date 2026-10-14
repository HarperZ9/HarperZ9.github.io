// WGSL for perspective-stable pixel art: probe capture, texel shading, the two splat passes
// (atomic depth key, then atomic texel index) and the resolve. Mirrors probe.mjs and splat.mjs.
export const PIXEL_FIELDS = ["w", "h", "n", "ox", "oy", "oz", "bands", "outline", "crease", "expand", "ex", "ey", "ez",
  "fx", "fy", "fz", "rx", "ry", "rz", "ux", "uy", "uz", "ty", "blend", "hasPrev"];
export const PIXEL_HEAD = PIXEL_FIELDS.map((k, i) => `const P_${k}: u32 = ${i}u;`).join("\n") + /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
fn pf(i: u32) -> f32 { return P[i]; }
fn origin() -> vec3f { return vec3f(P[P_ox], P[P_oy], P[P_oz]); }
fn texel_uv(i: u32, j: u32, N: u32) -> vec2f { return vec2f(2.0 * (f32(i) + 0.5) / f32(N) - 1.0, 2.0 * (f32(j) + 0.5) / f32(N) - 1.0); }
fn cheb(r: vec3f) -> f32 { return max(abs(r.x), max(abs(r.y), abs(r.z))); }
`;

export const CAPTURE_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read_write> geo: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> nrm: array<vec4f>;
@compute @workgroup_size(8, 8, 1) fn main(@builtin(global_invocation_id) id: vec3u) {
  let N = u32(P[P_n]); if (id.x >= N || id.y >= N) { return; }
  let k = (id.z * N + id.y) * N + id.x; let uv = texel_uv(id.x, id.y, N); let r = face_dir(id.z, uv.x, uv.y); let d = normalize(r);
  let o = origin(); let hit = scene_march(o, d, 40.0);
  if (hit.x < 0.0) { geo[k] = vec4f(-1.0, -1.0, -1.0, 0.0); nrm[k] = vec4f(0.0); return; }
  let p = o + d * hit.x; let q = abs(p - o);
  geo[k] = vec4f(max(q.x, max(q.y, q.z)), hit.y, hit.z, 0.0); nrm[k] = vec4f(scene_normal(p), 0.0);
}`;

export const SHADE_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> geo: array<vec4f>;
@group(0) @binding(2) var<storage, read> nrm: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> col: array<vec4f>;
@compute @workgroup_size(8, 8, 1) fn main(@builtin(global_invocation_id) id: vec3u) {
  let N = u32(P[P_n]); if (id.x >= N || id.y >= N) { return; }
  let k = (id.z * N + id.y) * N + id.x; let uv = texel_uv(id.x, id.y, N); let bands = P[P_bands];
  let g = geo[k];
  if (g.x < 0.0) { col[k] = vec4f(stylise(sky_col(normalize(face_dir(id.z, uv.x, uv.y))), bands, 0.0), 1.0); return; }
  let r = face_dir(id.z, uv.x, uv.y); let p = origin() + (g.x / cheb(r)) * r; let n = nrm[k].xyz;
  var dL = 0.0;
  for (var s = 0; s < 4; s++) {
    let di = array<i32, 4>(1, -1, 0, 0)[s]; let dj = array<i32, 4>(0, 0, 1, -1)[s];
    let ii = i32(id.x) + di; let jj = i32(id.y) + dj;
    if (ii < 0 || jj < 0 || ii >= i32(N) || jj >= i32(N)) { continue; }
    let q = (id.z * N + u32(jj)) * N + u32(ii); let gq = geo[q];
    if (gq.z != g.z && (gq.x < 0.0 || gq.x > g.x * 1.03)) { dL = -P[P_outline]; }
    else if (dL == 0.0 && gq.z == g.z && (di > 0 || dj > 0) && dot(n, nrm[q].xyz) < 0.6) { dL = -P[P_crease]; }
  }
  col[k] = vec4f(stylise(shade_point(p, n, i32(g.y)), bands, dL), 1.0);
}`;

const CAM = /* wgsl */ `
fn cam_project(p: vec3f) -> vec3f {
  let v = p - vec3f(P[P_ex], P[P_ey], P[P_ez]); let z = dot(v, vec3f(P[P_fx], P[P_fy], P[P_fz]));
  let W = P[P_w]; let H = P[P_h];
  let x = dot(v, vec3f(P[P_rx], P[P_ry], P[P_rz])) / (z * P[P_ty] * (W / H)); let y = dot(v, vec3f(P[P_ux], P[P_uy], P[P_uz])) / (z * P[P_ty]);
  return vec3f((x + 1.0) / 2.0 * W, (1.0 - y) / 2.0 * H, z);
}
fn edgef(a: vec2f, b: vec2f, x: f32, y: f32) -> f32 { return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x); }
fn in_tri(a: vec2f, b: vec2f, c: vec2f, x: f32, y: f32) -> bool {
  let e0 = edgef(a, b, x, y); let e1 = edgef(b, c, x, y); let e2 = edgef(c, a, x, y);
  return (e0 >= 0.0 && e1 >= 0.0 && e2 >= 0.0) || (e0 <= 0.0 && e1 <= 0.0 && e2 <= 0.0);
}
// The texel's quad: corners in xy of c[0..3], centre depth key in c[4].x; false if culled.
fn texel_quad(k: u32, d: f32, c: ptr<function, array<vec2f, 5>>) -> bool {
  let N = u32(P[P_n]); let f = k / (N * N); let j = (k % (N * N)) / N; let i = k % N;
  let uv = texel_uv(i, j, N); let h = P[P_expand] / f32(N); let o = origin();
  let su = array<f32, 5>(-1.0, 1.0, 1.0, -1.0, 0.0); let sv = array<f32, 5>(-1.0, -1.0, 1.0, 1.0, 0.0);
  for (var s = 0; s < 5; s++) {
    let r = face_dir(f, uv.x + su[s] * h, uv.y + sv[s] * h); let sp = cam_project(o + (d / cheb(r)) * r);
    if (sp.z < 0.05) { return false; }
    if (s < 4) { (*c)[s] = sp.xy; } else { (*c)[4] = vec2f(floor(sp.z * 4096.0), 0.0); }
  }
  return true;
}
`;

const SPLAT_BODY = /* wgsl */ `
  let N = u32(P[P_n]); let k = id.x + id.y * 65535u * 64u; if (k >= 6u * N * N) { return; }
  let d = geo[k].x; if (d < 0.0) { return; }
  var c: array<vec2f, 5>; if (!texel_quad(k, d, &c)) { return; }
  let W = i32(P[P_w]); let H = i32(P[P_h]);
  let x0 = max(0, i32(floor(min(min(c[0].x, c[1].x), min(c[2].x, c[3].x))))); let x1 = min(W - 1, i32(ceil(max(max(c[0].x, c[1].x), max(c[2].x, c[3].x)))));
  let y0 = max(0, i32(floor(min(min(c[0].y, c[1].y), min(c[2].y, c[3].y))))); let y1 = min(H - 1, i32(ceil(max(max(c[0].y, c[1].y), max(c[2].y, c[3].y)))));
  if (x1 - x0 > 63 || y1 - y0 > 63) { return; }
  let z = u32(c[4].x);
  for (var y = y0; y <= y1; y++) { for (var x = x0; x <= x1; x++) {
    let px = f32(x) + 0.5; let py = f32(y) + 0.5;
    if (!in_tri(c[0], c[1], c[2], px, py) && !in_tri(c[0], c[2], c[3], px, py)) { continue; }
    let p = u32(y * W + x);
    WRITE
  } }
`;
export const SPLATZ_WGSL = CAM + /* wgsl */ `
@group(0) @binding(1) var<storage, read> geo: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> zb: array<atomic<u32>>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {` + SPLAT_BODY.replace("WRITE", "atomicMin(&zb[p], z);") + "}";
export const SPLATID_WGSL = CAM + /* wgsl */ `
@group(0) @binding(1) var<storage, read> geo: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> zb: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> idb: array<atomic<u32>>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {` + SPLAT_BODY.replace("WRITE", "if (atomicLoad(&zb[p]) == z) { atomicMin(&idb[p], k); }") + "}";

export const CLEAR_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read_write> a: array<u32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) { _ = P[0]; if (id.x < arrayLength(&a)) { a[id.x] = 0xffffffffu; } }`;

export const RESOLVE_WGSL = /* wgsl */ `
@group(0) @binding(1) var<storage, read> col0: array<vec4f>;
@group(0) @binding(2) var<storage, read> col1: array<vec4f>;
@group(0) @binding(3) var<storage, read> idb0: array<u32>;
@group(0) @binding(4) var<storage, read> idb1: array<u32>;
@group(0) @binding(5) var<storage, read_write> img: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> out8: array<u32>;
fn enc(v: f32) -> u32 { return u32(floor(linear_to_srgb(v) * 255.0 + 0.5)); }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let W = u32(P[P_w]); let H = u32(P[P_h]); if (id.x >= W || id.y >= H) { return; }
  let p = id.y * W + id.x; let B = array<f32, 16>(0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  let usePrev = P[P_hasPrev] > 0.5 && (B[(id.y & 3u) * 4u + (id.x & 3u)] + 0.5) / 16.0 >= P[P_blend];
  var c: vec3f; var t = idb0[p]; if (usePrev) { t = idb1[p]; }
  if (t != 0xffffffffu) { if (usePrev) { c = col1[t].xyz; } else { c = col0[t].xyz; } }
  else {
    let Wf = P[P_w]; let Hf = P[P_h];
    let x = (2.0 * (f32(id.x) + 0.5) / Wf - 1.0) * P[P_ty] * (Wf / Hf); let y = (1.0 - 2.0 * (f32(id.y) + 0.5) / Hf) * P[P_ty];
    let d = normalize(vec3f(P[P_fx], P[P_fy], P[P_fz]) + x * vec3f(P[P_rx], P[P_ry], P[P_rz]) + y * vec3f(P[P_ux], P[P_uy], P[P_uz]));
    let e = vec3f(P[P_ex], P[P_ey], P[P_ez]); let hit = scene_march(e, d, 40.0);
    if (hit.x < 0.0) { c = stylise(sky_col(d), P[P_bands], 0.0); }
    else { let q = e + d * hit.x; c = stylise(shade_point(q, scene_normal(q), i32(hit.y)), P[P_bands], 0.0); }
  }
  img[p] = vec4f(c, 1.0);
  out8[p] = enc(c.x) | (enc(c.y) << 8u) | (enc(c.z) << 16u) | (255u << 24u);
}`;
