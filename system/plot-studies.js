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
import { elevationField, fieldToLuma } from "./plot-maps.js";
import { contourFromLuma } from "./plotter.js";
import { toneField, edgeTangentFlow, evenStreamlines } from "./plot-image.js";

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

// ── tanaka: illuminated contours ────────────────────────────────────────────
// Tanaka's relief method (1950): light every contour from a fixed NW sun and let LINE WEIGHT
// carry the shading. A contour segment whose slope falls toward the light draws thin, one whose
// slope falls away draws heavy, and where the slope runs parallel to the rays the line drops out
// entirely. Two pens, one rule, no hatch — the technical-sheet register at its most economical,
// and the relief must read from weight alone or the study has failed.
export function tanaka(seedStr, rng, opts = {}) {
  const N = opts.res || 150;
  const { field, seaLevel } = elevationField(seedStr, N, N, { octaves: 6, ridged: rng() < 0.35 });
  // Many levels through the ONE tested iso-line tracer, each at an explicit threshold. The first
  // cut had to window narrow elevation bands onto contourFromLuma's five fixed levels, because
  // the threshold option was accepted and ignored; that workaround traced every interior band
  // boundary TWICE (band b's top level and band b+1's bottom level resolve to the same
  // elevation), laying double ink on four of the levels and reading as false index contours —
  // which defeats the study's whole premise that weight alone carries the shading. The option is
  // honest now, so the levels are simply asked for.
  const levels = Math.max(6, Math.min(48, Math.round(opts.levels || 25)));
  const lo = seaLevel + 0.02, hi = 0.975;
  const luma = fieldToLuma(field, N, N);
  const contours = [];
  for (let i = 0; i < levels; i++) {
    const t = lo + ((i + 0.5) / levels) * (hi - lo);
    contours.push(...contourFromLuma(luma, N, N, 4, { threshold: t }));
  }
  // The sun. NW is the cartographic convention (and why a map's relief inverts upside down);
  // screen y grows DOWN, so up-left is (-1,-1) and its angle is -3pi/4. A small wobble keeps
  // sheets from being clones without ever moving the sun off its quadrant.
  const sunA = -2.356 + (rng() - 0.5) * 0.5;
  const lx = Math.cos(sunA), ly = Math.sin(sunA);
  const at = (x, y) => field[Math.max(0, Math.min(N - 1, y)) * N + Math.max(0, Math.min(N - 1, x))];
  const facing = (mx, my) => {
    const xi = Math.round(mx), yi = Math.round(my);
    const gx = at(xi + 1, yi) - at(xi - 1, yi), gy = at(xi, yi + 1) - at(xi, yi - 1);
    const m = Math.hypot(gx, gy);
    return m < 1e-9 ? 0 : (-gx * lx - gy * ly) / m;   // downhill direction · toward the sun
  };
  const gapT = 0.2 + rng() * 0.1;   // the drop-out sector where a line tapers to nothing
  const lit = [], shade = [];
  for (const poly of contours) {
    let run = null, cls = 0;
    const flush = () => { if (run && run.length > 1) (cls > 0 ? lit : shade).push(run); run = null; };
    for (let i = 1; i < poly.length; i++) {
      const f = facing((poly[i - 1][0] + poly[i][0]) / 2, (poly[i - 1][1] + poly[i][1]) / 2);
      const c = f > gapT ? 1 : f < -gapT ? -1 : 0;
      if (c !== cls) { flush(); cls = c; }
      if (c !== 0) {
        if (!run) run = [[poly[i - 1][0] / N, poly[i - 1][1] / N]];
        run.push([poly[i][0] / N, poly[i][1] / N]);
      }
    }
    flush();
  }
  return {
    layers: [
      // Two weights, two pens: 0.38 stays on the drawing pen, 1.25 crosses the exporter's 1.2
      // heavy-pen threshold, so the light/shadow split survives into the physical plot.
      { name: "lit", polylines: clip(lit), weight: 0.38, tone: "ink" },
      { name: "shade", polylines: clip(shade), weight: 1.25, tone: "ink" },
    ],
    meta: { levels, seaLevel: +seaLevel.toFixed(4), gapT: +gapT.toFixed(3) },
  };
}

// ── relief: the engraved landform ───────────────────────────────────────────
// Jobard & Lefer's even streamline placement pointed at terrain instead of a photograph: the
// elevation field becomes a tone field (valleys dark, ridges near paper), the structure tensor of
// that tone gives the flow, and the strokes follow the landform with separation carrying the tone
// — tight in the valleys, open on the crests. Burin logic applied to ground, and the same
// primitives plot-image-studies runs on a picture, reused rather than rebuilt.
export function relief(seedStr, rng, opts = {}) {
  const N = opts.res || 180;
  const { field, seaLevel } = elevationField(seedStr, N, N, { octaves: 5, ridged: rng() < 0.5 });
  // The tone floor stays above 0 so the deepest valley still reads as LINE at sepMin, not a
  // flood; the ceiling stays under 1 but under inkMin at the very top, so crests go bare paper.
  const g = 1.1 + rng() * 0.7;
  const tone = toneField(fieldToLuma(field, N, N, (v) => 0.10 + 0.82 * Math.pow(v, g)), N, N, 4);
  const etf = edgeTangentFlow(tone, { sigma: 3 });
  const sepMin = 1.4 + rng() * 0.5, sepMax = 7.5 + rng() * 3;
  const flow = evenStreamlines(tone, etf, { sepMin, sepMax, maxSteps: 340, maxLines: 6000, inkMin: 0.09 });
  // Second burin pass ACROSS the flow, gated to the deepest tone: the crosshatch that gives the
  // valley floors their weight (engrave's move in plot-image-studies, same inkMin gate).
  const cross = evenStreamlines(tone, etf, {
    offset: Math.PI / 2, inkMin: 0.62, sepMin: sepMin + 0.7, sepMax: 6, maxSteps: 150, maxLines: 2200,
  });
  const norm = (ls) => ls.map((l) => l.map(([x, y]) => [x / (N - 1), y / (N - 1)]));
  const layers = [{ name: "flow", polylines: clip(norm(flow)), weight: 0.5, tone: "ink" }];
  if (cross.length) layers.push({ name: "cross", polylines: clip(norm(cross)), weight: 0.42, tone: "ink" });
  return { layers, meta: { seaLevel: +seaLevel.toFixed(4), strokes: flow.length + cross.length } };
}

