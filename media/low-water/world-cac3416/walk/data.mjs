// The generated world as the traversal holds it: typed arrays, lookups in metres, and the two
// maps the ground shader reads (colour, and normal with canopy and lamp glow).
// The world arrives as binary tiles (../tiles.mjs): an overview of the whole island at once, the
// tiles round the walker before the first frame, and the rest behind the walk, nearest first.
// A world that was never packed is read from the generator's text rasters instead.
import { parsePgm } from "../pgm.mjs";
import { gunzip, decodeBlock, FORMAT } from "../tiles.mjs";

const NAMES = ["height", "water", "biome", "region", "river", "moist"];
function blank(json) {
  const W = json.width, H = json.height, cell = json.cell_m, n = W * H;
  return { json, W, H, cell, width: W * cell, depth: H * cell, height: new Float32Array(n), water: new Float32Array(n).fill(-512), biome: new Uint8Array(n), region: new Uint8Array(n), river: new Uint8Array(n), moist: new Uint8Array(n),
    // has(x0, z0, x1, z1): is every cell of this box of metres here at full detail yet?
    has: () => true, stream: null };
}
const store = (w, name, k, v) => { if (name === "height") w.height[k] = v / 16 - 512; else if (name === "water") w.water[k] = v > 0 ? v / 16 - 512 : -512; else w[name][k] = v; };

// start is where the walker will stand, in metres: the tiles within `first` metres of it are read
// before this returns. onProgress(share, what) reports the wait.
export async function loadWorld(base, onProgress = () => {}, start = null, first = 4200) {
  const json = await (await fetch(`${base}/world.json`)).json(), w = blank(json), { W, H } = w;
  if (typeof start === "function") start = start(json);
  const idx = await fetch(`${base}/tiles/index.json`).then((r) => r.ok ? r.json() : null).catch(() => null);
  if (!idx || idx.format !== FORMAT) {
    let done = 0;
    await Promise.all(NAMES.map(async (n) => {
      const r = await fetch(`${base}/${n}.pgm`);
      if (!r.ok) throw new Error(`world: ${base}/${n}.pgm is missing. Run the generator (games/low-water/world/README.md).`);
      const data = parsePgm(new Uint8Array(await r.arrayBuffer())).data;
      for (let k = 0; k < data.length; k++) store(w, n, k, data[k]);
      onProgress(++done / NAMES.length, n);
    }));
    return w;
  }
  const bin = async (f) => gunzip(new Uint8Array(await (await fetch(`${base}/tiles/${f}`)).arrayBuffer()));
  // the overview: one cell in eight, spread over the cells round it
  const S = idx.step, ow = Math.floor(W / S), oh = Math.floor(H / S), small = {};
  for (const n of NAMES) small[n] = new Uint16Array(ow * oh);
  decodeBlock(await bin("overview.bin"), ow, oh, (name, x, y, v) => { small[name][y * ow + x] = v; });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, sx = Math.min(ow - 1, x >> 3), sy = Math.min(oh - 1, y >> 3), o = sy * ow + sx;
    // heights are eased between overview cells so the far ground is not a staircase
    const fx = Math.min(ow - 1.001, Math.max(0, (x - S / 2 + 0.5) / S)), fy = Math.min(oh - 1.001, Math.max(0, (y - S / 2 + 0.5) / S)), ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, a = iy * ow + ix, hh = small.height;
    w.height[k] = ((hh[a] * (1 - tx) + hh[a + 1] * tx) * (1 - ty) + (hh[a + ow] * (1 - tx) + hh[a + ow + 1] * tx) * ty) / 16 - 512;
    w.water[k] = small.water[o] > 0 ? small.water[o] / 16 - 512 : -512;
    w.biome[k] = small.biome[o]; w.region[k] = small.region[o]; w.river[k] = small.river[o]; w.moist[k] = small.moist[o];
  }
  onProgress(0.1, "the whole island");
  const T = idx.tile, got = new Uint8Array(idx.cols * idx.rows), listeners = [], sx = start ? start[0] : w.width / 2, sz = start ? start[1] : w.depth / 2;
  w.has = (x0, z0, x1, z1) => {
    for (let r = Math.max(0, Math.floor(z0 / w.cell / T)); r <= Math.min(idx.rows - 1, Math.floor(z1 / w.cell / T)); r++) for (let c = Math.max(0, Math.floor(x0 / w.cell / T)); c <= Math.min(idx.cols - 1, Math.floor(x1 / w.cell / T)); c++) if (!got[r * idx.cols + c]) return false;
    return true;
  };
  const order = [];
  for (let r = 0; r < idx.rows; r++) for (let c = 0; c < idx.cols; c++) {
    const x0 = c * T * w.cell, z0 = r * T * w.cell, x1 = Math.min(w.width, x0 + T * w.cell), z1 = Math.min(w.depth, z0 + T * w.cell);
    order.push({ c, r, d: Math.hypot(Math.max(x0 - sx, 0, sx - x1), Math.max(z0 - sz, 0, sz - z1)) });
  }
  order.sort((a, b) => a.d - b.d);
  async function tile({ c, r }) {
    const tw = Math.min(T, W - c * T), th = Math.min(T, H - r * T), u8 = await bin(`t_${c}_${r}.bin`);
    decodeBlock(u8, tw, th, (name, x, y, v) => store(w, name, (r * T + y) * W + c * T + x, v));
    got[r * idx.cols + c] = 1;
    // a listener that fails must not stop the tiles behind it; the failure is kept and shown
    for (const f of listeners) try { f({ x0: c * T, y0: r * T, w: tw, h: th }); } catch (e) { console.error(`tile ${c}, ${r}: ${e && e.stack || e}`); w.stream.error = String(e && e.message || e); }
  }
  const near = order.filter((t) => t.d < first), rest = order.filter((t) => t.d >= first);
  let n = 0;
  await Promise.all(near.map(async (t) => { await tile(t); onProgress(0.1 + 0.9 * ++n / near.length, "the ground near you"); }));
  // The rest arrives behind the walk, three tiles at a time, once start() is called: the caller
  // first hangs its listener with onTile(f), so no tile lands unheard.
  let finish; const done = new Promise((ok) => { finish = ok; });
  const begin = () => { let i = 0; const lane = async () => { while (i < rest.length) await tile(rest[i++]); }; Promise.all([lane(), lane(), lane()]).then(finish, (e) => { console.error(`tiles: ${e && e.stack || e}`); w.stream.error = String(e && e.message || e); finish(); }); };
  w.stream = { onTile: (f) => listeners.push(f), start: begin, done, total: order.length, left: () => order.length - got.reduce((a, b) => a + b, 0), bytes: idx.bytes };
  return w;
}

