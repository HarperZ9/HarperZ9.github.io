// ledger: a data series written as swept prisms on a grid, printed in two inks.
// A resynthesis (Synthesis-and-Design-Framework.md, section 1) of the sweep idea studied in feed set 23, with every
// parameter now our own:
//   - data, not chance: entry i of a series is one prism; its sweep length is its value, its direction the sign of
//     its change (rising entries sweep up and right, falling ones down and right), its ink the value's quantile.
//     The series can be a glyph's own column ink (letters that tally themselves) or any data the page holds.
//   - our motion spec, not the reference's: arrivals cascade in reading order (stagger in s), each sweep eases out
//     with quad (quality spec M6, t50 0.293); no Poisson rate, no measured concurrency.
//   - our light, not the reference's tones: face tones are Lambert from a declared light direction.
//   - print as the material (feed 20 limited ink, the misregistered second witness): side faces carry halftone
//     screens at the face tone; caps print a key ink offset by a misregistration vector.
//   - cell size from our layout: the glyph's stroke width when a mask is given, else the quality spec's module
//     (1/9 of the frame) divided into the series.
export const SPEC = Object.freeze({
  inputs: { series: 'number[] (any units; normalised to 0..1 by its own min and max)', cols: 'integer 4 to 120', rows: 'integer 4 to 120', mask: '(i, j) => boolean, optional (a word from the lettering glyph mask)' },
  params: { maxLen: 'cells, 1 to 8, the sweep length of the largest value', stagger: 's between entries, 0.01 to 0.2', cellsPerSecond: 'cells/s, 2 to 16', light: '[x, y, z] unit, z toward the viewer', inks: 'palette name or { ground, ramp[], key }', misregister: '[dx, dy] in cells, 0 to 0.15' },
  clock: 'step(dt), driven on a fixed 1/120 s clock by the page; state at time t is independent of the step size',
  determinism: 'same series, seed and inputs give the same polygons and SVG, byte for byte (test)',
  output: 'polygons with face kind and tone; Canvas 2D (with halftone patterns) or SVG',
});

export const INKS = {
  // a ledger's inks: iron-gall black, oxblood, brass, verdigris, slate, with a vermilion key, on paper
  ledger: { ground: '#ece6d8', cell: '#ddd5c3', ramp: ['#3b4a66', '#2f6f63', '#b8893b', '#7a2430', '#1d1c22'], key: '#e2552c' },
  night: { ground: '#0d0e13', cell: '#181a22', ramp: ['#5b6f96', '#3f8f7f', '#c79a4a', '#a33a3f', '#e9e4d8'], key: '#f0793f' },
};
export const DIAG = { up: [1, -1], down: [1, 1] };
export const easeOutQuad = (t) => 1 - (1 - t) ** 2;

const hexMul = (hex, k) => { const n = parseInt(hex.slice(1), 16); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, '0')).join(''); };
const norm = (v) => { const m = Math.hypot(...v) || 1; return v.map((x) => x / m); };

// Face tone relative to the cap, from a light direction. Faces: the cap (normal toward the viewer), and the two
// side faces the sweep exposes, whose normals point back against the sweep along x and along y.
export function faceTones(d, light) {
  const L = norm(light), amb = 0.28, lam = (n) => amb + (1 - amb) * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
  const cap = lam([0, 0, 1]);
  return { horizontal: lam(norm([0, -d[1], 0.35])) / cap, vertical: lam(norm([-d[0], 0, 0.35])) / cap };
}

