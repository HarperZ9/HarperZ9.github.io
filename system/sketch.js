// sketch.js: the freehand source — the studio gets a HAND.
//
// Every other source generates; this one listens. The orchestrator feeds pointer positions in
// normalized sheet coordinates and this module does the geometry: resampling so pointer chatter
// does not read as intent, live symmetry so one gesture becomes an ornament, and a deterministic
// path to the shared sheet shape so a drawing restored from the shelf is the same drawing.
//
// The play mechanic is the kaleidoscope. A stroke stores its RAW points exactly once and the
// symmetry is applied at expansion time, so sliding k AFTER drawing re-expands everything
// already on the sheet: draw one line, then watch it become a twelve-fold rosette. Kaleido is
// the classic mirror-in-each-sector instrument (the dihedral group: k rotations of the stroke
// plus k rotations of its mirror), radial is rotation only, mirror is the single vertical fold.
//
// Pure geometry, no DOM. The pointer wiring, canvas painting, and UI live with the orchestrator;
// everything here runs identically in node, which is where the tests live.

import { jitter, multiPass, dashed, clipLines } from "./plot-marks.js";
import { REGISTERS } from "./plot-compose.js";

const TAU = 6.283185307;
const M = 0.04;   // sheet margin, shared with every other sheet source

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

const clamp01 = (v) => Math.max(0, Math.min(1, v));
// Quantize at CAPTURE, not at serialize. 1e-4 of a sheet is ~0.02mm on A4 — below any pointer's
// real precision — and storing already-quantized points makes the shelf round-trip lossless by
// construction, so geometryHash cannot drift between a live sketch and its restored twin.
const q4 = (v) => Number(v.toFixed(4));

const SYM_MODES = ["none", "mirror", "radial", "kaleido"];
const GUIDE_KINDS = ["none", "iso", "grid", "zigzag"];
const COLLAPSE = 0.002;   // points closer than this are the event stream, not the hand

const clip = (lines) => clipLines(lines, M, M, 1 - M, 1 - M);

// ── capture: from pointer chatter to a stroke ────────────────────────────────
// Two-step resample. First collapse: pointer events arrive far faster than a hand moves, so a
// slow passage delivers dozens of samples inside one pen width — pure event-rate texture, not
// drawing. Then one moving-average pass (window 3) over what survives, which takes the corners
// off high-frequency wobble without straightening a deliberate curve. Endpoints are pinned: a
// smoothed endpoint pulls the stroke off the touch point and reads as lag, not as smoothing.
function resample(raw) {
  const kept = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const [ax, ay] = kept[kept.length - 1], [bx, by] = raw[i];
    if (Math.hypot(bx - ax, by - ay) >= COLLAPSE) kept.push(raw[i]);
  }
  if (kept.length < 2) return null;   // a tap is not a stroke
  const out = [kept[0]];
  for (let i = 1; i < kept.length - 1; i++) {
    out.push([
      (kept[i - 1][0] + kept[i][0] + kept[i + 1][0]) / 3,
      (kept[i - 1][1] + kept[i][1] + kept[i + 1][1]) / 3,
    ]);
  }
  out.push(kept[kept.length - 1]);
  return out.map(([x, y]) => [q4(x), q4(y)]);
}

// ── guides: the drawing aids, not the drawing ────────────────────────────────
// Support-register underlays to draw AGAINST: a square graticule, the 30-degree isometric grid
// (verticals plus two diagonal families), and the op-art zigzag repeat from the corpus. All
// dashed so they read as aid rather than ink, all clipped to the margin. Deterministic — no rng
// — so guides never disturb sheet determinism.
function buildGuides(kind) {
  if (kind === "none" || !GUIDE_KINDS.includes(kind)) return [];
  const raw = [];
  if (kind === "grid") {
    const n = 12;
    for (let i = 1; i < n; i++) {
      const t = M + (i / n) * (1 - 2 * M);
      raw.push([[t, 0], [t, 1]], [[0, t], [1, t]]);
    }
  } else if (kind === "iso") {
    const s = 0.07, slope = Math.tan(Math.PI / 6);
    for (let x = s; x < 1; x += s) raw.push([[x, 0], [x, 1]]);
    // Perpendicular spacing must match the verticals: parallel lines offset db in y sit
    // db*cos(30°) apart, so db = s / cos(30°) keeps all three families evenly woven.
    const db = s / Math.cos(Math.PI / 6);
    for (let b = -slope; b < 1 + slope; b += db) {
      raw.push([[0, b], [1, b + slope]]);
      raw.push([[0, b + slope], [1, b]]);
    }
  } else if (kind === "zigzag") {
    // Sharp triangle waves built from their vertices, rows nearly touching: the high-contrast
    // repeat IS the reference, so the amplitude runs close to half the row spacing.
    const ry = 0.065, amp = 0.03, half = 0.045;
    for (let y0 = ry; y0 < 1; y0 += ry) {
      const line = [];
      for (let j = 0; j * half <= 1 + half; j++) line.push([j * half, y0 + (j % 2 ? amp : -amp)]);
      raw.push(line);
    }
  }
  const broken = [];
  for (const l of raw) broken.push(...dashed(l, 0.004, 0.01));
  return [{ name: "guide-" + kind, polylines: clip(broken), weight: 0.3, tone: "support" }];
}

