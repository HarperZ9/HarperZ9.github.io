// Threads: particles flow along the zero set of a form field and leave luminous
// trails, tone-mapped by log density. A creative module: it has no CPU
// reference and writes no certificate (docs/architecture/adr/0010-web-host.md).
//
// One shader source for every backend. WebGPU runs it as written (web/ and the
// wasm build); D3D12 runs src/renderer/gpu/shaders/hlsl/threads_*.hlsl, which
// scripts/wgsl_to_hlsl.py generates from it. The code before the first pass
// marker is shared by every pass. Ported from a GLSL thread renderer: same
// fields, same motion and the same finish. Splats are integer atomics into a
// fixed-point accumulator instead of additive point blending, so the same
// passes run on a backend with compute only.

struct Params {
    t: f32, dt: f32, fr: f32, aspect: f32,
    u: f32, ta: f32, tb: f32, spacing: f32,
    nlev: f32, gain: f32, scale: f32, keep: f32,
    expo: f32, spec: f32, dur: f32, fxs: f32,
    pr0: vec4f,
    pr1: vec4f,
    np: u32, wa: i32, wb: i32, ch: i32,
    w: u32, h: u32, substeps: u32, simw: u32,
    simh: u32, seedbase: u32, simt: f32, pad0: u32,
}

// One level of the bloom pyramid: full-frame size, the level written, and the
// scale from accumulator units to density.
struct Level {
    w: u32, h: u32, level: u32, inv: f32,
}

const PI: f32 = 3.14159265;

fn hash2(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn hashu(x0: u32) -> u32 {
    var x: u32 = x0;
    x = x ^ (x >> 16u);
    x = x * 0x7feb352du;
    x = x ^ (x >> 15u);
    x = x * 0x846ca68bu;
    x = x ^ (x >> 16u);
    return x;
}
// The bloom pyramid: level l is max(1, size >> l) on each side. Odd levels live
// in one buffer and even levels in another, each packed after the earlier
// levels of the same parity, so a pass reads one buffer and writes the other.
fn levelDim(n: u32, l: u32) -> u32 { return max(1u, n >> l); }
fn levelBase(w: u32, h: u32, l: u32) -> u32 {
    var o: u32 = 0u;
    for (var j: u32 = 2u - (l % 2u); j < l; j = j + 2u) {
        o = o + levelDim(w, j) * levelDim(h, j);
    }
    return o;
}

//@pass threads_init
// Every particle starts expired, so the first step places it on the field.
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> pos: array<vec4f>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    if (gid.x >= P.np) { return; }
    pos[gid.x] = vec4f(0.0, 0.0, 0.0, f32(hashu(gid.x + P.seedbase) >> 8u) / 16777216.0);
}

//@pass threads_rd_seed
// The reaction-diffusion field behind the Morphogen world, seeded with spots.
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> dst: array<vec2f>;
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    if (gid.x >= P.simw || gid.y >= P.simh) { return; }
    let q: vec2f = (vec2f(f32(gid.x), f32(gid.y)) - vec2f(f32(P.simw), f32(P.simh)) * 0.5) / f32(P.simh);
    var v: f32 = step(length(q), 0.02);
    for (var k: i32 = 0; k < 40; k++) {
        let fk: f32 = f32(k);
        let sp: vec2f = vec2f(fract(sin(fk * 12.9898) * 43758.5) * 1.7 - 0.85, fract(sin(fk * 78.233) * 12345.6) - 0.5);
        v = v + step(length(q - sp), 0.006);
    }
    dst[gid.y * P.simw + gid.x] = vec2f(1.0, min(v, 1.0));
}

//@pass threads_rd
// One Gray-Scott step on a wrapping grid.
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> src: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> dst: array<vec2f>;
fn cell(x: i32, y: i32) -> vec2f {
    let w: i32 = i32(P.simw);
    let h: i32 = i32(P.simh);
    return src[u32((((y % h) + h) % h) * w + (((x % w) + w) % w))];
}
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    if (gid.x >= P.simw || gid.y >= P.simh) { return; }
    let x: i32 = i32(gid.x);
    let y: i32 = i32(gid.y);
    let q: vec2f = (vec2f(f32(x), f32(y)) - vec2f(f32(P.simw), f32(P.simh)) * 0.5) / f32(P.simh);
    let s: vec2f = cell(x, y);
    var lap: vec2f = -s;
    lap = lap + 0.2 * (cell(x + 1, y) + cell(x - 1, y) + cell(x, y + 1) + cell(x, y - 1));
    lap = lap + 0.05 * (cell(x + 1, y + 1) + cell(x - 1, y + 1) + cell(x + 1, y - 1) + cell(x - 1, y - 1));
    let ph: f32 = clamp(P.simt / 40.0, 0.0, 1.0);
    var fk: vec2f = mix(vec2f(0.029, 0.057), vec2f(0.0367, 0.0649), smoothstep(0.3, 0.45, ph));
    fk = mix(fk, vec2f(0.0545, 0.062), smoothstep(0.55, 0.68, ph));
    fk = mix(fk, vec2f(0.039, 0.058), smoothstep(0.78, 0.9, ph));
    var u: f32 = s.x;
    var v: f32 = s.y;
    let uvv: f32 = u * v * v;
    u = u + lap.x - uvv + fk.x * (1.0 - u);
    v = v + 0.5 * lap.y + uvv - (fk.x + fk.y) * v;
    let open: f32 = smoothstep(8.0, 14.0, P.simt) * (1.0 - smoothstep(34.0, 37.0, P.simt));
    let qx: f32 = q.x / 0.42;
    let lid: f32 = 0.16 * (1.0 - qx * qx) * open;
    if (abs(q.y) < lid && abs(q.x) < 0.42 && length(q) > 0.07 * open) { v = v * 0.6; }
    dst[gid.y * P.simw + gid.x] = vec2f(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0));
}

