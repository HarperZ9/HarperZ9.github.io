// ans-voice.js: the picture as a score. The ANS synthesizer scanned drawn
// plates past a photocell bank (rows = frequencies, scan position = time,
// darkness = amplitude); the vOICe and Tembrica carry the same shape into
// software. This module is the pure half: sample a canvas into a scan grid,
// lay out row frequencies (exponential, or folded onto the minor pentatonic
// so the picture lands in the instrument's own scale), and turn a scan into
// MIDI events. The Web Audio bank itself lives with the audio engine.
// Units: grid is rows x cols, row 0 at the TOP of the image, luma 0..1.

export function scanImage(canvas, rows, cols) {
  const R = rows || 40, C = cols || 96;
  const g = document.createElement("canvas");
  g.width = C; g.height = R;
  const ctx = g.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, C, R);
  const px = ctx.getImageData(0, 0, C, R).data;
  const grid = new Float32Array(R * C);
  for (let i = 0; i < R * C; i++) {
    const o = i * 4;
    grid[i] = (px[o] * 0.299 + px[o + 1] * 0.587 + px[o + 2] * 0.114) / 255;
  }
  return { grid, rows: R, cols: C };
}

// Exponential (well-tempered) row layout, low notes at the image bottom.
// mode "penta" folds each row onto the nearest minor-pentatonic degree so
// any picture plays inside the scale the rest of the instrument speaks.
const PENTA = [0, 3, 5, 7, 10];
export function rowFrequencies(rows, opts = {}) {
  const lo = opts.loHz || 110, hi = opts.hiHz || 3520;
  const mode = opts.mode || "penta";
  const out = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    const frac = (rows - 1 - r) / Math.max(1, rows - 1);
    let f = lo * Math.pow(hi / lo, frac);
    if (mode === "penta") {
      const n = Math.round(69 + 12 * Math.log2(f / 440));
      const rel = ((n - (opts.rootMidi === undefined ? 45 : opts.rootMidi)) % 12 + 12) % 12;
      let best = PENTA[0], d = 12;
      for (const p of PENTA) { const dd = Math.min(Math.abs(rel - p), 12 - Math.abs(rel - p)); if (dd < d) { d = dd; best = p; } }
      const snapped = n - rel + best;
      f = 440 * Math.pow(2, (snapped - 69) / 12);
    }
    out[r] = f;
  }
  return out;
}

// Onsets by threshold crossing, durations by run length, velocity from mean
// brightness across the run: the standard musical image-to-MIDI mapping.
// Returns events in the midi-writer shape; caller supplies timing density.
export function scanToMIDI(scan, freqs, opts = {}) {
  const { grid, rows, cols } = scan;
  const TPQ = opts.ticksPerQuarter || 480;
  const colTicks = opts.ticksPerColumn || (TPQ / 4);
  const thresh = opts.threshold === undefined ? 0.22 : opts.threshold;
  const maxVoices = opts.maxNotesPerColumn || 6;
  // Notes first, events second: each note owns its off, so culling a note
  // can never orphan or steal another note's off (the pentatonic fold can
  // land two rows on the same pitch at the same column).
  const noteOf = (r) => Math.max(0, Math.min(127, Math.round(69 + 12 * Math.log2(freqs[r] / 440))));
  const notes = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (grid[r * cols + c] > thresh) {
        let run = c, sum = 0;
        while (run < cols && grid[r * cols + run] > thresh) { sum += grid[r * cols + run]; run++; }
        notes.push({ col: c, onTick: c * colTicks, offTick: run * colTicks, note: noteOf(r),
          vel: Math.max(20, Math.min(127, Math.round((sum / (run - c)) * 127))) });
        c = run;
      } else c++;
    }
  }
  // Polyphony cap per starting column, brightest first, so dense pictures
  // stay music instead of a cluster.
  const byCol = new Map();
  for (const n of notes) {
    if (!byCol.has(n.col)) byCol.set(n.col, []);
    byCol.get(n.col).push(n);
  }
  const events = [];
  for (const list of byCol.values()) {
    list.sort((a, b) => b.vel - a.vel);
    for (const n of list.slice(0, maxVoices)) {
      events.push({ tick: n.onTick, type: "on", ch: 0, a: n.note, b: n.vel });
      events.push({ tick: n.offTick, type: "off", ch: 0, a: n.note, b: 0 });
    }
  }
  return events;
}
