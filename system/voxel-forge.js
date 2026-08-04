// voxel-forge.js: voxel TOOLING — make, light, and export voxel art from a seed.
//
// voxel.js turns fields into occupancy and exports shells; this module is the making half:
// seeded scenes (CSG relics, symmetric monuments, terrain from the plot-maps elevation field,
// accretive growth), a per-face ambient-occlusion pass, an isometric painter for the 2D canvas,
// and a byte-exact MagicaVoxel .vox writer so a sheet leaves the Studio as a real interchange
// file whose hash can sit in a receipt.
//
// Method sources (studio-v3 research digest, lane 3): the SDF primitive/CSG catalog (Quilez),
// baked ambient occlusion for voxel worlds (0fps), and the MagicaVoxel .vox format spec
// (ephtracy, VOX 150: MAIN > SIZE + XYZI + RGBA). Everything is deterministic from the seed.

import { voxelizeSdf, voxelizeHeightGrid, occAt, voxelCount, voxelObj, isoOrder } from "./voxel.js";
import { elevationField } from "./plot-maps.js";

// ── Seeded PRNG (the site's shared recipe) ───────────────────────────────────
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── SDF primitives + CSG (Quilez catalog, the digest's generator finding) ────
const sdSphere = (x, y, z, r) => Math.hypot(x, y, z) - r;
function sdBox(x, y, z, bx, by, bz) {
  const qx = Math.abs(x) - bx, qy = Math.abs(y) - by, qz = Math.abs(z) - bz;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0);
}
const sdTorus = (x, y, z, R, r) => Math.hypot(Math.hypot(x, z) - R, y) - r;
const sdOcta = (x, y, z, s) => (Math.abs(x) + Math.abs(y) + Math.abs(z) - s) * 0.57735;
const sdCylY = (x, y, z, r) => Math.hypot(x, z) - r;
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

// ── Studies: each builds { vox, mat } from a seed ────────────────────────────
// mat is a per-cell material band (Uint8Array, 0 = empty) driving palette + export colours.

function buildRelic(rng, res) {
  // 2-4 smooth-unioned cores minus 1-3 carvers: the excavated-artifact grammar.
  const cores = [];
  const n = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const kind = Math.floor(rng() * 4);
    const cx = (rng() - 0.5) * 0.8, cy = (rng() - 0.5) * 0.8, cz = (rng() - 0.5) * 0.8;
    const s = 0.35 + rng() * 0.4;
    cores.push({ kind, cx, cy, cz, s, r2: 0.12 + rng() * 0.2 });
  }
  const carvers = [];
  const m = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < m; i++) {
    carvers.push({ cx: (rng() - 0.5) * 1.2, cy: (rng() - 0.5) * 1.2, cz: (rng() - 0.5) * 1.2, r: 0.28 + rng() * 0.3 });
  }
  const dist = (x, y, z) => {
    let d = Infinity;
    for (const c of cores) {
      const px = x - c.cx, py = y - c.cy, pz = z - c.cz;
      let dd;
      if (c.kind === 0) dd = sdSphere(px, py, pz, c.s);
      else if (c.kind === 1) dd = sdBox(px, py, pz, c.s * 0.8, c.s * 0.8, c.s * 0.8);
      else if (c.kind === 2) dd = sdTorus(px, py, pz, c.s * 0.8, c.r2);
      else dd = sdOcta(px, py, pz, c.s * 1.1);
      d = smin(d, dd, 0.22);
    }
    for (const c of carvers) d = Math.max(d, -sdSphere(x - c.cx, y - c.cy, z - c.cz, c.r));
    return d;
  };
  return voxelizeSdf(dist, res, 1.15);
}

