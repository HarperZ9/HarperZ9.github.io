// plot-studies.js: the sheet vocabulary beyond cartography.
//
// The first plot-maps was four views of one idea (a height field, drawn four ways). These are
// different KINDS of sheet, chosen against the operator's own reference corpus rather than
// invented in a vacuum:
//
//   basin      river networks by flow accumulation - the map study that was missing, and the one
//              that gives a sheet a subject instead of a texture
//   moire      two line families beating against each other (op-art textiles; the interference
//              is the image, and it is pure single-stroke by construction)
//   lattice    isometric impossible-figure lattice (Penrose triangle logic, ambiguous cubes)
//   strata     dense biomechanical crosshatch over a fold field (Giger's ballpoint tonal range,
//              built the only way a pen can build it: line count)
//   monolith   a fog-shrouded slab against a graded field (Beksinski's towers, tone by hatch
//              density falling off with height)
//   nomogram   1970s plotter homage: nested polygon families and interference rasters, the
//              Molnar/Nake/Nees vocabulary that the May 1976 Computer Graphics and Art issue
//              (dada.compart-bremen.de) collected
//   orbital    harmonograph/Lissajous families drawn as one continuous decaying trace
//
// Every study returns { layers: [{name, polylines, weight, tone}] } in normalized [0,1] space,
// so the composer can stack them and the existing SVG exporter can pen-separate them unchanged.

import { jitter, multiPass, stipple, hatchFollows, dashed, spiralFill, clipLines } from "./plot-marks.js";
import { elevationField } from "./plot-maps.js";

const TAU = 6.283185307;
const M = 0.04;   // sheet margin, shared with plot-maps' frame

const clip = (lines) => clipLines(lines, M, M, 1 - M, 1 - M);

// ── basin: rivers by flow accumulation ──────────────────────────────────────
// The classic drainage derivation: sort cells by height, walk from high to low pushing each
// cell's accumulated flow into its steepest-descent neighbour, then trace the cells whose
// accumulation crosses a threshold. Strahler-ish weighting falls out of the accumulation value,
// so trunk rivers draw heavier than headwaters without a second pass.
export function basin(seedStr, rng, opts = {}) {
  const N = opts.res || 120;
  const { field, seaLevel } = elevationField(seedStr, N, N, { ridged: rng() < 0.4, octaves: 6 });
  const acc = new Float32Array(N * N).fill(1);
  const order = Array.from({ length: N * N }, (_, i) => i).sort((a, b) => field[b] - field[a]);
  const down = new Int32Array(N * N).fill(-1);
  for (const i of order) {
    const x = i % N, y = (i / N) | 0;
    let best = -1, bestH = field[i];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const j = ny * N + nx;
      if (field[j] < bestH) { bestH = field[j]; best = j; }
    }
    down[i] = best;
    if (best >= 0) acc[best] += acc[i];
  }
  const threshold = opts.threshold || 24;
  const trunk = [], minor = [];
  const drawn = new Uint8Array(N * N);
  for (const i of order) {
    if (acc[i] < threshold || drawn[i] || field[i] < seaLevel) continue;
    const line = [];
    let c = i;
    while (c >= 0 && !drawn[c] && field[c] >= seaLevel) {
      drawn[c] = 1;
      line.push([(c % N) / N, ((c / N) | 0) / N]);
      c = down[c];
    }
    if (line.length > 3) (acc[i] > threshold * 8 ? trunk : minor).push(jitter(line, rng, { wander: 0.001 }));
  }
  // The coast, as the boundary of the sea mask, traced by the same walk the contours use.
  const layers = [];
  if (minor.length) layers.push({ name: "tributaries", polylines: clip(minor), weight: 0.5, tone: "ink" });
  if (trunk.length) {
    const heavy = [];
    for (const l of trunk) heavy.push(...multiPass(l, rng, 2, 0.0006));
    layers.push({ name: "rivers", polylines: clip(heavy), weight: 1.1, tone: "ink" });
  }
  // Relief hachures: short downhill ticks on the steepest slopes, the 19th-century map register.
  const hach = hatchFollows(
    (x, y) => {
      const i = Math.min(N - 1, Math.floor(y * N)) * N + Math.min(N - 1, Math.floor(x * N));
      const e = field[i];
      const ex = field[Math.min(N * N - 1, i + 1)] - e, ey = field[Math.min(N * N - 1, i + N)] - e;
      return Math.atan2(ey, ex) + Math.PI;   // downhill
    },
    (x, y) => {
      const i = Math.min(N - 1, Math.floor(y * N)) * N + Math.min(N - 1, Math.floor(x * N));
      if (field[i] < seaLevel) return 0;
      const ex = field[Math.min(N * N - 1, i + 1)] - field[i];
      const ey = field[Math.min(N * N - 1, i + N)] - field[i];
      return Math.min(1, Math.hypot(ex, ey) * 26);
    },
    rng, { rows: opts.hachRows || 110, maxLen: 0.02, step: 0.0035 },
  );
  layers.push({ name: "hachures", polylines: clip(hach), weight: 0.4, tone: "support" });
  return { layers, meta: { seaLevel: +seaLevel.toFixed(4) } };
}