const clampi = (v, a, b) => v < a ? a : v > b ? b : v;
// raster height in metres at a point in metres, the same bilinear rule the shader uses
export function heightAt(w, x, z) {
  const qx = x / w.cell - 0.5, qz = z / w.cell - 0.5, ix = Math.floor(qx), iz = Math.floor(qz), fx = qx - ix, fz = qz - iz;
  const x0 = clampi(ix, 0, w.W - 1), x1 = clampi(ix + 1, 0, w.W - 1), z0 = clampi(iz, 0, w.H - 1), z1 = clampi(iz + 1, 0, w.H - 1), h = w.height;
  return (h[z0 * w.W + x0] * (1 - fx) + h[z0 * w.W + x1] * fx) * (1 - fz) + (h[z1 * w.W + x0] * (1 - fx) + h[z1 * w.W + x1] * fx) * fz;
}
// the lattice noise and relief of common.wgsl, to the same bits up to float rounding
function ihash(x, y) {
  let h = (Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function lnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return (ihash(ix, iy) * (1 - ux) + ihash(ix + 1, iy) * ux) * (1 - uy) + (ihash(ix, iy + 1) * (1 - ux) + ihash(ix + 1, iy + 1) * ux) * uy;
}
function builtAt(w, x, z) {
  if (!w.built) return 0;
  const qx = x / w.cell - 0.5, qz = z / w.cell - 0.5, ix = Math.floor(qx), iz = Math.floor(qz), fx = qx - ix, fz = qz - iz, b = w.built;
  const x0 = clampi(ix, 0, w.W - 1), x1 = clampi(ix + 1, 0, w.W - 1), z0 = clampi(iz, 0, w.H - 1), z1 = clampi(iz + 1, 0, w.H - 1);
  return ((b[z0 * w.W + x0] * (1 - fx) + b[z0 * w.W + x1] * fx) * (1 - fz) + (b[z1 * w.W + x0] * (1 - fx) + b[z1 * w.W + x1] * fx) * fz) / 255;
}
// The ground before roads and yards have touched it: the raster plus the small relief the shader
// adds near the eye. Trees and buildings stand on this, so they do not move when the near maps do.
const reliefAt = (x, z) => (lnoise(x / 16, z / 16) - 0.5) * 3.2 + (lnoise(x / 4 + 50, z / 4 + 50) - 0.5) * 0.6 + (lnoise(x / 1.3 + 90, z / 1.3 + 90) - 0.5) * 0.16;
export function baseGround(w, x, z) {
  const y = heightAt(w, x, z);
  return y + reliefAt(x, z) * (1 - builtAt(w, x, z)) * Math.min(1, Math.max(0, y));
}
// The ground a walker stands on: the same, with the cut of a road and the pads and banks of a
// yard from the near maps (common.wgsl groundAt computes the same number).
const nb = new Float32Array(5);
export function groundAt(w, x, z) {
  if (!w.near) return baseGround(w, x, z);
  w.near.sampleB(x, z, nb);
  const y = heightAt(w, x, z), road = nb[0] * nb[4], t = Math.min(1, Math.max(0, (road - 0.15) / 0.45)), damp = 1 - 0.85 * t * t * (3 - 2 * t);
  return y + reliefAt(x, z) * (1 - builtAt(w, x, z)) * Math.min(1, Math.max(0, y)) * damp + nb[2] * nb[4];
}
export const cellAt = (w, x, z) => clampi(Math.floor(z / w.cell), 0, w.H - 1) * w.W + clampi(Math.floor(x / w.cell), 0, w.W - 1);
export const regionAt = (w, x, z) => w.region[cellAt(w, x, z)];
export const waterAt = (w, x, z) => w.water[cellAt(w, x, z)];

function hash2(x, y) {
  let h = (Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
export { hash2 };
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return (hash2(ix, iy) * (1 - ux) + hash2(ix + 1, iy) * ux) * (1 - uy) + (hash2(ix, iy + 1) * (1 - ux) + hash2(ix + 1, iy + 1) * ux) * uy;
}

// Ground colour by cover. The land keeps a low-chroma base of blue-grey and umber; green is deep
// in the forest and bright only on upland pasture; the badlands band in rust, pink and ochre.
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function coverColour(b, region, h, m, x, y) {
  const n = vnoise(x / 23, y / 23), n2 = vnoise(x / 5 + 40, y / 5);
  switch (b) {
    case 0: return mix3([0.20, 0.20, 0.17], [0.10, 0.11, 0.11], Math.min(1, -h / 30));
    case 1: return [0.11, 0.12, 0.11];
    case 2: return region === 4 ? [0.24, 0.24, 0.25] : [0.44, 0.41, 0.35];
    case 3: return mix3([0.23, 0.25, 0.17], [0.47, 0.41, 0.23], n2 > 0.55 ? 0.8 : 0.1);
    case 4: return region === 2 ? mix3([0.26, 0.40, 0.17], [0.36, 0.44, 0.20], n) : mix3([0.22, 0.26, 0.19], [0.30, 0.31, 0.22], n);
    case 5: return n2 > 0.86 ? mix3([0.30, 0.22, 0.10], [0.40, 0.29, 0.11], n) : mix3([0.06, 0.11, 0.10], [0.10, 0.16, 0.13], n);
    case 6: return mix3([0.26, 0.25, 0.23], [0.37, 0.34, 0.28], n);
    case 7: return [0.80, 0.84, 0.90];
    case 8: return mix3([0.34, 0.33, 0.35], [0.44, 0.42, 0.42], n);
    case 9: return [0.90, 0.93, 0.97];
    case 10: {
      // strata: the colour turns with height, so canyon walls show bands
      const band = (Math.sin(h / 23 + n * 2) + Math.sin(h / 61 + 1.7)) * 0.25 + 0.5;
      const base = mix3([0.50, 0.26, 0.16], [0.74, 0.55, 0.38], band);
      const odd = Math.sin(h / 37 + 4) > 0.86 ? [0.72, 0.52, 0.56] : Math.sin(h / 47 + 2) > 0.92 ? [0.48, 0.52, 0.62] : base;
      return mix3(base, odd, 0.7);
    }
    case 11: return region === 5 || region === 9 ? mix3([0.46, 0.40, 0.28], [0.56, 0.48, 0.32], n) : mix3([0.33, 0.31, 0.25], [0.41, 0.37, 0.28], n);
    case 12: return mix3([0.25, 0.21, 0.20], [0.33, 0.26, 0.23], n);
    default: return region === 4 ? [0.13, 0.13, 0.15] : [0.29, 0.28, 0.28];
  }
}
// how thickly trees stand on a cover, 0 to 1
export const CANOPY = [0, 0, 0, 0.06, 0.015, 0.95, 0.45, 0, 0, 0, 0, 0.008, 0.01, 0];

// What the maps need that does not come from the rasters: where roads run and where lamps glow.
function bakePrep(w) {
  const { W, H } = w, n = W * H, glow = new Float32Array(n), road = new Uint8Array(n);
  for (const r of w.json.roads) for (let i = 0; i < r.pts.length; i += 2) {
    const k = r.pts[i + 1] * W + r.pts[i]; road[k] = Math.max(road[k], r.kind === "path" ? 1 : 2);
    // a road point stands for a 4 x 4 block; mark a line toward the next point
    if (i + 3 < r.pts.length) { const x1 = r.pts[i + 2], y1 = r.pts[i + 3]; for (let t = 1; t < 4; t++) { const k2 = Math.round(r.pts[i + 1] + (y1 - r.pts[i + 1]) * t / 4) * W + Math.round(r.pts[i] + (x1 - r.pts[i]) * t / 4); road[k2] = Math.max(road[k2], r.kind === "path" ? 1 : 2); } }
  }
  const lamp = (cx, cy, radius, strength) => {
    const r = Math.ceil(radius);
    for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++) {
      const d = Math.hypot(x - cx, y - cy) / radius; if (d < 1) glow[y * W + x] = Math.max(glow[y * W + x], strength * (1 - d) * (1 - d));
    }
  };
  for (const s of w.json.settlements) lamp(s.x, s.y, s.kind === "seat" ? 12 : s.kind === "town" ? 9 : s.kind === "village" ? 4 : 1.5, s.kind === "house" ? 0.5 : 1);
  const BRIGHT = { furnace: [8, 1], stack: [3, 0.6], tenement: [3, 0.8], decotower: [4, 1], slab: [3, 0.8], tower: [8, 0.8], spire: [5, 0.6], lighthouse: [5, 1], coolingtower: [5, 0.7], piperack: [4, 0.7], glasshall: [4, 1] };
  for (const m of w.json.marks) if (BRIGHT[m.kind]) lamp(m.x, m.y, BRIGHT[m.kind][0], BRIGHT[m.kind][1]);
  return { glow, road };
}
// colour (rgb, a = river) and aux (normal x, normal z, canopy, lamp glow), both RGBA8, for the
// cells of a box; the whole island when no box is given
export function bakeRect(w, maps, x0 = 0, y0 = 0, x1 = w.W, y1 = w.H) {
  const { W, H } = w, { alb, aux } = maps, { glow, road } = maps.prep, hgt = w.height;
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
    const k = y * W + x, h = hgt[k], b = w.biome[k];
    let c = coverColour(b, w.region[k], h, w.moist[k] / 255, x, y);
    if (road[k] && h > 0) c = mix3(c, [0.52, 0.48, 0.41], road[k] === 2 ? 0.6 : 0.3);
    if (glow[k] > 0.3 && h > 0) c = mix3(c, [0.34, 0.32, 0.30], Math.min(0.7, glow[k]));
    alb[k * 4] = c[0] * 255; alb[k * 4 + 1] = c[1] * 255; alb[k * 4 + 2] = c[2] * 255; alb[k * 4 + 3] = Math.min(255, w.river[k] * 2.2);
    const xe = Math.min(W - 1, x + 1), xw = Math.max(0, x - 1), ys = Math.min(H - 1, y + 1), yn = Math.max(0, y - 1);
    const dx = (hgt[y * W + xe] - hgt[y * W + xw]) / (2 * w.cell), dz = (hgt[ys * W + x] - hgt[yn * W + x]) / (2 * w.cell), l = Math.hypot(dx, dz, 1);
    aux[k * 4] = (-dx / l * 0.5 + 0.5) * 255; aux[k * 4 + 1] = (-dz / l * 0.5 + 0.5) * 255; aux[k * 4 + 2] = CANOPY[b] * 255; aux[k * 4 + 3] = Math.min(1, glow[k]) * 255;
    w.built[k] = aux[k * 4 + 3];
  }
}
export function bakeMaps(w) {
  const n = w.W * w.H, maps = { alb: new Uint8Array(n * 4), aux: new Uint8Array(n * 4), prep: bakePrep(w) };
  w.built = new Uint8Array(n);
  bakeRect(w, maps);
  return maps;
}