function buildMonument(rng, res) {
  // Mirrored-x architecture: plinth, paired columns, lintel, an arch cut, stepped crown.
  // The geometry is authored y-up (the SDF idiom), but voxelizeSdf's k axis — the axis the
  // isometric painter draws as UP — is the SDF's z. The wrapper swaps the two so the monument
  // stands instead of lying on its side (the first build rendered it horizontal; the browser
  // contact sheet caught it).
  const colX = 0.35 + rng() * 0.25, colR = 0.09 + rng() * 0.07;
  const lintelY = 0.25 + rng() * 0.2, archR = 0.22 + rng() * 0.16;
  const crown = 0.12 + rng() * 0.14;
  const upright = (x, y, z) => {
    const ax = Math.abs(x);
    let d = sdBox(x, y + 0.85, z, 0.95, 0.14, 0.6);                       // plinth (y = -0.85 is the ground)
    d = Math.min(d, sdCylY(ax - colX, y, z, colR));                       // columns (mirrored)
    d = Math.max(d, sdBox(x, y, z, 1.0, 0.98, 0.62));                     // clip column height
    d = Math.min(d, sdBox(x, y - lintelY - 0.62, z, 0.8, 0.12, 0.5));     // lintel
    d = Math.min(d, sdBox(x, y - lintelY - 0.62 - crown - 0.1, z, 0.5, crown, 0.34)); // crown step
    d = Math.max(d, -sdTorus(x, y + 0.3, z, archR, 0.1));                 // arch ring cut
    return d;
  };
  const dist = (x, y, z) => upright(x, -z, y);   // grid z (painter's up) = author's y-up
  return voxelizeSdf(dist, res, 1.15);
}

function buildTerrain(seedStr, rng, res) {
  // The plot-maps elevation field extruded to columns: the cartography and voxel lanes share
  // one terrain truth, so a seed's map and its voxel relief agree by construction.
  const w = res, h = res;
  const { field, seaLevel } = elevationField(seedStr, w, h, { ridged: rng() < 0.5 });
  const grid = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) row.push(0.12 + 0.88 * field[y * w + x]);
    grid.push(row);
  }
  const vox = voxelizeHeightGrid(grid, Math.round(res * 0.55));
  vox.seaLevel = seaLevel;
  return vox;
}

function buildGrowth(rng, res) {
  // Accretion: from a floor seed, each round attaches new cells to the surface with an upward
  // bias — coral logic, deterministic because the candidate scan order and rng are both fixed.
  const nx = res, ny = res, nz = res;
  const occ = new Uint8Array(nx * ny * nz);
  const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) ? 0 : occ[(z * ny + y) * nx + x];
  const set = (x, y, z) => { occ[(z * ny + y) * nx + x] = 1; };
  const c = Math.floor(res / 2);
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) set(c + dx, c + dy, 0);
  const rounds = Math.round(res * 1.4);
  for (let r = 0; r < rounds; r++) {
    const adds = [];
    for (let z = 0; z < nz - 1; z++) {
      for (let y = 1; y < ny - 1; y++) {
        for (let x = 1; x < nx - 1; x++) {
          if (at(x, y, z)) continue;
          const support = at(x - 1, y, z) + at(x + 1, y, z) + at(x, y - 1, z) + at(x, y + 1, z) + at(x, y, z - 1);
          if (!support) continue;
          // Upward-biased stochastic accretion; more support = likelier fill (smoother trunks).
          const p = 0.028 * support + (at(x, y, z - 1) ? 0.05 : 0) + z / nz * 0.012;
          if (rng() < p) adds.push((z * ny + y) * nx + x);
        }
      }
    }
    for (const i of adds) occ[i] = 1;
    if (!adds.length) break;
  }
  return { nx, ny, nz, occ };
}

// ── Material banding + palette ───────────────────────────────────────────────
// Height bands over a restrained seeded palette: one family, four values, one accent band.
export function assignMaterials(vox, rng, seaLevel) {
  const mat = new Uint8Array(vox.occ.length);
  const sea = seaLevel == null ? -1 : seaLevel;
  for (let z = 0; z < vox.nz; z++) {
    const t = vox.nz > 1 ? z / (vox.nz - 1) : 0;
    for (let y = 0; y < vox.ny; y++) {
      for (let x = 0; x < vox.nx; x++) {
        const i = (z * vox.ny + y) * vox.nx + x;
        if (!vox.occ[i]) continue;
        if (sea >= 0 && t <= sea * 0.55) mat[i] = 5;              // below-sea band (terrain)
        else mat[i] = t < 0.25 ? 1 : t < 0.55 ? 2 : t < 0.85 ? 3 : 4;
      }
    }
  }
  return mat;
}

