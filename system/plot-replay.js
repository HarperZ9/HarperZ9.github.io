// plot-replay.js: the sheet as a performance — the exact order a plotter would run it.
//
// plotter.js replayPlot was the first cut and it shows its limits: pixel-space polylines, one
// stroke style for the whole run, no pen model, and it owns the rAF loop and the canvas, so
// nothing else could reuse the order. This module is the replay done properly and PURELY: it
// flattens a sheet ({ layers, meta }, coordinates in [0,1]²) into the stream a plotter would
// actually execute — pen 0 first, layer order kept within a pen, every pass of a layer run back
// to back — and steps through it by INK LAID DOWN, not by stroke count. No DOM, no canvas, no
// rAF in here: the orchestrator wires those, and node tests every invariant.
//
// The pen model is plot-maps.js's own (penIndexFor / passesFor — the grouping plotMapSVG writes
// into data-pen / data-passes), imported rather than copied so the exported file and the screen
// playback can never disagree about which pen draws what.

import { penIndexFor, passesFor } from "./plot-maps.js";

// What the operator would call each pen at the machine. A pen change is a real plotter moment —
// the machine parks, the operator swaps the pen — so the UI gets names to announce it with.
export const PEN_NAMES = Object.freeze(["support pen", "drawing pen", "heavy pen"]);

/**
 * sheetStrokeStream(plot) → { entries, totals: { strokes, points, pens }, penBoundaries }
 * Flatten a sheet into plotter execution order: pens ascending (pen 0 first), layer order kept
 * within a pen, stroke order kept within a layer, and each layer's strokes repeated
 * passesFor(layer) times CONSECUTIVELY — pass 2 follows pass 1 immediately, because that is
 * where the operator runs it and where the ink builds. Each entry:
 *   { line, layerName, pen, passIndex, weight, tone }
 * penBoundaries[i] = { pen, index } — the index of the pen's first entry — so a UI can announce
 * "pen change: support pen -> drawing pen" at the right stroke. totals.strokes and totals.points
 * count REPEATS: a two-pass layer costs the machine double, and the replay budget should too.
 * One-point lines are dropped: a single point lays no ink and would only stall the budget.
 */
export function sheetStrokeStream(plot) {
  const layers = (plot && plot.layers) || [];
  const pens = [...new Set(layers.map(penIndexFor))].sort((a, b) => a - b);
  const entries = [];
  const penBoundaries = [];
  let points = 0;
  for (const pen of pens) {
    const first = entries.length;
    for (const layer of layers) {
      if (penIndexFor(layer) !== pen) continue;
      const lines = (layer.polylines || []).filter((l) => l && l.length > 1);
      const passes = passesFor(layer);
      for (let pass = 0; pass < passes; pass++) {
        for (const line of lines) {
          entries.push({ line, layerName: layer.name, pen, passIndex: pass, weight: layer.weight, tone: layer.tone });
          points += line.length;
        }
      }
    }
    // A pen that contributed nothing (every line degenerate) gets no boundary: announcing a pen
    // change and then drawing nothing with it would be a lie about the machine.
    if (entries.length > first) penBoundaries.push({ pen, index: first });
  }
  return { entries, totals: { strokes: entries.length, points, pens: penBoundaries.length }, penBoundaries };
}

/**
 * createReplay(plot, opts) → { step, seek, reset, stream, totals }
 * A stateful stepper over the stream. step(pointBudget) lays down up to pointBudget POINTS and
 * returns { batch, done, progress, penChanged }:
 *   batch      [{ line, from, to, pen, weight, tone }] — each item is a drawable slice: moveTo
 *              line[from], lineTo through line[to]. Consecutive slices of one stroke share their
 *              boundary point ON PURPOSE (next.from === prev.to): the pen re-touches the paper
 *              where it left off, so the orchestrator never has to remember mid-line state.
 *   progress   0..1 by points laid, integer-exact — a finished run reads 1.0, not 0.9998.
 *   penChanged null, or the pen this step begins with. A step NEVER crosses a pen boundary: the
 *              machine parks for the swap, so playback pauses there too, and a large budget can
 *              never swallow the announcement. Fires exactly (totals.pens - 1) times per run.
 * THE BUDGET IS INK, NOT STROKES. replayPlot's per-frame budget advanced stroke-by-stroke, which
 * let a sheet of short hatches sprint and would land a 20000-point harmonograph in one tick.
 * Slicing mid-line keeps playback uniform in ink laid down whatever the stroke lengths are.
 * seek(fraction) rebuilds state to that point-progress (a scrubber); reset() returns to the top.
 * opts: { pointsPerStep } — default budget when step() is called bare; { stream } — reuse a
 * stream the caller already built (for announcing boundaries without flattening twice).
 */
