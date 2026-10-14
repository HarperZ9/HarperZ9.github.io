// A small raymarched test scene for the painterly shaders, in the spirit of template (a): an
// isometric street corner at dusk. A figure in a long coat stands under a lamp; a wall with a
// lit window, a bench, kerb stones and a puddle; a warm key from the lamp, a cool sky fill, soft
// shadows and ambient occlusion. Returns scene-linear Rec.709 colour, view depth and normals,
// so edge passes can use geometry. Deterministic; t moves the lamp's flicker and the coat.
const V = (x, y, z) => [x, y, z], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => mul(a, 1 / len(a)), mix = (a, b, t) => add(mul(a, 1 - t), mul(b, t));
const box = (p, c, b) => { const q = [Math.abs(p[0] - c[0]) - b[0], Math.abs(p[1] - c[1]) - b[1], Math.abs(p[2] - c[2]) - b[2]]; return len(q.map((v) => Math.max(v, 0))) + Math.min(Math.max(q[0], q[1], q[2]), 0); };
const capsule = (p, a, b, r) => { const pa = sub(p, a), ba = sub(b, a), h = Math.min(1, Math.max(0, dot(pa, ba) / dot(ba, ba))); return len(sub(pa, mul(ba, h))) - r; };
const sphere = (p, c, r) => len(sub(p, c)) - r;
const cone = (p, c, h, r0, r1) => { const y = p[1] - c[1], t = Math.min(1, Math.max(0, y / h)), r = r0 + (r1 - r0) * t; return Math.max(Math.hypot(p[0] - c[0], p[2] - c[2]) - r, Math.abs(y - h / 2) - h / 2); };

function map(p, t, noLamp = false) {
  let d = p[1] + 0.0, m = 0;                                                   // ground
  const wall = box(p, V(0, 1.6, -2.2), V(4, 1.6, 0.25)); if (wall < d) { d = wall; m = 1; }
  const win = box(p, V(-1.2, 1.7, -1.93), V(0.55, 0.45, 0.04)); if (win < d) { d = win; m = 2; }
  const kerb = box(p, V(0, 0.06, 1.4), V(4, 0.06, 0.12)); if (kerb < d) { d = kerb; m = 3; }
  const sway = 0.04 * Math.sin(t * 1.3);
  const coat = cone(p, V(0.5, 0.05, 0), 1.25, 0.34 + sway, 0.17); if (coat < d) { d = coat; m = 4; }
  const head = sphere(p, V(0.5, 1.48, 0), 0.15); if (head < d) { d = head; m = 5; }
  const hat = Math.min(box(p, V(0.5, 1.62, 0), V(0.22, 0.012, 0.22)), capsule(p, V(0.5, 1.6, 0), V(0.5, 1.72, 0), 0.11)); if (hat < d) { d = hat; m = 6; }
  const post = capsule(p, V(-0.6, 0, 0.6), V(-0.6, 2.4, 0.6), 0.045); if (post < d) { d = post; m = 7; }
  const lamp = noLamp ? Infinity : sphere(p, V(-0.6, 2.56, 0.6), 0.13); if (lamp < d) { d = lamp; m = 8; }
  const bench = Math.min(box(p, V(1.9, 0.42, -1.3), V(0.8, 0.04, 0.22)), box(p, V(1.9, 0.2, -1.3), V(0.75, 0.2, 0.03))); if (bench < d) { d = bench; m = 9; }
  return [d, m];
}
const ALB = [[0.28, 0.27, 0.25], [0.5, 0.26, 0.17], [1, 1, 1], [0.38, 0.36, 0.33], [0.14, 0.26, 0.2], [0.62, 0.45, 0.36], [0.08, 0.07, 0.07], [0.1, 0.1, 0.11], [1, 1, 1], [0.32, 0.18, 0.1]];

function normal(p, t) {
  const e = 1e-3, d = (q) => map(q, t)[0];
  return norm([d(add(p, V(e, 0, 0))) - d(sub(p, V(e, 0, 0))), d(add(p, V(0, e, 0))) - d(sub(p, V(0, e, 0))), d(add(p, V(0, 0, e))) - d(sub(p, V(0, 0, e)))]);
}
function softShadow(p, l, maxT, t) {
  let res = 1, s = 0.03;
  for (let i = 0; i < 96 && s < maxT; i++) { const h = map(add(p, mul(l, s)), t, true)[0]; if (h < 1e-4) return 0; res = Math.min(res, (10 * h) / s); s += Math.min(Math.max(h, 0.005), 0.08); }
  return Math.max(0, Math.min(1, res));
}
function ao(p, n, t) { let o = 0; for (let i = 1; i <= 5; i++) { const h = 0.06 * i; o += (h - map(add(p, mul(n, h)), t)[0]) / (i * i); } return Math.max(0, 1 - 2.2 * o); }

