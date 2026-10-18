// WGSL for palette-locked lighting (palettelight.mjs, indexOf): one thread per pixel.
// P (f32): 0 w, 1 h, 2 K (steps per ramp), 3 void steps, 4 gain, 5 ambient, 6 moon, 7 cycle rate,
// 8 time, 9..11 moon direction, 12..19 lamp (pos, radius, core, intensity, wrap), 20..27 and
// 28..35 the two window glows (same layout).
// gb: four vec4f per pixel: (hit, class, detail, pool phase), (P, vis moon), (N, vis lamp), (vis window, 0, 0, 0).
// tbl: palette indices: ramp (class * 2 + variant) step at (class * 2 + variant) * K + step for the
// four lit classes, then the void ramp, three window entries, two lamp entries, the night entry.
// ent: packed RGBA8 of every palette entry. outIdx: palette index per pixel. out8: RGBA8.
export const PALETTELIGHT_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> gb: array<vec4f>;
@group(0) @binding(2) var<storage, read> tbl: array<u32>;
@group(0) @binding(3) var<storage, read> ent: array<u32>;
@group(0) @binding(4) var<storage, read_write> outIdx: array<u32>;
@group(0) @binding(5) var<storage, read_write> out8: array<u32>;

fn sat1(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }
fn bayer8(x0: i32, y0: i32) -> u32 {
  let x = u32(x0 & 7); let y = u32(y0 & 7); let v = x ^ y;
  return ((v & 1u) << 5u) | ((y & 1u) << 4u) | (((v >> 1u) & 1u) << 3u) | (((y >> 1u) & 1u) << 2u) | (((v >> 2u) & 1u) << 1u) | ((y >> 2u) & 1u);
}
fn thr(x: i32, y: i32) -> f32 { return (f32(bayer8(x, y)) + 0.5) / 64.0; }
fn radial(b: u32, p: vec3f, n: vec3f, vis: f32) -> f32 {
  let pos = vec3f(P[b], P[b + 1u], P[b + 2u]); let v = p - pos; let r2 = dot(v, v); let q = r2 / (P[b + 3u] * P[b + 3u]);
  if (q >= 1.0) { return 0.0; }
  let m = (P[b + 5u] * (1.0 - q) * (1.0 - q)) / (1.0 + r2 / (P[b + 4u] * P[b + 4u]));
  let tov = pos - p; let l = length(tov);
  var term = 1.0; if (l >= 1e-6) { term = sat1((dot(n, tov) / l + P[b + 6u]) / (1.0 + P[b + 6u])); }
  return vis * m * term;
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let w = u32(P[0]); let h = u32(P[1]);
  if (id.x >= w || id.y >= h) { return; }
  let i = id.y * w + id.x; let b = i * 4u;
  let v0 = gb[b]; let v1 = gb[b + 1u]; let v2 = gb[b + 2u]; let v3 = gb[b + 3u];
  let K = u32(P[2]); let vs = u32(P[3]); let ix = i32(id.x); let iy = i32(id.y);
  let nightIdx = tbl[8u * K + vs + 5u];
  var idx = nightIdx;
  let T1 = thr(ix, iy); let T2 = thr(ix + 11, iy + 7); let time = P[8];
  if (v0.x > 0.5) {
    let cls = u32(v0.y + 0.5);
    let voidBase = 8u * K; let winBase = voidBase + vs; let lampBase = winBase + 3u;
    if (cls == 4u) {
      let pos0 = v0.w * f32(vs) + time * P[7] * f32(vs); let pos = pos0 - floor(pos0 / f32(vs)) * f32(vs);
      let lo = u32(floor(pos)); let f = pos - floor(pos);
      var st = lo; if (f > T1) { st = lo + 1u; }
      idx = tbl[voidBase + (st % vs)];
    } else if (cls == 5u) {
      let s = 1.4 + 0.6 * sin(time * 5.0 + v1.x * 3.0) + 0.4 * (v0.z - 0.5); let tone = clamp(s, 0.0, 2.0); let lo = min(1u, u32(floor(tone)));
      var st = lo; if (tone - f32(lo) > T1) { st = lo + 1u; }
      idx = tbl[winBase + st];
    } else if (cls == 6u) {
      var st = 0u; if (0.5 + 0.2 * sin(time * 7.0) > T1) { st = 1u; }
      idx = tbl[lampBase + st];
    } else {
      let p = v1.xyz; let n = v2.xyz;
      let moonDir = vec3f(P[9], P[10], P[11]); let nl = max(0.0, dot(n, moonDir));
      let cool = P[5] * (0.7 + 0.3 * (0.5 + 0.5 * n.y)) + P[6] * nl * v1.w;
      var warm = radial(12u, p, n, v2.w) + radial(20u, p, n, v3.x) + radial(28u, p, n, v3.x);
      let E = cool + warm; let tone = 1.0 - exp(-P[4] * E * v0.z);
      let s = min(f32(K - 1u), max(0.0, tone * f32(K - 1u)));
      var wf = 0.0; if (E > 1e-9) { wf = warm / E; }
      let lo = min(K - 2u, u32(floor(s)));
      var st = lo; if (s - f32(lo) > T1) { st = lo + 1u; }
      var variant = 0u;
      if (wf >= 0.7) { variant = 1u; } else if (wf > 0.3) { if ((wf - 0.3) / 0.4 > T2) { variant = 1u; } }
      idx = tbl[(cls * 2u + variant) * K + st];
    }
  }
  outIdx[i] = idx; out8[i] = ent[idx];
}
`;