// Lowest and highest ground for the quadtree: level 0 is 32 m blocks, level 1 the 64 m cells
// (both read from the raster, which has no finer detail), then every level above by halving.
// refreshPyramid redoes the part of it over a box of cells, for when a tile lands.
export function heightPyramid(w) {
  const cw = w.W, chh = w.H, levels = [{ w: cw * 2, h: chh * 2, lo: new Float32Array(cw * chh * 4), hi: new Float32Array(cw * chh * 4) }, { w: cw, h: chh, lo: new Float32Array(cw * chh), hi: new Float32Array(cw * chh) }];
  for (let l = 2; l <= 10; l++) { const p = levels[l - 1]; levels.push({ w: p.w / 2, h: p.h / 2, lo: new Float32Array(p.w * p.h / 4), hi: new Float32Array(p.w * p.h / 4) }); }
  refreshPyramid(w, levels, 0, 0, cw, chh);
  return levels;
}
export function refreshPyramid(w, levels, x0, y0, x1, y1) {
  const cw = w.W, chh = w.H, L0 = levels[0], L1 = levels[1];
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(cw, x1 + 1); y1 = Math.min(chh, y1 + 1);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    // a cell's surface is bilinear between it and its neighbours, so its range takes them in
    let lo = 1e9, hi = -1e9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const h = w.height[Math.min(chh - 1, Math.max(0, y + j)) * cw + Math.min(cw - 1, Math.max(0, x + i))]; if (h < lo) lo = h; if (h > hi) hi = h; }
    L1.lo[y * cw + x] = lo - 2; L1.hi[y * cw + x] = hi + 2;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { L0.lo[(y * 2 + j) * cw * 2 + x * 2 + i] = lo - 2; L0.hi[(y * 2 + j) * cw * 2 + x * 2 + i] = hi + 2; }
  }
  for (let l = 2; l <= 10; l++) {
    const p = levels[l - 1], q = levels[l], s = 2 ** (l - 1);
    for (let y = Math.floor(y0 / s); y < Math.min(q.h, Math.ceil(y1 / s)); y++) for (let x = Math.floor(x0 / s); x < Math.min(q.w, Math.ceil(x1 / s)); x++) {
      const a = 2 * y * p.w + 2 * x, b = a + 1, c = a + p.w, e = c + 1;
      q.lo[y * q.w + x] = Math.min(p.lo[a], p.lo[b], p.lo[c], p.lo[e]); q.hi[y * q.w + x] = Math.max(p.hi[a], p.hi[b], p.hi[c], p.hi[e]);
    }
  }
}
