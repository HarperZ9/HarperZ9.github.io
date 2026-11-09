// lib/zoning.js: a word set as a skyline whose letters are carved by a setback law.
// New York's 1916 Zoning Resolution let a street wall rise to a multiple of the street's width, then made the mass
// step back behind an inclined plane, with a tower allowed over a quarter of the lot. Hugh Ferriss drew the envelope
// in 1922. Here the envelope is a function, the glyphs are the lots, and the law draws the letterforms.
import { clamp, grainTile } from './util.js';
import { cascade } from './timing.js';

// envelope(z, o): allowed half-width at height z above the street, for a lot of half-width `lot`.
// wall = street * multiple is the street-wall height; above it the plane retreats 1 unit per `ratio` units of rise,
// in steps of `step` height. The tower keeps sqrt(towerShare) of the lot's half-width and then rises without limit.
export function envelope(z, o) {
  const { lot, street, multiple = 1.5, ratio = 3, step = lot * 0.18, towerShare = 0.25 } = o;
  const wall = street * multiple, tower = lot * Math.sqrt(towerShare);
  if (z <= wall) return lot;
  const steps = Math.ceil((z - wall) / step - 1e-9), a = lot - (steps * step) / ratio;
  return Math.max(tower, a);
}

// The stepped profile as a list of [z, halfWidth] corners from the street up to `top`.
export function profile(o, top) {
  const pts = [[0, envelope(0, o)]];
  let z = 0, prev = envelope(0, o);
  const dz = Math.max(0.5, (o.step ?? o.lot * 0.18) / 40);
  while (z < top) { z += dz; const a = envelope(z, o); if (a !== prev) { pts.push([z - dz, prev], [z - dz, a]); prev = a; } }
  pts.push([top, prev]);
  return pts;
}

// Number of setbacks taken before the tower: a check on the law, used by the tests and the wall label.
export function setbackCount(o) {
  const tower = o.lot * Math.sqrt(o.towerShare ?? 0.25), step = o.step ?? o.lot * 0.18;
  return Math.ceil(((o.lot - tower) * (o.ratio ?? 3)) / step - 1e-9);
}

// Draw the envelope of one glyph as a closed path in canvas space: centre cx, street at y0, height upward.
function envelopePath(ctx, cx, y0, top, o) {
  const p = profile(o, top);
  ctx.moveTo(cx - p[0][1], y0);
  for (const [z, a] of p) ctx.lineTo(cx - a, y0 - z);
  for (let i = p.length - 1; i >= 0; i--) ctx.lineTo(cx + p[i][1], y0 - p[i][0]);
  ctx.closePath();
}