/**
 * createSketch(opts) → the freehand sketch source.
 * opts: { symmetry: "none"|"mirror"|"radial"|"kaleido", k: 2..12, guide: "none"|"iso"|"grid"|"zigzag" }
 */
export function createSketch(opts = {}) {
  const strokes = [];               // committed raw strokes, each an array of [x,y]
  let active = null;                // the in-flight stroke, pre-resample
  const sym = { mode: "none", k: 6 };
  let guide = "none";

  function beginStroke(x, y) {
    // A lost pointerup (drag off-window, tab switch) must not weld two gestures into one
    // stroke, so a begin while a stroke is open commits the open one first.
    if (active) endStroke();
    active = [[clamp01(x), clamp01(y)]];
  }
  function extendStroke(x, y) {
    if (!active) return;            // a move with no begin is hover, not drawing
    active.push([clamp01(x), clamp01(y)]);
  }
  function endStroke() {
    if (!active) return null;
    const pts = resample(active);
    active = null;
    if (!pts) return null;
    strokes.push(pts);
    return pts;
  }

  function setSymmetry(mode, k) {
    if (!SYM_MODES.includes(mode)) return false;   // refuse rather than guess a mode
    sym.mode = mode;
    if (mode === "radial" || mode === "kaleido") {
      sym.k = Math.max(2, Math.min(12, Math.round(k == null ? sym.k : k)));
    }
    return true;
  }
  const getSymmetry = () => ({ mode: sym.mode, k: sym.k });

  // Expansion is where the symmetry lives — never in the stored points. Order is fixed
  // (per sector: rotation, then mirrored rotation) so the sheet serialization is stable.
  function expandStroke(points) {
    const mirrorPt = ([x, y]) => [1 - x, y];
    if (sym.mode === "mirror") return [points.map((p) => [...p]), points.map(mirrorPt)];
    if (sym.mode === "radial" || sym.mode === "kaleido") {
      const out = [];
      for (let i = 0; i < sym.k; i++) {
        const a = (i / sym.k) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const rot = ([x, y]) => [0.5 + (x - 0.5) * ca - (y - 0.5) * sa, 0.5 + (x - 0.5) * sa + (y - 0.5) * ca];
        out.push(points.map(rot));
        if (sym.mode === "kaleido") out.push(points.map(mirrorPt).map(rot));
      }
      return out;
    }
    return [points.map((p) => [...p])];
  }
  // The live-canvas call: everything on the sheet, expanded under the CURRENT symmetry. This is
  // what makes sliding k a toy — one call repaints the whole drawing in its new geometry.
  function expandAll() {
    const out = [];
    for (const s of strokes) out.push(...expandStroke(s));
    return out;
  }

  const undo = () => strokes.pop() != null;
  function clear() { strokes.length = 0; active = null; }
  const strokeCount = () => strokes.length;
  const isEmpty = () => strokes.length === 0;

  function setGuide(kind) {
    if (!GUIDE_KINDS.includes(kind)) return false;
    guide = kind;
    return true;
  }
  const getGuide = () => guide;
  const guideLayers = (kind = guide) => buildGuides(kind);

  // The receipt that two sketches are the same DRAWING. Hashed over raw points only — symmetry
  // and guides are views of the drawing, not the drawing — at 3 decimals, one notch coarser than
  // the 4-decimal storage, so the stored precision can never sit on the hash's rounding edge.
  function geometryHash() {
    const parts = [];
    for (const s of strokes) parts.push(s.map(([x, y]) => x.toFixed(3) + "," + y.toFixed(3)).join(";"));
    return hash32(parts.join("|")).toString(16).padStart(8, "0");
  }

  /**
   * toSheet({ register, includeGuides }) → { layers, meta } in the shared plot shape.
   * The register is applied by hand here rather than through applyRegister: the composer's
   * stroke budget and support-tone rules are for its own furniture stacks, and a sketch needs a
   * per-stroke rng lineage instead — stroke i always draws from mulberry(hash32("sketch#i")), so
   * the SAME sketch always serializes to the SAME sheet. Restore-from-shelf depends on this.
   */
  function toSheet(sheetOpts = {}) {
    const register = REGISTERS[sheetOpts.register] ? sheetOpts.register : "drawn";
    const R = REGISTERS[register];
    const layers = [];
    if (sheetOpts.includeGuides) layers.push(...buildGuides(guide));
    const inked = [];
    for (let si = 0; si < strokes.length; si++) {
      const rng = mulberry(hash32("sketch#" + si));
      for (const copy of expandStroke(strokes[si])) {
        if (R.passes <= 1) inked.push(jitter(copy, rng, { wander: R.wander, tremor: R.wander * 0.3 }));
        else inked.push(...multiPass(copy, rng, R.passes, R.wander * 0.5));
      }
    }
    if (inked.length) layers.push({ name: "hand", polylines: clip(inked), weight: 0.8, tone: "ink" });
    // The standard frame, seeded on its own fixed lineage. Drawn unclipped like the composer's:
    // clipping a frame to its own margin eats half its jitter and reads as a torn edge.
    const frameRng = mulberry(hash32("sketch#frame"));
    const box = [[M, M], [1 - M, M], [1 - M, 1 - M], [M, 1 - M], [M, M]];
    layers.push({ name: "frame", polylines: [jitter(box, frameRng, { wander: 0.0006 })], weight: 1.5, tone: "ink" });
    // strokes/points count the DRAWING, not the furniture or the symmetry copies: the meta is a
    // receipt for what the hand did, and an empty sketch honestly reports zero.
    let points = 0;
    for (const s of strokes) points += s.length;
    return {
      layers,
      meta: {
        kind: "sketch", aspect: 1,   // drawn on a square stage, so the sheet IS square
        register, strokes: strokes.length, points,
        symmetry: { mode: sym.mode, k: sym.k },
        geometryHash: geometryHash(),
      },
    };
  }

  // ── the shelf ──────────────────────────────────────────────────────────────
  function serialize() {
    return {
      v: 1,
      strokes: strokes.map((s) => s.map(([x, y]) => [q4(x), q4(y)])),
      symmetry: { mode: sym.mode, k: sym.k },
      guide,
    };
  }
  // Refuses rather than guesses: an unknown version or a malformed point returns false and
  // leaves the sketch untouched. Half a drawing restored silently would LOOK like the shelf
  // working while quietly losing strokes — a refusal the operator can see beats that.
  function restore(data) {
    if (!data || data.v !== 1 || !Array.isArray(data.strokes)) return false;
    const next = [];
    for (const s of data.strokes) {
      if (!Array.isArray(s) || s.length < 2) return false;
      const pts = [];
      for (const p of s) {
        if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return false;
        pts.push([q4(clamp01(p[0])), q4(clamp01(p[1]))]);
      }
      next.push(pts);
    }
    strokes.length = 0;
    strokes.push(...next);
    active = null;
    if (data.symmetry) setSymmetry(data.symmetry.mode, data.symmetry.k);
    if (data.guide) setGuide(data.guide);
    return true;
  }

  if (opts.symmetry) setSymmetry(opts.symmetry, opts.k);
  if (opts.guide) setGuide(opts.guide);

  return {
    beginStroke, extendStroke, endStroke,
    setSymmetry, getSymmetry, expandStroke, expandAll,
    setGuide, getGuide, guideLayers,
    undo, clear, strokeCount, isEmpty,
    toSheet, serialize, restore, geometryHash,
  };
}
