// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// meter.mjs: a geometric reading of meter. A bar is a polygon with one vertex per beat: a triangle for 3/4, a
// square for 4/4, a decagon for a decade of yearly data. The bar's time runs once round the perimeter, so a point
// moving at constant speed along the edges is the music's position in the bar, and every onset can be placed on
// the perimeter where it fell. Off-beat onsets land mid-edge; a syncopation is visible as a mark between vertices.
// Earlier bars stay as smaller, fainter polygons inside the current one, turned by a fixed step per bar.
//
//   barGeometry(grid, t, P) -> { m, bar, phase, beat, verts: [[x, y]], centre, radius, rings: [...], pos }
//   placeOnFigure(grid, tau, P) -> [x, y] in shares of the frame, for an event at time tau
//   figureVector(grid, t, w, h, P) -> superframe vector { w, h, paths } with stroke alpha in `alpha`
// grid: { beats, downbeats, beatsPerBar, onsets: [{ t, vel }], accents: [per beat 0..1] }
// P: { cx, cy, r (share of height), aspect, rotate (rad), history (bars kept), shrink (per bar), turn (rad per bar) }

export const FIGURE = Object.freeze({ cx: 0.585, cy: 0.47, r: 0.27, history: 3, shrink: 0.8, turn: 0.21, aspect: 16 / 9, onsetWindow: 1 });

function locate(list, t) { let lo = 0, hi = list.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (list[m] <= t) { k = m; lo = m + 1; } else hi = m - 1; } return k; }
const med = a => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0.5; };

// The bar that contains t: its index, start and end, and the beats inside it. Before the first downbeat the bar
// grid is extended backwards by the median bar length so the figure exists from the first frame.
export function barAt(grid, t) {
  const D = grid.downbeats, m = grid.beatsPerBar;
  if (!D?.length) return { bar: 0, t0: 0, t1: 4 * m * 0.5, beats: Array.from({ length: m }, (_, i) => i * 0.5) };
  const L = D.length > 1 ? med(D.slice(1).map((d, i) => d - D[i])) : m * 0.5;
  let k = locate(D, t), t0, t1;
  if (k < 0) { const back = Math.ceil((D[0] - t) / L); k = -back; t0 = D[0] - back * L; t1 = t0 + L; }
  else if (k >= D.length - 1) { const e = Math.floor((t - D[D.length - 1]) / L); t0 = D[D.length - 1] + e * L; t1 = t0 + L; k += e; }
  else { t0 = D[k]; t1 = D[k + 1]; }
  const inside = grid.beats.filter(b => b >= t0 - 1e-6 && b < t1 - 1e-6);
  const beats = inside.length === m ? inside : Array.from({ length: m }, (_, i) => t0 + (t1 - t0) * i / m);
  return { bar: k, t0, t1, beats };
}

// Perimeter position (0..1 round the polygon) of time tau inside its bar: piecewise linear through the beats, so
// each beat lands exactly on its vertex and the time between beats spreads evenly along the edge.
export function perimeterPhase(b, tau, m) {
  const B = [...b.beats, b.t1];
  for (let i = 0; i < m; i++) if (tau < B[i + 1]) return (i + Math.max(0, Math.min(1, (tau - B[i]) / Math.max(1e-6, B[i + 1] - B[i])))) / m;
  return 1;
}

export function polygon(m, cx, cy, r, rot, aspect) {
  return Array.from({ length: m }, (_, i) => { const a = rot - Math.PI / 2 + 2 * Math.PI * i / m; return [cx + r * Math.cos(a) / aspect, cy + r * Math.sin(a)]; });
}
export function pointOn(verts, u) {
  const m = verts.length, s = ((u % 1) + 1) % 1 * m, i = Math.floor(s), f = s - i, a = verts[i % m], b = verts[(i + 1) % m];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

export function barGeometry(grid, t, P = FIGURE) {
  const p = { ...FIGURE, ...P }, m = grid.beatsPerBar, b = barAt(grid, t);
  const rot = (p.rotate ?? 0) + p.turn * b.bar;
  const verts = polygon(m, p.cx, p.cy, p.r, rot, p.aspect);
  const phase = perimeterPhase(b, t, m), beat = Math.min(m - 1, Math.floor(phase * m));
  const history = [];
  for (let k = 1; k <= p.history; k++) {
    const s = p.shrink ** k, br = b.bar - k;
    history.push({ verts: polygon(m, p.cx, p.cy, p.r * s, (p.rotate ?? 0) + p.turn * br, p.aspect), alpha: 0.55 ** k, bar: br });
  }
  const onsets = (grid.onsets ?? []).filter(o => o.t >= b.t0 && o.t <= t).map(o => ({ ...o, u: perimeterPhase(b, o.t, m) }));
  const accents = b.beats.map(bt => { const i = grid.beats.indexOf(bt); return i >= 0 && grid.accents ? grid.accents[i] : 0.5; });
  return { m, bar: b.bar, t0: b.t0, t1: b.t1, beats: b.beats, phase, beat, verts, history, onsets, accents, centre: [p.cx, p.cy], radius: p.r, pos: pointOn(verts, phase), aspect: p.aspect };
}

export function placeOnFigure(grid, tau, P = FIGURE) {
  const g = barGeometry(grid, tau, P);
  return pointOn(g.verts, g.phase);
}

export function figureVector(grid, t, w, h, P = FIGURE) {
  const g = barGeometry(grid, t, P), X = ([x, y]) => [x * w, y * h], paths = [];
  paths.push({ pts: g.verts.map(X), closed: true, width: 1.25, alpha: 0.8, role: 'bar' });
  for (const hh of g.history) paths.push({ pts: hh.verts.map(X), closed: true, width: 1, alpha: 0.8 * hh.alpha, role: 'past' });
  // the path travelled so far this bar, a little brighter than the outline
  const done = [g.verts[0]]; for (let i = 1; i <= g.beat; i++) done.push(g.verts[i]); done.push(g.pos);
  paths.push({ pts: done.map(X), closed: false, width: 1.6, alpha: 1, role: 'travelled' });
  return { w, h, paths, geometry: g };
}
