// Worlds: the One Step worlds as small dioramas, raymarched signed distance
// fields with sun and lamp light, soft shadows, ambient occlusion, reflections,
// fog and film tone. Web host only (web/worlds.mjs): it is a fragment pass,
// which the HLSL translator does not take. A creative module: no CPU
// reference, no certificate (docs/architecture/adr/0010-web-host.md).
//
// Layout: this shared prelude, then one "//@world <name>" section per world,
// then the "//@main" section. The host compiles prelude + one world + main,
// so each pipeline holds only the scene on screen. A world defines:
//   fn map(p: vec3f) -> vec2f                 distance, material id
//   fn material(id: f32, p: vec3f, n: vec3f) -> Mat
//   fn env() -> Env                           sun, lamp, sky, fog
//   fn sky(rd: vec3f) -> vec3f
//   fn overlay(ro: vec3f, rd: vec3f, tmax: f32, c: vec3f) -> vec3f   snow, seeds, dust

struct Uni {
    eye: vec4f,       // xyz eye, w tan(fov / 2)
    fwd: vec4f,
    right: vec4f,
    up: vec4f,
    res: vec4f,       // width, height, 1 / width, 1 / height
    time: f32, steps: f32, shadowSteps: f32, aoOn: f32,
    pick: vec4f,      // x, y in pixels, z 1 when a pick is asked for
    params: vec4f,    // world controls: x light, y fog, z motion, w unused
}
@group(0) @binding(0) var<uniform> U: Uni;
@group(0) @binding(1) var<storage, read_write> pickOut: array<f32>;

struct Mat { albedo: vec3f, rough: f32, metal: f32, emit: vec3f, }
struct Env {
    sunDir: vec3f, sunCol: vec3f,
    lampPos: vec3f, lampCol: vec3f,      // lampCol zero: no lamp
    skyAmb: vec3f, groundAmb: vec3f,
    fogCol: vec3f, fogDen: f32,
}

const PI: f32 = 3.14159265;
const FAR: f32 = 40.0;

fn T() -> f32 { return U.time * max(U.params.z, 0.0); }
fn hash11(n: f32) -> f32 { return fract(sin(n * 12.9898) * 43758.5453); }
fn hash21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn hash31(p: vec3f) -> f32 { return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453); }
fn hash33(p: vec3f) -> vec3f {
    return fract(sin(vec3f(dot(p, vec3f(127.1, 311.7, 74.7)), dot(p, vec3f(269.5, 183.3, 246.1)), dot(p, vec3f(113.5, 271.9, 124.6)))) * 43758.5453);
}
fn noise2(p: vec2f) -> f32 {
    let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2f(1.0, 0.0)), f.x), mix(hash21(i + vec2f(0.0, 1.0)), hash21(i + vec2f(1.0, 1.0)), f.x), f.y);
}
fn noise3(p: vec3f) -> f32 {
    let i = floor(p); var f = fract(p); f = f * f * (3.0 - 2.0 * f);
    let a = mix(mix(hash31(i), hash31(i + vec3f(1, 0, 0)), f.x), mix(hash31(i + vec3f(0, 1, 0)), hash31(i + vec3f(1, 1, 0)), f.x), f.y);
    let b = mix(mix(hash31(i + vec3f(0, 0, 1)), hash31(i + vec3f(1, 0, 1)), f.x), mix(hash31(i + vec3f(0, 1, 1)), hash31(i + vec3f(1, 1, 1)), f.x), f.y);
    return mix(a, b, f.z);
}
fn fbm2(p0: vec2f) -> f32 { var p = p0; var s = 0.0; var a = 0.5; for (var i = 0; i < 4; i++) { s += a * noise2(p); p = p * 2.03 + vec2f(1.7, 9.2); a *= 0.5; } return s; }
fn fbm3(p0: vec3f) -> f32 { var p = p0; var s = 0.0; var a = 0.5; for (var i = 0; i < 4; i++) { s += a * noise3(p); p = p * 2.02 + vec3f(1.7, 9.2, 3.1); a *= 0.5; } return s; }
fn rot2(a: f32) -> mat2x2f { let c = cos(a); let s = sin(a); return mat2x2f(c, s, -s, c); }