export function createLedger(opts = {}) {
  const o = { series: null, cols: 24, rows: 16, inks: 'ledger', maxLen: 4, stagger: 0.05, cellsPerSecond: 9, light: [-0.45, -0.6, 0.66], misregister: [0.06, 0.04], mask: null, loop: true, ...opts };
  const ink = typeof o.inks === 'string' ? INKS[o.inks] : o.inks;
  const on = (i, j) => i >= 0 && j >= 0 && i < o.cols && j < o.rows && (!o.mask || o.mask(i, j));
  // reading order: rows top to bottom, cells left to right, mask cells only
  const cells = []; for (let j = 0; j < o.rows; j++) for (let i = 0; i < o.cols; i++) if (on(i, j)) cells.push([i, j]);
  if (!cells.length) throw new Error('ledger: no cells to write on');
  const raw = o.series && o.series.length ? o.series : cells.map((_, k) => Math.sin(k * 0.37) + Math.sin(k * 0.11) * 0.6);
  const lo = Math.min(...raw), hi = Math.max(...raw), val = raw.map((v) => (hi > lo ? (v - lo) / (hi - lo) : 0.5));
  const rank = [...val].sort((a, b) => a - b), quant = (v) => Math.min(ink.ramp.length - 1, Math.floor((rank.findIndex((r) => r >= v) / rank.length) * ink.ramp.length));
  // one entry per cell, the series read cyclically
  const entries = cells.map(([i, j], k) => {
    const v = val[k % val.length], prev = val[(k - 1 + val.length) % val.length], d = v >= prev ? DIAG.up : DIAG.down;
    const want = Math.max(1, Math.round(v * o.maxLen)); let len = want; while (len > 0 && !on(i + d[0] * len, j + d[1] * len)) len--; // clipped at the edge of the page or the letter
    return { k, i, j, d, len, want, v, color: quant(v), t0: k * o.stagger, dur: Math.max(1, len) / o.cellsPerSecond };
  });
  const period = entries.length * o.stagger + o.maxLen / o.cellsPerSecond + 1.5; // write, hold, then start over
  let time = 0;
  const local = () => (o.loop ? time % period : time);
  const extent = (e, t = local()) => e.len * easeOutQuad(Math.min(1, Math.max(0, (t - e.t0) / e.dur)));

  function step(dt) { if (!(dt >= 0)) throw new RangeError('ledger: dt must be >= 0'); time += dt; }

  function polygons() {
    const out = [], t = local(), [mx, my] = o.misregister;
    // the page's cells print a shade darker than the ground, so a word reads before a single entry is written
    for (const [i, j] of cells) out.push({ pts: [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], fill: o.mask ? (ink.cell ?? ink.ground) : ink.ground, face: 'paper', tone: 1 });
    for (const e of entries) {
      if (t < e.t0) continue;
      const x = e.i + e.d[0] * extent(e, t), y = e.j + e.d[1] * extent(e, t), ex = extent(e, t), col = ink.ramp[e.color], tones = faceTones(e.d, o.light);
      if (ex > 1e-6) {
        const bx = -e.d[0] * ex, by = -e.d[1] * ex, hy = e.d[1] > 0 ? y : y + 1, vx = e.d[0] > 0 ? x : x + 1;
        out.push({ pts: [[x, hy], [x + 1, hy], [x + 1 + bx, hy + by], [x + bx, hy + by]], fill: hexMul(col, tones.horizontal), face: 'horizontal', tone: tones.horizontal, k: e.k, ink: col });
        out.push({ pts: [[vx, y], [vx, y + 1], [vx + bx, y + 1 + by], [vx + bx, y + by]], fill: hexMul(col, tones.vertical), face: 'vertical', tone: tones.vertical, k: e.k, ink: col });
      }
      out.push({ pts: [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], fill: col, face: 'cap', tone: 1, k: e.k, ink: col });
      // the key ink, printed a little off register: a frame on the cap, offset by the misregistration
      if (e.v > 0.8) out.push({ pts: [[x + mx + 0.18, y + my + 0.18], [x + mx + 0.82, y + my + 0.18], [x + mx + 0.82, y + my + 0.82], [x + mx + 0.18, y + my + 0.82]], fill: ink.key, face: 'key', tone: 1, k: e.k, stroke: true });
    }
    return out;
  }

  // Canvas 2D: flat caps, halftone side faces (pattern from patternFor(ink, tone, pitch) supplied by the page).
  function draw(ctx, pitch, ox = 0, oy = 0, patternFor = null) {
    for (const p of polygons()) {
      ctx.beginPath(); p.pts.forEach(([x, y], k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, ox + x * pitch, oy + y * pitch)); ctx.closePath();
      if (p.stroke) { ctx.strokeStyle = p.fill; ctx.lineWidth = Math.max(1, pitch * 0.07); ctx.stroke(); continue; }
      ctx.fillStyle = patternFor && (p.face === 'horizontal' || p.face === 'vertical') ? patternFor(p.ink, p.tone, pitch) : p.fill;
      ctx.fill(); if (!patternFor || p.face === 'cap' || p.face === 'paper') { ctx.strokeStyle = p.fill; ctx.lineWidth = 0.6; ctx.stroke(); }
    }
  }

  function toSVG(pitch = 24, pad = 1) {
    const W = (o.cols + 2 * pad) * pitch, H = (o.rows + 2 * pad) * pitch, f = (v) => ((v + pad) * pitch).toFixed(2);
    const body = polygons().map((p) => `<path d="M${p.pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z" ${p.stroke ? `fill="none" stroke="${p.fill}" stroke-width="${(pitch * 0.07).toFixed(2)}"` : `fill="${p.fill}"`}/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${ink.ground}"/>${body}</svg>`;
  }

  // the written state, for reduced motion: every entry complete, before the loop starts over
  function finish() { time = entries.length * o.stagger + o.maxLen / o.cellsPerSecond + 0.5; return api; }

  const api = { step, polygons, draw, toSVG, finish, extent, entries, cells, period, inks: ink, options: o, get time() { return time; } };
  return api;
}

// A series from a glyph mask: the ink in each column, so a word tallies its own letters.
export function seriesFromMask(cov, w, h, cols) {
  const out = [];
  for (let i = 0; i < cols; i++) { let s = 0; const x0 = Math.floor((i * w) / cols), x1 = Math.floor(((i + 1) * w) / cols); for (let x = x0; x < x1; x++) for (let y = 0; y < h; y++) s += cov[y * w + x]; out.push(s); }
  return out;
}

// Cells of a coverage mask on a cols x rows grid (mean coverage above threshold).
export function maskFromCoverage(cov, w, h, cols, rows, threshold = 0.5) {
  const on = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let s = 0, n = 0; const x0 = Math.floor((i * w) / cols), x1 = Math.floor(((i + 1) * w) / cols), y0 = Math.floor((j * h) / rows), y1 = Math.floor(((j + 1) * h) / rows);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += cov[y * w + x]; n++; }
    on[j * cols + i] = n && s / n >= threshold ? 1 : 0;
  }
  return (i, j) => on[j * cols + i] === 1;
}
