// pieces-glyph.mjs: Glyph field (the warm counterweight alone) and Static weather (a painted band put
// through a broadcast, glyphs quantized to the sheet's cell, a strip of generator tiles).
import { sheet, layer, Layer } from './layer.mjs';
import { hamming, film } from './sources.mjs';
import * as H from './hud.mjs';
import * as Gl from './glyphs.mjs';
import { text, measure } from './numerals.mjs';
import { rng, hash } from './px.mjs';
import { INK, PITCH, DUO } from './pieces-sheets.mjs';
import { render as brushRender } from '../../feed-23/build/brush/index.js';
import { curlPath, line as strokeLine } from '../../feed-23/build/brush/paths.js';

const PRIM = ['#f2260a', '#f0e427', '#3411ee', '#38f30e'];

// Scatter n points in [x0, x1] x [y0, y1] that keep `gap` from every point in `avoid` and each other.
function scatter(R, n, box, gap, avoid = []) {
  const out = [];
  for (let t = 0; t < n * 60 && out.length < n; t++) {
    const p = [box[0] + R() * (box[2] - box[0]), box[1] + R() * (box[3] - box[1])];
    if ([...avoid, ...out].every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > gap + (q[2] ?? 0))) out.push(p);
  }
  return out;
}

// The glyph vocabulary on one layer: a main body, satellites, split discs, rimmed discs and stars.
function cluster(S, x, y, size, seed, { stars = 9, ink = '#271d21', rim = '#cc7b38' } = {}) {
  const R = rng(hash(seed, 11)), g = Gl.design(seed, { tubes: 5, blobs: 2 });
  const placed = Gl.paint(S, g, x + size * 0.2, y + size * 0.16, size * 0.62, { ink, rim, seed, discs: 4, primaries: PRIM });
  const s1 = Gl.design(seed + 1, { tubes: 2, blobs: 1, steps: 16 }), s2 = Gl.design(seed + 2, { tubes: 2, blobs: 1, steps: 14 });
  Gl.paint(S, s1, x + size * 0.02, y + size * 0.04, size * 0.22, { ink, rim, seed: seed + 1, discs: 1, primaries: PRIM.slice(3) });
  Gl.paint(S, s2, x + size * 0.76, y + size * 0.62, size * 0.22, { ink, rim, seed: seed + 2, discs: 1, primaries: PRIM.slice(1) });
  Gl.splitDisc(S, x + size * 0.66, y + size * 0.12, size * 0.055, { colours: [PRIM[2], PRIM[0], PRIM[1]], rot: 0.5, rim });
  Gl.splitDisc(S, x + size * 0.14, y + size * 0.8, size * 0.045, { colours: [PRIM[3], PRIM[2]], rot: 2.1, rim });
  const avoid = [[x + size * 0.5, y + size * 0.47, size * 0.33]];
  scatter(R, 5, [x + size * 0.04, y + size * 0.04, x + size * 0.96, y + size * 0.96], size * 0.06, avoid).forEach((p, k) => {
    const r = size * (0.012 + R() * 0.014); Gl.splitDisc(S, p[0], p[1], r, { colours: [PRIM[k % 4]], rim }); avoid.push([...p, r]);
  });
  scatter(R, stars, [x, y, x + size, y + size], size * 0.07, avoid).forEach((p, k) => Gl.star(S, p[0], p[1], size * (0.012 + R() * 0.02), { ink: k % 3 ? ink : '#d84938', rim: k % 2 ? rim : null }));
  return { discs: placed.length + 7, stars };
}

export function glyphField(W, { seed = 28 } = {}) {
  const S = sheet(W, W, { ground: '#e2e5df', mat: 0, seed }), info = cluster(S, -W * 0.16, W * 0.22, W * 1.02, seed);
  // the cluster sits low and left, cropped by the edge: a centred mass on a pale ground is image 28's layout (the similarity gate measured pHash 14 against it)
  S.blur({ r: Math.max(1, Math.round(W / 1400)) });
  // no corner caption: on this piece a parameter row reads as process narration (framework rule, 2026-10-23);
  // seed and counts stay in meta, where they are data, not decoration
  // grain at the glyph pieces' measured amplitude (0.045, heavy, a declared setting) and cell (1/700 of the width)
  return { sheet: S, grain: { std: 0.045, size: W / 700 }, meta: { seed, ...info } };
}

// Our own painted field for the brush engine: dark haze, wine and ember billows, a few hot filaments.
function emberScene(seed, aspect) {
  const R = rng(seed), ops = [], add = (b, c, pts, over) => ops.push({ b, c, pts, seed: (R() * 1e9) | 0, over });
  for (let i = 0; i < 9; i++) add('haze', '#141015', strokeLine(R() * 0.3, R() * aspect, 0.7 + R() * 0.3, R() * aspect, { n: 8, bow: 0.05 }), { size: 0.22 });
  for (let i = 0; i < 70; i++) add('billow', R() < 0.5 ? '#6b1f1a' : '#a8401b', curlPath(seed + i, R(), R() * aspect, { steps: 8, step: 0.02, drift: [0.3, -0.4] }), { size: 0.04 + R() * 0.05, flow: 0.18 });
  for (let i = 0; i < 40; i++) add('billow', R() < 0.6 ? '#d9661c' : '#e7a93a', curlPath(seed + 200 + i, 0.15 + R() * 0.7, aspect * (0.25 + R() * 0.5), { steps: 6, step: 0.015, drift: [0.1, -0.6] }), { size: 0.02 + R() * 0.03, flow: 0.2 });
  for (let i = 0; i < 14; i++) add('filament', '#ffcf7a', curlPath(seed + 400 + i, R(), aspect * (0.3 + R() * 0.5), { steps: 30, step: 0.01, drift: [0.2, -0.5] }));
  return { aspect, ground: ['#120d10', '#2a1412'], ops };
}