// ── moire: interference as the image ────────────────────────────────────────
// Two families of dense parallel lines, each warped by its own low-frequency field. Where the
// families beat, a third figure appears that is in neither family. Pure line, no fills, and the
// image lives in the frequency difference — the op-art register.
export function moire(seedStr, rng, opts = {}) {
  const count = Math.round(opts.count || 190);
  const warpA = 0.05 + rng() * 0.12, warpB = 0.05 + rng() * 0.12;
  const freqA = 2 + rng() * 5, freqB = 2 + rng() * 5;
  const rot = rng() * 0.5;
  const fam = (n, warp, freq, angle) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const line = [];
      for (let s = 0; s <= 140; s++) {
        const u = s / 140;
        const off = Math.sin(u * freq * TAU + t * TAU) * warp;
        const px = u, py = t + off;
        // rotate about the sheet centre
        const dx = px - 0.5, dy = py - 0.5;
        line.push([0.5 + dx * Math.cos(angle) - dy * Math.sin(angle), 0.5 + dx * Math.sin(angle) + dy * Math.cos(angle)]);
      }
      out.push(line);
    }
    return out;
  };
  return {
    layers: [
      { name: "family-a", polylines: clip(fam(count, warpA, freqA, 0)), weight: 0.42, tone: "ink" },
      { name: "family-b", polylines: clip(fam(count, warpB, freqB, rot)), weight: 0.42, tone: "ink" },
    ],
    meta: { freqA: +freqA.toFixed(2), freqB: +freqB.toFixed(2), beat: +Math.abs(freqA - freqB).toFixed(2) },
  };
}

// ── lattice: impossible isometric figures ───────────────────────────────────
// An isometric cube lattice where a seeded subset of cells has its depth order INVERTED. Locally
// every junction is legal; globally the solid cannot exist. This is the Penrose triangle's
// mechanism (consistent local joins, inconsistent global depth) applied to a field.
export function lattice(seedStr, rng, opts = {}) {
  const cols = Math.round(opts.cols || 13);
  const s = (1 - 2 * M) / cols;
  const h = s * 0.5;
  const cells = [], impossible = [];
  const flipRate = opts.flipRate == null ? 0.18 : opts.flipRate;
  for (let r = 0; r < cols * 2; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() > (opts.fill == null ? 0.62 : opts.fill)) continue;
      const cx = M + (c + (r % 2) * 0.5) * s;
      const cy = M + r * h * 0.86;
      if (cx > 1 - M - s || cy > 1 - M - s) continue;
      // The three visible faces of an isometric cube, as three rhombi sharing the centre.
      const top = [[cx, cy - h], [cx + s / 2, cy - h / 2], [cx, cy], [cx - s / 2, cy - h / 2], [cx, cy - h]];
      const right = [[cx + s / 2, cy - h / 2], [cx + s / 2, cy + h / 2], [cx, cy + h], [cx, cy], [cx + s / 2, cy - h / 2]];
      const left = [[cx - s / 2, cy - h / 2], [cx - s / 2, cy + h / 2], [cx, cy + h], [cx, cy], [cx - s / 2, cy - h / 2]];
      const flip = rng() < flipRate;
      (flip ? impossible : cells).push(top, right, left);
      // Interior hatch on one face only, which is what forces the eye to read a depth order
      // and therefore what makes the inversion visible as a contradiction.
      if (rng() < 0.5) {
        const face = flip ? left : right;
        const inner = [];
        for (let k = 1; k < 5; k++) {
          const t = k / 5;
          inner.push([[face[0][0] + (face[3][0] - face[0][0]) * t, face[0][1] + (face[3][1] - face[0][1]) * t],
            [face[1][0] + (face[2][0] - face[1][0]) * t, face[1][1] + (face[2][1] - face[1][1]) * t]]);
        }
        (flip ? impossible : cells).push(...inner);
      }
    }
  }
  return {
    layers: [
      { name: "lattice", polylines: clip(cells.map((l) => jitter(l, rng, { wander: 0.0008 }))), weight: 0.7, tone: "ink" },
      { name: "inverted", polylines: clip(impossible.map((l) => jitter(l, rng, { wander: 0.0008 }))), weight: 1.2, tone: "ink" },
    ],
    meta: { cells: cells.length, inverted: impossible.length },
  };
}

