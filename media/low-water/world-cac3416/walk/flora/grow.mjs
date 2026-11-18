// Trees grown by rule. Each species has its own way of standing: where the crown starts, how the
// branches leave the trunk, how they bend under their own weight, where the foliage hangs. A tree
// is a trunk and limbs as tubes with the drawn cards of atlas.mjs hung on them.
//   spruce  a straight pole; whorls of branches that sag and lift at the tip; boughs hang as fringe
//   pine    a long bare stem, orange above; a few heavy limbs high up; needles in bursts at the ends
//   cedar   a flared, fibrous butt; J-shaped branches; flat sprays hanging; a nodding top
//   birch   a thin leaning white stem; steep limbs; fine twigs that weep
//   snag    a dead conifer, broken off, a few bare stubs
// A vertex is 12 floats: place, normal, uv, then four numbers the shader reads by material:
//   bark:    0, species, girth in metres, shade
//   foliage: 1, tint seed, how much it flutters, shade (dark inside the crown, light at its skin)
import { CELLS, cellUV } from "./atlas.mjs";

export const SPECIES = { spruce: 0, pine: 1, cedar: 2, birch: 3, snag: 4 };
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, lerp = (a, b, t) => a + (b - a) * t, UP = [0, 1, 0];

export class Mesh {
  constructor() { this.a = []; }
  v(p, n, u, vv, m) { this.a.push(p[0], p[1], p[2], n[0], n[1], n[2], u, vv, m[0], m[1], m[2], m[3]); }
  // a tube along a path of { p, r }; `m` is the material row, m[3] its shade at the far end
  tube(path, sides, m, shade0 = m[3]) {
    const rings = []; let run = 0;
    for (let i = 0; i < path.length; i++) {
      const t = norm(sub(path[Math.min(i + 1, path.length - 1)].p, path[Math.max(i - 1, 0)].p)), ref = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : UP, x = norm(cross(ref, t)), y = cross(t, x), ring = [];
      if (i) run += len(sub(path[i].p, path[i - 1].p));
      for (let k = 0; k <= sides; k++) { const a = k / sides * Math.PI * 2, n = add(mul(x, Math.cos(a)), mul(y, Math.sin(a))); ring.push({ p: add(path[i].p, mul(n, path[i].r)), n, u: k / sides, v: run, s: lerp(shade0, m[3], i / (path.length - 1)) }); }
      rings.push(ring);
    }
    for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < sides; k++) {
      const a = rings[i][k], b = rings[i][k + 1], c = rings[i + 1][k + 1], d = rings[i + 1][k];
      for (const q of [a, b, c, a, c, d]) this.v(q.p, q.n, q.u, q.v, [m[0], m[1], m[2], q.s]);
    }
  }
  // a card: corners p00 (u0, v0), p10 (u1, v0), p11 (u1, v1), p01 (u0, v1) of an atlas cell
  quad(p00, p10, p11, p01, cell, n, m, s0 = m[3], s1 = m[3], alongU = true) {
    const [u0, v0, u1, v1] = cellUV(cell), sh = alongU ? [s0, s1, s1, s0] : [s0, s0, s1, s1], P = [p00, p10, p11, p01], U = [u0, u1, u1, u0], W = [v0, v0, v1, v1];
    for (const i of [0, 1, 2, 0, 2, 3]) this.v(P[i], n, U[i], W[i], [m[0], m[1], m[2], sh[i]]);
  }
  // a card bent along its length: pts are { p, side, n, s } down its centre line, side the half-width vector;
  // the cell runs along u from the first point to the last, or up v from its foot when axis is "v"
  ribbon(pts, cell, m, axis = "u") {
    const [u0, v0, u1, v1] = cellUV(cell), n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[i + 1], ua = lerp(u0, u1, i / n), ub = lerp(u0, u1, (i + 1) / n), va = lerp(v1, v0, i / n), vb = lerp(v1, v0, (i + 1) / n);
      const q = axis === "u" ? [[sub(a.p, a.side), a.n, ua, v0, a.s], [sub(b.p, b.side), b.n, ub, v0, b.s], [add(b.p, b.side), b.n, ub, v1, b.s], [add(a.p, a.side), a.n, ua, v1, a.s]]
        : [[sub(a.p, a.side), a.n, u0, va, a.s], [sub(b.p, b.side), b.n, u0, vb, b.s], [add(b.p, b.side), b.n, u1, vb, b.s], [add(a.p, a.side), a.n, u1, va, a.s]];
      for (const k of [0, 1, 2, 0, 2, 3]) this.v(q[k][0], q[k][1], q[k][2], q[k][3], [m[0], m[1], m[2], q[k][4]]);
    }
  }
  get data() { return new Float32Array(this.a); }
  get triangles() { return this.a.length / 36; }
}

