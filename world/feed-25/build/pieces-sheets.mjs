// pieces-sheets.mjs: Sheet I (plate and crowd) and Sheet II (archive carried). Every position is in
// sheet units (a thousandth of the inner width), so a piece renders the same at any size.
// Every HUD mark points at a computed feature; every numeral prints a parameter.
import { sheet, layer } from './layer.mjs';
import { chladni, swimmers, plate, film, hamming, noise } from './sources.mjs';
import * as H from './hud.mjs';
import { text, readout, measure } from './numerals.mjs';
import { rng, hash } from './px.mjs';
import { fillShape } from './hud.mjs';

export const INK = { black: '#0f0e0f', paper: '#d4cebe', red: '#c8322b', yellow: '#d79e35', blue: '#1d2562', hair: '#f4f1ea', grey: '#8a867c', sepia: '#cdbeaf' };
export const DUO = { blue: ['#141a2e', '#a9b7d6'], sepia: ['#1a1410', '#e3d6c0'], hot: ['#2a0a12', '#e2245a', '#f2a04a'] };
export const PITCH = 74; // tile pitch in sheet units: 7.4% of the inner width, measured on image 34

const frame = (W, seed, ground) => {
  const S = sheet(W, W, { ground, seed }), I = S.inner, u = I.w / 1000;
  return { S, u, X: (v) => I.x + v * u, Y: (v) => I.y + v * u, R: rng(hash(seed, 1)), px: Math.max(1, Math.round(2.4 * u)), hair: Math.max(1, 1.1 * u) };
};
const bar = (S, x, y, w, h, c) => S.place(layer(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), { fill: c }), x, y);

// A dial whose filled sector is a real share (k of n), ringed by a dashed circle.
export function dial(S, cx, cy, r, k, n, { fill, ink, w }) {
  const a1 = -Math.PI / 2 + (2 * Math.PI * k) / n;
  fillShape(S, cx - r, cy - r, cx + r, cy + r, (x, y) => { if (Math.hypot(x - cx, y - cy) > r * 0.78) return false; let a = Math.atan2(y - cy, x - cx); if (a < -Math.PI / 2) a += 2 * Math.PI; return a <= a1; }, fill);
  H.dashedCircle(S, cx, cy, r, { w, ink, dash: r * 0.08, gap: r * 0.06 });
}

// A numeral tag: the value on a small black backing, so it reads on any tile.
function tag(S, str, x, y, px, ink = INK.hair, back = INK.black) {
  const w = measure(str, px) + 4 * px; bar(S, x, y, w, 11 * px, back); text(S, str, x + 2 * px, y + 2 * px, { px, ink }); return w;
}

