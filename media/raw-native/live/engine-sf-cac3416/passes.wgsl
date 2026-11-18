//@pass setup
// Triangle setup (src/renderer/raster.cpp, the per-triangle half): clip space, perspective
// divide, screen mapping, bounds and signed area. One invocation per triangle.
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> tris: array<f32>;
@group(0) @binding(2) var<storage, read_write> setupF: array<f32>;
@group(0) @binding(3) var<storage, read_write> setupI: array<i32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let t: u32 = gid.x;
    if (t >= P.ntri) { return; }
    let b: u32 = t * TRI_STRIDE;
    let o: u32 = t * SETUP_STRIDE;
    setupF[o] = 0.0;
    var sx: array<f32, 3>; var sy: array<f32, 3>; var sz: array<f32, 3>; var iw: array<f32, 3>;
    for (var k: u32 = 0u; k < 3u; k++) {
        let wp: vec4f = vec4f(tris[b + 3u * k], tris[b + 3u * k + 1u], tris[b + 3u * k + 2u], 1.0);
        let cs: vec4f = mmul(P.vp, wp);
        if (cs.w <= 1e-6) { return; }
        let inv: f32 = 1.0 / cs.w;
        let nx: f32 = cs.x * inv;
        let ny: f32 = cs.y * inv;
        sx[k] = (nx * 0.5 + 0.5) * f32(P.w);
        sy[k] = (1.0 - (ny * 0.5 + 0.5)) * f32(P.h);
        sz[k] = cs.w;
        iw[k] = inv;
    }
    let area: f32 = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sy[1] - sy[0]) * (sx[2] - sx[0]);
    if (abs(area) < 1e-9) { return; }
    for (var j: u32 = 0u; j < 3u; j++) {
        setupF[o + 1u + j] = sx[j]; setupF[o + 4u + j] = sy[j];
        setupF[o + 7u + j] = sz[j]; setupF[o + 10u + j] = iw[j];
    }
    setupF[o + 13u] = area;
    let oi: u32 = t * 4u;
    setupI[oi]      = max(0, i32(floor(min(min(sx[0], sx[1]), sx[2]))));
    setupI[oi + 1u] = min(i32(P.w) - 1, i32(ceil(max(max(sx[0], sx[1]), sx[2]))));
    setupI[oi + 2u] = max(0, i32(floor(min(min(sy[0], sy[1]), sy[2]))));
    setupI[oi + 3u] = min(i32(P.h) - 1, i32(ceil(max(max(sy[0], sy[1]), sy[2]))));
    setupF[o] = 1.0;
}

//@pass raster
// Rasterization (src/renderer/raster.cpp, the per-pixel half): every triangle in scene
// order, the same edge functions, the same strict depth test, perspective-correct
// position and normal. One invocation per pixel, so no atomics are needed and
// draw order is the CPU's.
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> tris: array<f32>;
@group(0) @binding(2) var<storage, read> setupF: array<f32>;
@group(0) @binding(3) var<storage, read> setupI: array<i32>;
@group(0) @binding(4) var<storage, read_write> depth: array<f32>;
@group(0) @binding(5) var<storage, read_write> position: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> normal: array<vec4f>;
@group(0) @binding(7) var<storage, read_write> albedoMask: array<vec4f>;   // xyz albedo, w mask

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    if (gid.x >= P.w || gid.y >= P.h) { return; }
    let x: i32 = i32(gid.x); let y: i32 = i32(gid.y);
    var best: f32 = 0x1.fffffep+127f;  // largest f32; WGSL has no infinity. The host writes +inf for uncovered pixels.
    var pos: vec3f = vec3f(0.0); var nrm: vec3f = vec3f(0.0); var alb: vec3f = vec3f(0.0); var covered: f32 = 0.0;
    let px: f32 = f32(x) + 0.5; let py: f32 = f32(y) + 0.5;
    for (var t: u32 = 0u; t < P.ntri; t++) {
        let o: u32 = t * SETUP_STRIDE;
        if (setupF[o] == 0.0) { continue; }
        let oi: u32 = t * 4u;
        if (x < setupI[oi] || x > setupI[oi + 1u] || y < setupI[oi + 2u] || y > setupI[oi + 3u]) { continue; }
        let s0: vec2f = vec2f(setupF[o + 1u], setupF[o + 4u]);
        let s1: vec2f = vec2f(setupF[o + 2u], setupF[o + 5u]);
        let s2: vec2f = vec2f(setupF[o + 3u], setupF[o + 6u]);
        let area: f32 = setupF[o + 13u];
        let w0: f32 = ((s1.x - px) * (s2.y - py) - (s1.y - py) * (s2.x - px)) / area;
        let w1: f32 = ((s2.x - px) * (s0.y - py) - (s2.y - py) * (s0.x - px)) / area;
        let w2: f32 = 1.0 - w0 - w1;
        if (w0 < 0.0 || w1 < 0.0 || w2 < 0.0) { continue; }
        let i0: f32 = setupF[o + 10u]; let i1: f32 = setupF[o + 11u]; let i2: f32 = setupF[o + 12u];
        let iw: f32 = w0 * i0 + w1 * i1 + w2 * i2;
        let d: f32 = w0 * setupF[o + 7u] + w1 * setupF[o + 8u] + w2 * setupF[o + 9u];
        if (d >= best) { continue; }
        let b: u32 = t * TRI_STRIDE;
        var pc: array<f32, 6>;
        for (var c: u32 = 0u; c < 6u; c++) {
            // c < 3: position component c (tri floats 0..8); c >= 3: normal component c-3 (9..17)
            let base: u32 = select(b + 9u + (c - 3u), b + c, c < 3u);
            pc[c] = (w0 * tris[base] * i0 + w1 * tris[base + 3u] * i1 + w2 * tris[base + 6u] * i2) / iw;
        }
        best = d;
        pos = vec3f(pc[0], pc[1], pc[2]);
        nrm = vnorm(vec3f(pc[3], pc[4], pc[5]));
        alb = vec3f(tris[b + 18u], tris[b + 19u], tris[b + 20u]);
        covered = 1.0;
    }
    let i: u32 = pix(gid.x, gid.y);
    depth[i] = best;
    position[i] = vec4f(pos, 0.0);
    normal[i] = vec4f(nrm, 0.0);
    albedoMask[i] = vec4f(alb, covered);
}

