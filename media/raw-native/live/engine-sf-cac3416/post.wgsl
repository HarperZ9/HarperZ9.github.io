// raw-native GPU screen-space passes (ROADMAP M3): GTAO, mirror SSR and the TAA resolve, the
// float32 forms of src/renderer/post_gtao.cpp, post_ssr.cpp and taa.cpp. Their checks are
// src/renderer/gpu/post_parity.cpp; bounds in evidence/m3-post-bounds.json.

struct PostParams {
    width: u32, height: u32, slices: u32, steps: u32,
    refine: u32, flags: u32, ssr_steps: u32, pad1: u32,
    view: vec4f,       // tan(fovy / 2), aspect, near plane, GTAO radius
    ssr: vec4f,        // max distance, thickness
    taa: vec4f,        // blend weight, clip sigma
}
// A view-space G-buffer pixel: 8 floats. 0..2 position, 3 view depth (negative: empty), 4..6 normal,
// 7 the back depth of SSR's back layer (method note 14 of evidence/m3-post-bounds.json).
const GB: u32 = 8u;
const PI: f32 = 3.14159265358979;

fn on_screen(x: i32, y: i32) -> bool {
    return x >= 0 && y >= 0 && x < i32(P.width) && y < i32(P.height);
}
fn project(p: vec3f) -> vec3f {
    // Screen position (pixels, y down) in xy; z is 1 when in front of the camera.
    if (p.z >= -1.0e-6) { return vec3f(0.0, 0.0, 0.0); }
    let w: f32 = -p.z;
    let sx: f32 = (p.x / (w * P.view.x * P.view.y) * 0.5 + 0.5) * f32(P.width);
    let sy: f32 = (1.0 - (p.y / (w * P.view.x) * 0.5 + 0.5)) * f32(P.height);
    return vec3f(sx, sy, 1.0);
}

//@pass post_gtao
// One invocation per pixel: GTAO visibility (1 where nothing was drawn).
@group(0) @binding(0) var<uniform> P: PostParams;
@group(0) @binding(1) var<storage, read> G: array<f32>;
@group(0) @binding(2) var<storage, read_write> O: array<f32>;

