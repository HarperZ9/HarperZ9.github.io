// mosaic.js: a recut tile grid. On each tick of a layout clock the frame re-partitions on a module grid, and every
// tile takes a material: an archival plate (cleared, with its receipt), a plate graded to two inks, a soft gradient
// field, a dot-matrix panel, contour line work, a column of digits, a flat ink, or a generator's output.
//
// Synthesized from: the favourites' recut grid with coordinate labels on module corners (NcOl, 3.6 Hz); data columns
// as tiles (Hf9W); the self-cannibalising copy-block of the July databend brief (a plate recurs at a new crop and
// grade); and the narrated films' rule that a quoted tile carries its citation. Fills come from our own generators
// and public-domain or CC0 plates only, never from any reference's photographs.
//
// Pure core (node and browser): partition, layout, overlap. CPU reference renderer: renderLayout into lib/raster.js.
// The page composes the same layout on a canvas from pre-rendered sources (examples/mosaic.page.js).
import { hash01, rng, mixOk, clamp } from './lib/util.js';
import { image, fill, rect, disc, line } from './lib/raster.js';
import { SEG, DIGIT_SEGS } from './lib/typepile-numerals.js';
import { defineNode } from './lib/node.js';

export const CLASSES = Object.freeze(['plate', 'duo', 'field', 'dots', 'contour', 'digits', 'flat', 'gen']);
export const INKS = Object.freeze({ ground: '#0f0f0e', bone: '#eee9df', slate: '#3f5f8a', sky: '#7fd6e8', ochre: '#b8893a', sand: '#d9cdb4', hot: '#e0177e' });

const DEFAULTS = {
  module: 80, minDepth: 2, maxDepth: 6, splitP: 0.62, maxOverlap: 0.3, labelShare: 0.55,
  weights: { plate: 4, duo: 2, field: 1.5, dots: 1.2, contour: 1, digits: 0.8, flat: 0.8, gen: 1.5 },
  sources: { plate: 4, gen: 3 }, inks: [INKS.bone, INKS.slate, INKS.sky, INKS.ochre, INKS.sand],
};

// Recursive split on whole module cells. Returns rects in cells: { cx, cy, cw, ch }.
export function partition(seed, cols, rows, o = {}) {
  const { minDepth, maxDepth, splitP } = { ...DEFAULTS, ...o }, r = rng(seed), out = [];
  const split = (cx, cy, cw, ch, d) => {
    const canV = cw >= 2, canH = ch >= 2;
    if (!(canV || canH) || d >= maxDepth || (d >= minDepth && r() > splitP)) { out.push({ cx, cy, cw, ch }); return; }
    const vert = canV && (!canH || r() < cw / (cw + ch) + 0.1);
    if (vert) { const k = 1 + Math.floor(r() * (cw - 1)); split(cx, cy, k, ch, d + 1); split(cx + k, cy, cw - k, ch, d + 1); }
    else { const k = 1 + Math.floor(r() * (ch - 1)); split(cx, cy, cw, k, d + 1); split(cx, cy + k, cw, ch - k, d + 1); }
  };
  split(0, 0, cols, rows, 0);
  return out;
}

const key = (t) => `${t.cx},${t.cy},${t.cw},${t.ch}`;
// Share of tiles in b whose rectangle also appears in a (over the larger tile count).
export function overlap(a, b) { const s = new Set(a.map(key)); let n = 0; for (const t of b) if (s.has(key(t))) n++; return n / Math.max(a.length, b.length, 1); }

function pick(weights, u) {
  const e = Object.entries(weights).filter(([, w]) => w > 0), tot = e.reduce((s, [, w]) => s + w, 0); let acc = 0;
  for (const [k, w] of e) { acc += w / tot; if (u < acc) return k; }
  return e[e.length - 1][0];
}

// Grid geometry for a frame: whole cells, centred, so art sits on the declared module (QUALITY-SPEC C2).
export function grid(w, h, module = DEFAULTS.module) {
  const cols = Math.max(2, Math.round(w / module)), rows = Math.max(2, Math.round(h / module));
  return { cols, rows, mx: w / cols, my: h / rows };
}

