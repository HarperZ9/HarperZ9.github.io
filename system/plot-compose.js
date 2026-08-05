// plot-compose.js: the sheet composes ITSELF.
//
// The operator's note: "the maps are not user generated; some self-generated materials is
// encouraged." The weak form of that is more sliders. The strong form, and the one built here,
// is a system that chooses its own composition and then JUDGES the result, re-rolling what it
// finds dull. Two mechanisms:
//
//   1. A composition grammar. A seed picks a study, a register (how the marks are made), a
//      furniture set (frame, graticule, cartouche, annotation), and a pass plan. The operator
//      never picks a layer stack; the sheet proposes one.
//
//   2. An interestingness metric with a re-roll policy. Kate Compton's "10,000 bowls of oatmeal"
//      problem is that a generator can produce endless output that is all perceptually the same.
//      The answer is not more randomness but a measure: a sheet must clear thresholds on ink
//      coverage, spatial spread, scale variety, and directional variety, or the composer discards
//      it and rolls the next candidate from the same seed lineage. What survives is not the first
//      thing generated - it is the first thing that passed.
//
// Everything is deterministic: the same seed produces the same candidate sequence and therefore
// the same accepted sheet, so a published sheet is still exactly re-checkable.

import { STUDY_BUILDERS } from "./plot-studies.js";
import { jitter, multiPass, dashed, clipLines } from "./plot-marks.js";

const M = 0.04;

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
const pick = (rng, arr) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

// ── the metric ──────────────────────────────────────────────────────────────
// Four measures, each catching a different way a sheet can be dull. Computed on the geometry, so
// no rasterisation and no canvas: the composer runs identically in node and in the browser.
//
//   coverage  what fraction of a 24x24 grid the ink visits. Too low is an empty sheet; too high
//             is a uniform mat with no figure.
//   spread    the standard deviation of per-cell ink, normalized. A sheet where every cell has
//             the same amount of line has no composition, only texture.
//   scale     the ratio of long strokes to short ones. One stroke length everywhere is a
//             machine signature; a drawn sheet has a range.
//   direction the entropy of stroke angles over 12 bins. All-parallel scores near zero.
export function measureSheet(layers) {
  const G = 24;
  const cells = new Float64Array(G * G);
  const lens = [], angBins = new Float64Array(12);
  let total = 0;
  for (const layer of layers) {
    for (const line of layer.polylines) {
      let L = 0;
      for (let i = 1; i < line.length; i++) {
        const [ax, ay] = line[i - 1], [bx, by] = line[i];
        const d = Math.hypot(bx - ax, by - ay);
        L += d; total += d;
        const gx = Math.max(0, Math.min(G - 1, Math.floor(ax * G)));
        const gy = Math.max(0, Math.min(G - 1, Math.floor(ay * G)));
        cells[gy * G + gx] += d;
        let a = Math.atan2(by - ay, bx - ax);
        if (a < 0) a += Math.PI;                      // direction, not orientation
        angBins[Math.min(11, Math.floor((a / Math.PI) * 12))] += d;
      }
      if (L > 0) lens.push(L);
    }
  }
  // Guard on INK, not stroke count. Guarding on stroke count scored `orbital` a flat zero: it is
  // one unbroken 26,000-point harmonograph trace plus a spiral, which is two strokes and a
  // perfectly good sheet. A metric that calls the plotter's most characteristic gesture (zero pen
  // lifts) degenerate is measuring the wrong thing.
  if (total < 0.5) return { coverage: 0, spread: 0, scale: 0, direction: 0, ink: 0, score: 0 };
  if (!lens.length) lens.push(total);
  let visited = 0, mean = 0;
  for (const c of cells) { if (c > total * 1e-4) visited++; mean += c; }
  mean /= cells.length;
  let variance = 0;
  for (const c of cells) variance += (c - mean) * (c - mean);
  const sd = Math.sqrt(variance / cells.length);
  lens.sort((a, b) => a - b);
  const p10 = lens[Math.floor(lens.length * 0.1)] || 1e-9;
  const p90 = lens[Math.floor(lens.length * 0.9)] || 1e-9;
  let H = 0;
  for (const b of angBins) { if (b <= 0) continue; const p = b / total; H -= p * Math.log(p); }
  const coverage = visited / cells.length;
  const spread = Math.min(1, sd / (mean || 1));
  const scale = Math.min(1, Math.log10(1 + p90 / p10) / 1.4);
  const direction = H / Math.log(12);
  // The score is the GEOMETRIC mean of the four, not a weighted sum. A sum lets a sheet coast on
  // three virtues while failing the fourth, which is exactly how a generator drifts into making
  // the same thing forever; the product makes every measure a veto. Calibrated against the real
  // distribution of the seven studies (measured 2026-08-04): bare sheets land 0.35 to 0.75, so a
  // 0.665 bar rejects roughly the weakest third rather than nothing at all.
  const score = Math.pow(
    Math.max(1e-6, coverage) * Math.max(1e-6, spread) * Math.max(1e-6, scale) * Math.max(1e-6, direction),
    0.25,
  );
  return {
    coverage: +coverage.toFixed(3), spread: +spread.toFixed(3), scale: +scale.toFixed(3),
    direction: +direction.toFixed(3), ink: +total.toFixed(2), score: +score.toFixed(3),
  };
}

