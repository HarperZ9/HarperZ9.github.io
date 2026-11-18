// raw-native GPU passes: definitions shared by every pass.
// This WGSL is the one shader source. WebGPU runs it as written; the D3D12
// backend runs src/renderer/gpu/shaders/hlsl/, which scripts/wgsl_to_hlsl.py generates from it
// (CI fails when the two differ). The translator needs every let and var to
// carry an explicit type.
// Each function mirrors one C++ function in src/ line for line, with the same
// operation order, so the GPU computes the same float32 expressions as the CPU
// reference. Shader compilers may still fuse or reorder; the reconcile
// certificate (raw/renderer/gpu_reconcile.hpp) measures what that costs.

struct Params {
    vp: array<vec4f, 4>,      // current view-projection, rows (raw/math/mat.hpp is row-major)
    pvp: array<vec4f, 4>,     // previous view-projection, rows
    light: vec4f,             // xyz direction, w intensity
    misc: vec4f,              // x AO radius (world), y SSAO pixel radius
    w: u32, h: u32, ntri: u32, rt_samples: u32,
    ss_samples: u32, rtao: u32, rt_bvh: u32, rt_skew: u32,   // rt_bvh 0: scan every triangle (the oracle); rt_skew 1: the control
}

// Triangle input: 24 floats each. 0..8 world positions a,b,c; 9..17 normals; 18..20 albedo.
const TRI_STRIDE: u32 = 24u;
// Triangle setup output: 16 floats each.
// 0 valid, 1..3 screen x, 4..6 screen y, 7..9 view distance, 10..12 1/w, 13 area,
// 14 unused, 15 unused. Integer bounds live in the parallel u32 array (4 per triangle).
const SETUP_STRIDE: u32 = 16u;

fn vlen(v: vec3f) -> f32 { return sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
// raw::normalize: l > 0 ? v * (1/l) : v
fn vnorm(v: vec3f) -> vec3f {
    let l: f32 = vlen(v);
    if (l > 0.0) { let s: f32 = 1.0 / l; return vec3f(v.x * s, v.y * s, v.z * s); }
    return v;
}
fn vcross(a: vec3f, b: vec3f) -> vec3f {
    return vec3f(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}
fn vdot(a: vec3f, b: vec3f) -> f32 { return a.x * b.x + a.y * b.y + a.z * b.z; }
// raw::mul(Mat4, Vec4), row by row, left to right.
fn mrow(r: vec4f, v: vec4f) -> f32 { return r.x * v.x + r.y * v.y + r.z * v.z + r.w * v.w; }
fn mmul(m: array<vec4f, 4>, v: vec4f) -> vec4f {
    return vec4f(mrow(m[0], v), mrow(m[1], v), mrow(m[2], v), mrow(m[3], v));
}
// The deterministic per-pixel hash of src/renderer/ssao.cpp and src/renderer/ray_ao.cpp.
fn hash01(x: u32, y: u32, s: u32) -> f32 {
    var h: u32 = x * 374761393u + y * 668265263u + s * 2246822519u;
    h = (h ^ (h >> 13u)) * 1274126177u;
    h = h ^ (h >> 16u);
    return f32(h & 0xFFFFFFu) / 16777216.0;
}
// std::lround: halves round away from zero (WGSL round() rounds halves to even).
fn lround(v: f32) -> i32 {
    if (v >= 0.0) { return i32(floor(v + 0.5)); }
    return -i32(floor(-v + 0.5));
}
fn pix(x: u32, y: u32) -> u32 { return y * P.w + x; }