//@pass motion
// Motion vectors by reprojection (src/renderer/motion.cpp). w of the output is 1 for a
// valid vector, 0 otherwise; the host counts them.
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> position: array<vec4f>;
@group(0) @binding(2) var<storage, read> albedoMask: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> motion: array<vec4f>;

fn uvOf(m: array<vec4f, 4>, wp: vec3f, ok: ptr<function, bool>) -> vec2f {
    let cs: vec4f = mmul(m, vec4f(wp, 1.0));
    if (cs.w <= 1e-6) { *ok = false; return vec2f(0.0); }
    let inv: f32 = 1.0 / cs.w;
    return vec2f(cs.x * inv * 0.5 + 0.5, 1.0 - (cs.y * inv * 0.5 + 0.5));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    if (gid.x >= P.w || gid.y >= P.h) { return; }
    let i: u32 = pix(gid.x, gid.y);
    motion[i] = vec4f(0.0);
    if (albedoMask[i].w == 0.0) { return; }
    let wp: vec3f = position[i].xyz;
    var ok: bool = true;
    let cur: vec2f = uvOf(P.vp, wp, &ok);
    if (!ok) { return; }
    let prev: vec2f = uvOf(P.pvp, wp, &ok);
    if (!ok) { return; }
    let mv: vec2f = cur - prev;
    if (!(abs(mv.x) <= 0x1.fffffep+127f) || !(abs(mv.y) <= 0x1.fffffep+127f)) { return; }
    motion[i] = vec4f(mv, 0.0, 1.0);
}

//@pass ssao
// Screen-space AO (src/renderer/ssao.cpp).
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> position: array<vec4f>;
@group(0) @binding(2) var<storage, read> normal: array<vec4f>;
@group(0) @binding(3) var<storage, read> albedoMask: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> aoSS: array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    if (gid.x >= P.w || gid.y >= P.h) { return; }
    let i: u32 = pix(gid.x, gid.y);
    if (albedoMask[i].w == 0.0) { aoSS[i] = 1.0; return; }
    let p: vec3f = position[i].xyz;
    let n: vec3f = normal[i].xyz;
    let R: f32 = P.misc.y;
    var occ: i32 = 0; var used: i32 = 0;
    for (var s: u32 = 0u; s < P.ss_samples; s++) {
        let a: f32 = hash01(gid.x, gid.y, s) * 6.2831853;
        let rad: f32 = (0.3 + 0.7 * hash01(gid.x, gid.y, s + 97u)) * R;
        let sx: i32 = i32(gid.x) + lround(cos(a) * rad);
        let sy: i32 = i32(gid.y) + lround(sin(a) * rad);
        if (sx < 0 || sy < 0 || sx >= i32(P.w) || sy >= i32(P.h)) { continue; }
        let j: u32 = pix(u32(sx), u32(sy));
        if (albedoMask[j].w == 0.0) { continue; }
        used++;
        let d: vec3f = position[j].xyz - p;
        let dist: f32 = vlen(d);
        if (dist < 1e-4 || dist > P.misc.x) { continue; }
        let ndl: f32 = vdot(n, vnorm(d));
        if (ndl > 0.15) { occ++; }
    }
    var v: f32 = 1.0;
    if (used > 0) { v = 1.0 - f32(occ) / f32(used); }
    aoSS[i] = select(v, 0.0, v < 0.0);
}

