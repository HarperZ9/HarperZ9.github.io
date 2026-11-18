// Unit meshes and the instances that stand on the island: placeholder architecture at three
// scales from world.json (settlements and landmarks), and the trees and grass round the walker.
// An instance is 12 floats: place xyz, turn; size xyz, taper; colour rgb, kind (see mass.wgsl).
import { baseGround as groundAt, cellAt, hash2, CANOPY } from "./data.mjs";

// ---------------------------------------------------------------- meshes (position, normal)
function prism(sides, { cap = true } = {}) {
  const v = [], ring = (i) => { const a = (i / sides) * Math.PI * 2 + Math.PI / sides; return [Math.cos(a) * 0.5 / Math.cos(Math.PI / sides) * (sides === 4 ? 1 : Math.cos(Math.PI / sides)), Math.sin(a) * 0.5 / Math.cos(Math.PI / sides) * (sides === 4 ? 1 : Math.cos(Math.PI / sides))]; };
  for (let i = 0; i < sides; i++) {
    const [x0, z0] = ring(i), [x1, z1] = ring(i + 1), nx = x0 + x1, nz = z0 + z1, l = Math.hypot(nx, nz), n = [nx / l, 0, nz / l];
    v.push(x0, 0, z0, ...n, x1, 1, z1, ...n, x1, 0, z1, ...n, x0, 0, z0, ...n, x0, 1, z0, ...n, x1, 1, z1, ...n);
    if (cap) v.push(0, 1, 0, 0, 1, 0, x1, 1, z1, 0, 1, 0, x0, 1, z0, 0, 1, 0);
  }
  return new Float32Array(v);
}
function cone(sides) {
  const v = [];
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2, x0 = Math.cos(a0) * 0.5, z0 = Math.sin(a0) * 0.5, x1 = Math.cos(a1) * 0.5, z1 = Math.sin(a1) * 0.5;
    const am = (a0 + a1) / 2, n = [Math.cos(am) * 0.9, 0.45, Math.sin(am) * 0.9];
    v.push(x0, 0, z0, ...n, 0, 1, 0, ...n, x1, 0, z1, ...n);
  }
  return new Float32Array(v);
}
function dome(sides, rings) {
  const v = [], p = (i, j) => { const a = (i / sides) * Math.PI * 2, e = (j / rings) * Math.PI / 2; return [Math.cos(a) * Math.cos(e) * 0.5, Math.sin(e), Math.sin(a) * Math.cos(e) * 0.5]; };
  const nrm = (q) => { const l = Math.hypot(q[0] * 2, q[1], q[2] * 2); return [q[0] * 2 / l, q[1] / l, q[2] * 2 / l]; };
  for (let j = 0; j < rings; j++) for (let i = 0; i < sides; i++) {
    const a = p(i, j), b = p(i + 1, j), c = p(i + 1, j + 1), d = p(i, j + 1);
    for (const q of [a, c, b, a, d, c]) v.push(...q, ...nrm(q));
  }
  return new Float32Array(v);
}
function gable() {
  // a box to y = 0.6 with a ridge roof above, ridge along x
  const v = [], quad = (a, b, c, d, n) => { for (const q of [a, b, c, a, c, d]) v.push(...q, ...n); }, e = 0.5, w = 0.6;
  quad([-e, 0, e], [-e, w, e], [e, w, e], [e, 0, e], [0, 0, 1]); quad([e, 0, -e], [e, w, -e], [-e, w, -e], [-e, 0, -e], [0, 0, -1]);
  quad([e, 0, e], [e, w, e], [e, w, -e], [e, 0, -e], [1, 0, 0]); quad([-e, 0, -e], [-e, w, -e], [-e, w, e], [-e, 0, e], [-1, 0, 0]);
  quad([-e, w, e], [-e, 1, 0], [e, 1, 0], [e, w, e], [0, 0.78, 0.62]); quad([e, w, -e], [e, 1, 0], [-e, 1, 0], [-e, w, -e], [0, 0.78, -0.62]);
  for (const q of [[e, w, e], [e, 1, 0], [e, w, -e]]) v.push(...q, 1, 0, 0);
  for (const q of [[-e, w, -e], [-e, 1, 0], [-e, w, e]]) v.push(...q, -1, 0, 0);
  return new Float32Array(v);
}
export const MESHES = { box: prism(4), cyl: prism(12), cone: cone(7), dome: dome(12, 5), gable: gable() };

