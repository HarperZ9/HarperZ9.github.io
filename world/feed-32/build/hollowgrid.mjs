// hollowgrid.mjs: a score drawn as a grid of struck cells that empty from the centre. The coupled decay (fill opacity
// falls while a ground-coloured hole grows from the cell centre, both on one ease-out curve) is the idea taken from the
// K4iTe1 clean-room spec (../K4ITE1-SPEC.md section 4.1). The mapping, the masks, the single state per cell, the clock
// and the drawing are our own (spec section 6, "change" and "add"). No code or asset of that program is used.
//
// SPEC
//   cellOf(note, cols, rows, map) -> cell index. map 'pitch': pitch class to column (mod cols), octave to row from the
//     bottom (mod rows); map 'order': a serpentine walk through the cells by MIDI note number. Deterministic.
//   cells(score, t, opts) -> [{ cell, age (s), vel 0..1, fade (s), voice }] for the cells alive at t. score is the
//     superframe events type. One state per cell: a later onset in the same cell replaces the earlier one.
//     opts.fade 0.2..6 s (default 2.5), opts.durScale 0..2 (default 0.6: longer notes fade slower,
//     fade = fade * (1 + durScale * min(dur, 2) / 2)), cols 2..24, rows 2..24 (default 5 x 5), map.
//   draw({ w, h, score, t, cols, rows, map, fade, mask 'square'|'circle'|'diamond', gap 0..0.4 of cell (default 0.11),
//          frame px (default 2 at 480 px of grid), ground, ink }) -> feed-29 raster, linear light.
//   describe(score, t, opts) -> plain text equivalent of the frame (for reduced motion and screen readers).
//   determinism : a pure function of (score, t); no clock, no randomness. Offline frame n is draw at t = n / fps.
import { raster, clamp } from '../../feed-29/build/lib/field.mjs';
import { hexLin } from '../../feed-29/build/lib/color.mjs';

export const easeOutQuad = u => 1 - (1 - u) * (1 - u);

export function cellOf(note, cols, rows, map = 'pitch') {
  if (map === 'order') { const k = ((note % (cols * rows)) + cols * rows) % (cols * rows), r = Math.floor(k / cols), c = k % cols; return (rows - 1 - r) * cols + (r % 2 ? cols - 1 - c : c); }
  const col = (((note % 12) % cols) + cols) % cols, row = rows - 1 - ((((Math.floor(note / 12) - 2) % rows) + rows) % rows);
  return row * cols + col;
}

export function cells(score, t, { cols = 5, rows = 5, map = 'pitch', fade = 2.5, durScale = 0.6 } = {}) {
  const last = new Map();
  for (const e of score.events) {
    if (e.t > t) continue;
    const c = cellOf(e.args?.note ?? 60, cols, rows, map), prev = last.get(c);
    if (!prev || e.t >= prev.t) last.set(c, e);
  }
  const out = [];
  for (const [cell, e] of last) {
    const f = fade * (1 + durScale * Math.min(e.args?.dur ?? 0, 2) / 2), age = t - e.t;
    if (age < f) out.push({ cell, age, vel: clamp(e.args?.vel ?? 1), fade: f, voice: e.voice });
  }
  return out.sort((a, b) => a.cell - b.cell);
}

// Signed distance (px, negative inside) to a centred shape of half-size s in a cell's local frame.
const shape = { square: (x, y, s) => Math.max(Math.abs(x), Math.abs(y)) - s, circle: (x, y, s) => Math.hypot(x, y) - s, diamond: (x, y, s) => (Math.abs(x) + Math.abs(y)) * Math.SQRT1_2 - s * Math.SQRT1_2 };
const cover = d => clamp(0.5 - d); // one-pixel analytic edge

export function draw({ w, h, score, t = 0, cols = 5, rows = 5, map = 'pitch', fade = 2.5, durScale = 0.6, mask = 'square', gap = 0.11, frame, ground = '#e9edf2', ink = '#1d2a44' } = {}) {
  const G = hexLin(ground), I = hexLin(ink), R = raster(w, h, G);
  const pitch = Math.min(w * 0.82 / cols, h * 0.82 / rows), cs = pitch * (1 - gap), half = cs / 2;
  const fw = frame ?? Math.max(1, (2 * cols * pitch) / 480), ox = (w - cols * pitch) / 2, oy = (h - rows * pitch) / 2;
  const live = new Map(cells(score, t, { cols, rows, map, fade, durScale }).map(c => [c.cell, c])), sd = shape[mask] ?? shape.square;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cx = ox + (c + 0.5) * pitch, cy = oy + (r + 0.5) * pitch, st = live.get(r * cols + c);
    const u = st ? easeOutQuad(clamp(st.age / st.fade)) : 1, fill = st ? (1 - u) * st.vel : 0, hole = u * half;
    for (let y = Math.max(0, Math.floor(cy - half - 2)); y < Math.min(h, Math.ceil(cy + half + 2)); y++)
      for (let x = Math.max(0, Math.floor(ox + c * pitch)); x < Math.min(w, Math.ceil(cx + half + 2)); x++) {
        const lx = x + 0.5 - cx, ly = y + 0.5 - cy, d = sd(lx, ly, half);
        const ring = cover(Math.abs(d + fw / 2) - fw / 2);            // the cell frame, always on
        const body = cover(d) * (1 - cover(sd(lx, ly, hole))) * fill;  // ink fill outside the growing hole
        const a = Math.max(ring, body);
        if (a > 0) for (let k = 0; k < 3; k++) R.px[3 * (y * w + x) + k] += (I[k] - R.px[3 * (y * w + x) + k]) * a;
      }
  }
  return R;
}

export function describe(score, t, opts = {}) {
  const { cols = 5, rows = 5 } = opts, live = cells(score, t, opts), n = score.events.filter(e => e.t <= t).length;
  return `${n} of ${score.events.length} notes played; ${live.length} of ${cols * rows} cells lit` + (live.length ? `: ${live.map(c => `row ${Math.floor(c.cell / cols) + 1} column ${(c.cell % cols) + 1}`).join(', ')}` : '');
}