// The cells of layout k. A layout that keeps more than maxOverlap of the previous rectangles reads as no cut, so it
// re-rolls from a sub-seed. The previous layout is itself resolved the same way to a depth of 4 (then taken as drawn),
// so random access to any k stays cheap and a run of consecutive layouts sees the same cells it was checked against.
function cellsAt(seed, k, g, P, depth) {
  const base = Math.floor(hash01(seed, k) * 4294967296); let cells = partition(base, g.cols, g.rows, P);
  if (k <= 0) return cells;
  const prev = depth > 0 ? cellsAt(seed, k - 1, g, P, depth - 1) : partition(Math.floor(hash01(seed, k - 1) * 4294967296), g.cols, g.rows, P);
  for (let tries = 1; overlap(prev, cells) > P.maxOverlap && tries <= 12; tries++) cells = partition(base ^ Math.imul(0x9e3779b1, tries), g.cols, g.rows, P);
  return cells;
}

// Layout k of a piece: tiles with class, source, crop, ink, label and exactly one accent. Pure in (seed, k, w, h, o).
export function layout(seed, k, w, h, o = {}) {
  const P = { ...DEFAULTS, ...o, weights: { ...DEFAULTS.weights, ...(o.weights || {}) }, sources: { ...DEFAULTS.sources, ...(o.sources || {}) } };
  const g = grid(w, h, P.module), base = Math.floor(hash01(seed, k) * 4294967296), cells = cellsAt(seed, k, g, P, 4);
  const r = rng(base ^ 0x5bd1e995);
  const tiles = cells.map((c, i) => {
    let cls = pick(P.weights, r()); if ((cls === 'plate' || cls === 'duo') && !P.sources.plate) cls = 'field'; if (cls === 'gen' && !P.sources.gen) cls = 'dots';
    if ((cls === 'field' || cls === 'flat') && c.cw * c.ch > 0.12 * g.cols * g.rows && P.sources.plate) cls = 'duo'; // a flat plane that big is dead air
    if (cls === 'digits' && c.cw > 2) cls = c.ch > c.cw ? 'contour' : 'field'; // data columns stay narrow, as in Hf9W's tall digit tiles
    const nsrc = cls === 'plate' || cls === 'duo' ? P.sources.plate : cls === 'gen' ? P.sources.gen : 1;
    return {
      i, ...c, x: c.cx * g.mx, y: c.cy * g.my, w: c.cw * g.mx, h: c.ch * g.my, cls, src: Math.floor(r() * nsrc),
      crop: { u: r(), v: r(), s: 1 + r() * 2.2 }, ink: P.inks[Math.floor(r() * P.inks.length)], ink2: P.inks[Math.floor(r() * P.inks.length)],
      label: r() < P.labelShare ? `${String(c.cx).padStart(2, '0')}.${String(c.cy).padStart(2, '0')}` : null, accent: false, seed: Math.floor(r() * 1e9),
    };
  });
  // One hot mark per layout (C3): the accent goes to a non-photographic tile, smallest first so it reads as a mark.
  const cand = tiles.filter((t) => !['plate', 'gen'].includes(t.cls)), pool = cand.length ? cand : tiles;
  pool.sort((a, b) => a.cw * a.ch - b.cw * b.ch || a.i - b.i)[Math.floor(r() * Math.min(3, pool.length))].accent = true;
  return { k, w, h, ...g, tiles };
}

