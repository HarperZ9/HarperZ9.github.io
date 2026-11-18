// The works: industry built as a cathedral. world.json gives furnaces, stacks, cooling towers,
// tanks and pipe racks; each becomes the real thing here, and round every furnace stands the
// plant that serves it. Steel is shown the way it reads at night: vessels and columns inside
// scaffolds of lattice, platforms with hand rails every few metres up, ladders, lagged pipes in
// racks between everything, and a lamp at every landing: white, mercury green and sodium.
import { Kit, frame, put } from "./kit.mjs";
import { CELLS } from "../flora/atlas.mjs";
import { rng } from "../flora/grow.mjs";
import { baseGround } from "../data.mjs";
import { HUE } from "../lights.mjs";

const KINDS = new Set(["furnace", "stack", "coolingtower", "tank", "piperack"]);
export const owns = (m) => m.region === 8 && KINDS.has(m.kind);
const STEEL = [0.050, 0.060, 0.058], OXIDE = [0.20, 0.050, 0.032], YELLOW = [0.42, 0.33, 0.04], PALE = [0.33, 0.35, 0.34];

export function plans(world) {
  const marks = world.json.marks.filter(owns);
  if (!marks.length) return [];
  const cx = marks.reduce((a, m) => a + m.x, 0) / marks.length * world.cell, cz = marks.reduce((a, m) => a + m.y, 0) / marks.length * world.cell;
  const at = marks.map((m) => ({ ...m, wx: (m.x + 0.5) * world.cell, wz: (m.y + 0.5) * world.cell }));
  return [{ cx, cz, marks: at, reach: Math.max(...at.map((m) => Math.hypot(m.wx - cx, m.wz - cz))) + 260 }];
}
// the yards: poured concrete wherever plant stands
export function stamp(P, { B, rect, KIND }) {
  for (const m of P.marks) { const r = m.kind === "furnace" ? 150 : m.kind === "piperack" ? m.size_m * 0.6 + 12 : m.size_m + 30; rect(m.wx, m.wz, 0, r, r, 0, (k, u, v) => { if (Math.hypot(u, v) < r && B[k] < 255) { B[k] = 255; B[k + 1] = KIND.concrete; B[k + 3] = Math.max(B[k + 3], 70); } }); }
}