fn valid_px(x: i32, y: i32) -> bool {
    return on_screen(x, y) && G[(u32(y) * P.width + u32(x)) * GB + 3u] >= 0.0;
}
fn sample_depth(fx: f32, fy: f32, sx: i32, sy: i32) -> f32 {
    let nearest: f32 = G[(u32(sy) * P.width + u32(sx)) * GB + 3u];
    let x0: i32 = i32(floor(fx - 0.5));
    let y0: i32 = i32(floor(fy - 0.5));
    let ax: f32 = fx - 0.5 - f32(x0);
    let ay: f32 = fy - 0.5 - f32(y0);
    var k: array<f32, 4>;
    var lo: f32 = 1.0e30;
    var hi: f32 = 0.0;
    for (var q: i32 = 0; q < 4; q++) {
        let qx: i32 = x0 + (q & 1);
        let qy: i32 = y0 + (q >> 1u);
        if (!valid_px(qx, qy)) { return nearest; }
        let d: f32 = G[(u32(qy) * P.width + u32(qx)) * GB + 3u];
        lo = min(lo, d);
        hi = max(hi, d);
        k[q] = 1.0 / d;
    }
    if (hi > 1.1 * lo) { return nearest; }
    let inv: f32 = (k[0] * (1.0 - ax) + k[1] * ax) * (1.0 - ay) + (k[2] * (1.0 - ax) + k[3] * ax) * ay;
    return 1.0 / inv;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let i: u32 = gid.x + gid.y * 2097152u;
    if (i >= P.width * P.height) { return; }
    O[i] = 1.0;
    let b: u32 = i * GB;
    let depth: f32 = G[b + 3u];
    if (depth < 0.0) { return; }
    let x: i32 = i32(i % P.width);
    let y: i32 = i32(i / P.width);
    let pp: vec3f = vec3f(G[b], G[b + 1u], G[b + 2u]);
    let nn: vec3f = vec3f(G[b + 4u], G[b + 5u], G[b + 6u]);
    let vv: vec3f = -pp / length(pp);
    let rpx: f32 = P.view.w * f32(P.height) / (2.0 * P.view.x * depth);
    var tt: vec3f = vec3f(1.0 - vv.x * vv.x, -vv.x * vv.y, -vv.x * vv.z);
    tt = tt / length(tt);
    let bb: vec3f = cross(vv, tt);
    var total: f32 = 0.0;
    for (var s: u32 = 0u; s < P.slices; s++) {
        let phi: f32 = PI * (f32(s) + 0.5) / f32(P.slices);
        let dir: vec3f = cos(phi) * tt + sin(phi) * bb;
        let pw: f32 = -pp.z;
        let dwz: f32 = -dir.z;
        // The slice's screen direction: the derivative of the projection along dir. It points where
        // the CPU reference's small step projects (both screen differences carry the same factor),
        // and it subtracts no nearly equal numbers: differencing two projections 1e-3 apart in f32
        // turned the direction by about 1e-4, enough to move a far sample into the next pixel.
        let dsx: f32 = (dir.x * pw - pp.x * dwz) * f32(P.width) / P.view.y;
        let dsy: f32 = -(dir.y * pw - pp.y * dwz) * f32(P.height);
        let ddl: f32 = length(vec2f(dsx, dsy));
        if (ddl < 1.0e-12) { continue; }
        let c: f32 = dsx / ddl;
        let sn: f32 = dsy / ddl;
        let od: vec3f = dir - dot(dir, vv) * vv;
        let ax: vec3f = normalize(cross(od, vv));
        let pn: vec3f = nn - ax * dot(nn, ax);
        let pnl: f32 = length(pn);
        if (pnl < 1.0e-9) { continue; }
        let sgn: f32 = select(-1.0, 1.0, dot(od, pn) >= 0.0);
        let cn: f32 = clamp(dot(pn, vv) / pnl, 0.0, 1.0);
        let nang: f32 = sgn * acos(cn);
        var hc0: f32 = cos(nang + PI / 2.0);
        var hc1: f32 = cos(nang - PI / 2.0);
        for (var side: u32 = 0u; side < 2u; side++) {
            let sd: f32 = select(-1.0, 1.0, side == 0u);
            for (var k: u32 = 1u; k <= P.steps; k++) {
                let off: f32 = sd * rpx * f32(k) / f32(P.steps);
                let fx: f32 = f32(x) + 0.5 + off * c;
                let fy: f32 = f32(y) + 0.5 + off * sn;
                let sx: i32 = i32(floor(fx));
                let sy: i32 = i32(floor(fy));
                if (!valid_px(sx, sy) || (sx == x && sy == y)) { continue; }
                let dd: f32 = sample_depth(fx, fy, sx, sy);
                let q: vec3f = vec3f((fx / f32(P.width) * 2.0 - 1.0) * dd * P.view.x * P.view.y, (1.0 - fy / f32(P.height) * 2.0) * dd * P.view.x, -dd);
                let dv: vec3f = q - pp;
                let dl: f32 = length(dv);
                if (dl < 1.0e-9 || dl > P.view.w) { continue; }
                if (side == 0u) { hc0 = max(hc0, dot(dv, vv) / dl); } else { hc1 = max(hc1, dot(dv, vv) / dl); }
            }
        }
        let h1: f32 = nang + min(acos(clamp(hc0, -1.0, 1.0)) - nang, PI / 2.0);
        let h0: f32 = nang + max(-acos(clamp(hc1, -1.0, 1.0)) - nang, -PI / 2.0);
        let sn2: f32 = sin(nang);
        let a0: f32 = (cn + 2.0 * h0 * sn2 - cos(2.0 * h0 - nang)) / 4.0;
        let a1: f32 = (cn + 2.0 * h1 * sn2 - cos(2.0 * h1 - nang)) / 4.0;
        total += pnl * (a0 + a1);
    }
    O[i] = total / f32(P.slices);
}

//@pass post_ssr
// One invocation per pixel: the hit pixel's index as a float, or -1.
@group(0) @binding(0) var<uniform> P: PostParams;
@group(0) @binding(1) var<storage, read> G: array<f32>;
@group(0) @binding(2) var<storage, read_write> O: array<f32>;

