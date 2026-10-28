// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// grid.mjs: the struck grid. A score (MIDI notes) plays on a grid of framed cells. A struck cell fills with ink and
// then empties from its centre: over its fade time the fill's opacity falls and a mask of ground colour grows from
// the middle, both on one ease-out quad curve, so mid-fade the cell is a ring of ink round an empty core.
// Technique after the clean-room spec of the K4iTe1 Visualizer (INBOX-K4ITE1-SPEC.md, sections 4.1 and 6); the
// code here is our own, and these parts are our changes to it:
//   deterministic mapping  'pitch': pitch class to column, octave to row (high at the top)
//                          'rank':  the score's distinct pitches in rising order, spread evenly over the cells in
//                                   reading order (a drum map lands each instrument on its own pad)
//                          'seeded': a seeded hash of the note's index; chance on purpose, never Math.random
//   velocity               sets the fill's starting opacity
//   duration               scales the fade, by sqrt(dur / median dur) clamped to [0.5, 2]
//   track                  picks the mask shape (square, circle, diamond, node line), unless one mask is fixed
//   one state per cell     the state at t is the last strike at or before t; a retrigger restarts it, and there
//                          is nothing else to compete with it
//   closed form            stateAt(prep, t) needs no history, so an offline frame and a live frame at the same t
//                          are the same picture, and a frame lights on the first frame time at or after the note
//
//   prepareScore(notes, P) -> prep        notes: [{ t, dur, pitch, vel, track }]
//   stateAt(prep, t) -> [{ cell, e, opacity, mask, vel }] for every cell (e = eased progress, 1 when empty)
//   gridLayout(w, h, P) -> { x0, y0, cell, pitch, cols, rows }    drawGrid(ink, prep, t, w, h, P) into a coverage plane
//   maskCoverage(shape, u, v, e, px) -> 0..1 of the ground mask at cell coordinates u, v in [-0.5, 0.5]
//   composeTwoInk(plane, groundHex, inkHex) -> raster (linear light): the two-ink picture

import { hexLin } from '../../glass/lib/raster.js';

export const GRID = Object.freeze({ cols: 5, rows: 5, fade: 2.5, mapping: 'pitch', mask: 'track', masks: ['square', 'circle', 'diamond', 'node'], seed: 1,
  velocity: true, durScale: true, region: [0.5, 0.5, 0.62], gap: 0.125, frame: 2, gutter: 0.05 });

const easeOutQuad = u => 1 - (1 - u) * (1 - u);
function hash(i, s) { let h = Math.imul(i + 1, 2654435761) ^ Math.imul(s + 7, 1597334677); h = Math.imul(h ^ (h >>> 15), 2246822519); return (h ^ (h >>> 13)) >>> 0; }
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 1; };

export function cellOf(note, i, ctx, P) {
  const n = P.cols * P.rows;
  if (P.mapping === 'seeded') return hash(i, P.seed) % n;
  if (P.mapping === 'rank') { const r = ctx.rank.get(note.pitch), d = ctx.rank.size; return d <= 1 ? 0 : Math.round(r * (n - 1) / (d - 1)); }
  const pc = ((note.pitch % 12) + 12) % 12, col = Math.min(P.cols - 1, Math.floor(pc * P.cols / 12));
  const oct = Math.floor(note.pitch / 12) - ctx.octLo, row = P.rows - 1 - Math.max(0, Math.min(P.rows - 1, oct));
  return row * P.cols + col;
}

export function prepareScore(notes, P = {}) {
  const p = { ...GRID, ...P }, sorted = [...notes].sort((a, b) => a.t - b.t);
  const pitches = [...new Set(sorted.map(n => n.pitch))].sort((a, b) => a - b);
  const ctx = { rank: new Map(pitches.map((q, i) => [q, i])), octLo: Math.floor(Math.min(...pitches, 127) / 12) };
  const tracks = [...new Set(sorted.map(n => n.track ?? 0))].sort((a, b) => a - b), md = med(sorted.map(n => n.dur ?? 0.25).filter(d => d > 0));
  const strikes = Array.from({ length: p.cols * p.rows }, () => []);
  sorted.forEach((n, i) => {
    const cell = cellOf(n, i, ctx, p), k = p.durScale ? Math.min(2, Math.max(0.5, Math.sqrt(Math.max(1e-3, n.dur ?? md) / md))) : 1;
    const shape = p.mask === 'track' ? p.masks[tracks.indexOf(n.track ?? 0) % p.masks.length] : p.mask;
    strikes[cell].push({ t: n.t, fade: p.fade * k, vel: p.velocity ? n.vel ?? 0.8 : 1, mask: shape, pitch: n.pitch, track: n.track ?? 0 });
  });
  return { p, strikes, notes: sorted, pitches, tracks };
}

function lastAtOrBefore(list, t) { let lo = 0, hi = list.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (list[m].t <= t) { k = m; lo = m + 1; } else hi = m - 1; } return k; }

export function stateAt(prep, t) {
  return prep.strikes.map((list, cell) => {
    const k = lastAtOrBefore(list, t);
    if (k < 0) return { cell, e: 1, opacity: 0, mask: null, vel: 0, age: Infinity };
    const s = list[k], u = Math.min(1, (t - s.t) / s.fade), e = easeOutQuad(u);
    return { cell, e, opacity: s.vel * (1 - e), mask: s.mask, vel: s.vel, age: t - s.t, pitch: s.pitch, track: s.track };
  });
}