// a trunk: a pole of height H that wanders by `wander` metres, radius r0 at breast height, flared at the butt
function trunk(M, R, H, r0, wander, flare, sides, species, top = 1, rings = 14) {
  const ph = R() * 6.28, ph2 = R() * 6.28, lean = (R() - 0.5) * 0.06, path = [];
  const axis = (y) => { const t = y / H; return [Math.sin(t * 2.6 + ph) * wander * t + lean * y, y, Math.cos(t * 3.4 + ph2) * wander * t]; };
  const radius = (y) => (r0 * (1 - y / H) ** 0.8 + 0.018) * (1 + flare * Math.max(0, 1 - y / (1.2 + flare)) ** 2);
  for (let i = 0; i <= rings; i++) { const y = H * top * (i / rings) ** 1.25 - (i === 0 ? 0.5 : 0); path.push({ p: axis(Math.max(y, -0.5)), r: radius(Math.max(0, y)) }); }
  M.tube(path, sides, [0, species, r0 * 6.28, 1], 0.75);
  return { axis, radius };
}

function spruce(R, d) {
  const M = new Mesh(), H = 23 + R() * 9, r0 = 0.20 + H * 0.007, T = trunk(M, R, H, r0, 0.25, 0.5, d > 0.9 ? 8 : 5, SPECIES.spruce);
  const cb = H * (0.26 + 0.14 * R()), gap = d > 0.9 ? 0.46 : 1.25, per = d > 0.9 ? 5 : 3, wide = d > 0.9 ? 1 : 1.7, mat = (fl) => [1, R(), fl, 1];
  let turn = R() * 6.28;
  for (let y = cb; y < H - 0.5; y += gap * (0.8 + 0.4 * R())) {
    const t = (y - cb) / (H - cb), L = (0.35 + 3.5 * (1 - t) ** 0.9) * Math.min(1, 0.5 + t * 4.5), lift = lerp(-0.55, 0.5, t ** 0.7);
    turn += 0.9;
    for (let k = 0; k < per; k++) {
      const az = turn + k / per * 6.28 + (R() - 0.5) * 0.5, h = [Math.cos(az), 0, Math.sin(az)], side = cross(h, UP), Lb = L * (0.75 + 0.5 * R()), base = add(T.axis(y), mul(h, T.radius(y) * 0.6));
      // the branch sags along its length and lifts again at the tip
      const at = (s) => add(base, add(mul(h, Lb * s), mul(UP, Lb * (Math.sin(lift) * s - 0.22 * Math.sin(s * Math.PI) + 0.12 * s * s * s))));
      const n = norm(add(mul(h, 0.5), [0, 0.7, 0])), w = (Lb * 0.30 + 0.22) * wide;
      M.ribbon([0, 0.5, 1].map((s) => ({ p: at(s), side: mul(side, w * (s === 1 ? 0.75 : 1)), n, s: lerp(0.30, 1, s) })), CELLS.spruceFlat, mat(0.5));
      // the fringe that hangs from it
      const hang = (Lb * 0.42 + 0.3) * wide, nh = norm(add(mul(h, 0.75), [0, 0.35, 0]));
      M.quad(at(0.05), at(1), add(at(1), [0, -hang * 0.7, 0]), add(at(0.05), [0, -hang, 0]), CELLS.spruceHang, nh, mat(1), 0.28, 0.95);
    }
  }
  // the leader
  for (let k = 0; k < 3; k++) { const az = k * 2.09, h = [Math.cos(az), 0, Math.sin(az)], top = T.axis(H); M.quad(add(top, [0, -1.5, 0]), add(top, [0, 0.5, 0]), add(add(top, [0, 0.5, 0]), mul(h, 0.01)), add(add(top, [0, -1.5, 0]), mul(h, 0.9)), CELLS.spruceFlat, norm(add(h, UP)), mat(0.4), 1, 1); }
  // dead lower branches: bare forks, grey
  if (d > 0.9) for (let y = cb * 0.35; y < cb; y += 0.9 + R()) {
    const az = R() * 6.28, h = [Math.cos(az), 0, Math.sin(az)], side = cross(h, UP), base = T.axis(y), L = 1.0 + 1.4 * R();
    // a dead stub and the fork it ends in
    const mid = add(add(base, mul(h, L * 0.6)), [0, -L * 0.12, 0]), tip = add(add(base, mul(h, L)), [0, -L * 0.34, 0]);
    M.tube([{ p: base, r: 0.035 }, { p: mid, r: 0.02 }, { p: tip, r: 0.008 }], 3, [0, SPECIES.snag, 0.2, 0.7]);
    M.tube([{ p: mid, r: 0.014 }, { p: add(mid, add(mul(side, L * 0.3 * (R() - 0.5) * 2), [0, -L * 0.25, 0])), r: 0.006 }], 3, [0, SPECIES.snag, 0.1, 0.7]);
  }
  return { mesh: M, H, crown: 3.4, cover: 0.95, broad: 0 };
}