fn sdSphere(p: vec3f, r: f32) -> f32 { return length(p) - r; }
fn sdBox(p: vec3f, b: vec3f) -> f32 { let q = abs(p) - b; return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0); }
fn sdRoundBox(p: vec3f, b: vec3f, r: f32) -> f32 { return sdBox(p, b - vec3f(r)) - r; }
fn sdCapsule(p: vec3f, a: vec3f, b: vec3f, r: f32) -> f32 {
    let pa = p - a; let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}
fn sdCylY(p: vec3f, r: f32, h: f32) -> f32 { let d = vec2f(length(p.xz) - r, abs(p.y) - h); return min(max(d.x, d.y), 0.0) + length(max(d, vec2f(0.0))); }
fn sdTorus(p: vec3f, R: f32, r: f32) -> f32 { return length(vec2f(length(p.xz) - R, p.y)) - r; }
fn sdEllipsoid(p: vec3f, r: vec3f) -> f32 { let k0 = length(p / r); let k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
fn smin(a: f32, b: f32, k: f32) -> f32 { let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
fn opU(a: vec2f, b: vec2f) -> vec2f { return select(b, a, a.x < b.x); }
// The diorama's ground: a disc of radius r with a softened rim, top at y = 0.
fn plinth(p: vec3f, r: f32) -> f32 { return sdCylY(p + vec3f(0.0, 0.25, 0.0), r - 0.05, 0.2) - 0.05; }
fn thermal(x: f32) -> vec3f { let t = clamp(x, 0.0, 1.0); return clamp(vec3f(3.0 * t - 0.8, 3.0 * t - 1.6, 1.5 - abs(4.0 * t - 1.5)), vec3f(0.0), vec3f(1.0)) + vec3f(0.05 * (1.0 - t), 0.0, 0.1 * (1.0 - t)); }
fn mat(albedo: vec3f, rough: f32) -> Mat { return Mat(albedo, rough, 0.0, vec3f(0.0)); }
// Drifting points of light along a ray: snow, seeds, dust. Several depth
// slices, each a jittered grid that moves with `drift`.
fn motes(ro: vec3f, rd: vec3f, tmax: f32, cell: f32, drift: vec3f, size: f32, layers: i32) -> f32 {
    var acc = 0.0;
    for (var k = 0; k < layers; k++) {
        let t = 0.6 + f32(k) * cell * 1.3 + hash11(f32(k)) * cell;
        if (t > tmax) { break; }
        let p = ro + rd * t + drift;
        let id = floor(p / cell);
        let c = (id + 0.2 + 0.6 * hash33(id)) * cell;
        let q = ro + rd * t + drift - c;
        let d = length(q - rd * dot(q, rd));
        acc += smoothstep(size, 0.0, d) * step(0.35, hash31(id + 7.0)) * (1.0 - t / FAR);
    }
    return acc;
}

//@world eye
// VI. The eye: an eye in a stone triangle over still black water. It looks at you.
const EYE_C: vec3f = vec3f(0.0, 1.25, 0.0);
fn lookDir() -> vec3f {
    let toCam = normalize(U.eye.xyz - EYE_C);
    let wander = vec3f(0.12 * sin(T() * 0.7), 0.06 * cos(T() * 0.5), 0.0);
    return normalize(toCam + wander);
}
fn lidOpen() -> f32 {
    let b = fract(T() / 6.5);
    return 1.0 - smoothstep(0.0, 0.03, b) * (1.0 - smoothstep(0.03, 0.07, b));
}
fn map(p: vec3f) -> vec2f {
    var r = vec2f(p.y + 0.02 * sin(p.x * 3.0 + T() * 0.6) * sin(p.z * 2.5 - T() * 0.4) * 0.3, 1.0);   // water
    // the triangle: three stone beams in the plane z = 0
    let a = vec3f(0.0, 2.55, 0.0); let b = vec3f(-1.5, 0.05, 0.0); let c = vec3f(1.5, 0.05, 0.0);
    let tri = min(min(sdCapsule(p, a, b, 0.07), sdCapsule(p, b, c, 0.07)), sdCapsule(p, c, a, 0.07));
    r = opU(r, vec2f(tri, 2.0));
    // the eyeball, with lids that blink
    let q = p - EYE_C;
    r = opU(r, vec2f(sdSphere(q, 0.42), 3.0));
    let open = 0.32 * lidOpen() + 0.02;
    let shell = abs(sdSphere(q, 0.47)) - 0.035;
    let lids = max(shell, open - abs(q.y + 0.18 * q.x * q.x));
    let almond = max(lids, -(q.z + 0.1));
    r = opU(r, vec2f(max(almond, length(q.xy * vec2f(0.75, 1.0)) - 0.62), 4.0));
    // stepping stones toward it
    for (var k = 0; k < 4; k++) {
        let fk = f32(k);
        let sp = vec3f(0.3 * sin(fk * 2.1), -0.06, 1.0 + fk * 0.55);
        r = opU(r, vec2f(sdEllipsoid(p - sp, vec3f(0.2, 0.08, 0.16)), 5.0));
    }
    return r;
}
fn material(id: f32, p: vec3f, n: vec3f) -> Mat {
    if (id < 1.5) { return Mat(vec3f(0.01, 0.012, 0.02), 0.05, 0.6, vec3f(0.0)); }
    if (id < 2.5) {
        let g = fbm3(p * 9.0);
        var m = mat(vec3f(0.32, 0.27, 0.22) * (0.6 + 0.6 * g), 0.8);
        // a gold inlay on the face of each beam
        m.emit = vec3f(1.0, 0.62, 0.25) * 0.9 * smoothstep(0.02, 0.0, abs(p.z + 0.06) - 0.004) * (0.6 + 0.4 * sin(T() * 0.8 + p.y * 3.0));
        return m;
    }
    if (id < 3.5) {
        let q = normalize(p - EYE_C);
        let l = lookDir();
        let c = dot(q, l);
        let ang = atan2(dot(q, cross(l, vec3f(0, 1, 0))), q.y);
        let r = sqrt(max(0.0, 1.0 - c * c));
        if (c > 0.0 && r < 0.42) {
            if (r < 0.16) { return Mat(vec3f(0.0), 0.1, 0.0, vec3f(0.0)); }
            let lines = pow(1.0 - abs(sin(ang * 90.0 + fbm2(vec2f(ang * 4.0, r * 20.0)) * 3.0)), 10.0);
            let iris = thermal((r - 0.16) / 0.3 + 0.25 * fbm2(vec2f(ang * 6.0, r * 30.0)));
            return Mat(iris * 0.3, 0.3, 0.0, iris * vec3f(1.0, 0.5, 0.45) * (0.2 + 1.8 * lines));
        }
        let veins = 1.0 - smoothstep(0.0, 0.08, abs(fract(fbm3(q * 6.0) * 6.0) - 0.5));
        return mat(mix(vec3f(0.85, 0.82, 0.78), vec3f(0.6, 0.08, 0.1), veins * 0.35), 0.25);
    }
    if (id < 4.5) { return mat(vec3f(0.35, 0.18, 0.15) * (0.7 + 0.3 * fbm3(p * 30.0)), 0.6); }
    return mat(vec3f(0.08, 0.08, 0.09), 0.9);
}
fn env() -> Env {
    return Env(normalize(vec3f(-0.4, 0.5, -0.7)), vec3f(0.5, 0.42, 0.55),
               EYE_C + vec3f(0.0, 0.0, 0.9), vec3f(1.0, 0.55, 0.3) * 0.8,
               vec3f(0.05, 0.03, 0.08), vec3f(0.01, 0.01, 0.015),
               vec3f(0.03, 0.015, 0.04), 0.035);
}
fn sky(rd: vec3f) -> vec3f {
    let a = atan2(rd.x, rd.z);
    let rays = pow(abs(sin(a * 24.0)), 30.0) * smoothstep(0.0, 0.5, rd.y) * 0.15;
    return mix(vec3f(0.03, 0.015, 0.04), vec3f(0.08, 0.04, 0.1), smoothstep(-0.1, 0.6, rd.y)) + vec3f(1.0, 0.6, 0.3) * rays;
}
fn overlay(ro: vec3f, rd: vec3f, tmax: f32, c: vec3f) -> vec3f {
    return c + vec3f(1.0, 0.7, 0.4) * motes(ro, rd, tmax, 0.6, vec3f(0.0, T() * 0.05, 0.0), 0.006, 10) * 0.6;
}

//@world swing
// XIII. The swing: a child's swing under a street lamp, at night, in falling snow.
fn swingAngle() -> f32 { return 0.45 * sin(T() * 1.4); }
fn map(p: vec3f) -> vec2f {
    let snow = fbm2(p.xz * 2.0) * 0.06 + 0.02 * sin(p.x * 4.0 + p.z * 3.0);
    var r = vec2f(max(plinth(p, 3.4), p.y - snow), 1.0);
    // the frame: two A-legs and a top bar
    let top = 1.9;
    var f = sdCapsule(p, vec3f(-1.0, top, 0.0), vec3f(1.0, top, 0.0), 0.045);
    for (var s = -1.0; s <= 1.0; s += 2.0) {
        f = min(f, sdCapsule(p, vec3f(s, top, 0.0), vec3f(s * 1.15, 0.0, 0.45), 0.04));
        f = min(f, sdCapsule(p, vec3f(s, top, 0.0), vec3f(s * 1.15, 0.0, -0.45), 0.04));
    }
    r = opU(r, vec2f(f, 2.0));
    // ropes and seat, swinging about the bar
    let a = swingAngle();
    var q = p - vec3f(0.0, top, 0.0);
    let qyz = rot2(a) * q.yz; q = vec3f(q.x, qyz.x, qyz.y);
    var ropes = min(sdCapsule(q, vec3f(-0.28, 0.0, 0.0), vec3f(-0.28, -1.35, 0.0), 0.012), sdCapsule(q, vec3f(0.28, 0.0, 0.0), vec3f(0.28, -1.35, 0.0), 0.012));
    r = opU(r, vec2f(ropes, 3.0));
    r = opU(r, vec2f(sdRoundBox(q - vec3f(0.0, -1.38, 0.0), vec3f(0.34, 0.025, 0.12), 0.01), 2.0));
    // a small figure on the seat
    let b = q - vec3f(0.0, -1.38, 0.0);
    var fig = sdSphere(b - vec3f(0.0, 0.55, 0.0), 0.09);
    fig = smin(fig, sdCapsule(b, vec3f(0.0, 0.08, 0.0), vec3f(0.0, 0.42, 0.0), 0.075), 0.05);
    fig = min(fig, sdCapsule(b, vec3f(-0.08, 0.05, 0.0), vec3f(-0.08, 0.02, 0.22), 0.04));
    fig = min(fig, sdCapsule(b, vec3f(0.08, 0.05, 0.0), vec3f(0.08, 0.02, 0.22), 0.04));
    fig = min(fig, sdCapsule(b, vec3f(-0.08, 0.02, 0.22), vec3f(-0.08, -0.3, 0.26), 0.035));
    fig = min(fig, sdCapsule(b, vec3f(0.08, 0.02, 0.22), vec3f(0.08, -0.3, 0.26), 0.035));
    fig = min(fig, sdCapsule(b, vec3f(-0.12, 0.38, 0.0), vec3f(-0.27, 0.6, 0.0), 0.03));
    fig = min(fig, sdCapsule(b, vec3f(0.12, 0.38, 0.0), vec3f(0.27, 0.6, 0.0), 0.03));
    r = opU(r, vec2f(fig, 4.0));
    // the lamp: post, arm, hood and its bulb
    let lp = p - vec3f(1.9, 0.0, -0.9);
    var lamp = sdCylY(lp - vec3f(0.0, 1.4, 0.0), 0.04, 1.4);
    lamp = min(lamp, sdCapsule(lp, vec3f(0.0, 2.75, 0.0), vec3f(-0.45, 2.85, 0.0), 0.025));
    lamp = min(lamp, max(sdSphere(lp - vec3f(-0.5, 2.8, 0.0), 0.16), -(lp.y - 2.78)));
    r = opU(r, vec2f(lamp, 5.0));
    r = opU(r, vec2f(sdSphere(lp - vec3f(-0.5, 2.76, 0.0), 0.06), 6.0));
    return r;
}
fn material(id: f32, p: vec3f, n: vec3f) -> Mat {
    if (id < 1.5) { return mat(vec3f(0.85, 0.88, 0.95) * (0.92 + 0.08 * noise3(p * 40.0)), 0.7); }
    if (id < 2.5) { return mat(vec3f(0.28, 0.18, 0.11) * (0.7 + 0.5 * fbm3(p * vec3f(30.0, 3.0, 30.0))), 0.7); }
    if (id < 3.5) { return mat(vec3f(0.55, 0.5, 0.42), 0.9); }
    if (id < 4.5) { return mat(vec3f(0.62, 0.12, 0.08), 0.6); }
    if (id < 5.5) { return Mat(vec3f(0.08), 0.35, 0.8, vec3f(0.0)); }
    return Mat(vec3f(1.0), 0.2, 0.0, vec3f(4.0, 3.0, 1.8));
}
fn env() -> Env {
    return Env(normalize(vec3f(0.3, 0.6, 0.5)), vec3f(0.06, 0.08, 0.14),
               vec3f(1.4, 2.65, -0.9), vec3f(1.0, 0.72, 0.42) * 3.2,
               vec3f(0.05, 0.07, 0.12), vec3f(0.08, 0.08, 0.1),
               vec3f(0.05, 0.06, 0.09), 0.06);
}
fn sky(rd: vec3f) -> vec3f { return mix(vec3f(0.03, 0.04, 0.07), vec3f(0.01, 0.015, 0.03), smoothstep(0.0, 0.8, rd.y)); }
fn overlay(ro: vec3f, rd: vec3f, tmax: f32, c: vec3f) -> vec3f {
    let fall = vec3f(0.15 * sin(T() * 0.3), T() * 0.35, 0.05 * T());
    let s = motes(ro, rd, tmax, 0.35, fall, 0.008, 16);
    // flakes near the lamp catch its light
    return c + s * vec3f(0.8, 0.85, 0.95) * 0.9;
}

//@world forest
// XIV. The forest: an alder log on the forest floor, saplings rising from it,
// cottonwood seeds drifting through slanted light.
fn logY(x: f32) -> f32 { return 0.32 + 0.03 * sin(x * 2.0); }
fn sapling(k: i32) -> vec2f {   // x position, grown height
    let fk = f32(k);
    let h = 0.75 * smoothstep(1.0 + fk * 1.2, 9.0 + fk * 1.4, T() + 4.0 * max(U.params.w, 0.0));
    return vec2f(-0.9 + fk * 0.45, h);
}
fn map(p: vec3f) -> vec2f {
    let ground = p.y - 0.05 * fbm2(p.xz * 1.5);
    var r = vec2f(max(plinth(p, 3.6), ground), 1.0);
    // the log, lying along x, with bark ridges
    let bark = 0.006 * sin(atan2(p.y - logY(p.x), p.z) * 26.0 + fbm2(p.xy * 6.0) * 5.0) + 0.012 * fbm3(p * 9.0);
    let lg = sdCapsule(p, vec3f(-1.7, logY(-1.7), 0.0), vec3f(1.7, logY(1.7), 0.0), 0.3) + bark;
    r = opU(r, vec2f(lg, 2.0));
    // saplings: thin stems with a pair of leaves at the tip
    for (var k = 0; k < 5; k++) {
        let s = sapling(k);
        if (s.y < 0.02) { continue; }
        let base = vec3f(s.x, logY(s.x) + 0.27, 0.0);
        let tip = base + vec3f(0.03 * sin(T() * 0.8 + f32(k)), s.y, 0.0);
        r = opU(r, vec2f(sdCapsule(p, base, tip, 0.012), 3.0));
        let lp = p - tip;
        let leaf1 = sdEllipsoid(lp - vec3f(0.06, -0.02, 0.0), vec3f(0.07, 0.012, 0.035) * min(1.0, s.y * 3.0));
        let leaf2 = sdEllipsoid(lp - vec3f(-0.06, -0.04, 0.02), vec3f(0.06, 0.012, 0.03) * min(1.0, s.y * 3.0));
        r = opU(r, vec2f(min(leaf1, leaf2), 4.0));
    }
    // standing trunks at the edge of the clearing
    var trunks = 1e3;
    for (var k = 0; k < 9; k++) {
        let a = f32(k) * 0.7 + 2.6 + 0.3 * hash11(f32(k) + 9.0);
        let c = vec2f(cos(a), sin(a)) * (3.0 + 0.35 * hash11(f32(k)));
        let q = p - vec3f(c.x, 0.0, c.y);
        let lean = vec2f(0.04 * sin(q.y * 1.3 + f32(k)), 0.03 * cos(q.y * 0.9 + f32(k)));
        trunks = min(trunks, sdCylY(q - vec3f(lean.x, 3.0, lean.y), 0.06 + 0.03 * hash11(f32(k) + 3.0) - q.y * 0.004, 3.0));
    }
    // shelf fungi on the log's flank and two stones
    for (var k = 0; k < 3; k++) {
        let fx = -1.1 + f32(k) * 0.9;
        let c = vec3f(fx, logY(fx) + 0.05 + 0.04 * f32(k), 0.29);
        r = opU(r, vec2f(sdEllipsoid(p - c, vec3f(0.09, 0.022, 0.07)), 6.0));
    }
    r = opU(r, vec2f(sdEllipsoid(p - vec3f(1.2, 0.02, 0.9), vec3f(0.22, 0.12, 0.17)), 7.0));
    r = opU(r, vec2f(sdEllipsoid(p - vec3f(-1.4, 0.0, -0.8), vec3f(0.16, 0.09, 0.2)), 7.0));
    r = opU(r, vec2f(trunks, 5.0));
    return r;
}
fn material(id: f32, p: vec3f, n: vec3f) -> Mat {
    if (id < 1.5) {
        let leaves = fbm2(p.xz * 8.0);
        let litter = smoothstep(0.55, 0.9, fbm2(p.xz * 18.0)) * 0.3;
        var c = mix(vec3f(0.07, 0.055, 0.035), vec3f(0.22, 0.13, 0.06), leaves);
        c = mix(c, vec3f(0.42, 0.24, 0.08), litter);
        c = mix(c, vec3f(0.1, 0.18, 0.05), smoothstep(0.55, 0.75, fbm2(p.xz * 2.0)));
        return mat(c, 0.9);
    }
    if (id < 2.5) {
        let up = (p.y - logY(p.x)) / 0.3;
        let moss = smoothstep(0.35, 0.75, up + 0.5 * fbm3(p * 4.0) - 0.25);
        let barkCol = vec3f(0.2, 0.15, 0.11) * (0.5 + 0.7 * fbm3(p * vec3f(6.0, 30.0, 30.0)));
        return mat(mix(barkCol, vec3f(0.16, 0.3, 0.07) * (0.7 + 0.5 * noise3(p * 40.0)), moss), 0.85);
    }
    if (id < 3.5) { return mat(vec3f(0.3, 0.25, 0.12), 0.7); }
    if (id < 4.5) { return Mat(vec3f(0.2, 0.5, 0.12), 0.5, 0.0, vec3f(0.02, 0.06, 0.01)); }
    if (id < 5.5) { return mat(vec3f(0.16, 0.14, 0.12) * (0.6 + 0.6 * fbm3(p * vec3f(20.0, 2.0, 20.0))), 0.9); }
    if (id < 6.5) { return mat(vec3f(0.75, 0.55, 0.3) * (0.8 + 0.2 * sin(length(p.xz) * 120.0)), 0.6); }
    return mat(vec3f(0.3, 0.3, 0.28) * (0.6 + 0.5 * fbm3(p * 12.0)), 0.8);
}
fn env() -> Env {
    return Env(normalize(vec3f(0.55, 0.62, 0.3)), vec3f(2.0, 1.6, 0.95),
               vec3f(0.0), vec3f(0.0),
               vec3f(0.1, 0.15, 0.12), vec3f(0.06, 0.05, 0.03),
               vec3f(0.12, 0.15, 0.1), 0.09);
}
fn sky(rd: vec3f) -> vec3f {
    let canopy = smoothstep(0.35, 0.7, fbm2(rd.xz / max(rd.y, 0.05) * 1.5));
    return mix(vec3f(0.14, 0.17, 0.11), mix(vec3f(0.9, 0.85, 0.6), vec3f(0.05, 0.09, 0.04), canopy), smoothstep(0.05, 0.6, rd.y));
}
fn overlay(ro: vec3f, rd: vec3f, tmax: f32, c: vec3f) -> vec3f {
    let wind = vec3f(-T() * 0.12, -T() * 0.04 + 0.05 * sin(T() * 0.5), T() * 0.03);
    let seeds = motes(ro, rd, tmax, 1.1, wind, 0.03, 7);
    let beams = pow(max(dot(rd, env().sunDir), 0.0), 3.0) * smoothstep(0.3, 0.7, fbm2(rd.xz * 9.0 + vec2f(T() * 0.02, 0.0))) * 0.18;
    return c + seeds * vec3f(1.0, 0.95, 0.82) * 0.55 + vec3f(1.0, 0.85, 0.5) * beams * min(tmax, 6.0) / 6.0;
}

//@main
fn calcNormal(p: vec3f, t: f32) -> vec3f {
    let e = max(0.0005, 0.0006 * t);
    let k = vec2f(1.0, -1.0);
    return normalize(k.xyy * map(p + k.xyy * e).x + k.yyx * map(p + k.yyx * e).x + k.yxy * map(p + k.yxy * e).x + k.xxx * map(p + k.xxx * e).x);
}
fn softShadow(ro: vec3f, rd: vec3f, tmax: f32) -> f32 {
    // Penumbra estimate after Quilez, with a jittered start so the step
    // pattern turns into fine grain instead of rings.
    var res = 1.0;
    var t = 0.015 + 0.02 * hash31(ro * 97.0 + fract(U.time));
    var ph = 1e10;
    let n = i32(U.shadowSteps);
    for (var i = 0; i < n; i++) {
        let h = map(ro + rd * t).x;
        let y = h * h / (2.0 * ph);
        let d = sqrt(max(h * h - y * y, 0.0));
        res = min(res, 8.0 * d / max(0.0001, t - y));
        ph = h;
        t += clamp(h, 0.01, 0.2);
        if (res < 0.002 || t > tmax) { break; }
    }
    res = clamp(res, 0.0, 1.0);
    return res * res * (3.0 - 2.0 * res);
}
fn ambientOcclusion(p: vec3f, n: vec3f) -> f32 {
    if (U.aoOn < 0.5) { return 1.0; }
    var occ = 0.0; var w = 1.0;
    for (var i = 1; i <= 5; i++) {
        let h = 0.03 + 0.09 * f32(i);
        occ += (h - map(p + n * h).x) * w;
        w *= 0.7;
    }
    return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}
fn march(ro: vec3f, rd: vec3f, steps: i32, far: f32) -> vec2f {
    var t = 0.01; var id = -1.0;
    for (var i = 0; i < steps; i++) {
        let h = map(ro + rd * t);
        if (h.x < 0.0004 * t) { id = h.y; break; }
        t += h.x * 0.9;
        if (t > far) { break; }
    }
    return vec2f(t, id);
}
// One light's contribution: Lambert plus a normalized Blinn lobe.
fn light(m: Mat, n: vec3f, v: vec3f, l: vec3f, col: vec3f) -> vec3f {
    let nl = max(dot(n, l), 0.0);
    let h = normalize(l + v);
    let sh = pow(max(dot(n, h), 0.0), mix(256.0, 4.0, m.rough));
    let spec = mix(vec3f(0.04), m.albedo, m.metal) * sh * (1.0 - m.rough * 0.7) * 2.0;
    return col * nl * (m.albedo * (1.0 - m.metal) + spec);
}
fn shade(ro: vec3f, rd: vec3f, t: f32, id: f32, depth: i32) -> vec3f {
    let e = env();
    let p = ro + rd * t;
    let n = calcNormal(p, t);
    let m = material(id, p, n);
    let v = -rd;
    let ao = ambientOcclusion(p, n);
    let gain = max(U.params.x, 0.0);
    var c = m.emit;
    let sh = softShadow(p + n * 0.008, e.sunDir, 12.0);
    c += light(m, n, v, e.sunDir, e.sunCol * gain) * sh;
    if (dot(e.lampCol, e.lampCol) > 0.0) {
        let lv = e.lampPos - p;
        let d = length(lv);
        let l = lv / d;
        let lsh = softShadow(p + n * 0.008, l, d - 0.1);
        c += light(m, n, v, l, e.lampCol * gain / (1.0 + d * d)) * lsh;
    }
    let amb = mix(e.groundAmb, e.skyAmb, 0.5 + 0.5 * n.y);
    c += m.albedo * (1.0 - m.metal * 0.8) * amb * ao;
    if (m.metal > 0.01 && depth == 0) {
        let r = reflect(rd, n);
        let hit = march(p + n * 0.01, r, 48, 12.0);
        var rc = sky(r);
        if (hit.y >= 0.0) {
            let q = p + r * hit.x;
            let mm = material(hit.y, q, vec3f(0.0, 1.0, 0.0));
            rc = mm.emit + mm.albedo * (amb + e.sunCol * 0.3);
        }
        let fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        c += rc * mix(fres, 1.0, m.metal * (1.0 - m.rough)) * mix(vec3f(1.0), m.albedo + 0.2, 0.3) * ao;
    }
    return c;
}
fn aces(x: vec3f) -> vec3f { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
    return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
@fragment fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
    let uv = vec2f(frag.x * U.res.z * 2.0 - 1.0, 1.0 - frag.y * U.res.w * 2.0);
    let aspect = U.res.x * U.res.w;
    let ro = U.eye.xyz;
    let rd = normalize(U.fwd.xyz + (U.right.xyz * uv.x * aspect + U.up.xyz * uv.y) * U.eye.w);
    let e = env();
    let hit = march(ro, rd, i32(U.steps), FAR);
    var c = sky(rd);
    var t = FAR;
    if (hit.y >= 0.0) {
        t = hit.x;
        c = shade(ro, rd, t, hit.y, 0);
    }
    // fog with in-scattered sun
    let fogAmt = 1.0 - exp(-t * e.fogDen * max(U.params.y, 0.0));
    let scatter = pow(max(dot(rd, e.sunDir), 0.0), 8.0);
    c = mix(c, e.fogCol + e.sunCol * scatter * 0.25, fogAmt);
    c = overlay(ro, rd, t, c);
    if (U.pick.z > 0.5 && abs(frag.x - U.pick.x) < 0.5 && abs(frag.y - U.pick.y) < 0.5) {
        pickOut[0] = select(-1.0, t, hit.y >= 0.0);
    }
    c = aces(c * 1.1);
    c = pow(c, vec3f(1.0 / 2.2));
    let d = uv * vec2f(aspect, 1.0) * 0.5;
    c *= 1.0 - 0.25 * dot(d, d);
    c += (hash21(frag.xy + fract(U.time * 7.13) * 97.0) - 0.5) * 0.015;
    return vec4f(clamp(c, vec3f(0.0), vec3f(1.0)), 1.0);
}