// ── zigzag: op-art textile interference ─────────────────────────────────────
// The Riley move, and the textile shelf's: a strict zigzag repeat that a slow modulation pushes
// into interference. Every strand is the same triangle wave; a low-frequency seeded field bends
// each strand's RATE and AMPLITUDE slightly, so strands drift in and out of phase with their
// neighbours and the flat weave breaks into standing waves that exist in no single strand.
// NO jitter anywhere: the op-art edge is a hard edge, and on this sheet the drawn-line wobble
// every other study wants would read as a defect. Exactness is the register.
export function zigzag(seedStr, rng, opts = {}) {
  const rows = Math.round(opts.rows || (140 + Math.floor(rng() * 70)));
  const zigs = 22 + Math.floor(rng() * 16);
  const G = 40;
  const { field: rf } = elevationField(String(seedStr) + "~rate", G, G, { octaves: 2, baseFreq: 2.1 });
  const { field: af } = elevationField(String(seedStr) + "~amp", G, G, { octaves: 2, baseFreq: 1.7 });
  // Bilinear over the lattice: nearest sampling would step the phase RATE cell to cell, and a
  // stepped rate integrates into visible kinks on what must be a machined line.
  const smooth = (f) => (x, y) => {
    const gx = Math.max(0, Math.min(G - 1.001, x * (G - 1))), gy = Math.max(0, Math.min(G - 1.001, y * (G - 1)));
    const x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0;
    const a = f[y0 * G + x0], b = f[y0 * G + x0 + 1], c = f[(y0 + 1) * G + x0], d = f[(y0 + 1) * G + x0 + 1];
    return a + (b - a) * fx + (c + (d - c) * fx - (a + (b - a) * fx)) * fy;
  };
  const rate = smooth(rf), ampF = smooth(af);
  const span = 1 - 2 * M, pitch = span / rows;
  const A0 = pitch * (0.8 + rng() * 0.5);
  const pdepth = 0.9 + rng() * 0.7;   // capped so the zig rate never stalls or reverses
  const amp = (x, y) => A0 * (0.55 + 0.9 * ampF(x, y));
  // Triangle wave, phase in CYCLES: tri(m) = -1, tri(m + 0.5) = +1, straight legs between.
  const tri = (p) => { const c = p - Math.floor(p); return c < 0.5 ? 4 * c - 1 : 3 - 4 * c; };
  const samples = zigs * 7;
  // The strand band is inset by the largest possible amplitude: a strand that crossed the margin
  // would be clipped into half-zigs, and a frayed edge is exactly what this panel must not have.
  const maxA = A0 * 1.45, y0lo = M + maxA, yspan = span - 2 * maxA;
  const lines = [];
  for (let j = 0; j < rows; j++) {
    const y0 = y0lo + (j + 0.5) * (yspan / rows);
    let phase = 0.5;   // every strand starts ON its crest: the aligned repeat is the ground state
    let xp = M;
    const line = [[M, y0 + amp(M, y0)]];
    for (let s = 1; s <= samples; s++) {
      const x = M + (s / samples) * span;
      const dp = (zigs / samples) * (1 + pdepth * (rate(x, y0) - 0.5));
      const p2 = phase + dp;
      // Emit a vertex AT every crest the step crossed. Sampling alone clips the corners by up to
      // a quarter of the amplitude wherever the modulated crest lands between samples, and a
      // randomly blunted zig reads as jitter — the one thing this study must never show.
      for (let k = Math.floor(phase / 0.5) + 1; k * 0.5 < p2; k++) {
        const xc = xp + ((k * 0.5 - phase) / dp) * (x - xp);
        line.push([xc, y0 + amp(xc, y0) * (k % 2 ? 1 : -1)]);
      }
      line.push([x, y0 + amp(x, y0) * tri(p2)]);
      phase = p2; xp = x;
    }
    lines.push(line);
  }
  return {
    layers: [{ name: "weave", polylines: clip(lines), weight: 0.55, tone: "ink" }],
    meta: { rows, zigs, strokes: lines.length },
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
  tanaka:   { label: "Tanaka",       build: tanaka },
  relief:   { label: "Relief",       build: relief },
  zigzag:   { label: "Zigzag",       build: zigzag },
});
