// WGSL for spectral sodium shading (shade.mjs), one thread per pixel.
// P (f32): 0 w, 1 h, 2 lights, 3 materials, 4 sky type, 5 ambient, 6 mist, 7 extinction, 8 rain,
// 9 time, 10..12 camera position, 13 encode gain.
// gb: 40 floats per pixel (fixtures/sodium-quay-render.mjs). lights: 12 floats each: pos (3), type,
// intensity, cone (3), mode, pad (3). rgb: response [type][material][3]. white: [type][3].
export const SODIUM_P = 14, SODIUM_LIGHT = 12;
export const SODIUM_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> gb: array<f32>;
@group(0) @binding(2) var<storage, read> lt: array<f32>;
@group(0) @binding(3) var<storage, read> rgb: array<f32>;
@group(0) @binding(4) var<storage, read> white: array<f32>;
@group(0) @binding(5) var<storage, read_write> out8: array<u32>;
fn resp(t: u32, m: u32) -> vec3f { let i = (t * u32(P[3]) + m) * 3u; return vec3f(rgb[i], rgb[i + 1u], rgb[i + 2u]); }
fn wht(t: u32) -> vec3f { return vec3f(white[t * 3u], white[t * 3u + 1u], white[t * 3u + 2u]); }
fn surface(b: u32, vb: i32) -> vec3f {
  var o = vec3f(0.0);
  let mat = u32(gb[b + 3u] + 0.5); let scale = gb[b + 7u]; let et = gb[b + 8u];
  if (et >= 0.0) { o += wht(u32(et + 0.5)) * gb[b + 9u]; }
  if (scale <= 0.0) { return o; }
  o += resp(u32(P[4]), mat) * scale * P[5];
  let p = vec3f(gb[b], gb[b + 1u], gb[b + 2u]); let n = vec3f(gb[b + 4u], gb[b + 5u], gb[b + 6u]);
  for (var j = 0u; j < u32(P[2]); j++) {
    let lb = j * ${SODIUM_LIGHT}u; let v = vec3f(lt[lb], lt[lb + 1u], lt[lb + 2u]) - p; let d2 = dot(v, v); let l = v / sqrt(d2);
    let c = dot(n, l);
    if (c <= 0.0) { continue; }
    var k = c / d2; let cone = vec3f(lt[lb + 5u], lt[lb + 6u], lt[lb + 7u]); let mode = lt[lb + 8u];
    if (mode > 0.5 && mode < 1.5) { let a = -dot(l, cone); if (a > 0.8) { k *= pow((a - 0.8) / 0.2, 1.5) * 4.0; } else { k = 0.0; } }
    else if (mode > 1.5) { k *= max(0.0, -dot(l, cone)); }
    if (vb >= 0) { k *= gb[u32(vb) + j]; }
    if (k <= 0.0) { continue; }
    o += resp(u32(lt[lb + 3u] + 0.5), mat) * (scale * lt[lb + 4u] * k * 0.3183098861837907);
  }
  return o;
}
fn rainAt(x: u32, y: u32, h: f32, time: f32) -> f32 {
  let col = x + u32(floor(f32(y) * 0.2)); let h1 = f32(pcg(col * 9781u + 17u)) / 4294967296.0;
  if (h1 > 0.22) { return 0.0; }
  let speed = 0.9 + 0.6 * (f32(pcg(col * 7919u + 3u)) / 4294967296.0); let phase = f32(pcg(col * 104729u + 5u)) / 4294967296.0; let len = 0.08 * h;
  let u = (f32(y) + time * speed * h * 1.2) / len + phase; let f = u - floor(u);
  if (f < 0.35) { return 1.0 - f / 0.35; }
  return 0.0;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = u32(P[0]); let h = u32(P[1]);
  if (id.x >= w || id.y >= h) { return; }
  let b = (id.y * w + id.x) * 40u;
  var o = surface(b, i32(b + 28u));
  let rw = gb[b + 15u];
  if (rw > 0.0) { o += rw * surface(b + 16u, -1); }
  let tHit = gb[b + 10u]; let ext = exp(-P[7] * min(tHit, 120.0)); let end = min(tHit, 80.0);
  let cam = vec3f(P[10], P[11], P[12]); let dir = vec3f(gb[b + 12u], gb[b + 13u], gb[b + 14u]);
  var m = vec3f(0.0);
  for (var j = 0u; j < u32(P[2]); j++) {
    let lb = j * ${SODIUM_LIGHT}u; let v = vec3f(lt[lb], lt[lb + 1u], lt[lb + 2u]) - cam; let s0 = dot(v, dir);
    let hh = max(0.12, sqrt(max(0.0, dot(v, v) - s0 * s0)));
    let k = (P[6] * lt[lb + 4u] / (4.0 * 3.141592653589793 * hh)) * (atan((end - s0) / hh) + atan(s0 / hh));
    m += wht(u32(lt[lb + 3u] + 0.5)) * k;
  }
  var rain = 0.0; if (P[8] > 0.0) { rain = P[8] * 3.0 * rainAt(id.x, id.y, f32(h), P[9]); }
  let c = o * ext + m * (1.0 + rain);
  out8[id.y * w + id.x] = lab_pack(c, P[13]);
}
`;