// ── strata: biomechanical crosshatch ────────────────────────────────────────
// Dense hatch whose direction follows a folded field and whose density follows a second field,
// so the tonal range comes entirely from line count. Two crossing passes at an angle give the
// crosshatch its depth. This is the ballpoint register: no fills, hours of line.
export function strata(seedStr, rng, opts = {}) {
  const { field } = elevationField(seedStr, 96, 96, { octaves: 6, ridged: true });
  const at = (x, y) => field[Math.min(95, Math.floor(y * 96)) * 96 + Math.min(95, Math.floor(x * 96))];
  const flow = (x, y) => at(x, y) * TAU * 1.6 + Math.sin(x * 5.0) * 0.7;
  const dens = (x, y) => {
    const e = at(x, y);
    return Math.max(0, Math.min(1, 0.15 + Math.pow(1 - Math.abs(e - 0.5) * 1.7, 2) * 0.95));
  };
  const rows = Math.round(opts.rows || 130);
  const a = hatchFollows(flow, dens, rng, { rows, maxLen: 0.075, step: 0.004 });
  const b = hatchFollows((x, y) => flow(x, y) + 1.15, (x, y) => dens(x, y) * 0.72, rng, { rows: Math.round(rows * 0.85), maxLen: 0.06, step: 0.004 });
  return {
    layers: [
      { name: "hatch", polylines: clip(a), weight: 0.4, tone: "ink" },
      { name: "cross", polylines: clip(b), weight: 0.35, tone: "ink" },
    ],
    meta: { strokes: a.length + b.length },
  };
}

// ── monolith: a slab in fog ─────────────────────────────────────────────────
// One dark mass, hatched densest at its base and dissolving upward, over a stippled ground that
// thins with height. The subject is the silhouette; the medium is falloff.
export function monolith(seedStr, rng, opts = {}) {
  const w = 0.16 + rng() * 0.14;
  const cx = 0.34 + rng() * 0.32;
  const top = 0.14 + rng() * 0.16, base = 0.86;
  const lean = (rng() - 0.5) * 0.05;
  const edgeAt = (t) => w * (0.62 + 0.38 * t) * 0.5;   // tapers toward the top
  const inside = (x, y) => {
    if (y < top || y > base) return 0;
    const t = (y - top) / (base - top);
    const c = cx + lean * (1 - t);
    return Math.abs(x - c) < edgeAt(t) ? 1 : 0;
  };
  const dens = (x, y) => {
    if (!inside(x, y)) return 0;
    const t = (y - top) / (base - top);
    return Math.max(0.05, Math.pow(t, 1.4));   // dissolves upward
  };
  const body = hatchFollows(() => Math.PI / 2 + 0.06, dens, rng, { rows: Math.round(opts.rows || 150), maxLen: 0.05, step: 0.0035 });
  // Silhouette: the two flanks and the crown, drawn heavier so the mass has an edge.
  const flanks = [[], []];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, y = top + (base - top) * t, c = cx + lean * (1 - t);
    flanks[0].push([c - edgeAt(t), y]);
    flanks[1].push([c + edgeAt(t), y]);
  }
  const ground = stipple((x, y) => (y > base - 0.02 ? Math.max(0, (y - base + 0.02) * 6) : 0), rng, { count: Math.round(opts.ground || 1800), dotR: 0.001 });
  const fog = [];
  for (let i = 0; i < 26; i++) {
    const y = base - 0.02 - i * 0.012;
    const line = [];
    for (let s = 0; s <= 70; s++) {
      const x = M + (s / 70) * (1 - 2 * M);
      line.push([x, y + Math.sin(s * 0.16 + i) * 0.0022]);
    }
    fog.push(...dashed(line, 0.01 + rng() * 0.02, 0.02 + rng() * 0.04));
  }
  return {
    layers: [
      { name: "fog", polylines: clip(fog), weight: 0.32, tone: "support" },
      { name: "ground", polylines: clip(ground), weight: 0.4, tone: "support" },
      { name: "mass", polylines: clip(body), weight: 0.38, tone: "ink" },
      { name: "silhouette", polylines: clip(flanks.map((f) => jitter(f, rng, { wander: 0.0012 }))), weight: 1.4, tone: "ink" },
    ],
    meta: { width: +w.toFixed(3) },
  };
}