struct Probe {
    j: i32,
    behind: bool,
    within: bool,
    inside: bool,
}
fn probe_at(t: f32, a: vec3f, e: vec3f, k0: f32, k1: f32) -> Probe {
    var r: Probe;
    r.behind = false;
    r.within = false;
    r.inside = false;
    let px: i32 = i32(floor(a.x + (e.x - a.x) * t));
    let py: i32 = i32(floor(a.y + (e.y - a.y) * t));
    if (!on_screen(px, py)) { r.j = -2; return r; }
    r.j = py * i32(P.width) + px;
    let d: f32 = G[u32(r.j) * GB + 3u];
    if (d < 0.0) { return r; }
    let ray: f32 = 1.0 / (k0 + (k1 - k0) * t);
    r.behind = ray > d;
    r.within = r.behind && ray - d < P.ssr.y;
    r.inside = ray >= d + P.ssr.y && ray <= G[u32(r.j) * GB + 7u];
    return r;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let i: u32 = gid.x + gid.y * 2097152u;
    if (i >= P.width * P.height) { return; }
    O[i] = -1.0;
    let b: u32 = i * GB;
    if (G[b + 3u] < 0.0) { return; }
    let pp: vec3f = vec3f(G[b], G[b + 1u], G[b + 2u]);
    let d: vec3f = pp / length(pp);
    var nn: vec3f = vec3f(G[b + 4u], G[b + 5u], G[b + 6u]);
    if ((P.flags & 1u) != 0u) { nn = -d; }
    let r: vec3f = d - 2.0 * dot(d, nn) * nn;
    var len: f32 = P.ssr.x;
    if (r.z > 1.0e-9) { len = min(len, (-P.view.z - pp.z) / r.z * 0.999); }
    if (len <= 0.0) { return; }
    let ee: vec3f = pp + r * len;
    let a: vec3f = project(pp);
    var e: vec3f = project(ee);
    if (a.z == 0.0 || e.z == 0.0) { return; }
    let k0: f32 = -1.0 / pp.z;
    var k1: f32 = -1.0 / ee.z;
    var tend: f32 = 1.0;
    let lim: f32 = 1.0e-3;
    let wf: f32 = f32(P.width);
    let hf: f32 = f32(P.height);
    if (e.x > wf - lim && e.x != a.x) { tend = min(tend, (wf - lim - a.x) / (e.x - a.x)); }
    if (e.x < 0.0 && e.x != a.x) { tend = min(tend, (0.0 - a.x) / (e.x - a.x)); }
    if (e.y > hf - lim && e.y != a.y) { tend = min(tend, (hf - lim - a.y) / (e.y - a.y)); }
    if (e.y < 0.0 && e.y != a.y) { tend = min(tend, (0.0 - a.y) / (e.y - a.y)); }
    if (tend <= 0.0) { return; }
    e = vec3f(a.x + (e.x - a.x) * tend, a.y + (e.y - a.y) * tend, 1.0);
    k1 = k0 + (k1 - k0) * tend;
    // ssr_steps 0: one step a pixel of the clipped segment (method note 14).
    let span: f32 = max(abs(e.x - a.x), abs(e.y - a.y));
    let n: u32 = select(P.ssr_steps, max(1u, u32(ceil(span))), P.ssr_steps == 0u);
    var prev: f32 = 0.0;
    for (var s: u32 = 1u; s <= n; s++) {
        let t: f32 = f32(s) / f32(n);
        let pr: Probe = probe_at(t, a, e, k0, k1);
        if (pr.j == -2) { break; }
        if (pr.behind && pr.j != i32(i)) {
            var lo: f32 = prev;
            var hi: f32 = t;
            for (var m: u32 = 0u; m < P.refine; m++) {
                let mid: f32 = 0.5 * (lo + hi);
                let pm: Probe = probe_at(mid, a, e, k0, k1);
                if (pm.behind) { hi = mid; } else { lo = mid; }
            }
            let ph: Probe = probe_at(hi, a, e, k0, k1);
            if (ph.within && ph.j >= 0 && ph.j != i32(i)) { O[i] = f32(ph.j); break; }
            if (pr.inside) { break; }
        }
        prev = t;
    }
}

//@pass post_taa
// One invocation per pixel: the TAA resolve. C holds the current frame (colour, view depth),
// R per pixel the history position x, y and the expected previous depth, D the previous depths,
// H the history colour; flags bit 1: clip, bit 2: depth test, bit 4: first frame, bit 8: motion
// from the nearest surface in 3 x 3 (method note 10 of 2026-10-11).
@group(0) @binding(0) var<uniform> P: PostParams;
@group(0) @binding(1) var<storage, read> C: array<f32>;
@group(0) @binding(2) var<storage, read> R: array<f32>;
@group(0) @binding(3) var<storage, read> D: array<f32>;
@group(0) @binding(4) var<storage, read> H: array<f32>;
@group(0) @binding(5) var<storage, read_write> O: array<f32>;