export async function staticWeather(W, { seed = 32 } = {}) {
  const S = sheet(W, W, { ground: INK.paper, seed }), I = S.inner, u = I.w / 1000, X = (v) => I.x + v * u, Y = (v) => I.y + v * u, hair = Math.max(1, 1.1 * u), px = Math.max(1, Math.round(2.4 * u));
  // band A: the painted field at half size, scaled up, then a scanline wave, block corruption and line layers
  const aw = Math.round(1000 * u), ah = Math.round(400 * u), half = Math.round(aw / 2), surf = await brushRender(emberScene(seed, ah / aw), half);
  const A = new Layer(aw, ah, { seed: hash(seed, 2) });
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const sx = Math.min(surf.w - 1, (x * surf.w) / aw | 0), sy = Math.min(surf.h - 1, (y * surf.h) / ah | 0), k = 4 * (sy * surf.w + sx), a = surf.px[k + 3] || 1;
    A.px[3 * (y * aw + x)] = surf.px[k] / a; A.px[3 * (y * aw + x) + 1] = surf.px[k + 1] / a; A.px[3 * (y * aw + x) + 2] = surf.px[k + 2] / a;
  }
  const wave = { wavelength: Math.round(42 * u), amp: Math.round(9 * u), band: Math.max(2, Math.round(4.5 * u)) };
  A.blur({ r: 1 }).scanwave({ ...wave, twist: 0.02 / u, dim: 0.6, swap: true, region: { x: 0, y: 0.18, w: 0.62, h: 0.82 } }).blocks({ count: 160, palette: ['#7a2c8c', '#1f8f86', '#0f0e0f', '#3d7a3a'] }).lines({ count: 6, width: Math.max(1, Math.round(u)), alpha: 0.45 });
  S.place(A, X(0), Y(0));
  const tw = measure('WAVE 000 PX', px) + 4 * px;
  for (const [k, s] of [[0, `WAVE ${wave.wavelength} PX`], [1, `AMP ${wave.amp} PX`], [2, `BAND ${wave.band} PX`]]) { S.place(layer(tw, 11 * px, { fill: INK.black }), X(8), Y(8) + k * 13 * px); text(S, s, X(8) + 2 * px, Y(8) + k * 13 * px + 2 * px, { px, ink: INK.hair }); }
  // band B: the glyph cluster on paper, quantized to the sheet cell (tile pitch / 16), posterized flat
  const cell = Math.max(2, Math.round((PITCH * u) / 16)), bw = Math.round(1000 * u), bh = Math.round(380 * u), B = layer(bw, bh, { fill: '#cbcdca', seed });
  cluster(B, bw * 0.2, -bh * 0.38, bh * 1.75, seed + 5, { rim: '#d6a141' });
  for (let i = 0; i < 9; i++) for (const yy of [0.08, 0.92]) Gl.star(B, bw * (0.04 + i * 0.115), bh * yy, bh * 0.035, { ink: '#271d21' });
  B.pixelate({ size: cell }).posterize({ levels: 6 });
  S.place(B, X(0), Y(410));
  text(S, `CELL ${cell} PX = PITCH / 16`, X(12), Y(410) + bh * 0.2, { px, ink: '#271d21' });
  // band C: a strip of generator tiles and primaries, a ruler ticked at the cell
  const R = rng(hash(seed, 4)), flats = [INK.yellow, INK.blue, INK.red, INK.black];
  S.mosaic({ x: X(0), y: Y(800), pitch: PITCH * u, cols: 13, rows: 1, fill: (i, j, w, h) => {
    if (i % 3 === 1) return flats[(R() * 4) | 0];
    return i % 3 === 0 ? hamming(w, h, { mod: 4 + (i % 6), x0: 100 + i * 37, scale: Math.max(1, Math.round(u)) }).posterize({ levels: 4 }).ramp({ stops: DUO.hot }) : film(w, h, { seed: seed + i }).saturate({ s: 0.6 }).posterize({ levels: 6 });
  } });
  S.place(layer(Math.round(1000 * u), Math.round(110 * u), { fill: INK.black }), X(0), Y(874));
  H.ruler(S, X(20), Y(960), 960 * u, { step: cell * 4, major: 4, tick: 7 * u, long: 16 * u, w: hair, ink: INK.hair });
  text(S, `TICK ${cell * 4} PX  LAMBDA ${wave.wavelength}`, X(980), Y(890), { px, ink: INK.hair, align: 'right' });
  H.dashedCircle(S, X(0) + bw * 0.2 + bh * 0.875, Y(410) + bh * 0.42, bh * 0.62, { w: hair, ink: INK.black, dash: 6 * u, gap: 5 * u });
  for (const f of [0.116, 0.528]) H.rule(S, X(f * 1000), Y(0), X(f * 1000), Y(1000), { w: hair, ink: INK.grey, alpha: 0.85 });
  return { sheet: S, grain: { std: 0.015, size: W / 700 }, meta: { seed, cell, ...wave } };
}