// ── nomogram: the 1970s plotter vocabulary ──────────────────────────────────
// Nested polygon families with progressive rotation and vertex disturbance — the Molnar
// "(Des)Ordres" move — over an interference raster. Drawn from the same generator family the
// May 1976 Computer Graphics and Art issue collected.
export function nomogram(seedStr, rng, opts = {}) {
  const gridN = Math.round(opts.grid || 6);
  const cell = (1 - 2 * M) / gridN;
  const nests = [], raster = [];
  for (let gy = 0; gy < gridN; gy++) {
    for (let gx = 0; gx < gridN; gx++) {
      const ox = M + (gx + 0.5) * cell, oy = M + (gy + 0.5) * cell;
      // Disorder grows across the sheet, Molnar's central device.
      const disorder = Math.pow((gx + gy) / (2 * gridN - 2), 1.6) * 0.36;
      const rings = 3 + Math.floor(rng() * 5);
      const sides = 4;
      for (let r = 0; r < rings; r++) {
        const rad = cell * 0.46 * (1 - r / (rings + 0.6));
        const rot = r * 0.09 + rng() * disorder;
        const poly = [];
        for (let k = 0; k <= sides; k++) {
          const a = (k / sides) * TAU + rot;
          const jx = (rng() - 0.5) * disorder * cell * 0.5;
          const jy = (rng() - 0.5) * disorder * cell * 0.5;
          poly.push([ox + Math.cos(a) * rad + jx, oy + Math.sin(a) * rad + jy]);
        }
        nests.push(poly);
      }
    }
  }
  // Interference raster behind: two line rates that beat.
  const rate = 60 + Math.floor(rng() * 90);
  for (let i = 0; i < rate; i++) {
    const y = M + (i / (rate - 1)) * (1 - 2 * M);
    const line = [];
    for (let s = 0; s <= 90; s++) {
      const x = M + (s / 90) * (1 - 2 * M);
      line.push([x, y + Math.sin(x * 30 + i * 0.31) * 0.0016]);
    }
    raster.push(line);
  }
  return {
    layers: [
      { name: "raster", polylines: clip(raster), weight: 0.28, tone: "support" },
      { name: "nests", polylines: clip(nests), weight: 0.65, tone: "ink" },
    ],
    meta: { cells: gridN * gridN, rings: nests.length },
  };
}

// ── orbital: one continuous decaying trace ──────────────────────────────────
// A harmonograph: four damped sinusoids, two per axis, drawn as ONE unbroken path. Zero pen
// lifts across the whole sheet, which is the plotter's most characteristic gesture.
export function orbital(seedStr, rng, opts = {}) {
  const f = () => 1 + Math.floor(rng() * 7) + (rng() < 0.4 ? rng() * 0.02 : 0);
  const a1 = f(), a2 = f(), b1 = f(), b2 = f();
  const p1 = rng() * TAU, p2 = rng() * TAU, p3 = rng() * TAU, p4 = rng() * TAU;
  const decay = 0.00018 + rng() * 0.0006;
  const steps = Math.round(opts.steps || 26000);
  const line = [];
  for (let i = 0; i < steps; i++) {
    const t = i * 0.0075;
    const d = Math.exp(-decay * i);
    const x = 0.5 + d * 0.21 * (Math.sin(a1 * t + p1) + Math.sin(a2 * t + p2));
    const y = 0.5 + d * 0.21 * (Math.sin(b1 * t + p3) + Math.sin(b2 * t + p4));
    line.push([x, y]);
  }
  const spiral = spiralFill(0.5, 0.5, 0.44, () => 0.35, { turns: 22, stepsPerTurn: 120 });
  return {
    layers: [
      { name: "field", polylines: clip(spiral), weight: 0.22, tone: "support" },
      { name: "trace", polylines: clip([line]), weight: 0.55, tone: "ink" },
    ],
    meta: { ratios: [a1, a2, b1, b2].map((v) => +v.toFixed(2)), points: line.length },
  };
}