// Signed distances in cell units for each mask shape, and each shape's largest distance inside the cell, so the
// mask covers the cell exactly when e reaches 1.
const SHAPES = {
  square: (u, v) => Math.max(Math.abs(u), Math.abs(v)),
  circle: (u, v) => Math.hypot(u, v),
  diamond: (u, v) => Math.abs(u) + Math.abs(v),
  // a Chladni node line of a square plate, modes (3, 1): the mask grows outward from where the plate stays still
  node: (u, v) => {
    const a = (u + 0.5) * Math.PI, b = (v + 0.5) * Math.PI, f = Math.cos(3 * a) * Math.cos(b) - Math.cos(a) * Math.cos(3 * b);
    const fx = -3 * Math.sin(3 * a) * Math.cos(b) + Math.sin(a) * Math.cos(3 * b), fy = -Math.cos(3 * a) * Math.sin(b) + 3 * Math.cos(a) * Math.sin(3 * b);
    return Math.abs(f) / Math.max(0.5, Math.hypot(fx, fy) * Math.PI);
  },
};
// The mask grows by area: at eased progress e it covers the share e of the cell, for every shape. Each shape's
// distances over the cell are sorted once, and the mask's reach at e is their e-quantile. (Growing the reach linearly
// to the largest distance left the node line's last few tips as isolated specks late in the fade; by area, what is
// left at e is always the share 1 - e, in a few solid pieces.)
const QUANT = Object.fromEntries(Object.entries(SHAPES).map(([k, f]) => { const a = []; for (let j = 0; j < 128; j++) for (let i = 0; i < 128; i++) a.push(f((i + 0.5) / 128 - 0.5, (j + 0.5) / 128 - 0.5)); a.sort((x, y) => x - y); return [k, Float32Array.from(a)]; }));
export const MASKS = Object.keys(SHAPES);
const reach = (shape, e) => { const q = QUANT[shape], x = e * (q.length - 1), i = Math.floor(x); return i >= q.length - 1 ? q[q.length - 1] : q[i] + (q[i + 1] - q[i]) * (x - i); };

// px: one device pixel in cell units, for a one-pixel anti-aliased edge
export function maskCoverage(shape, u, v, e, px) {
  if (!shape || e <= 0) return 0; if (e >= 1) return 1;
  const r = reach(shape, e), d = SHAPES[shape](u, v);
  return Math.max(0, Math.min(1, (r - d) / px + 0.5));
}

export function gridLayout(w, h, P = {}) {
  const p = { ...GRID, ...P }, [cx, cy, hs] = p.region, avail = hs * h, pitch = Math.min(avail / p.rows, (0.9 * w) / p.cols);
  const cell = pitch * (1 - p.gap), x0 = cx * w - (p.cols * pitch - (pitch - cell)) / 2, y0 = cy * h - (p.rows * pitch - (pitch - cell)) / 2;
  return { x0, y0, cell, pitch, cols: p.cols, rows: p.rows };
}

// Frames (always visible) and fills into one coverage plane. gutterPx(L, P) is the bare ring between frame and fill. Edges are anti-aliased by distance; the frame is
// `frame` px at 1080 lines, never thinner than one device pixel (R3b).
export const gutterPx = (L, P = {}) => Math.max(1, Math.round((P.gutter ?? GRID.gutter) * L.cell));

export function drawGrid(ink, prep, t, w, h, P = {}) {
  const p = { ...prep.p, ...P }, L = gridLayout(w, h, p), S = stateAt(prep, t), fw = Math.max(1, p.frame * h / 1080), data = ink.data;
  const gut = gutterPx(L, p);
  for (const st of S) {
    const c = st.cell % L.cols, r = Math.floor(st.cell / L.cols), x0 = L.x0 + c * L.pitch, y0 = L.y0 + r * L.pitch, s = L.cell, px = 1 / s;
    for (let y = Math.max(0, Math.floor(y0 - 1)); y <= Math.min(h - 1, Math.ceil(y0 + s + 1)); y++) for (let x = Math.max(0, Math.floor(x0 - 1)); x <= Math.min(w - 1, Math.ceil(x0 + s + 1)); x++) {
      const qx = x + 0.5 - x0, qy = y + 0.5 - y0;
      // frame: distance to the square's outline, inside the cell, fw wide
      const inside = Math.min(qx, qy, s - qx, s - qy), frame = Math.max(0, Math.min(1, inside + 0.5)) * Math.max(0, Math.min(1, fw - inside + 0.5));
      // the fill is an inset square with a ring of bare ground between it and the frame, so the last of a decaying
      // fill never touches the frame and cannot read as a mark on it
      let fill = 0;
      const g = fw + gut, fs = s - 2 * g;
      if (st.opacity > 0 && fs > 1) {
        const fin = Math.min(qx - g, qy - g, s - g - qx, s - g - qy), edge = Math.max(0, Math.min(1, fin + 0.5));
        if (edge > 0) fill = st.opacity * edge * (1 - maskCoverage(st.mask, (qx - g) / fs - 0.5, (qy - g) / fs - 0.5, st.e, 1 / fs));
      }
      const v = Math.max(frame, fill), i = y * w + x; if (v > data[i]) data[i] = v;
    }
  }
  return { layout: L, state: S };
}

// Two inks: every pixel is a mix of ground and ink by its coverage, in linear light.
export function composeTwoInk(ink, groundHex, inkHex) {
  const g = hexLin(groundHex), k = hexLin(inkHex), { w, h, data } = ink, R = { w, h, data: new Float32Array(w * h * 4) };
  for (let i = 0; i < w * h; i++) { const a = Math.min(1, data[i]); for (let c = 0; c < 3; c++) R.data[i * 4 + c] = g[c] + (k[c] - g[c]) * a; R.data[i * 4 + 3] = 1; }
  return R;
}

