import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHI, goldenRect, spiralAt, arcLength, uAtLength, cometU, nodes } from './golden.js';
import { scene, render, renderBase, renderLive, placeLabels, mask, leaders } from './construct.js';
import { surface, toRGBA, luma, hexLin } from './raster.js';
import { golden } from './goldencheck.mjs';

const g = goldenRect(10, 20, 1000, 9);

test('rectangle and squares follow the golden ratio exactly', () => {
  assert.ok(Math.abs(g.w / g.h - PHI) < 1e-12);
  for (let k = 1; k < g.squares.length; k++) assert.ok(Math.abs(g.squares[k - 1].s / g.squares[k].s - PHI) < 1e-9, `k ${k}`);
  assert.deepEqual(g.squares.slice(0, 4).map(q => q.side), [0, 1, 2, 3]);
  const rest = g.rest; assert.ok(Math.abs(rest.w * rest.h - g.squares.at(-1).s ** 2 / PHI) < 1e-6);
});

test('squares tile the rectangle: areas sum to the rectangle less the remainder', () => {
  const area = g.squares.reduce((s, q) => s + q.s * q.s, 0) + g.rest.w * g.rest.h;
  assert.ok(Math.abs(area - g.w * g.h) < 1e-6);
});

test('the spiral is C1: arcs meet in position and tangent', () => {
  for (let k = 1; k < g.squares.length; k++) {
    const a = spiralAt(g, k - 1e-12), b = spiralAt(g, k);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-6, `gap at ${k}`);
    assert.ok(Math.hypot(a.tx - b.tx, a.ty - b.ty) < 1e-6, `kink at ${k}`);
  }
  const p = spiralAt(g, 0); assert.ok(Math.abs(p.x - g.x) < 1e-9 && Math.abs(p.y - (g.y + g.h)) < 1e-9);
});

test('arc length matches a polyline and inverts', () => {
  let s = 0, prev = spiralAt(g, 0);
  for (let i = 1; i <= 40000; i++) { const p = spiralAt(g, 4 * i / 40000); s += Math.hypot(p.x - prev.x, p.y - prev.y); prev = p; }
  assert.ok(Math.abs(s - arcLength(g, 4)) / s < 1e-6);
  for (const u of [0.3, 1.7, 3.2, 5.9]) assert.ok(Math.abs(uAtLength(g, arcLength(g, u)) - u) < 1e-9);
});

test('timing: angle law crosses each quarter at multiples of 1.65 s; speed law has constant pixel speed', () => {
  for (let q = 0; q <= 5; q++) assert.ok(Math.abs(cometU(g, q * 1.65, { quarters: 6, hold: 0.9 }) - q) < 1e-9);
  assert.equal(cometU(g, 6 * 1.65 + 0.5, { quarters: 6, hold: 0.9 }), 6);           // holding at the centre
  assert.ok(Math.abs(cometU(g, 6 * 1.65 + 0.9 + 1.65, { quarters: 6, hold: 0.9 }) - 1) < 1e-9); // loops
  const L = t => arcLength(g, cometU(g, t, { law: 'speed', quarters: 6, hold: 0 }));
  const v1 = L(1) - L(0.5), v2 = L(8) - L(7.5);
  assert.ok(Math.abs(v1 - v2) / v1 < 1e-9);
});

test('nodes sit on the rectangle edge', () => {
  for (const n of nodes(g)) {
    const on = Math.abs(n.x - g.x) < 1e-6 || Math.abs(n.x - g.x - g.w) < 1e-6 || Math.abs(n.y - g.y) < 1e-6 || Math.abs(n.y - g.y - g.h) < 1e-6;
    assert.ok(on, JSON.stringify(n));
  }
});

test('labels never overlap and stay inside the frame', () => {
  const pts = Array.from({ length: 30 }, (_, i) => ({ x: 200 + 9 * (i % 6), y: 150 + 9 * Math.floor(i / 6), text: `x: ${i} y: ${i * 2}` }));
  const W = 600, H = 400, out = placeLabels(pts, 0, { W, H, font: 12 });
  for (let i = 0; i < out.length; i++) {
    const a = out[i].box; assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= W && a.y + a.h <= H);
    for (let j = i + 1; j < out.length; j++) { const b = out[j].box; assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)); }
  }
  assert.ok(out.length >= 8, `only ${out.length} placed from a 45 x 36 px crowd`);   // a crowd drops labels, never stacks them
  const spread = Array.from({ length: 9 }, (_, i) => ({ x: 60 + 60 * i, y: 80 + 25 * (i % 4), text: 'x: 512 y: 512' }));
  assert.equal(placeLabels(spread, 0, { W, H, font: 12 }).length, 9);
});

// A block letter H on a 20 x 24 mask: a test figure that needs no font.
const H = mask(20, 24, (i, j) => (i < 5 || i >= 15 || (j >= 10 && j < 14)) ? 1 : 0);

test('scene: deterministic, figure cells inside their square, labels read the units space', () => {
  const W = 900, Hh = 600, a = scene(W, Hh, [{ mask: H, square: 0 }], 2.5), b = scene(W, Hh, [{ mask: H, square: 0 }], 2.5);
  assert.deepEqual(a.tracked, b.tracked); assert.equal(a.cells.length, b.cells.length);
  const q = a.g.squares[0];
  for (const c of a.cells.filter(c => c.fig === 0)) assert.ok(c.x >= q.x - 1e-6 && c.y >= q.y - 1e-6 && c.x + c.s <= q.x + q.s + 1e-6 && c.y + c.s <= q.y + q.s + 1e-6);
  const solid = H.v.filter(v => v > 0.5).length, cellsIn = a.cells.filter(c => c.fig === 0).length;
  assert.ok(cellsIn >= 0.85 * solid && cellsIn <= solid + 2, `${cellsIn} of ${solid}`);
  for (const p of a.tracked) { assert.equal(p.ux, Math.round(p.x * 512 / W)); assert.match(p.text, /^x: -?\d+ y: -?\d+$/); }
  assert.equal(a.tracked.length, 9);
});