// ── scanline: amplitude-modulated relief rows ───────────────────────────────
// The SquiggleDraw move (github.com/evil-mad/SquiggleDraw): one polyline per row whose amplitude
// AND frequency both rise with local darkness. Tone is carried entirely by how much line is
// packed into a row, which is the purest expression of the plotter's constraint. Shading comes
// from a hillshade of the seeded field, so the rows describe a landform rather than noise.
export function scanline(seedStr, rng, opts = {}) {
  const N = 128;
  const { field } = elevationField(seedStr, N, N, { octaves: 6, ridged: rng() < 0.35 });
  const at = (x, y) => field[Math.min(N - 1, Math.max(0, Math.floor(y * N))) * N + Math.min(N - 1, Math.max(0, Math.floor(x * N)))];
  // Hillshade: light from the upper left, the cartographic convention.
  const az = 2.356 + (rng() - 0.5) * 0.9, alt = 0.6;
  const shade = (x, y) => {
    const e = at(x, y), d = 1 / N;
    const gx = (at(x + d, y) - e) * N, gy = (at(x, y + d) - e) * N;
    const slope = Math.atan(Math.hypot(gx, gy) * 0.6);
    const aspect = Math.atan2(gy, gx);
    return Math.max(0, Math.min(1, Math.cos(alt) * Math.cos(slope) + Math.sin(alt) * Math.sin(slope) * Math.cos(az - aspect)));
  };
  const rows = Math.round(opts.rows || 110);
  const pitch = (1 - 2 * M) / rows;
  const A0 = pitch * 0.46, f0 = 46 + rng() * 30;
  const lines = [];
  for (let j = 0; j < rows; j++) {
    const y = M + (j + 0.5) * pitch;
    const line = [];
    let phase = 0;
    const dx = 0.0016;
    for (let x = M; x <= 1 - M; x += dx) {
      const t = 1 - shade(x, y);                       // 0 light, 1 dark
      phase += TAU * f0 * (1 + 2.2 * t) * dx;
      line.push([x, y + A0 * Math.pow(t, 1.3) * Math.sin(phase)]);
    }
    lines.push(line);
  }
  return { layers: [{ name: "scan", polylines: clip(lines), weight: 0.42, tone: "ink" }], meta: { rows, f0: +f0.toFixed(1) } };
}

// ── horizon: the outrun grid ────────────────────────────────────────────────
// A perspective grid to a vanishing point, a scanline sun that the ridge occludes, and a
// silhouette skyline. Entirely polylines: the sun is horizontal bars whose length follows a
// circle and whose pitch widens downward, which is how the register was drawn before it was a
// raster gradient.
export function horizon(seedStr, rng, opts = {}) {
  const yh = 0.40 + rng() * 0.10;                       // horizon line
  const vx = 0.5 + (rng() - 0.5) * 0.22;                // vanishing point
  const depth = 22 + Math.floor(rng() * 16);
  const sunR = 0.10 + rng() * 0.07;
  const sunY = yh - sunR * (0.35 + rng() * 0.5);
  const grid = [], sun = [], sky = [];

  // Ground: verticals converging on the vanishing point, horizontals compressing toward yh.
  for (let i = 0; i <= depth; i++) {
    const t = i / depth;
    const x = M + t * (1 - 2 * M);
    grid.push([[x, 1 - M], [vx, yh]]);
  }
  const cross = 16 + Math.floor(rng() * 12);
  for (let i = 1; i <= cross; i++) {
    const y = yh + (1 - M - yh) * Math.pow(i / cross, 2.2);
    grid.push([[M, y], [1 - M, y]]);
  }
  // Sun: bars clipped to a circle, pitch widening downward so the disc reads as scanned.
  const bars = 22 + Math.floor(rng() * 14);
  for (let i = 0; i < bars; i++) {
    const t = i / (bars - 1);
    const y = sunY - sunR + t * 2 * sunR;
    const dy = (y - sunY) / sunR;
    if (Math.abs(dy) >= 1) continue;
    const half = Math.sqrt(1 - dy * dy) * sunR;
    // Gap widens toward the bottom of the disc: the register's signature.
    if (t > 0.45 && rng() < (t - 0.45) * 1.4) continue;
    sun.push([[vx - half, y], [vx + half, y]]);
  }
  // Skyline: a jagged ridge on the horizon, drawn as one polyline so it occludes cleanly.
  const ridge = [[M, yh]];
  let h = 0;
  for (let x = M; x <= 1 - M; x += 0.006) {
    h = h * 0.72 + (rng() - 0.5) * 0.055;
    ridge.push([x, yh - Math.abs(h) * 0.9]);
  }
  ridge.push([1 - M, yh]);
  // Remove sun bars that fall behind the ridge: the occlusion that makes it a scene.
  const ridgeAt = (x) => {
    const i = Math.max(1, Math.min(ridge.length - 1, Math.round((x - M) / 0.006)));
    return ridge[i][1];
  };
  const visibleSun = sun.filter(([a, b]) => a[1] < ridgeAt(a[0]) && b[1] < ridgeAt(b[0]));
  for (let i = 0; i < 5; i++) {
    const y = M + i * 0.018 + rng() * 0.01;
    sky.push(...dashed([[M, y], [1 - M, y]], 0.02 + rng() * 0.05, 0.03 + rng() * 0.06));
  }
  return {
    layers: [
      { name: "sky", polylines: clip(sky), weight: 0.3, tone: "support" },
      { name: "sun", polylines: clip(visibleSun), weight: 1.0, tone: "ink" },
      { name: "grid", polylines: clip(grid), weight: 0.38, tone: "support" },
      { name: "skyline", polylines: clip([ridge]), weight: 1.3, tone: "ink" },
    ],
    meta: { horizon: +yh.toFixed(3), depth, bars: visibleSun.length },
  };
}