export function sheetOne(W, { seed = 25 } = {}) {
  const { S, u, X, Y, R, px, hair } = frame(W, seed, INK.paper), pitch = PITCH * u;
  bar(S, X(0), Y(48), 230 * u, 36 * u, INK.black); bar(S, X(300), Y(22), 220 * u, 36 * u, INK.red); bar(S, X(420), Y(46), 230 * u, 36 * u, INK.black);
  // hero plate: one membrane mode as sand on black, every crossing marked, its pair printed
  const hs = Math.round(170 * u), hero = chladni(hs, hs, { n: 4, m: 7, mix: 30, width: 0.09, sand: 0.95, seed: hash(seed, 3) }).duotone(INK.black, '#e9e2d0');
  S.place(hero, X(800), Y(12)); for (const q of hero.meta.chladni.antinodes) H.crosshair(S, X(800) + q[0] * hs, Y(12) + q[1] * hs, 4 * u, { w: hair, ink: INK.red });
  H.dashedCircle(S, X(800) + hs / 2, Y(12) + hs / 2, hs * 0.62, { w: hair, ink: INK.black, dash: 4 * u, gap: 3 * u });
  text(S, `4x7 MIX 30 ANTINODES ${hero.meta.chladni.antinodes.length}`, X(790), Y(110), { px: Math.max(1, Math.round(1.6 * u)), ink: INK.black, align: 'right' });
  H.rule(S, X(560), Y(130), X(790), Y(130), { w: hair, ink: INK.black });
  // mosaic band: Chladni membrane tiles (posterized, duotone, moshed) between flat primaries
  const flats = [INK.yellow, INK.blue, INK.red, INK.black], marks = [];
  let gen = 0;
  S.mosaic({ x: X(0), y: Y(200), pitch, cols: 13, rows: 4, fill: (i, j, w, h) => {
    if (R() < 0.42) return flats[(R() * flats.length) | 0];
    const n = 1 + ((R() * 6) | 0), m = ((n + 1 + ((R() * 4) | 0)) % 7) + 1, mix = [0, 15, 30, 45][(R() * 4) | 0], duo = (i + j) % 3 ? DUO.blue : DUO.sepia; gen++;
    const T = chladni(w, h, { n, m, mix, width: 0.1, sand: 0.85, seed: hash(seed, i * 31 + j) }).posterize({ levels: 5, soft: 0.15 }).duotone(...duo);
    return (i * 7 + j) % 3 === 0 ? T.mosh({ block: Math.max(3, Math.round(w / 16)), steps: 2, carry: 0.35, strength: 1 }) : T;
  } });
  const tiles = S.meta.tiles.filter((t) => t.meta?.chladni);
  for (const t of tiles.filter((_, k) => k % 4 === 1)) {
    const c = t.meta.chladni, best = c.crossings.reduce((a, q) => (Math.hypot(q[0] - 0.5, q[1] - 0.5) < Math.hypot(a[0] - 0.5, a[1] - 0.5) ? q : a), [0.5, 0.5]);
    const cx = t.x + best[0] * t.w, cy = t.y + best[1] * t.h;
    if (c.crossings.length) { H.crosshair(S, cx, cy, t.w * 0.32, { w: hair, ink: INK.hair }); H.dashedCircle(S, cx, cy, t.w * 0.2, { w: hair, ink: INK.hair, dash: 4 * u, gap: 3 * u }); marks.push([cx, cy]); }
    tag(S, `${c.n}x${c.m}`, t.x + 3 * u, t.y + t.h - 14 * px, px);
  }
  // swimmer band: the colony, with a plexus at a stated radius and its centre of mass ringed
  const bw = Math.round(940 * u), bh = Math.round(250 * u), bx = X(0), by = Y(530), radius = 62 * u;
  const L = swimmers(bw, bh, { seed: hash(seed, 9), steps: 900, count: 140, pellets: 9 });
  const col = L.meta.colony; L.posterize({ levels: 6 }).mosh({ block: Math.max(3, Math.round(7 * u)), steps: 2, carry: 0.35, strength: 1.2, drift: [-0.6, 0] });
  S.place(L, bx, by);
  const pts = col.points.map((p) => [bx + p[0], by + p[1]]), links = H.plexus(S, pts, radius, { w: hair, ink: INK.hair, alpha: 0.55, node: 1.6 * u });
  const [ccx, ccy] = [bx + col.centre[0], by + col.centre[1]], rms = Math.min(110 * u, Math.sqrt(pts.reduce((a, p) => a + (p[0] - ccx) ** 2 + (p[1] - ccy) ** 2, 0) / pts.length) * 0.5);
  H.dashedCircle(S, ccx, ccy, rms, { w: 1.6 * hair, ink: INK.yellow, dash: 6 * u, gap: 4 * u }); H.crosshair(S, ccx, ccy, 14 * u, { w: hair, ink: INK.yellow });
  tag(S, `R ${Math.round(radius)} PX`, bx + 8 * u, by + 8 * u, px); tag(S, `LINKS ${links}`, bx + 8 * u, by + 8 * u + 13 * px, px);
  // instrument panel, ruler strip and the rules that cross the whole sheet
  bar(S, X(60), Y(800), 940 * u, 140 * u, INK.black); bar(S, X(60), Y(940), 940 * u, 3 * u, INK.yellow);
  H.hatchBox(S, X(76), Y(816), 150 * u, 108 * u, { spacing: 7 * u, w: hair, ink: INK.hair });
  H.dotGrid(S, X(10), Y(812), 6, 10, 7 * u, 1.3 * u, { ink: INK.black });
  readout(S, [['SEED', String(seed)], ['PITCH', `${Math.round(pitch)} PX`], ['MODES', `${gen}/52`], ['SWIMMERS', String(col.swimmers)], ['STEPS', String(col.steps)]], X(262), Y(814), { px: Math.max(1, Math.round(1.6 * u)), ink: INK.hair, rule: INK.grey });
  dial(S, X(860), Y(870), 52 * u, gen, 52, { fill: INK.yellow, ink: INK.hair, w: hair });
  H.rule(S, X(560), Y(905), X(790), Y(905), { w: hair, ink: INK.hair });
  for (const m of marks.slice(0, 2)) H.dashLine(S, m[0], m[1], X(860), Y(870), { w: hair, ink: INK.grey, dash: 5 * u, gap: 5 * u });
  H.ruler(S, X(0), Y(992), 962 * u, { step: pitch / 4, major: 4, tick: 7 * u, long: 16 * u, w: hair, ink: INK.black });
  for (const f of [0.335, 0.528]) H.rule(S, X(f * 1000), Y(0), X(f * 1000), Y(1000), { w: hair, ink: INK.grey, alpha: 0.85 });
  H.rule(S, X(0), Y(194), X(1000), Y(194), { w: hair, ink: INK.grey, alpha: 0.85 });
  return { sheet: S, grain: { std: 0.015, size: W / 700 }, meta: { seed, generatorTiles: gen, links, radius: Math.round(radius), swimmers: col.swimmers } };
}