export function seededPalette(rng) {
  // One muted family (a seeded base hue at low saturation) + a warm accent for the crown band.
  const baseHue = rng() * 360;
  const hsl = (h, s, l) => {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  };
  return [
    [0, 0, 0],                          // 0: unused (empty)
    hsl(baseHue, 0.10, 0.30),           // 1: base
    hsl(baseHue, 0.12, 0.42),           // 2: body
    hsl(baseHue, 0.14, 0.56),           // 3: upper
    hsl((baseHue + 30) % 360, 0.34, 0.68), // 4: crown accent
    hsl((baseHue + 190) % 360, 0.22, 0.34), // 5: below-sea
  ];
}

export const VOXEL_STUDIES = Object.freeze({
  relic:    { label: "Relic",    build: (seed, rng, res) => buildRelic(rng, res) },
  monument: { label: "Monument", build: (seed, rng, res) => buildMonument(rng, res) },
  terrain:  { label: "Terrain",  build: (seed, rng, res) => buildTerrain(seed, rng, Math.min(96, res)) },
  growth:   { label: "Growth",   build: (seed, rng, res) => buildGrowth(rng, Math.min(72, res)) },
});

/** buildVoxelScene(seedStr, { study, res }) → { vox, mat, palette, meta } — the whole sheet. */
export function buildVoxelScene(seedStr, opts = {}) {
  const study = VOXEL_STUDIES[opts.study] ? opts.study : "relic";
  const res = Math.max(16, Math.min(96, opts.res || 48));
  const rng = mulberry(hash32(String(seedStr) + ":" + study));
  const vox = VOXEL_STUDIES[study].build(String(seedStr), rng, res);
  const mat = assignMaterials(vox, rng, vox.seaLevel);
  const palette = seededPalette(rng);
  return {
    vox, mat, palette,
    meta: {
      seed: String(seedStr), study, res: [vox.nx, vox.ny, vox.nz],
      voxels: voxelCount(vox), seaLevel: vox.seaLevel == null ? null : +vox.seaLevel.toFixed(4),
    },
  };
}

// ── Per-face ambient occlusion (0fps voxel-AO, per face instead of per vertex) ──
// A face is darkened by the solid cells adjacent to its open side: 0..4 side neighbours → the
// cheap 80% of the path-traced look, baked at draw time, zero runtime cost afterwards.
export function faceAO(vox, x, y, z, face) {
  let n = 0;
  if (face === "top") {
    n = occAt(vox, x + 1, y, z + 1) + occAt(vox, x - 1, y, z + 1) + occAt(vox, x, y + 1, z + 1) + occAt(vox, x, y - 1, z + 1);
  } else if (face === "right") {   // +x side
    n = occAt(vox, x + 1, y, z + 1) + occAt(vox, x + 1, y, z - 1) + occAt(vox, x + 1, y + 1, z) + occAt(vox, x + 1, y - 1, z);
  } else {                          // "left": +y side in iso terms
    n = occAt(vox, x, y + 1, z + 1) + occAt(vox, x, y + 1, z - 1) + occAt(vox, x + 1, y + 1, z) + occAt(vox, x - 1, y + 1, z);
  }
  return 1 - 0.16 * n;
}