//@pass threads_decay
// Persistence: every accumulator cell keeps P.keep of its value.
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> acc: array<u32>;
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    if (gid.x >= P.w || gid.y >= P.h) { return; }
    let i: u32 = (gid.y * P.w + gid.x) * 4u;
    acc[i] = u32(f32(acc[i]) * P.keep);
    acc[i + 1u] = u32(f32(acc[i + 1u]) * P.keep);
    acc[i + 2u] = u32(f32(acc[i + 2u]) * P.keep);
    acc[i + 3u] = u32(f32(acc[i + 3u]) * P.keep);
}

//@pass threads_advance
// Every substep of one frame in one dispatch: each particle moves along its
// level line (or respawns onto the field), then splats its light.
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> acc: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read> sim: array<vec2f>;
// The fifteen worlds and their palettes live in this pass, the only one that
// uses them, so the other passes compile small.
fn hash1(n: f32) -> f32 { return fract(sin(n * 12.9898) * 43758.5453); }
fn vnoise(p: vec2f) -> f32 {
    let i: vec2f = floor(p);
    var f: vec2f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2f(1.0, 0.0)), f.x), mix(hash2(i + vec2f(0.0, 1.0)), hash2(i + vec2f(1.0, 1.0)), f.x), f.y);
}
fn fbm(p0: vec2f) -> f32 {
    var p: vec2f = p0;
    var s: f32 = 0.0;
    var a: f32 = 0.5;
    for (var i: i32 = 0; i < 4; i++) {
        s = s + a * vnoise(p);
        p = p * 2.03 + vec2f(1.7, 9.2);
        a = a * 0.5;
    }
    return s;
}
// GLSL mat2(c, -s, s, c) * p.
fn rotv(p: vec2f, a: f32) -> vec2f {
    let c: f32 = cos(a);
    let s: f32 = sin(a);
    return vec2f(c * p.x + s * p.y, c * p.y - s * p.x);
}
// GLSL mod: the remainder takes the sign of the divisor.
fn fmodf(x: f32, y: f32) -> f32 { return x - y * floor(x / y); }
fn seg(p: vec2f, a: vec2f, b: vec2f) -> f32 {
    let pa: vec2f = p - a;
    let ba: vec2f = b - a;
    let h: f32 = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}
fn ring(p: vec2f, c: vec2f, r: f32) -> f32 { return abs(length(p - c) - r); }
fn box2(p: vec2f, b: vec2f) -> f32 {
    let d: vec2f = abs(p) - b;
    return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0);
}
fn figure(p0: vec2f, lean: f32) -> f32 {
    let p: vec2f = rotv(p0, lean);
    var d: f32 = ring(p, vec2f(0.0, 0.17), 0.035);
    d = min(d, seg(p, vec2f(0.0, 0.13), vec2f(0.0, 0.0)));
    d = min(d, seg(p, vec2f(0.0, 0.11), vec2f(-0.09, 0.03)));
    d = min(d, seg(p, vec2f(0.0, 0.11), vec2f(0.09, 0.03)));
    d = min(d, seg(p, vec2f(0.0, 0.0), vec2f(-0.045, -0.16)));
    d = min(d, seg(p, vec2f(0.0, 0.0), vec2f(0.045, -0.16)));
    return d;
}