//@pass rtao
// Ray-traced AO reference (src/renderer/ray_ao.cpp with src/renderer/accel.cpp and the
// Moller-Trumbore test in raw/math/primitives.hpp).
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> tris: array<f32>;
@group(0) @binding(2) var<storage, read> position: array<vec4f>;
@group(0) @binding(3) var<storage, read> normal: array<vec4f>;
@group(0) @binding(4) var<storage, read> albedoMask: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> aoRT: array<f32>;
// The BVH (raw/renderer/bvh.hpp, Bvh::flatten): 8 floats a node and the triangles' positions in
// the tree's order, 9 floats each (evidence/m3-gpu-ao-bvh-bounds.json).
@group(0) @binding(6) var<storage, read> nodes: array<f32>;
@group(0) @binding(7) var<storage, read> btris: array<f32>;
// Lighting model 2 (evidence/m3-lighting-v2-bounds.json), when P.misc.z is 2: aoRT holds three planes
// of w x h floats, the AO, then the sky (the fraction of the samples with no hit at any distance),
// then the sun (1 when the ray towards the light hits nothing). The read-back takes the first plane.

fn triVert(t: u32, k: u32) -> vec3f {
    let b: u32 = t * TRI_STRIDE + 3u * k;
    return vec3f(tris[b], tris[b + 1u], tris[b + 2u]);
}
// Watertight ray-triangle intersection (Woop, Benthin and Wald, JCGT 2013) by the operations of
// raw/math/primitives.hpp: the ray's frame (largest |d| as z, x and y swapped when it is negative),
// then the signs of the three sheared 2D edge functions. x t, y u, z v, w 1 on a hit (t > 1e-4).
fn wt_frame(v: vec3f, kz: u32, sw: bool) -> vec3f {
    var p: vec3f = v;
    if (kz == 0u) { p = vec3f(v.y, v.z, v.x); }
    if (kz == 1u) { p = vec3f(v.z, v.x, v.y); }
    if (sw) { p = vec3f(p.y, p.x, p.z); }
    return p;
}
fn wt_hit(o: vec3f, d: vec3f, a: vec3f, b: vec3f, c: vec3f) -> vec4f {
    let ad: vec3f = abs(d);
    var kz: u32 = 2u;
    if (ad.x > ad.y && ad.x > ad.z) { kz = 0u; }
    if (ad.x <= ad.y && ad.y > ad.z) { kz = 1u; }
    let dk: vec3f = wt_frame(d, kz, false);
    let sw: bool = dk.z < 0.0;
    let dr: vec3f = wt_frame(d, kz, sw);
    let sx: f32 = dr.x / dr.z;
    let sy: f32 = dr.y / dr.z;
    let sz: f32 = 1.0 / dr.z;
    let pa: vec3f = wt_frame(a - o, kz, sw);
    let pb: vec3f = wt_frame(b - o, kz, sw);
    let pc: vec3f = wt_frame(c - o, kz, sw);
    let ax: f32 = pa.x - sx * pa.z;
    let ay: f32 = pa.y - sy * pa.z;
    let bx: f32 = pb.x - sx * pb.z;
    let by: f32 = pb.y - sy * pb.z;
    let cx: f32 = pc.x - sx * pc.z;
    let cy: f32 = pc.y - sy * pc.z;
    let eu: f32 = cx * by - cy * bx;
    let ev: f32 = ax * cy - ay * cx;
    let ew: f32 = bx * ay - by * ax;
    if ((eu < 0.0 || ev < 0.0 || ew < 0.0) && (eu > 0.0 || ev > 0.0 || ew > 0.0)) { return vec4f(0.0); }
    let det: f32 = eu + ev + ew;
    if (det == 0.0) { return vec4f(0.0); }
    // The signs decided the hit. t, u and v come from Moeller-Trumbore's operations, whose t carries
    // less rounding than the sheared sum; the sheared values only where its determinant is unusable.
    let e1: vec3f = b - a;
    let e2: vec3f = c - a;
    let p: vec3f = vec3f(d.y * e2.z - d.z * e2.y, d.z * e2.x - d.x * e2.z, d.x * e2.y - d.y * e2.x);
    let dm: f32 = e1.x * p.x + e1.y * p.y + e1.z * p.z;
    if (dm > -1e-7 && dm < 1e-7) {
        let tz: f32 = eu * (sz * pa.z) + ev * (sz * pb.z) + ew * (sz * pc.z);
        let inv0: f32 = 1.0 / det;
        let t0: f32 = tz * inv0;
        return vec4f(t0, ev * inv0, ew * inv0, select(0.0, 1.0, t0 > 1e-4));
    }
    let inv: f32 = 1.0 / dm;
    let tv: vec3f = o - a;
    var u: f32 = max(0.0, (tv.x * p.x + tv.y * p.y + tv.z * p.z) * inv);
    let q: vec3f = vec3f(tv.y * e1.z - tv.z * e1.y, tv.z * e1.x - tv.x * e1.z, tv.x * e1.y - tv.y * e1.x);
    var v: f32 = max(0.0, (d.x * q.x + d.y * q.y + d.z * q.z) * inv);
    let tt: f32 = (e2.x * q.x + e2.y * q.y + e2.z * q.z) * inv;
    let s: f32 = u + v;
    if (s > 1.0) {
        u = u / s;
        v = v / s;
    }
    return vec4f(tt, u, v, select(0.0, 1.0, tt > 1e-4));
}
fn hit(o: vec3f, d: vec3f, t: u32, maxDist: f32) -> bool {
    let h: vec4f = wt_hit(o, d, triVert(t, 0u), triVert(t, 1u), triVert(t, 2u));
    return h.w > 0.0 && h.x < maxDist;
}
// hit() on the tree's copy of the triangle: the same arithmetic on the same positions.
fn bvert(t: u32, k: u32) -> vec3f {
    let b: u32 = t * 9u + 3u * k;
    return vec3f(btris[b], btris[b + 1u], btris[b + 2u]);
}
fn bhit(o: vec3f, d: vec3f, t: u32, maxDist: f32) -> bool {
    let h: vec4f = wt_hit(o, d, bvert(t, 0u), bvert(t, 1u), bvert(t, 2u));
    return h.w > 0.0 && h.x < maxDist;
}
fn invDir(x: f32) -> f32 {
    if (x != 0.0) { return 1.0 / x; }
    return select(-1e30, 1e30, x >= 0.0);
}
fn scanBlocked(o: vec3f, d: vec3f, maxDist: f32) -> bool {
    for (var t: u32 = 0u; t < P.ntri; t++) {
        if (hit(o, d, t, maxDist)) { return true; }
    }
    return false;
}
// Any hit through the tree; a ray whose stack would overflow is answered by the scan.
fn bvhBlocked(o: vec3f, d: vec3f, maxDist: f32) -> bool {
    let ix: f32 = invDir(d.x);
    let iy: f32 = invDir(d.y);
    let iz: f32 = invDir(d.z);
    var stack: array<u32, 64>;
    var sp: u32 = 1u;
    stack[0] = 0u;
    for (var guard: u32 = 0u; guard < 4000000u; guard++) {
        if (sp == 0u) { return false; }
        sp = sp - 1u;
        let n: u32 = stack[sp];
        let a0: f32 = (nodes[n * 8u] - o.x) * ix;
        let b0: f32 = (nodes[n * 8u + 4u] - o.x) * ix;
        let a1: f32 = (nodes[n * 8u + 1u] - o.y) * iy;
        let b1: f32 = (nodes[n * 8u + 5u] - o.y) * iy;
        let a2: f32 = (nodes[n * 8u + 2u] - o.z) * iz;
        let b2: f32 = (nodes[n * 8u + 6u] - o.z) * iz;
        let t0: f32 = max(max(max(0.0, min(a0, b0)), min(a1, b1)), min(a2, b2));
        let t1: f32 = min(min(min(maxDist, max(a0, b0)), max(a1, b1)), max(a2, b2));
        if (!(t0 <= t1)) { continue; }
        let first: u32 = u32(nodes[n * 8u + 3u]);
        let count: u32 = u32(nodes[n * 8u + 7u]);
        if (count > 0u) {
            for (var k: u32 = 0u; k < count; k++) {
                if (bhit(o, d, first + k, maxDist)) { return true; }
            }
            continue;
        }
        if (sp + 2u > 64u) { return scanBlocked(o, d, maxDist); }
        stack[sp] = first + 1u;
        stack[sp + 1u] = first;
        sp = sp + 2u;
    }
    return scanBlocked(o, d, maxDist);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    if (gid.x >= P.w || gid.y >= P.h) { return; }
    let i: u32 = pix(gid.x, gid.y);
    let plane: u32 = P.w * P.h;
    if (albedoMask[i].w == 0.0) {
        aoRT[i] = 1.0;
        if (P.misc.z == 2.0) { aoRT[plane + i] = 1.0; aoRT[2u * plane + i] = 1.0; }
        return;
    }
    let p: vec3f = position[i].xyz;
    let n: vec3f = normal[i].xyz;
    var ax: vec3f = vec3f(1.0, 0.0, 0.0);
    if (abs(n.x) > 0.9) { ax = vec3f(0.0, 1.0, 0.0); }
    let tb: vec3f = vnorm(vcross(ax, n));
    let bb: vec3f = vcross(n, tb);
    let origin: vec3f = p + n * 1e-3;
    var open: u32 = 0u;
    var free: u32 = 0u;
    let model2: bool = P.misc.z == 2.0;
    for (var s: u32 = 0u; s < P.rt_samples; s++) {
        let u1: f32 = hash01(gid.x, gid.y, 2u * s);
        let u2: f32 = hash01(gid.x, gid.y, 2u * s + 1u);
        let r: f32 = sqrt(u1);
        let phi: f32 = 6.2831853 * u2;
        let lx: f32 = r * cos(phi);
        let ly: f32 = r * sin(phi);
        let lz: f32 = sqrt(max(0.0, 1.0 - u1));
        let dir: vec3f = vnorm(tb * lx + bb * ly + n * lz);
        var blocked: bool = false;
        if (P.rt_bvh == 1u) {
            blocked = bvhBlocked(origin, dir, select(P.misc.x, P.misc.x * 0.99, P.rt_skew == 1u));
        } else {
            blocked = scanBlocked(origin, dir, P.misc.x);
        }
        if (!blocked) {
            open++;
            if (model2) {
                // Blocked within the AO radius is blocked for the sky too; only open rays go on.
                var far: bool = false;
                if (P.rt_bvh == 1u) { far = bvhBlocked(origin, dir, 1e30); } else { far = scanBlocked(origin, dir, 1e30); }
                if (!far) { free++; }
            }
        }
    }
    aoRT[i] = f32(open) / f32(P.rt_samples);
    if (model2) {
        let toLight: vec3f = vnorm(P.light.xyz * -1.0);
        var shadow: bool = false;
        if (P.misc.w != 1.0) {
            if (P.rt_bvh == 1u) { shadow = bvhBlocked(origin, toLight, 1e30); } else { shadow = scanBlocked(origin, toLight, 1e30); }
        }
        aoRT[plane + i] = f32(free) / f32(P.rt_samples);
        aoRT[2u * plane + i] = select(1.0, 0.0, shadow);
    }
}

