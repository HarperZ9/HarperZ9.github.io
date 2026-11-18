// What grows and lies under the trees, round the walker: ferns, dead bracken, grass in clumps of
// blades, leafless shrubs at the verges, reeds in the marsh, and the dead wood (fallen stems,
// stumps) and boulders that moss takes over. Each is a small mesh of drawn cards or tubes, placed
// by rule in 8 m tiles: ferns want shade, grass wants sky, shrubs want an edge, nothing grows in
// a wheel track.
import { Mesh, rng, SPECIES } from "./grow.mjs";
import { CELLS } from "./atlas.mjs";
import { baseGround, cellAt, hash2 } from "../data.mjs";

const TILE = 8, UP = [0, 1, 0];
const rot = (a, r, y = 0) => [Math.cos(a) * r, y, Math.sin(a) * r];

function fern(R, cell, droop) {
  const M = new Mesh(), n = 10;
  for (let i = 0; i < n; i++) {
    const az = i / n * 6.28 + R() * 0.5, L = 0.5 + 0.3 * R(), h = [Math.cos(az), 0, Math.sin(az)], side = [-h[2] * 0.3 * L, 0, h[0] * 0.3 * L];
    // a frond rises from the crown, arches and hangs at the tip
    const at = (s) => [h[0] * L * s * 0.8, L * (1.35 * s - (0.6 + droop) * s * s), h[2] * L * s * 0.8];
    M.ribbon([0, 0.33, 0.66, 1].map((s) => ({ p: at(s), side, n: [h[0] * 0.3, 0.9, h[2] * 0.3], s: 0.55 + 0.45 * s })), cell, [1, R(), 1.2, 1], "v");
  }
  return M.data;
}
function tuft(R, cell, tall, wide, cards = 3) {
  const M = new Mesh();
  for (let i = 0; i < cards; i++) {
    const a = i / cards * 3.14 + R() * 0.4, s = rot(a, wide / 2), lean = rot(a + 1.57, tall * 0.15 * (R() - 0.5));
    M.quad([-s[0] + lean[0], tall, -s[2] + lean[2]], [s[0] + lean[0], tall, s[2] + lean[2]], [s[0], 0, s[2]], [-s[0], 0, -s[2]], cell, [0, 1, 0], [1, R(), 1.5, 1], 1, 1);
  }
  return M.data;
}
function log(R) {
  const M = new Mesh(), L = 7 + 5 * R(), r = 0.16 + 0.12 * R(), path = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; path.push({ p: [(t - 0.5) * L, r * 0.75 + Math.sin(t * 3.1) * 0.12 - 0.05, Math.sin(t * 5 + R()) * 0.15], r: r * (1 - 0.35 * t) }); }
  M.tube(path, 8, [0, SPECIES.spruce, r * 6.28, 0.9]);
  for (let i = 0; i < 4; i++) { const t = 0.2 + 0.7 * R(), p = [(t - 0.5) * L, r, 0], a = R() * 3.14, e = [p[0] + Math.cos(a) * 0.2, r + 0.4 + 0.5 * R(), Math.sin(a) * 0.5]; M.tube([{ p, r: 0.04 }, { p: e, r: 0.012 }], 3, [0, SPECIES.snag, 0.2, 0.8]); }
  return M.data;
}
function stump(R) {
  const M = new Mesh(), r = 0.2 + 0.14 * R(), h = 0.35 + 0.5 * R();
  M.tube([{ p: [0, -0.3, 0], r: r * 1.5 }, { p: [0, 0.12, 0], r: r * 1.15 }, { p: [0, h, 0], r }, { p: [0, h + 0.02, 0], r: 0.01 }], 9, [0, SPECIES.snag, r * 6.28, 0.9]);
  return M.data;
}
// a boulder: an eight-sided ball pushed about by a slow noise and pressed into the ground
function boulder(R) {
  const M = new Mesh(), ph = [R() * 9, R() * 9, R() * 9], N = 8, P = [];
  const push = (d) => { const k = 0.72 + 0.28 * Math.sin(d[0] * 2.3 + ph[0]) * Math.cos(d[2] * 2.9 + ph[1]) + 0.16 * Math.sin(d[1] * 4.1 + ph[2]); return [d[0] * k, d[1] * k * 0.62 + 0.08, d[2] * k]; };
  for (let j = 0; j <= N; j++) { const row = []; for (let i = 0; i <= N * 2; i++) { const th = j / N * Math.PI, f = i / (N * 2) * 6.2832; row.push(push([Math.sin(th) * Math.cos(f), Math.cos(th), Math.sin(th) * Math.sin(f)])); } P.push(row); }
  const nrm = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...n) || 1; return n.map((v) => -v / l); };
  for (let j = 0; j < N; j++) for (let i = 0; i < N * 2; i++) {
    const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i];
    for (const [p, q, r] of [[a, b, c], [a, c, d]]) { const n = nrm(p, q, r); for (const v of [p, q, r]) M.v(v, [n[0] * 0.5 + v[0] * 0.5, n[1] * 0.5 + v[1] * 0.5, n[2] * 0.5 + v[2] * 0.5], 0, 0, [2, 0, 0, 1]); }
  }
  return M.data;
}