function pine(R, d) {
  const M = new Mesh(), H = 20 + R() * 9, r0 = 0.19 + H * 0.006, T = trunk(M, R, H, r0, 0.5, 0.25, d > 0.9 ? 8 : 5, SPECIES.pine);
  const cb = H * (0.55 + 0.12 * R()), limbs = d > 0.9 ? 12 : 7, mat = () => [1, R(), 0.7, 1];
  const tuft = (p, dir, size, shade) => {
    const up = norm(add(mul(dir, 0.5), [0, 0.8, 0])), a = norm(cross(up, [R() - 0.5, R() - 0.5, R() - 0.5]));
    for (let k = 0; k < (d > 0.9 ? 3 : 2); k++) {
      const ang = k * Math.PI / (d > 0.9 ? 3 : 2), b = cross(up, a), s = add(mul(a, Math.cos(ang)), mul(b, Math.sin(ang))), top = add(p, mul(up, size));
      M.quad(add(top, mul(s, -size * 0.55)), add(top, mul(s, size * 0.55)), add(p, mul(s, size * 0.55)), add(p, mul(s, -size * 0.55)), CELLS.pine, norm(add(up, mul(dir, 0.6))), mat(), shade, shade);
    }
  };
  for (let i = 0; i < limbs; i++) {
    const t = i / (limbs - 1), y = lerp(cb, H - 1.2, t), az = i * 2.4 + R(), h = [Math.cos(az), 0, Math.sin(az)], L = (2.0 + 2.6 * R()) * (1 - 0.45 * t), rise = 0.25 + 0.5 * R();
    const base = T.axis(y), at = (s) => add(base, add(mul(h, L * s), mul(UP, L * (rise * s + 0.35 * s * s))));
    M.tube([0, 0.35, 0.7, 1].map((s) => ({ p: at(s), r: lerp(0.075, 0.02, s) * (1 + r0) })), d > 0.9 ? 5 : 3, [0, SPECIES.pine, 0.4, 0.8]);
    for (const s of d > 0.9 ? [0.45, 0.65, 0.85, 1] : [0.55, 0.8, 1]) tuft(at(s), h, (0.9 + 0.7 * R()) * (d > 0.9 ? 1 : 1.25), lerp(0.55, 1, s));
    for (const sgn of [-1, 1]) { const h2 = norm(add(h, mul(cross(h, UP), sgn * 0.9))), p = add(at(0.6), mul(h2, L * 0.45)); tuft(add(p, [0, L * 0.2, 0]), h2, 0.9 + 0.6 * R(), 0.85); }
  }
  tuft(T.axis(H - 0.6), UP, 1.9, 1); tuft(T.axis(H - 1.8), [1, 0, 0], 1.6, 0.9);
  return { mesh: M, H, crown: 3.0, cover: 0.6, broad: 0 };
}

