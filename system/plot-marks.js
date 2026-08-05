// plot-marks.js: the MARK-MAKING layer for plotter output — how a line is drawn, not what is drawn.
//
// The first plot-maps shipped geometrically correct polylines that read as machined: uniform
// weight, no tonal range, one pass. What the plotter community actually posts is the opposite —
// density and repetition are the medium. r/PlotterArt's acclaimed work is "a million steps and
// almost 200k dots", "12-pass markers on coldpress watercolor", "gradients via dipping colorless
// markers in ink": tone built by LAYING DOWN MORE LINE, not by changing colour.
//
// So this module gives the studies a vocabulary of marks:
//   jitter        - a hand model, so a machine line reads as drawn
//   multiPass     - the same path N times with sub-mm offsets; tone from overlap
//   stipple       - weighted-density dots (Secord's Lloyd relaxation, simplified)
//   hatchFollows  - hatching whose DIRECTION follows a field (engraving logic: the hatch
//                   describes the form, it does not just fill it)
//   dashed        - broken line for support/graticule registers
//   spiralFill    - one unbroken spiral, the zero-pen-lift fill
//
// Everything is deterministic given a seeded rng, pure, and returns polylines in the same
// normalized [0,1] space the studies and exporters already speak.

// ── the hand ────────────────────────────────────────────────────────────────
// A plotter's line is exact; a drawn line is not. Two error scales matter: a low-frequency
// wander (the arm) and a high-frequency tremor (the hand). Modelling both, at amplitudes under
// half a millimetre on an A4 sheet, is the difference between "printed" and "drawn". Amounts
// are in normalized sheet units, so 0.001 is roughly 0.2mm on a 210mm sheet.
export function jitter(line, rng, opts = {}) {
  const wander = opts.wander == null ? 0.0016 : opts.wander;
  const tremor = opts.tremor == null ? 0.0004 : opts.tremor;
  if (line.length < 2) return line;
  // One wander phase per line, so a whole stroke leans consistently rather than shimmering.
  const wp = rng() * 6.283, wf = 1.5 + rng() * 2.5;
  const out = [];
  for (let i = 0; i < line.length; i++) {
    const t = i / (line.length - 1);
    const w = Math.sin(t * wf * 6.283 + wp) * wander;
    // Perpendicular direction, so the error displaces the line rather than stretching it.
    const [px, py] = line[Math.min(i + 1, line.length - 1)];
    const [qx, qy] = line[Math.max(i - 1, 0)];
    const dx = px - qx, dy = py - qy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const tr = (rng() - 0.5) * 2 * tremor;
    out.push([line[i][0] + nx * (w + tr), line[i][1] + ny * (w + tr)]);
  }
  return out;
}

// ── multi-pass ──────────────────────────────────────────────────────────────
// The community's tonal engine: draw the same path several times, each pass displaced by less
// than a pen width. Ink accumulates, the edge fuzzes, and the stroke gains weight the way a
// marker does after twelve passes. `passes` 1 leaves the line untouched, so callers can dial it.
export function multiPass(line, rng, passes = 1, spread = 0.0007) {
  if (passes <= 1) return [line];
  const out = [];
  for (let p = 0; p < passes; p++) {
    // Alternate the direction each pass: a real plotter draws back along the path rather than
    // lifting and returning, and the reversal is visible in how the ends build up.
    const src = p % 2 === 0 ? line : line.slice().reverse();
    out.push(jitter(src, rng, { wander: spread, tremor: spread * 0.4 }));
  }
  return out;
}

// ── stipple ─────────────────────────────────────────────────────────────────
// Weighted stippling: sample candidate points, keep them with probability set by a density
// function, then relax with a few Lloyd iterations against their own neighbours so the dots
// stop clumping and take on the even-but-not-gridded distribution that reads as tone.
// Returns tiny polylines (a dot is a stroke a plotter can actually make).
export function stipple(density, rng, opts = {}) {
  const count = Math.max(20, Math.min(24000, opts.count || 3000));
  const relax = opts.relax == null ? 2 : opts.relax;
  const dotR = opts.dotR == null ? 0.0012 : opts.dotR;
  const pts = [];
  // Rejection sampling against the density field.
  let guard = count * 40;
  while (pts.length < count && guard-- > 0) {
    const x = rng(), y = rng();
    if (rng() < density(x, y)) pts.push([x, y]);
  }
  // Lloyd-ish relaxation on a grid: push each point away from its cell-mates. Cheaper than a
  // true Voronoi and enough to break the clumps rejection sampling leaves behind.
  const cells = Math.max(8, Math.round(Math.sqrt(pts.length / 2)));
  for (let it = 0; it < relax; it++) {
    const grid = new Map();
    for (const p of pts) {
      const k = Math.min(cells - 1, Math.floor(p[0] * cells)) + "," + Math.min(cells - 1, Math.floor(p[1] * cells));
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(p);
    }
    for (const group of grid.values()) {
      if (group.length < 2) continue;
      let cx = 0, cy = 0;
      for (const p of group) { cx += p[0]; cy += p[1]; }
      cx /= group.length; cy /= group.length;
      for (const p of group) {
        p[0] += (p[0] - cx) * 0.35;
        p[1] += (p[1] - cy) * 0.35;
        p[0] = Math.max(0, Math.min(1, p[0]));
        p[1] = Math.max(0, Math.min(1, p[1]));
      }
    }
  }
  // A dot the plotter can draw: a tiny cross-tick, not a zero-length move.
  return pts.map(([x, y]) => [[x - dotR, y], [x + dotR, y]]);
}

