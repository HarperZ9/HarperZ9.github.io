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

function buildRelic(rng, res, tune) {
  // 2-4 smooth-unioned cores minus 1-3 carvers: the excavated-artifact grammar. `tune` lets the
  // operator take the algorithm's own knobs (core count, carver count, weld softness); absent, the
  // seed decides exactly as before, so existing seeds keep reproducing byte for byte.
  const cores = [];
  const n = tune && tune.a != null ? Math.round(1 + tune.a * 4) : 2 + Math.floor(rng() * 3);
  const weld = tune && tune.c != null ? 0.05 + tune.c * 0.4 : 0.22;
  for (let i = 0; i < n; i++) {
    const kind = Math.floor(rng() * 4);
    const cx = (rng() - 0.5) * 0.8, cy = (rng() - 0.5) * 0.8, cz = (rng() - 0.5) * 0.8;
    const s = 0.35 + rng() * 0.4;
    cores.push({ kind, cx, cy, cz, s, r2: 0.12 + rng() * 0.2 });
  }
  const carvers = [];
  const m = tune && tune.b != null ? Math.round(tune.b * 4) : 1 + Math.floor(rng() * 3);
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
      d = smin(d, dd, weld);
    }
    for (const c of carvers) d = Math.max(d, -sdSphere(x - c.cx, y - c.cy, z - c.cz, c.r));
    return d;
  };
  return voxelizeSdf(dist, res, 1.15);
}

function buildMonument(rng, res, tune) {
  // Mirrored-x architecture: plinth, paired columns, lintel, an arch cut, stepped crown.
  // The geometry is authored y-up (the SDF idiom), but voxelizeSdf's k axis — the axis the
  // isometric painter draws as UP — is the SDF's z. The wrapper swaps the two so the monument
  // stands instead of lying on its side (the first build rendered it horizontal; the browser
  // contact sheet caught it).
  const colX = tune && tune.a != null ? 0.2 + tune.a * 0.45 : 0.35 + rng() * 0.25;
  const colR = 0.09 + rng() * 0.07;
  const lintelY = 0.25 + rng() * 0.2;
  const archR = tune && tune.b != null ? 0.1 + tune.b * 0.32 : 0.22 + rng() * 0.16;
  const crown = tune && tune.c != null ? 0.06 + tune.c * 0.24 : 0.12 + rng() * 0.14;
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

function buildTerrain(seedStr, rng, res, tune) {
  // The plot-maps elevation field extruded to columns: the cartography and voxel lanes share
  // one terrain truth, so a seed's map and its voxel relief agree by construction.
  const w = res, h = res;
  const { field, seaLevel } = elevationField(seedStr, w, h, {
    ridged: tune && tune.c != null ? tune.c >= 0.5 : rng() < 0.5,
    waterFrac: tune && tune.b != null ? 0.1 + tune.b * 0.6 : 0.3,
  });
  const heightScale = tune && tune.a != null ? 0.25 + tune.a * 0.6 : 0.55;
  const grid = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) row.push(0.12 + 0.88 * field[y * w + x]);
    grid.push(row);
  }
  const vox = voxelizeHeightGrid(grid, Math.round(res * heightScale));
  vox.seaLevel = seaLevel;
  return vox;
}