export function mesh(world, P, lights) {
  const K = new Kit(), O = [P.cx, 0, P.cz], R = rng(world.json.seed + 8088), g = (x, z) => Math.max(0.6, baseGround(world, x + O[0], z + O[2]));
  const lamp = (x, y, z, kind = null) => {
    const k = kind || (R() < 0.5 ? "white" : R() < 0.6 ? "mercury" : "sodium");
    const o = k === "red" ? { power: 14, reach: 8, haze: 0, size: 0.22, flicker: 0 } : k === "sodium" ? { power: 46, reach: 20, mono: 1, size: 0.16 } : k === "flare" ? { power: 700, reach: 140, size: 1.6, flicker: 0.5, glow: 0.12, always: true } : { power: 30, reach: 17, size: 0.14 };
    lights.add({ x: x + O[0], y, z: z + O[2], col: HUE[k], ...o });
  };
  // a lamp seen and not counted: one of the hundreds on rails and landings that light only themselves
  const dot = (x, y, z) => { const k = R() < 0.55 ? "white" : R() < 0.6 ? "mercury" : "sodium"; lights.add({ x: x + O[0], y, z: z + O[2], col: HUE[k], power: 16 + 22 * R(), reach: 0, haze: 0, size: 0.12, flicker: R() < 0.04 ? 0.7 : 0 }); };
  // a ring of hand rail at a radius, and the deck it guards
  const landing = (x, y, z, r0, r1, paint) => {
    K.lathe(x, y, z, [[r0, 0], [r1, 0], [r1, 0.1], [r0, 0.1]], 14, [20, ...paint]);
    for (let i = 0; i < 10; i++) { const a0 = i / 10 * 6.2832, a1 = (i + 1) / 10 * 6.2832, p = (a, h) => [x + Math.cos(a) * r1, y + h, z + Math.sin(a) * r1]; K.cardAt(p(a0, 1.15), p(a1, 1.15), p(a1, 0.1), p(a0, 0.1), CELLS.rail, [23, 1, 0, 0], 2); }
  };
  // lattice round a square footprint, in tiers: the scaffold a vessel stands in
  const scaffold = (x, y, z, half, h, tier = 5) => {
    for (let t = 0; t * tier < h; t++) { const y0 = y + t * tier, y1 = Math.min(y + h, y0 + tier); for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) K.cardAt([x + ax * half, y1, z + az * half], [x + bx * half, y1, z + bz * half], [x + bx * half, y0, z + bz * half], [x + ax * half, y0, z + az * half], CELLS.lattice, [23, R() < 0.6 ? 1 : 0, 0, 0], Math.max(1, Math.round(half * 2 / tier))); }
    for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { K.box(frame(x + ax * half, y, z + az * half), -0.22, 0, -0.22, 0.22, h, 0.22, [20, ...STEEL], false); for (let t = tier; t < h; t += tier) if (R() < 0.7) dot(x + ax * half, y + t - 0.5, z + az * half); }
  };
  // a column: a tall vessel with landings, a ladder and a line coming off its head
  const column = (x, z, r, h, lagged = true) => {
    const y = g(x, z);
    K.lathe(x, y, z, [[r * 1.15, 0], [r * 1.15, 1.5], [r, 2.0], [r, h - r], [r * 0.6, h - r * 0.25], [0.2, h]], 14, lagged ? [24, R(), 0, 0] : [21, R(), 0, 0]);
    for (let py = 6 + R() * 3; py < h; py += 6 + R() * 3) { landing(x, y + py, z, r, r + 1.2, STEEL); const a = R() * 6.28; lamp(x + Math.cos(a) * (r + 1.0), y + py + 2.0, z + Math.sin(a) * (r + 1.0)); if (R() < 0.5) lamp(x - Math.cos(a) * (r + 1.0), y + py + 2.0, z - Math.sin(a) * (r + 1.0)); }
    const a = R() * 6.28, lx = x + Math.cos(a) * (r + 0.5), lz = z + Math.sin(a) * (r + 0.5), sx = -Math.sin(a) * 0.5, sz = Math.cos(a) * 0.5;
    K.cardAt([lx - sx, y + h * 0.95, lz - sz], [lx + sx, y + h * 0.95, lz + sz], [lx + sx, y, lz + sz], [lx - sx, y, lz - sz], CELLS.ladder, [23, 1, 0, 0]);
    // the overhead line: up off the head, over, and down to the rack
    const b = a + 2, ox = x + Math.cos(b) * (r + 2.5), oz = z + Math.sin(b) * (r + 2.5);
    K.pipe([[x, y + h - 0.3, z], [x, y + h + 1.2, z], [ox, y + h + 1.2, oz], [ox, y + 7, oz]], 0.22 + 0.15 * R(), 6, [24, R(), 0, 0]);
    if (h > 30) lamp(x, y + h + 1.8, z, "red");
  };
  const sphere = (x, z, r) => {
    const y = g(x, z), cy = r * 1.25, prof = []; for (let i = 0; i <= 10; i++) { const t = i / 10 * Math.PI; prof.push([Math.max(0.01, Math.sin(t) * r), cy - Math.cos(t) * r]); }
    K.lathe(x, y, z, prof, 16, [20, ...PALE]);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; K.pipe([[x + Math.cos(a) * r * 0.82, y, z + Math.sin(a) * r * 0.82], [x + Math.cos(a) * r * 0.82, y + cy, z + Math.sin(a) * r * 0.82]], 0.2, 5, [20, ...STEEL]); }
    landing(x, y + cy + r - 0.3, z, 0.3, 1.8, YELLOW); lamp(x, y + cy + r + 1.9, z);
  };
  // a pipe rack from a to b: portal frames, two tiers of lines, lattice between, lamps under it
  const rack = (ax, az, bx, bz, H) => {
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, px = -uz, pz = ux, wide = 3.2, n = Math.max(2, Math.round(len / 7));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ax + ux * len * t, z = az + uz * len * t, y = g(x, z), f = frame(x, y, z, Math.atan2(-uz, ux));
      for (const s of [-1, 1]) K.box(frame(x + px * wide * s, y, z + pz * wide * s), -0.16, -0.5, -0.16, 0.16, H, 0.16, [20, ...STEEL], false);
      for (const hh of [H * 0.62, H - 0.3]) K.box(f, -0.12, hh, -wide - 0.4, 0.12, hh + 0.3, wide + 0.4, [20, ...STEEL]);
      if (i % 2 === 0 && i < n) lamp(x + px * (R() - 0.5) * wide, y + H * 0.62 - 0.4, z + pz * (R() - 0.5) * wide); else dot(x + px * wide, y + H + 1.2, z + pz * wide);
    }
    const y0 = g(ax, az), y1 = g(bx, bz);
    for (const [tier, count] of [[H * 0.62 + 0.3, 5], [H, 4]]) for (let k = 0; k < count; k++) {
      const off = ((k + 0.5) / count * 2 - 1) * wide * 0.92, r = 0.14 + 0.3 * R() * R(), m = R() < 0.55 ? [24, R(), 0, 0] : R() < 0.5 ? [20, ...OXIDE] : [21, R(), 0, 0];
      const pts = [[ax + px * off, y0 + tier + r, az + pz * off]];
      // an expansion loop: the line steps up and over and comes back down
      if (R() < 0.4 && len > 40) { const t = 0.3 + 0.4 * R(), w = 3; for (const [dt, dy] of [[-w, 0], [-w, 2.2], [w, 2.2], [w, 0]]) { const s = t * len + dt; pts.push([ax + ux * s + px * off, y0 + (y1 - y0) * t + tier + r + dy, az + uz * s + pz * off]); } }
      pts.push([bx + px * off, y1 + tier + r, bz + pz * off]);
      K.pipe(pts, r, 6, m);
    }
    for (const s of [-1, 1]) K.cardAt([ax + px * wide * s, y0 + H, az + pz * wide * s], [bx + px * wide * s, y1 + H, bz + pz * wide * s], [bx + px * wide * s, y1 + H * 0.62, bz + pz * wide * s], [ax + px * wide * s, y0 + H * 0.62, az + pz * wide * s], CELLS.lattice, [23, 1, 0, 0], Math.max(1, Math.round(len / (H * 0.38))));
    K.cardAt([ax + px * (wide + 0.4), y0 + H + 1.5, az + pz * (wide + 0.4)], [bx + px * (wide + 0.4), y1 + H + 1.5, bz + pz * (wide + 0.4)], [bx + px * (wide + 0.4), y1 + H + 0.4, bz + pz * (wide + 0.4)], [ax + px * (wide + 0.4), y0 + H + 0.4, az + pz * (wide + 0.4)], CELLS.rail, [23, 1, 0, 0], Math.max(1, Math.round(len / 4)));
  };
  const shed = (x, z, w, d, h, turn, hot = false) => {
    const y = g(x, z), f = frame(x, y, z, turn), col = R() < 0.5 ? [0.10, 0.13, 0.14] : [0.16, 0.10, 0.08];
    K.box(f, -w / 2, -0.5, -d / 2, w / 2, h, d / 2, [25, ...col], false);
    K.face(f, [-w / 2, h, d / 2], [w / 2, h, d / 2], [w / 2, h + w * 0.12, 0], [-w / 2, h + w * 0.12, 0], [25, ...col]); K.face(f, [w / 2, h, -d / 2], [-w / 2, h, -d / 2], [-w / 2, h + w * 0.12, 0], [w / 2, h + w * 0.12, 0], [25, ...col]);
    for (const s of [-1, 1]) { const z0 = s * (d / 2 + 0.05); if (s > 0) K.face(f, [-w / 2 + 1, h * 0.72, z0], [w / 2 - 1, h * 0.72, z0], [w / 2 - 1, h * 0.72 + 1.6, z0], [-w / 2 + 1, h * 0.72 + 1.6, z0], [27, R(), 0, 0]); else K.face(f, [w / 2 - 1, h * 0.72, z0], [-w / 2 + 1, h * 0.72, z0], [-w / 2 + 1, h * 0.72 + 1.6, z0], [w / 2 - 1, h * 0.72 + 1.6, z0], [27, R(), 0, 0]); }
    if (hot) {
      // the cast house door: iron running inside, and its light out over the yard
      K.face(f, [-4, 0.2, d / 2 + 0.08], [4, 0.2, d / 2 + 0.08], [4, 6, d / 2 + 0.08], [-4, 6, d / 2 + 0.08], [16, 1.0, 0.42, 0.10]);
      const p = put(f, [0, 3, d / 2 + 3]); lights.add({ x: p[0] + O[0], y: p[1], z: p[2] + O[2], col: HUE.flare, power: 260, reach: 60, size: 0, glow: 0, flicker: 0.4 });
    }
    for (const cx of [-w / 2, w / 2]) { const p = put(f, [cx, h - 1, d / 2 + 0.6]); lamp(p[0], p[1], p[2], "sodium"); }
  };
  const stack = (x, z, r, t, bands = true) => {
    const y = g(x, z);
    K.lathe(x, y, z, [[r, -1], [r * 0.82, t * 0.25], [r * 0.6, t], [r * 0.5, t], [r * 0.5, t - 2]], 18, bands ? [26, t, 0, 0] : [22, R(), 0, 0]);
    for (const hh of [0.5, 0.75, 1]) for (let i = 0; i < 3; i++) { const a = i * 2.094 + hh, rr = r * (0.82 - 0.22 * hh) + 0.3; lamp(x + Math.cos(a) * rr, y + t * hh, z + Math.sin(a) * rr, "red"); }
  };

  const furnaces = P.marks.filter((m) => m.kind === "furnace");
  for (const m of P.marks) {
    const x = m.wx - O[0], z = m.wz - O[2], y = g(x, z), turn = m.turn_deg * Math.PI / 180, ux = Math.cos(turn), uz = -Math.sin(turn);
    if (m.kind === "furnace") {
      const r = m.size_m * 0.13, h = m.tall_m;
      // the furnace: hearth, bosh, stack and throat, inside its tower
      K.lathe(x, y, z, [[r * 1.1, 0], [r * 1.1, h * 0.10], [r * 1.3, h * 0.17], [r * 1.05, h * 0.24], [r * 0.72, h * 0.52], [r * 0.6, h * 0.58], [r * 0.9, h * 0.62], [r * 0.3, h * 0.70]], 20, [21, R(), 0, 0]);
      scaffold(x, y, z, r * 1.75, h * 0.86, 7);
      for (const hh of [0.17, 0.33, 0.52, 0.62, 0.74, 0.86]) { const f = frame(x, y + h * hh, z, 0), q = r * 1.75; K.box(f, -q, 0, -q, q, 0.15, q, [20, ...STEEL], true, true); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lamp(x + a * q * 0.9, y + h * hh + 2.2, z + b * q * 0.9); lamp(x, y + h * hh + 2.2, z + q); lamp(x + q, y + h * hh + 2.2, z); }
      // bleeders above the throat, and the downcomer to the dust catcher
      for (const s of [-1, 1]) { K.pipe([[x + s * r * 0.5, y + h * 0.68, z], [x + s * r * 0.5, y + h, z]], 0.45, 6, [21, R(), 0, 0]); lamp(x + s * r * 0.5, y + h + 0.6, z, "red"); }
      const dx = x + ux * r * 4.2, dz = z + uz * r * 4.2;
      K.pipe([[x, y + h * 0.72, z], [x + ux * r * 1.4, y + h * 0.80, z + uz * r * 1.4], [dx, y + h * 0.36, dz], [dx, y + h * 0.30, dz]], 1.5, 10, [21, R(), 0, 0]);
      K.lathe(dx, y + h * 0.10, dz, [[0.6, 0], [r * 0.6, h * 0.07], [r * 0.6, h * 0.19], [1.6, h * 0.24]], 14, [21, R(), 0, 0]); scaffold(dx, y, dz, r * 0.7, h * 0.12, 5);
      // three stoves in a row and their stack
      for (let i = 0; i < 3; i++) { const sx = x - uz * (r * 2.4 + i * r * 1.25) - ux * r * 1.6, sz = z + ux * (r * 2.4 + i * r * 1.25) - uz * r * 1.6, sy = g(sx, sz), sr = r * 0.52, sh = h * 0.40; K.lathe(sx, sy, sz, [[sr, 0], [sr, sh], [sr * 1.08, sh + 1], [sr * 0.8, sh + sr * 0.7], [0.3, sh + sr * 1.05]], 14, [24, R(), 0, 0]); landing(sx, sy + sh, sz, sr, sr + 1.1, YELLOW); lamp(sx + sr + 1, sy + sh + 2, sz); }
      stack(x - uz * (r * 2.4 + 4.2 * r) - ux * r * 1.6, z + ux * (r * 2.4 + 4.2 * r) - uz * r * 1.6, 2.6, h * 0.8);
      // the skip incline up to the throat, the cast house at the foot
      const ix = x - ux * r * 7, iz = z - uz * r * 7;
      K.pipe([[ix, g(ix, iz) + 1, iz], [x - ux * r * 0.4, y + h * 0.71, z - uz * r * 0.4]], 1.3, 4, [25, 0.10, 0.12, 0.12]);
      for (let i = 1; i < 6; i++) { const t = i / 6, lx = ix + (x - ix) * t, lz = iz + (z - iz) * t, ly = g(lx, lz); scaffold(lx, ly, lz, 1.3, h * 0.71 * t, 6); lamp(lx, ly + h * 0.71 * t + 1.6, lz); }
      shed(x + ux * r * 2.2 - uz * r * 2.5, z + uz * r * 2.2 + ux * r * 2.5, 44, 26, 15, turn, true);
      // the plant that serves it: columns in scaffolds, spheres, sheds, racks between
      const bx = x + ux * 95, bz = z + uz * 95, cols = [];
      for (let i = 0; i < 7; i++) { const cx = bx + (i % 4 - 1.5) * 17 * ux - Math.floor(i / 4) * 22 * uz + (R() - 0.5) * 5, cz = bz + (i % 4 - 1.5) * 17 * uz + Math.floor(i / 4) * 22 * ux + (R() - 0.5) * 5, ch = 22 + 40 * R() * R(), cr = 1.3 + 1.6 * R(); column(cx, cz, cr, ch); if (R() < 0.6) scaffold(cx, g(cx, cz), cz, cr + 1.6, ch * (0.6 + 0.3 * R()), 5); cols.push([cx, cz]); }
      for (let i = 0; i < 2; i++) sphere(bx + ux * (48 + i * 20) + uz * 8, bz + uz * (48 + i * 20) - ux * 8, 6.5 + R() * 2);
      rack(x + ux * r * 2, z + uz * r * 2, cols[1][0], cols[1][1], 9); rack(cols[0][0] - uz * 9, cols[0][1] + ux * 9, cols[3][0] - uz * 9, cols[3][1] + ux * 9, 8);
      shed(bx - uz * 55, bz + ux * 55, 60, 22, 11, turn + 1.57);
    } else if (m.kind === "stack") stack(x, z, m.size_m * 0.5, m.tall_m);
    else if (m.kind === "coolingtower") {
      const rt = m.size_m * 0.29, t = m.tall_m, b = 0.72 * t / Math.sqrt((m.size_m * 0.5 / rt) ** 2 - 1), prof = [];
      for (let i = 0; i <= 14; i++) { const hh = t * i / 14; prof.push([rt * Math.sqrt(1 + ((hh - 0.72 * t) / b) ** 2), hh]); }
      K.lathe(x, y, z, prof, 28, [22, R(), 0, 0]);
    for (let i = 0; i < 24; i++) { const a = i / 24 * 6.2832; dot(x + Math.cos(a) * m.size_m * 0.5, y + 2.5, z + Math.sin(a) * m.size_m * 0.5); }
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; lamp(x + Math.cos(a) * m.size_m * 0.52, y + 6, z + Math.sin(a) * m.size_m * 0.52, "sodium"); lamp(x + Math.cos(a) * rt * 1.1, y + t, z + Math.sin(a) * rt * 1.1, "red"); }
    } else if (m.kind === "tank") {
      const r = m.size_m * 0.5, t = m.tall_m;
      K.lathe(x, y, z, [[r, -0.5], [r, t], [r * 0.4, t + r * 0.12], [0.1, t + r * 0.15]], 24, [25, ...PALE]);
      landing(x, y + t - 0.1, z, r - 0.05, r + 0.9, YELLOW);
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832 + R(); lamp(x + Math.cos(a) * (r + 0.5), y + t + 1.9, z + Math.sin(a) * (r + 0.5)); }
      // a stair winds up it: landings of lattice a quarter turn apart
      for (let i = 0; i < 12; i++) { const a0 = i / 12 * 3.1, a1 = (i + 1) / 12 * 3.1, p = (a, hh) => [x + Math.cos(a) * (r + 0.7), y + hh, z + Math.sin(a) * (r + 0.7)]; K.cardAt(p(a0, t * i / 12 + 1.2), p(a1, t * (i + 1) / 12 + 1.2), p(a1, t * (i + 1) / 12), p(a0, t * i / 12), CELLS.rail, [23, 1, 0, 0]); }
    } else if (m.kind === "piperack") {
      const half = m.size_m * 0.5; rack(x - ux * half, z - uz * half, x + ux * half, z + uz * half, Math.min(14, Math.max(8, m.tall_m)));
    }
  }
  // the flare: a thin stack off to one side, burning what the plant cannot use; it lights the smoke above the works
  if (furnaces.length) {
    const f0 = furnaces[0], x = f0.wx - O[0] + 190, z = f0.wz - O[2] - 120, y = g(x, z);
    K.pipe([[x, y, z], [x, y + 96, z]], 0.7, 8, [20, ...STEEL]); scaffold(x, y, z, 2.2, 90, 9);
    K.lathe(x, y + 96, z, [[0.9, 0], [2.0, 2.5], [1.4, 6], [0.2, 9]], 8, [16, 1.0, 0.45, 0.10]);
    lamp(x, y + 100, z, "flare");
  }
  return { data: K.data, origin: O };
}