//@pass shade
// Lighting (src/renderer/composite.cpp): the clamped frame and the unclamped HDR frame.
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> normal: array<vec4f>;
@group(0) @binding(2) var<storage, read> albedoMask: array<vec4f>;
@group(0) @binding(3) var<storage, read> ao: array<f32>;
@group(0) @binding(4) var<storage, read_write> frame: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> hdr: array<vec4f>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    if (gid.x >= P.w || gid.y >= P.h) { return; }
    let i: u32 = pix(gid.x, gid.y);
    let am: vec4f = albedoMask[i];
    if (am.w == 0.0) { frame[i] = vec4f(0.0); hdr[i] = vec4f(0.0); return; }
    let n: vec3f = normal[i].xyz;
    let ldir: vec3f = P.light.xyz;
    let ndl: f32 = max(0.0, vdot(n, ldir * -1.0)) * P.light.w;
    var lit: f32 = (0.2 + ndl) * ao[i];
    if (P.misc.z == 2.0) {
        // Lighting model 2: ao is the rtao pass's buffer, whose second and third planes are sky and sun.
        let plane: u32 = P.w * P.h;
        lit = 0.2 * ao[plane + i] + ndl * ao[2u * plane + i];
    }
    let rgb: vec3f = vec3f(am.x * lit, am.y * lit, am.z * lit);
    hdr[i] = vec4f(rgb, 0.0);
    frame[i] = vec4f(clamp(rgb, vec3f(0.0), vec3f(1.0)), 0.0);
}
