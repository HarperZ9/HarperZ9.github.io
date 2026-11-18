// The roads as a walker meets them. world.json gives each road as a staircase of points 256 m
// apart; here it becomes a smooth line with a sample every 3 m and a wander of its own, the way
// a cart road goes round a boulder it could have gone over. A spatial hash answers "how far is
// the nearest road" for the trees, the near maps and the captures.
const STEP = 3, CELL = 48;

function ihash(x, y) {
  let h = (Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
// smooth noise along a line
function wander(seed, s) {
  const i = Math.floor(s), t = s - i, u = t * t * (3 - 2 * t);
  return ihash(seed, i) * (1 - u) + ihash(seed, i + 1) * u - 0.5;
}

// one road: [x, z] pairs in metres every STEP metres
export function smoothLine(pts, cell, seed) {
  let c = [];
  for (let i = 0; i < pts.length; i += 2) c.push([(pts[i] + 0.5) * cell, (pts[i + 1] + 0.5) * cell]);
  if (c.length < 2) return c;
  // two rounds of neighbour averaging take the staircase out; the ends stay where the towns are
  for (let round = 0; round < 2; round++) c = c.map((p, i) => i === 0 || i === c.length - 1 ? p : [(c[i - 1][0] + 2 * p[0] + c[i + 1][0]) / 4, (c[i - 1][1] + 2 * p[1] + c[i + 1][1]) / 4]);
  const out = [], at = (i) => c[Math.max(0, Math.min(c.length - 1, i))];
  let total = 0;
  for (let i = 0; i < c.length - 1; i++) total += Math.hypot(c[i + 1][0] - c[i][0], c[i + 1][1] - c[i][1]);
  let run = 0;
  for (let i = 0; i < c.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.round(len / STEP));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const cr = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      const dcr = (a, b, cc, d) => 0.5 * ((-a + cc) + 2 * (2 * a - 5 * b + 4 * cc - d) * t + 3 * (-a + 3 * b - 3 * cc + d) * t2);
      const x = cr(p0[0], p1[0], p2[0], p3[0]), z = cr(p0[1], p1[1], p2[1], p3[1]), dx = dcr(p0[0], p1[0], p2[0], p3[0]), dz = dcr(p0[1], p1[1], p2[1], p3[1]);
      const l = Math.hypot(dx, dz) || 1, s = run + t * len;
      // the wander fades in over the first 120 m so the road still meets the gate
      const ease = Math.min(1, s / 120, Math.max(0, (total - s) / 120));
      const w = (wander(seed, s / 85) * 22 + wander(seed + 7, s / 23) * 5) * ease;
      out.push([x - dz / l * w, z + dx / l * w]);
    }
    run += len;
  }
  out.push(c[c.length - 1]);
  return out;
}

export function makeRoads(world) {
  const lines = [], hash = new Map();
  for (const [ri, r] of world.json.roads.entries()) {
    if (r.kind === "ferry") continue;
    const line = smoothLine(r.pts, world.cell, (world.json.seed % 65536) + ri * 31), half = r.kind === "path" ? 0.75 : 1.9;
    lines.push({ kind: r.kind, half, pts: line, from: r.from, to: r.to });
    for (let i = 0; i < line.length; i++) {
      const key = Math.floor(line[i][0] / CELL) * 65536 + Math.floor(line[i][1] / CELL);
      let b = hash.get(key); if (!b) hash.set(key, b = []);
      b.push(lines.length - 1, i);
    }
  }
  // nearest road within `reach` metres: { d, half, kind, line, i } or null
  function nearest(x, z, reach = 24) {
    const c0 = Math.floor((x - reach - 4) / CELL), c1 = Math.floor((x + reach + 4) / CELL), d0 = Math.floor((z - reach - 4) / CELL), d1 = Math.floor((z + reach + 4) / CELL);
    let best = null, bd = reach * reach;
    for (let cz = d0; cz <= d1; cz++) for (let cx = c0; cx <= c1; cx++) {
      const b = hash.get(cx * 65536 + cz); if (!b) continue;
      for (let k = 0; k < b.length; k += 2) {
        const L = lines[b[k]], i = b[k + 1], p = L.pts[i], q = L.pts[Math.min(i + 1, L.pts.length - 1)];
        const vx = q[0] - p[0], vz = q[1] - p[1], ll = vx * vx + vz * vz, t = ll ? Math.max(0, Math.min(1, ((x - p[0]) * vx + (z - p[1]) * vz) / ll)) : 0;
        const dx = x - p[0] - vx * t, dz = z - p[1] - vz * t, d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = { half: L.half, kind: L.kind, line: b[k], i }; }
      }
    }
    if (best) best.d = Math.sqrt(bd);
    return best;
  }
  // every segment with an end in a box, for the near-map bake
  function within(x0, z0, x1, z1, visit) {
    for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      const b = hash.get(cx * 65536 + cz); if (!b) continue;
      for (let k = 0; k < b.length; k += 2) { const L = lines[b[k]], i = b[k + 1]; if (i + 1 < L.pts.length) visit(L, L.pts[i], L.pts[i + 1]); }
    }
  }
  // a stretch of the nearest road to walk along: points from the nearest sample onward
  function walkFrom(x, z, metres, { kind = null, reach = 6000 } = {}) {
    let best = null, bd = Infinity;
    for (const [li, L] of lines.entries()) {
      if (kind && L.kind !== kind) continue;
      for (let i = 0; i < L.pts.length; i += 4) { const d = Math.hypot(L.pts[i][0] - x, L.pts[i][1] - z); if (d < bd) { bd = d; best = [li, i]; } }
    }
    if (!best || bd > reach) return null;
    const L = lines[best[0]], n = Math.ceil(metres / STEP), dir = best[1] + n < L.pts.length ? 1 : -1, out = [];
    for (let k = 0; k <= n; k++) { const p = L.pts[best[1] + k * dir]; if (p) out.push(p); }
    return out;
  }
  return { lines, nearest, within, walkFrom };
}