export function sheetTwo(W, plates, { seed = 26 } = {}) {
  const { S, u, X, Y, R, px, hair } = frame(W, seed, INK.sepia), pitch = PITCH * u, need = ['horse-in-motion', 'district-map', 'deep-field', 'concrete-facade', 'edison-catalog', 'eiffel-heights'];
  for (const k of need) if (!plates[k]) throw new Error(`sheetTwo: plate "${k}" missing (run tools/plates.py)`);
  // band A: Muybridge's horse, posterized and duotoned, carrying the district map's texture along its own edges
  const aw = Math.round(1000 * u), ah = Math.round(260 * u), base = plate(plates['horse-in-motion'], aw, ah, { focus: [0.5, 0.3], seed });
  const carried = plate(plates['district-map'], aw, ah, { focus: [0.4, 0.5], seed: seed + 1 }).posterize({ levels: 4 });
  base.posterize({ levels: 4 }).mosh({ block: Math.max(4, Math.round(10 * u)), steps: 4, carry: 0.55, strength: 1.6, from: carried }).duotone(...DUO.blue);
  S.place(base, X(0), Y(0));
  tag(S, String(plates['horse-in-motion'].year), X(8), Y(262) - 12 * px, px); tag(S, String(plates['district-map'].year), X(8) + 30 * px, Y(262) - 12 * px, px);
  // band B: mosaic of plates, moshed and posterized, between flat primaries; each tile prints its plate year
  const names = ['deep-field', 'concrete-facade', 'edison-catalog', 'eiffel-heights'], flats = [INK.yellow, INK.blue, INK.red, INK.black], years = [];
  S.mosaic({ x: X(0), y: Y(300), pitch, cols: 13, rows: 3, fill: (i, j, w, h) => {
    if (R() < 0.38) return flats[(R() * flats.length) | 0];
    const nm = names[(R() * names.length) | 0], duo = [DUO.sepia, DUO.hot, DUO.blue][(i + 2 * j) % 3];
    const T = plate(plates[nm], w, h, { focus: [R(), R()], zoom: 1.5 + R() * 3, seed: hash(seed, i * 13 + j) }).posterize({ levels: 5 }).ramp({ stops: duo }).mosh({ block: Math.max(3, Math.round(w / 12)), steps: 3, carry: 0.6, strength: 1.4 });
    if (j === 2 && i % 3 === 0) years.push([i, plates[nm].year]); return T;
  } });
  for (const [i, yr] of years) tag(S, String(yr), Math.round(X(0) + i * pitch) + 3 * u, Math.round(Y(300) + 3 * pitch) - 12 * px, px);
  // band C: the thin-film light material, block sizes driven by noise; the Hamming field at its right
  const cw = Math.round(700 * u), ch = Math.round(200 * u), F = film(cw, ch, { seed: hash(seed, 5) }).modulatePixelate({ by: noise(cw, ch, { scale: 3, seed }), min: Math.max(2, Math.round(3 * u)), max: Math.max(8, Math.round(48 * u)) });
  S.place(F, X(0), Y(560));
  const Hm = hamming(Math.round(260 * u), ch, { mod: 8, scale: Math.max(1, Math.round(2 * u)) }).posterize({ levels: 4 }).ramp({ stops: ['#0f0e0f', INK.blue, INK.red, INK.yellow] });
  S.place(Hm, X(740), Y(560));
  // the brightest block of the film band gets the doubled heptagon
  let best = -1, bxy = [0, 0]; const Y8 = F.lumaField(), st = Math.max(4, Math.round(24 * u));
  for (let y = 0; y + st <= F.h; y += st) for (let x = 0; x + st <= F.w; x += st) { let s = 0; for (let j = 0; j < st; j++) for (let i = 0; i < st; i++) s += Y8[(y + j) * F.w + x + i]; if (s > best) { best = s; bxy = [x + st / 2, y + st / 2]; } }
  const hx = X(0) + bxy[0], hy = Y(560) + bxy[1];
  H.polygon(S, hx, hy, 46 * u, 7, { w: 1.4 * hair, ink: INK.hair, fill: INK.yellow, double: 6 * u });
  tag(S, 'FILM 180-760 NM', X(8), Y(768) - 12 * px, px); tag(S, 'HAMMING MOD 8', X(748), Y(768) - 12 * px, px);
  // panel D and ruler
  bar(S, X(0), Y(800), 1000 * u, 150 * u, INK.black);
  H.polygon(S, X(560), Y(880), 60 * u, 3, { w: 1.6 * hair, ink: INK.hair, double: 9 * u, rot: -0.3 });
  H.dot(S, X(790), Y(870), 9 * u, { ink: INK.yellow }); H.crosshair(S, X(790), Y(870), 24 * u, { w: hair, ink: INK.hair, gap: 12 * u });
  H.dashLine(S, hx, hy, X(790), Y(870), { w: hair, ink: INK.grey, dash: 5 * u, gap: 5 * u });
  readout(S, need.map((k) => [k.split('-')[0].toUpperCase(), String(plates[k].year)]), X(20), Y(812), { px: Math.max(1, Math.round(1.5 * u)), ink: INK.hair, rule: INK.grey });
  H.hatchBox(S, X(860), Y(820), 120 * u, 110 * u, { spacing: 7 * u, w: hair, ink: INK.hair, angle: -Math.PI / 4 });
  H.ruler(S, X(0), Y(990), 1000 * u, { step: pitch / 4, major: 4, tick: 7 * u, long: 16 * u, w: hair, ink: INK.black });
  for (const f of [1 / 3, 2 / 3]) H.rule(S, X(f * 1000), Y(0), X(f * 1000), Y(1000), { w: hair, ink: INK.grey, alpha: 0.85 });
  return { sheet: S, grain: { std: 0.015, size: W / 700 }, meta: { seed, plates: need } };
}