export function streetScene(w = 480, h = 300, t = 0, { daylight = false, eye: eyeIn = null, target: targetIn = null, lampGain = 1 } = {}) {
  const color = new Float32Array(w * h * 4), depth = new Float32Array(w * h), normals = new Float32Array(w * h * 4);
  // Lighting outputs for the shaders that relight (lab 2): albedo, irradiance (colour = albedo x
  // irradiance before fog), the fog fraction and colour, a kind per pixel (0 sky, 1 emissive, 2 lit) and
  // the material index of the hit (-1 sky; 4 coat, 5 head, 6 hat, 7 lamp post, 8 lamp).
  const albedo = new Float32Array(w * h * 4), light = new Float32Array(w * h * 4), fogT = new Float32Array(w * h), kind = new Uint8Array(w * h), mat = new Int8Array(w * h).fill(-1);
  const eye = eyeIn || V(5.2, 4.6, 6.4), target = targetIn || V(0.2, 0.8, 0), fwd = norm(sub(target, eye)), right = norm([fwd[2], 0, -fwd[0]]).map((v) => -v), up = norm([right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]]);
  const lampPos = V(-0.6, 2.56, 0.6), flick = lampGain * (1 + 0.08 * Math.sin(t * 17) * Math.sin(t * 5.3));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = ((x + 0.5) / w - 0.5) * 2 * (w / h) * 0.42, sy = (0.5 - (y + 0.5) / h) * 2 * 0.42;
    const rd = norm(add(add(fwd, mul(right, sx)), mul(up, sy)));
    let s = 0, hit = -1, p = eye;
    for (let i = 0; i < 160 && s < 30; i++) { p = add(eye, mul(rd, s)); const [d, m] = map(p, t); if (d < 1e-3 * (1 + s)) { hit = m; break; } s += d * 0.9; }
    const i4 = (y * w + x) * 4; mat[y * w + x] = hit;
    let c;
    if (hit < 0) { const k = Math.max(0, rd[1]); c = daylight ? mix(V(0.75, 0.8, 0.9), V(0.25, 0.42, 0.85), k) : mix(V(0.18, 0.14, 0.2), V(0.05, 0.07, 0.16), k); depth[y * w + x] = 30; light.set([c[0], c[1], c[2], 1], i4); }
    else {
      const n = normal(p, t); normals.set([n[0], n[1], n[2], 1], i4); depth[y * w + x] = s;
      if (hit === 2) c = V(2.4, 1.5, 0.6); else if (hit === 8) c = mul(V(9, 6.5, 3.6), flick);
      else {
        let alb = ALB[hit];
        if (hit === 0) { const crack = Math.abs(Math.sin(p[0] * 3.1 + Math.sin(p[2] * 2.3) * 0.7)) < 0.03 ? 0.6 : 1, puddle = Math.hypot(p[0] - 1.6, (p[2] - 0.9) * 1.6) < 0.5; alb = mul(alb, crack); if (puddle) alb = V(0.05, 0.05, 0.06); }
        const L = sub(lampPos, p), dl = len(L), l = mul(L, 1 / dl), occ = ao(p, n, t);
        let key = Math.max(0, dot(n, l)) * softShadow(add(p, mul(n, 2e-3)), l, dl, t) * 26 * flick / (dl * dl + 0.3);
        if (daylight) { const sun = norm(V(-0.5, 0.75, 0.45)); key = Math.max(0, dot(n, sun)) * softShadow(add(p, mul(n, 2e-3)), sun, 20, t) * 3.2; }
        const sky = (0.5 + 0.5 * n[1]) * 0.16 * occ, bounce = Math.max(0, -n[1]) * 0.03;
        const winL = sub(V(-1.2, 1.7, -1.8), p), wd = len(winL), win = Math.max(0, dot(n, mul(winL, 1 / wd))) * 1.2 / (wd * wd) * occ;
        const kc = daylight ? [1, 0.88, 0.7] : [1, 0.72, 0.42], skyK = daylight ? 3.2 : 1;
        const E = [0, 1, 2].map((k) => key * kc[k] + sky * skyK * [0.45, 0.6, 1][k] + win * [1, 0.7, 0.35][k] + bounce);
        c = [0, 1, 2].map((k) => alb[k] * E[k]);
        albedo.set([alb[0], alb[1], alb[2], 1], i4); light.set([E[0], E[1], E[2], 1], i4); kind[y * w + x] = 2;
      }
      if (hit === 2 || hit === 8) { light.set([c[0], c[1], c[2], 1], i4); kind[y * w + x] = 1; }
      const fog = 1 - Math.exp(-0.035 * s); fogT[y * w + x] = fog; c = mix(c, daylight ? V(0.7, 0.75, 0.85) : V(0.1, 0.09, 0.13), fog);
    }
    color.set([c[0], c[1], c[2], 1], i4);
  }
  const fogColor = daylight ? V(0.7, 0.75, 0.85) : V(0.1, 0.09, 0.13);
  return { width: w, height: h, data: color, depth, normals, albedo, light, fogT, fogColor, kind, mat, camera: { eye, fwd, right, up, tan: 0.42, aspect: w / h } };
}

// Screen-space motion vectors from frame A's camera to frame B's: for each pixel of B, where its
// surface point was in A, as B pixel minus A pixel (what a renderer's velocity buffer holds).
// Sky pixels (depth 30) get the motion of a point at that distance. Also returns, per pixel, A's
// view distance of that point, for the disocclusion test.
export function motionVectors(A, B) {
  const { width: w, height: h } = B, mv = new Float32Array(w * h * 2), dA = new Float32Array(w * h), cb = B.camera, ca = A.camera;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = ((x + 0.5) / w - 0.5) * 2 * cb.aspect * cb.tan, sy = (0.5 - (y + 0.5) / h) * 2 * cb.tan;
    const rd = norm(add(add(cb.fwd, mul(cb.right, sx)), mul(cb.up, sy))), p = add(cb.eye, mul(rd, B.depth[y * w + x])), v = sub(p, ca.eye);
    const z = dot(v, ca.fwd), ax = dot(v, ca.right) / (z * ca.aspect * ca.tan), ay = dot(v, ca.up) / (z * ca.tan);
    const px = ((ax / 2) + 0.5) * w - 0.5, py = (0.5 - ay / 2) * h - 0.5;
    mv[(y * w + x) * 2] = x - px; mv[(y * w + x) * 2 + 1] = y - py; dA[y * w + x] = len(v);
  }
  return { mv, dA };
}