// ---------------------------------------------------------------- instance lists
class Lists {
  constructor() { this.l = { box: [], cyl: [], cone: [], dome: [], gable: [] }; }
  add(mesh, x, y, z, turn, sx, sy, sz, taper, col, kind) { this.l[mesh].push(x, y, z, turn, sx, sy, sz, taper, col[0], col[1], col[2], kind); }
  arrays() { return Object.fromEntries(Object.entries(this.l).map(([k, v]) => [k, new Float32Array(v)])); }
}

// the one local material of each region: wall, roof or accent, house height in metres
const VERNACULAR = {
  1: { wall: [0.20, 0.16, 0.13], tall: [5, 8], walled: true }, 2: { wall: [0.85, 0.84, 0.79], tall: [5, 7], walled: true },
  3: { wall: [0.15, 0.16, 0.13], tall: [5, 9], walled: true }, 4: { wall: [0.58, 0.64, 0.68], tall: [7, 13], walled: true },
  5: { wall: [0.70, 0.47, 0.29], tall: [4, 7], walled: true, flat: true }, 6: { wall: [0.60, 0.52, 0.30], tall: [4, 6], reed: true },
  7: { wall: [0.70, 0.54, 0.34], tall: [14, 30], flat: true }, 8: { wall: [0.36, 0.21, 0.15], tall: [6, 12], flat: true },
  9: { wall: [0.78, 0.76, 0.71], tall: [6, 11], walled: true, flat: true }, 10: { wall: [0.36, 0.40, 0.38], tall: [8, 16], flat: true },
  11: { wall: [0.80, 0.63, 0.63], tall: [9, 15], flat: true },
};
const PASTEL = [[0.80, 0.62, 0.62], [0.62, 0.78, 0.70], [0.84, 0.78, 0.56], [0.60, 0.70, 0.82]];
const STONE = [0.74, 0.72, 0.68], RUST = [0.38, 0.20, 0.13], SOOT = [0.12, 0.12, 0.13], BASALT = [0.10, 0.10, 0.12];

function town(L, w, s, seed) {
  const V = VERNACULAR[s.region] || VERNACULAR[9], cx = (s.x + 0.5) * w.cell, cz = (s.y + 0.5) * w.cell, rnd = (i, k) => hash2(seed + i * 7 + k, s.x * 131 + s.y);
  const radius = s.kind === "seat" ? 420 : s.kind === "town" ? 320 : s.kind === "village" ? 150 : 24, count = s.kind === "seat" ? 170 : s.kind === "town" ? 110 : s.kind === "village" ? 26 : 2;
  if (V.walled && (s.kind === "seat" || s.kind === "town")) {
    // a ring wall with gate towers: the ring town of the art direction
    const segs = 28, r = radius * 1.06, len = 2 * Math.PI * r / segs * 1.04;
    for (let i = 0; i < segs; i++) { const a = i / segs * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; L.add("box", x, groundAt(w, x, z) - 2, z, -a + Math.PI / 2, len, 11, 4, 1, V.wall.map((c) => c * 0.8), 0); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; L.add("box", x, groundAt(w, x, z) - 2, z, -a, 12, 20, 12, 1, V.wall.map((c) => c * 0.75), 1); }
  }
  for (let i = 0; i < count; i++) {
    const a = rnd(i, 1) * Math.PI * 2, d = Math.sqrt(rnd(i, 2)) * radius, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = groundAt(w, x, z);
    if (y < 0.3 && s.region !== 10) continue;
    const tall = V.tall[0] + (V.tall[1] - V.tall[0]) * rnd(i, 3), wide = 7 + 7 * rnd(i, 4), turn = Math.round(rnd(i, 5) * 4) * Math.PI / 4 + a;
    const col = s.region === 11 ? PASTEL[i % 4] : V.wall.map((c) => c * (0.85 + 0.3 * rnd(i, 6)));
    if (V.reed) L.add("dome", x, y - 0.3, z, turn, wide * 2.4, tall, wide, 1, col, 0);
    else L.add(V.flat ? "box" : "gable", x, y - 0.5, z, turn, wide * (V.flat ? 1.5 : 1.3), tall, wide, 1, col, 1);
  }
  if (s.kind === "house") L.add("gable", cx, groundAt(w, cx, cz) - 0.4, cz, 0.3, 14, 7, 8, 1, [0.90, 0.89, 0.85], 1);
}

