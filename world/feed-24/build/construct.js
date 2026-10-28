// construct.js: an annotated construction plate (family U, feed set 24). A figure built from square
// cells sits inside a golden-rectangle construction; tracked points on the figure carry live
// coordinate labels on leader lines; a bright head runs the spiral inward. The figure is any mask,
// so a word becomes letters made of the cells, each cell a measured value.
// scene() is pure data; render() draws everything but text into a raster.js surface; the page sets
// the labels in Conso on an overlay. Pure; runs in node and the browser.
import { goldenRect, spiralAt, cometU, nodes } from './golden.js';
import { rng, line, dashed, ring, arc, cell, box, disc, glow, hexLin } from './raster.js';

export const DEFAULTS = {
  ground: '#07080b', ink: '#e9e6df', accent: '#e39b3a', faint: 0.34,
  levels: 9, margin: 0.035,        // rectangle inset, share of width
  pitch: 0.0115,                   // cell pitch, share of width
  fill: 0.82,                      // cell side / pitch
  dust: 0.11,                      // stray cells near the figure, per edge cell
  tracked: 9, units: 512,          // labels read coordinates in a units-wide space
  quarter: 1.65, quarters: 6, hold: 0.9, law: 'angle', tail: 0.85,
  drift: 1.6, seed: 24,
};

// Coverage mask helpers. A mask is { cols, rows, v: Float32Array } with v in [0, 1].
export function mask(cols, rows, fn) { const v = new Float32Array(cols * rows); for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) v[j * cols + i] = fn(i, j); return { cols, rows, v }; }

// Farthest-point sample of k cells, seeded start: spreads the tracked points over the figure.
function farthest(pts, k, r) {
  if (!pts.length) return [];
  const out = [pts[Math.floor(r() * pts.length)]], d = pts.map(p => Math.hypot(p.x - out[0].x, p.y - out[0].y));
  while (out.length < Math.min(k, pts.length)) {
    let bi = 0; for (let i = 1; i < d.length; i++) if (d[i] > d[bi]) bi = i;
    out.push(pts[bi]); for (let i = 0; i < pts.length; i++) d[i] = Math.min(d[i], Math.hypot(pts[i].x - pts[bi].x, pts[i].y - pts[bi].y));
  }
  return out;
}

const rectsHit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Occupancy of the figures' cells on a coarse grid, dilated by `pad` px: labels must not cover a letter.
// cells: [{ x, y, s, fig }] (fig >= 0 is the figure; dust and stars are free to cover).
export function glyphGrid(cells, W, H, { step = 6, pad = 4 } = {}) {
  const cols = Math.ceil(W / step), rows = Math.ceil(H / step), v = new Uint8Array(cols * rows);
  for (const c of cells) {
    if (c.fig < 0) continue;
    const x0 = Math.max(0, Math.floor((c.x - pad) / step)), x1 = Math.min(cols - 1, Math.floor((c.x + c.s + pad) / step));
    const y0 = Math.max(0, Math.floor((c.y - pad) / step)), y1 = Math.min(rows - 1, Math.floor((c.y + c.s + pad) / step));
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) v[j * cols + i] = 1;
  }
  return { step, cols, rows, v, hits(r) {
    const a = Math.max(0, Math.floor(r.x / step)), b = Math.min(cols - 1, Math.floor((r.x + r.w) / step));
    const c = Math.max(0, Math.floor(r.y / step)), d = Math.min(rows - 1, Math.floor((r.y + r.h) / step));
    for (let j = c; j <= d; j++) for (let i = a; i <= b; i++) if (v[j * cols + i]) return true;
    return false;
  } };
}