function buildGrowth(rng, res, tune) {
  // Accretion: from a floor seed, each round attaches new cells to the surface with an upward
  // bias — coral logic, deterministic because the candidate scan order and rng are both fixed.
  const nx = res, ny = res, nz = res;
  const occ = new Uint8Array(nx * ny * nz);
  const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) ? 0 : occ[(z * ny + y) * nx + x];
  const set = (x, y, z) => { occ[(z * ny + y) * nx + x] = 1; };
  const c = Math.floor(res / 2);
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) set(c + dx, c + dy, 0);
  const rounds = Math.round(res * (tune && tune.a != null ? 0.6 + tune.a * 2.2 : 1.4));
  const supportW = tune && tune.c != null ? 0.012 + tune.c * 0.05 : 0.028;
  const upBias = tune && tune.b != null ? tune.b * 0.12 : 0.05;
  for (let r = 0; r < rounds; r++) {
    const adds = [];
    for (let z = 0; z < nz - 1; z++) {
      for (let y = 1; y < ny - 1; y++) {
        for (let x = 1; x < nx - 1; x++) {
          if (at(x, y, z)) continue;
          const support = at(x - 1, y, z) + at(x + 1, y, z) + at(x, y - 1, z) + at(x, y + 1, z) + at(x, y, z - 1);
          if (!support) continue;
          // Upward-biased stochastic accretion; more support = likelier fill (smoother trunks).
          const p = supportW * support + (at(x, y, z - 1) ? upBias : 0) + z / nz * 0.012;
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

// Per-study labels for the three tuning knobs, so the UI can say what each slider means in the
// study's own terms rather than "a / b / c".
export const VOXEL_STUDIES = Object.freeze({
  relic:    { label: "Relic",    tune: ["Cores", "Carvers", "Weld"],
              build: (seed, rng, res, tune) => buildRelic(rng, res, tune) },
  monument: { label: "Monument", tune: ["Column spread", "Arch size", "Crown"],
              build: (seed, rng, res, tune) => buildMonument(rng, res, tune) },
  terrain:  { label: "Terrain",  tune: ["Height", "Water", "Ridged"],
              build: (seed, rng, res, tune) => buildTerrain(seed, rng, Math.min(96, res), tune) },
  growth:   { label: "Growth",   tune: ["Rounds", "Reach", "Thickness"],
              build: (seed, rng, res, tune) => buildGrowth(rng, Math.min(72, res), tune) },
});

/**
 * buildVoxelScene(seedStr, { study, res, tune }) → { vox, mat, palette, meta } — the whole sheet.
 * `tune` is { a, b, c } in [0,1] or null: null keeps the seed's own draws, so every seed built
 * before tuning existed still reproduces byte for byte; a tuned build records its knobs in meta.
 */
export function buildVoxelScene(seedStr, opts = {}) {
  const study = VOXEL_STUDIES[opts.study] ? opts.study : "relic";
  const res = Math.max(16, Math.min(96, opts.res || 48));
  const tune = opts.tune && (opts.tune.a != null || opts.tune.b != null || opts.tune.c != null)
    ? { a: clamp01(opts.tune.a), b: clamp01(opts.tune.b), c: clamp01(opts.tune.c) }
    : null;
  const rng = mulberry(hash32(String(seedStr) + ":" + study));
  const vox = VOXEL_STUDIES[study].build(String(seedStr), rng, res, tune);
  const mat = assignMaterials(vox, rng, vox.seaLevel);
  const palette = seededPalette(rng);
  return {
    vox, mat, palette,
    meta: {
      seed: String(seedStr), study, res: [vox.nx, vox.ny, vox.nz],
      voxels: voxelCount(vox), seaLevel: vox.seaLevel == null ? null : +vox.seaLevel.toFixed(4),
      tune, edits: 0,
    },
  };
}
function clamp01(v) { return v == null ? null : Math.max(0, Math.min(1, Number(v) || 0)); }

// ── Rotation: quarter turns about the vertical axis ──────────────────────────
// The painter's grammar (top/right/left faces, x+y+z depth) is fixed, so rotation happens in the
// DATA: remap occupancy and materials k quarter-turns about z and hand the painter a grid it
// already knows how to draw. Four turns must be the identity; a test holds that.
export function rotateScene(scene, quarterTurns) {
  const k = ((quarterTurns % 4) + 4) % 4;
  if (k === 0) return scene;
  const { vox, mat } = scene;
  const src = { nx: vox.nx, ny: vox.ny };
  const nx = k % 2 === 0 ? vox.nx : vox.ny;
  const ny = k % 2 === 0 ? vox.ny : vox.nx;
  const occ = new Uint8Array(nx * ny * vox.nz);
  const m2 = new Uint8Array(nx * ny * vox.nz);
  for (let z = 0; z < vox.nz; z++) {
    for (let y = 0; y < src.ny; y++) {
      for (let x = 0; x < src.nx; x++) {
        const i = (z * src.ny + y) * src.nx + x;
        if (!vox.occ[i]) continue;
        let tx, ty;
        if (k === 1) { tx = src.ny - 1 - y; ty = x; }
        else if (k === 2) { tx = src.nx - 1 - x; ty = src.ny - 1 - y; }
        else { tx = y; ty = src.nx - 1 - x; }
        const j = (z * ny + ty) * nx + tx;
        occ[j] = 1;
        m2[j] = mat[i];
      }
    }
  }
  return {
    ...scene,
    vox: { ...vox, nx, ny, occ },
    mat: m2,
  };
}

// ── Manual editing ───────────────────────────────────────────────────────────
// The pick buffer gives the pointer a voxel: each visible face is drawn flat with a colour that
// encodes (cellIndex * 4 + faceId + 1) across RGB, no blending, no AO, so one getImageData read
// decodes exactly which face of which cell is under the cursor.
const FACE_IDS = { top: 0, right: 1, left: 2 };
const FACE_DIRS = [[0, 0, 1], [1, 0, 0], [0, 1, 0]];   // outward normal per face id

export function encodePick(cellIndex, faceId) {
  const v = cellIndex * 4 + faceId + 1;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function decodePick(r, g, b) {
  const v = ((r << 16) | (g << 8) | b) - 1;
  if (v < 0) return null;
  return { cellIndex: Math.floor(v / 4), faceId: v % 4 };
}

/**
 * applyVoxelEdit(scene, cellIndex, faceId, mode) → true if the scene changed.
 *   build  — place a voxel against the picked face (inherits the picked cell's material)
 *   chisel — remove the picked voxel
 *   paint  — advance the picked voxel's material band (cycles 1..5)
 * Edits mutate the live scene and bump meta.edits, so the readout and every export say honestly
 * that the object is seed + N hand edits, not pure seed.
 */
export function applyVoxelEdit(scene, cellIndex, faceId, mode) {
  const { vox, mat } = scene;
  if (cellIndex < 0 || cellIndex >= vox.occ.length || !vox.occ[cellIndex]) return false;
  if (mode === "chisel") {
    vox.occ[cellIndex] = 0;
    mat[cellIndex] = 0;
  } else if (mode === "paint") {
    mat[cellIndex] = (mat[cellIndex] % 5) + 1;
  } else {   // build
    const d = FACE_DIRS[faceId] || FACE_DIRS[0];
    const x = cellIndex % vox.nx;
    const y = Math.floor(cellIndex / vox.nx) % vox.ny;
    const z = Math.floor(cellIndex / (vox.nx * vox.ny));
    const tx = x + d[0], ty = y + d[1], tz = z + d[2];
    if (tx < 0 || ty < 0 || tz < 0 || tx >= vox.nx || ty >= vox.ny || tz >= vox.nz) return false;
    const j = (tz * vox.ny + ty) * vox.nx + tx;
    if (vox.occ[j]) return false;
    vox.occ[j] = 1;
    mat[j] = mat[cellIndex] || 2;
  }
  scene.meta.voxels = voxelCount(vox);
  scene.meta.edits = (scene.meta.edits || 0) + 1;
  return true;
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
// Quality pass: a soft ground shadow under the object's footprint anchors it (an object with no
// shadow floats), and a thin dark rim on every face both reads as drawn linework and hides the
// polygon seams between faces. opts.pickCtx, when given, receives the SAME geometry drawn flat
// with pick-encoded colours (no shadow, no rim, no cue), so pointer reads decode to cell + face.
export function renderVoxelScene(ctx, scene, W, H, opts = {}) {
  const { vox, mat, palette } = scene;
  const ground = opts.ground || "#0d1b1c";
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);
  const pick = opts.pickCtx || null;
  if (pick) { pick.fillStyle = "#000"; pick.fillRect(0, 0, W, H); }
  const list = isoOrder(vox);
  if (!list.length) return;
  const span = (vox.nx + vox.ny);
  const s0 = Math.min(W / (span * 1.1), H / (vox.nz + span * 0.5) / 1.05);
  // View transform: a REAL zoom, not a raster magnification. The painter is vector parallelograms,
  // so re-rendering with a scaled projection stays crisp at any magnification — the whole reason
  // this source refuses the CSS panzoom layer. view = { zoom, cx, cy } with (cx, cy) the zoom
  // centre as a fraction of the base frame; identity when absent.
  const view = opts.view || null;
  const zoom = view && view.zoom > 0 ? view.zoom : 1;
  const s = s0 * zoom;
  const baseOx = W / 2, baseOy = H * 0.12 + (vox.nz * s0);
  const ccx = (view ? view.cx : 0.5) * W, ccy = (view ? view.cy : 0.5) * H;
  const ox = W / 2 + (baseOx - ccx) * zoom;
  const oy = H / 2 + (baseOy - ccy) * zoom;
  const px = (x, y) => ox + (x - y) * s;
  const py = (x, y, z) => oy + (x + y) * s * 0.5 - z * s;
  const shade = ([r, g, b], f) => `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
  const depthMax = vox.nx + vox.ny + vox.nz;

  // Ground shadow: the z-max footprint projected at z = 0, blurred. Painted before any voxel.
  if (opts.shadow !== false) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.filter = `blur(${Math.max(2, s * 0.9)}px)`;
    ctx.beginPath();
    for (let y = 0; y < vox.ny; y++) {
      for (let x = 0; x < vox.nx; x++) {
        let solid = false;
        for (let z = 0; z < vox.nz; z++) { if (vox.occ[(z * vox.ny + y) * vox.nx + x]) { solid = true; break; } }
        if (!solid) continue;
        const X = px(x, y), Y = py(x, y, -0.4);
        ctx.moveTo(X, Y - s); ctx.lineTo(X + s, Y - s * 0.5); ctx.lineTo(X, Y); ctx.lineTo(X - s, Y - s * 0.5);
      }
    }
    ctx.fill();
    ctx.restore();
  }

  const rim = opts.rim !== false;
  ctx.lineWidth = Math.max(0.4, s * 0.05);
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineJoin = "round";
  const face = (X, Y, corners, fill, target) => {
    target.fillStyle = fill;
    target.beginPath();
    target.moveTo(X + corners[0][0] * s, Y + corners[0][1] * s);
    for (let i = 1; i < corners.length; i++) target.lineTo(X + corners[i][0] * s, Y + corners[i][1] * s);
    target.closePath();
    target.fill();
    if (rim && target === ctx) target.stroke();
  };
  const TOP = [[0, -1], [1, -0.5], [0, 0], [-1, -0.5]];
  const RIGHT = [[1, -0.5], [1, 0.5], [0, 1], [0, 0]];
  const LEFT = [[-1, -0.5], [-1, 0.5], [0, 1], [0, 0]];
  const pickCss = (i, f) => { const [r, g, b] = encodePick(i, f); return `rgb(${r},${g},${b})`; };

  for (const v of list) {
    const idx = (v.z * vox.ny + v.y) * vox.nx + v.x;
    const base = palette[mat[idx]] || palette[2];
    const cue = 0.82 + 0.18 * (v.depth / depthMax);   // farther = slightly brighter (air)
    const X = px(v.x, v.y), Y = py(v.x, v.y, v.z);
    if (v.top) {
      face(X, Y, TOP, shade(base, 1.0 * faceAO(vox, v.x, v.y, v.z, "top") * cue), ctx);
      if (pick) face(X, Y, TOP, pickCss(idx, FACE_IDS.top), pick);
    }
    if (v.right) {
      face(X, Y, RIGHT, shade(base, 0.62 * faceAO(vox, v.x, v.y, v.z, "right") * cue), ctx);
      if (pick) face(X, Y, RIGHT, pickCss(idx, FACE_IDS.right), pick);
    }
    if (v.left) {
      face(X, Y, LEFT, shade(base, 0.42 * faceAO(vox, v.x, v.y, v.z, "left") * cue), ctx);
      if (pick) face(X, Y, LEFT, pickCss(idx, FACE_IDS.left), pick);
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