// The fifteen worlds. Each returns a signed, distance-like scalar whose zero
// set the particles trace. Squares are written as products: GLSL pow() of a
// negative base is undefined, and the drivers the original ran on folded it.
fn fKomorebi(p: vec2f, t: f32) -> f32 {
    let w: vec2f = vec2f(sin(t * 0.4), cos(t * 0.31)) * 0.03;
    let l: f32 = fbm((p + w) * 3.2 + vec2f(t * 0.04, 0.0));
    return (l - 0.55) * 0.35;
}
fn fDroste(p: vec2f, t: f32) -> f32 {
    let sc: f32 = log(4.0);
    var lz: vec2f = vec2f(log(max(length(p), 1e-3)), atan2(p.y, p.x));
    let al: f32 = atan(sc / (2.0 * PI));
    lz = rotv(lz, al) / cos(al);
    lz.x = fmodf(lz.x - t * 0.25, sc);
    var q: vec2f = exp(lz.x) * vec2f(cos(lz.y), sin(lz.y)) * 2.2;
    let m: f32 = 0.5 + 0.5 * sin(t * 0.15);
    q = q + m * 0.3 * vec2f(sin(q.y * PI), sin(q.x * PI));
    let f: vec2f = abs(fract(q) - 0.5);
    return (0.5 - max(f.x, f.y)) * 0.08 * length(p) / exp(lz.x);
}
fn fVoices(p: vec2f, t: f32) -> f32 {
    var q: vec2f = p * 1.3;
    q.x = abs(q.x);
    let w: vec2f = vec2f(fbm(q * 2.1 + t * 0.06), fbm(q * 2.1 - vec2f(t * 0.05, 3.1)));
    return (fbm(q * 1.6 + w * 1.6) - 0.5) * 0.3 + max(length(p * vec2f(0.7, 1.0)) - 0.8, 0.0);
}
fn fMaking(p: vec2f, t0: f32) -> f32 {
    let t: f32 = t0 - 3.0;
    let rise: f32 = smoothstep(12.0, 17.0, t);
    var d: f32 = figure(p + vec2f(0.0, 0.05), (1.0 - rise) * 1.45);
    var a: vec2f = vec2f(0.0, 0.6);
    let strike: f32 = floor(t / 3.1);
    let fade: f32 = select(0.0, 0.3, t - strike * 3.1 > 0.6);
    for (var k: i32 = 0; k < 10; k++) {
        let b: vec2f = a + vec2f((hash1(strike * 13.0 + f32(k)) - 0.5) * 0.12, -0.055);
        d = min(d, seg(p, a, b) + 0.02 + fade);
        a = b;
    }
    let hy: f32 = 0.62 - 0.3 * smoothstep(2.0, 9.0, t);
    d = min(d, seg(p, vec2f(0.3, 0.7), vec2f(0.3, hy)));
    d = min(d, ring(p, vec2f(0.3, hy - 0.03), 0.02));
    for (var k: i32 = 0; k < 6; k++) {
        let fk: f32 = f32(k);
        let ph: vec2f = vec2f(-0.75 + fk * 0.3, 0.7 - fmodf(t * 0.05 + hash1(fk) * 1.4, 1.5));
        d = min(d, abs(box2(rotv(p - ph, sin(t * 0.8 + fk) * 0.6), vec2f(0.035, 0.045))));
    }
    return d;
}
fn fEye(p: vec2f, t: f32) -> f32 {
    let open: f32 = smoothstep(0.0, 3.0, t);
    let ex: f32 = p.x / 0.55;
    let lid: f32 = 0.22 * (1.0 - ex * ex) * open;
    var d: f32 = abs(abs(p.y) - lid) + max(abs(p.x) - 0.55, 0.0);
    let look: vec2f = 0.04 * vec2f(sin(t * 0.7), 0.4 * cos(t * 0.5));
    let r: f32 = length(p - look);
    d = min(d, abs(r - 0.18));
    d = min(d, abs(r - 0.055));
    let a: f32 = atan2(p.y - look.y, p.x - look.x);
    d = min(d, max(abs(sin(a * 60.0)) * r * 0.05, max(r - 0.18, 0.06 - r)));
    let va: vec2f = vec2f(0.0, 0.62);
    let vb: vec2f = vec2f(-0.9, -0.42);
    let vc: vec2f = vec2f(0.9, -0.42);
    d = min(d, min(min(seg(p, va, vb), seg(p, vb, vc)), seg(p, vc, va)));
    return d;
}
fn puppetString(p: vec2f, bar: vec2f, k: f32, j: vec2f, pull: f32) -> f32 {
    let top: vec2f = bar + vec2f(k * 0.06, 0.0);
    return seg(p, top, mix(j, top, pull)) + 0.0015;
}
fn fStrings(p: vec2f, t0: f32) -> f32 {
    let t: f32 = t0 - 3.0;
    let sw: f32 = sin(t * 1.3);
    let cut: f32 = smoothstep(15.0, 15.4, t);
    let bar: vec2f = vec2f(0.15 * sw, 0.55);
    let slump: f32 = cut * (1.0 - smoothstep(16.5, 19.0, t)) * 0.07;
    let sl: vec2f = vec2f(0.0, slump);
    let j0: vec2f = vec2f(0.0, 0.08) - sl;
    let j1: vec2f = vec2f(-0.1, sw * 0.03 * (1.0 - cut)) - sl;
    let j2: vec2f = vec2f(0.1, -sw * 0.03 * (1.0 - cut)) - sl;
    let j3: vec2f = vec2f(-0.05, -0.24) - sl;
    let j4: vec2f = vec2f(0.05, -0.24) - sl;
    var d: f32 = ring(p, j0 + vec2f(0.0, 0.05), 0.035);
    let hip: vec2f = vec2f(0.0, -0.1 - slump);
    d = min(d, seg(p, j0, hip));
    d = min(d, seg(p, j0, j1));
    d = min(d, seg(p, j0, j2));
    d = min(d, seg(p, hip, j3));
    d = min(d, seg(p, hip, j4));
    let pull: f32 = cut * smoothstep(15.0, 16.0, t);
    d = min(d, puppetString(p, bar, -2.0, j0, pull));
    d = min(d, puppetString(p, bar, -1.0, j1, pull));
    d = min(d, puppetString(p, bar, 0.0, j2, pull));
    d = min(d, puppetString(p, bar, 1.0, j3, pull));
    d = min(d, puppetString(p, bar, 2.0, j4, pull));
    d = min(d, seg(p, bar - vec2f(0.15, 0.0), bar + vec2f(0.15, 0.0)));
    let lie: f32 = max(smoothstep(4.0, 4.3, t) * (1.0 - smoothstep(6.0, 6.5, t)), smoothstep(8.0, 8.3, t) * (1.0 - smoothstep(11.0, 11.5, t)));
    let ns: vec2f = j0 + vec2f(0.03, 0.05);
    d = min(d, seg(p, ns, ns + vec2f(0.04 + 0.24 * lie, 0.0)));
    d = min(d, seg(p, ns + vec2f(0.0, -0.03), ns + vec2f(0.3, -0.03)) + 0.004);
    let tr: vec2f = p - vec2f(-0.6, -0.05);
    d = min(d, seg(tr, vec2f(0.0, -0.45), vec2f(0.02, 0.2)) + (1.0 - smoothstep(8.0, 10.0, t) * (1.0 - smoothstep(12.0, 14.0, t))) * 0.5);
    return d;
}
fn fStream(p: vec2f, t: f32) -> f32 {
    let bend: f32 = 0.08 * sin(p.x * 2.2 + t * 0.5);
    let bx: f32 = mix(-1.0, 1.0, smoothstep(0.0, 18.0, t));
    let dx: f32 = p.x - bx;
    let w: f32 = 0.09 + 0.06 * exp(-dx * dx * 20.0);
    var d: f32 = abs(abs(p.y - bend) - w);
    for (var k: i32 = 0; k < 9; k++) {
        let xk: f32 = -0.88 + f32(k) * 0.22;
        d = min(d, abs(length(vec2f((p.x - xk) * 5.0, p.y - bend)) - 0.2));
    }
    return d;
}
fn fBelly(p: vec2f, t: f32) -> f32 {
    var d: f32 = 1000.0;
    for (var k: i32 = 0; k < 9; k++) {
        let depth: f32 = fract((f32(k) - t * 0.3) / 9.0) * 9.0 + 0.6;
        let q: vec2f = p * depth;
        let e: vec2f = vec2f(q.x * 0.8, max(q.y + 0.1, 0.0) * 1.1 + min(q.y + 0.1, 0.0) * 3.0);
        d = min(d, abs(length(e) - 0.9) / depth);
    }
    d = min(d, ring(p, vec2f(0.03 * sin(t * 0.4), -0.14), 0.008));
    return d;
}
fn prob(k: i32, a: vec4f, b: vec4f) -> f32 {
    if (k == 0) { return a.x; }
    if (k == 1) { return a.y; }
    if (k == 2) { return a.z; }
    if (k == 3) { return a.w; }
    if (k == 4) { return b.x; }
    return b.y;
}
fn fDraw(p: vec2f, t: f32, ch: i32, pa: vec4f, pb: vec4f) -> f32 {
    let ro: f32 = 0.15;
    let grow: f32 = smoothstep(4.0, 9.0, t);
    let pick: f32 = smoothstep(12.6, 12.9, t);
    let chaos: f32 = 1.0 - smoothstep(2.0, 6.0, t);
    var d: f32 = abs(length(p) - ro * (1.0 + 0.08 * chaos * sin(atan2(p.y, p.x) * 23.0 + t * 9.0)));
    d = min(d, abs(length(p) - 0.33) + 0.004);
    for (var k: i32 = 0; k < 6; k++) {
        let ang: f32 = radians(215.0 + 110.0 * f32(k) / 5.0);
        let dir: vec2f = vec2f(cos(ang), sin(ang));
        let boost: f32 = select(1.0 - 0.8 * pick, 1.0 + pick, k == ch);
        let reach: f32 = ro * (0.3 + 3.4 * sqrt(prob(k, pa, pb))) * grow * boost;
        d = min(d, seg(p, dir * ro * 0.9, dir * (ro * 0.9 + reach)));
    }
    return d;
}
fn fElements(p: vec2f, t: f32) -> f32 {
    let app: f32 = smoothstep(0.0, 14.0, t);
    let sp: vec2f = vec2f(0.0, 0.62 - 0.32 * app);
    let sr: f32 = 0.06 + 0.2 * app;
    var d: f32 = abs(length(p - sp) - sr);
    let core: vec2f = vec2f(0.0, -0.2);
    for (var k: i32 = 0; k < 4; k++) {
        let fk: f32 = f32(k);
        let sx: f32 = select(-1.0, 1.0, (k % 2) == 1);
        let pk: vec2f = vec2f(sx * select(0.42, 0.22, k >= 2), select(-0.22, -0.34, k >= 2));
        let open: f32 = smoothstep(5.0 + fk * 1.6, 6.5 + fk * 1.6, t);
        let q: vec2f = p - pk;
        d = min(d, abs(max(abs(q.x) * 1.4 + q.y * 0.5 - 0.06, max(-q.y - 0.07, q.y - 0.11))));
        d = min(d, seg(p, pk + vec2f(0.0, 0.1), core) + (1.0 - open) * 0.5);
    }
    d = min(d, seg(p, core, sp) + (1.0 - smoothstep(11.5, 12.5, t)) * 0.5);
    return d;
}
fn fBurden(p: vec2f, t: f32) -> f32 {
    let ys: f32 = -0.34 + 0.36 * (p.x + 0.9) / 1.8;
    var d: f32 = abs(p.y - ys) * 0.95;
    let fx: f32 = mix(-0.2, 0.0, smoothstep(0.0, 18.0, t));
    let foot: vec2f = vec2f(fx, -0.34 + 0.36 * (fx + 0.9) / 1.8);
    d = min(d, figure(p - foot - vec2f(0.03, 0.16), -0.55));
    let bc: vec2f = vec2f(fx + 0.19, -0.34 + 0.36 * (fx + 1.09) / 1.8 + 0.095);
    d = min(d, abs(length(p - bc) - 0.095));
    d = min(d, abs(box2(p - vec2f(-0.48, 0.15), vec2f(0.045, 0.21))));
    d = min(d, ring(p, vec2f(0.42, 0.1), 0.17));
    return d;
}
fn fSwing(p: vec2f, t: f32) -> f32 {
    let pl: vec2f = vec2f(-0.25, 0.25);
    let pr: vec2f = vec2f(0.17, 0.25);
    var d: f32 = min(seg(p, pl, pr), min(seg(p, pl, pl - vec2f(0.08, 0.6)), seg(p, pr, pr + vec2f(0.08, -0.6))));
    let ang: f32 = 0.35 * sin(t * 1.1) * (1.0 - smoothstep(12.0, 17.0, t) * 0.7);
    let piv: vec2f = vec2f(-0.04, 0.25);
    let seat: vec2f = piv + rotv(vec2f(0.0, -0.45), ang);
    d = min(d, min(seg(p, piv + vec2f(-0.04, 0.0), seat + vec2f(-0.04, 0.0)), seg(p, piv + vec2f(0.04, 0.0), seat + vec2f(0.04, 0.0))));
    d = min(d, figure(rotv(p - seat, -ang) - vec2f(0.0, 0.11), 0.0));
    let lamp: vec2f = vec2f(0.3, 0.35);
    d = min(d, seg(p, vec2f(0.3, -0.35), lamp));
    d = min(d, min(seg(p, lamp, lamp + vec2f(-0.3, -0.7)), seg(p, lamp, lamp + vec2f(0.3, -0.7))) + 0.01);
    d = min(d, abs(p.y + 0.35) + 0.004);
    return d;
}
fn fForest(p: vec2f, t: f32) -> f32 {
    let logY: f32 = -0.18 + 0.03 * sin(p.x * 3.0);
    var d: f32 = abs(abs(p.y - logY) - 0.07) + max(abs(p.x) - 0.85, 0.0);
    d = min(d, abs(p.y + 0.27) + 0.003);
    for (var k: i32 = 0; k < 6; k++) {
        let x: f32 = -0.9 + f32(k) * 0.36;
        d = min(d, abs(p.x - x - 0.01 * sin(p.y * 7.0 + f32(k))) + max(-0.1 - p.y, 0.0));
    }
    for (var k: i32 = 0; k < 5; k++) {
        let sx: f32 = -0.5 + f32(k) * 0.25;
        let hh: f32 = 0.35 * smoothstep(5.0 + f32(k) * 1.5, 16.0 + f32(k), t);
        d = min(d, seg(p, vec2f(sx, logY + 0.07), vec2f(sx, logY + 0.07 + hh)) + select(0.0, 1.0, hh < 0.01));
    }
    let my: f32 = abs(fract(fbm(p * 7.0 + 5.0) * 6.0) - 0.5) * 0.04 + max(p.y + 0.27, 0.0) * 2.0;
    d = min(d, my + (1.0 - smoothstep(2.0, 14.0, t)) * 0.2);
    let sd: vec2f = mix(vec2f(-0.3, 0.6), vec2f(0.05, logY + 0.08), smoothstep(3.0, 13.0, t));
    d = min(d, ring(p, sd, 0.008));
    d = min(d, seg(p, vec2f(0.05, logY + 0.08), vec2f(0.05, logY + 0.08 + 0.22 * smoothstep(13.0, 18.0, t))) + select(0.0, 1.0, t < 13.0));
    return d;
}
fn fMany(p: vec2f, t: f32) -> f32 {
    let tile: f32 = exp(-3.0 * smoothstep(0.0, 10.0, t)) * 0.9;
    let f: vec2f = fract(p / tile + 0.5) - 0.5;
    var d: f32 = abs(length(f) - 0.3) * tile;
    d = min(d, abs(max(abs(f.x), abs(f.y)) - 0.45) * tile);
    return d + smoothstep(9.0, 11.0, t) * length(p) * 0.3;
}
fn spectral(l: f32) -> vec3f {
    return clamp(vec3f(1.5 - abs(4.0 * l - 3.0), 1.5 - abs(4.0 * l - 2.0), 1.5 - abs(4.0 * l - 1.0)), vec3f(0.0), vec3f(1.0));
}
fn palette(w: i32, p: vec2f, s: f32, lam: f32) -> vec3f {
    if (w == 0) { return mix(vec3f(1.0, 0.85, 0.5), vec3f(0.45, 0.75, 0.3), s); }
    if (w == 1) { return mix(vec3f(0.95, 0.88, 0.74), vec3f(0.66, 0.33, 0.2), step(0.85, s)); }
    if (w == 2) { return select(vec3f(1.0, 0.35, 0.65), vec3f(0.4, 0.85, 1.0), p.x < 0.0); }
    if (w == 3) { return mix(vec3f(1.0, 0.45, 0.12), vec3f(0.95, 0.2, 0.45), s); }
    if (w == 4) { return mix(vec3f(0.6, 0.8, 1.0), vec3f(1.0), s); }
    if (w == 5) { return mix(vec3f(0.9, 0.1, 0.12), vec3f(1.0, 0.75, 0.35), s); }
    if (w == 6) { return mix(vec3f(0.85, 0.55, 0.25), vec3f(0.95, 0.9, 0.8), step(0.6, s)); }
    if (w == 7) { return mix(vec3f(0.55, 0.35, 1.0), spectral(lam), 0.5); }
    if (w == 8) { return mix(vec3f(0.75, 0.3, 0.22), vec3f(1.0, 0.65, 0.3), step(0.92, s)); }
    if (w == 9) { return mix(vec3f(1.0, 0.9, 0.75), vec3f(1.0, 0.28, 0.08), step(0.9, s)); }
    if (w == 10) {
        let k: i32 = i32(s * 4.0);
        if (k == 0) { return vec3f(0.55, 0.9, 0.3); }
        if (k == 1) { return vec3f(0.3, 0.7, 1.0); }
        if (k == 2) { return vec3f(0.9, 0.95, 1.0); }
        return vec3f(1.0, 0.45, 0.1);
    }
    if (w == 11) { return mix(vec3f(0.85, 0.08, 0.05), vec3f(1.0, 0.5, 0.2), s); }
    if (w == 12) { return mix(vec3f(0.8, 0.85, 1.0), vec3f(1.0, 0.8, 0.45), step(0.75, s)); }
    if (w == 13) { return mix(vec3f(0.35, 0.7, 0.25), vec3f(0.95, 0.92, 0.85), step(0.7, s)); }
    return spectral(lam);
}
fn simV(u0: vec2f) -> f32 {
    let w: i32 = i32(P.simw);
    let h: i32 = i32(P.simh);
    let q: vec2f = fract(u0) * vec2f(f32(P.simw), f32(P.simh)) - 0.5;
    let fl: vec2f = floor(q);
    let f: vec2f = q - fl;
    let x0: i32 = ((i32(fl.x) % w) + w) % w;
    let y0: i32 = ((i32(fl.y) % h) + h) % h;
    let x1: i32 = (x0 + 1) % w;
    let y1: i32 = (y0 + 1) % h;
    let a: f32 = mix(sim[u32(y0 * w + x0)].y, sim[u32(y0 * w + x1)].y, f.x);
    let b: f32 = mix(sim[u32(y1 * w + x0)].y, sim[u32(y1 * w + x1)].y, f.x);
    return mix(a, b, f.y);
}
fn fMorph(p: vec2f, t: f32) -> f32 { return (simV(0.5 + p * vec2f(9.0 / 16.0, 1.0)) - 0.2) * 0.15; }
fn form(w: i32, p: vec2f, t: f32) -> f32 {
    if (w == 0) { return fKomorebi(p, t); }
    if (w == 1) { return fDroste(p, t); }
    if (w == 2) { return fVoices(p, t); }
    if (w == 3) { return fMorph(p, t); }
    if (w == 4) { return fMaking(p, t); }
    if (w == 5) { return fEye(p, t); }
    if (w == 6) { return fStrings(p, t); }
    if (w == 7) { return fStream(p, t); }
    if (w == 8) { return fBelly(p, t); }
    if (w == 9) { return fDraw(p, t, P.ch, P.pr0, P.pr1); }
    if (w == 10) { return fElements(p, t); }
    if (w == 11) { return fBurden(p, t); }
    if (w == 12) { return fSwing(p, t); }
    if (w == 13) { return fForest(p, t); }
    return fMany(p, t);
}
fn atmos(p: vec2f, w: i32, t: f32) -> f32 {
    return fbm(p * 2.4 + vec2f(f32(w) * 7.31, f32(w) * 3.7) + vec2f(t * 0.03, -t * 0.02)) - 0.5;
}
// The field of one particle: the world's form, the aperture between two worlds
// while U crosses from 0 to 1, or the drifting atmosphere for a third of them.
fn fieldAt(p: vec2f, atm: bool, ta: f32, tb: f32) -> f32 {
    if (atm) { return atmos(p, select(P.wa, P.wb, P.u > 0.5), select(ta, tb, P.u > 0.5)) * 0.25; }
    if (P.u <= 0.0) { return form(P.wa, p, ta); }
    let r: f32 = abs(0.55 * (1.0 - 2.0 * P.u));
    let ap: f32 = abs(length(p) - max(r, 0.004));
    if (P.u < 0.5) { return mix(form(P.wa, p, ta), ap, smoothstep(0.0, 0.5, P.u)); }
    return mix(ap, form(P.wb, p, tb), smoothstep(0.5, 1.0, P.u));
}
fn gradAt(p: vec2f, atm: bool, ta: f32, tb: f32) -> vec2f {
    let e: f32 = 1.2e-3;
    let gx: f32 = fieldAt(p + vec2f(e, 0.0), atm, ta, tb) - fieldAt(p - vec2f(e, 0.0), atm, ta, tb);
    let gy: f32 = fieldAt(p + vec2f(0.0, e), atm, ta, tb) - fieldAt(p - vec2f(0.0, e), atm, ta, tb);
    return vec2f(gx, gy) / (2.0 * e);
}
fn curl(p: vec2f, t: f32) -> vec2f {
    let e: f32 = 0.01;
    let a: f32 = fbm(p * 3.0 + t * 0.1);
    return vec2f(fbm(p * 3.0 + vec2f(0.0, e) + t * 0.1) - a, a - fbm(p * 3.0 + vec2f(e, 0.0) + t * 0.1)) / e;
}
// One point of light into the fixed-point accumulator: premultiplied colour and
// density, rounded. A contribution under half a unit is dropped.
fn splat(q: vec2f, c: vec3f, a: f32) {
    let fx: f32 = (q.x / P.aspect + 0.5) * f32(P.w);
    let fy: f32 = (0.5 - q.y) * f32(P.h);
    if (fx < 0.0 || fy < 0.0 || fx >= f32(P.w) || fy >= f32(P.h)) { return; }
    let g: f32 = a * P.gain * P.fxs;
    if (g < 0.5) { return; }
    let i: u32 = (u32(fy) * P.w + u32(fx)) * 4u;
    atomicAdd(&acc[i], u32(c.x * g + 0.5));
    atomicAdd(&acc[i + 1u], u32(c.y * g + 0.5));
    atomicAdd(&acc[i + 2u], u32(c.z * g + 0.5));
    atomicAdd(&acc[i + 3u], u32(g + 0.5));
}
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let i: u32 = gid.x;
    if (i >= P.np) { return; }
    let s: vec4f = pos[i];
    var p: vec2f = s.xy;
    var age: f32 = s.z;
    // A static use of binding 3, so the pipeline layout keeps it when the web host
    // compiles this pass for worlds that never read the field (web/threads.mjs).
    if (P.simw == 0u) { p = sim[0]; }
    let seed: f32 = s.w;
    let lam: f32 = fract(seed * 7.13);
    let atm: bool = fract(seed * 41.7) < 0.3;
    let hair: bool = fract(seed * 17.3) < 0.14;
    let wcol: i32 = select(P.wa, P.wb, P.u > 0.5);
    let side: f32 = select(1.0, -1.0, fract(seed * 3.3) < 0.5);
    let speed: f32 = (0.05 + 0.08 * fract(seed * 5.1)) * (1.0 + (lam - 0.5) * 0.25 * select(0.0, 1.0, P.u > 0.0));
    let pull: f32 = select(7.0, 0.6, hair);
    let swirl: f32 = select(0.003, 0.03, hair);
    let bright: f32 = select(1.0, 0.22, atm) * select(1.0, 0.35, hair) * (0.55 + 0.45 * fract(seed * 29.1));
    let tint: vec3f = select(vec3f(1.0), vec3f(0.75, 0.8, 0.9), atm);
    let spec: f32 = smoothstep(0.0, 0.3, P.u) * (1.0 - smoothstep(0.7, 1.0, P.u));
    let tone: f32 = fract(seed * 13.7);
    for (var k: u32 = 0u; k < P.substeps; k++) {
        let fk: f32 = f32(k);
        let t: f32 = P.t + fk * P.dt;
        let ta: f32 = P.ta + fk * P.dt;
        let tb: f32 = P.tb + fk * P.dt;
        let fr: f32 = P.fr + fk;
        if (age <= 0.0 || abs(p.x) > P.aspect * 0.55 || abs(p.y) > 0.55) {
            let h1: f32 = hash1(seed * 91.7 + fr * 1.31);
            let h2: f32 = hash1(seed * 37.3 + fr * 2.17);
            p = vec2f((h1 - 0.5) * P.aspect, h2 - 0.5);
            for (var it: i32 = 0; it < 6; it++) {
                let f: f32 = fieldAt(p, atm, ta, tb);
                let g: vec2f = gradAt(p, atm, ta, tb);
                let gg: f32 = max(dot(g, g), 1e-4);
                p = p - clamp(f / gg, -0.2, 0.2) * g;
            }
            age = 0.6 + 3.5 * hash1(seed + fr * 0.73);
        } else {
            let f0: f32 = fieldAt(p, atm, ta, tb);
            let g: vec2f = gradAt(p, atm, ta, tb);
            let gl: f32 = max(length(g), 1e-4);
            let n: vec2f = g / gl;
            let idx: f32 = clamp(floor(f0 / P.spacing + 0.5), -P.nlev, P.nlev);
            let f: f32 = f0 - idx * P.spacing;
            let tang: vec2f = vec2f(-n.y, n.x) * side;
            let v: vec2f = tang * speed - n * (f / gl) * pull + curl(p, t) * swirl;
            p = p + v * P.dt;
            age = age - P.dt;
        }
        let fN: f32 = fieldAt(p, atm, ta, tb);
        let li: f32 = clamp(floor(fN / P.spacing + 0.5), -P.nlev, P.nlev);
        let fl: f32 = fN - li * P.spacing;
        let lum: f32 = exp(-abs(fl) / 0.0016) * exp(-abs(li) * 0.28) * bright;
        var c: vec3f = palette(wcol, p, tone, lam) * (1.0 - 0.06 * abs(li)) * tint;
        c = mix(c, spectral(lam), spec * 0.85);
        splat(p / P.scale, c, lum);
    }
    pos[i] = vec4f(p, age, seed);
}