// what each cover grows, as chances per half-metre of ground: [fern, bracken, grass, dry grass, shrub, reed]
const SMALL = { 3: [0, 0, 0.05, 0.25, 0, 0.35], 4: [0, 0.01, 0.7, 0.12, 0.002, 0], 5: [0.08, 0.06, 0.12, 0.02, 0.003, 0], 6: [0.01, 0.02, 0.22, 0.16, 0.006, 0], 11: [0, 0, 0.05, 0.3, 0.003, 0], 12: [0, 0, 0.04, 0.2, 0.005, 0] };

export function makeUnderstory({ dev, world, near, quality, vbuf }, forest) {
  const R = rng(world.json.seed + 77), forms = [
    { name: "fern", data: fern(R, CELLS.fern, 0.55) }, { name: "bracken", data: fern(R, CELLS.bracken, 0.75) },
    { name: "grass", data: tuft(R, CELLS.grass, 0.42, 0.5) }, { name: "dryGrass", data: tuft(R, CELLS.dryGrass, 0.6, 0.55) },
    { name: "shrub", data: tuft(R, CELLS.shrub, 1.3, 1.5) }, { name: "reed", data: tuft(R, CELLS.reed, 1.9, 1.3) },
    { name: "log", data: log(R) }, { name: "stump", data: stump(R) }, { name: "boulder", data: boulder(R) },
  ];
  for (const f of forms) { f.buf = vbuf(f.data); f.n = f.data.length / 12; }
  const REACH = [46, 46, 30, 30, 60, 60, 110, 110, 110].map((r) => r * Math.min(1.4, quality));
  const tiles = new Map(), nb = new Float32Array(5);
  function grow(tx, tz) {
    const out = forms.map(() => []), put = (form, x, z, size, seed, sink = 0) => out[form].push(x, baseGround(world, x, z) - sink, z, seed * 6.283, size, seed, form, 40);
    for (let j = 0; j < TILE * 2; j++) for (let i = 0; i < TILE * 2; i++) {
      const gx = tx * TILE * 2 + i, gz = tz * TILE * 2 + j, x = (gx + hash2(gx, gz + 4441)) * 0.5, z = (gz + hash2(gx + 977, gz)) * 0.5;
      if (x < 0 || z < 0 || x >= world.width || z >= world.depth) continue;
      const k = cellAt(world, x, z), S = SMALL[world.biome[k]];
      if (!S || world.height[k] < 0.5) continue;
      near.sampleB(x, z, nb);
      const road = nb[0] * nb[4];
      if (road > 0.24 || (world.built && world.built[k] > 90)) continue;
      const cover = near.sampleA(x, z, 0), verge = road > 0.02 ? 1 : 0, p = hash2(gx * 3 + 5, gz * 7 + 1), q = hash2(gx * 11 + 3, gz * 5 + 9);
      // shade thins the grass and feeds the ferns; an edge brings shrubs and long grass
      const w = [S[0] * (0.35 + 1.3 * cover), S[1] * (1.1 - 0.6 * cover), S[2] * (1 - cover) ** 1.5 * 2.2 + verge * 0.45, S[3] * (1 - cover * 0.8) + verge * 0.06, S[4] * (1 - cover * 0.7) + verge * 0.010 * (1 - cover), S[5]];
      let acc = 0;
      for (let f = 0; f < 6; f++) { acc += w[f]; if (p < acc) { put(f, x, z, (f === 4 ? 0.45 + 0.5 * q : 0.7 + 0.7 * q), q, 0.03); break; } }
    }
    // dead wood and boulders, one chance in each 4 m square
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const gx = tx * 2 + i, gz = tz * 2 + j, x = (gx + hash2(gx + 61, gz)) * 4, z = (gz + hash2(gx, gz + 83)) * 4;
      if (x < 0 || z < 0 || x >= world.width || z >= world.depth) continue;
      const k = cellAt(world, x, z), b = world.biome[k], p = hash2(gx * 5 + 7, gz * 3 + 2), q = hash2(gx * 9 + 1, gz * 13 + 6);
      if (world.height[k] < 0.5 || (world.built && world.built[k] > 90)) continue;
      near.sampleB(x, z, nb);
      if (nb[0] * nb[4] > 0.05) continue;
      const wood = b === 5 ? 1 : b === 6 ? 0.4 : 0;
      if (p < 0.05 * wood) put(6, x, z, 0.8 + 0.5 * q, q);
      else if (p < 0.085 * wood) put(7, x, z, 0.8 + 0.6 * q, q);
      else if (p > (b === 5 ? 0.955 : b === 6 || b === 12 ? 0.93 : 0.985)) put(8, x, z, 0.25 + 1.1 * q * q, q, 0.1);
    }
    const t = out.map((l) => new Float32Array(l));
    tiles.set(tx * 65536 + tz, t);
    if (tiles.size > 1600) tiles.delete(tiles.keys().next().value);
    return t;
  }
  const MAXI = 60000, bufs = forms.map(() => dev.createBuffer({ size: MAXI * 32, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST })), counts = forms.map(() => 0), scratch = new Float32Array(MAXI * 8);
  let at = [1e12, 1e12], serial = -1;
  function update({ cam }) {
    // the near maps say where roads and crowns are, so a new bake regrows the tiles
    if (near.state.serial !== serial) { tiles.clear(); serial = near.state.serial; at = [1e12, 1e12]; }
    if (Math.hypot(cam.x - at[0], cam.z - at[1]) < 2.5) return;
    at = [cam.x, cam.z];
    const maxR = Math.max(...REACH), t0 = Math.floor((cam.x - maxR) / TILE), t1 = Math.floor((cam.x + maxR) / TILE), u0 = Math.floor((cam.z - maxR) / TILE), u1 = Math.floor((cam.z + maxR) / TILE);
    forms.forEach((f, fi) => {
      let o = 0; const reach = REACH[fi];
      for (let tz = u0; tz <= u1; tz++) for (let tx = t0; tx <= t1; tx++) {
        const dx = (tx + 0.5) * TILE - cam.x, dz = (tz + 0.5) * TILE - cam.z;
        if (dx * dx + dz * dz > (reach + 6) * (reach + 6)) continue;
        const t = (tiles.get(tx * 65536 + tz) || grow(tx, tz))[fi];
        for (let i = 0; i < t.length && o + 8 <= scratch.length; i += 8) { const ex = t[i] - cam.x, ez = t[i + 2] - cam.z; if (ex * ex + ez * ez < reach * reach) { scratch.set(t.subarray(i, i + 8), o); o += 8; } }
      }
      counts[fi] = o / 8;
      if (o) dev.queue.writeBuffer(bufs[fi], 0, scratch, 0, o);
    });
  }
  function draw(pass, which) {
    if (which === "mirror") return;
    pass.setPipeline(which === "shadow" ? forest.shadowPipe : forest.treePipe);
    forms.forEach((f, i) => { if (counts[i] && !(which === "shadow" && i < 6)) { pass.setVertexBuffer(0, f.buf); pass.setVertexBuffer(1, bufs[i]); pass.draw(f.n, counts[i]); } });
  }
  return { update, draw, landed() { tiles.clear(); at = [1e12, 1e12]; }, stats: () => ({ plants: counts.reduce((a, b) => a + b, 0) }) };
}