// "Is this sheet dull?" is only answerable FOR ITS KIND. A global bar sounded rigorous and was
// wrong: it rejected hitomezashi sashiko (0.465) for having two directions, when two directions
// is what sashiko IS, and it rejected the outrun horizon for the same reason. A metric that
// refuses a whole legitimate register is measuring its own assumptions.
//
// So each study carries the p33 of its OWN measured distribution (16 seeds per study, measured
// 2026-08-04), and a candidate is dull when it falls below its study's floor. The gate still
// rejects the weakest third of every register; it just no longer demands that a textile behave
// like a river basin. Absolute refusals (empty sheet, uniform mat) stay global, because those
// are failures in any register.
export const STUDY_FLOORS = Object.freeze({
  basin: 0.680, moire: 0.775, lattice: 0.665, strata: 0.725, monolith: 0.585,
  nomogram: 0.670, orbital: 0.635, scanline: 0.575, horizon: 0.570, stitch: 0.465,
  // The illuminated-terrain shelf, measured 2026-08-04 by the same method: p33 of composeSheet
  // scores over 16 seeds per study. All three sit high because contour-following ink covers and
  // spreads well by construction; the floor still cuts each register's own weakest third.
  // tanaka re-measured 2026-08-04 after its duplicate band-boundary contours were removed (the
  // levels are now asked for explicitly, one trace each, instead of windowed onto five fixed ones).
  tanaka: 0.883, relief: 0.897, zigzag: 0.732,
});
export const DULL_SCORE = 0.60;   // fallback for a study with no measured floor yet

export function sheetIsDull(m, study) {
  if (m.coverage < 0.12 || m.coverage > 0.985 || m.spread < 0.16) return true;
  const floor = STUDY_FLOORS[study] == null ? DULL_SCORE : STUDY_FLOORS[study];
  return m.score < floor;
}

// ── furniture: the map's own apparatus ──────────────────────────────────────
function frame(rng, style) {
  const m = M, lines = [];
  const box = [[m, m], [1 - m, m], [1 - m, 1 - m], [m, 1 - m], [m, m]];
  lines.push(box);
  if (style === "double") lines.push(box.map(([x, y]) => [x + (x < 0.5 ? 0.008 : -0.008), y + (y < 0.5 ? 0.008 : -0.008)]));
  if (style === "ticked") {
    for (let i = 1; i < 20; i++) {
      const t = m + (i / 20) * (1 - 2 * m);
      lines.push([[t, m], [t, m + 0.012]], [[t, 1 - m], [t, 1 - m - 0.012]]);
      lines.push([[m, t], [m + 0.012, t]], [[1 - m, t], [1 - m - 0.012, t]]);
    }
  }
  return lines.map((l) => jitter(l, rng, { wander: 0.0006 }));
}

function graticule(rng) {
  const lines = [], n = 5 + Math.floor(rng() * 4);
  for (let i = 1; i < n; i++) {
    const t = M + (i / n) * (1 - 2 * M);
    lines.push(...dashed([[t, M], [t, 1 - M]], 0.004, 0.012));
    lines.push(...dashed([[M, t], [1 - M, t]], 0.004, 0.012));
  }
  return lines;
}