export function createReplay(plot, opts = {}) {
  const stream = opts.stream || sheetStrokeStream(plot);
  const { entries, totals } = stream;
  const defaultBudget = Math.max(1, Math.round(opts.pointsPerStep || 240));
  let ei = 0;          // entry index
  let pi = 0;          // next point to lay within the current entry
  let laid = 0;        // points laid so far, the progress numerator
  let currentPen = entries.length ? entries[0].pen : null;

  const step = (pointBudget) => {
    // Floor the budget at one point: a zero or negative budget inside a rAF loop would return
    // empty batches forever and the playback would look frozen with no error to find.
    let left = Math.max(1, Math.floor(pointBudget == null ? defaultBudget : pointBudget));
    const batch = [];
    let penChanged = null;
    while (left > 0 && ei < entries.length) {
      const entry = entries[ei];
      if (entry.pen !== currentPen) {
        if (batch.length) break;   // park at the boundary; the swap opens the NEXT step
        currentPen = entry.pen;
        penChanged = entry.pen;
      }
      const n = entry.line.length;
      const take = Math.min(n - pi, left);
      const from = pi === 0 ? 0 : pi - 1;   // re-touch the last laid point so the slice connects
      batch.push({ line: entry.line, from, to: pi + take - 1, pen: entry.pen, weight: entry.weight, tone: entry.tone });
      pi += take; left -= take; laid += take;
      if (pi >= n) { ei++; pi = 0; }
    }
    return {
      batch,
      done: ei >= entries.length,
      // An empty sheet is a finished sheet: progress 1, not 0/0.
      progress: totals.points ? laid / totals.points : 1,
      penChanged,
    };
  };

  const reset = () => { ei = 0; pi = 0; laid = 0; currentPen = entries.length ? entries[0].pen : null; };

  const seek = (fraction) => {
    // Rebuild forward from zero rather than diffing from the current position: O(entries) and it
    // cannot drift from what step() itself would have accumulated point by point.
    reset();
    const f = Math.max(0, Math.min(1, Number(fraction) || 0));
    let left = Math.floor(f * totals.points);
    laid = left;
    while (left > 0 && ei < entries.length) {
      const remaining = entries[ei].line.length - pi;
      currentPen = entries[ei].pen;
      if (left >= remaining) { left -= remaining; ei++; pi = 0; }
      else { pi += left; left = 0; }
    }
  };

  return { step, seek, reset, stream, totals };
}

// ── G-code: the stream as a machine program ─────────────────────────────────
/**
 * sheetGcode(plot, opts) → string. The same execution order the replay draws, emitted as
 * pen-plotter G-code: G21/G90, servo pen up/down (or Z moves via opts.mode "z"), and an M0
 * program pause at every pen change so the operator can swap pens at the machine — which is what
 * data-pen means physically. Sheet coordinates map to opts.widthMm × (widthMm · aspect) with the
 * Y axis flipped, because the sheet's y grows downward and a plotter's Y grows away from the
 * operator. Deterministic: same sheet, same bytes.
 */
export function sheetGcode(plot, opts = {}) {
  const widthMm = opts.widthMm || 210;
  const aspect = (plot && plot.meta && plot.meta.aspect) || 0.75;
  const heightMm = widthMm * aspect;
  const feed = Math.round(opts.feed || 2500);
  const zMode = opts.mode === "z";
  const up = zMode ? "G0 Z" + Number(opts.zUp == null ? 5 : opts.zUp).toFixed(3)
    : "M3 S" + Math.round(opts.penUp || 40);
  const down = zMode ? "G1 Z" + Number(opts.zDown == null ? 0 : opts.zDown).toFixed(3) + " F" + feed
    : "M3 S" + Math.round(opts.penDown || 90);
  const fx = (x) => (x * widthMm).toFixed(3);
  const fy = (y) => ((1 - y) * heightMm).toFixed(3);
  const { entries, totals } = sheetStrokeStream(plot);
  const meta = (plot && plot.meta) || {};
  const out = [
    "; telos plot sheet gcode",
    `; ${meta.study || meta.kind || "sheet"} - seed ${meta.seed == null ? "live" : meta.seed} - deterministic`,
    `; ${totals.strokes} strokes across ${totals.pens} pen${totals.pens === 1 ? "" : "s"}; sheet ${widthMm}mm x ${heightMm.toFixed(1)}mm (aspect ${aspect})`,
    "G21",
    "G90",
    up,
  ];
  let curPen = null;
  for (const e of entries) {
    if (e.pen !== curPen) {
      // The first pen is loaded before the program starts; every later change parks the machine.
      if (curPen != null) out.push(`M0 ; pen change - load ${PEN_NAMES[e.pen] || "pen " + e.pen}`);
      else out.push(`; ${PEN_NAMES[e.pen] || "pen " + e.pen}`);
      curPen = e.pen;
    }
    const line = e.line;
    out.push("G0 X" + fx(line[0][0]) + " Y" + fy(line[0][1]));
    out.push(down);
    out.push("G1 X" + fx(line[1][0]) + " Y" + fy(line[1][1]) + " F" + feed);
    for (let i = 2; i < line.length; i += 1) {
      out.push("G1 X" + fx(line[i][0]) + " Y" + fy(line[i][1]));
    }
    out.push(up);
  }
  if (!zMode) out.push("M5");
  out.push("G0 X0.000 Y0.000");
  return out.join("\n") + "\n";
}