//@pass threads_pyr_first
// Bloom level 1 from the accumulator: a 2 x 2 box, in density units.
@group(0) @binding(0) var<uniform> L: Level;
@group(0) @binding(1) var<storage, read> acc: array<u32>;
@group(0) @binding(2) var<storage, read_write> dst: array<vec4f>;
fn accAt(x: u32, y: u32) -> vec4f {
    let i: u32 = (min(y, L.h - 1u) * L.w + min(x, L.w - 1u)) * 4u;
    return vec4f(f32(acc[i]), f32(acc[i + 1u]), f32(acc[i + 2u]), f32(acc[i + 3u]));
}
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let dw: u32 = levelDim(L.w, 1u);
    let dh: u32 = levelDim(L.h, 1u);
    if (gid.x >= dw || gid.y >= dh) { return; }
    let x: u32 = gid.x * 2u;
    let y: u32 = gid.y * 2u;
    let s: vec4f = accAt(x, y) + accAt(x + 1u, y) + accAt(x, y + 1u) + accAt(x + 1u, y + 1u);
    dst[gid.y * dw + gid.x] = s * (0.25 * L.inv);
}

//@pass threads_pyr_next
// Bloom level L.level from level L.level - 1, which lives in the other buffer.
@group(0) @binding(0) var<uniform> L: Level;
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> dst: array<vec4f>;
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let l: u32 = L.level;
    let dw: u32 = levelDim(L.w, l);
    let dh: u32 = levelDim(L.h, l);
    if (gid.x >= dw || gid.y >= dh) { return; }
    let sw: u32 = levelDim(L.w, l - 1u);
    let sh: u32 = levelDim(L.h, l - 1u);
    let sb: u32 = levelBase(L.w, L.h, l - 1u);
    let x0: u32 = min(gid.x * 2u, sw - 1u);
    let x1: u32 = min(gid.x * 2u + 1u, sw - 1u);
    let y0: u32 = min(gid.y * 2u, sh - 1u);
    let y1: u32 = min(gid.y * 2u + 1u, sh - 1u);
    let s: vec4f = src[sb + y0 * sw + x0] + src[sb + y0 * sw + x1] + src[sb + y1 * sw + x0] + src[sb + y1 * sw + x1];
    dst[levelBase(L.w, L.h, l) + gid.y * dw + gid.x] = s * 0.25;
}