function mark(L, w, m, seed) {
  const x = (m.x + 0.5) * w.cell, z = (m.y + 0.5) * w.cell, g = groundAt(w, x, z), y = g - 1, t = m.tall_m, s = m.size_m, turn = m.turn_deg * Math.PI / 180, r = (k) => hash2(seed + k, m.x * 977 + m.y);
  switch (m.kind) {
    case "tower": L.add("cyl", x, y, z, 0, s * 2.6, 60, s * 2.6, 0.8, STONE, 1); L.add("cyl", x, y, z, 0, s, t, s, 0.34, STONE, 1); L.add("cyl", x, y + t, z, 0, s * 0.3, 90, s * 0.3, 0.05, [1.0, 0.7, 0.3], 2); break;
    case "spire": L.add("cyl", x, y, z, turn, s, t, s, 0.22, STONE.map((c) => c * (0.8 + 0.25 * r(1))), 1); break;
    case "ziggurat": for (let i = 0; i < 6; i++) L.add("box", x, y + t * i / 6, z, turn, s * (1 - i * 0.15), t / 6, s * (1 - i * 0.15), 0.92, STONE.map((c) => c * (0.72 + 0.04 * i)), 1); break;
    case "dome": L.add("cyl", x, y, z, 0, s, t * 0.35, s, 1, STONE, 0); L.add("dome", x, y + t * 0.35, z, 0, s, t, s, 1, STONE, 0); break;
    case "starfort": for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, rr = s * (i % 2 ? 0.5 : 0.36), px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; L.add("box", px, groundAt(w, px, pz) - 2, pz, -a + Math.PI / 4, s * 0.3, t, s * 0.06, 0.9, STONE.map((c) => c * 0.7), 0); } break;
    case "prison": L.add("box", x, y, z, turn, s, t, s * 0.62, 1, [0.30, 0.29, 0.30], 1); L.add("box", x, y, z, turn, s * 0.2, t * 1.7, s * 0.2, 1, [0.26, 0.25, 0.26], 0); break;
    case "colonnade": for (let i = 0; i < 16; i++) { const d = (i - 7.5) * s / 16, px = x + Math.cos(turn) * d, pz = z - Math.sin(turn) * d; L.add("cyl", px, groundAt(w, px, pz) - 1, pz, 0, 5, t, 5, 0.85, STONE, 0); } L.add("box", x, y + t, z, turn, s, 5, 8, 1, STONE, 0); break;
    case "blackvolume": L.add("box", x, y, z, turn, s, t, s, 1, [0.015, 0.015, 0.02], 0); break;
    case "cypress": for (let i = 0; i < 14; i++) { const px = x + (r(i) - 0.5) * s, pz = z + (r(i + 40) - 0.5) * s; L.add("cone", px, groundAt(w, px, pz), pz, 0, 5, t * (0.7 + 0.5 * r(i + 80)), 5, 0, [0.05, 0.09, 0.07], 3); } break;
    case "furnace": L.add("cyl", x, y, z, 0, s, t, s, 0.62, RUST, 5); L.add("cyl", x, y + t, z, 0, s * 0.5, 8, s * 0.5, 0.8, [1.0, 0.45, 0.12], 2); L.add("box", x + s, y, z, turn, s * 1.6, t * 0.5, 10, 1, RUST.map((c) => c * 0.8), 5); break;
    case "stack": L.add("cyl", x, y, z, 0, s, t, s, 0.55, m.region === 11 ? [0.55, 0.52, 0.50] : [0.33, 0.24, 0.20], 0); L.add("cyl", x, y + t, z, 0, s * 0.5, 3, s * 0.5, 1, [1.0, 0.15, 0.08], 2); break;
    case "coolingtower": L.add("cyl", x, y, z, 0, s, t * 0.7, s, 0.6, [0.52, 0.50, 0.47], 5); L.add("cyl", x, y + t * 0.7, z, 0, s * 0.6, t * 0.3, s * 0.6, 1.12, [0.52, 0.50, 0.47], 0); break;
    case "tank": L.add("cyl", x, y, z, 0, s, t, s, 1, [0.50, 0.47, 0.42], 5); break;
    case "piperack": L.add("box", x, y + 1 + t * 0.6, z, turn, s, 2.2, 5, 1, m.region === 11 ? [0.66, 0.66, 0.62] : RUST, 5); for (let i = 0; i < 5; i++) { const d = (i - 2) * s / 5, px = x + Math.cos(turn) * d, pz = z - Math.sin(turn) * d; L.add("box", px, groundAt(w, px, pz) - 1, pz, turn, 1.2, t * 0.6 + 3, 4, 1, SOOT, 0); } break;
    case "church": case "chapel": L.add("gable", x, y, z, turn, s * 1.6, t * 0.5, s * 0.7, 1, m.kind === "chapel" ? [0.92, 0.90, 0.85] : [0.34, 0.32, 0.30], 1); L.add("box", x + Math.cos(turn) * s * 0.9, y, z - Math.sin(turn) * s * 0.9, turn, s * 0.4, t * 0.75, s * 0.4, 1, [0.32, 0.30, 0.29], 0); L.add("cone", x + Math.cos(turn) * s * 0.9, y + t * 0.75, z - Math.sin(turn) * s * 0.9, 0, s * 0.45, t * 0.4, s * 0.45, 0, SOOT, 0); break;
    case "slab": L.add("box", x, y, z, Math.round(r(1) * 2) * Math.PI / 2, s, t, 14, 1, PASTEL[Math.floor(r(2) * 4)], 1); break;
    case "saucer": L.add("cyl", x, y, z, 0, s * 0.35, t * 0.6, s * 0.35, 1, [0.6, 0.6, 0.6], 0); L.add("cyl", x, y + t * 0.6, z, 0, s * 0.5, t * 0.3, s * 0.5, 2.0, [0.72, 0.72, 0.70], 1); L.add("dome", x, y + t * 0.9, z, 0, s, t * 0.5, s, 1, [0.72, 0.72, 0.70], 0); break;
    case "ringblock": for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, px = x + Math.cos(a) * s / 2, pz = z + Math.sin(a) * s / 2; L.add("box", px, groundAt(w, px, pz) - 1, pz, -a + Math.PI / 2, s * 0.24, t, 12, 1, PASTEL[2], 1); } break;
    case "relic": L.add("box", x, y, z, turn, s * 0.4, t, s * 0.4, 0.7, [0.50, 0.50, 0.50], 0); L.add("dome", x, y + t, z, 0, s, s * 0.35, s, 1, [0.60, 0.20, 0.16], 0); break;
    case "tenement": L.add("box", x, y, z, Math.round(r(1) * 2) * Math.PI / 2 + 0.2, s, t, s * 0.3, 1, VERNACULAR[7].wall.map((c) => c * (0.6 + 0.5 * r(2))), 1); break;
    case "decotower": for (let i = 0; i < 4; i++) L.add("box", x, y + t * (1 - 0.5 ** i), z, turn, s * 0.7 ** i, t * 0.5 ** (i + 1) + 1, s * 0.7 ** i, 1, [0.62, 0.58, 0.50], 1); L.add("cyl", x, y + t * 0.94, z, 0, 3, 30, 3, 0.1, [0.5, 1.0, 0.7], 2); break;
    case "glasshall": L.add("box", x, y, z, turn, s, t, s * 0.6, 1, [0.20, 0.42, 0.34], 2); break;
    case "drowned": L.add("box", x, Math.min(g, 0) - 1, z, Math.round(r(1) * 2) * Math.PI / 2 + 0.2, s, t + Math.max(0, -g), s * 0.35, 1, VERNACULAR[10].wall.map((c) => c * (0.7 + 0.4 * r(2))), r(3) > 0.8 ? 1 : 0); break;
    case "seastack": L.add("cyl", x, g - 1, z, turn, s, t - g, s * (0.6 + 0.6 * r(1)), 0.5 + 0.3 * r(2), BASALT, 0); break;
    case "lighthouse": L.add("cyl", x, y, z, 0, s, t, s, 0.6, [0.90, 0.89, 0.86], 0); L.add("cyl", x, y + t, z, 0, s * 0.7, 4, s * 0.7, 1, [1.0, 0.85, 0.5], 2); break;
    case "mudhif": L.add("dome", x, y - 0.3, z, turn, s, t, s * 0.42, 1, [0.62, 0.53, 0.30], 0); break;
    case "cairn": L.add("cone", x, y, z, 0, s, t, s, 0, [0.40, 0.39, 0.38], 0); break;
    case "stairs": for (let i = 0; i < 8; i++) { const d = i * s / 8, px = x + Math.cos(turn) * d, pz = z - Math.sin(turn) * d; L.add("box", px, groundAt(w, px, pz) - 2, pz, turn, s / 8 + 1, 3, 9, 1, [0.20, 0.25, 0.18], 0); } break;
    case "shrine": L.add("gable", x, y, z, turn, s, t, s, 1, [0.30, 0.12, 0.10], 0); break;
    case "cashmachine": L.add("box", x, y, z, turn, 1.2, 2.1, 0.9, 1, [0.55, 0.56, 0.58], 0); L.add("box", x, y + 1.1, z + 0.5, turn, 0.8, 0.5, 0.1, 1, [0.5, 0.8, 1.0], 2); break;
    case "motelsign": L.add("box", x, y, z, turn, 0.4, t, 0.4, 1, SOOT, 0); L.add("box", x, y + t - 3, z, turn, s, 2.6, 0.5, 1, [1.0, 0.2, 0.25], 2); break;
  }
}