function cedar(R, d) {
  const M = new Mesh(), H = 26 + R() * 10, r0 = 0.30 + H * 0.008, T = trunk(M, R, H, r0, 0.3, 1.3, d > 0.9 ? 9 : 5, SPECIES.cedar);
  const cb = H * (0.16 + 0.1 * R()), gap = d > 0.9 ? 0.5 : 1.3, per = d > 0.9 ? 3 : 2, big = d > 0.9 ? 1 : 1.6, mat = () => [1, R(), 1, 1];
  let turn = R() * 6.28;
  for (let y = cb; y < H - 0.8; y += gap * (0.8 + 0.4 * R())) {
    const t = (y - cb) / (H - cb), L = (0.5 + 4.2 * (1 - t) ** 0.8) * Math.min(1, 0.45 + t * 4);
    for (let k = 0; k < per; k++) {
      turn += 2.4;
      const az = turn + (R() - 0.5) * 0.6, h = [Math.cos(az), 0, Math.sin(az)], side = cross(h, UP), Lb = L * (0.75 + 0.5 * R()), base = T.axis(y);
      // a J: down and out, then up at the tip
      const at = (s) => add(base, add(mul(h, Lb * s), mul(UP, Lb * (-0.42 * Math.sin(s * 2.6) + 0.30 * s * s * s))));
      // sprays hang from the branch in a row, and one across at the tip
      const n = Math.max(1, Math.round(Lb / (1.0 * big)));
      for (let j = 0; j < n; j++) {
        const s0 = (j + 0.1) / n, s1 = (j + 1.1) / n, a = at(Math.min(1, s0)), b = at(Math.min(1, s1)), drop = (0.9 + 0.7 * R()) * big, sh = lerp(0.32, 1, (s0 + s1) / 2);
        M.quad(a, b, add(b, [0, -drop, 0]), add(a, [0, -drop, 0]), CELLS.cedar, norm(add(mul(h, 0.7), [0, 0.4, 0])), mat(), sh, sh);
      }
      const tip = at(1), w = 0.6 * big, drop = (1.0 + 0.5 * R()) * big;
      M.quad(add(tip, mul(side, -w)), add(tip, mul(side, w)), add(add(tip, mul(side, w)), [0, -drop, 0]), add(add(tip, mul(side, -w)), [0, -drop, 0]), CELLS.cedar, norm(add(h, [0, 0.5, 0])), mat(), 1, 1);
    }
  }
  // the top nods to one side
  const top = T.axis(H), nod = [Math.cos(turn), 0, Math.sin(turn)];
  M.quad(add(top, [0, -0.6, 0]), add(add(top, mul(nod, 1.1)), [0, 0.2, 0]), add(add(top, mul(nod, 1.1)), [0, -1.6, 0]), add(top, [0, -2.2, 0]), CELLS.cedar, norm(add(nod, UP)), mat(), 1, 1);
  return { mesh: M, H, crown: 3.8, cover: 0.97, broad: 0 };
}