// ── hatch that follows the form ─────────────────────────────────────────────
// Copperplate engraving logic: the hatch direction is a function of position, so the strokes
// describe curvature instead of filling a region. `angleAt(x,y)` returns the local hatch
// direction; `densityAt(x,y)` in [0,1] decides whether a stroke is laid there at all, which is
// how tone appears without a single fill.
export function hatchFollows(angleAt, densityAt, rng, opts = {}) {
  const rows = Math.max(8, Math.min(400, opts.rows || 90));
  const step = opts.step == null ? 0.004 : opts.step;
  const maxLen = opts.maxLen == null ? 0.09 : opts.maxLen;
  const lines = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < rows; c++) {
      // Jittered lattice start, so the hatch is not a visible grid.
      const x0 = (c + 0.5 + (rng() - 0.5) * 0.8) / rows;
      const y0 = (r + 0.5 + (rng() - 0.5) * 0.8) / rows;
      const d = densityAt(x0, y0);
      if (d <= 0.02 || rng() > d) continue;
      // Walk the direction field for a stroke whose LENGTH also carries tone.
      const steps = Math.max(2, Math.round((0.25 + d * 0.75) * maxLen / step));
      const line = [[x0, y0]];
      let x = x0, y = y0;
      for (let s = 0; s < steps; s++) {
        const a = angleAt(x, y);
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
        if (x < 0 || y < 0 || x > 1 || y > 1) break;
        line.push([x, y]);
      }
      if (line.length > 1) lines.push(line);
    }
  }
  return lines;
}

// ── dashed register ─────────────────────────────────────────────────────────
// Support lines (graticules, section marks, annotation leaders) read as a different register
// when broken. Splitting in normalized space keeps dash length consistent across the sheet.
export function dashed(line, on = 0.006, off = 0.004) {
  const out = [];
  let run = [], acc = 0, drawing = true;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i];
    const seg = Math.hypot(bx - ax, by - ay);
    let t = 0;
    while (t < seg) {
      const want = (drawing ? on : off) - acc;
      const take = Math.min(want, seg - t);
      const t0 = (t + take) / seg;
      const px = ax + (bx - ax) * t0, py = ay + (by - ay) * t0;
      if (drawing) {
        if (!run.length) run.push([ax + (bx - ax) * (t / seg), ay + (by - ay) * (t / seg)]);
        run.push([px, py]);
      }
      acc += take; t += take;
      if (acc >= (drawing ? on : off) - 1e-9) {
        if (drawing && run.length > 1) out.push(run);
        run = []; acc = 0; drawing = !drawing;
      }
    }
  }
  if (run.length > 1) out.push(run);
  return out;
}

// ── spiral fill ─────────────────────────────────────────────────────────────
// One unbroken spiral whose radial step is modulated by a density function: the zero-pen-lift
// fill, and the structure behind the plotter community's dense circular pieces. Density
// tightens the winding rather than changing the ink, so tone stays a line-count phenomenon.
export function spiralFill(cx, cy, radius, densityAt, opts = {}) {
  const turns = Math.max(4, Math.min(400, opts.turns || 90));
  const stepsPerTurn = opts.stepsPerTurn || 160;
  const line = [];
  const total = turns * stepsPerTurn;
  for (let i = 0; i <= total; i++) {
    const t = i / total;
    const a = t * turns * 6.283185;
    const d = densityAt(cx + Math.cos(a) * radius * t, cy + Math.sin(a) * radius * t);
    // Density pulls the radius in slightly, so dense regions get more windings per unit area.
    const rr = radius * t * (1 - 0.06 * d);
    line.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return [line];
}

// Clip any polyline set to a rect, splitting runs that leave it. Shared by every study so the
// sheet's margin is one rule rather than per-study arithmetic.
//
// The crossing segment is INTERSECTED with the boundary, not dropped. Dropping the out-of-box
// vertex (the first version, and plot-maps' own clipToFrame) leaves every stroke ending wherever
// its last sample happened to fall, so the margin frays by up to one sample step and the frame
// stops reading as an edge. A plate's margin is a straight line or it is nothing.
const inside = (p, x0, y0, x1, y1) => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;

function boundaryHit(a, b, x0, y0, x1, y1) {
  // Liang-Barsky against the four edges: returns the parameter where segment a->b crosses.
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const tests = [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]];
  for (const [p, q] of tests) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
    else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [t0, t1];
}

export function clipLines(lines, x0, y0, x1, y1) {
  const out = [];
  for (const line of lines) {
    let run = null;
    for (let i = 0; i < line.length; i++) {
      const p = line[i];
      const pIn = inside(p, x0, y0, x1, y1);
      if (pIn) {
        if (!run) {
          // Entering: start the run AT the boundary crossing, not at the first inside sample.
          if (i > 0) {
            const hit = boundaryHit(line[i - 1], p, x0, y0, x1, y1);
            if (hit) {
              const [t0] = hit;
              run = [[line[i - 1][0] + (p[0] - line[i - 1][0]) * t0, line[i - 1][1] + (p[1] - line[i - 1][1]) * t0]];
            }
          }
          if (!run) run = [];
        }
        run.push(p);
      } else if (run) {
        // Leaving: end the run ON the boundary.
        const hit = boundaryHit(line[i - 1], p, x0, y0, x1, y1);
        if (hit) {
          const [, t1] = hit;
          run.push([line[i - 1][0] + (p[0] - line[i - 1][0]) * t1, line[i - 1][1] + (p[1] - line[i - 1][1]) * t1]);
        }
        if (run.length > 1) out.push(run);
        run = null;
      }
    }
    if (run && run.length > 1) out.push(run);
  }
  return out;
}