fn ycocg(c: vec3f) -> vec3f {
    return vec3f(0.25 * c.x + 0.5 * c.y + 0.25 * c.z, 0.5 * c.x - 0.5 * c.z, -0.25 * c.x + 0.5 * c.y - 0.25 * c.z);
}
fn rgb_of(c: vec3f) -> vec3f {
    return vec3f(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z);
}
fn cr_weights(t: f32) -> vec4f {
    let t2: f32 = t * t;
    let t3: f32 = t2 * t;
    return vec4f(-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1.0, -1.5 * t3 + 2.0 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2);
}
fn cur_rgb(x: i32, y: i32) -> vec3f {
    let j: u32 = (u32(y) * P.width + u32(x)) * 4u;
    return vec3f(C[j], C[j + 1u], C[j + 2u]);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let i: u32 = gid.x + gid.y * 2097152u;
    if (i >= P.width * P.height) { return; }
    let w: i32 = i32(P.width);
    let h: i32 = i32(P.height);
    let x: i32 = i32(i) % w;
    let y: i32 = i32(i) / w;
    let cur: vec3f = cur_rgb(x, y);
    O[i * 3u] = cur.x;
    O[i * 3u + 1u] = cur.y;
    O[i * 3u + 2u] = cur.z;
    if ((P.flags & 4u) != 0u) { return; }
    var px: f32 = R[i * 3u];
    var py: f32 = R[i * 3u + 1u];
    let ed: f32 = R[i * 3u + 2u];
    if ((P.flags & 8u) != 0u) {
        var best: f32 = select(1.0e30, C[i * 4u + 3u], C[i * 4u + 3u] >= 0.0);
        for (var db: i32 = -1; db <= 1; db++) {
            for (var da: i32 = -1; da <= 1; da++) {
                let qx: i32 = x + da;
                let qy: i32 = y + db;
                if ((da == 0 && db == 0) || qx < 0 || qy < 0 || qx >= w || qy >= h) { continue; }
                let j: u32 = u32(qy * w + qx);
                let dq: f32 = C[j * 4u + 3u];
                if (dq < 0.0 || dq >= best) { continue; }
                best = dq;
                px = R[j * 3u] - f32(da);
                py = R[j * 3u + 1u] - f32(db);
            }
        }
    }
    if (px < 0.5 || py < 0.5 || px > f32(w) - 0.5 || py > f32(h) - 0.5) { return; }
    if ((P.flags & 2u) != 0u) {
        let nx: i32 = min(w - 1, i32(px));
        let ny: i32 = min(h - 1, i32(py));
        var lo: f32 = 1.0e30;
        var hi: f32 = -1.0;
        var empty: bool = false;
        for (var b: i32 = -1; b <= 1; b++) {
            for (var a: i32 = -1; a <= 1; a++) {
                let qx: i32 = clamp(nx + a, 0, w - 1);
                let qy: i32 = clamp(ny + b, 0, h - 1);
                let pd: f32 = D[u32(qy * w + qx)];
                if (pd < 0.0) { empty = true; continue; }
                lo = min(lo, pd);
                hi = max(hi, pd);
            }
        }
        let tol: f32 = 0.02 * ed + 0.02;
        if (ed < 0.0) {
            if (!empty) { return; }
        } else if (hi < 0.0 || ed < lo - tol || ed > hi + tol) {
            return;
        }
    }
    let fx: f32 = px - 0.5;
    let fy: f32 = py - 0.5;
    let x0: i32 = i32(floor(fx));
    let y0: i32 = i32(floor(fy));
    let wx: vec4f = cr_weights(fx - f32(x0));
    let wy: vec4f = cr_weights(fy - f32(y0));
    var hc: vec3f = vec3f(0.0, 0.0, 0.0);
    for (var tb: i32 = 0; tb < 4; tb++) {
        for (var ta: i32 = 0; ta < 4; ta++) {
            let qx: i32 = clamp(x0 - 1 + ta, 0, w - 1);
            let qy: i32 = clamp(y0 - 1 + tb, 0, h - 1);
            let j: u32 = u32(qy * w + qx) * 3u;
            hc += wx[ta] * wy[tb] * vec3f(H[j], H[j + 1u], H[j + 2u]);
        }
    }
    if ((P.flags & 1u) != 0u) {
        var m: vec3f = vec3f(0.0, 0.0, 0.0);
        var n: f32 = 0.0;
        for (var nb: i32 = -1; nb <= 1; nb++) {
            for (var na: i32 = -1; na <= 1; na++) {
                let qx: i32 = x + na;
                let qy: i32 = y + nb;
                if (qx < 0 || qy < 0 || qx >= w || qy >= h) { continue; }
                m += ycocg(cur_rgb(qx, qy));
                n += 1.0;
            }
        }
        m = m / n;
        var vr: vec3f = vec3f(0.0, 0.0, 0.0);
        for (var vb: i32 = -1; vb <= 1; vb++) {
            for (var va: i32 = -1; va <= 1; va++) {
                let qx: i32 = x + va;
                let qy: i32 = y + vb;
                if (qx < 0 || qy < 0 || qx >= w || qy >= h) { continue; }
                let dv: vec3f = ycocg(cur_rgb(qx, qy)) - m;
                vr += dv * dv;
            }
        }
        let sd: vec3f = sqrt(vr / n);
        let ext: vec3f = P.taa.y * sd + vec3f(1.0e-4, 1.0e-4, 1.0e-4);   // floor: method note 11
        var hy: vec3f = ycocg(hc);
        let q: vec3f = abs(hy - m) / ext;
        let scale: f32 = max(q.x, max(q.y, q.z));
        if (scale > 1.0) { hy = m + (hy - m) / scale; }
        hc = rgb_of(hy);
    }
    let res: vec3f = hc + (cur - hc) * P.taa.x;
    O[i * 3u] = res.x;
    O[i * 3u + 1u] = res.y;
    O[i * 3u + 2u] = res.z;
}