// A cartouche: an empty ruled panel in a corner. Deliberately unlettered — the sheet declares a
// place for its title without inventing one, which is honest and reads as a real plate.
function cartouche(rng) {
  const w = 0.2 + rng() * 0.1, h = 0.06 + rng() * 0.04;
  const corner = Math.floor(rng() * 4);
  const x = corner % 2 === 0 ? M + 0.02 : 1 - M - 0.02 - w;
  const y = corner < 2 ? M + 0.02 : 1 - M - 0.02 - h;
  const lines = [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
  const rules = 2 + Math.floor(rng() * 3);
  for (let i = 1; i <= rules; i++) {
    const ry = y + (i / (rules + 1)) * h;
    lines.push([[x + 0.012, ry], [x + w - 0.012 - rng() * w * 0.35, ry]]);
  }
  return lines.map((l) => jitter(l, rng, { wander: 0.0005 }));
}

export const REGISTERS = Object.freeze({
  clean:   { label: "Clean",    wander: 0.0004, passes: 1 },
  drawn:   { label: "Drawn",    wander: 0.0018, passes: 1 },
  worked:  { label: "Worked",   wander: 0.0016, passes: 3 },
  laboured:{ label: "Laboured", wander: 0.0022, passes: 6 },
});

// A sheet's honest ceiling. A plotter artist chooses passes by how long they will run the
// machine, not by a fixed number, so the register is budget-aware: six passes over a 16,000-
// stroke hatch is 92,000 strokes and a 17MB SVG, which is a day of plotting and an unusable
// download. The budget scales passes down on already-dense studies and leaves sparse ones free
// to take the full laboured treatment, which is exactly the tradeoff a person makes.
const STROKE_BUDGET = 26000;

// Apply a register to a study's ink layers: the multi-pass tonal engine the community uses.
// Exported because an image plot needs exactly the same hand: the mark register is a property of
// how the pen is driven, not of what is being drawn.
export function applyRegister(layers, rng, register) {
  const R = REGISTERS[register] || REGISTERS.drawn;
  let base = 0;
  for (const l of layers) base += l.polylines.length;
  const affordable = base > 0 ? Math.max(1, Math.floor(STROKE_BUDGET / base)) : R.passes;
  const passCap = Math.min(R.passes, affordable);
  return layers.map((layer) => {
    if (passCap <= 1 && R.wander <= 0.0005) return layer;
    const out = [];
    for (const line of layer.polylines) {
      // Support furniture stays lighter: a graticule drawn six times stops being support.
      const passes = layer.tone === "support" ? Math.min(2, passCap) : passCap;
      if (passes <= 1) out.push(jitter(line, rng, { wander: R.wander, tremor: R.wander * 0.3 }));
      else out.push(...multiPass(line, rng, passes, R.wander * 0.5));
    }
    return { ...layer, polylines: out };
  });
}

/**
 * composeSheet(seedStr, opts) → { layers, meta }
 * opts: { study: "auto"|<key>, register: "auto"|<key>, candidates, minScore }
 * The composer proposes a sheet, measures it, and re-rolls up to `candidates` times until one
 * clears the bar. meta records what it tried and why it settled, so the sheet can say honestly
 * how it came to be.
 */
export function composeSheet(seedStr, opts = {}) {
  const maxCandidates = Math.max(1, Math.min(12, opts.candidates || 6));
  const studyKeys = Object.keys(STUDY_BUILDERS);
  const registerKeys = Object.keys(REGISTERS);
  const attempts = [];
  let best = null;

  for (let attempt = 0; attempt < maxCandidates; attempt++) {
    // INDEPENDENT streams per decision, not one shared rng threaded through in sequence. With a
    // single stream, changing how many random draws a study happens to make would silently
    // change the furniture and register of every seed, because everything downstream shifts.
    // Each decision draws from its own named lineage, so a study can be edited freely and every
    // other seed keeps its sheet.
    const stream = (name) => mulberry(hash32(`${seedStr}#${attempt}#${name}`));
    const rPick = stream("pick"), rStudy = stream("study"), rReg = stream("register"), rFurn = stream("furniture");
    const study = opts.study && opts.study !== "auto" && STUDY_BUILDERS[opts.study]
      ? opts.study : pick(rPick, studyKeys);
    const register = opts.register && opts.register !== "auto" && REGISTERS[opts.register]
      ? opts.register : pick(rPick, registerKeys);
    const built = STUDY_BUILDERS[study].build(seedStr + "/" + attempt, rStudy, {});
    let layers = applyRegister(built.layers, rReg, register);

    // Furniture: the sheet decides its own apparatus.
    const furniture = [];
    const frameStyle = pick(rFurn, ["plain", "double", "ticked"]);
    if (rFurn() < 0.35) furniture.push({ name: "graticule", polylines: graticule(rFurn), weight: 0.3, tone: "support" });
    if (rFurn() < 0.5) furniture.push({ name: "cartouche", polylines: cartouche(rFurn), weight: 0.6, tone: "ink" });
    furniture.push({ name: "frame", polylines: frame(rFurn, frameStyle), weight: 1.5, tone: "ink" });
    layers = layers.concat(furniture);

    const m = measureSheet(layers);
    attempts.push({ study, register, score: m.score, dull: sheetIsDull(m, study) });
    const candidate = { layers, meta: { study, register, frame: frameStyle, measure: m, studyMeta: built.meta } };
    if (!best || m.score > best.meta.measure.score) best = candidate;
    const floor = opts.minScore == null ? (STUDY_FLOORS[study] == null ? DULL_SCORE : STUDY_FLOORS[study]) : opts.minScore;
    if (!sheetIsDull(m, study) && m.score >= floor) {
      return finish(candidate, seedStr, attempts, attempt + 1, true);
    }
  }
  // Nothing cleared the bar: ship the strongest candidate and SAY SO rather than pretending.
  return finish(best, seedStr, attempts, maxCandidates, false);
}

function finish(candidate, seedStr, attempts, tried, cleared) {
  let strokes = 0, points = 0;
  for (const l of candidate.layers) {
    strokes += l.polylines.length;
    for (const p of l.polylines) points += p.length;
  }
  return {
    layers: candidate.layers,
    meta: {
      ...candidate.meta,
      // The studies compose in the unit square and were tuned looking at a square stage, so the
      // sheet IS square. Before this was explicit, the SVG export inherited the cartographic
      // 0.75 paper and silently squashed every composed sheet by a quarter.
      kind: "field", aspect: 1,
      seed: String(seedStr), strokes, points,
      candidates: tried, cleared,
      rejected: attempts.slice(0, -1).map((a) => `${a.study}/${a.register} ${a.score}`),
    },
  };
}

export { STUDY_BUILDERS, clipLines };