// ── Isometric painter (2D canvas, back-to-front via isoOrder) ────────────────
export function renderVoxelScene(ctx, scene, W, H, opts = {}) {
  const { vox, mat, palette } = scene;
  const ground = opts.ground || "#0d1b1c";
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);
  const list = isoOrder(vox);
  if (!list.length) return;
  const span = (vox.nx + vox.ny);
  const s = Math.min(W / (span * 1.1), H / (vox.nz + span * 0.5) / 1.05);
  const ox = W / 2, oy = H * 0.12 + (vox.nz * s);
  const px = (x, y) => ox + (x - y) * s;
  const py = (x, y, z) => oy + (x + y) * s * 0.5 - z * s;
  const shade = ([r, g, b], f) => `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
  const depthMax = vox.nx + vox.ny + vox.nz;
  for (const v of list) {
    const base = palette[mat[(v.z * vox.ny + v.y) * vox.nx + v.x]] || palette[2];
    const cue = 0.82 + 0.18 * (v.depth / depthMax);   // farther = slightly brighter (air)
    const X = px(v.x, v.y), Y = py(v.x, v.y, v.z);
    if (v.top) {
      ctx.fillStyle = shade(base, 1.0 * faceAO(vox, v.x, v.y, v.z, "top") * cue);
      ctx.beginPath();
      ctx.moveTo(X, Y - s); ctx.lineTo(X + s, Y - s * 0.5); ctx.lineTo(X, Y); ctx.lineTo(X - s, Y - s * 0.5);
      ctx.closePath(); ctx.fill();
    }
    if (v.right) {
      ctx.fillStyle = shade(base, 0.62 * faceAO(vox, v.x, v.y, v.z, "right") * cue);
      ctx.beginPath();
      ctx.moveTo(X + s, Y - s * 0.5); ctx.lineTo(X + s, Y + s * 0.5); ctx.lineTo(X, Y + s); ctx.lineTo(X, Y);
      ctx.closePath(); ctx.fill();
    }
    if (v.left) {
      ctx.fillStyle = shade(base, 0.42 * faceAO(vox, v.x, v.y, v.z, "left") * cue);
      ctx.beginPath();
      ctx.moveTo(X - s, Y - s * 0.5); ctx.lineTo(X - s, Y + s * 0.5); ctx.lineTo(X, Y + s); ctx.lineTo(X, Y);
      ctx.closePath(); ctx.fill();
    }
  }
}

// ── MagicaVoxel .vox writer (VOX 150: MAIN > SIZE + XYZI + RGBA) ─────────────
// Byte-exact and deterministic, so the exported file's SHA-256 can sit in a receipt. Honest
// caps surfaced, not hidden: 256 per axis, 255 colours, and XYZI coordinates are uint8.
export function toVoxFile(scene) {
  const { vox, mat, palette } = scene;
  if (vox.nx > 256 || vox.ny > 256 || vox.nz > 256) throw new Error(".vox caps each axis at 256");
  const cells = [];
  for (let z = 0; z < vox.nz; z++) {
    for (let y = 0; y < vox.ny; y++) {
      for (let x = 0; x < vox.nx; x++) {
        const i = (z * vox.ny + y) * vox.nx + x;
        if (vox.occ[i]) cells.push([x, y, z, mat[i] || 1]);
      }
    }
  }
  const enc = new TextEncoder();
  const chunk = (id, content, children = new Uint8Array(0)) => {
    const out = new Uint8Array(12 + content.length + children.length);
    const dv = new DataView(out.buffer);
    out.set(enc.encode(id), 0);
    dv.setUint32(4, content.length, true);
    dv.setUint32(8, children.length, true);
    out.set(content, 12);
    out.set(children, 12 + content.length);
    return out;
  };
  const size = new Uint8Array(12);
  new DataView(size.buffer).setUint32(0, vox.nx, true);
  new DataView(size.buffer).setUint32(4, vox.ny, true);
  new DataView(size.buffer).setUint32(8, vox.nz, true);
  const xyzi = new Uint8Array(4 + cells.length * 4);
  new DataView(xyzi.buffer).setUint32(0, cells.length, true);
  cells.forEach(([x, y, z, m], i) => xyzi.set([x, y, z, m], 4 + i * 4));
  const rgba = new Uint8Array(256 * 4);
  for (let i = 0; i < 255; i++) {
    const c = palette[i + 1] || palette[2] || [128, 128, 128];
    rgba.set([c[0], c[1], c[2], 255], i * 4);
  }
  const children = [chunk("SIZE", size), chunk("XYZI", xyzi), chunk("RGBA", rgba)];
  const childBytes = new Uint8Array(children.reduce((a, c) => a + c.length, 0));
  let off = 0;
  for (const c of children) { childBytes.set(c, off); off += c.length; }
  const main = chunk("MAIN", new Uint8Array(0), childBytes);
  const file = new Uint8Array(8 + main.length);
  const dv = new DataView(file.buffer);
  file.set(enc.encode("VOX "), 0);
  dv.setUint32(4, 150, true);
  file.set(main, 8);
  return file;
}

export { voxelObj };   // OBJ shell export reaches callers through the same door