function birch(R, d, leafed) {
  const M = new Mesh(), H = 15 + R() * 8, r0 = 0.10 + H * 0.0045, T = trunk(M, R, H, r0, 0.9, 0.2, d > 0.9 ? 7 : 4, SPECIES.birch, 0.97, 16);
  const cell = leafed ? CELLS.birchLeaf : CELLS.birchBare, limbs = d > 0.9 ? 9 : 5, mat = () => [1, R(), 1.4, 1], big = d > 0.9 ? 1 : 1.5;
  // twigs weep from a point: two crossed cards
  const weep = (p, size, shade) => { const a = R() * 3.14; for (let k = 0; k < (d > 0.9 ? 2 : 1); k++) { const s = [Math.cos(a + k * 1.57), 0, Math.sin(a + k * 1.57)]; M.quad(add(add(p, mul(s, -size * 0.5)), [0, 0.15, 0]), add(add(p, mul(s, size * 0.5)), [0, 0.15, 0]), add(add(p, mul(s, size * 0.5)), [0, -size, 0]), add(add(p, mul(s, -size * 0.5)), [0, -size, 0]), cell, norm(add(cross(s, UP), [0, 0.6, 0])), mat(), shade, shade); } };
  for (let i = 0; i < limbs; i++) {
    const t = i / (limbs - 1), y = lerp(H * 0.36, H * 0.9, t), az = i * 2.2 + R() * 0.8, h = [Math.cos(az), 0, Math.sin(az)], L = H * (0.34 - 0.18 * t) * (0.8 + 0.4 * R());
    // a steep limb that curves upward
    const base = T.axis(y), at = (s) => add(base, add(mul(h, L * (0.55 * s + 0.1 * Math.sin(s * 3.1))), mul(UP, L * (0.75 * s + 0.15 * s * s))));
    M.tube([0, 0.3, 0.6, 1].map((s) => ({ p: at(s), r: lerp(0.5, 0.1, s) * T.radius(y) + 0.008 })), d > 0.9 ? 5 : 3, [0, SPECIES.birch, 0.3, 0.9]);
    for (const s of d > 0.9 ? [0.45, 0.7, 0.9, 1] : [0.6, 1]) weep(add(at(s), mul(cross(h, UP), (R() - 0.5) * L * 0.3)), (1.5 + 1.2 * R()) * big, lerp(0.6, 1, s));
    if (d > 0.9) { const h2 = norm(add(h, mul(cross(h, UP), R() > 0.5 ? 1 : -1))), p0 = at(0.5), p1 = add(p0, add(mul(h2, L * 0.3), [0, L * 0.25, 0])); M.tube([{ p: p0, r: 0.02 }, { p: p1, r: 0.008 }], 3, [0, SPECIES.birch, 0.1, 0.9]); weep(p1, 1.4 + R(), 0.9); }
  }
  weep(T.axis(H * 0.97), 1.8 * big, 1);
  return { mesh: M, H, crown: 2.6, cover: leafed ? 0.5 : 0.22, broad: 1 };
}

function snag(R, d) {
  const M = new Mesh(), H = 18 + R() * 8, top = 0.35 + 0.35 * R(), T = trunk(M, R, H, 0.22 + H * 0.006, 0.3, 0.5, d > 0.9 ? 7 : 4, SPECIES.snag, top, 9);
  for (let i = 0; i < (d > 0.9 ? 7 : 3); i++) {
    const y = H * top * (0.3 + 0.65 * R()), az = R() * 6.28, h = [Math.cos(az), 0, Math.sin(az)], side = cross(h, UP), base = T.axis(y), L = 0.8 + 1.6 * R();
    M.tube([{ p: base, r: 0.05 }, { p: add(base, add(mul(h, L), [0, -L * 0.2, 0])), r: 0.012 }], 3, [0, SPECIES.snag, 0.2, 0.8]);
    if (d > 0.9) M.tube([{ p: add(base, add(mul(h, L * 0.6), [0, -L * 0.12, 0])), r: 0.02 }, { p: add(base, add(mul(h, L * 0.9), add(mul(side, L * 0.4), [0, L * 0.2, 0]))), r: 0.006 }], 3, [0, SPECIES.snag, 0.1, 0.8]);
  }
  return { mesh: M, H: H * top, crown: 0.8, cover: 0.05, broad: 0 };
}

// Every form the forest draws from: two of each species, each at two levels of detail.
// kind names what it is; near is the full tree, mid the same rule drawn with fewer, larger parts.
export const KINDS = ["spruce", "spruce", "spruce", "pine", "pine", "cedar", "cedar", "birch", "birch", "birchLeaf", "snag", "snag"];
export function growAll(seed = 20261118) {
  const make = { spruce, pine, cedar, birch: (R, d) => birch(R, d, false), birchLeaf: (R, d) => birch(R, d, true), snag };
  return KINDS.map((kind, i) => {
    const near = make[kind](rng(seed + i * 131), 1), mid = make[kind](rng(seed + i * 131), 0.4);
    return { kind, H: near.H, crown: near.crown, cover: near.cover, broad: near.broad, near: near.mesh.data, mid: mid.mesh.data };
  });
}