// Label placement on leader lines (the construction plate's own logic). For each point, candidates run out
// along 16 directions at growing reach until a box is inside the frame, clear of every placed label and
// clear of the figure's letters (`avoid`, a glyphGrid). Shorter leaders win; directions pointing away from
// `centre` are tried first. A point with no clear place within maxReach is dropped, never stacked.
// Revised 2026-10-23 (quality pass): labels used to sit on the word; now they never cover a figure cell.
export function placeLabels(points, size, { W, H, font = 12, gap = 10, avoid = null, centre = null, maxReach = 0.3 } = {}) {
  const placed = [], cw = font * 0.6, out = [], reachMax = maxReach * Math.max(W, H), step = Math.max(4, font * 0.75);
  for (const p of points) {
    const w = p.text.length * cw + 4, h = font + 4;
    const away = centre ? Math.atan2(p.y - centre.y, p.x - centre.x) : -Math.PI / 4;
    const dirs = Array.from({ length: 16 }, (_, k) => away + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8));
    let best = null;
    for (let reach = gap; reach <= Math.max(gap, reachMax) && !best; reach += step) {
      for (const a of dirs) {
        const ex = p.x + Math.cos(a) * reach, ey = p.y + Math.sin(a) * reach;
        const x = Math.cos(a) >= 0.2 ? ex : Math.cos(a) <= -0.2 ? ex - w : ex - w / 2;
        const y = Math.sin(a) >= 0.2 ? ey : Math.sin(a) <= -0.2 ? ey - h : ey - h / 2;
        const r = { x, y, w, h };
        if (x < 0 || y < 0 || x + w > W || y + h > H) continue;
        if (placed.some(q => rectsHit(q, r))) continue;
        if (avoid && avoid.hits(r)) continue;
        best = r; break;
      }
    }
    if (best) { placed.push(best); out.push({ ...p, box: best }); }
  }
  return out;
}

// The anchor of a leader on its label: the nearest point of the box edge to the tracked point.
export function leaderEnd(p, b) {
  return { x: Math.max(b.x, Math.min(p.x, b.x + b.w)), y: Math.max(b.y, Math.min(p.y, b.y + b.h)) };
}

// Build the scene at time t for a W x H frame. figures: [{ mask, square: index into the construction }].
export function scene(W, H, figures, t = 0, o = {}) {
  const c = { ...DEFAULTS, ...o }, r = rng(c.seed);
  const gw = W * (1 - 2 * c.margin), g = goldenRect(W * c.margin, (H - gw / 1.6180339887) / 2, gw, c.levels);
  const pitch = W * c.pitch, cells = [], edge = [];
  for (const f of figures) {
    const q = g.squares[f.square ?? 0], m = f.mask, side = q.s * (f.scale ?? 0.78);
    const p = Math.min(pitch, side / Math.max(m.cols, m.rows)), ox = q.x + (q.s - p * m.cols) / 2, oy = q.y + (q.s - p * m.rows) / 2;
    for (let j = 0; j < m.rows; j++) for (let i = 0; i < m.cols; i++) {
      const v = m.v[j * m.cols + i], jit = r();
      if (v > 0.35 + 0.3 * (jit - 0.5)) {
        const b = Math.min(1, 0.45 + 0.55 * v) * (0.72 + 0.28 * r());
        const cl = { x: ox + i * p, y: oy + j * p, s: p * c.fill, b, fig: figures.indexOf(f) }; cells.push(cl);
        const nb = (a, bb) => (a < 0 || bb < 0 || a >= m.cols || bb >= m.rows) ? 0 : m.v[bb * m.cols + a];
        if (nb(i - 1, j) < 0.35 || nb(i + 1, j) < 0.35 || nb(i, j - 1) < 0.35 || nb(i, j + 1) < 0.35) edge.push({ ...cl, i, j, p, ox, oy });
      }
    }
  }
  for (const e of edge) if (r() < c.dust * 6) {           // dust: stray cells thrown off the figure's edge
    const a = r() * 2 * Math.PI, d = (1 + r() * 5) * e.p;
    cells.push({ x: e.x + Math.round(Math.cos(a) * d / e.p) * e.p, y: e.y + Math.round(Math.sin(a) * d / e.p) * e.p, s: e.s * (0.5 + 0.5 * r()), b: 0.25 + 0.4 * r(), fig: -1 });
  }
  const stars = []; for (let i = 0; i < Math.round(W * H / 2600); i++) stars.push({ x: r() * W, y: r() * H, b: 0.04 + 0.16 * r() ** 2 });
  const picks = farthest(cells.filter(q => q.fig >= 0).map(q => ({ x: q.x + q.s / 2, y: q.y + q.s / 2 })), c.tracked, r);
  const sc = { W, H, c, g, cells, stars, picks, nodes: nodes(g) };
  sc.tracked = trackedAt(sc, t); sc.u = headAt(sc, t);
  return sc;
}