// The plate. assets.concrete and assets.poster are cleared archival images. Returns a plate with set(street).
export function create(cv, assets, opts = {}) {
  const x = cv.getContext('2d'), word = opts.word || 'SURVIVE';
  const st = { street: opts.street ?? 0.16, grow: opts.reduced ? 1 : 0, t0: null, done: !!opts.reduced, key: '' };
  const layer = () => document.createElement('canvas');
  const L = { text: layer(), mass: layer() };
  function build(W, H) {
    const size = Math.min(H * 0.62, (W * 0.92) / (word.length * 0.66));
    for (const c of Object.values(L)) { c.width = W; c.height = H; }
    const t = L.text.getContext('2d'); t.font = `800 ${size}px "Hanken Grotesk", sans-serif`; t.textBaseline = 'alphabetic';
    const total = t.measureText(word).width, x0 = (W - total) / 2, y0 = H * 0.86, cap = size * 0.72, glyphs = [];
    let acc = 0;
    for (const ch of word) { const w = t.measureText(ch).width; glyphs.push({ ch, x: x0 + acc, w }); acc += w; }
    return { size, x0, y0, cap, glyphs, W, H };
  }
  function carve(g, grow) {
    const t = L.text.getContext('2d'), { W, H, y0, cap, size } = g;
    t.clearRect(0, 0, W, H); t.font = `800 ${size}px "Hanken Grotesk", sans-serif`; t.fillStyle = '#000';
    for (const q of g.glyphs) t.fillText(q.ch, q.x, y0);
    t.globalCompositeOperation = 'destination-in'; t.beginPath();
    g.glyphs.forEach((q, i) => {
      const lot = q.w * 0.5, o = { lot, street: cap * st.street * (1 + 0.12 * Math.sin(i * 1.7)), multiple: 1.5, ratio: 2.2, step: cap * 0.085 };
      envelopePath(t, q.x + q.w / 2, y0, cap * 1.4 * grow + 1, o); q.o = o;
    });
    t.fill(); t.globalCompositeOperation = 'source-over';
  }
  function draw(time) {
    const W = cv.width, H = cv.height, key = W + 'x' + H;
    if (st.key !== key) { st.g = build(W, H); st.key = key; }
    // the build follows the measured glyph cascade: slow start, fast finish, a 1.8% overshoot, a settle
    if (!st.done) { if (st.t0 === null) st.t0 = time; const e = time - st.t0; st.grow = cascade(e); if (e > 2.2) { st.done = true; st.grow = 1; } }
    const g = st.g;
    carve(g, Math.max(0.001, st.grow));
    // the ground (poster ghost, sunburst, grid) is baked once per size with grain and dither: the poster at 13%
    // alpha spans about 33 code values, which banded at 8 bits (quality pass, 2026-10-23)
    if (st.groundKey !== key) {
      const gc = st.ground || (st.ground = layer()); gc.width = W; gc.height = H;
      const gx = gc.getContext('2d', { willReadFrequently: true });
      gx.fillStyle = '#12100e'; gx.fillRect(0, 0, W, H);
      // the archival ground: the 1936 WPA poster that asked the question, a grey ghost behind the answer
      const P = assets.poster, pr = P.naturalWidth / P.naturalHeight, ph = W / pr;
      gx.save(); gx.globalAlpha = 0.13; gx.filter = 'grayscale(1) contrast(1.4)'; gx.drawImage(P, 0, (H - ph) * 0.35, W, ph); gx.restore();
      sunburst(gx, W / 2, g.y0 - g.cap * 1.15, W, H);
      st.tile ??= grainTile({ sd: 1.4, clump: 2, seed: 36 });
      gx.save(); gx.globalCompositeOperation = 'lighter'; gx.globalAlpha = 1; gx.fillStyle = gx.createPattern(st.tile, 'repeat'); gx.fillRect(0, 0, W, H); gx.restore();
      gx.save(); gx.globalCompositeOperation = 'difference'; gx.fillStyle = 'rgb(3,3,3)'; gx.fillRect(0, 0, W, H); gx.restore(); // take the tile's lift back out
      grid(gx, W, H, g);
      st.groundKey = key;
    }
    x.drawImage(st.ground, 0, 0);
    // brutalist mass: the carved word extruded back and down in shadow, then faced in poured concrete
    const m = L.mass.getContext('2d'); m.clearRect(0, 0, W, H);
    const depth = Math.round(g.size * 0.05);
    for (let d = depth; d > 0; d -= Math.max(1, depth / 24)) m.drawImage(L.text, d * 0.8, -d * 0.35);
    m.globalCompositeOperation = 'source-in'; m.fillStyle = '#060504'; m.fillRect(0, 0, W, H); m.globalCompositeOperation = 'source-over';
    const face = L.face || (L.face = layer()); face.width = W; face.height = H; const f = face.getContext('2d');
    f.drawImage(L.text, 0, 0); f.globalCompositeOperation = 'source-in';
    const C = assets.concrete; f.drawImage(C, 0, 0, C.naturalWidth, C.naturalHeight, 0, (H - W) / 2, W, W);
    f.globalCompositeOperation = 'source-atop'; f.fillStyle = 'rgba(20,16,12,.22)'; f.fillRect(0, 0, W, H);
    f.globalCompositeOperation = 'source-atop'; ledges(f, g); f.globalCompositeOperation = 'source-over';
    m.drawImage(face, 0, 0);
    x.drawImage(L.mass, 0, 0);
    return !st.done;
  }
  function ledges(ctx, g) {
    ctx.save(); ctx.strokeStyle = '#e0bd78'; ctx.lineWidth = Math.max(1.5, g.size * 0.012);
    for (const q of g.glyphs) {
      const p = profile(q.o, g.cap * 1.4 * st.grow), cx = q.x + q.w / 2;
      for (let i = 1; i < p.length - 1; i += 2) { const [z, a] = p[i], b = p[i + 1][1]; ctx.beginPath(); ctx.moveTo(cx - a, g.y0 - z); ctx.lineTo(cx - b, g.y0 - z); ctx.moveTo(cx + b, g.y0 - z); ctx.lineTo(cx + a, g.y0 - z); ctx.stroke(); }
    }
    ctx.restore();
  }
  return {
    label: 'zoning', get animated() { return !st.done; }, draw,
    set(street) { st.street = clamp(street, 0.08, 0.6); }, rebuild() { if (!opts.reduced) { st.done = false; st.t0 = null; st.grow = 0; } },
  };
}

// Deco sunburst: alternating thin rays from a point above the tallest setback.
function sunburst(ctx, cx, cy, W, H) {
  const r = Math.hypot(W, H) * 1.5, n = 72;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? 'rgba(224,189,120,.05)' : 'rgba(224,189,120,.012)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r); ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Brutalist module grid. One module is out of register by half a module: the wedge under the scale.
function grid(ctx, W, H, g) {
  const n = 12, m = W / n, broken = 7;
  ctx.save(); ctx.strokeStyle = 'rgba(239,233,220,.14)'; ctx.lineWidth = 1;
  for (let i = 1; i < n; i++) { const xx = i * m + (i === broken ? m * 0.5 : 0); ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, H); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, g.y0 + 1); ctx.lineTo(W, g.y0 + 1); ctx.stroke();
  ctx.restore();
}