// ── stitch: hitomezashi sashiko ─────────────────────────────────────────────
// The parity rule (Defant and Krattenthaler, arXiv 2201.03461): a bit per column and per row
// decides which cells carry a dash. Adjacent dashes chain into staircases, so the output is a
// few hundred long strokes rather than ten thousand ticks. The bits come from the SEED STRING
// itself, so typing a phrase composes a textile.
export function stitch(seedStr, rng, opts = {}) {
  const n = Math.round(opts.cells || (44 + Math.floor(rng() * 40)));
  const step = (1 - 2 * M) / n;
  const bit = (kind, i) => {
    let h = 0x811c9dc5;
    const s = `${seedStr}|${kind}|${i}`;
    for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 0x01000193); }
    return (h >>> 0) & 1;
  };
  const lines = [];
  // Vertical family: chain consecutive dashes in a column into one stroke.
  for (let i = 0; i <= n; i++) {
    const x = M + i * step, b = bit("v", i);
    let run = null;
    for (let j = 0; j < n; j++) {
      if ((j & 1) === b) {
        const y0 = M + j * step, y1 = y0 + step;
        if (run) run.push([x, y1]);
        else run = [[x, y0], [x, y1]];
      } else if (run) { lines.push(run); run = null; }
    }
    if (run) lines.push(run);
  }
  for (let j = 0; j <= n; j++) {
    const y = M + j * step, b = bit("h", j);
    let run = null;
    for (let i = 0; i < n; i++) {
      if ((i & 1) === b) {
        const x0 = M + i * step, x1 = x0 + step;
        if (run) run.push([x1, y]);
        else run = [[x0, y], [x1, y]];
      } else if (run) { lines.push(run); run = null; }
    }
    if (run) lines.push(run);
  }
  return {
    layers: [{ name: "stitch", polylines: clip(lines.map((l) => jitter(l, rng, { wander: 0.0007 }))), weight: 0.7, tone: "ink" }],
    meta: { cells: n, strokes: lines.length },
  };
}

export const STUDY_BUILDERS = Object.freeze({
  basin:    { label: "River basin",  build: basin },
  moire:    { label: "Moire",        build: moire },
  lattice:  { label: "Lattice",      build: lattice },
  strata:   { label: "Strata",       build: strata },
  monolith: { label: "Monolith",     build: monolith },
  nomogram: { label: "Nomogram",     build: nomogram },
  orbital:  { label: "Orbital",      build: orbital },
  scanline: { label: "Scanline",     build: scanline },
  horizon:  { label: "Horizon",      build: horizon },
  stitch:   { label: "Stitch",       build: stitch },
});