// CPU fills. Each paints tile t into image im; sample(u, v) -> [r, g, b] for plate and gen sources.
export const shade = (u, v, s) => 0.5 + 0.25 * Math.sin(u * 6.1 * s + 1.3) * Math.cos(v * 4.7 * s - 0.4) + 0.25 * Math.sin((u + v) * 9.3 * s);
export const FILL = {
  plate(im, t, src) { cover(im, t, (u, v) => src(u, v)); },
  duo(im, t, src) { const a = hex(INKS.ground), b = hex(t.accent ? INKS.hot : t.ink); cover(im, t, (u, v) => { const c = src(u, v), l = clamp(0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]); return a.map((x, i) => x + (b[i] - x) * l * l); }); },
  field(im, t) { const a = hex(t.ink), b = hex(t.accent ? INKS.hot : mixOk(t.ink2, INKS.ground, 0.55)), cx = t.crop.u, cy = t.crop.v; cover(im, t, (u, v) => { const d = clamp(Math.hypot(u - cx, v - cy) * 1.1); return a.map((x, i) => x + (b[i] - x) * d * d * (3 - 2 * d)); }); },
  dots(im, t) {
    rect(im, t.x, t.y, t.x + t.w, t.y + t.h, INKS.ground); const p = 9, ink = t.accent ? INKS.hot : t.ink;
    for (let y = t.y + p / 2; y < t.y + t.h; y += p) for (let x = t.x + p / 2; x < t.x + t.w; x += p) {
      const v = shade((x - t.x) / t.w + t.crop.u, (y - t.y) / t.h + t.crop.v, t.crop.s); if (v > 0.18) disc(im, x, y, 0.5 + 3.4 * v * v, ink);
    }
  },
  contour(im, t) {
    rect(im, t.x, t.y, t.x + t.w, t.y + t.h, mixOk(t.ink2, INKS.ground, 0.82)); const N = 9, ink = hex(t.accent ? INKS.hot : t.ink), e = 1e-3;
    for (let y = Math.floor(t.y); y < Math.ceil(t.y + t.h); y++) for (let x = Math.floor(t.x); x < Math.ceil(t.x + t.w); x++) {
      const u = (x + 0.5 - t.x) / t.w + t.crop.u, v = (y + 0.5 - t.y) / t.h + t.crop.v, f = shade(u, v, t.crop.s);
      const gx = (shade(u + e, v, t.crop.s) - f) / e / t.w, gy = (shade(u, v + e, t.crop.s) - f) / e / t.h, gpx = Math.hypot(gx, gy) * N + 1e-6;
      const fr = (f * N) % 1, dist = Math.min(fr, 1 - fr) / gpx; // px to the nearest iso-line, from the local gradient
      const cov = clamp(0.6 + 0.5 - dist); if (cov > 0) rect(im, x, y, x + 1, y + 1, ink, cov);
    }
  },
  digits(im, t) {
    rect(im, t.x, t.y, t.x + t.w, t.y + t.h, mixOk(t.ink, INKS.ground, 0.86)); const H = Math.max(10, Math.min(28, t.w / 4)), ink = t.accent ? INKS.hot : t.ink, r = rng(t.seed);
    for (let y = t.y + H * 0.5; y + H < t.y + t.h - 2; y += H * 1.5) for (let x = t.x + H * 0.4; x + H * 0.6 < t.x + t.w - 2; x += H * 0.95) {
      for (const s of DIGIT_SEGS[Math.floor(r() * 10)]) { const q = SEG[s]; line(im, x + q[0] * H, y + q[1] * H, x + q[2] * H, y + q[3] * H, Math.max(0.6, H * 0.06), ink); }
    }
  },
  flat(im, t) { rect(im, t.x, t.y, t.x + t.w, t.y + t.h, t.accent ? INKS.hot : t.ink); },
  gen(im, t, src) { cover(im, t, (u, v) => src(u, v)); },
};
// Iso-lines of the tile's field by marching squares on a step px lattice: segments [x0, y0, x1, y1, ...] in frame px.
// The page strokes them with the canvas's own anti-aliasing; the CPU fill above draws the same lines per pixel.
export function isolines(t, { N = 9, step = 4 } = {}) {
  const nx = Math.max(2, Math.ceil(t.w / step) + 1), ny = Math.max(2, Math.ceil(t.h / step) + 1), F = new Float32Array(nx * ny), out = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[j * nx + i] = shade(Math.min(1, (i * step) / t.w) + t.crop.u, Math.min(1, (j * step) / t.h) + t.crop.v, t.crop.s) * N;
  const X = (i) => t.x + Math.min(t.w, i * step), Y = (j) => t.y + Math.min(t.h, j * step);
  for (let lv = 1; lv < N; lv++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = F[j * nx + i] - lv, b = F[j * nx + i + 1] - lv, c = F[(j + 1) * nx + i + 1] - lv, d = F[(j + 1) * nx + i] - lv, p = [];
    if (a * b < 0) p.push(X(i + a / (a - b)), Y(j)); if (b * c < 0) p.push(X(i + 1), Y(j + b / (b - c)));
    if (c * d < 0) p.push(X(i + 1 - c / (c - d)), Y(j + 1)); if (d * a < 0) p.push(X(i), Y(j + 1 - d / (d - a)));
    if (p.length >= 4) out.push(p[0], p[1], p[2], p[3]); if (p.length === 8) out.push(p[4], p[5], p[6], p[7]);
  }
  return out;
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
// Fill a tile from a sampler over a crop window of the source (u, v in 0..1 across the window).
function cover(im, t, f) {
  const s = 1 / t.crop.s, u0 = t.crop.u * (1 - s), v0 = t.crop.v * (1 - s), asp = t.w / t.h;
  for (let y = Math.floor(t.y); y < Math.ceil(t.y + t.h); y++) for (let x = Math.floor(t.x); x < Math.ceil(t.x + t.w); x++) {
    const a = (x + 0.5 - t.x) / t.w, b = (y + 0.5 - t.y) / t.h, c = f(u0 + a * s * Math.min(1, asp), v0 + b * s * Math.min(1, 1 / asp));
    rect(im, x, y, x + 1, y + 1, c);
  }
}

// CPU reference render of one layout. sources: { plate: [sampler...], gen: [sampler...] }. Labels draw as small
// module-corner ticks here (node has no font); the page sets them as Conso text.
export function renderLayout(L, sources = {}, { gutter = 1, ground = INKS.ground } = {}) {
  const im = fill(image(L.w, L.h), ground);
  for (const t of L.tiles) {
    const src = t.cls === 'plate' || t.cls === 'duo' ? sources.plate?.[t.src] : t.cls === 'gen' ? sources.gen?.[t.src] : null;
    FILL[(t.cls === 'plate' || t.cls === 'duo' || t.cls === 'gen') && !src ? 'field' : t.cls](im, t, src);
    if (t.label) { line(im, t.x + 4, t.y + 4, t.x + 14, t.y + 4, 0.5, INKS.bone); line(im, t.x + 4, t.y + 4, t.x + 4, t.y + 14, 0.5, INKS.bone); }
  }
  if (gutter > 0) for (const t of L.tiles) { rect(im, t.x, t.y, t.x + t.w, t.y + gutter / 2, ground); rect(im, t.x, t.y, t.x + gutter / 2, t.y + t.h, ground); }
  return im;
}

export const SPEC = Object.freeze({
  inputs: { seed: 'uint32', k: 'layout index (from a cadence clock)', w: 'px', h: 'px', sources: '{ plate: samplers or images, gen: samplers or canvases }' },
  params: {
    module: { range: [24, 240], unit: 'px, grid module (1/9 of 720 is 80)', default: 80 },
    maxDepth: { range: [2, 6], unit: 'split levels', default: 6 },
    splitP: { range: [0, 1], unit: 'share: chance to split past minDepth', default: 0.62 },
    maxOverlap: { range: [0, 0.6], unit: 'share of rectangles kept from the previous layout', default: 0.3 },
    labelShare: { range: [0, 1], unit: 'share of tiles with a coordinate label', default: 0.55 },
    dotPitch: { range: [8, 10], unit: 'px, dot-matrix cell (QUALITY-SPEC R7)', default: 9 },
  },
  determinism: 'layout(seed, k, w, h) is pure; the CPU render is byte-equal for equal inputs',
  budget: 'layout at 1440 x 900: under 0.3 ms; page recomposition from pre-rendered sources: under 4 ms per recut',
  clock: 'cadence.js recut-3.6 by default (a new layout every 7 frames at 25 fps)',
});

export const node = defineNode({
  id: 'mosaic', ports: { in: { plate: 'image', gen: 'image', clock: 'clock' }, out: { image: 'image' } }, params: {
    module: SPEC.params.module, maxDepth: SPEC.params.maxDepth, labelShare: SPEC.params.labelShare, k: { range: [0, 1e6], unit: 'layout index', default: 0 },
  }, seed: 1,
  render: ({ seed, params, w = 480, h = 300, inputs = {} }) => renderLayout(layout(seed, params.k, w, h, params), inputs),
});