//@pass threads_finish
// Log-density tone, chromatic fringe, seven-level bloom, the opening line,
// grain and vignette, packed to RGBA8.
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> acc: array<u32>;
@group(0) @binding(2) var<storage, read> pa: array<vec4f>;
@group(0) @binding(3) var<storage, read> pb: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> frame: array<u32>;
fn texel(l: u32, base: u32, lw: u32, x: u32, y: u32) -> vec4f {
    if (l == 0u) {
        let i: u32 = (y * P.w + x) * 4u;
        return vec4f(f32(acc[i]), f32(acc[i + 1u]), f32(acc[i + 2u]), f32(acc[i + 3u])) / P.fxs;
    }
    if (l % 2u == 1u) { return pa[base + y * lw + x]; }
    return pb[base + y * lw + x];
}
fn bilin(l: u32, u: vec2f) -> vec4f {
    let lw: u32 = levelDim(P.w, l);
    let lh: u32 = levelDim(P.h, l);
    let base: u32 = levelBase(P.w, P.h, l);
    let q: vec2f = clamp(u * vec2f(f32(lw), f32(lh)) - 0.5, vec2f(0.0), vec2f(f32(lw) - 1.0, f32(lh) - 1.0));
    let x0: u32 = u32(q.x);
    let y0: u32 = u32(q.y);
    let x1: u32 = min(x0 + 1u, lw - 1u);
    let y1: u32 = min(y0 + 1u, lh - 1u);
    let fx: f32 = q.x - f32(x0);
    let fy: f32 = q.y - f32(y0);
    let top: vec4f = mix(texel(l, base, lw, x0, y0), texel(l, base, lw, x1, y0), fx);
    let bottom: vec4f = mix(texel(l, base, lw, x0, y1), texel(l, base, lw, x1, y1), fx);
    return mix(top, bottom, fy);
}
fn tone(a: vec4f) -> vec3f {
    let hue: vec3f = a.xyz / max(a.w, 1e-6);
    let l: f32 = log(1.0 + a.w * P.expo) / log(1.0 + P.expo * 40.0);
    return hue * pow(max(l, 0.0), 0.85);
}
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    if (gid.x >= P.w || gid.y >= P.h) { return; }
    let fw: f32 = f32(P.w);
    let fh: f32 = f32(P.h);
    let uv: vec2f = (vec2f(f32(gid.x), f32(gid.y)) + 0.5) / vec2f(fw, fh);
    let d: vec2f = uv - 0.5;
    let rise: f32 = smoothstep(0.4, 3.0, P.t);
    let fall: f32 = 1.0 - smoothstep(P.dur - 5.0, P.dur - 3.6, P.t);
    let vy: f32 = max(min(rise, fall), 0.002);
    let vx: f32 = max(1.0 - smoothstep(P.dur - 3.7, P.dur - 3.1, P.t), 0.002);
    let u: vec2f = vec2f(0.5 + (uv.x - 0.5) / vx, 0.5 + (uv.y - 0.5) / vy);
    let ca: f32 = 0.0008 + 0.004 * P.spec;
    var c: vec3f = vec3f(tone(bilin(0u, u + d * ca)).x, tone(bilin(0u, u)).y, tone(bilin(0u, u - d * ca)).z);
    var b: vec3f = vec3f(0.0);
    for (var l: u32 = 1u; l < 8u; l++) {
        b = b + tone(bilin(l, u)) * (0.12 + 0.05 * f32(l));
    }
    c = c + b * 0.12;
    if (abs(u.x - 0.5) > 0.5 || abs(u.y - 0.5) > 0.5) { c = vec3f(0.0); }
    let t0: f32 = (P.t - 1.0) / 0.5;
    let t1: f32 = (P.t - P.dur + 4.2) / 0.5;
    let glow: f32 = (1.0 - smoothstep(0.0, 0.003, abs(uv.y - 0.5))) * (exp(-t0 * t0) + exp(-t1 * t1)) * 3.0;
    let t2: f32 = (P.t - P.dur + 3.2) / 0.25;
    let dotEnd: f32 = exp(-length(d * vec2f(fw / fh, 1.0)) / 0.004) * exp(-t2 * t2) * 6.0;
    c = c + vec3f(0.85, 0.95, 1.0) * (glow + dotEnd);
    c = 1.0 - exp(-c * 1.6);
    c = c + (hash2(vec2f(f32(gid.x), f32(gid.y)) + fract(P.t * 7.13) * 97.0) - 0.5) * 0.035;
    c = c * (1.0 - 0.6 * dot(d, d) * 2.0);
    c = clamp(c, vec3f(0.0), vec3f(1.0));
    let r: u32 = u32(c.x * 255.0 + 0.5);
    let g: u32 = u32(c.y * 255.0 + 0.5);
    let bl: u32 = u32(c.z * 255.0 + 0.5);
    frame[gid.y * P.w + gid.x] = r | (g << 8u) | (bl << 16u) | (255u << 24u);
}