test('the static plate does not depend on t; the live layer does', () => {
  const W = 360, Hh = 240, s0 = scene(W, Hh, [{ mask: H }], 0), s1 = scene(W, Hh, [{ mask: H }], 3.3);
  const A = renderBase(surface(W, Hh, hexLin('#07080b')), s0), B = renderBase(surface(W, Hh, hexLin('#07080b')), s1);
  assert.deepEqual(A.px, B.px);
  const La = renderLive(surface(W, Hh), s0), Lb = renderLive(surface(W, Hh), s1);
  let d = 0; for (let i = 0; i < La.px.length; i++) d += Math.abs(La.px[i] - Lb.px[i]);
  assert.ok(d > 50, `live layers differ by ${d}`);
});

test('render: the head is the brightest spot near its spiral point, and the figure reads as a figure', () => {
  const W = 720, Hh = 480, sc = scene(W, Hh, [{ mask: H, square: 0 }], 1.65 * 1.5);
  const S = render(surface(W, Hh, hexLin('#07080b')), sc), px = toRGBA(S), L = luma(px, W, Hh);
  const h = spiralAt(sc.g, sc.u), k = Math.round(h.y) * W + Math.round(h.x);
  assert.ok(L[k] > 0.9, `head luma ${L[k]}`);
  const q = sc.g.squares[0];                       // figure luma inside square 0 beats the plate around it
  let inF = 0, nF = 0; for (const c of sc.cells.filter(c => c.fig === 0)) { inF += L[Math.round(c.y + c.s / 2) * W + Math.round(c.x + c.s / 2)]; nF++; }
  assert.ok(inF / nF > 0.3, `figure mean ${inF / nF}`);
  assert.ok(q.s > 0);
});

test('golden image: the plate with an H at t = 2.5 s (SSIM >= 0.985)', () => {
  const W = 480, Hh = 320, sc = scene(W, Hh, [{ mask: H, square: 0 }, { mask: mask(8, 8, (i, j) => (i + j) % 3 ? 1 : 0), square: 1, scale: 0.6 }], 2.5);
  const S = render(surface(W, Hh, hexLin('#07080b')), sc);
  leaders(S, placeLabels(sc.tracked, 0, { W, H: Hh, font: 10 }), sc);
  const r = golden('construct-H-2.5s', luma(toRGBA(S), W, Hh), W, Hh, { tw: 160 });
  assert.ok(r.created || r.pass, `ssim ${r.score}`);
});

test('false-success control: the golden check rejects the plate at a different moment', () => {
  const W = 480, Hh = 320, sc = scene(W, Hh, [{ mask: H, square: 0 }, { mask: mask(8, 8, (i, j) => (i + j) % 3 ? 1 : 0), square: 1, scale: 0.6 }], 2.5);
  const shifted = scene(W, Hh, [{ mask: mask(20, 24, (i, j) => (j < 5 || j >= 19 || i < 5) ? 1 : 0), square: 0 }, { mask: mask(8, 8, (i, j) => (i + j) % 3 ? 1 : 0), square: 1, scale: 0.6 }], 2.5);
  const S = render(surface(W, Hh, hexLin('#07080b')), shifted);
  leaders(S, placeLabels(shifted.tracked, 0, { W, H: Hh, font: 10 }), shifted);
  const r = golden('construct-H-2.5s', luma(toRGBA(S), W, Hh), W, Hh, { tw: 160 });
  assert.equal(r.created, false); assert.equal(r.pass, false, `a C in place of the H still scored ${r.score}`);
  void sc;
});

test('labels route around the letters: no label box covers a figure cell, every leader ends on its box', async () => {
  const { glyphGrid, leaderEnd, trackedAt } = await import('./construct.js');
  const W = 900, H = 600, word = mask(60, 16, (i, j) => (Math.floor(i / 6) % 2 === 0 && j > 1 && j < 14) ? 1 : 0);
  const sc = scene(W, H, [{ mask: word, square: 0, scale: 0.95 }], 0, { tracked: 9 });
  const avoid = glyphGrid(sc.cells, W, H, { step: 4, pad: 2 }), figs = sc.cells.filter(c => c.fig >= 0);
  const pts = trackedAt(sc, 0), out = placeLabels(pts, 0, { W, H, font: 12, gap: 9, avoid });
  assert.ok(out.length >= 7, `placed ${out.length} of ${pts.length}`);
  for (const p of out) {
    for (const c of figs) assert.ok(!(p.box.x < c.x + c.s && c.x < p.box.x + p.box.w && p.box.y < c.y + c.s && c.y < p.box.y + p.box.h), `label ${p.text} covers a letter cell`);
    const e = leaderEnd(p, p.box);
    assert.ok(e.x >= p.box.x - 1e-9 && e.x <= p.box.x + p.box.w + 1e-9 && e.y >= p.box.y - 1e-9 && e.y <= p.box.y + p.box.h + 1e-9);
  }
  // false-success control: without the mask, the same labels do land on letters
  const naive = placeLabels(pts, 0, { W, H, font: 12, gap: 9 });
  assert.ok(naive.some(p => figs.some(c => p.box.x < c.x + c.s && c.x < p.box.x + p.box.w && p.box.y < c.y + c.s && c.y < p.box.y + p.box.h)), 'control: unmasked labels should hit a letter');
});