// Tracked points drift on two incommensurate sines, so labels change value without jumping.
export function trackedAt(sc, t) {
  const { c, W } = sc, k = c.units / W, pitch = W * c.pitch;
  return sc.picks.map((p, i) => {
    const ph = 1.7 * i + 0.3, x = p.x + c.drift * pitch * Math.sin(0.61 * t + ph), y = p.y + c.drift * pitch * Math.sin(0.43 * t + 2.1 * ph);
    return { x, y, ux: Math.round(x * k), uy: Math.round(y * k), text: `x: ${Math.round(x * k)} y: ${Math.round(y * k)}` };
  });
}

export const headAt = (sc, t) => cometU(sc.g, t, sc.c);

// Draw the scene (no text). S: a raster.js surface of W x H pixels (device pixels).
export function render(S, sc) { renderBase(S, sc); return renderLive(S, sc); }

// The static plate: stars, construction, figure cells, nodes. It is the same for every t.
export function renderBase(S, sc) {
  const { c, g, W } = sc, ink = hexLin(c.ink), acc = hexLin(c.accent), lw = Math.max(1, W / 900);
  for (const s of sc.stars) disc(S, s.x, s.y, lw * 0.6, ink, s.b);
  const q0 = g.squares[0], q1 = g.squares[1];                         // the circles' faint inner light
  glow(S, q0.x + q0.s / 2, q0.y + q0.s / 2, q0.s * 0.34, acc, 0.055);
  glow(S, q1.x + q1.s / 2, q1.y + q1.s / 2, q1.s * 0.34, acc, 0.04);
  for (const q of g.squares.slice(0, 5)) ring(S, q.x + q.s / 2, q.y + q.s / 2, q.s / 2, lw, ink, c.faint * 0.9, 9 * lw, 7 * lw);
  const R = g, d = 10 * lw, gp = 6 * lw;
  dashed(S, R.x, R.y, R.x + R.w, R.y, lw, ink, d, gp, c.faint); dashed(S, R.x + R.w, R.y, R.x + R.w, R.y + R.h, lw, ink, d, gp, c.faint);
  dashed(S, R.x + R.w, R.y + R.h, R.x, R.y + R.h, lw, ink, d, gp, c.faint); dashed(S, R.x, R.y + R.h, R.x, R.y, lw, ink, d, gp, c.faint);
  for (const q of g.squares.slice(0, 6)) {                            // the cuts
    if (q.side === 0) line(S, q.x + q.s, q.y, q.x + q.s, q.y + q.s, lw, ink, c.faint);
    if (q.side === 1) line(S, q.x, q.y + q.s, q.x + q.s, q.y + q.s, lw, ink, c.faint);
    if (q.side === 2) line(S, q.x, q.y, q.x, q.y + q.s, lw, ink, c.faint);
    if (q.side === 3) line(S, q.x, q.y, q.x + q.s, q.y, lw, ink, c.faint);
  }
  for (const q of g.squares) { const a = q.arc; arc(S, a.cx, a.cy, a.r, a.a0, a.a1, lw * 1.2, ink, 0.55); }
  for (const cl of sc.cells) cell(S, cl.x, cl.y, cl.s, cl.fig >= 0 ? mixLin(acc, ink, 0.35 * cl.b) : acc, cl.b, 'over');
  for (const n of sc.nodes) { const s = 11 * lw; box(S, n.x - s / 2, n.y - s / 2, s, lw, ink, 0.7); ring(S, n.x, n.y, s * 0.28, lw, ink, 0.7, 2 * lw, 2 * lw); }
  for (const k of [0, 1, 2]) {                                       // tangent points, big dots in frames
    const p = spiralAt(g, k), s = (16 - 3 * k) * lw;
    disc(S, p.x, p.y, s * 0.55, acc, 1); box(S, p.x - s, p.y - s, 2 * s, lw, acc, 0.9);
  }
  return S;
}