// owns says which settlements and landmarks are built for real elsewhere (build/built.mjs)
export function architecture(w, owns = { settlement: () => false, mark: () => false }) {
  const L = new Lists(), seed = w.json.seed % 100000;
  for (const s of w.json.settlements) if (!owns.settlement(s)) town(L, w, s, seed);
  for (const m of w.json.marks) if (!owns.mark(m)) mark(L, w, m, seed);
  return L.arrays();
}

// ---------------------------------------------------------------- trees and grass round a point
// Trees are made a 128 m cell at a time and kept; the caller asks for the cells within `reach`.
const TREE_CELL = 128, cache = new Map();
function treeCell(w, cx, cz, out) {
  const key = cx * 4096 + cz; let list = cache.get(key);
  if (!list) {
    list = [];
    for (let i = 0; i < 40; i++) {
      const x = (cx + hash2(cx * 31 + i, cz * 17 + 1)) * TREE_CELL, z = (cz + hash2(cx * 13 + i, cz * 29 + 2)) * TREE_CELL;
      if (x < 0 || z < 0 || x >= w.width || z >= w.depth) continue;
      const k = cellAt(w, x, z), b = w.biome[k], roll = hash2(cx * 7 + i * 3, cz * 11 + 5);
      if (roll > CANOPY[b] || w.height[k] < 0.4) continue;
      const y = groundAt(w, x, z), q = hash2(cx + i * 5, cz * 3 + 9), turn = q * 6.28;
      if (b === 5 && q > 0.66) {                                                                                     // birch: a pale bare trunk, a thin crown in its autumn
        const tall = 15 + 9 * roll;
        list.push("cyl", x, y - 0.5, z, turn, 0.45, tall, 0.45, 0.5, 0.62, 0.60, 0.56, 3);
        list.push("cyl", x, y + tall * 0.55, z, turn, 4 + 3 * roll, tall * 0.5, 4 + 3 * roll, 0.3, 0.30, 0.20 + 0.06 * roll, 0.07, 3);
      } else if (b === 5) {                                                                                             // conifer: a dark trunk and a tall narrow crown that starts above the head
        const tall = 24 + 16 * roll;
        list.push("cyl", x, y - 0.5, z, turn, 0.7, tall * 0.5, 0.7, 0.7, 0.06, 0.05, 0.05, 3);
        list.push("cone", x, y + 3.5, z, turn, 6 + 3 * q, tall, 6 + 3 * q, 0, 0.035, 0.07, 0.062, 3);
      }
      else if (b === 6 && q > 0.5) list.push("cone", x, y - 0.5, z, turn, 3 + 2 * q, 9 + 8 * q, 3 + 2 * q, 0, 0.06, 0.09, 0.08, 3);                              // thin spruce
      else if (b === 6) list.push("cyl", x, y - 0.5, z, turn, 0.35, 8 + 6 * roll, 0.35, 0.4, 0.60, 0.58, 0.55, 3);                                         // a bare birch pole
      else if (b === 3) list.push("cone", x, y - 0.2, z, turn, 5, 2.6 + q, 5, 0.6, 0.55, 0.47, 0.24, 4);                                                           // reed clump
      else if (b === 11 && w.river[k] > 0) list.push("cyl", x, y - 0.5, z, turn, 12, 14, 12, 0.6, 0.72, 0.58, 0.16, 3);                                           // cottonwood by water
      else list.push("cone", x, y - 0.5, z, turn, 4.5 + 2 * q, 9 + 6 * q, 4.5 + 2 * q, 0, 0.07, 0.10, 0.08, 3);                                                                      // a lone tree
    }
    cache.set(key, list);
    if (cache.size > 6000) cache.delete(cache.keys().next().value);
  }
  for (let i = 0; i < list.length; i += 13) out[list[i]].push(list[i + 1], list[i + 2], list[i + 3], list[i + 4], list[i + 5], list[i + 6], list[i + 7], list[i + 8], list[i + 9], list[i + 10], list[i + 11], list[i + 12]);
}
export function flora(w, x, z, reach = 2200, grassReach = 90) {
  const out = { cone: [], cyl: [] }, c0 = Math.floor((x - reach) / TREE_CELL), c1 = Math.floor((x + reach) / TREE_CELL), d0 = Math.floor((z - reach) / TREE_CELL), d1 = Math.floor((z + reach) / TREE_CELL);
  for (let cz = d0; cz <= d1; cz++) for (let cx = c0; cx <= c1; cx++) {
    const mx = (cx + 0.5) * TREE_CELL - x, mz = (cz + 0.5) * TREE_CELL - z;
    if (mx * mx + mz * mz < reach * reach) treeCell(w, cx, cz, out);
  }
  // grass masses: tussocks on a 0.7 m lattice near the walker, coloured from the ground they stand on
  const G = 0.7, g0 = Math.floor((x - grassReach) / G), g1 = Math.floor((x + grassReach) / G), h0 = Math.floor((z - grassReach) / G), h1 = Math.floor((z + grassReach) / G);
  for (let gz = h0; gz <= h1; gz++) for (let gx = g0; gx <= g1; gx++) {
    const px = (gx + hash2(gx, gz)) * G, pz = (gz + hash2(gx + 99, gz)) * G, dx = px - x, dz = pz - z;
    if (dx * dx + dz * dz > grassReach * grassReach || px < 0 || pz < 0 || px >= w.width || pz >= w.depth) continue;
    const k = cellAt(w, px, pz), b = w.biome[k];
    if (!(b === 3 || b === 4 || b === 5 || b === 6 || b === 11 || b === 12) || w.height[k] < 0.5) continue;
    const q = hash2(gx * 3 + 1, gz * 5 + 2), col = b === 4 ? [0.30, 0.40, 0.17] : b === 11 ? [0.56, 0.49, 0.28] : b === 12 ? [0.36, 0.27, 0.24] : b === 3 ? [0.50, 0.44, 0.24] : [0.16, 0.22, 0.14];
    if (q < 0.45) continue;
    // a tussock is a thin spike; one in forty is a knee-high shrub
    const shrub = q > 0.985, dark = 0.35 + 0.5 * hash2(gx * 7 + 3, gz * 3 + 8), wide = shrub ? 0.9 : 0.08 + 0.10 * q, tall = shrub ? 0.7 : 0.18 + 0.40 * q;
    out.cone.push(px, groundAt(w, px, pz) - 0.03, pz, q * 6.28, wide, tall, wide, 0, col[0] * dark, col[1] * dark, col[2] * dark, 4);
  }
  return { cone: new Float32Array(out.cone), cyl: new Float32Array(out.cyl) };
}