// What moves: the head with its tail, and the tracked-point boxes.
export function renderLive(S, sc) {
  const { c, g, W } = sc, ink = hexLin(c.ink), acc = hexLin(c.accent), lw = Math.max(1, W / 900);
  // the head and its tail: N samples behind u, alpha falling as (1 - f)^2, plus a glow at the head
  const N = 90, u = sc.u, tail = c.tail;
  if (u < g.squares.length - 0.01) {
    let prev = spiralAt(g, Math.max(0, u - tail));
    for (let i = 1; i <= N; i++) {
      const f = i / N, p = spiralAt(g, Math.max(0, u - tail * (1 - f)));
      line(S, prev.x, prev.y, p.x, p.y, lw * (1.4 + 2.2 * f), ink, f * f, 'over'); prev = p;
    }
    const h = spiralAt(g, u); glow(S, h.x, h.y, 7 * lw, acc, 0.9); glow(S, h.x, h.y, 2.2 * lw, ink, 1.4);
  }
  for (const p of sc.tracked) { const s = 8 * lw; box(S, p.x - s / 2, p.y - s / 2, s, lw, acc, 0.95); }
  return S;
}

export function leaders(S, placed, sc) {
  const lw = Math.max(1, sc.W / 900), ink = hexLin(sc.c.ink);
  for (const p of placed) { const e = leaderEnd(p, p.box); line(S, p.x, p.y, e.x, e.y, lw * 0.8, ink, 0.45); }
  return S;
}

const mixLin = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// QUALITY-SPEC S1, S2, S4, S6: inputs, parameters with ranges and units, budget, export.
export const SPEC = Object.freeze({
  inputs: { W: 'int device px, 200 to 3840', H: 'int device px, W / 1.5 for the plate', figures: '[{ mask: { cols, rows, v: Float32Array in [0,1] }, square: int 0 to 8, scale: 0.3 to 1 }]', t: 's, any real' },
  params: {
    ground: 'sRGB hex', ink: 'sRGB hex', accent: 'sRGB hex', faint: 'alpha 0.1 to 0.6',
    levels: 'squares 4 to 12', margin: 'share of W, 0 to 0.1', pitch: 'cell pitch, share of W, 0.006 to 0.02 (8 to 10 CSS px at 720, QUALITY-SPEC R7)',
    fill: 'cell side / pitch, 0.5 to 1', dust: 'stray cells per edge cell / 6, 0 to 0.3', tracked: 'labels 0 to 16', units: 'label space width, 64 to 4096',
    quarter: 's per quarter turn, 0.5 to 4 (measured 1.65)', quarters: 'quarters run, 1 to levels', hold: 's at the centre, 0 to 3', law: "'angle' | 'speed'",
    tail: 'quarters behind the head, 0.1 to 2', drift: 'tracked drift amplitude in pitches, 0 to 4', seed: 'uint32',
  },
  determinism: 'same inputs and seed give byte-identical renderBase output (test: construct.test.mjs)',
  budget: { renderBase: '1440 x 960 device px, about 350 ms once per size (node; test bound 2.5 s)', live: 'Canvas 2D layer under 2 ms per frame at 1440 x 960 (audit cb_p95)' },
  export: '3840 x 2560 PNG from the page (renders offscreen at that size)',
  cadence: '60 on ones; the clock is t in seconds, so the state at t does not depend on the display rate',
});
